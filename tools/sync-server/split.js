'use strict';
/* Pre-indexed view written beside a world snapshot. Display only.
 * One walk of the replayed world: a summary (counts, community, Cold Storage,
 * leaderboard), an owner shard (sha256 of the address, first two hex digits),
 * and a pet-detail shard (2,000 ids each). The page paints from these and does
 * not reindex the full world. Keyed by the snapshot directory, which is already
 * rules-signature + tip. Missing or stale files are the page's fallback. */
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto'), zlib = require('zlib');
const Art = require('../../js/v2-art');
const PET_SHARD = 2000;
const PAGE = 24;
const COLD_KEYS = ['wizard', 'kek', 'homer', 'rabbit', 'groyper', 'funtrump', 'djpepe']; /* groyper: community pet #7 (Nov 24 2026); reaches the VPS with a server-repair code update */

function ownerKey(addr) {
  return crypto.createHash('sha256').update(String(addr || '')).digest('hex');
}
function ownerShard(addr) {
  return ownerKey(addr).slice(0, 2);
}
function liveBreedReqs(world, tip) {
  const out = [], list = (world && world.breedReqs) || [];
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    if (!r || r.used || !(tip - (r.block | 0) <= 144 + 48)) continue;
    out.push({ a: r.a, b: r.b, block: r.block, tx: r.tx || null, owner: r.owner || null });
  }
  return out;
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
/* Rankings boards that are not about pets (Nov 24 2026, Jake: "Top burners not showing in rankings"). Root cause: the Top burners
 * board and Battle wins "This week" were counted on the page from the chain burn list and the fight list, and a fast-loaded page
 * has neither (it paints from these view files), so both boards were empty for everyone on the fast path. The server already has
 * both lists, so it counts them here with exactly the page's own rules and the page reads them from the summary:
 *  - burnBy: { address: [all time, this week] } XCPETS burned. Same as the page's tally(): valid rows only, amount or quantity / 1e8,
 *    "this week" = block > tip - 1,008. Falls back to the replay's own world.burnedBy (all time) when no rows are given.
 *  - winsWk: { petId: wins } battles won this week (done fights whose accept block is > tip - 1,008), keyed by the winning pet. */
const WEEK_BLOCKS = 1008;
const r8 = v => Math.round((Number(v) || 0) * 1e8) / 1e8;
function burnTotals(world, tip, rows) {
  const all = {}, wk = {}, out = {};
  if (Array.isArray(rows) && rows.length) {
    const seen = new Set();
    for (const r of rows) {
      if (!r || !r.source || (r.tx_hash && seen.has(r.tx_hash))) continue;
      if (r.tx_hash) seen.add(r.tx_hash);
      if (r.status != null && String(r.status).toLowerCase() !== 'valid') continue;
      const b = Number(r.block_index);
      if (tip && b > tip) continue;
      const a = r.amount != null ? Number(r.amount) || 0 : (Number(r.quantity) || 0) / 1e8;
      all[r.source] = (all[r.source] || 0) + a;
      if (b > tip - WEEK_BLOCKS) wk[r.source] = (wk[r.source] || 0) + a;
    }
  } else if (world && world.burnedBy) Object.keys(world.burnedBy).forEach(a => { all[a] = world.burnedBy[a]; });
  Object.keys(all).forEach(a => { if (all[a] > 0 || wk[a] > 0) out[a] = [r8(all[a]), r8(wk[a] || 0)]; });
  return out;
}
function weekWins(world, tip) {
  const out = {};
  (world && world.fights || []).forEach(f => { if (f && f.status === 'done' && f.acceptBlock != null && f.acceptBlock > tip - WEEK_BLOCKS && f.winner != null) out[f.winner] = (out[f.winner] || 0) + 1; });
  return out;
}
function communityCopy(c, world) {
  if (!c) return null;
  const o = copy(c) || {};
  /* raise-tip (Nov 24 2026, display only): each wallet's share of the current community pet's care (the rules' w[<pet>].by map),
   * so the fast page can show 'you raised X (#N of M)' without a replay. Rounded to 8 decimals, biggest first. */
  const R = world && c.current && world[c.current];
  if (R && R.by) o.raisers = { pet: c.current, list: Object.keys(R.by).filter(a => R.by[a] > 0).map(a => [a, Math.round(R.by[a] * 1e8) / 1e8]).sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1)) };
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
    community: communityCopy(world.community, world),
    cold: coldCopy(world),
    leaderboard: (world.community && world.community.leaderboard || []).slice(0, 20),
    wagmi: copy(world.wagmi) || {},
    burnBy: burnTotals(world, world.tip || 0, null),
    winsWk: weekWins(world, world.tip || 0)
  };
  return { summary: summary, owners: owners, pets: pets };
}
/* Nov 24 2026 (instant load): every view file also gets a brotli (.br) and gzip (.gz) copy beside it; server.js already
 * sends those to browsers that accept them (as it does for the world parts). The view files compress ~22x (121 MB of
 * owner pages and pet shards -> 5.5 MB brotli, ~1.2 s per build), so a big wallet's first visit downloads megabytes,
 * not tens of megabytes. The .json file itself is unchanged and stays the source. */
