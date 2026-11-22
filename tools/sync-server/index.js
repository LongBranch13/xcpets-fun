#!/usr/bin/env node
'use strict';
/* xcpets-sync. Listens on loopback; Caddy publishes it.
 *   node tools/sync-server/index.js
 *   XP_UPSTREAMS   comma-separated Core /v2 bases. Default: the two public Core nodes.
 *                  A loopback read proxy may be listed first. Its address stays in the environment.
 *   XP_PORT        listen port (default 8787)
 *   XP_DATA        snapshots and state (default a temp directory)
 *   XP_BOOT_CACHE  optional boot.json used as the hash and sale base, the same way the feed does
 *   XP_SNAPSHOT=0  do not build a pet-world snapshot
 *   XP_SNAPSHOT_EVERY  build when the published snapshot is at least this many blocks behind (default 6)
 *   XP_SNAPSHOT_HEAP   Node heap cap in MB for the builder (default 1536)
 *   XP_SNAPSHOT_MAX_MIN  stop a build that runs longer than this many minutes (default 30) so one hung build can't stop every later one
 *   XP_FETCH_MS    per-request upstream timeout in ms (default 15000)
 *   XP_RULES_BASE  optional http(s) prefix for rule-file bytes. Default: this repo.
 *   XP_RULES_FOLLOW=0  do not follow main (see rules-follow.js). By default the world builder runs from a copy of main's
 *                  files that this service downloads itself, so a rules change on main reaches the server without anyone logging in.
 *   XP_RULES_EVERY_S   how often to ask GitHub whether main moved (default 180) */
