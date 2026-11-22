'use strict';
/* Rules follower (Nov 22 2026). On Nov 22 the server built the world from rule files that had drifted from main, so its
 * rules signature (rsig) did not match the pages and every player fell back to a slow rebuild in the browser.
 *
 * Now the server keeps its own copy of the world builder at the newest main commit:
 *   - every XP_RULES_EVERY_S seconds (default 180) it asks GitHub for main's commit (one API call, no key),
 *   - when main moved, it downloads the builder's files at that exact commit into <XP_DATA>/code/<sha12>/
 *     (the rule files, the replay worker, js/v2-sales.js, js/v2-art.js, tools/sync-server/*.js and every repo file
 *     they name), checks that each script parses and that snapshot.js loads, then points <XP_DATA>/code/current.json at it,
 *   - the world builder (a child process) then runs snapshot.js from that folder, so the published world always uses
 *     the same bytes main serves to the pages. The running service itself (chain follow, HTTP) is not replaced.
 * Any failure keeps the previous copy (or the installed repo when there is none). XP_RULES_FOLLOW=0 turns it off.
 * Only public GitHub URLs are fetched. Nothing about the server is sent or logged. */
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto'), { execFileSync } = require('child_process');
const { timedFetch } = require('./net');

const REPO = process.env.XP_RULES_REPO || 'LongBranch13/xcpets-fun';
const BRANCH = process.env.XP_RULES_BRANCH || 'main';
/* Seed list. Everything else is found by following require('./x') / require('../..') and quoted repo paths. */
const SEED = ['tools/sync-server/snapshot.js', 'tools/sync-server/client.js', 'tools/sync-server/answer.js', 'tools/sync-server/graves.js',
  'tools/sync-server/split.js', 'tools/sync-server/net.js', 'build-id.txt',
  'rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js',
  'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js', 'js/v2-replay-worker.js',
  'js/v2-sales.js', 'js/v2-chain.js', 'js/v2-boot-sync.js', 'js/v2-resume.js', 'js/v2-art.js', 'js/v2-grave-index.js', 'js/block-hashes.js'];
const MAX_FILES = 120, KEEP = 3;
const EVERY_MS = Math.max(60, +(process.env.XP_RULES_EVERY_S || 180)) * 1000;

