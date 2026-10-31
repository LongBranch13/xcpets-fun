#!/usr/bin/env node
/* cemetery runs (owner standing rule Oct 31 2026: as few burns as technically possible): checks for pet:ar / pet:sr / pet:zr / pet:rr,
 * priced PER PET (owner Oct 31 2026: each pet costs its one-by-one fee, a seance = raise + pets x pledge; underpaid run burns are rejected).
 *   node tools/cemetery-runs-test.js [--boot FILE]   Dev tooling only. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..'), A = process.argv.slice(2), opt = k => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : null; };
const SCRIPTS = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', '@LIVE', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js', 'js/block-hashes.js'];
function load() { const store = {}; const ls = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const win = { console: { log() {}, warn() {}, error() {}, info() {} }, localStorage: ls, sessionStorage: ls, location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/' }, navigator: { userAgent: 'node' }, setTimeout: () => 0, clearTimeout() {}, URLSearchParams, URL, TextEncoder, TextDecoder, fetch: () => Promise.reject(new Error('offline')) };
  win.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {}, body: null, documentElement: { style: {} } };
  win.addEventListener = () => {}; win.window = win; win.self = win; win.globalThis = win; const ctx = vm.createContext(win);
  for (const f of SCRIPTS) { if (f === '@LIVE') { vm.runInContext("window.LiveEngine={RealCore:window.RealCore,Chain:window.Chain&&window.Chain.Chain,CFG:window.XCPETS_CONFIG};", ctx); continue; } const p = path.join(ROOT, f); if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f }); }
  return ctx; }
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const hex = s => Buffer.from(s, 'utf8').toString('hex');
const ctx = load(), V = ctx.V2Rules, E = ctx.LiveEngine;
const b32 = n => Number(n).toString(32).toUpperCase();
/* 1. parse */
const t1 = V.parseTag('pet:zr:1A:0F:01');
ok(t1.action === 'cemr' && t1.kind === 'zfeed' && t1.target === 42 && t1.a === 15 && JSON.stringify(t1.runs) === '[0,1]', 'parseTag: pet:zr:Z:AA:RUNS -> cemr zfeed, base-32 target and anchor');
ok(V.parseTag('pet:ar:1A:0F:01').kind === 'alt' && V.parseTag('pet:sr:1A:0F:01').kind === 'seance' && V.parseTag('pet:rr:1A:0F:01').kind === 'rpl', 'parseTag: ar = altar pledge, sr = seance, rr = Resurrection pledge');
ok(V.parseTag('pet:zr:1A:0F:00').action === 'invalid' && V.parseTag('pet:zr:1A:0F:0').action === 'invalid' && V.parseTag('pet:zr:0:0F:01').action === 'invalid' && V.parseTag('pet:zr:1A:F:01').action === 'invalid', 'parseTag: bad runs / id / anchor are invalid');
ok(V.parseTag('pet:zr:1A:0F:' + '1'.repeat(22)).action === 'invalid', 'parseTag: tags over 34 bytes are rejected');
/* live world */
const boot = JSON.parse(fs.readFileSync(path.resolve(opt('--boot') || path.join(ROOT, 'api', 'boot.json')), 'utf8'));
const rows = boot.rows.slice().sort((a, b) => a.block_index - b.block_index || a.tx_index - b.tx_index), tip = boot.tip || rows[rows.length - 1].block_index;
const hashes = Object.assign({}, ctx.XCPETS_BLOCK_HASHES || {}, boot.hashes || {}), nb = tip + 1, opts = t => ({ tip: t, live: E && E.RealCore, dex: boot.dex });
const GATE0 = V.cemRunsGate(); ok(GATE0 == null, 'gate is null in the code (set to tip + 6 at deploy)');
const canon = v => Array.isArray(v) ? '[' + v.map(canon).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().filter(k => v[k] !== undefined && typeof v[k] !== 'function').map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}' : JSON.stringify(v);
const sig = w => canon({ pets: w.pets, items: w.items, log: w.log.map(x => [x.block, x.tx, x.kind, x.msg]) });
const w0 = V.replay(rows, hashes, [], opts(tip)), s0 = sig(w0);
V._setCemRunsActivation(nb); const w = V.replay(rows, hashes, [], opts(tip));
ok(sig(w) === s0, 'live world (' + rows.length + ' burns, tip ' + tip + '): same replay with the gate null and with the gate at tip + 1');
ok(V.cemOn(nb), 'cemetery loop is on at tip + 1');
/* 2. burns needed: list form (what the altar / zombie picker sends today) vs runs */
function listBurns(kind, id, ids) { let n = 0, cur = []; ids.slice().sort((a, c) => a - c).forEach(x => { const t = cur.concat([x]); if (!cur.length || V.cemPlan(w, kind, id, t, nb).ok) cur = t; else { n++; cur = [x]; } }); return n + (cur.length ? 1 : 0); }
function zfeedListBurns(z, ids) { /* list or mask per burn, same as js/v2.js zFeedPlansList */ const s = ids.slice().sort((a, c) => a - c); let i = 0, n = 0;
  while (i < s.length) { let lst = [], k = i; while (k < s.length) { const t = 'pet:zfeed:' + z + ':' + lst.concat([s[k]]).map(b32).join('.'); if (t.length > 34) break; lst.push(s[k]); k++; }
    const st = s[i], room = 34 - ('pet:zfm:' + z + ':' + st + ':').length, span = Math.max(0, room) * 5; let m = i; while (m < s.length && s[m] < st + span) m++; i = Math.max(k, m); n++; } return n; }
