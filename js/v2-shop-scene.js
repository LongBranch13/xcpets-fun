/* XCPETS Spam City Games card shop scene (branch card-shop-scene, owner 1:11 AM CT Oct 24 2026: "I want to click around on the card shop to do the actions
 * or open the binder. make it more fun"). An animated pixel canvas (320x180 logical, V2Sharp scaling like the motel / the Lair) with clickable stations.
 * DISPLAY ONLY: every station opens an EXISTING flow in js/v2-sales.js (V2Sales.scene: buy / sellPick / sell / tab) or js/v2-gift.js (V2Gift.picker / gift).
 * This file never composes, signs or sends anything. The tabs under the scene stay as the fallback. Holo foil = Mythic-stage pets only (owner 1:12 AM CT).
 * Pauses off screen and in hidden tabs; prefers-reduced-motion = one still frame (clicks still work). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var root = $('shScene'), cv = $('csCanvas'); if (!root || !cv || !cv.getContext) return;
  var W = 320, H = 180, RM = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function reduced() { return !!RM.matches || /[?&]csStill=1/.test(location.search); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function sfx(k) { try { if (window.V2Sfx && V2Sfx[k]) V2Sfx[k](); } catch (e) { } }
  var SC = function () { return window.V2Sales && V2Sales.scene; };
  function ready() { var s = SC(); return !!(s && s.ready); }
  function D() { var s = SC(); try { return s && s.ready ? s.data() : null; } catch (e) { return null; } }
  function myth(p) { return !!p && (p.stage >= 5 || !!p.mythicCare); }
  function toast(h) { var s = SC(); if (s && s.toast) return s.toast(h); var t = $('toasts'); if (!t) return; var d = document.createElement('div'); d.className = 'toast'; d.innerHTML = h; t.appendChild(d); setTimeout(function () { d.remove(); }, 5000); }
  function wait() { toast('The shop is still opening (reading the chain). One moment.'); }

  /* ---- art */
  var IMG = {}; function img(src) { if (!IMG[src]) { var i = new Image(); i.onload = function () { kick(); }; i.src = src; IMG[src] = i; } return IMG[src].complete && IMG[src].naturalWidth ? IMG[src] : null; }
  function spImg(p) { var s = String((p && p.species) || 'pepe').replace(/^hyb3?:/, '').split(':')[0].replace(/[^a-z]/g, '') || 'pepe'; return img('img/theme/sp-' + s + '.png'); }
  function px(x, c, a, b, w, h) { x.fillStyle = c; x.fillRect(a, b, w, h); }
  var TIERC = ['#9a9a9a', '#4fd18b', '#4aa3ff', '#E8B33A'], RAINBOW = ['#ff5ec7', '#ffd84a', '#5effb0', '#5ec2ff', '#c45eff'];
  var ST = { t: 0, luke: 0, cat: 0, bell: 0, wrap: 0, hover: null, said: null, saidAt: 0, catSay: 0, raf: 0, vis: true, k: 1 };

  /* stations (logical px): id, x, y, w, h, label, big = always labelled on touch screens */
  var HOT = [
    { id: 'bell', x: 150, y: 2, w: 16, h: 18, l: '🔔 Shop bell' },
    { id: 'cage0', x: 6, y: 4, w: 34, h: 38, l: 'Your pet: sell or gift' }, { id: 'cage1', x: 42, y: 4, w: 34, h: 38, l: 'Your pet: sell or gift' },
    { id: 'cage2', x: 78, y: 4, w: 34, h: 38, l: 'Your pet: sell or gift' }, { id: 'cage3', x: 114, y: 4, w: 34, h: 38, l: 'Your pet: sell or gift' },
    { id: 'case0', x: 12, y: 56, w: 29, h: 44, l: 'Glass case' }, { id: 'case1', x: 43, y: 56, w: 29, h: 44, l: 'Glass case' }, { id: 'case2', x: 74, y: 56, w: 29, h: 44, l: 'Glass case' },
    { id: 'case3', x: 105, y: 56, w: 29, h: 44, l: 'Glass case' }, { id: 'case4', x: 136, y: 56, w: 29, h: 44, l: 'Glass case', big: 1 },
    { id: 'luke', x: 242, y: 50, w: 50, h: 56, l: 'Luke Spam Jr.' },
    { id: 'binder', x: 178, y: 84, w: 38, h: 26, l: '📒 Open the binder', big: 1 },
    { id: 'register', x: 216, y: 80, w: 32, h: 30, l: '🏷️ List my pet', big: 1 },
    { id: 'cat', x: 292, y: 86, w: 26, h: 22, l: 'The shop cat' },
    { id: 'gift', x: 6, y: 124, w: 96, h: 52, l: '🎁 Gift Wrap Counter', big: 1 },
    { id: 'trade', x: 110, y: 130, w: 70, h: 44, l: '🔁 Trade table', big: 1 },
    { id: 'press', x: 190, y: 122, w: 70, h: 54, l: '🏭 Token Press', big: 1 }];

  function featured(d) { if (!d) return []; var L = d.listings.slice(); L.sort(function (a, b) { return (myth(b.p) - myth(a.p)) || ((b.p.tier || 0) - (a.p.tier || 0)) || ((b.S.orderBlock || 0) - (a.S.orderBlock || 0)); }); return L.slice(0, 5); }
  function cages(d) { return d && d.mine ? d.mine.slice(0, 4) : []; }

  function cardArt(x, ox, oy, p, t, i) { var m = myth(p), bc = m ? RAINBOW[Math.floor(t / 160 + i) % 5] : TIERC[p.tier || 0];
    px(x, '#000', ox - 1, oy - 1, 28, 42); px(x, bc, ox, oy, 26, 40); px(x, '#1b1b26', ox + 2, oy + 2, 22, 36); px(x, '#000a', ox + 2, oy + 2, 22, 6);
    var s = spImg(p); if (s) x.drawImage(s, ox + 3, oy + 9, 20, 20);
    px(x, '#cfe', ox + 4, oy + 31, 12, 2); px(x, '#cfe', ox + 4, oy + 34, 8, 2);
    if (m) { var sw = reduced() ? 10 : Math.floor((t / 18 + i * 13) % 60) - 14; x.save(); x.beginPath(); x.rect(ox + 2, oy + 2, 22, 36); x.clip(); x.globalAlpha = 0.45;
      for (var k = 0; k < 5; k++) px(x, RAINBOW[k], ox + sw + k * 2, oy + 2, 2, 36); x.globalAlpha = 1; x.restore();
      if (reduced() || Math.floor(t / 300 + i) % 3 === 0) { px(x, '#fff', ox + 20, oy + 5, 1, 3); px(x, '#fff', ox + 19, oy + 6, 3, 1); } if (!reduced() && Math.floor(t / 420 + i) % 4 === 1) { px(x, '#fff', ox + 5, oy + 26, 1, 3); px(x, '#fff', ox + 4, oy + 27, 3, 1); } } }
  function cardBack(x, ox, oy) { px(x, '#000', ox - 1, oy - 1, 28, 42); px(x, '#FAFAF5', ox, oy, 26, 40); for (var r = 0; r < 36; r += 4) for (var c = 0; c < 22; c += 4) px(x, (r + c) % 8 ? '#D62028' : '#8F141A', ox + 2 + c, oy + 2 + r, 4, 4);
    px(x, '#100E14', ox + 3, oy + 16, 20, 9); txt(x, 'SOON', ox + 4, oy + 18, '#E8B33A'); }
  /* 3x5 pixel font for a few labels */
  var F = { S: '111100111001111', O: '111101101101111', N: '110101101101101', L: '100100100100111', I: '111010010010111', T: '111010010010010', R: '110101110101101', A: '010101111101101', D: '110101101101110', E: '111100111100111', G: '111100101101111', F: '111100111100100', W: '101101111111101', P: '110101110100100', M: '101111111101101', Y: '101101010010010', B: '110101110101110', ' ': '000000000000000' };
  function txt(x, s, ox, oy, c) { for (var i = 0; i < s.length; i++) { var g = F[s[i]] || F[' ']; for (var k = 0; k < 15; k++) if (g[k] === '1') px(x, c, ox + i * 4 + (k % 3), oy + Math.floor(k / 3), 1, 1); } }

  function draw() { var x = cv.getContext('2d'), t = reduced() ? 0 : ST.t, d = D();
    ST.k = window.V2Sharp ? V2Sharp.fit(cv, W, H) : 1; if (window.V2Sharp) V2Sharp.begin(x, ST.k); else x.imageSmoothingEnabled = false;
    /* wall + floor */
    px(x, '#3D3640', 0, 0, W, 112); for (var i = 0; i < W; i += 40) px(x, '#2B2730', i, 0, 2, 112); px(x, '#D62028', 0, 108, W, 4);
    for (var fy = 112; fy < H; fy += 8) for (var fx = 0; fx < W; fx += 8) px(x, ((fx + fy) / 8) % 2 ? '#bdbdbd' : '#8d8d8d', fx, fy, 8, 8);
    /* sign + bell */
    var sg = img('img/shop/spam-city-sign-classic-final-2x.png'); if (sg) x.drawImage(sg, 170, 4, 142, 42);
    var sw = ST.bell > 0 ? Math.round(Math.sin(ST.t / 40) * 2 * Math.min(1, ST.bell / 300)) : 0; px(x, '#5A5A5A', 157, 2, 2, 5); px(x, '#E8B33A', 153 + sw, 7, 10, 7); px(x, '#b98a1f', 153 + sw, 13, 10, 2); px(x, '#100E14', 157 + sw * 2, 15, 2, 2);
    /* cages with your idle pets */
    var cg = cages(d); for (i = 0; i < 4; i++) { var cx = 8 + i * 36, cy = 6; px(x, '#100E14', cx - 1, cy - 1, 34, 36); px(x, '#8FD3E8', cx, cy, 32, 34); px(x, '#2a3d48', cx + 1, cy + 1, 30, 32);
      var p = cg[i]; if (p) { var s = spImg(p), bob = reduced() ? 0 : (Math.floor(t / 400 + i) % 2); if (s) { x.save(); if (!reduced() && Math.floor(t / 2600 + i * 3) % 2) { x.translate(cx * 2 + 32, 0); x.scale(-1, 1); } x.drawImage(s, cx + 4, cy + 6 - bob, 24, 24); x.restore(); } }
      else { px(x, '#3a5262', cx + 10, cy + 20, 12, 8); px(x, '#3a5262', cx + 13, cy + 16, 6, 4); }
      for (var b = 3; b < 32; b += 5) px(x, '#E8B33A', cx + b, cy, 1, 34); px(x, '#E8B33A', cx, cy + 33, 32, 2); }
    /* glass case */
    px(x, '#100E14', 7, 51, 162, 56); px(x, '#E8B33A', 8, 52, 160, 54); px(x, '#1a2630', 10, 54, 156, 50); px(x, '#D62028', 8, 46, 38, 7); txt(x, 'GLASS', 10, 47, '#FAFAF5');
    var fe = featured(d); for (i = 0; i < 5; i++) { var ox = 14 + i * 31, oy = 58; if (fe[i]) cardArt(x, ox, oy, fe[i].p, ST.t, i); else cardBack(x, ox, oy); }
    if (!reduced()) { var gl = Math.floor(ST.t / 12) % 400 - 40; if (gl > 0 && gl < 156) { x.globalAlpha = 0.25; px(x, '#fff', 10 + gl, 54, 3, 50); px(x, '#fff', 15 + gl, 54, 1, 50); x.globalAlpha = 1; } }
    x.globalAlpha = 0.12; px(x, '#8FD3E8', 10, 54, 156, 50); x.globalAlpha = 1;
    /* Luke behind the counter */
    var lk = img('img/shop/luke-spam-jr-240.png'), hop = ST.luke > 0 ? Math.round(Math.sin((1 - ST.luke / 500) * Math.PI) * 5) : (reduced() ? 0 : Math.floor(t / 700) % 2);
    if (lk) x.drawImage(lk, 244, 54 - hop, 48, 48);
    /* counter, binder, register, cat */
    px(x, '#100E14', 174, 103, 146, 26); px(x, '#7a4b2a', 175, 104, 145, 5); px(x, '#D62028', 175, 109, 145, 19); px(x, '#FAFAF5', 175, 116, 145, 2);
    px(x, '#100E14', 181, 91, 32, 14); px(x, '#D62028', 182, 92, 30, 12); px(x, '#8F141A', 182, 92, 4, 12); for (i = 0; i < 3; i++) px(x, '#cfcfcf', 183, 94 + i * 4, 2, 2); px(x, '#E8B33A', 192, 96, 14, 4);
    px(x, '#100E14', 219, 87, 26, 18); px(x, '#5A5A5A', 220, 88, 24, 16); px(x, '#5effb0', 222, 90, 20, 5); px(x, '#cfcfcf', 222, 97, 20, 5); px(x, '#E8B33A', 226, 82, 12, 6); txt(x, 'LIST', 227, 83, '#100E14');
    var cj = ST.cat > 0 ? Math.round(Math.sin((1 - ST.cat / 500) * Math.PI) * 8) : 0, tail = reduced() ? 0 : Math.floor(t / 300) % 2, blink = !reduced() && Math.floor(t / 180) % 23 === 0;
    var ky = 92 - cj; px(x, '#f08a24', 298, ky + 4, 12, 8); px(x, '#f08a24', 300, ky, 8, 6); px(x, '#f08a24', 300, ky - 2, 2, 2); px(x, '#f08a24', 306, ky - 2, 2, 2);
    px(x, blink ? '#c06a14' : '#100E14', 302, ky + 2, 1, blink ? 1 : 2); px(x, blink ? '#c06a14' : '#100E14', 305, ky + 2, 1, blink ? 1 : 2); px(x, '#f08a24', 310, ky + 6 - tail * 3, 2, 5 + tail * 2);
    if (ST.catSay > 0) { px(x, '#FAFAF5', 286, ky - 12, 26, 9); txt(x, 'MEOW', 287, ky - 10, '#100E14'); }
    /* gift wrap counter */
    px(x, '#100E14', 7, 127, 94, 48); px(x, '#D62028', 8, 128, 92, 46); px(x, '#E8B33A', 50, 128, 8, 46); px(x, '#E8B33A', 8, 146, 92, 6); txt(x, 'GIFT WRAP', 14, 132, '#FAFAF5');
    if (ST.wrap > 0) { var wp = 1 - ST.wrap / 900, by = 160 - Math.min(1, wp * 2) * 20; px(x, '#5ec2ff', 66, by - 6, 18, 14); if (wp > 0.4) { px(x, '#ff5ec7', 74, by - 6, 2, 14); px(x, '#ff5ec7', 66, by, 18, 2); } if (wp > 0.6) { px(x, '#ff5ec7', 70, by - 10, 4, 4); px(x, '#ff5ec7', 76, by - 10, 4, 4); }
      if (wp > 0.75) for (i = 0; i < 6; i++) px(x, RAINBOW[i % 5], 60 + ((i * 17 + Math.floor(ST.t / 30)) % 30), by - 14 - (i * 5) % 12, 2, 2); }
    else { px(x, '#5ec2ff', 66, 156, 16, 12); px(x, '#ff5ec7', 73, 156, 2, 12); px(x, '#ff5ec7', 66, 161, 16, 2); }
    /* trade table */
    px(x, '#100E14', 111, 141, 68, 14); px(x, '#7a4b2a', 112, 142, 66, 6); px(x, '#5a3420', 112, 148, 66, 6); px(x, '#5a3420', 116, 154, 4, 18); px(x, '#5a3420', 170, 154, 4, 18);
    var sh = reduced() ? 0 : Math.floor(t / 900) % 2; px(x, '#4aa3ff', 124 + sh * 3, 132, 12, 15); px(x, '#1b1b26', 126 + sh * 3, 134, 8, 11); px(x, '#4fd18b', 152 - sh * 3, 132, 12, 15); px(x, '#1b1b26', 154 - sh * 3, 134, 8, 11);
    px(x, '#FAFAF5', 139, 136, 9, 2); px(x, '#FAFAF5', 146, 134, 2, 2); px(x, '#FAFAF5', 139, 140, 9, 2); px(x, '#FAFAF5', 139, 142, 2, 2); txt(x, 'TRADE', 126, 162, '#100E14');
    /* token press (token-press, owner Oct 24 2026): an 8-bit stamping machine; it thumps when tapped, idles with blinking lights */
    var pr = ST.press > 0 ? 1 - ST.press / 800 : 0, ram = pr > 0 ? Math.round(Math.sin(Math.min(1, pr * 1.6) * Math.PI) * 12) : 0, mj = ram > 9 ? 1 : 0;
    px(x, '#100E14', 193, 129, 52, 22); px(x, '#D62028', 194, 130, 50, 20); px(x, '#8F141A', 194, 145, 50, 5); px(x, '#E8B33A', 197, 132, 44, 7); txt(x, 'PRESS', 209, 133, '#100E14');
    for (i = 0; i < 4; i++) px(x, (Math.floor(t / 300) + i) % 4 === 0 || pr > 0 ? RAINBOW[i] : '#4a2a2a', 200 + i * 11, 141, 4, 3);
    px(x, '#100E14', 196, 151, 5, 22); px(x, '#5A5A5A', 197, 151, 3, 22); px(x, '#100E14', 237, 151, 5, 22); px(x, '#5A5A5A', 238, 151, 3, 22);
    px(x, '#cfcfcf', 217, 151, 4, 3 + ram); px(x, '#100E14', 207, 154 + ram, 24, 4); px(x, '#E8B33A', 208, 154 + ram, 22, 3);
    px(x, '#100E14', 200, 170, 54, 5); px(x, '#5A5A5A', 201, 171, 52, 3); var gq = Math.floor(t / 200) % 2; px(x, '#cfcfcf', 246 + gq, 134, 6, 6); px(x, '#5A5A5A', 248 + gq, 136, 2, 2);
    var cd = pr > 0.5 ? Math.min(1, (pr - 0.5) * 2) : 0; if (cd > 0) { px(x, '#000', 236 + Math.round(cd * 14), 158 - Math.round(cd * 6), 12, 16); px(x, '#E8B33A', 237 + Math.round(cd * 14), 159 - Math.round(cd * 6), 10, 14); px(x, '#FAFAF5', 238 + Math.round(cd * 14), 160 - Math.round(cd * 6), 8, 7); }
    else { px(x, '#4fd18b', 214, 164 - mj, 10, 6); px(x, '#100E14', 216, 165 - mj, 1, 1); px(x, '#100E14', 221, 165 - mj, 1, 1); }
    /* hover glow on the canvas */
    var hv = ST.hover && HOT.filter(function (h) { return h.id === ST.hover; })[0]; if (hv) { x.globalAlpha = 0.9; x.strokeStyle = '#ffd84a'; x.lineWidth = 1; x.strokeRect(hv.x + 0.5, hv.y + 0.5, hv.w - 1, hv.h - 1); x.globalAlpha = 1; } }

  /* ---- loop: pauses off screen / hidden tab; reduced motion = still frame */
  var last = 0; function frame(n) { ST.raf = 0; var dt = last ? Math.min(100, n - last) : 16; last = n; ST.t += dt; ['luke', 'cat', 'bell', 'wrap', 'catSay', 'press'].forEach(function (k) { if (ST[k] > 0) ST[k] = Math.max(0, ST[k] - dt); });
    draw(); if (ST.vis && !document.hidden && !reduced()) ST.raf = requestAnimationFrame(frame); }
  function kick() { if (reduced()) { draw(); return; } if (!ST.raf && ST.vis && !document.hidden) { last = 0; ST.raf = requestAnimationFrame(frame); } }
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { ST.vis = es[0].isIntersecting; if (ST.vis) kick(); }).observe(cv);
  document.addEventListener('visibilitychange', kick); if (window.V2Sharp) V2Sharp.watch(function () { draw(); place(); });
  if (RM.addEventListener) RM.addEventListener('change', kick);

  /* ---- clickable layer (real buttons: keyboard, screen readers, big phone targets) */
  var hots = $('csHots');
  function place() { if (!hots) return; hots.innerHTML = HOT.map(function (h) { return '<button type="button" class="cs-hot' + (h.big ? ' cs-big' : '') + '" data-cs="' + h.id + '" aria-label="' + esc(h.l) + '" style="left:' + (h.x / W * 100) + '%;top:' + (h.y / H * 100) + '%;width:' + (h.w / W * 100) + '%;height:' + (h.h / H * 100) + '%"><span class="cs-lab">' + esc(h.l) + '</span></button>'; }).join(''); label(); }
  function label() { var d = D(), fe = featured(d), cg = cages(d); if (!hots) return;
    hots.querySelectorAll('[data-cs]').forEach(function (b) { var id = b.getAttribute('data-cs'), m, l = null;
      if ((m = /^case(\d)$/.exec(id))) { var f = fe[+m[1]]; l = f ? (myth(f.p) ? '✨ Mythic holo · ' : '') + (f.p.name || 'Pet') + ' #' + f.p.id : 'Coming soon'; }
      if ((m = /^cage(\d)$/.exec(id))) { var p = cg[+m[1]]; l = p ? (p.name || 'Pet') + ' #' + p.id + ': sell or gift' : 'Empty cage'; }
      if (l) { b.setAttribute('aria-label', l); b.querySelector('.cs-lab').textContent = l; } }); }
  place();
  hots && hots.addEventListener('mouseover', function (e) { var b = e.target.closest('[data-cs]'); ST.hover = b ? b.getAttribute('data-cs') : null; if (reduced()) draw(); });
  hots && hots.addEventListener('mouseleave', function () { ST.hover = null; if (reduced()) draw(); });
  hots && hots.addEventListener('focusin', function (e) { var b = e.target.closest('[data-cs]'); ST.hover = b ? b.getAttribute('data-cs') : null; if (reduced()) draw(); });

  var LUKE = ['Ow. I keep a shop, not a drum.', 'Mint condition. Well, mostly. The crab chewed a corner.', 'Holo foil is for Mythics only. House rules.', 'The cat runs this shop. I just wear the hat.',
    'Ring that bell one more time. I dare you.', 'Sleeves on. Fingers off the foil.', 'Every card in that binder is 100% organic pet.', 'I tried to filter spam once. Spam filtered me.',
    'Shh. The pets in the cages are napping.', 'Gift wrap is on the house. My bows are not great.', 'KEVIN looked at me again. We are fine. Probably.', 'That trade table has seen things. Good things.'];
  var li = 0; function say(s) { var b = $('shLuke'); if (b) { b.textContent = '“' + s + '”'; b.classList.remove('cs-pop'); void b.offsetWidth; b.classList.add('cs-pop'); } }

  /* ---- binder overlay: big binder, 9 sleeves a page, page flip, tap a card to flip it */
  var BP = 0, PER = 9;
  function ov(id, cls) { var m = $(id); if (!m) { m = document.createElement('div'); m.id = id; m.className = 'cs-ov ' + cls; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); document.body.appendChild(m);
      m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('[data-csclose]')) shut(m); }); } return m; }
  function shut(m) { m.classList.remove('on'); }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') document.querySelectorAll('.cs-ov.on').forEach(shut); });
  function gearList(d, p) { var V = window.V2Rules, g = []; try { g = (V.wornOf ? V.wornOf(d.W, p.id) : []) || []; } catch (e) { g = []; }
    return g.length ? g.map(function (it) { var k = it.item || it.kind || it.id, I = V.BY_ID && V.BY_ID[k]; return esc((I && I.name) || k); }).join(', ') : 'none worn'; }
  function backHtml(d, x) { var V = window.V2Rules, p = x.p, S = x.S, bl = V.breedsLeft ? V.breedsLeft(p, d.TIP + 1) : null, fam = '';
    try { fam = window.V2Render && V2Render.familyHtml && !d.preview ? V2Render.familyHtml(d.W, p, d.TIP) : ''; } catch (e) { fam = ''; }
    if (!fam) fam = '<b>Parents:</b> ' + (p.parents && p.parents.length ? p.parents.map(function (id) { return '<a href="pet.html?id=' + id + '">#' + id + '</a>'; }).join(' &amp; ') : 'none (hatched from a mint)');
    return '<div class="cs-back' + (myth(p) ? ' sh-myth' : '') + '"><div class="sh-hd"><b>' + esc(p.name || 'Pet') + '</b><i>#' + p.id + '</i></div><div class="cs-fam">' + fam + '</div>' +
      '<p><b>Breeds left:</b> ' + (bl ? bl.left + ' of ' + bl.cap : '?') + '</p><p><b>Gear:</b> ' + gearList(d, p) + '</p>' +
      (S.price != null && V.saleAmountText ? '<p class="cs-cost">Cost: ' + esc(V.saleAmountText(S.asset, S.price)) + '</p>' : '') +
      '<button type="button" class="sh-btn" data-csbuy="' + S.n + '"' + (x.buy ? '' : ' title="Not ready yet"') + '>' + (x.buy ? 'Buy' : 'Buy (wait)') + '</button> <a class="cs-link" href="pet.html?id=' + p.id + '">Pet page</a></div>'; }
  function binderHtml(d) { var L = d ? d.listings : [], pgs = Math.max(1, Math.ceil(L.length / PER)); BP = Math.max(0, Math.min(BP, pgs - 1)); var pg = L.slice(BP * PER, BP * PER + PER), s = SC();
    var sleeves = pg.map(function (x) { return '<div class="cs-sleeve" data-csn="' + x.S.n + '"><div class="cs-flip"><div class="cs-face cs-front">' + s.card(x.p, x.S) + '</div><div class="cs-face cs-rear">' + backHtml(d, x) + '</div></div></div>'; }).join('');
    for (var i = pg.length; i < PER; i++) sleeves += '<div class="cs-sleeve cs-emptys">' + (L.length ? '' : '<div class="sh-card sh-back"></div>') + '</div>';
    return '<div class="box cs-binder"><div class="cs-bhd"><h3>📒 The Binder</h3><button type="button" class="sh-btn sh-ghost" data-csclose>Close</button></div>' +
      (L.length ? '<p class="sh-hint">Tap a card to flip it. ' + L.length + ' pet' + (L.length === 1 ? '' : 's') + ' listed by other players.</p>' : '<p class="sh-hint">The binder is empty right now: the sleeves hold “Coming soon” card backs. <button type="button" class="sh-btn" data-cslist>🏷️ List my pet</button></p>') +
      '<div class="cs-spine"></div><div class="cs-page" id="csPage"><div class="cs-sleeves">' + sleeves + '</div></div>' +
      '<div class="sh-pager"><button type="button" class="sh-btn" data-csturn="-1"' + (BP ? '' : ' disabled') + ' aria-label="Previous page">◀</button> page ' + (BP + 1) + ' of ' + pgs + ' <button type="button" class="sh-btn" data-csturn="1"' + (BP < pgs - 1 ? '' : ' disabled') + ' aria-label="Next page">▶</button></div></div>'; }
  function openBinder(flipN) { if (!ready()) return wait(); var d = D(), m = ov('csBinder', 'cs-bov');
    if (flipN != null) { var ix = d.listings.map(function (x) { return x.S.n; }).indexOf(flipN); if (ix >= 0) BP = Math.floor(ix / PER); }
    m.innerHTML = binderHtml(d); m.classList.add('on'); sfx('flip'); if (flipN != null) { var sl = m.querySelector('[data-csn="' + flipN + '"]'); if (sl) setTimeout(function () { sl.classList.add('flipped'); sfx('blip'); }, reduced() ? 0 : 260); } }
  function turn(dir) { var m = $('csBinder'), pgEl = $('csPage'); if (!m) return; sfx('flip');
    var go = function () { BP += dir; m.innerHTML = binderHtml(D()); var n = $('csPage'); if (n && !reduced()) n.classList.add(dir > 0 ? 'cs-in-r' : 'cs-in-l'); };
    if (reduced() || !pgEl) return go(); pgEl.classList.add(dir > 0 ? 'cs-out-r' : 'cs-out-l'); setTimeout(go, 230); }
  document.addEventListener('click', function (e) { var t = e.target; if (!t.closest) return; var m;
    if ((m = t.closest('[data-csturn]'))) { turn(Number(m.getAttribute('data-csturn'))); return; }
    if ((m = t.closest('[data-csbuy]'))) { e.stopPropagation(); document.querySelectorAll('.cs-ov.on').forEach(shut); sfx('coin'); SC().buy(Number(m.getAttribute('data-csbuy'))); return; }
    if (t.closest('[data-cslist]')) { document.querySelectorAll('.cs-ov.on').forEach(shut); SC().sellPick(); return; }
    if ((m = t.closest('[data-cssell]'))) { shut($('csPick')); SC().sell(Number(m.getAttribute('data-cssell'))); return; }
    if ((m = t.closest('[data-cspress]'))) { shut($('csPick')); SC().press(Number(m.getAttribute('data-cspress'))); return; }
    if ((m = t.closest('[data-csgift]'))) { shut($('csPick')); giftGo([Number(m.getAttribute('data-csgift'))]); return; }
    if (t.closest('a')) return;
    if ((m = t.closest('.cs-sleeve[data-csn]'))) { m.classList.toggle('flipped'); sfx('blip'); } });

  /* ---- station actions: each one opens an existing flow */
  function giftGo(ids) { var G = window.V2Gift, go = function () { if (G && G.gift && ids) G.gift(ids); else if (G && G.picker) G.picker(); else SC().tab('gift'); };
    sfx('wrap'); if (reduced()) return go(); ST.wrap = 900; kick(); setTimeout(go, 750); }
  function cagePick(p) { var d = D(), ok = d.sellable ? d.sellable(p) : true, m = ov('csPick', 'cs-pov'), V = window.V2Rules, tk = !!(V && V.sellStep && d.W && V.sellStep(d.W, p, d.ME) === 'list'), G = !!window.V2Gift && tk, pz = !tk && SC().pressable && SC().pressable(p);
    m.innerHTML = '<div class="box cs-pick"><h3>' + esc(p.name || 'Pet') + ' #' + p.id + '</h3><div class="cs-pickrow">' + SC().card(p) + '<div><p class="sh-hint">What should ' + esc(p.name || 'this pet') + ' do?</p>' +
      '<button type="button" class="sh-btn" data-cssell="' + p.id + '"' + (ok ? '' : ' disabled title="Locked right now (fight, breed, Rug Me ad or a pending gift)"') + '>🏷️ List it</button> ' +
      '<button type="button" class="sh-btn" data-csgift="' + p.id + '"' + (G ? '' : ' disabled') + (tk ? '' : ' title="No token yet: press one first"') + '>🎁 Gift it</button> ' + (pz ? '<button type="button" class="sh-btn" data-cspress="' + p.id + '">🏭 Press its token</button> ' : '') + '<button type="button" class="sh-btn sh-ghost" data-csclose>Back</button>' + (ok ? '' : '<p class="sh-warn">This pet is locked right now, so it can’t list.</p>') + '</div></div></div>';
    m.classList.add('on'); }
  function act(id) { var d = D(), m;
    if (id === 'bell') { ST.bell = 900; sfx('bell'); say(['Ding! Welcome to Spam City Games.', 'Yes, yes, I heard the bell.', 'Ding ding. The cat hates that one.'][Math.floor(Math.random() * 3)]); return kick(); }
    if (id === 'cat') { ST.cat = 500; ST.catSay = 900; sfx('meow'); return kick(); }
    if (id === 'luke') { ST.luke = 500; sfx('blip'); say(LUKE[li++ % LUKE.length]); return kick(); }
    if (!ready()) return wait();
    if (id === 'binder') return openBinder(null);
    if (id === 'register') { sfx('coin'); return SC().sellPick(); }
    if (id === 'trade') { sfx('blip'); return SC().tab('trade'); }
    if (id === 'gift') return giftGo(null);
    if (id === 'press') { sfx('coin'); if (!reduced()) { ST.press = 800; kick(); } return setTimeout(function () { SC().pressPick(); }, reduced() ? 0 : 500); }
    if ((m = /^case(\d)$/.exec(id))) { var f = featured(d)[+m[1]]; if (!f) { sfx('blip'); toast('Coming soon: list a pet and it can show up in the glass case.'); return; } return openBinder(f.S.n); }
    if ((m = /^cage(\d)$/.exec(id))) { var p = cages(d)[+m[1]]; sfx('blip'); if (!p) { toast(d.ME ? 'An empty cage. Hatch or adopt more pets on Play.' : 'Your own pets nap here. Connect your wallet on Play, or open the shop with ?addr=your address.'); return; } return cagePick(p); } }
  root.addEventListener('click', function (e) { var b = e.target.closest('[data-cs]'); if (b) act(b.getAttribute('data-cs')); });

  document.addEventListener('v2sales:ready', function () { label(); draw(); kick(); if (location.hash === '#press') setTimeout(function () { act('press'); }, 300); });
  var sx = $('csSfx'); if (sx && window.V2Sfx && V2Sfx.toggle) sx.innerHTML = V2Sfx.toggle('cs-sfx');
  root.classList.add('cs-on'); draw(); kick();
  window.V2ShopScene = { act: act, openBinder: openBinder, _st: ST };
})();
