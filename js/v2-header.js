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
  /* main top (Nov 26 2026, smooth load, round 2): the cards that late scripts put at the very top of the page body (Play's Today card, the
   * Pantry, the Town bar, the Doom sign, the phone quick links, the tutorial row) arrived one by one between 0.3 s and 2.4 s, each pushing the
   * whole page down (Play on a phone: layout shift 0.9, most of it the 845 px Today card landing at 2.3 s). Every page now has an empty
   * <div id="mainTop"> as the first thing in <main>; the cards go into it in a fixed order (data-mt), and it starts with last visit's layout.
   * Display only. XcpTopStrip.mountMain(el, order) returns false where the page has no <main> (callers keep their old place). */
  var MKEY = 'xcpets-maintop:' + page().replace(/\.html$/, ''), mt = null, ghosts = {}, plan = null;
  try { plan = JSON.parse(ls(MKEY) || 'null'); if (!plan || !plan.length || plan.length > 20) plan = null; } catch (e) { plan = null; }
  /* last visit's slots ([order, px] each) become empty spacers the moment #mainTop is parsed (before the first paint); each real card replaces
   * its own spacer in place, so a late card (Today at ~2 s) no longer pushes the cards under it either. Spacers left after 20 s go. */
  function ghost(t) { if (!plan) return; plan.forEach(function (x) { var o = +x[0] || 0, h = Math.round(+x[1] || 0); if (!(h > 0 && h < 2000) || ghosts[o]) return; for (var c = t.firstElementChild; c; c = c.nextElementSibling) { if (+(c.getAttribute('data-mt') || 0) === o) return; }
      var g = d.createElement('div'); g.className = 'mt-ghost'; g.setAttribute('aria-hidden', 'true'); g.setAttribute('data-mt', String(o)); g.style.height = h + 'px'; ghosts[o] = g; place(t, g, o); });
    plan = null; setTimeout(function () { Object.keys(ghosts).forEach(function (k) { var g = ghosts[k]; if (g && g.parentNode) g.parentNode.removeChild(g); }); ghosts = {}; }, 20000); }
  if (plan && w.MutationObserver) { var mo = new MutationObserver(function () { var t = d.getElementById('mainTop'); if (t) { mo.disconnect(); mainTop(); } }); mo.observe(d.documentElement, { childList: true, subtree: true });
    d.addEventListener('DOMContentLoaded', function () { mo.disconnect(); }); }
  function place(t, el, o) { var before = null; for (var c = t.firstElementChild; c; c = c.nextElementSibling) { if (c !== el && +(c.getAttribute('data-mt') || 0) > o) { before = c; break; } }
    if (el.parentNode !== t || el.nextElementSibling !== before) t.insertBefore(el, before); }
  function slots() { var out = [], kids = []; for (var c = mt.firstElementChild; c; c = c.nextElementSibling) { if (c.className !== 'mt-ghost' && c.getBoundingClientRect().height) kids.push(c); }
    kids.forEach(function (c, i) { var r = c.getBoundingClientRect(), nx = kids[i + 1], h = nx ? nx.getBoundingClientRect().top - r.top : r.height + (parseFloat(getComputedStyle(c).marginBottom) || 0); out.push([+(c.getAttribute('data-mt') || 0), Math.round(h)]); });
    return out; }
  function mainTop() { if (mt && mt.isConnected) return mt; var m = d.querySelector('main'); if (!m) return null;
    mt = d.getElementById('mainTop'); if (!mt) { mt = d.createElement('div'); mt.id = 'mainTop'; m.insertBefore(mt, m.firstChild); }
    ghost(mt);
    var save = function () { if (!mt.isConnected) return; try { var s2 = slots(); if (s2.length) localStorage.setItem(MKEY, JSON.stringify(s2)); else localStorage.removeItem(MKEY); } catch (e) { } };
    d.addEventListener('visibilitychange', function () { if (d.hidden) save(); }); w.addEventListener('pagehide', save);
    return mt; }
  function mountMain(el, order) { var t = mainTop(); if (!t) return false; var o = +order || 0; el.setAttribute('data-mt', String(o));
    var g = ghosts[o]; if (g) { delete ghosts[o]; if (g.parentNode === t) { t.replaceChild(el, g); return true; } }
    place(t, el, o); return true; }
  /* keep height (Nov 26 2026, smooth load): a page part that is filled late (the Petdex grid, the Rankings board) starts at last visit's
   * height, so the footer and everything under it do not jump when it fills. Mark it data-keep-h in the page. The reserve goes away the
   * moment the real content reaches it (checked when the part changes), or after 15 s. Display only. */
  var KKEY = 'xcpets-keeph:' + page().replace(/\.html$/, ''), kRes = null, kPlan = null;
  try { kPlan = JSON.parse(ls(KKEY) || 'null'); } catch (e) { kPlan = null; }
  if (kPlan && typeof kPlan === 'object') { var css = Object.keys(kPlan).filter(function (id) { return /^[\w-]+$/.test(id) && kPlan[id] > 0 && kPlan[id] < 20000; }).map(function (id) { return '#' + id + '{min-height:' + Math.round(kPlan[id]) + 'px}'; }).join('');
    if (css) { kRes = d.createElement('style'); kRes.id = 'keepHRes'; kRes.textContent = css; (d.head || d.documentElement).appendChild(kRes); setTimeout(kDrop, 15000); } }
  function kDrop() { if (kRes && kRes.parentNode) kRes.parentNode.removeChild(kRes); kRes = null; }
  function kFill(el) { var top = el.getBoundingClientRect().top, b = 0; for (var c = el.firstElementChild; c; c = c.nextElementSibling) { var r = c.getBoundingClientRect(); if (r.height) b = Math.max(b, r.bottom - top); } return b; }
  function kWatch() { var els = d.querySelectorAll('[data-keep-h][id]'); if (!els.length) return;
    if (kRes && w.MutationObserver) { var q = 0, chk = function () { q = 0; if (!kRes) return; for (var i = 0; i < els.length; i++) { var h = kPlan && kPlan[els[i].id]; if (h && kFill(els[i]) < h - 1) return; } kDrop(); mo2.disconnect(); };
      var mo2 = new MutationObserver(function () { if (!q) q = setTimeout(chk, 120); }); for (var i = 0; i < els.length; i++) mo2.observe(els[i], { childList: true, subtree: true }); }
    var save = function () { var o = {}; for (var i = 0; i < els.length; i++) { var h = Math.round(kFill(els[i])); if (h > 0) o[els[i].id] = h; } try { localStorage.setItem(KKEY, JSON.stringify(o)); } catch (e) { } };
    d.addEventListener('visibilitychange', function () { if (d.hidden) save(); }); w.addEventListener('pagehide', save); }
  var kGo = function () { try { kWatch(); } catch (e) { } }; if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', kGo); else kGo();
  w.XcpTopStrip = { mount: mount, mountMain: mountMain };

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
