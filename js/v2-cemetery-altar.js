/* XCPETS Pet Cemetery: THE ALTAR (cemetery loop, Oct 29 2026). Every number comes from the replay engine in js/v2-rules.js:
 * cemPreview (power, times, milestone), cemOfferWhy / cemGearWhy (what can be offered), cemGraveWhy (owner test, closed graves),
 * cemPlan (burn tags, split so each fits 34 bytes) and cemCost (costs follow the halving era). Owner, Oct 28 6:33 PM CT: the main sacrifice
 * happens AT THE SEANCE. Pick a dead pet, offer living pets plus optional stash gear; each offering adds less than the one before, ceiling 3 times.
 * Drag or tap pets onto the altar; each flies in, melts into green smoke, a candle flares and a tally is carved; the power bar lights milestones;
 * "See the rise" plays the claw-from-the-grave. cemetery-handoff (Nov 1 2026): "Hold seance" signs the burns RIGHT HERE (V2Wallet.send, one window
 * per burn, same send guard as play.html), no redirect. The build (offered pets, gear, burns already sent) is saved in localStorage per wallet and
 * restored when the altar reopens, the page reloads or a burn stops. A copyable memo (every burn tag + amount, the pet count and list) is always
 * shown, with a manual-burn fallback. The power number includes the pieces you already gave (held). UI only: every number is still the engine's. */
