/* PRACTICE GUARD (practice-fun-1102). First script on practice.html, before anything else runs.
 * 1. Storage: every localStorage / sessionStorage key this page reads or writes gets the 'xcpets-practice-' prefix, so practice can never read,
 *    change or delete the real game's saved data (and the real page never sees practice pets).
 * 2. Network: fetch is answered by the practice node (js/practice-engine.js) for the Counterparty / mempool URLs the real code reads. The real
 *    game's own api/ and t/ files are refused, and any other outside host is refused. No wallet, no chain, no server.
 * 3. No IndexedDB and no replay Worker (both would bypass the two rules above); the replay runs on the page with the same rules file. */
(function () {
  'use strict';
  var P = 'xcpets-practice-', W = window;
  W.XCPETS_PRACTICE = true;
  var SP = W.Storage && W.Storage.prototype, rawGet = SP.getItem, rawSet = SP.setItem, rawDel = SP.removeItem, rawKey = SP.key;
  function pk(k) { k = String(k); return k.indexOf(P) === 0 ? k : P + k; }
  function own(st) { var o = [], n = st.length; for (var i = 0; i < n; i++) { var k = rawKey.call(st, i); if (k && k.indexOf(P) === 0) o.push(k); } return o; }
  SP.getItem = function (k) { return rawGet.call(this, pk(k)); };
  SP.setItem = function (k, v) { return rawSet.call(this, pk(k), v); };
  SP.removeItem = function (k) { return rawDel.call(this, pk(k)); };
  SP.key = function (i) { var k = own(this)[i]; return k == null ? null : k.slice(P.length); };
  SP.clear = function () { var st = this; own(st).forEach(function (k) { rawDel.call(st, k); }); };
  W.__xcpPracticeStore = { get: function (k) { return rawGet.call(W.localStorage, pk(k)); }, set: function (k, v) { rawSet.call(W.localStorage, pk(k), v); },
    wipe: function () { [W.localStorage, W.sessionStorage].forEach(function (st) { own(st).forEach(function (k) { rawDel.call(st, k); }); }); } };
  /* a fresh read of the pretend chain on every load (the real 60 s copy of the chain and the last-sale base would be stale here) */
  try { ['xcpets-v2-prod-rows', 'xcpets-v2-last-1'].forEach(function (k) { rawDel.call(W.sessionStorage, pk(k)); rawDel.call(W.localStorage, pk(k)); }); } catch (e) {}
  try { Object.defineProperty(W, 'indexedDB', { value: undefined, configurable: true }); } catch (e) {}
  try { Object.defineProperty(W, 'Worker', { value: undefined, configurable: true }); } catch (e) {}
  try { if (navigator.serviceWorker) Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: true }); } catch (e) {}
  try { navigator.sendBeacon = function () { return false; }; } catch (e) {}

  /* practice always plays as the practice wallet (a ?addr= view link would point the page at another address) */
  try { var qs = new URLSearchParams(location.search); if (qs.has('addr')) { qs.delete('addr'); history.replaceState(null, '', location.pathname + (qs.toString() ? '?' + qs : '') + location.hash); } } catch (e) {}
  var realFetch = W.fetch && W.fetch.bind(W);
  function refuse(url) { return Promise.reject(new TypeError('practice mode is offline: ' + String(url).slice(0, 80))); }
  W.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : input && input.url ? input.url : String(input), u;
    try { u = new URL(url, location.href); } catch (e) { return refuse(url); }
    var XP = W.XcpPractice;
    if (u.origin !== location.origin) {
      var r = null; try { r = XP && XP.serve(u.href); } catch (e) { r = { status: 500, type: 'text/plain', body: String(e && e.message || e) }; }
      if (!r) return refuse(url);
      return Promise.resolve(new Response(r.body, { status: r.status, headers: { 'Content-Type': r.type } }));
    }
    /* same origin: static game files only. The real feeds / boot snapshots (api/, t/) describe the real chain, so they are refused. */
    if (/^\/(api|t)\//.test(u.pathname) || /\.json$/i.test(u.pathname) && !/^\/data\//.test(u.pathname)) return Promise.resolve(new Response('not in practice', { status: 404 }));
    return realFetch ? realFetch(input, init) : refuse(url);
  };
})();
