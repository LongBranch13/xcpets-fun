/* quick wins (2026-10-19, DRAFT): one-time hint bubbles per scene (tap to dismiss, saved in localStorage, never shown again; in place, no pop-up)
 * and the shared 🔇/🔊 sound toggle in the Lair and the motel (same setting as the X Circus Kekimus announcer button). Display only. */
(function () {
  'use strict';
  var HINTS = { lair: ['shopScene', 'Tap a shelf to try gear on'], motel: ['motelScene', 'Pick two pets to check in'], arena: ['arScene', 'Pick a rival or hit Quick match'] };
  var SH = {}, io = window.IntersectionObserver ? new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting && e.intersectionRatio > 0.6) { var k = e.target.dataset.hint; if (!SH[k]) { SH[k] = 1; mark(k); } } }); }, { threshold: [0.6] }) : null;
  function seen(k) { try { return localStorage.getItem('xcpets-hint-' + k) === '1'; } catch (e) { return true; } }
  function mark(k) { try { localStorage.setItem('xcpets-hint-' + k, '1'); } catch (e) { } }
  function host(k) { var el = document.getElementById(HINTS[k][0]); if (!el) return null; return k === 'arena' ? el.parentNode : el; }
  function ensure() { Object.keys(HINTS).forEach(function (k) { var h = host(k); if (!h) return;
      if (k !== 'arena' && window.V2Sfx && !h.querySelector('[data-sfx]')) { h.insertAdjacentHTML('beforeend', V2Sfx.toggle('sfx-scene')); }
      if (h.querySelector('.qw-hint')) return; if (SH[k] === 2 || (seen(k) && !SH[k])) return;
      h.insertAdjacentHTML('beforeend', '<button type="button" class="qw-hint" data-hint="' + k + '">' + HINTS[k][1] + ' <span aria-hidden="true">\u2715</span></button>');
      var b = h.querySelector('.qw-hint'); if (io) io.observe(b); else { SH[k] = 1; mark(k); }
      b.onclick = function (e) { e.stopPropagation(); SH[k] = 2; mark(k); b.remove(); }; }); }
  var mo = window.MutationObserver ? new MutationObserver(function () { mo.disconnect(); ensure(); watch(); }) : null;
  function watch() { ['shopScene', 'motelScene', 'arenaBody'].forEach(function (id) { var el = document.getElementById(id); if (el && mo) mo.observe(el, { childList: true }); }); }
  function go() { ensure(); watch(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  window.V2QuickWins = { ensure: ensure, HINTS: HINTS };
})();
