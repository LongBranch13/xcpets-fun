'use strict';
/* World copy test (Nov 25 2026): runs cloud/world/worker.js on an in-memory R2 behind a local HTTP server, copies a small world
 * with tools/world-copy.js upload, reads it back the way pages do, and checks sw.js's choice between the game server and the copy.
 *   node tools/world-copy-test.js            (WORLD=<dir>/<rsig>/<tip> also copies a real built world and times it) */
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http'), zlib = require('zlib');
const ROOT = path.join(__dirname, '..');
let fails = 0, n = 0;
function ok(c, what) { n++; if (!c) { fails++; console.log('FAIL ' + what); } }

/* an R2 bucket in memory: get (with range), head, put, delete */
function memR2() {
  const M = new Map();
  async function bytesOf(v) {
    if (v == null) return Buffer.alloc(0);
    if (typeof v === 'string') return Buffer.from(v);
    if (Buffer.isBuffer(v) || v instanceof Uint8Array) return Buffer.from(v);
    if (v instanceof ArrayBuffer) return Buffer.from(new Uint8Array(v));
    if (v.getReader) { const parts = []; const r = v.getReader(); for (;;) { const x = await r.read(); if (x.done) break; parts.push(Buffer.from(x.value)); } return Buffer.concat(parts); }
    throw new Error('put: unknown body');
  }
  function obj(key, buf) {
    return { key, size: buf.length, body: new ReadableStream({ start(c) { c.enqueue(new Uint8Array(buf)); c.close(); } }), text: async () => buf.toString('utf8'), arrayBuffer: async () => buf };
  }
  return {
    M, ops: { a: 0, b: 0 },
    async get(key, o) { this.ops.b++; const v = M.get(key); if (!v) return null; const r = o && o.range; return obj(key, r ? v.subarray(r.offset, r.offset + r.length) : v); },
    async head(key) { this.ops.b++; const v = M.get(key); return v ? { key, size: v.length } : null; },
    async put(key, v) { this.ops.a++; const b = await bytesOf(v); M.set(key, b); return { key, size: b.length }; },
    async delete(k) { (Array.isArray(k) ? k : [k]).forEach(x => M.delete(x)); }
  };
}

async function serveWorker(worker, env) {
  const srv = http.createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : null;
    const r = await worker.fetch(new Request('http://127.0.0.1:' + srv.address().port + req.url, { method: req.method, headers: req.headers, body: body && req.method !== 'GET' && req.method !== 'HEAD' ? body : undefined, duplex: 'half' }), env);
    const h = {}; r.headers.forEach((v, k) => { h[k] = v; });
    res.writeHead(r.status, h);
    res.end(r.body ? Buffer.from(await r.arrayBuffer()) : undefined);
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  return { srv, base: 'http://127.0.0.1:' + srv.address().port };
}

function fakeWorld(root, rsig, tip) {
  const d = path.join(root, rsig, String(tip));
  const put = (rel, v, gz) => { const f = path.join(d, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); const s = JSON.stringify(v); fs.writeFileSync(f, s); if (gz) fs.writeFileSync(f + '.gz', zlib.gzipSync(s)); };
  put('manifest.json', { v: 1, rsig, tip, parts: 1 }, true);
  put('part-000.json', { pets: Array.from({ length: 300 }, (_, i) => ({ id: i, tip })) }, true);
  put('view/summary.json', { v: 3, tip, rsig }, true);
  put('view/own/' + 'ab'.repeat(32) + '.json', { v: 3, tip, ids: [1, 2, 3] });
  put('view/p/00001.json', { v: 3, tip, pets: [] });
  put('graves/counts.json', { dead: 4 });
  return d;
}

