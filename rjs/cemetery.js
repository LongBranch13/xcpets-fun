/* XCPETS live Pet Cemetery: every pet that died of neglect, replayed from chain (like the ranking). Newest death first. Read-only. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var CFG = XCPETS_CONFIG, chain = new Chain.Chain(), hk = 'xcpets-real-hashes-' + CFG.network, hashes = JSON.parse(localStorage.getItem(hk) || '{}');
  function short(a) { a = String(a || ''); return a.length > 14 ? a.slice(0, 7) + '…' + a.slice(-5) : a; }
  /** estimated block date: tip time minus 10 min a block (the replay is block based; dates are for humans only) */
  function blockDate(block, tip, tipMs) { var d = new Date(tipMs - (tip - block) * 600000); return d.toISOString().slice(0, 10); }
  function card(p, tip, tipMs) {
    var sp = PetCore.SPECIES.filter(function (s) { return s.id === p.art.species; })[0], tier = PetCore.TIERS[p.art.tierIndex];
    return '<div class="tomb" id="tomb-' + p.id + '"><canvas width="32" height="32" data-id="' + p.id + '" role="img" aria-label="ghost of #' + p.id + '"></canvas>' +
      '<h4><a href="pet.html?id=' + p.id + '">' + esc(p.name || p.art.defaultName || (sp ? sp.label : '')) + '</a> <span class="muted">#' + p.id + '</span></h4>' +
      '<div class="small">' + esc(sp ? sp.label : p.art.species) + ' · <span class="pill tier tier-' + tier.id + '">' + tier.label + '</span> · reached ' + esc(p.stageName) + '</div>' +
      '<div class="small muted">owner ' + esc(short(p.owner)) + '</div>' +
      '<div class="died">🪦 died at block ' + p.dead.block.toLocaleString('en-US') + ' · ' + blockDate(p.dead.block, tip, tipMs) + '</div></div>';
  }
  function render(st, tip) {
    var dead = (st.cemetery || []).filter(function (p) { return p.art; }), tipMs = Date.now();
    $('status').textContent = dead.length + ' pet' + (dead.length === 1 ? '' : 's') + ' in the Pet Cemetery, from ' + st.log.length + ' ' + CFG.asset + ' burns on ' + CFG.network + '. A pet dies after ' + RealCore.NEGLECT_DAYS + ' full chain days (144 blocks each) with no feed; the clock started at block ' + RealCore.DEATH_FROM_BLOCK.toLocaleString('en-US') + '.';
    $('tombs').innerHTML = dead.length ? dead.map(function (p) { return card(p, tip || p.dead.block, tipMs); }).join('') : '<p class="muted">The Pet Cemetery is empty. Every pet is still being fed. 🌱</p>';
    dead.forEach(function (p) { var c = document.querySelector('canvas[data-id="' + p.id + '"]'); if (!c) return;
      var fr = PetCore.renderFrames(p.art, { stage: p.stage, gearOverride: {}, gearCap: RealCore.BUMP_SLOTS[p.art.tierIndex] }); // gear went back to the owner
      c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(fr[0].data), 32, 32), 0, 0); });
  }
  window.XcpetsCemetery = { render: render };
  if (window.XCPETS_CEMETERY_NO_AUTOLOAD) return;
  if (!Gate.sessionOk(CFG.network, { origin: location.origin }).ok) { $('status').innerHTML = 'Closed / coming soon. The Pet Cemetery opens at launch (owner: log in on the <a href="play.html">play page</a> first).'; return; }
  Promise.all([chain.destructions(CFG.asset), chain.tip().catch(function () { return null; })]).then(function (r) {
    var blocks = {}; r[0].forEach(function (x) { blocks[x.block_index] = 1; });
    return chain.blockHashes(Object.keys(blocks), hashes, r[1]).then(function (bh) {
      localStorage.setItem(hk, JSON.stringify(hashes));
      if (bh.missing.length) { $('status').textContent = 'Syncing: waiting for ' + bh.missing.length + ' block hash(es). Reload in a moment.'; return; }
      render(RealCore.replay(r[0], Object.assign({}, hashes, bh.hashes), { tip: r[1] }), r[1]);
    });
  }).catch(function (e) { $('status').textContent = 'Could not read the chain: ' + e.message; });
})();
