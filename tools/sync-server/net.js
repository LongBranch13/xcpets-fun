'use strict';
/* Outbound fetch timeout and the client address Caddy passes. The sync process listens on
 * loopback, so X-Real-IP / X-Forwarded-For are trusted only from a loopback socket. */
const FETCH_MS = +(process.env.XP_FETCH_MS || 15000);
/* Kept here, not imported from tools/lib: server-repair once installed only tools/sync-server.
 * Nov 24 2026 (second fix): the body is read with an IDLE limit, not the request's short limit. A whole-body limit of 15 s timed out
 * the big, slow but steady answers (the sales read's 1,000-row issuance pages from the game server), which the sales code then marked
 * as dead nodes, and every follow step failed. Now: headers within the request's limit; then the body may take as long as it keeps
 * sending bytes, failing only when nothing arrives for BODY_IDLE_MS (default 30 s) or the whole body passes BODY_MAX_MS (5 min). */
function BODY_IDLE_MS() { return +(process.env.XP_BODY_IDLE_MS || 30000); } function BODY_MAX_MS() { return +(process.env.XP_BODY_MAX_MS || 300000); }
function bodyTimeout(what, ms) { return Object.assign(new Error('timeout after ' + ms + ' ms'), { name: 'TimeoutError', what: what }); }
async function readBody(r, ac, idleMs, maxMs) {
  if (!r || typeof Response !== 'function' || !(r instanceof Response) || !r.body || typeof r.body.getReader !== 'function') return r;
  idleMs = idleMs || BODY_IDLE_MS(); maxMs = maxMs || BODY_MAX_MS();
  const rd = r.body.getReader(), parts = [], t0 = Date.now(); let idle = null;
  try {
    for (;;) {
      const left = maxMs - (Date.now() - t0); if (left <= 0) throw bodyTimeout('body', maxMs);
      const wait = Math.min(idleMs, left);
      const rp = rd.read(); rp.catch(() => { });
      const step = await Promise.race([rp, new Promise((_, rej) => { idle = setTimeout(() => rej(bodyTimeout('body idle', wait)), wait); })]).finally(() => clearTimeout(idle));
      if (step.done) break;
      parts.push(step.value);
    }
  } catch (e) { try { ac && ac.abort(); } catch (x) { } try { Promise.resolve(rd.cancel()).catch(() => { }); } catch (x) { } throw e; }
  const nullBody = r.status === 204 || r.status === 205 || r.status === 304;
  return new Response(nullBody ? null : Buffer.concat(parts.map(p => Buffer.from(p.buffer, p.byteOffset, p.byteLength))), { status: r.status, statusText: r.statusText, headers: r.headers });
}

/* Nov 24 2026: the time limit covers the whole answer, body included. It used to end when the headers arrived, so an upstream
 * that sent headers and then stalled (a slow Tor circuit to the game's own node does that) held r.json() forever and froze the
 * follower at 977,257 for hours. The body is read here and handed back as an ordinary Response. */
function timedFetch(url, opts, ms) {
  const limit = ms > 0 ? ms : FETCH_MS;
  const ac = new AbortController();
  let t = null;
  const late = new Promise((_, rej) => { t = setTimeout(() => { try { ac.abort(); } catch (e) {} rej(Object.assign(new Error('timeout after ' + limit + ' ms'), { name: 'TimeoutError' })); }, limit); });
  late.catch(() => {});
  const init = Object.assign({}, opts || {}, { signal: ac.signal });
  /* headers within the limit, then the body under its idle limit */
  return Promise.race([fetch(url, init), late]).then(r => { clearTimeout(t); return readBody(r, ac); }, e => { clearTimeout(t); throw e; });
}

function header(req, name) {
  const v = req.headers && req.headers[name];
  if (v == null) return '';
  return String(Array.isArray(v) ? v[0] : v).split(',')[0].trim();
}
function loopback(addr) {
  addr = String(addr || '');
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}
function clientIp(req) {
  const sock = (req.socket && req.socket.remoteAddress) || '';
  if (loopback(sock)) {
    const real = header(req, 'x-real-ip');
    if (real) return real;
    const xff = header(req, 'x-forwarded-for');
    if (xff) return xff;
  }
  return sock;
}

module.exports = { readBody, timedFetch, clientIp, loopback, FETCH_MS };
