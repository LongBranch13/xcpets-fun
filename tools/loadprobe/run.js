#!/usr/bin/env node
/* Load probe (Nov 22 2026): how fast does each page open for real wallets on the LIVE site, and what does it download?
 * View-only (localStorage 'xcpets-v2-me'; no wallet, nothing signed). For each page × wallet it records:
 *   - first pets: seconds until the page's world holds this wallet's pets, and until a pet picture is drawn
 *   - full: seconds until every owner page arrived (or 'partial' at the cap)
 *   - bytes and requests, split by file kind, and the 8 biggest files
 * Optional phone network (--slow): about 9 Mbit/s down, 150 ms latency, 4x slower CPU.
 *   node tools/loadprobe/run.js [--site https://xcpets.fun] [--wallets a,b] [--pages play.html,cemetery.html] [--slow] [--max-wait 180]
 * Writes loadprobe.md (also to the GitHub step summary when GITHUB_STEP_SUMMARY is set). Read-only. */
'use strict';
const fs = require('fs');
const A = process.argv.slice(2), opt = (k, d) => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : d; };
const SITE = opt('--site', 'https://xcpets.fun').replace(/\/$/, ''), MAX_WAIT = +opt('--max-wait', 180) * 1000, SLOW = A.includes('--slow');
const WALLETS = (opt('--wallets', '') || [
  'bc1pfvkpmllr7mtn5uazqxumwp39h2ny3c8l6fmrgvjv2cqn5wlpt7hssf3gqd', /* Evan */
  'bc1ps9av86ymmlzy9zj3a8pn6g94pz4j5e0kagv3td3wutaagfjvekjs26m3s4', /* owner */
  '1JwWsArppwALMEdXWPmpDBcP1jwWsAPYkD' ].join(',')).split(',').map(s => s.trim()).filter(s => s.length > 20);
