'use strict';
/* Nov 27 2026: the server's feed job hung until systemd's 40-minute kill whenever its Start9 proxy (Tor) sent headers and then
 * stalled the body: that URL is not paced by tools/lib/core-limiter.js, so it went to fetch with no limit at all.
 * Real sockets, no fakes: an unpaced URL whose body stalls must fail within the idle limit, a slow body that keeps sending must
 * still arrive, and the caller's abort must still cancel an unpaced read. */
const http = require('http'), assert = require('assert');
process.env.XP_BODY_IDLE_MS = '400'; process.env.XP_BODY_MAX_MS = '5000';
const LIM = require('./lib/core-limiter.js');
let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; console.log('ok  ', name); } catch (e) { fail++; console.log('FAIL', name, '-', e.message); } }
const srv = http.createServer((req, res) => {
  if (req.url === '/stall') { res.writeHead(200, { 'content-type': 'application/json' }); res.write('{"a":'); return; } /* never ends */
  if (req.url === '/trickle') { res.writeHead(200, { 'content-type': 'application/json' }); let i = 0; const iv = setInterval(() => { if (++i < 6) res.write(' '); else { clearInterval(iv); res.end('{"ok":1}'); } }, 150); return; }
  if (req.url === '/hang') return; /* no headers */
  res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":1}');
});
srv.listen(0, '127.0.0.1', async () => {
  const B = 'http://127.0.0.1:' + srv.address().port, f = LIM.makeFetch(fetch, { timeoutMs: 1500 }); /* default match: this URL is NOT paced */
  await t('an unpaced URL is still counted as passthrough', async () => { const r = await f(B + '/ok'); assert.deepStrictEqual(await r.json(), { ok: 1 }); assert.strictEqual(f.stats.passthrough, 1); });
  await t('an unpaced body that stalls fails within the idle limit', async () => { const t0 = Date.now(); let err = null;
    try { const r = await f(B + '/stall'); await r.json(); } catch (e) { err = e; }
    assert.ok(err, 'no error'); assert.ok(Date.now() - t0 < 3000, 'took ' + (Date.now() - t0) + ' ms'); });
  await t('an unpaced read with no headers fails within timeoutMs', async () => { const t0 = Date.now(); let err = null;
    try { await f(B + '/hang'); } catch (e) { err = e; } assert.ok(err && /timeout/.test(err.message), String(err)); assert.ok(Date.now() - t0 < 3000); });
  await t('a slow body that keeps sending still arrives', async () => { const r = await f(B + '/trickle'); assert.deepStrictEqual(await r.json(), { ok: 1 }); });
  await t("the caller's abort still cancels an unpaced read", async () => { const ac = new AbortController(), t0 = Date.now(); setTimeout(() => ac.abort(), 200); let err = null;
    try { await f(B + '/hang', { signal: ac.signal }); } catch (e) { err = e; } assert.ok(err); assert.ok(Date.now() - t0 < 1200, 'took ' + (Date.now() - t0) + ' ms'); });
  srv.close(); srv.closeAllConnections && srv.closeAllConnections();
  console.log('\nfeed-stall-test: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
});
