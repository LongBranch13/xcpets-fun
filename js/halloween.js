/* halloween-look (owner Oct 28 2026: "a halloween look for the whole website that is also satoshis birthday"). DISPLAY ONLY: no rule, burn,
 * replay or data change. The Bitcoin white paper was published Oct 31, 2008, so Oct 31, 2026 is its 18th birthday.
 * ON:  exactly 12:00 AM Central on Oct 31, 2026 (2026-10-31T05:00Z, CDT) for everyone, wherever they are.
 * OFF: by itself at the end of Nov 1 Central (2026-11-02T06:00Z, CST after the Nov 1 DST change). A page left open across either edge flips at that moment (one timer, re-armed daily).
 * ?halloween=1 forces it on (previews), ?halloween=0 forces it off. Nothing is stored except the banner's "Dismiss" (localStorage).
 * When off this file does nothing else: no CSS is fetched and no element is added. When on it loads css/halloween.css (same ?v= as this file)
 * and adds one aria-hidden layer of CSS-only bats and fog (pointer-events: none), plus a pumpkin in the header (CSS) and the banner.
 * Cemetery: a full moon, heavier fog, bats and flickering candles over the scene canvas (a DOM layer on top; js/v2-cemetery-scene.js untouched).
 * White paper blend (owner 5:47 PM CT): ₿-carved pumpkin, bats carrying paper pages, ghostly drifting pages with lines from the abstract
 * (wide screens), ₿ candles, a tombstone plaque for "Bitcoin: A Peer-to-Peer Electronic Cash System" with a block 0 nod and an 18th birthday
 * cake (Home + Cemetery), and a Petcoin White Paper preview (petcoin.html; a tile on pet pages). The paper is a PREVIEW: nothing is granted.
 * Perf: CSS transform/opacity animations only, no requestAnimationFrame, no canvas; prefers-reduced-motion = everything still. */
