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
function b64(o) { return Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
let n = 0; function t(name, f) { f(); n++; console.log('ok', name); }

t('round trip keeps address, title, tags, amounts and labels', () => {
  const { H } = mkWin();
  const url = H._encode(A, 'Feed 2 pets', [{ tag: 'pet:feed:12', amount: 100, label: 'Feed Bob' }, { tag: 'pet:hatch', amount: 69 }], true);
  assert(url.startsWith('https://xcpets.fun/play.html#xh='));
  const o = H._decode(url.split('#xh=')[1]);
  assert.strictEqual(o.a, A); assert.strictEqual(o.batches.length, 1); assert.strictEqual(o.batches[0].t, 'Feed 2 pets');
  assert.strictEqual(JSON.stringify(o.batches[0].plans), JSON.stringify([{ tag: 'pet:feed:12', amount: 100, label: 'Feed Bob' }, { tag: 'pet:hatch', amount: 69 }]));
});
t('old one-batch (v1) links still open', () => {
  const { H } = mkWin();
  const code = b64({ v: 1, a: A, t: 'Hatch', p: [['pet:hatch', 69]] });
  const o = H._decode(code); assert.strictEqual(o.batches[0].plans[0].tag, 'pet:hatch'); assert.strictEqual(o.batches[0].t, 'Hatch');
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
  const bad = [{ v: 1, a: 'nope', p: [['pet:hatch', 69]] }, { v: 1, a: A, p: [['send:all', 69]] }, { v: 1, a: A, p: [['pet:hatch', -5]] }, { v: 1, a: A, p: [['pet:has space', 1]] }, { v: 1, a: A, p: [] }, { v: 3, a: A, p: [['pet:hatch', 69]] },
    { v: 2, a: A, b: [] }, { v: 2, a: A, b: [['ab12', 'x', [['pet:hatch', 69]]], ['ab12', 'y', [['pet:hatch', 69]]]] }, { v: 2, a: A, b: [['ab12', 'x', [['pet:hatch', 0]]]] }, { v: 2, a: A, b: [['<b>', 'x', [['pet:hatch', 1]]]] }];
  bad.forEach(o => {
    const code = b64(o);
    assert.throws(() => H._decode(code));
    const r = mkWin({ hash: '#xh=' + code, store: { 'xcpets-v2-me': A } });
    assert.strictEqual(r.store['xcpets-v2-me'], A); assert.strictEqual(r.H.pending(), null);
  });
});
t('computer inbox: codes opened one after another pile up; the same batch never twice; signed batches never come back', () => {
  const { H } = mkWin();
  const b1 = { id: 'aaaa1', t: 'Hatch', plans: [{ tag: 'pet:hatch', amount: 69 }] }, b2 = { id: 'bbbb2', t: 'Feed 2', plans: [{ tag: 'pet:feed:1', amount: 5 }, { tag: 'pet:feed:2', amount: 5 }] };
  const c1 = H._encodeBatches(A, [b1], true).split('#')[1], c12 = H._encodeBatches(A, [b1, b2], true).split('#')[1];
  const c3 = H._encode(B, 'Hatch B', [{ tag: 'pet:hatch', amount: 69 }], false).split('#')[1];
  let r = mkWin({ hash: '#' + c1 });
  r = mkWin({ hash: '#' + c12, store: r.store }); r = mkWin({ hash: '#' + c12, store: r.store });
  let p = r.H.pending();
  assert.strictEqual(p.a, A); assert.strictEqual(p.items.length, 2); assert.strictEqual(p.plans.length, 3); assert.strictEqual(p.t, '2 batches'); assert.strictEqual(p.others, 0);
  r = mkWin({ hash: '#' + c3, store: r.store }); p = r.H.pending();
  assert.strictEqual(p.a, B, 'newest wallet first'); assert.strictEqual(p.items.length, 1); assert.strictEqual(p.others, 2);
  // b1 signed on this computer: scanning the bigger code again adds nothing back
  const st = Object.assign({}, r.store, { 'xcpets-handoff-done': JSON.stringify({ aaaa1: Date.now(), bbbb2: Date.now() }), 'xcpets-handoff-in': JSON.stringify({ items: [] }) });
  r = mkWin({ hash: '#' + c12, store: st }); assert.strictEqual(r.H.pending(), null, 'already signed');
  const old = { items: [{ id: 'cccc3', a: A, t: 'x', plans: [{ tag: 'pet:hatch', amount: 1 }], at: Date.now() - 4 * 24 * 3600e3 }] };
  assert.strictEqual(mkWin({ store: { 'xcpets-handoff-in': JSON.stringify(old) } }).H.pending(), null, 'kept 3 days');
});
t('phone list: a big list splits into several codes that each fit and together hold every batch', () => {
  const { H } = mkWin();
  const b = []; for (let i = 0; i < 30; i++) b.push({ id: 'id' + i + 'xx', t: 'Feed pets ' + i, plans: [1, 2, 3, 4].map(k => ({ tag: 'pet:feed:' + (i * 10 + k), amount: 12.5, label: 'Feed pet number ' + (i * 10 + k) })) });
  const all = H._codes(A, b); assert(all.length > 1, 'split'); let ids = [];
  all.forEach(u => { assert(u.length <= 2000, 'fits'); ids = ids.concat(H._decode(u.split('#xh=')[1]).batches.map(x => x.id)); });
  assert.strictEqual(ids.join(), b.map(x => x.id).join());
  assert.strictEqual(H._codes(A, b.slice(0, 2)).length, 1, 'a short list is one code');
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
