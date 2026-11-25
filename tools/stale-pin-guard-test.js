#!/usr/bin/env node
/* Stale-pin guard (Nov 25 2026). Tests used to pin a rule file's MD5, or one exact ?v= cache token, as a literal.
 * The next rules PR or token bump made them fail forever: ~24 tests stayed red on main, CI was red on every commit,
 * and real failures hid among them. This test fails if such a literal comes back in a tools/ test.
 *   - "rules did not change": read the one pin file through tools/lib/rules-pin.js (require('./lib/rules-pin').pin(rel))
 *   - "the page loads this script": match the token loosely (\?v=[\w.-]+); tools/build-token-test.js and the
 *     per-PR "moved off the old token" checks (a negative match on the old token) cover the bump itself. */
'use strict';
const fs = require('fs'), path = require('path');
const DIR = __dirname;
let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (c) pass++; else fail++; };
const files = fs.readdirSync(DIR).filter(f => /-test\.(m?js)$/.test(f) && f !== path.basename(__filename));
const HEX32 = /(^|[^0-9a-f])[0-9a-f]{32}([^0-9a-f]|$)/;
const PINNY = /md5|MD5|RSIG|bytes unchanged|rules\.js|rjs\//;
const NEG = /!\/(?:\\.|[^/\\\n])*\/\.test\(/g;          /* negative matches ("moved off the old token") are fine */
const TOKEN = /\\\?v=(?=[a-z0-9-]*\d)[a-z0-9-]{5,}\/\.test\(/; /* a positive regex pin on one exact token */
const bad = [];
for (const f of files) {
  fs.readFileSync(path.join(DIR, f), 'utf8').split('\n').forEach((line, i) => {
    if (/stale-pin-ok/.test(line)) return; /* escape hatch for a pin that is really meant (say why on the line) */
    if (HEX32.test(line) && PINNY.test(line)) bad.push(f + ':' + (i + 1) + ' rule-file MD5 literal: use require(\'./lib/rules-pin\').pin(rel)');
    if (TOKEN.test(line.replace(NEG, ''))) bad.push(f + ':' + (i + 1) + ' exact ?v= token pin: match \\?v=[\\w.-]+ (or a negative match on the old token)');
  });
}
bad.forEach(b => console.log('  ' + b));
ok(bad.length === 0, 'no test pins a rule-file MD5 or one exact cache token (' + files.length + ' tests read)');
const RP = require('./lib/rules-pin');
ok(/^[0-9a-f]{32}$/.test(RP.pin('js/v2-rules.js')), 'rules-pin holds the v2-rules.js MD5 (the one place for it)');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
