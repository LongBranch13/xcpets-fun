#!/usr/bin/env node
/* feed-invalid-order-fix (2026-10-28): GET /orders/<A>/XCP?status=all&verbose=true answers HTTP 500 on both Core nodes for pet tokens with an
 * invalid zero-give order. js/v2-sales.js orderRows() falls back (asset orders -> per-status -> non-verbose), drops invalid / zero-give orders,
 * and as a last resort marks only that pet's orders stale so the feed still publishes. Offline: every fetch is mocked.
 * feed-status-filter (2026-10-28): every order list now asks for status=open,filled,expired,cancelled (never status=all); the primary pair list with
 * that filter is what answers 200 on the live nodes. The mocks below make even the filtered list 500 to keep the fallback chain covered.
 * Run: node tools/feed-invalid-order-test.js */
'use strict';
const assert = require('assert'), path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const resp = (status, body) => ({ status, ok: status >= 200 && status < 300, headers: { get: () => null }, json: async () => body, text: async () => JSON.stringify(body), body: null });
let fails = 0; const t = async (name, fn) => { try { await fn(); console.log('ok   ' + name); } catch (e) { fails++; console.log('FAIL ' + name + ': ' + (e && e.stack || e)); } };
const boot = JSON.parse(fs.readFileSync(path.join(ROOT, 'api/boot.json'), 'utf8'));
process.env.FEED_RPS = '1000';
const feed = require('./api-feed.js');
const BAD = feed.context().V2Sales.deedAssets(boot.rows).filter(x => boot.dexAssets.includes(x))[0]; /* any deed token in the base stands in for a bad one */
const SQ = 'open,filled,expired,cancelled';
const ord = (h, st, gq, give, get, b) => ({ tx_hash: h, tx_index: b, block_index: b, source: 'bc1qtest', give_asset: give, give_quantity: gq, give_remaining: gq, get_asset: get, get_quantity: 100, get_remaining: 100, expiration: 10, expire_index: b + 9, status: st });
const GOOD = ord('aa'.repeat(32), 'open', 1, BAD, 'XCP', 973570), INV = ord('bb'.repeat(32), 'invalid', 0, 'XCP', BAD, 973574), ZERO = ord('cc'.repeat(32), 'expired', 0, 'XCP', BAD, 973587),
  OTHER = ord('dd'.repeat(32), 'open', 1, BAD, 'XCPETS', 973571);
let mode = {}, urls = [];
global.fetch = async u => { urls.push(u); const q = u.replace(/^https:\/\/[^/]+\/v2/, '').replace(/[?&]limit=1000.*$/, '').replace(/&$/, '');
  const be = /\/blocks\/(\d+)\/events/.exec(u);
  if (be) return resp(200, { result: +be[1] === boot.dexTip + 1 ? [{ event: 'CREDIT', block_index: +be[1], params: { asset: BAD, quantity: 1 } }] : [], next_cursor: null });
  if (/status=all/.test(u)) { mode.sawAll = 1; return resp(500, { error: 'status=all must not be used' }); }
  if (q === '/orders/' + BAD + '/XCP?status=' + SQ + '&verbose=true') return mode.primary === 400 ? resp(400, { error: 'bad' }) : mode.primary === 'csv' ? resp(400, { error: 'Invalid value for status: ' + SQ + ' (expected one of: all, open, expired, filled, cancelled)' }) : resp(500, { error: 'Internal server error' });
  if (q === '/assets/' + BAD + '/orders?status=' + SQ + '&verbose=true') return mode.asset || mode.primary === 'csv' ? resp(500, { error: 'x' }) : resp(200, { result: [GOOD, INV, ZERO, OTHER], next_cursor: null });
  let m = /^\/orders\/[A-Z0-9]+\/XCP\?status=(open|filled|expired|cancelled)&verbose=true$/.exec(q);
  if (m && q.indexOf(BAD) > 0) return mode.status ? resp(500, { error: 'x' }) : resp(200, { result: m[1] === 'open' ? [GOOD] : m[1] === 'expired' ? [ZERO] : [], next_cursor: null });
  if (q === '/orders/' + BAD + '/XCP?status=' + SQ) return mode.plain ? resp(500, { error: 'x' }) : resp(200, { result: [GOOD, INV], next_cursor: null });
  return resp(200, { result: [], next_cursor: null }); };
const run = async (withBase) => { const ctx = feed.context(); if (withBase) ctx.V2Sales.setBase(boot); urls.length = 0;
  const cx = withBase ? { tip: boot.dexTip + 1, hashes: { [boot.dexTip]: boot.dexHash } } : undefined; /* block dexTip+1 credits BAD -> BAD is re-read */
  const d = await ctx.V2Sales.loadDex(boot.rows, cx); return { d: J(d), ctx, last: J(ctx.V2Sales.loadDex.last), as: J(ctx.V2Sales.loadDex.lastAssets) }; };
