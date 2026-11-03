// usage: node shoot.js <cloneRoot> <before|after> [pages...]
const { chromium } = require('/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core');
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(process.argv[2]), TAG = process.argv[3] || 'before';
const OUT = __dirname, ADDR = 'bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n', ORIGIN = 'http://localhost:8099';
const PAGES = process.argv.slice(4).length ? process.argv.slice(4) : ['play', 'breed', 'rare-room', 'cemetery', 'pet', 'tokens', 'shop', 'fight'];
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.webp': 'image/webp', '.woff2': 'font/woff2' };
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const inv = {};
  for (const W of [1280, 390]) {
    const ctx = await b.newContext({ viewport: { width: W, height: W > 500 ? 900 : 844 }, isMobile: W < 500, hasTouch: W < 500, deviceScaleFactor: 1 });
    await ctx.addInitScript(() => { let _ca; Object.defineProperty(window, 'V2CemAnim', { configurable: true, get() { return _ca; }, set(v) { if (v && v.watch) v.watch = function () { }; _ca = v; } }); }); // mute main's cemetery auto-replay overlay on both trees so the shots show the page
    const pg = await ctx.newPage(); const errs = [];
    pg.on('pageerror', e => errs.push(String(e && e.message || e)));
    await pg.route(u => u.href.startsWith(ORIGIN + '/'), r => {
      const p = decodeURIComponent(new URL(r.request().url()).pathname); const f = path.join(ROOT, p === '/' ? 'index.html' : p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || !fs.statSync(f).isFile()) return r.fulfill({ status: 404, body: '' });
      return r.fulfill({ contentType: TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', body: fs.readFileSync(f) });
    });
    for (const P of PAGES) {
      const url = ORIGIN + '/' + P + '.html?addr=' + ADDR + (P === 'pet' ? '&id=100' : '');
      try { await pg.goto(url, { waitUntil: 'load', timeout: 60000 }); } catch (e) { errs.push('goto ' + e.message); }
      try { await pg.waitForLoadState('networkidle', { timeout: 45000 }); } catch (e) {}
      await pg.waitForTimeout(4000);
      await pg.screenshot({ path: path.join(OUT, TAG + '-' + P + '-' + W + '.png'), fullPage: false });
      const d = await pg.evaluate(() => [...document.querySelectorAll('select, xc-select')].map(s => ({ tag: s.tagName.toLowerCase(), id: s.id, cls: s.className, data: [...s.attributes].filter(a => a.name.startsWith('data-') || a.name === 'aria-label').map(a => a.name + '=' + a.value).join(' '), vis: !!(s.offsetWidth || s.offsetHeight || (s.getClientRects && s.getClientRects().length)), n: s.options ? s.options.length : 0, opts: s.options ? [...s.options].slice(0, 40).map(o => o.value + '=' + o.textContent.trim()) : [] })));
      inv[P + '@' + W] = { selects: d, selectCount: await pg.evaluate(() => document.querySelectorAll('select').length), errors: errs.splice(0) };
      console.log(TAG, P, W, 'select:', inv[P + '@' + W].selectCount, 'pickers:', d.length, 'errors:', inv[P + '@' + W].errors.length);
    }
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, TAG + '-runtime-inventory.json'), JSON.stringify(inv, null, 1));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