(function () {
  'use strict';
  if (window.__hwLoaded) return; window.__hwLoaded = 1;
  var START = new Date(Date.UTC(2026, 9, 31, 5, 0, 0)), END = new Date(Date.UTC(2026, 10, 2, 6, 0, 0)); /* fixed UTC instants, not the visitor's clock zone; END is exclusive */
  var BANNER_KEY = 'xcpets-halloween-2026-banner-hidden';
  var me = document.currentScript, ver = (me && /[?&]v=([\w.-]+)/.exec(me.src) || [])[1] || '';
  function flag() { var m = /[?&]halloween=([01])\b/.exec(location.search); return m ? m[1] : null; }
  function inWindow(now) { return now >= START && now < END; }
  function wanted() { var f = flag(); return f === '1' ? true : f === '0' ? false : inWindow(new Date()); }
  var root = document.documentElement, on = false, cssEl = null, layer = null, banner = null, cemObs = null;

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function loadCss() { if (cssEl) return; cssEl = document.createElement('link'); cssEl.rel = 'stylesheet'; cssEl.href = 'css/halloween.css' + (ver ? '?v=' + ver : ''); document.head.appendChild(cssEl); }
  function isCemetery() { return !!document.getElementById('cemScene') || /cemetery\.html$/.test(location.pathname); }

  function addLayer() {
    if (layer) return;
    layer = el('div', 'hw-layer'); layer.setAttribute('aria-hidden', 'true');
    layer.innerHTML = '<div class="hw-glow"></div><div class="hw-fog hw-fog1"></div><div class="hw-fog hw-fog2"></div>' +
      '<div class="hw-bw hw-bw1"><i class="hw-bat"></i></div><div class="hw-bw hw-bw2"><i class="hw-bat hw-batp"></i></div><div class="hw-bw hw-bw3"><i class="hw-bat"></i></div>';
    PAGES.forEach(function (t, i) { var g = el('div', 'hw-pg hw-pg' + (i + 1)); g.textContent = t; layer.appendChild(g); });
    document.body.appendChild(layer);
  }
  /* lines quoted from the Bitcoin white paper's abstract (Satoshi Nakamoto, Oct 31, 2008) */
  var PAGES = ['“A purely peer-to-peer version of electronic cash would allow online payments to be sent directly from one party to another without going through a financial institution.”',
    '“The network timestamps transactions by hashing them into an ongoing chain of hash-based proof-of-work.”'];
  function q1() { return flag() === '1' ? '?halloween=1' : ''; }
  /* tombstone plaque + 18th birthday cake (Home and Cemetery) */
  function plaque() {
    var cem = isCemetery(), home = /^(home|front)$/.test(document.body.getAttribute('data-v2page') || '') || /(^\/$|index\.html$)/.test(location.pathname);
    if ((!cem && !home) || document.querySelector('.hw-plq')) return;
    var d = el('section', 'hw-plq'); d.setAttribute('aria-label', 'Bitcoin white paper 18th birthday');
    d.innerHTML = '<div class="hw-cake" aria-hidden="true"><i class="hw-cakef"></i></div><div class="hw-plq-t"><div class="hw-plq-k">Est. Oct 31, 2008</div>' +
      '<div class="hw-plq-h">Bitcoin: A Peer-to-Peer Electronic Cash System</div><div class="hw-plq-a">Satoshi Nakamoto · 18 years old on Oct 31, 2026</div>' +
      '<div class="hw-plq-g">⛏️ Block 0 · Jan 3, 2009: <i>“The Times 03/Jan/2009 Chancellor on brink of second bailout for banks”</i></div>' +
      '<a class="hw-plq-l" href="petcoin.html' + q1() + '">📜 Read the Petcoin paper (preview)</a></div>';
    var at = cem ? document.getElementById('status') : null, main = document.querySelector('main');
    if (at) at.insertAdjacentElement('afterend', d); else if (main) main.insertBefore(d, main.firstChild); else document.body.appendChild(d);
  }
  /* pet pages: the Petcoin White Paper as a preview tile under Gear (no grant, nothing changes on the pet) */
  function petTile() {
    if (document.body.getAttribute('data-v2page') !== 'pet' || document.querySelector('.hw-wp')) return; var g = document.getElementById('gear'); if (!g) return;
    var t = el('div', 'hw-wp'); t.innerHTML = '<i class="hw-scroll" aria-hidden="true"></i><div><b>📜 Petcoin White Paper</b> <span class="hw-tag">preview · not granted</span>' +
      '<div class="small">Every pet would get one. Signed by Miwa #15004, the most powerful Nakamoto.</div><a href="petcoin.html' + q1() + '">Read the paper →</a></div>';
    g.insertAdjacentElement('afterend', t);
  }
  function addBanner() {
    if (banner) return; try { if (localStorage.getItem(BANNER_KEY) === '1') return; } catch (e) { /* private mode: just show it */ }
    banner = el('div', 'hw-banner'); banner.setAttribute('role', 'note');
    banner.innerHTML = '<span class="hw-bt">🎃 Happy Halloween, and happy 18th birthday to the Bitcoin white paper (Oct 31, 2008)</span>' +
      '<button type="button" class="hw-bx" aria-label="Dismiss the Halloween banner">Dismiss</button>';
    banner.querySelector('.hw-bx').addEventListener('click', function () { try { localStorage.setItem(BANNER_KEY, '1'); } catch (e) { } removeBanner(); });
    var hdr = document.querySelector('header.nav'), after = hdr && hdr.nextElementSibling && hdr.nextElementSibling.classList.contains('pixdiv') ? hdr.nextElementSibling : hdr;
    if (after && after.parentNode) after.parentNode.insertBefore(banner, after.nextSibling); else document.body.insertBefore(banner, document.body.firstChild);
  }
  function removeBanner() { if (banner && banner.parentNode) banner.parentNode.removeChild(banner); banner = null; }

  /* Cemetery: a DOM layer sized to the scene canvas (aspect 320:180). Candles sit just right of each real headstone (slot list read from
   * V2CemeteryScene._state().graves after mount; empty plots get none). The scene's own innerHTML is only written before its canvas exists. */
  function cemFx() {
    var box = document.getElementById('cemScene'); if (!box) return;
    function build() {
      var c = box.querySelector('canvas'); if (!c || box.querySelector('.hw-cemfx')) return !!c;
      var fx = el('div', 'hw-cemfx'); fx.setAttribute('aria-hidden', 'true');
      var h = '<div class="hw-moon"></div><div class="hw-cfog hw-cf1"></div><div class="hw-cfog hw-cf2"></div><div class="hw-cfog hw-cf3"></div>' +
        '<div class="hw-cbw hw-cb1"><i class="hw-bat"></i></div><div class="hw-cbw hw-cb2"><i class="hw-bat hw-batp"></i></div><div class="hw-cbw hw-cb3"><i class="hw-bat"></i></div>';
      var st = window.V2CemeteryScene && V2CemeteryScene._state && V2CemeteryScene._state(), gs = st && st.graves || [];
      gs.forEach(function (g, i) { if (!g || !g.p) return; var s = g.y < 112 ? 0.7 : g.y < 140 ? 0.85 : 1, w = Math.round(30 * s), cx = g.x + w / 2 + 1, cw = 5 * s, ch = 12 * s; /* ₿ candle + flame */
        h += '<i class="hw-cand" style="left:' + (cx / 3.2).toFixed(2) + '%;top:' + ((g.y - ch) / 1.8).toFixed(2) + '%;width:' + (4 * s / 3.2).toFixed(2) + '%;height:' + (ch / 1.8).toFixed(2) + '%;animation-delay:-' + (i * 0.37 % 1.3).toFixed(2) + 's"></i>'; });
      fx.innerHTML = h; c.insertAdjacentElement('afterend', fx); return true;
    }
    if (build()) return;
    if (window.MutationObserver) { cemObs = new MutationObserver(function () { if (build()) { cemObs.disconnect(); cemObs = null; } }); cemObs.observe(box, { childList: true }); }
  }
  function clearCemFx() { if (cemObs) { cemObs.disconnect(); cemObs = null; } var f = document.querySelectorAll('.hw-cemfx'); for (var i = 0; i < f.length; i++) f[i].parentNode.removeChild(f[i]); }

  function turnOn() { if (on) return; on = true; loadCss(); root.classList.add('hw'); if (isCemetery()) root.classList.add('hw-cem'); addLayer(); addBanner(); plaque(); petTile(); if (isCemetery()) cemFx(); }
  function turnOff() { if (!on) return; on = false; root.classList.remove('hw', 'hw-cem'); if (layer && layer.parentNode) layer.parentNode.removeChild(layer); layer = null; removeBanner(); clearCemFx(); ['.hw-plq', '.hw-wp'].forEach(function (q) { var e = document.querySelector(q); if (e) e.parentNode.removeChild(e); });
    if (cssEl && cssEl.parentNode) cssEl.parentNode.removeChild(cssEl); cssEl = null; }
  function apply() { if (wanted()) turnOn(); else turnOff(); }
  /* re-check at the next edge (START or END) if it is less than a day away, else in a day; setTimeout caps near 24.8 days anyway */
  function arm() { if (flag() !== null) return; var now = Date.now(), next = [START.getTime(), END.getTime()].filter(function (t) { return t > now; })[0]; if (!next) return;
    setTimeout(function () { apply(); arm(); }, Math.min(next - now + 500, 864e5)); }
  /* a tab woken from sleep may have skipped the timer: check again when it becomes visible */
  document.addEventListener('visibilitychange', function () { if (!document.hidden) apply(); });
  function start() { apply(); arm(); }
  window.XCHalloween = { START: START, END: END, inWindow: inWindow, wanted: wanted, isOn: function () { return on; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
