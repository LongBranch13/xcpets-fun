/* Pet Score breakdown visibility (display only). The table must stay fully on screen when the chip
 * sits in a clipped card: My Pets hover/focus transform + rounded border, the phone one-at-a-time
 * overflow:hidden stage, and the pet.html trading card. No score math here. */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
function chromium() {
  for (const p of [process.env.PLAYWRIGHT_CORE, '/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core', '/tmp/pw/node_modules/playwright-core', 'playwright-core']) {
    if (!p) continue;
    try { return require(p).chromium; } catch (e) { /* next */ }
  }
  throw new Error('playwright-core unavailable');
}
const ROOT = path.resolve(__dirname, '..');
const chrome = ['/usr/bin/google-chrome', '/opt/google/chrome/chrome'].find(p => fs.existsSync(p));
const HTML = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#0d1117">
<div id="screen" style="height:100vh;position:relative">
  <div id="mid" class="pcard pc-myth" data-tier="3" style="overflow:hidden;max-width:340px;margin:12px"><div class="pc-inner" id="midInner"></div></div>
  <div id="low" style="overflow:hidden;position:absolute;left:8px;right:8px;bottom:8px;border-radius:6px">
    <div class="pet card" id="lowCard" style="transform:translateY(-2px);text-align:right"></div>
  </div>
