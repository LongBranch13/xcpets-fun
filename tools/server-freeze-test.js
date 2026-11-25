#!/usr/bin/env node
/* Never-freeze checks (Nov 24 2026). Nov 23 2026 the sync server's follower sat at block 977,257 for hours: an upstream answer
 * sent its headers and then stalled, the fetch timer had already stopped at the headers, and r.json() waited forever. Nothing
 * logged, health kept answering, every watcher compared the server with itself. These checks cover each layer of the fix:
 *   1. timedFetch and the core limiter time out a stalled body (they used to hang)
 *   2. the service's stall guard writes stall.json and exits for systemd when one follow step runs too long
 *   3. a real service process with a stalling upstream keeps stepping, reports errors in health, and never freezes
 *   4. worldwatch compares the server with the real chain; HatchBot's server watch alerts once, reminds, and clears
 *   node tools/server-freeze-test.js */
'use strict';
const http = require('http'), path = require('path'), fs = require('fs'), os = require('os'), { spawn } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('ok   ' + name); } else { fail++; console.log('FAIL ' + name + (extra ? ' ' + extra : '')); } }
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* an upstream that answers / normally and stalls every other body after the headers */
function stallServer() {
  const socks = new Set();
  const srv = http.createServer((req, res) => {
    if (req.url === '/v2/' || req.url === '/v2') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ result: { counterparty_height: 977289 } })); return; }
    if (req.url === '/v2/slow') { /* a big answer that keeps arriving: 10 pieces, 250 ms apart */
      res.writeHead(200, { 'content-type': 'application/json' }); let i = 0; res.write('{"result": [0');
      const iv = setInterval(() => { i++; if (i < 10) { res.write(',' + i); return; } clearInterval(iv); res.end(']}'); }, 250); return; }
    res.writeHead(200, { 'content-type': 'application/json' }); res.write('{"result": ['); /* ... and never the rest */
  });
  srv.on('connection', s => { socks.add(s); s.on('close', () => socks.delete(s)); });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r({ srv, port: srv.address().port, close: () => { socks.forEach(s => s.destroy()); srv.close(); } })));
}

