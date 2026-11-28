/* weird-looks-1128 (Jake Nov 28 2026: "lets do something great like this for all the weirds" + "what about mutations too? can that be funner too").
 * DISPLAY ONLY. One look per weird hatch (Tiny, Two-headed, Inverted, Ghost, Backwards, Wrong egg; Giant has its own work), per mutation
 * (Glitch, Palette) and for throwbacks, drawn as a DOM layer over the pet's canvas wherever V2Render paints a pet at card size or bigger:
 * My Pets cards, the pet page, pop-up cards, rankings. Nothing here reads or changes the rules' tables.
 *
 *   V2Render.petFrames -> V2Weird.tag(frames, pet)  marks each frame with frame.wl (what to show); frame.wlBox (where the stamped pet sits,
 *                                                   0..1) comes from V2Render.rareHatchFrames.
 *   V2Render.paint     -> V2Weird.attach(canvas, frame)  adds / updates / removes the layer (a sibling of the canvas, like V2Looks).
 *
 * Rules for the layer: it never covers the pet's head or body where gear goes (Wrong egg: shell halves on the ground, misprinted label;
 * Jake Nov 28: an egg hat would clash with gear), it is pointer-events:none, it skips canvases under 72 px (list rows, thumbnails) and
 * it stops moving with prefers-reduced-motion. Only ~190 pets in the game have any of these, so big lists stay fast.
 * Mythic auras (js/mythic-sig.js) are baked into the frames, so the two never stack. */
