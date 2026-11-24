'use strict';
/* HTTP surface for xcpets-sync. GET (incl. /xp/v1/shop, Spam City's order book, /xp/v1/pet/<id> share links and cards), HEAD and OPTIONS, plus POST for /xp/v1/check only (the burn check, Nov 23 2026). Other POSTs, PUT
 * and DELETE are 405. */
const http = require('http'), fs = require('fs'), path = require('path'), zlib = require('zlib'), { URL } = require('url');
const { buildAnswer } = require('./answer');
const { hostKind } = require('./client');
const { clientIp } = require('./net');
const { answer: graveAnswer } = require('./graves');
const share = require('./share');
function rateLimit(max) { const hits = new Map(); return function (ip) { const now = Date.now(), slot = hits.get(ip) || { t: now, n: 0 };
  if (now - slot.t > 10000) { slot.t = now; slot.n = 0; } slot.n++; hits.set(ip, slot); return slot.n <= max; }; }
function cors(res) { res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS'); res.setHeader('Access-Control-Expose-Headers', 'ETag'); res.setHeader('Vary', 'Accept-Encoding'); }
function send(req, res, status, body, headers) {
  cors(res); Object.keys(headers || {}).forEach(k => res.setHeader(k, headers[k]));
  if (req.method === 'HEAD') { res.writeHead(status); res.end(); return; }
  const raw = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  const enc = String(req.headers['accept-encoding'] || '');
  const zip = (buf, name, fn) => { fn(buf, (err, out) => { if (err || !out) { res.setHeader('Content-Type', headers && headers['Content-Type'] || 'application/json; charset=utf-8'); res.writeHead(status); res.end(raw); return; }
    res.setHeader('Content-Encoding', name); res.writeHead(status); res.end(out); }); };
  if (/\bbr\b/.test(enc)) return zip(raw, 'br', (b, cb) => zlib.brotliCompress(b, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }, cb));
  if (/\bgzip\b/.test(enc)) return zip(raw, 'gzip', (b, cb) => zlib.gzip(b, cb));
  res.writeHead(status); res.end(raw);
}
function viewRel(parts) {
  if (parts[2] !== 'view') return null;
  if (parts.length === 4 && (parts[3] === 'summary.json' || parts[3] === 'zombies.json' || parts[3] === 'rank.json' || parts[3] === 'owners.json')) return path.join('view', parts[3]);
  if (parts.length === 5 && parts[3] === 'o' && /^[0-9a-f]{2}\.json$/.test(parts[4])) return path.join('view', 'o', parts[4]);
  if (parts.length === 5 && parts[3] === 'own' && /^[0-9a-f]{64}(?:\.\d+|\.d(?:\.\d+)?)?\.json$/.test(parts[4])) return path.join('view', 'own', parts[4]);
  if (parts.length === 5 && parts[3] === 'p' && /^\d{5}\.json$/.test(parts[4])) return path.join('view', 'p', parts[4]);
  return null;
}
function worldFile(dataDir, parts) {
  if (!parts || parts.length < 3) return null;
  const rsig = parts[0], tip = parts[1];
  if (!/^r[0-9a-f]{32}$/.test(rsig) || !/^\d+$/.test(tip)) return null;
  let rel = null;
  if (parts.length === 3) {
    const file = parts[2];
    /* Checkpoint files (cp-root, cp-meta, cp-part-NNN) are the stale catch-up download. Same names only: no extra suffix, no other cp- file. */
    if (file === 'manifest.json' || file === 'root.json' || file === 'latest.json' || file === 'cp-root.json' || file === 'cp-meta.json' || /^part-\d{3}\.json$/.test(file) || /^cp-part-\d{3}\.json$/.test(file)) rel = file;
  } else rel = viewRel(parts);
  if (!rel) return null;
  const root = path.join(dataDir, 'world');
  const p = path.join(root, rsig, tip, rel);
  if (!p.startsWith(root + path.sep)) return null;
  return p;
}
/* POST /xp/v1/check body: { plans: [{ tag, amount?, anchor?, ... }], me, pending: [tag] }, sent as text/plain (no CORS preflight).
 * Only plain values are passed on, at most 100 plans of 16 fields; the answer is never cached. */
