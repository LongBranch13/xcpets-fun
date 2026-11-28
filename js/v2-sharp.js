/* scene-sharp (owner 9:49 PM CT 2026-10-19): one helper so the arena, the Lair and the motel scale the same way.
 * Cause of the blur: a 320xH canvas bitmap stretched by CSS to the page width by a non-integer factor, with 4-8 px text rasterised at 1x.
 * Fix: backing store = logical size x integer k (k >= CSS width x devicePixelRatio / W), drawing stays in logical units via setTransform(k),
 * smoothing off; CSS pixelated once each art pixel is 3+ device px (below that the browser does a smooth DOWN-scale only). */
(function () {
  /* mobile-fullscreen (owner 10:10 PM CT 2026-10-19): on phones (<=600px wide, portrait) the scene stage is edge to edge and the
   * canvas gets the LARGEST INTEGER number of device pixels per art pixel that fits the stage width (and 92% of the viewport height),
   * so every art pixel is an exact kd x kd device-pixel block (no resampling at all). The leftover stage width is a scene-coloured
   * letterbox (CSS). Desktop/laptop never enter this branch, so they are unchanged. Tap mapping reads getBoundingClientRect, so it
   * follows the new CSS size automatically. */
  var PHONE = '(max-width: 600px) and (orientation: portrait)';
  function phoneFit(c, W, H) { var st = c.closest && c.closest('.ar-scene,.shop-scene,.motel-scene'); if (!st || !window.matchMedia || !window.matchMedia(PHONE).matches) return 0;
    var d = window.devicePixelRatio || 1, aw = st.clientWidth || W, ah = (window.innerHeight || 800) * 0.92,
      kd = Math.max(1, Math.min(Math.floor(aw * d / W + 1e-6), Math.floor(ah * d / H + 1e-6), 12));
    if (c.width !== W * kd || c.height !== H * kd) { c.width = W * kd; c.height = H * kd; }
    var cw = (W * kd / d) + 'px', ch = (H * kd / d) + 'px'; if (c.style.width !== cw) c.style.width = cw; if (c.style.height !== ch) c.style.height = ch;
    st.style.setProperty('--mfs-h', ch); c.setAttribute('data-mfs', kd); c.style.imageRendering = 'pixelated'; return kd; }
  function fit(c, W, H) { if (!c) return 1; var pk = phoneFit(c, W, H); if (pk) return pk;
    if (c.hasAttribute && c.hasAttribute('data-mfs')) { c.removeAttribute('data-mfs'); c.style.width = ''; c.style.height = ''; var st0 = c.closest && c.closest('.ar-scene,.shop-scene,.motel-scene'); if (st0) st0.style.removeProperty('--mfs-h'); }
    var r = c.getBoundingClientRect ? c.getBoundingClientRect() : { width: W }, d = window.devicePixelRatio || 1,
      k = Math.max(1, Math.min(8, Math.ceil(((r.width || W) * d) / W - 0.01)));
    if (c.width !== W * k || c.height !== H * k) { c.width = W * k; c.height = H * k; }
    c.style.imageRendering = k >= 3 ? 'pixelated' : 'auto'; return k; }
  function begin(x, k) { x.setTransform(k || 1, 0, 0, k || 1, 0, 0); x.imageSmoothingEnabled = false; }
  /* calls cb() on window resize or a DPR change (zoom / moving to another screen) */
  function watch(cb) { window.addEventListener('resize', cb); var mq = null;
    var arm = function () { if (!window.matchMedia) return; try { if (mq) mq.removeEventListener('change', on); mq = window.matchMedia('(resolution: ' + (window.devicePixelRatio || 1) + 'dppx)'); mq.addEventListener('change', on); } catch (e) { } };
    var on = function () { arm(); cb(); }; arm(); }
  /* scene-top (Nov 28 2026, Jake: "red candles overlap Mort's speech in the cemetery"). Root cause: a host's speech bubble is painted INSIDE the scene
   * canvas, while seasonal / event decoration (Doom Week stones and fog, Halloween candles, place pennants...) are DOM layers stacked OVER that canvas,
   * so any decoration that lands on a bubble covers it, in every scene with a talking host. Fix in one place: after a frame, a scene hands the rects
   * that must stay readable (speech bubbles) to top(); they are copied pixel for pixel from the scene canvas onto a small canvas that sits above every
   * decoration layer (z-index 9, pointer-events none, so taps still reach the scene). No rects = the top canvas is cleared. The top canvas is added to
   * the scene's box once and never moved again (moving it would wake the decoration watchers, see doom-week.js cemFx). */
  var TOPZ = 9;
  function top(c, W, rects) { if (!c || !c.getContext) return; var o = c._top, i, r;
    if (!rects || !rects.length) { if (o && o._on) { o.getContext('2d').clearRect(0, 0, o.width, o.height); o._on = 0; } return; }
    var p = c.parentNode; if (!p) return;
    if (!o) { o = c._top = document.createElement('canvas'); o.className = 'scene-top'; o.setAttribute('aria-hidden', 'true'); o.style.cssText = 'position:absolute;margin:0;padding:0;border:0;pointer-events:none;z-index:' + TOPZ + ';image-rendering:pixelated;background:transparent'; }
    if (o.parentNode !== p) { try { if (getComputedStyle(p).position === 'static') p.style.position = 'relative'; } catch (e) { } p.appendChild(o); }
    if (o.width !== c.width || o.height !== c.height) { o.width = c.width; o.height = c.height; }
    var cr = c.getBoundingClientRect(), pr = p.getBoundingClientRect(), bl = c.clientLeft || 0, bt = c.clientTop || 0, st = o.style; /* fractional CSS px: offsetLeft and clientWidth round, and a 1 px drift shows a strip of decoration */
    var L = (cr.left - pr.left - (p.clientLeft || 0) + bl) + 'px', T = (cr.top - pr.top - (p.clientTop || 0) + bt) + 'px', Wd = (cr.width - 2 * bl) + 'px', Hd = (cr.height - 2 * bt) + 'px';
    if (st.left !== L) st.left = L; if (st.top !== T) st.top = T; if (st.width !== Wd) st.width = Wd; if (st.height !== Hd) st.height = Hd;
    var ir = c.style.imageRendering || ''; if (st.imageRendering !== ir) st.imageRendering = ir;
    var x = o.getContext('2d'), k = c.width / W; x.setTransform(1, 0, 0, 1, 0, 0); x.imageSmoothingEnabled = false; x.clearRect(0, 0, o.width, o.height);
    for (i = 0; i < rects.length; i++) { r = rects[i]; if (!r) continue; var sx = Math.max(0, Math.floor((r.x - 1) * k)), sy = Math.max(0, Math.floor((r.y - 1) * k)), sw = Math.min(c.width, Math.ceil((r.x + r.w + 1) * k)) - sx, sh = Math.min(c.height, Math.ceil((r.y + r.h + 1) * k)) - sy; /* 1 art px of the scene around it: a scaled-down edge blends with what is under it */
      if (sw > 0 && sh > 0) x.drawImage(c, sx, sy, sw, sh, sx, sy, sw, sh); }
    o._on = 1; o._rects = rects.slice(); o._W = W; }
  window.V2Sharp = { fit: fit, begin: begin, watch: watch, top: top, TOPZ: TOPZ };
})();
