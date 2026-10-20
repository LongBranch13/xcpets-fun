/* front-page-entries (2026-10-19, DRAFT, not live): three small 8-bit scene cards under the home hero buttons.
 * Arena = the real X Circus Kekimus scene (V2ArenaScene.mount: sand + today's champion statue, longest current unbeaten streak from the replayed
 * fights, "AWAITING A CHAMPION" if none). Lair = Captain Dan (V2Shop.drawDan, faces left, rest pose) behind his counter. Gooby's No-Tail Motel = neon
 * (V2Motel.neon) with a flickering VACANCY and Gooby (V2Motel.drawGooby, GOOBY-token look) at the desk. Each card is a plain link to its scene.
 * prefers-reduced-motion: static frames. Display only. */
(function () {
  'use strict';
  /* ONE place for the front-page breeding name (owner spelling pending): nav, card label, footer ([data-fp-name=motel]) and the card's neon sign */
  var MOTEL_NAME = 'Gooby\u2019s No-Tail Motel', SIGN = ['GOOBY\u2019S', 'NO-TAIL MOTEL'];
  var W = 320, H = 180, RM = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function reduced() { return !!RM.matches || !!window.__frontReduced; }
  /* bugpass-fixes: cards use js/v2-sharp.js (integer-k backing store, logical 320x180 drawing) like the scenes; small() = drawn below 1:1 */
  function small(c) { var r = c.getBoundingClientRect(); return r.width > 0 && r.width * (window.devicePixelRatio || 1) < W - 0.5; }
  function px(x, c, a, b, w, h) { x.fillStyle = c; x.fillRect(a, b, w, h); }
  function lair(x, t) { x.imageSmoothingEnabled = false; px(x, '#2a1d14', 0, 0, W, H);
    for (var y = 0; y < 120; y += 8) for (var b = (y / 8 % 2) * -8; b < W; b += 16) px(x, (y + b) % 3 ? '#3a2a1e' : '#35261b', b + 1, y + 1, 14, 6);
    /* bugpass-fixes: red sign centred and 300 px wide so the whole sign (and its sub-line) sits inside the card art on phones; the 6 px sub-line is
     * dropped when the card is drawn below 1 art px per device px (desktop DPR 1), where it could only be a smudge; the card label has the full name */
    var sm = small(x.canvas); px(x, '#000', 12, 7, 300, 26); px(x, '#c8102e', 10, 6, 300, 24); px(x, '#ffd166', 10, 6, 300, 2); px(x, '#ffd166', 10, 28, 300, 2);
    x.textAlign = 'center'; x.fillStyle = '#ffd166'; if (sm) { x.font = '12px "Press Start 2P", monospace'; x.fillText('THE XCPETS LAIR', 160, 24); }
    else { x.font = '9px "Press Start 2P", monospace'; x.fillText('THE XCPETS LAIR OF', 160, 17); x.font = '6px "Press Start 2P", monospace'; x.fillStyle = '#fff6c8'; x.fillText('LOCKS\u00b7LEVERAGE\u00b7LAYERS\u00b7LUSTER\u00b7LOOKS & LEATHERS', 160, 26); } x.textAlign = 'left';
    [[8, 44], [8, 80], [236, 44], [236, 80]].forEach(function (s, i) { px(x, '#7a4f2a', s[0], s[1] + 18, 76, 4); px(x, '#5a3a1e', s[0], s[1] + 22, 76, 2);
      for (var k = 0; k < 4; k++) px(x, ['#ffd166', '#9fe8ff', '#ff5d5d', '#3ddc84', '#e9e1cf'][(i + k) % 5], s[0] + 6 + k * 18, s[1] + 6, 10, 12); });
    x.save(); x.scale(2, 2); if (window.V2Shop && V2Shop.drawDan) V2Shop.drawDan(x, 64, 27, reduced() ? 0 : t); x.restore();
    px(x, '#7a4f2a', 70, 118, 180, 12); px(x, '#5a3a1e', 70, 130, 180, 34); px(x, '#ffd166', 70, 118, 180, 2);
    px(x, '#4a3626', 0, 164, W, 16); for (var f = 0; f < W; f += 20) px(x, '#3c2b1e', f, 164, 1, 16); }
  function motel(x, t) { x.imageSmoothingEnabled = false; var rm = reduced(), M = window.V2Motel; px(x, '#0b0a1f', 0, 0, W, H);
    for (var i = 0; i < 40; i++) px(x, '#c9c9ff', (i * 53) % W, (i * 29) % 70, 1, 1); px(x, '#f5efc0', 290, 10, 12, 12); px(x, '#0b0a1f', 295, 9, 9, 11);
    px(x, '#444', 66, 70, 4, 100); px(x, '#1a1a2a', 6, 8, 184, 46); px(x, '#000', 6, 8, 184, 3);
    if (M && M.neon) { M.neon(x, SIGN[0], 98, 28, '#ff4fd8', true, 13); M.neon(x, SIGN[1], 98, 48, '#4fe0ff', true, 13); }
    px(x, '#1a1a2a', 20, 58, 148, 20); var on = rm ? true : (Math.floor(t / 400) % 5 !== 0 && Math.floor(t / 90) % 23 !== 0);
    if (M && M.neon) M.neon(x, 'VACANCY', 94, 74, '#7dff6a', on, 12);
    px(x, '#e8a0b4', 120, 96, 200, 70); px(x, '#5a3a4a', 116, 92, 208, 5);
    px(x, '#f2d7a0', 150, 104, 100, 62); [150, 244].forEach(function (cx) { px(x, '#f5efe0', cx, 100, 6, 66); });
    px(x, '#1a2b4a', 166, 110, 68, 38); x.save(); x.translate(178, 112); x.scale(2, 2); if (M && M.drawGooby) M.drawGooby(x, 0, 0, rm ? 0 : t); x.restore();
    px(x, '#7a4f2a', 160, 146, 80, 6); x.font = '6px "Press Start 2P", monospace'; x.fillStyle = '#5a3a1e'; x.fillText('OFFICE', 182, 162);
    px(x, '#2e8a8a', 268, 120, 24, 46); px(x, '#ffd166', 286, 142, 2, 2); px(x, '#2a2a33', 0, 166, W, 14); }
  var cards = [], raf = 0, io = null;
  function paint(o, now) { if (window.V2Sharp) V2Sharp.begin(o.x, o.k); o.draw(o.x, now); }
  function refit() { cards.forEach(function (o) { if (window.V2Sharp) o.k = V2Sharp.fit(o.c, W, H); paint(o, performance.now()); }); }
  function loop(now) { raf = 0; var any = false; cards.forEach(function (c) { if (c.vis) { paint(c, now); any = true; } }); if (any && !reduced()) raf = requestAnimationFrame(loop); }
  function kick() { if (!raf) raf = requestAnimationFrame(loop); }
  function mount() { document.querySelectorAll('[data-fp-name="motel"]').forEach(function (e) { e.textContent = MOTEL_NAME; }); var row = document.getElementById('sceneCards'); if (!row) return;
    [['lair', lair], ['motel', motel]].forEach(function (d) { var c = row.querySelector('canvas[data-scene="' + d[0] + '"]'); if (!c) return; var o = { c: c, x: c.getContext('2d'), draw: d[1], vis: true, k: window.V2Sharp ? V2Sharp.fit(c, W, H) : 1 };
      cards.push(o); paint(o, performance.now()); if (window.IntersectionObserver) { io = io || new IntersectionObserver(function (es) { es.forEach(function (e) { cards.forEach(function (k) { if (k.c === e.target) k.vis = e.isIntersecting; }); }); kick(); }); io.observe(c); } });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { cards.forEach(function (o) { paint(o, performance.now()); }); });
    if (window.V2Sharp && cards.length) V2Sharp.watch(refit);
    if (!reduced()) kick();
    var ac = row.querySelector('canvas[data-scene="arena"]'), M = window.V2Mock;
    if (ac && window.V2ArenaScene && M && M.world) { try { V2ArenaScene.mount(ac, M.world(), { thumb: true }); } catch (e) { if (window.console) console.error(e); } } }
  window.V2FrontCards = { MOTEL_NAME: MOTEL_NAME, mount: mount, _lair: lair, _motel: motel };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
