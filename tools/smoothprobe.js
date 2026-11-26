#!/usr/bin/env node
/* Smoothness probe (Nov 26 2026, Jake: "I want everything to be smooth like it was made by the best game devs").
 * Measures what a player feels, against the local play-test rig (tools/playtest/rig.js), view-only, nothing is signed:
 *   load:   first paint, whether the page's look (Doom theme, header) is already right at the first paint, layout shift (CLS),
 *           long tasks while loading, time until the first pet sprite is drawn.
 *   scroll: My Pets scrolled like a thumb/wheel for a few seconds: dropped frames (rAF gaps over 50 ms), worst frame, long tasks,
 *           pet pictures still blank on screen (sampled), DOM size, Mythic overlay count.
 *   node tools/smoothprobe.js [--base http://127.0.0.1:8080] [--sync http://127.0.0.1:8125] [--wallet keen|evan|<addr>]
 *                              [--size phone|desktop] [--cpu 4] [--pages index,play,...] [--scroll 12] [--shots DIR] [--json FILE]
 *   --warm opens each page once first (a returning player: cache, saved copies, remembered layout) and measures the second visit.
 * Prints one table. Run it on a branch and on main (two rigs / two --base) to compare. */
'use strict';
const path = require('path'), fs = require('fs');
const L = require('./playtest/lib');
const A = process.argv.slice(2), opt = (k, d) => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : d; };
const BASE = opt('--base', 'http://127.0.0.1:8080').replace(/\/+$/, ''), SYNC = opt('--sync', 'http://127.0.0.1:8125').replace(/\/+$/, '');
const WALLETS = { keen: 'bc1pd8pantl2vmvdf5uvtvvn0r3xnnuxvp0wln8xmlxqmykxfnte3mwqmes2ut', evan: 'bc1pfvkpmllr7mtn5uazqxumwp39h2ny3c8l6fmrgvjv2cqn5wlpt7hssf3gqd' };
const ME = WALLETS[opt('--wallet', 'keen')] || opt('--wallet');
const SIZE = opt('--size', 'desktop'), CPU = +opt('--cpu', 1), SCROLL_S = +opt('--scroll', 12), SHOTS = opt('--shots', null), JSON_OUT = opt('--json', null);
const PAGES = opt('--pages', 'index,play,pets,cemetery,shop,ranking,pet').split(',');

/* Runs before every page script: frame clock, layout shifts, long tasks, when the Doom class lands, first paint. */
const PROBE = () => {
  const P = window.__sp = { cls: 0, shifts: [], long: [], dwAt: null, hdAt: null, fcp: null, dwAtFcp: null, frames: [] };
  try { new PerformanceObserver(l => l.getEntries().forEach(e => { if (!e.hadRecentInput) { P.cls += e.value; P.shifts.push({ at: Math.round(e.startTime), v: +e.value.toFixed(4), src: (e.sources || []).slice(0, 3).map(s => s.node ? (s.node.id || s.node.className || s.node.nodeName) + '' : '?') }); } })).observe({ type: 'layout-shift', buffered: true }); } catch (e) {}
  try { new PerformanceObserver(l => l.getEntries().forEach(e => P.long.push({ at: Math.round(e.startTime), ms: Math.round(e.duration) }))).observe({ type: 'longtask', buffered: true }); } catch (e) {}
  try { new PerformanceObserver(l => l.getEntries().forEach(e => { if (e.name === 'first-contentful-paint') { P.fcp = Math.round(e.startTime); } })).observe({ type: 'paint', buffered: true }); } catch (e) {}
  const chk = () => { const root = document.documentElement; if (!root) return; const t = Math.round(performance.now()); if (P.dwAt == null && root.classList.contains('dw')) P.dwAt = t; if (P.hdAt == null && root.classList.contains('hd3')) P.hdAt = t; };
  chk(); new MutationObserver(chk).observe(document, { attributes: true, subtree: true, attributeFilter: ['class'] });
  /* what the very first painted frame looked like: checked on the first rAF (the frame the browser is about to paint) */
  requestAnimationFrame(() => { const root = document.documentElement; P.firstFrame = Math.round(performance.now()); P.dwAtFirstFrame = root.classList.contains('dw'); P.hdAtFirstFrame = root.classList.contains('hd3');
    const bg = document.body ? getComputedStyle(document.body).backgroundColor : ''; P.bgAtFirstFrame = bg; });
  P.startFrames = () => { P.frames = []; let last = performance.now(); P.rafOn = true; const f = (t) => { if (!P.rafOn) return; P.frames.push(t - last); last = t; requestAnimationFrame(f); }; requestAnimationFrame(f); };
  P.stopFrames = () => { P.rafOn = false; return P.frames.slice(); };
};

function pct(a, p) { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; }
const r1 = v => Math.round(v * 10) / 10;

