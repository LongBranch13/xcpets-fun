#!/usr/bin/env node
/* Pet scores match everywhere (Nov 28 2026, Jake: "pet scores dont seem to match between my pets and the pet card").
 * The ⭐ Pet Score, its "top N%", the rank and the 💎 trait rarity are graded on a curve against a population of pets. A fast page holds
 * only the pets it loaded (your own pets page by page, a parent, the pet a pet page asked for), so every page graded against a different
 * set: on the real chain 46,700 of the biggest wallet's 49,027 pets showed other numbers than a full replay, and a one-pet wallet read
 * "top 100%, Rarity 0.0" instead of "top 22%, Rarity 19.4". The game server now publishes the whole game's curve (summary.psBase, made by
 * PetScore.basis from its full replay) and fast worlds grade against it. This test checks, on a toy world:
 *   1. any part of the world (one pet, one wallet, a wallet plus strays, a page) scored against the base gives exactly the full world's
 *      numbers for every pet in it (score, rank, top, percentile, breakdown, rarity, each trait's "1 in N"), sync, async and rarityAll,
 *   2. without a base nothing changed (a full world is scored against its own pets, as before),
 *   3. a partial world that lost its _psBase field (a copy) still takes the page's base from V2Split; a full world never does,
 *   4. end to end: split.write publishes psBase, the page's own assemble() puts it on the fast world, and the fast world scores like the
 *      full one; the rank board's rarity (rank.json rb) is the same number as the card's.
 *   node tools/pet-score-base-test.js */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm'), zlib = require('zlib');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (c) pass++; else fail++; };

const PS = require('../js/pet-score.js');
/* a tiny stand-in for the rules: thresholds per species, an item table with a sig and an exclusive piece */
const V = {
  petThresholds: (w, p) => [0, 10, 100, 1000, 10000, p.species === 'dragon' ? 50000 : 69069],
  itemView: id => ({ sig: id === 'sig1', exclusive: id === 'ex1' })
};

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function toyWorld() {
  const r = rng(7), pick = a => a[Math.floor(r() * a.length)];
  const SP = ['pepe', 'pepe', 'pepe', 'kek', 'kek', 'dragon', 'wizard', 'nakamoto', 'homer'], EY = ['big', 'small', 'laser', 'sleepy'], PA = ['plain', 'spots', 'stripes', 'stars', 'zig'];
  const BG = ['blue', 'red', 'void', 'gold'], CH = [true, false, 'freckle'], OW = ['bc1qa', 'bc1qb', 'bc1qc', 'bc1qd', 'bc1qsolo'];
  const pets = [], items = {}, tip = 977700;
  for (let id = 1; id <= 420; id++) {
    const hy = r() < 0.08, sp = hy ? 'hyb:pepe-kek' : pick(SP), st = {};
    ['vigor', 'spark', 'grit', 'zoom', 'luck'].forEach(k => { st[k] = 1 + Math.floor(r() * 20); });
    const fd = {}, d = Math.floor(tip / 144); for (let i = 0; i < Math.floor(r() * 9); i++) fd[d - i] = 1;
    const p = { id, name: 'Pet ' + id, species: sp, owner: id === 400 ? 'bc1qsolo' : pick(OW.slice(0, 4)), tier: Math.floor(r() * 4), care: Math.floor(r() * 80000), stats: st, feedDays: fd,
      wins: Math.floor(r() * 12), losses: Math.floor(r() * 6), dead: r() < 0.15,
      art: { eyes: pick(EY), pattern: pick(PA), background: pick(BG), cheeks: pick(CH), crown: r() < 0.1 ? 'gold' : undefined, cape: r() < 0.1 ? 'red' : undefined } };
    if (hy) p.hybrid = { a: 'pepe', b: 'kek' };
    if (r() < 0.2) p.parents = [Math.max(1, id - 3), Math.max(1, id - 7)];
    if (r() < 0.05) p.mutation = { kind: 'glitch' };
    if (r() < 0.04) p.shows = 'og';
    if (r() < 0.03) p.ascended = true;
    if (id === 5) p.community = true;
    if (id === 9) p.released = true;
    pets.push(p);
  }
  let g = 0; const by = {}; pets.forEach(p => { by[p.id] = p; });
  pets.forEach(p => { if (r() < 0.3) { const n = 1 + Math.floor(r() * 3); for (let k = 0; k < n; k++) { const gid = 'g' + (++g), t = Math.floor(r() * 4);
    /* a piece the pet won that now sits in another wallet (traded away): a fast world of the pet's wallet never sees it */
    const away = r() < 0.2, owner = away ? 'bc1qz' : p.owner;
    items[gid] = { gid, item: r() < 0.1 ? 'sig1' : r() < 0.1 ? 'ex1' : 'it' + k, tier: t, legendary: t === 3 && r() < 0.5, owner, on: away ? null : (r() < 0.5 ? p.id : null), [r() < 0.5 ? 'wonBy' : 'rolledOn']: p.id }; } } });
  return { tip, pets, byId: by, items, itemList: Object.keys(items).map(k => items[k]), mythicOwners: {} };
}
const FULL = toyWorld();
/* a partial world built the way a fast page holds one: some pets, and only the items their wallet holds */
function part(pets, extra) {
  const ids = new Set(pets.map(p => p.id)), wallets = new Set(pets.map(p => p.owner)), items = {};
  FULL.itemList.forEach(it => { if (wallets.has(it.owner) || (it.on != null && ids.has(it.on))) items[it.gid] = JSON.parse(JSON.stringify(it)); });
  const ps = pets.map(p => JSON.parse(JSON.stringify(p))), by = {}; ps.forEach(p => { by[p.id] = p; });
  return Object.assign({ tip: FULL.tip, pets: ps, byId: by, items, itemList: Object.keys(items).map(k => items[k]), mythicOwners: {} }, extra || {});
}
const full = PS.compute(FULL, { rules: V });
const base = JSON.parse(JSON.stringify(PS.basis(FULL, { rules: V }))); /* through JSON, as the page gets it */
const near = (a, b) => Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(a));
function same(a, b) {
  if (!a || !b) return 'missing';
  for (const k of ['score', 'rank', 'top', 'percentile', 'dead']) if (a[k] !== b[k]) return k + ' ' + a[k] + ' vs ' + b[k];
  if (!near(a.rarityBits, b.rarityBits)) return 'rarity ' + a.rarityBits + ' vs ' + b.rarityBits;
  if (!near(a.rarityOneIn, b.rarityOneIn)) return 'rarity 1 in ' + a.rarityOneIn + ' vs ' + b.rarityOneIn;
  if (a.traitOneIn.length !== b.traitOneIn.length || a.traitOneIn.some((x, i) => !near(x, b.traitOneIn[i]))) return 'trait 1 in N';
  if (JSON.stringify(a.breakdown) !== JSON.stringify(b.breakdown)) return 'breakdown ' + JSON.stringify(a.breakdown) + ' vs ' + JSON.stringify(b.breakdown);
  return '';
}
function allSame(res, pets) { const bad = []; pets.forEach(p => { if (p.community || p.released) return; const why = same(full.byId[p.id], res.byId[p.id]); if (why) bad.push('#' + p.id + ' ' + why); }); return bad; }

