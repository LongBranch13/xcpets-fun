/* rare-discover-1107: The Rare Room hall of finds (rare-room.html #rareHall). DISPLAY ONLY: reads the replayed world (V2Mock.world) and each pet's
 * art.rareHatch (set by V2Rules rareApply) through V2Render.rareInfo. Never touches rules, burns or the replay. No dropdowns: one row of plain buttons. */
(function () {
  'use strict';
  var ODDS = [['🎧', 'DJ Pepe', 'Legend', '1 in 3,888'], ['🧙', 'Wizard', 'Legend', '1 in 7,777'], ['🐸', 'Lord Kek', 'Legend', '1 in 7,777'], ['🌌', 'Starlord Kek', 'God pet', '1 in 77,777']];
  var WEIRD = ['Tiny', 'Giant', 'Two-headed', 'Inverted', 'Ghost', 'Backwards', 'Wrong egg'];
  var show = 'all', W = null, drawn = null;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return Number(n).toLocaleString('en-US'); }
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
      '#rareHall .rh-none{padding:12px;text-align:center}@media(max-width:520px){#rareHall .rh-grid{grid-template-columns:repeat(2,1fr)}#rareHall .rh-card canvas{width:72px;height:72px}}';
    document.head.appendChild(s); }
  function shell() { var box = $('rareHall'); if (!box || box.getAttribute('data-ready')) return box; box.setAttribute('data-ready', '1'); css();
    box.innerHTML = '<h2 class="sec" data-ico="egg">🏆 Hall of Rare Finds</h2>' +
      '<p class="small">Every hatch has a tiny chance to crack open a Legend, a God pet or a weird pet. Here is every one found so far, live from the chain.</p>' +
      '<div class="rh-odds">' + ODDS.map(function (o) { return '<div class="rh-o' + (o[2] === 'God pet' ? ' rh-g' : '') + '"><span aria-hidden="true">' + o[0] + '</span><b>' + o[1] + '</b><span class="small">' + o[2] + '</span><div class="rh-n">' + o[3] + '</div></div>'; }).join('') +
      '<div class="rh-o rh-w"><span aria-hidden="true">🌀</span><b>Weird hatch</b><span class="small">' + WEIRD.join(' · ') + '</span><div class="rh-n">about 1 in 5,400 each</div></div>' +
      '<div class="rh-o rh-w"><span aria-hidden="true">🧬</span><b>Weird babies</b><span class="small">each weird parent passes its weirdness on</span><div class="rh-n">1 in 77</div></div></div>' +
      '<div class="rh-tabs" role="group" aria-label="Show"><button type="button" class="btn ghost q on" data-rh="all" aria-pressed="true">All finds <span class="rh-c" data-c="all"></span></button><button type="button" class="btn ghost q" data-rh="legend" aria-pressed="false">🏆 Legends <span class="rh-c" data-c="legend"></span></button><button type="button" class="btn ghost q" data-rh="weird" aria-pressed="false">🌀 Weird <span class="rh-c" data-c="weird"></span></button></div>' +
      '<div class="rh-grid" id="rhGrid"><div class="rh-none muted">Reading the chain…</div></div>';
    box.querySelector('.rh-tabs').addEventListener('click', function (e) { var b = e.target.closest('[data-rh]'); if (!b) return; show = b.getAttribute('data-rh'); drawn = null; draw(); });
    return box; }
  function draw() { var M = window.V2Mock, w = M && M.world && M.world(), box = shell(); if (!box || !w || !w.pets || !window.V2Render || !V2Render.rareInfo) return; if (drawn === w) return; drawn = w; W = w;
    var all = finds(w), L = all.filter(function (x) { return show === 'all' || (show === 'legend' ? x.i.legend : !x.i.legend); }), R = window.V2Render;
    var c = { all: all.length, legend: all.filter(function (x) { return x.i.legend; }).length }; c.weird = c.all - c.legend;
    Array.prototype.forEach.call(box.querySelectorAll('.rh-c'), function (s) { s.textContent = '(' + c[s.getAttribute('data-c')] + ')'; });
    Array.prototype.forEach.call(box.querySelectorAll('[data-rh]'), function (b) { var on = b.getAttribute('data-rh') === show; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    var g = $('rhGrid'); g.innerHTML = L.length ? L.map(function (x) { var p = x.p; return '<a class="rh-card" href="pet.html?id=' + p.id + '"><canvas width="32" height="32" data-rh-id="' + p.id + '"></canvas>' + (R.rareChip ? R.rareChip(w, p) : '') +
      '<span class="rh-nm">#' + p.id + ' ' + esc(p.name || '') + '</span><span class="small">' + esc(window.V2Rules && V2Rules.speciesLabel ? V2Rules.speciesLabel(p.species) : p.species) + (x.i.block ? ' · block ' + fmt(x.i.block) : '') + (p.dead ? ' · in the Pet Cemetery' : '') + '</span></a>'; }).join('')
      : '<div class="rh-none muted">' + (show === 'weird' ? 'No weird pets yet. Who will be first?' : show === 'legend' ? 'No Legends yet. Who will be first?' : 'Nothing found yet. Who will be first?') + '</div>';
    Array.prototype.forEach.call(g.querySelectorAll('canvas[data-rh-id]'), function (cv) { var p = w.byId[cv.getAttribute('data-rh-id')]; if (!p || !R) return; try { if (R.lazy) R.lazy(cv, function () { return R.petFrames(p, w); }, true); } catch (e) {} }); }
  function start() { if (!$('rareHall')) return; shell(); var n = 0, hooked = false; (function wait() { var M = window.V2Mock, w = M && M.world && M.world(); if (M && M.onFresh && !hooked) { hooked = true; M.onFresh(draw); } if (w && w.pets && window.V2Render && V2Render.rareInfo) draw(); else if (n++ < 240) setTimeout(wait, 1000); })(); setInterval(function () { if (!document.hidden) draw(); }, 30e3); }
  window.V2RareHall = { finds: finds, draw: draw };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
