/* dock-test (Nov 26 2026). The "gm! Say WAGMI" pop-up, a fight toast (PR 297) and the arrivals (PR 290) each landed on My Pets' pinned
 * selection bar, because every bottom floater picked its own spot. js/v2-dock.js now measures the pinned bar into --dock-h and
 * css/screens.css rule 7 lifts every bottom floater above it. This test:
 *   1. finds every element the code pins to the bottom of the screen (position:fixed + bottom, not a full-screen overlay) and fails if it
 *      is not in rule 7's list (or exempt below, with a reason): a new floater can't land on the bar again;
 *   2. checks that every floater and bar also hides while a sheet is open (rule 1): nothing covers a burn sheet;
 *   3. runs js/v2-dock.js with a pretend page: a pinned bar 150px tall gives --dock-h 150px, no bar gives 0.
 * Static + stubs, no browser. node tools/dock-test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..'), rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };

/* not lifted, on purpose */
const EXEMPT = {
  '#bulkRow': 'it IS the pinned bar (v2-dock.js BARS)',
  '.fs-edge': 'Fire Sale glow along the bottom edge, pointer-events:none, nothing to cover',
};
/* hidden while a sheet is open is not needed for these: they are part of, or answer, a sheet */
const SHEET_OK = { '#toasts': 'error toasts must stay; news toasts hide while Sign & burn is open (game.css)', '.toasts': 'shop toasts, same', '.shtoast': 'confirms a share/copy tapped in a sheet',
  '.dz-toast': 'confirms a dress change made in the dress sheet', '.sh-toast': 'confirms the Share sheet', '#nfeePop': 'the fee picker the player opened',
  '#dexStaleNote': 'small note, no buttons', '#riskNote': 'risk warning, must stay readable', '.tut-tip': 'hidden by rule 1 already', '.fs-edge': 'decoration' };

const screens = rd('css/screens.css');
const r7 = /html\.docked body :is\(([^)]*)\)\{translate:0 calc\(-1 \* var\(--dock-h, 0px\)\)\}/.exec(screens);
ok(!!r7, 'screens.css rule 7 lifts the bottom floaters by --dock-h');
const LIFT = new Set(r7 ? r7[1].split(',').map(x => x.trim()) : []);