(function (root) {
  'use strict';
  if (!root || typeof document === 'undefined') return;
  var WEIRD = { tiny: 'TINY', 'two-headed': '2 HEADS', inverted: 'NEGATIVE', ghost: 'GHOST', backwards: 'BACKWARDS', 'wrong-egg': 'WRONG EGG' };
  var MIN_PX = 72;
  /* the pair the two heads bicker with, picked by pet number */
  var PAIRS = [['buy', 'sell'], ['gm', 'gn'], ['wen', 'soon'], ['mine', 'no, mine'], ['up only', 'down bad'], ['bull', 'bear'], ['hodl', 'dump'], ['left', 'right']];
  /* the shell spot colour of each egg species (Wrong egg), else a colour from the name */
  var EGG = { pepe: '#4caf50', wojak: '#b8b0a0', chud: '#e0a060', bobo: '#7a5230', mumu: '#222222', snibby: '#4fb3ff', dodo: '#8e7cc3', kevin: '#ffcf3c', peepo: '#7ac943', sarutobi: '#c9772b', doge: '#e8b04a', lenny: '#ff9fb0', chad: '#9aa3ad' };
  var THROW = { frost: { y: 0.2, h: 0.2, name: 'FROSTED TIPS' }, socks: { y: 0.84, h: 0.16, name: 'SHADOW SOCKS' }, oddeyes: { y: 0.42, h: 0.18, name: 'ODD EYES' } };
  var PAL_FX = { goldrush: 'coin', ice: 'snow', toxic: 'bubble', sunset: 'ray', shadow: 'ember', neon: 'neon', pastel: 'heart', rarepepe: 'shine' };

  function sl(s) { var V = root.V2Rules; try { return V && V.speciesLabel ? V.speciesLabel(s) : s; } catch (e) { return s; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /** infoOf(pet): what the layer shows, or null. A weird hatch wins over a mutation, a mutation over a throwback. */
  function infoOf(p) {
    if (!p || p.dead || p.released) return null;
    var r = (p.art && p.art.rareHatch) || p.rareHatch;
    if (r && r.version === 1 && WEIRD[r.kind]) return { k: r.kind, id: p.id, exp: r.expected || null, act: r.actual || p.species };
    var m = p.mutation;
    if (m && (m.kind === 'glitch' || m.kind === 'palette')) return { k: m.kind, id: p.id, set: m.set || null };
    if (p.shows && THROW[p.shows]) return { k: 'throwback', id: p.id, t: p.shows };
    return null;
  }
  function keyOf(i) { return i.k + '|' + i.id + '|' + (i.set || i.t || i.exp || ''); }
  /** tag(frames, pet): called at the end of V2Render.petFrames. Plain properties so copies of a frame keep them. */
  function tag(fr, p) { var i = infoOf(p); if (!i || !fr || !fr.length) return fr; for (var n = 0; n < fr.length; n++) if (fr[n] && typeof fr[n] === 'object') fr[n].wl = i; return fr; }

  /* ---------------- styles (one sheet, injected once) ---------------- */
  var CSS = [
    '.wl{position:absolute;pointer-events:none;margin:0;padding:0;z-index:2;overflow:visible;font:700 1em/1.1 ui-monospace,Menlo,Consolas,monospace;color:#fff;box-sizing:border-box}',
    '.wl *{position:absolute;pointer-events:none;box-sizing:border-box;text-decoration:none;font-style:normal}',
    '.wl .wl-tag{top:.35em;left:.35em;padding:.18em .45em;font-size:.72em;letter-spacing:.06em;background:var(--wl-c,#ff5fa2);color:var(--wl-t,#fff);border:2px solid #0c0914;transform:rotate(-4deg);white-space:nowrap;box-shadow:0 2px 0 #0c0914}',
    '.wl .wl-bub{font-size:.8em;padding:.2em .45em;background:#fff;color:#0c0914;border:2px solid #0c0914;white-space:nowrap;opacity:0;animation:wlBub 6s steps(1,end) infinite}',
    '.wl .wl-bub:after{content:"";position:absolute;left:.5em;bottom:-.5em;border:.3em solid transparent;border-top:.3em solid #0c0914}',
    '@keyframes wlBub{0%{opacity:0}8%{opacity:1}40%{opacity:0}100%{opacity:0}}',
    /* Tiny: a magnifying glass over the little pet */
    '.wl-tiny .wl-lens{border-radius:50%;border:.28em solid #ffcf3c;box-shadow:0 0 0 .14em #0c0914,inset 0 0 0 .1em #0c0914;overflow:hidden;background:#2b2246;animation:wlLens 7s ease-in-out infinite}',
    '@keyframes wlLens{0%,38%{opacity:0;scale:.6}48%,92%{opacity:1;scale:1}100%{opacity:0;scale:.6}}',
    '.wl-tiny .wl-lens canvas{left:0;top:0;width:100%;height:100%;image-rendering:pixelated}',
    '.wl-tiny .wl-lens:before{content:"";position:absolute;left:18%;top:16%;width:16%;height:7%;background:rgba(255,255,255,.55);z-index:1}',
    '.wl-tiny .wl-handle{width:.5em;height:2.2em;background:#8a5a2b;border:2px solid #0c0914;transform:rotate(-45deg);transform-origin:top center;animation:wlLens 7s ease-in-out infinite}',
    '@keyframes wlBob{0%,100%{translate:0 0}50%{translate:0 -.25em}}',
    /* Two-headed: the heads bicker */
    '.wl-two-headed .wl-r{animation-delay:1.6s}',
    /* Inverted: film negative edges + a blink to its real colours */
    '.wl-inverted .wl-film{top:0;bottom:0;width:.6em;background:repeating-linear-gradient(#e8e2f7 0 .35em,#1a1428 .35em .9em,#e8e2f7 .9em 1.25em);border:1px solid #e8e2f7}',
    '.wl-inverted .wl-fl{left:0}.wl-inverted .wl-fr{right:0}',
    'canvas.wl-neg{animation:wlNeg 5s steps(1,end) infinite}',
    '@keyframes wlNeg{0%{filter:none}90%{filter:invert(1)}93%{filter:none}}',
    /* Ghost */
    '.wl-ghost{--wl-c:#9fd8ff;--wl-t:#0c0914}',
    /* Backwards: moonwalk */
    '.wl-backwards{--wl-c:#b6ff3c;--wl-t:#0c0914}',
    '.wl-backwards .wl-tag{transform:rotate(6deg) scaleX(-1)}',
    '.wl-backwards .wl-moon{left:6%;bottom:5%;font-size:1.35em;color:#ffcf3c;text-shadow:0 2px 0 #0c0914;letter-spacing:-.1em;animation:wlMoon 2.4s linear infinite}',
    '@keyframes wlMoon{0%{translate:1.4em 0;opacity:0}20%{opacity:1}80%{opacity:1}100%{translate:-.4em 0;opacity:0}}',
    /* Wrong egg: the shell it came out of lies on the ground + a misprinted label */
    '.wl-wrong-egg{--wl-c:#ffd23c;--wl-t:#0c0914}',
    '.wl-wrong-egg .wl-shell{bottom:2%;width:25%;height:18%}',
    '.wl-wrong-egg .wl-sl{left:2%;transform:rotate(-24deg)}.wl-wrong-egg .wl-sr{right:2%;transform:scaleX(-1) rotate(-14deg)}',
    '.wl-wrong-egg .wl-mis{left:.35em;top:.35em;font-size:.68em;white-space:nowrap;padding:.15em .35em;background:rgba(12,9,20,.72)}',
    '.wl-wrong-egg .wl-mis del{position:static;color:#fff;text-decoration:line-through 2px #ff4f4f}',
    '.wl-wrong-egg .wl-mis em{position:static;color:#ffd23c;display:inline-block;transform:rotate(-6deg);margin-left:.3em;font-family:"Comic Sans MS","Marker Felt",cursive;font-weight:400}',
    '.wl-wrong-egg .wl-stamp{right:6%;bottom:22%;font-size:.48em;color:#ff4f4f;border:2px solid #ff4f4f;padding:.1em .3em;transform:rotate(-14deg);opacity:.85;text-align:center;line-height:1.05}',
    /* Glitch mutation: the card tears */
    '.wl-glitch{--wl-c:#ff4fd8}',
    '.wl-glitch .wl-scan{inset:0;background:repeating-linear-gradient(rgba(0,0,0,.2) 0 1px,transparent 1px 3px)}',
    '.wl-glitch .wl-tear{left:0;top:0;width:100%;height:100%;image-rendering:pixelated;opacity:0;animation:wlTear 3.4s steps(1,end) infinite}',
    '@keyframes wlTear{0%{opacity:0}62%{opacity:1;translate:.5em 0}65%{opacity:0}80%{opacity:1;translate:-.35em 0}82%{opacity:0}}',
    '.wl-glitch .wl-err{left:.2em;bottom:.2em;font-size:.7em;color:#3cf6ff;text-shadow:2px 0 #ff4fd8;animation:wlBub 3.4s steps(1,end) infinite}',
    'canvas.wl-split{filter:drop-shadow(-2px 0 0 #3cf6ff) drop-shadow(2px 0 0 #ff4fd8)}',
    /* Palette mutation: the palette owns the card */
    '.wl-palette .wl-fx{inset:0;overflow:hidden}',
    '.wl-palette .wl-fx u{width:.42em;height:.42em;top:-.6em;background:var(--wl-c);border:1px solid #0c0914;animation:wlFall 3.6s linear infinite}',
    '@keyframes wlFall{0%{translate:0 0;opacity:0}10%{opacity:1}100%{translate:0 9em;opacity:0}}',
    '.wl-palette .wl-fx.fx-snow u{background:#fff;border-radius:50%;border:0;width:.3em;height:.3em}',
    '.wl-palette .wl-fx.fx-bubble u{top:auto;bottom:-.6em;border-radius:50%;background:rgba(180,255,0,.55);animation-name:wlRise}',
    '.wl-palette .wl-fx.fx-ember u{top:auto;bottom:-.6em;width:.25em;height:.25em;background:#ff8a3c;border:0;animation-name:wlRise}',
    '.wl-palette .wl-fx.fx-heart u{background:none;border:0;width:auto;height:auto;font-size:.6em}',
    '.wl-palette .wl-fx.fx-heart u:before{content:"\\2665";color:#f7a8c4}',
    '@keyframes wlRise{0%{translate:0 0;opacity:0}15%{opacity:1}100%{translate:0 -9em;opacity:0}}',
    '.wl-palette .wl-fx.fx-ray{background:repeating-conic-gradient(from 0deg at 50% 110%,rgba(255,226,154,.22) 0 4deg,transparent 4deg 14deg);-webkit-mask:linear-gradient(#000,transparent 70%);mask:linear-gradient(#000,transparent 70%)}',
    '.wl-palette .wl-fx.fx-shine{background:linear-gradient(115deg,transparent 40%,rgba(255,255,255,.35) 50%,transparent 60%) no-repeat;background-size:300% 100%;animation:wlShine 3.5s linear infinite}',
    '@keyframes wlShine{0%{background-position:120% 0}100%{background-position:-20% 0}}',
    'canvas.wl-neon{animation:wlNeon 2.6s steps(1,end) infinite}',
    '@keyframes wlNeon{0%{filter:none}70%{filter:brightness(1.35) saturate(1.4)}74%{filter:none}80%{filter:brightness(1.35) saturate(1.4)}83%{filter:none}}',
    /* Throwback */
    '.wl-throwback{--wl-c:#9fe8ff;--wl-t:#0c0914}',
    '.wl-throwback .wl-ring{left:18%;width:64%;border:2px dashed #9fe8ff;border-radius:50%;box-shadow:0 0 0 2px rgba(12,9,20,.6);animation:wlPulse 2.4s ease-in-out infinite}',
    '@keyframes wlPulse{0%,100%{opacity:.45;scale:1}50%{opacity:1;scale:1.06}}',
    '.rare-badge[data-rare="backwards"]>span:last-child{display:inline-block;transform:scaleX(-1)}',
    '@media (prefers-reduced-motion: reduce){.wl,.wl *,canvas.wl-neg,canvas.wl-neon{animation:none!important}.wl .wl-bub{opacity:1}.wl-glitch .wl-tear{opacity:0}}'
  ].join('\n');
  var styled = false;
  function style() { if (styled) return; styled = true; var s = document.createElement('style'); s.id = 'weird-looks-css'; s.textContent = CSS; (document.head || document.documentElement).appendChild(s); }

  /* the bottom half of a cracked egg, as a tiny pixel SVG (spots in the egg species' colour) */
  function shellSvg(col) {
    return '<svg viewBox="0 0 22 14" width="100%" height="100%" shape-rendering="crispEdges" aria-hidden="true">' +
      '<path d="M0 2 L3 4 L5 1 L8 4 L11 1 L14 4 L17 1 L19 4 L22 2 L22 8 L19 13 L3 13 L0 8 Z" fill="#0c0914"/>' +
      '<path d="M1.5 4 L3 5.6 L5 3 L8 5.8 L11 3 L14 5.8 L17 3 L19 5.6 L20.5 4 L20.5 7.8 L18.2 11.8 L3.8 11.8 L1.5 7.8 Z" fill="#f4ecd8"/>' +
      '<path d="M3 5.6 L5 3 L8 5.8 L11 3 L14 5.8 L17 3 L19 5.6 L19 7 L3 7 Z" fill="#d9cfb8"/>' +
      '<rect x="5" y="8" width="3" height="2" fill="' + col + '"/><rect x="13" y="9" width="3" height="2" fill="' + col + '"/></svg>';
  }
  function palSet(set) { var V = root.V2Rules, S = V && V.PALETTE_SETS && V.PALETTE_SETS[set]; return S || null; }
  function delay(id, span) { return ((Number(id) * 7919) % (span * 10)) / 10; }

  function build(c, i) {
    var o = document.createElement('div'); o.className = 'wl wl-' + i.k; o.setAttribute('aria-hidden', 'true'); o._k = keyOf(i); o._i = i;
    var d = delay(i.id, 6), h = '';
    if (i.k === 'tiny') h = '<i class="wl-handle"></i><i class="wl-lens"><canvas width="64" height="64"></canvas></i><b class="wl-tag">TINY</b><s class="wl-bub wl-hi" style="animation-delay:' + d + 's">hi!</s>';
    else if (i.k === 'two-headed') { var P = PAIRS[Math.abs(Number(i.id) || 0) % PAIRS.length]; h = '<s class="wl-bub wl-l" style="animation-delay:' + d + 's">' + esc(P[0]) + '</s><s class="wl-bub wl-r" style="animation-delay:' + (d + 1.6) + 's">' + esc(P[1]) + '</s><b class="wl-tag" style="--wl-c:#ff8a3c">2 HEADS</b>'; }
    else if (i.k === 'inverted') { h = '<i class="wl-film wl-fl"></i><i class="wl-film wl-fr"></i><b class="wl-tag" style="--wl-c:#3cc8ff;--wl-t:#0c0914">INVERTED</b>'; c.classList.add('wl-neg'); c.style.animationDelay = (-d) + 's'; }
    else if (i.k === 'ghost') h = '<s class="wl-bub wl-boo" style="animation-delay:' + d + 's">boo</s><b class="wl-tag">GHOST</b>';
    else if (i.k === 'backwards') h = '<i class="wl-moon">&#9664;&#9664;&#9664;</i><b class="wl-tag">BACKWARDS</b>';
    else if (i.k === 'wrong-egg') { var col = EGG[i.exp] || '#4fb3ff'; o.style.boxShadow = 'inset 0 0 0 3px ' + col;
      h = '<i class="wl-shell wl-sl">' + shellSvg(col) + '</i><i class="wl-shell wl-sr">' + shellSvg(col) + '</i><s class="wl-bub wl-that" style="animation-delay:' + d + 's">THAT?!</s>' +
        '<b class="wl-stamp">RETURN<br>TO SENDER</b>' +
        (i.exp ? '<b class="wl-mis"><del>' + esc(String(sl(i.exp)).toUpperCase()) + ' EGG</del><em>' + esc(String(sl(i.act || '')).toLowerCase()) + '??</em></b>' : ''); }
    else if (i.k === 'glitch') { h = '<canvas class="wl-tear" width="64" height="64"></canvas><i class="wl-scan"></i><b class="wl-err" style="animation-delay:' + d + 's">ERR_404</b><b class="wl-tag">GLITCH</b>'; c.classList.add('wl-split'); }
    else if (i.k === 'palette') { var S = palSet(i.set), ramp = S ? S.ramp : ['#333', '#888', '#ccc', '#fff'], fx = PAL_FX[i.set] || 'coin';
      o.style.setProperty('--wl-c', ramp[2]); o.style.setProperty('--wl-t', '#0c0914'); o.style.boxShadow = 'inset 0 0 0 3px ' + ramp[1] + ',inset 0 0 0 5px ' + ramp[3];
      var u = ''; if (fx === 'coin' || fx === 'snow' || fx === 'bubble' || fx === 'ember' || fx === 'heart') for (var n = 0; n < 6; n++) u += '<u style="left:' + (8 + n * 15 + (n % 2) * 4) + '%;animation-delay:' + ((n * 0.6 + d) % 3.6).toFixed(2) + 's"></u>';
      h = '<i class="wl-fx fx-' + fx + '">' + u + '</i><b class="wl-tag">' + esc(S ? S.label.toUpperCase() : 'PALETTE') + '</b>'; if (fx === 'neon') c.classList.add('wl-neon'); }
    else if (i.k === 'throwback') { var T = THROW[i.t]; h = '<i class="wl-ring" style="top:' + ((T.y - T.h / 2) * 100) + '%;height:' + (T.h * 100) + '%"></i><b class="wl-tag">' + esc(T.name) + '</b>'; }
    o.innerHTML = h; c.parentNode.insertBefore(o, c.nextSibling); c._wlx = o; o._c = c; if (ro) ro.observe(c); return o;
  }
  function detach(c) { var o = c._wlx; if (o && o.parentNode) o.parentNode.removeChild(o); c._wlx = null; c.classList.remove('wl-neg', 'wl-split', 'wl-neon'); if (ro) ro.unobserve(c); }
  function place(c) { var o = c._wlx; if (!o) return; var w = c.offsetWidth, h = c.offsetHeight; o.style.left = c.offsetLeft + 'px'; o.style.top = c.offsetTop + 'px'; o.style.width = w + 'px'; o.style.height = h + 'px';
    o.style.fontSize = Math.max(9, Math.min(18, Math.round(w / 12))) + 'px'; o._pos = c.offsetLeft + ',' + c.offsetTop + ',' + w + ',' + h; o._box = null; }
  var ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(function (es) { es.forEach(function (e) { if (e.target._wlx) place(e.target); }); }) : null;

  /* lens and bubble positions follow where the pet really is (frame.wlBox) */
  function fit(o, c, box) { var k = o._i.k, b = box || [0.2, 0.25, 0.8, 0.95], key = b.join(','); if (o._box === key) return; o._box = key;
    var W = c.offsetWidth, cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, q = function (sel) { return o.querySelector(sel); };
    if (k === 'tiny') { var D = Math.round(W * 0.56), L = q('.wl-lens'), H = q('.wl-handle'), hi = q('.wl-hi'); var lx = Math.max(0, Math.min(W - D, cx * W - D / 2)), ly = Math.max(0, Math.min(W - D, cy * W - D / 2));
      L.style.width = L.style.height = D + 'px'; L.style.left = lx + 'px'; L.style.top = ly + 'px'; H.style.left = (lx + D * 0.86) + 'px'; H.style.top = (ly + D * 0.82) + 'px'; hi.style.left = Math.min(W * 0.7, lx + D * 0.75) + 'px'; hi.style.top = Math.max(-8, ly - W * 0.16) + 'px'; o._lens = { cx: cx, cy: cy, r: D / W / 1.4 / 2 }; }
    else if (k === 'two-headed') { var l = q('.wl-l'), r = q('.wl-r'); l.style.left = Math.max(-W * 0.06, b[0] * W - W * 0.04) + 'px'; l.style.top = Math.max(-W * 0.12, b[1] * W - W * 0.22) + 'px'; r.style.right = Math.max(-W * 0.06, (1 - b[2]) * W - W * 0.04) + 'px'; r.style.top = l.style.top; }
    else if (k === 'ghost' || k === 'wrong-egg') { var bb = q('.wl-bub'); bb.style.left = Math.min(W * 0.66, b[2] * W - W * 0.04) + 'px'; bb.style.top = Math.max(0, b[1] * W - W * 0.02) + 'px'; } }
  /* per-paint work: the lens shows the current frame twice as big, the glitch tear copies a band of it */
  function frame(o, c) { var k = o._i.k;
    if (k === 'tiny' && o._lens) { var lc = o.querySelector('.wl-lens canvas'), g = lc && lc.getContext('2d'); if (!g) return; var S = c.width, r = o._lens.r * S * 2, sx = o._lens.cx * S - r / 2, sy = o._lens.cy * S - r / 2;
      g.imageSmoothingEnabled = false; g.clearRect(0, 0, 64, 64); try { g.drawImage(c, sx, sy, r, r, 0, 0, 64, 64); } catch (e) {} }
    else if (k === 'glitch') { var tc = o.querySelector('.wl-tear'), t = tc && tc.getContext('2d'); if (!t) return; var S2 = c.width, by = Math.floor(S2 * (0.3 + ((o._n = (o._n || 0) + 1) % 5) * 0.09)), bh = Math.max(2, Math.floor(S2 / 8));
      if (tc.width !== S2) tc.width = tc.height = S2; t.imageSmoothingEnabled = false; t.clearRect(0, 0, S2, S2); try { t.drawImage(c, 0, by, S2, bh, 0, by, S2, bh); } catch (e) {} } }

  /** attach(canvas, frame): from V2Render.paint, after the frame is drawn. */
  function attach(c, img) {
    try {
      var i = img && img.wl; if (!i) { if (c._wlx) detach(c); return; } if (!c.parentNode) return; style();
      var w = c.offsetWidth; if (w < MIN_PX) { if (c._wlx) detach(c); return; }
      var o = c._wlx; if (!o || !o.isConnected || o.parentNode !== c.parentNode || o._k !== keyOf(i)) { if (o) detach(c); o = build(c, i); place(c); }
      else if (o._pos !== c.offsetLeft + ',' + c.offsetTop + ',' + w + ',' + c.offsetHeight) place(c);
      fit(o, c, img.wlBox); frame(o, c);
    } catch (e) { if (root.console) console.warn('weird look skipped', e); }
  }
  root.V2Weird = { tag: tag, attach: attach, detach: detach, infoOf: infoOf, WEIRD: WEIRD, MIN_PX: MIN_PX };
})(typeof window !== 'undefined' ? window : null);
