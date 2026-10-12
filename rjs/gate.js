/*!
 * XCPETS gate.js: pre-launch OWNER GATE for the real-game UI (owner login ONLY via an XCP Wallet signature from an allowlisted
 * address; there is no passphrase).
 * HONEST LIMIT: on a static site this only hides the UI. The source is public and the chain is public, so anyone can still build
 * pet: burns by hand, and anyone can patch this file in their own browser. The game is protected by the CHAIN RULES in
 * real-core.js (exact prices, owner-only actions, caps), not by this gate. The gate just keeps casual visitors out before launch.
 * It is not trivially bypassable: the unlock is not a plain flag. The session stores the verified signature, address and expiry,
 * and every page load verifies the signature again.
 * Launch switch: XCPETS_CONFIG.launched (site/js/config.js). When it's true, the gate is gone everywhere.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../../js/pet-core.js'), require('../../js/config.js'));
  else root.Gate = factory(root.PetCore, root.XCPETS_CONFIG);
})(typeof self !== 'undefined' ? self : this, function (PetCore, CFG) {
  'use strict';
  var CONFIG = {
    launched: !!(CFG && CFG.launched), // single launch switch lives in config.js
    // XCPETS issuer/owner (from GET /v2/assets/XCPETS) + extra owner addresses
    allowlist: ['bc1ps9av86ymmlzy9zj3a8pn6g94pz4j5e0kagv3td3wutaagfjvekjs26m3s4'],
    // owner test addresses for ?network=testnet4 / signet (tb1…/m…/n…); empty = use the passphrase there
    allowlistTestnet: [],
    nonceTtlMs: 10 * 60 * 1000,
    sessionMs: 12 * 60 * 60 * 1000 // a verified owner login lasts 12 h in this tab
  };
  function isAllowed(addr) {
    var a = String(addr || '').trim(), test = /^(tb1|[mn2])/.test(a);
    return (test ? CONFIG.allowlistTestnet : CONFIG.allowlist).indexOf(a) >= 0;
  }
  /** XCP Wallet connect proof (xcp_requestAccounts): message 'xcp-wallet\norigin:<origin>\nnonce:<n>\nissued:<unix s>' signed by the wallet. */
  function verifyProof(proof, origin, nowMs, verify) {
    if (CONFIG.launched) return { ok: true, reason: 'launched' };
    if (!proof || !proof.address) return { ok: false, reason: 'wallet returned no connection proof' };
    if (!isAllowed(proof.address)) return { ok: false, reason: 'address not on the owner allowlist' };
    var m = /^xcp-wallet\norigin:([^\n]+)\nnonce:[0-9a-zA-Z]+\nissued:([0-9]+)$/.exec(String(proof.message || ''));
    if (!m) return { ok: false, reason: 'unexpected proof message' };
    if (m[1] !== origin) return { ok: false, reason: 'proof is for another site' };
    if (Math.abs(nowMs - Number(m[2]) * 1000) > CONFIG.nonceTtlMs) return { ok: false, reason: 'proof expired' };
    var v = verify || (typeof window !== 'undefined' && window.XcpetsBip322 && window.XcpetsBip322.verify);
    if (!v) return { ok: false, reason: 'no signature verifier loaded' };
    var good = false; try { good = !!v(proof.address, proof.message, proof.signature); } catch (e) { return { ok: false, reason: 'bad signature: ' + e.message }; }
    return good ? { ok: true, reason: 'XCP Wallet proof verified' } : { ok: false, reason: 'signature does not match' };
  }
  function makeChallenge(addr, nonceHex, nowMs) {
    return 'XCPETS owner login\nAddress: ' + addr + '\nNonce: ' + nonceHex + '\nIssued: ' + new Date(nowMs).toISOString() + '\nThis signature only unlocks the pre-launch UI. It moves no funds.';
  }
  /** verifySignature({address, message, signature, issuedMs, nowMs, verify}) -> {ok, reason} */
  function verifySignature(o) {
    if (CONFIG.launched) return { ok: true, reason: 'launched' };
    if (!isAllowed(o.address)) return { ok: false, reason: 'address not on the owner allowlist' };
    if (o.message.indexOf('Address: ' + o.address + '\n') < 0) return { ok: false, reason: 'challenge is for another address' };
    if (o.nowMs - o.issuedMs > CONFIG.nonceTtlMs) return { ok: false, reason: 'challenge expired' };
    var v = o.verify || (typeof window !== 'undefined' && window.XcpetsBip322 && window.XcpetsBip322.verify);
    if (!v) return { ok: false, reason: 'no signature verifier loaded' };
    var good = false; try { good = !!v(o.address, o.message, o.signature); } catch (e) { return { ok: false, reason: 'bad signature: ' + e.message }; }
    return good ? { ok: true, reason: 'signature verified' } : { ok: false, reason: 'signature does not match' };
  }
  /* ---- session: verified signature + address + expiry; verified AGAIN on every load (no plain "unlocked" flag) ---- */
  var KEY = 'xcpets-owner-session-';
  function store() { return typeof sessionStorage !== 'undefined' ? sessionStorage : null; }
  /** saveSession(net, {address, message, signature, kind: 'challenge'|'proof', issuedMs}) after a successful verification */
  function saveSession(net, o) { var st = store(); if (!st) return; st.setItem(KEY + net, JSON.stringify({ address: o.address, message: o.message, signature: o.signature, kind: o.kind, exp: (o.issuedMs || Date.now()) + CONFIG.sessionMs })); }
  function clearSession(net) { var st = store(); if (st) st.removeItem(KEY + net); }
  /** sessionOk(net, {nowMs, verify, origin}) -> {ok, reason, address}; true when launched */
  function sessionOk(net, o) {
    o = o || {}; if (CONFIG.launched) return { ok: true, reason: 'launched' };
    var st = store(), raw = st && st.getItem(KEY + net), x; if (!raw) return { ok: false, reason: 'not logged in' };
    try { x = JSON.parse(raw); } catch (e) { return { ok: false, reason: 'bad session' }; }
    var now = o.nowMs || Date.now(); if (!(x.exp > now)) { clearSession(net); return { ok: false, reason: 'session expired' }; }
    if (!isAllowed(x.address)) return { ok: false, reason: 'address not on the owner allowlist' };
    if (x.kind === 'proof') { var m = /^xcp-wallet\norigin:([^\n]+)\n/.exec(String(x.message || '')); if (!m || (o.origin && m[1] !== o.origin)) return { ok: false, reason: 'proof is for another site' }; }
    else if (String(x.message || '').indexOf('Address: ' + x.address + '\n') < 0) return { ok: false, reason: 'challenge is for another address' };
    var v = o.verify || (typeof window !== 'undefined' && window.XcpetsBip322 && window.XcpetsBip322.verify);
    if (!v) return { ok: false, reason: 'no signature verifier loaded' };
    var good = false; try { good = !!v(x.address, x.message, x.signature); } catch (e) { good = false; }
    return good ? { ok: true, reason: 'owner session verified', address: x.address } : { ok: false, reason: 'stored signature does not verify' };
  }
  return { CONFIG: CONFIG, isAllowed: isAllowed, makeChallenge: makeChallenge, verifySignature: verifySignature, verifyProof: verifyProof, saveSession: saveSession, clearSession: clearSession, sessionOk: sessionOk };
});
