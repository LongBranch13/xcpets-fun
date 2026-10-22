/* XCPETS X Circus Kekimus entrance spectacle (DRAFT 2026-10-19, owner 7:09/7:10 PM CT; battle-arena branch, NOT LIVE). Pure UI/animation, no rule change.
 * 8-bit scene: back wall carved "All XCP becomes spectacle", stands with a crowd, sand track, an arched vomitorium tunnel, and in the centre the
 * CHAMPION STATUE: the living pet with the longest current unbeaten win streak (off-chain, from replayed fights; ties -> the pet that reached
 * that streak first; dead/released pets lose it; no wins yet -> empty plinth "Awaiting a champion").
 * sequence(f): both pets march out of the tunnel, the fight (same rounds/hits/HP data) plays on the sand, then the winner runs a victory lap.
 * prefers-reduced-motion: static scene; a fight shows its final result in the scene (no march, fight motion or lap). No pop-up. */
(function () {
  'use strict';
  var W = 320, H = 180, CX = 160, CY = 128, RX = 132, RY = 36, TUN = { x: 22, y: 74 };
  var RM = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function reduced() { return !!RM.matches || !!window.__arenaReducedMotion; }
  /** champion(w) -> { p, streak, block } | null. Current unbeaten streak = consecutive wins since the pet's last loss (fights in chain order). */
  function champion(w) { var st = {}, best = null;
    (w.fights || []).filter(function (f) { return f.status === 'done'; }).sort(function (a, b) { return a.acceptBlock - b.acceptBlock || a.id - b.id; }).forEach(function (f) {
      var a = st[f.winner] = st[f.winner] || { n: 0, at: null }, l = st[f.loser] = st[f.loser] || { n: 0, at: null }; a.n++; a.at = f.acceptBlock; a.fid = f.id; l.n = 0; l.at = null; });
    Object.keys(st).forEach(function (id) { var s = st[id], p = w.byId[id]; if (!p || p.dead || p.released || p.community || !s.n) return;
      if (!best || s.n > best.streak || (s.n === best.streak && (s.at < best.block || (s.at === best.block && s.fid < best.fid)))) best = { p: p, streak: s.n, block: s.at, fid: s.fid }; });
    return best; }
  /* sprite without its card background: render on a key colour (same trick as the hunger look) and key it out in toCanvas */
  function frames(p, w) { try { var mp = Object.assign({}, p, { blackEye: !!p.blackEye, art: Object.assign({}, p.art, { background: 'keyed', bgColor: '#ff00fe', pattern: 'none' }) }); return window.V2Render.petFrames(mp, w, { noHunger: true }); } catch (e) { return null; } }
  /* arena-injury: the key is the flat #ff00fe plus pet-core's ground shadow on it (mix(key, black, 0.4) = #990098). The arena frames use the
   * non-swappable 'keyed' background so V2Bg never repaints the key as a stripe/dot pattern (the magenta stripes around #4409 in fight #6). */
  function isKey(D, j) { return D[j + 1] === 0 && ((D[j] === 255 && D[j + 2] === 254) || (D[j] === 153 && D[j + 2] === 152)); }
  function toCanvas(img, tint) { var c = document.createElement('canvas'); c.width = c.height = 32; if (!img) return c; var d = new ImageData(new Uint8ClampedArray(img.data), 32, 32);
    for (var j = 0; j < d.data.length; j += 4) if (isKey(d.data, j)) d.data[j + 3] = 0;
    if (tint) for (var i = 0; i < d.data.length; i += 4) { if (!d.data[i + 3]) continue; var g = 0.3 * d.data[i] + 0.59 * d.data[i + 1] + 0.11 * d.data[i + 2], side = ((i / 4) % 32) < 14 ? 22 : ((i / 4) % 32) > 19 ? -18 : 0, v = Math.max(40, Math.min(235, 62 + g * 0.62 + side));
      /* arena-sharp-text: carved stone (cool grey), lit on the left, shaded on the right, so it reads as a statue and not a live pet */ d.data[i] = v; d.data[i + 1] = v; d.data[i + 2] = Math.min(255, v + 10); }
    c.getContext('2d').putImageData(d, 0, 0); return c; }
  /* arena-sharp-text: a black silhouette of the statue for a 1px outline against the sand */
  function silhouette(src) { var c = document.createElement('canvas'); c.width = c.height = 32; var x = c.getContext('2d'); x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#0a0812'; x.fillRect(0, 0, 32, 32); return c; }
  /* arena-sharp-text (owner 9:31/9:32 PM CT, everything looked blurry): the 320x180 scene used to be a 320x180 bitmap stretched by CSS to the page width
   * (996 px at 1280 = 3.11x, 286 px on a 390 phone = 0.89x), so pixels came out uneven and the 4-6 px canvas text smeared. Now the backing store is
   * 320*k x 180*k with an integer k >= CSS width * devicePixelRatio / 320 and everything draws in the same 320x180 units through setTransform(k): sprites stay
   * hard-edged (smoothing off), text is rasterised at full device resolution. */
  function fit() { var c = S.c; if (!c) return; S.k = window.V2Sharp.fit(c, W, H); } /* scene-sharp: shared helper js/v2-sharp.js (same math as arena-sharp-text) */
  var S = { c: null, x: null, w: null, champ: null, statue: null, crowd: null, raf: 0, t0: 0, mode: 'idle', actors: [], label: '', wall: null };
  function rnd(i) { var x = Math.sin(i * 12.9898) * 43758.5453; return x - Math.floor(x); }
  function bg(t) { var x = S.x; x.setTransform(S.k || 1, 0, 0, S.k || 1, 0, 0); x.imageSmoothingEnabled = false; S.tNow = t;
    x.fillStyle = '#120e22'; x.fillRect(0, 0, W, H);
    if (S.wall) x.drawImage(S.wall, 0, 0); /* 1:1 now (was a 168x24 wall stretched to 320x26) */ else { x.fillStyle = '#2a2238'; x.fillRect(0, 0, W, 26); }
    for (var r = 0; r < 4; r++) { var y = 28 + r * 11; x.fillStyle = r % 2 ? '#3a2f55' : '#43376a'; x.fillRect(0, y, W, 11); x.fillStyle = '#2b2346'; x.fillRect(0, y + 9, W, 2);
      for (var k = 0; k < 40; k++) { var cx = k * 8 + (r % 2) * 4 + 2, seed = r * 100 + k, jump = S.mode === 'lap' || S.mode === 'win' ? 2 : 1, cm = S.mode === 'fight' && window.V2ArenaFun ? V2ArenaFun.crowd(S.mood, t, r, k, rnd(seed)) : null, bob = cm != null ? cm : (Math.floor(t / 180 + rnd(seed) * 6) % 4 === 0) ? jump : 0; /* tonight bundle: crowd follows the mood meter */
        if (cx > TUN.x - 14 && cx < TUN.x + 18 && r >= 2) continue;
        x.fillStyle = ['#ffd166', '#ff7a1a', '#3ddc84', '#9fe8ff', '#ff5d5d', '#e8f5ec'][Math.floor(rnd(seed + 7) * 6)]; x.fillRect(cx, y + 3 - bob, 4, 5); x.fillStyle = '#f2c79b'; x.fillRect(cx + 1, y + 1 - bob, 2, 2); } }
    x.fillStyle = '#0a0812'; x.fillRect(TUN.x - 12, 50, 28, 28); x.fillRect(TUN.x - 9, 47, 22, 3); x.fillRect(TUN.x - 6, 45, 16, 2); /* vomitorium arch */
    x.fillStyle = '#6b5a8f'; x.fillRect(TUN.x - 14, 46, 2, 32); x.fillRect(TUN.x + 16, 46, 2, 32); x.fillRect(TUN.x - 10, 44, 24, 2);
    /* cartoon Roman touches: marble columns, red-and-gold pennants that flap, a laurel arch over the tunnel */
    [6, 70, 250, 314].forEach(function (cx0) { x.fillStyle = '#e9e1cf'; x.fillRect(cx0 - 3, 2, 6, 24); x.fillStyle = '#bfb49c'; x.fillRect(cx0 - 1, 4, 1, 20); x.fillRect(cx0 + 1, 4, 1, 20); x.fillStyle = '#f5efe0'; x.fillRect(cx0 - 5, 0, 10, 3); x.fillRect(cx0 - 5, 24, 10, 2); });
    for (var pn = 0; pn < 6; pn++) { var px0 = 28 + pn * 52, fl = Math.floor(t / 250 + pn) % 2; x.fillStyle = '#7a5a2a'; x.fillRect(px0, 26, 1, 8); x.fillStyle = pn % 2 ? '#c8102e' : '#ffd166'; x.fillRect(px0 + 1, 26, 7 + fl, 3); x.fillRect(px0 + 1, 29, 4 + fl, 2); }
    x.fillStyle = '#3ddc84'; for (var lf = 0; lf < 7; lf++) { x.fillRect(TUN.x - 10 + lf * 3, 42 - (lf === 3 ? 1 : 0), 2, 2); }
    x.fillStyle = '#5a4428'; x.fillRect(0, 72, W, H - 72);
    x.fillStyle = '#c9a36b'; for (var yy = 78; yy < H - 2; yy++) { var dy = (yy - CY) / (RY + 12), half = Math.sqrt(Math.max(0, 1 - dy * dy)) * (RX + 14); x.fillRect(Math.round(CX - half), yy, Math.round(half * 2), 1); }
    x.fillStyle = '#7a8a4a'; for (yy = 104; yy < 154; yy++) { dy = (yy - CY) / (RY - 12); half = Math.sqrt(Math.max(0, 1 - dy * dy)) * (RX - 34); if (half > 0) x.fillRect(Math.round(CX - half), yy, Math.round(half * 2), 1); }
    plinth(); }
  /* arena-sharp-text (owner 9:31 PM CT): the champion statue reads as a statue: stepped stone pedestal (lit top/left, shaded right), a carved stone pet with
   * a dark outline, a gold nameplate, and two small torches. Same data as before (champion = longest current streak; belt at 3+ wins; empty plinth otherwise). */
  /* arena-case-path (owner 9:47 PM CT): nameplate text fits the 62px gold plate with >= 1px padding: 5px, else 4px (min), else the name is cut with an ellipsis. Integer x/y. */
  var PLATE_IN = 60;
  function plateText(x, name, tail, y) { var sz = 5, f = function (n) { x.font = n + 'px "Press Start 2P", monospace'; }, wd = function (t) { return Math.ceil(x.measureText(t).width); };
    f(sz); if (wd(name + tail) > PLATE_IN) { sz = 4; f(sz); }
    var t = name + tail; if (wd(t) > PLATE_IN) { var n = name; while (n.length > 1 && wd(n + '…' + tail) > PLATE_IN) n = n.slice(0, -1); t = n + '…' + tail; }
    x.textAlign = 'left'; x.fillStyle = '#3a2a10'; x.fillText(t, Math.round(CX - wd(t) / 2), y); x.textAlign = 'center'; }
  /* bugpass-fixes 2026-10-19: front-page thumbnail only (mount opt {thumb:true}). When the card shows the 320px scene SMALLER than 1 art px per
   * device px (desktop DPR 1, ~194 px wide) the 4-5 px plate lines can't be sharp at any integer scale, so the plate shows ONE bigger line
   * (#ID, or OPEN with no champion). play.html never passes thumb, so the real arena is unchanged. */
  function small() { if (!S.thumb || !S.c) return false; var r = S.c.getBoundingClientRect(); return r.width > 0 && r.width * (window.devicePixelRatio || 1) < W - 0.5; }
  function bigPlate(x, t, y) { var sz = 8; x.font = sz + 'px "Press Start 2P", monospace'; while (sz > 5 && x.measureText(t).width > PLATE_IN) { sz--; x.font = sz + 'px "Press Start 2P", monospace'; }
    x.textAlign = 'left'; x.fillStyle = '#3a2a10'; x.fillText(t, Math.round(CX - Math.ceil(x.measureText(t).width) / 2), y); x.textAlign = 'center'; }
  function plinth() { var x = S.x, t = S.tNow || 0, fl = reduced() ? 0 : Math.floor(t / 160) % 3, top = 100; /* sits higher than the old plinth so the fighters' HP bars stay clear */
    function r(c, a, b, w, h) { x.fillStyle = c; x.fillRect(a, b, w, h); }
    r('#0a0812', CX - 39, top + 25, 78, 6); r('#0a0812', CX - 35, top - 1, 70, 27); /* outline */
    r('#8d8aa0', CX - 34, top, 68, 3); r('#6e6a84', CX - 34, top + 3, 68, 18); r('#a9a6bb', CX - 34, top + 3, 2, 18); r('#4d4962', CX + 32, top + 3, 2, 18); r('#57536c', CX - 34, top + 21, 68, 4); /* die */
    r('#6e6a84', CX - 38, top + 26, 76, 4); r('#a9a6bb', CX - 38, top + 26, 76, 1); r('#3e3a52', CX - 38, top + 29, 76, 1); /* base step */
    r('#3a2a10', CX - 32, top + 5, 64, 16); r('#ffd166', CX - 31, top + 6, 62, 14); /* gold nameplate */
    [CX - 44, CX + 42].forEach(function (tx, n) { r('#0a0812', tx - 1, top + 6, 4, 25); r('#7a5a2a', tx, top + 8, 2, 22); r('#3a2a10', tx - 1, top + 6, 4, 2); var f2 = (fl + n) % 3; r('rgba(255,170,60,.18)', tx - 4, top - 3, 10, 10); r('#ff7a1a', tx - 1, top + 1 - f2 % 2, 4, 5); r('#ffd166', tx, top + 2, 2, 3 - (f2 === 2 ? 1 : 0)); }); /* torches */
    x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    if (S.champ) { if (S.statueSil) { [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(function (o) { x.drawImage(S.statueSil, CX - 16 + o[0], top - 32 + o[1], 32, 32); }); } x.drawImage(S.statue, CX - 16, top - 32, 32, 32);
      x.fillStyle = '#3ddc84'; for (var lv = 0; lv < 5; lv++) { x.fillRect(CX - 7 + lv * 3, top - 23 + (lv === 2 ? -1 : 0), 2, 2); } /* laurel */
      if (small()) bigPlate(x, '#' + S.champ.p.id, top + 17); else { plateText(x, String(S.champ.p.name || 'Pet'), ' #' + S.champ.p.id, top + 12); plateText(x, S.champ.streak + ' WIN STREAK', '', top + 18); } if (S.champ.streak >= 3 && window.V2ArenaFun) V2ArenaFun.belt(x, CX, top - 6); }
    else if (small()) bigPlate(x, 'OPEN', top + 17); else { plateText(x, 'AWAITING', '', top + 12); plateText(x, 'A CHAMPION', '', top + 18); }
    x.textAlign = 'left'; if (window.V2ArenaFun) V2ArenaFun.beltCase(x, !(S.champ && S.champ.streak >= 3)); }
  function actor(a, t) { var x = S.x, bob = Math.floor(t / 120) % 2; x.save(); if (a.flip) { x.translate(Math.round(a.x) + 12, 0); x.scale(-1, 1); x.drawImage(a.img[Math.floor(t / 150) % a.img.length], -12, Math.round(a.y) - 24 - bob, 24, 24); } else x.drawImage(a.img[Math.floor(t / 150) % a.img.length], Math.round(a.x) - 12, Math.round(a.y) - 24 - bob, 24, 24); x.restore(); }
  function caption(s) { if (!s) return; var x = S.x; x.font = '7px "Press Start 2P", monospace'; x.textAlign = 'center'; x.fillStyle = '#000'; x.fillText(s, CX + 1, 171); x.fillStyle = '#ffd166'; x.fillText(s, CX, 170); x.textAlign = 'left'; }
  function frame(now) { if (!S.x) return; var t = now - S.t0; bg(now);
    if (S.mode === 'walk') { var k = Math.min(1, t / 2600); S.actors.forEach(function (a, i) { var tx = i ? CX + 40 : CX - 40, ty = 166; var e = k < .4 ? k / .4 : 1; a.x = TUN.x + (tx - TUN.x) * (k < .4 ? 0.25 * e : 0.25 + 0.75 * (k - .4) / .6) - (i ? 10 * (1 - k) : 0); a.y = 80 + (ty - 80) * Math.min(1, k * 1.6); a.flip = i === 1 && k > .95; actor(a, now); if (window.V2FightTag) V2FightTag.canvas(S.x, a.p, (S.actors[1 - i] || {}).p, Math.round(a.x), Math.round(a.y) - 30); }); /* fight-owner-labels */
      caption('#' + S.actors[0].p.id + '  VS  #' + S.actors[1].p.id); if (k >= 1 && S.onWalk) { var cb = S.onWalk; S.onWalk = null; setTimeout(cb, 250); } }
    else if (S.mode === 'fight') fightFrame(now);
    else if (S.mode === 'result') resultFrame();
    else if (S.mode === 'lap') { var a = S.actors[0], ang = Math.PI / 2 + Math.min(1, t / 4200) * Math.PI * 2; a.x = CX + Math.cos(ang) * (RX - 6); a.y = CY + Math.sin(ang) * RY + 10; a.flip = Math.sin(ang) > 0; actor(a, now); if (S.f && window.V2ArenaFun && V2ArenaFun.info(S.w, S.f).beltOn) V2ArenaFun.belt(S.x, Math.round(a.x), Math.round(a.y));
      caption('VICTORY LAP · #' + a.p.id); if (t > 4200) { S.mode = 'win'; S.t0 = now; } }
    else if (S.mode === 'win') { a = S.actors[0]; a.x = CX; a.y = 168; actor(a, now); if (S.f && window.V2ArenaFun && V2ArenaFun.info(S.w, S.f).beltOn) V2ArenaFun.belt(S.x, CX, 168); caption('WINNER #' + a.p.id); if (t > 2500) { S.mode = 'idle'; S.actors = []; var more = Q.length; nextQ(); if (!more) done(); } }
    else caption(S.label);
    annFrame(now);
    if (!reduced() && (S.mode !== 'idle' || isVisible())) S.raf = requestAnimationFrame(frame); else { S.raf = 0; } }
  /* announcer captions + RIVALRY banner (owner 7:36/7:38 PM CT). Big caption over the lower stands; the same lines on replays (seeded by fight id). */
  function annLine(now) { var A = S.ann || [], t = now - S.t0, m = S.mode, by = function (k) { return A.filter(function (x) { return x.at === k; }); };
    if (m === 'walk') { var I = by('intro'); return I.length ? I[Math.min(I.length - 1, Math.floor(t / 1500))] : null; }
    if (m === 'fight') { var ti = Math.floor(Math.floor(t / TICK) / 4), c = A.filter(function (x) { return typeof x.at === 'number' && x.at <= ti; }); if (S.f && ti >= S.f.turns.length) return by('end')[0] || c[c.length - 1]; return c[c.length - 1] || by('intro').slice(-1)[0]; }
    /* announcer-fix: lap and win share one clock (S.endT0, set when the lap starts) so the end lines keep counting forward. Before, the win step reset
     * S.t0 and the index restarted at end line 1, re-showing (and re-speaking) the last lines 2-4 times. */
    if (m === 'lap' || m === 'win') { var E = by('end'), te = now - (S.endT0 || S.t0); return E.length ? E[Math.min(E.length - 1, 1 + Math.floor(te / 1700))] : null; }
    if (m === 'result') return by('end')[0]; return null; }
  function wrap(x, s, max) { var w = s.split(' '), L = [], cur = ''; w.forEach(function (q) { var t = cur ? cur + ' ' + q : q; if (x.measureText(t).width > max && cur) { L.push(cur); cur = q; } else cur = t; }); if (cur) L.push(cur); return L.slice(0, 2); }
  function annFrame(now) { var x = S.x; if (!x || S.mode === 'idle') return;
    if (S.rv && S.mode !== 'lap' && S.mode !== 'win') { var bw = 132, bx = CX - bw / 2, by = 3; x.fillStyle = '#000'; x.fillRect(bx + 2, by + 2, bw, 13); x.fillStyle = '#c8102e'; x.fillRect(bx, by, bw, 13); x.fillStyle = '#ffd166'; x.fillRect(bx, by, bw, 2); x.fillRect(bx, by + 11, bw, 2);
      x.font = '7px "Press Start 2P", monospace'; x.textAlign = 'center'; x.fillStyle = '#fff'; x.fillText('RIVALRY ' + S.rv.wa + '-' + S.rv.wb, CX, by + 10); x.textAlign = 'left'; }
    var ln = annLine(now); if (!ln) return; x.font = '8px "Press Start 2P", monospace'; var L = wrap(x, ln.text.toUpperCase(), 296), y0 = 60;
    x.textAlign = 'center'; L.forEach(function (s, i) { var y = y0 + i * 11; x.fillStyle = 'rgba(0,0,0,.55)'; var mw = Math.ceil(x.measureText(s).width); x.fillRect(CX - Math.ceil(mw / 2) - 4, y - 9, mw + 8, 12); x.fillStyle = '#000'; x.fillText(s, CX + 1, y + 1); x.fillStyle = '#fff6c8'; x.fillText(s, CX, y); }); x.textAlign = 'left';
    /* announcer-fix: each script line is spoken at most once per playback (S.annSpoken), even when the caption comes back to it. */
    if (S.annSaid !== ln) { S.annSaid = ln; S.annNow = ln.text; var li = (S.ann || []).indexOf(ln); if (!S.annSpoken) S.annSpoken = {}; if (li < 0 || !S.annSpoken[li]) { S.annSpoken[li] = 1; if (window.V2Announcer) V2Announcer.speak(ln.text, { end: ln.at === 'end' }); } } }
  function isVisible() { if (!S.c || !S.c.getBoundingClientRect) return false; var r = S.c.getBoundingClientRect(); return r.bottom > 0 && r.top < (window.innerHeight || 800); }
  function kick() { if (!S.raf) S.raf = requestAnimationFrame(frame); }
  /** mount(canvas, w): (re)build the scene for world w */
  function mount(c, w, opt) { if (!c) return; S.thumb = !!(opt && opt.thumb); var champ = champion(w), key = champ ? champ.p.id + ':' + champ.streak : '-';
    S.c = c; S.x = c.getContext('2d'); S.w = w; if (S.key !== key) { S.key = key; S.champ = champ; S.statue = champ ? toCanvas((frames(champ.p, w) || [])[0], true) : null; S.statueSil = S.statue ? silhouette(S.statue) : null; }
    fit(); if (!mount.rs) { mount.rs = 1; var rz = function () { var k0 = S.k; fit(); if (S.k !== k0) { if (reduced() || !S.raf) frame(performance.now()); } }; window.addEventListener('resize', rz); if (window.matchMedia) { try { window.matchMedia('(resolution: ' + (window.devicePixelRatio || 1) + 'dppx)').addEventListener('change', rz); } catch (e) { } } }
    if (!S.wall && window.V2Sponsor && V2Sponsor.wall) { S.wall = document.createElement('canvas'); S.wall.width = W; S.wall.height = 26; V2Sponsor.wall(S.wall, V2Sponsor.WALL_TEXT); }
    S.label = 'X CIRCUS KEKIMUS'; if (reduced()) frame(performance.now()); else { if (!mount.io && window.IntersectionObserver) { mount.io = new IntersectionObserver(function () { kick(); }); } if (mount.io && mount.io._c !== c) { mount.io.observe(c); mount.io._c = c; } kick(); } }
  /** sequence(f): march-out -> the fight itself animated on the sand (same f.turns: rounds, hits, dodges, crits, HP) -> victory lap. No pop-up.
   * Reduced motion: a static result in the scene (both pets, final HP bars, winner, spoils). Busy scene: the next fight waits its turn. */
  var Q = [];
  function mk(p, w, be) { var mp = Object.assign({}, p, { blackEye: !!be }); return (frames(mp, w) || []).map(function (i) { return toCanvas(i); }); }
  function sequence(f, o) { var U = window.V2UI, w = U && U.world(); if (!f || !f.turns || !w) return; var A = w.byId[f.a], B = w.byId[f.b]; if (!A || !B || !S.x) return;
    if (o && o.restart) { Q.length = 0; cancelAnimationFrame(S.raf); S.raf = 0; S.mode = 'idle'; if (window.speechSynthesis) try { speechSynthesis.cancel(); } catch (e) { } } /* arena-replay: manual Replay restarts, never queues */
    if (S.mode !== 'idle' && S.mode !== 'result') { Q.push(f); return; }
    if (window.V2ArenaReplay) try { V2ArenaReplay.onShow(f); } catch (e) { }
    if (o && o.auto) watchToast(f); else showMe(); /* flow-fixes (2026-10-22): automatic replays never move the page; a toast offers ▶ Watch */
    S.f = f; S.koT = 0; S.hitT = 0; S.evT = null; S.gbT = null; S.mood = null; S.hp = { a: f.maxA, b: f.maxB }; S.fx = []; S.ann = window.V2Announcer ? V2Announcer.script(f, w) : []; S.annSaid = null; S.annSpoken = {}; S.endT0 = 0; if (window.V2Announcer && V2Announcer.reset) V2Announcer.reset(); S.rv = window.V2Rivals ? V2Rivals.rivalryFor(w, f) : null;
    S.actors = [{ p: A, img: mk(A, w), lose: mk(A, w, true), side: 'a' }, { p: B, img: mk(B, w), lose: mk(B, w, true), side: 'b' }];
    if (reduced()) { S.mode = 'result'; S.hp = { a: f.turns.length ? f.turns[f.turns.length - 1].hpA : f.maxA, b: f.turns.length ? f.turns[f.turns.length - 1].hpB : f.maxB }; S.t0 = performance.now(); frame(S.t0); setTimeout(done, 2500); return; }
    S.mode = 'walk'; S.t0 = performance.now(); kick(); var tok = S.seq = (S.seq || 0) + 1;
    S.onWalk = function () { if (S.seq !== tok || S.mode !== 'walk') return; S.mode = 'fight'; S.t0 = performance.now(); kick(); }; }
  function inView() { var r = S.c.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight; }
  function showMe() { var y0 = window.scrollY; if (S.c.scrollIntoView) S.c.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' }); setTimeout(function () { var U = window.V2UI; if (U && U.toast && Math.abs(window.scrollY - y0) > 600) U.toast('<a href="#" data-arback="' + Math.round(y0) + '">↩ Back to where I was</a>', 15000); }, 1200); }
  function watchToast(f) { var U = window.V2UI; if (!U || !U.toast || inView()) return; U.toast('⚔️ Fight ' + f.id + ' is playing in X Circus Kekimus · <a href="#" data-arwatch="' + f.id + '">▶ Watch</a>', 15000); }
  if (typeof document !== 'undefined') document.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('[data-arwatch],[data-arback]'); if (!a) return; e.preventDefault(); var t = a.closest('.toast');
    if (a.hasAttribute('data-arback')) { window.scrollTo({ top: +a.getAttribute('data-arback'), behavior: 'instant' }); if (t) t.remove(); return; }
    var U = window.V2UI, w = U && U.world(), f = w && w.fights[a.getAttribute('data-arwatch') - 1]; if (t) t.remove(); if (!f) return; if (S.f && S.f.id === f.id && S.mode !== 'idle' && S.mode !== 'result') showMe(); else sequence(f, { restart: true }); });
  function done() { if (!Q.length && window.V2AnimDone) window.V2AnimDone(); }
  function nextQ() { var f = Q.shift(); if (f) setTimeout(function () { sequence(f); }, 400); }
  var TICK = 260; /* announcer-fix: 220 -> 260 ms (display pacing only; turns, hits and winner come from f.turns unchanged), so a round lasts ~1.0 s, about one short announcer line at the faster voice. 4 ticks per turn (lunge on tick 1) */
  function hpBar(x, cx, y, v, max, col) { px(x, '#000', cx - 17, y - 1, 34, 5); px(x, '#2a3a2e', cx - 16, y, 32, 3); px(x, col, cx - 16, y, Math.max(0, Math.round(32 * v / max)), 3); }
  function px(x, c, a, b, w, h) { x.fillStyle = c; x.fillRect(a, b, w, h); }
  function fightFrame(now) { var x = S.x, f = S.f, t = Math.max(0, now - S.t0) /* rAF time can be a hair before t0: no turn -1 */, k = Math.floor(t / TICK), ti = Math.floor(k / 4), ph = k % 4, n = f.turns.length, done = ti >= n;
    var L = S.actors[0], R = S.actors[1], la = CX - 40, ra = CX + 40, y = 166;
    if (!done) { var cur = f.turns[ti]; if (ph >= 1 && S.fxT !== ti) { S.fxT = ti; S.hp = { a: cur.hpA, b: cur.hpB }; var tgt = cur.by === 'a' ? ra : la;
        S.fx.push({ s: cur.dodge ? 'MISS' : '-' + cur.dmg + (cur.crit ? '!' : ''), c: cur.dodge ? '#9fe8ff' : cur.crit ? '#ffd166' : '#ff5d5d', x: tgt, y: y - 30, t: now });  if (!cur.dodge) { var big = cur.crit || cur.dmg >= topDmg(f); if (window.V2Sfx) V2Sfx.punch(big); if (big && !reduced()) { S.hitT = now; shake(); } } }
      var lun = ph === 1 ? 14 : 0; L.x = la + (cur.by === 'a' ? lun : 0); R.x = ra - (cur.by === 'b' ? lun : 0); }
    else { L.x = la; R.x = ra; }
    L.y = R.y = y; L.flip = false; R.flip = true; var loserA = done && f.loser === L.p.id, loserB = done && f.loser === R.p.id;
    actor(loserA ? { x: L.x, y: L.y, img: L.lose, flip: false } : L, now); actor(loserB ? { x: R.x, y: R.y, img: R.lose, flip: true } : R, now);
    hpBar(x, la, y - 34, S.hp.a, f.maxA, '#3ddc84'); hpBar(x, ra, y - 34, S.hp.b, f.maxB, '#3ddc84');
    x.font = '6px "Press Start 2P", monospace'; x.textAlign = 'center';
    S.fx = S.fx.filter(function (e) { var age = now - e.t; if (age > 900) return false; x.fillStyle = '#000'; var ey = Math.round(e.y - age / 40); x.fillText(e.s, e.x + 1, ey + 1); x.fillStyle = e.c; x.fillText(e.s, e.x, ey); return true; });
    x.textAlign = 'left';
    if (!done) caption('ROUND ' + (ti + 1) + '/' + n + ' · #' + (f.turns[ti].by === 'a' ? f.a : f.b) + ' ' + String(f.turns[ti].weapon || '').slice(0, 12).toUpperCase());
    if (S.hitT && now - S.hitT < 90 && !reduced()) { x.fillStyle = 'rgba(255,255,255,.75)'; x.fillRect(0, 0, W, H); } /* white hit flash on big hits */
    if (window.V2ArenaFun) V2ArenaFun.overlay(S, x, now, Math.min(ti, n - 1), done, reduced());
    if (done) { if (!S.koT) { S.koT = now; if (window.V2Sfx) V2Sfx.roar(); } ko(x, now - S.koT); /* arena-replay fix: the end-of-fight -> lap step sat in the not-done branch, so a fight never finished and every later replay just queued */
      caption('WINNER #' + f.winner + (f.spoils ? ' +' + String(f.spoils.label || f.spoils).slice(0, 14).toUpperCase() : '')); if (t > (n * 4 + 8) * TICK) { var Wn = f.winner === L.p.id ? L : R; S.actors = [{ p: Wn.p, img: Wn.img }]; S.mode = 'lap'; S.t0 = now; S.endT0 = now; } } }
  /* quick wins (2026-10-19): big hit = a crit or the fight's top damage -> white flash + screen shake; K.O.! stamp at the end; none of the motion with reduced motion */
  function topDmg(f) { if (f._top == null) f._top = Math.max.apply(null, (f.turns || []).map(function (q) { return q.dodge ? 0 : q.dmg || 0; }).concat([1])); return f._top; }
  function shake() { var c = S.c; if (!c || !c.animate || reduced()) return; c.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(-4px,2px)' }, { transform: 'translate(4px,-2px)' }, { transform: 'translate(-3px,-1px)' }, { transform: 'translate(2px,1px)' }, { transform: 'translate(0,0)' }], { duration: 260, easing: 'steps(5)' }); }
  function ko(x, age) { var k = reduced() ? 1 : Math.min(1, age / 220), sz = Math.round(10 + 14 * k); x.save(); x.textAlign = 'center'; x.font = sz + 'px "Press Start 2P", monospace';
    var cy = 96; x.translate(CX, cy); x.rotate(-0.12); x.fillStyle = '#000'; x.fillText('K.O.!', 3, 3); x.fillStyle = '#c8102e'; x.fillText('K.O.!', 1, 1); x.fillStyle = '#ffd166'; x.fillText('K.O.!', 0, 0); x.restore(); x.textAlign = 'left'; }
  function resultFrame() { var f = S.f, L = S.actors[0], R = S.actors[1], y = 166; L.x = CX - 40; R.x = CX + 40; L.y = R.y = y;
    actor(f.loser === L.p.id ? { x: L.x, y: y, img: L.lose, flip: false } : L, 0); actor(f.loser === R.p.id ? { x: R.x, y: y, img: R.lose, flip: true } : Object.assign(R, { flip: true }), 0);
    hpBar(S.x, L.x, y - 34, S.hp.a, f.maxA, '#3ddc84'); hpBar(S.x, R.x, y - 34, S.hp.b, f.maxB, '#3ddc84');
    if (window.V2ArenaFun) V2ArenaFun.overlay(S, S.x, 0, f.turns.length - 1, true, true);
    ko(S.x, 9999);
    caption('WINNER #' + f.winner + ' · ' + f.turns.length + ' ROUNDS' + (f.spoils ? ' · +' + String(f.spoils.label || f.spoils).slice(0, 12).toUpperCase() : '')); }
  /* test hooks for previews: force a phase at time t (ms) */
  function _pose(mode, f, t) { var w = S.w, A = w.byId[f.a], B = w.byId[f.b], Wn = w.byId[f.winner]; cancelAnimationFrame(S.raf); S.raf = 0;
    S.actors = mode === 'walk' ? [{ p: A, img: frames(A, w).map(function (i) { return toCanvas(i); }) }, { p: B, img: frames(B, w).map(function (i) { return toCanvas(i); }) }] : mode === 'idle' ? [] : [{ p: Wn, img: frames(Wn, w).map(function (i) { return toCanvas(i); }) }];
    if (mode === 'fight' || mode === 'result') { S.f = f; S.koT = 0; S.hitT = 0; S.evT = null; S.gbT = null; S.fx = []; S.fxT = -1; S.actors = [{ p: A, img: mk(A, w), lose: mk(A, w, true) }, { p: B, img: mk(B, w), lose: mk(B, w, true) }]; var kk = Math.floor(t / TICK), ti2 = Math.min(f.turns.length, Math.floor(kk / 4)) - 1; S.hp = ti2 >= 0 ? { a: f.turns[ti2].hpA, b: f.turns[ti2].hpB } : { a: f.maxA, b: f.maxB }; }
    S.ann = window.V2Announcer ? V2Announcer.script(f, w) : []; S.rv = window.V2Rivals ? V2Rivals.rivalryFor(w, f) : null; S.mode = mode; var now = performance.now(); S.t0 = now - t; S.onWalk = null; var keep = window.__arenaReducedMotion; window.__arenaReducedMotion = true; frame(now); window.__arenaReducedMotion = keep; }
  window.V2ArenaScene = { mount: mount, sequence: sequence, champion: champion, _pose: _pose, _state: function () { return S; } };
})();
