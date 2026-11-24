#!/usr/bin/env node
/* Fast-vs-full checker, part 2 (Nov 22 2026). For a set of real wallets:
 *   1. open the LIVE site in headless Chrome in view-only mode (localStorage 'xcpets-v2-me'; no wallet, nothing signed),
 *      wait until the page has loaded the wallet, and run tools/fastcheck/dump.js on the page's fast world;
 *   2. replay the full game in Node from api/boot.json up to the same block and run the same dump;
 *   3. report every difference (pets, gear, and the before-signing checks) to fastcheck-report.md / .json.
 * Exit code 1 when anything differs, so the workflow shows red.
 *   node tools/fastcheck/run.js [--site https://xcpets.fun] [--wallets a,b,c] [--out DIR] [--max-wait 300]
 * Needs playwright-core and Chrome (CHROME env or /opt/google/chrome/chrome). */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '../..');
const A = process.argv.slice(2), opt = (k, d) => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : d; };
const SITE = opt('--site', 'https://xcpets.fun').replace(/\/$/, ''), OUT = path.resolve(opt('--out', '.')), MAX_WAIT = +opt('--max-wait', 300) * 1000;
const dump = require('./dump');
const DUMP_SRC = fs.readFileSync(path.join(__dirname, 'dump.js'), 'utf8').replace(/if \(typeof module[^\n]*\n?/, '');
const FIXED = [
  'bc1ps9av86ymmlzy9zj3a8pn6g94pz4j5e0kagv3td3wutaagfjvekjs26m3s4', /* owner (very large) */
  'bc1pfvkpmllr7mtn5uazqxumwp39h2ny3c8l6fmrgvjv2cqn5wlpt7hssf3gqd', /* Evan */
  'bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n',
  '1JwWsArppwALMEdXWPmpDBcP1jwWsAPYkD', 'bc1qtke38j72qv4d8eljn7pccaykypw8luytfwdn7q' /* test wallets */ ];
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

/* ---------------------------------------------------------------- full replay in Node */
function engine() {
  const SCRIPTS = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', '@LIVE', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js', 'js/block-hashes.js'];
  const store = {}, ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const win = { console: { log() {}, warn() {}, error() {}, info() {} }, localStorage: ls, sessionStorage: ls, location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/' }, navigator: { userAgent: 'node' },
    setTimeout: () => 0, clearTimeout() {}, URLSearchParams, URL, TextEncoder, TextDecoder, fetch: () => Promise.reject(new Error('offline')) };
  win.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {}, body: null, documentElement: { style: {} } };
  win.addEventListener = () => {}; win.window = win; win.self = win; win.globalThis = win;
  const ctx = vm.createContext(win);
  for (const f of SCRIPTS) { if (f === '@LIVE') { vm.runInContext('window.LiveEngine={RealCore:window.RealCore,Chain:window.Chain&&window.Chain.Chain,CFG:window.XCPETS_CONFIG};', ctx); continue; } vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
  return ctx;
}
const NODE = opt('--node', 'https://node.xcpets.fun').replace(/\/$/, '');
const boot = JSON.parse(fs.readFileSync(path.join(ROOT, 'api/boot.json'), 'utf8'));
let ROWS = boot.rows.slice().sort((a, b) => a.block_index - b.block_index || a.tx_index - b.tx_index);
/* Nov 23 2026: the live page is usually newer than api/boot.json (the feed is rebuilt every 20-25 min, the world every 6 blocks),
 * and every scheduled run died with 'page tip is newer'. Take the game server's own full burn list (/xp/v1/sync, the same answer the
 * burn check reads) when it is newer, so the full replay can reach the page's block. */
