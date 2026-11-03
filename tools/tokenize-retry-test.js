#!/usr/bin/env node
/* tokenize-69321 (Nov 2 2026): a player made 3 tokens for #69321 (blocks 974182, 974195, 974210, all valid: qty 1, indivisible, locked,
 * desc https://xcpets.fun/t/69321.json, issuer = owner) and the pet card never showed step 2. The Tokenize box offered step 1 again whenever its
 * one chain look per page load (V2Sales.tok.chainPend) was still running or had failed: a failed read resolved null = "no token yet".
 * Real #69321 chain answers (Core :4000, read-only, trimmed to what the code reads). Mock fetch only; nothing is signed or sent.
 *   node tools/tokenize-retry-test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { load } = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const V = load().V2Rules, ROOT = path.resolve(__dirname, '..');
const ME = 'bc1pfvkpmllr7mtn5uazqxumwp39h2ny3c8l6fmrgvjv2cqn5wlpt7hssf3gqd', ID = 69321, TIP = 974281;
const TOK = [['A17226813662021203359', 974210, 'd62170193d43163db9a2c53210d614984e40841a55f4ac9a0462351847d63c3b'], ['A9565939275361881444', 974195, 'b2'], ['A9838594135301834128', 974182, 'b1']];
const OTHER = 'A13420616103885206571'; /* the owner's token for #64084 (974030), 4th newest balance */
const iss = (A, b, tx, id) => ({ result: [{ tx_hash: tx, block_index: b, source: ME, issuer: ME, asset: A, quantity: 1, divisible: false, locked: true, description: V.deedDesc(id), status: 'valid', fee_paid: 0 }] });
function api0() { const a = { ['/addresses/' + ME + '/balances']: { result: TOK.map(t => ({ address: ME, asset: t[0], quantity: 1 })).concat([{ address: ME, asset: OTHER, quantity: 1 }, { address: ME, asset: 'XCPETS', quantity: 410528208832818 }]) },
    ['/assets/' + OTHER + '/issuances']: iss(OTHER, 974030, 'o1', 64084), '/assets/XCPETS/destructions': { result: [] } };
  TOK.forEach(t => { a['/assets/' + t[0] + '/issuances'] = iss(t[0], t[1], t[2], ID); a['/assets/' + t[0] + '/balances'] = { result: [{ address: ME, quantity: 1 }] }; }); return a; }
