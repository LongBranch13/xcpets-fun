/* v2-zombies (PREVIEW ONLY, cemetery-v2-view, owner Oct 28 2026 10:32 PM CT: risen zombies "should be in my pets looking mythic but zombie").
 * Raising is still a mock: the seance altar (js/v2-cemetery-altar.js, risenCard) writes each raise to localStorage 'xcpets-cem-risen-preview'
 * = { petId: { by, power, base, stats, title, n, at } }. Loaded on play.html only (right after v2-render.js, before v2.js), this file lays that
 * mock state over the world V2Mock hands the UI: the grave comes back alive in the raiser's My Pets as a Mythic-stage pet (stage 5 sprite and the
 * live Mythic aura for its species), with its boosted seance stats, no meals needed (hungry false, like Mythics, so Feed all / feedQueue skip it)
 * and a zombie twist on the sprite: a grey-green tint, glowing eyes and two stitches. Nothing is written to the chain, the rules or pet-core.
 * Never adds the fire aura, the grant flame crown or the edition gold frame. ?zombies=off turns the overlay off for a page view. */
(function () {
  var KEY = 'xcpets-cem-risen-preview', M = window.V2Mock, R = window.V2Render;
  var OFF = /[?&]zombies=off\b/.test((window.location && window.location.search) || '');
  function store() { try { var o = JSON.parse(window.localStorage.getItem(KEY) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } }
  function apply(w) { if (OFF || !w || typeof w !== 'object' || !w.byId || w.__zb) return w; var st = store(); w.__zb = true;
    Object.keys(st).forEach(function (k) { var p = w.byId[k], z = st[k]; if (!p || !z || p.released || (!p.dead && !p.zombie)) return;
      p.zombie = { by: z.by || p.owner, power: z.power || 0, base: z.base || 0, title: z.title || '', n: z.n || 0, at: z.at || 0 };
      p.dead = false; if (p.status === 'dead') p.status = 'alive'; p.owner = p.zombie.by; p.stage = 5; p.stageName = 'Mythic'; p.mythicCare = true; p.deathBlock = null; p.neglected = false;
      p.hungry = false; p.nextMeal = 0; p.fedToday = false; if (z.stats && typeof z.stats === 'object') p.stats = Object.assign({}, p.stats || {}, z.stats); });
    return w; }
  if (M && typeof M.world === 'function') { var w0 = M.world; M.world = function () { return apply(w0.apply(this, arguments)); };
    if (typeof M.peek === 'function') { var pk0 = M.peek; M.peek = function () { return apply(pk0.apply(this, arguments)); }; } }
  /* sprite twist, in place on the frames petFrames hands out for a zombie (same frame objects, so the Mythic aura info stays attached) */
  var DONE = typeof WeakSet !== 'undefined' ? new WeakSet() : null;
  function keyed(pf, p, w, extra, col) { var a = Object.assign({}, p.art || {}, { background: 'solid', bgColor: col, pattern: 'none' });
    return pf(Object.assign({}, p, { zombie: null, art: a, mutation: null, shows: null }), w, extra); }
  function twist(fr, p, w, extra, pf) { if (!DONE || !fr || !fr.length || DONE.has(fr[0])) return fr; var A, B;
    try { A = keyed(pf, p, w, extra, '#ff00fe'); B = keyed(pf, p, w, extra, '#00ff01'); } catch (e) { return fr; }
    if (!A || !B || !A.length || !B.length) return fr;
    fr.forEach(function (f, fi) { if (!f || !f.data || f.data.length !== 4096 || DONE.has(f)) return; DONE.add(f);
      var a = A[fi % A.length].data, b = B[fi % B.length].data, d = f.data, m = new Uint8Array(1024), x0 = 32, x1 = -1, y0 = 32, y1 = -1, p2, i;
      for (p2 = 0; p2 < 1024; p2++) { i = p2 * 4; if (a[i] === b[i] && a[i + 1] === b[i + 1] && a[i + 2] === b[i + 2] && a[i + 3] > 0) { m[p2] = 1; var x = p2 & 31, y = p2 >> 5; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
      if (x1 < 0) return; var H = y1 - y0 + 1, W = x1 - x0 + 1, eyeY = y0 + Math.round(H * 0.6);
      for (p2 = 0; p2 < 1024; p2++) { if (!m[p2]) continue; i = p2 * 4; var r = d[i], g = d[i + 1], bl = d[i + 2], l = 0.3 * r + 0.59 * g + 0.11 * bl, mx = Math.max(r, g, bl), mn = Math.min(r, g, bl);
        if ((p2 >> 5) <= eyeY && l > 185 && mx - mn < 60) { d[i] = 196; d[i + 1] = 255; d[i + 2] = 92; m[p2] = 2; continue; } /* eye whites glow */
        d[i] = Math.round(r * 0.35 + (l * 0.62 + 18) * 0.65); d[i + 1] = Math.round(g * 0.35 + (l * 0.86 + 40) * 0.65); d[i + 2] = Math.round(bl * 0.35 + (l * 0.6 + 16) * 0.65); }
      var dot = function (x, y) { if (x < 0 || y < 0 || x > 31 || y > 31) return; var q = y * 32 + x; if (m[q] !== 1) return; var j = q * 4; d[j] = 34; d[j + 1] = 40; d[j + 2] = 30; };
      var sy = y0 + Math.round(H * 0.74), sx = x0 + Math.round(W * 0.2), k; /* body stitch: a line with ticks */
      for (k = 0; k < 5; k++) { dot(sx + k, sy); if (!(k & 1)) { dot(sx + k, sy - 1); dot(sx + k, sy + 1); } }
      var hx = x0 + Math.round(W * 0.7), hy = y0 + Math.max(1, Math.round(H * 0.12)); /* head stitch */
      for (k = 0; k < 3; k++) { dot(hx, hy + k); if (k !== 1) { dot(hx - 1, hy + k); dot(hx + 1, hy + k); } } });
    return fr; }
  if (R && typeof R.petFrames === 'function' && !OFF) { var pf0 = R.petFrames; R.petFrames = function (p, w, extra) { var fr = pf0.apply(this, arguments); return p && p.zombie ? twist(fr, p, w, extra, pf0) : fr; }; }
  /* card styling (labels only; the card frame, outline, fonts and checkbox stay the site's) */
  try { var css = document.createElement('style'); css.id = 'zbCss';
    css.textContent = '.chip.zb-risen{background:#16301c;color:#a8ff7a;border-color:#3f9f4a}.zb-by{margin-top:4px;color:#a8c9a0}.zb-by .addr{color:#c8ffb0}' +
      '.pet.card.zombie canvas.sprite{filter:drop-shadow(0 0 4px rgba(150,255,110,.35))}.chip.zb-pow{border-color:#3f9f4a}';
    (document.head || document.documentElement).appendChild(css); } catch (e) {}
  window.V2Zombies = { KEY: KEY, store: store, apply: apply, off: OFF };
})();
