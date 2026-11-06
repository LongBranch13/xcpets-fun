#!/usr/bin/env node
/* Offline page regression: failed v2-rules.js must leave Retry, no adapter and no uncaught errors.
 * All non-local requests, including the error collector, are blocked. No signing or wallet calls. */
'use strict';
const assert = require('assert');
function chromium() {
  for (const p of [process.env.PLAYWRIGHT_CORE, '/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core', 'playwright-core', 'playwright']) {
    if (!p) continue; try { return require(p).chromium; } catch (_) {}
  }
  throw new Error('playwright-core not found');
}
(async () => {
  const browser = await chromium().launch({ executablePath: process.env.CHROME || '/opt/google/chrome/chrome', headless: true, args: ['--no-sandbox'] });
  const base = 'http://localhost:' + (process.env.XCPETS_TEST_PORT || '8099');
  let checks = 0;
  try {
    for (const url of ['/play.html', '/', '/pet.html?id=53884', '/shop.html']) {
      const ctx = await browser.newContext(), pg = await ctx.newPage(), errors = [];
      pg.on('pageerror', e => errors.push(e.message));
      await require('./lib/serve-repo.js')(pg, {}, base);
      await pg.route('**/*', r => {
        const u = r.request().url();
        if (!u.startsWith(base + '/') || u.includes('/js/v2-rules.js')) return r.abort();
        return r.fallback();
      });
      await pg.goto(base + url, { waitUntil: 'load' });
      // Two UI poll ticks, including the badges poller which used to call replay on the broken adapter.
      await pg.waitForTimeout(2500);
      assert.deepStrictEqual(errors, [], url + ' page errors'); checks++;
      assert.strictEqual(await pg.evaluate(() => !!window.V2Mock), false, url + ' must fail closed'); checks++;
      assert.match(await pg.locator('#v2boot').textContent(), /Could not load the game.*Retry/, url); checks++;
      assert.strictEqual(await pg.locator('#v2boot button').count(), 1, url + ' Retry'); checks++;
      await ctx.close();
    }
  } finally { await browser.close(); }
  console.log('chain-deps-browser-test: ' + checks + ' checks pass');
})().catch(e => { console.error(e); process.exitCode = 1; });
