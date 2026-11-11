#!/usr/bin/env node
/* Phase 1 of the one-shot sync design. No network except the public boot.json for the current-tip digest,
 * and mempool is not required. Replay SAME, rule MD5s, and the worker file are checked against origin/main. */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), crypto = require('crypto'), vm = require('vm'), cp = require('child_process'), os = require('os');
const ROOT = path.resolve(__dirname, '..');
const { bootSync, checkOf, PUBLIC } = require('./sync-server/client');
const { buildAnswer } = require('./sync-server/answer');
const { blank, tick, singleFlight } = require('./sync-server/follow');
const { timedFetch, clientIp } = require('./sync-server/net');
const { patchRules, wsDecode, STALE_MAX, staleOk } = require('../js/v2-resume');
const { createServer, worldFile } = require('./sync-server/server');
const { buildSnapshot, chainInSig } = require('./sync-server/snapshot');
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('ok  ', m); } else { fail++; console.log('FAIL', m); } }
function H(n) { return crypto.createHash('sha256').update('block-' + n).digest('hex'); }
function memStore() { const s = {}; return { getItem: k => (k in s ? s[k] : null), setItem: (k, v) => { s[k] = String(v); }, removeItem: k => { delete s[k]; } }; }
function loadPage(fetchImpl, extra) {
  const ctx = { window: {}, location: { search: '?sync=http://127.0.0.1:9', href: 'http://127.0.0.1/play.html', pathname: '/play.html' },
    localStorage: memStore(), sessionStorage: memStore(), navigator: { hardwareConcurrency: 8, connection: {} },
    document: { currentScript: { src: 'http://127.0.0.1/js/v2-boot-sync.js?v=abcdef' }, scripts: [] },
    URLSearchParams, URL, TextEncoder, TextDecoder, crypto: crypto.webcrypto, console, fetch: fetchImpl, setTimeout, clearTimeout, AbortController };
  Object.assign(ctx, extra || {}); ctx.window.window = ctx.window; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/v2-boot-sync.js'), 'utf8'), ctx, { filename: 'js/v2-boot-sync.js' });
  return ctx;
}
function gitBuf(f) { return cp.execFileSync('git', ['show', 'origin/main:' + f], { cwd: ROOT, maxBuffer: 64e6 }); }
function listen(server) { return new Promise(res => server.listen(0, '127.0.0.1', () => res(server.address().port))); }
const RULE7 = ['js/v2-rules.js', 'js/pet-core.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/real-core.js', 'rjs/burn-core.js', 'rjs/config.js'];
const RULE11 = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js'];
const CHAIN_PAGES = ['index.html', 'play.html', 'fight.html', 'breed.html', 'rare-room.html', 'raid.html', 'pet.html', 'shop.html', 'cemetery.html', 'ranking.html', 'hall-of-fame.html', 'pantheon.html', 'tokens.html', 'live.html', 'watch.html', 'archive.html', 'verify-pet.html', 'hybrids.html', 'inscriptions.html', 'templates/game.html'];
const PRACTICE = ['practice.html', 'practice-fight.html', 'practice-rare.html', 'practice-breed.html', 'practice-pet.html'];

function fixtureState() {
  const rows = [100, 99, 98, 90, 80].map((b, i) => ({ tx_hash: 't' + b, block_index: b, source: 'bc1q' + i, tag: 'pet:hatch', quantity: 6900000000, status: 'valid' }));
  const hashes = {}; rows.forEach(r => { hashes[r.block_index] = H(r.block_index); }); hashes[100] = H(100);
  const dex = { issuances: [{ tx_hash: 'i1', tx_index: 2, block_index: 90, asset: 'A1', source: 's', issuer: 's', quantity: 1, divisible: false, locked: true, description: 'd', status: 'valid' }],
    orders: [{ tx_hash: 'o1', tx_index: 3, block_index: 98, source: 's', give_asset: 'A1', give_quantity: 1, give_remaining: 1, get_asset: 'XCPETS', get_quantity: 5, get_remaining: 5, expiration: 10, expire_index: 200, status: 'open' }],
    matches: [], credits: [{ asset: 'A1', address: 's', utxo: null, utxo_address: null, quantity: 1, block_index: 90, tx_index: 2, calling_function: 'issuance', event: 'e1' }],
    destructions: [] };
  const state = blank();
  state.ready = true; state.tip = 100; state.tipHash = hashes[100]; state.coreHeight = 100; state.rows = rows; state.hashes = hashes; state.dex = dex; state.dexAssets = ['A1'];
  state.mempool = [{ tx_hash: 'mp1', source: 's', tag: 'pet:hatch', amount: 69, at: 1 }]; state.mempoolGen = 3; state.builtAt = '2026-11-10T22:45:07Z'; state.gates = { fire: null, quest: null, raid: null };
  state.ring = [{ tip: 90, tipHash: hashes[90] }, { tip: 98, tipHash: hashes[98] }, { tip: 100, tipHash: hashes[100] }];
  return state;
}

