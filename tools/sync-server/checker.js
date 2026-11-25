'use strict';
/* Burn check service (Nov 23 2026, Jake approved "server check, device as backup"). A child process of xcpets-sync.
 * It does on the server what js/v2-verify-worker.js does in each browser: decode the published checkpoint, restore it, replay the
 * newest burns with the same rule files, then answer "would this burn be refused, and why?" with V2Rules.sendBlock.
 * The page asks it first (POST /xp/v1/check) and falls back to its own check when the answer is missing, slow or behind.
 * It decides nothing on chain: a wrong answer can only let a player send a burn the replay then ignores, as a stale page can today.
 * Messages from the parent (process.send IPC):
 *   { cmd: 'load', codeDir, worldDir, rsig, rows, hashes, tip, dex }  drop the old world, load worldDir's checkpoint, replay to tip
 *   { cmd: 'advance', rows, hashes, tip, dex }                     apply only the burns after the loaded world's tip (see advance())
 *   { cmd: 'check', id, plans, me, pending }                       answer { id, ok, tip, rsig, plans, skip }
 *   { cmd: 'shop', id }                                            answer { id, ok, tip, rsig, listings, pets, deeds, orders, open }
 *     Spam City's order book (Nov 23 2026): the same pack js/v2-orderbook-worker.js makes after a full replay in the browser.
 * It runs only between world builds (the parent stops it before a build starts), so the two never hold a world at once. */
const fs = require('fs'), path = require('path'), vm = require('vm');
let world = null, ownerTable = null, ctx = null, Art = null, Card = null, orders = [], shopPack = null, loaded = { tip: 0, rsig: '', ms: 0 }, seenKeys = null;
function send(m) { try { if (process.send) process.send(m); } catch (e) { } }
function mem() { const u = process.memoryUsage(); return { rssMB: u.rss >> 20, heapMB: u.heapUsed >> 20 }; }
function load(m) {
  const t0 = Date.now();
  world = null; ownerTable = null; ctx = null; orders = []; shopPack = null; seenKeys = null; if (global.gc) global.gc();
  const code = m.codeDir && fs.existsSync(path.join(m.codeDir, 'tools', 'sync-server', 'snapshot.js')) ? m.codeDir : path.resolve(__dirname, '..', '..');
  const S = require(path.join(code, 'tools', 'sync-server', 'snapshot.js'));
  const C = require(path.join(code, 'tools', 'sync-server', 'client.js')).bootSync();
  const R = require(path.join(code, 'js', 'v2-resume.js'));
  Art = require(path.join(code, 'js', 'v2-art.js'));
  /* pet share cards (card.js, hatchbot/art.js and the sprite scripts are installed with this service by server-repair, not by the rules
   * follower: v2-render.js changes often and every followed-file change restarts the service) */
  Card = { file: path.join(__dirname, 'card.js'), mod: null };
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
  orders = (m.dex && m.dex.orders) || [];
  world = ctx.__world; ctx.__world = null; ctx.__rows = null; ctx.__hashes = null; ctx.__dex = null; ctx.__res = null; seenKeys = seen;
  loaded = { tip: world.tip, rsig: rsig, ms: Date.now() - t0 };
  if (global.gc) global.gc();
  return Object.assign({ tip: world.tip, from: meta.tip, pets: (world.pets || []).length, ms: loaded.ms }, mem());
}
/* Nov 25 2026 (Jake: "the xcp wallet is not opening"): every new block used to drop this world and load the whole checkpoint again
 * (tens of seconds with no answers), so burns pressed then fell back to the slow check on the player's own device. Now a new block
 * only resumes the replay on the world already in memory with the burns after its tip, the same resume the catch-up worker runs
 * from a checkpoint. Checked with real burns: resuming 1, 3 and 5 blocks at a time gives the same world as a full replay
 * (tools/server-check-test.js), in about 1.5 s. Any error drops the world, and the manager then does a full load as before. */
