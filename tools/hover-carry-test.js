#!/usr/bin/env node
/* Passes-down card (Gooby's hover): a pet's stored breed-carry floors sit beside that stat.
 * Display only. Hidden-trait carriers stay off the card, the same as the full card.
 *   node tools/hover-carry-test.js
 * Screenshots (optional): HOVER_SHOTS=/opt/cursor/artifacts node tools/hover-carry-test.js
 */
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const SHOTS = process.env.HOVER_SHOTS || '';

/* Live world at tip 975381 (node.xcpets.fun snapshot). Names of the source pets are the ones the full card links. */
const SRC = {
  12404: { id: 12404, name: 'Ruwa', species: 'dodo' },
  68318: { id: 68318, name: 'Misoobe', species: 'dodo' },
  11144: { id: 11144, name: 'Chiboto', species: 'snibby' },
  3226: { id: 3226, name: 'Nene', species: 'wojak' }
};
function pet(o) { return Object.assign({ tier: 3, stage: 5, stageName: 'Mythic', breedsV2: 2, lastBreed: 974000, stats: { vigor: 10, spark: 10, grit: 10, zoom: 10, luck: 10 }, art: { pattern: 'galaxy', eyes: 'classic' } }, o); }
const BOWANE = pet({ id: 20221, name: 'Bowane', species: 'dodo', lastBreed: 974045, stats: { vigor: 21, spark: 30, grit: 19, zoom: 30, luck: 28 }, art: { pattern: 'galaxy', eyes: 'classic' },
  carried: [{ from: 12404, species: 'dodo', stat: 'grit', value: 30 }, { from: 68318, species: 'dodo', stat: 'luck', value: 32 }] });
const TIKPIP = pet({ id: 21254, name: 'Tikpip', species: 'dodo', lastBreed: 974641, stats: { vigor: 13, spark: 30, grit: 26, zoom: 30, luck: 16 }, art: { pattern: 'checker', eyes: 'tinted' },
  carried: [{ from: 11144, species: 'snibby', stat: 'luck', value: 30 }, { from: 3226, species: 'wojak', stat: 'vigor', value: 30 }] });
const ZORI = pet({ id: 19975, name: 'Zori', species: 'sarutobi', lastBreed: 974165, stats: { vigor: 17, spark: 30, grit: 14, zoom: 26, luck: 25 }, art: { pattern: 'twotone', eyes: 'classic' }, carried: null,
  hidden: 'socks' }); /* a hidden Shadow socks carrier: the full card keeps that secret, and this card must too */
const W = { tip: 975381, byId: Object.assign({ 20221: BOWANE, 21254: TIKPIP, 19975: ZORI }, SRC) };

function shell() {
  return `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;background:#140f1c}body{font-family:"Comic Sans MS","Chalkboard SE",system-ui,sans-serif;font-weight:700}
.board{display:flex;flex-wrap:wrap;gap:18px;justify-content:center;padding:16px}
.col{width:min(320px,100%)} .col h2{margin:0 0 6px;text-align:center;font:8px/1.4 "Press Start 2P",monospace;color:#ff8fb1}
.hc{display:block!important;position:relative!important;left:auto!important;top:auto!important;animation:none!important}
</style></head><body><div class="board" id="board"></div></body></html>`;
}

const PAINT = function (pets) {
  const board = document.getElementById('board');
  board.innerHTML = '';
  pets.forEach(function (p) {
    const col = document.createElement('div'); col.className = 'col'; col.id = 'col-' + p.id;
    const h = document.createElement('h2'); h.textContent = '#' + p.id + ' ' + p.name;
    const card = document.createElement('div'); card.className = 'hc hc-breed'; card.id = 'card-' + p.id;
    card.innerHTML = '<button type="button" class="hc-x" aria-label="Close">✕</button>' + V2HoverCard.breedHtml(window.__W, p) + '<button type="button" class="hc-full">🔎 Full card</button>';
    const frame = document.createElement('div'); frame.id = 'frame-' + p.id; frame.style.cssText = 'display:inline-block;padding:8px;background:#140f1c';
    frame.appendChild(card); col.appendChild(h); col.appendChild(frame); board.appendChild(col);
  });
};

