/* pet-shop-sales (branch, 2026-10-22): the Spam City Games shop (shop.html). Paid pet listings settled by the Counterparty DEX.
 *  Sell  = window 1: a DEX order on XCPETS/XCP (gives 1 unit, asks the exact listing amount, 288 blocks), then window 2: a 1-dander burn
 *          pet:sell:ID:<first 8 hex of the order tx>. The pet moves only when replay sees a completed match of exactly that order and amount.
 *  Buy   = one matching order (gives the price, gets 1 unit, expires after 1 block), offered only when buyGuard says it fills this listing first.
 *  Cancel= one Counterparty cancel of the listing order.
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
      if (!r.ok) throw new Error('DEX API ' + r.status); return r.json(); }).then(function (j) { mem[url] = { at: Date.now(), j: j }; return j; }); }
  function pages(path, cap) { var out = [], k = 0; cap = cap || 50;
    function go(cur) { return getJ(API + path + (path.indexOf('?') < 0 ? '?' : '&') + 'limit=1000' + (cur ? '&cursor=' + encodeURIComponent(cur) : '')).then(function (j) {
      out = out.concat(j.result || []); if (j.next_cursor && ++k < cap) return go(j.next_cursor); return out; }); }
    return go(null); }
  var slim = function (o) { return { tx_hash: o.tx_hash, tx_index: o.tx_index, block_index: o.block_index, source: o.source, give_asset: o.give_asset, give_quantity: o.give_quantity, give_remaining: o.give_remaining,
    get_asset: o.get_asset, get_quantity: o.get_quantity, get_remaining: o.get_remaining, expiration: o.expiration, expire_index: o.expire_index, status: o.status }; };
  var slimM = function (m) { return { id: m.id, tx0_hash: m.tx0_hash, tx1_hash: m.tx1_hash, tx0_address: m.tx0_address, tx1_address: m.tx1_address, forward_asset: m.forward_asset, forward_quantity: m.forward_quantity,
    backward_asset: m.backward_asset, backward_quantity: m.backward_quantity, block_index: m.block_index, tx1_index: m.tx1_index, status: m.status }; };
  /** loadDex() -> {orders, matches} for XCPETS/XCP, sorted so the replay input is the same whatever page order the API used. */
  function loadDex() { if (V.salesGate() == null && !PREVIEW) return Promise.resolve(null);
    try { var c = JSON.parse(sessionStorage.getItem(CKEY) || 'null'); if (c && Date.now() - c.at < TTL) return Promise.resolve(c.d); } catch (e) { }
    return Promise.all([pages('/orders/XCPETS/XCP?status=all&verbose=true'), pages('/orders/XCPETS/XCP/matches?verbose=true')]).then(function (r) {
      var d = { orders: r[0].map(slim).sort(function (a, b) { return a.tx_index - b.tx_index; }), matches: r[1].map(slimM).sort(function (a, b) { return a.block_index - b.block_index || a.tx1_index - b.tx1_index || (a.id < b.id ? -1 : 1); }) };
      try { sessionStorage.setItem(CKEY, JSON.stringify({ at: Date.now(), d: d })); } catch (e) { } return d; }); }
  window.V2Sales = { loadDex: loadDex, _getJ: getJ };
  if (!$('shop')) return;

  /* ---- data: live world, or sample data for ?salesPreview=1 */
  var ME, W, TIP, BOOK;
  function sample() { var me = 'bc1qpreviewbuyer0000000000000000000000me', s = 'bc1qpreviewseller000000000000000000000s1', T = 972640;
    var P = [[4107, 'wojak', 'Sad Steve', 2, 3], [2231, 'pepe', 'Rare Pepe Jr', 3, 4], [3890, 'kek', 'Kekmeister', 1, 2], [1520, 'doge', 'Such Fren', 0, 2], [3301, 'lenny', 'Lenny Face', 2, 3], [2780, 'peepo', 'Peepo', 1, 1], [4012, 'kevin', 'KEVIN', 3, 5], [3555, 'bobo', 'Bobo', 0, 1], [1999, 'mumu', 'Mumu', 1, 3],
      [4200, 'snibby', 'Snibs', 2, 2], [4201, 'chud', 'Chud', 0, 1], [4202, 'dodo', 'Dodo', 1, 2]];
    var byId = {}, pets = P.map(function (r, i) { var p = { id: r[0], species: r[1], name: r[2], tier: r[3], stage: r[4], owner: i >= 9 ? me : s, stats: { vigor: 20 + i * 3, spark: 18 + i, grit: 25 - i, zoom: 15 + i * 2, luck: 10 + i }, gear: [], hatchBlock: T - 3000 + i * 97, breedsV2: i % 4, parents: i % 3 === 0 ? [1000 + i, 2000 + i] : null }; byId[p.id] = p; return p; });
    var prices = [['XCPETS', 2500e8 + 1], ['XCP', 250000001], ['XCPETS', 400e8 + 1], ['XCPETS', 120e8 + 1], ['XCP', 90000001], ['XCPETS', 300e8 + 2], ['XCP', 1500000001], ['XCPETS', 50e8 + 1], ['XCPETS', 180e8 + 1], ['XCPETS', 777e8 + 1]];
    var L = prices.map(function (x, i) { var p = pets[i], h = (('a' + i) + '0f3c9e7d2b81').slice(0, 8) + 'deadbeef' + i; return { n: i + 1, petId: p.id, seller: p.owner, block: T - 20 - i, tx: 'b' + i, order: h, orderBlock: T - 21 - i, give: x[0] === 'XCP' ? 'XCPETS' : 'XCP', asset: x[0], price: x[1], expire: T + 200 - i * 9, status: 'open' }; });
    L[9].seller = me; pets[9].owner = me;
    L.push({ n: 11, petId: 4201, seller: me, block: T - 400, tx: 'b11', order: 'c0ffee11aa', orderBlock: T - 401, give: 'XCP', asset: 'XCPETS', price: 333e8 + 1, expire: T - 113, status: 'sold', buyer: s, soldBlock: T - 350 });
    L.push({ n: 12, petId: 4202, seller: me, block: T - 600, tx: 'b12', order: 'c0ffee12bb', orderBlock: T - 601, give: 'XCPETS', asset: 'XCP', price: 50000001, expire: T - 313, status: 'open' });
    var items = { g1: { id: 'g1', on: 2231 }, g2: { id: 'g2', on: 4012 }, g3: { id: 'g3', on: 4200 } };
    var book = L.map(function (S) { return { tx_hash: S.order, tx_index: S.n, block_index: S.orderBlock, source: S.seller, give_asset: S.give, give_quantity: 1, give_remaining: 1, get_asset: S.asset, get_quantity: S.price, expiration: 288, expire_index: S.expire, status: 'open' }; });
    book.push({ tx_hash: 'cafe', tx_index: 99, block_index: T - 3, source: 'bc1qsomeoneelse', give_asset: 'XCPETS', give_quantity: 5, give_remaining: 5, get_asset: 'XCP', get_quantity: 400000000, expiration: 100, expire_index: T + 90, status: 'open' });
    return { me: me, tip: T, world: { byId: byId, pets: pets, listings: L, tip: T, items: items, rug: { ads: [] }, fights: [], breeds: [], gifts: [], swaps: [] }, book: book }; }
  function load() { if (PREVIEW) { var s = sample(); ME = s.me; W = s.world; TIP = s.tip; BOOK = s.book; return Promise.resolve(); }
    var M = window.V2Mock; ME = M.ME; W = M.world(); TIP = W.tip || M.state().tip;
    return (M.state().dex ? Promise.resolve(M.state().dex) : loadDex()).then(function (d) { BOOK = ((d && d.orders) || []).filter(function (o) { return o.status === 'open'; }); }); }
  function on() { return PREVIEW || V.salesOn(TIP + 1); }

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
  function card(p, S, back) { var t = p.stage >= 5 ? 4 : p.tier || 0;
    return '<div class="sh-card sh-t' + t + '" data-n="' + (S ? S.n : '') + '"><div class="sh-hd"><b>' + esc(p.name || spName(p)) + '</b><i>#' + p.id + '</i></div><div class="sh-art">' + art(p) + '</div>' +
      '<div class="sh-st">' + esc(tierName(p)) + ' · ' + esc(spName(p)) + '<br>PWR ' + power(p) + ' &nbsp;V' + st(p, 'vigor') + ' S' + st(p, 'spark') + ' G' + st(p, 'grit') + ' Z' + st(p, 'zoom') + ' L' + st(p, 'luck') + '</div>' +
      (V.oldMoney(p) ? '<div class="sh-om">' + esc(V.OLD_MONEY_LABEL) + '</div>' : '') +
      (S ? '<div class="sh-tag">' + esc(V.saleAmountText(S.asset, S.price)) + '</div>' : '') + (back || '') + '</div>'; }

  var LINES = ['Every egg here is 100% organic. No filler. I checked every byte.', 'I tried to filter the crab. The crab filtered me.', "Don't feed them after midnight. Feed them every chain day.",
    "This block's pets are extra fluffy. Low fees, high fluff.", 'KEVIN keeps staring at me. I respect that.', 'Some call it spam. I call it a hatchling.', "Wrap 'em gently. The Wojaks cry at bows.", "Nakamoto used to sleep in that cage. We don't talk about it."];
  var li = 0; function luke() { var b = $('shLuke'); if (b) b.textContent = '“' + LINES[li++ % LINES.length] + '”'; }

  var PAGE = 0, PER = 9;
  function render() { var root = $('shop'); if (!on()) { root.innerHTML = '<p class="sh-soon">The shop opens soon. Until then the cases hold card backs.</p><div class="sh-grid">' + '<div class="sh-card sh-back"></div>'.repeat(6) + '</div>'; return; }
    var b = TIP + 1, all = V.openListings(W, b).filter(function (S) { return S.seller !== ME; }).map(function (S) { return { p: W.byId[S.petId], S: S, buy: !V.buyGuard(W, S, BOOK, b, ME) }; }),
      fB = PF.load('binder'), fM = PF.load('mine'), xs = V.petFilter(W, all, fB, b), others = xs.map(function (x) { return x.S; }),
      mineAll = (W.listings || []).filter(function (S) { return S.seller === ME; }).map(function (S) { return { p: W.byId[S.petId], S: S }; }), mine = V.petFilter(W, mineAll, fM, b).map(function (x) { return x.S; }),
      pgs = Math.max(1, Math.ceil(others.length / PER));
    PAGE = Math.min(PAGE, pgs - 1); var pg = xs.slice(PAGE * PER, PAGE * PER + PER);
    root.innerHTML = '<div class="sh-bar"><button class="sh-btn" id="shSell">List my pet</button><span class="sh-hint">' + others.length + ' of ' + all.length + ' pet' + (all.length === 1 ? '' : 's') + ' in the binder · prices are exact amounts</span></div>' +
      '<div id="shBinF">' + PF.html(fB, BINDER_F, { species: PF.species(all.map(function (x) { return x.p; })), count: others.length, total: all.length }) + '</div>' +
      '<div class="sh-binder"><div class="sh-rings"></div><div class="sh-grid">' + (pg.map(function (x) { return card(x.p, x.S, '<button class="sh-btn sh-buy' + (x.buy ? '' : ' sh-later') + '" data-buy="' + x.S.n + '">' + (x.buy ? 'Buy' : 'Buy (wait)') + '</button>'); }).join('') || '<p class="sh-hint">' + (all.length ? 'No pets match these filters.' : 'The binder is empty.') + '</p>') + '</div>' +
      '<div class="sh-pager"><button class="sh-btn" id="shPrev"' + (PAGE ? '' : ' disabled') + '>◀</button> page ' + (PAGE + 1) + ' of ' + pgs + ' <button class="sh-btn" id="shNext"' + (PAGE < pgs - 1 ? '' : ' disabled') + '>▶</button></div></div>' +
      '<h2 class="sec">My listings</h2><div id="shMineF">' + PF.html(fM, ['state', 'sort'], { count: mine.length, total: mineAll.length }) + '</div><div class="sh-mine">' + (mine.map(function (S) { var p = W.byId[S.petId], stt = V.saleState(W, S, b);
        return '<div class="sh-row">' + card(p, S) + '<div class="sh-rinfo"><span class="sh-state sh-s-' + stt + '">' + ({ open: 'Active', expired: 'Expired', sold: 'Sold', 'void': 'Ended' })[stt] + '</span> Listing ' + S.n + '<br>Asks exactly ' + esc(V.saleAmountText(S.asset, S.price)) +
        (stt === 'open' ? '<br>Ends after block ' + S.expire.toLocaleString('en-US') + ' (' + (S.expire - TIP) + ' blocks left)<br>#' + p.id + ' is locked while listed.<br><button class="sh-btn" data-cancel="' + S.n + '">Cancel listing</button>'
          : stt === 'sold' ? '<br>Sold' + (S.soldBlock ? ' at block ' + Number(S.soldBlock).toLocaleString('en-US') : '') : stt === 'expired' ? '<br>Ended after block ' + S.expire.toLocaleString('en-US') + '. Nothing to cancel.' : '<br>The pet moved or died, so this listing ended.') +
        '</div></div>'; }).join('') || '<p class="sh-hint">' + (mineAll.length ? 'No listings match.' : 'You have no listings.') + '</p>') + '</div>';
    PF.bind($('shBinF'), fB, 'binder', function () { PAGE = 0; render(); }); PF.bind($('shMineF'), fM, 'mine', render);
    paint(); }

  /* ---- modal + wallet steps */
  function modal(h) { var m = $('shModal'); m.innerHTML = '<div class="box">' + h + '</div>'; m.style.display = 'flex'; m.onclick = function (e) { if (e.target === m || e.target.hasAttribute('data-close')) m.style.display = 'none'; }; return m; }
  function toast(h) { var t = $('toasts'); var d = document.createElement('div'); d.className = 'toast'; d.innerHTML = h; t.appendChild(d); setTimeout(function () { d.remove(); }, 6000); }
  function walletDex(plan, then) { if (PREVIEW) { toast('Preview: no wallet window, nothing was sent.'); return then && then({ txid: 'f00dbabe' + 'preview'.repeat(4) }); }
    window.V2Wallet.sendDex(plan, ME).then(function (r) { toast('Sent: ' + esc(plan.label)); if (then) then(r); }, function (e) { toast('Not sent: ' + esc(e.message || e)); }); }
  function walletBurn(plan, then) { if (PREVIEW) { toast('Preview: no wallet window, nothing was sent.'); return then && then({}); }
    window.V2Wallet.send(plan, ME).then(function (r) { toast('Sent: ' + esc(plan.label)); if (then) then(r); }, function (e) { toast('Not sent: ' + esc(e.message || e)); }); }
  var PK = 'xcpets-sale-pending'; function pend(v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(PK) || 'null'); if (v) localStorage.setItem(PK, JSON.stringify(v)); else localStorage.removeItem(PK); } catch (e) { } return null; }

  function sellPick() { var free = W.pets.filter(function (p) { return p.owner === ME && !V.saleWhy(W, { petId: p.id }, ME, TIP + 1); }), fS = PF.load('sell'),
      mine = V.petFilter(W, free.map(function (p) { return { p: p }; }), fS, TIP + 1).map(function (x) { return x.p; });
    var pd = pend(); var res = pd ? '<p class="sh-note">Window 1 for #' + pd.petId + ' was sent. <button class="sh-btn" id="shResume">Resume window 2 of 2</button></p>' : '';
    modal('<h3>List my pet</h3>' + res + '<p class="sh-hint">Pick a pet. Pets in a fight, a breed request, a Rug Me ad or a pending gift/swap are locked and are not shown.</p>' + PF.html(fS, PICK_F, { species: PF.species(free), count: mine.length, total: free.length }) + '<div class="sh-pick">' +
      (mine.map(function (p) { return '<button class="sh-pk" data-pick="' + p.id + '">' + card(p) + '</button>'; }).join('') || '<p>No free pets right now.</p>') + '</div><button class="sh-btn" data-close>Close</button>');
    document.querySelectorAll('[data-pick]').forEach(function (b) { b.onclick = function () { sellPrice(W.byId[b.getAttribute('data-pick')], 'XCPETS', 100); }; });
    if ($('shResume')) $('shResume').onclick = function () { sellBurn(pd); }; PF.bind($('shModal'), fS, 'sell', sellPick); }
  function sellPrice(p, asset, sticker) { var unit = asset === 'XCP' ? 1 : 1e8, ask = V.uniqueAsk(W, asset, Math.round(sticker * unit), TIP + 1), low = ask < V.SALE_MIN[asset] + 1;
    modal('<h3>List #' + p.id + '</h3><div class="sh-sellrow">' + card(p, { asset: asset, price: ask }) + '<div class="sh-form"><label>Paid in <select id="shAsset"><option' + (asset === 'XCPETS' ? ' selected' : '') + '>XCPETS</option><option' + (asset === 'XCP' ? ' selected' : '') + '>XCP</option></select></label>' +
      '<label>Price (' + (asset === 'XCP' ? 'sats' : 'XCPETS') + ') <input id="shSticker" type="number" min="1" step="1" value="' + sticker + '"></label>' +
      omLine(p) + '<p class="sh-exact">Exact amount: <b>' + esc(V.saleAmountText(asset, ask)) + '</b></p><p class="sh-hint">Every listing has its own exact amount, so the shop adds the smallest free extra (' + esc(asset === 'XCP' ? (ask - Math.round(sticker * unit)) + ' sats' : (ask - Math.round(sticker * unit)) + ' dander') + ').' +
      ' The listing lasts ' + V.SALE_EXPIRY + ' blocks. It only sells for exactly this amount; a partial fill is no sale.</p>' + (low ? '<p class="sh-warn">Minimum is 1 XCPETS or 1,000 sats.</p>' : '') +
      '<ol class="sh-steps"><li><b>Window 1 of 2:</b> a DEX order: give 1 ' + (asset === 'XCP' ? 'dander' : 'sat of XCP') + ', get ' + esc(V.saleAmountText(asset, ask)) + '.</li><li><b>Window 2 of 2:</b> a 1-dander burn that ties the order to #' + p.id + '.</li></ol>' +
      '<button class="sh-btn" id="shGo"' + (low ? ' disabled' : '') + '>Open window 1 of 2</button> <button class="sh-btn sh-ghost" data-close>Back</button></div></div>');
    var re = function () { sellPrice(p, $('shAsset').value, Number($('shSticker').value) || 0); };
    $('shAsset').onchange = re; $('shSticker').onchange = re;
    $('shGo').onclick = function () { walletDex(V.sellOrderPlan(p.id, asset, ask), function (r) { var pd = { petId: p.id, asset: asset, ask: ask, order: r.txid }; pend(pd); sellBurn(pd); }); }; }
  function sellBurn(pd) { var plan = V.sellBurnPlan(pd.petId, pd.order);
    modal('<h3>Window 2 of 2</h3><p>The DEX order for #' + pd.petId + ' was sent (' + esc(String(pd.order).slice(0, 8)) + '…).</p><p>Now burn 1 dander with the tag<br><code>' + esc(plan.tag) + '</code></p>' +
      '<p class="sh-hint">Send it within ' + V.SALE_ORDER_LAG + ' blocks of the order. Until it confirms, the pet is not listed.</p><button class="sh-btn" id="shGo2">Open window 2 of 2</button> <button class="sh-btn sh-ghost" data-close>Later</button>');
    $('shGo2').onclick = function () { walletBurn(plan, function () { pend(null); $('shModal').style.display = 'none'; }); }; }
  function buy(n) { var S = W.listings.filter(function (x) { return x.n === n; })[0], p = W.byId[S.petId], why = V.buyGuard(W, S, BOOK, TIP + 1, ME), gear = (p.gear || []).length;
    modal('<h3>Buy #' + p.id + '?</h3><div class="sh-sellrow">' + card(p, S) + '<div class="sh-form">' + omLine(p) + '<p>You pay exactly <b>' + esc(V.saleAmountText(S.asset, S.price)) + '</b> and get #' + p.id + (gear ? ' with its ' + gear + ' worn and bag gear' : ' and any worn and bag gear') + '.</p>' +
      '<p class="sh-hint">One wallet window: a DEX order that gives this amount and gets 1 ' + (S.give === 'XCP' ? 'sat of XCP' : 'dander') + '. It expires after 1 block. The pet moves to you when the match completes on chain.</p>' +
      (why ? '<p class="sh-warn">' + esc(why) + '</p>' : '<p class="sh-ok">Checked against the order book: this order fills listing ' + S.n + ' first and in full.</p>') +
      '<button class="sh-btn" id="shBuyGo"' + (why ? ' disabled' : '') + '>Open wallet window</button> <button class="sh-btn sh-ghost" data-close>Back</button></div></div>');
    if (!why) $('shBuyGo').onclick = function () { walletDex(V.buyPlan(S), function () { $('shModal').style.display = 'none'; }); }; }
  function cancel(n) { var S = W.listings.filter(function (x) { return x.n === n; })[0];
    modal('<h3>Cancel listing ' + S.n + '?</h3><p>One wallet window: a Counterparty cancel of the order ' + esc(String(S.order).slice(0, 8)) + '….</p><p class="sh-hint">#' + S.petId + ' stays locked until block ' + S.expire.toLocaleString('en-US') + ' (the shop can\'t read the cancel block yet), or until the cancel shows the order as cancelled.</p>' +
      '<button class="sh-btn" id="shCanGo">Open wallet window</button> <button class="sh-btn sh-ghost" data-close>Keep it listed</button>');
    $('shCanGo').onclick = function () { walletDex(V.cancelPlan(S), function () { $('shModal').style.display = 'none'; }); }; }

  document.addEventListener('click', function (e) { var t = e.target; if (!t.closest) return;
    if (t.id === 'shSell') sellPick(); else if (t.id === 'shPrev') { PAGE--; render(); } else if (t.id === 'shNext') { PAGE++; render(); }
    else if (t.closest('[data-buy]')) buy(Number(t.closest('[data-buy]').getAttribute('data-buy'))); else if (t.closest('[data-cancel]')) cancel(Number(t.closest('[data-cancel]').getAttribute('data-cancel'))); });
  function start() { load().then(function () { render(); luke(); setInterval(luke, 9000); }, function (e) { $('shop').innerHTML = '<p class="sh-warn">Could not read the order book: ' + esc(e.message || e) + '</p>'; }); }
  window.V2Sales.start = start; window.V2Sales.sample = sample;
  if (PREVIEW) start();
})();
