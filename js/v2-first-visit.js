/* first-visit (Nov 22 2026, owner: "I want the players to be wowed by how fun and intuitive it is"). DISPLAY ONLY: no burns, no rules, nothing signed.
 * A first-time visitor on Home or Play used to see up to five starts at once (top Connect bar, Connect/Hatch/My Pets row, the tutorial button,
 * the "Start here" list and the Coach Peepo popup). This shows ONE welcome card instead, and its big button is the free practice egg
 * (practice.html: no wallet, first egg always Legendary). The other starts are hidden only while the card is up.
 * Shown when: Home or Play (not practice), no wallet remembered on this device (xcpets-v2-me), no ?addr / ?coach / ?cc, not dismissed.
 * Gone for good after: ✕, connecting a wallet, or tapping any of its buttons. */
(function () {
  'use strict';
  var d = document, w = window, html = d.documentElement, KEY = 'xcpets-fv-x';
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
  var path = location.pathname, onPlay = /(^|\/)play\.html$/.test(path), onHome = /(^|\/)(index\.html)?$/.test(path);
  if (!(onPlay || onHome) || /practice/.test(path)) return;
  var qs = new URLSearchParams(location.search);
  if (get(KEY) || get('xcpets-v2-me') || qs.has('addr') || qs.has('coach') || qs.has('cc') || qs.has('fresh')) return;
  function walletIn() { return !!(w.xcpwallet || w.webXCP || w.web3xcp || w.casaTookan); }

  var CSS = 'html.fv-on #tutEntry,html.fv-on .tut-entry-row,html.fv-on #uxpStart,html.fv-on .uxp-quick,html.fv-on .tut-tip:not(.tut-coach){display:none!important}' +
    'html.fv-on.fv-nowal #ccBar{display:none!important}' +
    '#fvCard{position:relative;max-width:640px;width:calc(100% - 24px);margin:14px auto 10px;padding:18px 16px 14px;box-sizing:border-box;text-align:center;border:3px solid #ffd23f;border-radius:16px;' +
    'background:linear-gradient(180deg,#2a1f4a 0%,#161229 100%);box-shadow:0 6px 0 #000,0 0 0 3px #000 inset;color:#f4f1ff}' +
    '#fvCard h2{font-family:Bangers,Impact,sans-serif;font-size:34px;letter-spacing:1px;margin:4px 0 2px;color:#3ddc84;text-shadow:3px 3px 0 #000}' +
    '#fvCard .fv-sub{margin:0 auto 12px;max-width:440px;font-size:16px;line-height:1.4}' +
    '#fvCard .fv-egg{width:72px;height:84px;image-rendering:pixelated;display:block;margin:0 auto;animation:fvWob 1.6s ease-in-out infinite;transform-origin:50% 90%}' +
    '@keyframes fvWob{0%,60%,100%{transform:rotate(0)}68%{transform:rotate(-9deg)}76%{transform:rotate(8deg)}84%{transform:rotate(-5deg)}92%{transform:rotate(3deg)}}' +
    '#fvCard .fv-stage{display:block;width:100%;max-width:520px;aspect-ratio:200/72;margin:0 auto 4px;image-rendering:pixelated;border:3px solid #000;border-radius:10px;background:#120c26}' +
    '#fvCard.fv-has-stage .fv-egg{display:none}' +
    '#fvCard .fv-go{display:inline-block;font-size:22px;padding:14px 22px;margin:6px 0 2px;text-decoration:none}' +
    '#fvCard .fv-why{font-size:13px;opacity:.85;margin:4px 0 12px}' +
    '#fvCard .fv-row{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:4px}' +
    '#fvCard .fv-row .q,#fvCard .fv-row .btn{font-size:14px}' +
    '#fvCard .fv-x{position:absolute;top:8px;right:8px}' +
    '#fvCard .fv-msg{font-size:13px;margin:8px 0 0;color:#ffc93c}#fvCard .fv-msg:empty{display:none}' +
    '@media (prefers-reduced-motion:reduce){#fvCard .fv-egg{animation:none}}';
  /* 12x14 pixel egg with a crack, drawn as SVG rects (meme pixel style, no image file to load) */
  var EGG = ['....XXXX....', '..XXWWWWXX..', '.XWWWWWWWWX.', '.XWWSWWWWSX.', 'XWWWWWWWWWWX', 'XWWWWWWWWWWX', 'XKWKWWWKWWWX', 'XWKWKWKWKWKX',
    'XWWWWKWWWKWX', 'XWSWWWWWWWWX', '.XWWWWWWWSX.', '.XWWWWWWWWX.', '..XXWWWWXX..', '....XXXX....'];
  function egg() { var c = { X: '#000', W: '#fff6dc', S: '#f2c14e', K: '#2b2b2b' }, r = '';
    EGG.forEach(function (row, y) { for (var x = 0; x < row.length; x++) if (c[row[x]]) r += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + c[row[x]] + '"/>'; });
    return '<svg class="fv-egg" viewBox="0 0 12 14" shape-rendering="crispEdges" aria-hidden="true">' + r + '</svg>'; }

  /* The welcome stage (Jake, Nov 22 2026: "amazing graphics"): real cast sprites from js/pet-core.js (same art as the game), Legendary
   * signature kits, bobbing on a starry night around the egg, which wobbles, cracks and pops sparkles every few seconds.
   * Canvas 200x72 game pixels, scaled up crisp. Falls back to the SVG egg if PetCore is missing or anything throws. */
  var CAST = ['wojak', 'pepe', 'doge', 'nakamoto', 'peepo', 'chud'];
  function petFrames(id) { var P = w.PetCore, pet = P.characterPet(id, { tier: 'legendary', bgColor: '#ff00fe' }), out = [];
    pet.pattern = 'none'; pet.background = 'solid'; pet.bgColor = '#ff00fe';
    for (var f = 0; f < 4; f++) { var r = P.render(pet, { stage: 4, frame: f }), c = d.createElement('canvas'); c.width = r.width; c.height = r.height;
      var g = c.getContext('2d'), im = g.createImageData(r.width, r.height), D = im.data, S = r.data;
      for (var i = 0; i < S.length; i += 4) { var key = S[i] > 120 && S[i + 1] < 70 && S[i + 2] > 120 && Math.abs(S[i] - S[i + 2]) < 40; D[i] = S[i]; D[i + 1] = S[i + 1]; D[i + 2] = S[i + 2]; D[i + 3] = key ? 0 : S[i + 3]; }
      g.putImageData(im, 0, 0); out.push(c); }
    return out; }
  function eggCanvas(crack) { var c = d.createElement('canvas'), g; c.width = 12; c.height = 14; g = c.getContext('2d');
    var col = { X: '#000', W: '#fff6dc', S: '#f2c14e', K: '#2b2b2b' };
    EGG.forEach(function (row, y) { for (var x = 0; x < row.length; x++) { var ch = row[x]; if (ch === 'K' && !crack) ch = 'W'; if (col[ch]) { g.fillStyle = col[ch]; g.fillRect(x, y, 1, 1); } } });
    return c; }
  function stage(cv) {
    var W = 200, H = 72, g = cv.getContext('2d'), still = w.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var pets = CAST.map(function (id) { return petFrames(id); }), eggA = eggCanvas(false), eggB = eggCanvas(true);
    var stars = []; for (var i = 0; i < 34; i++) stars.push([(i * 53 + 7) % W, (i * 29 + 3) % 40, i % 5]);
    var slots = [2, 28, 54, 114, 140, 166], spark = [], t0 = performance.now(), raf = 0;
    function sky() { var gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#0d0a24'); gr.addColorStop(1, '#3a2466'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
    function frame(now) {
      if (!cv.isConnected) return; var t = Math.max(0, (now - t0) / 1000); /* the first animation frame can be stamped before t0: a negative t picked frame -1 and drawImage threw */ sky();
      stars.forEach(function (s, k) { var on = still || ((t * 2 + k * 0.37) % 3) > 0.4; g.fillStyle = s[2] === 0 ? '#ffd23f' : '#cfc6ff'; if (on) g.fillRect(s[0], s[1], 1, 1); });
      g.fillStyle = '#fff3b0'; g.fillRect(12, 6, 8, 8); g.fillStyle = '#0d0a24'; g.fillRect(16, 6, 4, 4); /* pixel moon */
      g.fillStyle = '#1e5a34'; g.fillRect(0, 62, W, 10); g.fillStyle = '#3ddc84'; for (var x = 0; x < W; x += 4) g.fillRect(x, 61 + (x % 8 ? 0 : -1), 2, 2);
      pets.forEach(function (fr, k) { var f = still ? 0 : Math.floor(t * 4 + k) % 4, bob = still ? 0 : Math.round(Math.sin(t * 3 + k * 1.3)); g.drawImage(fr[f], slots[k], 30 + bob); });
      /* the egg: 4 s loop: rest, wobble, crack, pop */
      var p = still ? 0 : t % 4, ex = 92, ey = 33, ang = 0, cracked = p > 2.4;
      if (p > 1.2 && p < 3.2) ang = Math.sin(p * 28) * (p < 2.4 ? 0.12 : 0.22);
      if (p > 3.2 && spark.length === 0 && !still) for (var k2 = 0; k2 < 14; k2++) spark.push({ x: ex + 12, y: ey + 8, vx: Math.cos(k2 / 14 * 6.283) * 26, vy: Math.sin(k2 / 14 * 6.283) * 26 - 10, life: 0.8 });
      g.save(); g.translate(ex + 12, ey + 28); g.rotate(ang); g.drawImage(cracked ? eggB : eggA, -12, -28, 24, 28); g.restore();
      spark = spark.filter(function (s) { s.life -= 1 / 60; s.x += s.vx / 60; s.y += s.vy / 60; s.vy += 40 / 60; if (s.life > 0) { g.fillStyle = s.life > 0.4 ? '#ffd23f' : '#ff7ad9'; g.fillRect(Math.round(s.x), Math.round(s.y), 2, 2); } return s.life > 0; });
      if (p < 0.1) spark.length = 0;
      if (!still) raf = requestAnimationFrame(frame);
    }
    frame(performance.now());
    d.addEventListener('visibilitychange', function () { if (!d.hidden && !still && cv.isConnected) { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); } });
  }

  var card = null;
  function gone(forever) { if (forever) set(KEY, '1'); html.classList.remove('fv-on', 'fv-nowal'); if (card) card.remove(); card = null; }
  function connect() {
    var b = d.getElementById('ccBtn') || d.getElementById('wconnect');
    if (!walletIn()) { var m = card && card.querySelector('.fv-msg'); if (m) m.innerHTML = 'No wallet found in this browser. On a computer: add the <a href="https://chromewebstore.google.com/search/XCP%20Wallet" target="_blank" rel="noopener">XCP Wallet</a> Chrome extension, then reload. On a phone: open xcpets.fun inside the <b>Casa Tookan</b> app. Until then, the free egg needs no wallet.'; return; }
    if (b) { gone(true); b.click(); return; }
    location.href = 'play.html?cc=1';
  }
  function peek() {
    gone(true); var a = d.getElementById('avAddr');
    if (!a) { location.href = 'play.html#topBar'; return; }
    a.scrollIntoView({ block: 'center' }); try { a.focus({ preventScroll: true }); } catch (e) { a.focus(); }
  }
  function build() {
    var main = d.querySelector('main'); if (!main || d.getElementById('fvCard')) return;
    if (!d.getElementById('fvCss')) { var st = d.createElement('style'); st.id = 'fvCss'; st.textContent = CSS; d.head.appendChild(st); }
    card = d.createElement('section'); card.id = 'fvCard'; card.setAttribute('aria-label', 'Welcome to XCPETS');
    card.innerHTML = '<button type="button" class="q fv-x" aria-label="Hide this welcome">✕</button>' + egg() + '<canvas class="fv-stage" width="200" height="72" role="img" aria-label="XCPETS pets dancing around an egg that is about to hatch"></canvas>' +
      '<h2>Welcome, keeper!</h2>' +
      '<p class="fv-sub">Hatch 8-bit meme pets that live on Bitcoin. Feed them, breed them, send them to fight.</p>' +
      '<a class="btn fv-go" href="practice.html#hatchPanel">🥚 Crack a free egg</a>' +
      '<p class="fv-why">No wallet needed. Your first egg is always a <b>Legendary</b>.</p>' +
      '<div class="fv-row"><button type="button" class="btn ghost fv-conn">🔌 I have a wallet</button>' +
      '<button type="button" class="q fv-peek">👀 Peek at someone\'s pets</button>' +
      '<a class="q fv-tut" href="tutorial.html">🎓 How to play</a></div>' +
      '<p class="fv-msg" aria-live="polite"></p>';
    card.querySelector('.fv-x').onclick = function () { gone(true); };
    card.querySelector('.fv-go').addEventListener('click', function () { set(KEY, '1'); });
    card.querySelector('.fv-tut').addEventListener('click', function () { set(KEY, '1'); });
    card.querySelector('.fv-conn').onclick = connect;
    card.querySelector('.fv-peek').onclick = peek;
    if (!(window.XcpTopStrip && XcpTopStrip.mountMain(card, 0))) main.insertBefore(card, main.firstChild);
    var cv = card.querySelector('.fv-stage'); try { if (!w.PetCore || !w.PetCore.characterPet) throw 0; stage(cv); card.classList.add('fv-has-stage'); } catch (e) { cv.remove(); }
    html.classList.add('fv-on'); if (!walletIn()) html.classList.add('fv-nowal');
    /* a wallet attached late (Casa Tookan) brings its top Connect bar back; a connected wallet ends the welcome */
    var t0 = Date.now(), tm = setInterval(function () {
      if (!card) return clearInterval(tm);
      if (walletIn()) html.classList.remove('fv-nowal');
      if ((w.V2UI && w.V2UI.ME) || get('xcpets-v2-me')) { gone(true); clearInterval(tm); }
      if (Date.now() - t0 > 120000) clearInterval(tm);
    }, 700);
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', build); else build();
  w.V2FirstVisit = { hide: function () { gone(true); } };
})();
