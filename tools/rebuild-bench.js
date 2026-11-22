#!/usr/bin/env node
'use strict';
/* Full-rebuild benchmark and equality check (dev tooling only; not loaded by any page).
 * Replays api/boot.json the same way the snapshot builder and the replay worker do, then prints the time
 * and the world digest (sha256 over the full wsEncode, the same digest the page's desktop recheck uses).
 *   node tools/rebuild-bench.js [--boot api/boot.json] [--tip N] [--runs 1]
 *   node tools/rebuild-bench.js --compare <git-ref> [--tips 975000,976000,...] [--boot FILE]
 * --compare checks out <git-ref> in a temp worktree and replays the same input there and here, at each tip (default: the boot tip).
 * Equal digests = byte-identical worlds (every pet, item, log line and key order). Needs ~2 GB of memory per replay. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const A = process.argv.slice(2), opt = k => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : null; };
const ROOT = path.resolve(__dirname, '..');
const S = require('./sync-server/snapshot');
const { bootSync } = require('./sync-server/client');
const cp = require('child_process'), os = require('os');
function compare(ref) {
  const boot = path.resolve(opt('--boot') || path.join(ROOT, 'api/boot.json'));
  const tips = (opt('--tips') || String(JSON.parse(fs.readFileSync(boot, 'utf8')).tip)).split(',').map(Number);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'xcpets-rb-'));
  cp.execSync(`git -C "${ROOT}" worktree add --detach "${tmp}" ${ref}`, { stdio: 'ignore' });
  fs.copyFileSync(__filename, path.join(tmp, 'tools', 'rebuild-bench.js'));
  const run = (dir, tip) => new Promise((res, rej) => cp.execFile(process.execPath, ['--max-old-space-size=4096', path.join(dir, 'tools', 'rebuild-bench.js'), '--boot', boot, '--tip', String(tip)], { maxBuffer: 1 << 24 },
    (e, out) => e ? rej(e) : res(JSON.parse(out.trim().split('\n').pop()))));
  let bad = 0;
  return tips.reduce((p, tip) => p.then(() => Promise.all([run(tmp, tip), run(ROOT, tip)]).then(([a, b]) => {
    const same = a.digest === b.digest; if (!same) bad++;
    console.log(`tip ${tip}  pets ${b.pets}  ${ref} ${a.replayMs} ms  working tree ${b.replayMs} ms  ${same ? 'SAME ' + b.digest.slice(0, 16) : 'DIFF ' + a.digest.slice(0, 16) + ' vs ' + b.digest.slice(0, 16)}`);
  })), Promise.resolve()).finally(() => { cp.execSync(`git -C "${ROOT}" worktree remove --force "${tmp}"`, { stdio: 'ignore' }); }).then(() => { process.exitCode = bad ? 1 : 0; });
}
function knownHashes() {
  const ctx = { window: {} }; ctx.window.window = ctx.window; ctx.self = ctx.window; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/block-hashes.js'), 'utf8'), ctx);
  return ctx.window.XCPETS_BLOCK_HASHES || ctx.XCPETS_BLOCK_HASHES || {};
}
(async () => {
  if (opt('--compare')) return compare(opt('--compare'));
  const boot = JSON.parse(fs.readFileSync(path.resolve(opt('--boot') || path.join(ROOT, 'api/boot.json')), 'utf8'));
  const tip = +(opt('--tip') || boot.tip);
  const rows = boot.rows.filter(r => r.block_index <= tip);
  const hashes = Object.assign({}, knownHashes(), boot.hashes);
  const runs = +(opt('--runs') || 1);
  for (let r = 0; r < runs; r++) {
    const ctx = S.workerFns();
    const t0 = process.hrtime.bigint();
    const world = S.replayWorld(ctx, rows.slice(), hashes, tip, boot.dex || null);
    const t1 = process.hrtime.bigint();
    const enc = S.encodeWorld(ctx, world);
    const t2 = process.hrtime.bigint();
    const digest = await bootSync().digestOf(enc.root, enc.parts);
    console.log(JSON.stringify({ tip, rows: rows.length, pets: world.pets.length, replayMs: Number(t1 - t0) / 1e6 | 0, encodeMs: Number(t2 - t1) / 1e6 | 0, digest, rss: process.memoryUsage().rss >> 20 }));
  }
})().catch(e => { console.error(e.stack || e); process.exit(2); });
