/* front-page-entries (2026-10-19, DRAFT, not live): three small 8-bit scene cards under the home hero buttons.
 * Arena = the real X Circus Kekimus scene (V2ArenaScene.mount: sand + today's champion statue, longest current unbeaten streak from the replayed
 * fights, "AWAITING A CHAMPION" if none). Rare Room = the Pepe Wheel (V2Shop.drawWheel) on the marble floor. Gooby's No-Tail Motel = neon
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
  /* Rare Room front card (owner Oct 21 2026, palette A 'Royal Vault'): velvet gallery wall, rose window, gilded frames, marble floor, the Pepe Wheel */
  function lair(x, t) { x.imageSmoothingEnabled = false; var G = '#e8b84a', GH = '#fff1a8', V = '#9b1035', i, j; px(x, '#2a0f4a', 0, 0, W, 124);
    for (i = 0; i < W; i += 12) for (j = 12; j < 120; j += 14) { px(x, '#3b1766', i + 5, j, 2, 6); px(x, '#3b1766', i + 3, j + 2, 6, 2); }
    px(x, '#000', 0, 0, W, 5); px(x, G, 0, 0, W, 3); px(x, V, 0, 4, W, 1);
    var cx = 160, cy = 30, J = ['#d0284f', '#1fb5a5', '#e8b84a', '#7b3fe4', '#2f6fe0']; x.fillStyle = '#000'; x.beginPath(); x.arc(cx, cy, 23, 0, 7); x.fill(); x.fillStyle = G; x.beginPath(); x.arc(cx, cy, 22, 0, 7); x.fill();
    for (i = 0; i < 12; i++) { x.fillStyle = J[i % 5]; x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, 20, i * Math.PI / 6, (i + 1) * Math.PI / 6); x.fill(); } x.fillStyle = '#bfe9d6'; x.beginPath(); x.arc(cx, cy, 10, 0, 7); x.fill();
    px(x, '#000', 92, 58, 136, 18); px(x, V, 93, 59, 134, 16); px(x, G, 93, 59, 134, 2); px(x, G, 93, 73, 134, 2); x.textAlign = 'center'; x.font = '9px "Press Start 2P", monospace'; x.fillStyle = GH; x.fillText('THE RARE ROOM', 160, 71); x.textAlign = 'left';
    var T = ['#9aa3b5', '#4fd18b', '#4f9dff', '#ffc93c']; [[10, 18], [10, 64], [244, 18], [244, 64]].forEach(function (s, n) { for (var k = 0; k < 3; k++) { var a = s[0] + k * 22, b = s[1]; px(x, '#000', a - 2, b - 2, 20, 28); px(x, G, a - 1, b - 1, 18, 26); px(x, T[(n + k) % 4], a, b, 16, 24); px(x, '#1c0f33', a + 2, b + 3, 12, 14); px(x, J[(n * 3 + k) % 5], a + 5, b + 7, 6, 6); } });
    for (j = 124, i = 0; j < H; j += 8, i++) for (var k2 = 0; k2 < W; k2 += 16) px(x, ((k2 / 16 + i) % 2) ? '#efe8f6' : '#1c0f33', k2, j, 16, 8); px(x, '#000', 0, 122, W, 3); px(x, G, 0, 122, W, 1);
    x.save(); x.scale(2, 2); if (window.V2Shop && V2Shop.drawWheel) V2Shop.drawWheel(x, 80, 60, 15, reduced() ? 0 : t / 900, null); x.restore(); }
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
