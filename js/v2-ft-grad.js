/* FUNTRUMP presents the Big Beautiful Graduate card (PREVIEW, branch tutorial-funtrump-graduate, Oct 25 2026). Display only, no rule change.
 * FUNTRUMP = community pet #4, drawn from his in-game sprite (FuntrumpSprite.draw, Adult stage like the cast page, community suit look).
 * Plays once when all chapters are done (localStorage xcpets-tut-ftgrad), replay from the graduate card. Skip/Close button + Esc.
 * prefers-reduced-motion: no movement, the final pose shows at once. */
(function () {
  'use strict';
  var KEY = 'xcpets-tut-ftgrad', W = 160, H = 100, GOLD = '#f5c542', GOLD2 = '#c98a00', INK = '#000', CARD = '#1b1233', GREEN = '#5ad16a';
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function reduced() { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }
  var cache = {};
  function sprite(f) { /* 32x32 FUNTRUMP frame -> offscreen canvas with transparent background */
    if (cache[f]) return cache[f]; var S = window.FuntrumpSprite; if (!S) return null;
    var g = S.draw(3, f, {}), P = S.PAL, c = document.createElement('canvas'); c.width = c.height = 32; var x2 = c.getContext('2d');
    for (var y = 0; y < 32; y++) for (var x = 0; x < 32; x++) { var k = g[y][x]; if (!k) continue; x2.fillStyle = P[k] || k; x2.fillRect(x, y, 1, 1); }
    return (cache[f] = c); }
  function rect(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h); }
  function cap(c, x, y) { /* 9x6 pixel mortarboard */
    rect(c, x, y + 1, 9, 2, INK); rect(c, x + 1, y, 7, 1, INK); rect(c, x + 2, y + 3, 5, 3, INK); rect(c, x + 7, y + 2, 1, 3, GOLD); rect(c, x + 7, y + 5, 2, 1, GOLD); }
  function card(c, x, y, glow) { /* gold-framed graduate card, 40x28 */
    rect(c, x - 1, y - 1, 42, 30, INK); rect(c, x, y, 40, 28, glow ? GOLD : GOLD2); rect(c, x + 2, y + 2, 36, 24, GOLD); rect(c, x + 3, y + 3, 34, 22, CARD);
    [[x + 1, y + 1], [x + 37, y + 1], [x + 1, y + 25], [x + 37, y + 25]].forEach(function (p) { rect(c, p[0], p[1], 2, 2, '#fff7d6'); });
    cap(c, x + 15, y + 6); for (var i = 0; i < 5; i++) rect(c, x + 8 + i * 5, y + 16, 3, 2, GOLD); rect(c, x + 10, y + 20, 20, 1, '#8a7a4a'); }
  function bg(c, t) {
    rect(c, 0, 0, W, H, '#141024'); for (var i = 0; i < 18; i++) { var sx = (i * 37) % W, sy = (i * 23) % 60; if (((t / 300 | 0) + i) % 4) rect(c, sx, sy, 1, 1, '#3a2d5c'); }
    rect(c, 0, 82, W, 18, '#1f2a44'); for (var x = 0; x < W; x += 8) rect(c, x, 82, 4, 1, '#2c3a5e'); rect(c, 0, 81, W, 1, INK);
    rect(c, 20, 30, 120, 3, '#2a1f44'); for (var b = 0; b < 12; b++) rect(c, 24 + b * 10, 33, 5, 4, b % 2 ? GOLD2 : GREEN); } /* bunting */
  var CONF = []; for (var q = 0; q < 40; q++) CONF.push({ x: (q * 53) % W, v: 0.02 + (q % 5) * 0.008, d: (q * 97) % 1000, col: [GOLD, GREEN, '#fff7d6', '#7fd8ff'][q % 4] });
  /* timeline (ms): 0-1500 walk in, 1500-2300 lift the card, 2300+ confetti + idle */
  function scene(c, t, still) {
    c.imageSmoothingEnabled = false; if (still) t = 3200; bg(c, t);
    var walk = Math.min(1, t / 1500), fx = Math.round(-40 + walk * 70), fy = 50 + (walk < 1 && ((t / 120 | 0) % 2) ? -1 : 0);
    var f = walk < 1 ? (t / 150 | 0) % 4 : ((t / 400 | 0) % 4), s = sprite(f); if (s) c.drawImage(s, fx, fy - 18, 64, 64);
    var lift = Math.max(0, Math.min(1, (t - 1500) / 800)), cx = fx + 52, cy = Math.round(78 - lift * 36);
    if (t > 1500) card(c, cx, cy, t > 2300 && ((t / 250 | 0) % 2));
    if (t > 2300) CONF.forEach(function (p) { var y = ((t - 2300 + p.d) * p.v) % 90; rect(c, (p.x + Math.sin((t + p.d) / 300) * 3 + W) % W, y, 2, 2, p.col); });
    return t > 2300; }
  var open = null;
  function close() { if (!open) return; cancelAnimationFrame(open.raf); document.removeEventListener('keydown', open.key); open.el.remove(); var f = open.focus; open = null; if (f && f.focus) f.focus(); }
  function play() {
    if (open) close(); if (!window.FuntrumpSprite) return false; ls(KEY, '1');
    var still = reduced(), o = document.createElement('div'); o.className = 'ftg-ov'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', 'FUNTRUMP presents your Big Beautiful Graduate card');
    o.innerHTML = '<div class="ftg-box"><button type="button" class="ftg-x" aria-label="Skip">Skip ✕</button><canvas class="ftg-cv tut-px" width="' + W + '" height="' + H + '"></canvas>' +
      '<div class="ftg-cap"><b>🎓 Big Beautiful Graduate</b><span>FUNTRUMP, community pet #4, presents your gold frame. Every chapter done!</span></div><button type="button" class="btn ftg-ok">Close</button></div>';
    document.body.appendChild(o); var cv = o.querySelector('canvas'), c = cv.getContext('2d'), t0 = performance.now(), x = o.querySelector('.ftg-x');
    c.imageSmoothingEnabled = false; open = { el: o, raf: 0, focus: document.activeElement, key: function (e) { if (e.key === 'Escape') close(); } };
    document.addEventListener('keydown', open.key); o.addEventListener('click', function (e) { if (e.target === o) close(); });
    x.onclick = close; o.querySelector('.ftg-ok').onclick = close; if (still) o.classList.add('still', 'done');
    (function tick(now) { if (!open || open.el !== o) return; var done = scene(c, (now || t0) - t0, still); if (done) { o.classList.add('done'); x.textContent = 'Close ✕'; x.setAttribute('aria-label', 'Close'); } if (!still) open.raf = requestAnimationFrame(tick); })(t0);
    x.focus(); return true; }
  window.V2FtGrad = { play: play, close: close, seen: function () { return ls(KEY) === '1'; }, playOnce: function () { return ls(KEY) === '1' ? false : play(); }, _scene: scene, W: W, H: H };
})();
