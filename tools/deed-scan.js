/* deed-scan (token-meta automation, 2026-10-23). Read-only helpers for tools/token-meta.js; NOT used by the game or replay().
 * - deedScan(w, rows, dex): exact port of V2Rules.deedScan from pet-shop-sales (used only when the loaded V2Rules has none, i.e. on main
 *   before the shop ships). Same rule: pet:deed:ID:<b36> burn by the pet's CURRENT owner, pet alive / not released / not community, >= 1 dander,
 *   token FIRST issuance by that address at/before the burn, qty 1, indivisible, locked, description = the pet URL; newest valid tie wins.
 * - findMints(pets, api, cache): the owner's own freshly minted token (before the tie), so t/<id>.json can carry "asset" right after the mint
 *   (explorers such as xcp.io only show the image when the JSON's asset equals the token). Sources: mempool ASSET_ISSUANCE events and each
 *   living-pet owner's balances (numeric A-assets; descriptions cached). Same issuance checks as the tie, minus the burn. */
'use strict';
const DEED_URL = 'https://xcpets.fun/t/', DEED_MIN = '95428956661682177', DEED_MAX = '18446744073709551615', GIVE = 0.00000001, B36 = '0123456789abcdefghijklmnopqrstuvwxyz';
const numCmp = (a, z) => a.length - z.length || (a < z ? -1 : a > z ? 1 : 0);
function deedOk(a) { const m = /^A([1-9][0-9]{16,19})$/.exec(String(a || '')); return !!m && numCmp(m[1], DEED_MIN) >= 0 && numCmp(m[1], DEED_MAX) <= 0; }
const deedDesc = id => DEED_URL + id + '.json';
function deedDescOk(d, id) { d = String(d == null ? '' : d); return d === deedDesc(id) || d === 'xcpets pet #' + id || d === 'xcpets.fun/t/' + id + '.json' || d === 'http://xcpets.fun/t/' + id + '.json'; }
function b36ToDec(s) { const d = [0]; String(s).toLowerCase().split('').forEach(c => { let carry = B36.indexOf(c); for (let i = d.length - 1; i >= 0; i--) { const x = d[i] * 36 + carry; d[i] = x % 10; carry = Math.floor(x / 10); }
  while (carry) { d.unshift(carry % 10); carry = Math.floor(carry / 10); } }); while (d.length > 1 && d[0] === 0) d.shift(); return d.join(''); }
/** parseDeed(tag) -> {petId, asset} | null (same as V2Rules.parseTag's DEED branch: tag upper-cased, id 1-9 digits, b36 1-13 chars, asset in range) */
function parseDeed(tag) { const p = String(tag || '').trim().toUpperCase().split(':'); if (p.length !== 4 || p[0] !== 'PET' || p[1] !== 'DEED' || !/^[0-9]{1,9}$/.test(p[2]) || !/^[1-9A-Z][0-9A-Z]{0,12}$/.test(p[3])) return null;
  const a = 'A' + b36ToDec(p[3]); return deedOk(a) ? { petId: parseInt(p[2], 10), asset: a } : null; }
function issueWhy(iss, id, src, b) { if (!iss) return 'no issuance'; if (!deedOk(iss.asset)) return 'not numeric'; if (iss.source !== src && iss.issuer !== src) return 'other issuer';
  if (Number(iss.block_index) > b) return 'after burn'; if (Number(iss.quantity) !== 1 || iss.divisible === true || iss.divisible === 1 || !(iss.locked === true || iss.locked === 1)) return 'qty/divisible/locked';
  if (!deedDescOk(iss.description, id)) return 'description'; return null; }
function firstIssuances(list) { const o = {}; (list || []).forEach(x => { if (!x || !x.asset || x.status && x.status !== 'valid') return; const c = o[x.asset]; if (!c || Number(x.tx_index) < Number(c.tx_index)) o[x.asset] = x; }); return o; }
function deedScan(w, rows, dex, readBurns) { const deeds = firstIssuances(dex && dex.issuances), out = {}, used = {};
  readBurns(rows || []).forEach(r => { const t = parseDeed(r.tag); if (!t) return; const p = w.byId[t.petId], b = Number(r.block_index);
    if (!p || p.dead || p.released || p.community || p.owner !== r.source || !(r.amount >= GIVE)) return;
    if (used[t.asset] != null && used[t.asset] !== p.id) return; if (issueWhy(deeds[t.asset], p.id, r.source, b)) return;
    used[t.asset] = p.id; out[p.id] = { asset: t.asset, block: b, tx: r.tx_hash, by: r.source }; });
  return out; }
