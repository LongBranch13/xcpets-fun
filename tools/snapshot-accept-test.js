#!/usr/bin/env node
'use strict';
/* Exact-mode signature and the build id captured at script load. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let failed = 0;
function ok(cond, msg) { if (cond) console.log('ok ' + msg); else { failed++; console.error('FAIL ' + msg); } }
const files = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js'];
const scripts = files.map(f => ({ src: 'https://xcpets.fun/' + f + '?v=e6db15afb2' }));
scripts.push({ src: 'https://xcpets.fun/js/v2-boot-sync.js?v=e6db15afb2' });
const document = { currentScript: scripts[scripts.length - 1], scripts: scripts, hidden: true, addEventListener() {}, getElementById() { return null; }, querySelector() { return null; } };
const location = { href: 'https://xcpets.fun/', hostname: 'xcpets.fun', search: '', protocol: 'https:' };
const window = { document: document, location: location, console: console, setTimeout: setTimeout, clearTimeout: clearTimeout, setInterval: setInterval, clearInterval: clearInterval, URL: URL, URLSearchParams: URLSearchParams, addEventListener() {}, fetch() { return Promise.reject(new Error('offline')); } };
window.window = window;
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/v2-boot-sync.js'), 'utf8'), vm.createContext(window), { filename: 'js/v2-boot-sync.js' });
document.currentScript = null;
const B = window.V2BootSync;
ok(B.buildId() === 'e6db15afb2', 'build id survives after currentScript is cleared');
const urls = B.ruleUrls();
ok(urls && urls.length === files.length + 1 && /v2-replay-worker\.js\?v=e6db15afb2$/.test(urls[urls.length - 1]), 'ruleUrls still lists the replay worker after load');
const catchSrc = fs.readFileSync(path.join(ROOT, 'js/v2-boot-sync.js'), 'utf8').split('function catchUp')[1].split('function keyRsig')[0];
ok(/scripts: urls,/.test(catchSrc) && !/urls\.slice\(0,\s*-1\)/.test(catchSrc), 'catchUp forwards the replay worker url');
const page = '975631|4778|793db39f|3448|bfac5ee7|dex6cdd0303';
const man = '975631|4778|793db39f|3448|bfac5ee7';
ok(B.sameInputs(man, page) === true, 'a snapshot that omitted the dex suffix matches the same burns and block hashes');
ok(B.sameInputs(page, page) === true, 'identical signatures match');
ok(B.sameInputs(man + '|dex6cdd0303', page) === true, 'the same dex suffix matches');
ok(B.sameInputs(man + '|dexaaaaaaaa', page) === false, 'a different dex suffix is refused');
ok(B.sameInputs(page, man) === false, 'a snapshot that names a dex the page does not have is refused');
ok(B.sameInputs('975631|4778|deadbeef|3448|bfac5ee7', page) === false, 'a different burn hash is refused');
ok(B.sameInputs('975632|4778|793db39f|3448|bfac5ee7', page) === false, 'a different tip is refused');
ok(B.sameInputs('975631|4779|793db39f|3448|bfac5ee7', page) === false, 'a different burn count is refused');
ok(B.sameInputs('nope', page) === false, 'an unreadable signature is refused');
if (failed) { console.error(failed + ' failed'); process.exit(1); }
console.log('snapshot-accept-test passed');
