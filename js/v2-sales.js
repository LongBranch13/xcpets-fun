/* pet-shop-sales (branch, 2026-10-22): the Spam City Games shop (shop.html). Paid pet listings settled by the Counterparty DEX, PET TOKENS ONLY.
 *  Each pet sells through its own pet token: a free numeric Counterparty asset (A + 17-20 digits), quantity 1, indivisible, locked,
 *  description 'xcpets pet #ID'. The token's pair (token/XCPETS or token/XCP) is that pet's own order book, so no listing shares a book.
 *  First listing = window 1: make the token (issuance, no XCP fee for numeric assets) -> wait 1 block -> window 2: the 1-dander burn
 *          pet:deed:ID:<asset number base36> that ties the token to the pet -> window 3: the DEX order (give the token, ask the price).
 *  Relist = one window (the order) while the owner still holds the pet's token (the token travels to the buyer with the pet).
 *  Buy   = one matching order (gives the price, gets the token, expires after 1 block).
 *  Cancel= one Counterparty cancel; optional 1-dander pet:unsell:<tx8> ends the listing 6 blocks later without a cancel.
 *  Token held by someone else than the pet owner = no listing until the owner makes a new token (remint).
 * Everything stays "Coming soon" until V2Rules.salesOn(tip + 1). ?salesPreview=1 renders made-up sample data and never opens the wallet.
 * This file never signs: the wallet windows come from js/v2-wallet.js (send / sendDex), one at a time, after the user presses the button. */
