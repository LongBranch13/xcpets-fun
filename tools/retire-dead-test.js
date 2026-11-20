#!/usr/bin/env node
/* Dead pets leave after 14 game days, from ACTIVATE_RETIRE_DEAD_BLOCK.
 * Legendary, Mythic, rare species, special pets and weird hatches stay.
 * Sabo #1765 is never retired. The pause 975817–976518 does not count as game time.
 * node tools/retire-dead-test.js */
'use strict';
const { load } = require('./lib/load-rules');
const ctx = load(), V = ctx.V2Rules;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const GATE = V.retireDeadGate();
const OWNER = 'bc1qretiredeadtestpetownerxxxx';
const DAY = 144;
ok(OWNER !== 'bc1ps9av86ymmlzy9zj3a8pn6g94pz4j5e0kagv3td3wutaagfjvekjs26m3s4', 'test wallet is not the excluded one');
ok(GATE === 977026, 'activation block in the rules is 977026');
ok(V.RETIRE_DEAD_DAYS === 14 && V.BLOCKS_PER_DAY === DAY, '14 game days, and a game day is 144 blocks');
ok(V.PAUSE_FROM === 975817 && V.PAUSE_UNTIL === 976518, 'the downtime pause is 975817–976518');

function pet(id, lastFed, extra) {
  return Object.assign({
    id: id, owner: OWNER, species: 'pepe', tier: 0, stage: 2, care: 10,
    hatchBlock: lastFed - DAY, lastFed: lastFed, feedDays: {}, fightDays: {},
    stats: { vigor: 1, spark: 1, grit: 1, zoom: 1, luck: 1 }, children: [], name: 'P' + id,
    dead: false, released: false
  }, extra || {});
}
function world(pets, b) {
  const w = { pets: pets.slice(), byId: {}, items: {}, tip: b, cem: { altars: {}, altarList: [], zombies: [] }, fights: [] };
  pets.forEach(p => { w.byId[p.id] = p; });
  return w;
}

const LAST = 968832;
ok(V.day(LAST) === 6728, 'the sample meal is game day 6728');
const death = (V.day(LAST) + 8) * DAY;
ok(death === 969984, 'deathBlock for that meal is 969984');
const at13 = death + 13 * DAY, at14 = death + 14 * DAY;

