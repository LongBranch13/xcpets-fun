/* XCPETS: real inscribing is behind a TEST LINK (Jake 2026-10-15). ?inscribe=test turns it on for this tab (sessionStorage), ?inscribe=off turns it off.
 * Without the flag nothing changes: nav 'Inscriptions (coming soon)', coming-soon notice, disabled pet-page button. Combine with ?network=signet for signet. */
(function () {
  var K = 'xcpets-inscribe', on = false;
  try { var q = new URLSearchParams(location.search).get('inscribe'); if (q === 'test') sessionStorage.setItem(K, 'test'); else if (q === 'off') sessionStorage.removeItem(K); on = sessionStorage.getItem(K) === 'test'; } catch (e) {}
  window.XCPETS_INSC_TEST = on; if (!on) return;
  var as = document.querySelectorAll('a[href="inscriptions.html"]'); for (var i = 0; i < as.length; i++) if (/coming soon/.test(as[i].textContent)) as[i].textContent = 'Inscriptions (test)';
  var s = document.getElementById('inscSoon'), r = document.getElementById('inscReal'); if (s) s.style.display = 'none'; if (r) r.style.display = '';
})();
