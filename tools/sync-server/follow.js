'use strict';
/* Block follower. Reads go through the caller's getJson (tests pass a fake; the process uses the public nodes, or XP_UPSTREAMS). */
const { bootSync } = require('./client');
const WINDOW = 288;
function blank() { return { tip: 0, tipHash: '', coreHeight: 0, mempoolHeight: 0, rows: [], hashes: {}, dex: null, dexAssets: [], dexTip: 0, dexHash: '', mempool: [], mempoolGen: 0, ring: [], gates: {}, builtAt: null, lastBlockAt: null, upstream: 'public', ready: false, world: { ready: false }, lag: 0 }; }
function fillRing(state) {
  const from = Math.max(0, state.tip - (WINDOW - 1)); const ring = [];
  for (let h = from; h <= state.tip; h++) if (state.hashes[h]) ring.push({ tip: h, tipHash: state.hashes[h] });
  state.ring = ring.slice(-WINDOW);
}
function pool(items, n, fn) { let i = 0; const ws = [];
  function one() { if (i >= items.length) return Promise.resolve(); const b = items[i++]; return fn(b).then(one); }
  for (let k = 0; k < Math.min(n, items.length); k++) ws.push(one()); return Promise.all(ws); }
async function readRows(getJson, asset) {
  const P = '/assets/' + asset + '/destructions?limit=1000'; let rows = [], seen = {}, cursor = null, guard = 0;
  for (;;) { const j = await getJson(P + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '')) || {};
    rows = rows.concat(j.result || []);
    if (j.next_cursor == null || !(j.result || []).length) return rows;
    if (seen[j.next_cursor] || ++guard > 50) throw new Error('burn page cursor');
    seen[j.next_cursor] = 1; cursor = j.next_cursor; }
}
async function fillHashes(state, needed, io) {
  const seed = io.seed || {};
  needed.forEach(b => { if (!state.hashes[b] && seed[b]) state.hashes[b] = seed[b]; });
  const miss = needed.filter(b => !state.hashes[b]);
  await pool(miss, 4, async b => { const h = await io.hashOf(b); if (!/^[0-9a-f]{64}$/.test(h || '')) throw new Error('missing hash'); state.hashes[b] = h; });
}
function dropShallow(state, tip) { Object.keys(state.hashes).forEach(k => { if (+k > tip - 6) delete state.hashes[k]; }); }
async function applyTip(state, io, height) {
  const asset = io.asset || 'XCPETS';
  const page = await io.getJson('/assets/' + asset + '/destructions?limit=1000');
  let rows = null;
  if (state.rows.length && state.tip && io.mergeRows) rows = io.mergeRows(page, state.rows, state.tip);
  if (!rows) rows = await readRows(io.getJson, asset);
  state.rows = rows;
  dropShallow(state, height);
  const needed = bootSync().neededBlocks(rows, height, state.gates || {});
  await fillHashes(state, needed, io);
  const still = needed.filter(b => !state.hashes[b]);
  if (still.length) throw new Error('missing hashes');
  if (io.loadDex) {
    const dex = await io.loadDex(rows, { tip: height, hashes: state.hashes, dex: state.dex, dexTip: state.dexTip, dexHash: state.dexHash, dexAssets: state.dexAssets });
    if (dex) { state.dex = io.normalize ? io.normalize(dex) : dex;
      state.dexAssets = io.dexAssets ? io.dexAssets() : (state.dexAssets || []); state.dexTip = height; state.dexHash = state.hashes[height] || ''; }
  }
  state.tip = height; state.tipHash = state.hashes[height] || '';
  state.coreHeight = Math.max(state.coreHeight || 0, height);
  state.lastBlockAt = new Date().toISOString(); state.builtAt = state.lastBlockAt; state.ready = true;
  fillRing(state);
  state.lag = Math.max(0, Math.max(state.coreHeight || 0, state.mempoolHeight || 0) - state.tip);
}
async function tick(state, io) {
  const info = await io.getJson('/');
  const height = info && info.result && (info.result.counterparty_height || (info.result.last_block && info.result.last_block.block_index));
  if (!(height > 0)) throw new Error('tip');
  state.coreHeight = height;
  if (io.upstream) state.upstream = io.upstream;
  if (io.mempool) { try { const mp = await io.mempool(); state.mempool = mp || []; state.mempoolGen = (state.mempoolGen || 0) + 1; } catch (e) { /* display only */ } }
  if (io.mempoolHeight) { try { const h = await io.mempoolHeight(); if (h > (state.mempoolHeight || 0)) state.mempoolHeight = h; } catch (e) {} }
  state.lag = Math.max(0, Math.max(state.coreHeight || 0, state.mempoolHeight || 0) - (state.tip || 0));
  if (!state.ready || height > state.tip) await applyTip(state, io, height);
  else { state.builtAt = new Date().toISOString(); state.lag = Math.max(0, Math.max(state.coreHeight || 0, state.mempoolHeight || 0) - state.tip); }
  return state;
}
/* One follow at a time. A tick that is still reading must not start another. */
function singleFlight(fn) {
  let pending = null;
  return function () {
    if (pending) return pending;
    pending = Promise.resolve().then(fn).finally(() => { pending = null; });
    return pending;
  };
}
module.exports = { blank, tick, applyTip, fillRing, readRows, fillHashes, dropShallow, singleFlight };
