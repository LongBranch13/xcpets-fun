#!/usr/bin/env node
/* Smooth first paint (Nov 26 2026, Jake: "when you open xcpets.fun you see the regular site then a glitch happens and the doom layer kicks in").
 * The look of a page must be decided before the browser paints anything:
 *   - js/boot-look.js runs in <head> (no defer/async) and, while Doom is on, puts html.dw on and writes the Doom stylesheet as a
 *     parser-inserted <link> (so the first paint waits for it, like style.css). Practice pages and ?doom=0 stay plain.
 *   - js/v2-header.js runs right after </header> (no defer), so the slim header is built before the first paint.
 * Run the real boot-look with a stub document; read the pages for where the two tags sit. Measure the real thing with tools/smoothprobe.js.
 *   node tools/smooth-load-test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (c) pass++; else fail++; };
const SRC = fs.readFileSync(path.join(ROOT, 'js/boot-look.js'), 'utf8');

function boot(pathname, search, readyState) {
  const cls = new Set(), written = [], appended = [];
  const root = { classList: { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c) } };
  const document = { documentElement: root, readyState: readyState || 'loading', currentScript: { src: 'https://xcpets.fun/js/boot-look.js?v=abc123' },
    write: h => written.push(h), createElement: t => ({ tag: t, style: {} }), head: { appendChild: e => appended.push(e) } };
  const win = { document, location: { pathname, search: search || '' } };
  win.window = win; vm.createContext(win); vm.runInContext(SRC, win);
  return { cls, written, appended, look: win.XcpBootLook };
}
{ const r = boot('/play.html');
  ok(r.cls.has('dw') && r.look && r.look.doom === r.look.DOOM, 'Play: the Doom class follows the one switch (XcpBootLook.DOOM) before anything paints');
  if (r.look.DOOM) {
    ok(r.written.some(h => /<link rel="stylesheet" id="dwCss" href="css\/doom-week\.css\?v=[\w.-]+">/.test(h)), 'the Doom stylesheet is a parser-inserted link (holds the first paint), with the page token');
    ok(r.appended.some(e => e.tag === 'script' && /js\/doom-week\.js\?v=/.test(e.src) && e.async), 'doom-week.js starts loading from <head>, not after the page');
  } }
{ const r = boot('/practice.html'); ok(!r.cls.has('dw') && !r.written.length && r.look.doom === false, 'practice pages never get Doom'); }
{ const r = boot('/index.html', '?doom=0'); ok(!r.cls.has('dw') && !r.look.doom, '?doom=0 keeps the page plain'); }
{ const r = boot('/index.html', '?doom=1'); ok(r.cls.has('dw') && r.look.doom, '?doom=1 forces Doom'); }
{ const r = boot('/index.html', '', 'interactive'); ok(!r.look.DOOM || (!r.written.length && r.appended.some(e => e.tag === 'link' && e.id === 'dwCss')), 'after parsing (no document.write) the stylesheet is appended instead'); }

/* the pages: boot-look in <head> without defer/async; v2-header right after </header> without defer */
const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).concat(['templates/game.html']);
const noBoot = [], badHead = [], badHdr = [];
pages.forEach(p => {
  const s = fs.readFileSync(path.join(ROOT, p), 'utf8'), head = s.split('</head>')[0];
  if (/js\/v2-events\.js\?v=/.test(s) && !/^practice/.test(p)) { /* practice pages never get Doom (built without the head guard and boot-look) */
    const m = /<script src="js\/boot-look\.js\?v=[\w.-]+"([^>]*)><\/script>/.exec(head);
    if (!m) noBoot.push(p); else if (/defer|async/.test(m[1])) badHead.push(p);
  }
  if (/js\/v2-header\.js\?v=/.test(s) && !/<\/header><script src="js\/v2-header\.js\?v=[\w.-]+"><\/script>/.test(s)) badHdr.push(p);
});
ok(!noBoot.length, 'every page with the seasonal looks loads js/boot-look.js inside <head>' + (noBoot.length ? ' (missing: ' + noBoot.join(', ') + ')' : ''));
ok(!badHead.length, 'boot-look is not deferred or async (it has to run before the first paint)' + (badHead.length ? ' (' + badHead.join(', ') + ')' : ''));
ok(!badHdr.length, 'v2-header.js runs right after </header>, not deferred' + (badHdr.length ? ' (' + badHdr.join(', ') + ')' : ''));
/* the bars that sit above the page go into the one reserved strip (js/v2-header.js XcpTopStrip) */
['js/v2-status.js', 'js/v2-halving.js', 'js/v2-datalag.js', 'js/v2-split.js', 'js/v2-chain.js', 'js/season-bar.js', 'js/v2-firesale.js'].forEach(f =>
  ok(/XcpTopStrip\.mount\(/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')), f + ' mounts its bar in the top strip'));
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
