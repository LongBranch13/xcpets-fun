// motel-1103: open the commit-pinned githack preview (branch URLs are cached by githack for a while) and confirm the new dock is what loads.
const { chromium } = require('/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core');
const SHA = process.argv[2]; const base = 'https://raw.githack.com/LongBranch13/xcpets-fun/' + SHA + '/'; const A = '?addr=bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n';
(async () => { const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  for (const w of [1280, 390]) { const ctx = await b.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 500, hasTouch: w < 500 }); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message.slice(0, 120)));
    const r = await pg.goto(base + 'breed.html' + A, { waitUntil: 'load', timeout: 120000 });
    if (/External Content Notice/.test(await pg.title())) { await Promise.all([pg.waitForNavigation({ waitUntil: 'load', timeout: 120000 }), pg.click('text=Open the page')]); }
    await pg.waitForFunction(() => window.V2UI && V2UI.world && V2UI.world() && (V2UI.world().pets || []).length > 100 && document.getElementById('lfStrip') && document.querySelectorAll('#lfStrip [data-lf]').length, null, { timeout: 240000 }).catch(() => errs.push('dock not ready in 240 s'));
    const d = await pg.evaluate(() => ({ boxes: document.querySelectorAll('#lfDock .lf-t').length, sortChips: document.querySelectorAll('#lfDock [data-srt]').length, stageChips: document.querySelectorAll('#lfDock [data-stg]').length, species: !!document.getElementById('lfSp'), pill: !!document.getElementById('lfDrop'), count: (document.getElementById('lfN') || {}).textContent, tiles: document.querySelectorAll('#lfStrip [data-lf]').length }));
    await pg.evaluate(() => document.getElementById('motelScene').scrollIntoView({ block: 'start', behavior: 'instant' })); await pg.waitForTimeout(1500);
    const shot = __dirname + '/linkcheck-breed-' + w + '.png'; await pg.screenshot({ path: shot });
    console.log(w, 'status', r.status(), JSON.stringify(d), 'pageErrors', errs.length, errs.join(' | '), shot); await ctx.close(); }
  await b.close(); })();
