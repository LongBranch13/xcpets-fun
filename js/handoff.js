/*!
 * XCPETS phone hand-off (Nov 24 2026, Jake: "let players play on phones"). UI only: no rules, no keys, nothing is signed here.
 *
 * Most phones have no Counterparty wallet (XCP Wallet is a desktop Chrome extension; Casa Tookan is the only phone wallet we support).
 * Plan mode lets a phone player pick burns on their phone and sign them on their computer:
 *   PHONE   1. "Plan here, sign on your computer" (casa-connect bar) remembers the player's address (xcpets-handoff-me) and shows its pets.
 *           2. Burn buttons work as usual. Where the wallet would open, XcpHandoff.show() draws a QR code of
 *              https://xcpets.fun/play.html#xh=<base64url JSON {v, a: address, t: title, p: [[tag, amount, label?], ...], at}>
 *              (also Copy link / Share, to send it to yourself). The hash never reaches a server.
 *   COMPUTER 3. receive() runs in <head> before the page reads its address: it checks the code, keeps it for 24 h (xcpets-handoff-in),
 *              switches the page to that address and removes the hash.
 *           4. A bar says "From your phone: N burns". Review and sign connects XCP Wallet (it must be the same address) and opens the
 *              normal confirm sheet (V2UI.confirmPlans), so every usual safety check, re-pricing and the wallet's own approval still happen.
 * Only plain burns (a tag + an amount) travel this way. Trades, sends and issuances need a wallet on the device.
 * Plan mode is on only for a touch device with no wallet in the page (no XCP Wallet, not inside Casa Tookan) that is showing the
 * address the player chose. The Pet Shell idea (money plan) can reuse the same code format.
 */
