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
  /* stale-copy-fix (2026-10-26): how far the shown copy is behind the newest tip we know of (mempool.space / the game feed). Pure. */
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function behind(s) { if (!s || !s.dataTip) return 0; var ref = Math.max(s.chainTip || 0, s.feedTip || 0); return ref > s.dataTip ? ref - s.dataTip : 0; }
  function behindText(s) { var b = behind(s); return b ? 'Showing block ' + fmt(s.dataTip) + ', ' + fmt(b) + ' block' + (b === 1 ? '' : 's') + ' behind the tip.' : ''; }
  function note(rows, s) { var b = behind(s); return 'Replayed from ' + fmt(rows) + ' XCPETS burns on chain at block ' + fmt(s.dataTip) + (b ? ' (' + fmt(b) + ' block' + (b === 1 ? '' : 's') + ' behind the tip, catching up)' : '') + '.'; }
  var api = { lagging: lagging, TEXT: TEXT, LAG_MS: LAG_MS, LAG_BLOCKS: LAG_BLOCKS, behind: behind, behindText: behindText, note: note };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  window.V2DataLag = api;
  var M = window.V2Mock; if (!M || !M.state) return;
  var pv = /[?&]preview=datalag\b/.test(location.search);
  function snap() { var S = M.state() || {}, F = (window.V2Sales && window.V2Sales.feed) || {};
    return { dataTip: S.tip, dataAt: S.dataAt, verified: !!S.verified, chainTip: S.chainTip, feedTip: Math.max(F.tip || 0, S.feedTip || 0) || undefined, feedAt: F.at }; }
  function bar(on, sn) { var el = document.getElementById('dataLagBar'); if (!on) { if (el) el.remove(); return; }
    if (el) { var q = el.querySelector('.dl-behind'); if (q) q.textContent = sn ? behindText(sn) : ''; return; }
    el = document.createElement('div'); el.id = 'dataLagBar'; el.className = 'halving-ribbon data-lag'; el.setAttribute('role', 'status');
    el.innerHTML = '<b>⏳ Catching up</b> <span></span> <span class="dl-behind"></span>'; el.querySelector('span').textContent = TEXT; el.querySelector('.dl-behind').textContent = sn ? behindText(sn) : '';
    var nav = document.querySelector('nav, .nav, header'), host = document.querySelector('main') || document.body;
    if (nav && nav.parentNode) nav.parentNode.insertBefore(el, nav.nextSibling); else host.insertBefore(el, host.firstChild); }
  function tick() { if (document.getElementById('v2boot') || !(M.state().rows || []).length) return; /* wait for the page's own boot */ try { var sn = snap(); bar(pv || lagging(sn, Date.now()), sn);
    var cn = document.getElementById('crNote'); if (cn && /^Replayed from /.test(cn.textContent)) { var t = note((M.state().rows || []).length, sn); if (cn.textContent !== t) cn.textContent = t; } /* stale-copy-fix: keep #crNote in step with the shown copy */ } catch (e) { } }
  function start() { tick(); setInterval(tick, 3000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
