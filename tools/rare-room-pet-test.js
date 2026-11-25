#!/usr/bin/env node
/* Rare Room from a pet page opens that pet. Display and navigation only.
 * A pet past the first owner page is missing at first paint. The saved key must not
 * lock the room, and the link from the pet page has to carry the id.
 * Read-only: 1JwWs… (8 pets) and bc1qs88… (past the first 24). Nothing is signed. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), vm = require('vm'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const SMALL = '1JwWsArppwALMEdXWPmpDBcP1jwWsAPYkD';
const READ = 'bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n';
const BANNED = 'bc1ps9av86ymmlzy9zj3a8pn6g94pz4j5e0kagv3td3wutaagfjvekjs26m3s4';
let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (c) pass++; else fail++; };
function rd(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function md5(buf) { return crypto.createHash('md5').update(buf).digest('hex'); }
function git(rel) { return cp.execSync('git show origin/main:' + rel, { cwd: ROOT }); }

(function source() {
  ok(md5(rd('js/v2-rules.js')) === md5(git('js/v2-rules.js')), 'js/v2-rules.js matches origin/main (' + md5(rd('js/v2-rules.js')) + ')');
  ok(/loading owners/.test(rd('js/v2.js')), 'js/v2.js waits for owners before an unleash, feed or breed');
  ok(/function noteHealth\(/.test(rd('js/v2-split.js')) && /pack\.stash/.test(rd('js/v2-split.js')), 'js/v2-split.js keeps the unleash health tip and the stash');
  ['js/v2-shop.js', 'js/v2-preselect.js', 'js/v2-places.js', 'js/v2-pet-card.js', 'js/v2-pages.js'].forEach(function (f) {
    ok(rd(f).indexOf(BANNED) < 0, f + ' does not name the banned wallet');
  });
  const shop = rd('js/v2-shop.js'), pre = rd('js/v2-preselect.js'), places = rd('js/v2-places.js'), card = rd('js/v2-pet-card.js'), pages = rd('js/v2-pages.js');
  ok(/function rrTake\(/.test(shop) && /V2Split\.ensurePet\(id\)/.test(shop) && /hold === 'wait'/.test(shop) && /Opening #/.test(shop), 'counter waits and calls ensurePet instead of locking a fallback');
  ok(/hold !== 'later' && !P && !S\.dpInit/.test(shop), 'the saved key is used only when no URL pet is still pending');
  ok(/document\.prerendering/.test(pre) && /__navPre\.reload/.test(pre) && /V2Preselect/.test(pre) && /pending: function/.test(pre), 'preselect keeps the id and does not strip the hash on a prerender reload');
  ok(/function stampRare\(/.test(places) && /rare-room\.html#rare-room-/.test(places) && /data-v2page'\) === 'pet'/.test(places), 'Places nav on a pet page carries the pet id');
  ok(/passRr = !known \|\| !!mine/.test(card) && /passRr \? 'rare-room-' \+ p\.id : 'rare-room'/.test(card), 'the card button keeps the id when the pet is yours or the wallet is unknown');
  ok(/!ME \|\| p\.owner === ME \? 'Change this pet\\'s gear in the <a href="rare-room\.html#rare-room-' \+ p\.id/.test(pages), 'the gear link keeps the id when the pet is yours or the wallet is unknown');
  const room = rd('rare-room.html'), pet = rd('pet.html');
  ok(/js\/v2\.js\?v=[0-9a-z]+/.test(room) && /js\/v2-split\.js\?v=[0-9a-z]+/.test(room) && /js\/v2-art\.js\?v=[0-9a-z]+/.test(room), 'rare-room.html loads v2.js, v2-art.js and v2-split.js with a cache-busting token');
  ok(/js\/v2-preselect\.js\?v=[0-9a-z]+/.test(room) && /js\/v2-shop\.js\?v=[0-9a-z]+/.test(room), 'rare-room.html loads the new preselect and shop');
  ok(/js\/v2-pet-card\.js\?v=[0-9a-z]+/.test(pet) && /js\/v2-pages\.js\?v=[0-9a-z]+/.test(pet) && /js\/v2-places\.js\?v=[0-9a-z]+/.test(pet), 'pet.html loads the new card, page and places scripts');
  ok(/js\/v2-split\.js\?v=[0-9a-z]+/.test(pet) && /js\/v2-art\.js\?v=[0-9a-z]+/.test(pet), 'pet.html loads v2-art.js and v2-split.js with a cache-busting token');
})();

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function memStore(init) {
  const mem = Object.assign({}, init || {});
  return { getItem: function (k) { return k in mem ? mem[k] : null; }, setItem: function (k, v) { mem[k] = String(v); }, removeItem: function (k) { delete mem[k]; }, mem: mem };
}
function node() {
  const n = { id: '', innerHTML: '', style: {}, textContent: '', className: '', attrs: {}, children: [] };
  n.classList = { add() {}, remove() {}, toggle() {}, contains() { return false; } };
  n.setAttribute = function (k, v) { n.attrs[k] = String(v); if (k === 'id') n.id = String(v); };
  n.getAttribute = function (k) { return n.attrs[k]; };
  n.appendChild = function () {};
  n.remove = function () {};
  n.querySelector = function () { return null; };
  n.querySelectorAll = function () { return []; };
  n.addEventListener = function () {};
  n.getContext = function () { return null; };
  return n;
}

function bootShop(opts) {
  const store = memStore(opts.ls || {});
  const byId = {};
  const box = node(); box.id = 'shopCounter'; byId.shopCounter = box;
  const inv = node(); inv.id = 'invPanel'; byId.invPanel = inv;
  const docOn = {};
  const document = {
    head: node(), body: node(), documentElement: node(), currentScript: null,
    readyState: 'complete', prerendering: false,
    getElementById: function (id) { return byId[id] || null; },
    createElement: function () { return node(); },
    addEventListener: function (ev, fn) { (docOn[ev] = docOn[ev] || []).push(fn); },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; }
  };
  const location = { hash: opts.hash || '', search: '', pathname: '/rare-room.html', hostname: 'xcpets.fun' };
  const history = { replaceState: function (_a, _b, url) { const h = String(url).split('#')[1] || ''; location.hash = h ? '#' + h : ''; } };
  const ensured = [];
  const world = opts.world;
  const win = {
    document: document, location: location, history: history, localStorage: store,
    navigator: { userAgent: 'node' },
    matchMedia: function () { return { matches: false, addEventListener() {}, removeEventListener() {} }; },
    addEventListener: function () {}, removeEventListener: function () {}, dispatchEvent: function () {},
    requestAnimationFrame: function (fn) { const t = setTimeout(fn, 0); if (t.unref) t.unref(); return t; },
    cancelAnimationFrame: function () {},
    setTimeout: setTimeout, clearTimeout: clearTimeout, performance: performance, URLSearchParams: URLSearchParams, URL: URL, Event: Event,
    devicePixelRatio: 1,
    fetch: function () { return Promise.reject(new Error('no')); },
    V2UI: {
      ME: opts.me || '',
      S: function () { return { tip: 1, sel: [], rows: [], ops: [] }; },
      world: function () { return world; },
      mine: function (w) { return (w.pets || []).filter(function (p) { return p.owner === win.V2UI.ME && !p.dead && !p.released; }); },
      viewOnly: function () { return true; },
      confirmPlans: function () {}, toast: function () {}, save: function () {}, render: function () {},
      myPendingTags: function () { return []; }
    },
    V2Rules: {
      wheelOn: function () { return true; }, wheelPool: function () { return []; }, allSlotsNow: function () { return true; },
      wornOf: function () { return []; }, speciesLabel: function (s) { return s; }, slotLabel: function (s) { return s; }, slotOpen: function () { return false; },
      COSTS: { roll: 345 }, GEAR_BY_ID: {}
    },
    V2Mock: { ME: opts.me || '', state: function () { return { tip: 1 }; }, world: function () { return world; } },
    V2Split: { ensurePet: function (id) { ensured.push(id | 0); return opts.ensure ? opts.ensure(id | 0) : Promise.resolve(null); } }
  };
  win.window = win; win.self = win; win.globalThis = win;
  const ctx = vm.createContext(win);
  if (opts.preselect) vm.runInContext(rd('js/v2-preselect.js'), ctx, { filename: 'js/v2-preselect.js' });
  vm.runInContext(rd('js/v2-own.js'), ctx, { filename: 'js/v2-own.js' }); /* the pages load it before v2-shop.js (living-pet checks ask V2Own, #260) */
  vm.runInContext(rd('js/v2-shop.js'), ctx, { filename: 'js/v2-shop.js' });
  return { win: win, store: store, box: box, ensured: ensured };
}

