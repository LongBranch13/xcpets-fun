/* species-ranks-split / all-places (owner Oct 24 2026): ONE list of every in-game place and ONE way to link them. Navigation/display only.
 *  - header: the same "🗺️ Places" menu on every page (static markup written from this list by tools/build-places.js; phone friendly)
 *  - place pages: the same "🏘️ Town › Place" bar at the top, with the place's stations (Spam City: Buy / Sell / Trade / Gift Wrap / Token Press)
 *  - front page: the same place card (pixel sign + name + one fun line) for places that have no scene card yet
 * Old URLs and hashes are untouched (js/v2-page-split.js still routes the old play.html hashes). */
(function (root) {
  'use strict';
  var PLACES = [
    { id: 'circus', ico: '⚔️', name: 'X Circus Kekimus', url: 'fight.html', line: 'sand, blood, glory', pages: ['fight.html'] },
    { id: 'rare', ico: '🖼️', name: 'The Rare Room', url: 'rare-room.html', line: 'try on the drip', pages: ['rare-room.html'],
      stations: [['🎡', 'Pepe Wheel', 'rare-room.html#rare-room'], ['👗', 'Dressing room', 'rare-room.html#dressing-room']] },
    { id: 'motel', ico: '🏨', name: 'Gooby\u2019s No-Tail Motel', url: 'breed.html', line: 'check in, egg out', pages: ['breed.html'] },
    { id: 'spam', ico: '🛒', name: 'Spam City Games', url: 'shop.html', line: 'buy, sell, trade pets', pages: ['shop.html'],
      stations: [['🃏', 'Buy', 'shop.html#buy'], ['🏷️', 'Sell', 'shop.html#sell'], ['🔁', 'Trade', 'shop.html#trade'], ['🎁', 'Gift Wrap', 'shop.html#gift'], ['🏭', 'Token Press', 'shop.html#press']] },
    { id: 'raid', ico: '🐉', name: 'Raid Boss', url: 'raid.html', line: 'hit it together', pages: ['raid.html'] },
    { id: 'cemetery', ico: '🪦', name: 'Pet Cemetery', url: 'cemetery.html', line: 'rest in pixels', pages: ['cemetery.html'] },
    { id: 'tokens', ico: '🎖️', name: 'Proof Parade', url: 'tokens.html', line: 'every token in order', pages: ['tokens.html'] },
    { id: 'academy', ico: '🎓', name: 'The Big Beautiful Tutorial', url: 'tutorial.html', line: 'learn by playing', pages: ['tutorial.html'] }
  ];
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  /** header menu markup (tools/build-places.js writes it between <!--places--> and <!--/places--> on every page) */
  function menu() { return '<details class="navplaces"><summary>🗺️ Places</summary><div class="np-menu" role="menu">' +
    PLACES.map(function (p) { return '<a role="menuitem" class="np-' + p.id + '" href="' + p.url + '"><span aria-hidden="true">' + p.ico + '</span> ' + esc(p.name) + '</a>'; }).join('') + '</div></details><!-- the site\'s existing Ranking link (all boards, Hall of Fame included) --><a class="navrank" href="ranking.html">Ranking</a>'; }
  var api = { PLACES: PLACES, menu: menu };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;
  root.V2Places = api;
  var file = (location.pathname.split('/').pop() || 'index.html'), here = PLACES.filter(function (p) { return p.pages.indexOf(file) >= 0; })[0];
  function boot() {
    /* header: mark the current place, close the menu on outside tap / Esc */
    document.querySelectorAll('details.navplaces').forEach(function (d) {
      if (here) { var a = d.querySelector('.np-' + here.id); if (a) a.setAttribute('aria-current', 'page'); d.querySelector('summary').classList.add('np-on'); }
      document.addEventListener('click', function (e) { if (d.open && !d.contains(e.target)) d.open = false; });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') d.open = false; }); });
    /* place pages: Town bar + stations */
    if (here && !document.getElementById('townBar')) { var m = document.querySelector('main') || document.body, bar = document.createElement('nav');
      bar.id = 'townBar'; bar.className = 'townbar'; bar.setAttribute('aria-label', 'Where you are');
      bar.innerHTML = '<a class="tb-town" href="index.html#places">🏘️ Town</a><span aria-hidden="true">›</span><b>' + here.ico + ' ' + esc(here.name) + '</b>' +
        (here.stations ? '<span class="tb-st">' + here.stations.map(function (s) { var on = s[2].indexOf('#') < 0 && s[2] === file; return '<a href="' + s[2] + '"' + (on ? ' aria-current="page"' : '') + '>' + s[0] + ' ' + esc(s[1]) + '</a>'; }).join('') + '</span>' : '');
      m.insertBefore(bar, m.firstChild); }
    /* Spam City stations: tabs are read once at load, so a station link on the same page reloads into that station */
    if (file === 'shop.html') root.addEventListener('hashchange', function () { if (/^#(buy|sell|trade|gift|press)$/.test(location.hash)) location.reload(); });
    /* front page: one card per place, same .scard look; places without a scene canvas get a pixel sign */
    var row = document.getElementById('sceneCards'); if (row) { if (!document.getElementById('places')) { var an = document.createElement('a'); an.id = 'places'; an.className = 'scene-anchor'; row.parentNode.insertBefore(an, row); }
      PLACES.forEach(function (p) { if (p.pages.some(function (f) { return row.querySelector('a[href^="' + f + '"]'); })) return; if (row.querySelector('[data-place="' + p.id + '"]')) return;
        var a = document.createElement('a'); a.className = 'scard'; a.href = p.url; a.setAttribute('data-place', p.id);
        a.innerHTML = '<canvas width="320" height="180" role="img" aria-label="' + esc(p.name) + ' sign"></canvas><span class="sc-t">' + esc(p.name) + '</span><span class="sc-d">' + esc(p.line) + '</span>';
        row.appendChild(a); sign(a.querySelector('canvas'), p); });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { row.querySelectorAll('[data-place]').forEach(function (a) { sign(a.querySelector('canvas'), PLACES.filter(function (p) { return p.id === a.getAttribute('data-place'); })[0]); }); }); }
  }
  /* 8-bit sign: night sky, gold-framed board, emoji + name in the pixel font */
  function sign(c, p) { var x = c.getContext('2d'), W = 320, H = 180; x.imageSmoothingEnabled = false; function R(cl, a, b, w, h) { x.fillStyle = cl; x.fillRect(a, b, w, h); }
    R('#100E14', 0, 0, W, H); for (var i = 0; i < 46; i++) R('#fff6c8', (i * 73 + p.id.length * 11) % W, (i * 37) % 70, 1, 1);
    R('#14301f', 0, 140, W, 40); R('#000', 0, 140, W, 2); R('#3a2a1a', 154, 118, 12, 24); R('#000', 40, 26, 240, 96); R('#E8B33A', 44, 30, 232, 88); R('#1d1530', 50, 36, 220, 76);
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '30px serif'; x.fillText(p.ico, 160, 60);
    var n = p.name.toUpperCase(), fs = n.length > 16 ? 8 : 10; x.font = fs + 'px "Press Start 2P", monospace'; x.fillStyle = '#FAFAF5'; x.fillText(n, 160, 94); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof window !== 'undefined' ? window : globalThis);
