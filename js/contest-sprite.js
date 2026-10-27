/* CONTEST PRIZE EGG sprites (DRAFT, branch contest-eggs, Oct 25 2026): three 1 of 1 meme-contest prize pets. NOT loaded by any page yet;
 * the rules only use these species from ACTIVATE_CONTEST_EGGS_BLOCK (null = off), so nothing in replay changes.
 * Same frame format and API as KekSprite / WizardSprite / FuntrumpSprite: 32x32 key grid, 4-frame idle (1px bob + blink on frame 2), ink outline,
 * gold Mythic rim; stages 0 Egg, 1 Hatchling, 2 Juvenile, 3 Adult, 4 Elder, 5 Mythic (the same stages every normal pet uses).
 *   starlordkek  'Star-Lord Kek' (1st prize): from design/art/starlordkek (the story card): green Pepe head, glowing red eyes, black face mask,
 *                black cloak (here a cosmic starfield cloak), white fur stole, spiked helm (Adult+), the sword (Elder+), star halo + orbiting stars (Mythic).
 *   gooby        'Gooby' (2nd): from V2Motel.drawGooby (the motel desk sprite, xcp.fun/GOOBY): green top hat (part of him), black head, white eye
 *                patches, long white muzzle, black nose, buck tooth, droopy ear, red turtleneck. Room key from Elder, neon glow at Mythic.
 *   lukespam     'Luke Spam Junior' (3rd): from img/shop/luke-spam-jr-240.png (the Spam City card shop clerk): red cap with brim to the right,
 *                brown sideburns, ginger goatee, navy shirt. Spam can from Elder, holo Mythic card at Mythic.
 * Never the old Nakamoto or Wizard art.
 * API: draw(sp, stage, frame, gear) -> key grid; render(sp, stage, frame, bg, gear, opts) -> {width,height,data}; frames(sp, stage, bg, gear, opts);
 * anchors(sp, stage, frame) -> head/eye/body boxes (gear lands on these). Babies never carry these pets' special parts (no part swap). */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.ContestSprite = factory(); })(this, function () {
  'use strict';
  var N = 32, STAGES = ['Egg', 'Hatchling', 'Juvenile', 'Adult', 'Elder', 'Mythic'];
  var BASE = { n: '#120e18', A: '#ffc93c', E: '#f4f4ee', P: '#111111', y: '#ffd23f', o: '#c49a1a', S: '#c8d0da', s: '#fff6b0', w: '#ffffff' };
  var PAL = {
    starlordkek: Object.assign({}, BASE, { G: '#5aa83c', g: '#3d7a2a', h: '#86cf5e', R: '#ff3030', r: '#ffd08a', K: '#1c1c24', k: '#3a3a48', B: '#2a1650', b: '#170b30', U: '#8a6cff', u: '#4fd8ff', m: '#2f4fd0', q: '#3fb8e8', X: '#ff7a3c', x: '#ffe08a', W: '#f0f0ea', V: '#bdbdb4', M: '#8f96a3' }),
    gooby: Object.assign({}, BASE, { G: '#18181c', g: '#0c0c0e', h: '#34343e', W: '#f5f5f0', V: '#cfcfc6', H: '#6ef04a', I: '#3fae2a', B: '#e8352a', b: '#b0221a', N: '#000000', U: '#ff5ad1', u: '#7af7ff' }),
    lukespam: Object.assign({}, BASE, { G: '#f2c29a', g: '#d99c76', h: '#ffdcbc', T: '#7a4a22', O: '#d8662a', Q: '#a8461a', R: '#d8262e', r: '#9a1a20', B: '#1f2f5c', b: '#16213f', C: '#2b6cd6', c: '#ffd23f', U: '#ff7ae0', u: '#7affd8' })
  };
  var NAMES = { starlordkek: 'Star-Lord Kek', gooby: 'Gooby', lukespam: 'Luke Spam Junior', bojackson: 'Bo Jackson', rarepigeon: 'Rarepigeon' };
  /* BO JACKSON 1 of 1 (owner Oct 26 2026): baked v3 art (js/bo-sprite.js, BoSprite) per stage; the idle bob moves the whole grid, gear lands on BO_A. */
  var BOS = (typeof BoSprite !== 'undefined') ? BoSprite : (typeof require === 'function' ? require('./bo-sprite.js') : null);
  if (BOS) PAL.bojackson = Object.assign({}, BOS.PAL);
  var BO_A = { D: { hh: 10, bh: 9 }, cx: 16, headTop: 2, headBot: 11, hw: 5, eyeY: 6, bodyTop: 13, bodyEnd: 21, bw: 6 };
  function boDraw(stage, f, gear) { var S = BOS.STAGES[stage], g = grid(), dy = stage === 0 ? [0, -1, -1, 0][f] : [0, -1, -1, 0][f];
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var c = S[y].charAt(x); if (c !== '.') set(g, x, y + dy, c); }
    if (stage > 0 && gear && BOS.GEAR) { var rest = {}; ['feet', 'hand', 'head', 'body', 'face', 'back', 'weapon'].forEach(function (sl) { var it = gear[sl], id = it && (it.item || it.id), O = id && BOS.GEAR[id] && BOS.GEAR[id][stage];
        if (O) { for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var c = O[y].charAt(x); if (c !== '.') set(g, x, y + dy, c); } } /* Bo's own kit: baked from the v3 design */
        else if (id === 'bo-towel') { /* already part of Bo's art */ } else if (it) rest[sl] = it; }); gear = rest; }
    if (stage > 0 && gear && Object.keys(gear).length) { var A = Object.assign({}, BO_A, { headTop: BO_A.headTop + dy, headBot: BO_A.headBot + dy, eyeY: BO_A.eyeY + dy, bodyTop: BO_A.bodyTop + dy, bodyEnd: BO_A.bodyEnd + dy }); gearLayer(g, 'bojackson', stage, A, gear); }
    return g; }
  /* RAREPIGEON 1 of 1 (owner Oct 26 2026, branch rarepigeon-1of1): baked art (js/rarepigeon-sprite.js, RarepigeonSprite) per stage, same idle bob as Bo; gear lands on RP_A. */
  var RPS = (typeof RarepigeonSprite !== 'undefined') ? RarepigeonSprite : (typeof require === 'function' ? (function () { try { return require('./rarepigeon-sprite.js'); } catch (e) { return null; } })() : null);
  if (RPS) PAL.rarepigeon = Object.assign({}, RPS.PAL);
  var RP_A = { cx: 19, headTop: 3, headBot: 11, hw: 4, eyeY: 6, bodyTop: 12, bodyEnd: 23, bw: 7 };
  /* Rarepigeon kit pinned to the baked art: bread / scroll held in the beak (orange 'i'), cap on the crown (from the eye highlight), message tube on the front leg (red 'j'). */
  var RP_KC = { G: '#2f9f5f', g: '#1e6b40', O: '#ff7a1a', L: '#8a5a2b', P: '#f4ecd8', F: '#cfc3a3', T: '#a89a78', R: '#ff2a2a', C: '#2a9fd0', c: '#6fe3ff', W: '#e9fbff' };
  var RP_KIT = { 'rp-bread': { at: 'beak', map: ['.LLL.', 'LPPPL', 'LPFPL', 'LLLLL'] }, 'rp-scroll': { at: 'beak', map: ['L....L', 'LPPPPL', 'LPTTPL', 'L.R..L'] },
    'rp-cap': { at: 'crown', map: ['..GGGG...', '.GGOOGG..', 'gGGGGGGgg'] }, 'rp-tube': { at: 'leg', map: ['LCL', 'LcL', 'LCL'] } };
  function rpKit(g, S, dy, id) { var K = RP_KIT[id], M = K.map, bx = -1, by = 99, ht = 99, hl = 99, lx = 99, ly = 99, x, y;
    for (y = 0; y < N; y++) for (x = 0; x < N; x++) { var c = S[y].charAt(x); if ((c === 'i' || c === 'q') && x > bx) { bx = x; by = y; } if (c === 'j' && x < lx) { lx = x; ly = Math.min(ly, y); } }
    for (y = 0; y < Math.min(by, N); y++) for (x = 16; x < N; x++) if (S[y].charAt(x) === 'l') { ht = y; hl = x; } /* the eye highlight: lowest 'l' above the beak */
    var ox, oy; if (K.at === 'beak') { if (bx < 0) return; ox = bx - 1; oy = by - 1; } else if (K.at === 'crown') { if (ht === 99) return; ox = hl - 4; oy = ht - 2 - M.length + 1; } else { if (lx === 99) return; ox = lx - 1; oy = ly; }
    for (y = 0; y < M.length; y++) for (x = 0; x < M[y].length; x++) { var k = M[y].charAt(x); if (k !== '.') set(g, ox + x, oy + y + dy, RP_KC[k]); } }
  function rpDraw(stage, f, gear) { var S = RPS.STAGES[stage], g = grid(), dy = [0, -1, -1, 0][f];
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var c = S[y].charAt(x); if (c !== '.') set(g, x, y + dy, c); }
    if (stage > 0 && gear) { var rest = {}; ['feet', 'hand', 'head', 'body', 'face', 'back', 'weapon'].forEach(function (sl) { var it = gear[sl], id = it && (it.item || it.id);
        if (id && RP_KIT[id]) rpKit(g, S, dy, id); else if (it) rest[sl] = it; }); gear = rest; } /* Rarepigeon's own kit: drawn on the beak / crown / leg of the baked art */
    if (stage > 0 && gear && Object.keys(gear).length) { var A = Object.assign({}, RP_A, { headTop: RP_A.headTop + dy, headBot: RP_A.headBot + dy, eyeY: RP_A.eyeY + dy, bodyTop: RP_A.bodyTop + dy, bodyEnd: RP_A.bodyEnd + dy }); gearLayer(g, 'rarepigeon', stage, A, gear); }
    return g; }
  /* the same stage sizes as KekSprite (head half-width / height, body half-width / height) */
  var DIM = [null, { hw: 6, hh: 6, bw: 4, bh: 4 }, { hw: 7, hh: 6, bw: 5, bh: 6 }, { hw: 8, hh: 7, bw: 7, bh: 7 }, { hw: 8, hh: 7, bw: 7, bh: 8 }, { hw: 8, hh: 7, bw: 7, bh: 8 }];
  function grid() { var g = []; for (var i = 0; i < N; i++) g.push(new Array(N).fill(null)); return g; }
  function set(g, x, y, k) { if (x >= 0 && y >= 0 && x < N && y < N) g[y][x] = k; }
  function rect(g, x0, y0, w, h, k) { for (var y = y0; y < y0 + h; y++) for (var x = x0; x < x0 + w; x++) set(g, x, y, k); }
  function hline(g, x0, x1, y, k) { for (var x = x0; x <= x1; x++) set(g, x, y, k); }
  function vline(g, x, y0, y1, k) { for (var y = y0; y <= y1; y++) set(g, x, y, k); }
  function hexRgb(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function outline(g) { var o = g.map(function (r) { return r.slice(); }); for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (!g[y][x] &&
      [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) { var X = x + d[0], Y = y + d[1]; return X >= 0 && Y >= 0 && X < N && Y < N && g[Y][X] && g[Y][X] !== 'n' && g[Y][X] !== 's'; })) o[y][x] = 'n'; return o; }
  function mythicRim(o) { var o2 = o.map(function (r) { return r.slice(); }); for (var y = 0; y < 31; y++) for (var x = 0; x < N; x++) if (!o[y][x] &&
      [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) { var X = x + d[0], Y = y + d[1]; return X >= 0 && Y >= 0 && X < N && Y < N && o[Y][X] === 'n'; })) o2[y][x] = 'A'; return o2; }
  /** geom(stage, frame): the shared skeleton (head box, body box) every character is drawn on */
  function geom(stage, frame) { var D = DIM[stage], bob = [0, -1, -1, 0][frame || 0], cx = 16, bodyEnd = 27 + bob, bodyTop = bodyEnd - D.bh + 1, headBot = bodyTop + 1, headTop = headBot - D.hh + 1;
    return { D: D, bob: bob, cx: cx, bodyEnd: bodyEnd, bodyTop: bodyTop, headBot: headBot, headTop: headTop, hw: D.hw, bw: D.bw, eyeY: headTop + 2 }; }
  function head(g, A, lit, mid, dark) { for (var r = 0; r < A.D.hh; r++) { var ins = (r === 0 || r === A.D.hh - 1) ? 1 : 0; for (var x = A.cx - A.hw + ins; x < A.cx + A.hw - ins; x++) set(g, x, A.headTop + r, x <= A.cx - A.hw + ins ? lit : x >= A.cx + A.hw - ins - 1 ? dark : mid); } }
  function body(g, A, lit, mid, dark) { for (var j = 0; j < A.D.bh; j++) { var w = Math.min(A.bw, A.bw - 2 + j); for (var x = A.cx - w; x < A.cx + w; x++) set(g, x, A.bodyTop + j, x === A.cx - w ? lit : x >= A.cx + w - 2 ? dark : mid); }
    hline(g, A.cx - A.bw, A.cx - 2, A.bodyEnd + 1, mid); hline(g, A.cx + 1, A.cx + A.bw - 1, A.bodyEnd + 1, dark); }
  function egg(g, bob, k0, k1, k2) { for (var y = 0; y < 18; y++) { var hw = Math.round(Math.sqrt(Math.max(0, 1 - Math.pow((y - 9.5) / 9.5, 2))) * (y < 9 ? 7 : 8)); for (var x = 16 - hw; x < 16 + hw; x++) { var e = x - 16; set(g, x, 11 + y + bob, e <= -hw + 1 && y > 2 ? k2 : e >= hw - 2 ? k1 : k0); } } }
  /* ---------- the three characters ---------- */
  /* STAR-LORD KEK v2 ("more wow", owner Oct 25 2026): every stage grander than the last.
   * 1 Hatchling: green Pepe head, glowing visor (red eyes behind a hot band), black mask, galaxy body (nebula swirl + twinkling stars).
   * 2 Juvenile: + white fur stole, more stars.   3 Adult: + spiked helm, gold star pauldrons, cosmic cape (galaxy inside, magenta lining).
   * 4 Elder: + glowing sword, chest star emblem, longer cape.   5 Mythic: + star crown with a holo gem, holo shimmer on the gold rim,
   * one sparse animated star ring, a subtle comet (toned down Oct 25 10:09). Back gear replaces the cape so worn capes still show. */
  var SL_GEAR = null;
  function galaxy(g, x0, x1, y0, y1, f, dens) { for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) { if (!g[y] || g[y][x] !== 'B') continue;
      var v = (x * 7 + y * 13) % 23, sw = Math.sin((x - 16) * 0.55 + (y - y0) * 0.8) ;
      if (sw > 0.85) g[y][x] = 'm'; else if (sw > 0.55) g[y][x] = 'U'; else if (sw < -0.3) g[y][x] = 'b';
      if (v < dens) g[y][x] = ((x + y + f) % 4 === 0) ? 'w' : (v % 2 ? 's' : 'u'); } }
  function starlord(g, st, A, f) { var blink = f === 2, cx = A.cx, cape = st >= 3 && !(SL_GEAR && SL_GEAR.back);
    var cw = A.bw + (st >= 3 ? 1 : 0);
    if (cape) { var ext = st >= 4 ? 3 : 2; for (var yc = A.bodyTop; yc <= A.bodyEnd + 1; yc++) { var fl = Math.min(ext, 1 + Math.floor((yc - A.bodyTop) / 2)); for (var d = 1; d <= fl; d++) { set(g, cx - cw - d, yc, d === fl ? 'q' : 'B'); set(g, cx + cw - 1 + d, yc, d === fl ? 'q' : 'B'); } }
      if (st >= 4) { set(g, cx - cw - ext - 1, A.bodyEnd + 1, 'q'); set(g, cx + cw + ext, A.bodyEnd + 1, 'q'); } } /* cosmic cape, magenta lining */
    if (st >= 3) { [-1, 1].forEach(function (sd) { var bx = sd < 0 ? cx - A.hw - 1 : cx + A.hw; for (var i = 0; i < 4 + (st >= 4 ? 2 : 0); i++) set(g, bx, A.headTop + 3 - i, i === 0 ? 'M' : i >= 3 ? 'w' : 'S'); set(g, bx + (sd < 0 ? 2 : -2), A.headTop - 2, 'S'); set(g, bx + (sd < 0 ? 2 : -2), A.headTop - 3, st >= 4 ? 'w' : 'S'); }); } /* spiked helm */
    for (var j = 0; j < A.D.bh + 1; j++) { var w = Math.min(cw, cw - 2 + j); for (var x = cx - w; x < cx + w; x++) set(g, x, A.bodyTop + j, 'B'); }
    galaxy(g, 0, 31, A.bodyTop, A.bodyEnd + 1, f, 1 + (st >> 1));
    if (st >= 3) { [cx - cw - 1, cx + cw - 2].forEach(function (px) { hline(g, px, px + 2, A.bodyTop, 'y'); hline(g, px, px + 2, A.bodyTop + 1, 'o'); set(g, px + 1, A.bodyTop, f % 2 ? 'w' : 's'); }); } /* gold star pauldrons */
    if (st >= 4) { var ey0 = A.bodyTop + 3; set(g, cx - 1, ey0, 'y'); set(g, cx, ey0, 'y'); set(g, cx - 2, ey0 + 1, 'y'); set(g, cx - 1, ey0 + 1, 'w'); set(g, cx, ey0 + 1, 'w'); set(g, cx + 1, ey0 + 1, 'y'); set(g, cx - 1, ey0 + 2, 'y'); set(g, cx, ey0 + 2, 'y'); set(g, cx - 2, ey0 + 3, 'o'); set(g, cx + 1, ey0 + 3, 'o'); } /* chest star emblem */
    if (st >= 2 && st < 3) { for (var fx = cx - cw - 1; fx < cx; fx++) set(g, fx, A.bodyTop + (fx < cx - cw + 2 ? 1 : 0), fx % 2 ? 'W' : 'V'); set(g, cx - cw - 1, A.bodyTop + 2, 'W'); } /* white fur stole */
    if (st >= 3) for (var fx2 = cx - cw + 2; fx2 < cx + cw - 2; fx2++) set(g, fx2, A.bodyTop, fx2 % 2 ? 'W' : 'V'); /* fur collar between the pauldrons */
    head(g, A, 'h', 'G', 'g');
    var ew = st === 1 ? 4 : 5, ex = [cx - ew - 1, cx + 1], glow = ['u', 'w', 'u', 'U'][f];
    ex.forEach(function (x0) { hline(g, x0 + 1, x0 + ew - 2, A.headTop - 1, 'G'); hline(g, x0, x0 + ew - 1, A.headTop, 'g'); hline(g, x0, x0 + ew - 1, A.headTop + 1, blink ? 'g' : 'R'); if (!blink) { hline(g, x0 + 1, x0 + ew - 2, A.headTop + 2, 'R'); set(g, x0 + ew - 2, A.headTop + 1, 'w'); } });
    hline(g, cx - A.hw + 1, cx + A.hw - 2, A.headTop + 3, glow); set(g, cx - A.hw + 2 + (f * 3) % (2 * A.hw - 4), A.headTop + 3, 'w'); /* glowing cyan visor band (pulses, a glint sweeps across) */
    if (!blink) { set(g, ex[0] + 1, A.headTop + 1, 'x'); set(g, ex[1] + 1, A.headTop + 1, 'x'); }
    var my0 = A.headTop + 4, my1 = A.headBot; for (var y = my0; y <= my1; y++) hline(g, cx - A.hw + 1, cx + A.hw - 2, y, y === my0 ? 'k' : 'K'); /* black face mask */
    if (st >= 2) for (var xm = cx - A.hw + 3; xm < cx + A.hw - 3; xm += 2) set(g, xm, my0 + 1, 'k');
    set(g, cx - 1, my0 + 1, 'P'); set(g, cx, my0 + 1, 'P');
    if (st >= 4) { var sx = cx + A.bw + 3 + (cape ? 1 : 0); sx = Math.min(sx, 29); var bl = st === 5 ? ['u', 'w', 's', 'w'][f] : ['u', 'w'][f % 2];
      vline(g, sx, A.bodyTop - 6, A.bodyEnd - 1, 'S'); vline(g, sx + 1, A.bodyTop - 5, A.bodyEnd - 2, bl); set(g, sx, A.bodyTop - 7, 'w'); hline(g, sx - 2, sx + 2, A.bodyEnd - 1, 'y'); vline(g, sx, A.bodyEnd, A.bodyEnd + 1, 'o'); set(g, sx - 2, A.bodyEnd - 2, 'o'); set(g, sx + 2, A.bodyEnd - 2, 'o'); } /* glowing star sword */
    if (st === 5 && !(SL_GEAR && SL_GEAR.head)) { var ct = A.headTop - 3; hline(g, cx - 4, cx + 3, ct, 'y'); hline(g, cx - 4, cx + 3, ct + 1, 'o'); [cx - 4, cx - 1, cx, cx + 3].forEach(function (x2) { set(g, x2, ct - 1, 'y'); }); set(g, cx - 4, ct - 2, 'y'); set(g, cx + 3, ct - 2, 'y'); vline(g, cx - 1, ct - 3, ct - 1, 'y'); vline(g, cx, ct - 3, ct - 1, 'y');
      set(g, cx - 1, ct, ['U', 'u', 'm', 'w'][f]); set(g, cx, ct, ['u', 'm', 'w', 'U'][f]); set(g, cx - 1, ct - 4, 'w'); set(g, cx, ct - 4, 'w'); } /* star crown + holo gem */
  }
  /* Star-Lord Kek post-outline fx: Adult+ sparkles, Mythic holo rim + two-ring orbit with a comet tail */
  function slFx(o, st, f) { function em(x, y, k) { if (x >= 0 && y >= 0 && x < N && y < N && !o[y][x]) o[y][x] = k; }
    if (st >= 3) { var sp = [[3, 6], [28, 9], [5, 20], [27, 22], [2, 13], [29, 15]]; sp.slice(0, st === 3 ? 2 : 4).forEach(function (p, i) { if ((i + f) % 2 === 0) { em(p[0], p[1], 'w'); em(p[0] - 1, p[1], 's'); em(p[0] + 1, p[1], 's'); em(p[0], p[1] - 1, 's'); em(p[0], p[1] + 1, 's'); } else em(p[0], p[1], 'u'); }); }
    if (st !== 5) return;
    var H = ['U', 'u', 'm', 'w']; for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (o[y][x] === 'A' && (x + y + f * 3) % 11 === 0) o[y][x] = H[(x + f) % 3 === 0 ? 3 : 1]; /* soft holo glint travelling round the gold rim */
    for (var a = 0; a < 8; a++) { var t = a / 8 * Math.PI * 2 + f * 0.4, X = Math.round(15.5 + Math.cos(t) * 15), Y = Math.round(16 + Math.sin(t) * 14.5); em(X, Y, a % 4 === 0 ? 'w' : 'u'); } /* one sparse star ring */
    for (var c = 0; c < 2; c++) { var tc = f * Math.PI / 2 - c * 0.18, cX = Math.round(15.5 + Math.cos(tc) * 13), cY = Math.round(15 + Math.sin(tc) * 12.5); em(cX, cY, c === 0 ? 's' : 'o'); } } /* subtle comet */
  function gooby(g, st, A, f) { var blink = f === 2, cx = A.cx;
    body(g, A, 'B', 'B', 'b'); hline(g, cx - A.bw + 2, cx + A.bw - 3, A.bodyTop, 'b'); hline(g, cx - A.bw + 2, cx + A.bw - 3, A.bodyTop + 1, 'B'); /* red turtleneck roll */
    vline(g, cx + 2, A.bodyTop + 2, A.bodyEnd, 'b');
    head(g, A, 'h', 'G', 'g');
    var ear = cx + A.hw; rect(g, ear - 1, A.headTop + 1, 2, 2, 'G'); vline(g, ear + 1, A.headTop + 2, A.headTop + 4 + (f % 2) + (st >= 3 ? 1 : 0), 'G'); set(g, ear, A.headTop + 3, 'g'); /* droopy ear (bobs) */
    var ew = st === 1 ? 2 : 3; [cx - A.hw + 1, cx - A.hw + 2 + ew].forEach(function (x0) { rect(g, x0, A.eyeY - 1, ew, ew, 'W'); if (!blink) set(g, x0 + 1, A.eyeY, 'P'); else hline(g, x0, x0 + ew - 1, A.eyeY, 'V'); });
    var mz = A.eyeY + ew, ml = cx - A.hw - (st >= 3 ? 3 : 2); rect(g, ml, mz, cx - ml + 1, Math.max(2, A.headBot - mz), 'W'); hline(g, ml + 1, cx, A.headBot, 'V'); /* long white muzzle */
    rect(g, ml - 1, mz - 1, 2, 2, 'N'); set(g, ml + 2, A.headBot - 1, 'N'); set(g, ml + 3, A.headBot, 'W'); set(g, ml + 3, A.headBot + 1, 'w'); /* black nose, buck tooth */
    var hb = A.headTop - 1, hl = cx - A.hw + 2, hr = cx + A.hw - 2, hh = st === 1 ? 3 : st === 2 ? 4 : 5; /* green top hat, notched crown, black band */
    hline(g, hl - 1, hr + 1, hb, 'I'); for (var y = hb - hh; y < hb; y++) hline(g, hl + 1, hr - 1, y, 'H'); hline(g, hl + 1, hr - 1, hb - 2, st === 5 ? 'y' : 'n'); set(g, Math.round((hl + hr) / 2), hb - hh, null);
    if (st >= 4) { var kx = cx + A.bw + 1, ky = A.bodyTop + 3; rect(g, kx, ky, 2, 3, 'y'); set(g, kx + 2, ky + 4, 'o'); vline(g, kx + 1, ky + 3, ky + 5, 'o'); set(g, kx, ky + 5, 'o'); } /* motel room key on its tag */
    if (st === 5) { set(g, cx - 4, A.bodyTop + 3, 'U'); set(g, cx - 3, A.bodyTop + 3, 'U'); set(g, cx - 4, A.bodyTop + 4, 'U'); } /* neon VACANCY pink badge */
  }
  function luke(g, st, A, f) { var blink = f === 2, cx = A.cx;
    body(g, A, 'B', 'B', 'b'); hline(g, cx - 1, cx, A.bodyTop, 'b'); set(g, cx - 2, A.bodyTop + 1, 'b'); set(g, cx + 1, A.bodyTop + 1, 'b'); /* navy shirt, collar */
    head(g, A, 'h', 'G', 'g');
    vline(g, cx - A.hw, A.headTop + 1, A.eyeY + 2, 'T'); vline(g, cx + A.hw - 1, A.headTop + 1, A.eyeY + 2, 'T'); set(g, cx - A.hw + 1, A.headTop + 1, 'T'); /* sideburns */
    var ew = st === 1 ? 1 : 2; [cx - 4, cx + 2].forEach(function (x0) { if (blink) hline(g, x0, x0 + ew - 1, A.eyeY + 1, 'g'); else { hline(g, x0, x0 + ew - 1, A.eyeY + 1, 'E'); set(g, x0 + ew - 1, A.eyeY + 1, 'P'); } hline(g, x0, x0 + ew - 1, A.eyeY, 'T'); });
    var by = A.eyeY + 3; if (st >= 2) { hline(g, cx - 3, cx + 2, by, 'O'); hline(g, cx - 4, cx + 3, by + 1, 'O'); hline(g, cx - 2, cx + 1, by + 2, 'Q'); vline(g, cx - 1, by + 2, Math.min(A.bodyTop + 1, by + 3 + (st >= 3 ? 1 : 0)), 'O'); vline(g, cx, by + 2, Math.min(A.bodyTop + 1, by + 3 + (st >= 3 ? 1 : 0)), 'Q'); hline(g, cx - 2, cx + 1, by + 1, 'P'); } /* ginger goatee + smile */
    else { hline(g, cx - 2, cx + 1, by, 'Q'); }
    var hb = A.headTop; for (var y = hb - 3; y <= hb; y++) hline(g, cx - A.hw + (y === hb - 3 ? 2 : 0), cx + A.hw - 1 - (y === hb - 3 ? 2 : 0), y, y === hb ? 'r' : 'R'); hline(g, cx + A.hw - 2, cx + A.hw + 2, hb, 'R'); hline(g, cx + A.hw - 1, cx + A.hw + 3, hb + 1, 'r'); /* red cap, brim to the right */
    if (st === 5) { set(g, cx - 1, hb - 2, 'y'); set(g, cx, hb - 2, 'y'); }
    if (st >= 4) { var sx = cx - A.bw - 3, sy = A.bodyTop + 2; rect(g, sx, sy, 3, 5, 'C'); hline(g, sx, sx + 2, sy + 2, 'c'); hline(g, sx, sx + 2, sy, 'S'); } /* Spam can */
    if (st === 5) { var hx = cx + A.bw + 1, hy = A.bodyTop + 1; rect(g, hx, hy, 4, 6, 'w'); rect(g, hx + 1, hy + 1, 2, 3, ['U', 'u', 's', 'y'][f]); } /* holo Mythic card */
  }
  var DRAW = { starlordkek: starlord, gooby: gooby, lukespam: luke };
  var EGG = { starlordkek: ['B', 'b', 'U'], gooby: ['G', 'g', 'h'], lukespam: ['B', 'b', 'C'] };
  function eggArt(g, sp, f) { var bob = [0, -1, -1, 0][f || 0], k = EGG[sp]; egg(g, bob, k[0], k[1], k[2]);
    if (sp === 'starlordkek') { for (var y = 11; y < 30; y++) for (var x = 8; x < 24; x++) { if (!g[y][x]) continue; var sw = Math.sin((x - 16) * 0.5 + (y - bob) * 0.45 + 1.2) + Math.cos((y - bob) * 0.3 - x * 0.2);
        if (sw > 1.25) g[y][x] = 'm'; else if (sw > 0.7) g[y][x] = 'U'; else if (sw < -1.2) g[y][x] = 'b'; } /* nebula swirl */
      [[12, 15], [18, 14], [15, 19], [20, 22], [11, 23], [16, 25], [14, 13], [19, 18], [13, 27]].forEach(function (p, i) { set(g, p[0], p[1] + bob, (i + f) % 3 === 0 ? 'w' : (i + f) % 3 === 1 ? 's' : 'u'); });
      var sy = 20 + bob; set(g, 15, sy - 1, 'y'); set(g, 16, sy - 1, 'y'); hline(g, 14, 17, sy, 'y'); set(g, 15, sy, 'w'); set(g, 16, sy, 'w'); set(g, 15, sy + 1, 'y'); set(g, 16, sy + 1, 'y'); set(g, 14, sy + 2, 'o'); set(g, 17, sy + 2, 'o'); /* gold star at the heart */
      var o = outline(g); [[7, 13], [24, 16], [6, 24], [25, 26], [10, 9], [21, 9]].forEach(function (p, i) { var X = p[0], Y = p[1] + bob; if (o[Y] && !o[Y][X]) o[Y][X] = (i + f) % 2 ? 'u' : 'w'; if ((i + f) % 2 === 0) [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { if (o[Y + d[1]] && !o[Y + d[1]][X + d[0]]) o[Y + d[1]][X + d[0]] = 's'; }); });
      return o; } /* NEBULA EGG: twinkling stars inside and around */
    if (sp === 'gooby') { rect(g, 11, 15 + bob, 10, 2, 'H'); hline(g, 10, 21, 17 + bob, 'I'); rect(g, 10, 22 + bob, 12, 2, 'B'); set(g, 13, 20 + bob, 'W'); set(g, 17, 20 + bob, 'W'); }
    if (sp === 'lukespam') { rect(g, 10, 14 + bob, 12, 3, 'R'); hline(g, 18, 23, 17 + bob, 'r'); rect(g, 13, 20 + bob, 5, 6, 'C'); hline(g, 13, 17, 22 + bob, 'c'); }
    return outline(g); }
  /** anchors(sp, stage, frame): where gear lands on this pet */
  function anchors(sp, stage, frame) { if (sp === 'rarepigeon') { var e = [0, -1, -1, 0][frame || 0]; return { cx: 19, headTop: 3 + e, headBot: 11 + e, hw: 4, eyeY: 6 + e, bodyTop: 12 + e, bodyEnd: 23 + e, bw: 7 }; } if (sp === 'bojackson') { var d = [0, -1, -1, 0][frame || 0]; return { cx: 16, headTop: 2 + d, headBot: 11 + d, hw: 5, eyeY: 6 + d, bodyTop: 13 + d, bodyEnd: 21 + d, bw: 6 }; } var A = geom(Math.max(1, stage), frame); return { cx: A.cx, headTop: A.headTop, headBot: A.headBot, hw: A.hw, eyeY: sp === 'starlordkek' ? A.headTop + 1 : A.eyeY, bodyTop: A.bodyTop, bodyEnd: A.bodyEnd, bw: A.bw }; }
  /* ---------- gear layer: every slot (head, face, hand, body, back, feet, weapon) from the anchors, like KekSprite ---------- */
  function gearLayer(g, sp, st, A, Gr) { function kind(sl) { return Gr[sl] ? String(Gr[sl].label || Gr[sl].item || '').toLowerCase() : ''; }
    function col(sl, i) { var x = Gr[sl], c = x && x.cols; return (c && (c[i || 0] || c[0])) || (i ? '#c49a1a' : '#ffd23f'); } var cx = A.cx, put = [];
    function p(x, y, k) { set(g, x, y, k); put.push([x, y]); }
    if (Gr.body) { var b0 = col('body'), b1 = col('body', 1); for (var y = A.bodyTop + 1; y <= A.bodyEnd; y++) for (var x = cx - A.bw; x < cx + A.bw; x++) if (g[y][x]) p(x, y, (x - cx) % 3 === 0 ? b1 : b0); }
    if (Gr.feet) { hline(g, cx - A.bw, cx - 2, A.bodyEnd + 1, col('feet')); hline(g, cx + 1, cx + A.bw - 1, A.bodyEnd + 1, col('feet', 1)); }
    if (Gr.face) { var gk = kind('face'), g0 = col('face'), ey = sp === 'starlordkek' ? A.headTop + 1 : A.eyeY;
      if (/shade|sunglass|goggle|visor|laser|beam|glass|monocle|mask/.test(gk)) { for (var xe = cx - A.hw + 1; xe < cx + A.hw - 1; xe++) { p(xe, ey, g0); if (xe !== cx && xe !== cx - 1) p(xe, ey + 1, g0); } }
      else p(cx + 2, A.headBot - 1, g0); }
    if (Gr.head && sp !== 'gooby' && sp !== 'lukespam') { var hk = kind('head'), h0 = col('head'), h1 = col('head', 1), ht = A.headTop - 2; /* Gooby's hat and Luke's cap are part of them (Headwear sits on top) */
      if (/crown|tiara/.test(hk)) { for (var xc = cx - 4; xc < cx + 4; xc++) { p(xc, ht, h0); if (xc % 2) p(xc, ht - 1, h0); } }
      else { rect(g, cx - 4, ht - 2, 8, 2, h0); hline(g, cx - 6, cx + 5, ht, h1); } }
    else if (Gr.head) { var top = A.headTop - (sp === 'gooby' ? (st === 1 ? 4 : st === 2 ? 5 : 6) : 4) - 1; hline(g, cx - 2, cx + 1, top, col('head')); set(g, cx - 1, top - 1, col('head', 1)); }
    if (Gr.back) { var c0 = col('back'); for (var yb = A.bodyTop; yb <= A.bodyEnd; yb++) { var fl = Math.round((yb - A.bodyTop) / 3); for (var d = 1; d <= 1 + fl; d++) { if (!g[yb][cx - A.bw - d]) set(g, cx - A.bw - d, yb, c0); if (!g[yb][cx + A.bw - 1 + d]) set(g, cx + A.bw - 1 + d, yb, c0); } } }
    if (Gr.hand) { var ak = kind('hand'), a0 = col('hand'), a1 = col('hand', 1), hx = cx - A.bw - 2, hy = A.bodyEnd - 2;
      if (/sword|staff|stick|dagger|wand|torch|spear|candle|bat|banner|flag|axe|hammer|pole|rod/.test(ak)) { for (var t = 0; t < 8; t++) p(hx, hy - t, t > 5 ? a1 : a0); } else { rect(g, hx - 1, hy - 2, 3, 3, a0); set(g, hx, hy - 1, a1); } }
    if (Gr.weapon) { var wx = cx + A.bw + 4; for (var tw = 0; tw < 9; tw++) set(g, wx, A.bodyEnd - tw, tw > 6 ? col('weapon', 1) : col('weapon')); }
    return put; }
  function draw(sp, stage, frame, gear) { var s = Math.max(0, Math.min(5, stage | 0)), f = ((frame | 0) % 4 + 4) % 4, g = grid(); if (sp === 'bojackson') return boDraw(s, f, gear); if (sp === 'rarepigeon') return rpDraw(s, f, gear); if (!DRAW[sp]) throw new Error('unknown contest pet ' + sp);
    if (s === 0) return eggArt(g, sp, f);
    var A = geom(s, f); SL_GEAR = gear || null; try { DRAW[sp](g, s, A, f); } finally { SL_GEAR = null; } if (gear && Object.keys(gear).length) gearLayer(g, sp, s, A, gear);
    var o = outline(g); if (s === 5) { o = mythicRim(o); if (sp !== 'starlordkek') aura(o, sp, f); } if (sp === 'starlordkek') slFx(o, s, f); return o; }
  /* Mythic aura: orbiting stars drawn AFTER the outline + gold rim, only on empty cells (so they never get rimmed or cover the pet) */
  var AURA = { starlordkek: ['s', 'u', 'U'], gooby: ['U', 'u'], lukespam: ['U', 'u', 's'] };
  function aura(o, sp, f) { var K = AURA[sp], n = sp === 'starlordkek' ? 14 : 10; for (var a = 0; a < n; a++) { var t = a / n * Math.PI * 2 + f * 0.22, x = Math.round(15.5 + Math.cos(t) * 14.5), y = Math.round(16 + Math.sin(t) * 14.5);
    if (x >= 0 && y >= 0 && x < N && y < N && !o[y][x]) o[y][x] = K[a % K.length]; } }
  function toImg(g, P, bg) { var B = hexRgb(bg || '#14101e'), d = []; for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var k = g[y][x], c = k ? hexRgb(P[k] || k) : B; d.push(c[0], c[1], c[2], 255); } return { width: N, height: N, data: d }; }
  function render(sp, stage, frame, bg, gear, opts) { return toImg(draw(sp, stage, frame, gear), Object.assign({}, PAL[sp], (opts && opts.pal) || {}), bg); }
  function frames(sp, stage, bg, gear, opts) { return [0, 1, 2, 3].map(function (f) { return render(sp, stage, f, bg, gear, opts); }); }
  return { STAGES: STAGES, NAMES: NAMES, PAL: PAL, DIM: DIM, draw: draw, render: render, frames: frames, anchors: anchors, SPECIES: Object.keys(NAMES) };
});