function pet(id, owner, stage) {
  return { id: id, owner: owner, name: 'P' + id, species: 'pepe', stage: stage || 1, tier: 1, dead: false, released: false, openSlots: ['head'] };
}
function worldOf(pets) {
  const w = { pets: pets.slice(), byId: {}, itemList: [], items: {}, log: [] };
  pets.forEach(function (p) { w.byId[p.id] = p; });
  return w;
}

function bootPre(opts) {
  const store = memStore(opts.ls || {});
  const docOn = {};
  const location = { hash: opts.hash || '', search: '', pathname: '/rare-room.html' };
  let replaced = 0;
  const document = {
    prerendering: !!opts.prerender, readyState: 'complete',
    getElementById: function () { return null; },
    addEventListener: function (ev, fn) { (docOn[ev] = docOn[ev] || []).push(fn); }
  };
  const win = {
    document: document, location: location, localStorage: store,
    history: { replaceState: function (_a, _b, url) { replaced++; const h = String(url).split('#')[1] || ''; location.hash = h ? '#' + h : ''; } },
    addEventListener: function () {}, dispatchEvent: function () {},
    setTimeout: setTimeout, clearTimeout: clearTimeout
  };
  win.window = win; win.self = win; win.globalThis = win;
  vm.runInContext(rd('js/v2-preselect.js'), vm.createContext(win), { filename: 'js/v2-preselect.js' });
  return { win: win, store: store, fire: function (ev) { (docOn[ev] || []).forEach(function (fn) { fn(); }); }, replaced: function () { return replaced; } };
}

