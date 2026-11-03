/* voting-day (owner Nov 2 2026 [pt2685u]: "a new one for voting day tomorrow"). DISPLAY ONLY: no rule, burn, replay or data change.
 * Same mechanism as js/halloween.js. US Election Day is Tuesday, Nov 3, 2026. STRICTLY NONPARTISAN: 'I Voted' stickers, ballot boxes,
 * red-white-blue bunting and pets wearing sticker badges. No candidates, parties, party colours as a theme, slogans or politics.
 * FUNTRUMP (the in-game community pet, owner request) appears as a game pet only: hoodie look, I Voted sticker, a "Go vote!" bubble on Home.
 * ON:  exactly 12:00 AM Central on Nov 3, 2026 (2026-11-03T06:00Z, CST) for everyone, wherever they are.
 * OFF: by itself at the end of Nov 3 Central (2026-11-04T06:00Z, exclusive, so the last moment on is 11:59:59 PM CT). A page left open across
 * either edge flips at that moment (one timer, re-armed daily; also re-checked when a sleeping tab becomes visible).
 * Cards, as Halloween got after calm-first-screen (Nov 1): the seasonal CARDS (banner, Home card, sprite rows, pet tile and the sticker on the pet's
 * portrait) are dated to the day itself and end at CARD_END; the ambient layer (bunting, header ballot box, drifting stars, FUNTRUMP on the bunting)
 * runs to END. Voting day is one day, so CARD_END = END: both go at 12:00 AM CT Nov 4.
 * ?votingday=1 forces it on (previews), ?votingday=0 forces it off. Nothing is stored except the banner's "Dismiss" (localStorage).
 * When off this file does nothing else: no CSS is fetched and no element is added. When on it loads css/voting-day.css (same ?v= as this file).
 * Perf: CSS transform/opacity animations only, no requestAnimationFrame, no canvas; prefers-reduced-motion = everything still. */
