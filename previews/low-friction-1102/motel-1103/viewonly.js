// motel-1103: the public preview link is view-only (no wallet connected). Before this fix the dock's default ✅ Can breed filter hid every pet there ("0 of 1,674").
// usage: node viewonly.js <cloneRoot>   (VIEWONLY is forced on; nothing is signed)
process.env.VIEWONLY = '1';
const { chromium } = require('/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core');
const { open, shot, OUT } = require('./shoot.js'); const path = require('path'), fs = require('fs'); const log = [];
(async () => { const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  for (const W of [1280, 390]) { const { ctx, pg } = await open(b, W);
    const d = await pg.evaluate(() => ({ viewOnly: V2View.viewOnly(), count: document.getElementById('lfN').textContent, tiles: document.querySelectorAll('#lfStrip [data-lf]').length, greyed: document.querySelectorAll('#lfStrip .lf-p.no').length, title: (document.querySelector('#lfStrip .lf-p') || {}).title }));
    const f = path.join(OUT, 'after-motel-viewonly-' + W + '.png'); await shot(pg, f);
    const ok = d.viewOnly && d.tiles > 0; const line = W + ' ' + (ok ? 'OK' : 'FAIL') + ' ' + JSON.stringify(d) + ' errors ' + pg.errs.length + ' ' + f; console.log(line); log.push(line); await ctx.close(); }
  fs.writeFileSync(path.join(OUT, 'viewonly.log'), log.join('\n') + '\n'); await b.close(); })();
