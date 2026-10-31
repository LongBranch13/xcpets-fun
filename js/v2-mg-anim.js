/* MYTHIC GOD LOOP animations (branch mythic-god, owner Oct 31 2026 [pt2522u] "pixel animations for every event"). DISPLAY ONLY.
 * Plugs into js/v2-cem-anim.js (same 128x80 overlay, 10 frames a second, tap to skip, plays once per wallet per tx, ?anim=<kind> preview):
 *   unleash        the chains snap, red eyes, "UNLEASHED", the meal block countdown                 (log 'unleash')
 *   mgmeal         the zombie walks to one of the owner's Mythics and eats it; it turns Mythic-fed:
 *                  a cyan moon rim, a moon over its head, "MYTHIC-FED"                               (log 'mgmeal')
 *   mgcancel       the unleash is called off: the zombie fades, the Mythic stays safe               (log 'mgcancel')
 *   mgraise        a violet grave: violet candles and stars, the Mythic zombie climbs out            ('raise' of a Mythic grave)
 *   mgrise-win     the Resurrection roll, then a gold pillar, halo, wings and the Pantheon seat      (log 'mgrise')
 *   mgrise-fail    the same roll, FAIL: dust (it can be raised again from its violet grave)          ('resurrect' of a Mythic zombie)
 * Sprites carry no text; the scene shows pixel text only. */
