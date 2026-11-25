#!/usr/bin/env node
/* Scripts that read their own ?v= token as the build id need a HEX token (Nov 25 2026).
 * js/v2-chain.js reads /[?&]v=([0-9a-f]{6,})/ from its own src: with a non-hex token (PR 252 set "merge1124") BUILD was null, the
 * replay worker never started, and when the game server was down the whole game was rebuilt on the main thread (two 35 s freezes
 * on the owner's wallet). v2-split.js also builds the page's rules signature from v2-chain.js's token (v2-replay-worker.js?v=...).
 *   node tools/build-token-test.js */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let fails = 0, n = 0; const ok = (c, m) => { n++; console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
/* every script that parses its own token as hex */
const SELF = fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js') && /v=\(\[0-9a-f\]\{6,\}\)\/\.exec\(\(?(document|d)\.currentScript/.test(rd('js/' + f)));
ok(SELF.indexOf('v2-chain.js') >= 0, 'found the scripts that read their own build token: ' + SELF.join(', '));
const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).concat(['templates/game.html']);
const bad = [];
pages.forEach(p => { const s = rd(p); SELF.forEach(f => { const re = new RegExp('js/' + f.replace('.', '\\.') + '\\?v=([^"\'&]*)', 'g'); let m; while ((m = re.exec(s))) if (!/^[0-9a-f]{6,}$/.test(m[1])) bad.push(p + ': ' + f + '?v=' + m[1]); }); });
ok(!bad.length, 'every page gives those scripts a hex token of 6+ characters' + (bad.length ? ' (' + bad.slice(0, 10).join('; ') + ')' : ''));
console.log(`build-token: ${n - fails} passed, ${fails} failed`); process.exit(fails ? 1 : 0);
