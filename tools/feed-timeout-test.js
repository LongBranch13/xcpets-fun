/* feed-timeout-test (Oct 31 2026): the api feed's sale read must give up well inside the 30 min systemd / workflow limit,
 * publish the base copy (stale) with its own tip carried as the next base, and exit once the files are written. Static checks; nothing is read or sent. */
'use strict';
const fs = require('fs'), path = require('path');
const s = fs.readFileSync(path.join(__dirname, 'api-feed.js'), 'utf8'), wf = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'api-feed.yml'), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const m = /XCPETS_DEX_MS = \(\+process\.env\.FEED_DEX_MS \|\| (\d+) \* 60 \* 1000\)/.exec(s), lim = +((/timeout-minutes:\s*(\d+)/.exec(wf) || [])[1] || 30);
ok(!!m, 'sale read time limit is set (FEED_DEX_MS overrides)');
ok(m && +m[1] <= lim / 2, 'sale read limit ' + (m && m[1]) + ' min is at most half the ' + lim + ' min run limit');
ok(/\(!j\.dex\.stale \|\| j\.dexCarry\)/.test(s), 'a carried stale copy is still the next incremental base');
ok(/dexCarry: input\.dexCarry \? true : undefined/.test(s) && /dexTip: input\.dexCarry && input\.dexAssets \? input\.dexCarry\.tip/.test(s), 'boot.json stamps the carried copy with its own base tip, not the run tip');
ok(/\+last\.baseTip === \+prev\.dexTip/.test(s), 'carry only when the timed-out read answered from the boot base');
ok(/process\.exit\(0\); \/\* feed-timeout-fix/.test(s), 'the run exits after writing (background sale read cannot hold it open)');
console.log('feed-timeout-test: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
