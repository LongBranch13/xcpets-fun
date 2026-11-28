// Pet Score "why it moved" (js/pet-score.js moved / whyHtml / badge). Display only: the score math is untouched.
// node tools/score-why-test.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const src = fs.readFileSync(path.join(__dirname, '..', 'js/pet-score.js'), 'utf8');
function fresh() { const st = {}; const ctx = { console, setTimeout: (f) => { f(); return 0; }, Math, JSON, Object, Array, Number, String, Date, WeakMap,
  localStorage: { getItem: k => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); } } }; ctx.window = ctx; ctx.self = ctx; vm.createContext(ctx); vm.runInContext(src, ctx); return { P: ctx.PetScore, st }; }
const mk = (sc, stats) => ({ score: sc, breakdown: { stats: { total: stats || 50 }, growth: { mythicPct: 10, streak: 1 }, gear: { won: 0 }, battles: { fights: 0, wins: 0 } } });
let { P, st } = fresh();
const p = { id: 7 }, w = t => ({ tip: t });
ok(P.moved(w(144 * 100), p, mk(800), 1000) === null, 'first sight: nothing to compare yet');
ok(P.moved(w(144 * 100 + 50), p, mk(805), 1000) === null, 'same chain day: still nothing to compare');
let m = P.moved(w(144 * 101 + 3), p, mk(796), 1300);
ok(m && m.delta === -9 && m.days === 1 && !m.self && m.newPets === 300, 'next day, pet unchanged: -9, 300 new pets (' + JSON.stringify(m) + ')');
let h = P.whyHtml(m, 1300);
ok(/Down 9<\/b> since yesterday/.test(h) && /didn't change: 300 new pets hatched/.test(h) && /all 1,300 pets/.test(h), 'words say the pet did not change and the curve moved');
ok(!/[×]|\bdiscount\b|\bprice\b/i.test(h), 'no banned words');
m = P.moved(w(144 * 101 + 9), p, mk(799), 1300); ok(m && m.delta === -6, 'later the same day it still compares with yesterday');
m = P.moved(w(144 * 104), p, mk(830, 60), 1400); ok(m && m.delta === 31 && m.days === 3 && m.self, 'three days later, pet grew: +31, self changed');
ok(/since you last saw it 3 days ago/.test(P.whyHtml(m, 1400)) && /This pet changed/.test(P.whyHtml(m, 1400)), 'days-ago words');
ok(JSON.parse(st['xcpets-ps-hist2'])['7'].d === 104, 'history is kept in this browser');
({ P } = fresh()); ok(/Why it moves/.test(P.whyHtml(null, 50)), 'no history: still explains why it moves');
const badge = fs.readFileSync(path.join(__dirname, '..', 'js/pet-score.js'), 'utf8');
ok(/arrow\(mv\)/.test(badge) && /whyHtml\(mv, n\)/.test(badge), 'the chip shows the arrow and the breakdown the why line');
console.log(fails ? fails + ' failed' : 'all passed'); process.exit(fails ? 1 : 0);
