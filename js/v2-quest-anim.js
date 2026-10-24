/* Mythic quests: 8-bit WAY OUT / WAY IN animations (2026-10-24, branch mythic-quests; only reachable once ACTIVATE_QUEST_BLOCK is set).
 * One 96x64 pixel scene, scaled by a whole number with image-rendering: pixelated, stepped at 8 frames a second (no tweening), ~2.6 s.
 * Tap / click / any key skips. prefers-reduced-motion: one static key frame. The pet itself is its normal 32x32 pixel sprite.
 *   V2QuestAnim.out({ code, pet, w, done })            pet hops into the quest portal, puff of pixel dust
 *   V2QuestAnim.home({ code, pet, w, tier, egg, ambush, done })  pet pops out, chest bounces open (haul gold burst / loot sparkle /
 *                                                        empty shrug + badge) or a Jackpot Egg wobbles then cracks
 * Display only: never touches rules, burns or replay. */
(function () {
  var W = 96, H = 64, FPS = 8, N = 21;
  var PAL = { spam: ['#ff3cac', '#27e1ff', '#fff36b', '#7a1dff'], cold: ['#c9d6e3', '#7d8ea3', '#ffffff', '#3b4a5c'], kek: ['#2f9e44', '#8ce99a', '#d3f9d8', '#1b4d2a'],
    wiz: ['#a64dff', '#e0b3ff', '#ffe066', '#3d1466'], mine: ['#8a5a2b', '#ffd43b', '#ff922b', '#2b1a0e'] };
  var TXT = { spam: 'Into the spam-mail swirl!', cold: 'Through the vault door!', kek: 'Bloop! Into the swamp bubble!', wiz: 'Into the spell circle!', mine: 'Down the mine tunnel!' };
  var TIERS = { haul: 'Legendary Haul!', loot: 'Solid Loot!', empty: 'Came Home Empty…' };
  function reduced() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function css() { if (document.getElementById('qaCss')) return; var s = document.createElement('style'); s.id = 'qaCss';
    s.textContent = '.qa-ov{position:fixed;inset:0;z-index:100000;background:rgba(16,8,24,.86);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;cursor:pointer;padding:12px;box-sizing:border-box}' +
      '.qa-ov canvas{image-rendering:pixelated;image-rendering:crisp-edges;border:4px solid #000;box-shadow:4px 4px 0 #000;background:#1a1028;max-width:100%}' +
      '.qa-cap{font-family:inherit;color:#ffc93c;font-size:18px;text-align:center;text-shadow:2px 2px 0 #000;max-width:92vw}.qa-skip{color:#cbb;font-size:12px}' +
      '@keyframes qaFlip{0%{transform:rotateY(90deg)}50%{transform:rotateY(45deg)}100%{transform:rotateY(0)}}.qa-flip{animation:qaFlip .5s steps(3) both}' +
      '@media (prefers-reduced-motion:reduce){.qa-flip{animation:none}}';
    document.head.appendChild(s); }
  function sprite(pet, w) { try { var kp = Object.assign({}, pet, { art: Object.assign({}, pet.art, { background: 'solid', bgColor: '#ff00fe', pattern: 'none' }) }), f = window.V2Render.petFrames(kp, w)[0]; /* magenta key, like the look FX: transparent background */ if (!f || !f.data || f.data.length !== 4096) return null;
      var d = Uint8ClampedArray.from(f.data); for (var i = 0; i < d.length; i += 4) if (d[i] === 255 && d[i + 1] === 0 && d[i + 2] === 254) d[i + 3] = 0;
      var c = document.createElement('canvas'); c.width = c.height = 32; c.getContext('2d').putImageData(new ImageData(d, 32, 32), 0, 0); return c; } catch (e) { return null; } }
  /* ---- tiny pixel helpers on the 96x64 scene ---- */
  function px(g, x, y, c, s) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), s || 1, s || 1); }
  function ring(g, cx, cy, r, c, ry, step, phase) { ry = ry || r; var n = Math.max(8, Math.round(r * 6)); for (var i = 0; i < n; i++) { if (step && ((i + (phase || 0)) % step)) continue; var a = i / n * Math.PI * 2; px(g, cx + Math.cos(a) * r, cy + Math.sin(a) * ry, c); } }
  function disc(g, cx, cy, r, c, ry) { ry = ry || r; for (var y = -ry; y <= ry; y++) for (var x = -r; x <= r; x++) if ((x * x) / (r * r || 1) + (y * y) / (ry * ry || 1) <= 1) px(g, cx + x, cy + y, c); }
  function rnd(seed) { var s = seed >>> 0 || 1; return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1000) / 1000; }; }
  /* portal at (cx,cy), open 0..1 in steps, f = frame (animates the swirl) */
  function portal(g, code, cx, cy, open, f) { if (open <= 0) return; var P = PAL[code] || PAL.spam, R = Math.max(1, Math.round(14 * open));
    if (code === 'spam') { disc(g, cx, cy, R, P[3]); for (var k = 0; k < 4; k++) ring(g, cx, cy, Math.max(1, R - k * 3), P[(k + f) % 3], null, 3, f + k); /* envelopes */
      for (var e = 0; e < 3; e++) { var a = (f * 0.7 + e * 2.1), ex = cx + Math.cos(a) * R * 0.6, ey = cy + Math.sin(a) * R * 0.6; if (open > 0.6) { g.fillStyle = '#fff'; g.fillRect(Math.round(ex) - 2, Math.round(ey) - 1, 5, 3); px(g, ex, ey, P[0]); } } }
    else if (code === 'cold') { disc(g, cx, cy, R, P[3]); ring(g, cx, cy, R, P[0]); ring(g, cx, cy, R - 1, P[1]); for (var s = 0; s < 6; s++) { var b = s / 6 * Math.PI * 2 + f * 0.26; for (var t = 2; t < R - 2; t++) px(g, cx + Math.cos(b) * t, cy + Math.sin(b) * t, P[1]); }
      disc(g, cx, cy, Math.max(1, Math.round(R / 4)), P[0]); var sn = rnd(77 + f); for (var q = 0; q < 14; q++) px(g, sn() * W, (sn() * H + f * 3) % H, '#fff'); }
    else if (code === 'kek') { disc(g, cx, cy, R, P[0]); ring(g, cx, cy, R, P[3]); disc(g, cx - Math.round(R / 3), cy - Math.round(R / 3), Math.max(1, Math.round(R / 4)), P[2]);
      for (var u = 0; u < 4; u++) { var by = cy + R - ((f * 3 + u * 7) % (R * 2 + 6)); ring(g, cx - 8 + u * 5, by, 1, P[1]); } g.fillStyle = P[3]; g.fillRect(cx - R - 4, cy + R, 2 * R + 9, 2); }
    else if (code === 'wiz') { var ry = Math.max(1, Math.round(R / 3)), gy = cy + 10; ring(g, cx, gy, R, P[0], ry); ring(g, cx, gy, Math.max(1, R - 3), P[1], Math.max(1, ry - 1), 2, f);
      for (var r2 = 0; r2 < 6; r2++) { var c2 = r2 / 6 * Math.PI * 2 + f * 0.4; px(g, cx + Math.cos(c2) * (R - 1), gy + Math.sin(c2) * ry, P[2], 2); }
      for (var z = 0; z < 5; z++) if ((f + z) % 3 === 0) px(g, cx - R + z * (R / 2), gy - 4 - ((f * 2 + z * 5) % 18), P[1]); }
    else { /* mine: tunnel arch + cart */ g.fillStyle = P[3]; for (var y = -R; y <= R; y++) for (var x = -R; x <= R; x++) if (y > 0 || x * x + y * y <= R * R) px(g, cx + x, cy + y, P[3]);
      ring(g, cx, cy, R, P[0]); g.fillStyle = P[0]; g.fillRect(cx - R, cy, 2, R + 1); g.fillRect(cx + R - 1, cy, 2, R + 1);
      if (open >= 1) { var cxx = cx - 6 + (f % 2); g.fillStyle = '#555'; g.fillRect(cxx, cy + R - 6, 12, 5); px(g, cxx + 2, cy + R - 1, '#222', 2); px(g, cxx + 8, cy + R - 1, '#222', 2);
        g.fillStyle = (f % 2) ? P[1] : P[2]; g.fillRect(cxx + 1, cy + R - 8, 10, 2); } disc(g, cx, cy - R + 3, 1, (f % 2) ? P[1] : P[2]); } }
  function dust(g, cx, cy, k) { var r = rnd(9); for (var i = 0; i < 16; i++) { var a = r() * 6.28, d = k * (2 + r() * 3); px(g, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.6, ['#e9d8a6', '#c8b07a', '#fff'][i % 3], k < 3 ? 2 : 1); } }
  function chest(g, x, y, open, gold) { g.fillStyle = '#6b3d1c'; g.fillRect(x, y, 16, 10); g.fillStyle = '#ffd43b'; g.fillRect(x + 7, y + 3, 2, 3);
    g.fillStyle = '#8a5a2b'; if (open) { g.fillRect(x, y - 7, 16, 3); g.fillStyle = gold ? '#ffd43b' : '#fff3bf'; g.fillRect(x + 2, y - 2, 12, 2); } else g.fillRect(x, y - 4, 16, 4);
    g.fillStyle = '#000'; g.fillRect(x, y + 10, 16, 1); }
  function burst(g, cx, cy, k, big) { var rays = big ? 12 : 6, len = (big ? 4 : 2) + k * (big ? 3 : 2); for (var i = 0; i < rays; i++) { var a = i / rays * 6.28 + (k % 2) * 0.2;
      for (var t = 3; t < len; t += 2) px(g, cx + Math.cos(a) * t, cy + Math.sin(a) * t, big ? (t % 4 ? '#ffd43b' : '#fff') : '#e0f7ff'); }
    if (big) { var r = rnd(31 + k); for (var j = 0; j < 10; j++) px(g, cx + (r() - 0.5) * 50, cy + (r() - 0.5) * 34, j % 2 ? '#fff' : '#ffe066', 2); } }
  function egg(g, x, y, tilt, crack) { var o = tilt; disc(g, x + o, y, 6, '#fff4d6', 8); ring(g, x + o, y, 6, '#000', 8); px(g, x + o - 2, y - 2, '#ff6bcb', 2); px(g, x + o + 2, y + 2, '#27e1ff', 2);
    if (crack) { for (var i = -5; i <= 5; i++) px(g, x + o + i, y + ((i % 2) ? -1 : 1), '#000'); if (crack > 1) { g.fillStyle = '#1a1028'; g.fillRect(x + o - 6, y - 9, 13, 8); burst(g, x + o, y - 4, crack, true); } } }
  function badge(g, code, x, y) { try { var im = window.V2Quests && V2Quests.badgeCanvas && V2Quests.badgeCanvas(code); if (im) g.drawImage(im, x, y); } catch (e) {} }
  function ground(g) { g.fillStyle = '#2b1d3a'; g.fillRect(0, 52, W, 12); g.fillStyle = '#3d2a52'; for (var x = 0; x < W; x += 4) g.fillRect(x, 52, 2, 1); }
  /* frame painters */
  function outFrame(g, o, f, spr) { g.clearRect(0, 0, W, H); ground(g); var cx = 66, cy = 32, open = f < 4 ? (f + 1) / 4 : f > 16 ? Math.max(0, (20 - f) / 4) : 1;
    portal(g, o.code, cx, cy, open, f); var hop = [[6, 20], [6, 20], [6, 18], [6, 20], [14, 10], [24, 4], [34, 2], [44, 8], [52, 16], [58, 22]];
    if (f < 13) { var p = hop[Math.max(0, Math.min(9, f - 3))]; if (spr) g.drawImage(spr, p[0], p[1]); }
    else if (f < 17) { if (spr && f === 13) { g.drawImage(spr, 0, 0, 32, 32, 58, 26, 12, 12); } dust(g, cx, cy + 8, f - 12); } }
  function homeFrame(g, o, f, spr) { g.clearRect(0, 0, W, H); ground(g); var cx = 66, cy = 30, tier = o.tier || 'loot', open = f < 3 ? (f + 1) / 3 : f > 9 ? Math.max(0, (13 - f) / 4) : 1;
    portal(g, o.code, cx, cy, open, f); var pop = [[58, 22], [58, 12], [56, 6], [54, 10], [52, 20]];
    var shrug = tier === 'empty' && !o.egg && f >= 14 ? ((f % 2) ? -2 : 0) : 0;
    if (f >= 3) { var p = pop[Math.min(4, f - 3)]; if (spr) g.drawImage(spr, p[0], p[1] + shrug); }
    if (o.egg) { var tilt = f < 8 ? 0 : f < 15 ? [-2, 0, 2, 0][f % 4] : 0, cr = f < 15 ? 0 : f < 17 ? 1 : f - 15; egg(g, 20, 42, tilt, cr); }
    else { var bounce = f >= 8 && f < 13 ? [0, -4, 0, -2, 0][f - 8] : 0, opened = f >= 13; chest(g, 12, 42 + bounce, opened, tier === 'haul');
      if (opened) { if (tier === 'haul') burst(g, 20, 36, f - 12, true); else if (tier === 'loot') burst(g, 20, 36, Math.min(3, f - 12), false);
        else { g.fillStyle = '#fff'; g.fillRect(70, 14 + shrug, 2, 5); g.fillRect(72, 12 + shrug, 3, 2); g.fillRect(75, 14 + shrug, 2, 3); g.fillRect(72, 21 + shrug, 2, 2); badge(g, o.code, 8, 8); } } }
    if (o.ambush && f >= 14) badge(g, 'funtrump', 80, 4); }
  function play(kind, o) { css(); var ov = document.createElement('div'); ov.className = 'qa-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', kind === 'out' ? 'Gone Questing' : 'Homecoming');
    var sc = Math.max(2, Math.min(6, Math.floor(Math.min(window.innerWidth - 40, 576) / W))), c = document.createElement('canvas'); c.width = W; c.height = H; c.style.width = W * sc + 'px'; c.style.height = H * sc + 'px';
    var cap = document.createElement('div'); cap.className = 'qa-cap'; var skip = document.createElement('div'); skip.className = 'qa-skip'; skip.textContent = 'Tap to skip';
    ov.appendChild(c); ov.appendChild(cap); ov.appendChild(skip); document.body.appendChild(ov);
    var g = c.getContext('2d'); g.imageSmoothingEnabled = false; var spr = sprite(o.pet, o.w), paintF = kind === 'out' ? outFrame : homeFrame, f = 0, tm = null, ended = false;
    var name = o.pet ? '#' + o.pet.id + ' ' + (o.pet.name || '') : '';
    cap.textContent = kind === 'out' ? name + ' · ' + (TXT[o.code] || 'Off questing!') : name + ' is home! ' + (o.egg ? 'A Jackpot Egg!' : TIERS[o.tier] || '') + (o.ambush ? ' FUNTRUMP Ambush!' : '');
    function end() { if (ended) return; ended = true; clearInterval(tm); window.removeEventListener('keydown', end); ov.remove(); if (o.done) try { o.done(); } catch (e) {} }
    ov.addEventListener('click', end); window.addEventListener('keydown', end);
    if (reduced()) { paintF(g, o, kind === 'out' ? 15 : 18, spr); skip.textContent = 'Tap to close'; tm = setInterval(end, 2600); return { end: end, canvas: c }; }
    paintF(g, o, 0, spr); tm = setInterval(function () { f++; if (f > N) return end(); paintF(g, o, f, spr); }, 1000 / FPS);
    return { end: end, canvas: c, frame: function (k) { clearInterval(tm); paintF(g, o, k, spr); } }; }
  window.V2QuestAnim = { out: function (o) { return play('out', o); }, home: function (o) { return play('in', o); }, FRAMES: N + 1, FPS: FPS,
    _paint: function (c, kind, o, f) { var g = c.getContext('2d'); g.imageSmoothingEnabled = false; (kind === 'out' ? outFrame : homeFrame)(g, o, f, o.spr || sprite(o.pet, o.w)); } };
})();
