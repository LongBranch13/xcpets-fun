/* XCPETS promo: "Connect wallet" = XCP Wallet Chrome extension only (window.xcpwallet, xcp_requestAccounts).
 * Connect only: no signing, no broadcast. Play money stays separate. Uses Wallet (wallet.js, shared with the real game). */
(function () {
  'use strict';
  var KEY = 'xcpets-xcpwallet-address';
  var STORE = 'https://chromewebstore.google.com/detail/xcp-wallet/nicpjdbehgcjbjfjkobcidnfmfpijohg';
  function short(a) { return a.length > 14 ? a.slice(0, 7) + '…' + a.slice(-5) : a; }
  /** Resolve window.xcpwallet, waiting up to ms for the extension to inject (it fires xcp-wallet#initialized). */
  function waitForXcp(ms) {
    return new Promise(function (resolve) {
      if (window.xcpwallet) return resolve(window.xcpwallet);
      var done = false, t0 = Date.now();
      function fin() { if (done) return; if (window.xcpwallet || Date.now() - t0 >= ms) { done = true; resolve(window.xcpwallet || null); } }
      window.addEventListener('xcp-wallet#initialized', fin);
      try { window.dispatchEvent(new Event('xcp-wallet#discover')); } catch (e) { /* ignore */ }
      (function poll() { fin(); if (!done) setTimeout(poll, 150); })();
    });
  }
  /** Disconnect: forget the shared address, drop a wallet-based owner unlock, and tell XCP Wallet (xcp_disconnect) if it is there. */
  function disconnect() {
    localStorage.removeItem(KEY);
    Object.keys(sessionStorage).forEach(function (k) { if (/^xcpets-owner-(session|via)-|^xcpets-owner-[a-z0-9]+$/.test(k)) sessionStorage.removeItem(k); });
    var p = window.xcpwallet; return p && p.request ? p.request({ method: 'xcp_disconnect' }).catch(function () { /* site-side only */ }) : Promise.resolve();
  }
  function bind(btn, msg) {
    if (!btn) return;
    var dis = document.createElement('button'); dis.type = 'button'; dis.className = 'q xcpDisconnect'; dis.textContent = 'Disconnect'; dis.style.marginLeft = '6px';
    btn.insertAdjacentElement('afterend', dis);
    function sync() { var a = localStorage.getItem(KEY); btn.textContent = a ? '🟢 ' + short(a) : 'Connect wallet'; btn.title = a || ''; dis.style.display = a ? '' : 'none'; }
    sync();
    dis.onclick = function () { disconnect().then(function () { sync(); msg.textContent = 'Disconnected.'; }); };
    window.addEventListener('storage', function (e) { if (e.key === KEY) sync(); });
    btn.onclick = function (e) {
      if (e && e.preventDefault) e.preventDefault();
      msg.innerHTML = 'Looking for XCP Wallet…';
      waitForXcp(2000).then(function (p) {
        if (!p) { msg.innerHTML = 'XCP Wallet not found. Install the <a href="' + STORE + '" target="_blank" rel="noopener">XCP Wallet Chrome extension</a>, then refresh.'; return; }
        msg.textContent = 'Approve the connection in XCP Wallet…';
        var w = new Wallet.Wallet({ kind: 'xcpwallet', label: 'XCP Wallet', p: p }); // XCP Wallet only, never other providers
        return w.connect().then(function (r) {
          if (!r.address) throw new Error('XCP Wallet returned no address');
          localStorage.setItem(KEY, r.address); sync();
          msg.textContent = 'Connected. (The demo still uses play money.)';
        });
      }).catch(function (err) { msg.textContent = err && err.code ? Wallet.errMsg(err) : (err && err.message) || 'Connection failed.'; });
    };
  }
  document.querySelectorAll('[data-xcp-connect]').forEach(function (b) { bind(b, document.getElementById(b.getAttribute('data-xcp-connect'))); });
  window.XcpConnect = { disconnect: disconnect, waitForXcp: waitForXcp, STORE: STORE, KEY: KEY };
})();
