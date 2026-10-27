#!/usr/bin/env node
/* PET TOKEN METADATA (pet-shop-sales; dev/CI tooling, static output for GitHub Pages).
 * A pet token's on-chain description is  https://xcpets.fun/t/<petId>.json  (V2Rules.deedDesc). Explorers that follow the
 * Counterparty Enhanced Asset Info / CIP25 and XChain Token Information Standard (description = URL ending in .json) fetch it and show
 * its "image" / "images". This script writes, per pet:
 *   t/<id>.json  { name, description, website, image, images[], categories NFT, pet {...} }   + verified {asset,...} | 'not tied yet' (V2Rules.deedScan)
 *   t/<id>.png   128x128: tied pets = the Proof of Pet badge (js/v2-papers.js 'token' layout); others = frame-0 sprite (32x32 x4, nearest neighbour, RGB(A) PNG; no hunger look so it only changes with stage/gear/breed look)
 * plus t/index.json (ids + block). Files are only rewritten when their bytes change (small git diffs). Regenerate as pets hatch:
 *   node tools/token-meta.js                 live (same reads as tools/api-feed.js)
 *   node tools/token-meta.js --snap FILE     offline snapshot      --out DIR (default t)   --ids 1,2,3 (subset)   --dex dex.json ({issuances:[...]} for offline verified tokens)
 * Generic fallback for a pet not generated yet: t/pet.png (the logo) is what the site links; the binding itself never depends on the file. */
'use strict';
/* api-reduction (2026-10-25): every Counterparty read here goes through the same gate as tools/api-feed.js (tools/lib/core-limiter.js: 1 in flight, 2/s per host, shared 429 cooldown). FEED_NO_LIMIT=1 turns it off. */
if (!process.env.FEED_NO_LIMIT && typeof globalThis.fetch === 'function' && !globalThis.fetch.__xcpLimited) { const RAWF = globalThis.fetch.bind(globalThis), LF = require('./lib/core-limiter.js').makeFetch(RAWF, { conc: 1, rps: 2 }); LF.__xcpLimited = true; globalThis.fetch = LF; }
const fs = require('fs'), path = require('path'), vm = require('vm'), zlib = require('zlib');
const F = require('./api-feed.js'); const PAPERS = require('../js/v2-papers.js');
const A = process.argv.slice(2), opt = k => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : null; };
const ROOT = path.resolve(__dirname, '..'), OUT = path.resolve(ROOT, opt('--out') || 't'), SITE = F.SITE, SCALE = 4;
const EXTRA = ['js/wizard-sprite.js', 'js/kek-sprite.js', 'js/funtrump-sprite.js', 'js/contest-sprite.js', 'js/dan-sprite.js', /* same sprite scripts as pet.html: without funtrump-sprite.js a FunTrump-body hybrid (Don Kekamoto #46073) fell back to a plain Kek face on its badge */ 'js/v2-bg.js', 'js/v2-looks.js', 'js/v2-render.js'];
function crc32(b) { let c, t = crc32.t; if (!t) { t = crc32.t = new Int32Array(256); for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } }
  c = -1; for (let i = 0; i < b.length; i++) c = t[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(type, data) { const l = Buffer.alloc(4), td = Buffer.concat([Buffer.from(type), data]), cr = Buffer.alloc(4); l.writeUInt32BE(data.length); cr.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, cr]); }