function writeJson(file, obj) {
  const json = JSON.stringify(obj);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, json);
  if (json.length > 1024) {
    try {
      const buf = Buffer.from(json);
      fs.writeFileSync(file + '.br', zlib.brotliCompressSync(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buf.length } }));
      fs.writeFileSync(file + '.gz', zlib.gzipSync(buf, { level: 6 }));
    } catch (e) { try { fs.rmSync(file + '.br', { force: true }); fs.rmSync(file + '.gz', { force: true }); } catch (e2) {} }
  }
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
/* lead file (view/p/99900.json; the server already serves view/p/<5 digits>.json, so no server restart is needed, and pet shards
 * stop far below it: id / 2000). Built from the rank rows, so every number matches what the page computes from rank.json:
 *  - tops: for each pet board (WAGMI, power, wins, oldest) the ids of the best LEAD_TOP living pets, plus the board's size,
 *  - players: for each player board (pets, rare, legendary, wins, power; all time and, where the board has it, this week) the
 *    best LEAD_TOP wallets as [owner index, value, best pet id] and the number of wallets on it,
 *  - best: each wallet's best pet by rarity then stage (WAGMI and burn boards) for the wallets those boards can show,
 *  - pets: the rank rows of every pet named above and every tokenized pet (dead ones too, so Proof Parade can leave them out).
 * The page shows the first rows from it and reads rank.json only when someone asks for more (species, Show more, Find, a week). */
