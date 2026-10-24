/* pet-card-page (2026-10-24): play.html deep links from the pet card with a pet preselected. Display/navigation only, no burns.
 *  #rare-room-ID -> remembers ID as the Rare Room dressing pet (same localStorage key the Rare Room already uses, xcpets-v2-dr-pet;
 *                   the Rare Room only takes it if the connected wallet owns that pet) and lands on #rare-room.
 *  #breed-ID     -> lands on Gooby's Hotel (#gooby-inn) and picks ID as the first guest (#bA) once the hotel has it, if it is listed there.
 *  #battle-ID    -> already handled by the arena (UXB.battleWith). Runs before js/scene-hash.js so the scene jump sees the plain hash. */
(function () {
  'use strict';
  var h = location.hash || '', m;
  function land(x) { try { history.replaceState(null, '', location.pathname + location.search + '#' + x); } catch (e) { } }
  if ((m = /^#rare-room-(\d+)$/.exec(h))) { try { localStorage.setItem('xcpets-v2-dr-pet', m[1]); } catch (e) { } land('rare-room'); return; }
  if ((m = /^#breed-(\d+)$/.exec(h))) { var id = m[1], n = 0; land('gooby-inn');
    (function pick() { var a = document.getElementById('bA'), M = window.V2Mock, w = null; try { w = M && M.world && M.world(); } catch (e) { }
      var p = w && w.byId && w.byId[id];
      if (a && p && M.ME && p.owner === M.ME && !p.dead) { if (a.value !== id) { a.value = id; var b = document.getElementById('bB'); if (b && b.value === id) b.value = ''; try { window.V2UI && V2UI.render && V2UI.render(); } catch (e) { } } return; }
      if (++n < 120) setTimeout(pick, 1000); })(); }
})();
