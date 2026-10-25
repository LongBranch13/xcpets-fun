/* XCPETS egg Power preview (hotel-breed-power 2026-10-24). DISPLAY ONLY: reads two pets, changes nothing, rolls nothing.
 * Mirrors V2Rules.breedChild + breedOne (js/v2-rules.js) without a block hash, so it gives the spread, not the one egg:
 *   each stat = max(1, round((A + B) / 2) + a draw from -2..+2) (five values, even odds);
 *   rarity: 5% one tier above the higher parent, 30% the higher parent, 65% the lower; a pure egg below its species' lowest tier is raised (stat bonus difference on each stat);
 *   different species (both pure, from ACTIVATE_HYBRID_RATE_BLOCK): hybrid HYBRID_RATE_1E9 / 1e9 of the time, and a hybrid egg keeps each parent's best stat at full value;
 *   carried stats (breed carry): a parent's carried stat floors the egg's stat at the carried value;
 *   same species, both pure: one bred-true bonus, +BRED_TRUE_STAT on one stat in at least half of eggs (the other half get a rarer pattern or eyes, or the +3 if none is rarer).
 * A hybrid parent follows its own species rules (hybrid again, a root, or a three-way): shown as both cases, never as one certain answer.
 * Wizard / Kek / FUNTRUMP / Nakamoto fixed tiers are not modelled (they only move the rarity bonus); the preview says so for those species. */
