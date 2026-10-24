/* pet-sort (Oct 24 2026, display only): shared sort list + comparator for My Pets (#fSort, next to #fSearch) and the V2Picker pet pickers
 * (fight history, breed motel, The Rare Room). Only changes the order cards are shown in: no rule, burn or replay change.
 * Every sort is high-first (or A-Z / newest-first) and ties fall back to the lowest pet number, so the order is stable.
 * Pure; tested in tools/pet-sort-test.js. */
(function (root) {
  'use strict';
  var STATS = ['vigor', 'spark', 'grit', 'zoom', 'luck'];
  /* [value, label]: clear fun labels, pixel-game style */
  var SORTS = [['new', '🆕 Newest first'], ['old', '🦴 Oldest first'], ['num', '#️⃣ Pet #'], ['name', '🔤 Name A-Z'], ['tier', '💎 Rarest first'], ['stage', '🌱 Biggest stage'],
    ['vigor', '💪 Most Vigor'], ['spark', '✨ Most Spark'], ['grit', '🪨 Most Grit'], ['zoom', '💨 Most Zoom'], ['luck', '🍀 Most Luck'],
    ['power', '⚡ Total stats'], ['wins', '🏆 Most wins'], ['gear', '🎽 Most gear']];
  function stat(p, k) { return Number(p && p.stats && p.stats[k]) || 0; }
  function total(p) { return STATS.reduce(function (a, k) { return a + stat(p, k); }, 0); }
  function born(p) { return Number(p.hatchBlock) || 0; }
  function gearN(w, p) { try { var V = root.V2Rules; return V && V.wornOf && w ? V.wornOf(w, p.id).length : 0; } catch (e) { return 0; } }
  function nm(p) { return String(p.name || '').toLowerCase(); }
  /** key(sort, w) -> function(p) number, bigger = shown first; null for the string sort (name) or unknown sorts */
  function key(sort, w) {
    if (STATS.indexOf(sort) >= 0) return function (p) { return stat(p, sort); };
    switch (sort) {
      case 'new': return function (p) { return born(p) * 1e6 + p.id; };
      case 'old': return function (p) { return -(born(p) * 1e6 + p.id); };
      case 'num': return function (p) { return -p.id; };
      case 'tier': return function (p) { return (p.tier || 0); };
      case 'stage': return function (p) { return (p.stage || 0) * 1e9 + (Number(p.care) || 0); };
      case 'power': return total;
      case 'wins': return function (p) { return Number(p.wins) || 0; };
      case 'gear': return function (p) { return gearN(w, p); };
    } return null; }
  /** comparator(sort, w) -> (a, b) => number for Array.sort, or null when the sort isn't one of SORTS. Ties: lowest pet number first. */
  function comparator(sort, w) {
    if (sort === 'name') return function (a, b) { var x = nm(a), y = nm(b); return (x < y ? -1 : x > y ? 1 : 0) || a.id - b.id; };
    var k = key(sort, w); if (!k) return null; var C = new Map();
    function v(p) { var r = C.get(p); if (r === undefined) { r = k(p); C.set(p, r); } return r; }
    return function (a, b) { return (v(b) - v(a)) || a.id - b.id; }; }
  function has(sort) { return SORTS.some(function (s) { return s[0] === sort; }); }
  var api = { SORTS: SORTS, STATS: STATS, comparator: comparator, key: key, total: total, has: has };
  root.V2PetSort = api; if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