(async () => {
  const C = bootSync();
  ok(PUBLIC.join(' ') === 'https://api.counterparty.io:4000/v2 https://api.unspendablelabs.com:4000/v2', 'default upstreams are the two public Core nodes');
  const tree = fs.readdirSync(path.join(ROOT, 'tools/sync-server')).filter(f => f.endsWith('.js') || f.endsWith('.md')).map(f => fs.readFileSync(path.join(ROOT, 'tools/sync-server', f), 'utf8')).concat(['js/v2-boot-sync.js', 'js/v2-seed-worker.js', 'js/v2-catchup-worker.js', 'js/v2-resume.js', 'js/v2-chain.js', 'js/v2-sales.js'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8'))).join('\n');
  ok(!/\.onion\b|start9/i.test(tree), 'no onion or private proxy host in the new code');
  ok(!/method:\s*'POST'|method:\s*"POST"/.test(fs.readFileSync(path.join(ROOT, 'tools/sync-server/index.js'), 'utf8') + fs.readFileSync(path.join(ROOT, 'tools/sync-server/server.js'), 'utf8')), 'the sync service does not POST');

  const wallet = fs.readFileSync(path.join(ROOT, 'js/v2-wallet.js'), 'utf8');
  ok(/function composeNodes\(\)[\s\S]{0,400}node\\.xcpets\\.fun/.test(wallet), 'composeNodes still drops node.xcpets.fun');
  const cfg = fs.readFileSync(path.join(ROOT, 'rjs/config.js'), 'utf8');
  ok(/composeList: \[COUNTERPARTY_CORE, CORE_BACKUP\]/.test(cfg) && cfg === gitBuf('rjs/config.js').toString('utf8'), 'compose list unchanged and config.js is byte-identical');
  RULE7.forEach(f => { const a = crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, f))).digest('hex'), b = crypto.createHash('md5').update(gitBuf(f)).digest('hex'); ok(a === b, 'rule MD5 unchanged ' + f); });
  RULE11.forEach(f => ok(fs.readFileSync(path.join(ROOT, f)).equals(gitBuf(f)), 'replay script unchanged ' + f));
  ok(fs.readFileSync(path.join(ROOT, 'js/v2-replay-worker.js')).equals(gitBuf('js/v2-replay-worker.js')), 'worker bytes unchanged');
  const chainSrc = fs.readFileSync(path.join(ROOT, 'js/v2-chain.js'), 'utf8');
  const listed = chainSrc.match(/var RULE_SCRIPTS = \[([^\]]+)\]/);
  ok(listed && C.RULE_SCRIPTS.join(',') === listed[1].replace(/['"\s]/g, ''), 'recheck script list matches v2-chain.js');

  CHAIN_PAGES.forEach(f => { const h = fs.readFileSync(path.join(ROOT, f), 'utf8'); const a = h.indexOf('js/v2-boot-sync.js'), b = h.indexOf('js/v2-chain.js'); ok(a > 0 && a < b, 'boot-sync before chain on ' + f); });
  PRACTICE.forEach(f => { const cur = fs.readFileSync(path.join(ROOT, f)); ok(!cur.includes('v2-boot-sync.js') && cur.equals(gitBuf(f)), 'practice page unchanged ' + f); });

  const state = fixtureState();
  const full = buildAnswer(state, { since: '0' });
  ok(full.status === 200 && full.body.mode === 'full' && full.body.rows.list.length === 5 && full.body.rows.count === 5, 'full answer is the whole burn list');
  const merged = C.mergeSync({ rows: [], hashes: {}, dex: null }, full.body, { seed: {}, gates: state.gates, normalize: d => d });
  ok(merged.ok && JSON.stringify(merged.rows) === JSON.stringify(state.rows), 'full merge equals the multi-call rows');
  ok(JSON.stringify(merged.hashes) === JSON.stringify(C.hashSet({}, {}, full.body.hashes, merged.needed, true).hashes), 'full hash set is the needed blocks');
  ok(checkOf(merged.rows, merged.hashes, merged.dex) === full.body.check, 'full check matches the merged rows, hashes and dex');
  ok(C.checkText(state.rows, merged.hashes, state.dex) === C.checkText(merged.rows, merged.hashes, merged.dex), 'in-memory dex matches the answer');

  const delta = buildAnswer(state, { since: '98', sh: state.hashes[98].slice(0, 16), dt: '90' });
  ok(delta.body.mode === 'delta' && delta.body.rows.from === 92 && delta.body.rows.list.every(r => r.block_index >= 92), 'delta replaces from 6 blocks under since');
  const prev = { rows: [{ tx_hash: 'orphan', block_index: 99 }].concat(state.rows.filter(r => r.block_index < 92)), hashes: state.hashes, dex: state.dex };
  const md = C.mergeSync(prev, delta.body, { seed: {}, gates: state.gates, normalize: d => d });
  ok(md.ok && md.rows.length === state.rows.length && md.rows[0].tx_hash === 't100' && !md.rows.some(r => r.tx_hash === 'orphan'), 'delta drops the orphan and keeps the deep rows');
  ok(checkOf(md.rows, md.hashes, md.dex) === delta.body.check, 'delta check matches a correct merge');

  const reorg = buildAnswer(state, { since: '98', sh: '0'.repeat(16) });
  ok(reorg.body.mode === 'reorg' && reorg.body.rows.list.length === state.rows.length, 'a bad since-hash is a full reorg answer');
  const old = buildAnswer(state, { since: '10', sh: H(10).slice(0, 16) });
  ok(old.body.mode === 'full', 'a since outside the ring is a full answer');
  const junk = buildAnswer(state, { since: '98', sh: state.hashes[98].slice(0, 16), wallet: 'bc1qsecret', addr: 'nope' });
  ok(junk.body.since === 98 && !JSON.stringify(junk.body).includes('bc1qsecret'), 'unknown parameters are ignored and not echoed');

  /* follower reads the same fake node a multi-call would, including a staged reorg */
  const pages = { 1: { result: state.rows.slice(0, 3), next_cursor: 'c2', result_count: 5 }, 2: { result: state.rows.slice(3), next_cursor: null } };
  const calls = [];
  const getJson = async (p) => { calls.push(p); if (p === '/') return { result: { counterparty_height: 100 } };
    if (p.startsWith('/assets/XCPETS/destructions')) return p.includes('cursor=c2') ? pages[2] : pages[1];
    if (p.startsWith('/blocks/')) { const n = +p.split('/')[2]; return { result: { block_hash: H(n) } }; }
    if (p.startsWith('/mempool/')) return { result: [{ params: { asset: 'XCPETS', tag: '7065743a6861746368', status: 'valid', quantity: 6900000000, source: 's', tx_hash: 'mp1' }, timestamp: 0 }] }; throw new Error('unexpected ' + p); };
  const st = blank(); st.gates = state.gates;
  await tick(st, { getJson, hashOf: async n => H(n), mempool: async () => C.mempoolOf((await getJson('/mempool/events/ASSET_DESTRUCTION?limit=1000')).result, 'XCPETS'), mergeRows: (j, rows, tip) => null, seed: {}, normalize: d => d, loadDex: async () => state.dex, dexAssets: () => ['A1'] });
  ok(st.ready && st.rows.length === 5 && st.rows.map(r => r.block_index).join() === '100,99,98,90,80', 'follower burn list equals the paged multi-call');
  ok(st.hashes[100] === H(100) && st.hashes[80] === H(80), 'follower hashes equal the block reads');
  ok(st.dex.issuances.length === 1 && st.dexAssets[0] === 'A1', 'follower dex equals the sale read');
  ok(st.mempool[0] && st.mempool[0].tag === 'pet:hatch' && st.mempool[0].amount === 69, 'mempool shape matches readMempool');
  ok(!calls.some(u => /node\.xcpets\.fun/.test(u)), 'follower never calls node.xcpets.fun');
  const sigA = chainInSig(st.rows, C.hashSet({}, {}, st.hashes, C.neededBlocks(st.rows, st.tip, st.gates), true).hashes, st.tip, st.dex);
  const ans = buildAnswer(st, { since: '0' });
  const got = C.mergeSync({}, ans.body, { seed: {}, gates: st.gates, normalize: d => d });
  const sigB = chainInSig(got.rows, got.hashes, got.tip, got.dex);
  ok(sigA === sigB && ans.body.check === checkOf(got.rows, got.hashes, got.dex), 'sync inSig equals the multi-call inSig (' + sigA + ')');

  /* fallbacks */
  const api = () => ({ state: () => ({ tip: 100, rows: state.rows, hashes: state.hashes, dex: state.dex, ops: [] }), seed: () => ({}), gates: () => state.gates, hashCache: () => ({}), saveHashCache() {}, finalHashes: (h, tip) => { const o = {}; Object.keys(h).forEach(k => { if (+k <= tip - 6) o[k] = h[k]; }); return o; }, shallowDrop() { return []; }, reorgAt() { return null; }, dropShallow() { api.dropped = true; }, finish() { api.finished = true; }, step() {}, chainTip: () => Promise.resolve(105), balanceRead: () => Promise.resolve(), normalize: d => d });
  let fallbacks = 0;
  const slow = loadPage((u, o) => new Promise((res, rej) => { const t = setTimeout(() => res({ ok: true, json: () => Promise.resolve(ans.body) }), 4000); if (o && o.signal) o.signal.addEventListener('abort', () => { clearTimeout(t); rej(Object.assign(new Error('abort'), { name: 'AbortError' })); }); }));
  await slow.window.V2BootSync.tryLoad(() => { fallbacks++; return Promise.resolve('fell'); }, api());
  ok(fallbacks === 1 && !api.finished, 'a slow sync falls back and does not mark the read verified');
  const down = loadPage(() => Promise.reject(new Error('down')));
  fallbacks = 0; await down.window.V2BootSync.tryLoad(() => { fallbacks++; return Promise.resolve(); }, api());
  ok(fallbacks === 1, 'sync down falls back');
  const lagBody = Object.assign({}, ans.body, { lag: 3, tip: 100 });
  const lag = loadPage(() => Promise.resolve({ ok: true, json: () => Promise.resolve(lagBody) }));
  fallbacks = 0; await lag.window.V2BootSync.tryLoad(() => { fallbacks++; return Promise.resolve(); }, api());
  ok(fallbacks === 1, 'lag of 2 or more with a newer public tip falls back');
  const bad = Object.assign({}, ans.body, { check: '00' });
  const badC = loadPage(() => Promise.resolve({ ok: true, json: () => Promise.resolve(bad) }));
  fallbacks = 0; api.finished = false; await badC.window.V2BootSync.tryLoad(() => { fallbacks++; return Promise.resolve(); }, api());
  ok(fallbacks === 1 && !api.finished, 'a bad check falls back');
  const again = loadPage(() => Promise.reject(new Error('down')));
  await again.window.V2BootSync.tryLoad(() => Promise.resolve(), api());
  await again.window.V2BootSync.tryLoad(() => Promise.resolve(), api());
  ok(again.window.V2BootSync.enabled() === false, 'two failures skip sync for this tab');
  const saver = loadPage(() => Promise.reject(new Error('no')), { navigator: { hardwareConcurrency: 8, connection: { saveData: true, effectiveType: '4g' } } });
  ok(saver.window.V2BootSync.saveData() === true, 'data saver is detected');
  const g2 = loadPage(() => Promise.reject(new Error('no')), { navigator: { connection: { effectiveType: '2g' } } });
  ok(g2.window.V2BootSync.saveData() === true, '2g skips the snapshot');
  saver.window.V2BootSync.arm({ peekWorld: () => Promise.reject(new Error('should not peek')) });
  ok(saver.window.V2BootSync.ready == null, 'data saver does not arm a snapshot');
  const verify = loadPage(() => Promise.reject(new Error('no'))); verify.location.pathname = '/verify-pet.html';
  ok(verify.window.V2BootSync.localOnly() === true, 'verify-pet stays a local rebuild');
  const site = loadPage(() => Promise.reject(new Error('no')));
  site.location.hostname = 'xcpets.fun'; site.location.search = ''; site.location.href = 'https://xcpets.fun/play.html';
  ok(site.window.V2BootSync.base() === 'https://node.xcpets.fun' && site.window.V2BootSync.enabled() === true, 'xcpets.fun defaults to https://node.xcpets.fun');
  const www = loadPage(() => Promise.reject(new Error('no')));
  www.location.hostname = 'www.xcpets.fun'; www.location.search = '';
  ok(www.window.V2BootSync.base() === 'https://node.xcpets.fun', 'www.xcpets.fun uses the same default');
  const other = loadPage(() => Promise.reject(new Error('no')));
  other.location.hostname = '127.0.0.1'; other.location.search = '';
  ok(other.window.V2BootSync.base() === '' && other.window.V2BootSync.enabled() === false, 'other origins do not default the sync URL');
  const off = loadPage(() => Promise.reject(new Error('no')));
  off.location.hostname = 'xcpets.fun'; off.location.search = '?sync=0';
  ok(off.window.V2BootSync.base() === '' && off.window.V2BootSync.enabled() === false, '?sync=0 turns the live default off');
  const off2 = loadPage(() => Promise.reject(new Error('no')));
  off2.location.hostname = 'xcpets.fun'; off2.location.search = '?sync=off';
  ok(off2.window.V2BootSync.base() === '', '?sync=off turns the live default off');
  const flag = loadPage(() => Promise.reject(new Error('no')));
  flag.location.hostname = 'xcpets.fun'; flag.location.search = '';
  flag.localStorage.setItem('xcpets-sync', 'http://127.0.0.1:9');
  ok(flag.window.V2BootSync.base() === 'http://127.0.0.1:9', 'localStorage xcpets-sync overrides the live default');
  ok(!/\bsync\s*:/.test(fs.readFileSync(path.join(ROOT, 'rjs/config.js'), 'utf8')), 'rjs/config.js still has no sync field');
  ok(staleOk(2) && staleOk(STALE_MAX) && !staleOk(0) && !staleOk(STALE_MAX + 1), 'stale catch-up allows 1..' + STALE_MAX + ' blocks and no more');

  let flights = 0; const gate = singleFlight(() => { flights++; return new Promise(r => setTimeout(r, 30)); });
  const first = gate(), second = gate();
  ok(first === second, 'a follow that is still running is not started again');
  await first; ok(flights === 1, 'the overlapped call did not run a second follow');
  const third = gate(); await third; ok(flights === 2, 'the next follow starts after the previous one finishes');

  const hang = http.createServer(() => {}); await new Promise(r => hang.listen(0, '127.0.0.1', r));
  let aborted = false; try { await timedFetch('http://127.0.0.1:' + hang.address().port + '/stuck', {}, 200); } catch (e) { aborted = true; }
  hang.close(); ok(aborted, 'a stuck upstream fetch times out');

  const lim = createServer({ getState: () => ({ tip: 1, coreHeight: 1, lag: 0, ready: true, upstream: 'public', world: { tip: 1 } }), dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'xp-ip-')), ratePer10s: 1 });
  const ipPort = await listen(lim.server);
  const hit = (ip, path) => new Promise((res, rej) => { const q = http.request({ hostname: '127.0.0.1', port: ipPort, path: path, headers: ip ? { 'x-real-ip': ip } : {} }, r => { res(r.statusCode); r.resume(); }); q.on('error', rej); q.end(); });
  const a = await hit('203.0.113.5', '/xp/v1/health'), b = await hit('203.0.113.9', '/xp/v1/health'), c = await hit('203.0.113.5', '/xp/v1/health');
  const worldStatus = await hit('203.0.113.5', '/xp/v1/world/r' + 'ab'.repeat(16) + '/1/part-000.json');
  ok(a === 200 && b === 200 && c === 429, 'X-Real-IP is the rate-limit address');
  ok(worldStatus === 404, 'a snapshot part is not counted against the rate limit');
  ok(clientIp({ headers: { 'x-real-ip': '198.51.100.4, 10.0.0.1' }, socket: { remoteAddress: '127.0.0.1' } }) === '198.51.100.4', 'loopback trusts X-Real-IP');
  ok(clientIp({ headers: { 'x-forwarded-for': '198.51.100.8, 10.1.1.1' }, socket: { remoteAddress: '127.0.0.1' } }) === '198.51.100.8', 'loopback trusts X-Forwarded-For when X-Real-IP is absent');
  ok(clientIp({ headers: { 'x-real-ip': '198.51.100.4' }, socket: { remoteAddress: '203.0.113.1' } }) === '203.0.113.1', 'a public socket does not trust a spoofed X-Real-IP');
  lim.server.close();

  const sig = 'r' + 'ab'.repeat(16), cpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xp-cp-'));
  const cpRoot = path.join(cpDir, 'world', sig, '9');
  fs.mkdirSync(cpRoot, { recursive: true });
  for (const name of ['cp-root.json', 'cp-meta.json', 'cp-part-000.json', 'root.json', 'part-000.json', 'manifest.json']) fs.writeFileSync(path.join(cpRoot, name), '{"ok":"' + name + '"}');
  fs.writeFileSync(path.join(cpRoot, 'cp-root.json.br'), Buffer.from('not-br'));
  const allowNames = ['cp-root.json', 'cp-meta.json', 'cp-part-000.json', 'cp-part-063.json', 'root.json', 'part-000.json', 'manifest.json'];
  const denyNames = ['cp-other.json', 'cp-root.json.txt', 'cp-part-00.json', 'cp-part-0000.json', 'cp-part.json', '../cp-root.json', '..', 'secret.json', 'cp-meta.json/../../etc'];
  ok(allowNames.every(n => worldFile(cpDir, [sig, '9', n]) === path.join(cpRoot, n)), 'checkpoint names are on the snapshot allowlist');
  ok(denyNames.every(n => worldFile(cpDir, [sig, '9', n]) == null) && worldFile(cpDir, [sig, '9', 'cp-root.json', 'extra']) == null && worldFile(cpDir, ['../' + sig, '9', 'cp-root.json']) == null, 'other snapshot names and path escapes are rejected');
  const cpSrv = createServer({ getState: () => ({ tip: 9, ready: true, upstream: 'public' }), dataDir: cpDir });
  const cpPort = await listen(cpSrv.server);
  const ask = (method, urlPath) => new Promise((res, rej) => { const q = http.request({ hostname: '127.0.0.1', port: cpPort, path: urlPath, method: method }, r => { const chunks = []; r.on('data', c => chunks.push(c)); r.on('end', () => res({ status: r.statusCode, cors: r.headers['access-control-allow-origin'], cache: r.headers['cache-control'], body: Buffer.concat(chunks).toString() })); }); q.on('error', rej); q.end(); });
  const cpBase = '/xp/v1/world/' + sig + '/9/';
  const gotRoot = await ask('GET', cpBase + 'cp-root.json'), gotMeta = await ask('GET', cpBase + 'cp-meta.json'), gotPart = await ask('GET', cpBase + 'cp-part-000.json');
  const headPart = await ask('HEAD', cpBase + 'cp-part-000.json'), postRoot = await ask('POST', cpBase + 'cp-root.json');
  const otherName = await ask('GET', cpBase + 'cp-other.json'), extraSeg = await ask('GET', cpBase + 'cp-root.json/extra'), encodedDot = await ask('GET', cpBase + '..%2F..%2Fcp-root.json');
  ok(gotRoot.status === 200 && gotMeta.status === 200 && gotPart.status === 200 && gotRoot.body.includes('cp-root.json') && gotMeta.body.includes('cp-meta.json') && gotPart.body.includes('cp-part-000.json'), 'GET serves cp-root, cp-meta, and cp-part-NNN');
  ok(headPart.status === 200 && headPart.body === '' && headPart.cors === '*' && /immutable/.test(gotPart.cache) && gotPart.cors === '*', 'HEAD and CORS and immutable caching match the other snapshot files');
  ok(postRoot.status === 405 && otherName.status === 404 && extraSeg.status === 404 && encodedDot.status === 404, 'checkpoint routes stay GET/HEAD and reject other names');
  cpSrv.server.close();

  /* A snapshot two blocks behind, plus the burns in that gap, matches a full replay at the later tip. */
  {
    const snap = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/snapshots/snap-972901.json'), 'utf8'));
    const T = snap.tip, baseTip = T - 2;
    const rowsAll = snap.rows.filter(r => r.block_index <= T), rowsBase = rowsAll.filter(r => r.block_index <= baseTip);
    ok(rowsAll.length - rowsBase.length >= 1, 'the catch-up fixture has burns in the two-block gap');
    const SCRIPTS = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js', 'js/v2-replay-worker.js'];
    function boot(patch) {
      const win = { console: { log() {}, warn() {}, error() {}, info() {} }, localStorage: memStore(), sessionStorage: memStore(), location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/' }, navigator: { userAgent: 'node' }, setTimeout, clearTimeout, URLSearchParams, URL, TextEncoder, TextDecoder, addEventListener() {} };
      win.document = { getElementById() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; }, createElement() { return { style: {} }; }, addEventListener() {}, body: null, documentElement: { style: {} } };
      win.window = win; win.self = win; const ctx = vm.createContext(win);
      for (const f of SCRIPTS) { let src = fs.readFileSync(path.join(ROOT, f), 'utf8'); if (patch && f === 'js/v2-rules.js') src = patchRules(src); if (f === 'rjs/chain.js') vm.runInContext('window.LiveEngine={RealCore:window.RealCore,Chain:window.Chain&&window.Chain.Chain,CFG:window.XCPETS_CONFIG};', ctx); vm.runInContext(src, ctx, { filename: f }); }
      return ctx;
    }
    const plain = boot(false), patched = boot(true);
    const full = plain.V2Rules.replay(rowsAll, snap.hashes, [], { tip: T, live: plain.LiveEngine.RealCore });
    let saved = null;
    patched.V2Rules.replay(rowsBase, snap.hashes, [], { tip: baseTip, live: patched.LiveEngine.RealCore, _beforeTail(w, seen) {
      const enc = patched.wsEncode(w);
      saved = { w: wsDecode(enc.root, enc.parts), seen: Object.assign({}, seen), dexPos: w._dexPos || 0, grand: w._grand ? 1 : 0, tip: baseTip };
    } });
    const resumed = patched.V2Rules.replay(rowsAll, snap.hashes, [], { tip: T, live: patched.LiveEngine.RealCore, _resume: saved });
    const encFull = plain.wsEncode(full), encResume = patched.wsEncode(resumed);
    const [dFull, dResume] = await Promise.all([bootSync().digestOf(encFull.root, encFull.parts), bootSync().digestOf(encResume.root, encResume.parts)]);
    const keyFull = chainInSig(rowsAll, snap.hashes, T, null), keyBase = chainInSig(rowsBase, snap.hashes, baseTip, null);
    ok(dFull === dResume && keyFull !== keyBase, 'snapshot at tip T-2 plus catch-up matches a full replay at tip T');
    ok(resumed.pets.length === full.pets.length && resumed.tip === T, 'the caught-up world is the current tip');
  }

  /* bad part hash writes nothing */
  const good = Buffer.from('{"a":1}'); const goodSha = crypto.createHash('sha256').update(good).digest('hex');
  let puts = 0; const posts = [];
  const wctx = { crypto: crypto.webcrypto, TextEncoder, TextDecoder, console, fetch: async (u) => ({ ok: true, arrayBuffer: async () => (String(u).includes('bad') ? Buffer.from('{"a":2}') : good) }),
    indexedDB: { open() { const req = {}; setTimeout(() => { req.result = { transaction() { return { objectStore() { return { clear() {}, put() { puts++; } }; } }; }, close() {} }; if (req.onsuccess) req.onsuccess(); }, 0); return req; } } };
  wctx.self = wctx; wctx.postMessage = m => posts.push(m); vm.createContext(wctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/v2-seed-worker.js'), 'utf8'), wctx, { filename: 'js/v2-seed-worker.js' });
  wctx.onmessage({ data: { cmd: 'seed', id: 7, idbKey: 'k', parts: 0, n: 0, files: [{ url: 'http://127.0.0.1/bad.json', sha256: goodSha, role: 'root' }] } });
  await new Promise(r => setTimeout(r, 50));
  ok(posts.some(p => p.ok === false && /bad hash/.test(p.error)) && puts === 0, 'a bad part hash is refused and IndexedDB is not written');

  /* POST is refused; health stays free of addresses */
  const live = blank(); live.ready = true; live.tip = 5; live.coreHeight = 7; live.lag = 2; live.upstream = 'public'; live.lastBlockAt = 't';
  const srv = createServer({ getState: () => live, dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'xp-')) });
  const port = await listen(srv.server);
  const base = 'http://127.0.0.1:' + port;
  const post = await fetch(base + '/xp/v1/sync', { method: 'POST', body: '{}' });
  ok(post.status === 405, 'POST /xp/v1/sync is 405');
  const del = await fetch(base + '/xp/v1/world/latest.json', { method: 'DELETE' });
  ok(del.status === 405, 'DELETE is 405');
  const opt = await fetch(base + '/xp/v1/sync', { method: 'OPTIONS' });
  ok(opt.status === 204 && opt.headers.get('access-control-allow-origin') === '*' && /GET/.test(opt.headers.get('access-control-allow-methods') || ''), 'CORS preflight is GET/HEAD/OPTIONS only');
  const health = await (await fetch(base + '/xp/v1/health')).json();
  ok(health.tip === 5 && health.lag === 2 && health.upstream === 'public' && !JSON.stringify(health).includes('http'), 'health has lag and no address');
  srv.server.close();

  require('./lib/fixtures').ensure();
  for (const snap of ['snap-971786.json', 'snap-972883.json', 'snap-972901.json']) {
    const out = cp.execFileSync(process.execPath, [path.join(ROOT, 'tools/replay-check.js'), '--compare', 'origin/main', '--snap', path.join(ROOT, 'tools/snapshots', snap)], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64e6 });
    ok(out.split('\n').some(l => l.trim() === 'SAME'), 'replay SAME ' + snap);
  }

  if (!process.env.XP_SKIP_DIGEST) await digests();
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });

