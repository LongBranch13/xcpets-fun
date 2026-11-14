'use strict';
/* Pre-indexed view written beside a world snapshot. Display only.
 * One walk of the replayed world: a summary (counts, community, Cold Storage,
 * leaderboard), an owner shard (sha256 of the address, first two hex digits),
 * and a pet-detail shard (2,000 ids each). The page paints from these and does
 * not reindex the full world. Keyed by the snapshot directory, which is already
 * rules-signature + tip. Missing or stale files are the page's fallback. */
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const PET_SHARD = 2000;
const PAGE = 24;
const COLD_KEYS = ['wizard', 'kek', 'homer', 'rabbit', 'funtrump', 'djpepe'];

function ownerKey(addr) {
  return crypto.createHash('sha256').update(String(addr || '')).digest('hex');
}
function ownerShard(addr) {
  return ownerKey(addr).slice(0, 2);
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
function fieldsOf(p) {
  return [p.id, p.owner || '', p.name || '', p.species, p.tier, p.stage, p.care || 0, p.dead ? 1 : 0, p.wins || 0, p.losses || 0];
}
/* Spill pets to disk one shard at a time so a 180k-pet world is not copied twice.
 * Each owner is then written in pages of PAGE pets. The first page is what a visit downloads. */
function write(dir, world, meta) {
  const tip = meta && meta.tip != null ? meta.tip : (world.tip || 0);
  const rsig = meta && meta.rsig || '';
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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'xcpets-view-'));
  const outs = new Array(256);
  const petOut = new Map();
  for (let i = 0; i < 256; i++) outs[i] = fs.createWriteStream(path.join(tmp, i.toString(16).padStart(2, '0') + '.ndjson'));
  let alive = 0, dead = 0, released = 0, n = 0;
  const counts = new Map();
  const fieldByOwner = new Map();
  const sample = [];
  const all = world.pets || [];
  function writeLine(stream, line) {
    if (stream.write(line)) return null;
    return new Promise(res => stream.once('drain', res));
  }
  async function spill() {
    for (let i = 0; i < all.length; i++) {
      const p = all[i];
      if (!p) continue;
      n++;
      if (p.released) released++;
      else if (p.dead) dead++;
      else alive++;
      const owner = p.owner || '';
      counts.set(owner, (counts.get(owner) || 0) + 1);
      let bag = fieldByOwner.get(owner);
      if (!bag) fieldByOwner.set(owner, bag = []);
      bag.push(fieldsOf(p));
      const rec = petRec(p, wornBy.get(p.id) || []);
      const key = ownerKey(owner);
      const line = JSON.stringify({ k: key, o: owner, rec: rec }) + '\n';
      const w1 = writeLine(outs[parseInt(key.slice(0, 2), 16)], line);
      if (w1) await w1;
      const ps = petShard(p.id);
      let po = petOut.get(ps);
      if (!po) { po = fs.createWriteStream(path.join(tmp, 'p-' + ps + '.ndjson')); petOut.set(ps, po); }
      const w2 = writeLine(po, JSON.stringify(rec) + '\n');
      if (w2) await w2;
      if (sample.length < 40) sample.push(fieldsOf(p));
      else if (Math.random() < 40 / n) sample[Math.floor(Math.random() * 40)] = fieldsOf(p);
      all[i] = null;
    }
    world.pets = null;
  }
  return spill().then(() => {
  const summary = {
    v: 2, tip: tip, rsig: rsig, n: n, alive: alive, dead: dead, released: released,
    pageSize: PAGE,
    burned: world.community && world.community.burned || 0,
    burns: world.log ? world.log.length : 0,
    community: communityCopy(world.community),
    cold: coldCopy(world),
    leaderboard: (world.community && world.community.leaderboard || []).slice(0, 20)
  };
  function end(stream) { return new Promise(res => { stream.on('finish', res); stream.end(); }); }
  return Promise.all(outs.map(end).concat([...petOut.values()].map(end))).then(() => {
    let bytes = 0, files = 0, largestOwner = { bytes: 0, file: '', n: 0 }, largestPage = { bytes: 0, file: '' }, largestShard = { bytes: 0, file: '' };
    bytes += writeJson(path.join(dir, 'summary.json'), summary); files++;
    const ownDir = path.join(dir, 'own');
    fs.mkdirSync(ownDir, { recursive: true });
    for (let i = 0; i < 256; i++) {
      const name = i.toString(16).padStart(2, '0');
      const text = fs.readFileSync(path.join(tmp, name + '.ndjson'), 'utf8');
      fs.rmSync(path.join(tmp, name + '.ndjson'));
      if (!text) continue;
      const by = new Map();
      text.split('\n').forEach(line => {
        if (!line) return;
        const row = JSON.parse(line);
        let arr = by.get(row.k);
        if (!arr) by.set(row.k, arr = []);
        arr.push(row);
      });
      by.forEach((rows, key) => {
        rows.sort((a, b) => ((a.rec.dead || a.rec.released) ? 1 : 0) - ((b.rec.dead || b.rec.released) ? 1 : 0) || (a.rec.id - b.rec.id));
        const pages = Math.ceil(rows.length / PAGE) || 1;
        for (let pg = 0; pg < pages; pg++) {
          const slice = rows.slice(pg * PAGE, (pg + 1) * PAGE).map(r => r.rec);
          const body = { v: 2, tip: tip, rsig: rsig, owner: rows[0].o, n: rows.length, page: pg, pages: pages, pageSize: PAGE, pets: slice };
          const file = pg === 0 ? key + '.json' : key + '.' + pg + '.json';
          const nb = writeJson(path.join(ownDir, file), body);
          bytes += nb; files++;
          const rel = 'view/own/' + file;
          if (pg === 0 && rows.length > largestOwner.n) largestOwner = { bytes: nb, file: rel, n: rows.length, pages: pages };
          if (nb > largestPage.bytes) largestPage = { bytes: nb, file: rel };
        }
      });
    }
    const petDir = path.join(dir, 'p');
    fs.mkdirSync(petDir, { recursive: true });
    petOut.forEach((stream, shard) => {
      const text = fs.readFileSync(path.join(tmp, 'p-' + shard + '.ndjson'), 'utf8');
      fs.rmSync(path.join(tmp, 'p-' + shard + '.ndjson'));
      const pets = {};
      text.split('\n').forEach(line => { if (!line) return; const rec = JSON.parse(line); pets[String(rec.id)] = rec; });
      const nb = writeJson(path.join(petDir, shard + '.json'), { v: 2, tip: tip, rsig: rsig, pets: pets });
      bytes += nb; files++;
      if (nb > largestShard.bytes) largestShard = { bytes: nb, file: 'view/p/' + shard + '.json' };
    });
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([owner, count]) => ({ owner: owner, n: count, key: ownerKey(owner), fields: fieldByOwner.get(owner) || [] }));
    fieldByOwner.clear();
    return { v: 2, summary: 'view/summary.json', owners: 'view/own', pets: 'view/p', pageSize: PAGE, ownerShard: 'sha256', petShard: PET_SHARD, files: files, bytes: bytes, n: n, alive: alive, largestOwner: largestOwner, largestPage: largestPage, largestShard: largestShard, top: ranked, sample: sample };
  });
  });
}
module.exports = { PET_SHARD, PAGE, COLD_KEYS, ownerKey, ownerShard, petShard, fromWorld, write, itemRec, petRec, fieldsOf };
