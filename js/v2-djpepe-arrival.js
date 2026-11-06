/* XCPETS v2: DJ PEPE ARRIVAL (branch djpepe-7, PREVIEW, Nov 6 2026). DISPLAY ONLY.
 * Community pet #7 intro: decks light up, gold chain flashes, DJ Pepe drops in (DjPepeSprite).
 * Lazy-loaded like js/v2-rabbit-arrival.js. ?preview=djpepe-arrival. window.V2DjPepeArrival */
(function (root) {
  'use strict';
  var W = 160, H = 90, S = 4, FRAMES = 240, SEEN_KEY = 'xcpets-v2-djpepe-arrival-seen';
  var C = { bg: '#141018', ink: '#e8f0ff', dim: '#6f7fa8', gold: '#ffd23f', red: '#da291c', green: '#4f9a34', deck: '#2a2030', lit: '#ffc93c' };
  var open = null;
  function px(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w || 1, h || 1); }
  function sprite(ctx, img, x, y, s, alpha) {
    if (!img) return; ctx.globalAlpha = alpha == null ? 1 : alpha; var d = img.data;
    for (var j = 0; j < img.height; j++) for (var i = 0; i < img.width; i++) {
      var k = 4 * (j * img.width + i); if (d[k] === d[0] && d[k + 1] === d[1] && d[k + 2] === d[2]) continue;
      ctx.fillStyle = 'rgb(' + d[k] + ',' + d[k + 1] + ',' + d[k + 2] + ')'; ctx.fillRect(x + i * s, y + j * s, Math.ceil(s), Math.ceil(s));
    } ctx.globalAlpha = 1;
  }
  function caption(ctx, s, y, c, size) {
    if (!ctx.fillText) return; ctx.fillStyle = c || C.ink; ctx.font = (size || 6) + 'px "Press Start 2P", monospace';
    ctx.textAlign = 'center'; ctx.fillText(s, 80, Math.round(y));
  }
  function decks(ctx, lit) {
    px(ctx, 20, 70, 50, 12, C.deck); px(ctx, 90, 70, 50, 12, C.deck);
    px(ctx, 28, 73, 10, 6, lit ? C.lit : '#3a3040'); px(ctx, 42, 73, 10, 6, lit ? C.red : '#3a3040');
    px(ctx, 98, 73, 10, 6, lit ? C.red : '#3a3040'); px(ctx, 112, 73, 10, 6, lit ? C.lit : '#3a3040');
    px(ctx, 70, 68, 20, 14, '#1a1020'); px(ctx, 74, 72, 12, 6, lit ? C.gold : '#2a2030');
  }
  function chainFlash(ctx, t) {
    var a = 0.4 + 0.6 * Math.abs(Math.sin(t / 8)); ctx.globalAlpha = a;
    px(ctx, 74, 40, 12, 2, C.gold); px(ctx, 76, 42, 8, 2, C.gold); px(ctx, 78, 44, 4, 4, C.red); px(ctx, 79, 45, 2, 2, C.gold);
    ctx.globalAlpha = 1;
  }
  function draw(ctx, t, o) {
    o = o || {}; var fr = o.frames || [], f = fr[(t >> 3) % 4] || fr[0];
    px(ctx, 0, 0, W, H, C.bg); px(ctx, 0, 82, W, 8, '#0a0810');
    var lit = t > 40; decks(ctx, lit);
    if (t < 40) { caption(ctx, 'THE BOOTHS WARM UP', 14, C.dim, 5); chainFlash(ctx, t); }
    else if (t < 100) {
      var drop = Math.min(1, (t - 40) / 50), y = 20 + (1 - drop) * -40;
      sprite(ctx, f, 64, 40 + Math.max(0, y), 1, Math.min(1, drop * 1.4));
      if (t > 60) caption(ctx, 'DJ PEPE', 14, C.gold, 6);
    } else if (t < 180) {
      sprite(ctx, f, 64, 40 + ((t >> 2) % 2), 1, 1);
      caption(ctx, t < 140 ? 'No requests.' : 'COMMUNITY PET #7', 14, t < 140 ? C.ink : C.gold, 6);
      caption(ctx, 'Gold chain. RED B. Feed the booth.', 86, C.dim, 5);
    } else {
      sprite(ctx, f, 64, 40 + ((t >> 2) % 2), 1, 1);
      caption(ctx, 'DJ Pepe is on the decks', 14, C.gold, 6);
      caption(ctx, 'The White Rabbit is in Cold Storage', 86, C.dim, 5);
    }
  }
  function reduced() { try { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function seen() { try { return localStorage.getItem(SEEN_KEY) === '1'; } catch (e) { return false; } }
  function markSeen() { try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) { } }
  function previewRequested() { try { return new URLSearchParams(location.search).get('preview') === 'djpepe-arrival'; } catch (e) { return false; } }
  function sprites() {
    if (!window.DjPepeSprite) return { frames: [] };
    return { frames: DjPepeSprite.frames(4, '#141018', {
      hand: { item: 'dj-gold-chain', label: 'Gold Chain' },
      head: { item: 'dj-headphones', label: 'Studio headphones' }
    }, { community: true }) };
  }
  function play(w, o) {
    o = o || {}; if (open) return; markSeen();
    var ov = document.createElement('div'); ov.className = 'djpepe-arr-ov'; ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px';
    var cv = document.createElement('canvas'); cv.width = W * S; cv.height = H * S; cv.style.cssText = 'image-rendering:pixelated;background:#000;border:2px solid #ffd23f';
    var btn = document.createElement('button'); btn.type = 'button'; btn.textContent = 'Continue'; btn.style.cssText = 'font:12px "Press Start 2P",monospace;padding:8px 14px;cursor:pointer';
    ov.appendChild(cv); ov.appendChild(btn); document.body.appendChild(ov); document.body.classList.add('djpepe-arr-open'); open = ov;
    var ctx = cv.getContext('2d'), sp = sprites(), stop = false, t0 = 0;
    function done() { if (stop) return; stop = true; document.removeEventListener('keydown', esc2); ov.remove(); document.body.classList.remove('djpepe-arr-open'); open = null; if (o.onDone) o.onDone(); }
    function esc2(e) { if (e.key === 'Escape') done(); }
    btn.onclick = done; ov.addEventListener('click', function (e) { if (e.target === ov) done(); }); document.addEventListener('keydown', esc2);
    if (reduced()) { draw(ctx, 200, sp); return; }
    (function step(ts) {
      if (stop) return; if (!t0) t0 = ts; var frame = Math.min(FRAMES - 1, Math.floor((ts - t0) / (1000 / 30)));
      ctx.setTransform(S, 0, 0, S, 0, 0); ctx.imageSmoothingEnabled = false; draw(ctx, frame, sp);
      if (frame < FRAMES - 1) requestAnimationFrame(step); else setTimeout(done, 600);
    })(0);
  }
  function bindReplay(scope, getW) {
    [].forEach.call((scope || document).querySelectorAll('.djpepereplay'), function (a) {
      a.onclick = function (e) { e.preventDefault(); play(typeof getW === 'function' ? getW() : getW); };
    });
  }
  function watch(el, getW) {
    if (!el || el.__djpepeArr) return; el.__djpepeArr = 1;
    var go = function () {
      var w = typeof getW === 'function' ? getW() : getW; var c = w && w.community;
      if (!(c && c.current === 'djpepe') && !previewRequested()) return false;
      if (seen() && !previewRequested()) return true; play(w); return true;
    };
    if (previewRequested()) { go(); return; }
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting && go()) io.disconnect(); }); }, { threshold: 0.4 }); io.observe(el);
  }
  var api = { draw: draw, play: play, watch: watch, sprites: sprites, seen: seen, bindReplay: bindReplay,
    LINK: '<a href="#" class="small djpepereplay">Replay arrival</a>', FRAMES: FRAMES, SEEN_KEY: SEEN_KEY };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.V2DjPepeArrival = api;
})(typeof window !== 'undefined' ? window : this);
