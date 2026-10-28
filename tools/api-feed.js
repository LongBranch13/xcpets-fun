#!/usr/bin/env node
/* XCPETS public JSON feed (dev/CI tooling only; not loaded by any page).
 * Builds api/pets.json + api/meta.json by replaying XCPETS burns with this repo's own rule scripts, in the same order as play.html,
 * in a Node vm (same approach as tools/replay-check.js). Read-only: it only GETs public Counterparty / block-hash APIs. No secrets.
 *   node tools/api-feed.js                 live: read burns + tip + block hashes from the same APIs the site uses (rjs/chain.js), then replay
 *   node tools/api-feed.js --snap FILE     offline: replay a tools/snapshots/snap-N.json
 *   --dex FILE  (with --snap) pet-token sale data {issuances,orders,matches,credits,destructions} saved from V2Sales.loadDex
 *   --no-dex    (with --snap) replay a snapshot without sale data (old behaviour, for comparisons only)
 *   Live mode refuses to write anything if the sale data can't be read (ownership would be wrong after any sale/tie).
 *   --out DIR (default api)   --now ISO (fixed generated time, for reproducible output)
 * Output is deterministic for a given (burns, tip): pets sorted by id, fixed key order, no timestamps in pets.json. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const A = process.argv.slice(2), opt = k => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : null; };
const ROOT = path.resolve(__dirname, '..'), OUT = path.resolve(ROOT, opt('--out') || 'api');
const SITE = 'https://xcpets.fun';
const SCRIPTS = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', '@LIVE', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js', 'js/pet-score.js', 'js/block-hashes.js', 'js/v2-community.js', 'js/v2-sales.js'];
/* sale-owner-fix (2026-10-24): js/v2-sales.js is loaded only for V2Sales.loadDex (its page code returns early: no #shop element in the vm),
 * so the feed reads pet-token issuances/orders/matches/credits/destructions exactly like the site and replays WITH them. */
/* feed-rate-limit (2026-10-25): every Counterparty read the feed makes (both :4000 nodes, api.xcp.fun) goes through one gate:
 * 1 request in flight per host, <= 2 starts/s, a 429/503 pauses that whole host for its Retry-After (else 2 s doubling, max 30 s) plus jitter,
 * then the same request is sent again (4 times) before the refusal reaches v2-sales.js's own retry logic. See tools/lib/core-limiter.js.
 * FEED_CONC / FEED_RPS env override the pace; FEED_NO_LIMIT=1 restores the old unthrottled fetch. */
const LIM = require('./lib/core-limiter.js');
const RAW = (u, o) => fetch(u, Object.assign({}, o, { headers: { 'user-agent': 'xcpets-api-feed' } }));
const LIMITED = process.env.FEED_NO_LIMIT ? RAW : LIM.makeFetch(RAW, { conc: +process.env.FEED_CONC || 1, rps: +process.env.FEED_RPS || 2 });
function context() {
  const store = {}; const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const q = { log() {}, warn() {}, error() {}, info() {} };
  const win = { console: q, localStorage: ls, sessionStorage: ls, location: { search: '', hostname: 'xcpets.fun', href: SITE + '/' }, navigator: { userAgent: 'node' },
    setTimeout, clearTimeout, URLSearchParams, URL, TextEncoder, TextDecoder, AbortController, fetch: LIMITED };
  win.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {}, body: null, documentElement: { style: {} } };
  win.XCPETS_PATIENT = 1; /* feed-429-fix */ win.XCPETS_TOUCH_MAX = 400; win.XCPETS_MINT_SCAN = 1; /* feed-rate-limit: incremental sale reads over up to 400 blocks; never trade the full mint-token scan for the race's fallback list */ win.addEventListener = () => {}; win.window = win; win.self = win; win.globalThis = win;
  const ctx = vm.createContext(win);
  for (const f of SCRIPTS) { if (f === '@LIVE') { vm.runInContext('window.LiveEngine={RealCore:window.RealCore,Chain:window.Chain&&window.Chain.Chain,CFG:window.XCPETS_CONFIG};', ctx); continue; }
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
  return ctx;
}
function prevBoot() { try { const j = JSON.parse(fs.readFileSync(process.env.BOOT_CACHE || path.join(OUT, 'boot.json'), 'utf8')); return j && j.dex && !j.dex.stale && j.dexTip && j.dexHash && j.dexAssets ? j : null; } catch (e) { return null; } }
/* firesale-hashes: reuse the last boot copy's FINAL hashes (>= 6 deep at its tip) as a cache, so each run only fetches the newest blocks (BOOT_CACHE env or <out>/boot.json) */
function prevBootHashes() { try { const f = process.env.BOOT_CACHE || path.join(OUT, 'boot.json'), j = JSON.parse(fs.readFileSync(f, 'utf8')), o = {}; Object.keys(j.hashes || {}).forEach(k => { if (+k <= j.tip - 6 && /^[0-9a-f]{64}$/.test(j.hashes[k])) o[k] = j.hashes[k]; }); return o; } catch (e) { return {}; } }
/* api-hardening (2026-10-27): 6-block reorg rollback in the feed. The last boot.json also ships hashes for its newest blocks (under 6 deep); those
 * are never reused as a cache (prevBootHashes above), and here they are compared with this run's fresh hashes. Any changed hash, or a tip lower
 * than the last run's, means the blocks after it were replaced: the sale base from the last run is dropped (full sale re-read) and the run says so. */
