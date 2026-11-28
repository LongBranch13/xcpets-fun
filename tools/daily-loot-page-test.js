#!/usr/bin/env node
/* Daily Loot page (js/v2-daily-loot.js) with the real-prize rules on: stubbed V2Rules/V2UI in a real browser (Playwright). Dev tooling only.
 *  1. before a claim, with the three ticks done, the chest opens the claim sheet; OPEN CHEST hands exactly one pet:loot plan to the confirm sheet.
 *  2. after the claim, the page waits and plays the reveal once the world shows today's claim (meals -> Pantry button, egg -> See your egg).
 *  3. with the gate off (lootOn false) the old meme-only chest is unchanged.
 *   node tools/daily-loot-page-test.js [--shots DIR] */
'use strict';
const path = require('path'), http = require('http'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..'), A = process.argv.slice(2), shots = A.indexOf('--shots') >= 0 ? A[A.indexOf('--shots') + 1] : null;
function chromium() { for (const p of [process.env.PW, 'playwright-core', 'playwright']) { if (!p) continue; try { return require(p).chromium; } catch (e) {} } throw new Error('playwright not found'); }
function launchOpts() { const exe = process.env.CHROME || ['/usr/bin/google-chrome'].find(p => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } }); return exe ? { executablePath: exe, args: ['--no-sandbox'] } : {}; }
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body data-split="play" style="background:#14142b">
<div id="today"></div><div id="pantryCard" style="margin-top:900px">pantry</div><script>
var ON = location.hash.indexOf('off') < 0, W = { tip: 978100, byId: { 9001: { id: 9001, tier: 3, species: 'pepe', owner: 'me' } } }, STATE = { claimed: false, last: null }, SENT = [];
window.V2Rules = { lootOn: function () { return ON; }, lootPlan: function () { return { tag: 'pet:loot', amount: 1e-8 }; }, TIER_LABELS: ['Common', 'Uncommon', 'Rare', 'Legendary'], speciesLabel: function (s) { return s === 'pepe' ? 'Pepe' : s; },
  pantryInfo: function () { return { ids: [] }; },
  lootInfo: function () { return STATE.claimed ? { on: true, day: 6791, claimed: true, streak: STATE.last.streak, next: null, chest: null, last: STATE.last } : { on: true, day: 6791, claimed: false, streak: 2, next: 3, chest: null, floor: true, toGold: 4, toLucky: 27 }; } };
window.V2UI = { ME: 'me', world: function () { return W; }, sendWhy: function () { return null; }, toast: function (t) { window.LASTTOAST = t; }, viewBlock: function () { return false; },
  confirmPlans: function (title, plans, after) { SENT.push(plans); setTimeout(after, 50); }, detail: function (id) { window.DETAIL = id; } };
localStorage.setItem('xcpets-loot', JSON.stringify({ day: Math.round(new Date(new Date().setHours(0,0,0,0)).getTime() / 864e5), t: { in: 1, place: 1, dex: 1 }, opened: 0, streak: 0, best: 0 }));
</script><script src="/js/v2-daily-loot.js"></script><script>document.getElementById('today').innerHTML = V2Loot.html();</script></body></html>`;
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0].split('#')[0]); if (u === '/' || u === '/t.html') { r.writeHead(200, { 'content-type': 'text/html' }); return r.end(PAGE); }
  const f = path.join(ROOT, u); if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': /\.js$/.test(f) ? 'text/javascript' : /\.json$/.test(f) ? 'application/json' : 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
(async () => {
  await new Promise(res => srv.listen(0, res)); const port = srv.address().port, br = await chromium().launch(launchOpts());
  const pg = await br.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: shots ? 2 : 1 }); const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto(`http://127.0.0.1:${port}/t.html`); await pg.waitForTimeout(300);
  ok(/OPEN CHEST/.test(await pg.textContent('#dlStrip')), 'Today strip shows OPEN CHEST once the three ticks are done');
  await pg.click('[data-loot="open"]'); await pg.waitForSelector('#dlOv [data-dl="claim"]');
  const sheet = await pg.textContent('#dlOv'); ok(/Day 3/.test(sheet) && /1 dander/.test(sheet) && /Never gear/.test(sheet), 'claim sheet: streak day, the 1 dander cost and "never gear"');
  if (shots) { await pg.waitForTimeout(600); await pg.screenshot({ path: path.join(shots, 'claim-sheet.png') }); }
  await pg.click('#dlOv [data-dl="claim"]'); await pg.waitForTimeout(200);
  const sent = await pg.evaluate(() => SENT); ok(sent.length === 1 && sent[0].length === 1 && sent[0][0].tag === 'pet:loot', 'OPEN CHEST hands exactly one pet:loot plan to the confirm sheet');
  ok(/OPENING/.test(await pg.textContent('#dlOv')), 'after signing, the chest waits for the next block');
  ok(/Rolling/.test(await pg.evaluate(() => V2Loot.html())), 'Today strip says the prize is rolling');
  await pg.evaluate(() => { STATE.claimed = true; STATE.last = { day: 6791, block: 978101, prize: 'golden', chest: null, meals: 0, credit: 0, petId: 9001, tier: 3, streak: 3 }; });
  await pg.waitForFunction(() => /GOLDEN EGG/.test((document.getElementById('dlOv') || {}).textContent || ''), null, { timeout: 8000 }); await pg.waitForTimeout(1600);
  const rv = await pg.textContent('#dlOv'); ok(/#9001/.test(rv) && /Legendary Pepe/.test(rv) && /SEE YOUR EGG/.test(rv), 'reveal: Golden Egg #9001, Legendary Pepe, See your egg');
  if (shots) await pg.screenshot({ path: path.join(shots, 'reveal-golden.png') });
  await pg.click('#dlOv [data-dl="pet"]'); ok(await pg.evaluate(() => window.DETAIL) === 9001, 'See your egg opens the pet');
  await pg.evaluate(() => { STATE.last = { day: 6791, block: 978101, prize: 'meal3', chest: 'gold', meals: 3, credit: 25.875, petId: null, tier: null, streak: 7 }; });
  await pg.click('[data-loot="open"]'); await pg.waitForTimeout(300); const rv2 = await pg.textContent('#dlOv');
  ok(/GOLD CHEST/.test(rv2) && /25.875 XCPETS/.test(rv2) && /PICK PETS/.test(rv2), 'reopening after the claim shows today’s prize (meals into the Pantry, pick pets button)');
  if (shots) await pg.screenshot({ path: path.join(shots, 'reveal-meals.png') });
  const pg2 = await br.newPage({ viewport: { width: 390, height: 844 } }); pg2.on('pageerror', e => errs.push(String(e)));
  await pg2.goto(`http://127.0.0.1:${port}/t.html#off`); await pg2.waitForTimeout(300); await pg2.click('[data-loot="open"]'); await pg2.waitForTimeout(400);
  ok(/MEME OF THE DAY/.test(await pg2.textContent('#dlOv')) && !(await pg2.evaluate(() => SENT.length)), 'gate off: the old meme-only chest, nothing to sign');
  ok(!errs.length, 'no page errors ' + errs.join(' | '));
  await br.close(); srv.close(); console.log(fails ? fails + ' FAILED' : 'daily-loot-page-test: all checks pass'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