const LEAD_SHARD = '99900', LEAD_TOP = 300, SHOP_SHARD = '99901';
function leadFile(rows, hashes, tip, rsig, who, deedIds) {
  const RW = [1, 3, 10, 33], WEEK = 1008, live = rows.filter(r => !r.dead && !r.rel && (r.id | 0) !== 1765);
  const want = new Set(), tops = {}, players = {}, counts = {};
  const pw = r => (r.sg || []).reduce((a, v) => a + (v || 0), 0);
  function top(id, list, cmp) { list.sort(cmp); counts[id] = list.length; tops[id] = list.slice(0, LEAD_TOP).map(r => r.id); tops[id].forEach(x => want.add(x)); }
  top('wagmi', live.slice(), (a, b) => ((b.st * 1e7 + (b.sk || 0) * 1e5 + Math.min(b.care || 0, 99999)) - (a.st * 1e7 + (a.sk || 0) * 1e5 + Math.min(a.care || 0, 99999))) || a.id - b.id);
  top('power', live.filter(r => pw(r) > 0), (a, b) => pw(b) - pw(a) || a.id - b.id);
  top('wins', live.filter(r => (r.w || 0) > 0), (a, b) => (b.w || 0) - (a.w || 0) || a.id - b.id);
  top('old', live.filter(r => r.hb != null), (a, b) => a.hb - b.hb || a.id - b.id);
  /* players: same walk as the page (pets in id order; a better pet replaces the kept one only when strictly better) */
  const better = (p, b) => !b || p.ti > b.ti || (p.ti === b.ti && p.st > b.st);
  function agg(id, week) {
    const m = new Map(), best = new Map();
    for (const r of live) {
      const o = r.o, fresh = !week || (r.hb != null && r.hb > tip - WEEK);
      if (id === 'power') { const v = pw(r); if (!m.has(o) || v > m.get(o)) { m.set(o, v); best.set(o, r); } continue; }
      let v = 0, add = false;
      if (id === 'pets' && fresh) { v = 1; add = true; }
      if (id === 'rare' && fresh) { v = RW[r.ti] || 0; add = true; }
      if (id === 'leg' && fresh && r.ti === 3) { v = 1; add = true; }
      if (id === 'wins') { v = r.w || 0; add = true; }
      if (!add) continue;
      m.set(o, (m.get(o) || 0) + v); if (better(r, best.get(o))) best.set(o, r);
    }
    const L = [...m.entries()].filter(e => e[1] > 0);
    L.sort((a, b) => b[1] - a[1] || 0);
    const key = id + (week ? ':week' : '');
    counts['players:' + key] = L.length;
    players[key] = L.slice(0, LEAD_TOP).map(e => { const b = best.get(e[0]); if (b) want.add(b.id); return [e[0], e[1], b ? b.id : 0]; });
  }
  ['pets', 'rare', 'leg', 'wins', 'power'].forEach(id => agg(id, false));
  ['pets', 'rare', 'leg'].forEach(id => agg(id, true));
  const best = {}, bestT = {};
  for (const r of live) { if (better(r, best[r.o])) best[r.o] = r; if (!bestT[r.o] || r.ti > bestT[r.o].ti) bestT[r.o] = r; }
  const bestOut = {};
  /* only wallets the WAGMI and burn boards can list (who: owner indexes of WAGMI sayers and the biggest burners) */
  Object.keys(best).forEach(o => { if (who && !who.has(+o)) return; bestOut[o] = [best[o].id, bestT[o].id]; want.add(best[o].id); want.add(bestT[o].id); });
  const used = [], hmap = new Map(), pets = [];
  for (const r of rows) {
    if (!want.has(r.id) && !r.dd && !(deedIds && deedIds.has(r.id))) continue;
    const c = Object.assign({}, r);
    if (c._h != null) { const h = hashes[c._h]; let ix = hmap.get(h); if (ix == null) { ix = used.length; used.push(h); hmap.set(h, ix); } c._h = ix; }
    pets.push(c);
  }
  /* living pets per wallet (community pets left out, as the NGMI list does) and the species on the boards */
  const own = new Map(), sp = new Set();
  for (const r of live) { if (r.sp) sp.add(r.sp); if (!r.cm) own.set(r.o, (own.get(r.o) || 0) + 1); }
  return { v: 1, lead: 1, tip: tip, rsig: rsig, live: live.length, counts: counts, tops: tops, players: players, best: bestOut, own: [...own.entries()], species: [...sp].sort(), hashes: used, pets: pets };
}
function godsOf(world) {
  return (world.pets || []).filter(p => p && p.resurrected && !p.dead).map(p => ({ id: p.id, name: p.name || '', owner: p.owner || '', block: p.resurrected.block || 0 }))
    .sort((a, b) => b.block - a.block || a.id - b.id);
}
/* Nov 24 2026 (Jake: "This says snibby still"): cross pets (art.cross, the 1 of 1 mixes like Star-Lord Pigeon) show a name that is not
 * their stored species. Pages that load the rules call V2Rules.petSpeciesLabel; the Telegram mini app does not load the rules, so the
 * summary carries the shown name of each cross pet (id -> label), made by the same rules function. A handful of tiny records. */
