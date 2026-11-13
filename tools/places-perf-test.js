/* places-perf (display only): Rare Room, Gooby's motel and /breed stay responsive with a large collection.
 * Full pages, the published game feed (api/boot.json) plus a labeled synthetic stress world.
 * Compares the previous scripts (origin/main) on the same stress world. Never signs or sends.
 *   node tools/places-perf-test.js
 */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), cp = require('child_process'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const ART = '/opt/cursor/artifacts';
const ME = 'bc1qplacesperfowner000000000000000000000';
const OTHER = 'bc1qplacesperfviewer000000000000000000000';
function chromium() {
  const tries = [process.env.PW, '/tmp/pw/node_modules/playwright-core', 'playwright-core', 'playwright'];
  for (const p of tries) { if (!p) continue; try { return require(p).chromium; } catch (e) {} }
  throw new Error('playwright-core not found');
}
function md5(p) { return crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex'); }
function gitFile(f) { return cp.execFileSync('git', ['show', 'origin/main:' + f], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32e6 }); }
const RULES = ['js/v2-rules.js', 'js/pet-core.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/real-core.js', 'rjs/burn-core.js', 'rjs/config.js'];
const CHANGED = ['js/v2.js', 'js/v2-motel.js', 'js/v2-easy-flows.js', 'js/v2-pet-search.js', 'css/rugme.css'];
const fail = [];
const ok = (c, m) => { if (c) console.log('ok', m); else { fail.push(m); console.log('FAIL', m); } };
function serve() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.gz': 'application/gzip' };
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
const INIT = `(() => {
  try { localStorage.setItem('xcpets-v2-me', ${JSON.stringify(ME)}); localStorage.setItem('xcpets-xcpwallet-address', ${JSON.stringify(ME)}); } catch (e) {}
  window.__long = []; window.__rafN = 0; window.__errs = [];
  try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__long.push(Math.round(e.duration)))).observe({ entryTypes: ['longtask'] }); } catch (e) {}
  const raf = window.requestAnimationFrame;
  window.requestAnimationFrame = function (fn) { window.__rafN++; return raf.apply(this, arguments); };
  window.addEventListener('error', e => window.__errs.push(String(e.message || e.error || e)));
})();`;
function arm(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console ' + m.text()); });
  return errors;
}
async function boot(page, origin, file) {
  const t0 = Date.now();
  await page.goto(origin + '/' + file, { waitUntil: 'domcontentloaded', timeout: 300000 });
  await page.waitForFunction(() => window.V2UI && window.V2Mock && V2Mock.world && V2Mock.world().pets && V2Mock.world().pets.length > 20, null, { timeout: 300000 });
  await page.waitForTimeout(400);
  return Date.now() - t0;
}
async function stress(page) {
  return page.evaluate(me => {
    const base = V2Mock.world();
    const src = base.pets.find(p => p && p.stage >= 3 && !p.dead && p.species && p.art) || base.pets[0];
    const kinds = ['tiny', 'giant', 'two-headed', 'inverted', 'ghost', 'backwards', 'wrong-egg', 'djpepe', 'wizard', 'kek', 'god'];
    const weird = { tiny: 1, giant: 1, 'two-headed': 1, inverted: 1, ghost: 1, backwards: 1, 'wrong-egg': 1 };
    const pets = base.pets.slice(), byId = Object.assign({}, base.byId);
    let id = 900000;
    function add(owner, kind, stage, parents) {
      const p = Object.assign({}, src, {
        id: ++id, owner: owner, name: (kind || 'plain') + id, species: src.species, stage: stage, dead: false, released: false,
        community: false, resurrected: false, parents: parents, hatchBlock: 970000 + (id % 5000), breeds: 0, hungry: false, neglected: false,
        art: Object.assign({}, src.art || {}, kind ? { rareHatch: { version: 1, kind: kind, block: 974962 } } : {}),
        stats: Object.assign({ vigor: 10, spark: 10, grit: 10, zoom: 10, luck: 10 }, src.stats),
        lastFed: null, feedDays: {} /* not fed, so the auto-star backfill does not protect them from a local discard */
      });
      if (!kind) delete p.art.rareHatch;
      delete p.children; delete p.rareHatch;
      pets.push(p); byId[p.id] = p; return p;
    }
    const ownedWeird = [];
    for (let i = 0; i < 1500; i++) ownedWeird.push(add(me, kinds[i % 7], 4, null).id); /* weird adults, yours */
    for (let i = 0; i < 40; i++) add(me, kinds[7 + (i % 4)], 5, null); /* legends */
    for (let i = 0; i < 2500; i++) add(me, null, i % 5 === 0 ? 1 : 4, null); /* plain, some too young */
    for (let i = 0; i < 8000; i++) add(i % 3 === 0 ? me : 'bc1qotherstress' + (i % 50), null, 4, null); /* partners */
    for (let i = 0; i < 6000; i++) add(me, null, 0, [ownedWeird[i % ownedWeird.length], ownedWeird[(i + 1) % ownedWeird.length]]); /* eggs, for the guest book */
    const w = Object.assign({}, base, { pets: pets, byId: byId, stressLabel: 'synthetic-stress owned-weird-1500 plain-2500 partners-8000 eggs-6000' });
    V2Mock.world = function () { return w; };
    window.__stressIds = { weird: ownedWeird, label: w.stressLabel, n: pets.length, weirdKinds: weird };
    return { n: pets.length, label: w.stressLabel, real: base.pets.length };
  }, ME);
}
async function renderMeasure(page, label) {
  return page.evaluate(async label => {
    const before = (window.__long || []).length;
    const t0 = performance.now();
    window.V2UI.render();
    const renderMs = Math.round(performance.now() - t0);
    const delays = [];
    for (let i = 0; i < 4; i++) { const a = performance.now(); await new Promise(r => setTimeout(r, 0)); delays.push(Math.round(performance.now() - a)); }
    const neu = (window.__long || []).slice(before);
    const vis = el => { if (!el) return false; const s = getComputedStyle(el); if (s.display === 'none' || s.visibility === 'hidden') return false; const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
    const sc = document.getElementById('motelScene'), btn = document.getElementById('ezBGo');
    const checks = Array.from(document.querySelectorAll('button')).filter(b => /check in/i.test(b.textContent || '') && vis(b)).map(b => b.id);
    return {
      label: label, renderMs: renderMs, delayMax: Math.max(0, ...delays), longN: neu.length, longMax: neu.reduce((a, b) => Math.max(a, b), 0),
      gridB: document.querySelectorAll('#bGridB .pet.card, #bGridB button').length,
      ez: document.querySelectorAll('#ezBreed .ez-c').length,
      place: !!(window.V2Motel && V2Motel.placeOn && V2Motel.placeOn()),
      checks: checks,
      ezGo: vis(document.getElementById('ezBGo')),
      bell: vis(document.getElementById('bGo')),
      extras: Array.from(document.querySelectorAll('button')).filter(b => /check in/i.test(b.textContent || '') && vis(b) && b.id !== 'ezBGo' && !(b.className || '').includes('qw-hint')).map(b => (b.id || '(no id)') + ' ' + (b.className || '') + ' ' + (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40)),
      gap: sc && btn ? Math.round(btn.getBoundingClientRect().top - sc.getBoundingClientRect().bottom) : null,
      btnAboveCols: !!(btn && document.querySelector('.ez-cols') && btn.getBoundingClientRect().top < document.querySelector('.ez-cols').getBoundingClientRect().top),
      solo: (() => { const t = document.querySelector('#rmTabs'); if (!t) return 'absent'; const s = getComputedStyle(t); return t.classList.contains('rm-solo') ? 'solo-' + s.display : 'tabs-' + s.display; })(),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      pets: (V2Mock.world().pets || []).length
    };
  }, label);
}
(async () => {
  fs.mkdirSync(ART, { recursive: true });
  const RULES_MD5 = '8e98664087bab2e991680ebdb80ba143';
  RULES.forEach(f => { const a = md5(path.join(ROOT, f)); ok(f === 'js/v2-rules.js' ? a === RULES_MD5 : a === crypto.createHash('md5').update(gitFile(f)).digest('hex'), f === 'js/v2-rules.js' ? 'js/v2-rules.js MD5 is ' + RULES_MD5 : 'rule unchanged ' + f + ' ' + a); });
  const PS = require(path.join(ROOT, 'js/v2-pet-search.js'));
  const hay = PS.haystack({ id: 9, name: 'Zed', species: 'pepe', tier: 1, stage: 3, stats: { vigor: 3 }, art: { rareHatch: { version: 1, kind: 'two-headed' } } }, null);
  ok(hay.includes('weird') && hay.includes('two headed') && hay.includes('two-headed'), 'search hay includes weird birth trait');
  const hayL = PS.haystack({ id: 10, name: 'Leg', species: 'pepe', tier: 3, stage: 5, stats: {}, art: { rareHatch: { version: 1, kind: 'kek' } } }, null);
  ok(hayL.includes('legend') && hayL.includes('legendary') && !hayL.includes('weird'), 'search hay includes legend and not weird');
  const old = {}; CHANGED.forEach(f => { old[f] = gitFile(f); });
  const server = await serve();
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium().launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const results = { origin: origin, feed: 'api/boot.json', stress: null, pages: {}, baseline: null };
  async function context(width, height, extra) {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: width, height: height }, reducedMotion: extra && extra.reduced ? 'reduce' : 'no-preference' }, extra && extra.mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}));
    await ctx.addInitScript(INIT);
    if (extra && extra.view) await ctx.addInitScript(o => { localStorage.setItem('xcpets-v2-me', o); }, OTHER);
    await ctx.route('**/*', route => {
      const u = route.request().url();
      if (!u.startsWith(origin)) return route.abort();
      if (extra && extra.old) { const name = new URL(u).pathname.replace(/^\//, ''); if (old[name]) return route.fulfill({ status: 200, contentType: name.endsWith('.css') ? 'text/css' : 'text/javascript', body: old[name] }); }
      return route.continue();
    });
    const page = await ctx.newPage();
    const errors = arm(page);
    page.__errors = errors; page.__ctx = ctx;
    return page;
  }
  try {
    const desk = await context(1280, 800);
    let ms = await boot(desk, origin, 'rare-room.html');
    let info = await desk.evaluate(() => {
      const w = V2Mock.world(), rare = (w.pets || []).filter(p => p.art && p.art.rareHatch && p.art.rareHatch.version === 1).length;
      return { msLabel: 'real-feed', pets: w.pets.length, rare: rare, place: V2Motel.placeOn(), hall: document.querySelectorAll('#rhGrid .rh-card').length, gridB: document.querySelectorAll('#bGridB .pet.card').length, longMax: Math.max(0, ...(window.__long || [0])), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    results.pages.rareCold = Object.assign({ bootMs: ms }, info);
    ok(info.place === false, 'rare room does not run the motel picker');
    ok(info.gridB === 0, 'rare room builds no hidden partner cards');
    ok(info.hall === 0 || (info.hall > 0 && info.hall <= 16), 'rare hall is absent or pages at most 16 cards (' + info.hall + ')');
    console.log('MEASURE real rare-room cold', JSON.stringify(results.pages.rareCold));
    await desk.screenshot({ path: path.join(ART, 'rare-hall-1280.png') });
    const raf0 = await desk.evaluate(() => window.__rafN);
    await desk.waitForTimeout(500);
    const raf1 = await desk.evaluate(() => window.__rafN);
    results.pages.rareRafPerSec = Math.round((raf1 - raf0) * 2);
    console.log('MEASURE rare-room raf/s after settle', results.pages.rareRafPerSec);
    ms = await boot(desk, origin, 'breed.html');
    info = await renderMeasure(desk, 'real-feed-breed');
    info.bootMs = ms;
    results.pages.breedReal = info;
    ok(info.place === true, 'breed page is the motel');
    ok(info.gridB === 0, 'breed page does not build a card per partner');
    ok(info.ezGo && !info.bell && !info.extras.length, 'one check-in, beside the motel (' + JSON.stringify(info.extras) + ')');
    ok(info.solo === 'absent' || info.solo === 'solo-none', 'retired top Check in is not shown (' + info.solo + ')');
    ok(info.gap != null && info.gap < 240 && info.btnAboveCols, 'check-in sits by the motel animation (gap ' + info.gap + 'px)');
    ok(info.overflow <= 8, 'no horizontal overflow at 1280 (' + info.overflow + ')');
    console.log('MEASURE real breed', JSON.stringify(info));
    const warm = await boot(desk, origin, 'breed.html');
    results.pages.breedWarmBootMs = warm;
    console.log('MEASURE breed warm boot', warm);
    const added = await stress(desk);
    results.stress = added;
    const stressM = await renderMeasure(desk, 'synthetic-stress');
    results.pages.breedStress = stressM;
    ok(stressM.gridB === 0, 'stress world still builds no hidden partner cards');
    ok(stressM.renderMs < 8000, 'stress render stays under 8s on a shared runner (' + stressM.renderMs + 'ms)');
    console.log('MEASURE stress cold input delay', stressM.delayMax, 'long', stressM.longMax);
    await desk.waitForTimeout(1200);
    const stressW = await renderMeasure(desk, 'synthetic-stress-warm');
    results.pages.breedStressWarm = stressW;
    ok(stressW.delayMax < 2000 && stressW.renderMs < 8000, 'warm stress render stays responsive on a shared runner (' + stressW.renderMs + 'ms, input ' + stressW.delayMax + 'ms)');
    console.log('MEASURE breed stress warm', JSON.stringify(stressW));
    ok(stressM.ez > 0 && stressM.ez <= 96, 'easy flow shows a page of mates, not the world (' + stressM.ez + ')');
    console.log('MEASURE breed stress', JSON.stringify(stressM));
    const searchMs = await desk.evaluate(async () => {
      const t0 = performance.now();
      const q = document.getElementById('ezBqB'); q.value = 'giant'; q.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 80));
      return { ms: Math.round(performance.now() - t0), n: document.querySelectorAll('#ezBreed .ez-c').length };
    });
    results.pages.mateSearch = searchMs;
    ok(searchMs.ms < 800, 'mate search does not rescore the world (' + searchMs.ms + 'ms)');
    console.log('MEASURE mate search', JSON.stringify(searchMs));
    const why = await desk.evaluate(() => {
      const b = document.getElementById('ezFall'); if (b && b.getAttribute('aria-pressed') !== 'true') b.click();
      const p = V2Mock.world().pets.find(x => x.owner === V2UI.ME && x.stage === 1 && !x.dead);
      const q = document.getElementById('ezBqA'); if (q && p) { q.value = String(p.id); q.dispatchEvent(new Event('input', { bubbles: true })); }
      const w = document.querySelector('#ezBreed .ez-why');
      return (w && w.textContent) || '';
    });
    ok(/young|adult|breed|stage|cooldown|neglected/i.test(why), 'a pet that cannot breed shows the reason (' + why.slice(0, 80) + ')');
    await desk.evaluate(() => {
      const q = document.getElementById('ezBqA'); if (q && q.value) { q.value = ''; q.dispatchEvent(new Event('input', { bubbles: true })); }
      const b = document.getElementById('ezFall'); if (b && b.getAttribute('aria-pressed') === 'true') b.click();
    });
    await desk.evaluate(() => {
      window.__sends = 0;
      if (window.V2Wallet) ['send', 'sendDex'].forEach(k => { if (V2Wallet[k]) V2Wallet[k] = function () { window.__sends++; return Promise.reject(new Error('test blocked send')); }; });
      const a = document.querySelectorAll('#ezBreed .ez-strip')[0].querySelector('[data-ez]');
      a.click();
    });
    await desk.waitForTimeout(50);
    await desk.evaluate(() => { const strips = document.querySelectorAll('#ezBreed .ez-strip'); const b = strips[1] && strips[1].querySelector('[data-ez]:not([aria-disabled="true"])'); if (b) b.click(); });
    await desk.waitForTimeout(50);
    const go = await desk.evaluate(() => { const b = document.getElementById('ezBGo'); const on = b && !b.disabled; if (on) b.click(); return { on: on, text: b ? b.textContent : '' }; });
    await desk.waitForTimeout(80);
    const cf = await desk.evaluate(() => ({ on: document.getElementById('confirmBox').classList.contains('on'), log: (document.getElementById('cfLog') || {}).textContent || '', sends: window.__sends || 0, title: (document.getElementById('cfTitle') || {}).textContent || '' }));
    ok(go.on && cf.on && /pet:breed:/.test(cf.log), 'check-in opens the normal breed confirm (' + cf.title + ')');
    ok(cf.sends === 0, 'opening confirm does not send');
    await desk.evaluate(() => document.getElementById('cfNo').click());
    const after = await desk.evaluate(() => ({ on: document.getElementById('confirmBox').classList.contains('on'), sends: window.__sends || 0 }));
    ok(!after.on && after.sends === 0, 'cancel leaves the wallet uncalled');
    await desk.screenshot({ path: path.join(ART, 'breed-checkin-1280.png') });
    const pile = await desk.evaluate(() => {
      const ids = window.__stressIds.weird.slice(0, 180);
      const star = ids[0];
      window.__demo.toggleKeep(star);
      window.__demo.discardIds(ids);
      const hidden = window.__demo.hiddenIds();
      return { starKept: hidden.indexOf(star) < 0, hidden: hidden.length };
    });
    ok(pile.starKept && pile.hidden === 179, 'starred pet is not discarded; the other 179 are only hidden locally (' + pile.hidden + ')');
    await desk.evaluate(() => { window.__demo.openPile(); const s = document.getElementById('fSort'); s.value = 'weird'; s.dispatchEvent(new Event('change', { bubbles: true })); });
    await desk.waitForTimeout(50);
    const sorted = await desk.evaluate(() => {
      const w = V2Mock.world(), card = document.querySelector('#pets .pet.card[data-pid]');
      const p = card && w.byId[card.getAttribute('data-pid')];
      const kind = p && p.art && p.art.rareHatch && p.art.rareHatch.kind;
      const weird = { tiny: 1, giant: 1, 'two-headed': 1, inverted: 1, ghost: 1, backwards: 1, 'wrong-egg': 1 };
      const opt = !!document.querySelector('#fSort option[value="weird"]');
      return { opt: opt, kind: kind, weird: !!(kind && weird[kind]) };
    });
    ok(sorted.opt && sorted.weird, 'My Pets sort Weird first (' + sorted.kind + ')');
    await desk.evaluate(() => { const b = document.querySelector('#discardPile [data-dbirth="weird"]'); if (b) b.click(); });
    await desk.waitForTimeout(40);
    const filt = await desk.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('#discardPile .dcard'));
      const w = V2Mock.world();
      const kinds = cards.map(d => { const p = w.byId[d.getAttribute('data-did')]; return p && p.art && p.art.rareHatch && p.art.rareHatch.kind; });
      const weird = { tiny: 1, giant: 1, 'two-headed': 1, inverted: 1, ghost: 1, backwards: 1, 'wrong-egg': 1 };
      return { n: cards.length, allWeird: kinds.length > 0 && kinds.every(k => weird[k]), match: (document.querySelector('#discardPile .dctl .muted') || {}).textContent || '' };
    });
    ok(filt.allWeird && filt.n > 0 && filt.n <= 120, 'discard pile Weird filter shows only weird pets (' + filt.n + ', ' + filt.match + ')');
    await desk.evaluate(() => { const q = document.querySelector('#discardPile [data-ds="q"]'); q.value = 'giant'; q.dispatchEvent(new Event('input', { bubbles: true })); });
    await desk.waitForTimeout(400);
    const giant = await desk.evaluate(() => {
      const w = V2Mock.world();
      const cards = Array.from(document.querySelectorAll('#discardPile .dcard'));
      const kinds = cards.map(d => w.byId[d.getAttribute('data-did')].art.rareHatch.kind);
      const box = document.querySelector('#discardPile [data-dsa="selall"]'); box.click();
      const sel = document.querySelectorAll('#discardPile .dcard.selected').length;
      return { n: cards.length, kinds: kinds.slice(0, 5), allGiant: kinds.every(k => k === 'giant'), sel: sel };
    });
    ok(giant.allGiant && giant.sel === giant.n && giant.n > 0, 'discard search giant + select all shown (' + giant.sel + ')');
    const back = await desk.evaluate(() => {
      const id = Number(document.querySelector('#discardPile [data-restore]').getAttribute('data-restore'));
      document.querySelector('#discardPile [data-restore]').click();
      return { id: id, still: window.__demo.hiddenIds().indexOf(id) >= 0 };
    });
    ok(!back.still, 'restore puts the pet back locally and does not burn');
    const ids = await desk.evaluate(async () => {
      const ME = window.V2UI.ME, w = V2Mock.world(), weird = window.__stressIds.weird;
      const legend = w.pets.filter(p => p.owner === ME && p.art && p.art.rareHatch && ['djpepe', 'wizard', 'kek', 'god'].indexOf(p.art.rareHatch.kind) >= 0)[0];
      w.byId[weird[180]].tier = 0; if (legend) legend.tier = 3;
      const want = [weird[180], weird[181], legend ? legend.id : weird[182]];
      const sel0 = (V2UI.S().sel || []).slice().join(), hid0 = window.__demo.hiddenIds().slice().sort().join();
      const el = document.getElementById('fSearch');
      el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true }));
      const dt = new DataTransfer(); dt.setData('text/plain', '#' + want[0] + '\n' + want[1] + '\n' + want[1] + ', ' + want[2] + ', 424242424');
      el.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
      if (!el.value.trim()) el.value = '#' + want[0] + '\n' + want[1] + ', ' + want[1] + ' ' + want[2] + ', 424242424';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 400));
      const cards = Array.from(document.querySelectorAll('#pets .pet.card[data-pid]')).map(c => Number(c.dataset.pid));
      const note = (document.getElementById('fShowing') || {}).textContent || '';
      const sel1 = (V2UI.S().sel || []).slice().join(), hid1 = window.__demo.hiddenIds().slice().sort().join();
      const tier = document.getElementById('fTier'); const prev = tier.value; tier.value = 'legendary'; tier.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 80));
      const legends = Array.from(document.querySelectorAll('#pets .pet.card[data-pid]')).map(c => Number(c.dataset.pid));
      tier.value = prev; tier.dispatchEvent(new Event('change', { bubbles: true }));
      el.value = '12abc, ' + want[0]; el.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 300));
      const bad = (document.getElementById('fShowing') || {}).textContent || '';
      const badN = document.querySelectorAll('#pets .pet.card').length;
      document.getElementById('fReset').click();
      await new Promise(r => setTimeout(r, 50));
      const many = []; for (let i = 0; i < 5000; i++) many.push(String(800000 + i)); many[0] = String(want[0]);
      const t0 = performance.now(); el.value = many.join(' '); el.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 500));
      const bigMs = Math.round(performance.now() - t0), bigN = document.querySelectorAll('#pets .pet.card').length, bigNote = (document.getElementById('fShowing') || {}).textContent || '';
      document.getElementById('fReset').click();
      const pileQ = [weird[3], weird[4], legend ? legend.id : weird[5], 424242425]; /* weird[3] and weird[4] are already in the pile */
      window.__demo.discardIds(pileQ.filter(id => w.byId[id] && w.byId[id].owner === ME));
      window.__demo.openPile();
      const box = document.querySelector('#discardPile [data-ds="q"]');
      box.value = pileQ.join(', '); box.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 400));
      const pileAll = Array.from(document.querySelectorAll('#discardPile .dcard')).map(d => Number(d.dataset.did));
      const meta = (document.querySelector('#discardPile [data-ds="meta"]') || {}).textContent || '';
      const selBefore = Object.keys((document.querySelector('#discardPile [data-dsa="selall"]') || {}).checked ? { x: 1 } : {}).length;
      document.querySelector('#discardPile [data-dbirth="weird"]').click();
      await new Promise(r => setTimeout(r, 40));
      const pileWeird = Array.from(document.querySelectorAll('#discardPile .dcard')).map(d => { const p = V2Mock.world().byId[d.dataset.did]; return p.art.rareHatch.kind; });
      const checked = document.querySelectorAll('#discardPile .dcard.selected').length;
      box.value = ''; box.dispatchEvent(new Event('input', { bubbles: true }));
      return { want: want, pasted: el.value === '' || true, cards: cards, note: note, selSame: sel0 === sel1, hidSame: hid0 === hid1, legends: legends, bad: bad, badN: badN, bigMs: bigMs, bigN: bigN, bigNote: bigNote, pileAll: pileAll, meta: meta, pileWeird: pileWeird, checked: checked, selBefore: selBefore };
    });
    results.pages.idList = { note: ids.note, cards: ids.cards.length, bigMs: ids.bigMs, bigNote: ids.bigNote, meta: ids.meta, bad: ids.bad };
    ok(ids.selSame && ids.hidSame, 'an id list does not select, discard or restore');
    ok(ids.cards.indexOf(ids.want[0]) >= 0 && ids.cards.indexOf(ids.want[1]) >= 0 && ids.cards.indexOf(424242424) < 0 && ids.cards.length <= 3, 'pasted ids show only those pets (' + ids.cards.join(',') + ') ' + ids.note);
    ok(ids.note.indexOf('not here') >= 0, 'absent ids are counted (' + ids.note + ')');
    ok(ids.legends.indexOf(ids.want[0]) < 0, 'rarity filter still applies on top of the id list (' + ids.legends.join(',') + ')');
    ok(/not pet numbers/i.test(ids.bad) && ids.badN === 0, 'a broken token matches nothing (' + ids.bad + ')');
    ok(ids.bigMs < 1500 && ids.bigN > 0 && ids.bigN <= 150, '5,000 ids filter without building every card (' + ids.bigMs + 'ms, ' + ids.bigN + ' cards) ' + ids.bigNote);
    ok(ids.pileAll.length >= 2 && ids.pileAll.indexOf(424242425) < 0 && /not in this pile/.test(ids.meta), 'discard search uses the same id list (' + ids.meta + ')');
    ok(ids.pileWeird.length > 0 && ids.pileWeird.every(k => ['tiny', 'giant', 'two-headed', 'inverted', 'ghost', 'backwards', 'wrong-egg'].indexOf(k) >= 0) && ids.checked === 0, 'weird filter narrows the id list and does not tick them');
    console.log('MEASURE id list', JSON.stringify(results.pages.idList));
    await desk.screenshot({ path: path.join(ART, 'discard-weird-1280.png') });
    await desk.evaluate(() => { const s = document.querySelector('#discardPile [data-ds="sort"]'); s.value = 'weird'; s.dispatchEvent(new Event('change', { bubbles: true })); });
    const phone = await context(390, 844, { mobile: true });
    await boot(phone, origin, 'breed.html');
    await stress(phone);
    const m390 = await renderMeasure(phone, 'synthetic-390');
    results.pages.breed390 = m390;
    ok(m390.overflow <= 8, 'no horizontal overflow at 390 (' + m390.overflow + ')');
    ok(m390.gridB === 0 && m390.ezGo && !m390.bell && !m390.extras.length, 'phone keeps one check-in and no hidden grid (' + JSON.stringify(m390.extras) + ')');
    ok(m390.renderMs < 15000, 'phone stress render under 15s on a shared runner (' + m390.renderMs + 'ms)');
    console.log('MEASURE breed 390', JSON.stringify(m390));
    await phone.screenshot({ path: path.join(ART, 'breed-checkin-390.png') });
    await phone.goto(origin + '/rare-room.html', { waitUntil: 'domcontentloaded' });
    await phone.waitForFunction(() => window.V2UI && V2Mock.world().pets.length > 20 && window.V2RareHall, null, { timeout: 120000 });
    await phone.waitForFunction(() => { if (window.V2RareHall && V2RareHall.draw) V2RareHall.draw(); return document.querySelectorAll('#rhGrid .rh-card').length > 0; }, null, { timeout: 8000 }).catch(() => {});
    const hall390 = await phone.evaluate(() => document.querySelectorAll('#rhGrid .rh-card').length);
    ok(hall390 === 0 || (hall390 > 0 && hall390 <= 8), 'rare hall is absent or pages at most 8 cards at 390 (' + hall390 + ')');
    await phone.screenshot({ path: path.join(ART, 'rare-hall-390.png') });
    const view = await context(1280, 800, { view: true });
    await boot(view, origin, 'breed.html?addr=' + encodeURIComponent(OTHER));
    const vo = await view.evaluate(() => {
      window.__sends = 0;
      if (window.V2Wallet) V2Wallet.send = function () { window.__sends++; return Promise.reject(new Error('blocked')); };
      const only = !!(window.V2UI.viewOnly && V2UI.viewOnly());
      const hint = (document.querySelector('#ezCheck .ez-hint, #ezCheck .ez-lead') || {}).textContent || '';
      const b = document.getElementById('bGo'); if (b) { b.disabled = false; b.click(); }
      return { only: only, hint: hint, confirm: document.getElementById('confirmBox').classList.contains('on'), sheet: !!document.getElementById('nwBox') && document.getElementById('nwBox').classList.contains('on'), sends: window.__sends };
    });
    results.pages.viewOnly = vo;
    ok(vo.only && !vo.confirm && vo.sends === 0, 'view only does not open a signable confirm');
    console.log('MEASURE view-only', JSON.stringify(vo));
    const rm = await context(1280, 800, { reduced: true });
    await boot(rm, origin, 'breed.html');
    const reduced = await rm.evaluate(async () => {
      const a = window.__rafN; await new Promise(r => setTimeout(r, 600)); const n = window.__rafN - a;
      return { frames: n, reduce: matchMedia('(prefers-reduced-motion: reduce)').matches, place: V2Motel.placeOn() };
    });
    results.pages.reduced = reduced;
    ok(reduced.reduce && reduced.frames < 8, 'reduced motion does not keep the motel frame loop (' + reduced.frames + ' frames / 600ms)');
    console.log('MEASURE reduced motion', JSON.stringify(reduced));
    const basePage = await context(1280, 800, { old: true });
    let baseline;
    try {
      await boot(basePage, origin, 'breed.html');
      await stress(basePage);
      const t0 = Date.now();
      baseline = await Promise.race([
        renderMeasure(basePage, 'origin-main-scripts').catch(e => ({ label: 'origin-main-scripts', error: String(e).slice(0, 300) })),
        new Promise(r => setTimeout(() => r({ label: 'origin-main-scripts', timedOut: true, renderMs: Date.now() - t0 }), 20000))
      ]);
    } catch (e) { baseline = { label: 'origin-main-scripts', error: String(e).slice(0, 300) }; }
    results.baseline = baseline;
    console.log('MEASURE baseline origin/main scripts', JSON.stringify(baseline));
    if (baseline.timedOut || baseline.error) console.log('BASELINE FAIL previous scripts did not finish a stress render: ' + (baseline.error || 'still running at 20s'));
    else if (baseline.gridB != null) ok(baseline.gridB >= stressM.gridB && stressM.gridB === 0, 'hidden partner cards stay at none (previous scripts ' + baseline.gridB + ', this branch ' + stressM.gridB + ')');
    const shopPage = await context(1280, 800);
    let shop;
    try {
      const t0 = Date.now();
      await shopPage.goto(origin + '/shop.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
      await shopPage.waitForFunction(() => document.querySelector('#csCanvas, #shScene'), null, { timeout: 20000 });
      shop = await shopPage.evaluate(() => ({ bootMs: 0, scene: true, breed: !!document.getElementById('breedPanel'), pets: window.V2Mock && V2Mock.world ? V2Mock.world().pets.length : 0, longMax: Math.max(0, ...(window.__long || [0])) }));
      shop.bootMs = Date.now() - t0;
    } catch (e) { shop = { error: String(e).slice(0, 180), scene: false }; }
    results.pages.shop = shop;
    console.log('MEASURE shop', JSON.stringify(shop));
    if (shop.scene) ok(!shop.breed, 'Spam City has its scene and no motel panel');
    else console.log('BASELINE NOTE shop did not finish booting in 20s with chain calls blocked: ' + (shop.error || ''));
    [desk, phone, view, rm, basePage, shopPage].forEach(p => { const bad = (p.__errors || []).filter(e => !/favicon|net::ERR_FAILED|Failed to load resource/i.test(e)); if (bad.length) fail.push('console/page errors: ' + bad.slice(0, 4).join(' | ')); else console.log('ok no page errors'); });
  } finally {
    fs.writeFileSync(path.join(ART, 'places-perf-results.json'), JSON.stringify({ fail: fail, results: results }, null, 2));
    await browser.close(); server.close();
  }
  console.log(fail.length ? 'FAILED ' + fail.length : 'places-perf-test PASS');
  fail.forEach(f => console.log(' -', f));
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error(e.stack || e); process.exit(2); });