const owners = {}; w.pets.forEach(p => { if (p.owner && !p.community && !V.cemOfferWhy(w, p, p.owner, nb)) (owners[p.owner] = owners[p.owner] || []).push(p.id); });
const grave = w.pets.find(p => p.dead && !p.released && !p.community) || { id: 30000 };
const G = grave.id; let rng = 7; const rnd = () => (rng = (rng * 1103515245 + 12345) % 2147483648) / 2147483648;
console.log('\nper owner: offerable living pets, burns to offer them at an altar (grave #' + G + '), list form vs runs (all / random half / random 120)');
const res = []; Object.keys(owners).forEach(o => { const ids = owners[o]; if (ids.length < 6) return;
  const half = ids.filter(() => rnd() < 0.5), r120 = ids.slice().sort(() => rnd() - 0.5).slice(0, Math.min(120, ids.length));
  const row = { o, n: ids.length }; [['all', ids], ['half', half], ['r120', r120]].forEach(([k, s]) => { if (!s.length) return; const pl = V.cemRunsPlan(w, 'seance', G, s, o, nb); row[k] = [listBurns('seance', G, s), pl ? pl.length : null, s.length, pl]; }); res.push(row); });
res.sort((a, b) => b.n - a.n).slice(0, 10).forEach(r => console.log('  ' + r.o.slice(0, 10) + '…  ' + r.n + ' pets   all ' + r.all[0] + ' -> ' + r.all[1] + '   half(' + (r.half ? r.half[2] : 0) + ') ' + (r.half ? r.half[0] + ' -> ' + r.half[1] : '-') + '   120 random ' + r.r120[0] + ' -> ' + r.r120[1]));
ok(res.every(r => ['all', 'half', 'r120'].every(k => !r[k] || r[k][1] != null)), 'runs plan found for every pick (every offerable pet is in the list)');
ok(res.every(r => ['all', 'half', 'r120'].every(k => !r[k] || r[k][3].every(q => Buffer.byteLength(q.tag) <= 34))), 'every run tag fits 34 bytes');
ok(res.every(r => ['all', 'half', 'r120'].every(k => !r[k] || r[k][1] <= r[k][0])), 'altar: runs never need more burns than the list form');
ok(res.every(r => r.all[1] === 1), 'offering ALL offerable pets is 1 burn for every owner');
ok(res.every(r => ['all', 'half', 'r120'].every(k => !r[k] || r[k][3].reduce((a, q) => a + q.ids.length, 0) === r[k][2])), 'every plan covers exactly the picked pets');
ok(res.every(r => ['all', 'half', 'r120'].every(k => !r[k] || r[k][3].every((q, i, L) => q.tag.startsWith(i === L.length - 1 ? 'pet:sr:' : 'pet:ar:')))), 'seance plans: pledges first, the seance burn last');
/* GMONEY-sized pick: the biggest owner, 120 random pets: decode the tags back */
const big = res.slice().sort((a, b) => b.n - a.n)[0];
if (big) { const pl = big.r120[3], dec = [].concat(...pl.map(q => V.cemRunsIds(w, big.o, V.parseTag(q.tag), nb))).sort((a, c) => a - c), want = big.r120[3].reduce((a, q) => a.concat(q.ids), []).sort((a, c) => a - c);
  ok(JSON.stringify(dec) === JSON.stringify(want), 'decode: the rules read back exactly the planned pets (' + want.length + ' pets, ' + pl.length + ' burn' + (pl.length > 1 ? 's' : '') + ')');
  const zl = zfeedListBurns(99999, want); console.log('  zombie meal of the same ' + want.length + ' pets: list/mask ' + zl + ' burns -> runs ' + (V.cemRunsPlan(w, 'zfeed', 99999, want, big.o, nb) || []).length); }
