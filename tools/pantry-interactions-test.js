#!/usr/bin/env node
/* Pantry vs everything else (Nov 24 2026, Jake: "could this break the game since we changed so much since we wrote it").
 * Replays api/boot.json with the Pantry on, a real wallet that owns risen zombies puts EVERY pet the picker offers on its list, then:
 *   - a listed pet is discarded on chain (pet:hd) before the next serving,
 *   - at the next game day's first block: zombies and the discarded pet do not eat and cost nothing, zombies keep their
 *     zombie clock, the balance drops by exactly the logged cost, and every pet that ate passes the picker's own 'can eat' check,
 *   - the Pantry picker (js/v2-pantry.js canEat) agrees with the rules on every listed pet: it offers only pets the Pantry will feed.
 *   node tools/pantry-interactions-test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const SCRIPTS = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', '@LIVE', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js', 'js/block-hashes.js'];
const store = {}, ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
const win = { console: { log() {}, warn() {}, error() {}, info() {} }, localStorage: ls, sessionStorage: ls, location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/' }, navigator: { userAgent: 'node' }, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, URLSearchParams, URL, TextEncoder, TextDecoder, fetch: () => Promise.reject(new Error('offline')) };
win.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {}, body: null, head: { appendChild() {} }, documentElement: { style: {} } };
win.addEventListener = () => {}; win.window = win; win.self = win; win.globalThis = win; const ctx = vm.createContext(win);
for (const f of SCRIPTS) { if (f === '@LIVE') { vm.runInContext('window.LiveEngine={RealCore:window.RealCore,Chain:window.Chain&&window.Chain.Chain,CFG:window.XCPETS_CONFIG};', ctx); continue; } vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/v2-pantry.js'), 'utf8'), ctx, { filename: 'js/v2-pantry.js' });
let fails = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fails++; console.log('FAIL ' + m); } else console.log('ok   ' + m); };
const V = ctx.V2Rules, E = ctx.LiveEngine, P = ctx.V2Pantry;
ok(P && typeof P.canEat === 'function', 'js/v2-pantry.js exports canEat (the picker\'s one "can the Pantry feed it" answer)');
const hex = s => Buffer.from(s, 'utf8').toString('hex');
const boot = JSON.parse(fs.readFileSync(path.join(ROOT, 'api/boot.json'), 'utf8'));
const rows = boot.rows.slice().sort((a, b) => a.block_index - b.block_index || a.tx_index - b.tx_index), tip = boot.tip, nb = tip + 1;
const hashes = Object.assign({}, ctx.XCPETS_BLOCK_HASHES || {}, boot.hashes || {}), opts = t => ({ tip: t, live: E && E.RealCore, dex: boot.dex });
let tx = rows[rows.length - 1].tx_index + 1;
const row = (src, tag, amount, b) => ({ tx_index: tx++, tx_hash: ('q' + tx).padStart(64, '0'), block_index: b, source: src, asset: 'XCPETS', quantity: Math.round(amount * 1e8), tag: hex(tag), status: 'valid' });
const H = t => { const h = Object.assign({}, hashes); for (let b = tip; b <= t; b++) if (!h[b]) h[b] = '0'.repeat(56) + b.toString(16).padStart(8, '0'); return h; };
if (V.pantryGate() == null || V.pantryGate() > nb) V._setPantryActivation(nb);

const w0 = V.replay(rows, hashes, [], opts(tip));
/* the wallet with the most risen zombies (test wallet bc1qtke38… on the Nov 24 2026 feed) */
const zc = {}; w0.pets.forEach(p => { if (V.isZ(p) && p.owner) zc[p.owner] = (zc[p.owner] || 0) + 1; });
const o = Object.keys(zc).sort((a, b) => zc[b] - zc[a] || (a < b ? -1 : 1))[0];
ok(!!o, 'found a wallet that owns risen zombies (' + (o || '').slice(0, 10) + '…, ' + (zc[o] || 0) + ')');
const ref = V.refList(w0, o, tip, nb), zIds = ref.filter(p => V.isZ(p)).map(p => p.id);
const zAll = w0.pets.filter(p => p.owner === o && V.isZ(p)).map(p => p.id);
ok(true, 'zombies on the wallet\'s tag list: ' + zIds.length + ' of ' + zAll.length + ' (a tag can only name pets on that list)');
const nb1 = nb, uiOffered = ref.filter(p => P.canEat(V, w0, p, o, nb1)).map(p => p.id);
ok(zIds.every(id => uiOffered.indexOf(id) < 0), 'the picker does not offer zombies');

