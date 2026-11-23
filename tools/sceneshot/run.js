/* Scene shots (Nov 22 2026, living-scenes work): phone-size screenshots of each place page on REAL data, for design review.
 * View-only (localStorage 'xcpets-v2-me'; no wallet, nothing signed). Each page is shot twice: as a brand-new visitor (no wallet, coach on)
 * and as a view-only player. With --branch, this checkout's pages and scripts are served in place of xcpets.fun's (the live feed api/ and
 * node.xcpets.fun stay live), the same way tools/loadprobe does it. Writes PNGs to --out (default previews/scenes).
 *   node tools/sceneshot/run.js [--branch] [--pages fight.html,breed.html] [--wallet <addr>] [--out dir] */
'use strict';
const fs = require('fs'), path = require('path');
const A = process.argv.slice(2), opt = (k, d) => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : d; };
const SITE = 'https://xcpets.fun', BRANCH = A.includes('--branch'), ROOT = path.resolve(__dirname, '../..');
const OUT = path.resolve(ROOT, opt('--out', 'previews/scenes'));
const WALLET = opt('--wallet', '1JwWsArppwALMEdXWPmpDBcP1jwWsAPYkD');
const PAGES = opt('--pages', 'fight.html,breed.html,raid.html,rare-room.html,cemetery.html,shop.html').split(',').map(s => s.trim()).filter(Boolean);
const TYPES = { html: 'text/html', js: 'application/javascript', css: 'text/css', json: 'application/json', png: 'image/png', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp', woff2: 'font/woff2', ico: 'image/x-icon' };
async function serveBranch(cx) {
  await cx.route(u => { try { const x = new URL(u); return (x.hostname === 'xcpets.fun' || x.hostname === 'www.xcpets.fun') && !x.pathname.startsWith('/api/'); } catch (e) { return false; } }, r => {
    let f = decodeURIComponent(new URL(r.request().url()).pathname); if (f.endsWith('/')) f += 'index.html';
    const fp = path.join(ROOT, path.normalize(f)); if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) return r.continue();
    return r.fulfill({ status: 200, contentType: TYPES[fp.split('.').pop()] || 'application/octet-stream', body: fs.readFileSync(fp) }); });
}
async function shot(browser, page, who) {
  const cx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  if (BRANCH) await serveBranch(cx);
  if (who !== 'new') await cx.addInitScript(a => { try { localStorage.setItem('xcpets-v2-me', a); localStorage.setItem('xcpets-tut-coach-skip', '1'); localStorage.setItem('xcpets-tut-seen', '1'); } catch (e) {} }, who);
  const PROF = A.includes('--profile');
  /* --profile (Nov 23 2026, Rankings freeze): records main-thread stalls over 250 ms (with the page status at the time) and a CPU profile */
  if (PROF) await cx.addInitScript(() => { window.__lag = []; let last = performance.now(); setInterval(() => { const n = performance.now(), g = n - last - 100; last = n;
    if (g > 250 && window.__lag.length < 60) window.__lag.push(Math.round(n / 100) / 10 + 's:' + Math.round(g) + 'ms:' + ((document.getElementById('status') || {}).textContent || '').slice(0, 40)); }, 100); });
  const pg = await cx.newPage(), errs = [], t0 = Date.now();
  let cdp = null; if (PROF) { cdp = await cx.newCDPSession(pg); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 1000 }); await cdp.send('Profiler.start'); }
  pg.on('pageerror', e => errs.push(String(e.message || e).slice(0, 200)));
  pg.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && errs.length < 8 && !/Failed to load resource/.test(m.text())) errs.push(m.type() + ': ' + m.text().slice(0, 160)); });
  const base = page.replace(/\.html/, '').replace(/[^a-z0-9]+/gi, '-') + '-' + (who === 'new' ? 'new' : 'player');
  try {
    await pg.goto(SITE + '/' + page + (page.includes('?') ? '&' : '?') + 'shot=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 });
    await pg.waitForTimeout(2500);
    await pg.screenshot({ path: path.join(OUT, base + '-0early.png') });
    while (Date.now() - t0 < 60000) { await pg.waitForTimeout(1000);
      const ok = await pg.evaluate(() => { try { const w = window.V2Mock && V2Mock.world && V2Mock.world(); return !!(w && w.pets && w.pets.length); } catch (e) { return false; } });
      if (ok) break; }
    await pg.waitForTimeout(5000);
    await pg.screenshot({ path: path.join(OUT, base + '-1top.png') });
    await pg.waitForTimeout(400);
    await pg.screenshot({ path: path.join(OUT, base + '-2top.png') });
    await pg.screenshot({ path: path.join(OUT, base + '-3full.png'), fullPage: true });
    if (process.env.SHOT_PROBE) { try { errs.push('probe: ' + await pg.evaluate(process.env.SHOT_PROBE)); } catch (e) { errs.push('probe failed: ' + String(e.message || e).slice(0, 160)); } }
    if (PROF) {
      errs.push('lag: ' + JSON.stringify(await pg.evaluate(() => window.__lag)));
      const { profile } = await cdp.send('Profiler.stop'), self = {}, byId = {}, dt = profile.timeDeltas || [];
      profile.nodes.forEach(n => { byId[n.id] = n; });
      (profile.samples || []).forEach((id, i) => { const n = byId[id], f = n.callFrame, k = (f.functionName || '(anon)') + ' ' + (f.url || '').split('/').pop().split('?')[0] + ':' + (f.lineNumber + 1); self[k] = (self[k] || 0) + (dt[i] || 0) / 1000; });
      errs.push('cpu: ' + Object.keys(self).filter(k => !/^\(idle\)|^\(program\)/.test(k)).sort((a, b) => self[b] - self[a]).slice(0, 25).map(k => k + '=' + Math.round(self[k]) + 'ms').join(', '));
      const c0 = Date.now(); try { await Promise.all([pg.waitForURL(u => !/ranking|tokens/.test(String(u)), { timeout: 30000 }), pg.evaluate(() => { const a = document.querySelector('a[href="index.html"]'); if (a) a.click(); else location.href = 'index.html'; })]); errs.push('home click: ' + (Date.now() - c0) + 'ms'); } catch (e) { errs.push('home click failed after ' + (Date.now() - c0) + 'ms'); }
    }
  } catch (e) { errs.push('goto: ' + String(e.message || e).slice(0, 200)); }
  await cx.close();
  return { page, who: who === 'new' ? 'new visitor' : 'player', secs: (Date.now() - t0) / 1000, errs };
}
(async () => {
  const { chromium } = require('playwright-core');
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME || (fs.existsSync('/opt/google/chrome/chrome') ? '/opt/google/chrome/chrome' : undefined), args: ['--no-sandbox'] });
  const res = [];
  for (const p of PAGES) for (const who of ['new', WALLET]) { const r = await shot(browser, p, who); console.log(JSON.stringify(r)); res.push(r); }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'README.md'), '# Scene shots (' + (BRANCH ? 'branch' : 'live') + ', ' + new Date().toISOString() + ')\n\n' +
    res.map(r => `- ${r.page} (${r.who}): ${r.secs.toFixed(0)} s${r.errs.length ? ', errors: ' + r.errs.join(' | ') : ''}`).join('\n') + '\n');
})();
