/* simple-mode (Nov 1 2026, owner-approved critique plan item 3). UI only: no game rule reads this file and every page still works.
 * Simple mode = the top menu shows only Play / My Pets / Feed / Hatch / Live Feed, plus "Show everything". Battles, breeding, raids,
 * the Pantheon, the cemetery altar, Fire Sales and the Token Press (Places menu, Ranking and the rest) sit behind "Show everything",
 * and the Fire Sale banner, the "Places to go" card and the home page place cards are folded away. A page opened directly
 * (fight.html, breed.html, ...) still shows its own content in full.
 * Choice is remembered per device: localStorage 'xcpets-mode-v1' = 'simple' | 'all'. First visit: 'simple' for a new device,
 * 'all' for a device that already played here (wallet connected before, tutorial seen, or the old start card dismissed), so
 * nobody's menu changes under them. ?simple=1 / ?simple=0 previews either mode without saving it. Automated browsers
 * (navigator.webdriver: the test suite) default to 'all' and save nothing. */
(function () {
  'use strict';
  var d = document, KEY = 'xcpets-mode-v1';
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function flag() { var m = /[?&]simple=([01])/.exec(location.search); return m ? (m[1] === '1' ? 'simple' : 'all') : null; }
  function returning() { return !!(get('xcpets-xcpwallet-address') || get('xcpets-v2-wallet-provider') || get('xcpets-tut-seen') || get('xcpets-uxp-start')); }
  function mode() { var f = flag(); if (f) return f; var m = get(KEY); if (m === 'simple' || m === 'all') return m;
    if (navigator.webdriver) return 'all'; m = returning() ? 'all' : 'simple'; set(KEY, m); return m; }
  var page = (location.pathname.split('/').pop() || 'index.html') || 'index.html', onPlay = page === 'play.html';
  function css() { if (d.getElementById('xcSimpleCss')) return; var s = d.createElement('style'); s.id = 'xcSimpleCss';
    s.textContent = 'html.xc-simple header nav > :not(.xc-snav){display:none!important}' +
      'html.xc-simple #fireSale,html.xc-simple #splitGo,html.xc-simple #sceneCards{display:none!important}' +
      'html:not(.xc-simple) .xc-snav .xc-sl{display:none}' +
      '.xc-snav{display:contents}.xc-snav .xc-sm{font:inherit;font-size:12px;padding:3px 9px;border-radius:999px;border:1px solid rgba(255,255,255,.35);background:transparent;color:inherit;cursor:pointer;white-space:nowrap;margin-left:4px}' +
      'html.xc-simple .xc-snav .xc-sm{border-color:#ffc93c;color:#ffc93c}';
    (d.head || d.documentElement).appendChild(s); }
  function link(href, txt, cls) { var a = d.createElement('a'); a.href = href; a.className = 'xc-sl' + (cls ? ' ' + cls : ''); a.textContent = txt; return a; }
  function apply(m) { d.documentElement.classList.toggle('xc-simple', m === 'simple'); var b = d.querySelector('.xc-snav .xc-sm');
    if (b) { b.textContent = m === 'simple' ? 'Show everything ▾' : 'Simple menu'; b.setAttribute('aria-pressed', m === 'simple' ? 'false' : 'true'); b.title = m === 'simple' ? 'Show battles, breeding, raids, the Pantheon, the altar, Fire Sales and the Token Press' : 'Show only Play, My Pets, Feed, Hatch and Live Feed'; } }
  function build() { var nav = d.querySelector('header nav'); if (!nav || nav.querySelector('.xc-snav')) return;
    var w = d.createElement('span'); w.className = 'xc-snav'; var P = onPlay ? '' : 'play.html';
    w.appendChild(link(onPlay ? '#top' : 'play.html', '🥚 Play', 'navplay-s')); w.appendChild(link(P + '#petsPanel', 'My Pets')); w.appendChild(link(P + '#petsPanel', 'Feed'));
    w.appendChild(link(P + '#hatchPanel', 'Hatch')); w.appendChild(link('live.html', 'Live Feed'));
    var b = d.createElement('button'); b.type = 'button'; b.className = 'xc-sm';
    b.onclick = function () { var m = d.documentElement.classList.contains('xc-simple') ? 'all' : 'simple'; set(KEY, m); apply(m); }; w.appendChild(b);
    nav.insertBefore(w, nav.firstChild); apply(mode()); }
  css(); var m0 = mode(); d.documentElement.classList.toggle('xc-simple', m0 === 'simple');
  window.XCSimple = { KEY: KEY, mode: mode, apply: apply };
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', build); else build();
})();
