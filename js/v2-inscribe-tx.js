/* XCPETS v2: REAL inscription transactions (ordinals commit + reveal). 2026-10-15 (Jake: XCP Wallet only, player pays BTC fees only, no site fee, no XCPETS burn).
 *   commit = the player's XCP Wallet funds ONE P2TR output (xcp_signBitcoinPsbt, exact-payment intent). Script tree = one leaf:
 *            <tempKey> OP_CHECKSIG OP_FALSE OP_IF "ord" 1 "image/png" 7 "xcpets" 5 <CBOR {p,v,pet,b,f,s,g}> 0 <png in 520-byte pushes> OP_ENDIF
 *            internal key = the same temp key, so the commit can be REFUNDED by key path if the reveal is never broadcast.
 *   reveal = spends the commit by script path, signed in this browser by the TEMP key (it can only ever move this one commit output);
 *            output 0 = 546 sats to the pet owner's own address (= the inscription). Inscription id = revealTxid + 'i0'.
 * The temp key is saved to localStorage AND in a recovery file the player must download BEFORE the wallet is asked to sign.
 * Requires the bundled @scure/btc-signer (vendor/btc-signer.js -> global BtcSigner). Node: require(...)(BtcSigner). Never signs for the player. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory; else root.V2InscribeTx = factory(root.BtcSigner);
})(typeof self !== 'undefined' ? self : this, function (L) {
  'use strict';
  if (!L) throw new Error('V2InscribeTx: BtcSigner bundle not loaded');
  var btc = L.btc, schnorr = L.schnorr, hex = L.hex;
  var POSTAGE = 546, DUST = 330, CHUNK = 520, MAX_FEE_RATE = 500, META_PROTOCOL = 'xcpets', REFUND_VB = 111;
  var NETS = { mainnet: btc.NETWORK, testnet: btc.TEST_NETWORK, testnet4: btc.TEST_NETWORK, signet: btc.TEST_NETWORK };
  function net(n) { var x = NETS[n || 'mainnet']; if (!x) throw new Error('unknown network ' + n); return x; }
  var te = new TextEncoder(), td = new TextDecoder('utf-8', { fatal: true });
  function u8(s) { return te.encode(s); }
  function cat(a) { var n = 0; a.forEach(function (x) { n += x.length; }); var o = new Uint8Array(n), i = 0; a.forEach(function (x) { o.set(x, i); i += x.length; }); return o; }
  /* ---- minimal CBOR (maps of text keys; uint, text, arrays) for the ord metadata tag ---- */
  function cHead(m, n) { if (n < 24) return [m << 5 | n]; if (n < 256) return [m << 5 | 24, n]; if (n < 65536) return [m << 5 | 25, n >> 8, n & 255]; return [m << 5 | 26, n >>> 24, n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function cborEnc(v) { var o = [];
    (function e(x) { if (typeof x === 'number') { if (!Number.isSafeInteger(x) || x < 0 || x > 0xffffffff) throw new Error('cbor: uint32 only'); o.push.apply(o, cHead(0, x)); }
      else if (typeof x === 'string') { var b = u8(x); o.push.apply(o, cHead(3, b.length)); for (var i = 0; i < b.length; i++) o.push(b[i]); }
      else if (Array.isArray(x)) { o.push.apply(o, cHead(4, x.length)); x.forEach(e); }
      else if (x && typeof x === 'object') { var k = Object.keys(x); o.push.apply(o, cHead(5, k.length)); k.forEach(function (q) { e(q); e(x[q]); }); }
      else throw new Error('cbor: unsupported value'); })(v);
    return new Uint8Array(o); }
  function cborDec(b) { var i = 0, depth = 0;
    function n(ai) { if (ai < 24) return ai; if (ai === 24) return b[i++]; if (ai === 25) { var v = b[i] << 8 | b[i + 1]; i += 2; return v; } if (ai === 26) { var w = ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3]; i += 4; return w; } throw new Error('cbor: bad length'); }
    function d() { if (i >= b.length) throw new Error('cbor: truncated'); if (++depth > 8) throw new Error('cbor: too deep'); var h = b[i++], m = h >> 5, len = n(h & 31), r;
      if (m === 0) r = len; else if (m === 3) { if (i + len > b.length) throw new Error('cbor: truncated'); r = td.decode(b.subarray(i, i + len)); i += len; }
      else if (m === 4) { if (len > 64) throw new Error('cbor: array too long'); r = []; for (var k = 0; k < len; k++) r.push(d()); }
      else if (m === 5) { if (len > 16) throw new Error('cbor: map too big'); r = {}; for (var j = 0; j < len; j++) { var key = d(); if (typeof key !== 'string') throw new Error('cbor: text keys only'); r[key] = d(); } }
      else throw new Error('cbor: unsupported major type ' + m);
      depth--; return r; }
    var v = d(); if (i !== b.length) throw new Error('cbor: trailing bytes'); return v; }
  /* ---- envelope (hand-assembled so every tag is an explicit 1-byte push, exactly as ord writes it) ---- */
  function push(b) { if (b.length <= 75) return cat([Uint8Array.of(b.length), b]); if (b.length <= 255) return cat([Uint8Array.of(0x4c, b.length), b]); if (b.length <= 520) return cat([Uint8Array.of(0x4d, b.length & 255, b.length >> 8), b]); throw new Error('push > 520'); }
  function chunks(b) { var o = []; for (var i = 0; i < b.length; i += CHUNK) o.push(b.subarray(i, i + CHUNK)); return o; }
  /** meta: { pet, b (render block), f (frame), s (name stamp), g ([[slot, gid], ...] worn gear) } */
  function cleanMeta(m) { if (!m || !Number.isSafeInteger(m.pet) || m.pet <= 0 || !Number.isSafeInteger(m.b) || m.b <= 0 || !Number.isSafeInteger(m.f) || m.f < 0 || ['top', 'bottom', 'none'].indexOf(m.s) < 0) throw new Error('metadata: pet, b, f, s required');
    var g = (m.g || []).map(function (x) { if (!Array.isArray(x) || x.length !== 2 || typeof x[0] !== 'string' || typeof x[1] !== 'string' || x[0].length > 16 || x[1].length > 96) throw new Error('metadata: gear entries are [slot, gid]'); return [x[0], x[1]]; });
    if (g.length > 12) throw new Error('metadata: too much gear'); return { p: META_PROTOCOL, v: 1, pet: m.pet, b: m.b, f: m.f, s: m.s, g: g }; }
  function envelope(pubX, meta, bytes) {
    if (!(pubX instanceof Uint8Array) || pubX.length !== 32) throw new Error('envelope: 32-byte x-only key');
    if (!bytes || bytes.length < 33 || bytes[1] !== 80 || bytes[2] !== 78 || bytes[3] !== 71) throw new Error('envelope: still PNG only');
    var parts = [push(pubX), Uint8Array.of(0xac, 0x00, 0x63), push(u8('ord')), push(Uint8Array.of(1)), push(u8('image/png')), push(Uint8Array.of(7)), push(u8(META_PROTOCOL))];
    chunks(cborEnc(cleanMeta(meta))).forEach(function (c) { parts.push(push(Uint8Array.of(5)), push(c)); });
    parts.push(Uint8Array.of(0x00)); chunks(bytes).forEach(function (c) { parts.push(push(c)); }); parts.push(Uint8Array.of(0x68));
    return cat(parts); }
  /** parseEnvelope(leaf bytes) -> { pubX, contentType, metaprotocol, meta, body }. Strict: anything that is not exactly our layout throws. */
  function parseEnvelope(s) { var i = 0;
    function rd() { var op = s[i++], n; if (op >= 1 && op <= 75) n = op; else if (op === 0x4c) n = s[i++]; else if (op === 0x4d) { n = s[i] | s[i + 1] << 8; i += 2; } else if (op === 0) return new Uint8Array(0); else { i--; return null; }
      if (i + n > s.length) throw new Error('envelope: truncated'); var b = s.subarray(i, i + n); i += n; return b; }
    var pubX = rd(); if (!pubX || pubX.length !== 32 || s[i] !== 0xac || s[i + 1] !== 0x00 || s[i + 2] !== 0x63) throw new Error('not an envelope'); i += 3;
    var m = rd(); if (!m || td.decode(m) !== 'ord') throw new Error('not an ord envelope');
    var ct = null, mp = null, md = [], body = [];
    for (;;) { var t = rd(); if (t === null) throw new Error('envelope: unexpected opcode'); if (t.length === 0) break;
      if (t.length !== 1) throw new Error('envelope: bad tag'); var v = rd(); if (!v) throw new Error('envelope: tag without value');
      if (t[0] === 1) ct = td.decode(v); else if (t[0] === 7) mp = td.decode(v); else if (t[0] === 5) md.push(v); else throw new Error('envelope: unknown tag ' + t[0]); }
    for (;;) { if (s[i] === 0x68) { i++; break; } var c = rd(); if (!c || !c.length) throw new Error('envelope: bad body push'); body.push(c); }
    if (i !== s.length) throw new Error('envelope: trailing script');
    var meta = null; if (md.length) { meta = cborDec(cat(md)); }
    return { pubX: pubX, contentType: ct, metaprotocol: mp, meta: meta, body: cat(body) }; }
  function newTempKey() { return schnorr.utils.randomPrivateKey ? schnorr.utils.randomPrivateKey() : schnorr.utils.randomSecretKey(); }
  function paymentFromLeaf(pubX, leaf, network) { return btc.p2tr(pubX, { script: leaf }, net(network), true); }
  function commitPayment(tempPriv, meta, bytes, network) { var pubX = schnorr.getPublicKey(tempPriv), leaf = envelope(pubX, meta, bytes); return { pay: paymentFromLeaf(pubX, leaf, network), leaf: leaf, pubX: pubX }; }
  function checkRate(r) { if (!(r > 0 && r <= MAX_FEE_RATE)) throw new Error('fee rate must be 0 < sat/vB <= ' + MAX_FEE_RATE); }
  function addrType(addr, network) { var d; try { d = btc.Address(net(network)).decode(addr); } catch (e) { throw new Error('not a valid ' + (network || 'mainnet') + ' address: ' + addr); } return d.type; }
  /** inscriptions go to the pet owner's own address; native SegWit or Taproot (the address must also fund the commit) */
  function requireOwnerAddr(addr, network) { var t = addrType(addr, network); if (t !== 'wpkh' && t !== 'tr') throw new Error('Inscribing needs a native SegWit (bc1q) or Taproot (bc1p) XCP Wallet address; this pet\'s owner address is a ' + t + ' address.'); return t; }
  function revealFromLeaf(o) { var pubX = schnorr.getPublicKey(o.tempPriv), pay = paymentFromLeaf(pubX, o.leaf, o.network), tx = new btc.Transaction({ allowUnknownOutputs: true });
    tx.addInput({ txid: o.commitTxid, index: 0, witnessUtxo: { script: pay.script, amount: BigInt(o.commitAmount) }, tapLeafScript: pay.tapLeafScript });
    tx.addOutputAddress(o.receiver, BigInt(POSTAGE), net(o.network)); tx.signIdx(o.tempPriv, 0);
    var sig = tx.getInput(0).tapScriptSig[0][1]; tx.updateInput(0, { finalScriptWitness: [sig, o.leaf, btc.TaprootControlBlock.encode(pay.tapLeafScript[0][0])] }, true);
    return { hex: tx.hex, txid: tx.id, vsize: tx.vsize, fee: Number(o.commitAmount) - POSTAGE }; }
  /** plan(): the exact commit amount so the reveal pays feeRate (measured on a signed dummy reveal). */
  function plan(o) { checkRate(o.feeRate); requireOwnerAddr(o.receiver, o.network); var c = commitPayment(o.tempPriv, o.meta, o.bytes, o.network);
    var dummy = revealFromLeaf({ tempPriv: o.tempPriv, leaf: c.leaf, network: o.network, receiver: o.receiver, commitTxid: '00'.repeat(32), commitAmount: 1e8 }), revealFee = Math.ceil(dummy.vsize * o.feeRate);
    return { commitAddress: c.pay.address, commitAmount: POSTAGE + revealFee, revealVsize: dummy.vsize, revealFee: revealFee, postage: POSTAGE, tempPubX: hex.encode(c.pubX), leaf: c.leaf, leafHex: hex.encode(c.leaf) }; }
  function unsignedTxid(tx) { return hex.encode(Uint8Array.from(L.sha256(L.sha256(tx.unsignedTx))).reverse()); }
  /** buildCommitPsbt: UNSIGNED PSBT funded by `from` (the pet owner), change back to `from`. utxos must already be filtered (no Counterparty assets / inscriptions). */
  function buildCommitPsbt(o) { checkRate(o.feeRate); var N = net(o.network), P = o.plan, sel = [], tot = 0, type = requireOwnerAddr(o.from, o.network), spk = btc.OutScript.encode(btc.Address(N).decode(o.from));
    var inVb = type === 'tr' ? 57.5 : 68, base = 10.5 + 43 + 43;
    var utxos = (o.utxos || []).slice().sort(function (a, b) { return b.value - a.value || (a.txid < b.txid ? -1 : 1); });
    for (var i = 0; i < utxos.length; i++) { sel.push(utxos[i]); tot += utxos[i].value; if (tot >= P.commitAmount + Math.ceil((base + inVb * sel.length) * o.feeRate)) break; }
    var fee = Math.ceil((base + inVb * sel.length) * o.feeRate), change = tot - P.commitAmount - fee;
    if (change < 0) throw new Error('Not enough spendable BTC at ' + o.from + ': need ' + (P.commitAmount + fee).toLocaleString('en-US') + ' sats, have ' + tot.toLocaleString('en-US') + ' (UTXOs holding Counterparty assets or inscriptions are never used).');
    var tx = new btc.Transaction();
    sel.forEach(function (u) { var inp = { txid: u.txid, index: u.vout, witnessUtxo: { script: spk, amount: BigInt(u.value) }, sighashType: 1 }; if (type === 'tr' && o.tapInternalKey) inp.tapInternalKey = hex.decode(o.tapInternalKey); tx.addInput(inp); });
    tx.addOutputAddress(P.commitAddress, BigInt(P.commitAmount), N);
    if (change >= DUST + Math.ceil(43 * o.feeRate)) tx.addOutputAddress(o.from, BigInt(change), N); else { fee += change; change = 0; }
    return { psbt: tx.toPSBT(), psbtHex: hex.encode(tx.toPSBT()), txid: unsignedTxid(tx), inputs: sel.length, used: sel, fee: fee, change: change, commitAmount: P.commitAmount }; }
  /** buildRefund: key-path spend of an abandoned commit back to `to` (temp key = internal key; the merkle root comes from the stored leaf). */
  function buildRefund(o) { checkRate(o.feeRate); var tempPriv = typeof o.tempPriv === 'string' ? hex.decode(o.tempPriv) : o.tempPriv, leaf = typeof o.leaf === 'string' ? hex.decode(o.leaf) : o.leaf;
    var pubX = schnorr.getPublicKey(tempPriv), pay = paymentFromLeaf(pubX, leaf, o.network), tx = new btc.Transaction(), fee = Math.ceil(REFUND_VB * o.feeRate), out = o.commitAmount - fee;
    if (out < DUST) throw new Error('The commit (' + o.commitAmount + ' sats) is too small to refund at ' + o.feeRate + ' sat/vB.');
    tx.addInput({ txid: o.commitTxid, index: 0, witnessUtxo: { script: pay.script, amount: BigInt(o.commitAmount) }, tapInternalKey: pubX, tapMerkleRoot: pay.tapMerkleRoot });
    tx.addOutputAddress(o.to, BigInt(out), net(o.network)); tx.sign(tempPriv); tx.finalize(); return { hex: tx.hex, txid: tx.id, fee: fee, amount: out }; }
  /** finalizeSigned(signed PSBT hex|base64, or raw tx hex) -> { hex, txid } */
  function finalizeSigned(s) { s = String(s || '').trim(); if (!s) throw new Error('wallet returned nothing');
    if (!/^(70736274ff|cHNidP)/i.test(s)) { var t0 = btc.Transaction.fromRaw(hex.decode(s), { allowUnknownOutputs: true }); return { hex: s, txid: t0.id }; }
    var tx = btc.Transaction.fromPSBT(/^[0-9a-f]+$/i.test(s) ? hex.decode(s) : L.base64.decode(s)); if (!tx.isFinal) tx.finalize(); return { hex: tx.hex, txid: tx.id }; }
  /** recoveryFile: everything needed to finish (reveal) or undo (refund) without this site. Downloaded BEFORE the wallet is asked to sign. */
  function recoveryFile(r) { return { kind: 'xcpets-inscription-recovery', version: 1, created: r.created || new Date().toISOString(), network: r.network, petId: r.petId, owner: r.owner,
    tempPrivateKey: r.tempPriv, tempPublicKeyX: r.tempPubX, commitAddress: r.commitAddress, commitTxid: r.commitTxid, commitAmountSats: r.commitAmount, commitPsbtUnsigned: r.commitPsbtHex,
    revealTxHex: r.revealHex, revealTxid: r.revealTxid, inscriptionId: r.revealTxid + 'i0', envelopeLeafHex: r.leafHex,
    instructions: ['KEEP THIS FILE PRIVATE: tempPrivateKey controls the inscription commit output (and nothing else).',
      '1. If the commit confirmed but the inscription did not appear: open xcpets.fun/inscriptions.html -> Recover, load this file, press "Broadcast reveal" (or paste revealTxHex into mempool.space/tx/push).',
      '2. To abandon it and get the BTC back: same screen -> "Refund to my address" (key-path spend of ' + r.commitTxid + ':0 back to ' + r.owner + ', minus a network fee).',
      '3. If the commit never confirmed, nothing was spent and this file can be deleted.'] }; }
  function parseRecovery(j) { var o = typeof j === 'string' ? JSON.parse(j) : j; if (!o || o.kind !== 'xcpets-inscription-recovery' || o.version !== 1) throw new Error('Not an XCPETS inscription recovery file.');
    ['tempPrivateKey', 'commitTxid', 'revealTxHex', 'envelopeLeafHex', 'owner', 'network'].forEach(function (k) { if (typeof o[k] !== 'string' || !o[k]) throw new Error('Recovery file is missing ' + k + '.'); });
    if (!/^[0-9a-f]{64}$/.test(o.tempPrivateKey) || !/^[0-9a-f]{64}$/.test(o.commitTxid) || !Number.isSafeInteger(o.commitAmountSats)) throw new Error('Recovery file is damaged.');
    var lf = hex.decode(o.envelopeLeafHex), pubX = schnorr.getPublicKey(hex.decode(o.tempPrivateKey)), e = parseEnvelope(lf);
    if (hex.encode(e.pubX) !== hex.encode(pubX)) throw new Error('Recovery file: key does not match the inscription script.');
    var rv = btc.Transaction.fromRaw(hex.decode(o.revealTxHex), { allowUnknownOutputs: true }); if (hex.encode(rv.getInput(0).txid) !== o.commitTxid) throw new Error('Recovery file: reveal does not spend the commit.');
    return o; }
  return { POSTAGE: POSTAGE, META_PROTOCOL: META_PROTOCOL, cborEnc: cborEnc, cborDec: cborDec, envelope: envelope, parseEnvelope: parseEnvelope, newTempKey: newTempKey, commitPayment: commitPayment,
    plan: plan, buildCommitPsbt: buildCommitPsbt, revealFromLeaf: revealFromLeaf, buildRefund: buildRefund, finalizeSigned: finalizeSigned, unsignedTxid: unsignedTxid,
    recoveryFile: recoveryFile, parseRecovery: parseRecovery, requireOwnerAddr: requireOwnerAddr, addrType: addrType, hex: hex, btc: btc, schnorr: schnorr };
});
