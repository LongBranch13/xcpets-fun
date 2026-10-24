#!/usr/bin/env node
/* compose-check-test: the fail-closed safety check run before XCP Wallet is asked to sign anything.
 * Real mainnet txs (tools/fixtures/real-compose-txs.json) must pass; every tamper must be refused with a clear reason. */
'use strict';
const BC = require('../rjs/burn-core.js'), F = require('./lib/txfake.js');
const X = require('./fixtures/real-compose-txs.json').txs;
let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('ok   ' + name); } catch (e) { fail++; console.log('FAIL ' + name + ': ' + e.message); } }
function ok(c, m) { if (!c) throw new Error(m || 'assert'); }
function has(list, re) { ok(list.some(p => re.test(p)), 'expected a problem matching ' + re + ', got ' + JSON.stringify(list)); }
const clone = o => JSON.parse(JSON.stringify(o));

/* ---- destroy (burn) ---- */
const D = X.destroy;
const dRes = () => ({ name: 'destroy', rawtransaction: D.raw, btc_in: D.btc_in, btc_fee: D.btc_fee, params: { source: D.source, asset: D.asset, quantity: D.quantity, tag: D.tag } });
const dExp = () => ({ address: D.source, quantityRaw: String(D.quantity), tag: D.tag, satPerVbyte: 1 });
t('real destroy passes', () => { const c = BC.checkComposeResult(dRes(), dExp()); ok(c.ok, JSON.stringify(c.problems)); });
t('destroy: wrong tag in params refused', () => { const r = dRes(); r.params.tag = 'pet:deed:1:x'; has(BC.checkComposeResult(r, dExp()).problems, /tag differs/); });
t('destroy: expected different tag -> raw tx tag differs', () => { const e = dExp(); e.tag = 'pet:deed:25784:other'; const r = dRes(); r.params.tag = e.tag; has(BC.checkComposeResult(r, e).problems, /raw tx tag differs/); });
t('destroy: more quantity expected than raw burns', () => { const e = dExp(); e.quantityRaw = '2'; const r = dRes(); r.params.quantity = 2; has(BC.checkComposeResult(r, e).problems, /raw tx quantity differs/); });
for (const k of ['source', 'asset', 'quantity', 'tag']) t('destroy: missing param ' + k + ' refused', () => { const r = dRes(); delete r.params[k]; has(BC.checkComposeResult(r, dExp()).problems, new RegExp(k === 'source' ? 'source missing' : k + ' missing')); });
t('destroy: no params at all refused', () => { const r = dRes(); delete r.params; ok(!BC.checkComposeResult(r, dExp()).ok); });
t('destroy: wrong name refused', () => { const r = dRes(); r.name = 'send'; has(BC.checkComposeResult(r, dExp()).problems, /composed a send/); });
t('destroy: missing btc_in refused', () => { const r = dRes(); delete r.btc_in; has(BC.checkComposeResult(r, dExp()).problems, /btc_in/); });
t('destroy: btc_fee lie refused', () => { const r = dRes(); r.btc_fee = 1; has(BC.checkComposeResult(r, dExp()).problems, /does not match/); });
t('destroy: fee above cap refused', () => { const r = dRes(); r.btc_in = D.btc_in + 60000; r.btc_fee = null; has(BC.checkComposeResult(r, dExp()).problems, /above the cap/); });
t('destroy: fee above 2 times the fee rate refused', () => { const r = dRes(); r.btc_in = D.btc_in + 4000; delete r.btc_fee; has(BC.checkComposeResult(r, dExp()).problems, /above the cap/); });
t('destroy: garbage hex refused', () => { const r = dRes(); r.rawtransaction = 'zz'; ok(!BC.checkComposeResult(r, dExp()).ok); });
t('destroy: truncated tx refused', () => { const r = dRes(); r.rawtransaction = D.raw.slice(0, 60); has(BC.checkComposeResult(r, dExp()).problems, /could not decode/); });
const me = D.source, stranger = X.issuance.source;
const fakeD = (o) => F.result('destroy', me, { asset: 'XCPETS', quantity: 1, tag: 'pet:t:1' }, { type: 110, bodyHex: F.destroyBody('XCPETS', 1, 'pet:t:1') }, o);
const fExp = { address: me, quantityRaw: '1', tag: 'pet:t:1', satPerVbyte: 1 };
t('built destroy (txfake) passes', () => { const c = BC.checkComposeResult(fakeD(), fExp); ok(c.ok, JSON.stringify(c.problems)); });
t('destroy: extra output to a stranger refused', () => { has(BC.checkComposeResult(fakeD({ extraOuts: [{ value: 1000, script: BC.addressScript(stranger) }] }), fExp).problems, /unexpected destination/); });
t('destroy: change to a stranger refused', () => { const r = F.result('destroy', stranger, { asset: 'XCPETS', quantity: 1, tag: 'pet:t:1' }, { type: 110, bodyHex: F.destroyBody('XCPETS', 1, 'pet:t:1') }); r.params.source = me; has(BC.checkComposeResult(r, fExp).problems, /unexpected destination/); });
t('destroy: other asset in raw tx refused', () => { const r = F.result('destroy', me, { asset: 'XCPETS', quantity: 1, tag: 'pet:t:1' }, { type: 110, bodyHex: F.destroyBody('XCP', 1, 'pet:t:1') }); has(BC.checkComposeResult(r, fExp).problems, /different asset/); });