const PAGES = opt('--pages', 'index.html,play.html,breed.html,cemetery.html,raid.html,live.html').split(',');
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
function kind(u) { if (/\/view\/own\/[^/]*\.d[.0-9]*json/.test(u)) return 'graves'; if (/\/view\/own\//.test(u)) return 'own pages'; if (/\/view\/p\//.test(u)) return 'pet shards';
  if (/\/view\//.test(u)) return 'view: ' + u.split('/view/')[1].split('?')[0]; if (/latest\.json|\/world\//.test(u)) return 'world'; if (/\/api\//.test(u)) return 'feed: ' + u.split('/api/')[1].split('?')[0];
  if (/\.js(\?|$)/.test(u)) return 'scripts'; if (/\.(png|gif|webp|jpg|svg)(\?|$)/.test(u)) return 'images'; if (/\.(woff2?|ttf)(\?|$)/.test(u)) return 'fonts'; if (/node\.xcpets|counterparty|\/v2\//.test(u)) return 'chain reads'; return 'other'; }
async function probe(browser, page, addr) {
  const cx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await cx.addInitScript(a => { try { localStorage.setItem('xcpets-v2-me', a); localStorage.setItem('xcpets-coach-seen', '1'); } catch (e) {} }, addr);
  const pg = await cx.newPage(), reqs = [], errors = [];
  if (SLOW) { const s = await cx.newCDPSession(pg); await s.send('Network.enable'); await s.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 9e6 / 8, uploadThroughput: 2e6 / 8 }); await s.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
  pg.on('pageerror', e => errors.push(String(e.message || e).slice(0, 160)));
  pg.on('requestfinished', async r => { try { const z = await r.sizes(); reqs.push({ u: r.url(), b: z.responseBodySize + z.responseHeadersSize }); } catch (e) {} });
  const t0 = Date.now(); let tWorld = null, tDraw = null, tFull = null, st = null;
  try {
    await pg.goto(SITE + '/' + page + '?probe=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 });
    while (Date.now() - t0 < MAX_WAIT) {
      await pg.waitForTimeout(500);
      st = await pg.evaluate(me => { try { const w = window.V2Mock && V2Mock.world && V2Mock.world(); const drawn = document.querySelectorAll('canvas[data-id]').length;
        if (!w || !w.pets) return { ready: false, drawn }; const pgs = w._pages, mine = w.pets.filter(p => p.owner === me).length;
        return { ready: true, mine, pets: w.pets.length, drawn, full: !!w._full || !pgs || (pgs.got || 1) >= (pgs.pages || 1), n: pgs ? pgs.n : null, got: pgs ? pgs.got : null, pages: pgs ? pgs.pages : null,
          heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null }; } catch (e) { return { ready: false, err: String(e) }; } }, addr);
      const s = (Date.now() - t0) / 1000;
      if (st.ready && st.mine > 0 && tWorld == null) tWorld = s;
      if (st.drawn > 0 && tDraw == null) tDraw = s;
      if (st.ready && st.full && tFull == null) { tFull = s; await pg.waitForTimeout(3000); break; }
    }
  } catch (e) { errors.push('goto: ' + String(e.message || e).slice(0, 160)); }
  await pg.waitForTimeout(1000);
  await cx.close();
  const by = {}; let total = 0; reqs.forEach(r => { const k = kind(r.u); by[k] = by[k] || { n: 0, b: 0 }; by[k].n++; by[k].b += r.b; total += r.b; });
  return { page, addr, tWorld, tDraw, tFull, st, errors, total, n: reqs.length, by, big: reqs.sort((a, b) => b.b - a.b).slice(0, 8), secs: (Date.now() - t0) / 1000 };
}
const MB = b => (b / 1e6).toFixed(2) + ' MB', S = s => s == null ? '–' : s.toFixed(1) + ' s';
(async () => {
  const { chromium } = require('playwright-core');
  const browser = await chromium.launch({ executablePath: process.env.CHROME || (fs.existsSync('/opt/google/chrome/chrome') ? '/opt/google/chrome/chrome' : undefined), args: ['--no-sandbox', '--enable-precise-memory-info'] });
  let md = '# Load probe\n\n' + SITE + (SLOW ? ' · phone network + 4x slower CPU' : ' · fast network') + ' · ' + new Date().toISOString() + '\n\n| Page | Wallet | Own pets in world | Pet drawn | All pages | Living pets (pages) | Downloaded | Requests | Heap | Errors |\n|---|---|---|---|---|---|---|---|---|---|\n';
  const detail = [];
  for (const addr of WALLETS) for (const page of PAGES) {
    const r = await probe(browser, page, addr);
    log(page, addr.slice(0, 10), 'world', S(r.tWorld), 'drawn', S(r.tDraw), 'full', S(r.tFull), MB(r.total), r.n + ' req', r.errors.length + ' errors');
    const st = r.st || {};
    md += `| ${page} | ${addr.slice(0, 8)}…${addr.slice(-4)} | ${S(r.tWorld)} | ${S(r.tDraw)} | ${r.tFull != null ? S(r.tFull) : 'not in ' + (MAX_WAIT / 1000) + ' s'} | ${st.n != null ? st.n + ' (' + st.got + '/' + st.pages + ')' : (st.mine != null ? st.mine : '–')} | ${MB(r.total)} | ${r.n} | ${st.heap != null ? st.heap + ' MB' : '–'} | ${r.errors.length ? r.errors.slice(0, 2).join(' / ').replace(/\|/g, '/') : ''} |\n`;
    detail.push(r);
  }
  md += '\n## Where the bytes go\n\n';
  for (const r of detail) {
    md += `**${r.page} · ${r.addr.slice(0, 8)}…** ` + Object.entries(r.by).sort((a, b) => b[1].b - a[1].b).map(([k, v]) => `${k} ${MB(v.b)} (${v.n})`).join(' · ') + '\n\nBiggest: ' + r.big.map(b => b.u.replace(/\?.*/, '').split('/').slice(-2).join('/') + ' ' + MB(b.b)).join(' · ') + '\n\n';
  }
  fs.writeFileSync('loadprobe.md', md);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
  console.log(md);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
