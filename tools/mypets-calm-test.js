/* mypets-calm (owner Nov 23 2026): My Pets is one slim toolbar with the feed/discard/select tools tucked away until you select.
 * Runs practice.html (pretend chain, no network) in a headless browser, desktop and phone.
 *   node tools/mypets-calm-test.js */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const TYPES = { html: 'text/html', js: 'application/javascript', css: 'text/css', json: 'application/json', png: 'image/png', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp', woff2: 'font/woff2' };
const src = fs.readFileSync(path.join(ROOT, 'js/v2-mypets-calm.js'), 'utf8');
ok(!/V2Wallet|\.send\(|pet:/.test(src), 'layout only: no burns or wallet calls in v2-mypets-calm.js');
['templates/game.html', 'play.html', 'practice.html'].forEach(f => ok(/js\/v2-mypets-calm\.js\?v=[^\"'&\s]+/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')), f + ' loads v2-mypets-calm.js'));
let chromium; try { chromium = require('playwright').chromium; } catch (e) { console.log('mypets-calm: ' + pass + ' passed, ' + fail + ' failed (no playwright: browser part skipped)'); process.exit(fail ? 1 : 0); }
const server = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': TYPES[path.extname(f).slice(1)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
(async () => {
  await new Promise(res => server.listen(0, '127.0.0.1', res)); const base = 'http://127.0.0.1:' + server.address().port;
  const b = await chromium.launch();
  for (const phone of [false, true]) {
    const tag = phone ? 'phone: ' : 'desktop: ';
    const ctx = await b.newContext(phone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
    await p.goto(base + '/practice.html', { waitUntil: 'load' });
    await p.waitForFunction(() => window.XcpPractice && window.V2Rules, null, { timeout: 90000 });
    await p.evaluate(() => { var XP = XcpPractice; for (var i = 0; i < 12; i++) { var L = XP.load(); if (L.stats) L.stats.hatched = 0; XP.burn({ tag: 'pet:hatch', amount: 69 }); } });
    await p.reload({ waitUntil: 'load' });
    await p.waitForFunction(() => document.body.classList.contains('mpc-on') && document.querySelectorAll('#pets .pet.card').length > 0 && document.getElementById('fRarRow'), null, { timeout: 90000 });
    await p.waitForTimeout(2500);
    const s = await p.evaluate(() => { const vis = id => { const e = typeof id === 'string' ? document.getElementById(id) : id; return !!(e && e.offsetParent !== null && getComputedStyle(e).display !== 'none'); };
      const cb = document.querySelector('#pets .pet.card .pick-cb');
      return { tb: vis('mpcMoreBtn') && vis('mpcSelBtn') && vis('fSearch'), bulk: vis('bulkRow'), drawer: vis('mpcMore'), cb: cb ? vis(cb) : null, rar: document.getElementById('fRarRow').parentNode.id,
        stat: document.getElementById('mptStat').parentNode.id, hungry: document.getElementById('bFeedHungry').closest('#mpcMore') != null, flex: !!document.getElementById('myLooks'), flexLink: !!document.querySelector('#mpcMore a[href*="lookStation"]') }; });
    ok(s.tb, tag + 'toolbar shows Find, More and Select'); ok(!s.bulk, tag + 'feed/discard/select bar hidden until selecting'); ok(!s.drawer, tag + 'More drawer starts closed');
    ok(s.cb === false, tag + 'card checkboxes hidden until selecting'); ok(s.rar === 'mpcRar', tag + 'rarity pills under the toolbar'); ok(s.stat === 'mpcHead', tag + 'one stat line');
    ok(s.hungry, tag + 'Feed all hungry lives in More'); ok(!s.flex, tag + 'My Flex list is gone from My Pets'); ok(s.flexLink, tag + 'More links to Flex Forge in The Rare Room');
    await p.evaluate(() => document.getElementById('mpcMoreBtn').click()); ok(await p.evaluate(() => !document.getElementById('mpcMore').hidden), tag + 'More opens the drawer');
    await p.evaluate(() => document.getElementById('mpcSelBtn').click()); await p.waitForTimeout(300);
    const t = await p.evaluate(() => { const r = document.getElementById('bulkRow').getBoundingClientRect(); return { pos: getComputedStyle(document.getElementById('bulkRow')).position, inView: r.bottom <= innerHeight + 1 && r.height > 0, feed: !!document.querySelector('#bulkRow #bFeedKept'), disc: !!document.querySelector('#bulkRow #bDiscSel'), cb: getComputedStyle(document.querySelector('#pets .pet.card .pick-cb')).display !== 'none' }; });
    ok(t.pos === 'fixed' && t.inView, tag + 'Select shows the action bar pinned to the bottom'); ok(t.feed && t.disc, tag + 'bar has Feed selected and Discard selected'); ok(t.cb, tag + 'checkboxes show while selecting');
    await p.evaluate(() => { const c = document.querySelector('#pets .pet.card .pick-cb'); c.click(); }); await p.waitForTimeout(400);
    ok(await p.evaluate(() => /1 selected/.test(document.getElementById('mpcCount').textContent)), tag + 'bar counts the ticked pet');
    await p.evaluate(() => document.getElementById('mpcDone').click()); await p.waitForTimeout(400);
    const u = await p.evaluate(() => ({ sel: (V2UI.S().sel || []).length, mode: document.body.classList.contains('selmode'), bar: getComputedStyle(document.getElementById('bulkRow')).display }));
    ok(u.sel === 0 && !u.mode && u.bar === 'none', tag + 'Done unticks, leaves select mode and hides the bar');
    ok(!errs.length, tag + 'no page errors ' + errs.slice(0, 3).join(' | '));
    await ctx.close();
  }
  await b.close(); server.close();
  console.log('mypets-calm: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL', e.message); process.exit(1); });
