#!/usr/bin/env node
/* A block hash is cached only when a trusted publication has it or two independent sources agree,
 * and a verify-worker part whose sha256 does not match the manifest is refused.
 * Nothing is signed or broadcast. js/v2-rules.js is not modified. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (c) pass++; else fail++; };
function md5(rel) { return crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex'); }
ok(md5('js/v2-rules.js') === require('./lib/rules-pin').pin('js/v2-rules.js'), 'js/v2-rules.js is unchanged');

const GOOD = '0000000000000000' + 'ab'.repeat(24);
const OTHER = '0000000000000000' + 'cd'.repeat(24);
const WEAK = 'ff' + 'ab'.repeat(31);
const H = 970000;

function memStore() { const st = {}; return { getItem: k => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); }, removeItem: k => { delete st[k]; } }; }
function boot() {
  const beacons = [];
  const ls = memStore();
  function ErrorEvent(type, o) { this.type = type; this.message = o && o.message; this.filename = o && o.filename; }
  const win = { console: { log() {}, warn() {}, error() {}, info() {} }, localStorage: ls, sessionStorage: ls, location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/' },
    navigator: { userAgent: 'node' }, setTimeout, clearTimeout, AbortController, Promise, JSON, Date, Math, URL, URLSearchParams, ErrorEvent };
  win.self = win; win.window = win;
  win.dispatchEvent = function (ev) { beacons.push(ev); return true; };
  const ctx = vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'rjs/config.js'), 'utf8'), ctx, { filename: 'rjs/config.js' });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'rjs/chain.js'), 'utf8'), ctx, { filename: 'rjs/chain.js' });
  return { win, beacons, Chain: win.Chain.Chain };
}
function responder(map) {
  const calls = [];
  const f = url => { const u = String(url); calls.push(u); let spec = null; Object.keys(map).forEach(k => { if (u.indexOf(k) >= 0) spec = map[k]; });
    if (!spec || spec === 'down') return Promise.reject(new Error('down'));
    if (typeof spec === 'string') return Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, text: () => Promise.resolve(spec + '\n'), json: () => Promise.resolve({}) });
    return Promise.resolve({ ok: true, status: 200, headers: { get: () => null }, text: () => Promise.resolve(JSON.stringify(spec)), json: () => Promise.resolve(spec) });
  };
  return { f, calls };
}
function jsonHash(hex) { return { result: { block_hash: hex } }; }

(async () => {
  const { win, beacons, Chain } = boot();
  const chain = new Chain(responder({}).f);
  ok(Chain.powOk(GOOD) && Chain.powOk(OTHER) && !Chain.powOk(WEAK) && !Chain.powOk('zzzz'), 'proof-of-work check accepts 16 leading zero nibbles and rejects a random 64-hex body');

  /* Hostile explorer answers first with a hash that has no proof-of-work. Two honest sources agree. The hostile hash is not cached. */
  Chain._resetHashState();
  {
    const src = responder({ 'mempool.space': WEAK, 'node.xcpets.fun': jsonHash(GOOD), 'blockstream.info': GOOD, 'api.counterparty.io': jsonHash(GOOD) });
    const c = new Chain(src.f), cache = { [H]: WEAK };
    const h = await c.blockHash(H, cache);
    ok(h === GOOD && cache[H] === GOOD && cache[H] !== WEAK, 'a hostile weak hash is rejected; the agreed hash is cached');
    ok(Chain.hashNotes().some(m => /proof-of-work/.test(m)) && beacons.some(b => b && b.type === 'error' && /rjs\/chain\.js/.test(b.filename || '')), 'disagreement is logged through the page-error beacon');
    ok(src.calls.some(u => u.indexOf('mempool.space') >= 0) && src.calls.some(u => u.indexOf('node.xcpets.fun') >= 0 || u.indexOf('blockstream.info') >= 0), 'other sources are asked after the hostile answer');
  }

  /* Two explorers agree, so the rest are not asked. A single source is not enough to cache. */
  Chain._resetHashState(); beacons.length = 0;
  {
    const src = responder({ 'mempool.space': GOOD, 'node.xcpets.fun': jsonHash(GOOD), 'blockstream.info': OTHER });
    const c = new Chain(src.f), cache = {};
    const h = await c.blockHash(H, cache);
    ok(h === GOOD && cache[H] === GOOD, 'two independent sources agreeing is cached');
    ok(src.calls.length === 2 && src.calls.every(u => u.indexOf('blockstream.info') < 0), 'a third source is not asked once two agree (' + src.calls.length + ' requests)');
  }
  Chain._resetHashState();
  {
    const src = responder({ 'mempool.space': GOOD, 'node.xcpets.fun': 'down', 'blockstream.info': 'down', 'api.counterparty.io': 'down', 'api.unspendablelabs.com': 'down' });
    const c = new Chain(src.f), cache = {};
    const h = await c.blockHash(H, cache);
    ok(h == null && !cache[H], 'one source alone is not cached and not used');
  }

  /* boot.json / snapshot already has the hash: no request for a deep block. A shallow block asks one live source, not two. */
  Chain._resetHashState();
  {
    const boot = JSON.parse(fs.readFileSync(path.join(ROOT, 'api/boot.json'), 'utf8'));
    const tip = boot.tip, deep = [];
    Object.keys(boot.hashes).forEach(b => { if (+b <= tip - 6) deep.push(+b); });
    Chain.noteTrusted(boot.hashes);
    const src = responder({ 'mempool.space': WEAK, 'node.xcpets.fun': jsonHash(WEAK) });
    const c = new Chain(src.f), cache = {};
    const sample = deep.slice(0, 200);
    const t0 = process.hrtime.bigint();
    const got = await c.blockHashes(sample, cache, tip);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    const missed = sample.filter(b => got.hashes[b] !== boot.hashes[b]);
    ok(src.calls.length === 0 && missed.length === 0, 'boot.json hashes are used with no extra request (' + sample.length + ' blocks, ' + src.calls.length + ' requests, ' + ms.toFixed(1) + ' ms)');
    console.log('LOAD trusted-deep ' + sample.length + ' blocks: ' + src.calls.length + ' requests, ' + ms.toFixed(1) + ' ms');
    const shallow = tip;
    const one = responder({ 'mempool.space': boot.hashes[shallow] || GOOD });
    const c2 = new Chain(one.f);
    const hs = await c2.blockHash(shallow, null);
    ok(hs === (boot.hashes[shallow] || GOOD) && one.calls.length === 1, 'a trusted shallow hash is confirmed by one live source, not a second (' + one.calls.length + ' request)');
    console.log('LOAD trusted-shallow: ' + one.calls.length + ' request (same as before; no second source)');
  }

  /* Snapshot hashes are trusted the same way. */
  Chain._resetHashState();
  {
    win.Chain.noteTrusted({ [H]: GOOD });
    const src = responder({ 'mempool.space': WEAK });
    const c = new Chain(src.f), cache = { [H]: WEAK };
    const h = await c.blockHash(H, cache);
    ok(h === GOOD && cache[H] === GOOD && src.calls.length === 0, 'a world-snapshot hash replaces a poisoned cache entry with no request');
  }

  /* v2-chain applies the same rule: boot.json is noted, and the permanent cache drops a hash that is not durable. */
  const page = fs.readFileSync(path.join(ROOT, 'js/v2-chain.js'), 'utf8');
  ok(/E\.Chain\.noteTrusted\(j\.hashes\)/.test(page) && /E\.Chain\.durable\(k, hc\[k\]\)/.test(page), 'js/v2-chain.js trusts boot.json hashes and only saves durable ones');
  ok(/window\.Chain\.noteTrusted\(fin\)/.test(fs.readFileSync(path.join(ROOT, 'js/v2-boot-sync.js'), 'utf8')), 'the node.xcpets.fun snapshot hashes are marked trusted');
  ok(/blockHash\(b, null\)/.test(fs.readFileSync(path.join(ROOT, 'js/v2-sales.js'), 'utf8')), 'sale-book hash fills use the same blockHash rule');

  /* Verify worker: a part whose bytes do not match the manifest sha256 is refused, same error as the catch-up worker. */
  const workerSrc = fs.readFileSync(path.join(ROOT, 'js/v2-verify-worker.js'), 'utf8');
  const catchSrc = fs.readFileSync(path.join(ROOT, 'js/v2-catchup-worker.js'), 'utf8');
  ok(/if \(h !== f\.sha256\) throw new Error\('bad hash'\)/.test(workerSrc) && /if \(h !== f\.sha256\) throw new Error\('bad hash'\)/.test(catchSrc), 'verify worker uses the catch-up worker sha256 check');

  async function runWorker(files, bodies) {
    const posts = [];
    const body = bodies || { 'root.json': Buffer.from('not-json-tampered'), 'meta.json': Buffer.from('{"ok":1}') };
    const ctx = { console, TextEncoder, TextDecoder, crypto: crypto.webcrypto, setTimeout, clearTimeout, Promise, JSON, Math, Date, URL, Array, Uint8Array, Object, String };
    ctx.self = ctx; ctx.window = ctx; ctx.postMessage = m => posts.push(m); ctx.importScripts = function () {};
    ctx.fetch = url => { const u = String(url);
      if (u.endsWith('/xp/v1/world/latest.json')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ manifest: '/m.json', tip: 1, rsig: 'r' }) });
      if (u.endsWith('/xp/v1/sync')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ tip: 1, hashes: {}, rows: { list: [] } }) });
      if (u.endsWith('/m.json')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ checkpoint: { root: files.root, files: [], meta: files.meta } }) });
      const name = u.split('/').pop();
      const buf = body[name];
      if (!buf) return Promise.resolve({ ok: false, status: 404, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) });
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      return Promise.resolve({ ok: true, status: 200, arrayBuffer: () => Promise.resolve(ab) });
    };
    vm.createContext(ctx);
    vm.runInContext(workerSrc, ctx, { filename: 'js/v2-verify-worker.js' });
    ctx.onmessage({ data: { cmd: 'start', base: 'http://127.0.0.1', scripts: [] } });
    await new Promise(r => setTimeout(r, 80));
    return posts;
  }
  const badSha = '00'.repeat(32);
  const badPosts = await runWorker({ root: { url: 'root.json', sha256: badSha }, meta: { url: 'meta.json', sha256: badSha } });
  const badReady = badPosts.find(p => p.cmd === 'ready');
  ok(badReady && badReady.ok === false && /bad hash/.test(badReady.error || '') && !badPosts.some(p => p.cmd === 'ready' && p.ok), 'a part with a bad sha256 is rejected by the verify worker');

  const goodBody = Buffer.from('{"a":1}'), metaBody = Buffer.from('{"ok":1}');
  const goodSha = crypto.createHash('sha256').update(goodBody).digest('hex');
  const metaSha = crypto.createHash('sha256').update(metaBody).digest('hex');
  const goodPosts = await runWorker(
    { root: { url: 'root.json', sha256: goodSha }, meta: { url: 'meta.json', sha256: metaSha } },
    { 'root.json': goodBody, 'meta.json': metaBody });
  const goodReady = goodPosts.find(p => p.cmd === 'ready');
  ok(goodReady && goodReady.ok === false && goodReady.error === 'rules' && !/bad hash/.test(goodReady.error), 'a part whose sha256 matches is parsed and the check continues');

  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL crashed: ' + (e && e.stack || e)); process.exit(1); });
