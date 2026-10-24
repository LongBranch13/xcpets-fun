/* ELECTRIC SHOCK BOX fence (preview, electric-eggs): an 8-bit electric fence drawn on a canvas around #zapBtn. Posts + 2 wires, a lightning arc
 * jumps between two posts with crackling sparks every 1-2 s, and a big ZAP flash on hover / tap and when a pet:hatchzap burn is confirmed
 * (window event 'xcpets:zap'). No animation loop: it only draws while an arc or flash is live, at 12 fps, so phones stay light.
 * prefers-reduced-motion: the fence is drawn once, still. Display only, never touches replay. */
(function () {
  'use strict';
  var cv = document.getElementById('zapCv'), box = document.getElementById('zapFence'), btn = document.getElementById('zapBtn'); if (!cv || !box || !btn) return;
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches, P = 4, ctx = cv.getContext('2d'), W = 0, H = 0, posts = [], live = null, timer = null;
  function px(x, y, c, s) { ctx.fillStyle = c; ctx.fillRect(Math.round(x / P) * P, Math.round(y / P) * P, s || P, s || P); }
  function size() { var r = box.getBoundingClientRect(); W = Math.max(40, Math.round(r.width / P) * P); H = Math.max(40, Math.round(r.height / P) * P); cv.width = W; cv.height = H;
    var n = Math.max(3, Math.round(W / 64)); posts = []; for (var i = 0; i <= n; i++) posts.push(Math.round((P + i * (W - 3 * P) / n) / P) * P); }
  function fence(dim) { ctx.clearRect(0, 0, W, H); var wc = dim ? '#5b5a3a' : '#c9b84a';
    [P * 2, H - P * 3].forEach(function (y) { for (var x = 0; x < W; x += P * 2) px(x, y, wc); }); /* dashed pixel wires top + bottom */
    posts.forEach(function (x) { ctx.fillStyle = '#6b4a2b'; ctx.fillRect(x, 0, P, P * 4); ctx.fillRect(x, H - P * 4, P, P * 4); px(x, 0, '#9a6b3c'); px(x, H - P * 4, '#9a6b3c'); }); }
  function bolt(x1, y, x2, c) { var x = x1, yy = y; while (x < x2) { var nx = Math.min(x2, x + P * (1 + (Math.random() * 3 | 0))), ny = y + (Math.random() * 5 - 2 | 0) * P;
      for (var t = x; t <= nx; t += P) px(t, yy + (ny - yy) * (t - x) / Math.max(P, nx - x), c); x = nx; yy = ny; } }
  function sparks(x, y, k) { for (var i = 0; i < k; i++) px(x + (Math.random() * 7 - 3 | 0) * P, y + (Math.random() * 7 - 3 | 0) * P, Math.random() < .5 ? '#fff' : '#7df9ff'); }
  function frame() { var dim = btn.disabled; fence(dim); if (!live) return; var f = live.f++;
    if (live.big) { var a = Math.max(0, .55 - f * .07); ctx.fillStyle = 'rgba(125,249,255,' + a + ')'; ctx.fillRect(0, 0, W, H);
      for (var i = 0; i + 1 < posts.length; i++) { bolt(posts[i], P * 2, posts[i + 1], f % 2 ? '#fff' : '#ffe94a'); bolt(posts[i], H - P * 3, posts[i + 1], f % 2 ? '#ffe94a' : '#fff'); }
      if (f < 3) { ctx.fillStyle = '#ffe94a'; ctx.font = 'bold ' + (P * 4) + 'px "Press Start 2P", monospace'; ctx.textAlign = 'right'; ctx.fillText('ZAP!', W - P * 2, P * 7); } }
    else { var y = live.top ? P * 2 : H - P * 3; bolt(posts[live.i], y, posts[live.i + 1], f % 2 ? '#fff' : '#ffe94a'); sparks(posts[live.i + (f % 2)], y, 5); }
    if (live.f >= live.n) { live = null; fence(dim); return; } setTimeout(frame, 83); }
  function arc(big) { if (still) return; live = big ? { big: 1, f: 0, n: 8 } : { i: Math.random() * (posts.length - 1) | 0, top: Math.random() < .5, f: 0, n: 4 }; frame(); }
  function loop() { clearTimeout(timer); timer = setTimeout(function () { if (!document.hidden && !live) arc(false); loop(); }, 1000 + Math.random() * 1000); }
  size(); fence(btn.disabled); if (!still) loop();
  window.addEventListener('resize', function () { size(); fence(btn.disabled); });
  box.addEventListener('mouseenter', function () { arc(true); }); box.addEventListener('pointerdown', function () { arc(true); });
  window.addEventListener('xcpets:zap', function () { arc(true); setTimeout(function () { arc(true); }, 900); });
  window.XCPETS_ZAP = arc; /* preview / screenshots */
})();
