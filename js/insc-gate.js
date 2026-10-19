/* XCPETS: real inscribing is behind a TEST LINK (Jake 2026-10-15). ?inscribe=test turns it on for this tab (sessionStorage), ?inscribe=off turns it off.
 * Without the flag players see nothing about inscriptions (no nav link, no pet-page button; inscriptions.html redirects home). With it, a nav link 'Inscriptions (test)' is added. Combine with ?network=signet for signet. */
(function () {
  var K = 'xcpets-inscribe', on = false;
  try { var q = new URLSearchParams(location.search).get('inscribe'); if (q === 'test') sessionStorage.setItem(K, 'test'); else if (q === 'off') sessionStorage.removeItem(K); on = sessionStorage.getItem(K) === 'test'; } catch (e) {}
  window.XCPETS_INSC_TEST = on; if (!on) return;
  var nv = document.querySelector('header.nav nav'); if (nv && !nv.querySelector('a[href="inscriptions.html"]')) { var a = document.createElement('a'); a.href = 'inscriptions.html'; a.textContent = 'Inscriptions (test)'; var rk = nv.querySelector('a[href="ranking.html"]'); nv.insertBefore(a, rk ? rk.nextSibling : null); }
  var s = document.getElementById('inscSoon'), r = document.getElementById('inscReal'); if (s) s.style.display = 'none'; if (r) r.style.display = '';
})();
