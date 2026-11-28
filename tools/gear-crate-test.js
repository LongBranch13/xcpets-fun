#!/usr/bin/env node
/* Gear crate reveal (js/v2-gear-crate.js, Nov 28 2026): every button maps to the right burn and nothing can be sent that would do nothing.
 * Runs the real actions() with a stub V2Rules (forgeOn / forgePlan / wornOf) and a tiny world, plus the slot-name swap (Footwear -> Ride).
 *   node tools/gear-crate-test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let fails = 0, n = 0; const ok = (c, m) => { n++; console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const ME = 'bc1qme';
function load(V) { const win = { V2Rules: V }; win.window = win; const cx = vm.createContext(win); vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/v2-gear-crate.js'), 'utf8'), cx); return win.V2GearCrate; }
/* world: pet 1 wears g1 (hat, Rare); g2 = spare hat (Legendary) that gearup would put on pet 1; g3/g4 = two copies of a Common boot, g4 spare; g5 = only copy, spare */
function world() { return { tip: 1000, byId: { 1: { id: 1, owner: ME, stage: 3 }, 2: { id: 2, owner: ME, stage: 3 } },
  items: { g1: { gid: 'g1', item: 'hat-a', slot: 'head', tier: 2, owner: ME, on: 1, label: 'Hat A' }, g2: { gid: 'g2', item: 'hat-b', slot: 'head', tier: 3, legendary: true, owner: ME, on: null, label: 'Hat B' },
    g3: { gid: 'g3', item: 'boot', slot: 'feet', tier: 0, owner: ME, on: 2, label: 'Boot' }, g4: { gid: 'g4', item: 'boot', slot: 'feet', tier: 0, owner: ME, on: null, label: 'Boot' },
    g5: { gid: 'g5', item: 'cap', slot: 'head', tier: 0, owner: ME, on: null, label: 'Cap' } } }; }
const calls = [];
const V = { forgeOn: b => b >= 900, wornOf: (w, pid) => Object.values(w.items).filter(g => g.on === pid), isZ: () => false,
  forgePlan: (w, a, kind, arg) => { calls.push([kind, arg]);
    if (kind === 'gearup') { const pid = arg[0], moves = pid === 1 ? [{ petId: 1, slot: 'head', gid: 'g2', from: 'g1', gain: 2 }] : [];
      return moves.length ? { ok: true, moves, tag: 'pet:gearup:' + pid, amount: 1e-8, label: 'Gear up: 1 piece on 1 pet', n: 1, pets: 1 } : { ok: false, why: 'Every pet already wears the best spare gear you own.', moves: [] }; }
    if (kind === 'smash') return { ok: true, n: 1, dust: 1, tag: 'pet:smash:' + 'CURL'[arg], amount: 1e-8, label: 'Smash 1 spare piece into 1 Gear Dust' };
    return { ok: false }; } };
const C = load(V), w = world();
const ctx = (why) => ({ world: () => w, ME, sendWhy: () => why || null });
const win = (gid, rolledOn) => Object.assign({}, w.items[gid], { rolledOn, legendary: !!w.items[gid].legendary });

