/* XCPETS promo landing: the shared pet stays a mystery. Shows a silhouette at its current stage with the play demo's
 * shared-pet progress (stored in this browser) and, if reachable, live XCPETS burn stats from the Counterparty API. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (n) { return Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }); };
  var KEYC = [255, 0, 255];
  function silhouette(stage) {
    var base = PetCore.characterPet('pepe', { background: 'solid', bgColor: '#ff00ff', tier: 'common' }), out = [];
    PetCore.renderFrames(base, { stage: stage, gearOverride: {} }).forEach(function (img) {
      var d = new Uint8ClampedArray(img.data);
      for (var i = 0; i < d.length; i += 4) {
        var bg = d[i] === KEYC[0] && d[i + 1] === KEYC[1] && d[i + 2] === KEYC[2];
        if (bg) { d[i] = 20; d[i + 1] = 32; d[i + 2] = 24; } else { d[i] = 6; d[i + 1] = 4; d[i + 2] = 12; }
        d[i + 3] = 255;
      }
      out.push(d);
    });
    return out;
  }
  var stage = 0, burned = 0, next = null, progress = 0;
  try {
    var demo = new DemoCore(window.localStorage, Math.random), sh = demo.state().shared;
    stage = sh.stage; burned = sh.burned; next = sh.next; progress = sh.progress;
  } catch (e) { /* no demo save yet */ }
  var frames = silhouette(stage), ctx = $('sharedCanvas').getContext('2d'), f = 0;
  function paint() { ctx.putImageData(new ImageData(frames[f], 32, 32), 0, 0); f = (f + 1) % frames.length; }
  paint(); setInterval(paint, 300);
  $('sharedStage').textContent = GameCore.STAGE_NAMES[stage];
  $('sharedBurned').textContent = fmt(burned);
  $('sharedNext').textContent = next == null ? 'fully grown' : fmt(next - burned) + ' to go';
  $('sharedProg').style.width = Math.round(progress * 100) + '%';
  // live chain stats (read-only GET; CORS is open on api.xcp.fun)
  var API = 'https://api.xcp.fun/node/v2/assets/XCPETS/destructions?limit=1000';
  fetch(API).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (j) {
    var rows = (j.result || []).filter(function (x) { return String(x.status).toLowerCase() === 'valid'; });
    var total = rows.reduce(function (a, x) { return a + Number(x.quantity) / 1e8; }, 0);
    $('liveBurned').textContent = fmt(total); $('liveCount').textContent = fmt(j.result_count != null ? j.result_count : rows.length);
    $('liveNote').textContent = rows.length ? 'Every real XCPETS burn feeds the real shared pet.' : 'No XCPETS burned on-chain yet: the real shared pet is still an egg.';
  }).catch(function () { $('liveNote').textContent = 'Live stats unavailable right now.'; });
})();
