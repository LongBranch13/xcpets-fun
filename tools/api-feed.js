#!/usr/bin/env node
/* XCPETS public JSON feed (dev/CI tooling only; not loaded by any page).
 * Builds api/pets.json + api/meta.json by replaying XCPETS burns with this repo's own rule scripts, in the same order as play.html,
 * in a Node vm (same approach as tools/replay-check.js). Read-only: it only GETs public Counterparty / block-hash APIs. No secrets.
 *   node tools/api-feed.js                 live: read burns + tip + block hashes from the same APIs the site uses (rjs/chain.js), then replay
 *   node tools/api-feed.js --snap FILE     offline: replay a tools/snapshots/snap-N.json
 *   --out DIR (default api)   --now ISO (fixed generated time, for reproducible output)
 * Output is deterministic for a given (burns, tip): pets sorted by id, fixed key order, no timestamps in pets.json. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const A = process.argv.slice(2), opt = k => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : null; };
const ROOT = path.resolve(__dirname, '..'), OUT = path.resolve(ROOT, opt('--out') || 'api');
const SITE = 'https://xcpets.fun';
const SCRIPTS = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', '@LIVE', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js', 'js/pet-score.js', 'js/block-hashes.js'];
function context() {
  const store = {}; const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const q = { log() {}, warn() {}, error() {}, info() {} };
  const win = { console: q, localStorage: ls, sessionStorage: ls, location: { search: '', hostname: 'xcpets.fun', href: SITE + '/' }, navigator: { userAgent: 'node' },
    setTimeout, clearTimeout, URLSearchParams, URL, TextEncoder, TextDecoder, AbortController, fetch: (u, o) => fetch(u, Object.assign({}, o, { headers: { 'user-agent': 'xcpets-api-feed' } })) };
  win.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {}, body: null, documentElement: { style: {} } };
  win.addEventListener = () => {}; win.window = win; win.self = win; win.globalThis = win;
  const ctx = vm.createContext(win);
  for (const f of SCRIPTS) { if (f === '@LIVE') { vm.runInContext('window.LiveEngine={RealCore:window.RealCore,Chain:window.Chain&&window.Chain.Chain,CFG:window.XCPETS_CONFIG};', ctx); continue; }
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
  return ctx;
}
/* same reads as js/v2-chain.js load(): destructions, tip, block hashes (shipped seed first); refuses to build with any hash missing */
async function liveInput(ctx) {
  const E = ctx.LiveEngine, chain = new E.Chain();
  const [rows, tip] = await Promise.all([chain.destructions(E.CFG.asset), chain.tip()]);
  if (!tip) throw new Error('tip read failed');
  const hc = Object.assign({}, ctx.XCPETS_BLOCK_HASHES || {}), blocks = [...new Set(rows.map(r => r.block_index))];
  const bh = await chain.blockHashes(blocks, hc, tip);
  const miss = (bh.missing || []).filter(b => !hc[b] && !bh.hashes[b]); if (miss.length) throw new Error('missing block hashes: ' + miss.join(', '));
  let supply = null; try { const j = await chain.getJson('/assets/' + E.CFG.asset); supply = j && j.result ? Number(j.result.supply) / 1e8 : null; } catch (e) {}
  return { rows, tip, hashes: Object.assign({}, hc, bh.hashes), supply };
}
const STAGES = ['Egg', 'Hatchling', 'Juvenile', 'Adult', 'Elder', 'Mythic'];
function build(ctx, input, nowIso) {
  const V = ctx.V2Rules, E = ctx.LiveEngine;
  const rows = input.rows.filter(r => r.block_index <= input.tip), hashes = Object.assign({}, ctx.XCPETS_BLOCK_HASHES || {}, input.hashes);
  const w = V.replay(rows, hashes, [], { tip: input.tip, live: E && E.RealCore });
  w.tip = w.tip || input.tip;
  const PS = ctx.PetScore, sc = PS && PS.compute ? PS.compute(w, { rules: V }) : { byId: {} };
  const byId = new Map(w.pets.map(p => [p.id, p])), gen = new Map();
  const genOf = id => { if (gen.has(id)) return gen.get(id); const p = byId.get(id); gen.set(id, 0); const g = p && p.parents ? 1 + Math.max(...p.parents.map(genOf)) : 0; gen.set(id, g); return g; };
  const gear = {}; Object.keys(w.items || {}).sort().forEach(gid => { const g = w.items[gid]; if (!g || g.on == null) return;
    (gear[g.on] = gear[g.on] || []).push({ slot: g.slot, item: g.item, name: g.label || g.item, tier: g.legendary ? 'Legendary' : (['Common', 'Uncommon', 'Rare', 'Legendary'][g.tier] || null) }); });
  const SLOT_ORDER = ['head', 'face', 'body', 'back', 'hand', 'feet'];
  Object.values(gear).forEach(l => l.sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot) || (a.item < b.item ? -1 : 1)));
  const pets = w.pets.slice().sort((a, b) => a.id - b.id).map(p => {
    const hyb = V.isHybrid ? V.isHybrid(p.species) : /^hyb:/.test(String(p.species)), s = sc.byId[p.id];
    const tierName = p.art && p.art.tier ? p.art.tier[0].toUpperCase() + p.art.tier.slice(1) : (['Common', 'Uncommon', 'Rare', 'Legendary'][p.tier] || null);
    return {
      id: p.id, name: p.name, species: p.species, speciesLabel: V.speciesLabel(p.species), hybrid: !!hyb,
      tier: ['Common', 'Uncommon', 'Rare', 'Legendary'][p.tier] || tierName, rarityScore: s ? s.score : null, rarityRank: s ? s.rank : null,
      stage: p.stage, stageName: STAGES[p.stage] || p.stageName, care: p.care,
      status: p.released ? 'released' : p.dead ? 'dead' : 'alive', community: !!(p.community || (p.art && p.art.community)),
      owner: p.owner, generation: genOf(p.id), parents: p.parents ? p.parents.slice() : null,
      gear: gear[p.id] || [], stats: p.stats, wins: p.wins || 0, losses: p.losses || 0,
      bornBlock: p.hatchBlock, lastFedBlock: p.lastFed == null ? null : p.lastFed, deathBlock: p.deathBlock == null ? null : p.deathBlock,
      url: SITE + '/pet.html?id=' + p.id
    };
  });
  const sats = rows.filter(r => String(r.status || 'valid') === 'valid').reduce((a, r) => a + BigInt(r.quantity), 0n), burned = Number(sats) / 1e8;
  const meta = { blockHeight: input.tip, generatedAt: nowIso, asset: 'XCPETS', totalPets: pets.length,
    alive: pets.filter(p => p.status === 'alive').length, dead: pets.filter(p => p.status === 'dead').length, released: pets.filter(p => p.status === 'released').length,
    burns: rows.length, burnedXCPETS: burned, supplyXCPETS: input.supply == null ? null : Math.round(input.supply * 1e8) / 1e8,
    owners: new Set(pets.map(p => p.owner)).size, files: { pets: SITE + '/api/pets.json', meta: SITE + '/api/meta.json', docs: SITE + '/api/README.md' } };
  return { pets, meta };
}
module.exports = { context, liveInput, build, SCRIPTS, SITE };
if (require.main === module) (async () => {
  const ctx = context();
  const input = opt('--snap') ? Object.assign({ supply: null }, JSON.parse(fs.readFileSync(opt('--snap'), 'utf8'))) : await liveInput(ctx);
  if (opt('--snap')) input.tip = +(opt('--tip') || input.tip);
  const { pets, meta } = build(ctx, input, opt('--now') || new Date().toISOString().replace(/\.\d+Z$/, 'Z'));
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'pets.json'), '{"blockHeight":' + meta.blockHeight + ',"count":' + pets.length + ',"pets":[\n' + pets.map(p => JSON.stringify(p)).join(',\n') + '\n]}\n' /* one pet per line: small git diffs */);
  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
  console.log('tip', meta.blockHeight, 'pets', pets.length, 'burns', meta.burns, '->', OUT);
})().catch(e => { console.error(e.stack || e); process.exit(2); });
