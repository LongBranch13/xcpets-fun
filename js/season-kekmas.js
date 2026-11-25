/* SEASON 1 LOOK: "Kekmas in Cold Storage" (Nov 23 2026, owner "who does it best" list, item 8: meme-themed seasons). DISPLAY ONLY.
 * Loaded by js/v2-events.js around the season's dates, but it only switches on while the chain tip is inside Season 1's blocks
 * (data/seasons.json, season n=1: start .. start + length), read from api/meta.json like js/season-bar.js. Nothing touches rules or burns.
 *   - pixel snow drifting down the page (a light canvas behind clicks, about 60 flakes, 15 fps, paused in hidden tabs)
 *   - icicles along the bottom of the top bar and a pixel Santa hat on the XCPETS logo
 * prefers-reduced-motion: no snow (icicles and hat stay). ?kekmas=1 previews it any time, ?kekmas=0 hides it. Never swaps the token art. */
(function () {
  'use strict';
  if (window.__kekmas) return; window.__kekmas = 1;
  var d = document, q = /[?&]kekmas=([01])\b/.exec(location.search), force = q ? q[1] : null;
  if (force === '0') return;
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function on() {
    if (d.getElementById('kmCss')) return;
    var s = d.createElement('style'); s.id = 'kmCss'; s.textContent =
      ':root{--nav-trim:9px}header.nav::after{content:"";position:absolute;left:0;right:0;bottom:-9px;height:10px;pointer-events:none;z-index:5;' +
      'background:linear-gradient(135deg,transparent 33%,#e8f6ff 33% 50%,transparent 50%) 0 0/12px 10px,linear-gradient(225deg,transparent 33%,#e8f6ff 33% 50%,transparent 50%) 0 0/12px 10px;' +
      'filter:drop-shadow(0 2px 0 rgba(120,190,255,.6));opacity:.95}' +
      '.brand{position:relative}.brand .km-hat{position:absolute;left:-6px;top:-13px;width:24px;height:18px;pointer-events:none;image-rendering:pixelated;transform:rotate(-14deg)}' +
      '#kmSnow{position:fixed;inset:0;pointer-events:none;z-index:40;image-rendering:pixelated}';
    d.head.appendChild(s);
    var b = d.querySelector('.brand'); if (b && !b.querySelector('.km-hat')) { var h = d.createElement('canvas'); h.className = 'km-hat'; h.width = 12; h.height = 9; h.setAttribute('aria-hidden', 'true');
      var g = h.getContext('2d'), P = ['.......WW...', '......RRWW..', '.....RRRR...', '....RRRRR...', '...RRRRRR...', '..RRRRRRRR..', '.RRRRRRRRR..', 'WWWWWWWWWWWW', 'WWWWWWWWWWWW'];
      P.forEach(function (row, y) { for (var x = 0; x < row.length; x++) { var c = row[x]; if (c === '.') continue; g.fillStyle = c === 'R' ? '#e11d2e' : '#ffffff'; g.fillRect(x, y, 1, 1); } }); b.appendChild(h); }
    if (!RM) snow();
  }
  function snow() {
    var c = d.createElement('canvas'); c.id = 'kmSnow'; c.setAttribute('aria-hidden', 'true'); d.body.appendChild(c);
    var g = c.getContext('2d'), S = 4, W = 0, H = 0, F = [], N = 60;
    function size() { W = Math.ceil(innerWidth / S); H = Math.ceil(innerHeight / S); c.width = W; c.height = H; c.style.width = innerWidth + 'px'; c.style.height = innerHeight + 'px'; }
    function flake(top) { return { x: Math.random() * W, y: top ? -2 : Math.random() * H, v: 0.25 + Math.random() * 0.45, s: Math.random() < 0.2 ? 2 : 1, ph: Math.random() * 6.28 }; }
    size(); for (var i = 0; i < N; i++) F.push(flake(false)); addEventListener('resize', size);
    var t = 0; setInterval(function () { if (d.hidden) return; t++; g.clearRect(0, 0, W, H);
      for (var i = 0; i < F.length; i++) { var f = F[i]; f.y += f.v; f.x += Math.sin(f.ph + t / 18) * 0.15; if (f.y > H + 2) F[i] = flake(true);
        g.fillStyle = f.s > 1 ? 'rgba(255,255,255,.95)' : 'rgba(220,240,255,.8)'; g.fillRect(Math.round(f.x), Math.round(f.y), f.s, f.s); } }, 1000 / 15);
  }
  function go() {
    if (force === '1') return on();
    Promise.all([fetch('/data/seasons.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }),
      fetch('/api/meta.json?cb=' + Math.floor(Date.now() / 60000), { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; })])
      .then(function (a) { var cfg = a[0], m = a[1], s1 = cfg && (cfg.seasons || []).filter(function (x) { return x.n === 1; })[0], tip = m && m.blockHeight;
        if (s1 && tip && tip >= s1.start && tip < s1.start + (cfg.length || 4032)) on(); }).catch(function () { });
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', go); else go();
})();
