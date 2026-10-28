#!/usr/bin/env node
/* All gear slots unlocked test (branch gear-slots-unlocked, owner Oct 28 2026 1:01 AM CT: 'unlock all gear slots across all pets for all time,
 * it is no longer gated'). Dev tooling only.   node tools/gear-slots-unlocked-test.js [snap]
 * Checks: gate after the snapshot tip; replay SAME below the gate; with the gate moved into the past every living pet has all 6 slots and
 * no living pet keeps a bagged piece; pieces rolled before the gate unchanged; slots stay 6 later even unfed; slotUnlock text; new pets get 6. */
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
function run(gate, anyGate) { const ctx = load(), V = ctx.V2Rules; if (gate !== undefined) V._setAllSlotsActivation(gate); if (anyGate !== undefined) V._setAnySlotActivation(anyGate); const hashes = Object.assign({}, ctx.XCPETS_BLOCK_HASHES || {}, snap.hashes);
  return { V, w: V.replay(snap.rows, hashes, [], { tip: snap.tip, live: ctx.LiveEngine && ctx.LiveEngine.RealCore }) }; }
const canon = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x)) ? Object.keys(x).sort().reduce((o, k2) => (o[k2] = x[k2], o), {}) : x);
const sig = w => canon(Object.values(w.items).map(g => [g.gid, g.item, g.on, g.bag == null ? null : g.bag]));
const psig = w => canon(w.pets.map(p => [p.id, p.capacity, p.openSlots, p.maxCap == null ? null : p.maxCap]));
const alive = p => !p.dead && !p.released && p.hatchBlock != null;
// 1. replay SAME below the gate
const A = run(), B = run(null);
ok(A.V.ACTIVATE_ALL_SLOTS_BLOCK > snap.tip, 'deployed gate ' + A.V.ACTIVATE_ALL_SLOTS_BLOCK + ' is after snapshot tip ' + snap.tip);
ok(sig(A.w) === sig(B.w) && psig(A.w) === psig(B.w), 'replay SAME below the gate (gear, bags and slots identical to gate off)');
ok(!A.w.allSlotsSwept && A.w.pets.every(p => !p.allSlots), 'below the gate nothing is flagged all-slots');
const lockedA = A.w.pets.filter(p => alive(p) && p.capacity < 6);
ok(lockedA.length > 0, 'below the gate the old age/feeding rule still applies (' + lockedA.length + ' living pets under 6 slots)');
ok(!A.V.allSlotsNow(A.w), 'allSlotsNow false below the gate');
// 2. gate moved into the past (any-slot early too so pets carry bags into the gate)
const G = snap.tip - 34, D1 = run(null, 971900), D2 = run(G, 971900), w = D2.w, V = D2.V;
const liveC = w.pets.filter(alive);
ok(liveC.length > 0 && liveC.every(p => p.capacity === 6 && p.openSlots.length === 6 && p.allSlots), 'after the gate every living pet has all 6 slots (' + liveC.length + ' pets, any tier, stage, age)');
ok(liveC.every(p => V.V2_SLOTS.every(s => V.slotOpen(p, s))), 'slotOpen true for every slot of every living pet');
const wiz = liveC.filter(p => p.species === 'wizard'); ok(wiz.every(p => V.slotOpen(p, 'weapon')), 'Wizard Staff slot open too (' + wiz.length + ' wizards)');
const bagLive = (W) => Object.values(W.items).filter(g => g.bag != null && W.byId[g.bag] && alive(W.byId[g.bag]));
const b1 = bagLive(D1.w); console.log('  gate off: ' + b1.length + ' pieces bagged on living pets');
ok(b1.length > 0, 'without the rule living pets keep pieces in bags');
ok(bagLive(w).length === 0, 'with the rule no piece stays bagged on a living pet');
ok(b1.every(g => w.items[g.gid] && w.items[g.gid].bag == null), 'the same pieces unbagged (worn or back in the stash)');
ok(canon(w.log.filter(e => e.gid && e.block < G).map(e => [e.gid, w.items[e.gid].item])) === canon(D1.w.log.filter(e => e.gid && e.block < G).map(e => [e.gid, D1.w.items[e.gid].item])), 'rolls before the gate unchanged');
ok(V.allSlotsNow(w) && /all 6 gear slots/.test(V.allSlotsText()), 'allSlotsNow true after the gate: ' + V.allSlotsText());
const u = V.slotUnlock(liveC[0], 'feet'); ok(u.open && /all 6 slots/.test(u.text) && !/Needs/.test(u.text), 'slotUnlock after the gate: ' + u.text);
// 3. slots stay 6 later, even unfed; a just-hatched pet gets 6
const later = snap.tip + 30 * 144; let lost = 0; liveC.forEach(p => { V._liveAt(w, p, later); if (p.capacity < 6 || p.openSlots.length < 6) lost++; });
ok(lost === 0, '30 days later, unfed, no pet has fewer than 6 slots (' + liveC.length + ' checked)');
const young = liveC.slice().sort((a, b) => b.hatchBlock - a.hatchBlock)[0]; const q = Object.assign({}, young, { hatchBlock: later - 1, fed: {}, feeds: [] }); V._liveAt(w, q, later);
ok(q.capacity === 6 && q.openSlots.length === 6, 'a pet hatched 1 block ago has all 6 slots');
console.log(fail ? fail + ' FAILED' : 'ALL PASS'); process.exit(fail ? 1 : 0);

