'use strict';
/* Builds one /xp/v1/sync body from the in-memory chain state. The check is the page's own checkText. */
const { bootSync, checkOf } = require('./client');
const DEPTH = 6, WINDOW = 288;
function num(v) { const n = parseInt(v, 10); return isFinite(n) ? n : 0; }
function slicesFor(dex, assets) {
  const set = {}; (assets || []).forEach(a => { set[a] = 1; }); const out = {};
  function bucket(A) { return out[A] || (out[A] = { issuances: [], orders: [], matches: [], credits: [], destructions: [] }); }
  (dex.issuances || []).forEach(x => { if (set[x.asset]) bucket(x.asset).issuances.push(x); });
  (dex.credits || []).forEach(x => { if (set[x.asset]) bucket(x.asset).credits.push(x); });
  (dex.destructions || []).forEach(x => { if (set[x.asset]) bucket(x.asset).destructions.push(x); });
  (dex.orders || []).forEach(o => { if (set[o.give_asset]) bucket(o.give_asset).orders.push(o); else if (set[o.get_asset]) bucket(o.get_asset).orders.push(o); });
  (dex.matches || []).forEach(m => { if (set[m.forward_asset]) bucket(m.forward_asset).matches.push(m); else if (set[m.backward_asset]) bucket(m.backward_asset).matches.push(m); });
  return out;
}
function touchedSince(dex, dt, universe) {
  const set = {}; (universe || []).forEach(a => { set[a] = 1; }); const hit = {};
  function see(A, b) { if (A && set[A] && Number(b) > dt) hit[A] = 1; }
  (dex.issuances || []).forEach(x => see(x.asset, x.block_index));
  (dex.credits || []).forEach(x => see(x.asset, x.block_index));
  (dex.destructions || []).forEach(x => see(x.asset, x.block_index));
  (dex.orders || []).forEach(o => { see(o.give_asset, o.block_index); see(o.get_asset, o.block_index); });
  (dex.matches || []).forEach(m => { see(m.forward_asset, m.block_index); see(m.backward_asset, m.block_index); });
  return Object.keys(hit);
}
function neededMap(rows, tip, gates) {
  const list = bootSync().neededBlocks(rows, tip, gates);
  const o = {}; list.forEach(b => { o[b] = 1; }); return o;
}
function pickHashes(all, want) { const o = {}; Object.keys(want).forEach(k => { if (all[k]) o[k] = all[k]; }); return o; }
function dexAssetsOf(dex) {
  const s = {};
  (dex.issuances || []).forEach(x => { if (x.asset) s[x.asset] = 1; });
  (dex.credits || []).forEach(x => { if (x.asset) s[x.asset] = 1; });
  (dex.destructions || []).forEach(x => { if (x.asset) s[x.asset] = 1; });
  return Object.keys(s).sort();
}
function buildAnswer(state, query, opt) {
  opt = opt || {};
  if (!state || !state.ready || !(state.tip > 0)) return { status: 503, body: { v: 1, error: 'catching up', tip: state && state.tip || 0, lag: state && state.lag || null } };
  const tip = state.tip, rows = state.rows || [];
  let since = num(query && query.since); if (since < 0) since = 0; if (since > tip) since = tip;
  const sh = /^[0-9a-f]{1,16}$/i.test(query && query.sh || '') ? String(query.sh).toLowerCase() : '';
  let dt = num(query && query.dt); if (dt < 0) dt = 0; if (dt > tip) dt = tip;
  const ring = state.ring || [];
  const known = ring.filter(r => r.tip === since)[0];
  const hashAt = (state.hashes && state.hashes[since]) || (known && known.tipHash) || '';
  const reorg = !!(sh && hashAt && String(hashAt).slice(0, 16) !== sh);
  const tooOld = since > 0 && (tip - since > WINDOW || !known);
  const full = reorg || !since || tooOld || !hashAt;
  const mode = reorg ? 'reorg' : full ? 'full' : 'delta';
  const from = full ? 0 : Math.max(0, since - DEPTH);
  const list = full ? rows.slice() : rows.filter(r => r.block_index >= from);
  const gates = state.gates || opt.gates || {};
  const need = neededMap(rows, tip, gates);
  const sendH = {};
  Object.keys(need).forEach(k => { if (!state.hashes[k]) return; if (full || +k >= from) sendH[k] = state.hashes[k]; });
  const fullH = pickHashes(state.hashes, need);
  const dex = state.dex || null;
  const assets = state.dexAssets && state.dexAssets.length ? state.dexAssets.slice() : dex ? dexAssetsOf(dex) : [];
  let dexAns = null;
  if (dex) {
    const dexFull = full || !dt || tip - dt > WINDOW;
    if (dexFull) dexAns = { mode: full ? mode : 'full', tip: tip, hash: state.hashes[tip] || state.dexHash || '', assets: assets, body: dex };
    else {
      const hit = touchedSince(dex, dt, assets);
      dexAns = { mode: 'delta', tip: tip, hash: state.hashes[tip] || '', assets: assets, replace: slicesFor(dex, hit) };
    }
  }
  const lag = Math.max(0, (Math.max(state.coreHeight || 0, state.mempoolHeight || 0) || tip) - tip);
  const body = { v: 1, network: 'mainnet', asset: 'XCPETS', tip: tip, tipHash: state.tipHash || state.hashes[tip] || '', coreHeight: state.coreHeight || tip, lag: lag,
    builtAt: state.builtAt || new Date().toISOString(), mode: mode, since: since,
    rows: { count: rows.length, from: from, list: list }, hashes: sendH, mempool: state.mempool || [], dex: dexAns,
    world: state.world || { ready: false }, check: '' };
  body.check = checkOf(rows, fullH, dex);
  const etag = '"' + [tip, String(body.tipHash).slice(0, 16), String(dexAns && dexAns.hash || '').slice(0, 16), since, state.mempoolGen || 0].join('-') + '"';
  return { status: 200, etag: etag, body: body };
}
module.exports = { buildAnswer, slicesFor, touchedSince, dexAssetsOf, DEPTH, WINDOW };
