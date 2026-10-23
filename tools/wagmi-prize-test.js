#!/usr/bin/env node
/* WAGMI top-five prize tests (dev only): first five distinct wallets per chain day (block, then tx order) earn +1 saved spin,
 * a wallet's repeat WAGMI that day is ignored, nothing before ACTIVATE_WAGMI_PRIZE_BLOCK, replay SAME below the gate.
 *   node tools/wagmi-prize-test.js [snap-file-name] */
'use strict';
const { load, row, snap, run } = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const S = snap(process.argv[2]), T = S.tip, G = T + 6, SAT = 0.00000001;
const c = load(); c.document.head = { appendChild() {} }; c.setInterval = () => 0; require('vm').runInContext(require('fs').readFileSync(require('path').join(__dirname, '..', 'js/v2-badges.js'), 'utf8'), c); const V = c.V2Rules; V._setWagmiPrizeActivation(G);
const W = i => 'bc1qwagmiprizetest' + String(i).padStart(23, '0');
const D0 = Math.ceil((G + 1) / 144) * 144, d0 = D0 / 144; /* first full chain day after the gate */
const rows = [
  row(D0 + 1, W(2), SAT, 'pet:wagmi'),   /* created first, but a later block than W1 */
  row(D0, W(1), SAT, 'pet:wagmi'),
  row(D0 + 2, W(1), SAT, 'pet:wagmi'),   /* duplicate: same wallet, same day */
  row(D0 + 3, W(3), SAT, 'pet:wagmi'), row(D0 + 3, W(4), SAT, 'pet:wagmi'), /* same block: tx order */
  row(D0 + 4, W(5), SAT, 'pet:wagmi'),
  row(D0 + 5, W(6), SAT, 'pet:wagmi'),   /* 6th distinct wallet: no prize */
  row(D0 + 6, W(7), 0, 'pet:wagmi'),     /* below cost: rejected, takes no place */
  row(D0 + 144, W(6), SAT, 'pet:wagmi'), /* next day: W6 is first */
  row(D0 + 145, W(1), SAT, 'pet:wagmi')
];
const w = run(c, S, rows, D0 + 300), sp = a => (w.spins && w.spins[a] && w.spins[a].log.filter(x => x.src === 'wagmi').length) || 0;
ok(JSON.stringify(V.wagmiFirst(w, d0)) === JSON.stringify([W(1), W(2), W(3), W(4), W(5)]), 'first five of day ' + d0 + ' in chain order: ' + V.wagmiFirst(w, d0).map(a => a.slice(-2)).join(','));
ok(sp(W(1)) === 2, 'W1 gets 1 spin on day 1 (duplicate ignored) + 1 on day 2 (' + sp(W(1)) + ')');
[2, 3, 4, 5].forEach(i => ok(sp(W(i)) === 1, 'W' + i + ' gets exactly 1 spin'));
ok(sp(W(6)) === 1 && V.wagmiFirst(w, d0 + 1)[0] === W(6), '6th wallet gets nothing on day 1, first on day 2');
ok(sp(W(7)) === 0, 'rejected (below cost) WAGMI earns nothing');
ok(V.spinsLeft(w, W(3), D0 + 300) === 1, 'prize spin shows as a saved spin (spinsLeft)');
const dup = w.log.find(l => l.tx === rows[2].tx_hash); ok(dup && /counts once/.test(dup.msg), 'duplicate logged as counts once');
/* Day One Degen badge (display only, from w.wagmiFirst) */
const B = c.V2Badges.compute(w, S.rows.concat(rows), V), eb = a => (B.byAddr[a] || []).find(x => x.id === 'day-one-degen');
ok(eb(W(1)) && eb(W(1)).count === 2 && eb(W(5)) && eb(W(5)).count === 1, 'Day One Degen: W1 two days, W5 one day');
ok(!eb(W(7)) && eb(W(6)) && eb(W(6)).count === 1, 'Day One Degen: W6 only for day 2, rejected W7 none');
/* gate: the same pattern before the gate earns nothing */
const pre = [row(T + 1, W(1), SAT, 'pet:wagmi'), row(T + 2, W(2), SAT, 'pet:wagmi')];
const wp = run(c, S, pre, G - 1); ok(!wp.spins || !Object.keys(wp.spins).some(a => a.indexOf('bc1qwagmiprizetest') === 0), 'no prize spins before the gate');
ok(Object.keys(wp.wagmiFirst || {}).length === 0, 'no first-five record before the gate');
/* SAME below the gate: replay with the gate vs with the prize switched off */
const strip = x => JSON.stringify({ pets: x.pets.map(p => [p.id, p.owner, p.care, p.dead]), spins: x.spins, wagmi: x.wagmi, items: (x.itemList || []).length, log: x.log.map(l => [l.tx, l.kind, l.msg]) });
const on = strip(run(c, S, pre, G - 1)); V._setWagmiPrizeActivation(999999999); const off = strip(run(c, S, pre, G - 1));
ok(on === off, 'replay SAME below the gate (snapshot + pre-gate WAGMIs)');
V._setWagmiPrizeActivation(G);
console.log('wagmi-prize-test: ' + pass + ' passed, ' + fail + ' failed (snapshot tip ' + T + ', gate ' + G + ')'); process.exit(fail ? 1 : 0);
