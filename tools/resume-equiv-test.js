#!/usr/bin/env node
/* A resumed replay must hash the same as a full replay. Splits of every snap fixture and of the shipped live burn list.
 * The rules file is patched in memory only. js/v2-rules.js on disk is not written. */
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
function splitsOf(rows, tip) {
  const blocks = Array.from(new Set(rows.map(r => r.block_index))).sort((a, b) => a - b);
  const out = [];
  [0.5, 0.9].forEach(f => {
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
async function samePair(label, rows, hashes, tip, dex, ops) {
  const plain = boot(false), patched = boot(true);
  hashes = mergeHashes(plain, hashes);
  const a = plain.V2Rules.replay(rows, hashes, ops || [], { tip: tip, live: plain.LiveEngine.RealCore, dex: dex || undefined });
  const b = patched.V2Rules.replay(rows, hashes, ops || [], { tip: tip, live: patched.LiveEngine.RealCore, dex: dex || undefined });
  const da = stateHash(a), db = stateHash(b);
  ok(da === db && a.pets.length === b.pets.length, label + ' patched full replay matches the unpatched rules');
  return da;
}
async function resumeCase(label, rows, hashes, finalTip, dex, baseRows, baseTip, baseDex, ops) {
  const plain = boot(false), patched = boot(true);
  hashes = mergeHashes(plain, hashes);
  const full = plain.V2Rules.replay(rows, hashes, ops || [], { tip: finalTip, live: plain.LiveEngine.RealCore, dex: dex || undefined });
  let saved = null;
  patched.V2Rules.replay(baseRows, hashes, ops || [], { tip: baseTip, live: patched.LiveEngine.RealCore, dex: baseDex || undefined, _beforeTail: function (w, seen) {
    const enc = patched.wsEncode(w);
    const keys = [];
    for (const k in seen) if (Object.prototype.hasOwnProperty.call(seen, k)) keys.push(k);
    saved = { w: wsDecode(enc.root, enc.parts), seen: keys, dexPos: w._dexPos || 0, grand: w._grand ? 1 : 0, tip: baseTip };
    enc.root = null; enc.parts = null;
  } });
  ok(!!saved, label + ' checkpoint captured');
  if (!saved) return;
  const seen = {};
  saved.seen.forEach(k => { seen[k] = 1; });
  const resumed = patched.V2Rules.replay(rows, hashes, ops || [], { tip: finalTip, live: patched.LiveEngine.RealCore, dex: dex || undefined,
    _resume: { w: saved.w, seen: seen, dexPos: saved.dexPos, grand: saved.grand, tip: baseTip, opsFrom: (ops || []).length } });
  const dFull = stateHash(full), dResume = stateHash(resumed);
  console.log('HASH ' + label);
  console.log('  full   ' + dFull);
  console.log('  resume ' + dResume);
  ok(dFull === dResume && resumed.pets.length === full.pets.length && resumed.tip === finalTip, label + ' resumed == full (' + (dFull === dResume ? dFull.slice(0, 12) : 'DIFF') + ')');
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
  const boot = JSON.parse(fs.readFileSync(path.join(ROOT, 'api/boot.json'), 'utf8'));
  ok(boot.rows.length > 1000 && boot.tip > 0, 'live burn list ' + boot.tip + ' has ' + boot.rows.length + ' rows');
  const dex = boot.dex || null;
  await samePair('live list', boot.rows, boot.hashes || {}, boot.tip, dex, []);
  for (const sp of splitsOf(boot.rows, boot.tip)) {
    const baseDex = dex;
    await resumeCase('live ' + sp.name, boot.rows, boot.hashes || {}, boot.tip, dex, sp.baseRows, sp.baseTip, baseDex, []);
  }
  const hashes2 = Object.assign({}, boot.hashes || {}, { [boot.tip + 1]: (boot.hashes && boot.hashes[boot.tip]) || 'cd'.repeat(32) });
  let dex2 = dex;
  if (dex) {
    dex2 = JSON.parse(JSON.stringify(dex));
    dex2.credits = (dex2.credits || []).concat([{ asset: 'A99999999999999999', block_index: boot.tip + 1, quantity: 1, address: 'bc1qtest', tx_index: 9, credit_index: 1, tx_hash: 'e'.repeat(64), calling_function: 'test' }]);
  }
  await resumeCase('live tip-only', boot.rows, hashes2, boot.tip + 1, dex2, boot.rows, boot.tip, dex, []);
  console.log(fail ? fail + ' failed' : 'all passed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
