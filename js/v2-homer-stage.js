/* HOMER'S STAGE (Nov 26 2026, Jake: "make Homer's part in the Pantheon better: his stories and animations"). DISPLAY ONLY.
 * The bard corner of the Pantheon Odyssey: a small pixel stage (red curtains, spotlight, wooden boards) where Homer Pepe (community
 * pet #5, his own Mythic sprite from js/homer-sprite.js) walks on, holds a golden lyre and sings. Each sung line plucks the lyre:
 * the strings flash, a note floats up, and with the shared 8-bit sound setting on (js/v2-sfx.js, the same 🔊 as the arena
 * announcer) a soft pentatonic pluck plays. Sound is OFF unless the player turned it on. Nothing here is read by the rules.
 * Pauses in hidden tabs and off screen; prefers-reduced-motion (or ?motion=off) draws one still frame and floats no notes.
 *
 * API: V2HomerStage.mount(canvas) -> { sing(bool), pluck(i), mood(kind), stop() }   kind: 'rise' | 'lament' | 'fall' | 'usurp' | 'prologue'
 *      V2HomerStage.pluckSound(i, kind)   the lyre note alone (used by tests with no canvas)
 */
(function () {
  'use strict';
  var W = 120, H = 68;
  function reduced() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches || /[?&]motion=off/.test(location.search); } catch (e) { return false; } }
  function px(x, c, a, b, w, h) { x.fillStyle = c; x.fillRect(a | 0, b | 0, w | 0, h | 0); }
  /* ---- sound: a plucked lyre, A minor pentatonic for the sad songs, C major pentatonic for the glad ones */
  var actx = null;
  function sfxOn() { try { return !!(window.V2Sfx && window.V2Sfx.on && window.V2Sfx.on()); } catch (e) { return false; } }
  function ac() { if (!actx) { var C = window.AudioContext || window.webkitAudioContext; if (!C) return null; try { actx = (window.V2Sfx && window.V2Sfx.ctx && window.V2Sfx.ctx()) || new C(); } catch (e) { return null; } } if (actx.state === 'suspended') try { actx.resume(); } catch (e) { } return actx; }
  var GLAD = [523, 587, 659, 784, 880, 1047, 880, 784], SAD = [440, 523, 587, 659, 784, 659, 587, 523];
  function pluckSound(i, kind) { if (!sfxOn()) return false; var a = ac(); if (!a) return false; var sc = kind === 'lament' || kind === 'fall' ? SAD : GLAD, f = sc[(i | 0) % sc.length], t = a.currentTime;
    [[f, 'triangle', 0.09, 0.9], [f * 2, 'sine', 0.035, 0.5], [f / 2, 'triangle', 0.03, 1.1]].forEach(function (v) { var o = a.createOscillator(), g = a.createGain(); o.type = v[1]; o.frequency.setValueAtTime(v[0], t);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v[2], t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + v[3]); o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + v[3] + 0.05); });
    return true; }
  /* ---- Homer's frames: his Mythic sprite keys, painted with his own palette on a clear background */
  function homerFrames() { var HS = window.HomerSprite; if (!HS || !HS.draw) return null; var out = [];
    for (var f = 0; f < 4; f++) { var g, c = document.createElement('canvas'); c.width = 32; c.height = 32; var x = c.getContext('2d');
      try { g = HS.draw(5, f, null); } catch (e) { return null; }
      for (var y = 0; y < 32; y++) for (var k = 0; k < 32; k++) { var key = g[y] && g[y][k]; if (key) px(x, HS.PAL[key] || key, k, y, 1, 1); }
      out.push(c); }
    return out; }
  /* the lyre (12x14, faces right like Homer): two gold horns, a crossbar, 4 strings */
  var LYRE = ['.oo......oo.', 'oAo......oAo', 'oA........Ao', '.oA......Ao.', '.oA......Ao.', '..oAAAAAAo..', '..o.s.s.s.o.', '..o.s.s.s.o.', '..o.s.s.s.o.', '..o.s.s.s.o.', '..o.s.s.s.o.', '..oAAAAAAo..', '...oAAAAo...', '....oooo....'];
  function drawLyre(x, ox, oy, glow) { for (var y = 0; y < LYRE.length; y++) for (var k = 0; k < LYRE[y].length; k++) { var c = LYRE[y][k]; if (c === '.') continue;
    px(x, c === 'o' ? '#8a5a12' : c === 'A' ? '#ffc93c' : glow ? '#fff6c8' : '#e6d8a8', ox + k, oy + y, 1, 1); } }
  var NOTE = ['..##', '..#.', '..#.', '###.', '##..'];
  function drawNote(x, ox, oy, col, a) { x.globalAlpha = a; for (var y = 0; y < NOTE.length; y++) for (var k = 0; k < 4; k++) if (NOTE[y][k] === '#') px(x, col, ox + k, oy + y, 1, 1); x.globalAlpha = 1; }
  var BG = null;
  function bg() { if (BG) return BG; var c = document.createElement('canvas'); c.width = W; c.height = H; var x = c.getContext('2d'), i;
    px(x, '#120c22', 0, 0, W, H);
    for (i = 0; i < 6; i++) px(x, ['#1a1030', '#1d1236', '#21143c', '#251642', '#2a1848', '#2e1a4e'][i], 0, i * 8, W, 8);
    /* boards */ px(x, '#5a3a1e', 0, 52, W, 16); for (i = 0; i < W; i += 15) px(x, '#3e2812', i, 52, 1, 16); px(x, '#7a5230', 0, 52, W, 1); px(x, '#2a1a0c', 0, 60, W, 1);
    /* curtains */ for (i = 0; i < 14; i++) { var sh = i % 3 === 0 ? '#7a1020' : i % 3 === 1 ? '#a01828' : '#8c1424'; px(x, sh, i, 0, 1, 56 - (i * 1.4 | 0)); px(x, sh, W - 1 - i, 0, 1, 56 - (i * 1.4 | 0)); }
    px(x, '#a01828', 0, 0, W, 5); for (i = 0; i < W; i += 6) px(x, '#7a1020', i, 5, 3, 2); px(x, '#ffc93c', 0, 4, W, 1);
    BG = c; return c; }
  function mount(canvas) { if (!canvas || !canvas.getContext) return null; canvas.width = W; canvas.height = H; var x = canvas.getContext('2d'); x.imageSmoothingEnabled = false;
    var F = homerFrames(), still = reduced(), S = { singing: false, kind: 'rise', t0: 0, notes: [], glow: 0, hx: still ? 34 : -34, raf: 0, vis: true, dead: false, last: 0 };
    var noteCols = { rise: '#ffd84a', usurp: '#ffd84a', prologue: '#c9b8ff', lament: '#8cd2ff', fall: '#ff8a8a' };
    function frame(now) { S.raf = 0; if (S.dead) return; var dt = S.last ? Math.min(64, now - S.last) : 16; S.last = now;
      if (S.hx < 34) S.hx = Math.min(34, S.hx + dt * 0.05);
      var walking = S.hx < 34, f = walking ? ((now / 140) | 0) % 2 : S.singing ? ((now / 260) | 0) % 2 : ((now / 600) | 0) % 4 === 2 ? 2 : ((now / 900) | 0) % 2;
      x.drawImage(bg(), 0, 0);
      /* spotlight */ var a = S.singing ? 0.22 : 0.12; x.fillStyle = 'rgba(255,240,190,' + a + ')'; x.beginPath(); x.moveTo(S.hx + 10, 0); x.lineTo(S.hx + 30, 0); x.lineTo(S.hx + 56, 58); x.lineTo(S.hx - 8, 58); x.closePath(); x.fill();
      x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(S.hx + 2, 55, 40, 3);
      var bob = !walking && S.singing ? (((now / 260) | 0) % 2) : walking ? (((now / 140) | 0) % 2) : 0;
      if (F) x.drawImage(F[f], S.hx - 2, 10 - bob, 48, 48);
      else { px(x, '#5aa83c', S.hx + 8, 22, 22, 30); }
      drawLyre(x, S.hx + 34, 32 - bob, S.glow > 0);
      if (S.glow > 0) S.glow -= dt;
      for (var i = S.notes.length - 1; i >= 0; i--) { var n = S.notes[i]; n.age += dt; if (n.age > 1800) { S.notes.splice(i, 1); continue; } var p = n.age / 1800;
        drawNote(x, n.x + Math.sin(n.age / 180 + n.s) * 3, n.y - p * 34, n.col, 1 - p); }
      if (still) return; if (S.vis && !document.hidden) S.raf = requestAnimationFrame(frame); }
    function kick() { if (!S.raf && !S.dead) S.raf = requestAnimationFrame(frame); }
    try { if (window.IntersectionObserver) new IntersectionObserver(function (es) { S.vis = es[0].isIntersecting; if (S.vis) kick(); }).observe(canvas); } catch (e) { }
    document.addEventListener('visibilitychange', function () { if (!document.hidden) kick(); });
    if (still) requestAnimationFrame(frame); else kick();
    var api = {
      sing: function (on) { S.singing = !!on; if (still) requestAnimationFrame(frame); else kick(); },
      mood: function (k) { S.kind = k || 'rise'; },
      pluck: function (i) { pluckSound(i, S.kind); S.glow = 220; if (!still) { S.notes.push({ x: S.hx + 38 + ((i * 7) % 9), y: 34, age: 0, s: i, col: noteCols[S.kind] || '#ffd84a' }); kick(); } else requestAnimationFrame(frame); },
      stop: function () { S.dead = true; if (S.raf) cancelAnimationFrame(S.raf); } };
    return api; }
  window.V2HomerStage = { mount: mount, pluckSound: pluckSound, W: W, H: H };
})();
