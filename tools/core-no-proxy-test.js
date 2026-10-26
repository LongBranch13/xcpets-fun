#!/usr/bin/env node
/* core-no-proxy (Oct 25 2026): Core reads never fall back to api.xcp.fun/node (XCP Wallet dev: it is api.counterparty.io behind a
 * rate-limit helper). Fallback = CORE_BACKUP, then a Retry error. api.xcp.fun/v2 stays for xcp.fun features (launch, candles).
 *   node tools/core-no-proxy-test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
function ctx(fetchImpl) { const st = {}, ls = { getItem: k => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); }, removeItem: k => { delete st[k]; } };
  const calls = [], win = { console: { log() {}, warn() {}, error() {}, info() {} }, localStorage: ls, sessionStorage: ls, location: { search: '', hash: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/' },
    navigator: { userAgent: 'test' }, setTimeout, clearTimeout, AbortController, URLSearchParams, document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {} }), addEventListener() {}, body: null, documentElement: { style: {} } },
    addEventListener() {}, fetch: (u, o) => { calls.push(String(u)); return fetchImpl(String(u), o); } };
  win.window = win; win.self = win; const c = vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'rjs/config.js'), 'utf8'), c, { filename: 'config.js' });
  return { win, c, calls }; }
(async () => {
  const { win } = ctx(() => Promise.reject(new TypeError('fetch failed'))), C = win.XCPETS_CONFIG;
  ok(C && C.read.every(u => !/xcp\.fun/.test(u)), 'mainnet read list has no api.xcp.fun: ' + (C && C.read.join(' ')));
  ok(C && !C.coreFallback, 'no coreFallback');
  ok(C && C.read[0] === 'https://api.counterparty.io:4000/v2' && C.read[1] === 'https://api.unspendablelabs.com:4000/v2', 'Core first, backup second');
  ok(C && /api\.xcp\.fun\/v2/.test(C.launch || C.xcpfunApi || ''), 'api.xcp.fun/v2 kept for xcp.fun features (launch / candles)');
  { const t = ctx(() => Promise.reject(new TypeError('fetch failed'))); let err = null;
    try { await t.win.XCPETS_CONFIG.coreFetch('/', 200); } catch (e) { err = e; }
    ok(err && /every Counterparty node failed/.test(err.message), 'coreFetch: both :4000 blocked -> error, no proxy');
    ok(t.calls.length === 2 && t.calls.every(u => /:4000\/v2\//.test(u)), 'coreFetch asked only the two Core nodes: ' + t.calls.join(' ')); }
  { const t = ctx(u => /counterparty\.io/.test(u) ? Promise.reject(new TypeError('fetch failed')) : Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ result: {} }) }));
    const r = await t.win.XCPETS_CONFIG.coreFetch('/', 200); ok(r && r.ok && /unspendablelabs/.test(t.calls[1]), 'primary blocked -> backup answers'); }
  for (const f of ['js/v2-sales.js', 'rjs/chain.js', 'tools/api-feed.js']) { const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    ok(!/pagesAt\(API|getJ\(API \+ path\)|xcpCredits\(A\); throw/.test(s), f + ': no proxy fallback call left'); }
  console.log('core-no-proxy: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
