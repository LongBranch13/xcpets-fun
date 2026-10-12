/* XCPETS local game build: the REAL game in the promo look. Every action = a real tagged XCPETS destroy, composed via the
 * Counterparty API and signed + broadcast by the user's XCP Wallet (window.xcpwallet) ONLY, after an explicit confirm dialog.
 * This page holds no keys and never signs. State is replayed from chain (RealCore). Owner gate stays on until launch. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function fedLabel(p) { var lim = p.feedLimit || RealCore.FEEDS_PER_DAY; if (p.dead) return '🪦 Died of neglect'; if (p.fedToday == null) return 'Fed today: ?'; if (lim > 1) return 'Fed ' + p.fedToday + '/' + lim; if (p.fedToday >= 1) return 'Fed today: ✓'; if (p.daysLeft != null && p.daysLeft <= 5) return 'Hungry: ' + p.daysLeft + (p.daysLeft === 1 ? ' day' : ' days') + ' until it dies' + (p.daysLeft === 1 ? ' (last day to feed!)' : ''); return 'Hungry: feed today'; }
  function fedCls(p) { return p.dead ? ' dead' : p.fedToday >= (p.feedLimit || RealCore.FEEDS_PER_DAY) ? '' : p.daysLeft === 1 ? ' danger' : ' warn'; }
  function deathNote(p) { return p.dead ? '🪦 Died of neglect at block ' + p.dead.block.toLocaleString('en-US') + ' (chain day ' + p.dead.day + ', after ' + RealCore.NEGLECT_DAYS + ' full days unfed). In the Pet Cemetery: no feeding, evolving, rolls, keys or gear; its gear went back to your inventory. Burns sent to it now are ignored (they only count as community food).' + (p.ignoredBurns ? ' ' + p.ignoredBurns + ' burn' + (p.ignoredBurns > 1 ? 's were' : ' was') + ' ignored.' : '') : ''; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return Number(n).toLocaleString('en-US', { maximumFractionDigits: 8 }); }
  var CFG = window.XCPETS_CONFIG, NET = CFG.network, C = RealCore.COSTS, N = GameCore.STAGE_NAMES;
  var chain = new Chain.Chain(), hashKey = 'xcpets-real-hashes-' + NET, hashes = JSON.parse(localStorage.getItem(hashKey) || '{}');
  var tracker = new Wallet.Tracker(localStorage, 'xcpets-real-pending-' + NET), ADDR_KEY = 'xcpets-xcpwallet-address';
  var state = null, me = '', tip = null, anim = [], wallet = null;
  var SLOT_LABEL = { band: 'Band', armor: 'Armor', cape: 'Cape', weapon: 'Weapon', crown: 'Crown', face: 'Face', back: 'Back', feet: 'Feet' };
  var SLOT_ICON = { band: '🎗️', armor: '🛡️', cape: '🧣', weapon: '⚔️', crown: '👑', face: '👀', back: '🚩', feet: '🪙' };
  var INV_ORDER = ['band', 'armor', 'cape', 'weapon', 'crown', 'face', 'back', 'feet'], BONUS = ['face', 'back', 'feet'];
  Array.prototype.forEach.call(document.querySelectorAll('.asset'), function (s) { s.textContent = CFG.asset; });
  if (CFG.badge) try { CFG.badge(document); } catch (e) { /* optional */ }
  $('hatchBtn').textContent = 'Hatch (' + fmt(C.hatch) + ')'; $('dozenBtn').textContent = 'Dozen ×12 (' + fmt(C.hatch12) + ')'; $('caseBtn').textContent = 'Case ×144 (' + fmt(C.hatch144) + ')'; $('cfeedBtn').textContent = 'Feed community (' + fmt(C.feed) + ')'; $('crollBtn').textContent = 'Community roll (' + fmt(C.croll) + ')';

  setInterval(function () { anim.forEach(function (a) { if (!document.body.contains(a.c)) return; a.f = (a.f + 1) % a.fr.length; paint(a.x, a.fr[a.f]); }); }, 280);
  function paint(ctx, img) { ctx.putImageData(new ImageData(new Uint8ClampedArray(img.data), 32, 32), 0, 0); }
  function petFrames(p) { var fr = PetCore.renderFrames(p.art, { stage: p.stage, gearOverride: p.gearOverride, gearCap: RealCore.BUMP_SLOTS[p.art.tierIndex] });
    if (window.BonusGear && Object.keys(p.extraGear).length) BonusGear.decorate(PetCore, p.art, p.stage, fr, p.extraGear, p.gearOverride); return fr; }
  var commAnim = null;
  /* My Pets controls (rarity filter, sort, 12 per page), remembered in localStorage */
  var PET_PAGE = 12, petPage = 0, PUI = 'xcpets-mypets-ui';
  (function () { try { var u = JSON.parse(localStorage.getItem(PUI) || '{}'); if (u.tier) $('fTier').value = u.tier; if (u.sort) $('fSort').value = u.sort; petPage = u.page || 0; } catch (e) {} if (!$('fTier').value) $('fTier').value = 'all'; })();
  function savePetUi() { localStorage.setItem(PUI, JSON.stringify({ tier: $('fTier').value, sort: $('fSort').value, page: petPage })); }
  $('fTier').onchange = $('fSort').onchange = function () { petPage = 0; savePetUi(); if (state) render(); };
  var cemView = false; // My Pets tab: alive pets vs the player's own Pet Cemetery
  function setTab(c) { cemView = c; $('tabAlive').classList.toggle('on', !c); $('tabCem').classList.toggle('on', c); $('tabAlive').setAttribute('aria-selected', String(!c)); $('tabCem').setAttribute('aria-selected', String(c)); petPage = 0; if (state) render(); }
  $('tabAlive').onclick = function () { setTab(false); }; $('tabCem').onclick = function () { setTab(true); };
  $('delCommons').onclick = function () {
    var ids = (me && state ? RealCore.petsOf(state, me) : []).filter(function (p) { var h = hiddenIds(); return p.art && p.art.tierIndex === 0 && h.indexOf(p.id) < 0; }).map(function (p) { return p.id; });
    if (!ids.length) { stickyErr('No visible Commons to delete.'); return; }
    $('dcBody').innerHTML = '<p>Hide all <b>' + ids.length + '</b> Commons?</p><p class="small">Free, no burn, no wallet. They stay on chain; restore them any time from <b>Show discarded</b>.</p>';
    var prev = document.activeElement; $('delCommonsBox').classList.add('on'); focusFirst($('delCommonsBox'));
    var close = function () { $('delCommonsBox').classList.remove('on'); if (prev && prev.focus) prev.focus(); };
    $('dcNo').onclick = close;
    $('dcYes').onclick = function () { close(); try { markReviewed(ids); discardIds(ids, $('delCommons'), true); } catch (e) { stickyErr('Could not hide your Commons: ' + esc(e && e.message || String(e)) + '. Nothing was burned.'); } }; }; // same path as the reveal's Discard all Commons
  /* modals: Escape closes all; Tab stays inside the open one */
  function focusFirst(box) { var f = box.querySelector('button, [href], input, select'); if (f) setTimeout(function () { f.focus(); }, 0); }
  document.addEventListener('keydown', function (e) {
    var open = Array.prototype.filter.call(document.querySelectorAll('.reveal.on'), function (x) { return x.offsetParent !== null || x.classList.contains('on'); });
    if (e.key === 'Escape' && open.length) { open.forEach(function (x) { if (x.id === 'confirmBox' && $('cfNo')) $('cfNo').click(); else if (x.id === 'delCommonsBox') $('dcNo').click(); else x.classList.remove('on'); }); return; }
    if (e.key !== 'Tab' || !open.length) return;
    var box = open[open.length - 1], f = Array.prototype.filter.call(box.querySelectorAll('button:not([disabled]), [href], input, select'), function (x) { return x.offsetParent !== null; }); if (!f.length) return;
    if (!box.contains(document.activeElement)) { e.preventDefault(); f[0].focus(); return; }
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); } });
  function show(c, fr) { var x = c.getContext('2d'); paint(x, fr[0]); anim.push({ c: c, x: x, fr: fr, f: 0 }); }
  function toast(html, ms) { var t = document.createElement('div'); t.className = 'toast'; t.innerHTML = html; $('toasts').appendChild(t); setTimeout(function () { t.remove(); }, ms || 7000); }
  function stickyErr(html) { var t = document.createElement('div'); t.className = 'toast sticky-err'; t.setAttribute('role', 'alert');
    t.innerHTML = '<span class="warn">' + html + '</span> <button class="q errclose" type="button" aria-label="Dismiss">✕</button>'; $('toasts').appendChild(t);
    t.querySelector('.errclose').onclick = function () { t.remove(); }; return t; }
  function speciesLabel(id) { var s = PetCore.SPECIES.filter(function (x) { return x.id === id; })[0]; return s ? s.label : id; }
  function short(a) { return a.length > 14 ? a.slice(0, 7) + '…' + a.slice(-5) : a; }
  var waitToken = 0;
  function waitOpen() { $('waitOverlay').classList.add('on'); return ++waitToken; }
  function waitClose() { $('waitOverlay').classList.remove('on'); }
  $('waitCancel').onclick = function () { waitToken++; waitClose(); toast('Cancelled here. If the XCP Wallet popup is still open, reject it there.'); };
  (function () { var b = document.createElement('button'); b.id = 'sfxBtn'; b.className = 'q'; function lab() { b.textContent = Sfx.on() ? '🔊' : '🔇'; b.title = 'Sound effects'; }
    lab(); b.onclick = function () { Sfx.set(!Sfx.on()); lab(); }; b.style.cssText = 'position:fixed;bottom:12px;left:12px;z-index:40'; document.body.appendChild(b); })();

  // ---------------- XCP Wallet only ----------------
  function waitForXcp(ms) {
    return new Promise(function (resolve) {
      if (window.xcpwallet) return resolve(window.xcpwallet);
      var t0 = Date.now(), done = false;
      function fin() { if (done) return; if (window.xcpwallet || Date.now() - t0 >= ms) { done = true; resolve(window.xcpwallet || null); } }
      window.addEventListener('xcp-wallet#initialized', fin);
      try { window.dispatchEvent(new Event('xcp-wallet#discover')); } catch (e) { /* ignore */ }
      (function poll() { fin(); if (!done) setTimeout(poll, 150); })();
    });
  }
  var STORE = 'https://chromewebstore.google.com/detail/xcp-wallet/nicpjdbehgcjbjfjkobcidnfmfpijohg';
  function NotFound() { var e = new Error('XCP Wallet not found.'); e.html = 'XCP Wallet not found. Install the <a href="' + STORE + '" target="_blank" rel="noopener">XCP Wallet Chrome extension</a>, then refresh.'; return e; }
  function errHtml(e) { return e.html || esc(e.code ? Wallet.errMsg(e) : e.message); }
  function getWallet() {
    if (wallet) return Promise.resolve(wallet);
    return waitForXcp(2000).then(function (p) {
      if (!p) throw NotFound();
      var x = new Wallet.Wallet({ kind: 'xcpwallet', label: 'XCP Wallet', p: p });
      return x.connect().then(function (r) {
        if (!r.address) throw new Error('XCP Wallet returned no address');
        return x.network().then(function (n) {
          if (n && n !== NET && !(NET !== 'mainnet' && /test|signet/.test(n))) throw new Error('XCP Wallet is on ' + n + ' but this page is on ' + NET + '. Switch one of them.');
          wallet = x; if (p.on) p.on('accountsChanged', function (a) { if (a && a[0]) { wallet.address = a[0]; setMe(a[0]); } });
          return x;
        });
      });
    });
  }
  $('wconnect').onclick = function () { $('wMsg').textContent = 'Looking for XCP Wallet…';
    getWallet().then(function (w) { setMe(w.address); $('wMsg').textContent = 'Connected.'; }).catch(function (e) { $('wMsg').innerHTML = errHtml(e); }); };

  // ---------------- owner gate ----------------
  function unlock(why) { $('gate').style.display = 'none'; $('app').style.display = 'block'; $('hatchPanel').style.display = '';
    $('status').textContent = 'Owner access (' + why + ').'; if (wallet && wallet.address) setMe(wallet.address); load();
    if (!localStorage.getItem('xcpets-intro-seen')) intro(); }
  $('gWallet').onclick = function () {
    $('gOut').textContent = 'Looking for XCP Wallet…';
    getWallet().then(function (w) {
      var r = Gate.verifyProof(w.proof, location.origin, Date.now());
      if (r.ok) { Gate.saveSession(NET, { address: w.proof.address, message: w.proof.message, signature: w.proof.signature, kind: 'proof', issuedMs: Date.now() }); return unlock(r.reason); }
      if (!Gate.isAllowed(w.address)) throw new Error('This address is not the owner address. ' + r.reason);
      var n = PetCore.sha256Hex(Math.random() + ':' + Date.now()).slice(0, 32), at = Date.now(), msg = Gate.makeChallenge(w.address, n, at);
      return w.signMessage(msg).then(function (sig) { var v = Gate.verifySignature({ address: w.address, message: msg, signature: sig, issuedMs: at, nowMs: Date.now() }); $('gOut').textContent = v.reason; if (v.ok) { Gate.saveSession(NET, { address: w.address, message: msg, signature: sig, kind: 'challenge', issuedMs: at }); unlock(v.reason); } });
    }).catch(function (e) { $('gOut').innerHTML = errHtml(e); });
  };

  // ---------------- data ----------------
  /** API-down banner with Retry (shown when every read node failed). */
  function apiBanner(err) {
    var b = $('apiDown'); if (!b) { b = document.createElement('div'); b.id = 'apiDown'; b.className = 'apibanner'; b.setAttribute('role', 'alert'); document.querySelector('main').insertBefore(b, document.querySelector('main').firstChild); }
    if (!err) { b.style.display = 'none'; return; }
    b.style.display = 'block'; b.innerHTML = '⚠️ Can\'t reach the Counterparty nodes right now (' + esc(err.message).slice(0, 160) + '). Your pets are safe on-chain. <button class="btn" type="button" id="apiRetry">Retry</button>';
    $('apiRetry').onclick = function () { b.innerHTML = '<span class="spin"></span> Retrying…'; load(); balance(); };
  }
  function load() {
    $('status').textContent = 'Reading ' + CFG.asset + ' destroys on ' + NET + '…'; document.body.classList.add('loading');
    return Promise.all([chain.destructions(CFG.asset), chain.tip().catch(function () { return null; })]).then(function (res) {
      var rows = res[0]; tip = res[1]; var blocks = {}; rows.forEach(function (r) { blocks[r.block_index] = 1; });
      return chain.blockHashes(Object.keys(blocks), hashes, tip).then(function (bh) {
        localStorage.setItem(hashKey, JSON.stringify(hashes)); // only hashes >= 6 deep are persisted
        apiBanner(null);
        if (bh.missing.length) { // don't show a half-built state: pets/gear/drops all depend on block hashes
          $('status').innerHTML = '<span class="spin"></span> Syncing: waiting for ' + bh.missing.length + ' block hash' + (bh.missing.length > 1 ? 'es' : '') + ' (blocks ' + esc(bh.missing.slice(0, 3).join(', ')) + (bh.missing.length > 3 ? '…' : '') + '). Retrying in 15 s.';
          document.body.classList.add('syncing'); clearTimeout(load.retry); load.retry = setTimeout(load, 15000); return; }
        document.body.classList.remove('syncing'); var hashesNow = Object.assign({}, hashes, bh.hashes);
        var before = state ? RealCore.petsOf(state, me).length : null;
        state = RealCore.replay(rows, hashesNow, { tip: tip }); render(); counter(); revealPacks();
        var mine = me ? RealCore.petsOf(state, me) : [];
        if (before != null && mine.length > before) { var np = mine[mine.length - 1]; if (np.art) { Sfx.hatch(np.art.species); toast('🥚 It\'s a ' + PetCore.TIERS[np.art.tierIndex].label + ' ' + esc(speciesLabel(np.art.species)) + '!'); } }
        $('status').textContent = rows.length + ' ' + CFG.asset + ' destroys replayed (' + NET + ')' + (tip ? ' · tip ' + tip : '') + '.';
      });
    }).catch(function (e) { $('status').innerHTML = '<span class="warn">' + esc(e.message) + '</span>'; apiBanner(e); }).then(function () { document.body.classList.remove('loading'); });
  }
  /* Sum every row (address + UTXO-attached balances), prefer quantity_normalized (verbose), else raw/1e8 for divisible. 0 if none. */
  function balanceOf(j) {
    var rows = j && j.result; if (!rows) return 0; if (!Array.isArray(rows)) rows = [rows];
    return rows.reduce(function (a, r) { var div = !r.asset_info || r.asset_info.divisible !== false;
      return a + (r.quantity_normalized != null ? Number(r.quantity_normalized) : Number(r.quantity || 0) / (div ? 1e8 : 1)); }, 0);
  }
  var balSeq = 0;
  function balance() {
    $('balErr').textContent = '';
    if (!me) { $('bal').className = 'bal'; $('bal').textContent = '–'; return; }
    var n = ++balSeq; $('bal').className = 'bal loading'; $('bal').textContent = 'Loading…';
    chain.getJson('/addresses/' + encodeURIComponent(me) + '/balances/' + CFG.asset + '?verbose=true').then(function (j) {
      if (n !== balSeq) return; $('bal').className = 'bal'; $('bal').innerHTML = '🔥 ' + fmt(balanceOf(j)) + ' <small>' + esc(CFG.asset) + '</small>';
    }).catch(function (e) { if (n !== balSeq) return; $('bal').className = 'bal'; $('bal').textContent = '?'; $('balErr').textContent = 'Could not load balance: ' + e.message; });
  }
  $('balRefresh').onclick = balance;
  /* After a pack burn confirms: show its eggs in a reveal grid once (remembered per txid). */
  /* ---- Hatch review: new pets are 'unreviewed' (UI only; they exist on chain regardless) until you keep or discard them. ---- */
  function revKey() { return 'xcpets-reviewed-' + NET + '-' + (me || ''); }
  function reviewedIds() {
    if (!me || !state) return [];
    var raw = localStorage.getItem(revKey()), mine = RealCore.petsOf(state, me);
    if (raw == null) { // first ever load: single hatches count as already reviewed; pack eggs (dozen/case) come up for review
      var init = mine.filter(function (p) { return !p.pack; }).map(function (p) { return p.id; }); localStorage.setItem(revKey(), JSON.stringify(init)); return init; }
    try { return JSON.parse(raw); } catch (e) { return []; }
  }
  function markReviewed(ids) { var r = reviewedIds(); ids.forEach(function (i) { if (r.indexOf(i) < 0) r.push(i); }); localStorage.setItem(revKey(), JSON.stringify(r)); }
  function unreviewed() { if (!me || !state) return []; var r = reviewedIds(), hid = hiddenIds(); return RealCore.petsOf(state, me).filter(function (p) { return p.art && r.indexOf(p.id) < 0 && hid.indexOf(p.id) < 0; }); }
  function reviewGroups() { var g = {}, order = []; unreviewed().forEach(function (p) { var k = p.hatchTxid; if (!g[k]) { g[k] = []; order.push(k); } g[k].push(p); }); return order.map(function (k) { return { tx: k, eggs: g[k] }; }); }
  function renderReview() {
    var box = $('reviewBox'), gs = reviewGroups(), n = gs.reduce(function (a, x) { return a + x.eggs.length; }, 0);
    if (!box) return; box.style.display = n ? '' : 'none'; if (!n) return;
    box.innerHTML = '<h2 class="sec" data-ico="egg">🥚 Eggs to review (' + n + ')</h2><p class="small muted">New hatches wait here before joining My Pets. Keep them or discard: discarding is free and only hides a pet in this browser (it stays on chain; restore any time).</p><div class="row">' +
      gs.map(function (x, i) { var e = x.eggs, pk = e[0].pack; return '<button class="btn ico-egg" type="button" data-g="' + i + '">' + (pk ? (pk.n === 144 ? 'Case' : 'Dozen') : 'Hatch') + ' · ' + e.length + ' egg' + (e.length > 1 ? 's' : '') + ' · #' + e[0].id + (e.length > 1 ? '–' + e[e.length - 1].id : '') + '</button>'; }).join('') + '</div>';
    Array.prototype.forEach.call(box.querySelectorAll('[data-g]'), function (b) { b.onclick = function () { showPack(gs[Number(b.getAttribute('data-g'))].eggs); }; });
  }
  function revealPacks() { // after a hatch confirms, open its review once
    var seenKey = 'xcpets-pack-revealed-' + NET, seen = JSON.parse(localStorage.getItem(seenKey) || '{}');
    renderReview();
    tracker.list().forEach(function (t) {
      if (!(t.eggs >= 1) || seen[t.txid]) return;
      var eggs = unreviewed().filter(function (p) { return p.hatchTxid === t.txid; }); if (!eggs.length) return;
      if (eggs.some(function (p) { return !p.art; })) return; // block hash not known yet
      seen[t.txid] = 1; localStorage.setItem(seenKey, JSON.stringify(seen)); showPack(eggs);
    });
  }
  var rev = { eggs: [], page: 0, sel: {} }, REV_PAGE = 36;
  function showPack(eggs) {
    var hid = hiddenIds(); eggs = eggs.filter(function (p) { return hid.indexOf(p.id) < 0; }); if (!eggs.length) { renderReview(); return; }
    rev = { eggs: eggs, page: 0, sel: {} }; drawPack(); if (eggs[0].art) Sfx.hatch(eggs[eggs.length - 1].art.species);
    $('packBox').classList.add('on'); focusFirst($('packBox'));
  }
  function drawPack() {
    var eggs = rev.eggs, tiers = [0, 0, 0, 0], pages = Math.max(1, Math.ceil(eggs.length / REV_PAGE)); rev.page = Math.min(rev.page, pages - 1);
    eggs.forEach(function (p) { tiers[p.art.tierIndex]++; });
    $('packTitle').textContent = eggs.length + ' egg' + (eggs.length > 1 ? 's' : '') + ' to review';
    $('packSummary').innerHTML = esc(PetCore.TIERS.map(function (t, i) { return tiers[i] + ' ' + t.label; }).join(' · ')) + ' · ' + Object.keys(rev.sel).length + ' ticked' +
      (pages > 1 ? ' <span class="pager"><button class="q" type="button" id="pkPrev"' + (rev.page ? '' : ' disabled') + '>‹ Prev</button> page ' + (rev.page + 1) + '/' + pages + ' <button class="q" type="button" id="pkNext"' + (rev.page < pages - 1 ? '' : ' disabled') + '>Next ›</button></span>' : '');
    if ($('pkPrev')) { $('pkPrev').onclick = function () { rev.page--; drawPack(); }; $('pkNext').onclick = function () { rev.page++; drawPack(); }; }
    $('packGrid').innerHTML = ''; eggs.slice(rev.page * REV_PAGE, rev.page * REV_PAGE + REV_PAGE).forEach(function (p) {
      var d = document.createElement('div'); d.className = 'egg t' + p.art.tierIndex + (rev.sel[p.id] ? ' discard' : ''); d.innerHTML = '<canvas width="32" height="32"></canvas><div>#' + p.id + ' ' + PetCore.TIERS[p.art.tierIndex].label + '</div><label class="small disc"><input type="checkbox" data-id="' + p.id + '"' + (rev.sel[p.id] ? ' checked' : '') + '> Discard</label>'; $('packGrid').appendChild(d);
      paint(d.querySelector('canvas').getContext('2d'), petFrames(p)[0]);
      d.querySelector('input').onchange = function () { if (this.checked) rev.sel[p.id] = 1; else delete rev.sel[p.id]; d.classList.toggle('discard', this.checked); };
    });
  }
  function closeReview(keepRest) { if (keepRest) markReviewed(rev.eggs.map(function (p) { return p.id; })); $('packBox').classList.remove('on'); render(); }
  $('packClose').onclick = function () { closeReview(true); };
  if ($('packSkip')) $('packSkip').onclick = function () { $('packBox').classList.remove('on'); };
  $('packCommons').onclick = function () { var ids = rev.eggs.filter(function (p) { return p.art.tierIndex === 0; }).map(function (p) { return p.id; });
    if (!ids.length) { toast('No Commons in this hatch.'); return; } markReviewed(ids); rev.eggs = rev.eggs.filter(function (p) { return ids.indexOf(p.id) < 0; }); discardIds(ids, $('packCommons'), true);
    if (rev.eggs.length) { drawPack(); $('packBox').classList.add('on'); } };
  $('packDiscard').onclick = function () { var ids = Object.keys(rev.sel).map(Number); if (!ids.length) { toast('Tick Discard on at least one pet first.'); return; }
    var burnNeeded = ids.some(function (id) { var p = byIdNow(id); return p && p.art && p.art.tierIndex > 0; });
    markReviewed(ids); rev.eggs = rev.eggs.filter(function (p) { return ids.indexOf(p.id) < 0; }); rev.sel = {}; discardIds(ids, $('packDiscard'), true);
    if (rev.eggs.length && !burnNeeded) { drawPack(); $('packBox').classList.add('on'); } };
  function byIdNow(id) { return state.pets.filter(function (p) { return p.id === id; })[0]; }
  /* Local discard (any rarity): no burn, just hidden in THIS browser for this network + address. Still on-chain; restorable. */
  function hidKey() { return 'xcpets-hidden-' + NET + '-' + (me || ''); }
  function hiddenIds() { try { return JSON.parse(localStorage.getItem(hidKey()) || '[]'); } catch (e) { return []; } }
  function setHidden(l) { localStorage.setItem(hidKey(), JSON.stringify(l.filter(function (x, i, a) { return a.indexOf(x) === i; }))); }
  function hideLocal(ids) { setHidden(hiddenIds().concat(ids)); render();
    toast('🗑️ Hid ' + ids.length + ' pet' + (ids.length > 1 ? 's' : '') + ' in this browser (free, still on chain). <a href="#" class="undo">Undo</a>', 9000);
    var u = $('toasts').lastChild.querySelector('.undo'); if (u) u.onclick = function (e) { e.preventDefault(); restoreLocal(ids); this.parentNode.remove(); }; }
  function restoreLocal(ids) { setHidden(hiddenIds().filter(function (x) { return ids.indexOf(x) < 0; })); render(); toast('Restored #' + ids.join(', #') + '.'); }
  function discardIds(ids, btn, keepOpen) { // every rarity: free local hide only (no burn, no wallet); pets stay on chain
    if (!ids.length) { toast('Tick Discard on at least one pet first.'); return; }
    hideLocal(ids); if (!keepOpen) $('packBox').classList.remove('on');
  }
  function counter() {
    $('cBurned').textContent = fmt(state.community.burned);
    $('cGame').textContent = fmt(state.log.filter(function (e) { return /^pet:/i.test(e.tag); }).length);
    $('cPets').textContent = fmt(state.pets.length);
  }
  function setMe(a) { var changed = a !== me; me = a; if (changed) setTimeout(loadMempool, 0); localStorage.setItem(ADDR_KEY, a); $('me').textContent = short(a); $('me').title = a; $('wconnect').textContent = '🟢 ' + short(a); $('wdisconnect').style.display = ''; balance(); if (state) render(); }
  /* Disconnect: clear the shared address, the wallet-based owner unlock (passphrase unlock stays), the view; ask XCP Wallet to forget this site (xcp_disconnect). */
  function disconnect() {
    var p = wallet && wallet.w.p || window.xcpwallet; wallet = null; me = ''; balSeq++; localStorage.removeItem(ADDR_KEY);
    if (!Gate.CONFIG.launched) { Gate.clearSession(NET); $('app').style.display = 'none'; $('hatchPanel').style.display = 'none'; $('gate').style.display = ''; }
    $('me').textContent = 'not connected'; $('wconnect').textContent = 'Connect wallet'; $('wdisconnect').style.display = 'none'; $('bal').className = 'bal'; $('bal').textContent = '–'; $('balErr').textContent = ''; $('wMsg').textContent = 'Disconnected.';
    if (state) render();
    if (p && p.request) p.request({ method: 'xcp_disconnect' }).catch(function () { /* site-side only */ });
  }
  $('wdisconnect').onclick = disconnect;
  var discardHash = (location.hash.match(/^#discard-(\d+)$/) || [])[1];
  function render() {
    applyLo();
    if (discardHash && state && me) { var dp = byIdNow(Number(discardHash)); discardHash = null; history.replaceState(null, '', location.pathname + location.search);
      if (dp && dp.owner === me) setTimeout(function () { discardIds([dp.id]); }, 300); else toast('Connect the wallet that owns that pet to discard it.'); }
    anim = [];
    var c = state.community;
    // Community pet sprite (real pet-core art at its current stage; stage 0 = its egg). Light bg so the egg reads on the dark theme.
    var cfr = PetCore.renderFrames(PetCore.characterPet('nakamoto', { bgColor: '#2a3a2e' }), { stage: c.stage });
    if (!commAnim) { var cv = document.createElement('canvas'); cv.width = cv.height = 32; cv.id = 'commCanvas'; cv.className = 'commsprite'; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'Community pet');
      $('community').parentNode.insertBefore(cv, $('community')); commAnim = { c: cv, x: cv.getContext('2d'), fr: cfr, f: 0 }; anim.push(commAnim); paint(commAnim.x, cfr[0]); } else commAnim.fr = cfr;
    $('community').innerHTML = '<b>' + esc(state.communityName) + '</b> · ' + N[c.stage] + ' · ' + fmt(c.burned) + ' ' + esc(CFG.asset) + ' burned' + (c.next ? ' · next stage at ' + fmt(c.next) : '') +
      (c.next ? '<div class="bar"><i style="width:' + Math.min(100, 100 * c.burned / c.next).toFixed(1) + '%"></i></div>' : '');
    var all = me ? RealCore.petsOf(state, me) : [], hid = hiddenIds(), revd = reviewedIds(), owned = all.filter(function (p) { return hid.indexOf(p.id) < 0; }), mine = owned.filter(function (p) { return !p.art || p.dead || revd.indexOf(p.id) >= 0; }), gone = all.filter(function (p) { return hid.indexOf(p.id) >= 0; });
    renderReview(); var nCommons = owned.filter(function (p) { return p.art && p.art.tierIndex === 0; }).length; $('delCommons').textContent = '🗑️ Delete all Commons (' + nCommons + ')'; $('delCommons').disabled = !nCommons;
    var nAlive = mine.filter(function (p) { return !p.dead; }).length; $('petBadge').textContent = nAlive; $('nAlive').textContent = nAlive;
    $('pets').innerHTML = mine.length ? '' : '<p class="muted">' + (me ? 'No pets for this address yet. Hatch one!' : 'Connect your XCP Wallet to see your pets.') + '</p>';
    var nDead = mine.filter(function (p) { return p.dead; }).length; $('nDead').textContent = nDead;
    var fT = $('fTier').value, fS = $('fSort').value, list = mine.filter(function (p) { return cemView ? p.dead : !p.dead && (fT === 'all' || fT === 'cemetery' || (p.art && PetCore.TIERS[p.art.tierIndex].id === fT)); }).slice().reverse();
    if (cemView) list.sort(function (a, b) { return b.dead.block - a.dead.block || b.id - a.id; });
    if (fS === 'tier') list.sort(function (a, b) { return (b.art ? b.art.tierIndex : -1) - (a.art ? a.art.tierIndex : -1) || b.id - a.id; });
    if (fS === 'stage') list.sort(function (a, b) { return b.stage - a.stage || b.care - a.care || b.id - a.id; });
    var pages = Math.max(1, Math.ceil(list.length / PET_PAGE)); petPage = Math.min(petPage, pages - 1);
    $('petPager').innerHTML = list.length > PET_PAGE ? '<button class="q" type="button" id="ppPrev"' + (petPage ? '' : ' disabled') + '>‹ Prev</button> page ' + (petPage + 1) + ' / ' + pages + ' · ' + list.length + ' pets <button class="q" type="button" id="ppNext"' + (petPage < pages - 1 ? '' : ' disabled') + '>Next ›</button>' : (mine.length ? list.length + ' of ' + mine.length + ' pets' : '');
    if ($('ppPrev')) { $('ppPrev').onclick = function () { petPage--; savePetUi(); render(); }; $('ppNext').onclick = function () { petPage++; savePetUi(); render(); }; }
    if (!list.length && mine.length) $('pets').innerHTML = '<p class="muted">' + (cemView ? 'No pets in your Pet Cemetery. Feed each pet at least once every ' + RealCore.NEGLECT_DAYS + ' chain days to keep it that way.' : 'No pets match this filter.') + '</p>';
    list.slice(petPage * PET_PAGE, petPage * PET_PAGE + PET_PAGE).forEach(function (p) {
      var d = document.createElement('div'); d.className = 'pet card' + (p.dead ? ' dead' : ''); d.tabIndex = 0;
      var tier = p.art ? PetCore.TIERS[p.art.tierIndex] : null;
      d.innerHTML = '<canvas class="sprite" width="32" height="32"></canvas><h4>' + esc(p.name || (p.art ? p.art.defaultName || speciesLabel(p.art.species) : 'pending')) + ' <span class="muted">#' + p.id + '</span></h4><div class="chips">' +
        (p.art ? '<span class="chip">' + esc(speciesLabel(p.art.species)) + '</span><span class="pill tier tier-' + tier.id + '">' + tier.label + '</span>' : '<span class="chip">waiting for block</span>') +
        '<span class="chip stg">' + p.stageName + '</span><span class="chip' + fedCls(p) + '" title="' + esc(deathNote(p)) + '">' + fedLabel(p) + '</span>' + (p.streak ? '<span class="chip">🔥' + p.streak + '</span>' : '') + '</div>';
      d.onclick = d.onkeydown = function (e) { if (e.type === 'click' || e.key === 'Enter') detail(p); };
      $('pets').appendChild(d); if (p.art) show(d.querySelector('canvas'), petFrames(p));
    });
    if (gone.length) { var w = document.createElement('div'); w.className = 'hiddenbox'; w.innerHTML = '<details><summary>Show discarded (' + gone.length + ')</summary><p class="small muted">Commons you hid in this browser. They still exist on-chain (others and other devices see them).</p>' +
      gone.map(function (p) { return '<span class="chip">#' + p.id + ' ' + esc(p.art ? p.art.defaultName || speciesLabel(p.art.species) : '') + ' <a href="#" data-restore="' + p.id + '">Restore</a></span>'; }).join(' ') + '</details>';
      $('pets').appendChild(w); Array.prototype.forEach.call(w.querySelectorAll('[data-restore]'), function (a) { a.onclick = function (e) { e.preventDefault(); restoreLocal([Number(a.getAttribute('data-restore'))]); }; }); }
    renderInv(mine, gone);
    var seenTx = {};
    $('log').innerHTML = state.log.slice(-200).reverse().filter(function (e) { var h = realTx(e.tx_hash); if (seenTx[h]) return false; seenTx[h] = 1; return true; }).map(function (e) { var ti = tagInfo(e.tag);
      return '<a href="#" class="txrow" data-tx="' + esc(realTx(e.tx_hash)) + '">' + ti[0] + ' ' + esc(ti[1]) + ' · ' + fmt(e.pack ? (state.log.filter(function (x) { return realTx(x.tx_hash) === realTx(e.tx_hash); }).reduce(function (a, x) { return a + x.amount; }, 0)) : e.amount) + ' ' + esc(CFG.asset) + ' · block ' + e.block_index + ' · ' + esc(e.source.slice(0, 8)) + '… → ' + esc(e.kind) + ': ' + esc(e.msg) + '</a>'; }).join('') || 'No game burns yet.';
    bindTxRows($('log'));
    renderPending();
  }
  var iconCache = {};
  function itemFrames(it) {
    var key = it.item + '|' + it.species; if (iconCache[key]) return iconCache[key];
    var base = PetCore.characterPet(it.species || 'pepe', { tier: 'common', bgColor: '#142018' }), go = {}, extra = {};
    if (BONUS.indexOf(it.slot) >= 0 || it.overlay) extra[it.slot] = it.item; else go[it.slot] = it.item;
    var fr; try { fr = PetCore.renderFrames(base, { stage: 3, gearOverride: go }); if (window.BonusGear && Object.keys(extra).length) BonusGear.decorate(PetCore, base, 3, fr, extra, go); }
    catch (e) { fr = PetCore.renderFrames(base, { stage: 3, gearOverride: {} }); }
    return (iconCache[key] = fr);
  }
  function renderInv(mine, gone) {
    $('tokens').textContent = mine.reduce(function (a, p) { return a + p.tokens; }, 0); $('keys').textContent = mine.reduce(function (a, p) { return a + p.keys; }, 0);
    var hid = hiddenIds(), byPet = {}; state.pets.forEach(function (p) { byPet[p.id] = p; });
    var items = (state.inventoryOf ? state.items.filter(function (g) { return g.owner === me; }) : []).map(function (g) { var p = g.on != null ? byPet[g.on] : null;
      return { gid: g.gid, slot: g.slot, item: g.item, label: g.label, tier: g.tier || 0, pet: p, species: g.species || (p && p.art && p.art.species) || (byPet[g.rolledOn] && byPet[g.rolledOn].art && byPet[g.rolledOn].art.species), sig: g.species, worn: !!p, tx: g.tx, overlay: g.overlay, unavailable: !!(p && hid.indexOf(p.id) >= 0) }; });
    var bag = items.filter(function (it) { return !it.pet; }).length;
    if ($('invCount')) $('invCount').textContent = bag;
    var box = $('inv'); box.innerHTML = items.length ? '' : '<p class="muted small">No gear yet. Open a pet and burn for a gear roll.</p>';
    INV_ORDER.forEach(function (slot) {
      var l = items.filter(function (it) { return it.slot === slot; }).sort(function (a, b) { return b.tier - a.tier; }); if (!l.length) return;
      var h = document.createElement('div'); h.className = 'invslot'; h.textContent = SLOT_ICON[slot] + ' ' + SLOT_LABEL[slot] + (BONUS.indexOf(slot) >= 0 ? ' (bonus)' : '') + ' · ' + l.length; box.appendChild(h);
      var g = document.createElement('div'); g.className = 'invgrid'; box.appendChild(g);
      l.forEach(function (it) {
        var c = document.createElement('div'); c.className = 'invcard t' + it.tier + (it.unavailable ? ' na' : ''); c.tabIndex = 0; c.title = it.label;
        c.innerHTML = '<canvas width="32" height="32"></canvas>' + (it.unavailable ? '<span class="worn">🚫 #' + it.pet.id + '</span>' : it.worn ? '<span class="worn">#' + it.pet.id + '</span>' : '<span class="worn bag">🎒</span>') + esc(it.label); g.appendChild(c);
        paint(c.querySelector('canvas').getContext('2d'), itemFrames(it)[0]);
        c.onclick = c.onkeydown = function (e) { if (e.type === 'click' || e.key === 'Enter') openItem(it); };
      });
    });
  }
  /* ---- free local loadout (no burn): saved per network + owner address, keyed by pet id; applied on top of the chain's gear ---- */
  function loKey() { return 'xcpets-loadout-' + NET + '-' + me; }
  function loadLo() { try { return JSON.parse(localStorage.getItem(loKey()) || '{}'); } catch (e) { return {}; } }
  function saveLo(lo) { localStorage.setItem(loKey(), JSON.stringify(lo)); }
  function applyLo() { if (!state || !state.items || !me) return; var lo = loadLo(), r = RealCore.applyLoadout(state, me, lo);
    if (r.dropped.length) { saveLo(r.lo); toast('Gear: ' + r.dropped.length + ' saved change' + (r.dropped.length > 1 ? 's' : '') + ' no longer fit' + (r.dropped.length > 1 ? '' : 's') + ' the chain (new roll or pet gone) and ' + (r.dropped.length > 1 ? 'were' : 'was') + ' dropped.'); } }
  function setGear(petId, slot, gid, msg) {
    var before = JSON.stringify(loadLo()); saveLo(RealCore.loadoutSet(state, loadLo(), petId, slot, gid, Date.now())); render();
    var p = byIdNow(petId); if (p && $('detail').classList.contains('on')) detail(p);
    toast(esc(msg) + ' <button class="btn retrybtn" type="button">Undo</button>', 8000);
    var u = $('toasts').lastChild.querySelector('.retrybtn'); if (u) u.onclick = function () { localStorage.setItem(loKey(), before); this.parentNode.remove(); render(); var q = byIdNow(petId); if (q && $('detail').classList.contains('on')) detail(q); };
  }
  function fitsPet(it, p) { return p.art && p.openSlots.indexOf(it.slot) >= 0 && (!it.sig || it.sig === p.art.species) && !(it.pet && it.pet.id === p.id); }
  function equipTargets(it) { var hid = hiddenIds(); return RealCore.petsOf(state, me).filter(function (p) { return hid.indexOf(p.id) < 0 && !p.dead && fitsPet(it, p); }); }
  function openItem(it) {
    $('itemTitle').textContent = SLOT_ICON[it.slot] + ' ' + it.label; paint($('itemCanvas').getContext('2d'), itemFrames(it)[0]);
    var tg = it.unavailable ? [] : equipTargets(it);
    $('itemInfo').innerHTML = '<p>' + SLOT_LABEL[it.slot] + ' slot · ' + (PetCore.TIERS[it.tier] ? PetCore.TIERS[it.tier].label : '') + (it.sig ? ' · ' + esc(speciesLabel(it.sig)) + ' only' : '') +
      (it.unavailable ? ' · unavailable: worn by #' + it.pet.id + ', a pet you discarded in this browser. Restore the pet to use it.</p>' : it.pet ? ' · on #' + it.pet.id + '</p>' : ' · 🎒 in your inventory</p>') +
      (it.unavailable ? '' : '<div class="acts gearacts">' + (it.pet ? '<button class="act gear un" id="itemOff">Take off</button>' : '') + tg.map(function (p) { return '<button class="act gear" data-eq="' + p.id + '">' + (it.pet ? 'Move to' : 'Equip on') + ' #' + p.id + ' <small>' + esc(p.name || (p.art.defaultName || speciesLabel(p.art.species))) + (p.equip[it.slot] ? ' · swap' : '') + '</small></button>'; }).join('') +
        (!tg.length ? '<span class="small muted">No other pet of yours has an open ' + SLOT_LABEL[it.slot].toLowerCase() + ' slot' + (it.sig ? ' (' + esc(speciesLabel(it.sig)) + ' only)' : '') + '.</span>' : '') + '</div>') +
      '<p class="small muted">Equipping is free and saved on this device; other viewers see the pet\'s rolled gear.</p>' +
      (it.tx ? '<p class="small"><a target="_blank" rel="noopener" href="' + CFG.mempool + '/tx/' + encodeURIComponent(realTx(it.tx)) + '">roll tx</a></p>' : '');
    if ($('itemOff')) $('itemOff').onclick = function () { closeItem(); setGear(it.pet.id, it.slot, null, 'Took ' + it.label + ' off #' + it.pet.id + '.'); };
    Array.prototype.forEach.call($('itemInfo').querySelectorAll('[data-eq]'), function (b) { b.onclick = function () { closeItem(); openEquipPicker(byIdNow(Number(b.getAttribute('data-eq'))), it.slot, it.gid); }; });
    $('itemBox').classList.add('on');
  }
  /* Equip picker for one slot of a pet: thumbnails of every owned item that fits (inventory or another pet, "on #N"), live preview, Confirm. */
  function openEquipPicker(p, slot, only) {
    var hid = hiddenIds(), byPet = {}; state.pets.forEach(function (x) { byPet[x.id] = x; });
    var list = state.items.filter(function (g) { return g.owner === me && g.slot === slot && g.on !== p.id && (only == null || g.gid === only) && !(g.on != null && hid.indexOf(g.on) >= 0) && (!g.species || g.species === p.art.species); })
      .sort(function (a, b) { return (a.on != null ? 1 : 0) - (b.on != null ? 1 : 0) || b.tier - a.tier; });
    var swap = !!p.equip[slot];
    GearUI.pick({ title: GearUI.ICON[slot] + ' ' + GearUI.LABEL[slot] + ' for #' + p.id + ' ' + (p.name || p.art.defaultName || speciesLabel(p.art.species)), now: petFrames(p),
      empty: 'No item of yours fits this ' + GearUI.LABEL[slot].toLowerCase() + ' slot yet. Roll one first.',
      items: list.map(function (g) { return { g: g, label: g.label, frames: GearUI.thumb(PetCore, window.BonusGear, g, p.art.species), badge: g.on != null ? 'on #' + g.on : '🎒', inv: g.on == null, swap: swap,
        preview: function () { var ch = {}; ch[slot] = g; return GearUI.wearing(PetCore, window.BonusGear, p.art, p.stage, p.gearOverride, p.extraGear, ch, RealCore.BUMP_SLOTS[p.art.tierIndex]); } }; }),
      onConfirm: function (it) { setGear(p.id, slot, it.g.gid, 'Equipped ' + it.label + ' on #' + p.id + (it.g.on != null ? ' (moved from #' + it.g.on + ')' : '') + '.'); } });
  }
  function gearArea(p) {
    var tier = p.art.tierIndex, base = RealCore.BUMP_SLOTS[tier], rows = [];
    RealCore.SLOTS.forEach(function (sl, i) { rows.push({ slot: sl, locked: i >= base, lockNote: i >= base ? 'needs a higher rarity' : '', item: worn(sl) }); });
    RealCore.BONUS.forEach(function (sl) { if (p.openSlots.indexOf(sl) >= 0) rows.push({ slot: sl, item: worn(sl) }); });
    function worn(sl) { var g = state.items.filter(function (x) { return x.on === p.id && x.slot === sl; })[0]; return g ? { label: g.label, frames: GearUI.thumb(PetCore, window.BonusGear, g, p.art.species) } : null; }
    return GearUI.area(rows, { canEdit: p.owner === me, onOff: function (sl) { var g = state.items.filter(function (x) { return x.on === p.id && x.slot === sl; })[0]; setGear(p.id, sl, null, 'Took ' + (g ? g.label : sl) + ' off #' + p.id + '.'); },
      onEquip: function (sl) { openEquipPicker(p, sl); } });
  }
  function closeItem() { $('itemBox').classList.remove('on'); }
  $('itemClose').onclick = closeItem;
  /* ---- transactions: clickable rows + in-game panel (status, amount, tag, BTC fee, sat/vB, time, explorer links) ---- */
  var XCP_EXPLORER = { mainnet: 'https://www.xcp.io/tx/' }; // verified 2026-10-11: xcp.io/tx/<hash> (xchain.io/tx/<hash> also works on mainnet)
  function realTx(h) { return String(h).split(':')[0]; }
  function tagInfo(tag) { var t = String(tag || '').toLowerCase();
    if (/^pet:hatch(12|144)$/.test(t)) return ['🥚', t === 'pet:hatch12' ? 'Dozen egg pack' : 'Case egg pack']; if (t === 'pet:hatch') return ['🥚', 'Hatch'];
    if (/^pet:feed:\d/.test(t)) return ['🍖', 'Feed pet #' + t.split(':')[2]]; if (t === 'pet:feed') return ['🍖', 'Feed community'];
    if (/^pet:(roll|troll):/.test(t)) return ['⚔️', (/troll/.test(t) ? 'Token roll' : 'Gear roll') + ' #' + t.split(':')[2]]; if (/^pet:key:/.test(t)) return ['🔑', 'Use key #' + t.split(':')[2]];
    if (/^pet:evolve:/.test(t)) return ['✨', 'Evolve #' + t.split(':')[2]]; if (/^pet:c:/.test(t)) return ['🏛️', /back/.test(t) ? 'Back candidate' : 'Community roll'];
    return ['🔥', t ? 'Burn "' + t + '"' : 'Plain burn']; }
  function statusTxt(t) { return t.status === 'confirmed' ? '✅ confirmed' + (t.block ? ' in block ' + t.block : '') : '⏳ waiting to confirm'; }
  function txRow(t) { var ti = tagInfo(t.tag);
    return '<a href="#" class="txrow" data-tx="' + esc(t.txid) + '">' + ti[0] + ' ' + esc(ti[1]) + ' · ' + fmt(t.amount) + ' ' + esc(CFG.asset) + ' · ' + statusTxt(t) + ' · ' + esc(t.txid.slice(0, 6)) + '…</a>'; }
  function bindTxRows(root) { Array.prototype.forEach.call(root.querySelectorAll('.txrow'), function (a) { a.onclick = function (e) { e.preventDefault(); openTx(a.getAttribute('data-tx')); }; }); }
  function renderPending() {
    var l = tracker.list().slice().sort(function (a, b) { return (b.at || 0) - (a.at || 0); }).slice(0, 15);
    $('pending').innerHTML = l.length ? l.map(txRow).join('') : 'None yet.'; bindTxRows($('pending'));
  }
  /* Pending from the Counterparty mempool for the connected address (not just this browser): ASSET_DESTRUCTION events. */
  function loadMempool() {
    if (!me) return Promise.resolve();
    return chain.getJson('/mempool/events?event_name=ASSET_DESTRUCTION&limit=1000').then(function (j) {
      (j.result || []).forEach(function (ev) { var p = ev.params || {};
        if (p.source !== me || String(p.asset).toUpperCase() !== String(CFG.asset).toUpperCase()) return;
        var have = tracker.list().filter(function (t) { return t.txid === ev.tx_hash; })[0];
        if (!have) tracker.add({ txid: ev.tx_hash, tag: GameCore.decodeTag(p.tag), amount: Number(p.quantity) / 1e8, label: tagInfo(GameCore.decodeTag(p.tag))[1], at: Math.round((ev.timestamp || Date.now() / 1000) * 1000), status: 'mempool' });
      });
      renderPending();
    }).catch(function () { /* mempool list is best-effort */ });
  }
  function openTx(txid) {
    txid = String(realTx(txid) || '').toLowerCase(); if (!/^[0-9a-f]{64}$/.test(txid)) return; var t = tracker.list().filter(function (x) { return x.txid === txid; })[0] || {}, e = state ? state.log.filter(function (x) { return realTx(x.tx_hash) === txid; })[0] : null;
    var ti = tagInfo(t.tag || (e && e.tag)), links = '<a target="_blank" rel="noopener" href="' + CFG.mempool + '/tx/' + txid + '">mempool.space ↗</a>' + (XCP_EXPLORER[NET] ? ' · <a target="_blank" rel="noopener" href="' + XCP_EXPLORER[NET] + txid + '">Counterparty (xcp.io) ↗</a>' : ' · <a target="_blank" rel="noopener" href="' + CFG.read[0] + '/transactions/' + txid + '">Counterparty node (JSON) ↗</a>');
    $('txTitle').textContent = ti[0] + ' ' + ti[1];
    $('txInfo').innerHTML = '<p><code style="word-break:break-all">' + esc(txid) + '</code></p><p id="txLive">Loading…</p><p>' + links + '</p>';
    $('txBox').classList.add('on');
    Promise.all([chain.getJson('/transactions/' + txid).catch(function () { return null; }), fetch(CFG.mempoolApi + '/tx/' + txid).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }), chain.tip().catch(function () { return tip; })]).then(function (r) {
      var cp = r[0] && r[0].result, mp = r[1], h = r[2], block = (mp && mp.status && mp.status.confirmed && mp.status.block_height) || (cp && cp.block_index > 0 && cp.block_index < 9999999 ? cp.block_index : null);
      var conf = block && h ? Math.max(1, h - block + 1) : 0, fee = mp ? mp.fee : cp ? cp.fee : null, vsize = mp ? Math.ceil(mp.weight / 4) : null;
      var amt = t.amount != null ? t.amount : e ? e.amount : null, when = mp && mp.status && mp.status.block_time ? mp.status.block_time * 1000 : t.at || (cp && cp.block_time ? cp.block_time * 1000 : null);
      $('txLive').innerHTML = '<b>' + (block ? '✅ Confirmed in block ' + block + ' (' + conf + ' confirmation' + (conf === 1 ? '' : 's') + ')' : '⏳ Waiting to confirm (in mempool)') + '</b><br>' +
        'Amount: <b>' + (amt != null ? fmt(amt) + ' ' + esc(CFG.asset) : '?') + '</b> · Tag: <code>' + esc(t.tag || (e && e.tag) || '') + '</code><br>' +
        'BTC fee: <b>' + (fee != null ? fmt(fee) + ' sats' : '?') + '</b>' + (fee != null && vsize ? ' · ' + (fee / vsize).toFixed(1) + ' sat/vB · ' + vsize + ' vB' : '') + '<br>' +
        'Time: ' + (when ? new Date(when).toLocaleString() : '?');
      if (block && t.txid && t.status !== 'confirmed') { tracker.add(Object.assign({}, t, { status: 'confirmed', block: block })); renderPending(); }
    });
  }
  $('txClose').onclick = function () { $('txBox').classList.remove('on'); };
  setInterval(function () {
    if (!tracker.list().some(function (t) { return t.status !== 'confirmed'; })) return;
    var was = {}; tracker.list().forEach(function (t) { was[t.txid] = t.status; });
    tracker.poll(function (id) { return chain.txStatus(id); }).then(function (n) {
      tracker.list().forEach(function (t) { if (t.status === 'confirmed' && was[t.txid] !== 'confirmed') { toast('✅ Confirmed: ' + esc(t.label) + ' (block ' + t.block + ')');
        if (/^pet:evolve/.test(t.tag) && state) { var p = state.pets.filter(function (x) { return x.id === Number(t.tag.split(':')[2]); })[0]; if (p && p.art) Sfx.evolve(p.art.species); } } });
      renderPending(); if (n) { load(); balance(); } });
  }, 30000);

  /** Five base stats from pet-core (no bonus) as pixel bars + total; power = pet-core stats at the current stage/care. */
  function statBars(p) {
    if (!p.art) return '<p class="small muted">Stats appear once its block is known.</p>';
    var b = p.art.baseStats, MAX = 31, tot = 0, pw = PetCore.stats(p.art, p.stage, p.care).power;
    return PetCore.STAT_KEYS.map(function (k) { tot += b[k]; return '<div class="stat"><span class="sk">' + k.toUpperCase() + '</span><span class="sbar"><i style="width:' + Math.min(100, 100 * b[k] / MAX).toFixed(0) + '%"></i></span><b>' + b[k] + '</b></div>'; }).join('') +
      '<div class="stat tot"><span class="sk">TOTAL</span><b>' + tot + '</b> · <span class="sk">POWER</span><b>' + pw + '</b></div>';
  }
  function detail(p) {
    $('detail').classList.add('on'); $('dTitle').textContent = '#' + p.id + ' ' + (p.name || (p.art ? p.art.defaultName || speciesLabel(p.art.species) : ''));
    $('dCanvas').classList.toggle('dead-sprite', !!p.dead); if (p.art) show($('dCanvas'), petFrames(p)); var gearOff = !!p.dead, GEAR = { roll: 1, tokenRoll: 1, key: 1 };
    $('dStats').innerHTML = statBars(p) + (window.XcpetsDetails && p.art ? XcpetsDetails.html(PetCore, p) : ''); window.XcpetsToast = function (m) { toast(esc(m)); };
    $('dInfo').innerHTML = '<p>' + p.stageName + ' · care ' + fmt(p.care) + ' · ' + fedLabel(p) + ' · streak ' + p.streak + '</p><p class="small">🎟️ Roll tokens and 🔑 slot keys need no burn: each token turns into gear by itself (fixed by the burn that earned it) and lands in your gear, and each key opens the next bonus slot by itself.</p>' + (p.dead ? '<p class="deathnote">' + esc(deathNote(p)) + '</p>' : '') +
      '<div class="row" style="justify-content:center;align-items:center;gap:8px"><span class="small">Open slots: ' + esc(p.openSlots.join(', ') || 'none') + '</span><select id="dSlot" class="pick"><option value="">random open slot</option>' + p.openSlots.map(function (s) { return '<option>' + s + '</option>'; }).join('') + '</select></div><div class="acts">' +
      [['feedPet', '🍖 Feed', p.nextMeal], ['roll', '⚔️ Gear roll', C.roll]]
        .map(function (b) { return '<button class="act" data-a="' + b[0] + '"' + (gearOff ? ' disabled' : '') + ' title="Burn ' + fmt(b[2]) + ' ' + esc(CFG.asset) + '">' + b[1] + ' <small>' + fmt(b[2]) + '</small></button>'; }).join('') +
      '<button class="act ghost" id="dDiscard" title="Hides it in this browser. Free; restore any time from Show discarded.">🗑️ Discard pet</button></div><span class="risk-short">⚠️ Experimental. Burns are final. Use at your own risk.</span><p><a href="pet.html?id=' + p.id + '">Pet page</a></p>';
    if (p.art && window.XcpetsShare) $('dInfo').appendChild(XcpetsShare.bar(p, petFrames(p)));
    Array.prototype.forEach.call($('dInfo').querySelectorAll('button[data-a]'), function (b) { b.onclick = function () { burn(b.getAttribute('data-a'), { pet: p, slot: $('dSlot').value || null }, b); }; });
    if (p.art && !p.dead && window.GearUI) $('dStats').appendChild(gearArea(p));
  }
  document.addEventListener('click', function (e) { if (e.target && e.target.id === 'dDiscard') { var id = Number(($('dTitle').textContent.match(/#(\d+)/) || [])[1]); if (id) { $('detail').classList.remove('on'); discardIds([id], e.target); } } });
  $('dClose').onclick = function () { $('detail').classList.remove('on'); };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { $('detail').classList.remove('on'); closeItem(); $('txBox').classList.remove('on'); $('packBox').classList.remove('on'); } });

  // ---------------- burns ----------------
  /* Lowest fee that still confirms within ~1 h: mempool.space hourFee (economyFee can sit for hours); floor 1 sat/vB; 2 if the fetch fails. */
  function feeRate() {
    return fetch(CFG.mempoolApi + '/v1/fees/recommended').then(function (r) { return r.json(); })
      .then(function (f) { var x = Math.ceil(Number(f.hourFee)); return x >= 1 ? x : 1; }).catch(function () { return 2; });
  }
  function compose(plan) {
    return feeRate().then(function (fee) { return composeAt(plan, fee, compose.onTry).then(function (res) { res._fee = fee; return res; }); });
  }
  /* Compose on an ordered list of full Counterparty nodes (api.xcp.fun/node is read-only), 12 s timeout each, next node on
     timeout / network / 5xx error. A node's own rejection (bad balance, no BTC) is final and shown in plain words. */
  var COMPOSE_MS = 12000;
  function composeNodes() { return (CFG.composeList && CFG.composeList.length ? CFG.composeList : [CFG.compose]).filter(function (u) { return !/xcp\.fun/.test(u); }); }
  function composeAt(plan, fee, onTry) {
    var raw = BurnCore.toRaw(plan.amount), exp = { address: me, quantityRaw: raw, tag: plan.tag }, urls = composeNodes(), errs = [];
    function call(i, unconf) {
      var url = BurnCore.composeUrl(urls[i], me, { asset: CFG.asset, quantityRaw: raw, tag: plan.tag, satPerVbyte: fee }) + (unconf ? '&allow_unconfirmed_inputs=true' : '');
      var ac = window.AbortController ? new AbortController() : null, t = ac && setTimeout(function () { ac.abort(); }, COMPOSE_MS);
      return fetch(url, ac ? { signal: ac.signal } : {}).then(function (r) { if (t) clearTimeout(t); if (r.status >= 500) { var e5 = new Error('node error HTTP ' + r.status); e5.retryable = true; throw e5; } return r.json(); }, function (e) {
        if (t) clearTimeout(t); var e2 = new Error(e && e.name === 'AbortError' ? 'timed out after ' + COMPOSE_MS / 1000 + ' s' : 'unreachable'); e2.retryable = true; throw e2; })
        .then(function (j) {
          if (j.error) { var e3 = new Error(typeof j.error === 'string' ? j.error : JSON.stringify(j.error)); e3.retryable = /unsupported node operation|not ready|unavailable/i.test(e3.message); throw e3; }
          var chk = BurnCore.checkComposeResult(j.result, exp); if (!chk.ok) { var e4 = new Error('compose mismatch: ' + chk.problems.join(', ')); e4.retryable = true; throw e4; }
          return j.result;
        });
    }
    function go(i) {
      if (i >= urls.length) { var all = new Error('Could not build your burn: every Counterparty node failed (' + errs.join('; ') + ').'); all.retry = true; return Promise.reject(all); }
      if (onTry) onTry(i + 1, urls.length);
      return call(i, false).catch(function (e) {
        if (!e.retryable && /utxo|insufficient.*btc|not enough|no .*inputs|unconfirmed/i.test(e.message)) return call(i, true).catch(function (e2) { throw friendly(e2); });
        if (e.retryable) { errs.push('node ' + (i + 1) + ': ' + e.message); return go(i + 1); }
        throw friendly(e);
      });
    }
    function friendly(e) {
      var m = e.message;
      if (/utxo|insufficient.*btc|not enough|inputs/i.test(m)) m = 'Not enough spendable BTC to pay the network fee (or your last burn is still unconfirmed). Wait for it to confirm or add a little BTC. Node said: ' + e.message;
      else if (/balance|insufficient/i.test(m)) m = 'Not enough XCPETS for this burn. Node said: ' + e.message;
      return new Error(m);
    }
    return go(0);
  }
  function confirmBurn(plan, res) {
    var sats = res && (res.btc_fee != null ? Number(res.btc_fee) : null);
    return new Promise(function (resolve) {
      var evo = '';
      var rel = ''; // discard never burns now (local hide only)
      var pack = plan.eggs > 1 ? '<p>🥚 <b>' + plan.eggs + ' eggs</b> in ONE burn (' + fmt(plan.amount / plan.eggs) + ' each) · you save <b>' + fmt(plan.eggs * C.hatch - plan.amount) + ' ' + esc(CFG.asset) + '</b> vs ' + plan.eggs + ' single hatches (' + fmt(plan.eggs * C.hatch) + '), and pay one Bitcoin fee instead of ' + plan.eggs + '.</p>' : '';
      $('cfBody').innerHTML = '<p><b>' + esc(plan.label) + '</b></p><p class="bigamt">🔥 ' + fmt(plan.amount) + ' ' + esc(CFG.asset) + '</p>' + evo + rel + pack + '<p class="small">Tag <code>' + esc(plan.tag) + '</code> · ' + esc(CFG.label || NET) +
        ' · from <code>' + esc(short(me)) + '</code></p><p class="small">Bitcoin network fee: <b>' + (sats != null ? fmt(sats) + ' sats' : 'shown in XCP Wallet') + '</b> at ' + res._fee + ' sat/vB (lowest rate that should confirm within about an hour)</p><p class="small muted">Next, XCP Wallet shows the transaction for your final approval.</p>';
      $('confirmBox').classList.add('on');
      $('cfYes').onclick = function () { $('confirmBox').classList.remove('on'); resolve(true); };
      $('cfNo').onclick = function () { $('confirmBox').classList.remove('on'); resolve(false); };
    });
  }
  function burnPlan(plan, btn, after) { return burn(null, null, btn, plan, after); }
  function burn(kind, o, btn, ready, after) {
    if (btn) { if (btn.classList.contains('busy')) return; btn.classList.add('busy'); }
    function done() { if (btn) btn.classList.remove('busy'); waitClose(); }
    if ($('app').style.display !== 'block') { toast('The game is closed until launch (owner login below).'); done(); return; }
    var plan = ready || RealCore.actionPlan(kind, o || {});
    if (!plan.ok) { toast('<span class="warn">' + esc(plan.error) + '</span>'); done(); return; }
    var tok;
    getWallet().then(function (w) {
      setMe(w.address);
      var prog = document.createElement('div'); prog.className = 'toast'; prog.setAttribute('role', 'status'); $('toasts').appendChild(prog);
      compose.onTry = function (n, of) { prog.innerHTML = '<span class="spin"></span> Building your burn… ' + (n > 1 ? 'trying node ' + n + '/' + of : 'node ' + n + '/' + of); };
      var dropProg = function () { prog.remove(); };
      return compose(plan).then(function (res) { dropProg(); return res; }, function (e) { dropProg(); throw e; }).then(function (res) { return confirmBurn(plan, res).then(function (yes) {
        if (!yes) { toast('Cancelled. Nothing was burned.'); after = null; return; }
        tok = waitOpen(); return w.signAndBroadcast(res).then(function (r) {
          tracker.add({ txid: r.txid, tag: plan.tag, amount: plan.amount, label: plan.label, eggs: plan.eggs, at: Date.now(), status: 'sent' }); renderPending();
          if (tok === waitToken) { toast('⏳ Broadcast: <a href="#" class="txrow" data-tx="' + esc(r.txid) + '">' + esc(plan.label) + ' · ' + esc(r.txid.slice(0, 6)) + '… (details)</a> · <a target="_blank" rel="noopener" href="' + CFG.mempool + '/tx/' + encodeURIComponent(r.txid) + '">mempool ↗</a>. Updates after it confirms.', 12000); bindTxRows($('toasts')); }
        });
      }); });
    }).catch(function (e) { after = null; var et = stickyErr(errHtml(e)); // stays until dismissed with ✕ (like the Delete all Commons error)
      var rb = document.createElement('button'); rb.className = 'btn retrybtn'; rb.type = 'button'; rb.textContent = 'Retry'; et.insertBefore(rb, et.querySelector('.errclose'));
      rb.onclick = function () { et.remove(); burn(kind, o, null, ready, null); }; }).then(function () { done(); if (after) after(); });
  }
  $('hatchBtn').onclick = function () { burn('hatch', {}, $('hatchBtn')); };
  $('dozenBtn').onclick = function () { burn('hatch12', {}, $('dozenBtn')); };
  $('caseBtn').onclick = function () { burn('hatch144', {}, $('caseBtn')); };
  $('cfeedBtn').onclick = function () { burn('feed', {}, $('cfeedBtn')); };
  $('crollBtn').onclick = function () { burn('croll', {}, $('crollBtn')); };
  $('reload').onclick = function () { load(); balance(); loadMempool(); };
  setInterval(loadMempool, 60000);

  function intro() {
    var art = PetCore.generate({ blockHash: PetCore.sha256Hex('xcpets-intro-block'), petId: PetCore.sha256Hex('xcpets-intro-tx') }), steps = [
      [0, '🥚 Burn ' + fmt(C.hatch) + ' XCPETS to hatch: the block hash picks your pet'], [1, '🍖 Feed it once a day (one burn, one big meal)'],
      [3, '⚔️ Burn to roll gear for its slots'], [5, '✨ Raise it to Mythic. Every burn also grows the community pet']];
    var i = 0, cv = $('introCv').getContext('2d'), timer, frameT;
    $('intro').classList.add('on');
    function stop() { clearTimeout(timer); clearInterval(frameT); $('intro').classList.remove('on'); localStorage.setItem('xcpets-intro-seen', '1'); }
    function step() { if (i >= steps.length) return stop(); var s = steps[i++], fr = PetCore.renderFrames(art, { stage: s[0] }), f = 0;
      clearInterval(frameT); paint(cv, fr[0]); frameT = setInterval(function () { f = (f + 1) % fr.length; paint(cv, fr[f]); }, 250);
      $('introText').textContent = s[1]; timer = setTimeout(step, 2300); }
    $('introSkip').onclick = stop; step();
  }
  $('replayIntro').onclick = function (e) { e.preventDefault(); intro(); };
  (function () { var a = localStorage.getItem(ADDR_KEY); if (a && BurnCore.isAddress(a)) setMe(a); })();
  var gs0 = Gate.sessionOk(NET, { origin: location.origin }); if (gs0.ok) unlock(gs0.reason);
  else Promise.all([chain.destructions(CFG.asset), chain.tip().catch(function () { return null; })]).then(function (r) { state = RealCore.replay(r[0], {}, { tip: r[1] }); counter(); state = null; })
    .catch(function () { $('cBurned').textContent = '?'; });
  window.XcpetsGame = { openTx: openTx, loadMempool: loadMempool, disconnect: disconnect, showPack: showPack, balanceOf: balanceOf, burn: burn, compose: compose, waitForXcp: waitForXcp };
})();
