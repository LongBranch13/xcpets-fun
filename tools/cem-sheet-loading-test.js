#!/usr/bin/env node
/* The cemetery's zombie Feed / halo sheet keeps filling while a big wallet is still loading (Nov 27 2026, G Money: "I also discarded some pets
 * by burning but they don't show up in the cemetery").
 * A big wallet's pets arrive page by page (G Money: 679 owner pages, 14,952 pets discarded on chain). The cemetery's Feed button opened the
 * sheet with the pets loaded so far and it never grew: on a local copy a tap a few seconds after load listed 1,500 of the 14,952, and an
 * earlier tap lists none ("No pets in your Discard pile"). This runs the real js/v2-own.js + js/v2-cem-sacrifice.js in a browser with a
 * world that is still loading, and checks:
 *  1. the sheet says it is still loading, and the pets that arrive later are added (the "Show more" count grows, ticks are kept);
 *  2. a sheet that opened EMPTY (nothing loaded yet) turns into the full list once pets arrive;
 *  3. once loading ends the note goes away; a fully loaded world shows no note at all.
 *   node tools/cem-sheet-loading-test.js */
'use strict';
const path = require('path'), assert = require('assert');
const ROOT = path.resolve(__dirname, '..');
function chromium() { for (const p of [process.env.PW, 'playwright-core', 'playwright']) { if (!p) continue; try { return require(p).chromium; } catch (e) {} } throw new Error('playwright not found'); }
/* same browser choice as the other browser tests (hunt-picker-test.js): CI has Google Chrome, not Playwright's own download */
function launchOpts() { const fs = require('fs'), exe = process.env.CHROME || ['/usr/bin/google-chrome', '/opt/pw-browsers/chromium'].find(p => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } }); return exe ? { executablePath: exe, args: ['--no-sandbox'] } : {}; }

const FIXTURE = () => {
  const me = 'bc1qfixture', w = { tip: 977800, pets: [], byId: {}, _pages: { got: 1, pages: 10, n: 1000 } };
  /* page k = 100 pets; every pet is discarded on chain except each 10th */
  window.addPage = (k) => { for (let i = 0; i < 100; i++) { const id = k * 100 + i + 1, p = { id, owner: me, tier: id % 4, stage: 1, name: 'Pet ' + id }; if (id % 10) p.hd = me; w.pets.push(p); w.byId[id] = p; } w._pages.got = Math.max(w._pages.got, k + 1); if (w._pages.got >= w._pages.pages) w._full = true; };
  window.V2Mock = { ME: me, world: () => w };
  const V = { CEM: { POINTS: [1, 3, 10, 33], FERAL: 432 }, cemOfferWhy: (w, p, src) => (p.hd === src ? null : 'only a discarded pet can be offered'), cemCost: () => 1, cemResInfo: () => ({ points: 0, min: 25 }),
    cemPlan: (w, kind, z, ids) => ({ tag: 'pet:zf:' + z + ':' + ids.join('.'), amount: ids.length }), cemPetAmount: (w, p) => p, isZ: (p) => !!(p && p.zombie && !p.zombie.end) };
  window.sent = [];
  window.openSheet = () => V2CemSacrifice.open({ kind: 'zfeed', z: 99999, w, V, R: { lazy() {} }, ME: me, b: w.tip + 1, send: (L, t) => window.sent.push(t) });
  w.byId[99999] = { id: 99999, owner: me, name: 'Zed', zombie: { raisedAt: 1 } };
};

(async () => {
  const browser = await chromium().launch(launchOpts());
  let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
  try {
    const run = async (startPages) => {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } }), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.setContent('<html><head></head><body></body></html>');
      await page.evaluate(FIXTURE);
      await page.evaluate((n) => { for (let k = 0; k < n; k++) window.addPage(k); }, startPages);
      for (const f of ['js/v2-own.js', 'js/v2-cem-sacrifice.js']) await page.addScriptTag({ path: path.join(ROOT, f) });
      return { page, errors };
    };
    const S = (page) => page.evaluate(() => { const s = document.getElementById('cemSac'); return s ? { tiles: s.querySelectorAll('.csac-t').length, more: (s.querySelector('.csac-more') || {}).textContent || '', load: (s.querySelector('.csac-load') || {}).textContent || '', empty: !!s.querySelector('.csac-e') } : null; });
    const left = (t) => { const m = /\(([\d,]+) left\)/.exec(t || ''); return m ? Number(m[1].replace(/,/g, '')) : 0; };

    /* 1) opened while 3 of 10 pages are in */
    { const { page, errors } = await run(3);
      await page.evaluate(() => window.openSheet());
      let s = await S(page);
      ok(s && s.tiles === 240 && left(s.more) === 270 - 240, '3 pages in: 270 discarded pets listed (' + JSON.stringify(s) + ')');
      ok(/Still loading your pets \(3 of 10 pages\)/.test(s.load), 'the sheet says the pets are still loading');
      await page.click('.csac-t[data-id="2"]');
      await page.evaluate(() => { for (let k = 3; k < 7; k++) window.addPage(k); });
      await page.waitForTimeout(3000);
      s = await S(page);
      ok(left(s.more) === 630 - 240, 'pets that arrive later are added to the sheet (' + s.more + ')');
      ok(/7 of 10/.test(s.load), 'the note follows the load (' + s.load + ')');
      ok(await page.evaluate(() => document.querySelector('.csac-t[data-id="2"]').getAttribute('aria-pressed')) === 'true', 'a pet ticked before is still ticked');
      await page.evaluate(() => { for (let k = 7; k < 10; k++) window.addPage(k); });
      await page.waitForTimeout(3000);
      s = await S(page);
      ok(left(s.more) === 900 - 240 && !s.load, 'all 900 discarded pets once loading ends, and the note is gone (' + JSON.stringify(s) + ')');
      ok(!errors.length, 'no script errors (' + errors.join('; ') + ')');
      await page.close(); }

    /* 2) opened before any discarded pet is in */
    { const { page, errors } = await run(0);
      await page.evaluate(() => window.openSheet());
      let s = await S(page);
      ok(s && s.empty && /Still loading/.test(s.load), 'nothing loaded yet: the empty sheet says it is still loading, not just "no pets"');
      await page.evaluate(() => { window.addPage(0); window.addPage(1); });
      await page.waitForTimeout(3000);
      s = await S(page);
      ok(s && !s.empty && s.tiles === 180, 'the empty sheet turns into the list once pets arrive (' + JSON.stringify(s) + ')');
      ok(!errors.length, 'no script errors (' + errors.join('; ') + ')');
      await page.close(); }

    /* 3) a fully loaded world: no note */
    { const { page } = await run(10);
      await page.evaluate(() => window.openSheet());
      const s = await S(page);
      ok(s && !s.load && left(s.more) === 900 - 240, 'fully loaded: no loading note, every discarded pet listed');
      await page.close(); }
  } finally { await browser.close(); }
  console.log(fails ? fails + ' FAILED' : 'PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