const J = x => x == null ? x : JSON.parse(JSON.stringify(x)); /* vm arrays come from another realm */
const mine = d => d.orders.filter(o => o.give_asset === BAD || o.get_asset === BAD).map(o => o.tx_hash).sort();
(async () => {
  await t('500 on the verbose pair list -> /assets/A/orders (this pair only), invalid + zero-give dropped', async () => { mode = {};
    const { d, last, as } = await run(false); assert.deepStrictEqual(mine(d), [GOOD.tx_hash]); assert.ok(!d.staleAssets); assert.ok(as.includes(BAD));
    assert.deepStrictEqual(last.orderFallback, [BAD + '/XCP:asset-orders']); assert.ok(d.orders.every(o => o.status !== 'invalid' && Number(o.give_quantity) > 0)); });
  await t('asset list also 500 -> per-status lists', async () => { mode = { asset: 1 };
    const { d, last } = await run(false); assert.deepStrictEqual(mine(d), [GOOD.tx_hash]); assert.deepStrictEqual(last.orderFallback, [BAD + '/XCP:per-status']);
    assert.strictEqual(urls.filter(u => /status=(open|filled|expired|cancelled)&verbose/.test(u) && u.indexOf(BAD) > 0).length, 4); });
  await t('asset + per-status 500 -> non-verbose pair list', async () => { mode = { asset: 1, status: 1 };
    const { d, last } = await run(false); assert.deepStrictEqual(mine(d), [GOOD.tx_hash]); assert.deepStrictEqual(last.orderFallback, [BAD + '/XCP:non-verbose']); });
  await t('everything 500 -> only that pet stale (base orders kept), rest still loads, pet left out of dexAssets', async () => { mode = { asset: 1, status: 1, plain: 1 };
    const { d, last, as } = await run(true); if (process.env.DBG) console.log(JSON.stringify(last), urls.filter(u => u.indexOf(BAD) > 0).join("\n"));
    assert.deepStrictEqual(d.staleAssets, [BAD]); assert.ok(!d.stale); assert.ok(!as.includes(BAD)); assert.deepStrictEqual(last.staleOrders, [BAD]);
    const baseXcp = boot.dex.orders.filter(o => (o.give_asset === BAD && o.get_asset === 'XCP') || (o.give_asset === 'XCP' && o.get_asset === BAD)).map(o => o.tx_hash);
    baseXcp.forEach(h => assert.ok(d.orders.some(o => o.tx_hash === h), 'base order kept ' + h)); });
  await t('non-5xx (400) on the pair list still fails the read like before', async () => { mode = { primary: 400 };
    await assert.rejects(run(false)); });
  await t('a node that rejects the comma list (400 on status) -> single-status lists, same orders', async () => { mode = { primary: 'csv' };
    const { d, last } = await run(false); assert.deepStrictEqual(mine(d), [GOOD.tx_hash]); assert.deepStrictEqual(last.orderFallback, [BAD + '/XCP:per-status']); });
  await t('feed-status-filter: no request anywhere in loadDex uses status=all', async () => { for (const m of [{}, { asset: 1 }, { asset: 1, status: 1 }, { asset: 1, status: 1, plain: 1 }]) { mode = m; await run(!!m.plain);
      assert.ok(!mode.sawAll, 'status=all sent with mode ' + JSON.stringify(m)); assert.strictEqual(urls.filter(u => /status=all/.test(u)).length, 0); } });
  await t('no 500: verbose pair list used, no fallback calls', async () => { mode = {}; const ctx = feed.context(); urls.length = 0;
    const save = global.fetch; global.fetch = async u => { urls.push(u); return resp(200, { result: u.indexOf('/orders/' + BAD + '/XCP?status=' + SQ + '&verbose') > 0 ? [GOOD, INV] : [], next_cursor: null }); };
    try { const d = J(await ctx.V2Sales.loadDex(boot.rows)); assert.deepStrictEqual(mine(d), [GOOD.tx_hash]); assert.ok(!J(ctx.V2Sales.loadDex.last).orderFallback);
      assert.strictEqual(urls.filter(u => /\/assets\/[A-Z0-9]+\/orders|status=all|status=(open|filled|expired|cancelled)&/.test(u)).length, 0);
      assert.ok(urls.some(u => u.indexOf('/orders/' + BAD + '/XCP?status=' + SQ + '&verbose=true') > 0), 'filtered pair list asked'); } finally { global.fetch = save; } });
  console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})();