(async function () {
  const open = bootPre({ hash: '#rare-room-4242', prerender: false });
  ok(open.win.location.hash === '#rare-room' && open.replaced() === 1, 'a normal open rewrites #rare-room-4242 to #rare-room');
  ok(open.win.V2Preselect.pending() === 4242 && open.store.mem['xcpets-v2-dr-pet'] === '4242', 'the id stays pending after the hash rewrite (' + open.win.V2Preselect.pending() + ')');

  const pre = bootPre({ hash: '#rare-room-5150', prerender: true, ls: { 'xcpets-v2-dr-pet': '7' } });
  ok(pre.win.location.hash === '#rare-room-5150' && pre.replaced() === 0, 'a prerender keeps #rare-room-5150 until the page is really open');
  ok(pre.win.V2Preselect.pending() === 5150 && pre.store.mem['xcpets-v2-dr-pet'] === '5150', 'the prerender still remembers 5150 over the stale key');
  pre.win.__navPre = { reload: 1 };
  pre.win.document.prerendering = false;
  pre.fire('prerenderingchange');
  await sleep(20);
  ok(pre.win.location.hash === '#rare-room-5150' && pre.replaced() === 0, 'a prerender reload leaves the hash, so the id is not thrown away');

  const stay = bootPre({ hash: '#rare-room-6161', prerender: true });
  stay.win.document.prerendering = false;
  stay.fire('prerenderingchange');
  await sleep(20);
  ok(stay.win.location.hash === '#rare-room' && stay.win.V2Preselect.pending() === 6161, 'once the prerender is shown, the hash becomes #rare-room and the id is still pending');

  const rare = { href: 'rare-room.html', attrs: { href: 'rare-room.html' }, setAttribute: function (k, v) { this.attrs[k] = v; if (k === 'href') this.href = v; }, getAttribute: function (k) { return this.attrs[k]; } };
  const pdoc = {
    body: { getAttribute: function (k) { return k === 'data-v2page' ? 'pet' : null; } },
    readyState: 'complete',
    getElementById: function () { return null; },
    createElement: function () { return node(); },
    querySelector: function () { return null; },
    querySelectorAll: function (sel) { return sel === 'a.np-rare' ? [rare] : []; },
    addEventListener: function () {}
  };
  const pwin = {
    document: pdoc, location: { pathname: '/pet.html', search: '?id=88', hash: '' },
    addEventListener: function () {},
    requestAnimationFrame: function (fn) { const t = setTimeout(fn, 0); if (t.unref) t.unref(); return t; },
    URLSearchParams: URLSearchParams
  };
  pwin.window = pwin; pwin.self = pwin; pwin.globalThis = pwin;
  vm.runInContext(rd('js/v2-places.js'), vm.createContext(pwin), { filename: 'js/v2-places.js' });
  ok(rare.href === 'rare-room.html#rare-room-88', 'Places on pet.html?id=88 points at #rare-room-88 before ownership is known');
  pwin.V2Places.stampRare(88, false);
  ok(rare.href === 'rare-room.html', 'once the pet is known to be someone else\'s, the Places link drops the id');
  pwin.V2Places.stampRare(88, true);
  ok(rare.href === 'rare-room.html#rare-room-88', 'a pet that is yours puts the id back on Places');

  const base = 'https://node.xcpets.fun';
  const latest = await (await fetch(base + '/xp/v1/world/latest.json')).json();
  const man = latest.manifest || latest.url;
  const folder = (String(man).indexOf('http') === 0 ? man : base + man).replace(/[^/]+$/, '');
  async function sha(s) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return Buffer.from(d).toString('hex'); }
  const urls = [];
  async function grab(url) {
    urls.push(url);
    const r = await fetch(url);
    if (!r.ok) throw new Error(url + ' ' + r.status);
    return r.json();
  }
  async function own(addr, n) {
    const hex = await sha(addr);
    return grab(folder + 'view/own/' + hex + (n ? '.' + n : '') + '.json');
  }
  const read0 = await own(READ, 0), read1 = await own(READ, 1), small0 = await own(SMALL, 0);
  const ids0 = {};
  (read0.pets || []).forEach(function (p) { ids0[p.id] = p; });
  const living0 = (read0.pets || []).filter(function (p) { return p && p.owner === READ && !p.dead && !p.released; });
  const laterPet = (read1.pets || []).filter(function (p) { return p && p.owner === READ && !p.dead && !p.released && !ids0[p.id]; })[0];
  const later = laterPet || (read1.ids && read1.ids[0] && !ids0[read1.ids[0]] ? { id: read1.ids[0] } : null);
  const smallLiving = (small0.pets || []).filter(function (p) { return p && p.owner === SMALL && !p.dead && !p.released; });
  ok(living0.length > 0 && living0.length <= 24 && later && later.id, 'bc1qs88… page 0 has ' + living0.length + ' living pets and page 1 has #' + (later && later.id));
  ok(smallLiving.length >= 2 && smallLiving.length <= 24, '1JwWs… has ' + smallLiving.length + ' living pets on page 0');
  const stale = living0.slice().sort(function (a, b) { return (a.stage || 0) - (b.stage || 0) || a.id - b.id; })[0];
  const top = living0.slice().sort(function (a, b) { return (b.stage || 0) - (a.stage || 0) || (b.tier || 0) - (a.tier || 0) || a.id - b.id; })[0];
  ok(stale && stale.id !== later.id && !ids0[later.id], 'stale key #' + (stale && stale.id) + ' is on page 0 and #' + later.id + ' is past it');

  async function shardPet(id) {
    const name = ('00000' + Math.floor(id / 2000)).slice(-5);
    const pack = await grab(folder + 'view/p/' + name + '.json');
    return pack && pack.pets && pack.pets[String(id)];
  }
  const fetched = await shardPet(later.id);
  ok(fetched && fetched.id === later.id && (fetched.owner === READ || fetched.o != null) && !fetched.dead, 'ensurePet shard for #' + later.id + ' is that pet (owner ' + (fetched && (fetched.owner || ('o:' + fetched.o))) + ')');
  ok(urls.every(function (u) { return u.indexOf('/view/own/') >= 0 || u.indexOf('/view/p/') >= 0; }) && urls.every(function (u) { return u.indexOf(BANNED) < 0; }), 'reads are owner pages and one pet shard, not the banned wallet');

  const w = worldOf(living0.map(function (p) { return pet(p.id, READ, p.stage || 1); }));
  let ensureJob = null;
  const room = bootShop({
    me: READ, hash: '#rare-room-' + later.id, world: w,
    ls: { 'xcpets-v2-dr-pet': String(stale.id) },
    preselect: true,
    ensure: function (id) {
      ensureJob = shardPet(id).then(function (p) {
        if (p && !p.owner) p.owner = READ;
        return p || null;
      });
      return ensureJob;
    }
  });
  ok(room.store.mem['xcpets-v2-dr-pet'] === String(later.id), 'preselect writes the URL pet before the room paints');
  room.store.setItem('xcpets-v2-dr-pet', String(stale.id));
  ok(room.win.V2Preselect.pending() === later.id && room.win.location.hash === '#rare-room', 'pending stays #' + later.id + ' after the hash is stripped and the saved key is stale #' + stale.id);
  room.win.V2Shop.refreshRoll();
  const mid = room.win.V2Shop._state();
  ok(room.ensured.length === 1 && room.ensured[0] === later.id, 'the missing pet is requested with ensurePet (#' + room.ensured.join(',') + ')');
  ok(mid.pet == null && !mid.dpInit && room.store.mem['xcpets-v2-dr-pet'] === String(stale.id), 'while #' + later.id + ' is loading, the room does not lock #' + stale.id + ' or the strip');
  ok(/Opening #/.test(room.box.innerHTML) && room.box.innerHTML.indexOf('#' + later.id) >= 0, 'the room says it is opening #' + later.id);
  const got = await ensureJob;
  await sleep(0);
  const done = room.win.V2Shop._state();
  ok(got && got.id === later.id && done.pet === later.id && done.pet !== stale.id && done.pet !== top.id, 'the room opens #' + done.pet + ', not the stale key #' + stale.id + ' or the strip top #' + top.id);

  const loaded = worldOf(smallLiving.map(function (p) { return pet(p.id, SMALL, p.stage || 1); }));
  const a = smallLiving[0], b = smallLiving[smallLiving.length - 1];
  const pick = bootShop({
    me: SMALL, world: loaded, ls: { 'xcpets-v2-dr-pet': String(a.id) },
    preselect: false,
    ensure: function () { return Promise.reject(new Error('should already be loaded')); }
  });
  pick.win.__XCPETS_RR_PET = b.id;
  pick.win.V2Shop.refreshRoll();
  ok(pick.ensured.length === 0 && pick.win.V2Shop._state().pet === b.id && pick.win.V2Shop._state().pet !== a.id, 'a loaded pet from the URL (#' + b.id + ') beats the saved key #' + a.id);

  let foreignJob = null;
  const foreign = bootShop({
    me: READ, world: w, ls: { 'xcpets-v2-dr-pet': String(stale.id) },
    ensure: function (id) { foreignJob = shardPet(id); return foreignJob; }
  });
  foreign.win.__XCPETS_RR_PET = smallLiving[0].id;
  foreign.win.V2Shop.refreshRoll();
  await foreignJob;
  await sleep(0);
  const fell = foreign.win.V2Shop._state();
  ok(foreign.ensured.indexOf(smallLiving[0].id) >= 0 && fell.pet === stale.id && fell.pet !== smallLiving[0].id, 'a pet that is not yours (#' + smallLiving[0].id + ') falls back to the saved pet #' + fell.pet);

  const earlyWorld = worldOf(living0.map(function (p) { return pet(p.id, READ, p.stage || 1); }));
  const early = bootShop({
    me: '', world: earlyWorld, hash: '#rare-room-' + later.id, ls: { 'xcpets-v2-dr-pet': String(stale.id) },
    ensure: function (id) { return shardPet(id); }
  });
  early.win.V2Shop.refreshRoll();
  const held = early.win.V2Shop._state();
  ok(early.ensured.length === 0 && held.pet == null && !held.dpInit && early.win.location.hash === '#rare-room-' + later.id, 'before the wallet is known, the URL pet is not swapped for the saved key');
  early.win.V2UI.ME = READ;
  early.win.V2Mock.ME = READ;
  early.win.V2Shop.refreshRoll();
  ok(early.ensured[0] === later.id && early.win.V2Shop._state().pet == null, 'once the wallet is known, the still-missing pet is fetched and not locked');

  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.error(e && e.stack || e); process.exit(1); });
