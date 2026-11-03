/* shop-dedupe-1103 screenshots: node shots.js <label> <base|local:REPO> [hash] ; writes <label>-<w>.png + <label>.json */
'use strict';
const cp = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const [label, src, hash = ''] = process.argv.slice(2), OUT = __dirname;
const pw = require('/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core');
const portOpen = hp => { const [h, p] = hp.split(':'); return cp.spawnSync('bash', ['-c', `exec 3<>/dev/tcp/${h}/${p}`], { timeout: 3000 }).status === 0; };
function proxy() { const hp = '127.0.0.1:18080'; if (portOpen(hp)) return 'socks5://' + hp;
  const key = path.join(os.homedir(), '.ssh', 'xcpets_hetzner'); if (!fs.existsSync(key)) return null;
  cp.spawnSync('ssh', ['-i', key, '-o', 'BatchMode=yes', '-o', 'ExitOnForwardFailure=yes', '-o', 'ConnectTimeout=15', '-o', 'ServerAliveInterval=30', '-f', '-N', '-D', hp, 'xcadmin@2.31.126.156'], { timeout: 30000 });
  for (let i = 0; i < 20 && !portOpen(hp); i++) cp.spawnSync('sleep', ['0.25']); return portOpen(hp) ? 'socks5://' + hp : null; }
(async () => {
  const local = src.startsWith('local:'), base = local ? 'http://localhost:8099' : src.replace(/\/$/, '');
  const px = proxy(); const b = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'], proxy: px ? { server: px, bypass: 'xcpets.fun,localhost,raw.githack.com,fonts.googleapis.com,fonts.gstatic.com' } : undefined });
  const res = { label, src, hash, proxy: px, widths: {} };
  for (const w of [1280, 390]) {
    const ctx = await b.newContext({ viewport: { width: w, height: w < 500 ? 844 : 900 }, isMobile: w < 500, hasTouch: w < 500, deviceScaleFactor: 1 }), pg = await ctx.newPage(), errs = [];
    pg.on('pageerror', e => errs.push(String(e && e.message || e).slice(0, 200)));
    if (local) await require(path.join(src.slice(6), 'tools/lib/serve-repo.js'))(pg, {}, base);
    await pg.goto(base + '/shop.html' + hash, { waitUntil: 'load', timeout: 90000 });
    const ready = await pg.waitForFunction(() => window.V2Sales && V2Sales.scene && V2Sales.scene.ready, null, { timeout: 150000, polling: 500 }).then(() => true, () => false);
    await pg.waitForTimeout(2500);
    const info = await pg.evaluate(() => ({ build: (document.querySelector('script[src*="?v="]') || {}).src, top: [...document.querySelectorAll('#townBar .tb-st a')].map(a => ({ t: a.textContent.trim(), href: a.getAttribute('href'), cur: a.getAttribute('aria-current') })),
      lower: [...document.querySelectorAll('.sh-tabs [data-tab]')].map(x => x.textContent.trim()), binder: [...document.querySelectorAll('#shop .sh-bar .sh-hint')].map(x => x.textContent.trim()),
      filt: (document.querySelector('#shBinF summary') || {}).textContent || null, hash: location.hash, sideways: document.documentElement.scrollWidth > innerWidth }));
    const f = path.join(OUT, `${label}-${w}.png`); await pg.screenshot({ path: f, fullPage: true });
    const clicks = [];
    if (process.env.CLICKS && ready) { await pg.evaluate(() => { window.__noReload = 1; });
      for (const k of ['sell', 'trade', 'gift', 'buy', 'press']) { await pg.click(`#townBar .tb-st a[href="shop.html#${k}"]`); await pg.waitForTimeout(1200);
        clicks.push(await pg.evaluate(k => ({ k, sameDoc: window.__noReload === 1, hash: location.hash, cur: [...document.querySelectorAll('#townBar .tb-st a[aria-current]')].map(a => a.getAttribute('href')),
          view: document.getElementById('shSell') ? 'sell-bar' : document.getElementById('shBinF') ? 'binder' : document.getElementById('shSwapGo') || /trade/i.test((document.querySelector('#shop h3,#shop h2') || {}).textContent || '') ? 'trade' : (document.getElementById('shGiftMany') ? 'gift' : (document.querySelector('#shop') || {}).textContent.slice(0, 60)),
          modal: ((document.querySelector('.sh-modal h3, [role=dialog] h3') || {}).textContent || null), lower: document.querySelectorAll('.sh-tabs').length }), k));
        if (k === 'sell') await pg.screenshot({ path: path.join(OUT, `${label}-sell-${w}.png`), fullPage: false });
        if (k === 'press') await pg.keyboard.press('Escape'); } }
    res.widths[w] = { ready, errs, shot: f, ...info, clicks }; await ctx.close();
  }
  await b.close(); fs.writeFileSync(path.join(OUT, label + '.json'), JSON.stringify(res, null, 1)); console.log(JSON.stringify(res, null, 1));
})().catch(e => { console.error(e); process.exit(2); });
