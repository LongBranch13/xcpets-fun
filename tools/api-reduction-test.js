'use strict';
/* api-reduction (preview): guards for the call-count cuts. Static checks on the page code (the behaviour is replay-neutral, run-tests replay covers data). */
const fs = require('fs'), path = require('path'), assert = require('assert'), R = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const cfg = R('rjs/config.js'), chain = R('js/v2-chain.js'), sales = R('js/v2-sales.js'), re = R('tools/recent-events.js'), tm = R('tools/token-meta.js');
assert(/mainnet: \{ read: \[COUNTERPARTY_CORE, CORE_BACKUP\][^\n]*coreFallback: null/.test(cfg), 'mainnet reads only the two :4000 nodes, no api.xcp.fun proxy');
assert(/function refresh\(cb\)[\s\S]*chain\.tip\(\)[\s\S]*readMempool\(chain\)/.test(chain), 'poll reads the tip first and only the mempool when it is unchanged');
assert(/600e3/.test(chain), 'full re-read at least every 10 minutes');
assert(/touched\.miss/.test(sales) && /XCPETS_DEX_MS/.test(sales), 'missed blocks keep the saved data; sales read has a time limit');
assert(/Promise\.resolve\(MINT_WINDOW\.slice\(\)\)/.test(sales), 'closed mint window: fixed token list, no 2.5 s scan race');
[re, tm].forEach(s => assert(/core-limiter\.js'\)\.makeFetch\(/.test(s), 'feed tools use the shared limiter'));
console.log('api-reduction-test ok');
