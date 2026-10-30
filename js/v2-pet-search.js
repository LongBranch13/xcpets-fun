/* species-ranks-split (Oct 24 2026, display only): free-text pet search for My Pets (#fSearch). Matches as you type, case-insensitive.
 * Every word must match (AND). A word matches a pet's name, #number, species, hybrid, rarity tier (Common..Legendary, Mythic), stage,
 * looks (pattern, eyes, cheeks, background, shades), worn gear (name, slot, tier), traits/stat names, status words (alive, starving, community).
 * Zombies (mypets-zombie-filter, Oct 30 2026): 'zombie' / 'risen', plus 'hungry' (can eat a zombie meal now), 'feral', 'crumbling' (dust within a day).
 * Stat words can carry a number: "vigor:18" / "vigor=18" (exact), "vigor>15", "vigor>=15", "luck<5". A bare number or "#12" matches pet numbers
 * starting with it (same as before). No rule changes: it only decides which cards are shown. Pure; tested in tools/pet-search-test.js. */
(function (root) {
  var STATS = ['vigor', 'spark', 'grit', 'zoom', 'luck'], TL = ['common', 'uncommon', 'rare', 'legendary'];
  function V() { return root.V2Rules || {}; }
  function words(q) { return String(q || '').toLowerCase().split(/[\s,]+/).filter(Boolean); }
  function hay(p, w, ks) { var V2 = V(), out = [p.name, '#' + p.id, p.species];
    try { out.push(V2.speciesLabel(p.species)); } catch (e) { }
    var hyb = !!(p.hybrid || (p.art && p.art.hybrid) || (V2.isHybrid && V2.isHybrid(p.species)));
    if (hyb) out.push('hybrid'); if (p.parents && p.parents.length) out.push('bred'); else out.push('hatched');
    out.push(TL[p.tier] || ''); if (p.stage >= 5) out.push('mythic');
    try { out.push((V2.STAGE_NAMES || [])[p.stage]); } catch (e) { }
    if (p.dead) out.push('dead'); else out.push('alive'); if (p.community) out.push('community'); if (p.released) out.push('released');
    if (p.status) out.push(p.status); if (p.oldMoney) out.push('old money'); if (p.zombie && !p.zombie.end) out.push('risen', 'zombie'); if (p.feral) out.push('feral'); if ((p.zPast || []).some(function (z) { return z.end && z.end.kind === 'resurrected'; })) out.push('resurrected'); /* cemetery loop */
    try { var ZF = root.V2ZombieFilter; if (ZF && w && ZF.isZ(p)) Array.prototype.push.apply(out, ZF.words(w, p, (w.tip || 0) + 1, p.owner)); } catch (e) { } /* mypets-zombie-filter: 'zombie hungry', 'feral', 'crumbling' (engine zombie view, display only) */
    if (ks && ks.has(p.id)) out.push('selected', 'checked'); /* mypets-checkbox: the checked pets (was 'starred' / 'kept'; stars are gone) */
    if (p.hungry && !p.dead) out.push('hungry'); if (p.lastFed == null && !(p.zombie && !p.zombie.end) && !Object.keys(p.feedDays || {}).length) out.push('unfed', 'never fed');
    STATS.forEach(function (k) { if (p.stats && p.stats[k] != null) out.push(k); });
    try { if (root.PetCore && p.art) { var d = root.PetCore.describe(p.art); Object.keys(d).forEach(function (k) { if (k !== 'Tier' && d[k]) out.push(d[k]); }); } } catch (e) { }
    try { if (w && V2.wornOf) V2.wornOf(w, p.id).forEach(function (g) { out.push('gear', g.label, g.item, g.slot, TL[g.tier] || '', g.legendary ? 'legendary' : '');
      try { out.push(V2.slotLabel(g.slot)); } catch (e) { } }); } catch (e) { }
    return out.filter(Boolean).join(' | ').toLowerCase(); }
  function cmp(a, op, b) { return op === '>' ? a > b : op === '>=' ? a >= b : op === '<' ? a < b : op === '<=' ? a <= b : a === b; }
  function one(t, p, h) { var m = /^([a-z]+)\s*(>=|<=|>|<|=|:)\s*(\d+)$/.exec(t);
    if (m && STATS.indexOf(m[1]) >= 0) { var v = p.stats && p.stats[m[1]]; return v != null && cmp(Number(v), m[2], Number(m[3])); }
    var n = t.replace(/^#/, ''); if (/^\d+$/.test(n)) return String(p.id).indexOf(n) === 0;
    return h.indexOf(t) >= 0; }
  /** matcher(q, w) -> function(p) true when every word matches; null when q is empty. */
  function matcher(q, w) { var ws = words(q); if (!ws.length) return null; var cache = new Map(), ks = null; try { var U = root.V2UI; if (U && U.S) ks = new Set((U.S().sel || []).map(Number)); } catch (e) { }
    return function (p) { var h = cache.get(p); if (h == null) { h = hay(p, w, ks); cache.set(p, h); } return ws.every(function (t) { return one(t, p, h); }); }; }
  var api = { matcher: matcher, words: words, haystack: hay };
  root.V2PetSearch = api; if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
