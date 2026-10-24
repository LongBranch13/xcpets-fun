/* auto-halving-test: halving N = Cold Storage block of community pet N + 6 (gate ACTIVATE_AUTO_HALVING_BLOCK). Dev only; nothing signed or sent. */
'use strict';
const L = require('./lib/load-rules');
const X = ['js/kek-sprite.js', 'js/wizard-sprite.js', 'js/funtrump-sprite.js'];
const S = L.snap('snap-972877.json'), T = S.tip; let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const src = 'bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n';
const rows = []; for (let i = 0; i < 6; i++) rows.push(L.row(972881 + i, src, 1000000, 'pet:feed'));
const after = [L.row(972900, src, 69, 'pet:feed'), L.row(972901, src, 69, 'pet:feed')];
function world(auto, extra, tip) { const c = L.load(X); if (auto !== undefined) c.V2Rules._setAutoHalvingActivation(auto); return { c, w: L.run(c, S, extra || [], tip) }; }
{ const { c, w } = world(undefined, [], T); ok(c.V2Rules.ACTIVATE_AUTO_HALVING_BLOCK === 972889, 'gate 972889 (tip 972883 + 6)');
  ok(c.V2Rules.halvingBlocks(w).join() === '972875', 'halving 1 stays 972875 (live gate): ' + c.V2Rules.halvingBlocks(w)); }
{ const { c, w } = world(T + 1, [], T); ok(c.V2Rules.halvingBlocks(w).join() === '972875', 'halving 1 stays 972875 (gate on)'); }
{ const { c, w } = world(T + 1, [], T + 3); ok(c.V2Rules.ftOn(T + 3) && w.community.current === 'funtrump', 'FUNTRUMP takes over at 972880 with auto halving on'); }
{ const { c, w } = world(T + 1, rows.concat(after), 972905); const hb = c.V2Rules.halvingBlocks(w), cs = w.funtrumpMythic && w.funtrumpMythic.block;
  ok(!!cs, 'FUNTRUMP reaches Cold Storage with synthetic burns (fed ' + (w.funtrump && Math.round(w.funtrump.fed)) + ')');
  ok(hb.length === 2 && hb[0] === 972875 && hb[1] === cs + 6, 'halving 2 = FUNTRUMP Cold Storage + 6: ' + hb + ' cs ' + cs);
  ok(c.V2Rules.eraAt(w, cs + 5) === 1 && c.V2Rules.eraAt(w, cs + 6) === 2, 'era 1 until cs+5, era 2 from cs+6');
  const { c: c0, w: w0 } = world(null, rows.concat(after), 972905); ok(c0.V2Rules.halvingBlocks(w0).join() === '972875', 'gate off: no halving 2 even after FUNTRUMP Cold Storage'); }
{ const { c, w } = world(972950, rows, 972905); const hb = c.V2Rules.halvingBlocks(w); ok(hb[1] === 972950, 'Cold Storage before the gate: halving starts at the gate, never in the past: ' + hb); }
console.log('auto-halving-test: ' + pass + ' passed, ' + fail + ' failed (snapshot tip ' + T + ')'); process.exit(fail ? 1 : 0);
