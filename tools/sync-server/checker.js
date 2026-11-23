'use strict';
/* Burn check service (Nov 23 2026, Jake approved "server check, device as backup"). A child process of xcpets-sync.
 * It does on the server what js/v2-verify-worker.js does in each browser: decode the published checkpoint, restore it, replay the
 * newest burns with the same rule files, then answer "would this burn be refused, and why?" with V2Rules.sendBlock.
 * The page asks it first (POST /xp/v1/check) and falls back to its own check when the answer is missing, slow or behind.
 * It decides nothing on chain: a wrong answer can only let a player send a burn the replay then ignores, as a stale page can today.
 * Messages from the parent (process.send IPC):
 *   { cmd: 'load', codeDir, worldDir, rsig, rows, hashes, tip, dex }  drop the old world, load worldDir's checkpoint, replay to tip
 *   { cmd: 'check', id, plans, me, pending }                       answer { id, ok, tip, plans, skip }
 * It runs only between world builds (the parent stops it before a build starts), so the two never hold a world at once. */
const fs = require('fs'), path = require('path'), vm = require('vm');
let world = null, ownerTable = null, ctx = null, Art = null, loaded = { tip: 0, rsig: '', ms: 0 };
function send(m) { try { if (process.send) process.send(m); } catch (e) { } }
function mem() { const u = process.memoryUsage(); return { rssMB: u.rss >> 20, heapMB: u.heapUsed >> 20 }; }
function load(m) {
  const t0 = Date.now();
  world = null; ownerTable = null; ctx = null; if (global.gc) global.gc();
  const code = m.codeDir && fs.existsSync(path.join(m.codeDir, 'tools', 'sync-server', 'snapshot.js')) ? m.codeDir : path.resolve(__dirname, '..', '..');
  const S = require(path.join(code, 'tools', 'sync-server', 'snapshot.js'));
  const C = require(path.join(code, 'tools', 'sync-server', 'client.js')).bootSync();
  const R = require(path.join(code, 'js', 'v2-resume.js'));
  Art = require(path.join(code, 'js', 'v2-art.js'));
  /* the world must have been built from these exact rule files */
  const rsig = S.rulesSig(S.loadBytes(code));
  if (m.rsig && rsig !== m.rsig) throw new Error('rules differ');
  const man = JSON.parse(fs.readFileSync(path.join(m.worldDir, 'manifest.json'), 'utf8')), cp = man.checkpoint;
  if (!cp || !cp.root || !cp.meta) throw new Error('no checkpoint');
  const read = f => C.unmarkValue(JSON.parse(fs.readFileSync(path.join(m.worldDir, f.url), 'utf8')));
  let root = read(cp.root); let parts = (cp.files || []).map(read); const meta = read(cp.meta);
  /* a fresh engine per load: the rules keep some switches in memory during a replay (pools, eras), as the builder's fresh process does */
  ctx = S.workerFns(); S.replayWorld(ctx, [], {}, meta.tip, null);
  const w = R.wsDecode(root, parts); root = null; parts = null;
  ownerTable = w._owners || null;
  if (w._owners || w._hashes) Art.restore(w, ctx.PetCore, { ftLook: ctx.V2Rules.ftLookOfTier ? t => ctx.V2Rules.ftLookOfTier(t) : null });
  const seen = {}; (meta.seen || []).forEach(k => { seen[k] = 1; });
  ctx.__rows = m.rows || []; ctx.__hashes = m.hashes || {}; ctx.__tip = m.tip || meta.tip; ctx.__dex = m.dex || undefined;
  ctx.__res = { w: w, seen: seen, dexPos: meta.dexPos || 0, grand: meta.grand ? 1 : 0, tip: meta.tip };
  vm.runInContext('if (__dex && self.V2Sales && self.V2Sales.normalizeDex) __dex = self.V2Sales.normalizeDex(__dex);' +
    '__world = self.V2Rules.replay(__rows, __hashes, [], { tip: __tip, live: self.LiveEngine.RealCore, dex: __dex, _resume: __res });', ctx);
  world = ctx.__world; ctx.__world = null; ctx.__rows = null; ctx.__hashes = null; ctx.__dex = null; ctx.__res = null;
  loaded = { tip: world.tip, rsig: rsig, ms: Date.now() - t0 };
  if (global.gc) global.gc();
  return Object.assign({ tip: world.tip, from: meta.tip, pets: (world.pets || []).length, ms: loaded.ms }, mem());
}
/* Same as resolveChecked in js/v2-verify-worker.js: fill a checkpoint owner marker before the owner checks read it. */
function resolveChecked(plan) {
  if (!world || !world.byId || !Art || !Art.resolvePetOwner) return;
  const t = ctx.V2Rules.parseTag ? ctx.V2Rules.parseTag(plan && plan.tag) : null; if (!t) return;
  const ids = Art.tagPetIds ? Art.tagPetIds(t) : [], list = world.pets || [];
  for (const id of ids) {
    const p = world.byId[id]; if (!p) continue;
    if (!(typeof p.owner === 'string' && p.owner)) { for (const sib of list) { if (sib && sib.id === p.id && sib !== p && typeof sib.owner === 'string' && sib.owner) { p.owner = sib.owner; break; } } }
    Art.resolvePetOwner(p, { checkpoint: ownerTable });
  }
}
function check(m) {
  if (!world || !ctx || !ctx.V2Rules || !ctx.V2Rules.sendBlock) return { id: m.id, ok: false, error: 'not ready' };
  const plans = m.plans || [], pending = (m.pending || []).slice(), kept = [], skip = [];
  for (const plan of plans) {
    resolveChecked(plan);
    const why = ctx.V2Rules.sendBlock(world, plan, world.tip, { me: m.me || '', pending: pending });
    if (why) skip.push(why); else { kept.push(plan); if (plan && plan.tag) pending.push(plan.tag); }
  }
  return { id: m.id, ok: true, tip: world.tip, plans: kept, skip: skip };
}
process.on('message', m => {
  if (!m || typeof m !== 'object') return;
  if (m.cmd === 'check') { let out; try { out = check(m); } catch (e) { out = { id: m.id, ok: false, error: 'check failed' }; } send(Object.assign({ cmd: 'checked' }, out)); return; }
  if (m.cmd === 'load') {
    let out; try { out = Object.assign({ cmd: 'loaded', ok: true }, load(m)); } catch (e) { world = null; out = Object.assign({ cmd: 'loaded', ok: false, error: String(e && (e.code || e.message) || e).replace(/[\/][^ ]*/g, '[path]').slice(0, 80) }, mem()); }
    send(out); return;
  }
  if (m.cmd === 'mem') send(Object.assign({ cmd: 'mem', tip: world ? world.tip : 0 }, mem()));
});
process.on('disconnect', () => process.exit(0));
module.exports = { load, check };