(function () {
  'use strict';
  /* casatookan-wallet: name the wallet that is actually there (XCP Wallet, or Casa Tookan in its in-app browser) */
  function WL() { return window.V2Wallet && V2Wallet.label ? V2Wallet.label() : 'XCP Wallet'; }
  function inCasa() { return WL() === 'Casa Tookan'; }
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
  /* cemetery-handoff: the pieces you already gave (held on this grave, seance-always-raise) count in the power shown, as they will at the raise */
  function heldNow() { var c = A.ctx, V = c && c.V, b = bk(); if (!c || !c.ME || !A.grave || !V || !V.seanceOn || !V.seanceOn(b) || !V.cemHeld) return null; try { return V.cemHeld(c.w, A.grave.id, c.ME, b); } catch (e) { return null; } }
  /* tap-freeze (Nov 28 2026, Jake: "Page Unresponsive" tapping pets onto the altar quickly, 1,983 offerable pets): one tap re-read every
   * chain row ~300 times (heldParts -> pendParts -> confirmed, once per "+N POWER" guess) and rebuilt the burn plan (cemRunsPlan, which
   * walks the whole wallet) 4-5 times. Answers that cannot change inside one task are now kept for that task only (tm), keyed on
   * everything they read, so nothing stale survives a tap, a new block or a sent burn. Display only: hold() still builds the burns fresh. */
  var TM = null, WID = typeof WeakMap === 'function' ? new WeakMap() : null, WSEQ = 0;
  function wid(w) { if (!WID || !w || typeof w !== 'object') return 0; var n = WID.get(w); if (!n) { n = ++WSEQ; WID.set(w, n); } return n; }
  function tm(k, f) { if (!TM) { TM = {}; Promise.resolve().then(function () { TM = null; }); } if (!Object.prototype.hasOwnProperty.call(TM, k)) TM[k] = f(); return TM[k]; }
  function stateKey() { var c = A.ctx || {}, rows = VS().rows || []; return [A.grave ? A.grave.id : '', bk(), c.ME || '', wid(c.w), rows.length, rows[0] && rows[0].tx_hash, (A.sentLog || []).map(function (x) { return x.txid; }).join(',')].join('|'); }
  function offKey() { return A.offered.map(function (o) { return o.id; }).join(',') + '|' + A.gear.join(','); }
  function heldParts() { return tm('hp|' + stateKey(), heldParts0); }
  function heldParts0() { var E = eng(), hd = heldNow(), pend = pendParts(), seen = {}, pets = [], gear = [];
    (hd ? hd.pets : []).concat(pend.pets).forEach(function (id) { var p = E.w.byId[id]; if (p && !seen[id] && !p.dead) { seen[id] = 1; pets.push(p); } });
    (hd ? hd.gear : []).concat(pend.gear).forEach(function (gid) { var g = E.w.items[gid]; if (g && !seen[gid]) { seen[gid] = 1; gear.push(g); } });
    return { pets: pets, gear: gear, n: hd ? hd.n : 0, hd: hd, pend: pend.pets.length + pend.gear.length }; }
  function project(onlyHeld, extra) { var E = eng(), H = heldParts(), pets = H.pets.concat(onlyHeld ? [] : A.offered.map(function (o) { return E.w.byId[o.id]; }).filter(function (p) { return p && H.pets.indexOf(p) < 0; })).concat(extra || []), P = E.V.cemPreview(E.w, E.G, pets, H.gear.concat(onlyHeld ? [] : selGear()), E.b), out = {};
    STATS.forEach(function (k) { var d = A.base[k] || 0; out[k] = Math.max(d, Math.min(d * CAP, Math.round(d * P.times))); });
    return { stats: out, total: P.power, base: P.deathPower, ceil: P.ceiling, times: P.times, list: P.list, gf: P.gf, exact: P.deathPower * P.times, held: H }; }
  /* offerings shown strongest first, so each line adds less than the one before (the total does not depend on the order) */
  function steps() { var P = project(), keep = 1, prev = P.base, L = P.list.slice().sort(function (a, b) { return b.share - a.share; }), out = [];
    L.forEach(function (e) { keep *= 1 - e.share; var t = P.base * Math.min(CAP, 1 + 2 * (1 - keep)), o; if (e.id != null) { var hp = eng().w.byId[e.id]; o = A.offered.filter(function (q) { return q.id === e.id; })[0] || { kind: 'pet', id: e.id, name: hp ? hp.name : '#' + e.id, tier: hp ? hp.tier | 0 : 0, held: true }; } else { var g = eng().w.items[e.gid]; o = { kind: 'gear', label: (g && g.label || 'Gear') + (e.grave ? ' (the grave\'s own)' : '') + ' · ' + TL[gTier(g)] }; }
      out.push({ o: o, add: dec(t - prev) }); prev = t; }); return out; }
  function dec(v) { return (Math.round(v * 10) / 10).toFixed(1); }

  /* ---------------------------------------------------------------- sound (muted by default) ---------------------------------------------------------------- */
  var AC = null;
  function tone(f, d, at, type, vol) { if (!A.sound) return; try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); var t = AC.currentTime + (at || 0), o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(Math.max(40, f * 0.5), t + d); g.gain.setValueAtTime(vol || 0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d + 0.02); } catch (e) {} }
  var SFX = { offer: function (tier) { tone(330 + tier * 110, 0.09); tone(220 + tier * 80, 0.14, 0.08); }, smoke: function () { tone(140, 0.18, 0, 'triangle', 0.04); }, gore: function (tier) { tone(120 + tier * 40, 0.12, 0.1, 'sawtooth', 0.04); tone(70, 0.18, 0.1, 'square', 0.04); },
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
    for (var hx = 0; hx < AW; hx += 2) { var hh = 4 + Math.round(Math.sin(hx / 17) * 2 + Math.sin(hx / 7)); px(x, '#3c3868', hx, 60 - hh, 2, hh); } bloodSky(x);
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
    carve(x); if (A.dc) x.drawImage(A.dc, 0, 0); bloodRun(x, A.dtl || 16); stains(x); fire(x, t); A.flares.forEach(function (f, j) { if (j < 4 || CAND[j][3]) candle(x, CAND[j], f, t, j); });
  }
  /* the ring on the ground (the seance circle's dashes); blood runs round it both ways from the front as pets are offered (A.bflow 0..1 of the ring) */
  function ring(x, t) { var R = RING, n = 56, fl = A.bflow || 0, head = fl * n;
    for (var a = 0; a < n; a++) { var an = a / n * Math.PI * 2 + Math.PI / 2, rx = Math.round(R.cx + Math.cos(an) * R.rx), ry = Math.round(R.cy + Math.sin(an) * R.ry), bl = fl > 0 && (a < head / 2 + 0.5 || a > n - head / 2 - 0.5);
      px(x, bl ? (a % 3 ? BL[1] : BL[0]) : '#2b2a3a', rx, ry, 2, 1); if (bl && a % 7 === 0) px(x, BL[2], rx, ry, 1, 1); }
    if (fl > 0 && fl < 1 && !reduced()) [head / 2, n - head / 2].forEach(function (h) { var an = h / n * Math.PI * 2 + Math.PI / 2; px(x, BL[3], Math.round(R.cx + Math.cos(an) * R.rx), Math.round(R.cy + Math.sin(an) * R.ry) - (Math.floor(t / 160) % 2), 1, 1); }); }
  /* splats left on the slab edge and running down the altar front, one per pet (fixed spots so frames stay steady) */
  function stains(x) { var pool = Math.min(104, (A.splats || 0) * 5), ph = Math.min(4, 1 + ((A.splats || 0) >> 2)); if (pool) { px(x, BL[0], Math.round(80 - pool / 2), 93, pool, ph + 1); px(x, '#5c0812', Math.round(80 - pool / 2) + 3, 93 + ph, Math.max(0, pool - 6), 1); px(x, BL[1], Math.round(80 - pool / 2) + 2, 93, Math.max(0, pool - 4), ph); px(x, BL[3], Math.round(80 - pool / 4), 93, 3, 1); } var n = Math.min(A.splats || 0, 12); for (var i = 0; i < n; i++) { var sx = 58 + ((i * 37) % 44), sy = 57 + ((i * 11) % 3), dl = 2 + (i * 5) % 6;
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
  /* gory-raise (Jake, Nov 28 2026: "make it gory and sacrificial", "the goal is great visuals"): each pet lands on the slab, the ritual knife drops,
   * it bursts into pixel blood, bone and an eyeball; splats stay on the stone (A.dc, kept for this raise), blood runs down the altar front (A.drips)
   * and pools on the ground, the sky reddens and blood runs from the top edge as the power climbs (A.lvT), and quick taps build CARNAGE x2, x3...
   * (red flash, then shake). Display only: nothing here reads or changes what is offered, the power or the burns. */
  function decal() { if (!A.dc) { A.dc = document.createElement('canvas'); A.dc.width = AW; A.dc.height = AH; } return A.dc.getContext('2d'); }
  function stamp(cx, cy, n, r) { var d = decal(); for (var k = 0; k < n; k++) { var a = Math.random() * Math.PI * 2, q = Math.random() * r, w = 1 + (Math.random() * 3 | 0); d.fillStyle = BL[(Math.random() * 3) | 0]; d.fillRect(Math.round(cx + Math.cos(a) * q * 1.6), Math.round(cy + Math.sin(a) * q * 0.45), w, Math.max(1, w - 1)); } }
  function gore(f) { if (reduced()) { stamp(SPOT.x, SPOT.y + 1, 8, 8); return; } var o = f.o || {}, big = (o.tier | 0) + Math.min(A.combo || 0, 5), n = 10 + big * 4, k;
    A.glow = 1; A.fx.push({ k: 'knife', t: 0, d: 560, side: Math.round(Math.random() * 6 - 3) }); if (f.s) A.fx.push({ k: 'victim', s: f.s, t: 0, d: 230 });
    for (k = 0; k < n; k++) A.fx.push({ k: 'gib', w: 110, x: SPOT.x + (Math.random() * 6 - 3), y: SPOT.y - 3, vx: (Math.random() - 0.5) * 3.4, vy: -1 - Math.random() * 2.2, t: 0, d: 900 + Math.random() * 300, c: BL[k % 4], z: 1 + (Math.random() * 2 | 0), fl: 92 + Math.round(Math.random() * 4), blood: true });
    for (k = 0; k < (big >= 2 ? 2 : Math.random() < 0.6 ? 1 : 0); k++) A.fx.push({ k: 'gib', w: 110, type: k % 2 ? 'eye' : 'bone', x: SPOT.x, y: SPOT.y - 4, vx: (Math.random() - 0.5) * 2.6, vy: -1.6 - Math.random() * 1.2, t: 0, d: 1400, fl: 93 + (k * 2), blood: false });
    stamp(SPOT.x, SPOT.y + 1, 8 + big * 3, 6 + big * 2); A.drips = A.drips || []; for (k = 0; k < 1 + Math.min(2, big); k++) A.drips.push({ x: 57 + Math.round(Math.random() * 44), y: 61, len: 0, max: 4 + Math.random() * 14, v: 0.012 + Math.random() * 0.02, w: 1 }); if (A.drips.length > 24) A.drips.splice(0, A.drips.length - 24);
    var fl = document.getElementById('altFlash'); if (fl && ((A.combo || 0) >= 2 || (o.tier | 0) >= 2)) { fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go'); } if ((A.combo || 0) >= 3) shake(); }
  /* the level in blood: the sky over the altar turns red and blood runs down from the top edge as the power climbs */
  var TOPD = []; (function () { for (var i = 0; i < 14; i++) TOPD.push({ x: 3 + i * 11 + (i * 7) % 4, max: 3 + ((i * 37) % 13), w: 1 + (i % 2) }); })();
  function bloodSky(x) { var lv = A.lvT || 0; if (lv <= 0) return; x.save(); x.globalAlpha = Math.min(0.5, lv * 0.6); px(x, '#78000f', 0, 0, AW, 58); x.restore(); }
  function bloodTop(x, dt) { var lv = A.lvT || 0; A.topL = A.topL || []; TOPD.forEach(function (d, i) { var want = lv * d.max * 2, cur = A.topL[i] || 0; cur += (want - cur) * Math.min(1, dt / 400); A.topL[i] = cur; var L = Math.round(cur); if (L < 1) return; px(x, BL[0], d.x, 0, d.w + 1, L); px(x, BL[1], d.x, 0, d.w, L); px(x, BL[1], d.x - 1, L - 1, d.w + 2, 2); }); }
  function bloodRun(x, dt) { (A.drips || []).forEach(function (d) { d.len = Math.min(d.max, d.len + d.v * dt); var L = Math.round(d.len); if (L < 1) return; px(x, BL[1], d.x, d.y, d.w, L); px(x, BL[3], d.x, d.y + L, d.w, 1); }); }
  function gloom(x) { var g0 = A.glow || 0, lv = A.lvT || 0; if (g0 <= 0 && lv <= 0) return; try { var g = x.createRadialGradient(SPOT.x, 70, 2, SPOT.x, 70, 30 + lv * 50 + g0 * 20); g.addColorStop(0, 'rgba(255,40,60,' + (0.12 + lv * 0.18 + g0 * 0.3) + ')'); g.addColorStop(1, 'rgba(255,40,60,0)'); x.fillStyle = g; x.fillRect(0, 0, AW, AH); } catch (e) {} }
  /* effects: fly (pet into the altar), smoke (green), chips (carving), text pops */
  function fly(o, from) { var s = sprite(o), lt = Math.random() < 0.5; A.fx.push({ k: 'fly', s: s, x0: from ? from.x : (lt ? -12 : AW + 12), y0: from ? from.y : AH - 20 - Math.random() * 20, t: 0, d: from ? 200 : 480, o: o, arc: from ? 18 : 34 + Math.random() * 12, spin: from ? 0 : (lt ? 1 : -1) * (5 + Math.random() * 4) }); kick(); }
  function land(f) { var o = f.o, j = (A.tally + o.seq) % 4; A.flares[j] = 1; A.flares[4 + (A.tally % 6)] = 1; if (o.tier >= 2) A.flares[4 + ((A.tally + 3) % 6)] = 1; A.tally++; splat(); gore(f);
    for (var i = 0; i < 14 + o.tier * 5; i++) A.fx.push({ k: 'smoke', w: 120, x: SPOT.x + (Math.random() * 20 - 10), y: SPOT.y - 6 + Math.random() * 8, vx: Math.random() * 0.6 - 0.3, vy: -(0.25 + Math.random() * 0.6), t: 0, d: 500 + Math.random() * 500, c: ['#8a0f1c', '#5c0812', '#7dff6a', '#3fbf4a'][i % 4], z: i % 3 ? 1 : 2 }); /* gory-raise: a red mist with a little necro green */
    var tx = 59 + (Math.floor((A.tally - 1) / 5) % 4) * 9, ty = 65 + Math.floor((A.tally - 1) / 20) * 10; for (var c = 0; c < 6; c++) A.fx.push({ k: 'chip', x: tx + 3, y: ty + 3, vx: Math.random() * 1.4 - 0.7, vy: -Math.random() * 1.2, t: 0, d: 350 });
    if (o.add !== '' && o.add != null) domPop(o.add, o.tier); if (o.tier >= 2) shake(); SFX.gore(o.tier); if (window.V2CemeteryScene && V2CemeteryScene.flare) V2CemeteryScene.flare(); }
  /* fxStep (was step(f, dt)): renamed Nov 22 2026. It shared its name with the burn-run step() further down, which won, so particles never moved
   * and a finished run called finish() again on every frame while any effect was on screen. */
  function fxStep(f, dt) { if (f.w > 0) { f.w -= dt; return; } f.t += dt; if (f.k === 'gib') { f.x += f.vx * dt / 16; f.y += f.vy * dt / 16; f.vy += 0.09 * dt / 16; if (f.y > f.fl) { f.y = f.fl; f.vx *= 0.3; f.vy = 0; if (!f.stuck) { f.stuck = 1; if (f.blood) stamp(f.x, f.y, 2, 2); } } return; } if (f.k === 'smoke' || f.k === 'chip' || f.k === 'blood' || f.k === 'drip') { f.x += f.vx * dt / 16; f.y += f.vy * dt / 16; if (f.k === 'chip' || f.k === 'blood') f.vy += 0.09 * dt / 16; if (f.k === 'drip') f.vy += 0.03 * dt / 16; if ((f.k === 'blood' || f.k === 'drip') && f.y > (f.fl || 94)) { f.y = f.fl || 94; f.vx = 0; f.vy = 0; } } }
  function drawFx(x) { A.fx.forEach(function (f) { if (f.w > 0) return; var p = Math.min(1, f.t / f.d);
      if (f.k === 'knife') { var ky = p < 0.3 ? Math.round(-18 + (p / 0.3) * (SPOT.y - 12 + 18)) : SPOT.y - 12, kx = SPOT.x + (f.side || 0); x.save(); if (p > 0.7) x.globalAlpha = (1 - p) / 0.3;
        px(x, '#16141f', kx - 2, ky - 1, 5, 14); px(x, '#d7dde6', kx - 1, ky, 3, 13); px(x, '#8f99a8', kx + 1, ky, 1, 13); px(x, '#fff', kx, ky + 12, 1, 2); px(x, '#c9a23a', kx - 4, ky - 2, 9, 2); px(x, '#3a2214', kx - 1, ky - 9, 3, 7); px(x, '#c41e24', kx, ky - 8, 1, 2);
        if (p >= 0.3) { px(x, BL[1], kx - 1, ky + 5, 3, 8); px(x, BL[0], kx - 1, ky + 9, 1, 4); } x.restore(); return; }
      if (f.k === 'victim') { var vs = reduced() ? 0 : Math.round(Math.random() * 2 - 1); x.save(); x.globalAlpha = p < 0.5 ? 1 : 1 - (p - 0.5) * 2; x.imageSmoothingEnabled = false; x.drawImage(f.s, SPOT.x - 9 + vs, SPOT.y - 17, 18, 18); x.restore(); return; }
      if (f.k === 'gib') { x.save(); x.globalAlpha = p > 0.8 ? (1 - p) * 5 : 1; var gx = Math.round(f.x), gy = Math.round(f.y);
        if (f.type === 'bone') { px(x, '#e6dfc4', gx - 2, gy, 5, 1); px(x, '#e6dfc4', gx - 3, gy - 1, 1, 3); px(x, '#e6dfc4', gx + 3, gy - 1, 1, 3); }
        else if (f.type === 'eye') { px(x, '#f4f4f4', gx - 1, gy - 1, 3, 3); px(x, '#111', gx, gy, 1, 1); px(x, BL[1], gx - 2, gy + 1, 1, 1); }
        else px(x, f.c, gx, gy, f.z, f.z); x.restore(); return; }
      if (f.k === 'fly') { var e = f.spin ? p : 1 - Math.pow(1 - p, 3), fx = f.x0 + (SPOT.x - f.x0) * e, fy = f.y0 + (SPOT.y - 12 - f.y0) * e - Math.sin(p * Math.PI) * (f.arc || 18), sz = Math.round(24 - 6 * p), an = reduced() || !f.spin ? 0 : Math.round(p * f.spin / (Math.PI / 2)) * Math.PI / 2; /* thrown: tumbles in quarter turns (pixel look) */
        if (f.s) { x.save(); x.imageSmoothingEnabled = false; x.translate(Math.round(fx), Math.round(fy)); x.rotate(an); x.drawImage(f.s, -sz / 2, -sz / 2, sz, sz); x.restore(); } else px(x, '#e9e3ff', Math.round(fx) - 4, Math.round(fy) - 4, 8, 8); }
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
  function frame(t) { var c = A.cv; if (!c || !c.isConnected) { A.raf = 0; return; } var x = c.getContext('2d'), now = t || performance.now(), dt = A.last ? Math.min(50, now - A.last) : 16; A.last = now; A.dtl = dt; x.imageSmoothingEnabled = false;
    A.fire = Math.max(0, (A.fire || 0) - dt / 900); A.glow = Math.max(0, (A.glow || 0) - dt / 600); A.bflow = Math.min(A.bwant || 0, (A.bflow || 0) + dt / 2200); A.flares = A.flares.map(function (f) { return Math.max(0, f - dt / 520); }); if (A.rise) A.rise.t += dt;
    A.fx.forEach(function (f) { fxStep(f, dt); }); A.fx.filter(function (f) { return f.k === 'toss' && f.t >= f.d; }).forEach(burnt); var landed = A.fx.filter(function (f) { return f.k === 'fly' && f.t >= f.d; }); A.fx = A.fx.filter(function (f) { return f.t < f.d; }); landed.forEach(land);
    if (A.zc) A.zc.getContext('2d').clearRect(0, 0, A.zc.width, A.zc.height); scene(x, now); if (A.rise) drawRise(x); drawFx(x); gloom(x); bloodTop(x, dt); dockDraw();
    var busy = A.fx.length || (A.glow > 0) || (A.drips || []).some(function (d) { return d.len < d.max; }) || A.flares.some(function (f) { return f > 0; }) || (A.rise && !A.rise.done) || A.rise; if (!reduced() && (!A.off || A.dockOn) && (busy || A.offered.length || A.grave)) A.raf = requestAnimationFrame(frame); else A.raf = 0; }
  function kick() { if (!A.raf && A.cv) { A.last = 0; A.raf = requestAnimationFrame(frame); } if (reduced() && A.cv) { A.fx.forEach(function (f) { if (f.k === 'fly') land(f); }); A.fx = []; A.flares = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; frame(performance.now()); } }

  /* ---------------------------------------------------------------- data ---------------------------------------------------------------- */
  function myth(p) { return !!p.mythicCare || p.stage >= 5; }
  function bk() { var c = A.ctx; return c && c.b != null ? c.b : ((c && c.w.tip) || 0) + 1; }
  function wornTiers(w, p) { var V = A.ctx.V, L = []; try { L = (A.ctx.R.worn ? A.ctx.R.worn(w, p.id) : V.wornOf(w, p.id)) || []; } catch (e) { L = []; } return L.map(gTier); }
  function gTier(g) { if (!g) return 0; if (g.legendary) return 3; if (typeof g.tier === 'number') return Math.max(0, Math.min(3, g.tier)); var it = A.ctx.V.itemOf ? A.ctx.V.itemOf(g.item) : null; return it && typeof it.tier === 'number' ? Math.max(0, Math.min(3, it.tier)) : 0; }
  function living(w, who) { return w.pets.filter(function (p) { return V2Own.isLiving(p, who, { zombies: false }); }); }
  /* offer-discards-only-1105: Discard pile = browser localStorage (same key as My Pets). Not on chain; UI enforces "only Discarded" when the gate is on. */
  /* Nov 25 2026 (G Money): the pile is the browser list AND on-chain discards (V2Own.discardSet); the rules accept only the on-chain ones. */
  function discSet() { return V2Own.discardSet(A.ctx && A.ctx.w, A.ctx && A.ctx.ME); }
  function buildMine() { TM = null; A.mineV = (A.mineV || 0) + 1; var w = A.ctx.w, V = A.ctx.V, b = bk(), me = A.ctx.ME, discOnly = !!(V.cemTokenOfferOn && V.cemTokenOfferOn(b)), H = discOnly ? discSet() : null; A.who = me || ''; A.sample = false;
    /* When the gate is on, list ONLY Discarded pets (browser Discard pile). Non-discarded never appear. Tied/tokenized still get cemOfferWhy. */
    A.mine = me ? living(w, me).filter(function (p) { return !discOnly || H[p.id]; }).map(function (p) { var why = V.cemOfferWhy(w, p, me, b); return { id: p.id, name: p.name, tier: p.tier | 0, stage: p.stage, stageName: p.stageName, ripe: !!p.neglected, dies: p.deathBlock, myth: myth(p), why: why, worn: wornTiers(w, p), disc: !!(H && H[p.id]) }; })
      .sort(function (a, b) { return (!!a.why - !!b.why) || (b.ripe - a.ripe) || (a.tier - b.tier) || (a.id - b.id); }) : [];
    A.stash = [0, 0, 0, 0]; A.gearItems = [[], [], [], []]; var items = w.itemList || Object.keys(w.items || {}).map(function (k) { return w.items[k]; });
    if (me) items.forEach(function (g) { if (g && g.owner === me && g.on == null && !g.bag && /^g\d+$/.test(g.gid || '') && !V.cemGearWhy(w, g, me, b)) { var t = gTier(g); A.stash[t]++; A.gearItems[t].push(g); } }); }
  function selGear() { var L = []; (A.gearItems || []).forEach(function (arr, t) { L = L.concat(arr.slice(0, A.gear[t] || 0)); }); return L; }
  /* Page 0 is 24 pets. rest() loads the rest up to the same 5,000 cap as play.html, then any Discard id still missing. */
  function primeOffers() {
    if (!window.xcpLivingFill || !A.ctx) { A.loading = false; return; }
    var me = A.ctx.ME, w = A.ctx.w;
    var wait = !(window.xcpRestDone && xcpRestDone(w)) || !!(window.xcpDiscardMiss && xcpDiscardMiss(me).length);
    A.loading = !!(wait && !(A.mine && A.mine.length));
    if (!wait) return;
    var seq = ++A.fillN;
    window.xcpLivingFill(me).then(function () {
      if (seq !== A.fillN || !A.grave || !A.ctx) return;
      var nw = A.ctx.M && A.ctx.M.world ? A.ctx.M.world() : null;
      if (nw) A.ctx.w = nw;
      A.loading = false;
      var offered = A.offered.slice(), gear = A.gear.slice();
      buildMine();
      A.offered = offered.filter(function (o) { return A.mine.some(function (p) { return p.id === o.id && !p.why; }); });
      gear.forEach(function (n, t) { A.gear[t] = Math.min(A.stash[t] || 0, n); });
      [0, 1, 2, 3].forEach(function (i) { var e = document.getElementById('altG' + i); if (e) e.textContent = A.gear[i]; });
      if (document.getElementById('altTiles')) renderAll(false);
    }, function () { A.loading = false; if (seq === A.fillN && A.grave && document.getElementById('altTiles')) renderTiles(); });
  }

  /* ---------------------------------------------------------------- panel ---------------------------------------------------------------- */
  function host() { var el = document.getElementById('cemAltar'); if (el) return el; el = document.createElement('section'); el.id = 'cemAltar'; el.className = 'cem-altar'; el.hidden = true; el.setAttribute('aria-label', 'Seance at the altar');
    var after = document.getElementById('cemCard') || document.getElementById('cemScene'); after.parentNode.insertBefore(el, after.nextSibling); return el; }
  function open(grave, ctx, again) { if (ctx) A.ctx = ctx; if (!A.ctx || !grave) return; var w = A.ctx.w, wp = w.byId ? w.byId[grave.id] : null;
    /* Living pages omit graves. A raise or seance loads that grave before the altar reads its stats. */
    if (!wp && !again && grave.id !== 1765 && window.V2Split && V2Split.ensurePet) { V2Split.ensurePet(grave.id).then(function () { if (A.ctx.M && A.ctx.M.world) { A.ctx.w = A.ctx.M.world(); if (ctx) ctx.w = A.ctx.w; } open(grave, A.ctx, 1); }); return; }
    var s = wp ? (wp.zDeath || wp.stats) : null, base = {};
    STATS.forEach(function (k) { base[k] = s ? (s[k] || 0) : 0; });
    A.grave = grave; A.base = base; A.offered = []; A.gear = [0, 0, 0, 0]; A.tally = 0; A.splats = 0; A.bwant = 0; A.bflow = 0; A.fire = 0; A.fx = []; A.rise = null; A.dc = null; A.drips = []; A.topL = []; A.glow = 0; A.lvT = 0; A.combo = 0; A.shown = PAGE; A.lastMile = -1; A.seq = 0; buildMine(); primeOffers(); A.ctxW = w; var CE = A.ctx.V.CEM; if (CE) { CAP = CE.CAP; MILES = CE.MILESTONES.map(function (m) { return [m.at, m.name]; }).concat([[CAP, 'Ceiling']]); }
    A.run = null; A.sentLog = []; A.step = 1; A.dig = 0; var rs = A.ctx.ME ? restore() : 0;
    var el = host(); el.hidden = false; el.innerHTML = shell(); A.cv = el.querySelector('#altCv'); A.zc = el.querySelector('#altZc'); bind(el); [0, 1, 2, 3].forEach(function (i) { var e = document.getElementById('altG' + i); if (e) e.textContent = A.gear[i]; }); renderAll(true);
    if (A.restored) toast(rs ? '↩ Restored your unsent offering: ' + rs + ' pet' + (rs === 1 ? '' : 's') : '↩ Restored your unfinished seance');
    if (!A.hooked && A.ctx.M && A.ctx.M.onFresh) { A.hooked = true; A.ctx.M.onFresh(function () { if (A.grave || (A.run && A.run.zombie)) refreshWorld(false); else saveBuild(); /* the cemetery list repaints itself (v2-cemetery-scene.js); no page reload */ }); } poll();
    topGap(); if (!A.rz) { A.rz = true; window.addEventListener('resize', function () { topGap(); dockCheck(); }); window.addEventListener('scroll', function () { if (A.dq) return; A.dq = requestAnimationFrame(function () { A.dq = 0; dockCheck(); }); }, { passive: true }); } A.dockOn = false; if (window.IntersectionObserver && !A.io) { A.io = new IntersectionObserver(function (es) { A.off = !es[0].isIntersecting; dockCheck(); if (!A.off) kick(); }); } if (A.io) { A.io.disconnect(); A.io.observe(A.cv); }
    if (window.V2CemeteryScene && V2CemeteryScene.hooks) V2CemeteryScene.hooks('lit'); kick(); dockCheck(); el.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' }); }
  /* the sticky stage sits just under the site's sticky nav, whatever height the nav wraps to on a phone */
  function topGap() { var n = document.querySelector('.nav'), el = document.getElementById('cemAltar'); if (el) el.style.setProperty('--altTop', ((n && /sticky|fixed/.test(getComputedStyle(n).position)) ? n.offsetHeight + 4 : 0) + 'px'); }
  /* altar-dock: shows when the big altar has scrolled up out of view but the pet tiles are still on screen (steps 1 and 2). Display only. */
  function dockCheck() { var d = document.getElementById('altDock'), el = document.getElementById('cemAltar'), st = el && el.querySelector('.alt-stage'); if (!d || !st || !A.grave || el.hidden) { A.dockOn = false; return; }
    var top = parseFloat(getComputedStyle(el).getPropertyValue('--altTop')) || 0, rs = st.getBoundingClientRect(), re = el.getBoundingClientRect(), vh = window.innerHeight || 800;
    var on = (A.step || 1) < 3 && rs.bottom < top + rs.height * 0.45 && re.bottom > Math.min(vh * 0.55, top + 260);
    /* where it sits: in the empty margin right of the panel when there is room, otherwise over the panel's top right, and the pet grid keeps that corner clear (set by width only, so the grid never jumps while scrolling) */
    var gap = (window.innerWidth || 1200) - re.right, wide = gap >= 252, narrow = !wide && (window.innerWidth || 0) > 760; el.classList.toggle('alt-docknarrow', narrow); d.classList.toggle('side', wide); d.style.left = wide ? Math.round(re.right + 12) + 'px' : ''; if (on === A.dockOn) return; A.dockOn = on; d.hidden = !on; d.classList.toggle('in', on); if (on) { dockDraw(); kick(); } }
  function dockDraw() { if (!A.dockOn || !A.cv) return; var c = document.getElementById('altDockCv'); if (!c) return; var x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(A.cv, 0, 0); if (A.zc) x.drawImage(A.zc, 0, 0, AW, AH); }
  function dockPower(P, mi, rank, bump) { var r = document.getElementById('altDockR'); if (!r) return; var ceil = Math.max(1, P.ceil), base = P.base, sh = base ? Math.min(P.total, ceil) : 0, nx = MILES[mi + 1], gap = nx && base ? Math.max(0, base * nx[0] - P.exact) : 0;
    r.textContent = rank; document.getElementById('altDockN').innerHTML = base + ' → <b>' + P.total + '</b> power'; document.getElementById('altDockB0').style.width = (base / ceil * 100) + '%'; var b1 = document.getElementById('altDockB1'); b1.style.left = (base / ceil * 100) + '%'; b1.style.width = (Math.max(0, sh - base) / ceil * 100) + '%';
    document.getElementById('altDockX').textContent = !base ? '' : nx ? '+' + Math.max(1, Math.ceil(gap)) + ' to ' + nx[1] : 'Maxed'; var d = document.getElementById('altDock'); if (d && bump && !reduced()) { d.classList.remove('bump'); void d.offsetWidth; d.classList.add('bump'); } }
  /* the tapped pet's picture flies from its tile into the dock (the altar copy then shows it landing) */
  function dockFly(id) { if (!A.dockOn || reduced()) return; var src = document.querySelector('#altTiles .alt-tile[data-id="' + id + '"] canvas.alt-sp'), dst = document.getElementById('altDockCv'); if (!src || !dst || !src.animate) return;
    var a = src.getBoundingClientRect(), b = dst.getBoundingClientRect(); if (!a.width || !b.width) return; var g = document.createElement('canvas'); g.width = g.height = 32; g.className = 'alt-flyer'; try { g.getContext('2d').drawImage(src, 0, 0, 32, 32); } catch (e) { return; }
    var sz = Math.min(56, a.width), x0 = a.left + a.width / 2 - sz / 2, y0 = a.top + a.height / 2 - sz / 2, x1 = b.left + b.width * 0.5 - sz / 2, y1 = b.top + b.height * 0.45 - sz / 2; g.style.width = g.style.height = sz + 'px'; g.style.left = x0 + 'px'; g.style.top = y0 + 'px'; document.body.appendChild(g);
    var dx = x1 - x0, dy = y1 - y0, lift = Math.min(120, Math.abs(dy) * 0.25 + 40), an = g.animate([{ transform: 'translate(0,0) rotate(0) scale(1)' }, { transform: 'translate(' + dx * 0.5 + 'px,' + (dy * 0.5 - lift) + 'px) rotate(' + (dx > 0 ? 180 : -180) + 'deg) scale(.9)', offset: 0.5 }, { transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(' + (dx > 0 ? 360 : -360) + 'deg) scale(.35)', opacity: 0.9 }], { duration: 420, easing: 'cubic-bezier(.3,.1,.6,1)' });
    an.onfinish = an.oncancel = function () { g.remove(); }; }
  function close() { if (A.run && A.run.busy) { toast('A burn is being signed. Finish or cancel it in ' + WL() + ' first.'); return; } clearTimeout(A.holdT); A.holdT = 0; try { if (window.V2Wallet && V2Wallet.feeBatchEnd) V2Wallet.feeBatchEnd(); } catch (e) { } if (A.grave) saveBuild(); var el = document.getElementById('cemAltar'); if (el) { el.hidden = true; el.innerHTML = ''; } A.cv = null; A.zc = null; A.grave = null; if (window.V2CemeteryScene && V2CemeteryScene.hooks) V2CemeteryScene.hooks('off'); }
  function headStartNow() { var c = A.ctx, V = c && c.V, w = c && c.w, G = w && A.grave && w.byId ? w.byId[A.grave.id] : null; if (!V || !V.mythicHeadStart || !G) return null; try { return V.mythicHeadStart(w, G, bk()); } catch (e) { return null; } }
  /* the 14-game-day retire rule (v2-rules.js ACTIVATE_RETIRE_DEAD_BLOCK): how long until this grave leaves the cemetery. Display only. */
  function fadeLine() { var c = A.ctx, V = c.V, w = c.w, G = w && A.grave && w.byId ? w.byId[A.grave.id] : null, b = bk(); if (!G || !V.retireDeadOn || !V.retireDeadOn(b) || !V.retireDeathClock || !V.clock || (V.retireSpareWhy && V.retireSpareWhy(G))) return '';
    try { var dc = V.retireDeathClock(w, G, b); if (dc == null) return ''; var per = V.BLOCKS_PER_DAY || 144, left = dc + (V.RETIRE_DEAD_DAYS || 14) * per - V.clock(b); if (!(left > 0)) return '';
      var d = Math.floor(left / per), h = Math.round((left % per) / 6); return '<p class="small alt-fade' + (d < 2 ? ' soon' : '') + '">⏳ This grave fades in ' + (d ? d + ' day' + (d === 1 ? '' : 's') + ' ' : '') + h + ' h. After that it leaves the cemetery and can\'t be raised.</p>'; } catch (e) { return ''; } }
  function hsBanner() { var hs = headStartNow(), c = A.ctx, sa = c.shortAddr, ME = c.ME; if (!hs) return ''; var mine = ME && ME === hs.owner;
    return '<p class="small alt-hs" id="altHs" role="status">Owner\'s head start: only the last owner ' + esc(sa(hs.owner)) + (mine ? ' (you)' : '') + ' can raise this Mythic for ' + fmt(hs.left) + ' more block' + (hs.left === 1 ? '' : 's') + '.' + (mine ? '' : ' <span class="cv2-hs-stop">A seance from this wallet does not count. Offered pets and gear would not be sacrificed, but burned XCPETS stay burned, so Hold seance stays off.</span>') + '</p>'; }
  /* altar-steps (owner Nov 22 2026 "the ui for sacrifice is not good"): one panel, three steps. 1 Offer (pick pets, see what each adds, Fill to next level),
   * 2 Review & sign (what you give up, what you get, the cost, then the burns), 3 Rise (dig up the grave, the meme card). Rules text sits behind "How it works".
   * Same ids, same engine calls and the same burn path as before: only the layout and the effects changed. */
  function shell() { var g = A.grave, sa = A.ctx.shortAddr, ME = A.ctx.ME, V = A.ctx.V, b = bk(), hw = V.cemHw(b), pub = V.cemPublic(b), disc = !!(V.cemTokenOfferOn && V.cemTokenOfferOn(b));
    return '<div class="alt-head"><h2 class="alt-title">🩸 Sacrifice for ' + esc(g.name) + '</h2><div class="alt-tools"><button type="button" class="q" id="altHelpB" aria-expanded="false" aria-controls="altHelp">ⓘ How it works</button><button type="button" class="q" id="altSnd" aria-pressed="' + A.sound + '" title="Sound">' + (A.sound ? '🔊' : '🔇') + '</button><button type="button" class="q" id="altX" aria-label="Close the seance">✕</button></div></div>' +
      '<p class="small alt-who">Raising <b>' + esc(g.name) + '</b> <span class="muted">#' + g.id + ' · ' + esc(g.spl || '') + ' · ' + (g && g.resurrected ? 'God' : (g && (g.mythic || (A.ctx.w.byId[g.id] && (A.ctx.w.byId[g.id].mythicCare || A.ctx.w.byId[g.id].stage >= 5)))) ? 'Mythic' : TL[g.tier]) + ' · owner ' + esc(sa(g.owner)) + (ME && g.owner === ME ? ' (you)' : '') + '</span></p>' +
      hsBanner() + fadeLine() +
      (hw ? '<p class="small alt-hw" id="altHwRow"><span class="alt-hwb" id="altHwB">🎃 Night of the Dead: offerings count 1.5 times (blocks ' + V.CEM.HW_FROM + ' to ' + V.CEM.HW_TO + ')</span></p>' : '') +
      (!pub ? '<p class="small alt-note">🧪 Owner test: until launch only grave #' + V.CEM.OWNER_GRAVE + ' can be raised, and only by the owner wallet.</p>' : '') +
      (!ME ? '<p class="small alt-note">👛 <button type="button" class="q" id="altConn">Connect ' + WL() + '</button> to offer your pets. You stay on this page.</p>' : '') +
      '<div class="alt-help" id="altHelp" hidden><p><b>What you are doing:</b> you give up living pets (and spare gear) to bring this dead pet back as a zombie. The wallet that holds the seance owns it.</p>' +
      '<p><b>More and rarer pets, more power</b>, up to ' + CAP + ' times what it died with. Each pet adds a bit less than the one before. Ripe pets (3+ days unfed) count 1.5 times.</p>' +
      '<p><b>Everything you offer is gone for good</b> once the burns confirm. Worn gear comes off first and stays yours. Mythics, pets on a quest, in a fight, in Cold Storage or in the shop can\'t be offered.' + (disc ? ' <b>Only Discarded pets</b> (🗑️ in My Pets) are listed. Tokenized pets can\'t be offered.' : '') + '</p>' +
      '<p class="muted">Each offering closes a share of the gap left to the ' + CAP + ' times ceiling (pets Common 3%, Uncommon 7%, Rare 14%, Legendary 25%; ripe 1.5 times; gear 1% to 10%; Halloween window: 1.5 times). Older graves and rarer graves give less per offering. Costs follow the current halving era.</p></div>' +
      '<div class="alt-stage"><div class="alt-power"><div class="alt-rank" id="altRank"></div><div class="alt-pnum" id="altNum"></div><div class="alt-bar" id="altBar"><i class="alt-b0"></i><i class="alt-b1"></i><u class="alt-blab" aria-hidden="true">BLOOD SPILLED</u>' + MILES.map(function (m, i) { return '<span class="alt-mk" data-i="' + i + '" style="left:' + (m[0] / CAP * 100) + '%"><em>' + m[1] + '</em></span>'; }).join('') + '</div>' +
      '<p class="small alt-next" id="altNext"></p><p class="small alt-need" id="altNeed"></p><div class="alt-stats" id="altStats"></div></div>' +
      '<div class="alt-cvwrap"><canvas id="altCv" width="' + AW + '" height="' + AH + '" role="img" aria-label="A stone altar with candles beside the grave. Tap pets below to throw them on it."></canvas><canvas id="altZc" width="' + AW * ZK + '" height="' + AH * ZK + '" aria-hidden="true"></canvas><div class="alt-drop" aria-hidden="true">Drop here</div><div class="alt-toast" id="altToast" aria-live="polite"></div><div class="alt-flash" id="altFlash" aria-hidden="true"></div><div class="alt-fxl" id="altFxl" aria-hidden="true"></div><div class="alt-combo" id="altCombo" aria-hidden="true">CARNAGE<b>x2</b></div><button type="button" class="alt-dig" id="altDig" hidden>⛏️ TAP THE GRAVE <span id="altDigN">×3</span></button></div></div>' +
      /* altar-dock (owner Nov 23 2026 "i have to scroll down and cant see the animation"): a small live copy of the altar + power bar that stays on screen while you scroll the pets */
      '<div class="alt-dock" id="altDock" hidden><button type="button" class="alt-dockcv" id="altDockGo" aria-label="Scroll back up to the altar"><canvas id="altDockCv" width="' + AW + '" height="' + AH + '" aria-hidden="true"></canvas><span class="alt-dockfx" id="altDockFx" aria-hidden="true"></span></button><div class="alt-dockp"><b class="alt-dockr" id="altDockR"></b><span class="alt-dockn" id="altDockN"></span><div class="alt-dockbar"><i id="altDockB0"></i><i id="altDockB1"></i></div><span class="alt-dockx" id="altDockX"></span></div></div>' +
      '<div class="alt-steps" id="altSteps" role="list"><div role="listitem" data-s="1">1 · OFFER</div><div role="listitem" data-s="2">2 · REVIEW &amp; SIGN</div><div role="listitem" data-s="3">3 · RISE</div></div>' +
      /* step 1: offer */
      '<div class="alt-pane alt-pick" id="altP1"><div class="alt-pileh"><b>☠️ THE CONDEMNED</b> <span class="small muted" id="altCount"></span></div>' +
      '<div class="alt-filt" role="group" aria-label="Filter">' + [['all', 'All'], ['ripe', '🍂 Ripe'], ['0', 'Common'], ['1', 'Uncommon'], ['2', 'Rare'], ['3', 'Legendary']].map(function (f) { return '<button type="button" class="q" data-f="' + f[0] + '" aria-pressed="' + (A.filt === f[0]) + '">' + f[1] + '</button>'; }).join('') + '</div>' +
      '<p class="small muted alt-how"><span class="alt-howx">Tap a pet to put it under the knife (or drag it onto the altar). Tap it again to spare it. Each card shows the power its blood adds. Ripe 🍂 pets bleed 1.5 times as much.</span></p>' +
      '<p class="small alt-hdnote" id="altHdNote" hidden></p><div class="alt-tiles" id="altTiles"></div><div class="alt-more"><button type="button" class="q" id="altMore">Show more</button></div>' +
      '<div class="alt-quick"><button type="button" class="btn alt-fill" id="altFill">🔪 Fill to next level<small id="altFillSub">sacrifices the cheapest pets that get there</small></button><button type="button" class="q alt-spare" id="altSpare" aria-label="Spare the last pet you put on the altar">↩ Spare</button>' +
      '<button type="button" class="q" id="altAll">🗑️ Offer all</button><button type="button" class="q" id="altClr">↩ Take all back</button></div>' +
      '<details class="alt-fold alt-gear"><summary><b>🎒 Add spare gear</b> <span class="small muted" id="altGearSub">(optional, a smaller boost than a pet; it is sacrificed)</span></summary><div class="alt-gr">' + TL.map(function (t, i) { return '<span class="alt-gs tier-' + TID[i] + '"><span class="pill tier tier-' + TID[i] + '">' + t + '</span> <button type="button" class="q" data-g="' + i + '" data-d="-1" aria-label="One less ' + t + ' gear">−</button> <b id="altG' + i + '">0</b>/' + A.stash[i] + ' <button type="button" class="q" data-g="' + i + '" data-d="1" aria-label="One more ' + t + ' gear">+</button></span>'; }).join('') + '</div></details>' +
      '<details class="alt-fold" id="altLockF" hidden><summary><b id="altLockH"></b> <span class="small muted">see why</span></summary><ul class="small alt-locks" id="altLocks"></ul></details></div>' +
      /* step 2: review & sign */
      '<div class="alt-pane" id="altP2" hidden><h3 class="alt-pact">🩸 The blood pact</h3><div class="alt-rev"><div class="alt-box alt-give"><b class="alt-bh">🔪 You sacrifice (gone for good)</b><div class="alt-minis" id="altGive"></div><p class="small muted" id="altGiveT"></p><div class="alt-tallylist" id="altList"></div></div>' +
      '<div class="alt-box alt-get"><b class="alt-bh">🧟 What rises</b><p id="altGet"></p><table class="alt-gett" id="altGetT"></table></div></div>' +
      '<div class="alt-box"><b class="alt-bh">Cost</b><div class="alt-cost" id="altCost"></div><p class="small alt-holdinfo" id="altHoldInfo" aria-live="polite"></p></div>' +
      '<div class="alt-acts"><button type="button" class="btn" id="altHold" disabled>🕯️ Hold seance<span class="alt-c"></span></button><button type="button" class="btn" id="altRaiseNow" hidden disabled>🧟 Raise now<span class="alt-c"></span></button></div><p class="small alt-raisewhy" id="altRaiseWhy" hidden></p><div class="alt-send" id="altSend"></div></div>' +
      /* step 3: rise */
      '<div class="alt-pane" id="altP3" hidden><p class="alt-digh" id="altDigH">The burns are sent. Now dig it up: tap the grave three times.</p><div class="alt-card" id="altCard" hidden></div><div class="alt-acts alt-acts3"><button type="button" class="q" id="altRise">▶ Watch it rise again</button></div></div>' +
      '<div class="alt-botbar" id="altBot"><div class="alt-sum" id="altSum"></div><button type="button" class="q" id="altBack" hidden>← Back</button><button type="button" class="btn alt-go" id="altGo2" disabled>🩸 Raise it →</button></div>'; }
  function visible() { return A.mine.filter(function (p) { return !p.why && (A.filt === 'all' ? true : A.filt === 'ripe' ? p.ripe : p.tier === +A.filt); }); }
  /* what one pet would add if it went on the altar now (engine preview with that pet added; display only) */
  /* what one more pet adds, without re-running the whole offering for each of up to 300 tiles: the power is base * min(cap, 1 + 2 * (1 - keep)),
   * keep = the product of (1 - share) of every piece (V2Rules.cemPreview), so one more pet multiplies keep by (1 - its share). Same numbers as
   * project(false, [pet]) (tools/cem-altar-tap-test.js). */
  function gainBase() { return tm('gb|' + stateKey() + '|' + offKey(), function () { var P = project(), keep = 1; P.list.forEach(function (e) { keep *= 1 - e.share; }); return { P: P, keep: keep, capT: P.base ? P.ceil / P.base : 0, rest: P.list.length > 0 && P.times === 1 && keep < 1 }; }); }
  function shareOf(wp) { var E = eng(), q = E.V.cemPreview(E.w, E.G, [wp], [], E.b), e = q.list[0]; return e && e.id === wp.id ? e.share : 0; }
  function gainOf(id, base) { var wp = A.ctx.w.byId ? A.ctx.w.byId[id] : null; if (!wp) return 0; try { var g = gainBase(), P = g.P; if (!P.base || g.rest) return 0; var t = Math.min(g.capT, 1 + 2 * (1 - g.keep * (1 - shareOf(wp)))); return Math.max(0, P.base * t - (base == null ? P.exact : base)); } catch (e) { return 0; } }
  function gainOfSlow(id, base) { var wp = A.ctx.w.byId ? A.ctx.w.byId[id] : null; if (!wp) return 0; try { return Math.max(0, project(false, [wp]).exact - (base == null ? project().exact : base)); } catch (e) { return 0; } }
  function gainTxt(g) { return g >= 9.95 ? String(Math.round(g)) : dec(g); }
  function isOn(id) { return A.offered.some(function (o) { return o.id === id; }); }
  /* display only: browser trash-can discards are not on-chain discards once hdOn is live. The engine why stays 'only a discarded pet can be offered'. */
  var HD_WHY = 'only a discarded pet can be offered';
  function hdPlain(n) { return (n === 1 ? 'This pet is' : 'These pets are') + ' only in your browser\'s Discard pile. Go to My Pets and press \'Make my browser discards permanent\', wait for it to confirm, then refresh here.'; }
  function hdExplainHtml(n) { return esc(hdPlain(n)).replace('My Pets', '<a href="play.html#petsPanel">My Pets</a>'); }
  function hdCount() { var n = 0; (A.mine || []).forEach(function (p) { if (p.why === HD_WHY) n++; }); return n; }
  /* seance is blocked only by this when every listed pet is locked for it and none can be offered */
  function onlyChainDiscard() { var n = 0, free = false, other = false; (A.mine || []).forEach(function (p) { if (!p.why) free = true; else if (p.why === HD_WHY) n++; else other = true; }); return n && !free && !other ? n : 0; }
  function lockFace(p) { return p.why === HD_WHY ? 'Discard on chain first' : cap1(p.why); }
  function lockTip(p) { return p.why === HD_WHY ? hdPlain(1) : cap1(p.why); }
  function tile(p) { var on = isOn(p.id), dis = !!p.why;
    return '<label class="alt-tile tier-' + TID[p.tier] + (on ? ' on' : '') + (dis ? ' myth' : '') + (p.ripe && !dis ? ' ripe' : '') + '" data-id="' + p.id + '"' + (dis ? ' title="' + esc(lockTip(p)) + '"' : '') + '>' +
      '<input type="checkbox" data-id="' + p.id + '"' + (on ? ' checked' : '') + (dis ? ' disabled' : '') + ' aria-label="Offer ' + esc(p.name) + ' #' + p.id + '">' +
      '<canvas width="32" height="32" data-sp="' + p.id + '" class="alt-sp"></canvas><span class="alt-tn">' + esc(p.name) + '</span><span class="alt-tm">#' + p.id + ' · <span class="tc">' + (p && p.resurrected ? 'God' : TL[p.tier]) + '</span></span>' +
      '<span class="alt-tags">' + (dis ? '<span class="alt-tag lock">🔒 ' + esc(lockFace(p)) + '</span>' : '') + (p.ripe && !dis ? (p.dies != null && p.dies > bk() && soon(p) ? '<span class="alt-tag dies soon" title="Ripe and unfed: it dies at block ' + p.dies + ' (in ' + Math.max(0, p.dies - bk()) + ' blocks), so it may die before your burns confirm">☠ DIES SOON</span>' : '<span class="alt-tag ripe" title="Ripe: 3+ days unfed, counts 1.5 times' + (p.dies != null ? '. It dies at block ' + p.dies + ' unless it is fed or offered first' : '') + '">🍂 RIPE</span>') : '') + (p.worn.length ? '<span class="alt-tag gear" title="Its worn gear comes off and stays in your stash">🎒' + p.worn.length + ' back</span>' : '') + '</span>' +
      (dis ? '' : on ? '<span class="alt-add on">🔪 SACRIFICED</span>' : '<span class="alt-add">🩸 +' + gainTxt(A.gain ? A.gain[p.id] || 0 : 0) + '</span>') + '</label>'; }
  function renderTiles() { var el = document.getElementById('altTiles'); if (!el) return; var L = visible(), R = A.ctx.R, w = A.ctx.w, b0 = A.grave ? project().exact : 0; A.gain = {}; L.slice(0, A.shown).forEach(function (p) { if (!isOn(p.id)) A.gain[p.id] = gainOf(p.id, b0); });
    /* same tiles as last time (a tap): patch them in place instead of rebuilding up to 48+ tiles and redrawing every pet picture */
    var tk = bk() + '|' + A.mineV + '|' + A.filt + '|' + L.slice(0, A.shown).map(function (p) { return p.id + (p.why ? 'x' : ''); }).join(',');
    if (tk === el._tk && L.length && patchTiles(el, L.slice(0, A.shown))) { tilesTail(el, L); return; } el._tk = tk;
    el.innerHTML = L.slice(0, A.shown).map(tile).join('') || '<p class="small muted" role="status">' + (A.loading ? 'Loading your pets…' : ((A.ctx.V.cemTokenOfferOn && A.ctx.V.cemTokenOfferOn(bk()) && !(A.mine && A.mine.length)) ? 'No Discarded pets to offer. Discard pets in My Pets (🗑️) first. Tokenized pets can\'t be offered.' : 'No pets in this filter.')) + '</p>';
    L.slice(0, A.shown).forEach(function (p) { var c = el.querySelector('canvas[data-sp="' + p.id + '"]'), wp = w.byId ? w.byId[p.id] : null; if (c && wp && wp.art && R.lazy) R.lazy(c, function () { return R.framesWith(wp.art, wp.stage, []); }, true); });
    tilesTail(el, L); }
  function tilesTail(el, L) {
    var note = document.getElementById('altHdNote'), hn = hdCount(); if (note) { note.hidden = !hn; note.innerHTML = hn ? hdExplainHtml(hn) : ''; }
    var m = document.getElementById('altMore'); m.hidden = L.length <= A.shown; m.textContent = 'Show more (' + (L.length - A.shown) + ' left)';
    var ripe = A.mine.filter(function (p) { return p.ripe && !p.why; }).length, my = A.mine.filter(function (p) { return p.why; }).length;
    document.getElementById('altCount').textContent = (A.mine.length - my) + ' can be offered · ' + ripe + ' ripe · ' + A.offered.length + ' on the altar';
    var lf = document.getElementById('altLockF'); if (lf) { var by = {}; A.mine.forEach(function (p) { if (p.why) { var k = lockFace(p); by[k] = (by[k] || 0) + 1; } }); lf.hidden = !my; document.getElementById('altLockH').textContent = '🔒 ' + my + ' of your pets can\'t be offered';
      document.getElementById('altLocks').innerHTML = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; }).map(function (k) { return '<li>' + by[k] + ' · ' + esc(k) + '</li>'; }).join(''); } }
  function patchTiles(el, L) { for (var i = 0; i < L.length; i++) { var p = L[i], t = el.querySelector('.alt-tile[data-id="' + p.id + '"]'); if (!t) return false; if (p.why) continue; var on = isOn(p.id), cb = t.querySelector('input[type=checkbox]'), ad = t.querySelector('.alt-add');
    t.classList.toggle('on', on); if (cb) cb.checked = on; if (ad) { ad.className = 'alt-add' + (on ? ' on' : ''); ad.textContent = on ? '🔪 SACRIFICED' : '🩸 +' + gainTxt(A.gain[p.id] || 0); } } return true; }
  function mile(t) { var mi = -1; MILES.forEach(function (m, i) { if (t + 1e-9 >= m[0]) mi = i; }); return mi; }
  function renderPower(bump, soft) { var P = project(), base = P.base, ceil = Math.max(1, P.ceil), num = document.getElementById('altNum'), bar = document.getElementById('altBar'); if (!num) return;
    var hN = P.held.pets.length + P.held.gear.length, hP = hN ? project(true).total : base, mi = A.offered.length || hN ? mile(P.times) : -1, sh = base ? Math.min(P.total, ceil) : 0;
    A.lvT = (A.offered.length || hN || selGear().length) && CAP > 1 ? Math.max(0, Math.min(1, (P.times - 1) / (CAP - 1))) : 0; var rk = document.getElementById('altRank'); if (rk) rk.textContent = !(A.offered.length || hN || selGear().length) ? 'NOT RISEN YET' : mi < 0 ? 'ZOMBIE' : mi === MILES.length - 1 ? 'MAXED OUT' : MILES[mi][1].toUpperCase();
    num.innerHTML = '<span class="alt-from">' + base + '</span> <span class="muted">→</span> <span class="alt-big" id="altBig">' + P.total + '</span> <span class="small">zombie power · ' + P.times.toFixed(2) + ' times</span> <details class="alt-pd small muted"><summary>details</summary>died with ' + base + (hN ? ' · +' + Math.max(0, hP - base) + ' from the ' + hN + ' piece' + (hN === 1 ? '' : 's') + ' you already gave' + (A.offered.length || selGear().length ? ' · +' + Math.max(0, P.total - hP) + ' from the altar now' : '') : ' · +' + Math.max(0, P.total - base) + ' boost') + ' · ceiling ' + P.ceil + ' (' + CAP + ' times)' + (P.gf < 1 ? ' · grave strength ' + Math.round(P.gf * 100) + '%' : '') + '</details>';
    renderNext(P, mi); dockPower(P, mi, rk ? rk.textContent : '', bump);
    bar.querySelector('.alt-b0').style.width = (base / ceil * 100) + '%'; bar.querySelector('.alt-b1').style.width = (Math.max(0, sh - base) / ceil * 100) + '%'; bar.querySelector('.alt-b1').style.left = (base / ceil * 100) + '%';
    bar.querySelectorAll('.alt-mk').forEach(function (m) { var i = +m.getAttribute('data-i'); m.classList.toggle('hit', i <= mi); m.classList.toggle('next', i === mi + 1); });
    bar.classList.toggle('near', P.times >= 2.5);
    if (bump && !reduced()) { bar.classList.remove('bump'); void bar.offsetWidth; bar.classList.add('bump'); var b = document.getElementById('altBig'); if (b) { b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); } }
    if (mi > A.lastMile && A.lastMile >= -1 && bump) { banner(mi); SFX.mile(); } A.lastMile = mi;
    document.getElementById('altStats').innerHTML = STATS.map(function (k) { return '<span><b>' + k.charAt(0).toUpperCase() + k.slice(1) + '</b> ' + (A.base[k] || 0) + ' → <i>' + P.stats[k] + '</i></span>'; }).join('');
    var st = steps(); document.getElementById('altList').innerHTML = st.length ? '<b class="small">Offerings, strongest first</b> <span class="small muted">(each adds less; power before rounding)</span><ol>' + st.slice(0, 30).map(function (s) { var o = s.o;
      return '<li>' + (o.kind === 'gear' ? '🎒 ' + esc(o.label) : esc(o.name) + ' <span class="muted">#' + o.id + '</span> · ' + (o && o.resurrected ? 'God' : TL[o.tier]) + (o.ripe ? ' · 🍂 ripe' : '') + (o.held ? ' · <span class="muted">already given</span>' : '')) + ' <b>+' + s.add + '</b>' + (o.kind === 'pet' && !o.held ? ' <button type="button" class="linkish" data-back="' + o.id + '" aria-label="Take back #' + o.id + '">↩</button>' : '') + '</li>'; }).join('') + '</ol>' + (st.length > 30 ? '<p class="small muted">…and ' + (st.length - 30) + ' more, each adding less.</p>' : '') : '<p class="small muted">The altar is bare. Offer a pet to wake the candles.</p>';
    document.getElementById('altRise').disabled = !A.offered.length && A.step !== 3; if (soft) holdSoon(); else { if (A.holdT) { clearTimeout(A.holdT); A.holdT = 0; } renderHold(); } }
  /* the burn buttons: every check here mirrors the engine (cemGraveWhy, cemMinWhy, top giver); play.html's send guard checks again before signing */
  function holdWhy(mode) { var c = A.ctx, V = c.V, w = c.w, b = bk(), G = w.byId[A.grave.id];
    if (!c.ME) return 'Connect ' + WL() + ' first (button above)'; var gw = V.cemGraveWhy(w, G, c.ME, b); if (gw) return cap1(gw);
    if (mode === 'raise' && V.seanceOn && V.seanceOn(b)) { var vh = V.cemView(w, G, b), hd = V.cemHeld(w, G.id, c.ME, b); /* SEANCE ALWAYS RAISES: Raise now = finish your own seance with the pieces you hold */
      if (!hd) { var d0 = deadPledges(); return d0.n ? 'Your ' + d0.n + ' given ' + (d0.n === 1 ? 'pet' : 'pets') + ' died at block ' + d0.at + ' and no longer count. Offer pets again, including at least 1 ' + needTxt(vh.need) + ' pet, and press Hold seance.' : 'You have not given any pets to this grave yet, so there is nothing to raise with. Offer pets and press Hold seance.'; }
      if (!hd.pets.some(function (id) { var p = w.byId[id]; return p && (p.tier | 0) >= vh.need; }) && !hd.gear.some(function (gid) { var g = w.items[gid]; return g && gTier(g) >= vh.need; })) return 'The ' + hd.n + ' piece' + (hd.n === 1 ? '' : 's') + ' you already gave (' + tierMix(hd) + ') are not enough on their own: a ' + TL[A.grave.tier] + ' grave needs at least 1 ' + needTxt(vh.need) + ' pet or gear. Add one below and press Hold seance (your given pieces still count).';
      return null; }
    if (mode === 'raise') { var v = V.cemView(w, G, b); if (!v.altar) return 'No open altar on this grave'; if (v.altar.top !== c.ME) { var dd = deadPledges(); return dd.n ? 'Your ' + dd.n + ' offered ' + (dd.n === 1 ? 'pet' : 'pets') + ' died at block ' + dd.at + ' and no longer count. Hold a new seance with 1 living ' + TL[v.need] + '+ pet.' : 'Only the top giver can raise'; } return null; }
    if (!A.offered.length) { var hdN = onlyChainDiscard(); return hdN ? hdPlain(hdN) : 'Offer at least 1 living pet'; }
    if (mode === 'seance') { var v2 = V.cemView(w, G, b), need = v2.need, sOn = V.seanceOn && V.seanceOn(b), h2 = sOn ? V.cemHeld(w, G.id, c.ME, b) : null, ok = A.offered.some(function (o) { return o.tier >= need; }) || selGear().some(function (g) { return gTier(g) >= need; }) ||
        (sOn ? pendParts().pets.some(function (id) { var p = w.byId[id]; return p && !p.dead && (p.tier | 0) >= need; }) || pendParts().gear.some(function (gid) { var g = w.items[gid]; return g && gTier(g) >= need; }) : false) || (sOn ? !!h2 && (h2.pets.some(function (id) { var p = w.byId[id]; return p && (p.tier | 0) >= need; }) || h2.gear.some(function (gid) { var g = w.items[gid]; return g && gTier(g) >= need; })) : (v2.altar && v2.altar.givers.length)); if (!ok) return 'A ' + TL[A.grave.tier] + ' grave needs at least 1 ' + needTxt(need) + ' pet or gear among your offerings. Add one.'; }
    return null; }
  function needTxt(t) { return t >= 3 ? 'Legendary' : t <= 0 ? 'living' : TL.slice(t).join(' or '); }
  function tierMix(hd) { var w = A.ctx.w, n = [0, 0, 0, 0]; hd.pets.forEach(function (id) { var p = w.byId[id]; if (p) n[Math.max(0, Math.min(3, p.tier | 0))]++; }); hd.gear.forEach(function (gid) { var g = w.items[gid]; if (g) n[gTier(g)]++; });
    return n.map(function (k, i) { return k ? k + ' ' + TL[i] : ''; }).filter(Boolean).join(', ') || 'none'; }
  /* die-soon warning (UI only): a pet that dies before its burn confirms, or before the raise when it joins someone else's pool, no longer counts */
  var SOON = 6;
  function limit() { var c = A.ctx, v = A.grave && c.w.byId[A.grave.id] ? c.V.cemView(c.w, c.w.byId[A.grave.id], bk()) : null; return v && v.altar && !v.altar.seance && v.altar.top && v.altar.top !== c.ME ? Math.max(SOON, v.altar.closesIn || 0) : SOON; }
  function soon(p, n) { return p && p.dies != null && p.dies - bk() <= (n == null ? SOON : n); }
  function dieWarn() { var n = limit(), L = A.offered.filter(function (o) { return o.kind === 'pet' && o.dies > bk() && soon(o, n); /* same test as the tile's DIES SOON tag: a death block already passed on a living pet is an old stamp (it lived on), not a warning that it dies before the burns confirm */ }); if (!L.length) return '';
    var at = Math.min.apply(null, L.map(function (o) { return o.dies; }));
    return '<span class="alt-diewarn">⚠ ' + L.length + ' offered ' + (L.length === 1 ? 'pet dies' : 'pets die') + ' soon (' + (L.length === 1 ? 'at' : 'first at') + ' block ' + at + '). ' + (n > SOON ? 'This altar is led by someone else and closes in ' + n + ' blocks; a pet that dies before the raise no longer counts.' : 'If ' + (L.length === 1 ? 'it dies' : 'they die') + ' before your burns confirm, ' + (L.length === 1 ? 'it no longer counts' : 'they no longer count') + '.') + '</span> '; }
  /* the viewer's pets offered (held) on this grave's open altar that have died since (the engine stops counting them at the raise, cemCheck); UI only, reads the world */
  function deadPledges() { var c = A.ctx, w = c.w, V = c.V, b = bk(), Al = w.cem && w.cem.altars ? w.cem.altars[A.grave.id] : null, n = 0, at = 0, seen = {};
    if (!c.ME || !Al || Al.status !== 'open') return { n: 0, at: 0 };
    (Al.pledges || []).forEach(function (pl) { if (pl.src !== c.ME) return; (pl.pets || []).forEach(function (e) { var p = w.byId[e.id]; if (!p || seen[e.id]) return; seen[e.id] = 1;
      if (V.cemOfferWhy(w, p, c.ME, b, false) === 'dead' && p.pledge === A.grave.id) { n++; at = Math.max(at, p.deathBlock || 0); } }); });
    return { n: n, at: at }; }
  /* cemetery runs are priced PER PET (owner Oct 31 2026): show pets times the per-pet fee (+ the raise) so the total adds up */
  function perPet(L) { var c = A.ctx, V = c.V, b = bk(), n = 0; if (!V.cemRunsOn || !V.cemRunsOn(b)) return ''; L.forEach(function (p) { var t = p.runs ? null : V.parseTag(p.tag || ''); n += p.runs ? (p.ids || []).length : t && /^(alt|seance)$/.test(t.action) ? (t.ids || []).length : 0; }); if (!n) return '';
    return ' (' + fmt(n) + ' pet' + (n === 1 ? '' : 's') + ' times ' + fmt(V.cemCost(c.w, 'pledge', b)) + (L.some(function (p) { return /^pet:sr:/i.test(p.tag || ''); }) ? ' + raise ' + fmt(V.cemCost(c.w, 'raise', b)) : '') + ')'; }
  function cost(L) { return L.reduce(function (a, p) { return a + (p.amount || 0); }, 0); }
  function renderHold() { var c = A.ctx, w = c.w, V = c.V, b = bk(), G = w.byId[A.grave.id], v = V.cemView(w, G, b), box = document.getElementById('altHoldInfo');
    [['altHold', 'seance'], ['altRaiseNow', 'raise']].forEach(function (x) { var e = document.getElementById(x[0]); if (!e) return; var why = holdWhy(x[1]), L = why ? [] : plansV(x[1]);
      e.disabled = !!why; e.title = why || (L.length + (L.length === 1 ? ' burn' : ' burns') + ', ' + fmt(cost(L)) + ' XCPETS in all'); var s = e.querySelector('.alt-c'); if (s) s.textContent = why ? '' : ' · ' + fmt(cost(L)) + ' XCPETS'; });
    var rz = document.getElementById('altRaiseNow'), rw = document.getElementById('altRaiseWhy'), rwhy = holdWhy('raise'), sOn = V.seanceOn && V.seanceOn(b), held = sOn && c.ME ? V.cemHeld(w, G.id, c.ME, b) : null,
      mine = sOn ? !!(c.ME && (held || deadPledges().n)) : v.altar && c.ME && (v.altar.top === c.ME || deadPledges().n || v.altar.givers.some(function (g) { return g.src === c.ME; }));
    if (rz) rz.hidden = !mine; if (rw) { rw.hidden = !(mine && rwhy); rw.textContent = mine && rwhy ? '🧟 Raise now is off: ' + rwhy : ''; }
    var root = document.getElementById('cemAltar'), hsLock = headStartNow(); if (root) root.classList.toggle('alt-locked', !!(hsLock && c.ME && c.ME !== hsLock.owner));
    if (box) { var why = holdWhy('seance'), L = why ? [] : plansV('seance');
      box.innerHTML = dieWarn() + (sOn ? (held ? '<span class="alt-pool">🕯️ Already given by you: ' + held.n + ' piece' + (held.n === 1 ? '' : 's') + ' (' + tierMix(held) + ') from your earlier burns. They are saved on this grave for you only until block ' + fmt(held.closesAt) + ' (' + hrs(held.closesAt) + '), and they are already in the power number above. To raise: press Hold seance with more pets, or Raise now to raise with just these.</span> ' : '') : v.altar ? '<span class="alt-pool">🤝 Altar open: closes in ' + v.altar.closesIn + ' blocks · ' + (v.altar.top ? 'top giver ' + esc(c.shortAddr(v.altar.top)) + (v.altar.top === c.ME ? ' (you)' : '') + ' · ' + v.altar.givers.length + (v.altar.givers.length === 1 ? ' giver' : ' givers') : 'no living offerings') + '</span> ' : '') +
        (why ? holdHint(why) : '<span>' + L.length + (L.length === 1 ? ' burn' : ' burns') + ' (each tag fits on chain) · ' + fmt(cost(L)) + ' XCPETS' + perPet(L) + (sOn ? '. The last burn is the seance: the zombie rises for you when it confirms, with everything you gave (earlier pieces included).</span>' : '. The last one holds the seance: if you are the top giver the zombie rises in that block; if not, your offerings join the pool.</span>'));
      box.innerHTML += ' <span class="muted alt-fresh">Chain data up to block ' + fmt(w.tip) + (updating() ? ' · updating…' : '') + ' <button type="button" class="linkish" id="altRefresh">↻ refresh</button></span>'; var rf = document.getElementById('altRefresh'); if (rf) rf.onclick = function () { refreshWorld(true); }; }
    renderSend(); renderStep(); }
  function cap1(s) { s = String(s); return s.charAt(0).toUpperCase() + s.slice(1); }
  function holdHint(why) { var n = onlyChainDiscard(); if (n && why === hdPlain(n)) return '<span class="alt-hdwhy">' + hdExplainHtml(n) + '</span>'; return '<span class="muted">' + esc(why) + '</span>'; }
  function fmt(n) { return Number(n || 0).toLocaleString('en-US'); }
  /* plans(mode): the burn tags for this altar, split so every tag fits in 34 bytes. Gear and pet parts first, the seance last. */
  /* the same plans for the screen, built once per task (tm) instead of 4-5 times per tap; hold() signs from a fresh plans() */
  function plansV(mode) { return tm('pl|' + mode + '|' + stateKey() + '|' + offKey(), function () { return plans(mode); }).slice(); }
  function plans(mode) { var c = A.ctx, w = c.w, V = c.V, b = bk(), id = A.grave.id, out = [];
    if (mode === 'raise') return [V.cemPlan(w, 'raise', id, null, b)];
    function num(a, z) { return a - z; }
    function chunks(kind, list) { var res = [], cur = []; list.forEach(function (x) { var t = cur.concat([x]); if (!cur.length || V.cemPlan(w, kind, id, t, b).ok) cur = t; else { res.push(cur); cur = [x]; } }); if (cur.length) res.push(cur); return res; }
    chunks('gear', selGear().map(function (g) { return +String(g.gid).slice(1); }).sort(num)).forEach(function (ch) { out.push(V.cemPlan(w, 'gear', id, ch, b)); });
    var pc = chunks('seance', A.offered.map(function (o) { return o.id; }).sort(num));
    var rn = A.offered.length && V.cemRunsPlan ? V.cemRunsPlan(w, mode === 'seance' ? 'seance' : 'pledge', id, A.offered.map(function (o) { return o.id; }), c.ME, b) : null; /* CEMETERY RUNS: fewest burns (usually 1) */
    if (rn && rn.length <= pc.length) return out.concat(rn); /* fewest burns; priced per pet either way: pets x pledge (+ the raise on the seance) */
    pc.forEach(function (ch, i) { var q = V.cemPlan(w, mode === 'seance' && i === pc.length - 1 ? 'seance' : 'pledge', id, ch, b); out.push(V.cemPetAmount ? V.cemPetAmount(w, q, b) : q); });
    return out; }
  function hold(mode) { if (A.run && A.run.busy) return; var why = holdWhy(mode); if (why) { toast(why); return; } var L = plans(mode); if (!L.length || L.some(function (p) { return !p.ok; })) { toast('Could not fit the offering in the burn tags'); return; }
    A.sent = L; startRun(mode === 'raise' ? '🧟 Raise now' : '🕯️ Seance', L, mode); }

  /* ---------------------------------------------------------------- cemetery-handoff (Nov 1 2026): save, memo, sign here ---------------------------------------------------------------- */
  var BK = 'xcpets-cem-build-v1-', KEEP = 24 * 3600e3, SENT_KEEP = 6 * 3600e3;
  function M_() { return A.ctx && A.ctx.M; }
  function VS() { try { var M = M_(); return M && M.state ? M.state() : {}; } catch (e) { return {}; } }
  function updating() { try { var M = M_(); return !!(M && M.updating && M.updating()); } catch (e) { return false; } }
  function hrs(b) { var t = (A.ctx.w.tip || 0), n = Math.max(0, b - t); return n * 10 < 90 ? 'about ' + Math.max(1, n * 10) + ' min' : 'about ' + Math.round(n * 10 / 60) + ' h'; }
  function store() { try { var o = JSON.parse(localStorage.getItem(BK + (A.ctx.ME || '')) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } }
  function storeSet(o) { try { var now = Date.now(); Object.keys(o).forEach(function (k) { var b = o[k]; if (!b || now - (b.at || 0) > KEEP) delete o[k]; }); if (Object.keys(o).length) localStorage.setItem(BK + (A.ctx.ME || ''), JSON.stringify(o)); else localStorage.removeItem(BK + (A.ctx.ME || '')); } catch (e) {} }
  var CF = { r: null, n: -1, h: null, c: {} };
  function confirmed() { var rows = VS().rows || [], h = rows[0] && rows[0].tx_hash; if (CF.r !== rows || CF.n !== rows.length || CF.h !== h) { var c = {}; rows.forEach(function (r) { c[r.tx_hash] = 1; }); CF = { r: rows, n: rows.length, h: h, c: c }; } return CF.c; }
  function sentLog() { var now = Date.now(); A.sentLog = (A.sentLog || []).filter(function (x) { return now - (x.at || 0) < SENT_KEEP; }); return A.sentLog; }
  function pendParts() { var o = { pets: [], gear: [] }, L = sentLog(); if (!L.length) return o; var c = confirmed(); L.forEach(function (x) { if (c[x.txid]) return; (x.ids || []).forEach(function (id) { o.pets.push(id); }); (x.gids || []).forEach(function (g) { o.gear.push(g); }); }); return o; }
  function sentIds() { var o = {}; pendParts().pets.forEach(function (id) { o[id] = 1; }); return o; }
  function saveBuild() { if (!A.ctx || !A.ctx.ME || !A.grave) return; var o = store(), r = A.run && !A.run.done ? { title: A.run.title, mode: A.run.mode, left: A.run.plans.slice(A.run.i).map(function (p) { return p.tag; }) } : null;
    if (!A.offered.length && !selGear().length && !sentLog().length && !r) delete o[A.grave.id];
    else o[A.grave.id] = { name: A.grave.name, offered: A.offered.map(function (q) { return q.id; }), gear: A.gear.slice(), sent: sentLog(), run: r, at: Date.now() };
    storeSet(o); }
  /* restore the saved build of this grave (pets still offerable only; pets already sent stay out) */
  function restore() { var b = store()[A.grave.id]; if (!b) return 0; A.sentLog = b.sent || []; var pend = sentIds(), n = 0;
    (b.offered || []).forEach(function (id) { var p = A.mine.filter(function (q) { return q.id === id; })[0]; if (!p || p.why || pend[id] || isOn(id)) return; A.offered.push({ kind: 'pet', id: p.id, name: p.name, tier: p.tier, ripe: p.ripe, dies: p.dies, worn: p.worn, seq: ++A.seq }); n++; });
    (b.gear || []).forEach(function (k, t) { A.gear[t] = Math.max(0, Math.min(A.stash[t] || 0, k | 0)); });
    A.tally = n; A.restored = n + (b.run && b.run.left && b.run.left.length ? 1 : 0) ? { n: n, run: b.run } : null; return n; }
  function idsOf(p) { if (p.ids && p.ids.length) return p.ids.slice(); if (p.petIds) return p.petIds.slice(); var t = A.ctx.V.parseTag(p.tag || ''); return t && t.ids && !/^(altg|rplg)$/.test(t.action) ? t.ids.slice() : []; }
  function gidsOf(p) { var t = A.ctx.V.parseTag(p.tag || ''); return t && /^(altg|rplg)$/.test(t.action) && t.ids ? t.ids.map(function (n) { return 'g' + n; }) : []; }
  function petName(id) { var p = A.ctx.w.byId[id]; return '#' + id + (p ? ' ' + p.name + ' (' + ((p && p.resurrected) ? 'God' : TL[Math.max(0, Math.min(3, p.tier | 0))]) + ')' : ''); }
  /* the plans the memo shows: an unfinished run first, then what Hold seance (or Raise now) would send right now */
  function memoPlans() { if (!A.grave) return { L: A.run ? A.run.plans.slice(A.run.i) : [], why: '' }; if (A.run && !A.run.done && A.run.i < A.run.plans.length) return { L: A.run.plans.slice(A.run.i), why: '', mode: A.run.mode };
    if (A.offered.length || selGear().length) { var w1 = holdWhy('seance'); return { L: w1 ? [] : plansV('seance'), why: w1, mode: 'seance' }; }
    var hd = heldNow(); if (hd) { var w2 = holdWhy('raise'); return { L: w2 ? [] : plansV('raise'), why: w2, mode: 'raise' }; } return { L: [], why: '' }; }
  function memoText(m) { var c = A.ctx, g = A.grave, L = m.L, pets = [], seen = {}, tot = 0, H = g ? heldParts() : { pets: [], gear: [] };
    L.forEach(function (p) { idsOf(p).forEach(function (id) { if (!seen[id]) { seen[id] = 1; pets.push(id); } }); tot += Number(p.amount || 0); });
    if (!L.length) A.offered.forEach(function (o) { if (!seen[o.id]) { seen[o.id] = 1; pets.push(o.id); } });
    var out = ['XCPETS ' + (g ? (m.mode === 'raise' ? 'Raise now' : 'seance') + ' for grave #' + g.id + ' ' + g.name + ' (' + TL[g.tier] + ' ' + (g.spl || '') + ')' : (A.run && A.run.title || 'cemetery burns')), 'Wallet: ' + (c.ME || '(not connected)') + ' · chain data block ' + fmt(c.w.tip || 0)];
    var pd = sentIds(), hp = H.pets.filter(function (p) { return !pd[p.id]; }), sp = H.pets.filter(function (p) { return pd[p.id]; }), hg = (H.hd ? H.hd.gear.length : 0);
    if (g && hp.length + hg) out.push('Already given (held on this grave, not burned again): ' + (hp.length + hg) + ' piece' + (hp.length + hg === 1 ? '' : 's') + (hp.length ? ': ' + hp.map(function (p) { return petName(p.id); }).join(', ') : ''));
    if (g && sp.length) out.push('Sent, waiting to confirm (do not send again): ' + sp.length + ' pet' + (sp.length === 1 ? '' : 's') + ': ' + sp.map(function (p) { return petName(p.id); }).join(', '));
    out.push((L.length ? 'Pets in these burns: ' : 'Pets you picked: ') + pets.length + (pets.length ? ': ' + pets.map(petName).join(', ') : ''));
    var gs = L.reduce(function (a, p) { return a.concat(gidsOf(p)); }, []); if (!L.length) gs = selGear().map(function (x) { return x.gid; }); if (gs.length) out.push('Stash gear: ' + gs.length + ': ' + gs.join(', '));
    if (!L.length) { out.push(m.why ? 'Not ready to send: ' + m.why : 'Nothing to send yet.'); return out.join('\n'); }
    out.push('Burns to send, in this order (' + L.length + ', ' + fmt(tot) + ' XCPETS in all). Each = destroy XCPETS, amount, memo/tag exactly as shown:');
    L.forEach(function (p, i) { var n = idsOf(p).length, k = gidsOf(p).length; out.push((i + 1) + ') ' + fmt(p.amount) + ' XCPETS  memo: ' + p.tag + '  (' + (n ? n + ' pet' + (n === 1 ? '' : 's') : k ? k + ' gear' : /^pet:(sr|seance|raise)/.test(p.tag) ? 'the raise' : 'burn') + (/^pet:(sr:|seance:|raise:)/.test(p.tag) ? ', this one raises the zombie' : '') + ')'); });
    return out.join('\n'); }
  function copyText(s, btn) { function ok() { if (btn) { var t = btn.textContent; btn.textContent = '✓ Copied'; setTimeout(function () { btn.textContent = t; }, 1600); } }
    function fb() { var ta = document.getElementById('altMemo'); if (!ta) return; ta.focus(); ta.select(); try { document.execCommand('copy'); ok(); } catch (e) { toast('Select the memo and copy it'); } }
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(s).then(ok, fb); else fb(); } catch (e) { fb(); } }
  function renderSend() { var el = document.getElementById('altSend'); if (!el || !A.ctx) return; var m = memoPlans(), txt = memoText(m), c = A.ctx, cf = confirmed(), R = A.run, tot = m.L.reduce(function (a, p) { return a + Number(p.amount || 0); }, 0);
    var sl = sentLog().filter(function (x) { return !cf[x.txid]; });
    el.innerHTML = (window.V2Wallet && V2Wallet.feeUiOn && V2Wallet.feeUiOn() ? '<div data-nfee="' + Math.max(1, m.L.length || 1) + '"></div>' : '') + (R && !R.done && R.i < R.plans.length ? '<p class="small alt-run"><b>' + esc(R.title) + ':</b> ' + R.i + ' of ' + R.plans.length + ' burn' + (R.plans.length === 1 ? '' : 's') + ' sent.' + (R.busy ? '' : ' <button type="button" class="btn" id="altGo">▶ Continue from burn ' + (R.i + 1) + '</button> <button type="button" class="linkish" id="altDrop">forget the rest</button>') + '</p>' : '') +
      '<div class="alt-pgw"><div class="bar"><i id="altPgBar" style="width:' + (R && R.plans.length ? 100 * R.i / R.plans.length : 0) + '%"></i></div><div class="small" id="altPg" aria-live="polite">' + (R && R.msg ? R.msg : (m.L.length ? m.L.length + ' burn' + (m.L.length === 1 ? '' : 's') + ', ' + fmt(tot) + ' XCPETS. Press ' + (m.mode === 'raise' ? 'Raise now' : 'Hold seance') + ' to sign ' + (m.L.length === 1 ? 'it' : 'them') + (WL() !== 'XCP Wallet' ? ' here in ' + WL() + ', one approval per burn. You stay on this page.' : ' here in XCP Wallet, one window per burn. You stay on this page.') : '')) + '</div></div>' +
      (m.L.length ? '<p class="small risk-short risk-sign">⚠️ This is experimental software. Token burns are irreversible. You can lose XCPETS and Bitcoin transaction fees. No one guarantees this game will work as expected or that the token will retain any value. Use at your own risk.</p>' : '') + /* calm-first-screen: the full warning on the signing sheet */
      (sl.length ? '<p class="small alt-sent">⏳ Sent, waiting to confirm: ' + sl.map(function (x) { return '<code>' + esc(x.tag) + '</code> <a target="_blank" rel="noopener" href="https://mempool.space/tx/' + esc(x.txid) + '">' + esc(String(x.txid).slice(0, 8)) + '… ↗</a>'; }).join(' · ') + '. This page checks the chain every minute; the pets move to "Already given" once a block confirms them.</p>' : '') +
      '<details class="alt-fold alt-adv"><summary><b>Advanced: burn memo and manual burn</b></summary><div class="alt-memoh"><b>📋 Your burn memo</b> <span class="small muted">(stays on this page and in this browser; copy it any time)</span> <button type="button" class="q" id="altCopy">Copy memo</button></div>' +
      '<textarea id="altMemo" class="alt-memo" readonly rows="' + Math.min(10, Math.max(3, txt.split('\n').length)) + '" aria-label="Burn memo: every burn tag and amount, and the pets in them">' + esc(txt) + '</textarea>' +
      '<details class="small alt-manual"><summary>Manual burn (only if Sign &amp; burn keeps failing)</summary><ol><li>Copy the memo above.</li><li>In ' + WL() + ', from this same wallet (' + esc(c.ME ? c.shortAddr(c.ME) : 'connect it first') + '), make a Counterparty <b>destroy</b> of <b>XCPETS</b>.</li><li>Quantity = the amount on line 1; tag/memo = the text after "memo:" on line 1, exactly, no spaces.</li><li>Send it, then do line 2, and so on, in order. The burn that raises the zombie is always last.</li><li>Send them within a few hours: the memo is tied to chain block ' + fmt(c.w.tip || 0) + '. If a line will not send, come back here and press ↻ refresh; the memo is rebuilt for the new block.</li></ol></details></details>';
    if (window.V2Wallet && V2Wallet.mountFeeSlots) V2Wallet.mountFeeSlots(el);
    var cp = document.getElementById('altCopy'); if (cp) cp.onclick = function () { copyText(txt, cp); };
    var go = document.getElementById('altGo'); if (go) go.onclick = function () { step(); };
    var dr = document.getElementById('altDrop'); if (dr) dr.onclick = function () { A.run = null; try { if (window.V2Wallet && V2Wallet.feeBatchEnd) V2Wallet.feeBatchEnd(); } catch (e) { } saveBuild(); renderHold(); }; }
  function pendingTags() { var o = [], cf = confirmed(), seen = {}, me = A.ctx.ME; function add(h, t) { if (!t || cf[h] || seen[h]) return; seen[h] = 1; o.push(String(t)); }
    try { if (window.V2Wallet && V2Wallet.tracker) V2Wallet.tracker.list().forEach(function (t) { if (t.status !== 'confirmed') add(t.txid, t.tag); }); } catch (e) {}
    (VS().mempool || []).forEach(function (x) { if (x && x.source === me) add(x.tx_hash, x.tag); }); return o; }
  function connect(then) { if (!window.V2Wallet) { toast(WL() + ' support did not load. Reload the page.'); return; } saveBuild(); setMsg('Connecting ' + WL() + '…');
    V2Wallet.connect().then(function (a) { if (!a) return; if (a !== A.ctx.ME) { saveBuild(); setMsg('Wallet connected. Reloading this page for ' + c0(a) + '; your offering is saved and comes back.'); setTimeout(function () { location.reload(); }, 300); return; } if (then) then(); }, function (e) { setMsg('<span class="warn">' + V2Wallet.errHtml(e) + '</span>', true); }); }
  function c0(a) { return A.ctx.shortAddr ? A.ctx.shortAddr(a) : a; }
  function setMsg(h, html) { if (A.run) A.run.msg = h; var p = document.getElementById('altPg'); if (!p) return; if (html) p.innerHTML = h; else p.textContent = h; }
  /* the run: same order and checks as play.html confirmPlans (planAmount, cemPetAmount, send guard), one XCP Wallet window per burn */
  function startRun(title, L, mode, opts) { var c = A.ctx, V = c.V, w = c.w, b = (w.tip || 0) + 1, me = c.ME; opts = opts || {};
    if (!me) { connect(); return; } if (!window.V2Wallet || !V2Wallet.send) { toast(WL() + ' support did not load. Reload the page; your offering is saved.'); return; }
    if (V.planAmount) L = L.map(function (p) { return V.planAmount(w, p, b); }); if (V.cemPetAmount) L = L.map(function (p) { return V.cemPetAmount(w, p, b); });
    A.run = { title: title, plans: L, i: 0, mode: mode, busy: false, done: false, msg: '', zombie: !!opts.zombie }; saveBuild(); if (A.grave) renderHold(); else renderSend(); step(); }
  function step() { var c = A.ctx, V = c.V, R = A.run; if (!R || R.busy) return; var me = c.ME;
    if (V2Wallet.current && V2Wallet.current() !== me) { connect(step); return; }
    if (R.i >= R.plans.length) return finish();
    var S0 = VS(), left = R.plans.slice(R.i), tot = left.reduce(function (a, p) { return a + Number(p.amount || 0); }, 0);
    if (!S0.balanceAt && !(S0.stale && !S0.verified) && tot > 0 && !R._balPass) { R._balPass = 1; setMsg('Checking your XCPETS balance…'); var again = function () { step(); }; if (window.V2Mock && window.V2Mock.readBalance) window.V2Mock.readBalance({ force: true }).then(again, again); else again(); return; }
    R._balPass = 0; if (S0.balanceAt && tot > Number(S0.balance) && !(S0.stale && !S0.verified)) { try { if (V2Wallet.feeBatchEnd) V2Wallet.feeBatchEnd(); } catch (e) { } setMsg('Not enough XCPETS in this wallet for the ' + left.length + ' burn' + (left.length === 1 ? '' : 's') + ' left (' + fmt(tot) + ' needed). Nothing was sent.'); renderSend(); return; }
    var p = R.plans[R.i], k = R.i + 1, n = R.plans.length;
    if (window.V2Split && V2Split.resolveWorld && V.parseTag) V2Split.resolveWorld(c.w, (window.XcpArt && XcpArt.tagPetIds ? XcpArt.tagPetIds(V.parseTag(p.tag)) : []));
    var why = V.sendBlock ? V.sendBlock(c.w, p, c.w.tip, { me: me, pending: pendingTags() }) : null;
    if (why) { try { if (V2Wallet.feeBatchEnd) V2Wallet.feeBatchEnd(); } catch (e) { } R.msg = '<span class="warn">Burn ' + k + ' of ' + n + ' not sent: ' + esc(why) + '. Nothing was burned for it.' + (R.zombie ? '' : ' Press ↻ refresh, then Hold seance again (your offering is saved).') + '</span>'; R.done = true; saveBuild(); renderSend(); var pg = document.getElementById('altPg'); if (pg) pg.innerHTML = R.msg; return; }
    R.busy = true; R.msg = 'Burn ' + k + ' of ' + n + ': building ' + p.tag + '…'; renderSend(); renderBtns();
    var goSend = function () { V2Wallet.send(p, me, function (a, bb, ph, fi) { setMsg('Burn ' + k + ' of ' + n + ': ' + (ph === 'fresh' ? 'checking the latest chain data…' : ph === 'fee' ? 'getting the network fee rate…' : ph === 'check' ? 'safety-checking ' + p.tag + ' (node ' + a + ' of ' + bb + ')…' : ph === 'sign' ? (fi && fi.text ? fi.text + ' · ' : '') + 'approve ' + p.tag + (WL() !== 'XCP Wallet' ? ' in ' + WL() + ' now.' : ' in XCP Wallet now. If no window opened, click the XCP Wallet icon in your browser toolbar.') : 'building ' + p.tag + ' on Counterparty node ' + a + ' of ' + bb + '…')); }).then(function (r) {
      R.busy = false; R.i = k; var ids = idsOf(p), gids = gidsOf(p); sentLog().push({ tag: p.tag, txid: r.txid, ids: ids, gids: gids, amount: p.amount, at: Date.now() });
      if (!R.zombie && A.grave) { A.offered = A.offered.filter(function (o) { return ids.indexOf(o.id) < 0; }); gids.forEach(function (g) { (A.gearItems || []).forEach(function (arr, t) { var j = arr.map(function (x) { return x.gid; }).indexOf(g); if (j >= 0) { arr.splice(j, 1); A.stash[t] = Math.max(0, A.stash[t] - 1); if (A.gear[t]) A.gear[t]--; } }); }); }
      R.msg = 'Burn ' + k + ' of ' + n + ' sent: ' + p.tag + ' · tx ' + String(r.txid).slice(0, 10) + '…'; saveBuild(); if (A.grave) renderAll(); else renderSend(); if (R.i < n) setTimeout(step, 1500); else finish(); },
    function (e) { R.busy = false; var raw = e ? (e.message || (e.data && (e.data.message || JSON.stringify(e.data))) || String(e)) : '', eh = e && e.confirmNote && V2Wallet.confirmNoteHtml ? V2Wallet.confirmNoteHtml(true) : e && e.waitConfirm ? esc(k > 1 ? 'Burn ' + (k - 1) + ' is waiting to confirm. Wait about one block, then press Continue.' : 'An earlier burn of yours is waiting to confirm. Wait about one block, then press Continue.') : V2Wallet.errHtml(e);
      /* error-card (Nov 1 2026, critique plan item 5): what happened, whether anything was sent, tx links, and how to retry */
      var maybe = /may still have been sent/i.test(String(eh).replace(/<[^>]*>/g, '')), sl = sentLog(), sent = k > 1 ? sl.slice(Math.max(0, sl.length - (k - 1))).map(function (x) { return x.txid; }) : [],
        txl = function (t) { return '<a target="_blank" rel="noopener" href="https://mempool.space/tx/' + esc(t) + '">' + esc(String(t).slice(0, 10)) + '… ↗</a>'; };
      R.msg = '<div class="xc-err" role="alert" style="text-align:left;border:1px solid #e0a43a;border-radius:10px;padding:8px 10px;margin:6px 0;background:rgba(224,164,58,.08)"><div><b>⚠️ Stopped at burn ' + k + ' of ' + n + '.</b></div>' +
        '<div style="margin-top:4px"><b>What happened:</b> <span class="warn">' + eh + '</span>' + (raw && !e.waitConfirm && !e.walletBusy && !e.stale && String(eh).replace(/<[^>]*>/g, '').indexOf(raw) < 0 ? ' <span class="muted">· wallet/node said: <code>' + esc(raw) + '</code></span>' : '') + '</div>' +
        '<div style="margin-top:4px">' + (!sent.length && !maybe ? '<b>Nothing was sent.</b> No XCPETS and no fee left your wallet for burn ' + k + '.' : (sent.length ? '<b>' + sent.length + ' of ' + n + ' sent, waiting for a block:</b> ' + sent.map(txl).join(' · ') + '. ' : '') + (maybe ? '<b>Burn ' + k + ' may have been sent.</b> Check your address on <a target="_blank" rel="noopener" href="https://mempool.space/address/' + esc(me || '') + '">mempool.space ↗</a> before you retry.' : '<b>Burn ' + k + ' was not sent.</b>')) + '</div>' +
        '<div class="small muted" style="margin-top:4px">Your offering and this list are saved; nothing is lost. ' + (e && e.reload ? 'Reload the page, then continue.' : 'Press Continue to try burn ' + k + ' again.') + '</div></div>';
      saveBuild(); renderSend(); renderBtns(); var pg = document.getElementById('altPg'); if (pg) { pg.innerHTML = R.msg; if (e && e.confirmNote) { var nb = pg.querySelector('.bwc-go'), nt = pg.querySelector('.bwc-try'); if (nb) nb.onclick = function () { step(); }; if (nt) nt.onclick = function (ev) { ev.preventDefault(); V2Wallet.allowUnconfirmedOnce(); step(); }; } }
      if (e && e.reload) { saveBuild(); } }); };
    if (V2Wallet.feeBatchBegin) V2Wallet.feeBatchBegin(false).then(goSend, goSend); else goSend(); }
  function finish() { var R = A.run; if (!R) return; try { if (window.V2Wallet && V2Wallet.feeBatchEnd) V2Wallet.feeBatchEnd(); } catch (e) { } R.done = true; R.busy = false; var n = R.plans.length;
    R.msg = '✓ ' + n + ' burn' + (n === 1 ? '' : 's') + ' sent from ' + WL() + '. ' + (R.zombie ? 'The result shows here once it confirms (usually about 10 minutes).' : 'Your zombie rises when the last one confirms in a block (usually about 10 minutes). This page checks the chain every minute; you can close it.');
    saveBuild(); if (A.grave) { renderAll(); if (!R.zombie) goStep(3); } else renderSend(); var pg = document.getElementById('altPg'); if (pg) pg.textContent = R.msg; poll(); }
  function renderBtns() { var busy = !!(A.run && A.run.busy); ['altHold', 'altRaiseNow', 'altClr'].forEach(function (id) { var e = document.getElementById(id); if (e && busy) e.disabled = true; }); if (!busy && A.grave) { var cl = document.getElementById('altClr'); if (cl) cl.disabled = false; } }
  /* fresh chain data in place: keeps the offering, drops pets that can no longer be offered, re-reads held pieces */
  function refreshWorld(manual) { var M = M_(); if (!M || !M.world) return; if (A.run && A.run.busy) return;
    function apply() { try { A.ctx.w = M.world(); A.ctx.b = (A.ctx.w.tip || 0) + 1; } catch (e) { return; } if (!A.grave) { renderSend(); return; } var keep = A.offered.slice(), g = A.gear.slice(); buildMine();
      A.offered = keep.filter(function (o) { var p = A.mine.filter(function (q) { return q.id === o.id; })[0]; return p && !p.why; }); g.forEach(function (k, t) { A.gear[t] = Math.min(A.stash[t] || 0, k); }); [0, 1, 2, 3].forEach(function (i) { var e = document.getElementById('altG' + i); if (e) e.textContent = A.gear[i]; });
      if (A.run && A.run.done) A.run = null; saveBuild(); renderAll(); }
    if (manual) toast('Checking the chain…'); var done = false, cb = function () { done = true; apply(); };
    try { var pr = M.refresh ? M.refresh(cb) : null; if (pr && pr.then) pr.then(function () { if (!done) apply(); if (manual) toast('Up to block ' + fmt(A.ctx.w.tip || 0)); }, function () { if (!done) apply(); }); else apply(); } catch (e) { apply(); } }
  function poll() { if (A.pt) return; A.pt = setInterval(function () { if (document.hidden) return; if (!A.grave && !(A.run && A.run.zombie)) { clearInterval(A.pt); A.pt = 0; return; } var pend = pendParts(); if (pend.pets.length || pend.gear.length || (A.run && !A.run.done)) refreshWorld(false); }, 60e3); }
  /* zombie feed / Resurrection / hunt from the cemetery list: same signer, a small sheet in the altar spot (no redirect to play.html) */
  function sendPlans(title, L, ctx) { if (ctx) A.ctx = ctx; if (!A.ctx || !L || !L.length) return; if (A.grave) close(); var el = host(); el.hidden = false;
    el.innerHTML = '<div class="alt-head"><h2 class="alt-title">' + esc(title) + '</h2><div class="alt-tools"><button type="button" class="q" id="altX" aria-label="Close">✕</button></div></div>' + (!A.ctx.ME ? '<p class="small alt-note">👛 <button type="button" class="q" id="altConn">Connect ' + WL() + '</button> to send this. You stay on this page.</p>' : '') + '<div class="alt-send" id="altSend"></div>';
    el.querySelector('#altX').onclick = function () { if (A.run && A.run.busy) return; A.run = null; close(); }; var cn = el.querySelector('#altConn'); if (cn) cn.onclick = function () { connect(); };
    el.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' }); startRun(title, L, 'zombie', { zombie: true }); }
  /* soft = a tap (offer, take back, gear +/-): the tiles and the power bar answer at once; the burn plan, cost and memo (cemRunsPlan walks the
   * whole wallet) follow 300 ms after the last tap, so quick tapping never queues up seconds of work. Going to step 2 flushes it first. */
  function holdSoon() { clearTimeout(A.holdT); A.holdT = setTimeout(function () { A.holdT = 0; if (A.grave && document.getElementById('altTiles')) renderHold(); }, 300); }
  function holdFlush() { if (!A.holdT) return; clearTimeout(A.holdT); A.holdT = 0; if (A.grave) renderHold(); }
  function renderAll(first, soft) { renderTiles(); renderPower(!first, soft); if (!first) saveBuild(); renderBtns(); renderStep(); if (A.step === 2) renderReview(); }
  function toast(s) { var t = document.getElementById('altToast'); if (!t) return; t.textContent = s; t.classList.remove('go'); void t.offsetWidth; t.classList.add('go'); }

  /* ---------------------------------------------------------------- actions ---------------------------------------------------------------- */
  function offer(id, from) { var hs = headStartNow(); if (hs && A.ctx.ME && A.ctx.ME !== hs.owner) { toast('Owner\'s head start: only the last owner can raise this Mythic for ' + hs.left + ' more block' + (hs.left === 1 ? '' : 's')); return false; }
    if (A.rise) A.rise = null; var p = A.mine.filter(function (q) { return q.id === id; })[0]; if (!p || p.why || isOn(id)) return false; if (!from) dockFly(id);
    var before = project().exact, o = { kind: 'pet', id: p.id, name: p.name, tier: p.tier, ripe: p.ripe, dies: p.dies, worn: p.worn, seq: ++A.seq }; A.offered.push(o); o.add = dec(project().exact - before);
    var now = Date.now(); A.combo = now - (A.lastTap || 0) < 650 ? (A.combo || 0) + 1 : 0; A.lastTap = now; combo(); SFX.offer(p.tier); fly(o, from); renderAll(false, true); if (p.dies > bk() && soon(p, limit())) toast('⚠ dies in ' + Math.max(0, p.dies - bk()) + (p.dies - bk() === 1 ? ' block' : ' blocks')); return true; }
  function combo() { var c = document.getElementById('altCombo'); if (!c || reduced()) return; if ((A.combo || 0) < 1) return; c.querySelector('b').textContent = 'x' + (A.combo + 1); c.classList.add('on'); clearTimeout(A.comboT); A.comboT = setTimeout(function () { c.classList.remove('on'); A.combo = 0; }, 900); }
  function takeBack(id) { A.offered = A.offered.filter(function (o) { return o.id !== id; }); A.tally = Math.max(0, A.tally - 1); SFX.back(); renderAll(false, true); kick(); }
  /* where a dragged pet is dropped: the altar itself, or its copy in the dock */
  function dropAt(ev) { var L = [A.cv, A.dockOn ? document.getElementById('altDockCv') : null]; for (var i = 0; i < L.length; i++) { if (!L[i]) continue; var r = L[i].getBoundingClientRect(); if (r.width && ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) return r; } return null; }
  function bind(el) { var R = A.ctx.R;
    el.querySelector('#altX').onclick = close; var cn = el.querySelector('#altConn'); if (cn) cn.onclick = function () { connect(); };
    el.querySelector('#altSnd').onclick = function () { A.sound = !A.sound; try { localStorage.setItem('xcpets-cem-sfx', A.sound ? 'on' : 'off'); } catch (e) {} this.textContent = A.sound ? '🔊' : '🔇'; this.setAttribute('aria-pressed', A.sound); if (A.sound) SFX.offer(1); };
    el.querySelector('#altClr').onclick = function () { if (A.run && A.run.busy) return; A.run = null; A.offered = []; A.gear = [0, 0, 0, 0]; A.tally = 0; A.splats = 0; A.bwant = 0; A.bflow = 0; A.rise = null; A.lastMile = -1; A.dc = null; A.drips = []; [0, 1, 2, 3].forEach(function (i) { document.getElementById('altG' + i).textContent = 0; }); SFX.back(); renderAll(); kick(); };
    var sp = el.querySelector('#altSpare'); if (sp) sp.onclick = function () { if (A.run && A.run.busy) return; var L = A.offered.filter(function (o) { return o.kind === 'pet' && !o.held; }); if (L.length) takeBack(L[L.length - 1].id); else toast('Nothing on the altar to spare'); };
    el.querySelector('#altMore').onclick = function () { A.shown += PAGE; renderTiles(); };
    el.querySelector('#altHelpB').onclick = function () { var h = document.getElementById('altHelp'); h.hidden = !h.hidden; this.setAttribute('aria-expanded', !h.hidden); };
    el.querySelector('#altFill').onclick = function () { if (A.run && A.run.busy) return; fill(); };
    el.querySelector('#altAll').onclick = function () { if (A.run && A.run.busy) return; offerAll(); };
    el.querySelector('#altGo2').onclick = function () { var n = A.step || 1;
      if (n === 1 && window.V2SacGuard) { var pk = A.offered.filter(function (o) { return o.kind !== 'gear' && !o.held; }).map(function (o) { return o.id; }); /* sac-guard (Nov 23 2026): name special pets before the review */
        if (pk.length) return V2SacGuard.check({ w: A.ctx.w, ids: pk, me: A.ctx.ME, verb: 'offer them at this altar', onGo: function (keep) { pk.forEach(function (id) { if (keep.indexOf(id) < 0) takeBack(id); }); if (A.offered.length || (A.gear || []).some(function (x) { return x > 0; })) goStep(2); } }); }
      if (n === 1) goStep(2); else if (n === 2) hold('seance'); else close(); };
    el.querySelector('#altBack').onclick = function () { goStep(1); };
    el.querySelector('#altDig').onclick = digTap;
    el.querySelector('#altDockGo').onclick = function () { var st = el.querySelector('.alt-stage'); if (st) st.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' }); };
    el.querySelector('#altNext').onclick = function (e) { var b = e.target.closest('[data-nudge]'); if (b) offer(+b.getAttribute('data-nudge')); };
    el.querySelector('.alt-filt').onclick = function (e) { var b = e.target.closest('[data-f]'); if (!b) return; A.filt = b.getAttribute('data-f'); A.shown = PAGE; this.querySelectorAll('[data-f]').forEach(function (q) { q.setAttribute('aria-pressed', q === b); }); renderTiles(); };
    el.querySelector('.alt-gr').onclick = function (e) { var b = e.target.closest('[data-g]'); if (!b) return; var hs = headStartNow(); if (hs && A.ctx.ME && A.ctx.ME !== hs.owner) { toast('Owner\'s head start: only the last owner can raise this Mythic for ' + hs.left + ' more block' + (hs.left === 1 ? '' : 's')); return; } var t = +b.getAttribute('data-g'), d = +b.getAttribute('data-d'), n = Math.max(0, Math.min(A.stash[t], A.gear[t] + d)); if (n === A.gear[t]) return;
      A.gear[t] = n; document.getElementById('altG' + t).textContent = n; if (d > 0) { if (reduced()) burnt({ tier: t }); else toss(t); } else { A.tally = Math.max(0, A.tally - 1); SFX.back(); }
      renderPower(true, true); kick(); };
    el.querySelector('#altList').onclick = function (e) { var b = e.target.closest('[data-back]'); if (b) takeBack(+b.getAttribute('data-back')); };
    var tiles = el.querySelector('#altTiles');
    tiles.addEventListener('click', function (e) { var y = e.target.closest('[data-yes]'), n = e.target.closest('[data-no]'); if (y) { e.preventDefault(); offer(+y.getAttribute('data-yes'), null, true); return; } if (n) { e.preventDefault(); A.ask = null; renderTiles(); return; } });
    tiles.addEventListener('change', function (e) { var cb = e.target; if (!cb.matches('input[type=checkbox]')) return; var id = +cb.getAttribute('data-id'); if (cb.checked) { if (!offer(id)) cb.checked = false; } else takeBack(id); });
    /* drag a pet's picture onto the altar (pointer events, works with touch on the picture itself) */
    tiles.addEventListener('pointerdown', function (e) { var c = e.target.closest('canvas.alt-sp'); if (!c) return; var t = c.closest('.alt-tile'); if (!t || t.classList.contains('myth') || t.classList.contains('on')) return;
      var id = +t.getAttribute('data-id'), sx = e.clientX, sy = e.clientY, ghost = null, moved = false; c.setPointerCapture && c.setPointerCapture(e.pointerId); e.preventDefault();
      function mv(ev) { if (!moved && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 6) return; if (!moved) { moved = true; ghost = document.createElement('canvas'); ghost.width = ghost.height = 32; ghost.className = 'alt-ghost'; ghost.getContext('2d').drawImage(c, 0, 0); document.body.appendChild(ghost); el.classList.add('dragging'); }
        ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px'; el.classList.toggle('over', !!dropAt(ev)); }
      function up(ev) { c.removeEventListener('pointermove', mv); c.removeEventListener('pointerup', up); c.removeEventListener('pointercancel', up); el.classList.remove('dragging'); var over = el.classList.contains('over'); el.classList.remove('over'); if (ghost) ghost.remove();
        if (!moved) { if (ev.type === 'pointerup') { if (!offer(id)) return; } return; }
        if (over) { var r = dropAt(ev); if (r) offer(id, { x: (ev.clientX - r.left) * AW / r.width, y: (ev.clientY - r.top) * AH / r.height }); } }
      c.addEventListener('pointermove', mv); c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up); });
    tiles.addEventListener('click', function (e) { if (e.target.closest('canvas.alt-sp')) e.preventDefault(); }, true);
    el.querySelector('#altRise').onclick = function () { if (!A.offered.length && A.step !== 3) return; A.rise = { t: 0 }; SFX.rise(); toast('…the ground stirs…'); if (reduced()) { A.rise.t = 3000; } kick(); var rc = document.getElementById('altRisen'); if (rc) rc.remove(); };
    el.querySelector('#altHold').onclick = function () { hold('seance'); }; var rz = el.querySelector('#altRaiseNow'); if (rz) rz.onclick = function () { hold('raise'); };
    A.cv.addEventListener('click', function () { if (A.step === 3 && !A.rise) { digTap(); return; } if (!A.offered.length) toast('Tap a pet below to throw it on'); }); }
  /* ---------------------------------------------------------------- steps, bottom bar, review ---------------------------------------------------------------- */
  function anyOffer() { var H = heldParts(); return !!(A.offered.length || selGear().length || H.pets.length || H.gear.length); }
  function goStep(n) { if (A.run && A.run.busy && n !== 2) return; holdFlush(); A.step = n; if (n === 3) { A.dig = 0; A.rise = null; } renderStep(); if (n === 2) renderReview(); dockCheck(); var st = document.getElementById('altSteps'); if (st && n > 1) st.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' }); kick(); }
  function renderStep() { var n = A.step || 1, el = document.getElementById('cemAltar'); if (!el || !A.grave) return; if (A.run && !A.run.done && n === 1) n = A.step = 2;
    [1, 2, 3].forEach(function (k) { var p = document.getElementById('altP' + k); if (p) p.hidden = k !== n; }); el.querySelectorAll('#altSteps [data-s]').forEach(function (d) { var k = +d.getAttribute('data-s'); d.className = k < n ? 'done' : k === n ? 'on' : ''; });
    var sum = document.getElementById('altSum'), go = document.getElementById('altGo2'), bk2 = document.getElementById('altBack'), dg = document.getElementById('altDig'), busy = !!(A.run && A.run.busy); if (!sum) return;
    if (dg) dg.hidden = !(n === 3 && !A.rise); bk2.hidden = n !== 2 || busy || !!(A.run && !A.run.done && A.run.i > 0);
    if (n === 1) { var np = A.offered.length, ng = selGear().length, L = np || ng ? (A.holdT ? null : holdWhy('seance') ? [] : plansV('seance')) : [];
      sum.innerHTML = np || ng ? '<b>' + np + '</b> pet' + (np === 1 ? '' : 's') + (ng ? ' + <b>' + ng + '</b> gear' : '') + (!L ? ' · <span class="muted">counting the cost…</span>' : L.length ? ' · <b>' + L.length + '</b> burn' + (L.length === 1 ? '' : 's') + ' · <b>' + fmt(cost(L)) + '</b> XCPETS' : '') : (heldParts().n ? 'You already gave pieces to this grave. Add more, or review to raise now.' : 'Tap a pet to put it under the knife. Your offering is saved if you leave.');
      go.textContent = '🩸 Raise it →'; go.disabled = !anyOffer(); go.title = go.disabled ? 'Offer at least 1 pet first' : ''; }
    else if (n === 2) { var hb = document.getElementById('altHold'); go.innerHTML = hb ? hb.innerHTML : '🕯️ Hold seance'; go.disabled = !hb || hb.disabled || busy; go.title = hb ? hb.title : '';
      sum.innerHTML = busy ? 'Signing in ' + esc(WL()) + '…' : A.run && !A.run.done ? 'Burns stopped halfway. Continue below.' : 'Check what you give up, then sign.'; }
    else { go.textContent = 'Close'; go.disabled = false; go.title = ''; sum.innerHTML = A.rise ? 'It rises for real when the last burn confirms (about 10 minutes).' : 'Tap the grave three times.'; } }
  function renderReview() { var c = A.ctx, w = c.w, P = project(), mi = mile(P.times), H = P.held, give = document.getElementById('altGive'); if (!give) return;
    var all = A.offered.map(function (o) { return o.id; }).concat(H.pets.map(function (p) { return p.id; })), n = [0, 0, 0, 0];
    all.forEach(function (id) { var p = w.byId[id]; if (p) n[Math.max(0, Math.min(3, p.tier | 0))]++; });
    give.innerHTML = all.slice(0, 60).map(function (id) { return '<canvas width="32" height="32" class="alt-mini" data-mini="' + id + '" title="#' + id + '"></canvas>'; }).join('') + (all.length > 60 ? '<span class="small muted">+' + (all.length - 60) + ' more</span>' : '');
    all.slice(0, 60).forEach(function (id) { var cv = give.querySelector('[data-mini="' + id + '"]'), s0 = w.byId[id] && sprite(w.byId[id]); if (cv && s0) { var x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(s0, 0, 0); } });
    var ng = selGear().length + H.gear.length; document.getElementById('altGiveT').textContent = all.length + ' pet' + (all.length === 1 ? '' : 's') + (all.length ? ' (' + n.map(function (k, i) { return k ? k + ' ' + TL[i] : ''; }).filter(Boolean).join(', ') + ')' : '') + (ng ? ' and ' + ng + ' gear' : '') + '. Worn gear comes off first and stays yours.' + (H.n ? ' Includes ' + H.n + ' piece' + (H.n === 1 ? '' : 's') + ' you already gave.' : '');
    document.getElementById('altGet').innerHTML = '<b>' + esc(A.grave.name) + ' the ' + (mi >= 0 && mi < MILES.length - 1 ? MILES[mi][1] : mi === MILES.length - 1 ? 'Maxed' : 'Zombie') + '</b>, power ' + P.total + ' (' + P.times.toFixed(2) + ' times), owned by the wallet that holds the seance.';
    document.getElementById('altGetT').innerHTML = STATS.map(function (k) { return '<tr><td>' + k.charAt(0).toUpperCase() + k.slice(1) + '</td><td class="muted">' + (A.base[k] || 0) + '</td><td>' + P.stats[k] + '</td></tr>'; }).join('');
    var why = holdWhy('seance'), L = why ? [] : plansV('seance'), cs = document.getElementById('altCost');
    cs.innerHTML = why ? '<span class="warn">' + esc(why) + '</span>' : '<span>' + L.length + ' burn' + (L.length === 1 ? '' : 's') + perPet(L) + '</span><b>' + fmt(cost(L)) + ' XCPETS</b><span class="small muted">' + WL() + ' opens ' + L.length + ' time' + (L.length === 1 ? '' : 's') + ', one per burn. The last burn holds the seance.</span>'; }
  /* "+N POWER" over the altar when a pet lands, and a meme banner + shake for each new level (display only) */
  var MEME = ['wow', 'much offer', 'very sacrifice', 'such power', 'based', 'gg', 'into the void'], BAN = [['SHAMBLER!', 'it twitched'], ['GHOUL!', 'such undead. wow.'], ['REVENANT!', 'ok this is getting serious'], ['DREAD!', 'the candles are scared'], ['MAXED OUT!', CAP + ' times power. legend.']];
  function dockPop(html, cls, ms) { var L = document.getElementById('altDockFx'); if (!L || !A.dockOn || reduced()) return; var e = document.createElement('div'); e.className = cls; e.innerHTML = html; L.appendChild(e); setTimeout(function () { if (e.parentNode) e.parentNode.removeChild(e); }, ms); }
  function domPop(add, tier) { dockPop('+' + esc(add), 'alt-dpop t' + (tier | 0), 1100); var L = document.getElementById('altFxl'); if (!L || reduced()) return; var e = document.createElement('div'); e.className = 'alt-fl t' + (tier | 0); e.style.left = (36 + Math.random() * 26) + '%'; e.innerHTML = '+' + esc(add) + '<small>' + MEME[Math.floor(Math.random() * MEME.length)] + '</small>'; L.appendChild(e); setTimeout(function () { if (e.parentNode) e.parentNode.removeChild(e); }, 1200); }
  function banner(mi) { var L = document.getElementById('altFxl'), B = BAN[Math.min(mi, BAN.length - 1)] || BAN[0]; if (mi >= 0 && mi < MILES.length - 1) B = [MILES[mi][1].toUpperCase() + '!', BAN[Math.min(mi, BAN.length - 2)][1]]; toast(B[0]); dockPop(esc(B[0]), 'alt-dban', 1900); if (!L || reduced()) return; var t = document.getElementById('altToast'); if (t) t.classList.remove('go');
    var e = document.createElement('div'); e.className = 'alt-meme'; e.innerHTML = '<b>' + esc(B[0]) + '</b><span>' + esc(B[1]) + '</span>'; L.appendChild(e); setTimeout(function () { if (e.parentNode) e.parentNode.removeChild(e); }, 2000); shake(); }
  function shake() { var w = A.cv && A.cv.parentNode; if (!w || reduced()) return; w.classList.remove('alt-shake'); void w.offsetWidth; w.classList.add('alt-shake'); }
  /* next level line: how much is left, and the cheapest single pet (lowest tier first; the list holds only Discarded pets, owner Nov 22 2026) that gets there; one tap offers it */
  function renderNext(P, mi) { var ne = document.getElementById('altNext'), nd = document.getElementById('altNeed'); if (!ne) return; var nx = MILES[mi + 1], gap = nx ? Math.max(0, P.base * nx[0] - P.exact) : 0, one = null;
    if (nx && P.base) { var b0 = P.exact; A.mine.filter(function (p) { return !p.why && !isOn(p.id); }).slice(0, 300).forEach(function (p) { var g = gainOf(p.id, b0); if (g + 1e-9 >= gap && (!one || p.tier < one.tier || (p.tier === one.tier && g < one.g))) one = { id: p.id, name: p.name, tier: p.tier, g: g }; }); }
    var fb = document.getElementById('altFill'), fs = document.getElementById('altFillSub'); if (fb && fb.firstChild) { fb.firstChild.textContent = nx ? '🔪 Fill to ' + nx[1] : '🔪 Maxed out'; if (fs) fs.textContent = nx ? 'sacrifices the cheapest pets that get there' : 'more blood adds nothing now'; }
    ne.innerHTML = !P.base ? '' : nx ? '<b>+' + Math.max(1, Math.ceil(gap)) + ' power</b> to reach ' + nx[1] + '.' + (one ? ' <button type="button" class="linkish alt-nudge" data-nudge="' + one.id + '">' + esc(one.name) + ' (' + TL[one.tier] + ', +' + gainTxt(one.g) + ') gets you there</button>' : '') : '<b>Maxed.</b> More offerings add nothing now.';
    var c = A.ctx, V = c.V, G = c.w.byId[A.grave.id], v = null; try { v = V.cemView(c.w, G, bk()); } catch (e) { v = null; } var need = v ? v.need | 0 : 0;
    if (nd) { if (need <= 0) { nd.hidden = true; } else { var ok = needMet(need);
      nd.hidden = false; nd.className = 'small alt-need ' + (ok ? 'ok' : 'no'); nd.textContent = (ok ? '✓ ' : '✗ ') + 'A ' + TL[A.grave.tier] + ' grave needs at least 1 ' + needTxt(need) + ' pet or gear'; } } }
  function needMet(need) { var H = heldParts(); return A.offered.some(function (o) { return o.tier >= need; }) || selGear().some(function (g) { return gTier(g) >= need; }) || H.pets.some(function (p) { return (p.tier | 0) >= need; }) || H.gear.some(function (g) { return gTier(g) >= need; }); }
  /* Fill to next level: ripe pets first, then the lowest tier, until the next level; adds the 1 pet the grave needs (lowest tier that counts) if none is on yet */
  function fill() { var hs = headStartNow(); if (hs && A.ctx.ME && A.ctx.ME !== hs.owner) { toast('Owner\'s head start'); return; } var P = project(), mi = mile(P.times), nx = MILES[Math.min(mi + 1, MILES.length - 1)], target = nx[0];
    if (P.times + 1e-9 >= CAP) { toast('Already maxed'); return; } var pool = A.mine.filter(function (p) { return !p.why && !isOn(p.id); }).sort(function (a, b) { return (b.ripe - a.ripe) || (a.tier - b.tier) || (a.id - b.id); }), added = [];
    var c = A.ctx, v = null; try { v = c.V.cemView(c.w, c.w.byId[A.grave.id], bk()); } catch (e) { v = null; } var need = v ? v.need | 0 : 0;
    if (need > 0 && !needMet(need)) { var r1 = pool.filter(function (p) { return p.tier >= need; })[0]; if (r1) { push(r1); pool = pool.filter(function (p) { return p !== r1; }); } }
    function push(p) { var before = project().exact, o = { kind: 'pet', id: p.id, name: p.name, tier: p.tier, ripe: p.ripe, dies: p.dies, worn: p.worn, seq: ++A.seq }; A.offered.push(o); o.add = dec(project().exact - before); added.push(o); }
    for (var i = 0; i < pool.length && added.length < 500 && project().times + 1e-9 < target; i++) push(pool[i]);
    if (!added.length) { toast('No more pets to offer'); return; }
    added.slice(0, 10).forEach(function (o, k) { setTimeout(function () { if (A.grave) { SFX.offer(o.tier); fly(o); } }, reduced() ? 0 : k * 140); }); if (added.length > 10) A.tally += added.length - 10;
    renderAll(); toast('+' + added.length + ' pet' + (added.length === 1 ? '' : 's')); }
  /* Offer all (owner Nov 22 2026: clear out unwanted pets in one go): every pet in the current filter goes on the altar at once; the review step shows the burns and cost before anything is signed */
  function offerAll() { var hs = headStartNow(); if (hs && A.ctx.ME && A.ctx.ME !== hs.owner) { toast('Owner\'s head start'); return; } var L = visible().filter(function (p) { return !isOn(p.id); }); if (!L.length) { toast('Nothing left to offer here'); return; }
    L.forEach(function (p) { A.offered.push({ kind: 'pet', id: p.id, name: p.name, tier: p.tier, ripe: p.ripe, dies: p.dies, worn: p.worn, seq: ++A.seq, add: '' }); });
    L.slice(0, 10).forEach(function (p, k) { setTimeout(function () { if (A.grave) { var o = A.offered.filter(function (q) { return q.id === p.id; })[0]; if (o) { SFX.offer(o.tier); fly(o); } } }, reduced() ? 0 : k * 120); }); if (L.length > 10) A.tally += L.length - 10;
    renderAll(); toast('+' + L.length + ' pet' + (L.length === 1 ? '' : 's')); }
  /* step 3: tap the grave three times, then the claw rise and the meme card */
  function digTap() { A.dig = (A.dig || 0) + 1; shake(); SFX.back(); var g = GRV; for (var i = 0; i < 10; i++) A.fx.push({ k: 'chip', x: g.x - 8 + Math.random() * 16, y: g.y - 1, vx: Math.random() * 2 - 1, vy: -(0.6 + Math.random() * 1.6), t: 0, d: 500 }); if (A.dig < 3) splat();
    var dn = document.getElementById('altDigN'); if (dn) dn.textContent = '×' + Math.max(0, 3 - A.dig); kick();
    if (A.dig >= 3) { A.rise = { t: 0 }; SFX.rise(); if (reduced()) A.rise.t = 3000; var cd = document.getElementById('altCard'); if (cd) cd.hidden = true; renderStep(); kick(); } }
  var CAPS = [['he\'s back', 'and he\'s hungry'], ['wake up', 'it\'s feeding time'], ['they buried him', 'he dug'], ['dead?', 'not today'], ['full power', 'much undead']];
  function riseCardHtml(P, mi) { var cp = CAPS[Math.max(0, mi) % CAPS.length], lv = mi < 0 ? 'ZOMBIE' : mi === MILES.length - 1 ? 'MAXED' : MILES[mi][1].toUpperCase();
    return '<div class="alt-cardin lv' + (mi + 1) + '"><div class="alt-cap">' + esc(cp[0]) + '</div><canvas width="64" height="64" id="altCardCv" aria-hidden="true"></canvas><span class="alt-lv">' + lv + '</span><div class="alt-cap">' + esc(cp[1]) + '</div>' +
      '<div class="alt-count">' + STATS.map(function (k) { return '<div><b>' + k.charAt(0).toUpperCase() + k.slice(1) + '</b><i data-k="' + k + '">' + (A.base[k] || 0) + '</i></div>'; }).join('') + '</div><p><b>' + esc(A.grave.name) + '</b> · ⚡ ' + P.total + ' power · ' + P.times.toFixed(2) + ' times</p></div>' +
      '<div class="alt-acts"><button type="button" class="btn" id="altShare">📣 Share</button><a class="btn" href="play.html#pets">🧟 My Pets</a></div><p class="small muted">It rises for real when the last burn confirms (about 10 minutes). Then it lives in My Pets, where you feed it.</p>'; }
  function risenCard() { var P = project(), mi = mile(P.times);
    var cd = document.getElementById('altCard'); if (cd && A.step === 3) { cd.hidden = false; cd.innerHTML = riseCardHtml(P, mi); var dh = document.getElementById('altDigH'); if (dh) dh.hidden = true;
      var cv = document.getElementById('altCardCv'), z = sprite(A.grave, true), zf = z && z.fr ? z.fr[0] : z; if (cv && zf) { var x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(zf, 0, 0, 32, 32, 0, 0, 64, 64); }
      var t0 = performance.now(), D = reduced() ? 0 : 1300; (function tick() { var f = D ? Math.min(1, (performance.now() - t0) / D) : 1; cd.querySelectorAll('.alt-count i').forEach(function (e) { var k = e.getAttribute('data-k'), a = A.base[k] || 0; e.textContent = Math.round(a + (P.stats[k] - a) * f); }); if (f < 1) requestAnimationFrame(tick); })();
      var sh = document.getElementById('altShare'); if (sh) sh.onclick = function () { var txt = 'I raised ' + A.grave.name + ' #' + A.grave.id + ' the ' + (mi >= 0 ? MILES[mi][1] : 'Zombie') + ' at the XCPETS seance. ⚡' + P.total + ' power 🧟 https://xcpets.fun/cemetery.html'; if (navigator.share) navigator.share({ text: txt }).catch(function () {}); else copyText(txt, sh); };
      renderStep(); cd.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' }); return; }
    risenCard0(P, mi); }
  function risenCard0(P, mi) { var wrap = A.cv && A.cv.parentNode; if (!wrap) return;
    var d = document.createElement('div'); d.className = 'alt-risen'; d.id = 'altRisen'; d.innerHTML = '<b class="meme">RISEN!</b><span>' + esc(A.grave.name) + ' the ' + (mi >= 0 && mi < MILES.length - 1 ? MILES[mi][1] : mi === MILES.length - 1 ? 'Dread (maxed)' : 'Zombie') + ' · ⚡ ' + P.total + ' · ' + P.times.toFixed(2) + ' times</span><small>this is how it looks once the burns confirm · then it lives in <a href="play.html#pets">🧟 My Pets</a>, where you feed it</small>'; wrap.appendChild(d);
    setTimeout(function () { if (d.isConnected) d.classList.add('out'); }, 3800); setTimeout(function () { if (d.isConnected) d.remove(); }, 4300); }
  window.V2CemeteryAltar = { _gain: gainOf, _gainSlow: gainOfSlow, _plansV: plansV, open: open, close: close, project: project, plans: plans, sendPlans: sendPlans, memo: function () { return A.grave ? memoText(memoPlans()) : ''; }, saved: function (me) { try { return JSON.parse(localStorage.getItem(BK + (me || '')) || '{}'); } catch (e) { return {}; } }, _state: function () { return A; }, _offer: offer, _gear: function (t, n) { A.gear[t] = Math.max(0, Math.min(A.stash[t], n)); renderPower(false); } };
})();
