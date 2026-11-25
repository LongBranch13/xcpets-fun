'use strict';
/* World copy (Nov 25 2026, owner: "is there a better or cheaper way to serve the game", then "Yes, build both").
 * Builds the published pet world on GitHub, with the same code and rules as the game server, and copies it to the Cloudflare world
 * copy (cloud/world/worker.js, an R2 bucket). Pages read that copy when the game server is down or its world falls behind (sw.js),
 * so a dead or frozen server no longer means a slow load. Read-only toward the chain: it signs nothing and holds no wallet.
 *
 *   node tools/world-copy.js auto                 follow the chain from api/boot.json, build when the copy is EVERY+ blocks behind, copy it
 *   node tools/world-copy.js build --out DIR      follow + build only (DIR/<rsig>/<tip>/...)
 *   node tools/world-copy.js upload --dir DIR/<rsig>/<tip>
 * Env: WORLD_COPY_URL (the Worker's address), MIRROR_KEY (its write key), WORLD_COPY_EVERY (blocks, default 6), WORLD_COPY_FORCE=1. */
const fs = require('fs'), path = require('path'), zlib = require('zlib'), Module = require('module');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');

const BASE = String(process.env.WORLD_COPY_URL || '').replace(/\/+$/, '');
const KEY = process.env.MIRROR_KEY || '';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function http(method, p, body, type) {
  if (!BASE) throw new Error('WORLD_COPY_URL is not set');
  let last;
  for (let i = 0; i < 5; i++) {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), 120000);
    try {
      const r = await fetch(BASE + p, { method, body, signal: ac.signal, headers: Object.assign({ 'x-mirror-key': KEY }, type ? { 'content-type': type } : {}) });
      if (r.status === 403) throw Object.assign(new Error('the world copy refused the write key'), { fatal: true });
      if (r.status >= 500 || r.status === 429) throw new Error('HTTP ' + r.status);
      if (!r.ok) throw Object.assign(new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200)), { fatal: true });
      return r;
    } catch (e) { last = e; if (e.fatal) throw e; await sleep(1500 * (i + 1)); } finally { clearTimeout(t); }
  }
  throw last;
}
const getJson = async p => (await http('GET', p)).json();

/* every world file (the .gz/.br copies beside them are the same bytes compressed) */
function walk(dir, pre) {
  const out = [];
  for (const n of fs.readdirSync(path.join(dir, pre)).sort()) {
    const rel = pre ? pre + '/' + n : n, full = path.join(dir, rel);
    if (fs.statSync(full).isDirectory()) out.push(...walk(dir, rel));
    else if (/\.json$/.test(n)) out.push(rel);
  }
  return out;
}
/* one pack of every file (gzipped, back to back) + its "<path> <offset> <length>" index */
function packOf(dir) {
  const rels = walk(dir, '');
  if (rels.indexOf('manifest.json') < 0) throw new Error('no manifest.json in ' + dir);
  const bufs = [], lines = []; let at = 0;
  for (const rel of rels) {
    const full = path.join(dir, rel);
    const gz = fs.existsSync(full + '.gz') ? fs.readFileSync(full + '.gz') : zlib.gzipSync(fs.readFileSync(full), { level: 9 });
    bufs.push(gz); lines.push(rel + ' ' + at + ' ' + gz.length); at += gz.length;
  }
  return { pack: Buffer.concat(bufs), index: lines.join('\n') + '\n', n: rels.length };
}

async function upload(dir, opt) {
  opt = opt || {};
  const m = /(r[0-9a-f]{32})[\\/](\d+)[\\/]?$/.exec(path.resolve(dir));
  if (!m) throw new Error('--dir must end in <rsig>/<tip>');
  const rsig = m[1], tip = +m[2], t0 = Date.now();
  const { pack, index, n } = packOf(dir);
  await http('PUT', '/m/w/' + rsig + '/' + tip + '.pack', pack, 'application/octet-stream');
  await http('PUT', '/m/w/' + rsig + '/' + tip + '.txt', index, 'text/plain');
  const pub = await (await http('POST', '/m/publish', JSON.stringify({ rsig, tip, builtAt: opt.builtAt || new Date().toISOString(), source: opt.source || 'github' }), 'application/json')).json();
  console.log('copied world ' + tip + ' (' + rsig.slice(0, 9) + '…): ' + n + ' files, ' + (pack.length / 1e6).toFixed(1) + ' MB in ' + Math.round((Date.now() - t0) / 1000) + ' s; worlds kept ' + pub.kept + ', dropped ' + pub.dropped);
  /* read it back through the public paths, as a page would */
  const own = await getJson('/xp/v1/world/' + rsig + '/latest.json');
  for (const rel of ['manifest.json', 'view/summary.json']) {
    if (!fs.existsSync(path.join(dir, rel))) continue;
    const got = Buffer.from(await (await fetch(own.manifest.replace(/manifest\.json$/, rel))).arrayBuffer());
    if (!got.equals(fs.readFileSync(path.join(dir, rel)))) throw new Error('read-back: ' + rel + ' differs');
  }
  console.log('read back OK: ' + own.manifest.replace(/^https?:\/\/[^/]+/, '<copy>'));
  return { rsig, tip, files: n, bytes: pack.length };
}

