/* Doom Week gear art (display only). These pieces are NOT in V2Gear.ITEMS and NOT in any roll pool.
 * js/v2-rules.js does not know their names, so replay is unchanged and nobody's pet receives them.
 * Maps use BonusGear colour keys that stay in the Bitcoin red family: Q #da291c, r #b3121a, R #ff2a2a, w white, n ink.
 * No orange keys (O, E, y, g). The cape itself is drawn by V2Fit from the roster anchors.
 * The flag uses the same pole, cloth size, shape and banner placement as the other flags
 * (js/v2-gear.js flag(), drawn with at:'banner'). Only the cloth is red, with DOOM in white. */
(function (root) {
  'use strict';
  var SKY = '#14060c';
  /* Same builder as V2Gear.flag: gold top stitch, wood pole, 3x5 letters, 22-row pole. */
  var FONT = { D: ['ww.', 'w.w', 'w.w', 'w.w', 'ww.'], O: ['www', 'w.w', 'w.w', 'w.w', 'www'], M: ['w.w', 'www', 'www', 'w.w', 'w.w'] };
  function flagMap(word, bg, edge, ink) {
    var rows = ['y' + new Array(word.length * 4 + 2).join(bg)], j, i;
    for (j = 0; j < 5; j++) { var r = 'L' + bg; for (i = 0; i < word.length; i++) r += FONT[word[i]][j].replace(/\./g, bg).replace(/w/g, ink) + bg; rows.push(r); }
    rows.push('L' + new Array(word.length * 4 + 2).join(edge));
    for (j = 0; j < 22; j++) rows.push(j % 3 ? 'L' : 'l');
    return rows;
  }
  var FLAG = flagMap('DOOM', 'Q', 'r', 'w');
  var DEFS = {
    'doom-flag': { slot: 'back', tier: 1, label: 'Doom flag', at: 'banner', kind: 'banner', map: FLAG },
    'doom-candle-hat': { slot: 'head', tier: 1, label: 'Red candle hard hat', at: 'head', dy: 0, kind: 'hat',
      map: ['....w....', '...wRw...', '....n....', '..QQQQQ..', '.QQQQQQQ.', '.QQnnnQQ.', 'nnnnnnnnn'] },
    'doom-shades': { slot: 'face', tier: 1, label: 'Doom shades', at: 'eyes', kind: 'face',
      map: ['QQQQ.QQQQ', 'QnZQ.QnZQ', '.QQ...QQ.'] },
    'doom-candle-cape': { slot: 'back', tier: 2, label: 'Red candle cape', at: 'cape', kind: 'cape',
      map: ['..Q..', '.QQQ.', 'QQQQQ', 'QrQrQ', 'QQQQQ', 'QwQwQ'] }
  };
  var IDS = ['doom-flag', 'doom-candle-hat', 'doom-shades', 'doom-candle-cape'];
  var SHOW = ['doom-candle-cape', 'doom-flag', 'doom-candle-hat', 'doom-shades'];
  function install() {
    var BG = root.BonusGear; if (!BG || !BG.DEFS) return;
    Object.keys(DEFS).forEach(function (id) { if (!BG.DEFS[id]) BG.DEFS[id] = DEFS[id]; });
  }
  function hex(h) { h = String(h || '#000').replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function keyColor(k) { var C = root.BonusGear && root.BonusGear.COLORS; return (C && C[k]) || '#c8102e'; }
  function put(img, x, y, h) {
    if (x < 0 || y < 0 || x > 31 || y > 31 || !h) return;
    var c = hex(h), i = (y * 32 + x) * 4; img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
  }
  function scaleMap(map, k) {
    if (!map || k == null || k >= 0.98) return map;
    var h = map.length, w = map[0].length, nh = Math.max(3, Math.round(h * k)), nw = Math.max(3, Math.round(w * k)), out = [], y, x, row;
    for (y = 0; y < nh; y++) { row = ''; var sy = Math.min(h - 1, Math.floor(y * h / nh));
      for (x = 0; x < nw; x++) row += map[sy].charAt(Math.min(w - 1, Math.floor(x * w / nw))); out.push(row); }
    return out;
  }
  function scaleTo(map, nw, nh) {
    var h = map.length, w = map[0].length, out = [], y, x, row;
    nw = Math.max(1, nw); nh = Math.max(1, nh);
    for (y = 0; y < nh; y++) { row = ''; var sy = Math.min(h - 1, Math.floor(y * h / nh));
      for (x = 0; x < nw; x++) row += map[sy].charAt(Math.min(w - 1, Math.floor(x * w / nw))); out.push(row); }
    return out;
  }
  function blit(img, x0, y0, map, ink) {
    var y, x, k, h;
    for (y = 0; y < map.length; y++) for (x = 0; x < map[y].length; x++) {
      k = map[y].charAt(x); if (k && k !== '.') put(img, x0 + x, y0 + y, keyColor(k));
    }
    if (!ink) return;
    for (y = 0; y < map.length; y++) for (x = 0; x < map[y].length; x++) {
      if (map[y].charAt(x) !== '.') continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) { var X = x + d[0], Y = y + d[1]; return map[Y] && map[Y].charAt(X) && map[Y].charAt(X) !== '.'; })) put(img, x0 + x, y0 + y, '#1a1020');
    }
  }
  function blank(color) {
    var img = { width: 32, height: 32, data: new Uint8ClampedArray(32 * 32 * 4) }, c = hex(color || SKY), i;
    for (i = 0; i < 1024; i++) { img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255; }
    return img;
  }
  function applyMapped(id, img, a, map) {
    var BG = root.BonusGear, tmp = id + '~doom';
    BG.DEFS[tmp] = Object.assign({}, DEFS[id], { map: map });
    BG.apply(tmp, img, a, 0);
  }
  function eyeTop(a) { var t = 99; [a.eyeL, a.eyeR].forEach(function (e) { if (e && e[2]) e[2].forEach(function (p) { if (p[1] < t) t = p[1]; }); else if (e) t = Math.min(t, e[1]); }); return t > 40 ? null : t; }
  function headView(a, species) {
    var spec = root.V2Fit && V2Fit.doomAnchor ? V2Fit.doomAnchor(species, 'head') : { lift: 1 };
    var map = spec.scale ? scaleMap(DEFS['doom-candle-hat'].map, spec.scale) : DEFS['doom-candle-hat'].map;
    if (spec.aboveEyes != null) {
      var et = eyeTop(a); if (et == null) et = a.minY + 4;
      return { map: map, a: Object.assign({}, a, { minY: et - spec.aboveEyes }) };
    }
    var lift = spec.lift || 0, src = a;
    if (!lift) return { map: map, a: a };
    return { map: map, a: Object.assign({}, a, { minY: Math.max(0, a.minY - lift), isSil: function (x, y) { return src.isSil(x, y + lift); } }) };
  }
  function drawShades(img, a, species) {
    var spec = root.V2Fit && V2Fit.doomAnchor ? V2Fit.doomAnchor(species, 'face') : {};
    var map = DEFS['doom-shades'].map, eL = a.eyeL, eR = a.eyeR;
    if (!eL || !eR) { root.BonusGear.apply('doom-shades', img, a, 0); return; }
    var y = Math.round((eL[1] + eR[1]) / 2) - 1 + (spec.dy || 0);
    var x0 = Math.min(eL[0], eR[0]) - 2, x1 = Math.max(eL[0], eR[0]) + 2;
    blit(img, x0, y, scaleTo(map, Math.max(map[0].length, x1 - x0 + 1), map.length), false);
  }
  function skyPaint(img) {
    var d = img.data, bg = hex(SKY), y, x, i, c;
    for (y = 0; y < 32; y++) for (x = 0; x < 32; x++) {
      i = (y * 32 + x) * 4;
      if (d[i] === bg[0] && d[i + 1] === bg[1] && d[i + 2] === bg[2]) {
        c = y < 8 ? hex('#3a0a12') : y < 18 ? hex('#24080e') : hex('#14060c');
        d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
      } else if (d[i] === 149 && d[i + 1] === 118 && d[i + 2] === 40) {
        c = hex('#770c1f'); d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
      }
    }
  }
  /* Small falling chart and a down arrow, fixed in the lower right of the cell. */
  function cornerChart(img) {
    var x0 = 23, y0 = 23;
    [[0, 0, 7], [2, 2, 5], [4, 4, 3]].forEach(function (c) {
      put(img, x0 + c[0], y0 + c[1], '#ffffff');
      put(img, x0 + c[0], y0 + c[1] + 1, '#ff2a2a');
      for (var k = 2; k < c[2]; k++) put(img, x0 + c[0], y0 + c[1] + k, '#c8102e');
    });
    put(img, x0 + 7, y0 + 2, '#ff2a2a'); put(img, x0 + 7, y0 + 3, '#ff2a2a'); put(img, x0 + 7, y0 + 4, '#ff2a2a');
    put(img, x0 + 6, y0 + 5, '#ff2a2a'); put(img, x0 + 7, y0 + 5, '#c8102e'); put(img, x0 + 8, y0 + 5, '#ff2a2a');
    put(img, x0 + 7, y0 + 6, '#8e0b20');
  }
  function dress(img, a, species, frame) {
    var F = root.V2Fit;
    a.isFg = a.isFg || a.isSil;
    if (F && F.isCape && F.isCape('doom-candle-cape')) F.cape(img, a, 'doom-candle-cape', frame || 0);
    install();
    if (root.BonusGear) root.BonusGear.apply('doom-flag', img, a, frame || 0);
    skyPaint(img);
    cornerChart(img);
    return img;
  }
  function frames(pet, stage) {
    stage = stage | 0;
    if (!pet || stage < 1) return null;
    var PC = root.PetCore; if (!PC || !PC.render || !root.BonusGear) return null;
    var species = pet.species, sp = (PC.SPECIES || []).filter(function (s) { return s.id === species; })[0];
    if (!sp) return null;
    install();
    var out = [], f, base, key, eyes, bare, eyeImg, a, vis, img;
    for (f = 0; f < 4; f++) {
      base = Object.assign({}, pet, { band: 'none', crown: 'none', armor: 'none', cape: 'none', weapon: 'none', background: 'solid', bgColor: SKY, pattern: 'none' });
      key = Object.assign({}, base, { bgColor: '#ff00ff', eyes: 'classic' });
      eyes = Object.assign({}, key, { eyes: 'star' });
      try {
        bare = PC.render(key, { stage: stage, frame: f, gearCap: 0 });
        eyeImg = PC.render(eyes, { stage: stage, frame: f, gearCap: 0 });
        a = root.BonusGear.anchors(bare, eyeImg, sp);
      } catch (e) { return null; }
      if (!a || a.maxX < 0) return null;
      a.spId = species; a.stage = stage;
      vis = PC.render(base, { stage: stage, frame: f, gearCap: 0 });
      img = { width: 32, height: 32, data: new Uint8ClampedArray(vis.data) };
      dress(img, a, species, f);
      out.push(img);
    }
    return out;
  }
  function icon(id) {
    install();
    var map = DEFS[id] && DEFS[id].map; if (!map) return null;
    var img = blank('#10080c'), y0 = Math.max(0, Math.floor((32 - map.length) / 2)), x0 = Math.max(0, Math.floor((32 - map[0].length) / 2));
    blit(img, x0, y0, map, true);
    return img;
  }
  root.DoomGear = { IDS: IDS, SHOW: SHOW, DEFS: DEFS, SKY: SKY, install: install, frames: frames, icon: icon, dress: dress };
})(typeof window !== 'undefined' ? window : this);
