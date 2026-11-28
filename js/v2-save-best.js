/* SAVE YOUR BEST (Nov 28 2026, Jake: "no one is feeding 2900 pets. that's expensive and pointless"). Display only: no rule change, nothing signed.
 * The Today card used to say "Save 2,990 pets from the cemetery": every pet in danger, at about 517 XCPETS a meal for a never-fed hatchling
 * (Jake's wallet: about 829,000 XCPETS, and 1,388 of the 2,990 were pets he had discarded). Nobody does that, so the nudge was noise.
 * This picks the few pets worth a meal and prices them, so the nudge becomes "Save your 12 best pets for 6,210 XCPETS".
 *   V2SaveBest.rank(w, me, o) -> { risk, worth, ranked, cost(n), soon }
 *     risk     every pet in danger (V2Own.riskList: discarded pets are never in it)
 *     ranked   the ones a feed burn can still save, best first (favourites, gear, special, mutant, grown, about to level up, Rare, then power)
 *     worth    how many of ranked have a real reason (score >= WORTH): a plain Common/Uncommon/Rare hatchling is ranked but not "worth saving"
 *     cost(n)  XCPETS for the first n meals (whole sats, the replay's own sum when V2Rules.mealBurn is there)
 *   o.kept(id) -> true for a starred pet (V2UI.isKept); o.tip overrides w.tip.
 * A pet with 3 blocks or fewer left is left out: a feed burn might not confirm in time (V2Rules.burnMeal when the rules have it). */
(function (root) {
  'use strict';
  var WORTH = 1000, LAST = 3;
  var W = { fav: 100000, gear: 20000, special: 8000, mutant: 6000, grown: 3000, level: 2500, rare: 400, unc: 50 };
  function R() { return root.V2Rules || {}; }
  function total(p) { var s = p.stats || {}, t = 0; for (var k in s) t += +s[k] || 0; return t; }
  function wornN(w, p) { var r = R(); try { return r.worn ? (r.worn(w, p.id) || []).length : 0; } catch (e) { return 0; } }
  function flags(p) { var r = R(); try { return r.retireSpareFlags ? r.retireSpareFlags(p) || [] : []; } catch (e) { return []; } }
  /* one meal lifts it to its next stage (Hatchling -> Juvenile ...) */
  function levels(w, p, b) { var r = R(), th = null; if (!(p.stage >= 0) || p.stage >= 5) return false;
    try { th = r.petThresholds ? r.petThresholds(w, p, b) : r.thresholdsFor ? r.thresholdsFor(p.species, b) : null; } catch (e) { th = null; }
    if (th && th.meal) th = th.meal; if (!th || th[p.stage + 1] == null) return false;
    return (p.care || 0) + (p.nextCare != null ? p.nextCare : p.nextMeal || 0) >= th[p.stage + 1]; }
  function why(w, p, b, kept) {
    var s = 0, tags = [], f = flags(p);
    if (kept && kept(p.id)) { s += W.fav; tags.push('fav'); }
    if (wornN(w, p)) { s += W.gear; tags.push('gear'); }
    if (f.length) { s += W.special; tags.push(f.indexOf('legendary') >= 0 ? 'legendary' : f[0]); }
    if (p.mutation && f.indexOf('weird') < 0) { s += W.mutant; tags.push('mutant'); }
    if (p.stage >= 2) { s += W.grown * (p.stage - 1); tags.push('grown'); }
    if (levels(w, p, b)) { s += W.level; tags.push('level'); }
    if ((p.tier | 0) === 2) s += W.rare; else if ((p.tier | 0) === 1) s += W.unc;
    return { score: s + total(p), tags: tags };
  }
  function saveable(p, b) { var r = R(); if (!(p.nextMeal > 0)) return false; if (r.burnMeal) { try { return !!r.burnMeal(p, b); } catch (e) { } } return p.deathBlock - (b - 1) > LAST; }
  function sats(list) { var r = R(); if (r.mealBurn) { try { var v = r.mealBurn(list); if (typeof v === 'number') return v; if (v && v.total != null) return +v.total; } catch (e) { } }
    var s = 0; for (var i = 0; i < list.length; i++) s += Math.round((list[i].nextMeal || 0) * 1e8); return s / 1e8; }
  function rank(w, me, o) {
    o = o || {}; var Own = root.V2Own, tip = o.tip != null ? o.tip : w && w.tip, b = (tip || 0) + 1;
    var risk = Own && Own.riskList ? Own.riskList(w, me) : [], ranked = [], worth = 0, soon = Infinity, i, p, y, sc = {};
    for (i = 0; i < risk.length; i++) { p = risk[i]; if (p.deathBlock - tip < soon) soon = p.deathBlock - tip;
      if (!saveable(p, b) || (Own.canEat && !Own.canEat(p, me))) continue; y = why(w, p, b, o.kept); sc[p.id] = y; ranked.push(p); }
    ranked.sort(function (a, c) { return sc[c.id].score - sc[a.id].score || a.deathBlock - c.deathBlock || a.id - c.id; });
    for (i = 0; i < ranked.length; i++) if (sc[ranked[i].id].score >= WORTH) worth++;
    var tally = {}; ranked.forEach(function (q) { sc[q.id].tags.forEach(function (t) { tally[t] = (tally[t] || 0) + 1; }); });
    return { risk: risk, ranked: ranked, worth: worth, soon: soon === Infinity ? 0 : soon, why: function (id) { return sc[id] || null; }, tally: tally,
      cost: function (n) { return sats(ranked.slice(0, n)); }, tallyOf: function (n) { var t = {}; ranked.slice(0, n).forEach(function (q) { sc[q.id].tags.forEach(function (k) { t[k] = (t[k] || 0) + 1; }); }); return t; } };
  }
  /* the default ask: 12, or fewer when fewer are worth it (never 0 when something can be saved) */
  function pick(r, want) { var n = want || 12; if (r.worth) n = Math.min(n, r.worth); return Math.max(1, Math.min(n, r.ranked.length)); }
  var api = root.V2SaveBest = { rank: rank, pick: pick, WORTH: WORTH, W: W };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