/** png(rgba 32x32, scale) -> Buffer: RGBA 8-bit PNG, nearest-neighbour upscale. Deterministic. */
function png(data, w, h, s) { s = s || 1; const W = w * s, H = h * s, raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; for (let x = 0; x < W; x++) { const si = ((y / s | 0) * w + (x / s | 0)) * 4, di = y * (W * 4 + 1) + 1 + x * 4; raw[di] = data[si]; raw[di + 1] = data[si + 1]; raw[di + 2] = data[si + 2]; raw[di + 3] = data[si + 3] == null ? 255 : data[si + 3]; } }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]); }
/** meta(pet row from api-feed build, asset|null) -> the token JSON object (CIP25 + XChain TIS compatible keys). */
function meta(p, v, m, mintTie) { /* mintTie: verified tie with no pet:deed burn (pre-gate mint-only tie, ties.json kind 'mint') */ const img = SITE + '/t/' + p.id + '.png', o = {}, asset = (v && v.asset) || (m && m.asset) || null; /* m = owner's fresh mint, not tied yet: asset only (explorers match it), verified stays 'not tied yet' */
  if (asset) o.asset = asset;
  Object.assign(o, { name: 'XCPETS #' + p.id + ' ' + p.name,
    description: p.name + ', a ' + (p.tier || '') + ' ' + p.speciesLabel + ' (' + p.stageName + ') on xcpets.fun. This token is pet #' + p.id + (mintTie ? "'s token: it was tied to the pet right when it was minted on-chain, so whoever holds it owns the pet in the xcpets.fun game (from Bitcoin block 972,729) and can sell, buy or gift it in Spam City Games." : "'s token: once it is tied to the pet by an on-chain pet:deed burn, whoever holds it owns the pet in the xcpets.fun game (from Bitcoin block 972,729) and can sell, buy or gift it in Spam City Games."),
    website: SITE + '/pet.html?id=' + p.id, image: img,
    images: [{ type: 'large', size: '128x128', data: img }], categories: [{ type: 'main', data: 'NFT' }, { type: 'sub', data: 'xcpets pet' }],
    verified: v && v.asset ? { asset: v.asset, tiedBlock: v.block, tiedTx: v.tx, tiedBy: v.by } : 'not tied yet',
    anti_fake: (v && v.asset ? 'Only ' + v.asset + ' is the real token of pet #' + p.id + ' (printed on its badge).' : 'Pet #' + p.id + ' has no verified token yet: any asset pointing here is NOT a real tied token.') + ' Only the asset in verified.asset is the real token of pet #' + p.id + '. Any other asset whose description points here is NOT the real token and moves nothing.',
    pet: { id: p.id, name: p.name, species: p.species, speciesLabel: p.speciesLabel, rarity: p.tier, rarityScore: p.rarityScore, stage: p.stageName, status: p.status, generation: p.generation } });
  return o; }