async function boot(browser, src) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 1600, deviceScaleFactor: 2 });
  await page.setContent(shell(), { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ content: src });
  await page.evaluate(function (w) { window.__W = w; window.V2Rules = { BREED_COOLDOWN: 1008, breedable: function () { return null; }, breedsLeft: function (p) { return { on: true, left: 6 - (p.breedsV2 || 0), cap: 6 }; }, speciesLabel: function (id) { return ({ dodo: 'Dodo', wojak: 'Wojak', snibby: 'Snibby', sarutobi: 'Sarutobi', kek: 'Lord Kek' })[id] || id; }, isHybrid: function (s) { return /^hyb/.test(String(s)); } };
    window.PetCore = { PATTERNS: [{ id: 'galaxy', label: 'Galaxy' }, { id: 'twotone', label: 'Two-tone' }, { id: 'checker', label: 'Checker' }], EYES: [{ id: 'classic', label: 'Classic' }, { id: 'tinted', label: 'Tinted' }] }; }, W);
  await page.evaluate(function () { return document.fonts ? document.fonts.ready : null; });
  return page;
}

function textOf(html) { return String(html).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); }

(async () => {
  const puppeteer = require('puppeteer-core');
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', protocolTimeout: 60000, args: ['--no-sandbox', '--font-render-hinting=none'] });
  const neu = fs.readFileSync(path.join(ROOT, 'js/v2-hovercard.js'), 'utf8');
  const baseRef = ['origin/main', 'main'].find(r => { try { cp.execSync('git rev-parse --verify ' + r, { cwd: ROOT, stdio: 'ignore' }); return true; } catch (e) { return false; } }) || 'origin/main';
  const old = cp.execSync('git show ' + baseRef + ':js/v2-hovercard.js', { cwd: ROOT, maxBuffer: 8e6 }).toString();
  ok(!/js\/v2-rules\.js|rjs\/pet-core\.js|rjs\/game-core\.js|rjs\/real-core\.js|rjs\/burn-core\.js|rjs\/config\.js|js\/pet-core\.js/.test(cp.execSync('git diff --name-only ' + baseRef, { cwd: ROOT }).toString()), 'rule files are not in the diff');
  const addedHere = old.indexOf('carryBeside') < 0;
  ok(neu.indexOf('carryBeside') > 0, addedHere ? 'carry note is new display code' : 'carry note is in the hover card (already on ' + baseRef + ')');
  const page = await boot(browser, neu);
  const oldPage = await boot(browser, old);
  const ids = [BOWANE, TIKPIP, ZORI];
  await page.evaluate(PAINT, ids);
  await oldPage.evaluate(PAINT, ids);
  const cards = await page.evaluate(function () {
    const o = {}; document.querySelectorAll('.hc').forEach(function (el) { o[el.id] = { html: el.innerHTML, text: el.innerText, overflow: el.scrollWidth > el.clientWidth + 1, w: el.clientWidth }; }); return o;
  });
  const before = await oldPage.evaluate(function () {
    const o = {}; document.querySelectorAll('.hc').forEach(function (el) { o[el.id] = el.innerText; }); return o;
  });
  const fight = await page.evaluate(function () { return V2HoverCard.fightHtml(window.__W, window.__W.byId[20221]); });
  const b = cards['card-20221'], t = cards['card-21254'], z = cards['card-19975'];
  ok(b.text.indexOf('gri 19') >= 0 && b.text.indexOf('luc 28') >= 0, 'Bowane still shows its own grit and luck');
  ok(b.text.indexOf('carries Dodo traits from Ruwa #12404, floor 30') >= 0, 'Bowane grit floor sits on the card');
  ok(b.text.indexOf('carries Dodo traits from Misoobe #68318, floor 32') >= 0, 'Bowane luck floor sits on the card');
  ok(b.html.indexOf('GRIT 30 floor for its future children') >= 0 && b.html.indexOf('LUCK 32 floor for its future children') >= 0, 'title uses the full-card sentence');
  ok(b.text.indexOf('Galaxy') >= 0 && b.text.indexOf('Classic eyes') >= 0 && b.text.indexOf('hybrid keeps best spark 30') >= 0, 'Bowane traits line and best-spark note unchanged');
  ok(b.text.indexOf('4 / 6') >= 0 && b.text.indexOf('ready') >= 0, 'Bowane breeds left and cooldown unchanged');
  function beside(html, stat, note) { return new RegExp(stat + '</i> <i class="hc-car"[^>]*>\\(' + note + ', <span class="hc-floor">floor').test(html); }
  ok(beside(b.html, 'gri 19', 'carries Dodo traits from Ruwa #12404'), 'Bowane grit floor sits beside gri 19');
  ok(beside(b.html, 'luc 28', 'carries Dodo traits from Misoobe #68318'), 'Bowane luck floor sits beside luc 28');
  ok(b.text.indexOf('vig 21') < b.text.indexOf('gri 19') && b.text.indexOf('gri 19') < b.text.indexOf('luc 28'), 'the five stats stay in order on the line');
  ok(beside(t.html, 'vig 13', 'carries Wojak traits from Nene #3226'), 'Tikpip vigor floor uses the Wojak trait name');
  ok(beside(t.html, 'luc 16', 'carries Snibby traits from Chiboto #11144'), 'Tikpip luck floor uses the Snibby trait name');
  ok(z.text.indexOf('carries') < 0 && z.html.indexOf('hc-car') < 0 && z.text.indexOf('Shadow socks') < 0 && z.text.indexOf('socks') < 0, 'a pet with no stat carry and a hidden trait adds no clutter');
  ok(textOf(z.text).indexOf('vig 17') >= 0 && z.text.indexOf('Two-tone') >= 0, 'Zori stats and traits still show');
  ok(before['card-19975'] === z.text, 'Zori card text matches the previous card');
  ok(before['card-20221'].indexOf('gri 19') >= 0 && (addedHere ? before['card-20221'].indexOf('carries') < 0 : before['card-20221'].indexOf('carries') >= 0), addedHere ? 'previous Bowane card had the stats and no carry note' : 'origin/main Bowane card already shows the stats and the carry note');
  ok(fight.indexOf('carries') < 0 && fight.indexOf('hc-car') < 0, 'the fight hover does not grow a carry note');
  ok(!b.overflow && !t.overflow && !z.overflow, 'cards do not overflow sideways (' + [b.w, t.w, z.w].join(',') + ')');
  const bare = await page.evaluate(function () {
    const p = { id: 1, name: 'Bare', species: 'dodo', tier: 3, stageName: 'Adult', stats: { vigor: 1, spark: 2, grit: 3, zoom: 4, luck: 5 }, art: {}, carried: [{ species: 'dodo', stat: 'spark', value: 9 }, { stat: 'spark', value: 8 }, { stat: 'nope', value: 4 }] };
    return V2HoverCard.breedHtml({ tip: 975381, byId: {} }, p);
  });
  ok(bare.indexOf('carries Dodo traits') >= 0 && bare.indexOf('floor 9') >= 0 && bare.indexOf('floor 8') >= 0 && bare.indexOf('from #') < 0 && bare.indexOf('undefined') < 0, 'a carry with no source pet still names the trait and the floor');
  ok(bare.indexOf('nope') < 0, 'a carry for an unknown stat is not invented onto the line');
  if (SHOTS) {
    fs.mkdirSync(SHOTS, { recursive: true });
    async function shotOne(src, pet, file, width) {
      const pg = await boot(browser, src);
      await pg.setViewport({ width: width || 420, height: 1000, deviceScaleFactor: 2 });
      await pg.evaluate(PAINT, [pet]);
      const info = await pg.evaluate(function (id) { const el = document.getElementById('card-' + id); return { overflow: el.scrollWidth > el.clientWidth + 1, w: el.clientWidth, text: el.innerText }; }, pet.id);
      const el = await pg.$('#frame-' + pet.id);
      fs.writeFileSync(path.join(SHOTS, file), await el.screenshot({ type: 'png' }));
      await pg.close();
      console.log('wrote', file, info.w);
      return info;
    }
    await shotOne(old, BOWANE, 'bowane-passes-down-before.png');
    await shotOne(neu, BOWANE, 'bowane-passes-down-after.png');
    await shotOne(old, TIKPIP, 'tikpip-passes-down-before.png');
    await shotOne(neu, TIKPIP, 'tikpip-passes-down-after.png');
    await shotOne(old, ZORI, 'zori-passes-down-before.png');
    await shotOne(neu, ZORI, 'zori-passes-down-after.png');
    const phone = await shotOne(neu, BOWANE, 'bowane-passes-down-after-phone.png', 390);
    ok(!phone.overflow && phone.w <= 390 && phone.text.indexOf('floor 30') >= 0 && phone.text.indexOf('floor 32') >= 0, 'Bowane card fits a phone width (' + phone.w + 'px)');
    const narrow = await shotOne(neu, BOWANE, 'bowane-passes-down-after-narrow.png', 320);
    ok(!narrow.overflow && narrow.w <= 320 && narrow.text.indexOf('floor') >= 0, 'Bowane card fits a 320px screen (' + narrow.w + 'px)');
  }
  await browser.close();
  console.log('hover-carry-test: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.error(e.stack || e); process.exit(2); });
