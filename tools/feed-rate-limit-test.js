#!/usr/bin/env node
/* feed-rate-limit (2026-10-25): tools/lib/core-limiter.js (the feed's Counterparty gate) and the feed's incremental sale read.
 * Offline: every fetch is mocked. Run: node tools/feed-rate-limit-test.js */
'use strict';
const assert = require('assert'), path = require('path'), fs = require('fs');
const L = require('./lib/core-limiter.js');
const ROOT = path.resolve(__dirname, '..');
const resp = (status, body, h) => ({ status, ok: status >= 200 && status < 300, headers: { get: k => (h || {})[k.toLowerCase()] ?? null }, json: async () => body, body: null });
let fails = 0; const t = async (name, fn) => { try { await fn(); console.log('ok   ' + name); } catch (e) { fails++; console.log('FAIL ' + name + ': ' + (e && e.stack || e)); } };
(async () => {
  await t('Retry-After parsing: seconds, HTTP date, junk', () => {
    assert.strictEqual(L.retryAfterMs('7', 0), 7000); assert.strictEqual(L.retryAfterMs(new Date(5000).toUTCString(), 0), 5000);
    assert.strictEqual(L.retryAfterMs('', 0), null); assert.strictEqual(L.retryAfterMs('soon', 0), null); assert.strictEqual(L.retryAfterMs(null, 0), null); });
  await t('concurrency cap and start spacing (conc 2, 25 rps)', async () => {
    let live = 0, peak = 0; const starts = [];
    const f = L.makeFetch(async () => { live++; peak = Math.max(peak, live); starts.push(Date.now()); await new Promise(r => setTimeout(r, 15)); live--; return resp(200, {}); }, { conc: 2, rps: 25 });
    await Promise.all(Array.from({ length: 12 }, (_, i) => f('https://api.counterparty.io:4000/v2/x' + i)));
    assert.ok(peak <= 2, 'peak ' + peak); starts.sort((a, b) => a - b);
    for (let i = 1; i < starts.length; i++) assert.ok(starts[i] - starts[i - 1] >= 35, 'gap ' + (starts[i] - starts[i - 1])); assert.strictEqual(f.stats.requests, 12); });
  await t('429 honours Retry-After for the whole host, jitter only adds, then retries the same URL', async () => {
    let clock = 0; const sleeps = [], seen = []; let n = 0;
    const f = L.makeFetch(async u => { seen.push([u, clock]); return n++ === 0 ? resp(429, null, { 'retry-after': '10' }) : resp(200, { ok: u }); },
      { conc: 1, rps: 1000, now: () => clock, sleep: async ms => { sleeps.push(ms); clock += ms; }, random: () => 0.5 });
    const [a, b] = await Promise.all([f('https://api.unspendablelabs.com:4000/v2/a'), f('https://api.unspendablelabs.com:4000/v2/b')]);
    assert.strictEqual(a.status, 200); assert.strictEqual(b.status, 200);
    assert.deepStrictEqual(seen.map(s => s[0].slice(-1)), ['a', 'b', 'a']); /* b was already queued behind a; after the 429 nobody starts until the pause ends */
    assert.ok(seen[2][1] >= 12500, 'retry at ' + seen[2][1]); assert.strictEqual(f.stats.r429, 1); assert.strictEqual(f.stats.retries, 1); });
  await t('missing Retry-After: 2 s doubling cooldown; gives the 429 back after maxRetries', async () => {
    let clock = 0, calls = 0; const f = L.makeFetch(async () => { calls++; return resp(429, null); }, { maxRetries: 3, rps: 1000, now: () => clock, sleep: async ms => { clock += ms; }, random: () => 0 });
    const r = await f('https://api.counterparty.io:4000/v2/z'); assert.strictEqual(r.status, 429); assert.strictEqual(calls, 4); assert.ok(clock >= 2000 + 4000 + 8000, 'clock ' + clock); assert.strictEqual(f.stats.gaveUp, 1); });
  await t('a Retry-After over the cap is handed straight back (no 10-minute sleep inside CI)', async () => {
    let calls = 0; const f = L.makeFetch(async () => { calls++; return resp(429, null, { 'retry-after': '600' }); }, { rps: 1000 });
    const r = await f('https://api.counterparty.io:4000/v2/z'); assert.strictEqual(r.status, 429); assert.strictEqual(calls, 1); });
  await t("caller's AbortSignal is dropped (it would fire while queued); other hosts pass through untouched", async () => {
    let sig = 'unset', pass = 0; const f = L.makeFetch(async (u, o) => { if (/mempool/.test(u)) { pass++; assert.ok(o.signal); return resp(200, {}); } sig = o.signal; return resp(200, {}); }, { rps: 1000 });
    const ac = new AbortController(); ac.abort(); await f('https://api.counterparty.io:4000/v2/q', { signal: ac.signal }); assert.ok(sig && !sig.aborted);
    await f('https://mempool.space/api/block-height/1', { signal: ac.signal }); assert.strictEqual(pass, 1); assert.strictEqual(f.stats.passthrough, 1); });
  /* incremental sale read, through the real feed context (tools/api-feed.js context(), same vm + js/v2-sales.js the CI runs) */
  const boot = JSON.parse(fs.readFileSync(path.join(ROOT, 'api/boot.json'), 'utf8'));
  const urls = []; let A = null;
  process.env.FEED_RPS = '1000'; /* mocked network: the pace itself is tested above */
  global.fetch = async u => { urls.push(u); const m = /\/blocks\/(\d+)\/events/.exec(u);
    if (m) return resp(200, { result: +m[1] === boot.dexTip + 1 ? [{ event: 'CREDIT', block_index: +m[1], params: { asset: A, quantity: 1 } }] : [], next_cursor: null });
    return resp(200, { result: [], next_cursor: null }); };
  const feed = require('./api-feed.js'), H = { [boot.dexTip]: boot.dexHash };
  A = feed.context().V2Sales.deedAssets(boot.rows).filter(x => boot.dexAssets.includes(x))[0]; /* a deed token that is in the base */
  await t('incremental: only the token named in the new blocks is re-read; the rest come from boot.json', async () => {
    const ctx = feed.context(); ctx.V2Sales.setBase(boot); urls.length = 0;
    const d = await ctx.V2Sales.loadDex(boot.rows, { tip: boot.dexTip + 3, hashes: H }), last = ctx.V2Sales.loadDex.last;
    const as = ctx.V2Sales.loadDex.lastAssets, fresh = as.filter(x => boot.dexAssets.indexOf(x) < 0); /* tokens not in the base are always read */
    assert.ok(as.includes(A)); assert.strictEqual(last.base, 'boot'); assert.strictEqual(last.reread, 1 + fresh.length); assert.strictEqual(last.kept, as.length - 1 - fresh.length);
    const tok = urls.filter(u => /\/(assets|orders)\/[A-Z0-9.]+\//.test(u)), names = new Set(tok.map(u => /\/(?:assets|orders)\/([A-Z0-9.]+)\//.exec(u)[1]));
    assert.deepStrictEqual([...names].sort(), [A].concat(fresh).sort()); assert.strictEqual(urls.filter(u => /\/blocks\/\d+\/events/.test(u)).length, 3);
    const kept = as.filter(x => x !== A && !fresh.includes(x)), keep = k => ctx.V2Sales._slice ? kept.reduce((n, x) => n + ctx.V2Sales._slice(boot.dex, x)[k].length, 0) : 0; /* A came back empty from the mock: everything else kept as-is */
    ['issuances', 'orders', 'matches', 'credits', 'destructions'].forEach(k => assert.strictEqual(d[k].length, keep(k), k)); });
  await t('incremental: a different hash at dexTip (reorg) -> no base, every token re-read', async () => {
    const ctx = feed.context(); ctx.V2Sales.setBase(boot); urls.length = 0;
    await ctx.V2Sales.loadDex(boot.rows, { tip: boot.dexTip + 3, hashes: { [boot.dexTip]: '00'.repeat(32) } });
    assert.strictEqual(ctx.V2Sales.loadDex.last.base, 'none'); assert.strictEqual(urls.filter(u => /\/issuances\?verbose/.test(u) && /\/assets\//.test(u)).length, ctx.V2Sales.loadDex.lastAssets.length); });
  await t('incremental: base older than XCPETS_TOUCH_MAX -> full re-read; pages keep the 60-block limit', async () => {
    const ctx = feed.context(); ctx.V2Sales.setBase(boot); urls.length = 0;
    await ctx.V2Sales.loadDex(boot.rows, { tip: boot.dexTip + 401, hashes: H }); assert.ok(/base too old/.test(ctx.V2Sales.loadDex.last.base), ctx.V2Sales.loadDex.last.base);
    const src = fs.readFileSync(path.join(ROOT, 'js/v2-sales.js'), 'utf8'); assert.ok(/window\.XCPETS_TOUCH_MAX \|\| 60/.test(src)); });
  await t('feed still refuses to publish when the sale read fails', async () => {
    const src = fs.readFileSync(path.join(ROOT, 'tools/api-feed.js'), 'utf8'); assert.ok(/not publishing \(owners would be wrong\)/.test(src)); });
  console.log(fails ? fails + ' failed' : 'all passed'); process.exit(fails ? 1 : 0);
})();
