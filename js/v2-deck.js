/* pet-decks (PREVIEW): deck.html. A player connects XCP Wallet (connect only: it reads the address and never asks to sign),
 * picks up to 52 of the pets that wallet owns, and sees the deck: fronts plus the ONE shared back whose small QR opens
 * deck.html?a=<address>. Ordering goes through a STUB of The Game Crafter API (js/deck-tgc-stub.js): nothing is sent, nothing charged.
 * Pets come from the same in-browser replay as every other page (V2Mock.world), sprites from V2Render.petFrames. No rule change.
 * The deck list is kept in this browser (localStorage) for the preview; a real deck record is an open question (see the preview README). */
(function () {
  'use strict';
  var MAX = 52, PAGE = 60, SITE = 'https://xcpets.fun/deck.html?a=', KEY = 'xcpets-deck:';
  var TIERS = ['common', 'uncommon', 'rare', 'legendary'];
  var CHARGE = (window.XCPETS_DECK && +window.XCPETS_DECK.chargeUSD) || null;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var q = new URLSearchParams(location.search), st = { me: null, addr: null, w: null, owned: [], sel: [], shown: PAGE, find: '', sort: 'score', suggested: false, step: 0, ship: {} };
  function validAddr(a) { if (!a) return false; try { if (window.V2Wallet && V2Wallet.validAddr) return !!V2Wallet.validAddr(a); } catch (e) {} return /^(bc1[02-9ac-hj-np-z]{11,71}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(a); }
  function short(a) { return a && a.length > 16 ? a.slice(0, 8) + '…' + a.slice(-6) : (a || ''); }
  function usd(n) { return '$' + (+n).toFixed(0); }
  function score(p) { try { var r = PetScore.of(st.w, p); return r ? r.score : 0; } catch (e) { return 0; } }
  function power(p) { try { return V2Rules.petPower(p) || 0; } catch (e) { return 0; } }
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  function load(a) { try { var l = JSON.parse(localStorage.getItem(KEY + a) || 'null'); return Array.isArray(l) ? l : null; } catch (e) { return null; } }
  function save() { if (st.me && st.me === st.addr) try { localStorage.setItem(KEY + st.addr, JSON.stringify(st.sel)); } catch (e) {} }
  function mine() { return !!st.me && st.me === st.addr; }

  /* ---------- pets ---------- */
  function ownedBy(a) {
    var w = st.w, l = (w.pets || []).filter(function (p) { return p.owner === a && !p.dead && !p.released; });
    var sc = {}; l.forEach(function (p) { sc[p.id] = score(p); });
    st.sc = sc;
    return l.sort(function (x, y) { return sc[y.id] - sc[x.id] || x.id - y.id; });
  }
  function byId(id) { return st.w && st.w.byId ? st.w.byId[id] : null; }
  function topPick() { return st.owned.slice(0, MAX).map(function (p) { return p.id; }); }
  function speciesPick() { var seen = {}, out = []; st.owned.forEach(function (p) { if (!seen[p.species] && out.length < MAX) { seen[p.species] = 1; out.push(p.id); } }); return out; }

  /* ---------- sprites (drawn only when the card scrolls into view) ---------- */
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); draw(e.target); } }); }, { rootMargin: '200px' }) : null;
  function draw(cv) {
    var p = byId(+cv.getAttribute('data-id')); if (!p || !window.V2Render) return;
    try { var f = (V2Render.petFrames(p, st.w) || [])[0]; if (!f) return; cv.width = f.width; cv.height = f.height; var c = cv.getContext('2d'), d = c.createImageData(f.width, f.height); d.data.set(f.data); c.putImageData(d, 0, 0); } catch (e) { cv.classList.add('dk-noart'); }
  }
  function watch(root) { root.querySelectorAll('canvas[data-id]').forEach(function (cv) { if (io) io.observe(cv); else draw(cv); }); }
  function cardHtml(p, opts) {
    var t = TIERS[p.tier] || 'common', on = opts && opts.on;
    return '<div class="dk-card t-' + t + (on ? ' on' : '') + '" data-id="' + p.id + '"' + (opts && opts.pick ? ' role="checkbox" tabindex="0" aria-checked="' + !!on + '"' : '') + '>' +
      '<div class="dk-top"><b>' + esc(p.name || ('Pet #' + p.id)) + '</b><span>#' + p.id + '</span></div>' +
      '<canvas data-id="' + p.id + '" width="32" height="32" aria-label="' + esc(p.name || '') + '"></canvas>' +
      '<div class="dk-sub"><i class="dk-tier">' + t.toUpperCase() + '</i> ' + esc(cap(p.species)) + (p.stageName ? ' · ' + esc(p.stageName) : '') + '</div>' +
      '<div class="dk-st"><span>POWER ' + power(p) + '</span><span>SCORE ' + (st.sc && st.sc[p.id] != null ? st.sc[p.id] : score(p)) + '</span></div>' +
      (opts && opts.pick ? '<span class="dk-tick" aria-hidden="true">' + (on ? '✓' : '+') + '</span>' : '') + '</div>';
  }

  /* ---------- the shared back ---------- */
  function qrCanvas(url, px) {
    var cv = document.createElement('canvas'); if (!window.qrcode) return cv;
    var qr = qrcode(6, 'M'); qr.addData(url, 'Byte'); qr.make(); var n = qr.getModuleCount(), b = 2, m = px || 4;
    cv.width = cv.height = (n + 2 * b) * m; var c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height); c.fillStyle = '#0e0b16';
    for (var r = 0; r < n; r++) for (var k = 0; k < n; k++) if (qr.isDark(r, k)) c.fillRect((k + b) * m, (r + b) * m, m, m);
    cv.className = 'dk-qr'; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'QR code: ' + url); return cv;
  }
  function paintBack() {
    var box = $('dkBack'); if (!box) return; var url = SITE + encodeURIComponent(st.addr);
    box.innerHTML = '<div class="dk-backcard"><img src="img/logo.png" alt="" width="96" height="96"><b class="dk-bt">XCPETS</b><span class="dk-bs">PET DECK</span><span class="dk-bl">pets on Bitcoin · xcpets.fun</span><span class="dk-qrslot"></span><span class="dk-scan">SCAN · MY DECK</span></div>' +
      '<div class="dk-backtxt"><b>One back for the whole deck.</b> Every card has this same back, so nobody can tell cards apart from behind. The small QR (0.45 in, 11.4 mm on the card) opens this page: <a href="' + esc('deck.html?a=' + encodeURIComponent(st.addr)) + '">' + esc(SITE + short(st.addr)) + '</a></div>';
    box.querySelector('.dk-qrslot').appendChild(qrCanvas(url, 4));
  }

  /* ---------- page ---------- */
  function paintWho() {
    var w = $('dkWho');
    if (!st.addr) { w.innerHTML = '<p>Connect your wallet to build a deck from the pets you own, or open someone\'s deck from the QR on their cards.</p>'; return; }
    w.innerHTML = '<p><b>' + (mine() ? 'Your deck' : 'Deck of ' + esc(short(st.addr))) + '</b> · wallet <code>' + esc(short(st.addr)) + '</code> · ' + st.owned.length + ' living pet' + (st.owned.length === 1 ? '' : 's') + (mine() ? '' : (st.me ? ' · you are connected as <code>' + esc(short(st.me)) + '</code>' : '')) + '</p>';
  }
  function paintDeck() {
    var pets = st.sel.map(byId).filter(Boolean), g = $('dkDeck'), n = pets.length;
    $('dkCount').textContent = n + ' / ' + MAX + ' pets · ' + (n + 2) + ' cards with the title and rules cards';
    $('dkNote').innerHTML = st.suggested ? 'No deck saved for this wallet on this device yet, so this shows its top ' + Math.min(MAX, st.owned.length) + ' pets by Pet Score.' : '';
    g.innerHTML = n ? pets.map(function (p) { return cardHtml(p); }).join('') : '<p class="muted">No pets in the deck yet.' + (mine() ? ' Pick some below.' : '') + '</p>';
    watch(g); paintBack();
    $('dkOrderBtn').hidden = !mine(); $('dkOrderBtn').disabled = !n;
    $('dkNotMine').hidden = mine() || !st.addr;
  }
  function list() {
    var f = st.find.trim().toLowerCase(), l = st.owned;
    if (f) l = l.filter(function (p) { return String(p.id) === f.replace('#', '') || String(p.name || '').toLowerCase().indexOf(f) >= 0 || String(p.species || '').indexOf(f) >= 0; });
    if (st.sort === 'power') l = l.slice().sort(function (a, b) { return power(b) - power(a) || a.id - b.id; });
    else if (st.sort === 'new') l = l.slice().sort(function (a, b) { return b.id - a.id; });
    return l;
  }
  function paintPick() {
    var sec = $('dkPickSec'); sec.hidden = !mine(); if (!mine()) return;
    var l = list(), on = {}; st.sel.forEach(function (id) { on[id] = 1; });
    $('dkPickInfo').textContent = l.length + ' of your ' + st.owned.length + ' pets' + (st.sel.length >= MAX ? ' · the deck is full (52)' : '');
    var g = $('dkPick'); g.innerHTML = l.slice(0, st.shown).map(function (p) { return cardHtml(p, { pick: 1, on: on[p.id] }); }).join('');
    watch(g); $('dkMore').hidden = l.length <= st.shown; $('dkMore').textContent = 'Show ' + Math.min(PAGE, l.length - st.shown) + ' more';
  }
  function toggle(id) {
    var i = st.sel.indexOf(id);
    if (i >= 0) st.sel.splice(i, 1); else if (st.sel.length < MAX) st.sel.push(id); else { flash('The deck holds 52 pets. Take one out first.'); return; }
    st.suggested = false; save(); paintDeck(); paintPick();
  }
  function flash(t) { var e = $('dkFlash'); e.textContent = t; e.hidden = false; clearTimeout(flash.t); flash.t = setTimeout(function () { e.hidden = true; }, 2600); }
  function open(a) {
    st.addr = a; st.owned = ownedBy(a); var s = load(a), own = {}; st.owned.forEach(function (p) { own[p.id] = 1; });
    var gone = 0; if (s) { st.sel = s.filter(function (id) { if (own[id]) return true; gone++; return false; }).slice(0, MAX); }
    st.suggested = !s; if (!s) st.sel = topPick();
    if (gone) flash(gone + ' pet' + (gone === 1 ? ' has' : 's have') + ' left this wallet since the deck was saved, so ' + (gone === 1 ? 'it was' : 'they were') + ' taken out.');
    if (mine() && !s) { st.suggested = false; save(); }
    st.shown = PAGE; $('dkMain').hidden = false; paintWho(); paintDeck(); paintPick();
    try { var u = new URL(location.href); u.searchParams.set('a', a); history.replaceState(null, '', u.pathname + u.search); } catch (e) {}
  }
  function connect() {
    var b = $('dkConnect'), err = $('dkErr'); err.textContent = ''; b.disabled = true; b.textContent = 'Connecting…';
    if (!window.V2Wallet || !V2Wallet.getWallet) { err.textContent = 'Wallet code did not load. Refresh the page.'; b.disabled = false; return; }
    V2Wallet.getWallet().then(function (x) {
      st.me = x.address; b.textContent = 'Connected: ' + short(st.me); b.className = 'btn ghost';
      whenWorld(function () { if (!q.get('a') || q.get('a') === st.me || !st.addr) open(st.me); else { paintWho(); paintDeck(); paintPick(); } });
    }).catch(function (e) { b.disabled = false; b.textContent = 'Connect XCP Wallet'; if (e && e.html) err.innerHTML = e.html; else err.textContent = (e && e.message) || 'Could not connect.'; });
  }

  /* ---------- order flow (stub) ---------- */
  var FIELDS = [['name', 'Full name', 'text', 1], ['address1', 'Street address', 'text', 1], ['address2', 'Apartment, suite (optional)', 'text', 0], ['city', 'City', 'text', 1], ['state', 'State / region', 'text', 0], ['postal_code', 'Postal code', 'text', 1], ['country', 'Country (2 letters, like US)', 'text', 1], ['email', 'Email for shipping updates', 'email', 1]];
  function steps() { return ['Check the deck', 'Ship to', 'Review', 'Order sent (stub)'].map(function (t, i) { return '<li class="' + (i === st.step ? 'now' : i < st.step ? 'done' : '') + '">' + (i + 1) + '. ' + t + '</li>'; }).join(''); }
  function paintOrder() {
    var o = $('dkOrder'), n = st.sel.length, body = '';
    if (st.step === 0) body = '<p><b>' + (n + 2) + ' cards</b>: ' + n + ' pet' + (n === 1 ? '' : 's') + ', one title card and one rules card. Poker size (2.5 by 3.5 in), printed by The Game Crafter, in a tuck box.</p>' +
      '<p>Every card has the same back with your deck QR.</p>' + (n < MAX ? '<p class="muted small">Your deck has room for ' + (MAX - n) + ' more pets. A shorter deck is fine.</p>' : '') +
      '<div class="dk-mini">' + st.sel.slice(0, 14).map(function (id) { var p = byId(id); return p ? '<canvas data-id="' + id + '" width="32" height="32" title="' + esc(p.name) + '"></canvas>' : ''; }).join('') + (n > 14 ? '<span>+' + (n - 14) + ' more</span>' : '') + '</div>' +
      '<p><button class="btn" type="button" data-go="1">Next: ship to</button> <button class="btn ghost" type="button" data-close>Back to the deck</button></p>';
    if (st.step === 1) body = '<form id="dkShip" class="dk-form" novalidate>' + FIELDS.map(function (f) { return '<label><span>' + f[1] + '</span><input name="' + f[0] + '" type="' + f[2] + '" autocomplete="' + ({ name: 'name', address1: 'address-line1', address2: 'address-line2', city: 'address-level2', state: 'address-level1', postal_code: 'postal-code', country: 'country', email: 'email' })[f[0]] + '"' + (f[3] ? ' required' : '') + ' value="' + esc(st.ship[f[0]] || '') + '"></label>'; }).join('') +
      '<p class="muted small">Preview: this address stays in this page. Nothing is saved or sent.</p><p id="dkShipErr" class="dk-err"></p><p><button class="btn" type="submit">Next: review</button> <button class="btn ghost" type="button" data-go="0">Back</button></p></form>';
    if (st.step === 2) body = '<table class="dk-sum"><tr><td>Deck</td><td>' + (n + 2) + ' cards, tuck box, one shared back</td></tr><tr><td>Ship to</td><td>' + esc([st.ship.name, st.ship.city, st.ship.country].filter(Boolean).join(', ')) + '</td></tr>' +
      '<tr><td>Deck charge</td><td><b>' + (CHARGE ? usd(CHARGE) : 'not set') + '</b></td></tr><tr><td>Shipping and tax</td><td>worked out at checkout from the address (not wired up in this preview)</td></tr><tr><td>Paying</td><td>not built yet: how players pay is still an open question</td></tr></table>' +
      '<p class="dk-pv">PREVIEW: pressing the button below runs a <b>stub</b> of the order. No request goes to The Game Crafter, nothing is charged and your wallet is never asked to sign.</p>' +
      '<p><button class="btn" type="button" id="dkPlace">Place order (preview)</button> <button class="btn ghost" type="button" data-go="1">Back</button></p>';
    if (st.step === 3) body = '<ol id="dkLog" class="dk-log"></ol><div id="dkDone" class="dk-done" hidden></div>';
    o.innerHTML = '<h2 class="sec" data-ico="gear">Order a printed deck <small class="dk-tag">PREVIEW</small></h2><ol class="dk-steps">' + steps() + '</ol>' + body;
    watch(o); o.hidden = false;
    var f = $('dkShip'); if (f) f.onsubmit = function (e) {
      e.preventDefault(); var miss = []; FIELDS.forEach(function (x) { var v = (f.elements[x[0]].value || '').trim(); st.ship[x[0]] = v; if (x[3] && !v) miss.push(x[1]); });
      if (!miss.length && !/^[A-Za-z]{2}$/.test(st.ship.country)) miss.push('Country as 2 letters'); if (!miss.length && !/^\S+@\S+\.\S+$/.test(st.ship.email)) miss.push('A valid email');
      if (miss.length) { $('dkShipErr').textContent = 'Please fill in: ' + miss.join(', ') + '.'; return; } st.step = 2; paintOrder();
    };
    var pl = $('dkPlace'); if (pl) pl.onclick = place;
  }
  function place() {
    st.step = 3; paintOrder(); var log = $('dkLog');
    var deck = { address: st.addr, pets: st.sel.map(function (id) { var p = byId(id); return { id: id, name: p && p.name }; }), chargeUSD: CHARGE };
    DeckTGC.run(deck, st.ship, function (s, i, r) { var li = document.createElement('li'); li.innerHTML = '<code>' + esc(s.method + ' ' + s.url.replace('https://www.thegamecrafter.com', '')) + '</code> ' + esc(s.what) + ' <span class="dk-stub">stub, not sent · ' + esc(r.id) + '</span>'; log.appendChild(li); }, window.__deckStubDelay)
      .then(function (r) { var d = $('dkDone'); d.hidden = false; d.innerHTML = '<b>Preview only: no order was placed.</b> Nothing went to The Game Crafter and nothing was charged. Reference <code>' + esc(r.order) + '</code> · ' + r.cardCount + ' cards · deck charge ' + (r.chargeUSD ? usd(r.chargeUSD) : 'not set') + '.<p><button class="btn ghost" type="button" data-close>Back to the deck</button></p>'; });
  }

  /* ---------- wiring ---------- */
  function whenWorld(fn) {
    (function poll() { var w = window.V2Mock && V2Mock.world && V2Mock.world(); if (w && w.pets && w.pets.length && window.V2Render && window.PetScore) { st.w = w; $('dkLoad').hidden = true; return fn(); } setTimeout(poll, 300); })();
  }
  function init() {
    $('dkConnect').onclick = connect;
    if (CHARGE) $('dkCharge').textContent = usd(CHARGE);
    $('dkView').onsubmit = function (e) { e.preventDefault(); var a = this.elements.a.value.trim(); if (!validAddr(a)) { $('dkErr').textContent = 'That does not look like a Bitcoin address.'; return; } $('dkErr').textContent = ''; whenWorld(function () { open(a); }); };
    $('dkFind').oninput = function () { st.find = this.value; st.shown = PAGE; paintPick(); };
    $('dkSort').onchange = function () { st.sort = this.value; paintPick(); };
    $('dkMore').onclick = function () { st.shown += PAGE; paintPick(); };
    $('dkTop').onclick = function () { st.sel = topPick(); st.suggested = false; save(); paintDeck(); paintPick(); };
    $('dkSpecies').onclick = function () { st.sel = speciesPick(); st.suggested = false; save(); paintDeck(); paintPick(); };
    $('dkClear').onclick = function () { st.sel = []; st.suggested = false; save(); paintDeck(); paintPick(); };
    $('dkPick').onclick = function (e) { var c = e.target.closest('.dk-card'); if (c) toggle(+c.getAttribute('data-id')); };
    $('dkPick').onkeydown = function (e) { if (e.key !== 'Enter' && e.key !== ' ') return; var c = e.target.closest('.dk-card'); if (c) { e.preventDefault(); toggle(+c.getAttribute('data-id')); } };
    $('dkOrderBtn').onclick = function () { if (!mine() || !st.sel.length) return; st.step = 0; paintOrder(); $('dkOrder').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    $('dkOrder').addEventListener('click', function (e) { var g = e.target.closest('[data-go]'); if (g) { if (st.step === 1) { var f = $('dkShip'); if (f) FIELDS.forEach(function (x) { st.ship[x[0]] = (f.elements[x[0]].value || '').trim(); }); } st.step = +g.getAttribute('data-go'); paintOrder(); } if (e.target.closest('[data-close]')) { $('dkOrder').hidden = true; $('dkDeckSec').scrollIntoView({ block: 'start' }); } });
    var a = q.get('a'); if (a && validAddr(a)) whenWorld(function () { if (!st.addr) open(a); }); else if (a) $('dkErr').textContent = 'The address in this link does not look right.';
  }
  window.V2Deck = { open: open, state: function () { return st; }, MAX: MAX };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
