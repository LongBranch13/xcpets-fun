/* nav-shop (2026-10-24, owner): two more place cards in the home #sceneCards row: Spam City Games (shop.html) and the Pet Cemetery
 * (cemetery.html). Same .scard look as the Arena / Rare Room / Motel cards; small static 8-bit canvases. Display only. */
(function () {
  'use strict';
  var W = 320, H = 180;
  function R(x, c, a, b, w, h) { x.fillStyle = c; x.fillRect(a, b, w, h); }
  function img(src, cb) { var i = new Image(); i.onload = function () { cb(i); }; i.src = src; }
  function shop(c) { var x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    R(x, '#1a1033', 0, 0, W, H); for (var i = 0; i < 40; i++) R(x, '#fff6c8', (i * 73) % W, (i * 37) % 60, 1, 1);
    var bl = [[0, 70, 40], [36, 50, 34], [66, 80, 46], [250, 60, 38], [284, 44, 36]]; bl.forEach(function (b) { R(x, '#2b1f4d', b[0], b[1], b[2], H - b[1]); for (var yy = b[1] + 6; yy < 150; yy += 12) for (var xx = b[0] + 5; xx < b[0] + b[2] - 4; xx += 10) R(x, (xx + yy) % 3 ? '#ffd166' : '#3a2d63', xx, yy, 4, 5); });
    R(x, '#3b2a1a', 100, 40, 140, 115); R(x, '#000', 100, 40, 140, 3); R(x, '#5b3a22', 100, 128, 140, 27); R(x, '#000', 100, 128, 140, 2);
    R(x, '#0b0a1f', 112, 62, 116, 64); R(x, '#000', 0, 155, W, 25); R(x, '#241a12', 0, 157, W, 23);
    img('img/shop/luke-spam-jr-240.png', function (i) { var h = 70, w = Math.round(i.width * h / i.height); x.drawImage(i, 170 - w / 2, 126 - h + 6, w, h); R(x, '#5b3a22', 100, 128, 140, 27); R(x, '#000', 100, 128, 140, 2);
      img('img/shop/spam-city-sign-classic-final-2x.png', function (s) { var sw = 150, sh = Math.round(s.height * sw / s.width); if (sh > 46) { sh = 46; sw = Math.round(s.width * sh / s.height); } x.drawImage(s, 170 - sw / 2, 8, sw, sh); }); }); }
  function cem(c) { var x = c.getContext('2d');
    R(x, '#0b0a1f', 0, 0, W, H); for (var i = 0; i < 50; i++) R(x, '#cfd6ff', (i * 71) % W, (i * 29) % 90, 1, 1);
    x.fillStyle = '#fff6c8'; x.beginPath(); x.arc(260, 36, 18, 0, 7); x.fill(); x.fillStyle = '#0b0a1f'; x.beginPath(); x.arc(252, 30, 16, 0, 7); x.fill();
    R(x, '#14301f', 0, 120, W, 60); R(x, '#000', 0, 120, W, 2);
    for (var f = 0; f < W; f += 12) { R(x, '#2a2a3a', f, 98, 3, 24); } R(x, '#2a2a3a', 0, 104, W, 2);
    [[40, 112, 1], [100, 126, .8], [160, 108, 1.2], [226, 124, .9], [276, 114, 1]].forEach(function (g) { var w = 30 * g[2], h = 38 * g[2], a = g[0] - w / 2, b = g[1] - h;
      R(x, '#000', a - 2, b - 2, w + 4, h + 4); R(x, '#8a8aa0', a, b, w, h); R(x, '#a8a8c0', a, b, w, 3); R(x, '#5a5a70', a + w - 3, b, 3, h); R(x, '#3a2a1a', a - 4, g[1], w + 8, 4);
      R(x, '#2a2a3a', a + w / 2 - 1, b + 6, 2, 12 * g[2]); R(x, '#2a2a3a', a + w / 2 - 6 * g[2], b + 10, 12 * g[2], 2); });
    x.font = '10px "Press Start 2P", monospace'; x.fillStyle = '#4fd18b'; x.textAlign = 'center'; x.fillText('R.I.P.', 160, 160); }
  function mount() { var row = document.getElementById('sceneCards'); if (!row) return;
    [['spamcity', shop], ['cemetery', cem]].forEach(function (d) { var c = row.querySelector('canvas[data-scene="' + d[0] + '"]'); if (c) try { d[1](c); } catch (e) { if (window.console) console.error(e); } });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { var c = row.querySelector('canvas[data-scene="cemetery"]'); if (c) cem(c); }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
