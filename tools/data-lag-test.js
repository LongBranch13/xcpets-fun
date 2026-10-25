#!/usr/bin/env node
/* data-lag banner rule (display only). node tools/data-lag-test.js */
'use strict';
const L = require('../js/v2-datalag.js'), fs = require('fs'), path = require('path');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const now = Date.parse('2026-10-25T19:30:00Z'), min = 60000;
ok(!L.lagging({ dataTip: 973100, chainTip: 973100, verified: true, dataAt: now }, now), 'fresh verified read: no banner');
ok(!L.lagging({ dataTip: 973097, chainTip: 973100, verified: false, dataAt: now - 5 * min }, now), '3 blocks behind (~30 min): no banner yet');
ok(L.lagging({ dataTip: 973096, chainTip: 973100, verified: false, dataAt: now - 5 * min }, now), '4 blocks behind the chain tip: banner');
ok(L.lagging({ dataTip: 973090, feedTip: 973100, verified: false, dataAt: now - 5 * min }, now), 'behind the feed block: banner');
ok(L.lagging({ dataTip: 973099, feedTip: 973100, feedAt: now - min, dataAt: now - 40 * min, verified: false }, now), 'feed 39 min newer than the copy: banner');
ok(!L.lagging({ dataTip: 973100, feedTip: 973100, feedAt: now - min, dataAt: now - 40 * min, verified: true }, now), 'feed newer in time but same block, verified: no banner');
ok(L.lagging({ dataTip: 973100, dataAt: now - 45 * min, verified: false }, now), 'only a 45 min old saved copy, no tip read: banner');
ok(!L.lagging({ dataTip: 973100, dataAt: now - 45 * min, verified: true }, now), 'old but verified (chain quiet): no banner');
ok(!L.lagging({ dataTip: 0 }, now) && !L.lagging(null, now), 'nothing loaded: no banner');
const s1 = { dataTip: 973090, chainTip: 973100, verified: false, dataAt: now - 60 * min }; ok(L.lagging(s1, now), 'lagging before catch-up');
Object.assign(s1, { dataTip: 973100, verified: true, dataAt: now }); ok(!L.lagging(s1, now), 'goes away on its own once the read catches up');
ok(L.TEXT === "Game data is catching up. Your burns are safe on-chain and will count. Please don't repeat a burn.", 'exact copy');
const src = fs.readFileSync(path.join(__dirname, '../js/v2-datalag.js'), 'utf8'); ok(!/fetch\(|XMLHttpRequest|getJson/.test(src), 'no network reads in the banner');
const css = fs.readFileSync(path.join(__dirname, '../css/halving.css'), 'utf8').split('data-lag-banner')[1] || ''; ok(!/#(f0f|ff00ff|e91e63|ff69b4|ffc0cb|ff1493)/i.test(css), 'no pink');
console.log('data-lag-test: ' + pass + ' pass, ' + fail + ' fail'); process.exit(fail ? 1 : 0);
