// mypets-show-all preview (part 1 only): every pet listed by default, 'Never fed only' optional filter off by default.
// node previews/mypets-show-all/shot.js with a static server on 127.0.0.1:8869; live chain reads aborted; view-only big wallet.
// 'owner-like' = same wallet with ~1,900 pets discarded in localStorage so ~550 stay (Mythics + 414 never-fed Hatchlings), like the owner's browser.
const puppeteer = require('/workspace/xcpets/node_modules/puppeteer-core'), fs = require('fs');
const OUT = __dirname, ADDR = 'bc1ps9av86ymmlzy9zj3a8pn6g94pz4j5e0kagv3td3wutaagfjvekjs26m3s4', base = 'http://127.0.0.1:8869/play.html?addr=' + ADDR;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const peepo = pg => pg.evaluate(() => { const g = [...document.querySelectorAll('button')].find(b => b.offsetParent && /^Got it$/.test(b.textContent.trim())); if (g) g.click(); });
const clipAt = async (pg, sel, path) => { const y = await pg.evaluate(sel => { const e = document.querySelector(sel); return e ? Math.max(0, scrollY + e.getBoundingClientRect().top - 70) : 0; }, sel);
  await pg.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), y); await sleep(1500); await peepo(pg); /* lazy sprites draw only near the viewport */
  const v = pg.viewport(); await pg.screenshot({ path, clip: { x: 0, y, width: v.width, height: v.height }, captureBeyondViewport: true }); };
const info = pg => pg.evaluate(() => { const cards = [...document.querySelectorAll('#pets .pet.card')];
  return { pager: document.getElementById('petPager').textContent, filter: (document.getElementById('nfGroup') || {}).textContent || null, filterOn: (document.getElementById('nfOnly') || {}).getAttribute ? document.getElementById('nfOnly').getAttribute('aria-pressed') : null,
    cards: cards.length, mythicOnScreen: cards.filter(d => /Mythic/.test(d.querySelector('.chip.stg') ? d.querySelector('.chip.stg').textContent : '')).length,
    hungryOnScreen: cards.filter(d => /Hungry · meal/.test(d.textContent)).length, more: (document.getElementById('petMore') || {}).textContent || null,
    oldFold: !!document.querySelector('details#nfGroup'), badWords: /price|×|\bx\b/i.test((document.getElementById('nfGroup') || {}).textContent || '') }; });
(async () => { const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] }); const res = [];
  for (const w of [1280, 390]) { const pg = await b.newPage(); await pg.setViewport({ width: w, height: w > 500 ? 900 : 844, deviceScaleFactor: w > 500 ? 1 : 2, isMobile: w < 500, hasTouch: w < 500 });
    const errs = []; pg.on('pageerror', e => errs.push('PAGEERR ' + e.message));
    await pg.setRequestInterception(true); pg.on('request', r => { if (/api\.xcp\.fun|:4000\//.test(r.url())) r.abort(); else r.continue(); });
    const ready = async () => { await pg.waitForFunction(() => document.querySelectorAll('#pets .pet.card').length > 10, { timeout: 240000 }).catch(() => errs.push('TIMEOUT')); await sleep(2500); await peepo(pg); await sleep(400); };
    await pg.goto(base, { waitUntil: 'domcontentloaded', timeout: 90000 }); await ready();
    await clipAt(pg, '#nfGroup', `${OUT}/mypets-${w}.png`); const def = await info(pg);
    await pg.evaluate(() => document.getElementById('nfOnly').click()); await sleep(2000); await clipAt(pg, '#nfGroup', `${OUT}/mypets-neverfed-only-${w}.png`); const on = await info(pg);
    await pg.evaluate(() => document.getElementById('nfOnly').click()); await sleep(2000); const off = await info(pg);
    await pg.evaluate(addr => { const wd = V2UI.world(), mine = wd.pets.filter(p => p.owner === addr && !p.dead && !p.released), myth = p => p.stage === 5 || p.mythicCare;
      const keep = new Set(mine.filter(myth).map(p => p.id).concat(mine.filter(p => !myth(p) && p.lastFed == null).slice(0, 414).map(p => p.id)));
      localStorage.setItem('xcpets-hidden-mainnet-' + addr, JSON.stringify(mine.filter(p => !keep.has(p.id)).map(p => p.id))); }, ADDR);
    await pg.reload({ waitUntil: 'domcontentloaded' }); await ready();
    await clipAt(pg, '#nfGroup', `${OUT}/owner-like-${w}.png`); const own = await info(pg);
    await pg.evaluate(() => localStorage.clear());
    res.push({ w, default: def, neverFedOnly: on, backOff: off, ownerLike: own, errs }); await pg.close(); }
  await b.close(); fs.writeFileSync(OUT + '/check.json', JSON.stringify(res, null, 1)); console.log(JSON.stringify(res, null, 1)); })();
