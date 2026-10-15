/* XCPETS play demo EXTRA gear (demo/promo only; the main pet-core never rolls these).
 * Ported from the gear preview (meme-gear.js + sig-gear.js): pixel maps drawn as overlay layers on top of a PetCore frame.
 * Shared items roll for every species; signature items (species: ...) roll and equip only on their own species.
 * Rarities (tier 0-3) were assigned for the demo; the preview files had none (except the bonus-slot items set earlier).
 * Anchors (silhouette, eyes, rows) come from a gear-less render of the same frame on a flat key colour with star eyes,
 * so every overlay follows the head/hands at each stage and moves with the bounce. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.BonusGear = factory();
})(this, function () {
  'use strict';
  var N = 32, INK = '#1a1020', KEY_BG = '#ff00ff';
  var COLORS = {
    R: '#ff2a2a', r: '#b3121a', w: '#ffffff', p: '#ffb0b0',
    C: '#2a9fd0', c: '#6fe3ff', W: '#e9fbff',
    O: '#ff7a1a', o: '#c4520a', L: '#8a5a2b', l: '#c8955a', y: '#ffd23f',
    E: '#f7931a', e: '#c46a00', Y: '#ffc65c', B: '#6a3200',
    P: '#f4ecd8', F: '#cfc3a3', T: '#a89a78',
    K: '#ff8fd0', k: '#d94fa0', H: '#ffc4e6',
    n: '#1a1020', g: '#ffd23f', G: '#c98a00', v: '#8e44d1', V: '#5b2a86', m: '#2f9f5f', M: '#5fd35f', b: '#4f9dff', D: '#8d96a8',
    d: '#d8dde8', Z: '#2b2b33', Q: '#da291c', q: '#ffc72c', s: '#b8b8c8', a: '#ffe135', A: '#c9a000', U: '#f6c2a8', u: '#d0806a',
    X: '#5e3f26', i: '#e8344f', j: '#3b3552', h: '#ffcc00', z: '#e69500', t: '#2ec4b6'
  };
  // tier: 0 Common, 1 Uncommon, 2 Rare, 3 Legendary.
  var DEFS = {
    'beam-eyes': { slot: 'face', tier: 3, label: 'Beam eyes', at: 'beam' },
    'hw-amulet': { slot: 'face', tier: 2, label: 'Hard-wallet amulet', at: 'neck', map: ['D.......D', '.D.....D.', '..DZZZD..', '...ZtZ...', '...ZtZ...', '...ZZZ...'] },
    'hodl-banner': { slot: 'back', tier: 1, label: 'HODL banner', at: 'banner' },
    'paper-cape': { slot: 'back', tier: 2, label: 'Paper-hands cape', at: 'papercape' },
    'sats-stack': { slot: 'feet', tier: 1, label: 'Stack of sats', at: 'sats' },
    'xcp-coin': { slot: 'feet', tier: 0, label: 'Counterparty coin', at: 'coin', map: ['.iiiii.', 'iwiiiwi', 'iiwiwii', 'iiiwiii', 'iiwiwii', 'iwiiiwi', '.iiiii.'] },
    'diamond-hands': { slot: 'weapon', tier: 2, label: 'Diamond hands', at: 'handR', map: ['.WWc.', 'WWcCC', 'cWcCC', 'CcCCC', '.CCC.'] },
    // ---- signature items (own species only)
    'pimp-hat': { slot: 'crown', tier: 3, species: 'pepe', label: 'Pepe Cash pimp hat', at: 'head', map: ['......K..', '......K..', '..VVVVK..', '..VvvvV..', '..VvvvV..', '..ggggg..', 'VVVVVVVVV'] },
    'feels-mug': { slot: 'weapon', tier: 1, species: 'pepe', label: '"Feels good" mug', at: 'handR', map: ['.s.s..', 's.s...', 'wwww..', 'wwwwww', 'wKKw.w', 'wKKwww', 'wwww..', 'dddd..'] },
    'rare-card': { slot: 'weapon', tier: 2, species: 'pepe', label: 'Rare Pepe card', at: 'handL', map: ['gggggg', 'gMMMMg', 'gwnwng', 'gMMMMg', 'gQQQQg', 'gMMMMg', 'gddddg', 'gggggg'] },
    'hard-hat': { slot: 'crown', tier: 1, species: 'wojak', label: 'Hard hat', at: 'head', dy: 2, map: ['...hhh...', '..hhwhh..', '.hhhwhhh.', '.hhhhhhh.', 'AAAAAAAAA'] },
    'mcd-visor': { slot: 'crown', tier: 2, species: 'wojak', label: 'McDonald\'s visor', at: 'head', dy: 3, map: ['QQQQQQQQQ...', 'QQqQQQqQQ...', 'QQqqQqqQQ...', 'QQqQqQqQQQQQ'] },
    'doomer-beanie': { slot: 'crown', tier: 3, species: 'wojak', label: 'Doomer beanie + cig', at: 'head', dy: 3, map: ['...ZZZ...', '.ZZZZZZZ.', 'ZZZZZZZZZ', 'ZZZZZZZZZ', 'sZsZsZsZs'],
      extra: { at: 'mouth', dx: 2, map: ['....s', '...s.', 'wwwwO'] } },
    'its-over': { slot: 'weapon', tier: 1, species: 'wojak', label: 'Red "it\'s over" chart', at: 'handR', map: ['DDDDDDDD', 'DQZZZZZD', 'DZQZZZZD', 'DZZQQZZD', 'DZZZZQZD', 'DZZZZZQD', 'DDDDDDDD', '...X....', '...X....'] },
    'headset': { slot: 'crown', tier: 2, species: 'chud', label: 'Gamer headset', at: 'headset' },
    'energy-can': { slot: 'weapon', tier: 1, species: 'chud', label: 'Energy-drink can', at: 'handR', map: ['dddd', 'ZZZZ', 'ZMZZ', 'ZMMZ', 'ZZMZ', 'ZZZZ', 'dddd'] },
    'based-cap': { slot: 'crown', tier: 3, species: 'chud', label: '"Based" trucker cap', at: 'head', dy: 3, map: ['..ZZwwwww..', '.Zwwnnwwww.', '.ZwwnwnwwwZ', '.ZwwnnwwwwZ', '.ZwwnwnwwwZ', '.ZwwnnwwwwZ', 'QQQQQQQQQQQQQ'] },
    'bear-claw': { slot: 'weapon', tier: 2, species: 'bobo', label: 'Bear claw', at: 'handR', map: ['w.w.w', 'wXwXw', 'XXXXX', 'XuXuX', 'XXXXX', '.XXX.'] },
    'red-dagger': { slot: 'weapon', tier: 3, species: 'bobo', label: 'Red-candle dagger', at: 'handL', map: ['.n.', 'QQQ', 'QQQ', 'QiQ', 'QQQ', 'QQQ', '.n.', 'DDD', '.X.', '.X.'] },
    'short-hat': { slot: 'crown', tier: 3, species: 'bobo', label: 'Short-seller top hat', at: 'head', dy: 2, map: ['..ZZZZZ..', '..ZZZZZ..', '..ZZZZZ..', '..QQQQQ..', '..ZZZZZ..', 'ZZZZZZZZZ'] },
    'green-staff': { slot: 'weapon', tier: 3, species: 'mumu', label: 'Green-candle staff', at: 'tallR', map: ['..n..', '.mMm.', '.mMm.', '.mMm.', '.mMm.', '.mMm.', '..n..', '..X..', '..X..', '..X..', '..X..', '..X..', '..X..', '..X..', '..X..'] },
    'nose-ring': { slot: 'face', tier: 2, species: 'mumu', label: 'Gold nose ring', at: 'nose', map: ['g...g', 'g...g', '.ggg.'] },
    'moon-cap': { slot: 'crown', tier: 2, species: 'mumu', label: '"To the moon" horn cap', at: 'head', dy: 2, map: ['w.......w', 'w.bbbbb.w', 'wbbgbbbbw', '.bgbbbbb.', '.bbgbbbb.', 'bbbbbbbbb'] },
    'chart-shield': { slot: 'weapon', tier: 2, species: 'snibby', label: 'Sideways-chart shield', at: 'handL', map: ['DDDDDDD', 'DbbbbbD', 'DbbbbbD', 'DMMMMMD', 'DbbbbbD', '.DbbbD.', '..DDD..'] },
    'shell-helm': { slot: 'crown', tier: 3, species: 'snibby', label: 'Seashell helmet', at: 'head', dy: 2, map: ['...UUU...', '.UuUuUuU.', 'UUuUuUuUU', 'UuUuUuUuU', 'UuUuUuUuU', '..uuuuu..'] },
    'swan-quill': { slot: 'weapon', tier: 3, species: 'dodo', label: 'Black Swan quill', at: 'handR', map: ['....Z', '...ZZ', '..ZZj', '.ZZj.', '.Zj..', 'Zj...', 'd....', 'n....'] },
    'event-card': { slot: 'weapon', tier: 2, species: 'dodo', label: '"?" event card', at: 'handL', map: ['vvvvv', 'vwwwv', 'vvvwv', 'vvwwv', 'vvwvv', 'vvvvv', 'vvwvv', 'vvvvv'] },
    'name-tag': { slot: 'band', tier: 1, species: 'kevin', label: 'KEVIN name tag', at: 'chest', dx: 2, map: ['QQQQQ', 'wwwww', 'wnwnw', 'wwwww'] },
    'cp-stamp': { slot: 'weapon', tier: 2, species: 'kevin', label: 'Copy-paste stamp', at: 'handR', map: ['.XXX.', '.XXX.', '..X..', 'DDDDD', 'QQQQQ'] },
    'clone-mirror': { slot: 'weapon', tier: 3, species: 'kevin', label: 'Clone mirror', at: 'handL', map: ['.ggg.', 'gcWcg', 'gcccg', 'gccWg', 'gcccg', '.ggg.', '..X..', '..X..'] },
    'bino-hat': { slot: 'crown', tier: 2, species: 'peepo', label: 'Binoculars hat', at: 'head', dy: 1, map: ['.ZZZ.ZZZ.', '.ZcZ.ZcZ.', '.ZZZZZZZ.', '..bbbbb..', '.bbbbbbb.', 'bbbbbbbbbb'] },
    'party-hat': { slot: 'crown', tier: 1, species: 'peepo', label: 'Party hat', at: 'head', dy: 1, map: ['....g....', '...KKK...', '...KbK...', '..KKKKK..', '..bKKKb..', '.KKKKKKK.', 'gggggggg.'] },
    'pink-sweater': { slot: 'armor', tier: 3, species: 'peepo', label: 'Pink peeking sweater', at: 'pinksweater' },
    'ninja-band': { slot: 'band', tier: 2, species: 'sarutobi', label: 'Ninja headband', at: 'ninja' },
    'banana-katana': { slot: 'weapon', tier: 3, species: 'sarutobi', label: 'Banana katana', at: 'tallR', map: ['...a', '..aa', '..aA', '.aA.', '.aA.', 'aA..', 'aA..', 'aA..', 'X...', 'Z...', 'Z...'] },
    'smoke-sandals': { slot: 'feet', tier: 2, species: 'sarutobi', label: 'Smoke-bomb sandals', at: 'feetBoth', map: ['s.s.', 'ssss', '.ss.', 'XXXX'] },
    'wow-bandana': { slot: 'band', tier: 1, species: 'doge', label: '"Wow" bandana', at: 'neck', map: ['QQQQQQQQQ', '.QwQQQwQ.', '..QQwQQ..', '...QQQ...', '....Q....'] },
    'moon-rocket': { slot: 'weapon', tier: 3, species: 'doge', label: 'Moon rocket', at: 'handL', map: ['.w.', 'wQw', 'www', 'wbw', 'www', 'QwQ', 'O.O', 'y.y'] },
    'stick': { slot: 'weapon', tier: 0, species: 'doge', label: 'Stick', at: 'mouth', dx: -1, map: ['X...........', 'lXXlXXlXXlXl', '..........X.'] },
    'lenny-monocle': { slot: 'face', tier: 2, species: 'lenny', label: 'Lenny-face monocle', at: 'monocle' },
    'smug-cap': { slot: 'crown', tier: 1, species: 'lenny', label: 'Smug cap', at: 'head', dy: 2, map: ['..XXXXXX...', '.XXlXXXXXX.', 'XXXXXXXXXXXX'] }
  };
  var BANNER = (function () {
    var G = { H: ['w.w', 'w.w', 'www', 'w.w', 'w.w'], O: ['www', 'w.w', 'w.w', 'w.w', 'www'],
      D: ['ww.', 'w.w', 'w.w', 'w.w', 'ww.'], L: ['w..', 'w..', 'w..', 'w..', 'www'] };
    var rows = [], word = 'HODL', j, i, t;
    rows.push('y' + new Array(18).join('O'));
    for (j = 0; j < 5; j++) { var s = 'LO'; for (i = 0; i < 4; i++) s += G[word[i]][j].replace(/\./g, 'O') + 'O'; rows.push(s); }
    rows.push('L' + new Array(18).join('o'));
    for (t = 0; t < 22; t++) rows.push(t % 3 ? 'L' : 'l');
    return rows.map(function (r) { return r.replace(/^O/, 'L'); });
  })();
  var SATS = ['.....eeeee..', '....eYYBYEe.', 'eeeeYYBBEEEe', 'EEEeYEBEBEEe', 'eeeeEEBBEEEe', 'EEEeEEBEBEEe', 'eeeeEEBBEEEe', 'EEEEeEEBEEe.', 'eeeeeeeeee..'];
  var ITEMS = Object.keys(DEFS).map(function (id) { var d = DEFS[id]; return { id: id, label: d.label, slot: d.slot, tier: d.tier, species: d.species || null }; });

  function hex(c) { c = c.replace('#', ''); return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)]; }
  function Layer() { this.c = []; for (var i = 0; i < N * N; i++) this.c.push(null); }
  Layer.prototype.set = function (x, y, k) { if (x >= 0 && y >= 0 && x < N && y < N) this.c[y * N + x] = k; };
  Layer.prototype.get = function (x, y) { return (x >= 0 && y >= 0 && x < N && y < N) ? this.c[y * N + x] : null; };
  Layer.prototype.sprite = function (x0, y0, rows) { for (var j = 0; j < rows.length; j++) for (var i = 0; i < rows[j].length; i++) if (rows[j][i] !== '.') this.set(x0 + i, y0 + j, rows[j][i]); };
  function blit(img, L, mask, outline) {
    var ink = hex(INK), x, y;
    for (y = 0; y < N; y++) for (x = 0; x < N; x++) {
      var i = y * N + x, k = L.c[i], c = null;
      if (k) c = hex(COLORS[k]);
      else if (outline !== false && (L.get(x + 1, y) || L.get(x - 1, y) || L.get(x, y + 1) || L.get(x, y - 1))) c = ink;
      if (!c || (mask && mask(x, y))) continue;
      img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2];
    }
  }
  function anchors(img, eyeImg, sp) {
    var bg = hex(KEY_BG), sil = [], minX = 99, maxX = -1, minY = 99, maxY = -1, x, y, d = img.data;
    for (y = 0; y < N; y++) for (x = 0; x < N; x++) {
      var i = (y * N + x) * 4, on = Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) > 40 && y < 29;
      sil.push(on); if (on) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    }
    var Lp = [], Rp = [], e = eyeImg.data;
    for (y = 0; y < N; y++) for (x = 0; x < N; x++) {
      var j = (y * N + x) * 4;
      if ((e[j] === 255 && e[j + 1] === 210 && e[j + 2] === 63) || (e[j] === 255 && e[j + 1] === 241 && e[j + 2] === 168)) (x < 16 ? Lp : Rp).push([x, y]);
    }
    function c(p) { if (!p.length) return null; var sx = 0, sy = 0; p.forEach(function (q) { sx += q[0]; sy += q[1]; }); return [Math.round(sx / p.length), Math.round(sy / p.length), p]; }
    var H = sp.map.length, h = maxY - minY - 1, top = minY + 1;
    return { minX: minX, maxX: maxX, minY: minY, maxY: maxY, eyeL: c(Lp), eyeR: c(Rp), gear: sp.gear,
      row: function (r) { return top + Math.floor(r * h / H); },
      isSil: function (x, y) { return x >= 0 && y >= 0 && x < N && y < N && sil[y * N + x]; } };
  }
  function headCx(a) { var sx = 0, n = 0; for (var y = a.minY + 1; y <= a.minY + 3; y++) for (var x = 0; x < N; x++) if (a.isSil(x, y)) { sx += x; n++; } return n ? Math.round(sx / n) + 0.5 : 16; }
  function eyeY(a) { return a.eyeL ? a.eyeL[1] : a.eyeR ? a.eyeR[1] : a.minY + 6; }
  function pos(at, m, a, it) {
    var w = m[0].length, h = m.length, hy = a.row(a.gear.armor[0]) + 2, cx = headCx(a);
    switch (at) {
      case 'head': return [Math.floor(cx - w / 2), a.minY - h + 1 + (it.dy || 0)];
      case 'handR': return [Math.min(N - w, a.maxX - 1), hy - Math.floor(h / 2)];
      case 'handL': return [Math.max(0, a.minX - w + 2), hy - Math.floor(h / 2)];
      case 'tallR': return [Math.min(N - w, a.maxX - 1), 28 - h];
      case 'neck': return [16 - Math.ceil(w / 2), a.row(a.gear.scarf)];
      case 'chest': return [16 - Math.ceil(w / 2), a.row(a.gear.armor[0]) + 1];
      case 'mouth': return [Math.floor(cx - w / 2), eyeY(a) + 4];
      case 'nose': return [Math.floor(cx - w / 2), eyeY(a) + 3];
      case 'eyes': return [Math.floor(cx - w / 2), eyeY(a) - 1];
      case 'coin': return [Math.min(N - 8, a.maxX - 1), 21];
    }
    return [0, 0];
  }
  function drawPaperCape(a, L) {
    var g = a.gear, top = a.row(g.cape != null ? g.cape : g.armor[0]) - 1, bottom = a.maxY - 1, half = Math.floor((a.maxX - a.minX - 1) / 2);
    for (var y = top; y <= bottom; y++) {
      var hw = Math.min(half + 5, half + 2 + Math.floor((y - top) / 2));
      for (var x = 16 - hw; x < 16 + hw; x++) {
        var k = ((x - y) % 4 === 0 || (x + y) % 7 === 0) ? 'F' : 'P';
        if (y === bottom && x % 3 === 0) continue;
        if (y === bottom - 1 && x % 5 === 1) continue;
        if (y === bottom) k = 'T';
        L.set(x, y, k);
      }
    }
  }
  /** Draw one extra item onto img (a PetCore frame, mutated). a = anchors(). */
  function apply(id, img, a, frame) {
    var it = DEFS[id], L = new Layer(), behind = function (x, y) { return a.isSil(x, y); }, x, y;
    if (!it || a.maxX < 0) return img;
    switch (it.at) {
      case 'papercape': {
        drawPaperCape(a, L); blit(img, L, behind);
        var F2 = new Layer(), ct = a.row(a.gear.cape != null ? a.gear.cape : a.gear.armor[0]) - 1, hh = Math.floor((a.maxX - a.minX - 1) / 2);
        F2.sprite(16 - hh - 1, ct, ['PP', 'PF', 'P.']); F2.sprite(16 + hh - 1, ct, ['PP', 'FP', '.P']); F2.sprite(15, ct, ['TT']); blit(img, F2);
        return img;
      }
      case 'banner':
        var BN = it.map || BANNER; // items may pass their own banner map; HODL banner unchanged
        L.sprite(Math.max(1, a.minX - 2), Math.max(0, 28 - BN.length + 1), BN);
        blit(img, L, function (x2, y2) { return a.isSil(x2, y2) && y2 > 7; }); return img;
      case 'sats': L.sprite(Math.min(N - 12, a.maxX - 3), 20, SATS); blit(img, L); return img;
      case 'beam':
        [a.eyeL, a.eyeR].forEach(function (e, n) {
          if (!e) return; var dir = n ? 1 : -1, ey = e[1], xs = e[2].map(function (p) { return p[0]; });
          e[2].forEach(function (p) { L.set(p[0], p[1], 'R'); }); L.set(e[0], ey, 'w');
          var start = dir < 0 ? Math.min.apply(null, xs) - 1 : Math.max.apply(null, xs) + 1;
          for (var x3 = start; x3 >= 0 && x3 < N; x3 += dir) {
            var d = Math.abs(x3 - start);
            L.set(x3, ey, d < 2 ? 'w' : 'p'); L.set(x3, ey - 1, 'R'); L.set(x3, ey + 1, 'R');
            if (d > 3 && (d + (frame || 0)) % 4 === 0) { L.set(x3, ey - 2, 'r'); L.set(x3, ey + 2, 'r'); }
          }
          L.set(start, ey - 2, 'R'); L.set(start, ey + 2, 'R');
        });
        blit(img, L, null, false); return img;
      case 'pinksweater': {
        var ey2 = Math.min(a.eyeL ? a.eyeL[1] : 99, a.eyeR ? a.eyeR[1] : 99); if (ey2 > 31) ey2 = a.minY + Math.round((a.maxY - a.minY) * 0.4);
        var eyeTop = Math.min(ey2 - 2, a.minY + 6);
        if (!(DEFS['pink-sweater'] && DEFS['pink-sweater'].sweaterOnly)) { // sweaterOnly flag (set by an installer): body part only; default unchanged
        for (y = a.minY - 1; y <= eyeTop; y++) for (x = a.minX - 1; x <= a.maxX + 1; x++)
          if (a.isSil(x, y) || a.isSil(x, y + 1) || a.isSil(x - 1, y) || a.isSil(x + 1, y)) L.set(x, y, y === eyeTop ? 'k' : 'K');
        L.set(16, a.minY - 2, 'K'); L.set(15, a.minY - 2, 'K'); }
        var t = a.row(a.gear.armor[0]);
        for (y = t; y <= a.maxY - 1; y++) for (x = a.minX; x <= a.maxX; x++) if (a.isSil(x, y) && a.isSil(x, y - 1)) L.set(x, y, (x === 15 || x === 16) && y < t + 3 ? 'H' : y === t ? 'k' : 'K');
        blit(img, L); return img;
      }
      case 'headset': {
        var hx = headCx(a), y0 = a.minY - 1, half = 0, ey = eyeY(a);
        for (x = 0; x < N; x++) if (a.isSil(x, ey)) half = Math.max(half, Math.abs(x + 0.5 - hx));
        half = Math.round(half);
        for (x = Math.round(hx - half); x < Math.round(hx + half); x++) L.set(x, y0, 'Z');
        for (y = y0; y < ey; y++) { L.set(Math.round(hx - half) - 1, y, 'Z'); L.set(Math.round(hx + half), y, 'Z'); }
        L.sprite(Math.round(hx - half) - 2, ey - 1, ['ZZ', 'ZM', 'ZZ']); L.sprite(Math.round(hx + half), ey - 1, ['ZZ', 'MZ', 'ZZ']);
        for (var q = 0; q < 4; q++) L.set(Math.round(hx + half) - 1 - q, ey + 3 + (q > 1 ? 1 : 0), 'Z');
        L.set(Math.round(hx + half) - 5, ey + 4, 'M');
        blit(img, L); return img;
      }
      case 'ninja': {
        var by = a.row(a.gear.band) + 1, l = 99, r = -1;
        for (x = 0; x < N; x++) if (a.isSil(x, by)) { l = Math.min(l, x); r = Math.max(r, x); }
        if (r < 0) return img;
        for (x = l; x <= r; x++) { L.set(x, by, 'b'); L.set(x, by + 1, 'b'); }
        var cc = Math.floor((l + r) / 2); L.sprite(cc - 2, by, ['dDdDd', 'DdDDd']); L.sprite(r + 1, by, ['bb.', '.bb', '..b']);
        blit(img, L); return img;
      }
      case 'monocle': {
        var e = a.eyeR || a.eyeL; if (!e) return img;
        var xs = e[2].map(function (p) { return p[0]; }), ys = e[2].map(function (p) { return p[1]; });
        var x0 = Math.min.apply(null, xs) - 1, x1 = Math.max.apply(null, xs) + 1, y0m = Math.min.apply(null, ys) - 1, y1 = Math.max.apply(null, ys) + 1;
        for (x = x0; x <= x1; x++) { L.set(x, y0m, 'g'); L.set(x, y1, 'g'); } for (y = y0m; y <= y1; y++) { L.set(x0, y, 'g'); L.set(x1, y, 'g'); }
        for (y = y1 + 1; y < y1 + 7; y++) L.set(x1 + (y % 2), y, 'G');
        blit(img, L); return img; // ink outline so the gold rim reads on yellow faces (Lenny)
      }
      case 'feetBoth': L.sprite(a.minX + 1, 29 - it.map.length, it.map); L.sprite(a.maxX - 4, 29 - it.map.length, it.map); blit(img, L); return img;
    }
    var p = pos(it.at, it.map, a, it); L.sprite(p[0] + (it.dx || 0), p[1], it.map);
    if (it.extra) { var p2 = pos(it.extra.at, it.extra.map, a, it.extra); L.sprite(p2[0] + (it.extra.dx || 0), p2[1], it.extra.map); }
    blit(img, L, it.behind ? behind : null);
    return img;
  }
  var ORDER = ['back', 'feet', 'armor', 'band', 'weapon', 'crown', 'face']; // overlay draw order
  /** Decorate rendered frames in place. extra = { slot: itemId } (overlay items only). */
  function decorate(PetCore, pet, stage, frames, extra) {
    var ids = ORDER.map(function (s) { return extra && extra[s]; }).filter(function (id) { return id && DEFS[id]; });
    if (!ids.length || !stage) return frames;
    var sp = PetCore.SPECIES.filter(function (s) { return s.id === pet.species; })[0];
    if (!sp) return frames;
    var key = Object.assign({}, pet, { background: 'solid', bgColor: KEY_BG, pattern: 'none' }), eyes = Object.assign({}, key, { eyes: 'star' });
    frames.forEach(function (img, f) {
      var o = { stage: stage, frame: f, gearOverride: {} }; // gear-less anchors: items sit on the body itself
      var a = anchors(PetCore.render(key, o), PetCore.render(eyes, o), sp);
      ids.forEach(function (id) { apply(id, img, a, f); });
    });
    return frames;
  }
  return { ITEMS: ITEMS, DEFS: DEFS, SLOTS: ['face', 'back', 'feet'], COLORS: COLORS, apply: apply, anchors: anchors, decorate: decorate };
});
