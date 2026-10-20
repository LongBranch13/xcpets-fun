/* XCPETS X Circus Kekimus fun pack (tonight bundle 2026-10-19, front-page-entries; NOT LIVE). Cosmetic only: nothing here touches HP, turns,
 * burns or the replay. Everything is rolled from the fight's own seed (accept block hash + tx), so every replay shows the same thing.
 * - Crowd mood meter (😴..🔥): up on big hits / near-K.O. / upsets, down on stalls (misses); the crowd sits, cheers, or does the wave + confetti.
 * - Sand events, ~1 in 8 fights: sandstorm, lion gate, Civic drive-by honk (HONDACIVIC tribute). Gooby cameo: its own 1-in-8 roll, peeks
 *   over the wall holding a No-Tail Motel key. <=1.5 s each; with reduced motion they show as one still frame.
 * - Streaks/upsets/belts for the announcer: upset = the lower-ranked pet (Pet Score rank, else lower power) wins; display-only title belt
 *   strapped on at 3 straight wins, back to the case on a loss. */
(function () {
  'use strict';
  function h32(s) { var h = 0x811c9dc5; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  var EVENTS = ['storm', 'lion', 'civic'];
  var cache = typeof WeakMap !== 'undefined' ? new WeakMap() : null, sCache = { w: null, m: null };
  function pw(p) { var s = (p && p.stats) || {}, t = 0; for (var k in s) t += +s[k] || 0; return t; }
  /** streaks(w): per fight id -> { wBefore, lBefore } from all finished fights in chain order */
  function streaks(w) { if (sCache.w === w && sCache.n === (w.fights || []).length) return sCache.m; var st = {}, m = {};
    (w.fights || []).filter(function (f) { return f.status === 'done'; }).sort(function (a, b) { return a.acceptBlock - b.acceptBlock || a.id - b.id; }).forEach(function (f) {
      var wb = st[f.winner] || 0, lb = st[f.loser] || 0; m[f.id] = { wBefore: wb, lBefore: lb }; st[f.winner] = wb + 1; st[f.loser] = 0; });
    sCache = { w: w, n: (w.fights || []).length, m: m, cur: st }; return m; }
  /** current unbeaten streak per pet id (belt holders = 3+) */
  function current(w) { streaks(w); return sCache.cur; }
  function rankOf(w, p) { var s = p && window.PetScore && PetScore.of ? PetScore.of(w, p) : null; return s ? s.rank : null; }
  /** info(w, f) -> cosmetic facts for one fight */
  function info(w, f) { if (cache && cache.has(f)) return cache.get(f); var seed = f.seed || ('fight:' + f.id), n = (f.turns || []).length || 1, S = streaks(w)[f.id] || { wBefore: 0, lBefore: 0 };
    var Wp = w.byId[f.winner], Lp = w.byId[f.loser], rw = rankOf(w, Wp), rl = rankOf(w, Lp), upset = rw != null && rl != null ? rw > rl : pw(Wp) < pw(Lp);
    var ev = h32(seed + ':XCPETS:sand') % 8 === 0 ? EVENTS[h32(seed + ':XCPETS:sand-kind') % 3] : null, gooby = h32(seed + ':XCPETS:gooby') % 8 === 0;
    var o = { ev: ev, evTurn: h32(seed + ':XCPETS:sand-at') % n, gooby: gooby, goobyTurn: (h32(seed + ':XCPETS:gooby-at') % n + (ev ? 2 : 0)) % n, goobyX: 60 + h32(seed + ':gx') % 200,
      upset: !!upset, winStreak: S.wBefore + 1, lostStreak: S.lBefore, beltOn: S.wBefore + 1 >= 3, beltNew: S.wBefore + 1 === 3, beltBack: S.lBefore >= 3, winner: Wp, loser: Lp };
    if (cache) cache.set(f, o); return o; }
  /** mood(f, ti, done) -> 0..100 */
  function mood(f, ti, done, I) { var T = f.turns || [], m = 40, miss = 0, top = Math.max.apply(null, T.map(function (q) { return q.dodge ? 0 : q.dmg || 0; }).concat([1]));
    for (var i = 0; i <= Math.min(ti, T.length - 1); i++) { var q = T[i]; if (q.dodge) { miss++; m -= 6 + (miss >= 2 ? 6 : 0); continue; } miss = 0; m += (q.crit || q.dmg >= top) ? 14 : 3;
      var tgtHp = q.by === 'a' ? q.hpB / (f.maxB || 1) : q.hpA / (f.maxA || 1); if (tgtHp > 0 && tgtHp <= 0.2) m += 18; m = Math.max(0, Math.min(100, m)); }
    if (done) m = I && I.upset ? 100 : Math.min(100, m + 10); return Math.max(0, Math.min(100, m)); }
  function px(x, c, a, b, w, h) { x.fillStyle = c; x.fillRect(a, b, w, h); }
  /** crowd(mood, t, r, k) -> vertical offset for one crowd sprite (0 sit; bob; wave) */
  function crowd(md, t, r, k, rnd) { if (md == null) return null; if (md < 25) return 0; if (md >= 80) { var ph = (Math.floor(t / 70) - k) % 40; return ph >= 0 && ph < 4 ? 3 : (Math.floor(t / 160 + rnd * 6) % 3 === 0 ? 1 : 0); } return Math.floor(t / 180 + rnd * 6) % (md >= 55 ? 2 : 4) === 0 ? (md >= 55 ? 2 : 1) : 0; }
  function meter(x, md) { var bx = 250, by = 75; px(x, '#000', bx - 1, by - 1, 64, 7); px(x, '#2a1530', bx, by, 62, 5); px(x, md >= 80 ? '#ff7a1a' : md >= 50 ? '#ffd166' : md >= 25 ? '#9fe8ff' : '#6d6788', bx, by, Math.round(62 * md / 100), 5);
    x.font = '5px "Press Start 2P", monospace'; x.textAlign = 'right'; x.fillStyle = '#000'; x.fillText(md >= 80 ? 'FIRE' : md < 25 ? 'ZZZ' : 'CROWD', bx - 3, by + 6); x.fillStyle = md >= 80 ? '#ff7a1a' : '#e8f5ec'; x.fillText(md >= 80 ? 'FIRE' : md < 25 ? 'ZZZ' : 'CROWD', bx - 4, by + 5); x.textAlign = 'left'; }
  function confetti(x, t) { for (var i = 0; i < 26; i++) { var cx = (i * 47 + Math.floor(t / 12) * (1 + i % 3)) % 320, cy = 28 + ((i * 31 + Math.floor(t / 20)) % 46); px(x, ['#ffd166', '#ff5d5d', '#3ddc84', '#9fe8ff', '#ff4fd8'][i % 5], cx, cy, 2, 2); } }
  /* sand events: k = 0..1 progress through the ~1.5 s event (reduced motion: one still frame at k = .5) */
  function storm(x, k, t) { x.fillStyle = 'rgba(201,163,107,' + (0.35 * Math.sin(Math.PI * k)).toFixed(3) + ')'; x.fillRect(0, 26, 320, 154); for (var i = 0; i < 60; i++) { var sx = (i * 53 + Math.floor(k * 900) + i * i) % 330 - 5, sy = 30 + (i * 37) % 145; px(x, i % 3 ? '#e9c98f' : '#fff1cf', sx, sy, 3, 1); } }
  function lion(x, k) { var gx = 290, gy = 52, open = Math.min(1, k * 3) * (k > 0.85 ? (1 - k) / 0.15 : 1); px(x, '#0a0812', gx, gy, 24, 26); px(x, '#6b5a8f', gx - 2, gy - 2, 28, 2); for (var b = 0; b < 4; b++) px(x, '#8a8aa0', gx + 2 + b * 6, gy - Math.round(22 * open), 2, 26);
    if (open > 0.5) { var lx = gx + 2, ly = gy + 8; px(x, '#a0522d', lx, ly, 20, 16); px(x, '#e0a040', lx + 4, ly + 4, 12, 10); px(x, '#000', lx + 6, ly + 7, 2, 2); px(x, '#000', lx + 12, ly + 7, 2, 2); px(x, '#5a1a1a', lx + 7, ly + 11, 6, 2);
      x.font = '6px "Press Start 2P", monospace'; x.fillStyle = '#000'; x.fillText('ROAR!', gx - 30, gy + 3); x.fillStyle = '#ffd166'; x.fillText('ROAR!', gx - 31, gy + 2); } }
  function civic(x, k) { var cx = Math.round(-40 + k * 400), cy = 80; px(x, '#000', cx - 1, cy + 3, 34, 9); px(x, '#c8102e', cx, cy + 4, 32, 6); px(x, '#c8102e', cx + 7, cy, 16, 5); px(x, '#9fe8ff', cx + 9, cy + 1, 5, 3); px(x, '#9fe8ff', cx + 16, cy + 1, 5, 3); px(x, '#ffd166', cx + 30, cy + 5, 2, 2); px(x, '#111', cx + 4, cy + 10, 6, 4); px(x, '#111', cx + 22, cy + 10, 6, 4);
    x.font = '5px "Press Start 2P", monospace'; x.fillStyle = '#e8f5ec'; x.fillText('CIVIC', cx + 6, cy + 9); if (k > 0.3 && k < 0.8) { x.font = '7px "Press Start 2P", monospace'; x.fillStyle = '#000'; x.fillText('HONK!', cx + 34, cy - 1); x.fillStyle = '#ffd166'; x.fillText('HONK!', cx + 33, cy - 2); } }
  function gooby(x, k, gx) { var up = Math.sin(Math.PI * Math.min(1, k)), y = 26 - Math.round(12 * up); if (up <= 0.05) return; x.save(); x.beginPath(); x.rect(0, 0, 320, 27); x.clip();
    if (window.V2Motel && V2Motel.drawGooby) { try { V2Motel.drawGooby(x, gx, y, 0); } catch (e) { } } else { px(x, '#111', gx, y, 16, 12); px(x, '#2f9e44', gx - 1, y - 6, 18, 6); px(x, '#fff', gx + 4, y + 5, 8, 5); }
    x.restore(); var kx = gx + 18, ky = 22 - Math.round(6 * up); px(x, '#000', kx - 1, ky - 1, 8, 5); px(x, '#ffd166', kx, ky, 3, 3); px(x, '#ffd166', kx + 3, ky + 1, 3, 1); px(x, '#ff4fd8', kx + 1, ky + 3, 2, 3); }
  var DUR = 1500;
  /** overlay(S, x, now, ti, done, reduced): draws mood meter + seeded events for the fight in S.f */
  function overlay(S, x, now, ti, done, red) { var f = S.f, w = S.w; if (!f || !w) return; var I = info(w, f), md = mood(f, ti, done, I); S.mood = md;
    if (I.ev) { if (red) { if (done) drawEv(x, I.ev, I.ev === 'civic' ? 0.35 : 0.5, now); } else { if (ti === I.evTurn && S.evT == null) S.evT = now; if (S.evT != null && now - S.evT < DUR) drawEv(x, I.ev, (now - S.evT) / DUR, now); } }
    if (I.gooby) { if (red) { if (done) gooby(x, 0.5, I.goobyX); } else { if (ti === I.goobyTurn && S.gbT == null) S.gbT = now; if (S.gbT != null && now - S.gbT < DUR) gooby(x, (now - S.gbT) / DUR, I.goobyX); } }
    if (md >= 80 && !red) confetti(x, now); meter(x, md); }
  function drawEv(x, ev, k, t) { if (ev === 'storm') storm(x, k, t); else if (ev === 'lion') lion(x, k); else civic(x, k); }
  /** belt(x, cx, y): a gold title belt across a 24px sprite standing at (cx, y) */
  function belt(x, cx, y) { px(x, '#000', cx - 11, y - 11, 22, 5); px(x, '#ffd166', cx - 10, y - 10, 20, 3); px(x, '#000', cx - 4, y - 12, 8, 7); px(x, '#c8102e', cx - 3, y - 11, 6, 5); px(x, '#fff6c8', cx - 1, y - 10, 2, 2); }
  /** beltCase(x, full): the trophy case beside the plinth (empty when someone holds the belt) */
  function beltCase(x, full) { var bx = 238, by = 98; px(x, '#000', bx - 1, by - 1, 26, 20); px(x, 'rgba(159,232,255,.25)', bx, by, 24, 16); px(x, '#6d6788', bx, by + 16, 24, 2); px(x, '#e8f5ec', bx + 1, by + 1, 1, 6);
    if (full) { px(x, '#ffd166', bx + 3, by + 7, 18, 3); px(x, '#c8102e', bx + 9, by + 5, 6, 6); px(x, '#fff6c8', bx + 11, by + 7, 2, 2); }
    x.font = '4px "Press Start 2P", monospace'; x.fillStyle = '#9fe8ff'; x.fillText('BELT', bx + 4, by + 22); }
  window.V2ArenaFun = { info: info, mood: mood, crowd: crowd, overlay: overlay, belt: belt, beltCase: beltCase, current: current, streaks: streaks, EVENTS: EVENTS, _h: h32 };
})();
