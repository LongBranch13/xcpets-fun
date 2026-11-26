/* front-v3 header (Jake, Nov 23 2026: "a cleaner header with one wallet chip"). DISPLAY ONLY: nothing here signs, burns or reads rules.
 * The top bar keeps three things in sight: Places ▾, Play, and ONE wallet chip. Everything else that used to crowd it (Ranking, the
 * Learn menu, Home's jump links, X / Telegram, the Simple menu switch) moves into one ☰ menu. The sound and glossary / receipt icons
 * sit beside the chip. Elements are moved, never copied, so every id and handler other scripts rely on keeps working.
 * Wallet chip: 🔌 Connect (uses the page's own connect: Casa bar, Play's button, or V2Wallet) / 🟢 bc1q…7q (opens My Pets) /
 * 👀 viewing bc1q…7q in view-only mode. On phones it replaces the big "Connect wallet" bar under the header; that bar's
 * help text (e.g. "Open in Casa Tookan") still shows when it has something to say. */
(function () {
  'use strict';
  var d = document, w = window, html = d.documentElement;
  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function short(a) { a = String(a || ''); return a.length > 14 ? a.slice(0, 5) + '…' + a.slice(-4) : a; }
  function page() { return (location.pathname.split('/').pop() || 'index.html'); }
  var hdr, right, chip, menu, panel;

  function me() { try { var a = w.V2Wallet && V2Wallet.current && V2Wallet.current(); if (a) return a; } catch (e) { } return (w.V2UI && V2UI.ME) || ls('xcpets-v2-me') || null; }
  function viewOnly() { try { return !!(w.V2View && V2View.viewOnly && V2View.viewOnly()); } catch (e) { return false; } }
  function paintChip() {
    if (!chip) return; var a = me(), vo = viewOnly() || /[?&]addr=/.test(location.search), txt, cls, tip;
    if (a && vo) { txt = '👀 ' + short(a); cls = 'hd-view'; tip = 'Viewing ' + a + ' (view only). Tap for My Pets.'; }
    else if (a && w.XcpHandoff && XcpHandoff.on()) { txt = '📲 ' + short(a); cls = 'hd-view'; tip = 'Picking burns for ' + a + ' on this phone. You sign them on your computer. Tap for My Pets.'; } /* phone plan mode (js/handoff.js) */
    else if (a) { txt = '🟢 ' + short(a); cls = 'hd-on'; tip = 'Connected: ' + a + '. Tap for My Pets.'; }
    else { txt = '🔌 Connect'; cls = 'hd-off'; tip = 'Connect your wallet (XCP Wallet on a computer, Casa Tookan on a phone)'; }
    if (chip.textContent !== txt) chip.textContent = txt; chip.className = 'hd-wallet ' + cls; chip.title = tip; chip.setAttribute('aria-label', tip);
  }
  function connect() {
    var b = d.getElementById('ccBtn') || d.getElementById('wconnect');
    if (b && !b.disabled) { b.click(); return; }
    if (w.V2Wallet && V2Wallet.connect) { V2Wallet.connect().then(function (a) { paintChip(); if (d.getElementById('hatchPanel') && a) location.reload(); }, function () { location.href = 'play.html?cc=1'; }); return; }
    location.href = 'play.html?cc=1';
  }
  function chipTap() { if (!me()) return connect(); if (page() === 'play.html' && d.getElementById('petsPanel')) { location.hash = 'petsPanel'; return; } location.href = 'play.html#petsPanel'; }

  function add(group, node, label) { if (!node) return; if (label) { var s = d.createElement('span'); s.className = 'hd-lbl'; s.textContent = label; group.appendChild(s); } group.appendChild(node); }
  function group(title) { var g = d.createElement('div'); g.className = 'hd-grp'; if (title) { var h = d.createElement('div'); h.className = 'hd-gt'; h.textContent = title; g.appendChild(h); } panel.appendChild(g); return g; }
  function build() {
    hdr = d.querySelector('header.nav'); var nav = hdr && hdr.querySelector('nav'); if (!nav || d.getElementById('hdRight')) return;
    html.classList.add('hd3');
    right = d.createElement('div'); right.id = 'hdRight'; right.className = 'hd-right';
    chip = d.createElement('button'); chip.type = 'button'; chip.id = 'hdWallet'; chip.onclick = chipTap; right.appendChild(chip);
    menu = d.createElement('details'); menu.className = 'hd-menu'; menu.id = 'hdMenu';
    menu.innerHTML = '<summary aria-label="Menu" title="Menu"><span aria-hidden="true">☰</span></summary><div class="hd-panel" role="menu"></div>';
    panel = menu.querySelector('.hd-panel'); right.appendChild(menu);
    hdr.appendChild(right);
    topStrip();

    var go = group('Game');
    var rk = nav.querySelector('a.navrank'); if (rk) { rk.classList.add('hd-item'); if (!/🏆/.test(rk.textContent)) rk.insertAdjacentHTML('afterbegin', '<span aria-hidden="true">🏆 </span>'); go.appendChild(rk); }
    /* Home's old jump links (How It Works, The cast, Community pet, Gallery): the sections sit right under the hero now, and the cast and
     * How It Works are in Learn below, so the links go */
    Array.prototype.slice.call(nav.querySelectorAll(':scope > a')).forEach(function (a) { if (/^#/.test(a.getAttribute('href') || '')) a.remove(); });
    var ins = nav.querySelector('a[href="inscriptions.html"]'); if (ins) { ins.classList.add('hd-item'); go.appendChild(ins); }
    var learn = nav.querySelector('details.navlearn'); if (learn) { var lg = group('📚 Learn');
      Array.prototype.slice.call(learn.querySelectorAll('a')).forEach(function (a) { a.classList.add('hd-item'); lg.appendChild(a); }); learn.remove(); }
    var snd = d.createElement('button'); snd.type = 'button'; snd.className = 'hd-item hd-sound'; snd.textContent = '🔊 Sound and music';
    snd.onclick = function () { var m = d.getElementById('xc-music-btn'); menu.open = false; if (m) m.click(); }; group('').appendChild(snd);
    var so = group('Say hi'); Array.prototype.slice.call(nav.querySelectorAll('a.navico')).forEach(function (a) { a.classList.add('hd-item');
      var lab = /t\.me/.test(a.href) ? ' Telegram chat' : ' @XCPets on X'; if (!a.querySelector('.hd-t')) a.insertAdjacentHTML('beforeend', '<span class="hd-t">' + lab + '</span>'); so.appendChild(a); });
    adopt(); paintChip();
    /* close the menu on an outside tap or Escape */
    d.addEventListener('click', function (e) { if (menu.open && !menu.contains(e.target)) menu.open = false; });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary').focus(); } });
    panel.addEventListener('click', function (e) { if (e.target.closest('a')) menu.open = false; });
    new MutationObserver(adopt).observe(hdr, { childList: true, subtree: true });
    setInterval(paintChip, 2000); w.addEventListener('storage', paintChip);
  }
  /* top strip (Nov 26 2026, smooth load): the page's status bars (the published-world bar, the halving chip, the data-lag bar and the status
   * line) used to be inserted above the page one by one as their data arrived, each pushing everything down (play.html moved 4 times in its
   * first 3 s). They all go into this one strip now. It exists from the first paint (this file runs right after </header>) and keeps the
   * height it had the last time this page was open, so the bars fill a slot that is already there instead of shoving the page.
   * XcpTopStrip.mount(el) puts a bar in; a page without this header falls back to the old place (each caller checks). */
  var strip = null, stripIn = null, SKEY = 'xcpets-topstrip-h:' + page().replace(/\.html$/, '');
  function topStrip() {
    if (stripIn) return stripIn; hdr = hdr || d.querySelector('header.nav'); if (!hdr || !hdr.parentNode) return null;
    strip = d.createElement('div'); strip.id = 'topStrip'; stripIn = d.createElement('div'); stripIn.className = 'ts-in'; strip.appendChild(stripIn);
    var h = +ls(SKEY) || +ls('xcpets-topstrip-h:any') || 0; if (h > 0 && h < 260) strip.style.minHeight = h + 'px'; /* this page's last height, else any page's */
    hdr.parentNode.insertBefore(strip, hdr.nextSibling);
    var save = function () { var ih = Math.round(stripIn.getBoundingClientRect().height); try { if (ih > 0) { localStorage.setItem(SKEY, String(ih)); localStorage.setItem('xcpets-topstrip-h:any', String(ih)); } else localStorage.removeItem(SKEY); } catch (e) { } };
    /* the reserved height is let go the moment the real bars fill it (or after 40 s, if they never come) */
    var release = function () { if (strip.style.minHeight) strip.style.minHeight = ''; };
    if (w.ResizeObserver) new ResizeObserver(function () { if (stripIn.getBoundingClientRect().height >= (parseFloat(strip.style.minHeight) || 0) - 1) release(); }).observe(stripIn);
    setTimeout(release, 40000);
    d.addEventListener('visibilitychange', function () { if (d.hidden) save(); }); w.addEventListener('pagehide', save);
    return stripIn;
  }
  function mount(el) { var t = topStrip(); if (!t) return false; if (el.parentNode !== t) t.appendChild(el); return true; }
  w.XcpTopStrip = { mount: mount };

  /* late arrivals: the Simple-menu switch (js/v2-simple.js), the glossary / receipt icons (#ipTools) and the sound button (#xc-music) */
  var busy = false;
  function adopt() { if (busy || !right) return; busy = true;
    try {
      var sm = hdr.querySelector('nav .xc-snav .xc-sm'); if (sm && !panel.contains(sm)) { var g = panel.querySelector('.hd-grp-mode') || group('Menu style'); g.classList.add('hd-grp-mode'); sm.classList.add('hd-item'); g.appendChild(sm); }
      var ip = d.getElementById('ipTools'); if (ip && ip.parentNode !== right) right.insertBefore(ip, chip);
      var mu = d.getElementById('xc-music'); if (mu && mu.parentNode !== right && hdr.contains(mu)) { mu.classList.remove('abs'); right.insertBefore(mu, right.firstChild); }
    } finally { busy = false; } }

  /* boot-look (Nov 26 2026): this file now loads right after </header> (not deferred at the end of the page), so the slim header is built
   * before the first paint. The full header used to paint first and then collapse, pushing the whole page up (the biggest jump on every page). */
  if (d.querySelector('header.nav nav')) build(); else if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', build); else build();
  w.V2Header = { paint: paintChip };
})();
