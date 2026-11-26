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
  function canEat(p, me) { return isLiving(p, me, { zombies: false }) && p.hd !== me && !!p.hungry; }
  /* The Discard pile (Nov 25 2026, G Money: "I burned like 10 times to discard pets officially and it still won't let me feed them to zombies").
   * A wallet's Discard pile is BOTH lists: pets discarded ON CHAIN (pet:hd, p.hd === me, every device) and this browser's free Discard pile
   * (localStorage xcpets-hidden-NET-ME). The zombie meal picker, the cemetery sacrifice sheet and the altar each read only the browser list,
   * so a player who discarded on chain (the default since the owner made Discard permanent) saw "no Discarded pets", while the rules accept
   * exactly the on-chain ones (cemOfferWhy: 'only a discarded pet can be offered'). A risen zombie is never in the pile (inPile in v2.js).
   *   V2Own.pileIds(me)          this browser's Discard pile, as { id: 1 }
   *   V2Own.discardSet(w, me)    the whole pile: browser list + on-chain discards of this wallet's pets, as { id: 1 }
   *   V2Own.inPile(p, me, set)   one pet: not a risen zombie, and on chain or in the given browser set */
  function pileIds(me) { var h = {}; if (!me) return h; try { var net = (root.LiveEngine && root.LiveEngine.CFG && root.LiveEngine.CFG.network) || 'mainnet', ls = root.localStorage;
      var raw = ls ? JSON.parse(ls.getItem('xcpets-hidden-' + net + '-' + me) || '[]') : []; if (raw && raw.forEach) raw.forEach(function (id) { id = +id; if (id > 0) h[id] = 1; }); } catch (e) {}
    return h; }
  function inPile(p, me, set) { return !!(p && me && !isZ(p) && (p.hd === me || (set && set[p.id]))); }
  function discardSet(w, me) { var h = pileIds(me), P = (w && w.pets) || [], i, p; if (!me) return h;
    for (i = 0; i < P.length; i++) { p = P[i]; if (p && p.owner === me && p.hd === me && !isZ(p)) h[p.id] = 1; }
    return h; }
  /* pileList(w, me, set, dead) (Nov 25 2026, Evan: "they are said to be in discard pile but they aren't"): the pets the Discard pile box SHOWS.
   * It has to be inPile's whole answer, or a pet hidden from My Pets lands nowhere: My Pets hid every on-chain discard, the box listed only
   * this browser's list (set, as { id: 1 } or a Set). dead = the Pet Cemetery tab (browser list only: a dead pet can't be added back on chain). */
  function pileList(w, me, set, dead) { var P = (w && w.pets) || [], out = [], i, p, has = set ? (typeof set.has === 'function' ? function (id) { return set.has(id); } : function (id) { return !!set[id]; }) : function () { return false; };
    if (!me) return out;
    for (i = 0; i < P.length; i++) { p = P[i]; if (!p || p.owner !== me || p.released || isZ(p) || !!p.dead !== !!dead) continue; if (has(p.id) || (!dead && p.hd === me)) out.push(p); }
    return out; }
  root.V2Own = { living: living, isLiving: isLiving, isZ: isZ, canEat: canEat, pileIds: pileIds, inPile: inPile, discardSet: discardSet, pileList: pileList };
})(typeof self !== 'undefined' ? self : this);
