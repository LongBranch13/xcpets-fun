#!/usr/bin/env node
/* One merge step for fast pages (Nov 24 2026, root cause #1): js/v2-merge.js decides, for every view world, which pets carry over.
 *   node tools/merge-step-test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..'), rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let fails = 0, n = 0; const ok = (c, m) => { n++; console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
function load() { const ctx = vm.createContext({}); ctx.self = ctx; vm.runInContext(rd('js/v2-merge.js'), ctx); return ctx.V2Merge; }
const ME = 'bc1qme', OTHER = 'bc1qother';
const W = (pets, extra) => Object.assign({ _view: 1, pets: pets, byId: Object.fromEntries(pets.map(p => [p.id, p])), items: {}, itemList: [] }, extra || {});
let M = load();

/* 1. the fresher copy wins, a missing pet is carried with its gear */
const g1 = { gid: 'g1', on: 2, item: 'hat' };
const prev = W([{ id: 1, owner: OTHER, name: 'old' }, { id: 2, owner: OTHER, worn: [g1] }, { id: 3, owner: OTHER, dead: true }]);
prev.items.g1 = g1;
const next = W([{ id: 1, owner: OTHER, name: 'new' }]);
const added = M.carry(prev, next, ME);
ok(added === 2 && next.pets.length === 3, 'a republish that lacks pets keeps them (added ' + added + ')');
ok(next.byId[1].name === 'new', 'a pet in the next world wins (the fresher copy)');
ok(next.byId[2] && next.items.g1 === g1 && next.itemList.indexOf(g1) >= 0, 'a carried pet keeps its worn gear in items and itemList');
ok(next.byId[3] && next.byId[3].dead, 'a dead pet (a grave) is carried too');

/* 2. the wallet's own living pets come only from its owner pages */
const prev2 = W([{ id: 10, owner: ME }, { id: 11, owner: ME, dead: true }, { id: 12, owner: ME, zombie: { gen: 1 } }, { id: 13, owner: ME, released: true }, { id: 14, owner: ME, zombie: { gen: 1, end: { kind: 'resurrected' } } }]);
const next2 = W([]);
M.carry(prev2, next2, ME);
ok(!next2.byId[10], 'my living pet missing from my owner pages is NOT put back (given away / sold / sacrificed this visit)');
ok(next2.byId[11] && next2.byId[12] && next2.byId[13], 'my dead pet, risen zombie and released pet are carried');
ok(!next2.byId[14], 'a pet whose zombie life ended (living again) counts as living: not carried');

/* 3. #1765 is never carried; a non-view world is never a source */
const next3 = W([]); M.carry(W([{ id: 1765, owner: OTHER, dead: true }, { id: 1766, owner: OTHER }]), next3, ME);
ok(!next3.byId[1765] && next3.byId[1766], '#1765 never carried');
const full = { pets: [{ id: 5, owner: OTHER }], byId: { 5: {} } }, next4 = W([]);
ok(M.carry(full, next4, ME) === 0, 'a full replay world (no _view) is never carried into a view');
ok(M.carry(next4, next4, ME) === 0, 'the same world twice: nothing to do');

/* 4. pins: added to every later world, even one built before the pet was ever shown */
M = load();
M.pin([{ id: 20, owner: OTHER }, { id: 21, owner: ME }, { id: 1765, owner: OTHER, dead: true }], ME);
ok(M.pinned() === 1, 'pin keeps other wallets\' pets, not my living ones or #1765 (pinned ' + M.pinned() + ')');
const n5 = W([]); M.carry(null, n5, ME);
ok(n5.byId[20] && !n5.byId[21], 'a pinned pet lands in a world with no previous world');
M.pin([{ id: 22, owner: ME }], ME, true);
const n6 = W([]); M.carry(null, n6, ME);
ok(n6.byId[22], 'a typed-in lookup (pin all) keeps even my own living pet');
const prevCopy = { id: 20, owner: OTHER, art: 'assembled' }, n7 = W([]);
M.carry(W([prevCopy]), n7, ME);
ok(n7.byId[20] === prevCopy, 'the previous world\'s (assembled) copy beats the raw pinned copy');
const n8 = W([{ id: 20, owner: OTHER, name: 'fresh' }]); M.carry(null, n8, ME);
ok(n8.byId[20].name === 'fresh' && n8.pets.length === 2, 'a pinned pet already in the next world is not added twice');

/* 5. a shallow copy sharing the pets array (v2-lookup absorb) does not loop or duplicate */
const base = W([{ id: 30, owner: OTHER }]); const sh = Object.assign({}, base);
M = load(); M.pin([{ id: 31, owner: OTHER }], ME);
M.carry(base, sh, ME);
ok(sh.pets.length === 2 && sh.pets.filter(p => p.id === 30).length === 1, 'a shallow copy: only the pinned pet is added');

/* 6. the old drop path, replayed: owner pages republish from the owner list alone */
M = load();
let shown = W([{ id: 40, owner: ME }]);
const gooby = { id: 41, owner: OTHER }; /* the asker's pet in a Gooby's request, added through mergePets */
let w2 = W([{ id: 40, owner: ME }, gooby]); M.pin([gooby], ME); M.carry(shown, w2, ME); shown = w2;
let w3 = W([{ id: 40, owner: ME }, { id: 42, owner: ME }]); M.carry(shown, w3, ME); shown = w3; /* next owner-page batch */
const rank = W([{ id: 50, owner: OTHER, _lead: 1 }]); M.carry(shown, rank, ME); shown = rank; /* a Rankings world */
let w4 = W([{ id: 40, owner: ME }, { id: 42, owner: ME }, { id: 43, owner: ME }]); M.carry(shown, w4, ME); shown = w4;
ok(shown.byId[41] && shown.byId[50] && shown.byId[43], 'request partner, Rankings lead pet and the newest owner page all survive every republish');
ok(shown.pets.length === 5, 'no duplicates after four republishes (' + shown.pets.length + ')');

/* wiring */
const chain = rd('js/v2-chain.js'), split = rd('js/v2-split.js'), look = rd('js/v2-lookup.js');
ok(/function setViewWorld\(w\) \{ if \(!S\.view \|\| !w\) return; if \(window\.V2Merge && lastW && lastW !== w\) \{ try \{ V2Merge\.carry\(lastW, w, ME\);/.test(chain), 'every view world goes through V2Merge.carry (setViewWorld)');
ok(!/withKept|keptExtra/.test(split) && /function keepExtra\(list\) \{ if \(window\.V2Merge\) V2Merge\.pin\(list, me\(\)\); \}/.test(split), 'v2-split.js keeps no pet list of its own: it pins');
ok(/one\[who\] = aliveFirst\(pets\);/.test(split), 'owner-page publish builds from the owner list; others come back through the merge step');
ok(/if \(root\.V2Merge\) return;/.test(look) && /V2Merge\.pin\(hl, me\(\), true\)/.test(look), 'looked-up pets are pinned, no second setViewWorld wrap');
const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).concat(['templates/game.html']);
let bad = [];
for (const f of pages) { const s = rd(f); const c = s.indexOf('js/v2-chain.js'); if (c < 0) continue; const m = s.indexOf('js/v2-merge.js'); if (m < 0 || m > c) bad.push(f); }
ok(!bad.length, 'every page with v2-chain.js loads v2-merge.js before it' + (bad.length ? ' (missing: ' + bad.join(', ') + ')' : ''));
console.log(`merge-step: ${n - fails} passed, ${fails} failed`); process.exit(fails ? 1 : 0);
