/* Doom Week (display only). One switch: ?doom=1 forces it on, ?doom=0 forces it off, otherwise it follows
 * the block window while ENABLED is true. Nothing here writes pet state, gear, rules or replay.
 * Turning it off removes the class, the layer and the swapped image srcs, so the original art is back.
 * Sabo (#1765) is never drawn in a grave. Players' own pet renders are not passed through DoomGear. */
(function () {
  'use strict';
  if (window.__dwLoaded) return; window.__dwLoaded = 1;
  /* Doom 2 (owner Nov 23 2026: "Id like to bring doom back", "On until I say stop"). Starts at 977,136 with no end block.
   * The first week (975,630 to 976,648) froze phones and swapped the token art; both are fixed below.
   * To stop it: set ENABLED to false here AND DOOM_ENABLED to false in js/v2-events.js, then bump v2-events.js ?v=. */
  var ENABLED = true, START = 977136, END = 99999999;
  var SABO_ID = 1765;
  var me = document.currentScript, ver = (me && /[?&]v=([\w.-]+)/.exec(me.src) || [])[1] || '';
  var root = document.documentElement, on = false, cssEl = null, layer = null, countEl = null, shopObs = null, cemObs = null, btcQuote = null, supplyLeft = null;
  function flag() { var m = /[?&]doom=([01])\b/.exec(location.search); return m ? m[1] : null; }
  function tip() { try { var M = window.V2Mock, s = M && M.state && M.state(); return s && s.tip ? s.tip : null; } catch (e) { return null; } }
  function inWindow(t) { return ENABLED && t != null && t >= START && t < END; }
  /* boot-look (Nov 26 2026): js/boot-look.js already put the look on before the first paint. Until the chain tip is known, trust it, so the
   * page never paints regular first and flips to Doom later (the "glitch"). Once the tip is known the block window decides, as before. */
  function booted() { return !!(window.XcpBootLook && XcpBootLook.doom); }
  function wanted() { var f = flag(); if (f === '1') return true; if (f === '0') return false; var t = tip(); return t == null ? ENABLED && booted() : inWindow(t); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function loadCss() { if (cssEl) return; cssEl = document.getElementById('dwCss'); if (cssEl) return; cssEl = document.createElement('link'); cssEl.id = 'dwCss'; cssEl.rel = 'stylesheet'; cssEl.href = 'css/doom-week.css' + (ver ? '?v=' + ver : ''); document.head.appendChild(cssEl); }
  function parseCoinbase(j) { var n = j && j.data && Number(j.data.amount); return n > 0 ? n : null; }
  function parseKraken(j) {
    var r = j && j.result; if (!r) return null;
    var row = r.XXBTZUSD || r.XBTUSD, n = row && row.c && Number(row.c[0]);
    return n > 0 ? n : null;
  }
  function parseSupply(j) { var raw = j && j.result && Number(j.result.supply); return raw > 0 ? raw / 1e8 : null; }
  var LAST_KEY = 'xcpets-doom-week-last', drops = { btc: false, supply: false };
  function money(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function shownUsd(n) { return Math.round(n); }
  function shownMillions(tokens) { return Math.round(tokens / 1e6 * 1000) / 1000; }
  function millionsText(tokens) { return (tokens / 1e6).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' million'; }
  function counterText(usd, tokens) { return '1 BTC: ' + money(usd) + ' · XCPETS left: ' + millionsText(tokens); }
  /* Arrow only when the number on screen is lower than the last live reading. First reading, a tie, and a rise get no arrow. */
  function downFlags(prev, usd, tokens) {
    if (!prev || !(prev.usd > 0) || !(prev.tokens > 0) || !(usd > 0) || !(tokens > 0)) return { btc: false, supply: false };
    return { btc: shownUsd(usd) < shownUsd(prev.usd), supply: shownMillions(tokens) < shownMillions(prev.tokens) };
  }
  function readLast() {
    try { var j = JSON.parse(localStorage.getItem(LAST_KEY) || 'null'); return j && j.usd > 0 && j.tokens > 0 ? j : null; } catch (e) { return null; }
  }
  function applyReading(usd, tokens) {
    var flags = downFlags(readLast(), usd, tokens);
    try { localStorage.setItem(LAST_KEY, JSON.stringify({ usd: usd, tokens: tokens })); } catch (e) {}
    return flags;
  }
  function arrow(show) { return show ? '<span class="dw-down" aria-hidden="true"></span>' : ''; }
  function counterHtml(usd, tokens, flags) {
    flags = flags || {};
    return '1 BTC: ' + money(usd) + arrow(flags.btc) + ' · XCPETS left: ' + millionsText(tokens) + arrow(flags.supply);
  }
  function getJson(url) { return fetch(url, { credentials: 'omit' }).then(function (r) { if (!r.ok) throw new Error('bad'); return r.json(); }); }
  function loadBtc() {
    return getJson('https://api.coinbase.com/v2/prices/BTC-USD/spot').then(function (j) {
      var n = parseCoinbase(j); if (!n) throw new Error('bad'); return { usd: n, source: 'coinbase' };
    }).catch(function () {
      return getJson('https://api.kraken.com/0/public/Ticker?pair=XBTUSD').then(function (j) {
        var n = parseKraken(j); return n ? { usd: n, source: 'kraken' } : null;
      }).catch(function () { return null; });
    });
  }
  function loadSupply() {
    var urls = ['https://node.xcpets.fun/v2/assets/XCPETS', 'https://api.xcp.fun/node/v2/assets/XCPETS'];
    function one(i) {
      if (i >= urls.length) return Promise.resolve(null);
      return getJson(urls[i]).then(function (j) { var n = parseSupply(j); if (!n) throw new Error('bad'); return { tokens: n, source: urls[i] }; }).catch(function () { return one(i + 1); });
    }
    return one(0);
  }
  function hideCount() { if (countEl && countEl.parentNode) countEl.parentNode.removeChild(countEl); countEl = null; }
  function paintCount() {
    if (!btcQuote || !supplyLeft) { hideCount(); return; }
    if (!countEl) {
      countEl = el('aside', 'dw-count');
      var main = document.querySelector('main'); if (main) main.insertBefore(countEl, main.firstChild); else document.body.appendChild(countEl);
    }
    countEl.setAttribute('aria-label', '1 BTC in dollars and XCPETS left');
    countEl.innerHTML = '<b class="dw-joke">' + counterHtml(btcQuote.usd, supplyLeft.tokens, drops) + '</b>';
  }
  var burnMemo = null;
  function burners() {
    var M = window.V2Mock, V = window.V2Rules; if (!M || !M.state || !V || !V.readBurns) return null;
    var st = M.state() || {}, rows = st.rows; if (!rows) return null;
    var key = rows.length + ':' + (st.tip || 0); if (burnMemo && burnMemo.key === key) return burnMemo.set;
    var set = {}, inWeek = [], i, b;
    /* Decode only the rows inside the week. Decoding every burn of the game on each new block froze phones. */
    for (i = 0; i < rows.length; i++) { b = rows[i] && rows[i].block_index; if (b >= START && b < END) inWeek.push(rows[i]); }
    V.readBurns(inWeek).forEach(function (r) {
      if (!r || !r.source || r.block_index < START || r.block_index >= END) return;
      if (st.tip != null && r.block_index > st.tip) return;
      set[r.source] = r.block_index;
    });
    burnMemo = { key: key, set: set }; return set;
  }
  /* Any real burn by that address inside the window. Pet 1765 is not drawn here and is not put in a grave. */
  function survived(addr) { if (!addr) return false; var set = burners(); return !!(set && set[addr]); }
  function chip() {
    return '<span class="dw-badge" role="img" aria-label="Survived Doom Week"><img src="img/doom/badge.png" alt="" width="32" height="32"><span>Survived Doom Week</span></span>';
  }
  var badgeKey = '';
  function paintBadge() {
    var preview = /[?&]doomBadge=1\b/.test(location.search), page = document.body.getAttribute('data-v2page') || '';
    var petPage = page === 'pet' || /pet\.html$/.test(location.pathname), key = 'off';
    var petShow = false, meShow = false, id = 0, owner = null;
    if (on && petPage) {
      id = +(new URLSearchParams(location.search).get('id') || 0);
      try { var w = window.V2Mock && V2Mock.peek && V2Mock.peek(); owner = w && w.byId && w.byId[id] && w.byId[id].owner; } catch (e) {} /* peek only: a full world build here froze the page */
      /* The chip is a burn record, not a grave. Pet 1765 is never drawn into the cemetery overlay. */
      petShow = id !== SABO_ID && (preview || survived(owner));
    }
    var meAddr = window.V2Mock && window.V2Mock.ME;
    if (on && ((meAddr && survived(meAddr)) || (preview && !petPage && (page === 'play' || page === 'front')))) meShow = true;
    var pageEl = document.getElementById('page'), shown = !!(pageEl && pageEl.style.display !== 'none' && !pageEl.hidden);
    key = (petShow ? 'p' : '') + (meShow ? 'm' : '') + (shown ? 'v' : 'h') + (owner || '') + (meAddr || '');
    if (key === badgeKey) return; badgeKey = key;
    document.querySelectorAll('.dw-badge').forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
    if (petShow) { var host = (shown && document.getElementById('stats')) || document.querySelector('main') || document.body; if (host) host.insertAdjacentHTML('afterbegin', chip()); }
    if (meShow) { var panel = document.getElementById('petsPanel') || document.querySelector('main'); if (panel) panel.insertAdjacentHTML(page === 'front' ? 'beforeend' : 'afterbegin', chip()); }
  }
  var SWAPS = [
    [/(?:^|\/)img\/theme\/sp-([a-z0-9-]+)\.png(?:\?.*)?$/, function (m) { return 'img/doom/sp-' + m[1] + '.png'; }],
    [/(?:^|\/)img\/xcpets-cast\.gif(?:\?.*)?$/, function () { return 'img/doom/xcpets-cast.gif'; }],
    [/(?:^|\/)img\/xcpets-cast\.webp(?:\?.*)?$/, function () { return 'img/doom/xcpets-cast.webp'; }],
    [/(?:^|\/)img\/logo\.png(?:\?.*)?$/, function () { return 'img/doom/logo.png'; }],
    [/(?:^|\/)img\/favicon\.png(?:\?.*)?$/, function () { return 'img/doom/favicon.png'; }]
  ];
  function destFor(url) { var i, m; for (i = 0; i < SWAPS.length; i++) { m = SWAPS[i][0].exec(url || ''); if (m) return SWAPS[i][1](m); } return null; }
  function swapAttr(node, attr) {
    var cur = node.getAttribute(attr); if (!cur || node.getAttribute('data-dw-' + attr)) return;
    var next = destFor(cur); if (!next || next === cur) return;
    node.setAttribute('data-dw-' + attr, cur); node.setAttribute(attr, next);
    if (attr === 'srcset' && /webp/.test(node.getAttribute('type') || '')) { node.setAttribute('data-dw-type', node.getAttribute('type')); node.setAttribute('type', 'image/webp'); }
  }
  function restoreAttr(node, attr) {
    var old = node.getAttribute('data-dw-' + attr); if (old == null) return;
    node.setAttribute(attr, old); node.removeAttribute('data-dw-' + attr);
    if (attr === 'srcset' && node.getAttribute('data-dw-type')) { node.setAttribute('type', node.getAttribute('data-dw-type')); node.removeAttribute('data-dw-type'); }
  }
  function swapShowcase(turn) {
    var nodes = document.querySelectorAll('img[src], source[srcset], link[rel~="icon"]');
    Array.prototype.forEach.call(nodes, function (n) {
      if (n.tagName === 'SOURCE') { if (turn) swapAttr(n, 'srcset'); else restoreAttr(n, 'srcset'); }
      else if (n.tagName === 'LINK') { if (turn) swapAttr(n, 'href'); else restoreAttr(n, 'href'); }
      else { if (turn) swapAttr(n, 'src'); else restoreAttr(n, 'src'); }
    });
    var note = 'shown without gear', doomNote = 'in the Doom Week look. Your own pets are not changed';
    Array.prototype.forEach.call(document.querySelectorAll('p'), function (p) {
      if (turn && p.innerHTML.indexOf(note) >= 0 && !p.getAttribute('data-dw-note')) { p.setAttribute('data-dw-note', '1'); p.setAttribute('data-dw-html', p.innerHTML); p.innerHTML = p.innerHTML.replace(note, doomNote); }
      else if (!turn && p.getAttribute('data-dw-note')) { p.innerHTML = p.getAttribute('data-dw-html'); p.removeAttribute('data-dw-note'); p.removeAttribute('data-dw-html'); }
    });
    try { if (window.XCPromo && XCPromo.redraw) XCPromo.redraw(); } catch (e) {}
  }
  function addLayer() {
    if (layer) return; layer = el('div', 'dw-layer'); layer.setAttribute('aria-hidden', 'true');
    var h = '', i; for (i = 0; i < 8; i++) h += '<i class="dw-stick dw-s' + i + '"></i>';
    for (i = 0; i < 14; i++) h += '<i class="dw-ash dw-a' + i + '"></i>';
    for (i = 0; i < 4; i++) h += '<i class="dw-arrow dw-r' + i + '"></i>';
    for (i = 0; i < 3; i++) h += '<i class="dw-chart dw-c' + i + '"></i>';
    layer.innerHTML = h; document.body.appendChild(layer);
  }
  function shopBits() {
    var stage = document.querySelector('#shScene .cs-stage') || document.getElementById('shScene'); if (!stage || document.querySelector('.dw-sale')) return;
    var sale = el('div', 'dw-sale'); sale.textContent = 'DOOM SALE';
    /* doom-board-overlap (owner Nov 24 2026: "overlap"): the floating DOOM tag on the shop sign is gone. On phones it grew over Luke's face,
     * and the shop canvas already paints its own DOOM board (js/v2-shop-scene.js doomBits). */
    var scene = document.getElementById('shScene'); if (scene) scene.insertBefore(sale, scene.firstChild); else stage.appendChild(sale);
  }
  function clearShop() { document.querySelectorAll('.dw-sale, .dw-sign').forEach(function (n) { n.parentNode.removeChild(n); }); if (shopObs) { shopObs.disconnect(); shopObs = null; } }
  function watchShop() {
    if (document.body.getAttribute('data-v2page') !== 'shop' && !/shop\.html$/.test(location.pathname)) return;
    shopBits();
    var box = document.getElementById('shScene'); if (!box || !window.MutationObserver || shopObs) return;
    shopObs = new MutationObserver(function () { shopBits(); }); shopObs.observe(box, { childList: true, subtree: true });
  }
  /* Extra fog and unlabeled red-candle stones. Not tied to a pet, so Sabo is never one of them. */
  function cemFx() {
    var box = document.getElementById('cemScene'); if (!box) return;
    var fx = box.querySelector('.dw-cemfx');
    if (!fx) {
      fx = el('div', 'dw-cemfx'); fx.setAttribute('aria-hidden', 'true');
      var h = '<div class="dw-fog dw-fog1"></div><div class="dw-fog dw-fog2"></div>';
      [[18, 62], [30, 70], [70, 58], [78, 74], [12, 78]].forEach(function (p) { h += '<i class="dw-stone" style="left:' + p[0] + '%;top:' + p[1] + '%"></i>'; });
      h += '<i class="dw-pennant dw-cempen"><b>DOOM</b></i><i class="dw-pchart dw-cemch"></i><i class="dw-parrow dw-cemar"></i>';
      fx.innerHTML = h;
    }
    /* Nov 23 2026 (players: 'the cemetery keeps timing out'): this ran from a watcher on #cemScene and moved the layer every time, even when
     * it already sat in place. Each move woke the watcher again, so the page froze for good. Move it only when it is not where it belongs. */
    var c = box.querySelector('canvas');
    if (c) { if (c.nextElementSibling !== fx) c.insertAdjacentElement('afterend', fx); }
    else if (fx.parentNode !== box) box.appendChild(fx);
  }
  function watchCem() {
    var box = document.getElementById('cemScene'); if (!box) return; cemFx();
    if (window.MutationObserver && !cemObs) { cemObs = new MutationObserver(function () { cemFx(); }); cemObs.observe(box, { childList: true }); }
  }
  function clearCem() { if (cemObs) { cemObs.disconnect(); cemObs = null; } document.querySelectorAll('.dw-cemfx').forEach(function (n) { n.parentNode.removeChild(n); }); }
  /* Every in-game place (js/v2-places.js). Decor is a child overlay, removed entirely when the switch is off.
   * Cemetery uses its own fog layer so Sabo is never one of the stones. Players' pets are not redrawn. */
  var PLACE_HOSTS = [
    { id: 'circus', sel: '.ar-scene', kind: 'scene' },
    { id: 'rare', sel: '#invPanel', kind: 'band' },
    { id: 'motel', sel: '#motelScene', kind: 'scene' },
    { id: 'spam', sel: '#shScene', kind: 'scene' },
    { id: 'raid', sel: '#raidPanel', kind: 'band' },
    { id: 'pantheon', sel: '#pantheon', kind: 'band' },
    { id: 'tokens', sel: '.tg8', kind: 'band' },
    { id: 'live', sel: '.livefeed', kind: 'band' }
  ];
  function placeHtml() {
    return '<i class="dw-pennant"><b>DOOM</b></i><i class="dw-pchart"></i><i class="dw-pchart dw-p2"></i><i class="dw-parrow"></i><i class="dw-parrow dw-a2"></i><i class="dw-ashbit"></i><i class="dw-ashbit dw-b2"></i>';
  }
  function watchPlaces() {
    PLACE_HOSTS.forEach(function (p) {
      var host = document.querySelector(p.sel); if (!host || host.querySelector('.dw-place')) return;
      var box = el('div', 'dw-place dw-' + p.kind + ' dw-' + p.id); box.setAttribute('aria-hidden', 'true'); box.innerHTML = placeHtml();
      host.appendChild(box);
    });
    document.querySelectorAll('#sceneCards .scard').forEach(function (card) {
      if (card.querySelector('.dw-cardfx')) return;
      var fx = el('span', 'dw-cardfx'); fx.setAttribute('aria-hidden', 'true'); fx.innerHTML = '<i class="dw-pennant"><b>DOOM</b></i><i class="dw-pchart"></i><i class="dw-parrow"></i>';
      card.appendChild(fx);
    });
  }
  function clearPlaces() {
    document.querySelectorAll('.dw-place, .dw-cardfx').forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
  }
  /* Doom on every page (owner Nov 23 2026: "can we add doom to everyplace on the game"). One sign per page, under the Town bar.
   * Display only: text and pixel art, nothing to click, no pet redrawn. Unknown pages get the generic sign. */
  var SIGNS = {
    'index.html': ['DOOM HAS ARRIVED', 'pets still hatch. candles still red.'],
    'play.html': ['MY PETS OF DOOM', 'feed them before the candles do'],
    'fight.html': ['X CIRCUS OF DOOM', 'sand, blood, red candles'],
    'rare-room.html': ['RARE ROOM OF DOOM', 'try on the drip. ignore the chart.'],
    'breed.html': ['NO-TAIL MOTEL OF DOOM', 'check in, panic out'],
    'shop.html': ['SPAM CITY DOOM SALE', 'everything must go (down)'],
    'raid.html': ['RAID BOSS OF DOOM', 'hit it before it dumps'],
    'cemetery.html': ['PET CEMETERY OF DOOM', 'rekt in pixels'],
    'pantheon.html': ['PANTHEON OF DOOM', '21 seats, 0 bids'],
    'tokens.html': ['PROOF PARADE OF DOOM', 'every token, still burning'],
    'live.html': ['LIVE FEED OF DOOM', 'what just dumped'],
    'ranking.html': ['RANKINGS OF DOOM', 'who survived the dip'],
    'hall-of-fame.html': ['HALL OF DOOM', 'legends never sell'],
    'pet.html': ['DOOM WATCH', 'hodl this pet tight'],
    'hybrids.html': ['HYBRIDS OF DOOM', 'two memes, one bad chart'],
    'pets.html': ['PET GUIDE OF DOOM', 'know your pets before the dip'],
    'tutorial.html': ['TUTORIAL OF DOOM', 'step one: do not panic sell'],
    'archive.html': ['ARCHIVE OF DOOM', 'they saw the candles first'],
    'inscriptions.html': ['INSCRIPTIONS OF DOOM', 'carved in red'],
    'petcoin.html': ['PETCOIN OF DOOM', 'a peer-to-peer electronic dip'],
    '': ['DOOM MODE', 'the candles are red. the pets are fine.']
  };
  function pageFile() { var f = (location.pathname || '').split('/').pop() || 'index.html'; return f; }
  function signHtml(t) {
    return '<img src="img/doom/doom-flag.png" alt="" width="32" height="32" class="dw-sflag"><span class="dw-stext"><b>' + t[0] + '</b><i>' + t[1] + '</i></span>' +
      '<i class="dw-pchart dw-schart"></i><i class="dw-parrow dw-sarrow"></i>';
  }
  function paintSign() {
    if (!on || document.querySelector('.dw-sign-page')) return;
    var f = pageFile(); if (/practice/i.test(f)) return;
    var t = SIGNS[f] || SIGNS[''], m = document.querySelector('main'); if (!m) return;
    var box = el('div', 'dw-sign-page'); box.setAttribute('role', 'img'); box.setAttribute('aria-label', t[0] + ': ' + t[1]); box.innerHTML = signHtml(t);
    var bar = document.getElementById('townBar');
    if (bar && bar.parentNode) bar.insertAdjacentElement('afterend', box);
    else if (countEl && countEl.parentNode === m) countEl.insertAdjacentElement('afterend', box);
    else m.insertBefore(box, m.firstChild);
  }
  function clearSign() { document.querySelectorAll('.dw-sign-page').forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); }); }
  function turnOn() {
    if (on) return; on = true; loadCss(); root.classList.add('dw'); addLayer(); swapShowcase(true); watchShop(); watchCem(); watchPlaces(); paintSign();
    if (!btcQuote) Promise.all([loadBtc(), loadSupply()]).then(function (pair) {
      btcQuote = pair[0]; supplyLeft = pair[1];
      if (btcQuote && supplyLeft) drops = applyReading(btcQuote.usd, supplyLeft.tokens);
      if (on) paintCount();
    });
    paintCount(); paintBadge();
  }
  function turnOff() {
    if (!on && !root.classList.contains('dw')) return; /* boot-look may have put the class + stylesheet on before this file ran */ cssEl = cssEl || document.getElementById('dwCss'); on = false; badgeKey = 'x'; root.classList.remove('dw');
    if (layer && layer.parentNode) layer.parentNode.removeChild(layer); layer = null;
    swapShowcase(false); clearShop(); clearCem(); clearPlaces(); clearSign();
    if (countEl && countEl.parentNode) countEl.parentNode.removeChild(countEl); countEl = null;
    paintBadge();
    if (cssEl && cssEl.parentNode) cssEl.parentNode.removeChild(cssEl); cssEl = null;
  }
  function apply() { if (wanted()) turnOn(); else turnOff(); }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) apply(); });
  setInterval(function () { if (!on && flag() === null) apply(); if (on) { paintCount(); paintBadge(); watchPlaces(); watchCem(); paintSign(); } }, 2500);
  function start() { apply(); }
  window.XCDoomWeek = {
    ENABLED: ENABLED, START: START, END: END, SABO_ID: SABO_ID, inWindow: inWindow, wanted: wanted, isOn: function () { return on; }, showcaseOn: function () { return on; },
    PLACES: ['circus', 'rare', 'motel', 'spam', 'raid', 'cemetery', 'pantheon', 'tokens', 'live'],
    parseCoinbase: parseCoinbase, parseKraken: parseKraken, parseSupply: parseSupply, counterText: counterText, downFlags: downFlags, counterHtml: counterHtml, survivedAddr: function (addr, rows, at) {
      var V = window.V2Rules; if (!V || !V.readBurns) return false;
      return V.readBurns(rows || []).some(function (r) { return r && r.source === addr && r.block_index >= START && r.block_index < END && (at == null || r.block_index <= at); });
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
