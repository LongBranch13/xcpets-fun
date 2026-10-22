#!/usr/bin/env node
/* Mythic slots test (branch mythic-slots, owner approved Oct 22 2026 ~6:49 PM CT). Dev tooling only.
 *   node tools/mythic-slots-test.js [snap]
 * Checks: replay SAME below the gate; after it Mythics have 6 slots, bagged pieces release via unbag, slots never close; slotUnlock text. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..'), SNAP = process.argv[2] || path.join(__dirname, 'snapshots', 'snap-now.json');
const SCRIPTS = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', '@LIVE', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js', 'js/block-hashes.js'];
function load() { const store = {}, ls = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const win = { console: { log() {}, warn() {}, error() {}, info() {} }, localStorage: ls, sessionStorage: ls, location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/' }, navigator: { userAgent: 'node' }, setTimeout: () => 0, clearTimeout() {}, URLSearchParams, URL, TextEncoder, TextDecoder, fetch: () => Promise.reject(new Error('offline')) };
  win.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {}, body: null, documentElement: { style: {} } };
  win.addEventListener = () => {}; win.window = win; win.self = win; win.globalThis = win; const ctx = vm.createContext(win);
  for (const f of SCRIPTS) { if (f === '@LIVE') { vm.runInContext("window.LiveEngine={RealCore:window.RealCore,Chain:window.Chain&&window.Chain.Chain,CFG:window.XCPETS_CONFIG};", ctx); continue; } const p = path.join(ROOT, f); if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f }); }
  return ctx; }
const snap = JSON.parse(fs.readFileSync(SNAP, 'utf8')); let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
function run(gate, anyGate) { const ctx = load(), V = ctx.V2Rules; if (gate !== undefined) V._setMythicSlotsActivation(gate); if (anyGate !== undefined) V._setAnySlotActivation(anyGate); const hashes = Object.assign({}, ctx.XCPETS_BLOCK_HASHES || {}, snap.hashes);
  return { V, w: V.replay(snap.rows, hashes, [], { tip: snap.tip, live: ctx.LiveEngine && ctx.LiveEngine.RealCore }) }; }
const canon = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x)) ? Object.keys(x).sort().reduce((o, k2) => (o[k2] = x[k2], o), {}) : x);
const sig = w => canon(Object.values(w.items).map(g => [g.gid, g.item, g.on, g.bag == null ? null : g.bag]));


const psig = w => canon(w.pets.map(p => [p.id, p.capacity, p.openSlots, p.maxCap == null ? null : p.maxCap]));
const isM = p => !p.dead && !p.released && !p.community && (p.mythicCare || p.stage === 5);
// 1. replay SAME below the gate
const A = run(), B = run(null);
ok(A.V.ACTIVATE_MYTHIC_SLOTS_BLOCK > snap.tip, 'deployed gate ' + A.V.ACTIVATE_MYTHIC_SLOTS_BLOCK + ' is after snapshot tip ' + snap.tip);
ok(sig(A.w) === sig(B.w) && psig(A.w) === psig(B.w), 'replay SAME below the gate (gear and slots identical to gate off)');
ok(A.w.pets.every(p => p.maxCap == null), 'below the gate no max-capacity tracking');
const mA = A.w.pets.filter(isM); ok(mA.some(p => p.capacity < 6), 'below the gate Mythics still use the age/feeding rule (' + mA.filter(p => p.capacity < 6).length + ' of ' + mA.length + ' under 6)');
const mp = mA.find(p => !A.V.slotOpen(p, 'feet')), u0 = A.V.slotUnlock(mp, 'feet');
ok(!u0.open && !/if fed daily/.test(u0.text) && /all 6 slots/.test(u0.text), 'slotUnlock before the gate: Mythic gets no "if fed daily" hint (' + u0.text + ')');
// 2. Mythic = 6 slots (gate moved into the past)
const G = 972600, C = run(G), w = C.w, V = C.V;
const mC = w.pets.filter(isM);
ok(mC.length > 0 && mC.every(p => p.capacity === 6 && p.openSlots.length === 6), 'after the gate every Mythic has all 6 slots (' + mC.length + ' pets)');
const u1 = V.slotUnlock(mC[0], 'feet'); ok(u1.open && /all 6 slots/.test(u1.text) && !/if fed daily/.test(u1.text), 'slotUnlock after the gate: ' + u1.text);
ok(canon(w.log.filter(e => e.gid && e.block < G).map(e => [e.gid, w.items[e.gid].item])) === canon(B.w.log.filter(e => e.gid && e.block < G).map(e => [e.gid, B.w.items[e.gid].item])), 'rolls before the gate unchanged');
// 3. bags release through unbag: any-slot early so Mythics get bagged pieces, then the Mythic gate
const D1 = run(null, 971900), D2 = run(G, 971900);
const bagM = Object.values(D1.w.items).filter(g => g.bag != null && D1.w.byId[g.bag] && isM(D1.w.byId[g.bag]));
console.log('  gate off: ' + bagM.length + ' pieces bagged on Mythic pets');
ok(bagM.length > 0, 'without the fix Mythic pets keep locked pieces in bags');
ok(Object.values(D2.w.items).filter(g => g.bag != null && D2.w.byId[g.bag] && isM(D2.w.byId[g.bag])).length === 0, 'with the fix no piece stays bagged on a Mythic pet');
ok(bagM.every(g => D2.w.items[g.gid] && D2.w.items[g.gid].bag == null), 'the same pieces unbagged (worn or back in the stash)');
// 4. slots never close once open
const live = w.pets.filter(p => !p.dead && !p.released && !p.community && !isM(p) && p.hatchBlock != null);
const later = snap.tip + 30 * 144; let closedOff = 0, closedOn = 0, n = 0;
const W0 = run(null).w;
live.forEach(p => { const q = W0.byId[p.id]; const b0 = q.capacity; V._liveAt(W0, q, later); if (q.capacity < b0) closedOff++;
  const c0 = p.capacity; V._liveAt(w, p, later); n++; if (p.capacity < c0 || p.openSlots.length < c0) closedOn++; });
console.log('  30 days unfed: ' + closedOff + ' pets would lose slots without the fix');
ok(closedOff > 0, 'without the fix slots can close (care ratio drops)');
ok(closedOn === 0, 'with the fix no pet loses a slot (' + n + ' pets checked)');
console.log(fail ? fail + ' FAILED' : 'ALL PASS'); process.exit(fail ? 1 : 0);