function prevBootAll() { try { const j = JSON.parse(fs.readFileSync(process.env.BOOT_CACHE || path.join(OUT, 'boot.json'), 'utf8')); return j && j.tip ? { tip: +j.tip, hashes: j.hashes || {} } : null; } catch (e) { return null; } }
function feedReorg(prevAll, fresh, tip) { if (!prevAll) return null; let at = null; Object.keys(prevAll.hashes).forEach(k => { const n = +k; if (n > prevAll.tip - 6 && fresh[k] && prevAll.hashes[k] !== fresh[k] && (at == null || n < at)) at = n; });
  return at != null ? { at, depth: prevAll.tip - at + 1 } : tip < prevAll.tip ? { at: tip + 1, depth: prevAll.tip - tip, back: true } : null; }
/* firesale-hashes (Oct 25 2026): every block from each every-block gate (fire sales, Mythic quests, raids) to the tip, the same list js/v2-chain.js load() asks for */
function gateBlocks(V, tip) { const out = []; [V.ACTIVATE_FIRESALE_BLOCK, V.questGate ? V.questGate() : null, V.raidGate ? V.raidGate() : null].forEach(g => { if (g != null && tip >= g) for (let b = g; b <= tip; b++) out.push(b); }); return out; }
/* same reads as js/v2-chain.js load(): destructions, tip, block hashes (shipped seed first); refuses to build with any hash missing */
async function liveInput(ctx) {
  const E = ctx.LiveEngine, chain = new E.Chain();
  const [rows, tip] = await Promise.all([chain.destructions(E.CFG.asset), chain.tip()]);
  if (!tip) throw new Error('tip read failed');
  /* feed-rate-limit: the last published boot.json is the incremental base: its sale data was complete at dexTip, so only pet tokens named in the
   * blocks since then (plus new tokens) are re-read. Its dexTip hash is fetched FRESH below and must match (a reorg there -> full re-read). --full skips it. */
  const prev = A.includes('--full') ? null : prevBoot(); if (prev && ctx.V2Sales && ctx.V2Sales.setBase) ctx.V2Sales.setBase(prev);
  const hc = Object.assign({}, prevBootHashes(), ctx.XCPETS_BLOCK_HASHES || {}), blocks = [...new Set(rows.map(r => r.block_index).concat([tip], gateBlocks(ctx.V2Rules, tip), prev && prev.dexTip && +prev.dexTip <= tip ? [+prev.dexTip] : []))]; /* sale-cache-feed: the tip's own hash too, so boot.json's sale data gets its dexTip/dexHash stamp */
  const bh = await chain.blockHashes(blocks, hc, tip);
  const miss = (bh.missing || []).filter(b => !hc[b] && !bh.hashes[b]); if (miss.length) throw new Error('missing block hashes: ' + miss.join(', '));
  /* sale-owner-fix: pet-token data, same call as js/v2-chain.js load(). Any failure throws -> nothing is written (never publish owners without sales). */
  const ro = A.includes('--full') ? null : feedReorg(prevBootAll(), Object.assign({}, hc, bh.hashes), tip);
  if (ro) console.error('feed: reorg ' + (ro.back ? '(tip went back) ' : '') + 'from block ' + ro.at + ', ' + ro.depth + ' block(s) rolled back; sale base dropped, full sale re-read');
  let dex = null; const V = ctx.V2Rules;
  if (V.salesGate && V.salesGate() != null) {
    if (!ctx.V2Sales || !ctx.V2Sales.loadDex) throw new Error('V2Sales.loadDex missing');
    try { dex = await ctx.V2Sales.loadDex(rows, prev && !ro ? { tip, hashes: Object.assign({}, hc, bh.hashes) } : undefined); } catch (e) { throw new Error('pet sale data could not be read, not publishing (owners would be wrong): ' + (e && e.message || e)); }
    if (!dex) throw new Error('pet sale data empty while the sales gate is set, not publishing');
  }
  console.error('feed: sale read ' + JSON.stringify(ctx.V2Sales && ctx.V2Sales.loadDex && ctx.V2Sales.loadDex.last || null));
  let supply = null; try { const j = await chain.getJson('/assets/' + E.CFG.asset); supply = j && j.result ? Number(j.result.supply) / 1e8 : null; } catch (e) {}
  return { rows, tip, hashes: Object.assign({}, hc, bh.hashes), supply, dex, dexAssets: dex && ctx.V2Sales.loadDex.lastAssets ? ctx.V2Sales.loadDex.lastAssets.slice() : undefined };
}
const STAGES = ['Egg', 'Hatchling', 'Juvenile', 'Adult', 'Elder', 'Mythic'];
function build(ctx, input, nowIso) {
  const V = ctx.V2Rules, E = ctx.LiveEngine;
  const rows = input.rows.filter(r => r.block_index <= input.tip), hashes = Object.assign({}, ctx.XCPETS_BLOCK_HASHES || {}, input.hashes);
  if (V.salesGate && V.salesGate() != null && input.tip >= V.salesGate() && !input.dex && !input.noDex) throw new Error('no pet sale data (dex) for a tip past the sales gate: refusing to build owners without it');
  const w = V.replay(rows, hashes, [], { tip: input.tip, live: E && E.RealCore, dex: input.dex || undefined }); /* same opts as js/v2-chain.js world() */
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
    owners: new Set(pets.map(p => p.owner)).size, community: ctx.V2Community ? ctx.V2Community.state(w) : null, files: { pets: SITE + '/api/pets.json', meta: SITE + '/api/meta.json', docs: SITE + '/api/README.md' } };
  return { pets, meta };
}
module.exports = { context, liveInput, build, SCRIPTS, SITE, LIMITED, feedReorg };
if (require.main === module) (async () => {
  const ctx = context();
  const input = opt('--snap') ? Object.assign({ supply: null }, JSON.parse(fs.readFileSync(opt('--snap'), 'utf8'))) : await liveInput(ctx);
  if (opt('--snap')) input.tip = +(opt('--tip') || input.tip);
  if (opt('--snap') && A.includes('--no-dex')) input.noDex = true; /* offline replays of old snapshots only; live mode never skips sales */
  if (opt('--dex')) input.dex = JSON.parse(fs.readFileSync(opt('--dex'), 'utf8'));
  /* token-proof: --save-input FILE hands this run's chain read (rows, tip, hashes, dex) to tools/token-meta.js --input, so the token step
   * never re-reads the DEX (its second read was hitting 429 and every t/<id>.json + Proof of Pet PNG refresh was skipped). */
  if (!opt('--snap') && LIMITED.stats) console.error('feed: requests ' + JSON.stringify(LIMITED.stats));
  if (opt('--save-input')) fs.writeFileSync(opt('--save-input'), JSON.stringify(input));
  if (opt('--save-dex') && input.dex) { fs.mkdirSync(path.dirname(path.resolve(opt('--save-dex'))), { recursive: true }); } if (opt('--save-dex') && input.dex) fs.writeFileSync(opt('--save-dex'), JSON.stringify(input.dex));
  const { pets, meta } = build(ctx, input, opt('--now') || new Date().toISOString().replace(/\.\d+Z$/, 'Z'));
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'pets.json'), '{"blockHeight":' + meta.blockHeight + ',"count":' + pets.length + ',"pets":[\n' + pets.map(p => JSON.stringify(p)).join(',\n') + '\n]}\n' /* one pet per line: small git diffs */);
  /* site-fast: first-visit boot copy for js/v2-chain.js fromStatic() (only the hashes the rows need; the page re-reads the chain right after) */
  { const rr = input.rows.filter(r => r.block_index <= input.tip), seed = ctx.XCPETS_BLOCK_HASHES || {}, hs = {}; rr.forEach(r => { const k = r.block_index; if (!seed[k] && input.hashes && input.hashes[k]) hs[k] = input.hashes[k]; }); gateBlocks(ctx.V2Rules, input.tip).forEach(k => { if (!seed[k] && input.hashes && input.hashes[k]) hs[k] = input.hashes[k]; }); /* firesale-hashes: every gate block's hash ships in the boot copy, so a first visit never stops at fire.missing */
    fs.writeFileSync(path.join(OUT, 'boot.json'), JSON.stringify({ tip: input.tip, generatedAt: meta.generatedAt, rows: rr, hashes: hs, dex: input.dex || null,
      /* sale-cache: stamp the sale copy with the tip it was read after + that block's hash, so pages can re-read only tokens touched since (js/v2-sales.js pickBase) */
      dexTip: input.dex && !input.dex.stale && input.dexAssets && input.hashes && input.hashes[input.tip] ? input.tip : undefined, dexHash: input.dex && input.hashes ? input.hashes[input.tip] : undefined, dexAssets: input.dexAssets || undefined })); }
  fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
  console.log('tip', meta.blockHeight, 'pets', pets.length, 'burns', meta.burns, '->', OUT);
})().catch(e => { console.error(e.stack || e); process.exit(2); });
