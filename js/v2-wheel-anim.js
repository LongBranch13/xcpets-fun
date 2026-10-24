/* XCPETS 8-bit Pepe Wheel spin reveal (branch wheel-spin-anim, owner Oct 24 2026 4:51 AM CT: "spinning the wheel should have an animation").
 * DISPLAY ONLY. The result is already decided on chain (V2Rules replay); this only REVEALS it: the wheel lands on a wedge of the result's tier and the
 * real piece is drawn in the middle. It never picks, changes or guesses anything. 96x72 canvas scaled up with pixelated steps, 12 fps:
 * ~1.9 s spin with ease-out, then a tier celebration (Common puff, Uncommon sparkles, Rare blue burst, Legendary gold fireworks) ~0.9 s.
 * Tap / click / any key skips. prefers-reduced-motion: no animation, the result shows straight away. Once per result (localStorage
 * xcpets-wspin:<key>), so a reload never replays it. Used by js/v2.js nextReveal for Pepe Wheel spins, saved spins and community gear rolls.
 * Preview: play.html?preview=wheelspin=0..3 (fake piece, nothing stored). */
(function () {
  'use strict';
  var W = 96, H = 72, FPS = 12, SPIN_F = 23, CEL_F = 11, TOTAL_F = SPIN_F + CEL_F; /* 34 frames = 2.8 s */
  var TC = ['#9aa3ad', '#4fc06b', '#3d8bff', '#ffcf3a'], TD = ['#5c636b', '#23753a', '#1b4fa6', '#b07a00'], TN = ['COMMON', 'UNCOMMON', 'RARE', 'LEGENDARY'];
  var WEDGE = [0, 1, 0, 2, 0, 1, 0, 3]; /* wedge tiers clockwise from the top; landing picks a wedge of the result's tier */
  function reduced() { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function seenKey(k) { return 'xcpets-wspin:' + k; }
  function seen(k) { try { return !!localStorage.getItem(seenKey(k)); } catch (e) { return false; } }
  function mark(k) { try { localStorage.setItem(seenKey(k), '1'); } catch (e) { } }
  function hash(s) { var h = 7; s = String(s); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
  function px(x, c, a, b, w, h) { x.fillStyle = c; x.fillRect(a | 0, b | 0, w, h); }
  function css() { if (document.getElementById('wspinCss')) return; var s = document.createElement('style'); s.id = 'wspinCss';
    s.textContent = '.wspin{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(10,4,20,.82);cursor:pointer;padding:12px;box-sizing:border-box}' +
      '.wspin .wsb{width:min(400px,100%);border:4px solid #1a1020;background:#2a0f4a;box-shadow:0 4px 0 #1a1020,0 0 0 2px #e8b84a inset;padding:10px;text-align:center;box-sizing:border-box}' +
      '.wspin h3{font-family:"Press Start 2P",ui-monospace,monospace;font-size:11px;color:#ffd166;margin:2px 0 8px;line-height:1.4;text-shadow:2px 2px 0 #000}' +
      '.wspin canvas{width:100%;aspect-ratio:4/3;image-rendering:pixelated;image-rendering:crisp-edges;display:block;background:#140a24}' +
      '.wspin .wsr{font-family:"Press Start 2P",ui-monospace,monospace;font-size:10px;line-height:1.6;color:#fff;min-height:3.4em;margin:8px 0 2px;visibility:hidden;overflow-wrap:anywhere}' +
      '.wspin .wsr.on{visibility:visible}.wspin .wsk{font-size:11px;opacity:.7;color:#efe8f6;margin-top:4px}';
    document.head.appendChild(s); }
  function wheelAt(x, cx, cy, R, ang, glow) { var i, a, s = Math.PI / 4;
    x.fillStyle = '#000'; x.beginPath(); x.arc(cx, cy, R + 3, 0, 7); x.fill(); x.fillStyle = '#e8b84a'; x.beginPath(); x.arc(cx, cy, R + 2, 0, 7); x.fill();
    for (i = 0; i < 8; i++) { a = ang + i * s - Math.PI / 2 - s / 2; x.fillStyle = (glow === i) ? '#fff' : (i % 2 ? TC[WEDGE[i]] : TD[WEDGE[i]]); if (WEDGE[i] === 3 && glow !== i) x.fillStyle = TC[3];
      x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, R, a, a + s); x.closePath(); x.fill();
      var m = a + s / 2, mx = Math.round(cx + Math.cos(m) * (R - 6)), my = Math.round(cy + Math.sin(m) * (R - 6)); px(x, WEDGE[i] === 3 ? '#fff' : '#1a1020', mx - 1, my - 1, 2, 2); }
    for (i = 0; i < 8; i++) { a = ang + i * s - Math.PI / 2 - s / 2; px(x, '#1a1020', Math.round(cx + Math.cos(a) * R) - 1, Math.round(cy + Math.sin(a) * R) - 1, 2, 2); } /* rim pegs */
    px(x, '#1a1020', cx - 8, cy - 8, 16, 16); px(x, '#4fa83a', cx - 7, cy - 7, 14, 14); px(x, '#2f7a24', cx - 7, cy + 5, 14, 2); /* Pepe hub */ }
  function pointer(x, cx, y, bob) { y += bob; px(x, '#000', cx - 5, y - 1, 10, 3); px(x, '#000', cx - 4, y + 2, 8, 2); px(x, '#000', cx - 3, y + 4, 6, 2); px(x, '#000', cx - 2, y + 6, 4, 2);
    px(x, '#d0284f', cx - 4, y, 8, 2); px(x, '#d0284f', cx - 3, y + 2, 6, 2); px(x, '#d0284f', cx - 2, y + 4, 4, 2); px(x, '#ff8fa8', cx - 3, y, 2, 1); }
  function celebrate(x, t, f, cx, cy, seed) { var i, k, a, r, c = TC[t];
    if (t === 0) { for (i = 0; i < 6; i++) { a = i * Math.PI / 3; r = 18 + f * 2; px(x, f < 6 ? '#cfd6dd' : '#7c838b', cx + Math.cos(a) * r - 1, cy + Math.sin(a) * r - 1, 3, 3); } return; }
    if (t === 1) { for (i = 0; i < 10; i++) { k = hash(seed + ':' + i); var sx = 6 + k % (W - 12), sy = 4 + (k >> 8) % (H - 16) - (f % 4); if ((f + i) % 3) { px(x, c, sx, sy, 1, 3); px(x, c, sx - 1, sy + 1, 3, 1); } } return; }
    if (t === 2) { r = 16 + f * 4; for (i = 0; i < 16; i++) { a = i * Math.PI / 8; px(x, i % 2 ? c : '#cfe2ff', cx + Math.cos(a) * r - 1, cy + Math.sin(a) * r - 1, 2, 2); }
      for (i = 0; i < 4; i++) { k = hash(seed + 'r' + i); if ((f + i) % 2) { px(x, '#fff', 8 + k % (W - 16), 6 + (k >> 9) % 30, 1, 1); } } return; }
    /* Legendary: screen flash on the first frame, then 3 gold fireworks bursting in turn + falling glitter */
    if (f === 0) { px(x, 'rgba(255,240,170,.75)', 0, 0, W, H); }
    for (k = 0; k < 3; k++) { var g = f - k * 2; if (g < 0) continue; var fx = [20, W - 20, W / 2][k], fy = [16, 18, 8][k], rr = 3 + g * 3;
      for (i = 0; i < 12; i++) { a = i * Math.PI / 6 + k; px(x, g > 6 ? '#b07a00' : (i % 3 ? '#ffcf3a' : '#fff'), fx + Math.cos(a) * rr - 1, fy + Math.sin(a) * rr - 1, 2, 2); } }
    for (i = 0; i < 14; i++) { k = hash(seed + 'g' + i); px(x, i % 2 ? '#ffcf3a' : '#fff1a8', 4 + k % (W - 8), ((k >> 7) % 40 + f * 3) % H, 1, 2); } }
  /* one result to reveal: the best piece of the batch (tier 0-3), its item icon, label and pet. extra = how many more pieces came with it. */
  function play(res, done) { done = done || function () { }; if (!res || reduced()) { done(); return; }
    css(); var t = res.legendary ? 3 : Math.max(0, Math.min(3, res.tier | 0)), cand = [], i; for (i = 0; i < 8; i++) if (WEDGE[i] === t) cand.push(i);
    var land = cand[hash(res.key || res.label) % cand.length], turns = 3, target = turns * 2 * Math.PI - land * Math.PI / 4; /* wedge `land` ends under the top pointer */
    var ov = document.createElement('div'); ov.className = 'wspin'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Pepe Wheel spin result');
    ov.innerHTML = '<div class="wsb"><h3>' + (res.title || '🎡 THE PEPE WHEEL') + '</h3><canvas width="' + W + '" height="' + H + '"></canvas><div class="wsr" aria-live="polite"></div><div class="wsk">tap to skip</div></div>';
    document.body.appendChild(ov); var c = ov.querySelector('canvas'), x = c.getContext('2d'), out = ov.querySelector('.wsr'), icon = null, f = 0, tm = null, ended = false;
    try { if (res.item && window.V2Render && V2Render.iconCanvas) icon = V2Render.iconCanvas(res.item); } catch (e) { icon = null; }
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]; }); };
    out.innerHTML = '<span style="color:' + TC[t] + '">' + TN[t] + (t === 3 ? ' ★' : '') + '</span><br>' + esc(res.label) + (res.pet ? '<br><span style="color:#c9b8e8">for ' + esc(res.pet) + '</span>' : '') + (res.extra ? '<br><span style="color:#c9b8e8">+' + res.extra + ' more</span>' : '');
    function frame() { x.imageSmoothingEnabled = false; px(x, '#140a24', 0, 0, W, H); for (var s = 0; s < 18; s++) { var k = hash('st' + s); px(x, '#3a2560', k % W, (k >> 8) % H, 1, 1); }
      var cx = W / 2, cy = 40, R = 27, p = Math.min(1, f / SPIN_F), e = 1 - Math.pow(1 - p, 3), ang = target * e, cf = f - SPIN_F;
      if (f < SPIN_F) ang = Math.round(ang / (Math.PI / 16)) * (Math.PI / 16); /* stepped: 1/32 turn per step, so it reads as 8-bit frames */
      var shake = cf >= 0 && cf < 2 && t >= 2 ? (cf ? -1 : 1) : 0;
      wheelAt(x, cx + shake, cy, R, ang, cf >= 0 && cf % 2 === 0 && cf < 6 ? land : -1);
      pointer(x, cx, cy - R - 6, f < SPIN_F && (f % 2) ? 1 : 0); /* the pointer ticks against the pegs while it spins */
      if (cf >= 0) { if (icon) { var z = cf < 2 ? 12 : 16; px(x, '#1a1020', cx - z / 2 - 1, cy - z / 2 - 1, z + 2, z + 2); px(x, TC[t], cx - z / 2, cy - z / 2, z, z); x.drawImage(icon, cx - z / 2, cy - z / 2, z, z); }
        celebrate(x, t, cf, cx, cy, res.key || res.label); out.classList.add('on'); } }
    function end() { if (ended) return; ended = true; clearInterval(tm); document.removeEventListener('keydown', key, true); if (ov.parentNode) ov.parentNode.removeChild(ov); done(); }
    function key(ev) { ev.preventDefault(); ev.stopPropagation(); end(); }
    ov.addEventListener('pointerdown', function (ev) { ev.preventDefault(); end(); }); document.addEventListener('keydown', key, true);
    frame(); tm = setInterval(function () { f++; if (f >= TOTAL_F) { end(); return; } frame(); }, 1000 / FPS); }
  /* gear batch -> the result to reveal, or null when nothing in it came from a wheel (Pepe Wheel spin, saved spin, community gear roll) or it already played */
  function fromWins(wins, w, communityName) { if (!wins || !wins.length || !w) return null; var tx = {}; (w.log || []).forEach(function (l) { if (l.gid && l.tx) tx[l.gid] = l.tx; });
    var spun = wins.filter(function (x) { var g = w.items && w.items[x.gid]; return x.community || (g && (g.wheel || g.src === 'usespin')); }); if (!spun.length) return null;
    var keys = spun.map(function (x) { return x.community ? String(x.gid) : (tx[x.gid] || '') + ':' + x.item + ':' + (x.rolledOn != null ? x.rolledOn : ''); });
    if (keys.every(seen)) return null;
    var best = spun[0]; spun.forEach(function (x) { if ((x.legendary ? 4 : x.tier || 0) > (best.legendary ? 4 : best.tier || 0)) best = x; });
    var p = best.rolledOn != null && w.byId ? w.byId[best.rolledOn] : null;
    return { key: keys[spun.indexOf(best)], keys: keys, tier: best.tier, legendary: best.legendary, label: best.label || best.item, item: best.item,
      pet: best.community ? (communityName || 'the community pet') : best.rolledOn != null ? '#' + best.rolledOn + (p && p.name ? ' ' + p.name : '') : '', extra: spun.length - 1,
      title: best.community ? '🎡 COMMUNITY GEAR ROLL' : '🎡 THE PEPE WHEEL' }; }
  function reveal(res, done) { if (!res) { if (done) done(); return; } (res.keys || [res.key]).forEach(mark); play(res, done); }
  window.V2WheelAnim = { play: play, fromWins: fromWins, reveal: reveal, seen: seen, FRAMES: TOTAL_F, FPS: FPS };
  var m = /[?&]preview=wheelspin=?(\d)?/.exec(location.search);
  if (m) { var go = function () { var t = +(m[1] || 3); play({ key: 'preview' + t, tier: Math.min(t, 2), legendary: t === 3, label: ['Hard hat', 'Hard hat', 'McDonald\'s visor', 'Pepe Cash pimp hat'][t], item: ['hard-hat', 'hard-hat', 'mcd-visor', 'pimp-hat'][t], pet: '#1234 Preview' }); };
    if (document.readyState === 'complete') setTimeout(go, 300); else window.addEventListener('load', function () { setTimeout(go, 300); }); }
})();
