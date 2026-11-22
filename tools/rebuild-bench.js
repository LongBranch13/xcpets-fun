#!/usr/bin/env node
'use strict';
/* Full-rebuild benchmark and equality check (dev tooling only; not loaded by any page).
 * Replays api/boot.json the same way the snapshot builder and the replay worker do, then prints the time
 * and the world digest (sha256 over the full wsEncode, the same digest the page's desktop recheck uses).
 *   node tools/rebuild-bench.js [--boot api/boot.json] [--tip N] [--runs 1]
 *   node tools/rebuild-bench.js --compare <git-ref> [--tips 975000,976000,...] [--boot FILE]
 * --compare checks out <git-ref> in a temp worktree and replays the same input there and here, at each tip (default: the boot tip).
 * Equal digests = byte-identical worlds (every pet, item, log line and key order). Needs ~2 GB of memory per replay.
 *   node tools/rebuild-bench.js --resume-from <block> [--tip N] [--boot FILE]
 * Catch-up check: builds the server's checkpoint at <block> (slimmed, JSON round trip, the files a page downloads), then a fresh
 * engine decodes it and applies only the newer burns up to --tip, the way js/v2-catchup-worker.js does. Prints SAME when that
 * world's digest equals a full replay to --tip. */
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
function canonHash(w) {
  /* sha256 over sorted-key JSON of every own enumerable value; shared objects are written each time they appear. */
  const h = require('crypto').createHash('sha256'), stack = new Set();
  (function walk(v) {
    if (v === undefined) { h.update('u'); return; } if (v === null || typeof v !== 'object') { h.update(JSON.stringify(v) + ';'); return; }
    if (stack.has(v)) { h.update('cycle;'); return; } stack.add(v);
    if (Array.isArray(v)) { h.update('['); for (let i = 0; i < v.length; i++) walk(v[i]); h.update(']'); }
    else { h.update('{'); Object.keys(v).sort().forEach(k => { h.update(JSON.stringify(k) + ':'); walk(v[k]); }); h.update('}'); }
    stack.delete(v);
  })(Object.assign({}, w, { byId: null }));
  return h.digest('hex');
}
function whereDiff(a, b) {
  /* First differences, by world key and then by pet / item, to say where a resumed world went wrong. */
  const J = v => { try { return JSON.stringify(v); } catch (e) { return String(e); } }, out = [];
  const keys = Array.from(new Set(Object.keys(a).concat(Object.keys(b))));
  if (J(Object.keys(a)) !== J(Object.keys(b))) out.push('key order/set differs: ' + keys.filter(k => !(k in a) || !(k in b)).join(','));
  keys.forEach(k => { if (k === 'pets' || k === 'byId' || k === 'items') return; if (J(a[k]) !== J(b[k])) out.push('w.' + k); });
  const pa = new Map((a.pets || []).map(p => [p.id, p])); let n = 0;
  (b.pets || []).forEach(p => { const q = pa.get(p.id); if (!q) { if (n++ < 8) out.push('pet #' + p.id + ' missing'); return; }
    const ks = Array.from(new Set(Object.keys(p).concat(Object.keys(q)))).filter(k => k !== 'children' && J(p[k]) !== J(q[k]));
    
    if (ks.length && n++ < 8) out.push('pet #' + p.id + ': ' + ks.join(',')); });
  if (n) out.push(n + ' pet(s) differ');
  let m = 0; Object.keys(b.items || {}).forEach(k => { if (J((a.items || {})[k]) !== J(b.items[k]) && m++ < 5) out.push('item ' + k); }); if (m) out.push(m + ' item(s) differ');
  console.log(out.slice(0, 40).join('\n'));
}
function checkpointAt(rows, hashes, tip, dex) {
  /* The builder's checkpoint: the world just before the tip pass, slimmed, through the JSON round trip the published files take. */
  const ctx = S.workerFns(), C = bootSync(); let cp = null;
  ctx.saveCheckpoint = (enc, keys, dexPos, grand) => {
    const V = ctx.V2Rules; require('../js/v2-art').slimEncoded(enc.root, enc.parts, ctx.PetCore, { ftLook: V && V.ftLookOfTier ? t => V.ftLookOfTier(t) : null }); /* same as snapshot.js slimEnc */
    const back = v => C.unmarkValue(JSON.parse(JSON.stringify(C.markValue(v))));
    cp = { root: back(enc.root), parts: enc.parts.map(back), meta: { tip, dexPos: dexPos || 0, grand: grand ? 1 : 0, seen: keys } };
  };
  S.replayWorld(ctx, rows.filter(r => r.block_index <= tip), hashes, tip, dex);
  if (!cp) throw new Error('no checkpoint');
  return cp;
}
function catchUp(cp, rows, hashes, tip, dex) {
  /* Same steps as js/v2-catchup-worker.js: decode, restore the slim art, resume with only the newer burns. */
  const ctx = S.workerFns(), R = require('../js/v2-resume'), Art = require('../js/v2-art');
  S.replayWorld(ctx, [], {}, cp.meta.tip, null); /* loads the patched rules into this engine */
  const w = R.wsDecode(cp.root, cp.parts);
  if (w._owners || w._hashes) Art.restore(w, ctx.PetCore, { ftLook: ctx.V2Rules.ftLookOfTier ? t => ctx.V2Rules.ftLookOfTier(t) : null });
  const seen = {}; cp.meta.seen.forEach(k => { seen[k] = 1; });
  ctx.__rows = rows; ctx.__hashes = hashes; ctx.__tip = tip; ctx.__dex = dex || undefined;
  ctx.__res = { w, seen, dexPos: cp.meta.dexPos, grand: cp.meta.grand, tip: cp.meta.tip };
  vm.runInContext('if (__dex && self.V2Sales && self.V2Sales.normalizeDex) __dex = self.V2Sales.normalizeDex(__dex);' +
    '__world = self.V2Rules.replay(__rows, __hashes, [], { tip: __tip, live: self.LiveEngine.RealCore, dex: __dex, _resume: __res });', ctx);
  return { ctx, world: ctx.__world };
}
(async () => {
  if (opt('--compare')) return compare(opt('--compare'));
  if (opt('--resume-from')) {
    const boot = JSON.parse(fs.readFileSync(path.resolve(opt('--boot') || path.join(ROOT, 'api/boot.json')), 'utf8'));
    const tip = +(opt('--tip') || boot.tip), from = +opt('--resume-from'), hashes = Object.assign({}, knownHashes(), boot.hashes);
    const rows = boot.rows.filter(r => r.block_index <= tip);
    const t0 = Date.now(), cp = checkpointAt(rows, hashes, from, boot.dex || null), t1 = Date.now();
    const a = catchUp(cp, rows, hashes, tip, boot.dex || null), t2 = Date.now();
    const da = await bootSync().digestOf(...(e => [e.root, e.parts])(S.encodeWorld(a.ctx, a.world)));
    const fctx = S.workerFns(), fw = S.replayWorld(fctx, rows.slice(), hashes, tip, boot.dex || null);
    const df = await bootSync().digestOf(...(e => [e.root, e.parts])(S.encodeWorld(fctx, fw)));
    console.log(JSON.stringify({ from, tip, behind: tip - from, newRows: rows.filter(r => r.block_index > from).length, checkpointMs: t1 - t0, catchUpMs: t2 - t1, same: da === df, resumed: da.slice(0, 16), full: df.slice(0, 16) }));
    /* The slim checkpoint re-adds each pet's art on restore, so key order inside pets can differ from a full replay. Values are what the game reads. */
    const ca = da === df || canonHash(a.world) === canonHash(fw);
    console.log(da === df ? 'SAME (byte for byte)' : ca ? 'SAME (same values; key order differs, from the slim checkpoint restore)' : 'DIFF');
    if (!ca) whereDiff(a.world, fw);
    process.exitCode = ca ? 0 : 1; return;
  }
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
