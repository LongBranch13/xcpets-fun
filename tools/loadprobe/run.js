#!/usr/bin/env node
/* Load probe (Nov 22 2026): how fast does each page open for real wallets on the LIVE site, and what does it download?
 * View-only (localStorage 'xcpets-v2-me'; no wallet, nothing signed). For each page × wallet it records:
 *   - first pets: seconds until the page's world holds this wallet's pets, and until a pet picture is drawn
 *   - full: seconds until every owner page arrived (or 'partial' at the cap)
 *   - bytes and requests, split by file kind, and the 8 biggest files
 * Optional phone network (--slow): about 9 Mbit/s down, 150 ms latency, 4x slower CPU.
 * --branch: also run each case with this checkout's pages and scripts served in place of xcpets.fun's (the live feed api/ and
 *   node.xcpets.fun stay live), so a change can be measured on real data before it ships. Rows are marked live / branch.
 *   node tools/loadprobe/run.js [--site https://xcpets.fun] [--wallets a,b] [--pages play.html,cemetery.html] [--slow] [--max-wait 180]
 * --no-world: the server's ready-made world is made unreachable (node.xcpets.fun/xp/v1/world/*), so the page rebuilds the game in the browser, the
 *   situation of the Nov 22 2026 'Page Unresponsive' report. --scroll: after loading, scroll My Pets to the bottom and count blank pet pictures.
 *   Every run also records main-thread freezes (long tasks: count, total, longest) and, with --profile, the functions that used the main thread most.
 * --verify: after the load, start the background chain check (what a burn or the Verify button starts: 'Applying the newest blocks…')
 *   and time each of its steps (the worker's own timings) until burns would open.
 * Writes loadprobe.md (also to the GitHub step summary when GITHUB_STEP_SUMMARY is set). Read-only. */
'use strict';
const fs = require('fs');
const A = process.argv.slice(2), opt = (k, d) => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : d; };
const SITE = opt('--site', 'https://xcpets.fun').replace(/\/$/, ''), MAX_WAIT = +opt('--max-wait', 180) * 1000, SLOW = A.includes('--slow');
const EMPTY_S = +opt('--empty-after', 90);
const NO_WORLD = A.includes('--no-world'), SCROLL = A.includes('--scroll'), PROFILE = A.includes('--profile');
const VERIFY = A.includes('--verify');
/* --warm: after the first visit, open the page twice more in the same browser: a return visit (saved files kept) and a return visit after
 * the server published a newer world (the saved world files dropped). Rows are marked first visit / return / return, new world. */
const WARM = A.includes('--warm');
const MODE = { cold: 'first visit', warm: 'return', newtip: 'return, new world' };
const BRANCH = A.includes('--branch'), ROOT = require('path').resolve(__dirname, '../..');
const WALLETS = (opt('--wallets', '') || [
  'bc1pfvkpmllr7mtn5uazqxumwp39h2ny3c8l6fmrgvjv2cqn5wlpt7hssf3gqd', /* Evan */
  'bc1ps9av86ymmlzy9zj3a8pn6g94pz4j5e0kagv3td3wutaagfjvekjs26m3s4', /* owner */
  'bc1pd8pantl2vmvdf5uvtvvn0r3xnnuxvp0wln8xmlxqmykxfnte3mwqmes2ut', /* about 10,000 living pets */
  '1JwWsArppwALMEdXWPmpDBcP1jwWsAPYkD' ].join(',')).split(',').map(s => s.trim()).filter(s => s.length > 20);
