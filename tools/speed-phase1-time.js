/* Headless first-paint timings. Same measures as the Phase 1 baseline script:
 * desktop 1280x800, or phone 412x915 with 4x CPU and slow-4G (150ms, 9 Mbps down).
 * node tools/speed-phase1-time.js <page> <chrome-profile-dir> <desktop|phone> [base] [seconds]
 * PUPPETEER_CORE can point at puppeteer-core. A second run with the same profile is the return visit. */
const puppeteer = require(process.env.PUPPETEER_CORE || 'puppeteer-core');
const [,, page, profile, mode, base = 'http://127.0.0.1:8766', dur = '70'] = process.argv;
(async () => {
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', userDataDir: profile, args: ['--no-sandbox', '--disable-gpu', '--enable-precise-memory-info'] });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => { if (errs.length < 8) errs.push(String(e).slice(0, 180)); });
  const s = await p.target().createCDPSession();
  if (mode === 'phone') {
    await p.setViewport({ width: 412, height: 915, isMobile: true, deviceScaleFactor: 2 });
    await s.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await s.send('Network.enable');
    await s.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 9e6 / 8, uploadThroughput: 1.5e6 / 8 });
  } else await p.setViewport({ width: 1280, height: 800 });
  await p.evaluateOnNewDocument(() => {
    window.__lt = []; window.__m = {};
    try { new PerformanceObserver(l => l.getEntries().forEach(e => __lt.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: 'longtask', buffered: true }); } catch (e) {}
    addEventListener('xcpets-world-fresh', () => { if (!__m.fresh) __m.fresh = Math.round(performance.now()); });
    const chk = () => { if (__m.pet) return; const c = [...document.querySelectorAll('canvas,img')].find(e => { const r = e.getBoundingClientRect(); return r.width >= 32 && r.height >= 32 && r.top < innerHeight && r.bottom > 0 && (e.tagName === 'CANVAS' || /sprite|pet/i.test(e.src || '')) && !e.closest('header,nav,.banner'); }); if (c) __m.pet = Math.round(performance.now()); else requestAnimationFrame(chk); }; requestAnimationFrame(chk);
  });
  let bytes = 0, reqs = 0;
  s.on('Network.loadingFinished', e => { bytes += e.encodedDataLength; reqs++; });
  await s.send('Network.enable');
  const t0 = Date.now();
  const url = base.replace(/\/$/, '') + '/' + page;
  p.goto(url, { timeout: 0 }).catch(() => {});
  let maxGap = 0, last = null;
  while (Date.now() - t0 < dur * 1000) {
    const ts = Date.now();
    const r = await Promise.race([p.evaluate(() => JSON.stringify({ rs: document.readyState, m: __m, fcp: (performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime, lt: __lt, heap: performance.memory.usedJSHeapSize, js: performance.getEntriesByType('resource').filter(e => /\.js/.test(e.name)).length, sw: !!(navigator.serviceWorker && navigator.serviceWorker.controller), marks: performance.getEntriesByType('mark').map(e => e.name + '@' + Math.round(e.startTime)) })).then(JSON.parse).catch(() => null), new Promise(r => setTimeout(() => r('HUNG'), 15000))]);
    const g = Date.now() - ts; if (r && r !== 'HUNG') { maxGap = Math.max(maxGap, g); last = r; } else if (r === 'HUNG') maxGap = Math.max(maxGap, g);
    if (last && last.m.fresh && Date.now() - t0 > (last.m.fresh + 8000)) break;
    await new Promise(r => setTimeout(r, 500));
  }
  const lt = last ? last.lt : [];
  const window30 = lt.filter(x => x[0] < 30000);
  const tti = (() => { let q = 0; for (const [st, d] of lt) if (d > 50) q = st + d; return q; })();
  console.log(JSON.stringify({ page, mode, profile: profile.split('/').pop(), fcp: last && Math.round(last.fcp), firstPet: last && last.m.pet, worldFresh: last && last.m.fresh, tti: tti, lastLongTaskEnd: tti, longTasks: lt.length, longTaskMs: lt.reduce((a, x) => a + x[1], 0), longTasks30: window30.length, longTaskMs30: window30.reduce((a, x) => a + x[1], 0), maxTask: Math.max(0, ...lt.map(x => x[1])), maxProbeGapMs: maxGap, heapMB: last && Math.round(last.heap / 1e6), transferMB: +(bytes / 1e6).toFixed(1), requests: reqs, jsFiles: last && last.js, sw: last && last.sw, marks: last && last.marks, errs }));
  b.process().kill('SIGKILL'); process.exit(0);
})().catch(e => { console.error('TIMEFAIL', e && e.stack || e); process.exit(1); });
