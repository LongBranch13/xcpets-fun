#!/usr/bin/env node
/* Any-slot rolls test (branch any-slot-rolls, owner approved Oct 22 2026). Dev tooling only.
 *   node tools/any-slot-test.js [snap]
 * Checks: placeholder gate (future) = no bags, itemList = all items; gate moved to a past block: rolls before it unchanged, rolls from it pick all 6 slots
 * evenly, locked-slot pieces go to the pet's bag (bound to it, off the stash, on = null), open-slot pieces wear as before, bags unlock when the slot opens
 * (wear only into an EMPTY slot, never replace), dead pets keep a lost bag, deterministic. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..'), SNAP = process.argv[2] || path.join(__dirname, 'snapshots', 'snap-972634.json');
const SCRIPTS = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', '@LIVE', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js', 'js/block-hashes.js'];
function load() { const store = {}, ls = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const win = { console: { log() {}, warn() {}, error() {}, info() {} }, localStorage: ls, sessionStorage: ls, location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/' }, navigator: { userAgent: 'node' }, setTimeout: () => 0, clearTimeout() {}, URLSearchParams, URL, TextEncoder, TextDecoder, fetch: () => Promise.reject(new Error('offline')) };
  win.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {}, body: null, documentElement: { style: {} } };
  win.addEventListener = () => {}; win.window = win; win.self = win; win.globalThis = win; const ctx = vm.createContext(win);
  for (const f of SCRIPTS) { if (f === '@LIVE') { vm.runInContext("window.LiveEngine={RealCore:window.RealCore,Chain:window.Chain&&window.Chain.Chain,CFG:window.XCPETS_CONFIG};", ctx); continue; } const p = path.join(ROOT, f); if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f }); }
  return ctx; }
const snap = JSON.parse(fs.readFileSync(SNAP, 'utf8')); let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
function run(gate) { const ctx = load(), V = ctx.V2Rules; if (gate !== undefined) V._setAnySlotActivation(gate); const hashes = Object.assign({}, ctx.XCPETS_BLOCK_HASHES || {}, snap.hashes);
  return { V, w: V.replay(snap.rows, hashes, [], { tip: snap.tip, live: ctx.LiveEngine && ctx.LiveEngine.RealCore }) }; }
const canon = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x)) ? Object.keys(x).sort().reduce((o, k2) => (o[k2] = x[k2], o), {}) : x);
const sig = w => canon(Object.values(w.items).map(g => [g.gid, g.item, g.on, g.bag == null ? null : g.bag]));

const A = run(), B = run(null);
ok(A.V.ACTIVATE_ANY_SLOT_BLOCK > snap.tip, 'placeholder gate ' + A.V.ACTIVATE_ANY_SLOT_BLOCK + ' is after snapshot tip ' + snap.tip);
ok(sig(A.w) === sig(B.w), 'placeholder gate = gate off (identical gear)');
ok(!A.w.bags && A.w.itemList.length === Object.keys(A.w.items).length, 'before the gate: no bags, itemList = every item (' + A.w.itemList.length + ')');

const GATE = 971900, C = run(GATE), C2 = run(GATE), V = C.V, w = C.w;
ok(sig(C.w) === sig(C2.w), 'deterministic (two replays with gate ' + GATE + ' identical)');
const rolls = w.log.filter(e => e.gid && w.items[e.gid] && (e.kind === 'roll' || e.kind === 'token'));
const pre = rolls.filter(e => e.block < GATE), post = rolls.filter(e => e.block >= GATE);
const preA = new Map(A.w.log.filter(e => e.gid && e.block < GATE).map(e => [e.gid, A.w.items[e.gid].item]));
ok(pre.every(e => preA.get(e.gid) === w.items[e.gid].item), 'rolls before the gate unchanged (' + pre.length + ')');
const bySlot = {}; post.forEach(e => { const s = w.items[e.gid].slot === 'weapon' ? 'hand' : w.items[e.gid].slot; bySlot[s] = (bySlot[s] || 0) + 1; });
console.log('  post-gate rolls', post.length, 'by slot', JSON.stringify(bySlot));
ok(V.V2_SLOTS.every(s => bySlot[s] > 0), 'every one of the 6 slots gets rolls after the gate');
const exp = post.length / 6, chi = V.V2_SLOTS.reduce((a, s) => a + Math.pow((bySlot[s] || 0) - exp, 2) / exp, 0);
ok(chi < 20.5, 'slots evenly spread (chi-square ' + chi.toFixed(2) + ' < 20.5, df 5, p 0.001)');
const bagged = Object.values(w.items).filter(g => g.bag != null);
ok(bagged.length > 0, 'locked-slot pieces went to bags (' + bagged.length + ' still bagged at tip)');
ok(bagged.every(g => g.on == null && w.itemList.indexOf(g) < 0), 'bagged pieces are not worn and not in the stash / pickers (itemList)');
ok(bagged.every(g => { const p = w.byId[g.bag]; return p && (p.dead || p.released || !V.slotOpen(p, g.slot)); }), 'every bagged piece sits on a pet whose slot is still locked (or the pet is dead / released = lost)');
ok(bagged.every(g => V.bagOf(w, g.bag).indexOf(g) >= 0), 'bagOf lists every bagged piece');
const bp = bagged.map(g => w.byId[g.bag]).find(p => !p.dead && !p.released && p.owner);
const eq = V.equipCheck(w, bp.owner, bp.id, bagged.find(g => g.bag === bp.id).item);
ok(!eq.ok || !bagged.some(g => g.gid === eq.gid), 'equipCheck never hands out a bagged piece');
const u = V.slotUnlock(bp, bagged.find(g => g.bag === bp.id).slot); console.log('  slotUnlock #' + bp.id + ':', u.text);
ok(!u.open && u.need > u.have && /Needs \d gear slots/.test(u.text), 'slotUnlock explains the requirement');
const postOpen = post.filter(e => { const g = w.items[e.gid]; return g.bag == null && g.on == null && !g.unbagged; });
ok(post.some(e => w.items[e.gid].on != null), 'open-slot pieces are still worn as before');
// unlock: feed the pet every day for 12 more days, refresh at a later block
const D = 144, tip = snap.tip, pets = [...new Set(bagged.map(g => g.bag))].map(id => w.byId[id]).filter(p => !p.dead && !p.released);
const before = {}; pets.forEach(p => { V.V2_SLOTS.forEach(s => { const c = V.wornOf(w, p.id).find(x => x.slot === s); before[p.id + s] = c ? c.gid : null; }); });
const later = tip + 12 * D; pets.forEach(p => { for (let d = 0; d <= 12; d++) p.feedDays[Math.floor(tip / D) + d] = 1; p.lastFed = later; V._liveAt(w, p, later); });
const still = Object.values(w.items).filter(g => g.bag != null && pets.some(p => p.id === g.bag) && V.slotOpen(w.byId[g.bag], g.slot));
ok(still.length === 0, 'after the slots open, no piece stays bagged on an open slot (' + pets.length + ' pets refreshed)');
let replaced = 0, filled = 0; pets.forEach(p => V.V2_SLOTS.forEach(s => { const c = V.wornOf(w, p.id).find(x => x.slot === s); if (before[p.id + s] && (!c || c.gid !== before[p.id + s])) replaced++; if (!before[p.id + s] && c) filled++; }));
ok(replaced === 0, 'unlocking never replaces gear already worn');
ok(filled > 0, 'unlocked bag pieces wear into empty slots (' + filled + ' slots filled)');
ok(Object.values(w.items).filter(g => g.bag == null && pets.some(p => p.id === g.rolledOn)).every(g => g.on != null || w.itemList.indexOf(g) >= 0), 'unbagged pieces not worn are back in the stash (wearable)');
const dead = Object.values(w.items).filter(g => g.bag != null && w.byId[g.bag] && w.byId[g.bag].dead);
console.log('  bagged pieces on dead pets (lost):', dead.length);
console.log(fail ? fail + ' FAILED' : 'ALL PASS'); process.exit(fail ? 1 : 0);