/* ---- 1. parts of the world scored against the base give the full world's numbers */
ok(full.n === 418 && base.n === 418 && base.hist.length > 10, 'the toy world is scored (' + full.n + ' pets, base ' + JSON.stringify(base).length + ' bytes)');
const wallet = FULL.pets.filter(p => p.owner === 'bc1qa'), solo = FULL.pets.filter(p => p.owner === 'bc1qsolo');
const cases = {
  'one wallet (My Pets, every page in)': wallet,
  'one wallet, first page only (24 pets)': wallet.slice(0, 24),
  'a pet page: first page + the pet + its parents': wallet.slice(0, 24).concat([FULL.byId[333], FULL.byId[330], FULL.byId[326]]),
  'a one-pet wallet': solo,
  'one pet on its own': [FULL.byId[77]],
  'a page with the community pet and a released pet in it': wallet.slice(0, 10).concat([FULL.byId[5], FULL.byId[9]])
};
Object.keys(cases).forEach(name => {
  const pw = part(cases[name], { _view: 1, _psBase: base }), res = PS.compute(pw, { rules: V }), bad = allSame(res, cases[name]);
  ok(!bad.length && res.n === full.n, name + ': same numbers as the full world' + (bad.length ? ' (' + bad.length + ' differ: ' + bad.slice(0, 2).join('; ') + ')' : ''));
});
/* before the fix: the same parts graded against themselves showed other numbers (this is the bug Jake saw) */
{ const res = PS.compute(part(solo, { _view: 1 }), { rules: V, base: null }), bad = allSame(res, solo);
  ok(bad.length === solo.length, 'without the base a one-pet wallet shows other numbers (the old bug: ' + (bad[0] || 'none') + ')'); }
{ const pw = part(wallet, { _view: 1, _psBase: base }), ra = PS.rarityAll(pw), bad = ra.filter(r => !near(r.bits, full.byId[r.id].rarityBits));
  ok(ra.length === wallet.length && !bad.length, 'rarityAll (the 💎 board, cemetery) uses the base too'); }
{ const pw = part(wallet, { _view: 1, _psBase: base }), sync = PS.compute(pw, { rules: V });
  PS.computeAsync(part(wallet, { _view: 1, _psBase: base }), { rules: V }, r => { const bad = r ? allSame(r, wallet) : ['no result'];
    ok(r && !bad.length && Object.keys(r.byId).length === Object.keys(sync.byId).length, 'computeAsync with the base gives the same numbers'); finishAsync(); }); }

