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
    if (r.dump) { const F = fullAt(r.dump.tip), full = dump(F.w, F.V, addr, r.dump.tip, r.dump.ids); r.diffs = compare(r.dump, full, r.partial); r.fullPets = Object.keys(full.pets).length; }
    delete r.dump; results.push(r);
  }
  await browser.close();
  /* report */
  let md = '# Fast vs full check\n\nSite ' + SITE + ' · feed tip ' + boot.tip + ' · ' + new Date().toISOString() + '\n\n', bad = 0;
  results.forEach(r => { const short = r.addr.slice(0, 10) + '…' + r.addr.slice(-6);
    if (r.error) { bad++; md += '## ' + short + '\n\n❌ ' + r.error + '\n\n'; return; }
    md += '## ' + short + (r.diffs.length ? ' ❌ ' + r.diffs.length + ' differences' : ' ✅ matches') + '\n\n' + r.fullPets + ' pets in the full game' + (r.partial ? ' · fast page only partly loaded (too big to load in the background)' : '') + ' · loaded in ' + r.secs.toFixed(0) + ' s' + (r.errors.length ? ' · page errors: ' + r.errors.slice(0, 3).join(' | ') : '') + '\n\n';
    if (r.diffs.length) { bad++; const g = {}; r.diffs.forEach(d => (g[d.kind] = g[d.kind] || []).push(d));
      Object.keys(g).sort((a, b) => g[b].length - g[a].length).forEach(k => { const rng = {}; g[k].forEach(d => { const n = Number(d.key); if (n >= 0) { const b = Math.floor(n / 10000) * 10; rng[b] = (rng[b] || 0) + 1; } });
        const rs = Object.keys(rng).length > 1 ? ' (ids ' + Object.keys(rng).map(b => b + 'k+: ' + rng[b]).join(', ') + ')' : '';
        md += '- **' + k + '** × ' + g[k].length + rs + ': ' + g[k].slice(0, 3).map(d => '#' + d.key + ' fast=' + J(d.fast) + ' full=' + J(d.full)).join(' · ').slice(0, 600) + '\n'; }); md += '\n'; } });
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'fastcheck-report.md'), md); fs.writeFileSync(path.join(OUT, 'fastcheck-report.json'), JSON.stringify(results, null, 1));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
  console.log(md); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