function cleanPlan(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
  const o = {}; let n = 0;
  for (const k of Object.keys(p)) { const v = p[k]; if (++n > 16) break; if (typeof v === 'string' ? v.length <= 400 : (typeof v === 'number' && isFinite(v)) || typeof v === 'boolean' || v === null) o[k] = v; }
  return typeof o.tag === 'string' && o.tag ? o : null;
}
function checkBody(raw) {
  let j; try { j = JSON.parse(raw); } catch (e) { return null; }
  if (!j || !Array.isArray(j.plans) || !j.plans.length || j.plans.length > 100) return null;
  const plans = j.plans.map(cleanPlan); if (plans.some(p => !p)) return null;
  const me = typeof j.me === 'string' && j.me.length <= 100 ? j.me : '';
  const pending = Array.isArray(j.pending) ? j.pending.filter(t => typeof t === 'string' && t.length <= 400).slice(0, 200) : [];
  return { plans, me, pending };
}
function createServer(opts) {
  const getState = opts.getState, dataDir = opts.dataDir || path.join(require('os').tmpdir(), 'xcpets-sync');
  const allow = rateLimit(opts.ratePer10s || +(process.env.XP_RATE_PER_10S || 60));
  /* pet share links and cards (share.js): GET /xp/v1/pet/<id> and /xp/v1/pet/<id>.png; cards come from the check service (opts.card) */
  const cards = share.makeCards({ dataDir: dataDir, card: opts.card });
  const server = http.createServer((req, res) => {
    const ip = clientIp(req);
    let pathOnly = '/'; try { pathOnly = new URL(req.url, 'http://127.0.0.1').pathname; } catch (e) {}
    /* A first visit fetches every snapshot part. Those files are immutable and are not counted against the short sync limit. */
    const limited = !/^\/xp\/v1\/world\/r[0-9a-f]{32}\/\d+\//.test(pathOnly);
    if (limited && !allow(ip)) { send(req, res, 429, { v: 1, error: 'slow down' }, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); return; }
    if (req.method === 'OPTIONS') { cors(res); res.setHeader('Access-Control-Max-Age', '86400'); res.writeHead(204); res.end(); return; }
    if (req.method === 'POST' && pathOnly.replace(/\/+$/, '') === '/xp/v1/check') {
      const H = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
      if (typeof opts.check !== 'function') { send(req, res, 503, { v: 1, ok: false, error: 'off' }, H); return; }
      let raw = '', big = false;
      req.setEncoding('utf8');
      req.on('data', d => { if (big) return; raw += d; if (raw.length > 65536) { big = true; send(req, res, 413, { v: 1, ok: false, error: 'too big' }, H); } });
      req.on('end', () => {
        if (big) return;
        const body = checkBody(raw); if (!body) { send(req, res, 400, { v: 1, ok: false, error: 'bad request' }, H); return; }
        Promise.resolve(opts.check(body)).then(a => {
          const out = a && a.ok ? { v: 1, ok: true, tip: a.tip, rsig: a.rsig || '', plans: a.plans || [], skip: a.skip || [] } : { v: 1, ok: false, error: (a && a.error) || 'not ready' };
          send(req, res, 200, out, H);
        }, () => send(req, res, 200, { v: 1, ok: false, error: 'failed' }, H));
      });
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { cors(res); res.setHeader('Allow', 'GET, HEAD, OPTIONS'); res.writeHead(405); res.end(); return; }
    let u; try { u = new URL(req.url, 'http://127.0.0.1'); } catch (e) { send(req, res, 400, { v: 1, error: 'bad url' }); return; }
    const p = u.pathname.replace(/\/+$/, '') || '/';
    if (share.handle(req, res, p, cards, send)) return;
    /* Spam City's order book (Nov 23 2026): listings, the pets they name, pet tokens and dex orders from the check service's world,
     * the same pack the shop page used to rebuild with a full replay in the browser. The page uses it only when its tip and rsig match. */
    if (p === '/xp/v1/shop') {
      const H = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=20' };
      if (typeof opts.shop !== 'function') { send(req, res, 200, { v: 1, ok: false, error: 'off' }, Object.assign({}, H, { 'Cache-Control': 'no-store' })); return; }
      Promise.resolve(opts.shop()).then(a => {
        if (!a || !a.ok) { send(req, res, 200, { v: 1, ok: false, error: (a && a.error) || 'not ready' }, Object.assign({}, H, { 'Cache-Control': 'no-store' })); return; }
        send(req, res, 200, { v: 1, ok: true, tip: a.tip, rsig: a.rsig || '', listings: a.listings || [], pets: a.pets || [], deeds: a.deeds || {}, orders: a.orders || [], n: a.n || 0, open: a.open || 0 }, H);
      }, () => send(req, res, 200, { v: 1, ok: false, error: 'failed' }, Object.assign({}, H, { 'Cache-Control': 'no-store' })));
      return;
    }
    if (p === '/xp/v1/health') {
      const s = getState() || {};
      const body = { tip: s.tip || 0, coreHeight: s.coreHeight || 0, lag: s.lag || 0, lastBlockAt: s.lastBlockAt || null, lastSnapshotTip: s.world && s.world.tip || 0, snapshotLag: s.ready ? Math.max(0, (s.tip || 0) - ((s.world && s.world.tip) || 0)) : null, upstream: s.upstream === 'private' ? 'private' : 'public' };
      try { if (typeof s.snap === 'function') body.builder = s.snap(); } catch (e) { } /* numbers and short codes only, no paths */
      try { if (typeof s.rules === 'function') body.rules = s.rules(); } catch (e) { } /* main commit and rsig the builder follows (public) */
      if (s.world && s.world.rsig) body.worldRsig = s.world.rsig;
      try { if (typeof s.check === 'function') body.check = s.check(); } catch (e) { } /* burn check service: state, tip, load time, memory (numbers only) */
      try { if (typeof s.mem === 'function') body.mem = s.mem(); } catch (e) { }
      try { if (typeof s.loop === 'function') body.loop = s.loop(); } catch (e) { } /* follow-loop heartbeat (seconds and short codes only): a frozen follower shows here */
      send(req, res, 200, body, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=5' }); return;
    }
    if (p === '/xp/v1/sync') {
      const q = {}; u.searchParams.forEach((v, k) => { if (q[k] == null) q[k] = v; });
      const ans = buildAnswer(getState(), q);
      const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': ans.status === 200 ? 'public, max-age=5, stale-while-revalidate=20' : 'no-store' };
      if (ans.etag) headers.ETag = ans.etag;
      if (ans.etag && req.headers['if-none-match'] === ans.etag) { cors(res); Object.keys(headers).forEach(k => res.setHeader(k, headers[k])); res.writeHead(304); res.end(); return; }
      send(req, res, ans.status, ans.body, headers); return;
    }
    if (p === '/xp/v1/graves' || p === '/xp/v1/graves/counts') {
      const latestFile = path.join(dataDir, 'world', 'latest.json');
      let latest = null; try { latest = JSON.parse(fs.readFileSync(latestFile, 'utf8')); } catch (e) { latest = null; }
      const gdir = latest && latest.rsig && latest.tip != null ? path.join(dataDir, 'world', latest.rsig, String(latest.tip), 'graves') : '';
      if (!gdir || !fs.existsSync(path.join(gdir, 'counts.json'))) { send(req, res, 404, { v: 1, error: 'no grave index' }, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); return; }
      if (p === '/xp/v1/graves/counts') {
        send(req, res, 200, fs.readFileSync(path.join(gdir, 'counts.json')), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=30' }); return;
      }
      const n = k => { const v = u.searchParams.get(k); return v == null || v === '' ? undefined : (/^-?\d+$/.test(v) ? +v : v); };
      const flag = k => u.searchParams.get(k) === '1' || u.searchParams.get(k) === 'true';
      const q = { page: n('page') || 0, per: n('per') || 60, sort: u.searchParams.get('sort') || 'newest', tier: n('tier'), stage: n('stage'), diff: u.searchParams.get('diff') || '', sp: u.searchParams.get('sp') || '', meals: u.searchParams.get('meals') || '', text: u.searchParams.get('text') || u.searchParams.get('q') || '', owner: u.searchParams.get('owner') || '', mine: flag('mine'), raisable: flag('raisable'), open: flag('open'), minDays: n('minDays'), maxDays: n('maxDays') };
      let body; try { body = graveAnswer(gdir, q); } catch (e) { send(req, res, 500, { v: 1, error: 'grave index' }, { 'Content-Type': 'application/json; charset=utf-8' }); return; }
      send(req, res, 200, body, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=15' }); return;
    }
    if (p === '/xp/v1/world/latest.json') {
      const f = path.join(dataDir, 'world', 'latest.json');
      if (!fs.existsSync(f)) { send(req, res, 404, { v: 1, ready: false }); return; }
      send(req, res, 200, fs.readFileSync(f), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=5' }); return;
    }
    /* the newest world built with one rules signature (see writeLatest in index.js) */
    const perRsig = /^\/xp\/v1\/world\/(r[0-9a-f]{32})\/latest\.json$/.exec(p);
    if (perRsig) {
      const f = path.join(dataDir, 'world', perRsig[1], 'latest.json');
      if (!fs.existsSync(f)) { send(req, res, 404, { v: 1, ready: false }, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=5' }); return; }
      send(req, res, 200, fs.readFileSync(f), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=5' }); return;
    }
    if (p.indexOf('/xp/v1/world/') === 0) {
      const rest = p.slice('/xp/v1/world/'.length).split('/');
      const file = worldFile(dataDir, rest);
      if (!file || !fs.existsSync(file)) { send(req, res, 404, { v: 1, error: 'missing' }); return; }
      const immutable = !/manifest\.json$/.test(file);
      const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=5' };
      const enc = String(req.headers['accept-encoding'] || '');
      if (immutable && /\bbr\b/.test(enc) && fs.existsSync(file + '.br')) { cors(res); Object.keys(headers).forEach(k => res.setHeader(k, headers[k])); res.setHeader('Content-Encoding', 'br'); res.writeHead(200); if (req.method === 'HEAD') res.end(); else fs.createReadStream(file + '.br').pipe(res); return; }
      if (immutable && /\bgzip\b/.test(enc) && fs.existsSync(file + '.gz')) { cors(res); Object.keys(headers).forEach(k => res.setHeader(k, headers[k])); res.setHeader('Content-Encoding', 'gzip'); res.writeHead(200); if (req.method === 'HEAD') res.end(); else fs.createReadStream(file + '.gz').pipe(res); return; }
      cors(res); Object.keys(headers).forEach(k => res.setHeader(k, headers[k])); res.writeHead(200); if (req.method === 'HEAD') res.end(); else fs.createReadStream(file).pipe(res); return;
    }
    send(req, res, 404, { v: 1, error: 'not found' }, { 'Content-Type': 'application/json; charset=utf-8' });
  });
  return { server: server, dataDir: dataDir, hostKind: hostKind };
}
module.exports = { createServer, worldFile };
