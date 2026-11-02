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
/* feed-fallback: blocked :4000 -> game feed as live source, fast fail remembered across visits, no api.xcp.fun core reads */
{ const ch = R('rjs/chain.js');
  assert(!/localStorage\.setItem\(NET_KEY/.test(ch) && /allNetSick\(bases\)/.test(ch) && /PROBE_MS = 4000/.test(ch) && /prs\.forEach/.test(ch), 'burn-check-fix: blocked :4000 remembered per session only, probe asks every Core node');
  assert(/Chain\.forgetBlocked/.test(ch) && /forgetBlocked\(\)/.test(chain) && /GAPS = \[4000, 10000, 20000\]/.test(chain), 'burn-check-fix: burn safety read forgets the blocked memory and retries patiently');
  assert(/api\/boot\.json\?t=' \+ Math\.floor\(Date\.now\(\) \/ 60e3\)/.test(chain) && /Date\.now\(\) - feedAt < 60e3/.test(chain), 'feed re-fetch cache-busted, once a minute');
  assert(/from the game feed, block /.test(chain), 'feed label');
  assert(!/api\.xcp\.fun/.test(cfg.split('mainnet:')[1].split('\n')[0].replace(/\/\*.*$/, '')), 'no api.xcp.fun core read'); }
console.log('feed-fallback checks ok');
