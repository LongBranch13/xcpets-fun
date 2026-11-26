/* boot-look (Nov 26 2026, Jake: "when you open xcpets.fun you see the regular site then a glitch happens and the doom layer kicks in").
 * Loaded WITHOUT defer in <head>, right after js/maintenance.js, so it runs before the browser paints anything. It decides the page's
 * look once, up front, so the first frame the player sees is already the right one:
 *   - Doom: puts html.dw on and writes the Doom stylesheet as a normal <link> (render-blocking, like style.css), and starts fetching
 *     js/doom-week.js now instead of after the page has finished. Before this the Doom look waited for the deferred scripts and,
 *     on Play, for the chain tip (2.8 s), so the regular site painted first and then "glitched" into Doom.
 * DISPLAY ONLY. This is the ONE Doom switch for the pages (js/v2-events.js and js/doom-week.js read XcpBootLook.doom).
 * To stop Doom: set DOOM to false here and bump this file's ?v= on every page. ?doom=1 / ?doom=0 still force it on / off.
 * Practice pages never get Doom (same as before). Nothing here reads or writes pet state, rules or the wallet. */
(function () {
  'use strict';
  var DOOM = true; /* Doom 2 (owner Nov 23 2026: "On until I say stop"); doom-week.js still keeps its START block */
  var d = document, root = d.documentElement, me = d.currentScript, ver = (me && /[?&]v=([\w.-]+)/.exec(me.src) || [])[1] || '';
  function flag(k) { var m = new RegExp('[?&]' + k + '=([01])\\b').exec(location.search); return m ? m[1] : null; }
  var practice = /practice/i.test(location.pathname || ''), df = flag('doom');
  var doom = !practice && df !== '0' && (df === '1' || DOOM);
  var q = ver ? '?v=' + ver : '';
  if (doom) {
    root.classList.add('dw');
    /* document.write while <head> is still being parsed = a parser-inserted stylesheet: the browser holds the first paint until it is
     * loaded, exactly like the page's own CSS. appendChild would NOT block the paint (that is the flash we are removing). */
    var css = '<link rel="stylesheet" id="dwCss" href="css/doom-week.css' + q + '">';
    try { if (d.readyState === 'loading') d.write(css); else throw 0; } catch (e) { var l = d.createElement('link'); l.rel = 'stylesheet'; l.id = 'dwCss'; l.href = 'css/doom-week.css' + q; d.head.appendChild(l); }
    /* the Doom script (candles, signs, showcase art): fetched now, runs as soon as the page is parsed */
    var s = d.createElement('script'); s.src = 'js/doom-week.js' + q; s.async = true; (d.head || root).appendChild(s);
  }
  window.XcpBootLook = { doom: doom, DOOM: DOOM, practice: practice };
})();