function advance(m) {
  if (!world || !ctx || !seenKeys) throw new Error('not loaded');
  const t0 = Date.now(), from = world.tip;
  if (!(m.tip > from)) return Object.assign({ tip: from, from: from, ms: 0 }, mem());
  const w = world; world = null; shopPack = null; /* half-applied state must never answer */
  ctx.__rows = m.rows || []; ctx.__hashes = m.hashes || {}; ctx.__tip = m.tip; ctx.__dex = m.dex || undefined;
  ctx.__res = { w: w, seen: seenKeys, dexPos: w._dexPos || 0, grand: w._grand ? 1 : 0, tip: from };
  try {
    vm.runInContext('if (__dex && self.V2Sales && self.V2Sales.normalizeDex) __dex = self.V2Sales.normalizeDex(__dex);' +
      '__world = self.V2Rules.replay(__rows, __hashes, [], { tip: __tip, live: self.LiveEngine.RealCore, dex: __dex, _resume: __res });', ctx);
    world = ctx.__world;
  } finally { ctx.__world = null; ctx.__rows = null; ctx.__hashes = null; ctx.__dex = null; ctx.__res = null; }
  if (!world || world.tip !== m.tip) { world = null; throw new Error('advance missed the tip'); }
  orders = (m.dex && m.dex.orders) || orders;
  loaded.tip = world.tip;
  return Object.assign({ tip: world.tip, from: from, ms: Date.now() - t0 }, mem());
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
  return { id: m.id, ok: true, tip: world.tip, rsig: loaded.rsig, plans: kept, skip: skip };
}
/* Same as plainPet in js/v2-orderbook-worker.js: a pet's plain fields, gear as a count-sized empty list. */
function plainPet(p) {
  const o = {};
  for (const k of Object.keys(p)) {
    const v = p[k];
    if (v == null || typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') { o[k] = v; continue; }
    if (k === 'gear') { o.gear = new Array((v && v.length) || 0); continue; }
    if (Array.isArray(v)) { if (v.every(x => !(x && typeof x === 'object'))) o[k] = v.slice(); continue; }
    if (typeof v === 'object') { const c = {}; let ok = true; for (const kk of Object.keys(v)) { const vv = v[kk]; if (vv && typeof vv === 'object') { ok = false; break; } c[kk] = vv; } if (ok) o[k] = c; }
  }
  return o;
}
/* Spam City's pack, the same fields js/v2-orderbook-worker.js posts. Built once per world tip (a load or an advance clears it). */
function shop(m) {
  if (!world || !ctx || !ctx.V2Rules) return { id: m.id, ok: false, error: 'not ready' };
  if (!shopPack) {
    const w = world, V = ctx.V2Rules, listings = w.listings || [], ids = {}, pets = [], deeds = {};
    listings.forEach(S => { if (S && S.petId != null) ids[S.petId] = 1; });
    Object.keys(ids).forEach(id => { const p = w.byId[id]; if (p) pets.push(plainPet(p)); });
    pets.forEach(pet => { if (pet.deed && w.deeds && w.deeds[pet.deed]) deeds[pet.deed] = w.deeds[pet.deed]; });
    listings.forEach(S => { if (S && S.give && w.deeds && w.deeds[S.give]) deeds[S.give] = w.deeds[S.give]; });
    let open = 0; listings.forEach(S => { try { if (V.saleState(w, S, (w.tip || 0) + 1) === 'open') open++; } catch (e) { } });
    shopPack = JSON.parse(JSON.stringify({ tip: w.tip, rsig: loaded.rsig, listings: listings, pets: pets, deeds: deeds, orders: orders, n: (w.pets || []).length, open: open }));
  }
  return Object.assign({ id: m.id, ok: true }, shopPack);
}
/* Pet share card (share.js asks through the parent): { id, ok, tip, png (base64), meta } or { id, ok, none } for no such pet. */
function card(m) {
  if (!world || !ctx || !Card) return { id: m.id, ok: false, error: 'not ready' };
  if (!Card.mod) Card.mod = require(Card.file);
  const r = Card.mod.draw(ctx, world, m.pet);
  if (!r) return { id: m.id, ok: true, none: 1, tip: world.tip };
  return { id: m.id, ok: true, tip: world.tip, png: r.png.toString('base64'), meta: r.meta };
}
process.on('message', m => {
  if (!m || typeof m !== 'object') return;
  if (m.cmd === 'check') { let out; try { out = check(m); } catch (e) { out = { id: m.id, ok: false, error: 'check failed' }; } send(Object.assign({ cmd: 'checked' }, out)); return; }
  if (m.cmd === 'load') {
    let out; try { out = Object.assign({ cmd: 'loaded', ok: true }, load(m)); } catch (e) { world = null; out = Object.assign({ cmd: 'loaded', ok: false, error: String(e && (e.code || e.message) || e).replace(/[\/][^ ]*/g, '[path]').slice(0, 80) }, mem()); }
    send(out); return;
  }
  if (m.cmd === 'advance') {
    let out; try { out = Object.assign({ cmd: 'advanced', ok: true }, advance(m)); } catch (e) { world = null; seenKeys = null; out = Object.assign({ cmd: 'advanced', ok: false, error: String(e && (e.code || e.message) || e).replace(/[\/][^ ]*/g, '[path]').slice(0, 80) }, mem()); }
    send(out); return;
  }
  if (m.cmd === 'shop') { let out; try { out = shop(m); } catch (e) { out = { id: m.id, ok: false, error: 'shop failed' }; } send(Object.assign({ cmd: 'shopped' }, out)); return; }
  if (m.cmd === 'card') { let out; try { out = card(m); } catch (e) { out = { id: m.id, ok: false, error: 'card failed' }; } send(Object.assign({ cmd: 'carded' }, out)); return; }
  if (m.cmd === 'mem') send(Object.assign({ cmd: 'mem', tip: world ? world.tip : 0 }, mem()));
});
process.on('disconnect', () => process.exit(0));
module.exports = { load, advance, check, shop, card };
