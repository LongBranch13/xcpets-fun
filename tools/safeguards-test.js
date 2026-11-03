#!/usr/bin/env node
/* safeguards-1102 (Nov 2 2026): real-code-path checks for the post-outage safeguards (not regex-only; see tools/chain-read-verified-test.js
 * for the real load() in a vm). 1) the inline page-error reporter (tools/build-err-report.js) runs in a vm: what it sends, scrubbing,
 * dedupe, the per-page cap, prerender queueing; 2) every page carries the current snippet (build-err-report --check) and practice pages
 * match their builder; 3) real pages served from this checkout in headless Chrome (no network: every off-site request is aborted): the
 * reporter is present, a thrown error and an unhandled rejection reach the collector URL with only the allowed fields, and the pages
 * themselves throw nothing; 4) the smoke test's tie-tag expectation = real V2Rules.deedTag / deedPlan. Nothing is signed or sent. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..'), ER = require('./build-err-report.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
/* 1. snippet in a vm */
function run(opts = {}) {
  const sent = [], L = {}, DL = {}, doc = { prerendering: !!opts.pre, querySelector: s => /\?v=/.test(s) ? { src: 'https://xcpets.fun/js/v2.js?v=abcdef1234' } : null,
    addEventListener: (t, f) => { DL[t] = f; } };
  const win = { addEventListener: (t, f) => { L[t] = f; } };
  const ctx = { window: win, document: doc, location: { href: 'https://xcpets.fun/pet.html?id=5&addr=bc1qfgqx0q3ptr6gfy38kn5ehs4dzfg06y7up328e0', origin: 'https://xcpets.fun', pathname: '/pet.html' },
    navigator: { sendBeacon: (u, b) => { sent.push({ u, b: JSON.parse(b) }); return true; } }, fetch: () => Promise.resolve(), URL, JSON, String, Promise };
  vm.createContext(ctx); vm.runInContext(ER.JS, ctx); return { sent, L, DL };
}
let h = run();
ok(h.L.error && h.L.unhandledrejection, 'listens for error + unhandledrejection');
h.L.error({ message: 'ReferenceError: blocks is not defined (wallet bc1qfgqx0q3ptr6gfy38kn5ehs4dzfg06y7up328e0, 1BoatSLRHtKNngkdXEeobR76b53LETtpyT, tx ' + 'ab'.repeat(32) + ', me@x.com)', filename: 'https://xcpets.fun/js/v2-chain.js?v=abcdef1234', lineno: 412, colno: 9 });
const s0 = h.sent[0] && h.sent[0].b;
ok(h.sent.length === 1 && h.sent[0].u === ER.URL, 'error sent once to the collector (' + h.sent.length + ')');
ok(s0 && JSON.stringify(Object.keys(s0).sort()) === JSON.stringify(['b', 'c', 'f', 'k', 'l', 'm', 'p']), 'only k,m,f,l,c,b,p sent (' + (s0 && Object.keys(s0)) + ')');
ok(s0 && s0.f === '/js/v2-chain.js' && s0.p === '/pet.html' && s0.l === 412 && s0.b === 'abcdef1234', 'file/page are paths (no query), line + build id (' + JSON.stringify(s0) + ')');
ok(s0 && !/bc1q|1Boat|abab|me@x/.test(s0.m) && /<addr>.*<addr>.*<hex>.*<email>/.test(s0.m), 'wallet addresses, long hex, emails cut (' + (s0 && s0.m) + ')');
h.L.error({ message: 'ReferenceError: blocks is not defined (wallet bc1qfgqx0q3ptr6gfy38kn5ehs4dzfg06y7up328e0, 1BoatSLRHtKNngkdXEeobR76b53LETtpyT, tx ' + 'ab'.repeat(32) + ', me@x.com)', filename: 'https://xcpets.fun/js/v2-chain.js?v=abcdef1234', lineno: 412, colno: 9 });
ok(h.sent.length === 1, 'same error again = not sent again (dedupe)');
h.L.error({ message: 'Script error.', filename: '', lineno: 0 }); ok(h.sent.length === 1, 'cross-origin "Script error." skipped');
h.L.unhandledrejection({ reason: { name: 'TypeError', message: 'x is undefined', stack: 'TypeError: x is undefined\n    at f (https://xcpets.fun/js/v2-sales.js?v=abcdef1234:77:5)' } });
const s1 = h.sent[1] && h.sent[1].b; ok(s1 && s1.k === 'rejection' && s1.m === 'TypeError: x is undefined' && s1.f === '/js/v2-sales.js' && s1.l === 77, 'unhandled rejection: message + file:line from the stack (' + JSON.stringify(s1) + ')');
for (let i = 0; i < 10; i++) h.L.error({ message: 'boom ' + i, filename: 'https://xcpets.fun/js/a.js', lineno: i });
ok(h.sent.length === 5, 'at most 5 reports per page load (' + h.sent.length + ')');
h = run({ pre: true }); h.L.error({ message: 'pre', filename: 'https://cdn.example/x.js', lineno: 1 });
ok(h.sent.length === 0 && h.DL.prerenderingchange, 'prerendered page: nothing sent yet');
h.DL.prerenderingchange(); ok(h.sent.length === 1 && h.sent[0].b.f === 'https://cdn.example', 'sent when opened; off-site file = origin only (' + JSON.stringify(h.sent[0] && h.sent[0].b) + ')');
/* 2. every page current */
const chk = cp.spawnSync(process.execPath, [path.join(__dirname, 'build-err-report.js'), '--check'], { encoding: 'utf8' }); ok(chk.status === 0, 'build-err-report --check: ' + chk.stdout.trim().split('\n').pop());
const pc = cp.spawnSync(process.execPath, [path.join(__dirname, 'build-practice-page.js'), '--check'], { encoding: 'utf8' }); ok(pc.status === 0, 'practice pages match build-practice-page');
fs.readdirSync(ROOT).filter(f => /\.html$/.test(f)).forEach(f => { const s = fs.readFileSync(path.join(ROOT, f), 'utf8'), pr = /^practice/.test(f);
  ok((s.match(/<!--err-report-1102--><script>/g) || []).length === (pr ? 0 : 1), f + (pr ? ': practice page has no reporter (practice sends nothing anywhere)' : ': exactly one reporter'));
  if (!pr) ok(s.indexOf('<!--err-report-1102-->') > s.lastIndexOf('<!--nav-cache-1102-->') && s.indexOf('<!--err-report-1102-->') < s.indexOf('<script src='), f + ': after the prerender guard, before any page script'); });
