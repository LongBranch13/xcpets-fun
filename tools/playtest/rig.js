/* Play-test rig (Nov 25 2026, Jake: "there are just too many bugs, it's overwhelming"). Same as tools/layout-check/rig.js (the real fast
 * world built from api/boot.json, served like node.xcpets.fun, this checkout served like xcpets.fun, nothing reaches the internet), plus a
 * pretend chain the robot can move forward, so a burn the robot "signs" lands in a block exactly like a real one and the page has to
 * notice it, catch up and show the result (hatch reveal, the away card, Fire Sale banners...):
 *
 *   POST /_t/mempool  { burns: [{ source, tag, qty }] }   burns waiting in the mempool (the page's "pending" view)
 *   POST /_t/block    { burns: [...], hash? }              mine one block at tip+1 with these burns (and the mempool's)
 *   GET  /_t/state                                        { tip, rows, added }
 *   POST /_t/world                                        rebuild the published world at the current tip (like the server every 6 blocks, ~2-3 min)
 *   GET  /_t/truth?me=<addr>                              the full-replay referee at the current tip (tools/playtest/oracle.js, cached)
 *
 * The control routes only exist on this local test server. Nothing is signed: burns are plain rows the robot made up.
 *   node tools/playtest/rig.js [--port 8080] [--sync-port 8125] [--data /tmp/xcpets-playtest-rig]
 * Prints "ready" when both servers are up. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), http = require('http'), os = require('os'), crypto = require('crypto');
const A = process.argv.slice(2), opt = (k, d) => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : d; };
const ROOT = path.resolve(__dirname, '../..'), PORT = +opt('--port', 8080), SPORT = +opt('--sync-port', 8125);
const DATA = path.resolve(opt('--data', path.join(os.tmpdir(), 'xcpets-playtest-rig')));
const S = require(path.join(ROOT, 'tools/sync-server/snapshot')), I = require(path.join(ROOT, 'tools/sync-server/index'));
const { createServer } = require(path.join(ROOT, 'tools/sync-server/server'));
const oracle = require('./oracle'), truths = {};
process.on('uncaughtException', e => console.error('rig: ' + String(e && e.message || e).split('\n')[0]));
const hex = s => Buffer.from(String(s), 'utf8').toString('hex');
(async () => {
  const boot = JSON.parse(fs.readFileSync(path.join(ROOT, 'api/boot.json'), 'utf8'));
  const hc = { window: {} }; hc.window.window = hc.window; vm.createContext(hc); vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/block-hashes.js'), 'utf8'), hc);
  const hashes = Object.assign({}, hc.window.XCPETS_BLOCK_HASHES || {}, boot.hashes);
  const tip0 = boot.tip || Math.max(...boot.rows.map(r => r.block_index));
  const rsig = S.rulesSig(S.loadBytes(ROOT));
  let latest = null; try { latest = JSON.parse(fs.readFileSync(path.join(DATA, 'world', 'latest.json'), 'utf8')); } catch (e) {}
  if (!latest || latest.rsig !== rsig || latest.tip !== tip0) {
    console.log('rig: building the world at block ' + tip0 + ' (about 2-3 minutes)');
    fs.rmSync(DATA, { recursive: true, force: true });
    const out = path.join(DATA, 'world', 'pending');
    const b = await S.buildSnapshot({ rows: boot.rows, hashes, tip: tip0, dex: boot.dex, outDir: out, compress: false, inSigOf: o => S.chainInSig(o.rows, o.hashes, o.tip, o.dex) });
    const wdir = path.join(DATA, 'world', b.rsig, String(tip0)); fs.mkdirSync(path.dirname(wdir), { recursive: true }); fs.renameSync(out, wdir);
    latest = { v: 1, rsig: b.rsig, tip: tip0, manifest: '/xp/v1/world/' + b.rsig + '/' + tip0 + '/manifest.json' };
    I.writeLatest(DATA, latest);
  }
  const rows = boot.rows.slice();
  let txi = Math.max(...rows.map(r => r.tx_index || 0)) + 1, gen = 0;
  const state = { tip: tip0, coreHeight: tip0, lag: 0, ready: true, upstream: 'public', world: { tip: tip0 }, rows, hashes, dex: boot.dex, tipHash: hashes[tip0] || '', mempool: [], mempoolGen: 0, added: [] };
  const rowOf = (b, blk) => ({ tx_index: txi++, tx_hash: crypto.createHash('sha256').update('playtest' + txi + JSON.stringify(b)).digest('hex'), block_index: blk, source: b.source, asset: 'XCPETS', quantity: Math.round(Number(b.qty) * 1e8), tag: hex(b.tag), status: 'valid' });
  function mine(burns, hash) {
    const blk = state.tip + 1, list = state.mempool.splice(0).concat((burns || []).map(b => rowOf(b, blk)));
    list.forEach(r => { r.block_index = blk; delete r.mempool; });
    rows.unshift.apply(rows, list.slice().reverse()); /* boot rows are newest first */
    hashes[blk] = hash && /^[0-9a-f]{64}$/.test(hash) ? hash : '0000000000000000000' + crypto.createHash('sha256').update('playtest-block-' + blk).digest('hex').slice(19);
    state.tip = state.coreHeight = blk; state.tipHash = hashes[blk]; state.added.push({ block: blk, n: list.length }); state.mempoolGen++;
    return { tip: blk, hash: hashes[blk], rows: list.length };
  }
  const api = createServer({ getState: () => state, dataDir: DATA, ratePer10s: 1e6 }).server;
  /* wrap the real sync server: the /_t/ routes first, everything else is the real thing */
  const real = api.listeners('request').slice(); api.removeAllListeners('request');
  api.on('request', (q, r) => {
    if (!q.url.startsWith('/_t/')) return real.forEach(f => f(q, r));
    const done = (o) => { r.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); r.end(JSON.stringify(o)); };
    if (q.url.startsWith('/_t/truth')) {
      const me = new URL(q.url, 'http://x').searchParams.get('me') || '', key = state.tip + '|' + me;
      if (!truths[key]) truths[key] = oracle({ rows: rows.slice(), hashes: Object.assign({}, hashes), tip: state.tip, dex: state.dex, me }).catch(e => ({ error: String(e && e.message || e) }));
      return truths[key].then(done);
    }
    if (q.method === 'GET') return done({ tip: state.tip, rows: rows.length, added: state.added, mempool: state.mempool.length });
    let body = ''; q.on('data', d => { body += d; }); q.on('end', () => {
      let j = {}; try { j = JSON.parse(body || '{}'); } catch (e) {}
      if (q.url.startsWith('/_t/mempool')) { (j.burns || []).forEach(b => { const x = rowOf(b, state.tip + 1); x.mempool = true; state.mempool.push(x); }); state.mempoolGen++; return done({ mempool: state.mempool.length }); }
      if (q.url.startsWith('/_t/block')) return done(mine(j.burns, j.hash));
      if (q.url.startsWith('/_t/world')) {
        const f = path.join(DATA, 'build-input.json'); fs.writeFileSync(f, JSON.stringify({ rows, hashes, tip: state.tip, dex: state.dex }));
        const ch = require('child_process').spawn(process.execPath, ['--max-old-space-size=6000', path.join(__dirname, 'build-world.js'), f, DATA], { stdio: ['ignore', 'pipe', 'inherit'] });
        let o = ''; ch.stdout.on('data', d => { o += d; }); ch.on('exit', c => { state.world = { tip: state.tip }; done(c ? { error: 'build failed ' + c } : JSON.parse(o.trim().split('\n').pop())); });
        return;
      }
      done({ error: 'unknown' });
    });
  });
  api.listen(SPORT, '127.0.0.1');
  const T = { html: 'text/html', js: 'text/javascript', css: 'text/css', json: 'application/json', png: 'image/png', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp', woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', mp3: 'audio/mpeg', ico: 'image/x-icon', txt: 'text/plain' };
  http.createServer((q, r) => {
    let p = path.normalize(path.join(ROOT, decodeURIComponent(q.url.split('?')[0])));
    if (!p.startsWith(ROOT)) { r.writeHead(403); return r.end(); }
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
    if (!fs.existsSync(p)) { r.writeHead(404); return r.end('missing'); }
    r.writeHead(200, { 'content-type': T[p.split('.').pop()] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(p).pipe(r);
  }).listen(PORT, '127.0.0.1', () => console.log('ready: pages http://127.0.0.1:' + PORT + ' , world http://127.0.0.1:' + SPORT + ' (block ' + tip0 + ')'));
})().catch(e => { console.error(e); process.exit(1); });
