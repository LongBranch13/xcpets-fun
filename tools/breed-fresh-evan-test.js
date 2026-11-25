#!/usr/bin/env node
/* Evan, bc1pfvk…, breeds #35395 Chidoon x #60288 Rurup. Both are his Legendary
 * Peepoos in the published world (view o:7 and checkpoint {__s:3}). The send
 * check said "first pet must be yours". A fast play.html also paints page 0
 * (his oldest pets) with an empty burn log, so hatches from the last pages and
 * the recent burns look missing. Nothing is signed. The previous-owner wallet
 * is named only so this test can refuse it. js/v2-rules.js stays the shipped bytes. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), vm = require('vm');
const L = require('./lib/load-rules');
const ROOT = L.ROOT;
const EVAN = 'bc1pfvkpmllr7mtn5uazqxumwp39h2ny3c8l6fmrgvjv2cqn5wlpt7hssf3gqd';
const OTHER = 'bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n';
const BANNED = 'bc1ps9av86ymmlzy9zj3a8pn6g94pz4j5e0kagv3td3wutaagfjvekjs26m3s4';
let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (c) pass++; else fail++; };
const rulesMd5 = crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, 'js/v2-rules.js'))).digest('hex');
ok(rulesMd5 === require('./lib/rules-pin').pin('js/v2-rules.js'), 'js/v2-rules.js MD5 unchanged (' + rulesMd5 + ')');
ok(fs.readFileSync(__filename, 'utf8').indexOf(BANNED) >= 0, 'the banned wallet is named only so this test can refuse it');

const ctx = L.load();
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/v2-art.js'), 'utf8'), ctx, { filename: 'js/v2-art.js' });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/v2-split.js'), 'utf8'), ctx, { filename: 'js/v2-split.js' });
const S = ctx.V2Split, V = ctx.V2Rules, Art = ctx.XcpArt;

const view = []; view[3] = OTHER; view[7] = EVAN;
const checkpoint = []; checkpoint[3] = EVAN; checkpoint[7] = 'bc1q3uk2gfxyyhxnkmvjs7nwqadknkvvqejgrk8nww';
function pet(id, name, owner) {
  return {
    id: id, name: name, species: 'peepo', tier: 3, stage: 5, dead: false, released: false,
    hatchBlock: id === 35395 ? 973042 : 973464, lastFed: id === 35395 ? 973454 : 973892,
    care: 21000, feedDays: { 6750: 1 }, stats: { vigor: 20, spark: 20, grit: 20, zoom: 20, luck: 20 },
    owner: owner
  };
}
function world(pets, owners) {
  const byId = {}; pets.forEach(function (p) { byId[p.id] = p; });
  return { tip: 976925, pets: pets, byId: byId, items: {}, fights: [], breedReqs: [], _owners: owners || null };
}
const plan = { tag: 'pet:breed:35395:60288', amount: 135 };
function why(w, me) { return V.sendBlock(w, plan, 976925, { me: me }); }

const markerA = pet(35395, 'Chidoon', { __s: 3 });
const markerB = pet(60288, 'Rurup', { __s: 3 });
ok(why(world([markerA, markerB], checkpoint), EVAN) === 'first pet must be yours', 'a checkpoint owner marker fails the breed check before it is resolved');
const kept = pet(35395, 'Chidoon', { __s: 3 });
Art.fillOwners(kept, view);
ok(kept.owner && kept.owner.__s === 3, 'the view owner table does not consume a checkpoint owner marker');
Art.resolvePetOwner(kept, { checkpoint: checkpoint, view: view });
ok(kept.owner === EVAN, 'the marker resolves to Evan from checkpoint index 3');
const partner = pet(60288, 'Rurup', { __s: 3 });
Art.resolvePetOwner(partner, { checkpoint: checkpoint, view: view });
ok(why(world([kept, partner]), EVAN) !== 'first pet must be yours', 'Evan can breed Chidoon x Rurup once both owners resolve (' + why(world([kept, partner]), EVAN) + ')');
ok(why(world([kept, partner]), '') == null, 'an empty wallet skips the breed owner line; a wrong wallet does not');
ok(why(world([kept, partner]), OTHER) === 'first pet must be yours', 'a different wallet is still refused');
ok(why(world([kept, partner]), BANNED) === 'first pet must be yours', 'the banned wallet is not the sender');

const shardA = pet(35395, 'Chidoon', undefined); shardA.o = 7; delete shardA.owner;
const shardB = pet(60288, 'Rurup', undefined); shardB.o = 7; delete shardB.owner;
ctx.V2Mock = { ME: EVAN, world: function () { return { pets: [], byId: {} }; }, setViewWorld: function () {} };
ctx.V2UI = { ME: EVAN };
S.adoptOwners(view);
const shardW = world([shardA, shardB]);
delete shardW._owners;
ok(why(shardW, EVAN) === 'first pet must be yours', 'shard rows with only o:7 fail until the view table is applied');
S.resolveWorld(shardW, Art.tagPetIds(V.parseTag(plan.tag)));
ok(shardA.owner === EVAN && shardB.owner === EVAN, 'breed ids resolve through the view table');
ok(why(shardW, S.pageWallet()) !== 'first pet must be yours', 'the page wallet passes the breed owner check');

const ids = Art.tagPetIds(V.parseTag('pet:breed:35395:60288'));
ok(ids.indexOf(35395) >= 0 && ids.indexOf(60288) >= 0, 'breed tags name both parents');
const team = Art.tagPetIds({ action: 'tt', a: [1, 2], b: [3, 4] });
ok(team.join(',') === '1,2,3,4', 'a tag-team burn names all four pets');
const run = Art.tagPetIds({ action: 'cemr', target: 74534, ids: [10, 11] });
ok(run.indexOf(74534) >= 0 && run.indexOf(10) >= 0, 'a cemetery run names its target and its ids');

ok(S.newestPages(92).join(',') === '90,91', 'a 92-page owner file fetches its last pages first (' + S.newestPages(92).join(',') + ')');
ok(S.newestPages(1).length === 0, 'a single owner page has no later page to fetch');
const feed = S.rowsToLog([{ block_index: 976843, tx_hash: 'aa', source: EVAN, tag: Buffer.from('pet:feed:193865', 'utf8').toString('hex') }]);
ok(feed.length === 1 && feed[0].src === EVAN && feed[0].kind === 'feed' && feed[0].msg === 'pet:feed:193865', 'a sync row becomes a burn-log line for that wallet');
ok(fs.readFileSync(path.join(ROOT, 'js/v2.js'), 'utf8').indexOf('l.src && l.src === ME') >= 0, 'your burn log keeps lines the view filled from the sync feed');
ok(fs.readFileSync(path.join(ROOT, 'js/v2-split.js'), 'utf8').indexOf('loadNewest(pg)') >= 0, 'the fast view loads the newest owner pages before the rest');
const splitSrc = fs.readFileSync(path.join(ROOT, 'js/v2-split.js'), 'utf8');
const play = fs.readFileSync(path.join(ROOT, 'play.html'), 'utf8');
const rank = fs.readFileSync(path.join(ROOT, 'ranking.html'), 'utf8');
ok(splitSrc.indexOf('/xp/v1/sync') < 0, 'the rankings script does not request the chain window');
ok(play.indexOf('js/v2-view-log.js?v=') >= 0 && rank.indexOf('v2-view-log.js') < 0, 'the burn log is filled from the player page only');

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
