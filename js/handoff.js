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
  var ME_KEY = 'xcpets-v2-me', VIEW_KEY = 'xcpets-v2-view', HME_KEY = 'xcpets-handoff-me', IN_KEY = 'xcpets-handoff-in', LIST_KEY = 'xcpets-handoff-list', DONE_KEY = 'xcpets-handoff-done';
  var MAX_URL = 2000, MAX_PLANS = 60, MAX_BATCHES = 40, KEEP_MS = 3 * 24 * 3600e3, MAX_ITEMS = 40, SITE = 'https://xcpets.fun/';
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
  /* v2 code (Jake Nov 24 2026: "put a bunch into 1 qr code"): {v:2, a, b:[[batchId, title, [[tag, amount, label?], ...]], ...]}.
   * Each batch has an id made on the phone, so a computer that already has (or already signed) a batch never adds it twice. */
  function packBatch(x, withLabels) { return [x.id, String(x.t || 'Burns').slice(0, 60), x.plans.map(function (p) { var r = [p.tag, Number(p.amount)]; if (withLabels && p.label && p.label !== p.tag) r.push(String(p.label).slice(0, 60)); return r; })]; }
  function encodeBatches(addr, batches, withLabels) { return SITE + 'play.html#xh=' + b64u(JSON.stringify({ v: 2, a: addr, b: batches.map(function (x) { return packBatch(x, withLabels); }) })); }
  /** one batch -> link (labels dropped first if it is too long) */
  function encode(addr, title, plans, withLabels) { var x = { id: newId(), t: title, plans: plans }, u = encodeBatches(addr, [x], withLabels); return u.length > MAX_URL && withLabels ? encodeBatches(addr, [x], false) : u; }
  function newId() { var r = ''; try { var a = new Uint8Array(6); w.crypto.getRandomValues(a); for (var i = 0; i < a.length; i++) r += (a[i] % 36).toString(36); } catch (e) { } return r + Date.now().toString(36); }
  function plansOf(arr) {
    if (!Array.isArray(arr) || !arr.length || arr.length > MAX_PLANS) throw new Error('This code has no burns in it.');
    return arr.map(function (r) {
      if (!Array.isArray(r) || !okTag(r[0]) || !okAmt(r[1])) throw new Error('This code has a burn that does not look right, so it was ignored.');
      var p = { tag: r[0], amount: r[1] }; if (typeof r[2] === 'string' && r[2]) p.label = r[2].slice(0, 60); return p;
    });
  }
  /** decode(str) -> {a, batches: [{id, t, plans}]} or throws with a plain reason (v1 single-batch codes still read) */
  function decode(s) {
    var o = JSON.parse(unb64u(s));
    if (!o || (o.v !== 1 && o.v !== 2)) throw new Error('This code is from a newer version of XCPETS. Reload the page and scan it again.');
    if (!isAddr(o.a)) throw new Error('This code has no valid wallet address.');
    if (o.v === 1) return { a: o.a, batches: [{ id: hid(s), t: String(o.t || 'Burns').slice(0, 80), plans: plansOf(o.p) }] };
    if (!Array.isArray(o.b) || !o.b.length || o.b.length > MAX_BATCHES) throw new Error('This code has no burns in it.');
    var seen = {}; return { a: o.a, batches: o.b.map(function (x) {
      if (!Array.isArray(x) || typeof x[0] !== 'string' || !/^[a-z0-9]{4,40}$/.test(x[0]) || seen[x[0]]) throw new Error('This code does not look right, so it was ignored.');
      seen[x[0]] = 1; return { id: x[0], t: String(x[1] || 'Burns').slice(0, 80), plans: plansOf(x[2]) }; }) };
  }

  /* ---- 3. computer side: take the code from the address bar before the page reads its address */
  var recvErr = '', recvNote = '';
  function receive() {
    var h = String(loc.hash || ''), m = /[#&]xh=([A-Za-z0-9_-]+)/.exec(h); if (!m) return;
    try {
      var o = decode(m[1]);
      /* phone inbox (Jake Nov 24 2026: "send yourself these all day from your phone and do all the burns at the desktop"): every opened
       * link joins a list kept on this computer. A batch already waiting or already signed here is never added twice. Sign all opens
       * them together in one confirm sheet. */
      var items = inbox(), have = {}, done = doneIds(), added = 0, signed = 0;
      items.forEach(function (x) { have[x.id] = 1; });
      o.batches.forEach(function (x) { if (done[x.id]) { signed++; return; } if (have[x.id]) return; have[x.id] = 1; added++; items.push({ id: x.id, a: o.a, t: x.t, plans: x.plans, at: Date.now() }); });
      saveInbox(items.slice(-MAX_ITEMS));
      if (added || items.some(function (x) { return x.a === o.a; })) { ls.set(ME_KEY, o.a); ls.del(VIEW_KEY); }
      if (signed && !added) recvNote = signed === o.batches.length ? 'Everything in this code was already signed on this computer, so nothing was added.' : '';
      else if (signed) recvNote = signed + ' batch' + (signed > 1 ? 'es' : '') + ' in this code ' + (signed > 1 ? 'were' : 'was') + ' already signed here and ' + (signed > 1 ? 'were' : 'was') + ' skipped.';
    } catch (e) { recvErr = (e && e.message) || 'This code could not be read.'; }
    try { w.history.replaceState(null, '', loc.pathname + loc.search); } catch (e) { }
  }
  function hid(str) { var h1 = 5381, h2 = 52711; for (var i = 0; i < str.length; i++) { var c = str.charCodeAt(i); h1 = (h1 * 33) ^ c; h2 = (h2 * 31) ^ c; } return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36) + str.length; }
  function inbox() {
    var o = null; try { o = JSON.parse(ls.get(IN_KEY) || 'null'); } catch (e) { }
    var items = o && Array.isArray(o.items) ? o.items : o && o.plans ? [{ id: 'old', a: o.a, t: o.t, plans: o.plans, at: o.at }] : [];
    return items.filter(function (x) { return x && isAddr(x.a) && Array.isArray(x.plans) && x.plans.length && Date.now() - x.at < KEEP_MS; });
  }
  function saveInbox(items) { if (items.length) ls.set(IN_KEY, JSON.stringify({ items: items })); else ls.del(IN_KEY); }
  function doneIds() { var o = {}; try { o = JSON.parse(ls.get(DONE_KEY) || '{}') || {}; } catch (e) { } var out = {}; Object.keys(o).forEach(function (k) { if (Date.now() - o[k] < KEEP_MS) out[k] = o[k]; }); return out; }
  function markDone(ids) { var o = doneIds(); ids.forEach(function (id) { o[id] = Date.now(); }); ls.set(DONE_KEY, JSON.stringify(o)); }
  function dropFor(a) { saveInbox(inbox().filter(function (x) { return x.a !== a; })); }
  /** pending(): the newest address's waiting batches, merged: {a, t, plans, items, others} or null */
  function pending() {
    var items = inbox(); if (!items.length) { ls.del(IN_KEY); return null; }
    var a = items[items.length - 1].a, mine = items.filter(function (x) { return x.a === a; }), plans = [];
    mine.forEach(function (x) { plans = plans.concat(x.plans); });
    return { a: a, t: mine.length > 1 ? mine.length + ' batches' : mine[0].t, plans: plans, items: mine, others: items.length - mine.length };
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
    '#xhBar .xh-m{flex:1 1 240px}#xhBar button{font:inherit;font-size:14px;min-height:38px;padding:6px 12px;border:2px solid #000;box-shadow:3px 3px 0 #000;cursor:pointer;background:#1f2a48;color:#fff}#xhBar .xh-go{background:#4fd18b;color:#08130c;font-weight:bold}#xhBar .xh-err{flex:1 1 100%;color:#ffc93c;font-size:13px}' +
    '#xhPill{position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:2147481000;font:inherit;font-size:14px;font-weight:bold;min-height:44px;padding:8px 16px;background:#ffd166;color:#1a1200;border:3px solid #000;box-shadow:4px 4px 0 #000;border-radius:22px;cursor:pointer;max-width:calc(100vw - 32px)}#xhOv .xh-pg button{font:inherit;font-size:13px;padding:2px 8px;margin-left:4px;background:#1f2a48;color:#fff;border:2px solid #000}';
  function css() { if (d.getElementById('xhCss')) return; var st = d.createElement('style'); st.id = 'xhCss'; st.textContent = CSS; (d.head || d.body).appendChild(st); }
  function close() { var o = d.getElementById('xhOv'); if (o) o.remove(); }
  function sheet(html) { css(); close(); var o = d.createElement('div'); o.id = 'xhOv'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', 'Finish on your computer');
    o.innerHTML = '<div class="xh-box">' + html + '</div>'; o.addEventListener('click', function (e) { if (e.target === o || (e.target.closest && e.target.closest('[data-xh-close]'))) close(); }); d.body.appendChild(o); return o; }
  var qrLoad = null;
  function loadQr() { if (w.qrcode) return Promise.resolve(w.qrcode); if (qrLoad) return qrLoad;
    qrLoad = new Promise(function (res, rej) { var s = d.createElement('script'); s.src = 'js/qr.min.js?v=xh1124a'; s.onload = function () { w.qrcode ? res(w.qrcode) : rej(new Error('QR')); }; s.onerror = function () { qrLoad = null; rej(new Error('QR')); }; d.head.appendChild(s); });
    return qrLoad; }
  function qrSvg(text) { var q = w.qrcode(0, text.length > 900 ? 'L' : 'M'); q.addData(text, 'Byte'); q.make(); return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); }

  /* ---- 2. phone side: one running list, one code (Jake Nov 24 2026: "put a bunch into 1 qr code") */
  /* Every burn picked in plan mode joins this phone's list (kept 3 days). The code always holds the whole list, so the player can pick all
   * day and scan once at the computer. If the list outgrows one code it is split into "code 1 of 2"; the computer merges them, and a
   * batch it already has or already signed is never added twice, so scanning an old or a bigger code again is safe. */
  function list() {
    var o = null; try { o = JSON.parse(ls.get(LIST_KEY) || 'null'); } catch (e) { }
    var a = ls.get(HME_KEY); if (!o || o.a !== a || !Array.isArray(o.b)) return [];
    return o.b.filter(function (x) { return x && x.id && Array.isArray(x.plans) && x.plans.length && Date.now() - x.at < KEEP_MS; });
  }
  function saveList(b) { var a = ls.get(HME_KEY); if (a && b.length) ls.set(LIST_KEY, JSON.stringify({ a: a, b: b })); else ls.del(LIST_KEY); pill(); }
  /** split the list into codes that each fit (labels kept when they fit) */
  function codes(addr, b) {
    var out = [], cur = [];
    function fits(arr) { return encodeBatches(addr, arr, false).length <= MAX_URL && arr.length <= MAX_BATCHES; }
    function url(arr) { var u = encodeBatches(addr, arr, true); return u.length <= MAX_URL ? u : encodeBatches(addr, arr, false); }
    b.forEach(function (x) { if (cur.length && !fits(cur.concat([x]))) { out.push(url(cur)); cur = []; } cur.push(x); });
    if (cur.length) out.push(url(cur)); return out;
  }
  function oneMsg(h, t) { sheet('<h2>' + h + '</h2><p class="xh-t">' + t + '</p><div class="xh-b"><button type="button" class="xh-go" data-xh-close>OK</button></div>'); }
  /** show(title, plans): add this burn (or batch) to the phone's list, then show the code for the whole list. Returns true when added. */
  function show(title, plans) {
    var addr = planAddr() || ls.get(HME_KEY); plans = (plans || []).filter(Boolean);
    var ok = plans.filter(plain), skipped = plans.length - ok.length;
    if (!addr || !ok.length) { oneMsg('📲 NEEDS A WALLET HERE', 'This one can\'t be finished on another device. Open xcpets.fun in the <b>Casa Tookan</b> app, or do it on your computer.'); return false; }
    var x = { id: newId(), t: String(title || 'Burns').replace(/^\s*📲\s*/, '').slice(0, 60), plans: ok.map(function (p) { var q = { tag: p.tag, amount: Number(p.amount) }; if (p.label && p.label !== p.tag) q.label = String(p.label).slice(0, 60); return q; }), at: Date.now() };
    if (ok.length > MAX_PLANS || encodeBatches(addr, [x], false).length > MAX_URL) { oneMsg('📲 TOO MANY FOR ONE CODE', ok.length + ' burns don\'t fit in one code. Pick fewer at a time (about 30 or less) and try again.'); return false; }
    var b = list(), last = b[b.length - 1];
    if (!(last && Date.now() - last.at < 4000 && JSON.stringify(last.plans) === JSON.stringify(x.plans))) b.push(x); /* a double tap adds it once */
    saveList(b.slice(-MAX_ITEMS)); listSheet(skipped, x.t); return true;
  }
  /** listSheet(): the code for everything on this phone's list */
  function listSheet(skipped, justAdded) {
    var addr = ls.get(HME_KEY), b = list(); if (!addr || !b.length) { close(); return; }
    var all = codes(addr, b), k = 0, n = 0; b.forEach(function (x) { n += x.plans.length; });
    var rows = b.map(function (x, i) { return '<li>' + esc(x.t) + (x.plans.length > 1 ? ' <span style="opacity:.7">· ' + x.plans.length + ' burns</span>' : '') + ' <a href="#" data-xh-rm="' + i + '" aria-label="Remove" style="color:#ffc93c;text-decoration:none;padding:0 6px">×</a></li>'; }).join('');
    var o = sheet('<h2>📲 SIGN ON YOUR COMPUTER</h2>' +
      (justAdded ? '<p class="xh-t">✓ Added <b>' + esc(justAdded) + '</b>.</p>' : '') +
      '<p class="xh-t">Your list: <b>' + b.length + ' batch' + (b.length > 1 ? 'es' : '') + ' · ' + n + ' burn' + (n > 1 ? 's' : '') + '</b> for <code>' + esc(short(addr)) + '</code>. Keep playing: everything you pick goes into this code. When you\'re at your computer, scan it once and sign it all in <b>XCP Wallet</b>.</p>' +
      '<div class="xh-pg" style="font-size:13px;margin-top:6px" hidden></div><div class="xh-qr" aria-label="QR code">…</div><ul>' + rows + '</ul>' +
      (skipped ? '<p class="xh-s">' + skipped + ' other step' + (skipped > 1 ? 's need' : ' needs') + ' a wallet on this device and ' + (skipped > 1 ? 'were' : 'was') + ' left out.</p>' : '') +
      '<p class="xh-s">Nothing is signed or sent from this phone. Your computer checks everything again, skips anything it already signed, and XCP Wallet asks you to approve.</p>' +
      '<div class="xh-b"><button type="button" class="xh-go" data-xh-close>Keep playing</button><button type="button" data-xh-copy>Copy link</button>' + (w.navigator && w.navigator.share ? '<button type="button" data-xh-share>Send to myself</button>' : '') + '<button type="button" data-xh-clear>Clear list</button></div>');
    var box = o.querySelector('.xh-qr'), pg = o.querySelector('.xh-pg');
    function draw() {
      if (all.length > 1) { pg.hidden = false; pg.innerHTML = 'Code ' + (k + 1) + ' of ' + all.length + ' (scan each one) ' + (k > 0 ? '<button type="button" data-xh-prev>‹ Back</button> ' : '') + (k < all.length - 1 ? '<button type="button" data-xh-next>Next ›</button>' : '');
        var pv = pg.querySelector('[data-xh-prev]'), nx = pg.querySelector('[data-xh-next]'); if (pv) pv.onclick = function () { k--; draw(); }; if (nx) nx.onclick = function () { k++; draw(); }; }
      loadQr().then(function () { box.innerHTML = qrSvg(all[k]); }, function () { box.textContent = 'The QR code could not load. Use Copy link instead.'; box.style.lineHeight = '1.4'; box.style.color = '#000'; });
    }
    draw();
    Array.prototype.forEach.call(o.querySelectorAll('[data-xh-rm]'), function (a) { a.onclick = function (e) { e.preventDefault(); var l = list(); l.splice(+a.getAttribute('data-xh-rm'), 1); saveList(l); listSheet(); }; });
    var cp = o.querySelector('[data-xh-copy]'); cp.onclick = function () { var u = all.length > 1 ? all.join('\n') : all[0], done = function () { cp.textContent = '✓ Copied'; };
      if (w.navigator && w.navigator.clipboard && w.navigator.clipboard.writeText) w.navigator.clipboard.writeText(u).then(done, function () { w.prompt('Copy this link:', u); }); else w.prompt('Copy this link:', u); };
    var sh = o.querySelector('[data-xh-share]'); if (sh) sh.onclick = function () { w.navigator.share({ title: 'XCPETS burns to sign', text: 'Open on my computer to sign ' + n + ' XCPETS burn' + (n > 1 ? 's' : '') + (all.length > 1 ? ' (code ' + (k + 1) + ' of ' + all.length + ')' : ''), url: all[k] }).catch(function () { }); };
    o.querySelector('[data-xh-clear]').onclick = function () { if (!w.confirm('Clear your list of ' + n + ' burn' + (n > 1 ? 's' : '') + '? Do this after you\'ve signed them on your computer. Nothing is sent.')) return; saveList([]); close(); };
  }
  /** pill(): in plan mode with a list, a small button at the bottom opens the code again */
  function pill() {
    if (!d.body) return; var p = d.getElementById('xhPill'), b = on() ? list() : [];
    if (!b.length) { if (p) p.remove(); return; }
    css(); var n = 0; b.forEach(function (x) { n += x.plans.length; });
    if (!p) { p = d.createElement('button'); p.type = 'button'; p.id = 'xhPill'; p.onclick = function () { listSheet(); }; d.body.appendChild(p); }
    p.textContent = '📲 ' + n + ' to sign on computer · Show code';
  }
  /** for V2Wallet.send / sendDex in plan mode: show the code and give the page a calm error (nothing was signed or sent) */
  function intercept(plan, title) {
    var shown_ = show(title || (plan && (plan.label || plan.tag)) || 'Burn', [plan]);
    var e = new Error(shown_ ? 'Added to your list to sign on your computer. Nothing was signed or sent from this phone.' : 'This needs a wallet on this device. Nothing was signed or sent.');
    e.handoff = true; e.retry = false; e.cancelled = shown_; return e;
  }

  /* ---- 4. computer side: the bar */
  function bar() {
    var o = pending(); if (!d.body) return;
    var b = d.getElementById('xhBar');
    if (!o && !recvErr && !recvNote) { if (b) b.remove(); return; }
    css(); if (!b) { b = d.createElement('div'); b.id = 'xhBar'; b.setAttribute('role', 'status'); d.body.appendChild(b); }
    if (!o) { b.innerHTML = '<span class="xh-m">📲 ' + esc(recvErr || recvNote) + '</span><button type="button" data-xh-x>OK</button>'; b.querySelector('[data-xh-x]').onclick = function () { recvErr = recvNote = ''; b.remove(); }; return; }
    var n = o.plans.length, k = o.items.length, names = o.items.map(function (x) { return x.t; }), nm = names.slice(0, 4).join(', ') + (names.length > 4 ? ', \u2026' : '');
    b.innerHTML = '<span class="xh-m">📲 <b>From your phone:</b> ' + (k > 1 ? k + ' batches (' + esc(nm) + ')' : esc(o.t)) + ' · ' + n + ' burn' + (n > 1 ? 's' : '') + ' for <code>' + esc(short(o.a)) + '</code>' +
      (o.others ? ' <span style="opacity:.75">(+' + o.others + ' for another wallet, shown after these)</span>' : '') + (recvNote ? '<br><span style="opacity:.75">' + esc(recvNote) + '</span>' : '') + '</span>' +
      '<button type="button" class="xh-go" data-xh-go>' + (k > 1 ? 'Sign all' : 'Review and sign') + '</button><button type="button" data-xh-x>Clear</button><span class="xh-err" hidden></span>';
    var err = b.querySelector('.xh-err'), go = b.querySelector('[data-xh-go]');
    function say(t) { err.innerHTML = t; err.hidden = !t; }
    b.querySelector('[data-xh-x]').onclick = function () { if (k > 1 && !w.confirm('Clear all ' + k + ' batches from your phone? Nothing was sent.')) return; dropFor(o.a); b.remove(); bar(); };
    go.onclick = function () {
      if (!w.V2UI || !w.V2UI.confirmPlans || !w.V2Wallet) { if (!/play\.html$/.test(loc.pathname)) { loc.href = 'play.html'; return; } say('The game is still loading. Try again in a moment.'); return; }
      if (String(w.V2UI.ME || '') !== o.a) { ls.set(ME_KEY, o.a); ls.del(VIEW_KEY); loc.href = 'play.html'; return; }
      /* the batches leave the inbox only once signing starts (confirm sheet's Sign); Cancel brings the bar back. A run that stops part way
       * is kept by the page's own Continue offer (v2.js saveResume). */
      function open() { b.remove(); try { if (w.V2View && w.V2View.mark) w.V2View.mark(); } catch (e) { }
        var yes = d.getElementById('cfYes'), no = d.getElementById('cfNo'), ids = o.items.map(function (x) { return x.id; });
        function off() { if (yes) yes.removeEventListener('click', onYes, true); if (no) no.removeEventListener('click', onNo, true); }
        function onYes() { off(); markDone(ids); recvNote = ''; saveInbox(inbox().filter(function (x) { return ids.indexOf(x.id) < 0; })); setTimeout(bar, 0); }
        function onNo() { off(); setTimeout(bar, 0); }
        if (yes) yes.addEventListener('click', onYes, true); if (no) no.addEventListener('click', onNo, true);
        w.V2UI.confirmPlans('📲 ' + (k > 1 ? 'From your phone: ' : '') + o.t, o.plans.map(function (p) { return { tag: p.tag, amount: p.amount, label: p.label }; })); }
      if (w.V2Wallet.current && w.V2Wallet.current() === o.a) return open();
      go.disabled = true; say('Connecting ' + esc(w.V2Wallet.label ? w.V2Wallet.label() : 'XCP Wallet') + '…');
      w.V2Wallet.connect().then(function (a) { go.disabled = false;
        if (a === o.a) { say(''); return open(); }
        say('Your wallet here is <code>' + esc(short(a)) + '</code>, but these burns are for <code>' + esc(short(o.a)) + '</code>. Switch to that account in XCP Wallet, then press ' + (k > 1 ? 'Sign all' : 'Review and sign') + ' again.');
      }, function (e) { go.disabled = false; say((w.V2Wallet.errHtml ? w.V2Wallet.errHtml(e) : esc(e && e.message || e))); });
    };
  }
  function boot() { bar(); pill();
    /* a link pasted into this same tab only changes the hash: read it too (reload when it is for another wallet than the page shows) */
    if (w.addEventListener) w.addEventListener('hashchange', function () { var before = ls.get(ME_KEY); receive(); var now = ls.get(ME_KEY);
      if (now !== before && !(w.V2UI && w.V2UI.ME === now)) { loc.reload(); return; } bar(); }); }

  receive();
  /* plan mode counts as "your own pets" for the page (v2-view.js viewOnly asks XcpHandoff.on()); mark it on <html> for styling */
  try { if (on()) d.documentElement.classList.add('handoff'); } catch (e) { }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot); else boot();
  w.XcpHandoff = { list: list, listSheet: listSheet, on: on, can: can, start: start, stop: stop, show: show, intercept: intercept, plain: plain, planAddr: planAddr, pending: pending, _encode: encode, _encodeBatches: encodeBatches, _codes: codes, _decode: decode, _bar: bar };
})(typeof self !== 'undefined' ? self : this);
