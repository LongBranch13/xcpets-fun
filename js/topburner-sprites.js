/* TOP BURNER FIVE sprites (1 of 1 each, PREVIEW, branch top-burner-five-1107).
 * Gift eggs for the #1 all-time XCPETS burner. NOT granted until V2Rules.ACTIVATE_TOP_BURNER_FIVE_BLOCK
 * is set (null = OFF). 32x32, ink outline, 4 frames: rest, bob, blink, action.
 * Looks follow the owner's references (t3177ua0): Bumble, Harry, a grey Pepe, the upright
 * cryptid sketch, and a sleek suited astronaut. No car. No fire aura, no flame crown,
 * no gold frame, no flame pixels, no text. */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.TopBurnerSprites = factory(); })(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  var N = 32, STAGES = ['Egg', 'Hatchling', 'Juvenile', 'Adult', 'Elder', 'Mythic'];
  var IDS = ['yeti', 'sasquatch', 'greypepe', 'chupacabra', 'starman'];
  var NAMES = { yeti: 'Abominable Snowman', sasquatch: 'Sasquatch', greypepe: 'GreyPepe Alien', chupacabra: 'Chupacabra', starman: 'Starman' };
  var PAL = {
    yeti: { n: '#1a1420', W: '#f3f4f6', w: '#d5dae0', d: '#b0b6c0', T: '#ffffff', M: '#3c4654', m: '#2a313c', E: '#f7f8fa', P: '#14161c', G: '#1c2028', X: '#fbfaf6', C: '#3a4250', o: '#e6eaef', F: '#3a4250', K: '#d5e4f2' },
    sasquatch: { n: '#1a1420', W: '#7a4e30', w: '#5c3822', d: '#3e2616', S: '#e0b890', s: '#c49878', B: '#e6dfd4', b: '#c2bbb0', E: '#f4f2ea', P: '#1a1420', m: '#7a4038', X: '#fbfaf6', o: '#8d6244', F: '#3e2616', C: '#3e2616', H: '#d7b08a', K: '#f3eee6' },
    greypepe: { n: '#1a1420', W: '#9aa3aa', w: '#7a848c', d: '#3e464c', E: '#121418', P: '#f7f8fa', m: '#e2583a', o: '#8b949c', F: '#5c656c', C: '#6e767e', I: '#d5dbe0', K: '#ffffff' },
    chupacabra: { n: '#1a1420', W: '#7d8a6a', w: '#5c6850', d: '#3a322c', E: '#0e1014', P: '#f4f6f8', q: '#241c18', K: '#efe6c8', C: '#241c18', F: '#241c18', o: '#6a765c', X: '#fbfaf6', m: '#5a3030' },
    starman: { n: '#1a1420', W: '#f4f6f8', w: '#d5dbe2', d: '#4a515a', I: '#2c333c', A: '#e2a23a', a: '#c48428', E: '#fff6d4', P: '#6a4518', Q: '#b7c0c8', F: '#2c333c', o: '#5a6270', Z: '#c1121f', U: '#f7f7f7', N: '#1d3f8a', K: '#fff8e4' }
  };
  function grid() { var g = []; for (var i = 0; i < N; i++) g.push(new Array(N).fill(null)); return g; }
  function set(g, x, y, k) { if (x >= 0 && y >= 0 && x < N && y < N) g[y][x] = k || null; }
  function outline(g) { var o = g.map(function (r) { return r.slice(); }); for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (!g[y][x]) {
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) { var X = x + d[0], Y = y + d[1]; return X >= 0 && Y >= 0 && X < N && Y < N && g[Y][X]; })) o[y][x] = 'n'; } return o; }
  function hexRgb(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function deadRgb(rgb) { var L = 0.3 * rgb[0] + 0.59 * rgb[1] + 0.11 * rgb[2]; return [Math.round(L * 0.45 + 48), Math.round(L * 0.47 + 46), Math.round(L * 0.4 + 42)]; }
  function put(g, rows, bottom, bob) { var y0 = bottom - rows.length + 1 + (bob || 0), w = 0, r, x, y;
    for (y = 0; y < rows.length; y++) if (rows[y].length > w) w = rows[y].length;
    for (y = 0; y < rows.length; y++) { r = rows[y]; var x0 = ((N - w) >> 1) + ((w - r.length) >> 1);
      for (x = 0; x < r.length; x++) if (r.charAt(x) !== '.') set(g, x0 + x, y0 + y, r.charAt(x)); }
    return y0; }
  function blink(g, lid) { for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (g[y][x] === 'E' || g[y][x] === 'P') g[y][x] = lid; }
  function lift(g, keys) { var pix = [], y, x, k; for (y = 0; y < N; y++) for (x = 0; x < 15; x++) { k = g[y][x]; if (keys[k]) pix.push([x, y, k]); }
    pix.forEach(function (p) { set(g, p[0], p[1], null); }); pix.forEach(function (p) { set(g, p[0], p[1] - 4, p[2]); }); }
  function eyeTop(g) { var ey = 99, top = 99, hx = 16, y, x; for (y = 0; y < N; y++) for (x = 0; x < N; x++) { if (g[y][x] && y < top) top = y; if ((g[y][x] === 'E' || g[y][x] === 'P') && y < ey) { ey = y; hx = x; } }
    return { ey: ey === 99 ? 10 : ey, top: top === 99 ? 4 : top, hx: hx }; }
  var YETI = [
    ['..T.TT.', '.WWWWWW', 'WMMMMMW', 'WMEEEMW', 'WMEPPMW', 'WMMMMMW', 'WMXGXMW', 'CWWWWWC', 'WoWWWoW', '.FF.FF.'],
    ['.TT.TTT.', 'WWWWWWWW', 'WWMMMMWW', 'WMMEEEMW', 'WMMEPPMW', 'WWMMMMWW', 'WWMXGXMW', 'WWWWWWWW', 'CWWWWWWC', 'WWoWWWoW', 'WWWWWWWW', '.FFF.FFF'],
    ['...T..TT.T....', '..WWWWWWWWWWW.', '.WWWMMMMMMMMW.', 'WMMEEE..EEEMMW', 'WMMEPP..PPEMMW', 'WMMEEE..EEEMMW', 'WWMMMMMMMMMMWW', 'WWMMGGGGGGGGMW', 'WWMMXGXGXGXGMW', 'WWWWWWWWWWWWWW', 'CWWWWWWWWWWWWC', 'WWWoWWWWWWWWoW', 'WWWoWWWWWWWWoW', '.WWWWWWWWWWWWW', '...FFF...FFF..'],
    ['...T..TT.T....', '..WWWWWWWWWWW.', '.WWWMMMMMMMMW.', 'WMMEEE..EEEMMW', 'WMMEPP..PPEMMW', 'WMMEEE..EEEMMW', 'WWMMMMMMMMMMWW', 'WWMMGGGGGGGGMW', 'WWMMXGXGXGXGMW', 'WWWWWWWWWWWWWW', 'WWWWWWWWWWWWWW', 'CWWWWWWWWWWWWC', 'WWWoWWWWWWWWoW', 'WWWoWWWWWWWWoW', '.WWWWWWWWWWWWW', '..WWWWWWWWWWW.', '...FFF...FFF..'],
    ['...T..TT.T....', '..WwWWWWWWWWw.', '.WWwMMMMMMMMw.', 'WMmEEE..EEEmMW', 'WMMEPP..PPEMMW', 'WMmEEE..EEEmMW', 'WwMMMMMMMMMMWw', 'WWMMGGGGGGGGMW', 'WWMMXGXGXGXGMW', 'WwWWWWWWWWWWWw', 'WWWWWWWWWWWWWW', 'CWWWWWWWWWWWWC', 'WWWoWWWWWWWWoW', 'WWwoWWWWWWWWoW', '.WWWWWWWWWWWWW', '..WWWWWWWWWWW.', '...FFF...FFF..'],
    ['..K.TT.TT.K...', '..WWWWWWWWWWW.', '.WWWMMMMMMMMW.', 'WMMEEE..EEEMMW', 'WMMEPP..PPEMMW', 'WMMEEE..EEEMMW', 'WWMMMMMMMMMMWW', 'WWMMGGGGGGGGMW', 'WWMMXGXGXGXGMW', 'WWMMXGXGXGXGMW', 'WWWWWWWWWWWWWW', 'WWWWWWWWWWWWWW', 'CWWWWWWWWWWWWC', 'WWWoWWWWWWWWoW', 'WWWoWWWWWWWWoW', '.WWWWWWWWWWWWW', '..WWWWWWWWWWW.', '...FFF...FFF..']
  ];
  var HARRY = [
    ['..WWWW..', '.WSSSSW.', 'WSEEPESW', 'WSSSSSSW', '.BBBBBB.', 'CWWWWWWC', 'WWWWWWWW', 'WoWWWWoW', '.FF..FF.'],
    ['...WWWW...', '..WSSSSW..', '.WWSEEPSWW.', '.WWSSSSSWW.', '..WBBBBBW..', '.WWBBBBBBW.', 'C.WWWWWW.C', 'C.WWWWWW.C', 'WWWWWWWWWW', 'WoWWWWWWoW', '.FF....FF.'],
    ['.....WWWW.....', '....WSSSSW....', '...WWSEEPSWW...', '...WWSSSSSWW...', '....WBBBBBW...', '...WBmBBBmBW...', '..WWWBBBBBBWW.', 'C...WWWWWW...C', 'C...WWWWWW...C', '..WWWWWWWWWW..', '..WoWWWWWWoW..', '...WW....WW...', '...FF....FF...'],
    ['.....WWWW.....', '....WSSSSW....', '...WWSEEPSWW...', '...WWSSSSSWW...', '....WBBBBBW...', '...WBmBBBmBW...', '..WWWBBBBBBWW.', 'C...WWWWWW...C', 'C...WWWWWW...C', '..WWWWWWWWWW..', '..WoWWWWWWoW..', '...WW....WW...', '...FF....FF...'],
    ['.....WwWW.....', '....WsSSSSw....', '...WWsSEEPSWw..', '...WWwSSSSSwW..', '....WbBBBBb...', '...WWbBBBBBbW.', '..WWwBBBBBBwW.', 'C...WWWWWW...C', 'C...WWWWWW...C', '..WwWWWWWWWw..', '..WoWWWWWWoW..', '...WW....WW...', '...FF....FF...'],
    ['.....WWWW.....', '....WSSSSW....', '...WWSEEPSWW...', '...WWSSSSSWW...', '....WKBBBBKW...', '...WWBBBBBBW..', '..WWWBBBBBBWW.', 'C...WWWWWW...C', 'C...WWWWWW...C', '..WWWWWWWWWW..', '..WoWWWWWWoW..', '...WW....WW...', '...FF....FF...']
  ];
  var PEPE = [
    ['WW..WW', 'WdEPdW', 'WEEEWW', 'WmmmmW', 'mWWWWm', '.CooC.', '.F..F.'],
    ['.WWW..WWW.', 'WWddEPdWW', 'WWEEEEEWW', 'WWWWWWWWW', 'WmmmmmmmW', 'mWWWWWWWm', '..CoooC..', '..FF.FF..'],
    ['..WWWW...WWWW..', '.WWdddd.ddddW.', '.WWEEEPP.PPEEW.', '.WWEEEEE.EEEEW.', 'WWWWWWWWWWWWWWW', 'WmmmmmmmmmmmmmW', 'mWWWWWWWWWWWWWm', '..CoooooooooC..', '..ooooooooooo..', '..FF.......FF..'],
    ['..WWWW...WWWW..', '.WWdddd.ddddW.', '.WWEEEPP.PPEEW.', '.WWEEEEE.EEEEW.', 'WWWWWWWWWWWWWWW', 'WWWWWWWWWWWWWWW', 'WmmmmmmmmmmmmmW', 'mWWWWWWWWWWWWWm', '..CoooooooooC..', '..ooooooooooo..', '..FF.......FF..'],
    ['..WWWW...WWWW..', '.WWdddd.ddddW.', '.WWEEwPP.PPwEW.', '.WWwEEEE.EEEEwW.', 'WWwWWWWWWWWWwWW', 'WWWWWWWWWWWWWWW', 'WmmmmmmmmmmmmmW', 'mWWWWWWWWWWWWWm', '..CoooooooooC..', '..ooooooooooo..', '..FF.......FF..'],
    ['..WWWW...WWWW..', '.WWdddd.ddddW.', '.WWEEEPP.PPKEW.', '.WWEEEEE.EEEEW.', 'WWWWWWWWWWWWWWW', 'WWWWWWWWWWWWWWW', 'WmmmmmmmmmmmmmW', 'mWWWWWWWWWWWWWm', '..CoooooooooC..', '..ooooooooooo..', '..FF.......FF..']
  ];
  var CHUPA = [
    ['..qK.', '.WEEW', 'WWWdW', 'WCCCW', 'WoWWo', '.F.F.', 'FF.FF'],
    ['..qKq..', '.WWEEW.', 'WWWWdWW', 'WWdWWdW', 'WWCCCoW', 'WWoWWWW', '..F..F.', '.FF..FF'],
    ['....qKqK....', '...qK..qK...', '..qWEE..EEWq.', '.WWEP..PEWWW.', '.WWdWWdWWdWW.', '..CCCWoWCCC..', '..WWWoWWWWW..', '...WW...WW...', '....W...W....', '...FF...FF...'],
    ['....qKqK....', '...qK..qK...', '..qWEE..EEWq.', '.WWEP..PEWWW.', '.WWdWWdWWdWW.', '..CCCWoWCCC..', '..WWWoWWWWW..', '...WW...WW...', '....W...W....', '...FF...FF...'],
    ['...qK.qK...', '..qWwE..EwW.', '.WWwWWWWWWw.', '.WWdWWdWWdW.', '..WWCCCCoWW..', '..WWwoWWWWW..', '...WW...WW...', '....W....W....', '...FF....FF...'],
    ['..KK.qK.KK.', '..qWEE..EEW.', '.WWWWWWWWWW.', '.WWdWWdWWdW.', '..WWCCCCoWW..', '..WWWoWWWWW..', '...WW...WW...', '....W....W....', '...FF....FF...']
  ];
  var STAR = [
    ['..WWWW..', '.WAAAAW.', '.WEEPAW.', '.WWWWWW.', 'NZWWWWWW', 'WoWWWWoW', 'QW....WQ', '.FF..FF.'],
    ['...WWWW...', '..WAAAAW..', '..WEEPAA..', '..WWWWWW..', '.NZWWWWWW.', '.WwdWWWWd.', '.WoWWWWWo.', 'QW......WQ', '..FF..FF..'],
    ['.....WWWWW....', '....WWWWWW....', '...WWAAAAAAW..', '...WAEEPPAAAW.', '...WWWWWWWW...', '..NZWWWWWWWW..', '..WwdWWWWWWd..', '..WWoWWWWWWo..', '..WWWWWWWWWW..', '.QW........WQ.', '...WWW..WWW...', '...FFF..FFF...'],
    ['.....WWWWW....', '....WWWWWW....', '...WWAAAAAAW..', '...WAEEPPAAAW.', '...WWWWWWWW...', '..NZWWWWWWWW..', '..WwdWWWWWWd..', '..WWoWWWWWWo..', '..WWWWWWWWWW..', '.QW........WQ.', '...WWW..WWW...', '...FFF..FFF...'],
    ['.....WWWWW....', '....WWwWWWw...', '...WWwAAAAWw..', '...WWWEEPAAW..', '...WWwWWWWWw..', '..NZWwWWWWWw..', '..WwdWWWWWWd..', '..WWoWWWWWWo..', '..WWWWWWWWWW..', '.QW........WQ.', '...WWW..WWW...', '...FFF..FFF...'],
    ['.....WWWWW....', '....WWWWWW....', '...WWAAAAKAW..', '...WAEEPKAAAW.', '...WWWWWWWW...', '..NZWWWWWWWW..', '..WwdWWWWWWd..', '..WWoWWWWWWo..', '..WWWWWWWWWW..', '.QW........WQ.', '...WWW..WWW...', '...FFF..FFF...']
  ];
  var EGG = {
    yeti: ['..TT..', '.WWWWW.', 'WMMMMMW', 'WMEEPMW', 'WMXXMW.', 'WWWWWWW'],
    sasquatch: ['.WWWWW.', 'WSSSSSW', 'WSEEPSW', '.BBBBB.', 'WWWWWWW'],
    greypepe: ['.WW..WW.', 'WdEEPEW', 'WWWWWWW', 'WmmmmmW', '.WWWWW.'],
    chupacabra: ['..qK..', '.WEEPW', 'WWdWWdW', 'WWWWWWW', '..qKq..'],
    starman: ['.WWWWW.', 'WAAAAAW', 'WEEPAAW', 'WWWWWWW', 'NZ']
  };
  function finish(g, frame, gear, lid, hands) {
    if (frame === 2) blink(g, lid);
    if (frame === 3) lift(g, hands);
    var a = eyeTop(g);
    gearOn(g, gear, { cx: 16, ey: a.ey, top: a.top, handX: Math.max(1, a.hx - 6), handY: Math.min(N - 3, a.ey + 8) });
    return outline(g);
  }
  function draw(id, stage, frame, gear) {
    if (!PAL[id]) return grid();
    var g = grid(), bob = [0, -1, -1, 0][frame || 0];
    if (!stage) { put(g, EGG[id], 24, frame === 1 ? -1 : frame === 3 ? 1 : 0); if (frame === 2) blink(g, id === 'greypepe' || id === 'chupacabra' ? 'd' : id === 'starman' ? 'I' : id === 'yeti' ? 'M' : 'S'); return outline(g); }
    var pack = id === 'yeti' ? YETI : id === 'sasquatch' ? HARRY : id === 'greypepe' ? PEPE : id === 'chupacabra' ? CHUPA : STAR;
    put(g, pack[stage - 1], 30, bob);
    var lid = id === 'yeti' ? 'M' : id === 'sasquatch' ? 'S' : id === 'starman' ? 'I' : 'd';
    var hands = id === 'starman' ? { Q: 1 } : { C: 1 };
    return finish(g, frame, gear, lid, hands);
  }
  function gearOn(g, gear, a) {
    var Gr = gear || {}; if (!Gr.head && !Gr.face && !Gr.body && !Gr.back && !Gr.feet && !Gr.hand && !Gr.weapon) return;
    function col(sl, i, d) { var it = Gr[sl]; return (it && it.cols && (it.cols[i] || it.cols[0])) || d; }
    var ey = a.ey, top = a.top;
    if (Gr.head) { var hc = col('head', 0, '#c0303a'), hd = col('head', 1, '#7a1820');
      for (var hy = top - 3; hy <= top - 1; hy++) { for (var x = a.cx - 3; x <= a.cx + 2; x++) if (!g[Math.max(0, hy)] || (g[hy] && g[hy][x] !== 'E' && g[hy][x] !== 'P')) set(g, x, hy, hy === top - 1 ? hd : hc); } }
    if (Gr.body) { var bc = col('body', 0, '#9aa4b0'), bd = col('body', 1, '#5a6470');
      for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (g[y][x] === 'o') g[y][x] = (x + y) % 4 === 0 ? bd : bc; }
    if (Gr.feet) { var fc = col('feet', 0, '#6a3a1a');
      for (var y2 = 0; y2 < N; y2++) for (var x2 = 0; x2 < N; x2++) if (g[y2][x2] === 'F') g[y2][x2] = fc; }
    if (Gr.back) { var kc = col('back', 0, '#c0303a'), kd = col('back', 1, '#7a1820');
      for (var y3 = ey + 2; y3 < N - 2; y3++) { var left = 99; for (var x3 = 0; x3 < N; x3++) if (g[y3][x3] && g[y3][x3] !== 'n') { left = x3; break; }
        if (left === 99) continue; set(g, left - 1, y3, y3 % 2 ? kd : kc); set(g, left - 2, y3, kd); } }
    if (Gr.face && ey >= 0) { var gc = col('face', 0, '#141018');
      [[-2, -1], [-1, -1], [1, -1], [2, -1]].forEach(function (p) { var x = a.cx + p[0], y = ey + p[1]; if (y < ey && g[y] && g[y][x] !== 'E' && g[y][x] !== 'P') set(g, x, y, gc); }); }
    if (Gr.hand || Gr.weapon) { var hx = Math.max(1, Math.min(N - 2, a.handX)), hy4 = Math.max(2, Math.min(N - 2, a.handY));
      if (Gr.hand) { var wc = col('hand', 0, '#8a5a2a'); for (var t = 0; t < 5; t++) if (getk(g, hx, hy4 - t) !== 'E' && getk(g, hx, hy4 - t) !== 'P') set(g, hx, hy4 - t, t < 2 ? wc : col('hand', 1, '#c8c8d0')); }
      if (Gr.weapon) { var wx = Math.min(N - 2, hx + 2), w1 = col('weapon', 0, '#9a4a12'); for (var t2 = 0; t2 < 7; t2++) set(g, wx, Math.max(0, hy4 - t2), t2 === 6 ? col('weapon', 1, '#c1121f') : w1); } }
  }
  function getk(g, x, y) { return x >= 0 && y >= 0 && x < N && y < N ? g[y][x] : null; }
  function render(id, stage, frame, bg, gear, opts) { var g = draw(id, stage, frame, gear, opts), pal = PAL[id], dead = opts && opts.dead, d = [], Bg = hexRgb(bg || '#1b2430');
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var k = g[y][x], c = null;
      if (k) c = k.charAt(0) === '#' ? hexRgb(k) : (pal[k] ? hexRgb(pal[k]) : null); if (c && dead && k !== 'n') c = deadRgb(c); if (!c) c = Bg;
      d.push(c[0], c[1], c[2], 255); } return { width: N, height: N, data: d }; }
  function frames(id, stage, bg, gear, opts) { return [0, 1, 2, 3].map(function (f) { return render(id, stage, f, bg, gear, opts); }); }
  function anchors(id, stage, frame) { var g = draw(id, stage, frame || 0, {}), ey = -1, x0 = 99, x1 = -1;
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var k = g[y][x]; if (k === 'E' || k === 'P') { if (ey < 0) ey = y; if (y === ey) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); } } }
    return { ey: ey, ex0: x0, ex1: x1 }; }
  function has(id) { return IDS.indexOf(id) >= 0; }
  return { IDS: IDS, NAMES: NAMES, STAGES: STAGES, PAL: PAL, draw: draw, render: render, frames: frames, anchors: anchors, has: has };
});
