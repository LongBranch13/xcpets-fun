/* pet-card-page (2026-10-24): play.html deep links from the pet card with a pet preselected. Display/navigation only, no burns.
 *  #rare-room-ID -> remembers ID as the Rare Room dressing pet (same localStorage key the Rare Room already uses, xcpets-v2-dr-pet;
 *                   the Rare Room only takes it if the connected wallet owns that pet) and lands on #rare-room.
 *  The id stays readable after the hash is rewritten (V2Preselect.pending). A prerendered open does not rewrite the hash
 *  until the page is really shown, and it leaves the hash alone when the prerender guard is about to reload (that reload
 *  throws away the localStorage write, so the id has to still be in the URL).
 *  #breed-ID     -> lands on Gooby's Hotel (#gooby-inn) and picks ID as the first guest (#bA) once the hotel has it, if it is listed there.
 *  #battle-ID    -> already handled by the arena (UXB.battleWith). Runs before js/scene-hash.js so the scene jump sees the plain hash. */
(function () {
  'use strict';
  var h = location.hash || '', m, pending = 0, seen = {};
  function land(x, notify) {
    try { history.replaceState(null, '', location.pathname + location.search + '#' + x); } catch (e) { }
    if (!notify) return;
    try { window.dispatchEvent(new Event('hashchange')); } catch (e2) { }
  }
  function remember(id) {
    pending = +id || 0;
    try { window.__XCPETS_RR_PET = pending; } catch (e) { }
    try { localStorage.setItem('xcpets-v2-dr-pet', String(pending)); } catch (e2) { }
  }
  function readPending() {
    var id = pending || 0;
    try { if (!(id >= 1)) id = +window.__XCPETS_RR_PET || 0; } catch (e) { }
    return id >= 1 && !seen[id] ? id : 0;
  }
  try {
    window.V2Preselect = {
      pending: function () { return readPending(); },
      used: function (id) { return !!seen[+id || 0]; },
      clear: function (id) {
        id = +id || pending || 0;
        if (id) seen[id] = 1;
        if (!id || id === pending) pending = 0;
        try { if (!window.__XCPETS_RR_PET || window.__XCPETS_RR_PET === id) window.__XCPETS_RR_PET = 0; } catch (e) { }
      }
    };
  } catch (e) { }
  /* Rewrite after every prerenderingchange listener, so a reload decision is already recorded. */
  function stripWhenOpen() {
    function go() {
      setTimeout(function () {
        try { if (document.prerendering) return; } catch (e) { }
        if (window.__navPre && window.__navPre.reload) return;
        land('rare-room', true);
      }, 0);
    }
    try {
      if (document.prerendering) { document.addEventListener('prerenderingchange', go, { once: true }); return; }
    } catch (e) { }
    land('rare-room', false);
  }
  if ((m = /^#rare-room-(\d+)$/.exec(h))) { remember(m[1]); stripWhenOpen(); return; }
  if ((m = /^#breed-(\d+)$/.exec(h))) { var id = m[1], n = 0; land('gooby-inn', false);
    (function pick() { var a = document.getElementById('bA'), M = window.V2Mock, w = null; try { w = M && M.world && M.world(); } catch (e) { }
      var p = w && w.byId && w.byId[id];
      if (a && p && M.ME && p.owner === M.ME && !p.dead) { if (a.value !== id) { a.value = id; var b = document.getElementById('bB'); if (b && b.value === id) b.value = ''; try { window.V2UI && V2UI.render && V2UI.render(); } catch (e) { } } return; }
      if (++n < 120) setTimeout(pick, 1000); })(); }
})();
