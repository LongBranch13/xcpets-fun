#!/usr/bin/env node
/* The Discard pile shows on-chain discards (Nov 25 2026, Evan: "I am also missing pets that I can't feed because they are said to be in
 * discard pile but they aren't and I never put them there").
 * My Pets hides a pet that is discarded ON CHAIN (p.hd === me, pet:hd) or in this browser's list (V2Own.inPile), but the Discard pile box
 * listed only this browser's list. A pet discarded from another device, before a cache clear, or by a discard burn that named other
 * pets was hidden everywhere: not in My Pets, not in the pile, and every feed said "discarded". The box now reads V2Own.pileList.
 * Checks:
 *  1. small worlds: browser list, on-chain flag, both, zombies, released, other owners, the Pet Cemetery tab;
 *  2. real chain (api/boot.json): for every wallet, every living pet My Pets hides (inPile) is in the pile, and the pile holds nothing else.
 *   node --max-old-space-size=9000 tools/discard-pile-chain-test.js [--boot FILE] */
'use strict';
const fs = require('fs'), path = require('path');
const { load, ROOT } = require('./lib/load-rules');
const A = process.argv.slice(2), opt = k => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : null; };
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const O = require(path.join(ROOT, 'js', 'v2-own.js')).V2Own;
ok(typeof O.pileList === 'function', 'V2Own.pileList is there');

/* 1) small worlds */
const me = 'me', P = (id, o) => Object.assign({ id, owner: me }, o || {});
const w = { pets: [P(1), P(2, { hd: me }), P(3), P(4, { hd: me }), P(5, { hd: me, zombie: { feralAt: 9 } }), P(6, { hd: me, zombie: { end: { kind: 'dust' } } }),
  P(7, { hd: me, released: 1 }), P(8, { owner: 'them', hd: 'them' }), P(9, { hd: 'old owner' }), P(10, { dead: true, hd: me }), P(11, { dead: true })] };
const ids = (L) => L.map(p => p.id).join();
ok(ids(O.pileList(w, me, null, false)) === '2,4,6', 'no browser list: the on-chain discards (a dust zombie record is a plain pet again) (' + ids(O.pileList(w, me, null, false)) + ')');
ok(ids(O.pileList(w, me, new Set([3, 4, 5, 8]), false)) === '2,3,4,6', 'browser list (a Set) + on chain, once each; never a risen zombie or another wallet\'s pet');
ok(ids(O.pileList(w, me, { 1: 1 }, false)) === '1,2,4,6', 'browser list as { id: 1 }');
ok(!O.pileList(w, me, null, false).some(p => p.id === 9), 'a flag set by an earlier owner is not this wallet\'s discard');
ok(ids(O.pileList(w, me, new Set([11]), true)) === '11', 'Pet Cemetery tab: browser list only (a dead pet can\'t be added back on chain)');
ok(O.pileList(w, null, new Set([1]), false).length === 0 && O.pileList(null, me, null, false).length === 0, 'no wallet or no world: empty');
const shown = new Set(O.pileList(w, me, new Set([3]), false).map(p => p.id));
ok(w.pets.filter(p => O.isLiving(p, me, { zombies: false }) && O.inPile(p, me, { 3: 1 })).every(p => shown.has(p.id)), 'every living pet My Pets hides is in the pile');

/* 2) real chain */
const bootFile = path.resolve(opt('--boot') || path.join(ROOT, 'api', 'boot.json'));
if (!fs.existsSync(bootFile)) { console.log('skip real chain: no ' + bootFile); process.exit(fails ? 1 : 0); }
const boot = JSON.parse(fs.readFileSync(bootFile, 'utf8')), c = load(), V = c.V2Rules;
const rows = boot.rows.slice().sort((a, b) => a.block_index - b.block_index || a.tx_index - b.tx_index);
const rw = V.replay(rows, Object.assign({}, c.XCPETS_BLOCK_HASHES || {}, boot.hashes || {}), [], { tip: boot.tip, live: c.LiveEngine && c.LiveEngine.RealCore, dex: boot.dex });
const pets = Array.isArray(rw.pets) ? rw.pets : Object.keys(rw.pets).map(k => rw.pets[k]), W = { pets };
const owners = {}; pets.forEach(p => { if (p.hd && p.hd === p.owner && !p.dead && !p.released && !O.isZ(p)) owners[p.owner] = (owners[p.owner] || 0) + 1; });
const wallets = Object.keys(owners), total = wallets.reduce((a, k) => a + owners[k], 0);
ok(total > 0, 'the chain has living on-chain discards (' + total + ' pets in ' + wallets.length + ' wallets)');
let bad = 0;
wallets.forEach(a => { const pile = new Set(O.pileList(W, a, null, false).map(p => p.id));
  const hidden = pets.filter(p => O.isLiving(p, a, { zombies: false }) && O.inPile(p, a, null));
  if (hidden.length !== pile.size || hidden.some(p => !pile.has(p.id))) { bad++; console.log('  ' + a.slice(0, 10) + ': hidden ' + hidden.length + ', pile ' + pile.size); } });
ok(bad === 0, 'every wallet: the pile is exactly the living pets My Pets hides for an on-chain discard (' + wallets.length + ' wallets)');
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
