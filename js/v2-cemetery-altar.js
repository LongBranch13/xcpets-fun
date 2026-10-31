/* XCPETS Pet Cemetery: THE ALTAR (cemetery loop, Oct 29 2026). Every number comes from the replay engine in js/v2-rules.js:
 * cemPreview (power, times, milestone), cemOfferWhy / cemGearWhy (what can be offered), cemGraveWhy (owner test, closed graves),
 * cemPlan (burn tags, split so each fits 34 bytes) and cemCost (costs follow the halving era). Owner, Oct 28 6:33 PM CT: the main sacrifice
 * happens AT THE SEANCE. Pick a dead pet, offer living pets plus optional stash gear; each offering adds less than the one before, ceiling 3 times.
 * Drag or tap pets onto the altar; each flies in, melts into green smoke, a candle flares and a tally is carved; the power bar lights milestones;
 * "See the rise" plays the claw-from-the-grave. "Hold seance" hands the tags to play.html (#cem-...), whose send guard checks and signs them. */
(function () {
  'use strict';
  var CAP = 3, STATS = ['vigor', 'spark', 'grit', 'zoom', 'luck'];
  var MILES = [[1.5, 'Shambler'], [2, 'Ghoul'], [2.5, 'Revenant'], [2.8, 'Dread'], [3, 'Ceiling']]; /* replaced from the engine (V.CEM) on open */
  var TL = ['Common', 'Uncommon', 'Rare', 'Legendary'], TID = ['common', 'uncommon', 'rare', 'legendary'], AW = 160, AH = 100, PAGE = 48, ZK = 2, ZS = 3, ZX0 = 112; /* risen zombie (owner Oct 28 'zombie should be bigger'): drawn on its own 2x layer (#altZc) at a whole 3 layer pixels per pet pixel = 48 of 32 (was squeezed to 28), kept right of the altar (x >= 112) */
  var RM = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function reduced() { return !!RM.matches || !!window.__cemReduced; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function px(x, c, a, b, w, h) { x.fillStyle = c; x.fillRect(a, b, w, h); }
  var A = { ctx: null, grave: null, mine: [], offered: [], gear: [0, 0, 0, 0], stash: [0, 0, 0, 0], filt: 'all', shown: PAGE, fx: [], flares: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], tally: 0, raf: 0, rise: null, sample: '', lastMile: -1, sound: false, ask: null, shown0: 0 };

  try { A.sound = localStorage.getItem('xcpets-cem-sfx') === 'on'; } catch (e) {}

  /* ---------------------------------------------------------------- the math (engine) ---------------------------------------------------------------- */
  function eng() { var c = A.ctx, w = c.w; return { w: w, V: c.V, b: bk(), G: w.byId[A.grave.id] }; }
  function project() { var E = eng(), pets = A.offered.map(function (o) { return E.w.byId[o.id]; }).filter(Boolean), P = E.V.cemPreview(E.w, E.G, pets, selGear(), E.b), out = {};
    STATS.forEach(function (k) { var d = A.base[k] || 0; out[k] = Math.max(d, Math.min(d * CAP, Math.round(d * P.times))); });
    return { stats: out, total: P.power, base: P.deathPower, ceil: P.ceiling, times: P.times, list: P.list, gf: P.gf, exact: P.deathPower * P.times }; }
  /* offerings shown strongest first, so each line adds less than the one before (the total does not depend on the order) */
  function steps() { var P = project(), keep = 1, prev = P.base, L = P.list.slice().sort(function (a, b) { return b.share - a.share; }), out = [];
    L.forEach(function (e) { keep *= 1 - e.share; var t = P.base * Math.min(CAP, 1 + 2 * (1 - keep)), o; if (e.id != null) { o = A.offered.filter(function (q) { return q.id === e.id; })[0] || { kind: 'pet', id: e.id, name: '#' + e.id, tier: 0 }; } else { var g = eng().w.items[e.gid]; o = { kind: 'gear', label: (g && g.label || 'Gear') + (e.grave ? ' (the grave\'s own)' : '') + ' · ' + TL[gTier(g)] }; }
      out.push({ o: o, add: dec(t - prev) }); prev = t; }); return out; }
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
  /* zombie-dead-look (owner Oct 29 2026 'way more zombie looking and dead looking'): the risen pet uses the same dead look as My Pets (js/v2-zombie-look.js,
   * loaded next to this file): rotting skin, black sockets, teeth, ribs, a bite, drool, flies and stink. 6 frames (drool drips, flies buzz); c.fr holds them.
   * Until that file loads the old green tint is used and not cached. */
  var ZV = (function () { try { var cs = document.currentScript, m = cs && /\?(.*)$/.exec(cs.src); return m ? m[1] : ''; } catch (e) { return ''; } })();
  function ZL() { return window.V2ZombieLook || null; }
  try { if (!window.V2ZombieLook && !document.getElementById('zbLook')) { var zs = document.createElement('script'); zs.id = 'zbLook'; zs.src = 'js/v2-zombie-look.js' + (ZV ? '?' + ZV : ''); document.head.appendChild(zs); } } catch (e) {}
  function zombieFrames(c, x, d, p) { var Z = ZL(), base = new Uint8ClampedArray(d.data), N = 6, fr = [], bb = null, wp = A.ctx.w.byId ? A.ctx.w.byId[p.id] : null, E = wp ? (Z.gameEyes && Z.gameEyes(wp.art, wp.stage, 0)) || (Z.starEyes ? Z.starEyes(wp.art, wp.stage, 0) : null) : null;
    for (var fi = 0; fi < N; fi++) { var r = Z.transparent(base, p.id, fi, N, { ground: false, eyes: E }); var cc = fi ? document.createElement('canvas') : c; if (fi) cc.width = cc.height = 32;
      var cx = cc.getContext('2d'), id2 = cx.createImageData(32, 32); if (r) { id2.data.set(r.data); if (!bb && r.box) bb = r.box; } else id2.data.set(base); cx.putImageData(id2, 0, 0); fr.push(cc); }
    c.fr = fr; c.bb = bb ? [bb.x0, bb.y0, bb.W, bb.H] : [0, 0, 32, 32]; c.zb = true; }
  function sprite(p, green) { var key = p.id + (green ? 'g' : ''); if (SPR[key] !== undefined) return SPR[key]; if (green && !ZL()) { var old = sprite0(p, key); delete SPR[key]; return old; } return sprite0(p, key, green); }
  function sprite0(p, key, green) { if (green === undefined) green = /g$/.test(key); var R = A.ctx.R, wp = A.ctx.w.byId ? A.ctx.w.byId[p.id] : null, c = null;
    try { if (wp && wp.art) { c = document.createElement('canvas'); c.width = c.height = 32; /* keyed render (solid magenta background) so only the pet itself flies, smokes and rises, never its square tile */
      R.paint(c, R.framesWith(Object.assign({}, wp.art, { background: 'solid', bgColor: '#ff00ff', pattern: 'none' }), wp.stage, [])[0]);
      var x = c.getContext('2d'), d = x.getImageData(0, 0, 32, 32), a = d.data; for (var i = 0; i < a.length; i += 4) { if (a[i] > 240 && a[i + 1] < 16 && a[i + 2] > 240) { a[i + 3] = 0; continue; } if (!a[i + 3] || !green || ZL()) continue; var l = (a[i] * 0.3 + a[i + 1] * 0.59 + a[i + 2] * 0.11) / 255;
        a[i] = Math.round(40 + 90 * l); a[i + 1] = Math.round(90 + 160 * l); a[i + 2] = Math.round(40 + 60 * l); } if (green && ZL()) { zombieFrames(c, x, d, p); SPR[key] = c; return c; } x.putImageData(d, 0, 0); var bx0 = 32, by0 = 32, bx1 = -1, by1 = -1; for (var j = 0; j < 1024; j++) { if (!a[j * 4 + 3]) continue; var jx = j % 32, jy = (j / 32) | 0; if (jx < bx0) bx0 = jx; if (jx > bx1) bx1 = jx; if (jy < by0) by0 = jy; if (jy > by1) by1 = jy; } c.bb = bx1 < 0 ? [0, 0, 32, 32] : [bx0, by0, bx1 - bx0 + 1, by1 - by0 + 1]; /* the pet's own pixels (for the bigger risen zombie) */ } } catch (e) { c = null; }
    SPR[key] = c; return c; }

  /* ---------------------------------------------------------------- the altar canvas ---------------------------------------------------------------- */
  var CAND = [[55, 58, 7], [63, 58, 5], [97, 58, 5], [105, 58, 7]], SPOT = { x: 80, y: 57 }, GRV = { x: 134, y: 86 };
  /* Mort's candle circle (the seance circle from the cemetery scene: the same ring + six cream candles) laid round the altar. Owner Oct 29 2026 8:35 PM CT:
   * pets are sacrificed on the altar INSIDE the circle. Blood (owner 8:36 PM, cartoony pixel red, no gore): a splat per pet, then it runs along the ring. */
  var RING = { cx: 80, cy: 92, rx: 41, ry: 7 }; (function () { for (var i = 0; i < 6; i++) { var b = i / 6 * Math.PI * 2 + 0.3; CAND.push([Math.round(RING.cx + Math.cos(b) * RING.rx), Math.round(RING.cy + Math.sin(b) * RING.ry), 6, Math.sin(b) > 0]); } })();
  var BL = ['#8c1216', '#c41e24', '#e8343a', '#ff6a5e'];
  function scene(x, t) { var i;
    var B = ['#0b0a1f', '#110f2b', '#181539', '#221d48', '#2a2452', '#342e5e']; for (i = 0; i < B.length; i++) px(x, B[i], 0, i * 10, AW, 10);
    for (i = 0; i < 18; i++) px(x, i % 5 ? '#8d89c9' : '#fff6d8', (i * 47 + 13) % AW, (i * 29 + 5) % 44, 1, 1);
    px(x, '#383274', 18, 8, 14, 14); px(x, '#fff1c4', 20, 10, 10, 10); px(x, '#eadba4', 22, 13, 3, 2); px(x, '#eadba4', 26, 16, 2, 2);
    for (var hx = 0; hx < AW; hx += 2) { var hh = 4 + Math.round(Math.sin(hx / 17) * 2 + Math.sin(hx / 7)); px(x, '#3c3868', hx, 60 - hh, 2, hh); }
    for (var y = 60; y < AH; y++) { var k = (y - 60) / 40; px(x, 'rgb(' + [Math.round(74 - 50 * k), Math.round(76 - 46 * k), Math.round(106 - 74 * k)].map(function (v) { return v - v % 6; }).join(',') + ')', 0, y, AW, 1); }
    x.save(); x.globalAlpha = 0.22; px(x, '#8f91b0', 0, 58, AW, 3); x.globalAlpha = 0.1; var fo = reduced() ? 30 : (t / 90) % 220; px(x, '#c8c6e8', Math.round(fo) - 60, 66, 70, 2); px(x, '#c8c6e8', Math.round((fo + 110) % 220) - 60, 74, 50, 2); x.restore();
    /* the chosen grave: a headstone with its ghost, and the dirt where the zombie comes up */
    var g = GRV, R0 = A.rise, gwp = A.grave && A.ctx.w.byId ? A.ctx.w.byId[A.grave.id] : null;
    if (window.V2Gravestone && V2Gravestone.paintAt && gwp && gwp.art) { /* THE gravestone (option C, owner's pick Oct 29 2026): the grave's own stone, its pet carved in it, candles in its rarity colour */
      V2Gravestone.paintAt(x, { art: gwp.art, stage: gwp.stage, tier: Math.max(0, Math.min(3, A.grave.tier | 0)), state: A.grave.state || null, crumbles: A.grave.crumbles || 0, open: true }, g.x - 26, g.y - 56, t);
    } else { px(x, '#16141f', g.x - 12, g.y - 30, 24, 31); px(x, '#16141f', g.x - 9, g.y - 33, 18, 3); px(x, '#7c808c', g.x - 11, g.y - 29, 22, 29); px(x, '#7c808c', g.x - 8, g.y - 32, 16, 3);
    px(x, '#525560', g.x + 6, g.y - 29, 5, 29); px(x, '#9a9ea8', g.x - 11, g.y - 29, 1, 29); x.font = '5px "Press Start 2P", monospace'; x.textAlign = 'center'; x.fillStyle = '#2b2d31'; x.fillText('RIP', g.x - 1, g.y - 20);
    x.font = '4px "Press Start 2P", monospace'; x.fillText('#' + (A.grave ? A.grave.id : ''), g.x - 1, g.y - 12); x.textAlign = 'left'; }
    var shake = R0 && R0.t < 900 ? Math.round(Math.sin(t / 25) * 1) : 0;
    px(x, '#2a1d14', g.x - 16 + shake, g.y, 32, 6); px(x, '#3e2a18', g.x - 14 + shake, g.y - 1, 28, 2); px(x, '#523822', g.x - 10 + shake, g.y - 2, 6, 1); px(x, '#523822', g.x + 3 + shake, g.y - 2, 5, 1);
    var gs = A.grave && sprite(A.grave); if (gs && !R0) { x.save(); x.globalAlpha = 0.45 + 0.1 * Math.sin(t / 300); x.imageSmoothingEnabled = false; x.drawImage(gs, g.x - 12, g.y - (window.V2Gravestone && gwp ? 86 : 58) + (reduced() ? 0 : Math.round(Math.sin(t / 450) * 2)), 24, 24); x.restore(); }
    ring(x, t); A.flares.forEach(function (f, j) { if (j >= 4 && !CAND[j][3]) candle(x, CAND[j], f, t, j); });
    /* the altar: slab, body, base; carved tally on the front */
    px(x, '#16141f', 49, 56, 62, 6); px(x, '#9a9ea8', 50, 57, 60, 4); px(x, '#c8ccd4', 50, 57, 60, 1);
    px(x, '#16141f', 55, 61, 50, 28); px(x, '#7c808c', 56, 61, 48, 27); px(x, '#525560', 96, 61, 8, 27); px(x, '#9a9ea8', 56, 61, 1, 27);
    px(x, '#16141f', 47, 88, 66, 6); px(x, '#6a6e7a', 48, 88, 64, 5); px(x, '#525560', 48, 92, 64, 1);
    var glow = A.offered.length ? 0.18 + 0.08 * Math.sin(t / 200) : 0; if (glow) { x.save(); x.globalAlpha = glow; px(x, '#7dff6a', 60, 46, 40, 12); x.globalAlpha = glow / 2; px(x, '#7dff6a', 54, 40, 52, 18); x.restore(); }
    carve(x); stains(x); fire(x, t); A.flares.forEach(function (f, j) { if (j < 4 || CAND[j][3]) candle(x, CAND[j], f, t, j); });
  }
  /* the ring on the ground (the seance circle's dashes); blood runs round it both ways from the front as pets are offered (A.bflow 0..1 of the ring) */
  function ring(x, t) { var R = RING, n = 56, fl = A.bflow || 0, head = fl * n;
    for (var a = 0; a < n; a++) { var an = a / n * Math.PI * 2 + Math.PI / 2, rx = Math.round(R.cx + Math.cos(an) * R.rx), ry = Math.round(R.cy + Math.sin(an) * R.ry), bl = fl > 0 && (a < head / 2 + 0.5 || a > n - head / 2 - 0.5);
      px(x, bl ? (a % 3 ? BL[1] : BL[0]) : '#2b2a3a', rx, ry, 2, 1); if (bl && a % 7 === 0) px(x, BL[2], rx, ry, 1, 1); }
    if (fl > 0 && fl < 1 && !reduced()) [head / 2, n - head / 2].forEach(function (h) { var an = h / n * Math.PI * 2 + Math.PI / 2; px(x, BL[3], Math.round(R.cx + Math.cos(an) * R.rx), Math.round(R.cy + Math.sin(an) * R.ry) - (Math.floor(t / 160) % 2), 1, 1); }); }
  /* splats left on the slab edge and running down the altar front, one per pet (fixed spots so frames stay steady) */
  function stains(x) { var n = Math.min(A.splats || 0, 12); for (var i = 0; i < n; i++) { var sx = 58 + ((i * 37) % 44), sy = 57 + ((i * 11) % 3), dl = 2 + (i * 5) % 6;
      px(x, BL[1], sx, sy, 3, 1); px(x, BL[0], sx + 1, sy + 1, 1, dl); px(x, BL[1], sx + 1, sy + 1 + dl, 2, 1); } }
  /* the ritual fire on the altar (gear goes into the flames; this is NOT a pet aura): low embers while gear is chosen, a burst per item */
  function gearN() { return (A.gear || []).reduce(function (a, b) { return a + b; }, 0); }
  function fire(x, t) { var lv = Math.max(gearN() ? 0.35 : 0, A.fire || 0); if (lv <= 0) return; var rm = reduced(), h = Math.round(3 + lv * 12), cx = SPOT.x;
    x.save(); x.globalAlpha = 0.16 + lv * 0.25; px(x, '#ff8a2a', Math.round(cx - 10 - lv * 4), 56 - h - 3, Math.round(20 + lv * 8), h + 4); x.restore();
    for (var i = -3; i <= 3; i++) { var fh = Math.max(1, Math.round(h * (1 - Math.abs(i) / 4.2) + (rm ? 0 : Math.sin(t / 70 + i * 1.7) * 2))); px(x, '#c4381c', cx + i * 2 - 1, 56 - fh, 2, fh); px(x, '#ff8a2a', cx + i * 2 - 1, 56 - Math.round(fh * 0.7), 2, Math.round(fh * 0.7)); if (Math.abs(i) < 2) px(x, '#ffd166', cx + i * 2 - 1, 56 - Math.round(fh * 0.4), 2, Math.round(fh * 0.4)); }
    px(x, '#5a2a12', cx - 7, 55, 14, 2); }
  /* gear icon for the toss: the item's own catalog icon (V2Render.itemIcon) with its backdrop cut out; a tier-coloured box if there is none */
  var GSP = {}; function gearSprite(g, tier) { var id = g && g.item, k = id + ':' + tier; if (GSP[k]) return GSP[k]; var c = document.createElement('canvas'); c.width = c.height = 32; var cx = c.getContext('2d'), R = A.ctx.R, ic = null;
    try { ic = R && R.itemIcon && id ? R.itemIcon(id) : null; } catch (e) { ic = null; }
    if (ic && !ic.empty) { var d = cx.createImageData(32, 32); d.data.set(ic.data); for (var i = 0; i < d.data.length; i += 4) if (d.data[i] === 20 && d.data[i + 1] === 32 && d.data[i + 2] === 24) d.data[i + 3] = 0; cx.putImageData(d, 0, 0); }
    else { var col = ['#9aa3b5', '#4fd18b', '#4f9dff', '#ffc93c'][tier] || '#9aa3b5'; px(cx, '#000', 8, 8, 16, 16); px(cx, col, 9, 9, 14, 14); px(cx, '#fff', 11, 11, 3, 3); }
    return (GSP[k] = c); }
  function toss(t) { var arr = (A.gearItems || [])[t] || [], g = arr[Math.max(0, (A.gear[t] || 1) - 1)]; A.fx.push({ k: 'toss', s: gearSprite(g, t), x0: AW - 14, y0: AH + 6, t: 0, d: 520, tier: t }); kick(); }
  function burnt(f) { A.fire = 1; A.flares[(A.tally++) % 4] = 1; SFX.offer(f.tier);
    for (var i = 0; i < 18 + f.tier * 6; i++) A.fx.push({ k: 'smoke', x: SPOT.x + (Math.random() * 12 - 6), y: SPOT.y - 6, vx: Math.random() * 1.2 - 0.6, vy: -(0.5 + Math.random() * 1.1), t: 0, d: 420 + Math.random() * 380, c: ['#ffd166', '#ff8a2a', '#c4381c', '#fff3b0'][i % 4], z: 1 });
    A.fx.push({ k: 'pop', x: SPOT.x, y: SPOT.y - 20, t: 0, d: 700, s: '+gear', col: '#ffd166' }); }
  /* blood splat on the altar when a pet lands (cartoony: round pixel drops arc out and fall to the ground) */
  function splat() { A.splats = (A.splats || 0) + 1; A.bwant = Math.min(1, (A.bwant || 0) + 0.2);
    for (var i = 0; i < 28; i++) { var an = Math.PI + Math.random() * Math.PI, sp = 0.6 + Math.random() * 1.6; A.fx.push({ k: 'blood', x: SPOT.x + (Math.random() * 6 - 3), y: SPOT.y - 2, vx: Math.cos(an) * sp * 1.4, vy: Math.sin(an) * sp, t: 0, d: 520 + Math.random() * 300, z: i % 3 ? 2 : 3, c: BL[i % 3] }); } }
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
  function land(f) { var o = f.o, j = (A.tally + o.seq) % 4; A.flares[j] = 1; A.flares[4 + (A.tally % 6)] = 1; if (o.tier >= 2) A.flares[4 + ((A.tally + 3) % 6)] = 1; A.tally++; splat();
    for (var i = 0; i < 26 + o.tier * 8; i++) A.fx.push({ k: 'smoke', x: SPOT.x + (Math.random() * 20 - 10), y: SPOT.y - 6 + Math.random() * 8, vx: Math.random() * 0.6 - 0.3, vy: -(0.25 + Math.random() * 0.6), t: 0, d: 500 + Math.random() * 500, c: ['#7dff6a', '#3fbf4a', '#c9ffb0', '#2f8a3c'][i % 4], z: i % 3 ? 1 : 2 });
    var tx = 59 + (Math.floor((A.tally - 1) / 5) % 4) * 9, ty = 65 + Math.floor((A.tally - 1) / 20) * 10; for (var c = 0; c < 6; c++) A.fx.push({ k: 'chip', x: tx + 3, y: ty + 3, vx: Math.random() * 1.4 - 0.7, vy: -Math.random() * 1.2, t: 0, d: 350 });
    A.fx.push({ k: 'pop', x: SPOT.x, y: SPOT.y - 14, t: 0, d: 700, s: '+' + o.add }); SFX.smoke(); if (window.V2CemeteryScene && V2CemeteryScene.flare) V2CemeteryScene.flare(); }
  function step(f, dt) { f.t += dt; if (f.k === 'smoke' || f.k === 'chip' || f.k === 'blood' || f.k === 'drip') { f.x += f.vx * dt / 16; f.y += f.vy * dt / 16; if (f.k === 'chip' || f.k === 'blood') f.vy += 0.09 * dt / 16; if (f.k === 'drip') f.vy += 0.03 * dt / 16; if ((f.k === 'blood' || f.k === 'drip') && f.y > (f.fl || 94)) { f.y = f.fl || 94; f.vx = 0; f.vy = 0; } } }
  function drawFx(x) { A.fx.forEach(function (f) { var p = Math.min(1, f.t / f.d);
      if (f.k === 'fly') { var e = 1 - Math.pow(1 - p, 3), fx = f.x0 + (SPOT.x - f.x0) * e, fy = f.y0 + (SPOT.y - 12 - f.y0) * e - Math.sin(p * Math.PI) * 18, sz = Math.round(24 - 6 * p);
        if (f.s) { x.save(); x.imageSmoothingEnabled = false; x.globalAlpha = 1 - p * 0.3; x.drawImage(f.s, Math.round(fx - sz / 2), Math.round(fy - sz / 2), sz, sz); x.restore(); } else px(x, '#e9e3ff', Math.round(fx) - 4, Math.round(fy) - 4, 8, 8); }
      else if (f.k === 'smoke') { x.save(); x.globalAlpha = (1 - p) * 0.9; px(x, f.c, Math.round(f.x), Math.round(f.y), f.z, f.z); x.restore(); }
      else if (f.k === 'chip') { px(x, '#c8ccd4', Math.round(f.x), Math.round(f.y), 1, 1); }
      else if (f.k === 'blood' || f.k === 'drip') { x.save(); x.globalAlpha = p > 0.75 ? (1 - p) * 4 : 1; px(x, f.c || BL[1], Math.round(f.x), Math.round(f.y), f.z || 1, (f.z || 1) + (f.vy > 0.6 ? 1 : 0)); x.restore(); }
      else if (f.k === 'toss') { var tx2 = f.x0 + (SPOT.x - f.x0) * p, ty2 = f.y0 + (SPOT.y - 8 - f.y0) * p - Math.sin(p * Math.PI) * 34, sz2 = Math.round(20 - 6 * p), an2 = reduced() ? 0 : p * Math.PI * 3;
        x.save(); x.imageSmoothingEnabled = false; x.translate(Math.round(tx2), Math.round(ty2)); x.rotate(Math.round(an2 / (Math.PI / 2)) * Math.PI / 2); x.drawImage(f.s, -sz2 / 2, -sz2 / 2, sz2, sz2); x.restore(); }
      else if (f.k === 'pop') { x.save(); x.globalAlpha = 1 - p; x.font = '6px "Press Start 2P", monospace'; x.textAlign = 'center'; x.fillStyle = '#000'; x.fillText(f.s, f.x + 1, f.y - p * 10 + 1); x.fillStyle = f.col || '#7dff6a'; x.fillText(f.s, f.x, f.y - p * 10); x.restore(); } }); }
  /* the rise (mock): ground shakes, dirt flies, a claw breaks out, the zombie climbs up, green and glowing. zombie-v3 (owner Oct 28 2026 10:32 PM CT):
   * the zombie rises from behind the headstone and ends standing above it (clipped at the stone top, glow stops there too), so the 'RIP' and the #id stay readable */
  function drawRise(x) { var R0 = A.rise, t = R0.t, g = GRV, z = sprite(A.grave, true);
    if (t > 200 && t < 2400 && Math.random() < 0.35) A.fx.push({ k: 'drip', x: g.x - 10 + Math.floor(Math.random() * 20), y: g.y - 32 + Math.random() * 6, vx: 0, vy: 0.2, t: 0, d: 1600, fl: g.y - 1 - Math.floor(Math.random() * 3), c: BL[Math.floor(Math.random() * 2)], z: 1 }); /* blood drips down the headstone as it rises */
    if (t > 300) { var dn = Math.min(8, Math.floor((t - 300) / 260)); for (var di = 0; di < dn; di++) { var ddx = g.x - 10 + (di * 7) % 20, dl2 = 2 + (di * 3) % 5; px(x, BL[1], ddx, g.y - 30 + (di % 3), 2, 1); px(x, BL[0], ddx, g.y - 29 + (di % 3), 1, dl2); px(x, BL[1], ddx, g.y - 29 + (di % 3) + dl2, 1, 1); } px(x, BL[0], g.x - 12, g.y, Math.min(24, Math.round((t - 300) / 80)), 1); }
    if (t < 1100 && Math.random() < 0.6) A.fx.push({ k: 'chip', x: g.x - 8 + Math.random() * 16, y: g.y - 1, vx: Math.random() * 2 - 1, vy: -(0.6 + Math.random() * 1.6), t: 0, d: 500 });
    if (t > 350 && t < 1500) { var cp = Math.min(1, (t - 350) / 450), cy = g.y - Math.round(10 * cp), cx = g.x - 8; /* the claw */
      px(x, '#3c4630', cx, cy, 3, 10 * cp + 1); px(x, '#5e6a46', cx + 1, cy, 1, 10 * cp); px(x, '#80402f', cx, cy + 4, 1, 1); [[-2, -3], [0, -4], [2, -3], [4, -2]].forEach(function (f, i) { px(x, i === 2 ? '#d8d0b0' : '#6c7a52', cx + f[0], cy + f[1], 1, 3); px(x, '#e6dfc4', cx + f[0], cy + f[1], 1, 1); }); } /* rotten claw, bone fingertips */
    var zc = A.zc, zx2 = zc && zc.getContext('2d'); if (t > 1100 && zx2) { var rp = Math.min(1, (t - 1100) / 900), e = 1 - Math.pow(1 - rp, 2), bb = z && z.bb ? z.bb : [8, 6, 16, 22], zw = bb[2] * ZS, zh = bb[3] * ZS, gy = (g.y - 33) * ZK /* headstone top (stone drawn g.y-33..g.y) */, zl = ZX0 * ZK,
        zx = Math.max(zl, Math.min(AW * ZK - zw, g.x * ZK - (zw >> 1))), top = Math.round(gy - zh * e); zx2.save(); zx2.beginPath(); zx2.rect(0, 0, AW * ZK, gy); zx2.clip(); zx2.imageSmoothingEnabled = false;
      if (z && z.fr) { var zf = z.fr[Math.floor(t / 170) % z.fr.length], M2 = 3, sx0 = Math.max(0, bb[0] - M2), sy0 = Math.max(0, bb[1] - M2), sx1 = Math.min(32, bb[0] + bb[2] + M2), sy1 = Math.min(32, bb[1] + bb[3] + M2); /* flies / stink sit just outside the body */
        zx2.drawImage(zf, sx0, sy0, sx1 - sx0, sy1 - sy0, zx - (bb[0] - sx0) * ZS, top - (bb[1] - sy0) * ZS, (sx1 - sx0) * ZS, (sy1 - sy0) * ZS); }
      else if (z) zx2.drawImage(z, bb[0], bb[1], bb[2], bb[3], zx, top, zw, zh); else { zx2.fillStyle = '#7dff6a'; zx2.fillRect(zx, top, zw, zh); } zx2.restore();
      if (rp >= 1) { var bl = Math.floor(t / 220) % 2, hx = Math.max(zl, zx - 6), hy = Math.max(2, gy - zh - 8); zx2.save(); zx2.globalAlpha = z && z.zb ? 0.1 + 0.06 * bl : 0.25 + 0.15 * bl; zx2.fillStyle = z && z.zb ? '#7a8f3e' : '#7dff6a'; /* sickly, dim glow */ zx2.fillRect(hx, hy, Math.min(AW * ZK, zx + zw + 6) - hx, gy - hy); zx2.restore(); } }
    if (t > 2100 && !R0.done) { R0.done = true; risenCard(); } }
  function frame(t) { var c = A.cv; if (!c || !c.isConnected) { A.raf = 0; return; } var x = c.getContext('2d'), now = t || performance.now(), dt = A.last ? Math.min(50, now - A.last) : 16; A.last = now; x.imageSmoothingEnabled = false;
    A.fire = Math.max(0, (A.fire || 0) - dt / 900); A.bflow = Math.min(A.bwant || 0, (A.bflow || 0) + dt / 2200); A.flares = A.flares.map(function (f) { return Math.max(0, f - dt / 520); }); if (A.rise) A.rise.t += dt;
    A.fx.forEach(function (f) { step(f, dt); }); A.fx.filter(function (f) { return f.k === 'toss' && f.t >= f.d; }).forEach(burnt); var landed = A.fx.filter(function (f) { return f.k === 'fly' && f.t >= f.d; }); A.fx = A.fx.filter(function (f) { return f.t < f.d; }); landed.forEach(land);
    if (A.zc) A.zc.getContext('2d').clearRect(0, 0, A.zc.width, A.zc.height); scene(x, now); if (A.rise) drawRise(x); drawFx(x);
    var busy = A.fx.length || A.flares.some(function (f) { return f > 0; }) || (A.rise && !A.rise.done) || A.rise; if (!reduced() && !A.off && (busy || A.offered.length || A.grave)) A.raf = requestAnimationFrame(frame); else A.raf = 0; }
  function kick() { if (!A.raf && A.cv) { A.last = 0; A.raf = requestAnimationFrame(frame); } if (reduced() && A.cv) { A.fx.forEach(function (f) { if (f.k === 'fly') land(f); }); A.fx = []; A.flares = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; frame(performance.now()); } }

  /* ---------------------------------------------------------------- data ---------------------------------------------------------------- */
  function myth(p) { return !!p.mythicCare || p.stage >= 5; }
  function bk() { var c = A.ctx; return c && c.b != null ? c.b : ((c && c.w.tip) || 0) + 1; }
  function wornTiers(w, p) { var V = A.ctx.V, L = []; try { L = (A.ctx.R.worn ? A.ctx.R.worn(w, p.id) : V.wornOf(w, p.id)) || []; } catch (e) { L = []; } return L.map(gTier); }
  function gTier(g) { if (!g) return 0; if (g.legendary) return 3; if (typeof g.tier === 'number') return Math.max(0, Math.min(3, g.tier)); var it = A.ctx.V.itemOf ? A.ctx.V.itemOf(g.item) : null; return it && typeof it.tier === 'number' ? Math.max(0, Math.min(3, it.tier)) : 0; }
  function living(w, who) { return w.pets.filter(function (p) { return p.owner === who && !p.dead && !p.released && !p.community && !(A.ctx.V.isZ && A.ctx.V.isZ(p)); }); }
  function buildMine() { var w = A.ctx.w, V = A.ctx.V, b = bk(), me = A.ctx.ME; A.who = me || ''; A.sample = false;
    A.mine = me ? living(w, me).map(function (p) { var why = V.cemOfferWhy(w, p, me, b); return { id: p.id, name: p.name, tier: p.tier | 0, stage: p.stage, stageName: p.stageName, ripe: !!p.neglected, myth: myth(p), why: why, worn: wornTiers(w, p) }; })
      .sort(function (a, b) { return (!!a.why - !!b.why) || (b.ripe - a.ripe) || (a.tier - b.tier) || (a.id - b.id); }) : [];
    A.stash = [0, 0, 0, 0]; A.gearItems = [[], [], [], []]; var items = w.itemList || Object.keys(w.items || {}).map(function (k) { return w.items[k]; });
    if (me) items.forEach(function (g) { if (g && g.owner === me && g.on == null && !g.bag && /^g\d+$/.test(g.gid || '') && !V.cemGearWhy(w, g, me, b)) { var t = gTier(g); A.stash[t]++; A.gearItems[t].push(g); } }); }
  function selGear() { var L = []; (A.gearItems || []).forEach(function (arr, t) { L = L.concat(arr.slice(0, A.gear[t] || 0)); }); return L; }

  /* ---------------------------------------------------------------- panel ---------------------------------------------------------------- */
  function host() { var el = document.getElementById('cemAltar'); if (el) return el; el = document.createElement('section'); el.id = 'cemAltar'; el.className = 'cem-altar'; el.hidden = true; el.setAttribute('aria-label', 'Seance at the altar');
    var after = document.getElementById('cemCard') || document.getElementById('cemScene'); after.parentNode.insertBefore(el, after.nextSibling); return el; }
  function open(grave, ctx) { if (ctx) A.ctx = ctx; if (!A.ctx || !grave) return; var w = A.ctx.w, wp = w.byId ? w.byId[grave.id] : null, s = wp ? (wp.zDeath || wp.stats) : null, base = {};
    STATS.forEach(function (k) { base[k] = s ? (s[k] || 0) : 0; });
    A.grave = grave; A.base = base; A.offered = []; A.gear = [0, 0, 0, 0]; A.tally = 0; A.splats = 0; A.bwant = 0; A.bflow = 0; A.fire = 0; A.fx = []; A.rise = null; A.shown = PAGE; A.lastMile = -1; A.seq = 0; buildMine(); A.ctxW = w; var CE = A.ctx.V.CEM; if (CE) { CAP = CE.CAP; MILES = CE.MILESTONES.map(function (m) { return [m.at, m.name]; }).concat([[CAP, 'Ceiling']]); }
    var el = host(); el.hidden = false; el.innerHTML = shell(); A.cv = el.querySelector('#altCv'); A.zc = el.querySelector('#altZc'); bind(el); renderAll(true);
    topGap(); if (!A.rz) { A.rz = true; window.addEventListener('resize', topGap); } if (window.IntersectionObserver && !A.io) { A.io = new IntersectionObserver(function (es) { A.off = !es[0].isIntersecting; if (!A.off) kick(); }); } if (A.io) { A.io.disconnect(); A.io.observe(A.cv); }
    if (window.V2CemeteryScene && V2CemeteryScene.hooks) V2CemeteryScene.hooks('lit'); kick(); el.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' }); }
  /* the sticky stage sits just under the site's sticky nav, whatever height the nav wraps to on a phone */
  function topGap() { var n = document.querySelector('.nav'), el = document.getElementById('cemAltar'); if (el) el.style.setProperty('--altTop', ((n && /sticky|fixed/.test(getComputedStyle(n).position)) ? n.offsetHeight + 4 : 0) + 'px'); }
  function close() { var el = document.getElementById('cemAltar'); if (el) { el.hidden = true; el.innerHTML = ''; } A.cv = null; A.zc = null; A.grave = null; if (window.V2CemeteryScene && V2CemeteryScene.hooks) V2CemeteryScene.hooks('off'); }
  function shell() { var g = A.grave, sa = A.ctx.shortAddr, ME = A.ctx.ME, V = A.ctx.V, b = bk(), hw = V.cemHw(b), pub = V.cemPublic(b);
    return '<div class="alt-head"><h2 class="alt-title">🕯️ Seance at the altar</h2><div class="alt-tools"><button type="button" class="q" id="altSnd" aria-pressed="' + A.sound + '" title="Sound">' + (A.sound ? '🔊' : '🔇') + '</button><button type="button" class="q" id="altX" aria-label="Close the seance">✕</button></div></div>' +
      '<p class="small alt-who">Raising <b>' + esc(g.name) + '</b> <span class="muted">#' + g.id + ' · ' + esc(g.spl || '') + ' · ' + (g && g.resurrected ? 'God' : TL[g.tier]) + ' · owner ' + esc(sa(g.owner)) + (ME && g.owner === ME ? ' (you)' : '') + '</span></p>' +
      (hw ? '<p class="small alt-hw" id="altHwRow"><span class="alt-hwb" id="altHwB">🎃 Night of the Dead: offerings count 1.5 times (blocks ' + V.CEM.HW_FROM + ' to ' + V.CEM.HW_TO + ')</span></p>' : '') +
      (!pub ? '<p class="small alt-note">🧪 Owner test: until launch only grave #' + V.CEM.OWNER_GRAVE + ' can be raised, and only by the owner wallet.</p>' : '') +
      (!ME ? '<p class="small alt-note">👛 Connect XCP Wallet on the Play page to offer your pets.</p>' : '') +
      '<div class="alt-grid"><div class="alt-left"><div class="alt-stage"><div class="alt-cvwrap"><canvas id="altCv" width="' + AW + '" height="' + AH + '" role="img" aria-label="A stone altar with candles beside the grave. Drop or tap pets to offer them."></canvas><canvas id="altZc" width="' + AW * ZK + '" height="' + AH * ZK + '" aria-hidden="true"></canvas><div class="alt-drop" aria-hidden="true">Drop here</div><div class="alt-toast" id="altToast" aria-live="polite"></div></div>' +
      '<div class="alt-power"><div class="alt-pnum" id="altNum"></div><div class="alt-bar" id="altBar"><i class="alt-b0"></i><i class="alt-b1"></i>' + MILES.map(function (m, i) { return '<span class="alt-mk" data-i="' + i + '" style="left:' + (m[0] / CAP * 100) + '%"><em>' + m[1] + '</em></span>'; }).join('') + '</div>' +
      '<div class="alt-stats" id="altStats"></div></div></div>' +
      '<div class="alt-acts"><button type="button" class="btn" id="altHold" disabled>🕯️ Hold seance<span class="alt-c"></span></button><button type="button" class="btn ghost" id="altPledge" disabled title="Pledge to the pool without raising">🤝 Pledge only<span class="alt-c"></span></button><button type="button" class="btn" id="altRaiseNow" hidden disabled>🧟 Raise now<span class="alt-c"></span></button><button type="button" class="q" id="altRise" disabled>▶ See the rise</button><button type="button" class="q" id="altClr">↩ Take all back</button></div><p class="small alt-holdinfo" id="altHoldInfo" aria-live="polite"></p>' +
      '<div class="alt-tallylist" id="altList"></div></div>' +
'<div class="alt-pick"><div class="alt-ph"><b>Your living pets</b> <span class="small muted" id="altCount"></span></div><p class="small muted alt-how">Tap a pet, or drag its picture onto the altar. Ripe pets (3+ days unfed) count 1.5 times. Mythics, pets on a quest, in a fight, in Cold Storage or in the shop can\'t be offered. Worn gear comes off and stays yours.</p>' +
      '<div class="alt-filt" role="group" aria-label="Filter">' + [['all', 'All'], ['ripe', '🍂 Ripe'], ['0', 'Common'], ['1', 'Uncommon'], ['2', 'Rare'], ['3', 'Legendary']].map(function (f) { return '<button type="button" class="q" data-f="' + f[0] + '" aria-pressed="' + (A.filt === f[0]) + '">' + f[1] + '</button>'; }).join('') +
      '<button type="button" class="q alt-quick" id="altQuick">⚡ +5 ripe Commons</button></div><div class="alt-tiles" id="altTiles"></div><div class="alt-more"><button type="button" class="q" id="altMore">Show more</button></div>' +
      '<div class="alt-gear"><b class="small">🎒 Stash gear</b> <span class="small muted">(optional, a smaller boost than a pet; it is used up)</span><div class="alt-gr">' + TL.map(function (t, i) { return '<span class="alt-gs tier-' + TID[i] + '"><span class="pill tier tier-' + TID[i] + '">' + t + '</span> <button type="button" class="q" data-g="' + i + '" data-d="-1" aria-label="One less ' + t + ' gear">−</button> <b id="altG' + i + '">0</b>/' + A.stash[i] + ' <button type="button" class="q" data-g="' + i + '" data-d="1" aria-label="One more ' + t + ' gear">+</button></span>'; }).join('') + '</div></div></div></div>' +
      '<p class="small muted alt-foot">Each offering closes a share of the gap left to the ' + CAP + ' times ceiling (pets Common 3%, Uncommon 7%, Rare 14%, Legendary 25%; ripe 1.5 times; gear 1% to 10%; Halloween window: 1.5 times). Older graves and rarer graves give less per offering. Costs follow the current halving era. Everything offered is used up when the zombie rises.</p>'; }
  function visible() { return A.mine.filter(function (p) { return A.filt === 'all' ? true : A.filt === 'ripe' ? p.ripe && !p.why : p.tier === +A.filt && !p.why; }); }
  function isOn(id) { return A.offered.some(function (o) { return o.id === id; }); }
  function tile(p) { var on = isOn(p.id), dis = !!p.why;
    return '<label class="alt-tile tier-' + TID[p.tier] + (on ? ' on' : '') + (dis ? ' myth' : '') + (p.ripe && !dis ? ' ripe' : '') + '" data-id="' + p.id + '"' + (dis ? ' title="' + esc(cap1(p.why)) + '"' : '') + '>' +
      '<input type="checkbox" data-id="' + p.id + '"' + (on ? ' checked' : '') + (dis ? ' disabled' : '') + ' aria-label="Offer ' + esc(p.name) + ' #' + p.id + '">' +
      '<canvas width="32" height="32" data-sp="' + p.id + '" class="alt-sp"></canvas><span class="alt-tn">' + esc(p.name) + '</span><span class="alt-tm">#' + p.id + ' · <span class="tc">' + (p && p.resurrected ? 'God' : TL[p.tier]) + '</span></span>' +
      '<span class="alt-tags">' + (dis ? '<span class="alt-tag lock">🔒 ' + esc(p.myth ? 'Mythic' : cap1(p.why).slice(0, 18)) + '</span>' : '') + (p.ripe && !dis ? '<span class="alt-tag ripe">🍂 RIPE</span>' : '') + (p.worn.length ? '<span class="alt-tag gear" title="Its worn gear comes off and stays in your stash">🎒' + p.worn.length + ' back</span>' : '') + '</span></label>'; }
  function renderTiles() { var el = document.getElementById('altTiles'); if (!el) return; var L = visible(), R = A.ctx.R, w = A.ctx.w; el.innerHTML = L.slice(0, A.shown).map(tile).join('') || '<p class="small muted">No pets in this filter.</p>';
    L.slice(0, A.shown).forEach(function (p) { var c = el.querySelector('canvas[data-sp="' + p.id + '"]'), wp = w.byId ? w.byId[p.id] : null; if (c && wp && wp.art && R.lazy) R.lazy(c, function () { return R.framesWith(wp.art, wp.stage, []); }, true); });
    var m = document.getElementById('altMore'); m.hidden = L.length <= A.shown; m.textContent = 'Show more (' + (L.length - A.shown) + ' left)';
    var ripe = A.mine.filter(function (p) { return p.ripe && !p.why; }).length, my = A.mine.filter(function (p) { return p.why; }).length;
    document.getElementById('altCount').textContent = A.mine.length + ' living · ' + ripe + ' ripe · ' + my + ' can\'t be offered · ' + A.offered.length + ' on the altar'; }
  function mile(t) { var mi = -1; MILES.forEach(function (m, i) { if (t + 1e-9 >= m[0]) mi = i; }); return mi; }
  function renderPower(bump) { var P = project(), base = P.base, ceil = Math.max(1, P.ceil), num = document.getElementById('altNum'), bar = document.getElementById('altBar'); if (!num) return;
    var mi = A.offered.length ? mile(P.times) : -1, sh = base ? Math.min(P.total, ceil) : 0;
    num.innerHTML = '<span class="alt-big" id="altBig">' + P.total + '</span> <span class="small">zombie power</span> <span class="small muted">· died with ' + base + ' · +' + Math.max(0, P.total - base) + ' boost · ceiling ' + P.ceil + ' (' + CAP + ' times)' + (P.gf < 1 ? ' · grave strength ' + Math.round(P.gf * 100) + '%' : '') + '</span><span class="alt-rank">' + (mi >= 0 ? (mi === MILES.length - 1 ? 'MAXED' : MILES[mi][1].toUpperCase()) : 'RISEN') + ' · ' + P.times.toFixed(2) + ' times</span>';
    bar.querySelector('.alt-b0').style.width = (base / ceil * 100) + '%'; bar.querySelector('.alt-b1').style.width = (Math.max(0, sh - base) / ceil * 100) + '%'; bar.querySelector('.alt-b1').style.left = (base / ceil * 100) + '%';
    bar.querySelectorAll('.alt-mk').forEach(function (m) { var i = +m.getAttribute('data-i'); m.classList.toggle('hit', i <= mi); m.classList.toggle('next', i === mi + 1); });
    bar.classList.toggle('near', P.times >= 2.5);
    if (bump && !reduced()) { bar.classList.remove('bump'); void bar.offsetWidth; bar.classList.add('bump'); var b = document.getElementById('altBig'); if (b) { b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); } }
    if (mi > A.lastMile && A.lastMile >= -1 && bump) { toast((mi === MILES.length - 1 ? '💀 CEILING! ' + CAP + ' times' : '🧟 ' + MILES[mi][1].toUpperCase() + '!') + ''); SFX.mile(); } A.lastMile = mi;
    document.getElementById('altStats').innerHTML = STATS.map(function (k) { return '<span><b>' + k.charAt(0).toUpperCase() + k.slice(1) + '</b> ' + (A.base[k] || 0) + ' → <i>' + P.stats[k] + '</i></span>'; }).join('');
    var st = steps(); document.getElementById('altList').innerHTML = st.length ? '<b class="small">Offerings, strongest first</b> <span class="small muted">(each adds less; power before rounding)</span><ol>' + st.slice(0, 30).map(function (s) { var o = s.o;
      return '<li>' + (o.kind === 'gear' ? '🎒 ' + esc(o.label) : esc(o.name) + ' <span class="muted">#' + o.id + '</span> · ' + (o && o.resurrected ? 'God' : TL[o.tier]) + (o.ripe ? ' · 🍂 ripe' : '')) + ' <b>+' + s.add + '</b>' + (o.kind === 'pet' ? ' <button type="button" class="linkish" data-back="' + o.id + '" aria-label="Take back #' + o.id + '">↩</button>' : '') + '</li>'; }).join('') + '</ol>' + (st.length > 30 ? '<p class="small muted">…and ' + (st.length - 30) + ' more, each adding less.</p>' : '') : '<p class="small muted">The altar is bare. Offer a pet to wake the candles.</p>';
    document.getElementById('altRise').disabled = !A.offered.length; renderHold(); }
  /* the burn buttons: every check here mirrors the engine (cemGraveWhy, cemMinWhy, top giver); play.html's send guard checks again before signing */
  function holdWhy(mode) { var c = A.ctx, V = c.V, w = c.w, b = bk(), G = w.byId[A.grave.id];
    if (!c.ME) return 'Connect XCP Wallet on the Play page first'; var gw = V.cemGraveWhy(w, G, c.ME, b); if (gw) return cap1(gw);
    if (mode === 'raise') { var v = V.cemView(w, G, b); if (!v.altar) return 'No open altar on this grave'; if (v.altar.top !== c.ME) return 'Only the top giver can raise'; return null; }
    if (!A.offered.length && !(mode === 'pledge' && selGear().length)) return 'Offer at least 1 living pet';
    if (mode === 'seance') { var v2 = V.cemView(w, G, b), need = v2.need, ok = A.offered.some(function (o) { return o.tier >= need; }) || selGear().some(function (g) { return gTier(g) >= need; }) || (v2.altar && v2.altar.givers.length); if (!ok) return TL[A.grave.tier] + ' grave needs 1 ' + TL[need] + '+ offering'; }
    return null; }
  function cost(L) { return L.reduce(function (a, p) { return a + (p.amount || 0); }, 0); }
  function renderHold() { var c = A.ctx, w = c.w, V = c.V, b = bk(), G = w.byId[A.grave.id], v = V.cemView(w, G, b), box = document.getElementById('altHoldInfo');
    [['altHold', 'seance'], ['altPledge', 'pledge'], ['altRaiseNow', 'raise']].forEach(function (x) { var e = document.getElementById(x[0]); if (!e) return; var why = holdWhy(x[1]), L = why ? [] : plans(x[1]);
      e.disabled = !!why; e.title = why || (L.length + (L.length === 1 ? ' burn' : ' burns') + ', ' + fmt(cost(L)) + ' XCPETS in all'); var s = e.querySelector('.alt-c'); if (s) s.textContent = why ? '' : ' · ' + fmt(cost(L)) + ' XCPETS'; });
    var rz = document.getElementById('altRaiseNow'); if (rz) rz.hidden = !(v.altar && v.altar.top === c.ME);
    if (box) { var why = holdWhy('seance'), L = why ? [] : plans('seance');
      box.innerHTML = (v.altar ? '<span class="alt-pool">🤝 Altar open: closes in ' + v.altar.closesIn + ' blocks · top giver ' + esc(c.shortAddr(v.altar.top || '')) + (v.altar.top === c.ME ? ' (you)' : '') + ' · ' + v.altar.givers.length + (v.altar.givers.length === 1 ? ' giver' : ' givers') + '</span> ' : '') +
        (why ? '<span class="muted">' + esc(why) + '</span>' : '<span>' + L.length + (L.length === 1 ? ' burn' : ' burns') + ' (each tag fits on chain) · ' + fmt(cost(L)) + ' XCPETS. The last one holds the seance: if you are the top giver the zombie rises in that block; if not, your offerings join the pool.</span>'); } }
  function cap1(s) { s = String(s); return s.charAt(0).toUpperCase() + s.slice(1); }
  function fmt(n) { return Number(n || 0).toLocaleString('en-US'); }
  /* plans(mode): the burn tags for this altar, split so every tag fits in 34 bytes. Gear and pet pledges first, the seance last. */
  function plans(mode) { var c = A.ctx, w = c.w, V = c.V, b = bk(), id = A.grave.id, out = [];
    if (mode === 'raise') return [V.cemPlan(w, 'raise', id, null, b)];
    function num(a, z) { return a - z; }
    function chunks(kind, list) { var res = [], cur = []; list.forEach(function (x) { var t = cur.concat([x]); if (!cur.length || V.cemPlan(w, kind, id, t, b).ok) cur = t; else { res.push(cur); cur = [x]; } }); if (cur.length) res.push(cur); return res; }
    chunks('gear', selGear().map(function (g) { return +String(g.gid).slice(1); }).sort(num)).forEach(function (ch) { out.push(V.cemPlan(w, 'gear', id, ch, b)); });
    var pc = chunks('seance', A.offered.map(function (o) { return o.id; }).sort(num));
    pc.forEach(function (ch, i) { out.push(V.cemPlan(w, mode === 'seance' && i === pc.length - 1 ? 'seance' : 'pledge', id, ch, b)); });
    return out; }
  function hold(mode) { var why = holdWhy(mode); if (why) { toast(why); return; } var L = plans(mode); if (!L.length || L.some(function (p) { return !p.ok; })) { toast('Could not fit the offering in the burn tags'); return; }
    A.sent = L; var url = 'play.html#cem-' + encodeURIComponent(L.map(function (p) { return p.tag; }).join('~')); if (A.ctx.go) A.ctx.go(url); else location.href = url; }
  function renderAll(first) { renderTiles(); renderPower(!first); }
  function toast(s) { var t = document.getElementById('altToast'); if (!t) return; t.textContent = s; t.classList.remove('go'); void t.offsetWidth; t.classList.add('go'); }

  /* ---------------------------------------------------------------- actions ---------------------------------------------------------------- */
  function offer(id, from) { if (A.rise) A.rise = null; var p = A.mine.filter(function (q) { return q.id === id; })[0]; if (!p || p.why || isOn(id)) return false;
    var before = project().exact, o = { kind: 'pet', id: p.id, name: p.name, tier: p.tier, ripe: p.ripe, worn: p.worn, seq: ++A.seq }; A.offered.push(o); o.add = dec(project().exact - before);
    SFX.offer(p.tier); fly(o, from); renderAll(); return true; }
  function takeBack(id) { A.offered = A.offered.filter(function (o) { return o.id !== id; }); A.tally = Math.max(0, A.tally - 1); SFX.back(); renderAll(); kick(); }
  function bind(el) { var R = A.ctx.R;
    el.querySelector('#altX').onclick = close;
    el.querySelector('#altSnd').onclick = function () { A.sound = !A.sound; try { localStorage.setItem('xcpets-cem-sfx', A.sound ? 'on' : 'off'); } catch (e) {} this.textContent = A.sound ? '🔊' : '🔇'; this.setAttribute('aria-pressed', A.sound); if (A.sound) SFX.offer(1); };
    el.querySelector('#altClr').onclick = function () { A.offered = []; A.gear = [0, 0, 0, 0]; A.tally = 0; A.rise = null; A.lastMile = -1; [0, 1, 2, 3].forEach(function (i) { document.getElementById('altG' + i).textContent = 0; }); SFX.back(); renderAll(); kick(); };
    el.querySelector('#altMore').onclick = function () { A.shown += PAGE; renderTiles(); };
    el.querySelector('#altQuick').onclick = function () { var n = 0, L = A.mine.filter(function (p) { return p.ripe && !p.why && p.tier === 0 && !p.worn.length && !isOn(p.id); }); L.slice(0, 5).forEach(function (p, i) { setTimeout(function () { offer(p.id); }, i * (reduced() ? 0 : 140)); n++; }); if (!n) toast('No more ripe Commons'); };
    el.querySelector('.alt-filt').onclick = function (e) { var b = e.target.closest('[data-f]'); if (!b) return; A.filt = b.getAttribute('data-f'); A.shown = PAGE; this.querySelectorAll('[data-f]').forEach(function (q) { q.setAttribute('aria-pressed', q === b); }); renderTiles(); };
    el.querySelector('.alt-gr').onclick = function (e) { var b = e.target.closest('[data-g]'); if (!b) return; var t = +b.getAttribute('data-g'), d = +b.getAttribute('data-d'), n = Math.max(0, Math.min(A.stash[t], A.gear[t] + d)); if (n === A.gear[t]) return;
      A.gear[t] = n; document.getElementById('altG' + t).textContent = n; if (d > 0) { if (reduced()) burnt({ tier: t }); else toss(t); } else { A.tally = Math.max(0, A.tally - 1); SFX.back(); }
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
    el.querySelector('#altHold').onclick = function () { hold('seance'); }; var pl = el.querySelector('#altPledge'); if (pl) pl.onclick = function () { hold('pledge'); }; var rz = el.querySelector('#altRaiseNow'); if (rz) rz.onclick = function () { hold('raise'); };
    A.cv.addEventListener('click', function () { if (!A.offered.length) toast('Tap a pet below, or drag it here'); }); }
  function risenCard() { var P = project(), mi = mile(P.times); var wrap = A.cv && A.cv.parentNode; if (!wrap) return;
    var d = document.createElement('div'); d.className = 'alt-risen'; d.id = 'altRisen'; d.innerHTML = '<b class="meme">RISEN!</b><span>' + esc(A.grave.name) + ' the ' + (mi >= 0 && mi < MILES.length - 1 ? MILES[mi][1] : mi === MILES.length - 1 ? 'Dread (maxed)' : 'Zombie') + ' · ⚡ ' + P.total + ' · ' + P.times.toFixed(2) + ' times</span><small>this is how it looks once the burns confirm · then it lives in <a href="play.html#pets">🧟 My Pets</a>, where you feed it</small>'; wrap.appendChild(d);
    setTimeout(function () { if (d.isConnected) d.classList.add('out'); }, 3800); setTimeout(function () { if (d.isConnected) d.remove(); }, 4300); }
  window.V2CemeteryAltar = { open: open, close: close, project: project, plans: plans, _state: function () { return A; }, _offer: offer, _gear: function (t, n) { A.gear[t] = Math.max(0, Math.min(A.stash[t], n)); renderPower(false); } };
})();
