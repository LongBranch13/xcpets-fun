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
  var NAMES = { starlordkek: 'Star-Lord Kek', gooby: 'Gooby', lukespam: 'Luke Spam Junior', bojackson: 'Bo Jackson', rarepigeon: 'Rarepigeon', jacksonpepe: 'Old Hickory Pepe' };
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
  /* OLD HICKORY PEPE 1 of 1 (owner Nov 4 2026, branch jackson-pepe-1of1, PREVIEW): baked art (js/jackson-sprite.js, JacksonSprite); idle bob like Bo, blink on frame 2 */
  var JPS = (typeof JacksonSprite !== 'undefined') ? JacksonSprite : (typeof require === 'function' ? (function () { try { return require('./jackson-sprite.js'); } catch (e) { return null; } })() : null);
  if (JPS) PAL.jacksonpepe = Object.assign({}, JPS.PAL);
  /* BO PIGEON 'borp' (owner Oct 31 2026 9:49 AM CT, branch borp-twins, PREVIEW): the body every Bo Jackson times Rarepigeon baby gets (rules: ACTIVATE_BORP_BLOCK,
   * null = OFF, so no pet has it). A pigeon-athlete: Rarepigeon's shape (head, beak, iridescent collar, red legs, tail) wearing Bo's kit: charcoal jersey (wing
   * bars kept), white #34 from Adult, silver pants, eye black under the eye and a football tucked at the chest from Juvenile. Derived at load from RarepigeonSprite
   * (no new file, no page changes); stage sizes, idle bob, anchors and Rarepigeon's own kit spots are Rarepigeon's. */
  var BORP_PAL = { J: '#2a2a33', K: '#4a4a56', W: '#f4f4ee', P: '#c3cad8', Q: '#8d96a8', B: '#8a5634', b2: null, L: '#ffffff', X: '#0b0b0d', Z: '#5c3a1e' }; delete BORP_PAL.b2;
  var DIG = { 3: ['WWW', '..W', '.WW', '..W', 'WWW'], 4: ['W.W', 'W.W', 'WWW', '..W', '..W'] };
  function borpStage(S0, st) { var G = S0.map(function (r) { return r.split(''); }), H = S0.length, x, y, k = function (X, Y) { return Y >= 0 && Y < H && X >= 0 && X < 32 ? G[Y][X] : '.'; };
    if (st === 0) { for (y = 0; y < H; y++) for (x = 0; x < 32; x++) { if (G[y][x] === 'g') G[y][x] = 'J'; else if (G[y][x] === 'f') G[y][x] = 'P'; } return G.map(function (r) { return r.join(''); }); } /* egg: Bo's charcoal + silver speckles */
    var cTop = 99, cBot = -1, legTop = 99, legL = 99; for (y = 0; y < H; y++) for (x = 0; x < 32; x++) { var c = G[y][x]; if (c === 'f' || c === 'h') { cTop = Math.min(cTop, y); cBot = Math.max(cBot, y); } if (c === 'j') { legTop = Math.min(legTop, y); legL = Math.min(legL, x); } }
    var BODY = { b: 'J', c: 'J', d: 'J', e: 'K', m: 'K' }, left = legL - 3, pantsTop = legTop - (st >= 3 ? 3 : 2);
    for (y = cTop; y < legTop; y++) for (x = left; x < 32; x++) { var q = G[y][x]; if (BODY[q] || (q === 'l' && y > cBot)) G[y][x] = y >= pantsTop ? (q === 'e' || q === 'm' ? 'Q' : 'P') : (BODY[q] || 'J'); } /* jersey above, silver pants below; tail + wing tip (left of the legs) stay pigeon grey */
    var ex = -1, ey = -1; for (y = 0; y < cTop; y++) for (x = 16; x < 32; x++) if (G[y][x] === 'l') { ex = x; ey = y; } /* eye black: under the eye highlight */
    if (ex >= 0) for (x = ex - 2; x <= ex - 1; x++) if (k(x, ey + 1) === 'b') G[ey + 1][x] = 'X';
    var bR = -1; for (y = cBot + 1; y < pantsTop; y++) for (x = 0; x < 32; x++) if (G[y][x] === 'J' || G[y][x] === 'K') bR = Math.max(bR, x);
    if (st >= 3 && bR > 0) { var nx = bR - 9, ny = cBot + 1; [3, 4].forEach(function (d, i) { DIG[d].forEach(function (row, r) { for (var c2 = 0; c2 < 3; c2++) if (row.charAt(c2) === 'W' && /[JK]/.test(k(nx + i * 4 + c2, ny + r))) G[ny + r][nx + i * 4 + c2] = st === 5 ? 'n' : 'W'; }); }); } /* #34 (gold at Mythic, like Bo's) */
    if (st >= 2 && bR > 0) { var fy = cBot + (st >= 3 ? 3 : 2), fx = bR - 1, BALL = st >= 3 ? ['.BBB.', 'BBLBB', 'ZBBBZ', '.ZZZ.'] : ['.BB.', 'BLBB', '.ZZ.'];
      BALL.forEach(function (row, r) { for (var c3 = 0; c3 < row.length; c3++) if (row.charAt(c3) !== '.') G[fy + r][fx + c3] = row.charAt(c3); }); /* football tucked at the chest */
      var O = G.map(function (r) { return r.slice(); }); BALL.forEach(function (row, r) { for (var c4 = -1; c4 <= row.length; c4++) [[0, -1], [0, 1], [-1, 0], [1, 0], [0, 0]].forEach(function (dd) { var X = fx + c4 + dd[0], Y = fy + r + dd[1]; if (k(X, Y) === '.') O[Y][X] = 'a'; }); }); G = O; } /* ink outline around the ball */
    return G.map(function (r) { return r.join(''); }); }
  var BORP = RPS ? { PAL: Object.assign({}, RPS.PAL, BORP_PAL), STAGES: RPS.STAGES.map(function (S0, st) { return borpStage(S0, st); }) } : null;
  if (BORP) { PAL.borp = BORP.PAL; NAMES.borp = 'Bo Pigeon'; }
  function borpDraw(stage, f, gear) { var S = BORP.STAGES[stage], g = grid(), dy = [0, -1, -1, 0][f];
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var c = S[y].charAt(x); if (c !== '.') set(g, x, y + dy, c); }
    if (stage > 0 && gear) { var rest = {}; ['feet', 'hand', 'head', 'body', 'face', 'back', 'weapon'].forEach(function (sl) { var it = gear[sl], id = it && (it.item || it.id);
        if (id && RP_KIT[id]) rpKit(g, S, dy, id); else if (it) rest[sl] = it; }); gear = rest; } /* same body as Rarepigeon: his kit sits on the same beak / crown / leg */
    if (stage > 0 && gear && Object.keys(gear).length) { var A = Object.assign({}, RP_A, { headTop: RP_A.headTop + dy, headBot: RP_A.headBot + dy, eyeY: RP_A.eyeY + dy, bodyTop: RP_A.bodyTop + dy, bodyEnd: RP_A.bodyEnd + dy }); gearLayer(g, 'borp', stage, A, gear); }
    return g; }
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
  function jpDraw(stage, f, gear) { var S = JPS.STAGES[stage], g = grid(), dy = stage > 0 ? [0, -1, -1, 0][f] : [0, 0, -1, 0][f];
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var c = S[y].charAt(x); if (c !== '.') set(g, x, y + dy, (f === 2 && stage > 0 && c === 'e') ? 'G' : c); }
    if (stage > 0 && gear && Object.keys(gear).length) gearLayer(g, 'jacksonpepe', stage, Object.assign({}, RP_A, { headTop: 4 + dy, headBot: 16 + dy, eyeY: 10 + dy, bodyTop: 19 + dy, bodyEnd: 28 + dy }), gear);
    return g; }
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
  function anchors(sp, stage, frame) { if (sp === 'rarepigeon' || sp === 'borp') { var e = [0, -1, -1, 0][frame || 0]; return { cx: 19, headTop: 3 + e, headBot: 11 + e, hw: 4, eyeY: 6 + e, bodyTop: 12 + e, bodyEnd: 23 + e, bw: 7 }; } if (sp === 'bojackson') { var d = [0, -1, -1, 0][frame || 0]; return { cx: 16, headTop: 2 + d, headBot: 11 + d, hw: 5, eyeY: 6 + d, bodyTop: 13 + d, bodyEnd: 21 + d, bw: 6 }; } var A = geom(Math.max(1, stage), frame); return { cx: A.cx, headTop: A.headTop, headBot: A.headBot, hw: A.hw, eyeY: sp === 'starlordkek' ? A.headTop + 1 : A.eyeY, bodyTop: A.bodyTop, bodyEnd: A.bodyEnd, bw: A.bw }; }
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
  function draw(sp, stage, frame, gear) { var s = Math.max(0, Math.min(5, stage | 0)), f = ((frame | 0) % 4 + 4) % 4, g = grid(); if (sp === 'bojackson') return boDraw(s, f, gear); if (sp === 'rarepigeon') return rpDraw(s, f, gear); if (sp === 'jacksonpepe' && JPS) return jpDraw(s, f, gear); if (sp === 'borp' && BORP) return borpDraw(s, f, gear); if (!DRAW[sp]) throw new Error('unknown contest pet ' + sp);
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
  /* 1 OF 1 CROSS BODIES (owner Nov 1 2026 7:36 PM CT "we should do this for all pets ... All that", branch allpets-crosses-1101, PREVIEW; rules gate
   * V2Rules.ACTIVATE_ONEOFONE_CROSS_BLOCK null = no pet ever has art.cross = inert). A baby of Bo Jackson or Rarepigeon times any other pet gets the 1 of 1's
   * body (Bo's #34 kit, or the pigeon) in the PARTNER's colours, wearing the partner's tell on the head (Pepe eye domes, Doge ears, Viking helmet + beard,
   * Kekamozard hat + glasses, Don hair + glasses ...). Bo times Rarepigeon stays the Bo Pigeon above. Looks only. No fire aura, no flame crown, no gold frame. */
  var CROSS_CANON = { pepe: ['#6aa84f', '#3d6fd1', '#b5533c'], wojak: ['#f1e4d4', '#5a6a8a', '#dcb8a2'], chud: ['#f1e4d4', '#6b7a3a', '#6b4a2b'], bobo: ['#704728', '#cc1414', '#c4805b'],
    mumu: ['#d06311', '#33ae1f', '#f0d8b2'], snibby: ['#ffdf01', '#fba901', '#dd9604'], dodo: ['#4a4a56', '#c41a1a', '#6b6b78'], kevin: ['#bd8a75', '#84a1b6', '#b1806c'],
    peepo: ['#8cc63f', '#0649ff', '#9f4d37'], sarutobi: ['#7f4106', '#5a2c03', '#e9a63a'], doge: ['#ce9a41', '#bd8a3b', '#f0e6cc'], lenny: ['#f2b98a', '#3a3a44', '#ffdcc0'],
    nakamoto: ['#488101', '#555555', '#7f7f7f'], kek: ['#5aa83c', '#c8342c', '#ffd23f'], wizard: ['#2f6fe0', '#ffd23f', '#e6e6ee'], funtrump: ['#ff8a2a', '#c8342c', '#e6bd85'],
    homer: ['#5aa83c', '#e0582e', '#f4f4ee'], viking: ['#3580a8', '#cc5a1e', '#9aa6b4'] };
  var CROSS_LABEL = { pepe: 'Pepe', wojak: 'Wojak', chud: 'Chud', bobo: 'Bobo', mumu: 'Mumu', snibby: 'Snibby', dodo: 'Dodo', kevin: 'Kevin', peepo: 'Peepo', sarutobi: 'Sarutobi', doge: 'Doge',
    lenny: 'Lenny', nakamoto: 'Nakamoto', kek: 'Kek', wizard: 'Wizard', funtrump: 'FUNTRUMP', homer: 'Homer', viking: 'Viking', kekamozard: 'Kekamozard', don: 'Don' };
  function cxRgb(h) { return hexRgb(h); }
  function cxHex(r) { return '#' + r.map(function (n) { n = Math.max(0, Math.min(255, Math.round(n))); return (n < 16 ? '0' : '') + n.toString(16); }).join(''); }
  function cxMix(a, b, t) { var A = cxRgb(a), B = cxRgb(b); return cxHex(A.map(function (n, i) { return n + (B[i] - n) * t; })); }
  function cxLum(h) { var c = cxRgb(h); return c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11; }
  function cxLt(h, t) { return cxMix(h, '#ffffff', t); } function cxDk(h, t) { return cxMix(h, '#000000', t); }
  /* the body's letters that take the partner's colours; everything else keeps the 1 of 1's own palette (Bo's jersey and silver pants, the pigeon's beak and legs) */
  function crossPal(body, col, st) { var K = CROSS_CANON[col] || CROSS_CANON.pepe, bd = K[0], ac = K[1], be = K[2], P = Object.assign({}, PAL[body]);
    if (body === 'bojackson') { if (st === 0) { P.q = cxLt(bd, 0.25); P.r = cxDk(bd, 0.12); P.g = cxDk(ac, 0.1); } else { P.B = cxLt(bd, 0.18); P.i = bd; P.A = cxDk(bd, 0.32); P.f = cxDk(bd, 0.62); } }
    else { var lightBelly = cxLum(be) > cxLum(bd) + 20; if (st === 0) { P.d = cxLt(bd, 0.22); P.g = ac; P.f = cxDk(ac, 0.2); }
      else { P.b = bd; P.c = cxDk(bd, 0.16); P.d = lightBelly ? be : cxLt(bd, 0.3); P.e = cxDk(bd, 0.45); P.m = cxDk(bd, 0.34); P.g = cxLt(ac, 0.2); P.f = ac; P.h = cxDk(ac, 0.3);
        if (st === 5) { P.o = cxDk(ac, 0.25); P.n = cxLt(ac, 0.35); } } } /* the pigeon's Mythic rim takes the partner's accent: never gold */
    return P; }
  /* head anchors read off the baked grid of THIS frame (so the idle bob is already in): head box, crown row, eye, chin, and the front foot */
  function crossHead(g, body) { var y, x, t = 99, b = -1, l = 99, r = -1, ex = -1, ey = -1, top = 99, foot = null, hk = body === 'bojackson' ? /[fiAB]/ : /b/;
    var lim = body === 'bojackson' ? 99 : 99; for (y = 0; y < N; y++) { var any = false; for (x = 0; x < N; x++) { var k = g[y][x]; if (!k) continue; if (y < top) top = y;
        if (hk.test(k)) { if (body === 'bojackson' && b >= 0 && y > b + 1) continue; any = true; if (y < t) t = y; if (y > b) b = y; if (x < l) l = x; if (x > r) r = x; } }
      if (body === 'bojackson' && t < 99 && !any && y > t + 2) break; if (body !== 'bojackson' && t < 99 && !any && y > t + 1) break; }
    for (y = t; y <= b; y++) for (x = l; x <= r; x++) { var k2 = g[y][x]; if (body === 'bojackson' ? (k2 === 'l' || k2 === 'g') : k2 === 'l') { if (x >= ex) { ex = x; ey = y; } } }
    if (ex < 0) { ex = r - 1; ey = t + Math.round((b - t) / 2); }
    for (y = N - 1; y >= 0 && !foot; y--) for (x = N - 1; x >= 0; x--) if (g[y][x] && g[y][x] !== 'y' && g[y][x] !== 'a' && g[y][x] !== 'n' && g[y][x] !== 'o') { foot = [x, y]; break; }
    var back = null, mid = Math.round((b + (foot ? foot[1] : b + 8)) / 2); for (x = 0; x < N && !back; x++) if (g[mid] && g[mid][x] && !/[yano]/.test(g[mid][x])) back = [x, mid];
    return { t: t, b: b, l: l, r: r, ex: ex, ey: ey, w: r - l + 1, foot: foot, back: back }; }
  var CXI = { ink: '#14141a', white: '#f8f8f4', steel: '#9aa6b4', steelD: '#5e6a78', horn: '#efe6cf', hornD: '#b9a985', gold: '#ffd23f', blue: '#2f4fd0', blueL: '#4f7cf0', blueD: '#1d3f94',
    star: '#fff6b0', wire: '#c8d0da', tear: '#7fc4ff', ft: '#ff9a2a', ftL: '#ffc04a', ftD: '#c86a14', beard: '#cc5a1e', beardD: '#8a3a10', bag: '#6a5a8a', stub: '#3a3a30' };
  function crossTell(g, tell, st, H, col) { var K = CROSS_CANON[col] || CROSS_CANON.pepe, bd = K[0], ac = K[1], be = K[2], big = st >= 3, mid = st === 2, put = [];
    function p(x, y, c) { if (x >= 0 && y >= 0 && x < N && y < N) { g[y][x] = c; put.push([x, y]); } }
    function stamp(M, ox, oy, C) { for (var yy = 0; yy < M.length; yy++) for (var xx = 0; xx < M[yy].length; xx++) { var k = M[yy].charAt(xx); if (k !== '.' && C[k]) p(ox + xx, oy + yy, C[k]); } }
    var cx = Math.round((H.l + H.r) / 2), t = H.t, ex = H.ex, ey = H.ey;
    function domes() { var M = big ? ['.ooo.', 'owwko', 'owkko', 'bbbbb'] : mid ? ['.oo.', 'owko', 'bbbb'] : ['oo', 'wk'], w = M[0].length, x1 = Math.min(H.r - w + 1, ex - w + 2), x0 = x1 - w;
      var C = { o: cxDk(bd, 0.2), w: CXI.white, k: CXI.ink, b: bd }; stamp(M, x0, t - M.length + 1, C); stamp(M, x1, t - M.length + 1, C); }
    function glasses(frame, lens) { var w = big ? 3 : 2, y0 = ey - (big ? 1 : 0), x0 = ex - w + 1; for (var xx = x0 - 1; xx <= x0 + w; xx++) { p(xx, y0 - 1, frame); p(xx, y0 + (big ? 2 : 1), frame); }
      for (var yy = y0; yy < y0 + (big ? 2 : 1); yy++) { p(x0 - 1, yy, frame); p(x0 + w, yy, frame); } p(x0 - 2, y0, frame); if (big) p(x0 - 3, y0, frame); if (lens) p(x0, y0, lens); }
    function hat(C) { var bw = big ? H.w + 2 : H.w + 1, b0 = cx - Math.floor(bw / 2), rows = Math.max(1, Math.min(big ? 3 : mid ? 2 : 1, t)), L = b0 + 1, R = b0 + bw - 2, i;
      for (var xx = b0; xx < b0 + bw; xx++) p(xx, t, xx === b0 || xx === b0 + bw - 1 ? C.d : C.m);
      for (i = 1; i <= rows; i++) { if (i > 1) L++; R -= 2; if (R < L) R = L; for (var x2 = L; x2 <= R; x2++) p(x2, t - i, x2 === L ? C.l : C.m); }
      p(L - 1, t - rows, C.m); if (big || mid) p(L - 2, t - rows + 1, C.d); if (big) p(L - 3, t - rows + 2, C.s); /* the tip flops back: a pet has no headroom for a tall cone */
      if (big) { p(L + 1, t - 1, C.s); p(L + 3, t - 2, C.s); } else if (mid) p(L + 1, t - 1, C.s); }
    function swoop(C) { var M = big ? ['...hhhhh..', '.hhHHHHhhh', 'hHHHHHHHHh', 'dHHHHHdHHd', '.d.dd..d..'] : mid ? ['..hhhh.', '.hHHHHh', 'dHHHHHd', '.d..d..'] : ['.hhh', 'hHHh', 'd..d'];
      stamp(M, Math.min(H.r - M[0].length + 3, cx - Math.floor(M[0].length / 2) + 1), t - M.length + 2, C); }
    function earsPair(M, C, inset) { var w = M[0].length; stamp(M, H.l + inset, t - M.length + 1, C); stamp(M, H.r - w + 1 - inset, t - M.length + 1, C); }
    function beardB(C) { var M = big ? ['bbbbb', 'bBbBb', '.bBb.', '.b.b.', '.d.d.'] : mid ? ['bbb', 'bBb', '.d.'] : ['bb', 'd.'], bx = Math.max(H.l, ex - M[0].length + 1); stamp(M, bx, H.b, C); }
    if (tell === 'pepe' || tell === 'peepo') domes();
    else if (tell === 'homer') { domes(); var hy = t - (big ? 4 : mid ? 3 : 2); p(cx - 3, hy, CXI.ink); p(cx - 3, hy - 1, CXI.ink); p(cx - 2, hy - 2, CXI.ink); if (big) { p(cx - 1, hy - 1, CXI.ink); p(cx - 1, hy - 2, CXI.ink); }
      for (var sx = ex - 2; sx <= ex; sx++) p(sx, ey + (big ? 3 : 2), '#8a7a52'); } /* Homer's two hairs + stubble */
    else if (tell === 'kek') { var nw = H.w + (big ? 2 : 0), n0 = cx - Math.floor(nw / 2), nr = big ? 3 : 2, ry; for (ry = 0; ry < nr; ry++) for (var xx = n0 + (ry === nr - 1 ? 1 : 0); xx < n0 + nw - (ry === nr - 1 ? 1 : 0); xx++) p(xx, t - ry, ry % 2 ? CXI.gold : CXI.blue);
      var ly = big ? 5 : mid ? 3 : 2; for (var yy = 1; yy <= ly; yy++) { p(n0, t + yy, yy % 2 ? CXI.gold : CXI.blue); if (big) p(n0 + 1, t + yy, yy % 2 ? CXI.gold : CXI.blue); }
      p(cx, t - (big ? 3 : 2), '#c8342c'); } /* nemes headdress, striped, with the red uraeus dot */
    else if (tell === 'bobo') earsPair(big ? ['.BBB.', 'BbbbB', 'BbbbB'] : mid ? ['BBB', 'BbB'] : ['BB'], { B: cxDk(bd, 0.15), b: be }, big ? 0 : 0);
    else if (tell === 'doge') earsPair(big ? ['B...', 'BB..', 'BbB.', 'BbbB'] : mid ? ['B..', 'BB.', 'BbB'] : ['B.', 'BB'], { B: cxDk(bd, 0.12), b: be }, 0);
    else if (tell === 'mumu') { var M = big ? ['h...', 'hH..', '.hHH'] : mid ? ['h..', '.hH'] : ['h.', '.h'], C = { h: CXI.horn, H: CXI.hornD }; stamp(M, H.l - (big ? 2 : 1), t - M.length + 2, C);
      stamp(M.map(function (r) { return r.split('').reverse().join(''); }), H.r - M[0].length + (big ? 3 : 2), t - M.length + 2, C); }
    else if (tell === 'wojak') { p(ex - 1, ey - 1, CXI.ink); p(ex, ey - 2, CXI.ink); if (big) p(ex + 1, ey - 2, CXI.ink); p(ex - 1, ey + 1, CXI.tear); if (big) { p(ex - 1, ey + 2, CXI.tear); p(ex - 2, ey + 1, CXI.white); } } /* sad brow + a tear */
    else if (tell === 'chud') glasses(CXI.ink); /* the beard is gear, not his part */
    else if (tell === 'nakamoto') glasses(CXI.wire, '#e8f4ff');
    else if (tell === 'kevin') { for (var kx = ex - (big ? 2 : 1); kx <= ex; kx++) { p(kx, ey - 1, cxDk(bd, 0.5)); p(kx, ey + 1, CXI.bag); } if (big) p(ex - 1, ey, cxDk(bd, 0.35)); } /* heavy lids, eye bags */
    else if (tell === 'lenny') { p(ex - 2, ey - 2, CXI.ink); p(ex - 1, ey - 3, CXI.ink); p(ex, ey - 3, CXI.ink); if (big) p(ex + 1, ey - 2, CXI.ink); p(ex - 1, ey, cxDk(bd, 0.4)); p(ex - 2, ey + 3, CXI.ink); p(ex - 1, ey + 3, CXI.ink); p(ex, ey + 2, CXI.ink); } /* raised brow, half lid, smirk */
    else if (tell === 'dodo') { var by2 = ey + (big ? 1 : 1), bl = big ? 5 : mid ? 4 : 3, bx0 = H.r; for (var i = 0; i < bl; i++) { p(bx0 + i, by2, '#d8c8a0'); if (big || mid) p(bx0 + i, by2 + 1, i === bl - 1 ? '#8a7a5a' : '#c8b88a'); }
      p(bx0 + bl, by2 + 1, '#8a7a5a'); if (big) p(bx0 + bl, by2 + 2, '#8a7a5a'); p(bx0, by2 - 1, ac); p(bx0 + 1, by2 - 1, ac); } /* the hooked dodo beak with a red cere */
    else if (tell === 'snibby' && H.foot) { var fx = H.foot[0], fy = H.foot[1]; [[1, 0], [1, -1], [1, -2]].slice(0, big ? 3 : 2).forEach(function (d) { p(fx + d[0], fy + d[1], '#fff6d0'); p(fx + d[0] + 1, fy + d[1], CXI.ink); }); } /* claws */
    else if (tell === 'sarutobi' && H.back) { var tx = H.back[0] - 1, ty = H.back[1], TL = big ? [[0, 0], [-1, 0], [-2, -1], [-3, -2], [-3, -3], [-3, -4], [-2, -5], [-1, -5], [0, -4]] : [[0, 0], [-1, -1], [-2, -2], [-1, -3]];
      TL.forEach(function (d, i) { p(tx + d[0], ty + d[1], i % 2 ? cxLt(bd, 0.25) : cxLt(bd, 0.12)); }); } /* curled monkey tail */
    else if (tell === 'wizard') hat({ m: CXI.blue, l: CXI.blueL, d: CXI.blueD, s: CXI.star });
    else if (tell === 'funtrump') swoop({ h: CXI.ft, H: CXI.ftL, d: CXI.ftD });
    else if (tell === 'viking') { var hw2 = Math.max(2, Math.floor(H.w / 2) + (big ? 1 : 0)); for (var r2 = 0; r2 < (big ? 3 : 2); r2++) for (var x3 = cx - hw2 + r2; x3 <= cx + hw2 - r2; x3++) p(x3, t - r2, r2 === 0 && (x3 === cx - hw2 || x3 === cx + hw2) ? CXI.steelD : x3 < cx ? CXI.steel : CXI.steelD);
      var hn = big ? [[-1, 0], [-2, 0], [-3, -1], [-3, -2]] : [[-1, 0], [-2, -1]]; hn.forEach(function (d) { p(cx - hw2 + d[0], t + d[1] - 1, CXI.horn); p(cx + hw2 - d[0], t + d[1] - 1, CXI.horn); });
      beardB({ b: CXI.beard, B: CXI.beardD, d: CXI.beardD }); } /* horned helmet + braided beard */
    else if (tell === 'kekamozard') { hat({ m: CXI.blue, l: CXI.blueL, d: CXI.blueD, s: CXI.star }); glasses(CXI.wire, '#e8f4ff'); }
    else if (tell === 'don') { swoop({ h: CXI.ft, H: CXI.ftL, d: CXI.ftD }); glasses(CXI.wire, '#e8f4ff'); }
    return put; }
  function crossOutline(g, put, ink) { var o = {}; put.forEach(function (q) { o[q[0] + ',' + q[1]] = 1; });
    put.forEach(function (q) { [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var X = q[0] + d[0], Y = q[1] + d[1]; if (X >= 0 && Y >= 0 && X < N && Y < N && !g[Y][X] && !o[X + ',' + Y]) g[Y][X] = ink; }); }); }
  /** crossDraw(cross, stage, frame, gear): 32x32 grid of hex colours. cross = { body: 'bojackson' | 'rarepigeon', col: colour root, tell: tell id } (rules art.cross). */
  function crossDraw(cx, stage, frame, gear) { var s = Math.max(0, Math.min(5, stage | 0)), f = ((frame | 0) % 4 + 4) % 4, body = cx.body === 'rarepigeon' ? 'rarepigeon' : 'bojackson';
    var base = body === 'bojackson' ? boDraw(s, f, null) : rpDraw(s, f, null), P = crossPal(body, cx.col, s), g = base.map(function (r) { return r.map(function (k) { return k ? (P[k] || k) : null; }); });
    if (s > 0) { var H = crossHead(base, body); var put = crossTell(g, cx.tell, s, H, cx.col); crossOutline(g, put, body === 'bojackson' ? PAL.bojackson.y : PAL.rarepigeon.a); }
    if (s > 0 && gear && Object.keys(gear).length) { var wg = body === 'bojackson' ? boDraw(s, f, gear) : rpDraw(s, f, gear), WP = PAL[body];
      for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (wg[y][x] !== base[y][x] && wg[y][x]) g[y][x] = WP[wg[y][x]] || wg[y][x]; } /* worn gear on top, in its own colours */
    return g; }
  function crossName(cx) { var who = CROSS_LABEL[cx.tell] || CROSS_LABEL[cx.col] || 'Cross'; return who + (cx.body === 'rarepigeon' ? ' Pigeon' : ' Bo'); }
  function crossFrames(cx, stage, bg, gear) { return [0, 1, 2, 3].map(function (f) { return toImg(crossDraw(cx, stage, f, gear), {}, bg); }); }
  var CROSS = { draw: crossDraw, frames: crossFrames, name: crossName, CANON: CROSS_CANON, LABEL: CROSS_LABEL, TELLS: Object.keys(CROSS_LABEL) };
  return { CROSS: CROSS, BORP: BORP, STAGES: STAGES, NAMES: NAMES, PAL: PAL, DIM: DIM, draw: draw, render: render, frames: frames, anchors: anchors, SPECIES: Object.keys(NAMES) };
});
