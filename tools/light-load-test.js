#!/usr/bin/env node
/* Light published view. No rule file is part of this change.
 * The rules signature is still taken from the same files, and js/v2-rules.js stays the live bytes. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (c) pass++; else fail++; };
function rd(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function md5(rel) { return crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex'); }

const RSIG = require('./lib/rules-pin').PIN; /* rules-pin: every rule file's MD5 lives in tools/fixtures/rules-pin.json */
Object.keys(RSIG).forEach(rel => ok(md5(rel) === RSIG[rel], rel + ' bytes unchanged'));

const split = rd('js/v2-split.js');
ok(/var STALE = 48;/.test(split), 'a view stays up for 48 blocks of snapshot lag');
ok(!/setTimeout\(function \(\) \{ startVerify\(\); \}, 2000\)/.test(split), 'the full check does not start by itself');
ok(/id="splitVerify"/.test(split) && /startVerify\(\)/.test(split), 'Verify still starts the check');
ok(/function more\(n\)/.test(split) && /SCREEN_PAGES = 7/.test(split), 'living pets load a screen at a time');
ok(!/for \(i = 1; i < pg\.pages; i\+\+\) left\.push\(i\)/.test(split), 'owner pages are not all queued up front');
ok(/view\/p\//.test(split) && /function ensurePet[\s\S]{0,500}view\/p\//.test(split), 'one pet comes from its shard');
ok(/function ensureDead\(/.test(split), 'the cemetery still asks for graves');
ok(/indexedDB\.deleteDatabase\('xcpets-world'\)/.test(split), 'a light visit drops a saved full world');
ok(/xcpets-v2-prod-rows/.test(split) && /xcpets-v2-last-1/.test(split), 'large burn-list copies are eligible to be dropped');

const ui = rd('js/v2.js');
ok(/V2Split\.more/.test(ui), 'Show more asks for the next living pages');
ok(!/loading all /.test(ui), 'the pager no longer says it is loading every pet');
ok(/readViewBalance\(/.test(rd('js/v2-chain.js')), 'the published view still reads the wallet balance');

const sw = rd('sw.js');
const SWV = (/var VERSION = '([^']+)'/.exec(sw) || [])[1];
ok(SWV && /isRules\(url\) \{ return \/\^?\/js\\\/v2-rules/.test(sw) === false, 'service worker version moved');
ok(/!\/\[\?&\]v=\/.test\(url\.search\)/.test(sw), 'only an unversioned rules file stays network-first');
ok(SWV && rd('js/v2-events.js').indexOf('sw.js?v=' + SWV) >= 0, 'pages register the current worker (' + SWV + ')'); /* one version in sw.js, read here: no hand-kept copy to go stale */

const play = rd('templates/game.html');
ok(/function __go\(\)/.test(play), 'game scripts after boot wait until the document is ready');
ok(/v2-arena/.test(play) && /__s\[__k\]/.test(play), 'place scripts are chosen from the page');
ok(/wizard-sprite\.js\?v=[^"]+" defer/.test(play), 'sprite scripts do not block the published-world read');
ok(/js\/v2-rules\.js\?v=/.test(play) && !/v2-rules\.js\?v=[^"]+" defer/.test(play), 'the rules file is still loaded before boot');
ok(/split=\(\?:0\|off\)/.test(play), 'the light view does not prefetch the full burn list');
ok(/function loadBoard\(/.test(split) && !/\/xp\/v1\/sync/.test(split), 'rankings read pet shards, not the full sync');
ok(/w\._ranked/.test(rd('js/v2-token-gallery.js')) && /!p && w && \(?w\._ranked/.test(rd('js/v2-token-gallery.js')), 'Proof Parade keeps feed rows until the whole living world is read');

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
