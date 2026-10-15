/*!
 * XCPETS v2 wallet bridge (production build only). Ported from the live site (xcpets.fun @ 0fa446f rjs/game.js:
 * waitForXcp / getWallet / feeRate / composeNodes / composeAt) and uses the live, byte-identical rjs/wallet.js + rjs/burn-core.js.
 * Flow per burn = exactly the live flow: fee rate (mempool hourFee) -> GET compose/destroy on the full Counterparty nodes
 * (CFG.composeList, never api.xcp.fun/node which is read-only) -> BurnCore.checkComposeResult -> XCP Wallet xcp_signTransaction
 * (user approves in the extension) -> xcp_broadcastTransaction by the wallet. This file never holds keys and never signs.
 * Browser: window.V2Wallet. Node (tests): require(...)(deps) with injected win / fetch / storage.
 */
(function (root, make) {
  if (typeof module === 'object' && module.exports) module.exports = make;
  else root.V2Wallet = make({ Wallet: root.Wallet, BurnCore: root.BurnCore, CFG: root.XCPETS_CONFIG, win: root, fetch: root.fetch && root.fetch.bind(root), storage: root.localStorage });
})(typeof self !== 'undefined' ? self : this, function (d) {
  'use strict';
  var Wallet = d.Wallet, BurnCore = d.BurnCore, CFG = d.CFG, win = d.win, F = d.fetch, store = d.storage;
  var NET = CFG.network, ME_KEY = 'xcpets-v2-me', ADDR_KEY = 'xcpets-xcpwallet-address', COMPOSE_MS = 12000, BACKOFF = d.backoffMs != null ? d.backoffMs : 1500, wallet = null;
  var tracker = new Wallet.Tracker(store, 'xcpets-v2-pending-' + NET);
  var STORE = 'https://chromewebstore.google.com/detail/xcp-wallet/nicpjdbehgcjbjfjkobcidnfmfpijohg';
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function waitForXcp(ms) {
    return new Promise(function (resolve) {
      if (win.xcpwallet) return resolve(win.xcpwallet);
      var t0 = Date.now(), done = false;
      function fin() { if (done) return; if (win.xcpwallet || Date.now() - t0 >= ms) { done = true; resolve(win.xcpwallet || null); } }
      if (win.addEventListener) win.addEventListener('xcp-wallet#initialized', fin);
      try { win.dispatchEvent(new win.Event('xcp-wallet#discover')); } catch (e) { /* ignore */ }
      (function poll() { fin(); if (!done) setTimeout(poll, 150); })();
    });
  }
  function NotFound() { var e = new Error('XCP Wallet not found.'); e.html = 'XCP Wallet not found. Install the <a href="' + STORE + '" target="_blank" rel="noopener">XCP Wallet Chrome extension</a>, then refresh.'; return e; }
  /* hotfix-chain (2026-10-14): keep the wallet's real reason. Wallet.errMsg maps -32603 to a bare 'Wallet error.' and drops e.message
   * (e.g. 'txn-mempool-conflict' / 'bad-txns-inputs-missingorspent'); show both. */
  function errText(e) { if (!e) return 'Wallet request failed.'; if (!e.code) return e.message || String(e); var m = Wallet.errMsg(e), raw = e.message || (e.data && (e.data.message || JSON.stringify(e.data))) || '';
    return m + (raw && m.indexOf(raw) < 0 ? ' (wallet said: ' + raw + ')' : '') + ' [code ' + e.code + ']'; }
  function errHtml(e) { return e.html || esc(errText(e)); }
  /* hotfix-chain: chained burns. The compose node does not see our own just-broadcast (unconfirmed) burns, so burn 3 could be built on an
   * input that burn 1 or 2 already spent -> the wallet's broadcast is rejected as a double-spend ('Wallet error.'). We remember every input we
   * spent this session and pass exclude_utxos; if that leaves no confirmed input, we spend the previous burn's change with inputs_set. */
  var spent = [], lastChange = null, SPENT_MS = 3 * 3600e3;
  function rd(h, o, n) { return h.slice(o * 2, (o + n) * 2); }
  function le(hex) { return hex.match(/../g).reverse().join(''); }
  function decodeTx(hex) {
    var o = 4, seg = rd(hex, 4, 2) === '0001'; if (seg) o += 2;
    function vi() { var b = parseInt(rd(hex, o, 1), 16); o += 1; if (b < 0xfd) return b; var n = b === 0xfd ? 2 : b === 0xfe ? 4 : 8, v = parseInt(le(rd(hex, o, n)), 16); o += n; return v; }
    var ins = [], outs = [], i, n = vi();
    for (i = 0; i < n; i++) { var txid = le(rd(hex, o, 32)); o += 32; var vout = parseInt(le(rd(hex, o, 4)), 16); o += 4; var sl = vi(); o += sl + 4; ins.push(txid + ':' + vout); }
    n = vi(); for (i = 0; i < n; i++) { var val = parseInt(le(rd(hex, o, 8)), 16); o += 8; var l = vi(), spk = rd(hex, o, l); o += l; outs.push({ value: val, opReturn: spk.slice(0, 2) === '6a' }); }
    return { ins: ins, outs: outs };
  }
  /* hotfix-compose (2026-10-15): exclusions are only for OUR still-unconfirmed burns. Drop an entry once its burn is confirmed (tracker), after 3 h,
   * and keep at most MAX_EX so the compose URL stays short; chainClear() wipes them after a failed compose. */
  var MAX_EX = 30, CHAIN_CAP = 24;
  function confirmedTx() { var o = {}; try { tracker.list().forEach(function (x) { if (x.status === 'confirmed') o[x.txid] = 1; }); } catch (e) { } return o; }
  function live() { var t = Date.now(), c = confirmedTx(); spent = spent.filter(function (x) { return t - x.at < SPENT_MS && !(x.tx && c[x.tx]); }).slice(-MAX_EX);
    if (lastChange && (t - lastChange.at >= SPENT_MS || c[lastChange.u.split(':')[0]])) lastChange = null; return spent.map(function (x) { return x.u; }); }
  function chainClear() { spent = []; lastChange = null; }
  function pendingChain() { live(); var o = {}; spent.forEach(function (x) { if (x.tx) o[x.tx] = 1; }); return Object.keys(o).length; }
  function noteSent(res, txid) {
    try { var d = decodeTx(res.rawtransaction), t = Date.now(); d.ins.forEach(function (u) { spent.push({ u: u, at: t, tx: txid }); });
      var ch = -1; d.outs.forEach(function (x, i) { if (!x.opReturn && (res.btc_change == null || x.value === Number(res.btc_change))) ch = i; });
      lastChange = ch >= 0 && txid ? { u: txid + ':' + ch, at: t } : null; } catch (e) { /* undecodable: keep going, node view only */ }
  }
  function setMe(a) { try { store.setItem(ME_KEY, a); store.setItem(ADDR_KEY, a); } catch (e) { } }
  function getWallet() {
    if (wallet) return Promise.resolve(wallet);
    return waitForXcp(2000).then(function (p) {
      if (!p) throw NotFound();
      var x = new Wallet.Wallet({ kind: 'xcpwallet', label: 'XCP Wallet', p: p });
      return x.connect().then(function (r) {
        if (!r.address) throw new Error('XCP Wallet returned no address');
        return x.network().then(function (n) {
          if (n && n !== NET && !(NET !== 'mainnet' && /test|signet/.test(n))) throw new Error('XCP Wallet is on ' + n + ' but this page is on ' + NET + '. Switch one of them.');
          wallet = x; setMe(x.address);
          if (p.on) p.on('accountsChanged', function (a) { if (a && a[0]) { wallet.address = a[0]; setMe(a[0]); if (win.location) win.location.reload(); } });
          return x;
        });
      });
    });
  }
  function feeRate() {
    return F(CFG.mempoolApi + '/v1/fees/recommended').then(function (r) { return r.json(); })
      .then(function (f) { var x = Math.ceil(Number(f.hourFee)); return x >= 1 ? x : 1; }).catch(function () { return 2; });
  }
  function composeNodes() { return (CFG.composeList && CFG.composeList.length ? CFG.composeList : [CFG.compose]).filter(function (u) { return !/xcp\.fun/.test(u); }); }
  /** whole-XCPETS amount as the decimal string BurnCore.toRaw expects (v2 release = 0.00000001 would stringify as 1e-8) */
  function amt(a) { return typeof a === 'number' ? a.toFixed(8).replace(/\.?0+$/, '') : String(a); }
  function composeUrl(me, plan, fee, base) { return BurnCore.composeUrl(base, me, { asset: CFG.asset, quantityRaw: BurnCore.toRaw(amt(plan.amount)), tag: plan.tag, satPerVbyte: fee }); }
  function chainOpts(mode) { var ex = live(); if (mode === 'change' && lastChange) return '&inputs_set=' + encodeURIComponent(lastChange.u) + '&allow_unconfirmed_inputs=true';
    return (ex.length ? '&exclude_utxos=' + encodeURIComponent(ex.join(',')) : '') + (mode === 'unconf' ? '&allow_unconfirmed_inputs=true' : ''); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function composeAt(me, plan, fee, onTry) {
    var raw = BurnCore.toRaw(amt(plan.amount)), exp = { address: me, quantityRaw: raw, tag: plan.tag }, urls = composeNodes(), errs = [];
    function call(i, mode, tries) {
      tries = tries || 0; var url = composeUrl(me, plan, fee, urls[i]) + chainOpts(mode);
      var ac = typeof AbortController !== 'undefined' ? new AbortController() : null, t = ac && setTimeout(function () { ac.abort(); }, COMPOSE_MS);
      return F(url, ac ? { signal: ac.signal } : {}).then(function (r) { if (t) clearTimeout(t); if (r.status === 429 || r.status >= 500) { var e5 = new Error('node error HTTP ' + r.status); e5.retryable = true; e5.backoff = true; throw e5; } return r.json(); }, function (e) {
        if (t) clearTimeout(t); var e2 = new Error(e && e.name === 'AbortError' ? 'timed out after ' + COMPOSE_MS / 1000 + ' s' : 'no response (' + ((e && e.message) || 'network error') + '; offline, blocked, or a rate limit without CORS)'); e2.retryable = true; e2.backoff = true; throw e2; })
        .then(function (j) {
          if (j.error) { var e3 = new Error(typeof j.error === 'string' ? j.error : JSON.stringify(j.error)); e3.retryable = /unsupported node operation|not ready|unavailable/i.test(e3.message); throw e3; }
          var chk = BurnCore.checkComposeResult(j.result, exp); if (!chk.ok) { var e4 = new Error('compose mismatch: ' + chk.problems.join(', ')); e4.retryable = true; throw e4; }
          j.result._url = url; return j.result;
        }).catch(function (e) { if (e.backoff && tries < 3) return sleep(BACKOFF * Math.pow(2, tries)).then(function () { return call(i, mode, tries + 1); }); throw e; });
    }
    function friendly(e) {
      var m = e.message;
      if (/utxo|insufficient.*btc|not enough|inputs/i.test(m)) m = 'Not enough spendable BTC to pay the network fee (or your last burn is still unconfirmed). Wait for it to confirm or add a little BTC. Node said: ' + e.message;
      else if (/balance|insufficient/i.test(m)) m = 'Not enough XCPETS for this burn. Node said: ' + e.message;
      return new Error(m);
    }
    function host(u) { return String(u).replace(/^https?:\/\//, '').replace(/\/.*$/, ''); }
    var chained = !!(live().length || lastChange), plainRetry = false;
    function go(i) {
      if (i >= urls.length) {
        if (chained && !plainRetry) { plainRetry = true; chainClear(); errs.push('retrying without coin exclusions'); return go(0); }  /* hotfix-compose: one clean retry */
        return Promise.reject(new Error('Could not build your burn: every Counterparty node failed. ' + errs.join(' · ')));
      }
      if (onTry) onTry(i + 1, urls.length);
      return call(i, false).catch(function (e) {
        if (!e.retryable && /utxo|insufficient.*btc|not enough|no .*inputs|unconfirmed/i.test(e.message)) return (lastChange ? call(i, 'change').catch(function () { return call(i, 'unconf'); }) : call(i, 'unconf')).catch(function (e2) {
          if (chained && !plainRetry) { plainRetry = true; chainClear(); return call(i, false).catch(function (e3) { throw friendly(e3); }); } throw friendly(e2); });
        if (e.retryable) { errs.push(host(urls[i]) + ': ' + e.message); return go(i + 1); }
        throw friendly(e);
      });
    }
    return go(0);
  }
  /** send(plan {tag, amount, label}, viewedAddr) -> Promise<{txid, composed}>: connect, compose (live flow), wallet signs + broadcasts. */
  function send(plan, viewed, onTry) {
    return getWallet().then(function (w) {
      if (viewed && viewed !== w.address) { var e = new Error('The connected wallet (' + w.address + ') is not the address shown on this page (' + viewed + '). Reload to view the connected wallet.'); e.reload = true; throw e; }
      if (pendingChain() >= CHAIN_CAP) { var ec = new Error(CHAIN_CAP + ' of your burns are still waiting for their first confirmation (Bitcoin allows about 25 unconfirmed in a row). Wait for the next block, then press Continue.'); ec.chainCap = true; throw ec; }
      return feeRate().then(function (fee) { return composeAt(w.address, plan, fee, onTry); }).then(function (res) {
        return w.signAndBroadcast(res).then(function (r) {
          noteSent(res, r.txid); tracker.add({ txid: r.txid, tag: plan.tag, amount: plan.amount, label: plan.label || plan.tag, at: Date.now(), status: 'sent' });
          return { txid: r.txid, composed: res };
        });
      });
    });
  }
  function connect() { return getWallet().then(function (w) { return w.address; }); }
  /** paint the play.html top bar: viewed address + connect / connected state. */
  function paint(ME, $) {
    var c = $('wconnect'); if (!c) return;
    $('me').textContent = ME ? ME + (wallet && wallet.address === ME ? ' (XCP Wallet)' : (function () { try { return store.getItem(ADDR_KEY) === ME; } catch (e) { return false; } })() ? ' (XCP Wallet: reconnects when you burn)' : ' (view only: connect to burn)') : 'not connected';
    c.textContent = wallet && wallet.address === ME ? '✓ XCP Wallet connected' : (function () { try { return store.getItem(ADDR_KEY) === ME; } catch (e) { return false; } })() ? '✓ XCP Wallet (reconnect)' : 'Connect XCP Wallet'; c.disabled = false;
    if (!c._v2) { c._v2 = 1; c.onclick = function () { var m = $('wMsg'); if (m) m.textContent = 'Looking for XCP Wallet…';
      connect().then(function (a) { if (a !== ME && win.location) return win.location.reload(); if (m) m.textContent = 'Connected.'; paint(ME, $); }, function (e) { if (m) m.innerHTML = errHtml(e); }); }; }
  }
  return { send: send, connect: connect, paint: paint, errHtml: errHtml, composeAt: composeAt, errText: errText, decodeTx: decodeTx, _spent: function () { return live(); }, _chainClear: chainClear, pendingChain: pendingChain, CHAIN_CAP: CHAIN_CAP, composeUrl: composeUrl, composeNodes: composeNodes, feeRate: feeRate, tracker: tracker, getWallet: getWallet,
    reset: function () { wallet = null; }, current: function () { return wallet && wallet.address; } };
});
