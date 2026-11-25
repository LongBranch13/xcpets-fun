#!/usr/bin/env node
/* Other-wallet lookup. The light view does not load the whole board. A typed wallet
 * reads that wallet's owner pages, capped at one screen, and a typed pet number uses
 * V2Split.ensurePet. Display only: nothing is signed or sent.
 * Wallets: 8 pets, the 40k wallet (capped), and the read-only 2,370-pet wallet.
 * The owner wallet used by other perf tests is not used here. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const SMALL = '1JwWsArppwALMEdXWPmpDBcP1jwWsAPYkD';
const HUGE = 'bc1qtke38j72qv4d8eljn7pccaykypw8luytfwdn7q';
const READ = 'bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n';
const BANNED = 'bc1ps9av86ymmlzy9zj3a8pn6g94pz4j5e0kagv3td3wutaagfjvekjs26m3s4';
let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (c) pass++; else fail++; };
function rd(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function md5(rel) { return crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex'); }

ok(md5('js/v2-rules.js') === require('./lib/rules-md5').MAIN, 'rules MD5 unchanged');
const look = rd('js/v2-lookup.js'), easy = rd('js/v2-easy-flows.js'), ui = rd('js/v2.js'), arena = rd('js/v2-arena.js'), hall = rd('js/v2-rare-hall.js'), dock = rd('js/v2-lowfriction.js');
[look, easy, ui, arena, hall, dock].forEach(function (src) { ok(src.indexOf(BANNED) < 0, 'banned wallet is not in the lookup'); });
ok(/function loadOwner\(/.test(look) && /view\/own\//.test(look) && /PAGE_CAP/.test(look) && /S\.ensurePet/.test(look) && !/loadBoard/.test(look), 'lookup reads owner pages or ensurePet, never loadBoard');
ok(/Loading…/.test(look) && /No living pets published/.test(look) && /Could not load that/.test(look), 'loading, empty and error text');
ok(/look: sd === 'B' \? 'breed'/.test(easy) && /look: side === 'B' \? 'fight'/.test(easy) && /V2Lookup\.warm/.test(easy) && /function autoLook\(/.test(rd('js/v2-pick.js')) && !/pkLookAt|pkFLookAt/.test(easy), 'Gooby dates and fight opponents: one search box that also looks up a pet number or wallet');
ok(/V2Lookup\.mount\(\$\('battlePanel'\)/.test(ui) && /fighters\(w, ME, true\)/.test(ui), 'battle select still uses fighters and can look a wallet up');
ok(/V2Lookup\.mount\(\$\('battlePanel'\) \|\| box/.test(arena) && /U\.fighters\(w, ME, true\)/.test(arena), 'arena opponent list can look a wallet up');
ok(/function finds\(w\)/.test(hall) && /placeLook\(/.test(hall) && /does not load the whole world/.test(hall) && !/loadBoard/.test(hall), 'rare hall keeps finds() and adds a lookup');
ok(/id: 'dockLook'/.test(dock) && /No other wallet is loaded yet/.test(dock), 'motel dock Other players uses the same lookup');
ok(/js\/v2-lookup\.js/.test(rd('breed.html')) && /js\/v2-lookup\.js/.test(rd('fight.html')) && /id="rareHall"/.test(rd('rare-room.html')) && /js\/v2-rare-hall\.js/.test(rd('rare-room.html')), 'breed, fight and rare room load the lookup');

function bootLookup(extra) {
  const ctx = Object.assign({
    console: console, crypto: crypto, TextEncoder: TextEncoder, TextDecoder: TextDecoder,
    AbortController: AbortController, setTimeout: setTimeout, clearTimeout: clearTimeout,
    Promise: Promise, performance: performance, URL: URL, fetch: fetch
  }, extra || {});
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(rd('js/v2-lookup.js'), ctx, { filename: 'js/v2-lookup.js' });
  return ctx;
}
function pet(id, owner, stage) { return { id: id, owner: owner, name: 'P' + id, dead: false, released: false, stage: stage == null ? 3 : stage, neglected: false }; }
function jsonRes(obj, status) {
  const buf = Buffer.from(JSON.stringify(obj));
  return { status: status || 200, ok: (status || 200) < 400, arrayBuffer: function () { return Promise.resolve(buf); } };
}

(async function () {
  const ctx = bootLookup();
  const P = ctx.V2Lookup;
  ok(P.PAGE_CAP === 7, 'cap is one screen of owner pages (7)');
  ok(P.parse('').ok === false && /wallet address or a pet number/.test(P.parse('').error), 'empty input is an error');
  ok(P.parse('nope').ok === false, 'a word is not a wallet or a pet');
  ok(P.parse('#42').kind === 'pet' && P.parse('#42').id === 42, 'a pet number parses');
  ok(P.parse('1765').ok === false, 'pet 1765 is not looked up');
  [SMALL, HUGE, READ].forEach(function (a) { const p = P.parse(a); ok(p.ok && p.kind === 'wallet' && p.addr === a, 'address parses ' + a.slice(0, 12)); });
  ok(P.parse(HUGE.toUpperCase()).addr === HUGE, 'bc1 addresses are matched in lower case');

  const urls = [];
  function page(n, pages, alive) {
    const pets = [];
    for (let i = 0; i < 24; i++) pets.push(pet(n * 24 + i + 1, HUGE, 3));
    return { v: 2, owner: HUGE, alive: alive, pages: pages, page: n, pageSize: 24, pets: pets };
  }
  ctx.fetch = function (url) {
    urls.push(String(url));
    if (String(url).indexOf('/view/p/') >= 0) return Promise.reject(new Error('pet shard'));
    const m = /\.([0-9]+)\.json$/.exec(String(url));
    const n = m ? +m[1] : 0;
    if (n > 6) return Promise.reject(new Error('page ' + n));
    return Promise.resolve(jsonRes(page(n, 1757, 42163)));
  };
  const capped = await P.loadOwner(HUGE, { fetch: ctx.fetch, folder: 'https://example.test/view/' });
  ok(capped.ok && capped.capped && capped.loadedPages === 7 && capped.files === 7 && capped.pets.length === 168, '40k-shaped wallet loads 7 pages / 168 pets (' + capped.pets.length + ', ' + capped.files + ' files)');
  ok(capped.pages === 1757 && capped.alive === 42163 && urls.length === 7 && urls.every(function (u) { return u.indexOf('/view/own/') >= 0; }), 'it does not walk the other ' + (1757 - 7) + ' pages');
  ok(capped.bytes > 1000 && capped.ms >= 0, 'mock lookup reports bytes ' + capped.bytes + ' and ms ' + capped.ms);
  const again = await P.loadOwner(HUGE, { fetch: function () { throw new Error('refetch'); }, folder: 'https://example.test/view/' });
  ok(again.pets.length === 168 && again.bytes === capped.bytes, 'a repeated wallet lookup is served from the pages already read');

  const world = { pets: [pet(1, SMALL, 3)], byId: {}, _view: 1, _pages: { folder: 'mem://' } };
  world.byId[1] = world.pets[0];
  const live = bootLookup({
    V2Mock: {
      world: function () { return world; },
      setViewWorld: function (w) { world.pets = w.pets; world.byId = w.byId; }
    }
  });
  const added = live.V2Lookup.absorb([pet(9, HUGE, 4), pet(9, HUGE, 4), pet(1, SMALL, 3)]);
  ok(added === 1 && world.byId[9] && world.byId[9].owner === HUGE && world.pets.length === 2, 'a looked-up pet joins the world once');
  const rebuilt = { pets: [pet(1, SMALL, 3)], byId: {} };
  rebuilt.byId[1] = rebuilt.pets[0];
  live.V2Mock.setViewWorld(rebuilt);
  ok(world.byId[9] && world.byId[9].owner === HUGE, 'a later republish keeps the looked-up pet');
  const others = world.pets.filter(function (p) { return p.owner !== SMALL && !p.dead && !p.released && p.stage >= 2 && !p.neglected; });
  ok(others.length === 1 && others[0].id === 9, 'fight opponent filter sees the looked-up pet');
  const mates = world.pets.filter(function (p) { return !p.dead && !p.released && !p.community && p.owner !== SMALL; });
  ok(mates.length === 1, 'breed partner filter sees the looked-up pet');

  const miss = bootLookup();
  miss.fetch = function () { return Promise.resolve({ status: 404, ok: false, arrayBuffer: function () { return Promise.resolve(Buffer.from('')); } }); };
  const none = await miss.V2Lookup.loadOwner(READ, { fetch: miss.fetch, folder: 'https://example.test/view/' });
  ok(!none.ok && none.empty && /No living pets published/.test(none.error), 'a missing wallet is an empty state, not a throw');
  const bad = await miss.V2Lookup.load('not-a-wallet');
  ok(!bad.ok && /full wallet address or a pet number/.test(bad.error), 'a bad lookup is an error state');

  const hctx = {
    document: {
      readyState: 'complete', getElementById: function () { return null; },
      addEventListener: function () {}, createElement: function () { return { id: '' }; }
    },
    matchMedia: function () { return { matches: false }; },
    V2Render: { rareInfo: function (p) { var r = p && p.rareHatch; return r && r.version === 1 ? r : null; } },
    V2Mock: { world: function () { return null; }, state: function () { return { rows: [] }; } }
  };
  hctx.window = hctx;
  vm.createContext(hctx);
  vm.runInContext(hall, hctx, { filename: 'js/v2-rare-hall.js' });
  const rarePet = { id: 50, owner: READ, name: 'Odd', rareHatch: { version: 1, kind: 'tiny', legend: 0, god: 0, block: 3 }, art: { rareHatch: { version: 1, kind: 'tiny' } }, hatchBlock: 3 };
  const plain = { id: 51, owner: READ, name: 'Plain', hatchBlock: 4 };
  ok(hctx.V2RareHall.finds({ pets: [plain], _view: 1 }).length === 0, 'a light world with no rare pet leaves the hall empty');
  const found = hctx.V2RareHall.finds({ pets: [plain, rarePet], _view: 1 });
  ok(found.length === 1 && found[0].p.id === 50, 'a looked-up rare pet shows in the hall');

  const base = 'https://node.xcpets.fun';
  const latest = await (await fetch(base + '/xp/v1/world/latest.json')).json();
  const man = latest.manifest || latest.url;
  const folder = (man.indexOf('http') === 0 ? man : base + man).replace(/[^/]+$/, '');
  async function measure(label, addr, expect) {
    const box = bootLookup();
    const res = await box.V2Lookup.loadOwner(addr, { fetch: fetch, folder: folder });
    console.log('MEASURE ' + label + ' bytes=' + res.bytes + ' ms=' + res.ms + ' files=' + res.files + ' pets=' + res.pets.length + ' alive=' + res.alive + ' pages=' + res.pages + ' loadedPages=' + res.loadedPages + ' capped=' + res.capped);
    ok(res.ok && res.bytes > 0 && res.ms >= 0 && res.ms < 30000, label + ' lookup finished (' + res.bytes + ' bytes, ' + res.ms + ' ms)');
    ok(res.pets.length === expect.pets && res.files === expect.files && res.loadedPages === expect.loaded && !!res.capped === expect.capped, label + ' size pets=' + res.pets.length + ' files=' + res.files + ' loaded=' + res.loadedPages);
    ok(expect.alive(res.alive) && res.pets.every(function (p) { return p.owner === addr && !p.dead && !p.released; }), label + ' pets belong to that wallet (' + res.alive + ' alive)');
    return res;
  }
  const small = await measure('small', SMALL, { pets: 8, files: 1, loaded: 1, capped: false, alive: function (n) { return n === 8; } });
  await measure('huge', HUGE, { pets: 24, files: 7, loaded: 7, capped: true, alive: function (n) { return n > 20000; } });
  await measure('read', READ, { pets: 24, files: 7, loaded: 7, capped: true, alive: function (n) { return n > 1000 && n <= 5000; } });
  const petId = small.pets[0].id;
  const pctx = bootLookup({
    document: { scripts: [] },
    location: { search: '', href: 'https://xcpets.fun/breed.html', hostname: 'xcpets.fun' },
    localStorage: { getItem: function () { return ''; }, setItem: function () {} },
    V2BootSync: { base: function () { return base; }, localOnly: function () { return false; } },
    V2Mock: { world: function () { return pctx.world; }, setViewWorld: function (w) { pctx.world = w; } }
  });
  pctx.world = { pets: [], byId: {}, _view: 1 };
  vm.runInContext(rd('js/v2-split.js'), pctx, { filename: 'js/v2-split.js' });
  await new Promise(function (res) { pctx.V2Split.prepare(function () { res(); }); });
  const petRes = await pctx.V2Lookup.load(String(petId));
  console.log('MEASURE pet bytes=' + petRes.bytes + ' ms=' + petRes.ms + ' files=' + petRes.files + ' id=' + petId + ' ok=' + petRes.ok + ' note=' + (petRes.note || petRes.error));
  ok(petRes.ok && petRes.pets.length === 1 && petRes.pets[0].id === petId && petRes.pets[0].owner && petRes.files >= 1 && petRes.files <= 3 && petRes.bytes > 0 && petRes.ms < 30000, 'ensurePet lookup for #' + petId + ' (' + petRes.bytes + ' bytes, ' + petRes.files + ' files, ' + petRes.ms + ' ms)');
  const fightable = small.pets.filter(function (p) { return p.stage >= 2 && !p.neglected && !p.dead; }).length;
  console.log('MEASURE small-fightable ' + fightable + ' of ' + small.pets.length);
  ok(fightable > 0, 'the 8-pet wallet has a pet the fight and breed lists can show');

  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(1); });
