'use strict';
/* Compact paged grave index written next to a world snapshot. Display only.
 * Rows are the fields the cemetery list needs. The browser asks for one page
 * (GET /xp/v1/graves). Replay, refList, and place-in-line math are not touched.
 * The one-shot snapshot (tools/sync-server/snapshot.js) calls writeFromWorld. */
const fs = require('fs'), path = require('path');
const GI = require('../../js/v2-grave-index');
const SHARD = 2000;
const cache = new Map();

function rowFromGrave(g, p) {
  p = p || {};
  return {
    id: g.id, name: g.name || ('#' + g.id), species: g.species, spl: g.species, tier: g.tier, stage: g.stage,
    stageName: g.stageName || '', owner: g.owner || '', gear: 0, power: g.deathPower || 0,
    born: p.hatchBlock != null ? p.hatchBlock : null, died: g.deathBlock, fed: p.lastFed != null ? p.lastFed : null,
    hybrid: !!(p.hybrid), days: g.daysDead, diff: g.diff, need: g.need, needLabel: g.needLabel || '',
    state: g.state || null, restUntil: g.restUntil || null, restOwner: g.restOwner || null, open: g.open ? 1 : 0,
    raisable: g.raisable ? 1 : 0, af: g.ageFactor != null ? g.ageFactor : 1, crumbles: g.crumbles || 0,
    mythic: g.mythic ? 1 : 0, rank: g.mythic ? 4 : g.tier, rbits: -1, oneIn: ''
  };
}
function fromWorld(ctx, world, tip) {
  const V = ctx && (ctx.V2Rules || (ctx.self && ctx.self.V2Rules));
  if (!V || !V.cemGraves || !world) return [];
  const b = (tip != null ? tip : world.tip || 0) + 1;
  const graves = V.cemGraves(world, b, { sort: 'id' });
  const out = new Array(graves.length);
  for (let i = 0; i < graves.length; i++) {
    const g = graves[i], p = world.byId && world.byId[g.id];
    const row = rowFromGrave(g, p);
    if (V.speciesLabel) row.spl = V.speciesLabel(g.species);
    if (V.isHybrid) row.hybrid = !!V.isHybrid(g.species);
    out[i] = row;
  }
  return out;
}
function writeIndex(dir, rows, meta) {
  fs.mkdirSync(dir, { recursive: true });
  const counts = GI.countsOf(rows);
  counts.v = 1;
  counts.tip = meta && meta.tip || 0;
  counts.shardSize = SHARD;
  counts.shards = Math.ceil(rows.length / SHARD) || 0;
  counts.builtAt = new Date().toISOString();
  for (let i = 0; i < counts.shards; i++) {
    const name = 'shard-' + String(i).padStart(5, '0') + '.json';
    fs.writeFileSync(path.join(dir, name), JSON.stringify(rows.slice(i * SHARD, (i + 1) * SHARD)));
  }
  fs.writeFileSync(path.join(dir, 'counts.json'), JSON.stringify(counts));
  cache.delete(dir);
  return counts;
}
function loadRows(dir) {
  const hit = cache.get(dir);
  const stamp = fs.existsSync(path.join(dir, 'counts.json')) ? fs.statSync(path.join(dir, 'counts.json')).mtimeMs : 0;
  if (hit && hit.stamp === stamp) return hit;
  const counts = JSON.parse(fs.readFileSync(path.join(dir, 'counts.json'), 'utf8'));
  const rows = [];
  for (let i = 0; i < (counts.shards || 0); i++) {
    const name = 'shard-' + String(i).padStart(5, '0') + '.json';
    const part = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
    for (let j = 0; j < part.length; j++) rows.push(part[j]);
  }
  const packed = { stamp: stamp, counts: counts, rows: rows };
  cache.set(dir, packed);
  return packed;
}
function answer(dir, q) {
  const packed = loadRows(dir);
  const page = GI.query(packed.rows, q || {});
  page.counts = { dead: packed.counts.dead, species: packed.counts.species, stages: packed.counts.stages, tip: packed.counts.tip };
  page.source = 'index';
  return page;
}
module.exports = { SHARD, rowFromGrave, fromWorld, writeIndex, loadRows, answer, query: GI.query };
