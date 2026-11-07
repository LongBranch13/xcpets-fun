/* DJ PEPE sprite (PREVIEW, branch dj-pepe-community, Nov 6 2026): community pet #9 after PENPEN (#8).
 * NOT loaded by any page; inert until ACTIVATE_DJPEPE_BLOCK. Matched to the owner's DJ PEPENAT trading-card
 * reference (previews/dj-pepe-community/reference.png): green Pepe head, white flat-brim cap worn forward
 * (brim points right), bold black-and-white 'deal with it' shades, wide red lips with dark outline, brown
 * jaw beard, gold stud earring, SIGNATURE thick bright gold chain (2px V links + highlight) with a larger gold-framed
 * RED Bitcoin B pendant (Bitcoin is always red, never orange; reads Hatchling+ with an Egg hint), black tee
 * with a round white record-label logo, green hands on bold turntables/vinyl (Adult+).
 * Display name is DJ Pepe only. Stages 0 Egg..5 Mythic, 4 idle frames (stand, bob, blink, scratch).
 * Mythic = shared Mythic gold rim only (no fire aura, no flame crown, no edition frame). */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.DjPepeSprite = factory(); })(this, function () {
  'use strict';
  var N = 32, PAL = {
    n: '#1a1020',
    G: '#4f9a34', g: '#3a7a24', h: '#6cb84a', /* Pepe skin (card green) */
    L: '#d82028', l: '#9a1018',                 /* wide red lips */
    B: '#5a3018', b: '#7a4828',                 /* brown beard */
    W: '#ffffff', w: '#e0e0e0',                 /* white cap + logo */
    K: '#0a0a0a', k: '#222222',                 /* black shades / tee / vinyl */
    C: '#ffd23f', c: '#c98a00',                 /* gold chain / rim / stud */
    R: '#e11d2e', r: '#9b0f1c',                 /* RED Bitcoin coin (house rule) */
    E: '#f4f4ee', P: '#111111',
    Q: '#f4f6fa', A: '#ffc93c',                 /* Mythic rim */
    M: '#3a3a48', m: '#1a1a22',                 /* mixer */
    T: '#2a2a32', S: '#888898'                  /* platter rim / silver */
  };
  var STAGES = ['Egg', 'Hatchling', 'Juvenile', 'Adult', 'Elder', 'Mythic'], SKIN = { G: 1, g: 1, h: 1 }, SUIT = { K: 1, k: 1 };
  /* Keep Hatchling/Juvenile large enough that shades + lips still read */
  var SCALE = [0.6, 0.72, 0.82, 0.92, 0.98, 1.0];
  function hexRgb(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function el(x, y, cx, cy, rx, ry) { var a = (x - cx) / rx, b = (y - cy) / ry; return a * a + b * b; }

  /* Adult-space key. Ground ~28.5. Frame 3 = scratch (right hand slides). */
  function keyAt(X, Y, s, f) {
    var k = null;
    var scratch = f === 3 ? 1.4 : 0;
    var x = X - (f === 3 ? 0.25 : 0);

    /* ===== DECKS (Adult+: bolder vinyl silhouette; earlier stages get a slim hint) ===== */
    if (s >= 3) {
      var deckY = 26.8, leftCx = 7.4, rightCx = 24.6 + scratch * 0.2;
      /* mixer slab between decks */
      if (Y > 23.8 && Y < 28.4 && Math.abs(x - 16) < 4.4) {
        k = 'M';
        if (Y > 24.6 && Y < 26.4 && Math.abs(x - 16) < 3.6) k = 'm';
        if (Math.abs(x - 14.0) < 0.55 && Math.abs(Y - 25.4) < 0.5) k = 'C';
        if (Math.abs(x - 18.0) < 0.55 && Math.abs(Y - 25.4) < 0.5) k = 'k';
        if (Math.abs(x - 16) < 0.5 && Y > 24.8 && Y < 27.2) k = 'S';
      }
      /* left vinyl — thicker platter */
      if (el(x, Y, leftCx, deckY, 5.2, 2.6) < 1) k = 'T';
      if (el(x, Y, leftCx, deckY, 4.4, 2.1) < 1) k = 'K';
      if (el(x, Y, leftCx, deckY, 1.5, 1.0) < 1) k = 'c';
      if (Math.abs(Y - deckY) < 0.45 && Math.abs(x - leftCx) < 4.2) k = 'S';
      if (Math.abs(Y - (deckY - 0.8)) < 0.35 && Math.abs(x - leftCx) < 3.4) k = 'S';
      /* right vinyl (scratches) */
      if (el(x, Y, rightCx, deckY, 5.2, 2.6) < 1) k = 'T';
      if (el(x, Y, rightCx, deckY, 4.4, 2.1) < 1) k = 'K';
      if (el(x, Y, rightCx + scratch * 0.15, deckY, 1.5, 1.0) < 1) k = 'c';
      if (Math.abs(Y - deckY) < 0.45 && Math.abs(x - rightCx) < 4.2) k = 'S';
      if (Math.abs(Y - (deckY - 0.8)) < 0.35 && Math.abs(x - rightCx) < 3.4) k = 'S';
    } else if (s >= 1) {
      /* slim deck hint under Hatchling/Juvenile */
      if (Y > 26.6 && Y < 28.4 && (Math.abs(x - 10.5) < 3.2 || Math.abs(x - 21.5) < 3.2)) k = 'K';
      if (Y > 26.8 && Y < 28.0 && Math.abs(x - 16) < 2.4) k = 'M';
    }

    /* ===== BODY / BLACK TEE ===== */
    var bd = el(x, Y, 16, 20.8, 7.0, 5.8);
    if (bd < 1.05 && Y < 26.6 && Y > 15.5) {
      k = bd > 0.78 ? 'k' : 'K';
      /* round white record-label logo (kept above the pendant zone) */
      if (el(x, Y, 16, 18.8, 2.0, 2.0) < 1 && Y < 20.0) k = 'W';
      if (el(x, Y, 16, 18.8, 1.1, 1.1) < 1 && Y < 20.0) k = 'w';
      if (el(x, Y, 16, 18.8, 0.45, 0.45) < 1 && Y < 20.0) k = 'K';
    }

    /* arms + green hands on decks */
    if (s >= 2) {
      var handL = [7.6, 25.2], handR = [24.4 + scratch, 24.8 - scratch * 0.15];
      if (s >= 3) { handL = [7.2, 25.6]; handR = [24.8 + scratch, 25.2 - scratch * 0.2]; }
      /* forearms */
      if (el(x, Y, 10.2, 21.8, 1.5, 2.6) < 1 || el(x, Y, 21.8 + scratch * 0.25, 21.6, 1.5, 2.6) < 1) k = 'g';
      if (el(x, Y, handL[0], handL[1], 2.0, 1.5) < 1 || el(x, Y, handR[0], handR[1], 2.0, 1.5) < 1) k = 'G';
      if (el(x, Y, handL[0], handL[1] - 0.3, 1.0, 0.7) < 1 || el(x, Y, handR[0], handR[1] - 0.3, 1.0, 0.7) < 1) k = 'h';
    } else if (s === 1) {
      if (el(x, Y, 11.0, 24.6, 1.5, 1.3) < 1 || el(x, Y, 21.0, 24.6, 1.5, 1.3) < 1) k = 'G';
    }

    /* ===== GOLD CHAIN underpaint (real stamp is post-scale, below the beard) ===== */
    /* intentionally empty here: lips/beard draw next; stampChain paints the chest V + pendant */

    /* ===== HEAD (classic Pepe) — clipped below the jaw so the black tee stays black ===== */
    var hd = el(x, Y, 16, 10.6, 9.0, 7.0);
    if (hd < 1.05 && Y < 16.6) {
      k = (x < 10.2 || (Y > 13.5 && x < 11.5)) ? 'g' : 'G';
      if (el(x, Y, 16, 13.0, 5.8, 3.8) < 1) k = 'h'; /* lighter muzzle */
    }

    /* ===== WHITE FLAT-BRIM CAP (forward, brim points RIGHT) ===== */
    if (Y < 8.0) {
      /* crown */
      if (Y > 3.4 && el(x, Y, 15.2, 5.6, 7.2, 2.6) < 1) k = 'W';
      /* flat brim: longer to the right */
      if (Y > 6.4 && Y < 8.0) {
        if (x > 7.5 && x < 25.5) k = 'w';
        if (x > 16.5 && x < 26.2) k = 'W'; /* right-pointing brim tip */
      }
      if (Y > 6.8 && Y < 7.6 && x > 24.0 && x < 26.5) k = 'W';
    }

    /* ===== WIDE RED LIPS with dark outline ===== */
    if (Y > 12.6 && Y < 15.8 && Math.abs(x - 16) < 5.4) {
      var lip = el(x, Y, 16, 14.2, 5.0, 1.7);
      if (lip < 1.15) k = 'n'; /* dark outline first */
      if (lip < 1.0) k = lip > 0.55 ? 'l' : 'L';
      /* mouth split line */
      if (Math.abs(Y - 14.2) < 0.3 && Math.abs(x - 16) < 4.2) k = 'n';
    }

    /* ===== BROWN BEARD along jaw / cheeks ===== */
    if (s >= 1 && Y > 14.4 && Y < 17.0 && Math.abs(x - 16) < 7.0) {
      if (el(x, Y, 16, 15.6, 6.2, 1.8) < 1) {
        /* leave the lip center clear */
        if (!(Y < 15.2 && Math.abs(x - 16) < 4.0)) k = (x + Y) % 2 ? 'B' : 'b';
      }
    }

    /* gold stud earring (viewer's right = his left ear on the card) */
    if (s >= 1 && Math.abs(x - 24.0) < 0.85 && Math.abs(Y - 11.6) < 0.85) k = 'C';

    return k;
  }

  /* Stamp bold 'deal with it' shades AFTER scale so Hatchling/Juvenile still read them. */
  function stampShades(g, s, f) {
    if (s < 1) return;
    var t = SCALE[s], dy = f === 1 ? -1 : 0;
    var P2 = function (X, Y) {
      return [Math.round(15.5 + (X - 15.5) * t - 0.5), Math.round(28.5 + (Y - 28.5) * t - 0.5) + dy];
    };
    /* Adult-space shade band: wide black bar across the eyes + white corner pixels */
    var y0 = 9.0, y1 = 11.8;
    var x0 = 8.2, x1 = 23.8;
    for (var ay = y0; ay <= y1; ay += 0.5) {
      for (var ax = x0; ax <= x1; ax += 0.5) {
        var p = P2(ax, ay);
        if (p[0] < 0 || p[1] < 0 || p[0] >= N || p[1] >= N) continue;
        g[p[1]][p[0]] = 'K';
      }
    }
    /* white pixel glints at outer corners (deal-with-it look) */
    [[9.2, 9.6], [9.2, 10.4], [10.0, 9.6], [22.0, 9.6], [22.8, 9.6], [22.8, 10.4]].forEach(function (e) {
      var p = P2(e[0], e[1]);
      if (p[0] >= 0 && p[1] >= 0 && p[0] < N && p[1] < N) g[p[1]][p[0]] = 'W';
    });
    /* blink: close the white glints */
    if (f === 2) {
      [[9.2, 9.6], [9.2, 10.4], [10.0, 9.6], [22.0, 9.6], [22.8, 9.6], [22.8, 10.4]].forEach(function (e) {
        var p = P2(e[0], e[1]);
        if (p[0] >= 0 && p[1] >= 0 && p[0] < N && p[1] < N) g[p[1]][p[0]] = 'K';
      });
    }
  }


  /* Stamp SIGNATURE gold chain in GRID space after scale.
   * Starts 1px below the beard. Thin bright V (1 gold + 1 highlight) onto the black tee —
   * arms stop short of center so they never merge into a gold/red blob. Small 3x3/4x4
   * gold-framed RED B pendant centered on the chest with black tee pixels between chin and pendant.
   * Never covers lips/beard/face; no orange/flame. */
  function stampChain(g, s, f) {
    if (s < 1) return;
    function face(c) {
      return c === 'L' || c === 'l' || c === 'B' || c === 'b' || c === 'G' || c === 'g' || c === 'h' || c === 'n';
    }
    function set(x, y, k) {
      if (x < 0 || y < 0 || x >= N || y >= N) return;
      if (face(g[y][x])) return;
      g[y][x] = k;
    }

    var beardBottom = -1, lipBottom = -1;
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      var c = g[y][x];
      if (c === 'B' || c === 'b') beardBottom = y;
      if (c === 'L' || c === 'l') lipBottom = y;
    }
    var startY = (beardBottom >= 0 ? beardBottom : (lipBottom >= 0 ? lipBottom : 16)) + 1;
    var midX = 15;

    /* Black-tee band under the beard (clear spilled green / logo under the jaw) */
    for (var cy = startY; cy <= startY + 1 && cy < N; cy++) {
      for (var cx = 10; cx <= 21; cx++) {
        if (face(g[cy][cx])) continue;
        if (g[cy][cx] === 'G' || g[cy][cx] === 'g' || g[cy][cx] === 'h' || g[cy][cx] === 'W' || g[cy][cx] === 'w') g[cy][cx] = 'K';
      }
    }

    var size = s >= 3 ? 4 : 3;
    var gap = 2;
    var y0 = startY + gap;
    if (y0 + size >= N - 2) y0 = Math.max(startY + 1, N - 2 - size);
    var x0 = midX - Math.floor((size - 1) / 2);

    /* Thin V arms from neck toward pendant corners — never paint the pendant columns above it */
    var neckL = midX - (s >= 3 ? 6 : 5), neckR = midX + (s >= 3 ? 6 : 5);
    var tipY = y0 - 1;
    var steps = Math.max(2, tipY - startY);
    for (var i = 0; i <= steps; i++) {
      var yy = startY + i;
      if (yy >= y0) break;
      var tt = i / steps;
      var lx = Math.round(neckL + ((x0 - 1) - neckL) * tt);
      var rx = Math.round(neckR + ((x0 + size) - neckR) * tt);
      /* keep arms outside the pendant x-range on the last steps */
      if (lx >= x0 && lx < x0 + size) lx = x0 - 1;
      if (rx >= x0 && rx < x0 + size) rx = x0 + size;
      set(lx, yy, 'C'); set(lx - 1, yy, 'c');
      set(rx, yy, 'C'); set(rx + 1, yy, 'c');
    }

    /* Guarantee black tee in the gap between beard and pendant (kills any torch stalk) */
    for (var sy = startY; sy < y0; sy++) {
      for (var sx = x0; sx < x0 + size; sx++) {
        if (face(g[sy][sx])) continue;
        g[sy][sx] = 'K';
      }
    }

    /* Small square pendant */
    for (var py = 0; py < size; py++) for (var px = 0; px < size; px++) {
      var onEdge = px === 0 || py === 0 || px === size - 1 || py === size - 1;
      set(x0 + px, y0 + py, onEdge ? 'C' : 'R');
    }
    /* B mark only when there is room (4x4); on 3x3 leave a solid RED center so it doesn't read as a gold blob */
    if (size >= 4) {
      var bx = x0 + Math.floor(size / 2);
      for (var by = y0 + 1; by <= y0 + size - 2; by++) set(bx, by, 'C');
      set(bx + 1, y0 + 1, 'C'); set(bx + 1, y0 + size - 2, 'C');
    }
  }
  function egg(f) {
    var g = [], dy = f === 1 ? -1 : 0;
    for (var y = 0; y < N; y++) {
      g.push([]);
      for (var x = 0; x < N; x++) {
        var yy = y - dy + 0.5, xx = x + 0.5, k = null;
        if (el(xx, yy, 16, 19.5, 7.8, 8.8) < 1) {
          k = xx < 12 ? 'g' : 'G';
          /* white cap on top, brim to the right */
          if (yy < 14.8) k = 'W';
          if (yy > 14.2 && yy < 15.6 && xx > 16 && xx < 24) k = 'W';
          /* bold shades band */
          if (yy > 16.2 && yy < 18.6 && Math.abs(xx - 16) < 6.2) k = 'K';
          if ((Math.abs(xx - 11.5) < 0.7 || Math.abs(xx - 20.5) < 0.7) && yy > 16.6 && yy < 18.0) k = 'W';
          /* wide red lip */
          if (yy > 19.2 && yy < 21.4 && Math.abs(xx - 16) < 4.2) k = 'L';
          if (Math.abs(yy - 20.2) < 0.35 && Math.abs(xx - 16) < 3.6) k = 'n';
          /* signature gold-chain hint: thin V below the lip, small square RED B on lower egg */
          if (yy > 21.8 && yy < 23.4) {
            var evL = 16 - (yy - 21.8) * 1.2, evR = 16 + (yy - 21.8) * 1.2;
            if (Math.abs(xx - evL) < 0.7 || Math.abs(xx - evR) < 0.7) k = 'C';
          }
          /* 3x3-ish pendant well below the lip line */
          if (Math.abs(xx - 16) <= 1.5 && Math.abs(yy - 25.0) <= 1.5) {
            var onE = Math.abs(xx - 16) > 1.0 || Math.abs(yy - 25.0) > 1.0;
            k = onE ? 'C' : 'R';
          }
          if (Math.abs(xx - 16) < 0.35 && Math.abs(yy - 25.0) <= 1.0) k = 'C';
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
      stampShades(g, s, f);
      stampChain(g, s, f);
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
    var h0 = P2(8, 3), h1 = P2(24, 16), e0 = P2(10.0, 10.2), e1 = P2(22.0, 10.2), b0 = P2(8, 15), b1 = P2(24, 28);
    return { top: h0[1], fx0: h0[0], fy0: h0[1], fx1: h1[0], fy1: h1[1], ex0: e0[0], ex1: e1[0] + 1, ey: e0[1], ey1: e0[1], bx0: b0[0], by0: b0[1], bx1: b1[0], by1: b1[1] };
  }

  function draw(stage, frame, gear) {
    var g = base(stage, frame), Gr = gear || {};
    if (!stage || !Object.keys(Gr).length) return g;
    var A = anchors(stage, frame);
    function set(x, y, k) { if (x >= 0 && y >= 0 && x < N && y < N && k) g[y][x] = k; }
    function col(sl, i) { var c = Gr[sl] && Gr[sl].cols; return (c && (c[i || 0] || c[0])) || (i ? '#c98a00' : '#ffd23f'); }
    function iid(sl) { return Gr[sl] && Gr[sl].item; }
    /* signature Gold Chain (dj-gold-chain): reinforce the body chain + RED B pendant (already stamped; hand Grip shows as held glint) */
    if (iid('hand') === 'dj-gold-chain') {
      var hx = Math.min(28, A.bx1 + 2), hy = Math.min(26, A.by0 + 4);
      set(hx, hy, 'C'); set(hx + 1, hy, 'C'); set(hx, hy + 1, 'C'); set(hx + 1, hy + 1, 'R'); set(hx + 2, hy + 1, 'C');
    }
    if (iid('hand') === 'dj-vinyl') {
      var vx = Math.min(28, A.bx1 + 1), vy = Math.min(26, A.by0 + 3);
      for (var vr = 0; vr < 5; vr++) for (var vc = 0; vc < 5; vc++) {
        var dx = vc - 2, dy = vr - 2; if (dx * dx + dy * dy <= 5) set(vx + vc, vy + vr, (dx * dx + dy * dy <= 1) ? 'R' : 'n');
      }
    }
    if (iid('head') === 'dj-headphones') {
      for (var xe = A.fx0 - 1; xe <= A.fx0; xe++) { set(xe, A.fy0 + 2, 'n'); set(xe, A.fy0 + 3, 'n'); }
      for (var xe2 = A.fx1 - 1; xe2 <= A.fx1; xe2++) { set(xe2, A.fy0 + 2, 'n'); set(xe2, A.fy0 + 3, 'n'); }
      for (var xb = A.fx0; xb <= A.fx1 - 1; xb++) set(xb, A.fy0 - 1, 'C');
    }
    if (iid('head') === 'dj-flat-cap') {
      for (var xh = A.fx0; xh <= A.fx1 - 1; xh++) { set(xh, A.fy0 - 1, 'n'); set(xh, A.fy0, 'n'); }
      for (var xb2 = A.fx0 - 1; xb2 <= A.fx1; xb2++) set(xb2, A.fy0 + 1, 'n');
    }
    if (Gr.head && !iid('head')) for (var xh3 = A.fx0 + 2; xh3 <= A.fx1 - 3; xh3++) { set(xh3, A.fy0 - 1, col('head')); set(xh3, A.fy0, col('head', 1)); }
    if (Gr.face) for (var xf = A.ex0 - 1; xf <= A.ex1; xf++) set(xf, A.ey, col('face'));
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