V._setRetireDeadActivation(970000);
try {
  const w13 = world([pet(10, LAST)], at13);
  ok(V._retireDeadSweep(w13, at13) === 0 && w13.byId[10], 'a pet dead 13 game days stays');
  const w14 = world([pet(11, LAST)], at14);
  ok(V.retireDeadDue(w14, w14.byId[11], at14) && V._retireDeadSweep(w14, at14) === 1 && !w14.byId[11], 'a pet dead 14 game days retires');

  const gear = { gid: 'g1', item: 'cap', on: 12, grave: 12, owner: OWNER, bag: null };
  const wg = world([pet(12, LAST, { graveGear: 971000 })], at14);
  wg.items.g1 = gear;
  ok(V._retireDeadSweep(wg, at14) === 1 && !wg.byId[12] && gear.on == null && gear.grave == null && gear.owner === OWNER, 'a grave with burial gear retires, and the gear goes back to the owner');

  const ws = world([pet(13, LAST, { zPast: [{ end: { kind: 'crumble', block: at13 } }], zCrumbles: 1 })], at14);
  ok(V._retireDeadSweep(ws, at14) === 1 && !ws.byId[13], 'a pet that was raised at a seance and then crumbled retires');

  let n = 30;
  function stays(label, extra) {
    const p = pet(n++, LAST, extra), w = world([p], at14), got = V._retireDeadSweep(w, at14);
    ok(got === 0 && w.byId[p.id] && V.retireSpareWhy(p) === label, label + ' stays (' + V.retireSpareWhy(p) + ')');
  }
  stays('legendary', { tier: 3 });
  stays('mythic', { stage: 5 });
  stays('rare-species', { species: 'wizard' });
  stays('rare-species', { species: 'djpepe' });
  stays('rare-species', { species: 'homer' });
  stays('rare-species', { species: 'kek' });
  stays('hybrid', { species: 'hyb:pepe:wojak', hybrid: { shape: 'pepe' } });
  stays('grant', { burnLord: { n: 1, of: 5 } });
  stays('deed', { deed: 'A123' });
  stays('weird', { rareHatch: { version: 1, kind: 'ghost' } });
  stays('event', { jackpot: { block: 1 } });
  const zap = pet(80, LAST, { electric: 1 });
  const wz = world([zap], at14);
  ok(V.retireSpareWhy(zap) == null && V._retireDeadSweep(wz, at14) === 1 && !wz.byId[80], 'an Electric Egg is a mass hatch and retires like any other common pet');
  stays('sabo', { id: 1765 });

  const sabo = pet(1765, LAST, { id: 1765, tier: 0, stage: 1, species: 'pepe' });
  const wS = world([sabo], at14);
  ok(V.retireSpareWhy(sabo) === 'sabo' && V._retireDeadSweep(wS, at14) === 0 && wS.byId[1765], 'Sabo #1765 is never retired, even with no other spare flag');
  ok(V.retireDeadBanner().indexOf('1765') < 0 && !/sabo/i.test(V.retireDeadBanner()), 'the player note does not mention Sabo');

  const wr = world([pet(40, LAST)], at14);
  ok(V._retireDeadSweep(wr, at14) === 1 && !wr.byId[40], 'the raised pet is gone from the world');
  ok(V.cemGraveWhy(wr, wr.byId[40], OWNER, at14) === 'no such grave', 'a raise of a retired pet is refused: no such grave');
  const why = V.sendBlock(wr, { tag: 'pet:raise:40', amount: 1 }, at14 - 1, { me: OWNER });
  ok(!!why && /No such pet #40/.test(why) && /only feed the community pet/.test(why), 'the send guard blocks the raise before it can be signed (' + why + ')');
  const feedWhy = V.sendBlock(wr, { tag: 'pet:feed:40', amount: 1 }, at14 - 1, { me: OWNER });
  ok(!!feedWhy && /No such pet #40/.test(feedWhy), 'the send guard blocks a feed of a retired pet');
  const challenger = pet(41, at14 - 1);
  const wf = world([challenger], at14);
  const fightWhy = V.sendBlock(wf, { tag: 'pet:fight:41:40', amount: 1 }, at14 - 1, { me: OWNER });
  ok(!!fightWhy && /No such pet #40/.test(fightWhy), 'the send guard blocks a fight aimed at a retired pet (' + fightWhy + ')');

  const pauseLast = 972720;
  const sample = pet(50, pauseLast);
  ok(V.retireDeathClock(world([sample], 1), sample, 1) === 973872, 'a meal at 972720 dies at game clock 973872');
  ok(V.inPause(975900) && V._retireDeadSweep(world([pet(50, pauseLast)], 975900), 975900) === 0, 'during the pause the pet is still in the game');
  ok(!V.inPause(976588) && V._retireDeadSweep(world([pet(52, pauseLast)], 976588), 976588) === 0, 'the block before the game clock hits 14 days does not retire it');
  ok(V._retireDeadSweep(world([pet(51, pauseLast)], 976589), 976589) === 1, 'it retires at 976589, when the game clock is 14 days past the death');
} finally {
  V._setRetireDeadActivation(GATE);
}

ok(V.retireDeadGate() === GATE, 'the activation block is restored');
const note = V.retireDeadBanner();
ok(note.indexOf('977,026') >= 0 && note.indexOf('14 game days') >= 0, 'the player note names block 977,026 and the 14 game days');
ok(V._retireDeadSweep(world([pet(60, LAST)], 977025), 977025) === 0, 'the block before activation does not retire a pet that has been dead much longer than 14 days');
ok(V._retireDeadSweep(world([pet(61, LAST)], 977026), 977026) === 1, 'at activation that pet retires');
ok(V._retireDeadSweep(world([pet(62, 976600)], 977026), 977026) === 0, 'a pet fed after the pause does not retire at activation');

const rare = V.retireRareSpecies();
['djpepe', 'homer', 'kek', 'wizard', 'funtrump', 'rabbit', 'nakamoto', 'viking', 'orangedragon', 'jacksonpepe', 'bojackson', 'rarepigeon', 'borp', 'starlordkek', 'gooby', 'lukespam'].forEach(id => ok(!!rare[id], 'spared rare species includes ' + id));
['pepe', 'wojak', 'chud', 'bobo', 'mumu', 'snibby', 'dodo', 'kevin', 'peepo', 'sarutobi', 'doge', 'lenny', 'chad'].forEach(id => ok(!rare[id], 'ordinary species is not on the rare list: ' + id));
ok(V.WEIRD_KINDS.join(',') === 'tiny,giant,two-headed,inverted,ghost,backwards,wrong-egg', 'weird hatches are the seven kinds in the rules');
console.log('rare species: ' + Object.keys(rare).sort().join(', '));
console.log(fails ? fails + ' FAILED' : 'all ok');
process.exitCode = fails ? 1 : 0;
