/* pet-deck-test: the pet deck page (PREVIEW) and its stubbed The Game Crafter order flow.
 * Checks: the deck charge lives in one config value; banned copy words stay out; the order stub never touches the network;
 * the shared back QR is a fixed version 6 for every address type; the deck page never asks the wallet to sign; build stamps match. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = path.join(__dirname, '..'), rd = f => fs.readFileSync(path.join(R, f), 'utf8');
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const FILES = ['deck.html', 'js/v2-deck.js', 'js/deck-tgc-stub.js', 'js/deck-config.js', 'css/deck.css'];
const src = Object.fromEntries(FILES.map(f => [f, rd(f)]));

// 1) one config value for the deck charge
const cfg = {}; vm.runInNewContext(src['js/deck-config.js'], { window: cfg });
const usd = cfg.XCPETS_DECK && cfg.XCPETS_DECK.chargeUSD;
ok(typeof usd === 'number' && usd >= 39 && usd <= 49, 'deck charge is one number from 39 to 49 in js/deck-config.js (' + usd + ')');
ok(FILES.filter(f => f !== 'js/deck-config.js').every(f => !/chargeUSD\s*[:=]\s*\d/.test(src[f]) && !/\$\s?(39|4\d)\b/.test(src[f])), 'no other file sets or hard-codes the deck charge');

// 2) copy words that must not appear
const banned = [[/price/i, 'price'], [/series/i, 'series'], [/discount/i, 'discount'], [/×/, 'the times sign'], [/\d\s*x\s*\d/i, 'N x N']];
for (const f of FILES) for (const [re, name] of banned) ok(!re.test(src[f]), f + ' has no "' + name + '"');

// 3) the order stub plans the real TGC calls but never touches the network
let net = 0; const trap = () => { net++; throw new Error('network call from the stub'); };
const sb = { window: {}, module: { exports: {} }, setTimeout, clearTimeout, Promise, fetch: trap, XMLHttpRequest: trap, navigator: { sendBeacon: trap } };
vm.runInNewContext(src['js/deck-tgc-stub.js'], sb);
const TGC = sb.module.exports.plan ? sb.module.exports : sb.window.DeckTGC;
ok(TGC && TGC.STUB === true, 'DeckTGC is marked STUB');
const deck = { address: 'bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n', pets: Array.from({ length: 52 }, (_, i) => ({ id: i + 1, name: 'P' + i })) };
const ship = { name: 'Sample Player', address1: '1 Main St', city: 'Madison', state: 'WI', postal_code: '53704', country: 'US', email: 'p@example.com' };
const plan = TGC.plan(deck, ship), eps = plan.map(s => s.method + ' ' + String(s.url || s.path).replace(/^https:\/\/www\.thegamecrafter\.com/, '')).join('\n');
for (const e of ['POST /api/session', 'POST /api/game', 'POST /api/file', 'POST /api/deck', 'POST /api/card', 'POST /api/twosidedbox', 'POST /api/cart', 'POST /api/address'])
  ok(eps.includes(e), 'plan has ' + e);
ok(plan.filter(s => /\/api\/file$/.test(s.url) && /back/i.test(s.what)).length === 1, 'plan uploads exactly one shared back');
ok(plan.every(s => /^https:\/\/www\.thegamecrafter\.com\/api\//.test(s.url)), 'every planned call is a TGC /api endpoint');
Promise.resolve(TGC.run(deck, ship, () => {}, 0)).then(r => {
  ok(net === 0, 'stub run made no network call');
  ok(r && /STUB/.test(JSON.stringify(r)), 'stub run returns stub ids only');

  // 4) shared back QR: fixed version 6 (41 modules) fits the longest address URL
  const q = { window: {}, module: { exports: {} } }; q.exports = q.module.exports; vm.runInNewContext(rd('js/qrcode-gen.js'), q);
  const qrcode = q.module.exports && typeof q.module.exports === 'function' ? q.module.exports : (q.window.qrcode || q.qrcode);
  for (const a of ['bc1pfvkpzqlkpcvsjxcp8uj6lsy9xsl4c9h0pfyvuhcxw7rqfdtxlwvqhv3gqd', 'bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n', '1BoatSLRHtKNngkdXEeobR76b53LETtpyT']) {
    const g = qrcode(6, 'M'); g.addData('https://xcpets.fun/deck.html?a=' + a, 'Byte'); let made = true; try { g.make(); } catch (e) { made = false; }
    ok(made && g.getModuleCount() === 41, 'QR version 6 (41 modules) holds the ' + a.slice(0, 4) + ' deck URL');
  }
  ok(/qrcode\(6,\s*'M'\)/.test(src['js/v2-deck.js']), 'the deck page draws the back QR at fixed version 6, level M');

  // 5) never sign
  ok(!/sign(Message|AndBroadcast|Psbt|Transaction)|xcp_sign|broadcast/i.test(src['js/v2-deck.js'] + src['js/deck-tgc-stub.js']), 'deck page and stub never ask the wallet to sign or broadcast');
  ok(!/api\.xcp\.fun/.test(Object.values(src).join('')), 'no api.xcp.fun');

  // 6) build stamps match the rest of the site
  const stamp = (rd('pet.html').match(/\?v=([0-9a-f]+)/) || [])[1];
  const refs = src['deck.html'].match(/(?:src|href)="(?:js|css)\/[^"]+"/g) || [];
  ok(refs.length > 10 && refs.every(r => r.includes('?v=' + stamp)), 'every deck.html script and stylesheet carries ?v=' + stamp);
  for (const f of ['js/deck-config.js', 'js/qrcode-gen.js', 'js/deck-tgc-stub.js', 'js/v2-deck.js', 'css/deck.css']) ok(src['deck.html'].includes(f + '?v='), 'deck.html loads ' + f);
  console.log(bad ? bad + ' failed' : 'all pet deck checks pass'); process.exit(bad ? 1 : 0);
}).catch(e => { console.log('FAIL stub run threw: ' + e.message); process.exit(1); });
