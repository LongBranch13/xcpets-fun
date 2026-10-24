/* PET CARD (branch pet-card-page, owner 2026-10-24 5:08 AM CT): pet.html shows the pet as a physical 8-bit trading card.
 * Display only: never signs, never changes rules or replay. Paints the card's tier edge/foil, name/number banner, card back,
 * the three hub buttons (Rare Room / Breed at Gooby's Hotel / Battle in the arena, deep links to play.html with this pet preselected:
 * #rare-room-ID, #breed-ID, #battle-ID; handled on play.html by js/v2-preselect.js and the existing #battle-ID route) and a Quests area.
 * Quests: uses the Mythic quest module only if it is present (V2Rules.questInfo/questOn + V2Quests.start); otherwise 'Quests open soon'. */
(function () {
  'use strict';
  if (typeof document === 'undefined' || !document.body || document.body.getAttribute('data-v2page') !== 'pet') return;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fmt = function (n) { return Number(n || 0).toLocaleString('en-US'); };
  var TIERS = ['Common', 'Uncommon', 'Rare', 'Legendary'];
  function world() { var M = window.V2Mock; try { return M && M.world ? M.world() : null; } catch (e) { return null; } }
  function tip() { var M = window.V2Mock, S = M && M.state && M.state(); return S && S.tip ? S.tip : 0; }
  function me() { return (window.V2Mock && V2Mock.ME) || ''; }
  function viewOnly() { return !!(window.V2View && V2View.viewOnly && V2View.viewOnly()); }
  function isMythic(p) { return !!p && (p.stage >= 5 || !!p.mythicCare); }
  function hrs(n) { var h = n * 10 / 60; return h < 48 ? '~' + Math.round(h) + ' h' : '~' + (h / 24).toFixed(1) + ' days'; }

  function acts(p, mine) {
    if (p.dead || p.released || p.burnedTo) return '<p class="small muted pc-none">' + (p.dead ? '🪦 Resting in the Pet Cemetery.' : 'Out of play.') + '</p>';
    var own = mine && !viewOnly(), q = function (h) { return own ? h + '-' + p.id : h; };
    var b = function (href, ico, label, sub, cls) { return '<a class="pc-act ' + cls + '" href="play.html#' + href + '"><span class="pc-ico" aria-hidden="true">' + ico + '</span><b>' + label + '</b><small>' + sub + '</small></a>'; };
    return '<div class="pc-actrow">' + b(q('rare-room'), '💎', 'Rare Room', own ? 'Gear for #' + p.id : 'Gear & spins', 'pc-rr') +
      b(own ? 'breed-' + p.id : 'gooby-inn', '🏨', 'Breed', "Gooby's Hotel", 'pc-br') + b(own ? 'battle-' + p.id : 'kekimus', '⚔️', 'Battle', 'The arena', 'pc-bt') + '</div>' +
      (own ? '' : '<p class="small muted pc-note">' + (mine ? 'View only: connect the owner wallet on Play to act.' : 'Opens the place on Play. Only the owner can pick this pet there.') + '</p>');
  }

  /* Quests: real module when present (branch mythic-quests); here only read-only V2Rules calls + V2Quests.start(p, code) for the click */
  function questsOn() { var V = window.V2Rules; return !!(V && V.questInfo && V.questOn && V.QUEST_CODES && V.QUESTS && V.questOn(tip() + 1)); }
  function quests(w, p, mine) {
    var h = '<h3 class="pc-qh">🗺️ Quests</h3>';
    if (!questsOn()) return h + '<p class="pc-soon">Quests open soon. Mythic pets will go on quests to Spam City, Cold Storage, Lord Kek\'s Swamp, the Wizard\'s Tower and the Burning Mines.</p>';
    var V = window.V2Rules, b = tip() + 1, I = V.questInfo(w, p, b) || {};
    if (I.away) { var A = I.away, Q = V.QUESTS[A.code] || {}, done = Math.max(0, Math.min(1, (b - A.start) / ((A.end - A.start) || 1)));
      return h + '<div class="pc-away" id="pcAway"><b>🗺️ Gone Questing: ' + esc(A.name) + '</b><span>Set off at block ' + fmt(A.start) + (A.free ? ' (free first quest)' : '') + '. Homecoming at block <b>' + fmt(A.end) + '</b>, in ' + fmt(A.left) + ' blocks (' + hrs(A.left) + ').</span>' +
        '<span class="pc-bar" role="progressbar" aria-valuenow="' + Math.round(done * 100) + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + (done * 100).toFixed(1) + '%"></i></span>' +
        '<span class="small">While away: no battles, breeding, feeding, gifts, sales or swaps.' + (Q.reward ? ' Looking for: ' + esc(Q.reward) + '.' : '') + '</span></div>'; }
    var why = null;
    if (p.dead) why = 'it rests in the Pet Cemetery';
    else if (p.community) why = 'community pets never quest';
    else if (!isMythic(p) && !I.mythic) why = 'not Mythic yet (quests are for Mythics)';
    if (why) return h + '<p class="pc-noq">No quests for this pet: ' + esc(why) + '.</p>';
    var own = !!mine && !viewOnly(), can = own && window.V2Quests && typeof V2Quests.start === 'function', busy = V.questWhy ? V.questWhy(w, p, me() || p.owner, V.QUEST_CODES[0], 1e12, b) : null;
    if (I.napUntil) h += '<p class="small">💤 Nap Time until block ' + fmt(I.napUntil) + '.</p>';
    h += (I.freeQuest ? '<p class="small"><b>🎟️ Free first quest</b> (0.00000001 XCPETS burn).</p>' : '') + '<div class="pc-qlist">' + V.QUEST_CODES.map(function (c) {
      var Q = V.QUESTS[c], pl = V.questPlan ? V.questPlan(p.id, c, w, b) : null, cost = I.freeQuest ? 'free' : pl ? fmt(pl.amount) + ' XCPETS' : '', dis = !can || !!busy;
      return '<div class="pc-q"><span class="pc-mb" title="Mythic quest">MYTHIC</span><b>' + esc(Q.name) + '</b><small>' + fmt(Q.len) + ' blocks · ' + cost + '</small>' +
        '<button type="button" class="btn pc-qgo" data-pcq="' + esc(c) + '"' + (dis ? ' disabled title="' + esc(!own ? 'Only the owner wallet can send this pet' : busy || 'Quest module not loaded') + '"' : '') + '>Start</button></div>'; }).join('') + '</div>' +
      (busy ? '<p class="small muted">Can\'t start a quest now: ' + esc(busy) + '.</p>' : !own ? '<p class="small muted">Only the owner wallet can send this pet.</p>' : '');
    return h;
  }

  var last = '';
  function paint() {
    var w = world(), id = +(new URLSearchParams(location.search).get('id') || 0), card = $('petCard'); if (!w || !w.byId || !card) return;
    var p = w.byId[id]; if (!p) return; var ME = me(), mine = !!ME && p.owner === ME, myth = isMythic(p);
    var I = questsOn() ? (window.V2Rules.questInfo(w, p, tip() + 1) || {}) : {};
    var key = [w.tip, id, ME, viewOnly(), p.stage, p.tier, p.dead, questsOn(), I.away && I.away.end, I.napUntil, I.freeQuest, !!(window.V2Quests && V2Quests.start)].join('|'); if (key === last) return; last = key;
    card.setAttribute('data-tier', String(p.tier || 0)); card.classList.toggle('pc-myth', myth); card.classList.toggle('pc-dead', !!p.dead); card.classList.toggle('pc-away', !!I.away);
    var sp = window.V2Rules && V2Rules.speciesLabel ? V2Rules.speciesLabel(p.species) : p.species;
    $('pcNum').textContent = '#' + p.id; $('pcType').innerHTML = '<span>' + esc(myth ? 'Mythic' : TIERS[p.tier] || '') + '</span><span>' + esc(sp) + ' · ' + esc(p.stageName || '') + '</span>';
    $('pcFoot').textContent = 'No. ' + String(p.id).padStart(5, '0') + ' · blk ' + fmt(p.hatchBlock);
    $('pcBackTxt').innerHTML = 'Pet #' + p.id + '<br>hatched in block ' + fmt(p.hatchBlock) + '<br><span class="muted">burn-to-play on Bitcoin</span>';
    $('pcActs').innerHTML = acts(p, mine);
    $('pcQuests').innerHTML = quests(w, p, mine);
    $('pcQuests').querySelectorAll('[data-pcq]').forEach(function (x) { x.onclick = function () { if (x.disabled || !window.V2Quests || !V2Quests.start) return; V2Quests.start(p.id, x.getAttribute('data-pcq')); }; });
  }
  function flip(on) { var f = $('pcFront'), bk = $('pcBack'), c = $('petCard'); if (!f || !bk) return; c.classList.toggle('pc-flipped', on); bk.hidden = !on; f.style.visibility = on ? 'hidden' : ''; $('pcFlip').setAttribute('aria-pressed', String(on)); }
  document.addEventListener('click', function (e) { var t = e.target && e.target.closest; if (!t) return; if (e.target.closest('#pcFlip')) flip(true); else if (e.target.closest('#pcFlip2')) flip(false); });
  var n = 0; (function tick() { n++; try { paint(); } catch (e) { } setTimeout(tick, n < 60 ? 500 : 3000); })();
  window.V2PetCard = { paint: function () { last = ''; paint(); } };
})();
