/* Saved-spins nav badge (saved-spins branch): '🎡 N' on every Rare Room link when the connected player has saved spins. Display only. ?preview=spins = 7. */
(function () {
  'use strict';
  var V = window.V2Rules, M = window.V2Mock; if (!V || !V.spinsLeft || !M) return; var pv = /[?&]preview=spins\b/.test(location.search);
  function tick() { if (document.getElementById('v2boot') || !(M.state().rows || []).length) return; try {
      var tip = (M.state().tip || 0) + 1, n = pv ? 7 : (M.ME && V.spinsOn(tip) ? V.spinsLeft(M.world(), M.ME, tip, window.V2UI && V2UI.myPendingTags ? V2UI.myPendingTags() : []) : 0);
      [].forEach.call(document.querySelectorAll('nav a[href$="#rare-room"], header a[href$="#rare-room"], .nav a[href$="#rare-room"]'), function (a) { var b = a.querySelector('.spin-badge'); if (!n) { if (b) b.remove(); return; }
        if (!b) { b = document.createElement('span'); b.className = 'spin-badge'; a.appendChild(b); } var t = '🎡' + n; if (b.textContent !== t) { b.textContent = t; b.title = n + ' saved Pepe Wheel spin' + (n === 1 ? '' : 's'); } }); } catch (e) { } }
  function start() { tick(); setInterval(tick, 3000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
