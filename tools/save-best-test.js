#!/usr/bin/env node
/* Today nudges (Nov 28 2026, Jake: "no one is feeding 2900 pets. that's expensive and pointless" / "I don't want my discards").
 *   1. "in danger" never counts discarded pets: V2Own.atRisk / riskList (chain, waiting and this browser's pile)
 *   2. no page keeps its own copy of the in-danger test (the copies in Today, My Pets and the urgency badge all counted discards)
 *   3. V2SaveBest ranks favourites, gear, special and grown pets first, says how many are worth a meal, prices the first N, and leaves out
 *      a pet with 3 blocks or fewer left (a feed burn might not confirm in time)
 *   node tools/save-best-test.js            (synthetic pets with the real rules functions)
 *   node --max-old-space-size=9000 tools/save-best-test.js --real <address>   (also replays api/boot.json and prints that wallet's numbers) */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let fails = 0, n = 0; const ok = (c, m) => { n++; console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const { load } = require('./lib/load-rules');
const c = load([]);
const store = {}; c.localStorage = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
const vm = require('vm');
['js/v2-own.js', 'js/v2-save-best.js'].forEach(f => vm.runInContext(rd(f), c, { filename: f }));
const Own = c.V2Own, SB = c.V2SaveBest, V = c.V2Rules;
ok(Own && Own.atRisk && Own.riskList && SB && SB.rank, 'V2Own.atRisk / riskList and V2SaveBest.rank load');

/* 1 + 3: synthetic wallet */
const ME = 'bc1qmetestwallet', tip = 980000;
let id = 1;
/* lastFed / hatchBlock: the rules' own feed check (V2Rules.burnMeal, PR 350) reads the starve clock from them, so a pet the test means to be
 * saveable is fed recently by that clock, and 'too-late' was fed long ago (it starves before a burn could land) */
const pet = o => Object.assign({ id: id++, owner: ME, species: 'peepo', tier: 0, stage: 1, care: 69, stats: { a: 10, b: 10 }, neglected: true, hungry: true, nextMeal: 517.5, deathBlock: tip + 19, hatchBlock: tip - 10, lastFed: tip - 10 }, o);
const pets = [
  pet({ name: 'plain1' }), pet({ name: 'plain2' }), pet({ name: 'plain3', stats: { a: 40 } }),
  pet({ name: 'rare', tier: 2 }),
  pet({ name: 'legend', tier: 3 }),
  pet({ name: 'fav' }),
  pet({ name: 'adult', stage: 3, care: 30000, nextMeal: 900 }),
  pet({ name: 'chain-discard', tier: 3, hd: ME }),
  pet({ name: 'browser-discard', tier: 3 }),
  pet({ name: 'too-late', tier: 3, deathBlock: tip + 2, hatchBlock: tip - 144 * 30, lastFed: tip - 144 * 30 }),
  pet({ name: 'safe', neglected: false }),
  pet({ name: 'mythic', mythicCare: true }),
  pet({ name: 'zombie', zombie: { end: null } }),
  pet({ name: 'other-owner', owner: 'bc1qsomeoneelse', tier: 3 }),
  pet({ name: 'dead', dead: true }),
];
const byId = {}; pets.forEach(p => { byId[p.id] = p; });
const w = { tip, pets, byId };
const N = s => pets.find(p => p.name === s);
store['xcpets-hidden-mainnet-' + ME] = JSON.stringify([N('browser-discard').id]);
const risk = Own.riskList(w, ME).map(p => p.name);
ok(risk.indexOf('chain-discard') < 0 && risk.indexOf('browser-discard') < 0, 'in danger leaves out pets discarded on chain and in this browser\'s pile (' + risk.join(', ') + ')');
ok(['safe', 'mythic', 'zombie', 'other-owner', 'dead'].every(s => risk.indexOf(s) < 0), 'in danger leaves out fed, Mythic, zombie, dead and other wallets\' pets');
ok(risk.length === 8, 'in danger counts the 8 real ones (got ' + risk.length + ')');
ok(Own.starving(N('chain-discard'), ME, tip) && !Own.atRisk(N('chain-discard'), ME, tip, {}), 'starving() still sees a discarded pet (only to say how many were left out)');
const r = SB.rank(w, ME, { kept: x => x === N('fav').id });
const order = r.ranked.map(p => p.name);
ok(order[0] === 'fav', 'a favourite comes first (' + order.join(' > ') + ')');
ok(order.indexOf('adult') < order.indexOf('legend') || order.indexOf('legend') < order.indexOf('rare'), 'grown and Legendary pets come before a plain Rare');
ok(order.indexOf('rare') < order.indexOf('plain1'), 'a Rare comes before a plain Common');
ok(order.indexOf('plain3') < order.indexOf('plain1'), 'then higher power first');
ok(order.indexOf('too-late') < 0 && r.risk.some(p => p.name === 'too-late'), 'a pet with 3 blocks or fewer left is in danger but not offered (a feed burn might not confirm in time)');
ok(r.worth === 3, 'worth saving = favourite, Legendary, grown (not the plain Rare or Commons): ' + r.worth);
ok(Math.abs(r.cost(2) - (517.5 + (order[1] === 'adult' ? 900 : 517.5))) < 1e-8, 'cost(2) = the first two meals: ' + r.cost(2));
ok(SB.pick(r, 12) === 3 && SB.pick(r, 1) === 1, 'the default ask is never more than the pets worth saving');
const r0 = SB.rank({ tip, pets: [pet({ name: 'p' }), pet({ name: 'q' })].map(p => (byId[p.id] = p, p)), byId }, ME, {});
ok(r0.worth === 0 && r0.ranked.length === 2, 'only plain pets in danger: nothing is "worth saving" (Today says let them go)');

/* 2: one in-danger test */
const copies = fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js') && !/^(v2-rules|v2-render|v2-own)\.js$/.test(f)).filter(f => /neglected\s*&&\s*!p\.mythicCare\s*&&\s*p\.deathBlock/.test(rd('js/' + f)));
ok(!copies.length, 'no page keeps its own "in danger" filter (use V2Own.riskList / atRisk)' + (copies.length ? ': ' + copies.join(', ') : ''));
['js/v2-today.js', 'js/v2-mypets-top.js', 'js/v2-intuitive.js'].forEach(f => ok(/V2Own\.(riskList|atRisk)/.test(rd(f)), f + ' asks V2Own for the in-danger list'));
const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).concat(['templates/game.html']);
pages.forEach(p => { const s = rd(p), t = s.indexOf('js/v2-today.js'), b = s.indexOf('js/v2-save-best.js'); if (t >= 0) ok(b >= 0 && b < t, p + ' loads v2-save-best.js before v2-today.js'); });

