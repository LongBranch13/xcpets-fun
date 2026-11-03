#!/usr/bin/env node
/* site-speed-1103: page-speed measurement (tooling only). Loads each page cold (empty cache + storage) then warm (same browser profile,
 * second visit) at 1280 (no throttling) and 390 phone (Lighthouse "Slow 4G": 150 ms RTT, 1.6 Mbps down, 750 kbps up, CPU 4x slower).
 * Records: first paint (FCP), largest paint (LCP), "shown" (the #v2boot line is gone = pets drawn, from a saved copy or a rebuild),
 * "usable" (V2Mock.state().verified: the chain read that burns wait for), "fresh" (verified and the fresh world painted), long-task
 * blocking time, and every download (url, bytes on the wire, ms, render-blocking or not, cache).
 * Chain reads go through the bot-1 SOCKS tunnel (box egress blocks :4000) like tools/live-smoke.js; the site itself is fetched directly.
 *   node tools/page-speed.js --base https://xcpets.fun --out file.json [--pages home,play] [--modes desk,phone] [--max 150] [--passes cold,warm,back] [--dwell 20]
 * warm = a NEW tab in the same profile (no sessionStorage); deploy = like warm but first re-stamps every ?v= on a local tools/pages-server.js (a UI-only deploy); back = the same tab goes to another page (pet.html, or home for pet), stays --dwell s, then
 * opens the measured page again (the 'switch back to My Pets' trip; sessionStorage and memory of that tab kept).
 * One browser at a time; each page gets its own context which is closed after the warm load. */
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const A = process.argv.slice(2), arg = (k, d) => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : d; };
const BASE = arg('--base', 'https://xcpets.fun').replace(/\/$/, ''), OUT = arg('--out', '/tmp/page-speed.json'), MAXS = +arg('--max', 150), DWELL = +arg('--dwell', 20), PASSES = arg('--passes', 'cold,warm').split(',');
const ADDR = 'bc1ps9av86ymmlzy9zj3a8pn6g94pz4j5e0kagv3td3wutaagfjvekjs26m3s4';
const ALL = { home: '/', play: '/play.html', pet: '/pet.html?id=53884', mypets: '/play.html?addr=' + ADDR + '#petsPanel', shop: '/shop.html', cemetery: '/cemetery.html' };
const PAGES = arg('--pages', Object.keys(ALL).join(',')).split(','), MODES = arg('--modes', 'desk,phone').split(',');
const chromium = (() => { for (const p of ['/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core', 'playwright-core']) { try { return require(p).chromium; } catch (e) {} } throw new Error('no playwright-core'); })();
const portOpen = hp => { const [h, p] = hp.split(':'); return cp.spawnSync('bash', ['-c', `exec 3<>/dev/tcp/${h}/${p}`], { timeout: 3000 }).status === 0; };
const tmo = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]); /* a frozen page never answers evaluate */
function probe() {
  window.__ps = { t: {}, lt: 0, ltN: 0, lcp: 0 };
  const P = window.__ps, now = () => Math.round(performance.now());
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) { P.lt += Math.max(0, e.duration - 50); P.ltN++; } }).observe({ type: 'longtask', buffered: true }); } catch (e) {}
  try { new PerformanceObserver(l => { const e = l.getEntries(); if (e.length) P.lcp = Math.round(e[e.length - 1].startTime); }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch (e) {}
  const iv = setInterval(() => { const t = P.t;
    if (!t.dcl && document.readyState !== 'loading') t.dcl = now();
    if (!t.shown && document.readyState !== 'loading' && !document.getElementById('v2boot')) t.shown = now();
    const M = window.V2Mock; let S = null; try { S = M && M.state && M.state(); } catch (e) {}
    if (S && !t.verified && S.verified === true) t.verified = now();
    if (S && t.verified && !t.fresh && !S.provisional && !document.getElementById('v2upd')) t.fresh = now();
    if (!t.load && document.readyState === 'complete') t.load = now();
    const pb = document.getElementById('pets'); if (pb && pb.querySelector('.pet')) { if (!t.pets) t.pets = now(); if (!t.petsReal && !pb.inert) t.petsReal = now(); } /* My Pets: any card on screen (saved snapshot or real), real cards */
  }, 50);
}
async function run1(ctx, url, phone, label, SHOT, pre) {
  const pg = await ctx.newPage(), cdp = await ctx.newCDPSession(pg), reqs = new Map(), errs = [];
  if (phone) { await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 }); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
  if (label.endsWith(' deploy')) { await cdp.send('Network.enable'); await cdp.send('Network.clearBrowserCache'); } /* the new HTML (GitHub Pages max-age=600 would else keep the old ?v= for up to 10 min); IndexedDB and storage stay */
  await pg.addInitScript(probe);
  /* back pass: same tab (sessionStorage kept), open `pre` first, stay DWELL s, then navigate to the page being measured, like a player going back to it */
  /* pre = [the measured page itself (waited until fresh, so its real list was drawn), then the other page]: a real round trip in one tab */
  if (pre) { for (const [k, u] of pre.entries()) { try { await pg.goto(BASE + u, { waitUntil: 'domcontentloaded', timeout: MAXS * 1000 }); const dl = Date.now() + MAXS * 1000;
    while (Date.now() < dl) { const t = await tmo(pg.evaluate(() => window.__ps && window.__ps.t).catch(() => null), 10000); if (t && t.shown && t.load && (k === pre.length - 1 || t.fresh)) break; await pg.waitForTimeout(300); } } catch (e) { errs.push('pre: ' + e.message.slice(0, 120)); } }
    await pg.waitForTimeout(DWELL * 1000); }
  pg.on('pageerror', e => errs.push(String(e && e.message || e).slice(0, 200)));
  const t0 = Date.now();
  pg.on('request', r => reqs.set(r, { url: r.url(), type: r.resourceType(), start: Date.now() - t0 }));
  pg.on('requestfinished', async r => { const o = reqs.get(r); if (!o) return; o.end = Date.now() - t0; try { const s = await r.sizes(); o.bytes = s.responseBodySize + s.responseHeadersSize; o.body = s.responseBodySize; } catch (e) {}
    try { const resp = await r.response(); if (resp) { o.status = resp.status(); const h = resp.headers(); o.enc = h['content-encoding'] || ''; o.cc = h['cache-control'] || ''; o.fromCache = resp.fromServiceWorker() ? 'sw' : (o.bytes === 0 ? 'cache' : ''); } } catch (e) {} });
  pg.on('requestfailed', r => { const o = reqs.get(r); if (o) { o.end = Date.now() - t0; o.failed = (r.failure() || {}).errorText; } });
  try { await pg.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: MAXS * 1000 }); } catch (e) { errs.push('goto: ' + e.message.slice(0, 120)); }
  const deadline = Date.now() + MAXS * 1000;
  while (Date.now() < deadline) { const t = await tmo(pg.evaluate(() => window.__ps && window.__ps.t).catch(() => null), 10000); if (!t) errs.push('page did not answer for 10 s at ' + (Date.now() - t0) + ' ms'); if (t && t.shown && t.load && (t.fresh || (!/play|pet|shop|cemetery/.test(url) && Date.now() - t0 > 20000))) break; await pg.waitForTimeout(500); }
  await pg.waitForTimeout(2000);
  if (SHOT) await tmo(pg.screenshot({ path: SHOT, timeout: 20000 }).catch(() => {}), 25000);
  const res = (await tmo(pg.evaluate(() => { const P = window.__ps || {}; const fcp = (performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime;
    const rb = performance.getEntriesByType('resource').filter(e => e.renderBlockingStatus === 'blocking').map(e => e.name);
    let S = null; try { S = window.V2Mock && V2Mock.state(); } catch (e) {} return { fromCache: S ? S.fromCache : null, workerMs: S ? S.workerMs : null, fcp: Math.round(fcp || 0), lcp: P.lcp, t: P.t, blockMs: Math.round(P.lt), longTasks: P.ltN, renderBlocking: rb }; }).catch(e => ({ err: e.message })), 20000)) || { err: 'page frozen (no answer in 20 s)', t: {} };
  const list = [...reqs.values()].map(o => ({ ...o, url: o.url.replace(BASE, '').slice(0, 160) }));
  const sum = (f) => list.filter(f).reduce((a, o) => a + (o.bytes || 0), 0);
  res.label = label; res.url = url; res.errs = errs; res.requests = list.length; res.bytes = sum(() => true); res.chainReqs = list.filter(o => /:4000|xcp\.fun\/api|mempool|blockstream/.test(o.url)).length;
  res.big = list.filter(o => (o.bytes || 0) > 100e3).sort((a, b) => b.bytes - a.bytes).map(o => ({ url: o.url, kb: Math.round(o.bytes / 1024), ms: (o.end || 0) - o.start, enc: o.enc }));
  res.all = list;
  await tmo(pg.close().catch(() => {}), 10000); return res;
}
(async () => {
  const hp = '127.0.0.1:18080', px = portOpen(hp) ? { server: 'socks5://' + hp, bypass: 'xcpets.fun,127.0.0.1,localhost,fonts.googleapis.com,fonts.gstatic.com' } : undefined;
  if (!px) console.error('WARNING: no SOCKS tunnel, chain reads (:4000) will fail from the box');
  const out = []; const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'], proxy: px });
  for (const mode of MODES) for (const name of PAGES) {
    const phone = mode === 'phone', w = phone ? 390 : 1280;
    const ctx = await b.newContext({ viewport: { width: w, height: phone ? 844 : 900 }, isMobile: phone, hasTouch: phone, deviceScaleFactor: phone ? 2 : 1 });
    for (const pass of PASSES) {
      if (pass === 'deploy' && process.env.PS_BEFORE_DEPLOY) cp.execSync(process.env.PS_BEFORE_DEPLOY, { stdio: 'inherit' }); /* test hook, e.g. change a rule file */
      if (pass === 'deploy') { const id = Date.now().toString(16); process.stderr.write('(local UI-only deploy: ?v=' + id + ') '); await fetch(BASE + '/__stamp/' + id).then(r => r.text()).catch(e => { console.error('no /__stamp (local pages-server only)'); }); }
      const label = name + ' ' + mode + ' ' + pass; process.stderr.write(label + ' … ');
      const r = await run1(ctx, ALL[name], phone, label, pass === 'cold' ? OUT.replace(/\.json$/, '') + '-' + name + '-' + mode + '.png' : null, pass === 'back' ? [ALL[name], name === 'pet' ? ALL.home : ALL.pet] : null); r.page = name; r.mode = mode; r.pass = pass; out.push(r);
      process.stderr.write(`fcp ${r.fcp} shown ${r.t && r.t.shown} usable ${r.t && r.t.verified} fresh ${r.t && r.t.fresh} pets ${r.t && r.t.pets} petsReal ${r.t && r.t.petsReal} fromCache ${r.fromCache} workerMs ${r.workerMs} ${Math.round(r.bytes / 1024)} KB ${r.requests} req\n`);
      fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
    }
    await ctx.close();
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(2); });