async function main() {
  const browser = await L.chromium().launch();
  const cx = await L.newContext(browser, SIZE, { me: ME, sync: SYNC, base: BASE, wallet: false });
  await cx.addInitScript(PROBE);
  const rows = [];
  for (const name of PAGES) {
    const pg = await cx.newPage();
    const cdp = await cx.newCDPSession(pg); if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
    const url = BASE + '/' + (name === 'index' ? '' : name === 'pet' ? 'pet.html?id=' + (opt('--pet', '1765')) : name + '.html');
    if (A.includes('--warm')) { await pg.goto(url, { waitUntil: 'load', timeout: 120000 }).catch(() => {}); await pg.waitForTimeout(6000); await pg.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pagehide')); }).catch(() => {}); }
    const t0 = Date.now();
    await pg.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 }).catch(e => console.error(name, e.message));
    if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, name + '-early.png') }).catch(() => {}); }
    /* first pet sprite drawn (any canvas.sprite with frames) */
    let firstSprite = null;
    for (let i = 0; i < 240; i++) { const ok = await pg.evaluate(() => !!document.querySelector('canvas.sprite') && [...document.querySelectorAll('canvas.sprite')].some(c => c._fr)).catch(() => false); if (ok) { firstSprite = Date.now() - t0; break; } await pg.waitForTimeout(250); if (i > 24) break; }
    await pg.waitForTimeout(2500);
    if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, name + '-settled.png') }).catch(() => {});
    const load = await pg.evaluate(() => { const P = window.__sp; return { fcp: P.fcp, firstFrame: P.firstFrame, dwAt: P.dwAt, dwFirst: P.dwAtFirstFrame, hdAt: P.hdAt, hdFirst: P.hdAtFirstFrame, cls: +P.cls.toFixed(3), shifts: P.shifts.slice(0, 8), long: P.long.length, longMax: Math.max(0, ...P.long.map(x => x.ms)), longSum: P.long.reduce((s, x) => s + x.ms, 0), dw: document.documentElement.classList.contains('dw') }; }).catch(e => ({ err: e.message }));
    const row = { page: name, firstSprite, ...load };
    if (name === 'play' || name === 'pets') {
      /* scroll My Pets like a player: steady wheel, ~1,600 px/s, then back up fast */
      const pre = await pg.evaluate(() => { const P = window.__sp; P.long0 = P.long.length; P.startFrames(); return { cards: document.querySelectorAll('.pet.card').length }; });
      const blanks = []; const end = Date.now() + SCROLL_S * 1000; let k = 0;
      while (Date.now() < end) {
        await pg.mouse.wheel(0, (k++ % 40) < 32 ? 200 : -800).catch(() => {});
        if (k % 4 === 0) blanks.push(await pg.evaluate(() => { const H = innerHeight; let on = 0, blank = 0; document.querySelectorAll('.pet.card canvas.sprite').forEach(c => { const r = c.getBoundingClientRect(); if (r.bottom < 0 || r.top > H || !r.width) return; on++; if (!c._fr) blank++; }); return [on, blank]; }).catch(() => [0, 0]));
        await pg.waitForTimeout(120);
      }
      const sc = await pg.evaluate(() => { const P = window.__sp, f = P.stopFrames(), lg = P.long.slice(P.long0); return { f, long: lg.length, longMax: Math.max(0, ...lg.map(x => x.ms)), longSum: lg.reduce((s, x) => s + x.ms, 0), cards: document.querySelectorAll('.pet.card').length, dom: document.getElementsByTagName('*').length, mfx: document.querySelectorAll('.mfx').length, mfxNodes: document.querySelectorAll('.mfx *').length }; });
      const f = sc.f.filter(x => x > 0);
      const on = blanks.reduce((s, b) => s + b[0], 0), bl = blanks.reduce((s, b) => s + b[1], 0);
      Object.assign(row, { scroll: { fps: r1(1000 / (f.reduce((s, x) => s + x, 0) / Math.max(1, f.length))), p95: r1(pct(f, 0.95)), worst: r1(Math.max(0, ...f)), janky: f.filter(x => x > 50).length, frames: f.length, long: sc.long, longMax: sc.longMax, longSum: sc.longSum, blankPct: on ? r1(bl / on * 100) : 0, cards: pre.cards + '→' + sc.cards, dom: sc.dom, mfx: sc.mfx, mfxNodes: sc.mfxNodes } });
      if (SHOTS) await pg.screenshot({ path: path.join(SHOTS, name + '-scrolled.png') }).catch(() => {});
    }
    rows.push(row); console.log(JSON.stringify(row));
    await pg.close();
  }
  await browser.close();
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ base: BASE, wallet: ME, size: SIZE, cpu: CPU, rows }, null, 1));
}
main().catch(e => { console.error(e); process.exit(1); });
