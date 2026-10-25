#!/usr/bin/env node
/* Pet-level earned looks (ACTIVATE_EARN_BLOCK). 1) the real gate is past every fixture tip, so nothing changes; 2) with the gate forced early,
 * only the new p.earn field changes (all other pet/gear/fight state identical) and the earning rules fire as documented. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const SCRIPTS = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', '@LIVE', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js', 'js/block-hashes.js'];
function load() { const ls = { getItem: () => null, setItem() {}, removeItem() {} };
  const win = { console: { log() {}, warn() {}, error() {}, info() {} }, localStorage: ls, sessionStorage: ls, location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/' }, navigator: { userAgent: 'node' }, setTimeout: () => 0, clearTimeout() {}, URLSearchParams, URL, TextEncoder, TextDecoder, fetch: () => Promise.reject(new Error('offline')) };
  win.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {}, body: null, documentElement: { style: {} } };
  win.addEventListener = () => {}; win.window = win; win.self = win; win.globalThis = win; const ctx = vm.createContext(win);
  for (const f of SCRIPTS) { if (f === '@LIVE') { vm.runInContext("window.LiveEngine={RealCore:window.RealCore,Chain:window.Chain&&window.Chain.Chain,CFG:window.XCPETS_CONFIG};", ctx); continue; } const p = path.join(ROOT, f); if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f }); }
  return ctx; }
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const snapF = ['snap-972901.json', 'snap-972883.json', 'snap-971786.json'].map(f => path.join(__dirname, 'snapshots', f)).find(f => fs.existsSync(f));
if (!snapF) { console.log('ok   no snapshot here (symlink tools/snapshots): skipped'); process.exit(0); }
const snap = JSON.parse(fs.readFileSync(snapF, 'utf8'));
function run(gate) { const ctx = load(), V = ctx.V2Rules, E = ctx.LiveEngine; if (gate !== undefined) V._setEarnActivation(gate);
  const hashes = Object.assign({}, ctx.XCPETS_BLOCK_HASHES || {}, snap.hashes); return { V, w: V.replay(snap.rows.filter(r => r.block_index <= snap.tip), hashes, [], { tip: snap.tip, live: E && E.RealCore }) }; }
const canon = v => JSON.stringify(v, (k, x) => (k === 'children' || k === 'earn' || k === 'earnState') ? undefined : x);
const A = run(), early = Math.min(...snap.rows.map(r => r.block_index).filter(b => b > 971800)) ;
ok(A.V.earnGate() === 973002, 'gate is 973002 (tip 972996 + 6)');
ok(!A.w.pets.some(p => p.earn) && !A.w.earnState, 'real gate past snapshot tip ' + snap.tip + ': no pet has earn state');
const B = run(early);
ok(canon(A.w.pets) === canon(B.w.pets) && canon(A.w.itemList) === canon(B.w.itemList) && canon(A.w.fights) === canon(B.w.fights), 'forced gate ' + early + ': everything except p.earn identical');
const cnt = {}; B.w.pets.forEach(p => ((p.earn && p.earn.looks) || []).forEach(id => { cnt[id] = (cnt[id] || 0) + 1; }));
console.log('     forced-gate looks earned:', JSON.stringify(cnt), 'crown state', JSON.stringify(B.w.earnState && { top: B.w.earnState.top, days: B.w.earnState.topDays }));
B.w.pets.forEach(p => { const E = p.earn; if (!E) return;
  if (E.looks.includes('laurels') && !(E.mythicWins >= 10 || E.bestStreak >= 5)) ok(false, '#' + p.id + ' laurels without reason');
  if (E.looks.includes('flame-aura') && !(E.burned >= 69000)) ok(false, '#' + p.id + ' flame aura without 69,000'); });
ok(B.w.pets.every(p => !p.earn || new Set(p.earn.looks).size === p.earn.looks.length), 'each look earned at most once per pet');
const fl = A.w.pets.filter(p => (p.flameLooks || []).length || (p.questLooks || []).length).length, flB = B.w.pets.filter(p => (p.flameLooks || []).length || (p.questLooks || []).length).length;
ok(fl === flB, 'wallet flame looks + quest looks kept (' + fl + ' pets)');
const sh = B.w.pets.find(p => p.earn && p.earn.looks.length); if (sh) { const L = B.V.shownLooks(B.w, sh); ok(new Set(L.map(x => x.type)).size === L.length, 'shownLooks one per type (#' + sh.id + ': ' + L.map(x => x.id).join(', ') + ')'); }
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
