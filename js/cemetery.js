/* XCPETS play demo: Pet Cemetery page (play money; reads this browser's demo save). Newest death first. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function speciesLabel(id) { var s = PetCore.SPECIES.filter(function (x) { return x.id === id; })[0]; return s ? s.label : id; }
  function short(a) { a = String(a || ''); return a.length > 14 ? a.slice(0, 7) + '…' + a.slice(-5) : a; }
  var demo = new DemoCore(window.localStorage, Math.random), st = demo.state(), dead = st.cemetery || [];
  $('status').textContent = dead.length + ' demo pet' + (dead.length === 1 ? '' : 's') + ' in the Pet Cemetery. A pet dies after ' + DemoCore.NEGLECT_DAYS + ' full demo days with no meal (Mythic pets are exempt).';
  $('tombs').innerHTML = dead.length ? dead.map(function (p) { var t = PetCore.TIERS[p.art.tierIndex];
    return '<div class="tomb"><canvas width="32" height="32" data-id="' + p.id + '" role="img" aria-label="ghost of #' + p.id + '"></canvas><h4>' + esc(p.art.defaultName) + ' <span class="muted">#' + p.id + '</span></h4>' +
      '<div class="small">' + esc(speciesLabel(p.art.species)) + ' · <span class="pill tier tier-' + t.id + '">' + t.label + '</span> · reached ' + esc(p.stageName) + '</div><div class="small muted">owner ' + esc(short(DemoCore.PLAYER)) + '</div>' +
      '<div class="died">🪦 died on demo day ' + new Date(p.dead.at).toLocaleDateString() + '</div></div>'; }).join('') : '<p class="muted">The Pet Cemetery is empty. Every demo pet is still being fed. 🌱 <a href="play.html">Back to the play demo</a></p>';
  dead.forEach(function (p) { var c = document.querySelector('canvas[data-id="' + p.id + '"]'); if (!c) return;
    c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(PetCore.render(p.art, { stage: p.stage, frame: 0, gearOverride: {} }).data), 32, 32), 0, 0); });
})();
