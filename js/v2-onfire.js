/* Site on fire (owner Oct 22 2026 ~12:00 PM CT, fire-sales branch). During a LIVE Fire Sale every building / scene card and scene background
 * (home scene cards + nav buildings, arena, Lair / Rare Room shop scene, No-Tail Motel, breeding arena) gets 8-bit pixel flames along its bottom
 * and an ember/smoke glow; the page gets a faint ember glow at the bottom edge. During the WARNING phase only a small smoke/smolder hint shows.
 * Pure decoration: overlays are pointer-events:none and aria-hidden, nothing is moved, resized or re-styled except position:relative on a
 * static host. Driven by <html data-fire="live|warn"> set by v2-firesale.js (so ?preview=firesale / firesale-warn work too).
 * Reduced motion: static flames, no flicker. Phones: two small sprite tiles per host, CSS-only animation (steps, 4 fps). */
(function () {
  'use strict';
  var HOSTS = '.scene-cards .scard, .navscene, .arenawrap, #shopScene, #motelScene, .breedwrap, #breedArena, .kek-scene, .cold-scene';
  var PAL = ['', '#5a0f0a', '#b8250f', '#ef5a12', '#ffa51c', '#ffe15a'];
  /* 16 x 12 flame tile, 2 frames (digits = PAL index). */
  var F = [
    ['0000000000000000', '0000020000000200', '0000230000002300', '0002330000023300', '0023430020234300', '0234430232344300', '2344543234454320', '2345554344555432', '3455554445555543', '3455555555555543', '2344444444444432', '1222222222222221'],
    ['0000002000000000', '0000023000000020', '0000234000000230', '0002343000002330', '0023443200023430', '0234543320234430', '2345543434345432', '2345554445455432', '3455555455555543', '3455555555555543', '2344444444444432', '1222222222222221']];
  var S = ['0000000000000000', '0000066000000000', '0006666600006600', '0066776660066660', '0067777766667766', '0006777766677760', '0000666600666600', '0000000000000000'];
  function tile(rows, pal) { var c = document.createElement('canvas'), h = rows.length; c.width = 16; c.height = h; var x = c.getContext('2d'); if (!x) return '';
    rows.forEach(function (r, y) { for (var i = 0; i < 16; i++) { var k = +r[i]; if (k && pal[k]) { x.fillStyle = pal[k]; x.fillRect(i, y, 1, 1); } } }); return 'url(' + c.toDataURL() + ')'; }
  var made = false;
  function sprites() { if (made) return; made = true; var R = document.documentElement.style;
    R.setProperty('--fs-flame-a', tile(F[0], PAL)); R.setProperty('--fs-flame-b', tile(F[1], PAL));
    R.setProperty('--fs-smoke', tile(S, ['', '', '', '', '', '', 'rgba(120,110,105,.55)', 'rgba(170,160,150,.5)'])); }
  function deco() { var st = document.documentElement.getAttribute('data-fire'); if (!st) return; sprites();
    document.querySelectorAll(HOSTS).forEach(function (h) { if (h.querySelector(':scope > .fs-burn')) return; if (h.tagName === 'CANVAS') return;
      if (getComputedStyle(h).position === 'static') h.classList.add('fs-host');
      var d = document.createElement('span'); d.className = 'fs-burn'; d.setAttribute('aria-hidden', 'true'); d.innerHTML = '<i class="fs-glow"></i><i class="fs-smoke"></i><i class="fs-flames"></i>'; h.appendChild(d); });
    if (!document.querySelector('body > .fs-edge')) { var e = document.createElement('div'); e.className = 'fs-edge'; e.setAttribute('aria-hidden', 'true'); document.body.appendChild(e); } }
  new MutationObserver(deco).observe(document.documentElement, { attributes: true, attributeFilter: ['data-fire'] });
  var t = null; new MutationObserver(function () { if (!document.documentElement.getAttribute('data-fire') || t) return; t = setTimeout(function () { t = null; deco(); }, 400); }).observe(document.documentElement, { childList: true, subtree: true });
  window.V2OnFire = { deco: deco, HOSTS: HOSTS };
})();
