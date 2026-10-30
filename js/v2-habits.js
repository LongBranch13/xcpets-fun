/* habits-ux (owner, Oct 27 2026): UI-only helpers, no rule changes, nothing here runs in the replay.
 *  - feedWhy / feedGuardPlans: check feeds before signing. Drop pets already fed this chain day, dead, away on a quest
 *    (plus the older checks: not yours, released, Mythic, pending feed, no meal due). Works for pet:feed / fm / fl and the
 *    feed-all path (pet:fa / fx / fy plus its pet:sk / su skip-list burns). Nothing left = block, never a burn that feeds no one.
 *  - splitNeverFed: My Pets and the Cemetery fold never-fed pets into one collapsed group (starred and selected pets stay out). */
(function (root) {
  'use strict';
  function feedWhy(w, p, me, pend, nb, V) {
    if (!p) return 'not found'; if (p.owner !== me) return 'not yours'; if (p.dead) return 'dead'; if (p.released) return 'released';
    if (V && V.questOn && V.questAway && V.questOn(nb) && V.questAway(p, nb)) return 'away on a quest';
    if (p.mythicCare || p.stage >= 5) return 'Mythic (never starves)'; if (p.fedToday) return 'already fed this chain day';
    if (pend && pend[p.id]) return 'a feed burn is still waiting to confirm'; if (!(p.nextMeal > 0) || !p.hungry) return 'no meal due';
    return null; }
  /* the pets a feed-all tag would feed when the plan carries no petIds (an old resume) */
  function feedAllIds(w, t, me) { var ex = new Set(t.ex || []); return w.pets.filter(function (p) { return p.owner === me && (t.un ? (ex.has(p.id) || p.skipBy !== me) : (!ex.has(p.id) && p.skipBy !== me)); }).map(function (p) { return p.id; }); }
  /* o = { me, pend, nb, V, idList(ids)->text, queue(ok)->plans }. Returns { plans, skipped, text, blocked } */
  function feedGuardPlans(w, plans, o) { var V = o.V, feedIds = [], other = [], why = {}, hasFeed = false;
    plans.forEach(function (q) { var t = V.parseTag(q.tag), a = t && t.action;
      if (a === 'feed') { hasFeed = true; feedIds.push(t.petId); } else if (a === 'feedm' || a === 'feedl') { hasFeed = true; feedIds = feedIds.concat(t.ids); }
      else if (a === 'feedr') { hasFeed = true; feedIds = feedIds.concat(q.petIds || (V.feedRunsIds ? V.feedRunsIds(w, o.me, t, o.nb) : [])); } /* feed-all-one-burn: pet:fr carries its pets */
      else if (a === 'feeda') { hasFeed = true; feedIds = feedIds.concat(q.petIds || feedAllIds(w, t, o.me)); } else other.push({ q: q, a: a }); });
    if (!hasFeed) return { plans: plans, skipped: [], text: '', blocked: false };
    var seen = {}; feedIds = feedIds.filter(function (id) { if (seen[id]) return false; seen[id] = 1; return true; });
    var ok = feedIds.filter(function (id) { var r = feedWhy(w, w.byId[id], o.me, o.pend, o.nb, V); if (r) (why[r] = why[r] || []).push(id); return !r; });
    var okS = new Set(ok), skipped = feedIds.filter(function (id) { return !okS.has(id); });
    var text = Object.keys(why).map(function (r) { return (o.idList ? o.idList(why[r]) : '#' + why[r].join(', #')) + ' ' + r; }).join(' · ');
    if (!ok.length) /* nothing to feed: drop the feed-all skip-list burns too (they only ride along with a feed) */
      return { plans: other.filter(function (x) { return x.a !== 'skip'; }).map(function (x) { return x.q; }), skipped: skipped, text: text || 'no pet left to feed', blocked: true };
    if (!skipped.length) return { plans: plans, skipped: [], text: '', blocked: false };
    return { plans: other.filter(function (x) { return x.a !== 'skip'; }).map(function (x) { return x.q; }).concat(o.queue(ok)), skipped: skipped, text: text, blocked: false }; }
  /* never fed = no feed ever landed (lastFed null). Starred (kept) and selected pets are never folded. */
  function neverFed(p) { return p && p.lastFed == null && !(p.zombie && !p.zombie.end); } /* v2-zombies preview: a risen zombie is listed with the others, not folded */
  function splitNeverFed(list, kept, sel) { var shown = [], nf = [];
    for (var i = 0; i < list.length; i++) { var p = list[i]; if (neverFed(p) && !(kept && kept.has(p.id)) && !(sel && sel.has(p.id))) nf.push(p); else shown.push(p); }
    return { shown: shown, nf: nf }; }
  var api = { feedWhy: feedWhy, feedGuardPlans: feedGuardPlans, neverFed: neverFed, splitNeverFed: splitNeverFed, feedAllIds: feedAllIds };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.V2Habits = api;
})(typeof window !== 'undefined' ? window : this);
