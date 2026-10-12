/* XCPETS live ranking: all pets replayed from chain, WAGMI (top) to NGMI (bottom). Read-only. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var CFG = XCPETS_CONFIG, chain = new Chain.Chain(), hk = 'xcpets-real-hashes-' + CFG.network, hashes = JSON.parse(localStorage.getItem(hk) || '{}'), rows = [], all = false;
  function score(p) { return p.stage * 1e7 + (p.streak || 0) * 1e5 + Math.min(p.care, 99999); }
  function rank(st) {
    return st.pets.filter(function (p) { return p.art && !p.dead; }) /* dead pets leave the ranking (Pet Cemetery) */.sort(function (a, b) { return score(b) - score(a) || a.id - b.id; }).map(function (p, i) { return { rank: i + 1, p: p }; });
  }
  function render() {
    var show = rows, cut = !all && rows.length > 20; if (cut) show = rows.slice(0, 10).concat([null], rows.slice(-10));
    $('board').innerHTML = rows.length ? '<div class="tw"><table class="board"><tr class="end"><td colspan="4">🚀 WAGMI</td></tr>' + show.map(function (r) {
      if (!r) return '<tr class="gap"><td colspan="4">… ' + (rows.length - 20) + ' more …</td></tr>';
      var p = r.p, sp = PetCore.SPECIES.filter(function (s) { return s.id === p.art.species; })[0];
      return '<tr><td class="rk">#' + r.rank + '</td><td><canvas width="32" height="32" data-id="' + p.id + '" style="width:48px;height:48px;image-rendering:pixelated"></canvas></td><td><a href="pet.html?id=' + p.id + '"><b>' + esc(p.name || p.art.defaultName || sp.label) + '</b></a> <span class="muted">#' + p.id + ' · ' + esc(sp ? sp.label : '') + ' · ' + PetCore.TIERS[p.art.tierIndex].label + ' · ' + p.stageName + '</span><div class="small muted">owner ' + esc(p.owner.slice(0, 8)) + '…</div></td><td>' +
        (p.streak ? '🔥 ' + p.streak + '-day streak' : '<span class="badge bad">no streak</span>') + '<div class="small muted">care ' + p.care.toLocaleString() + '</div></td></tr>';
    }).join('') + '<tr class="end"><td colspan="4">💀 NGMI</td></tr></table></div>' : '<p class="muted">No pets hatched on ' + esc(CFG.network) + ' yet. <a href="play.html">Hatch the first one.</a></p>';
    Array.prototype.forEach.call(document.querySelectorAll('canvas[data-id]'), function (c) {
      var p = rows.filter(function (r) { return r.p.id === Number(c.getAttribute('data-id')); })[0].p, fr = PetCore.renderFrames(p.art, { stage: p.stage, gearOverride: p.gearOverride, gearCap: RealCore.BUMP_SLOTS[p.art.tierIndex] });
      if (window.BonusGear && Object.keys(p.extraGear).length) BonusGear.decorate(PetCore, p.art, p.stage, fr, p.extraGear, p.gearOverride);
      c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(fr[0].data), 32, 32), 0, 0);
    });
    var b = $('boardAll'); b.style.display = rows.length > 20 ? '' : 'none'; b.textContent = all ? 'Show top 10 and bottom 10' : 'Show all ' + rows.length;
  }
  if (!Gate.sessionOk(CFG.network, { origin: location.origin }).ok) { $('status').innerHTML = 'Closed / coming soon. The ranking opens at launch (owner: log in on the <a href="play.html">play page</a> first).'; return; }
  $('boardAll').onclick = function () { all = !all; render(); };
  Promise.all([chain.destructions(CFG.asset), chain.tip().catch(function () { return null; })]).then(function (r) {
    var blocks = {}; r[0].forEach(function (x) { blocks[x.block_index] = 1; });
    return chain.blockHashes(Object.keys(blocks), hashes, r[1]).then(function (bh) {
      localStorage.setItem(hk, JSON.stringify(hashes));
      if (bh.missing.length) { $('status').textContent = 'Syncing: waiting for ' + bh.missing.length + ' block hash(es). Reload in a moment.'; return; }
      rows = rank(RealCore.replay(r[0], Object.assign({}, hashes, bh.hashes), { tip: r[1] })); $('status').textContent = rows.length + ' pets ranked from ' + r[0].length + ' ' + CFG.asset + ' destroys on ' + CFG.network + '.'; render();
    });
  }).catch(function (e) { $('status').textContent = 'Could not read the chain: ' + e.message; });
})();
