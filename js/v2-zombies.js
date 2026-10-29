/* v2-zombies (PREVIEW ONLY, cemetery-v2-view, owner Oct 28 2026 10:32 PM CT: risen zombies "should be in my pets looking mythic but zombie").
 * Raising is still a mock: the seance altar (js/v2-cemetery-altar.js, risenCard) writes each raise to localStorage 'xcpets-cem-risen-preview'
 * = { petId: { by, power, base, stats, title, n, at } }. Loaded on play.html only (right after v2-render.js, before v2.js), this file lays that
 * mock state over the world V2Mock hands the UI: the grave comes back alive in the raiser's My Pets as a Mythic-stage pet (stage 5 sprite and the
 * live Mythic aura for its species, dimmed and sickly), with its boosted seance stats. It never takes normal meals (hungry false, so Feed all /
 * feedQueue skip it); a zombie hunger bar drains instead (Oct 29: full at the raise, empty after 432 blocks, then -10% power a day to 50%, never dies).
 * The sprite gets the shared dead look from js/v2-zombie-look.js (Oct 29 2026: 'needs to be way more zombie looking and dead looking'). Nothing is written to the chain, the rules or pet-core.
 * Never adds the fire aura, the grant flame crown or the edition gold frame. ?zombies=off turns the overlay off for a page view. */
