#!/usr/bin/env node
/* Evan's feral zombie #74534 (Sebazubit) showed Unleash, then the send check said
 * "zombie owner only" for pet:unleash:74534. The published row is his. The check was
 * reading a pet whose owner was still missing, still a checkpoint {__s:N} marker, or
 * it was comparing that pet to a different wallet string than the button.
 * The view owner table and the checkpoint owner table do not share indexes.
 * Nothing is signed or broadcast. The previous owner's wallet is named only so this
 * test can refuse to connect as it. js/v2-rules.js stays the shipped bytes. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), vm = require('vm');
const L = require('./lib/load-rules');
const ROOT = L.ROOT;
const EVAN = 'bc1pfvkpmllr7mtn5uazqxumwp39h2ny3c8l6fmrgvjv2cqn5wlpt7hssf3gqd';
const OTHER = 'bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n';
const CHECK7 = 'bc1q3uk2gfxyyhxnkmvjs7nwqadknkvvqejgrk8nww';
const BANNED = 'bc1ps9av86ymmlzy9zj3a8pn6g94pz4j5e0kagv3td3wutaagfjvekjs26m3s4';
const TIP = 976840;
let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (c) pass++; else fail++; };
const rulesMd5 = crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, 'js/v2-rules.js'))).digest('hex');
ok(rulesMd5 === require('./lib/rules-pin').pin('js/v2-rules.js'), 'js/v2-rules.js MD5 unchanged (' + rulesMd5 + ')');
ok(fs.readFileSync(__filename, 'utf8').indexOf(BANNED) >= 0, 'the banned wallet is named only so this test can refuse it');

const ctx = L.load();
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/v2-art.js'), 'utf8'), ctx, { filename: 'js/v2-art.js' });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/v2-split.js'), 'utf8'), ctx, { filename: 'js/v2-split.js' });
const S = ctx.V2Split, V = ctx.V2Rules, Art = ctx.XcpArt;

/* view/owners.json index 7 is Evan. The checkpoint _owners index 3 is Evan.
 * Index 7 in the checkpoint table is a different wallet. Mixing them is the bug. */
const view = [];
view[0] = BANNED;
view[3] = OTHER;
view[7] = EVAN;
const checkpoint = [];
checkpoint[3] = EVAN;
checkpoint[7] = CHECK7;

ctx.V2Mock = { ME: '', world: function () { return { pets: [], byId: {} }; }, setViewWorld: function () {} };
ctx.V2UI = { ME: EVAN };
S.adoptOwners(view);
ok(!ctx.localStorage.getItem('xcpets-v2-me'), 'the stored check wallet (xcpets-v2-me) is empty');
ok(S.pageWallet() === EVAN, 'the send check uses the page wallet the Unleash button used');
ok(S.pageWallet() !== BANNED, 'the banned wallet is never the connected or viewed wallet');

function zed(extra) {
  const p = {
    id: 74534, name: 'Sebazubit', species: 'bobo', feral: true,
    dead: false, released: false, hatchBlock: 974327, care: 69, feedDays: {},
    stats: { vigor: 26, spark: 29, grit: 22, zoom: 28, luck: 29 },
    zombie: {
      gen: 1, fedAt: 975596, end: null, by: EVAN, prevOwner: BANNED,
      crumbleAt: 977161, bonus: {}, cap: 3
    }
  };
  Object.keys(extra || {}).forEach(function (k) { p[k] = extra[k]; });
  return p;
}
function worldOf(byId, pets) {
  return {
    tip: TIP, pets: pets || Object.keys(byId).map(function (id) { return byId[id]; }),
    byId: byId, items: {}, fights: [], breedReqs: [],
    cem: { mg: { unleash: [], byWallet: {}, godBy: {}, seats: [], meals: [] } }
  };
}
const plan = { tag: 'pet:unleash:74534', amount: 86.25 };
function why(w, me) { return V.sendBlock(w, plan, TIP, { me: me }); }

/* The button is drawn from the own-page pet, whose owner is already the address.
 * The check reads w.byId, which can be a second object: the raw shard (o:7, no owner). */
