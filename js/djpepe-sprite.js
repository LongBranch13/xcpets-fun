/* DJ PEPE sprite (PREVIEW, branch dj-pepe-community, Nov 6 2026): community pet #9 candidate, after PENPEN (#8).
 * NOT loaded by any page; rules would use it only once ACTIVATE_DJPEPE_BLOCK is set (null = off).
 * 8-bit house-style: classic green Pepe frog head on a DJ body. White flat-brim cap (forward), black-and-white
 * pixel 'deal with it' shades, big coral lips, short brown beard, gold stud earring, thin gold chain with a
 * RED Bitcoin B pendant (gold rim; Bitcoin is always red, never orange), black tee with a round white
 * record-label logo, green hands on turntables + mixer with black vinyl. Stages 0 Egg..5 Mythic, 4 idle
 * frames (stand, 1px bob, blink, turntable scratch). No text/logos baked in. Mythic = shared Mythic gold rim
 * only (no fire aura, no flame crown, no edition frame). Same API as PenguinSprite / GroyperSprite. */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.DjPepeSprite = factory(); })(this, function () {
  'use strict';
  var N = 32, PAL = {
    n: '#1a1020',
    G: '#5aa83c', g: '#468a2e', h: '#7cc55a', /* Pepe skin */
    L: '#e0582e', l: '#a8331c',                 /* coral / deep lip */
    B: '#6b3a1a', b: '#8a5230',                 /* brown beard */
    W: '#ffffff', w: '#d8d8d8',                 /* white cap + logo */
    K: '#111111', k: '#2a2a2a',                 /* black shades / tee / vinyl */
    C: '#ffd23f', c: '#c98a00',                 /* gold chain / rim */
    R: '#e11d2e', r: '#9b0f1c',                 /* RED Bitcoin coin (house rule) */
    E: '#f4f4ee', P: '#111111',                 /* eye whites / pupil under shades rarely */
    Q: '#f4f6fa', A: '#ffc93c',                 /* highlight + Mythic rim */
    M: '#3a3a44', m: '#1c1c22',                 /* mixer / deck body */
    T: '#222028'                                /* turntable platter ring */
  };
  var STAGES = ['Egg', 'Hatchling', 'Juvenile', 'Adult', 'Elder', 'Mythic'], SKIN = { G: 1, g: 1, h: 1 }, SUIT = { K: 1, k: 1 };
  var SCALE = [0.6, 0.64, 0.76, 0.88, 0.96, 1.0];
  function hexRgb(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function el(x, y, cx, cy, rx, ry) { var a = (x - cx) / rx, b = (y - cy) / ry; return a * a + b * b; }
  function hash(x, y) { var h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

  /* Adult-space key at (X,Y). Ground ~28.5. Frame 3 = scratch: right hand slides on the right deck. */
  function keyAt(X, Y, s, f) {
    var k = null;
    var scratch = f === 3 ? 1.2 : 0;
    var bobLean = f === 3 ? 0.3 : 0;
    var x = X - bobLean;

    /* turntables + mixer (Hatchling+; clearer platters so the silhouette reads as a DJ) */
    if (s >= 1) {
      var deckY = 26.6, leftCx = 8.8, rightCx = 23.2 + scratch * 0.25;
      if (s === 1) { leftCx = 10.5; rightCx = 21.5; deckY = 27.0; }
      /* mixer between decks */
      if (Y > 24.8 && Y < 27.8 && Math.abs(x - 16) < 3.4) {
        k = 'M';
        if (Math.abs(x - 16) < 0.7 && Y > 25.2 && Y < 27.2) k = 'C';
        if (Math.abs(Y - 25.8) < 0.4 && Math.abs(x - 14.4) < 0.55) k = 'R';
        if (Math.abs(Y - 25.8) < 0.4 && Math.abs(x - 17.6) < 0.55) k = 'k';
      }
      /* left platter */
      if (el(x, Y, leftCx, deckY, 4.0, 2.0) < 1) k = 'T';
      if (el(x, Y, leftCx, deckY, 3.0, 1.4) < 1) k = 'K';
      if (el(x, Y, leftCx, deckY, 1.0, 0.7) < 1) k = 'c';
      /* right platter (scratches a little on frame 3) */
      if (el(x, Y, rightCx, deckY, 4.0, 2.0) < 1) k = 'T';
      if (el(x, Y, rightCx, deckY, 3.0, 1.4) < 1) k = 'K';
      if (el(x, Y, rightCx + scratch * 0.2, deckY, 1.0, 0.7) < 1) k = 'c';
    }

    /* body / black tee */
    var bd = el(x, Y, 16, 21.4, 7.2, 6.2);
    if (bd < 1.05 && Y < 27.2) {
      k = 'K';
      if (bd > 0.82) k = 'k';
      /* round white record-label logo on chest */
      if (el(x, Y, 16, 20.2, 2.2, 2.2) < 1) k = 'W';
      if (el(x, Y, 16, 20.2, 1.1, 1.1) < 1) k = 'w';
      if (Math.abs(x - 16) < 0.45 && Math.abs(Y - 20.2) < 1.3) k = 'K'; /* tiny spindle mark */
    }

    /* arms + green hands on decks (Juvenile+) */
    if (s >= 2) {
      var handL = [8.2, 24.4], handR = [23.8 + scratch, 24.0 - scratch * 0.2];
      if (el(x, Y, handL[0], handL[1], 1.8, 1.4) < 1 || el(x, Y, handR[0], handR[1], 1.8, 1.4) < 1) k = 'G';
      if (el(x, Y, handL[0], handL[1] - 0.4, 0.9, 0.7) < 1 || el(x, Y, handR[0], handR[1] - 0.4, 0.9, 0.7) < 1) k = 'h';
      /* forearms */
      if (el(x, Y, 10.5, 22.5, 1.3, 2.2) < 1 || el(x, Y, 21.5 + scratch * 0.3, 22.2, 1.3, 2.2) < 1) k = 'g';
    } else if (s === 1) {
      if (el(x, Y, 11.5, 24.8, 1.4, 1.2) < 1 || el(x, Y, 20.5, 24.8, 1.4, 1.2) < 1) k = 'G';
    }

    /* gold chain + RED Bitcoin B pendant */
    if (s >= 1 && Y > 16.6 && Y < 19.2) {
      if (Math.abs(Y - 17.4) < 0.35 && Math.abs(x - 16) < 5.2) k = 'C';
      if (el(x, Y, 16, 18.4, 1.7, 1.7) < 1) { k = el(x, Y, 16, 18.4, 1.2, 1.2) < 1 ? 'R' : 'c'; }
      /* B bars on the coin */
      if (Math.abs(x - 16) < 0.35 && Y > 17.6 && Y < 19.2) k = 'c';
      if (Math.abs(x - 16.7) < 0.3 && (Math.abs(Y - 18.0) < 0.35 || Math.abs(Y - 18.8) < 0.35)) k = 'c';
    }

    /* head (Pepe) */
    var hd = el(x, Y, 16, 11.0, 8.6, 7.4);
    if (hd < 1.08) {
      k = (x < 10.5 || (Y > 14 && x < 12)) ? 'g' : 'G';
      if (hd > 0.9 && hash(Math.round(X), Math.round(Y)) > 0.55) k = 'g';
      /* lighter muzzle */
      if (el(x, Y, 16, 13.6, 5.4, 3.6) < 1) k = 'h';
    }

    /* white flat-brim cap (forward) */
    if (Y < 7.6 && Math.abs(x - 16) < 8.2) {
      if (Y > 4.2 && el(x, Y, 16, 6.2, 8.0, 2.8) < 1) k = 'W';
      if (Y > 6.6 && Y < 7.8 && Math.abs(x - 16) < 9.0) k = 'w'; /* short brim */
      if (Y < 5.6 && Y > 3.8 && Math.abs(x - 16) < 6.2) k = 'W'; /* crown */
    }

    /* 'deal with it' shades: black band + white pixel glints */
    if (s >= 1 && Y > 9.2 && Y < 11.6 && Math.abs(x - 16) < 7.4) {
      k = 'K';
      if ((Math.abs(x - 12.5) < 0.5 || Math.abs(x - 19.5) < 0.5) && Y > 9.6 && Y < 11.0) k = 'W';
      if (Y > 9.3 && Y < 9.7) k = 'K'; /* top bar */
    }

    /* big coral lips */
    if (Y > 13.2 && Y < 15.6 && Math.abs(x - 16) < 4.6) {
      var lip = el(x, Y, 16, 14.4, 4.2, 1.5);
      if (lip < 1) k = lip > 0.55 ? 'l' : 'L';
    }

    /* short brown beard on jaw / cheeks */
    if (s >= 1 && Y > 14.8 && Y < 17.2 && Math.abs(x - 16) < 6.2) {
      if (el(x, Y, 16, 15.8, 5.6, 1.6) < 1 && !(Y < 15.2 && Math.abs(x - 16) < 3.5)) {
        k = (hash(Math.round(X * 3), Math.round(Y * 3)) > 0.45) ? 'B' : 'b';
      }
    }

    /* gold stud earring (right side as viewed) */
    if (s >= 2 && Math.abs(x - 23.6) < 0.8 && Math.abs(Y - 12.2) < 0.8) k = 'C';

    return k;
  }

  function stampEyes(g, s, f) {
    /* shades cover the eyes from Hatchling on; Egg/Hatchling blink uses tiny pupils under the band when not blinking */
    if (s < 1) return;
    var t = SCALE[s], dy = f === 1 ? -1 : 0;
    var P2 = function (X, Y) { return [Math.round(15.5 + (X - 15.5) * t - 0.5), Math.round(28.5 + (Y - 28.5) * t - 0.5) + dy]; };
    if (f === 2) {
      [[12.5, 10.4], [19.5, 10.4]].forEach(function (e) {
        var p = P2(e[0], e[1]);
        if (p[1] >= 0 && p[1] < N && p[0] >= 0 && p[0] < N) g[p[1]][p[0]] = 'K';
      });
    }
  }

  function egg(f) {
    var g = [], dy = f === 1 ? -1 : 0;
    for (var y = 0; y < N; y++) {
      g.push([]);
      for (var x = 0; x < N; x++) {
        var yy = y - dy + 0.5, xx = x + 0.5, k = null;
        if (el(xx, yy, 16, 19.5, 7.6, 8.8) < 1) {
          k = xx < 12 ? 'g' : 'G';
          /* white cap smear on top of egg */
          if (yy < 15.2 + Math.sin(xx * 1.5) * 0.8) k = 'W';
          /* shades band */
          if (yy > 16.6 && yy < 18.2 && Math.abs(xx - 16) < 5.5) k = 'K';
          if ((Math.abs(xx - 13) < 0.5 || Math.abs(xx - 19) < 0.5) && yy > 16.8 && yy < 18.0) k = 'W';
          /* coral lip smile */
          if (yy > 19.4 && yy < 21.2 && Math.abs(xx - 16) < 3.6) k = 'L';
          /* tiny red B coin pressed in */
          if (el(xx, yy, 16, 24.2, 2.2, 2.0) < 1) k = el(xx, yy, 16, 24.2, 1.3, 1.2) < 1 ? 'R' : 'c';
        }
        g[y].push(k);
      }
    }
    return g;
  }

  function outline(g) {
    var o = g.map(function (r) { return r.slice(); });
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++)
      if (!g[y][x] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (q) {
        var X = x + q[0], Y = y + q[1]; return X >= 0 && Y >= 0 && X < N && Y < N && g[Y][X] && g[Y][X] !== 'n';
      })) o[y][x] = 'n';
    return o;
  }

  function base(stage, frame) {
    var s = Math.max(0, Math.min(5, stage | 0)), f = ((frame | 0) % 4 + 4) % 4, g;
    if (s === 0) g = egg(f);
    else {
      var t = SCALE[s], dy = f === 1 ? -1 : 0; g = [];
      for (var y = 0; y < N; y++) {
        g.push([]);
        for (var x = 0; x < N; x++) {
          var sx = 15.5 + (x + 0.5 - 15.5) / t, sy = 28.5 + (y - dy + 0.5 - 28.5) / t;
          g[y].push(y - dy > 29 ? null : keyAt(sx, sy, s, f));
        }
      }
      stampEyes(g, s, f);
    }
    var o = outline(g);
    if (s === 5) {
      var o2 = o.map(function (r) { return r.slice(); });
      for (var ry = 0; ry < 30; ry++) for (var rx = 0; rx < N; rx++)
        if (!o[ry][rx] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (q) {
          var X = rx + q[0], Y = ry + q[1]; return X >= 0 && Y >= 0 && X < N && Y < N && o[Y][X] === 'n';
        })) o2[ry][rx] = 'A';
      o = o2;
    }
    return o;
  }

  function anchors(stage, frame) {
    var t = SCALE[Math.max(1, Math.min(5, stage | 0))], bob = frame === 1 ? -1 : 0;
    var P2 = function (X, Y) { return [Math.round(15.5 + (X - 15.5) * t - 0.5), Math.round(28.5 + (Y - 28.5) * t - 0.5) + bob]; };
    if (!stage) return { fx0: 9, fx1: 23, fy0: 11, fy1: 20, ex0: 12, ex1: 19, ey: 13, ey1: 13, bx0: 9, bx1: 23, by0: 20, by1: 28 };
    var h0 = P2(8, 3), h1 = P2(24, 16), e0 = P2(12.5, 10.4), e1 = P2(19.5, 10.4), b0 = P2(8, 15), b1 = P2(24, 28);
    return { top: h0[1], fx0: h0[0], fy0: h0[1], fx1: h1[0], fy1: h1[1], ex0: e0[0], ex1: e1[0] + 1, ey: e0[1], ey1: e0[1], bx0: b0[0], by0: b0[1], bx1: b1[0], by1: b1[1] };
  }

  function draw(stage, frame, gear) {
    var g = base(stage, frame), Gr = gear || {};
    if (!stage || !Object.keys(Gr).length) return g;
    var A = anchors(stage, frame);
    function set(x, y, k) { if (x >= 0 && y >= 0 && x < N && y < N && k) g[y][x] = k; }
    function col(sl, i) { var c = Gr[sl] && Gr[sl].cols; return (c && (c[i || 0] || c[0])) || (i ? '#c98a00' : '#ffd23f'); }
    if (Gr.head) for (var xh = A.fx0 + 2; xh <= A.fx1 - 3; xh++) { set(xh, A.fy0 - 1, col('head')); set(xh, A.fy0, col('head', 1)); }
    if (Gr.face) for (var xe = A.ex0 - 1; xe <= A.ex1; xe++) set(xe, A.ey, col('face'));
    return g;
  }

  function render(stage, frame, bg, gear, opts) {
    var g = draw(stage, frame, gear), P = Object.assign({}, PAL, (opts && opts.pal) || {}), B = hexRgb(typeof bg === 'string' ? bg : '#142018'), d = [];
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var k = g[y][x], c = k ? hexRgb(P[k] || k) : B; d.push(c[0], c[1], c[2], 255); }
    return { width: N, height: N, data: d };
  }
  function frames(stage, bg, gear, opts) { return [0, 1, 2, 3].map(function (f) { return render(stage, f, bg, gear, opts); }); }
  return { STAGES: STAGES, PAL: PAL, PAL_COMMUNITY: {}, SKIN: SKIN, SUIT: SUIT, render: render, frames: frames, draw: draw, anchors: anchors };
});
