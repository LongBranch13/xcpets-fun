'use strict';
/* Outbound fetch timeout and the client address Caddy passes. The sync process listens on
 * loopback, so X-Real-IP / X-Forwarded-For are trusted only from a loopback socket. */
const FETCH_MS = +(process.env.XP_FETCH_MS || 15000);
const { whole } = require('../lib/core-limiter');

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
  return Promise.race([fetch(url, init).then(r => whole(r, late)), late]).finally(() => clearTimeout(t));
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

module.exports = { timedFetch, clientIp, loopback, FETCH_MS };
