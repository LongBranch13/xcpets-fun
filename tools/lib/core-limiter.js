'use strict';
/* feed-rate-limit (2026-10-25): request gate for the CI api feed's Counterparty reads (tools only; no page loads this file).
 * Ideas taken from the XCP org's own clients (see PR / branch notes):
 *   - XCP/extension src/core/counterparty/requestGate.ts: at most 2 in flight, FIFO queue, one shared cooldown per client on 429,
 *     Retry-After honoured (seconds or HTTP date), jitter only ADDED after the server's deadline, default cooldown that doubles.
 *   - XCP/launchpad apps/web/src/lib/api/counterparty.ts: measured on api.counterparty.io: concurrency 1 -> 2.5 useful replies/s,
 *     2 -> 2.0/s, 4+ -> 0/s (all 429). A 429 pauses the WHOLE client, not one path; in-flight reads to the same URL are coalesced.
 *   - XCP/launchpad apps/api/src/integrations/cooldown.ts: READ_LIMIT = 2, DEFAULT_COOLDOWN_MS = 30 s when no Retry-After.
 * Gate is per origin (api.counterparty.io, api.unspendablelabs.com and api.xcp.fun each get their own budget).
 * makeFetch(rawFetch, opts) -> fetch-compatible function. Non-matching URLs pass straight through (only counted). */
const DEF = { conc: 1, rps: 2, maxRetries: 4, defaultCooldownMs: 2000, maxCooldownMs: 30000, maxRetryAfterMs: 120000, jitter: 0.5, timeoutMs: 60000,
  match: u => /:4000\/|api\.xcp\.fun/.test(u) };
function retryAfterMs(v, now) { const t = v == null ? '' : String(v).trim(); if (!t) return null;
  if (/^\d+$/.test(t)) return Number(t) * 1000;
  if (!/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/.test(t)) return null; const d = Date.parse(t); return isFinite(d) ? Math.max(0, d - now) : null; }
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
  async function limited(url, init) {
    const u = typeof url === 'string' ? url : (url && url.url) || String(url);
    if (!o.match(u)) { stats.passthrough++; return rawFetch(url, init); }
    const H = host(u); init = Object.assign({}, init || {}); delete init.signal; /* the caller's short page timer would fire while we wait our turn */
    for (let attempt = 0; ; attempt++) {
      await acquire(H); let r;
      try { await clearance(H); stats.requests++; stats.byHost[H.name] = (stats.byHost[H.name] || 0) + 1;
        const ac = new AbortController(), tm = setTimeout(() => ac.abort(), o.timeoutMs);
        try { r = await rawFetch(u, Object.assign({}, init, { signal: ac.signal })); } finally { clearTimeout(tm); }
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
module.exports = { makeFetch, retryAfterMs, DEF };
