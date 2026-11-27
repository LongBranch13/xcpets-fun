#!/usr/bin/env node
/* A resumed replay must hash the same as a full replay. Splits of every snap fixture and of the shipped live burn list.
 * The rules file is patched in memory only. js/v2-rules.js on disk is not written.
 *   node tools/resume-equiv-test.js               both halves (about 10 minutes)
 *   XP_SNAP_ONLY=1 node tools/resume-equiv-test.js   the snap fixtures only (also what the suite runs for this file)
 *   node tools/resume-equiv-live-test.js          the live burn list: full list + half split (also -back-test.js and -tip-test.js)
 * Each half replays the whole game several times, so together they ran into the suite's 600 s per-test limit. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const { patchRules, wsDecode, canResume, checkpointMeta } = require('../js/v2-resume');
const fixtures = require('./lib/fixtures');
fixtures.ensure();
const ROOT = path.resolve(__dirname, '..');
let fail = 0;
function ok(c, m) { if (c) console.log('ok', m); else { console.log('FAIL', m); fail++; } }
function memStore() { const s = {}; return { getItem: k => (k in s ? s[k] : null), setItem: (k, v) => { s[k] = String(v); }, removeItem: k => { delete s[k]; } }; }
const SCRIPTS = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js', 'js/block-hashes.js', 'js/v2-replay-worker.js'];
function boot(patch) {
  const win = { console: { log() {}, warn() {}, error() {}, info() {} }, localStorage: memStore(), sessionStorage: memStore(), location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/js/v2-replay-worker.js' }, navigator: { userAgent: 'node' }, setTimeout, clearTimeout, URLSearchParams, URL, TextEncoder, TextDecoder, addEventListener() {}, importScripts() {}, fetch: () => Promise.reject(new Error('offline')) };
  win.document = { getElementById() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; }, createElement() { return { style: {} }; }, addEventListener() {}, body: null, documentElement: { style: {} }, readyState: 'complete' };
  win.window = win; win.self = win;
  const ctx = vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/v2-resume.js'), 'utf8'), ctx, { filename: 'js/v2-resume.js' });
  for (const f of SCRIPTS) {
    let src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (patch && f === 'js/v2-rules.js') src = patchRules(src);
    if (f === 'rjs/chain.js') vm.runInContext('window.LiveEngine={RealCore:window.RealCore,Chain:window.Chain&&window.Chain.Chain,CFG:window.XCPETS_CONFIG};', ctx);
    vm.runInContext(src, ctx, { filename: f });
  }
  return ctx;
}
/* Sorted-key hash of the world. Cycles (a pet's children point back) are one marker.
 * This is the game state. The IndexedDB encoder's digest also depends on allocation order, which a resume does not have to copy. */
function stateHash(world) {
  const h = crypto.createHash('sha256'), seen = new Set();
  function canon(v) {
    if (!v || typeof v !== 'object') { h.update(JSON.stringify(v === undefined ? null : v)); h.update('\n'); return; }
    if (seen.has(v)) { h.update('"@"\n'); return; }
    seen.add(v);
    if (Array.isArray(v)) { h.update('['); for (let i = 0; i < v.length; i++) canon(v[i]); h.update(']'); return; }
    const ks = Object.keys(v).sort();
    h.update('{');
    for (let i = 0; i < ks.length; i++) { const k = ks[i]; if (typeof v[k] === 'function') continue; h.update(JSON.stringify(k)); h.update(':'); canon(v[k]); }
    h.update('}');
  }
  canon(world);
  return h.digest('hex');
}
function chainCut(rows, tip) { return rows.filter(r => r.block_index <= tip); }
function splitsOf(rows, tip, fracs) {
  const blocks = Array.from(new Set(rows.map(r => r.block_index))).sort((a, b) => a - b);
  const out = [];
  (fracs || [0.5, 0.9]).forEach(f => {
    const n = Math.max(1, Math.min(blocks.length - 1, Math.floor(blocks.length * f)));
    const cut = blocks[n - 1];
    if (cut < tip) out.push({ name: 'fraction ' + f, baseTip: cut, baseRows: chainCut(rows, cut) });
  });
  if (blocks.length > 4) {
    const cut = blocks[blocks.length - 3];
    out.push({ name: 'three blocks back', baseTip: cut, baseRows: chainCut(rows, cut) });
  }
  return out;
}
function mergeHashes(ctx, hashes) { return Object.assign({}, ctx.XCPETS_BLOCK_HASHES || {}, hashes || {}); }
/* The full replay of the same burns, tip and DEX data is the same every time: hash it once (each live replay is about a minute,
 * and the live cases used to redo it four times, which pushed this test past the 600 s limit). Keyed by the rows/dex objects. */
