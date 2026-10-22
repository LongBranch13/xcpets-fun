/* front-page-entries (2026-10-19): play.html#kekimus / #drip-den / #gooby-inn land on their scene even though the page fills in after the chain loads.
 * Re-aims at the anchor while the layout settles (stops as soon as the player scrolls). UI only. */
(function () {
  'use strict';
  var ok = { kekimus: 1, 'rare-room': 1, lair: 1, 'no-tail-motel': 1, 'drip-den': 1, 'gooby-inn': 1 }; /* #lair / #no-tail-motel (tonight bundle); the old #drip-den / #gooby-inn keep working */
  function go() { var id = (location.hash || '').slice(1); if (!ok[id]) return; var a = document.getElementById(id); if (!a) return;
    var n = 0, user = false, stop = function () { user = true; };
    ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(function (e) { window.addEventListener(e, stop, { once: true, passive: true }); });
    (function aim() { if (user) return; a.scrollIntoView({ block: 'start' }); if (++n < 24) setTimeout(aim, 250); })(); }
  window.addEventListener('hashchange', go);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
