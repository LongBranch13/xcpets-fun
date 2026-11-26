#!/usr/bin/env node
/* The play-test robot's hands (tools/playtest/run.js hands()) on small made-up pages: no rig, no chain.
 * Nov 26 2026: on Evan's 40,000-pet wallet the robot said "Open a pet: the page stopped answering for 10 s" and "button-blocked"
 * on some CI runs and not on others. The page was changing to pet.html (a page change, not a freeze), or a scene kept coming back
 * over the button. A flaky robot hides real bugs, so this checks both ways:
 *   - a press that opens another page is not a freeze, even when the change is slow
 *   - a page that freezes 12 s and THEN opens another page is still a freeze (heartbeat in sessionStorage)
 *   - a page that freezes and never leaves is still a freeze
 *   - a button under a scene that comes back twice gets pressed (the robot closes it again, like a player would)
 *   node tools/playtest-hands-test.js */
'use strict';
const http = require('http');
let fails = 0, n = 0; const ok = (c, m) => { n++; console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
let chromium; try { chromium = require('playwright').chromium; } catch (e) { console.log('playtest-hands: playwright not installed, skipped'); process.exit(0); }
process.argv.push('--out', require('os').tmpdir() + '/playtest-hands');
const R = require('./playtest/run.js');

const btn = (js) => '<!doctype html><meta charset="utf-8"><body><button id="go" onclick="' + js + '">Open ▸</button></body>';
const PAGES = {
  '/b.html': '<!doctype html><meta charset="utf-8"><body><h1>pet page</h1></body>',
  '/nav.html': btn("location.href='b.html'"),
  '/slownav.html': btn("location.href='late.html'"),
  '/frozenav.html': btn("var t=Date.now();while(Date.now()-t<12000){}location.href='b.html'"),
  '/stuck.html': btn("var t=Date.now();while(Date.now()-t<25000){}"),
  '/covered.html': '<!doctype html><meta charset="utf-8"><body><button id="go" onclick="document.title=\'pressed\'">Open ▸</button>' +
    '<script>var left=3;function scene(){if(!left--)return;var d=document.createElement("div");d.className="reveal on";d.setAttribute("role","dialog");' +
    'd.style.cssText="position:fixed;inset:0;background:#000;z-index:9";var c=document.createElement("button");c.textContent="Close";' +
    'c.onclick=function(){d.remove();setTimeout(scene,300)};d.appendChild(c);document.body.appendChild(d);}scene();</script></body>',
};
const srv = http.createServer((q, r) => { const p = q.url.split('?')[0];
  if (p === '/late.html') return setTimeout(() => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(PAGES['/b.html']); }, 14000);
  if (!PAGES[p]) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': 'text/html' }); r.end(PAGES[p]); });

(async () => {
  await new Promise(res => srv.listen(0, '127.0.0.1', res)); const BASE = 'http://127.0.0.1:' + srv.address().port;
  const b = await chromium.launch();
  const run = async (page, what) => { const cx = await b.newContext(); const pg = await cx.newPage(); await pg.goto(BASE + page);
    await pg.evaluate(() => { window.__pt = { long: [] }; });
    const before = R.report.length; const H = R.hands(pg); const pressed = await H.press('#go', what, { wait: 2000 });
    const got = R.report.slice(before); await pg.waitForTimeout(300); const url = pg.url(), title = await pg.title().catch(() => ''); await cx.close(); return { pressed, got, url, title }; };
  const kinds = r => r.got.map(x => x.kind + ': ' + x.detail).join(' | ') || 'none';

  let r = await run('/nav.html', 'quick page change'); ok(r.pressed && !r.got.length && /b\.html/.test(r.url), 'a press that opens another page: no problem (' + kinds(r) + ')');
  r = await run('/slownav.html', 'slow page change'); ok(r.pressed && !r.got.some(x => x.kind === 'freeze'), 'a page change that takes 14 s is not a freeze (' + kinds(r) + ')');
  r = await run('/frozenav.html', 'freeze then leave'); ok(r.got.some(x => x.kind === 'freeze'), 'a page that froze 12 s before it left is still a freeze (' + kinds(r) + ')');
  r = await run('/stuck.html', 'freeze in place'); ok(r.got.some(x => x.kind === 'freeze'), 'a page that freezes and never leaves is still a freeze (' + kinds(r) + ')');
  r = await run('/covered.html', 'covered button'); ok(r.pressed && r.title === 'pressed' && !r.got.length, 'a button under a scene that comes back 3 times is pressed (' + kinds(r) + ')');

  await b.close(); srv.close();
  console.log('playtest-hands: ' + (n - fails) + ' passed, ' + fails + ' failed'); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FAIL', e.stack); process.exit(1); });
