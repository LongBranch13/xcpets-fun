/* XCPETS Gooby's No-Tail Motel (UI-only mockup, owner 7:12-7:38 PM CT; branch no-tail-motel, NOT LIVE). Replaces the Breeding section's look; breeding
 * rules and burns are UNCHANGED: "Check in" = the existing pet:breed:A:B burn (690, 135 from ACTIVATE_BREED_135_BLOCK); a partner on another wallet "checks in" with the existing
 * mirrored accept (pet:breed:B:A, 690, within 144 blocks). The door shows both room numbers (= pet IDs), opens on the scene when both pets have
 * checked in (the child exists), and the egg appears at the door. Gooby (the "Gooby pls" dog) runs the desk with PG-13 one-liners.
 * Odds peek on the door: computed from the engine's own constants (v2-rules.js: RARITY_UP_10K 500 / RARITY_HIGH_10K 3000, HYBRID_RATE_1E9
 * 684773435, HYBRID_RARITY_UP_10K 1000, hybrid-parent breeds always hybrid). In place, no pop-ups; reduced motion = static. */
(function () {
  'use strict';
  /* power-tooltip-values (Oct 25 2026, display only): hovers show the pet's real numbers (js/v2-power-tip.js) */
  function ptA(p) { return window.V2PowerTip ? V2PowerTip.attr(V2PowerTip.power(p)) : ''; } 
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
      sp = U.length === 2 ? [[(V.hybridLabel || V.hybridName)(hy(A.species) ? A.species : B.species), 100]] : [['3-way hybrid', 50], ['2-way hybrid', 50]]; }
    else if (A.species === B.species) { ph = 0; sp = [[lab(A.species), 100]]; }
    else { ph = V.HYBRID_RATE_1E9 / 1e9; var pu = (1 - ph) / 2; sp = [[(V.hybridLabel || V.hybridName)('hyb:' + A.species + ':' + B.species), ph * 100], [lab(A.species), pu * 100], [lab(B.species), pu * 100]]; }
    /* tiers: purebred child 5% hi+1 / 30% hi / 65% lo (RARITY_*_10K); hybrid child 10% hi+1 / 90% hi (HYBRID_RARITY_UP_10K) */
    var up = ph * 0.10 + (1 - ph) * 0.05, h = ph * 0.90 + (1 - ph) * 0.30, l = (1 - ph) * 0.65; if (hi === 3) { h += up; up = 0; } if (hi === lo) { h += l; l = 0; }
    return { hyb: ph * 100, sp: sp, tier: { up: up * 100, hi: h * 100, lo: l * 100 }, hiT: hi, loT: lo }; }
  function dog(x, ox, oy, t, o) { o = o || {}; var wag = reduced() ? 0 : Math.floor(t / (o.sleep ? 900 : o.excited ? 120 : 250)) % 2, blink = o.sleep || (!reduced() && Math.floor(t / 2600) % 7 === 0); /* gooby-guestbook: o = { sleep, talk, excited } (desk only; arena/front card pass none) */ /* Gooby (xcp.fun/GOOBY): green hat, black head, white muzzle, droopy ear, red turtleneck */
    px(x, '#111', ox + 8, oy - 1, 3, 1); px(x, '#111', ox + 12, oy - 1, 3, 1); px(x, '#6ef04a', ox + 8, oy, 3, 1); px(x, '#6ef04a', ox + 12, oy, 3, 1); px(x, '#6ef04a', ox + 8, oy + 1, 7, 1); /* hat crown, notched top */
    px(x, '#111', ox + 8, oy + 2, 7, 1); px(x, '#6ef04a', ox + 7, oy + 3, 8, 1); px(x, '#111', ox + 7, oy + 4, 8, 1); /* black band, brim */
    px(x, '#111', ox + 6, oy + 5, 10, 4); px(x, '#111', ox + 15, oy + 5, 4, 2); px(x, '#111', ox + 17, oy + 7 + wag, 2, 3); /* head + droopy ear (bobs) */
    px(x, '#f5f5f0', ox + 5, oy + 6, 3, 3); px(x, '#f5f5f0', ox + 9, oy + 6, 3, 3); if (!blink) { px(x, '#111', ox + 6, oy + 7, 1, 1); px(x, '#111', ox + 10, oy + 7, 1, 1); } /* small dot eyes on white */
    px(x, '#111', ox + 12, oy + 9, 4, 5); px(x, '#f5f5f0', ox + 1, oy + 9, 11, 3); px(x, '#f5f5f0', ox + 3, oy + 12, 7, 1); px(x, '#111', ox + 1, oy + 12, 2, 1); /* neck, long white muzzle */
    px(x, '#111', ox, oy + 11, 2, 4); if (o.talk && !reduced() && Math.floor(t / 140) % 2) { px(x, '#5a1010', ox + 3, oy + 12, 6, 2); px(x, '#f5f5f0', ox + 5, oy + 12, 2, 1); } else { px(x, '#f5f5f0', ox + 5, oy + 13, 2, 1); px(x, '#111', ox + 4, oy + 13, 1, 1); px(x, '#111', ox + 7, oy + 13, 1, 1); } /* big black nose, buck tooth (mouth flaps while he talks) */
    px(x, '#e8352a', ox + 9, oy + 14, 10, 4); px(x, '#e8352a', ox + 8, oy + 13, 4, 1); px(x, '#b0221a', ox + 12, oy + 14, 2, 4); px(x, '#111', ox + 16, oy + 16, 1, 2); } /* red turtleneck */
  function bubble(x, s, bx, by, maxW, tailX) { x.font = '5px "Press Start 2P", monospace'; var lines = [s];
    if (maxW && x.measureText(s).width > maxW - 8) { var wd = s.split(' '), a = ''; lines = []; wd.forEach(function (q) { var t2 = a ? a + ' ' + q : q; if (a && x.measureText(t2).width > maxW - 8) { lines.push(a); a = q; } else a = t2; }); if (a) lines.push(a); lines = lines.slice(0, 2); }
    var w = Math.ceil(Math.max.apply(null, lines.map(function (l) { return x.measureText(l).width; }))) + 8, h = 4 + lines.length * 7; bx = Math.max(2, Math.min(W - w - 2, bx)); if (lines.length > 1) by -= 7;
    px(x, '#000', bx + 1, by + 1, w, h); px(x, '#fff8e1', bx, by, w, h); var tx = tailX == null ? bx + 6 : Math.max(bx + 2, Math.min(bx + w - 5, tailX)); px(x, '#fff8e1', tx, by + h, 3, 3); x.fillStyle = '#1b1b1b'; lines.forEach(function (l, i) { x.fillText(l, bx + 4, by + 8 + i * 7); }); }
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
  /* gooby-guestbook (2026-10-21, owner 10:07 PM CT): Gooby reacts to real motel activity and to the player. Display only, nothing on chain.
   * - Lines alternate: a FACT read from the replayed chain (newest egg, eggs today, guests waiting, busy rooms, total stays) then a JOKE (LINES).
   * - Moods: talks (mouth flaps) while his line is new; leans out when you pick guests; excited ear wag on days with eggs; dozes (Zzz) after
   *   40 s with no taps, no picks and no eggs in the last 144 blocks; any tap/pick wakes him.
   * - Taps on the scene: Gooby (hop + '!' + a reply), the can machine (a can drops, Gooby sells it), a room window (who's in there), the door.
   * - His current line is mirrored in plain text under the scene (#motelGooby) so it reads at phone size. */
    var TAPL = ['Gooby pls. I\u2019m working.', 'No tails, no tales.', 'Ring the bell, not Gooby.', 'Gooby pls. Pick two guests.', 'Hat stays on. House rule.', 'Boop accepted. Room fee not.'];
  var CANS = [['GOOBY Cola. Tastes like regret.', '#6ef04a'], ['Diet Pls. Zero calories, zero questions.', '#ff4fd8'], ['Cherry Fizz. Warm, like the pool.', '#e8352a'], ['Last can. Again. Gooby restocks never.', '#4fe0ff']];
  var G = { it: 0, tap: 0, can: 0, canCol: '#6ef04a', cans: 0, said: '', saidAt: 0, f: [], fi: 0, ft: null,
    nm: function (p) { return '#' + p.id + (p.name ? ' ' + p.name : ''); },
    facts: function () { var w = S.w; if (!w) return []; if (G.ft === w) return G.f; var V = window.V2Rules || {}, tip = w.tip || 0, out = [];
      var kids = w.pets.filter(function (p) { return p.parents && p.parents.length === 2; }).sort(function (a, b) { return (b.hatchBlock || 0) - (a.hatchBlock || 0) || b.id - a.id; });
      var today = kids.filter(function (k) { return tip && tip - (k.hatchBlock || 0) <= 144; }).length, live = (w.breedReqs || []).filter(function (r) { return !r.used && (!tip || tip - r.block <= (V.BREED_WINDOW || 144)); });
      if (kids[0]) { var k = kids[0], hy = V.isHybrid && V.isHybrid(k.species); out.push('Newest egg: ' + G.nm(k) + ', ' + (V.speciesLabel ? V.speciesLabel(k.species) : k.species) + (hy ? ' hybrid!' : '.')); }
      out.push(today ? today + (today === 1 ? ' egg' : ' eggs') + ' checked out today.' : 'No eggs today. Slow night, pls.');
      if (live.length) out.push(live.length + (live.length === 1 ? ' guest is' : ' guests are') + ' waiting on a date.');
      var O = others(w); if (O[0]) out.push('Room 101: ' + G.nm(O[0][0]) + ' + ' + G.nm(O[0][1]) + '.');
      out.push(kids.length + ' eggs born here. Gooby kept count.');
      G.today = today; G.ft = w; return (G.f = out); },
    line: function () { if (G.mode(performance.now()).sleep) return 'Zzz\u2026 (tap Gooby)'; var f = G.facts(); return S.line % 2 === 0 && f.length ? f[(S.line / 2) % f.length] : LINES[((S.line - 1) / 2 | 0) % LINES.length]; },
    mode: function (t, rm) { var idle = performance.now() - G.it, picked = !!(S.A || S.B), hop = G.tap && t - G.tap < 500 ? (t - G.tap) / 500 : 0;
      var sleep = !picked && !S.party && !G.today && idle > 40000 && !hop; return { sleep: sleep, talk: !sleep && t - G.saidAt < 1600, excited: !sleep && (!!G.today || !!S.party), lean: picked && !sleep, hop: hop }; },
    say: function (l) { if (l === G.said) return; G.said = l; G.saidAt = performance.now(); var el = document.getElementById('motelGooby');
      if (!el) { var sc = document.getElementById('motelScene'); if (!sc || !sc.parentNode) return; el = document.createElement('p'); el.id = 'motelGooby'; el.className = 'mg-cap'; sc.parentNode.insertBefore(el, sc.nextSibling); }
      var tip = ''; try { tip = localStorage.getItem('xcpets-gooby-tapped') ? '' : '<span class="mg-tip">Tap Gooby or his guest book, a room window or the can machine</span>'; } catch (e) { }
      el.innerHTML = '<b class="mg-who">GOOBY</b><span class="mg-line">' + esc(l) + '</span>' + tip; },
    wake: function (l) { var n = performance.now(); G.it = n; S.bubble = l; S.lt = n; try { localStorage.setItem('xcpets-gooby-tapped', '1'); } catch (e) { } G.said = ''; if (!S.raf && S.c) draw(n); },
    hit: function (lx, ly) { if (lx >= 125 && lx <= 140 && ly >= 88 && ly <= 103) return 'book'; /* guestbook-close: the little ledger on the desk */ if (lx >= 112 && lx <= 139 && ly >= 70 && ly <= 100) return 'gooby'; if (lx >= 70 && lx <= 86 && ly >= 108 && ly <= 141) return 'can';
      var R = [194, 266, 306]; for (var j = 0; j < 3; j++) if (lx >= R[j] - 1 && lx <= R[j] + 13 && ly >= 84 && ly <= 103) return 'room' + j; if (lx >= 206 && lx <= 232 && ly >= 70 && ly <= 121) return 'door'; return null; },
    click: function (e) { var c = S.c; if (!c) return; var r = c.getBoundingClientRect(), lx = (e.clientX - r.left) / r.width * W, ly = (e.clientY - r.top) / r.height * H, h = G.hit(lx, ly), n = performance.now(); if (!h) return;
      if (h === 'book') { G.tap = n; G.wake('The guest book. Every stay is on Bitcoin.'); openBook(true); }
      else if (h === 'gooby') { openBook(true); var wasAsleep = G.mode(n).sleep; G.tap = n; G.wake(wasAsleep ? 'Huh? Gooby\u2019s up. Gooby\u2019s up.' : (G.taps = (G.taps || 0) + 1) % 2 ? TAPL[(G.taps >> 1) % TAPL.length] : (G.facts()[(G.taps >> 1) % Math.max(1, G.facts().length)] || TAPL[0])); }
      else if (h === 'can') { var cn = CANS[G.cans++ % CANS.length]; G.can = n; G.canCol = cn[1]; G.wake(cn[0]); }
      else if (h === 'door') G.wake(S.A && S.B ? 'Room #' + S.A.id + ' + #' + S.B.id + '. Ring the bell below.' : 'Pick two guests below. Gooby has keys.');
      else { var rm0 = S.rooms[+h.slice(4)]; G.wake(!rm0 ? 'Empty room. Clean sheets. Probably.' : 'Room ' + rm0.room + ': #' + rm0.a + ' + #' + rm0.b + (rm0.mode === 'sil' ? '. DND sign up.' : '. Real guests, real burns.')); } },
    move: function (e) { var c = S.c; if (!c) return; var r = c.getBoundingClientRect(); var hh = G.hit((e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H); c.style.cursor = hh ? 'pointer' : ''; c.title = hh === 'book' || hh === 'gooby' ? 'Guest book' : ''; } };
  G.it = typeof performance !== 'undefined' ? performance.now() : 0;
  function draw(t) { var x = S.x; if (!x) return; if (window.V2Sharp) V2Sharp.begin(x, S.k); else x.imageSmoothingEnabled = false; /* scene-sharp: logical units at k x */ var rm = reduced();
    px(x, '#0b0a1f', 0, 0, W, H); for (var i = 0; i < 40; i++) px(x, (i * 7 + Math.floor(t / 600)) % 11 ? '#c9c9ff' : '#555', (i * 53) % W, (i * 29) % 60, 1, 1); px(x, '#f5efc0', 286, 10, 10, 10); px(x, '#0b0a1f', 290, 9, 8, 9); /* stars + moon */
    /* ground: grass, sidewalk path to the office, walkway */ px(x, '#14301f', 0, 140, W, H - 140); for (var g = 0; g < 60; g++) px(x, '#1f4a2c', (g * 37) % W, 146 + (g * 13) % (H - 148), 1, 2);
    px(x, '#8d8a99', OD - 9, 140, 18, H - 140); for (var sy = 146; sy < H; sy += 8) px(x, '#6f6c7d', OD - 9, sy, 18, 1); px(x, '#a9a6b6', 100, 120, 220, 20); px(x, '#7f7c8c', 100, 139, 220, 1);
    /* Gooby's No-Tail Motel sign (3 lines, owner rename 2026-10-19 9:36 PM CT) + VACANCY (flicker kept) */ px(x, '#444', 30, 30, 3, 110); px(x, '#1a1a2a', 4, 2, 120, 35); px(x, '#000', 4, 2, 120, 2); px(x, '#000', 4, 36, 120, 1);
    var fl = rm ? 1 : (Math.floor(t / 90) % 23 !== 0); var tl = rm ? 1 : (Math.floor(t / 130) % 17 > 1);
    neon(x, 'GOOBY\u2019S', 64, 13, '#ffd166', true, 8); neon(x, 'NO-' + (tl ? 'TAIL' : 'T IL'), 64, 24, '#ff4fd8', fl, 8); neon(x, 'MOTEL', 64, 34, '#4fe0ff', true, 8);
    px(x, '#1a1a2a', 34, 40, 62, 12); neon(x, 'VACANCY', 65, 49, '#7dff6a', rm ? true : (Math.floor(t / 400) % 5 !== 0), 6);
    px(x, '#3ddc84', 6, 4, 4, 4); px(x, '#3ddc84', 118, 4, 4, 4); /* tiny laurels */
    /* lamp post */ px(x, '#333', 60, 92, 2, 48); px(x, '#333', 57, 140, 8, 2); px(x, '#555', 56, 88, 10, 4); x.save(); x.globalAlpha = rm ? .16 : .13 + .04 * Math.sin(t / 300); x.fillStyle = '#ffd166'; x.beginPath(); x.moveTo(58, 92); x.lineTo(64, 92); x.lineTo(76, 140); x.lineTo(46, 140); x.fill(); x.restore(); px(x, '#fff2b0', 58, 92, 6, 2);
    /* vending + ice machines */ px(x, '#c8102e', 72, 110, 12, 30); px(x, '#9fe8ff', 74, 113, 8, 12); for (var v = 0; v < 3; v++) px(x, ['#ffd166', '#7dff6a', '#ff4fd8'][v], 75 + v * 2, 116 + v * 3, 2, 2); px(x, '#000', 75, 130, 6, 3);
    if (G.can) { var ce = rm ? 1 : Math.min(1, (t - G.can) / 500), cy = Math.round(lerp(126, 134, ce)); px(x, '#000', 75, cy - 1, 6, 7); px(x, G.canCol, 76, cy, 4, 5); px(x, '#c0c0c0', 76, cy, 4, 1); if (t - G.can > 4000) G.can = 0; } /* gooby-guestbook: tapped can drops into the slot */
    px(x, '#d8e6f0', 86, 118, 13, 22); px(x, '#4fe0ff', 87, 120, 11, 6); x.font = '4px "Press Start 2P", monospace'; x.fillStyle = '#0b2a4a'; x.fillText('ICE', 87, 125); px(x, '#8aa', 88, 130, 9, 1); px(x, '#c8102e', 94, 132, 2, 2); /* ice machine (broke, per Gooby) */
    /* building */ px(x, '#e8a0b4', 104, 58, 216, 62); px(x, '#c47a92', 104, 58, 216, 4); px(x, '#5a3a4a', 100, 54, 220, 5);
    /* string lights */ for (var sx = 102; sx < W; sx += 3) { var sag = 6 * Math.sin(((sx - 102) % 54) / 54 * Math.PI); px(x, '#222', sx, 57 + sag, 3, 1); if ((sx - 102) % 9 === 0) { var on = rm || (Math.floor(t / 500) + sx / 9) % 4 !== 0; px(x, on ? ['#ffd166', '#ff4fd8', '#4fe0ff', '#7dff6a'][(sx / 9 | 0) % 4] : '#333', sx, 58 + sag, 2, 2); } }
    /* office: Roman columns, Gooby at the desk window, office door */ px(x, '#f2d7a0', 108, 66, 60, 54); [108, 163].forEach(function (cx) { px(x, '#f5efe0', cx, 64, 5, 56); px(x, '#d8cdb0', cx + 2, 66, 1, 52); });
    px(x, '#1a2b4a', 113, 78, 25, 20); var gm = G.mode(t, rm), hop = gm.hop ? -Math.round(3 * Math.sin(Math.PI * gm.hop)) : 0; x.save(); x.beginPath(); x.rect(113, 72, 25, 26); x.clip(); dog(x, 115, 80 + hop + (gm.lean ? -1 : 0), t, gm); x.restore(); px(x, '#7a4f2a', 112, 98, 26, 4);
    /* guestbook-close: 8-bit guest book on the desk ledge (tap = open the book below); 1px bob + sparkle hint, still under reduced motion */ var bb = rm ? 0 : (Math.floor(t / 700) % 4 === 0 ? -1 : 0); px(x, '#000', 127, 93 + bb, 12, 6); px(x, '#c8102e', 128, 94 + bb, 10, 4); px(x, '#f5efe0', 128, 97 + bb, 10, 1); px(x, '#ffd166', 132, 94 + bb, 1, 4); px(x, '#ffd166', 134, 95 + bb, 3, 1); if (!rm && Math.floor(t / 350) % 6 === 0) { px(x, '#fff2b0', 139, 90, 1, 3); px(x, '#fff2b0', 138, 91, 3, 1); }
    if (gm.sleep) { x.fillStyle = '#c9c9ff'; x.font = '4px "Press Start 2P", monospace'; var zq = rm ? 0 : Math.floor(t / 600) % 3; for (var zi = 0; zi <= zq; zi++) x.fillText('z', 133 + zi * 3, 80 - zi * 4); }
    if (gm.hop && !rm) { px(x, '#ffd166', 113, 72, 2, 4); px(x, '#ffd166', 113, 77, 2, 1); } /* '!' when tapped */
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
    if (talk) bubble(x, talk[0], talk[1], talk[2]); var gl = gline || S.bubble || G.line(); G.say(gl); bubble(x, gl, 104, 46, 156, 124);
    if (S.party && !rm) party(x, t);
    if (window.V2MotelReqs) V2MotelReqs.drawNote(x, t); /* tonight bundle: Gooby holds up a '1 waiting' note when breed requests wait at the desk */
    if (!rm) S.raf = requestAnimationFrame(function (n) { if (n - S.lt > 4200) { S.lt = n; S.line++; S.bubble = null; } draw(n); }); else S.raf = 0; }
  function state(w, a, b, ME) { var A = a ? w.byId[a] : null, B = b ? w.byId[b] : null, kid = null, st = 'empty';
    if (A && B) { var pair = [String(A.id), String(B.id)].sort().join(':');
      kid = w.pets.filter(function (p) { return p.parents && p.parents.map(String).sort().join(':') === pair; }).sort(function (x, y) { return y.hatchBlock - x.hatchBlock; })[0] || null;
      var tip = w.tip, live = function (r) { return !r.used && (tip == null || tip - r.block <= (window.V2Rules.BREED_WINDOW || 144)); }, req = (w.breedReqs || []).some(function (r) { return live(r) && r.a === A.id && r.b === B.id; }), inc = (w.breedReqs || []).some(function (r) { return live(r) && r.a === B.id && r.b === A.id; });
      st = kid && S.fresh === pair ? 'open' : req ? 'half' : inc ? 'invite' : 'both'; }
    else if (A || B) st = 'one';
    return { A: A, B: B, kid: kid, st: st }; }
  /* breed-picker-fix: one chip per pet = #ID name, owner badge (My Pets / Other Pets bc1q…j6n), species, rarity pill (site .pill.tier colors), ⭐ Pet Score */
  function shortA(a) { a = String(a || ''); return a.length > 12 ? a.slice(0, 4) + '\u2026' + a.slice(-3) : a; }
  function ownerBadge(p, ME) { return p.owner && p.owner === ME ? '<em class="bk-own me">My Pets</em>' : '<em class="bk-own" title="' + esc(p.owner || '') + '">Other Pets<br>' + esc(shortA(p.owner)) + '</em>'; }
  function breedChip(w, ME) { var V = window.V2Rules, TL = V.TIER_LABELS || ['Common', 'Uncommon', 'Rare', 'Legendary'], TID = ['common', 'uncommon', 'rare', 'legendary'];
    return function (r, sort) { var p = r.pets[0], sc = window.PetScore && PetScore.of(w, p), sp = V.speciesLabel ? V.speciesLabel(p.species) : p.species;
      return '<b>#' + p.id + '</b><span class="bk-nm">' + esc(p.name || '') + '</span>' + ownerBadge(p, ME) + '<span class="bk-sp">' + esc(sp) + '</span>' +
        '<span class="bk-row"><span class="pill tier tier-' + (p.resurrected ? 'god' : TID[p.tier] || 'common') + '">' + esc((p.resurrected ? 'God' : TL[p.tier]) || '') + '</span>' + (sort === 'power' ? '<span class="bk-sc"' + ptA(p) + '>⚡ ' + (window.UXB && UXB.power ? UXB.power(p) : window.V2Picker ? V2Picker.pow(p) : '–') : '<span class="bk-sc" title="Pet Score (display only)">⭐ ' + (sc ? sc.score : '–')) + '</span></span>' + /* fix-display-mismatch: number follows the sort */
        (V.breedsLeft ? '<span class="bk-br" title="Lifetime breeds used">💞 ' + V.breedsLeft(p, w.tip).used + '/' + V.BREED_CAP_V2 + '</span>' : '') + ''; }; }
  if (typeof document !== 'undefined' && !document.getElementById('bkCss')) { var bs = document.createElement('style'); bs.id = 'bkCss';
    bs.textContent = '.bk-br{font-size:12px;color:#ff9ad5;white-space:nowrap}.pk-breed .pk-keys{grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.pk-breed .pk-key{padding:6px 4px;gap:3px}.pk-breed .pk-key .bk-nm{font-size:14px}' +
      '.bk-sp{font-size:13px;color:#fff;font-weight:700;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bk-row{display:flex;flex-wrap:wrap;justify-content:center;gap:4px;align-items:center}.bk-row .pill.tier{font-size:11px;white-space:nowrap}' +
      '.bk-sc{font-size:12px;color:#ffd166;white-space:nowrap}.bk-own{font-style:normal;font-weight:700;font-size:11px;letter-spacing:.5px;line-height:1.25;padding:2px 4px;border:1px solid #000;background:#4b3f7a;color:#fff;max-width:100%;text-align:center;white-space:nowrap}.bk-own.me{background:#4fd18b;color:#0d1a12}' +
      '.pk-keys .bk-none{grid-column:1/-1}.bk-none.bk-res{color:#ffe58a;border-color:#c9b24a}.bk-none{margin:6px 0;padding:8px;border:2px solid #4b3f7a;background:#120e22;color:#9fe8ff;font-size:14px}.pk-key.sel .bk-sp,.pk-key.sel .bk-sc{color:#140f24}' +
      '@media (max-width:520px){.pk-breed .pk-keys{grid-template-columns:repeat(2,minmax(0,1fr))}.pk-breed .pk-key .bk-nm{font-size:15px}.bk-sp{font-size:14px}.bk-row .pill.tier{font-size:12px}.bk-sc{font-size:13px}}';
    (document.head || document.documentElement).appendChild(bs); }
  function render(w) { var U = window.V2UI, V = window.V2Rules, box = document.getElementById('motelScene'); if (!box || !U || !w) return; if (window.V2MotelReqs) V2MotelReqs.render(w); var ME = U.ME, tip = (U.S && U.S().tip) || w.tip;
    var a = document.getElementById('bA').value, b = document.getElementById('bB').value; if ((!a || !b) && S.fresh) { var fp = S.fresh.split(':'); a = fp[0]; b = fp[1]; } /* the pair just checked in may now be on breed cooldown; keep showing their door */ var s = state(w, a, b, ME); S.w = w; S.A = s.A; S.B = s.B; S.kid = s.kid; var now = performance.now(); ['A', 'B'].forEach(function (k) { var p = s[k]; if (!p) { delete S.walk[k]; return; } if (!S.walk[k] || S.walk[k].id !== p.id) S.walk[k] = { id: p.id, t0: k === 'B' && S.walk.A && S.walk.A.id === (s.A && s.A.id) ? Math.max(now, S.walk.A.t0 + 6200) : now }; }); if (s.st !== S.state) { S.state = s.st; if (s.st === 'open') { S.open = performance.now(); if (S.c && window.V2Sfx) V2Sfx.creak(); } }
    var c = box.querySelector('canvas'); if (!c) { box.innerHTML = '<canvas width="' + W + '" height="' + H + '" role="img" aria-label="Gooby\u2019s No-Tail Motel at night: Gooby at the desk, your guests walk in, other rooms busy"></canvas>'; c = box.querySelector('canvas'); }
    S.c = c; S.x = c.getContext('2d'); if (!c.dataset.gb) { c.dataset.gb = '1'; c.addEventListener('click', G.click); c.addEventListener('mousemove', G.move); } if (window.V2Sharp) { S.k = V2Sharp.fit(c, W, H); if (!S.rs) { S.rs = 1; V2Sharp.watch(function () { if (!S.c) return; var k0 = S.k; S.k = V2Sharp.fit(S.c, W, H); if (S.k !== k0 && !S.raf) draw(performance.now()); }); } } cancelAnimationFrame(S.raf); draw(performance.now());
    book(w); var desk = document.getElementById('motelDesk'); if (!desk) return; var L = V.breedPicker(w, ME, tip, a, window.V2UI && V2UI.pendingBreedIds ? V2UI.pendingBreedIds() : null), okA = L.mine.filter(function (x) { return !x.why && x.p.stage >= 3; }), okB = L.partners.filter(function (x) { return !x.why && x.p.stage >= 3; });
    /* breed-picker-fix (2026-10-19 10:20 PM CT): the picker lists only pets that can breed now (owner 10:23 PM CT: not-eligible pets stay out);
     * each chip now shows species, rarity, Pet Score and an owner badge. If none can, one short line with the main reason replaces the empty box. */
    var mainWhy = function () { var c = {}; L.mine.forEach(function (x) { var r = x.why || (x.p.stage >= 3 ? '' : 'needs Adult+'); if (!r) return; r = /cooldown/.test(r) ? 'on breeding cooldown' : /Adult|young|stage/i.test(r) ? 'too young (Adult+)' : r; c[r] = (c[r] || 0) + 1; });
      var k = Object.keys(c).sort(function (p, q) { return c[q] - c[p]; })[0]; return k ? ' · mostly ' + k : (L.mine.length ? '' : ' · no live pets at this address'); };
    var step = !a ? 'A' : !b ? 'B' : null, od = s.A && s.B ? odds(V, s.A, s.B) : null, T = ['Common', 'Uncommon', 'Rare', 'Legendary'];
    var side0 = S.pickSide || step, resHid = V.RES_BREED_WHY && s.A ? L.partners.filter(function (x) { return x.why === V.RES_BREED_WHY; }).length : 0; /* resurrected-breed-only: one line with the reason when the rule hides mates */
    var hint = !ME ? 'Connect your wallet to check in' : step === 'A' ? '1 · Pick your guest' : step === 'B' ? '2 · Pick the date (yours or anyone\u2019s)' : s.st === 'half' ? 'Checked in · waiting for #' + s.B.id + '\u2019s owner' : s.st === 'invite' ? '💌 #' + s.B.id + ' already checked in · ring to join' : s.st === 'open' ? '🥚 Door\u2019s open: egg #' + (s.kid && s.kid.id) : '3 · Ring the bell';
    desk.innerHTML = '<div class="mt-hint">' + hint + '</div>' +
      '<div class="mt-guests"><button type="button" class="mt-g' + (step === 'A' || S.pickSide === 'A' ? ' on' : '') + '" data-side="A">' + (s.A ? 'Room #' + s.A.id + ' · ' + esc(s.A.name) : 'Guest 1 ?') + '</button><span>+</span><button type="button" class="mt-g' + (step === 'B' || S.pickSide === 'B' ? ' on' : '') + '" data-side="B">' + (s.B ? 'Room #' + s.B.id + ' · ' + esc(s.B.name) : 'Guest 2 ?') + '</button></div>' +
      (od ? '<div class="mt-odds" aria-label="Odds"><b>ODDS</b> ' + od.sp.map(function (q) { return esc(q[0]) + ' ' + q[1].toFixed(q[1] === 100 ? 0 : 1) + '%'; }).join(' · ') + '<br>' + (od.tier.up ? '⬆ ' + T[Math.min(3, od.hiT + 1)] + ' ' + od.tier.up.toFixed(1) + '% · ' : '') + T[od.hiT] + ' ' + od.tier.hi.toFixed(1) + '%' + (od.tier.lo ? ' · ' + T[od.loT] + ' ' + od.tier.lo.toFixed(1) + '%' : '') + '</div>' : '') +
      (ME && window.UXB && UXB.browsePets && s.st !== 'open' ? '<div class="mt-browse" style="text-align:center;margin:6px 0"><button type="button" class="q" id="mtBrowse" title="Browse all your pets (or partners) with search, sort, filters and thumbnails">📋 Browse pets</button></div>' : '') +
      (side0 === 'B' && resHid ? '<p class="bk-none bk-res" role="note">😇 ' + (s.A && s.A.resurrected ? '#' + s.A.id + ' is a God (resurrected). ' : '') + 'Resurrected pets only breed with other resurrected pets: ' + resHid + ' ' + (s.A && s.A.resurrected ? 'non-resurrected pet' + (resHid === 1 ? '' : 's') : resHid === 1 ? 'God' : (V.GOD_PLURAL || 'Gods')) + ' hidden.</p>' : '') +
      '<div id="motelPick"></div>';
    var side = S.pickSide || step; desk.querySelectorAll('[data-side]').forEach(function (bt) { bt.onclick = function () { S.pickSide = bt.dataset.side; S.fresh = null; render(U.world()); }; });
    /* P13 (2026-10-21): 'Browse pets' opens the fight picker's pet browser (UXB.browsePets) for the current guest slot: every pet in the breed list
     * (mine for Guest 1, partners for Guest 2), not-eligible ones disabled with the reason (breedPicker why / needs Adult+). Picking sets bA/bB the
     * same way the chips do; the walk-in animation and the room chips are untouched. */
    var mb = document.getElementById('mtBrowse'); if (mb) mb.onclick = function () { var sd = S.pickSide || step || 'A', src = sd === 'A' ? L.mine : L.partners, why = {};
      src.forEach(function (x) { why[x.p.id] = x.why || (x.p.stage >= 3 ? '' : 'needs Adult+'); });
      UXB.browsePets('br' + sd, { title: sd === 'A' ? 'Pick Guest 1 (your pet)' : 'Pick Guest 2 (the date)', okLabel: '✅ Can breed now', pets: src.map(function (x) { return x.p; }), why: function (p) { return why[p.id] || null; },
        onPick: function (id) { var k = String(id); S.fresh = null; document.getElementById(sd === 'A' ? 'bA' : 'bB').value = k; if (sd === 'A' && document.getElementById('bB').value === k) document.getElementById('bB').value = '';
          S.pickSide = sd === 'A' && !document.getElementById('bB').value ? 'B' : null; S.bubble = 'Room #' + k + '? Gooby pls.'; S.lt = G.it = performance.now(); U.render(); } }); };
    var bell = document.getElementById('bGo'); if (bell) { bell.textContent = (s.st === 'invite' ? 'Accept check-in · ' : 'Check in · ') + (window.V2Rules && V2Rules.uiBreedFeeStr ? V2Rules.uiBreedFeeStr() : '690'); bell.disabled = !(s.A && s.B) || s.st === 'open'; }
    if (side && window.V2Picker) { var list = side === 'A' ? okA : okB; if (!list.length) { document.getElementById('motelPick').innerHTML = '<p class="bk-none">No pets can breed right now' + esc(side === 'A' ? mainWhy() : '') + '</p>'; return; }
      /* breed-empty-fix (2026-10-19 ~11 PM CT): the empty line used to fire only when the UNFILTERED list was empty; a picker filter (My Pets chip in the
     * partner picker, search, species, rarity) that left nothing fell through to the generic 'No matches' box. Now the filtered-empty case shows the same line. */
      V2Picker.mount(document.getElementById('motelPick'), { cls: 'pk-breed', noWho: side === 'A', labels: { mine: 'My Pets', others: 'Other Pets', mineFirst: 'My Pets first' },
        empty: function (st) { var why = st.who === 'mine' && !list.some(function (x) { return x.p.owner === ME; }) ? 'None of my pets can breed right now' + esc(mainWhy()) : st.who === 'others' && !list.some(function (x) { return x.p.owner !== ME; }) ? 'No other pets can breed right now' : 'No breedable pets match these filters';
          return '<p class="bk-none">' + why + '</p>'; }, sorts: ['score', 'rarity', 'power', 'newest'], dir: true, w: w, me: ME, selected: side === 'A' ? a : b, per: 8, records: function () { return list.map(function (x) { return { key: String(x.p.id), pets: [x.p], newest: x.p.hatchBlock, html: breedChip(w, ME) }; }); },
        onPick: function (r) { S.fresh = null; document.getElementById(side === 'A' ? 'bA' : 'bB').value = r.key; if (side === 'A') document.getElementById('bB').value = document.getElementById('bB').value === r.key ? '' : document.getElementById('bB').value;
          S.pickSide = side === 'A' && !document.getElementById('bB').value ? 'B' : null; S.bubble = 'Room #' + r.key + '? Gooby pls.'; S.lt = G.it = performance.now(); U.render(); } }); } }
  /* after a check-in burn the existing code clears bA/bB and plays playBreed; we keep the pair so the door can open in place when the egg lands */
  /* GUESTBOOK (owner 7:58 PM CT): past breeding results from the replayed world, one short PG-13 note per egg, newest first, paged on the desk. */
  var NOTES = ['Left the DND sign up all night.', 'Room service: one egg.', 'Gooby heard nothing. Gooby pls.', 'Five stars. Would nest again.', 'Ice bucket never got used.', 'Checked out early. Glowing.',
    'Towels: missing. Egg: present.', 'Asked for late checkout. Got an egg.', 'The walls are thin. Congrats.', 'Paid cash. Left a hatchling.', 'Mint on the pillow, egg on the bed.', 'Swore it was "just a nap".'];
  /* GUESTBOOK v2 (gooby-guestbook 2026-10-21): every row is a real breed from the replayed chain. Top: guests checked in and waiting for their date
   * (live unused breed requests). Then check-outs, newest first: both parents' sprites + names -> the egg's sprite, #, name, species, rarity pill,
   * hybrid badge, block and rough age. Gooby's PG-13 note is labelled as his note (a joke, not news). Filter: All stays / My pets. Paged (arrows + swipe). */
  var BK = { page: 0, mine: false };
  function ago(tip, b) { if (!tip || !b) return ''; var m = Math.max(0, tip - b) * 10; return m < 60 ? 'just now' : m < 1440 ? '~' + Math.round(m / 60) + ' h ago' : '~' + Math.round(m / 1440) + ' d ago'; }
  function gbSpr(p) { return p ? '<canvas class="gb-spr" width="32" height="32" data-gbp="' + p.id + '" title="#' + p.id + ' ' + esc(p.name || '') + '"></canvas>' : '<span class="gb-spr gb-q">?</span>'; }
  function gbName(w, id) { var p = w.byId[id]; return '<a href="pet.html?id=' + id + '">#' + id + '</a>' + (p && p.name ? ' ' + esc(p.name) : ''); }
  function book(w) { var el = document.getElementById('motelBook'); if (!el) return; var V = window.V2Rules || {}, ME = window.V2UI && V2UI.ME, tip = w.tip || 0, TL = V.TIER_LABELS || ['Common', 'Uncommon', 'Rare', 'Legendary'], TID = ['common', 'uncommon', 'rare', 'legendary'];
    var mineP = function (id) { var p = w.byId[id]; return !!(p && ME && p.owner === ME); };
    var all = w.pets.filter(function (p) { return p.parents && p.parents.length === 2; }).sort(function (a, b) { return (b.hatchBlock || 0) - (a.hatchBlock || 0) || b.id - a.id; });
    var L = BK.mine ? all.filter(function (c) { return mineP(c.id) || mineP(c.parents[0]) || mineP(c.parents[1]); }) : all;
    var wait = (w.breedReqs || []).filter(function (r) { return !r.used && (!tip || tip - r.block <= (V.BREED_WINDOW || 144)) && (!BK.mine || mineP(r.a) || mineP(r.b)); }).sort(function (p, q) { return q.block - p.block; });
    var today = all.filter(function (c) { return tip && tip - (c.hatchBlock || 0) <= 144; }).length, hyb = all.filter(function (c) { return V.isHybrid && V.isHybrid(c.species); }).length;
    BK.w = w; var gk = [tip, all.length, (w.breedReqs || []).length, wait.length, BK.page, BK.mine, ME, BK.closed].join('|'); if (el._gk === gk && el.firstChild) return; el._gk = gk; /* re-renders often: keep the sprite canvases unless something changed */
    if (BK.closed) { el.innerHTML = '<div class="gb gb-cover"><button type="button" class="gb-open" data-gbo="1" aria-expanded="false" aria-controls="motelBook"><b class="gb-h">📒 GUESTBOOK</b><span class="gb-ot">Open book ▸</span></button><span class="gb-sub">🥚 ' + all.length + ' eggs · ' + hyb + ' hybrids · tap Gooby or the book on his desk</span></div>'; el.querySelector('[data-gbo]').onclick = function () { openBook(false); }; el.ontouchstart = el.ontouchend = null; return; }
    var per = 6, pages = Math.max(1, Math.ceil(L.length / per)); BK.page = Math.min(BK.page, pages - 1); var P = L.slice(BK.page * per, BK.page * per + per);
    var h = '<div class="gb"><div class="gb-top"><b class="gb-h">📒 GUESTBOOK</b><span class="gb-sub">Every stay is a real breed burn on Bitcoin</span><button type="button" class="gb-x" data-gbx="1" aria-expanded="true" aria-label="Close guest book" title="Close (Esc)">✕ Close book</button></div>' +
      '<div class="gb-stats"><span>🥚 <b>' + all.length + '</b> eggs</span><span>🌙 <b>' + today + '</b> today</span><span>🧬 <b>' + hyb + '</b> hybrids</span><span>🛎️ <b>' + (w.breedReqs || []).filter(function (r) { return !r.used && (!tip || tip - r.block <= (V.BREED_WINDOW || 144)); }).length + '</b> waiting</span></div>' +
      (ME ? '<div class="gb-tabs" role="tablist"><button type="button" class="q' + (BK.mine ? '' : ' on') + '" data-gbf="0" aria-pressed="' + !BK.mine + '">All stays</button><button type="button" class="q' + (BK.mine ? ' on' : '') + '" data-gbf="1" aria-pressed="' + BK.mine + '">My pets</button></div>' : '');
    if (BK.page === 0 && wait.length) h += '<div class="gb-sec">🛎️ Checked in, waiting for a date</div>' + wait.slice(0, 3).map(function (r) {
      var left = tip ? Math.max(0, (V.BREED_WINDOW || 144) - (tip - r.block)) : null;
      return '<div class="gb-row gb-wait"><div class="gb-pics">' + gbSpr(w.byId[r.a]) + '<span class="gb-op">♥</span>' + gbSpr(w.byId[r.b]) + '</div><div class="gb-txt"><span class="gb-main">' + gbName(w, r.a) + ' is waiting for ' + gbName(w, r.b) + '</span>' +
        '<span class="gb-meta">checked in at block ' + Number(r.block).toLocaleString('en-US') + (left != null ? ' · key expires in ' + left + ' blocks' : '') + '</span></div></div>'; }).join('');
    h += '<div class="gb-sec">🥚 Checked out with an egg</div>' + (P.length ? P.map(function (c) { var hy = V.isHybrid && V.isHybrid(c.species), sp = V.speciesLabel ? V.speciesLabel(c.species) : c.species;
        return '<div class="gb-row"><div class="gb-pics">' + gbSpr(w.byId[c.parents[0]]) + '<span class="gb-op">♥</span>' + gbSpr(w.byId[c.parents[1]]) + '<span class="gb-op">→</span>' + gbSpr(c) + '</div>' +
          '<div class="gb-txt"><span class="gb-main">' + gbName(w, c.parents[0]) + ' × ' + gbName(w, c.parents[1]) + '</span>' +
          '<span class="gb-kid">🥚 <a href="pet.html?id=' + c.id + '">#' + c.id + (c.name ? ' ' + esc(c.name) : '') + '</a> · ' + esc(sp) + ' <span class="pill tier tier-' + (c.resurrected ? 'god' : TID[c.tier] || 'common') + '">' + esc((c.resurrected ? 'God' : TL[c.tier]) || '') + '</span>' + (hy && !/hybrid/i.test(sp) ? ' <span class="gb-hyb">🧬 Hybrid</span>' : '') + (mineP(c.id) ? ' <em class="bk-own me">My Pets</em>' : '') + '</span>' +
          '<span class="gb-meta">block ' + Number(c.hatchBlock || 0).toLocaleString('en-US') + (ago(tip, c.hatchBlock) ? ' · ' + ago(tip, c.hatchBlock) : '') + '</span>' +
          '<span class="gb-note">Gooby\u2019s note: \u201c' + NOTES[c.id % NOTES.length] + '\u201d</span></div></div>'; }).join('') : '<div class="gb-row gb-empty">' + (BK.mine ? 'None of my pets have stayed here yet. Pick two guests above.' : 'No guests yet. Be the first.') + '</div>') +
      '<div class="gb-pg"><button type="button" class="pk-arr" data-gb="-1" aria-label="Newer"' + (BK.page ? '' : ' disabled') + '>◀</button><span>' + (BK.page + 1) + ' / ' + pages + '</span><button type="button" class="pk-arr" data-gb="1" aria-label="Older"' + (BK.page < pages - 1 ? '' : ' disabled') + '>▶</button></div></div>';
    el.innerHTML = h;
    var R = window.V2Render; el.querySelectorAll('canvas[data-gbp]').forEach(function (cv) { var p = w.byId[cv.dataset.gbp]; if (!p || !R) return; var mk = function () { return R.petFrames(p, w); }; if (R.lazy) R.lazy(cv, mk, true); else try { R.paint(cv, mk()[0]); } catch (e) { } });
    el.querySelectorAll('[data-gb]').forEach(function (b) { b.onclick = function () { turn(w, +b.dataset.gb, BK.page + +b.dataset.gb); }; });
    el.querySelector('[data-gbx]').onclick = function () { closeBook(); };
    el.querySelectorAll('[data-gbf]').forEach(function (b) { b.onclick = function () { BK.mine = b.dataset.gbf === '1'; BK.page = 0; book(w); }; });
    var x0 = null; el.ontouchstart = function (e) { x0 = e.touches[0].clientX; }; el.ontouchend = function (e) { if (x0 == null) return; var dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 40) { var np = Math.max(0, Math.min(pages - 1, BK.page + (dx < 0 ? 1 : -1))); if (np !== BK.page) turn(w, dx < 0 ? 1 : -1, np); } }; }
  /* guestbook-close (owner Oct 22 2026 ~11:29 PM CT: 'we should be able to close Gooby's guest book'): ✕ Close book, Esc, or a tap outside the book on a phone
   * closes it to a cover (fold toward the spine, same 8-step leaf as the page turn), and puts the player back at the scroll spot they had when it opened
   * (or keeps the cover in view). Open again with the cover button, Gooby, or the little book on his desk. Remembered per device. Display only. */
  try { BK.closed = localStorage.getItem('xcpets-gb-closed') === '1'; } catch (e) { }
  function gbSave() { try { localStorage.setItem('xcpets-gb-closed', BK.closed ? '1' : '0'); } catch (e) { } }
  function fold(el, old, dir) { if (!old || reduced() || !el.animate) return; var r = old.getBoundingClientRect(), er = el.getBoundingClientRect(), front = old.cloneNode(true), cs = old.querySelectorAll('canvas'), cc = front.querySelectorAll('canvas');
    cc.forEach(function (c, i) { try { c.getContext('2d').drawImage(cs[i], 0, 0); } catch (e) { } c.removeAttribute('data-gbp'); }); front.classList.add('gb-front'); front.querySelectorAll('[id]').forEach(function (n) { n.removeAttribute('id'); });
    return function () { var leaf = document.createElement('div'); leaf.className = 'gb-leaf ' + (dir > 0 ? 'gb-fwd' : 'gb-back'); leaf.setAttribute('aria-hidden', 'true');
      leaf.style.cssText = 'left:' + (r.left - er.left) + 'px;top:' + (r.top - er.top) + 'px;width:' + r.width + 'px;height:' + r.height + 'px'; var shade = document.createElement('div'); shade.className = 'gb-shade';
      front.style.margin = '0'; front.style.height = '100%'; front.style.overflow = 'hidden'; leaf.appendChild(front); front.appendChild(shade); if (getComputedStyle(el).position === 'static') el.style.position = 'relative'; el.appendChild(leaf);
      var an = leaf.animate([{ transform: 'scale(1, 1)', opacity: 1 }, { transform: 'scale(0, 1)', opacity: .6 }], { duration: 480, easing: 'steps(8, end)', fill: 'forwards' }); shade.animate([{ opacity: 0 }, { opacity: .55 }], { duration: 240, easing: 'steps(4, end)', fill: 'forwards' });
      var done = function () { if (leaf.parentNode) leaf.remove(); }; an.onfinish = done; an.oncancel = done; }; }
  function closeBook() { var el = document.getElementById('motelBook'); if (!el || BK.closed || !BK.w) return; var top0 = el.getBoundingClientRect().top, go = fold(el, el.querySelector('.gb'), 1), prev = el.querySelector('.gb-leaf'); if (prev) prev.remove();
    BK.closed = true; gbSave(); el._gk = null; book(BK.w); if (go) go();
    if (BK.sy != null) window.scrollTo(0, BK.sy); else if (top0 < 0) window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - 80); BK.sy = null;
    var ob = el.querySelector('[data-gbo]'); if (ob) try { ob.focus({ preventScroll: true }); } catch (e) { } }
  function openBook(fromScene) { var el = document.getElementById('motelBook'); if (!el || !BK.w) return; if (!BK.closed) { if (fromScene) el.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' }); return; }
    BK.sy = window.scrollY; var go = fold(el, el.querySelector('.gb'), -1); BK.closed = false; gbSave(); el._gk = null; book(BK.w); if (go) go();
    if (fromScene) { var r = el.getBoundingClientRect(); if (r.top > window.innerHeight - 120) window.scrollTo({ top: window.scrollY + r.top - 80, behavior: reduced() ? 'auto' : 'smooth' }); } }
  if (typeof document !== 'undefined') { document.addEventListener('keydown', function (e) { if (e.key !== 'Escape' || BK.closed) return; var ep = document.getElementById('eggPop'); if (ep && ep.getClientRects().length) return; /* an open egg popup takes Esc first */ var el = document.getElementById('motelBook'); if (!el || !el.firstChild) return; var r = el.getBoundingClientRect(); if (r.bottom < 0 || r.top > window.innerHeight) return; closeBook(); });
    document.addEventListener('click', function (e) { if (BK.closed || !(window.matchMedia && matchMedia('(max-width: 640px), (pointer: coarse)').matches)) return; var el = document.getElementById('motelBook'); if (!el || !el.firstChild || el.contains(e.target)) return;
      if (e.target.closest && e.target.closest('a,button,input,select,textarea,summary,label,canvas,[role=dialog],.eggpop,[data-gb]')) return; var r = el.getBoundingClientRect(); if (r.bottom < 0 || r.top > window.innerHeight) return; closeBook(); }); }
  /* guestbook-pageturn (owner voice call, Oct 22 2026): ◀ / ▶ and swipe flip the page like a real guest book. The old page is copied (sprites too)
   * into a leaf over the book, the new page renders underneath at once (links work right away), and the leaf curls away in 8 hard steps:
   * older (▶ / swipe left) lifts off to the left, newer (◀ / swipe right) to the right. Transform + opacity only (smooth on phones). guestbook-stretch-fix: the leaf folds flat with a 2D scaleX toward the spine (transform-origin on the spine edge, height locked, no perspective/rotateY, which ballooned the near edge on wide desktop pages); pixel sprites stay image-rendering:pixelated.
   * prefers-reduced-motion: no animation, the page just changes. Display only. */
  function turn(w, dir, np) { var el = document.getElementById('motelBook'), old = el && el.querySelector('.gb');
    if (!old || reduced() || !el.animate) { BK.page = np; book(w); return; }
    var prev = el.querySelector('.gb-leaf'); if (prev) prev.remove();
    var r = old.getBoundingClientRect(), er = el.getBoundingClientRect(), front = old.cloneNode(true), cs = old.querySelectorAll('canvas'), cc = front.querySelectorAll('canvas');
    cc.forEach(function (c, i) { try { c.getContext('2d').drawImage(cs[i], 0, 0); } catch (e) { } c.removeAttribute('data-gbp'); });
    front.classList.add('gb-front'); front.querySelectorAll('[id]').forEach(function (n) { n.removeAttribute('id'); });
    BK.page = np; book(w);
    var leaf = document.createElement('div'); leaf.className = 'gb-leaf ' + (dir > 0 ? 'gb-fwd' : 'gb-back'); leaf.setAttribute('aria-hidden', 'true');
    leaf.style.cssText = 'left:' + (r.left - er.left) + 'px;top:' + (r.top - er.top) + 'px;width:' + r.width + 'px;height:' + r.height + 'px';
    var back = document.createElement('div'); back.className = 'gb-backface'; var shade = document.createElement('div'); shade.className = 'gb-shade';
    front.style.margin = '0'; front.style.height = '100%'; front.style.overflow = 'hidden'; leaf.appendChild(front); leaf.appendChild(back); front.appendChild(shade);
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative'; el.appendChild(leaf);
    var E = 'steps(8, end)', T = 560;
    var an = leaf.animate([{ transform: 'scale(1, 1)' }, { transform: 'scale(0, 1)' }], { duration: T, easing: E, fill: 'forwards' });
    shade.animate([{ opacity: 0 }, { opacity: .55 }], { duration: T / 2, easing: 'steps(4, end)', fill: 'forwards' });
    var done = function () { if (leaf.parentNode) leaf.remove(); }; an.onfinish = done; an.oncancel = done; }
  /* breed-picker-fix (owner 10:24 PM CT): breed celebration in two stages. (a) celebrate(tx): right after the breed burn is broadcast, ~2.5 s of 8-bit
   * hearts + sparkles round Gooby and a wobbling egg at the desk, plus a line 'Breed sent! Your egg appears when the block confirms' + tx link
   * (reduced motion = the line only). Nothing about the outcome is shown before the block. (b) eggPop(w, kid): called once per new pet by
   * notifyBreeds (which already stores seen ids in localStorage) when the replay first sees the egg: sprite, #, species, rarity, Pet Score, parents. */
  function party(x, t) { var e = t - S.party; if (e > 2600) { S.party = 0; return; } var hx = [104, 150, 120, 160, 96, 136], sp = ['#ff4fd8', '#ff9ad5', '#ffd166', '#4fe0ff'];
    for (var i = 0; i < hx.length; i++) { var yy = Math.round(100 - ((e / 18 + i * 13) % 60)), xx = hx[i] + Math.round(Math.sin(e / 200 + i) * 3); px(x, '#000', xx - 1, yy - 1, 7, 6); px(x, sp[i % 2], xx, yy, 2, 2); px(x, sp[i % 2], xx + 3, yy, 2, 2); px(x, sp[i % 2], xx, yy + 1, 5, 2); px(x, sp[i % 2], xx + 1, yy + 3, 3, 1); px(x, sp[i % 2], xx + 2, yy + 4, 1, 1); }
    for (var j = 0; j < 8; j++) { if ((Math.floor(e / 120) + j) % 3) continue; var sx = 92 + (j * 37) % 80, sy = 50 + (j * 23) % 50; px(x, sp[2 + j % 2], sx, sy - 2, 1, 5); px(x, sp[2 + j % 2], sx - 2, sy, 5, 1); }
    var wob = Math.round(Math.sin(e / 90) * 2), ex = 124 + wob, ey = 70; px(x, '#000', ex - 1, ey - 1, 12, 15); px(x, '#fff6e0', ex, ey + 2, 10, 11); px(x, '#fff6e0', ex + 2, ey, 6, 2); px(x, '#ff9ad5', ex + 2, ey + 6, 2, 2); px(x, '#4fe0ff', ex + 6, ey + 9, 2, 2); }
  function celebrate(tx) { S.party = performance.now(); S.bubble = 'Ooh! Gooby saw nothing. Egg soon.'; S.lt = S.party; if (window.V2Sfx && V2Sfx.creak) V2Sfx.creak();
    var desk = document.getElementById('motelDesk'), el = document.getElementById('motelSent'); if (desk) { if (!el) { el = document.createElement('p'); el.id = 'motelSent'; el.className = 'bk-sent'; desk.parentNode.insertBefore(el, desk); }
      el.innerHTML = '💞 Breed sent! Your egg appears when the block confirms.' + (tx ? ' <a target="_blank" rel="noopener" href="https://mempool.space/tx/' + esc(tx) + '">tx ' + esc(String(tx).slice(0, 8)) + '… ↗</a>' : ''); }
    if (!reduced() && S.c && !S.raf) draw(performance.now()); }
  function eggPop(w, k) { if (!k || document.getElementById('eggPop')) return; var V = window.V2Rules, R = window.V2Render, TID = ['common', 'uncommon', 'rare', 'legendary'], sc = window.PetScore && PetScore.of(w, k), A = w.byId[k.parents[0]], B = w.byId[k.parents[1]];
    var nm = function (p, id) { return '#' + id + (p ? ' ' + esc(p.name || '') : ''); }, d = document.createElement('div'); d.id = 'eggPop'; d.className = 'eggpop' + (reduced() ? ' rm' : ''); d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'New egg hatched');
    d.innerHTML = '<div class="ep-box"><div class="ep-fx" aria-hidden="true">💞 ✨ 🥚 ✨ 💞</div><b class="ep-h">IT\u2019S AN EGG!</b><span class="ep-sp"></span><div class="ep-nm">#' + k.id + ' ' + esc(k.name || '') + '</div>' +
      '<div>' + esc(V.speciesLabel(k.species)) + ' <span class="pill tier tier-' + (TID[k.tier] || 'common') + '">' + esc((V.TIER_LABELS || [])[k.tier] || '') + '</span> <span class="ep-sc">⭐ ' + (sc ? sc.score : '–') + '</span></div>' +
      '<div class="small">Parents: ' + nm(A, k.parents[0]) + ' × ' + nm(B, k.parents[1]) + '</div><div class="row" style="justify-content:center;margin-top:8px"><a class="btn" href="pet.html?id=' + k.id + '">See #' + k.id + '</a><button type="button" class="q" id="epClose">Close</button></div></div>';
    document.body.appendChild(d); if (R && R.lazy) { var c = document.createElement('canvas'); c.width = c.height = 32; c.className = 'sprite'; d.querySelector('.ep-sp').appendChild(c); R.lazy(c, function () { return R.petFrames(k, w); }, true); }
    var x = function () { d.remove(); }; d.querySelector('#epClose').onclick = x; d.onclick = function (e) { if (e.target === d) x(); }; }
  if (typeof document !== 'undefined' && !document.getElementById('gbCss')) { var gs = document.createElement('style'); gs.id = 'gbCss'; /* gooby-guestbook */
    gs.textContent = '.mg-cap{margin:-2px 0 8px;padding:6px 8px;border:3px solid #000;background:#fff8e1;color:#1b1b1b;box-shadow:4px 4px 0 #000;font-size:14px;line-height:1.35;display:flex;flex-wrap:wrap;gap:4px 8px;align-items:baseline;overflow-wrap:anywhere}' +
      '.mg-who{font-family:"Press Start 2P",monospace;font-size:9px;color:#fff;background:#111;padding:3px 5px;border-bottom:2px solid #6ef04a}.mg-line{flex:1 1 180px;font-weight:700}.mg-tip{flex-basis:100%;font-size:12px;color:#6a4a5a}' +
      '.gb-leaf{position:absolute;z-index:3;pointer-events:none;will-change:transform}.gb-fwd{transform-origin:0 50%}.gb-back{transform-origin:100% 50%}' +
      '.gb-leaf>.gb-front,.gb-backface{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden}.gb-leaf>.gb-front{box-shadow:none}' +
      '.gb-backface{transform:rotateY(180deg);border:3px solid #000;background:#e9dfc6 repeating-linear-gradient(#e9dfc6 0 15px,#c9b996 15px 17px);box-shadow:inset 6px 0 0 #d6c7a6}' +
      '.gb-shade{position:absolute;inset:0;pointer-events:none;opacity:0;background:linear-gradient(90deg,rgba(0,0,0,0) 0 50%,rgba(42,21,48,.12) 50% 75%,rgba(42,21,48,.28) 75% 100%)}.gb-back .gb-shade{transform:scaleX(-1)}' +
      '.gb-top{flex-wrap:wrap;gap:2px 8px;position:relative;padding-right:118px}.gb-x{position:absolute;top:-2px;right:0;min-height:40px;padding:4px 10px;font-family:"Press Start 2P",monospace;font-size:9px;background:#2a1530;color:#ffd1ec;border:2px solid #000;box-shadow:2px 2px 0 #000;cursor:pointer}.gb-x:hover,.gb-x:focus-visible{background:#c8102e;color:#fff}.gb-x:active{transform:translate(2px,2px);box-shadow:none}' +
      '.gb-cover{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px}.gb-open{display:flex;align-items:center;gap:10px;min-height:44px;padding:6px 12px;background:#c8102e;color:#fff;border:3px solid #000;box-shadow:inset 6px 0 0 #7a0a1c,3px 3px 0 #000;cursor:pointer;font:inherit}.gb-open .gb-h{color:#ffd166}.gb-ot{font-family:"Press Start 2P",monospace;font-size:9px}.gb-open:hover,.gb-open:focus-visible{filter:brightness(1.12)}.gb-open:active{transform:translate(2px,2px);box-shadow:inset 6px 0 0 #7a0a1c}' +
      '@media (max-width:520px){.gb-top{padding-right:0;padding-top:44px}.gb-x{top:0}}' +
      '.gb-top{flex-wrap:wrap;gap:2px 8px}.gb-sub{font-size:12px;color:#6a4a5a}.gb-stats{display:flex;flex-wrap:wrap;gap:4px 12px;margin:6px 0;font-size:13px}.gb-tabs{display:flex;gap:6px;margin:4px 0 6px}.gb-tabs .q{min-height:40px;padding:4px 12px;background:#f5efe0;color:#2a1530;border:2px solid #000;box-shadow:2px 2px 0 #000}.gb-tabs .q.on{background:#4fd18b;color:#0d1a12}.gb-kid a,.gb-main a{color:#2e5aa8}' +
      '.gb-sec{margin:8px 0 2px;font-weight:700;color:#2a1530;border-bottom:2px solid #2a1530}.motel-book .gb-row{flex-direction:row;gap:8px;align-items:center}.gb-wait{background:#ffe9f4}' +
      '.gb-pics{display:flex;align-items:center;gap:2px;flex:0 0 auto}.gb-spr{width:32px;height:32px;image-rendering:pixelated;border:2px solid #000;background:#1a2b4a;display:inline-block}.gb-q{color:#fff;text-align:center;line-height:28px}.gb-op{font-weight:700;color:#c8102e;font-size:12px}' +
      '.gb-txt{display:flex;flex-direction:column;min-width:0;flex:1}.gb-kid{font-size:13px}.gb-kid .pill.tier{font-size:11px}.gb-hyb{font-size:12px;font-weight:700;color:#7a2a8a;white-space:nowrap}.gb-meta{font-size:12px;color:#6a6a6a}.gb-empty{font-style:italic}' +
      '@media (max-width:520px){.gb-spr{width:28px;height:28px}.motel-book .gb-row{flex-direction:column;align-items:flex-start;gap:3px}.mg-cap{font-size:13px}}';
    (document.head || document.documentElement).appendChild(gs); }
  if (typeof document !== 'undefined' && !document.getElementById('epCss')) { var es = document.createElement('style'); es.id = 'epCss';
    es.textContent = '.bk-sent{margin:6px 0;padding:8px;border:2px solid #000;background:#2a1530;color:#ffd1ec;font-size:14px;box-shadow:3px 3px 0 #000;overflow-wrap:anywhere}.bk-sent a{color:#9fe8ff}' +
      '.eggpop{position:fixed;inset:0;z-index:9000;background:rgba(10,6,20,.72);display:flex;align-items:center;justify-content:center;padding:12px}.ep-box{max-width:340px;width:100%;text-align:center;border:3px solid #000;background:#2a1530;color:#fff;padding:12px;box-shadow:4px 4px 0 #000;font-size:14px}' +
      '.ep-h{display:block;font-family:"Press Start 2P",monospace;font-size:14px;color:#ff9ad5;margin:4px 0}.ep-sp canvas{width:96px;height:96px;image-rendering:pixelated}.ep-nm{font-weight:700;font-size:16px}.ep-sc{color:#ffd166;white-space:nowrap}.ep-fx{font-size:18px;letter-spacing:4px}' +
      '.eggpop:not(.rm) .ep-fx{animation:epb .6s steps(3) 4}.eggpop:not(.rm) .ep-sp{display:inline-block;animation:epw .5s steps(2) 5}@keyframes epb{50%{transform:translateY(-6px)}}@keyframes epw{50%{transform:rotate(6deg)}}@media (prefers-reduced-motion:reduce){.eggpop .ep-fx,.eggpop .ep-sp{animation:none!important}}';
    (document.head || document.documentElement).appendChild(es); }
  function checkedIn(a, b) { S.fresh = [String(a), String(b)].sort().join(':'); if (window.V2Sfx) V2Sfx.creak(); S.bubble = 'Keys out. Door opens when both are in.'; S.lt = performance.now(); }
  window.V2Motel = { drawGooby: dog, neon: neon, render: render, book: book, NOTES: NOTES, odds: odds, checkedIn: checkedIn, celebrate: celebrate, eggPop: eggPop, LINES: LINES, _state: function () { return S; } };
})();
