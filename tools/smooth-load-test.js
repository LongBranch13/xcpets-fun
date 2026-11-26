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
/* round 2: the cards late scripts put at the top of the page go into one box that is already in the page (#mainTop, first thing in <main>) */
const noTop = pages.filter(p => { const s = fs.readFileSync(path.join(ROOT, p), 'utf8'); return /<main\b/.test(s) && !/<main\b[^>]*><div id="mainTop"><\/div>/.test(s); });
ok(!noTop.length, 'every page with <main> starts it with the reserved top box' + (noTop.length ? ' (missing: ' + noTop.join(', ') + ')' : ''));
[['js/v2-today.js', 'Today card'], ['js/v2-pantry.js', 'Pantry'], ['js/doom-week.js', 'Doom sign'], ['js/ux-polish.js', 'quick links'], ['js/v2-tutorial.js', 'tutorial row'], ['js/v2-places.js', 'Town bar']].forEach(([f, what]) =>
  ok(/XcpTopStrip\.mountMain\(/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')), what + ' (' + f + ') goes into the reserved top box'));
ok(/XcpTopStrip\.mount\(/.test(fs.readFileSync(path.join(ROOT, 'js/casa-connect.js'), 'utf8')), 'the Connect bar goes into the top strip');
/* mountMain keeps the order and replaces last visit's spacer in place: run the real header code on a tiny DOM stub */
{ const kids = []; const mk = (id) => { const e = { id, attrs: {}, parentNode: null, getAttribute(k) { return this.attrs[k] == null ? null : this.attrs[k]; }, setAttribute(k, v) { this.attrs[k] = String(v); }, getBoundingClientRect: () => ({ height: 10, top: 0, bottom: 10 }) }; return e; };
  const top = mk('mainTop'); top.isConnected = true;
  Object.defineProperty(top, 'firstElementChild', { get: () => kids[0] || null });
  const nextOf = (el) => { const i = kids.indexOf(el); return i >= 0 ? kids[i + 1] || null : null; };
  top.insertBefore = (el, before) => { const i = kids.indexOf(el); if (i >= 0) kids.splice(i, 1); const j = before ? kids.indexOf(before) : -1; if (j >= 0) kids.splice(j, 0, el); else kids.push(el); el.parentNode = top; };
  top.replaceChild = (el, old) => { const j = kids.indexOf(old); kids[j] = el; el.parentNode = top; old.parentNode = null; };
  const proto = { get nextElementSibling() { return nextOf(this); } };
  const store = { 'xcpets-maintop:play': JSON.stringify([[10, 845], [20, 171]]) };
  const document = { readyState: 'complete', documentElement: {}, head: { appendChild() {} }, querySelector: (q) => q === 'main' ? { insertBefore() {} } : null, getElementById: (id) => id === 'mainTop' ? top : null,
    createElement: () => Object.assign(Object.create(proto), mk('x'), { style: {} }), addEventListener() {} };
  const win = { document, location: { pathname: '/play.html' }, localStorage: { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; }, removeItem() {} }, addEventListener() {}, setTimeout: () => 0, getComputedStyle: () => ({ marginBottom: '0' }) };
  win.window = win; win.self = win;
  vm.createContext(win);
  try { vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/v2-header.js'), 'utf8'), win); } catch (e) { }
  const T = win.XcpTopStrip;
  if (!T || !T.mountMain) ok(false, 'XcpTopStrip.mountMain is exported by js/v2-header.js');
  else { const pantry = Object.assign(Object.create(proto), mk('pantryCard')); T.mountMain(pantry, 20);
    const ghostsFirst = kids.map(k => k.id === 'pantryCard' ? 'P' : k.attrs['data-mt']).join(',');
    const today = Object.assign(Object.create(proto), mk('todayCard')); T.mountMain(today, 10);
    const sign = Object.assign(Object.create(proto), mk('sign')); T.mountMain(sign, 30);
    ok(ghostsFirst === '10,P', 'the Pantry replaces its own spacer and the Today spacer stays above it (' + ghostsFirst + ')');
    ok(kids.map(k => k.id).join(',') === 'todayCard,pantryCard,sign', 'cards land in their fixed order, Today in its spacer (' + kids.map(k => k.id).join(',') + ')'); } }

/* smooth-chores (Nov 26 2026, play-test robot: "Do it all in one burn" froze Evan's page ~1 s): the plan and its before-signing check are worked
 * out ahead in idle time, and the button reuses them only while every input is the same (world object, tip, wallet, discards, unconfirmed burns). */
{ const els = {}, idleQ = []; let plans = 0, whys = 0, pend = [], confirmed = null;
  const el = (id) => els[id] || (els[id] = { id, style: {}, dataset: {}, disabled: false, innerHTML: '', parentNode: { insertBefore() {} }, querySelector: () => null, insertAdjacentHTML() {} });
  el('streakBar'); el('dcBtn');
  const world = { tip: 100, pets: [{ id: 1, owner: 'me', hungry: true }, { id: 2, owner: 'me', hungry: true }] };
  const V2UI = { ME: 'me', world: () => world, S: () => ({ tip: 100 }), hiddenIds: () => [], pendingFeedIds: () => ({ hd: {} }), myPendingTags: () => pend.slice(),
    sendWhy: () => { whys++; return ''; }, toast() {}, render() {}, confirmPlans: (t, p) => { confirmed = p; } };
  const V2Rules = { dailyChoresGate: () => 1, frEats: (p) => p.hungry, dailyChoresPlan: () => { plans++; return { plans: [{ tag: 'pet:dc:0', amount: 1, petIds: [1, 2] }], parts: { feed: 2 }, oldBurns: 3 }; } };
  const V2Own = { discarded: (p, me, o) => (p.hd === me || (o && o.set && o.set.has(p.id)) || (o && o.pend && o.pend[p.id])) ? 'x' : null };
  const win = { V2UI, V2Rules, V2Own, location: { search: '' }, localStorage: { getItem: () => null, setItem() {} }, setInterval: () => 0, setTimeout: (f) => { idleQ.push(f); return 0; },
    requestIdleCallback: (f) => { idleQ.push(f); return 0; }, matchMedia: () => ({ matches: false }), console,
    document: { getElementById: (id) => els[id] || null, createElement: () => el('dcRow'), head: { appendChild() {} }, body: { appendChild() {} } } };
  win.window = win; vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/v2-chores.js'), 'utf8'), win);
  const C = win.V2Chores; C.ensure(); const p0 = plans; while (idleQ.length) idleQ.shift()();
  ok(p0 === 1 && whys === 1, 'chores: the plan and its before-signing check are made ahead (plan ' + p0 + ', check ' + whys + ')');
  els.dcBtn.onclick(); ok(plans === 1 && whys === 1 && confirmed && confirmed.length === 1, 'chores: the button reuses them when nothing changed (no work on the tap)');
  ok(confirmed[0] !== null && confirmed[0].tag === 'pet:dc:0', 'chores: the sheet gets the same burn');
  pend = ['pet:hd:1']; els.dcBtn.onclick(); ok(plans === 2 && whys === 2, 'chores: an unconfirmed burn makes the tap plan and check fresh');
  pend = []; world.tip = 101; win.V2UI.S = () => ({ tip: 101 }); els.dcBtn.onclick(); ok(plans === 3 && whys === 3, 'chores: a new block makes the tap plan and check fresh'); }

/* smooth looks (Nov 26 2026): the foil shimmer keeps to a frame budget (24 fps while steered, 12 fps on its own, at most ~8% of the page's time) */
{ const src = fs.readFileSync(path.join(ROOT, 'js/v2-looks.js'), 'utf8');
  const raf = []; let now = 0, draws = 0;
  const win = { requestAnimationFrame: (f) => { raf.push(f); return 1; }, performance: { now: () => now }, matchMedia: () => ({ matches: false }), addEventListener() {},
    document: { hidden: false, addEventListener() {}, createElement: () => ({ style: {}, setAttribute() {}, getContext: () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), setTransform() {}, clearRect() {}, putImageData() {} }), getBoundingClientRect: () => ({ width: 0 }) }) },
    getComputedStyle: () => null, devicePixelRatio: 1, innerHeight: 800, innerWidth: 800 };
  win.window = win; win.self = win; vm.createContext(win);
  try { vm.runInContext(src, win); } catch (e) { }
  const LK = win.V2Looks;
  if (!LK || !LK.attach) ok(false, 'V2Looks loads in a stub page');
  else { const img = { data: new Uint8ClampedArray(4096) }, A = [{ data: new Uint8ClampedArray(4096) }], B = [{ data: new Uint8ClampedArray(4096).fill(255) }];
    for (let y = 10; y < 22; y++) for (let x = 10; x < 22; x++) { const i = (y * 32 + x) * 4; B[0].data[i] = B[0].data[i + 1] = B[0].data[i + 2] = 0; } /* a 12x12 body: the same in both keyed renders */
    LK.attachInfo([img], A, B, [{ id: 'x', type: 'foil', fx: 'gold-foil' }], 1);
    const parent = { insertBefore() {} }, c = { nodeType: 1, parentNode: parent, isConnected: true, offsetWidth: 64, offsetHeight: 64, offsetLeft: 0, offsetTop: 0 };
    LK.attach(c, img); const o = c._lkx;
    if (!o) ok(false, 'a pet with a look gets its overlay (stub)');
    else { o.isConnected = true; o._vis = true; o.getBoundingClientRect = () => ({ width: 64, height: 64, top: 10, bottom: 74, left: 10, right: 74 }); const rd = LK.render; let frames = 0;
      const runFor = (ms, stepMs) => { const end = now + ms; frames = 0; while (now < end) { now += stepMs; const f = raf.splice(0); f.forEach(fn => fn(now)); } };
      const before = o._img; let count = 0; const orig = o.getContext; o.getContext = () => { const x = orig ? orig() : {}; return Object.assign({}, x, { putImageData() { count++; }, setTransform() {}, clearRect() {}, createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) }); };
      count = 0; runFor(2000, 1000 / 60); const fpsIdle = count / 2;
      ok(fpsIdle > 8 && fpsIdle <= 13, 'looks: the shimmer on its own draws ~12 frames a second (' + fpsIdle + ')'); } } }
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