const fs = require('fs'), path = require('path'), http = require('http'), { spawn } = require('child_process'), os = require('os');
const { upstreams, hostKind, scrub, bootSync, PUBLIC, ROOT } = require('./client');
const { blank, tick, singleFlight } = require('./follow');
const { createServer } = require('./server');
const { pageInputs } = require('./answer');
const { timedFetch, FETCH_MS } = require('./net');
const LIM = require('../lib/core-limiter');
const { follower } = require('./rules-follow');
function chainFns(root) {
  const vm = require('vm');
  const ctx = { window: { V2Rules: { replay() { return { pets: [] }; } }, LiveEngine: { RealCore: {}, CFG: { isMainnet: true, asset: 'XCPETS', mempoolApi: 'https://mempool.space/api' } }, addEventListener() {} },
    document: { getElementById() { return null; }, currentScript: null, hidden: true, addEventListener() {}, querySelector() { return null; }, createElement() { return {}; }, scripts: [] },
    location: { search: '' }, localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }, sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    setInterval() { return 0; }, setTimeout() { return 0; }, clearTimeout() {}, URLSearchParams: global.URLSearchParams, console };
  ctx.window.window = ctx.window; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root || ROOT, 'js/v2-chain.js'), 'utf8'), ctx, { filename: 'js/v2-chain.js' });
  return ctx.window.V2Mock;
}
function seedHashes() {
  const vm = require('vm'); const ctx = { window: {} }; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/block-hashes.js'), 'utf8'), ctx);
  return ctx.window.XCPETS_BLOCK_HASHES || {};
}
function makeIo(bases) {
  const raw = (u, o) => timedFetch(u, o, FETCH_MS);
  const limited = LIM.makeFetch(raw, { conc: +(process.env.XP_CONC || 1), rps: +(process.env.XP_RPS || 2), timeoutMs: FETCH_MS, match: u => bases.some(b => String(u).indexOf(b) === 0) });
  let lastKind = hostKind(bases[0]);
  async function getJson(pathname) { let last = 'failed';
    for (const base of bases) { try { const r = await limited(base + pathname); if (r.status === 404) return { result: [] };
      if (!r.ok) { last = String(r.status); continue; } lastKind = hostKind(base); return await r.json(); } catch (e) { last = 'down'; } }
    throw new Error('upstream ' + last); }
  async function hashOf(n) {
    try { const r = await timedFetch('https://mempool.space/api/block-height/' + n, {}, FETCH_MS); const t = (await r.text()).trim(); if (/^[0-9a-f]{64}$/.test(t)) return t; } catch (e) {}
    const j = await getJson('/blocks/' + n); const h = j && j.result && j.result.block_hash; if (!/^[0-9a-f]{64}$/.test(h || '')) throw new Error('missing hash'); return h;
  }
  async function mempool() { const j = await getJson('/mempool/events/ASSET_DESTRUCTION?limit=1000'); return bootSync().mempoolOf((j && j.result) || [], 'XCPETS'); }
  async function mempoolHeight() { const r = await timedFetch('https://mempool.space/api/blocks/tip/height', {}, FETCH_MS); const t = await r.text(); const n = parseInt(t, 10); return n > 0 ? n : 0; }
  return { getJson, hashOf, mempool, mempoolHeight, upstreamOf: () => lastKind };
}
/* root: where the rule files are read from. The installed repo by default, main's copy once rules-follow.js has one. */
function salesIo(bases, boot, root) {
  root = root || ROOT;
  const vm = require('vm');
  const { getJson, hashOf, mempool, mempoolHeight, upstreamOf } = makeIo(bases);
  const limitedFetch = (u, o) => timedFetch(u, o, FETCH_MS);
  const wrapped = LIM.makeFetch(limitedFetch, { conc: 1, rps: +(process.env.XP_RPS || 2), timeoutMs: FETCH_MS, match: () => true });
  const store = {}; const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const win = { console, localStorage: ls, sessionStorage: ls, location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/' }, navigator: { userAgent: 'xcpets-sync' },
    setTimeout, clearTimeout, URLSearchParams: global.URLSearchParams, URL: global.URL, TextEncoder, TextDecoder, AbortController: global.AbortController, fetch: wrapped,
    addEventListener() {}, dispatchEvent() { return true; }, CustomEvent: function CustomEvent(type, o) { this.type = type; this.detail = o && o.detail; }, XCPETS_PATIENT: 1, XCPETS_TOUCH_MAX: 400, XCPETS_MINT_SCAN: 1, XCPETS_DEX_MS: 15 * 60 * 1000 };
  win.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {}, body: null, documentElement: { style: {} } };
  win.window = win; win.self = win; win.globalThis = win;
  const ctx = vm.createContext(win);
  const scripts = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js', 'js/block-hashes.js', 'js/v2-sales.js'];
  vm.runInContext(fs.readFileSync(path.join(root, 'rjs/config.js'), 'utf8'), ctx, { filename: 'rjs/config.js' });
  ctx.XCPETS_CONFIG.read = bases.slice(); ctx.XCPETS_CONFIG.composeList = bases.slice(); ctx.XCPETS_CONFIG.compose = bases[bases.length - 1];
  for (const f of scripts) { if (f === 'rjs/config.js') continue; vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f }); }
  vm.runInContext('window.LiveEngine={RealCore:window.RealCore,Chain:window.Chain&&window.Chain.Chain,CFG:window.XCPETS_CONFIG};', ctx);
  const V = ctx.V2Rules, gates = { fire: V.ACTIVATE_FIRESALE_BLOCK != null ? V.ACTIVATE_FIRESALE_BLOCK : null, quest: V.questGate ? V.questGate() : null, raid: V.raidGate ? V.raidGate() : null };
  if (boot && boot.dex && boot.dexTip && boot.dexHash && ctx.V2Sales && ctx.V2Sales.setBase) ctx.V2Sales.setBase(boot);
  const chain = chainFns(root);
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
/* Nov 22 2026 (never go dark): besides world/latest.json (the newest world), each rules signature keeps its own pointer at
 * world/<rsig>/latest.json. When the rules change, pages that still run the previous rules keep finding the previous world
 * there (and catch up the few newest blocks) instead of rebuilding everything, and pages with the new rules find theirs. */
function writeLatest(dataDir, latest) {
  const body = JSON.stringify(latest), dirs = [path.join(dataDir, 'world'), path.join(dataDir, 'world', latest.rsig)];
  /* the per-rsig pointer first, so a page never sees latest.json name a world whose own pointer is missing */
  for (const d of dirs.reverse()) { fs.mkdirSync(d, { recursive: true }); const f = path.join(d, 'latest.json'); fs.writeFileSync(f + '.tmp', body); fs.renameSync(f + '.tmp', f); }
}
function backfillRsigLatest(dataDir) {
  const latest = readLatest(dataDir); if (!latest || !/^r[0-9a-f]{32}$/.test(latest.rsig || '')) return;
  const f = path.join(dataDir, 'world', latest.rsig, 'latest.json');
  try { if (!fs.existsSync(f) && fs.existsSync(path.join(dataDir, 'world', latest.rsig))) fs.writeFileSync(f, JSON.stringify(latest)); } catch (e) { }
}
/* Nov 22 2026: the published world stopped at 977,059 for hours while the follower stayed current. A build that hangs kept
 * startSnapshot.running true forever, and a build that failed left its pending-<tip> folder behind on every retry (10 min apart),
 * which can fill the disk so every later build fails too. Now: a build is stopped after XP_SNAPSHOT_MAX_MIN, leftover pending
 * folders are removed before each build and after a failed one, the exit handler can't throw, and /xp/v1/health shows the
 * builder's state (numbers only). */
