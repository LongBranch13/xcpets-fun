#!/usr/bin/env node
/* Nov 25 2026 (G Money: "I burned like 10 times last night to discard pets officially and it still won't let me feed them to zombies").
 * Display only, no rule change. The rules feed a zombie ONLY pets discarded on chain (cemOfferWhy: 'only a discarded pet can be offered'),
 * but every zombie / cemetery picker built its list from this browser's Discard pile (localStorage) alone. A player who discarded on chain
 * (the default since the owner made Discard permanent), or on another device, saw "No pets in your Discard pile".
 * Checks: V2Own.discardSet / inPile, the sacrifice sheet's candidates (js/v2-cem-sacrifice.js), the My Pets zombie card's pile (js/v2.js
 * zDiscarded) and the altar's pile (js/v2-cemetery-altar.js discSet) all include on-chain discards with an EMPTY browser pile, never a
 * risen zombie, and the sheet counts browser-only pets (which the rules refuse) so it can say how to make them permanent.
 *   node tools/zombie-pile-onchain-test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const REPO = path.resolve(__dirname, '..'), rd = f => fs.readFileSync(path.join(REPO, f), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('ok   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const st = {}, ls = { getItem: k => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); }, removeItem: k => { delete st[k]; } };
const el = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, appendChild() {}, querySelectorAll: () => [], querySelector: () => null });
const win = { console, localStorage: ls, setTimeout, clearTimeout }; win.window = win; win.self = win;
win.document = { readyState: 'complete', getElementById: () => null, createElement: el, head: el(), body: el(), addEventListener() {}, removeEventListener() {} };
const ctx = vm.createContext(win);
vm.runInContext(rd('js/v2-own.js'), ctx); vm.runInContext(rd('js/v2-cem-sacrifice.js'), ctx);
const O = ctx.V2Own, S = ctx.V2CemSacrifice, ME = 'me';
const pets = [
  { id: 1, owner: ME, hd: ME, tier: 0 },                       /* discarded on chain, browser pile empty: the G Money case */
  { id: 2, owner: ME, tier: 1 },                               /* only in this browser's pile: rules refuse it */
  { id: 3, owner: ME, tier: 2 },                               /* not discarded at all */
  { id: 4, owner: ME, hd: ME, zombie: { gen: 1 } },            /* old on-chain flag on a risen zombie: never in the pile */
  { id: 5, owner: ME, hd: ME, dead: true },                    /* dead */
  { id: 6, owner: 'other', hd: 'other' },                      /* someone else's discard */
  { id: 7, owner: ME, hd: ME, tier: 3 },
  { id: 8, owner: ME, zombie: { gen: 1 } }                     /* the zombie being fed */
];
const w = { pets, byId: {} }; pets.forEach(p => { w.byId[p.id] = p; });
/* the rules' answer (js/v2-rules.js cemOfferWhy, gate on): only this owner's living, non-zombie, on-chain-discarded pets */
const V = { cemOfferWhy: (w, p, src) => p.owner !== src ? 'not your pet' : p.released ? 'released' : (p.zombie && !p.zombie.end) ? 'zombie' : p.dead ? 'dead' : p.hd !== src ? 'only a discarded pet can be offered' : null, isZ: p => !!(p.zombie && !p.zombie.end) };

/* 1. V2Own */
let D = O.discardSet(w, ME);
ok(D[1] && D[7] && !D[2] && !D[3], 'discardSet: on-chain discards are in the pile with an empty browser list');
ok(!D[4] && !D[6], 'discardSet: never a risen zombie, never another wallet\'s discard');
ok(O.inPile(pets[0], ME, {}) && !O.inPile(pets[3], ME, { 4: 1 }) && O.inPile(pets[1], ME, { 2: 1 }), 'inPile: chain or browser, never a risen zombie');
st['xcpets-hidden-mainnet-' + ME] = JSON.stringify([2]);
D = O.discardSet(w, ME); ok(D[1] && D[2] && D[7], 'discardSet: browser list + chain together');
delete st['xcpets-hidden-mainnet-' + ME];

/* 2. the cemetery sacrifice sheet (pet page "Feed it pets", Cemetery zombie cards) */
let C = S._candidates({ w, V, ME, b: 977600, z: 8 }).map(p => p.id);
ok(JSON.stringify(C) === '[1,7]', 'sacrifice sheet lists the on-chain discards with an empty browser pile (got ' + JSON.stringify(C) + ', was [] before the fix)');
st['xcpets-keep-mainnet-' + ME] = JSON.stringify([7]);
C = S._candidates({ w, V, ME, b: 977600, z: 8 }).map(p => p.id); ok(JSON.stringify(C) === '[1]', 'starred pets are still never listed');
delete st['xcpets-keep-mainnet-' + ME];
ok(/browserOnly\(o\)/.test(rd('js/v2-cem-sacrifice.js')) && /Make my browser discards permanent/.test(rd('js/v2-cem-sacrifice.js')), 'sheet tells a browser-only pile how to make it permanent');
ok(/csac-more/.test(rd('js/v2-cem-sacrifice.js')), 'sheet draws a big pile a page at a time');

/* 3. My Pets zombie card (js/v2.js zDiscarded) */
const src = rd('js/v2.js'), zd = src.slice(src.indexOf('  function zDiscarded(w)'), src.indexOf('\n', src.indexOf('  function zDiscarded(w)')));
const c2 = vm.createContext({ ME, V: {}, V2Own: O, hiddenIds: () => [], ZB: p => !!(p && p.zombie && !p.zombie.end) });
vm.runInContext(zd + '\nthis.zDiscarded = zDiscarded;', c2);
const H = c2.zDiscarded(w); ok(H[1] && H[7] && !H[4] && !H[6], 'My Pets zombie card: on-chain discards count as Discarded');

/* 4. the altar (js/v2-cemetery-altar.js) asks V2Own */
ok(/function discSet\(\) \{ return V2Own\.discardSet\(/.test(rd('js/v2-cemetery-altar.js')), 'altar pile = V2Own.discardSet');

/* 5. no picker reads ONLY the browser pile for zombie / altar offers any more */
['js/v2-cem-sacrifice.js', 'js/v2-cemetery-altar.js', 'js/v2.js'].forEach(f => { const s = rd(f); ok(/V2Own\.(discardSet|onChain|discarded)/.test(s), f + ' looks at on-chain discards (through V2Own, the one answer)'); });
/* 6. feeds signed while a discard burn is still waiting (G Money, 977,469): the feed guard leaves those pets out */
const H2 = require(path.join(REPO, 'js/v2-habits.js'));
const pet = { id: 50, owner: ME, hungry: true, nextMeal: 1 };
ok(/being discarded/.test(H2.feedWhy({}, pet, ME, { hd: { 50: 1 } }, 977600, null) || ''), 'feed guard: a pet named by a pending discard burn is not fed');
ok(H2.feedWhy({}, pet, ME, { hd: {} }, 977600, null) === null, 'feed guard: other hungry pets still eat');
const v2 = rd('js/v2.js'); ok(/t\.action === 'hd'\) return hdAdd\(t\)/.test(v2) && /pendingFeedIds: pendingFeedIds/.test(v2), 'pendingFeedIds reads pending pet:hd burns (and V2UI shares it)');
ok(/u\.pendingFeedIds\(\)\.hd/.test(rd('js/v2-chores.js')), 'Daily chores leaves out pets in a pending discard');
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