/* --real <address>: the wallet's real numbers from api/boot.json */
const ai = process.argv.indexOf('--real');
if (ai > 0) {
  const addr = process.argv[ai + 1], boot = JSON.parse(rd('api/boot.json'));
  const rows = boot.rows.slice().sort((a, b) => a.block_index - b.block_index || a.tx_index - b.tx_index), t = boot.tip || rows[rows.length - 1].block_index;
  const W = V.replay(rows, Object.assign({}, c.XCPETS_BLOCK_HASHES || {}, boot.hashes || {}), [], { tip: t, live: c.LiveEngine && c.LiveEngine.RealCore, dex: boot.dex });
  const me = W.pets.find(p => p.owner && p.owner.startsWith(addr)).owner, R = SB.rank(W, me, {});
  const old = W.pets.filter(p => p.owner === me && !p.dead && !p.released && p.neglected && !p.mythicCare && p.deathBlock != null && p.deathBlock > W.tip).length; /* stale-pin-ok: the old filter, on purpose, to show the drop */
  console.log('  ' + addr + ': old "in danger" ' + old + ', now ' + R.risk.length + ', worth saving ' + R.worth + ', can still be fed ' + R.ranked.length + ', best 12 cost ' + R.cost(Math.min(12, R.ranked.length)) + ' XCPETS, all ' + R.cost(R.ranked.length));
  console.log('  best 12: ' + R.ranked.slice(0, 12).map(p => '#' + p.id + ' ' + R.why(p.id).tags.join('+')).join(', '));
}
console.log(`save-best: ${n - fails} passed, ${fails} failed`); process.exit(fails ? 1 : 0);
