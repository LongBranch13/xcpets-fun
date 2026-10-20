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
  function frames(p, w) { try { var mp = Object.assign({}, p, { blackEye: false, art: Object.assign({}, p.art, { background: 'solid', bgColor: '#ff00fe', pattern: 'none' }) }); return window.V2Render.petFrames(mp, w, { noHunger: true }); } catch (e) { return null; } }
  function toCanvas(img, tint) { var c = document.createElement('canvas'); c.width = c.height = 32; if (!img) return c; var d = new ImageData(new Uint8ClampedArray(img.data), 32, 32);
    for (var j = 0; j < d.data.length; j += 4) if (d.data[j] === 255 && d.data[j + 1] === 0 && d.data[j + 2] === 254) d.data[j + 3] = 0;
    if (tint) for (var i = 0; i < d.data.length; i += 4) { if (!d.data[i + 3]) continue; var g = 0.3 * d.data[i] + 0.59 * d.data[i + 1] + 0.11 * d.data[i + 2]; d.data[i] = Math.min(255, 70 + g * 0.75); d.data[i + 1] = Math.min(255, 52 + g * 0.55); d.data[i + 2] = Math.min(255, 30 + g * 0.3); }
    c.getContext('2d').putImageData(d, 0, 0); return c; }
  var S = { c: null, x: null, w: null, champ: null, statue: null, crowd: null, raf: 0, t0: 0, mode: 'idle', actors: [], label: '', wall: null };
  function rnd(i) { var x = Math.sin(i * 12.9898) * 43758.5453; return x - Math.floor(x); }
  function bg(t) { var x = S.x; x.imageSmoothingEnabled = false;
    x.fillStyle = '#120e22'; x.fillRect(0, 0, W, H);
    if (S.wall) x.drawImage(S.wall, 0, 0, W, 26); else { x.fillStyle = '#2a2238'; x.fillRect(0, 0, W, 26); }
    for (var r = 0; r < 4; r++) { var y = 28 + r * 11; x.fillStyle = r % 2 ? '#3a2f55' : '#43376a'; x.fillRect(0, y, W, 11); x.fillStyle = '#2b2346'; x.fillRect(0, y + 9, W, 2);
      for (var k = 0; k < 40; k++) { var cx = k * 8 + (r % 2) * 4 + 2, seed = r * 100 + k, jump = S.mode === 'lap' || S.mode === 'win' ? 2 : 1, bob = (Math.floor(t / 180 + rnd(seed) * 6) % 4 === 0) ? jump : 0;
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
  function plinth() { var x = S.x, px = CX - 22, py = 118; x.fillStyle = '#4b4560'; x.fillRect(px, py, 44, 14); x.fillStyle = '#6d6788'; x.fillRect(px, py, 44, 2); x.fillStyle = '#3a3550'; x.fillRect(px - 3, py + 14, 50, 4);
    x.font = '5px "Press Start 2P", monospace'; x.textAlign = 'center'; x.fillStyle = '#ffd166';
    if (S.champ) { x.drawImage(S.statue, CX - 16, py - 32, 32, 32); x.fillStyle = '#3ddc84'; for (var lv = 0; lv < 5; lv++) { x.fillRect(CX - 7 + lv * 3, py - 23 + (lv === 2 ? -1 : 0), 2, 2); } x.fillStyle = '#ffd166'; x.fillText(String(S.champ.p.name || 'Pet').slice(0, 10) + ' #' + S.champ.p.id, CX, py + 7); x.fillStyle = '#e8f5ec'; x.fillText(S.champ.streak + ' WIN STREAK', CX, py + 13); }
    else { x.fillStyle = '#9fe8ff'; x.fillText('AWAITING', CX, py + 7); x.fillText('A CHAMPION', CX, py + 13); }
    x.textAlign = 'left'; }
  function actor(a, t) { var x = S.x, bob = Math.floor(t / 120) % 2; x.save(); if (a.flip) { x.translate(Math.round(a.x) + 12, 0); x.scale(-1, 1); x.drawImage(a.img[Math.floor(t / 150) % a.img.length], -12, Math.round(a.y) - 24 - bob, 24, 24); } else x.drawImage(a.img[Math.floor(t / 150) % a.img.length], Math.round(a.x) - 12, Math.round(a.y) - 24 - bob, 24, 24); x.restore(); }
  function caption(s) { if (!s) return; var x = S.x; x.font = '7px "Press Start 2P", monospace'; x.textAlign = 'center'; x.fillStyle = '#000'; x.fillText(s, CX + 1, 171); x.fillStyle = '#ffd166'; x.fillText(s, CX, 170); x.textAlign = 'left'; }
  function frame(now) { if (!S.x) return; var t = now - S.t0; bg(now);
    if (S.mode === 'walk') { var k = Math.min(1, t / 2600); S.actors.forEach(function (a, i) { var tx = i ? CX + 40 : CX - 40, ty = 166; var e = k < .4 ? k / .4 : 1; a.x = TUN.x + (tx - TUN.x) * (k < .4 ? 0.25 * e : 0.25 + 0.75 * (k - .4) / .6) - (i ? 10 * (1 - k) : 0); a.y = 80 + (ty - 80) * Math.min(1, k * 1.6); a.flip = i === 1 && k > .95; actor(a, now); });
      caption('#' + S.actors[0].p.id + '  VS  #' + S.actors[1].p.id); if (k >= 1 && S.onWalk) { var cb = S.onWalk; S.onWalk = null; setTimeout(cb, 250); } }
    else if (S.mode === 'fight') fightFrame(now);
    else if (S.mode === 'result') resultFrame();
    else if (S.mode === 'lap') { var a = S.actors[0], ang = Math.PI / 2 + Math.min(1, t / 4200) * Math.PI * 2; a.x = CX + Math.cos(ang) * (RX - 6); a.y = CY + Math.sin(ang) * RY + 10; a.flip = Math.sin(ang) > 0; actor(a, now);
      caption('VICTORY LAP · #' + a.p.id); if (t > 4200) { S.mode = 'win'; S.t0 = now; } }
    else if (S.mode === 'win') { a = S.actors[0]; a.x = CX; a.y = 168; actor(a, now); caption('WINNER #' + a.p.id); if (t > 2500) { S.mode = 'idle'; S.actors = []; nextQ(); } }
    else caption(S.label);
    if (!reduced() && (S.mode !== 'idle' || isVisible())) S.raf = requestAnimationFrame(frame); else { S.raf = 0; } }
  function isVisible() { if (!S.c || !S.c.getBoundingClientRect) return false; var r = S.c.getBoundingClientRect(); return r.bottom > 0 && r.top < (window.innerHeight || 800); }
  function kick() { if (!S.raf) S.raf = requestAnimationFrame(frame); }
  /** mount(canvas, w): (re)build the scene for world w */
  function mount(c, w) { if (!c) return; var champ = champion(w), key = champ ? champ.p.id + ':' + champ.streak : '-';
    S.c = c; S.x = c.getContext('2d'); S.w = w; if (S.key !== key) { S.key = key; S.champ = champ; S.statue = champ ? toCanvas((frames(champ.p, w) || [])[0], true) : null; }
    if (!S.wall && window.V2Sponsor && V2Sponsor.wall) { S.wall = document.createElement('canvas'); S.wall.width = 168; S.wall.height = 24; V2Sponsor.wall(S.wall, V2Sponsor.WALL_TEXT); }
    S.label = 'X CIRCUS KEKIMUS'; if (reduced()) frame(performance.now()); else { if (!mount.io && window.IntersectionObserver) { mount.io = new IntersectionObserver(function () { kick(); }); } if (mount.io && mount.io._c !== c) { mount.io.observe(c); mount.io._c = c; } kick(); } }
  /** sequence(f): march-out -> the fight itself animated on the sand (same f.turns: rounds, hits, dodges, crits, HP) -> victory lap. No pop-up.
   * Reduced motion: a static result in the scene (both pets, final HP bars, winner, spoils). Busy scene: the next fight waits its turn. */
  var Q = [];
  function mk(p, w, be) { var mp = Object.assign({}, p, { blackEye: !!be }); return (frames(mp, w) || []).map(function (i) { return toCanvas(i); }); }
  function sequence(f) { var U = window.V2UI, w = U && U.world(); if (!f || !f.turns || !w) return; var A = w.byId[f.a], B = w.byId[f.b]; if (!A || !B || !S.x) return;
    if (S.mode !== 'idle' && S.mode !== 'result') { Q.push(f); return; }
    if (S.c.scrollIntoView) S.c.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' });
    S.f = f; S.hp = { a: f.maxA, b: f.maxB }; S.fx = [];
    S.actors = [{ p: A, img: mk(A, w), lose: mk(A, w, true), side: 'a' }, { p: B, img: mk(B, w), lose: mk(B, w, true), side: 'b' }];
    if (reduced()) { S.mode = 'result'; S.hp = { a: f.turns.length ? f.turns[f.turns.length - 1].hpA : f.maxA, b: f.turns.length ? f.turns[f.turns.length - 1].hpB : f.maxB }; S.t0 = performance.now(); frame(S.t0); return; }
    S.mode = 'walk'; S.t0 = performance.now(); kick();
    S.onWalk = function () { S.mode = 'fight'; S.t0 = performance.now(); kick(); }; }
  function nextQ() { var f = Q.shift(); if (f) setTimeout(function () { sequence(f); }, 400); }
  var TICK = 220; /* same pace as the old pop-up: 4 ticks per turn (lunge on tick 1) */
  function hpBar(x, cx, y, v, max, col) { px(x, '#000', cx - 17, y - 1, 34, 5); px(x, '#2a3a2e', cx - 16, y, 32, 3); px(x, col, cx - 16, y, Math.max(0, Math.round(32 * v / max)), 3); }
  function px(x, c, a, b, w, h) { x.fillStyle = c; x.fillRect(a, b, w, h); }
  function fightFrame(now) { var x = S.x, f = S.f, t = now - S.t0, k = Math.floor(t / TICK), ti = Math.floor(k / 4), ph = k % 4, n = f.turns.length, done = ti >= n;
    var L = S.actors[0], R = S.actors[1], la = CX - 40, ra = CX + 40, y = 166;
    if (!done) { var cur = f.turns[ti]; if (ph >= 1 && S.fxT !== ti) { S.fxT = ti; S.hp = { a: cur.hpA, b: cur.hpB }; var tgt = cur.by === 'a' ? ra : la;
        S.fx.push({ s: cur.dodge ? 'MISS' : '-' + cur.dmg + (cur.crit ? '!' : ''), c: cur.dodge ? '#9fe8ff' : cur.crit ? '#ffd166' : '#ff5d5d', x: tgt, y: y - 30, t: now }); }
      var lun = ph === 1 ? 14 : 0; L.x = la + (cur.by === 'a' ? lun : 0); R.x = ra - (cur.by === 'b' ? lun : 0); }
    else { L.x = la; R.x = ra; }
    L.y = R.y = y; L.flip = false; R.flip = true; var loserA = done && f.loser === L.p.id, loserB = done && f.loser === R.p.id;
    actor(loserA ? { x: L.x, y: L.y, img: L.lose, flip: false } : L, now); actor(loserB ? { x: R.x, y: R.y, img: R.lose, flip: true } : R, now);
    hpBar(x, la, y - 34, S.hp.a, f.maxA, '#3ddc84'); hpBar(x, ra, y - 34, S.hp.b, f.maxB, '#3ddc84');
    x.font = '6px "Press Start 2P", monospace'; x.textAlign = 'center';
    S.fx = S.fx.filter(function (e) { var age = now - e.t; if (age > 900) return false; x.fillStyle = '#000'; x.fillText(e.s, e.x + 1, e.y - age / 40 + 1); x.fillStyle = e.c; x.fillText(e.s, e.x, e.y - age / 40); return true; });
    x.textAlign = 'left';
    if (!done) caption('ROUND ' + (ti + 1) + '/' + n + ' · #' + (f.turns[ti].by === 'a' ? f.a : f.b) + ' ' + String(f.turns[ti].weapon || '').slice(0, 12).toUpperCase());
    else { caption('WINNER #' + f.winner + (f.spoils ? ' +' + String(f.spoils.label || f.spoils).slice(0, 14).toUpperCase() : '')); if (t > (n * 4 + 8) * TICK) { var Wn = f.winner === L.p.id ? L : R; S.actors = [{ p: Wn.p, img: Wn.img }]; S.mode = 'lap'; S.t0 = now; } } }
  function resultFrame() { var f = S.f, L = S.actors[0], R = S.actors[1], y = 166; L.x = CX - 40; R.x = CX + 40; L.y = R.y = y;
    actor(f.loser === L.p.id ? { x: L.x, y: y, img: L.lose, flip: false } : L, 0); actor(f.loser === R.p.id ? { x: R.x, y: y, img: R.lose, flip: true } : Object.assign(R, { flip: true }), 0);
    hpBar(S.x, L.x, y - 34, S.hp.a, f.maxA, '#3ddc84'); hpBar(S.x, R.x, y - 34, S.hp.b, f.maxB, '#3ddc84');
    caption('WINNER #' + f.winner + ' · ' + f.turns.length + ' ROUNDS' + (f.spoils ? ' · +' + String(f.spoils.label || f.spoils).slice(0, 12).toUpperCase() : '')); }
  /* test hooks for previews: force a phase at time t (ms) */
  function _pose(mode, f, t) { var w = S.w, A = w.byId[f.a], B = w.byId[f.b], Wn = w.byId[f.winner]; cancelAnimationFrame(S.raf); S.raf = 0;
    S.actors = mode === 'walk' ? [{ p: A, img: frames(A, w).map(function (i) { return toCanvas(i); }) }, { p: B, img: frames(B, w).map(function (i) { return toCanvas(i); }) }] : mode === 'idle' ? [] : [{ p: Wn, img: frames(Wn, w).map(function (i) { return toCanvas(i); }) }];
    if (mode === 'fight' || mode === 'result') { S.f = f; S.fx = []; S.fxT = -1; S.actors = [{ p: A, img: mk(A, w), lose: mk(A, w, true) }, { p: B, img: mk(B, w), lose: mk(B, w, true) }]; var kk = Math.floor(t / TICK), ti2 = Math.min(f.turns.length, Math.floor(kk / 4)) - 1; S.hp = ti2 >= 0 ? { a: f.turns[ti2].hpA, b: f.turns[ti2].hpB } : { a: f.maxA, b: f.maxB }; }
    S.mode = mode; var now = performance.now(); S.t0 = now - t; S.onWalk = null; var keep = window.__arenaReducedMotion; window.__arenaReducedMotion = true; frame(now); window.__arenaReducedMotion = keep; }
  window.V2ArenaScene = { mount: mount, sequence: sequence, champion: champion, _pose: _pose, _state: function () { return S; } };
})();
