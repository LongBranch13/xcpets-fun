/* casa-connect (Nov 1 2026, owner [pt2571u] "Im on casa browser on xcpets i don't see how to connect to casa wallet"). UI only: no rules,
 * no signing here. On phones (and anywhere inside Casa Tookan) every page gets a slim bar under the header with ONE Connect button that
 * works at once: it does not wait for the chain reads (the old top-bar button was only wired after them, so on a slow phone it did nothing).
 *  - wallet detection retried for ~8 s (Casa Tookan's providers can attach a moment late), and again when the app comes back to the front
 *  - label: "Connect Casa Tookan" inside Casa Tookan (window.casaTookan / webXCP / web3xcp), "Connect XCP Wallet" with the extension
 *  - inside Casa Tookan with no Counterparty provider after the retries: a short hint (unlock, reopen, open XCPETS from Browse > Apps)
 *  - on a phone with no wallet at all: an "Open in Casa Tookan" link (casatookan://browse/<this page>, per docs.casatookan.com)
 *  - pages without the wallet scripts send the tap to play.html?cc=1, which connects as soon as the wallet is found */
(function () {
  'use strict';
  var w = window, d = document; if (w.__casaConnect) return; w.__casaConnect = 1;
  var POLL_MS = 250, POLL_FOR = 8000, CSS = '#ccBar{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px 10px;max-width:1100px;margin:8px auto 0;padding:6px 10px;box-sizing:border-box}' +
    '#ccBar .btn{min-height:40px}#ccBar #ccBtn.on{background:#1d2b23;color:#3ddc84;border-color:#3ddc84}#ccBar .cc-t{flex:1 1 100%;text-align:center;margin:0;font-size:13px;line-height:1.45}#ccBar .cc-t:empty{display:none}' +
    '#ccBar .cc-hint{color:#ffc93c}#ccBar a.cc-open{font-size:13px}' +
    /* sweep-1123 (Jake Nov 23 2026: "look for redundancy"): one compact connect row on phones, and the page's own copies of the same
     * button and Casa Tookan note are hidden while this bar is on the page (the page's Disconnect, balance and address box stay). */
    '@media (max-width:600px){#ccBar{margin-top:4px;padding:4px 10px;gap:4px 8px}#ccBar .btn{min-height:36px;padding-top:4px;padding-bottom:4px;font-size:15px}#ccBar .cc-t{font-size:12px;line-height:1.35}}' +
    'body.cc-has #wconnect:not(.cc-keep),body.cc-has #topBar .uxp-note,body.cc-has .uxp-quick a[href="#topBar"]{display:none!important}';
  function inCasa() { try { return !!(w.casaTookan && w.casaTookan.isCasaTookan); } catch (e) { return false; } }
  function casaProv() { return !!(w.webXCP || w.web3xcp); }
  function anyProv() { return !!(w.xcpwallet || casaProv()); }
  function phone() { return (w.innerWidth || 1000) <= 600; }
  function label() { if (w.V2Wallet && w.V2Wallet.label && (anyProv() || inCasa())) return w.V2Wallet.label(); return w.xcpwallet ? 'XCP Wallet' : casaProv() || inCasa() ? 'Casa Tookan' : 'wallet'; }
  function me() { try { return (w.V2Wallet && w.V2Wallet.current && w.V2Wallet.current()) || null; } catch (e) { return null; } }
  function short(a) { a = String(a || ''); return a.length > 14 ? a.slice(0, 6) + '…' + a.slice(-4) : a; }
  var bar = null, btn = null, msg = null, busy = false, t0 = Date.now(), timer = null;
  function want() { return phone() || inCasa() || casaProv(); }
  function build() {
    if (bar || !d.body || !want()) return;
    if (!d.getElementById('ccCss')) { var st = d.createElement('style'); st.id = 'ccCss'; st.textContent = CSS; (d.head || d.body).appendChild(st); }
    bar = d.createElement('div'); bar.id = 'ccBar'; bar.className = 'cc-bar';
    bar.innerHTML = '<button type="button" class="btn" id="ccBtn">Connect wallet</button><p class="small cc-t" id="ccMsg" role="status" aria-live="polite"></p>';
    btn = bar.querySelector('#ccBtn'); msg = bar.querySelector('#ccMsg'); btn.onclick = function () { connect(true); };
    var h = d.querySelector('header.nav'), after = h && h.nextElementSibling && /pixdiv/.test(h.nextElementSibling.className || '') ? h.nextElementSibling : h;
    if (window.XcpTopStrip && XcpTopStrip.mount(bar)) { /* smooth: the reserved top strip (js/v2-header.js), not a new row above the page */ }
    else if (after && after.parentNode) after.parentNode.insertBefore(bar, after.nextSibling); else d.body.insertBefore(bar, d.body.firstChild);
    d.body.classList.add('cc-has');
  }
  function say(html, cls) { if (!msg) return; msg.className = 'small cc-t' + (cls ? ' ' + cls : ''); msg.innerHTML = html || ''; }
  function openLink() { return '<a class="cc-open" href="casatookan://browse/' + encodeURIComponent(location.href.replace(/[?&]cc=1/, '')) + '">Open in Casa Tookan</a>'; }
  /* phone-handoff (Nov 24 2026): no wallet on this phone -> plan mode (js/handoff.js): pick burns here, scan a code with the computer to sign there */
  function planOk() { return !!(w.XcpHandoff && w.XcpHandoff.can && w.XcpHandoff.can()); }
  function planOn() { return !!(w.XcpHandoff && w.XcpHandoff.on && w.XcpHandoff.on()); }
  function planStart() { var H = w.XcpHandoff; if (!H) return; var cur = w.V2View && w.V2View.me ? w.V2View.me() : null, addr = null;
    if (cur && w.confirm('Pick burns for ' + short(cur) + ' on this phone and sign them on your computer?\n\nPress Cancel to type a different address.')) addr = cur;
    else addr = w.prompt('Your wallet address (the one in XCP Wallet on your computer):', '');
    if (!addr) return; var err = H.start(addr); if (err) say(err, 'cc-hint'); }
  d.addEventListener('click', function (e) { var t = e.target && e.target.closest ? e.target.closest('[data-xh-start],[data-xh-stop]') : null; if (!t) return; e.preventDefault();
    if (t.hasAttribute('data-xh-stop')) { if (w.XcpHandoff) w.XcpHandoff.stop(); } else planStart(); });
  function paint() {
    if (planOn()) { build(); if (btn && !busy) { var pa = w.XcpHandoff.planAddr(), pt = '\ud83d\udcf2 Signing on my computer \u00b7 ' + short(pa); if (btn.textContent !== pt) btn.textContent = pt; btn.classList.add('on'); btn.onclick = function () { say('Plan mode: pick burns here as usual. Where a wallet would open, you get a code to scan with your computer, and XCP Wallet signs there. <a href="#" data-xh-stop="1">Stop</a>', 'cc-hint'); }; }
      if (msg && !msg.innerHTML) say('\ud83d\udcf2 Pick burns here, then scan the code with your computer to sign. <a href="#" data-xh-stop="1">Stop</a>'); return; }
    build(); var L = label(), a = me();
    if (btn && !busy) { btn.disabled = false; btn.classList.toggle('on', !!a); var tx = a ? '\u2713 ' + L + ' connected \u00b7 ' + short(a) : 'Connect ' + L; if (btn.textContent !== tx) btn.textContent = tx; }
    /* the page's own Connect buttons: same label, and usable before the chain reads finish (v2.js / v2-pages.js take them over later) */
    ['wconnect', 'xcpConnect'].forEach(function (id) { var b = d.getElementById(id); if (!b || b._v2 || a) return;
      if (/^(Connect wallet|Connect XCP Wallet|Connect Casa Tookan)$/.test(b.textContent.trim()) && (anyProv() || inCasa())) b.textContent = 'Connect ' + L;
      if (!b.onclick) b.onclick = function () { connect(true); }; });
    /* smooth (Nov 26 2026): the hint used to appear 8 s after opening (after the wallet poll), growing the bar and pushing every page down.
     * A device that had no wallet last time shows it from the start; a wallet turning up clears it as before. */
    var noW = false; try { noW = localStorage.getItem('xcpets-cc-nowallet') === '1'; } catch (e) { }
    if (!anyProv() && (Date.now() - t0 >= POLL_FOR || (noW && !inCasa())) && msg && !msg.innerHTML) {
      try { if (Date.now() - t0 >= POLL_FOR) localStorage.setItem('xcpets-cc-nowallet', '1'); } catch (e) { }
      if (inCasa()) say('Casa Tookan has not attached its wallet to this page. Unlock your casa, fully close and reopen Casa Tookan, then open XCPETS from <b>Browse \u203a Apps</b> (or type xcpets.fun/play.html).', 'cc-hint');
      else if (phone()) say('No wallet here? ' + openLink() + ' to play on your phone' + (planOk() ? ', or <a href="#" class="cc-plan" data-xh-start="1">pick burns here and sign them on your computer</a>.' : '.'), 'cc-hint');
    }
    if (anyProv() && msg && /cc-hint/.test(msg.className)) { say(''); try { localStorage.removeItem('xcpets-cc-nowallet'); } catch (e) { } }
  }
  function connect(user) {
    if (busy) return; build();
    if (!w.V2Wallet || !w.V2Wallet.connect) { location.href = 'play.html?cc=1'; return; }
    busy = true; if (btn) { btn.disabled = true; btn.textContent = 'Looking for ' + label() + '\u2026'; } say('');
    var before = null; try { before = localStorage.getItem('xcpets-v2-me'); } catch (e) { }
    w.V2Wallet.connect().then(function (a) { busy = false; paint(); say('Connected <b>' + short(a) + '</b>.');
      var x = d.getElementById('xcpConnect'); if (x) x.textContent = 'Connected: ' + a.slice(0, 8) + '\u2026';
      if (d.getElementById('wconnect') && before !== a) setTimeout(function () { location.replace(location.href.replace(/[?&]cc=1/, '')); }, 600); /* game pages draw for one address: reload, as the top-bar button does */
    }, function (e) { busy = false; paint(); var h = (w.V2Wallet.errHtml || function (x) { return String(x && x.message || x); })(e); say(h + (e && e.notFound && !inCasa() && phone() ? ' ' + openLink() : ''), 'cc-hint'); });
  }
  function tick() { paint(); if (Date.now() - t0 < POLL_FOR && !anyProv()) timer = setTimeout(tick, POLL_MS); else { timer = null; paint(); } }
  function again() { if (timer) return; if (!anyProv()) { t0 = Date.now(); } tick(); }
  function boot() {
    tick(); setInterval(function () { if (!busy) paint(); }, 1500); /* catches a silent re-attach (v2-wallet) or a late provider */
    d.addEventListener('visibilitychange', function () { if (d.visibilityState === 'visible') again(); });
    w.addEventListener('focus', again); w.addEventListener('xcpets:connected', function () { paint(); });
    w.addEventListener('resize', function () { if (!bar && want()) paint(); });
    if (/[?&]cc=1/.test(location.search)) { var tries = 0; (function auto() { if (anyProv() || inCasa() && tries > 24 || tries > 32) return connect(false); tries++; setTimeout(auto, POLL_MS); })(); }
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot); else boot();
})();
