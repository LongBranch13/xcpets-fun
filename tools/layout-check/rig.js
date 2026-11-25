/* Local rig for tools/layout-check (Nov 25 2026): builds the fast world from api/boot.json the same way the game server does
 * (tools/sync-server/snapshot.js, ~2.5 min, cached in --data until boot.json or the rules change), then serves it like
 * node.xcpets.fun on 127.0.0.1:<--sync-port> and this checkout like xcpets.fun on 127.0.0.1:<--port>. Nothing reaches the internet.
 *   node tools/layout-check/rig.js [--port 8080] [--sync-port 8125] [--data /tmp/xcpets-layout-rig]
 * Prints "ready" when both are up. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), http = require('http'), os = require('os');
const A = process.argv.slice(2), opt = (k, d) => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : d; };
const ROOT = path.resolve(__dirname, '../..'), PORT = +opt('--port', 8080), SPORT = +opt('--sync-port', 8125);
const DATA = path.resolve(opt('--data', path.join(os.tmpdir(), 'xcpets-layout-rig')));
const S = require(path.join(ROOT, 'tools/sync-server/snapshot')), I = require(path.join(ROOT, 'tools/sync-server/index'));
const { createServer } = require(path.join(ROOT, 'tools/sync-server/server'));
process.on('uncaughtException', e => console.error('rig: ' + String(e && e.message || e).split('\n')[0]));
(async () => {
  const boot = JSON.parse(fs.readFileSync(path.join(ROOT, 'api/boot.json'), 'utf8'));
  const hc = { window: {} }; hc.window.window = hc.window; vm.createContext(hc); vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/block-hashes.js'), 'utf8'), hc);
  const hashes = Object.assign({}, hc.window.XCPETS_BLOCK_HASHES || {}, boot.hashes);
  const tip = boot.tip || Math.max(...boot.rows.map(r => r.block_index));
  const rsig = S.rulesSig(S.loadBytes(ROOT));
  let latest = null; try { latest = JSON.parse(fs.readFileSync(path.join(DATA, 'world', 'latest.json'), 'utf8')); } catch (e) {}
  if (!latest || latest.rsig !== rsig || latest.tip !== tip) {
    console.log('rig: building the world at block ' + tip + ' (about 2-3 minutes)');
    fs.rmSync(DATA, { recursive: true, force: true });
    const out = path.join(DATA, 'world', 'pending');
    const b = await S.buildSnapshot({ rows: boot.rows, hashes, tip, dex: boot.dex, outDir: out, compress: false, inSigOf: o => S.chainInSig(o.rows, o.hashes, o.tip, o.dex) });
    const wdir = path.join(DATA, 'world', b.rsig, String(tip)); fs.mkdirSync(path.dirname(wdir), { recursive: true }); fs.renameSync(out, wdir);
    latest = { v: 1, rsig: b.rsig, tip, manifest: '/xp/v1/world/' + b.rsig + '/' + tip + '/manifest.json' };
    I.writeLatest(DATA, latest);
  }
  const state = { tip, coreHeight: tip, lag: 0, ready: true, upstream: 'public', world: { tip }, rows: boot.rows, hashes, dex: boot.dex, tipHash: hashes[tip] || '' };
  createServer({ getState: () => state, dataDir: DATA, ratePer10s: 1e6 }).server.listen(SPORT, '127.0.0.1');
  const T = { html: 'text/html', js: 'text/javascript', css: 'text/css', json: 'application/json', png: 'image/png', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp', woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', mp3: 'audio/mpeg', ico: 'image/x-icon', txt: 'text/plain' };
  http.createServer((q, r) => {
    let p = path.normalize(path.join(ROOT, decodeURIComponent(q.url.split('?')[0])));
    if (!p.startsWith(ROOT)) { r.writeHead(403); return r.end(); }
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
    if (!fs.existsSync(p)) { r.writeHead(404); return r.end('missing'); }
    r.writeHead(200, { 'content-type': T[p.split('.').pop()] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(p).pipe(r);
  }).listen(PORT, '127.0.0.1', () => console.log('ready: pages http://127.0.0.1:' + PORT + ' , world http://127.0.0.1:' + SPORT + ' (block ' + tip + ')'));
})().catch(e => { console.error(e); process.exit(1); });