function finishAsync() {
  /* ---- 2. a full world never uses a base: exactly the numbers it always had */
  const again = PS.compute(FULL, { rules: V }), withBase = PS.compute(Object.assign({}, FULL, { _psBase: null }), { rules: V });
  ok(!allSame(again, FULL.pets).length && !allSame(withBase, FULL.pets).length && PS.baseOf(FULL) === null, 'a full world is scored against its own pets (unchanged)');

  /* ---- 3. a copy of a partial world that lost its _psBase still gets the page's base; a full world never takes it */
  global.V2Split = { scoreBase: () => base };
  const copy = part(wallet), r3 = PS.compute(copy, { rules: V });
  ok(PS.baseOf(copy) === base && !allSame(r3, wallet).length, 'a partial world without the field takes the page base (V2Split.scoreBase)');
  ok(PS.baseOf(FULL) === null, 'a full world never takes the page base');
  ok(PS.baseOf({ pets: [], _psBase: { v: 2, n: 3 } }) === null && PS.baseOf({ pets: [], _psBase: { v: 1, n: 0, stat: {}, combo: {}, rf: {}, hist: [] } }) === null, 'a broken or empty base is ignored');
  delete global.V2Split;

  /* ---- 4. end to end through the server's split.write and the page's assemble() */
  endToEnd().then(() => { console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0); }, e => { console.error(e.stack || e); process.exit(2); });
}
async function endToEnd() {
  const split = require('./sync-server/split');
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-base-'));
  try {
    await split.write(out, JSON.parse(JSON.stringify(Object.assign({}, FULL, { byId: null }))), { tip: FULL.tip, rsig: 'r' + 'ab'.repeat(16), ctx: { V2Rules: V } });
    const summary = JSON.parse(fs.readFileSync(path.join(out, 'summary.json'), 'utf8'));
    ok(summary.psBase && summary.psBase.n === full.n && JSON.stringify(summary.psBase) === JSON.stringify(base), 'split.write publishes the whole game\'s curve (summary.psBase)');
    const rank = fs.readFileSync(path.join(out, 'rank.json')).toString().split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } });
    const rows = [].concat(...rank.filter(Boolean).map(x => Array.isArray(x.pets) ? x.pets : Array.isArray(x) ? x : x.id != null ? [x] : []));
    const rb = rows.filter(r => r && r.rb != null), badRb = rb.filter(r => !near(r.rb, full.byId[r.id].rarityBits));
    ok(rb.length > 300 && !badRb.length, 'the rank board\'s rarity (rb) is the card\'s number (' + rb.length + ' rows' + (badRb.length ? ', ' + badRb.length + ' differ' : '') + ')');
    /* the page's own assemble() */
    const sx = { console, setTimeout, clearTimeout, URL, URLSearchParams, TextEncoder, TextDecoder, fetch: () => Promise.reject(new Error('offline')),
      document: { scripts: [], getElementById: () => null, body: { insertBefore: () => {} }, addEventListener() {} }, location: { search: '', hostname: 'x', href: 'https://x/', pathname: '/' },
      localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} }, addEventListener() {}, navigator: {} };
    sx.window = sx; sx.self = sx; sx.V2Rules = V; vm.createContext(sx);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/v2-art.js'), 'utf8'), sx); vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/v2-split.js'), 'utf8'), sx);
    const mine = wallet.map(p => { const r = JSON.parse(JSON.stringify(p)); r.worn = FULL.itemList.filter(it => it.on === p.id).map(it => split.itemRec(it)); return r; });
    const F = sx.V2Split.assemble(summary, { owners: { bc1qa: mine }, mythicOwners: {}, keepArt: true });
    ok(F._psBase && F._psBase.n === full.n, 'the page\'s assemble() puts the curve on the fast world');
    const res = PS.compute(F, { rules: V }), bad = allSame(res, wallet);
    ok(!bad.length, 'the fast world from the published view scores every pet like the full world' + (bad.length ? ' (' + bad.slice(0, 2).join('; ') + ')' : ''));
    const raw = fs.readFileSync(path.join(out, 'summary.json')), gz = zlib.gzipSync(JSON.stringify(summary.psBase)).length;
    ok(gz < 60000, 'the curve is small on the wire (' + gz + ' bytes gzipped here; ~28 KB at 207,000 pets)');
    void raw;
  } finally { try { fs.rmSync(out, { recursive: true, force: true }); } catch (e) {} }
}