(function () {
  'use strict';
  if (window.__vdLoaded) return; window.__vdLoaded = 1;
  var START = new Date(Date.UTC(2026, 10, 3, 6, 0, 0)), END = new Date(Date.UTC(2026, 10, 4, 6, 0, 0)); /* fixed UTC instants (CST = UTC-6 after the Nov 1 DST change); END is exclusive */
  var CARD_END = END;
  var BANNER_KEY = 'xcpets-votingday-2026-banner-hidden';
  var me = document.currentScript, ver = (me && /[?&]v=([\w.-]+)/.exec(me.src) || [])[1] || '';
  function flag() { var m = /[?&]votingday=([01])\b/.exec(location.search); return m ? m[1] : null; }
  function inWindow(now) { return now >= START && now < END; }
  function wanted() { var f = flag(); return f === '1' ? true : f === '0' ? false : inWindow(new Date()); }
  function cardsOn() { return flag() === '1' || new Date() < CARD_END; }
  var root = document.documentElement, on = false, cssEl = null, layer = null, banner = null;

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function loadCss() { if (cssEl) return; cssEl = document.createElement('link'); cssEl.rel = 'stylesheet'; cssEl.href = 'css/voting-day.css' + (ver ? '?v=' + ver : ''); document.head.appendChild(cssEl); }
  function page() { return document.body.getAttribute('data-v2page') || ''; }
  function isHome() { return /^(home|front)$/.test(page()) || /(^\/$|index\.html$)/.test(location.pathname); }

  /* 8-bit sprites: empty aria-hidden tags drawn by css/voting-day.css; pets are the real game sprites (img/theme, FUNTRUMP from js/funtrump-sprite.js) */
  function pet(sp) { return '<span class="vd-pet"><img src="img/theme/sp-' + sp + '.png" alt="" width="32" height="32" loading="lazy"><i class="vd-stk"></i></span>'; }
  var FT = '<span class="vd-pet vd-ft"><i class="vd-fts"></i><i class="vd-stk"></i></span>';
  var S = { box: '<i class="vd-s vd-box"></i>', box2: '<i class="vd-s vd-box vd-drop"></i>', stk: '<i class="vd-s vd-bigstk"></i>', star: '<i class="vd-s vd-star"></i>',
    starr: '<i class="vd-s vd-star vd-r"></i>', starb: '<i class="vd-s vd-star vd-b"></i>', ft: FT,
    doge: pet('doge'), bobo: pet('bobo'), mumu: pet('mumu'), peepo: pet('peepo'), pepe: pet('pepe'), snibby: pet('snibby'), wojak: pet('wojak'), kevin: pet('kevin') };
  /* rows are their own block between sections (never on top of a card); on phones the CSS hides items past the 7th */
  var ROWS = [['box', 'doge', 'starr', 'stk', 'bobo', 'star', 'box2', 'mumu', 'starb', 'peepo', 'box'],
    ['ft', 'box2', 'starb', 'pepe', 'stk', 'star', 'snibby', 'box', 'starr', 'wojak'],
    ['stk', 'kevin', 'box', 'starr', 'doge', 'star', 'box2', 'mumu', 'starb', 'stk']];
  function row(n) { var r = el('div', 'vd-row vd-row' + n); r.setAttribute('aria-hidden', 'true');
    r.innerHTML = ROWS[n % ROWS.length].map(function (k) { return S[k]; }).join(''); return r; }
  function addRows() {
    if (document.querySelector('.vd-row')) return; var main = document.querySelector('main'), n = 0;
    function before(t) { if (t && t.parentNode) t.parentNode.insertBefore(row(n++), t); }
    if (main) { var c = main.querySelector(':scope > .vd-card'); if (c) c.insertAdjacentElement('afterend', row(n++)); else if (main.firstElementChild) before(main.firstElementChild); else main.appendChild(row(n++)); }
    before(document.getElementById('cast'));
    /* inside the top of the community pet and My Pets panels; the community panel gets the FUNTRUMP row (he is the community pet) */
    [['communityPanel', 1], ['petsPanel', 2]].forEach(function (a) { var e = document.getElementById(a[0]); if (e) { var r = row(a[1]); r.classList.add('vd-row-in'); e.insertBefore(r, e.firstChild); } });
  }
  function addLayer() {
    if (layer) return;
    layer = el('div', 'vd-layer'); layer.setAttribute('aria-hidden', 'true');
    var h = '<div class="vd-glow"></div>';
    for (var i = 1; i <= 6; i++) h += '<div class="vd-sw vd-sw' + i + '"><i class="vd-star' + (i % 3 === 1 ? ' vd-r' : i % 3 === 2 ? ' vd-b' : '') + '"></i></div>';
    /* FUNTRUMP waving from the bunting (wide screens only, in the empty margin right of the content) */
    h += '<div class="vd-hang"><i class="vd-hbunt"></i>' + FT + '</div>';
    layer.innerHTML = h; document.body.appendChild(layer);
  }
  /* Home: the voting day card. FUNTRUMP with his I Voted sticker next to a ballot box, saying "Go vote!" (no candidate, party or slogan) */
  function card() {
    if (!isHome() || document.querySelector('.vd-card')) return;
    var d = el('section', 'vd-card'); d.setAttribute('aria-label', 'Election Day, Tuesday Nov 3, 2026');
    d.innerHTML = '<div class="vd-scene" aria-hidden="true"><i class="vd-cbunt"></i><div class="vd-stage">' + S.box2 +
      '<div class="vd-ftwrap"><span class="vd-bub">Go vote!</span>' + FT + '</div>' + pet('doge') + pet('mumu') + '</div></div>' +
      '<div class="vd-card-t"><div class="vd-k">Tuesday, Nov 3, 2026</div><div class="vd-h">🗳️ Happy Election Day!</div>' +
      '<div class="vd-a">FUNTRUMP says <b>Go vote!</b> Every pet is wearing its I Voted sticker today.</div></div>';
    var main = document.querySelector('main'); if (main) main.insertBefore(d, main.firstChild); else document.body.appendChild(d);
  }
  /* pet pages: an I Voted sticker on the pet's portrait + a small tile under Gear (nothing is granted, nothing changes on the pet) */
  function petBits() {
    if (document.body.getAttribute('data-v2page') !== 'pet' && !/pet\.html$/.test(location.pathname)) return;
    var art = document.querySelector('#pcFront .pc-art'); if (art && !art.querySelector('.vd-pstk')) { var s = el('i', 'vd-pstk'); s.setAttribute('aria-hidden', 'true'); art.appendChild(s); art.classList.add('vd-art'); }
    var g = document.getElementById('gear'); if (!g || document.querySelector('.vd-tile')) return;
    var t = el('div', 'vd-tile'); t.innerHTML = '<i class="vd-s vd-bigstk" aria-hidden="true"></i><div><b>🗳️ I Voted sticker</b> <span class="vd-tag">decor · just for today</span>' +
      '<div class="small">Every pet wears one on Election Day, Tue Nov 3. Not gear: nothing is granted and no stats change.</div></div>';
    g.insertAdjacentElement('afterend', t);
  }
  function addBanner() {
    if (banner) return; try { if (localStorage.getItem(BANNER_KEY) === '1') return; } catch (e) { /* private mode: just show it */ }
    banner = el('div', 'vd-banner'); banner.setAttribute('role', 'note');
    banner.innerHTML = '<i class="vd-s vd-box" aria-hidden="true"></i><i class="vd-s vd-bigstk" aria-hidden="true"></i><span class="vd-bt">🗳️ Happy Election Day (Tue Nov 3)! Every pet is wearing its I Voted sticker today.</span>' +
      '<button type="button" class="vd-bx" aria-label="Dismiss the Election Day banner">Dismiss</button><i class="vd-s vd-bigstk" aria-hidden="true"></i><i class="vd-s vd-box" aria-hidden="true"></i>';
    banner.querySelector('.vd-bx').addEventListener('click', function () { try { localStorage.setItem(BANNER_KEY, '1'); } catch (e) { } removeBanner(); });
    var hdr = document.querySelector('header.nav'), after = hdr && hdr.nextElementSibling && hdr.nextElementSibling.classList.contains('pixdiv') ? hdr.nextElementSibling : hdr;
    if (after && after.parentNode) after.parentNode.insertBefore(banner, after.nextSibling); else document.body.insertBefore(banner, document.body.firstChild);
  }
  function removeBanner() { if (banner && banner.parentNode) banner.parentNode.removeChild(banner); banner = null; }
  var CARDS = ['.vd-card', '.vd-tile', '.vd-row', '.vd-pstk'];
  function dropCards() { removeBanner(); CARDS.forEach(function (q) { var a = document.querySelectorAll(q); for (var i = 0; i < a.length; i++) a[i].parentNode.removeChild(a[i]); });
    var w = document.querySelectorAll('.vd-art'); for (var j = 0; j < w.length; j++) w[j].classList.remove('vd-art'); }
  var petObs = null;
  function addCards() { addBanner(); card(); petBits(); addRows();
    /* pet.html fills #page after its data loads; catch #gear when it appears */
    if (!document.querySelector('.vd-tile') && /pet\.html$/.test(location.pathname) && window.MutationObserver && !petObs) {
      petObs = new MutationObserver(function () { petBits(); if (document.querySelector('.vd-tile')) { petObs.disconnect(); petObs = null; } }); petObs.observe(document.body, { childList: true, subtree: true }); } }
  function turnOn() { if (on) return; on = true; loadCss(); root.classList.add('vd'); addLayer(); if (cardsOn()) addCards(); }
  function turnOff() { if (!on) return; on = false; root.classList.remove('vd'); if (layer && layer.parentNode) layer.parentNode.removeChild(layer); layer = null; dropCards();
    if (petObs) { petObs.disconnect(); petObs = null; } if (cssEl && cssEl.parentNode) cssEl.parentNode.removeChild(cssEl); cssEl = null; }
  function apply() { if (wanted()) { turnOn(); if (!cardsOn()) dropCards(); } else turnOff(); }
  /* re-check at the next edge (START, CARD_END or END) if it is less than a day away, else in a day */
  function arm() { if (flag() !== null) return; var now = Date.now(), next = [START.getTime(), CARD_END.getTime(), END.getTime()].filter(function (t) { return t > now; })[0]; if (!next) return;
    setTimeout(function () { apply(); arm(); }, Math.min(next - now + 500, 864e5)); }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) apply(); });
  function start() { apply(); arm(); }
  window.XCVotingDay = { START: START, END: END, CARD_END: CARD_END, cardsOn: cardsOn, inWindow: inWindow, wanted: wanted, isOn: function () { return on; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