const descId = d => { const m = /^(?:https?:\/\/)?xcpets\.fun\/t\/([0-9]{1,9})\.json$/.exec(String(d || '')); return m ? parseInt(m[1], 10) : null; };
async function getJ(u, ms) { const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms || 15000); try { const r = await fetch(u, { signal: ac.signal }); if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + u); return await r.json(); } finally { clearTimeout(t); } }
/** findMints(pets [{id, owner, status, community}], api, cache {asset: {d, src}|0}) -> { petId: {asset, block|null, tx, by, mempool} } newest owner mint per pet */
async function findMints(pets, api, cache) { const owner = {}; pets.forEach(p => { if (p.status !== 'dead' && !p.community && p.owner) owner[p.id] = p.owner; });
  const cand = []; /* issuance-like rows */
  try { const j = await getJ(api + '/mempool/events/ASSET_ISSUANCE?limit=1000'); (j.result || []).forEach(e => { const x = e.params || {}; cand.push(Object.assign({}, x, { tx_hash: e.tx_hash || x.tx_hash, block_index: null, mempool: true })); }); } catch (e) { console.error('mempool:', e.message); }
  const addrs = [...new Set(Object.values(owner))];
  for (const a of addrs) { let cur = null, n = 0; do { let j; try { j = await getJ(api + '/addresses/' + a + '/balances?limit=1000' + (cur ? '&cursor=' + cur : '')); } catch (e) { console.error('balances', a, e.message); break; }
      for (const b of j.result || []) { if (!deedOk(b.asset) || Number(b.quantity) < 1) continue; let c = cache[b.asset];
        if (c === undefined) { try { const i = await getJ(api + '/assets/' + b.asset + '/issuances?verbose=true'); const f = firstIssuances(i.result)[b.asset];
            c = cache[b.asset] = f && descId(f.description) != null ? { asset: f.asset, source: f.source, issuer: f.issuer, block_index: f.block_index, tx_index: f.tx_index, tx_hash: f.tx_hash, quantity: f.quantity, divisible: f.divisible, locked: f.locked, description: f.description } : 0; } catch (e) { console.error('issuances', b.asset, e.message); continue; } }
        if (c) cand.push(c); }
      cur = j.next_cursor; } while (cur && ++n < 20); }
  const out = {};
  for (const x of cand) { const id = descId(x.description); if (id == null || !owner[id]) continue;
    if (issueWhy(Object.assign({}, x, { block_index: x.block_index == null ? 0 : x.block_index }), id, owner[id], Infinity)) continue;
    const o = out[id], newer = !o || (x.mempool && !o.mempool) || (!x.mempool && !o.mempool && Number(x.tx_index) > Number(o.tx_index || 0)); if (o && o.asset === x.asset && !x.mempool) { out[id] = Object.assign({}, o, { block: x.block_index, mempool: false }); continue; }
    if (newer) out[id] = { asset: x.asset, block: x.block_index, tx: x.tx_hash, by: x.source || x.issuer, mempool: !!x.mempool, tx_index: x.tx_index }; }
  return out; }

/** recentMints(pets, api, nodes, minBlock) -> same shape as findMints, but reads the full nodes' global /issuances list (newest first) back to
 * minBlock instead of every owner's balances (one or a few requests per run, so the hourly CI job stays light). Plus api.xcp.fun mempool. */
async function recentMints(pets, api, nodes, minBlock) { const owner = {}; pets.forEach(p => { if (p.status !== 'dead' && !p.community && p.owner) owner[p.id] = p.owner; });
  const cand = [];
  try { const j = await getJ(api + '/mempool/events/ASSET_ISSUANCE?limit=1000'); (j.result || []).forEach(e => { const x = e.params || {}; cand.push(Object.assign({}, x, { tx_hash: e.tx_hash || x.tx_hash, block_index: null, mempool: true })); }); } catch (e) { console.error('mempool:', e.message); }
  let got = false;
  for (const node of nodes || []) { try { let cur = null, n = 0; do { const j = await getJ(node + '/issuances?limit=1000&verbose=true' + (cur ? '&cursor=' + cur : ''), 30000); const r = j.result || [];
        r.forEach(x => { if (descId(x.description) != null) cand.push(x); }); cur = j.next_cursor; if (!r.length || Math.min(...r.map(x => Number(x.block_index))) < minBlock) break; } while (cur && ++n < 10);
      got = true; break; } catch (e) { console.error('issuances', node, e.message); } }
  if (!got) console.error('recentMints: no full node reachable; only mempool mints seen');
  const out = {};
  for (const x of cand) { const id = descId(x.description); if (id == null || !owner[id]) continue; if (x.status && x.status !== 'valid') continue;
    if (issueWhy(Object.assign({}, x, { block_index: x.block_index == null ? 0 : x.block_index }), id, owner[id], Infinity)) continue;
    const o = out[id]; if (!o || (x.mempool && !o.mempool) || (!x.mempool && !o.mempool && Number(x.tx_index) > Number(o.tx_index || 0))) out[id] = { asset: x.asset, block: x.block_index, tx: x.tx_hash, by: x.source || x.issuer, mempool: !!x.mempool, tx_index: x.tx_index }; }
  return { mints: out, ok: got }; }
module.exports = { recentMints, deedScan, findMints, parseDeed, issueWhy, deedOk, deedDescOk, b36ToDec };
