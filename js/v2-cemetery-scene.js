/* XCPETS Pet Cemetery scene (branch cemetery-scene, NOT LIVE; Oct 20 2026). Display only: no rule, burn or replay change.
 * Same build as the Lair / X Circus Kekimus / Gooby's motel: one 320x180 pixel canvas scaled by V2Sharp (integer k, crisp text), a hint bar under it,
 * tap a thing in the scene -> a small card under it (no pop-ups), RAF paused off screen, prefers-reduced-motion = one static frame.
 * Scene: night sky + moon, iron fence and gate with the PET CEMETERY arch, a winding path, the newest 12 graves as headstones (#ID carved, the pet's
 * ghost drawn faint above it), Mort the caretaker with a lantern, fog.
 * HALLOWEEN HOOKS (dormant, see ZOMBIE_SPEC.md / CEMETERY_REDESIGN.md): the SEANCE CIRCLE (6 unlit candles round a moon stone) and the OLD ALTAR at the
 * end of the path are drawn and tappable but do nothing. V2CemeteryScene.hooks(state) is the single switch a future event build would flip
 * ('off' today; 'lit' = candles + altar glow). Nothing calls it with anything but 'off'. No zombie mechanics, no spoiler copy. */
(function () {
  'use strict';
  var W = 320, H = 180, RM = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var S = { c: null, x: null, k: 1, raf: 0, off: false, w: null, graves: [], hits: [], sel: null, hov: null, ghosts: {}, line: 0, lt: 0, hook: 'off', total: 0 };
  var LINES = ['Evenin\u2019. Mind the mud.', 'Feed \u2019em daily. Spares me the shovel.', 'Seven days. That\u2019s all it takes.', 'I just keep the grass short.',
    'Every stone\u2019s a pet number.', 'Quiet tonight. Too quiet.', 'Lantern\u2019s for you, not them.', 'Rest in pixels, little ones.'];
  var SLOTS = [[30, 106], [62, 104], [96, 102], [224, 102], [256, 104], [288, 106], [72, 130], [110, 127], [210, 127], [246, 125], [112, 158], [206, 160]]; /* feet x,y; far rows smaller */
  var ALTAR = { x: 146, y: 74, w: 28, h: 20 }, SEANCE = { cx: 272, cy: 158, r: 20 }, MORT = { x: 24, y: 168 };
  function reduced() { return !!RM.matches || !!window.__cemReduced; }
  function px(x, c, a, b, w, h) { x.fillStyle = c; x.fillRect(a, b, w, h); }
  function rnd(i) { var v = Math.sin(i * 12.9898) * 43758.5453; return v - Math.floor(v); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function scale(y) { return y < 112 ? 0.7 : y < 140 ? 0.85 : 1; }
  /* ghost sprite: the pet's still frame, backdrop keyed out (corner colour, same trick as the motel), then grey-blue and see-through */
  function ghost(p) { if (S.ghosts[p.id]) return S.ghosts[p.id]; var c = document.createElement('canvas'); c.width = c.height = 32;
    try { var fr = window.V2Render.framesWith(Object.assign({}, p.art, { background: 'keyed', bgColor: '#ff00fe', pattern: 'none' }), p.stage, [])[0]; window.V2Render.paint(c, fr); var g = c.getContext('2d'), id = g.getImageData(0, 0, 32, 32), d = id.data;
      for (var q = 0; q < d.length; q += 4) { if (d[q + 1] < 8 && ((d[q] > 240 && d[q + 2] > 240) || (Math.abs(d[q] - 153) < 6 && Math.abs(d[q + 2] - 152) < 6))) { d[q + 3] = 0; continue; } /* key + its ground shadow (arena isKey) */
        var l = 0.3 * d[q] + 0.59 * d[q + 1] + 0.11 * d[q + 2]; d[q] = 150 + l * 0.35; d[q + 1] = 170 + l * 0.3; d[q + 2] = 215 + l * 0.15; }
      g.putImageData(id, 0, 0); } catch (e) { }
    if (Object.keys(S.ghosts).length > 60) S.ghosts = {}; return (S.ghosts[p.id] = c); }
  function sky(x, t) { var B = ['#0b0a1f', '#100e2a', '#151236', '#1a1640', '#201a4a']; for (var i = 0; i < 5; i++) px(x, B[i], 0, i * 14, W, 14);
    for (var s = 0; s < 46; s++) { var sx = Math.floor(rnd(s) * W), sy = Math.floor(rnd(s + 99) * 64), tw = reduced() ? 1 : (Math.floor(t / 700 + s) % 9 ? 1 : 0); if (tw) px(x, s % 7 ? '#8d89c9' : '#fff6d8', sx, sy, 1, 1); }
    px(x, '#fff1c4', 252, 14, 18, 18); px(x, '#fff1c4', 250, 17, 22, 12); px(x, '#fff1c4', 255, 12, 12, 22); px(x, '#e6d39a', 258, 18, 4, 3); px(x, '#e6d39a', 264, 25, 3, 3); px(x, '#e6d39a', 256, 27, 2, 2); /* moon */
    var cx = reduced() ? 0 : (t / 120) % (W + 80); px(x, '#2a2456', Math.round(cx) - 60, 30, 46, 4); px(x, '#2a2456', Math.round(cx) - 52, 27, 28, 3); px(x, '#2a2456', Math.round(cx * 0.6 + 140) % (W + 60) - 40, 46, 34, 3); }
  function land(x) { for (var i = 0; i < W; i += 2) { var h = 8 + Math.round(Math.sin(i / 23) * 4 + Math.sin(i / 9) * 2); px(x, '#131128', i, 70 - h, 2, h); }
    px(x, '#17261c', 0, 70, W, H - 70); for (var r = 0; r < 260; r++) px(x, r % 3 ? '#1f3324' : '#12201a', Math.floor(rnd(r + 7) * W), 72 + Math.floor(rnd(r + 31) * 108), 2, 1);
    /* winding path from the bottom to the altar */
    for (var y = H; y > 92; y -= 2) { var k = (H - y) / (H - 92), cx = 160 + Math.round(Math.sin(k * 3.4) * 22 * (1 - k)), w = Math.round(28 - k * 18); px(x, '#3e352c', cx - w / 2, y - 2, w, 2); if (y % 6 === 0) px(x, '#544838', cx - w / 4 + ((y * 7) % Math.max(1, w / 2)), y - 2, 2, 1); }
    /* bare trees */ tree(x, 8, 72); tree(x, 302, 74); tree(x, 186, 70, 1); }
  function tree(x, bx, by, small) { var h = small ? 16 : 26; px(x, '#0d0b18', bx, by - h, 3, h); px(x, '#0d0b18', bx - 6, by - h + 4, 6, 2); px(x, '#0d0b18', bx - 8, by - h + 1, 2, 4); px(x, '#0d0b18', bx + 3, by - h + 8, 7, 2); px(x, '#0d0b18', bx + 9, by - h + 4, 2, 5); px(x, '#0d0b18', bx - 3, by - h - 4, 2, 5); }
  function fence(x) { for (var i = 0; i < W; i += 6) { if (i > 132 && i < 188) continue; px(x, '#06050c', i, 76, 2, 14); px(x, '#06050c', i - 1, 75, 4, 2); } px(x, '#06050c', 0, 79, 132, 1); px(x, '#06050c', 188, 79, W - 188, 1); px(x, '#06050c', 0, 86, 132, 1); px(x, '#06050c', 188, 86, W - 188, 1);
    /* gate posts + arch sign */ px(x, '#2a2734', 128, 60, 6, 32); px(x, '#2a2734', 186, 60, 6, 32); px(x, '#06050c', 134, 58, 52, 2); for (var a = 0; a < 52; a += 2) px(x, '#06050c', 134 + a, 54 + Math.round(Math.abs(a - 26) / 6), 2, 2);
    px(x, '#000', 131, 43, 58, 11); px(x, '#3b2f4a', 132, 44, 56, 9); x.font = '5px "Press Start 2P", monospace'; x.textAlign = 'center'; x.fillStyle = '#000'; x.fillText('PET CEMETERY', 161, 51); x.fillStyle = '#d8d2ff'; x.fillText('PET CEMETERY', 160, 50); x.textAlign = 'left'; }
  function altar(x, t) { var A = ALTAR, lit = S.hook === 'lit', hv = S.hov === 'altar' || S.sel === 'altar';
    px(x, '#000', A.x - 1, A.y - 1, A.w + 2, A.h + 2); px(x, '#4a4656', A.x, A.y, A.w, A.h); px(x, '#5d596b', A.x, A.y, A.w, 3); px(x, '#3a3746', A.x + 3, A.y + 6, A.w - 6, A.h - 8);
    var g = lit ? (reduced() ? 1 : 0.6 + 0.4 * Math.sin(t / 300)) : 0; var rc = lit ? 'rgba(140,255,170,' + g.toFixed(2) + ')' : '#2a2834'; px(x, rc, A.x + 11, A.y + 7, 6, 1); px(x, rc, A.x + 11, A.y + 13, 6, 1); px(x, rc, A.x + 10, A.y + 8, 1, 5); px(x, rc, A.x + 17, A.y + 8, 1, 5); px(x, rc, A.x + 13, A.y + 10, 2, 1); /* carved rune, dark until the event lights it */
    if (hv) outline(x, A.x - 2, A.y - 2, A.w + 4, A.h + 4); S.hits.push({ x: A.x - 2, y: A.y - 2, w: A.w + 4, h: A.h + 4, k: 'altar' }); }
  function seance(x, t) { var C = SEANCE, lit = S.hook === 'lit', hv = S.hov === 'seance' || S.sel === 'seance';
    for (var a = 0; a < 40; a++) { var an = a / 40 * Math.PI * 2; px(x, '#2b2a3a', Math.round(C.cx + Math.cos(an) * C.r), Math.round(C.cy + Math.sin(an) * C.r * 0.42), 2, 1); }
    px(x, '#000', C.cx - 8, C.cy - 3, 16, 7); px(x, '#56526a', C.cx - 7, C.cy - 2, 14, 5); px(x, '#cfc9ff', C.cx - 2, C.cy - 1, 3, 3); px(x, '#56526a', C.cx - 1, C.cy - 1, 2, 2); /* moon stone */
    for (var i = 0; i < 6; i++) { var b = i / 6 * Math.PI * 2 + 0.3, cx = Math.round(C.cx + Math.cos(b) * C.r), cy = Math.round(C.cy + Math.sin(b) * C.r * 0.42);
      px(x, '#000', cx - 2, cy - 7, 5, 8); px(x, '#e8e0c8', cx - 1, cy - 6, 3, 6); px(x, '#333', cx, cy - 8, 1, 2);
      if (lit) { var f = reduced() ? 0 : Math.floor(t / 140 + i) % 2; px(x, '#ffd166', cx - (f ? 1 : 0), cy - 11, 2, 3); px(x, '#fff3b0', cx, cy - 10, 1, 1); } }
    if (hv) outline(x, C.cx - C.r - 4, C.cy - 14, C.r * 2 + 8, 24); S.hits.push({ x: C.cx - C.r - 4, y: C.cy - 14, w: C.r * 2 + 8, h: 24, k: 'seance' }); }
  function outline(x, a, b, w, h) { x.strokeStyle = '#ffc93c'; x.lineWidth = 1; x.strokeRect(a + 0.5, b + 0.5, w - 1, h - 1); }
  function stone(x, g, t, i) { var s = scale(g.y), w = Math.round(30 * s), h = Math.round(26 * s), sx = Math.round(g.x - w / 2), sy = g.y - h, p = g.p, hv = p && (S.hov === p || S.sel === p);
    if (!p) { px(x, '#2c2219', sx - 1, g.y - 3, w + 2, 4); px(x, '#3a2d20', sx + 1, g.y - 5, w - 2, 3); return; } /* an empty plot (dirt mound) */
    px(x, '#000', sx - 1, sy + 3, w + 2, h - 2); px(x, '#000', sx + 2, sy - 1, w - 4, 5); px(x, '#6a6e78', sx, sy + 3, w, h - 3); px(x, '#6a6e78', sx + 3, sy, w - 6, 4); px(x, '#80848e', sx + 1, sy + 3, 2, h - 4); px(x, '#4c4f57', sx + w - 2, sy + 3, 2, h - 4);
    px(x, '#2a2d33', sx - 2, g.y - 1, w + 4, 2); x.font = '4px "Press Start 2P", monospace'; x.textAlign = 'center'; x.fillStyle = '#2b2d33'; x.fillText('RIP', g.x, sy + Math.round(10 * s)); x.fillText((s < 0.8 ? '' : '#') + p.id, g.x, sy + Math.round(19 * s)); x.textAlign = 'left';
    if (p.dead && window.V2Render && window.V2Render.graveCount && window.V2Render.graveCount(S.w, p)) px(x, '#ffd166', sx + w - 4, sy + h - 6, 2, 2); /* buried with gear: a glint */
    var gz = Math.round(22 * s), bob = reduced() ? 0 : Math.round(Math.sin(t / 600 + i) * 2); x.save(); x.globalAlpha = hv ? 0.85 : 0.45; x.drawImage(ghost(p), Math.round(g.x - gz / 2), sy - gz + 2 + bob, gz, gz); x.restore();
    if (hv) outline(x, sx - 3, sy - gz, w + 6, h + gz + 2); S.hits.push({ x: sx - 3, y: sy - gz, w: w + 6, h: h + gz + 2, p: p }); }
  function mort(x, t) { var m = MORT, sw = reduced() ? 0 : Math.round(Math.sin(t / 500)), hv = S.hov === 'mort' || S.sel === 'mort';
    px(x, '#000', m.x - 5, m.y - 26, 12, 27); px(x, '#3a3046', m.x - 4, m.y - 16, 10, 15); px(x, '#c9a27a', m.x - 3, m.y - 23, 8, 7); px(x, '#000', m.x - 1, m.y - 20, 1, 1); px(x, '#000', m.x + 3, m.y - 20, 1, 1); px(x, '#8c8c96', m.x - 3, m.y - 17, 8, 2);
    px(x, '#1c1824', m.x - 5, m.y - 26, 12, 3); px(x, '#1c1824', m.x - 3, m.y - 29, 8, 3); px(x, '#2a2232', m.x - 4, m.y - 1, 4, 2); px(x, '#2a2232', m.x + 2, m.y - 1, 4, 2); /* hat, boots */
    var lx = m.x + 9, ly = m.y - 12 + sw; px(x, '#000', lx - 1, ly - 1, 6, 8); px(x, '#ffd166', lx, ly + 1, 4, 5); px(x, '#fff3b0', lx + 1, ly + 2, 2, 2); x.save(); x.globalAlpha = 0.08; px(x, '#ffd166', lx - 3, ly - 3, 10, 12); x.restore();
    if (hv) outline(x, m.x - 7, m.y - 31, 22, 33); S.hits.push({ x: m.x - 7, y: m.y - 31, w: 22, h: 33, k: 'mort' }); }
  function bubble(x, s, bx, by) { x.font = '5px "Press Start 2P", monospace'; var w = Math.ceil(x.measureText(s).width) + 8; bx = Math.max(2, Math.min(W - w - 2, bx)); px(x, '#000', bx + 1, by + 1, w, 11); px(x, '#fff8e1', bx, by, w, 11); px(x, '#fff8e1', bx + 4, by + 11, 3, 3); x.fillStyle = '#1b1b1b'; x.fillText(s, bx + 4, by + 8); }
  function fog(x, t) { x.save(); for (var i = 0; i < 4; i++) { var off = reduced() ? i * 40 : (t / (90 + i * 30) + i * 70) % (W + 120); x.globalAlpha = 0.05 + i * 0.012; px(x, '#c8c6e8', Math.round(off) - 120, 96 + i * 22, 140, 5); px(x, '#c8c6e8', Math.round(off) - 100, 99 + i * 22, 90, 3); } x.restore(); }
  function board(x) { px(x, '#3e2a18', 146, 150, 2, 12); px(x, '#000', 134, 138, 26, 14); px(x, '#6b4a2a', 135, 139, 24, 12); x.font = '4px "Press Start 2P", monospace'; x.textAlign = 'center'; x.fillStyle = '#f3e2b8'; x.fillText(S.total > 999 ? Math.round(S.total / 100) / 10 + 'K' : String(S.total), 147, 145); x.fillText('REST', 147, 150); x.textAlign = 'left'; }
  function draw(t) { var x = S.x; if (!x) return; if (window.V2Sharp) V2Sharp.begin(x, S.k); else x.imageSmoothingEnabled = false; S.hits = [];
    sky(x, t); land(x); fence(x); altar(x, t); board(x);
    S.graves.slice().sort(function (a, b) { return a.y - b.y; }).forEach(function (g, i) { stone(x, g, t, i); }); seance(x, t); mort(x, t); fog(x, t);
    if (!S.total) { x.font = '6px "Press Start 2P", monospace'; x.textAlign = 'center'; x.fillStyle = '#000'; x.fillText('NO GRAVES YET', 161, 171); x.fillStyle = '#9fe8ff'; x.fillText('NO GRAVES YET', 160, 170); x.textAlign = 'left'; }
    if (!reduced() && t - S.lt > 12000) { S.lt = t; S.line = (S.line + 1) % LINES.length; } if (S.say || (!reduced() && t - S.lt < 4000)) bubble(x, S.say || LINES[S.line], MORT.x - 6, MORT.y - 46);
    if (!reduced() && !S.off) S.raf = requestAnimationFrame(draw); else S.raf = 0; }
  /* the card under the scene: one tap = the facts, links to the pet page / the list below */
  function card(k) { var el = document.getElementById('cemCard'); if (!el) return; var R = window.V2Render, V = window.V2Rules, w = S.w, T = ['Common', 'Uncommon', 'Rare', 'Legendary'], TID = ['common', 'uncommon', 'rare', 'legendary'];
    if (!k) { el.hidden = true; return; } el.hidden = false;
    if (k === 'altar') el.innerHTML = '<b class="cc-h">🗿 The old altar</b><p class="small">A cold stone at the end of the path. Nothing happens here. Yet.</p>';
    else if (k === 'seance') el.innerHTML = '<b class="cc-h">🕯️ The seance circle</b><p class="small">Six candles round a moon stone. They won\u2019t light. Not tonight.</p>';
    else if (k === 'mort') el.innerHTML = '<b class="cc-h">🏮 Mort, the caretaker</b><p class="small">Keeps the grass short and the gate shut. A pet ends up here after 7 full chain days (144 blocks each) with no meal. Mythic pets never starve. Feed yours on <a href="play.html">Play</a>.</p>';
    else { var p = k, gc = R.graveCount ? R.graveCount(w, p) : 0, sh = String(p.owner || ''); sh = sh.length > 14 ? sh.slice(0, 6) + '\u2026' + sh.slice(-4) : sh;
      el.innerHTML = '<div class="cc-row"><canvas width="32" height="32" class="cc-sp"></canvas><div><b class="cc-h">' + esc(p.name) + ' <span class="muted">#' + p.id + '</span></b><div class="small">' + esc(V.speciesLabel ? V.speciesLabel(p.species) : p.species) + ' · <span class="pill tier tier-' + TID[p.tier] + '">' + T[p.tier] + '</span> · reached ' + esc(p.stageName) + '</div>' +
        '<div class="small">🪦 died at block ' + Number(p.deathBlock).toLocaleString('en-US') + ' · owner <span title="' + esc(p.owner) + '">' + esc(sh) + '</span></div>' + (gc ? '<div class="small cc-gear">' + R.graveLine(w, p) + '</div>' : '') +
        '<div class="row cc-act"><a class="btn" href="pet.html?id=' + p.id + '">Pet page</a><button type="button" class="q" data-cemfind="' + p.id + '">Find in the list ▾</button></div></div></div>';
      R.paint(el.querySelector('canvas'), R.framesWith(p.art, p.stage, [])[0]);
      el.querySelector('[data-cemfind]').onclick = function () { var i = document.getElementById('cemFind'), g = document.getElementById('cemGo'); if (i && g) { i.value = '#' + p.id; g.click(); var t = document.getElementById('tomb-' + p.id); if (t) { t.scrollIntoView({ block: 'center' }); t.classList.add('flash'); } } }; } }
  function at(c, e) { var r = c.getBoundingClientRect(), mx = (e.clientX - r.left) * W / r.width, my = (e.clientY - r.top) * H / r.height, hs = S.hits.filter(function (q) { return mx >= q.x && mx < q.x + q.w && my >= q.y && my < q.y + q.h; }); return hs.length ? hs[hs.length - 1] : null; }
  /** mount(w, dead): dead = dead pets newest first (the page's own list). The newest 12 get headstones; the rest live in the list below. */
  function mount(w, dead) { var box = document.getElementById('cemScene'); if (!box || !w) return; S.w = w; S.total = dead.length; S.sel = null;
    S.graves = SLOTS.map(function (s, i) { return { x: s[0], y: s[1], p: dead[i] || null }; });
    var c = box.querySelector('canvas'); if (!c) { box.innerHTML = '<canvas width="' + W + '" height="' + H + '" role="img" aria-label="The XCPETS Pet Cemetery at night: the newest graves with their ghosts, Mort the caretaker at the gate, an old altar and a seance circle"></canvas><div class="cem-hint small">👇 Tap a headstone to read it · the newest ' + Math.min(12, dead.length || 12) + ' graves are out here</div>';
      c = box.querySelector('canvas');
      if (window.IntersectionObserver) new IntersectionObserver(function (es) { var off = !es[0].isIntersecting; if (off === S.off) return; S.off = off; if (!off && !S.raf) draw(performance.now()); else if (off) { cancelAnimationFrame(S.raf); S.raf = 0; } }, { threshold: 0 }).observe(c);
      c.addEventListener('mousemove', function (e) { var h = at(c, e), v = h ? (h.p || h.k) : null; if (v !== S.hov) { S.hov = v; c.style.cursor = v ? 'pointer' : ''; if (reduced()) draw(performance.now()); } });
      c.addEventListener('mouseleave', function () { S.hov = null; if (reduced()) draw(performance.now()); });
      c.addEventListener('click', function (e) { var h = at(c, e), v = h ? (h.p || h.k) : null; S.sel = v; S.say = v === 'mort' ? LINES[(S.line = (S.line + 1) % LINES.length)] : null; card(v); draw(performance.now()); }); }
    S.c = c; S.x = c.getContext('2d'); if (window.V2Sharp) { S.k = V2Sharp.fit(c, W, H); if (!S.rs) { S.rs = 1; V2Sharp.watch(function () { if (!S.c) return; var k0 = S.k; S.k = V2Sharp.fit(S.c, W, H); if (S.k !== k0 && !S.raf) draw(performance.now()); }); } }
    cancelAnimationFrame(S.raf); S.raf = 0; draw(performance.now()); }
  /** hooks(state): 'off' (today) | 'lit'. The future Halloween build flips this; this branch never does. */
  function hooks(state) { S.hook = state === 'lit' ? 'lit' : 'off'; if (S.x && !S.raf) draw(performance.now()); }
  window.V2CemeteryScene = { mount: mount, hooks: hooks, ALTAR: ALTAR, SEANCE: SEANCE, _state: function () { return S; }, _select: function (k) { S.sel = k; card(k); if (S.x) draw(performance.now()); } };
})();