const fullMemo = new WeakMap();
function fullHash(ctx, rows, hashes, tip, dex, ops) {
  if ((ops || []).length) { const w = ctx.V2Rules.replay(rows, hashes, ops, { tip: tip, live: ctx.LiveEngine.RealCore, dex: dex || undefined }); return { h: stateHash(w), n: w.pets.length }; }
  let m = fullMemo.get(rows); if (!m) fullMemo.set(rows, m = new Map());
  const k = tip + '|' + (dex ? (m.dexIds = m.dexIds || new WeakMap()).get(dex) || (m.dexIds.set(dex, (m.nd = (m.nd || 0) + 1)), m.nd) : 0);
  if (!m.has(k)) { const w = ctx.V2Rules.replay(rows, hashes, [], { tip: tip, live: ctx.LiveEngine.RealCore, dex: dex || undefined }); m.set(k, { h: stateHash(w), n: w.pets.length }); }
  return m.get(k);
}
const cpMemo = new WeakMap();
function capture(ctx, w, seen, tip) {
  const enc = ctx.wsEncode(w), keys = [];
  for (const k in seen) if (Object.prototype.hasOwnProperty.call(seen, k)) keys.push(k);
  const out = { w: wsDecode(enc.root, enc.parts), seen: keys, dexPos: w._dexPos || 0, grand: w._grand ? 1 : 0, tip: tip };
  enc.root = null; enc.parts = null; return out;
}
async function samePair(label, rows, hashes, tip, dex, ops) {
  const plain = boot(false), patched = boot(true);
  hashes = mergeHashes(plain, hashes);
  const a = fullHash(plain, rows, hashes, tip, dex, ops);
  let cp = null;
  const b = patched.V2Rules.replay(rows, hashes, ops || [], { tip: tip, live: patched.LiveEngine.RealCore, dex: dex || undefined, _beforeTail: function (w, seen) { cp = capture(patched, w, seen, tip); } });
  if (cp && !(ops || []).length) cpMemo.set(rows, Object.assign(cpMemo.get(rows) || {}, { [tip]: { dex: dex, cp: cp } }));
  const da = a.h, db = stateHash(b);
  ok(da === db && a.n === b.pets.length, label + ' patched full replay matches the unpatched rules');
  return da;
}
async function resumeCase(label, rows, hashes, finalTip, dex, baseRows, baseTip, baseDex, ops) {
  const plain = boot(false), patched = boot(true);
  hashes = mergeHashes(plain, hashes);
  const full = fullHash(plain, rows, hashes, finalTip, dex, ops);
  let saved = null;
  const memo = !(ops || []).length && cpMemo.get(baseRows) && cpMemo.get(baseRows)[baseTip];
  if (memo && memo.dex === (baseDex || null)) saved = memo.cp; /* the same base replay samePair already ran: reuse its checkpoint */
  else patched.V2Rules.replay(baseRows, hashes, ops || [], { tip: baseTip, live: patched.LiveEngine.RealCore, dex: baseDex || undefined, _beforeTail: function (w, seen) { saved = capture(patched, w, seen, baseTip); } });
  ok(!!saved, label + ' checkpoint captured');
  if (!saved) return;
  const seen = {};
  saved.seen.forEach(k => { seen[k] = 1; });
  const resumed = patched.V2Rules.replay(rows, hashes, ops || [], { tip: finalTip, live: patched.LiveEngine.RealCore, dex: dex || undefined,
    _resume: { w: saved.w, seen: seen, dexPos: saved.dexPos, grand: saved.grand, tip: baseTip, opsFrom: (ops || []).length } });
  const dFull = full.h, dResume = stateHash(resumed);
  console.log('HASH ' + label);
  console.log('  full   ' + dFull);
  console.log('  resume ' + dResume);
  ok(dFull === dResume && resumed.pets.length === full.n && resumed.tip === finalTip, label + ' resumed == full (' + (dFull === dResume ? dFull.slice(0, 12) : 'DIFF') + ')');
}
function predicateChecks(rows, hashes, tip) {
  const meta = checkpointMeta({ rows: rows, hashes: hashes, dex: null, ops: [], tip: tip, rsig: 'r-test' });
  ok(canResume(meta, { rsig: 'r-test', tip: tip, rows: rows, hashes: hashes, dex: null, ops: [] }).ok === true, 'same inputs can resume');
  ok(canResume(meta, { rsig: 'r-other', tip: tip, rows: rows, hashes: hashes, dex: null, ops: [] }).reason === 'rules', 'a different rules hash is a full replay');
  const dropped = rows.slice(1);
  ok(canResume(meta, { rsig: 'r-test', tip: tip, rows: dropped, hashes: hashes, dex: null, ops: [] }).ok === false, 'a removed burn is a full replay');
  const swapped = rows.slice();
  if (swapped.length > 3) {
    const a = Object.assign({}, swapped[1], { quantity: (Number(swapped[1].quantity) || 0) + 1 });
    swapped[1] = a;
    ok(canResume(meta, { rsig: 'r-test', tip: tip, rows: swapped, hashes: hashes, dex: null, ops: [] }).ok === false, 'a changed burn is a full replay');
  }
  const extra = rows.concat([Object.assign({}, rows[0], { tx_hash: 'f'.repeat(64), block_index: tip + 1, tx_index: 1 })]);
  const gate = canResume(meta, { rsig: 'r-test', tip: tip + 1, rows: extra, hashes: hashes, dex: null, ops: [] });
  ok(gate.ok === true && gate.tailOnly === false, 'burns appended after the checkpoint can resume');
  const tail = canResume(meta, { rsig: 'r-test', tip: tip + 1, rows: rows, hashes: hashes, dex: null, ops: [] });
  ok(tail.ok === true && tail.tailOnly === true, 'a tip change with the same burns is tail-only');
  ok(canResume(null, { rsig: 'r-test', tip: tip, rows: rows, hashes: hashes }).reason === 'missing', 'a missing checkpoint is a full replay');
}
(async () => {
  const names = fixtures.NEEDED.filter(n => fs.existsSync(path.join(fixtures.DIR, n)));
  ok(names.length >= 3, 'snap fixtures are present (' + names.length + ')');
  let first = true;
  if (!process.env.XP_LIVE_ONLY) for (const name of names) {
    const snap = JSON.parse(fs.readFileSync(path.join(fixtures.DIR, name), 'utf8'));
    const tip = snap.tip, rows = snap.rows, hashes = snap.hashes || {};
    if (first) { predicateChecks(rows, hashes, tip); first = false; }
    await samePair(name, rows, hashes, tip, null, []);
    for (const sp of splitsOf(rows, tip)) {
      if (sp.baseTip < 971500) {
        const meta = checkpointMeta({ rows: sp.baseRows, hashes: hashes, dex: null, ops: [], tip: sp.baseTip, rsig: 'r' });
        ok(canResume(meta, { rsig: 'r', tip: tip, rows: rows, hashes: hashes, dex: null, ops: [], cutoff: 971500 }).reason === 'cutoff', name + ' ' + sp.name + ' before the live cutoff is a full replay');
      } else await resumeCase(name + ' ' + sp.name, rows, hashes, tip, null, sp.baseRows, sp.baseTip, null, []);
    }
    const hashes2 = Object.assign({}, hashes, { [tip + 1]: hashes[tip] || 'ab'.repeat(32) });
    await resumeCase(name + ' tip-only', rows, hashes2, tip + 1, null, rows, tip, null, []);
  }
  /* under the test suite (XCPETS_TEST) this file is the snap half and resume-equiv-live-test.js is the live half, so each fits the 600 s limit */
  if (process.env.XP_SNAP_ONLY || (process.env.XCPETS_TEST && !process.env.XP_LIVE_ONLY)) { console.log(fail ? fail + ' failed' : 'all passed (snap fixtures; the live burn list runs in resume-equiv-live-test.js)'); process.exit(fail ? 1 : 0); }
  const boot = JSON.parse(fs.readFileSync(path.join(ROOT, 'api/boot.json'), 'utf8'));
  ok(boot.rows.length > 1000 && boot.tip > 0, 'live burn list ' + boot.tip + ' has ' + boot.rows.length + ' rows');
  const dex = boot.dex || null;
  /* XP_LIVE_ONLY picks the part: 1 = all of it (by hand), a = full list, half = the half-way split, back = three blocks back, tip = tip-only.
   * Each part is its own suite file (resume-equiv-live / -half / -back / -tip): the whole live half was ~375 s alone and passed 600 s under --jobs 4.
   * Nov 27 2026: 'a' still held the full list and the half split (364 s, 506 s, then killed at 600 s on a busy runner, with the other three parts
   * replaying beside it), so the half split is its own file. */
  const part = process.env.XP_LIVE_ONLY || '1', want = k => part === '1' || part === k;
  if (want('a')) await samePair('live list', boot.rows, boot.hashes || {}, boot.tip, dex, []);
  /* 0.5 and three-blocks-back: a checkpoint far back and one just behind the tip. 0.9 sits between them and costs a
   * near-full replay of the live list, so it is covered on the snap fixtures instead. */
  for (const sp of splitsOf(boot.rows, boot.tip, [0.5])) {
    if (!want(/^fraction/.test(sp.name) ? 'half' : 'back')) continue;
    const baseDex = dex;
    await resumeCase('live ' + sp.name, boot.rows, boot.hashes || {}, boot.tip, dex, sp.baseRows, sp.baseTip, baseDex, []);
  }
  const hashes2 = Object.assign({}, boot.hashes || {}, { [boot.tip + 1]: (boot.hashes && boot.hashes[boot.tip]) || 'cd'.repeat(32) });
  let dex2 = dex;
  if (dex) {
    dex2 = JSON.parse(JSON.stringify(dex));
    dex2.credits = (dex2.credits || []).concat([{ asset: 'A99999999999999999', block_index: boot.tip + 1, quantity: 1, address: 'bc1qtest', tx_index: 9, credit_index: 1, tx_hash: 'e'.repeat(64), calling_function: 'test' }]);
  }
  if (want('tip')) await resumeCase('live tip-only', boot.rows, hashes2, boot.tip + 1, dex2, boot.rows, boot.tip, dex, []);
  console.log(fail ? fail + ' failed' : 'all passed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
