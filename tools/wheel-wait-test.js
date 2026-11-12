/* wheel-wait (Nov 10 2026): the Rare Room Pepe Wheel does a short spin when a roll is sent, then holds still
 * while that burn waits for a block. Display only. A saved-spin burn already in the mempool does not open a second confirm.
 * The dressing room, gear cards and a deliberate new paid spin stay usable. Nothing here signs or broadcasts. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process'), http = require('http');
const ROOT = path.join(__dirname, '..');
const UT = 'pet:ut:140:EL:KGV71VE1K9121IJ51';
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('ok   ' + m); } else { fail++; console.log('FAIL ' + m); } }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const shop = fs.readFileSync(path.join(ROOT, 'js/v2-shop.js'), 'utf8');
const anim = fs.readFileSync(path.join(ROOT, 'js/v2-wheel-anim.js'), 'utf8');
ok(!/pn \? 0\.006/.test(shop), 'pending count no longer keeps the canvas wheel turning');
ok(!/0\.006/.test(shop), 'the slow mempool spin rate is gone from the shop');
ok(shop.includes('PEPE WHEEL \\u00b7 WAITING'), 'the wheel plate has a waiting caption');
ok(shop.includes('You can keep using the shop.'), 'the panel says the shop stays open');
ok(anim.includes('tap to skip') && /prefers-reduced-motion/.test(anim) && anim.includes('function play'), 'landing overlay still plays, skips on tap, and keeps reduced motion');
const RULES_MD5 = '8e98664087bab2e991680ebdb80ba143';
ok(require('crypto').createHash('md5').update(fs.readFileSync(path.join(ROOT, 'js/v2-rules.js'))).digest('hex') === RULES_MD5, 'js/v2-rules.js MD5 is ' + RULES_MD5);
const changed = cp.execSync('git diff --name-only origin/main', { cwd: ROOT, encoding: 'utf8' });
ok(!/pet-core\.js|burn-core\.js|real-core\.js|game-core\.js|v2-wheel-anim\.js/.test(changed), 'other rule files and the landing animation are not in the diff');

function dom() {
  const byId = {};
  function el(tag) {
    const node = { tagName: String(tag || 'div').toUpperCase(), children: [], style: {}, attrs: {}, className: '', id: '', textContent: '', parentNode: null,
      classList: null, _k: undefined };
    node.classList = { toggle(n, v) { const has = (' ' + node.className + ' ').includes(' ' + n + ' '); const on = v === undefined ? !has : !!v; const parts = node.className.split(/\s+/).filter(Boolean).filter(x => x !== n); if (on) parts.push(n); node.className = parts.join(' '); return on; } };
    node.setAttribute = (k, v) => { node.attrs[k] = String(v); if (k === 'id') { node.id = String(v); byId[node.id] = node; } };
    node.getAttribute = k => node.attrs[k];
    node.appendChild = c => { node.children.push(c); c.parentNode = node; return c; };
    node.removeChild = c => { const i = node.children.indexOf(c); if (i >= 0) node.children.splice(i, 1); };
    node.addEventListener = () => {};
    node.removeEventListener = () => {};
    node.querySelector = () => null;
    node.querySelectorAll = () => [];
    node.getBoundingClientRect = () => ({ left: 0, top: 0, width: 320, height: 150 });
    node.getContext = () => null;
    node.scrollIntoView = () => {};
    node.offsetWidth = 10;
    node.remove = () => { if (node.parentNode) node.parentNode.removeChild(node); };
    return node;
  }
  const head = el('head'), body = el('body');
  const document = {
    head, body, documentElement: el('html'), currentScript: null,
    getElementById: id => byId[id] || null,
    createElement: tag => el(tag),
    addEventListener: () => {},
    querySelector: () => null,
    querySelectorAll: () => []
  };
  const toasts = el('div'); toasts.id = 'toasts'; byId.toasts = toasts; body.appendChild(toasts);
  const wheel = el('div'); wheel.id = 'pepeWheel'; byId.pepeWheel = wheel;
  const sent = [];
  const state = { tip: 975337, rows: [{ tx_hash: 'confirmed-old' }], mempool: [], sel: [], ops: [] };
  const pet = { id: 7, owner: 'bc1qgmoney', dead: false, released: false, stage: 3, species: 'pepe', name: 'G', openSlots: ['head'], tier: 1 };
  const world = { tip: 975337, pets: [pet], itemList: [], items: {}, byId: { 7: pet }, log: [] };
  const tracker = [{ txid: 'mempoolut', tag: UT, status: 'sent' }];
  const pending = [UT];
  const win = {
    document, location: { search: '', hash: '', hostname: 'xcpets.fun' },
    navigator: { userAgent: 'node' },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    addEventListener() {}, removeEventListener() {},
    requestAnimationFrame: () => 0, cancelAnimationFrame() {},
    setTimeout, clearTimeout, performance, URLSearchParams, URL,
    devicePixelRatio: 1,
    V2UI: {
      ME: 'bc1qgmoney', S: () => state, world: () => world, mine: () => [pet],
      myPendingTags: () => pending.slice(),
      confirmPlans: (title, plans) => { sent.push({ title, plans }); },
      viewOnly: () => false
    },
    V2Rules: {
      wheelOn: () => true, wheelPool: () => [pet], COSTS: { roll: 86.25 },
      buildTag: kind => (kind === 'spin' ? 'pet:spin' : 'pet:' + kind),
      parseTag: tag => /^pet:ut:/.test(tag) ? { action: 'usespint', n: 140 } : /^pet:usespin/.test(tag) ? { action: 'usespin', all: /all$/i.test(tag), n: 1 } : tag === 'pet:spin' ? { action: 'spin' } : { action: 'no' },
      wornOf: () => [], GEAR_BY_ID: {}
    },
    V2Wallet: { tracker: { list: () => tracker } },
    UXB: { pendingSpins: () => 0, pendingFor: () => 0, pendingForIds: () => 0 }
  };
  win.window = win; win.self = win; win.globalThis = win;
  return { win, sent, state, tracker, pending };
}

function loadShop(win) {
  const ctx = vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/v2-shop.js'), 'utf8'), ctx, { filename: 'js/v2-shop.js' });
  return ctx.V2Shop;
}

(async () => {
  const g = dom();
  const Shop = loadShop(g.win);
  const W = Shop._wheel, tag = [{ tag: UT, n: 140 }];
  ok(W.savedDup(tag, [UT]) === true, 'the same pet:ut plan already pending is a duplicate');
  ok(W.savedDup([{ tag: 'pet:ut:10:EL:OTHER' }], [UT]) === false, 'a different saved-spin plan is not a duplicate');
  ok(W.savedDup([{ tag: 'pet:spin' }], ['pet:spin']) === false, 'a paid pet:spin is not blocked as a saved-spin duplicate');
  ok(W.savedDup([{ tag: 'pet:usespin:all' }], ['pet:usespin:all']) === true, 'a repeated Use-all tag is a duplicate');
  ok(W.rate(1000, 2000, false) === 0.012 && W.rate(2000, 2000, false) === 0 && W.rate(1000, 5000, true) === 0, 'rate is the short spin only, and reduced motion is still');
  ok(W.phase(1000, 2000, 1, false) === 'spin' && W.phase(3000, 2000, 1, false) === 'wait' && W.phase(3000, 2000, 0, false) === 'idle', 'phase is spin, then wait, then idle');
  ok(W.phase(1000, 5000, 1, true) === 'wait', 'reduced motion skips the spin and still shows waiting');
  ok(W.caption(true, 'wait') === 'PEPE WHEEL \u00b7 WAITING' && W.caption(true, 'idle') === 'PEPE WHEEL \u00b7 TAP TO SPIN', 'captions match the phase');

  const a0 = W.tick(performance.now());
  await sleep(80);
  const a1 = W.tick(performance.now());
  ok(a0.phase === 'wait' && a1.phase === 'wait' && a1.ang === a0.ang && a1.flight === 1, 'a pending saved-spin burn holds the wheel still and counts as in flight');
  ok(W.note().includes('Waiting for the next block') && W.note().includes('keep using the shop'), 'the panel note names the wait and leaves the shop open');
  const before = g.sent.length;
  ok(W.hold(tag) === true && g.sent.length === before, 'holding the same saved-spin plan does not open a confirm');
  ok(g.win.document.getElementById('toasts').children.some(n => /already waiting/.test(n.textContent)), 'the duplicate shows a waiting toast');
  ok(W.hold([{ tag: 'pet:usespin' }]) === false, 'a different saved-spin tag is not held');
  W.burn();
  ok(g.sent.some(s => s.plans && s.plans[0] && s.plans[0].tag === 'pet:spin'), 'a deliberate paid spin still opens confirm while a saved spin is in flight');
  const angWait = Shop._state().ang;
  Shop._spinFx();
  await sleep(180);
  const mid = W.tick(performance.now());
  ok(mid.phase === 'spin' && mid.ang > angWait, 'sending a roll still plays the short spin');
  await sleep(3400);
  const done = W.tick(performance.now());
  await sleep(200);
  const held = W.tick(performance.now());
  ok(done.phase === 'wait' && held.phase === 'wait' && held.ang === done.ang && held.caption.indexOf('WAITING') >= 0, 'after the short spin the wheel waits, still, until the burn confirms');

  g.win.__shopReduced = true;
  const redAng = Shop._state().ang;
  Shop._spinFx();
  const red = W.tick(performance.now());
  ok(red.ang === redAng && red.phase === 'wait', 'reduced motion does not spin while the burn is in flight');

  await browser();
  console.log('wheel-wait-test: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e && e.stack || e); process.exit(1); });

async function browser() {
  let chromium;
  try { chromium = require('playwright-core').chromium; } catch (e) { ok(false, 'playwright-core is installed (browser check)'); return; }
  const html = `<!doctype html><meta charset="utf-8"><title>Pepe Wheel wait</title>
<style>body{margin:16px;background:#12081f;color:#fff}#shopScene canvas{width:640px;height:300px;image-rendering:pixelated;image-rendering:crisp-edges;border:3px solid #e8b84a}#shopCounter{max-width:640px;margin-top:12px}#toasts{min-height:1.2em;color:#fff1a8;font-weight:700}</style>
<div id="toasts"></div><div id="invPanel"><div id="shopScene"></div><div id="shopCounter"></div></div>
<script>
const orig = window.matchMedia.bind(window);
window.matchMedia = q => String(q).includes('prefers-reduced-motion') ? { matches: false, addEventListener(){}, removeEventListener(){} } : orig(q);
const ME = 'bc1qgmoney';
const UT = ${JSON.stringify(UT)};
const pet = { id: 7, owner: ME, dead: false, released: false, stage: 3, species: 'pepe', name: 'G Money', openSlots: ['head','hand','body','back','face','feet'], tier: 1 };
const gear = { gid: 'g1', item: 'hard-hat', owner: ME, slot: 'head', tier: 1, label: 'Hard hat', on: null };
window.__sent = [];
window.__pending = [UT];
window.__tracker = [{ txid: 'mempoolut', tag: UT, status: 'sent' }];
window.__paid = 0;
window.__w = { tip: 975337, pets: [pet], itemList: [gear], items: { g1: gear }, byId: { 7: pet }, log: [] };
window.__st = { tip: 975337, rows: [{ tx_hash: 'confirmed-old' }], mempool: [], sel: [], ops: [], hashes: {} };
window.V2UI = { ME, S: () => __st, world: () => __w, mine: () => __w.pets.filter(p => p.owner === ME && !p.dead), myPendingTags: () => __pending.slice(), confirmPlans: (title, plans) => { __sent.push({ title, tag: plans && plans[0] && plans[0].tag }); }, viewOnly: () => false, toast(){}, save(){}, render(){}, refreshGear(){} };
window.V2Rules = { wheelOn: () => true, wheelPool: () => __w.pets, spinsOn: () => true, spinsLeft: () => 200, spinTargetOn: () => false, useAllOn: () => false, SPINS_MAX_PER_BURN: 10, COSTS: { roll: 86.25 }, allSlotsNow: () => true, wornOf: () => [], speciesLabel: s => s, slotLabel: s => s, slotOpen: (p, sl) => (p.openSlots || []).indexOf(sl) >= 0, equipCheck: () => ({ ok: true, gid: 'g1' }), GEAR_BY_ID: { 'hard-hat': { id: 'hard-hat', slot: 'head', tier: 1, label: 'Hard hat' } }, buildTag: k => k === 'spin' ? 'pet:spin' : 'pet:' + k, useSpinPlan: n => ({ tag: n > 1 ? 'pet:usespin:' + n : 'pet:usespin', n: n }), useAllSpinsPlan: n => ({ tag: 'pet:usespin:all', n: n, all: true }), parseTag: tag => /^pet:ut:/.test(tag) ? { action: 'usespint', n: 140 } : /^pet:usespin/.test(tag) ? { action: 'usespin', all: /all$/i.test(tag), n: 1 } : tag === 'pet:spin' ? { action: 'spin' } : { action: 'no' } };
window.V2Mock = { ME, state: () => ({ tip: 975337 }) };
window.V2Render = { iconCanvas: () => document.createElement('canvas'), framesWith: () => null, drawSprite(){}, paint(){}, spriteCanvas: () => null };
window.UXB = { pendingSpins: () => __paid, pendingFor: () => 0, pendingForIds: () => 0 };
window.V2Wallet = { tracker: { list: () => __tracker }, label: () => 'XCP Wallet' };
</script>`;
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/google/chrome/chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: path.join(ROOT, 'js/v2-shop.js') });
    await page.evaluate(() => V2Shop.render(window.__w));
    await page.waitForSelector('#shopScene canvas');
    await page.waitForSelector('.wh-wait');
    await sleep(700);
    const still = await page.evaluate(() => {
      const S = V2Shop._state();
      const note = document.querySelector('.wh-wait');
      const spin = document.getElementById('whSpin');
      const dress = document.getElementById('drEnter');
      return {
        ang: S.ang, phase: document.querySelector('#shopScene canvas').getAttribute('aria-label'),
        tap: document.querySelector('.wh-tap').getAttribute('aria-label'),
        note: note ? note.textContent : '',
        spinOff: !!(spin && spin.disabled), dressOff: !!(dress && dress.disabled),
        spinText: spin ? spin.textContent : ''
      };
    });
    await sleep(900);
    const later = await page.evaluate(() => V2Shop._state().ang);
    ok(still.ang === 0 && later === still.ang, 'on screen, a pending saved-spin burn does not turn the wheel (' + still.ang + ' -> ' + later + ')');
    ok(/waiting for the next block/i.test(still.phase), 'the scene label says the roll is waiting for the next block');
    ok(still.tap === 'Waiting for the next block', 'the wheel control is labelled waiting, not spinning');
    ok(/Waiting for the next block/.test(still.note) && /keep using the shop/.test(still.note), 'the panel shows the in-flight note');
    ok(!still.spinOff && !still.dressOff, 'Spin and Dressing room stay enabled during the wait');
    ok(/Waiting for the next block/.test(still.spinText), 'the spin button says the roll is waiting for the next block');
    fs.mkdirSync('/opt/cursor/artifacts', { recursive: true });
    await page.screenshot({ path: '/opt/cursor/artifacts/pepe-wheel-waiting.png' });

    const sent0 = await page.evaluate(() => __sent.length);
    await page.click('.wh-tap');
    await sleep(100);
    const afterTap = await page.evaluate(() => ({ n: __sent.length, toast: document.getElementById('toasts').innerText, dress: !document.getElementById('drEnter').disabled }));
    ok(afterTap.n === sent0 && /already waiting/.test(afterTap.toast), 'tapping the wheel during the wait does not open another burn');
    ok(afterTap.dress, 'the dressing room button is still enabled after that tap');

    await page.click('#whSpin');
    const paid = await page.evaluate(() => __sent.map(s => s.tag));
    ok(paid.indexOf('pet:spin') >= 0, 'the Spin button still opens a paid spin while a saved spin is in flight');

    const gear = await page.evaluate(() => {
      const c = document.querySelector('#shopScene canvas'), r = c.getBoundingClientRect();
      return { x: r.x + r.width * (20 / 320), y: r.y + r.height * (30 / 150) };
    });
    await page.mouse.click(gear.x, gear.y);
    await sleep(50);
    const sel = await page.evaluate(() => { const s = V2Shop._state().sel; return s && s.gid; });
    ok(sel === 'g1', 'a gear card on the wall still selects while the roll is in flight');

    await page.click('[data-usespin="1"]');
    const once = await page.evaluate(() => __sent.filter(s => s.tag === 'pet:usespin').length);
    ok(once === 1, 'a different saved-spin plan can still be opened');
    await page.evaluate(() => { __pending.push('pet:usespin'); __tracker.push({ txid: 'usespin1', tag: 'pet:usespin', status: 'sent' }); });
    await page.click('[data-usespin="1"]');
    const twice = await page.evaluate(() => __sent.filter(s => s.tag === 'pet:usespin').length);
    const toast2 = await page.evaluate(() => document.getElementById('toasts').innerText);
    ok(twice === 1 && /saved-spin burn is already waiting/.test(toast2), 'the same Use 1 plan is not sent again while it is unconfirmed');

    await page.evaluate(() => { const S = V2Shop._state(); S.spinUntil = 0; });
    const beforeSpin = await page.evaluate(() => V2Shop._state().ang);
    await page.evaluate(() => V2Shop._spinFx());
    await sleep(250);
    const spinning = await page.evaluate(() => ({ ang: V2Shop._state().ang, label: document.querySelector('#shopScene canvas').getAttribute('aria-label') }));
    ok(spinning.ang > beforeSpin && /short spin/i.test(spinning.label), 'the short send spin still plays on screen');
    await page.screenshot({ path: '/opt/cursor/artifacts/pepe-wheel-short-spin.png' });
    await sleep(3300);
    const parked = await page.evaluate(() => V2Shop._state().ang);
    await sleep(600);
    const parked2 = await page.evaluate(() => ({ ang: V2Shop._state().ang, label: document.querySelector('#shopScene canvas').getAttribute('aria-label') }));
    ok(parked2.ang === parked && /waiting for the next block/i.test(parked2.label), 'when the short spin ends the wheel stays put and reads as waiting');
    await page.screenshot({ path: '/opt/cursor/artifacts/pepe-wheel-after-spin.png' });

    await page.click('#drEnter');
    await page.waitForFunction(() => location.hash === '#dressing-room', null, { timeout: 3000 });
    const dressOpen = await page.evaluate(() => ({ hash: location.hash, room: !!document.getElementById('rrDress'), back: !!document.getElementById('drBack') && !document.getElementById('drBack').disabled }));
    ok(dressOpen.hash === '#dressing-room' && dressOpen.room && dressOpen.back, 'the dressing room still opens during the mempool wait');
    await page.screenshot({ path: '/opt/cursor/artifacts/pepe-wheel-dressing-room.png' });
    ok(!errors.length, 'the shop scene raised no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  } finally { await browser.close(); }
}
