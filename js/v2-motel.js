/* XCPETS No-Tail Motel (UI-only mockup, owner 7:12-7:38 PM CT; branch no-tail-motel, NOT LIVE). Replaces the Breeding section's look; breeding
 * rules and burns are UNCHANGED: "Check in" = the existing pet:breed:A:B burn (690); a partner on another wallet "checks in" with the existing
 * mirrored accept (pet:breed:B:A, 690, within 144 blocks). The door shows both room numbers (= pet IDs), opens on the scene when both pets have
 * checked in (the child exists), and the egg appears at the door. Gooby (the "Gooby pls" dog) runs the desk with PG-13 one-liners.
 * Odds peek on the door: computed from the engine's own constants (v2-rules.js: RARITY_UP_10K 500 / RARITY_HIGH_10K 3000, HYBRID_RATE_1E9
 * 684773435, HYBRID_RARITY_UP_10K 1000, hybrid-parent breeds always hybrid). In place, no pop-ups; reduced motion = static. */
(function () {
  'use strict';
  var W = 320, H = 196, RM = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var LINES = ['Gooby pls. One room, two guests.', 'No questions. No tails.', 'Ice machine\u2019s broke. Romance ain\u2019t.', 'Checkout? When the egg says so.',
    'We don\u2019t ask, you don\u2019t tell.', 'Do Not Disturb signs: free.', 'Rooms by the hour. Eggs by the block.', 'Two keys, one door, zero shame.', 'Gooby sees nothing. Gooby pls.',
    'Mints on the pillow. Wink.', 'Cable\u2019s out. Make your own fun.', 'Vacancy! Bring a friend.'];
  var S = { c: null, x: null, raf: 0, line: 0, lt: 0, A: null, B: null, state: 'empty', kid: null, open: 0, t0: 0, bubble: null, walk: {}, rooms: [], w: null };
  function reduced() { return !!RM.matches || !!window.__motelReduced; }
  function px(x, c, a, b, w, h) { x.fillStyle = c; x.fillRect(a, b, w, h); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  /** odds(V, A, B, blk) -> { hyb, sp: [[label, pct]], tier: { up, hi, lo } } from the engine's numbers */
  function odds(V, A, B) { var hy = V.isHybrid, hi = Math.max(A.tier, B.tier), lo = Math.min(A.tier, B.tier), lab = function (s) { return V.speciesLabel(s); };
    var roots = function (s) { return hy(s) ? s.replace(/^hyb3?:/, '').split(':') : [s]; }, ph, sp;
    if (hy(A.species) || hy(B.species)) { var U = roots(A.species); roots(B.species).forEach(function (r) { if (U.indexOf(r) < 0) U.push(r); }); ph = 1; /* hybrid3Species: always a hybrid */
      sp = U.length === 2 ? [[V.hybridName(hy(A.species) ? A.species : B.species), 100]] : [['3-way hybrid', 50], ['2-way hybrid', 50]]; }
    else if (A.species === B.species) { ph = 0; sp = [[lab(A.species), 100]]; }
    else { ph = V.HYBRID_RATE_1E9 / 1e9; var pu = (1 - ph) / 2; sp = [[V.hybridName('hyb:' + A.species + ':' + B.species), ph * 100], [lab(A.species), pu * 100], [lab(B.species), pu * 100]]; }
    /* tiers: purebred child 5% hi+1 / 30% hi / 65% lo (RARITY_*_10K); hybrid child 10% hi+1 / 90% hi (HYBRID_RARITY_UP_10K) */
    var up = ph * 0.10 + (1 - ph) * 0.05, h = ph * 0.90 + (1 - ph) * 0.30, l = (1 - ph) * 0.65; if (hi === 3) { h += up; up = 0; } if (hi === lo) { h += l; l = 0; }
    return { hyb: ph * 100, sp: sp, tier: { up: up * 100, hi: h * 100, lo: l * 100 }, hiT: hi, loT: lo }; }
  function dog(x, ox, oy, t) { var wag = reduced() ? 0 : Math.floor(t / 250) % 2, blink = !reduced() && Math.floor(t / 2600) % 7 === 0; /* Gooby (xcp.fun/GOOBY): green hat, black head, white muzzle, droopy ear, red turtleneck */
    px(x, '#111', ox + 8, oy - 1, 3, 1); px(x, '#111', ox + 12, oy - 1, 3, 1); px(x, '#6ef04a', ox + 8, oy, 3, 1); px(x, '#6ef04a', ox + 12, oy, 3, 1); px(x, '#6ef04a', ox + 8, oy + 1, 7, 1); /* hat crown, notched top */
    px(x, '#111', ox + 8, oy + 2, 7, 1); px(x, '#6ef04a', ox + 7, oy + 3, 8, 1); px(x, '#111', ox + 7, oy + 4, 8, 1); /* black band, brim */
    px(x, '#111', ox + 6, oy + 5, 10, 4); px(x, '#111', ox + 15, oy + 5, 4, 2); px(x, '#111', ox + 17, oy + 7 + wag, 2, 3); /* head + droopy ear (bobs) */
    px(x, '#f5f5f0', ox + 5, oy + 6, 3, 3); px(x, '#f5f5f0', ox + 9, oy + 6, 3, 3); if (!blink) { px(x, '#111', ox + 6, oy + 7, 1, 1); px(x, '#111', ox + 10, oy + 7, 1, 1); } /* small dot eyes on white */
    px(x, '#111', ox + 12, oy + 9, 4, 5); px(x, '#f5f5f0', ox + 1, oy + 9, 11, 3); px(x, '#f5f5f0', ox + 3, oy + 12, 7, 1); px(x, '#111', ox + 1, oy + 12, 2, 1); /* neck, long white muzzle */
    px(x, '#111', ox, oy + 11, 2, 4); px(x, '#f5f5f0', ox + 5, oy + 13, 2, 1); px(x, '#111', ox + 4, oy + 13, 1, 1); px(x, '#111', ox + 7, oy + 13, 1, 1); /* big black nose, buck tooth */
    px(x, '#e8352a', ox + 9, oy + 14, 10, 4); px(x, '#e8352a', ox + 8, oy + 13, 4, 1); px(x, '#b0221a', ox + 12, oy + 14, 2, 4); px(x, '#111', ox + 16, oy + 16, 1, 2); } /* red turtleneck */
  function bubble(x, s, bx, by) { x.font = '5px "Press Start 2P", monospace'; var w = Math.ceil(x.measureText(s).width) + 8; bx = Math.max(2, Math.min(W - w - 2, bx));
    px(x, '#000', bx + 1, by + 1, w, 11); px(x, '#fff8e1', bx, by, w, 11); px(x, '#fff8e1', bx + 6, by + 11, 3, 3); x.fillStyle = '#1b1b1b'; x.fillText(s, bx + 4, by + 8); }
  function neon(x, s, cx, y, col, on, size) { x.font = (size || 9) + 'px "Press Start 2P", monospace'; x.textAlign = 'center'; if (on) { x.fillStyle = col; x.globalAlpha = .35; x.fillText(s, cx + 1, y + 1); x.fillText(s, cx - 1, y - 1); x.globalAlpha = 1; x.fillStyle = col; } else x.fillStyle = '#3a2a3a'; x.fillText(s, cx, y); x.textAlign = 'left'; }
  /* REDESIGN (owner 8:23 PM CT): no road/car; landscaping; guests WALK in. Real pet sprites from V2Render.petFrames (32x32), drawn 16x16. */
  var PETL = ['gm. Room for two?', 'One key pls.', 'Cash. No receipt.', 'Just a nap. Swear.'];
  var SPR = {};
  function spr(p, sil) { var k = p.id + (sil ? 's' : ''); if (SPR[k]) return SPR[k]; var out = [];
    try { var fr = window.V2Render.petFrames(p, S.w); fr.forEach(function (f) { var c = document.createElement('canvas'); c.width = c.height = 32; window.V2Render.paint(c, f); var g0 = c.getContext('2d'), id = g0.getImageData(0, 0, 32, 32), d = id.data, r0 = d[0], g1 = d[1], b0 = d[2]; /* key out the sprite's backdrop (corner colour) */
      for (var q = 0; q < d.length; q += 4) if (Math.abs(d[q] - r0) + Math.abs(d[q + 1] - g1) + Math.abs(d[q + 2] - b0) < 12) d[q + 3] = 0; g0.putImageData(id, 0, 0);
      if (sil) { var g = c.getContext('2d'); g.globalCompositeOperation = 'source-in'; g.fillStyle = sil; g.fillRect(0, 0, 32, 32); } out.push(c); }); } catch (e) { out = []; }
    if (Object.keys(SPR).length > 80) SPR = {}; return (SPR[k] = out); }
  function putPet(x, p, cx, by, sz, t, sil, alpha) { var f = spr(p, sil); if (!f.length) return; var c = f[Math.floor(t / 300) % f.length]; x.save(); if (alpha != null) x.globalAlpha = alpha; x.drawImage(c, Math.round(cx - sz / 2), Math.round(by - sz), sz, sz); x.restore(); }
  function door(x, dx, col) { px(x, '#1a1010', dx - 1, 79, 24, 41); px(x, col, dx, 80, 22, 40); px(x, '#00000033', dx + 3, 84, 16, 14); px(x, '#00000033', dx + 3, 102, 16, 15); px(x, '#ffd166', dx + 17, 100, 2, 2); } /* ONE door size for office + rooms = the red room door (22x40, owner 8:39 PM CT) */
  function lerp(a, b, k) { return a + (b - a) * Math.max(0, Math.min(1, k)); }
  var OD = 151, WY = 140, SLA = 200, SLB = 238; /* office door x, walkway feet y, room slots */
  /* pose(who, t) -> { x, y, a (alpha), key, talk, gooby } from the guest's own timeline */
  function pose(who, t) { var m = S.walk[who]; if (!m) return null; var slot = who === 'A' ? SLA : SLB, e = reduced() ? 1e9 : t - m.t0;
    if (e < 0) return { hide: 1 };
    var walk = function (k) { return Math.floor(e / 160) % 2; };
    if (e < 1800) return { x: OD, y: lerp(H + 16, WY, e / 1800), bob: walk() };
    if (who === 'A') { if (e < 3400) return { x: OD, y: WY, talk: PETL[m.id % PETL.length] };
      if (e < 5200) return { x: OD, y: WY, gooby: LINES[(m.id + 3) % LINES.length] };
      if (e < 6200) return { x: OD, y: WY, keyFly: (e - 5200) / 1000 };
      if (e < 8000) return { x: lerp(OD, slot, (e - 6200) / 1800), y: WY, bob: walk(), key: 1 };
      return { x: slot, y: WY, key: 1 }; }
    if (e < 2400) return { x: OD, y: WY, a: 1 - (e - 1800) / 600 }; /* through the office door */
    if (e < 3600) return { x: OD, y: WY, a: 0, gooby: 'Room ' + (S.A ? '#' + S.A.id : '?') + '. Knock twice.' };
    if (e < 4000) return { x: OD, y: WY, a: (e - 3600) / 400, key: 1 };
    if (e < 6000) return { x: lerp(OD, slot, (e - 4000) / 2000), y: WY, bob: walk(), key: 1 };
    return { x: slot, y: WY, key: 1 }; }
  function keyPx(x, kx, ky) { px(x, '#000', kx - 1, ky - 1, 8, 5); px(x, '#ffd166', kx, ky, 3, 3); px(x, '#140f24', kx + 1, ky + 1, 1, 1); px(x, '#ffd166', kx + 3, ky + 1, 3, 1); px(x, '#ffd166', kx + 5, ky + 2, 1, 1); }
  function palm(x, bx, by, t) { for (var i = 0; i < 26; i++) px(x, i % 4 < 2 ? '#8a5a2b' : '#6e4520', bx + Math.round(Math.sin(i / 9) * 3), by - i, 3, 1);
    var sw = reduced() ? 0 : Math.round(Math.sin(t / 700)); var tx = bx + 2 + Math.round(Math.sin(26 / 9) * 3), ty = by - 26;
    [[-12, 3], [-8, -3], [0, -6], [8, -3], [12, 3]].forEach(function (d, j) { for (var s = 0; s < 6; s++) px(x, j % 2 ? '#2f9e44' : '#3ddc84', tx + Math.round(d[0] * s / 6) + (s > 3 ? sw : 0), ty + Math.round(d[1] * s / 6) + (s > 3 ? Math.abs(d[0]) / 6 : 0), 3, 2); });
    px(x, '#6e4520', tx - 1, ty + 1, 2, 2); px(x, '#6e4520', tx + 2, ty + 2, 2, 2); }
  function bush(x, bx, by, w) { px(x, '#1f6e3a', bx, by - 5, w, 5); px(x, '#2f9e44', bx + 1, by - 7, w - 2, 3); px(x, '#3ddc84', bx + 2, by - 6, 2, 1); px(x, '#3ddc84', bx + w - 4, by - 4, 2, 1); }
  function flowers(x, bx, by, w) { px(x, '#4a2d1e', bx, by - 3, w, 3); for (var i = 1; i < w - 1; i += 3) { px(x, '#2f9e44', bx + i, by - 5, 1, 2); px(x, ['#ff4fd8', '#ffd166', '#ff6b6b', '#c9c9ff'][(i / 3 | 0) % 4], bx + i - 1 + (i % 2), by - 7, 2, 2); } }
  function others(w) { /* real recent breeding pairs: live pending check-ins first, then the guestbook */ var seen = {}, out = [], skip = [S.A && S.A.id, S.B && S.B.id];
    var add = function (a, b) { var A = w.byId[a], B = w.byId[b]; if (!A || !B || skip.indexOf(A.id) >= 0 || skip.indexOf(B.id) >= 0) return; var k = [A.id, B.id].sort().join(':'); if (seen[k]) return; seen[k] = 1; out.push([A, B]); };
    (w.breedReqs || []).slice().sort(function (p, q) { return q.block - p.block; }).forEach(function (r) { if (!r.used) add(r.a, r.b); });
    w.pets.filter(function (p) { return p.parents && p.parents.length === 2; }).sort(function (p, q) { return (q.hatchBlock || 0) - (p.hatchBlock || 0) || q.id - p.id; }).slice(0, 12).forEach(function (c) { add(c.parents[0], c.parents[1]); });
    return out; }
  function draw(t) { var x = S.x; if (!x) return; x.imageSmoothingEnabled = false; var rm = reduced();
    px(x, '#0b0a1f', 0, 0, W, H); for (var i = 0; i < 40; i++) px(x, (i * 7 + Math.floor(t / 600)) % 11 ? '#c9c9ff' : '#555', (i * 53) % W, (i * 29) % 60, 1, 1); px(x, '#f5efc0', 286, 10, 10, 10); px(x, '#0b0a1f', 290, 9, 8, 9); /* stars + moon */
    /* ground: grass, sidewalk path to the office, walkway */ px(x, '#14301f', 0, 140, W, H - 140); for (var g = 0; g < 60; g++) px(x, '#1f4a2c', (g * 37) % W, 146 + (g * 13) % (H - 148), 1, 2);
    px(x, '#8d8a99', OD - 9, 140, 18, H - 140); for (var sy = 146; sy < H; sy += 8) px(x, '#6f6c7d', OD - 9, sy, 18, 1); px(x, '#a9a6b6', 100, 120, 220, 20); px(x, '#7f7c8c', 100, 139, 220, 1);
    /* No-Tail Motel sign + VACANCY (flicker kept) */ px(x, '#444', 30, 30, 3, 110); px(x, '#1a1a2a', 4, 8, 120, 26); px(x, '#000', 4, 8, 120, 2);
    var fl = rm ? 1 : (Math.floor(t / 90) % 23 !== 0); var tl = rm ? 1 : (Math.floor(t / 130) % 17 > 1);
    neon(x, 'NO-' + (tl ? 'TAIL' : 'T IL'), 64, 20, '#ff4fd8', fl, 8); neon(x, 'MOTEL', 64, 30, '#4fe0ff', true, 8);
    px(x, '#1a1a2a', 34, 40, 62, 12); neon(x, 'VACANCY', 65, 49, '#7dff6a', rm ? true : (Math.floor(t / 400) % 5 !== 0), 6);
    px(x, '#3ddc84', 6, 4, 4, 4); px(x, '#3ddc84', 118, 4, 4, 4); /* tiny laurels */
    /* lamp post */ px(x, '#333', 60, 92, 2, 48); px(x, '#333', 57, 140, 8, 2); px(x, '#555', 56, 88, 10, 4); x.save(); x.globalAlpha = rm ? .16 : .13 + .04 * Math.sin(t / 300); x.fillStyle = '#ffd166'; x.beginPath(); x.moveTo(58, 92); x.lineTo(64, 92); x.lineTo(76, 140); x.lineTo(46, 140); x.fill(); x.restore(); px(x, '#fff2b0', 58, 92, 6, 2);
    /* vending + ice machines */ px(x, '#c8102e', 72, 110, 12, 30); px(x, '#9fe8ff', 74, 113, 8, 12); for (var v = 0; v < 3; v++) px(x, ['#ffd166', '#7dff6a', '#ff4fd8'][v], 75 + v * 2, 116 + v * 3, 2, 2); px(x, '#000', 75, 130, 6, 3);
    px(x, '#d8e6f0', 86, 118, 13, 22); px(x, '#4fe0ff', 87, 120, 11, 6); x.font = '4px "Press Start 2P", monospace'; x.fillStyle = '#0b2a4a'; x.fillText('ICE', 87, 125); px(x, '#8aa', 88, 130, 9, 1); px(x, '#c8102e', 94, 132, 2, 2); /* ice machine (broke, per Gooby) */
    /* building */ px(x, '#e8a0b4', 104, 58, 216, 62); px(x, '#c47a92', 104, 58, 216, 4); px(x, '#5a3a4a', 100, 54, 220, 5);
    /* string lights */ for (var sx = 102; sx < W; sx += 3) { var sag = 6 * Math.sin(((sx - 102) % 54) / 54 * Math.PI); px(x, '#222', sx, 57 + sag, 3, 1); if ((sx - 102) % 9 === 0) { var on = rm || (Math.floor(t / 500) + sx / 9) % 4 !== 0; px(x, on ? ['#ffd166', '#ff4fd8', '#4fe0ff', '#7dff6a'][(sx / 9 | 0) % 4] : '#333', sx, 58 + sag, 2, 2); } }
    /* office: Roman columns, Gooby at the desk window, office door */ px(x, '#f2d7a0', 108, 66, 60, 54); [108, 163].forEach(function (cx) { px(x, '#f5efe0', cx, 64, 5, 56); px(x, '#d8cdb0', cx + 2, 66, 1, 52); });
    px(x, '#1a2b4a', 113, 78, 25, 20); dog(x, 115, 80, t); px(x, '#7a4f2a', 112, 98, 26, 4);
    door(x, OD - 11, '#3a2414'); px(x, '#ffd166', OD - 8, 84, 16, 10); px(x, '#1a1a2a', 112, 104, 26, 12); px(x, '#000', 112, 115, 26, 1); neon(x, 'OFFICE', 125, 112, '#ffb347', rm ? true : (Math.floor((t + 1700) / 350) % 7 !== 0), 4); /* neon OFFICE under Gooby's desk (flicker offset from VACANCY) */
    /* other rooms (every door = the red door's size, bottom on the walkway): real recent pairs; 101 lit, 103 dark, 104 silhouettes */
    var O = S.w ? others(S.w) : [];
    [[170, '101', 'lit', 0], [242, '103', 'dark', 2], [282, '104', 'sil', 1]].forEach(function (r, j) { var rx = r[0], pr = O[r[3]], wx = rx + 24;
      door(x, rx, '#2e8a8a'); x.font = '4px "Press Start 2P", monospace'; x.fillStyle = '#fff'; x.fillText(r[1], rx + 5, 77);
      px(x, '#1a1010', wx - 1, 85, 14, 17); px(x, r[2] === 'dark' ? '#14122a' : r[2] === 'sil' ? '#b8507e' : '#ffb3d9', wx, 86, 12, 15);
      if (pr && r[2] !== 'dark') { var bob = rm ? 0 : Math.round(Math.sin(t / 400 + j)); putPet(x, pr[0], wx + 3, 101 + (r[2] === 'lit' ? bob : 0), 8, t, r[2] === 'lit' ? null : '#3a1030'); putPet(x, pr[1], wx + 9, 101 - (r[2] === 'lit' ? bob : 0), 8, t, r[2] === 'lit' ? null : '#3a1030'); }
      if (r[2] === 'dark') { x.fillStyle = '#c9c9ff'; x.font = '4px "Press Start 2P", monospace'; var zz = rm ? 0 : Math.floor(t / 500) % 3; x.fillText('z', wx + 4, 95 - zz); }
      px(x, '#7a3a3a', wx, 86, 2, 15); px(x, '#7a3a3a', wx + 10, 86, 2, 15); /* curtains */
      S.rooms[j] = pr ? { room: r[1], a: pr[0].id, b: pr[1].id, mode: r[2] } : null; });
    /* THE room door: plate with both IDs, odds sign, open animation */
    var dx0 = 208, dy0 = 80, dw = 22, dh = 40; px(x, '#1a1010', dx0 - 1, dy0 - 1, dw + 2, dh + 1);
    var k = S.state === 'open' ? (rm ? 1 : Math.min(1, (t - S.open) / 1200)) : 0; px(x, '#3a1020', dx0, dy0, dw, dh); if (k > 0) { px(x, '#ffd1e8', dx0 + 2, dy0 + 2, dw - 4, dh - 2); }
    px(x, '#c8102e', dx0 + Math.round(k * (dw - 4)), dy0, dw - Math.round(k * (dw - 4)), dh); px(x, '#ffd166', dx0 + Math.round(k * (dw - 4)) + 2, dy0 + 20, 2, 2);
    x.font = '4px "Press Start 2P", monospace'; px(x, '#ffd166', dx0 - 6, dy0 - 10, dw + 12, 8); x.fillStyle = '#140f24'; x.textAlign = 'center';
    x.fillText((S.A ? '#' + S.A.id : '#?') + ' + ' + (S.B ? '#' + S.B.id : '#?'), dx0 + dw / 2, dy0 - 4); x.textAlign = 'left';
    var lit = S.state === 'half' || S.state === 'invite' || S.state === 'both' || S.state === 'open'; px(x, lit ? '#ffd166' : '#333', dx0 + dw + 3, dy0 + 4, 3, 3); px(x, S.state === 'open' ? '#ffd166' : '#333', dx0 + dw + 3, dy0 + 10, 3, 3); /* check-in lights */
    if (S.state === 'open') { for (var hz = 0; hz < 4; hz++) { var yy = dy0 - 6 - ((rm ? 10 : (t - S.open) / 30) + hz * 9) % 30; px(x, '#ff4fd8', dx0 + 4 + hz * 5, yy, 2, 2); px(x, '#ff4fd8', dx0 + 6 + hz * 5, yy, 2, 2); px(x, '#ff4fd8', dx0 + 5 + hz * 5, yy + 1, 2, 2); }
      if (k >= 1 || rm) { px(x, '#f5efe0', dx0 + 7, WY - 9, 8, 9); px(x, '#f5efe0', dx0 + 8, WY - 10, 6, 1); px(x, '#e8c38a', dx0 + 9, WY - 6, 2, 2); } } /* the egg at the door */
    /* front: bushes, flower beds, pool, palm */ bush(x, 104, 146, 14); flowers(x, 120, 146, 18); flowers(x, 162, 146, 40); bush(x, 204, 146, 12); flowers(x, 218, 146, 30); bush(x, 300, 146, 16); bush(x, 2, 150, 18); flowers(x, 40, 150, 22);
    px(x, '#d8d4c8', 236, 156, 64, 30); px(x, '#1e90c8', 239, 159, 58, 24); for (var wv = 0; wv < 5; wv++) px(x, '#7fd4ff', 243 + ((wv * 13 + (rm ? 0 : Math.floor(t / 200))) % 50), 163 + (wv * 5) % 18, 4, 1);
    var fy = rm ? 0 : Math.round(Math.sin(t / 500)); px(x, '#ff4fd8', 258, 168 + fy, 10, 6); px(x, '#1e90c8', 261, 170 + fy, 4, 2); px(x, '#fff', 259, 168 + fy, 2, 1); /* floatie */
    px(x, '#c0c0c0', 292, 152, 1, 6); px(x, '#c0c0c0', 296, 152, 1, 6); px(x, '#c0c0c0', 292, 152, 5, 1); /* pool ladder */ palm(x, 306, 160, t); palm(x, 12, 168, t + 900); bush(x, 170, 168, 14); flowers(x, 180, 186, 26); flowers(x, 100, 186, 30);
    /* guests: A then B (the date) walk in */ var talk = null, gline = null;
    ['A', 'B'].forEach(function (who) { var p = S[who]; if (!p || !S.walk[who] || S.walk[who].id !== p.id) return; var q = pose(who, t); if (!q || q.hide) return;
      if (q.a !== 0) putPet(x, p, q.x, q.y - (q.bob ? 1 : 0), 18, t, null, q.a == null ? null : Math.max(0, q.a));
      if (q.key && !(S.state === 'open')) keyPx(x, q.x + 6, q.y - 8); if (q.keyFly != null) { var kf = q.keyFly; keyPx(x, Math.round(lerp(128, q.x + 6, kf)), Math.round(lerp(94, q.y - 8, kf) - Math.sin(kf * Math.PI) * 14)); }
      if (q.talk) talk = [q.talk, q.x - 10, q.y - 34]; if (q.gooby) gline = q.gooby; });
    if (talk) bubble(x, talk[0], talk[1], talk[2]); bubble(x, gline || S.bubble || LINES[S.line % LINES.length], 112, 40);
    if (window.V2MotelReqs) V2MotelReqs.drawNote(x, t); /* tonight bundle: Gooby holds up a '1 waiting' note when breed requests wait at the desk */
    if (!rm) S.raf = requestAnimationFrame(function (n) { if (n - S.lt > 3600) { S.lt = n; S.line++; S.bubble = null; } draw(n); }); else S.raf = 0; }
  function state(w, a, b, ME) { var A = a ? w.byId[a] : null, B = b ? w.byId[b] : null, kid = null, st = 'empty';
    if (A && B) { var pair = [String(A.id), String(B.id)].sort().join(':');
      kid = w.pets.filter(function (p) { return p.parents && p.parents.map(String).sort().join(':') === pair; }).sort(function (x, y) { return y.hatchBlock - x.hatchBlock; })[0] || null;
      var tip = w.tip, live = function (r) { return !r.used && (tip == null || tip - r.block <= (window.V2Rules.BREED_WINDOW || 144)); }, req = (w.breedReqs || []).some(function (r) { return live(r) && r.a === A.id && r.b === B.id; }), inc = (w.breedReqs || []).some(function (r) { return live(r) && r.a === B.id && r.b === A.id; });
      st = kid && S.fresh === pair ? 'open' : req ? 'half' : inc ? 'invite' : 'both'; }
    else if (A || B) st = 'one';
    return { A: A, B: B, kid: kid, st: st }; }
  function render(w) { var U = window.V2UI, V = window.V2Rules, box = document.getElementById('motelScene'); if (!box || !U || !w) return; if (window.V2MotelReqs) V2MotelReqs.render(w); var ME = U.ME, tip = (U.S && U.S().tip) || w.tip;
    var a = document.getElementById('bA').value, b = document.getElementById('bB').value; if ((!a || !b) && S.fresh) { var fp = S.fresh.split(':'); a = fp[0]; b = fp[1]; } /* the pair just checked in may now be on breed cooldown; keep showing their door */ var s = state(w, a, b, ME); S.w = w; S.A = s.A; S.B = s.B; S.kid = s.kid; var now = performance.now(); ['A', 'B'].forEach(function (k) { var p = s[k]; if (!p) { delete S.walk[k]; return; } if (!S.walk[k] || S.walk[k].id !== p.id) S.walk[k] = { id: p.id, t0: k === 'B' && S.walk.A && S.walk.A.id === (s.A && s.A.id) ? Math.max(now, S.walk.A.t0 + 6200) : now }; }); if (s.st !== S.state) { S.state = s.st; if (s.st === 'open') { S.open = performance.now(); if (S.c && window.V2Sfx) V2Sfx.creak(); } }
    var c = box.querySelector('canvas'); if (!c) { box.innerHTML = '<canvas width="' + W + '" height="' + H + '" role="img" aria-label="No-Tail Motel at night: Gooby at the desk, your guests walk in, other rooms busy"></canvas>'; c = box.querySelector('canvas'); }
    S.c = c; S.x = c.getContext('2d'); cancelAnimationFrame(S.raf); draw(performance.now());
    book(w); var desk = document.getElementById('motelDesk'); if (!desk) return; var L = V.breedPicker(w, ME, tip, a), okA = L.mine.filter(function (x) { return !x.why && x.p.stage >= 3; }), okB = L.partners.filter(function (x) { return !x.why && x.p.stage >= 3; });
    var step = !a ? 'A' : !b ? 'B' : null, od = s.A && s.B ? odds(V, s.A, s.B) : null, T = ['Common', 'Uncommon', 'Rare', 'Legendary'];
    var hint = !ME ? 'Connect your wallet to check in' : step === 'A' ? '1 · Pick your guest' : step === 'B' ? '2 · Pick the date (yours or anyone\u2019s)' : s.st === 'half' ? 'Checked in · waiting for #' + s.B.id + '\u2019s owner' : s.st === 'invite' ? '💌 #' + s.B.id + ' already checked in · ring to join' : s.st === 'open' ? '🥚 Door\u2019s open: egg #' + (s.kid && s.kid.id) : '3 · Ring the bell';
    desk.innerHTML = '<div class="mt-hint">' + hint + '</div>' +
      '<div class="mt-guests"><button type="button" class="mt-g' + (step === 'A' || S.pickSide === 'A' ? ' on' : '') + '" data-side="A">' + (s.A ? 'Room #' + s.A.id + ' · ' + esc(s.A.name) : 'Guest 1 ?') + '</button><span>+</span><button type="button" class="mt-g' + (step === 'B' || S.pickSide === 'B' ? ' on' : '') + '" data-side="B">' + (s.B ? 'Room #' + s.B.id + ' · ' + esc(s.B.name) : 'Guest 2 ?') + '</button></div>' +
      (od ? '<div class="mt-odds" aria-label="Odds"><b>ODDS</b> ' + od.sp.map(function (q) { return esc(q[0]) + ' ' + q[1].toFixed(q[1] === 100 ? 0 : 1) + '%'; }).join(' · ') + '<br>' + (od.tier.up ? '⬆ ' + T[Math.min(3, od.hiT + 1)] + ' ' + od.tier.up.toFixed(1) + '% · ' : '') + T[od.hiT] + ' ' + od.tier.hi.toFixed(1) + '%' + (od.tier.lo ? ' · ' + T[od.loT] + ' ' + od.tier.lo.toFixed(1) + '%' : '') + '</div>' : '') +
      '<div id="motelPick"></div>';
    var side = S.pickSide || step; desk.querySelectorAll('[data-side]').forEach(function (bt) { bt.onclick = function () { S.pickSide = bt.dataset.side; S.fresh = null; render(U.world()); }; });
    var bell = document.getElementById('bGo'); if (bell) { bell.textContent = s.st === 'invite' ? 'Accept check-in · 690' : 'Check in · 690'; bell.disabled = !(s.A && s.B) || s.st === 'open'; }
    if (side && window.V2Picker) { var list = side === 'A' ? okA : okB;
      V2Picker.mount(document.getElementById('motelPick'), { w: w, me: ME, selected: side === 'A' ? a : b, per: 8, records: function () { return list.map(function (x) { return { key: String(x.p.id), pets: [x.p], newest: x.p.hatchBlock, html: V2Picker.petChip(w) }; }); },
        onPick: function (r) { S.fresh = null; document.getElementById(side === 'A' ? 'bA' : 'bB').value = r.key; if (side === 'A') document.getElementById('bB').value = document.getElementById('bB').value === r.key ? '' : document.getElementById('bB').value;
          S.pickSide = side === 'A' && !document.getElementById('bB').value ? 'B' : null; S.bubble = 'Room #' + r.key + '? Gooby pls.'; S.lt = performance.now(); U.render(); } }); } }
  /* after a check-in burn the existing code clears bA/bB and plays playBreed; we keep the pair so the door can open in place when the egg lands */
  /* GUESTBOOK (owner 7:58 PM CT): past breeding results from the replayed world, one short PG-13 note per egg, newest first, paged on the desk. */
  var NOTES = ['Left the DND sign up all night.', 'Room service: one egg.', 'Gooby heard nothing. Gooby pls.', 'Five stars. Would nest again.', 'Ice bucket never got used.', 'Checked out early. Glowing.',
    'Towels: missing. Egg: present.', 'Asked for late checkout. Got an egg.', 'The walls are thin. Congrats.', 'Paid cash. Left a hatchling.', 'Mint on the pillow, egg on the bed.', 'Swore it was "just a nap".'];
  var BK = { page: 0 };
  function book(w) { var el = document.getElementById('motelBook'); if (!el) return; var L = w.pets.filter(function (p) { return p.parents && p.parents.length === 2; }).sort(function (a, b) { return (b.hatchBlock || 0) - (a.hatchBlock || 0) || b.id - a.id; });
    var per = 6, pages = Math.max(1, Math.ceil(L.length / per)); BK.page = Math.min(BK.page, pages - 1); var V = L.slice(BK.page * per, BK.page * per + per);
    el.innerHTML = '<div class="gb"><div class="gb-top"><b class="gb-h">📒 GUESTBOOK</b><span class="gb-n">' + L.length + ' eggs</span></div>' + (V.length ? V.map(function (c) { var hy = window.V2Rules && V2Rules.isHybrid(c.species);
        return '<div class="gb-row"><span class="gb-main">#' + c.parents[0] + ' x #' + c.parents[1] + ' checked in, <a href="pet.html?id=' + c.id + '">#' + c.id + '</a> checked out' + (hy ? ' 🧬' : '') + '</span><span class="gb-note">' + NOTES[c.id % NOTES.length] + '</span></div>'; }).join('') : '<div class="gb-row">No guests yet. Be the first.</div>') +
      '<div class="gb-pg"><button type="button" class="pk-arr" data-gb="-1" aria-label="Newer"' + (BK.page ? '' : ' disabled') + '>◀</button><span>' + (BK.page + 1) + ' / ' + pages + '</span><button type="button" class="pk-arr" data-gb="1" aria-label="Older"' + (BK.page < pages - 1 ? '' : ' disabled') + '>▶</button></div></div>';
    el.querySelectorAll('[data-gb]').forEach(function (b) { b.onclick = function () { BK.page += +b.dataset.gb; book(w); }; });
    var x0 = null; el.ontouchstart = function (e) { x0 = e.touches[0].clientX; }; el.ontouchend = function (e) { if (x0 == null) return; var dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 40) { BK.page = Math.max(0, Math.min(pages - 1, BK.page + (dx < 0 ? 1 : -1))); book(w); } }; }
  function checkedIn(a, b) { S.fresh = [String(a), String(b)].sort().join(':'); if (window.V2Sfx) V2Sfx.creak(); S.bubble = 'Keys out. Door opens when both are in.'; S.lt = performance.now(); }
  window.V2Motel = { drawGooby: dog, neon: neon, render: render, book: book, NOTES: NOTES, odds: odds, checkedIn: checkedIn, LINES: LINES, _state: function () { return S; } };
})();