function put(f, buf) { try { if (fs.readFileSync(f).equals(buf)) return 0; } catch (e) { } fs.writeFileSync(f, buf); return 1; }
module.exports = { png, meta, crc32 };
if (require.main === module) (async () => {
  const ctx = F.context(); ctx.setInterval = () => 0; ctx.clearInterval = () => {}; ctx.document.head = { appendChild() {} }; ctx.document.addEventListener = undefined; for (const f of EXTRA) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
  /* token-proof: --input FILE = the api-feed run's own chain read (live, dex included); else a live read with 429 back-off (3 tries). */
  const liveRetry = async () => { for (let i = 0; ; i++) { try { return await F.liveInput(ctx); } catch (e) { if (i >= 2 || !/429|busy/i.test(String(e && e.message || e))) throw e; console.log('token-meta: chain busy, retry in', 20 * (i + 1), 's'); await new Promise(r => setTimeout(r, 20000 * (i + 1))); } } };
  const input = opt('--snap') ? Object.assign({ supply: null }, JSON.parse(fs.readFileSync(opt('--snap'), 'utf8'))) : opt('--input') && fs.existsSync(opt('--input')) ? JSON.parse(fs.readFileSync(opt('--input'), 'utf8')) : await liveRetry();
  const V = ctx.V2Rules, E = ctx.LiveEngine, rows = input.rows.filter(r => r.block_index <= input.tip), hashes = Object.assign({}, ctx.XCPETS_BLOCK_HASHES || {}, input.hashes);
  const w = V.replay(rows, hashes, [], { tip: input.tip, live: E && E.RealCore }); w.tip = w.tip || input.tip;
  const { pets } = F.build(ctx, input, '1970-01-01T00:00:00Z'), byId = new Map(w.pets.map(p => [p.id, p]));
  /* verified tokens: V2Rules.deedScan over the burns + each deed asset's first issuance (live: fetched; --snap: --dex FILE or none) */
  let dex = opt('--dex') ? JSON.parse(fs.readFileSync(opt('--dex'), 'utf8')) : null;
  if (!dex && !opt('--snap')) { dex = { issuances: [], orders: [], matches: [] }; const API = (ctx.XCPETS_CONFIG.read || [])[0] || 'https://api.counterparty.io:4000/v2', seen = {};
    for (const r of V.readBurns(rows)) { let t = null; try { t = V.parseTag(r.tag); } catch (e) { } if (!t || t.action !== 'deed' || seen[t.asset]) continue; seen[t.asset] = 1;
      const j = await (await fetch(API + '/assets/' + t.asset + '/issuances?verbose=true')).json(); const i = (j.result || []).filter(x => !x.status || x.status === 'valid').sort((a, b) => a.tx_index - b.tx_index)[0]; if (i) dex.issuances.push(i); } 
    /* mint-only ties (before ACTIVATE_ONE_TIE_PATH_BLOCK) have no burn: also check each asset already named in t/<id>.json (deedScan verifies it) */
    try { for (const f of fs.readdirSync(OUT)) { if (!/^[0-9]+\.json$/.test(f)) continue; let a = null; try { a = JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8')).asset; } catch (e) { } if (typeof a !== 'string' || seen[a]) continue; seen[a] = 1;
      const j = await (await fetch(API + '/assets/' + a + '/issuances?verbose=true')).json(); const i = (j.result || []).filter(x => !x.status || x.status === 'valid').sort((a, b) => a.tx_index - b.tx_index)[0]; if (i) dex.issuances.push(i); } } catch (e) { } }
  /* --tokened (hourly CI): find owners' fresh mints BEFORE deedScan, so a pre-gate mint-only tie is verified on the first run (Nusa #1111 fix).
   * Lookback = last processed block (api/token-meta-state.json) minus 12, never a fixed window, so an outage or a throttled cron misses nothing.
   * --since BLOCK overrides. --assets A1,A2 force-checks named assets (manual repair). */
  let mints = {}; const STATE = path.join(ROOT, 'api', 'token-meta-state.json'); let since = Number(opt('--since')) || 0;
  if (!since) { try { since = Number(JSON.parse(fs.readFileSync(STATE, 'utf8')).lastBlock) - 12; } catch (e) { } }
  if (!since || !(since > 0)) since = input.tip - 36; since = Math.min(since, input.tip - 36);
  const fetchIss = async a => { if (!dex || dex.issuances.some(x => x.asset === a)) return; const API = (ctx.XCPETS_CONFIG.read || [])[0] || 'https://api.counterparty.io:4000/v2';
    for (const u of [API + '/assets/' + a + '/issuances?verbose=true', 'https://tokenscan.io/api/issuances/' + a]) { try { const j = await (await fetch(u)).json(); const L = (j.result || j.data || []).filter(x => !x.status || x.status === 'valid').sort((x, y) => x.tx_index - y.tx_index); if (L[0]) { dex.issuances.push(L[0]); return; } } catch (e) { } } };
  let mintsOk = true;
  if (A.includes('--tokened')) { const DS = require('./deed-scan.js'), CF = ctx.XCPETS_CONFIG, API = (CF.read || [])[0] || 'https://api.counterparty.io:4000/v2';
    const r = await DS.recentMints(pets, API, CF.composeList || [], since); mints = r.mints; mintsOk = r.ok; console.log('tokened: mint lookback from block', since, 'nodes ok', r.ok);
    for (const id of Object.keys(mints)) if (!mints[id].mempool) await fetchIss(mints[id].asset); }
  for (const a of (opt('--assets') || '').split(',').filter(Boolean)) await fetchIss(a);
  const assetOf = V.deedScan ? V.deedScan(w, rows, dex || {}) : {}; /* main has no deedScan until the shop ships: everything is 'not tied yet' */
  let only = opt('--ids') ? new Set(opt('--ids').split(',').map(Number)) : null;
  /* --tokened (hourly CI): only pets with a tied token, an owner's fresh mint (recent full-node issuances + mempool), or an existing t/<id>.json that
   * names a token (so a re-tie / untie refreshes it). Never touches the other ~22k pets. */
  if (A.includes('--tokened')) { only = new Set(Object.keys(assetOf).concat(Object.keys(mints)).map(Number));
    try { for (const f of fs.readdirSync(OUT)) { const m = /^([0-9]+)\.json$/.exec(f); if (!m) continue; try { const j = JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8')); if (j.asset) only.add(Number(m[1])); } catch (e) { } } } catch (e) { }
    console.log('tokened: tied', Object.keys(assetOf).length, 'fresh mints', Object.keys(mints).length, 'files to check', only.size); }
  const BURN_TX = new Set(rows.map(r => r.tx_hash)); /* same test as ties.json kind: deed = burn tx, else mint */
  fs.mkdirSync(OUT, { recursive: true }); let nj = 0, np = 0, bad = 0;
  for (const p of pets) { if (only && !only.has(p.id)) continue;
    nj += put(path.join(OUT, p.id + '.json'), Buffer.from(JSON.stringify(meta(p, assetOf[p.id] || null, assetOf[p.id] ? null : mints[p.id], !!(assetOf[p.id] && !BURN_TX.has(assetOf[p.id].tx)))) + '\n'));
    let fr = null; try { fr = ctx.V2Render.petFramesRaw(byId.get(p.id), w, { noHunger: true }); } catch (e) { fr = null; }
    if (!(fr && fr[0] && fr[0].data && fr[0].data.length === 4096)) { bad++; continue; }
    /* Proof of Pet (branch pet-papers): a pet with a verified tied token gets the 128x128 Proof of Pet badge (js/v2-papers.js, same pixels as the
     * pet.html card); every other pet (no token, a fresh untied mint, community) keeps the plain 32x32 x4 sprite. */
    const tie = assetOf[p.id], q = byId.get(p.id);
    if (tie && q && !q.community && !(q.art && q.art.community)) { const r0 = PAPERS.render({ id: p.id, name: p.name, tier: p.tier || '', speciesLabel: p.speciesLabel, asset: tie.asset }, fr[0].data, 'token'), lk = ctx.V2Looks && ctx.V2Looks.hasFx(fr[0]); /* looks-draw: realistic looks baked into the badge at 4 output pixels per badge pixel */
      const r = lk ? PAPERS.withLooks(PAPERS.scaleUp(r0, 4), 4, fr[0], ctx.V2Looks) : r0; np += put(path.join(OUT, p.id + '.png'), png(r.data, r.w, r.h, 1)); }
    else { const bk = ctx.V2Looks && ctx.V2Looks.bakeAll(fr[0], 32 * SCALE); /* looks-draw: realistic looks baked as a still */ np += put(path.join(OUT, p.id + '.png'), bk ? png(bk, 32 * SCALE, 32 * SCALE, 1) : png(fr[0].data, 32, 32, SCALE)); } }
  if (!only) put(path.join(OUT, 'index.json'), Buffer.from(JSON.stringify({ blockHeight: input.tip, count: pets.length, url: SITE + '/t/<id>.json' }) + '\n'));
  if (A.includes('--tokened') && mintsOk) put(STATE, Buffer.from(JSON.stringify({ lastBlock: input.tip }) + '\n'));
  /* api/ties.json (Oct 24 2026): every verified tie in one small file (HatchBot tie announcements read this instead of polling t/<id>.json).
   * lastBlock = api/token-meta-state.json lastBlock (same value). kind: 'deed' = a pet:deed burn tx, 'mint' = pre-gate mint-only tie (rule 3). */
  if (A.includes('--tokened') || A.includes('--ties')) { let lb = input.tip; try { lb = Number(JSON.parse(fs.readFileSync(STATE, 'utf8')).lastBlock) || lb; } catch (e) { }
    const burnTx = new Set(rows.map(r => r.tx_hash)), pById = new Map(pets.map(p => [p.id, p]));
    const ties = Object.keys(assetOf).map(Number).map(id => { const v = assetOf[id], p = pById.get(id) || {};
      return { id, asset: v.asset, tiedBlock: v.block, tiedTx: v.tx, kind: burnTx.has(v.tx) ? 'deed' : 'mint', name: p.name || '', species: p.species || '', speciesLabel: p.speciesLabel || '', rarity: p.tier || '', stage: p.stageName || '' }; })
      .sort((a, b) => a.tiedBlock - b.tiedBlock || a.id - b.id);
    put(path.join(ROOT, 'api', 'ties.json'), Buffer.from(JSON.stringify({ lastBlock: lb, count: ties.length, url: SITE + '/t/<id>.json', ties }, null, 1) + '\n')); console.log('ties.json', ties.length, 'lastBlock', lb); }
  console.log('tip', input.tip, 'pets', pets.length, 'json written', nj, 'png written', np, 'no sprite', bad, '->', OUT);
})().catch(e => { console.error(e.stack || e); process.exit(2); });
