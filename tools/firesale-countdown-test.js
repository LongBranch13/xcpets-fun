#!/usr/bin/env node
/* firesale-countdown-test (Nov 4 2026, UI only): (1) the Fire Sale banner counts the blocks a burn sent now can still land in (end - nextBlock),
 * (2) in the last 2 live sale blocks the confirm sheet warns and offers the full cost (and keeps the sale cost), (3) no warning earlier / outside a sale,
 * (4) copy has no banned words.   node tools/firesale-countdown-test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const REPO = path.resolve(__dirname, '..'), rd = f => fs.readFileSync(path.join(REPO, f), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const fsj = rd('js/v2-firesale.js');
ok(/left = live \? s\.end - f\.nextBlock : s\.start - f\.nextBlock/.test(fsj), 'banner: blocks left = end - nextBlock');
ok(!/s\.end - f\.nextBlock \+ 1/.test(fsj), 'banner: old +1 gone');
const v2 = rd('js/v2.js'), i = v2.indexOf('  var FIRE_END_WARN');
const blk = v2.slice(i, v2.indexOf('    var bf = $(\'cfPayFull\'), bs = $(\'cfPaySale\'); if (bf) bf.onclick', i)) + "    var bf = $('cfPayFull'), bs = $('cfPaySale'); if (bf) bf.onclick = function () { pick(true); }; if (bs) bs.onclick = function () { pick(false); }; }\n";
function rig(tip, sale) { const els = {}; const el = id => els[id] || (els[id] = { id, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, textContent: '', innerHTML: '' });
  const ctx = vm.createContext({ __el: el });
  vm.runInContext('var S = { tip: ' + tip + ' }, pendingPlans = null; function $(id) { return __el(id); } function esc(s) { return String(s); } function fmt(n) { return String(+(+n).toFixed(8)); }' +
    'var V = { fireInfo: function (w, t) { var b = t + 1, s = ' + JSON.stringify(sale) + '; return { live: s && b >= s.start && b < s.end ? s : null, nextBlock: b }; }, burnSummary: function (L) { return { total: +L.reduce(function (a, p) { return a + p.amount; }, 0).toFixed(8), burns: L.length }; } };\n' + blk +
    'this.T = { fireEndPlans: fireEndPlans, fireEndNote: fireEndNote, fireEndWire: fireEndWire, get pending() { return pendingPlans; }, set pending(v) { pendingPlans = v; } };', ctx);
  return { T: ctx.T, el }; }
const sale = { arm: 973888, start: 973894, end: 973930 }, plans = [{ tag: 'pet:fr:37:AB', amount: 2887.65, petIds: [1, 2, 3, 4, 5, 6, 7, 8, 9] }, { tag: 'pet:sk:1', amount: 1e-8 }, { tag: 'pet:hatch', amount: 5.3475 }];
let r = rig(973926, sale); ok(r.T.fireEndPlans({}, plans) === null, '3 blocks left: no warning');
r = rig(973927, sale); let fe = r.T.fireEndPlans({}, plans); ok(fe && fe.left === 2, '2 blocks left: warning');
ok(fe && fe.full[0].amount >= 9315 && fe.full[0].amount < 9315.000001, 'feed run full cost covers 9 meals of 1035 (' + (fe && fe.full[0].amount) + ')');
ok(fe && fe.full[2].amount >= 17.25 && fe.full[2].amount < 17.2501, 'hatch full cost 17.25 (' + (fe && fe.full[2].amount) + ')');
ok(fe && fe.full[1].amount === 1e-8, '1-sat setup burn untouched');
ok(fe && fe.sale === plans, 'sale plans kept as the other choice');
const note = fe ? r.T.fireEndNote(fe) : '';
ok(note.includes('Sale may end before this confirms. Pay full cost to be safe?'), 'warning text');
ok(/id="cfPayFull"/.test(note) && /id="cfPaySale"/.test(note), 'both buttons');
ok(!/\b(price|discount|series)\b/i.test(note) && !/ x /.test(note), 'no banned words / x');
r.T.pending = fe.sale; r.T.fireEndWire(fe); r.el('cfPayFull').onclick(); ok(r.T.pending === fe.full, 'Pay full cost -> full plans pending');
ok(/^9332\.25/.test(r.el('cfAmt').textContent), 'amount line updates');
r.el('cfPaySale').onclick(); ok(r.T.pending === fe.sale, 'Keep sale cost -> sale plans back');
r = rig(973928, sale); fe = r.T.fireEndPlans({}, plans); ok(fe && fe.left === 1 && /last block/.test(r.T.fireEndNote(fe)), '1 block left: last block copy');
r = rig(973929, sale); ok(r.T.fireEndPlans({}, plans) === null, 'after the sale: no warning');
r = rig(973927, null); ok(r.T.fireEndPlans({}, plans) === null, 'no sale: no warning');
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
