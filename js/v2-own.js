/* V2Own: the one answer to "which pets are this wallet's living pets" (Nov 24 2026, root-cause cleanup).
 * Before this, about a dozen files each wrote their own filter (owner, not dead, not released, not the community pet, and
 * sometimes not a zombie), and a fix in one never reached the others. Display only: the rules decide what a burn may do.
 *   V2Own.living(w, me)                  this wallet's pets that are alive, not released and not the community pet
 *   V2Own.living(w, me, { zombies: false })  the same without risen zombies
 *   V2Own.isLiving(p, me[, o])           the same test for one pet */
(function (root) {
  'use strict';
  function isZ(p) { return !!(p && p.zombie && !p.zombie.end); }
  function isLiving(p, me, o) { if (!p || !me || p.owner !== me || p.dead || p.released || p.community) return false; if (o && o.zombies === false && isZ(p)) return false; return true; }
  function living(w, me, o) { if (!w || !me) return []; return (w.pets || []).filter(function (p) { return isLiving(p, me, o); }); }
  root.V2Own = { living: living, isLiving: isLiving, isZ: isZ };
})(typeof self !== 'undefined' ? self : this);