const PAGES = opt('--pages', 'play.html,breed.html,cemetery.html').split(',');
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
function kind(u) { if (/\/view\/own\/[^/]*\.d[.0-9]*json/.test(u)) return 'graves'; if (/\/view\/own\//.test(u)) return 'own pages'; if (/\/view\/p\//.test(u)) return 'pet shards';
  if (/\/view\//.test(u)) return 'view: ' + u.split('/view/')[1].split('?')[0]; if (/latest\.json|\/world\//.test(u)) return 'world'; if (/\/api\//.test(u)) return 'feed: ' + u.split('/api/')[1].split('?')[0];
  if (/\.js(\?|$)/.test(u)) return 'scripts'; if (/\.(png|gif|webp|jpg|svg)(\?|$)/.test(u)) return 'images'; if (/\.(woff2?|ttf)(\?|$)/.test(u)) return 'fonts'; if (/node\.xcpets|counterparty|\/v2\//.test(u)) return 'chain reads'; return 'other'; }
const TYPES = { html: 'text/html', js: 'application/javascript', css: 'text/css', json: 'application/json', png: 'image/png', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp', woff2: 'font/woff2', ico: 'image/x-icon' };
async function serveBranch(cx) {
  const path = require('path');
  await cx.route(u => { try { const x = new URL(u); return (x.hostname === 'xcpets.fun' || x.hostname === 'www.xcpets.fun') && !x.pathname.startsWith('/api/'); } catch (e) { return false; } }, r => {
    let f = decodeURIComponent(new URL(r.request().url()).pathname); if (f.endsWith('/')) f += 'index.html';
    const fp = path.join(ROOT, path.normalize(f)); if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) return r.continue();
    return r.fulfill({ status: 200, contentType: TYPES[fp.split('.').pop()] || 'application/octet-stream', body: fs.readFileSync(fp) }); });
}
async function probe(browser, page, addr, branch) {
  const cx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  if (branch) await serveBranch(cx);
  await cx.addInitScript(a => { try { localStorage.setItem('xcpets-v2-me', a); localStorage.setItem('xcpets-tut-coach-skip', '1'); } catch (e) {} }, addr);
  /* main-thread freezes: every long task (over 50 ms) the page runs, with its start time */
  await cx.addInitScript(() => { try { const L = window.__probeLT = []; new PerformanceObserver(l => { for (const e of l.getEntries()) L.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true }); } catch (e) {} });
  if (NO_WORLD) await cx.route(u => /node\.xcpets\.fun\/xp\/v1\/world\//.test(u.href || String(u)), r => r.abort());
  const runs = [await loadOnce(cx, page, addr, 'cold')];
  if (WARM) { runs.push(await loadOnce(cx, page, addr, 'warm')); runs.push(await loadOnce(cx, page, addr, 'newtip')); }
  await cx.close();
  return runs.map(r => { const by = {}; let total = 0; r.reqs.forEach(q => { const k = kind(q.u); by[k] = by[k] || { n: 0, b: 0 }; by[k].n++; by[k].b += q.b; total += q.b; });
    return Object.assign(r, { branch: !!branch, total, n: r.reqs.length, by, big: r.reqs.sort((a, b) => b.b - a.b).slice(0, 8) }); });
}
/* One page load in context cx. mode: 'cold' (first visit), 'warm' (same context again: the browser's saved files and IndexedDB stay),
 * 'newtip' (same, but the saved published-world files are dropped first: a return visit after the server published a newer world,
 * which is what a player who comes back an hour later sees). */
async function loadOnce(cx, page, addr, mode) {
  if (mode === 'newtip') { const pg0 = await cx.newPage(); try { await pg0.goto(SITE + '/robots.txt', { timeout: 30000 }); await pg0.evaluate(async () => {
    for (const k of await caches.keys()) { const c = await caches.open(k); for (const r of await c.keys()) if (/\/xp\/v1\/world\//.test(r.url)) await c.delete(r); } }); } catch (e) {} await pg0.close(); }
  const pg = await cx.newPage(), reqs = [], errors = [];
  let prof = null;
  if (PROFILE) { prof = await cx.newCDPSession(pg); await prof.send('Profiler.enable'); await prof.send('Profiler.setSamplingInterval', { interval: 2000 }); await prof.send('Profiler.start'); try { prof.t0Page = await pg.evaluate(() => performance.now()); } catch (e) { prof.t0Page = 0; } }
  if (SLOW) { const s = await cx.newCDPSession(pg); await s.send('Network.enable'); await s.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 9e6 / 8, uploadThroughput: 2e6 / 8 }); await s.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
  pg.on('pageerror', e => errors.push(String(e.message || e).slice(0, 160)));
  /* answers from the game server that were not OK (rate limit, timeouts): the usual reason a page falls back to the slow in-browser rebuild */
  const bad = {}; const noteBad = (u, why) => { if (!/node\.xcpets\.fun/.test(u)) return; const k = why + ' ' + u.replace(/^https:\/\/node\.xcpets\.fun/, '').replace(/\?.*/, '').replace(/r[0-9a-f]{32}\/\d+\//, '').slice(0, 40); bad[k] = (bad[k] || 0) + 1; };
  pg.on('response', r => { if (r.status() >= 400) noteBad(r.url(), String(r.status())); });
  pg.on('requestfailed', r => noteBad(r.url(), 'failed'));
  pg.on('requestfinished', async r => { try { const z = await r.sizes(); reqs.push({ u: r.url(), b: z.responseBodySize + z.responseHeadersSize }); } catch (e) {} });
  const t0 = Date.now(); let tWorld = null, tDraw = null, tFull = null, tCard = null, st = null;
  try {
    await pg.goto(SITE + '/' + page + '?probe=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 });
    while (Date.now() - t0 < MAX_WAIT) {
      await pg.waitForTimeout(500);
      st = await pg.evaluate(me => { try { const w = window.V2Mock && V2Mock.world && V2Mock.world(); const drawn = Array.prototype.filter.call(document.querySelectorAll('#pets canvas.sprite, canvas[data-id]'), c => !!c._fr).length, cards = document.querySelectorAll('#pets .pet.card').length;
        if (!w || !w.pets) return { ready: false, drawn, cards }; const pgs = w._pages, mine = w.pets.filter(p => p.owner === me).length;
        return { ready: true, cards, mine, pets: w.pets.length, pending: !!w.pending, drawn, full: !!w._full || !pgs || (pgs.got || 1) >= (pgs.pages || 1), n: pgs ? pgs.n : null, got: pgs ? pgs.got : null, pages: pgs ? pgs.pages : null,
          heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null }; } catch (e) { return { ready: false, err: String(e) }; } }, addr);
      const s = (Date.now() - t0) / 1000;
      if (st.ready && st.mine > 0 && tWorld == null) tWorld = s;
      if (st.drawn > 0 && tDraw == null) tDraw = s;
      if (st.cards > 0 && tCard == null) tCard = s;
      /* the first world can be an empty placeholder that already says 'full': wait for this wallet's pets (or 25 s for a wallet with none) */
      /* An in-browser rebuild can take minutes: a wallet with pets waits for them (up to --max-wait); one that still shows none after EMPTY_S is empty. */
      if (st.ready && st.full && tFull == null && (st.mine > 0 || (s > EMPTY_S && !st.pending && st.pets > 0))) { tFull = s; await pg.waitForTimeout(3000); break; }
    }
  } catch (e) { errors.push('goto: ' + String(e.message || e).slice(0, 160)); }
  await pg.waitForTimeout(1000);
  let blank = null, scroll = null, lt = [], top = null;
  try { blank = await pg.evaluate(BLANK_SRC); } catch (e) {}
  if (SCROLL && mode !== 'newtip') try { scroll = await scrollTest(pg); } catch (e) { errors.push('scroll: ' + String(e.message || e).slice(0, 120)); }
  let verify = null;
  if (VERIFY && mode === 'cold') try { verify = await verifyTest(pg); } catch (e) { errors.push('verify: ' + String(e.message || e).slice(0, 120)); }
  try { lt = await pg.evaluate(() => window.__probeLT || []); } catch (e) {}
  if (prof) try { const { profile } = await prof.send('Profiler.stop'); top = topFns(profile); top.tasks = taskFns(profile, prof.t0Page, lt); } catch (e) { errors.push('profile: ' + String(e.message || e).slice(0, 120)); }
  Object.keys(bad).forEach(k => errors.push('server ' + k + (bad[k] > 1 ? ' x' + bad[k] : '')));
  let fcp = null; try { fcp = await pg.evaluate(() => { const e = performance.getEntriesByName('first-contentful-paint')[0]; return e ? Math.round(e.startTime) / 1000 : null; }); } catch (e) {}
  await pg.close();
  return { mode, page, addr, tWorld, tDraw, tFull, tCard, fcp, st, errors, reqs, secs: (Date.now() - t0) / 1000, blank, scroll, lt, top, verify };
}
/* Start the check worker (V2Split.startVerify) and note when each bar text first shows, plus the worker's own step timings. */
async function verifyTest(pg) {
  const has = await pg.evaluate(() => !!(window.V2Split && V2Split.startVerify && window.V2Mock && V2Mock.state && V2Mock.state().view));
  if (!has) return { skipped: 'page did not paint from the published world' };
  const t0 = Date.now(), seen = [];
  await pg.evaluate(() => { window.__probeVerify = null; V2Split.startVerify().then(m => { window.__probeVerify = m || { ok: false }; }, () => { window.__probeVerify = { ok: false }; }); });
  let done = null, last = '';
  while (Date.now() - t0 < 300000) {
    await pg.waitForTimeout(200);
    const r = await pg.evaluate(() => { const b = document.getElementById('splitViewBar'), sl = document.getElementById('statusLine');
      return { bar: b ? b.textContent.replace(/\s+/g, ' ').replace(/[0-9]+ \/ [0-9]+ files/, 'N files').slice(0, 80) : '', line: sl ? sl.textContent.slice(0, 80) : '', done: window.__probeVerify, t: window.__xcpVerifyT || null, err: window.__xcpVerifyErr || null }; });
    if (r.bar !== last) { seen.push([((Date.now() - t0) / 1000).toFixed(1), r.bar]); last = r.bar; }
    if (r.done) { done = r; break; }
  }
  return { secs: (Date.now() - t0) / 1000, ok: !!(done && done.done && done.done.ok), t: done && done.t, seen, line: done && done.line, err: done && done.err };
}
/* Pet pictures on screen that are still one flat colour (black square / empty) = not drawn yet. Runs in the page. */
const BLANK_SRC = `(() => { const out = { onScreen: 0, blank: 0, cards: document.querySelectorAll('#pets .pet.card').length };
  const vh = innerHeight; for (const c of document.querySelectorAll('#pets .pet.card canvas, #mpsBox canvas')) { const r = c.getBoundingClientRect();
    if (r.width < 8 || r.bottom < 0 || r.top > vh) continue; out.onScreen++;
    try { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let same = true; for (let i = 4; i < d.length; i += 4) if (d[i] !== d[0] || d[i + 1] !== d[1] || d[i + 2] !== d[2] || d[i + 3] !== d[3]) { same = false; break; } if (same) out.blank++; } catch (e) {} }
  return out; })()`;
/* Scroll My Pets to the bottom a screen at a time (the way a thumb does), and after each step count the blank pictures a quarter second
 * and one second later. Long tasks during the scroll are in the same long-task list (marked by time). */
async function scrollTest(pg) {
  const t0 = await pg.evaluate(() => performance.now()), steps = [];
  if (!(await pg.evaluate(() => document.querySelectorAll('#pets .pet.card').length))) return null;
  await pg.evaluate(() => { const c = document.querySelector('#pets .pet.card'); if (c) c.scrollIntoView({ block: 'start' }); });
  await pg.waitForTimeout(500);
  const vp = pg.viewportSize() || { width: 390, height: 844 };
  for (let i = 0; i < 60; i++) {
    /* a real wheel/finger scroll over the list, so whatever element scrolls (window or a container) moves */
    const y0 = await pg.evaluate(() => { const c = document.querySelector('#pets .pet.card'); return c ? c.getBoundingClientRect().top : 0; });
    await pg.mouse.move(vp.width / 2, vp.height / 2); await pg.mouse.wheel(0, Math.round(vp.height * 0.9));
    const more = await pg.evaluate(y => { const c = document.querySelector('#pets .pet.card'); return !!c && Math.abs(c.getBoundingClientRect().top - y) > 4; }, y0);
    await pg.waitForTimeout(250); const a = await pg.evaluate(BLANK_SRC);
    await pg.waitForTimeout(750); const b = await pg.evaluate(BLANK_SRC);
    steps.push([a.onScreen, a.blank, b.blank]);
    if (!more) break;
  }
  const t1 = await pg.evaluate(() => performance.now());
  return { t0, t1, steps, blank250: steps.reduce((n, s) => n + s[1], 0), blank1s: steps.reduce((n, s) => n + s[2], 0), shown: steps.reduce((n, s) => n + s[0], 0) };
}
/* Self time per function from a CPU profile (main thread only): the places that hold the page. */
function topFns(profile) {
  const byId = new Map(); profile.nodes.forEach(n => byId.set(n.id, n));
  const self = new Map(), dt = profile.timeDeltas || [], sm = profile.samples || [];
  for (let i = 0; i < sm.length; i++) { const n = byId.get(sm[i]); if (!n) continue; const cf = n.callFrame; if (cf.functionName === '(idle)' || cf.functionName === '(program)') continue;
    const k = (cf.functionName || '(anon)') + ' ' + (cf.url ? cf.url.replace(/\?.*/, '').split('/').slice(-2).join('/') + ':' + (cf.lineNumber + 1) : '(' + (cf.functionName || 'native') + ')');
    self.set(k, (self.get(k) || 0) + (dt[i] || 0)); }
  const byFile = new Map(); for (const [k, v] of self) { const f = (k.split(' ')[1] || '').replace(/:\d+$/, ''); byFile.set(f, (byFile.get(f) || 0) + v); }
  const ms = v => Math.round(v / 1000);
  return { fns: [...self].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => [k, ms(v)]), files: [...byFile].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => [k, ms(v)]) };
}
/* For each of the longest tasks (over 300 ms): the functions that ran inside it (profile samples mapped onto page time). */
function taskFns(profile, t0Page, lt) {
  const byId = new Map(); profile.nodes.forEach(n => byId.set(n.id, n));
  const big = lt.filter(x => x[1] >= 300).sort((a, b) => b[1] - a[1]).slice(0, 6), dt = profile.timeDeltas || [], sm = profile.samples || [];
  if (!big.length) return [];
  const par = new Map(); profile.nodes.forEach(x => (x.children || []).forEach(c => par.set(c, x.id)));
  const at = []; let t = 0; for (let i = 0; i < sm.length; i++) { t += dt[i] || 0; at.push(t0Page + t / 1000); }
  return big.map(([st, du]) => { const self = new Map(), stack = new Map();
    for (let i = 0; i < sm.length; i++) { if (at[i] < st || at[i] > st + du) continue; let n = byId.get(sm[i]); if (!n) continue; const cf = n.callFrame;
      const k = (cf.functionName || '(anon)') + ' ' + (cf.url ? cf.url.replace(/\?.*/, '').split('/').slice(-2).join('/') + ':' + (cf.lineNumber + 1) : '');
      self.set(k, (self.get(k) || 0) + (dt[i] || 0));
      /* the outermost page-script frame = what started the task */
      let outer = null;
      for (let id = sm[i]; id != null; id = par.get(id)) { const f = byId.get(id).callFrame; if (f.url && f.url.indexOf('http') === 0) outer = (f.functionName || '(anon)') + ' ' + f.url.replace(/\?.*/, '').split('/').slice(-2).join('/') + ':' + (f.lineNumber + 1); }
      if (outer) stack.set(outer, (stack.get(outer) || 0) + (dt[i] || 0)); }
    const top = m => [...m].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => k + ' ' + Math.round(v / 1000) + ' ms').join(' · ');
    return { at: Math.round(st), ms: du, self: top(self), from: top(stack) }; });
}
function ltSum(lt, from, to) { const a = lt.filter(x => x[0] >= (from || 0) && x[0] < (to == null ? Infinity : to)); return { n: a.length, total: a.reduce((s, x) => s + x[1], 0), max: a.reduce((m, x) => Math.max(m, x[1]), 0), over1s: a.filter(x => x[1] >= 1000).length }; }
const MB = b => (b / 1e6).toFixed(2) + ' MB', S = s => s == null ? '–' : s.toFixed(1) + ' s';
(async () => {
  const { chromium } = require('playwright-core');
  const browser = await chromium.launch({ executablePath: process.env.CHROME || (fs.existsSync('/opt/google/chrome/chrome') ? '/opt/google/chrome/chrome' : undefined), args: ['--no-sandbox', '--enable-precise-memory-info'] });
  let md = '# Load probe\n\n' + SITE + (SLOW ? ' · phone network + 4x slower CPU' : ' · fast network') + (NO_WORLD ? ' · **server world blocked (in-browser rebuild)**' : '') + ' · ' + new Date().toISOString() + '\n\n| Page | Wallet | Page shows | First card | Own pets in world | Pet drawn | All pages | Living pets (pages) | Downloaded | Requests | Heap | Errors |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n';
  const detail = [];
  for (const addr of WALLETS) for (const page of PAGES) for (const br of (BRANCH ? [false, true] : [false])) {
    for (const r of await probe(browser, page, addr, br)) {
    log(page, addr.slice(0, 10), r.mode, 'shell', S(r.fcp), 'card', S(r.tCard), 'world', S(r.tWorld), 'drawn', S(r.tDraw), 'full', S(r.tFull), MB(r.total), r.n + ' req', r.errors.length + ' errors');
    const st = r.st || {};
    md += `| ${page}${BRANCH ? (br ? ' (branch)' : ' (live)') : ''}${WARM ? ' · ' + MODE[r.mode] : ''} | ${addr.slice(0, 8)}…${addr.slice(-4)} | ${S(r.fcp)} | ${S(r.tCard)} | ${S(r.tWorld)} | ${S(r.tDraw)} | ${r.tFull != null ? S(r.tFull) : 'not in ' + (MAX_WAIT / 1000) + ' s'} | ${st.n != null ? st.n + ' (' + st.got + '/' + st.pages + ')' : (st.mine != null ? st.mine : '–')} | ${MB(r.total)} | ${r.n} | ${st.heap != null ? st.heap + ' MB' : '–'} | ${r.errors.length ? r.errors.slice(0, 2).join(' / ').replace(/\|/g, '/') : ''} |\n`;
    detail.push(r);
    }
  }
  md += '\n## Freezes and blank pictures\n\nLong task = the page could not react for that long. Chrome shows \'Page Unresponsive\' when one runs for many seconds.\n\n| Page | Wallet | Long tasks (load) | Blocked total | Longest | Over 1 s | Blank pictures on screen at end | Scroll: long tasks / longest | Scroll: blank after 0.25 s / 1 s (of shown) |\n|---|---|---|---|---|---|---|---|---|\n';
  for (const r of detail) { const sc = r.scroll, L = ltSum(r.lt, 0, sc ? sc.t0 : null), Ls = sc ? ltSum(r.lt, sc.t0, sc.t1) : null, s1 = v => (v / 1000).toFixed(1) + ' s';
    md += `| ${r.page}${r.branch ? ' (branch)' : ''}${WARM ? ' · ' + MODE[r.mode] : ''} | ${r.addr.slice(0, 8)}… | ${L.n} | ${s1(L.total)} | ${s1(L.max)} | ${L.over1s} | ${r.blank ? r.blank.blank + ' of ' + r.blank.onScreen + ' (' + r.blank.cards + ' cards)' : '–'} | ${Ls ? Ls.n + ' / ' + s1(Ls.max) : '–'} | ${sc ? sc.blank250 + ' / ' + sc.blank1s + ' (of ' + sc.shown + ')' : '–'} |\n`; }
  if (PROFILE) { md += '\n## Where the main thread went (CPU profile, self time)\n\n';
    for (const r of detail) if (r.top) md += `**${r.page}${r.branch ? ' (branch)' : ''}${WARM ? ' · ' + MODE[r.mode] : ''} · ${r.addr.slice(0, 8)}…** files: ` + r.top.files.map(([k, v]) => k + ' ' + v + ' ms').join(' · ') + '\n\n' + r.top.fns.map(([k, v]) => '- ' + v + ' ms ' + k.replace(/\|/g, '/')).join('\n') + '\n\n' +
      (r.top.tasks && r.top.tasks.length ? 'Longest tasks:\n' + r.top.tasks.map(x => `- ${x.ms} ms at ${(x.at / 1000).toFixed(1)} s: inside ${x.self} | started by ${x.from}`).join('\n') + '\n\n' : ''); }
  if (VERIFY) { md += '\n## Background chain check (burns wait for this)\n\nWorker step times are cumulative seconds from the start.\n\n';
    for (const r of detail) { const v = r.verify; if (!v) continue;
      md += `**${r.page}${r.branch ? ' (branch)' : ''}${WARM ? ' · ' + MODE[r.mode] : ''} · ${r.addr.slice(0, 8)}…** ` + (v.skipped ? v.skipped : `${v.ok ? 'done' : 'NOT done'} in ${v.secs.toFixed(1)} s`) + '\n\n';
      if (v.t) md += '- worker: ' + Object.entries(v.t).filter(([k]) => k !== 't0').map(([k, x]) => k + ' ' + (/^(rows|nFiles|from|to|bytes)$/.test(k) ? x : (x / 1000).toFixed(1) + ' s')).join(' · ') + '\n';
      if (v.seen) md += '- bar: ' + v.seen.map(([s1, b]) => s1 + ' s "' + b.replace(/\|/g, '/') + '"').join(' → ') + '\n';
      if (v.err) md += '- error: ' + String(v.err).replace(/\|/g, '/') + '\n';
      if (v.line) md += '- status line after: ' + v.line.replace(/\|/g, '/') + '\n';
      md += '\n'; } }
  md += '\n## Where the bytes go\n\n';
  for (const r of detail) {
    md += `**${r.page}${r.branch ? ' (branch)' : ''}${WARM ? ' · ' + MODE[r.mode] : ''} · ${r.addr.slice(0, 8)}…** ` + Object.entries(r.by).sort((a, b) => b[1].b - a[1].b).map(([k, v]) => `${k} ${MB(v.b)} (${v.n})`).join(' · ') + '\n\nBiggest: ' + r.big.map(b => b.u.replace(/\?.*/, '').split('/').slice(-2).join('/') + ' ' + MB(b.b)).join(' · ') + '\n\n';
  }
  fs.writeFileSync('loadprobe.md', md);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
  console.log(md);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
