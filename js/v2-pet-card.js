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


  /* Tokenize (owner 2026-10-24 5:26 AM CT): the Spam City Sell flow's token steps, minus the DEX order. Same code paths as shop.html:
   * V2Sales.tok.freeDeed + V2Rules.mintPlan -> V2Wallet.sendDex (step 1, free token, Bitcoin fee only), V2Sales.tok.pend (same
   * 'xcpets-deed-pending' store as the shop), wait 1 block, V2Sales.tok.tokenAt check + V2Rules.deedPlan -> V2Wallet.send (step 2, 1 dander pet:deed).
   * Tied = V2Rules.deedOf(w, p).ok (the replay). ?tokPreview=none|made|ready|tied shows a state without any wallet window (screenshots). */
  var TPV = (/[?&]tokPreview=(none|made|ready|tied)\b/.exec(location.search) || [])[1] || null, tpv = TPV, tokMsg = '', tokLast = '';
  function tokTools() { return window.V2Sales && V2Sales.tok && window.V2Rules && V2Rules.mintPlan && V2Rules.deedPlan ? V2Sales.tok : null; }
  function tokState(w, p) { var V = window.V2Rules, T = tokTools();
    if (tpv) return { s: tpv, pd: tpv === 'none' ? null : { asset: 'A12345678901234567890', at: tip() - (tpv === 'made' ? 0 : 2) }, d: tpv === 'tied' ? { asset: 'A12345678901234567890', ok: true } : null };
    var d = V && V.deedOf ? V.deedOf(w, p) : null; if (d && d.ok) { if (T && T.pend(p.id)) T.pend(p.id, null); return { s: 'tied', d: d }; }
    var pd = T ? T.pend(p.id) : null; if (!pd) return { s: 'none', d: d };
    return { s: tip() >= (Number(pd.at) || 0) + 1 ? 'ready' : 'made', pd: pd, d: d }; }
  function shortA(A) { A = String(A || ''); return A.length > 12 ? A.slice(0, 6) + '…' + A.slice(-4) : A; }
  function tokHtml(w, p, mine) {
    if (p.dead || p.released || p.burnedTo || p.community) return '';
    var S = tokState(w, p), own = (!!mine && !viewOnly()) || !!tpv, V = window.V2Rules;
    if (S.s === 'tied') return '<div class="pc-tok pc-tok-tied"><b>🎟 Tied!</b> <span>#' + p.id + ' has its own pet token ' + esc(shortA(S.d.asset)) + '. Whoever holds the token holds the pet.</span></div>';
    var why = !own ? (mine ? 'connect the owner wallet on Play to tokenize' : 'only the owner can tokenize this pet') : !tpv && !tokTools() ? 'the token tools did not load' : !tpv && V.deedWhy ? V.deedWhy(w, { petId: p.id }, me(), tip() + 1) : null;
    var dots = ['none', 'made', 'ready'].map(function (k, i) { var at = ['none', 'made', 'ready'].indexOf(S.s); return '<li class="' + (i < at ? 'done' : i === at ? 'now' : '') + '">' + ['Not tokenized', 'Token made', 'Tie ready'][i] + '</li>'; }).join('') + '<li>Tied</li>';
    var body;
    if (S.s === 'none') body = '<p>Give #' + p.id + ' its very own 🎟 pet token! Step 1 makes it for free (you only pay the tiny Bitcoin fee).' + (S.d && !S.d.ok ? ' The old token ' + esc(shortA(S.d.asset)) + ' sits in another wallet, so a fresh one replaces it.' : '') + '</p>' +
      '<button type="button" class="btn pc-tokgo" id="pcTokMint"' + (why ? ' disabled title="' + esc(why) + '"' : '') + '>🎟 Tokenize: step 1 of 2</button>';
    else if (S.s === 'made') body = '<p>⏳ Token ' + esc(shortA(S.pd.asset)) + ' is on its way! Wait 1 block (about 10 minutes) for it to confirm, then come back for step 2.</p>';
    else body = (S.pd.tieTx ? '<p>💌 Tie burn sent! #' + p.id + ' shows as tied once it confirms.</p>' : '<p>✨ Token ' + esc(shortA(S.pd.asset)) + ' is ready. Step 2 ties it to #' + p.id + ' with a 1-dander burn (<code>pet:deed</code>).</p>') +
      '<button type="button" class="btn pc-tokgo" id="pcTokTie"' + (why ? ' disabled title="' + esc(why) + '"' : '') + '>' + (S.pd.tieTx ? '🔗 Send the tie again' : '🔗 Tie it: step 2 of 2') + '</button>';
    return '<div class="pc-tok"><h3 class="pc-qh">🎟 Pet token</h3><ol class="pc-tsteps">' + dots + '</ol>' + body +
      (why && S.s !== 'made' ? '<p class="small muted">Can\'t tokenize right now: ' + esc(why) + '.</p>' : '') + '<p class="small pc-tokmsg" id="pcTokMsg">' + esc(tokMsg) + '</p></div>'; }
  function tokSay(t) { tokMsg = t; var m = $('pcTokMsg'); if (m) m.textContent = t; }
  function tokBind(w, p) { var T = tokTools(), V = window.V2Rules, a = $('pcTokMint'), b = $('pcTokTie');
    if (a) a.onclick = function () { if (a.disabled) return; if (tpv) { tpv = 'made'; tokSay('Preview: no wallet window, nothing was sent.'); tokPaint(true); return; }
      tokSay('Finding a free token name…'); a.disabled = true;
      T.freeDeed().then(function (A) { tokSay('Checking the Proof of Pet…'); return (T.mintCheck ? T.mintCheck(p.id, A, tip()) : Promise.reject(new Error('the Proof of Pet check did not load, reload the page'))).then(function (plan) { return window.V2Wallet.sendDex(plan, me()); }).then(function (r) { T.pend(p.id, { petId: p.id, asset: A, mintTx: r && r.txid, at: tip() }); tokSay('Step 1 sent! Your token is being made.'); tokPaint(true); }); })
        .catch(function (e) { a.disabled = false; tokSay('Not sent: ' + (e && e.message || e)); }); };
    if (b) b.onclick = function () { if (b.disabled) return; if (tpv) { tpv = 'tied'; tokSay('Preview: no wallet window, nothing was sent.'); tokPaint(true); return; }
      var pd = T.pend(p.id); if (!pd) return tokPaint(true); b.disabled = true; tokSay('Checking the token…');
      T.tokenAt(pd.asset).then(function (t) {
        if (!t.issued) { b.disabled = false; tokSay('The token has not confirmed yet. Give it one more block and try again.'); return; }
        if (t.holder && t.holder !== me()) { T.pend(p.id, null); tokSay('That token sits in another wallet. Make a fresh one.'); tokPaint(true); return; }
        return window.V2Wallet.send(V.deedPlan(p.id, pd.asset), me()).then(function (r) { pd.tieTx = (r && r.txid) || 'sent'; T.pend(p.id, pd); tokSay('Step 2 sent! Almost there.'); tokPaint(true); });
      }).catch(function (e) { b.disabled = false; tokSay('Not sent: ' + (e && e.message || e)); }); }; }
  function tokPaint(force) { var w = world(), id = +(new URLSearchParams(location.search).get('id') || 0), box = $('pcTok'); if (!w || !w.byId || !box) return;
    var p = w.byId[id]; if (!p) return; var ME = me(), h = tokHtml(w, p, !!ME && p.owner === ME); if (!force && h === tokLast) return; tokLast = h; box.innerHTML = h; box.hidden = !h; tokBind(w, p); }
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
    if (!$('pcTok')) { var tb = document.createElement('div'); tb.id = 'pcTok'; tb.className = 'pc-tokbox'; $('pcQuests').parentNode.insertBefore(tb, $('pcQuests')); }
    $('pcQuests').querySelectorAll('[data-pcq]').forEach(function (x) { x.onclick = function () { if (x.disabled || !window.V2Quests || !V2Quests.start) return; V2Quests.start(p.id, x.getAttribute('data-pcq')); }; });
  }
  function flip(on) { var f = $('pcFront'), bk = $('pcBack'), c = $('petCard'); if (!f || !bk) return; c.classList.toggle('pc-flipped', on); bk.hidden = !on; f.style.visibility = on ? 'hidden' : ''; $('pcFlip').setAttribute('aria-pressed', String(on)); }
  document.addEventListener('click', function (e) { var t = e.target && e.target.closest; if (!t) return; if (e.target.closest('#pcFlip')) flip(true); else if (e.target.closest('#pcFlip2')) flip(false); });
  var n = 0; (function tick() { n++; try { paint(); tokPaint(); } catch (e) { } setTimeout(tick, n < 60 ? 500 : 3000); })();
  window.V2PetCard = { paint: function () { last = ''; paint(); tokPaint(true); } };
})();
