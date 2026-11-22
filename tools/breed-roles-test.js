// Breed roles ("Who gets what" at Gooby's check-in, js/v2-easy-flows.js). Offline: fake future burns on a real snapshot; nothing is signed.
// The box must say what the rules will do: the asker's wallet gets the egg, and the other wallet's pet carries the asker's pet's best stat.
// node tools/breed-roles-test.js [snap-file]
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { load, row, snap, run, ROOT } = require('./lib/load-rules.js');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

const src = fs.readFileSync(path.join(ROOT, 'js/v2-easy-flows.js'), 'utf8');
const pick = re => { const m = re.exec(src); if (!m) throw new Error('not found: ' + re); return m[0]; };
const helper = pick(/  var STAT_NM = [\s\S]*?\n  function rolesBox\([\s\S]*?'<\/div><\/div>'; }\n/);

const c = load(), V = c.V2Rules, s = snap(process.argv[2]), tip = s.tip, base = run(c, s, [], tip);
vm.runInContext('var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\\"": "&quot;" }[c]; }); };\n' + helper + '\nwindow.__roles = { carryOf: carryOf, rolesBox: rolesBox };', c);
const R = c.__roles;
ok(typeof R.carryOf === 'function' && typeof R.rolesBox === 'function', 'carryOf and rolesBox load from js/v2-easy-flows.js');

const B0 = tip + 1;
const good = base.pets.filter(p => !p.community && !p.dead && !p.released && p.stage >= 3 && !p.neglected && V.breedable(p, B0 + 5) == null && !V.isRes(p));
const by = {}; good.forEach(p => (by[p.owner] = by[p.owner] || []).push(p));
const own = Object.keys(by).sort((a, b) => by[b].length - by[a].length);
let A = null, Bp = null, O1 = null, O2 = null;
for (let i = 0; i < own.length && !A; i++) for (let j = 0; j < own.length && !A; j++) { if (i === j) continue;
  for (const a of by[own[i]].slice(0, 30)) { const b = by[own[j]].find(q => !V.kinWhy(a, q) && !V.resPairWhy(a, q, B0 + 2)); if (b) { A = a; Bp = b; O1 = own[i]; O2 = own[j]; break; } } }
ok(!!A && !!Bp, 'found two breedable pets with different owners (#' + (A && A.id) + ' x #' + (Bp && Bp.id) + ')');

if (A && Bp) {
  const bReq = B0 + 1, bAcc = B0 + 2, cost = b => V.costAt(base, V.breedCost(b), b);
  const pre = R.carryOf(A, bAcc);
  const rq = row(bReq, O1, cost(bReq), 'pet:breed:' + A.id + ':' + Bp.id), ac = row(bAcc, O2, cost(bAcc), 'pet:breed:' + Bp.id + ':' + A.id);
  const c2 = load(); const w = run(c2, s, [rq, ac], bAcc + 3);
  const log = w.log.filter(x => x.tx === ac.tx_hash || x.tx_hash === ac.tx_hash).pop();
  ok(log && /bred/.test(log.msg || ''), 'two-owner request + accept breeds [' + (log ? log.kind + ': ' + log.msg : 'no log') + ']');
  const kid = w.byId[Math.max.apply(null, w.pets.map(p => p.id))], B2 = w.byId[Bp.id], A2 = w.byId[A.id];
  ok(kid && kid.owner === O1, 'the egg goes to the asker (first burn), as the box says');
  const car = (B2.carried || []).filter(x => x.block === bAcc).pop();
  ok(!!car && car.from === A.id, 'the partner pet (#' + Bp.id + ') becomes the carrier of #' + A.id);
  ok(!!pre && !!car && pre.stat === car.stat && pre.value === car.value, 'preview matches the rules: ' + (pre && pre.stat + ' ' + pre.value) + ' vs ' + (car && car.stat + ' ' + car.value));
  ok(!(A2.carried || []).some(x => x.block === bAcc), 'the asker pet carries nothing from this breed');
  const ask = R.rolesBox(A, Bp, 'ask', bAcc), acc = R.rolesBox(Bp, A, 'accept', bAcc), same = R.rolesBox(A, A, 'same', bAcc);
  ok(ask.indexOf('#' + A.id) < ask.indexOf('BECOMES A CARRIER') && ask.indexOf('#' + Bp.id) > ask.indexOf('BECOMES A CARRIER'),'ask: your pet on the egg side, their pet on the carrier side');
  ok(acc.indexOf('#' + A.id) < acc.indexOf('BECOMES A CARRIER') && /goes to <b>their<\/b> wallet/.test(acc) && /Your pet learns/.test(acc), 'accept: their pet gets the egg, your pet becomes the carrier');
  /* with carry-pick + Power Shards switched on (they are live on mainnet; the fixture snapshot predates them) */
  { V._setCarryPick(B0); V._setQuestShardsActivation(B0); const pre2 = R.carryOf(A, bAcc);
    const c3 = load(); c3.V2Rules._setCarryPick(B0); c3.V2Rules._setQuestShardsActivation(B0); const w3 = run(c3, s, [rq, ac], bAcc + 3);
    const car3 = (w3.byId[Bp.id].carried || []).filter(x => x.block === bAcc).pop();
    ok(!!pre2 && !!car3 && pre2.stat === car3.stat && pre2.value === car3.value, 'with carry-pick + shards on, preview still matches: ' + (pre2 && pre2.stat + ' ' + pre2.value) + ' vs ' + (car3 && car3.stat + ' ' + car3.value)); }
  ok(/THE EGG IS YOURS/.test(same) && !/CARRIER/.test(same.replace('becomes a carrier', '')), 'same owner: egg is yours, no carrier');
}
console.log(fails ? fails + ' failed' : 'all passed'); process.exit(fails ? 1 : 0);