function crossNamesOf(world, V) {
  const out = {};
  if (!V || typeof V.petSpeciesLabel !== 'function') return out;
  (world.pets || []).forEach(p => { if (p && p.art && p.art.cross) { try { const l = V.petSpeciesLabel(p); if (l) out[p.id] = l; } catch (e) { /* label only */ } } });
  return out;
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
  /* before spill(): it frees world.pets as it goes (memory), so anything read from the pets must be taken first */
  const crossNames = crossNamesOf(world, meta && meta.ctx && meta.ctx.V2Rules);
  const gods = godsOf(world);
  return spill().then(() => {
  const summary = {
    v: 3, tip: tip, rsig: rsig, n: n, alive: alive, dead: dead, released: released,
    owners: 'view/owners.json', rank: 'view/rank.json', slim: 1,
    pageSize: PAGE,
    burned: world.community && world.community.burned || 0,
    burns: world.log ? world.log.length : 0,
    community: communityCopy(world.community, world),
    cold: coldCopy(world),
    leaderboard: (world.community && world.community.leaderboard || []).slice(0, 20),
    wagmi: copy(world.wagmi) || {},
    /* Rankings: XCPETS burned per wallet and this week's battle wins per pet (see burnTotals). A few KB. */
    burnBy: burnTotals(world, tip, meta && meta.rows),
    winsWk: weekWins(world, tip),
    /* Nov 22 2026: raids were missing from the slim view, so the Raid page said 'waiting for the opening block hash' on every
     * fast load and the catch-up sweep could not rebuild them (it needs raid 1's old opening hash). A few small records. */
    raids: copy(world.raids) || [],
    /* Seasons (gated by ACTIVATE_SEASONS_BLOCK): eggs sold, points and tiers per wallet. Small; the season bar and the catch-up sweep need it. */
    seasons: copy(world.seasons) || {},
    /* Pantry (prepaid meals; gated by ACTIVATE_PANTRY_BLOCK): each player's balance and pet list, so the slim Play page shows it */
    pantry: copy(world.pantry) || null, pantryDay: world.pantryDay != null ? world.pantryDay : null,
    /* Meat Grinder (gated by ACTIVATE_GRIND_BLOCK): each wallet's meat meter and last grind, so the slim My Pets shows it */
    grind: copy(world.grind) || null,
    /* Nov 23 2026 (players: 'no indicator for the person receiving a Gooby's request'): the slim world had no breed requests at all,
     * so the Motel desk, the 'Asking you' shelf and the pending box were empty on every fast load. Only the open ones (not used,
     * inside the 144-block window plus the page's 48-block staleness margin) ride here; a few small records. */
    breedReqs: liveBreedReqs(world, tip),
    /* shown species name of each cross pet (see crossNamesOf) */
    crossNames: crossNames,
    /* Nov 24 2026 (fastcheck): the cemetery's Gods door counted only the Gods a fast page happened to load (0, 2 or 6 instead of 19).
     * Every living Resurrected pet rides here (id, name, owner, block): a few dozen tiny records. */
    gods: gods
  };
  /* the biggest burners by XCPETS burned (the Top burners board), not the community pet's feeders list this used to read */
  const leadBurners = Object.keys(summary.burnBy || {}).map(a => ({ address: a, amount: summary.burnBy[a][0] })).sort((a, b) => b.amount - a.amount || (a.address < b.address ? -1 : 1));
  /* every pet that was ever tied to a token (a destroyed token too), so Proof Parade gives the same answer as from rank.json */
  const leadDeeds = new Set(); Object.keys(world.deeds || {}).forEach(a => { const d = world.deeds[a]; if (d && d.petId != null) leadDeeds.add(d.petId | 0); });
  function end(stream) { return new Promise(res => { stream.on('finish', res); stream.end(); }); }
  return Promise.all(outs.map(end).concat([...petOut.values()].map(end), [end(zstream), end(rankOut)])).then(() => {
    let bytes = 0, files = 0, largestOwner = { bytes: 0, file: '', n: 0 }, largestPage = { bytes: 0, file: '' }, largestShard = { bytes: 0, file: '' };
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
            /* Device copy (Nov 24 2026): every living id of the wallet, in page order, delta-coded, on page 0. Page k is
             * ord.slice(k*PAGE, (k+1)*PAGE) with the same header, so a big wallet's 1,000+ id pages need no request each. */
            if (pg === 0 && list === living && pages > 1) { let prev = 0; body.ord = list.map(r => { const d = r.rec.id - prev; prev = r.rec.id; return d; }); }
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
    const petDir = path.join(dir, 'p'), shardSig = {};
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
      /* Device copy (Nov 24 2026): a digest of what the page reads from the shard (not the tip). Between two published
       * worlds 6 blocks apart about 100 of 103 shards are the same, so a returning player keeps its saved copy of those. */
      shardSig[shard] = crypto.createHash('sha256').update(JSON.stringify({ hashes: used, pets: pets })).digest('hex').slice(0, 20);
      const nb = writeJson(path.join(petDir, shard + '.json'), { v: 3, tip: tip, rsig: rsig, hashes: used, pets: pets });
      bytes += nb; files++;
      if (nb > largestShard.bytes) largestShard = { bytes: nb, file: 'view/p/' + shard + '.json' };
    });
    summary.shardSig = shardSig;
    bytes += writeJson(path.join(dir, 'summary.json'), summary); files++;
    const ztext = fs.readFileSync(path.join(tmp, 'zombies.ndjson'), 'utf8');
    const zpets = [];
    ztext.split('\n').forEach(line => { if (!line) return; zpets.push(JSON.parse(line)); });
    const huntedBy = (world.cem && world.cem.huntedBy) || {};
    /* open altars (pledges held for a seance), so the slim cemetery shows pieces a player already gave */
    const altars = {}; Object.keys((world.cem && world.cem.altars) || {}).forEach(k => { const a = world.cem.altars[k]; if (a && a.status === 'open') altars[k] = a; });
    /* Mythic God table (Nov 25 2026): the Pantheon seats, the meals, the unleash list and the per-wallet clocks.
     * Without it a page on the fast world read 0 of 21 seats, lost a pending unleash from the zombie's card and
     * could not check the 30-day unleash / God gaps before a burn. 21 seats + a few dozen unleashes: tiny. */
    const mgSrc = (world.cem && world.cem.mg) || null;
    const mg = mgSrc ? { seats: mgSrc.seats || [], meals: mgSrc.meals || [], unleash: mgSrc.unleash || [], byWallet: mgSrc.byWallet || {}, godBy: mgSrc.godBy || {} }
      : { seats: [], meals: [], unleash: [], byWallet: {}, godBy: {} };
    bytes += writeJson(path.join(dir, 'zombies.json'), { v: 2, tip: tip, rsig: rsig, n: zpets.length, huntedBy: huntedBy, altars: altars, mg: mg, pets: zpets });
    files++;
    bytes += writeJson(path.join(dir, 'owners.json'), owners); files++;
    const rankPets = [];
    const rankText = fs.readFileSync(path.join(tmp, 'rank.ndjson'), 'utf8');
    rankText.split('\n').forEach(line => { if (line) rankPets.push(JSON.parse(line)); });
    rankPets.sort((a, b) => a.id - b.id);
    const leadWho = new Set();
    Object.keys(summary.wagmi || {}).forEach(a => { const i = omap.get(a); if (i != null) leadWho.add(i); });
    (leadBurners || []).slice(0, LEAD_TOP).forEach(e => { const i = omap.get(e && (e.address || e.addr || e.source)); if (i != null) leadWho.add(i); });
    bytes += writeJson(path.join(dir, 'rank.json'), { v: 3, tip: tip, rsig: rsig, owners: owners, hashes: hashes, pets: rankPets }); files++;
    /* lead file (Nov 23 2026, Jake: Rankings and Proof Parade took ~15 s on a phone reading every pet in rank.json): a small
     * file with the top of every board and every tokenized pet, so those pages paint in a second or two. See leadFile(). */
    bytes += writeJson(path.join(dir, 'p', LEAD_SHARD + '.json'), leadFile(rankPets, hashes, tip, rsig, leadWho, leadDeeds)); files++;
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
    /* Counts and keys only. The old list put every pet of the largest wallets into the manifest,
     * and that file grew past 10 MB. A phone then sat on it and never painted. */
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([owner, count]) => ({ owner: owner, n: count, key: ownerKey(owner) }));
    return { v: 2, summary: 'view/summary.json', owners: 'view/own', pets: 'view/p', pageSize: PAGE, ownerShard: 'sha256', petShard: PET_SHARD, files: files, bytes: bytes, n: n, alive: alive, largestOwner: largestOwner, largestPage: largestPage, largestShard: largestShard, top: ranked, sample: sample };
  });
  });
}
/* Spam City shelves (Nov 24 2026): the order book pack the shop page needs (listings, the pets they name, their pet tokens, the dex
 * orders), written with every published world. Same fields as checker.js shop() and js/v2-orderbook-worker.js. The page shows it at
 * once and reads the newest blocks before any wallet window, so the live /xp/v1/shop (down while a world builds) is no longer the
 * only fast path. Display only. */