/* the sync server's own follower (tools/sync-server, same as tools/followprobe.js), from api/boot.json to the chain's tip, public nodes */
async function follow() {
  const R = path.join(ROOT, 'tools', 'sync-server', 'index.js');
  const m = new Module(R, null); m.filename = R; m.paths = Module._nodeModulePaths(path.dirname(R));
  m._compile(fs.readFileSync(R, 'utf8') + '\nmodule.exports.salesIo = salesIo;', R);
  const { blank, tick } = require('./sync-server/follow');
  const { pageInputs } = require('./sync-server/answer');
  const boot = JSON.parse(fs.readFileSync(path.join(ROOT, 'api', 'boot.json'), 'utf8'));
  const io0 = m.exports.salesIo(m.exports.PUBLIC, boot);
  const state = blank(); state.rows = boot.rows; state.tip = boot.tip; state.dex = boot.dex || null; state.dexTip = boot.dexTip || 0; state.dexHash = boot.dexHash || ''; state.dexAssets = boot.dexAssets || [];
  Object.keys(boot.hashes || {}).forEach(k => { if (+k <= boot.tip - 6) state.hashes[k] = boot.hashes[k]; });
  state.gates = io0.gates;
  const t0 = Date.now();
  await tick(state, Object.assign({}, io0, { upstream: 'public' }));
  console.log('followed the chain from ' + boot.tip + ' to ' + state.tip + ' in ' + Math.round((Date.now() - t0) / 1000) + ' s (' + state.rows.length + ' burns)');
  return pageInputs(state);
}
function rulesSigNow() { const S = require('./sync-server/snapshot'); return S.rulesSig(S.loadBytes()); }

/* one build in a child process (like the server), capped so it never takes the whole runner */
function build(view, outRoot) {
  fs.mkdirSync(outRoot, { recursive: true });
  const st = path.join(outRoot, 'state.json'), pend = path.join(outRoot, 'pending-' + view.tip);
  fs.rmSync(pend, { recursive: true, force: true });
  fs.writeFileSync(st, JSON.stringify({ rows: view.rows, hashes: view.hashes, tip: view.tip, dex: view.dex, gates: view.gates }));
  const t0 = Date.now();
  const r = spawnSync(process.execPath, ['--max-old-space-size=' + (process.env.WORLD_COPY_HEAP || 8192), path.join(__dirname, 'sync-server', 'snapshot.js'), '--state', st, '--out', pend], { encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.status !== 0) throw new Error('world build failed: ' + String(r.stderr || '').trim().split('\n').slice(-3).join(' | '));
  const info = JSON.parse(String(r.stdout).trim().split('\n').pop());
  const dir = path.join(outRoot, info.rsig, String(info.tip));
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(path.dirname(dir), { recursive: true }); fs.renameSync(pend, dir);
  console.log('built world ' + info.tip + ' (' + info.rsig.slice(0, 9) + '…) in ' + Math.round((Date.now() - t0) / 1000) + ' s');
  return { rsig: info.rsig, tip: info.tip, dir };
}

/* the Bitcoin chain's height (one cheap read), so a run with a current copy skips the chain follow */
async function chainHeight() {
  for (const u of ['https://mempool.space/api/blocks/tip/height', 'https://blockstream.info/api/blocks/tip/height']) {
    try { const ac = new AbortController(), t = setTimeout(() => ac.abort(), 10000); const r = await fetch(u, { signal: ac.signal }); clearTimeout(t); const n = parseInt(await r.text(), 10); if (n > 0) return n; } catch (e) { }
  }
  return 0;
}
async function auto(outRoot) {
  const every = +(process.env.WORLD_COPY_EVERY || 6), force = process.env.WORLD_COPY_FORCE === '1';
  const rsig = rulesSigNow();
  let have = null;
  try { have = await getJson('/xp/v1/world/' + rsig + '/latest.json'); } catch (e) { if (!/^HTTP 404/.test(String(e.message))) throw e; }
  const copyTip = have && have.rsig === rsig ? have.tip : 0, height = await chainHeight();
  console.log('rules ' + rsig.slice(0, 9) + '…, chain ' + (height || '?') + ', copy ' + (copyTip || 'none for these rules'));
  if (!force && copyTip && height && height - copyTip < every) { console.log('copy is current (fewer than ' + every + ' blocks behind): nothing to build'); return { skipped: true }; }
  const view = await follow();
  if (!force && copyTip && view.tip - copyTip < every) { console.log('copy is current for the game (burns up to ' + view.tip + '): nothing to build'); return { skipped: true }; }
  const b = build(view, outRoot);
  if (b.rsig !== rsig) throw new Error('rules signature changed during the build (' + b.rsig + ' vs ' + rsig + ')');
  return upload(b.dir, { source: 'github' });
}

if (require.main === module) {
  const A = process.argv.slice(2), opt = k => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : null; };
  const out = opt('--out') || path.join(require('os').tmpdir(), 'xcpets-world-copy');
  const run = { auto: () => auto(out), build: async () => build(await follow(), out), upload: () => upload(opt('--dir')) }[A[0]];
  if (!run) { console.error('usage: node tools/world-copy.js auto|build|upload'); process.exit(2); }
  run().then(() => setTimeout(() => process.exit(0), 200), e => { console.error('world copy failed: ' + (e && e.message || e)); setTimeout(() => process.exit(1), 200); });
}
module.exports = { walk, packOf, upload, build, auto, follow, rulesSigNow };
