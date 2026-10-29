/* XCPETS Pet Cemetery v2: THE ALTAR (branch cemetery-v2-view, PREVIEW ONLY; Oct 28 2026). No rule, burn or replay change: nothing here is signed or burned.
 * Owner, 6:33 PM CT: the main sacrifice happens AT THE SEANCE. Pick a dead pet (anyone's), offer as many of your living pets as you like plus
 * optional gear; more and rarer offerings make a stronger zombie. Each offering adds less than the one before, ceiling 3 times the death stats,
 * ripe (day 3+ unfed) pets count 1.5 times, Mythics can't be offered, pets wearing gear ask first. Owner: "the whole thing needs to be very fun and playable."
 * So: drag or tap pets onto the altar; each one flies in, melts into green smoke, a candle flares and a tally is carved; the power bar bumps and
 * lights milestones; "Preview the rise" plays the claw-from-the-grave. Tiny square-wave sounds, muted by default (toggle).
 * PROPOSED numbers (CEMETERY_V2_SPEC.md section 1): share closed of the gap left to the ceiling. Pets C 3% / U 7% / R 14% / L 25%, ripe 1.5 times,
 * gear 1% / 2.5% / 5% / 10%. boost = gap times (1 - product of (1 - share)), per stat, rounded down, at least 1 while below the ceiling. */
