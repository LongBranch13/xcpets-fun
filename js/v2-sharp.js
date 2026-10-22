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
  window.V2Sharp = { fit: fit, begin: begin, watch: watch };
})();