/* 4. tie tag = real rules */
const R = require('./lib/load-rules.js').load().V2Rules;
if (R && R.deedTag) { const t = R.deedTag(53884, 'A15031558553763406198'), p = R.deedPlan(53884, 'A15031558553763406198');
  ok(/^pet:deed:53884:[0-9a-z]+$/.test(t) && p.tag === t, 'live-smoke tie-tag pattern = V2Rules.deedTag/deedPlan (' + t + ')'); } else ok(false, 'could not load V2Rules');
/* 3. real pages in Chrome */
(async () => {
  let chromium; try { chromium = require('playwright-core').chromium; } catch (e) { chromium = require('/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core').chromium; }
  const O = 'http://localhost:' + (process.env.XCPETS_TEST_PORT || 8099), b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try { for (const p of ['/index.html', '/play.html', '/pet.html?id=5', '/shop.html', '/cemetery.html']) {
      const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }), pg = await ctx.newPage(), errs = [], got = [];
      pg.on('pageerror', e => errs.push(e.message));
      await pg.route(u => !u.href.startsWith(O + '/'), r => { const u = r.request().url(); if (u.startsWith(ER.URL)) { got.push(r.request().postData()); return r.fulfill({ status: 204, body: '' }); } return r.abort(); });
      await require('./lib/serve-repo.js')(pg, {}, O);
      await pg.goto(O + p, { waitUntil: 'load', timeout: 60000 }); await pg.waitForTimeout(1500);
      const own = errs.slice(); await pg.evaluate(() => { setTimeout(() => { throw new Error('safeguards-test boom bc1qfgqx0q3ptr6gfy38kn5ehs4dzfg06y7up328e0'); }, 0); Promise.reject(new Error('safeguards-test reject')); });
      await pg.waitForTimeout(1500);
      const bodies = got.map(x => { try { return JSON.parse(x); } catch (e) { return {}; } }), boom = bodies.find(x => /safeguards-test boom/.test(x.m || '')), rej = bodies.find(x => /safeguards-test reject/.test(x.m || ''));
      ok(!own.length, p + ': page throws nothing on load (' + own.slice(0, 2).join(' | ') + ')');
      ok(boom && boom.k === 'error' && /<addr>/.test(boom.m) && !/bc1q/.test(JSON.stringify(bodies)) && boom.p === p.split('?')[0] && /^[0-9a-f]{10}$/.test(boom.b), p + ': thrown error reaches the collector, scrubbed (' + JSON.stringify(boom) + ')');
      ok(rej && rej.k === 'rejection', p + ': unhandled rejection reaches the collector');
      await ctx.close(); } } finally { await b.close(); }
  console.log('safeguards-test: ' + pass + ' pass, ' + fail + ' fail'); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL error', e && e.stack); process.exit(1); });
