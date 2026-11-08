/* rare-discover-1107: The Rare Room hall of finds (rare-room.html #rareHall). DISPLAY ONLY: reads the replayed world (V2Mock.world) and each pet's
 * art.rareHatch (set by V2Rules rareApply) through V2Render.rareInfo. Never touches rules, burns or the replay. No dropdowns: one row of plain buttons.
 * rare-room-perf-1107: the hall used to build every card at once and run petFrames (all frames, rare-scene redraws included) for every canvas near the
 * screen in one tight turn, which locked the main thread on laptop and phone. Now: a window of cards (more load as you scroll), sprite frames
 * cached per look and painted one pet per turn, and one 300 ms timer for the visible sprites that stops off screen and in a hidden tab. */
(function () {
  'use strict';
  var ODDS = [['🎧', 'DJ Pepe', 'Legend', '1 in 3,888'], ['🧙', 'Wizard', 'Legend', '1 in 7,777'], ['🐸', 'Lord Kek', 'Legend', '1 in 7,777'], ['🌌', 'Starlord Kek', 'God pet', '1 in 77,777']];
  var WEIRD = ['Tiny', 'Giant', 'Two-headed', 'Inverted', 'Ghost', 'Backwards', 'Wrong egg'];
  var show = 'all', worldRef = null, listAll = null, list = [], shown = 0, q = [], pumpT = 0, timer = 0, fi = 0, hotAt = 0;
  var cache = new Map(), live = new Map();
  var RM = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return Number(n).toLocaleString('en-US'); }
  function reduced() { return !!(RM && RM.matches); }
  function finds(w) { var R = window.V2Render, out = []; if (!R || !R.rareInfo || !w || !w.pets) return out; w.pets.forEach(function (p) { var i = R.rareInfo(p); if (i) out.push({ p: p, i: i }); });
    out.sort(function (a, b) { return (b.i.legend - a.i.legend) || (b.i.god - a.i.god) || (a.i.block || a.p.hatchBlock || 0) - (b.i.block || b.p.hatchBlock || 0) || a.p.id - b.p.id; }); return out; }
  function css() { if ($('rhCss')) return; var s = document.createElement('style'); s.id = 'rhCss';
    s.textContent = '#rareHall .rh-odds{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:8px 0}' +
      '#rareHall .rh-o{border:3px solid #000;box-shadow:3px 3px 0 #000;background:#2a1450;color:#fff3b0;padding:8px;text-align:center}#rareHall .rh-o b{display:block;font-size:15px}#rareHall .rh-o .rh-n{font-family:"Press Start 2P",monospace;font-size:11px;color:#ffcf3a;margin-top:4px}' +
      '#rareHall .rh-o.rh-w{background:#13351f;color:#dfffe8}#rareHall .rh-o.rh-w .rh-n{color:#7dff9a}#rareHall .rh-o.rh-g{background:#0d1f3d;color:#e6fbff}#rareHall .rh-o.rh-g .rh-n{color:#7fe8ff}' +
      '#rareHall .rh-tabs{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}#rareHall .rh-tabs .on{background:#E8B33A;color:#100E14}' +
      '#rareHall .rh-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}' +
      '#rareHall .rh-card{display:flex;flex-direction:column;align-items:center;gap:4px;border:3px solid #000;box-shadow:3px 3px 0 #000;background:#1b1440;padding:8px;color:#fff;text-decoration:none;text-align:center}' +
      '#rareHall .rh-card canvas{width:96px;height:96px;image-rendering:pixelated;background:#25195a;border:2px solid #000}#rareHall .rh-card .rh-nm{font-weight:bold}#rareHall .rh-card .small{color:#cfd6ff}' +
      '#rareHall .rh-none{padding:12px;text-align:center}#rareHall .rh-more{grid-column:1/-1;height:1px}' +
      '@media(max-width:520px){#rareHall .rh-grid{grid-template-columns:repeat(2,1fr)}#rareHall .rh-card canvas{width:72px;height:72px}}';
    document.head.appendChild(s); }
  function pageSize() { if (!window.IntersectionObserver) return 1e6; var w = window.innerWidth || (document.documentElement && document.documentElement.clientWidth) || 800; return w <= 520 ? 8 : 16; }
  function shell() { var box = $('rareHall'); if (!box || box.getAttribute('data-ready')) return box; box.setAttribute('data-ready', '1'); css();
    box.innerHTML = '<h2 class="sec" data-ico="egg">🏆 Hall of Rare Finds</h2>' +
      '<p class="small">Every hatch has a tiny chance to crack open a Legend, a God pet or a weird pet. Here is every one found so far, live from the chain.</p>' +
      '<div class="rh-odds">' + ODDS.map(function (o) { return '<div class="rh-o' + (o[2] === 'God pet' ? ' rh-g' : '') + '"><span aria-hidden="true">' + o[0] + '</span><b>' + o[1] + '</b><span class="small">' + o[2] + '</span><div class="rh-n">' + o[3] + '</div></div>'; }).join('') +
      '<div class="rh-o rh-w"><span aria-hidden="true">🌀</span><b>Weird hatch</b><span class="small">' + WEIRD.join(' · ') + '</span><div class="rh-n">about 1 in 5,400 each</div></div>' +
      '<div class="rh-o rh-w"><span aria-hidden="true">🧬</span><b>Weird babies</b><span class="small">each weird parent passes its weirdness on</span><div class="rh-n">1 in 77</div></div></div>' +
      '<div class="rh-tabs" role="group" aria-label="Show"><button type="button" class="btn ghost q on" data-rh="all" aria-pressed="true">All finds <span class="rh-c" data-c="all"></span></button><button type="button" class="btn ghost q" data-rh="legend" aria-pressed="false">🏆 Legends <span class="rh-c" data-c="legend"></span></button><button type="button" class="btn ghost q" data-rh="weird" aria-pressed="false">🌀 Weird <span class="rh-c" data-c="weird"></span></button></div>' +
      '<div class="rh-grid" id="rhGrid"><div class="rh-none muted">Reading the chain…</div></div>';
    box.querySelector('.rh-tabs').addEventListener('click', function (e) { var b = e.target.closest('[data-rh]'); if (!b) return; show = b.getAttribute('data-rh'); applyFilter(); });
    var g = $('rhGrid');
    g.addEventListener('focusin', function () { var cards = g.querySelectorAll('.rh-card'), last = cards[cards.length - 1]; if (last && (document.activeElement === last || last.contains(document.activeElement))) more(); });
    if (window.IntersectionObserver) {
      cvIO = new IntersectionObserver(function (es) { es.forEach(function (e) { var cv = e.target; cv._rhVis = e.isIntersecting; if (e.isIntersecting) enqueue(cv); }); syncLoop(); }, { rootMargin: '48px' });
      moreIO = new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) more(); }, { rootMargin: '0px' });
    }
    if (window.ResizeObserver) new ResizeObserver(function () { hotAt = performance.now(); }).observe(box);
    window.addEventListener('scroll', function () { hotAt = performance.now(); }, { passive: true });
    document.addEventListener('visibilitychange', syncLoop);
    if (RM.addEventListener) RM.addEventListener('change', syncLoop);
    return box; }
  function filtered() { return !listAll ? [] : listAll.filter(function (x) { return show === 'all' || (show === 'legend' ? x.i.legend : !x.i.legend); }); }
  function counts() { var c = { all: listAll ? listAll.length : 0, legend: listAll ? listAll.filter(function (x) { return x.i.legend; }).length : 0 }; c.weird = c.all - c.legend; return c; }
  function paintCounts(box) { var c = counts(); Array.prototype.forEach.call(box.querySelectorAll('.rh-c'), function (s) { s.textContent = '(' + c[s.getAttribute('data-c')] + ')'; });
    Array.prototype.forEach.call(box.querySelectorAll('[data-rh]'), function (b) { var on = b.getAttribute('data-rh') === show; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }); }
  function cardHtml(x) { var p = x.p, R = window.V2Render, w = worldRef; return '<a class="rh-card" href="pet.html?id=' + p.id + '"><canvas width="32" height="32" data-rh-id="' + p.id + '"></canvas>' + (R && R.rareChip ? R.rareChip(w, p) : '') +
    '<span class="rh-nm">#' + p.id + ' ' + esc(p.name || '') + '</span><span class="small">' + esc(window.V2Rules && V2Rules.speciesLabel ? V2Rules.speciesLabel(p.species) : p.species) + (x.i.block ? ' · block ' + fmt(x.i.block) : '') + (p.dead ? ' · in the Pet Cemetery' : '') + '</span></a>'; }
  function emptyHtml() { return '<div class="rh-none muted">' + (show === 'weird' ? 'No weird pets yet. Who will be first?' : show === 'legend' ? 'No Legends yet. Who will be first?' : 'Nothing found yet. Who will be first?') + '</div>'; }
  function skey(p, w) { var R = window.V2Render; try { if (R && R.frKey) return R.frKey(p, w); } catch (e) {} var r = p.art && p.art.rareHatch; return p.id + '|' + p.stage + '|' + (r && r.kind) + '|' + (r && r.block); }
  function blit(cv, fr) { var R = window.V2Render, img = fr && fr.length ? fr[reduced() ? 0 : (fi % fr.length)] : null; if (!img) return;
    if (R && R.paint) { try { R.paint(cv, img); return; } catch (e) {} }
    var src = img.rareScene || img, w = src.width || 32, h = src.height || 32; if (cv.width !== w) cv.width = w; if (cv.height !== h) cv.height = h;
    try { cv.getContext('2d').putImageData(new ImageData(src.data instanceof Uint8ClampedArray ? src.data : new Uint8ClampedArray(src.data), w, h), 0, 0); } catch (e2) {} }
  function paintCv(cv, fr) { blit(cv, fr); if (!reduced() && fr && fr.length > 1 && cv._rhVis) live.set(cv, fr); else live.delete(cv); }
  function enqueue(cv) { if (!cv || cv._rhDone || cv._rhPend || !worldRef) return; var p = worldRef.byId && worldRef.byId[cv.getAttribute('data-rh-id')]; if (!p) return;
    var k = skey(p, worldRef), hit = cache.get(k); if (hit) { paintCv(cv, hit); cv._rhDone = 1; syncLoop(); return; }
    cv._rhPend = 1; q.push({ cv: cv, p: p, k: k }); pump(); }
  function pump() { if (pumpT) return; pumpT = setTimeout(runJob, performance.now() - hotAt < 120 ? 90 : 24); }
  function runJob() { pumpT = 0; var job = q.shift(); while (job && !job.cv.isConnected) job = q.shift(); if (!job) { syncLoop(); return; }
    job.cv._rhPend = 0; if (!job.cv._rhVis) { if (q.length) pump(); return; }
    var R = window.V2Render, fr = cache.get(job.k);
    if (!fr && R && R.petFrames) { try { fr = R.petFrames(job.p, worldRef); } catch (e) { fr = null; } if (fr && fr.length) { if (cache.size > 240) cache.clear(); cache.set(job.k, fr); } }
    if (fr && fr.length && job.cv.isConnected) { paintCv(job.cv, fr); job.cv._rhDone = 1; }
    if (q.length) pump(); else syncLoop(); }
  function anyLive() { var on = false; live.forEach(function (fr, cv) { if (cv.isConnected && cv._rhVis && fr && fr.length > 1) on = true; else live.delete(cv); }); return on; }
  function step() { if (document.hidden || reduced()) { stop(); return; } fi++; var n = 0; live.forEach(function (fr, cv) { if (!cv.isConnected || !cv._rhVis || !fr || fr.length < 2) { live.delete(cv); return; } blit(cv, fr); n++; }); if (!n) stop(); }
  function stop() { if (timer) { clearInterval(timer); timer = 0; } }
  function syncLoop() { if (document.hidden || reduced() || !anyLive()) { stop(); return; } if (!timer) timer = setInterval(step, 300); }
  var cvIO = null, moreIO = null;
  function watch(g) { g.querySelectorAll('canvas[data-rh-id]').forEach(function (cv) { if (cv._rhWatch) return;
      var p = worldRef && worldRef.byId && worldRef.byId[cv.getAttribute('data-rh-id')], hit = p ? cache.get(skey(p, worldRef)) : null;
      if (hit) { cv._rhVis = true; paintCv(cv, hit); cv._rhDone = 1; }
      if (cvIO) { cv._rhWatch = 1; cvIO.observe(cv); }
      else { cv._rhVis = true; cv._rhWatch = 1; enqueue(cv); } });
    var m = g.querySelector('.rh-more'); if (moreIO && m && !m._rhWatch) { m._rhWatch = 1; moreIO.observe(m); } syncLoop(); }
  function more() { if (shown >= list.length) return; var g = $('rhGrid'); if (!g) return; var n = Math.min(list.length, shown + pageSize()), html = '', i;
    for (i = shown; i < n; i++) html += cardHtml(list[i]); var sent = g.querySelector('.rh-more'); if (sent) sent.remove();
    g.insertAdjacentHTML('beforeend', html); shown = n; if (shown < list.length) g.insertAdjacentHTML('beforeend', '<div class="rh-more" aria-hidden="true"></div>'); watch(g); }
  function renderFrom() { var g = $('rhGrid'); if (!g) return; q.length = 0; stop(); live.clear(); shown = 0;
    if (!list.length) { g.innerHTML = emptyHtml(); return; }
    var n = Math.min(list.length, pageSize()), html = '', i; for (i = 0; i < n; i++) html += cardHtml(list[i]);
    if (n < list.length) html += '<div class="rh-more" aria-hidden="true"></div>';
    g.innerHTML = html; shown = n; watch(g); }
  function applyFilter() { var box = $('rareHall'); if (box) paintCounts(box); if (!listAll) return; list = filtered(); renderFrom(); }
  /* Never call world() before rows exist: that replays an empty chain on the main thread and pins the empty world. While a rebuild is in
   * progress, world() only hands back the last world (or nothing). */
  function worldSafe() { var M = window.V2Mock; if (!M || !M.world || !M.state) return null; var S; try { S = M.state(); } catch (e) { return null; }
    if (!S || !S.rows || !S.rows.length) return null; var busy = false; try { busy = !!(M.updating && M.updating()); } catch (e2) {}
    if (!(busy || S.provisional || S.verified || S.fromCache || S.workerMs != null)) return null;
    var w; try { w = M.world(); } catch (e3) { return null; } if (!w || w.pending || !w.pets) return null; return w; }
  function draw() { var box = shell(); if (!box || !window.V2Render || !V2Render.rareInfo) return false; var w = worldSafe(); if (!w) return false;
    if (w === worldRef && listAll) return true; worldRef = w; listAll = finds(w); applyFilter(); return true; }
  function start() { if (!$('rareHall')) return; shell(); var n = 0, hooked = false;
    (function wait() { var M = window.V2Mock; if (M && M.onFresh && !hooked) { hooked = true; M.onFresh(function () { worldRef = null; draw(); }); }
      if (!draw() && n++ < 240) setTimeout(wait, 500); })();
    setInterval(function () { if (!document.hidden) draw(); }, 30e3); }
  window.V2RareHall = { finds: finds, draw: draw };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
