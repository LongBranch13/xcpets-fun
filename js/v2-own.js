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
  root.V2Own = { living: living, isLiving: isLiving, isZ: isZ, canEat: canEat };
})(typeof self !== 'undefined' ? self : this);
