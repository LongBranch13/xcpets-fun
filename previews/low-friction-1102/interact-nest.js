// low-friction-1102: Nest / Bowl / one-tap checks with the wallet treated as connected (V2View.viewOnly stubbed false in the page; nothing is signed:
// every confirm window that opens is cancelled with its own Cancel button). usage: node interact-nest.js <cloneRoot>
const { chromium } = require('/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core');
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(process.argv[2]), OUT = __dirname, ADDR = 'bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n', ORIGIN = 'http://localhost:8099';
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.webp': 'image/webp', '.woff2': 'font/woff2' };
let bad = 0; const ok = (c, m) => { if (!c) bad++; console.log((c ? 'ok   ' : 'FAIL ') + m); };
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  for (const W of [1280, 390]) {
    const ctx = await b.newContext({ viewport: { width: W, height: W > 500 ? 900 : 844 }, isMobile: W < 500, hasTouch: W < 500, deviceScaleFactor: 1 });
    await ctx.addInitScript(() => { window.open = () => null; let _ca; Object.defineProperty(window, 'V2CemAnim', { configurable: true, get() { return _ca; }, set(v) { if (v && v.watch) v.watch = function () { }; _ca = v; } });
      let _vw; Object.defineProperty(window, 'V2View', { configurable: true, get() { return _vw; }, set(v) { if (v) v.viewOnly = () => false; _vw = v; } }); });
    const pg = await ctx.newPage(); const errs = [], signs = [];
    pg.on('pageerror', e => errs.push(String(e && e.message || e).slice(0, 200)));
    pg.on('dialog', d => d.dismiss().catch(() => { }));
    await pg.route(u => u.href.startsWith(ORIGIN + '/'), r => { const p = decodeURIComponent(new URL(r.request().url()).pathname); const f = path.join(ROOT, p === '/' ? 'index.html' : p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || !fs.statSync(f).isFile()) return r.fulfill({ status: 404, body: '' }); return r.fulfill({ contentType: TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', body: fs.readFileSync(f) }); });
    const go = async (P, h) => { await pg.goto(ORIGIN + '/' + P + '.html?addr=' + ADDR + (h || ''), { waitUntil: 'load', timeout: 60000 }); try { await pg.waitForLoadState('networkidle', { timeout: 30000 }); } catch (e) { }
      await pg.waitForFunction(() => window.V2UI && V2UI.world && V2UI.world().pets && V2UI.world().pets.length > 100 && document.getElementById('lfDock'), null, { timeout: 90000 }).catch(() => { }); await pg.waitForTimeout(2500);
      await pg.evaluate(() => { V2UI.render && V2UI.render(); }); await pg.waitForTimeout(800); };
    const tile = async id => { await pg.evaluate(id => { const q = document.getElementById('lfQ'); q.value = String(id); q.dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('lfDock').scrollIntoView({ block: 'center', behavior: 'instant' }); }, id); await pg.waitForTimeout(400);
      return pg.evaluate(id => { const t = document.querySelector('#lfStrip [data-lf="' + id + '"]'), n = document.querySelector('#lfDock .lf-t[data-t="nest"]'); if (!t) return null; const a = t.getBoundingClientRect(), c = n.getBoundingClientRect(); return [a.x + a.width / 2, a.y + a.height / 2, c.x + c.width / 2, c.y + c.height / 2]; }, id); };
    const cfOpen = () => pg.waitForFunction(() => { const c = document.getElementById('confirmBox'); return c && c.classList.contains('on'); }, null, { timeout: 30000 }).then(() => true).catch(() => false);
    const cancel = async () => { await pg.evaluate(() => document.getElementById('cfNo').click()); await pg.waitForTimeout(400); return pg.evaluate(() => !document.getElementById('confirmBox').classList.contains('on')); };
    await go('breed');
    ok(await pg.evaluate(() => !V2UI.viewOnly || !V2View.viewOnly()), W + ' harness: wallet treated as connected (view-only off)');
    const pick = await pg.evaluate(() => { const w = V2UI.world(), V = V2Rules, me = V2UI.ME; const A = V.breedPicker(w, me, w.tip, '', null).mine.filter(x => !x.why).map(x => x.p);
      for (const a of A.slice(0, 60)) { const P = V.breedPicker(w, me, w.tip, String(a.id), null).partners; const ok = P.filter(x => !x.why).map(x => x.p.id), no = P.filter(x => x.why && x.p.owner === me && x.p.id !== a.id /* harness: A itself is not a wrong partner */).map(x => [x.p.id, x.why]);
        if (ok.length) return { a: a.id, b: ok[0], no: no.find(x => /god/i.test(x[1])) || no[0] || null, n: A.length }; } return { n: A.length }; });
    ok(!!pick.a, W + ' breedable pair found (' + JSON.stringify(pick) + ')');
    if (pick.a) {
      await pg.evaluate(() => { const a = document.getElementById('bA'), b = document.getElementById('bB'); a.value = ''; b.value = ''; V2UI.render(); }); await pg.waitForTimeout(500);
      let dd = await tile(pick.a); ok(!!dd, W + ' dock search finds #' + pick.a);
      if (dd) { await pg.mouse.move(dd[0], dd[1]); await pg.mouse.down(); await pg.mouse.move(dd[0], dd[1] - 30, { steps: 4 }); await pg.mouse.move(dd[2], dd[3], { steps: 8 });
        await pg.screenshot({ path: path.join(OUT, 'after-interact-nestdrag-' + W + '.png') }); await pg.mouse.up(); await pg.waitForTimeout(700);
        ok(await pg.evaluate(id => document.getElementById('bA').value === String(id), pick.a), W + ' DRAG #' + pick.a + ' onto 🥚 Nest -> first guest (#bA)'); }
      if (pick.no) { await tile(pick.no[0]); const r = await pg.evaluate(id => { V2LowFriction.hold(null); document.querySelector('#lfStrip [data-lf="' + id + '"]').click(); /* harness: a tile tap toggles, and the dragged pet is still held, so drop it first */ const n = document.querySelector('#lfDock .lf-t[data-t="nest"]'); return n.getAttribute('aria-disabled') + ' ' + n.title; }, pick.no[0]);
        ok(/^true /.test(r), W + ' wrong partner #' + pick.no[0] + ' -> Nest greyed with the picker reason (' + r + '; picker says: ' + pick.no[1] + ')');
        await pg.evaluate(() => V2LowFriction.hold(null)); }
      dd = await tile(pick.b);
      if (dd) { await pg.evaluate(id => document.querySelector('#lfStrip [data-lf="' + id + '"]').click(), pick.b); await pg.waitForTimeout(200); await pg.evaluate(() => document.querySelector('#lfDock .lf-t[data-t="nest"]').click()); await pg.waitForTimeout(700);
        const r = await pg.evaluate(() => ({ a: document.getElementById('bA').value, b: document.getElementById('bB').value, go: (document.getElementById('bGo') || {}).disabled }));
        ok(r.a === String(pick.a) && r.b === String(pick.b), W + ' TAP #' + pick.b + ' then TAP 🥚 Nest -> partner (#bB) ' + JSON.stringify(r));
        await pg.evaluate(() => (document.getElementById('bGo') || document.getElementById('lfDock')).scrollIntoView({ block: 'center', behavior: 'instant' })); await pg.waitForTimeout(400);
        await pg.screenshot({ path: path.join(OUT, 'after-interact-nestpair-' + W + '.png') });
        if (r.go === false) { await pg.evaluate(() => document.getElementById('bGo').click()); const o = await cfOpen(); ok(o, W + ' Check in (#bGo) still opens the one burn confirm window');
          if (o) { await pg.screenshot({ path: path.join(OUT, 'after-interact-nestconfirm-' + W + '.png') }); ok(await cancel(), W + ' Cancel closes it (nothing signed)'); } } }
    }
    // Bowl: hungry owned pet -> existing feed confirm
    const hun = await pg.evaluate(() => { const w = V2UI.world(); const L = w.pets.filter(p => p.hungry && p.owner === V2UI.ME && !p.dead && !p.released); return L.length ? L[0].id : null; });
    if (hun) { await tile(hun); await pg.evaluate(id => document.querySelector('#lfStrip [data-lf="' + id + '"]').click(), hun); await pg.waitForTimeout(200);
      const dis = await pg.evaluate(() => document.querySelector('#lfDock .lf-t[data-t="bowl"]').getAttribute('aria-disabled')); ok(dis === 'false', W + ' hungry #' + hun + ' -> 🍼 Bowl is open');
      await pg.evaluate(() => document.querySelector('#lfDock .lf-t[data-t="bowl"]').click()); const o = await cfOpen(); ok(o, W + ' 🍼 Bowl opens the existing feed confirm window (burn confirm kept)');
      if (o) { await pg.screenshot({ path: path.join(OUT, 'after-interact-bowlconfirm-' + W + '.png') }); ok(await cancel(), W + ' Cancel closes it (nothing signed)'); } }
    else ok(true, W + ' no hungry pet on this address (bowl confirm not checked)');
    // one-tap card buttons on play
    await go('play');
    const card = await pg.evaluate(() => { const c = [...document.querySelectorAll('#pets .pet.card[data-pid]')].find(c => c.querySelector('.lf-acts [data-lfa="breed"]:not([aria-disabled="true"])')); return c ? c.dataset.pid : null; });
    if (card || W >= 500) { ok(!!card, W + ' a My Pets card with an active 💞 button');
      if (card) { const nav = pg.waitForURL(/breed\.html/, { timeout: 20000 }).then(() => true).catch(() => false); await pg.evaluate(id => document.querySelector('#pets .pet.card[data-pid="' + id + '"] .lf-acts [data-lfa="breed"]').click(), card);
        const landed = await nav; /* js/v2-preselect.js turns #breed-ID into #gooby-inn and puts ID in the first guest slot (#bA) */
        const bA = landed ? await pg.waitForFunction(id => { const a = document.getElementById('bA'); return a && a.value === String(id); }, card, { timeout: 90000 }).then(() => true).catch(() => false) : false;
        ok(landed && bA, W + ' 💞 on card #' + card + ' opens Gooby’s with it as first guest (' + pg.url().replace(ORIGIN, '') + ', #bA=' + await pg.evaluate(() => (document.getElementById('bA') || {}).value).catch(() => '?') + ')'); } }
    else ok(true, W + ' phone swipe view: card buttons checked at 1280');
    ok(errs.length === 0, W + ' no page errors ' + JSON.stringify(errs.slice(0, 3)));
    await ctx.close();
  }
  await b.close(); console.log(bad ? bad + ' problem(s)' : 'all ok'); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
