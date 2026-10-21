/* XCPETS v2: LORD KEK ARRIVAL (owner Oct 20 2026 7:20 PM CT; DISPLAY ONLY, no rule change). Lord Kek (community pet #3) activates with the
 * community burns since the Wizard's Mythic already counted, so he appears grown and nobody saw his egg. This one-time scene shows it:
 * his egg wobbles and cracks, then fast-forwards through every stage he has already reached (js/kek-sprite.js art) and ends on his current stage.
 * Same frame as The Return (js/v2-return.js) and the Wizard farewell (js/v2-wizard-farewell.js): 160x90 pixel canvas x4, 30 fps, one caption at a time.
 * Plays once per player (localStorage SEEN_KEY) the first time the community pet card/panel scrolls into view; 'Replay arrival' on his card replays it;
 * Skip / Esc / tap outside closes it; reduced motion = one static frame. ?preview=kek-arrival plays it any time.
 * window.V2KekArrival = { draw, play, watch, frames, seen, SEEN_KEY, replayLink } */
(function (root) {
  'use strict';
  var W = 160, H = 90, S = 4, SEEN_KEY = 'xcpets-v2-kek-arrival-seen';
  var C = { bg: '#141a2e', bg2: '#1b2240', ink: '#1a1020', dim: '#6f7fa8', gold: '#ffc93c', gold2: '#c98a12', lapis: '#2a4fbf', cyan: '#33d6ff', sand: '#3a3020', sand2: '#2a2418' };
  var WOB = 60, CRACK = 96, OPEN = 112, PER = 42, HOLD = 90;
  function px(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
  function star(ctx, x, y, c) { px(ctx, x, y - 1, 1, 3, c); px(ctx, x - 1, y, 3, 1, c); }
  function sprite(ctx, img, x, y, s, alpha, clip) { if (!img) return; ctx.globalAlpha = alpha == null ? 1 : alpha; var d = img.data;
    for (var j = 0; j < img.height; j++) for (var i = 0; i < img.width; i++) { if (clip && !clip(i, j)) continue; var k = 4 * (j * img.width + i); if (d[k + 3] === 0) continue; if (d[k] === d[0] && d[k + 1] === d[1] && d[k + 2] === d[2]) continue;
      ctx.fillStyle = 'rgb(' + d[k] + ',' + d[k + 1] + ',' + d[k + 2] + ')'; ctx.fillRect(x + i * s, y + j * s, Math.ceil(s), Math.ceil(s)); } ctx.globalAlpha = 1; }
  var Q = [];
  function text(s, x, y, c, size) { Q.push([s, x, y, c, size]); }
  function flushText(ctx) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.lineJoin = 'round';
    Q.forEach(function (q) { var fs = q[4] >= 9 ? 32 : q[4] >= 7 ? 22 : q[4] >= 5 ? 18 : 16; ctx.font = 'bold ' + fs + 'px monospace'; var m = ctx.measureText(q[0]), wd = (m && m.width) || 0, cx = Math.round(q[1] * S), y0 = Math.round(q[2] * S);
      ctx.globalAlpha = 0.72; ctx.fillStyle = '#05080a'; ctx.fillRect(Math.round(cx - wd / 2 - 8), y0 - 4, Math.round(wd + 16), fs + 10); ctx.globalAlpha = 1;
      ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.strokeText(q[0], cx, y0); ctx.fillStyle = q[3]; ctx.fillText(q[0], cx, y0); }); Q = []; }
  function fmt(n) { return Math.round(n).toLocaleString('en-US'); }
  function names() { return (root.KekSprite && KekSprite.STAGES) || ['Egg', 'Hatchling', 'Juvenile', 'Adult', 'Elder', 'Mythic']; }
  /** total frames for a scene that ends on stage n */
  function frames(n) { return OPEN + Math.max(0, n) * PER + HOLD; }
  /* backdrop: night sky, pyramid with its eye, sand */
  function backdrop(ctx, t) { px(ctx, 0, 0, W, H, C.bg); for (var s = 0; s < 22; s++) { var sx = (s * 37 + 11) % W, sy = (s * 23 + 5) % 52; if ((s + (t >> 3)) % 3) px(ctx, sx, sy, 1, 1, C.dim); }
    for (var r = 0; r < 26; r++) px(ctx, 132 - r, 51 + r, r * 2 + 1, 1, r % 6 === 5 ? '#2c3352' : '#262c48');           // pyramid, far right
    var blink = (t % 120) > 114; px(ctx, 129, 60, 7, 3, blink ? '#262c48' : C.gold); if (!blink) px(ctx, 132, 61, 1, 1, C.ink);
    px(ctx, 0, 77, W, 13, C.sand2); px(ctx, 0, 77, W, 1, C.sand); }
  /** draw(ctx, t, sp): sp = { egg: [egg frames], stages: [[frames] per stage 1..n], n: current stage, fed, thresholds } */
  function draw(ctx, t, sp) { Q = []; sp = sp || {}; var n = Math.max(0, sp.n || 0), T = sp.thresholds || [0, 69000, 834900, 2214900, 4146900, 6906900], N = names(), end = frames(n);
    t = Math.min(t, end - 1); ctx.setTransform(S, 0, 0, S, 0, 0); ctx.imageSmoothingEnabled = false; backdrop(ctx, t);
    var sc = 1.5, sx = 80 - 16 * sc, sy = 77 - 32 * sc + 2, f = (t >> 3) % 4;
    if (n === 0 || t < OPEN) {                                                                         // 1) the egg he never showed anyone
      var eg = sp.egg ? sp.egg[n === 0 ? f : 0] : null, amp = t < WOB ? Math.round(Math.sin(t / 3) * (1 + t / 30)) : t < CRACK ? Math.round(Math.sin(t / 1.5) * 3) : 0;
      if (n === 0 || t < CRACK) { sprite(ctx, eg, sx + amp, sy, sc);
        if (t >= WOB && n > 0) { var k = Math.min(5, Math.floor((t - WOB) / 6)), zx = sx + amp + 16 * sc, zy = sy + 15 * sc;    // crack zigzag grows across the shell
          for (var i = -k; i <= k; i++) px(ctx, zx + i * 3, zy + (i % 2 ? 2 : 0), 3, 1, C.ink); } }
      else { var u = (t - CRACK) / (OPEN - CRACK), cut = 15;                                           // 2) the shell splits, two halves fall away
        sprite(ctx, eg, sx - u * 14, sy - u * 6 + u * u * 20, sc, 1 - u * 0.6, function (i, j) { return j < cut; });
        sprite(ctx, eg, sx + u * 2, sy + u * 4, sc, 1 - u, function (i, j) { return j >= cut; });
        for (var p = 0; p < 8; p++) star(ctx, 80 + Math.cos(p) * u * 40, 50 - Math.sin(p * 1.7) * u * 26, p % 2 ? C.gold : '#ffffff'); }
      if (t >= CRACK && t < CRACK + 6 && n > 0) { ctx.globalAlpha = 1 - (t - CRACK) / 6; px(ctx, 0, 0, W, H, '#ffffff'); ctx.globalAlpha = 1; }
      text(t < WOB ? 'COMMUNITY PET #3' : n > 0 ? 'Crack…' : 'Lord Kek', 80, 4, C.gold, t < WOB ? 9 : 7);
      text(t < WOB ? 'Nobody saw this egg' : n > 0 ? 'He has been eating the whole time' : 'Egg · ' + fmt(sp.fed || 0) + ' fed', 80, t < WOB ? 15 : 13, '#ffffff', 5);
    } else {                                                                                           // 3) fast-forward through each stage already reached
      var dt = t - OPEN, st = Math.min(n, 1 + Math.floor(dt / PER)), inSt = dt - (st - 1) * PER, last = dt >= n * PER, fr = sp.stages && sp.stages[st - 1];
      if (inSt < 4 && !last) { sprite(ctx, fr && fr[f], sx, sy, sc); ctx.globalAlpha = 1 - inSt / 4; px(ctx, 0, 0, W, H, '#ffffff'); ctx.globalAlpha = 1; }
      else sprite(ctx, fr && fr[f], sx, sy + (last ? 0 : -((t >> 2) % 2)), sc);
      var from = T[st] || 0, to = st < n ? T[st + 1] : (sp.fed || from), care = last ? (sp.fed || 0) : from + (to - from) * Math.min(1, inSt / (PER - 6));
      if (last) { text('Lord Kek', 80, 4, C.gold, 9); text(N[n] + ' · ' + fmt(sp.fed || 0) + ' fed', 80, 15, '#ffffff', 5); }
      else { text(N[st], 80, 4, C.gold, 7); text('⏩ ' + fmt(care) + ' fed', 80, 13, '#ffffff', 5); }
      for (var d = 0; d <= n; d++) px(ctx, 80 - n * 4 + d * 8 - 2, 73, 4, 2, d <= st ? C.gold : C.dim);            // stage pips
    }
    text('Every burn since the Wizard counted', 80, 80, C.cyan, 4);
    flushText(ctx); }
  function seen() { try { return localStorage.getItem(SEEN_KEY) === '1'; } catch (e) { return false; } }
  function markSeen() { try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) { } }
  function previewRequested() { try { return new URLSearchParams(location.search).get('preview') === 'kek-arrival'; } catch (e) { return false; } }
  function reduced() { try { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  /** sprites(w): egg + every reached stage from KekSprite, wearing his community gear (same as his card) on the last stage. */
  function sprites(w) { var c = (w && w.community) || {}, R = root.V2Render, V = root.V2Rules, n = c.kekStage || 0, bg = '#2a3a2e', o = { community: true }, st = [];
    for (var s = 1; s <= n; s++) st.push(s === n && R && R.communityFrames ? R.communityFrames(w) : KekSprite.frames(s, bg, {}, o));
    return { egg: KekSprite.frames(0, bg, {}, o), stages: st, n: n, fed: c.kekFed || 0, thresholds: (V && V.COMMUNITY_THRESHOLDS) || null }; }
  var open = null;
  function play(w, o) { o = o || {}; if (open) return open; markSeen(); var sp = o.sprites || sprites(w), end = frames(sp.n);
    var ov = document.createElement('div'); ov.className = 'reveal on returnov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Lord Kek arrives');
    ov.innerHTML = '<div class="box wide" style="text-align:center"><canvas width="' + W * S + '" height="' + H * S + '" class="returncv" style="width:' + W * S + 'px;max-width:100%;image-rendering:pixelated"></canvas>' +
      '<p class="small muted retinfo">Lord Kek arrives · ' + esc(names()[sp.n]) + '</p><div class="row" style="justify-content:center"><button class="btn retclose" type="button">' + (reduced() ? 'Close' : 'Skip') + '</button></div></div>';
    document.body.appendChild(ov); var cv = ov.querySelector('canvas'), ctx = cv.getContext('2d'), t = 0, stop = false, last = 0, btn = ov.querySelector('.retclose');
    function done() { if (stop) return; stop = true; document.removeEventListener('keydown', esc2); ov.remove(); open = null; if (o.onDone) o.onDone(); }
    function esc2(e) { if (e.key === 'Escape') done(); }
    btn.onclick = done; ov.addEventListener('click', function (e) { if (e.target === ov) done(); }); document.addEventListener('keydown', esc2);
    open = { el: ov, close: done };
    if (reduced()) { draw(ctx, end - 1, sp); return open; }
    (function step(ts) { if (stop) return; if (!last || ts - last >= 33) { last = ts || 0; draw(ctx, t, sp); t++; if (t >= end) btn.textContent = 'Close'; } if (t < end) requestAnimationFrame(step); })();
    return open; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }
  /** watch(el, w): first time el (his card / panel) is on screen while Lord Kek is the community pet, play once per player. */
  function watch(el, getW) { if (!el || el.__kekArr) return; el.__kekArr = 1;
    var go = function () { var w = getW(); if (!(root.V2Render && V2Render.kekOn && V2Render.kekOn(w))) return false; if (seen() && !previewRequested()) return true; play(w); return true; };
    if (previewRequested()) { setTimeout(go, 300); return; }
    if (!('IntersectionObserver' in root)) { go(); return; }
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting && go()) io.disconnect(); }); }, { threshold: 0.4 }); io.observe(el); }
  /** replayLink(getW): html id 'kekReplay' handler binder; call after inserting '<a href="#" class="small kekreplay">Replay arrival</a>'. */
  function bindReplay(scope, getW) { [].forEach.call((scope || document).querySelectorAll('.kekreplay'), function (a) { a.onclick = function (e) { e.preventDefault(); play(getW()); }; }); }
  root.V2KekArrival = { W: W, H: H, S: S, SEEN_KEY: SEEN_KEY, draw: draw, play: play, watch: watch, frames: frames, sprites: sprites, seen: seen, bindReplay: bindReplay, LINK: '<a href="#" class="small kekreplay">Replay arrival</a>' };
})(typeof window !== 'undefined' ? window : this);
