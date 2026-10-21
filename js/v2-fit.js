/* XCPETS v2: FIT + LAYERING (2026-10-14). Render-time only; nothing here changes pet-core / bonus-gear or any game rule.
 * - torso(a): a per-species, per-stage torso box (armor rows, cut to the body silhouette, never above the mouth line; low-armor species
 *   such as Wojak / KEVIN / Snibby get a minimum torso height so armour stops being a thin strip at the bottom).
 * - outfit(): v2 Outfit maps are scaled (nearest-neighbour) into that box and clipped to the body; no outline on the background.
 * - armor(): base-game armour drawn into the same box (metal + trim + seam + shading + shoulder pads + gem).
 * - cape(): every back-slot cape (v2 species capes, Paper-hands cape, the 7 base-game capes) redrawn: flowing silhouette that flares at the
 *   hem, folds with a 3-tone shade + highlight, collar/trim, one thematic detail per cape, a 2-frame sway; drawn BEHIND the body and any
 *   base-game gear (fg mask), with a dark edge so it reads against the background. HODL-style banners are not capes and are untouched. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.V2Fit = factory();
})(this, function () {
  'use strict';
  var N = 32, INK = '#1a1020';
  function rgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function hx(c) { return '#' + c.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
  function mix(h, t, k) { var a = rgb(h), b = rgb(t); return hx(a.map(function (v, i) { return v + (b[i] - v) * k; })); }
  function put(img, x, y, h) { if (x < 0 || y < 0 || x >= N || y >= N || !h) return; var c = rgb(h), i = (y * N + x) * 4; img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; }
  function eyeY(a) { return a.eyeL ? a.eyeL[1] : a.eyeR ? a.eyeR[1] : a.minY + 6; }
  function span(a, y) { // silhouette run through the body centre on row y
    var c = -1, d; for (d = 0; d < 8 && c < 0; d++) { if (a.isSil(16 + d, y)) c = 16 + d; else if (a.isSil(15 - d, y)) c = 15 - d; }
    if (c < 0) return null; var l = c, r = c; while (a.isSil(l - 1, y)) l--; while (a.isSil(r + 1, y)) r++; return [l, r]; }
  /** torso(a): the body pixels an outfit / armour may cover. Seed = where pet-core itself would draw armour (a.armorAt, face-safe), so faces,
   * eyes and mouths are never covered. Species whose armour band is thin (Wojak, KEVIN, Snibby...) grow it upwards to >= 30% of the body
   * height, but only over pixels of the body colours found under the armour (a.bareAt), so the face stays clear. Fallback: span rows. */
  function torso(a) {
    var rows = {}, y, x, H = a.maxY - a.minY;
    if (a.armorAt) { for (y = 0; y < 30; y++) for (x = 0; x < N; x++) if (a.armorAt(x, y) && a.isSil(x, y)) (rows[y] = rows[y] || []).push(x);
      var ys = Object.keys(rows).map(Number).sort(function (p, q) { return p - q; });
      if (ys.length && a.bareAt) { var cnt = {}; ys.forEach(function (yy) { rows[yy].forEach(function (xx) { var c = a.bareAt(xx, yy); cnt[c] = (cnt[c] || 0) + 1; }); });
        var cols = Object.keys(cnt).sort(function (p, q) { return cnt[q] - cnt[p]; }).slice(0, 2), want = Math.round(H * 0.3), top = ys[0], minTop = eyeY(a) + 3;
        for (y = top - 1; y >= minTop && (ys[ys.length - 1] - y + 1) <= want; y--) { var r = []; for (x = 0; x < N; x++) if (a.isSil(x, y) && cols.indexOf(a.bareAt(x, y)) >= 0 && (rows[y + 1] || []).some(function (q) { return Math.abs(q - x) <= 1; })) r.push(x); if (!r.length) break; rows[y] = r; } } }
    else { var g = a.gear || { armor: [20, 22, 0] }, t0 = Math.max(a.row(g.armor[0]), eyeY(a) + 4), b0 = Math.min(a.maxY - 2, a.row(g.armor[1] + 1) - 1);
      for (y = t0; y <= b0; y++) { var sp = span(a, y); if (sp) { rows[y] = []; for (x = sp[0]; x <= sp[1]; x++) rows[y].push(x); } } }
    var out = Object.keys(rows).map(Number).sort(function (p, q) { return p - q; }).map(function (yy) { return { y: yy, xs: rows[yy], l: Math.min.apply(null, rows[yy]), r: Math.max.apply(null, rows[yy]) }; });
    var l = 99, rr = -1; out.forEach(function (q) { l = Math.min(l, q.l); rr = Math.max(rr, q.r); });
    return { top: out.length ? out[0].y : 0, bot: out.length ? out[out.length - 1].y : -1, rows: out, l: l, r: rr };
  }
  function free(a, x, y) { return a.isSil(x, y) && !(a.isGear && a.isGear(x, y)) && !(a.isFaceSkin && a.isFaceSkin(x, y)); }
  /** outfit(img, a, map, COLORS): scale the map into the torso box, clip to the body, keep base-game gear (weapon, band) in front. */
  function outfit(img, a, map, COLORS) {
    var T = torso(a); if (!T.rows.length) return img; var W = T.r - T.l + 1, Hh = T.rows.length, mh = map.length, mw = map[0].length;
    T.rows.forEach(function (q, j) { q.xs.forEach(function (x) { if (!free(a, x, q.y)) return;
      var k = map[Math.min(mh - 1, Math.floor(j * mh / Hh))][Math.min(mw - 1, Math.floor((x - T.l) * mw / W))]; if (k && k !== '.' && COLORS[k]) put(img, x, q.y, COLORS[k]); }); });
    return img; }
  /** base-game armour (ARMORS entry {metal, trim}) drawn into the torso box. */
  /* redraw-2 (Jake 2026-10-14): each core armour tier (Leather..Obsidian, ids and pool positions unchanged) gets its own look, still fitted to the torso box.
   * leather: tan with two dark crossing straps + brass buckle; iron: grey plates, dark seams every 2 rows, light rivets on the edges;
   * silver: bright plate, white collar, polished highlight stripe + centre ridge; gold: gold plate, light shine diagonals, red gem;
   * obsidian: near-black glass with violet sheen streaks and a violet rim. */
  var ARMOR_STYLE = {
    leather: function (x, y, q, y0, T) { var d = y - y0; if (x === q.l + d || x === q.r - d) return '#5a3820'; if (d === Math.floor(T.rows.length / 2) && (x === 15 || x === 16)) return '#e8b04a'; return x >= q.r - 1 ? '#6e4528' : '#8a5a3a'; },
    iron: function (x, y, q, y0) { var d = y - y0; if (d % 2 === 1) return '#5c6474'; if (x === q.l + 1 || x === q.r - 1) return d % 2 === 0 ? '#c7ced9' : '#8d96a8'; return x >= q.r - 1 ? '#6e7686' : '#8d96a8'; },
    silver: function (x, y, q, y0) { if (y === y0) return '#ffffff'; if (x === q.l + 2) return '#f4f6fb'; if (x === 15 || x === 16) return '#e2e6ef'; return x >= q.r - 1 ? '#8f97a8' : '#c3cad8'; },
    gold: function (x, y, q, y0, T) { var d = y - y0; if (d === 0) return '#ffe48a'; if ((x + d) % 5 === 0) return '#fff2b0'; if (d === 2 && (x === 15 || x === 16)) return '#e8344f'; return x >= q.r - 1 ? '#a8740f' : '#e8a924'; },
    obsidian: function (x, y, q, y0) { if (x === q.l || x === q.r || y === y0) return '#a07cff'; if ((x + y) % 5 === 0) return '#6b4fc4'; if ((x + y) % 5 === 1) return '#2e2645'; return '#1a1626'; }
  };
  function armor(img, a, ar) { var S = ARMOR_STYLE[ar && ar.id]; if (S) { var T2 = torso(a); if (!T2.rows.length) return img; var yt = T2.rows[0].y;
      T2.rows.forEach(function (q) { q.xs.forEach(function (x) { if (free(a, x, q.y)) put(img, x, q.y, S(x, q.y, q, yt, T2)); }); });
      var f2 = T2.rows[0], pad = ar.id === 'leather' ? '#5a3820' : ar.id === 'obsidian' ? '#a07cff' : ar.trim; [f2.l, f2.l + 1, f2.r - 1, f2.r].forEach(function (x) { if (free(a, x, yt)) put(img, x, yt, pad); if (yt - 1 > eyeY(a) + 1 && free(a, x, yt - 1)) put(img, x, yt - 1, pad); });
      return img; }
    return armor0(img, a, ar); }
  function armor0(img, a, ar) {
    var T = torso(a); if (!T.rows.length) return img; var sh = mix(ar.metal, '#000000', 0.3), y0 = T.rows[0].y;
    T.rows.forEach(function (q) { q.xs.forEach(function (x) { if (!free(a, x, q.y)) return;
      put(img, x, q.y, q.y === y0 || x === 15 || x === 16 ? ar.trim : (x >= q.r - 1 ? sh : x === q.l + 1 ? mix(ar.metal, '#ffffff', 0.35) : ar.metal)); }); });
    var f = T.rows[0]; [f.l, f.l + 1, f.r - 1, f.r].forEach(function (x) { if (free(a, x, y0)) put(img, x, y0, ar.trim); if (y0 - 1 > eyeY(a) + 1 && free(a, x, y0 - 1)) put(img, x, y0 - 1, ar.trim); }); /* shoulder pads, on the body only */
    if (T.rows.length >= 4) { put(img, 15, y0 + 2, '#e8344f'); put(img, 16, y0 + 2, '#e8344f'); }
    return img; }
  // ---------------------------------------------------------------- capes
  function pal(base, trim) { return { base: base, shade: mix(base, '#000000', 0.25), dark: mix(base, '#000000', 0.45), hi: mix(base, '#ffffff', 0.3), trim: trim }; }
  var DETAIL = {
    lily: function (u, t, x, y, p) { // lily-pad veins radiating from the collar + a small pink flower near the hem
      if (t > 0.15 && Math.abs(Math.abs(u) - t * 0.9) < 0.09) return p.hi; if (t > 0.2 && Math.abs(u) < 0.05) return p.hi;
      return null; },
    stars: function (u, t, x, y) { return ((x * 7 + y * 13) % 23 === 0 && t > 0.15 && t < 0.9) ? '#ffffff' : ((x * 5 + y * 11) % 31 === 0 && t > 0.15) ? '#9fd8ff' : null; },
    feather: function (u, t, x, y, p) { return t > 0.3 && (y + Math.abs(Math.round(u * 6))) % 4 === 0 ? p.hi : null; },
    paper: function (u, t, x, y) { return t > 0.15 && t < 0.92 && y % 3 === 0 && (x * 3 + y) % 7 > 1 ? '#a89a78' : null; },
    crease: function (u, t, x, y) { return ((x - y) % 5 === 0 || (x + y) % 7 === 0) && t > 0.1 ? '#cfc3a3' : null; },
    wow: function (u, t, x, y) { return t > 0.2 && t < 0.92 && (x * 7 + y * 5) % 13 === 0 ? ['#ff8fd0', '#5fd35f', '#4f9dff'][(x + y) % 3] : null; }, fur: function (u, t, x, y, p) { return t > 0.1 && (x * 5 + y * 3) % 7 === 0 ? p.hi : (x * 3 + y * 7) % 11 === 0 ? p.dark : null; }, /* star batch 2026-10-16: bear-hide tufts */
    blanket: function (u, t, x, y) { var b = Math.floor(t * 7); return b === 2 || b === 4 ? '#4f9dff' : b === 3 ? '#ffffff' : null; }, /* saddle blanket: woven blue/white bands */
    net: function (u, t, x, y) { if (t > 0.88 && x % 4 === 1) return '#ff7a1a'; return t > 0.08 && ((x + y) % 3 === 0 || (x - y + 30) % 3 === 0) ? '#d8c89a' : null; }, /* fishing net: rope mesh + orange floats */
    airmail: function (u, t, x, y) { return t > 0.82 ? ((x + y) % 4 < 2 ? '#da291c' : '#2e5fbf') : null; }, /* airmail chevron hem */
    hood: null, plain: null, royal: function (u, t, x, y) { return t > 0.85 && x % 2 === 0 ? '#ffffff' : null; }, sun: function (u, t, x, y) { return t > 0.4 && t < 0.6 && Math.abs(u) < 0.15 ? '#fff1a8' : null; }
  };
  var CAPES = {
    'v2-pepe-cape': { p: pal('#2f9f5f', '#c9a54a'), d: 'lily', flower: true, hem: 'leaf' },          // Lily-pad cape
    'v2-dodo-cape': { p: pal('#2b2b33', '#da291c'), d: 'feather', hem: 'feather' },                     // Black-swan wing cape
    'v2-nakamoto-cape': { p: pal('#f4ecd8', '#f7931a'), d: 'paper', hem: 'flat' },                      // Whitepaper cape
    'v2-wojak-cape': { p: pal('#8d96a8', '#d8dde8'), d: 'hood', hood: true, hem: 'flat', short: true },  // Ash hoodie with hood
    'paper-cape': { p: pal('#f4ecd8', '#a89a78'), d: 'crease', hem: 'torn' },                           // Paper-hands cape
    red: { p: pal('#b8322a', '#e8b04a'), d: 'plain', hem: 'point' }, blue: { p: pal('#2e5fbf', '#d0d6e0'), d: 'plain', hem: 'point' },
    green: { p: pal('#2f7f4f', '#c9a54a'), d: 'feather', hem: 'leaf' }, purple: { p: pal('#6a3fb5', '#d0d6e0'), d: 'plain', hem: 'point' },
    royal: { p: pal('#5b2a86', '#ffd23f'), d: 'royal', hem: 'flat' }, midnight: { p: pal('#1b1f4a', '#9fd8ff'), d: 'stars', hem: 'point' },
    goldcape: { p: pal('#d9a521', '#fff1a8'), d: 'sun', hem: 'point' },
    // polish pass 2026-10-14: ★ signature capes use the fitted cape (drapes past the body at every stage instead of hiding behind it)
    'sig-pepe-cape': { p: pal('#2f9f5f', '#ffd23f'), d: 'royal', hem: 'flat' },        // Rare Pepe trading-card cape: green card, gold frame
    'sig-wojak-cape': { p: pal('#f29ab8', '#ffffff'), d: 'crease', hem: 'torn' },       // Pink-wojak sell-wall cape
    'sig-chud-cape': { p: pal('#2a2a30', '#e03030'), d: 'plain', hem: 'flat', short: true }, // Gamer chair back: black with red racing trim
    'sig-bobo-cape': { p: pal('#c0392b', '#3a2a20'), d: 'plain', hem: 'point' },        // Red-candle cape
    'sig-mumu-cape': { p: pal('#2f9f4f', '#ffd23f'), d: 'sun', hem: 'point' },          // Matador-green cape
    'sig-dodo-cape': { p: pal('#2b2b33', '#e8b04a'), d: 'feather', hem: 'feather' },    // Black-swan wings: gold-trimmed (contrast on the black bird)
    'sig-kevin-cape': { p: pal('#f4ecd8', '#8a5a2b'), d: 'paper', hem: 'point' },       // Stamp cape: perforated paper, brown frame
    'sig-sarutobi-cape': { p: pal('#f4f4f8', '#9fd8ff'), d: 'plain', hem: 'leaf' },     // Somersault cloud: puffy white cloud cape, sky trim, scalloped hem
    'sig-peepo-cape': { p: pal('#f29ac8', '#ffffff'), d: 'plain', hem: 'flat' },        // Pink blanket-fort cape
    'sig-doge-cape': { p: pal('#c2a633', '#ffffff'), d: 'wow', hem: 'point' },          // Much-wow cape (sig shuffle 2026-10-16): Dogecoin gold, white trim, Comic-Sans colour flecks
    // star gear batch 2026-10-16 (open companion pieces, V2Gear.STAR_BATCH): fitted so they read on every species
    'v2-bobo-hide': { p: pal('#6b4423', '#c8955a'), d: 'fur', hem: 'torn' },             // Bear-hide cloak: brown fur, tufts, ragged hem
    'v2-mumu-blanket': { p: pal('#e07a2a', '#ffffff'), d: 'blanket', hem: 'flat', short: true }, // Saddle blanket: orange wool, blue/white woven bands
    'v2-snibby-net': { p: pal('#2c4a5a', '#d8c89a'), d: 'net', hem: 'torn' },           // Fishing-net cape: rope mesh over sea blue, orange floats
    'v2-kevin-airmail': { p: pal('#dcecfb', '#2e5fbf'), d: 'airmail', hem: 'flat' },     // Airmail cape: pale-blue envelope paper, red/blue chevron hem
    'sig-nakamoto-cape': { p: pal('#1e1e24', '#f7931a'), d: 'paper', hem: 'flat' }      // Genesis-block cloak: black with bitcoin-orange trim
  };
  function isCape(id) { return !!CAPES[id]; }
  /** cape(img, a, id, frame): the cape behind the body + base gear (a.isFg), flared, folded, trimmed, swaying on frames 2-3. */
  function cape(img, a, id, frame) {
    var C = CAPES[id]; if (!C || a.maxX < 0) return img; var p = C.p, g = a.gear || {}, y0 = a.row(g.cape != null ? g.cape : g.armor[0]) - 1;
    var s0 = span(a, y0 + 1) || [12, 19], half0 = Math.max(3, Math.ceil((s0[1] - s0[0] + 1) / 2)), bot = Math.min(28, C.short ? y0 + Math.round((a.maxY - y0) * 0.6) : a.maxY);
    var sway = (frame || 0) % 4 >= 2 ? 1 : 0, L = {}, key = function (x, y) { return y * N + x; };
    var hwPrev = half0; for (var y = y0; y <= bot; y++) { var t = (y - y0) / Math.max(1, bot - y0), sy = span(a, y), bh = sy ? Math.ceil((sy[1] - sy[0] + 1) / 2) : hwPrev; hwPrev = Math.max(hwPrev, Math.min(bh, half0 + 6));
      var hw = Math.round(hwPrev + 1 + t * 3), off = t > 0.5 ? sway : 0, cx = 16 + off;
      /* sprite-leftovers 2026-10-20 (owner, Dodo Elder): a hoodie (C.hood) is worn, so it hugs the body: at most 2 px past the body's own span on each row
       * and never on the canvas edge columns (wide bodies such as Dodo's Elder/Mythic used to get a full-width band). Other capes unchanged. */
      var hl = -99, hr = 99; if (C.hood) { var hs = sy || span(a, Math.min(a.maxY - 1, y)) || [cx - hw, cx + hw]; hl = Math.max(1, hs[0] - 2); hr = Math.min(N - 2, hs[1] + 2); }
      for (var x = Math.max(hl, Math.round(cx - hw)); x < Math.min(hr + 1, Math.round(cx + hw)); x++) { var u = (x + 0.5 - cx) / hw, col;
        if (y === bot) { if (C.hem === 'point' && Math.abs(Math.round(u * 4)) % 2 === 1) continue; if (C.hem === 'leaf' && (x + off) % 3 === 0) continue;
          if (C.hem === 'feather' && (x + off) % 2 === 0) continue; if (C.hem === 'torn' && (x * 7) % 5 < 2) continue; }
        if (y - y0 < 2) col = p.trim; else if (y === bot || (y === bot - 1 && C.hem !== 'torn')) col = y === bot ? p.trim : p.dark;
        else { col = u > 0.72 ? p.dark : u < -0.8 ? p.hi : (Math.abs(u - 0.38) < 0.08 || Math.abs(u + 0.38) < 0.08) ? p.shade : Math.abs(u) < 0.06 && t > 0.3 ? p.shade : p.base;
          var dd = DETAIL[C.d]; var dc = dd ? dd(u, t, x, y, p) : null; if (dc) col = dc; }
        L[key(x, y)] = col; } }
    if (C.flower) { var fx = 16 + sway + Math.round((half0 + 3) * 0.45), fy = bot - 3; [[0, -1], [-1, 0], [1, 0], [0, 1]].forEach(function (q) { L[key(fx + q[0], fy + q[1])] = '#ff8fd0'; }); L[key(fx, fy)] = '#ffd23f'; }
    /* sprite-leftovers 2026-10-20: the hood wraps the HEAD only. A row that sticks out more than 3 px past the head top (rows minY+1..minY+5) on a side is a
     * beak or snout (Dodo, Doge): the hood stops at the head there instead of wrapping it to the canvas edge. */
    var ht = null; if (C.hood) for (var hy = a.minY + 1; hy <= a.minY + 5; hy++) { var hsp = span(a, hy); if (hsp) ht = ht ? [Math.min(ht[0], hsp[0]), Math.max(ht[1], hsp[1])] : hsp.slice(); }
    if (C.hood) { var ey = eyeY(a); for (var yy = a.minY - 2; yy <= ey + 2; yy++) { var sp = span(a, Math.max(yy, a.minY + 1)); if (!sp) continue; var ex = yy === a.minY - 2 ? -2 : yy === a.minY - 1 ? 0 : 2;
        if (ht) sp = [sp[0] < ht[0] - 3 ? ht[0] : sp[0], sp[1] > ht[1] + 3 ? ht[1] : sp[1]];
        for (var xx = sp[0] - ex; xx <= sp[1] + ex; xx++) L[key(xx, yy)] = yy <= a.minY - 1 ? p.shade : (xx <= sp[0] - 1 ? p.hi : xx >= sp[1] + 1 ? p.dark : p.base); } }
    if (C.hood) Object.keys(L).forEach(function (k) { var x = k % N; if (x < 2 || x > N - 3) delete L[k]; }); /* hoodies (and their ink line) keep off the edge columns (sprite-leftovers) */
    var bg = function (x, y) { return x >= 0 && y >= 0 && x < N && y < N && !(a.isFg ? a.isFg(x, y) : a.isSil(x, y)); };
    Object.keys(L).forEach(function (k) { var x = k % N, y = Math.floor(k / N); if (bg(x, y)) put(img, x, y, L[k]); });
    Object.keys(L).forEach(function (k) { var x = k % N, y = Math.floor(k / N); if (C.hood && !bg(x, y)) return; /* hoodie: ink only around cloth that shows (no lone ink dots) */ [[1, 0], [-1, 0], [0, 1]].forEach(function (q) { var nx = x + q[0], ny = y + q[1];
      if (L[key(nx, ny)] == null && bg(nx, ny) && ny <= 29 && nx >= 0 && nx < N) put(img, nx, ny, INK); }); });
    return img; }
  return { torso: torso, outfit: outfit, armor: armor, cape: cape, isCape: isCape, CAPES: CAPES, mix: mix };
});
