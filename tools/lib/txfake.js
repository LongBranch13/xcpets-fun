/* txfake: build structurally real (legacy-serialized) Bitcoin txs carrying an ARC4-encrypted Counterparty message, for tests.
 * build({ins:[txidHex...], outs:[{value, script}|{value, cp:{type, bodyHex}}]}) -> raw hex. Nothing here is signed or broadcast. */
'use strict';
const BC = require('../../rjs/burn-core.js');
function hex2b(h) { return Buffer.from(h, 'hex'); }
function le(n, k) { const b = Buffer.alloc(k); let v = BigInt(n); for (let i = 0; i < k; i++) { b[i] = Number(v & 255n); v >>= 8n; } return b; }
function vi(n) { return n < 0xfd ? Buffer.from([n]) : Buffer.concat([Buffer.from([0xfd]), le(n, 2)]); }
function arc4(key, data) { const S = [...Array(256).keys()]; let j = 0; for (let i = 0; i < 256; i++) { j = (j + S[i] + key[i % key.length]) & 255; [S[i], S[j]] = [S[j], S[i]]; }
  let i = 0; j = 0; return Buffer.from(data.map(x => { i = (i + 1) & 255; j = (j + S[i]) & 255; [S[i], S[j]] = [S[j], S[i]]; return x ^ S[(S[i] + S[j]) & 255]; })); }
function cpScript(key, type, bodyHex) { const pl = Buffer.concat([Buffer.from('CNTRPRTY'), Buffer.from([type]), hex2b(bodyHex)]); const enc = arc4([...hex2b(key)], [...pl]);
  return '6a' + (enc.length < 76 ? enc.length.toString(16).padStart(2, '0') : '4c' + enc.length.toString(16).padStart(2, '0')) + enc.toString('hex'); }
function build(o) {
  const ins = o.ins && o.ins.length ? o.ins : ['11'.repeat(32)];
  const parts = [le(2, 4), vi(ins.length)];
  ins.forEach(t => parts.push(hex2b(t).reverse(), le(0, 4), vi(0), le(0xffffffff, 4)));
  parts.push(vi(o.outs.length));
  o.outs.forEach(x => { const s = x.cp ? cpScript(ins[0], x.cp.type, x.cp.bodyHex) : x.script; parts.push(le(x.value, 8), vi(s.length / 2), hex2b(s)); });
  parts.push(le(0, 4)); return Buffer.concat(parts).toString('hex');
}
/* destroy body: asset id (8) + quantity (8) + tag bytes */
function destroyBody(asset, qty, tag) { return BC.assetHex(asset) + le(qty, 8).reverse().toString('hex') + Buffer.from(String(tag)).toString('hex'); }
function sendBody(asset, qty) { return BC.assetHex(asset) + le(qty, 8).reverse().toString('hex') + '00'.repeat(21); }
/* convenience: a node-shaped compose result for a destroy/send/mpma/issuance with only change back to `me` */
function result(name, me, params, cp, o) { o = o || {}; const change = o.change == null ? 5000 : o.change, fee = o.fee == null ? 300 : o.fee;
  const outs = [{ value: 0, cp }].concat(change ? [{ value: change, script: BC.addressScript(me) }] : []).concat(o.extraOuts || []);
  const raw = build({ ins: o.ins, outs }); return { name, rawtransaction: raw, params: Object.assign({ source: me }, params), btc_in: outs.reduce((a, x) => a + x.value, 0) + fee, btc_fee: fee }; }
module.exports = { build, cpScript, destroyBody, sendBody, result };
