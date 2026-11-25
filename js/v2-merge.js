/* One merge step for fast pages (Nov 24 2026, root cause #1 of the root-cause audit: "fast pages stitch pets from partial files and can drop pets").
 *
 * A fast page builds its world from many partial sources: the wallet's owner pages, the newest pages, pet shards, zombies.json, the
 * Rankings files, graves, Gooby's requests, a pet page's parents, a looked-up pet. Each source used to republish the world on its own,
 * and each had its own way (or none) of keeping what the others had added: v2-split.js kept "extra" pets for owner-page rebuilds, and
 * v2-lookup.js wrapped setViewWorld to put looked-up pets back. A path without one of those dropped pets the page had already shown.
 *
 * Now every view world goes through V2Mock.setViewWorld (js/v2-chain.js), and that calls V2Merge.carry(previous, next, me) first:
 *   - a pet in the next world wins (it is the fresher copy);
 *   - a pet the previous world had and the next one lacks is carried over, with its worn gear, because in the real game a pet never
 *     leaves the world (it can die, be released or change hands, but it stays);
 *   - except the page wallet's own living pets: those come only from the wallet's owner pages, so a pet given away, sold or sacrificed
 *     during the visit is not put back on My Pets from an older copy (the same rule v2-split.js used for its kept pets);
 *   - pets pinned with V2Merge.pin (a looked-up pet, a Gooby's request partner, a grave, a zombie, the Rankings lead pets) are added to
 *     every next world that lacks them, so a source that loaded before the first world existed is not lost either.
 * #1765 (the burned genesis pet) is never carried; the slim world leaves it out on purpose.
 * Display only: the replay, the rules and what gets signed never read this. */
(function (root) {
  'use strict';
  var pins = {}, pinAll = {}, pinN = 0;
  function isZ(p) { return !!(p && p.zombie && !p.zombie.end); }
  function ownLiving(p, me) { return !!(me && p && p.owner === me && !p.dead && !p.released && !isZ(p)); }
  function skip(p) { return !p || p.id == null || (p.id | 0) === 1765; }
  /* pin(list, me, all): keep these pets in every later world. all = also the page wallet's own living pets (a typed-in lookup). */
  function pin(list, me, all) {
    var i, p, n = 0;
    for (i = 0; i < (list || []).length; i++) {
      p = list[i];
      if (skip(p) || (!all && ownLiving(p, me))) continue;
      if (!pins[p.id]) pinN++;
      pins[p.id] = p; if (all) pinAll[p.id] = 1; n++;
    }
    return n;
  }
  function addGear(next, p) {
    var w = p && p.worn, i, g;
    if (!w || !w.length) return;
    if (!next.items) next.items = {};
    for (i = 0; i < w.length; i++) {
      g = w[i];
      if (!g || !g.gid || next.items[g.gid]) continue;
      next.items[g.gid] = g;
      if (Array.isArray(next.itemList)) next.itemList.push(g);
    }
  }
  /* carry(prev, next, me): returns how many pets were added to next. Changes next in place. */
  function carry(prev, next, me) {
    if (!next || !Array.isArray(next.pets) || next === prev) return 0;
    if (!next.byId) { next.byId = {}; next.pets.forEach(function (p) { if (p && p.id != null) next.byId[p.id] = p; }); }
    var by = next.byId, n = 0, i, p, ids, id;
    function add(q) { by[q.id] = q; next.pets.push(q); addGear(next, q); n++; }
    if (prev && prev !== next && Array.isArray(prev.pets) && prev._view) {
      for (i = 0; i < prev.pets.length; i++) {
        p = prev.pets[i];
        if (skip(p) || by[p.id]) continue;
        if (ownLiving(p, me) && !pinAll[p.id]) continue;
        add(p);
      }
    }
    if (pinN) {
      ids = Object.keys(pins);
      for (i = 0; i < ids.length; i++) {
        id = ids[i]; p = pins[id];
        if (by[id] || skip(p)) continue;
        if (ownLiving(p, me) && !pinAll[id]) continue;
        add(p);
      }
    }
    return n;
  }
  function reset() { pins = {}; pinAll = {}; pinN = 0; }
  root.V2Merge = { carry: carry, pin: pin, reset: reset, pinned: function () { return pinN; }, _ownLiving: ownLiving };
})(typeof self !== 'undefined' ? self : this);
