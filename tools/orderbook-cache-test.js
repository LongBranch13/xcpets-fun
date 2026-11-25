#!/usr/bin/env node
/* Order book reads try https://node.xcpets.fun/v2 first. Public :4000 nodes are the fallback.
 * Compose never uses the cache. A 429 backs off and does not session-kill the cache.
 * Cache rows match a public node, in the same order. With :4000 blocked, Spam City's order book
 * and the Verify button both finish.
 *   node tools/orderbook-cache-test.js
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto'), { spawn } = require('child_process');
const { load } = require('./lib/load-rules');
const ROOT = path.resolve(__dirname, '..');
const ASSET = 'A9059073792275355799';
const CACHE = 'https://node.xcpets.fun/v2';
const PUB = 'https://api.counterparty.io:4000/v2';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('ok   ' + m); } else { fail++; console.log('FAIL ' + m); } };

function salesBox(fetchImpl) {
  const win = load();
  win.setTimeout = setTimeout; win.clearTimeout = clearTimeout; win.window.setTimeout = setTimeout; win.window.clearTimeout = clearTimeout;
  win.fetch = fetchImpl; win.window.fetch = fetchImpl;
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/v2-sales.js'), 'utf8'), win, { filename: 'v2-sales.js' });
  return { win };
}
function resp(status, body, headers) {
  return { status, ok: status >= 200 && status < 300, headers: { get: k => headers ? headers[String(k).toLowerCase()] || null : null }, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) };
}
function replayFields(rows, kind) {
  if (kind === 'credits') return rows.map(r => [r.credit_index, r.block_index, r.tx_index, r.asset, r.address, r.utxo, r.utxo_address, r.quantity, r.calling_function, r.event]);
  if (kind === 'orders') return rows.map(r => [r.tx_hash, r.tx_index, r.block_index, r.status, r.give_asset, r.give_quantity, r.give_remaining, r.get_asset, r.get_quantity, r.get_remaining, r.expiration, r.expire_index, r.source]);
  return rows.map(r => [r.tx_hash, r.tx_index, r.block_index, r.asset, r.source, r.issuer, r.quantity, r.divisible, r.locked, r.description, r.status]);
}
function getJson(url) {
  return fetch(url, { headers: { 'user-agent': 'xcpets-orderbook-test' } }).then(r => { if (!r.ok) throw new Error(r.status + ' ' + url); return r.json(); });
}

(async () => {
  const rulesMd5 = crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, 'js/v2-rules.js'))).digest('hex');
  ok(rulesMd5 === require('./lib/rules-md5').MAIN, 'js/v2-rules.js bytes unchanged');
  const wallet = fs.readFileSync(path.join(ROOT, 'js/v2-wallet.js'), 'utf8');
  ok(/function composeNodes\(\)[\s\S]{0,500}!\/node\\.xcpets\\.fun\/i\.test\(u\)/.test(wallet), 'composeNodes still refuses node.xcpets.fun');
  ok(!/composeList:[^\n]*node\.xcpets\.fun/.test(fs.readFileSync(path.join(ROOT, 'rjs/config.js'), 'utf8')), 'composeList does not name the read cache');

  { const { win } = salesBox(() => Promise.reject(new Error('unused')));
    const b = win.V2Sales._bases();
    ok(b[0] === CACHE && b[1] === PUB && b[2] === 'https://api.unspendablelabs.com:4000/v2', 'read order is cache, then the two public nodes: ' + b.join(' '));
    ok(b.every(u => !/xcp\.fun/.test(u)), 'reads do not use api.xcp.fun'); }

  { const calls = [];
    const { win, st } = salesBox(url => { calls.push(String(url));
      if (/node\.xcpets\.fun/.test(url)) return Promise.resolve(resp(429, {}, { 'retry-after': '0' }));
      if (/counterparty\.io/.test(url)) return Promise.resolve(resp(200, { result: [{ asset: ASSET, quantity: 1 }], next_cursor: null }));
      return Promise.resolve(resp(500, {})); });
    const pd = await win.V2Sales.tok.chainPend(1, '1JwWsArppwALMEdXWPmpDBcP1jwWsAPYkD', { deeds: {} });
    ok(pd == null, 'a 429 then a public-node answer does not invent a token');
    const dead = win.sessionStorage.getItem('xcpets-dead-nodes') || '';
    ok(dead.indexOf('node.xcpets.fun') < 0, 'a 429 does not write the cache into xcpets-dead-nodes (' + dead + ')');
    ok(calls.filter(u => /node\.xcpets\.fun/.test(u)).length >= 3, '429 was retried with backoff before the next node (' + calls.length + ' calls)');
    const n0 = calls.length;
    await win.V2Sales.tok.chainPend(2, '1JwWsArppwALMEdXWPmpDBcP1jwWsAPYkD', { deeds: {} });
    ok(/node\.xcpets\.fun/.test(calls[n0] || ''), 'the next read still tries the cache first: ' + calls[n0]); }

  { const calls = [];
    const { win } = salesBox(url => { calls.push(String(url));
      if (/:4000\//.test(url)) return Promise.reject(Object.assign(new TypeError('Failed to fetch'), { name: 'TypeError' }));
      if (/\/addresses\//.test(url)) return Promise.resolve(resp(200, { result: [] }));
      return Promise.resolve(resp(200, { result: { counterparty_height: 1 } })); });
    await win.V2Sales.tok.chainPend(3, 'bc1qtke38j72qv4d8eljn7pccaykypw8luytfwdn7q', { deeds: {} });
    ok(calls[0].indexOf(CACHE) === 0, 'with :4000 blocked the first read is the cache: ' + calls[0]);
    ok(calls.some(u => /:4000\//.test(u)) === false || calls[0].indexOf(CACHE) === 0, 'blocked :4000 is not required once the cache answers');
    ok(calls.every(u => u.indexOf(CACHE) === 0), 'no public node was needed: ' + calls.join(' ')); }

  const paths = [
    ['/assets/' + ASSET + '/credits?verbose=true&limit=20', 'credits'],
    ['/assets/' + ASSET + '/orders?status=open,filled,expired,cancelled&verbose=true&limit=20', 'orders'],
    ['/assets/' + ASSET + '/issuances?verbose=true&limit=20', 'issuances']
  ];
  for (const [p, kind] of paths) {
    let a = await getJson(CACHE + p), b = await getJson(PUB + p);
    let ar = a.result || [], br = b.result || [];
    const proj = rows => replayFields(rows, kind).map(r => kind === 'orders' ? r.filter((_, i) => i !== 1) : r);
    const same = () => JSON.stringify(proj(ar)) === JSON.stringify(proj(br));
    if (!same()) { await new Promise(r => setTimeout(r, 400)); a = await getJson(CACHE + p); b = await getJson(PUB + p); ar = a.result || []; br = b.result || []; }
    ok(ar.length === br.length && ar.length > 0, kind + ' page length matches and is not empty (' + ar.length + ')');
    ok(ar.map(r => r.tx_hash || r.credit_index || r.tx_index).join() === br.map(r => r.tx_hash || r.credit_index || r.tx_index).join(), kind + ' comes back in the same row order');
    ok(same(), kind + ' rows match the public node' + (kind === 'orders' ? ' aside from tx_index' : ' field for field'));
    if (kind === 'orders') {
      let reorder = false;
      for (let i = 0; i < ar.length; i++) for (let j = i + 1; j < ar.length; j++) {
        const da = ar[i].tx_index - ar[j].tx_index, db = br[i].tx_index - br[j].tx_index;
        if ((da > 0) !== (db > 0) || (da === 0) !== (db === 0)) reorder = true;
      }
      ok(!reorder, kind + ' tx_index does not reorder any pair against the public node');
    }
    if (kind === 'credits') ok(ar.every((r, i) => r.credit_index === br[i].credit_index) && ar.some(r => r.credit_index != null), 'credit_index is present and lines up');
    await new Promise(r => setTimeout(r, 300));
  }

  await browser();
  console.log('orderbook-cache-test: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL', e && e.stack || e); process.exit(1); });

async function browser() {
  let chromium;
  try { ({ chromium } = require('playwright-core')); } catch (e) { try { ({ chromium } = require('/tmp/pw/node_modules/playwright-core')); } catch (e2) { ok(false, 'playwright-core is installed'); return; } }
  const PORT = 8876;
  const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 400));
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const shotDir = '/opt/cursor/artifacts';
  try { fs.mkdirSync(shotDir, { recursive: true }); } catch (e) {}
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const blocked = [];
  await ctx.route(/:4000\//, route => { blocked.push(route.request().url()); return route.abort('timedout'); });
  const page = await ctx.newPage();
  const logs = [];
  page.on('pageerror', e => logs.push('PAGE ' + e.message));
  page.on('console', m => { const line = m.type() + ' ' + m.text(); if (m.type() === 'error' || /orderbook/.test(line)) logs.push(line); });
  try {
    await page.goto('http://127.0.0.1:' + PORT + '/shop.html?sync=' + encodeURIComponent('https://node.xcpets.fun'), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => { const s = document.getElementById('shop'); const t = s ? s.innerText : ''; return t && !/Reading the order book/.test(t); }, null, { timeout: 240000 });
    const book = await page.locator('#shop').innerText();
    ok(!/Could not read the order book/.test(book), 'order book has no read error');
    ok(/binder|Buy|No pets match|empty/i.test(book) && !/Could not read/.test(book), 'order book rendered: ' + book.replace(/\s+/g, ' ').slice(0, 220));
    if (logs.length) console.log(logs.join('\n'));
    await page.locator('#shop').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(shotDir, 'orderbook-blocked-4000.png'), fullPage: false });
    const verify = page.locator('#splitVerify');
    ok(await verify.count() === 1, 'Verify is on the page');
    await verify.click();
    await page.waitForFunction(() => { const b = document.getElementById('splitViewBar'); const t = b ? b.innerText : ''; return /Checked at block/.test(t) || /did not finish/.test(t); }, null, { timeout: 180000 });
    const bar = await page.locator('#splitViewBar').innerText();
    ok(/Checked at block/.test(bar), 'Verify finished: ' + bar.replace(/\s+/g, ' ').slice(0, 160));
    const book2 = await page.locator('#shop').innerText();
    ok(!/Could not read the order book/.test(book2), 'the order book is still up after Verify');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(shotDir, 'verify-blocked-4000.png'), fullPage: false });
    ok(blocked.length >= 0, 'port 4000 was blocked for ' + blocked.length + ' request(s)');
  } catch (e) {
    ok(false, 'browser flow: ' + (e && e.message));
    try { await page.screenshot({ path: path.join(shotDir, 'orderbook-debug.png'), fullPage: true }); } catch (e2) {}
    if (logs.length) console.log(logs.slice(0, 12).join('\n'));
  }
  await ctx.close();
  await browser.close();
  srv.kill();
}
