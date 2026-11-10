#!/usr/bin/env node
'use strict';
/* xcpets-sync, review only. Nothing here is installed on a live server.
 *   node tools/sync-server/index.js
 *   XP_UPSTREAMS   comma-separated Core /v2 bases. Default: the two public Core nodes.
 *                  A loopback read proxy may be listed first. Its address stays in the environment.
 *   XP_PORT        listen port (default 8787)
 *   XP_DATA        snapshots and state (default a temp directory)
 *   XP_BOOT_CACHE  optional boot.json used as the hash and sale base, the same way the feed does
 *   XP_SNAPSHOT=0  do not build a pet-world snapshot
 *   XP_RULES_BASE  optional http(s) prefix for rule-file bytes. Default: this repo. */
const fs = require('fs'), path = require('path'), http = require('http'), { spawn } = require('child_process'), os = require('os');
const { upstreams, hostKind, scrub, bootSync, PUBLIC, ROOT } = require('./client');
const { blank, tick } = require('./follow');
const { createServer } = require('./server');
const LIM = require('../lib/core-limiter');
function chainFns() {
  const vm = require('vm');
  const ctx = { window: { V2Rules: { replay() { return { pets: [] }; } }, LiveEngine: { RealCore: {}, CFG: { isMainnet: true, asset: 'XCPETS', mempoolApi: 'https://mempool.space/api' } }, addEventListener() {} },
    document: { getElementById() { return null; }, currentScript: null, hidden: true, addEventListener() {}, querySelector() { return null; }, createElement() { return {}; }, scripts: [] },
    location: { search: '' }, localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }, sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    setInterval() { return 0; }, setTimeout() { return 0; }, clearTimeout() {}, URLSearchParams: global.URLSearchParams, console };
  ctx.window.window = ctx.window; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/v2-chain.js'), 'utf8'), ctx, { filename: 'js/v2-chain.js' });
  return ctx.window.V2Mock;
}
function seedHashes() {
  const vm = require('vm'); const ctx = { window: {} }; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/block-hashes.js'), 'utf8'), ctx);
  return ctx.window.XCPETS_BLOCK_HASHES || {};
}
function makeIo(bases) {
  const raw = (u, o) => fetch(u, o);
  const limited = LIM.makeFetch(raw, { conc: +(process.env.XP_CONC || 1), rps: +(process.env.XP_RPS || 2), match: u => bases.some(b => String(u).indexOf(b) === 0) });
  let lastKind = hostKind(bases[0]);
  async function getJson(pathname) { let last = 'failed';
    for (const base of bases) { try { const r = await limited(base + pathname); if (r.status === 404) return { result: [] };
      if (!r.ok) { last = String(r.status); continue; } lastKind = hostKind(base); return await r.json(); } catch (e) { last = 'down'; } }
    throw new Error('upstream ' + last); }
  async function hashOf(n) {
    try { const r = await fetch('https://mempool.space/api/block-height/' + n); const t = (await r.text()).trim(); if (/^[0-9a-f]{64}$/.test(t)) return t; } catch (e) {}
    const j = await getJson('/blocks/' + n); const h = j && j.result && j.result.block_hash; if (!/^[0-9a-f]{64}$/.test(h || '')) throw new Error('missing hash'); return h;
  }
  async function mempool() { const j = await getJson('/mempool/events/ASSET_DESTRUCTION?limit=1000'); return bootSync().mempoolOf((j && j.result) || [], 'XCPETS'); }
  async function mempoolHeight() { const r = await fetch('https://mempool.space/api/blocks/tip/height'); const t = await r.text(); const n = parseInt(t, 10); return n > 0 ? n : 0; }
  return { getJson, hashOf, mempool, mempoolHeight, upstreamOf: () => lastKind };
}
function salesIo(bases, boot) {
  const vm = require('vm');
  const { getJson, hashOf, mempool, mempoolHeight, upstreamOf } = makeIo(bases);
  const limitedFetch = (u, o) => fetch(u, o);
  const wrapped = LIM.makeFetch(limitedFetch, { conc: 1, rps: +(process.env.XP_RPS || 2), match: () => true });
  const store = {}; const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const win = { console, localStorage: ls, sessionStorage: ls, location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/' }, navigator: { userAgent: 'xcpets-sync' },
    setTimeout, clearTimeout, URLSearchParams: global.URLSearchParams, URL: global.URL, TextEncoder, TextDecoder, AbortController: global.AbortController, fetch: wrapped,
    addEventListener() {}, dispatchEvent() { return true; }, CustomEvent: function CustomEvent(type, o) { this.type = type; this.detail = o && o.detail; }, XCPETS_PATIENT: 1, XCPETS_TOUCH_MAX: 400, XCPETS_MINT_SCAN: 1, XCPETS_DEX_MS: 15 * 60 * 1000 };
  win.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {}, body: null, documentElement: { style: {} } };
  win.window = win; win.self = win; win.globalThis = win;
  const ctx = vm.createContext(win);
  const scripts = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js', 'js/block-hashes.js', 'js/v2-sales.js'];
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'rjs/config.js'), 'utf8'), ctx, { filename: 'rjs/config.js' });
  ctx.XCPETS_CONFIG.read = bases.slice(); ctx.XCPETS_CONFIG.composeList = bases.slice(); ctx.XCPETS_CONFIG.compose = bases[bases.length - 1];
  for (const f of scripts) { if (f === 'rjs/config.js') continue; vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
  vm.runInContext('window.LiveEngine={RealCore:window.RealCore,Chain:window.Chain&&window.Chain.Chain,CFG:window.XCPETS_CONFIG};', ctx);
  const V = ctx.V2Rules, gates = { fire: V.ACTIVATE_FIRESALE_BLOCK != null ? V.ACTIVATE_FIRESALE_BLOCK : null, quest: V.questGate ? V.questGate() : null, raid: V.raidGate ? V.raidGate() : null };
  if (boot && boot.dex && boot.dexTip && boot.dexHash && ctx.V2Sales && ctx.V2Sales.setBase) ctx.V2Sales.setBase(boot);
  const chain = chainFns();
  return { getJson, hashOf, mempool, mempoolHeight, gates, seed: ctx.XCPETS_BLOCK_HASHES || seedHashes(), mergeRows: (j, rows, tip) => chain.mergeRows(j, rows, tip),
    normalize: d => ctx.V2Sales && ctx.V2Sales.normalizeDex ? ctx.V2Sales.normalizeDex(d) : d,
    loadDex: async (rows, cx) => { if (!V.salesGate || V.salesGate() == null) return null; if (!ctx.V2Sales) throw new Error('sales');
      const d = await ctx.V2Sales.loadDex(rows, { tip: cx.tip, hashes: cx.hashes });
      if (ctx.V2Sales.loadDex.lastAssets) salesIo.assets = ctx.V2Sales.loadDex.lastAssets.slice();
      return d; },
    dexAssets: () => salesIo.assets || [], upstreamOf };
}
function readBoot(file) { try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); return j && j.tip ? j : null; } catch (e) { return null; } }
function readLatest(dataDir) { try { return JSON.parse(fs.readFileSync(path.join(dataDir, 'world', 'latest.json'), 'utf8')); } catch (e) { return null; } }
function startSnapshot(state, dataDir) {
  if (startSnapshot.running) return; startSnapshot.running = true;
  const st = path.join(dataDir, 'state.json');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(st, JSON.stringify({ rows: state.rows, hashes: state.hashes, tip: state.tip, dex: state.dex }));
  const out = path.join(dataDir, 'world', 'pending-' + state.tip);
  const args = [path.join(__dirname, 'snapshot.js'), '--state', st, '--out', out];
  const cmd = process.platform === 'win32' ? null : 'nice';
  const child = cmd ? spawn(cmd, ['-n', '10', process.execPath, ...args], { stdio: ['ignore', 'pipe', 'pipe'] }) : spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let buf = ''; child.stdout.on('data', d => { buf += d; });
  child.on('exit', code => { startSnapshot.running = false; if (code !== 0) return;
    let info; try { info = JSON.parse(buf.trim().split('\n').pop()); } catch (e) { return; }
    const dest = path.join(dataDir, 'world', info.rsig, String(info.tip));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.rmSync(dest, { recursive: true, force: true }); fs.renameSync(out, dest);
    const latest = { v: 1, rsig: info.rsig, tip: info.tip, manifest: '/xp/v1/world/' + info.rsig + '/' + info.tip + '/manifest.json', builtAt: new Date().toISOString() };
    fs.writeFileSync(path.join(dataDir, 'world', 'latest.json'), JSON.stringify(latest));
    state.world = { ready: true, rsig: info.rsig, tip: info.tip, manifest: latest.manifest }; });
  child.on('error', () => { startSnapshot.running = false; if (cmd) { startSnapshot.running = true; const c2 = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'] }); c2.stdout.on('data', d => { buf += d; }); c2.on('exit', () => { startSnapshot.running = false; }); } });
}
function main() {
  const bases = upstreams(); const dataDir = process.env.XP_DATA || path.join(os.tmpdir(), 'xcpets-sync');
  const boot = process.env.XP_BOOT_CACHE ? readBoot(process.env.XP_BOOT_CACHE) : null;
  const state = blank(); if (boot && boot.hashes) Object.keys(boot.hashes).forEach(k => { if (+k <= boot.tip - 6) state.hashes[k] = boot.hashes[k]; });
  if (boot && boot.rows && boot.tip) { state.rows = boot.rows; state.tip = boot.tip; state.dex = boot.dex || null; state.dexTip = boot.dexTip || 0; state.dexHash = boot.dexHash || ''; state.dexAssets = boot.dexAssets || []; }
  const io0 = salesIo(bases, boot); state.gates = io0.gates;
  const io = Object.assign({}, io0, { upstream: 'public', seed: io0.seed });
  const httpd = createServer({ getState: () => state, dataDir: dataDir });
  const port = +(process.env.XP_PORT || 8787);
  httpd.server.listen(port, '127.0.0.1');
  let timer = null;
  async function loop() { try { io.upstream = io0.upstreamOf(); await tick(state, io); state.upstream = io.upstream === 'private' ? 'private' : 'public';
    const latest = readLatest(dataDir); if (latest && latest.tip) state.world = { ready: true, rsig: latest.rsig, tip: latest.tip, manifest: latest.manifest };
    if (process.env.XP_SNAPSHOT !== '0' && state.ready && state.lag < 2 && (!state.world || state.world.tip !== state.tip)) startSnapshot(state, dataDir);
  } catch (e) { console.error('sync tick failed'); } }
  loop(); timer = setInterval(loop, 10000);
  console.log('xcpets-sync on 127.0.0.1:' + port + ' upstreams ' + bases.map(hostKind).join(','));
  return { server: httpd.server, state, stop() { clearInterval(timer); httpd.server.close(); } };
}
if (require.main === module) main();
module.exports = { main, chainFns, seedHashes, PUBLIC };
