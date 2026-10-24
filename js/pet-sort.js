/* XCPETS shared pet sort (pet-sort 2026-10-24). One copy of the egg review sort (moved here from js/v2.js egg-review-sort 3780d64) used by the
 * egg review (js/v2.js drawReveal) and Gooby's Hotel mate search (js/v2-easy-flows.js, Parent 1 and Mate lists).
 * Rarity = hatch tier (Common < Uncommon < Rare < Legendary), ties by Pet Score; Power = PetScore (js/pet-score.js, same number as the Pet Score chip);
 * Species = A to Z by species name, a hybrid grouped under its primary (first) parent species, right after that species' purebreds, then by hybrid name.
 * '' = the list's own order (hatch order). Ties always keep the incoming order. Display only: reads pets, changes nothing. */
(function () {
  'use strict';
  var OPTS = [['', 'Hatch order'], ['rar', 'Rarity: high to low'], ['rar-', 'Rarity: low to high'], ['pow', 'Power: high to low'], ['pow-', 'Power: low to high'], ['sp', 'Species: A to Z']];
  function pow(w, p) { var s = window.PetScore && PetScore.of ? PetScore.of(w, p) : null; return s ? s.score : -1; }
  function tier(p) { return p.art && p.art.tierIndex != null ? p.art.tierIndex : (p.tier || 0); }
  function sp(p) { var V = window.V2Rules || {}, s = String(p.species), h = V.isHybrid ? V.isHybrid(s) : /^hyb3?:/.test(s), lab = function (x) { return String(V.speciesLabel ? V.speciesLabel(x) : x).toLowerCase(); };
    return h ? [lab(s.split(':')[1]), 1, lab(s)] : [lab(s), 0, '']; }
  /* sort(w, list, k, pet?) -> new array; pet(x) maps an item to its pet (default: the item is the pet) */
  function sort(w, list, k, pet) { if (!k) return list; pet = pet || function (x) { return x; }; var dir = k.slice(-1) === '-' ? -1 : 1;
    var rows = list.map(function (x, i) { var p = pet(x); return { x: x, i: i, k: k === 'sp' ? sp(p) : [tier(p), pow(w, p)] }; });
    rows.sort(function (a, b) { var A = a.k, B = b.k;
      if (k === 'sp') return (A[0] < B[0] ? -1 : A[0] > B[0] ? 1 : 0) || A[1] - B[1] || (A[2] < B[2] ? -1 : A[2] > B[2] ? 1 : 0) || a.i - b.i;
      if (k.indexOf('pow') === 0) return dir * (B[1] - A[1]) || a.i - b.i;
      return dir * (B[0] - A[0] || B[1] - A[1]) || a.i - b.i; });
    return rows.map(function (r) { return r.x; }); }
  function options(cur) { return OPTS.map(function (o) { return '<option value="' + o[0] + '"' + ((cur || '') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join(''); }
  window.PetSort = { OPTS: OPTS, sort: sort, options: options };
})();
