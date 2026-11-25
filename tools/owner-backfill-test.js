#!/usr/bin/env node
/* Slim own page paints before owners.json. Owner indexes and {__s:N} markers must be
 * filled once that table arrives, and unleash for the real owner must not say
 * "zombie owner only". js/v2-rules.js stays the shipped bytes. Nothing is signed.
 * Does not use the owner wallet. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), vm = require('vm');
const L = require('./lib/load-rules');
const ROOT = L.ROOT;
const ME = 'bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n';
const PREV = 'bc1qtke38j72qv4d8eljn7pccaykypw8luytfwdn7q';
const BANNED = 'bc1ps9av86ymmlzy9zj3a8pn6g94pz4j5e0kagv3td3wutaagfjvekjs26m3s4';
let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (c) pass++; else fail++; };
const rulesMd5 = crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, 'js/v2-rules.js'))).digest('hex');
ok(rulesMd5 === require('./lib/rules-md5').MAIN, 'js/v2-rules.js MD5 unchanged (' + rulesMd5 + ')');
ok(fs.readFileSync(path.join(ROOT, 'tools/owner-backfill-test.js'), 'utf8').indexOf(BANNED) >= 0, 'the banned wallet is named only so this test can refuse it');
ok(ME !== BANNED && PREV !== BANNED, 'the fixture wallets are not the banned wallet');

const ctx = L.load();
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/v2-art.js'), 'utf8'), ctx, { filename: 'js/v2-art.js' });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/v2-split.js'), 'utf8'), ctx, { filename: 'js/v2-split.js' });
const S = ctx.V2Split, V = ctx.V2Rules;

const owners = [];
owners[0] = PREV;
owners[7] = ME;
const slim = {
  id: 74534, o: 7, name: 'Feral', species: 'bobo', tier: 3, stage: 2, feral: true,
  dead: false, released: false, hatchBlock: 974327, care: 100, feedDays: {},
  stats: { vigor: 8, spark: 8, grit: 8, zoom: 8, luck: 8 },
  zombie: {
    gen: 1, fedAt: 975596, raisedAt: 975596, end: null, keep: 0.5, bonus: {}, cap: 3,
    by: { __s: 7 }, prevOwner: { __s: 0 },
    givers: [{ src: { __s: 7 }, points: 10 }],
    death: { vigor: 4, spark: 4, grit: 4, zoom: 4, luck: 4 }
  },
  fireSpinLog: [{ owner: { __s: 7 }, block: 1 }]
};
const shard = { id: 100, o: 7, name: 'Myth', species: 'pepe', tier: 3, stage: 5, care: 70000, dead: false, released: false, hatchBlock: 900000, lastGot: 900000, lastFed: 976800, feedDays: {}, stats: { vigor: 10, spark: 10, grit: 10, zoom: 10, luck: 10 } };
const page = { v: 3, owner: ME, pets: [], rise: [slim], hashes: [], alive: 1, dead: 0, pages: 1, pageSize: 24 };

S.openOwnerPets(page, ME);
const opened = page.rise[0];
ok(opened.owner === ME, 'an own-page pet takes the page wallet before owners.json');
ok(opened.zombie.by && opened.zombie.by.__s === 7, 'zombie.by stays a marker, not owners[undefined]');
ok(opened.zombie.prevOwner && opened.zombie.prevOwner.__s === 0, 'prevOwner stays a marker');
ok(opened.zombie.givers[0].src && opened.zombie.givers[0].src.__s === 7, 'giver src stays a marker');
ok(opened.fireSpinLog[0].owner && opened.fireSpinLog[0].owner.__s === 7, 'fireSpinLog owner stays a marker');

const openedShard = S.openList([shard], null, '')[0];
ok(!openedShard.owner, 'a shard pet has no owner while the table is still out');

const summary = { tip: 976899, n: 2, alive: 2, dead: 0, burned: 0, burns: 0, community: {}, cold: {}, wagmi: {} };
const one = {}; one[ME] = [opened, openedShard];
const view = S.assemble(summary, { owners: one, owner: ME });
view._view = 1;
ok(view.byId[74534].owner === ME && view.byId[74534].zombie.by.__s === 7, 'the painted world keeps the page owner and the marker');
ok(!view.byId[100].owner, 'the painted shard pet is still waiting on the owner table');

ctx.V2Mock = { world: function () { return view; }, setViewWorld: function () {} };
S.adoptOwners(owners);

const Z = view.byId[74534], myth = view.byId[100];
ok(Z.owner === ME && myth.owner === ME, 'both pets have the owner wallet after owners.json');
ok(Z.zombie.by === ME && Z.zombie.prevOwner === PREV, 'zombie by and prevOwner are addresses');
ok(Z.zombie.givers[0].src === ME, 'giver src is the owner wallet');
ok(Z.fireSpinLog[0].owner === ME, 'fireSpinLog owner is the owner wallet');
ok(typeof Z.zombie.by === 'string' && typeof Z.zombie.prevOwner === 'string', 'no marker is left on the zombie');

const why = V.mgUnleashWhy(view, Z, ME, 976900);
ok(why == null, 'mgUnleashWhy is null for the owner (' + why + ')');
ok(V.mgUnleashWhy(view, Z, PREV, 976900) === 'zombie owner only', 'a different wallet is still refused');

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