function snapState() { const S = startSnapshot; return { running: !!S.running, runningSec: S.running && S.startedAt ? Math.round((Date.now() - S.startedAt) / 1000) : 0,
  code: S.code || null, fails: S.fails || 0, lastExit: S.lastExit || null, lastOkAt: S.okAt || null, lastFailAt: S.failAt ? new Date(S.failAt).toISOString() : null, killed: S.killed || 0, freeMB: freeMB(S.dir) }; }
function freeMB(dir) { try { const st = fs.statfsSync(dir || os.tmpdir()); return Math.floor(st.bavail * st.bsize / 1048576); } catch (e) { return null; } }
function clearPending(dataDir) { const root = path.join(dataDir, 'world'); try { fs.readdirSync(root).filter(n => /^pending-\d+$/.test(n)).forEach(n => fs.rmSync(path.join(root, n), { recursive: true, force: true })); } catch (e) { } }
function snapDone(code, out, why) { const S = startSnapshot; S.running = false; clearTimeout(S.timer); S.timer = null;
  if (code === 0) return; S.failAt = Date.now(); S.fails = (S.fails || 0) + 1; S.lastExit = why || ('exit ' + code); try { fs.rmSync(out, { recursive: true, force: true }); } catch (e) { } }
function startSnapshot(state, dataDir, codeDir) {
  if (startSnapshot.running) return; startSnapshot.running = true; startSnapshot.startedAt = Date.now(); startSnapshot.dir = dataDir;
  clearPending(dataDir);
  const st = path.join(dataDir, 'state.json');
  fs.mkdirSync(dataDir, { recursive: true });
  const view = pageInputs(state);
  fs.writeFileSync(st, JSON.stringify({ rows: view.rows, hashes: view.hashes, tip: view.tip, dex: view.dex, gates: view.gates }));
  const out = path.join(dataDir, 'world', 'pending-' + state.tip);
  /* main's copy of the builder when rules-follow.js has one, else the installed one */
  const snapJs = codeDir && fs.existsSync(path.join(codeDir, 'tools', 'sync-server', 'snapshot.js')) ? path.join(codeDir, 'tools', 'sync-server', 'snapshot.js') : path.join(__dirname, 'snapshot.js');
  startSnapshot.code = snapJs === path.join(__dirname, 'snapshot.js') ? 'installed' : 'main';
  const args = [snapJs, '--state', st, '--out', out];
  if (process.env.XP_SNAPSHOT_COMPRESS === '0') args.push('--no-compress');
  const heap = String(+(process.env.XP_SNAPSHOT_HEAP || 1536));
  const nodeArgs = ['--max-old-space-size=' + heap, ...args];
  const cmd = process.platform === 'win32' ? null : 'nice';
  const child = cmd ? spawn(cmd, ['-n', '10', process.execPath, ...nodeArgs], { stdio: ['ignore', 'pipe', 'pipe'] }) : spawn(process.execPath, nodeArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
  let buf = ''; child.stdout.on('data', d => { buf += d; });
  const maxMs = Math.max(5, +(process.env.XP_SNAPSHOT_MAX_MIN || 30)) * 60000;
  startSnapshot.timer = setTimeout(() => { startSnapshot.killed = (startSnapshot.killed || 0) + 1; console.error('snapshot: over ' + (maxMs / 60000) + ' min, stopping it'); try { child.kill('SIGKILL'); } catch (e) { } }, maxMs);
  child.stderr.on('data', d => { const s = String(d).trim(); if (s) console.error('snapshot: ' + s.split('\n')[0].slice(0, 180)); });
  child.on('exit', (code, signal) => { if (code !== 0) { snapDone(code, out, signal ? 'signal ' + signal : 'exit ' + code); console.error('snapshot exit ' + (signal || code)); return; }
    try {
      const info = JSON.parse(buf.trim().split('\n').pop());
      const dest = path.join(dataDir, 'world', info.rsig, String(info.tip));
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.rmSync(dest, { recursive: true, force: true }); fs.renameSync(out, dest);
      const latest = { v: 1, rsig: info.rsig, tip: info.tip, manifest: '/xp/v1/world/' + info.rsig + '/' + info.tip + '/manifest.json', builtAt: new Date().toISOString() };
      writeLatest(dataDir, latest);
      state.world = { ready: true, rsig: info.rsig, tip: info.tip, manifest: latest.manifest };
      snapDone(0, out); startSnapshot.failAt = 0; startSnapshot.fails = 0; startSnapshot.lastExit = null; startSnapshot.okAt = latest.builtAt;
    } catch (e) { snapDone(1, out, 'publish failed: ' + String(e && e.code || 'error')); console.error('snapshot publish failed: ' + String(e && e.message || e).slice(0, 160)); } });
  child.on('error', () => { snapDone(1, out, 'spawn failed'); if (!cmd) return;
    startSnapshot.running = true; startSnapshot.failAt = 0;
    const c2 = spawn(process.execPath, nodeArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    c2.stdout.on('data', d => { buf += d; });
    c2.stderr.on('data', d => { const s = String(d).trim(); if (s) console.error('snapshot: ' + s.split('\n')[0].slice(0, 180)); });
    c2.on('exit', (code, signal) => { snapDone(code, out, signal ? 'signal ' + signal : 'exit ' + code); }); });
}
function main() {
  const bases = upstreams(); const dataDir = process.env.XP_DATA || path.join(os.tmpdir(), 'xcpets-sync');
  const boot = process.env.XP_BOOT_CACHE ? readBoot(process.env.XP_BOOT_CACHE) : null;
  const state = blank(); if (boot && boot.hashes) Object.keys(boot.hashes).forEach(k => { if (+k <= boot.tip - 6) state.hashes[k] = boot.hashes[k]; });
  if (boot && boot.rows && boot.tip) { state.rows = boot.rows; state.tip = boot.tip; state.dex = boot.dex || null; state.dexTip = boot.dexTip || 0; state.dexHash = boot.dexHash || ''; state.dexAssets = boot.dexAssets || []; }
  const rules = follower(dataDir);
  let io0 = null;
  try { io0 = rules.dir() ? salesIo(bases, boot, rules.dir()) : null; } catch (e) { console.error('rules: main copy did not load, using the installed files'); io0 = null; }
  if (!io0) io0 = salesIo(bases, boot);
  state.gates = io0.gates;
  const io = Object.assign({}, io0, { upstream: 'public', seed: io0.seed });
  state.snap = snapState; state.rules = rules.info;
  backfillRsigLatest(dataDir);
  /* After main moved: read the gates and the chain merge from the new copy too, so the blocks this service collects match the new rules. */
  function adopt(r) { if (!r || !r.changed) return;
    try { const fresh = salesIo(bases, boot, rules.dir()); const keep = io.upstream; Object.assign(io, fresh, { upstream: keep, seed: io.seed }); io0 = fresh; state.gates = fresh.gates; }
    catch (e) { console.error('rules: new copy did not load in the service: ' + String(e && e.message || e).split('\n')[0].slice(0, 120)); } }
  const httpd = createServer({ getState: () => state, dataDir: dataDir });
  const port = +(process.env.XP_PORT || 8787);
  httpd.server.listen(port, '127.0.0.1');
  let timer = null, held = false;
  const every = Math.max(1, +(process.env.XP_SNAPSHOT_EVERY || 6));
  const loop = singleFlight(async function () { try {
    if (!(process.env.XP_HOLD === '1' && held)) { io.upstream = io0.upstreamOf(); await tick(state, io); state.upstream = io.upstream === 'private' ? 'private' : 'public'; if (process.env.XP_HOLD === '1' && state.ready) held = true; }
    const latest = readLatest(dataDir); if (latest && latest.tip) state.world = { ready: true, rsig: latest.rsig, tip: latest.tip, manifest: latest.manifest };
    const behindSnap = state.world && state.world.tip ? state.tip - state.world.tip : state.tip;
    const cooled = !startSnapshot.failAt || Date.now() - startSnapshot.failAt > 10 * 60 * 1000;
    /* main's rules changed: build now with them instead of waiting for the next 6 blocks */
    const newRules = !!(rules.state.rsig && state.world && state.world.rsig && state.world.rsig !== rules.state.rsig && rules.dir());
    if (process.env.XP_SNAPSHOT !== '0' && state.ready && state.lag < 2 && cooled && (!state.world || !state.world.tip || behindSnap >= every || newRules)) startSnapshot(state, dataDir, rules.dir());
    rules.poll().then(adopt, () => {});
  } catch (e) { console.error('sync tick failed'); } });
  loop(); timer = setInterval(loop, 10000);
  console.log('xcpets-sync on 127.0.0.1:' + port + ' upstreams ' + bases.map(hostKind).join(','));
  return { server: httpd.server, state, stop() { clearInterval(timer); httpd.server.close(); } };
}
if (require.main === module) main();
module.exports = { main, chainFns, seedHashes, writeLatest, backfillRsigLatest, PUBLIC };
