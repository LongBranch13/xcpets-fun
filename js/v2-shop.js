/* XCPETS shop "The XCPETS Lair of Locks, Leverage, Layers, Luster, Looks, and Leathers" (owner's final name 8:01 PM CT; Captain Dan is the shopkeeper character, not in the name) (UI-only mockup, owner 7:18 PM CT; branch pet-shop, NOT LIVE). No rule change, no new burns.
 * An 8-bit cartoon-Roman shop floor on top of the existing Pet Shop: Captain Dan (an affectionate 8-bit caricature of the creator of XCP.fun, Bitcorn Crops, bitcorns.com and DigiRare.io)
 * waves from behind the counter when approached; your owned gear sits on the shelves (real item icons). Tap a shelf item -> the existing racks below jump to
 * that slot (same gear actions as before: pick a pet, tap a slot, equip/unequip). prefers-reduced-motion: static scene. */
(function () {
  'use strict';
  var W = 320, H = 150, RM = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  /* Captain Dan's lines (owner 7:36/7:37 PM CT): affectionate, farm/Bitcorn/Bitcoin humor; facts used: creator of XCP.fun, Bitcorn Crops, bitcorns.com, DigiRare.io. No other bio. */
  var LINES = ['gm from the farm!', 'Fresh off the field!', 'Harvest\u2019s in, matey', 'Gear grows like Bitcorn', 'Plant a roll, reap gear', 'Bitcorn Crops taught me well',
    'XCP.fun built this barn', 'Hand-picked at dawn', 'Every piece, homegrown', 'bitcorns.com sends love', 'DigiRare.com says hi!', 'Rare as a DigiRare', 'Good soil, good drops',
    'Stash full like silos', 'Tap a crop, kit a pet', 'Ripe for the wearing!', 'Stack sats, stack corn', 'HODL the harvest', 'Ahoy from the cornfield!', 'Fresh harvest, fair deal',
    /* 28 lines approved by the owner Mon Oct 19 2026 (previews/pet-shop/dan-lines-final.md) */
    'Ahoy! THIS! IS! BITCORN!', 'Only 100 CROPS. Sail careful, matey', 'BITCORN can\'t be bought. Only farmed!', '21M BITCORN, just like the big coin', 'Harvest #1 hit April Fools 2018. Legit', 'Land ho! A HELIPAD on the farm', 'Docked the boat at YACHTDOCK',
    'LAMBOGARAGE? I came by ship', 'CORNPARTY on deck, all hands!', 'THESCARECROW guards my stash', 'FARMHAND wanted. Pay: corn', 'CORNCOMBINE: 364 cards to swab', 'Every farm\'s a Bitcoin address', 'Join a coop, me hearties!',
    'Captain of the Bitcorn fleet, gm', 'Memecoins? Try XCP.fun, sailor', 'XCP.fun: 69 crew to set sail', 'On XCP.fun, no admin key aboard', 'Grails ahoy on DigiRare.com!', 'Card hunting? DigiRare.com, matey', 'Spells of Genesis sailed first',
    'HOMERPEPE: 1 of 1. Arr!', 'Burn a FAKEASF, speak your fake', 'Rare Pepes, Fake Rares, all Bitcoin', 'Counterparty? I AM the party', 'Not your keys, not your corn', 'Batten the hatches, harvest\'s in!', 'Swab the deck, stack the sats'];
  var S = { c: null, x: null, items: [], icons: {}, raf: 0, hits: [], line: 0 };
  /* Dank Rare Agency lines (owner Oct 19 2026, 10:28 PM CT); facts from dankdirectory.io Series 1 (KEKLUMINATI = Card 1, DANKMEMECASH = Card 2, OCTOKEK, PEEPOHEY). Shown every 12th line only. */
  var DANK = ['Card 1 of the Danks? KEKLUMINATI', 'KEKLUMINATI sees all, matey', 'dankdirectory.io: dankest danks!', 'DANKMEMECASH, card 2. Arr!', 'PEEPOHEY waves from Series 1', 'OCTOKEK: eight arms, one kek', 'Dank Rare Agency reporting in!'];
  function lineAt(n) { return n % 12 === 11 ? DANK[Math.floor(n / 12) % DANK.length] : LINES[n % LINES.length]; }

  function reduced() { return !!RM.matches || !!window.__shopReduced; }
  function px(x, c, a, b, w, h) { x.fillStyle = c; x.fillRect(a, b, w, h); }
  /* Captain Dan, traced from the CAPTAINDAN token art (xcp.fun/full/CAPTAINDAN, 226 px pixel art) downsampled to 32x32 with the token's own colours; '.' = transparent. Faces left like the token. */
  var DAN_PAL = {'b': '#064884', 'g': '#ffcb4d', 'h': '#c6846f', 'k': '#141618', 'l': '#9fa2a3', 'o': '#d79b37', 'w': '#e6e9ef'}, DAN_MAP = [
    '................................',
    '........lwwwwwww................',
    '.......wwwwwwwwwwww.............',
    '......wwwwkkkwwwwwwwww..........',
    '.....wwwwkkokkwwwwwwwww.........',
    '......wwwkkkkkwwwwwwwwwww.......',
    '......wwwkoookkwwwwwwwwwwww.....',
    '.......wkkkokkkkkkkwwwwwwwww....',
    '.......oooooogkkkkkkkwwwwwww....',
    '......kkkkkkkkkkoookkkkkwwww....',
    '.....kkkkkkkkkkkkkkkgokkkwww....',
    '.....kkkkkkkkkkkkkkkkkokkw......',
    '.......kkhhhhhhhhhhkkkkkk.......',
    '.........hhhhhhhhhhkkkkkk.......',
    '......llllhhllllhhhkkkkkk.......',
    '......lhhlhhlhhlhhhkkkkkk.......',
    '..........hhhhhhhhhhhhkk........',
    '........hhhhhhhhhhhhhhkk........',
    '........hhhhhhhhhhhhhhkk........',
    '.........kkkhhhhhhhhhhkk........',
    '.........kkkkhhhhhhkhhh.........',
    '.........hhkkhhhhhhkhhh.........',
    '.........hhhhhhhhhkkhhh.........',
    '.........kkkkkkkkkkkhhw.........',
    '.........kkkkkkkkkkhhwwk........',
    '..........kkkkkkkkhwwwkkkk......',
    '..........kkwkbkwwwwwkkkkkk.....',
    '.......ookkkwbbbwwwwkkkkkkooo...',
    '......ookkkkwbbbwwwkkkkkkkkooo..',
    '.....kkkkkkkwbbbwwkkkkokkkkkkkk.',
    '.....kkkkkkkwbbbwwkkkkkkkkkkkkk.',
    '.....kkkkkkkwbbbwwkkkkkkkkkkkkk.'];
  function dan(x, ox, oy, t) { var blink = !reduced() && Math.floor(t / 2200) % 6 === 0;
    for (var r = 0; r < 32; r++) for (var q = 0; q < 32; q++) { var ch = DAN_MAP[r][q]; if (ch !== '.') px(x, DAN_PAL[ch], ox + q, oy + r, 1, 1); }
    px(x, blink ? DAN_PAL.l : '#e8eef4', ox + 7, oy + 15, 1, 1); px(x, blink ? DAN_PAL.l : '#e8eef4', ox + 13, oy + 15, 1, 1); /* lens glints on the left (gaze left); blink */
    px(x, '#c6846f', ox + 5, oy + 30, 2, 2); /* left hand resting */
    var wf = waving(t) ? Math.floor((S.waveUntil - t) / 300) % 2 : -1; /* triggered wave: raise, wave a few times, lower back to rest */
    if (wf < 0) px(x, '#c6846f', ox + 28, oy + 30, 2, 2); /* right hand resting at his side, mirrors the left */
    else if (wf) { px(x, '#141618', ox + 29, oy + 18, 3, 10); px(x, '#c6846f', ox + 29, oy + 15, 3, 3); } else { px(x, '#141618', ox + 29, oy + 21, 3, 7); px(x, '#c6846f', ox + 31, oy + 18, 3, 3); } }
  /* Dan waves only when triggered (hover/tap on him, opening the counter, the shop scrolling into view, or V2Shop.wave() when he moves); never with prefers-reduced-motion */
  var DAN = { x: 236, y: 106, w: 34, h: 32 }; /* Rare Room: Dan stands by his door */
  function waving(t) { return !reduced() && t < (S.waveUntil || 0); }
  function waveNow() { if (reduced()) return; var n = performance.now(); if (n < (S.waveUntil || 0) - 300) return; S.waveUntil = n + 1800; }
  function onDan(c, e) { var r = c.getBoundingClientRect(), mx = (e.clientX - r.left) * W / r.width, my = (e.clientY - r.top) * H / r.height; return mx >= DAN.x && mx < DAN.x + DAN.w && my >= DAN.y && my < DAN.y + DAN.h; }
  function bubble(x, s, bx, by) { x.font = '6px "Press Start 2P", monospace'; var w = Math.ceil(x.measureText(s).width) + 8; bx = Math.round(Math.max(2, Math.min(W - w - 2, bx - w / 2))); by = Math.round(by); /* scene-sharp: integer coords */
    px(x, '#000', bx + 1, by + 1, w, 12); px(x, '#fff8e1', bx, by, w, 12); px(x, '#fff8e1', bx + w / 2 - 2, by + 12, 4, 3); x.fillStyle = '#1b1b1b'; x.fillText(s, bx + 4, by + 9); }
  /* THE RARE ROOM (owner Oct 21 2026, palette A 'Royal Vault'; design/rare-room.md): the gear place is a legendary vault-gallery. Display only:
   * the same stash pieces (S.items, same hits, same tap/hover/double-tap), the same Captain Dan (lines, wave, mood) and the same counter text.
   * Rarity frames keep the site colours (common #9aa3b5, uncommon #4fd18b, rare #4f9dff, legendary #ffc93c); rare + legendary get holo + sparkles. */
  var RR = { wall: '#2a0f4a', wall2: '#3b1766', velvet: '#9b1035', velvetHi: '#d0284f', velvetLo: '#5a0820', gold: '#e8b84a', goldHi: '#fff1a8', goldLo: '#8a5a12', teal: '#1fb5a5', emerald: '#0f6b55', floorA: '#efe8f6', floorB: '#1c0f33', vein: '#c9b8e0', sky: '#8fe3ff', jewel: ['#d0284f', '#1fb5a5', '#e8b84a', '#7b3fe4', '#2f6fe0'] };
  var TIER_COL = ['#9aa3b5', '#4fd18b', '#4f9dff', '#ffc93c'];
  function tierOfG(g) { var V = window.V2Rules, it = V && (V.GEAR_BY_ID || {})[g.item]; return g.tier != null ? g.tier : it ? it.tier || 0 : 0; }
  function gild(x, a, b, w, h) { px(x, '#000', a - 2, b - 2, w + 4, h + 4); px(x, RR.goldLo, a - 1, b - 1, w + 2, h + 2); px(x, RR.gold, a - 1, b - 1, w + 1, h + 1); px(x, RR.goldHi, a - 1, b - 1, w + 1, 1); }
  function frameCard(x, it, ix, iy, lift, t) { var tr = tierOfG(it), tc = TIER_COL[tr] || TIER_COL[0], y = iy - lift; gild(x, ix - 1, y - 1, 18, 20); px(x, tc, ix - 1, y - 1, 18, 20); px(x, '#1c0f33', ix, y, 16, 16); px(x, tc, ix, y + 16, 16, 2);
    if (tr >= 2) { var ph = reduced() ? 0 : Math.floor(t / 120) % 24; for (var i = 0; i < 3; i++) { var hx = ((ph + i * 8) % 24) - 4; if (hx >= 0 && hx < 16) px(x, tr === 3 ? 'rgba(255,241,168,.30)' : 'rgba(191,227,255,.28)', ix + hx, y, 2, 16); } }
    var ic = S.icons[it.item]; if (ic) x.drawImage(ic, ix, y, 16, 16);
    if (tr >= 2 && (reduced() || Math.floor(t / 500 + ix) % 3 !== 0)) { var sc = tr === 3 ? RR.goldHi : '#ffffff'; px(x, sc, ix + 14, y - 3, 1, 3); px(x, sc, ix + 13, y - 2, 3, 1); } }
  function plate(x, s, cx, y, sz) { x.font = sz + 'px "Press Start 2P", monospace'; var tw = Math.ceil(x.measureText(s).width); px(x, '#000', Math.round(cx - tw / 2) - 2, y - sz - 1, tw + 4, sz + 3); px(x, RR.velvetLo, Math.round(cx - tw / 2) - 1, y - sz, tw + 2, sz + 1); x.textAlign = 'center'; x.fillStyle = RR.goldHi; x.fillText(s, cx, y); x.textAlign = 'left'; }
  function roomBg(x, t) { var i, j;
    px(x, RR.wall, 0, 0, W, 96); for (i = 0; i < W; i += 12) for (j = 12; j < 90; j += 14) { px(x, RR.wall2, i + 5, j, 2, 6); px(x, RR.wall2, i + 3, j + 2, 6, 2); }
    px(x, '#000', 0, 0, W, 4); px(x, RR.goldLo, 0, 0, W, 3); px(x, RR.gold, 0, 0, W, 2); px(x, RR.velvet, 0, 3, W, 1); /* gold-leaf cornice */
    [100, 214].forEach(function (cx) { px(x, '#000', cx - 1, 4, 8, 92); px(x, RR.floorA, cx, 4, 6, 92); px(x, RR.vein, cx + 2, 4, 1, 92); px(x, RR.gold, cx - 2, 4, 10, 3); px(x, RR.gold, cx - 2, 90, 10, 3); });
    for (i = 0; i < 6; i++) { px(x, i % 3 < 2 ? RR.velvet : RR.velvetHi, i, 4, 1, 70 - i * 4); px(x, i % 3 < 2 ? RR.velvet : RR.velvetHi, W - 1 - i, 4, 1, 70 - i * 4); } /* curtains */
    /* stained-glass rose window with a Rare Pepe in the roundel */
    var cx = 160, cy = 23, R0 = 18; x.fillStyle = '#000'; x.beginPath(); x.arc(cx, cy, R0 + 2, 0, 7); x.fill(); x.fillStyle = RR.gold; x.beginPath(); x.arc(cx, cy, R0 + 1, 0, 7); x.fill();
    for (i = 0; i < 12; i++) { x.fillStyle = RR.jewel[i % 5]; x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, R0, i * Math.PI / 6, (i + 1) * Math.PI / 6); x.fill(); }
    x.fillStyle = '#000'; x.beginPath(); x.arc(cx, cy, 11, 0, 7); x.fill(); x.fillStyle = '#bfe9d6'; x.beginPath(); x.arc(cx, cy, 10, 0, 7); x.fill(); if (S.pepe) x.drawImage(S.pepe, cx - 10, cy - 11, 20, 20);
    x.fillStyle = 'rgba(255,240,180,.08)'; x.beginPath(); x.moveTo(cx - 14, cy + 14); x.lineTo(cx - 36, 96); x.lineTo(cx + 36, 96); x.lineTo(cx + 14, cy + 14); x.fill();
    px(x, '#000', 118, 43, 84, 11); px(x, RR.velvet, 119, 44, 82, 9); px(x, RR.velvetHi, 119, 44, 82, 1); x.font = '6px "Press Start 2P", monospace'; x.textAlign = 'center'; x.fillStyle = RR.goldHi; x.fillText('THE RARE ROOM', 160, 51); x.textAlign = 'left';
    px(x, '#000', 0, 92, W, 5); px(x, RR.velvetLo, 0, 93, W, 3); px(x, RR.gold, 0, 92, W, 1); /* wainscot */
    for (j = 96, i = 0; j < H; j += 8, i++) for (var k2 = 0; k2 < W; k2 += 16) px(x, ((k2 / 16 + i) % 2) ? RR.floorA : RR.floorB, k2, j, 16, 8); /* marble checkerboard */
    px(x, 'rgba(0,0,0,.25)', 0, 96, W, 3);
    /* try-on mirror on a dais, showing the pet you are dressing */
    px(x, '#000', 138, 98, 44, 7); px(x, RR.floorA, 139, 99, 42, 5); px(x, RR.gold, 139, 98, 42, 1);
    gild(x, 147, 59, 26, 38); px(x, RR.sky, 147, 59, 26, 38); px(x, '#d8f6ff', 149, 61, 2, 26); if (S.mirror) x.drawImage(S.mirror, 144, 64, 32, 32);
    /* SOON objects (design only, nothing to buy): Can-o-Rare + Gear-o-Matic vending machines and Dan's sale rack */
    [[8, RR.velvet, 'CAN-O-RARE'], [38, RR.emerald, 'GEAR-O-MATIC']].forEach(function (m) { var a = m[0], b = 102; px(x, '#000', a - 1, b - 1, 24, 34); px(x, m[1], a, b, 22, 32); px(x, RR.gold, a, b, 22, 2); px(x, '#bfe9ff', a + 3, b + 5, 11, 16); px(x, '#4fd18b', a + 5, b + 7, 7, 3); px(x, '#4f9dff', a + 5, b + 12, 7, 3); px(x, '#ffc93c', a + 5, b + 17, 7, 3); px(x, RR.goldHi, a + 16, b + 7, 3, 10); px(x, '#111', a + 3, b + 25, 16, 4); });
    plate(x, 'SOON', 19, 100, 4); plate(x, 'SOON', 49, 100, 4);
    px(x, RR.gold, 196, 106, 30, 2); px(x, RR.gold, 197, 106, 2, 24); px(x, RR.gold, 223, 106, 2, 24); px(x, RR.velvet, 201, 118, 20, 7); x.font = '4px "Press Start 2P", monospace'; x.fillStyle = '#fff'; x.textAlign = 'center'; x.fillText('SALE', 211, 124); x.textAlign = 'left'; plate(x, 'SOON', 211, 138, 4);
    /* Dan's Door (arched velvet door behind Captain Dan) */
    px(x, '#000', 270, 60, 40, 37); x.fillStyle = '#000'; x.beginPath(); x.arc(290, 61, 20, Math.PI, 0); x.fill(); x.fillStyle = RR.gold; x.beginPath(); x.arc(290, 61, 19, Math.PI, 0); x.fill(); x.fillStyle = RR.velvetLo; x.beginPath(); x.arc(290, 61, 16, Math.PI, 0); x.fill();
    px(x, RR.gold, 271, 61, 38, 36); px(x, RR.velvetLo, 274, 61, 32, 36); px(x, RR.velvet, 276, 62, 13, 34); px(x, RR.velvet, 291, 62, 13, 34); px(x, RR.goldHi, 287, 78, 2, 3); px(x, RR.goldHi, 291, 78, 2, 3); plate(x, "DAN'S DOOR", 290, 58, 4);
    [[60, 8], [250, 10], [128, 40], [192, 38]].forEach(function (q, n) { if (!reduced() && Math.floor(t / 700 + n) % 3 === 0) return; px(x, RR.goldHi, q[0], q[1] - 1, 1, 3); px(x, RR.goldHi, q[0] - 1, q[1], 3, 1); }); }
  function draw(t) { var x = S.x; if (!x) return; if (window.V2Sharp) V2Sharp.begin(x, S.k); else x.imageSmoothingEnabled = false; /* scene-sharp: logical units at k x */
    roomBg(x, t);
    S.hits = []; var walls = [[8, 14], [8, 52], [222, 14], [222, 52]], k = 0; /* 4 gallery walls x 5 framed cards = the same 20 stash pieces as the old shelves */
    walls.forEach(function (s) { for (var i = 0; i < 5; i++) { var it = S.items[k++], ix = s[0] + 2 + i * 18, iy = s[1]; if (!it) continue; var sel = S.sel && S.sel.gid === it.gid, hov = S.hov && S.hov.gid === it.gid, lift = sel || hov ? (reduced() ? 3 : 3 + (Math.floor(t / 200) % 2)) : 0;
        if (!reduced() && !lift) { x.fillStyle = 'rgba(255,236,170,.07)'; x.fillRect(ix - 2, iy - 6, 20, 30); } /* spotlight */
        frameCard(x, it, ix, iy, lift, t);
        if (it.on != null) { px(x, '#000', ix + 11, iy + 12 - lift, 6, 6); px(x, '#3ddc84', ix + 12, iy + 13 - lift, 4, 4); } /* worn = green dot (the old EQP tag) */
        if (sel) { x.strokeStyle = RR.goldHi; x.lineWidth = 1; x.strokeRect(ix - 3.5, iy - lift - 3.5, 23, 25); }
        S.hits.push({ x: ix - 1, y: iy - 4, w: 18, h: 26, it: it }); } });
    if (!S.items.length) plate(x, 'EMPTY WALLS: ROLL AT DAN\u2019S DOOR', 160, 76, 5);
    if (S.more > 0) plate(x, '+' + S.more + ' MORE', 290, 46, 5);
    dan(x, DAN.x, DAN.y, t); mood(x, t);
    plate(x, 'YOUR GEAR: ' + S.total + ' PIECES \u00b7 ' + S.free + ' UNWORN', 128, 149, 5);
    bubble(x, S.say || lineAt(S.line), 253, 88);
    if (!reduced() && !S.off) S.raf = requestAnimationFrame(function (n) { if (n - (S.lt || 0) > 3200) { S.lt = n; S.line++; S.say = null; } draw(n); }); else S.raf = 0; }
  function render(w) { var U = window.V2UI, R = window.V2Render, box = document.getElementById('shopScene'); if (!box || !U || !R || !w) return;
    var ME = U.ME, items = (w.itemList || []).filter(function (g) { return g.owner === ME; }).sort(function (a, b) { return (b.tier || 0) - (a.tier || 0) || (String(a.gid) < String(b.gid) ? -1 : 1); });
    S.total = items.length; S.free = items.filter(function (g) { return g.on == null; }).length; var SL = (window.V2LairQoL ? V2LairQoL.apply(items) : items.filter(function (g) { return g.on == null; }).concat(items.filter(function (g) { return g.on != null; }))); S.items = SL.slice(0, 20); S.more = Math.max(0, SL.length - 20); /* tonight bundle: Lair chip strip narrows/sorts the shelves */
    S.items.forEach(function (g) { if (!S.icons[g.item]) try { S.icons[g.item] = R.iconCanvas(g.item); } catch (e) { } });
    var c = box.querySelector('canvas'); if (!c) { box.innerHTML = '<canvas width="' + W + '" height="' + H + '" role="img" aria-label="The Rare Room: your gear framed on the gallery walls, the try-on mirror, and Captain Dan at his door"></canvas><div class="shop-hint small">👇 Your gear hangs on these walls · tap a card to try it on</div>'; c = box.querySelector('canvas');
      if (window.IntersectionObserver) { new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) waveNow(); }); }, { threshold: 0.5 }).observe(c);
        new IntersectionObserver(function (es) { var off = !es[0].isIntersecting; if (off === S.off) return; S.off = off; if (!off && !S.raf) draw(performance.now()); else if (off) { cancelAnimationFrame(S.raf); S.raf = 0; } }, { threshold: 0 }).observe(c); } /* lair speed (owner Oct 20 2026): no redraw loop while the scene is off screen */
      c.addEventListener('mousemove', function (e) { if (onDan(c, e)) waveNow(); var h = hitAt(c, e); var g = h ? h.it : null; if ((g && g.gid) !== (S.hov && S.hov.gid)) { S.hov = g; if (g) say(g); if (reduced()) draw(performance.now()); } });
      c.addEventListener('dblclick', function () { var wb = document.getElementById('scWear'); if (wb && !wb.disabled) wb.click(); }); /* quick wins: double-tap a shelf piece to wear it (same free equip op) */
      c.addEventListener('mouseleave', function () { S.hov = null; if (reduced()) draw(performance.now()); });
      c.addEventListener('click', function (e) { var r = c.getBoundingClientRect(), mx = (e.clientX - r.left) * W / r.width, my = (e.clientY - r.top) * H / r.height;
        var h = S.hits.filter(function (q) { return mx >= q.x && mx < q.x + q.w && my >= q.y && my < q.y + q.h; })[0]; if (onDan(c, e)) waveNow(); if (!h) return; waveNow();
        S.sel = h.it; say(h.it); mirrorPet(window.V2UI.world()); counter(); draw(performance.now()); if (window.V2LairQoL) V2LairQoL.viewed(h.it); }); }
    var mo = box.querySelector('.shop-more'); if (S.more > 0) { if (!mo) { box.insertAdjacentHTML('beforeend', '<a href="#" class="shop-more small"></a>'); mo = box.querySelector('.shop-more'); mo.onclick = function (e) { e.preventDefault(); var d = document.querySelector('details.shop-all'); if (d) { d.open = true; d.scrollIntoView({ block: 'start' }); } }; } mo.textContent = '+' + S.more + ' more in your stash: see them all ▸'; } else if (mo) mo.remove();
    mirrorPet(w); counter(); clearance(w); if (window.V2LairQoL) V2LairQoL.mount(w);
    S.c = c; S.x = c.getContext('2d'); cancelAnimationFrame(S.fitRaf); S.fitRaf = requestAnimationFrame(function () { S.fitRaf = 0; fitDraw(c); }); } /* lair-perf: measure + first draw on the next frame, so a render never forces a full-page layout */
  /* Rare Room mirror: the pet you are dressing (S.pet / roll pet / first living pet), wearing the tapped piece as a live try-on (same framesWith as the Wear panel) */
  function toCv(fr) { if (!fr || !fr[0]) return null; var c = document.createElement('canvas'); c.width = 32; c.height = 32; try { c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(fr[0].data), 32, 32), 0, 0); } catch (e) { return null; } return c; }
  function mirrorPet(w) { var U = window.V2UI, V = window.V2Rules, R = window.V2Render; if (!U || !V || !R) return; var pets = U.mine(w).filter(function (p) { return !p.dead && !p.released; }), P = w.byId[S.pet != null ? S.pet : S.rollPet] || pets[0];
    if (!S.pepe) { var pp = (w.pets || []).filter(function (q) { return q.species === 'pepe' && q.stage >= 3; })[0]; if (pp) try { S.pepe = toCv(R.framesWith(Object.assign({}, pp.art, { background: 'solid', bgColor: '#bfe9d6', pattern: 'none' }), pp.stage, [], [])); } catch (e) { } }
    if (!P) { S.mirror = null; return; } var worn = V.wornOf(w, P.id), ids = worn.map(function (x) { return x.item; }), g = S.sel;
    if (g && g.item) { var it = (V.GEAR_BY_ID || {})[g.item] || g, sl = it.slot || g.slot; if ((P.openSlots || []).indexOf(sl) >= 0 || (V.slotOpen && V.slotOpen(P, sl))) ids = worn.filter(function (x) { return x.slot !== sl; }).map(function (x) { return x.item; }).concat([g.item]); }
    var key = P.id + ':' + ids.join(','); if (S.mirrorKey === key) return; S.mirrorKey = key;
    try { S.mirror = toCv(R.framesWith(Object.assign({}, P.art, { background: 'solid', bgColor: RR.sky, pattern: 'none' }), P.stage, ids, P.blackEye ? ['v2-black-eye'] : [])); } catch (e) { S.mirror = null; } }
  function fitDraw(c) { if (window.V2Sharp) { S.k = V2Sharp.fit(c, W, H); if (!S.rs) { S.rs = 1; V2Sharp.watch(function () { if (!S.c) return; var k0 = S.k; S.k = V2Sharp.fit(S.c, W, H); if (S.k !== k0 && !S.raf) draw(performance.now()); }); } } cancelAnimationFrame(S.raf); draw(performance.now()); }
  /* CLEARANCE RACK (PREVIEW, NOT ACTIVE; owner idea, rules undecided): 4 pieces that rotate once per 144-block chain day, picked from the
   * existing gear catalog (no signature/legendary-exclusive or retired pieces) by sha256(first-block-of-the-day hash + ':clearance:' + i).
   * Display only: no price, no button that burns, nothing changes in the replay. */
  function rackPick(V, G, hash, n) { var pool = (G.ITEMS || []).filter(function (it) { return !it.exclusive && !it.legendary && !(G.RETIRED && G.RETIRED[it.id]) && !(G.REMOVED && G.REMOVED[it.id]) && !it.alias; }), out = [], seen = {};
    for (var i = 0; out.length < n && i < 64 && pool.length; i++) { var h = V.sha(hash + ':clearance:' + i), it = pool[parseInt(h.slice(0, 8), 16) % pool.length]; if (!seen[it.id]) { seen[it.id] = 1; out.push(it); } } return out; }
  function clearance(w) { var el = document.getElementById('shopClearance'), U = window.V2UI, V = window.V2Rules, G = window.V2Gear, R = window.V2Render; if (!el || el.hidden || !U || !V || !G) return;
    var st = U.S ? U.S() : {}, tip = st.tip || w.tip || 0, d = V.day(tip), b0 = d * V.BLOCKS_PER_DAY, H = st.hashes || {}, hb = null;
    for (var b = b0; b <= tip; b++) if (H[b]) { hb = b; break; }
    if (hb == null) { el.innerHTML = '<div class="cr"><b class="cr-h">🏷️ CLEARANCE RACK</b> <span class="cr-pv">Preview, not active</span><div class="cr-none">Restocks when block ' + b0 + '’s hash is in</div></div>'; return; }
    var L = rackPick(V, G, H[hb], 4), T = ['Common', 'Uncommon', 'Rare', 'Legendary'], left = b0 + V.BLOCKS_PER_DAY - tip;
    el.innerHTML = '<div class="cr"><div class="cr-top"><b class="cr-h">🏷️ CLEARANCE RACK</b> <span class="cr-pv">Preview, not active</span></div>' +
      '<div class="cr-row">' + L.map(function (it) { var src = ''; try { src = R.iconCanvas(it.id).toDataURL(); } catch (e) { } return '<div class="cr-it t' + it.tier + '"><span class="cr-tag">SALE</span>' + (src ? '<img alt="" src="' + src + '">' : '') + '<b>' + esc(it.label) + '</b><small>' + esc(lword(it.slot) + ' · ' + (T[it.tier] || '')) + '</small><button type="button" class="q" disabled>Price TBD</button></div>'; }).join('') + '</div>' +
      '<div class="cr-hint small">New rack in ' + left + ' blocks · picked from block ' + hb + '’s hash</div><details class="small muted"><summary>How the rack is picked</summary>Each chain day (144 blocks) the hash of the day’s first block picks 4 pieces from the gear catalog (no signature pieces). Anyone can check it. Buying isn’t wired: prices and rules are still the owner’s call.</details></div>'; }
  var LW = { Headwear: 'Locks', Grip: 'Leverage', Outfits: 'Layers', Drip: 'Luster', Guise: 'Looks', Footwear: 'Leathers' };
  function lword(sl) { var V = window.V2Rules, l = V && V.slotLabel ? V.slotLabel(sl) : sl; return LW[l] ? LW[l] + ' \u00b7 ' + l : l; }
  function hitAt(c, e) { var r = c.getBoundingClientRect(), mx = (e.clientX - r.left) * W / r.width, my = (e.clientY - r.top) * H / r.height; return S.hits.filter(function (q) { return mx >= q.x && mx < q.x + q.w && my >= q.y && my < q.y + q.h; })[0]; }
  function say(g) { S.lt = performance.now(); S.say = g.on != null ? 'On #' + g.on + '. Swap it?' : String(g.label || 'This one').slice(0, 18) + '? Fresh crop!'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function dmg(itemId) { var V = window.V2Rules, it = V && (V.GEAR_BY_ID || {})[itemId]; return it ? 1 + 2 * (it.tier || 0) : 0; }
  /* the counter: in place under the shelves (no pop-up). Pick a pet chip -> gear-damage delta vs what it wears in that slot -> Wear / Take off / Roll. */
  function counter() { var U = window.V2UI, V = window.V2Rules, R = window.V2Render, el = document.getElementById('shopCounter'); if (!el || !U) return; var w = U.world(), ME = U.ME, g = S.sel; mirrorPet(w);
    var pets = U.mine(w).filter(function (p) { return !p.dead; });
    if (!g) { var oS = document.querySelector('#shopScene .sc-sign'); if (oS) oS.remove(); var HP = w.byId[S.pet != null ? S.pet : S.rollPet] || pets[0]; el.innerHTML = (HP ? stepPet(HP, false) + '<div class="sc-pets" id="scPetPick"></div>' + hero(w, HP) + bestBar() : '') + stepGear(w) + rollRow(w, pets) + gallery(w); if (HP) paintHero(el, w, HP); petPick(HP); bindRoll(el); rrBind(el); return; }
    g = w.items[g.gid] || g; S.sel = g; var it = (V.GEAR_BY_ID || {})[g.item] || g, sl = it.slot || g.slot;
    var fit = pets.filter(function (p) { return (p.openSlots || []).indexOf(sl) >= 0; }); if (S.pet == null && S.rollPet != null && fit.some(function (p) { return p.id === S.rollPet; })) S.pet = S.rollPet; /* gear-clarity: keep the pet on show */
    if (S.pet == null || !fit.some(function (p) { return p.id === S.pet; })) S.pet = g.on != null ? g.on : fit[0] && fit[0].id;
    var P = w.byId[S.pet], cur = P ? V.wornOf(w, P.id).filter(function (x) { return x.slot === sl; })[0] : null, c = P ? V.equipCheck(w, ME, P.id, g.item) : { ok: false, why: 'no pet with a free ' + sl + ' slot' };
    var d = dmg(g.item) - (cur ? dmg(cur.item) : 0), wearing = cur && cur.gid === g.gid;
    var tot0 = P ? V.wornOf(w, P.id).reduce(function (s, x) { return s + dmg(x.item); }, 0) : 0, tot1 = tot0 + (wearing ? 0 : d);
    if (S.moodFor !== g.gid + ':' + S.pet) { S.moodFor = g.gid + ':' + S.pet; S.mood = wearing || !P ? null : d > 0 ? 'up' : d < 0 ? 'shrug' : null; S.moodUntil = performance.now() + 2600; if (S.mood) { S.say = S.mood === 'up' ? 'Upgrade! \u{1F44D}' : 'Meh. Your call.'; S.lt = performance.now(); } }
    /* sticky-feed-bar (owner 9:30 PM CT): the piece info (name, slot, tier, gear-damage diff vs worn, Wear / Take off) is a price-tag sign INSIDE the shop scene by Dan. */
    var TN = ['Common', 'Uncommon', 'Rare', 'Legendary'], tn = TN[it.tier != null ? it.tier : g.tier || 0] || '', dd = tot1 - tot0;
    var sign = '<div class="sc-sign" role="status"><div class="sc-item"><span class="sc-ic"></span><div><b>' + esc(it.label || g.label) + '</b><br><span class="sc-tag">' + esc(lword(sl)) + '</span> <span class="sc-tag">' + (it.exclusive || g.legendary ? '★ ' : '') + esc(tn) + '</span>' + (g.on != null ? ' <span class="sc-eq">EQUIPPED #' + g.on + '</span>' : '') + '</div></div>' +
      (P ? '<div class="sc-big ' + (dd > 0 ? 'up' : dd < 0 ? 'dn' : '') + '">\u2694 ' + tot0 + ' \u2192 ' + tot1 + ' <b>' + (dd > 0 ? '+' + dd : dd < 0 ? dd : '\u00b10') + '</b></div>' +
        '<div class="sc-delta">' + (wearing ? 'Worn by #' + P.id : 'on #' + P.id + ' · <b class="' + (d > 0 ? 'up' : d < 0 ? 'dn' : '') + '">' + (d > 0 ? '+' : '') + d + '</b> vs ' + (cur ? esc(cur.label) : 'empty slot')) + '</div>' : '') +
      '<div class="sc-act">' + (P && !wearing ? '<button type="button" class="btn" id="scWear"' + (c.ok ? '' : ' disabled') + '>👕 Wear on #' + P.id + '</button>' : '') + (g.on != null ? '<button type="button" class="q" id="scOff">Take off</button>' : '') + '</div>' +
      (P && !wearing && !c.ok ? '<div class="sc-why">✋ ' + esc(c.worn ? 'Already wearing it' : c.why) + '</div>' : '') + '</div>';
    var scn = document.getElementById('shopScene'), old = scn && scn.querySelector('.sc-sign'); if (old) old.remove(); if (scn) scn.insertAdjacentHTML('beforeend', sign);
    el.innerHTML = (P ? stepPet(P, true) + hero(w, P) : '') + (P ? tryOn(w, P, g, cur, sl, wearing, tot0, tot1) : '') + bestBar() + '<div class="gc-step gc-sub" id="gcPickH">Change pet: tap one below (pets with a free ' + esc(lword(sl).split(' ')[0]) + ' slot)</div><div class="sc-pets" id="scPick"></div><div class="sc-act sc-act-anchor"></div>' + rollRow(w, pets) + gallery(w);
    var sgn = scn && scn.querySelector('.sc-sign');
    if (R && R.iconCanvas && sgn) sgn.querySelector('.sc-ic').appendChild(R.iconCanvas(g.item, ''));
    if (P) { paintTry(el, w, P, g, sl, wearing); paintHero(el, w, P); } bindBest(el, w, P);
    if (window.V2Picker) V2Picker.mount(document.getElementById('scPick'), { w: w, me: ME, selected: String(S.pet), per: 8, sorts: ['score', 'power', 'newest'], records: function () { return fit.map(function (p) { return { key: String(p.id), pets: [p], newest: p.hatchBlock, html: V2Picker.petChip(w) }; }); },
      onPick: function (r) { S.pet = +r.key; S.rollPet = S.pet; counter(); } });
    var wb = document.getElementById('scWear'); if (wb) wb.onclick = function () { if (U.viewOnly && U.viewOnly()) return U.confirmPlans('Equip', [{}]); var c2 = V.equipCheck(U.world(), ME, P.id, g.item); if (!c2.ok) return; op(P.id, sl, c2.gid, 'Equipped ' + (it.label || '') + ' on #' + P.id); };
    var ob = document.getElementById('scOff'); if (ob) ob.onclick = function () { if (U.viewOnly && U.viewOnly()) return U.confirmPlans('Equip', [{}]); op(g.on, sl, null, 'Took ' + (it.label || '') + ' off #' + g.on); };
    bindRoll(el); rrBind(el); }
  function rrBind(el) { bindDoor(el); bindGallery(el); bindBar(el); }
  /* LAIR UX (quick wins 2026-10-19, display + the same free local equip op; no rule change): live try-on (the chosen pet now -> wearing the piece),
   * a big gear-damage readout (⚔ 12 -> 15 +3), WEARING NOW tag on what it has on, 'Wear best' per slot, double-tap to wear, a poof when gear changes,
   * Dan thumbs-up on an upgrade / shrug on a downgrade. */
  function tryOn(w, P, g, cur, sl, wearing, tot0, tot1) { var dd = tot1 - tot0;
    return '<div class="sc-try' + (S.poofT && performance.now() - S.poofT < 900 ? ' poof' : '') + '"><div class="sc-tp"><canvas class="sc-now" width="32" height="32"></canvas><small>NOW</small></div><span class="sc-arrow">\u2192</span><div class="sc-tp"><canvas class="sc-after" width="32" height="32"></canvas><small>' + (wearing ? 'WEARING' : 'TRY-ON') + '</small></div>' +
      (cur ? '<div class="sc-wearing">WEARING NOW: ' + esc(cur.label || '') + '</div>' : '<div class="sc-wearing empty">' + esc(lword(sl)) + ' slot empty</div>') + '</div>'; }
  /* sticky-feed-bar 2026-10-19 (owner 9:27 PM CT 'can't see my pet'): the Lair pet shown big next to its six slots (worn piece / empty / locked). Display only. */
  function hero(w, P) { var V = window.V2Rules, worn = V.wornOf(w, P.id), open = P.openSlots || [];
    var rows = SLOT_ORDER.concat(P.species === 'wizard' ? ['weapon'] : []).map(function (sl) { var x = worn.filter(function (q) { return q.slot === sl; })[0], on = V.slotOpen ? V.slotOpen(P, sl) : open.indexOf(sl) >= 0; /* + Wizard-only Staff slot (Bitcoin staff), Wizards only */
      return '<li class="' + (x ? 'on' : on ? 'open' : 'lock') + '"><span>' + esc(lword(sl)) + '</span> ' + (x ? esc(x.label || '') : on ? 'empty' : '🔒') + '</li>'; }).join('');
    return '<div class="sc-hero"><div class="sc-hp"><canvas class="sc-hc" width="32" height="32"></canvas><b>#' + P.id + ' ' + esc(String(P.name || '')) + '</b><small>' + esc(V.speciesLabel(P.species)) + '</small></div><ul class="sc-slots">' + rows + '</ul></div>'; }
  function paintHero(el, w, P) { put(el.querySelector('.sc-hc'), framesFor(w, P, window.V2Rules.wornOf(w, P.id).map(function (x) { return x.item; }))); }
  var SLOT_ORDER = ['head', 'hand', 'body', 'back', 'face', 'feet'];
  function framesFor(w, P, ids) { var R = window.V2Render; try { return R.framesWith(P.art, P.stage, ids, P.blackEye ? ['v2-black-eye'] : []); } catch (e) { return null; } }
  function put(c, fr) { if (!c || !fr || !fr[0]) return; try { c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(fr[0].data), 32, 32), 0, 0); } catch (e) { } }
  function paintTry(el, w, P, g, sl, wearing) { var V = window.V2Rules, worn = V.wornOf(w, P.id), now = worn.map(function (x) { return x.item; }), aft = worn.filter(function (x) { return x.slot !== sl; }).map(function (x) { return x.item; }).concat([g.item]);
    put(el.querySelector('.sc-now'), framesFor(w, P, now)); put(el.querySelector('.sc-after'), framesFor(w, P, wearing ? now : aft)); }
  function bindBest(el, w, P) { var U = window.V2UI, V = window.V2Rules, ME = U.ME; if (!P) return; var free = (w.itemList || []).filter(function (x) { return x.owner === ME && x.on == null; }), worn = V.wornOf(w, P.id), out = [];
    (P.openSlots || []).forEach(function (sl) { var cur = worn.filter(function (x) { return x.slot === sl; })[0], c0 = cur ? dmg(cur.item) : 0;
      var best = free.filter(function (x) { var it = (V.GEAR_BY_ID || {})[x.item]; return it && it.slot === sl && V.equipCheck(w, ME, P.id, x.item).ok; }).sort(function (a, b) { return dmg(b.item) - dmg(a.item); })[0];
      if (best && dmg(best.item) > c0) out.push({ sl: sl, g: best, d: dmg(best.item) - c0 }); });
    if (!out.length) return; var row = document.createElement('div'); row.className = 'sc-best'; row.innerHTML = '<span class="sc-best-h">\u26a1 Wear best on #' + P.id + ':</span> ' + out.map(function (o, i) { return '<button type="button" class="q" data-best="' + i + '">' + esc(lword(o.sl).split(' ')[0]) + ' +' + o.d + '</button>'; }).join(' ');
    var act = el.querySelector('.sc-act'); (act || el).parentNode.insertBefore(row, act ? act.nextSibling : null);
    row.querySelectorAll('[data-best]').forEach(function (b) { b.onclick = function () { if (U.viewOnly && U.viewOnly()) return U.confirmPlans('Equip', [{}]); var o = out[+b.dataset.best], c2 = V.equipCheck(U.world(), ME, P.id, o.g.item); if (!c2.ok) return; S.sel = o.g; op(P.id, o.sl, c2.gid, 'Equipped ' + ((V.GEAR_BY_ID || {})[o.g.item] || {}).label + ' on #' + P.id); }; }); }
  function mood(x, t) { if (!S.mood || t > S.moodUntil) return; var ox = DAN.x, oy = DAN.y;
    if (S.mood === 'up') { px(x, '#000', ox + 33, oy + 11, 6, 8); px(x, '#c6846f', ox + 34, oy + 14, 4, 4); px(x, '#c6846f', ox + 35, oy + 10, 2, 4); px(x, '#3ddc84', ox + 31, oy + 4, 9, 1); }
    else { px(x, '#c6846f', ox - 6, oy + 12, 4, 3); px(x, '#c6846f', ox + 34, oy + 12, 4, 3); px(x, '#1a1c1e', ox - 3, oy + 15, 3, 4); px(x, '#1a1c1e', ox + 33, oy + 15, 3, 4); px(x, '#ff5d5d', ox + 14, oy - 4, 4, 1); } }
  /* ROLL BY SPECIES (sticky-feed-bar 2026-10-19, owner 9:24 PM CT; cosmetic, SAME burn): pick a species with the shared picker, the roll goes to the
   * same pet:roll:ID tag (345 XCPETS) for ONE of your living pets of that species (the Lair pet if it is that species, else the one with the most open
   * slots, then lowest #). The rule rolls into a random OPEN slot of that pet from its species' pool, and the piece is worn by that pet.
   * Target 'sel' (board selection, the old sticky-bar Roll gear ×N) clicks the same #bRoll handler as before. */
  function rollPick(w, pets, sp) { var L = pets.filter(function (q) { return q.species === sp; }); if (!L.length) return null; var lp = S.pet != null ? S.pet : S.rollPet;
    return L.filter(function (q) { return q.id === lp; })[0] || L.slice().sort(function (a, b) { return (b.openSlots || []).length - (a.openSlots || []).length || a.id - b.id; })[0]; }
  function slotWords(P) { return (P.openSlots || []).map(function (sl) { return lword(sl).split(' ')[0]; }); }
  function rollRow(w, pets) { if (!pets.length) return ''; var V = window.V2Rules, U = window.V2UI, cur = pets.filter(function (q) { return q.id === (S.pet != null ? S.pet : S.rollPet); })[0] || pets[0];
    if (!S.rollSp || !pets.some(function (q) { return q.species === S.rollSp; })) S.rollSp = cur.species;
    var P = rollPick(w, pets, S.rollSp), tgt = (window.V2LairQoL && V2LairQoL.target()) || 'pet', nSel = U.S().sel.length;
    if (tgt === 'sel' && nSel) { var rn = Math.max(1, Math.min(10, Number((document.getElementById('rollN') || {}).value) || 1)), rq = V.rollQueue(w, U.ME, U.S().sel, rn);
      return '<div class="sc-roll"><div class="sc-rh">🎲 Roll gear · your ' + nSel + ' selected pet' + (nSel === 1 ? '' : 's') + '</div><label class="small sc-rn">Rolls per pet <input class="amt small" id="scRollN" type="number" min="1" max="10" value="' + rn + '" aria-label="Rolls per pet"></label>' +
        '<button type="button" class="btn ico-flame" id="scRollSel"' + (rq.length ? '' : ' disabled') + '>🎲 Roll ' + rq.length + ' time' + (rq.length === 1 ? '' : 's') + ' <span class="cost">' + fmtN(rq.length * V.COSTS.roll) + ' XCPETS</span></button>' + (rq.length ? '' : '<div class="sc-why">✋ No living pet of yours selected</div>') + '</div>'; }
    S.rollPet = P.id; var lg = (V.legendaryOf && V.legendaryOf(P.species) || [])[0] || null, sw = slotWords(P);
    var species = '<details class="rr-fold"><summary>🎲 Roll by species (the old picker)</summary><div class="sc-roll"><div class="sc-pets" id="scSpPick"></div>' +
      '<div class="sc-rinfo"><b>' + esc(V.speciesLabel(P.species)) + '</b> → rolls on <b>#' + P.id + '</b> ' + esc(String(P.name || '')) + '<br>Can land in: ' + (sw.length ? sw.map(function (x) { return '<span class="sc-tag">' + esc(x) + '</span>'; }).join(' ') : '—') +
      (lg ? '<br><small>★ ' + esc(V.speciesLabel(P.species)) + ' signature hat: ' + esc(lg.label) + ' (Legendary pets)</small>' : '') + '</div>' +
      '<button type="button" class="btn ico-flame" id="scRoll" data-pid="' + P.id + '">🎲 Roll for ' + esc(V.speciesLabel(P.species)) + ' <span class="cost">345 XCPETS</span></button></div></details>';
    return danDoor(w, pets) + species; }
  /* DAN'S DOOR (Rare Room, owner Oct 21 2026): roll gear pet-first. The crew list shows every living pet's six slots (open / locked) and the real odds
   * (the rule picks one of the pet's OPEN slots from block hash + tx, so each open slot is 1 in N). 'Roll my best pet' = most open slots, ties to the
   * lowest #. Every button builds the SAME pet:roll:ID tag at the SAME 345 XCPETS through the same confirm + wasted-burn guard. No rule change. */
  var CREW_N = 8;
  function crewSort(pets) { return pets.filter(function (p) { return !p.released && (p.openSlots || []).length; }).sort(function (a, b) { return (b.openSlots || []).length - (a.openSlots || []).length || a.id - b.id; }); }
  function danDoor(w, pets) { var V = window.V2Rules, L = crewSort(pets), best = L[0], pend = window.UXB && UXB.pendingFor ? UXB.pendingFor : null, n = S.crewN || CREW_N;
    if (!L.length) return '<div class="rr-door"><div class="rr-dh">🚪 Dan\u2019s Door · Roll for gear</div><p class="small">No living pet with an open slot yet. Slots open as pets grow (age and days fed).</p></div>';
    var row = function (p) { var os = p.openSlots || [], k = os.length, pn = pend ? pend(p.id) : 0;
      return '<div class="rr-crew"><canvas class="rr-cc" width="32" height="32" data-cpid="' + p.id + '"></canvas><div class="rr-cm"><b>#' + p.id + ' ' + esc(String(p.name || '')).slice(0, 16) + '</b> <small>' + esc(V.speciesLabel(p.species)) + '</small><div class="rr-chips">' +
        SLOT_ORDER.map(function (sl) { var op = os.indexOf(sl) >= 0; return '<span class="rr-chip' + (op ? ' op' : '') + '" title="' + (op ? 'open' : 'locked') + '">' + esc(lword(sl).split(' \u00b7 ')[1] || lword(sl)) + (op ? '' : ' 🔒') + '</span>'; }).join('') +
        '</div><small class="rr-odds">Each open slot: 1 in ' + k + ' (' + Math.round(100 / k) + '%)' + (pn ? ' · 🎁 ' + pn + ' on the way' : '') + '</small></div><button type="button" class="btn ico-flame rr-roll" data-rpid="' + p.id + '">🎲 345</button></div>'; };
    return '<div class="rr-door" id="danDoor"><div class="rr-dh">🚪 Dan\u2019s Door · Roll for gear</div><p class="small rr-dsub">One roll = 345 XCPETS = one random piece in a random <b>open</b> slot of the pet you pick. Same burn as always.</p>' +
      '<button type="button" class="btn ico-flame rr-best" data-rpid="' + best.id + '">🎲 Roll my best pet · 345 <span class="cost">#' + best.id + ' ' + esc(String(best.name || '')).slice(0, 14) + ' has the most open slots (' + best.openSlots.length + ')</span></button>' +
      '<div class="rr-ch">Or pick from your crew</div>' + L.slice(0, n).map(row).join('') + (L.length > n ? '<button type="button" class="q rr-more" id="rrMore">Show ' + Math.min(CREW_N, L.length - n) + ' more (' + (L.length - n) + ' left)</button>' : '') + '</div>'; }
  function bindDoor(el) { var U = window.V2UI, V = window.V2Rules, w = U.world(); el.querySelectorAll('[data-rpid]').forEach(function (b) { b.onclick = function () { var id = +b.dataset.rpid; U.confirmPlans('Gear roll for #' + id, [{ tag: V.buildTag('roll', { petId: id }), amount: V.COSTS.roll }]); }; });
    var m = el.querySelector('#rrMore'); if (m) m.onclick = function () { S.crewN = (S.crewN || CREW_N) + CREW_N; counter(); };
    el.querySelectorAll('canvas[data-cpid]').forEach(function (c) { var P = w.byId[+c.dataset.cpid]; if (P) put(c, framesFor(w, P, V.wornOf(w, P.id).map(function (x) { return x.item; }))); }); }
  /* RARE ROOM GALLERY: your gear as framed cards grouped by the six slots (rarest first, 12 per slot; the full list stays in 'Your stash · all your gear').
   * Tap a card = the same select/try-on as tapping it on the wall. */
  var GAL_N = 12;
  function gallery(w) { var V = window.V2Rules, ME = window.V2UI.ME, L = (w.itemList || []).filter(function (g) { return g.owner === ME; }); if (!L.length) return '';
    var by = {}; L.forEach(function (g) { var it = (V.GEAR_BY_ID || {})[g.item], sl = (it && it.slot) || g.slot; if (sl === 'weapon') sl = 'hand'; (by[sl] = by[sl] || []).push(g); });
    var h = '<div class="rr-gal" id="rrGallery"><div class="rr-dh">🖼️ Your Gallery · ' + L.length + ' piece' + (L.length === 1 ? '' : 's') + '</div><div class="rr-leg small"><i class="t0"></i>Common <i class="t1"></i>Uncommon <i class="t2"></i>Rare <i class="t3"></i>Legendary · green dot = worn</div>';
    SLOT_ORDER.forEach(function (sl) { var G = (by[sl] || []).sort(function (a, b) { return tierOfG(b) - tierOfG(a) || (a.on == null ? -1 : 1); });
      h += '<div class="rr-row"><div class="rr-rh">' + esc(lword(sl)) + ' · ' + G.length + (G.length > GAL_N ? ' <a href="#" class="rr-all" data-all="1">See all ▸</a>' : '') + '</div><div class="rr-cards">' +
        (G.length ? G.slice(0, GAL_N).map(function (g) { var t = tierOfG(g); return '<button type="button" class="rr-card t' + t + (S.sel && S.sel.gid === g.gid ? ' sel' : '') + '" data-ggid="' + esc(g.gid) + '" title="' + esc(g.label || g.item) + '"><span class="rr-nm">' + esc(String(g.label || g.item)).slice(0, 14) + '</span><canvas width="16" height="16" data-gic="' + esc(g.item) + '"></canvas>' + (g.on != null ? '<i class="rr-on"></i>' : '') + '</button>'; }).join('') : '<span class="small muted">Empty wall. Dan can fix that: 🎲</span>') + '</div></div>'; });
    return h + '</div>'; }
  function bindGallery(el) { var U = window.V2UI, R = window.V2Render, w = U.world(); el.querySelectorAll('canvas[data-gic]').forEach(function (c) { var ic = S.icons[c.dataset.gic]; if (!ic) try { ic = S.icons[c.dataset.gic] = R.iconCanvas(c.dataset.gic); } catch (e) { } if (ic) c.getContext('2d').drawImage(ic, 0, 0, 16, 16); });
    el.querySelectorAll('[data-ggid]').forEach(function (b) { b.onclick = function () { var g = w.items[b.dataset.ggid]; if (!g) return; S.sel = g; say(g); waveNow(); if (window.V2LairQoL) V2LairQoL.viewed(g); mirrorPet(w); counter(); draw(performance.now()); var sc = document.getElementById('shopScene'); if (sc && sc.scrollIntoView) sc.scrollIntoView({ behavior: 'smooth', block: 'start' }); }; });
    el.querySelectorAll('[data-all]').forEach(function (a) { a.onclick = function (e) { e.preventDefault(); var d = document.querySelector('details.shop-all'); if (d) { d.open = true; d.scrollIntoView({ block: 'start' }); } }; }); }
  /* Equip Best + one-tap Undo right under the mirror (the same V2LairQoL.equipBest / undo as the More fold) */
  function bestBar() { var Q = window.V2LairQoL; if (!Q || !Q.equipBest) return ''; return '<div class="rr-bar"><button type="button" class="btn ico-flame" id="rrBest">⚡ Equip Best <span class="cost">free · your best pieces</span></button>' + (Q.hasUndo && Q.hasUndo() ? '<button type="button" class="q" id="rrUndo">↩ Undo</button>' : '') + '</div>'; }
  function bindBar(el) { var Q = window.V2LairQoL, b = el.querySelector('#rrBest'); if (b) b.onclick = function () { Q.equipBest(); counter(); }; b = el.querySelector('#rrUndo'); if (b) b.onclick = function () { Q.undo(); counter(); }; }
  /* gear-clarity (owner Oct 20 2026: 'which pet am I dressing / where is my gear / where do I click'): step labels, a current-pet chip with a
   * 'Change pet' link that scrolls to the EXISTING picker, and an empty state. Display only; the pickers themselves are unchanged. */
  function stepPet(P, itemOn) { return '<div class="gc-step"><b>Step 1: Pick your pet</b> <span class="gc-chip">Dressing #' + P.id + ' ' + esc(String(P.name || '')) + '</span> <a href="#" class="gc-change" data-gc="' + (itemOn ? 'scPick' : 'scPetPick') + '">✎ Change pet ▾</a></div>'; }
  function stepGear(w) { var ME = window.V2UI.ME, L = (w.itemList || []).filter(function (g) { return g.owner === ME; }), n = L.length, f = L.filter(function (g) { return g.on == null; }).length;
    return '<div class="gc-step"><b>Step 2: Your gear (' + n + ' piece' + (n === 1 ? '' : 's') + ' · ' + f + ' unworn)</b> ' + (n ? '<span class="gc-cue">⬆ Tap an item on the walls above to equip it</span>' : '<span class="gc-cue">No gear yet. Roll gear below (🎲 345 XCPETS) and it lands on the walls.</span>') + '</div>'; }
  if (typeof document !== 'undefined') { document.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('.gc-change'); if (!a) return; e.preventDefault(); var t = document.getElementById(a.dataset.gc) || document.getElementById('scSpPick'); if (!t) return; t.scrollIntoView({ behavior: 'smooth', block: 'center' }); t.classList.remove('gc-glow'); void t.offsetWidth; t.classList.add('gc-glow'); });
    if (!document.getElementById('gcCss')) { var gs = document.createElement('style'); gs.id = 'gcCss'; gs.textContent = '.gc-step{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;margin:8px 0 4px;font-size:12px}.gc-step b{font-family:"Press Start 2P",monospace;font-size:9px;color:#ffd166}.gc-sub{font-size:11px;color:#9fe8ff}.gc-chip{background:#140f24;border:2px solid #4fd18b;color:#4fd18b;padding:4px 8px;font-weight:700}.gc-change{color:#9fe8ff;font-weight:700;min-height:32px;display:inline-flex;align-items:center}.gc-cue{color:#cfc6e8}#shopCounter .pk-key.sel{position:relative;outline:3px solid #ffd166;outline-offset:1px}#shopCounter .pk-key.sel::before{content:\'▼\';position:absolute;top:-13px;left:50%;transform:translateX(-50%);color:#ffd166;font-size:11px;line-height:1;text-shadow:1px 1px 0 #000}.lair-more>summary{min-height:40px;display:flex;align-items:center;cursor:pointer}.gc-glow{animation:gcG 1.6s ease-out 1}@keyframes gcG{0%,60%{box-shadow:0 0 0 3px #ffd166}100%{box-shadow:none}}@media (prefers-reduced-motion:reduce){.gc-glow{animation:none;outline:3px solid #ffd166}}'; (document.head || document.documentElement).appendChild(gs); } }
  /* lair batch 2 (owner Oct 20 2026): direct pet picker (same V2Picker + petChip as the Wear picker) to choose exactly which pet you dress */
  function petPick(HP) { var U = window.V2UI, el = document.getElementById('scPetPick'); if (!el || !window.V2Picker || !HP) return; var w = U.world(), L = U.mine(w).filter(function (p) { return !p.dead && !p.released; });
    V2Picker.mount(el, { w: w, me: U.ME, selected: String(HP.id), per: 8, sorts: ['score', 'power', 'newest'], records: function () { return L.map(function (p) { return { key: String(p.id), pets: [p], newest: p.hatchBlock, html: V2Picker.petChip(w) }; }); },
      onPick: function (r) { S.pet = +r.key; S.rollPet = S.pet; var P = w.byId[S.pet]; if (P) S.rollSp = P.species; counter(); } }); }
  function fmtN(n) { return Number(n).toLocaleString('en-US'); }
  function bindRoll(el) { var U = window.V2UI, V = window.V2Rules, rb = document.getElementById('scRoll');
    if (rb) rb.onclick = function () { var id = +rb.dataset.pid; U.confirmPlans('Gear roll for #' + id, [{ tag: V.buildTag('roll', { petId: id }), amount: V.COSTS.roll }]); };
    var rs = document.getElementById('scRollSel'); if (rs) rs.onclick = function () { var b = document.getElementById('bRoll'); if (b) b.click(); };
    var rn = document.getElementById('scRollN'); if (rn) rn.oninput = function () { var h = document.getElementById('rollN'); if (h) { h.value = rn.value; h.dispatchEvent(new Event('input')); } var w = U.world(), pets = U.mine(w).filter(function (p) { return !p.dead; }), q = V.rollQueue(w, U.ME, U.S().sel, Math.max(1, Math.min(10, Number(rn.value) || 1))); if (rs) { rs.disabled = !q.length; rs.innerHTML = '🎲 Roll ' + q.length + ' time' + (q.length === 1 ? '' : 's') + ' <span class="cost">' + fmtN(q.length * V.COSTS.roll) + ' XCPETS</span>'; } };
    var pk = document.getElementById('scSpPick'); if (pk && window.V2Picker) { var w = U.world(), pets = U.mine(w).filter(function (p) { return !p.dead && !p.released; }), by = {};
      pets.forEach(function (p) { (by[p.species] = by[p.species] || []).push(p); });
      V2Picker.mount(pk, { w: w, me: U.ME, selected: String(S.rollSp), per: 8, sorts: ['score', 'power', 'newest'], records: function () { return Object.keys(by).map(function (sp) { var L = by[sp]; return { key: sp, pets: L, newest: Math.max.apply(null, L.map(function (p) { return p.hatchBlock || 0; })),
        html: function () { var b = rollPick(w, pets, sp); return '<b>' + esc(V.speciesLabel(sp)).slice(0, 14) + '</b><span>' + L.length + ' pet' + (L.length === 1 ? '' : 's') + '</span><small>#' + b.id + ' · ' + (b.openSlots || []).length + ' slot' + ((b.openSlots || []).length === 1 ? '' : 's') + '</small>'; } }; }); },
        onPick: function (r) { S.rollSp = r.key; var b = rollPick(w, pets, r.key); if (b) { S.rollPet = b.id; S.pet = b.id; } counter(); } }); } } /* gear-clarity: the species pick also moves the Lair pet (it used to change only the roll target while S.pet kept the old pet in the big panel) */
  function refreshRoll() { counter(); }
  function op(pid, slot, gid, msg) { var U = window.V2UI, St = U.S(); St.ops.push({ kind: 'equip', owner: U.ME, petId: pid, slot: slot, gid: gid, block_index: St.tip }); U.save(); S.poofT = performance.now(); S.moodFor = null; U.render(); S.say = 'Lookin\u2019 sharp!'; S.lt = performance.now(); U.toast(esc(msg) + ' (free)'); }

  /* Rare Room theme (palette A 'Royal Vault'). Only the gear-place panels; pickers (.sc-pets / V2Picker), selection boxes and site fonts untouched. */
  if (typeof document !== 'undefined' && !document.getElementById('rrCss')) { var rs = document.createElement('style'); rs.id = 'rrCss'; rs.textContent =
    '.shop8{background:linear-gradient(180deg,#22103d,#170a2b);border-color:#e8b84a!important;box-shadow:0 0 0 3px #000,0 0 0 5px #8a5a12,6px 6px 0 5px #000}' +
    '.shop8 .shop-scene{background:#2a0f4a;border:3px solid #e8b84a;box-shadow:0 0 0 3px #000,4px 4px 0 3px #000}.shop8 .shop-hint{background:#170a2b;color:#fff1a8}' +
    '.shop8 .lair-h{color:#fff1a8}.shop8 .sc-hero{background:#1c0f33;border:3px solid #e8b84a;box-shadow:3px 3px 0 #000}.shop8 .sc-hp canvas{background:#8fe3ff;border:3px solid #e8b84a;box-shadow:0 0 0 2px #000}' +
    '.shop8 .sc-slots li.on{color:#fff1a8}.shop8 .sc-slots li.open{color:#4fd18b}.rr-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:6px 0 10px}' +
    '.rr-door,.rr-gal{margin:12px 0;padding:10px;background:#1c0f33;border:3px solid #e8b84a;box-shadow:0 0 0 2px #000,4px 4px 0 2px #000}.rr-dh{font-family:"Press Start 2P",monospace;font-size:10px;color:#fff1a8;margin-bottom:6px;line-height:1.5}' +
    '.rr-dsub{color:#cdbbe8;margin:0 0 8px}.rr-best{display:flex;flex-direction:column;align-items:center;width:100%;min-height:52px}.rr-best .cost{font-size:12px}.rr-ch{font-family:"Press Start 2P",monospace;font-size:8px;color:#8fe3ff;margin:10px 0 4px}' +
    '.rr-crew{display:flex;gap:8px;align-items:center;padding:6px;margin:4px 0;background:#22103d;border:2px solid #000}.rr-cc{width:48px;height:48px;image-rendering:pixelated;flex:0 0 auto;background:#2a0f4a}.rr-cm{flex:1;min-width:0}.rr-cm b{color:#f6eeff}.rr-cm small{color:#cdbbe8}' +
    '.rr-chips{display:flex;flex-wrap:wrap;gap:3px;margin:3px 0}.rr-chip{font-size:11px;font-weight:700;padding:1px 5px;background:#3a3450;color:#8a84a0;border:1px solid #000}.rr-chip.op{background:#4fd18b;color:#140f24}.rr-odds{color:#e8b84a!important;font-weight:700}' +
    '.rr-roll{flex:0 0 auto;min-height:40px}.rr-more{margin-top:6px}.rr-fold{margin:6px 0}.rr-fold>summary{cursor:pointer;min-height:40px;display:flex;align-items:center;color:#8fe3ff;font-weight:700}' +
    '.rr-leg i{display:inline-block;width:10px;height:10px;border:1px solid #000;margin:0 3px 0 8px;vertical-align:middle}.rr-leg .t0{background:#9aa3b5}.rr-leg .t1{background:#4fd18b}.rr-leg .t2{background:#4f9dff}.rr-leg .t3{background:#ffc93c}' +
    '.rr-row{margin:8px 0}.rr-rh{font-family:"Press Start 2P",monospace;font-size:8px;color:#e8b84a;background:#2a0f4a;padding:5px 6px;margin-bottom:6px}.rr-all{color:#8fe3ff;margin-left:8px}' +
    '.rr-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(78px,1fr));gap:10px}.rr-card{position:relative;display:flex;flex-direction:column;align-items:center;gap:3px;padding:4px 4px 6px;background:#f6efdc;border:4px solid #9aa3b5;outline:3px solid #e8b84a;box-shadow:0 0 0 5px #000,4px 4px 0 5px #000;cursor:pointer;min-height:96px;margin:4px}' +
    '.rr-card.t1{border-color:#4fd18b}.rr-card.t2{border-color:#4f9dff}.rr-card.t3{border-color:#ffc93c}.rr-card canvas{width:48px;height:48px;image-rendering:pixelated;background:#2a0f4a}.rr-card.sel{outline-color:#fff1a8;outline-style:dashed}' +
    '.rr-card.t2 canvas,.rr-card.t3 canvas{background:linear-gradient(115deg,#2a0f4a 20%,#7b3fe4 40%,#1fb5a5 55%,#2a0f4a 75%);background-size:300% 100%;animation:rrHolo 3s linear infinite}.rr-card.t3::after{content:"\\2726";position:absolute;top:-8px;right:-4px;color:#fff1a8;text-shadow:1px 1px 0 #000;font-size:14px}' +
    '@keyframes rrHolo{to{background-position:300% 0}}@media (prefers-reduced-motion:reduce){.rr-card canvas{animation:none!important}}.rr-nm{font-size:10px;font-weight:700;color:#140f24;line-height:1.1;text-align:center;max-width:100%;overflow:hidden}.rr-on{position:absolute;right:4px;bottom:4px;width:10px;height:10px;background:#3ddc84;border:2px solid #000}' +
    '@media (max-width:520px){.rr-cards{grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:8px}.rr-chip{font-size:10px}.rr-crew{flex-wrap:wrap}.rr-roll{width:100%}}';
    (document.head || document.documentElement).appendChild(rs); }
  window.V2Shop = { drawDan: dan, rackPick: rackPick, clearance: clearance, render: render, wave: waveNow, select: function (g) { S.sel = g; say(g); waveNow(); mirrorPet(window.V2UI.world()); counter(); draw(performance.now()); }, hover: function (g) { S.hov = g; if (g) say(g); draw(performance.now()); }, _state: function () { return S; }, refreshRoll: refreshRoll, LINES: LINES, DANK: DANK, lineAt: lineAt, dmg: dmg, op: op };
})();
