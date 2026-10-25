/* XCPETS data-lag banner (data-lag-banner preview, Oct 25 2026). DISPLAY ONLY, no extra network reads: it looks at what the page already read
 * (V2Mock.state(): the shown copy's tip + time, the chain tip from the normal tip read; V2Sales.feed: tip + time of api/recent-events.json).
 * Shows one line under the nav (same spot / look as the halving ribbon) while the game data is more than ~30 minutes behind, and removes it on
 * its own once a fresh read catches up. ?preview=datalag forces it on. */
(function () {
  'use strict';
  var LAG_MS = 30 * 60 * 1000, LAG_BLOCKS = 3; /* ~10 min a block: more than 3 blocks behind = more than ~30 min */
  var TEXT = "Game data is catching up. Your burns are safe on-chain and will count. Please don't repeat a burn.";
  /** lagging(s, now): s = { dataTip, dataAt, verified, chainTip, feedTip, feedAt }. Pure, for tools/data-lag-test.js. */
  function lagging(s, now) { if (!s || !s.dataTip) return false;
    var ref = Math.max(s.chainTip || 0, s.feedTip || 0); if (ref && ref - s.dataTip > LAG_BLOCKS) return true;  /* behind the chain tip / the feed's block */
    if (s.dataAt && s.feedAt && s.feedAt - s.dataAt > LAG_MS && (!s.feedTip || s.feedTip > s.dataTip)) return true; /* behind the feed's timestamp */
    if (!s.verified && s.dataAt && now - s.dataAt > LAG_MS) return true; /* only an old saved copy, no fresh read yet */
    return false; }
  var api = { lagging: lagging, TEXT: TEXT, LAG_MS: LAG_MS, LAG_BLOCKS: LAG_BLOCKS };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  window.V2DataLag = api;
  var M = window.V2Mock; if (!M || !M.state) return;
  var pv = /[?&]preview=datalag\b/.test(location.search);
  function snap() { var S = M.state() || {}, F = (window.V2Sales && window.V2Sales.feed) || {};
    return { dataTip: S.tip, dataAt: S.dataAt, verified: !!S.verified, chainTip: S.chainTip, feedTip: F.tip, feedAt: F.at }; }
  function bar(on) { var el = document.getElementById('dataLagBar'); if (!on) { if (el) el.remove(); return; } if (el) return;
    el = document.createElement('div'); el.id = 'dataLagBar'; el.className = 'halving-ribbon data-lag'; el.setAttribute('role', 'status');
    el.innerHTML = '<b>⏳ Catching up</b> <span></span>'; el.querySelector('span').textContent = TEXT;
    var nav = document.querySelector('nav, .nav, header'), host = document.querySelector('main') || document.body;
    if (nav && nav.parentNode) nav.parentNode.insertBefore(el, nav.nextSibling); else host.insertBefore(el, host.firstChild); }
  function tick() { if (document.getElementById('v2boot') || !(M.state().rows || []).length) return; /* wait for the page's own boot */ try { bar(pv || lagging(snap(), Date.now())); } catch (e) { } }
  function start() { tick(); setInterval(tick, 3000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
