/* rare-room-perf-1107: Hall of Rare Finds stays responsive. Display only.
 * Checks the hall never calls world() before rows exist, pages cards instead of mounting every find,
 * paints sprites one at a time from a cache, keeps the plain buttons (no dropdown), and stops the
 * shared animation timer when the hall is off screen. Optional RH_COMPARE=1 also times the previous hall. */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert'), cp = require('child_process');
function chromium() {
  const tries = [process.env.PW, '/tmp/pw/node_modules/playwright-core', '/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core', 'playwright-core', 'playwright'];
  for (const p of tries) { if (!p) continue; try { return require(p).chromium; } catch (e) {} }
  throw new Error('playwright-core not found');
}
const OLD = cp.execFileSync('git', ['show', 'origin/main:js/v2-rare-hall.js'], { encoding: 'utf8', cwd: path.join(__dirname, '..') });
const NEW = fs.readFileSync(path.join(__dirname, '../js/v2-rare-hall.js'), 'utf8');
const HTML = '<!doctype html><html><head><meta charset="utf-8"></head><body><section id="rareHall"></section></body></html>';
function pets(nRare) {
  const kinds = ['god', 'djpepe', 'wizard', 'kek', 'tiny', 'giant', 'ghost', 'inverted', 'backwards', 'two-headed', 'wrong-egg'];
  const legend = { god: 1, djpepe: 1, wizard: 1, kek: 1 };
  const list = [];
  for (let i = 0; i < 4000; i++) list.push({ id: i + 1, name: 'N', species: 'pepe', stage: 1, art: {}, hatchBlock: 1 });
  for (let i = 0; i < nRare; i++) {
    const kind = kinds[i % kinds.length], id = 50000 + i;
    const info = { kind: kind, legend: !!legend[kind], god: kind === 'god', block: 974962 + (i % 7), name: kind };
    list.push({ id: id, name: 'Rare' + i, species: 'pepe', stage: 1, dead: i === 0, art: { rareHatch: info }, rareHatch: info, hatchBlock: info.block });
  }
  return list;
}
async function boot(browser, width, height, src, opts) {
  const page = await browser.newPage({ viewport: { width: width, height: height } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.setContent(HTML);
  const work = opts.work || 0;
  await page.evaluate(({ list, work }) => {
    window.__calls = []; window.__paints = 0; window.__worlds = 0;
    const rows = [];
    window.V2Mock = {
      state: () => window.__S, onFresh: fn => { window.__fresh = fn; },
      world: () => { window.__worlds++; return window.__W; }
    };
    window.__S = { rows: rows, verified: false };
    window.__W = { pets: list, byId: {}, pending: false };
    list.forEach(p => { window.__W.byId[p.id] = p; });
    window.V2Rules = { speciesLabel: s => s };
    window.V2Render = {
      rareInfo: p => (p.rareHatch && p.rareHatch.version !== 0 ? p.rareHatch : null),
      rareChip: () => '<span class="rare-badge">badge</span>',
      frKey: p => p.id + ':' + (p.rareHatch && p.rareHatch.kind),
      petFrames: p => { window.__calls.push(performance.now()); const t = performance.now(); while (work && performance.now() - t < work) {} const d = new Uint8ClampedArray(4096); d[0] = 9; return [0, 1, 2, 3].map(() => ({ width: 32, height: 32, data: d })); },
      /* same 12ms slices the live lazy() queue uses, so the previous hall's per-canvas draws are timed fairly */
      lazy: (c, make) => { const run = () => { if (c.isConnected !== false) make(); }; (window.__lq = window.__lq || []).push(run); const drain = () => { window.__lt = 0; const t0 = Date.now(); while (window.__lq.length) { window.__lq.shift()(); if (Date.now() - t0 > 12) break; } if (window.__lq.length) window.__lt = setTimeout(drain, 0); }; if (!window.__lt) drain(); },
      paint: (cv, img) => { window.__paints++; if (!img || !img.data) return; cv.getContext('2d').putImageData(new ImageData(img.data, 32, 32), 0, 0); }
    };
  }, { list: pets(opts.n || 40), work: work });
  if (opts.rate) { const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: opts.rate }); }
  if (opts.ready) await page.evaluate(() => {
    window.__S = { rows: [{ tx_hash: 'a', block_index: 1 }], verified: true };
    window.__long = []; window.__lat = []; window.__t0 = performance.now();
    try { new PerformanceObserver(list => { list.getEntries().forEach(e => window.__long.push(e.duration)); }).observe({ entryTypes: ['longtask'] }); } catch (e) {}
    (function sample() { const a = performance.now(); setTimeout(() => { window.__lat.push(performance.now() - a); if (performance.now() - window.__t0 < 1200) sample(); }, 0); })();
  });
  const tScript = Date.now();
  await page.addScriptTag({ content: src });
  return { page, errors, tScript };
}
(async () => {
  const browser = await chromium().launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  let n = 0;
  const ok = c => { assert(c); n++; };
  try {
    for (const [w, h, pageN] of [[1280, 800, 16], [390, 844, 8]]) {
      const { page, errors } = await boot(browser, w, h, NEW, { n: 120, work: 0 });
      await page.waitForTimeout(700);
      const early = await page.evaluate(() => window.__worlds);
      ok(early === 0); /* rows were empty: no main-thread world() */
      await page.evaluate(() => { window.__S = { rows: [{ tx_hash: 'a', block_index: 1 }], verified: true }; });
      await page.waitForFunction(() => document.querySelectorAll('#rhGrid .rh-card').length > 0, null, { timeout: 4000 });
      const first = await page.evaluate(() => ({
        cards: document.querySelectorAll('#rhGrid .rh-card').length,
        more: !!document.querySelector('.rh-more'),
        selects: document.querySelectorAll('#rareHall select, #rareHall xc-select').length,
        worlds: window.__worlds,
        href: document.querySelector('.rh-card').getAttribute('href'),
        dead: /Pet Cemetery/.test(document.querySelector('.rh-card').textContent),
        badge: !!document.querySelector('.rh-card .rare-badge')
      }));
      ok(first.cards === pageN);
      ok(first.more);
      ok(first.selects === 0);
      ok(first.worlds >= 1);
      ok(/^pet\.html\?id=\d+$/.test(first.href));
      ok(first.dead && first.badge);
      ok(errors.length === 0);
      /* scroll until every find is mounted; sprites stay cached */
      const all = await page.evaluate(async () => {
        for (let i = 0; i < 30 && document.querySelectorAll('.rh-card').length < 120; i++) {
          const m = document.querySelector('.rh-more'); if (m) m.scrollIntoView(); else window.scrollTo(0, document.body.scrollHeight);
          await new Promise(r => setTimeout(r, 80));
        }
        const hrefs = Array.prototype.map.call(document.querySelectorAll('.rh-card'), a => a.getAttribute('href'));
        return { cards: hrefs.length, uniq: new Set(hrefs).size, bad: hrefs.filter(h => !/^pet\.html\?id=\d+$/.test(h)).length };
      });
      ok(all.cards === 120 && all.uniq === 120 && all.bad === 0);
      const filters = await page.evaluate(() => {
        const before = window.__calls.length;
        document.querySelector('[data-rh="legend"]').click();
        const legend = document.querySelectorAll('.rh-card').length;
        const legendN = document.querySelector('[data-c="legend"]').textContent;
        const pressed = document.querySelector('[data-rh="legend"]').getAttribute('aria-pressed');
        document.querySelector('[data-rh="weird"]').click();
        const weird = document.querySelectorAll('.rh-card').length;
        document.querySelector('[data-rh="all"]').click();
        return { before: before, after: window.__calls.length, legend: legend, legendN: legendN, pressed: pressed, weird: weird, all: document.querySelectorAll('.rh-card').length, dropdown: document.querySelectorAll('#rareHall select').length };
      });
      ok(filters.after === filters.before); /* cached sprites: a filter flip does not render again */
      ok(filters.pressed === 'true' && filters.legendN === '(44)' && filters.legend > 0 && filters.legend <= pageN);
      ok(filters.weird > 0 && filters.weird <= pageN && filters.dropdown === 0);
      ok(filters.all > 0 && filters.all <= pageN);
      /* one shared timer advances visible sprites, then stops when the hall is off screen */
      const anim = await page.evaluate(async () => {
        window.scrollTo(0, 0);
        const a = window.__paints;
        await new Promise(r => setTimeout(r, 750));
        const ran = window.__paints - a;
        document.getElementById('rareHall').style.cssText = 'position:absolute;top:-8000px;left:0';
        await new Promise(r => setTimeout(r, 400));
        const b = window.__paints;
        await new Promise(r => setTimeout(r, 800));
        return { ran: ran, after: window.__paints - b };
      });
      ok(anim.ran > 0 && anim.after === 0);
      await page.close();
    }
    /* one-at-a-time sprite work: a 12ms render must not be packed into one long task */
    const paced = await (async () => {
      const { page } = await boot(browser, 1280, 800, NEW, { n: 20, work: 12 });
      await page.evaluate(() => { window.__S = { rows: [{ tx_hash: 'a', block_index: 1 }], verified: true }; window.__long = [];
        new PerformanceObserver(list => { list.getEntries().forEach(e => window.__long.push(e.duration)); }).observe({ entryTypes: ['longtask'] }); });
      await page.waitForFunction(() => window.__calls.length >= 8, null, { timeout: 5000 });
      await page.waitForTimeout(400);
      const r = await page.evaluate(() => {
        const t = window.__calls, gaps = [];
        for (let i = 1; i < t.length; i++) gaps.push(t[i] - t[i - 1]);
        return { n: t.length, minGap: gaps.length ? Math.min.apply(null, gaps) : 0, longMax: window.__long.reduce((m, x) => Math.max(m, x), 0), cards: document.querySelectorAll('.rh-card').length };
      });
      await page.close();
      return r;
    })();
    ok(paced.n >= 8 && paced.n <= 16);
    ok(paced.minGap >= 10);
    ok(paced.longMax < 80);
    if (process.env.RH_COMPARE) {
      for (const [label, src] of [['before', OLD], ['after', NEW]]) {
        for (const [w, h, rate] of [[1280, 800, 4], [390, 844, 6]]) {
          const { page, tScript } = await boot(browser, w, h, src, { n: 48, work: 18, ready: true, rate: rate });
          await page.waitForFunction(() => document.querySelectorAll('.rh-card').length > 0, null, { timeout: 8000 });
          const cardsAt = Date.now() - tScript;
          await page.waitForFunction(() => {
            window.__idle = window.__idle || { n: -1, at: 0 };
            const n = window.__calls.length;
            if (n !== window.__idle.n) { window.__idle = { n: n, at: Date.now() }; return false; }
            return Date.now() - window.__idle.at > 250 && n > 0;
          }, null, { timeout: 15000 });
          const doneAt = Date.now() - tScript;
          const snap = await page.evaluate(() => ({
            calls: window.__calls.length, cards: document.querySelectorAll('.rh-card').length,
            latMax: window.__lat.reduce((m, x) => Math.max(m, x), 0), latAvg: window.__lat.length ? window.__lat.reduce((m, x) => m + x, 0) / window.__lat.length : 0,
            longMax: (window.__long || []).reduce((m, x) => Math.max(m, x), 0), longSum: (window.__long || []).reduce((m, x) => m + x, 0), longN: (window.__long || []).length
          }));
          const click = await page.evaluate(() => {
            const a = performance.now(), calls = window.__calls.length;
            document.querySelector('[data-rh="legend"]').click();
            return { ms: performance.now() - a, cards: document.querySelectorAll('.rh-card').length, newCalls: window.__calls.length - calls };
          });
          console.log(JSON.stringify({ label: label, w: w, rate: rate, cardsAt: cardsAt, idleAt: doneAt, calls: snap.calls, cards: snap.cards, latMax: Math.round(snap.latMax), latAvg: Math.round(snap.latAvg), longMax: Math.round(snap.longMax), longSum: Math.round(snap.longSum), longN: snap.longN, filterMs: Math.round(click.ms), filterNewSprites: click.newCalls, legendCards: click.cards }));
          await page.close();
        }
      }
    }
    console.log('PASS ' + n + ' rare hall paging, cache, button and off-screen checks');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
