/* V2Own: the one answer to "which pets are this wallet's living pets" (Nov 24 2026, root-cause cleanup).
 * Before this, about a dozen files each wrote their own filter (owner, not dead, not released, not the community pet, and
 * sometimes not a zombie), and a fix in one never reached the others. Display only: the rules decide what a burn may do.
 *   V2Own.living(w, me)                  this wallet's pets that are alive, not released and not the community pet
 *   V2Own.living(w, me, { zombies: false })  the same without risen zombies
 *   V2Own.isLiving(p, me[, o])           the same test for one pet
 *   V2Own.canEat(p, me)                  hungry AND the rules would feed it: living, not a risen zombie (zombies eat pets) and NOT
 *                                        discarded on chain (the rules refuse a meal for a pet:hd pet: "discarded"). Nov 25 2026, play-test
 *                                        robot: Daily chores asked a 2,050-pet wallet for 294,249 XCPETS to feed 1,844 pets; 1,698 of them
 *                                        were discarded, so the rules fed 146 and the rest of the XCPETS fed nobody. */
(function (root) {
  'use strict';
  function isZ(p) { return !!(p && p.zombie && !p.zombie.end); }
  function isLiving(p, me, o) { if (!p || !me || p.owner !== me || p.dead || p.released || p.community) return false; if (o && o.zombies === false && isZ(p)) return false; return true; }
  function living(w, me, o) { if (!w || !me) return []; return (w.pets || []).filter(function (p) { return isLiving(p, me, o); }); }
  function canEat(p, me, pend) { return isLiving(p, me, { zombies: false }) && !!p.hungry && !discarded(p, me, { set: null, pend: pend || null }); }
  /* The Discard pile (Nov 25 2026, G Money: "I burned like 10 times to discard pets officially and it still won't let me feed them to zombies").
   * A wallet's Discard pile is BOTH lists: pets discarded ON CHAIN (pet:hd, p.hd === me, every device) and this browser's free Discard pile
   * (localStorage xcpets-hidden-NET-ME). The zombie meal picker, the cemetery sacrifice sheet and the altar each read only the browser list,
   * so a player who discarded on chain (the default since the owner made Discard permanent) saw "no Discarded pets", while the rules accept
   * exactly the on-chain ones (cemOfferWhy: 'only a discarded pet can be offered'). A risen zombie is never in the pile (inPile in v2.js).
   *   V2Own.pileIds(me)          this browser's Discard pile, as { id: 1 }
   *   V2Own.discardSet(w, me)    the whole pile: browser list + on-chain discards of this wallet's pets, as { id: 1 }
   *   V2Own.inPile(p, me, set)   one pet: not a risen zombie, and on chain or in the given browser set */
  /* ONE ANSWER TO "IS THIS PET DISCARDED?" (Nov 26 2026, root-cause pass). Four bugs on Nov 25 (PRs 284, 288, 289, 295) were screens that each
   * decided this on their own: some read only this browser's list, some only the chain flag, some counted a discard still waiting to confirm,
   * some treated a pet an OLD owner discarded as discarded. About fifteen copies in eleven files. Now every screen asks this one function:
   *   V2Own.discarded(p, me, o) -> null | 'chain' | 'pending' | 'browser'
   *     'chain'    this wallet discarded it on chain (p.hd === me, the rules' hdHidden): every device; the rules never feed it, zombies may eat it
   *     'pending'  one of this wallet's pet:hd burns still waiting to confirm names it (o.pend, as { id: 1 }; see pendingHd)
   *     'browser'  only in this browser's free Discard pile (o.set, as { id: 1 } or a Set): hidden here, the rules do not know about it
   *   A risen zombie is never discarded. A pet whose p.hd is another address (a former owner) is NOT discarded for me, as in the rules.
   *   o.set / o.pend: pass null to leave that kind out, leave undefined to read it now (pileIds / pendingHd). Read them once outside a loop. */
  function has(set, id) { return !!(set && (typeof set.has === 'function' ? set.has(id) || set.has(String(id)) : set[id])); }
  function pileOrder(me) { var out = [], seen = {}; if (!me) return out; try { var net = (root.LiveEngine && root.LiveEngine.CFG && root.LiveEngine.CFG.network) || 'mainnet', ls = root.localStorage;
      var raw = ls ? JSON.parse(ls.getItem('xcpets-hidden-' + net + '-' + me) || '[]') : []; if (raw && raw.forEach) raw.forEach(function (id) { id = +id; if (id > 0 && !seen[id]) { seen[id] = 1; out.push(id); } }); } catch (e) {}
    return out; }
  function pileIds(me) { var h = {}; pileOrder(me).forEach(function (id) { h[id] = 1; }); return h; }
  function pendingHd() { try { var u = root.V2UI, o = u && u.pendingFeedIds && u.pendingFeedIds(); return (o && o.hd) || {}; } catch (e) { return {}; } }
  function discarded(p, me, o) { if (!p || !me || isZ(p)) return null; if (p.hd === me) return 'chain'; o = o || {};
    var pd = o.pend === undefined ? pendingHd() : o.pend; if (pd && has(pd, p.id)) return 'pending';
    var st = o.set === undefined ? pileIds(me) : o.set; if (st && has(st, p.id)) return 'browser'; return null; }
  function onChain(p, me) { return discarded(p, me, { set: null, pend: null }) === 'chain'; }
  function inPile(p, me, set) { var d = p && me ? discarded(p, me, { set: set || null, pend: null }) : null; return d === 'chain' || d === 'browser'; }
  function discardSet(w, me) { var h = pileIds(me), P = (w && w.pets) || [], i, p; if (!me) return h;
    for (i = 0; i < P.length; i++) { p = P[i]; if (p && p.owner === me && onChain(p, me)) h[p.id] = 1; }
    return h; }
  /* pileList(w, me, set, dead) (Nov 25 2026, Evan: "they are said to be in discard pile but they aren't"): the pets the Discard pile box SHOWS.
   * It has to be inPile's whole answer, or a pet hidden from My Pets lands nowhere: My Pets hid every on-chain discard, the box listed only
   * this browser's list (set, as { id: 1 } or a Set). dead = the Pet Cemetery tab (browser list only: a dead pet can't be added back on chain). */
  function pileList(w, me, set, dead) { var P = (w && w.pets) || [], out = [], i, p, has = set ? (typeof set.has === 'function' ? function (id) { return set.has(id); } : function (id) { return !!set[id]; }) : function () { return false; };
    if (!me) return out;
    for (i = 0; i < P.length; i++) { p = P[i]; if (!p || p.owner !== me || p.released || isZ(p) || !!p.dead !== !!dead) continue; if (has(p.id) || (!dead && onChain(p, me))) out.push(p); }
    return out; }
  var api = root.V2Own = { living: living, isLiving: isLiving, isZ: isZ, canEat: canEat, discarded: discarded, onChain: onChain, pendingHd: pendingHd, pileOrder: pileOrder, pileIds: pileIds, inPile: inPile, discardSet: discardSet, pileList: pileList };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; /* node tools can require it (v2-habits under node) */
})(typeof self !== 'undefined' ? self : this);
