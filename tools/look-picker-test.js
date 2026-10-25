#!/usr/bin/env node
/* Look picker (ACTIVATE_LOOK_PICK_BLOCK): memo pet:look:ID:CODE:on|off. 1) real gate past the fixture tip: nothing changes; 2) gate forced early with no
 * memos: only w.lookCopies is new and every pet shows exactly the same looks; 3) simulated memos (never on chain) move / hide / refuse as documented. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const SCRIPTS = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', '@LIVE', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js', 'js/block-hashes.js'];
function load() { const ls = { getItem: () => null, setItem() {}, removeItem() {} };
  const win = { console: { log() {}, warn() {}, error() {}, info() {} }, localStorage: ls, sessionStorage: ls, location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/' }, navigator: { userAgent: 'node' }, setTimeout: () => 0, clearTimeout() {}, URLSearchParams, URL, TextEncoder, TextDecoder, fetch: () => Promise.reject(new Error('offline')) };
  win.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {}, body: null, documentElement: { style: {} } };
  win.addEventListener = () => {}; win.window = win; win.self = win; win.globalThis = win; const ctx = vm.createContext(win);
  for (const f of SCRIPTS) { if (f === '@LIVE') { vm.runInContext("window.LiveEngine={RealCore:window.RealCore,Chain:window.Chain&&window.Chain.Chain,CFG:window.XCPETS_CONFIG};", ctx); continue; } const p = path.join(ROOT, f); if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f }); }
  return ctx; }
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const snapF = path.join(__dirname, 'snapshots', 'snap-972901.json');
if (!fs.existsSync(snapF)) { console.log('ok   no snapshot here: skipped'); process.exit(0); }
const snap = JSON.parse(fs.readFileSync(snapF, 'utf8')), TIP = snap.tip, QG = 972700, LG = 972800;
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex'), hex = s => Buffer.from(s, 'utf8').toString('hex');
let txi = 9e8, nonce = 0; const row = (b, src, tag) => ({ tx_index: txi++, tx_hash: sha('SIMULATED-look-picker:' + (nonce++)), block_index: b, source: src, asset: 'XCPETS', quantity: 1, tag: hex(tag), status: 'valid', simulated: true });
function run(opt, sim) { const ctx = load(), V = ctx.V2Rules, E = ctx.LiveEngine; if (opt.q !== undefined) V._setQuestActivation(opt.q); if (opt.e !== undefined) V._setEarnActivation(opt.e); if (opt.l !== undefined) V._setLookPickActivation(opt.l);
  const hs = Object.assign({}, ctx.XCPETS_BLOCK_HASHES || {}, snap.hashes); for (let b = 972690; b <= TIP; b++) if (!hs[b]) hs[b] = sha('SIMULATED-block:' + b);
  const rows = snap.rows.concat(sim || []).sort((a, b) => a.block_index - b.block_index || a.tx_index - b.tx_index);
  return { V, w: V.replay(rows, hs, [], { tip: TIP, live: E && E.RealCore }) }; }
const canon = v => JSON.stringify(v, (k, x) => (k === 'children' || k === 'lookCopies') ? undefined : x);
const shown = (V, w) => JSON.stringify(w.pets.map(p => V.shownLooks(w, p).map(x => x.id + '/' + x.type)));
/* 1 */
const A = run({});
ok(A.V.lookPickGate() === 973003, 'gate is 973003 (tip 972997 + 6)');
ok(!A.w.lookCopies, 'real gate past fixture tip ' + TIP + ': no look copies');
const pt = A.V.parseTag; if (pt) { ok(pt('pet:look:12:KL:on').action === 'look' && pt('pet:look:12:KL:on:QN:off').ops.length === 2, 'parse pet:look:ID:CODE:on[:CODE:off]');
  ok(pt('pet:look:12:ZZ:on').action === 'invalid' && pt('pet:look:12:KL').action !== 'look' && pt('pet:look:1' + ':KL:on'.repeat(7)).action !== 'look', 'bad code / no on|off / more than 6 pairs: not a look memo'); }