(function () {
  var KEY = 'xcpets-cem-risen-preview', M = window.V2Mock, R = window.V2Render;
  var OFF = /[?&]zombies=off\b/.test((window.location && window.location.search) || '');
  function store() { try { var o = JSON.parse(window.localStorage.getItem(KEY) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } }
  function apply(w) { if (OFF || !w || typeof w !== 'object' || !w.byId || w.__zb) return w; var st = store(); w.__zb = true;
    Object.keys(st).forEach(function (k) { var p = w.byId[k], z = st[k]; if (!p || !z || p.released || (!p.dead && !p.zombie)) return;
      p.zombie = { by: z.by || p.owner, power: z.power || 0, base: z.base || 0, title: z.title || '', n: z.n || 0, at: z.at || 0, blk: z.blk || 0, fed: z.fed || 0, fedBlk: z.fedBlk || 0 };
      p.dead = false; if (p.status === 'dead') p.status = 'alive'; p.owner = p.zombie.by; p.stage = 5; p.stageName = 'Mythic'; p.mythicCare = true; p.deathBlock = null; p.neglected = false;
      p.hungry = false; p.nextMeal = 0; p.fedToday = false; if (z.stats && typeof z.stats === 'object') p.stats = Object.assign({}, p.stats || {}, z.stats); });
    return w; }
  if (M && typeof M.world === 'function') { var w0 = M.world; M.world = function () { return apply(w0.apply(this, arguments)); };
    if (typeof M.peek === 'function') { var pk0 = M.peek; M.peek = function () { return apply(pk0.apply(this, arguments)); }; } }
  /* hunger (owner Oct 29 2026): a zombie is full when raised and empty 432 blocks (3 chain days) later; it never takes normal meals (pet:feed), it eats
   * pets. Once empty it gets weaker by 10% a chain day (144 blocks), down to 50% power, and it never dies. Blocks come from the raise block
   * (z.blk, stored by the altar) and the world tip, or from the raise time (10 min a block) when no block was stored. z.fed (time) resets it. */
  var FULL = 432, DAY = 144;
  function hunger(p, w) { var z = p && p.zombie; if (!z) return null; var el = 0, tip = w && +w.tip;
    if (z.fedBlk && tip) el = tip - z.fedBlk; else if (z.blk && tip && tip >= z.blk) el = tip - z.blk; else el = (Date.now() - (z.fed || z.at || Date.now())) / 600000;
    el = Math.max(0, el); var left = Math.max(0, FULL - el), pct = Math.round(100 * left / FULL), days = el > FULL ? Math.floor((el - FULL) / DAY) : 0, weak = Math.min(50, days * 10);
    return { pct: pct, left: Math.round(left), el: Math.round(el), weak: weak, next: el >= FULL && weak < 50 ? Math.round(DAY - (el - FULL) % DAY) : 0, power: Math.round((z.power || 0) * (100 - weak) / 100) }; }
  function span(bl) { var m = Math.round(bl * 10), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60); return d ? d + 'd ' + h + 'h' : h ? h + 'h ' + (m % 60) + 'm' : (m % 60) + 'm'; }
  function hungerTitle(h) { return 'Zombie hunger ' + h.pct + '%. Zombies never take normal meals: they eat pets. Full when raised, empty after 432 blocks (3 chain days), then 10% weaker a day down to 50% power. Never dies.' +
    (h.weak ? ' Starving now: -' + h.weak + '% power.' : h.pct ? ' Empty in ~' + span(h.left) + ' (' + h.left + ' blocks).' : ' Empty now: first -10% in ~' + span(h.next) + '.'); }
  function hungerChip(p, w) { var h = hunger(p, w); if (!h) return ''; var low = h.pct <= 33;
    return '<span class="chip zb-hun' + (low ? ' warn' : '') + '" title="' + hungerTitle(h) + '">🧟 Hunger <i class="zb-hb' + (low ? ' low' : '') + '"><b style="width:' + h.pct + '%"></b></i> ' + (h.weak ? 'starving' : h.pct ? h.pct + '%' : 'empty') + '</span>'; }
  function hungerBar(p, w) { var h = hunger(p, w); if (!h) return ''; var low = h.pct <= 33;
    return '<div class="bar zb-hbar' + (low ? ' low' : '') + '" title="' + hungerTitle(h) + '"><i style="width:' + Math.max(h.pct, h.weak ? 0 : 2) + '%"></i></div>' +
      '<div class="small zb-hl">' + (h.weak ? '🍖 Starving: -' + h.weak + '% power (stops at -50%)' + (h.next ? ', -10% more in ~' + span(h.next) : '') + ', never dies' : h.pct ? '🍖 Hunger ' + h.pct + '% · empty in ~' + span(h.left) : '🍖 Empty: -10% power in ~' + span(h.next) + ', never dies') + ' · eats pets, not meals</div>'; }
  /* sprite: the shared dead look (js/v2-zombie-look.js) on new frame objects; the keyed copies get the same bites and slouch, and the Mythic aura is
   * rebuilt from them so it traces the zombie's outline. Cached per source frame list, so animation ticks don't redo it. */
  var DONE = typeof WeakMap !== 'undefined' ? new WeakMap() : null, ZF = typeof WeakSet !== 'undefined' ? new WeakSet() : null;
  function keyed(pf, p, w, extra, col) { var a = Object.assign({}, p.art || {}, { background: 'solid', bgColor: col, pattern: 'none' });
    return pf(Object.assign({}, p, { zombie: null, art: a, mutation: null, shows: null }), w, extra); }
  function twist(fr, p, w, extra, pf) { var Z = window.V2ZombieLook; if (!DONE || !Z || !fr || !fr.length || !fr[0] || !fr[0].data) return fr; var hit = DONE.get(fr); if (hit) return hit; var A, B;
    try { A = keyed(pf, p, w, extra, '#ff00fe'); B = keyed(pf, p, w, extra, '#00ff01'); } catch (e) { return fr; }
    if (!A || !B || !A.length || !B.length) return fr; var KA = [], KB = [], out;
    try { out = fr.map(function (f, fi) { if (!f || !f.data || f.data.length !== 4096) return f; var r = Z.frame(f.data, A[fi % A.length].data, B[fi % B.length].data, p.id, fi, fr.length, { eyes: Z.starEyes ? Z.starEyes(p.art, p.stage, fi) : null });
        if (!r) return f; KA.push({ width: 32, height: 32, data: r.ka }); KB.push({ width: 32, height: 32, data: r.kb }); var g = { width: 32, height: 32, data: r.img }; if (f.pid != null) g.pid = f.pid; if (ZF) ZF.add(g); return g; });
      if (KA.length === out.length && R && typeof R.mythFx === 'function' && p.stage === 5) { var o2 = R.mythFx(out, function (bg) { return bg === '#ff00fe' ? KA : KB; }); if (o2 && o2 !== out && ZF) o2.forEach(function (g) { ZF.add(g); }); out = o2 || out; } }
    catch (e) { if (window.console) console.warn('zombie look failed #' + p.id, e); return fr; }
    DONE.set(fr, out); return out; }
  if (R && typeof R.petFrames === 'function' && !OFF) { var pf0 = R.petFrames; R.petFrames = function (p, w, extra) { var Z = window.V2ZombieLook, self = this, args = arguments; if (!p || !p.zombie) return pf0.apply(this, arguments);
    /* no Mythic smug hand on zombies (owner Oct 29 2026): the zombie's frames and the keyed copies twist() reads are all drawn inside V2ZombieLook.noHand */
    var run = function () { return twist(pf0.apply(self, args), p, w, extra, pf0); }; return Z && Z.noHand ? Z.noHand(run) : run(); }; }
  /* a zombie keeps the Mythic electric aura, but sickly and dim: the V2Looks aura hook gets a sick flag for zombie frames (rot-green, ~half strength),
   * and the zombie's canvas + its aura overlay get a class (faint rot glow). Display only. */
  var LK = window.V2Looks;
  if (LK && !OFF) { var my0 = LK.myth; if (typeof my0 === 'function') LK.myth = function (img) { var r = my0.apply(this, arguments); if (r && ZF && ZF.has(img)) { r = Object.assign({}, r, { sick: true }); } return r; };
    var at0 = LK.attach; if (typeof at0 === 'function') LK.attach = function (c, img) { var r = at0.apply(this, arguments); try { var z = !!(ZF && img && ZF.has(img)); if (c && c.classList) c.classList.toggle('zb-sprite', z); if (c && c._lkx && c._lkx.classList) c._lkx.classList.toggle('zb-mfx', z); } catch (e) {} return r; }; }
  if (R && typeof R.paint === 'function' && !OFF) { var pt0 = R.paint; R.paint = function (c, img) { var r = pt0.apply(this, arguments); try { var z = !!(ZF && img && ZF.has(img));
      if (c && c.classList) c.classList.toggle('zb-sprite', z); if (c && c._mfx && c._mfx.classList) c._mfx.classList.toggle('zb-mfx', z); } catch (e) {} return r; }; }
  /* the card aura (.mfx overlay) is added by the renderer's own paint, so the canvas is marked when its frames are handed to R.animate, and any aura
   * overlay that appears next to a marked canvas gets the sickly-dim class */
  function zbMark(o) { try { if (o && o.classList && o._c) o.classList.toggle('zb-mfx', !!o._c._zb); } catch (e) {} }
  function zbCv(c, fr) { try { var z = !!(ZF && fr && fr[0] && ZF.has(fr[0])); if (c) { c._zb = z; if (c.classList) c.classList.toggle('zb-sprite', z); if (c._mfx) zbMark(c._mfx); } } catch (e) {} }
  if (R && typeof R.lazy === 'function' && !OFF) { var lz0 = R.lazy; R.lazy = function (c, make, still) { return lz0.call(this, c, function () { var fr = make.apply(this, arguments); zbCv(c, fr); return fr; }, still); }; } /* My Pets cards paint through R.lazy */
  if (R && typeof R.animate === 'function' && !OFF) { var an0 = R.animate; R.animate = function (c, fr) { try { var z = !!(ZF && fr && fr[0] && ZF.has(fr[0])); if (c) { c._zb = z; if (c.classList) c.classList.toggle('zb-sprite', z); } } catch (e) {} var r = an0.apply(this, arguments); if (c && c._mfx) zbMark(c._mfx); return r; }; }
  if (!OFF && typeof MutationObserver !== 'undefined') try { new MutationObserver(function (ms) { ms.forEach(function (m) { for (var i = 0; i < m.addedNodes.length; i++) { var n = m.addedNodes[i]; if (n.nodeType === 1 && n.classList.contains('mfx')) zbMark(n); } }); }).observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}
  /* card styling (labels only; the card frame, outline, fonts and checkbox stay the site's) */
  try { var css = document.createElement('style'); css.id = 'zbCss';
    css.textContent = '.chip.zb-risen{background:#1b2216;color:#b9c99a;border-color:#4d5a3a}.zb-by{margin-top:2px;color:#9aa58c}.zb-by .addr{color:#c3cfae}' +
      'canvas.zb-sprite{filter:drop-shadow(0 0 3px rgba(110,140,60,.22)) saturate(.9)}.mfx.zb-mfx{filter:sepia(1) hue-rotate(42deg) saturate(1.3) brightness(.55) contrast(1.15);opacity:.5}canvas.lkx.zb-mfx{filter:drop-shadow(0 0 3px rgba(110,140,60,.25))}' +
      '.chip.zb-pow{border-color:#4d5a3a}.chip.zb-hun{display:inline-flex;align-items:center;gap:4px}.zb-hb{display:inline-block;width:34px;height:7px;background:#1a1d14;border:1px solid #4d5a3a;vertical-align:middle;position:relative}' +
      '.zb-hb b{display:block;height:100%;background:#8aa04c}.zb-hb.low b{background:#b0653a}.bar.zb-hbar i{background:linear-gradient(90deg,#5d7034,#8aa04c)}.bar.zb-hbar.low i{background:linear-gradient(90deg,#7a3a24,#b0653a)}' +
      '.zb-hl{margin-top:3px;color:#a7b48e}';
    (document.head || document.documentElement).appendChild(css); } catch (e) {}
  window.V2Zombies = { KEY: KEY, store: store, apply: apply, off: OFF, hunger: hunger, hungerChip: hungerChip, hungerBar: hungerBar, FULL: FULL };
})();