function page(opt) { opt = opt || {}; const api = opt.api || api0(), store = {}, ss = {}, calls = [], els = {}, timers = [];
  const S = o => ({ getItem: k => (k in o ? o[k] : null), setItem: (k, v) => { o[k] = String(v); }, removeItem: k => { delete o[k]; } });
  const fetch = url => { calls.push(url); if (opt.down && opt.down(url)) return Promise.reject(new TypeError('Failed to fetch'));
    if (opt.err && opt.err(url)) return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}), text: () => Promise.resolve('{"error":"node error"}'), headers: { get: () => null } });
    const k = Object.keys(api).find(x => url.indexOf(x) >= 0), j = k ? api[k] : null, res = { ok: !!j, status: j ? 200 : 404, json: () => Promise.resolve(j || {}), text: () => Promise.resolve(''), headers: { get: () => null } };
    return opt.hold && opt.hold(url) ? new Promise(r => { opt.release = () => r(res); }) : Promise.resolve(res); };
  const el = id => els[id] || (els[id] = { id, style: {}, hidden: false, innerHTML: '', textContent: '', disabled: false, classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, appendChild() {}, querySelectorAll: () => [], setAttribute() {}, parentNode: { insertBefore() {} } });
  const document = { getElementById: id => (id === 'pcTok' || (/^pcTok/.test(id) && el('pcTok').innerHTML.indexOf('id="' + id + '"') >= 0) ? el(id) : null), querySelector: () => null, querySelectorAll: () => [], createElement: () => el('x'), addEventListener() {}, dispatchEvent() {},
    body: Object.assign(el('body'), { getAttribute: k => (k === 'data-v2page' ? 'pet' : null) }) };
  const w = { tip: TIP, byId: { [ID]: { id: ID, owner: ME, species: 'pepe', stage: 3, tier: 2 } }, deeds: {}, listings: [], pets: [] };
  const sent = [], win = { V2Rules: V, localStorage: S(store), sessionStorage: S(ss), fetch, document, URLSearchParams, console, crypto: require('crypto').webcrypto, CustomEvent: function () {},
    location: { search: '?id=' + ID, hash: '', href: 'https://xcpets.fun/pet.html?id=' + ID }, addEventListener() {}, setTimeout: f => { timers.push(f); return 1; }, clearTimeout() {}, setInterval: () => 0,
    V2Mock: { ME, world: () => w, state: () => ({ tip: TIP, prod: true, verified: true }) }, TokenProof: { planWhy: () => null, serviceWhy: () => null },
    V2Wallet: { sendDex: p => { sent.push(p); return Promise.resolve({ txid: 'mint' }); }, send: p => { sent.push(p); return Promise.resolve({ txid: 'tie' }); } } };
  win.window = win; win.self = win; const ctx = vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/v2-sales.js'), 'utf8'), ctx, { filename: 'v2-sales.js' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/v2-pet-card.js'), 'utf8'), ctx, { filename: 'v2-pet-card.js' });
  /* the card's paint() needs the full page and throws here; tokPaint runs through V2PetCard.paint's second call */
  const paint = () => { try { win.V2PetCard.paint(); } catch (e) { } const t = timers.splice(0); };
  const box = () => { paint(); const h = el('pcTok').innerHTML; return { h, mint: /id="pcTokMint"/.test(h), mintOff: /id="pcTokMint" disabled/.test(h), tie: /id="pcTokTie"(?! disabled)/.test(h), txt: h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ') }; };
  const flush = () => new Promise(r => setTimeout(r, 15));
  const later = ms => vm.runInContext('(function(){var n=Date.now;Date.now=function(){return n()+' + ms + ';};})()', ctx);
  return { later, win, T: win.V2Sales.tok, box, flush, calls, sent, store, els, el, opt };
}
const tokPaintSafe = pg => { try { pg.win.V2PetCard.paint(); } catch (e) { } };
(async () => {
  process.on('unhandledRejection', e => { console.log('FAIL unhandled', e && e.message); process.exit(1); });
  ok(TOK.every(t => !V.deedIssueWhy(iss(t[0], t[1], t[2], ID).result[0], ID, ME, 1e12)), 'all 3 real #69321 issuances are valid pet tokens (format, issuer, qty 1, indivisible, locked)');
  /* 1) fresh browser, chain reachable: step 2 with the newest token */
  { const pg = page(); pg.box(); await pg.flush(); const b = pg.box();
    ok(b.tie && !b.mint, 'fresh browser: step 2 shown, no step 1 (' + b.txt.slice(0, 120) + ')');
    ok(/A17226…3359/.test(b.h), 'newest token A17226813662021203359 picked'); }
  /* 2) look still running: no live step 1 button meanwhile */
  { const pg = page({ hold: u => /\/balances\?limit=1000/.test(u) }); const b0 = pg.box();
    ok(!b0.mint && !b0.tie && /Looking on the chain/.test(b0.txt), 'while the chain look runs: "checking", no step 1 button (was: live step 1)');
    pg.opt.release(); await pg.flush(); const b1 = pg.box(); ok(b1.tie && !b1.mint, 'look done: step 2'); }
  /* 3) look fails (both :4000 nodes unreachable): step 1 paused, not offered */
  { let down = true; const pg = page({ down: u => down && /:4000\//.test(u) }); pg.box(); await pg.flush(); const b = pg.box();
    ok(b.mint && b.mintOff && !b.tie, 'failed look: step 1 button disabled (was: enabled = a second token)');
    ok(/could not check the chain/.test(b.txt), 'failed look says why: ' + b.txt.slice(b.txt.indexOf('Can'), b.txt.indexOf('Can') + 90));
  }
  /* 4) a node error (HTTP 500) that clears: the box looks again after CHK_RETRY and shows step 2 */
  { let bad = true; const pg = page({ err: u => bad && /\/balances\?limit=1000/.test(u) }); pg.box(); await pg.flush(); const b = pg.box();
    ok(b.mintOff && !b.tie, 'node error: step 1 paused');
    bad = false; pg.later(31e3); pg.box(); await pg.flush(); const b2 = pg.box(); ok(b2.tie && !b2.mint, 'retry after 30 s finds the token: step 2'); }
  /* 5) chainPend API: failure rejects (lookFailed), is not memoized; success still memoized */
  { let down = true; const pg = page({ err: u => down && /:4000\//.test(u) }); let e = null;
    await pg.T.chainPend(ID, ME, { deeds: {} }).then(null, x => { e = x; });
    ok(e && e.lookFailed, 'chainPend rejects when the chain cannot be read (was: null = "no token")');
    down = false; const pd = await pg.T.chainPend(ID, ME, { deeds: {} }); ok(pd && pd.asset === TOK[0][0], 'next look reads again (failure not cached)');
    const n = pg.calls.length; pg.T.pend(ID, null); await pg.T.chainPend(ID, ME, { deeds: {} }); ok(pg.calls.length === n, 'a good look is still cached 5 min');
    pg.T.pend(ID, null); pg.later(61e3); await pg.T.chainPend(ID, ME, { deeds: {} }, { fresh: true }); ok(pg.calls.length > n, '{fresh:true} skips the memo'); }
  { const a = api0(); delete a['/assets/' + TOK[0][0] + '/issuances']; delete a['/assets/' + TOK[1][0] + '/issuances']; delete a['/assets/' + TOK[2][0] + '/issuances'];
    const pg = page({ api: a, down: u => /\/assets\/A\d+\/issuances/.test(u) && !/A13420616103885206571/.test(u) }); let e = null;
    await pg.T.chainPend(ID, ME, { deeds: {} }).then(null, x => { e = x; }); ok(e && e.lookFailed, 'a failed issuance read is "unknown", not "not this pet"'); }
  /* shop: a failed look does not open window 1 */
  { const src = fs.readFileSync(path.join(ROOT, 'js/v2-sales.js'), 'utf8'), m = src.match(/function viaChain[\s\S]*?\n  function tieWait/);
    ok(m && !/\.then\(draw, draw\)/.test(m[0]) && /e && e\.lookFailed/.test(m[0]) && /shLookAgain/.test(m[0]), 'shop viaChain: failed look shows Try again, not window 1'); }
  /* 6) step 1 clicked with an empty store and a token already on chain: no second mint */
  { const a = api0(), bal = a['/addresses/' + ME + '/balances']; a['/addresses/' + ME + '/balances'] = { result: [] }; const pg = page({ api: a });
    pg.box(); await pg.flush(); const b = pg.box(); ok(b.mint && !b.mintOff, 'no token on chain yet: step 1 offered (right): ' + b.txt.slice(0, 200));
    pg.later(61e3);
    a['/addresses/' + ME + '/balances'] = bal; /* the mint from another browser confirms meanwhile */
    const btn = pg.el('pcTokMint'); btn.onclick(); await pg.flush(); await pg.flush();
    ok(pg.sent.length === 0, 'step 1 click re-checks the chain first: no wallet window for a second token');
    ok(/already made token A17226…3359/.test(pg.el('pcTokMsg').textContent), 'says the token is already made: ' + pg.el('pcTokMsg').textContent);
    const b2 = pg.box(); ok(b2.tie && !b2.mint, 'and moves to step 2'); }
  { const a = api0(); a['/addresses/' + ME + '/balances'] = { result: [] }; const pg = page({ api: a }); pg.box(); await pg.flush(); pg.box();
    pg.el('pcTokMint').onclick(); for (let i = 0; i < 5; i++) await pg.flush();
    ok(pg.sent.length === 1 && pg.sent[0].kind === 'issuance', 'no token anywhere: step 1 still mints (one wallet window, ' + (pg.sent[0] && pg.sent[0].kind) + ')'); }
  { const pg = page({ down: u => /:4000\//.test(u) }); pg.box(); await pg.flush(); pg.box(); const btn = pg.el('pcTokMint'); btn.disabled = false; btn.onclick(); for (let i = 0; i < 4; i++) await pg.flush();
    ok(pg.sent.length === 0 && /^Not sent: could not check the chain/.test(pg.el('pcTokMsg').textContent), 'chain unreadable at click time: nothing sent (' + pg.el('pcTokMsg').textContent.slice(0, 70) + ')'); }
  /* 7) tokenize-cap-1102: an owner with MORE than 4 unbound tokens (bc1qfgqx… made 14 at 974170) - the pet's token is older than the 4 newest */
  { const a = api0(), bal = a['/addresses/' + ME + '/balances'], OLD = TOK[2][0], d = id => ({ asset_info: { description: V.deedDesc(id) } });
    const newer = ['A11111111111111111111', 'A12222222222222222222', 'A13333333333333333333', 'A14444444444444444444', 'A15555555555555555555'];
    newer.forEach((A, i) => { a['/assets/' + A + '/issuances'] = iss(A, 974300 + i, 'n' + i, 70000 + i); });
    a['/addresses/' + ME + '/balances'] = { result: newer.map((A, i) => Object.assign({ address: ME, asset: A, quantity: 1 }, d(70000 + i))).concat([Object.assign({ address: ME, asset: OLD, quantity: 1 }, d(ID))]) };
    TOK.slice(0, 2).forEach(t => { delete a['/assets/' + t[0] + '/issuances']; });
    const pg = page({ api: a }); const pd = await pg.T.chainPend(ID, ME, { deeds: {} });
    ok(pd && pd.asset === OLD, '6th-newest token found by its description (was: only the 4 newest checked = step 1 again): ' + (pd && pd.asset));
    ok(pg.calls.some(u => /balances\?limit=1000&verbose=true/.test(u)), 'balances read asks for asset_info (verbose=true)');
    const pg2 = page({ api: Object.assign({}, a, { ['/addresses/' + ME + '/balances']: { result: newer.map(A => ({ address: ME, asset: A, quantity: 1 })).concat([{ address: ME, asset: OLD, quantity: 1 }]) } }) });
    const pd2 = await pg2.T.chainPend(ID, ME, { deeds: {} }); ok(pd2 === null, 'no asset_info (older Core): same 4-newest look as before, no error'); void bal; }
  console.log('tokenize-retry: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
