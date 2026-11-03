// low-friction-1102 shots chunk 2: node shoot2.js <cloneRoot> <before|after> [names...]
// names: mypets rare-room nest raid gear home. View-only address, nothing signed. Same harness as shoot.js (local route, cemetery replay muted).
const { chromium } = require('/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core');
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(process.argv[2]), TAG = process.argv[3] || 'before';
const OUT = __dirname, ADDR = 'bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n', ORIGIN = 'http://localhost:8099';
const SPEC = { mypets: ['play', '', '#mptView, #pets'], 'rare-room': ['rare-room', '', null], nest: ['breed', '', '#lfDock, #motelScene'], raid: ['raid', '', null], gear: ['pet', '&id=100', '#gear'], home: ['index', '', null] };
const NAMES = process.argv.slice(4).length ? process.argv.slice(4) : Object.keys(SPEC);
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.webp': 'image/webp', '.woff2': 'font/woff2' };
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  for (const W of [1280, 390]) {
    const ctx = await b.newContext({ viewport: { width: W, height: W > 500 ? 900 : 844 }, isMobile: W < 500, hasTouch: W < 500, deviceScaleFactor: 1 });
    await ctx.addInitScript(() => { window.open = () => null; let _ca; Object.defineProperty(window, 'V2CemAnim', { configurable: true, get() { return _ca; }, set(v) { if (v && v.watch) v.watch = function () { }; _ca = v; } }); });
    const pg = await ctx.newPage(); const errs = [];
    pg.on('pageerror', e => errs.push(String(e && e.message || e).slice(0, 200)));
    pg.on('dialog', d => d.dismiss().catch(() => { }));
    await pg.route(u => u.href.startsWith(ORIGIN + '/'), r => {
      const p = decodeURIComponent(new URL(r.request().url()).pathname); const f = path.join(ROOT, p === '/' ? 'index.html' : p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || !fs.statSync(f).isFile()) return r.fulfill({ status: 404, body: '' });
      return r.fulfill({ contentType: TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', body: fs.readFileSync(f) });
    });
    for (const N of NAMES) {
      const [P, q, sel] = SPEC[N];
      try { await pg.goto(ORIGIN + '/' + P + '.html?addr=' + ADDR + q, { waitUntil: 'load', timeout: 60000 }); } catch (e) { errs.push('goto ' + e.message); }
      try { await pg.waitForLoadState('networkidle', { timeout: 45000 }); } catch (e) { }
      await pg.waitForFunction(() => !window.V2UI || !V2UI.world || (V2UI.world() && V2UI.world().pets && V2UI.world().pets.length > 100), null, { timeout: 90000 }).catch(() => { });
      await pg.waitForTimeout(4000);
      let found = null;
      if (sel) found = await pg.evaluate(s => { for (const x of s.split(',')) { const e = document.querySelector(x.trim()); if (e && e.getClientRects().length) { return x.trim(); } } return null; }, sel);
      await pg.evaluate(() => { for (const b of document.querySelectorAll('button, a')) if (/^\s*(Got it|No thanks|Dismiss)\s*$/.test(b.textContent) && b.getClientRects().length) b.click(); });
      await pg.waitForTimeout(1500);
      let sy = 0;
      for (let i = 0; found && i < 4; i++) { sy = await pg.evaluate(([s, blk]) => { const e = document.querySelector(s); e.scrollIntoView({ block: blk, behavior: 'instant' }); if (blk === 'start') window.scrollBy({ top: -60, behavior: 'instant' }); return scrollY; }, [found, N === 'nest' ? 'center' : 'start']);
        await pg.waitForTimeout(1200); const now = await pg.evaluate(() => scrollY); if (now > 0 && Math.abs(now - sy) < 5) break; }
      await pg.screenshot({ path: path.join(OUT, TAG + '-' + N + '-' + W + '.png'), fullPage: false });
      if (found) console.log('  scrollY', await pg.evaluate(() => scrollY));
      console.log(TAG, N, W, 'scrolled-to:', found, 'selects:', await pg.evaluate(() => document.querySelectorAll('select').length), 'xc-select:', await pg.evaluate(() => document.querySelectorAll('xc-select').length), 'errors:', errs.length, JSON.stringify(errs.splice(0).slice(0, 2)));
    }
    await ctx.close();
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
