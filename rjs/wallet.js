/*!
 * XCPETS wallet.js — wallet adapter for click-to-burn (mirrors Civic Garage / milliondollarbillboard.net):
 *   1. connect: XCP Wallet  window.xcpwallet.request({method:'xcp_requestAccounts'}) -> {accounts:[addr], proof:{address,message,signature,verification}}
 *   2. the PAGE composes the unsigned destroy (Counterparty API compose/destroy)
 *   3. XCP Wallet  xcp_signTransaction params [{hex}] -> {hex}   (user reviews + approves in the extension popup)
 *   4. XCP Wallet  xcp_broadcastTransaction params [signedHex] -> {txid}
 * Provider docs: https://github.com/XCP/extension/blob/main/PROVIDER.md
 * Fallback: Horizon Wallet (window.HorizonWalletProvider, xcp_signPsbt — UNVERIFIED shape, sign only) then copy hex / QR.
 * This file holds no keys and never signs anything itself: every signature happens in the user's wallet after their approval.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.Wallet = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var ERR = {
    4001: 'You cancelled in the wallet.', 4100: 'Wallet locked or not connected: unlock XCP Wallet and connect again.', 4200: 'This wallet does not support that request.',
    '-32602': 'The wallet refused the request: ', '-32005': 'Too many wallet requests: finish or close any open XCP Wallet window, then try again.', '-32603': 'Wallet error.'
  };
  function errMsg(e) {
    if (!e) return 'Wallet request failed.';
    if (e.code === 4900) return e.data && e.data.reloadRequired ? 'XCP Wallet was updated or restarted: reload this page.' : 'Wallet is starting up: try again.';
    if (e.code === -32602) return ERR['-32602'] + (e.message || '');
    return ERR[e.code] || e.message || 'Wallet request failed.';
  }
  function detect(win) {
    win = win || (typeof window !== 'undefined' ? window : {});
    if (win.xcpwallet) return { kind: 'xcpwallet', label: 'XCP Wallet', p: win.xcpwallet };
    if (win.HorizonWalletProvider) return { kind: 'horizon', label: 'Horizon Wallet', p: win.HorizonWalletProvider };
    return null;
  }
  /** Ask XCP Wallet to announce itself (it fires xcp-wallet#initialized). */
  function discover(win, cb) {
    if (!win || !win.addEventListener) return;
    win.addEventListener('xcp-wallet#initialized', function () { cb(detect(win)); });
    try { win.dispatchEvent(new win.Event('xcp-wallet#discover')); } catch (e) { /* old browsers */ }
  }
  function Wallet(w) { this.w = w; this.address = null; this.proof = null; }
  Wallet.prototype.connect = function () {
    var self = this, w = this.w;
    if (w.kind === 'xcpwallet') return w.p.request({ method: 'xcp_requestAccounts' }).then(function (r) {
      self.address = (r && r.accounts && r.accounts[0]) || (Array.isArray(r) ? r[0] : null);
      self.proof = r && r.proof && r.proof.address === self.address ? r.proof : null;
      return { address: self.address, proof: self.proof };
    });
    return w.p.request('getAddresses').then(function (r) {
      var list = (r && r.result && r.result.addresses) || [];
      self.address = list.length ? list[0].address : null; return { address: self.address, proof: null };
    });
  };
  Wallet.prototype.network = function () {
    if (this.w.kind !== 'xcpwallet') return Promise.resolve(null);
    return this.w.p.request({ method: 'xcp_getNetwork' }).catch(function () { return null; });
  };
  Wallet.prototype.signMessage = function (msg) {
    if (this.w.kind === 'xcpwallet') return this.w.p.request({ method: 'xcp_signMessage', params: [msg, this.address] }).then(function (s) { return typeof s === 'string' ? s : s && s.signature; });
    return this.w.p.request('signMessage', { message: msg, address: this.address }).then(function (r) { return r && r.result && r.result.signature; });
  };
  /** XCP Wallet: sign + broadcast an unsigned hex. Resolves {txid}. Horizon: resolves {signedPsbt} (site cannot broadcast a PSBT; copy it). */
  Wallet.prototype.signAndBroadcast = function (composed) {
    var p = this.w.p;
    if (this.w.kind === 'xcpwallet') {
      return p.request({ method: 'xcp_signTransaction', params: [{ hex: composed.rawtransaction }] }).then(function (r) {
        var hex = typeof r === 'string' ? r : r && r.hex;
        if (!hex || !/^[0-9a-f]+$/i.test(hex)) throw new Error('wallet returned no signed hex');
        return p.request({ method: 'xcp_broadcastTransaction', params: [hex] });
      }).then(function (b) { if (!b || !/^[0-9a-f]{64}$/i.test(b.txid || '')) throw new Error('wallet returned no txid'); return { txid: b.txid }; });
    }
    if (!composed.psbt) return Promise.reject(new Error('Horizon needs a PSBT; this node returned only hex. Copy the hex instead.'));
    var signIn = {}; signIn[this.address] = (composed.inputs_count ? Array.apply(null, Array(composed.inputs_count)).map(function (_, i) { return i; }) : [0]);
    return p.request('xcp_signPsbt', { psbt: composed.psbt, signInputs: signIn }).then(function (r) { return { signedPsbt: (r && (r.result && r.result.psbt || r.psbt)) || r }; });
  };
  /** Pending-tx tracker. statusFn(txid) -> Promise<{confirmed:bool, block?:n} | null>. Stored per network in storage. */
  function Tracker(storage, key) { this.s = storage; this.k = key; }
  Tracker.prototype.list = function () { try { return JSON.parse(this.s.getItem(this.k) || '[]'); } catch (e) { return []; } };
  Tracker.prototype.save = function (l) { this.s.setItem(this.k, JSON.stringify(l)); };
  Tracker.prototype.add = function (tx) { var l = this.list().filter(function (x) { return x.txid !== tx.txid; }); l.push(tx); this.save(l); return tx; };
  /** Resolves the number of txs that newly confirmed. api-hardening (2026-10-27): with tip given, a tx confirmed fewer than 6 blocks below the tip
   *  is checked again; if the source now says it is not in a block (a reorg dropped that block), it goes back to mempool / sent (t.reorged). */
  Tracker.prototype.poll = function (statusFn, tip) {
    var self = this, l = this.list();
    return Promise.all(l.map(function (t) {
      if (t.status === 'confirmed') { if (!(tip > 0 && t.block > tip - 6)) return 0;
        return Promise.resolve(statusFn(t.txid)).then(function (st) { if (st && st.confirmed === false) { t.status = st.seen ? 'mempool' : 'sent'; t.reorged = t.block; delete t.block; } return 0; }).catch(function () { return 0; }); }
      return Promise.resolve(statusFn(t.txid)).then(function (st) {
        if (st && st.confirmed) { t.status = 'confirmed'; t.block = st.block; return 1; }
        if (st && st.seen) t.status = 'mempool';
        return 0;
      }).catch(function () { return 0; });
    })).then(function (n) { self.save(l); return n.reduce(function (a, b) { return a + b; }, 0); });
  };
  return { detect: detect, discover: discover, Wallet: Wallet, Tracker: Tracker, errMsg: errMsg };
});
