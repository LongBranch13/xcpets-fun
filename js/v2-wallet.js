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
  else { root.V2Wallet = make({ Wallet: root.Wallet, BurnCore: root.BurnCore, CFG: root.XCPETS_CONFIG, win: root, fetch: root.fetch && root.fetch.bind(root), storage: root.localStorage }); try { root.V2Wallet.autoBoot(); } catch (e) { } }
})(typeof self !== 'undefined' ? self : this, function (d) {
  'use strict';
  var Wallet = d.Wallet, BurnCore = d.BurnCore, CFG = d.CFG, win = d.win, F = d.fetch, store = d.storage;
  var NET = CFG.network, ME_KEY = 'xcpets-v2-me', ADDR_KEY = 'xcpets-xcpwallet-address', COMPOSE_MS = d.composeMs != null ? d.composeMs : 12000, BACKOFF = d.backoffMs != null ? d.backoffMs : 1500, wallet = null;
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
          hook(p); remember(); emit();
          return x;
        });
      });
    }).then(function (x) { connecting = null; return x; }, function (e) { connecting = null; throw e; }));
  }
  /* burn-compose-fix (2026-10-24): every network step before the XCP Wallet window has a deadline, so a stalled server can never leave the
   * burn modal on "building..." forever. withTimeout rejects with a plain message; nothing is signed or sent on a timeout. */
  function withTimeout(p, ms, msg, flag) { var t; return Promise.race([Promise.resolve(p), new Promise(function (_, j) { t = setTimeout(function () { var e = new Error(msg); e.timeout = true; if (flag) e[flag] = true; j(e); }, ms); })])
    .then(function (x) { clearTimeout(t); return x; }, function (e) { clearTimeout(t); throw e; }); }
  var FEE_MS = d.feeMs != null ? d.feeMs : 8000, COMPOSE_TOTAL_MS = d.composeTotalMs != null ? d.composeTotalMs : 90000, FRESH_MS = d.freshMs != null ? d.freshMs : 45000; /* direct-counterparty-api: was 120 s of spinner */
  function feeRate() {
    return withTimeout(F(CFG.mempoolApi + '/v1/fees/recommended').then(function (r) { return r.json(); }), FEE_MS, 'fee rate timed out')
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
    var raw = BurnCore.toRaw(amt(plan.amount)), exp = { address: me, quantityRaw: raw, tag: plan.tag, satPerVbyte: fee }, urls = composeNodes(), errs = [];
    function call(i, mode, tries) {
      tries = tries || 0; var url = composeUrl(me, plan, fee, urls[i]) + chainOpts(mode);
      var ac = typeof AbortController !== 'undefined' ? new AbortController() : null, t = ac && setTimeout(function () { ac.abort(); }, COMPOSE_MS);
      var done = false, bodyT = null; /* burn-compose-fix: the abort timer also covers reading the body (a stalled body used to hang forever) */
      var body = function (r) { return new Promise(function (res, rej) { bodyT = setTimeout(function () { var e6 = new Error('timed out after ' + COMPOSE_MS / 1000 + ' s reading the reply'); e6.retryable = true; e6.backoff = true; rej(e6); }, COMPOSE_MS); Promise.resolve(r.json()).then(res, function (e) { var e7 = new Error('unreadable reply (' + ((e && e.message) || 'bad JSON') + ')'); e7.retryable = true; e7.backoff = true; rej(e7); }); }).then(function (x) { clearTimeout(bodyT); return x; }, function (e) { clearTimeout(bodyT); throw e; }); };
      return F(url, ac ? { signal: ac.signal } : {}).then(function (r) { if (t) clearTimeout(t); if (r.status === 429 || r.status >= 500) { var e5 = new Error('node error HTTP ' + r.status + (r.status === 429 ? ' (rate limited)' : '')); e5.retryable = true; e5.backoff = true; throw e5; } return body(r); }, function (e) {
        if (t) clearTimeout(t); var e2 = new Error(e && e.name === 'AbortError' ? 'timed out after ' + COMPOSE_MS / 1000 + ' s' : 'no response (' + ((e && e.message) || 'network error') + '; offline, blocked, or a rate limit without CORS)'); e2.retryable = true; e2.backoff = true; throw e2; })
        .then(function (j) {
          if (!j || typeof j !== 'object') { var e8 = new Error('empty reply'); e8.retryable = true; throw e8; }
          if (j.error) { var e3 = new Error(typeof j.error === 'string' ? j.error : JSON.stringify(j.error)); e3.retryable = /unsupported node operation|not ready|unavailable/i.test(e3.message); throw e3; }
          if (onTry) onTry(i + 1, urls.length, 'check'); var chk; try { chk = BurnCore.checkComposeResult(j.result, exp); } catch (ce) { chk = { ok: false, problems: ['safety check error: ' + ((ce && ce.message) || ce)] }; } if (!chk.ok) { var e4 = new Error('Safety check stopped this burn before signing (nothing was signed or sent): ' + chk.problems.join(', ')); e4.retryable = true; throw e4; }
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
    return withTimeout(go(0), COMPOSE_TOTAL_MS, 'Could not build your burn within ' + Math.round(COMPOSE_TOTAL_MS / 1000) + ' s: the Counterparty nodes are slow or rate-limiting right now. Nothing was signed or sent. Wait a minute, then press Continue.' + (errs.length ? ' (' + errs.join(' · ') + ')' : ''), 'composeTimeout');
  }
  /** send(plan {tag, amount, label}, viewedAddr) -> Promise<{txid, composed}>: connect, compose (live flow), wallet signs + broadcasts. */
  /* site-fast-reread: pressed while the page still shows the saved copy -> wait for the chain re-read (V2Mock.whenFresh), then go on only if the
   * burns + sale data are unchanged; otherwise stop with nothing sent so the player looks again. The verified gate inside is unchanged. */
  /* burn-stale-fix (2026-10-24): the old check stopped on ANY new burn by anyone (row count changed), so the first press after a page load
   * from the saved copy almost always stopped. Now, when new activity came in, recheck(snap) (from the page) re-judges THIS burn against the
   * fresh, verified replay: the same pets, owner, costs and balance -> go on; something that matters changed -> stop with what changed.
   * No recheck given -> the old strict stop. send0's verified gate still runs after this. */
  function staleErr(why) { var e = new Error(why ? 'New chain activity just came in: ' + why + '. Nothing was sent. Check it and press again.' : 'New chain activity just came in, so we double-checked. Nothing was sent. Press again.'); e.stale = true; return e; }
  function send(plan, viewed, onTry, recheck) { var VS = window.V2Mock && window.V2Mock.state && window.V2Mock.state();
    if (!(VS && VS.prod && VS.stale && !VS.verified && window.V2Mock.whenFresh)) return send0(plan, viewed, onTry);
    if (onTry) onTry(0, 0, 'fresh'); var snap = recheck && recheck.snap ? recheck.snap() : null;
    return withTimeout(window.V2Mock.whenFresh(), FRESH_MS, 'The Counterparty servers did not answer in time, so the safety check on your pet numbers could not finish. Nothing was signed or sent. Press Retry in a moment.').then(function (r) {
      if (!r.ok) { var ef = new Error('Could not reach the Counterparty servers, so the safety check on your pet numbers could not finish. Nothing was signed or sent. Press Retry in a moment.'); ef.unverified = true; ef.retry = true; throw ef; }
      if (r.ok && !r.same) { var why = recheck && recheck.still ? recheck.still(snap) : ''; if (why !== null) throw staleErr(why); }
      return send0(plan, viewed, onTry); }); }
  function send0(plan, viewed, onTry) {
    /* family-tree-fix (2026-10-19): no burn tag may be built from an incomplete replay. js/v2-chain.js only sets verified after every block hash
     * checked out; until then refuse before connecting/composing (nothing is signed or sent). */
    var VS = window.V2Mock && window.V2Mock.state && window.V2Mock.state();
    if (VS && VS.prod && !VS.verified) { var ev = new Error(VS.stale ? 'Still checking the latest chain data, so pet numbers could be out of date. Nothing was burned. Try again in a moment.' : "Couldn't verify every block yet" + (VS.missingBlocks && VS.missingBlocks.length ? ' (block ' + VS.missingBlocks[0] + ')' : '') + ', so pet numbers could be wrong. Nothing was burned. Reload the page and press Retry.'); ev.unverified = true; return Promise.reject(ev); }
    if (signing && Date.now() - signing < LOCK_MS) return Promise.reject(busyErr());
    var mine = signing = Date.now();
    function release() { if (signing === mine) signing = 0; }
    function done(x) { release(); return x; }
    return getWallet().then(function (w) {
      if (viewed && viewed !== w.address) { var e = new Error('The connected wallet (' + w.address + ') is not the address shown on this page (' + viewed + '). Reload to view the connected wallet.'); e.reload = true; throw e; }
      if (pendingChain() >= CHAIN_CAP) { var ec = new Error(CHAIN_CAP + ' of your burns are still waiting for their first confirmation (Bitcoin allows about 25 unconfirmed in a row). Wait for the next block, then press Continue.'); ec.chainCap = true; throw ec; }
      if (onTry) onTry(0, 0, 'fee');
      return feeRate().then(function (fee) { return composeAt(w.address, plan, fee, onTry); }).then(function (res) {
        if (onTry) onTry(0, 0, 'sign');
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
    var q = plan.kind === 'send' ? ['destination=' + encodeURIComponent(plan.destination), 'asset=' + encodeURIComponent(plan.asset), 'quantity=1']
      : plan.kind === 'mpma' ? ['assets=' + plan.assets.map(encodeURIComponent).join(','), 'destinations=' + plan.assets.map(function () { return encodeURIComponent(plan.destination); }).join(','), 'quantities=' + plan.assets.map(function () { return '1'; }).join(',')]
      : plan.kind === 'cancel' ? ['offer_hash=' + encodeURIComponent(plan.offer_hash)]
      : plan.kind === 'issuance' ? ['asset=' + encodeURIComponent(plan.asset), 'quantity=' + Math.round(plan.quantity), 'divisible=' + (plan.divisible ? 'true' : 'false'), 'lock=' + (plan.lock ? 'true' : 'false'), 'description=' + encodeURIComponent(plan.description)]
      : ['give_asset=' + encodeURIComponent(plan.give_asset), 'give_quantity=' + Math.round(plan.give_quantity), 'get_asset=' + encodeURIComponent(plan.get_asset), 'get_quantity=' + Math.round(plan.get_quantity), 'expiration=' + Math.round(plan.expiration), 'fee_required=0'];
    q.push('encoding=' + (plan.kind === 'mpma' ? 'auto' : 'opreturn'), 'verbose=true', 'validate=true', 'exclude_utxos_with_balances=true', 'sat_per_vbyte=' + fee);
    return base + '/addresses/' + encodeURIComponent(me) + '/compose/' + (plan.kind === 'send' ? 'send' : plan.kind === 'mpma' ? 'mpma' : plan.kind === 'cancel' ? 'cancel' : plan.kind === 'issuance' ? 'issuance' : 'order') + '?' + q.join('&'); }
  /** validAddr(a): mainnet bc1 (bech32/bech32m, lowercase), 1... or 3... (base58) */
  function validAddr(a) { a = String(a || ''); return /^bc1[qp][02-9ac-hj-np-z]{38,58}$/.test(a) || /^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/.test(a); }
  function dexCheck(r, me, plan, fee) { var pr = (r && r.params) || {}, bad = []; if (!r || !/^[0-9a-f]+$/i.test(r.rawtransaction || '')) bad.push('no raw transaction hex'); if (!r || !r.params) bad.push('node did not echo params');
    if (r && r.name !== (plan.kind === 'send' || plan.kind === 'mpma' || plan.kind === 'cancel' || plan.kind === 'issuance' ? plan.kind : 'order')) bad.push(r && r.name ? 'composed a ' + r.name : 'node did not say what it composed'); if (pr.source !== me) bad.push(pr.source == null ? 'source missing' : 'source differs');
    if (plan.kind === 'send' || plan.kind === 'mpma') { /* pet-token gift: only pet tokens, quantity 1 each, one recipient; never XCP/XCPETS */
      var as = plan.kind === 'send' ? [plan.asset] : plan.assets || [], seen = {};
      if (!as.length || as.some(function (a) { return !/^A[1-9][0-9]{16,19}$/.test(a) || seen[a] || !(seen[a] = 1); })) bad.push('not distinct pet tokens');
      if (!validAddr(plan.destination) || plan.destination === me) bad.push('bad recipient');
      if (plan.kind === 'send') { if (pr.asset !== plan.asset) bad.push('asset differs'); if (pr.quantity == null || Number(pr.quantity) !== 1) bad.push('quantity differs'); if (pr.destination !== plan.destination) bad.push('destination differs'); }
      else { var L = pr.asset_dest_quant_list; if (!Array.isArray(L) || (L.length !== as.length || L.some(function (x, i) { return x[0] !== as[i] || x[1] !== plan.destination || Number(x[2]) !== 1; }))) bad.push('bundle differs');
        if (pr.assets != null) { var pa = String(pr.assets).split(','); if (pa.join(',') !== as.join(',')) bad.push('assets differ'); } } }
    else if (plan.kind === 'cancel') { if (pr.offer_hash !== plan.offer_hash) bad.push('offer differs'); }
    else if (plan.kind === 'issuance') { /* pet token: free numeric asset, 1 unit, indivisible, locked, exact description; never a transfer or a named asset */
      if (!/^A[1-9][0-9]{16,19}$/.test(plan.asset)) bad.push('not a numeric asset');
      var wantQ = plan.quantity != null ? plan.quantity : 1, wantL = plan.lock != null ? !!plan.lock : true; /* 1 + locked for a new token; the token-proof fix plan says 0 + unlocked */
      if (pr.asset !== plan.asset) bad.push('asset differs'); if (pr.quantity == null || Number(pr.quantity) !== wantQ) bad.push('quantity differs');
      if (pr.divisible == null || !!pr.divisible !== false) bad.push('divisible differs'); if (pr.lock == null || !!pr.lock !== wantL) bad.push('lock differs');
      if (pr.description !== plan.description) bad.push('description differs'); if (pr.transfer_destination) bad.push('has a transfer');
      if (pr.fee != null && Number(pr.fee) !== 0) bad.push('asset fee is not 0 (' + pr.fee + ')'); }
    else ['give_asset', 'give_quantity', 'get_asset', 'get_quantity', 'expiration'].forEach(function (k) { if (pr[k] == null || String(pr[k]) !== String(plan[k])) bad.push(k + (pr[k] == null ? ' missing' : ' differs')); });
    bad = bad.concat(BurnCore.checkDexTx(r, me, plan, fee));
    return bad; }
  /* site-fast-reread: pressed while the page still shows the saved copy -> wait for the chain re-read (V2Mock.whenFresh), then go on only if the
   * burns + sale data are unchanged; otherwise stop with nothing sent so the player looks again. The verified gate inside is unchanged. */
  /* post-buy-fixes: pending-list entry for a DEX order / cancel / send / token issue. Orders log what they really give (whole XCPETS when the
   * give asset is XCPETS); everything else logs no amount and an action word, so the list never says "0 XCPETS". */
  function dexEntry(plan, txid) { var give = null, act = { order: 'order', cancel: 'cancel', issuance: 'token', send: 'send', mpma: 'send' }[plan.kind] || plan.kind;
    if (plan.give_asset && plan.give_quantity != null) give = { asset: plan.give_asset, qty: plan.give_quantity / (plan.give_asset === 'XCPETS' || plan.give_asset === 'XCP' ? 1e8 : 1) };
    return { txid: txid, tag: plan.kind, kind: 'dex', act: act, amount: give && give.asset === 'XCPETS' ? give.qty : null, give: give, label: plan.label || plan.kind, at: Date.now(), status: 'sent' }; }
  /* post-buy-fixes: orders and token issues never show up in the burn rows, so their pending lines used to wait forever. Ask mempool.space
   * whether each unconfirmed tracked tx has a block (at most once a minute); confirmed lines drop off the pending list. Read only. */
  var pollAt = 0, pollP = null;
  function pollPending() { if (pollP || Date.now() - pollAt < 60000) return pollP || Promise.resolve(0); pollAt = Date.now();
    pollP = tracker.poll(function (txid) { return F('https://mempool.space/api/tx/' + encodeURIComponent(txid) + '/status').then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { return j ? { confirmed: !!j.confirmed, block: j.block_height, seen: true } : null; }, function () { return null; }); })
      .then(function (n) { pollP = null; return n; }, function () { pollP = null; return 0; }); return pollP; }
  function sendDex(plan, viewed) { var VS = window.V2Mock && window.V2Mock.state && window.V2Mock.state();
    if (!(VS && VS.prod && VS.stale && !VS.verified && window.V2Mock.whenFresh)) return sendDex0(plan, viewed);
    return window.V2Mock.whenFresh().then(function (r) { if (r.ok && !r.same) throw staleErr();
      return sendDex0(plan, viewed); }); }
  function sendDex0(plan, viewed) {
    var VS = window.V2Mock && window.V2Mock.state && window.V2Mock.state();
    if (VS && VS.prod && !VS.verified) return Promise.reject(new Error(VS.stale ? 'Still checking the latest chain data. Nothing was sent. Try again in a moment.' : "Couldn't verify every block yet. Nothing was sent. Reload the page and press Retry."));
    if (signing && Date.now() - signing < LOCK_MS) return Promise.reject(busyErr());
    var mine = signing = Date.now(); function release() { if (signing === mine) signing = 0; }
    return getWallet().then(function (w) {
      if (viewed && viewed !== w.address) throw new Error('The connected wallet (' + w.address + ') is not the address shown on this page (' + viewed + ').');
      return feeRate().then(function (fee) { var urls = composeNodes(), errs = [], extra = '', tried = false;
        /* buy-fix 2026-10-24: a node says "No UTXOs found" when the wallet's only bitcoin is unconfirmed change (e.g. from a burn/order still in the
         * mempool). Like the burn flow, read the address's UTXOs from mempool.space and retry once with inputs_set + allow_unconfirmed_inputs. */
        function noUtxo() { return errs.length && errs.every(function (e) { return /no utxos/i.test(e); }); }
        function retryUtxos() { tried = true; return F('https://mempool.space/api/address/' + encodeURIComponent(w.address) + '/utxo').then(function (r) { return r.json(); }).then(function (u) {
            u = (Array.isArray(u) ? u : []).filter(function (x) { return x && /^[0-9a-f]{64}$/.test(x.txid) && x.value > 1000; });
            if (!u.length) throw new Error('This wallet has no bitcoin to pay the network fee. Add a little BTC to ' + w.address + ' and try again. Nothing was sent.');
            extra = '&inputs_set=' + encodeURIComponent(u.map(function (x) { return x.txid + ':' + x.vout; }).join(',')) + '&allow_unconfirmed_inputs=true'; errs = []; return go(0); }); }
        function go(i) { if (i >= urls.length) { if (!tried && noUtxo()) return retryUtxos(); var E = new Error(/safety check/i.test(errs.join(' ')) ? 'The safety check stopped this order before signing. Nothing was sent. Reload the page and try again.' : /insufficient|balance/i.test(errs.join(' ')) ? 'This wallet does not hold enough to pay for this. Nothing was sent.' : 'The Counterparty servers could not build this order right now. Nothing was sent. Try again in a minute.'); E.raw = errs.join(' · '); try { console.warn('[xcpets] order compose failed:', E.raw); } catch (x) {} throw E; }
          return F(dexUrl(urls[i], w.address, plan, fee) + extra).then(function (r) { return r.json(); }).then(function (j) { if (!j || j.error || !j.result) throw new Error((j && j.error) || 'empty response');
            var bad = dexCheck(j.result, w.address, plan, fee); if (bad.length) throw new Error('Safety check stopped this before signing (nothing was signed or sent): ' + bad.join(', ')); return j.result; })
            .catch(function (e) { errs.push(String(urls[i]).replace(/^https?:\/\//, '').replace(/\/.*$/, '') + ': ' + (e.message || e)); return go(i + 1); }); }
        return go(0); }).then(function (res) { return w.signAndBroadcast(res).then(function (r) { noteSent(res, r.txid); tracker.add(dexEntry(plan, r.txid)); return { txid: r.txid, composed: res }; }); });
    }).then(function (x) { release(); return x; }, function (e) { release(); throw e; }); }
  /* player-qol 2026-10-24 (owner relaying a player: "my page will often disconnect from wallet, I'm always checking/reconnecting").
   * Root cause: the connected wallet lived only in this page's memory (var wallet). XCPETS is a multi-page site, so every page load, reload
   * (incl. the auto-reload after an account switch) or tab discard started disconnected and the top bar said "reconnects when you burn";
   * XCP Wallet's auto-lock also emits accountsChanged [] (we set locked but showed nothing). Fix: remember that this browser connected
   * (provider kind + public address only: never keys), and silently re-attach with xcp_accounts (no popup; [] when locked/not connected)
   * on load, on tab focus and when the tab becomes visible; track accountsChanged / disconnect; show a small status pill with one-tap reconnect. */
  var PROV_KEY = 'xcpets-v2-wallet-provider', hooked = null, lastPaint = null, silentAt = 0, silentP = null;
  function get(k) { try { return store.getItem(k); } catch (e) { return null; } }
  function remember() { try { store.setItem(PROV_KEY, 'xcpwallet'); } catch (e) { } }
  function forget() { try { store.removeItem(PROV_KEY); } catch (e) { } }
  function status() { return wallet && !locked ? 'on' : wallet && locked ? 'locked' : get(PROV_KEY) ? 'off' : 'none'; }
  function emit() { try { if (win.dispatchEvent && win.CustomEvent) win.dispatchEvent(new win.CustomEvent('xcpets:wallet', { detail: { status: status(), address: wallet && wallet.address } })); } catch (e) { }
    if (lastPaint) try { paint(lastPaint[0], lastPaint[1]); } catch (e) { } pill(); }
  function hook(p) { if (!p || !p.on || hooked === p) return; hooked = p;
    p.on('accountsChanged', function (a) { if (!wallet) { silent(true); return; }
      if (!a || !a[0]) { locked = true; emit(); return; } if (a[0] === wallet.address) { locked = false; emit(); return; } /* same address re-emitted on unlock: no reload */
      wallet.address = a[0]; setMe(a[0]); if (win.location) win.location.reload(); });
    p.on('disconnect', function () { wallet = null; locked = false; forget(); emit(); }); }
  /** silent(force): re-attach to an already-approved XCP Wallet without opening any window. Resolves the address or null. */
  function silent(force) {
    if (wallet && !locked && !force) return Promise.resolve(wallet.address);
    if (connecting) return connecting.then(function (x) { return x && x.address; }, function () { return null; });
    if (silentP) return silentP; if (!force && Date.now() - silentAt < 2000) return Promise.resolve(wallet && !locked ? wallet.address : null); silentAt = Date.now();
    return (silentP = waitForXcp(wallet || get(PROV_KEY) ? 2000 : 600).then(function (p) {
      if (!p || !p.request) return null; hook(p);
      return p.request({ method: 'xcp_accounts' }).then(function (r) { var a = Array.isArray(r) ? r[0] : r && r.accounts && r.accounts[0];
        if (!a) { if (wallet) locked = true; return null; }
        if (wallet && wallet.address === a) { locked = false; return a; }
        if (wallet && wallet.address !== a) return null; /* a different account: the accountsChanged handler reloads for it */
        var x = new Wallet.Wallet({ kind: 'xcpwallet', label: 'XCP Wallet', p: p }); x.address = a;
        return x.network().then(function (n) { if (n && n !== NET && !(NET !== 'mainnet' && /test|signet/.test(n))) return null;
          wallet = guard(x); locked = false; remember(); loadSpent(a); if (!get(ME_KEY)) setMe(a); else try { store.setItem(ADDR_KEY, a); } catch (e) { } return a; });
      }, function () { return null; });
    }).then(function (a) { silentP = null; emit(); return a; }, function () { silentP = null; emit(); return null; })); }
  function short(a) { return a ? a.slice(0, 6) + '…' + a.slice(-4) : ''; }
  var PILL_CSS = '#xwPill{position:fixed;left:8px;bottom:8px;z-index:9000;display:flex;align-items:center;gap:6px;padding:4px 8px;font:inherit;font-size:12px;line-height:1.2;background:#0d1410;color:#e8f5ec;border:2px solid #2a3a2e;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.45);max-width:calc(100vw - 16px)}' +
    '#xwPill .xwdot{width:10px;height:10px;flex:0 0 10px;image-rendering:pixelated;background:#ff5a5a;box-shadow:0 0 0 2px #000}#xwPill.on .xwdot{background:#3ddc84}#xwPill.locked .xwdot{background:#ffc93c}#xwPill.on{border-color:#3ddc84}#xwPill.locked{border-color:#ffc93c}#xwPill.off{border-color:#ff5a5a}' +
    '#xwPill button{font:inherit;font-size:12px;padding:4px 8px;min-height:32px;cursor:pointer;background:#1d2b23;color:#fff;border:1px solid #3ddc84;border-radius:6px}#xwPill .xwt{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '@media (max-width:600px){#xwPill{left:6px;bottom:calc(6px + env(safe-area-inset-bottom,0px));font-size:11px;padding:3px 6px}#xwPill .xwlong{display:none}}';
  function pill() { var doc = win.document; if (!doc || !doc.body || !doc.createElement) return; var st = status(), el = doc.getElementById('xwPill');
    if (st === 'none') { if (el) el.hidden = true; return; }
    if (!el) { if (!doc.getElementById('xwCss')) { var c = doc.createElement('style'); c.id = 'xwCss'; c.textContent = PILL_CSS; (doc.head || doc.body).appendChild(c); }
      el = doc.createElement('div'); el.id = 'xwPill'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); doc.body.appendChild(el); }
    el.hidden = false; el.className = st;
    var txt = st === 'on' ? 'Wallet connected <span class="xwlong">' + esc(short(wallet.address)) + '</span>' : st === 'locked' ? 'Wallet locked' : 'Wallet disconnected';
    el.innerHTML = '<span class="xwdot" aria-hidden="true"></span><span class="xwt">' + txt + '</span>' + (st === 'on' ? '' : '<button type="button" id="xwRe">' + (st === 'locked' ? 'Unlock' : 'Reconnect') + '</button>');
    el.title = st === 'on' ? 'XCP Wallet connected: ' + wallet.address : 'Tap to reconnect XCP Wallet (opens the XCP Wallet window)';
    var b = el.querySelector('#xwRe'); if (b) b.onclick = function () { b.disabled = true; b.textContent = '…'; connect().then(function (a) { var me = get(ME_KEY); if (me && a !== me && win.location && /play\.html/.test(win.location.pathname || '')) win.location.reload(); }, function (e) { b.disabled = false; b.textContent = 'Retry'; el.title = errText(e); }); }; }
  function autoBoot() { var doc = win.document; if (!doc) return;
    var go = function () { pill(); silent(); };
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', go); else go();
    doc.addEventListener('visibilitychange', function () { if (doc.visibilityState === 'visible') silent(); });
    win.addEventListener('focus', function () { silent(); });
    win.addEventListener('pageshow', function (e) { if (e && e.persisted) silent(true); }); }
  /* wagmi-daily (2026-10-22): a successful connect marks this tab so play.html can offer WAGMI once (survives the reload to the connected address). */
  var OFFER_KEY = 'xcpets-wagmi-connect';
  function connect() { return getWallet().then(function (w) { remember(); emit(); try { win.sessionStorage.setItem(OFFER_KEY, w.address); } catch (e) { }
    try { if (win.dispatchEvent && win.CustomEvent) win.dispatchEvent(new win.CustomEvent('xcpets:connected', { detail: { address: w.address } })); } catch (e) { } return w.address; }); }
  /** paint the play.html top bar: viewed address + connect / connected state. */
  function paint(ME, $) {
    lastPaint = [ME, $]; var c = $('wconnect'); if (!c) return;
    $('me').textContent = ME ? ME + (wallet && wallet.address === ME ? ' (XCP Wallet)' : (function () { try { return store.getItem(ADDR_KEY) === ME; } catch (e) { return false; } })() ? (locked && wallet ? ' (XCP Wallet locked: tap Unlock)' : ' (XCP Wallet: not attached, tap Reconnect)') : ' (view only: connect to burn)') : 'not connected';
    c.textContent = wallet && wallet.address === ME ? '✓ XCP Wallet connected' : (function () { try { return store.getItem(ADDR_KEY) === ME; } catch (e) { return false; } })() ? '↻ Reconnect XCP Wallet' : 'Connect XCP Wallet'; c.disabled = false;
    if (!c._v2) { c._v2 = 1; c.onclick = function () { var m = $('wMsg'); if (m) m.textContent = 'Looking for XCP Wallet…';
      connect().then(function (a) { if (a !== ME && win.location) return win.location.reload(); if (m) m.textContent = 'Connected.'; paint(ME, $); }, function (e) { if (m) m.innerHTML = (win.V2Wallet && win.V2Wallet.errHtml || errHtml)(e); }); }; }
  }
  return { pollPending: pollPending, _dexEntry: dexEntry, _signLock: function () { return signing; }, send: send, sendDex: sendDex, _dexUrl: dexUrl, _dexCheck: dexCheck, validAddr: validAddr, connect: connect, paint: paint, errHtml: errHtml, composeAt: composeAt, errText: errText, decodeTx: decodeTx, _spent: function () { return live(); }, _chainClear: chainClear, pendingChain: pendingChain, CHAIN_CAP: CHAIN_CAP, composeUrl: composeUrl, composeNodes: composeNodes, feeRate: feeRate, tracker: tracker, getWallet: getWallet,
    reset: function () { wallet = null; locked = false; }, silent: silent, status: status, autoBoot: autoBoot, _locked: function () { return locked; }, current: function () { return wallet && wallet.address; } };
});
