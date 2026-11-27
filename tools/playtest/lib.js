/* Shared pieces of the play-test robot (tools/playtest/run.js): the pretend wallet, the browser setup and the checks every step runs.
 * Nothing here signs anything: the pretend XCP Wallet answers "connect" with the test address and records every burn the page asks
 * it to sign, then answers as if it was broadcast (a made-up txid). The burns go to the local rig's pretend chain only. */
'use strict';
const fs = require('fs'), path = require('path');
const AUDIT = (() => { try { return fs.readFileSync(path.join(__dirname, '../layout-check/audit.js'), 'utf8'); } catch (e) { return null; } })();

function chromium() { for (const p of [process.env.PW, 'playwright', 'playwright-core']) { if (!p) continue; try { return require(p).chromium; } catch (e) {} } throw new Error('playwright not found'); }

/* Runs in every page before its own scripts. */
const INIT = (o) => {
  try {
    localStorage.setItem('xcpets-v2-me', o.me); localStorage.setItem('xcpets-xcpwallet-address', o.me);
    ['xcpets-tut-done', 'xcpets-tut-seen', 'xcpets-tut-coach-skip'].forEach(k => localStorage.setItem(k, '1'));
    if (o.sync) localStorage.setItem('xcpets-sync', o.sync);
    Object.keys(o.ls || {}).forEach(k => localStorage.setItem(k, o.ls[k]));
  } catch (e) {}
  window.__pt = { long: [], burns: [], errors: [], toasts: [] }; try { Error.stackTraceLimit = 40; } catch (e) {}
  try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__pt.long.push({ ms: Math.round(e.duration), at: Math.round(e.startTime) }))).observe({ entryTypes: ['longtask'] }); } catch (e) {}
  /* the pretend XCP Wallet: connect works, signing is recorded and never reaches a real wallet */
  const fake = { isPlaytest: true, request: (q) => {
    const m = q && q.method || q;
    if (m === 'xcp_requestAccounts' || m === 'xcp_accounts') return Promise.resolve({ accounts: [o.me], address: o.me });
    if (m === 'xcp_getNetwork') return Promise.resolve('mainnet');
    return Promise.reject(Object.assign(new Error('playtest wallet: not a real wallet'), { code: 4001 }));
  } };
  if (o.wallet) { try { Object.defineProperty(window, 'xcpwallet', { value: fake, configurable: true }); } catch (e) {} }
  /* V2Wallet.send / sendDex: record the burn and answer like a broadcast. Hooked the moment the page creates V2Wallet. */
  let W;
  const hook = (w) => {
    if (!w || w.__pt || !o.wallet) return w;
    w.__pt = true;
    let n = 0;
    const tx = () => (Date.now().toString(16) + (++n).toString(16) + '0'.repeat(64)).slice(0, 64);
    w.send = function (plan) { const t = tx(); window.__pt.burns.push({ tag: plan.tag, amount: plan.amount, label: plan.label || '', txid: t, at: Date.now() }); return new Promise(r => setTimeout(() => r({ txid: t }), 30)); };
    w.sendDex = function (plan) { const t = tx(); window.__pt.burns.push({ dex: true, kind: plan.kind, plan: JSON.parse(JSON.stringify(plan)), txid: t, at: Date.now() }); return Promise.resolve({ txid: t }); };
    w.current = function () { return o.me; };
    w.connect = function () { return Promise.resolve(o.me); };
    return w;
  };
  try { Object.defineProperty(window, 'V2Wallet', { configurable: true, get: () => W, set: (v) => { W = hook(v); } }); } catch (e) {}
};

const SIZES = { phone: { width: 390, height: 844, mobile: true }, desktop: { width: 1366, height: 900 } };

async function newContext(browser, size, o) {
  const S = SIZES[size];
  const cx = await browser.newContext({ viewport: { width: S.width, height: S.height }, deviceScaleFactor: 1, isMobile: !!S.mobile, hasTouch: !!S.mobile });
  await cx.addInitScript(INIT, o);
  /* PLAYTEST_CPU=4 slows every page's CPU 4x (Chrome's own throttle), to play like a busy CI runner or a cheap phone */
  if (Number(process.env.PLAYTEST_CPU) > 1) cx.on('page', p => { cx.newCDPSession(p).then(s => s.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.PLAYTEST_CPU) })).catch(() => {}); });
  const origins = [o.base, o.sync].filter(Boolean).map(u => new URL(u).origin);
  await cx.route('**/*', r => { const u = r.request().url(); if (u.startsWith('data:') || u.startsWith('blob:') || origins.some(x => u.startsWith(x))) return r.continue(); return r.abort(); });
  return cx;
}

/* the page answers within ms, else it is frozen */
async function responsive(pg, ms) { const t0 = Date.now(); try { await Promise.race([pg.evaluate(() => 1), new Promise((_, j) => setTimeout(() => j(new Error('t')), ms || 8000))]); return Date.now() - t0; } catch (e) { return -1; } }
async function worldReady(pg, ms) {
  try { await pg.waitForFunction(() => { try { const w = V2Mock.world(); return w && w.pets && w.pets.length > 20; } catch (e) { return false; } }, null, { timeout: ms || 240000, polling: 1000 }); return true; } catch (e) { return false; }
}
async function audit(pg) { if (!AUDIT) return []; try { return await pg.evaluate(AUDIT); } catch (e) { return []; } }
async function longSince(pg, t) { return pg.evaluate((t) => (window.__pt.long || []).filter(x => x.at >= t), t).catch(() => []); }
async function now(pg) { return pg.evaluate(() => performance.now()).catch(() => 0); }
async function burns(pg) { return pg.evaluate(() => window.__pt.burns.slice()).catch(() => []); }
async function clearBurns(pg) { return pg.evaluate(() => { window.__pt.burns.length = 0; }).catch(() => {}); }
async function post(sync, route, body) {
  const u = new URL(route, sync), http = require('http');
  return new Promise((res, rej) => { const q = http.request(u, { method: 'POST', headers: { 'content-type': 'application/json' } }, r => { let s = ''; r.on('data', d => { s += d; }); r.on('end', () => { try { res(JSON.parse(s)); } catch (e) { res({}); } }); }); q.on('error', rej); q.end(JSON.stringify(body || {})); });
}
module.exports = { chromium, INIT, SIZES, newContext, responsive, worldReady, audit, longSince, now, burns, clearBurns, post };
