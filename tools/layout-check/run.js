/* Layout check (Nov 25 2026, Jake: "I want this game to be perfect on every screen").
 * Opens every page, and the sheets and pop-ups players see most (hatch review with 1,000 eggs, Sign & burn, pet page, Grinder,
 * the "while you were away" card...), at phone, tablet, small laptop and big desktop sizes, in VIEW-ONLY mode on real data, and runs
 * tools/layout-check/audit.js on each: page wider than the screen, a sheet's buttons out of reach, a button covered by something
 * else, cut-off text, a title wrapping into a wall of huge lines, and main-thread freezes. Nothing is ever signed or sent.
 *
 *   node tools/layout-check/rig.js &   (builds the real-data world from api/boot.json and serves this checkout; prints "ready")
 *   node tools/layout-check/run.js --base http://127.0.0.1:8080 [--sync http://127.0.0.1:8125] [--wallet addr] [--sizes phone,desktop]
 *        [--pages play.html,cemetery.html] [--out dir] [--shots]
 *
 * --base is a static server of this checkout (any). --sync points the pages at a sync server (tools/sync-server) for the fast world,
 * else pages build the world from api/boot.json in the browser (slow). Exit 1 when any problem is found (known ones listed in
 * tools/layout-check/allow.txt are reported but do not fail). */
'use strict';
const fs = require('fs'), path = require('path');
const A = process.argv.slice(2), opt = (k, d) => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : d; };
const ROOT = path.resolve(__dirname, '../..');
const BASE = opt('--base', 'http://127.0.0.1:8080').replace(/\/+$/, ''), SYNC = opt('--sync', ''), SHOTS = A.includes('--shots');
const OUT = path.resolve(ROOT, opt('--out', path.join(require('os').tmpdir(), 'xcpets-layout'))); /* never inside the repo by default */
const WALLET = opt('--wallet', 'bc1pfvkpmllr7mtn5uazqxumwp39h2ny3c8l6fmrgvjv2cqn5wlpt7hssf3gqd'); /* Evan, ~2,200 pets */
const AUDIT = fs.readFileSync(path.join(__dirname, 'audit.js'), 'utf8');
const SIZES = { phone: { width: 390, height: 844, mobile: true }, 'small-phone': { width: 360, height: 640, mobile: true }, tablet: { width: 820, height: 1180, mobile: true },
  laptop: { width: 1280, height: 720 }, desktop: { width: 1920, height: 1080 } };
const sizes = opt('--sizes', 'phone,tablet,laptop,desktop').split(',').filter(s => SIZES[s]);
const GAME = /^(play|fight|breed|rare-room|raid|cemetery|shop)\.html/; /* practice pages run on a pretend world */
const ALL = ['index.html', 'play.html', 'play.html#grinder', 'fight.html', 'breed.html', 'rare-room.html', 'raid.html', 'cemetery.html', 'shop.html', 'pantheon.html',
  'ranking.html', 'petdex.html', 'pet.html?id=42', 'pets.html', 'live.html', 'hall-of-fame.html', 'how-it-works.html', 'rules.html', 'rules-short.html', 'tokens.html',
  'petcoin.html', 'hybrids.html', 'archive.html', 'inscriptions.html', 'watch.html', 'verify.html', 'verify-pet.html', 'tutorial.html', 'practice.html', 'tg/', '404.html'];
