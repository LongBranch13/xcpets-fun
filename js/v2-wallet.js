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
  /* wallet-unlock (2026-10-22): XCP Wallet answers 4100 when it is locked (or this site is not connected). Say plainly what to do. */
  var UNLOCK = 'Unlock XCP Wallet to continue. It is locked (or this site is not connected): click again and unlock it in the XCP Wallet window that opens (it may be behind this window).';
  function errText(e) { if (!e) return 'Wallet request failed.'; if (e.code === 4100) return UNLOCK + ' [code 4100]'; if (!e.code) return e.message || String(e); var m = Wallet.errMsg(e), raw = e.message || (e.data && (e.data.message || JSON.stringify(e.data))) || '';
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
  function confirmedTx() { var o = {}; try { tracker.list().forEach(function (x) { if (x.status === 'confirmed') o[x.txid] = 1; }); } catch (e) { }
    /* fix (2026-10-17): the tracker is never polled, so also treat any burn already in the confirmed chain rows as confirmed (the pending count used to clear only after 3 h) */
    try { ((window.V2Mock && V2Mock.state().rows) || []).forEach(function (r) { if (r && r.tx_hash) o[r.tx_hash] = 1; }); } catch (e) { } return o; }
  function live() { var t = Date.now(), c = confirmedTx(); spent = spent.filter(function (x) { return t - x.at < SPENT_MS && !(x.tx && c[x.tx]); }).slice(-MAX_EX);
    if (lastChange && (t - lastChange.at >= SPENT_MS || c[lastChange.u.split(':')[0]])) lastChange = null; return spent.map(function (x) { return x.u; }); }
  function chainClear() { spent = []; lastChange = null; saveSpent(); }
  /* build 2 (2026-10-16): the spent-input list survives a reload (per network + address) so Continue after a reload does not rebuild on spent inputs */
  var spentAddr = null; function spentKey(a) { return 'xcpets-v2-spent-' + NET + '-' + a; }
  function saveSpent() { if (!spentAddr) return; try { if (spent.length || lastChange) store.setItem(spentKey(spentAddr), JSON.stringify({ spent: spent, lastChange: lastChange })); else store.removeItem(spentKey(spentAddr)); } catch (e) { } }
  function loadSpent(a) { if (spentAddr === a) return; spentAddr = a; try { var o = JSON.parse(store.getItem(spentKey(a)) || 'null'); if (o && Array.isArray(o.spent)) { var have = {}; spent.forEach(function (x) { have[x.u] = 1; }); o.spent.forEach(function (x) { if (x && x.u && !have[x.u]) spent.push(x); }); if (!lastChange && o.lastChange) lastChange = o.lastChange; } } catch (e) { } live(); saveSpent(); }
  function pendingChain() { live(); var o = {}; spent.forEach(function (x) { if (x.tx) o[x.tx] = 1; }); return Object.keys(o).length; }
  function noteSent(res, txid) {
    try { var d = decodeTx(res.rawtransaction), t = Date.now(); d.ins.forEach(function (u) { spent.push({ u: u, at: t, tx: txid }); });
      var ch = -1; d.outs.forEach(function (x, i) { if (!x.opReturn && (res.btc_change == null || x.value === Number(res.btc_change))) ch = i; });
      lastChange = ch >= 0 && txid ? { u: txid + ':' + ch, at: t } : null; } catch (e) { /* undecodable: keep going, node view only */ } saveSpent();
  }
  function setMe(a) { try { store.setItem(ME_KEY, a); store.setItem(ADDR_KEY, a); } catch (e) { } }
  /* wallet-one-window (2026-10-22): XCP Wallet opens a NEW extension window (chrome.windows.create) for every connect/sign request the page makes;
   * the page cannot name, focus or reuse that window. So never have two wallet requests open at once: concurrent connects share one promise,
   * and a second burn while one is waiting for approval is refused with a hint instead of opening another window. */
  var connecting = null, signing = 0, LOCK_MS = 10 * 60e3; /* signing = start time of the pending burn; the lock self-clears after 10 min (XCP Wallet's own sign-request TTL) */
  function busyErr() { var e = new Error('An XCP Wallet window is already open and waiting for you (it may be behind this window). Finish or close the open XCP Wallet windows, then try again.'); e.walletBusy = true; return e; }
  /* wallet-unlock (2026-10-22): the wallet object used to be cached forever, so after XCP Wallet locked itself every action failed with 4100.
   * XCP Wallet's xcp_requestAccounts opens its own unlock window when locked (waits up to 5 min), so: when the wallet reported a lock
   * (accountsChanged []) re-run connect before handing the wallet out, and if a sign request still answers 4100, unlock via connect and retry once.
   * Same address required; a different account reloads the page as before. One wallet window at a time (shares `connecting`). */
  var locked = false;
  function unlock() {
    if (connecting) return connecting;
    var x = wallet, was = x.address;
    return (connecting = x.connect().then(function (r) {
      if (!r.address) { var e = new Error(UNLOCK); e.code = 4100; throw e; }
      if (r.address !== was) { x.address = was; setMe(r.address); if (win.location) win.location.reload(); throw new Error('XCP Wallet switched to another address (' + r.address + '). Reloading for that address.'); }
      locked = false; return x;
    })).then(function (x) { connecting = null; return x; }, function (e) { connecting = null;
      if (e && e.code === 4001) { var u = new Error(UNLOCK); u.code = 4100; u.cause = e; throw u; } throw e; }); /* closed the unlock window: still locked, say so */
  }
  function guard(x) {
    var sb = x.signAndBroadcast, sm = x.signMessage;
    function retry(f) { return function () { var self = this, a = arguments; return f.apply(self, a).catch(function (e) { if (!e || e.code !== 4100) throw e; return unlock().then(function () { return f.apply(self, a); }); }); }; }
    x.signAndBroadcast = retry(sb); x.signMessage = retry(sm); return x;
  }
  function getWallet() {
    if (wallet) return locked ? unlock() : Promise.resolve(wallet);
    if (connecting) return connecting;
    return (connecting = waitForXcp(2000).then(function (p) {
      if (!p) throw NotFound();
      var x = new Wallet.Wallet({ kind: 'xcpwallet', label: 'XCP Wallet', p: p });
      return x.connect().then(function (r) {
        if (!r.address) throw new Error('XCP Wallet returned no address');
        return x.network().then(function (n) {
          if (n && n !== NET && !(NET !== 'mainnet' && /test|signet/.test(n))) throw new Error('XCP Wallet is on ' + n + ' but this page is on ' + NET + '. Switch one of them.');
          wallet = guard(x); locked = false; setMe(x.address); loadSpent(x.address);
          if (p.on) p.on('accountsChanged', function (a) { if (!a || !a[0]) { locked = true; return; } if (a[0] === wallet.address) { locked = false; return; } /* same address re-emitted on unlock: no reload */
            wallet.address = a[0]; setMe(a[0]); if (win.location) win.location.reload(); });
          return x;
        });
      });
    }).then(function (x) { connecting = null; return x; }, function (e) { connecting = null; throw e; }));
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
    /* build 2: our earlier burns are still unconfirmed -> stop instead of clearing exclusions (that would double-spend their inputs) */
    function waitErr() { var e = new Error('Burn N is waiting to confirm. Wait about one block, then press Continue.'); e.waitConfirm = true; return e; }
    function host(u) { return String(u).replace(/^https?:\/\//, '').replace(/\/.*$/, ''); }
    var chained = !!(live().length || lastChange), plainRetry = false;
    function go(i) {
      if (i >= urls.length) {
        if (chained && !plainRetry) { if (pendingChain() > 0) throw waitErr(); plainRetry = true; chainClear(); errs.push('retrying without coin exclusions'); return go(0); }  /* hotfix-compose: one clean retry (never while our own burns are unconfirmed) */
        return Promise.reject(new Error('Could not build your burn: every Counterparty node failed. ' + errs.join(' · ')));
      }
      if (onTry) onTry(i + 1, urls.length);
      return call(i, false).catch(function (e) {
        if (!e.retryable && /utxo|insufficient.*btc|not enough|no .*inputs|unconfirmed/i.test(e.message)) return (lastChange ? call(i, 'change').catch(function () { return call(i, 'unconf'); }) : call(i, 'unconf')).catch(function (e2) {
          if (chained && !plainRetry) { if (pendingChain() > 0) throw waitErr(); plainRetry = true; chainClear(); return call(i, false).catch(function (e3) { throw friendly(e3); }); } throw friendly(e2); });
        if (e.retryable) { errs.push(host(urls[i]) + ': ' + e.message); return go(i + 1); }
        throw friendly(e);
      });
    }
    return go(0);
  }
  /** send(plan {tag, amount, label}, viewedAddr) -> Promise<{txid, composed}>: connect, compose (live flow), wallet signs + broadcasts. */
  function send(plan, viewed, onTry) {
    /* family-tree-fix (2026-10-19): no burn tag may be built from an incomplete replay. js/v2-chain.js only sets verified after every block hash
     * checked out; until then refuse before connecting/composing (nothing is signed or sent). */
    var VS = window.V2Mock && window.V2Mock.state && window.V2Mock.state();
    if (VS && VS.prod && !VS.verified) { var ev = new Error("Couldn't verify every block yet" + (VS.missingBlocks && VS.missingBlocks.length ? ' (block ' + VS.missingBlocks[0] + ')' : '') + ', so pet numbers could be wrong. Nothing was burned. Reload the page and press Retry.'); ev.unverified = true; return Promise.reject(ev); }
    if (signing && Date.now() - signing < LOCK_MS) return Promise.reject(busyErr());
    var mine = signing = Date.now();
    function release() { if (signing === mine) signing = 0; }
    function done(x) { release(); return x; }
    return getWallet().then(function (w) {
      if (viewed && viewed !== w.address) { var e = new Error('The connected wallet (' + w.address + ') is not the address shown on this page (' + viewed + '). Reload to view the connected wallet.'); e.reload = true; throw e; }
      if (pendingChain() >= CHAIN_CAP) { var ec = new Error(CHAIN_CAP + ' of your burns are still waiting for their first confirmation (Bitcoin allows about 25 unconfirmed in a row). Wait for the next block, then press Continue.'); ec.chainCap = true; throw ec; }
      return feeRate().then(function (fee) { return composeAt(w.address, plan, fee, onTry); }).then(function (res) {
        return w.signAndBroadcast(res).then(function (r) {
          noteSent(res, r.txid); tracker.add({ txid: r.txid, tag: plan.tag, amount: plan.amount, label: plan.label || plan.tag, at: Date.now(), status: 'sent' });
          return { txid: r.txid, composed: res };
        });
      });
    }).then(done, function (e) { release(); if (e && e.code === -32005) { var b = busyErr(); b.raw = e.message; throw b; } throw e; });
  }
  /* pet-shop-sales: Counterparty DEX order / cancel for the shop (window 1 of a listing, Buy, Cancel). Same nodes, fee rate, wallet lock and
   * XCP Wallet signing as send(); the composed tx is checked against the plan before the wallet window opens. Never called below ACTIVATE_SALES_BLOCK. */
  function dexUrl(base, me, plan, fee) { base = String(base).trim().replace(/\/+$/, ''); if (!/\/v2$/.test(base)) base += '/v2';
    if (/broadcast|sign/i.test(base)) throw new Error('refusing an API base that mentions broadcast/sign');
    var q = plan.kind === 'cancel' ? ['offer_hash=' + encodeURIComponent(plan.offer_hash)]
      : plan.kind === 'issuance' ? ['asset=' + encodeURIComponent(plan.asset), 'quantity=' + Math.round(plan.quantity), 'divisible=' + (plan.divisible ? 'true' : 'false'), 'lock=' + (plan.lock ? 'true' : 'false'), 'description=' + encodeURIComponent(plan.description)]
      : ['give_asset=' + encodeURIComponent(plan.give_asset), 'give_quantity=' + Math.round(plan.give_quantity), 'get_asset=' + encodeURIComponent(plan.get_asset), 'get_quantity=' + Math.round(plan.get_quantity), 'expiration=' + Math.round(plan.expiration), 'fee_required=0'];
    q.push('encoding=opreturn', 'verbose=true', 'validate=true', 'exclude_utxos_with_balances=true', 'sat_per_vbyte=' + fee);
    return base + '/addresses/' + encodeURIComponent(me) + '/compose/' + (plan.kind === 'cancel' ? 'cancel' : plan.kind === 'issuance' ? 'issuance' : 'order') + '?' + q.join('&'); }
  function dexCheck(r, me, plan) { var pr = (r && r.params) || {}, bad = []; if (!r || !/^[0-9a-f]+$/i.test(r.rawtransaction || '')) bad.push('no raw transaction hex'); if (!r || !r.params) bad.push('node did not echo params');
    if (r && r.name && r.name !== plan.kind) bad.push('composed a ' + r.name); if (pr.source && pr.source !== me) bad.push('source differs');
    if (plan.kind === 'cancel') { if (pr.offer_hash && pr.offer_hash !== plan.offer_hash) bad.push('offer differs'); }
    else if (plan.kind === 'issuance') { /* pet token: free numeric asset, 1 unit, indivisible, locked, exact description; never a transfer or a named asset */
      if (!/^A[1-9][0-9]{16,19}$/.test(plan.asset)) bad.push('not a numeric asset');
      if (pr.asset != null && pr.asset !== plan.asset) bad.push('asset differs'); if (pr.quantity != null && Number(pr.quantity) !== 1) bad.push('quantity differs');
      if (pr.divisible != null && !!pr.divisible !== false) bad.push('divisible differs'); if (pr.lock != null && !!pr.lock !== true) bad.push('lock differs');
      if (pr.description != null && pr.description !== plan.description) bad.push('description differs'); if (pr.transfer_destination) bad.push('has a transfer');
      if (pr.fee != null && Number(pr.fee) !== 0) bad.push('asset fee is not 0 (' + pr.fee + ')'); }
    else ['give_asset', 'give_quantity', 'get_asset', 'get_quantity', 'expiration'].forEach(function (k) { if (pr[k] != null && String(pr[k]) !== String(plan[k])) bad.push(k + ' differs'); });
    return bad; }
  function sendDex(plan, viewed) {
    var VS = window.V2Mock && window.V2Mock.state && window.V2Mock.state();
    if (VS && VS.prod && !VS.verified) return Promise.reject(new Error("Couldn't verify every block yet. Nothing was sent. Reload the page and press Retry."));
    if (signing && Date.now() - signing < LOCK_MS) return Promise.reject(busyErr());
    var mine = signing = Date.now(); function release() { if (signing === mine) signing = 0; }
    return getWallet().then(function (w) {
      if (viewed && viewed !== w.address) throw new Error('The connected wallet (' + w.address + ') is not the address shown on this page (' + viewed + ').');
      return feeRate().then(function (fee) { var urls = composeNodes(), errs = [];
        function go(i) { if (i >= urls.length) throw new Error('Could not build the order: every Counterparty node failed. ' + errs.join(' · '));
          return F(dexUrl(urls[i], w.address, plan, fee)).then(function (r) { return r.json(); }).then(function (j) { if (!j || j.error || !j.result) throw new Error((j && j.error) || 'empty response');
            var bad = dexCheck(j.result, w.address, plan); if (bad.length) throw new Error('compose mismatch: ' + bad.join(', ')); return j.result; })
            .catch(function (e) { errs.push(String(urls[i]).replace(/^https?:\/\//, '').replace(/\/.*$/, '') + ': ' + (e.message || e)); return go(i + 1); }); }
        return go(0); }).then(function (res) { return w.signAndBroadcast(res).then(function (r) { noteSent(res, r.txid); tracker.add({ txid: r.txid, tag: plan.kind, amount: 0, label: plan.label || plan.kind, at: Date.now(), status: 'sent' }); return { txid: r.txid, composed: res }; }); });
    }).then(function (x) { release(); return x; }, function (e) { release(); throw e; }); }
  /* wagmi-daily (2026-10-22): a successful connect marks this tab so play.html can offer WAGMI once (survives the reload to the connected address). */
  var OFFER_KEY = 'xcpets-wagmi-connect';
  function connect() { return getWallet().then(function (w) { try { win.sessionStorage.setItem(OFFER_KEY, w.address); } catch (e) { }
    try { if (win.dispatchEvent && win.CustomEvent) win.dispatchEvent(new win.CustomEvent('xcpets:connected', { detail: { address: w.address } })); } catch (e) { } return w.address; }); }
  /** paint the play.html top bar: viewed address + connect / connected state. */
  function paint(ME, $) {
    var c = $('wconnect'); if (!c) return;
    $('me').textContent = ME ? ME + (wallet && wallet.address === ME ? ' (XCP Wallet)' : (function () { try { return store.getItem(ADDR_KEY) === ME; } catch (e) { return false; } })() ? ' (XCP Wallet: reconnects when you burn)' : ' (view only: connect to burn)') : 'not connected';
    c.textContent = wallet && wallet.address === ME ? '✓ XCP Wallet connected' : (function () { try { return store.getItem(ADDR_KEY) === ME; } catch (e) { return false; } })() ? '✓ XCP Wallet (reconnect)' : 'Connect XCP Wallet'; c.disabled = false;
    if (!c._v2) { c._v2 = 1; c.onclick = function () { var m = $('wMsg'); if (m) m.textContent = 'Looking for XCP Wallet…';
      connect().then(function (a) { if (a !== ME && win.location) return win.location.reload(); if (m) m.textContent = 'Connected.'; paint(ME, $); }, function (e) { if (m) m.innerHTML = (win.V2Wallet && win.V2Wallet.errHtml || errHtml)(e); }); }; }
  }
  return { _signLock: function () { return signing; }, send: send, sendDex: sendDex, _dexUrl: dexUrl, _dexCheck: dexCheck, connect: connect, paint: paint, errHtml: errHtml, composeAt: composeAt, errText: errText, decodeTx: decodeTx, _spent: function () { return live(); }, _chainClear: chainClear, pendingChain: pendingChain, CHAIN_CAP: CHAIN_CAP, composeUrl: composeUrl, composeNodes: composeNodes, feeRate: feeRate, tracker: tracker, getWallet: getWallet,
    reset: function () { wallet = null; locked = false; }, _locked: function () { return locked; }, current: function () { return wallet && wallet.address; } };
});
