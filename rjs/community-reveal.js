/* Local game build front page: the REVEALED community pet (Nakamoto), replayed from real XCPETS burns. Read-only.
 * Landing shows the same community pet sprite as the play page (pet-core Nakamoto at the live stage). */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function fmt(n) { return Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
  var CFG = XCPETS_CONFIG, chain = new Chain.Chain(), N = GameCore.STAGE_NAMES, CT = RealCore.COMMUNITY_THRESHOLDS, QUEST = GameCore.COMMUNITY_QUEST_END || 69000000;
  $('crNet').textContent = CFG.label || CFG.network;
  var hk = 'xcpets-real-hashes-' + CFG.network, hashes = JSON.parse(localStorage.getItem(hk) || '{}');
  Promise.all([chain.destructions(CFG.asset), chain.tip().catch(function () { return null; })]).then(function (r) {
    var rows = r[0], st = RealCore.replay(rows, {}, { tip: r[1] }), c = st.community;
    localStorage.setItem(hk, JSON.stringify(hashes));
    // Same sprite as the play page: real pet-core Nakamoto at the live community stage, same renderer, bg and frame timing.
    var fr = PetCore.renderFrames(PetCore.characterPet('nakamoto', { bgColor: '#2a3a2e' }), { stage: c.stage }), ctx = $('crCanvas').getContext('2d'), f = 0;
    $('crCanvas').setAttribute('aria-label', 'Community pet');
    (function paint() { ctx.putImageData(new ImageData(new Uint8ClampedArray(fr[f].data), 32, 32), 0, 0); f = (f + 1) % fr.length; setTimeout(paint, 280); })();
    var lo = CT[c.stage], hi = c.stage < 5 ? CT[c.stage + 1] : null;
    $('crName').textContent = st.communityName;
    $('crStage').textContent = N[c.stage];
    $('crFed').textContent = fmt(c.feeders ? Object.keys(c.feeders).reduce(function (a, k) { return a + c.feeders[k]; }, 0) : 0);
    $('crBurned').textContent = fmt(c.burned); $('crBurns').textContent = fmt(c.burns); $('crPets').textContent = fmt(st.pets.length);
    $('crNext').textContent = hi ? fmt(hi - c.burned) + ' to ' + N[c.stage + 1] : 'Mythic reached';
    $('crProg').style.width = (hi ? Math.min(100, 100 * (c.burned - lo) / (hi - lo)) : 100).toFixed(1) + '%';
    $('crQuest').style.width = Math.min(100, 100 * c.burned / QUEST).toFixed(2) + '%';
    $('crQuestTxt').textContent = fmt(c.burned) + ' / ' + fmt(QUEST) + ' XCPETS burned (' + (100 * c.burned / QUEST).toFixed(4) + '%)';
    $('crGear').textContent = 'none yet (gear windows start in a later phase; ' + st.log.filter(function (e) { return e.ext === 'croll'; }).length + ' community roll candidates so far)';
    $('crNote').textContent = rows.length ? 'Replayed from ' + rows.length + ' ' + CFG.asset + ' destroys on ' + CFG.network + (r[1] ? ' at block ' + r[1] : '') + '.' : 'No ' + CFG.asset + ' burned on ' + CFG.network + ' yet, so Sat is still an Egg. The first burn starts it growing.';
  }).catch(function (e) { $('crNote').textContent = 'Could not read the chain: ' + e.message; });
})();