(function () {
  'use strict';
  var PET = [0.03, 0.07, 0.14, 0.25], GEAR = [0.01, 0.025, 0.05, 0.10], RIPE = 1.5, HW = 1.5, CAP = 3, STATS = ['vigor', 'spark', 'grit', 'zoom', 'luck'];
  var MILES = [[1.5, 'Shambler'], [2, 'Ghoul'], [2.5, 'Revenant'], [2.8, 'Dread'], [3, 'Ceiling']];
  var TL = ['Common', 'Uncommon', 'Rare', 'Legendary'], TID = ['common', 'uncommon', 'rare', 'legendary'], AW = 160, AH = 100, PAGE = 48, ZK = 2, ZS = 3, ZX0 = 112; /* risen zombie (owner Oct 28 'zombie should be bigger'): drawn on its own 2x layer (#altZc) at a whole 3 layer pixels per pet pixel = 48 of 32 (was squeezed to 28), kept right of the altar (x >= 112) */
  var RM = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function reduced() { return !!RM.matches || !!window.__cemReduced; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function px(x, c, a, b, w, h) { x.fillStyle = c; x.fillRect(a, b, w, h); }
  var A = { ctx: null, grave: null, mine: [], offered: [], gear: [0, 0, 0, 0], stash: [0, 0, 0, 0], filt: 'all', shown: PAGE, fx: [], flares: [0, 0, 0, 0, 0, 0], tally: 0, raf: 0, rise: null, sample: '', lastMile: -1, sound: false, ask: null, shown0: 0 };
  /* Halloween window boost (PROPOSED 1.5 times, owner said yes to a boost Oct 28 2026): Oct 31 through Nov 11 2026 CT, every offering's share counts 1.5 times,
   * same 3 times ceiling. Preview toggle: on by date inside the window; ?halloween=1 / ?halloween=0 force it. The live rule will use block heights. */
  var HW_FROM = Date.UTC(2026, 9, 31, 5), HW_TO = Date.UTC(2026, 10, 12, 6); /* Oct 31 00:00 CDT to Nov 12 00:00 CST */
  function hwDefault() { var q = null; try { q = new URLSearchParams(location.search).get('halloween'); } catch (e) {} if (q === '1') return true; if (q === '0') return false; var n = Date.now(); return n >= HW_FROM && n < HW_TO; }
  A.hw = hwDefault();
  try { A.sound = localStorage.getItem('xcpets-cem-sfx') === 'on'; } catch (e) {}

  /* ---------------------------------------------------------------- the math (proposed) ---------------------------------------------------------------- */
  function share(o) { var s = o.kind === 'gear' ? GEAR[o.tier] : PET[o.tier] * (o.ripe ? RIPE : 1); return Math.min(0.99, s * (A.hw ? HW : 1)); }
  function project(base, list) { var keep = 1; list.forEach(function (o) { keep *= 1 - share(o); }); var f = 1 - keep, out = {}, tot = 0, b0 = 0;
    STATS.forEach(function (k) { var d = base[k] || 0, gap = d * (CAP - 1), add = Math.floor(gap * f); if (f > 0 && gap > 0 && add < 1) add = 1; if (add > gap) add = gap; out[k] = d + add; tot += d + add; b0 += d; });
    return { stats: out, total: tot, base: b0, ceil: b0 * CAP, frac: f, exact: b0 + b0 * (CAP - 1) * f }; }
  /* offerings shown strongest first, so each line adds less than the one before (the total does not depend on the order) */
  function ordered() { return A.offered.concat(gearList()).sort(function (a, b) { return share(b) - share(a) || a.seq - b.seq; }); }
  function gearList() { var L = []; A.gear.forEach(function (n, t) { for (var i = 0; i < n; i++) L.push({ kind: 'gear', tier: t, seq: 1e6 + t * 1000 + i, label: TL[t] + ' gear' }); });
    A.offered.forEach(function (o) { (o.worn || []).forEach(function (g, i) { L.push({ kind: 'gear', tier: g, seq: o.seq + 0.01 * (i + 1), label: TL[g] + ' gear worn by #' + o.id, on: o.id }); }); }); return L; }
  /* each line's share of the boost before rounding (one decimal), so the list visibly shrinks line by line */
  function steps() { var L = ordered(), base = A.base, prev = project(base, []).exact, out = []; for (var i = 0; i < L.length; i++) { var t = project(base, L.slice(0, i + 1)).exact; out.push({ o: L[i], add: dec(t - prev) }); prev = t; } return out; }
  function dec(v) { return (Math.round(v * 10) / 10).toFixed(1); }

  /* ---------------------------------------------------------------- sound (muted by default) ---------------------------------------------------------------- */
  var AC = null;
  function tone(f, d, at, type, vol) { if (!A.sound) return; try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); var t = AC.currentTime + (at || 0), o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(Math.max(40, f * 0.5), t + d); g.gain.setValueAtTime(vol || 0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d + 0.02); } catch (e) {} }
  var SFX = { offer: function (tier) { tone(330 + tier * 110, 0.09); tone(220 + tier * 80, 0.14, 0.08); }, smoke: function () { tone(140, 0.18, 0, 'triangle', 0.04); },
    mile: function () { [392, 523, 659, 784].forEach(function (f, i) { tone(f, 0.1, i * 0.07); }); }, back: function () { tone(180, 0.08); },
    rise: function () { tone(70, 0.6, 0, 'sawtooth', 0.05); [196, 233, 294, 392].forEach(function (f, i) { tone(f, 0.18, 0.7 + i * 0.12); }); } };

  /* ---------------------------------------------------------------- sprites ---------------------------------------------------------------- */
  var SPR = {};
  function sprite(p, green) { var key = p.id + (green ? 'g' : ''); if (SPR[key] !== undefined) return SPR[key]; var R = A.ctx.R, wp = A.ctx.w.byId ? A.ctx.w.byId[p.id] : null, c = null;
    try { if (wp && wp.art) { c = document.createElement('canvas'); c.width = c.height = 32; /* keyed render (solid magenta background) so only the pet itself flies, smokes and rises, never its square tile */
      R.paint(c, R.framesWith(Object.assign({}, wp.art, { background: 'solid', bgColor: '#ff00ff', pattern: 'none' }), wp.stage, [])[0]);
      var x = c.getContext('2d'), d = x.getImageData(0, 0, 32, 32), a = d.data; for (var i = 0; i < a.length; i += 4) { if (a[i] > 240 && a[i + 1] < 16 && a[i + 2] > 240) { a[i + 3] = 0; continue; } if (!a[i + 3] || !green) continue; var l = (a[i] * 0.3 + a[i + 1] * 0.59 + a[i + 2] * 0.11) / 255;
        a[i] = Math.round(40 + 90 * l); a[i + 1] = Math.round(90 + 160 * l); a[i + 2] = Math.round(40 + 60 * l); } x.putImageData(d, 0, 0); var bx0 = 32, by0 = 32, bx1 = -1, by1 = -1; for (var j = 0; j < 1024; j++) { if (!a[j * 4 + 3]) continue; var jx = j % 32, jy = (j / 32) | 0; if (jx < bx0) bx0 = jx; if (jx > bx1) bx1 = jx; if (jy < by0) by0 = jy; if (jy > by1) by1 = jy; } c.bb = bx1 < 0 ? [0, 0, 32, 32] : [bx0, by0, bx1 - bx0 + 1, by1 - by0 + 1]; /* the pet's own pixels (for the bigger risen zombie) */ } } catch (e) { c = null; }
    SPR[key] = c; return c; }

  /* ---------------------------------------------------------------- the altar canvas ---------------------------------------------------------------- */
  var CAND = [[55, 58, 7], [63, 58, 5], [97, 58, 5], [105, 58, 7], [40, 92, 9], [118, 92, 9]], SPOT = { x: 80, y: 57 }, GRV = { x: 134, y: 86 };
  function scene(x, t) { var i;
    var B = ['#0b0a1f', '#110f2b', '#181539', '#221d48', '#2a2452', '#342e5e']; for (i = 0; i < B.length; i++) px(x, B[i], 0, i * 10, AW, 10);
    for (i = 0; i < 18; i++) px(x, i % 5 ? '#8d89c9' : '#fff6d8', (i * 47 + 13) % AW, (i * 29 + 5) % 44, 1, 1);
    px(x, '#383274', 18, 8, 14, 14); px(x, '#fff1c4', 20, 10, 10, 10); px(x, '#eadba4', 22, 13, 3, 2); px(x, '#eadba4', 26, 16, 2, 2);
    for (var hx = 0; hx < AW; hx += 2) { var hh = 4 + Math.round(Math.sin(hx / 17) * 2 + Math.sin(hx / 7)); px(x, '#3c3868', hx, 60 - hh, 2, hh); }
    for (var y = 60; y < AH; y++) { var k = (y - 60) / 40; px(x, 'rgb(' + [Math.round(74 - 50 * k), Math.round(76 - 46 * k), Math.round(106 - 74 * k)].map(function (v) { return v - v % 6; }).join(',') + ')', 0, y, AW, 1); }
    x.save(); x.globalAlpha = 0.22; px(x, '#8f91b0', 0, 58, AW, 3); x.globalAlpha = 0.1; var fo = reduced() ? 30 : (t / 90) % 220; px(x, '#c8c6e8', Math.round(fo) - 60, 66, 70, 2); px(x, '#c8c6e8', Math.round((fo + 110) % 220) - 60, 74, 50, 2); x.restore();
    /* the chosen grave: a headstone with its ghost, and the dirt where the zombie comes up */
    var g = GRV, R0 = A.rise; px(x, '#16141f', g.x - 12, g.y - 30, 24, 31); px(x, '#16141f', g.x - 9, g.y - 33, 18, 3); px(x, '#7c808c', g.x - 11, g.y - 29, 22, 29); px(x, '#7c808c', g.x - 8, g.y - 32, 16, 3);
    px(x, '#525560', g.x + 6, g.y - 29, 5, 29); px(x, '#9a9ea8', g.x - 11, g.y - 29, 1, 29); x.font = '5px "Press Start 2P", monospace'; x.textAlign = 'center'; x.fillStyle = '#2b2d31'; x.fillText('RIP', g.x - 1, g.y - 20);
    x.font = '4px "Press Start 2P", monospace'; x.fillText('#' + (A.grave ? A.grave.id : ''), g.x - 1, g.y - 12); x.textAlign = 'left';
    var shake = R0 && R0.t < 900 ? Math.round(Math.sin(t / 25) * 1) : 0;
    px(x, '#2a1d14', g.x - 16 + shake, g.y, 32, 6); px(x, '#3e2a18', g.x - 14 + shake, g.y - 1, 28, 2); px(x, '#523822', g.x - 10 + shake, g.y - 2, 6, 1); px(x, '#523822', g.x + 3 + shake, g.y - 2, 5, 1);
    var gs = A.grave && sprite(A.grave); if (gs && !R0) { x.save(); x.globalAlpha = 0.45 + 0.1 * Math.sin(t / 300); x.imageSmoothingEnabled = false; x.drawImage(gs, g.x - 12, g.y - 58 + (reduced() ? 0 : Math.round(Math.sin(t / 450) * 2)), 24, 24); x.restore(); }
    /* the altar: slab, body, base; carved tally on the front */
    px(x, '#16141f', 49, 56, 62, 6); px(x, '#9a9ea8', 50, 57, 60, 4); px(x, '#c8ccd4', 50, 57, 60, 1);
    px(x, '#16141f', 55, 61, 50, 28); px(x, '#7c808c', 56, 61, 48, 27); px(x, '#525560', 96, 61, 8, 27); px(x, '#9a9ea8', 56, 61, 1, 27);
    px(x, '#16141f', 47, 88, 66, 6); px(x, '#6a6e7a', 48, 88, 64, 5); px(x, '#525560', 48, 92, 64, 1);
    var glow = A.offered.length ? 0.18 + 0.08 * Math.sin(t / 200) : 0; if (glow) { x.save(); x.globalAlpha = glow; px(x, '#7dff6a', 60, 46, 40, 12); x.globalAlpha = glow / 2; px(x, '#7dff6a', 54, 40, 52, 18); x.restore(); }
    carve(x); A.flares.forEach(function (f, j) { candle(x, CAND[j], f, t, j); });
  }
  function carve(x) { var n = Math.min(A.tally, 40); for (var i = 0; i < n; i++) { var grp = Math.floor(i / 5), r = Math.floor(grp / 4), col = grp % 4, k = i % 5, bx = 59 + col * 9, by = 65 + r * 10;
      if (k < 4) px(x, '#1c1824', bx + k * 2, by, 1, 7); else { for (var d = 0; d < 7; d++) px(x, '#1c1824', bx - 1 + d, by + 6 - d, 1, 1); } }
    if (A.tally > 40) { x.font = '4px "Press Start 2P", monospace'; x.fillStyle = '#1c1824'; x.fillText('+' + (A.tally - 40), 86, 86); } }
  function candle(x, c, f, t, j) { var cx = c[0], cy = c[1], h = c[2], fl = reduced() ? 0 : Math.round(Math.sin(t / 90 + j * 2.1) + Math.sin(t / 53 + j)) / 2, big = f > 0 ? Math.round(f * 7) : 0;
    px(x, '#16141f', cx - 2, cy - h - 1, 5, h + 1); px(x, '#e9e3d0', cx - 1, cy - h, 3, h); px(x, '#b8b09a', cx + 1, cy - h, 1, h); px(x, '#000', cx, cy - h - 1, 1, 1);
    var fh = 3 + big + fl, col = f > 0.15 ? '#7dff6a' : '#ffc93c', core = f > 0.15 ? '#e6ffd8' : '#fff3b0';
    x.save(); x.globalAlpha = 0.18 + f * 0.3; px(x, col, cx - 3 - big, cy - h - fh - 2, 7 + big * 2, fh + 4); x.restore();
    px(x, col, cx - 1, cy - h - fh, 3, fh); px(x, core, cx, cy - h - fh + 1, 1, Math.max(1, fh - 1)); }
  /* effects: fly (pet into the altar), smoke (green), chips (carving), text pops */
  function fly(o, from) { var s = sprite(o); A.fx.push({ k: 'fly', s: s, x0: from ? from.x : 80 + (Math.random() * 60 - 30), y0: from ? from.y : AH + 10, t: 0, d: from ? 200 : 280, o: o }); kick(); }
  function land(f) { var o = f.o, j = (A.tally + o.seq) % 4; A.flares[j] = 1; if (o.tier >= 2) A.flares[4] = A.flares[5] = 1; A.tally++;
    for (var i = 0; i < 26 + o.tier * 8; i++) A.fx.push({ k: 'smoke', x: SPOT.x + (Math.random() * 20 - 10), y: SPOT.y - 6 + Math.random() * 8, vx: Math.random() * 0.6 - 0.3, vy: -(0.25 + Math.random() * 0.6), t: 0, d: 500 + Math.random() * 500, c: ['#7dff6a', '#3fbf4a', '#c9ffb0', '#2f8a3c'][i % 4], z: i % 3 ? 1 : 2 });
    var tx = 59 + (Math.floor((A.tally - 1) / 5) % 4) * 9, ty = 65 + Math.floor((A.tally - 1) / 20) * 10; for (var c = 0; c < 6; c++) A.fx.push({ k: 'chip', x: tx + 3, y: ty + 3, vx: Math.random() * 1.4 - 0.7, vy: -Math.random() * 1.2, t: 0, d: 350 });
    A.fx.push({ k: 'pop', x: SPOT.x, y: SPOT.y - 14, t: 0, d: 700, s: '+' + o.add }); SFX.smoke(); if (window.V2CemeteryScene && V2CemeteryScene.flare) V2CemeteryScene.flare(); }
  function step(f, dt) { f.t += dt; if (f.k === 'smoke' || f.k === 'chip') { f.x += f.vx * dt / 16; f.y += f.vy * dt / 16; if (f.k === 'chip') f.vy += 0.08 * dt / 16; } }
  function drawFx(x) { A.fx.forEach(function (f) { var p = Math.min(1, f.t / f.d);
      if (f.k === 'fly') { var e = 1 - Math.pow(1 - p, 3), fx = f.x0 + (SPOT.x - f.x0) * e, fy = f.y0 + (SPOT.y - 12 - f.y0) * e - Math.sin(p * Math.PI) * 18, sz = Math.round(24 - 6 * p);
        if (f.s) { x.save(); x.imageSmoothingEnabled = false; x.globalAlpha = 1 - p * 0.3; x.drawImage(f.s, Math.round(fx - sz / 2), Math.round(fy - sz / 2), sz, sz); x.restore(); } else px(x, '#e9e3ff', Math.round(fx) - 4, Math.round(fy) - 4, 8, 8); }
      else if (f.k === 'smoke') { x.save(); x.globalAlpha = (1 - p) * 0.9; px(x, f.c, Math.round(f.x), Math.round(f.y), f.z, f.z); x.restore(); }
      else if (f.k === 'chip') { px(x, '#c8ccd4', Math.round(f.x), Math.round(f.y), 1, 1); }
      else if (f.k === 'pop') { x.save(); x.globalAlpha = 1 - p; x.font = '6px "Press Start 2P", monospace'; x.textAlign = 'center'; x.fillStyle = '#000'; x.fillText(f.s, f.x + 1, f.y - p * 10 + 1); x.fillStyle = '#7dff6a'; x.fillText(f.s, f.x, f.y - p * 10); x.restore(); } }); }
  /* the rise (mock): ground shakes, dirt flies, a claw breaks out, the zombie climbs up, green and glowing */
  function drawRise(x) { var R0 = A.rise, t = R0.t, g = GRV, z = sprite(A.grave, true);
    if (t < 1100 && Math.random() < 0.6) A.fx.push({ k: 'chip', x: g.x - 8 + Math.random() * 16, y: g.y - 1, vx: Math.random() * 2 - 1, vy: -(0.6 + Math.random() * 1.6), t: 0, d: 500 });
    if (t > 350 && t < 1500) { var cp = Math.min(1, (t - 350) / 450), cy = g.y - Math.round(10 * cp), cx = g.x - 8; /* the claw */
      px(x, '#2f8a3c', cx, cy, 3, 10 * cp + 1); px(x, '#3fbf4a', cx + 1, cy, 1, 10 * cp); [[-2, -3], [0, -4], [2, -3], [4, -2]].forEach(function (f, i) { px(x, '#7dff6a', cx + f[0], cy + f[1], 1, 3); px(x, '#c9ffb0', cx + f[0], cy + f[1], 1, 1); }); }
    var zc = A.zc, zx2 = zc && zc.getContext('2d'); if (t > 1100 && zx2) { var rp = Math.min(1, (t - 1100) / 900), e = 1 - Math.pow(1 - rp, 2), bb = z && z.bb ? z.bb : [8, 6, 16, 22], zw = bb[2] * ZS, zh = bb[3] * ZS, gy = g.y * ZK, zl = ZX0 * ZK,
        zx = Math.max(zl, Math.min(AW * ZK - zw, g.x * ZK - (zw >> 1))), top = Math.round(gy - zh * e); zx2.save(); zx2.beginPath(); zx2.rect(0, 0, AW * ZK, gy); zx2.clip(); zx2.imageSmoothingEnabled = false;
      if (z) zx2.drawImage(z, bb[0], bb[1], bb[2], bb[3], zx, top, zw, zh); else { zx2.fillStyle = '#7dff6a'; zx2.fillRect(zx, top, zw, zh); } zx2.restore();
      if (rp >= 1) { var bl = Math.floor(t / 220) % 2, hx = Math.max(zl, zx - 6), hy = Math.max(2, gy - zh - 8); zx2.save(); zx2.globalAlpha = 0.25 + 0.15 * bl; zx2.fillStyle = '#7dff6a'; zx2.fillRect(hx, hy, Math.min(AW * ZK, zx + zw + 6) - hx, gy + 4 - hy); zx2.restore(); } }
    if (t > 2100 && !R0.done) { R0.done = true; risenCard(); } }
  function frame(t) { var c = A.cv; if (!c || !c.isConnected) { A.raf = 0; return; } var x = c.getContext('2d'), now = t || performance.now(), dt = A.last ? Math.min(50, now - A.last) : 16; A.last = now; x.imageSmoothingEnabled = false;
    A.flares = A.flares.map(function (f) { return Math.max(0, f - dt / 520); }); if (A.rise) A.rise.t += dt;
    A.fx.forEach(function (f) { step(f, dt); }); var landed = A.fx.filter(function (f) { return f.k === 'fly' && f.t >= f.d; }); A.fx = A.fx.filter(function (f) { return f.t < f.d; }); landed.forEach(land);
    if (A.zc) A.zc.getContext('2d').clearRect(0, 0, A.zc.width, A.zc.height); scene(x, now); if (A.rise) drawRise(x); drawFx(x);
    var busy = A.fx.length || A.flares.some(function (f) { return f > 0; }) || (A.rise && !A.rise.done) || A.rise; if (!reduced() && !A.off && (busy || A.offered.length || A.grave)) A.raf = requestAnimationFrame(frame); else A.raf = 0; }
  function kick() { if (!A.raf && A.cv) { A.last = 0; A.raf = requestAnimationFrame(frame); } if (reduced() && A.cv) { A.fx.forEach(function (f) { if (f.k === 'fly') land(f); }); A.fx = []; A.flares = [0, 0, 0, 0, 0, 0]; frame(performance.now()); } }

  /* ---------------------------------------------------------------- data ---------------------------------------------------------------- */
  function myth(p) { return !!p.mythicCare || p.stage >= 5; }
  function wornTiers(w, p) { var V = A.ctx.V, L = []; try { L = (A.ctx.R.worn ? A.ctx.R.worn(w, p.id) : V.wornOf(w, p.id)) || []; } catch (e) { L = []; } return L.map(gTier); }
  function gTier(g) { if (!g) return 0; if (g.legendary) return 3; if (typeof g.tier === 'number') return Math.max(0, Math.min(3, g.tier)); var it = A.ctx.V.itemOf ? A.ctx.V.itemOf(g.item) : null; return it && typeof it.tier === 'number' ? Math.max(0, Math.min(3, it.tier)) : 0; }
  function living(w, who) { return w.pets.filter(function (p) { return p.owner === who && !p.dead && !p.released && !p.community; }); }
  function pickOwner(w, ME) { if (ME && living(w, ME).length) return { who: ME, sample: false }; var n = {}, best = '', bn = 0;
    w.pets.forEach(function (p) { if (p.dead || p.released || p.community || !p.owner) return; n[p.owner] = (n[p.owner] || 0) + 1; });
    Object.keys(n).forEach(function (k) { if (n[k] > bn && n[k] < 4000) { bn = n[k]; best = k; } }); return { who: best, sample: true }; }
  function buildMine() { var w = A.ctx.w, R = A.ctx.R, o = pickOwner(w, A.ctx.ME); A.who = o.who; A.sample = o.sample;
    A.mine = living(w, o.who).map(function (p) { var hd = R.hungerDays ? R.hungerDays(p, w) : 0; return { id: p.id, name: p.name, tier: p.tier | 0, stage: p.stage, stageName: p.stageName, ripe: hd >= 3, hd: hd, myth: myth(p), worn: wornTiers(w, p) }; })
      .sort(function (a, b) { return (a.myth - b.myth) || (b.ripe - a.ripe) || (a.tier - b.tier) || (b.hd - a.hd) || (a.id - b.id); });
    A.stash = [0, 0, 0, 0]; (w.itemList || []).forEach(function (g) { if (g && g.owner === o.who && g.on == null && !g.bag) A.stash[gTier(g)]++; }); }

  /* ---------------------------------------------------------------- panel ---------------------------------------------------------------- */
  function host() { var el = document.getElementById('cemAltar'); if (el) return el; el = document.createElement('section'); el.id = 'cemAltar'; el.className = 'cem-altar'; el.hidden = true; el.setAttribute('aria-label', 'Seance at the altar (preview)');
    var after = document.getElementById('cemCard') || document.getElementById('cemScene'); after.parentNode.insertBefore(el, after.nextSibling); return el; }
  function open(grave, ctx) { if (ctx) A.ctx = ctx; if (!A.ctx || !grave) return; var w = A.ctx.w, wp = w.byId ? w.byId[grave.id] : null, s = wp && wp.stats ? wp.stats : null, base = {};
    if (s) STATS.forEach(function (k) { base[k] = s[k] || 0; }); else STATS.forEach(function (k, i) { base[k] = Math.floor((grave.power || 0) / 5) + (i < (grave.power || 0) % 5 ? 1 : 0); });
    A.grave = grave; A.base = base; A.offered = []; A.gear = [0, 0, 0, 0]; A.tally = 0; A.fx = []; A.rise = null; A.shown = PAGE; A.lastMile = -1; A.ask = null; A.seq = 0; if (!A.mine.length || A.ctxW !== w) { buildMine(); A.ctxW = w; }
    var el = host(); el.hidden = false; el.innerHTML = shell(); A.cv = el.querySelector('#altCv'); A.zc = el.querySelector('#altZc'); bind(el); renderAll(true);
    topGap(); if (!A.rz) { A.rz = true; window.addEventListener('resize', topGap); } if (window.IntersectionObserver && !A.io) { A.io = new IntersectionObserver(function (es) { A.off = !es[0].isIntersecting; if (!A.off) kick(); }); } if (A.io) { A.io.disconnect(); A.io.observe(A.cv); }
    if (window.V2CemeteryScene && V2CemeteryScene.hooks) V2CemeteryScene.hooks('lit'); kick(); el.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' }); }
  /* the sticky stage sits just under the site's sticky nav, whatever height the nav wraps to on a phone */
  function topGap() { var n = document.querySelector('.nav'), el = document.getElementById('cemAltar'); if (el) el.style.setProperty('--altTop', ((n && /sticky|fixed/.test(getComputedStyle(n).position)) ? n.offsetHeight + 4 : 0) + 'px'); }
  function close() { var el = document.getElementById('cemAltar'); if (el) { el.hidden = true; el.innerHTML = ''; } A.cv = null; A.zc = null; A.grave = null; if (window.V2CemeteryScene && V2CemeteryScene.hooks) V2CemeteryScene.hooks('off'); }
  function shell() { var g = A.grave, sa = A.ctx.shortAddr, ME = A.ctx.ME;
    return '<div class="alt-head"><h2 class="alt-title">🕯️ Seance at the altar <span class="alt-pv">PREVIEW</span></h2><div class="alt-tools"><button type="button" class="q" id="altSnd" aria-pressed="' + A.sound + '" title="Sound">' + (A.sound ? '🔊' : '🔇') + '</button><button type="button" class="q" id="altX" aria-label="Close the seance">✕</button></div></div>' +
      '<p class="small alt-who">Raising <b>' + esc(g.name) + '</b> <span class="muted">#' + g.id + ' · ' + esc(g.spl || '') + ' · ' + TL[g.tier] + ' · owner ' + esc(sa(g.owner)) + (ME && g.owner === ME ? ' (you)' : '') + '</span></p>' +
      '<p class="small alt-hw" id="altHwRow"><span class="alt-hwb" id="altHwB"' + (A.hw ? '' : ' hidden') + '>🎃 Night of the Dead: offerings count 1.5 times</span> <button type="button" class="q" id="altHw" aria-pressed="' + A.hw + '" title="Preview the Halloween window boost (Oct 31 through Nov 11)">🎃 Halloween boost: ' + (A.hw ? 'on' : 'off') + '</button></p>' +
      (A.sample ? '<p class="small alt-note">👀 No wallet pets here, so this preview borrows a sample player\'s living pets (' + esc(sa(A.who)) + '). Nothing is burned.</p>' : '') +
      '<div class="alt-grid"><div class="alt-left"><div class="alt-stage"><div class="alt-cvwrap"><canvas id="altCv" width="' + AW + '" height="' + AH + '" role="img" aria-label="A stone altar with candles beside the grave. Drop or tap pets to offer them."></canvas><canvas id="altZc" width="' + AW * ZK + '" height="' + AH * ZK + '" aria-hidden="true"></canvas><div class="alt-drop" aria-hidden="true">Drop here</div><div class="alt-toast" id="altToast" aria-live="polite"></div></div>' +
      '<div class="alt-power"><div class="alt-pnum" id="altNum"></div><div class="alt-bar" id="altBar"><i class="alt-b0"></i><i class="alt-b1"></i>' + MILES.map(function (m, i) { return '<span class="alt-mk" data-i="' + i + '" style="left:' + (m[0] / CAP * 100) + '%"><em>' + m[1] + '</em></span>'; }).join('') + '</div>' +
      '<div class="alt-stats" id="altStats"></div></div></div>' +
      '<div class="alt-acts"><button type="button" class="btn" id="altRise" disabled>▶ Preview the rise</button><button type="button" class="btn ghost" id="altHold" disabled aria-disabled="true" title="Preview only: nothing is burned">🕯️ Hold seance (preview)</button><button type="button" class="q" id="altClr">↩ Take all back</button></div>' +
      '<div class="alt-tallylist" id="altList"></div></div>' +
      '<div class="alt-pick"><div class="alt-ph"><b>Your living pets</b> <span class="small muted" id="altCount"></span></div><p class="small muted alt-how">Tap a pet, or drag its picture onto the altar. Ripe pets (3+ days unfed) count 1.5 times. Mythics can\'t be offered.</p>' +
      '<div class="alt-filt" role="group" aria-label="Filter">' + [['all', 'All'], ['ripe', '🍂 Ripe'], ['0', 'Common'], ['1', 'Uncommon'], ['2', 'Rare'], ['3', 'Legendary']].map(function (f) { return '<button type="button" class="q" data-f="' + f[0] + '" aria-pressed="' + (A.filt === f[0]) + '">' + f[1] + '</button>'; }).join('') +
      '<button type="button" class="q alt-quick" id="altQuick">⚡ +5 ripe Commons</button></div><div class="alt-tiles" id="altTiles"></div><div class="alt-more"><button type="button" class="q" id="altMore">Show more</button></div>' +
      '<div class="alt-gear"><b class="small">🎒 Stash gear</b> <span class="small muted">(optional, counts half a pet)</span><div class="alt-gr">' + TL.map(function (t, i) { return '<span class="alt-gs tier-' + TID[i] + '"><span class="pill tier tier-' + TID[i] + '">' + t + '</span> <button type="button" class="q" data-g="' + i + '" data-d="-1" aria-label="One less ' + t + ' gear">−</button> <b id="altG' + i + '">0</b>/' + A.stash[i] + ' <button type="button" class="q" data-g="' + i + '" data-d="1" aria-label="One more ' + t + ' gear">+</button></span>'; }).join('') + '</div></div></div></div>' +
      '<p class="small muted alt-foot">Preview only. No burn, no rule change. Boost numbers are proposals for the owner: each offering closes a share of the gap left to the 3 times ceiling (pets Common 3%, Uncommon 7%, Rare 14%, Legendary 25%; ripe 1.5 times; gear 1% to 10%; Halloween window Oct 31 through Nov 11: every share 1.5 times, same 3 times ceiling).</p>'; }
  function visible() { return A.mine.filter(function (p) { return A.filt === 'all' ? true : A.filt === 'ripe' ? p.ripe && !p.myth : p.tier === +A.filt && !p.myth; }); }
  function isOn(id) { return A.offered.some(function (o) { return o.id === id; }); }
  function tile(p) { var on = isOn(p.id), dis = p.myth, ask = A.ask === p.id;
    return '<label class="alt-tile tier-' + TID[p.tier] + (on ? ' on' : '') + (dis ? ' myth' : '') + (p.ripe && !dis ? ' ripe' : '') + '" data-id="' + p.id + '"' + (dis ? ' title="Mythics can\'t be offered"' : '') + '>' +
      '<input type="checkbox" data-id="' + p.id + '"' + (on ? ' checked' : '') + (dis ? ' disabled' : '') + ' aria-label="Offer ' + esc(p.name) + ' #' + p.id + '">' +
      '<canvas width="32" height="32" data-sp="' + p.id + '" class="alt-sp"></canvas><span class="alt-tn">' + esc(p.name) + '</span><span class="alt-tm">#' + p.id + ' · <span class="tc">' + TL[p.tier] + '</span></span>' +
      '<span class="alt-tags">' + (dis ? '<span class="alt-tag lock">🔒 Mythic</span>' : '') + (p.ripe && !dis ? '<span class="alt-tag ripe">🍂 RIPE</span>' : '') + (p.worn.length ? '<span class="alt-tag gear">🎒' + p.worn.length + '</span>' : '') + '</span>' +
      (ask ? '<span class="alt-ask" role="alertdialog">Wearing ' + p.worn.length + ' gear. It burns too. <button type="button" class="q" data-yes="' + p.id + '">Offer</button> <button type="button" class="q" data-no="' + p.id + '">Keep</button></span>' : '') + '</label>'; }
  function renderTiles() { var el = document.getElementById('altTiles'); if (!el) return; var L = visible(), R = A.ctx.R, w = A.ctx.w; el.innerHTML = L.slice(0, A.shown).map(tile).join('') || '<p class="small muted">No pets in this filter.</p>';
    L.slice(0, A.shown).forEach(function (p) { var c = el.querySelector('canvas[data-sp="' + p.id + '"]'), wp = w.byId ? w.byId[p.id] : null; if (c && wp && wp.art && R.lazy) R.lazy(c, function () { return R.framesWith(wp.art, wp.stage, []); }, true); });
    var m = document.getElementById('altMore'); m.hidden = L.length <= A.shown; m.textContent = 'Show more (' + (L.length - A.shown) + ' left)';
    var ripe = A.mine.filter(function (p) { return p.ripe && !p.myth; }).length, my = A.mine.filter(function (p) { return p.myth; }).length;
    document.getElementById('altCount').textContent = A.mine.length + ' living · ' + ripe + ' ripe · ' + my + ' Mythic · ' + A.offered.length + ' on the altar'; }
  function renderPower(bump) { var P = project(A.base, ordered()), base = P.base, ceil = Math.max(1, P.ceil), num = document.getElementById('altNum'), bar = document.getElementById('altBar'); if (!num) return;
    var mult = base ? P.total / base : 1, mi = -1; MILES.forEach(function (m, i) { if (base && P.total >= Math.floor(base * m[0])) mi = i; });
    num.innerHTML = '<span class="alt-big" id="altBig">' + P.total + '</span> <span class="small">zombie power</span> <span class="small muted">· died with ' + base + ' · +' + (P.total - base) + ' boost · ceiling ' + P.ceil + ' (3 times)</span><span class="alt-rank">' + (mi >= 0 ? (mi === MILES.length - 1 ? 'MAXED' : MILES[mi][1].toUpperCase()) : 'RISEN PET') + ' · ' + (Math.round(mult * 100) / 100) + ' times</span>';
    bar.querySelector('.alt-b0').style.width = (base / ceil * 100) + '%'; bar.querySelector('.alt-b1').style.width = ((P.total - base) / ceil * 100) + '%'; bar.querySelector('.alt-b1').style.left = (base / ceil * 100) + '%';
    bar.querySelectorAll('.alt-mk').forEach(function (m) { var i = +m.getAttribute('data-i'); m.classList.toggle('hit', i <= mi); m.classList.toggle('next', i === mi + 1); });
    bar.classList.toggle('near', P.total >= base * 2.5);
    if (bump && !reduced()) { bar.classList.remove('bump'); void bar.offsetWidth; bar.classList.add('bump'); var b = document.getElementById('altBig'); if (b) { b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); } }
    if (mi > A.lastMile && A.lastMile >= -1 && bump) { toast((mi === MILES.length - 1 ? '💀 CEILING! 3 times' : '🧟 ' + MILES[mi][1].toUpperCase() + '!') + ''); SFX.mile(); } A.lastMile = mi;
    document.getElementById('altStats').innerHTML = STATS.map(function (k) { return '<span><b>' + k.charAt(0).toUpperCase() + k.slice(1) + '</b> ' + (A.base[k] || 0) + ' → <i>' + P.stats[k] + '</i></span>'; }).join('');
    var st = steps(); document.getElementById('altList').innerHTML = st.length ? '<b class="small">Offerings, strongest first</b> <span class="small muted">(each adds less; power before rounding)</span><ol>' + st.slice(0, 30).map(function (s) { var o = s.o;
      return '<li>' + (o.kind === 'gear' ? '🎒 ' + esc(o.label) : esc(o.name) + ' <span class="muted">#' + o.id + '</span> · ' + TL[o.tier] + (o.ripe ? ' · 🍂 ripe' : '')) + ' <b>+' + s.add + '</b>' + (o.kind === 'pet' ? ' <button type="button" class="linkish" data-back="' + o.id + '" aria-label="Take back #' + o.id + '">↩</button>' : '') + '</li>'; }).join('') + '</ol>' + (st.length > 30 ? '<p class="small muted">…and ' + (st.length - 30) + ' more, each adding less.</p>' : '') : '<p class="small muted">The altar is bare. Offer a pet to wake the candles.</p>';
    document.getElementById('altRise').disabled = !A.offered.length; }
  function renderAll(first) { renderTiles(); renderPower(!first); }
  function toast(s) { var t = document.getElementById('altToast'); if (!t) return; t.textContent = s; t.classList.remove('go'); void t.offsetWidth; t.classList.add('go'); }

  /* ---------------------------------------------------------------- actions ---------------------------------------------------------------- */
  function offer(id, from, force) { if (A.rise) A.rise = null; var p = A.mine.filter(function (q) { return q.id === id; })[0]; if (!p || p.myth || isOn(id)) return false;
    if (p.worn.length && !force) { A.ask = id; renderTiles(); return false; } A.ask = null;
    var before = project(A.base, ordered()).exact, o = { kind: 'pet', id: p.id, name: p.name, tier: p.tier, ripe: p.ripe, worn: p.worn, seq: ++A.seq }; A.offered.push(o); o.add = dec(project(A.base, ordered()).exact - before);
    SFX.offer(p.tier); fly(o, from); renderAll(); return true; }
  function takeBack(id) { A.offered = A.offered.filter(function (o) { return o.id !== id; }); A.tally = Math.max(0, A.tally - 1); SFX.back(); renderAll(); kick(); }
  function bind(el) { var R = A.ctx.R;
    el.querySelector('#altX').onclick = close;
    el.querySelector('#altHw').onclick = function () { A.hw = !A.hw; this.setAttribute('aria-pressed', A.hw); this.textContent = '🎃 Halloween boost: ' + (A.hw ? 'on' : 'off'); document.getElementById('altHwB').hidden = !A.hw; renderPower(true); kick(); };
    el.querySelector('#altSnd').onclick = function () { A.sound = !A.sound; try { localStorage.setItem('xcpets-cem-sfx', A.sound ? 'on' : 'off'); } catch (e) {} this.textContent = A.sound ? '🔊' : '🔇'; this.setAttribute('aria-pressed', A.sound); if (A.sound) SFX.offer(1); };
    el.querySelector('#altClr').onclick = function () { A.offered = []; A.gear = [0, 0, 0, 0]; A.tally = 0; A.rise = null; A.lastMile = -1; [0, 1, 2, 3].forEach(function (i) { document.getElementById('altG' + i).textContent = 0; }); SFX.back(); renderAll(); kick(); };
    el.querySelector('#altMore').onclick = function () { A.shown += PAGE; renderTiles(); };
    el.querySelector('#altQuick').onclick = function () { var n = 0, L = A.mine.filter(function (p) { return p.ripe && !p.myth && p.tier === 0 && !p.worn.length && !isOn(p.id); }); L.slice(0, 5).forEach(function (p, i) { setTimeout(function () { offer(p.id); }, i * (reduced() ? 0 : 140)); n++; }); if (!n) toast('No more ripe Commons'); };
    el.querySelector('.alt-filt').onclick = function (e) { var b = e.target.closest('[data-f]'); if (!b) return; A.filt = b.getAttribute('data-f'); A.shown = PAGE; this.querySelectorAll('[data-f]').forEach(function (q) { q.setAttribute('aria-pressed', q === b); }); renderTiles(); };
    el.querySelector('.alt-gr').onclick = function (e) { var b = e.target.closest('[data-g]'); if (!b) return; var t = +b.getAttribute('data-g'), d = +b.getAttribute('data-d'), n = Math.max(0, Math.min(A.stash[t], A.gear[t] + d)); if (n === A.gear[t]) return;
      A.gear[t] = n; document.getElementById('altG' + t).textContent = n; if (d > 0) { A.flares[(A.tally++) % 4] = 1; SFX.offer(t); A.fx.push({ k: 'pop', x: SPOT.x, y: SPOT.y - 14, t: 0, d: 700, s: '🎒' }); for (var i = 0; i < 14; i++) A.fx.push({ k: 'smoke', x: SPOT.x + (Math.random() * 14 - 7), y: SPOT.y - 4, vx: Math.random() * 0.5 - 0.25, vy: -(0.3 + Math.random() * 0.5), t: 0, d: 600, c: '#c9ffb0', z: 1 }); } else { A.tally = Math.max(0, A.tally - 1); SFX.back(); }
      renderPower(true); kick(); };
    el.querySelector('#altList').onclick = function (e) { var b = e.target.closest('[data-back]'); if (b) takeBack(+b.getAttribute('data-back')); };
    var tiles = el.querySelector('#altTiles');
    tiles.addEventListener('click', function (e) { var y = e.target.closest('[data-yes]'), n = e.target.closest('[data-no]'); if (y) { e.preventDefault(); offer(+y.getAttribute('data-yes'), null, true); return; } if (n) { e.preventDefault(); A.ask = null; renderTiles(); return; } });
    tiles.addEventListener('change', function (e) { var cb = e.target; if (!cb.matches('input[type=checkbox]')) return; var id = +cb.getAttribute('data-id'); if (cb.checked) { if (!offer(id)) cb.checked = false; } else takeBack(id); });
    /* drag a pet's picture onto the altar (pointer events, works with touch on the picture itself) */
    tiles.addEventListener('pointerdown', function (e) { var c = e.target.closest('canvas.alt-sp'); if (!c) return; var t = c.closest('.alt-tile'); if (!t || t.classList.contains('myth') || t.classList.contains('on')) return;
      var id = +t.getAttribute('data-id'), sx = e.clientX, sy = e.clientY, ghost = null, moved = false; c.setPointerCapture && c.setPointerCapture(e.pointerId); e.preventDefault();
      function mv(ev) { if (!moved && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 6) return; if (!moved) { moved = true; ghost = document.createElement('canvas'); ghost.width = ghost.height = 32; ghost.className = 'alt-ghost'; ghost.getContext('2d').drawImage(c, 0, 0); document.body.appendChild(ghost); el.classList.add('dragging'); }
        ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px'; var r = A.cv.getBoundingClientRect(); el.classList.toggle('over', ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom); }
      function up(ev) { c.removeEventListener('pointermove', mv); c.removeEventListener('pointerup', up); c.removeEventListener('pointercancel', up); el.classList.remove('dragging'); var over = el.classList.contains('over'); el.classList.remove('over'); if (ghost) ghost.remove();
        if (!moved) { if (ev.type === 'pointerup') { if (!offer(id)) return; } return; }
        if (over) { var r = A.cv.getBoundingClientRect(); offer(id, { x: (ev.clientX - r.left) * AW / r.width, y: (ev.clientY - r.top) * AH / r.height }); } }
      c.addEventListener('pointermove', mv); c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up); });
    tiles.addEventListener('click', function (e) { if (e.target.closest('canvas.alt-sp')) e.preventDefault(); }, true);
    el.querySelector('#altRise').onclick = function () { if (!A.offered.length) return; A.rise = { t: 0 }; SFX.rise(); toast('…the ground stirs…'); if (reduced()) { A.rise.t = 3000; } kick(); var rc = document.getElementById('altRisen'); if (rc) rc.remove(); };
    A.cv.addEventListener('click', function () { if (!A.offered.length) toast('Tap a pet below, or drag it here'); }); }
  function risenCard() { var P = project(A.base, ordered()), mi = -1; MILES.forEach(function (m, i) { if (P.total >= Math.floor(P.base * m[0])) mi = i; }); var wrap = A.cv && A.cv.parentNode; if (!wrap) return;
    var d = document.createElement('div'); d.className = 'alt-risen'; d.id = 'altRisen'; d.innerHTML = '<b class="meme">RISEN!</b><span>' + esc(A.grave.name) + ' the ' + (mi >= 0 && mi < MILES.length - 1 ? MILES[mi][1] : mi === MILES.length - 1 ? 'Dread (maxed)' : 'Zombie') + ' · ⚡ ' + P.total + '</span><small>preview only, nothing burned</small>'; wrap.appendChild(d);
    setTimeout(function () { if (d.isConnected) d.classList.add('out'); }, 3800); setTimeout(function () { if (d.isConnected) d.remove(); }, 4300); }
  window.V2CemeteryAltar = { open: open, close: close, project: project, HW: HW, setHalloween: function (on) { A.hw = !!on; }, PET: PET, GEAR: GEAR, RIPE: RIPE, _state: function () { return A; }, _offer: offer };
})();
