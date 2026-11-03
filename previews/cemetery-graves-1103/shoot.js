// usage: node shoot.js <cloneRoot> [looks...]   (one browser; routed local files)
const { chromium } = require('/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core');
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(process.argv[2]), OUT = __dirname, ORIGIN = 'http://localhost:8099';
const ADDR = process.env.ADDR || 'bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n';
const LOOKS = process.argv.slice(3).length ? process.argv.slice(3) : ['0', '1', '2', '3'];
const FERAL = process.env.FERAL; // demo: force .feral on the Nth card (harness only)
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.webp': 'image/webp', '.woff2': 'font/woff2' };
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const report = {};
  for (const W of [1280, 390]) {
    const ctx = await b.newContext({ viewport: { width: W, height: W > 500 ? 900 : 844 }, isMobile: W < 500, hasTouch: W < 500, deviceScaleFactor: 1 });
    await ctx.addInitScript(() => { let _ca; Object.defineProperty(window, 'V2CemAnim', { configurable: true, get() { return _ca; }, set(v) { if (v && v.watch) v.watch = function () { }; _ca = v; } }); });
    const pg = await ctx.newPage(); const errs = [];
    pg.on('pageerror', e => errs.push(String(e && e.message || e)));
    await pg.route(u => u.href.startsWith(ORIGIN + '/'), r => {
      const p = decodeURIComponent(new URL(r.request().url()).pathname); const f = path.join(ROOT, p === '/' ? 'index.html' : p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || !fs.statSync(f).isFile()) return r.fulfill({ status: 404, body: '' });
      return r.fulfill({ contentType: TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', body: fs.readFileSync(f) });
    });
    await pg.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    for (const L of LOOKS) {
      const url = ORIGIN + '/cemetery.html?addr=' + ADDR + (L === 'now' ? '' : '&grave=' + L);
      try { await pg.goto(url, { waitUntil: 'load', timeout: 60000 }); } catch (e) { errs.push('goto ' + e.message); }
      try { await pg.waitForSelector('.ztomb', { timeout: 60000 }); } catch (e) { errs.push('no .ztomb'); }
      await pg.waitForTimeout(3500);
      if (FERAL) await pg.evaluate(n => { const c = document.querySelectorAll('.ztomb')[+n]; if (c) c.classList.add('feral'); }, FERAL);
      await pg.waitForTimeout(800);
      const info = await pg.evaluate(() => { const s = document.querySelector('#cemZombies'); s && s.scrollIntoView(); const cards = [...document.querySelectorAll('.ztomb')];
        return { n: cards.length, bg: document.querySelectorAll('.ztomb > canvas.zgbg').length, hscroll: document.documentElement.scrollWidth > innerWidth,
          tiers: cards.map(c => (c.getAttribute('data-zm') || '-') + (c.classList.contains('feral') ? '*' : '')),
          buttons: cards.map(c => [...c.querySelectorAll('button,a.btn,a[href*="play.html"],xc-select')].filter(x => x.offsetWidth).length),
          covered: cards.flatMap(c => [...c.querySelectorAll('button,a,xc-select')].filter(x => x.offsetWidth).map(x => { const r = x.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e && !(x === e || x.contains(e) || e.contains(x)) && r.top > 0 && r.bottom < innerHeight ? (x.textContent.trim().slice(0, 20) + '->' + (e.className || e.tagName)) : null; }).filter(Boolean)) }; });
      const sec = await pg.$('#cemZombies');
      await pg.waitForTimeout(300);
      const name = 'grave' + L + '-' + W + '.png';
      const bb = sec && await pg.evaluate(() => { scrollTo(0, 0); const r = document.querySelector('#cemZombies').getBoundingClientRect(); return { x: 0, y: Math.max(0, r.top + scrollY), width: document.documentElement.clientWidth, height: Math.min(r.height, 4000) }; });
      await pg.screenshot({ path: path.join(OUT, (FERAL ? 'feral-' : '') + name), fullPage: true, clip: bb || undefined, timeout: 60000, animations: 'disabled' });
      report[L + '@' + W] = Object.assign(info, { errors: errs.splice(0) });
      console.log(L, W, JSON.stringify(report[L + '@' + W]).slice(0, 600));
    }
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, 'report' + (FERAL ? '-feral' : '') + '.json'), JSON.stringify(report, null, 1));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