(function () {
  'use strict';
  var CA = window.V2CemAnim; if (!CA || !CA.extend) return;
  var K = CA.kit, C = K.C, W = K.W, H = K.H, GY = K.GY, CX = K.CX, px = K.px, text = K.text, clamp = K.clamp, rnd = K.rnd;
  var VI = '#b46cff', VI2 = '#e2c8ff', VI3 = '#5a2a9a', CY = '#27e1ff', CY2 = '#c8f6ff', CH = '#8a8e98';
  var ROMAN = 'I II III IV V VI VII VIII IX X XI XII XIII XIV XV XVI XVII XVIII XIX XX XXI'.split(' ');
  function rim(g, spr, x0, y0, col, f, every) { var a = spr.rgba; if (!a) return; for (var q = 0; q < 1024; q++) { if (!a[q * 4 + 3]) continue; var x = q % 32, y = (q / 32) | 0;
      var edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) { var X = x + d[0], Y = y + d[1]; return X < 0 || Y < 0 || X > 31 || Y > 31 || !a[(Y * 32 + X) * 4 + 3]; });
      if (edge && (!every || ((x + y + (f | 0)) % every) < every - 1)) px(g, x0 + x, y0 + y, col); } }
  function moon(g, x, y, f) { K.disc(g, x, y, 4, CY2); K.disc(g, x + 2, y - 1, 3, '#0b0a1f'); if ((f >> 1) % 3 === 0) px(g, x - 5, y - 3, '#ffffff'); }
  function chain(g, x, y, n, dir, broke, t) { for (var i = 0; i < n; i++) { var cx = x + dir * i * 5, cy = y + (i % 2); if (broke && i >= 2) { cx += dir * t * (1 + i * 0.4); cy += 0.3 * t * t - t; }
      px(g, cx, cy, C.ol, 5, 4); px(g, cx + 1, cy + 1, CH, 3, 2); px(g, cx + 2, cy + 1, '#3a3d45', 1, 2); } }
  function vtint(g, a) { g.save(); g.globalAlpha = a; px(g, 0, 0, VI3, W, GY); g.restore(); }
  function vstars(g, f, cx, cy, spread, seed) { var r = rnd((seed || 3) + (f >> 1)); for (var i = 0; i < 6; i++) { var x = cx + (r() - 0.5) * spread, y = cy + (r() - 0.5) * spread * 0.6; px(g, x, y, VI2); px(g, x - 1, y, VI); px(g, x + 1, y, VI); px(g, x, y - 1, VI); px(g, x, y + 1, VI); } }
  function wings(g, cx, y, f) { var up = (f >> 1) % 2; for (var s = -1; s <= 1; s += 2) for (var i = 0; i < 9; i++) { var h = 10 - i - (up ? 2 : 0); if (h < 1) continue; var x = cx + s * (14 + i);
      px(g, x, y + i * (up ? 0.5 : 1) - (up ? 4 : 0), i % 3 ? '#ffffff' : C.gold2, 1, h); } }
  /* unleash: chains snap off a starving zombie at its grave */
  function unleashF(g, ev, f, P) { var snap = f >= 14, sh = f >= 10 && f < 18 ? (f % 2 ? 1 : -1) : 0; K.sky(g, f, f >= 14 ? -(0.1 + 0.08 * (f % 2)) : 0); K.stone(g, 0, false); K.ground(g, sh); K.mound(g, 0, true); K.candles(g, 0.05, f);
    var spr = K.sprite(P.pet, f >= 14 ? 'feral' : 'zombie', f >> 1), x0 = CX - 16 + sh, y0 = GY - 31; K.drawSpr(g, spr, x0, y0);
    chain(g, x0 + 2, y0 + 18, 5, -1, snap, f - 14); chain(g, x0 + 26, y0 + 18, 5, 1, snap, f - 14); px(g, 6, GY - 6, '#3a3d45', 4, 6); px(g, W - 10, GY - 6, '#3a3d45', 4, 6);
    if (snap && f < 22) K.chips(g, f - 14, 41, CX, y0 + 18, 10, [CH, '#c8ccd4', '#3a3d45']);
    if (snap && f % 4 < 2) { px(g, 0, 0, C.b1, W, 2); px(g, 0, H - 2, C.b1, W, 2); px(g, 0, 0, C.b1, 2, H); px(g, W - 2, 0, C.b1, 2, H); }
    if (f >= 18) text(g, 'UNLEASHED', CX, 6, (f >> 1) % 2 ? C.b3 : C.b4, 8); if (f >= 24) text(g, 'IT EATS IN ' + Math.max(0, 6 - Math.floor((f - 24) / 3)) + ' BLOCKS', CX, 18, C.s2, 5); }
  /* mgmeal: the zombie eats one Mythic; then it shines cyan with a moon: Mythic-fed */
  function mealF(g, ev, f, P) { var M = P.victims[0] || { id: 0 }; K.sky(g, f, 0); K.ground(g, 0);
    var ms = K.sprite(M, 'live', 0), zs = K.sprite(P.pet, 'zombie', f >> 2), mx = 80, zx = clamp(8 + Math.round((f - 4) * 3), 8, 52), eat = f >= 22, fed = f >= 40;
    if (!eat) { K.drawSpr(g, ms, mx, GY - 31 + (f % 2)); K.sparkle(g, f, 9, mx + 16, GY - 18, 34); if (f >= 14) text(g, 'PICKED BY THE BLOCK HASH', CX, 4, C.gold2, 5); }
    else if (f < 34) { var k = f - 22; K.dustPet(g, ms, mx, GY - 31, k * 1.2); vstars(g, f, mx + 16, GY - 30 - k, 30, 13); K.blood(g, k, 51, mx + 8, GY - 12); if (k < 4) text(g, 'CHOMP!', mx + 16, 20, C.b4, 6); }
    else { px(g, mx + 6, GY - 2, '#6a6e7a', 20, 2); vstars(g, f, mx + 16, GY - 12, 20, 17); }
    K.drawSpr(g, zs, zx, GY - 31 + (fed ? (f >> 1) % 2 : 0)); if (fed) { rim(g, zs, zx, GY - 31 + ((f >> 1) % 2), CY, f, 4); moon(g, zx + 16, GY - 40, f); }
    if (f >= 44) text(g, 'MYTHIC-FED', CX, 6, (f >> 1) % 2 ? CY : CY2, 8); if (f >= 50) text(g, 'NEVER HUNGRY AGAIN', CX, 18, C.s2, 5); }
  /* mgcancel: called off (hunted, moved or crumbled first): the zombie fades, the Mythics stay safe */
  function cancelF(g, ev, f, P) { K.sky(g, f, 0); K.ground(g, 0); var zs = K.sprite(P.pet, 'zombie', f >> 2), fade = clamp((f - 8) / 12, 0, 1);
    if (fade < 1) K.drawSpr(g, zs, 20, GY - 31, null, 1 - fade); px(g, 70, GY - 30, '#2a2742', 44, 30);
    P.victims.slice(0, 3).forEach(function (v, i) { var x = 74 + i * 16, vs = K.sprite(v, 'live', 0); g.drawImage(vs, 0, 0, 32, 32, x, GY - 16 - ((f + i * 3) >> 2) % 2, 16, 16); if (f >= 10) K.halo(g, x + 8, GY - 18, f + i); }); /* the Mythics stay safe in the stash */
    if (f >= 10) K.sparkle(g, f, 29, 98, GY - 10, 40);
    if (f >= 16) text(g, 'CALLED OFF', CX, 6, C.gold2, 8); if (f >= 22) text(g, 'NOTHING WAS EATEN', CX, 18, C.s2, 5); }
  /* mgraise: the violet grave opens */
  function raiseF(g, ev, f, P) { K.raiseF(g, ev, f, P); vtint(g, 0.16 + (f >= 6 ? 0.06 * (f % 2) : 0)); vstars(g, f, CX, 40, 60, 23);
    px(g, CX - 6, 39, VI, 3, 3); px(g, CX + 3, 39, VI, 3, 3); if (f >= 34) { var spr = K.sprite(P.pet, 'zombie', f >> 2); rim(g, spr, CX - 16, GY - 31 + ((f >> 1) % 2), '#8f86b8', f, 3); }
    if (f >= 36) text(g, 'THE MYTHIC RISES', CX, 16, VI2, 5); }
  /* mgrise-win: the roll, then the god: gold pillar, halo, wings, its Pantheon seat */
  function riseWinF(g, ev, f, P) { var e2 = Object.assign({}, ev, { kind: 'resurrect-win' }); if (f < 60) { K.resF(g, e2, f, P); vtint(g, 0.1); return; }
    var k = f - 60, ls = K.sprite(P.pet, 'live', 0), ty = K.topY(ls), x0 = CX - 16, y0 = GY - 31; K.sky(g, f, 0); K.ground(g, 0);
    for (var by = 0; by < GY; by++) for (var bx = -12; bx < 12; bx++) if (((bx + by + (f >> 1)) & 1) === 0 || Math.abs(bx) < 4) px(g, CX + bx, by, Math.abs(bx) < 4 ? C.gold2 : C.gold);
    for (var r = 0; r < 8; r++) { var a = r / 8 * Math.PI * 2 + k * 0.08; for (var d = 18; d < 30; d += 3) px(g, CX + Math.cos(a) * d, y0 + 16 + Math.sin(a) * d * 0.7, (d + k) % 6 < 3 ? C.gold2 : C.gold); }
    wings(g, CX, y0 + 8, f); K.drawSpr(g, ls, x0, y0 + ((f >> 1) % 2)); rim(g, ls, x0, y0 + ((f >> 1) % 2), C.gold2, f, 5); K.halo(g, CX, y0 + ty - 3, f); K.sparkle(g, f, 7, CX, y0 + 14, 60);
    text(g, 'MYTHIC GOD', CX, 4, (f >> 1) % 2 ? C.gold : C.gold2, 8); if (k >= 6) text(g, 'SEAT ' + (ROMAN[(ev.seat || 1) - 1] || ev.seat) + ' OF XXI', CX, GY + 6, '#ffffff', 6); }
  function riseFailF(g, ev, f, P) { K.resF(g, Object.assign({}, ev, { kind: 'resurrect-fail' }), f, P); vtint(g, 0.1); if (f >= 62) text(g, 'IT CAN RISE AGAIN', CX, GY + 14 > H - 8 ? 34 : GY + 14, VI2, 5); }
  function cap(icon, s) { return function (ev, P, n, b) { return icon + ' ' + s(ev, P, n) + b; }; }
  CA.extend({ logKinds: ['unleash', 'mgmeal', 'mgcancel', 'mgrise'],
    kinds: {
      unleash: { len: 40, key: 30, paint: unleashF, caption: cap('🩸', function (ev, P, n) { return n + ' was UNLEASHED: it eats one of your Mythics at block ' + (ev.mealAt ? Number(ev.mealAt).toLocaleString('en-US') : 'burn + 6') + ', picked by that block\'s hash'; }) },
      mgmeal: { len: 60, key: 52, paint: mealF, caption: cap('🌙', function (ev, P, n) { var M = P.victims[0]; return n + ' ate the Mythic ' + K.nm(M, ev.victims && ev.victims[0]) + '. It is Mythic-fed and never hungers again; the Mythic rests in a violet grave'; }) },
      mgcancel: { len: 34, key: 28, paint: cancelF, caption: cap('🛡️', function (ev, P, n) { return 'The unleash of ' + n + ' was called off. Nothing was eaten'; }) },
      mgraise: { len: 46, key: 40, paint: raiseF, caption: cap('💜', function (ev, P, n) { return n + ' rose from its violet grave as a Mythic zombie'; }) },
      'mgrise-win': { len: 90, key: 82, paint: riseWinF, caption: cap('🌕', function (ev, P, n) { return n + ' rose as a MYTHIC GOD: seat ' + (ROMAN[(ev.seat || 1) - 1] || ev.seat) + ' of 21 in the Pantheon. Rolled ' + ev.roll + ', needed under ' + ev.need; }) },
      'mgrise-fail': { len: 72, key: 66, paint: riseFailF, caption: cap('🪦', function (ev, P, n) { return n + ': the Mythic Resurrection failed. Rolled ' + ev.roll + ', needed under ' + ev.need + '. Its violet grave can be raised again'; }) } },
    from: function (w, l, ME, kit) { var p = w.byId[l.petId], m, z;
      if (l.kind === 'unleash') { m = /at block (\d+)/.exec(l.msg || ''); return p && p.owner === ME ? { kind: 'unleash', id: l.petId, mealAt: m ? +m[1] : null, block: l.block, tx: l.tx, key: 'unleash:' + l.tx } : null; }
      if (l.kind === 'mgmeal') { var Mp = w.byId[l.mythic]; return (p && (p.owner === ME || (p.zombie && p.zombie.prevOwner === ME))) || (Mp && ((Mp.mgDead && Mp.mgDead.owner === ME) || Mp.owner === ME)) ? { kind: 'mgmeal', id: l.petId, victims: [l.mythic], block: l.block, tx: l.tx, key: 'mgmeal:' + l.tx + ':' + l.mythic } : null; }
      if (l.kind === 'mgcancel') { var U = w.cem && w.cem.mg && (w.cem.mg.unleash || []).filter(function (u) { return u.tx === l.tx; })[0]; return (U && U.src === ME) || (p && p.owner === ME) ? { kind: 'mgcancel', id: l.petId, victims: ((U && U.pool) || []).slice(0, 3), block: l.block, tx: l.tx, key: 'mgcancel:' + l.tx } : null; }
      if (l.kind === 'mgrise') { m = /roll (\d+), needed under (\d+)/.exec(l.msg || ''); return p && p.owner === ME ? { kind: 'mgrise-win', id: l.petId, seat: l.seat || (p.mythicGod && p.mythicGod.seat) || 1, roll: m ? +m[1] : 0, need: m ? +m[2] : 0, block: l.block, tx: l.tx, key: 'mgrise:' + l.tx } : null; }
      if (!p || !p.mgDead) return undefined; /* not a Mythic grave or zombie: the cemetery's own animations */
      if (l.kind === 'raise') { z = kit.zrec(p, l.tx); return kit.mine(p, z, ME) ? { kind: 'mgraise', id: l.petId, block: l.block, tx: l.tx, key: 'raise:' + l.tx } : null; }
      if (l.kind === 'resurrect' && !/ALIVE again/.test(l.msg || '')) { z = kit.zrec(p); m = /roll (\d+), needed under (\d+)/.exec(l.msg || ''); if (!m) return null;
        return kit.mine(p, z, ME) ? { kind: 'mgrise-fail', id: l.petId, roll: +m[1], need: +m[2], block: l.block, tx: l.tx, key: 'res:' + l.tx } : null; }
      return undefined; } });
})();
