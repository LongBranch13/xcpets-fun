#!/usr/bin/env node
/* Every rule file matches tools/fixtures/rules-pin.json, the one place their MD5s are pinned (see tools/lib/rules-pin.js).
 * A rules PR runs `node tools/rules-pin-test.js --write` and updates CLAUDE.md's "Current MD5" line; nothing else needs a new hash. */
'use strict';
const fs = require('fs'), path = require('path');
const P = require('./lib/rules-pin');
if (process.argv.includes('--write')) { const o = {}; Object.keys(P.PIN).forEach(f => { o[f] = P.md5(f); }); fs.writeFileSync(P.FILE, JSON.stringify(o, null, 2) + '\n'); console.log('wrote ' + path.relative(P.ROOT, P.FILE)); process.exit(0); }
let fail = 0;
Object.keys(P.PIN).forEach(f => { const ok = P.md5(f) === P.PIN[f]; if (!ok) fail++; console.log((ok ? 'ok   ' : 'FAIL ') + f + (ok ? '' : ' is ' + P.md5(f) + ', pinned ' + P.PIN[f] + ': a rules change? run node tools/rules-pin-test.js --write')); });
const md = fs.readFileSync(path.join(P.ROOT, 'CLAUDE.md'), 'utf8'), cur = /Current MD5[^`]*`([0-9a-f]{32})`/.exec(md);
const ok2 = cur && cur[1] === P.PIN['js/v2-rules.js']; if (!ok2) fail++;
console.log((ok2 ? 'ok   ' : 'FAIL ') + 'CLAUDE.md "Current MD5" is the pinned js/v2-rules.js MD5' + (ok2 ? '' : ' (' + (cur && cur[1]) + ')'));
console.log('rules-pin-test: ' + (fail ? fail + ' failed' : 'all ok'));
process.exit(fail ? 1 : 0);
