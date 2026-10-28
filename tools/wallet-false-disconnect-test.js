/* false-disconnect 2026-10-28 (owner: "Wallet disconnected [Reconnect]" a lot): the pill never goes red while the re-attach check is still
 * running (slow answer, busy main thread, hidden tab), a failed xcp_accounts is retried before red, a locked wallet says "locked",
 * and a 'disconnect' event is confirmed with xcp_accounts first. Run: python3 -m http.server 8099 in the repo root. */
const { chromium } = require('playwright-core');
const ADDR = 'bc1qtestaddressxxxxxxxxxxxxxxxxxxxxxxxxxx';
const HARNESS = '<!doctype html><html><head><meta charset="utf-8"></head><body><script src="rjs/config.js"></script><script src="rjs/wallet.js"></script><script src="rjs/burn-core.js"></script><script src="js/v2-wallet.js"></script></body></html>';
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const res = []; const ok = (n, c, x) => res.push((c ? 'PASS ' : 'FAIL ') + n + (x ? ' — ' + x : ''));
  async function page(mode) {
    const ctx = await b.newContext(), pg = await ctx.newPage(); pg.on('pageerror', e => res.push('FAIL pageerror ' + e.message));
    await pg.route('http://localhost:8099/zz-wfd.html', r => r.fulfill({ contentType: 'text/html', body: HARNESS }));
    await pg.route(/^https?:\/\/(?!localhost)/, r => r.fulfill({ status: 404, body: '' }));
    await pg.addInitScript(([ADDR, mode]) => { try { localStorage.setItem('xcpets-v2-wallet-provider', 'xcpwallet'); } catch (e) {}
      const W = window.__W = { calls: [], acc: [ADDR], h: {}, fails: mode.fails || 0, delay: mode.delay || 0, seen: [] };
      if (mode.hidden) { W.vis = 'hidden'; Object.defineProperty(document, 'visibilityState', { get: () => W.vis }); }
      window.xcpwallet = { on(e, f) { (W.h[e] = W.h[e] || []).push(f); }, request(a) { W.calls.push(a.method);
        if (a.method === 'xcp_accounts') { if (W.fails > 0) { W.fails--; return Promise.reject(new Error('Could not establish connection')); }
          return new Promise(r => setTimeout(() => r(W.acc.slice()), W.delay)); }
        if (a.method === 'xcp_requestAccounts') { W.acc = [ADDR]; return Promise.resolve({ accounts: [ADDR] }); }
        if (a.method === 'xcp_getNetwork') return Promise.resolve('mainnet'); return Promise.resolve(null); } };
      W.fire = (e, v) => (W.h[e] || []).forEach(f => f(v));
      if (mode.busy) document.addEventListener('DOMContentLoaded', () => { const t = Date.now(); while (Date.now() - t < mode.busy); });
      const snap = () => { const p = document.getElementById('xwPill'); W.seen.push(p && !p.hidden ? p.className : 'none'); };
      document.addEventListener('DOMContentLoaded', () => { new MutationObserver(snap).observe(document.body, { subtree: true, childList: true, attributes: true }); snap(); });
    }, [ADDR, mode]);
    await pg.goto('http://localhost:8099/zz-wfd.html'); return pg;
  }
  const red = s => s.includes('off');
  let pg = await page({ delay: 3000 }); await pg.waitForTimeout(1500);
  ok('slow answer (3 s): no red pill while checking', !red(await pg.evaluate(() => __W.seen)), JSON.stringify(await pg.evaluate(() => __W.seen)));
  await pg.waitForTimeout(2500); ok('slow answer: then connected', await pg.evaluate(() => V2Wallet.status()) === 'on'); ok('slow answer: never red', !red(await pg.evaluate(() => __W.seen)));
  pg = await page({ fails: 2 }); await pg.waitForTimeout(7000);
  ok('2 failed xcp_accounts: retried, connected, never red', await pg.evaluate(() => V2Wallet.status()) === 'on' && !red(await pg.evaluate(() => __W.seen)), JSON.stringify(await pg.evaluate(() => [__W.calls, __W.seen])));
  pg = await page({ busy: 5000, delay: 500 }); await pg.waitForTimeout(7000);
  ok('5 s busy main thread at load: connected, never red', await pg.evaluate(() => V2Wallet.status()) === 'on' && !red(await pg.evaluate(() => __W.seen)), JSON.stringify(await pg.evaluate(() => __W.seen)));
  pg = await page({}); await pg.evaluate(() => { __W.acc = []; }); await pg.reload(); await pg.waitForTimeout(800);
  ok('auto-locked wallet ([]): pill says locked with Unlock, not disconnected', await pg.evaluate(() => { const p = document.getElementById('xwPill'); return p && p.className === 'locked' && /Wallet locked.*Unlock/.test(p.textContent); }), await pg.evaluate(() => V2Wallet.status()));
  pg = await page({}); await pg.waitForTimeout(800); await pg.evaluate(() => __W.fire('disconnect')); await pg.waitForTimeout(500);
  ok('disconnect event but xcp_accounts still answers: stays connected', await pg.evaluate(() => V2Wallet.status()) === 'on' && !red(await pg.evaluate(() => __W.seen)));
  pg = await page({ fails: 99, hidden: true }); await pg.waitForTimeout(3000);
  ok('hidden tab + failing check: no retries, no red', await pg.evaluate(() => V2Wallet.status()) === 'checking' && !red(await pg.evaluate(() => __W.seen)), await pg.evaluate(() => V2Wallet.status() + ' ' + __W.calls.join(',')));
  await pg.evaluate(() => { __W.fails = 0; __W.vis = 'visible'; document.dispatchEvent(new Event('visibilitychange')); }); await pg.waitForTimeout(1000);
  ok('tab visible again: re-checks and connects', await pg.evaluate(() => V2Wallet.status()) === 'on');
  pg = await page({ fails: 99 }); await pg.waitForTimeout(8000);
  ok('still failing after 8 s: retrying, not red yet', !red(await pg.evaluate(() => __W.seen)), JSON.stringify(await pg.evaluate(() => __W.calls)));
  await pg.waitForTimeout(9500);
  ok('really unreachable (4 tries over ~16 s): red Reconnect', await pg.evaluate(() => { const p = document.getElementById('xwPill'); return p && p.className === 'off' && /Reconnect/.test(p.textContent); }));
  await b.close(); res.forEach(l => console.log(l)); const f = res.filter(l => l.startsWith('FAIL')).length;
  console.log('wallet-false-disconnect-test: ' + (res.length - f) + ' pass, ' + f + ' fail'); process.exit(f ? 1 : 0);
})();
