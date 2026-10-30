/* v2-zombies (cemetery loop, Oct 29 2026). Risen zombies in My Pets and the other pet lists, from the real engine (js/v2-rules.js, CEMETERY LOOP).
 * The replay gives every risen pet a p.zombie record (isZ). This file only changes how it LOOKS and what the UI offers:
 *  - the sprite gets the shared dead look (js/v2-zombie-look.js) and is drawn at the Mythic pose with the Mythic aura, dim and rot-green
 *    (owner Oct 28 2026: "in my pets looking mythic but zombie"); the stage chip still shows the engine's real stage;
 *  - no normal meals (hungry false, so Feed all and the feed queue skip it); a hunger bar drains instead: full at the raise or the last
 *    zombie meal, feral after 432 blocks, crumbles to dust 432 blocks after that unless it eats pets (pet:zfeed) or wins a hunt.
 * Never adds the fire aura, the grant flame crown or the edition gold frame. ?zombies=off turns the look off for a page view. Display only. */
(function () {
  var M = window.V2Mock, R = window.V2Render, V = function () { return window.V2Rules || window.V2 || {}; };
  var OFF = /[?&]zombies=off\b/.test((window.location && window.location.search) || '');
  function isZ(p) { return !!(p && p.zombie && !p.zombie.end); }
  function apply(w) { if (!w || typeof w !== 'object' || !w.pets || w.__zb === w.tip) return w; w.__zb = w.tip;
    w.pets.forEach(function (p) { if (!isZ(p)) return; p.hungry = false; p.nextMeal = 0; p.fedToday = false; }); return w; }
  if (M && typeof M.world === 'function') { var w0 = M.world; M.world = function () { return apply(w0.apply(this, arguments)); };
    if (typeof M.peek === 'function') { var pk0 = M.peek; M.peek = function () { return apply(pk0.apply(this, arguments)); }; } }
  /* hunger from the engine's block clocks (cemView): 432 blocks from full to feral, then 864 more to dust */
  function view(p, w) { var v = V(); try { return v.cemView ? v.cemView(w, p, (w && w.tip || 0) + 1) : null; } catch (e) { return null; } }
  function hunger(p, w) { var o = view(p, w); if (!o || !o.zombie) return null; var pct = Math.round(o.hunger * 100);
    return { pct: pct, left: o.hungerLeft, feral: o.feral, crumbleIn: o.crumbleIn, power: o.power, times: o.times, milestone: o.milestone, by: o.by }; }
  function span(bl) { var m = Math.round(bl * 10), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60); return d ? d + 'd ' + h + 'h' : h ? h + 'h ' + (m % 60) + 'm' : (m % 60) + 'm'; }
  function hungerTitle(h) { return 'Zombie hunger ' + h.pct + '%. Zombies never take normal meals: they eat pets at the altar or win hunts. Feral after 432 blocks without a zombie meal, then dust 432 blocks later.' +
    (h.feral ? ' FERAL now: anyone can hunt it. Crumbles in ' + h.crumbleIn + ' blocks (~' + span(h.crumbleIn) + ').' : ' Feral in ' + h.left + ' blocks (~' + span(h.left) + ').'); }
  function hungerChip(p, w) { var h = hunger(p, w); if (!h) return ''; var low = h.feral || h.pct <= 33;
    return '<span class="chip zb-hun' + (low ? ' warn' : '') + '" title="' + hungerTitle(h) + '">' + (h.feral ? '👁️ Feral' : '🧟 Hunger') + ' <i class="zb-hb' + (low ? ' low' : '') + '"><b style="width:' + h.pct + '%"></b></i> ' + (h.feral ? 'dust in ' + span(h.crumbleIn) : h.pct + '%') + '</span>'; }
  function hungerBar(p, w) { var h = hunger(p, w); if (!h) return ''; var low = h.feral || h.pct <= 33;
    return '<div class="bar zb-hbar' + (low ? ' low' : '') + '" title="' + hungerTitle(h) + '"><i style="width:' + Math.max(h.pct, 2) + '%"></i></div>' +
      '<div class="small zb-hl">' + (h.feral ? '👁️ Feral: anyone can hunt it · crumbles to dust in ~' + span(h.crumbleIn) : '🍖 Hunger ' + h.pct + '% · feral in ~' + span(h.left)) + ' · eats your pets, not XCPETS meals · pick its pets below</div>'; }
  /* sprite: the shared dead look (js/v2-zombie-look.js) on new frame objects; the keyed copies get the same bites and slouch, and the Mythic aura is
   * rebuilt from them so it traces the zombie's outline. Cached per source frame list, so animation ticks don't redo it. */
  var DONE = typeof WeakMap !== 'undefined' ? new WeakMap() : null, ZF = typeof WeakSet !== 'undefined' ? new WeakSet() : null;
  function keyed(pf, p, w, extra, col) { var a = Object.assign({}, p.art || {}, { background: 'solid', bgColor: col, pattern: 'none' });
    return pf(Object.assign({}, p, { zombie: null, art: a, mutation: null, shows: null }), w, extra); }
  function twist(fr, p, w, extra, pf) { var Z = window.V2ZombieLook; if (!DONE || !Z || !fr || !fr.length || !fr[0] || !fr[0].data) return fr; var fe = false; try { var hh = hunger(p, w); fe = !!(hh && hh.feral); } catch (e) {} var hit = DONE.get(fr); if (hit && hit.__fe === fe) return hit; var A, B;
    try { A = keyed(pf, p, w, extra, '#ff00fe'); B = keyed(pf, p, w, extra, '#00ff01'); } catch (e) { return fr; }
    if (!A || !B || !A.length || !B.length) return fr; var KA = [], KB = [], out;
    try { out = fr.map(function (f, fi) { if (!f || !f.data || f.data.length !== 4096) return f; var r = Z.frame(f.data, A[fi % A.length].data, B[fi % B.length].data, p.id, fi, fr.length, { eyes: (Z.gameEyes && Z.gameEyes(p.art, p.stage, fi)) || (Z.starEyes ? Z.starEyes(p.art, p.stage, fi) : null), feral: fe });
        if (!r) return f; KA.push({ width: 32, height: 32, data: r.ka }); KB.push({ width: 32, height: 32, data: r.kb }); var g = { width: 32, height: 32, data: r.img }; if (f.pid != null) g.pid = f.pid; if (ZF) ZF.add(g); return g; });
      if (KA.length === out.length && R && typeof R.mythFx === 'function' && p.stage === 5) { var o2 = R.mythFx(out, function (bg) { return bg === '#ff00fe' ? KA : KB; }); if (o2 && o2 !== out && ZF) o2.forEach(function (g) { ZF.add(g); }); out = o2 || out; } }
    catch (e) { if (window.console) console.warn('zombie look failed #' + p.id, e); return fr; }
    try { out.__fe = fe; } catch (e) {} DONE.set(fr, out); return out; }
  if (R && typeof R.petFrames === 'function' && !OFF) { var pf0 = R.petFrames; R.petFrames = function (p, w, extra) { var Z = window.V2ZombieLook, self = this, args = arguments; if (!isZ(p)) return pf0.apply(this, arguments);
    /* no Mythic smug hand on zombies (owner Oct 29 2026): the zombie's frames and the keyed copies twist() reads are all drawn inside V2ZombieLook.noHand */
    var q = p.stage === 5 ? p : Object.assign({}, p, { stage: 5, stageName: 'Mythic' }), a2 = [q].concat([].slice.call(args, 1)); /* drawn at the Mythic pose (display only) */
    var run = function () { return twist(pf0.apply(self, a2), q, w, extra, pf0); }; return Z && Z.noHand ? Z.noHand(run) : run(); }; }
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
    css.textContent = '.chip.zb-risen{background:#1b2216;color:#b9c99a;border-color:#4d5a3a}.chip.zb-halo{background:#fffbe6;color:#5a4700;border-color:#c9b24a}.zb-by{margin-top:2px;color:#9aa58c}.zb-by .addr{color:#c3cfae}' +
      'canvas.zb-sprite{filter:drop-shadow(0 0 3px rgba(110,140,60,.22)) saturate(.9)}.mfx.zb-mfx{filter:sepia(1) hue-rotate(42deg) saturate(1.3) brightness(.55) contrast(1.15);opacity:.5}canvas.lkx.zb-mfx{filter:drop-shadow(0 0 3px rgba(110,140,60,.25))}' +
      '.chip.zb-pow{border-color:#4d5a3a}.chip.zb-hun{display:inline-flex;align-items:center;gap:4px}.zb-hb{display:inline-block;width:34px;height:7px;background:#1a1d14;border:1px solid #4d5a3a;vertical-align:middle;position:relative}' +
      '.zb-hb b{display:block;height:100%;background:#8aa04c}.zb-hb.low b{background:#b0653a}.bar.zb-hbar i{background:linear-gradient(90deg,#5d7034,#8aa04c)}.bar.zb-hbar.low i{background:linear-gradient(90deg,#7a3a24,#b0653a)}' +
      '.zb-hl{margin-top:3px;color:#a7b48e}.zb-feed{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:6px}.zb-feed .zb-ml{display:flex;gap:4px;align-items:center;color:#a7b48e;min-width:0}.zb-feed select{max-width:150px;min-width:0}.zb-pickbox{flex:1 1 100%;min-width:0}.zb-pickbox summary{cursor:pointer;color:#c9d6a9}.zb-warn{color:#e3c27a;margin:4px 0}.zb-list{max-height:180px;overflow:auto;display:flex;flex-direction:column;gap:2px;padding:4px;border:1px solid #3b4430;border-radius:6px}.zb-opt{display:flex;gap:6px;align-items:center;font-size:12px}.zb-pend{flex:1 1 100%;color:#e3c27a}.zb-feedbtn:disabled{opacity:.5;cursor:not-allowed}';
    (document.head || document.documentElement).appendChild(css); } catch (e) {}
  window.V2Zombies = { apply: apply, off: OFF, isZ: isZ, hunger: hunger, hungerChip: hungerChip, hungerBar: hungerBar, span: span };
})();
