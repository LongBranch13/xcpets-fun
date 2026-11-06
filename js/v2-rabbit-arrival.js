/* XCPETS v2: WHITE RABBIT ARRIVAL (branch whiterabbit-intro-1106, PREVIEW ONLY, Nov 6 2026). DISPLAY ONLY, no rule change.
 * Community pet #6 intro: a pocket watch ticks, the White Rabbit hops in (RabbitSprite), checks the time ("I'm late!"),
 * dives down a rabbit hole and leaves a breadcrumb trail. Same frame as Lord Kek arrival / farewells:
 * 160x90 pixel canvas x4, 30 fps, Press Start 2P, ONE caption at a time in a top or bottom band (never over the rabbit).
 * No fire aura, flame crown or gold edition frame (Adult stage, not Mythic rim). ~11 s (330 frames).
 * Not loaded by any page yet; when the White Rabbit launches it can plug in like js/v2-kek-arrival.js
 * (SEEN_KEY once-per-player, ?preview=rabbit-arrival, Replay arrival). window.V2RabbitArrival = { draw, play, FRAMES, ... } */
(function (root) {
  'use strict';
  var W = 160, H = 90, S = 4, FRAMES = 330, SEEN_KEY = 'xcpets-v2-rabbit-arrival-seen';
  /* beat ends (exclusive): watch | hop-in | late | dive | crumbs */
  var B1 = 55, B2 = 120, B3 = 180, B4 = 250, B5 = FRAMES;
  var C = {
    bg: '#141a2e', bg2: '#1b2240', sky: '#101628', ink: '#e8f0ff', dim: '#6f7fa8',
    gold: '#ffd23f', gold2: '#c49a1a', gold3: '#fffbe8', pink: '#ff7fae',
    grass: '#2a4a28', grass2: '#1e361c', dirt: '#3a2a18', dirt2: '#2a1e10',
    hole: '#05080a', crumb: '#e8c888', crumb2: '#c49a1a', crumbOn: '#ffd23f',
    white: '#f6f4fa', leaf: '#3d7a2a'
  };
  function px(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w || 1, h || 1); }
  function sprite(ctx, img, x, y, s, alpha) {
    if (!img) return; ctx.globalAlpha = alpha == null ? 1 : alpha; var d = img.data;
    for (var j = 0; j < img.height; j++) for (var i = 0; i < img.width; i++) {
      var k = 4 * (j * img.width + i); if (d[k] === d[0] && d[k + 1] === d[1] && d[k + 2] === d[2]) continue;
      ctx.fillStyle = 'rgb(' + d[k] + ',' + d[k + 1] + ',' + d[k + 2] + ')';
      ctx.fillRect(Math.round(x + i * s), Math.round(y + j * s), Math.ceil(s), Math.ceil(s));
    }
    ctx.globalAlpha = 1;
  }
  /* caption band: y 4..14 top or y 82..88 bottom. Drawn AFTER sprites. size 5~6 fits ~22 chars in 160. */
  function caption(ctx, s, y, c, size) {
    if (!s || !ctx.fillText) return;
    size = size || 6;
    ctx.font = size + 'px "Press Start 2P", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    var m = ctx.measureText(s), wd = (m && m.width) || 0, cx = 80, yy = Math.round(y);
    /* soft plate so glyphs stay readable, stays inside the band */
    ctx.globalAlpha = 0.55; px(ctx, Math.max(2, cx - wd / 2 - 4), yy - 2, Math.min(W - 4, wd + 8), size + 5, '#05080a');
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2; ctx.strokeStyle = '#000'; ctx.strokeText(s, cx, yy);
    ctx.fillStyle = c || C.ink; ctx.fillText(s, cx, yy);
  }
  function backdrop(ctx, t) {
    px(ctx, 0, 0, W, H, C.bg);
    /* stars */
    for (var s = 0; s < 18; s++) {
      var sx = (s * 41 + 7) % W, sy = (s * 19 + 3) % 48;
      if ((s + (t >> 4)) % 4) px(ctx, sx, sy, 1, 1, C.dim);
    }
    /* far bushes */
    px(ctx, 4, 62, 18, 10, C.grass2); px(ctx, 8, 58, 10, 6, C.grass);
    px(ctx, 138, 60, 20, 12, C.grass2); px(ctx, 142, 56, 12, 8, C.grass);
    /* ground */
    px(ctx, 0, 72, W, 18, C.dirt2); px(ctx, 0, 72, W, 2, C.grass);
    px(ctx, 0, 74, W, 1, C.dirt);
    /* dirt path toward the hole */
    for (var p = 0; p < 10; p++) px(ctx, 20 + p * 10, 76 + (p % 2), 9, 3, C.dirt);
  }
  /* rabbit hole on the right ground — stepped oval so it reads as a hole, not a box */
  function hole(ctx, open) {
    var ox = 130, oy = 76, rw = 16 + Math.round(open * 5), rh = 5 + Math.round(open * 3);
    var rows = [
      [0.45, -rh], [0.7, -rh + 1], [0.9, -rh + 2], [1.0, -2], [1.0, 0], [0.9, 2], [0.7, rh - 1], [0.45, rh]
    ];
    for (var i = 0; i < rows.length; i++) {
      var ww = Math.round(rw * rows[i][0]), yy = oy + rows[i][1];
      px(ctx, ox - ww, yy, ww * 2, 1, C.hole);
    }
    /* dirt rim */
    px(ctx, ox - rw + 1, oy - rh - 1, Math.round(rw * 0.9), 1, C.dirt);
    px(ctx, ox + 2, oy - rh - 1, Math.round(rw * 0.7), 1, C.dirt);
    ctx.globalAlpha = 0.55; px(ctx, ox - Math.round(rw * 0.55), oy - 1, Math.round(rw * 1.1), 3, '#000'); ctx.globalAlpha = 1;
  }
  /* giant ticking pocket watch (beat 1 centerpiece) */
  function bigWatch(ctx, t) {
    var cx = 80, cy = 42, r = 18;
    /* outer gold */
    for (var a = 0; a < 360; a += 6) {
      var rad = a * Math.PI / 180;
      px(ctx, cx + Math.cos(rad) * r, cy + Math.sin(rad) * r, 2, 2, a % 30 === 0 ? C.gold2 : C.gold);
    }
    px(ctx, cx - 14, cy - 14, 28, 28, C.gold2);
    px(ctx, cx - 12, cy - 12, 24, 24, C.gold3);
    /* ticks at 12/3/6/9 */
    px(ctx, cx - 1, cy - 10, 2, 3, C.gold2);
    px(ctx, cx - 1, cy + 7, 2, 3, C.gold2);
    px(ctx, cx - 10, cy - 1, 3, 2, C.gold2);
    px(ctx, cx + 7, cy - 1, 3, 2, C.gold2);
    /* hand sweeps ~1 rev / 55 frames */
    var ang = (t / B1) * Math.PI * 2 - Math.PI / 2;
    for (var L = 0; L < 10; L++) px(ctx, cx + Math.cos(ang) * L, cy + Math.sin(ang) * L, 2, 2, '#1a1020');
    px(ctx, cx - 1, cy - 1, 3, 3, C.gold);
    /* bow at top */
    px(ctx, cx - 2, cy - r - 4, 4, 4, C.gold2); px(ctx, cx - 1, cy - r - 6, 2, 3, C.gold);
  }
  /* breadcrumbs along the path; lit = how many are glowing (0..N) */
  function crumbs(ctx, lit) {
    if (lit <= 0) return; /* stay hidden until the rabbit starts leaving them */
    var pts = [[28, 75], [40, 76], [52, 75], [64, 76], [76, 75], [88, 76], [100, 75], [112, 74], [122, 73]];
    for (var i = 0; i < pts.length; i++) {
      if (i >= lit) break;
      px(ctx, pts[i][0], pts[i][1], 2, 2, C.crumbOn);
      px(ctx, pts[i][0] - 1, pts[i][1] - 1, 1, 1, C.gold3);
    }
  }
  /** draw(ctx, t, o): frame t (0..FRAMES-1). o = { frames: RabbitSprite.frames(3, bg, gear) (4 idle), egg?: optional } */
  function draw(ctx, t, o) {
    o = o || {};
    t = Math.max(0, Math.min(FRAMES - 1, t | 0));
    var fr = o.frames || [], fi = (t >> 3) % 4, f = fr[fi] || fr[0];
    backdrop(ctx, t);
    hole(ctx, t >= B3 ? Math.min(1, (t - B3) / 40) : 0.35);

    var cap = '', capY = 6, capC = C.gold, capS = 6;
    var sc = 1.4, bob = (t >> 2) % 2;

    if (t < B1) {
      /* 1) pocket watch ticks alone */
      bigWatch(ctx, t);
      crumbs(ctx, 0);
      cap = 'Tick\u2026 tock\u2026'; capY = 6; capC = C.gold;
    } else if (t < B2) {
      /* 2) rabbit hops in from left to center */
      var u = (t - B1) / (B2 - B1);
      var hop = Math.abs(Math.sin(u * Math.PI * 3)) * 6; /* 3 hops */
      var x = -20 + u * 100; /* -20 -> 80 */
      var y = 72 - 32 * sc - hop + 2;
      sprite(ctx, f, x - 16 * sc, y, sc, Math.min(1, u * 4));
      crumbs(ctx, Math.floor(u * 3));
      cap = 'The White Rabbit'; capY = 6; capC = C.gold;
    } else if (t < B3) {
      /* 3) checks the time — stands centre, watch gear ticks with idle frames */
      var y2 = 72 - 32 * sc + 2 - bob;
      sprite(ctx, f, 80 - 16 * sc, y2, sc, 1);
      crumbs(ctx, 3);
      cap = "I'm late!"; capY = 6; capC = C.ink; capS = 7;
    } else if (t < B4) {
      /* 4) hops to the hole and dives in */
      var v = (t - B3) / (B4 - B3);
      var x3 = 80 + v * 48; /* 80 -> 128 */
      var dive = v > 0.55 ? (v - 0.55) / 0.45 : 0;
      var hop2 = dive > 0 ? 0 : Math.abs(Math.sin(v * Math.PI * 2)) * 5;
      var sc2 = sc * (1 - dive * 0.7);
      var y3 = 72 - 32 * sc2 - hop2 + 2 + dive * 14;
      var a3 = 1 - dive * 0.85;
      sprite(ctx, f, x3 - 16 * sc2, y3, sc2, a3);
      crumbs(ctx, 3 + Math.floor(v * 3));
      cap = 'Down the hole'; capY = 6; capC = C.pink;
    } else {
      /* 5) gone — breadcrumbs light the trail into the hole */
      var w = (t - B4) / (B5 - B4);
      crumbs(ctx, 3 + Math.floor(w * 6));
      /* soft glow in the hole */
      ctx.globalAlpha = 0.25 + 0.25 * Math.sin(t / 6); px(ctx, 120, 70, 16, 8, C.gold); ctx.globalAlpha = 1;
      cap = 'Follow the breadcrumbs'; capY = 6; capC = C.gold; capS = 5;
      /* end plate: community id in the BOTTOM band only (still one caption up top) */
      if (w > 0.55) {
        /* swap: final caption moves to bottom so the top can show the id? No — one caption.
         * Keep breadcrumbs line on top until near end, then switch once. */
        if (w > 0.7) { cap = 'COMMUNITY PET #6'; capY = 6; capC = C.gold; capS = 6; }
      }
    }
    caption(ctx, cap, capY, capC, capS);
  }

  function reduced() { try { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function seen() { try { return localStorage.getItem(SEEN_KEY) === '1'; } catch (e) { return false; } }
  function markSeen() { try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) { } }
  function previewRequested() { try { return new URLSearchParams(location.search).get('preview') === 'rabbit-arrival'; } catch (e) { return false; } }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }

  /** Default Adult White Rabbit with waistcoat + pocket watch (signature Grip). */
  function sprites() {
    var bg = '#141a2e', gear = {
      hand: { item: 'wr-pocket-watch', label: 'Gold pocket watch' },
      body: { item: 'wr-waistcoat', label: 'Checked waistcoat' }
    };
    if (!(root.RabbitSprite && RabbitSprite.frames)) return { frames: [] };
    return { frames: RabbitSprite.frames(3, bg, gear, {}) };
  }

  var open = null;
  function play(w, o) {
    o = o || {}; if (open) return open; markSeen();
    var sp = o.sprites || (o.frames ? { frames: o.frames } : sprites());
    var ov = document.createElement('div'); ov.className = 'reveal on returnov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'White Rabbit arrives');
    ov.innerHTML = '<div class="box wide" style="text-align:center"><canvas width="' + (W * S) + '" height="' + (H * S) + '" class="returncv" style="width:' + (W * S) + 'px;max-width:100%;image-rendering:pixelated"></canvas>' +
      '<p class="small muted retinfo">The White Rabbit arrives</p><div class="row" style="justify-content:center"><button class="btn retclose" type="button">' + (reduced() ? 'Close' : 'Skip') + '</button></div></div>';
    document.body.appendChild(ov); document.body.classList.add('rabbit-arr-open');
    var cv = ov.querySelector('canvas'), ctx = cv.getContext('2d'), t = 0, stop = false, last = 0, btn = ov.querySelector('.retclose');
    function done() { if (stop) return; stop = true; document.removeEventListener('keydown', esc2); ov.remove(); document.body.classList.remove('rabbit-arr-open'); open = null; if (o.onDone) o.onDone(); }
    function esc2(e) { if (e.key === 'Escape') done(); }
    btn.onclick = done; ov.addEventListener('click', function (e) { if (e.target === ov) done(); }); document.addEventListener('keydown', esc2);
    open = { el: ov, close: done };
    function paint(frame) { ctx.setTransform(S, 0, 0, S, 0, 0); ctx.imageSmoothingEnabled = false; draw(ctx, frame, sp); }
    if (reduced()) { paint(FRAMES - 1); return open; }
    (function step(ts) {
      if (stop) return;
      if (!last || ts - last >= 33) { last = ts || 0; paint(t); t++; if (t >= FRAMES) btn.textContent = 'Close'; }
      if (t < FRAMES) requestAnimationFrame(step);
    })();
    return open;
  }
  function bindReplay(scope, getW) {
    [].forEach.call((scope || document).querySelectorAll('.rabbitreplay'), function (a) {
      a.onclick = function (e) { e.preventDefault(); play(typeof getW === 'function' ? getW() : getW); };
    });
  }

  var api = {
    W: W, H: H, S: S, FRAMES: FRAMES, SEEN_KEY: SEEN_KEY,
    B1: B1, B2: B2, B3: B3, B4: B4,
    draw: draw, play: play, sprites: sprites, seen: seen, bindReplay: bindReplay,
    LINK: '<a href="#" class="small rabbitreplay">Replay arrival</a>'
  };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.V2RabbitArrival = api;
})(typeof window !== 'undefined' ? window : this);
