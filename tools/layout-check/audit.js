/* Layout audit (Nov 25 2026, "perfect on every screen"). Runs INSIDE a page (page.evaluate(src)) and returns a list of problems a
 * player would see: the page wider than the screen, an open sheet whose buttons cannot be reached, a button covered by something
 * else, text cut off, a title that wraps into a wall of huge lines. Display only: it reads the page and changes nothing.
 * Returns [{ kind, where, detail }]. Used by tools/layout-check/run.js. */
(function () {
  var W = innerWidth, H = innerHeight, out = [], seen = {};
  function add(kind, el, detail) { var k = kind + '|' + name(el) + '|' + detail; if (seen[k]) return; seen[k] = 1; out.push({ kind: kind, where: name(el), detail: detail }); }
  function name(el) {
    if (!el || el === document) return 'document';
    var s = [], e = el;
    for (var i = 0; e && e.nodeType === 1 && i < 4; i++, e = e.parentElement) {
      var t = e.tagName.toLowerCase();
      if (e.id) { s.unshift(t + '#' + e.id); break; }
      var c = (typeof e.className === 'string' ? e.className : '').trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.');
      s.unshift(t + (c ? '.' + c : ''));
    }
    var txt = (el.innerText || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 30);
    return s.join(' > ') + (txt ? ' "' + txt + '"' : '');
  }
  function shown(el) {
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    if (el.closest('details:not([open]) > :not(summary)')) return false;
    for (var e = el; e && e.nodeType === 1; e = e.parentElement) {
      var s = getComputedStyle(e);
      if (s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse' || +s.opacity < 0.05) return false;
    }
    var r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1;
  }
  function scrollerX(el) { for (var e = el.parentElement; e && e !== document.body; e = e.parentElement) { var s = getComputedStyle(e); if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) return e; } return null; }
  function scrollerY(el) { for (var e = el.parentElement; e && e !== document.body && e !== document.documentElement; e = e.parentElement) { var s = getComputedStyle(e); if (/(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 2) return e; } return null; }
  function fixedRoot(el) { for (var e = el; e && e.nodeType === 1; e = e.parentElement) { if (getComputedStyle(e).position === 'fixed') return e; } return null; }
  function stickyOf(el) { for (var e = el; e && e.nodeType === 1; e = e.parentElement) { if (getComputedStyle(e).position === 'sticky') return e; } return null; }
  function deco(el) { return el.closest('[aria-hidden="true"],.sr-only,.visually-hidden') || /^(canvas|svg|img|video)$/i.test(el.tagName) && !el.closest('button,a'); }

  /* 1. the page is wider than the screen (sideways scroll) */
  var dx = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  if (dx > 2) {
    var worst = null, wr = 0;
    document.querySelectorAll('body *').forEach(function (el) {
      if (!shown(el) || scrollerX(el)) return; var r = el.getBoundingClientRect();
      if (r.right > W + 2 && r.right > wr && getComputedStyle(el).position !== 'fixed') { wr = r.right; worst = el; }
    });
    add('page-wider-than-screen', worst || document, 'page scrolls sideways by ' + dx + 'px' + (worst ? ' (widest: ' + Math.round(wr) + 'px)' : ''));
  }

  /* 1b. an open dialog that is not on screen (Nov 25 2026: the Grinder's style id clashed with the Mythic God road's, so its dialog
   *     rendered unstyled at the bottom of the page, 6,000-23,000px down: pressing the Grinder looked like nothing happened) */
  Array.prototype.forEach.call(document.querySelectorAll('[aria-modal="true"], [role="dialog"]'), function (el) {
    if (!shown(el) || el.closest('.tut-tip, .tut-point')) return; var r = el.getBoundingClientRect();
    if (!fixedRoot(el) && (r.top > H || r.bottom < 0)) add('dialog-off-screen', el, 'open dialog at ' + Math.round(r.top) + 'px on a ' + H + 'px screen (not pinned over the page)');
  });

  /* which layer is on top: an open sheet means only its controls matter */
  var layers = Array.prototype.filter.call(document.querySelectorAll('body *'), function (el) {
    var s = getComputedStyle(el); if (s.position !== 'fixed') return false; if (!shown(el)) return false;
    var r = el.getBoundingClientRect(); return r.width >= W * 0.6 && r.height >= H * 0.5 && s.pointerEvents !== 'none';
  });
  layers.sort(function (a, b) { return (+getComputedStyle(b).zIndex || 0) - (+getComputedStyle(a).zIndex || 0); });
  var top = layers[0] || null;

  /* 2. controls: off screen with no way to scroll to them, or covered by something else */
  var ctrls = (top || document).querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button], [onclick]');
  Array.prototype.forEach.call(ctrls, function (el) {
    if (!shown(el) || el.disabled || deco(el)) return;
    var r = el.getBoundingClientRect(), fx = fixedRoot(el), sy = scrollerY(el);
    /* clipped by an ancestor's overflow (not a scroller) */
    for (var e = el.parentElement; e && e !== document.body; e = e.parentElement) {
      var cs = getComputedStyle(e); if (!/(hidden|clip)/.test(cs.overflow + cs.overflowX + cs.overflowY)) continue;
      if (/(auto|scroll)/.test(cs.overflowY + cs.overflowX)) continue;
      var pr = e.getBoundingClientRect();
      if (r.bottom > pr.bottom + 4 && r.top > pr.bottom - 4 || r.right > pr.right + 4 && r.left > pr.right - 4) { add('control-cut-off', el, 'hidden outside ' + name(e)); return; }
      break;
    }
    if (fx && !sy) {
      if (r.bottom > H + 2 || r.top < -2 || r.right > W + 2 || r.left < -2) add('control-off-screen', el, 'in a fixed layer at ' + Math.round(r.left) + ',' + Math.round(r.top) + ' (screen ' + W + 'x' + H + '), no scroll reaches it');
    }
    if (r.right > W + 2 && !scrollerX(el) && !fx) add('control-off-screen', el, 'right edge ' + Math.round(r.right) + ' > screen ' + W);
    /* covered: probe the centre and a point near each side, only when on screen */
    if (r.top < 0 || r.bottom > H || r.left < 0 || r.right > W) return;
    var pts = [[r.left + r.width / 2, r.top + r.height / 2]], hidden = 0;
    if (r.width > 24) { pts.push([r.left + 6, r.top + r.height / 2]); pts.push([r.right - 6, r.top + r.height / 2]); }
    var cover = null;
    var sx = scrollerX(el), sxr = sx && sx.getBoundingClientRect(), syr = sy && sy.getBoundingClientRect();
    pts = pts.filter(function (p) { return (!sxr || (p[0] >= sxr.left && p[0] <= sxr.right)) && (!syr || (p[1] >= syr.top && p[1] <= syr.bottom)); }); /* the part scrolled out of its own box */
    pts.forEach(function (p) { var h = document.elementFromPoint(p[0], p[1]); if (!h || h === el || el.contains(h) || h.contains(el)) return;
      var st = stickyOf(h); if (st && (sy || document.scrollingElement.scrollHeight > H) && !st.contains(el)) return; /* a pinned bar the content scrolls under */
      if (!top && h.closest('.tut-tip')) return; /* Coach Peepo's dismissible tip over the page (never over a sheet: css/screens.css) */
      if (h.closest('label') && h.closest('label').contains(el)) return; hidden++; cover = h; });
    if (hidden === pts.length && cover) add('control-covered', el, 'covered by ' + name(cover));
  });

  /* 2b. an open sheet's main button (class btn: Sign & burn, Apply, GRIND...) must be in view without hunting for the sheet's own scroll bar */
  if (top) Array.prototype.forEach.call(top.querySelectorAll('button.btn, a.btn'), function (el) {
    if (!shown(el) || el.disabled) return;
    var sy0 = scrollerY(el); if (!sy0 || el.parentElement !== sy0.lastElementChild) return; /* only the sheet's closing action row */
    var r = el.getBoundingClientRect(), sy = sy0, lim = sy ? sy.getBoundingClientRect() : { top: 0, bottom: H };
    var vb = Math.min(lim.bottom, H), vt = Math.max(lim.top, 0);
    if (r.top >= vb - 4 || r.bottom <= vt + 4) add('sheet-button-out-of-view', el, 'the sheet\'s button sits at ' + Math.round(r.top) + 'px, the sheet shows ' + Math.round(vt) + '..' + Math.round(vb) + 'px');
  });

  /* 2b. squashed cards (Nov 26 2026, Jake's "401 new gear pieces" pop-up showed empty outlines): a grid that has to fit a fixed height
   * shrinks its rows, and a card with overflow:hidden has no minimum height, so its picture and words vanish. The text check below
   * misses it (the card's own text sits in children), so look at every grid item: clipped by more than a few pixels = squashed. */
  Array.prototype.forEach.call((top || document.body).querySelectorAll('*'), function (el) {
    var par = el.parentElement; if (!par || !/grid/.test(getComputedStyle(par).display) || !shown(el)) return;
    var cs = getComputedStyle(el); if (!/(hidden|clip)/.test(cs.overflowY) || el.clientHeight <= 0 || !(el.innerText || '').trim()) return;
    if (el.scrollHeight > el.clientHeight + 8) add('card-squashed', el, 'card ' + el.scrollHeight + 'px tall squeezed into ' + el.clientHeight + 'px (its picture and words are cut off)');
  });
  /* 3. text: cut off inside a box, or a title wrapping into a wall of big lines */
  var textEls = (top || document.body).querySelectorAll('h1,h2,h3,h4,p,div,span,b,strong,button,a,label,li,td,small,em');
  Array.prototype.forEach.call(textEls, function (el) {
    if (!el.firstChild || !shown(el)) return;
    var own = Array.prototype.some.call(el.childNodes, function (n) { return n.nodeType === 3 && n.nodeValue.trim().length > 2; });
    if (!own) return;
    var cs = getComputedStyle(el), r = el.getBoundingClientRect(), fs = parseFloat(cs.fontSize) || 14;
    var lh = parseFloat(cs.lineHeight) || fs * 1.25, lines = Math.round(r.height / lh);
    if (/(hidden|clip)/.test(cs.overflowX) && cs.textOverflow !== 'ellipsis' && el.scrollWidth > el.clientWidth + 3 && cs.whiteSpace !== 'normal' && el.clientWidth > 0) add('text-cut-off', el, 'text ' + el.scrollWidth + 'px in a ' + el.clientWidth + 'px box');
    if (/(hidden|clip)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 4 && el.clientHeight > 0 && !/-webkit-box/.test(cs.display) && !(+cs.webkitLineClamp > 0)) add('text-cut-off', el, 'text ' + el.scrollHeight + 'px tall in a ' + el.clientHeight + 'px box');
    if (fs >= 17 && lines >= 4 && r.height > H * 0.22 && /^(H1|H2|H3|H4|B|STRONG|DIV|SPAN)$/.test(el.tagName)) add('text-wall', el, lines + ' lines at ' + Math.round(fs) + 'px fill ' + Math.round(100 * r.height / H) + '% of the screen height');
    if (fs > Math.max(40, W * 0.12) && el.innerText.trim().length > 12) add('text-oversized', el, Math.round(fs) + 'px text on a ' + W + 'px screen');
  });

  /* 4. an open sheet taller than the screen that cannot scroll */
  layers.forEach(function (L) {
    var kids = [L].concat(Array.prototype.slice.call(L.querySelectorAll('*'))).filter(function (e) { return shown(e); });
    kids.forEach(function (e) {
      var r = e.getBoundingClientRect(); if (r.height < H * 0.5) return;
      if (r.bottom > H + 4 || r.top < -4) {
        var cs = getComputedStyle(e);
        if (!/(auto|scroll)/.test(cs.overflowY) && !scrollerY(e) && !(e === L && /(auto|scroll)/.test(cs.overflowY))) add('sheet-too-tall', e, 'reaches ' + Math.round(r.top) + '..' + Math.round(r.bottom) + ' on a ' + H + 'px screen and nothing scrolls');
      }
    });
  });

  /* 5. a host's speech bubble covered by decoration (Nov 28 2026, Jake: "red candles overlap Mort's speech in the cemetery"). Scenes paint
   * their bubbles in the canvas and copy them onto a .scene-top canvas (V2Sharp.top in js/v2-sharp.js) that must sit above every
   * decoration layer in the scene's box. Flags anything in that box drawn over a shown bubble (a z-index at or above the top canvas). */
  function zIn(e, box) { var z = 0; for (; e && e !== box; e = e.parentElement) { var cs = getComputedStyle(e), v = parseInt(cs.zIndex, 10); if (!isNaN(v) && cs.position !== 'static') z = v; } return z; }
  Array.prototype.forEach.call(document.querySelectorAll('canvas.scene-top'), function (o) {
    if (!o._on || !o._rects || !o._W || !shown(o)) return; var box = o.parentElement, R = o.getBoundingClientRect(), k = R.width / o._W, oz = zIn(o, box);
    o._rects.forEach(function (q) { if (!q) return; var b = { l: R.left + q.x * k, t: R.top + q.y * k, r: R.left + (q.x + q.w) * k, b: R.top + (q.y + q.h) * k };
      Array.prototype.forEach.call(box.querySelectorAll('*'), function (e) { if (e === o || e.tagName === 'CANVAS' || e.contains(o) || !shown(e)) return;
        var r = e.getBoundingClientRect(); if (r.right <= b.l + 1 || r.left >= b.r - 1 || r.bottom <= b.t + 1 || r.top >= b.b - 1) return;
        if (zIn(e, box) >= oz) add('speech-covered', e, 'draws over a speech bubble in ' + name(box)); }); });
  });
  return out;
})()