</div></body></html>`;
const ROWS = ['Stats', 'Looks', 'Growth', 'Gear', 'Battles', 'Scarcity'];
const FOOT = 'Display only, from the chain replay. Not the hatch tier.';

function world() {
  const pet = (id, care) => ({ id, species: id === 19549 ? 'bobo' : 'pepe', art: { eyes: 'a', pattern: 'b', background: 'c', cheeks: 'd' }, stats: { vigor: 10, spark: 8, grit: 6, zoom: 4, luck: 2 }, care, wins: 4, losses: 1, feedDays: {} });
  return { tip: 1000, pets: [pet(19549, 21000), pet(2, 100)], items: {} };
}

async function readPopup(page) {
  return page.evaluate((FOOT) => {
    const bd = document.querySelector('.psbd.on');
    if (!bd) return null;
    const chip = bd._psw && bd._psw.getBoundingClientRect();
    const box = bd.getBoundingClientRect();
    const rows = [...bd.querySelectorAll('tr')].map(tr => {
      const r = tr.getBoundingClientRect();
      const n = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
      return { text: tr.textContent.replace(/\s+/g, ' ').trim(), top: r.top, bottom: r.bottom, left: r.left, right: r.right, hit: !!(n && bd.contains(n)) };
    });
    const ft = bd.querySelector('.muted');
    const fr = ft.getBoundingClientRect();
    const fn = document.elementFromPoint((fr.left + fr.right) / 2, (fr.top + fr.bottom) / 2);
    const pad = 1;
    const inside = r => r.top >= -pad && r.left >= -pad && r.bottom <= innerHeight + pad && r.right <= innerWidth + pad;
    return {
      place: bd.getAttribute('data-ps-place'),
      onBody: bd.parentNode === document.body,
      text: bd.textContent,
      foot: ft.textContent,
      footHit: !!(fn && bd.contains(fn)),
      footIn: inside(fr),
      boxIn: inside(box),
      rows,
      chipTop: chip ? chip.top : null,
      chipBottom: chip ? chip.bottom : null,
      boxTop: box.top,
      boxBottom: box.bottom,
      boxLeft: box.left,
      boxRight: box.right
    };
  }, FOOT);
}

function assertFull(info, where) {
  assert.ok(info, where + ': popup missing');
  assert.strictEqual(info.onBody, true, where + ': popup still inside the card');
  assert.strictEqual(info.foot, FOOT, where + ': footer text');
  assert.strictEqual(info.footHit, true, where + ': footer is clipped');
  assert.strictEqual(info.footIn, true, where + ': footer outside the viewport');
  assert.strictEqual(info.boxIn, true, where + ': popup box outside the viewport');
  assert.strictEqual(info.rows.length, 6, where + ': row count');
  ROWS.forEach((name, i) => {
    assert.ok(info.rows[i].text.indexOf(name) === 0, where + ': row ' + name + ' got ' + info.rows[i].text);
    assert.strictEqual(info.rows[i].hit, true, where + ': ' + name + ' is clipped');
    assert.ok(info.rows[i].top >= -1 && info.rows[i].bottom <= info.boxBottom + 1, where + ': ' + name + ' outside the popup');
  });
  assert.ok(info.text.indexOf(FOOT) >= 0, where + ': footer missing from the table');
}

(async () => {
  const browser = await chromium().launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
  const shots = path.join(process.env.XCPETS_TEST_TMP || '/tmp', 'pet-score-popup');
  fs.mkdirSync(shots, { recursive: true });
  let checks = 0;
  try {
    for (const spec of [{ name: 'phone', width: 390, height: 780 }, { name: 'desktop', width: 1280, height: 800 }]) {
      const page = await browser.newPage({ viewport: { width: spec.width, height: spec.height } });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.setContent(HTML, { waitUntil: 'load' });
      for (const file of ['css/style.css', 'css/game.css', 'css/pet-card.css']) await page.addStyleTag({ path: path.join(ROOT, file) });
      await page.addScriptTag({ path: path.join(ROOT, 'js/pet-score.js') });
      const weights = await page.evaluate(() => PetScore.WEIGHTS);
      assert.deepStrictEqual(weights, { stats: 0.3, looks: 0.2, growth: 0.15, gear: 0.15, battles: 0.1, scarcity: 0.1 });
      checks++;
      await page.evaluate(w => {
        const html = PetScore.badge(w, w.pets[0]);
        document.getElementById('midInner').innerHTML = '<div style="height:48px">art</div>' + html + '<div style="height:18px">care</div>';
        document.getElementById('lowCard').innerHTML = '<div style="height:64px;text-align:left">Ruzu #19549</div>' + html + '<div class="bar"><i style="width:40%"></i></div><div class="small muted">care 21,000</div>';
      }, world());
      const clip = await page.evaluate(() => ({
        low: getComputedStyle(document.getElementById('low')).overflowY,
        mid: getComputedStyle(document.getElementById('mid')).overflowY,
        cardTf: getComputedStyle(document.getElementById('lowCard')).transform !== 'none',
        radius: parseFloat(getComputedStyle(document.getElementById('lowCard')).borderRadius) > 0
      }));
      assert.strictEqual(clip.low, 'hidden', 'phone stage clips overflow');
      assert.strictEqual(clip.mid, 'hidden', 'trading card clips overflow');
      assert.strictEqual(clip.cardTf, true, 'my pets card is transformed');
      assert.strictEqual(clip.radius, true, 'my pets card is rounded');
      checks++;

      await page.locator('#low .psw').click();
      const low = await readPopup(page);
      assertFull(low, spec.name + ' bottom chip');
      assert.strictEqual(low.place, 'above', spec.name + ': no room below, expected above, got ' + low.place);
      assert.ok(low.boxBottom <= low.chipTop + 1, spec.name + ': popup did not open above the chip');
      checks++;
      await page.screenshot({ path: path.join(shots, spec.name + '-above.png') });

      await page.locator('#mid .psw').click();
      const mid = await readPopup(page);
      assertFull(mid, spec.name + ' trading card');
      assert.strictEqual(mid.place, 'below', spec.name + ': room below, expected below, got ' + mid.place);
      const escaped = await page.evaluate(() => {
        const bd = document.querySelector('.psbd.on'), card = document.getElementById('mid');
        const fr = bd.querySelector('.muted').getBoundingClientRect(), cr = card.getBoundingClientRect();
        const n = document.elementFromPoint((fr.left + fr.right) / 2, (fr.top + fr.bottom) / 2);
        return { pastCard: fr.top > cr.bottom - 1, hitPopup: !!(n && bd.contains(n)), cardClips: getComputedStyle(card).overflowY !== 'visible' };
      });
      assert.strictEqual(escaped.cardClips, true);
      assert.strictEqual(escaped.pastCard, true, spec.name + ': footer still inside the clipped card');
      assert.strictEqual(escaped.hitPopup, true, spec.name + ': card edge still covers the footer');
      checks++;
      await page.screenshot({ path: path.join(shots, spec.name + '-below.png') });
      if (spec.width > 600) {
        const spot = await page.evaluate(() => {
          const bd = document.querySelector('.psbd.on');
          for (let y = 6; y < 36; y += 6) for (let x = innerWidth - 40; x < innerWidth - 6; x += 6) {
            const n = document.elementFromPoint(x, y);
            if (n && bd && !bd.contains(n) && !(n.closest && n.closest('.psw'))) return { x: x, y: y };
          }
          return null;
        });
        assert.ok(spot, 'empty spot to dismiss the popup');
        await page.mouse.click(spot.x, spot.y);
        await page.waitForFunction(() => !document.querySelector('.psbd.on'));
        await page.locator('#mid .psw').hover();
        const hovered = await readPopup(page);
        assertFull(hovered, 'desktop hover');
        assert.strictEqual(hovered.place, 'below', 'hover opens the full table below the chip');
        checks++;
      }
      assert.deepStrictEqual(errors, [], spec.name + ' page errors');
      checks++;
      await page.close();
    }
  } finally { await browser.close(); }
  console.log('pet-score-popup-test: ' + checks + ' checks pass');
})().catch(e => { console.error(e); process.exit(1); });
