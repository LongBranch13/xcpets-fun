/* XCPETS v2 — THE RETURN animation (pixel style, 160x90 canvas scaled x4, integer scaling).
 * Story (no spoiler text, 2026-10-15): pixel ₿ coins arc from Nakamoto into a vault with a fire (hearth ledge labelled with the official
 * Counterparty burn address), a counter ticks up, the vault flares,
 * Nakamoto fades, and a new community pet appears. Triggered by CHAIN STATE (community total >= V2Rules.COMMUNITY_GOAL), so every visitor sees it once
 * (localStorage seen-flag keyed by the trigger tx); 'Watch The Return' replays it; ?preview=return previews it any time.
 * window.V2Return = { draw(ctx, t, sprites), FRAMES, play(opts), maybeAutoplay(world, opts), SEEN_KEY, seen(), previewRequested() } */
(function (root) {
  'use strict';
  var W = 160, H = 90, S = 4, FRAMES = 420, BTC = 1100000, SEEN_KEY = 'xcpets-v2-return-seen';
  var C = { bg: '#142018', bg2: '#1b2b21', ink: '#e8f5e9', dim: '#7fa58a', gold: '#ffc93c', gold2: '#c98a12', fire1: '#ff5a2a', fire2: '#ffb02e', fire3: '#fff07a', stone: '#4b5563', stone2: '#2f3742', cyan: '#33d6ff' };
  var BURN_ADDR = '1CounterpartyXXXXXXXXXXXXXXXUWLpVr'; // official Counterparty burn address (same string as rjs/config.js)
  function px(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
  function coin(ctx, x, y) { px(ctx, x - 2, y - 3, 5, 7, C.gold2); px(ctx, x - 3, y - 2, 7, 5, C.gold2); px(ctx, x - 2, y - 2, 5, 5, C.gold); px(ctx, x - 1, y - 2, 1, 5, C.gold2); px(ctx, x, y - 2, 2, 1, C.gold2); px(ctx, x, y, 2, 1, C.gold2); px(ctx, x, y + 2, 2, 1, C.gold2); }
  function sprite(ctx, img, x, y, s, alpha) { if (!img) return; ctx.globalAlpha = alpha == null ? 1 : alpha;
    for (var j = 0; j < img.height; j++) for (var i = 0; i < img.width; i++) { var k = 4 * (j * img.width + i), d = img.data; if (d[k + 3] === 0) continue;
      var bgk = 4 * 0; if (d[k] === d[bgk] && d[k + 1] === d[bgk + 1] && d[k + 2] === d[bgk + 2]) continue; // drop the sprite's own background colour
      ctx.fillStyle = 'rgb(' + d[k] + ',' + d[k + 1] + ',' + d[k + 2] + ')'; ctx.fillRect(x + i * s, y + j * s, s, s); }
    ctx.globalAlpha = 1; }
  function fire(ctx, cx, base, t, big) { var hgt = big ? 26 : 14; for (var i = -7; i <= 7; i++) { var h = Math.max(2, Math.round(hgt * (1 - Math.abs(i) / 9) * (0.7 + 0.3 * Math.sin(t / 3 + i * 1.7)))); px(ctx, cx + i, base - h, 1, h, C.fire1); px(ctx, cx + i, base - Math.round(h * 0.65), 1, Math.round(h * 0.65), C.fire2); px(ctx, cx + i, base - Math.round(h * 0.3), 1, Math.round(h * 0.3), C.fire3); } }
  function vault(ctx, t, big) { px(ctx, 112, 52, 34, 22, C.stone2); px(ctx, 113, 53, 32, 20, C.stone); px(ctx, 113, 53, 32, 3, C.stone2); px(ctx, 118, 58, 22, 10, '#1a1f26'); fire(ctx, 129, 66, t, big); px(ctx, 110, 74, 38, 3, C.stone2);
    px(ctx, 90, 73, 70, 5, C.stone2); px(ctx, 91, 74, 68, 3, '#0b0f14'); L.push([BURN_ADDR, 125, 74, 3]); } // hearth ledge with burn-address label
  var L = [];
  /* text legibility fix (Jake 2026-10-14): the pixel art is drawn at integer scale S onto a W*S x H*S canvas, and text is queued and drawn
   * afterwards at device resolution (crisp, integer px font, never scaled), white/gold with a 2 px dark outline on a semi-opaque panel, wrapped if long. */
  var Q = [];
  function text(ctx, s, x, y, c, size, align) { Q.push([s, x, y, c, size]); }
  function flushText(ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.lineJoin = 'round';
    Q.forEach(function (q) { var fs = q[4] >= 9 ? 32 : q[4] >= 7 ? 22 : q[4] >= 5 ? 18 : 16; ctx.font = 'bold ' + fs + 'px monospace';
      var maxW = W * S - 24, words = String(q[0]).split(' '), lines = [], cur = '';
      words.forEach(function (wd) { var t2 = cur ? cur + ' ' + wd : wd, m = ctx.measureText(t2); if (cur && m && m.width > maxW) { lines.push(cur); cur = wd; } else cur = t2; }); lines.push(cur);
      var lh = fs + 4, wmax = 0; lines.forEach(function (l) { var m = ctx.measureText(l); wmax = Math.max(wmax, (m && m.width) || 0); });
      var cx = Math.round(q[1] * S), y0 = Math.round(q[2] * S);
      ctx.globalAlpha = 0.72; ctx.fillStyle = '#05080a'; ctx.fillRect(Math.round(cx - wmax / 2 - 8), y0 - 4, Math.round(wmax + 16), lines.length * lh + 6); ctx.globalAlpha = 1;
      lines.forEach(function (l, i) { ctx.lineWidth = 4; ctx.strokeStyle = '#000000'; ctx.strokeText(l, cx, y0 + i * lh); ctx.fillStyle = q[3]; ctx.fillText(l, cx, y0 + i * lh); }); });
    L.forEach(function (l) { var maxw = l[3] * 0 + 68 * S - 6, fs = 14; ctx.font = 'bold ' + fs + 'px monospace';
      while (fs > 8 && ctx.measureText(l[0]).width > maxw) { fs--; ctx.font = 'bold ' + fs + 'px monospace'; }
      ctx.textBaseline = 'middle'; ctx.fillStyle = C.fire3; ctx.fillText(l[0], Math.round(Math.min(l[1] * S, W * S - 3 - ctx.measureText(l[0]).width / 2)), Math.round(75.5 * S)); ctx.textBaseline = 'top'; });
    Q = []; L = [];
  }
  function fmt(n) { return Math.round(n).toLocaleString('en-US'); }
  /** draw frame t (0..FRAMES-1). sprites = { nakamoto: [ImageData-like 32x32 frames], egg: [frames] } */
  function draw(ctx, t, sp) {
    Q = []; L = []; ctx.setTransform(S, 0, 0, S, 0, 0); ctx.imageSmoothingEnabled = false;
    sp = sp || {}; px(ctx, 0, 0, W, H, C.bg); for (var s = 0; s < 18; s++) { var sx = (s * 37 + 11) % W, sy = (s * 23 + 5) % 50; if ((s + (t >> 3)) % 3) px(ctx, sx, sy, 1, 1, C.dim); }
    px(ctx, 0, 77, W, 13, C.bg2);
    var send0 = 50, send1 = 290, flare = 300, egg0 = 330, p = Math.max(0, Math.min(1, (t - send0) / (send1 - send0)));
    var nkA = t < flare ? 1 : Math.max(0, 1 - (t - flare) / 30), nf = sp.nakamoto ? sp.nakamoto[(t >> 3) % sp.nakamoto.length] : null;
    if (nkA > 0) sprite(ctx, nf, 14, 38 + (t < send0 ? 0 : (t >> 4) % 2), 1.25, nkA);
    vault(ctx, t, t >= send1 && t < flare + 40);
    text(ctx, 'Every XCPETS burn counted', 80, 79.5, C.cyan, 4, 'center');
    if (t >= send0 && t < send1 + 12) for (var k = 0; k < 6; k++) { var u = ((t - send0) / 26 + k / 6) % 1; if (t - send0 < k * 4) continue;
      var x = 34 + (126 - 34) * u, y = 50 - Math.sin(u * Math.PI) * 30 + u * 8; coin(ctx, x, y); }
    text(ctx, t < send0 ? 'COMMUNITY PET' : t < flare ? 'Community pet' : t < egg0 ? 'Gone. Burned forever.' : 'A new community pet appears…', 80, 4, C.gold, t < send0 ? 9 : 5, 'center');
    if (t < egg0) text(ctx, '₿ ' + fmt(BTC * p) + ' sent', 80, t < send0 ? 15 : 13, '#ffffff', 7, 'center');
    if (t >= flare && t < flare + 14) { ctx.globalAlpha = 1 - (t - flare) / 14; px(ctx, 0, 0, W, H, '#ffffff'); ctx.globalAlpha = 1; }
    if (t >= egg0) { var a = Math.min(1, (t - egg0) / 30), ef = sp.egg ? sp.egg[(t >> 3) % sp.egg.length] : null; sprite(ctx, ef, 58, 30 - Math.round((1 - a) * 8), 1.4, a);
      if (t > egg0 + 30) text(ctx, 'A new community pet · grow it together', 80, 13, '#ffffff', 5, 'center'); }
    flushText(ctx);
  }
  function seenTx() { try { return localStorage.getItem(SEEN_KEY); } catch (e) { return null; } }
  function previewRequested() { try { return new URLSearchParams(location.search).get('preview') === 'return'; } catch (e) { return false; } }
  /** play({sprites, onDone, info}) -> overlay with the animation; Skip / Close; never blocks the page. */
  function play(o) {
    o = o || {}; var ov = document.createElement('div'); ov.className = 'reveal on returnov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Community pet');
    ov.innerHTML = '<div class="box wide" style="text-align:center"><canvas width="' + W * S + '" height="' + H * S + '" class="returncv" style="width:' + W * S + 'px;max-width:100%;image-rendering:pixelated"></canvas>' +
      '<p class="small muted retinfo">' + (o.info || '') + '</p><div class="row" style="justify-content:center"><button class="btn retclose" type="button">Close</button></div></div>';
    document.body.appendChild(ov); var cv = ov.querySelector('canvas'), ctx = cv.getContext('2d'), t = 0, stop = false, last = 0;
    function done() { stop = true; ov.remove(); if (o.onDone) o.onDone(); }
    ov.querySelector('.retclose').onclick = done;
    (function step(ts) { if (stop) return; if (!last || ts - last >= 33) { last = ts || 0; draw(ctx, Math.min(t, FRAMES - 1), o.sprites); t++; } if (t < FRAMES + 60) requestAnimationFrame(step); else ov.querySelector('.retclose').textContent = 'Close'; })();
    return { el: ov, close: done };
  }
  /** autoplay once per visitor after The Return (chain state); returns true when it played */
  function maybeAutoplay(w, o) {
    var c = w && w.community; if (previewRequested()) { api.play(o); return true; }
    if (!c || !c.returned) return false; var key = String(c.returnTx || c.returnBlock); if (seenTx() === key) return false;
    try { localStorage.setItem(SEEN_KEY, key); } catch (e) { } api.play(o); return true;
  }
  var api = root.V2Return = { W: W, H: H, S: S, FRAMES: FRAMES, SEEN_KEY: SEEN_KEY, draw: draw, play: play, maybeAutoplay: maybeAutoplay, seen: seenTx, previewRequested: previewRequested };
})(typeof window !== 'undefined' ? window : this);