(function () {
  'use strict';
  var window = typeof globalThis !== 'undefined' ? globalThis : this;
  var KEYS = ['vigor', 'spark', 'grit', 'zoom', 'luck'];
  var V = function () { return window.V2Rules || {}; }, PC = function () { return window.PetCore || {}; };
  function hyb(s) { return /^hyb3?:/.test(String(s)); }
  function tierOf(p) { return p.tier != null ? p.tier : (p.art && p.art.tierIndex) || 0; }
  function best(P) { var s = P.stats || {}; return KEYS.reduce(function (m, k) { return (s[k] || 0) > (s[m] || 0) ? k : m; }, KEYS[0]); }
  function floors(A, B, blk) { var R = V(), f = {}; if (R.ACTIVATE_BREEDCARRY_BLOCK != null && blk < R.ACTIVATE_BREEDCARRY_BLOCK) return f;
    [A, B].forEach(function (P) { (P.carried || []).forEach(function (c) { if (KEYS.indexOf(c.stat) >= 0 && (f[c.stat] == null || c.value > f[c.stat].v)) f[c.stat] = { v: c.value, from: P.id }; }); }); return f; }
  function bonusOf(t) { var T = PC().TIERS; return T && T[t] ? T[t].statBonus || 0 : 0; }
  /* distribution of one stat: {value: weight} */
  function statDist(m, add, fl, fixed) { var d = {}; if (fixed != null) { var v0 = Math.max(fixed, fl || 0); d[v0] = 1; return d; }
    for (var u = -2; u <= 2; u++) { var v = Math.max(1, m + u) + add; v = Math.max(v, fl || 0); d[v] = (d[v] || 0) + 0.2; } return d; }
  function conv(a, b) { var o = {}; Object.keys(a).forEach(function (x) { Object.keys(b).forEach(function (y) { var s = +x + +y; o[s] = (o[s] || 0) + a[x] * b[y]; }); }); return o; }
  function addW(acc, d, w) { Object.keys(d).forEach(function (k) { acc[k] = (acc[k] || 0) + d[k] * w; }); }
  /** preview(A, B, blk) -> { exp, expHi (bred true: exp counts the +3 half the time, expHi every time; the real share sits between), lo, hi, dist, stats: { k: { a, b, avg, lo, hi, exp, keep, floor } }, hybridPct, bredTrue, notes: [], passes: [] } */
  function preview(A, B, blk) {
    var R = V(), sa = A.stats || {}, sb = B.stats || {}, ha = hyb(A.species), hb = hyb(B.species), same = A.species === B.species && !ha && !hb;
    var rateOn = R.hybridRateOn ? R.hybridRateOn(blk) : true, h = 0, notes = [];
    if (!same && !ha && !hb) h = rateOn ? (R.HYBRID_RATE_1E9 || 684773435) / 1e9 : 0;
    else if (ha || hb) { h = 0.5; notes.push('A hybrid parent follows its own species rules, so this shows both cases (hybrid egg or pure egg) at even weight.'); }
    var fl = floors(A, B, blk), mid = {}; KEYS.forEach(function (k) { mid[k] = Math.round(((sa[k] || 0) + (sb[k] || 0)) / 2); });
    var lo = Math.min(tierOf(A), tierOf(B)), hi = Math.max(tierOf(A), tierOf(B)), tiers = [[Math.min(3, hi + 1), 0.05], [hi, 0.30], [lo, 0.65]];
    var scen = []; /* [weight, per-stat add, fixed map] */
    if (h < 1) { var sps = same ? [A.species] : [A.species, B.species];
      sps.forEach(function (sp) { tiers.forEach(function (t) { var m = R.minTierOf && !hyb(sp) ? R.minTierOf(sp) : 0, add = t[0] < m ? bonusOf(m) - bonusOf(t[0]) : 0; scen.push([(1 - h) * t[1] / sps.length, add, null]); }); }); }
    var ka = best(A), kb = best(B); if (h > 0) { var fx = {}; fx[ka] = sa[ka] || 0; fx[kb] = kb === ka ? Math.max(sa[ka] || 0, sb[kb] || 0) : (sb[kb] || 0); scen.push([h, 0, fx]); }
    var bt = same && rateOn, BT = R.BRED_TRUE_STAT || 3, dist = {}, per = {};
    KEYS.forEach(function (k) { per[k] = {}; });
    scen.forEach(function (s) { var tot = { 0: 1 }; KEYS.forEach(function (k) { var d = statDist(mid[k], s[1], fl[k] && fl[k].v, s[2] && s[2][k] != null ? s[2][k] : null); addW(per[k], d, s[0]); tot = conv(tot, d); });
      if (bt) { var t2 = {}; Object.keys(tot).forEach(function (v) { t2[v] = (t2[v] || 0) + tot[v] * 0.5; t2[+v + BT] = (t2[+v + BT] || 0) + tot[v] * 0.5; }); tot = t2; }
      addW(dist, tot, s[0]); });
    var vals = Object.keys(dist).map(Number), exp = vals.reduce(function (a, v) { return a + v * dist[v]; }, 0);
    var stats = {}; KEYS.forEach(function (k) { var vs = Object.keys(per[k]).map(Number); stats[k] = { a: sa[k] || 0, b: sb[k] || 0, avg: mid[k], lo: Math.min.apply(null, vs), hi: Math.max.apply(null, vs), exp: vs.reduce(function (a, v) { return a + v * per[k][v]; }, 0) + (bt ? BT * 0.5 / KEYS.length : 0), keep: h > 0 && (k === ka || k === kb) ? (k === ka ? A.id : B.id) : null, floor: fl[k] ? fl[k].v : null, bt: bt }; });
    var passes = [];
    if (h > 0) passes.push((h === 1 ? '' : Math.round(h * 1000) / 10 + '% hybrid: ') + 'keeps #' + A.id + '\u2019s best ' + ka.toUpperCase() + ' ' + (sa[ka] || 0) + ' and #' + B.id + '\u2019s best ' + kb.toUpperCase() + ' ' + (sb[kb] || 0) + ' at full value');
    Object.keys(fl).forEach(function (k) { passes.push('Carried ' + k.toUpperCase() + ' ' + fl[k].v + ' (from #' + fl[k].from + '): the egg\u2019s ' + k.toUpperCase() + ' is at least ' + fl[k].v); });
    if (bt) passes.push('Bred true: +' + BT + ' on one stat in at least half of eggs, else a rarer pattern or eyes');
    [A, B].forEach(function (P) { if (P.hidden) passes.push('Hidden trait from #' + P.id + ': passes half the time'); });
    if ([A.species, B.species].some(function (s) { return /^(wizard|kek|funtrump|nakamoto)$/.test(s); })) notes.push('Community and Nakamoto species have fixed tiers that can add a rarity bonus not shown here.');
    return { exp: Math.round(exp * 10) / 10, expHi: Math.round((exp + (bt ? BT * 0.5 : 0)) * 10) / 10, lo: Math.min.apply(null, vals), hi: Math.max.apply(null, vals), dist: dist, stats: stats, hybridPct: Math.round(h * 1000) / 10, bredTrue: bt, passes: passes, notes: notes,
      parentPower: [KEYS.reduce(function (a, k) { return a + (sa[k] || 0); }, 0), KEYS.reduce(function (a, k) { return a + (sb[k] || 0); }, 0)] };
  }
  var API = window.EggPower = { preview: preview, KEYS: KEYS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
