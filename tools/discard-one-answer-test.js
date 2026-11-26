#!/usr/bin/env node
/* ONE ANSWER TO "IS THIS PET DISCARDED?" (Nov 26 2026 root-cause pass, display side). Display only, no rule change.
 * Nov 25 2026 had four discard bugs. Two of them (PR 284: zombies would not eat on-chain discards; PR 295: the Discard pile box hid
 * Evan's 1,698 on-chain discards) were screens that each decided "discarded?" their own way: about fifteen copies in eleven files,
 * some reading only this browser's list, some only the chain flag, some counting a discard still waiting to confirm, one treating a
 * former owner's flag as discarded. Now V2Own.discarded (js/v2-own.js) is the one answer and every screen asks it.
 * Checks:
 *  1. the answer itself, for every kind of pet (chain, browser, pending, both, a former owner's flag, a risen zombie, dead);
 *  2. every screen that shows or picks pets agrees with it on the same world: My Pets (mine / inPile), the Discard pile box (pileList),
 *     the zombie sacrifice sheet, the My Pets zombie card, the altar, Daily chores, the feed guard, the Pantry picker, the grinder and
 *     sacrifice sheet "browser only" counts, Clear the pile;
 *  3. no game script reads the discard flag (p.hd) or this browser's Discard pile list itself any more (the copies come back = FAIL),
 *     and every page loads js/v2-own.js before the scripts that ask it (tools/own-living-test.js checks the order).
 *   node tools/discard-one-answer-test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const REPO = path.resolve(__dirname, '..'), rd = f => fs.readFileSync(path.join(REPO, f), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('ok   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const st = {}, ls = { getItem: k => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); }, removeItem: k => { delete st[k]; } };
const el = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, appendChild() {}, querySelectorAll: () => [], querySelector: () => null });
const win = { console, localStorage: ls, setTimeout, clearTimeout }; win.window = win; win.self = win;
win.document = { readyState: 'complete', getElementById: () => null, createElement: el, head: el(), body: el(), addEventListener() {}, removeEventListener() {} };
const ctx = vm.createContext(win);
['js/v2-own.js', 'js/v2-habits.js', 'js/v2-cem-sacrifice.js'].forEach(f => vm.runInContext(rd(f), ctx, { filename: f }));
const O = ctx.V2Own, ME = 'me', KEY = 'xcpets-hidden-mainnet-' + ME;
const pets = [
  { id: 1, owner: ME, hd: ME, hungry: true, tier: 0 },          /* discarded on chain (G Money, Evan) */
  { id: 2, owner: ME, hungry: true, tier: 1 },                  /* only in this browser's pile */
  { id: 3, owner: ME, hungry: true, tier: 2 },                  /* named by a discard burn still confirming */
  { id: 4, owner: ME, hungry: true, tier: 0 },                  /* not discarded */
  { id: 5, owner: ME, hd: ME, hungry: true, tier: 1 },          /* on chain AND in the browser pile */
  { id: 6, owner: ME, hd: 'old', hungry: true, tier: 0 },       /* a former owner discarded it: not discarded for me (rules: hdHidden) */
  { id: 7, owner: ME, hd: ME, zombie: { gen: 1 } },             /* a risen zombie with an old flag: never discarded */
  { id: 8, owner: ME, hd: ME, dead: true },                     /* dead */
  { id: 9, owner: 'other', hd: 'other', hungry: true }          /* someone else's pet */
];
const w = { pets, byId: {}, tip: 977600 }; pets.forEach(p => { w.byId[p.id] = p; });
st[KEY] = JSON.stringify([2, 5, 7]); const PEND = { 3: 1 };
win.V2UI = { pendingFeedIds: () => ({ hd: PEND }) };
const WANT = { 1: 'chain', 2: 'browser', 3: 'pending', 4: null, 5: 'chain', 6: null, 7: null, 8: 'chain', 9: null };

/* 1. the answer */
pets.forEach(p => ok(O.discarded(p, ME) === WANT[p.id], '#' + p.id + ' is ' + (WANT[p.id] || 'not discarded') + ' (got ' + O.discarded(p, ME) + ')'));
ok(O.discarded(pets[1], ME, { set: null }) === null && O.discarded(pets[2], ME, { pend: null }) === null, 'a caller can leave the browser pile or pending burns out');
ok(O.discarded(pets[1], ME, { set: new Set([2]) }) === 'browser' && O.discarded(pets[1], ME, { set: new Set(['2']) }) === 'browser', 'the pile may be passed as { id: 1 } or a Set of numbers or strings');
ok(JSON.stringify(O.pileOrder(ME)) === '[2,5,7]', 'pileOrder keeps the list order');

