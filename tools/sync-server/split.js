'use strict';
/* Pre-indexed view written beside a world snapshot. Display only.
 * One walk of the replayed world: a summary (counts, community, Cold Storage,
 * leaderboard), an owner shard (sha256 of the address, first two hex digits),
 * and a pet-detail shard (2,000 ids each). The page paints from these and does
 * not reindex the full world. Keyed by the snapshot directory, which is already
 * rules-signature + tip. Missing or stale files are the page's fallback. */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const PET_SHARD = 2000;
const COLD_KEYS = ['wizard', 'kek', 'homer', 'rabbit', 'funtrump', 'djpepe'];

function ownerShard(addr) {
  return crypto.createHash('sha256').update(String(addr || '')).digest('hex').slice(0, 2);
}
function petShard(id) {
  const n = Math.floor(Number(id) / PET_SHARD);
  return String(n >= 0 ? n : 0).padStart(5, '0');
}
function plain(v, depth, seen) {
  if (v == null) return v;
  const t = typeof v;
  if (t === 'number' || t === 'string' || t === 'boolean') return v;
  if (t !== 'object') return undefined;
  if (depth > 8) return undefined;
  if (seen.has(v)) return undefined;
  seen.add(v);
  if (Array.isArray(v)) {
    const a = [];
    for (let i = 0; i < v.length; i++) if (i in v) a.push(plain(v[i], depth + 1, seen));
    return a;
  }
  const o = {};
  const ks = Object.keys(v);
  for (let i = 0; i < ks.length; i++) {
    const x = plain(v[ks[i]], depth + 1, seen);
    if (x !== undefined) o[ks[i]] = x;
  }
  return o;
}
function copy(v) {
  try { return JSON.parse(JSON.stringify(v)); } catch (e) { return plain(v, 0, new Set()); }
}
function itemRec(g) {
  if (!g) return null;
  return { gid: g.gid, item: g.item, label: g.label, slot: g.slot, tier: g.tier, legendary: g.legendary ? 1 : 0, owner: g.owner || '', on: g.on == null ? null : g.on, sig: g.sig || undefined };
}
function petRec(p, worn) {
  const rec = copy(p) || { id: p.id };
  rec.id = p.id;
  rec.owner = p.owner || '';
  rec.worn = worn || [];
  return rec;
}
function communityCopy(c) {
  if (!c) return null;
  const o = copy(c) || {};
  if (Array.isArray(o.leaderboard)) o.leaderboard = o.leaderboard.slice(0, 20);
  if (Array.isArray(o.gearLog)) o.gearLog = o.gearLog.slice(-40);
  return o;
}
function coldCopy(world) {
  const out = {};
  COLD_KEYS.forEach(k => {
    const src = world[k + 'Mythic'];
    out[k] = src ? copy(src) : null;
  });
  return out;
}
function fromWorld(world) {
  const wornBy = new Map();
  const items = world.items || {};
  const list = world.itemList || Object.keys(items).map(k => items[k]);
  for (let i = 0; i < list.length; i++) {
    const g = list[i];
    if (!g || g.on == null) continue;
    let a = wornBy.get(g.on);
    if (!a) wornBy.set(g.on, a = []);
    const rec = itemRec(g);
    if (rec) a.push(rec);
  }
  const owners = new Map();
  const pets = new Map();
  let alive = 0, dead = 0, released = 0;
  const all = world.pets || [];
  for (let i = 0; i < all.length; i++) {
    const p = all[i];
    if (!p) continue;
    if (p.released) released++;
    else if (p.dead) dead++;
    else alive++;
    const rec = petRec(p, wornBy.get(p.id) || []);
    const os = ownerShard(p.owner || '');
    let bucket = owners.get(os);
    if (!bucket) owners.set(os, bucket = {});
    const arr = bucket[p.owner || ''] || (bucket[p.owner || ''] = []);
    arr.push(rec);
    const ps = petShard(p.id);
    let pb = pets.get(ps);
    if (!pb) pets.set(ps, pb = {});
    pb[String(p.id)] = rec;
  }
  const summary = {
    v: 1, tip: world.tip || 0, n: all.length, alive: alive, dead: dead, released: released,
    burned: world.community && world.community.burned || 0,
    burns: world.log ? world.log.length : 0,
    community: communityCopy(world.community),
    cold: coldCopy(world),
    leaderboard: (world.community && world.community.leaderboard || []).slice(0, 20)
  };
  return { summary: summary, owners: owners, pets: pets };
}
function writeJson(file, obj) {
  const json = JSON.stringify(obj);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, json);
  return Buffer.byteLength(json);
}
function write(dir, world, meta) {
  const built = fromWorld(world);
  built.summary.rsig = meta && meta.rsig || '';
  built.summary.tip = meta && meta.tip != null ? meta.tip : built.summary.tip;
  let bytes = 0, files = 0;
  bytes += writeJson(path.join(dir, 'summary.json'), built.summary); files++;
  built.owners.forEach((bucket, shard) => {
    bytes += writeJson(path.join(dir, 'o', shard + '.json'), { v: 1, tip: built.summary.tip, rsig: built.summary.rsig, owners: bucket });
    files++;
  });
  built.owners.clear();
  built.pets.forEach((bucket, shard) => {
    bytes += writeJson(path.join(dir, 'p', shard + '.json'), { v: 1, tip: built.summary.tip, rsig: built.summary.rsig, pets: bucket });
    files++;
  });
  built.pets.clear();
  return { v: 1, summary: 'view/summary.json', owners: 'view/o', pets: 'view/p', ownerShard: 'sha256-2', petShard: PET_SHARD, files: files, bytes: bytes, n: built.summary.n, alive: built.summary.alive };
}
module.exports = { PET_SHARD, COLD_KEYS, ownerShard, petShard, fromWorld, write, itemRec, petRec };
