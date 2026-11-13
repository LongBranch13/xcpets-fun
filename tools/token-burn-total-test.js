#!/usr/bin/env node
/* The homepage burned total is the sum of the burn rows already loaded, not a second walk of /v2. */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const { burnTotal } = require('../js/token-box.js');
let fail = 0;
function ok(c, m) { if (c) console.log('ok', m); else { console.log('FAIL', m); fail++; } }
function pageSum(rows) { let tot = 0; rows.forEach(x => { tot += +x.quantity || 0; }); return tot; }
const src = fs.readFileSync(path.join(__dirname, '../js/token-box.js'), 'utf8');
ok(!/destructions\?limit/.test(src) && !/next_cursor/.test(src), 'token box does not page destruction cursors');
ok(burnTotal([]) === 0 && burnTotal(null) === 0 && burnTotal([{ quantity: 0 }, { quantity: '' }, {}]) === 0, 'empty quantities add nothing');
ok(burnTotal([{ quantity: '100000000' }, { quantity: 5 }]) === 100000005, 'quantity strings and numbers add');
ok(burnTotal([{ amount: 1.5 }]) === 150000000, 'amount in whole coins converts like the chain rows');
const big = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname, 'fixtures/burns-972901.json.gz'))));
ok(burnTotal(big.rows) === pageSum(big.rows), 'fixture sum matches the old page-by-page total');
const boot = JSON.parse(fs.readFileSync(path.join(__dirname, '../api/boot.json'), 'utf8'));
ok(boot.rows && boot.rows.length > 1000 && burnTotal(boot.rows) === pageSum(boot.rows), 'live feed sum matches the old page-by-page total (' + boot.rows.length + ' rows)');
console.log(fail ? fail + ' failed' : 'all passed');
process.exit(fail ? 1 : 0);