async function digests() {
  const { chromium } = require('playwright-core');
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  const server = http.createServer((q, res) => {
    const u = decodeURIComponent(q.url.split('?')[0]);
    if (u === '/_harness.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><title>h</title>'); return; }
    const rel = u.replace(/^\/+/, '');
    const p = path.normalize(path.join(ROOT, rel));
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
    const types = { '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json' };
    res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
  });
  const port = await listen(server);
  const origin = 'http://127.0.0.1:' + port;
  await page.goto(origin + '/_harness.html');
  const scripts = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js'];
  async function chromeDigest(rows, hashes, tip, dex) {
    await page.evaluate(() => new Promise(res => { const r = indexedDB.deleteDatabase('xcpets-world'); r.onsuccess = r.onerror = r.onblocked = () => res(); }));
    return page.evaluate(async ({ origin, scripts, rows, hashes, tip, dex }) => {
      const w = new Worker(origin + '/js/v2-replay-worker.js');
      await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('worker timeout')), 180000);
        w.onmessage = ev => { const m = ev.data || {}; if (m.ok && m.idb) { clearTimeout(t); res(); } else if (m.ok === false) { clearTimeout(t); rej(new Error(m.error || 'worker')); } };
        w.onerror = () => { clearTimeout(t); rej(new Error('worker error')); };
        w.postMessage({ id: 1, scripts: scripts.map(f => origin + '/' + f), rows, hashes, ops: [], tip, dex: dex || undefined, idbKey: 'digest|' + tip }); });
      w.terminate();
      const sw = new Worker(origin + '/js/v2-seed-worker.js');
      const digest = await new Promise((res, rej) => { sw.onmessage = ev => { const m = ev.data || {}; if (m.ok && m.digest) res(m.digest); else rej(new Error(m.error || 'digest')); }; sw.onerror = () => rej(new Error('digest worker')); sw.postMessage({ cmd: 'digest', id: 2 }); });
      sw.terminate(); return digest;
    }, { origin, scripts, rows, hashes, tip, dex: dex || null });
  }
  async function one(label, rows, hashes, tip, dex) {
    const built = await buildSnapshot({ rows, hashes, tip, dex, compress: false, inSigOf: o => chainInSig(o.rows, o.hashes, o.tip, o.dex) });
    const live = await chromeDigest(rows, hashes, tip, dex);
    ok(built.manifest.digest === live, label + ' snapshot digest matches the replay worker');
    if (built.manifest.digest !== live) console.log('  node', built.manifest.digest, 'chrome', live);
  }
  try {
    await one('empty world', [], {}, 1, null);
    require('./lib/fixtures').ensure();
    for (const name of ['snap-971786.json', 'snap-972883.json', 'snap-972901.json']) {
      const snap = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/snapshots', name), 'utf8'));
      await one(name, snap.rows, snap.hashes, snap.tip, null);
    }
    let boot = null; try { boot = JSON.parse(fs.readFileSync('/tmp/boot.json', 'utf8')); } catch (e) {
      try { const r = await fetch('https://xcpets.fun/api/boot.json'); if (r.ok) boot = await r.json(); } catch (e2) {} }
    if (!boot || !boot.tip) ok(false, 'current tip boot.json unavailable');
    else {
      const seedCtx = { window: {} }; vm.createContext(seedCtx); vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/block-hashes.js'), 'utf8'), seedCtx);
      const hashes = Object.assign({}, seedCtx.window.XCPETS_BLOCK_HASHES || {}, boot.hashes || {});
      await one('current tip ' + boot.tip, boot.rows, hashes, boot.tip, boot.dex || null);
    }
  } finally { await browser.close(); server.close(); }
}
