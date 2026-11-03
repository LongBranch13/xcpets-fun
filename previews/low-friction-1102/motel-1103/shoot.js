// motel-1103 (owner pt2722u): before/after shots of Gooby's scene + pet dock on the breed page. Files are served from <cloneRoot> by page.route (no server, no port).
// usage: node shoot.js <cloneRoot> <before|after>   (wallet treated as connected via V2View.viewOnly stub; nothing is ever signed)
const { chromium } = require('/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core');
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(process.argv[2]), TAG = process.argv[3] || 'after', OUT = __dirname, ADDR = 'bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n', ORIGIN = 'http://localhost:8099';
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.webp': 'image/webp', '.woff2': 'font/woff2' };
async function open(b, W) {
  const ctx = await b.newContext({ viewport: { width: W, height: W > 500 ? 900 : 844 }, isMobile: W < 500, hasTouch: W < 500, deviceScaleFactor: 1 });
  await ctx.addInitScript((vo) => { window.open = () => null; try { localStorage.setItem('xcpets-hint-motel', '1'); localStorage.setItem('xcpets-tour-seen', '1'); } catch (e) { }
    let _ca; Object.defineProperty(window, 'V2CemAnim', { configurable: true, get() { return _ca; }, set(v) { if (v && v.watch) v.watch = function () { }; _ca = v; } });
    let _vw; Object.defineProperty(window, 'V2View', { configurable: true, get() { return _vw; }, set(v) { if (v && !vo) v.viewOnly = () => false; _vw = v; } }); }, !!process.env.VIEWONLY); // VIEWONLY=1: leave the page view-only, like the public preview link
  const pg = await ctx.newPage(); pg.errs = [];
  pg.on('pageerror', e => pg.errs.push(String(e && e.message || e).slice(0, 200))); pg.on('dialog', d => d.dismiss().catch(() => { }));
  await pg.route(u => u.href.startsWith(ORIGIN + '/'), r => { const p = decodeURIComponent(new URL(r.request().url()).pathname); const f = path.join(ROOT, p === '/' ? 'index.html' : p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || !fs.statSync(f).isFile()) return r.fulfill({ status: 404, body: '' }); return r.fulfill({ contentType: TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', body: fs.readFileSync(f) }); });
  await pg.goto(ORIGIN + '/breed.html?addr=' + ADDR, { waitUntil: 'load', timeout: 60000 }); try { await pg.waitForLoadState('networkidle', { timeout: 30000 }); } catch (e) { }
  await pg.waitForFunction(() => window.V2UI && V2UI.world && V2UI.world().pets && V2UI.world().pets.length > 100 && document.getElementById('lfDock') && document.querySelector('#lfStrip [data-lf]'), null, { timeout: 120000 }).catch(() => { });
  await pg.waitForTimeout(2500); await pg.evaluate(() => { const a = document.getElementById('bA'), b = document.getElementById('bB'); a.value = ''; b.value = ''; V2UI.render(); }); await pg.waitForTimeout(900);
  await pg.addStyleTag({ content: '.tut-tip{display:none!important}' });
  await pg.evaluate(() => { [...document.body.querySelectorAll('*')].forEach(e => { const cs = getComputedStyle(e); if (cs.position === 'fixed' && !e.closest('#confirmBox,.lf-ghost,header,nav,.topbar') && e.getBoundingClientRect().top > 120) e.setAttribute('data-shot-hide', '1'); }); });
  await pg.addStyleTag({ content: '[data-shot-hide]{visibility:hidden!important}.ca-ov{display:none!important}' }); // cemetery event overlays (live chain events) would cover the page
  return { ctx, pg };
}
async function shot(pg, f) { const y0 = await pg.evaluate(() => scrollY); /* tile sprites draw once their canvas is on screen: bring the dock in view first */ await pg.evaluate(() => { const d = document.getElementById('lfDock') || document.querySelector('#breedPanel .lf-strip'); if (d) d.scrollIntoView({ block: 'end', behavior: 'instant' }); }); await pg.waitForTimeout(1500); await pg.evaluate(y => window.scrollTo(0, y), y0); await pg.waitForTimeout(200); const r = await pg.evaluate(() => { const s = document.getElementById('motelScene'), d = document.getElementById('lfDock'), a = s.getBoundingClientRect(), z = (d || s).getBoundingClientRect(); return { y: a.top + scrollY - 6, h: z.bottom - a.top + 12 }; });
  await pg.screenshot({ path: f, fullPage: true, clip: { x: 0, y: Math.max(0, r.y), width: pg.viewportSize().width, height: Math.min(r.h, 2400) } }); }
module.exports = { open, shot, ROOT, OUT, ADDR };
if (require.main === module) (async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  for (const W of [1280, 390]) { const { ctx, pg } = await open(b, W);
    const f = path.join(OUT, TAG + '-motel-' + W + '.png'); await shot(pg, f);
    const info = await pg.evaluate(() => { const w = V2UI.world(), ids = [...document.querySelectorAll('#lfStrip [data-lf]')].map(b => +b.dataset.lf).slice(0, 12); return { shown: ids.map(id => { const p = w.byId[id]; return '#' + id + (p.hungry ? ' hungry' : '') + (p.neglected ? ' neglected' : '') + ' st' + p.stage; }) }; });
    console.log(W, f, JSON.stringify(info), 'errors', pg.errs.length, pg.errs.slice(0, 3)); await ctx.close(); }
  await b.close(); })();