/* 2b. PER PET price (owner Oct 31 2026 "Cost per pet. As few burns as possible"): each pet costs its one-by-one fee, a seance = raise + pets x pledge */
const own0 = (owners[(res[0] || {}).o] || []).slice().sort((a, c) => a - c), U = { pledge: V.cemCost(w, 'pledge', nb), raise: V.cemCost(w, 'raise', nb), zmeal: V.cemCost(w, 'zmeal', nb), rpl: V.cemCost(w, 'rpl', nb) }, sum = L => L.reduce((a, q) => a + q.amount, 0), r8 = x => Math.round(x * 1e8) / 1e8;
console.log('\nper-pet fees at block ' + nb + ': pledge ' + U.pledge + ', raise ' + U.raise + ', zombie meal ' + U.zmeal + ', Resurrection pledge ' + U.rpl);
ok(res.every(r => ['all', 'half', 'r120'].every(k => !r[k] || r8(sum(r[k][3])) === r8(U.raise + r[k][2] * U.pledge))), 'per pet: every seance plan costs raise + pets x pledge, however it is split into burns');
ok(res.every(r => ['all', 'half', 'r120'].every(k => !r[k] || r[k][3].every((q, i, L) => r8(q.amount) === r8(q.ids.length * U.pledge + (i === L.length - 1 ? U.raise : 0))))), 'per pet: each burn pays its own pets (ar = n x pledge, sr = raise + n x pledge)');
ok(r8(V.cemRunsCost(w, 'seance', 1, nb)) === r8(V.cemCost(w, 'seance', nb)) && r8(V.cemRunsCost(w, 'alt', 1, nb)) === r8(U.pledge) && r8(V.cemRunsCost(w, 'zfeed', 1, nb)) === r8(U.zmeal) && r8(V.cemRunsCost(w, 'rpl', 1, nb)) === r8(U.rpl), 'per pet: 1 pet in a run costs exactly what the one-pet burn costs today');
/* list / mask forms from the gate: the SITE prices them per pet too (V.cemPetAmount, send side), so it can always send the fewest burns */
{ const zl = 'pet:zfeed:2:' + [5, 9, 12].map(b32).join('.'), q = V.cemPetAmount(w, { tag: zl, amount: U.zmeal }, nb), zm = V.cemPetAmount(w, { tag: 'pet:zfm:2:10:VV', amount: U.zmeal }, nb), rp = V.cemPetAmount(w, { tag: 'pet:rpl:2:' + [5, 9].map(b32).join('.'), amount: U.rpl }, nb), rg = V.cemPetAmount(w, { tag: 'pet:rplg:2:1.2', amount: U.rpl }, nb);
  const sl = V.cemPlan(w, 'seance', G, [own0[0], own0[1], own0[2]], nb), sq = V.cemPetAmount(w, sl, nb), pq = V.cemPetAmount(w, V.cemPlan(w, 'pledge', G, [own0[0], own0[1]], nb), nb);
  ok(r8(q.amount) === r8(3 * U.zmeal) && r8(zm.amount) === r8(10 * U.zmeal) && r8(rp.amount) === r8(2 * U.rpl) && r8(rg.amount) === r8(U.rpl), 'site: list zombie meal 3 pets = 3 x meal, mask 10 pets = 10 x meal, rpl 2 pets = 2 x fee, gear pledge stays flat');
  ok(sl.ok && r8(sq.amount) === r8(U.raise + 3 * U.pledge) && r8(pq.amount) === r8(2 * U.pledge), 'site: list seance of 3 pets = raise + 3 x pledge, list pledge of 2 = 2 x pledge');
  V._setCemRunsActivation(null); ok(V.cemPetAmount(w, { tag: zl, amount: U.zmeal }, nb).amount === U.zmeal, 'site: gate null -> list prices unchanged (flat per burn)'); V._setCemRunsActivation(nb); }
const mid = res.filter(r => r.n >= 300).sort((a, b) => a.n - b.n)[0]; [big, mid].filter((r, i, L) => r && L.indexOf(r) === i).forEach(big => { const own = owners[big.o].slice().sort((a, c) => a - c); let rs = 11; const pick = n => own.slice().sort(() => ((rs = (rs * 1103515245 + 12345) % 2147483648) / 2147483648) - 0.5).slice(0, n);
  console.log('\ncost examples (owner ' + big.o.slice(0, 10) + '…, ' + own.length + ' offerable pets): burns and XCPETS, list form today -> runs per pet');
  [['24 random', pick(24)], ['96 scattered', pick(96)], ['100 in a row', own.slice(0, 100)]].forEach(([name, ids]) => {
    const sl = listBurns('seance', G, ids), sr = V.cemRunsPlan(w, 'seance', G, ids, big.o, nb), zl = zfeedListBurns(99999, ids), zr = V.cemRunsPlan(w, 'zfeed', 99999, ids, big.o, nb), rr = V.cemRunsPlan(w, 'rpl', 99999, ids, big.o, nb);
    console.log('  ' + name + ' (' + ids.length + ' pets): seance ' + sl + ' burns / ' + r8((sl - 1) * U.pledge + U.pledge + U.raise) + ' -> ' + sr.length + ' / ' + r8(sum(sr)) +
      '   zombie meal ' + zl + ' / ' + r8(zl * U.zmeal) + ' -> ' + Math.min(zl, zr.length) + ' / ' + r8(sum(zr)) + (zl < zr.length ? ' (list/mask is fewer here, priced per pet)' : '') + '   Resurrection pledge -> ' + rr.length + ' / ' + r8(sum(rr)));
    ok(r8(sum(sr)) === r8(U.raise + ids.length * U.pledge) && r8(sum(zr)) === r8(ids.length * U.zmeal) && r8(sum(rr)) === r8(ids.length * U.rpl), '  ' + name + ': totals are exactly per pet'); }); });