/* 2. every screen agrees on the same world */
const isPile = p => { const d = O.discarded(p, ME, { pend: null }); return d === 'chain' || d === 'browser'; }; /* the pile: confirmed kinds */
const living = pets.filter(p => O.isLiving(p, ME, { zombies: false }));
const ids = a => a.map(p => p.id !== undefined ? p.id : +p).sort((x, y) => x - y).join(',');
ok(ids(living.filter(isPile)) === ids(O.pileList(w, ME, O.pileIds(ME), false).filter(p => !p.dead)), 'Discard pile box (pileList) = the answer (' + ids(O.pileList(w, ME, O.pileIds(ME), false)) + ')');
ok(ids(Object.keys(O.discardSet(w, ME)).map(Number).filter(id => O.isLiving(w.byId[id], ME, { zombies: false }))) === ids(living.filter(isPile)), 'discardSet (altar, sacrifice sheet, zombie card) = the answer');
ok(pets.every(p => O.inPile(p, ME, O.pileIds(ME)) === isPile(p)), 'inPile (My Pets) = the answer for every pet');
/* My Pets zombie card (js/v2.js zDiscarded), run as it is in the page */
const src = rd('js/v2.js'), zd = src.slice(src.indexOf('  function zDiscarded(w)'), src.indexOf('\n', src.indexOf('  function zDiscarded(w)')));
const c2 = vm.createContext({ ME, V: { retiredUI: () => true }, V2Own: O, hiddenIds: () => JSON.parse(st[KEY]), ZB: p => !!(p && p.zombie && !p.zombie.end) });
vm.runInContext(zd + '\nthis.zDiscarded = zDiscarded;', c2);
const Z = c2.zDiscarded(w); ok(ids(living.filter(p => Z[p.id])) === ids(living.filter(isPile)), 'My Pets zombie card pile = the answer (' + ids(living.filter(p => Z[p.id])) + ')');
/* the zombie sacrifice sheet: the rules take only on-chain discards; the sheet lists exactly those and counts the browser-only ones */
const V = { cemOfferWhy: (w, p, s) => p.owner !== s ? 'not yours' : p.dead ? 'dead' : (p.zombie && !p.zombie.end) ? 'zombie' : p.hd !== s ? 'only a discarded pet can be offered' : null, isZ: p => !!(p.zombie && !p.zombie.end), retiredUI: () => true };
const C = ctx.V2CemSacrifice._candidates({ w, V, ME, b: 977600, z: 99 }).map(p => p.id);
ok(ids(C) === ids(living.filter(p => O.discarded(p, ME) === 'chain')), 'zombie sacrifice sheet = the on-chain answer (' + ids(C) + ')');
const BO = ctx.V2CemSacrifice._browserOnly ? ctx.V2CemSacrifice._browserOnly({ w, ME }) : null;
if (BO != null) ok(BO === living.filter(p => O.discarded(p, ME) === 'browser').length, 'sacrifice sheet "browser only" count = the answer (' + BO + ')');
/* the feed guard (every feed button) and the Pantry / canEat answer */
const H = ctx.V2Habits;
pets.forEach(p => { if (!O.isLiving(p, ME, { zombies: false })) return; const why = H.feedWhy(w, p, ME, { hd: PEND }, 977601, null) || '', d = O.discarded(p, ME, { set: null, pend: PEND });
  ok(d === 'chain' ? /^discarded/.test(why) : d === 'pending' ? /being discarded/.test(why) : !/discarded/.test(why), 'feed guard #' + p.id + ' agrees (' + (why || 'feeds') + ')'); });
ok(pets.every(p => O.canEat(p, ME, PEND) === (O.isLiving(p, ME, { zombies: false }) && !!p.hungry && !O.discarded(p, ME, { set: null, pend: PEND }))), 'V2Own.canEat = living, hungry and not discarded on chain or confirming');

/* 3. no copies: nobody else reads p.hd or the browser pile list */
const SKIP = /^(v2-rules|v2-own|practice-engine)\.js$|worker/;
const ALL = fs.readdirSync(path.join(REPO, 'js')).filter(f => f.endsWith('.js') && !SKIP.test(f)).map(f => 'js/' + f);
/* the pet's flag p.hd (not the pending-discard set pend.hd / pendingFeedIds().hd, not CSS .hd-* classes) */
const FLAG = /[\w\]\)]\.hd\s*(===|!==|==|!=|&&|\))|!\s*[\w.]+\.hd\b/, LIST = /'xcpets-hidden-'/;
const flagCopies = ALL.filter(f => FLAG.test(rd(f).replace(/\.hd-[\w-]+|'\.hd[\w-]*'|"\.hd[\w-]*"|\b(pend|o)\.hd\b|pendingFeedIds\(\)\.hd\b/g, '')));
ok(!flagCopies.length, 'no script reads the discard flag p.hd itself (ask V2Own.discarded)' + (flagCopies.length ? ': ' + flagCopies.join(', ') : ''));
const listCopies = ALL.filter(f => f !== 'js/v2.js' && LIST.test(rd(f)));
ok(!listCopies.length, 'no script reads this browser\'s Discard pile list itself (V2Own.pileIds / pileOrder; js/v2.js keeps the writer)' + (listCopies.length ? ': ' + listCopies.join(', ') : ''));
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