/* put EVERY pet of the list on (so the rules, not the picker, decide who eats), fill the balance */
const all = ref.map(p => p.id), plan = V.pantryPlan(w0, o, { amount: 50000, add: all });
ok(plan && plan.plans.length >= 1 && plan.plans.every(q => Buffer.byteLength(q.tag) <= 34), 'plan puts all ' + all.length + ' pets on in ' + (plan && plan.plans.length) + ' burn(s)');
const fill = plan.plans.map(q => row(o, q.tag, q.amount, nb));
const w1 = V.replay(rows.concat(fill), H(nb), [], opts(nb));
ok(w1.pantry && w1.pantry[o] && w1.pantry[o].ids.length === all.length, 'all ' + all.length + ' are on the list');

/* before the serving: discard one listed living pet on chain (gifts are token sends now, so an owner change is not simulated here; pantryEats checks the owner) */
const normal = ref.filter(p => !V.isZ(p) && !p.mythicCare && p.stage !== 5 && !p.dead).map(p => p.id);
const dId = normal[0];
const later = [];
if (dId != null && V.hdPlan) { const hp = V.hdPlan(w1, o, [dId], nb + 1); if (hp && hp.plans && hp.plans.length) hp.plans.forEach(q => later.push(row(o, q.tag, q.amount, nb + 1))); }
const wMid = V.replay(rows.concat(fill, later), H(nb + 1), [], opts(nb + 1));
const dDone = dId != null && wMid.byId[dId].hd === o;
ok(dDone, 'pet #' + dId + ' is discarded on chain after it went on the list');

/* the next serving */
const fb = V.dayStart((wMid.pantryDay != null ? wMid.pantryDay : 0) + 1);
const zBefore = {}; zAll.forEach(id => { const z = wMid.byId[id]; zBefore[id] = JSON.stringify([z.zombie && z.zombie.fedAt, z.zombie && z.zombie.meals, z.care]); }); /* not feral: that flag flips with the clock (fedAt + 432 game blocks), meal or no meal */
const w2 = V.replay(rows.concat(fill, later), H(fb), [], opts(fb));
const lg = (w2.pantryLog || []).filter(x => x.owner === o && x.block === fb)[0], fed = new Set(lg ? lg.petIds : []);
ok(!!lg && fed.size > 0, 'the serving at block ' + fb + ' fed ' + fed.size + ' pets');
ok(zAll.every(id => !fed.has(id)), 'no zombie ate from the pantry');
{ const moved = zAll.filter(id => { const z = w2.byId[id]; return V.isZ(z) && JSON.stringify([z.zombie.fedAt, z.zombie.meals, z.care]) !== zBefore[id]; });
  if (moved.length) console.log('  zombies that changed: ' + moved.length + ' of ' + zAll.length + ' ' + JSON.stringify(moved.slice(0, 4).map(id => { const z = w2.byId[id]; return [id, zBefore[id], [z.zombie.fedAt, z.zombie.meals, z.care], (w2.log || []).filter(e => e.petId === id && e.block > nb).map(e => e.block + ' ' + e.kind + ': ' + (e.msg || '').slice(0, 80)).slice(-3)]; })) + ' (serving block ' + fb + ', mid ' + (nb + 1) + ')');
  ok(!moved.length, 'zombie clocks and care are untouched by the serving'); }
ok(!fed.has(dId), 'the discarded pet did not eat');
const Pb = wMid.pantry[o].bal, Pa = w2.pantry[o].bal;
ok(lg && Math.abs((Pb - Pa) - lg.cost) < 1e-6, 'balance dropped by exactly the logged cost (' + (lg && lg.cost) + ')');
/* the picker's answer = the rules' answer, at the serving block */
const wPre = V.replay(rows.concat(fill, later), H(fb - 1), [], opts(fb - 1));
const disagree = all.filter(id => { const p = wPre.byId[id]; if (!p) return false; const ui = P.canEat(V, wPre, p, o, fb), ate = fed.has(id); return ate && !ui; });
ok(disagree.length === 0, 'every pet that ate passes the picker\'s canEat' + (disagree.length ? ' (not: ' + disagree.slice(0, 5).join(', ') + ')' : ''));
const missed = all.filter(id => { const p = wPre.byId[id]; return p && P.canEat(V, wPre, p, o, fb) && !fed.has(id) && !(p.feedDays || {})[V.day ? V.day(fb) : -1] && (lg && !lg.short); })
  .filter(id => { const p = w2.byId[id]; return p && p.lastFed !== fb && p.hungry; });
ok(missed.length === 0, 'no pet the picker offers was left hungry with money in the pantry' + (missed.length ? ' (' + missed.slice(0, 5).join(', ') + ')' : ''));

console.log(`pantry-interactions: ${n - fails} passed, ${fails} failed`); process.exit(fails ? 1 : 0);
