/* instant-cached-state (Nov 1 2026, owner-approved critique plan item 2). UI only: no game rule reads this file, and burns stay locked
 * exactly as before (js/v2-chain.js whenRead / S.verified). While the page reads the chain:
 *  - counters still showing "…" are filled at once from the saved game feed (api/meta.json, a 2 KB file the feed bot writes every block)
 *    and tagged "as of block N"; when the page's own read replaces them the tag turns into "✓ checked, block M" once the live chain
 *    read is verified (V2Mock.state().verified), or keeps "as of block M (game feed)" while the chain servers can't be reached;
 *  - any other "…" value gets a quiet skeleton block instead of dots;
 *  - list status lines that say "Reading the chain…" name the saved block and get 3 skeleton rows until the list draws. */
(function () {
  'use strict';
  var d = document, META = null, T0 = Date.now();
  var FILL = { cBurned: function (m) { return m.burnedXCPETS; }, cGame: function (m) { return m.burns; }, cPets: function (m) { return m.totalPets; },
    ptN: function (m) { return m.totalPets; }, crBurns: function (m) { return m.burns; }, crPets: function (m) { return m.totalPets; } };
  var TAGS = [['counter', 'cPets'], ['petTotal', 'ptN'], ['crPets', 'crPets']]; /* where the "as of block" tag sits: [host id, value id] */
  var STATUS = ['status', 'lvStatus', 'hybStatus', 'archList'];
  function fmt(n) { n = Number(n); return n.toLocaleString('en-US', { maximumFractionDigits: Math.abs(n) >= 1 || n === 0 ? 2 : 8 }); }
  function css() { if (d.getElementById('xcCachedCss')) return; var s = d.createElement('style'); s.id = 'xcCachedCss';
    s.textContent = '@keyframes xcsk{0%{background-position:-120px 0}100%{background-position:120px 0}}' +
      '.xc-sk{display:inline-block;min-width:3.2em;border-radius:6px;color:transparent!important;background:linear-gradient(90deg,rgba(255,255,255,.06),rgba(255,255,255,.16),rgba(255,255,255,.06)) 0 0/240px 100%;animation:xcsk 1.4s linear infinite}' +
      '.xc-skrows{display:grid;gap:8px;margin:8px 0}.xc-skrows i{display:block;height:38px;border-radius:10px;background:linear-gradient(90deg,rgba(255,255,255,.05),rgba(255,255,255,.12),rgba(255,255,255,.05)) 0 0/240px 100%;animation:xcsk 1.4s linear infinite}' +
      '.xc-asof{display:inline-block;margin-left:6px;padding:0 7px;border-radius:999px;font-size:11px;line-height:1.6;color:#c9c3e0;background:rgba(255,255,255,.08);white-space:nowrap}.xc-asof.ok{color:#9ff0b4;background:rgba(60,200,110,.14)}' +
      '@media (prefers-reduced-motion:reduce){.xc-sk,.xc-skrows i{animation:none}}';
    (d.head || d.documentElement).appendChild(s); }
  function dots(el) { return el && /^\s*(…|\.\.\.)\s*$/.test(el.textContent); }
  function watch(el, fn) { try { new MutationObserver(fn).observe(el, { childList: true, characterData: true, subtree: true }); } catch (e) {} }
  function state() { try { return window.V2Mock && V2Mock.state ? V2Mock.state() : null; } catch (e) { return null; } }
  function skeletons() { var main = d.querySelector('main') || d.body, a = main.querySelectorAll('b, span, strong, em, td');
    for (var i = 0; i < a.length; i++) (function (el) { if (el.children.length || !dots(el) || FILL[el.id] || el.classList.contains('xc-sk')) return;
      el.classList.add('xc-sk'); el.setAttribute('aria-busy', 'true'); watch(el, function () { if (!dots(el)) { el.classList.remove('xc-sk'); el.removeAttribute('aria-busy'); } }); })(a[i]); }
  function statusRows() { STATUS.forEach(function (id) { var el = d.getElementById(id); if (!el) return; var p = id === 'archList' ? el.querySelector('p') : el;
    if (!p) return; if (p._xc) { p._xc(); return; } if (!/^\s*Reading the chain…\s*$/.test(p.textContent)) return;
    var sk = d.createElement('div'); sk.className = 'xc-skrows'; sk.setAttribute('aria-hidden', 'true'); sk.innerHTML = '<i></i><i></i><i></i>';
    p.parentNode.insertBefore(sk, p.nextSibling); var mine = p.textContent, host = p.parentNode;
    function drop() { if (sk.parentNode) sk.parentNode.removeChild(sk); p._xc = function () {}; }
    p._xc = function () { if (META && META.blockHeight && p.isConnected && p.textContent === mine) { mine = 'Saved game feed, as of block ' + fmt(META.blockHeight) + '. Reading the latest burns…'; p.textContent = mine; } };
    p._xc(); watch(host, function () { if (!p.isConnected || p.textContent !== mine) drop(); }); setTimeout(drop, 90000); }); }
  function tagFor(host, vid) { var t = d.getElementById('xcAsOf-' + vid); if (t) return t; var h = d.getElementById(host); if (!h) return null;
    t = d.createElement('span'); t.id = 'xcAsOf-' + vid; t.className = 'xc-asof'; t.setAttribute('aria-live', 'polite');
    if (host === vid) h.parentNode.insertBefore(t, h.nextSibling); else h.appendChild(t); return t; }
  var filled = {};
  function fill() { if (!META) return; Object.keys(FILL).forEach(function (id) { var el = d.getElementById(id); if (!el || !dots(el)) return; var v = FILL[id](META); if (v == null) return;
      el.classList.remove('xc-sk'); el.removeAttribute('aria-busy'); el.textContent = fmt(v); filled[id] = el.textContent; });
    TAGS.forEach(function (x) { if (filled[x[1]]) { var t = tagFor(x[0], x[1]); if (t && !t.className.match(/\bok\b/)) t.textContent = 'as of block ' + fmt(META.blockHeight); } }); }
  function upd() { var S = state(); TAGS.forEach(function (x) { var t = d.getElementById('xcAsOf-' + x[1]), el = d.getElementById(x[1]); if (!t || !el) return;
      if (dots(el)) { if (META) { el.textContent = fmt(FILL[x[1]](META)); filled[x[1]] = el.textContent; } t.className = 'xc-asof'; t.textContent = 'as of block ' + fmt(META ? META.blockHeight : 0); return; }
      if (S && S.verified && S.tip && !S.stale) { t.className = 'xc-asof ok'; t.textContent = '✓ checked, block ' + fmt(S.tip); t.title = 'The live chain read agrees: this is the current chain state.'; }
      else if (S && S.tip && el.textContent !== filled[x[1]]) { t.className = 'xc-asof'; t.textContent = 'as of block ' + fmt(S.tip) + ' (game feed)'; t.title = 'From the game feed. Burns wait until the chain servers answer.'; } }); }
  function start() { css(); skeletons(); statusRows();
    try { fetch('api/meta.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (m) { if (m && m.blockHeight) { META = m; fill(); statusRows(); upd(); } }, function () {}); } catch (e) {}
    window.addEventListener('xcpets-world-fresh', upd); var iv = setInterval(function () { upd(); if (Date.now() - T0 > 180000) clearInterval(iv); }, 2500); }
  window.XCCached = { fill: fill, upd: upd, meta: function () { return META; } };
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start); else start();
})();
