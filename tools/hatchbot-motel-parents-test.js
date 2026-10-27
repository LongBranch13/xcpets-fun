'use strict';
// HatchBot motel_alert: never print 'undefined'; one-parent Mythic quest jackpot eggs (e.g. Laha #49077 = [5880]) get their own wording/card.
const assert = require('assert'), R = require('./hatchbot-telegram-next/routines.js'), { breedCardSpec } = require('./hatchbot-telegram-next/render.js');
const facts = { tip: 973400, bred: [
  { id: 49077, name: 'Laha', species: 'hyb:pepe:dodo', parents: [5880], parentNames: { 5880: 'Zunu' }, jackpot: { from: 5880, wild: 'dodo' }, block: 973391 },
  { id: 49078, name: 'Lishani', species: 'hyb:kevin:peepo', parents: [6321], parentNames: {}, jackpot: { from: 6321, wild: 'peepo' }, block: 973391 },
  { id: 49079, name: 'Pomoofebun', species: 'hyb:pepe:doge', parents: [6392], parentNames: {}, jackpot: { from: 6392, wild: 'doge' }, block: 973391 }] };
const t = R.CAPTIONS.motel_alert(facts).text; console.log(t);
assert(!/undefined/.test(t)); assert(!/×/.test(t));
assert(t.includes('Laha #49077 (hyb:pepe:dodo), a Mythic quest jackpot egg from Zunu #5880 and a wild Dodo. Plus 2 more eggs checked out.'));
const two = R.CAPTIONS.motel_alert({ tip: 973320, bred: [{ id: 46074, name: 'Joyap', species: 'hyb:kek:nakamoto', parents: [26243, 21016], parentNames: { 26243: 'A', 21016: 'B' }, block: 973309 }] }).text;
console.log(two); assert(two.includes('from A #26243 × B #21016.'));
const one = R.CAPTIONS.motel_alert({ tip: 973320, bred: [{ id: 1, species: 'pepe', parents: [7, undefined], block: 973309 }, { id: 2, species: 'pepe', parents: [3, 4], block: 973300 }] }).text;
console.log(one); assert(!/undefined/.test(one)); assert(one.includes('Plus 1 more egg checked out.'));
const none = R.CAPTIONS.motel_alert({ tip: 973320, bred: [{ id: 1, species: 'pepe', parents: [], block: 973309 }] }).text; assert(!/undefined|from/.test(none));
// card
const c1 = breedCardSpec(49077, { parents: [5880], jackpot: { wild: 'dodo' } });
assert.deepStrictEqual(c1.pets.map(p => p.id), [5880, 49077]); assert.strictEqual(c1.pets[0].sub, 'quest parent + wild dodo');
assert.deepStrictEqual(breedCardSpec(9, { parents: [1, 2] }).pets.map(p => p.id), [1, 9, 2]);
assert.deepStrictEqual(breedCardSpec(9, { parents: [1, undefined] }).pets.map(p => p.id), [1, 9]);
assert.deepStrictEqual(breedCardSpec(9, { parents: null }).pets.map(p => p.id), [9]);
console.log('hatchbot-motel-parents-test: ok');