const card = zed({ owner: EVAN });
const raw = zed({});
delete raw.owner;
const split = worldOf({ 74534: raw }, [card]);
ok(raw !== card, 'the card pet and the byId pet are different objects');
ok(why(split, EVAN) === 'zombie owner only', 'before resolve, the raw byId row rejects Evan (' + why(split, EVAN) + ')');
S.resolveWorld(split, [74534]);
ok(raw.owner === EVAN, 'resolveWorld copies the card owner onto the byId row the check reads');
ok(why(split, '') === 'zombie owner only', 'an empty check wallet is still refused on the real owner');
ok(why(split, S.pageWallet()) !== 'zombie owner only', 'the page wallet passes the owner check (' + why(split, S.pageWallet()) + ')');
ok(raw.owner === EVAN, 'liveAt during the check leaves the owner alone');
ok(why(split, BANNED) === 'zombie owner only', 'the previous owner is still refused');

/* A shard row with only o:7. View index 7 is Evan. Checkpoint index 7 is not. */
const shard = zed({ o: 7 });
delete shard.owner;
const shardW = worldOf({ 74534: shard });
shardW._owners = checkpoint;
S.resolveWorld(shardW, [74534]);
ok(shard.owner === EVAN, 'o:7 resolves through the view table (index 7), not the checkpoint table');
ok(shard.owner !== CHECK7, 'checkpoint index 7 is not applied to a view o index');

/* A checkpoint pet stores owner as {__s:3}. That index is Evan only in the checkpoint table.
 * Filling it with the view table assigns view[3], and the check then says zombie owner only. */
const marked = zed({ owner: { __s: 3 }, o: 7 });
const mixed = zed({ owner: { __s: 3 } });
Art.fillOwners(mixed, view);
ok(mixed.owner && mixed.owner.__s === 3, 'a checkpoint owner marker is not filled from the view table');
mixed.owner = OTHER;
ok(why(worldOf({ 74534: mixed }), EVAN) === 'zombie owner only', 'that wrong wallet is the zombie-owner-only rejection');
const markW = worldOf({ 74534: marked });
markW._owners = checkpoint;
S.resolveWorld(markW, [74534]);
ok(marked.owner === EVAN, 'a checkpoint {__s:3} resolves to Evan from the checkpoint table');
ok(marked.owner !== OTHER, 'view index 3 is not used for a checkpoint marker');
ok(why(markW, EVAN) !== 'zombie owner only', 'Evan passes once the marker is resolved (' + why(markW, EVAN) + ')');
ok(why(markW, '') === 'zombie owner only', 'the same pet still rejects an empty wallet');

/* Breed uses the same sendBlock owner read (w.byId). */
const mate = zed({ id: 74535, owner: { __s: 3 }, feral: false, zombie: null, dead: false, name: 'Mate' });
const breedW = worldOf({ 74535: mate });
breedW._owners = checkpoint;
const breed = { tag: 'pet:breed:74535:74534' };
ok(V.sendBlock(breedW, breed, TIP, { me: EVAN }) === 'first pet must be yours', 'breed rejects an unresolved checkpoint marker');
S.resolveWorld(breedW, [74535, 74534]);
ok(mate.owner === EVAN, 'breed resolves the same way as unleash');
ok(V.sendBlock(breedW, breed, TIP, { me: EVAN }) !== 'first pet must be yours', 'breed no longer fails the owner check (' + V.sendBlock(breedW, breed, TIP, { me: EVAN }) + ')');

const v2 = fs.readFileSync(path.join(ROOT, 'js/v2.js'), 'utf8');
const splitJs = fs.readFileSync(path.join(ROOT, 'js/v2-split.js'), 'utf8');
const worker = fs.readFileSync(path.join(ROOT, 'js/v2-verify-worker.js'), 'utf8');
ok(/V2Split\.resolveWorld\)/.test(v2) && /sendIds\(plans\)/.test(v2), 'confirmPlans resolves the pets a burn names before the send check');
ok(/me: pageWallet\(\)/.test(splitJs), 'the verify worker is posted the page wallet');
ok(/resolveChecked\(/.test(worker) && /checkpoint: ownerTable/.test(worker), 'the worker fills a checkpoint marker before sendBlock');
ok(/v2-art\.js\?v=[0-9a-z]+/.test(worker), 'the worker loads the art file that resolves owners');

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
