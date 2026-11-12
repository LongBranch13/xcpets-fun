/* XCPETS MYTHIC GOD LOOP: the looks, chips and helpers (display only, never read by replay).
 * Port of previews/god-looks/_build/fx.py (owner: "The bodies should shine like gods."):
 *   God (resurrected pets and God-born babies): a shining body (tint + glow aura + light sweep) plus 2 of 6 divine effects,
 *     a light tint and a halo style from sha256("XCPETS:god-look:" + id) (60 looks).
 *   Mythic God: its Pantheon seat recipe, a stronger shine, Twin Moons and the violet starlight trace (replaces the electric aura).
 *   Mythic-fed (cured) zombie: its own aura, a solid pale-gold outline and a soft teal halo (8-bit, never blended into the backdrop).
 *   Mythic zombie: a dead, broken grey-blue trace where its electric rim was.
 * God looks for existing Gods are on right away (owner Oct 31 2026 9:01 PM CT), not tied to the Mythic gate. ?godlook=0 turns them off (?godlook=1 kept, no-op).
 * Sprites carry no text. Effects are 8-frame loops on top of the pet's own idle frames. Loaded after js/v2-zombies.js. */
(function () {
  'use strict';
  var R = window.V2Render, NF = 8, Q = (typeof location !== 'undefined' && location.search) || '';
  var FORCE = /[?&]godlook=1(&|$)/.test(Q), OFF = /[?&]godlook=0(&|$)/.test(Q);
  function V() { return window.V2Rules || window.V2 || {}; }
  function tipOf(w) { try { return (w && w.tip) || (window.V2Chain && V2Chain.state && V2Chain.state().tip) || 0; } catch (e) { return 0; } }
  function gateOn(w) { return !OFF; } /* owner Oct 31 2026 9:01 PM CT [pt2525u]: existing Gods shine right away (display only, not tied to the Mythic gate); ?godlook=0 turns it off */
  /* ---------- small pixel helpers (img = array of [r,g,b]) ---------- */
  function badge(x, y) { return x >= 26 && y < 5; }
  function onAt(on, x, y) { return x >= 0 && x < 32 && y >= 0 && y < 32 && on[y * 32 + x]; }
  function free(on, x, y) { return x >= 0 && x < 32 && y >= 0 && y < 32 && !on[y * 32 + x] && !badge(x, y); }
  function put(img, on, x, y, c, over) { if (x >= 0 && x < 32 && y >= 0 && y < 32 && !badge(x, y) && (over || !on[y * 32 + x])) img[y * 32 + x] = c; }
  function mix(a, b, t) { return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)]; }
  function bbox(on) { var x0 = 99, y0 = 99, x1 = -1, y1 = -1; for (var i = 0; i < 1024; i++) if (on[i]) { var x = i % 32, y = (i / 32) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return x1 < 0 ? [8, 8, 24, 28] : [x0, y0, x1, y1]; }
  function rim(on) { var o = []; for (var y = 0; y < 32; y++) for (var x = 0; x < 32; x++) if (!on[y * 32 + x] && !badge(x, y) && (onAt(on, x + 1, y) || onAt(on, x - 1, y) || onAt(on, x, y + 1) || onAt(on, x, y - 1))) o.push([x, y]); return o; }
  function rng(seed) { var s = (seed >>> 0) || 1; return { f: function () { s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }, i: function (a, b) { return a + Math.floor(this.f() * (b - a + 1)); } }; }
  var WH = [255, 255, 255];
  /* ---------- palettes ---------- */
  var PAL = {
    gold: { hi: [255, 250, 226], mid: [255, 222, 120], lo: [214, 164, 64], eye: [255, 246, 196], eye2: [255, 204, 72], feather: [255, 252, 240], fsh: [222, 214, 196], fout: [206, 176, 104] },
    silver: { hi: [255, 255, 255], mid: [214, 224, 240], lo: [150, 162, 190], eye: [250, 252, 255], eye2: [186, 204, 236], feather: [250, 252, 255], fsh: [200, 208, 226], fout: [150, 160, 188] },
    azure: { hi: [236, 250, 255], mid: [140, 210, 255], lo: [72, 140, 230], eye: [226, 248, 255], eye2: [96, 196, 255], feather: [246, 252, 255], fsh: [196, 220, 244], fout: [110, 160, 220] },
    dawn: { hi: [255, 246, 236], mid: [255, 196, 168], lo: [222, 128, 140], eye: [255, 240, 226], eye2: [255, 170, 140], feather: [255, 248, 244], fsh: [236, 210, 208], fout: [214, 150, 150] } };
  var PALS = ['gold', 'silver', 'azure', 'dawn'], POOL = 'EHWCFL', NAMES = { E: 'glowing eyes', H: 'halo', W: 'wings', C: 'clouds', F: 'holy flame', L: 'lightning' };
  /* the 21 Pantheon seats: [title, effects, tint, halo] (from previews/god-looks, approved look recipes) */
  var SEATS = [['Keeper of the Genesis Block', 'EHWL', 'gold', 'ring'], ['Herald of Kek', 'EHC', 'dawn', 'nimbus'], ['Oracle of the Halving', 'EHF', 'azure', 'ring'], ['Lord of the Longest Chain', 'EHL', 'silver', 'nimbus'],
    ['Warden of the Mempool', 'EWC', 'silver', null], ['Titan of the Hashrate', 'EWF', 'gold', null], ['Herald of the Lightning', 'EWL', 'azure', null], ['Weaver of the Timechain', 'ECF', 'dawn', null],
    ['Seeker of the Golden Nonce', 'ECL', 'gold', null], ['Guardian of the Proof of Burn', 'EFL', 'dawn', null], ['Muse of the Rare Pepes', 'HWC', 'dawn', 'ring'], ['Forger of Assets', 'HWF', 'gold', 'nimbus'],
    ['Sentinel of the Cold Wallet', 'HWL', 'silver', 'ring'], ['Sage of the Merkle Root', 'HCF', 'azure', 'nimbus'], ['Bringer of the Block Reward', 'HCL', 'gold', 'ring'], ['Lord of the Sacred Swamp', 'HFL', 'azure', 'ring'],
    ['Keeper of the 21 Million', 'WCF', 'silver', null], ['The Unshaken Hodler', 'WCL', 'silver', null], ['Lantern of the Node Runners', 'WFL', 'gold', null], ['Steward of the Difficulty', 'CFL', 'azure', null],
    ['Keeper of the Final Block', 'EHW', 'silver', 'nimbus']];
  var ROMAN = 'I II III IV V VI VII VIII IX X XI XII XIII XIV XV XVI XVII XVIII XIX XX XXI'.split(' ');
  function sha(s) { try { return PetCore.sha256Hex(s); } catch (e) { return null; } }
  function godMix(id) { var h = sha('XCPETS:god-look:' + id), pairs = []; for (var i = 0; i < 6; i++) for (var j = i + 1; j < 6; j++) pairs.push(POOL[i] + POOL[j]);
    if (!h) return { fx: 'EH', pal: 'gold', halo: 'ring', mythic: false };
    var n; if (typeof BigInt === 'function') { n = BigInt('0x' + h); return { fx: pairs[Number(n % BigInt(15))], pal: PALS[Number((n / BigInt(15)) % BigInt(4))], halo: ['ring', 'nimbus'][Number((n / BigInt(60)) % BigInt(2))], mythic: false }; }
    var m = 0; for (var k = 0; k < h.length; k++) m = (m * 16 + parseInt(h[k], 16)) % 120; return { fx: pairs[m % 15], pal: PALS[Math.floor(m / 15) % 4], halo: ['ring', 'nimbus'][Math.floor(m / 60) % 2], mythic: false }; }
  function seatLook(n) { var s = SEATS[(n - 1) % 21] || SEATS[0]; return { fx: s[1], pal: s[2], halo: s[3], mythic: true, seed: n }; }
  /* ---------- anatomy ---------- */
  function anat(on, eyesL) { var bb = bbox(on), x0 = bb[0], y0 = bb[1], x1 = bb[2], y1 = bb[3], eyes = [];
    (eyesL || []).forEach(function (e) { (e || []).forEach(function (q) { if (q >= 0 && q < 1024) eyes.push(q); }); });
    var hx = eyes.length ? Math.round(eyes.reduce(function (a, q) { return a + q % 32; }, 0) / eyes.length) : Math.round((x0 + x1) / 2);
    var ey = eyes.length ? Math.round(eyes.reduce(function (a, q) { return a + ((q / 32) | 0); }, 0) / eyes.length) : y0 + Math.floor((y1 - y0) / 3);
    var ht = 99; for (var y = 0; y < 32 && ht === 99; y++) for (var x = hx - 3; x <= hx + 3; x++) if (x >= 0 && x < 32 && on[y * 32 + x]) { ht = y; break; } if (ht === 99) ht = y0;
    var rr = Math.min(31, ht + 2), mn = 99, mx = -1; for (x = 0; x < 32; x++) if (on[rr * 32 + x]) { if (x < mn) mn = x; if (x > mx) mx = x; }
    return { on: on, bb: bb, eyes: eyes, hx: hx, ey: ey, ht: ht, hw: mx >= 0 ? mx - mn + 1 : 10 }; }
  /* ---------- 1. glowing eyes ---------- */
  var PULSE = [0.35, 0.6, 0.85, 1.0, 1.0, 0.85, 0.6, 0.35];
  function eyesFx(img, A, f, P) { var t = PULSE[f % NF], E = {}, L = [], lum = {}; A.eyes.forEach(function (q) { if (!E[q]) { E[q] = 1; L.push(q); } }); if (!L.length) return;
    var mx = -1, mn = 1e9; L.forEach(function (q) { var v = img[q][0] + img[q][1] + img[q][2]; lum[q] = v; if (v > mx) mx = v; if (v < mn) mn = v; }); var mid = (mx + mn) / 2;
    L.forEach(function (q) { img[q] = lum[q] <= mid || mx - mn < 120 ? mix(P.eye2, WH, 0.25 * t) : mix(img[q], P.eye, 0.3 + 0.35 * t); });
    L.forEach(function (q) { [-1, 1, -32, 32].forEach(function (d) { var n = q + d; if (n >= 0 && n < 1024 && !E[n] && Math.abs(n % 32 - q % 32) <= 1 && !badge(n % 32, (n / 32) | 0)) img[n] = mix(img[n], P.eye2, 0.18 + 0.22 * t); }); });
    if (f % NF === 3 || f % NF === 4) { var best = A.eyes[0]; A.eyes.forEach(function (q) { var a = q % 32, b = (q / 32) | 0, c = best % 32, d = (best / 32) | 0;
      if (f % NF === 3 ? (a > c || (a === c && b < d)) : (a < c || (a === c && b < d))) best = q; }); img[best] = WH; } }
  /* ---------- 2. halo ---------- */
  function haloRing(img, A, f, P) { var on = A.on, bob = [0, 0, 1, 1, 1, 1, 0, 0][f % NF], cy = A.ht - 3 + bob, hx = A.hx, rw = Math.max(3, Math.min(6, Math.floor(A.hw / 2) - 1)), x, order = [];
    for (x = hx - rw + 1; x < hx + rw; x++) { put(img, on, x, cy - 1, P.lo); put(img, on, x, cy + 1, P.mid); }
    put(img, on, hx - rw, cy, P.mid); put(img, on, hx + rw, cy, P.mid);
    for (x = hx - rw + 1; x < hx + rw; x++) order.push([x, cy - 1]); order.push([hx + rw, cy]); for (x = hx + rw - 1; x > hx - rw; x--) order.push([x, cy + 1]); order.push([hx - rw, cy]);
    var g = order[Math.floor(f * order.length / NF) % order.length]; put(img, on, g[0], g[1], WH);
    [[0, -3], [-rw, -2], [rw, -2]].forEach(function (d, k) { if ((f + k * 3) % NF < 3) put(img, on, hx + d[0], cy + d[1], P.hi); }); }
  function haloNimbus(img, A, f, P) { var on = A.on, cx = A.hx, cy = A.ht + 5, r = Math.max(7, Math.min(11, Math.floor(A.hw / 2) + 3)), a, t, x, y;
    for (a = 0; a < 360; a += 4) { t = a * Math.PI / 180; x = Math.round(cx + r * Math.cos(t)); y = Math.round(cy - r * Math.sin(t)); if (y <= cy + 2) put(img, on, x, y, (Math.floor(a / 24) + f) % 4 ? P.mid : P.hi); }
    for (var k = 0; k < 12; k++) { t = (k * 30 + f * 15) * Math.PI / 180; [r + 2, r + 3].forEach(function (rr) { var xx = Math.round(cx + rr * Math.cos(t)), yy = Math.round(cy - rr * Math.sin(t)); if (yy <= cy && k % 2 === f % 2) put(img, on, xx, yy, rr === r + 3 ? P.lo : P.mid); }); } }
  function halo(img, A, f, P, style) { style = style || (A.ht >= 4 ? 'ring' : 'nimbus'); (style === 'ring' ? haloRing : haloNimbus)(img, A, f, P); }
  /* ---------- 3. wings ---------- */
  var WING = ['g.............', 'og............', 'owg...........', 'owwo..........', '.owwo.........', '.owwwo........', '.oswwwo.......', '..oswwwo......',
    '..owswwwo.....', '..oswswwwoo...', '...owswswwwo..', '...oswswswwwo.', '....owswswwwA.', '.....o.o.o.o..'], FLAP = [0, 0, 7, 15, 20, 15, 7, 0];
  /* the wings grow from the shoulders: the first row at or below the eyes where the body is at least 85% of its widest row.
     (Before this the root row came only from the eyes, so on a long-necked pet such as the Dodo the wings sprouted from the head and neck.) */
  function rowSpan(on, y) { var mn = 99, mx = -1; for (var x = 0; x < 32; x++) if (on[y * 32 + x]) { if (x < mn) mn = x; if (x > mx) mx = x; } return [mn, mx]; }
  function wings(img, A, f, P) { var on = A.on, bb = A.bb, y0 = Math.max(11, Math.min(bb[3] - 3, A.ey + 3, A.ht + 7)), sy = y0, wmax = 0, y, s;
    for (y = bb[1]; y <= bb[3]; y++) { s = rowSpan(on, y); if (s[1] >= 0) wmax = Math.max(wmax, s[1] - s[0] + 1); }
    for (y = y0; y <= Math.min(bb[3] - 3, 24); y++) { s = rowSpan(on, y); if (s[1] >= 0 && s[1] - s[0] + 1 >= wmax * 0.85) { sy = y; break; } }
    s = rowSpan(on, sy); var mn = s[0], mx = s[1]; if (mx < 0) { mn = bb[0]; mx = bb[2]; }
    var lx = mn + 3, rx = mx - 3, C = { o: P.fout, w: P.feather, s: P.fsh, g: P.mid, A: P.feather }, th = FLAP[f % NF] * Math.PI / 180, co = Math.cos(th), si = Math.sin(th);
    for (var ty = -16; ty < 4; ty++) for (var tx = -16; tx < 4; tx++) { var u = co * tx - si * ty, v = si * tx + co * ty, xx = Math.round(12 + u), yy = Math.round(12 + v);
      if (yy >= 0 && yy < WING.length && xx >= 0 && xx < WING[0].length && WING[yy][xx] !== '.') { var c = C[WING[yy][xx]]; put(img, on, lx + tx, sy + ty, c); put(img, on, rx - tx, sy + ty, c); } } }
  /* ---------- 4. clouds ---------- */
  var CM = {};
  function cloudMask(f) { if (CM[f]) return CM[f]; var yt = 28, pts = {}, c, x, y;
    for (c = -1; c < 6; c++) { var cx = c * 8 + (f % 8); [[0, 0, 3.2], [4, 1, 2.6], [-3, 1.5, 2.2]].forEach(function (b) { for (var yy = yt - 4; yy < 32; yy++) for (var xx = 0; xx < 32; xx++) { var d = Math.hypot(xx - (cx + b[0]), (yy - (yt + b[1])) * 1.25); if (d <= b[2]) { var k = yy * 32 + xx; pts[k] = Math.min(pts[k] == null ? 9 : pts[k], d / b[2]); } } }); }
    for (y = yt + 2; y < 32; y++) for (x = 0; x < 32; x++) { var k2 = y * 32 + x; pts[k2] = Math.min(pts[k2] == null ? 9 : pts[k2], 0.35); }
    return (CM[f] = pts); }
  function clouds(img, A, f, P, front) { var on = A.on, yt = 28, m = cloudMask(f % NF); Object.keys(m).forEach(function (k) { var d = m[k], i = +k, x = i % 32, y = (i / 32) | 0;
      var c = d < 0.45 && y < yt + 1 ? [250, 250, 255] : d < 0.75 ? [226, 230, 246] : [176, 184, 216]; if (y >= yt + 2) c = (x + y + f) % 5 ? [190, 196, 226] : [226, 230, 246];
      if (d > 0.85 && y < yt) c = mix(P.mid, [226, 230, 246], 0.5);
      if (front) { if (y >= 29) put(img, on, x, y, c, true); } else if (!on[i]) put(img, on, x, y, c); }); }
  /* ---------- 5. holy flame ---------- */
  var FLB = ['...t...', '...t...', '..tht..', '..hbh..', '.tbcbt.', '.bcwcb.', 'bcwwwcb', 'bcwwwcb', '.bcwcb.', '..beb..', '...e...'], SWAY = [0, 1, 1, 0, 0, -1, -1, 0];
  function flameSpots(A) { var on = A.on, best = []; [-1, 1].forEach(function (side) { var tx = A.hx + side * (Math.floor(A.hw / 2) + 4) - 3, ty = A.ht + 1, b = null;
      for (var y = 0; y < 22; y++) for (var x = -1; x < 27; x++) { if ((x + 3 - A.hx) * side < 0) continue; var fr = 0; for (var i = 0; i < 7; i++) for (var j = 0; j < 11; j++) if (free(on, x + i, y + j)) fr++;
        if (fr >= 60) { var s = Math.abs(x - tx) + Math.abs(y - ty) - fr * 0.15; if (!b || s < b[0] || (s === b[0] && (x < b[1] || (x === b[1] && y < b[2])))) b = [s, x, y]; } }
      if (b) best.push([b[1], b[2]]); }); return best; }
  function holyFlame(img, A, f, P, spots) { var on = A.on, C = { t: P.hi, h: P.mid, b: [104, 150, 255], c: [186, 220, 255], w: WH, e: [64, 88, 200] };
    spots.forEach(function (s, k) { var x = s[0], y = s[1], F = (f + k * 3) % NF, sw = SWAY[F], dy = [0, 0, -1, -1, 0, 0, 1, 1][(f + k * 2) % NF];
      FLB.forEach(function (r, yy) { var off = yy < 3 ? sw : (yy < 5 && F % 2 ? sw : 0); for (var xx = 0; xx < r.length; xx++) { var ch = r[xx]; if (ch === '.') continue; if (ch === 't' && (F + yy) % 3 === 0) continue; put(img, on, x + xx + off, y + yy + dy, C[ch]); } });
      for (var j = 0; j < 2; j++) { var sp = (f + j * 4 + k * 2) % NF; put(img, on, x + 3 + (j * 2 - 1) * (1 + sp % 2), y - 1 - sp + dy, sp < 5 ? P.mid : P.lo); } }); }
  /* ---------- 6. lightning ---------- */
  function boltPath(A, side, seed) { var on = A.on, r = rng(seed), x = Math.max(1, Math.min(30, A.hx + side * (Math.floor(A.hw / 2) + r.i(-1, 2)))), pts = [], y = 0;
    while (y < 29) { var tries = 0; while (onAt(on, x, y) && tries < 4) { x += side; tries++; } if (!(x >= 0 && x < 32) || onAt(on, x, y)) break;
      pts.push([x, y]); y++; var seg = Math.floor(y / 3) % 2; if (r.f() < 0.85) x += seg ? side : -side; x = Math.max(0, Math.min(31, x)); } return pts; }
  function lightning(img, A, f, P, seed) { var on = A.on, F = f % NF;
    [[-1, 2], [1, 6]].forEach(function (sh) { var side = sh[0], hit = sh[1]; if (F !== hit && F !== hit + 1) return; var pts = boltPath(A, side, seed * 7 + side + 100), bright = F === hit;
      pts.forEach(function (p, k) { put(img, on, p[0], p[1], bright ? WH : P.mid); if (bright) { put(img, on, p[0] - side, p[1], P.hi); put(img, on, p[0] + side, p[1], P.lo); } else if (k % 2) put(img, on, p[0] - side, p[1], P.lo); });
      if (bright && pts.length) { var b = pts[Math.floor(pts.length / 2)]; for (var j = 1; j < 4; j++) put(img, on, b[0] + side * j, b[1] + j, P.hi); } });
    for (var k = 0; k < 3; k++) { var r = rng(seed * 31 + k + Math.floor(F / 2) * 5), x = r.i(1, 30), y = r.i(1, 14); if (free(on, x, y) && F % 2 === 0) put(img, on, x, y, P.mid); } }
  /* ---------- Mythic layers: violet starlight trace + Twin Moons ---------- */
  var SL = [196, 178, 255], SL2 = [150, 126, 236];
  function starlight(img, on, f) { rim(on).forEach(function (p, k) { img[p[1] * 32 + p[0]] = (k + f * 2) % 9 === 0 ? WH : (Math.floor(k / 3) % 2 === 0 ? SL : SL2); }); }
  var MOONS = [['.aa', 'ab.', 'a..', 'ab.', '.aa'], ['aa.', '.ba', '..a', '.ba', 'aa.']], MC = [{ a: [246, 240, 212], b: [176, 168, 140] }, { a: [196, 146, 255], b: [120, 82, 210] }];
  function moons(img, A, f) { var on = A.on, bb = A.bb, cx = (bb[0] + bb[2]) / 2, cy = bb[1] + 2, rx = Math.min(15, (bb[2] - bb[0]) / 2 + 2);
    MOONS.forEach(function (spr, k) { var t = 2 * Math.PI * (f % NF) / NF + k * Math.PI * 0.55 + Math.PI, mx = Math.round(cx + rx * Math.cos(t)) - 1, my = Math.round(cy + 3 * Math.sin(t)) - 2;
      spr.forEach(function (row, yy) { for (var xx = 0; xx < row.length; xx++) if (row[xx] !== '.') put(img, on, mx + xx, my + yy, MC[k][row[xx]]); }); }); }
  /* ---------- 0. the shining body ---------- */
  var GLOW = [0.55, 0.7, 0.85, 1.0, 1.0, 0.85, 0.7, 0.55];
  function dilate(on, n) { var rings = [], seen = {}, cur = [], i; for (i = 0; i < 1024; i++) if (on[i]) { seen[i] = 1; cur.push(i); }
    for (var s = 0; s < n; s++) { var nx = [], got = {}; cur.forEach(function (q) { var x = q % 32, y = (q / 32) | 0; [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].forEach(function (d) { var xx = x + d[0], yy = y + d[1], k = yy * 32 + xx; if (xx >= 0 && xx < 32 && yy >= 0 && yy < 32 && !seen[k] && !got[k]) { got[k] = 1; nx.push(k); } }); });
      nx.forEach(function (k) { seen[k] = 1; }); rings.push(nx); cur = nx; } return rings; }
  /* a crisp gold rim: solid palette pixels only, never blended into the background, so the outline stays one clean pixel line
     on any backdrop (the old soft rings mixed gold into the floor and backdrop tiles and read as a muddy grey-gold smear). */
  function shineAura(img, A, f, P, my) { var g = GLOW[f % NF], bb = A.bb, cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2, rings = A.rings || (A.rings = dilate(A.on, 2)), spokes = my ? 12 : 8;
    rings.forEach(function (ring, k) { ring.forEach(function (i) { var x = i % 32, y = (i / 32) | 0; if (badge(x, y)) return;
      var ang = Math.atan2(y - cy, x - cx) / (2 * Math.PI) * spokes + f * 0.25; ang = ang - Math.floor(ang);
      if (k === 0) { img[i] = ang < 0.12 && g > 0.8 ? P.hi : P.mid; return; }
      if (ang < 0.06 && g > 0.65) img[i] = P.lo; }); }); }
  function shineBody(img, A, f, P, my) { var on = A.on, g = GLOW[f % NF], prot = {}; A.eyes.forEach(function (q) { prot[q] = 1; [-1, 1, -32, 32, -33, -31, 31, 33].forEach(function (d) { prot[q + d] = 1; }); });
    var bb = A.bb, span = (bb[2] - bb[0]) + (bb[3] - bb[1]) + 8, s = bb[0] + bb[1] - 4 + (f % NF) * span / (NF - 1), base = (my ? 0.46 : 0.34) * (0.8 + 0.2 * g), band = my ? 0.7 : 0.55;
    for (var i = 0; i < 1024; i++) { if (!on[i] || prot[i]) continue; var x = i % 32, y = (i / 32) | 0; if (badge(x, y)) continue; var c = img[i], lum = (0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]) / 255; if (lum < 0.16) continue;
      var w = Math.pow(lum, 0.8); c = mix(c, P.hi, base * w); var d = Math.abs((x + y) - s); if (d < 3.5) c = mix(c, WH, band * w * (1 - d / 3.5)); img[i] = c; }
    if (my) { var r = rng(Math.floor(f / 2) * 977 + bb[0] * 31 + bb[1]), cand = []; for (i = 0; i < 1024; i++) if (on[i] && !prot[i] && !badge(i % 32, (i / 32) | 0) && img[i][0] + img[i][1] + img[i][2] > 330) cand.push(i);
      for (var k = 0; k < 3 && cand.length; k++) { var j = r.i(0, cand.length - 1), q = cand.splice(j, 1)[0]; img[q] = f % 2 === 0 ? WH : P.hi; } } }
  /* ---------- compose one 8-frame God loop from the pet's own frames + keyed silhouettes ---------- */
  function toImg(d) { var o = new Array(1024); for (var i = 0; i < 1024; i++) o[i] = [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]]; return o; }
  function toData(img, src) { var d = new Uint8ClampedArray(4096); for (var i = 0; i < 1024; i++) { d[i * 4] = img[i][0]; d[i * 4 + 1] = img[i][1]; d[i * 4 + 2] = img[i][2]; d[i * 4 + 3] = src ? (src[i * 4 + 3] || 255) : 255; } return d; }
  function silOf(a, b) { var on = new Array(1024); for (var i = 0; i < 1024; i++) { var j = i * 4; on[i] = a[j] === b[j] && a[j + 1] === b[j + 1] && a[j + 2] === b[j + 2] && a[j + 3] > 0; } return on; }
  function eyesOf(p, fi) { try { var v = V(); if (v._dynastAnchor && p.art) { var r = v._dynastAnchor(p.art, { stage: p.stage, frame: fi }); if (r && r.eyes) return r.eyes.map(function (e) { return e.px || []; }); } } catch (e) {} return []; }
  function godFrames(fr, KA, KB, p, look) { var P = PAL[look.pal] || PAL.gold, fx = look.fx, my = !!look.mythic, out = [], spots = null, seed = look.seed || ((p.id | 0) % 997) + 1;
    for (var f = 0; f < NF; f++) { var src = fr[f % fr.length], a = KA[f % KA.length], b = KB[f % KB.length]; if (!src || !src.data || src.data.length !== 4096 || !a || !b) return null;
      var on = silOf(a.data, b.data), n = 0; for (var i = 0; i < 1024; i++) if (on[i]) n++; if (n < 8 || n > 900) return null;
      var E = eyesOf(p, f % fr.length); if (!E.length && f % fr.length) E = eyesOf(p, 0); var A = anat(on, E), img = toImg(src.data);
      if (fx.indexOf('L') >= 0 && (f === 2 || f === 6)) for (i = 0; i < 1024; i++) if (!on[i]) img[i] = mix(img[i], [120, 130, 170], 0.12); /* the sky flashes with the strike */
      shineAura(img, A, f, P, my); shineBody(img, A, f, P, my);
      if (fx.indexOf('C') >= 0) clouds(img, A, f, P);
      if (fx.indexOf('L') >= 0) lightning(img, A, f, P, seed);
      if (fx.indexOf('W') >= 0) wings(img, A, f, P);
      if (fx.indexOf('H') >= 0) halo(img, A, f, P, look.halo);
      if (my) moons(img, A, f);
      if (fx.indexOf('F') >= 0) { if (!spots) spots = flameSpots(A); holyFlame(img, A, f, P, spots); }
      if (my) starlight(img, on, f);
      if (fx.indexOf('E') >= 0) eyesFx(img, A, f, P);
      if (fx.indexOf('C') >= 0) clouds(img, A, f, P, true);
      var g = { width: 32, height: 32, data: toData(img, src.data) }; if (src.pid != null) g.pid = src.pid; g.godLook = true; out.push(g); }
    return out; }
  /* Mythic zombie: a dead, broken grey-blue trace. Mythic-fed uses curedFrames (its own aura), not this trace and not the old cyan wash. */
  function zFrames(fr, KA, KB, kind, p) {
    if (kind === 'fed') return curedFrames(fr, KA, KB, p);
    var out = [], n = Math.max(NF, fr.length);
    for (var f = 0; f < n; f++) { var src = fr[f % fr.length], a = KA[f % KA.length], b = KB[f % KB.length]; if (!src || !src.data || src.data.length !== 4096 || !a || !b) return null;
      var on = silOf(a.data, b.data), img = toImg(src.data), R2 = rim(on);
      R2.forEach(function (q, k) { var j = q[1] * 32 + q[0], seg = Math.floor(k / 4) + (p.id | 0); if (seg % 3 === 2) return; /* broken: every third stretch is gone */
        img[j] = (k % 4 === 0) ? [70, 80, 100] : [112, 128, 152]; if ((seg * 7 + f) % 23 === 0 && k % 4 === 1) img[j] = [170, 190, 220]; /* a rare dying spark */ });
      var g = { width: 32, height: 32, data: toData(img, src.data) }; if (src.pid != null) g.pid = src.pid; out.push(g); }
    return out; }
  /* Cured (Mythic-fed) aura. Display only. Solid palette pixels, never blended into the card (the old cyan mix
   * read as a muddy fringe, and the hot-pixel wash painted bars across the face). A clean pale-gold outline,
   * a soft teal halo one pixel further out, and a gentle step of which halo pixels are the bright ones.
   * That step rides the pet's existing idle frames: no extra timer, no CSS filter, so a large wallet stays cheap.
   * prefers-reduced-motion: the same calm halo on every frame, no walking spark. Bitcoin red on the body is not touched.
   * Distinct from a normal zombie (no halo), a Mythic (electric cyan line), a Mythic zombie (broken grey-blue trace)
   * and a Mythic God (body shine, violet starlight, moons). */
  var CURED = {
    line: [255, 236, 176], spark: [255, 252, 232],
    halo: [112, 214, 198], haloSoft: [64, 150, 142],
    pupil: [255, 244, 196], drip: [176, 236, 214]
  };
  var CURED_FROM = [[214, 255, 168], [150, 214, 96], [150, 210, 92], [214, 255, 150]]; /* zombie pupil + drool, not the rot skin */
  function reducedMotion() { try { var mm = window.matchMedia; return !!(mm && mm.call(window, '(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } }
  function isRedPx(c) { return c[0] >= 140 && c[0] > c[1] + 40 && c[0] > c[2] + 40; } /* Bitcoin red stays red; never shifted toward orange */
  function nearAcc(c, t) { return Math.abs(c[0] - t[0]) <= 4 && Math.abs(c[1] - t[1]) <= 4 && Math.abs(c[2] - t[2]) <= 4; }
  function blessAccent(c) { if (!c || isRedPx(c)) return null; for (var i = 0; i < CURED_FROM.length; i++) if (nearAcc(c, CURED_FROM[i])) return i < 2 ? CURED.pupil : CURED.drip; return null; }
  function curedFrames(fr, KA, KB) { var out = [], n = Math.max(NF, fr.length), still = reducedMotion();
    for (var f = 0; f < n; f++) { var src = fr[f % fr.length], a = KA[f % KA.length], b = KB[f % KB.length]; if (!src || !src.data || src.data.length !== 4096 || !a || !b) return null;
      var on = silOf(a.data, b.data), img = toImg(src.data), ring = [], halo = [], inR = new Uint8Array(1024), i, x, y;
      for (i = 0; i < 1024; i++) { if (!on[i] || badge(i % 32, (i / 32) | 0)) continue; var acc = blessAccent(img[i]); if (acc) img[i] = acc; }
      var cand = [];
      for (y = 0; y < 32; y++) for (x = 0; x < 32; x++) { if (on[y * 32 + x] || badge(x, y)) continue;
        if (onAt(on, x + 1, y) || onAt(on, x - 1, y) || onAt(on, x, y + 1) || onAt(on, x, y - 1)) cand.push(y * 32 + x); }
      /* a pixel with pet on both sides is a bridge across a gap (between the eyes, a split brow), not the outline.
         Same rule as the Mythic electric line (mythRimOuter). If that would erase the whole ring, keep it. */
      for (i = 0; i < cand.length; i++) { var bi = cand[i], bx = bi % 32, by = (bi / 32) | 0, L = false, Rgt = false, dd;
        for (dd = 1; dd < 32 && !(L && Rgt); dd++) { if (bx - dd >= 0 && on[by * 32 + bx - dd]) L = true; if (bx + dd < 32 && on[by * 32 + bx + dd]) Rgt = true; }
        if (!(L && Rgt)) ring.push(bi); }
      if (!ring.length) ring = cand;
      for (i = 0; i < ring.length; i++) inR[ring[i]] = 1;
      for (y = 0; y < 32; y++) for (x = 0; x < 32; x++) { var hi = y * 32 + x; if (on[hi] || inR[hi] || badge(x, y)) continue;
        if ((x < 31 && inR[hi + 1]) || (x > 0 && inR[hi - 1]) || (y < 31 && inR[hi + 32]) || (y > 0 && inR[hi - 32])) halo.push(hi); }
      var sp = (!still && ring.length) ? (Math.floor(f * ring.length / NF) % ring.length) : -1, shift = still ? 0 : (f % NF);
      for (i = 0; i < ring.length; i++) img[ring[i]] = i === sp ? CURED.spark : CURED.line;
      for (i = 0; i < halo.length; i++) img[halo[i]] = ((i + shift) & 1) ? CURED.haloSoft : CURED.halo;
      var g = { width: 32, height: 32, data: toData(img, src.data) }; if (src.pid != null) g.pid = src.pid; out.push(g); }
    return out; }
  /* isMythicFed first (a pure read). mgView().fed only if that helper is missing. No new pet state. */
  function fedOf(p, w) { var v = V();
    try { if (typeof v.isMythicFed === 'function') return !!v.isMythicFed(p); } catch (e) {}
    try { if (w && typeof v.mgView === 'function') { var mv = v.mgView(w, p); return !!(mv && mv.fed); } } catch (e) {}
    return false; }
  /* ---------- which look a pet gets ---------- */
  function isZ(p) { return !!(p && p.zombie && !p.zombie.end); }
  function godBorn(w, p) { var v = V(); try { return !!(v.godBornOf && v.godBornOf(w, p)); } catch (e) { return false; } }
  function lookOf(p, w) { if (!p) return null;
    if (isZ(p)) { if (fedOf(p, w)) return { z: 'fed' }; if (p.mgDead) return { z: 'mythic' }; return null; }
    if (p.mythicGod) return seatLook(p.mythicGod.seat || 1);
    if (!gateOn(w)) return null;
    if (p.resurrected || godBorn(w, p)) return godMix(p.id);
    return null; }
  var DONE = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function keyed(pf, p, w, extra, col, keepZ) { var a = Object.assign({}, p.art || {}, { background: 'solid', bgColor: col, pattern: 'none' });
    return pf(Object.assign({}, p, keepZ ? { art: a } : { zombie: null, art: a, mutation: null, shows: null }), w, extra); }
  if (R && typeof R.petFrames === 'function') { var pf0 = R.petFrames;
    R.petFrames = function (p, w, extra) { var fr = pf0.apply(this, arguments), lk; try { lk = lookOf(p, w); } catch (e) { lk = null; } if (!lk || !DONE || !fr || !fr.length || !fr[0] || !fr[0].data) return fr;
      var key = JSON.stringify(lk), hit = DONE.get(fr); if (hit && hit.__k === key) return hit; var out = null;
      try { var zz = !!lk.z, KA = keyed(pf0, p, w, extra, '#ff00fe', zz), KB = keyed(pf0, p, w, extra, '#00ff01', zz);
        out = zz ? zFrames(fr, KA, KB, lk.z, p) : godFrames(fr, KA, KB, p, lk); } catch (e) { if (window.console) console.warn('mythic god look failed #' + (p && p.id), e); out = null; }
      if (!out) out = fr; try { out.__k = key; } catch (e) {} DONE.set(fr, out); return out; }; }
  /* ---------- chips and lines (labels only) ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function view(w, p) { var v = V(); try { return v.mgView ? v.mgView(w, p) : null; } catch (e) { return null; } }
  function seatTitle(n) { return (SEATS[n - 1] || [''])[0]; }
  function chips(p, w) { if (!p) return ''; var h = '';
    if (p.mythicGod) h += '<span class="chip mg-god" title="' + esc(seatTitle(p.mythicGod.seat)) + ' · never dies, never starves · Moon Ward: the first battle it loses each chain day costs it nothing">🌕 Mythic God · Seat ' + ROMAN[(p.mythicGod.seat || 1) - 1] + ' of 21</span>';
    else if (isZ(p) && p.zombie.mfed) h += '<span class="chip mg-fed" title="It ate Mythic #' + esc(p.zombie.mfed.mythic) + ': cured for good, it never goes feral, never crumbles and can\'t be hunted">🌙 Mythic-fed</span>';
    else if (isZ(p) && p.mgDead) h += '<span class="chip mg-mz" title="A Mythic raised from its violet grave. Resurrection can make it a Mythic God (needs 66+ points)">💜 Mythic zombie</span>';
    else if (p.mgDead && !p.mgDead.over) h += '<span class="chip mg-grave" title="Eaten by zombie #' + esc(p.mgDead.by) + ' at block ' + esc(p.mgDead.block) + '">💜 Mythic grave</span>';
    return h; }
  function span(b) { return window.V2Zombies && V2Zombies.span ? V2Zombies.span(b) : b + ' blocks'; }
  /* the Mythic-fed zombie never hungers: its hunger chip and bar read "cured" */
  var Zs = window.V2Zombies;
  if (Zs) { var hc0 = Zs.hungerChip, hb0 = Zs.hungerBar;
    Zs.hungerChip = function (p, w) { if (isZ(p) && p.zombie.mfed) return '<span class="chip mg-fed" title="Cured for good by its Mythic meal">🌙 Never hungers</span>'; return hc0.apply(this, arguments); };
    Zs.hungerBar = function (p, w) { if (isZ(p) && p.zombie.mfed) return '<div class="small mg-line">🌙 Mythic-fed at block ' + esc(p.zombie.mfed.block) + ': it ate Mythic #' + esc(p.zombie.mfed.mythic) + ' and took 30% of its stats. It never goes feral, never crumbles and can\'t be hunted.</div>'; return hb0.apply(this, arguments); }; }
  try { var css = document.createElement('style'); css.id = 'mgCss';
    css.textContent = '.chip.mg-god{background:#1d1530;color:#e4d8ff;border-color:#8a6cff;box-shadow:0 0 6px rgba(160,130,255,.45)}.chip.mg-fed{background:#0f2229;color:#a8f2ff;border-color:#3cc4e0}' +
      '.chip.mg-mz{background:#1c1826;color:#b9b0d6;border-color:#5b5378}.chip.mg-grave{background:#1a1224;color:#c9a8ff;border-color:#6a4aa0}.mg-line{color:#9fe6f5;margin-top:3px}.cv2-diff.mg-grave{background:#1a1224;color:#c9a8ff;border:1px solid #6a4aa0}.tomb.tomb-mythic{border-color:#8a4fe0 !important;box-shadow:0 0 10px rgba(180,108,255,.35)}' +
      '.mg-unl{margin-top:6px;padding:6px;border:1px solid #7a1c1c;border-radius:6px;background:#1e0d0d}.mg-unl .btn.mg-red{background:#b3261e;border-color:#7a1c1c;color:#fff}.mg-unl .small{color:#f2b8b5}' +
      '.mg-pend{color:#ffb4a8}.mg-dlg-list{max-height:200px;overflow:auto;border:1px solid #7a1c1c;border-radius:6px;padding:4px;margin:6px 0;display:flex;flex-wrap:wrap;gap:6px}.mg-dlg-list .mg-ed{display:flex;flex-direction:column;align-items:center;font-size:11px;width:64px}' +
      '.mg-dlg-warn{color:#ffb4a8;font-weight:600}.mg-name{width:100%;margin-top:6px}';
    (document.head || document.documentElement).appendChild(css); } catch (e) {}
  window.V2MythicGod = { on: gateOn, force: FORCE, godMix: godMix, seatLook: seatLook, SEATS: SEATS, ROMAN: ROMAN, NAMES: NAMES, PAL: PAL, chips: chips, view: view, seatTitle: seatTitle, span: span, esc: esc,
    godFrames: godFrames, zFrames: zFrames, curedFrames: curedFrames, lookOf: lookOf, fedOf: fedOf, CURED: CURED, NF: NF };
})();
