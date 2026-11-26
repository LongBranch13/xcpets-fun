/* rank-calm-1123 (Jake Nov 23 2026, "this needs to be better"): Rankings with the leaderboard as the hero. Display only, ranking.html only.
 * Works on what js/v2-pages.js ranking() draws (no change to how boards are computed):
 *  - a top-3 podium with big pet pictures above the table (draws the same pet sprites as the rows, links to the same pet),
 *  - board tabs in one swipeable row, species as ONE dropdown (the 30 buttons stay in the page, hidden, and the dropdown presses them),
 *  - one calm toolbar: Species · Find me · 🔎 Find a pet · ? (the board's explainer opens on ?). */
(function () {
  'use strict';
  var d = document, $ = function (id) { return d.getElementById(id); };
  if (!d.body || d.body.getAttribute('data-v2page') !== 'ranking') return;
  var MED = ['🥇', '🥈', '🥉'], busy = false;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function bar() { var b = $('rkCalm'); if (b) return b; var host = $('status') || $('rkTabsHost'); /* smooth: under the status line (the tabs row above it is in the page from the start) */ if (!host) return null;
    b = d.createElement('div'); b.id = 'rkCalm'; b.className = 'rkcalm';
    b.innerHTML = '<label class="rkc-sp"><span class="rkc-l">Species</span><select id="rkSpSel" aria-label="Species"></select></label>' +
      '<button type="button" class="q" id="rkMeBtn" hidden>📍 <span class="rkc-long">Find </span>me</button>' +
      '<button type="button" class="q" id="rkFindBtn" aria-expanded="false">🔎 Find<span class="rkc-long"> a pet</span></button>' +
      '<button type="button" class="q rkc-help" id="rkHelpBtn" aria-expanded="false" aria-label="How this board works">?</button>';
    host.parentNode.insertBefore(b, host.nextSibling);
    $('rkSpSel').onchange = function () { var v = this.value, btn = d.querySelector('#rkSpecies [data-species="' + v.replace(/"/g, '') + '"]'); if (btn) btn.click(); };
    $('rkMeBtn').onclick = function () { var f = $('rkFind'); if (f) f.click(); };
    $('rkFindBtn').onclick = function () { var on = !d.body.classList.contains('rkc-find'); d.body.classList.toggle('rkc-find', on); this.setAttribute('aria-expanded', String(on)); if (on) { var i = $('uxpFind'); if (i) i.focus(); } };
    $('rkHelpBtn').onclick = function () { var on = !d.body.classList.contains('rkc-help-on'); d.body.classList.toggle('rkc-help-on', on); this.setAttribute('aria-expanded', String(on)); };
    return b; }
  function syncSpecies() { var sel = $('rkSpSel'); if (!sel) return; var btns = d.querySelectorAll('#rkSpecies [data-species]'), lab = sel.parentNode;
    lab.hidden = !btns.length; if (!btns.length) return;
    var html = Array.prototype.map.call(btns, function (b) { var id = b.getAttribute('data-species') || '', nm = (b.querySelector('.rksp-nm') || b).textContent.trim();
      return '<option value="' + esc(id) + '"' + (b.classList.contains('on') ? ' selected' : '') + '>' + esc(id ? nm : '★ All pets') + '</option>'; }).join('');
    if (sel.innerHTML !== html) sel.innerHTML = html; }
  function syncFind() { var f = $('rkFind'), me = $('rkMeBtn'); if (me) me.hidden = !f; }
  function podium() { var old = $('rkPod'); var tbl = d.querySelector('#board table.board'), rows = [0, 1, 2].map(function (i) { return $('rk' + i); });
    if (!tbl || !rows[0] || d.body.classList.contains('rk-finds')) { if (old) old.remove(); return; }
    var cards = rows.map(function (tr, i) { if (!tr) return ''; var td = tr.children, who = td[2], num = td[3], a = who && who.querySelector('a[href]'), b = who && who.querySelector('b'), sub = who && who.querySelector('.small');
      var cv = td[1] && td[1].querySelector('canvas[data-id]');
      return '<a class="rkp rkp' + (i + 1) + (tr.classList.contains('me') ? ' me' : '') + '"' + (a ? ' href="' + esc(a.getAttribute('href')) + '"' : '') + ' data-row="' + i + '">' +
        '<span class="rkp-m" aria-hidden="true">' + MED[i] + '</span>' + (cv ? '<canvas width="32" height="32" data-pid="' + esc(cv.getAttribute('data-id')) + '" aria-hidden="true"></canvas>' : '<span class="rkp-nocv" aria-hidden="true">👤</span>') +
        '<b class="rkp-n">' + esc(b ? b.textContent : '') + '</b>' + (sub ? '<span class="rkp-s">' + esc(sub.textContent.replace(/^owner\s+/, '')) + '</span>' : '') +
        '<span class="rkp-v">' + (num && num.querySelector('b') ? num.querySelector('b').innerHTML : '') + '</span></a>'; });
    var html = '<div class="rkpod" id="rkPod" aria-label="Top three">' + [cards[1], cards[0], cards[2]].join('') + '</div>';
    if (old && old.getAttribute('data-sig') === tbl.rows.length + ':' + rows.map(function (r) { return r ? r.textContent : ''; }).join('|')) return;
    if (old) old.remove();
    var tw = $('wagmiFirst5') || tbl.closest('.tw') || tbl; tw.insertAdjacentHTML('beforebegin', html); /* podium first, then Today's first five, then the table */
    $('rkPod').setAttribute('data-sig', tbl.rows.length + ':' + rows.map(function (r) { return r ? r.textContent : ''; }).join('|'));
    copyArt(); }
  /* the podium paints its own sprites (the table rows paint lazily, only once scrolled near, so copying them left #2/#3 blank on phones) */
  function copyArt() { var pod = $('rkPod'), R = window.V2Render, w = window.V2Mock && V2Mock.world && V2Mock.world(); if (!pod || !R || !R.petFrames || !w || !w.byId) return;
    var cs = pod.querySelectorAll('canvas[data-pid]'), ids = Array.prototype.map.call(cs, function (c) { return +c.getAttribute('data-pid'); });
    function draw() { Array.prototype.forEach.call(cs, function (c) { var p = w.byId[+c.getAttribute('data-pid')]; if (!p || !p.art || c._podDone) return; c._podDone = 1;
      try { var fr = R.petFrames(p, w); if (fr && fr[0]) { if (R.animate) R.animate(c, fr); else R.paint(c, fr[0]); } } catch (e) { c._podDone = 0; } }); }
    draw(); if (window.V2Split && V2Split.dress) V2Split.dress(ids).then(draw, function () {}); }
  function tidy() { if (busy) return; busy = true; try { if (bar()) { syncSpecies(); syncFind(); } podium(); } catch (e) { if (window.console) console.warn('[rank-calm]', e); } busy = false; }
  function start() { d.body.classList.add('rkc'); var b = $('board'), s = $('rkSpecies');
    if (window.MutationObserver) { var mo = new MutationObserver(function () { setTimeout(tidy, 0); }); if (b) mo.observe(b, { childList: true }); var main = d.querySelector('main'); if (main) mo.observe(main, { childList: true, subtree: false });
      var sp = new MutationObserver(function () { setTimeout(tidy, 0); }); (function watchSp() { var h = $('rkSpecies'); if (h) sp.observe(h, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] }); else setTimeout(watchSp, 500); })(); }
    tidy(); }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start); else start();
})();
