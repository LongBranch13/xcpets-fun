/* Seasonal display scripts. The pages used to fetch doom-week, halloween and voting-day
 * on every load. Each file already does nothing when its window is shut, but parsing it
 * still costs a turn. This file fetches one only while that event is on.
 * Doom Week stays off: DOOM_ENABLED matches ENABLED in js/doom-week.js. The week code stays
 * in the repo. ?doom=1, ?halloween=1 and ?votingday=1 still load a preview. Practice pages
 * never load doom-week. ?sw=0 unregisters the static cache. */
(function () {
  'use strict';
  var me = document.currentScript, ver = (me && /[?&]v=([\w.-]+)/.exec(me.src) || [])[1] || '';
  function flag(k) { var m = new RegExp('[?&]' + k + '=([01])\\b').exec(location.search); return m ? m[1] : null; }
  function add(file) {
    if (document.querySelector('script[src*="' + file + '"]')) return;
    var s = document.createElement('script'); s.src = file + (ver ? '?v=' + ver : ''); s.defer = true; document.body.appendChild(s);
  }
  var now = new Date();
  var hw0 = new Date(Date.UTC(2026, 9, 31, 5, 0, 0)), hw1 = new Date(Date.UTC(2026, 10, 2, 6, 0, 0)), hf = flag('halloween');
  if (hf === '1' || (hf !== '0' && now >= hw0 && now < hw1)) add('js/halloween.js');
  var vd0 = new Date(Date.UTC(2026, 10, 3, 6, 0, 0)), vd1 = new Date(Date.UTC(2026, 10, 4, 6, 0, 0)), vf = flag('votingday');
  if (vf === '1' || (vf !== '0' && now >= vd0 && now < vd1)) add('js/voting-day.js');
  var DOOM_ENABLED = false; /* keep in step with ENABLED in js/doom-week.js */
  var practice = /practice/i.test(location.pathname || ''), df = flag('doom');
  if (!practice && df !== '0' && (df === '1' || DOOM_ENABLED)) add('js/doom-week.js');

  var kill = /[?&]sw=(0|off)(?:&|$)/.test(location.search);
  if (navigator.serviceWorker) {
    if (kill) {
      navigator.serviceWorker.getRegistrations().then(function (rs) { rs.forEach(function (r) { r.unregister(); }); });
      if (window.caches && caches.keys) caches.keys().then(function (ks) { ks.forEach(function (k) { caches.delete(k); }); });
    } else if (location.protocol === 'https:' || location.hostname === '127.0.0.1' || location.hostname === 'localhost') {
      navigator.serviceWorker.register('sw.js?v=sw60-1').catch(function () {});
    }
  }
})();
