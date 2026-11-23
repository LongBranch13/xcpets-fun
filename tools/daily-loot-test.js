#!/usr/bin/env node
/* Daily loot (js/v2-daily-loot.js): three free ticks -> chest, streak, same meme for everyone on a day. Display only. */
'use strict';
const assert = require('assert');
const L = require('../js/v2-daily-loot.js');
let s = L.step(null, 100, 'in');
assert.strictEqual(L.done(s), 1); assert.ok(!L.ready(s));
s = L.step(s, 100, 'open'); assert.strictEqual(s.opened, 0, 'a locked chest does not open');
s = L.step(s, 100, 'place'); s = L.step(s, 100, 'dex'); assert.ok(L.ready(s));
s = L.step(s, 100, 'open'); assert.strictEqual(s.opened, 1); assert.strictEqual(s.streak, 1);
s = L.step(s, 100, 'open'); assert.strictEqual(s.streak, 1, 'opening twice in a day counts once');
s = L.step(s, 101, 'in'); assert.strictEqual(L.done(s), 1, 'new day, ticks reset'); assert.strictEqual(s.opened, 0);
['place', 'dex', 'open'].forEach(e => { s = L.step(s, 101, e); }); assert.strictEqual(s.streak, 2, 'next day keeps the streak');
s = L.step(s, 103, 'in'); ['place', 'dex', 'open'].forEach(e => { s = L.step(s, 103, e); }); assert.strictEqual(s.streak, 1, 'a skipped day resets'); assert.strictEqual(s.best, 2);
s = L.step(s, 104, 'in'); s = L.step(s, 105, 'in'); ['place', 'dex', 'open'].forEach(e => { s = L.step(s, 105, e); }); assert.strictEqual(s.streak, 1, 'visiting without opening does not keep the streak');
const M = [{ file: 'a' }, { file: 'b' }, { file: 'c' }];
assert.strictEqual(L.memeFor(M, 5), L.memeFor(M, 5)); assert.ok(M.includes(L.memeFor(M, 6))); assert.strictEqual(L.memeFor([], 1), null);
const seen = new Set(); for (let d = 0; d < 3; d++) seen.add(L.memeFor(M, d).file); assert.strictEqual(seen.size, 3, 'walks the whole list');
console.log('daily-loot-test: all checks pass');
