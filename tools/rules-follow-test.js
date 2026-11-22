#!/usr/bin/env node
/* Never go dark (Nov 22 2026): the sync server follows main's world-builder files by itself and keeps one latest.json per
 * rules signature. No network: GitHub is a fake that serves this checkout's files. */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http');
const ROOT = path.resolve(__dirname, '..');
const RF = require('./sync-server/rules-follow');
const snap = require('./sync-server/snapshot');
const { writeLatest, backfillRsigLatest } = require('./sync-server/index');
const { createServer } = require('./sync-server/server');
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('ok  ', m); } else { fail++; console.log('FAIL', m); } }
const SHA1 = 'a'.repeat(40), SHA2 = 'b'.repeat(40);
function fakeGithub(state) {
  return async function (u) {
    state.calls.push(u);
    if (/api\.github\.com\/repos\/[^/]+\/[^/]+\/commits\/main$/.test(u)) return { ok: true, status: 200, text: async () => state.sha };
    const m = /raw\.githubusercontent\.com\/[^/]+\/[^/]+\/([0-9a-f]{40})\/(.+)$/.exec(u);
    if (!m) return { ok: false, status: 400 };
    const rel = m[2];
    if (state.override && state.override[rel] != null && m[1] === state.sha) { const b = Buffer.from(state.override[rel]); return { ok: true, status: 200, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) }; }
    const f = path.join(ROOT, rel);
    if (!fs.existsSync(f) || !fs.statSync(f).isFile()) return { ok: false, status: 404 };
    const b = fs.readFileSync(f); return { ok: true, status: 200, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) };
  };
}
(async () => {
  const data = fs.mkdtempSync(path.join(process.env.XCPETS_TEST_TMP || os.tmpdir(), 'rf-'));
  const st = { sha: SHA1, calls: [] }, fetch = fakeGithub(st);

  /* 1. first check downloads a working copy whose rsig is the repo's */
  const want = snap.rulesSig(snap.loadBytes(ROOT));
  const r1 = await RF.checkOnce(data, { fetch });
  ok(r1.changed && r1.sha === SHA1, 'first check installs main\'s copy');
  ok(r1.rsig === want, 'copy has the same rsig as this checkout (' + r1.rsig + ')');
  const cur = RF.readCurrent(data);
  ok(cur && fs.existsSync(path.join(cur.dir, 'tools/sync-server/snapshot.js')) && fs.existsSync(path.join(cur.dir, 'js/v2-art.js')) && fs.existsSync(path.join(cur.dir, 'js/v2-grave-index.js')), 'copy holds the builder and the files it requires');
  ok(!st.calls.some(u => /\/(img|previews|api)\//.test(u)), 'downloads only code, not images or the feed');
  const copy = require(path.join(cur.dir, 'tools/sync-server/snapshot.js'));
  ok(typeof copy.buildSnapshot === 'function' && copy.rulesSig(copy.loadBytes()) === want, 'the copy\'s snapshot.js reads rules from the copy (ROOT is the copy)');

  /* 2. main unchanged: one API call, nothing downloaded */
  st.calls = [];
  const r2 = await RF.checkOnce(data, { fetch });
  ok(!r2.changed && st.calls.length === 1, 'main unchanged: no download');

  /* 3. main moved but a rule file does not parse: refused, previous copy kept */
  st.sha = SHA2; st.override = { 'js/v2-fit.js': 'function (' };
  let threw = null; try { await RF.checkOnce(data, { fetch }); } catch (e) { threw = e.message; }
  ok(threw && /parse/.test(threw), 'broken file refused (' + threw + ')');
  ok(RF.readCurrent(data).sha === SHA1, 'previous copy still current after a refused update');
  ok(!fs.readdirSync(path.join(data, 'code')).some(n => /\.tmp$/.test(n)), 'no half-downloaded folder left behind');

  /* 4. main moved with a real rules change: new rsig */
  st.override = { 'js/v2-fit.js': fs.readFileSync(path.join(ROOT, 'js/v2-fit.js'), 'utf8') + '\n/* changed */\n' };
  const r4 = await RF.checkOnce(data, { fetch });
  ok(r4.changed && r4.rsig !== want && r4.was === want, 'rules change on main gives a new rsig (' + r4.rsig + ')');

  /* 4b. main moves again without touching the builder's files (the feed timer's commits): same folder, nothing reloaded */
  const dir4 = RF.readCurrent(data).dir, SHA3 = 'c'.repeat(40);
  st.sha = SHA3;
  const r4b = await RF.checkOnce(data, { fetch });
  ok(!r4b.changed && r4b.rsig === r4.rsig && RF.readCurrent(data).sha === SHA3 && RF.readCurrent(data).dir === dir4, 'a commit that changes no builder file keeps the same copy (no reload, no new folder)');
  ok(fs.readdirSync(path.join(data, 'code')).filter(n => /^[0-9a-f]{12}$/.test(n)).length === 2, 'two copies on disk, one per distinct set of files');

  /* 4c. pruning never removes a copy a running build may still read */
  const croot = path.join(data, 'code');
  for (let i = 0; i < 4; i++) fs.mkdirSync(path.join(croot, String(i).repeat(12)), { recursive: true });
  RF.prune(data, path.basename(dir4));
  ok(fs.readdirSync(croot).filter(n => /^[0-9a-f]{12}$/.test(n)).length === 6, 'young copies are kept even past the 3 newest');
  const old = (Date.now() - RF.KEEP_YOUNG_MS - 60000) / 1000;
  for (let i = 0; i < 4; i++) fs.utimesSync(path.join(croot, String(i).repeat(12)), old, old);
  RF.prune(data, path.basename(dir4));
  const left = fs.readdirSync(croot).filter(n => /^[0-9a-f]{12}$/.test(n));
  ok(left.length === 3 && left.includes(path.basename(dir4)), 'old copies past the 3 newest are removed, the current one stays');

  /* 5. follower never throws, and is off with XP_RULES_FOLLOW=0 */
  const fo = RF.follower(data, { fetch: async () => { throw new Error('offline https://x.invalid/secret'); } });
  const r5 = await fo.poll(true);
  ok(r5 === null && fo.info().fails === 1 && !/x\.invalid/.test(fo.info().lastError || ''), 'follower swallows a failure and does not log URLs');
  process.env.XP_RULES_FOLLOW = '0'; ok((await RF.follower(data, { fetch }).poll(true)) === null, 'XP_RULES_FOLLOW=0 turns it off'); delete process.env.XP_RULES_FOLLOW;

  /* 6. per-rsig latest.json pointers and the HTTP route */
  const A = 'r' + '1'.repeat(32), B = 'r' + '2'.repeat(32);
  fs.mkdirSync(path.join(data, 'world', A, '100'), { recursive: true });
  fs.writeFileSync(path.join(data, 'world', 'latest.json'), JSON.stringify({ v: 1, rsig: A, tip: 100, manifest: '/xp/v1/world/' + A + '/100/manifest.json' }));
  backfillRsigLatest(data);
  ok(JSON.parse(fs.readFileSync(path.join(data, 'world', A, 'latest.json'), 'utf8')).tip === 100, 'startup backfills the pointer for the world already published');
  writeLatest(data, { v: 1, rsig: B, tip: 106, manifest: '/xp/v1/world/' + B + '/106/manifest.json' });
  const srv = createServer({ getState: () => ({ tip: 106, ready: true, world: { rsig: B, tip: 106 }, rules: () => ({ follow: true, rsig: B }) }), dataDir: data });
  await new Promise(r => srv.server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.server.address().port;
  const get = async p => { const r = await globalThis.fetch(base + p); return { status: r.status, json: await r.json().catch(() => null) }; };
  const L = await get('/xp/v1/world/latest.json'), LA = await get('/xp/v1/world/' + A + '/latest.json'), LB = await get('/xp/v1/world/' + B + '/latest.json'), LC = await get('/xp/v1/world/r' + '3'.repeat(32) + '/latest.json');
  ok(L.json.rsig === B && L.json.tip === 106, 'latest.json names the newest world');
  ok(LA.status === 200 && LA.json.rsig === A && LA.json.tip === 100, 'previous rules keep their own world');
  ok(LB.status === 200 && LB.json.rsig === B, 'new rules have their pointer too');
  ok(LC.status === 404, 'unknown rsig: 404');
  const bad = await get('/xp/v1/world/..%2F..%2Flatest.json');
  ok(bad.status === 404, 'no path tricks');
  const h = await get('/xp/v1/health');
  ok(h.json.rules && h.json.rules.rsig === B && h.json.worldRsig === B, 'health shows the rsig the builder follows and the world rsig');
  /* 7. the page asks for its own rules' world when latest.json has other rules */
  const vm = require('vm'), crypto = require('crypto');
  const mem = () => { const o = {}; return { getItem: k => (k in o ? o[k] : null), setItem: (k, v) => { o[k] = String(v); }, removeItem: k => { delete o[k]; } }; };
  const ctx = { window: {}, location: { search: '?sync=' + base, href: base + '/play.html', pathname: '/play.html' }, localStorage: mem(), sessionStorage: mem(),
    navigator: { hardwareConcurrency: 8, connection: {} }, document: { currentScript: { src: 'http://x/js/v2-boot-sync.js?v=abcdef' }, scripts: [] },
    URLSearchParams, URL, TextEncoder, TextDecoder, crypto: crypto.webcrypto, console, fetch: globalThis.fetch, setTimeout, clearTimeout, AbortController };
  ctx.window.window = ctx.window; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/v2-boot-sync.js'), 'utf8'), ctx);
  const B2 = ctx.window.V2BootSync;
  for (const [rs, sig] of [[A, 'previous rules'], [B, 'current rules']]) {
    fs.mkdirSync(path.join(data, 'world', rs, String(rs === A ? 100 : 106)), { recursive: true });
    fs.writeFileSync(path.join(data, 'world', rs, String(rs === A ? 100 : 106), 'manifest.json'), JSON.stringify({ v: 1, rsig: rs, tip: rs === A ? 100 : 106, tag: sig }));
  }
  const mA = await B2._fetchManifest({ rsig: () => A }), mB = await B2._fetchManifest({ rsig: () => B }), mC = await B2._fetchManifest({ rsig: () => 'r' + '3'.repeat(32) });
  ok(mA.rsig === A && /\/world\/r1{32}\/100\/manifest\.json$/.test(mA._url), 'page on the previous rules gets the previous world, not a slow rebuild');
  ok(mB.rsig === B, 'page on the current rules gets latest.json');
  ok(mC.rsig === B, 'page with rules nobody built still gets latest.json (and refuses it as before)');
  const split = fs.readFileSync(path.join(ROOT, 'js/v2-split.js'), 'utf8');
  ok(/\/xp\/v1\/world\/' \+ rsig \+ '\/latest\.json'/.test(split) && /manifest: last && last\.url/.test(split), 'fast view looks for its own rules\' world and verifies that same world');
  srv.server.close();
  fs.rmSync(data, { recursive: true, force: true });
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL', e && e.stack || e); process.exit(1); });