const lp = A.V.lookPlans(5, Array.from({ length: 8 }, (_, i) => ({ code: 'KL', on: i % 2 === 0 })));
ok(lp.length === 2 && lp[0].tag.split(':').length === 15 && lp[0].amount === 0.00000001, 'batch of 8 changes = 2 memos (6 + 2), any-burn amount');
/* 2 */
const B0 = run({ q: QG, e: QG }), B1 = run({ q: QG, e: QG, l: LG });
ok(!!B1.w.lookCopies && Object.keys(B1.w.lookCopies).length > 0, 'forced gate ' + LG + ': ' + Object.keys(B1.w.lookCopies).length + ' quest / earned looks became wallet copies');
ok(canon(B0.w.pets) === canon(B1.w.pets), 'forced gate, no memos: all pet state identical');
ok(shown(B0.V, B0.w) === shown(B1.V, B1.w), 'forced gate, no memos: every pet shows exactly the same looks');
/* 3: pick a wallet holding an earned/quest copy and owning another living pet; and a Kindling wallet with 2+ pets */
const live = p => !p.dead && !p.released && !p.community, C = Object.values(B1.w.lookCopies);
const cp = C.find(c => B1.w.pets.some(q => q.owner === c.holder && q.id !== c.src && live(q) && !q.cold && live(B1.w.byId[c.src])));
const fw = Object.keys(B1.w.burnedBy).find(a => B1.V.walletBurned(B1.w, a) >= 10000 && B1.V.walletBurned(B1.w, a) < 1e6 && B1.w.pets.filter(q => q.owner === a && live(q) && !q.cold).length >= 2);
const fwE = Object.keys(B1.w.burnedBy).find(a => B1.V.walletBurned(B1.w, a) >= 10000 && (B1.w.earlyBurner || {})[a] && B1.w.pets.filter(q => q.owner === a && live(q) && !q.cold).length >= 4);
ok(!!cp && !!fw, 'fixture has a copy holder with 2 pets and a Kindling wallet with 2 pets');
const sim = [], b0 = LG + 10;
const tgt = B1.w.pets.find(q => q.owner === cp.holder && q.id !== cp.src && live(q) && !q.cold), code = B1.V.lookCode(cp.kind, cp.id);
sim.push(row(LG - 5, cp.holder, 'pet:look:' + tgt.id + ':' + code + ':on')); /* below the gate: inert */
sim.push(row(b0, cp.holder, 'pet:look:' + tgt.id + ':' + code + ':on'));
const fp = B1.w.pets.filter(q => q.owner === fw && live(q) && !q.cold).slice(0, 2);
sim.push(row(b0 + 1, fw, 'pet:look:' + fp[0].id + ':KL:on')); sim.push(row(b0 + 2, fw, 'pet:look:' + fp[1].id + ':KL:on'));
sim.push(row(b0 + 3, fw, 'pet:look:' + fp[1].id + ':SG:on'));                   /* not burned enough (unless 1M): refused */
const stranger = B1.w.pets.find(q => q.owner !== cp.holder && live(q) && !q.cold);
sim.push(row(b0 + 4, stranger.owner, 'pet:look:' + stranger.id + ':' + code + ':on')); /* does not hold it */
sim.push(row(b0 + 5, cp.holder, 'pet:look:' + tgt.id + ':' + code + ':off'));
let fe = []; if (fwE) { fe = B1.w.pets.filter(q => q.owner === fwE && live(q) && !q.cold).slice(0, 4); fe.forEach((q, i) => sim.push(row(b0 + 6 + i, fwE, 'pet:look:' + q.id + ':KA:on'))); }
sim.push(row(b0 + 12, fw, 'pet:aura:' + fp[1].id + ':off'));
const S = run({ q: QG, e: QG, l: LG }, sim), V = S.V, w = S.w, logOf = tx => w.log.filter(x => x.tx === tx);
const msg = i => (logOf(sim[i].tx_hash)[0] || {}).msg || '';
ok(/unknown pet: tag/.test(msg(0)) || !logOf(sim[0].tx_hash).some(x => x.kind === 'look'), 'memo below the gate is an unknown tag');
const c2 = w.lookCopies[cp.key];
ok(c2.at === 0, 'copy ' + cp.key + ' moved to #' + tgt.id + ' then taken off (at = 0): ' + msg(1) + ' | ' + msg(6));
ok(/moved from #/.test(msg(1)) || !live(w.byId[cp.src]), 'moving a copy says where it came from');
ok(!V.shownLooks(w, w.byId[cp.src]).some(x => x.from === cp.kind && x.id === cp.id), 'after moving off, the earning pet no longer shows it');
ok(V.ownedLooks(w, cp.holder).some(o => o.kind === cp.kind && o.id === cp.id && !o.on.length), 'hidden copy still owned (My Looks lists it, on no pet)');
const k1 = (w.byId[fp[1].id].flameLooks || []).includes('laurels');
ok(/Laurels on/.test(msg(2)) && /Laurels on/.test(msg(3)), 'Kindling Laurels placed on #' + fp[0].id + ' and #' + fp[1].id + ' (early burner, limit 3)');
{ const M = run({ q: QG, e: QG, l: LG }), mw = M.w, P0 = mw.byId[fp[0].id], P1 = mw.byId[fp[1].id]; delete mw.earlyBurner[fw];
  [P0, P1].forEach(p => { p.flameLooks = []; }); M.V._lookPick(mw, P0, [{ code: 'KL', on: true }], TIP); const r2 = M.V._lookPick(mw, P1, [{ code: 'KL', on: true }], TIP);
  ok(!P0.flameLooks.includes('laurels') && P1.flameLooks.includes('laurels') && /moved from #/.test(r2.done.join()), 'limit 1: Laurels moves from #' + P0.id + ' to #' + P1.id + ' (' + r2.done.join() + ')');
  const r3 = M.V._lookPick(mw, P1, [{ code: 'KA', on: true }], TIP); ok(P1.flameLooks.includes('flame-aura') && P1.flameLooks.includes('laurels'), 'different kinds stack: ' + r3.done.join());
  const r4 = M.V._lookPick(mw, P1, [{ code: 'WH', on: true }], TIP); ok(V.walletBurned(mw, fw) >= 250000 ? /Laurels off/.test(r4.done.join()) : /not burned enough/.test(r4.refused.join()), 'same kind: Halo turns Laurels off, or refused below Wildfire: ' + (r4.done.concat(r4.refused)).join()); }
ok(V.walletBurned(w, fw) >= 1e6 || /refused|rejected|not burned enough/.test(msg(4) + (logOf(sim[4].tx_hash)[0] || {}).kind), 'look above the wallet tier refused: ' + msg(4));
ok(/does not hold/.test(msg(5)), 'look the wallet does not hold refused: ' + msg(5));
if (fwE) ok(/already on 3 pets/.test(msg(10)) && fe.slice(0, 3).every(q => (w.byId[q.id].flameLooks || []).includes('flame-aura')), 'early burner limit 3: 4th pet refused with reason: ' + msg(10)); else console.log('     (no early burner with 4 pets in fixture)');
ok(!k1 && !(w.byId[fp[1].id].flameLooks || []).length, 'pet:aura:ID:off still takes flame looks off');
/* seller keeps copies: hand the earning pet to someone else (in memory) */
const own = V.ownedLooks(w, cp.holder).find(o => o.kind === cp.kind && o.id === cp.id); c2.at = cp.src; const sp = w.byId[cp.src], was = sp.owner;
ok(V.shownLooks(w, sp).some(x => x.id === cp.id && x.from === cp.kind), 'copy placed back on its pet shows');
sp.owner = 'bc1qbuyerxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
ok(!V.shownLooks(w, sp).some(x => x.id === cp.id && x.from === cp.kind) && V.ownedLooks(w, was).some(o => o.id === cp.id && o.kind === cp.kind && !o.on.length) && !V.ownedLooks(w, sp.owner).some(o => o.kind !== 'flame'), 'pet changes hands: the copy comes off it and stays with the seller, buyer gets none');
sp.owner = was; void own;
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