/* ---- issuance (pet token) ---- */
const I = X.issuance;
const iPlan = () => ({ kind: 'issuance', asset: I.asset, description: I.description });
const iRes = () => ({ name: 'issuance', rawtransaction: I.raw, btc_in: I.btc_in, btc_fee: I.btc_fee, params: { source: I.source, asset: I.asset, quantity: 1, divisible: false, lock: true, description: I.description } });
t('real issuance passes', () => { const p = BC.checkDexTx(iRes(), I.source, iPlan(), 1); ok(!p.length, JSON.stringify(p)); });
t('issuance: other description refused', () => { const p = iPlan(); p.description = 'https://xcpets.fun/t/3.json'; has(BC.checkDexTx(iRes(), I.source, p, 1), /description differs/); });
t('issuance: other asset refused', () => { const p = iPlan(); p.asset = 'A11825070992356920203'; has(BC.checkDexTx(iRes(), I.source, p, 1), /asset differs/); });
t('issuance: wrong change owner refused', () => { has(BC.checkDexTx(iRes(), me, iPlan(), 1), /unexpected destination/); });
t('issuance: checked as an order refused', () => { has(BC.checkDexTx(iRes(), I.source, { kind: 'order' }, 1), /not a order/); });
t('issuance: missing btc_in refused', () => { const r = iRes(); delete r.btc_in; has(BC.checkDexTx(r, I.source, iPlan(), 1), /btc_in/); });

/* ---- order (shop listing) ---- */
const O = X.order;
const oPlan = () => ({ give_asset: O.give_asset, give_quantity: O.give_quantity, get_asset: O.get_asset, get_quantity: O.get_quantity, expiration: O.expiration });
const oRes = () => ({ name: 'order', rawtransaction: O.raw, btc_in: O.btc_in, btc_fee: O.btc_fee, params: Object.assign({ source: O.source }, oPlan()) });
t('real order passes', () => { const p = BC.checkDexTx(oRes(), O.source, oPlan(), 1); ok(!p.length, JSON.stringify(p)); });
t('order: other amount asked refused', () => { const p = oPlan(); p.get_quantity = 200000000; has(BC.checkDexTx(oRes(), O.source, p, 1), /get quantity differs/); });
t('order: other token given refused', () => { const p = oPlan(); p.give_asset = 'A11825070992356920203'; has(BC.checkDexTx(oRes(), O.source, p, 1), /give asset differs/); });
t('order: other expiration refused', () => { const p = oPlan(); p.expiration = 100; has(BC.checkDexTx(oRes(), O.source, p, 1), /expiration differs/); });
t('order: no raw tx refused', () => { const r = oRes(); delete r.rawtransaction; has(BC.checkDexTx(r, O.source, oPlan(), 1), /no raw transaction/); });

/* ---- send (gift) built with txfake ---- */
const tok = I.asset, sendR = (asset, q) => F.result('send', me, { asset: tok, quantity: 1, destination: stranger }, { type: 2, bodyHex: F.sendBody(asset, q) });
t('built send passes', () => { const p = BC.checkDexTx(sendR(tok, 1), me, { kind: 'send', asset: tok, destination: stranger }, 1); ok(!p.length, JSON.stringify(p)); });
t('send: raw tx sends XCPETS refused', () => { has(BC.checkDexTx(sendR('XCPETS', 1), me, { kind: 'send', asset: tok, destination: stranger }, 1), /raw tx asset differs/); });
t('send: raw tx quantity 5 refused', () => { has(BC.checkDexTx(sendR(tok, 5), me, { kind: 'send', asset: tok, destination: stranger }, 1), /raw tx quantity differs/); });
t('legacy issuance type 20 refused', () => { const r = F.result('issuance', me, {}, { type: 20, bodyHex: '00'.repeat(20) }); has(BC.checkDexTx(r, me, { kind: 'issuance', asset: tok, description: 'x' }, 1), /legacy issuance/); });

/* ---- wallet dexCheck: node params required ---- */
const V = require('../js/v2-wallet.js')({ Wallet: require('../rjs/wallet.js'), BurnCore: BC, CFG: {}, win: {}, fetch: () => Promise.reject(new Error('no network in tests')), storage: { getItem() { return null; }, setItem() {}, removeItem() {} } });
const dex = V._dexCheck;
if (typeof dex === 'function') {
  t('wallet dexCheck: real order passes', () => { const p = dex(oRes(), O.source, oPlan(), 1); ok(!p.length, JSON.stringify(p)); });
  t('wallet dexCheck: missing give_quantity refused', () => { const r = oRes(); delete r.params.give_quantity; has(dex(r, O.source, oPlan(), 1), /give_quantity missing/); });
  t('wallet dexCheck: missing source refused', () => { const r = oRes(); delete r.params.source; has(dex(r, O.source, oPlan(), 1), /source missing/); });
  t('wallet dexCheck: real issuance passes', () => { const p = dex(iRes(), I.source, iPlan(), 1); ok(!p.length, JSON.stringify(p)); });
  t('wallet dexCheck: missing lock refused', () => { const r = iRes(); delete r.params.lock; has(dex(r, I.source, iPlan(), 1), /lock differs/); });
  t('wallet dexCheck: missing name refused', () => { const r = oRes(); delete r.name; has(dex(r, O.source, oPlan(), 1), /did not say/); });
} else { fail++; console.log('FAIL wallet _dexCheck not reachable from node'); }
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