let a = C.actions(ctx(), win('g2', 1));
ok(a.wear && a.wear.plan && a.wear.plan.tag === 'pet:gearup:1' && a.wear.plan.amount === 1e-8, 'spare piece gearup would put on: Wear = pet:gearup:1 for 1 dander');
ok(a.smash && !a.smash.plan && /only copy/.test(a.smash.why), 'its only copy: Smash is off (one copy is always kept)');
a = C.actions(ctx(), win('g1', 1));
ok(a.wear && a.wear.back && a.wear.plan && a.wear.plan.tag === 'pet:gearup:1', 'a roll that put on a weaker piece: Swap = pet:gearup:1 puts the stronger spare back');
a = C.actions(ctx(), win('g3', 2));
ok(a.wear && a.wear.done && !a.wear.plan, 'a worn piece with nothing stronger spare: Wear shows done, no burn');
ok(a.smash && !a.smash.plan, 'a worn piece is never smashed');
a = C.actions(ctx(), win('g4', 2));
ok(a.wear && !a.wear.plan, 'a spare piece gearup would NOT put on: Wear is off');
ok(a.smash && a.smash.plan && a.smash.plan.tag === 'pet:smash:C', 'a spare second copy: Smash = pet:smash:C (its own rarity)');
a = C.actions(ctx(), win('g5', 2));
ok(a.smash && !a.smash.plan, 'a spare only copy is not offered for smashing');
a = C.actions(ctx('a Gear Forge burn is already waiting to confirm'), win('g2', 1));
ok(a.wear && !a.wear.plan && /already waiting/.test(a.wear.why), 'the pre-sign check (sendWhy) turns a button off with its reason');
V.forgeOn = () => false; a = C.actions(ctx(), win('g2', 1));
ok(!a.wear.plan && !a.smash.plan, 'before the Gear Forge is open nothing can be burned');
V.forgeOn = b => b >= 900; w.items.g2.owner = 'someone-else'; a = C.actions(ctx(), win('g2', 1));
ok(!a.wear && !a.smash, 'a piece that left your stash offers no burn');
ok(C.fits([win('g1', 1)], w, ME) && !C.fits([win('g2', 1)], w, ME), 'the crate opens only for pieces you own');
ok(!C.fits(new Array(C.CRATE_MAX + 1).fill(win('g1', 1)), w, ME), 'big batches keep the list view');

/* Clean up my gear: one pet:smash:R burn (keeps Legendary spares), counts brand-new stash pieces, goes through the confirm sheet */
V.forgeOn = b => b >= 900; w.items.g2.owner = ME; w.items.g4.stashed = 1;
let cv = C.cleanView(w, ME);
ok(cv && cv.ok && cv.plan.tag === 'pet:smash:R' && cv.plan.amount === 1e-8 && C.CLEAN_TOP === 2, 'Clean up = pet:smash:R (up to Rare, Legendary spares kept), 1 dander');
ok(cv.nNew === 1, 'Clean up counts the new (unseen) stash pieces it would melt');
let sent = null; C.cleanGo(w, ME, (t, plans) => { sent = { t, plans }; });
ok(sent && sent.plans.length === 1 && sent.plans[0].tag === 'pet:smash:R' && /keeps one of every piece/.test(sent.t) && /1 new piece/.test(sent.t), 'Clean up goes through confirmPlans and says what it keeps and that it includes new pieces');
V.forgeOn = () => false; ok(C.cleanView(w, ME) === null, 'no Clean up before the Gear Forge opens'); V.forgeOn = b => b >= 900;
/* slot names: feet shows as Ride, the tag code FOOTWEAR is untouched */
const sw = { V2Rules: { slotLabel: s => ({ feet: 'Footwear', body: 'Outfits', head: 'Headwear' })[s], SLOT_LABELS: { feet: 'Footwear', body: 'Outfits', head: 'Headwear' } } }; sw.window = sw;
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/slot-names.js'), 'utf8'), vm.createContext(sw));
ok(sw.V2Rules.slotLabel('feet') === 'Ride' && sw.V2Rules.SLOT_LABELS.feet === 'Ride' && sw.V2Rules.slotLabel('body') === 'Armor' && sw.V2Rules.slotLabel('head') === 'Headwear', 'pages say Ride for feet, Armor for body');
ok(sw.XcpSlots.text('Swan feet (Footwear) pet:c:roll:FOOTWEAR') === 'Swan feet (Ride) pet:c:roll:FOOTWEAR', 'text swap keeps the FOOTWEAR tag code valid');
console.log(`gear-crate: ${n - fails} passed, ${fails} failed`); process.exit(fails ? 1 : 0);