function enabled() { return process.env.XP_RULES_FOLLOW !== '0'; }
function codeRoot(dataDir) { return path.join(dataDir, 'code'); }
function readCurrent(dataDir) {
  try {
    const cur = JSON.parse(fs.readFileSync(path.join(codeRoot(dataDir), 'current.json'), 'utf8'));
    if (!cur || !/^[0-9a-f]{40}$/.test(cur.sha || '')) return null;
    const dir = path.join(codeRoot(dataDir), cur.sha.slice(0, 12));
    if (!fs.existsSync(path.join(dir, 'tools', 'sync-server', 'snapshot.js'))) return null;
    return Object.assign({}, cur, { dir: dir });
  } catch (e) { return null; }
}
/* Repo-relative paths a file points at: relative require() calls and quoted 'js/…', 'rjs/…' paths. */
function namedPaths(rel, text) {
  const out = new Set(), here = path.posix.dirname(rel);
  const req = /require\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g; let m;
  while ((m = req.exec(text))) { let p = path.posix.normalize(path.posix.join(here, m[1])); if (!/\.(js|json)$/.test(p)) p += '.js'; if (!p.startsWith('..')) out.add(p); }
  const lit = /['"]((?:js|rjs)\/[A-Za-z0-9_.-]+\.js)['"]/g;
  while ((m = lit.exec(text))) out.add(m[1]);
  return [...out];
}
function rawUrl(sha, rel) { return 'https://raw.githubusercontent.com/' + REPO + '/' + sha + '/' + rel; }
async function mainSha(fetchFn) {
  const r = await fetchFn('https://api.github.com/repos/' + REPO + '/commits/' + BRANCH, { headers: { Accept: 'application/vnd.github.sha', 'User-Agent': 'xcpets-sync' } });
  if (!r.ok) throw new Error('github ' + r.status);
  const t = String(await r.text()).trim();
  if (!/^[0-9a-f]{40}$/.test(t)) throw new Error('github sha');
  return t;
}
async function download(sha, dir, fetchFn) {
  const want = SEED.slice(), seen = new Set(), seed = new Set(SEED);
  while (want.length) {
    const rel = want.shift(); if (seen.has(rel)) continue; seen.add(rel);
    if (seen.size > MAX_FILES) throw new Error('too many files');
    const r = await fetchFn(rawUrl(sha, rel), { headers: { 'User-Agent': 'xcpets-sync' } });
    if (r.status === 404 && !seed.has(rel)) continue; /* a quoted path that is not a file (an example in a comment) */
    if (!r.ok) throw new Error('download ' + rel + ' ' + r.status);
    const buf = Buffer.from(await r.arrayBuffer());
    if (/\.js$/.test(rel)) {
      const text = buf.toString('utf8');
      try { new vm.Script(text.replace(/^#!.*/, ''), { filename: rel }); } catch (e) { throw new Error('does not parse: ' + rel); }
      namedPaths(rel, text).forEach(p => { if (!seen.has(p)) want.push(p); });
    }
    const dest = path.join(dir, rel);
    if (!dest.startsWith(dir + path.sep)) throw new Error('bad path');
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
  }
  return seen.size;
}
function prune(dataDir, keepName) {
  const root = codeRoot(dataDir); let names = [];
  try { names = fs.readdirSync(root).filter(n => /^[0-9a-f]{12}$/.test(n) || /^[0-9a-f]{12}\.tmp$/.test(n)); } catch (e) { return; }
  names.filter(n => /\.tmp$/.test(n)).forEach(n => fs.rmSync(path.join(root, n), { recursive: true, force: true }));
  names = names.filter(n => !/\.tmp$/.test(n)).sort((a, b) => fs.statSync(path.join(root, b)).mtimeMs - fs.statSync(path.join(root, a)).mtimeMs);
  names.slice(KEEP).forEach(n => { if (n !== keepName) fs.rmSync(path.join(root, n), { recursive: true, force: true }); });
}
/* One check. Resolves { changed, sha, rsig } or throws; never touches the published world. */
async function checkOnce(dataDir, opts) {
  const fetchFn = (opts && opts.fetch) || ((u, o) => timedFetch(u, o, 20000));
  const cur = readCurrent(dataDir);
  const sha = await mainSha(fetchFn);
  if (cur && cur.sha === sha) return { changed: false, sha: sha, rsig: cur.rsig };
  const root = codeRoot(dataDir), name = sha.slice(0, 12), tmp = path.join(root, name + '.tmp'), dir = path.join(root, name);
  fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
  try {
    const files = await download(sha, tmp, fetchFn);
    /* snapshot.js must load with everything it requires, in a separate process so a broken copy can't touch this one */
    execFileSync(process.execPath, ['-e', 'require(process.argv[1])', path.join(tmp, 'tools', 'sync-server', 'snapshot.js')], { stdio: 'ignore', timeout: 60000 });
    fs.rmSync(dir, { recursive: true, force: true }); fs.renameSync(tmp, dir);
    const rsig = String(execFileSync(process.execPath, ['-e', 'const s=require(process.argv[1]);process.stdout.write(s.rulesSig(s.loadBytes(process.argv[2])))', path.join(dir, 'tools', 'sync-server', 'snapshot.js'), dir], { timeout: 60000 })).trim();
    if (!/^r[0-9a-f]{32}$/.test(rsig)) throw new Error('rsig');
    const next = { v: 1, sha: sha, rsig: rsig, files: files, at: new Date().toISOString() };
    fs.writeFileSync(path.join(root, 'current.json.tmp'), JSON.stringify(next)); fs.renameSync(path.join(root, 'current.json.tmp'), path.join(root, 'current.json'));
    prune(dataDir, name);
    return { changed: true, sha: sha, rsig: rsig, was: cur && cur.rsig || null };
  } catch (e) { fs.rmSync(tmp, { recursive: true, force: true }); throw e; }
}
/* Throttled wrapper for the service's 10 s loop. Never throws. */
function follower(dataDir, opts) {
  const st = { lastAt: 0, running: false, ok: 0, fails: 0, lastError: null, sha: null, rsig: null, changedAt: null };
  const cur = readCurrent(dataDir); if (cur) { st.sha = cur.sha; st.rsig = cur.rsig; }
  async function poll(force) {
    if (!enabled() || st.running) return null;
    if (!force && Date.now() - st.lastAt < EVERY_MS) return null;
    st.running = true; st.lastAt = Date.now();
    try {
      const r = await checkOnce(dataDir, opts);
      st.ok++; st.lastError = null; st.sha = r.sha; st.rsig = r.rsig;
      if (r.changed) { st.changedAt = new Date().toISOString(); console.log('rules: builder copy now at ' + r.sha.slice(0, 12) + ' rsig ' + r.rsig + (r.was && r.was !== r.rsig ? ' (was ' + r.was + ')' : '')); }
      return r;
    } catch (e) { st.fails++; st.lastError = String(e && e.message || e).replace(/https?:\/\/\S+/g, '[url]').slice(0, 80); console.error('rules: check failed: ' + st.lastError); return null; }
    finally { st.running = false; }
  }
  function info() { return { follow: enabled(), sha: st.sha ? st.sha.slice(0, 12) : null, rsig: st.rsig, changedAt: st.changedAt, fails: st.fails, lastError: st.lastError }; }
  function dir() { const c = readCurrent(dataDir); return c ? c.dir : null; }
  return { poll, info, dir, state: st };
}
module.exports = { follower, checkOnce, readCurrent, namedPaths, SEED, REPO };
