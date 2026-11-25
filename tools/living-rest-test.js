#!/usr/bin/env node
/* Cemetery and shop pickers call the same living-pet load as play.html (V2Split.rest, 5,000 cap).
 * Discard-pile ids still missing are loaded with ensurePet. loadBoard is not used.
 * js/v2-rules.js stays the main bytes. The split files are the slim publisher.
 * Nothing is signed or sent. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (c) pass++; else fail++; };
function rd(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function md5(rel) { return crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex'); }

ok(md5('js/v2-rules.js') === require('./lib/rules-pin').pin('js/v2-rules.js'), 'rules MD5 unchanged after #77');
ok(/window\.V2Split = /.test(fs.readFileSync(path.join(ROOT, 'js/v2-split.js'), 'utf8')), 'js/v2-split.js is the slim publisher client (exports V2Split; no byte pin, the file changes often)');
ok(/module\.exports/.test(fs.readFileSync(path.join(ROOT, 'tools/sync-server/split.js'), 'utf8')), 'tools/sync-server/split.js is the slim publisher (a module; no byte pin)');

function block(src) {
  const a = src.indexOf('  /* living-rest-1107:'), b = src.indexOf('  /* /living-rest-1107 */');
  if (a < 0 || b < 0) return '';
  return src.slice(a, b + '  /* /living-rest-1107 */'.length);
}
const scene = rd('js/v2-cemetery-scene.js'), gift = rd('js/v2-gift.js'), altar = rd('js/v2-cemetery-altar.js'), sales = rd('js/v2-sales.js'), hunt = rd('js/v2-hunt-picker.js');
const helper = block(scene);
ok(helper.length > 500 && helper === block(gift), 'cemetery and shop share one living-rest helper');
ok(/V2Split\.rest/.test(helper) && /V2Split\.ensurePet/.test(helper) && /AUTO_CAP/.test(helper) && !/loadBoard\(/.test(helper), 'helper calls rest and ensurePet, not loadBoard');
ok(/if \(window\.xcpLivingRest\) window\.xcpLivingRest\(\)/.test(scene) && /zLoad\(\); if \(window\.xcpLivingRest\) window\.xcpLivingRest\(\)\.then\(function \(\) \{ syncWorld\(\); status\(\); zombies\(\); \}/.test(scene) && /function ownLiving\(p, me\) \{ return !!\(me && p && p\.owner === me && !p\.dead && !p\.released && !isZ\(p\)\); \}/.test(rd('js/v2-merge.js')) /* Nov 24 2026: my risen zombies are kept by the one merge step */ && /function zLoad\(\) \{ if \(!\(window\.V2Split && V2Split\.loadZombies\)\)/.test(scene), 'cemetery boot starts rest and loads zombies right away (kept across owner-page publishes, hunt-fast Nov 24 2026)');
ok(/xcpLivingFill\(ME\)/.test(scene) && /pending: pend/.test(scene), 'hunt waits for the rest of the living pets');
ok(/function primeOffers\(/.test(altar) && /xcpLivingFill\(me\)/.test(altar) && /Loading your pets…/.test(altar), 'seance shows a loading line, then refills from the full list');
ok(/pending && !query && !rows.length/.test(hunt) && /Loading your pets…/.test(hunt) && /d\._fill/.test(hunt), 'hunt picker can show loading, then take the full hunter list');
ok(/xcpLivingFill\(ME\)/.test(sales) && /xcpLivingRest\(\)/.test(sales) && /Loading your pets…/.test(sales) && !/loadBoard\(/.test(sales), 'shop list picker uses the same load');
ok(/xcpLivingFill\(ME\)/.test(gift) && /Loading your pets…/.test(gift) && !/loadBoard\(/.test(gift), 'shop gift picker uses the same load');
[scene, altar, hunt].forEach(function (src) { ok(!/loadBoard\(/.test(src), 'cemetery files do not call loadBoard'); });

function memStore(hidden, me) {
  const mem = {};
  if (hidden) mem['xcpets-hidden-mainnet-' + me] = JSON.stringify(hidden);
  return { getItem: function (k) { return k in mem ? mem[k] : null; }, setItem: function (k, v) { mem[k] = String(v); } };
}
function pet(id, me) { return { id: id, owner: me, name: 'P' + id, dead: false, released: false, community: false }; }
/* page0 is the 24 (or fewer) pets already on screen. rest() fills up to the cap the same way V2Split.rest does. */
function run(label, spec) {
  const me = spec.me, pets = [], byId = {};
  function add(p) { if (!p || byId[p.id]) return; pets.push(p); byId[p.id] = p; }
  for (let i = 1; i <= spec.page0; i++) add(pet(i, me));
  const world = { pets: pets, byId: byId, _full: spec.pages <= 1 ? 1 : 0, _pages: { n: spec.n, pages: spec.pages, got: 1 } };
  const calls = { rest: 0, ensure: [], board: 0 };
  const ctx = {
    setTimeout: setTimeout, clearTimeout: clearTimeout, Date: Date, Promise: Promise,
    localStorage: memStore(spec.hidden, me),
    LiveEngine: { CFG: { network: 'mainnet' } },
    V2Mock: { world: function () { return world; } },
    V2Split: {
      AUTO_CAP: 5000, SCREEN_PAGES: 7,
      rest: function () {
        calls.rest++;
        const pg = world._pages;
        if (spec.stall || !pg || !(pg.pages > 1)) return;
        const under = (pg.n || 0) > 0 && pg.n <= 5000;
        const got = under ? pg.pages : Math.min(7, pg.pages);
        const limit = Math.min(spec.n, got * 24);
        for (let i = spec.page0 + 1; i <= limit; i++) add(pet(i, me));
        pg.got = got;
        if (under || got >= pg.pages) world._full = 1;
      },
      ensurePet: function (id) {
        calls.ensure.push(id);
        add(Object.assign(pet(id, me), { ensured: true }));
        return Promise.resolve(byId[id]);
      },
      loadBoard: function () { calls.board++; return Promise.resolve(null); }
    }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(helper, ctx, { filename: 'living-rest.js' });
  return ctx.xcpLivingFill(me).then(function () {
    const mine = pets.filter(function (p) { return p.owner === me && !p.dead && !p.released && !p.community; });
    const hidden = {}; (spec.hidden || []).forEach(function (id) { hidden[id] = 1; });
    const offers = mine.filter(function (p) { return hidden[p.id]; }).map(function (p) { return p.id; });
    ok(calls.board === 0, label + ': loadBoard was not called');
    ok(calls.rest === 1, label + ': rest() ran once');
    (spec.hidden || []).forEach(function (id) { ok(offers.indexOf(id) >= 0, label + ': seance can see discarded #' + id); });
    ok(mine.length === spec.hunters, label + ': hunters listed ' + mine.length + ' (wanted ' + spec.hunters + ')');
    if (spec.ensure) ok(spec.ensure.every(function (id) { return calls.ensure.indexOf(id) >= 0; }) && calls.ensure.length === spec.ensure.length, label + ': ensurePet ids ' + calls.ensure.join(','));
    else ok(calls.ensure.length === 0, label + ': no extra pet fetch');
  });
}

(async function () {
  /* Small wallet: one owner page already holds every living pet. */
  await run('small', { me: '1JwWsArppwALMEdXWPmpDBcP1jwWsAPYkD', page0: 8, n: 8, pages: 1, hidden: [3], hunters: 8 });
  /* 2,370-shaped wallet, scaled to two pages: page 0 is 24, the discarded pet is on page 1. */
  await run('2370', { me: 'bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n', page0: 24, n: 48, pages: 2, hidden: [40], hunters: 48 });
  /* 40k-shaped wallet: rest() stops at the first screen (7 pages). A discard past that is ensurePet, not the whole board. */
  await run('40k', { me: 'bc1qtke38j72qv4d8eljn7pccaykypw8luytfwdn7q', page0: 24, n: 8000, pages: 334, hidden: [90001], hunters: 169, ensure: [90001] });
  const t0 = Date.now();
  await run('quiet', { me: 'bc1qquiet', page0: 24, n: 100, pages: 5, hidden: [77], hunters: 25, ensure: [77], stall: true });
  ok(Date.now() - t0 < 4000, 'a rest() that does not move the world still finishes');
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(1); });
