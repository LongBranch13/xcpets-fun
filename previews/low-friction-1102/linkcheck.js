const { chromium } = require('/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core');
(async () => { const b0 = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] }); const b = await b0.newContext();
  const base = 'https://raw.githack.com/LongBranch13/xcpets-fun/low-friction-1102/'; const A = '?addr=bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n';
  for (const [p, w] of [['index.html', 1280], ['play.html' + A, 390], ['breed.html' + A, 1280]]) {
    const pg = await b.newPage(); await pg.setViewportSize({ width: w, height: 900 }); const errs = []; pg.on('pageerror', e => errs.push(e.message.slice(0, 120)));
    let st = 0; try { const r = await pg.goto(base + p, { waitUntil: 'load', timeout: 90000 }); st = r.status(); if (/External Content Notice/.test(await pg.title())) { console.log('  githack notice page -> clicking Open the page'); await Promise.all([pg.waitForNavigation({ waitUntil: 'load', timeout: 90000 }), pg.getByText('Open the page').click()]); } } catch (e) { errs.push('goto ' + e.message.slice(0, 80)); }
    const info = await pg.waitForFunction(() => document.querySelectorAll('xc-select').length > 0 || /index/.test(location.pathname), null, { timeout: 90000 }).then(() => true).catch(() => false);
    const t0 = Date.now(); if (!/index/.test(p)) await pg.waitForFunction(() => window.V2UI && V2UI.world && V2UI.world() && (V2UI.world().pets || []).length > 100 && document.getElementById('lfDock'), null, { timeout: 180000 }).catch(() => errs.push('world not loaded in 180 s')); console.log('  waited', Math.round((Date.now() - t0) / 1000), 's'); await pg.waitForTimeout(4000);
    const d = await pg.evaluate(() => ({ title: document.title, xc: document.querySelectorAll('xc-select').length, sel: document.querySelectorAll('select').length, dock: !!document.getElementById('lfDock'), pets: (window.V2UI && V2UI.world && V2UI.world() && V2UI.world().pets || []).length, lf: !!window.V2LowFriction })).catch(e => ({ err: e.message }));
    const shot = 'linkcheck-' + p.split('.')[0] + '-' + w + '.png'; await pg.screenshot({ path: shot });
    console.log(p.split('?')[0], w, 'status', st, JSON.stringify(d), 'pageErrors', errs.length, errs.join(' | '), shot); await pg.close(); }
  await b0.close(); })();
