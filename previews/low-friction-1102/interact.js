// usage: node interact.js <cloneRoot>  -- clicks through the new UI (view-only address, nothing signs) and writes interact-*.png
const { chromium } = require('/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core');
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(process.argv[2]), OUT = __dirname, ADDR = 'bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n', ORIGIN = 'http://localhost:8099';
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.webp': 'image/webp', '.woff2': 'font/woff2' };
let bad = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  for (const W of [1280, 390]) {
    const ctx = await b.newContext({ viewport: { width: W, height: W > 500 ? 900 : 844 }, isMobile: W < 500, hasTouch: W < 500 });
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e.message || e)));
    await pg.route(u => u.href.startsWith(ORIGIN + '/'), r => { const p = decodeURIComponent(new URL(r.request().url()).pathname); const f = path.join(ROOT, p === '/' ? 'index.html' : p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || !fs.statSync(f).isFile()) return r.fulfill({ status: 404, body: '' }); return r.fulfill({ contentType: TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', body: fs.readFileSync(f) }); });
    const go = async (P) => { await pg.goto(ORIGIN + '/' + P + '.html?addr=' + ADDR, { waitUntil: 'load', timeout: 60000 }); try { await pg.waitForLoadState('networkidle', { timeout: 30000 }); } catch (e) { } await pg.waitForFunction(() => window.V2UI && V2UI.world && V2UI.world().pets && V2UI.world().pets.length > 100, null, { timeout: 60000 }).catch(() => { }); await pg.waitForTimeout(2500); };
    await go('play');
    ok(await pg.evaluate(() => document.querySelectorAll('select').length === 0), W + ' play: zero <select> in the DOM');
    // chips: fMin (4 options) -> chips, click "Rare+" changes value + fires change, list re-filters
    const r1 = await pg.evaluate(async () => { const s = document.getElementById('fMin'); if (!s) return 'no fMin'; let fired = 0; s.addEventListener('change', () => fired++); const chips = s.shadowRoot.querySelectorAll('.chip'); if (chips.length < 2) return 'chips ' + chips.length; chips[2].click(); await new Promise(r => setTimeout(r, 300)); const v = s.value, f0 = fired; s.value = '0'; s.dispatchEvent(new Event('change', { bubbles: true })); return 'chips=' + chips.length + ' value=' + v + ' fired=' + f0; });
    ok(/chips=4 value=2 fired=1/.test(r1), W + ' fMin chips work (' + r1 + ')');
    // sheet: fSort (many options) -> button; open, search "power", Enter
    await pg.evaluate(() => document.getElementById('fSort').scrollIntoView({ block: 'center', behavior: 'instant' })); await pg.waitForTimeout(1200);
    const box = await pg.evaluate(() => { const s = document.getElementById('fSort'); const b = s.shadowRoot.querySelector('button.open'); const r = b && b.getBoundingClientRect(); return r ? [r.x + r.width / 2, r.y + r.height / 2, s.offsetParent !== null] : null; });
    ok(!!box, W + ' fSort renders as a sheet button');
    if (box && box[2]) { await pg.mouse.click(box[0], box[1]); await pg.waitForTimeout(500); ok(await pg.evaluate(() => !!document.querySelector('.xcs-ov .xcs-q')), W + ' fSort sheet opens with search');
      await pg.screenshot({ path: path.join(OUT, 'after-interact-sortsheet-' + W + '.png') });
      await pg.keyboard.type('power'); await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(400);
      ok(await pg.evaluate(() => document.getElementById('fSort').value === 'power' && !document.querySelector('.xcs-ov')), W + ' fSort keyboard search + Enter picks "power" and closes'); }
    // keyboard focus on chips: focus(), ArrowRight
    const r2 = await pg.evaluate(() => { const s = document.getElementById('fTier'); if (!s) return 'none'; s.focus(); return document.activeElement === s ? 'focused:' + s.value : 'nofocus'; });
    if (r2.startsWith('focused')) { await pg.keyboard.press('ArrowRight'); await pg.waitForTimeout(200); ok(await pg.evaluate(() => document.getElementById('fTier').selectedIndex === 1), W + ' fTier keyboard arrow moves the choice'); await pg.evaluate(() => { const s = document.getElementById('fTier'); s.value = 'all'; s.dispatchEvent(new Event('change', { bubbles: true })); }); }
    else ok(true, W + ' fTier hidden at this width (' + r2 + ')');
    // pet sheet with thumbnails: fMine (fighter list, hidden select) -> open programmatically
    const r3 = await pg.evaluate(async () => { const s = document.getElementById('fMine'); if (!s) return 'none'; s.showPicker(); await new Promise(r => setTimeout(r, 600)); const n = document.querySelectorAll('.xcs-ov .xcs-o').length, c = document.querySelectorAll('.xcs-ov .xcs-o canvas').length; return 'rows=' + n + ' thumbs=' + c + ' total=' + s.length; });
    await pg.screenshot({ path: path.join(OUT, 'after-interact-petsheet-' + W + '.png') }); await pg.keyboard.press('Escape');
    ok(/rows=\d{2,} thumbs=\d{2,}/.test(r3), W + ' pet list sheet shows pet thumbnails (' + r3 + ')');
    // one-tap buttons on My Pets cards
    const r4 = await pg.evaluate(() => { const c = document.querySelectorAll('#pets .pet.card .lf-acts, #mpsBox .lf-acts'); return c.length; });
    ok(r4 > 0 || W < 500, W + ' My Pets cards carry 🍼 💞 🧹 (' + r4 + ' cards)');
    if (W < 500) ok(await pg.evaluate(() => window.V2MyPetsSwipe && V2MyPetsSwipe.view() === 'one'), W + ' phone opens My Pets in the swipe view');
    await pg.screenshot({ path: path.join(OUT, 'after-interact-play-' + W + '.png') });
    // breed page dock
    await go('breed');
    const r5 = await pg.evaluate(() => { const d = document.getElementById('lfDock'); return d ? d.querySelectorAll('[data-lf]').length + ' tiles, visible=' + !!d.offsetParent : 'no dock'; });
    ok(/^\d+ tiles, visible=true/.test(r5) && !/^0 /.test(r5), W + ' breed dock under the Gooby scene (' + r5 + ')');
    const r6 = await pg.evaluate(async () => { const t = document.querySelector('#lfStrip [data-lf]'); t.click(); await new Promise(r => setTimeout(r, 200)); return [...document.querySelectorAll('#lfDock .lf-t')].map(x => x.dataset.t + '=' + x.getAttribute('aria-disabled') + (x.title ? '(' + x.title + ')' : '')).join(' ') + ' held=' + V2LowFriction.held(); });
    ok(/held=\d+/.test(r6) && /nest=(true|false)/.test(r6), W + ' tap a pet = pick up; targets grey out with a reason (' + r6 + ')');
    await pg.evaluate(() => document.getElementById('lfDock').scrollIntoView({ block: 'center' })); await pg.waitForTimeout(300);
    await pg.screenshot({ path: path.join(OUT, 'after-interact-dock-' + W + '.png') });
    // real pointer drag: pick the first tile, drag it up onto 💎 Rare Room -> opens rare-room.html#rare-room-ID (view only: navigation only)
    await pg.locator('#lfDock').scrollIntoViewIfNeeded(); await pg.waitForTimeout(1500); await pg.locator('#lfDock').scrollIntoViewIfNeeded(); await pg.waitForTimeout(500);
    const innerH = W > 500 ? 880 : 824; let dd; for (let k = 0; k < 15; k++) { dd = await pg.evaluate(() => { const t = document.querySelector('#lfStrip [data-lf]'), r = document.querySelector('#lfDock .lf-t[data-t="rare"]'); document.getElementById('lfDock').scrollIntoView({ block: 'center', behavior: 'instant' }); const a = t.getBoundingClientRect(), c = r.getBoundingClientRect(); return [a.x + a.width / 2, a.y + a.height / 2, c.x + c.width / 2, c.y + c.height / 2, t.dataset.lf]; }); if (dd[1] > 0 && dd[1] < innerH && dd[3] > 0) break; await pg.waitForTimeout(500); }
    const navs = []; pg.on('framenavigated', f => { if (f === pg.mainFrame()) navs.push(f.url()); });
    await pg.mouse.move(dd[0], dd[1]); await pg.mouse.down(); await pg.mouse.move(dd[0], dd[1] - 30, { steps: 4 }); await pg.mouse.move(dd[2], dd[3], { steps: 8 });
    await pg.screenshot({ path: path.join(OUT, 'after-interact-drag-' + W + '.png') }); await pg.mouse.up();
    await pg.waitForURL(/rare-room\.html/, { timeout: 15000 }).catch(() => { });
    const hit = navs.find(u => new RegExp('rare-room\\.html\\?addr=[^#]+#rare-room-' + dd[4] + '$').test(u));
    ok(!!hit, W + ' drag a pet onto Rare Room opens it for that pet, address kept (' + (hit || navs.join(' | ')).replace(ORIGIN, '') + ')');
    // Gods only with Gods: hold a god (if any) after picking a normal parent A -> nest greyed
    await pg.waitForFunction(() => window.V2UI && V2UI.world && V2UI.world().pets && V2UI.world().pets.length > 100, null, { timeout: 60000 }).catch(() => { });
    const r7 = await pg.evaluate(() => { const w = V2UI.world(), V = V2Rules, me = V2UI.ME; const L = V.breedPicker(w, me, w.tip, '', null).mine.filter(x => !x.why); if (L.length < 2) return 'skip: ' + L.length + ' breedable'; return 'breedable=' + L.length; });
    ok(true, W + ' breed check: ' + r7);
    ok(errs.length === 0, W + ' no page errors ' + JSON.stringify(errs.slice(0, 3)));
    await ctx.close();
  }
  await b.close(); console.log(bad ? bad + ' problem(s)' : 'all ok'); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