/* 3. engine: synthetic zombie meal through the real handle (zombie = a pet of the owner marked as zombie) */
const Zs = w.pets.filter(p => p.zombie && !p.zombie.end && p.owner);
console.log('\nzombies in the live world: ' + Zs.length);
const zo = Zs.find(Z => (owners[Z.owner] || []).length >= 3);
if (zo) { const eat = owners[zo.owner].filter(id => id !== zo.id).slice(0, 40), pl = V.cemRunsPlan(w, 'zfeed', zo.id, eat, zo.owner, nb); let tx = rows[rows.length - 1].tx_index + 1;
  const extra = pl.map(q => ({ tx_index: tx++, tx_hash: 'e'.repeat(64 - String(tx).length) + tx, block_index: nb, source: zo.owner, asset: 'XCPETS', quantity: Math.round(q.amount * 1e8), tag: hex(q.tag), status: 'valid' }));
  const h2 = Object.assign({}, hashes); if (!h2[nb]) h2[nb] = '0'.repeat(63) + '1';
  const w2 = V.replay(rows.concat(extra), h2, [], opts(nb)), gone = eat.filter(id => w2.byId[id].released);
  ok(pl.length === 1 && gone.length === eat.length, 'engine: 1 pet:zr burn fed zombie #' + zo.id + ' all ' + eat.length + ' picked pets (list form: ' + zfeedListBurns(zo.id, eat) + ' burns)');
  V._setCemRunsActivation(null); const w3 = V.replay(rows.concat(extra), h2, [], opts(nb));
  ok(eat.every(id => !w3.byId[id].released), 'gate null: the same burns eat nothing (unknown tag, community food, as before)'); V._setCemRunsActivation(nb);
  /* underpaid run burns are REJECTED (same as any cemetery burn below cost today): nothing eaten, fee stays burned */
  const short = (d, lbl) => { const bad = extra.map(x => Object.assign({}, x, { quantity: x.quantity - d })), wu = V.replay(rows.concat(bad), h2, [], opts(nb)), lg = wu.log.filter(x => x.block === nb && /below cost/.test(x.msg || ''));
    ok(eat.every(id => !wu.byId[id].released) && lg.length === bad.length, 'engine: a pet:zr burn ' + lbl + ' is rejected (nothing eaten, log: ' + (lg[0] ? lg[0].msg : '-') + ')'); };
  short(1, '1e-8 XCPETS short of ' + eat.length + ' x ' + U.zmeal); short(Math.round(U.zmeal * 1e8), 'paying for ' + (eat.length - 1) + ' of ' + eat.length + ' pets');
  const flat = extra.map(x => Object.assign({}, x, { quantity: Math.round(U.zmeal * 1e8) })), wf = V.replay(rows.concat(flat), h2, [], opts(nb));
  ok(eat.every(id => !wf.byId[id].released), 'engine: the old flat price (one meal fee for ' + eat.length + ' pets) is rejected');
  const over = extra.map(x => Object.assign({}, x, { quantity: x.quantity + 5e8 })), wo = V.replay(rows.concat(over), h2, [], opts(nb));
  ok(eat.every(id => wo.byId[id].released), 'engine: paying more than the per-pet total is accepted, as everywhere');
  ok(!V.sendBlock(w, pl[0], tip, { me: zo.owner }) && /below cost/.test(V.sendBlock(w, Object.assign({}, pl[0], { amount: U.zmeal }), tip, { me: zo.owner }) || ''), 'send guard: exact per-pet amount passes, the flat amount is stopped before the wallet (' + V.sendBlock(w, Object.assign({}, pl[0], { amount: U.zmeal }), tip, { me: zo.owner }) + ')'); }
else console.log('  (no zombie with 3+ offerable pets of the same owner in this snapshot: engine meal check skipped)');
V._setCemRunsActivation(GATE0);
console.log('\n' + (fails ? fails + ' FAILED' : 'all ok') + '  (gate in the code: ' + GATE0 + ')'); process.exitCode = fails ? 1 : 0;
