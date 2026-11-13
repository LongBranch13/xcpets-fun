/* rare-room-unequip: Take off and Unequip all stay on the main thread only long enough to
 * update the one pet. A large wallet (the owner address, 14k pets, hundreds of worn pieces)
 * must not replay the chain or rebuild the hidden raid list. Display only. Never signs.
 * rare-room-dress: opening the Rare Room (and coming back to it) used to sort every living
 * pet by shownLooks(), which re-sorts every look copy on each comparison, and Chrome showed
 * "Page Unresponsive" while the room was on screen (the Dress door click landed in that task).
 *   node tools/rare-unequip-perf-test.js
 */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), cp = require('child_process'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const ART = '/opt/cursor/artifacts';
const ADDR = 'bc1ps9av86ymmlzy9zj3a8pn6g94pz4j5e0kagv3td3wutaagfjvekjs26m3s4'; /* owner wallet: most worn gear in api/pets.json */
function chromium() {
  const tries = [process.env.PW, '/tmp/pw/node_modules/playwright-core', 'playwright-core', 'playwright'];
  for (const p of tries) { if (!p) continue; try { return require(p).chromium; } catch (e) {} }
  throw new Error('playwright-core not found');
}
function md5(p) { return crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex'); }
function gitFile(f) { return cp.execFileSync('git', ['show', 'origin/main:' + f], { cwd: ROOT, encoding: 'utf8', maxBuffer: 32e6 }); }
const RULES = ['js/v2-rules.js', 'js/pet-core.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/real-core.js', 'rjs/burn-core.js', 'rjs/config.js'];
const fail = [];
const ok = (c, m) => { if (c) console.log('ok', m); else { fail.push(m); console.log('FAIL', m); } };
function serve() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.gz': 'application/gzip' };
  return new Promise(res => {
    const s = http.createServer((q, r) => {
      let p = path.normalize(path.join(ROOT, decodeURIComponent(q.url.split('?')[0])));
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
  window.__long = []; window.__replays = 0; window.__errs = [];
  try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__long.push(Math.round(e.duration)))).observe({ type: 'longtask', buffered: true }); } catch (e) {}
  let V; Object.defineProperty(window, 'V2Rules', { configurable: true, enumerable: true,
    get() { return V; },
    set(v) { if (v && v.replay && !v.__w) { const r = v.replay; v.replay = function () { window.__replays++; return r.apply(this, arguments); }; v.__w = 1; } V = v; } });
  window.addEventListener('error', e => window.__errs.push(String(e.message || e.error || e)));
})();`;
(async () => {
  fs.mkdirSync(ART, { recursive: true });
  const RULES_MD5 = '8e98664087bab2e991680ebdb80ba143';
  RULES.forEach(f => { const a = md5(path.join(ROOT, f)); ok(f === 'js/v2-rules.js' ? a === RULES_MD5 : a === crypto.createHash('md5').update(gitFile(f)).digest('hex'), f === 'js/v2-rules.js' ? 'js/v2-rules.js MD5 is ' + RULES_MD5 : 'rule unchanged ' + f + ' ' + a); });
  const server = await serve();
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium().launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const results = { addr: ADDR, before: { openNote: 'measured on origin/main before this fix', unequipOneMs: 57112, unequipOneReplayMs: 55475, unequipAllMs: 28507, unequipAllReplayMs: 27538, openLongTaskMs: 137786 } };
  async function boot(width, height) {
    const ctx = await browser.newContext({ viewport: { width: width, height: height }, ...(width < 500 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
    await ctx.addInitScript(INIT);
    await ctx.addInitScript(a => { localStorage.setItem('xcpets-v2-me', a); localStorage.setItem('xcpets-xcpwallet-address', a); }, ADDR);
    await ctx.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    const t0 = Date.now();
    await page.goto(origin + '/rare-room.html?addr=' + encodeURIComponent(ADDR) + '#rare-room', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => window.V2UI && window.V2Mock && V2Mock.world && V2Mock.world().pets && V2Mock.world().pets.length > 1000 && !V2Mock.world().pending && document.querySelector('#shopScene canvas') && document.querySelector('#lookStation') && document.querySelector('#drEnter'), null, { timeout: 300000 });
    await page.waitForTimeout(600);
    return { page: page, ctx: ctx, errors: errors, openMs: Date.now() - t0 };
  }
  try {
    const desk = await boot(1280, 800);
    const opened = await desk.page.evaluate(() => {
      const w = V2Mock.world(), me = V2UI.ME;
      const mine = w.pets.filter(p => p.owner === me);
      const worn = (w.itemList || []).filter(g => g.owner === me && g.on != null);
      return {
        pets: w.pets.length, mine: mine.length, worn: worn.length, viewOnly: !!(V2UI.viewOnly && V2UI.viewOnly()),
        hall: document.querySelectorAll('#rhGrid .rh-card').length,
        raidPets: document.querySelectorAll('#raidBox .rd-pet').length,
        fTheirs: (document.getElementById('fTheirs') && document.getElementById('fTheirs').options) ? document.getElementById('fTheirs').options.length : 0,
        longMax: (window.__long || []).reduce((a, b) => Math.max(a, b), 0),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });
    opened.openMs = desk.openMs;
    results.desktopOpen = opened;
    console.log('MEASURE open 1280', JSON.stringify(opened));
    ok(opened.pets > 100000, 'big wallet loaded (' + opened.pets + ' pets)');
    ok(opened.viewOnly === false, 'same-address ?addr= can take gear off without a signature');
    ok(opened.hall === 0 || (opened.hall > 0 && opened.hall <= 16), 'hall is absent or still pages (' + opened.hall + ')');
    ok(opened.raidPets === 0, 'hidden raid list is not built (' + opened.raidPets + ')');
    ok(opened.fTheirs === 0, 'hidden arena fighter list is not built (' + opened.fTheirs + ')');
    ok(opened.overflow <= 8, 'no horizontal overflow at 1280 (' + opened.overflow + ')');
    ok(opened.longMax < 8000, 'opening the Rare Room has no multi-second freeze (' + opened.longMax + 'ms, was 133702ms)');
    const station = await desk.page.evaluate(() => {
      const el = document.getElementById('lookStation'); if (el) el.remove();
      window.__long.length = 0;
      const t0 = performance.now();
      V2LookPicker.tick();
      const ms = Math.round(performance.now() - t0);
      const w = V2UI.world(), me = V2UI.ME;
      const live = w.pets.filter(p => p.owner === me && !p.dead && !p.released && !p.community);
      const counts = V2LookPicker.looksOn(w, live);
      const sample = [];
      for (let i = 0; i < 12; i++) sample.push(live[(i * 997) % live.length]);
      const shown = live.filter(p => (p.flameLooks && p.flameLooks.length) || (w.lookCopies && Object.keys(w.lookCopies).some(k => w.lookCopies[k].at === p.id))).slice(0, 8);
      shown.forEach(p => { if (sample.indexOf(p) < 0) sample.push(p); });
      let mismatch = 0;
      sample.forEach(p => { if ((counts[p.id] || 0) !== V2Rules.shownLooks(w, p).length) mismatch++; });
      const heading = (document.querySelector('#lpBody h3') || {}).textContent || '';
      const m = /#(\d+)/.exec(heading);
      const picked = m ? +m[1] : 0;
      return { ms: ms, longMax: (window.__long || []).reduce((a, b) => Math.max(a, b), 0), mismatch: mismatch, picked: picked, start: V2LookPicker.startPet(w, live), live: live.length, copies: w.lookCopies ? Object.keys(w.lookCopies).length : 0 };
    });
    results.station = station;
    console.log('MEASURE station', JSON.stringify(station));
    ok(station.ms < 2500, 'Flex Forge station under 2.5s (' + station.ms + 'ms, was tens of seconds)');
    ok(station.longMax < 2500, 'Flex Forge station long task under 2.5s (' + station.longMax + 'ms)');
    ok(station.mismatch === 0, 'fast look count matches shownLooks (' + station.mismatch + ' mismatches)');
    ok(station.picked === station.start, 'station opens on the most-looks pet #' + station.start + ' (showing #' + station.picked + ')');
    const dress = await desk.page.evaluate(async () => {
      window.__long.length = 0;
      if (location.hash !== '#rare-room') location.hash = '#rare-room';
      await new Promise(res => setTimeout(res, 80));
      const c = document.querySelector('#shopScene canvas');
      const r = c.getBoundingClientRect();
      const cx = r.left + ((112 + 10) / 320) * r.width, cy = r.top + ((60 + 18) / 150) * r.height;
      window.__long.length = 0;
      const t0 = performance.now();
      c.dispatchEvent(new MouseEvent('click', { clientX: cx, clientY: cy, bubbles: true, cancelable: true, view: window }));
      const until = performance.now() + 8000;
      while ((location.hash !== '#dressing-room' || !document.querySelector('#rrDress')) && performance.now() < until) await new Promise(res => setTimeout(res, 40));
      const clickMs = Math.round(performance.now() - t0);
      const delays = [];
      for (let i = 0; i < 3; i++) { const a = performance.now(); await new Promise(res => setTimeout(res, 0)); delays.push(Math.round(performance.now() - a)); }
      const w = V2UI.world(), pid = V2Shop._state().pet, P = w.byId[pid];
      const worn = P ? V2Rules.wornOf(w, pid).map(g => g.item).sort() : [];
      const dom = Array.prototype.map.call(document.querySelectorAll('#rrDress .dr-slots canvas[data-gic]'), cv => cv.getAttribute('data-gic')).sort();
      return {
        clickMs: clickMs, hash: location.hash, dress: !!document.querySelector('#rrDress'),
        strip: document.querySelectorAll('#drStrip .dr-pt').length,
        pid: pid, sameGear: worn.join() === dom.join(), wornN: worn.length,
        longMax: (window.__long || []).reduce((a, b) => Math.max(a, b), 0),
        delay: Math.max(0, ...delays)
      };
    });
    results.dress = dress;
    console.log('MEASURE dress click', JSON.stringify(dress));
    ok(dress.hash === '#dressing-room' && dress.dress, 'Dress door opens the dressing room');
    ok(dress.clickMs < 2500, 'Dress click under 2.5s (' + dress.clickMs + 'ms)');
    ok(dress.longMax < 2500, 'Dress click long task under 2.5s (' + dress.longMax + 'ms)');
    ok(dress.delay < 400, 'page accepts input after Dress (' + dress.delay + 'ms)');
    ok(dress.strip > 0, 'dressing room lists pets (' + dress.strip + ')');
    ok(dress.sameGear, 'dressing room slots match worn gear for #' + dress.pid + ' (' + dress.wornN + ' pieces)');
    await desk.page.screenshot({ path: path.join(ART, 'rare-room-dress-1280.png') });
    const gear = await desk.page.evaluate(async () => {
      const w = V2UI.world(), me = V2UI.ME, worn = (w.itemList || []).filter(g => g.owner === me && g.on != null);
      const by = {}; worn.forEach(g => { (by[g.on] = by[g.on] || []).push(g); });
      const pid = Object.keys(by).map(Number).sort((a, b) => by[b].length - by[a].length)[0];
      if (window.V2Shop) { V2Shop._state().pet = pid; if (location.hash !== '#dressing-room') location.hash = '#dressing-room'; if (V2Shop.refreshRoll) V2Shop.refreshRoll(); }
      await new Promise(r => setTimeout(r, 50));
      const before = window.V2Rules.wornOf(V2UI.world(), pid).map(g => g.slot + ':' + g.gid);
      const btn = document.querySelector('#rrDress [data-droff]');
      const slot = btn ? btn.getAttribute('data-droff') : '';
      window.__replays = 0; window.__long.length = 0;
      const t0 = performance.now();
      if (btn) btn.click();
      const oneMs = Math.round(performance.now() - t0);
      const delays = [];
      for (let i = 0; i < 3; i++) { const a = performance.now(); await new Promise(r => setTimeout(r, 0)); delays.push(Math.round(performance.now() - a)); }
      const afterOne = window.V2Rules.wornOf(V2UI.world(), pid).map(g => g.slot + ':' + g.gid);
      const ops = V2UI.S().ops.length;
      /* Unequip all: the same Yes button as the pet's gear box */
      window.V2UI.detail(pid);
      await new Promise(r => setTimeout(r, 50));
      const allBtn = document.querySelector('[data-offall]');
      window.__replays = 0; window.__long.length = 0;
      const t1 = performance.now();
      if (allBtn) allBtn.click();
      const yes = document.querySelector('[data-offyes]');
      if (yes) yes.click();
      const allMs = Math.round(performance.now() - t1);
      const d2 = [];
      for (let i = 0; i < 3; i++) { const a = performance.now(); await new Promise(r => setTimeout(r, 0)); d2.push(Math.round(performance.now() - a)); }
      const left = window.V2Rules.wornOf(V2UI.world(), pid).map(g => g.gid);
      return {
        pid: pid, slot: slot, before: before.length, afterOne: afterOne.length, tookSlot: before.some(s => s.indexOf(slot + ':') === 0) && !afterOne.some(s => s.indexOf(slot + ':') === 0),
        oneMs: oneMs, oneDelay: Math.max(0, ...delays), oneReplay: window.__replays, oneLong: (window.__long || []).reduce((a, b) => Math.max(a, b), 0),
        allBtn: !!allBtn, allMs: allMs, allDelay: Math.max(0, ...d2), allReplay: window.__replays, allLong: (window.__long || []).reduce((a, b) => Math.max(a, b), 0),
        left: left.length, ops: ops, opsNow: V2UI.S().ops.length
      };
    });
    results.desktopGear = gear;
    console.log('MEASURE unequip 1280', JSON.stringify(gear));
    ok(gear.before >= 2, 'pet #' + gear.pid + ' started with worn gear (' + gear.before + ')');
    ok(gear.tookSlot, 'one Take off cleared slot ' + gear.slot);
    ok(gear.oneMs < 1000, 'one Take off under 1s (' + gear.oneMs + 'ms, was 57112ms)');
    ok(gear.oneReplay === 0, 'one Take off did not replay the chain');
    ok(gear.oneDelay < 400, 'page accepts input after one Take off (' + gear.oneDelay + 'ms)');
    ok(gear.allBtn, 'Unequip all is offered on the pet');
    ok(gear.left === 0, 'Unequip all cleared the pet (' + gear.left + ' left)');
    ok(gear.allMs < 1500, 'Unequip all under 1.5s (' + gear.allMs + 'ms, was 28507ms)');
    ok(gear.allReplay === 0, 'Unequip all did not replay the chain');
    ok(gear.allDelay < 400, 'page accepts input after Unequip all (' + gear.allDelay + 'ms)');
    await desk.page.screenshot({ path: path.join(ART, 'rare-room-unequip-1280.png') });
    const same2 = await desk.page.evaluate(pid => {
      const S = V2Mock.state();
      const live = window.V2Rules.wornOf(V2UI.world(), pid).map(g => g.gid).sort().join(',');
      const t0 = performance.now();
      const raw = V2Rules.replay;
      const w2 = (raw.__w ? null : null, (function () { const fn = V2Rules.replay; return fn.call(V2Rules, S.rows, S.hashes, S.ops, { tip: S.tip, live: window.LiveEngine.RealCore, dex: S.dex }); })());
      const again = window.V2Rules.wornOf(w2, pid).map(g => g.gid).sort().join(',');
      return { ms: Math.round(performance.now() - t0), same: live === again, live: live, again: again };
    }, gear.pid);
    results.replayMatch = same2;
    console.log('MEASURE replay match', JSON.stringify(same2));
    ok(same2.same, 'worn gear matches a full replay of the same local ops');
    /* view only: a different saved wallet must not take gear off */
    const view = await desk.page.evaluate(addr => {
      const w = V2UI.world(), me = V2UI.ME;
      const other = (w.itemList || []).filter(g => g.owner === me && g.on != null && g.on !== addr.pid)[0];
      const pid = other ? other.on : addr.pid;
      const before = V2UI.S().ops.length, worn = window.V2Rules.wornOf(w, pid).length;
      localStorage.setItem('xcpets-xcpwallet-address', 'bc1qviewonlynottheowner000000000000000');
      if (window.V2View && V2View.mark) V2View.mark();
      const only = !!(V2UI.viewOnly && V2UI.viewOnly());
      if (window.V2Shop) { V2Shop._state().pet = pid; if (V2Shop.refreshRoll) V2Shop.refreshRoll(); }
      const btn = document.querySelector('#rrDress [data-droff]');
      if (btn) btn.click();
      const after = V2UI.S().ops.length, worn2 = window.V2Rules.wornOf(V2UI.world(), pid).length;
      localStorage.setItem('xcpets-xcpwallet-address', addr.addr);
      if (window.V2View && V2View.mark) V2View.mark();
      return { only: only, hadButton: !!btn, opsSame: before === after, wornSame: worn === worn2, worn: worn };
    }, { pid: gear.pid, addr: ADDR });
    results.viewOnly = view;
    ok(view.only && view.opsSame && view.wornSame, 'view-only Take off does not change gear or save an op');
    await desk.page.setViewportSize({ width: 390, height: 844 });
    await desk.page.waitForTimeout(300);
    const phone = await desk.page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      hall: document.querySelectorAll('#rhGrid .rh-card').length,
      dress: !!document.querySelector('#rrDress, #drEnter')
    }));
    results.phone = phone;
    ok(phone.overflow <= 8, 'no horizontal overflow at 390 (' + phone.overflow + ')');
    ok(phone.hall === 0 || phone.hall <= 8, 'hall is gone or pages at most 8 cards at 390 (' + phone.hall + ')');
    await desk.page.screenshot({ path: path.join(ART, 'rare-room-unequip-390.png') });
    const tBack = Date.now();
    await desk.page.setViewportSize({ width: 1280, height: 800 });
    await desk.page.goto(origin + '/rare-room.html?addr=' + encodeURIComponent(ADDR) + '#rare-room', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await desk.page.waitForFunction(() => window.V2Mock && V2Mock.world && V2Mock.world().pets && V2Mock.world().pets.length > 1000 && !V2Mock.world().pending && document.querySelector('#shopScene canvas') && document.querySelector('#lookStation') && document.querySelector('#drEnter'), null, { timeout: 180000 });
    await desk.page.waitForTimeout(400);
    const back = await desk.page.evaluate(() => ({
      longMax: (window.__long || []).reduce((a, b) => Math.max(a, b), 0),
      longTop: (window.__long || []).slice().sort((a, b) => b - a).slice(0, 6),
      hall: document.querySelectorAll('#rhGrid .rh-card').length,
      hallMore: !!document.querySelector('#rhGrid .rh-more'),
      station: !!document.querySelector('#lookStation'),
      enter: !!document.querySelector('#drEnter'),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }));
    back.ms = Date.now() - tBack;
    results.returnHall = back;
    console.log('MEASURE return hall', JSON.stringify(back));
    ok(back.station && back.enter, 'coming back shows the Rare Room and Flex Forge');
    ok(back.longMax < 8000, 'coming back has no multi-second freeze (' + back.longMax + 'ms)');
    ok(back.hall === 0 || (back.hall <= 64 && (back.hall <= 16 || back.hallMore)), 'hall is gone or still pages after coming back (' + back.hall + (back.hallMore ? ', more below' : '') + ')');
    await desk.page.setViewportSize({ width: 390, height: 844 });
    await desk.page.waitForTimeout(300);
    const phoneBack = await desk.page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, hall: document.querySelectorAll('#rhGrid .rh-card').length, enter: !!document.querySelector('#drEnter') }));
    results.phoneReturn = phoneBack;
    ok(phoneBack.overflow <= 8, 'no horizontal overflow at 390 after coming back (' + phoneBack.overflow + ')');
    await desk.page.screenshot({ path: path.join(ART, 'rare-room-return-390.png') });
    const bad = desk.errors.filter(e => !/favicon|net::ERR_FAILED|Failed to load resource/i.test(e));
    ok(!bad.length, 'no page errors' + (bad.length ? ': ' + bad.slice(0, 3).join(' | ') : ''));
    await desk.ctx.close();
  } finally {
    fs.writeFileSync(path.join(ART, 'rare-unequip-results.json'), JSON.stringify({ fail: fail, results: results }, null, 2));
    await browser.close(); server.close();
  }
  console.log(fail.length ? 'FAILED ' + fail.length : 'rare-unequip-perf-test PASS');
  fail.forEach(f => console.log(' -', f));
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error(e && e.stack || e); process.exit(2); });
