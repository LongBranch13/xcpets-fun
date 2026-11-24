/* Wallet ownership check for HatchBot /link (Nov 24 2026). Pure function, no network, no keys.
 * verifyMessage(address, message, signatureBase64) -> { ok, how } or { ok: false, why }.
 * Accepts what XCPETS wallets sign (see https://github.com/XCP/extension/blob/main/PROVIDER.md, xcp_signMessage):
 *   - the classic 65-byte signed-message signature (BIP-137 / Bitcoin Core signmessage): Legacy 1... addresses (XCP Wallet,
 *     Casa Tookan, FreeWallet, Trezor). A recovered compressed key is also accepted for 3... (P2SH-P2WPKH) and bc1q... (P2WPKH),
 *     the BIP-137 headers 35-42 that hardware wallets use.
 *   - BIP-322 "simple" (a base64 witness stack): bc1q... (P2WPKH), 3... (P2SH-P2WPKH) and bc1p... (Taproot key path).
 * Built only on audited libraries (@noble/curves, @noble/hashes, @scure/base). */
import { secp256k1, schnorr } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { ripemd160 } from '@noble/hashes/ripemd160';
import { base64, bech32, bech32m, createBase58check } from '@scure/base';

const b58c = createBase58check(sha256);
const enc = new TextEncoder();
const cat = (...a) => { const n = a.reduce((t, x) => t + x.length, 0), o = new Uint8Array(n); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
const eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const dsha = (b) => sha256(sha256(b));
const h160 = (b) => ripemd160(sha256(b));
const u32 = (n) => { const o = new Uint8Array(4); new DataView(o.buffer).setUint32(0, n >>> 0, true); return o; };
const u64 = (n) => { const o = new Uint8Array(8); new DataView(o.buffer).setBigUint64(0, BigInt(n), true); return o; };
function varint(n) { if (n < 0xfd) return Uint8Array.of(n); if (n <= 0xffff) return Uint8Array.of(0xfd, n & 255, n >> 8); return cat(Uint8Array.of(0xfe), u32(n)); }
const vbytes = (b) => cat(varint(b.length), b);
const taggedHash = (tag, ...m) => { const t = sha256(enc.encode(tag)); return sha256(cat(t, t, ...m)); };

/** address -> { type, spk, hash } (mainnet only). */
export function decodeAddress(addr) {
  addr = String(addr || '').trim();
  if (/^bc1/i.test(addr)) {
    const low = addr.toLowerCase();
    let d; try { d = bech32.decode(low, 90); } catch (e) { try { d = bech32m.decode(low, 90); d.m = true; } catch (e2) { return null; } }
    if (d.prefix !== 'bc') return null;
    const ver = d.words[0], prog = Uint8Array.from(bech32.fromWords(d.words.slice(1)));
    if (ver === 0 && !d.m && prog.length === 20) return { type: 'p2wpkh', hash: prog, spk: cat(Uint8Array.of(0x00, 0x14), prog) };
    if (ver === 1 && d.m && prog.length === 32) return { type: 'p2tr', key: prog, spk: cat(Uint8Array.of(0x51, 0x20), prog) };
    return null;
  }
  let raw; try { raw = b58c.decode(addr); } catch (e) { return null; }
  if (raw.length !== 21) return null;
  const h = raw.slice(1);
  if (raw[0] === 0x00) return { type: 'p2pkh', hash: h, spk: cat(Uint8Array.of(0x76, 0xa9, 0x14), h, Uint8Array.of(0x88, 0xac)) };
  if (raw[0] === 0x05) return { type: 'p2sh', hash: h, spk: cat(Uint8Array.of(0xa9, 0x14), h, Uint8Array.of(0x87)) };
  return null;
}

/* ---------- BIP-137 (65-byte recoverable signature) ---------- */
function magicHash(message) { const m = enc.encode(message); return dsha(cat(Uint8Array.of(0x18), enc.encode('Bitcoin Signed Message:\n'), varint(m.length), m)); }
function verifyBip137(a, message, sig) {
  const head = sig[0]; if (head < 27 || head > 42) return { ok: false, why: 'bad signature header' };
  const rec = (head - 27) & 3, compressed = head >= 31;
  let pub;
  try { pub = secp256k1.Signature.fromCompact(sig.slice(1)).addRecoveryBit(rec).recoverPublicKey(magicHash(message)).toRawBytes(compressed); }
  catch (e) { return { ok: false, why: 'signature does not recover a key' }; }
  const kh = h160(pub);
  if (a.type === 'p2pkh') return eq(kh, a.hash) ? { ok: true, how: 'bip137' } : { ok: false, why: 'signed by a different address' };
  if (!compressed) return { ok: false, why: 'segwit addresses need a compressed key' };
  if (a.type === 'p2wpkh') return eq(kh, a.hash) ? { ok: true, how: 'bip137-segwit' } : { ok: false, why: 'signed by a different address' };
  if (a.type === 'p2sh') return eq(h160(cat(Uint8Array.of(0x00, 0x14), kh)), a.hash) ? { ok: true, how: 'bip137-p2sh' } : { ok: false, why: 'signed by a different address' };
  return { ok: false, why: 'this address type cannot use a legacy signature' };
}

/* ---------- BIP-322 simple ---------- */
function readWitness(b) {
  let i = 0; const rd = () => { const x = b[i++]; if (x < 0xfd) return x; if (x === 0xfd) { const v = b[i] | (b[i + 1] << 8); i += 2; return v; } throw new Error('witness too big'); };
  const n = rd(), items = [];
  for (let k = 0; k < n; k++) { const l = rd(); if (i + l > b.length) throw new Error('short witness'); items.push(b.slice(i, i + l)); i += l; }
  if (i !== b.length) throw new Error('trailing bytes');
  return items;
}
function toSpendTxid(spk, message) {
  const mh = taggedHash('BIP0322-signed-message', enc.encode(message));
  const tx = cat(u32(0), Uint8Array.of(1), new Uint8Array(32), u32(0xffffffff), vbytes(cat(Uint8Array.of(0x00, 0x20), mh)), u32(0),
    Uint8Array.of(1), u64(0), vbytes(spk), u32(0));
  return dsha(tx); /* internal byte order, as used in outpoints */
}
/* to_sign: version 0, one input (to_spend:0, sequence 0), one output (0 sats, OP_RETURN), locktime 0 */
function sighashSegwitV0(prevTxid, scriptCode, hashType) {
  const prevouts = dsha(cat(prevTxid, u32(0))), seqs = dsha(u32(0)), outs = dsha(cat(u64(0), vbytes(Uint8Array.of(0x6a))));
  return dsha(cat(u32(0), prevouts, seqs, prevTxid, u32(0), vbytes(scriptCode), u64(0), u32(0), outs, u32(0), u32(hashType)));
}
function sighashTaproot(prevTxid, spk, hashType) {
  const anyone = (hashType & 0x80) === 0x80, out = hashType & 3;
  let m = cat(Uint8Array.of(hashType), u32(0), u32(0));
  if (!anyone) m = cat(m, sha256(cat(prevTxid, u32(0))), sha256(u64(0)), sha256(vbytes(spk)), sha256(u32(0)));
  if (out !== 2 && out !== 3) m = cat(m, sha256(cat(u64(0), vbytes(Uint8Array.of(0x6a)))));
  m = cat(m, Uint8Array.of(0)); /* spend_type: key path, no annex */
  if (anyone) m = cat(m, prevTxid, u32(0), u64(0), vbytes(spk), u32(0)); else m = cat(m, u32(0));
  if (out === 3) m = cat(m, sha256(cat(u64(0), vbytes(Uint8Array.of(0x6a)))));
  return taggedHash('TapSighash', Uint8Array.of(0), m);
}
function ecdsaOk(derWithType, pub, hash) {
  try { const s = secp256k1.Signature.fromDER(derWithType.slice(0, -1)); return secp256k1.verify(s, hash, pub, { lowS: false, prehash: false }); } catch (e) { return false; }
}
function verifyBip322(a, message, sig) {
  let w; try { w = readWitness(sig); } catch (e) { return { ok: false, why: 'unreadable signature' }; }
  const txid = toSpendTxid(a.spk, message);
  if (a.type === 'p2tr') {
    if (w.length !== 1 || (w[0].length !== 64 && w[0].length !== 65)) return { ok: false, why: 'not a taproot key-path signature' };
    const ht = w[0].length === 65 ? w[0][64] : 0; if (w[0].length === 65 && ht === 0) return { ok: false, why: 'bad sighash' };
    try { return schnorr.verify(w[0].slice(0, 64), sighashTaproot(txid, a.spk, ht), a.key) ? { ok: true, how: 'bip322-p2tr' } : { ok: false, why: 'signed by a different address' }; }
    catch (e) { return { ok: false, why: 'bad taproot signature' }; }
  }
  if (a.type === 'p2wpkh' || a.type === 'p2sh') {
    if (w.length !== 2 || w[1].length !== 33) return { ok: false, why: 'not a segwit key signature' };
    const pub = w[1], kh = h160(pub);
    if (a.type === 'p2wpkh' && !eq(kh, a.hash)) return { ok: false, why: 'signed by a different address' };
    if (a.type === 'p2sh' && !eq(h160(cat(Uint8Array.of(0x00, 0x14), kh)), a.hash)) return { ok: false, why: 'signed by a different address' };
    const code = cat(Uint8Array.of(0x76, 0xa9, 0x14), kh, Uint8Array.of(0x88, 0xac));
    /* P2SH-P2WPKH: to_spend still pays the P2SH script, and the sighash is the same BIP-143 one */
    return ecdsaOk(w[0], pub, sighashSegwitV0(txid, code, w[0][w[0].length - 1])) ? { ok: true, how: 'bip322-' + a.type } : { ok: false, why: 'signature does not match' };
  }
  return { ok: false, why: 'Legacy addresses sign with the classic signature: please update your wallet and try again' };
}

export function verifyMessage(address, message, signature) {
  const a = decodeAddress(address);
  if (!a) return { ok: false, why: 'not a Bitcoin mainnet address' };
  let sig; try { sig = base64.decode(String(signature || '').trim()); } catch (e) { return { ok: false, why: 'signature is not base64' }; }
  if (sig.length === 65 && sig[0] >= 27 && sig[0] <= 42) {
    const r = verifyBip137(a, message, sig);
    if (r.ok || a.type === 'p2pkh') return r;
  }
  return verifyBip322(a, message, sig);
}
