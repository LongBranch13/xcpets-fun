/* mypets-tok-filter (owner Nov 9 2026, "group tokenized pets in my pets"). DISPLAY ONLY.
 * The same three states as the My Pets info chip: V2Rules.deedOf on the replayed world.
 *   yes  = tokenized and the owner holds the token
 *   away = tokenized, but another address holds the token
 *   no   = not tokenized (including a token minted but not yet tied)
 * No chain read. One state per pet per world, then filter, counts and the "Tokenized first" sort reuse it.
 * Pure; tested in tools/mypets-tok-filter-test.js. */
(function (root) {
  'use strict';
  var KINDS = [['', 'All', 'every pet'], ['yes', 'Tokenized', 'has a token, and you hold it'], ['no', 'Not tokenized', 'no token yet'], ['away', 'Token held elsewhere', 'tokenized, but another address holds the token']];
  var RANK = { yes: 0, away: 1, no: 2 };
  var MEMO = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function V() { return root.V2Rules || {}; }
  function box(w) { if (!MEMO || !w || typeof w !== 'object') return new Map(); var m = MEMO.get(w); if (!m) { m = new Map(); MEMO.set(w, m); } return m; }
  /** state(w, p) -> 'yes' | 'away' | 'no'. */
  function state(w, p) { if (!p) return 'no'; var m = box(w), id = p.id, s = m.get(id); if (s) return s;
    var d = null; try { var R = V(); if (R.deedOf) d = R.deedOf(w, p); } catch (e) { d = null; }
    s = !d ? 'no' : d.ok ? 'yes' : 'away'; m.set(id, s); return s; }
  function norm(k) { return k === 'yes' || k === 'no' || k === 'away' ? k : ''; }
  /** match(kind, w, p): '' keeps every pet. */
  function match(kind, w, p) { kind = norm(kind); return !kind || state(w, p) === kind; }
  /** counts(w, pets) -> { all, yes, no, away } for this list (already narrowed by the other filters). */
  function counts(w, pets) { var c = { all: 0, yes: 0, no: 0, away: 0 }, i, p, L = pets || [];
    for (i = 0; i < L.length; i++) { p = L[i]; if (!p) continue; c.all++; c[state(w, p)]++; } return c; }
  /** comparator(w): tokenized pets first (you hold the token, then held elsewhere), then not tokenized. Ties: lowest pet number. */
  function comparator(w) { return function (a, b) { return RANK[state(w, a)] - RANK[state(w, b)] || a.id - b.id; }; }
  var K = 'xcpets-tokf';
  function load() { try { return norm(sessionStorage.getItem(K) || ''); } catch (e) { return ''; } }
  function save(v) { v = norm(v); try { if (v) sessionStorage.setItem(K, v); else sessionStorage.removeItem(K); } catch (e) { } return v; }
  var api = { KINDS: KINDS, state: state, norm: norm, match: match, counts: counts, comparator: comparator, load: load, save: save };
  root.V2TokFilter = api; if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