(function (root) {
  'use strict';
  var w = root, d = w.document, loc = w.location;
  var ME_KEY = 'xcpets-v2-me', VIEW_KEY = 'xcpets-v2-view', HME_KEY = 'xcpets-handoff-me', IN_KEY = 'xcpets-handoff-in';
  var MAX_URL = 2000, MAX_PLANS = 60, KEEP_MS = 24 * 3600e3, SITE = 'https://xcpets.fun/';
  var ls = {
    get: function (k) { try { return w.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { w.localStorage.setItem(k, v); } catch (e) { } },
    del: function (k) { try { w.localStorage.removeItem(k); } catch (e) { } }
  };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function short(a) { a = String(a || ''); return a.length > 16 ? a.slice(0, 8) + '…' + a.slice(-4) : a; }
  function isAddr(a) { return typeof a === 'string' && (/^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/.test(a) || /^bc1[02-9ac-hj-np-z]{11,87}$/.test(a)); }
  function okTag(t) { return typeof t === 'string' && /^pet:[\x21-\x7e]{1,200}$/.test(t); }
  function okAmt(n) { return typeof n === 'number' && isFinite(n) && n > 0 && n <= 1e12; }

  /* ---- code format: base64url(JSON), UTF-8 safe */
  function b64u(s) { var b = unescape(encodeURIComponent(s)); return btoa(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function unb64u(s) { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return decodeURIComponent(escape(atob(s))); }
  /** plain burns only: {tag, amount} with no other kind (trades, sends and issuances need a wallet on the device) */
  function plain(p) { return !!(p && !p.kind && okTag(p.tag) && okAmt(Number(p.amount))); }
  function encode(addr, title, plans, withLabels) {
    var o = { v: 1, a: addr, t: String(title || 'Burns').slice(0, 80), at: Date.now(), p: plans.map(function (p) { var r = [p.tag, Number(p.amount)]; if (withLabels && p.label && p.label !== p.tag) r.push(String(p.label).slice(0, 60)); return r; }) };
    return SITE + 'play.html#xh=' + b64u(JSON.stringify(o));
  }
  /** decode(str) -> {a, t, plans, at} or throws with a plain reason */
  function decode(s) {
    var o = JSON.parse(unb64u(s));
    if (!o || o.v !== 1) throw new Error('This code is from a newer version of XCPETS. Reload the page and scan it again.');
    if (!isAddr(o.a)) throw new Error('This code has no valid wallet address.');
    if (!Array.isArray(o.p) || !o.p.length || o.p.length > MAX_PLANS) throw new Error('This code has no burns in it.');
    var plans = o.p.map(function (r) {
      if (!Array.isArray(r) || !okTag(r[0]) || !okAmt(r[1])) throw new Error('This code has a burn that does not look right, so it was ignored.');
      var p = { tag: r[0], amount: r[1] }; if (typeof r[2] === 'string' && r[2]) p.label = r[2].slice(0, 60); return p;
    });
    return { a: o.a, t: String(o.t || 'Burns').slice(0, 80), plans: plans, at: Number(o.at) || Date.now() };
  }

  /* ---- 3. computer side: take the code from the address bar before the page reads its address */
  var recvErr = '';
  function receive() {
    var h = String(loc.hash || ''), m = /[#&]xh=([A-Za-z0-9_-]+)/.exec(h); if (!m) return;
    try {
      var o = decode(m[1]);
      ls.set(IN_KEY, JSON.stringify({ a: o.a, t: o.t, plans: o.plans, at: Date.now() }));
      ls.set(ME_KEY, o.a); ls.del(VIEW_KEY);
    } catch (e) { recvErr = (e && e.message) || 'This code could not be read.'; }
    try { w.history.replaceState(null, '', loc.pathname + loc.search); } catch (e) { }
  }
  function pending() {
    try { var o = JSON.parse(ls.get(IN_KEY) || 'null'); if (o && isAddr(o.a) && o.plans && o.plans.length && Date.now() - o.at < KEEP_MS) return o; } catch (e) { }
    ls.del(IN_KEY); return null;
  }

  /* ---- plan mode (phone) */
  function hasWallet() { try { return !!(w.xcpwallet || w.webXCP || w.web3xcp || (w.casaTookan && w.casaTookan.isCasaTookan)); } catch (e) { return false; } }
  function touch() { try { return !!(w.matchMedia && w.matchMedia('(pointer: coarse)').matches); } catch (e) { return false; } }
  function shown() { var q = ''; try { q = new URLSearchParams(loc.search).get('addr') || ''; } catch (e) { } return (w.V2Mock && w.V2Mock.ME) || q || ls.get(ME_KEY); }
  /** can(): this device could use plan mode (a touch device without a wallet in the page) */
  function can() { return touch() && !hasWallet(); }
  /** on(): plan mode is active: the page shows the address this phone chose to plan for */
  function on() { var h = ls.get(HME_KEY); return !!(h && can() && shown() === h); }
  function planAddr() { return on() ? ls.get(HME_KEY) : null; }
  /** start(addr): plan for this address on this phone, then reload its pets */
  function start(addr) { addr = String(addr || '').trim(); if (w.V2View && w.V2View.check) { var c = w.V2View.check(addr); if (!c.ok) return c.error; addr = c.addr; } else if (!isAddr(addr)) return 'That doesn\'t look like a Bitcoin address.';
    ls.set(HME_KEY, addr); ls.set(ME_KEY, addr); ls.del(VIEW_KEY); loc.href = 'play.html'; return ''; }
  function stop() { ls.del(HME_KEY); if (w.V2View && w.V2View.stop) w.V2View.stop(); else loc.href = 'play.html'; }

  /* ---- shared sheet */
  var CSS = '#xhOv{position:fixed;inset:0;z-index:2147483000;background:rgba(5,8,18,.82);display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box}' +
    '#xhOv .xh-box{background:#141a2e;border:3px solid #ffd166;box-shadow:6px 6px 0 #000;color:#f4f4f4;max-width:420px;width:100%;max-height:100%;overflow:auto;padding:16px;box-sizing:border-box;text-align:center;border-radius:6px}' +
    '#xhOv h2{font-family:"Press Start 2P",monospace;font-size:12px;line-height:1.6;color:#ffd166;margin:0 0 10px}' +
    '#xhOv .xh-t{font-size:14px;line-height:1.5;margin:6px 0}#xhOv .xh-s{font-size:12px;line-height:1.5;opacity:.8;margin:6px 0}' +
    '#xhOv .xh-qr{background:#fff;padding:12px;margin:10px auto;display:inline-block;line-height:0;border-radius:4px}#xhOv .xh-qr svg,#xhOv .xh-qr img{width:min(70vw,260px);height:auto;display:block}' +
    '#xhOv .xh-b{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:10px}#xhOv .xh-b button,#xhOv .xh-b a{font:inherit;font-size:14px;min-height:40px;padding:6px 14px;background:#1f2a48;color:#fff;border:2px solid #000;box-shadow:3px 3px 0 #000;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center}' +
    '#xhOv .xh-b .xh-go{background:#4fd18b;color:#08130c;font-weight:bold}#xhOv ul{text-align:left;font-size:13px;line-height:1.5;margin:6px 0;padding-left:20px;max-height:120px;overflow:auto}#xhOv code{word-break:break-all}' +
    '#xhBar{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147482000;background:#141a2e;border:3px solid #ffd166;box-shadow:5px 5px 0 #000;color:#f4f4f4;padding:10px 14px;max-width:min(620px,calc(100vw - 32px));box-sizing:border-box;display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;font-size:14px;line-height:1.45;border-radius:6px}' +
    '#xhBar .xh-m{flex:1 1 240px}#xhBar button{font:inherit;font-size:14px;min-height:38px;padding:6px 12px;border:2px solid #000;box-shadow:3px 3px 0 #000;cursor:pointer;background:#1f2a48;color:#fff}#xhBar .xh-go{background:#4fd18b;color:#08130c;font-weight:bold}#xhBar .xh-err{flex:1 1 100%;color:#ffc93c;font-size:13px}';
  function css() { if (d.getElementById('xhCss')) return; var st = d.createElement('style'); st.id = 'xhCss'; st.textContent = CSS; (d.head || d.body).appendChild(st); }
  function close() { var o = d.getElementById('xhOv'); if (o) o.remove(); }
  function sheet(html) { css(); close(); var o = d.createElement('div'); o.id = 'xhOv'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', 'Finish on your computer');
    o.innerHTML = '<div class="xh-box">' + html + '</div>'; o.addEventListener('click', function (e) { if (e.target === o || (e.target.closest && e.target.closest('[data-xh-close]'))) close(); }); d.body.appendChild(o); return o; }
  var qrLoad = null;
  function loadQr() { if (w.qrcode) return Promise.resolve(w.qrcode); if (qrLoad) return qrLoad;
    qrLoad = new Promise(function (res, rej) { var s = d.createElement('script'); s.src = 'js/qr.min.js?v=xh1124a'; s.onload = function () { w.qrcode ? res(w.qrcode) : rej(new Error('QR')); }; s.onerror = function () { qrLoad = null; rej(new Error('QR')); }; d.head.appendChild(s); });
    return qrLoad; }
  function qrSvg(text) { var q = w.qrcode(0, text.length > 900 ? 'L' : 'M'); q.addData(text, 'Byte'); q.make(); return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); }

  /* ---- 2. phone side: show the code */
  /** show(title, plans): the "Finish on your computer" sheet. Returns true when a code was shown. */
  function show(title, plans) {
    var addr = planAddr() || ls.get(HME_KEY); plans = (plans || []).filter(Boolean);
    var ok = plans.filter(plain), skipped = plans.length - ok.length;
    if (!addr || !ok.length) { sheet('<h2>📲 NEEDS A WALLET HERE</h2><p class="xh-t">This one can\'t be finished on another device. Open xcpets.fun in the <b>Casa Tookan</b> app, or do it on your computer.</p><div class="xh-b"><button type="button" class="xh-go" data-xh-close>OK</button></div>'); return false; }
    var url = encode(addr, title, ok, true); if (url.length > MAX_URL) url = encode(addr, title, ok, false);
    if (url.length > MAX_URL || ok.length > MAX_PLANS) { sheet('<h2>📲 TOO MANY FOR ONE CODE</h2><p class="xh-t">' + ok.length + ' burns don\'t fit in one code. Pick fewer at a time (about 30 or less) and try again.</p><div class="xh-b"><button type="button" class="xh-go" data-xh-close>OK</button></div>'); return false; }
    var list = ok.slice(0, 12).map(function (p) { return '<li>' + esc(p.label && p.label !== p.tag ? p.label : p.tag) + '</li>'; }).join('') + (ok.length > 12 ? '<li>…and ' + (ok.length - 12) + ' more</li>' : '');
    var o = sheet('<h2>📲 FINISH ON YOUR COMPUTER</h2>' +
      '<p class="xh-t">Scan this with your computer\'s camera, or send yourself the link. It opens these burns there, ready to sign in <b>XCP Wallet</b> as <code>' + esc(short(addr)) + '</code>.</p>' +
      '<div class="xh-qr" aria-label="QR code">…</div><ul>' + list + '</ul>' +
      (skipped ? '<p class="xh-s">' + skipped + ' other step' + (skipped > 1 ? 's need' : ' needs') + ' a wallet on this device and ' + (skipped > 1 ? 'were' : 'was') + ' left out.</p>' : '') +
      '<p class="xh-s">Nothing is signed or sent from this phone. Your computer checks everything again before XCP Wallet asks you to approve.</p>' +
      '<div class="xh-b"><button type="button" data-xh-copy>Copy link</button>' + (w.navigator && w.navigator.share ? '<button type="button" data-xh-share>Send to myself</button>' : '') + '<button type="button" class="xh-go" data-xh-close>Done</button></div>');
    var box = o.querySelector('.xh-qr');
    loadQr().then(function () { box.innerHTML = qrSvg(url); }, function () { box.textContent = 'The QR code could not load. Use Copy link instead.'; box.style.lineHeight = '1.4'; box.style.color = '#000'; });
    var cp = o.querySelector('[data-xh-copy]'); cp.onclick = function () { var done = function () { cp.textContent = '✓ Copied'; };
      if (w.navigator && w.navigator.clipboard && w.navigator.clipboard.writeText) w.navigator.clipboard.writeText(url).then(done, function () { w.prompt('Copy this link:', url); }); else w.prompt('Copy this link:', url); };
    var sh = o.querySelector('[data-xh-share]'); if (sh) sh.onclick = function () { w.navigator.share({ title: 'XCPETS burns to sign', text: 'Open on my computer to sign: ' + (title || 'XCPETS burns'), url: url }).catch(function () { }); };
    return true;
  }
  /** for V2Wallet.send / sendDex in plan mode: show the code and give the page a calm error (nothing was signed or sent) */
  function intercept(plan, title) {
    var shown_ = show(title || (plan && (plan.label || plan.tag)) || 'Burn', [plan]);
    var e = new Error(shown_ ? 'Opened "Finish on your computer". Nothing was signed or sent from this phone.' : 'This needs a wallet on this device. Nothing was signed or sent.');
    e.handoff = true; e.retry = false; e.cancelled = shown_; return e;
  }

  /* ---- 4. computer side: the bar */
  function bar() {
    var o = pending(); if (!d.body) return;
    var b = d.getElementById('xhBar');
    if (!o && !recvErr) { if (b) b.remove(); return; }
    css(); if (!b) { b = d.createElement('div'); b.id = 'xhBar'; b.setAttribute('role', 'status'); d.body.appendChild(b); }
    if (!o) { b.innerHTML = '<span class="xh-m">📲 ' + esc(recvErr) + '</span><button type="button" data-xh-x>OK</button>'; b.querySelector('[data-xh-x]').onclick = function () { recvErr = ''; b.remove(); }; return; }
    var n = o.plans.length;
    b.innerHTML = '<span class="xh-m">📲 <b>From your phone:</b> ' + esc(o.t) + ' · ' + n + ' burn' + (n > 1 ? 's' : '') + ' for <code>' + esc(short(o.a)) + '</code></span>' +
      '<button type="button" class="xh-go" data-xh-go>Review and sign</button><button type="button" data-xh-x>Dismiss</button><span class="xh-err" hidden></span>';
    var err = b.querySelector('.xh-err'), go = b.querySelector('[data-xh-go]');
    function say(t) { err.innerHTML = t; err.hidden = !t; }
    b.querySelector('[data-xh-x]').onclick = function () { ls.del(IN_KEY); b.remove(); };
    go.onclick = function () {
      if (!w.V2UI || !w.V2UI.confirmPlans || !w.V2Wallet) { if (!/play\.html$/.test(loc.pathname)) { loc.href = 'play.html'; return; } say('The game is still loading. Try again in a moment.'); return; }
      if (String(w.V2UI.ME || '') !== o.a) { ls.set(ME_KEY, o.a); ls.del(VIEW_KEY); loc.href = 'play.html'; return; }
      function open() { ls.del(IN_KEY); b.remove(); try { if (w.V2View && w.V2View.mark) w.V2View.mark(); } catch (e) { } w.V2UI.confirmPlans('📲 ' + o.t, o.plans.map(function (p) { return { tag: p.tag, amount: p.amount, label: p.label }; })); }
      if (w.V2Wallet.current && w.V2Wallet.current() === o.a) return open();
      go.disabled = true; say('Connecting ' + esc(w.V2Wallet.label ? w.V2Wallet.label() : 'XCP Wallet') + '…');
      w.V2Wallet.connect().then(function (a) { go.disabled = false;
        if (a === o.a) { say(''); return open(); }
        say('Your wallet here is <code>' + esc(short(a)) + '</code>, but these burns are for <code>' + esc(short(o.a)) + '</code>. Switch to that account in XCP Wallet, then press Review and sign again.');
      }, function (e) { go.disabled = false; say((w.V2Wallet.errHtml ? w.V2Wallet.errHtml(e) : esc(e && e.message || e))); });
    };
  }
  function boot() { bar(); }

  receive();
  /* plan mode counts as "your own pets" for the page (v2-view.js viewOnly asks XcpHandoff.on()); mark it on <html> for styling */
  try { if (on()) d.documentElement.classList.add('handoff'); } catch (e) { }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot); else boot();
  w.XcpHandoff = { on: on, can: can, start: start, stop: stop, show: show, intercept: intercept, plain: plain, planAddr: planAddr, pending: pending, _encode: encode, _decode: decode, _bar: bar };
})(typeof self !== 'undefined' ? self : this);