function shopPet(p) {
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
function shopPack(world, V, orders, tip, rsig) {
  const w = world, listings = w.listings || [], ids = {}, pets = [], deeds = {};
  listings.forEach(S => { if (S && S.petId != null) ids[S.petId] = 1; });
  Object.keys(ids).forEach(id => { const p = w.byId && w.byId[id]; if (p) pets.push(shopPet(p)); });
  pets.forEach(pet => { if (pet.deed && w.deeds && w.deeds[pet.deed]) deeds[pet.deed] = w.deeds[pet.deed]; });
  listings.forEach(S => { if (S && S.give && w.deeds && w.deeds[S.give]) deeds[S.give] = w.deeds[S.give]; });
  let open = 0; listings.forEach(S => { try { if (V && V.saleState(w, S, (tip || 0) + 1) === 'open') open++; } catch (e) { } });
  return JSON.parse(JSON.stringify({ v: 1, ok: true, tip: tip, rsig: rsig, listings: listings, pets: pets, deeds: deeds, orders: orders || [], n: (w.pets || []).length, open: open }));
}
function writeShop(dir, world, meta) {
  const tip = meta && meta.tip != null ? meta.tip : (world.tip || 0);
  const V = meta && meta.ctx && meta.ctx.V2Rules;
  const pack = shopPack(world, V, meta && meta.orders, tip, meta && meta.rsig || '');
  /* p/99901.json: the running server only serves view files it knows (summary/zombies/rank/owners/o/own/p), and a new name would
   * need a server repair; the p/ shard name works today, like the lead file (p/99900.json). Pet shards hold 2,000 ids each. */
  return { file: 'view/p/' + SHOP_SHARD + '.json', bytes: writeJson(path.join(dir, 'p', SHOP_SHARD + '.json'), pack), listings: pack.listings.length, open: pack.open };
}
module.exports = { burnTotals, weekWins, crossNamesOf, shopPack, writeShop, SHOP_SHARD, liveBreedReqs, godsOf, LEAD_SHARD, leadFile, PET_SHARD, PAGE, COLD_KEYS, ownerKey, ownerShard, petShard, fromWorld, write, itemRec, petRec, fieldsOf, isHybRec, deedRec, ownerSide };
