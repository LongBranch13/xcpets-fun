#!/usr/bin/env node
/* js/handoff.js (phone "finish on your computer"): the code format, the checks on a scanned code, and when plan mode is on. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'handoff.js'), 'utf8');
function mkWin(o) {
  o = o || {}; const store = Object.assign({}, o.store || {});
  const loc = { hash: o.hash || '', search: o.search || '', pathname: '/play.html', href: '' };
  const win = {
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    location: loc, history: { replaceState: (a, b, u) => { loc.hash = ''; win._replaced = u; } },
    matchMedia: () => ({ matches: !!o.touch }),
    document: { readyState: 'complete', documentElement: { classList: { add() {} } }, body: null, getElementById: () => null },
    btoa: s => Buffer.from(s, 'binary').toString('base64'), atob: s => Buffer.from(s, 'base64').toString('binary'),
    escape, unescape, encodeURIComponent, decodeURIComponent, URLSearchParams, JSON, Date, Math, Error, String, Number, Array, Promise
  };
  Object.assign(win, o.extra || {}); win.self = win;
  vm.runInNewContext(SRC, Object.assign(win, { self: win }));
  return { win, store, H: win.XcpHandoff };
}
const A = 'bc1qtke38j72qv4d8eljn7pccaykypw8luytfwdn7q', B = '1JwWsArppwALMEdXWPmpDBcP1jwWsAPYkD';
let n = 0; function t(name, f) { f(); n++; console.log('ok', name); }

t('round trip keeps address, title, tags, amounts and labels', () => {
  const { H } = mkWin();
  const url = H._encode(A, 'Feed 2 pets', [{ tag: 'pet:feed:12', amount: 100, label: 'Feed Bob' }, { tag: 'pet:hatch', amount: 69 }], true);
  assert(url.startsWith('https://xcpets.fun/play.html#xh='));
  const o = H._decode(url.split('#xh=')[1]);
  assert.strictEqual(o.a, A); assert.strictEqual(o.t, 'Feed 2 pets');
  assert.strictEqual(JSON.stringify(o.plans), JSON.stringify([{ tag: 'pet:feed:12', amount: 100, label: 'Feed Bob' }, { tag: 'pet:hatch', amount: 69 }]));
});
t('a scanned code is kept, switches the page address and leaves the address bar', () => {
  const { H } = mkWin();
  const code = H._encode(B, 'Hatch', [{ tag: 'pet:hatch', amount: 69 }], false).split('#')[1];
  const r = mkWin({ hash: '#' + code, store: { 'xcpets-v2-view': 'bc1qother' } });
  assert.strictEqual(r.store['xcpets-v2-me'], B); assert(!('xcpets-v2-view' in r.store));
  assert.strictEqual(r.win.location.hash, ''); assert.strictEqual(r.win._replaced, '/play.html');
  const p = r.H.pending(); assert.strictEqual(p.a, B); assert.strictEqual(p.plans[0].tag, 'pet:hatch');
});
t('bad codes are refused and change nothing', () => {
  const { H } = mkWin();
  const bad = [{ v: 1, a: 'nope', p: [['pet:hatch', 69]] }, { v: 1, a: A, p: [['send:all', 69]] }, { v: 1, a: A, p: [['pet:hatch', -5]] }, { v: 1, a: A, p: [['pet:has space', 1]] }, { v: 1, a: A, p: [] }, { v: 2, a: A, p: [['pet:hatch', 69]] }];
  bad.forEach(o => {
    const code = Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    assert.throws(() => H._decode(code));
    const r = mkWin({ hash: '#xh=' + code, store: { 'xcpets-v2-me': A } });
    assert.strictEqual(r.store['xcpets-v2-me'], A); assert.strictEqual(r.H.pending(), null);
  });
});
t('only plain burns travel (trades, sends and issuances need a wallet on the device)', () => {
  const { H } = mkWin();
  assert(H.plain({ tag: 'pet:feed:1', amount: 10 }));
  assert(!H.plain({ kind: 'order', tag: 'pet:feed:1', amount: 10 }));
  assert(!H.plain({ tag: 'pet:feed:1' }));
});
t('plan mode: touch device, no wallet in the page, showing the chosen address', () => {
  assert.strictEqual(mkWin({ touch: true, store: { 'xcpets-handoff-me': A, 'xcpets-v2-me': A } }).H.on(), true);
  assert.strictEqual(mkWin({ touch: false, store: { 'xcpets-handoff-me': A, 'xcpets-v2-me': A } }).H.on(), false, 'desktop');
  assert.strictEqual(mkWin({ touch: true, store: { 'xcpets-handoff-me': A, 'xcpets-v2-me': B } }).H.on(), false, 'another address');
  assert.strictEqual(mkWin({ touch: true, store: { 'xcpets-handoff-me': A, 'xcpets-v2-me': A }, extra: { webXCP: {} } }).H.on(), false, 'Casa Tookan');
  assert.strictEqual(mkWin({ touch: true, store: { 'xcpets-handoff-me': A, 'xcpets-v2-me': A }, extra: { xcpwallet: {} } }).H.on(), false, 'XCP Wallet');
  assert.strictEqual(mkWin({ touch: true, store: { 'xcpets-v2-me': A } }).H.on(), false, 'not chosen');
});
console.log(n + ' handoff tests passed');
