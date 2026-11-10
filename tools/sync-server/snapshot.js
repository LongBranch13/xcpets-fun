#!/usr/bin/env node
'use strict';
/* Builds one pet-world snapshot with the replay scripts and wsEncode as they are on disk.
 * A part is published only when a JSON round trip (undefined marked as {"__u":1}) matches the encoded value. */
const fs = require('fs'), path = require('path'), vm = require('vm'), zlib = require('zlib'), crypto = require('crypto');
const { bootSync, sha256, ROOT } = require('./client');
const RULES = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js', 'js/v2-replay-worker.js'];
function rulesSig(files) {
  let n = 0; const bufs = files.map(b => Buffer.isBuffer(b) ? b : Buffer.from(b));
  bufs.forEach(b => { n += b.length + 8; });
  const all = Buffer.alloc(n); let o = 0;
  bufs.forEach(b => { all.writeUInt32BE(b.length, o); o += 8; b.copy(all, o); o += b.length; });
  return 'r' + crypto.createHash('sha256').update(all).digest('hex').slice(0, 32);
}
function loadBytes(dir) { return RULES.map(f => fs.readFileSync(path.join(dir || ROOT, f))); }
function workerFns() {
  const ctx = { console, setTimeout, clearTimeout, setInterval, clearInterval, URL, URLSearchParams, TextEncoder, TextDecoder, crypto: crypto.webcrypto, AbortController,
    fetch: () => Promise.reject(new Error('offline')), postMessage() {}, importScripts() { throw new Error('importScripts'); }, indexedDB: null };
  ctx.self = ctx; ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/v2-replay-worker.js'), 'utf8'), ctx, { filename: 'js/v2-replay-worker.js' });
  const ok = vm.runInContext('typeof shim==="function"&&typeof wsEncode==="function"', ctx);
  if (!ok) throw new Error('wsEncode is not in scope');
  return ctx;
}
function replayWorld(ctx, rows, hashes, tip, dex) {
  ctx.location = { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/js/v2-replay-worker.js', protocol: 'https:' };
  ctx.navigator = { userAgent: 'xcpets-sync' };
  vm.runInContext('shim()', ctx);
  for (const f of RULES) { if (f === 'js/v2-replay-worker.js') continue; vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
  vm.runInContext('self.LiveEngine={RealCore:self.RealCore,Chain:self.Chain&&self.Chain.Chain,CFG:self.XCPETS_CONFIG};', ctx);
  ctx.__rows = rows; ctx.__hashes = hashes; ctx.__tip = tip; ctx.__dex = dex || undefined;
  vm.runInContext('__world = self.V2Rules.replay(__rows, __hashes, [], { tip: __tip, live: self.LiveEngine.RealCore, dex: __dex });', ctx);
  return ctx.__world;
}
function encodeWorld(ctx, world) { ctx.__w = world; vm.runInContext('__enc = wsEncode(__w)', ctx); const enc = ctx.__enc; ctx.__w = null; ctx.__enc = null; return enc; }
function jsonPart(value) {
  const C = bootSync();
  const json = JSON.stringify(C.markValue(value));
  const back = C.unmarkValue(JSON.parse(json));
  if (!C.sameValue(back, value)) throw new Error('json round trip');
  return json;
}
async function digestOf(root, parts) { return bootSync().digestOf(root, parts); }
function writeCompressed(file, json, compress) {
  const buf = Buffer.from(json);
  fs.writeFileSync(file, buf);
  if (!compress) return;
  fs.writeFileSync(file + '.gz', zlib.gzipSync(buf, { level: 9 }));
  fs.writeFileSync(file + '.br', zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 6 } }));
}
async function buildSnapshot(opts) {
  const t0 = Date.now();
  const bytes = opts.bytes || loadBytes(opts.rulesDir || ROOT);
  const rsig = rulesSig(bytes);
  const ctx = workerFns();
  const world = replayWorld(ctx, opts.rows || [], opts.hashes || {}, opts.tip, opts.dex);
  const enc = encodeWorld(ctx, world);
  const C = bootSync();
  const rootJson = jsonPart(enc.root);
  const partJson = enc.parts.map(jsonPart);
  const digest = await digestOf(enc.root, enc.parts);
  const build = opts.build || (fs.existsSync(path.join(ROOT, 'build-id.txt')) ? fs.readFileSync(path.join(ROOT, 'build-id.txt'), 'utf8').trim() : '');
  let inSig = opts.inSig || '';
  if (!inSig && opts.inSigOf) inSig = opts.inSigOf({ tip: opts.tip, rows: opts.rows, hashes: opts.hashes, dex: opts.dex });
  const key = rsig + '|' + inSig + '|[]';
  const manifest = { v: 1, format: 'ws2-json', rsig: rsig, build: build, tip: opts.tip, tipHash: (opts.hashes && opts.hashes[opts.tip]) || '', ops: '[]', inSig: inSig, key: key,
    n: enc.n, parts: enc.parts.length, root: { url: 'root.json', bytes: Buffer.byteLength(rootJson), sha256: sha256(rootJson) },
    files: partJson.map((json, i) => ({ i: i, url: 'part-' + String(i).padStart(3, '0') + '.json', bytes: Buffer.byteLength(json), sha256: sha256(json) })),
    digest: digest, builtAt: new Date().toISOString(), replayMs: Date.now() - t0 };
  if (opts.outDir) {
    fs.mkdirSync(opts.outDir, { recursive: true });
    writeCompressed(path.join(opts.outDir, 'root.json'), rootJson, opts.compress !== false);
    partJson.forEach((json, i) => writeCompressed(path.join(opts.outDir, manifest.files[i].url), json, opts.compress !== false));
    fs.writeFileSync(path.join(opts.outDir, 'manifest.json'), JSON.stringify(manifest));
    prune(path.dirname(path.dirname(opts.outDir)), rsig);
  }
  return { manifest: manifest, rsig: rsig, enc: opts.keepEnc ? enc : null };
}
function prune(worldRoot, rsig) {
  if (!worldRoot || !fs.existsSync(worldRoot)) return;
  const sigs = fs.readdirSync(worldRoot).filter(n => /^r[0-9a-f]{32}$/.test(n));
  sigs.sort((a, b) => fs.statSync(path.join(worldRoot, b)).mtimeMs - fs.statSync(path.join(worldRoot, a)).mtimeMs);
  const keep = new Set(sigs.slice(0, 2)); keep.add(rsig);
  sigs.forEach(s => { if (!keep.has(s)) fs.rmSync(path.join(worldRoot, s), { recursive: true, force: true }); });
  for (const s of keep) { const dir = path.join(worldRoot, s); if (!fs.existsSync(dir)) continue;
    const tips = fs.readdirSync(dir).filter(n => /^\d+$/.test(n)).sort((a, b) => +b - +a);
    tips.slice(6).forEach(t => fs.rmSync(path.join(dir, t), { recursive: true, force: true })); }
}
function chainInSig(rows, hashes, tip, dex) {
  const src = fs.readFileSync(path.join(ROOT, 'js/v2-chain.js'), 'utf8');
  const ctx = { window: { V2Rules: { replay() { return { pets: [] }; } }, LiveEngine: { RealCore: {}, CFG: { isMainnet: true, asset: 'XCPETS' } }, addEventListener() {} },
    document: { getElementById() { return null; }, currentScript: { src: 'https://x/js/v2-chain.js?v=abcdef1234' }, hidden: true, addEventListener() {}, querySelector() { return null; }, createElement() { return {}; }, scripts: [] },
    location: { search: '' }, localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }, sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    setInterval() { return 0; }, setTimeout() { return 0; }, clearTimeout() {}, URLSearchParams, console };
  ctx.window.window = ctx.window; vm.createContext(ctx); vm.runInContext(src, ctx, { filename: 'js/v2-chain.js' });
  return ctx.window.V2Mock.inSigOf({ tip: tip, rows: rows, hashes: hashes, dex: dex || undefined });
}
if (require.main === module) {
  const A = process.argv.slice(2), opt = k => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : null; };
  const state = JSON.parse(fs.readFileSync(opt('--state'), 'utf8'));
  const out = opt('--out');
  buildSnapshot({ rows: state.rows, hashes: state.hashes, tip: state.tip, dex: state.dex, outDir: out, compress: !A.includes('--no-compress'), inSigOf: o => chainInSig(o.rows, o.hashes, o.tip, o.dex) }).then(r => {
    process.stdout.write(JSON.stringify({ rsig: r.rsig, tip: r.manifest.tip, digest: r.manifest.digest, parts: r.manifest.parts, replayMs: r.manifest.replayMs }) + '\n');
  }).catch(e => { console.error('snapshot failed'); process.exit(1); });
}
module.exports = { buildSnapshot, rulesSig, loadBytes, workerFns, replayWorld, encodeWorld, jsonPart, chainInSig, RULES, prune };
