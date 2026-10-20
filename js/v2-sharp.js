/* scene-sharp (owner 9:49 PM CT 2026-10-19): one helper so the arena, the Lair and the motel scale the same way.
 * Cause of the blur: a 320xH canvas bitmap stretched by CSS to the page width by a non-integer factor, with 4-8 px text rasterised at 1x.
 * Fix: backing store = logical size x integer k (k >= CSS width x devicePixelRatio / W), drawing stays in logical units via setTransform(k),
 * smoothing off; CSS pixelated once each art pixel is 3+ device px (below that the browser does a smooth DOWN-scale only). */
(function () {
  function fit(c, W, H) { if (!c) return 1; var r = c.getBoundingClientRect ? c.getBoundingClientRect() : { width: W }, d = window.devicePixelRatio || 1,
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
