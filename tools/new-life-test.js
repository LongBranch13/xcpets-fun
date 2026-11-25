#!/usr/bin/env node
/* New life (ACTIVATE_NEW_LIFE_BLOCK, Nov 24 2026, root-cause cleanup): a raised or Resurrected pet drops the discard (hd) and
 * feed-skip (skipBy) flags of its old life. Checks on real history (api/boot.json):
 *   - with the gate at its real block, the replay is unchanged (the block is ahead of the feed),
 *   - with the gate switched on early, the ONLY differences are hd/skipBy dropped on pets that rose or were Resurrected after
 *     the early block, and every such pet that is alive is feedable again for its owner (not 'discarded').
 *   node tools/new-life-test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const SCRIPTS = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', '@LIVE', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js', 'js/block-hashes.js'];
function load() {
  const store = {}, ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const win = { console: { log() {}, warn() {}, error() {}, info() {} }, localStorage: ls, sessionStorage: ls, location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/' }, navigator: { userAgent: 'node' }, setTimeout: () => 0, clearTimeout() {}, URLSearchParams, URL, TextEncoder, TextDecoder, fetch: () => Promise.reject(new Error('offline')) };
  win.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {}, body: null, documentElement: { style: {} } };
  win.addEventListener = () => {}; win.window = win; win.self = win; win.globalThis = win; const ctx = vm.createContext(win);
  for (const f of SCRIPTS) { if (f === '@LIVE') { vm.runInContext('window.LiveEngine={RealCore:window.RealCore,Chain:window.Chain&&window.Chain.Chain,CFG:window.XCPETS_CONFIG};', ctx); continue; } vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
  return ctx; }
let fails = 0, n = 0; const ok = (c, m) => { n++; console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const boot = JSON.parse(fs.readFileSync(path.join(ROOT, 'api/boot.json'), 'utf8'));
const rows = boot.rows.slice().sort((a, b) => a.block_index - b.block_index || a.tx_index - b.tx_index), tip = boot.tip;
function run(gate) { const ctx = load(), V = ctx.V2Rules, E = ctx.LiveEngine; if (gate !== undefined) V._setNewLifeActivation(gate);
  const hashes = Object.assign({}, ctx.XCPETS_BLOCK_HASHES || {}, boot.hashes || {});
  return { V, w: V.replay(rows, hashes, [], { tip, live: E && E.RealCore, dex: boot.dex }) }; }
const V = load().V2Rules; /* read the gate without a replay */
/* The gate was ahead of the feed when this was written; the feed passed it at 977,504 (Nov 25 2026). Once mined, "the real gate
 * changes nothing" no longer holds by design, so the same check runs with the gate just past the feed tip (no history after it). */
const GATE = V.ACTIVATE_NEW_LIFE_BLOCK, mined = GATE <= tip, real = mined ? run(tip + 1) : run();
ok(GATE === 977500, 'gate is 977500 (' + (mined ? 'mined before' : 'ahead of') + ' the feed tip ' + tip + ')');
const off = run(null).w;
const strip = p => { const o = Object.assign({}, p); delete o.hd; delete o.skipBy; return JSON.stringify(o); };
{ const at = real.w;
  ok(JSON.stringify(at.pets) === JSON.stringify(off.pets) && JSON.stringify(at.log) === JSON.stringify(off.log), 'gate ' + (mined ? 'just past the feed tip' : 'at its real block') + ': replay identical to the gate switched off'); }
const EARLY = 973772; /* the cemetery opened here: every raise and Resurrection in history comes after it */
const on = run(EARLY).w;
const rose = p => (p.zombie && p.zombie.raisedAt >= EARLY) || (p.zPast || []).some(z => z.raisedAt >= EARLY) || (p.resurrected && p.resurrected.block >= EARLY);
let diff = 0, flagOnly = true, notRisen = [], fixed = [];
off.pets.forEach((p, i) => { const q = on.pets[i]; if (JSON.stringify(p) === JSON.stringify(q)) return; diff++;
  if (strip(p) !== strip(q)) flagOnly = false; if (!rose(p)) notRisen.push(p.id);
  if ((p.hd && p.hd === p.owner) || (p.skipBy && p.skipBy === p.owner)) fixed.push(p.id); });
ok(flagOnly, 'switched on early (' + EARLY + '): ' + diff + ' pets differ, and only in hd/skipBy');
ok(notRisen.length === 0, 'every changed pet rose or was Resurrected after the early block' + (notRisen.length ? ' (not: ' + notRisen.slice(0, 5).join(', ') + ')' : ''));
const stillHidden = fixed.filter(id => { const q = on.byId[id]; return (q.hd && q.hd === q.owner) || (q.skipBy && q.skipBy === q.owner); });
ok(stillHidden.length === 0, fixed.length + ' pets in history kept their own owner\'s old discard/skip flag after rising (e.g. #' + fixed.slice(0, 6).join(', #') + '); with the rule none do');
const alive = fixed.map(id => on.byId[id]).filter(q => !q.dead && !q.released && !V.isZ(q));
ok(alive.every(q => V.breedable(q, tip) !== 'discarded'), alive.length + ' of them are living (Resurrected) pets: none is treated as discarded any more');
console.log(`new-life: ${n - fails} passed, ${fails} failed`); process.exit(fails ? 1 : 0);