async function loadWorker() { const src = fs.readFileSync(path.join(ROOT, 'cloud', 'world', 'worker.js'), 'utf8'); return import('data:text/javascript,' + encodeURIComponent(src)); }
module.exports = { memR2, serveWorker, loadWorker };
if (require.main === module) (async () => {
  const W = await loadWorker();
  const worker = W.default, env = { WORLD: memR2(), MIRROR_KEY: 'k'.repeat(40) };
  const { srv, base } = await serveWorker(worker, env);
  process.env.WORLD_COPY_URL = base; process.env.MIRROR_KEY = env.MIRROR_KEY;
  const C = require('./world-copy.js');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wcopy-'));
  const RA = 'r' + 'a'.repeat(32), RB = 'r' + 'b'.repeat(32);
  try {
    /* nothing yet */
    let r = await fetch(base + '/xp/v1/world/latest.json'); let j = await r.json();
    ok(r.status === 200 && j.ready === false, 'empty copy answers ready:false');
    ok((await fetch(base + '/xp/v1/world/' + RA + '/latest.json')).status === 404, 'unknown rules -> 404');
    ok((await fetch(base + '/m/publish', { method: 'POST', body: '{}' })).status === 403, 'write without key is refused');
    ok((await fetch(base + '/m/w/' + RA + '/1.pack', { method: 'PUT', body: 'x', headers: { 'x-mirror-key': 'nope' } })).status === 403, 'write with a wrong key is refused');

    /* copy one world, read it back as a page would */
    const d1 = fakeWorld(tmp, RA, 977400);
    const up = await C.upload(d1);
    ok(up.files === 6, 'all 6 files packed (got ' + up.files + ')');
    ok(env.WORLD.ops.a <= 6, 'a world costs a handful of writes (got ' + env.WORLD.ops.a + ')');
    j = await (await fetch(base + '/xp/v1/world/latest.json')).json();
    ok(j.rsig === RA && j.tip === 977400 && j.copy === 1, 'latest names the copied world');
    ok(j.manifest === base + '/xp/v1/world/' + RA + '/977400/manifest.json', 'manifest is an absolute URL on the copy');
    for (const rel of ['manifest.json', 'part-000.json', 'view/summary.json', 'view/own/' + 'ab'.repeat(32) + '.json', 'view/p/00001.json', 'graves/counts.json']) {
      const res = await fetch(base + '/xp/v1/world/' + RA + '/977400/' + rel);
      const got = Buffer.from(await res.arrayBuffer());
      ok(res.status === 200 && got.equals(fs.readFileSync(path.join(d1, rel))), 'same bytes back: ' + rel);
      ok(res.headers.get('access-control-allow-origin') === '*', 'CORS open: ' + rel);
    }
    r = await fetch(base + '/xp/v1/world/' + RA + '/977400/part-000.json');
    ok(/immutable/.test(r.headers.get('cache-control') || ''), 'world files are immutable');
    r = await fetch(base + '/xp/v1/world/' + RA + '/977400/manifest.json');
    ok(!/immutable/.test(r.headers.get('cache-control') || ''), 'manifest is not immutable (same as the server)');
    /* a client that does not take gzip gets plain JSON */
    const plain = await new Promise((res, rej) => http.get(base + '/xp/v1/world/' + RA + '/977400/view/summary.json', { headers: { 'accept-encoding': 'identity' } }, x => { const b = []; x.on('data', c => b.push(c)); x.on('end', () => res({ h: x.headers, b: Buffer.concat(b) })); }).on('error', rej));
    ok(!plain.h['content-encoding'] && JSON.parse(plain.b).tip === 977400, 'plain JSON without gzip');
    ok((await fetch(base + '/xp/v1/world/' + RA + '/977400/view/nope.json')).status === 404, 'missing file -> 404');
    ok((await fetch(base + '/xp/v1/world/' + RA + '/977400/../keep.json')).status === 404, 'no path tricks');
    ok((await fetch(base + '/xp/v1/world/' + RA + '/977401/manifest.json')).status === 404, 'other tip -> 404');

    /* a published world never changes */
    r = await fetch(base + '/m/w/' + RA + '/977400.pack', { method: 'PUT', body: 'x', headers: { 'x-mirror-key': env.MIRROR_KEY } });
    ok(r.status === 409, 'republishing the same world is refused');
    /* an index that does not match its pack is refused */
    await fetch(base + '/m/w/' + RA + '/977500.pack', { method: 'PUT', body: 'abc', headers: { 'x-mirror-key': env.MIRROR_KEY } });
    r = await fetch(base + '/m/w/' + RA + '/977500.txt', { method: 'PUT', body: 'manifest.json 0 5\n', headers: { 'x-mirror-key': env.MIRROR_KEY } });
    ok(r.status === 400, 'index longer than its pack is refused');
    r = await fetch(base + '/m/w/' + RA + '/977500.txt', { method: 'PUT', body: '../x.json 0 3\n', headers: { 'x-mirror-key': env.MIRROR_KEY } });
    ok(r.status === 400, 'index with a bad path is refused');

    /* keep 3 worlds per rules, 2 rules; the per-rules pointer survives a newer rules' latest */
    for (const t of [977406, 977412, 977418]) await C.upload(fakeWorld(tmp, RA, t));
    let st = await (await fetch(base + '/status')).json();
    ok(st.kept.length === 3 && st.kept.every(w => w.tip >= 977406), 'oldest world dropped, 3 kept');
    ok(!env.WORLD.M.has('w/' + RA + '/977400.pack') && !env.WORLD.M.has('w/' + RA + '/977400.txt'), 'dropped world deleted from storage');
    await C.upload(fakeWorld(tmp, RB, 977418));
    j = await (await fetch(base + '/xp/v1/world/latest.json')).json();
    ok(j.rsig === RB, 'latest follows the newest rules');
    j = await (await fetch(base + '/xp/v1/world/' + RA + '/latest.json')).json();
    ok(j.rsig === RA && j.tip === 977418, 'previous rules keep their own pointer');
    const RC = 'r' + 'c'.repeat(32);
    await C.upload(fakeWorld(tmp, RC, 977424));
    st = await (await fetch(base + '/status')).json();
    ok(!st.kept.some(w => w.rsig === RA) && (await fetch(base + '/xp/v1/world/' + RA + '/latest.json')).status === 404, 'third rules signature drops the oldest one');

    if (process.env.WORLD) {
      const t0 = Date.now(); const big = await C.upload(process.env.WORLD);
      console.log('real world: ' + big.files + ' files, ' + (big.bytes / 1e6).toFixed(1) + ' MB, ' + Math.round((Date.now() - t0) / 1000) + ' s');
      const l = await (await fetch(base + '/xp/v1/world/' + big.rsig + '/latest.json')).json();
      const own = fs.readdirSync(path.join(process.env.WORLD, 'view', 'own')).filter(f => /\.json$/.test(f)).slice(0, 50);
      let same = 0; for (const f of own) { const b = Buffer.from(await (await fetch(l.manifest.replace(/manifest\.json$/, 'view/own/' + f))).arrayBuffer()); if (b.equals(fs.readFileSync(path.join(process.env.WORLD, 'view', 'own', f)))) same++; }
      ok(same === own.length, 'real world owner pages read back (' + same + '/' + own.length + ')');
    }
  } finally { srv.close(); fs.rmSync(tmp, { recursive: true, force: true }); }

  /* sw.js: which latest.json a page gets */
  global.self = { addEventListener() {}, location: { origin: 'https://xcpets.fun' } };
  delete require.cache[require.resolve('../sw.js')]; require('../sw.js');
  const S = global.self.__sw;
  const node = (tip, rsig, ok2) => ({ res: { ok: ok2 !== false }, json: { rsig: rsig || RA, tip, manifest: '/m' } });
  const copy = (tip, rsig) => ({ rsig: rsig || RA, tip, manifest: 'https://copy/m' });
  ok(S.pickLatest(node(100), copy(100)) === 'node', 'server current: server');
  ok(S.pickLatest(node(100), copy(105)) === 'node', 'copy 5 ahead: still the server');
  ok(S.pickLatest(node(100), copy(106)) === 'copy', 'server world 6+ behind the copy: copy');
  ok(S.pickLatest(null, copy(90)) === 'copy', 'server down: copy');
  ok(S.pickLatest(node(100, RA, false), copy(90)) === 'copy', 'server error (e.g. no world for these rules): copy');
  ok(S.pickLatest(node(100, RB), copy(300)) === 'node', 'different rules: server');
  ok(S.pickLatest(node(100), null) === 'node' && S.pickLatest(null, null) === 'node', 'no copy: server');
  ok(S.isLatest(new URL('https://node.xcpets.fun/xp/v1/world/latest.json')) && S.isLatest(new URL('https://node.xcpets.fun/xp/v1/world/' + RA + '/latest.json')), 'latest paths recognised');
  ok(!S.isLatest(new URL('https://node.xcpets.fun/xp/v1/world/' + RA + '/977400/manifest.json')), 'world files are not latest');
  ok(S.isWorldFile(new URL('https://copy.example/xp/v1/world/' + RA + '/977400/view/p/00001.json')), 'copy world files are cached like the server\'s');

  console.log((fails ? fails + ' FAILED' : 'all passed') + ' (' + n + ' checks)');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
