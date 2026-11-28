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
  /* Nov 28 2026 (40,000-pet freeze): kept while the stored text is unchanged; screens ask once per pet card */
  var poC = { k: null, s: null, out: [] };
  function pileOrder(me) { var out = [], seen = {}; if (!me) return out; try { var net = (root.LiveEngine && root.LiveEngine.CFG && root.LiveEngine.CFG.network) || 'mainnet', ls = root.localStorage;
      var k = 'xcpets-hidden-' + net + '-' + me, s = ls ? ls.getItem(k) || '[]' : '[]'; if (poC.k === k && poC.s === s) return poC.out.slice();
      var raw = JSON.parse(s); if (raw && raw.forEach) raw.forEach(function (id) { id = +id; if (id > 0 && !seen[id]) { seen[id] = 1; out.push(id); } }); poC = { k: k, s: s, out: out.slice() }; } catch (e) {}
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
  /* IN DANGER (Nov 28 2026, Jake: "I don't want my discards, that's why I discarded them"). The "in danger" test (neglected, not Mythic-cared,
   * death block still ahead) was copied into Today, the My Pets line and the urgency badge, and none of them left discarded pets out: Jake's
   * Today card said 2,990 in danger, 1,388 of them pets he had discarded on chain. Every screen asks these two now:
   *   V2Own.atRisk(p, me, tip, o)   this wallet's living pet (not a risen zombie) that starves at p.deathBlock unless fed, and is NOT discarded
   *                                 (o as in discarded(): pass { set, pend } read once outside a loop)
   *   V2Own.riskList(w, me)         every such pet of the wallet, the pile read once */
  function starving(p, me, tip) { return isLiving(p, me, { zombies: false }) && !!p.neglected && !p.mythicCare && p.deathBlock != null && p.deathBlock > tip; } /* discards included: only to say how many were left out */
  function atRisk(p, me, tip, o) { return starving(p, me, tip) && !discarded(p, me, o || {}); }
  function riskList(w, me) { if (!w || !me) return []; var o = { set: pileIds(me), pend: pendingHd() }, P = w.pets || [], out = [], i;
    for (i = 0; i < P.length; i++) if (P[i] && P[i].owner === me && atRisk(P[i], me, w.tip, o)) out.push(P[i]);
    return out; }
  var api = root.V2Own = { living: living, isLiving: isLiving, isZ: isZ, canEat: canEat, discarded: discarded, onChain: onChain, pendingHd: pendingHd, pileOrder: pileOrder, pileIds: pileIds, inPile: inPile, discardSet: discardSet, pileList: pileList, atRisk: atRisk, riskList: riskList, starving: starving };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; api.V2Own = api; } /* require(..).V2Own as before; node tools can require it (v2-habits under node) */
})(typeof self !== 'undefined' ? self : this);
