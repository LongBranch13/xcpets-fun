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

const RSIG = {
  'js/v2-rules.js': '4f043b06d203135a6f7be660f84bc216',
  'rjs/config.js': '66e38a276cf59ade25115a80ceb7deea',
  'rjs/pet-core.js': '47be652fe0a5dd6157a95f5b2c6585fa',
  'rjs/game-core.js': '2784e9ccac773c4e0e58d646fc47b05f',
  'rjs/bonus-gear.js': 'deaa0b54f40c5ab1887ea9e5fa641e6c',
  'rjs/real-core.js': '601044a00a67c15f6013235f73fe9cdc',
  'rjs/chain.js': 'f905e7eea23d1fd30484517b25ae3836',
  'js/pet-core.js': '1c45c5e9f400faf17b3b57fe72166f0e',
  'js/bonus-gear.js': '36734cff209497808af0142e2510630d',
  'js/v2-gear.js': 'd0d440f3b7d6ded06837e2992651778d',
  'js/v2-fit.js': '4930f92ad62596d94c263173c4b61cdb'
};
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
ok(/sw66-1/.test(sw) && /isRules\(url\) \{ return \/\^?\/js\\\/v2-rules/.test(sw) === false, 'service worker version moved');
ok(/!\/\[\?&\]v=\/.test\(url\.search\)/.test(sw), 'only an unversioned rules file stays network-first');
ok(/sw\.js\?v=sw66-1/.test(rd('js/v2-events.js')), 'pages register the new worker');

const play = rd('templates/game.html');
ok(/function __go\(\)/.test(play), 'game scripts after boot wait until the document is ready');
ok(/v2-arena/.test(play) && /__s\[__k\]/.test(play), 'place scripts are chosen from the page');
ok(/wizard-sprite\.js\?v=[^"]+" defer/.test(play), 'sprite scripts do not block the published-world read');
ok(/js\/v2-rules\.js\?v=/.test(play) && !/v2-rules\.js\?v=[^"]+" defer/.test(play), 'the rules file is still loaded before boot');
ok(/split=\(\?:0\|off\)/.test(play), 'the light view does not prefetch the full burn list');
ok(/function loadBoard\(/.test(split) && !/\/xp\/v1\/sync/.test(split), 'rankings read pet shards, not the full sync');
ok(/w\._ranked/.test(rd('js/v2-token-gallery.js')) && /!p && w && w\._ranked/.test(rd('js/v2-token-gallery.js')), 'Proof Parade keeps feed rows until the whole living world is read');

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
