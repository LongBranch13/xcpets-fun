#!/usr/bin/env node
/* Decode a published snapshot (root.json + part-*.json) and write the paged view.
 * The snapshot is the full replay at that tip. This does not modify js/v2-rules.js.
 *   node --max-old-space-size=3072 tools/live-view-build.js --snap /tmp/live-snap --out /tmp/live-view --manifest /tmp/live-manifest.json */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const { wsDecode } = require('../js/v2-resume');
const split = require('./sync-server/split');
const A = process.argv.slice(2);
const opt = k => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : null; };
const snapDir = opt('--snap') || '/tmp/live-snap';
const outDir = opt('--out') || '/tmp/live-view';
const man = JSON.parse(fs.readFileSync(opt('--manifest') || '/tmp/live-manifest.json', 'utf8'));
function unmark(v) {
  if (!v || typeof v !== 'object') return v;
  if (Array.isArray(v)) { const a = new Array(v.length); for (let i = 0; i < v.length; i++) if (i in v) a[i] = unmark(v[i]); return a; }
  const ks = Object.keys(v);
  if (ks.length === 1 && ks[0] === '__u' && v.__u === 1) return undefined;
  const o = {}; for (let j = 0; j < ks.length; j++) o[ks[j]] = unmark(v[ks[j]]); return o;
}
function load(name) { return unmark(JSON.parse(fs.readFileSync(path.join(snapDir, name), 'utf8'))); }
let maxRss = process.memoryUsage().rss;
const memT = setInterval(() => { const r = process.memoryUsage().rss; if (r > maxRss) maxRss = r; }, 250);
const t0 = Date.now();
(async () => {
  const tLoad = Date.now();
  const root = load(man.root.url);
  const parts = new Array(man.files.length);
  for (let i = 0; i < man.files.length; i++) { parts[i] = load(man.files[i].url); if (i % 10 === 0) process.stderr.write('loaded ' + i + '\n'); }
  const tDec = Date.now();
  const world = wsDecode(root, parts);
  for (let i = 0; i < parts.length; i++) parts[i] = null;
  process.stderr.write('decoded pets ' + (world.pets && world.pets.length) + ' in ' + (Date.now() - tDec) + 'ms load ' + (tDec - tLoad) + 'ms\n');
  fs.mkdirSync(outDir, { recursive: true });
  const view = await split.write(outDir, world, { tip: man.tip, rsig: man.rsig });
  let bad = 0, checked = 0;
  view.top.forEach(owner => {
    const got = [];
    for (let pg = 0; pg < Math.ceil(owner.n / split.PAGE); pg++) {
      const file = pg === 0 ? owner.key + '.json' : owner.key + '.' + pg + '.json';
      const body = JSON.parse(fs.readFileSync(path.join(outDir, 'own', file), 'utf8'));
      body.pets.forEach(p => got.push(split.fieldsOf(p).join('|')));
    }
    const want = owner.fields.map(f => f.join('|')).sort();
    got.sort();
    checked += want.length;
    if (got.length !== want.length || got.some((g, i) => g !== want[i])) bad++;
  });
  let sampleBad = 0;
  view.sample.forEach(f => {
    const shard = split.petShard(f[0]);
    const body = JSON.parse(fs.readFileSync(path.join(outDir, 'p', shard + '.json'), 'utf8'));
    const p = body.pets[String(f[0])];
    if (!p || split.fieldsOf(p).join('|') !== f.join('|')) sampleBad++;
  });
  function pack(file) {
    const buf = fs.readFileSync(file);
    const gz = zlib.gzipSync(buf, { level: 9 }).length;
    const br = zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 6 } }).length;
    return { bytes: buf.length, gz: gz, br: br };
  }
  const summaryPack = pack(path.join(outDir, 'summary.json'));
  const ownerFile = path.join(outDir, view.largestPage.file.replace(/^view\//, ''));
  const shardFile = path.join(outDir, view.largestShard.file.replace(/^view\//, ''));
  const report = {
    tip: man.tip, rsig: man.rsig, pets: view.n, alive: view.alive,
    loadMs: tDec - tLoad, wallMs: Date.now() - t0, maxRss: maxRss, maxRssMB: Math.round(maxRss / 1e6),
    files: view.files, bytes: view.bytes,
    largestOwner: view.largestOwner, largestPage: Object.assign({}, view.largestPage, pack(ownerFile)),
    largestShard: Object.assign({}, view.largestShard, pack(shardFile)),
    summary: summaryPack,
    topOwnersOk: bad === 0, topPets: checked, topBad: bad,
    sampleOk: sampleBad === 0, sample: view.sample.length, sampleBad: sampleBad,
    top: view.top.map(o => ({ owner: o.owner, n: o.n, pages: Math.ceil(o.n / split.PAGE) }))
  };
  console.log(JSON.stringify(report, null, 2));
  clearInterval(memT);
  if (bad || sampleBad) process.exit(1);
})().catch(e => { clearInterval(memT); console.error(e); process.exit(1); });
