'use strict';
/* Pre-indexed view written beside a world snapshot. Display only.
 * One walk of the replayed world: a summary (counts, community, Cold Storage,
 * leaderboard), an owner shard (sha256 of the address, first two hex digits),
 * and a pet-detail shard (2,000 ids each). The page paints from these and does
 * not reindex the full world. Keyed by the snapshot directory, which is already
 * rules-signature + tip. Missing or stale files are the page's fallback. */
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const Art = require('../../js/v2-art');
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
function isHybRec(p) {
  return !!(p && (p.hybrid || (p.art && p.art.hybrid) || (typeof p.species === 'string' && (p.species.indexOf('hyb:') === 0 || p.species.indexOf('hyb3:') === 0))));
}
/* The light view never replays, so page 0 carries the two maps deedOf and petThresholds read. */
function deedRec(D) {
  if (!D) return null;
  const o = { petId: D.petId, holder: D.holder == null ? null : D.holder, block: D.block == null ? null : D.block, tx: D.tx || null, issuer: D.issuer || null };
  if (D.destroyed) o.destroyed = D.destroyed;
  if (D.untied) o.untied = D.untied;
  if (D.prev) o.prev = D.prev;
  return o;
}
function ownerSide(rows, world) {
  const owner = rows[0] && rows[0].o || '';
  const deeds = {};
  const species = {}, deadSpecies = {};
  let hybrid = 0, deadHybrid = 0, tokenized = 0, away = 0, zombies = 0, feral = 0, alive = 0, dead = 0;
  const rise = [];
  const src = world.deeds || {};
  for (let i = 0; i < rows.length; i++) {
    const p = rows[i].rec;
    if (!p) continue;
    const gone = !!(p.dead || p.released);
    const hyb = isHybRec(p);
    if (p.zombie && !p.zombie.end) { zombies++; if (p.feral) feral++; rise.push(p); }
    if (!gone) {
      alive++;
      if (hyb) hybrid++;
      else species[p.species || ''] = (species[p.species || ''] || 0) + 1;
    } else if (!p.released) {
      dead++;
      if (hyb) deadHybrid++;
      else deadSpecies[p.species || ''] = (deadSpecies[p.species || ''] || 0) + 1;
    }
    if (p.deed && src[p.deed]) {
      deeds[p.deed] = deedRec(src[p.deed]);
      const who = p.owner || rows[i].o || '';
      if (!gone && src[p.deed].holder === who) tokenized++;
      else if (!gone) away++;
    }
  }
  const mythicAt = world.mythicOwners && Object.prototype.hasOwnProperty.call(world.mythicOwners, owner) ? world.mythicOwners[owner] : null;
  return {
    deeds: deeds, mythicAt: mythicAt,
    roster: { alive: alive, dead: dead, species: species, hybrid: hybrid, deadSpecies: deadSpecies, deadHybrid: deadHybrid, tokenized: tokenized, away: away, zombies: zombies, feral: feral },
    rise: rise
  };
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
    leaderboard: (world.community && world.community.leaderboard || []).slice(0, 20),
    wagmi: copy(world.wagmi) || {}
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
function artOpt(meta) {
  const V = meta && meta.ctx && meta.ctx.V2Rules;
  const PC = meta && meta.ctx && (meta.ctx.PetCore || meta.ctx.self && meta.ctx.self.PetCore);
  return {
    PetCore: PC || null,
    ftLook: V && V.ftLookOfTier ? function (t) { return V.ftLookOfTier(t); } : null,
    itemOf: V && V.itemOf ? function (id) { return V.itemOf(id); } : null
  };
}
function traitVec(p) {
  const a = p.art || {};
  const cheek = a.cheeks === true ? 'blush' : (!a.cheeks ? 'none' : String(a.cheeks));
  const hy = !!(p.hybrid || a.hybrid || /^hyb:/.test(String(p.species || '')));
  return [hy ? 'hybrid' : String(p.species), a.eyes, a.pattern, a.background, cheek,
    p.mutation ? 'mut-' + (p.mutation.kind || 'odd') : 'none', p.shows ? 'tb-' + p.shows : 'none'];
}
function isComm(p) { return !!(p.community || (p.art && p.art.community)); }
function viewPet(p, worn, tables, opt) {
  const rec = copy(p) || { id: p.id };
  const note = opt && opt.PetCore && p.art ? Art.artNote(p, opt.PetCore, opt) : null;
  delete rec.art; delete rec.owner;
  rec.id = p.id;
  rec.o = tables.owner(p.owner || '');
  if (note && !note.keep) {
    rec._h = tables.hash(note.bh);
    if (note.as) rec.as = note.as;
    if (note.sid) rec.sid = note.sid;
    if (note.ax) rec.ax = note.ax;
    if (note.ac) rec._ac = 1;
  } else if (p.art) rec.art = copy(p.art);
  rec.worn = (worn || []).map(g => Art.slimGear(g) || g);
  return rec;
}
function streakAt(p, tip) {
  const fd = p.feedDays || {}, d0 = Math.floor((tip || 0) / 144);
  let d = fd[d0] ? d0 : d0 - 1, n = 0;
  while (fd[d]) { n++; d--; }
  return { sk: n, td: fd[d0] ? 1 : 0 };
}
function rankPet(p, rec, tip, hof, bits) {
  const s = p.stats || {}, st = streakAt(p, tip);
  const row = {
    id: p.id | 0, o: rec.o, name: p.name || '', sp: p.species || '', ti: p.tier | 0, st: p.stage | 0,
    sn: p.stageName || '', care: p.care || 0, w: p.wins || 0, l: p.losses || 0, hb: p.hatchBlock == null ? null : p.hatchBlock,
    sg: [s.vigor || 0, s.spark || 0, s.grit || 0, s.zoom || 0, s.luck || 0],
    dead: p.dead ? 1 : 0, rel: p.released ? 1 : 0, cm: isComm(p) ? 1 : 0, hy: p.hybrid ? 1 : 0, rs: p.resurrected || 0,
    par: p.parents && p.parents.length ? p.parents.length : 0, sk: st.sk, td: st.td, hf: hof, rb: bits,
    tx: p.hatchTx || '', dd: p.deed || ''
  };
  if (p.shards) row.shards = p.shards;
  if (p.mutation) row.mu = p.mutation;
  if (p.shows) row.shw = p.shows;
  if (p.blackEye) row.be = p.blackEye;
  if (p.crowned) row.cr = p.crowned;
  if (p.electric) row.el = 1;
  if (p.rareHatch) row.rareHatch = p.rareHatch;
  if (p.hybrid && typeof p.hybrid === 'object') row.hybrid = p.hybrid;
  if (rec._h != null) row._h = rec._h;
  if (rec.as) row.as = rec.as;
  if (rec.sid) row.sid = rec.sid;
  if (rec.ax) row.ax = rec.ax;
  if (rec._ac) row._ac = 1;
  if (rec._bh) row._bh = rec._bh;
  return row;
}
function stashRec(g) {
  const o = Art.slimGear(g);
  if (!o) return null;
  if (g.bag != null) o.bag = g.bag;
  return o;
}
function write(dir, world, meta) {
  const tip = meta && meta.tip != null ? meta.tip : (world.tip || 0);
  const rsig = meta && meta.rsig || '';
  const wornBy = new Map();
  const stashBy = new Map();
  const items = world.items || {};
  const list = world.itemList || Object.keys(items).map(k => items[k]);
  for (let i = 0; i < list.length; i++) {
    const g = list[i];
    if (!g) continue;
    if (g.on == null) {
      const who = g.owner || '';
      if (!who) continue;
      let bag = stashBy.get(who);
      if (!bag) stashBy.set(who, bag = []);
      const rec = stashRec(g);
      if (rec) bag.push(rec);
      continue;
    }
    let a = wornBy.get(g.on);
    if (!a) wornBy.set(g.on, a = []);
    const rec = itemRec(g);
    if (rec) a.push(rec);
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'xcpets-view-'));
  const outs = new Array(256);
  const petOut = new Map();
  const zstream = fs.createWriteStream(path.join(tmp, 'zombies.ndjson'));
  for (let i = 0; i < 256; i++) outs[i] = fs.createWriteStream(path.join(tmp, i.toString(16).padStart(2, '0') + '.ndjson'));
  const rankOut = fs.createWriteStream(path.join(tmp, 'rank.ndjson'));
  const opt = artOpt(meta);
  const owners = [], omap = new Map(), hashes = [], hmap = new Map();
  const tables = {
    owner: function (addr) { let i = omap.get(addr); if (i == null) { i = owners.length; owners.push(addr); omap.set(addr, i); } return i; },
    hash: function (h) { let i = hmap.get(h); if (i == null) { i = hashes.length; hashes.push(h); hmap.set(h, i); } return i; },
    hashes: hashes
  };
  const all = world.pets || [];
  const RF = {};
  let traitN = 0;
  for (let ti = 0; ti < all.length; ti++) {
    const tp = all[ti];
    if (!tp || isComm(tp) || tp.released || (tp.id | 0) === 1765) continue;
    traitN++;
    const vec = traitVec(tp);
    for (let t = 0; t < vec.length; t++) { const key = t + ':' + vec[t]; RF[key] = (RF[key] || 0) + 1; }
  }
  let alive = 0, dead = 0, released = 0, n = 0;
  const counts = new Map();
  const sample = [];
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
      const rec = viewPet(p, wornBy.get(p.id) || [], tables, opt);
      let bits = null;
      if (!isComm(p) && !p.released && (p.id | 0) !== 1765 && traitN) {
        const vec = traitVec(p); bits = 0;
        for (let t = 0; t < vec.length; t++) bits -= Math.log2((RF[t + ':' + vec[t]] || 1) / traitN);
      }
      const worn = wornBy.get(p.id) || [];
      let gn = 0, gt = 0;
      for (let gi = 0; gi < worn.length; gi++) { const g = worn[gi]; if (!g) continue; gn++; gt += g.legendary ? 3 : (g.tier | 0); }
      if ((p.id | 0) !== 1765) {
        const w2 = writeLine(rankOut, JSON.stringify(rankPet(p, rec, tip, [gn, gt], bits)) + '\n');
        if (w2) await w2;
      }
      const key = ownerKey(owner);
      const line = JSON.stringify({ k: key, o: owner, rec: rec }) + '\n';
      const w1 = writeLine(outs[parseInt(key.slice(0, 2), 16)], line);
      if (w1) await w1;
      const ps = petShard(p.id);
      let po = petOut.get(ps);
      if (!po) { po = fs.createWriteStream(path.join(tmp, 'p-' + ps + '.ndjson')); petOut.set(ps, po); }
      const w2 = writeLine(po, JSON.stringify(rec) + '\n');
      if (w2) await w2;
      if (p.zombie && !p.zombie.end) { const wz = writeLine(zstream, JSON.stringify(rec) + '\n'); if (wz) await wz; }
      if (sample.length < 40) sample.push(fieldsOf(p));
      else if (Math.random() < 40 / n) sample[Math.floor(Math.random() * 40)] = fieldsOf(p);
      all[i] = null;
    }
    world.pets = null;
  }
  return spill().then(() => {
  const summary = {
    v: 3, tip: tip, rsig: rsig, n: n, alive: alive, dead: dead, released: released,
    owners: 'view/owners.json', rank: 'view/rank.json', slim: 1,
    pageSize: PAGE,
    burned: world.community && world.community.burned || 0,
    burns: world.log ? world.log.length : 0,
    community: communityCopy(world.community),
    cold: coldCopy(world),
    leaderboard: (world.community && world.community.leaderboard || []).slice(0, 20),
    wagmi: copy(world.wagmi) || {},
    /* Nov 22 2026: raids were missing from the slim view, so the Raid page said 'waiting for the opening block hash' on every
     * fast load and the catch-up sweep could not rebuild them (it needs raid 1's old opening hash). A few small records. */
    raids: copy(world.raids) || []
  };
  function end(stream) { return new Promise(res => { stream.on('finish', res); stream.end(); }); }
  return Promise.all(outs.map(end).concat([...petOut.values()].map(end), [end(zstream), end(rankOut)])).then(() => {
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
        const living = rows.filter(r => !(r.rec.dead || r.rec.released));
        const graves = rows.filter(r => r.rec.dead || r.rec.released);
        const side = ownerSide(rows, world);
        function writeSet(list, nameOf, extraFor) {
          const pages = Math.ceil(list.length / PAGE) || (list === living ? 1 : 0);
          for (let pg = 0; pg < pages; pg++) {
            const slice = list.slice(pg * PAGE, (pg + 1) * PAGE);
            const ids = slice.map(r => r.rec.id);
            const extra = typeof extraFor === 'function' ? extraFor(pg) : extraFor;
            const body = Object.assign({ v: 3, tip: tip, rsig: rsig, owner: rows[0].o, n: list.length, alive: living.length, dead: graves.length, page: pg, pages: pages, pageSize: PAGE, ids: ids }, extra || {});
            if (pg === 0) {
              const used = [], map = new Map();
              function packPet(src) {
                const pet = Object.assign({}, src);
                pet.owner = rows[0].o;
                if (pet._h != null) {
                  const bh = hashes[pet._h];
                  let ix = map.get(bh);
                  if (ix == null) { ix = used.length; used.push(bh); map.set(bh, ix); }
                  pet._h = ix;
                }
                return pet;
              }
              body.pets = slice.map(r => packPet(r.rec));
              if (Array.isArray(body.rise) && body.rise.length) body.rise = body.rise.map(packPet);
              if (list === living) {
                const stash = stashBy.get(rows[0].o);
                if (stash && stash.length) body.stash = stash;
              }
              if (used.length) body.hashes = used;
            }
            const file = nameOf(pg);
            const nb = writeJson(path.join(ownDir, file), body);
            bytes += nb; files++;
            const rel = 'view/own/' + file;
            if (list === living && pg === 0 && living.length > largestOwner.n) largestOwner = { bytes: nb, file: rel, n: living.length, pages: pages };
            if (nb > largestPage.bytes) largestPage = { bytes: nb, file: rel };
          }
        }
        writeSet(living, pg => pg === 0 ? key + '.json' : key + '.' + pg + '.json', pg => pg === 0 ? { deeds: side.deeds, mythicAt: side.mythicAt, roster: side.roster, rise: side.rise } : null);
        writeSet(graves, pg => pg === 0 ? key + '.d.json' : key + '.d.' + pg + '.json', { graves: 1 });
      });
    }
    const petDir = path.join(dir, 'p');
    fs.mkdirSync(petDir, { recursive: true });
    petOut.forEach((stream, shard) => {
      const text = fs.readFileSync(path.join(tmp, 'p-' + shard + '.ndjson'), 'utf8');
      fs.rmSync(path.join(tmp, 'p-' + shard + '.ndjson'));
      const pets = {};
      const used = [], map = new Map();
      text.split('\n').forEach(line => {
        if (!line) return;
        const rec = JSON.parse(line);
        if (rec._h != null) {
          const bh = hashes[rec._h];
          let ix = map.get(bh);
          if (ix == null) { ix = used.length; used.push(bh); map.set(bh, ix); }
          rec._h = ix;
        }
        pets[String(rec.id)] = rec;
      });
      const nb = writeJson(path.join(petDir, shard + '.json'), { v: 3, tip: tip, rsig: rsig, hashes: used, pets: pets });
      bytes += nb; files++;
      if (nb > largestShard.bytes) largestShard = { bytes: nb, file: 'view/p/' + shard + '.json' };
    });
    const ztext = fs.readFileSync(path.join(tmp, 'zombies.ndjson'), 'utf8');
    const zpets = [];
    ztext.split('\n').forEach(line => { if (!line) return; zpets.push(JSON.parse(line)); });
    const huntedBy = (world.cem && world.cem.huntedBy) || {};
    /* open altars (pledges held for a seance), so the slim cemetery shows pieces a player already gave */
    const altars = {}; Object.keys((world.cem && world.cem.altars) || {}).forEach(k => { const a = world.cem.altars[k]; if (a && a.status === 'open') altars[k] = a; });
    bytes += writeJson(path.join(dir, 'zombies.json'), { v: 2, tip: tip, rsig: rsig, n: zpets.length, huntedBy: huntedBy, altars: altars, pets: zpets });
    files++;
    bytes += writeJson(path.join(dir, 'owners.json'), owners); files++;
    const rankPets = [];
    const rankText = fs.readFileSync(path.join(tmp, 'rank.ndjson'), 'utf8');
    rankText.split('\n').forEach(line => { if (line) rankPets.push(JSON.parse(line)); });
    rankPets.sort((a, b) => a.id - b.id);
    bytes += writeJson(path.join(dir, 'rank.json'), { v: 3, tip: tip, rsig: rsig, owners: owners, hashes: hashes, pets: rankPets }); files++;
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
    /* Counts and keys only. The old list put every pet of the largest wallets into the manifest,
     * and that file grew past 10 MB. A phone then sat on it and never painted. */
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([owner, count]) => ({ owner: owner, n: count, key: ownerKey(owner) }));
    return { v: 2, summary: 'view/summary.json', owners: 'view/own', pets: 'view/p', pageSize: PAGE, ownerShard: 'sha256', petShard: PET_SHARD, files: files, bytes: bytes, n: n, alive: alive, largestOwner: largestOwner, largestPage: largestPage, largestShard: largestShard, top: ranked, sample: sample };
  });
  });
}
module.exports = { PET_SHARD, PAGE, COLD_KEYS, ownerKey, ownerShard, petShard, fromWorld, write, itemRec, petRec, fieldsOf, isHybRec, deedRec, ownerSide };