(async () => {
  const up = await stallServer(), base = 'http://127.0.0.1:' + up.port;

  /* 1. body timeouts (headers within the request limit; the body fails only when it stops arriving for XP_BODY_IDLE_MS) */
  process.env.XP_BODY_IDLE_MS = '600';
  const { timedFetch } = require('./sync-server/net');
  let t0 = Date.now(), err = null;
  try { const r = await timedFetch(base + '/v2/assets/XCPETS/destructions', {}, 400); await r.json(); } catch (e) { err = e; }
  ok('timedFetch: a body that stalls after the headers fails within the limit', err && Date.now() - t0 < 2500, err ? (Date.now() - t0) + ' ms' : 'no error');
  const good = await timedFetch(base + '/v2/', {}, 2000).then(r => r.json());
  ok('timedFetch: a normal answer still reads as JSON', good && good.result && good.result.counterparty_height === 977289);
  t0 = Date.now(); const slow = await timedFetch(base + '/v2/slow', {}, 400).then(r => r.json()).catch(e => ({ err: e.message }));
  ok('timedFetch: a slow answer that keeps arriving is read whole, past the request limit (the sales read pages)', slow && slow.result && slow.result.length === 10 && Date.now() - t0 > 2000, JSON.stringify(slow));
  const LIM = require('./lib/core-limiter');
  const lim = LIM.makeFetch((u, o) => fetch(u, o), { timeoutMs: 400, match: () => true, rps: 50 });
  t0 = Date.now(); err = null;
  try { const r = await lim(base + '/v2/assets/XCPETS/destructions'); await r.json(); } catch (e) { err = e; }
  ok('core limiter: a stalled body fails within timeoutMs (the feed and the sales reads use it)', err && Date.now() - t0 < 2500, err ? (Date.now() - t0) + ' ms' : 'no error');
  const fake = { status: 200, ok: true, json: async () => ({ x: 1 }) };
  const lim2 = LIM.makeFetch(async () => fake, { match: () => true, rps: 50 });
  { const slow2 = await lim(base + '/v2/slow').then(r => r.json()).catch(e => ({ err: e.message }));
    ok('core limiter: a slow answer that keeps arriving is read whole', slow2 && slow2.result && slow2.result.length === 10, JSON.stringify(slow2)); }
  ok('core limiter: test fakes pass through unchanged', (await lim2('http://x/')) === fake);

  /* 2. stall guard */
  const idx = require('./sync-server/index');
  const dd = fs.mkdtempSync(path.join(os.tmpdir(), 'xp-stall-'));
  let code = null;
  idx._LOOP.runningSince = Date.now() - 5 * 60000;
  ok('stall guard: a 5-minute step is not stuck yet (limit 10)', idx.stallCheck({ tip: 1 }, dd, c => { code = c; }) === false && code === null);
  idx._LOOP.runningSince = Date.now() - 11 * 60000;
  ok('stall guard: an 11-minute step exits with 70 for systemd', idx.stallCheck({ tip: 977257, coreHeight: 977289 }, dd, c => { code = c; }) === true && code === 70);
  const st = JSON.parse(fs.readFileSync(path.join(dd, 'stall.json'), 'utf8'));
  ok('stall guard: stall.json records the tip and the step length', st.tip === 977257 && st.sec >= 660 && !!st.at);
  idx._LOOP.runningSince = 0;
  ok('errCode keeps short codes and hides anything else', idx.errCode(new Error('upstream down')) === 'upstream down' && idx.errCode(new Error('fetch http://10.0.0.1:4000 failed')) === 'error');

  ok('errCode names sales-read failures without their details', idx.errCode(new Error('balance check failed for PETTOKEN1')) === 'sales: balance check failed' && idx.errCode(new Error('DEX API 503: busy at http://x')) === 'sales: dex api 503');
  ok('errCode names a busy public node', idx.errCode(new Error('DEX API busy (429: rate limited)')) === 'sales: dex api busy');
  { const h = idx.errHint(new Error('DEX API busy at https://10.1.2.3:4000/v2 for bc1qtke38j72qv4d8eljn7pccaykypw8luytfwdn7q 1JwWsArppwALMEdXWPmpDBcP1jwWsAPYkD 10.0.0.7:8080 abcdefghijklmnop.onion ' + 'ab'.repeat(32)));
    ok('errHint keeps the words and drops hosts, IPs, onions, addresses and hashes', /DEX API busy/.test(h) && !/10\.|bc1q|1JwW|\.onion|abab|http/.test(h), h); }
  idx._LOOP.errorRun = 1; const b1 = idx.backoffMs(); idx._LOOP.errorRun = 20; const b20 = idx.backoffMs(); idx._LOOP.errorRun = 0;
  ok('a failing step backs off (20 s after one failure, at most 5 min)', b1 === 20000 && b20 === 300000 && idx.backoffMs() === 0);
  ok('errCode names code faults by their kind only', idx.errCode(new TypeError('cannot read properties of undefined (reading bc1qsecret)')) === 'code: TypeError');
  /* 2b. saved follower state and the restart counter */
  const dd2 = fs.mkdtempSync(path.join(os.tmpdir(), 'xp-follow-'));
  ok('saveFollow refuses a follower that is not ready', idx.saveFollow(dd2, { ready: false, tip: 5, rows: [] }) === false);
  idx.saveFollow(dd2, { ready: true, tip: 977290, tipHash: 'ab', rows: [{ block_index: 977290 }], hashes: { 977280: 'x', 977289: 'y' }, dex: { a: 1 }, dexTip: 977290, dexHash: 'ab', dexAssets: ['A'] });
  const back = idx.readFollow(dd2);
  ok('readFollow returns the saved follower state', back && back.tip === 977290 && back.rows.length === 1 && back.dexAssets[0] === 'A' && back.hashes['977289'] === 'y');
  idx.recordStart(dd2); idx.recordStart(dd2); const starts = idx.recordStart(dd2);
  ok('recordStart keeps the start times (restart counter)', starts.length === 3);
  const salesSrc = fs.readFileSync(path.join(ROOT, 'js/v2-sales.js'), 'utf8');
  ok('v2-sales drops answers older than TTL (no endless cache in the long-running server)', /function memPut\(url, j\)/.test(salesSrc) && !/mem\[url\] = \{ at: Date\.now\(\), j: j \}; return j;/.test(salesSrc));

  /* 3. a real service process against the stalling upstream */
  const port = 20000 + Math.floor(Math.random() * 20000), data = fs.mkdtempSync(path.join(os.tmpdir(), 'xp-svc-'));
  fs.writeFileSync(path.join(data, 'stall.json'), JSON.stringify({ at: '2026-11-23T23:00:00.000Z', tip: 977257, sec: 700 }));
  fs.writeFileSync(path.join(data, 'follow-state.json'), JSON.stringify({ v: 1, tip: 977280, rows: [], hashes: {}, dex: null, dexTip: 0, dexHash: '', dexAssets: [] }));
  fs.writeFileSync(path.join(data, 'starts.json'), JSON.stringify([Date.now() - 600e3, Date.now() - 300e3]));
  const env = Object.assign({}, process.env, { XP_UPSTREAMS: base + '/v2', XP_PORT: String(port), XP_DATA: data, XP_FETCH_MS: '600', XP_SNAPSHOT: '0', XP_CHECK: '0', XP_RULES_FOLLOW: '0', XP_RPS: '50', XP_BACKOFF_BASE_MS: '50', XP_BODY_IDLE_MS: '600' });
  const kid = spawn(process.execPath, [path.join(__dirname, 'sync-server', 'index.js')], { env, stdio: ['ignore', 'ignore', 'pipe'] });
  let errs = ''; kid.stderr.on('data', d => { errs += d; });
  let h = null, firstAt = 0; const start = Date.now();
  for (let i = 0; i < 80; i++) {
    await sleep(250);
    try { const j = await fetch('http://127.0.0.1:' + port + '/xp/v1/health').then(r => r.json()); if (!firstAt) firstAt = Date.now() - start; h = j; if (j.loop && j.loop.errors >= 2) break; } catch (e) { }
  }
  ok('service: health answers soon after start (it listens before loading the rules)', firstAt > 0 && firstAt < 8000, firstAt + ' ms');
  ok('service: health shows the follow-loop heartbeat', h && h.loop && typeof h.loop.stepSec === 'number' && h.loop.maxMin === 10);
  ok('service: a stalling upstream gives errors, and the loop keeps stepping (no freeze)', h && h.loop && h.loop.errors >= 2 && h.loop.stepSec < 5, JSON.stringify(h && h.loop));
  ok('service: the last stall (from stall.json) is shown in health', h && h.loop && h.loop.lastStall && h.loop.lastStall.tip === 977257);
  ok('service: resumes from its saved state after a restart (not the stale boot file)', h && h.tip === 977280 && h.loop && h.loop.resumedFrom === 'saved', JSON.stringify(h && { tip: h.tip, from: h.loop && h.loop.resumedFrom }));
  ok('service: counts restarts (2 earlier starts in the last hour)', h && h.loop && h.loop.restarts1h === 2 && h.loop.heapLimitMB > 0);
  ok('service: no URL or address leaks into the loop error', h && h.loop && !/http|127\.0|\d+\.\d+\.\d+/.test(String(h.loop.lastError)));
  kid.kill('SIGKILL'); up.close();

  /* 4. watchers */
  const ww = require('./worldwatch');
  ok('worldwatch: a server 32 blocks behind the real chain is a problem', ww.followProblems({ tip: 977257, coreHeight: 977289 }, 977289).length === 1);
  ok('worldwatch: a server 1 block behind is fine', ww.followProblems({ tip: 977288 }, 977289).length === 0);
  ok('worldwatch: a stuck follow step is a problem', ww.followProblems({ tip: 977289, loop: { stepSec: 700 } }, 977289).length === 1);
  const src = fs.readFileSync(path.join(ROOT, 'tools/worldwatch.js'), 'utf8');
  ok('worldwatch: a crash loop (3 restarts in an hour) is a problem', ww.followProblems({ tip: 977289, loop: { stepSec: 1, restarts1h: 3 } }, 977289).length === 1);
  ok('worldwatch: chain tip comes from outside the server (mempool.space)', /mempool\.space\/api\/blocks\/tip\/height/.test(src) && /out\.realTip = await realHeight\(\)/.test(src));

  const SW = await import(path.join(ROOT, 'hatchbot', 'serverwatch.js'));
  ok('server watch: frozen follower', SW.judge({ tip: 977257, lastSnapshotTip: 977257 }, 977289).code === 'behind');
  ok('server watch: down', SW.judge(null, 977289).code === 'down');
  ok('server watch: healthy', SW.judge({ tip: 977289, lastSnapshotTip: 977285, loop: { stepSec: 3 } }, 977289) === null);
  ok('server watch: crash loop', SW.judge({ tip: 977289, lastSnapshotTip: 977289, loop: { stepSec: 1, restarts1h: 4 } }, 977289).code === 'crashloop');
  ok('server watch: world far behind', SW.judge({ tip: 977289, lastSnapshotTip: 977260 }, 977289).code === 'world');
  ok('server watch: feed far behind (Nov 24: feed at 977,257, server fine)', SW.judge({ tip: 977329, lastSnapshotTip: 977328, loop: { stepSec: 2 } }, 977329, 977257).code === 'feed');
  ok('server watch: feed a few blocks behind is fine', SW.judge({ tip: 977329, lastSnapshotTip: 977328 }, 977329, 977320) === null);
  ok('server watch: server problems come before the feed', SW.judge({ tip: 977257, lastSnapshotTip: 977257 }, 977329, 977257).code === 'behind');
  ok('server watch: feed tip from meta.json', await SW.readFeedTip(async u => /api\/meta\.json/.test(u) ? { blockHeight: 977257 } : null) === 977257);
  const mem = new Map(), store = { get: async k => mem.has(k) ? mem.get(k) : null, put: async (k, v) => { mem.set(k, v); } };
  const sent = [], tg = async (e, m, b) => { sent.push(b); return { ok: true }; };
  const envW = { TELEGRAM_ALERT_CHAT_ID: '111' };
  let health = { tip: 977257, lastSnapshotTip: 977257 };
  const get = async (u, ms, as) => { if (u.indexOf('/xp/v1/health') >= 0) { if (!health) throw new Error('down'); return health; } return as === 'text' ? '977289' : 977289; };
  let now = Date.parse('2026-11-24T00:00:00Z');
  let r = await SW.serverWatch(envW, tg, now, { store, get });
  ok('server watch: first bad check does not alert yet', r.bad === 'behind' && !r.alert && sent.length === 0);
  r = await SW.serverWatch(envW, tg, now + 60000, { store, get });
  ok('server watch: runs at most every 4 minutes', r.skip === true);
  now += SW.EVERY_MS; r = await SW.serverWatch(envW, tg, now, { store, get });
  ok('server watch: second bad check alerts once', r.alert && sent.length === 1 && sent[0].chat_id === '111' && /977,?257/.test(sent[0].text));
  ok('server watch: alert text names no server details', !/\d+\.\d+\.\d+\.\d+|onion|hetzner|ssh/i.test(sent[0].text));
  now += SW.EVERY_MS; await SW.serverWatch(envW, tg, now, { store, get });
  ok('server watch: no repeat inside the hour', sent.length === 1);
  now += SW.REMIND_MS; r = await SW.serverWatch(envW, tg, now, { store, get });
  ok('server watch: an hourly reminder while it lasts', r.remind && sent.length === 2);
  health = { tip: 977289, lastSnapshotTip: 977289 };
  now += SW.EVERY_MS; r = await SW.serverWatch(envW, tg, now, { store, get });
  ok('server watch: all clear once fine', r.clear && sent.length === 3 && /fine again/.test(sent[2].text));
  const subEnv = { DB: null, HB_STATE: { get: store.get, put: store.put } };
  const on = await SW.toggleAlerts(subEnv, 4242), list = await SW.recipients(subEnv, store), off = await SW.toggleAlerts(subEnv, 4242);
  ok('server watch: /alerts subscribes and unsubscribes a private chat', /on/.test(on) && list.includes('4242') && /off/.test(off) && !(await SW.recipients(subEnv, store)).includes('4242'));

  /* Nov 24 2026: server-repair copies tools/sync-server and tools/lib. Every non-builtin require of the service must resolve inside them. */
  /* What the server has: js/ (its repo copy pulls main) plus what server-repair ships, the paths on its `tar ... ss.tgz` line (read from the workflow, so a new shipped file needs no edit here). */
  const tarLine = (fs.readFileSync(path.join(ROOT, '.github/workflows/server-repair.yml'), 'utf8').split('\n').find(l => /tar -C src -czf .*ss\.tgz/.test(l)) || '');
  const ship = tarLine.replace(/\$\(cd src && ls ([^)]+)\)/g, '$1').split(/\s+/).slice(tarLine.trim().split(/\s+/).indexOf('"$RUNNER_TEMP/ss.tgz"') + 1).filter(Boolean);
  const shipped = abs => { const r = path.relative(ROOT, abs).split(path.sep).join('/'); const rj = /\.js$/.test(r) ? r : r + '.js';
    return ship.some(x => x.indexOf('*') >= 0 ? new RegExp('^' + x.replace(/\./g, '\\.').replace(/\*/g, '[^/]*') + '$').test(rj) : (r === x || rj === x || r.startsWith(x + '/'))); };
  ok('server-repair ships the sync server and tools/lib', ship.includes('tools/sync-server') && ship.includes('tools/lib'), ship.join(' '));
  const svc = fs.readdirSync(path.join(__dirname, 'sync-server')).filter(f => f.endsWith('.js') && f !== 'checker.js');
  const outside = [];
  svc.forEach(f => { const src = fs.readFileSync(path.join(__dirname, 'sync-server', f), 'utf8'); (src.match(/require\('(\.\.?\/[^']+)'\)/g) || []).forEach(m => { const rel = m.slice(9, -2); if (rel === '../..') return; const abs = path.resolve(__dirname, 'sync-server', rel); if (!shipped(abs) && !abs.startsWith(path.join(ROOT, 'js') + path.sep)) outside.push(f + ' -> ' + rel); }); });
  ok('service requires stay inside what the server has (js/ and the server-repair tar list)', outside.length === 0, outside.join(', '));
  { const rp = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'server-repair.yml'), 'utf8');
    ok('server-repair also installs the page scripts the service reads from its own folder (the server copy was from Nov 11)', ['js/v2-boot-sync.js', 'js/v2-chain.js', 'js/block-hashes.js', 'js/v2-grave-index.js'].every(f => new RegExp('ss\\.tgz" tools/sync-server tools/lib[^\\n]*' + f.replace(/[./]/g, '\\$&')).test(rp))); }
  ok('net.js does not depend on a tools/lib helper the server may not have yet', !/require\('\.\.\/lib/.test(fs.readFileSync(path.join(__dirname, 'sync-server', 'net.js'), 'utf8')));
  const repair = fs.readFileSync(path.join(ROOT, '.github/workflows/server-repair.yml'), 'utf8');
  ok('server-repair installs the sync watchdog timer, the feed time limit and tools/lib', /ss\.tgz" tools\/sync-server tools\/lib/.test(repair) && /xcpets-sync-watchdog\.timer/.test(repair) && /TimeoutStartSec=40min/.test(repair) && /"stepSec":\[0-9\]\+/.test(repair));

  console.log('\nserver-freeze-test: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
