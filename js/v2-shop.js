/* XCPETS shop "The XCPETS Lair of Locks, Leverage, Layers, Luster, Looks, and Leathers" (owner's final name 8:01 PM CT) (UI-only mockup, owner 7:18 PM CT; branch pet-shop, NOT LIVE). No rule change, no new burns.
 * Now the Rare Room (remove-dan, Oct 21 2026: Captain Dan only stands at the Pepe Wheel; copies of his sprite + lines for memes in memes/captain-dan/, not loaded): your owned gear sits on the shelves (real item icons). Tap a shelf item -> the existing racks below jump to
 * that slot (same gear actions as before: pick a pet, tap a slot, equip/unequip). prefers-reduced-motion: static scene. */
(function () {
  'use strict';
  var W = 320, H = 150, RM = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var S = { c: null, x: null, items: [], icons: {}, raf: 0, hits: [], ang: 0, spinUntil: 0, line: 0 };
  /* THE PEPE WHEEL (remove-dan, owner Oct 21 2026 10:29-10:31 PM CT): a freestanding Pepe prize wheel on the Rare Room floor (between the vending machines and the mirror) is the roll spot.
   * Tap it = jump to the Pepe Wheel roll panel. It spins (display only) when a roll is sent (pending count goes up) or lands (your gear count goes up),
   * turns slowly while a roll is on the way, and stays still with prefers-reduced-motion. Same pet:roll:ID 345 burns; no rule change. */
  var WH = { x: 250, y: 119, r: 17 }; /* right side of the floor (the old doorway spot), clear of the card walls, the mirror and the rose window; the desktop price-tag sign moved to the left */
  /* Captain Dan's lines live in data/dan-lines.json (groups core / dank / cpnews / mined; each line {text, added, expires?}).
   * Lines show from 'added' and hide automatically from 'expires' (local date, YYYY-MM-DD), so news lines rotate without code changes.
   * Slot rule (same as before for core + dank): line n = core[n % core.length], unless a slot group claims n (n % every === at) and has active lines. */
  var POOL = { slots: { dank: { every: 12, at: 11 } }, groups: { core: [{ text: 'gm from the farm!', added: '2026-10-19' }] } }, LINES = [], DANK = [], ACT = {};
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function active(g, day) { return (POOL.groups[g] || []).filter(function (l) { return l && l.text && (!l.added || l.added <= day) && (!l.expires || day < l.expires); }).map(function (l) { return l.text; }); }
  function setPool(j, day) { if (j && j.groups) POOL = j; day = day || today(); ACT = {}; Object.keys(POOL.groups).forEach(function (g) { ACT[g] = active(g, day); }); LINES = ACT.core || []; DANK = ACT.dank || []; if (window.V2Shop) { V2Shop.LINES = LINES; V2Shop.DANK = DANK; } }
  setPool(null);
  try { fetch('data/dan-lines.json?v=' + ((document.currentScript && (document.currentScript.src.split('?v=')[1] || '')) || ''), { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j) setPool(j); }).catch(function () {}); } catch (e) {}
  function lineAt(n) { var sl = POOL.slots || {}, ks = Object.keys(sl); for (var i = 0; i < ks.length; i++) { var k = ks[i], c = sl[k], a = ACT[k]; if (a && a.length && c.every && n % c.every === c.at) return a[Math.floor(n / c.every) % a.length]; } return LINES[n % LINES.length]; }

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
  /* Captain Dan BACK at the wheel (owner 10:33 PM CT): full body (token-traced 32x32 head + torso, plus trousers and boots), faces left toward the wheel.
   * Idle: blink + a slow breathing bob. Pull: when the wheel spins (roll sent / landing) his near arm reaches the rim and yanks it down. Reduced motion: still. */
  var DAN = { x: 270, y: 97, w: 32, h: 44 };
  function danBody(x, ox, oy, t) { var rm = reduced(), bob = !rm && Math.floor(t / 1400) % 2 ? 1 : 0, blink = !rm && Math.floor(t / 2200) % 6 === 0, r, q, ch;
    px(x, 'rgba(0,0,0,.35)', ox + 6, oy + 42, 22, 2); /* floor shadow */
    px(x, '#1c2a4a', ox + 10, oy + 31, 6, 9); px(x, '#1c2a4a', ox + 17, oy + 31, 6, 9); px(x, '#ffcb4d', ox + 10, oy + 32, 1, 7); px(x, '#ffcb4d', ox + 22, oy + 32, 1, 7); /* trousers with gold seam */
    px(x, '#000', ox + 7, oy + 40, 9, 3); px(x, '#000', ox + 17, oy + 40, 8, 3); px(x, '#5a5e66', ox + 8, oy + 40, 3, 1); px(x, '#5a5e66', ox + 18, oy + 40, 3, 1); /* boots, toes left */
    for (r = 0; r < 32; r++) for (q = 0; q < 32; q++) { ch = DAN_MAP[r][q]; if (ch !== '.') px(x, DAN_PAL[ch], ox + q, oy + r - bob, 1, 1); }
    px(x, blink ? DAN_PAL.l : '#e8eef4', ox + 7, oy + 15 - bob, 1, 1); px(x, blink ? DAN_PAL.l : '#e8eef4', ox + 13, oy + 15 - bob, 1, 1);
    px(x, '#c6846f', ox + 28, oy + 30 - bob, 2, 2); /* far hand at his side */
    var ph = (t - (S.spinStart || 0)) % 900, pull = !rm && t < (S.spinUntil || 0) ? (ph < 300 ? 1 : ph < 600 ? 2 : 3) : 0; /* one pull every 0.9 s while it spins */
    if (!pull) { px(x, '#c6846f', ox + 5, oy + 30 - bob, 2, 2); return; }
    var hy = pull === 1 ? oy + 10 : pull === 2 ? oy + 17 : oy + 24; /* reach the rim, grab, yank down */
    px(x, '#141618', ox - 1, Math.min(hy, oy + 18), 5, Math.abs(oy + 18 - hy) + 3); px(x, '#141618', ox - 4, hy, 6, 3); px(x, '#c6846f', ox - 6, hy, 3, 3); }
  function bubbleTxt(x, s, cx, by) { x.font = '6px "Press Start 2P", monospace'; var words = String(s || '').split(' '), lines = [''], i;
    for (i = 0; i < words.length; i++) { var tl = lines[lines.length - 1] ? lines[lines.length - 1] + ' ' + words[i] : words[i]; if (x.measureText(tl).width > 118 && lines[lines.length - 1]) lines.push(words[i]); else lines[lines.length - 1] = tl; }
    lines = lines.slice(0, 2); var w = Math.ceil(Math.max.apply(null, lines.map(function (l) { return x.measureText(l).width; }))) + 8, h = lines.length * 9 + 4, bx = Math.round(Math.max(186, Math.min(W - w - 2, cx - w / 2))), y0 = Math.round(by - h);
    px(x, '#000', bx + 1, y0 + 1, w, h); px(x, '#fff8e1', bx, y0, w, h); px(x, '#fff8e1', Math.round(cx) - 2, y0 + h, 4, 3); x.fillStyle = '#1b1b1b'; lines.forEach(function (l, n) { x.fillText(l, bx + 4, y0 + 9 + n * 9); }); }
  /* AMBIENT PETS (display only): up to 3 small pets hang around the room, drawn with the site renderer (V2Render.petFrames). The player's own living pets
   * when connected, otherwise 3 real pets picked by a fixed seed from the chain world. Frames are cached once per pet; reduced motion: no bob. */
  var AMB = [{ x: 66, y: 112, s: 18 }, { x: 92, y: 116, s: 18 }, { x: 118, y: 120, s: 16 }];
  function ambPets(w) { var U = window.V2UI, R = window.V2Render; if (!U || !R || !w) return; var mine = U.mine(w).filter(function (p) { return !p.dead && !p.released && p.stage >= 1; }), L;
    if (mine.length) L = mine.slice(0, 3); else { var all = (w.pets || []).filter(function (p) { return !p.dead && p.stage >= 2 && !p.community; }); L = []; for (var i = 0; i < 3 && all.length; i++) L.push(all[(i * 7919 + 1337) % all.length]); }
    var key = L.map(function (p) { return p.id; }).join(','); if (key === S.ambKey) return; S.ambKey = key;
    S.amb = L.map(function (p) { var c = null; try { var V = window.V2Rules, f = R.framesWith(Object.assign({}, p.art, { background: 'solid', bgColor: '#ff00ff', pattern: 'none' }), p.stage, V.wornOf(w, p.id).map(function (x) { return x.item; }), [])[0]; c = toCv([f]); var g0 = c.getContext('2d'), id = g0.getImageData(0, 0, 32, 32), d = id.data, r0 = d[0], g1 = d[1], b0 = d[2];
      for (var i = 0; i < d.length; i += 4) if (Math.abs(d[i] - r0) + Math.abs(d[i + 1] - g1) + Math.abs(d[i + 2] - b0) < 12 || (d[i] > 200 && d[i + 1] < 70 && d[i + 2] > 200)) d[i + 3] = 0; g0.putImageData(id, 0, 0); } catch (e) { c = null; } return c ? { id: p.id, c: c } : null; }).filter(Boolean); } /* backdrop keyed out like the motel guests */
  function drawAmb(x, t) { (S.amb || []).forEach(function (a, n) { var sp = AMB[n]; if (!sp) return; var b = !reduced() && Math.floor(t / 600 + n) % 2 ? 1 : 0; px(x, 'rgba(0,0,0,.3)', sp.x + 3, sp.y + sp.s - 1, sp.s - 6, 2); x.drawImage(a.c, sp.x, sp.y - b, sp.s, sp.s); }); }
  function spinNow(ms) { if (reduced()) return; S.spinStart = performance.now(); S.spinUntil = Math.max(S.spinUntil || 0, performance.now() + (ms || 2400)); }
  function onWheel(c, e) { var r = c.getBoundingClientRect(), mx = (e.clientX - r.left) * W / r.width, my = (e.clientY - r.top) * H / r.height; return Math.abs(mx - WH.x) <= WH.r + 6 && my >= WH.y - WH.r - 12 && my <= WH.y + WH.r + 12; }
  function wheel(x, cx, cy, R0, ang, pepe) { var J = ['#d0284f', '#1fb5a5', '#7b3fe4', '#2f6fe0'], i, a;
    px(x, '#000', cx - 4, cy + R0 - 2, 8, 14); px(x, '#e8b84a', cx - 3, cy + R0 - 2, 6, 13); px(x, '#000', cx - 12, cy + R0 + 10, 24, 5); px(x, '#efe8f6', cx - 11, cy + R0 + 11, 22, 3); px(x, '#e8b84a', cx - 11, cy + R0 + 10, 22, 1); /* gilded stand on a marble plinth */
    x.fillStyle = '#000'; x.beginPath(); x.arc(cx, cy, R0 + 2, 0, 7); x.fill(); x.fillStyle = '#e8b84a'; x.beginPath(); x.arc(cx, cy, R0 + 1, 0, 7); x.fill();
    for (i = 0; i < 8; i++) { a = ang + i * Math.PI / 4; x.fillStyle = i % 2 ? '#4fa83a' : J[(i >> 1) % 4]; x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, R0 - 1, a, a + Math.PI / 4); x.fill();
      var mx = Math.round(cx + Math.cos(a + Math.PI / 8) * (R0 - 6)), my = Math.round(cy + Math.sin(a + Math.PI / 8) * (R0 - 6)); px(x, i % 2 ? '#fff1a8' : '#4fa83a', mx - 1, my - 1, 2, 2); } /* Pepe-green wedges with gold pips */
    for (i = 0; i < 16; i++) { a = i * Math.PI / 8; px(x, '#fff1a8', Math.round(cx + Math.cos(a) * (R0 + 1)), Math.round(cy + Math.sin(a) * (R0 + 1)), 1, 1); } /* rim bulbs */
    x.fillStyle = '#000'; x.beginPath(); x.arc(cx, cy, 7, 0, 7); x.fill(); x.fillStyle = '#bfe9d6'; x.beginPath(); x.arc(cx, cy, 6, 0, 7); x.fill(); if (pepe) x.drawImage(pepe, cx - 6, cy - 7, 12, 12);
    px(x, '#000', cx - 3, cy - R0 - 5, 7, 3); px(x, '#000', cx - 2, cy - R0 - 2, 5, 2); px(x, '#fff1a8', cx - 2, cy - R0 - 4, 5, 1); px(x, '#e8b84a', cx - 1, cy - R0 - 3, 3, 2); } /* pointer */

  function reduced() { return !!RM.matches || !!window.__shopReduced; }
  function px(x, c, a, b, w, h) { x.fillStyle = c; x.fillRect(a, b, w, h); }
  /* THE RARE ROOM (owner Oct 21 2026, palette A 'Royal Vault'; design/rare-room.md): the gear place is a legendary vault-gallery. Display only:
   * the same stash pieces (S.items, same hits, same tap/hover/double-tap), and the same counter text.
   * Rarity frames keep the site colours (common #9aa3b5, uncommon #4fd18b, rare #4f9dff, legendary #ffc93c); rare + legendary get holo + sparkles. */
  /* RARE-ROOM-LAYOUT (design branch, owner Oct 21 2026 10:50 PM CT 'so much gear that having it on the walls like that doesnt work' + 'also redo the window').
   * Preview switch only: ?rrl=a|b|c picks a layout, ?rrw=1|2|3 a window (default window follows the layout). No param = the live layout, unchanged.
   *  A 'Slot walls + binder': 6 big frames (one per slot: best piece + count), full collection in a paged binder under the panel.
   *  B 'Featured + card rack': 8 featured frames (worn on the mirror pet first, then rarest), every piece in a scrollable rack right under the scene.
   *  C 'Drawers': 4 featured frames, a cabinet of 6 slot drawers (count + rarity bar) that open to the cards. Display only. */
  var QS = (function () { try { return new URLSearchParams(location.search); } catch (e) { return { get: function () { return null; } }; } })();
  var LAY = /^[abc]$/.test(QS.get('rrl') || '') ? QS.get('rrl') : '', WIN = +(QS.get('rrw') || { a: 1, b: 2, c: 3 }[LAY] || 0);
  function slotOfG(g) { var V = window.V2Rules, it = V && (V.GEAR_BY_ID || {})[g.item], sl = (it && it.slot) || g.slot; return sl === 'weapon' ? 'hand' : sl; }
  var SLOT_SHORT = { head: 'HEAD', hand: 'GRIP', body: 'DRIP', back: 'OUTFIT', face: 'GUISE', feet: 'FEET' };
  function featured(n) { var w = window.V2UI && V2UI.world(), pid = S.pet != null ? S.pet : S.rollPet, L = S.all || [], a = L.filter(function (g) { return pid != null && g.on === pid; }), b = L.filter(function (g) { return a.indexOf(g) < 0; }).sort(function (p, q) { return tierOfG(q) - tierOfG(p); }); return a.concat(b).slice(0, n); }
  function bySlot() { var by = {}; (S.all || []).forEach(function (g) { var sl = slotOfG(g); (by[sl] = by[sl] || []).push(g); }); SLOT_ORDER.forEach(function (sl) { (by[sl] = by[sl] || []).sort(function (a, b) { return tierOfG(b) - tierOfG(a) || (a.on == null ? 1 : -1); }); }); return by; }
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
    if (WIN) winDraw(x, t, WIN); else {
    /* stained-glass rose window with a Rare Pepe in the roundel */
    var cx = 160, cy = 23, R0 = 18; x.fillStyle = '#000'; x.beginPath(); x.arc(cx, cy, R0 + 2, 0, 7); x.fill(); x.fillStyle = RR.gold; x.beginPath(); x.arc(cx, cy, R0 + 1, 0, 7); x.fill();
    for (i = 0; i < 12; i++) { x.fillStyle = RR.jewel[i % 5]; x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, R0, i * Math.PI / 6, (i + 1) * Math.PI / 6); x.fill(); }
    x.fillStyle = '#000'; x.beginPath(); x.arc(cx, cy, 11, 0, 7); x.fill(); x.fillStyle = '#bfe9d6'; x.beginPath(); x.arc(cx, cy, 10, 0, 7); x.fill(); if (S.pepe) x.drawImage(S.pepe, cx - 10, cy - 11, 20, 20);
    x.fillStyle = 'rgba(255,240,180,.08)'; x.beginPath(); x.moveTo(cx - 14, cy + 14); x.lineTo(cx - 36, 96); x.lineTo(cx + 36, 96); x.lineTo(cx + 14, cy + 14); x.fill();
    }
    px(x, '#000', 118, 43, 84, 11); px(x, RR.velvet, 119, 44, 82, 9); px(x, RR.velvetHi, 119, 44, 82, 1); x.font = '6px "Press Start 2P", monospace'; x.textAlign = 'center'; x.fillStyle = RR.goldHi; x.fillText('THE RARE ROOM', 160, 51); x.textAlign = 'left';
    px(x, '#000', 0, 92, W, 5); px(x, RR.velvetLo, 0, 93, W, 3); px(x, RR.gold, 0, 92, W, 1); /* wainscot */
    for (j = 96, i = 0; j < H; j += 8, i++) for (var k2 = 0; k2 < W; k2 += 16) px(x, ((k2 / 16 + i) % 2) ? RR.floorA : RR.floorB, k2, j, 16, 8); /* marble checkerboard */
    px(x, 'rgba(0,0,0,.25)', 0, 96, W, 3);
    /* try-on mirror on a dais, showing the pet you are dressing */
    px(x, '#000', 138, 98, 44, 7); px(x, RR.floorA, 139, 99, 42, 5); px(x, RR.gold, 139, 98, 42, 1);
    gild(x, 147, 59, 26, 38); px(x, RR.sky, 147, 59, 26, 38); px(x, '#d8f6ff', 149, 61, 2, 26); if (S.mirror) x.drawImage(S.mirror, 144, 64, 32, 32);
    /* SOON objects (design only, nothing to buy): Can-o-Rare + Gear-o-Matic vending machines and the sale rack */
    [[8, RR.velvet, 'CAN-O-RARE'], [38, RR.emerald, 'GEAR-O-MATIC']].forEach(function (m) { var a = m[0], b = 102; px(x, '#000', a - 1, b - 1, 24, 34); px(x, m[1], a, b, 22, 32); px(x, RR.gold, a, b, 22, 2); px(x, '#bfe9ff', a + 3, b + 5, 11, 16); px(x, '#4fd18b', a + 5, b + 7, 7, 3); px(x, '#4f9dff', a + 5, b + 12, 7, 3); px(x, '#ffc93c', a + 5, b + 17, 7, 3); px(x, RR.goldHi, a + 16, b + 7, 3, 10); px(x, '#111', a + 3, b + 25, 16, 4); });
    plate(x, 'SOON', 19, 100, 4); plate(x, 'SOON', 49, 100, 4);
    px(x, RR.gold, 196, 106, 30, 2); px(x, RR.gold, 197, 106, 2, 24); px(x, RR.gold, 223, 106, 2, 24); px(x, RR.velvet, 201, 118, 20, 7); x.font = '4px "Press Start 2P", monospace'; x.fillStyle = '#fff'; x.textAlign = 'center'; x.fillText('SALE', 211, 124); x.textAlign = 'left'; plate(x, 'SOON', 211, 138, 4);
    [[60, 8], [250, 10], [128, 40], [192, 38]].forEach(function (q, n) { if (!reduced() && Math.floor(t / 700 + n) % 3 === 0) return; px(x, RR.goldHi, q[0], q[1] - 1, 1, 3); px(x, RR.goldHi, q[0] - 1, q[1], 3, 1); }); }
  /* three window concepts (no radial wedges, no hub: they must read as windows, not as a second wheel). Area x 118-202, y 4-42. */
  function lead(x, a, b, w, h) { px(x, '#000', a, b, w, h); }
  function winDraw(x, t, n) { var i, j, tw = !reduced() && Math.floor(t / 900) % 2;
    if (n === 1) { /* arched lancet stained-glass triptych: three pointed-arch lights, leaded rectangular panes, Rare Pepe in the tall middle light */
      [[126, 14, 16], [146, 6, 28], [178, 14, 16]].forEach(function (L, k) { var a = L[0], b = L[1], w = L[2], h = 40 - b;
        px(x, '#000', a - 2, b - 1, w + 4, h + 3); px(x, RR.gold, a - 1, b, w + 2, h + 1);
        for (j = 0; j < h; j += 6) for (i = 0; i < w; i += (k === 1 ? 7 : 8)) px(x, RR.jewel[(i / 7 + j / 6 + k) % 5 | 0], a + i, b + j, k === 1 ? 7 : 8, 6);
        for (j = 0; j < h; j += 6) lead(x, a, b + j, w, 1); for (i = 0; i <= w; i += (k === 1 ? 7 : 8)) lead(x, a + i, b, 1, h);
        for (i = 0; i < w / 2; i++) { var cut = Math.max(0, Math.round(w / 2 - 1 - i - (w / 2) * 0.0)); px(x, RR.wall, a + i, b - 1, 1, Math.max(0, Math.round((w / 2 - i) * 0.6))); px(x, RR.wall, a + w - 1 - i, b - 1, 1, Math.max(0, Math.round((w / 2 - i) * 0.6))); }
        px(x, RR.goldHi, a, b + h, w, 1); });
      px(x, '#000', 150, 15, 20, 20); px(x, '#bfe9d6', 151, 16, 18, 18); if (S.pepe) x.drawImage(S.pepe, 150, 15, 20, 20);
      x.fillStyle = 'rgba(255,240,180,.07)'; x.beginPath(); x.moveTo(140, 41); x.lineTo(118, 96); x.lineTo(202, 96); x.lineTo(180, 41); x.fill(); return; }
    if (n === 2) { /* tall gallery skylight: square-paned roof light, daylight sky + drifting cloud, gold sash bars, light shaft */
      px(x, '#000', 128, 4, 64, 38); px(x, RR.gold, 129, 4, 62, 37); px(x, RR.sky, 131, 5, 58, 34); px(x, '#c9f2ff', 131, 5, 58, 8);
      var cx2 = reduced() ? 150 : 131 + Math.floor(t / 300) % 70; px(x, '#ffffff', cx2, 15, 12, 3); px(x, '#ffffff', cx2 + 3, 13, 6, 2);
      for (i = 131; i < 189; i += 14) px(x, RR.goldLo, i + 13, 5, 2, 34); px(x, RR.goldLo, 131, 21, 58, 2);
      px(x, RR.goldHi, 129, 4, 62, 1); px(x, 'rgba(255,255,255,.35)', 133, 7, 2, 10); px(x, 'rgba(255,255,255,.35)', 147, 7, 2, 10);
      x.fillStyle = 'rgba(220,245,255,.09)'; x.beginPath(); x.moveTo(131, 41); x.lineTo(112, 96); x.lineTo(208, 96); x.lineTo(189, 41); x.fill(); return; }
    /* 3: paned night window: four sashes, moon, stars, pixel skyline with a lit orange B tower, velvet tie-backs */
    px(x, '#000', 126, 5, 68, 37); px(x, RR.gold, 127, 6, 66, 35); px(x, '#0d0b2a', 129, 7, 62, 32); px(x, '#1d1850', 129, 25, 62, 14);
    px(x, '#fff1a8', 176, 10, 7, 7); px(x, '#0d0b2a', 179, 10, 4, 5);
    [[134, 11], [146, 9], [162, 13], [140, 19], [170, 20], [154, 17]].forEach(function (q, k) { if (tw && k % 2) return; px(x, '#ffffff', q[0], q[1], 1, 1); });
    [[129, 30, 8], [137, 27, 6], [143, 32, 9], [152, 22, 7], [159, 29, 8], [167, 26, 6], [173, 31, 9], [182, 28, 9]].forEach(function (b, k) { px(x, k === 3 ? '#3a2a10' : '#05040f', b[0], b[1], b[2], 39 - b[1]); for (j = b[1] + 2; j < 38; j += 3) if ((j + k) % 2) px(x, k === 3 ? '#f7931a' : '#ffd36a', b[0] + 2, j, 1, 1); });
    px(x, '#f7931a', 154, 19, 3, 3);
    px(x, RR.gold, 159, 7, 2, 32); px(x, RR.gold, 129, 22, 62, 2); px(x, RR.goldHi, 127, 6, 66, 1); px(x, RR.goldLo, 125, 41, 70, 2);
    px(x, RR.velvet, 122, 5, 5, 34); px(x, RR.velvet, 193, 5, 5, 34); px(x, RR.velvetHi, 123, 5, 1, 34); px(x, RR.gold, 121, 26, 7, 2); px(x, RR.gold, 192, 26, 7, 2); }
  function draw(t) { var x = S.x; if (!x) return; if (window.V2Sharp) V2Sharp.begin(x, S.k); else x.imageSmoothingEnabled = false; /* scene-sharp: logical units at k x */
    roomBg(x, t);
    S.hits = []; if (LAY) wallsLayout(x, t); else { var walls = [[8, 14], [8, 52], [222, 14], [222, 52]], k = 0; /* 4 gallery walls x 5 framed cards = the same 20 stash pieces as the old shelves */
    walls.forEach(function (s) { for (var i = 0; i < 5; i++) { var it = S.items[k++], ix = s[0] + 2 + i * 18, iy = s[1]; if (!it) continue; var sel = S.sel && S.sel.gid === it.gid, hov = S.hov && S.hov.gid === it.gid, lift = sel || hov ? (reduced() ? 3 : 3 + (Math.floor(t / 200) % 2)) : 0;
        if (!reduced() && !lift) { x.fillStyle = 'rgba(255,236,170,.07)'; x.fillRect(ix - 2, iy - 6, 20, 30); } /* spotlight */
        frameCard(x, it, ix, iy, lift, t);
        if (it.on != null) { px(x, '#000', ix + 11, iy + 12 - lift, 6, 6); px(x, '#3ddc84', ix + 12, iy + 13 - lift, 4, 4); } /* worn = green dot (the old EQP tag) */
        if (sel) { x.strokeStyle = RR.goldHi; x.lineWidth = 1; x.strokeRect(ix - 3.5, iy - lift - 3.5, 23, 25); }
        S.hits.push({ x: ix - 1, y: iy - 4, w: 18, h: 26, it: it }); } }); }
    if (!(LAY ? (S.all || []) : S.items).length) plate(x, 'EMPTY WALLS: SPIN THE PEPE WHEEL', 160, 76, 5);
    if (S.more > 0 && !LAY) plate(x, '+' + S.more + ' MORE', 290, 46, 5);
    var pn = pendAll(); if (pn > (S.pend0 || 0)) spinNow(2400); if (S.tot0 != null && S.total > S.tot0) spinNow(2400); S.pend0 = pn; S.tot0 = S.total;
    var dt = Math.min(100, Math.max(0, t - (S.wt || t))); S.wt = t; if (!reduced()) S.ang += dt * (t < S.spinUntil ? 0.012 : pn ? 0.002 : 0);
    wheel(x, WH.x, WH.y, WH.r, S.ang, S.pepe); plate(x, 'PEPE WHEEL \u00b7 TAP TO ROLL', WH.x + 8, 148, 4); drawAmb(x, t); danBody(x, DAN.x, DAN.y, t);
    bubbleTxt(x, S.say || lineAt(S.line), DAN.x + 6, 95);
    plate(x, 'YOUR GEAR: ' + S.total + ' PIECES \u00b7 ' + S.free + ' UNWORN', 104, 149, 5);
    if (!reduced() && !S.off) S.raf = requestAnimationFrame(function (n) { if (n - (S.lt || 0) > 3200) { S.lt = n; S.line++; S.say = null; } draw(n); }); else S.raf = 0; }
  function hang(x, t, it, ix, iy, slot) { var sel = S.sel && S.sel.gid === it.gid, hov = S.hov && S.hov.gid === it.gid, lift = sel || hov ? (reduced() ? 3 : 3 + (Math.floor(t / 200) % 2)) : 0;
    if (!reduced() && !lift) { x.fillStyle = 'rgba(255,236,170,.07)'; x.fillRect(ix - 2, iy - 6, 20, 30); }
    frameCard(x, it, ix, iy, lift, t); if (it.on != null) { px(x, '#000', ix + 11, iy + 12 - lift, 6, 6); px(x, '#3ddc84', ix + 12, iy + 13 - lift, 4, 4); }
    if (sel) { x.strokeStyle = RR.goldHi; x.lineWidth = 1; x.strokeRect(ix - 3.5, iy - lift - 3.5, 23, 25); }
    S.hits.push({ x: ix - 1, y: iy - 4, w: 18, h: 26, it: it, slot: slot }); }
  function wallsLayout(x, t) { var i;
    if (LAY === 'a') { var by = bySlot(); SLOT_ORDER.forEach(function (sl, n) { var G = by[sl], ix = (n < 3 ? 14 : 228) + (n % 3) * 30, iy = 22; plate(x, SLOT_SHORT[sl], ix + 8, 16, 4);
        if (G.length) { hang(x, t, G[0], ix, iy, sl); plate(x, '\u00d7' + G.length, ix + 8, 52, 5); } else { px(x, '#000', ix - 1, iy - 1, 18, 20); px(x, '#1c0f33', ix, iy, 16, 18); plate(x, '\u00d70', ix + 8, 52, 5); } });
      plate(x, 'BEST OF EACH SLOT', 53, 72, 4); plate(x, 'FULL SET IN THE BINDER \u25bc', 267, 72, 4); return; }
    var F = featured(LAY === 'b' ? 8 : 4), pos = LAY === 'b' ? [[12, 18], [34, 18], [56, 18], [78, 18], [226, 18], [248, 18], [270, 18], [292, 18]] : [[26, 26], [62, 26], [240, 26], [276, 26]];
    F.forEach(function (g, n) { hang(x, t, g, pos[n][0], pos[n][1]); });
    plate(x, LAY === 'b' ? 'FEATURED' : 'ON SHOW', 53, 58, 5); plate(x, LAY === 'b' ? 'ALL GEAR: RACK \u25bc' : 'ALL GEAR: DRAWERS \u25bc', 267, 58, 4); }
  function cardBtn(g) { var t = tierOfG(g); return '<button type="button" class="rr-card t' + t + (S.sel && S.sel.gid === g.gid ? ' sel' : '') + '" data-ggid="' + esc(g.gid) + '" title="' + esc(g.label || g.item) + '"><span class="rr-nm">' + esc(String(g.label || g.item)).slice(0, 14) + '</span><canvas width="16" height="16" data-gic="' + esc(g.item) + '"></canvas>' + (g.on != null ? '<i class="rr-on"></i>' : '') + '</button>'; }
  function rackHtml() { var L = S.all || [], n = Math.min(L.length, S.rn || 60); if (!L.length) return '';
    return '<div class="rr-rackh small">🃏 Card rack · ' + L.length + ' piece' + (L.length === 1 ? '' : 's') + ' · swipe ▸ (filters above narrow it)</div><div class="rr-rack" id="rrRack">' + L.slice(0, n).map(cardBtn).join('') + (n < L.length ? '<button type="button" class="q rr-rmore" id="rrRmore">+' + (L.length - n) + ' more ▸</button>' : '') + '</div>'; }
  function rack(box) { var el = box.querySelector('.rr-rackw'); if (!el) { box.insertAdjacentHTML('beforeend', '<div class="rr-rackw"></div>'); el = box.querySelector('.rr-rackw'); } var sx = el.querySelector('.rr-rack'); sx = sx ? sx.scrollLeft : 0; el.innerHTML = rackHtml(); var r = el.querySelector('.rr-rack'); if (r) r.scrollLeft = sx; bindGallery(el);
    var m = el.querySelector('#rrRmore'); if (m) m.onclick = function () { S.rn = (S.rn || 60) + 120; rack(box); }; }
  function render(w) { var U = window.V2UI, R = window.V2Render, box = document.getElementById('shopScene'); if (!box || !U || !R || !w) return;
    var ME = U.ME, items = (w.itemList || []).filter(function (g) { return g.owner === ME; }).sort(function (a, b) { return (b.tier || 0) - (a.tier || 0) || (String(a.gid) < String(b.gid) ? -1 : 1); });
    S.total = items.length; S.free = items.filter(function (g) { return g.on == null; }).length; var SL = (window.V2LairQoL ? V2LairQoL.apply(items) : items.filter(function (g) { return g.on == null; }).concat(items.filter(function (g) { return g.on != null; }))); S.all = SL; S.items = LAY ? [] : SL.slice(0, 20); S.more = Math.max(0, SL.length - 20); /* tonight bundle: Lair chip strip narrows/sorts the shelves */
    (LAY ? (LAY === 'a' ? SLOT_ORDER.map(function (sl) { return bySlot()[sl][0]; }).filter(Boolean) : featured(8)) : S.items).forEach(function (g) { if (!S.icons[g.item]) try { S.icons[g.item] = R.iconCanvas(g.item); } catch (e) { } });
    var c = box.querySelector('canvas'); if (!c) { box.innerHTML = '<canvas width="' + W + '" height="' + H + '" role="img" aria-label="The Rare Room: your gear framed on the gallery walls, the try-on mirror, and Captain Dan at the Pepe Wheel (tap the wheel to roll for gear)"></canvas><div class="shop-hint small">👇 Your gear hangs on these walls · tap a card to try it on</div>'; c = box.querySelector('canvas');
      if (window.IntersectionObserver) { new IntersectionObserver(function (es) { var off = !es[0].isIntersecting; if (off === S.off) return; S.off = off; if (!off && !S.raf) draw(performance.now()); else if (off) { cancelAnimationFrame(S.raf); S.raf = 0; } }, { threshold: 0 }).observe(c); } /* lair speed (owner Oct 20 2026): no redraw loop while the scene is off screen */
      c.addEventListener('mousemove', function (e) { c.style.cursor = onWheel(c, e) || hitAt(c, e) ? 'pointer' : 'default'; var h = hitAt(c, e); var g = h ? h.it : null; if ((g && g.gid) !== (S.hov && S.hov.gid)) { S.hov = g; if (g) say(g); if (reduced()) draw(performance.now()); } });
      c.addEventListener('dblclick', function () { var wb = document.getElementById('scWear'); if (wb && !wb.disabled) wb.click(); }); /* quick wins: double-tap a shelf piece to wear it (same free equip op) */
      c.addEventListener('mouseleave', function () { S.hov = null; if (reduced()) draw(performance.now()); });
      c.addEventListener('click', function (e) { var r = c.getBoundingClientRect(), mx = (e.clientX - r.left) * W / r.width, my = (e.clientY - r.top) * H / r.height;
        if (onWheel(c, e)) { openWheel(); return; } var h = S.hits.filter(function (q) { return mx >= q.x && mx < q.x + q.w && my >= q.y && my < q.y + q.h; })[0]; if (!h) return;
        if (h.slot) { S.bs = h.slot; S.bp = 0; } S.sel = h.it; say(h.it); mirrorPet(window.V2UI.world()); counter(); draw(performance.now()); if (window.V2LairQoL) V2LairQoL.viewed(h.it); }); }
    if (LAY === 'b') rack(box); var mo = box.querySelector('.shop-more'); if (S.more > 0 && !LAY) { if (!mo) { box.insertAdjacentHTML('beforeend', '<a href="#" class="shop-more small"></a>'); mo = box.querySelector('.shop-more'); mo.onclick = function (e) { e.preventDefault(); var d = document.querySelector('details.shop-all'); if (d) { d.open = true; d.scrollIntoView({ block: 'start' }); } }; } mo.textContent = '+' + S.more + ' more in your stash: see them all ▸'; } else if (mo) mo.remove();
    mirrorPet(w); ambPets(w); counter(); clearance(w); if (window.V2LairQoL) V2LairQoL.mount(w);
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
  function say(g) { } /* Dan keeps his own lines at the wheel; the price-tag sign shows the piece */
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
    if (S.moodFor !== g.gid + ':' + S.pet) { S.moodFor = g.gid + ':' + S.pet; }
    /* sticky-feed-bar (owner 9:30 PM CT): the piece info (name, slot, tier, gear-damage diff vs worn, Wear / Take off) is a price-tag sign INSIDE the shop scene. */
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
    var wb = document.getElementById('scWear'); if (wb) wb.onclick = function () { if (U.viewOnly && U.viewOnly()) return U.confirmPlans('Equip', [{}]); var c2 = V.equipCheck(U.world(), ME, P.id, g.item); if (!c2.ok) return; if (window.V2LairQoL && V2LairQoL.remember) V2LairQoL.remember(P.id, [{ sl: sl, gid: c2.gid, prev: cur ? cur.gid : null }]); /* Undo also after a single Wear */ op(P.id, sl, c2.gid, 'Equipped ' + (it.label || '') + ' on #' + P.id); };
    var ob = document.getElementById('scOff'); if (ob) ob.onclick = function () { if (U.viewOnly && U.viewOnly()) return U.confirmPlans('Equip', [{}]); op(g.on, sl, null, 'Took ' + (it.label || '') + ' off #' + g.on); };
    bindRoll(el); rrBind(el); }
  function rrBind(el) { bindDoor(el); bindGallery(el); bindBar(el); }
  /* LAIR UX (quick wins 2026-10-19, display + the same free local equip op; no rule change): live try-on (the chosen pet now -> wearing the piece),
   * a big gear-damage readout (⚔ 12 -> 15 +3), WEARING NOW tag on what it has on, 'Wear best' per slot, double-tap to wear, a poof when gear changes,
   */
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
    return wheelPanel(w, pets) + species; }
  /* THE PEPE WHEEL panel (Rare Room; was the doorway panel until remove-dan, Oct 21 2026): roll gear pet-first. The crew list shows every living pet's six slots (open / locked) and the real odds
   * (the rule picks one of the pet's OPEN slots from block hash + tx, so each open slot is 1 in N). 'Roll my best pet' = most open slots, ties to the
   * lowest #. Every button builds the SAME pet:roll:ID tag at the SAME 345 XCPETS through the same confirm + wasted-burn guard. No rule change. */
  var CREW_N = 8;
  function crewSort(pets) { return pets.filter(function (p) { return !p.released && (p.openSlots || []).length; }).sort(function (a, b) { return (b.openSlots || []).length - (a.openSlots || []).length || a.id - b.id; }); }
  function pendAll() { var U = window.V2UI, f = window.UXB && UXB.pendingFor; if (!U || !f) return 0; try { return U.mine(U.world()).reduce(function (s, p) { return s + (+f(p.id) || 0); }, 0); } catch (e) { return 0; } }
  function openWheel() { var d = document.getElementById('pepeWheel'); if (!d) return; d.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); d.classList.remove('rr-flash'); void d.offsetWidth; d.classList.add('rr-flash'); spinNow(900); }
  function wheelPanel(w, pets) { var V = window.V2Rules, L = crewSort(pets), best = L[0], pend = window.UXB && UXB.pendingFor ? UXB.pendingFor : null, n = S.crewN || CREW_N;
    if (!L.length) return '<div class="rr-door"><div class="rr-dh">🎡 The Pepe Wheel · Roll for gear</div><p class="small">No living pet with an open slot yet. Slots open as pets grow (age and days fed).</p></div>';
    var row = function (p) { var os = p.openSlots || [], k = os.length, pn = pend ? pend(p.id) : 0;
      return '<div class="rr-crew"><canvas class="rr-cc" width="32" height="32" data-cpid="' + p.id + '"></canvas><div class="rr-cm"><b>#' + p.id + ' ' + esc(String(p.name || '')).slice(0, 16) + '</b> <small>' + esc(V.speciesLabel(p.species)) + '</small><div class="rr-chips">' +
        SLOT_ORDER.map(function (sl) { var op = os.indexOf(sl) >= 0; return '<span class="rr-chip' + (op ? ' op' : '') + '" title="' + (op ? 'open' : 'locked') + '">' + esc(lword(sl).split(' \u00b7 ')[1] || lword(sl)) + (op ? '' : ' 🔒') + '</span>'; }).join('') +
        '</div><small class="rr-odds">Each open slot: 1 in ' + k + ' (' + Math.round(100 / k) + '%)' + (pn ? ' · 🎁 ' + pn + ' on the way' : '') + '</small></div><button type="button" class="btn ico-flame rr-roll" data-rpid="' + p.id + '">🎲 345</button></div>'; };
    return '<div class="rr-door" id="pepeWheel"><div class="rr-dh">🎡 The Pepe Wheel · Roll for gear</div><p class="small rr-dsub">One roll = 345 XCPETS = one random piece in a random <b>open</b> slot of the pet you pick. Same burn as always.</p>' +
      '<button type="button" class="btn ico-flame rr-best" data-rpid="' + best.id + '">🎲 Roll my best pet · 345 <span class="cost">#' + best.id + ' ' + esc(String(best.name || '')).slice(0, 14) + ' has the most open slots (' + best.openSlots.length + ')</span></button>' +
      '<div class="rr-ch">Or pick from your crew</div>' + L.slice(0, n).map(row).join('') + (L.length > n ? '<button type="button" class="q rr-more" id="rrMore">Show ' + Math.min(CREW_N, L.length - n) + ' more (' + (L.length - n) + ' left)</button>' : '') + '</div>'; }
  function bindDoor(el) { var U = window.V2UI, V = window.V2Rules, w = U.world(); el.querySelectorAll('[data-rpid]').forEach(function (b) { b.onclick = function () { var id = +b.dataset.rpid; U.confirmPlans('Gear roll for #' + id, [{ tag: V.buildTag('roll', { petId: id }), amount: V.COSTS.roll }]); }; });
    var m = el.querySelector('#rrMore'); if (m) m.onclick = function () { S.crewN = (S.crewN || CREW_N) + CREW_N; counter(); };
    el.querySelectorAll('canvas[data-cpid]').forEach(function (c) { var P = w.byId[+c.dataset.cpid]; if (P) put(c, framesFor(w, P, V.wornOf(w, P.id).map(function (x) { return x.item; }))); }); }
  /* RARE ROOM GALLERY: your gear as framed cards grouped by the six slots (rarest first, 12 per slot; the full list stays in 'Your stash · all your gear').
   * Tap a card = the same select/try-on as tapping it on the wall. */
  var GAL_N = 12;
  function gallery(w) { if (LAY === 'a') return binder(); if (LAY === 'c') return drawers(); if (LAY === 'b') return ''; return gallery0(w); }
  function legend() { return '<div class="rr-leg small"><i class="t0"></i>Common <i class="t1"></i>Uncommon <i class="t2"></i>Rare <i class="t3"></i>Legendary · green dot = worn</div>'; }
  function binder() { var by = bySlot(), L = S.all || []; if (!L.length) return ''; var sl = S.bs || SLOT_ORDER.filter(function (q) { return by[q].length; })[0], G = by[sl] || [], per = window.innerWidth < 500 ? 9 : 12, pages = Math.max(1, Math.ceil(G.length / per)), pg = Math.min(S.bp || 0, pages - 1);
    return '<div class="rr-gal rr-binder" id="rrGallery"><div class="rr-dh">📒 Your Binder · ' + L.length + ' pieces</div>' + legend() + '<div class="rr-tabs">' + SLOT_ORDER.map(function (q) { return '<button type="button" class="q rr-tab' + (q === sl ? ' on' : '') + '" data-bslot="' + q + '">' + esc(lword(q).split(' · ').pop()) + ' <b>' + by[q].length + '</b></button>'; }).join('') + '</div>' +
      '<div class="rr-page">' + (G.length ? G.slice(pg * per, pg * per + per).map(cardBtn).join('') : '<span class="small muted">Empty page. Spin the Pepe Wheel: 🎲</span>') + '</div>' +
      '<div class="rr-pager"><button type="button" class="q" data-bpg="-1"' + (pg ? '' : ' disabled') + '>◀ Flip</button><span class="small">Page ' + (pg + 1) + ' of ' + pages + '</span><button type="button" class="q" data-bpg="1"' + (pg < pages - 1 ? '' : ' disabled') + '>Flip ▶</button></div></div>'; }
  function drawers() { var by = bySlot(), L = S.all || []; if (!L.length) return ''; var h = '<div class="rr-gal rr-drawers" id="rrGallery"><div class="rr-dh">🗄️ Gear cabinet · ' + L.length + ' pieces</div>' + legend() + '<div class="rr-cab">';
    SLOT_ORDER.forEach(function (q) { var G = by[q], tc = [0, 0, 0, 0]; G.forEach(function (g) { tc[tierOfG(g)]++; }); h += '<button type="button" class="rr-drw' + (S.dr === q ? ' on' : '') + '" data-drw="' + q + '"><span class="rr-knob"></span><span class="rr-dl">' + esc(lword(q).split(' · ').pop()) + '</span><b>' + G.length + '</b><span class="rr-tb">' + tc.map(function (c, k) { return c ? '<i class="t' + k + '" style="flex:' + c + '"></i>' : ''; }).join('') + '</span></button>'; });
    h += '</div>'; if (S.dr) { var G = by[S.dr], n = S.dn || 24; h += '<div class="rr-open"><div class="rr-rh">' + esc(lword(S.dr)) + ' · ' + G.length + ' · drawer open</div><div class="rr-cards">' + (G.length ? G.slice(0, n).map(cardBtn).join('') : '<span class="small muted">Empty drawer. Spin the Pepe Wheel: 🎲</span>') + '</div>' + (n < G.length ? '<button type="button" class="q" data-drmore="1">Show more (' + (G.length - n) + ' left)</button>' : '') + '</div>'; }
    return h + '</div>'; }
  function gallery0(w) { var V = window.V2Rules, ME = window.V2UI.ME, L = (w.itemList || []).filter(function (g) { return g.owner === ME; }); if (!L.length) return '';
    var by = {}; L.forEach(function (g) { var it = (V.GEAR_BY_ID || {})[g.item], sl = (it && it.slot) || g.slot; if (sl === 'weapon') sl = 'hand'; (by[sl] = by[sl] || []).push(g); });
    var h = '<div class="rr-gal" id="rrGallery"><div class="rr-dh">🖼️ Your Gallery · ' + L.length + ' piece' + (L.length === 1 ? '' : 's') + '</div><div class="rr-leg small"><i class="t0"></i>Common <i class="t1"></i>Uncommon <i class="t2"></i>Rare <i class="t3"></i>Legendary · green dot = worn</div>';
    SLOT_ORDER.forEach(function (sl) { var G = (by[sl] || []).sort(function (a, b) { return tierOfG(b) - tierOfG(a) || (a.on == null ? -1 : 1); });
      h += '<div class="rr-row"><div class="rr-rh">' + esc(lword(sl)) + ' · ' + G.length + (G.length > GAL_N ? ' <a href="#" class="rr-all" data-all="1">See all ▸</a>' : '') + '</div><div class="rr-cards">' +
        (G.length ? G.slice(0, GAL_N).map(function (g) { var t = tierOfG(g); return '<button type="button" class="rr-card t' + t + (S.sel && S.sel.gid === g.gid ? ' sel' : '') + '" data-ggid="' + esc(g.gid) + '" title="' + esc(g.label || g.item) + '"><span class="rr-nm">' + esc(String(g.label || g.item)).slice(0, 14) + '</span><canvas width="16" height="16" data-gic="' + esc(g.item) + '"></canvas>' + (g.on != null ? '<i class="rr-on"></i>' : '') + '</button>'; }).join('') : '<span class="small muted">Empty wall. Spin the Pepe Wheel: 🎲</span>') + '</div></div>'; });
    return h + '</div>'; }
  function bindGallery(el) { var U = window.V2UI, R = window.V2Render, w = U.world(); el.querySelectorAll('canvas[data-gic]').forEach(function (c) { var ic = S.icons[c.dataset.gic]; if (!ic) try { ic = S.icons[c.dataset.gic] = R.iconCanvas(c.dataset.gic); } catch (e) { } if (ic) c.getContext('2d').drawImage(ic, 0, 0, 16, 16); });
    el.querySelectorAll('[data-ggid]').forEach(function (b) { b.onclick = function () { var g = w.items[b.dataset.ggid]; if (!g) return; S.sel = g; say(g); if (window.V2LairQoL) V2LairQoL.viewed(g); mirrorPet(w); counter(); draw(performance.now()); var sc = document.getElementById('shopScene'); if (sc && sc.scrollIntoView) sc.scrollIntoView({ behavior: 'smooth', block: 'start' }); }; });
    el.querySelectorAll('[data-bslot]').forEach(function (b) { b.onclick = function () { S.bs = b.dataset.bslot; S.bp = 0; counter(); }; });
    el.querySelectorAll('[data-bpg]').forEach(function (b) { b.onclick = function () { S.bp = Math.max(0, (S.bp || 0) + +b.dataset.bpg); counter(); }; });
    el.querySelectorAll('[data-drw]').forEach(function (b) { b.onclick = function () { S.dr = S.dr === b.dataset.drw ? null : b.dataset.drw; S.dn = 24; counter(); }; });
    el.querySelectorAll('[data-drmore]').forEach(function (b) { b.onclick = function () { S.dn = (S.dn || 24) + 48; counter(); }; });
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
  function op(pid, slot, gid, msg) { var U = window.V2UI, St = U.S(); St.ops.push({ kind: 'equip', owner: U.ME, petId: pid, slot: slot, gid: gid, block_index: St.tip }); U.save(); S.poofT = performance.now(); S.moodFor = null; U.render(); U.toast(esc(msg) + ' (free)'); }

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
    '.rr-flash{animation:rrFlash 1.2s ease-out 1}@keyframes rrFlash{0%{box-shadow:0 0 0 2px #000,0 0 0 8px #fff1a8}100%{box-shadow:0 0 0 2px #000,4px 4px 0 2px #000}}@media (prefers-reduced-motion:reduce){.rr-flash{animation:none}}' +
    '.rr-rackw{margin:8px 0 0;padding:8px;background:#1c0f33;border:3px solid #e8b84a;box-shadow:0 0 0 2px #000}.rr-rackh{color:#fff1a8;font-weight:700;margin:0 0 4px}.rr-rack{display:flex;gap:10px;overflow-x:auto;padding:8px 6px 12px;scroll-snap-type:x proximity}.rr-rack .rr-card{flex:0 0 82px;scroll-snap-align:start}.rr-rmore{flex:0 0 auto;align-self:center}' +
    '.rr-tabs{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0}.rr-tab{min-height:36px}.rr-tab.on{background:#e8b84a;color:#140f24}.rr-page{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:10px;background:#f6efdc22;border:3px dashed #8a5a12;min-height:240px}.rr-pager{display:flex;justify-content:space-between;align-items:center;margin-top:6px}' +
    '.rr-cab{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.rr-drw{display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 4px;background:#5a2e12;border:3px solid #000;box-shadow:inset 0 0 0 2px #8a5a12;color:#fff1a8;cursor:pointer;min-height:64px}.rr-drw.on{background:#8a5a12}.rr-drw b{font-size:15px}.rr-knob{width:14px;height:5px;background:#e8b84a;border:1px solid #000}.rr-dl{font-size:11px;font-weight:700}.rr-tb{display:flex;width:90%;height:5px;border:1px solid #000}.rr-tb i{display:block}.rr-tb .t0{background:#9aa3b5}.rr-tb .t1{background:#4fd18b}.rr-tb .t2{background:#4f9dff}.rr-tb .t3{background:#ffc93c}.rr-open{margin-top:8px}' +
    '@media (max-width:520px){.rr-page{grid-template-columns:repeat(3,1fr);gap:8px;padding:6px}.rr-cab{grid-template-columns:repeat(2,1fr)}}' +
    '@media (max-width:520px){.rr-cards{grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:8px}.rr-chip{font-size:10px}.rr-crew{flex-wrap:wrap}.rr-roll{width:100%}}';
    (document.head || document.documentElement).appendChild(rs); }
  window.V2Shop = { drawWheel: wheel, LINES: LINES, DANK: DANK, lineAt: lineAt, setPool: setPool, active: function (g) { return (ACT[g] || []).slice(); }, spin: spinNow, openWheel: openWheel, rackPick: rackPick, clearance: clearance, render: render, select: function (g) { S.sel = g; say(g); mirrorPet(window.V2UI.world()); counter(); draw(performance.now()); }, hover: function (g) { S.hov = g; if (g) say(g); draw(performance.now()); }, _state: function () { return S; }, refreshRoll: refreshRoll, dmg: dmg, op: op };
})();
