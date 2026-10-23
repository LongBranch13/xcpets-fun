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
  function meLine(w) { var n = ME && V.playerNo(w, ME); return '<p class="gf-me">Your player #: <b>' + (n ? V.playerCode(n) : 'none yet') + '</b></p>'; }
  /* ---- gift flow (1 pet or many) */
  function giftFlow(ids, pre) { var w = W(); if (!w || !ME) return;
    modal('<h2>🎁 Gift ' + (ids.length === 1 ? 'a pet' : ids.length + ' pets') + '</h2>' + meLine(w) + '<label for="gfTo">Recipient: player # or full address</label><input type="text" id="gfTo" autocomplete="off" spellcheck="false" placeholder="e.g. 1A or bc1q…" value="' + esc(pre || '') + '">' +
      '<p class="small muted">Gifting is free: each burn is 1 dander (1 sat of XCPETS) plus the Bitcoin fee. Pets move for good: there is no undo.</p><p class="small muted">🎀 The Gift Wrap counter opens with the pet shop; for now gifts start here.</p>' +
      '<div class="gf-bar"><button class="q" id="gfX">Cancel</button><button class="btn" id="gfNext">Next →</button></div>');
    $('gfX').onclick = close; $('gfTo').focus(); $('gfNext').onclick = function () { var r = resolve(w, $('gfTo').value); if (!r || r.err) { $('gfTo').setCustomValidity(''); toast2(r ? r.err : 'Enter a player # or address.'); return; } if (r.a === ME) { toast2('That is your own player #.'); return; } summary(ids, r); }; }
  function toast2(h) { var t = $('toasts'); if (!t) { alert(h.replace(/<[^>]+>/g, '')); return; } var d = document.createElement('div'); d.className = 'toast'; d.innerHTML = h; t.appendChild(d); setTimeout(function () { d.remove(); }, 6000); }
  function summary(ids, r) { var w = W(), b = tip() + 1, ok = [], rows = '', kept = keptIds();
    ids.forEach(function (id) { var p = w.byId[id]; if (!p) return; var why = V.giveWhy(w, { petId: id, to: r.n }, ME, b); if (!why) ok.push(p); rows += petRow(w, p, why); });
    var special = ok.filter(function (p) { return myth(p) || kept.indexOf(p.id) >= 0; }), burns = V.giveBatches(ok.map(function (p) { return p.id; }), r.n);
    modal('<h2>🎁 Check the gift</h2><p>To player <b>#' + V.playerCode(r.n) + '</b></p><div class="addr">' + esc(r.a) + '</div>' + '<div class="gf-pets">' + rows + '</div><p class="small muted">' + STAYS + '</p>' +
      '<p class="small">' + ok.length + ' pet' + (ok.length === 1 ? '' : 's') + ' in ' + burns.length + ' burn' + (burns.length === 1 ? '' : 's') + ' of 1 dander each. XCP Wallet opens once per burn, one window at a time; you can stop and resume.</p>' +
      (special.length ? '<p class="warn"><label><input type="checkbox" id="gfSure"> Yes, I really want to give away ' + special.map(function (p) { return '#' + p.id + (myth(p) ? ' (Mythic)' : ' (starred)'); }).join(', ') + '</label></p>' : '') +
      '<div class="gf-bar"><button class="q" id="gfBack">← Back</button><button class="btn" id="gfGo"' + (ok.length ? '' : ' disabled') + '>🎁 Gift in XCP Wallet</button></div>');
    $('gfBack').onclick = function () { giftFlow(ids, String(V.playerCode(r.n))); };
    $('gfGo').onclick = function () { if (special.length && !$('gfSure').checked) { toast2('Tick the box to confirm the Mythic / starred pets.'); return; } close(); var h = 'gift-' + ok.map(function (p) { return p.id; }).join('.') + '-' + V.playerCode(r.n);
      if (PAGE === 'play' && window.V2GiftConfirm) window.V2GiftConfirm(ok.map(function (p) { return p.id; }), r.n); else location.href = 'play.html#' + h; }; }
  /* ---- batch picker (play.html My Pets) */
  function picker() { var w = W(); if (!w || !ME) return; var b = tip() + 1, mine = w.pets.filter(function (p) { return p.owner === ME && !p.dead && !p.released && !p.community; }), sel = {}, f = PF ? PF.load('gift') : {};
    function opts(list, cur) { return '<option value="">All</option>' + list.map(function (x) { return '<option value="' + esc(x[0]) + '"' + (String(cur) === String(x[0]) ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join(''); }
    var sps = {}; mine.forEach(function (p) { sps[p.species] = spL(p); });
    function shown() { return V.petFilter(w, mine.map(function (p) { return { p: p }; }), f, b).map(function (x) { return x.p; }); }
    function draw() { var S = shown(), n = Object.keys(sel).length;
      modal('<h2>🎁 Gift several pets</h2>' + meLine(w) + (PF ? PF.html(f, GF_FIELDS, { species: PF.species(mine), count: S.length, total: mine.length }) : '') +
        '<p><button class="q" id="gfAll">Select all shown (' + S.length + ')</button> <button class="q" id="gfNone">Clear</button> <b>' + n + ' selected</b></p><div class="gf-pets">' +
        S.slice(0, 300).map(function (p) { var why = V.giveLocks(w, p, b); return '<label class="gf-pet' + (why ? ' gf-skip' : '') + '"><input type="checkbox" data-gfid="' + p.id + '"' + (sel[p.id] ? ' checked' : '') + (why ? ' disabled' : '') + '>' + sprite(p) +
          '<div><b>' + esc(p.name || spL(p)) + '</b> <span class="muted">#' + p.id + '</span> ' + pill(p) + '<small>' + esc(spL(p)) + (why ? ' · <span class="warn">' + esc(why) + '</span>' : '') + '</small></div></label>'; }).join('') + (S.length > 300 ? '<p class="small muted">Showing 300 of ' + S.length + ': narrow the filters.</p>' : '') + '</div>' +
        '<div class="gf-bar"><button class="q" id="gfX">Cancel</button><button class="btn" id="gfNext"' + (n ? '' : ' disabled') + '>Next: recipient →</button></div>');
      if (PF) PF.bind($('gfBox'), f, 'gift', draw);
      $('gfAll').onclick = function () { S.forEach(function (p) { if (!V.giveLocks(w, p, b)) sel[p.id] = 1; }); draw(); }; $('gfNone').onclick = function () { sel = {}; draw(); }; $('gfX').onclick = close;
      $('gfBox').querySelectorAll('[data-gfid]').forEach(function (c) { c.onchange = function () { if (c.checked) sel[c.getAttribute('data-gfid')] = 1; else delete sel[c.getAttribute('data-gfid')]; draw(); }; });
      $('gfNext').onclick = function () { giftFlow(Object.keys(sel).map(Number)); }; }
    draw(); }
  /* ---- swap offer (pet.html, someone else's pet) */
  function swapFlow(theirId) { var w = W(), T = w && w.byId[theirId]; if (!T || !ME) return; var b = tip() + 1, kept = keptIds();
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
    var got = V.giftsTo(w, ME).filter(function (g) { return !seen[g.tx + ':' + g.petId] && w.byId[g.petId] && w.byId[g.petId].owner === ME; }), b = tip() + 1, h = meLine(w) + (V.playerNo(w, ME) ? '' : '<p><button class="q" id="gfHi">👋 Get my player # (1 dander)</button></p>');
    if (got.length) { var kl = keptIds(); got.forEach(function (g) { if (kl.indexOf(g.petId) < 0) kl.push(g.petId); }); try { localStorage.setItem(keepKey(), JSON.stringify(kl)); } catch (e) { } /* one-time auto-star of each received pet */
      h += '<div class="gf-inbox"><b>🎁 You got ' + (got.length === 1 ? 'a pet' : got.length + ' pets') + '!</b><div class="gf-pets">' + got.map(function (g) { return '<div>' + petRow(w, w.byId[g.petId]) + '<small class="muted">' + (g.swap ? 'swap ' + g.swap : 'gift') + ' from player #' + V.playerCode(V.playerNo(w, g.from)) + ' · starred ★ for you</small></div>'; }).join('') + '</div><button class="q" id="gfOk">Got it</button></div>';
      if (!first) toast2('🎁 ' + (got.length === 1 ? 'A pet was' : got.length + ' pets were') + ' gifted to you! See My Pets.'); }
    if (first) { var all = {}; V.giftsTo(w, ME).forEach(function (g) { all[g.tx + ':' + g.petId] = 1; }); try { localStorage.setItem(seenKey(), JSON.stringify(all)); } catch (e) { } }
    var sw = V.swapsFor(w, ME, b); if (sw.length) h += '<div class="gf-inbox"><b>🔁 Swap offers</b>' + sw.map(function (X) { var A = w.byId[X.mine], B = w.byId[X.theirs], mineOffer = X.from === ME;
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
    else if (ME && p.owner && p.owner !== ME && !p.dead && !p.released && !p.community) d.innerHTML = '<button type="button" class="btn ghost" id="gfSwap">🔁 Offer swap</button> ';
    if (!d.innerHTML) return; if (acts) acts.insertBefore(d, acts.firstChild); else host.appendChild(d);
    if ($('gfGift')) $('gfGift').onclick = function () { giftFlow([p.id]); }; if ($('gfSwap')) $('gfSwap').onclick = function () { swapFlow(p.id); }; }
  window.V2Gift = { gift: giftFlow, picker: picker, swap: swapFlow, inbox: inbox };
  var n = 0; (function tick() { n++; if (W() && W().pets && W().pets.length) { if (PAGE === 'pet') petButtons(); else inbox(); } if (n < 600) setTimeout(tick, PAGE === 'pet' && $('gfPetBtns') ? 5000 : 1500); })();
})();