/* 1 · every bottom floater in the code */
function subject(sel) { const toks = sel.trim().split(/[\s>+~]+/).pop().match(/[#.][A-Za-z][\w-]*/g) || []; return toks.find(t => t[0] === '#') || toks[0]; }
const isBottomFloat = d => /position:\s*fixed/.test(d) && /(^|[;{\s])bottom:\s*(?!auto)/.test(d) && !/(^|[;{\s])top:\s*(?!auto)/.test(d) && !/inset:/.test(d);
const found = new Map();
const files = [];
for (const dir of ['js', 'css']) for (const f of fs.readdirSync(path.join(ROOT, dir))) if (/\.(js|css)$/.test(f) && !/\.min\.js$/.test(f)) files.push(dir + '/' + f);
for (const f of files) {
  const s = rd(f).replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of s.matchAll(/([^{}'"]+)\{([^{}]*)\}/g)) if (isBottomFloat(m[2])) for (const sel of m[1].split(',')) {
    if (/:is\(|html\.docked|body\.mpc-inview|body\.selmode|body\.mpc-sel/.test(sel)) continue; /* the bar's own pinned rule and rule 7 itself */
    const k = subject(sel.replace(/^.*@media[^{]*$/, '')); if (k && !/^\.(tut-chip)$/.test(k)) found.set(k, f);
  }
  /* inline style: el.style.cssText = 'position:fixed;...bottom:...' with the element's id/class set on the same line or just before */
  const lines = s.split('\n');
  lines.forEach((ln, i) => { const c = /cssText\s*=\s*'([^']*)'/.exec(ln); if (!c || !isBottomFloat(c[1])) return;
    const near = lines.slice(Math.max(0, i - 2), i + 1).join('\n'), id = /\.id\s*=\s*'([\w-]+)'/.exec(near), cl = /className\s*=\s*'([\w-]+)/.exec(near);
    found.set(id ? '#' + id[1] : cl ? '.' + cl[1] : '?' + f + ':' + (i + 1), f); });
}
ok(found.size >= 10, 'found the bottom floaters (' + found.size + ')');
for (const [k, f] of found) ok(LIFT.has(k) || EXEMPT[k], k + ' (' + f + ') is lifted above the pinned bar' + (EXEMPT[k] ? ' (exempt: ' + EXEMPT[k] + ')' : ''));
for (const k of LIFT) ok(found.has(k), 'rule 7 entry ' + k + ' still exists in the code');

/* 2 · bars and pills hide while a sheet is open */
const r1 = screens.split('/* 2 ·')[0], hid = /body:has\(#inReqBox\.on, #eggPop\) :is\(([^)]*)\)/.exec(r1), HIDE = new Set(hid ? hid[1].split(',').map(x => x.trim()) : []);
ok(/html:not\(\.lair-calm\):not\(\.ip-hold\) body:has\(#inReqBox\.on, #eggPop\)/.test(r1) && /\.reveal\.on:not\(#inReqBox\)/.test(r1), 'a sheet kept open but hidden (Rare Room calm mode, return-visit hold) does not hide the bar (play-test robot, Nov 26 2026)');
for (const k of [...LIFT, '#bulkRow']) if (!SHEET_OK[k]) ok(HIDE.has(k), k + ' hides while a sheet is open (rule 1)');

/* 3 · v2-dock.js measures the bar */
function run(bar) {
  const props = {}, cls = new Set(), cbs = [];
  const root = { clientHeight: 800, style: { setProperty: (k, v) => { props[k] = v; } }, classList: { toggle: (c, on) => { if (on) cls.add(c); else cls.delete(c); } } };
  const doc = { readyState: 'complete', documentElement: root, body: {}, querySelectorAll: () => bar ? [bar] : [], addEventListener() {} };
  const on = {};
  const win = { document: doc, innerHeight: 800, getComputedStyle: e => e.cs, requestAnimationFrame: f => cbs.push(f), addEventListener(k, f) { on[k] = f; },
    ResizeObserver: function () { this.observe = () => {}; }, MutationObserver: function () { this.observe = () => {}; } };
  win.window = win; vm.runInNewContext(rd('js/v2-dock.js'), win);
  return { props, cls, win, on, doc };
}
const bar = { cs: { position: 'fixed', display: 'flex', visibility: 'visible' }, getBoundingClientRect: () => ({ top: 640, bottom: 790, height: 150 }) };
let r = run(bar); ok(r.props['--dock-h'] === '160px' && r.cls.has('docked'), 'a bar pinned 10px above the bottom, 150px tall, lifts floaters by 160px (got ' + r.props['--dock-h'] + ')');
r = run(null); ok(r.props['--dock-h'] === '0px' && !r.cls.has('docked'), 'no bar: --dock-h 0px, not docked');
r = run({ cs: { position: 'static', display: 'flex', visibility: 'visible' }, getBoundingClientRect: () => ({ top: 200, bottom: 350, height: 150 }) });
ok(r.props['--dock-h'] === '0px', 'the bar back in the page (not pinned, My Pets scrolled away) lifts nothing');
r = run({ cs: { position: 'fixed', display: 'none', visibility: 'visible' }, getBoundingClientRect: () => ({ top: 0, bottom: 0, height: 0 }) });
ok(r.props['--dock-h'] === '0px', 'a hidden bar lifts nothing');

/* 3b · XcpDock.busy: pop-ups that open on their own wait while the player is touching the page (box reveal swallowed "Open", Nov 26 2026) */
r = run(null);
ok(typeof r.win.XcpDock.busy === 'function' && r.win.XcpDock.busy() === false, 'not busy before the player touches anything');
r.on.pointerdown(); ok(r.win.XcpDock.busy() === true, 'busy right after a tap');
ok(!r.on.scroll, 'a scroll the page makes on its own does not count as the player');
r = run(null); r.doc.body = { classList: { contains: c => c === 'selmode' } }; ok(r.win.XcpDock.busy() === true, 'busy while picking pets (select mode)');
var v2s = rd('js/v2.js');
ok(/function nextReveal\(\)[\s\S]{0,600}!revealQ\[0\]\.tray && playerBusy\(\)/.test(v2s), 'the box reveal waits while the player is busy (a tapped pill / Last hatch opens at once)');
ok(/function nextAnim\(\)[\s\S]{0,400}playerBusy\(\)/.test(v2s), 'fight / breed / cemetery replays wait while the player is busy');
for (const f of ['js/v2-groyper-arrival.js', 'js/v2-kek-arrival.js', 'js/v2-rabbit-arrival.js'])
  ok(/XcpDock\.busy\(\)/.test(rd(f)), f + ' waits while the player is busy');

/* 3c · XcpDock.sheetUp: one answer to "is a sheet open?" (Nov 28 2026, play-test robot on Evan's wallet: an egg-crack scene (.la-ov) opened
 * over the Meat Grinder and covered GRIND, because the box reveal's otherUp() counted only .reveal.on sheets, not the Grinder's aria-modal dialog) */
function el(o) { o = Object.assign({ w: 300, cls: [] }, o); return { id: o.id || '', offsetWidth: o.w, offsetHeight: o.w, classList: { contains: c => o.cls.includes(c) },
  closest: sel => sel.split(',').map(x => x.trim()).some(x => x === '#' + o.id || (o.inside && x === '#' + o.inside)) ? {} : null }; }
function up(list, except) { r = run(null); r.doc.querySelectorAll = () => list; return r.win.XcpDock.sheetUp(except); }
ok(up([]) === false, 'nothing open: no sheet up');
ok(up([el({ cls: ['mgr-bg'] })]) === true, 'the Meat Grinder (aria-modal dialog) counts as a sheet');
ok(up([el({ cls: ['la-ov'] })]) === true, 'a life scene (egg crack, .la-ov) counts');
ok(up([el({ w: 0 })]) === false, 'a hidden dialog (calm mode, display:none) does not count');
ok(up([el({ cls: ['returnov'] })]) === false, 'the welcome-back card does not count');
ok(up([el({ id: 'animBox' }), el({ inside: 'animBox' })], '#animBox') === false && up([el({ id: 'animBox' }), el({})], '#animBox') === true, 'except skips a box and what is inside it, nothing else');
ok(/function otherUp\(\)[^\n]*XcpDock\.sheetUp/.test(v2s), 'the box reveal / hatch scene waits for any sheet (otherUp uses XcpDock.sheetUp)');
ok(/function sheetOpen\(\)[^\n]*XcpDock\.sheetUp/.test(v2s), 'fight / breed / cemetery replays use the same answer (sheetOpen)');
for (const f of ['js/v2-groyper-arrival.js', 'js/v2-kek-arrival.js', 'js/v2-rabbit-arrival.js'])
  ok(/function sheetUp\(\)[^\n]*XcpDock\.sheetUp\(\)/.test(rd(f)), f + ' waits for any sheet too (Grinder included)');

/* 4 · the selection bar pins only while My Pets is on screen ("this feed bar is stuck", Nov 26 2026) */
const calm = rd('js/v2-mypets-calm.js');
ok(!/'body\.selmode #petsPanel #bulkRow|,body\.mpc-sel #petsPanel #bulkRow/.test(calm) && /body\.mpc-inview\.selmode #petsPanel #bulkRow/.test(calm), 'the selection bar pins only with body.mpc-inview');
ok(/function inView\(\)[\s\S]{0,300}mpc-inview/.test(calm) && /addEventListener\('scroll'/.test(calm), 'mpc-inview follows whether My Pets is on screen (scroll, resize, every sync)');

/* 5 · the WAGMI pop-up is gone; the WAGMI button stays */
const v2 = rd('js/v2.js');
ok(!/wagmiOffer|wagmi-offer/.test(v2), 'no "gm! Say WAGMI" pop-up');
ok(/id="wagmiBtn"/.test(v2), 'the Say WAGMI button on My Pets stays');

console.log('dock-test: ' + (fail ? fail + ' failure(s)' : 'all good'));
process.exit(fail ? 1 : 0);
