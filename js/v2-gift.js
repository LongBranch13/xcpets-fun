/* XCPETS pet gifting + swaps (pet-gift preview, Phase 1, design/pet-market.md §1). UI only: every action is a burn the player signs in their own
 * XCP Wallet through play.html's confirmPlans (one wallet window at a time, Stop + Resume); this file never signs or sends anything.
 * pet.html: 🎁 Gift (own pet) / 🔁 Offer swap (someone else's pet). play.html: 🎁 Gift several (batch picker on My Pets), gift inbox (toast, card,
 * one-time auto-star), swap inbox (Accept / Decline / Cancel), "Your player #". Everything stays hidden until V2Rules.giveOn(tip + 1).
 * The Gift Wrap counter comes later with the shop scene; for now gifting lives here. */
(function () {
  'use strict';
  var V = window.V2Rules, M = window.V2Mock; if (!V || !V.giveOn || !M) return;
  var $ = function (id) { return document.getElementById(id); }, ME = M.ME;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  var TL = V.TIER_LABELS || ['Common', 'Uncommon', 'Rare', 'Legendary'], TID = ['common', 'uncommon', 'rare', 'legendary'];
  var NET = (window.LiveEngine && LiveEngine.CFG && LiveEngine.CFG.network) || (M.prod ? 'mainnet' : 'v2demo'), PAGE = /pet\.html/.test(location.pathname) ? 'pet' : 'play';
  function W() { try { return M.world(); } catch (e) { return null; } }
  function tip() { var w = W(); return (w && w.tip) || (M.state && M.state().tip) || 0; }
  function on() { return V.giveOn(tip() + 1); }
  function keepKey() { return 'xcpets-keep-' + NET + '-' + (ME || ''); }
  function keptIds() { try { return JSON.parse(localStorage.getItem(keepKey()) || '[]'); } catch (e) { return []; } }
  function myth(p) { return !!p.mythicCare || p.stage >= 5; }
  function tierName(p) { return myth(p) ? 'Mythic' : TL[p.tier] || ''; }
  function pill(p) { return '<span class="pill tier tier-' + (myth(p) ? 'legendary' : TID[p.tier]) + '">' + esc(tierName(p)) + '</span>' + omB(p); }
  /* pet-shop-sales: Old Money collector badge (display only) + the shared filter drawer (js/v2-pet-filter.js) replace the old inline species/tier/stage selects */
  var PF = window.V2PetFilter; function omB(p) { return PF ? ' ' + PF.badge(p) : ''; }
  var GF_FIELDS = ['sp', 'tier', 'st', 'badge'];
  function spL(p) { try { return V.speciesLabel(p.species); } catch (e) { return p.species; } }
  function sprite(p) { return '<span class="gf-sp" data-gfsp="' + p.id + '"></span>'; }
  function paint(root) { var R = window.V2Render, w = W(); if (!R || !R.petFrames || !w) return; root.querySelectorAll('[data-gfsp]').forEach(function (s) { if (s.firstChild) return; var p = w.byId[s.getAttribute('data-gfsp')]; if (!p) return;
      var c = document.createElement('canvas'); c.width = c.height = 32; c.className = 'sprite'; s.appendChild(c); try { var fr = R.petFrames(p, w); if (R.lazy) R.lazy(c, function () { return fr; }, true); else if (R.animate) R.animate(c, fr); } catch (e) { } }); }
  function css() { if ($('gfCss')) return; var st = document.createElement('style'); st.id = 'gfCss'; st.textContent =
    '.gf .box{max-width:560px;width:calc(100vw - 24px);max-height:88vh;overflow:auto;text-align:left}.gf h2{margin:0 0 8px}.gf .addr{word-break:break-all;font-family:monospace;font-size:13px;background:rgba(0,0,0,.25);padding:6px 8px;border-radius:6px}' +
    '.gf input[type=text]{width:100%;box-sizing:border-box;padding:10px;font:inherit;font-size:16px}.gf .gf-pets{display:grid;gap:6px;margin:8px 0}.gf .gf-pet{display:flex;gap:8px;align-items:center;padding:6px;border:2px solid rgba(255,255,255,.12);border-radius:8px}' +
    '.gf .gf-pet small{display:block;opacity:.8}.gf .gf-sp canvas{width:40px;height:40px;image-rendering:pixelated}.gf .gf-two{display:grid;grid-template-columns:1fr auto 1fr;gap:6px;align-items:center;text-align:center}.gf .gf-two .gf-pet{flex-direction:column}' +
    '.gf .gf-bar{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;position:sticky;bottom:-1px;padding:8px 0 2px;margin-top:10px;background:#16241a;box-shadow:0 -6px 8px #16241a}.gf .warn{color:#ffb347}.gf .gf-skip{opacity:.55}.gf .gf-filters{display:flex;gap:6px;flex-wrap:wrap}.gf select{font:inherit;padding:6px}' +
    '.gf-inbox{margin:8px 0;padding:10px;border:3px solid #ffc93c;border-radius:10px;background:rgba(255,201,60,.08)}.gf-inbox .btn,.gf-inbox .q{margin:4px 4px 0 0}.gf-me{font-size:13px;opacity:.85}';
    document.head.appendChild(st); }
  function modal(html) { css(); var m = $('gfBox'); if (!m) { m = document.createElement('div'); m.id = 'gfBox'; m.className = 'reveal gf'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); document.body.appendChild(m);
      m.addEventListener('click', function (e) { if (e.target === m) close(); }); document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); }); }
    m.innerHTML = '<div class="box">' + html + '</div>'; m.classList.add('on'); paint(m); return m; }
  function close() { var m = $('gfBox'); if (m) m.classList.remove('on'); }
  function resolve(w, s) { s = String(s || '').trim(); if (!s) return null; var n = /^(bc1|[13])[0-9a-zA-Z]{20,}$/.test(s) ? V.playerNo(w, s) : V.parsePlayer(s), a = n ? V.playerAddr(w, n) : null;
    if (/^(bc1|[13])/.test(s) && !n) return { err: 'This wallet has no player # yet. Ask them to tap "Get my player #" (a 1-dander pet:hi burn) first.' };
    return a ? { n: n, a: a } : { err: 'No player #' + esc(s.toUpperCase().replace(/^P?#?/, '')) + ' yet.' }; }
  function movesHtml(w, p) { var mv = V.giftMoves(w, p), g = mv.worn.map(function (x) { return x.label + ' (worn)'; }).concat(mv.bag.map(function (x) { return x.label + ' (bag)'; }));
    return g.length ? g.map(esc).join(', ') : 'no gear'; }
  function petRow(w, p, why) { return '<div class="gf-pet' + (why ? ' gf-skip' : '') + '">' + sprite(p) + '<div><b>' + esc(p.name || spL(p)) + '</b> <span class="muted">#' + p.id + '</span> ' + pill(p) +
    '<small>' + esc(spL(p)) + ' · ' + esc(V.STAGE_NAMES ? V.STAGE_NAMES[p.stage] : 'stage ' + p.stage) + '</small><small>Moves with it: ' + movesHtml(w, p) + '</small>' + (why ? '<small class="warn">Skipped: ' + esc(why) + '</small>' : '') + '</div></div>'; }
  var STAYS = 'Stays with you: your gear stash, saved spins, tokens, badges, dander balance and history.';
  function meLine(w) { if (V.tokenOnly && V.tokenOnly()) return ''; var n = ME && V.playerNo(w, ME); return '<p class="gf-me">Your player #: <b>' + (n ? V.playerCode(n) : 'none yet') + '</b></p>'; }
  /* ---- gift flow (Spam City, token is the pet): pick pet(s) -> one field "Recipient Bitcoin address" -> Send.
   * Pets with a token you hold: one Counterparty send (several = one MPMA send, up to BUNDLE tokens per transaction).
   * Pets without a token: made automatically first (window per token), then after 1 block the tie burn(s) and the send. Nothing signs here:
   * every window is XCP Wallet (js/v2-wallet.js sendDex / send), one at a time, after the press. */
  var BUNDLE = 10, API = 'https://api.xcp.fun/node/v2', GPK = 'xcpets-gift-pending';
  function validAddr(a) { var Wl = window.V2Wallet; return Wl && Wl.validAddr ? Wl.validAddr(a) : /^(bc1[qp][02-9ac-hj-np-z]{38,58}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/.test(String(a || '')); }
  function gpend(v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(GPK) || 'null'); if (v) localStorage.setItem(GPK, JSON.stringify(v)); else localStorage.removeItem(GPK); } catch (e) { } return null; }
  function freeDeed(n) { n = n || 0; var b = new Uint8Array(8); crypto.getRandomValues(b); var A = V.randomDeed(b);
    return fetch(API + '/assets/' + A).then(function (r) { if (r.status === 404) return A; if (n >= 5) throw new Error('could not find a free token name'); return freeDeed(n + 1); }); }
  function issued(A) { return fetch(API + '/assets/' + A + '/balances').then(function (r) { return r.ok ? r.json() : { result: [] }; }).then(function (j) { var h = (j.result || []).filter(function (x) { return Number(x.quantity) > 0; })[0]; return h ? h.address : null; }, function () { return null; }); }
  /* token-press (owner Oct 24 2026): only tokenized (tied) pets can be gifted; the gift never makes tokens. Untied pets go to the Token Press (shop.html). */
  var NOTOK = 'no token yet: make one at the Token Press (shop.html)';
  function tied(w, p) { var d = V.deedOf(w, p); return !!(d && d.ok && d.holder === ME); }
  function lockOf(w, p, b) { return V.giveLocks(w, p, b) || (tied(w, p) ? null : NOTOK); }
  function pressNote() { return '<p class="small">🏭 None of your pets has a token yet. Take one to the <a href="shop.html#press">Token Press</a> in Spam City first: making the token is free (only the Bitcoin fee) and the tie is 1 dander.</p>'; }
  function giftWhy(w, p, b) { if (!p || p.owner !== ME || p.dead || p.released || p.community) return 'not your pet'; return lockOf(w, p, b); }
  function giftFlow(ids, pre) { var w = W(); if (!w || !ME) return; var b = tip() + 1, rows = '', ok = [];
    ids.forEach(function (id) { var p = w.byId[id]; if (!p) return; var why = giftWhy(w, p, b); if (!why) ok.push(p); rows += petRow(w, p, why); });
    modal('<h2>🎁 Gift ' + (ok.length === 1 ? 'a pet' : ok.length + ' pets') + '</h2><div class="gf-pets">' + rows + '</div>' +
      '<label for="gfTo">Recipient Bitcoin address</label><input type="text" id="gfTo" autocomplete="off" spellcheck="false" placeholder="bc1… / 1… / 3…" value="' + esc(pre || '') + '"><p class="small warn" id="gfErr" role="alert"></p>' +
      '<p class="small muted">The pet is its token: sending the token sends the pet (worn and bag gear go with it). ' + '' + (V.isBurnAddr ? 'Sending to a burn address is allowed: the pet goes out of play. ' : '') + 'No undo.</p>' +
      '<div class="gf-bar"><button class="q" id="gfX">Cancel</button><button class="btn" id="gfGo"' + (ok.length ? '' : ' disabled') + '>🎁 Send</button></div>');
    $('gfX').onclick = close; $('gfTo').focus();
    $('gfGo').onclick = function () { var to = $('gfTo').value.trim();
      if (!validAddr(to)) { $('gfErr').textContent = 'Enter a Bitcoin address that starts with bc1, 1 or 3.'; return; }
      if (to === ME) { $('gfErr').textContent = 'That is your own address.'; return; }
      var job = { to: to, ids: ok.map(function (p) { return p.id; }), mint: {}, tied: {} };
      /* Spam City rules (owner, Oct 23 2026): a burn address is allowed (warn, never block); a pet whose token already moves in an unconfirmed tx is warned
       * (only the first move of a pet in a block counts). */
      var burnTo = V.isBurnAddr && V.isBurnAddr(to), $go = $('gfGo'); $go.disabled = true; $('gfErr').textContent = 'Checking for unconfirmed moves…';
      pendingMoves(ok.map(function (p) { var d = V.deedOf(w, p); return d && d.asset; }).filter(Boolean)).then(function (busy) { $go.disabled = false; $('gfErr').textContent = '';
        var warn = (burnTo ? '<p class="warn">🔥 <b>' + esc(to) + '</b> is a burn address. Nobody can use pets sent there: ' + (ok.length === 1 ? 'the pet goes' : 'the pets go') + ' out of play for good and the site shows ' + (ok.length === 1 ? 'it' : 'them') + ' as sent to a burn address.</p>' : '') +
          (busy.length ? '<p class="warn">⏳ ' + busy.map(function (A) { var p = ok.filter(function (q) { var d = V.deedOf(w, q); return d && d.asset === A; })[0]; return p ? '#' + p.id : A; }).join(', ') + ' already ' + (busy.length === 1 ? 'has' : 'have') + ' an unconfirmed token move. Only the first move of a pet in a block counts: a second one in the same block is ignored. Wait for the next block to be safe.</p>' : '');
        if (!warn) return run(job);
        modal('<h2>🎁 Check before sending</h2>' + warn + '<div class="gf-bar"><button class="q" id="gfBack">Back</button><button class="btn" id="gfAny">' + (busy.length ? 'Send anyway' : 'Yes, send to the burn address') + '</button></div>');
        $('gfBack').onclick = function () { giftFlow(ids, to); }; $('gfAny').onclick = function () { run(job); }; }); }; }
  /** pendingMoves(assets) -> the assets with an unconfirmed debit (send, MPMA, order) in the node mempool; [] when the mempool can't be read. */
  function pendingMoves(assets) { if (!assets.length) return Promise.resolve([]);
    return fetch(API + '/mempool/events/DEBIT?limit=1000').then(function (r) { return r.ok ? r.json() : { result: [] }; }).then(function (j) { var seen = {};
      ((j && j.result) || []).forEach(function (e) { var x = e.params || {}; if (assets.indexOf(x.asset) >= 0) seen[x.asset] = 1; }); return Object.keys(seen); }, function () { return []; }); }
  /* run(job): resumable; job.mint[id] = asset (window sent), job.tied[id] = 1 */
  function run(job) { var w = W(), Wl = window.V2Wallet; if (!w || !Wl) return; gpend(job);
    var need = job.ids.filter(function (id) { var p = w.byId[id], d = V.deedOf(w, p); return p && !(d && d.ok && d.holder === ME) && !job.tied[id]; });
    var noTok = need.filter(function (id) { return !job.mint[id]; });
    function msg(h) { modal('<h2>🎁 Gift</h2>' + h + '<div class="gf-bar"><button class="q" id="gfX">Close</button></div>'); $('gfX').onclick = close; }
    function fail(e) { msg('<p class="warn">Not sent: ' + esc(e && e.message || e) + '</p><p><button class="btn" id="gfRe">Try again</button></p>'); $('gfRe').onclick = function () { run(job); }; }
    if (noTok.length) { gpend(null); msg('<p class="warn">#' + noTok.join(', #') + (noTok.length === 1 ? ' has' : ' have') + ' no token yet, so nothing was sent.</p><p>Gifts only send pets that already have their token. Take ' + (noTok.length === 1 ? 'it' : 'them') + ' to the <a href="shop.html#press">Token Press</a> first.</p>'); return; } /* token-press: no automatic minting (an unfinished gift that already made its tokens still continues below) */
    if (need.length) { var waitIds = need.filter(function (id) { return job.mint[id]; });
      return Promise.all(waitIds.map(function (id) { return issued(job.mint[id]); })).then(function (h) {
        if (h.some(function (x) { return x !== ME; })) { msg('<p>Token' + (waitIds.length === 1 ? '' : 's') + ' sent. Waiting for 1 block to confirm… this window continues by itself (keep it open).</p>'); var t = setTimeout(function () { run(job); }, 30000); $('gfX').onclick = function () { clearTimeout(t); close(); }; return; }
        if (V.mintTiesOn ? V.mintTiesOn(tip() + 1) : V.rulesOn && V.rulesOn(tip() + 1)) { waitIds.forEach(function (id) { job.tied[id] = 1; }); gpend(job); return run(job); } /* rule 3: the confirmed mint is the tie */
        var id2 = waitIds[0], plan = V.deedPlan(id2, job.mint[id2]); msg('<p>Tying the token to #' + id2 + '…</p>');
        return Wl.send(plan, ME).then(function () { job.tied[id2] = 1; run(job); }); }).catch(fail); }
    /* all tokens held: send them, BUNDLE per transaction */
    var assets = job.ids.map(function (id) { var d = V.deedOf(w, w.byId[id]); return job.mint[id] || (d && d.asset); }).filter(Boolean), done = job.sent || 0;
    if (done >= assets.length) { gpend(null); msg('<p>🎁 Sent! The pet' + (assets.length === 1 ? '' : 's') + ' move' + (assets.length === 1 ? 's' : '') + ' to ' + esc(job.to.slice(0, 12)) + '… when the send confirms.</p>'); return; }
    var chunk = assets.slice(done, done + BUNDLE), plan = chunk.length === 1 ? { kind: 'send', asset: chunk[0], destination: job.to, label: 'Gift token ' + chunk[0] } : { kind: 'mpma', assets: chunk, destination: job.to, label: 'Gift ' + chunk.length + ' pet tokens' };
    msg('<p>Sending ' + (chunk.length === 1 ? 'the pet token' : chunk.length + ' pet tokens in one send') + (assets.length > BUNDLE ? ' (' + (done + chunk.length) + ' of ' + assets.length + ')' : '') + '…</p>');
    return Wl.sendDex(plan, ME).then(function () { job.sent = done + chunk.length; run(job); }).catch(fail); }
  function resume() { var j = gpend(); if (!j || !j.to || !ME) return; modal('<h2>🎁 Unfinished gift</h2><p>' + j.ids.length + ' pet' + (j.ids.length === 1 ? '' : 's') + ' to ' + esc(j.to) + '.</p><div class="gf-bar"><button class="q" id="gfDrop">Forget it</button><button class="btn" id="gfCont">Continue</button></div>');
    $('gfDrop').onclick = function () { gpend(null); close(); }; $('gfCont').onclick = function () { run(j); }; }
  function toast2(h) { var t = $('toasts'); if (!t) { alert(h.replace(/<[^>]+>/g, '')); return; } var d = document.createElement('div'); d.className = 'toast'; d.innerHTML = h; t.appendChild(d); setTimeout(function () { d.remove(); }, 6000); }
  var TOK = !!(V.tokenOnly && V.tokenOnly());
  /* ---- batch picker (play.html My Pets) */
  function picker() { var w = W(); if (!w || !ME) return; var b = tip() + 1, mine = w.pets.filter(function (p) { return p.owner === ME && !p.dead && !p.released && !p.community; }), sel = {}, f = PF ? PF.load('gift') : {};
    function opts(list, cur) { return '<option value="">All</option>' + list.map(function (x) { return '<option value="' + esc(x[0]) + '"' + (String(cur) === String(x[0]) ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join(''); }
    var sps = {}; mine.forEach(function (p) { sps[p.species] = spL(p); });
    function shown() { return V.petFilter(w, mine.map(function (p) { return { p: p }; }), f, b).map(function (x) { return x.p; }); }
    function draw() { var S = shown(), n = Object.keys(sel).length;
      modal('<h2>🎁 Gift several pets</h2>' + meLine(w) + (PF ? PF.html(f, GF_FIELDS, { species: PF.species(mine), count: S.length, total: mine.length }) : '') +
        (mine.some(function (p) { return tied(w, p); }) ? '' : pressNote()) + '<p><button class="q" id="gfAll">Select all shown (' + S.length + ')</button> <button class="q" id="gfNone">Clear</button> <b>' + n + ' selected</b></p><div class="gf-pets">' +
        S.slice(0, 300).map(function (p) { var why = lockOf(w, p, b); return '<label class="gf-pet' + (why ? ' gf-skip' : '') + '"><input type="checkbox" data-gfid="' + p.id + '"' + (sel[p.id] ? ' checked' : '') + (why ? ' disabled' : '') + '>' + sprite(p) +
          '<div><b>' + esc(p.name || spL(p)) + '</b> <span class="muted">#' + p.id + '</span> ' + pill(p) + '<small>' + esc(spL(p)) + (why ? ' · <span class="warn">' + esc(why) + '</span>' : '') + '</small></div></label>'; }).join('') + (S.length > 300 ? '<p class="small muted">Showing 300 of ' + S.length + ': narrow the filters.</p>' : '') + '</div>' +
        '<div class="gf-bar"><button class="q" id="gfX">Cancel</button><button class="btn" id="gfNext"' + (n ? '' : ' disabled') + '>Next: recipient →</button></div>');
      if (PF) PF.bind($('gfBox'), f, 'gift', draw);
      $('gfAll').onclick = function () { S.forEach(function (p) { if (!lockOf(w, p, b)) sel[p.id] = 1; }); draw(); }; $('gfNone').onclick = function () { sel = {}; draw(); }; $('gfX').onclick = close;
      $('gfBox').querySelectorAll('[data-gfid]').forEach(function (c) { c.onchange = function () { if (c.checked) sel[c.getAttribute('data-gfid')] = 1; else delete sel[c.getAttribute('data-gfid')]; draw(); }; });
      $('gfNext').onclick = function () { giftFlow(Object.keys(sel).map(Number)); }; }
    draw(); }
  /* ---- swap offer (pet.html, someone else's pet) */
  function swapFlow(theirId) { if (TOK) { modal('<h2>🔁 Swap pets</h2><p>Pets are their tokens now. Two ways to swap #' + esc(theirId) + ':</p><ol><li>Each of you gifts your pet to the other (two token sends, 🎁 Gift).</li><li>Or a DEX order that gives your pet token and gets theirs (token for token, settles on its own).</li></ol><div class="gf-bar"><button class="q" id="gfX">Close</button></div>'); $('gfX').onclick = close; return; } var w = W(), T = w && w.byId[theirId]; if (!T || !ME) return; var b = tip() + 1, kept = keptIds();
    var all = w.pets.filter(function (p) { return p.owner === ME && !p.dead && !p.released && !p.community && !V.giveLocks(w, p, b); }), f = PF ? PF.load('swap') : {}, pick = null, mine;
    function draw() { mine = V.petFilter(w, all.map(function (p) { return { p: p }; }), f, b).map(function (x) { return x.p; });
    modal('<h2>🔁 Offer a swap</h2><p class="small">Pick one of your pets to offer for <b>#' + T.id + '</b>. The owner has ' + V.SWAP_WINDOW + ' blocks (about a week) to accept; you can cancel any time before.</p>' +
      (PF ? PF.html(f, GF_FIELDS, { species: PF.species(all), count: mine.length, total: all.length }) : '') +
      '<label for="gfMine">Your pet</label> <select id="gfMine">' + mine.map(function (p) { return '<option value="' + p.id + '"' + (pick === p.id ? ' selected' : '') + '>#' + p.id + ' ' + esc(p.name || spL(p)) + ' · ' + esc(tierName(p)) + (V.oldMoney && V.oldMoney(p) ? ' · ' + esc(V.OLD_MONEY_LABEL) : '') + '</option>'; }).join('') + '</select><div id="gfTwo"></div>' +
      '<div class="gf-bar"><button class="q" id="gfX">Cancel</button><button class="btn" id="gfGo"' + (mine.length ? '' : ' disabled') + '>🔁 Offer in XCP Wallet</button></div>');
    function two() { var A = w.byId[$('gfMine').value]; $('gfTwo').innerHTML = A ? sideBySide(w, A, T, 'You give', 'You get') + ((myth(A) || kept.indexOf(A.id) >= 0) ? '<p class="warn"><label><input type="checkbox" id="gfSure"> Yes, I really want to offer #' + A.id + (myth(A) ? ' (Mythic)' : ' (starred)') + '</label></p>' : '') : '<p>You have no pet that can be offered right now.</p>'; paint($('gfTwo')); }
    $('gfMine').onchange = function () { pick = Number(this.value); two(); }; two(); $('gfX').onclick = close; if (PF) PF.bind($('gfBox'), f, 'swap', draw);
    $('gfGo').onclick = function () { var A = w.byId[$('gfMine').value]; if (!A) return; if ($('gfSure') && !$('gfSure').checked) { toast2('Tick the box to confirm.'); return; } location.href = 'play.html#swap-' + A.id + '-' + T.id; }; }
    draw(); }
  function sideBySide(w, A, B, la, lb) { return '<div class="gf-two"><div><small>' + la + '</small>' + petRow(w, A) + '</div><b aria-hidden="true">⇄</b><div><small>' + lb + '</small>' + petRow(w, B) + '</div></div><p class="small muted">Worn gear and bag pieces move with each pet. 1 dander per burn.</p>'; }
  /* ---- inbox (play.html): received gifts + swap offers */
  function seenKey() { return 'xcpets-v2-giftSeen-' + NET + '-' + ME; }
  function inbox() { var w = W(); if (!w || !ME || !on()) return; var host = $('cPets'); if (!host) return; css(); var box = $('gfInbox'); if (!box) { box = document.createElement('div'); box.id = 'gfInbox'; box.className = 'gf'; host.parentNode.insertBefore(box, host); }
    var seen = {}; try { seen = JSON.parse(localStorage.getItem(seenKey()) || '{}'); } catch (e) { } var first = !localStorage.getItem(seenKey());
    var got = V.giftsTo(w, ME).filter(function (g) { return !seen[g.tx + ':' + g.petId] && w.byId[g.petId] && w.byId[g.petId].owner === ME; }), b = tip() + 1, h = meLine(w) + ((TOK || V.playerNo(w, ME)) ? '' : '<p><button class="q" id="gfHi">👋 Get my player # (1 dander)</button></p>');
    function bought(g) { return g.sale != null || /order|match|dex/i.test(String(g.how || '')); } /* post-buy-fixes: a DEX buy is not a gift */
    var nBuy = got.filter(bought).length, nGift = got.length - nBuy;
    if (got.length) { var kl = keptIds(); got.forEach(function (g) { if (kl.indexOf(g.petId) < 0) kl.push(g.petId); }); try { localStorage.setItem(keepKey(), JSON.stringify(kl)); } catch (e) { } /* one-time auto-star of each received pet */
      h += '<div class="gf-inbox"><b>' + (nGift ? '🎁 You got ' + (got.length === 1 ? 'a pet' : got.length + ' pets') : '🛒 You bought ' + (got.length === 1 ? 'a pet' : got.length + ' pets')) + '!</b><div class="gf-pets">' + got.map(function (g) { return '<div>' + petRow(w, w.byId[g.petId]) + '<small class="muted">' + (g.swap ? 'swap ' + g.swap + ' from' : bought(g) ? 'bought from' : 'gift from') + ' player #' + V.playerCode(V.playerNo(w, g.from)) + ' · starred ★ for you</small></div>'; }).join('') + '</div><button class="q" id="gfOk">Got it</button></div>';
      /* post-buy-fixes: toast once per gift (notified set kept apart from 'seen', which only fills on Got it) */
      var nk = seenKey() + '-toast', nt = {}; try { nt = JSON.parse(localStorage.getItem(nk) || '{}'); } catch (e) { }
      var fresh = got.filter(function (g) { return !nt[g.tx + ':' + g.petId]; });
      if (!first && fresh.length) { fresh.forEach(function (g) { nt[g.tx + ':' + g.petId] = 1; }); try { localStorage.setItem(nk, JSON.stringify(nt)); } catch (e) { }
        var fb = fresh.filter(bought).length; toast2(fb === fresh.length ? '🛒 ' + (fb === 1 ? 'Your bought pet is' : fb + ' bought pets are') + ' in My Pets.' : '🎁 ' + (fresh.length === 1 ? 'A pet was' : fresh.length + ' pets were') + ' gifted to you! See My Pets.'); } }
    if (first) { var all = {}; V.giftsTo(w, ME).forEach(function (g) { all[g.tx + ':' + g.petId] = 1; }); try { localStorage.setItem(seenKey(), JSON.stringify(all)); } catch (e) { } }
    var sw = TOK ? [] : V.swapsFor(w, ME, b); if (sw.length) h += '<div class="gf-inbox"><b>🔁 Swap offers</b>' + sw.map(function (X) { var A = w.byId[X.mine], B = w.byId[X.theirs], mineOffer = X.from === ME;
      return sideBySide(w, mineOffer ? A : B, mineOffer ? B : A, 'You give', 'You get') + '<p class="small muted">Offer ' + X.n + ' · open until block ' + X.expires + '</p>' + (mineOffer ? '<button class="q" data-gfsw="swapno-' + X.n + '">Cancel offer</button>' :
        (V.swapWhy(w, X, ME, b) ? '<p class="warn small">' + esc(V.swapWhy(w, X, ME, b)) + '</p>' : '<button class="btn" data-gfsw="swapok-' + X.n + '" data-gfsure="' + ((myth(B) || keptIds().indexOf(B.id) >= 0) ? 1 : '') + '">✓ Accept</button>') + '<button class="q" data-gfsw="swapno-' + X.n + '">Decline</button>'); }).join('') + '</div>';
    h += '<p><button class="q" id="gfMany">🎁 Gift several pets</button></p>'; if (box._h === h) { paint(box); return; } box._h = h; box.innerHTML = h; paint(box);
    if ($('gfOk')) $('gfOk').onclick = function () { got.forEach(function (g) { seen[g.tx + ':' + g.petId] = 1; }); try { localStorage.setItem(seenKey(), JSON.stringify(seen)); } catch (e) { } inbox(); };
    if ($('gfHi')) $('gfHi').onclick = function () { if (window.V2HiGo) window.V2HiGo(); };
    $('gfMany').onclick = picker;
    box.querySelectorAll('[data-gfsw]').forEach(function (x) { x.onclick = function () { if (x.getAttribute('data-gfsure') && !confirm('This gives away a Mythic or starred pet of yours. Accept the swap?')) return; if (window.V2SwapGo) window.V2SwapGo(x.getAttribute('data-gfsw')); }; }); }
  /* ---- pet page buttons */
  function petButtons() { var w = W(), m = /id=(\d+)/.exec(location.search), p = w && m && w.byId[m[1]], acts = $('petActs'); if (!p || !on() || $('gfPetBtns')) return; css();
    var host = acts || ($('petMain') || document.querySelector('main')); if (!host) return; var d = document.createElement('span'); d.id = 'gfPetBtns';
    if (ME && p.owner === ME && !p.dead && !p.released && !p.community) { var why = V.giveLocks(w, p, tip() + 1); d.innerHTML = '<button type="button" class="btn ghost" id="gfGift"' + (why ? ' disabled title="' + esc(why) + '"' : '') + '>🎁 Gift</button> '; }
    else if (!TOK && ME && p.owner && p.owner !== ME && !p.dead && !p.released && !p.community) d.innerHTML = '<button type="button" class="btn ghost" id="gfSwap">🔁 Offer swap</button> ';
    if (!d.innerHTML) return; if (acts) acts.insertBefore(d, acts.firstChild); else host.appendChild(d);
    if ($('gfGift')) $('gfGift').onclick = function () { giftFlow([p.id]); }; if ($('gfSwap')) $('gfSwap').onclick = function () { swapFlow(p.id); }; }
  window.V2Gift = { gift: giftFlow, picker: picker, swap: swapFlow, inbox: inbox, resume: resume, _run: run, _validAddr: validAddr };
  var n = 0; setTimeout(function () { if (on()) resume(); }, 4000); (function tick() { n++; if (W() && W().pets && W().pets.length) { if (PAGE === 'pet') petButtons(); else inbox(); } if (n < 600) setTimeout(tick, PAGE === 'pet' && $('gfPetBtns') ? 5000 : 1500); })();
})();
