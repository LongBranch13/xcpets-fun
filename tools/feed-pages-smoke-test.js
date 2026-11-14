/* pages-feed smoke: My Pets, pet.html, Rare Room and Ranking still render from the chain replay
 * (api/boot.json, not pets.json) at 1280 and 390, with no page errors. Also loads verify-pet, which does read pets.json.
 * Local static server. Off-site requests are aborted, so nothing is signed or sent. */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = path.join(__dirname, '..');
const ART = process.env.XCPETS_ART || '/opt/cursor/artifacts';
function chromium() {
  const tries = [process.env.PW, '/tmp/pw/node_modules/playwright-core', 'playwright-core', 'playwright'];
  for (const p of tries) { if (!p) continue; try { return require(p).chromium; } catch (e) {} }
  throw new Error('playwright-core not found');
}
function owner() {
  const F = require(path.join(ROOT, 'js/pets-feed.js'));
  const doc = F.expand(JSON.parse(fs.readFileSync(path.join(ROOT, 'api/pets.json'), 'utf8')));
  return doc.pets[0] && doc.pets[0].owner ? doc.pets[0].owner : '';
}
const ME = owner();
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('ok', m); } else { fail++; console.log('FAIL', m); } };
function serve() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2' };
  return new Promise(res => {
    const s = http.createServer((q, r) => {
      const u = decodeURIComponent(q.url.split('?')[0]);
      let p = path.normalize(path.join(ROOT, u));
      if (!p.startsWith(ROOT)) { r.writeHead(403); r.end(); return; }
      if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
      if (!fs.existsSync(p)) { r.writeHead(404); r.end('missing'); return; }
      r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
      fs.createReadStream(p).pipe(r);
    });
    s.listen(0, '127.0.0.1', () => res(s));
  });
}
const PAGES = [
  { id: 'mypets', file: 'play.html#petsPanel', ready: () => document.querySelectorAll('#petsPanel .pet.card').length > 0 && !!(window.V2Mock && V2Mock.world && V2Mock.world().pets.length > 20), note: 'My Pets cards' },
  { id: 'pet', file: 'pet.html?id=1', ready: () => { const t = document.getElementById('title'); return !!(t && t.textContent && t.textContent !== 'Loading…' && document.getElementById('page') && document.getElementById('page').style.display !== 'none'); }, note: 'pet #1' },
  { id: 'rare', file: 'rare-room.html', ready: () => !!(window.V2Mock && V2Mock.world && V2Mock.world().pets && V2Mock.world().pets.length > 20 && document.querySelector('#drEnter')), note: 'Rare Room opened' },
  { id: 'rank', file: 'ranking.html', ready: () => document.querySelectorAll('#board tr, #board li, #board .row').length > 0, note: 'ranking rows' }
];
function noise(s) { return /favicon|net::ERR_|Failed to load resource|fonts\.googleapis|fonts\.gstatic|sslip\.io|ERR_FAILED|aborted/i.test(s); }
(async () => {
  fs.mkdirSync(ART, { recursive: true });
  ok(!!ME, 'fixture owner from pets.json');
  const server = await serve();
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium().launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const times = [];
  try {
    for (const width of [1280, 390]) {
      const ctx = await browser.newContext(Object.assign({ viewport: { width: width, height: width === 390 ? 844 : 800 }, reducedMotion: 'reduce' }, width === 390 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}));
      await ctx.addInitScript(me => { try { localStorage.setItem('xcpets-v2-me', me); localStorage.setItem('xcpets-xcpwallet-address', me); } catch (e) {} }, ME);
      await ctx.route('**/*', route => {
        const u = route.request().url();
        if (u.startsWith(origin)) return route.continue();
        if (/fonts\.(googleapis|gstatic)\.com/.test(u)) return route.continue();
        return route.abort();
      });
      for (const pg of PAGES) {
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', e => errors.push(String(e)));
        page.on('console', m => { if (m.type() === 'error') errors.push('console ' + m.text()); });
        const t0 = Date.now();
        await page.goto(origin + '/' + pg.file, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await page.waitForFunction(pg.ready, null, { timeout: 180000 });
        const ms = Date.now() - t0;
        const info = await page.evaluate(() => ({
          pets: window.V2Mock && V2Mock.world ? V2Mock.world().pets.length : 0,
          cards: document.querySelectorAll('#petsPanel .pet.card, #page, #rhGrid .rh-card, #board tr').length,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          title: (document.getElementById('title') && document.getElementById('title').textContent) || document.title
        }));
        const bad = errors.filter(e => !noise(e));
        times.push(width + ' ' + pg.id + ' ' + ms + 'ms pets=' + info.pets + ' overflow=' + info.overflow);
        ok(bad.length === 0, width + ' ' + pg.note + ' 0 page errors' + (bad.length ? ': ' + bad.slice(0, 3).join(' | ') : ' (' + ms + 'ms)'));
        ok(info.overflow < 24, width + ' ' + pg.note + ' no sideways scroll (' + info.overflow + ')');
        await page.screenshot({ path: path.join(ART, 'feed-' + pg.id + '-' + width + '.png') });
        await page.close();
      }
      const vpage = await ctx.newPage();
      const verr = [];
      vpage.on('pageerror', e => verr.push(String(e)));
      await vpage.goto(origin + '/verify-pet.html', { waitUntil: 'domcontentloaded', timeout: 120000 });
      await vpage.waitForFunction(() => !!(window.XCPETSPetsFeed && document.getElementById('vfRun')), null, { timeout: 180000 });
      const expanded = await vpage.evaluate(() => {
        const doc = { v: 2, blockHeight: 3, count: 1, urlBase: 'https://xcpets.fun/pet.html?id=', dict: { owner: ['bc1qabc'], species: ['pepe'], speciesLabel: ['Pepe'], tier: ['Common', 'Uncommon', 'Rare', 'Legendary'], status: ['alive', 'dead', 'released'], stageName: ['Egg', 'Hatchling', 'Juvenile', 'Adult', 'Elder', 'Mythic'], slot: ['head', 'face', 'body', 'back', 'hand', 'feet'], stat: ['vigor', 'spark', 'grit', 'zoom', 'luck'] }, cols: XCPETSPetsFeed.COLS, pets: [[1, 'Pep', 0, 0, 10, 2, 1, 5, 0, null, 0, 0, 0, null, null, [1, 2, 3, 4, 5], 0, 0, 100, null, null, null]] };
        const p = XCPETSPetsFeed.expand(doc).pets[0];
        return { owner: p.owner, species: p.species, label: p.speciesLabel, stageName: p.stageName, url: p.url, stat: p.stats.spark };
      });
      ok(verr.filter(e => !noise(e)).length === 0, width + ' verify-pet 0 page errors');
      ok(expanded.owner === 'bc1qabc' && expanded.stageName === 'Hatchling' && expanded.url === 'https://xcpets.fun/pet.html?id=1' && expanded.stat === 2, width + ' verify expand ' + JSON.stringify(expanded));
      await vpage.close();
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  console.log(times.join('\n'));
  console.log('feed-pages-smoke-test: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
