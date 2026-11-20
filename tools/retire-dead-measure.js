#!/usr/bin/env node
/* Read-only. Counts pets the retire rule would drop at the activation block,
 * using the published pet shards at the current tip. Does not sign or send.
 *   node tools/retire-dead-measure.js
 */
'use strict';
const https = require('https'), zlib = require('zlib');
const { load } = require('./lib/load-rules');
const V = load().V2Rules;
const TIP = 976787;
const AT = V.retireDeadGate();
const BASE = 'https://node.xcpets.fun/xp/v1/world/r3346c4c282d6b0e7a8ee30f3f4fa67f8/' + TIP + '/view/p/';
const TIERS = V.TIER_LABELS || ['Common', 'Uncommon', 'Rare', 'Legendary'];
const w = { mythicOwners: {}, everMythic: {}, tip: TIP, pets: [], byId: {} };

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'accept-encoding': 'identity' } }, res => {
      if (res.statusCode === 404) { res.resume(); return resolve(null); }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(url + ' HTTP ' + res.statusCode)); }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}
function deadNow(p) {
  if (!p || p.released) return false;
  if (p.id === 1765) return !!p.dead;
  const spare = V.retireSpareWhy(p);
  const dc = V.retireDeathClock(w, p, AT);
  if (dc == null) return !!(p.dead && spare);
  return V.clock(AT) >= dc;
}
function bump(map, k) { map[k] = (map[k] || 0) + 1; }

(async () => {
  const t0 = Date.now();
  const retired = { n: 0, tier: {}, species: {} }, spared = { n: 0, why: {}, tier: {} }, kept = { n: 0, tier: {} };
  const deadFlags = {};
  let electricDead = 0, electricRetired = 0;
  let pets = 0, alive = 0, released = 0, dead = 0, dyingSoon = 0, shardRaw = 0, shardAfter = 0, shardGz = 0, shardGzAfter = 0, shards = 0;
  for (let i = 0; i < 120; i++) {
    const name = String(i).padStart(5, '0') + '.json';
    const buf = await get(BASE + name);
    if (!buf) { if (i > 0) break; continue; }
    shards++;
    const text = buf.toString('utf8');
    const doc = JSON.parse(text);
    const keep = {};
    const ids = Object.keys(doc.pets || {});
    for (let k = 0; k < ids.length; k++) {
      const p = doc.pets[ids[k]];
      pets++;
      if (p.released) { released++; keep[ids[k]] = p; continue; }
      if (!p.dead) { alive++; if (deadNow(p)) dyingSoon++; keep[ids[k]] = p; continue; }
      dead++;
      const zap = !!(p.electric || (p.art && p.art.electric));
      if (zap) electricDead++;
      V.retireSpareFlags(p).forEach(function (f) { bump(deadFlags, f); });
      const why = V.retireSpareWhy(p);
      const tier = TIERS[p.tier | 0] || ('tier ' + p.tier);
      if (why) { spared.n++; bump(spared.why, why); bump(spared.tier, tier); keep[ids[k]] = p; }
      else if (V.retireDeadDue(w, p, AT)) {
        retired.n++; bump(retired.tier, tier); bump(retired.species, p.species || '');
        if (zap) electricRetired++;
      } else { kept.n++; bump(kept.tier, tier); keep[ids[k]] = p; }
    }
    const full = JSON.stringify(doc);
    const after = JSON.stringify({ v: doc.v, tip: doc.tip, rsig: doc.rsig, pets: keep });
    const fullN = Buffer.byteLength(full), afterN = Buffer.byteLength(after);
    shardRaw += buf.length; shardAfter += buf.length - (fullN - afterN);
    shardGz += zlib.gzipSync(buf, { level: 9 }).length;
    shardGzAfter += zlib.gzipSync(buf, { level: 9 }).length - (zlib.gzipSync(Buffer.from(full), { level: 9 }).length - zlib.gzipSync(Buffer.from(after), { level: 9 }).length);
    if (i === 0) process.stderr.write('shard0 file ' + buf.length + ' canon ' + fullN + '\n');
    if (i % 10 === 0) process.stderr.write('shard ' + name + ' pets ' + pets + '\n');
  }
  const topSp = Object.entries(retired.species).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const out = {
    tip: TIP, activation: AT, clockTip: V.clock(TIP), clockAt: V.clock(AT),
    gameDaysWait: (V.clock(AT) - V.clock(TIP)) / V.BLOCKS_PER_DAY,
    shards, pets, alive, dead, released, dyingSoon,
    retired, spared, deadUnder14: kept, deadFlags, electricDead, electricRetired,
    topRetiredSpecies: topSp,
    petShards: {
      rawBefore: shardRaw, rawAfter: shardAfter, rawSaved: shardRaw - shardAfter,
      gzipBefore: shardGz, gzipAfter: shardGzAfter, gzipSaved: shardGz - shardGzAfter
    },
    seconds: Math.round((Date.now() - t0) / 1000)
  };
  console.log(JSON.stringify(out, null, 2));
})().catch(e => { console.error(e); process.exit(1); });
