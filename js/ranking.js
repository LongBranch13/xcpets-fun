/* XCPETS play demo: WAGMI -> NGMI ranking page (play money; reads this browser's demo save). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function speciesLabel(id) { var s = PetCore.SPECIES.filter(function (x) { return x.id === id; })[0]; return s ? s.label : id; }
  var demo = new DemoCore(window.localStorage, Math.random);
  var boardAll = false, GOOD = { 'Legendary drip': 1, 'Fire takes': 1, 'Roast mode': 1 };
  function glow(r) { return r.badges.indexOf('Legendary drip') >= 0 ? ' class="drip"' : ''; }
  function thumb(r, st) {
    var p = st.byId[r.id]; if (!p) return '';
    var c = document.createElement('canvas'); c.width = c.height = 32;
    c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(PetCore.render(p.art, { stage: p.stage, frame: 0, gearOverride: p.gearOverride }).data), 32, 32), 0, 0);
    return '<img class="thumb" alt="" src="' + c.toDataURL() + '">';
  }
  function render() {
    var st = demo.state(), rows = demo.leaderboard(st), show = rows, cut = !boardAll && rows.length > 20;
    if (cut) show = rows.slice(0, 10).concat([null], rows.slice(-10));
    function row(r) {
      var s = r.status, info = s.kind === 'streak' ? s.streakDays + '-day streak (score ' + s.score + ')' : s.kind === 'neglected' ? s.missed + ' day' + (s.missed > 1 ? 's' : '') + ' missed' : 'no streak yet';
      return '<tr' + glow(r) + '><td class="rk">#' + r.rank + '</td><td>' + thumb(r, st) + '</td><td><b>' + esc(r.name) + '</b> <span class="muted">#' + r.id + ' · ' + esc(speciesLabel(r.species)) + ' · ' + PetCore.TIERS[r.tier].label + ' · ' + r.stage + '</span>' +
        (r.flavor ? '<div class="small muted">' + esc(r.flavor) + '</div>' : '') + (r.roast ? '<div class="small">🔥 ' + esc(r.roast) + '</div>' : '') + '</td><td>' + info + '</td><td>' +
        r.badges.map(function (b) { return '<span class="badge ' + (GOOD[b] ? 'good' : 'bad') + '" title="' + esc(DemoCore.BADGES[b]) + '">' + b + '</span>'; }).join('') + '</td></tr>';
    }
    $('board').innerHTML = rows.length ? '<div class="tw"><table class="board"><tr class="end"><td colspan="5">🚀 WAGMI</td></tr>' +
      show.map(function (r) { return r ? row(r) : '<tr class="gap"><td colspan="5">… ' + (rows.length - 20) + ' more …</td></tr>'; }).join('') +
      '<tr class="end"><td colspan="5">💀 NGMI</td></tr></table></div>' : '<p class="muted">No pets yet. <a href="play.html">Hatch one in the play demo</a>, feed it and come back.</p>';
    var b = $('boardAll'); b.style.display = rows.length > 20 ? '' : 'none'; b.textContent = boardAll ? 'Show top 10 and bottom 10' : 'Show all ' + rows.length;
  }
  $('boardAll').onclick = function () { boardAll = !boardAll; render(); };
  render();
})();
