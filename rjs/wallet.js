/*!
 * XCPETS wallet.js — wallet adapter for click-to-burn (mirrors Civic Garage / milliondollarbillboard.net):
 *   1. connect: XCP Wallet  window.xcpwallet.request({method:'xcp_requestAccounts'}) -> {accounts:[addr], proof:{address,message,signature,verification}}
 *   2. the PAGE composes the unsigned destroy (Counterparty API compose/destroy)
 *   3. XCP Wallet  xcp_signTransaction params [{hex}] -> {hex}   (user reviews + approves in the extension popup)
 *   4. XCP Wallet  xcp_broadcastTransaction params [signedHex] -> {txid}
 * Provider docs: https://github.com/XCP/extension/blob/main/PROVIDER.md
 * Fallback: Horizon Wallet (window.HorizonWalletProvider, xcp_signPsbt — UNVERIFIED shape, sign only) then copy hex / QR.
 * casatookan-wallet (Nov 1 2026): Casa Tookan's in-app browser injects the legacy IndieSquare-era window.webXCP (+ window.web3xcp,
 *   window.indiesquare). Contract read from Casa Tookan's own injected provider source (devapp.casatookan.com bundle, "legacy window.webXCP"):
 *   getAccounts([basePath,] cb(err, address))  -> the casa's Bitcoin address (Legacy P2PKH 1... by default), via Casa's connect sheet once per site
 *   signMessage([basePath,] message, cb(err, signature))  -> BIP-137 signature by that address
 *   signTransaction([basePath,] psbtBase64, cb(err, signedRawTxBase64))  -> Casa hydrates the PSBT inputs, signs, finalizes, extracts and
 *     returns the signed raw tx as BASE64 (not hex). It does NOT broadcast, so this adapter sends the signed tx through the site's broadcast
 *     path (mempool.space POST /tx, same as js/v2-inscribe-ui.js) after checking it is the very tx the page composed and checked.
 *   We always call the 2-argument (data, cb) forms: Casa's shim treats them unambiguously (its 3-argument order differs from the old README).
 *   window.web3xcp alone (getAddress / signMessage / getPublicKey, no signTransaction) can connect and sign messages but not burn.
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
    if (win.webXCP || win.web3xcp) return { kind: 'webxcp', label: 'Casa Tookan', p: win.webXCP || win.web3xcp };
    if (win.HorizonWalletProvider) return { kind: 'horizon', label: 'Horizon Wallet', p: win.HorizonWalletProvider };
    return null;
  }
  /** Ask XCP Wallet to announce itself (it fires xcp-wallet#initialized). */
  function discover(win, cb) {
    if (!win || !win.addEventListener) return;
    win.addEventListener('xcp-wallet#initialized', function () { cb(detect(win)); });
    try { win.dispatchEvent(new win.Event('xcp-wallet#discover')); } catch (e) { /* old browsers */ }
  }
  /* ---- casatookan-wallet: webXCP helpers (no keys, no signing here) ---- */
  function isAddr(a) { return typeof a === 'string' && (/^[13mn2][1-9A-HJ-NP-Za-km-z]{25,34}$/.test(a) || /^(bc1|tb1|bcrt1)[02-9ac-hj-np-z]{8,87}$/.test(a)); }
  function pickAddr(r) {
    if (Array.isArray(r)) r = r[0];
    if (r && typeof r === 'object') r = r.address || (r.accounts && r.accounts[0]) || (r.addresses && r.addresses[0] && (r.addresses[0].address || r.addresses[0])) || null;
    return isAddr(r) ? r : null;
  }
  /** node-style callback -> Promise; Casa passes its bridge error ({code, message}) as err */
  function cbCall(o, name, args) {
    return new Promise(function (res, rej) {
      var f = o && o[name]; if (typeof f !== 'function') { var e0 = new Error('Casa Tookan does not offer ' + name + ' here.'); e0.code = 4200; return rej(e0); }
      var done = false;
      function cb(err, r) { if (done) return; done = true; if (err) { var e = err instanceof Error ? err : new Error(typeof err === 'string' ? err : (err && err.message) || 'Wallet request failed.'); if (err && err.code != null && e.code == null) e.code = err.code; rej(e); } else res(r); }
      try { f.apply(o, args.concat([cb])); } catch (e) { done = true; rej(e); }
    });
  }
  function hexOk(h) { return typeof h === 'string' && /^([0-9a-f]{2})+$/i.test(h); }
  function b64ToHex(s) {
    var bin; s = String(s).replace(/\s+/g, '');
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(s)) return null;
    if (typeof atob === 'function') bin = atob(s); else if (typeof Buffer !== 'undefined') return Buffer.from(s, 'base64').toString('hex'); else return null;
    var h = ''; for (var i = 0; i < bin.length; i++) { var c = bin.charCodeAt(i); h += (c < 16 ? '0' : '') + c.toString(16); } return h;
  }
  function hexToB64(h) {
    if (typeof btoa !== 'function') return Buffer.from(h, 'hex').toString('base64');
    var bin = ''; for (var i = 0; i < h.length; i += 2) bin += String.fromCharCode(parseInt(h.substr(i, 2), 16)); return btoa(bin);
  }
  /** parseTx(hex) -> {ver, lock, ins:[{prev, script, seq}], outs:[rawOutputHex], wit:bool}; throws on malformed / trailing bytes */
  function parseTx(hex) {
    if (!hexOk(hex)) throw new Error('not a transaction');
    hex = hex.toLowerCase(); var o = 0, L = hex.length / 2;
    function take(n) { if (o + n > L) throw new Error('transaction is truncated'); var x = hex.substr(o * 2, n * 2); o += n; return x; }
    function vi() { var b = parseInt(take(1), 16); if (b < 0xfd) return b; var n = b === 0xfd ? 2 : b === 0xfe ? 4 : 8, x = take(n), v = 0; for (var i = n - 1; i >= 0; i--) v = v * 256 + parseInt(x.substr(i * 2, 2), 16); return v; }
    var ver = take(4), wit = false; if (hex.substr(o * 2, 4) === '0001') { wit = true; o += 2; }
    var ins = [], outs = [], i, n = vi(); if (!n) throw new Error('transaction has no inputs');
    for (i = 0; i < n; i++) { var prev = take(36), sl = vi(), sc = take(sl); ins.push({ prev: prev, script: sc, seq: take(4) }); }
    n = vi(); for (i = 0; i < n; i++) { var s0 = o, val = take(8), l = vi(); take(l); outs.push(hex.substr(s0 * 2, (o - s0) * 2)); void val; }
    if (wit) ins.forEach(function (x) { var k = vi(), w = []; for (var j = 0; j < k; j++) w.push(take(vi())); x.wit = w; });
    var lock = take(4); if (o !== L) throw new Error('transaction has trailing bytes');
    return { ver: ver, lock: lock, ins: ins, outs: outs, wit: wit };
  }
  function varint(n) { function le(v, b) { var h = ''; for (var i = 0; i < b; i++) { h += ('0' + (v % 256).toString(16)).slice(-2); v = Math.floor(v / 256); } return h; }
    return n < 0xfd ? le(n, 1) : n <= 0xffff ? 'fd' + le(n, 2) : n <= 0xffffffff ? 'fe' + le(n, 4) : 'ff' + le(n, 8); }
  /** unsigned raw tx hex (from compose) -> minimal BIP-174 PSBT (base64): the tx with empty scriptSigs, no input data
   *  (Casa Tookan fetches each previous tx itself: nonWitnessUtxo for legacy inputs, witnessUtxo for segwit). */
  function psbtFromRaw(raw) {
    var t = parseTx(raw), tx = t.ver + varint(t.ins.length);
    t.ins.forEach(function (x) { tx += x.prev + '00' + x.seq; });
    tx += varint(t.outs.length) + t.outs.join('') + t.lock;
    var h = '70736274ff' + '0100' + varint(tx.length / 2) + tx + '00';
    t.ins.forEach(function () { h += '00'; }); t.outs.forEach(function () { h += '00'; });
    return hexToB64(h);
  }
  /** the wallet's signed tx -> hex: Casa answers base64; also accept hex or {raw|hex|signedTx|tx} */
  function signedHex(r) {
    if (r && typeof r === 'object') r = r.raw || r.hex || r.signedTx || r.tx || r.rawtx || r.result || null;
    if (typeof r !== 'string' || !r) return null;
    var s = r.trim(), h = hexOk(s) && /^0[12]000000/i.test(s) ? s : b64ToHex(s);
    if (h && /^70736274ff/i.test(h)) throw new Error('Casa Tookan returned an unfinished PSBT instead of a signed transaction. Nothing was sent.');
    return h && hexOk(h) ? h.toLowerCase() : null;
  }
  /** the signed tx must be exactly the composed one (same version, inputs, sequences, outputs, locktime) with every input signed */
  function sameTx(unsigned, signed) {
    var a = parseTx(unsigned), b = parseTx(signed), bad = [];
    if (a.ver !== b.ver) bad.push('version'); if (a.lock !== b.lock) bad.push('locktime');
    if (a.ins.length !== b.ins.length || a.ins.some(function (x, i) { return x.prev !== b.ins[i].prev || x.seq !== b.ins[i].seq; })) bad.push('inputs');
    if (a.outs.join('|') !== b.outs.join('|')) bad.push('outputs');
    if (b.ins.some(function (x) { return !x.script && !(x.wit && x.wit.length); })) bad.push('an input is unsigned');
    return bad;
  }
  function netOf(a) { return /^(1|3|bc1)/.test(a || '') ? 'mainnet' : /^(m|n|2|tb1|bcrt1)/.test(a || '') ? 'testnet' : null; }
  function defaultBroadcast(hex) {
    var root = typeof self !== 'undefined' ? self : {}, C = root.XCPETS_CONFIG || {}, api = String(C.mempoolApi || 'https://mempool.space/api').replace(/\/+$/, '');
    return root.fetch(api + '/tx', { method: 'POST', body: hex }).then(function (r) { return r.text().then(function (t) { t = String(t || '').trim();
      if (!r.ok) throw new Error('The network refused the signed transaction (' + (t || 'HTTP ' + r.status) + '). Nothing was sent.'); return t; }); });
  }
  function Wallet(w) { this.w = w; this.address = null; this.proof = null; }
  Wallet.prototype.connect = function () {
    var self = this, w = this.w;
    if (w.kind === 'xcpwallet') return w.p.request({ method: 'xcp_requestAccounts' }).then(function (r) {
      self.address = (r && r.accounts && r.accounts[0]) || (Array.isArray(r) ? r[0] : null);
      self.proof = r && r.proof && r.proof.address === self.address ? r.proof : null;
      return { address: self.address, proof: self.proof };
    });
    if (w.kind === 'webxcp') return (typeof w.p.getAccounts === 'function' ? cbCall(w.p, 'getAccounts', [null]) : cbCall(w.p, 'getAddress', [])).then(function (r) {
      self.address = pickAddr(r); self.proof = null; return { address: self.address, proof: null };
    });
    return w.p.request('getAddresses').then(function (r) {
      var list = (r && r.result && r.result.addresses) || [];
      self.address = list.length ? list[0].address : null; return { address: self.address, proof: null };
    });
  };
  Wallet.prototype.network = function () {
    if (this.w.kind === 'webxcp') return Promise.resolve(netOf(this.address));
    if (this.w.kind !== 'xcpwallet') return Promise.resolve(null);
    return this.w.p.request({ method: 'xcp_getNetwork' }).catch(function () { return null; });
  };
  Wallet.prototype.signMessage = function (msg) {
    if (this.w.kind === 'xcpwallet') return this.w.p.request({ method: 'xcp_signMessage', params: [msg, this.address] }).then(function (s) { return typeof s === 'string' ? s : s && s.signature; });
    if (this.w.kind === 'webxcp') return cbCall(this.w.p, 'signMessage', [msg]).then(function (s) { return typeof s === 'string' ? s : s && s.signature; });
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
    if (this.w.kind === 'webxcp') {
      /* Casa Tookan: PSBT (base64) built from the composed + checked raw tx -> signed raw tx -> same tx? -> site broadcast -> {txid} */
      var raw = composed && composed.rawtransaction, send = this.w.broadcast || defaultBroadcast, psbt;
      if (typeof p.signTransaction !== 'function') { var e1 = new Error('This Casa Tookan version cannot sign transactions for this site (no webXCP.signTransaction). Update Casa Tookan.'); e1.code = 4200; return Promise.reject(e1); }
      try { psbt = psbtFromRaw(raw); } catch (e) { return Promise.reject(new Error('Could not prepare the transaction for Casa Tookan (' + e.message + '). Nothing was signed or sent.')); }
      return cbCall(p, 'signTransaction', [psbt]).then(function (r) {
        var hex = signedHex(r); if (!hex) throw new Error('wallet returned no signed transaction');
        var bad; try { bad = sameTx(raw, hex); } catch (e) { bad = ['unreadable (' + e.message + ')']; }
        if (bad.length) throw new Error('Casa Tookan returned a different transaction (' + bad.join(', ') + '). Nothing was sent.');
        return send(hex);
      }).then(function (txid) { txid = typeof txid === 'string' ? txid.trim() : txid && txid.txid; if (!/^[0-9a-f]{64}$/i.test(txid || '')) throw new Error('broadcast returned no txid'); return { txid: txid.toLowerCase() }; });
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
  return { detect: detect, discover: discover, Wallet: Wallet, Tracker: Tracker, errMsg: errMsg, _psbtFromRaw: psbtFromRaw, _signedHex: signedHex, _sameTx: sameTx, _parseTx: parseTx };
});