const pages = opt('--pages', '') ? opt('--pages').split(',') : ALL;
/* scenes: open a sheet the way the game does, audit it, close it. Each returns true when something opened. */
const SCENES = {
  'hatch-review-1000': `(() => { const w = V2Mock.world(), me = localStorage.getItem('xcpets-v2-me'); const mine = w.pets.filter(p => p.owner === me && !p.dead), ids = mine.concat(w.pets.filter(p => p.owner !== me && !p.dead && p.stage >= 1)).slice(0, 1000).map(p => p.id); /* 1,000 eggs: a big Shock Box */
     if (!window.V2RevealPreview || ids.length < 5) return false; V2RevealPreview(ids); return true; })()`,
  /* Nov 26 2026: Jake's 401-piece gear pop-up drew empty outlines (squashed grid rows); audit.js 'card-squashed' catches it here */
  'gear-reveal-400': `(() => { if (!window.V2GearRevealPreview) return false; return V2GearRevealPreview(400) > 0; })()`,
  'burn-sheet-long': `(() => { if (!window.V2UI || !V2UI.confirmPlans) return false; const w = V2Mock.world(), me = localStorage.getItem('xcpets-v2-me');
     const ids = w.pets.filter(p => p.owner === me && !p.dead).slice(0, 40).map(p => p.id); if (!ids.length) return false;
     V2UI.confirmPlans('Discard ' + ids.length + ' pets forever (permanent, on-chain): they leave My Pets and cannot come back', ids.map(id => ({ tag: 'pet:hd:' + id })));
     return true; })()`,
  'pet-page': `(() => { if (!window.V2UI || !V2UI.detail) return false; const w = V2Mock.world(), me = localStorage.getItem('xcpets-v2-me');
     const p = w.pets.filter(p => p.owner === me && !p.dead && p.stage >= 3).sort((a, b) => String(b.name || '').length - String(a.name || '').length)[0]; if (!p) return false; V2UI.detail(p.id); return true; })()`,
};
SCENES.grinder = `(() => { if (!window.V2Grinder) return false; V2Grinder.open(); return true; })()`;
const SCENES_FOR = { 'play.html': ['hatch-review-1000', 'gear-reveal-400', 'burn-sheet-long', 'pet-page', 'grinder'] };
function chromium() { for (const p of [process.env.PW, 'playwright', 'playwright-core']) { if (!p) continue; try { return require(p).chromium; } catch (e) {} } throw new Error('playwright not found'); }
const INIT = (o) => {
  try {
    localStorage.setItem('xcpets-v2-me', o.me); localStorage.setItem('xcpets-xcpwallet-address', o.me);
    ['xcpets-tut-done', 'xcpets-tut-seen', 'xcpets-tut-coach-skip'].forEach(k => localStorage.setItem(k, '1'));
    if (o.sync) localStorage.setItem('xcpets-sync', o.sync);
  } catch (e) {}
  window.__long = [];
  try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__long.push(Math.round(e.duration)))).observe({ entryTypes: ['longtask'] }); } catch (e) {}
};
async function settle(pg, game) {
  if (game) { try { await pg.waitForFunction(() => { try { const w = V2Mock.world(); return w && w.pets && w.pets.length > 20; } catch (e) { return false; } }, null, { timeout: 180000, polling: 1000 }); } catch (e) { return 'world never loaded'; } }
  await pg.waitForTimeout(game ? 6000 : 2500);
  return '';
}
async function audit(pg) { for (let i = 0; ; i++) { try { return await pg.evaluate(AUDIT); } catch (e) { if (i > 2 || !/context was destroyed|null/.test(e.message)) throw e; await pg.waitForLoadState('load').catch(() => {}); await pg.waitForTimeout(2500); } } }
async function responsive(pg) { const t0 = Date.now(); try { await Promise.race([pg.evaluate(() => 1), new Promise((_, j) => setTimeout(() => j(new Error('t')), 8000))]); return Date.now() - t0; } catch (e) { return -1; } }
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  let allow = []; try { allow = fs.readFileSync(path.join(__dirname, 'allow.txt'), 'utf8').split('\n').map(s => s.trim()).filter(s => s && s[0] !== '#'); } catch (e) {}
  const browser = await chromium().launch(Object.assign({ args: ['--no-sandbox', '--disable-dev-shm-usage'] }, process.env.CHROME ? { executablePath: process.env.CHROME } : {}));
  const report = [], keyOf = (r) => [r.page, r.size, r.scene || '', r.kind, r.where].join(' | ');
  for (const sz of sizes) {
    const S = SIZES[sz];
    const cx = await browser.newContext({ viewport: { width: S.width, height: S.height }, deviceScaleFactor: 1, isMobile: !!S.mobile, hasTouch: !!S.mobile });
    await cx.addInitScript(INIT, { me: WALLET, sync: SYNC });
    const origins = [BASE, SYNC].filter(Boolean).map(u => new URL(u).origin);
    await cx.route('**/*', r => { const u = r.request().url(); if (u.startsWith('data:') || origins.some(o => u.startsWith(o))) return r.continue(); return r.abort(); });
    for (const page of pages) {
      const pg = await cx.newPage(), errs = [], t0 = Date.now();
      pg.on('pageerror', e => errs.push(String(e.message || e).slice(0, 160)));
      const tag = (page.replace(/[^a-z0-9]+/gi, '-').replace(/-html/, '').replace(/^-|-$/g, '') || 'home') + '-' + sz;
      const game = GAME.test(page) || /^pet\.html/.test(page);
      let probs = [];
      try {
        await pg.goto(BASE + '/' + page, { waitUntil: 'domcontentloaded', timeout: 90000 });
        const why = await settle(pg, game); if (why) probs.push({ kind: 'freeze-or-no-data', where: page, detail: why });
        probs = probs.concat(await audit(pg));
        if (SHOTS) await pg.screenshot({ path: path.join(OUT, tag + '.png') });
        /* close the "while you were away" / welcome cards so the scenes start clean (they were audited above) */
        await pg.evaluate(() => { document.querySelectorAll('.reveal.on').forEach(e => e.classList.remove('on')); document.querySelectorAll('.ca-ov,.la-ov,.ip-away,.ip-awaywrap').forEach(e => e.remove()); });
        for (const sc of (SCENES_FOR[page] || [])) {
          const opened = await pg.evaluate(SCENES[sc]).catch(e => 'err ' + e.message);
          if (opened !== true) { probs.push({ kind: 'scene-did-not-open', where: sc, detail: String(opened) }); continue; }
          await pg.waitForTimeout(sc === 'hatch-review-1000' ? 9000 : 2500);
          const ms = await responsive(pg); if (ms < 0) probs.push({ kind: 'freeze', where: sc, detail: 'page did not answer for 8 s' });
          (await audit(pg)).forEach(p => probs.push(Object.assign({ scene: sc }, p)));
          if (SHOTS) await pg.screenshot({ path: path.join(OUT, tag + '-' + sc + '.png') });
          await pg.keyboard.press('Escape'); await pg.waitForTimeout(300);
          await pg.evaluate(() => { document.querySelectorAll('.reveal.on').forEach(e => e.classList.remove('on')); document.querySelectorAll('.mgr-bg').forEach(e => e.remove()); });
        }
        const long = await pg.evaluate(() => window.__long || []);
        const worst = Math.max(0, ...long); if (worst > 3000) probs.push({ kind: 'freeze', where: page, detail: 'longest main-thread task ' + worst + ' ms' });
      } catch (e) { probs.push({ kind: 'load-failed', where: page, detail: String(e.message || e).slice(0, 160) }); }
      errs.slice(0, 3).forEach(e => probs.push({ kind: 'script-error', where: page, detail: e }));
      probs.forEach(p => report.push(Object.assign({ page, size: sz }, p)));
      console.log(sz.padEnd(8), page.padEnd(22), ((Date.now() - t0) / 1000).toFixed(0) + 's', probs.length ? probs.length + ' problem(s)' : 'ok');
      await pg.close();
    }
    await cx.close();
  }
  await browser.close();
  const fresh = report.filter(r => !allow.some(a => keyOf(r).includes(a)));
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
  report.forEach(r => console.log((fresh.includes(r) ? 'FAIL ' : 'known ') + keyOf(r) + ' :: ' + r.detail));
  console.log('layout-check: ' + report.length + ' problem(s), ' + fresh.length + ' not on the known list');
  process.exit(fresh.length ? 1 : 0);
})();