async function freshRows() {
  try {
    const r = await fetch(NODE + '/xp/v1/sync?since=0', { signal: AbortSignal.timeout(60000) }); if (!r.ok) throw new Error('HTTP ' + r.status);
    const a = await r.json(), list = a && a.rows && a.rows.list;
    if (!(a.tip > boot.tip) || !Array.isArray(list) || !list.length) { log('server burn list tip ' + (a && a.tip) + ', keeping api/boot.json (' + boot.tip + ')'); return; }
    ROWS = list.slice().sort((x, y) => x.block_index - y.block_index || x.tx_index - y.tx_index);
    boot.hashes = Object.assign({}, boot.hashes || {}, a.hashes || {});
    if (a.dex && a.dex.body) boot.dex = a.dex.body;
    log('server burn list: ' + ROWS.length + ' burns to ' + a.tip + ' (api/boot.json ' + boot.tip + ')'); boot.tip = a.tip;
  } catch (e) { log('server burn list unavailable (' + String(e.message || e).slice(0, 120) + '), keeping api/boot.json ' + boot.tip); }
}
const worlds = {};
function fullAt(tip) { if (worlds[tip]) return worlds[tip];
  if (tip > boot.tip) throw new Error('page tip ' + tip + ' is newer than api/boot.json (' + boot.tip + ')');
  const ctx = engine(), t0 = Date.now(), hashes = Object.assign({}, ctx.XCPETS_BLOCK_HASHES || {}, boot.hashes || {});
  const w = ctx.V2Rules.replay(ROWS.filter(r => r.block_index <= tip), hashes, [], { tip, live: ctx.LiveEngine.RealCore, dex: boot.dex });
  log('full replay to ' + tip + ': ' + w.pets.length + ' pets in ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
  return (worlds[tip] = { w, V: ctx.V2Rules }); }

/* ---------------------------------------------------------------- the fast world, from the live page */
async function fastDump(browser, addr) {
  const cx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await cx.addInitScript(a => { try { localStorage.setItem('xcpets-v2-me', a); } catch (e) {} }, addr);
  const pg = await cx.newPage(), errors = [];
  pg.on('pageerror', e => errors.push(String(e.message || e).slice(0, 200)));
  const t0 = Date.now();
  try {
    await pg.goto(SITE + '/play.html?fastcheck=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 });
    let st = null;
    while (Date.now() - t0 < MAX_WAIT) {
      await pg.waitForTimeout(3000);
      st = await pg.evaluate(() => { try { const w = window.V2Mock && V2Mock.world && V2Mock.world(); if (!w || !w.pets) return { ready: false };
        const pgs = w._pages; return { ready: true, tip: w.tip, full: !!w._full || !pgs || (pgs.got || 1) >= (pgs.pages || 1), n: pgs ? pgs.n : null, got: pgs ? pgs.got : null, pages: pgs ? pgs.pages : null, pets: w.pets.length }; } catch (e) { return { ready: false, err: String(e) }; } });
      if (st && st.ready && st.full) break;
    }
    if (!st || !st.ready) return { addr, error: 'page never built a world', errors, secs: (Date.now() - t0) / 1000 };
    const d = await pg.evaluate(([src, me]) => { const fn = new Function(src + '\nreturn fastcheckDump;')(); const w = V2Mock.world(); const o = fn(w, V2Rules, me, w.tip);
      /* Nov 24 2026 root-cause pass: the world can be right while the page's own filter drops a pet (zombies hidden by the Discard pile).
       * Record what My Pets actually lists (V2UI.mine), so the compare checks the page, not only the data behind it. */
      try { o.shown = window.V2UI && V2UI.mine ? V2UI.mine(w).map(p => p.id).sort((a, b) => a - b) : null; } catch (e) { o.shown = 'THROWS: ' + String(e && e.message || e).slice(0, 120); }
      return o; }, [DUMP_SRC, addr]);
    return { addr, dump: d, partial: !st.full, status: st, errors, secs: (Date.now() - t0) / 1000 };
  } catch (e) { return { addr, error: String(e.message || e).slice(0, 300), errors, secs: (Date.now() - t0) / 1000 }; }
  finally { await cx.close(); }
}

/* ---------------------------------------------------------------- Rankings boards (Nov 24 2026)
 * Top burners was empty on every fast load and nothing noticed: the board counted from a burn list the fast page never has.
 * Open the live Rankings page (no wallet), visit every board (all time, and This week where it has one) and flag:
 *  - an all-time board with no rows, or a board that says its totals did not load,
 *  - a This week board that is empty while the full replay has burns / battle wins that week,
 *  - Top burners whose first wallets or totals differ from the full replay's own count. */
const RANK_BOARDS = [['wagmi'], ['pets'], ['pets', 1], ['power'], ['rare'], ['rare', 1], ['burn'], ['burn', 1], ['wins'], ['wins', 1], ['leg'], ['leg', 1], ['old']];
async function rankCheck(browser) {
  const cx = await browser.newContext({ viewport: { width: 1280, height: 900 } }), pg = await cx.newPage(), out = { boards: {}, burnTop: null, errors: [] };
  pg.on('pageerror', e => out.errors.push(String(e.message || e).slice(0, 200)));
  const t0 = Date.now(), state = () => pg.evaluate(() => { const w = window.V2Mock && V2Mock.world && V2Mock.world();
    return { tip: w && w.tip, rows: document.querySelectorAll('#board table.board td.rk').length, empty: ((document.querySelector('#board > p.muted:not(.rknote)') || {}).textContent || '').slice(0, 160),
      top: Array.from(document.querySelectorAll('#board table.board tr[id^="rk"]')).slice(0, 5).map(tr => { const b = tr.querySelector('b[title]'), c = tr.querySelectorAll('td'); return [b ? b.getAttribute('title') : '', c.length ? c[c.length - 1].textContent : '']; }) }; });
  const settle = async ms => { let st; const t1 = Date.now(); while (Date.now() - t1 < ms) { await pg.waitForTimeout(1500); st = await state(); if (st.rows || st.empty) break; } return st; };
  try {
    await pg.goto(SITE + '/ranking.html?board=wagmi&fastcheck=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 });
    await settle(MAX_WAIT);
    /* the board repaints itself (tabs included) when more data lands, so click by selector and try again if the button was replaced */
    const tap = async sel => { for (let i = 0; i < 4; i++) { try { if (!(await pg.$(sel))) return false; await pg.click(sel, { timeout: 10000 }); return true; } catch (e) { await pg.waitForTimeout(800); } } return false; };
    for (const [id, wk] of RANK_BOARDS) {
      const key = id + (wk ? ':week' : '');
      if (!(await tap('[data-board="' + id + '"]'))) { out.boards[key] = { rows: 0, empty: 'never painted (no tab)' }; continue; }
      await pg.waitForTimeout(300); await tap('[data-span="' + (wk ? 'week' : 'all') + '"]');
      const st = await settle(120000);
      out.boards[key] = { rows: st ? st.rows : 0, empty: st ? st.empty : 'never painted', top: st ? st.top : [] }; out.tip = st && st.tip;
      if (key === 'burn') out.burnTop = st ? st.top : [];
    }
  } catch (e) { out.error = String(e.message || e).slice(0, 300); }
  finally { await cx.close(); }
  out.secs = (Date.now() - t0) / 1000;
  return out;
}
function rankDiffs(rk) {
  const diffs = [], add = (k, key, f, g) => diffs.push({ kind: k, key, fast: f, full: g });
  if (rk.error) { add('rankings page', '-', rk.error, 'loads'); return diffs; }
  const tip = rk.tip, all = {}, wk = {}, wins = {};
  if (!(tip <= boot.tip)) { add('rankings page tip', '-', tip, '<= ' + boot.tip); return diffs; }
  ROWS.forEach(r => { if (r.block_index > tip || (r.status != null && String(r.status).toLowerCase() !== 'valid')) return; const a = r.amount != null ? Number(r.amount) || 0 : (Number(r.quantity) || 0) / 1e8;
    all[r.source] = (all[r.source] || 0) + a; if (r.block_index > tip - 1008) wk[r.source] = (wk[r.source] || 0) + a; });
  (fullAt(tip).w.fights || []).forEach(f => { if (f.status === 'done' && f.acceptBlock > tip - 1008) wins[f.winner] = 1; });
  const want = { 'burn:week': Object.keys(wk).some(a => wk[a] > 0), 'wins:week': Object.keys(wins).length > 0 };
  Object.keys(rk.boards).forEach(k => { const b = rk.boards[k];
    if (/did not load|never painted/.test(b.empty)) add('rankings board did not load', k, b.empty, 'rows');
    else if (!b.rows && (!/:week$/.test(k) || want[k])) add('rankings board is empty', k, b.empty || 0, 'rows'); });
  const order = Object.keys(all).filter(a => all[a] > 0).sort((a, b) => all[b] - all[a] || (a < b ? -1 : 1));
  (rk.burnTop || []).forEach((row, i) => { const v = Number(String(row[1]).replace(/[^0-9.]/g, ''));
    if (row[0] !== order[i]) add('Top burners order', '#' + (i + 1), row[0], order[i]);
    else if (Math.abs(v - all[order[i]]) > 0.01) add('Top burners total', '#' + (i + 1), v, Math.round(all[order[i]] * 100) / 100); });
  /* Nov 24 2026 root-cause pass: Most pets, Rarest collection and Legendary hunters read the server's per-wallet totals (view/rank.json),
   * another partial file. Their first five wallets and totals must match the full game's living pets (the page leaves #1765 out). */
  const F = fullAt(tip).w, RW = [1, 3, 10, 33], tot = { pets: {}, rare: {}, leg: {} };
  F.pets.forEach(p => { if (!p || p.dead || p.released || !p.owner || p.id === 1765) return; const o = p.owner;
    tot.pets[o] = (tot.pets[o] || 0) + 1; tot.rare[o] = (tot.rare[o] || 0) + (RW[p.tier] || 0); if (p.tier === 3) tot.leg[o] = (tot.leg[o] || 0) + 1; });
  ['pets', 'rare', 'leg'].forEach(id => { const b = rk.boards[id]; if (!b || !b.top || !b.top.length) return; const m = tot[id];
    const order = Object.keys(m).filter(o => m[o] > 0).sort((x, y) => m[y] - m[x] || (x < y ? -1 : 1));
    b.top.forEach((row, i) => { const v = Number(String(row[1]).replace(/[^0-9.]/g, ''));
      if (row[0] && m[row[0]] !== v) add('Rankings ' + id + ' total', '#' + (i + 1) + ' ' + String(row[0]).slice(0, 10) + '…', v, m[row[0]] || 0);
      else if (row[0] !== order[i] && m[row[0]] !== m[order[i]]) add('Rankings ' + id + ' order', '#' + (i + 1), row[0], order[i]); }); });
  return diffs;
}

/* ---------------------------------------------------------------- Cemetery (Nov 24 2026 root-cause pass)
 * The cemetery is built from two more partial sources: the server's grave index (GET /xp/v1/graves, its own files per world) and the
 * fast world's zombies. For a wallet in view-only mode, open the live cemetery page and read:
 *  - My graves: every grave the index lists for this wallet (the "My graves" shelf asks the same query) and the index's total,
 *  - My zombies: the zombies the page's world gives this wallet (what the My zombies door lists), and the Gods count,
 *  - the numbers on the doors (graves, my zombies, Gods), so a page that shows 0 while the data is there is caught too.
 * Then compare with the full replay: graves = the server's own builder (tools/sync-server/graves.js fromWorld) run on the full world. */
async function cemCheck(browser, addr) {
  const cx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await cx.addInitScript(a => { try { localStorage.setItem('xcpets-v2-me', a); } catch (e) {} }, addr);
  const pg = await cx.newPage(), errors = [], t0 = Date.now();
  pg.on('pageerror', e => errors.push(String(e.message || e).slice(0, 200)));
  try {
    await pg.goto(SITE + '/cemetery.html?fastcheck=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 });
    let ok = false;
    while (Date.now() - t0 < MAX_WAIT) { await pg.waitForTimeout(3000);
      ok = await pg.evaluate(() => { const w = window.V2Mock && V2Mock.world && V2Mock.world(); return !!(w && w.pets && document.querySelector('[data-door="mine"]') && window.V2GraveIndex); }); if (ok) break; }
    if (!ok) return { addr, error: 'cemetery page never painted its doors', errors, secs: (Date.now() - t0) / 1000 };
    await pg.waitForTimeout(4000); /* the door counts repaint once the grave index answers */
    const d = await pg.evaluate(async me => { const w = V2Mock.world(), V = window.V2Rules, GI = window.V2GraveIndex, sub = k => { const e = document.querySelector('[data-door="' + k + '"] small'); return e ? e.textContent : null; };
      const o = { tip: w.tip, zombies: w.pets.filter(p => V.isZ(p) && p.owner === me).map(p => p.id).sort((a, b) => a - b), gods: w.pets.filter(p => p.resurrected && !p.dead).length,
        doors: { raise: sub('raise'), mine: sub('mine'), gods: sub('gods') } };
      try { const r = await GI.fetchPage(GI.base(), { mine: true, owner: me, per: 1000000, page: 0, sort: 'id' }); o.graves = (r.rows || []).map(x => x.id).sort((a, b) => a - b); o.gtip = r.counts && r.counts.tip; o.gdead = r.counts && r.counts.dead; o.gsource = r.source; }
      catch (e) { o.graves = 'THROWS: ' + String(e && e.message || e).slice(0, 120); }
      return o; }, addr);
    return { addr, cem: d, errors, secs: (Date.now() - t0) / 1000 };
  } catch (e) { return { addr, error: String(e.message || e).slice(0, 300), errors, secs: (Date.now() - t0) / 1000 }; }
  finally { await cx.close(); }
}
function cemDiffs(r) {
  const diffs = [], add = (k, key, f, g) => diffs.push({ kind: k, key, fast: f, full: g }), c = r.cem, num = t => Number((/[\d,]+/.exec(String(t || '')) || ['0'])[0].replace(/,/g, '')) || 0;
  const G = require('../sync-server/graves');
  if (c.tip > boot.tip) { add('cemetery page tip', '-', c.tip, '<= ' + boot.tip); return diffs; }
  const F = fullAt(c.tip), zw = F.w.pets.filter(p => F.V.isZ(p) && p.owner === r.addr).map(p => p.id).sort((a, b) => a - b), gods = F.w.pets.filter(p => p.resurrected && !p.dead).length;
  const zs = new Set(c.zombies); zw.forEach(id => { if (!zs.has(id)) add('zombie missing from My zombies', id, null, 'risen zombie'); });
  c.zombies.forEach(id => { if (zw.indexOf(id) < 0) add('My zombies lists a pet that is not this wallet\'s zombie', id, 'listed', null); });
  if (r.addr && c.doors.mine != null && num(c.doors.mine) !== zw.length && !(zw.length === 0 && /none/.test(c.doors.mine))) add('My zombies door number', '-', c.doors.mine, zw.length);
  if (c.doors.gods != null && num(c.doors.gods) !== gods) add('Gods door number', '-', c.doors.gods, gods);
  if (!Array.isArray(c.graves)) { add('grave index', '-', c.graves, 'a list'); return diffs; }
  if (c.gsource !== 'index') add('grave index source', '-', c.gsource, 'index');
  if (!(c.gtip <= boot.tip)) { add('grave index tip', '-', c.gtip, '<= ' + boot.tip); return diffs; }
  const Fg = fullAt(c.gtip), rows = G.fromWorld({ V2Rules: Fg.V }, Fg.w, c.gtip), mine = rows.filter(x => x.owner === r.addr && x.id !== 1765).map(x => x.id).sort((a, b) => a - b), got = new Set(c.graves);
  mine.forEach(id => { if (!got.has(id)) add('grave missing from My graves', id, null, 'grave'); });
  c.graves.forEach(id => { if (mine.indexOf(id) < 0) add('My graves lists a pet that is not this wallet\'s grave', id, 'listed', null); });
  if (c.gdead !== rows.length) add('grave index total', '-', c.gdead, rows.length);
  if (c.doors.raise != null && num(c.doors.raise) !== rows.length && c.gtip === c.tip) add('Raise door grave count', '-', c.doors.raise, rows.length);
  r.fullGraves = mine.length; r.fullZombies = zw.length;
  return diffs;
}

/* ---------------------------------------------------------------- compare */
const J = v => JSON.stringify(v);
function compare(fast, full, partial) {
  const diffs = []; const add = (kind, key, f, g) => diffs.push({ kind, key, fast: f, full: g });
  const fp = fast.pets, gp = full.pets;
  /* Expected, not bugs: My Pets leaves graves out (the cemetery loads them on its own), and zombies hide the living-pet hunger meter (js/v2-zombies.js). */
  const deadOn = g => { const o = full.items[g] && full.items[g].on; return o != null && gp[o] && (gp[o].dead || gp[o].released); }, ZH = { hungry: 1, nextMeal: 1, fedToday: 1 };
  Object.keys(gp).forEach(id => { if (!fp[id] && !partial && !gp[id].dead && !gp[id].released) add('pet missing on fast page', id, null, 'alive'); });
  Object.keys(fp).forEach(id => { if (!gp[id]) add('pet on fast page but not owned in full game', id, fp[id].owner, null); });
  Object.keys(fp).forEach(id => { const a = fp[id], b = gp[id]; if (!b) return; Object.keys(Object.assign({}, a, b)).forEach(k => { if (b.zombie && ZH[k]) return; if (J(a[k]) !== J(b[k])) add('pet field: ' + k, id, a[k], b[k]); }); });
  Object.keys(full.items).forEach(g => { if (!fast.items[g] && !partial && !deadOn(g)) add('gear missing on fast page', g, null, full.items[g].item + (full.items[g].on != null ? ' on #' + full.items[g].on : ' in stash')); });
  Object.keys(fast.items).forEach(g => { const a = fast.items[g], b = full.items[g]; if (!b) { add('gear on fast page but not owned in full game', g, a.item, null); return; }
    Object.keys(Object.assign({}, a, b)).forEach(k => { if (J(a[k]) !== J(b[k])) add('gear field: ' + k, g, a[k], b[k]); }); });
  Object.keys(fast.checks).forEach(id => { const a = fast.checks[id], b = full.checks[id] || {}; Object.keys(Object.assign({}, a, b)).forEach(k => { if (J(a[k]) !== J(b[k])) add('check: ' + k, id, a[k], b[k]); }); });
  /* My Pets lists every owned living pet that is not discarded on chain (a risen zombie always: it can't be discarded). Graves load on their own (see above). */
  if (fast.shown != null) { const want = Object.keys(gp).filter(id => !gp[id].released && !gp[id].dead && !(gp[id].hd === full.me && !gp[id].zombie)).map(Number), got = new Set(Array.isArray(fast.shown) ? fast.shown : []);
    if (!Array.isArray(fast.shown)) add('My Pets list', '-', fast.shown, 'a list');
    else { want.forEach(id => { if (!got.has(id) && (!partial || gp[id].zombie)) add('pet missing from My Pets list', id, null, gp[id].zombie ? 'risen zombie' : gp[id].dead ? 'grave' : 'alive'); });
      fast.shown.forEach(id => { if (!gp[id]) add('My Pets lists a pet not owned in the full game', id, 'listed', null); }); } }
  ['communityFed', 'halving', 'mythicOwner'].concat(partial ? [] : ['ownAlive']).forEach(k => { if (J(fast.world[k]) !== J(full.world[k])) add('world: ' + k, '-', fast.world[k], full.world[k]); });
  return diffs;
}

/* ---------------------------------------------------------------- main */
(async () => {
  await freshRows();
  let wallets = opt('--wallets') ? opt('--wallets').split(',') : null;
  if (!wallets) { /* fixed list + the biggest holders + a few small ones, from the newest feed */
    const { w } = fullAt(boot.tip), n = {}; w.pets.forEach(p => { if (p && p.owner && !p.community && !p.released) n[p.owner] = (n[p.owner] || 0) + 1; });
    const by = Object.keys(n).sort((a, b) => n[b] - n[a]), small = by.filter(a => n[a] >= 3 && n[a] <= 150);
    wallets = Array.from(new Set(FIXED.concat(by.slice(0, 6), small.slice(0, 3)))); }
  log('wallets: ' + wallets.length);
  const { chromium } = require('playwright-core');
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/google/chrome/chrome', headless: true, args: ['--no-sandbox'] });
  const results = [];
  for (const addr of wallets) {
    const r = await fastDump(browser, addr); log(addr.slice(0, 12) + '… ' + (r.error || ('tip ' + r.dump.tip + ', ' + Object.keys(r.dump.pets).length + ' pets' + (r.partial ? ' (partial load)' : ''))) + ' in ' + r.secs.toFixed(0) + ' s');
    /* a page that never loaded (tip 0: the server was restarting) is not a match: replaying "to block 0" gives 0 pets on both sides */
    if (r.dump && !(r.dump.tip > 0)) { r.diffs = [{ kind: 'page did not load', key: '-', fast: 'tip 0', full: 'tip ' + boot.tip }]; r.fullPets = '?'; }
    else if (r.dump) { const F = fullAt(r.dump.tip), full = dump(F.w, F.V, addr, r.dump.tip, r.dump.ids); r.diffs = compare(r.dump, full, r.partial); r.fullPets = Object.keys(full.pets).length; }
    delete r.dump; results.push(r);
  }
  const CEM_N = +opt('--cem', 5), cems = [];
  for (const addr of wallets.slice(0, CEM_N)) { const c = await cemCheck(browser, addr); if (c.cem) c.diffs = cemDiffs(c);
    log('cemetery ' + addr.slice(0, 12) + '… ' + (c.error || (c.cem.zombies.length + ' zombies, ' + (Array.isArray(c.cem.graves) ? c.cem.graves.length : '?') + ' graves, ' + c.diffs.length + ' problems')) + ' in ' + c.secs.toFixed(0) + ' s'); cems.push(c); }
  const rk = await rankCheck(browser); rk.diffs = rankDiffs(rk);
  log('rankings: tip ' + rk.tip + ', ' + Object.keys(rk.boards).length + ' boards, ' + rk.diffs.length + ' problems in ' + rk.secs + ' s' + (rk.error ? ' (' + rk.error + ')' : ''));
  await browser.close();
  /* report */
  let md = '# Fast vs full check\n\nSite ' + SITE + ' · feed tip ' + boot.tip + ' · ' + new Date().toISOString() + '\n\n', bad = 0;
  md += '## Rankings boards' + (rk.diffs.length ? ' ❌ ' + rk.diffs.length + ' problems' : ' ✅ every board has rows, Top burners matches') + '\n\n' +
    Object.keys(rk.boards).map(k => k + ' ' + (rk.boards[k].rows || 0)).join(' · ') + '\n\n' + rk.diffs.map(d => '- **' + d.kind + '** ' + d.key + ': page=' + J(d.fast) + ' full=' + J(d.full)).join('\n') + (rk.diffs.length ? '\n\n' : '');
  if (rk.diffs.length) bad++;
  md += '## Cemetery\n\n'; cems.forEach(c => { const short = c.addr.slice(0, 10) + '…' + c.addr.slice(-6);
    if (c.error) { bad++; md += '- ' + short + ' ❌ ' + c.error + '\n'; return; }
    md += '- ' + short + (c.diffs.length ? ' ❌ ' + c.diffs.length + ' problems' : ' ✅ matches') + ' · ' + (c.fullZombies != null ? c.fullZombies : c.cem.zombies.length) + ' zombies, ' + (c.fullGraves != null ? c.fullGraves : '?') + ' graves (index tip ' + c.cem.gtip + ')' + (c.errors.length ? ' · page errors: ' + c.errors.slice(0, 2).join(' | ') : '') + '\n';
    if (c.diffs.length) { bad++; c.diffs.slice(0, 12).forEach(d => { md += '  - **' + d.kind + '** ' + d.key + ': page=' + J(d.fast) + ' full=' + J(d.full) + '\n'; }); } }); md += '\n';
  results.forEach(r => { const short = r.addr.slice(0, 10) + '…' + r.addr.slice(-6);
    if (r.error) { bad++; md += '## ' + short + '\n\n❌ ' + r.error + '\n\n'; return; }
    md += '## ' + short + (r.diffs.length ? ' ❌ ' + r.diffs.length + ' differences' : ' ✅ matches') + '\n\n' + r.fullPets + ' pets in the full game' + (r.partial ? ' · fast page only partly loaded (too big to load in the background)' : '') + ' · loaded in ' + r.secs.toFixed(0) + ' s' + (r.errors.length ? ' · page errors: ' + r.errors.slice(0, 3).join(' | ') : '') + '\n\n';
    if (r.diffs.length) { bad++; const g = {}; r.diffs.forEach(d => (g[d.kind] = g[d.kind] || []).push(d));
      Object.keys(g).sort((a, b) => g[b].length - g[a].length).forEach(k => { const rng = {}; g[k].forEach(d => { const n = Number(d.key); if (n >= 0) { const b = Math.floor(n / 10000) * 10; rng[b] = (rng[b] || 0) + 1; } });
        const rs = Object.keys(rng).length > 1 ? ' (ids ' + Object.keys(rng).map(b => b + 'k+: ' + rng[b]).join(', ') + ')' : '';
        md += '- **' + k + '** × ' + g[k].length + rs + ': ' + g[k].slice(0, 3).map(d => '#' + d.key + ' fast=' + J(d.fast) + ' full=' + J(d.full)).join(' · ').slice(0, 600) + '\n'; }); md += '\n'; } });
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'fastcheck-report.md'), md); fs.writeFileSync(path.join(OUT, 'fastcheck-report.json'), JSON.stringify(results.concat([{ rankings: rk }, { cemetery: cems }]), null, 1));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
  console.log(md); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