(function () {
  var V = window.V2Rules; if (!V || !V.salesGate) return;
  var PREVIEW = /[?&]salesPreview=1/.test(location.search), API = 'https://api.xcp.fun/node/v2', TTL = 60e3, CKEY = 'xcpets-dex-cache';
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  /* ---- DEX reads: cached for TTL, paginated by next_cursor, 429 honours Retry-After (seconds or HTTP date), 4 tries */
  var mem = {};
  function getJ(url, n) { n = n || 0; var c = mem[url]; if (c && Date.now() - c.at < TTL) return Promise.resolve(c.j);
    return fetch(url).then(function (r) {
      if (r.status === 429 || r.status === 503) { if (n >= 3) throw new Error('DEX API busy (' + r.status + ')'); var ra = r.headers.get('Retry-After'), s = Number(ra);
        var ms = isFinite(s) && ra !== null ? s * 1000 : ra ? Math.max(0, Date.parse(ra) - Date.now()) : 2000 * (n + 1); return wait(Math.min(ms || 1000, 60e3)).then(function () { return getJ(url, n + 1); }); }
      if (r.status === 404) { var e = new Error('DEX API 404'); e.status = 404; throw e; }
      if (!r.ok) throw new Error('DEX API ' + r.status); return r.json(); }).then(function (j) { mem[url] = { at: Date.now(), j: j }; return j; }); }
  function pages(path, cap) { var out = [], k = 0; cap = cap || 50;
    function go(cur) { return getJ(API + path + (path.indexOf('?') < 0 ? '?' : '&') + 'limit=1000' + (cur ? '&cursor=' + encodeURIComponent(cur) : '')).then(function (j) {
      out = out.concat(j.result || []); if (j.next_cursor && ++k < cap) return go(j.next_cursor); return out; }, function (e) { if (e.status === 404) return out; throw e; }); }
    return go(null); }
  var slim = function (o) { return { tx_hash: o.tx_hash, tx_index: o.tx_index, block_index: o.block_index, source: o.source, give_asset: o.give_asset, give_quantity: o.give_quantity, give_remaining: o.give_remaining,
    get_asset: o.get_asset, get_quantity: o.get_quantity, get_remaining: o.get_remaining, expiration: o.expiration, expire_index: o.expire_index, status: o.status }; };
  var slimM = function (m) { return { id: m.id, tx0_hash: m.tx0_hash, tx1_hash: m.tx1_hash, tx0_address: m.tx0_address, tx1_address: m.tx1_address, forward_asset: m.forward_asset, forward_quantity: m.forward_quantity,
    backward_asset: m.backward_asset, backward_quantity: m.backward_quantity, block_index: m.block_index, tx1_index: m.tx1_index, status: m.status }; };
  var slimI = function (i) { return { tx_hash: i.tx_hash, tx_index: i.tx_index, block_index: i.block_index, asset: i.asset, source: i.source, issuer: i.issuer, quantity: i.quantity, divisible: i.divisible, locked: i.locked, description: i.description, status: i.status }; };
  /** deedAssets(rows) -> the pet-token assets named by pet:deed burns (the API has no asset search, so the burn announces the token). */
  function deedAssets(rows) { var seen = {}, out = []; (V.readBurns ? V.readBurns(rows || []) : rows || []).forEach(function (r) { var t; try { t = V.parseTag(r.tag); } catch (e) { t = null; }
    if (t && t.action === 'deed' && !seen[t.asset]) { seen[t.asset] = 1; out.push(t.asset); } }); return out.sort(); }
  /** loadDex(rows) -> {issuances, orders, matches} for every pet token (token/XCPETS and token/XCP), sorted so the replay input is the same
   *  whatever page order the API used. Only the first valid issuance of each token is kept (that one decides the binding). */
  function loadDex(rows) { if (V.salesGate() == null && !PREVIEW) return Promise.resolve(null);
    var as = deedAssets(rows), key = as.join(',');
    try { var c = JSON.parse(sessionStorage.getItem(CKEY) || 'null'); if (c && c.key === key && Date.now() - c.at < TTL) return Promise.resolve(c.d); } catch (e) { }
    var d = { issuances: [], orders: [], matches: [] }, q = as.slice();
    function one(A) { return Promise.all([pages('/assets/' + A + '/issuances?verbose=true'), pages('/orders/' + A + '/XCPETS?status=all&verbose=true'), pages('/orders/' + A + '/XCP?status=all&verbose=true'),
        pages('/orders/' + A + '/XCPETS/matches?verbose=true'), pages('/orders/' + A + '/XCP/matches?verbose=true')]).then(function (r) {
      var iss = r[0].filter(function (i) { return i.status == null || i.status === 'valid'; }).sort(function (a, b) { return a.tx_index - b.tx_index; })[0]; if (iss) d.issuances.push(slimI(iss));
      d.orders = d.orders.concat(r[1], r[2]); d.matches = d.matches.concat(r[3], r[4]); }); }
    function next() { return q.length ? one(q.shift()).then(next) : null; } /* one token at a time: kind to the API */
    return Promise.all([next(), next()]).then(function () { var seenO = {}, seenM = {};
      d.issuances.sort(function (a, b) { return a.tx_index - b.tx_index; });
      d.orders = d.orders.filter(function (o) { return !seenO[o.tx_hash] && (seenO[o.tx_hash] = 1); }).map(slim).sort(function (a, b) { return a.tx_index - b.tx_index; });
      d.matches = d.matches.filter(function (m) { return !seenM[m.id] && (seenM[m.id] = 1); }).map(slimM).sort(function (a, b) { return a.block_index - b.block_index || a.tx1_index - b.tx1_index || (a.id < b.id ? -1 : 1); });
      try { sessionStorage.setItem(CKEY, JSON.stringify({ at: Date.now(), key: key, d: d })); } catch (e) { } return d; }); }
  /** freeDeed() -> a random numeric asset nobody has issued (404 on /assets/{A}); 6 tries. */
  function freeDeed(n) { n = n || 0; var b = new Uint8Array(8); crypto.getRandomValues(b); var A = V.randomDeed(b);
    if (PREVIEW) return Promise.resolve(A);
    return fetch(API + '/assets/' + A).then(function (r) { if (r.status === 404) return A; if (n >= 5) throw new Error('could not find a free token name'); return freeDeed(n + 1); }); }
  /** tokenAt(A) -> {issued, block, holder} from the API (live) */
  function tokenAt(A) { return Promise.all([getJ(API + '/assets/' + A + '/issuances?verbose=true').then(function (j) { return j.result || []; }, function () { return []; }),
      getJ(API + '/assets/' + A + '/balances').then(function (j) { return j.result || []; }, function () { return []; })]).then(function (r) {
      var i = r[0].filter(function (x) { return x.status == null || x.status === 'valid'; })[0], h = r[1].filter(function (x) { return Number(x.quantity) > 0; })[0];
      return { issued: !!i, block: i ? i.block_index : null, holder: h ? h.address : null }; }); }
  window.V2Sales = { loadDex: loadDex, deedAssets: deedAssets, _getJ: getJ };
  if (!$('shop')) return;
  /* Spam City is one package: Buy / Sell (pet tokens) / Trade (swaps) / Gift (one or many), one launch gate (V.spamCityGate).
   * Trade + Gift reuse js/v2-gift.js flows; they confirm on play.html exactly like the pet.html / play.html entry points. */
  window.V2SwapGo = window.V2SwapGo || function (h) { if (PREVIEW) { toast('Preview: this would open play.html#' + esc(h) + ' to confirm in the wallet.'); return; } location.href = 'play.html#' + h; };

  /* ---- data: live world, or sample data for ?salesPreview=1 */
  var ME, W, TIP, BOOK;
  function sample() { var me = 'bc1qpreviewbuyer0000000000000000000000me', s = 'bc1qpreviewseller000000000000000000000s1', T = 972640;
    var P = [[4107, 'wojak', 'Sad Steve', 2, 3], [2231, 'pepe', 'Rare Pepe Jr', 3, 4], [3890, 'kek', 'Kekmeister', 1, 2], [1520, 'doge', 'Such Fren', 0, 2], [3301, 'lenny', 'Lenny Face', 2, 3], [2780, 'peepo', 'Peepo', 1, 1], [4012, 'kevin', 'KEVIN', 3, 5], [3555, 'bobo', 'Bobo', 0, 1], [1999, 'mumu', 'Mumu', 1, 3],
      [4200, 'snibby', 'Snibs', 2, 2], [4201, 'chud', 'Chud', 0, 1], [4202, 'dodo', 'Dodo', 1, 2], [4203, 'pepe', 'Fresh Pepe', 1, 1]];
    var byId = {}, deeds = {}, pets = P.map(function (r, i) { var p = { id: r[0], species: r[1], name: r[2], tier: r[3], stage: r[4], owner: i >= 9 ? me : s, stats: { vigor: 20 + i * 3, spark: 18 + i, grit: 25 - i, zoom: 15 + i * 2, luck: 10 + i }, gear: [], hatchBlock: T - 3000 + i * 97, breedsV2: i % 4, parents: i % 3 === 0 ? [1000 + i, 2000 + i] : null }; byId[p.id] = p; return p; });
    pets.forEach(function (p, i) { if (i === 12) return; var A = 'A1' + String(73100000000 + p.id * 7919).padStart(17, '0'); p.deed = A; deeds[A] = { petId: p.id, block: T - 700 + i, tx: 'd' + i, issuer: p.owner, holder: p.owner, prev: null }; });
    pets[11].owner = me; deeds[pets[11].deed].holder = me; deeds[pets[11].deed].issuer = s; pets[11].lastGot = T - 300; /* 4202: bought earlier, token came along: relist = 1 window */
    pets[10].owner = me; deeds[pets[10].deed].holder = 'bc1qsomeoneelse'; /* 4201: token left the wallet: remint */
    var prices = [['XCPETS', 2500e8], ['XCP', 250000000], ['XCPETS', 400e8], ['XCPETS', 120e8], ['XCP', 90000000], ['XCPETS', 300e8], ['XCP', 1500000000], ['XCPETS', 50e8], ['XCPETS', 180e8], ['XCPETS', 777e8]];
    var L = prices.map(function (x, i) { var p = pets[i], h = (('a' + i) + '0f3c9e7d2b81').slice(0, 8) + 'deadbeef' + i; return { n: i + 1, petId: p.id, seller: p.owner, block: T - 20 - i, tx: 'b' + i, order: h, orderBlock: T - 21 - i, give: p.deed, asset: x[0], price: x[1], expire: T + 200 - i * 9, status: 'open' }; });
    L.push({ n: 11, petId: 4202, seller: s, block: T - 400, tx: 'b11', order: 'c0ffee11aa', orderBlock: T - 401, give: pets[11].deed, asset: 'XCPETS', price: 333e8, expire: T - 113, status: 'sold', buyer: me, soldBlock: T - 300 });
    L.push({ n: 12, petId: 4200, seller: me, block: T - 900, tx: 'b12', order: 'c0ffee12bb', orderBlock: T - 901, give: pets[9].deed, asset: 'XCP', price: 50000000, expire: T - 613, status: 'open' });
    var items = { g1: { id: 'g1', on: 2231 }, g2: { id: 'g2', on: 4012 }, g3: { id: 'g3', on: 4200 } };
    var book = L.map(function (S) { return { tx_hash: S.order, tx_index: S.n, block_index: S.orderBlock, source: S.seller, give_asset: S.give, give_quantity: 1, give_remaining: S.status === 'open' ? 1 : 0, get_asset: S.asset, get_quantity: S.price, expiration: 288, expire_index: S.expire, status: S.status === 'open' ? 'open' : 'filled' }; });
    book[9].status = 'cancelled'; /* listing 10: cancelled on the DEX, shows the optional early unlock */
    return { me: me, tip: T, world: { byId: byId, pets: pets, listings: L, deeds: deeds, tip: T, items: items, rug: { ads: [] }, fights: [], breeds: [], gifts: [], swaps: [] }, book: book }; }
  if (PREVIEW) { /* preview only: a stand-in world for js/v2-gift.js (loaded after this file) so the Trade / Gift modals render; never boots the chain */
    var PS = sample(); ME = PS.me; W = PS.world; TIP = PS.tip; BOOK = PS.book; W.players = {}; W.players[ME] = 77; W.players['bc1qpreviewseller000000000000000000000s1'] = 12; W.playerAddr = {};
    W.swaps = [{ n: 1, from: 'bc1qpreviewseller000000000000000000000s1', mine: 3890, theirs: 4200, block: TIP - 40, expires: TIP + 968, status: 'open', tx: 'sw1' }, { n: 2, from: ME, mine: 4203, theirs: 2231, block: TIP - 5, expires: TIP + 1003, status: 'open', tx: 'sw2' }];
    W.gifts = [{ tx: 'gf1', petId: 4203, from: 'bc1qpreviewseller000000000000000000000s1', to: ME, block: TIP - 30 }];
    window.V2Mock = { ME: ME, prod: false, world: function () { return W; }, state: function () { return { tip: TIP, verified: true }; } };
    if (V._setGiveActivation) V._setGiveActivation(TIP - 100); }
  function load() { if (PREVIEW) return Promise.resolve();
    var M = window.V2Mock; ME = M.ME; W = M.world(); TIP = W.tip || M.state().tip;
    return (M.state().dex ? Promise.resolve(M.state().dex) : loadDex(M.state().rows)).then(function (d) { BOOK = (d && d.orders) || []; }); }
  function on() { return PREVIEW || V.salesOn(TIP + 1); }
  function blk(n) { return Number(n).toLocaleString('en-US'); }
  function short(A) { A = String(A || ''); return A.length > 12 ? A.slice(0, 6) + '…' + A.slice(-4) : A; }

  /* ---- cards */
  var TL = ['Common', 'Uncommon', 'Rare', 'Legendary'];
  function power(p) { return V.petPower(p); } function st(p, k) { return (p.stats && p.stats[k]) || 0; }
  var PF = window.V2PetFilter, BINDER_F = ['sp', 'tier', 'st', 'badge', 'cur', 'min', 'max', 'pw', 'bl', 'gear', 'buy', 'sort'], PICK_F = ['sp', 'tier', 'st', 'badge', 'sort'];
  function omLine(p) { return V.oldMoney(p) ? '<p class="sh-omline">' + PF.badge(p) + ' Bred while breeding cost 690. A collector mark only; it never changes how the pet plays.</p>' : ''; }
  function tierName(p) { return p.stage >= 5 || p.mythicCare ? 'Mythic' : TL[p.tier] || ''; }
  function spName(p) { try { return V.speciesLabel(p.species); } catch (e) { return p.species; } }
  function art(p) { return PREVIEW || !window.V2Render ? '<img alt="" src="img/theme/sp-' + esc(String(p.species).replace(/[^a-z]/g, '')) + '.png">' : '<span class="sh-sp" data-shsp="' + p.id + '"></span>'; }
  function paint() { var R = window.V2Render; if (PREVIEW || !R || !R.petFrames) return; document.querySelectorAll('[data-shsp]').forEach(function (s) { if (s.firstChild) return; var p = W.byId[s.getAttribute('data-shsp')];
    var c = document.createElement('canvas'); c.width = c.height = 32; s.appendChild(c); try { var fr = R.petFrames(p, W); if (R.animate) R.animate(c, fr); } catch (e) { } }); }
  /* token badge: green = the pet owner holds the token (sellable); grey = no token yet; red = token is held elsewhere (remint to sell) */
  function deedBadge(p) { var d = V.deedOf(W, p); if (!d) return '';
    return '<div class="sh-deed' + (d.ok ? '' : ' sh-deed-bad') + '" title="Pet token ' + esc(d.asset) + (d.ok ? '' : ' (held by another address)') + '">🎟 ' + esc(short(d.asset)) + '</div>'; }
  function card(p, S, back) { var t = p.stage >= 5 ? 4 : p.tier || 0;
    return '<div class="sh-card sh-t' + t + '" data-n="' + (S ? S.n : '') + '"><div class="sh-hd"><b>' + esc(p.name || spName(p)) + '</b><i>#' + p.id + '</i></div><div class="sh-art">' + art(p) + '</div>' +
      '<div class="sh-st">' + esc(tierName(p)) + ' · ' + esc(spName(p)) + '<br>PWR ' + power(p) + ' &nbsp;V' + st(p, 'vigor') + ' S' + st(p, 'spark') + ' G' + st(p, 'grit') + ' Z' + st(p, 'zoom') + ' L' + st(p, 'luck') + '</div>' +
      (V.oldMoney(p) ? '<div class="sh-om">' + esc(V.OLD_MONEY_LABEL) + '</div>' : '') + deedBadge(p) +
      (S && S.price != null ? '<div class="sh-tag">' + esc(V.saleAmountText(S.asset, S.price)) + '</div>' : '') + (back || '') + '</div>'; }

  var LINES = ['Every egg here is 100% organic. No filler. I checked every byte.', 'I tried to filter the crab. The crab filtered me.', "Don't feed them after midnight. Feed them every chain day.",
    "This block's pets are extra fluffy. Low fees, high fluff.", 'KEVIN keeps staring at me. I respect that.', 'Some call it spam. I call it a hatchling.', "Wrap 'em gently. The Wojaks cry at bows.", "Nakamoto used to sleep in that cage. We don't talk about it."];
  var li = 0; function luke() { var b = $('shLuke'); if (b) b.textContent = '“' + LINES[li++ % LINES.length] + '”'; }

  function orderOf(S) { return (BOOK || []).filter(function (o) { return o.tx_hash === S.order; })[0] || null; }
  var TAB = (/^#(buy|sell|trade|gift)$/.exec(location.hash) || [0, 'buy'])[1];
  function playerLine() { var n = V.playerNo && V.playerNo(W, ME); return '<p class="sh-hint">Your player #: <b>' + (n ? esc(V.playerCode(n)) : 'none yet (play.html: “Get my player #”)') + '</b>. Friends gift to this number.</p>'; }
  function tradeHtml(b) { var sw = V.swapsFor ? V.swapsFor(W, ME, b) : [], G = !!window.V2Gift;
    return '<div class="sh-bar"><label class="sh-hint">Offer a swap for pet # <input id="shSwapId" type="number" min="1" step="1" style="width:7em"></label> <button class="sh-btn" id="shSwapGo"' + (G ? '' : ' disabled') + '>🔁 Pick my pet to offer</button></div>' +
      '<p class="sh-hint">Pet for pet, no money: you offer one of yours, the owner has ' + (V.SWAP_WINDOW || 1008) + ' blocks to accept. Gear moves with each pet. Tip: “🔁 Offer swap” is also on every pet page.</p>' +
      '<h2 class="sec">Swap offers</h2><div class="sh-mine">' + (sw.map(function (X) { var mineOffer = X.from === ME, A = W.byId[mineOffer ? X.mine : X.theirs], B = W.byId[mineOffer ? X.theirs : X.mine], why = !mineOffer && V.swapWhy ? V.swapWhy(W, X, ME, b) : null;
        return '<div class="sh-row sh-swap">' + card(A) + '<b class="sh-swapx" aria-hidden="true">⇄</b>' + card(B) + '<div class="sh-rinfo"><span class="sh-state sh-s-open">' + (mineOffer ? 'You offered' : 'Offer to you') + '</span> Offer ' + X.n + '<br>You give #' + A.id + ', you get #' + B.id + '.<br>Open until block ' + blk(X.expires) + '.<br>' +
          (mineOffer ? '<button class="sh-btn" data-swapgo="swapno-' + X.n + '">Cancel offer</button>' : why ? '<span class="sh-warn">' + esc(why) + '</span><br><button class="sh-btn" data-swapgo="swapno-' + X.n + '">Decline</button>' : '<button class="sh-btn" data-swapgo="swapok-' + X.n + '">Accept</button> <button class="sh-btn sh-ghost" data-swapgo="swapno-' + X.n + '">Decline</button>') + '</div></div>'; }).join('') || '<p class="sh-hint">No open swap offers.</p>') + '</div>'; }
  function giftHtml(b) { var mine = W.pets.filter(function (p) { return p.owner === ME && !p.dead && !p.released && !p.community; }), G = !!window.V2Gift, got = V.giftsTo ? V.giftsTo(W, ME).slice(-6).reverse() : [];
    return '<div class="sh-bar"><button class="sh-btn" id="shGiftMany"' + (G ? '' : ' disabled') + '>🎁 Gift several pets</button><span class="sh-hint">Free: 1 dander per burn plus the Bitcoin fee. Pets move for good, with their worn and bag gear.</span></div>' + playerLine() +
      (got.length ? '<h2 class="sec">Gifts you got</h2><div class="sh-grid">' + got.filter(function (g) { return W.byId[g.petId]; }).map(function (g) { return card(W.byId[g.petId]); }).join('') + '</div>' : '') +
      '<h2 class="sec">Gift one pet</h2><div class="sh-grid">' + (mine.slice(0, 24).map(function (p) { var why = V.giveLocks ? V.giveLocks(W, p, b) : null;
        return card(p, null, '<button class="sh-btn sh-buy' + (why ? ' sh-later' : '') + '" data-gift="' + p.id + '"' + (why ? ' title="' + esc(why) + '" disabled' : '') + '>🎁 Gift</button>'); }).join('') || '<p class="sh-hint">You have no pets to gift.</p>') + '</div>' +
      (mine.length > 24 ? '<p class="sh-hint">Showing 24 of ' + mine.length + '. Use “Gift several pets” to filter and pick from all of them.</p>' : ''); }
  var PAGE = 0, PER = 9, ST = { open: 'Active', expired: 'Expired', sold: 'Sold', 'void': 'Ended', ended: 'Ended' };
  function mineInfo(S, p, stt) { var o = orderOf(S);
    if (stt === 'open') { var x = '<br>Ends after block ' + blk(S.expire) + ' (' + (S.expire - TIP) + ' blocks left)<br>#' + p.id + ' is locked while listed.';
      if (S.endBlock != null) return x + '<br>Unlock burn seen: the listing ends at block ' + blk(S.endBlock) + '.';
      if (o && o.status === 'cancelled') return x + '<br>Order cancelled on the DEX: nobody can buy it. <button class="sh-btn" data-unsell="' + S.n + '">Unlock in ' + (V.SALE_UNSELL_SETTLE || 6) + ' blocks (1 dander)</button>';
      return x + '<br><button class="sh-btn" data-cancel="' + S.n + '">Cancel listing</button>'; }
    return stt === 'sold' ? '<br>Sold' + (S.soldBlock ? ' at block ' + blk(S.soldBlock) : '') + (S.buyer === ME ? ' to you' : '') : stt === 'expired' ? '<br>Ended after block ' + blk(S.expire) + '. Nothing to cancel.'
      : stt === 'ended' ? '<br>Unlocked by the burn at block ' + blk(S.endBlock) + '.' : '<br>The pet or its token moved, so this listing ended.'; }
  function render() { var root = $('shop'); if (!on()) { root.innerHTML = '<p class="sh-soon">The shop opens soon. Until then the cases hold card backs.</p><div class="sh-grid">' + '<div class="sh-card sh-back"></div>'.repeat(6) + '</div>'; return; }
    var b = TIP + 1, all = V.openListings(W, b).filter(function (S) { return S.seller !== ME; }).map(function (S) { return { p: W.byId[S.petId], S: S, buy: !V.buyGuard(W, S, BOOK, b, ME) }; }),
      fB = PF.load('binder'), fM = PF.load('mine'), xs = V.petFilter(W, all, fB, b), others = xs.map(function (x) { return x.S; }),
      mineAll = (W.listings || []).filter(function (S) { return S.seller === ME || S.buyer === ME; }).map(function (S) { return { p: W.byId[S.petId], S: S }; }), mine = V.petFilter(W, mineAll, fM, b).map(function (x) { return x.S; }),
      pgs = Math.max(1, Math.ceil(others.length / PER));
    PAGE = Math.min(PAGE, pgs - 1); var pg = xs.slice(PAGE * PER, PAGE * PER + PER);
    var nSell = mineAll.filter(function (x) { return x.S.seller === ME && V.saleState(W, x.S, b) === 'open'; }).length, nTrade = V.swapsFor ? V.swapsFor(W, ME, b).length : 0;
    var tabs = '<nav class="sh-tabs" role="tablist">' + [['buy', '🛒 Buy', all.length], ['sell', '🎟 Sell', nSell], ['trade', '🔁 Trade', nTrade], ['gift', '🎁 Gift', null]].map(function (t) {
      return '<button class="sh-tab' + (TAB === t[0] ? ' on' : '') + '" role="tab" aria-selected="' + (TAB === t[0]) + '" data-tab="' + t[0] + '">' + t[1] + (t[2] ? ' <b class="sh-cnt">' + t[2] + '</b>' : '') + '</button>'; }).join('') + '</nav>';
    if (TAB === 'trade' || TAB === 'gift') { root.innerHTML = tabs + (TAB === 'trade' ? tradeHtml(b) : giftHtml(b)); paint(); return; }
    root.innerHTML = tabs + (TAB === 'sell' ? '<div class="sh-bar"><button class="sh-btn" id="shSell">List my pet</button><span class="sh-hint">Every pet sells with its own 🎟 pet token. Your token travels to the buyer with the pet.</span></div>' : '<div class="sh-bar"><span class="sh-hint">' + others.length + ' of ' + all.length + ' pet' + (all.length === 1 ? '' : 's') + ' in the binder · every pet sells with its own 🎟 pet token</span></div>' +
      '<div id="shBinF">' + PF.html(fB, BINDER_F, { species: PF.species(all.map(function (x) { return x.p; })), count: others.length, total: all.length }) + '</div>' +
      '<div class="sh-binder"><div class="sh-rings"></div><div class="sh-grid">' + (pg.map(function (x) { return card(x.p, x.S, '<button class="sh-btn sh-buy' + (x.buy ? '' : ' sh-later') + '" data-buy="' + x.S.n + '">' + (x.buy ? 'Buy' : 'Buy (wait)') + '</button>'); }).join('') || '<p class="sh-hint">' + (all.length ? 'No pets match these filters.' : 'The binder is empty.') + '</p>') + '</div>' +
      '<div class="sh-pager"><button class="sh-btn" id="shPrev"' + (PAGE ? '' : ' disabled') + '>◀</button> page ' + (PAGE + 1) + ' of ' + pgs + ' <button class="sh-btn" id="shNext"' + (PAGE < pgs - 1 ? '' : ' disabled') + '>▶</button></div></div>') +
      (TAB !== 'sell' ? '' : '<h2 class="sec">My listings</h2><div id="shMineF">' + PF.html(fM, ['state', 'sort'], { count: mine.length, total: mineAll.length }) + '</div><div class="sh-mine">' + (mine.map(function (S) { var p = W.byId[S.petId], stt = V.saleState(W, S, b);
        return '<div class="sh-row">' + card(p, S) + '<div class="sh-rinfo"><span class="sh-state sh-s-' + stt + '">' + (S.buyer === ME && S.seller !== ME ? 'Bought' : ST[stt]) + '</span> Listing ' + S.n + '<br>Asks exactly ' + esc(V.saleAmountText(S.asset, S.price)) +
        mineInfo(S, p, stt) + '</div></div>'; }).join('') || '<p class="sh-hint">' + (mineAll.length ? 'No listings match.' : 'You have no listings.') + '</p>') + '</div>');
    if ($('shBinF')) PF.bind($('shBinF'), fB, 'binder', function () { PAGE = 0; render(); }); if ($('shMineF')) PF.bind($('shMineF'), fM, 'mine', render);
    paint(); }

  /* ---- modal + wallet steps */
  function modal(h) { var m = $('shModal'); m.innerHTML = '<div class="box">' + h + '</div>'; m.style.display = 'flex'; m.onclick = function (e) { if (e.target === m || e.target.hasAttribute('data-close')) m.style.display = 'none'; }; return m; }
  function close() { $('shModal').style.display = 'none'; }
  function toast(h) { var t = $('toasts'); var d = document.createElement('div'); d.className = 'toast'; d.innerHTML = h; t.appendChild(d); setTimeout(function () { d.remove(); }, 6000); }
  function walletDex(plan, then) { if (PREVIEW) { toast('Preview: no wallet window, nothing was sent.'); return then && then({ txid: 'f00dbabe' + 'preview'.repeat(4) }); }
    window.V2Wallet.sendDex(plan, ME).then(function (r) { toast('Sent: ' + esc(plan.label)); if (then) then(r); }, function (e) { toast('Not sent: ' + esc(e.message || e)); }); }
  function walletBurn(plan, then) { if (PREVIEW) { toast('Preview: no wallet window, nothing was sent.'); return then && then({}); }
    window.V2Wallet.send(plan, ME).then(function (r) { toast('Sent: ' + esc(plan.label)); if (then) then(r); }, function (e) { toast('Not sent: ' + esc(e.message || e)); }); }
  /* a token made in window 1 waits here (per pet) until it confirms */
  var PK = 'xcpets-deed-pending'; function pendAll() { try { return JSON.parse(localStorage.getItem(PK) || '{}') || {}; } catch (e) { return {}; } }
  function pend(id, v) { var a = pendAll(); if (v === undefined) return a[id] || null; if (v) a[id] = v; else delete a[id]; try { localStorage.setItem(PK, JSON.stringify(a)); } catch (e) { } return null; }

  function sellable(p) { return !V.deedWhy(W, { petId: p.id }, ME, TIP + 1) && !(V.giveLocks && V.giveLocks(W, p, TIP + 1)); }
  function sellPick() { var free = W.pets.filter(function (p) { return p.owner === ME && sellable(p); }), fS = PF.load('sell'),
      mine = V.petFilter(W, free.map(function (p) { return { p: p }; }), fS, TIP + 1).map(function (x) { return x.p; });
    modal('<h3>List my pet</h3><p class="sh-hint">Pick a pet. Pets in a fight, a breed request, a Rug Me ad or a pending gift/swap are locked and are not shown. Pets with a 🎟 token you hold list in one wallet window.</p>' + PF.html(fS, PICK_F, { species: PF.species(free), count: mine.length, total: free.length }) + '<div class="sh-pick">' +
      (mine.map(function (p) { return '<button class="sh-pk" data-pick="' + p.id + '">' + card(p) + '</button>'; }).join('') || '<p>No free pets right now.</p>') + '</div><button class="sh-btn" data-close>Close</button>');
    document.querySelectorAll('[data-pick]').forEach(function (b) { b.onclick = function () { sellPrice(W.byId[b.getAttribute('data-pick')], 'XCPETS', 100); }; });
    PF.bind($('shModal'), fS, 'sell', sellPick); }
  function priceForm(p, asset, sticker) { var unit = asset === 'XCP' ? 1 : 1e8, ask = Math.round(sticker * unit), low = !(ask >= V.SALE_MIN[asset]);
    return { ask: ask, low: low, html: '<label>Price in <select id="shAsset"><option' + (asset === 'XCPETS' ? ' selected' : '') + '>XCPETS</option><option' + (asset === 'XCP' ? ' selected' : '') + '>XCP</option></select></label>' +
      '<label>Price (' + (asset === 'XCP' ? 'sats' : 'XCPETS') + ') <input id="shSticker" type="number" min="1" step="1" value="' + sticker + '"></label>' +
      '<p class="sh-exact">Buyers pay: <b>' + esc(V.saleAmountText(asset, ask)) + '</b></p>' + (low ? '<p class="sh-warn">Minimum is 1 XCPETS or 1,000 sats.</p>' : '') }; }
  function sellPrice(p, asset, sticker) { var step = V.sellStep(W, p, ME), d = V.deedOf(W, p), pd = pend(p.id), f = priceForm(p, asset, sticker);
    var tok = step === 'list' ? '<p class="sh-ok">🎟 You hold the pet token ' + esc(d.asset) + '. Listing is one wallet window.</p>'
      : d && !d.ok ? '<p class="sh-warn">The token ' + esc(short(d.asset)) + ' for #' + p.id + ' is held by another address, so it can\'t list. Make a new token: it replaces the old one.</p>'
      : '<p class="sh-hint">#' + p.id + ' has no pet token yet. Make one first (free: no XCP fee, only the Bitcoin network fee).</p>';
    var steps = step === 'list' ? '<ol class="sh-steps"><li><b>One window:</b> a DEX order: give the token, get ' + esc(V.saleAmountText(asset, f.ask)) + '. It lasts ' + V.SALE_EXPIRY + ' blocks.</li></ol>'
      : '<ol class="sh-steps"><li><b>Window 1 of 3:</b> make the token ' + (pd ? esc(short(pd.asset)) : '') + ' (1 unit, locked, “' + esc(V.deedDesc(p.id)) + '”).</li><li>Wait 1 block for it to confirm.</li>' +
        '<li><b>Window 2 of 3:</b> a 1-dander burn that ties the token to #' + p.id + '.</li><li><b>Window 3 of 3:</b> the DEX order (send it right after window 2).</li></ol>';
    var btn = step === 'list' ? '<button class="sh-btn" id="shGo"' + (f.low ? ' disabled' : '') + '>Open wallet window</button>'
      : pd ? '<button class="sh-btn" id="shTie"' + (f.low ? ' disabled' : '') + '>Token sent: open window 2 of 3</button>' : '<button class="sh-btn" id="shMint">Open window 1 of 3</button>';
    modal('<h3>List #' + p.id + '</h3><div class="sh-sellrow">' + card(p, { asset: asset, price: f.ask }) + '<div class="sh-form">' + tok + f.html + omLine(p) +
      '<p class="sh-hint">The token travels with the pet: the buyer gets both and can relist in one window. A partial fill is no sale.</p>' + steps + btn + ' <button class="sh-btn sh-ghost" data-close>Back</button><p class="sh-hint" id="shMsg"></p></div></div>');
    var re = function () { sellPrice(p, $('shAsset').value, Number($('shSticker').value) || 0); };
    $('shAsset').onchange = re; $('shSticker').onchange = re;
    if ($('shGo')) $('shGo').onclick = function () { walletDex(V.listPlan(p.id, d.asset, asset, f.ask), close); };
    if ($('shMint')) $('shMint').onclick = function () { $('shMsg').textContent = 'Finding a free token name…';
      freeDeed().then(function (A) { walletDex(V.mintPlan(p.id, A), function (r) { pend(p.id, { petId: p.id, asset: A, mintTx: r.txid, at: TIP }); sellPrice(p, asset, sticker); }); }, function (e) { $('shMsg').textContent = 'Not sent: ' + (e.message || e); }); };
    if ($('shTie')) $('shTie').onclick = function () { tieAndList(p, pd, asset, f.ask); }; }
  function tieAndList(p, pd, asset, ask) { var go = function () { var plan = V.deedPlan(p.id, pd.asset);
      modal('<h3>Window 2 of 3</h3><p>The token ' + esc(pd.asset) + ' is confirmed.</p><p>Now burn 1 dander with the tag<br><code>' + esc(plan.tag) + '</code></p><p class="sh-hint">Window 3 (the DEX order) opens right after.</p><button class="sh-btn" id="shGo2">Open window 2 of 3</button> <button class="sh-btn sh-ghost" data-close>Later</button>');
      $('shGo2').onclick = function () { walletBurn(plan, function () {
        modal('<h3>Window 3 of 3</h3><p>The tie burn was sent. Last step: the DEX order that gives the token ' + esc(short(pd.asset)) + ' and gets exactly <b>' + esc(V.saleAmountText(asset, ask)) + '</b>.</p><p class="sh-hint">Send it now or within ' + V.SALE_ORDER_LAG + ' blocks. The pet is listed once both confirm.</p><button class="sh-btn" id="shGo3">Open window 3 of 3</button> <button class="sh-btn sh-ghost" data-close>Later</button>');
        $('shGo3').onclick = function () { walletDex(V.listPlan(p.id, pd.asset, asset, ask), function () { pend(p.id, null); close(); }); }; }); }; };
    if (PREVIEW) return go();
    tokenAt(pd.asset).then(function (t) { if (!t.issued) { $('shMsg').textContent = 'The token is not confirmed yet. Wait for the next block and try again.'; return; }
      if (t.holder && t.holder !== ME) { $('shMsg').textContent = 'The token is held by another address. Make a new one.'; pend(p.id, null); return; } go(); }); }
  function buy(n) { var S = W.listings.filter(function (x) { return x.n === n; })[0], p = W.byId[S.petId], why = V.buyGuard(W, S, BOOK, TIP + 1, ME), gear = (p.gear || []).length;
    modal('<h3>Buy #' + p.id + '?</h3><div class="sh-sellrow">' + card(p, S) + '<div class="sh-form">' + omLine(p) + '<p>You pay exactly <b>' + esc(V.saleAmountText(S.asset, S.price)) + '</b> and get #' + p.id + (gear ? ' with its ' + gear + ' worn and bag gear' : ' and any worn and bag gear') + ', plus its 🎟 pet token ' + esc(short(S.give)) + '.</p>' +
      '<p class="sh-hint">One wallet window: a DEX order that gives this amount and gets the token. It expires after 1 block. The pet moves to you when the match completes on chain. Keep the token to relist the pet in one window.</p>' +
      (why ? '<p class="sh-warn">' + esc(why) + '</p>' : '<p class="sh-ok">Checked against this pet\'s own order book: the listing is open.</p>') +
      '<button class="sh-btn" id="shBuyGo"' + (why ? ' disabled' : '') + '>Open wallet window</button> <button class="sh-btn sh-ghost" data-close>Back</button></div></div>');
    if (!why) $('shBuyGo').onclick = function () { walletDex(V.buyPlan(S), close); }; }
  function cancel(n) { var S = W.listings.filter(function (x) { return x.n === n; })[0];
    modal('<h3>Cancel listing ' + S.n + '?</h3><p>One wallet window: a Counterparty cancel of the order ' + esc(String(S.order).slice(0, 8)) + '….</p><p class="sh-hint">Once the cancel confirms nobody can buy #' + S.petId + '. It stays locked until block ' + blk(S.expire) + ', or press “Unlock” after the cancel for a 1-dander burn that frees it ' + (V.SALE_UNSELL_SETTLE || 6) + ' blocks later.</p>' +
      '<button class="sh-btn" id="shCanGo">Open wallet window</button> <button class="sh-btn sh-ghost" data-close>Keep it listed</button>');
    $('shCanGo').onclick = function () { walletDex(V.cancelPlan(S), close); }; }
  function unsell(n) { var S = W.listings.filter(function (x) { return x.n === n; })[0], plan = V.unsellPlan(S);
    modal('<h3>Unlock #' + S.petId + ' early?</h3><p>Burn 1 dander with the tag<br><code>' + esc(plan.tag) + '</code></p><p class="sh-hint">The listing ends ' + (V.SALE_UNSELL_SETTLE || 6) + ' blocks after the burn confirms. You keep the pet and its token.</p><button class="sh-btn" id="shUnGo">Open wallet window</button> <button class="sh-btn sh-ghost" data-close>Back</button>');
    $('shUnGo').onclick = function () { walletBurn(plan, close); }; }

  document.addEventListener('click', function (e) { var t = e.target; if (!t.closest) return;
    if (t.closest('[data-tab]')) { TAB = t.closest('[data-tab]').getAttribute('data-tab'); try { history.replaceState(null, '', '#' + TAB); } catch (x) { } render(); return; }
    if (t.id === 'shGiftMany' && window.V2Gift) { window.V2Gift.picker(); return; } if (t.closest('[data-gift]') && window.V2Gift) { window.V2Gift.gift([Number(t.closest('[data-gift]').getAttribute('data-gift'))]); return; }
    if (t.id === 'shSwapGo' && window.V2Gift) { var sid = Number($('shSwapId').value), sp = W.byId[sid]; if (!sp || sp.owner === ME || sp.dead || sp.released || sp.community) { toast('Enter the # of a living pet someone else owns.'); return; } window.V2Gift.swap(sid); return; }
    if (t.closest('[data-swapgo]')) { window.V2SwapGo(t.closest('[data-swapgo]').getAttribute('data-swapgo')); return; }
    if (t.id === 'shSell') sellPick(); else if (t.id === 'shPrev') { PAGE--; render(); } else if (t.id === 'shNext') { PAGE++; render(); }
    else if (t.closest('[data-buy]')) buy(Number(t.closest('[data-buy]').getAttribute('data-buy'))); else if (t.closest('[data-cancel]')) cancel(Number(t.closest('[data-cancel]').getAttribute('data-cancel')));
    else if (t.closest('[data-unsell]')) unsell(Number(t.closest('[data-unsell]').getAttribute('data-unsell'))); });
  function start() { load().then(function () { render(); luke(); setInterval(luke, 9000); }, function (e) { $('shop').innerHTML = '<p class="sh-warn">Could not read the order book: ' + esc(e.message || e) + '</p>'; }); }
  window.V2Sales.start = start; window.V2Sales.sample = sample; window.V2Sales._sellPrice = function (id, a, s) { sellPrice(W.byId[id], a || 'XCPETS', s || 100); }; window.V2Sales._buy = buy; window.V2Sales._tab = function (t) { TAB = t; render(); }; window.V2Sales._tie = function (id) { var p = W.byId[id]; tieAndList(p, pend(id) || { asset: 'A1234567890123456789' }, 'XCPETS', 100e8); };
  if (PREVIEW) start();
})();
