/* One answer to "did this change leave the rule files as main has them?" for every display-only test (Nov 25 2026).
 * Tests used to pin rule-file MD5s as literals. Every rules PR then left ~24 tests red for good, CI stayed red
 * on every commit, and a real failure could hide among the stale ones. The pins now read main's own bytes, so
 * they mean what they always meant ("this change did not touch the rules") and never go stale.
 * tools/stale-pin-guard-test.js fails if a literal pin comes back.
 *   const RM = require('./lib/rules-md5');
 *   RM.MAIN            main's js/v2-rules.js MD5 (origin/main, else HEAD, else the working file)
 *   RM.NOW             the working tree's js/v2-rules.js MD5
 *   RM.main(rel)       main's MD5 of any repo file (same fallbacks)
 *   RM.RSIG_FILES      the rule files the rules signature hashes (tools/sync-server/snapshot.js RULES) */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const md5 = b => crypto.createHash('md5').update(b).digest('hex');
const nowMd5 = rel => md5(fs.readFileSync(path.join(ROOT, rel)));
function fromGit(ref, rel) { try { return md5(cp.execFileSync('git', ['-C', ROOT, 'show', ref + ':' + rel], { maxBuffer: 1 << 27, stdio: ['ignore', 'pipe', 'ignore'] })); } catch (e) { return null; } }
const cache = {};
function main(rel) { return cache[rel] || (cache[rel] = fromGit('origin/main', rel) || fromGit('HEAD', rel) || nowMd5(rel)); }
let RSIG_FILES = [];
try { RSIG_FILES = (require('../sync-server/snapshot').RULES || []).slice(); } catch (e) {}
if (!RSIG_FILES.length) RSIG_FILES = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js'];
module.exports = { MAIN: main('js/v2-rules.js'), NOW: nowMd5('js/v2-rules.js'), main, now: nowMd5, md5, RSIG_FILES };
