'use strict';
/* feed-rate-limit (2026-10-25): request gate for the CI api feed's Counterparty reads (tools only; no page loads this file).
 * Ideas taken from the XCP org's own clients (see PR / branch notes):
 *   - XCP/extension src/core/counterparty/requestGate.ts: at most 2 in flight, FIFO queue, one shared cooldown per client on 429,
 *     Retry-After honoured (seconds or HTTP date), jitter only ADDED after the server's deadline, default cooldown that doubles.
 *   - XCP/launchpad apps/web/src/lib/api/counterparty.ts: measured on api.counterparty.io: concurrency 1 -> 2.5 useful replies/s,
 *     2 -> 2.0/s, 4+ -> 0/s (all 429). A 429 pauses the WHOLE client, not one path; in-flight reads to the same URL are coalesced.
 *   - XCP/launchpad apps/api/src/integrations/cooldown.ts: READ_LIMIT = 2, DEFAULT_COOLDOWN_MS = 30 s when no Retry-After.
 * Gate is per origin (api.counterparty.io, api.unspendablelabs.com and api.xcp.fun each get their own budget).
 * makeFetch(rawFetch, opts) -> fetch-compatible function. Non-matching URLs skip the queue and pacing (only counted) but keep the header
 * and body time limits (Nov 27 2026). */
const DEF = { conc: 1, rps: 2, maxRetries: 4, defaultCooldownMs: 2000, maxCooldownMs: 30000, maxRetryAfterMs: 120000, jitter: 0.5, timeoutMs: 60000,
  match: u => /:4000\/|api\.xcp\.fun/.test(u) };
function retryAfterMs(v, now) { const t = v == null ? '' : String(v).trim(); if (!t) return null;
  if (/^\d+$/.test(t)) return Number(t) * 1000;
  if (!/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/.test(t)) return null; const d = Date.parse(t); return isFinite(d) ? Math.max(0, d - now) : null; }
/* Nov 24 2026 (second fix): the body is read with an IDLE limit, not the request's short limit. A whole-body limit of 15 s timed out
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
/* kept for callers of the old helper: the late promise only bounds the headers now */
async function whole(r, late, ac) { return readBody(r, ac); }
function makeFetch(rawFetch, o) {
  o = Object.assign({}, DEF, o || {}); const now = o.now || (() => Date.now()), sleep = o.sleep || (ms => new Promise(r => setTimeout(r, ms))), rnd = o.random || Math.random;
  const hosts = {}, stats = { requests: 0, passthrough: 0, byHost: {}, r429: 0, r503: 0, retries: 0, maxInFlight: 0, waitedMs: 0, gaveUp: 0 };
  function host(u) { let h; try { h = new URL(u).origin; } catch (e) { h = String(u).slice(0, 40); }
    return hosts[h] || (hosts[h] = { name: h, inFlight: 0, q: [], nextStart: 0, pausedUntil: 0, refusals: 0 }); }
  function acquire(H) { return new Promise(res => { H.q.push(res); pump(H); }); }
  function pump(H) { while (H.inFlight < o.conc && H.q.length) { H.inFlight++; stats.maxInFlight = Math.max(stats.maxInFlight, H.inFlight); H.q.shift()(); } }
  function release(H) { H.inFlight--; pump(H); }
  async function clearance(H) { for (;;) { const t = now(), w = Math.max(H.pausedUntil - t, H.nextStart - t); if (w <= 0) break; stats.waitedMs += w; await sleep(w); }
    H.nextStart = now() + Math.ceil(1000 / o.rps); }
  /* Nov 27 2026: URLs the gate doesn't pace (the server's Start9 proxy over Tor, mempool.space, ...) used to go to rawFetch with no
   * limit at all. rjs/chain.js stops its own timer at the headers, so a Tor answer whose body stalled held the server's feed job until
   * systemd killed it at 40 minutes, run after run (Nov 26: 4 good runs all day). They still skip the queue and the pacing, but get the
   * same safety limits as paced reads: headers within timeoutMs, then the body under readBody's idle limit. The caller's signal still
   * cancels them (chain.js aborts the losers of its race). */
  async function guarded(url, init) {
    init = Object.assign({}, init || {}); const sig = init.signal, ac = new AbortController(); let tm = null;
    if (sig) { if (sig.aborted) ac.abort(); else if (sig.addEventListener) sig.addEventListener('abort', () => { try { ac.abort(); } catch (e) { } }, { once: true }); }
    const late = new Promise((_, rej) => { tm = setTimeout(() => { try { ac.abort(); } catch (e) { } rej(Object.assign(new Error('timeout after ' + o.timeoutMs + ' ms'), { name: 'TimeoutError' })); }, o.timeoutMs); });
    late.catch(() => { });
    let r; try { r = await Promise.race([rawFetch(url, Object.assign({}, init, { signal: ac.signal })), late]); } finally { clearTimeout(tm); }
    return readBody(r, ac);
  }
  async function limited(url, init) {
    const u = typeof url === 'string' ? url : (url && url.url) || String(url);
    if (!o.match(u)) { stats.passthrough++; return guarded(url, init); }
    const H = host(u); init = Object.assign({}, init || {}); delete init.signal; /* the caller's short page timer would fire while we wait our turn */
    for (let attempt = 0; ; attempt++) {
      await acquire(H); let r;
      try { await clearance(H); stats.requests++; stats.byHost[H.name] = (stats.byHost[H.name] || 0) + 1;
        const ac = new AbortController(); let tm = null;
        /* Nov 24 2026: the timer used to stop at the headers, so a node that sent headers and then stalled the body held
         * r.json() forever (the sync server froze at 977,257 for hours with no error). Headers within the timer, then the body under
         * readBody's idle limit (a big answer that keeps arriving is fine; one that stops sending fails). */
        const late = new Promise((_, rej) => { tm = setTimeout(() => { try { ac.abort(); } catch (e) { } rej(Object.assign(new Error('timeout after ' + o.timeoutMs + ' ms'), { name: 'TimeoutError' })); }, o.timeoutMs); });
        late.catch(() => { });
        try { r = await Promise.race([rawFetch(u, Object.assign({}, init, { signal: ac.signal })), late]); } finally { clearTimeout(tm); }
        r = await readBody(r, ac);
      } finally { release(H); }
      if (r.status !== 429 && r.status !== 503) { H.refusals = 0; return r; }
      stats[r.status === 429 ? 'r429' : 'r503']++;
      const ra = retryAfterMs(r.headers && r.headers.get ? r.headers.get('retry-after') : null, now());
      if (attempt >= o.maxRetries || (ra != null && ra > o.maxRetryAfterMs)) { stats.gaveUp++; return r; } /* hand the refusal to the caller's own logic */
      H.refusals++; const base = ra != null ? ra : Math.min(o.defaultCooldownMs * 2 ** (H.refusals - 1), o.maxCooldownMs);
      H.pausedUntil = Math.max(H.pausedUntil, now() + base + base * o.jitter * rnd()); /* whole host stands down; jitter only adds */
      stats.retries++; try { if (r.body && r.body.cancel) await r.body.cancel(); } catch (e) {}
    }
  }
  limited.stats = stats; limited.opts = o; return limited;
}
module.exports = { makeFetch, retryAfterMs, DEF, whole, readBody };
