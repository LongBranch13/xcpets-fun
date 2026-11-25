#!/usr/bin/env node
/* Fast-world audit (Nov 25 2026; dev tooling, not loaded by any page). Replays api/boot.json, publishes the view exactly like the game
 * server (tools/sync-server/split.js write), builds the world a fast page builds from it (js/v2-split.js assemble, every wallet's
 * pets loaded: the best case), then asks the rules the questions pages ask, on both worlds, and lists every answer that differs.
 * A difference is something a fast page shows (or checks before a burn) differently from a full replay.
 *   node --max-old-space-size=8000 tools/fast-world-audit.js [--boot api/boot.json]
 * Also prints the size of each table summary.state carries (tools/fast-world-state-test.js keeps the plumbing honest on a toy world). */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const S = require('./sync-server/snapshot'), split = require('./sync-server/split');
const A = process.argv.slice(2), opt = k => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : null; };
function knownHashes() { const ctx = { window: {} }; ctx.window.window = ctx.window; ctx.self = ctx.window; vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/block-hashes.js'), 'utf8'), ctx); return ctx.window.XCPETS_BLOCK_HASHES || {}; }
function memStore() { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; }
(async () => {
  const boot = JSON.parse(fs.readFileSync(path.resolve(opt('--boot') || path.join(ROOT, 'api/boot.json')), 'utf8'));
  const ctx = S.workerFns(), tip = boot.tip, t0 = Date.now();
  const FULL = S.replayWorld(ctx, boot.rows.slice(), Object.assign({}, knownHashes(), boot.hashes), tip, boot.dex || null);
  const V = ctx.V2Rules;
  console.log('replayed to ' + tip + ' in ' + ((Date.now() - t0) / 1000 | 0) + ' s, ' + FULL.pets.length + ' pets');
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'fast-audit-'));
  await split.write(out, JSON.parse(JSON.stringify(Object.assign({}, FULL, { byId: null }))), { tip, rsig: 'r' + 'ab'.repeat(16), ctx });
  const summary = JSON.parse(fs.readFileSync(path.join(out, 'summary.json'), 'utf8'));
  const sizes = Object.keys(summary.state || {}).map(k => [k, JSON.stringify(summary.state[k]).length]).sort((a, b) => b[1] - a[1]);
  console.log('summary.json ' + fs.statSync(path.join(out, 'summary.json')).size + ' bytes; state tables: ' + sizes.slice(0, 12).map(x => x[0] + ' ' + x[1]).join(', ') + (summary.stateBig ? '; OVER THE CAP: ' + summary.stateBig.join(', ') : ''));
  const sx = { console, setTimeout, clearTimeout, crypto, URL, URLSearchParams, TextEncoder, TextDecoder, fetch: () => Promise.reject(new Error('offline')), document: { scripts: [], getElementById: () => null, body: { insertBefore: () => {} } }, location: { search: '', href: 'https://xcpets.fun/play.html' }, localStorage: memStore(), sessionStorage: memStore() };
  sx.window = sx; sx.self = sx; sx.V2Rules = V; vm.createContext(sx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/v2-art.js'), 'utf8'), sx); vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/v2-split.js'), 'utf8'), sx);
  const owners = {}, stash = {};
  fs.readdirSync(path.join(out, 'own')).filter(f => /^[0-9a-f]{64}\.json$/.test(f)).forEach(f => { const pg = JSON.parse(fs.readFileSync(path.join(out, 'own', f), 'utf8')); if (pg.looks) sx.V2Split.openOwnerPets({ v: 3, looks: pg.looks }, pg.owner); });
  const worn = {}; Object.keys(FULL.items).forEach(k => { const g = FULL.items[k]; if (g && g.on != null) (worn[g.on] = worn[g.on] || []).push(split.itemRec(g)); });
  FULL.pets.forEach(p => { const r = JSON.parse(JSON.stringify(p)); r.worn = worn[p.id] || []; (owners[p.owner || ''] = owners[p.owner || ''] || []).push(r); });
  const F = sx.V2Split.assemble(summary, { owners, mythicOwners: {}, keepArt: true });
  const b = tip + 1, J = v => { try { return JSON.stringify(v); } catch (e) { return 'ERR'; } };
  const call = (fn, args) => { try { return J(fn.apply(null, args)); } catch (e) { return 'throw ' + e.message; } };
  const wallets = [...new Set(FULL.pets.filter(p => !p.dead && !p.released).map(p => p.owner))];
  const living = FULL.pets.filter(p => !p.dead && !p.released && !p.community), some = living.filter((p, i) => i % 20 === 0), zs = FULL.pets.filter(p => p.zombie && !p.zombie.end);
  let bad = 0;
  function cmp(name, items, args, key, show) {
    const fn = V[name]; if (!fn) return; let n = 0; const ex = [];
    items.forEach(it => { const a = key(call(fn, args(FULL, it))), c = key(call(fn, args(F, it))); if (a !== c) { n++; if (ex.length < 2) ex.push(show(it) + ': full ' + String(a).slice(0, 120) + ' | fast ' + String(c).slice(0, 120)); } });
    if (n) bad++;
    console.log((n ? 'DIFF ' : 'same ') + name + ' ' + n + '/' + items.length + (ex.length ? '\n     ' + ex.join('\n     ') : ''));
  }
  const id = x => x, ids = s => { try { return J(JSON.parse(s).map(p => p.id)); } catch (e) { return s; } }, W = a => a.slice(0, 12) + '…', P = p => '#' + p.id;
  [['spinsLeft', (w, a) => [w, a, b, []]], ['freeRolls', (w, a) => [w, a, []]], ['playerNo', (w, a) => [w, a]], ['giftsTo', (w, a) => [w, a]], ['flameTierOf', (w, a) => [w, a]],
    ['flameLooksOf', (w, a) => [w, a]], ['ownedLooks', (w, a) => [w, a]], ['swapsFor', (w, a) => [w, a, b]], ['overflowSpins', (w, a) => [w, a, b]], ['grindPreview', (w, a) => [w, a, b, 100000]]]
    .forEach(([n, f]) => cmp(n, wallets, f, id, W));
  [['mgEdible', (w, a) => [w, a, b]], ['wheelPets', (w, a) => [w, a, b]]].forEach(([n, f]) => cmp(n, wallets, f, ids, W));
  [['halvingInfo', w => [w, tip]], ['fireInfo', w => [w, tip]], ['openAds', w => [w, tip]], ['openListings', w => [w, b]], ['burnLordsRank', w => [w]], ['kekFlagHolders', w => [w, b]], ['wagmiFirst', w => [w, Math.floor(tip / 144)]]]
    .forEach(([n, f]) => cmp(n, [0], f, id, () => 'world'));
  [['questInfo', (w, p) => [w, w.byId[p.id], b]], ['dipInfo', (w, p) => [w, w.byId[p.id], b]], ['giveLocks', (w, p) => [w, w.byId[p.id], b]], ['pobOf', (w, p) => [w, w.byId[p.id]]],
    ['retireDeathClock', (w, p) => [w, w.byId[p.id], b]], ['raisedBy', (w, p) => [w, w.byId[p.id]]], ['petThresholds', (w, p) => [w, w.byId[p.id], b]], ['onRug', (w, p) => [w, w.byId[p.id], b]], ['saleListing', (w, p) => [w, p.id, b]]]
    .forEach(([n, f]) => cmp(n, some, f, id, P));
  cmp('shownLooks', some, (w, p) => [w, w.byId[p.id]], s => { try { return J(JSON.parse(s).map(L => L.id + ':' + L.from)); } catch (e) { return s; } }, P);
  cmp('cemView', zs.concat(FULL.pets.filter(p => p.dead && !p.released).filter((p, i) => i % 50 === 0)), (w, p) => [w, w.byId[p.id], b], id, P);
  cmp('mgView', zs, (w, p) => [w, w.byId[p.id], b], id, P);
  const pairs = []; zs.forEach(z => some.slice(0, 15).forEach(h => pairs.push([h, z])));
  cmp('huntQuote', pairs, (w, [h, z]) => [w, h.id, z.id, b], id, ([h, z]) => '#' + h.id + ' vs #' + z.id);
  cmp('cemHuntWhy', pairs, (w, [h, z]) => [w, h.id, z.id, h.owner, b], id, ([h, z]) => '#' + h.id + ' vs #' + z.id);
  console.log(bad ? bad + ' rules answers differ on the fast world' : 'every rules answer checked is the same on the fast world');
  try { fs.rmSync(out, { recursive: true, force: true }); } catch (e) {}
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e.stack || e); process.exit(2); });
