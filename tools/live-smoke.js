#!/usr/bin/env node
/* live-smoke.js (safeguards-1102, owner 'Yes' Nov 2 2026 [pt2671u]): post-deploy smoke test of the LIVE site. A deploy is not DONE until this
 * passes; a FAIL means fix forward at once. Why: nav-cache-1102 (build 2deb6e7f13, ~12:27 AM CT Nov 2) shipped an undeclared `blocks` in
 * js/v2-chain.js load(): every chain read threw, S.verified never became true and every burn was refused for ~16 h, while the regex-only
 * suite and a "0 page errors" look passed. This runs the real pages in headless Chrome and checks what a player needs:
 *   1. home, My Pets (play.html), a pet page and the shop at 1280 and 390 wide: 0 page errors, build id = build-id.txt (= --build)
 *   2. the real chain read (V2Mock load()) verifies (state().verified) and the burn freshness gate V2Mock.whenFresh() answers ok
 *   3. with a STUBBED connected wallet (the pet's own owner address, read from the page), Tokenize step 2 reaches V2Wallet.send with
 *      exactly V2Rules.deedTag(id, token) = pet:deed:<id>:<b36>. Every V2Wallet send/sendDex/sign is replaced before the page runs and
 *      rejects: nothing is ever signed or sent (headless Chrome has no wallet extension either).
 * Chain reads go the way the site's own code goes (api.counterparty.io:4000, then api.unspendablelabs.com:4000; never api.xcp.fun); from
 * the box Chrome uses the xcpets-bot-1 SOCKS tunnel (127.0.0.1:18080, opened with ssh -D like tools/lib/xcp-api.js) because box egress blocks :4000.
 *   node tools/live-smoke.js [--build <id>] [--base https://xcpets.fun] [--ids 53884,69321] [--local] [--no-proxy] [--json]
 *   --local serves this checkout instead (preflight on a branch; chain reads still live). Exit 0 PASS, 1 FAIL, 2 setup error. */
'use strict';
const cp = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const A = process.argv.slice(2), arg = (k, d) => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : d; };
const LOCAL = A.includes('--local'), BASE = LOCAL ? 'http://localhost:' + (process.env.XCPETS_TEST_PORT || '8099') : arg('--base', 'https://xcpets.fun').replace(/\/$/, '');
const WANT = arg('--build', null), JSONOUT = A.includes('--json');
/* pets with a made-but-untied token whose owner still holds it (Nov 2 2026 scan); the first that shows "Tie it: step 2" is used */
const IDS = arg('--ids', process.env.SMOKE_IDS || '53884,69321,228,153,77,4104,19322,495,741,704,644,66094,57160,39034,64084').split(',').map(Number).filter(Boolean);
const PAGES = [['home', '/'], ['play', '/play.html'], ['pet', '/pet.html?id=' + IDS[0]], ['shop', '/shop.html']];
const results = []; let failed = 0;
const rec = (name, ok, info) => { results.push({ check: name, ok: !!ok, info }); if (!ok) failed++; if (!JSONOUT) console.log((ok ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + (typeof info === 'string' ? info : JSON.stringify(info)) : '')); };
function chromium() { for (const p of [process.env.PLAYWRIGHT_CORE, '/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core', 'playwright-core', 'playwright']) { if (!p) continue; try { return require(p).chromium; } catch (e) {} } throw new Error('playwright-core not found (set PLAYWRIGHT_CORE)'); }
const portOpen = hp => { const [h, p] = hp.split(':'); return cp.spawnSync('bash', ['-c', `exec 3<>/dev/tcp/${h}/${p}`], { timeout: 3000 }).status === 0; };
function proxy() {
  if (A.includes('--no-proxy') || os.hostname() === 'xcpets-bot-1') return null;
  const hp = process.env.XCP_SOCKS || '127.0.0.1:18080'; if (portOpen(hp)) return 'socks5://' + hp;
  const key = process.env.XCP_SSH_KEY || path.join(os.homedir(), '.ssh', 'xcpets_hetzner'); if (!fs.existsSync(key)) return null;
  cp.spawnSync('ssh', ['-i', key, '-o', 'BatchMode=yes', '-o', 'ExitOnForwardFailure=yes', '-o', 'ConnectTimeout=15', '-o', 'ServerAliveInterval=30', '-f', '-N', '-D', hp, process.env.XCP_SSH_HOST || 'xcadmin@2.31.126.156'], { timeout: 30000 });
  for (let i = 0; i < 20 && !portOpen(hp); i++) cp.spawnSync('sleep', ['0.25']);
  return portOpen(hp) ? 'socks5://' + hp : null;
}
/* runs before any page script: every wallet call is recorded, waits for the real freshness gate, then rejects (never signs) */
function stub(addr) {
  window.__smoke = { sent: [], gate: null };
  if (addr) { try { localStorage.setItem('xcpets-xcpwallet-address', addr); } catch (e) {} }
  const rec = k => (plan) => { window.__smoke.sent.push({ via: k, tag: plan && plan.tag, kind: plan && plan.kind, amount: plan && plan.amount, petId: plan && plan.petId });
    const M = window.V2Mock; return (M && M.whenFresh ? M.whenFresh() : Promise.resolve(null)).then(r => { window.__smoke.gate = r; return Promise.reject(new Error('SMOKE TEST: signing disabled, nothing sent')); }); };
  Object.defineProperty(window, 'V2Wallet', { configurable: true, get() { return this.__w; }, set(v) { this.__w = v; if (v) { v.send = rec('send'); v.sendDex = rec('sendDex'); v.sign = rec('sign'); if (v.signPsbt) v.signPsbt = rec('signPsbt'); if (addr) v.current = () => addr; } } });
}
async function open(b, w, url, addr) {
  const ctx = await b.newContext({ viewport: { width: w, height: w < 500 ? 844 : 900 }, isMobile: w < 500, hasTouch: w < 500 }), pg = await ctx.newPage(), errs = [];
  pg.on('pageerror', e => errs.push(String(e && e.message || e).slice(0, 240)));
  await pg.addInitScript(stub, addr || null);
  if (LOCAL) await require('./lib/serve-repo.js')(pg, {}, BASE);
  await pg.goto(BASE + url, { waitUntil: 'load', timeout: 90000 });
  return { ctx, pg, errs };
}
const chainState = pg => pg.evaluate(() => { const M = window.V2Mock; if (!M || !M.state) return null; const S = M.state(); return { verified: S.verified === true, tip: S.tip, rows: (S.rows || []).length, stale: !!S.stale }; });
async function chainCheck(pg, label) {
  const ok = await pg.waitForFunction(() => window.V2Mock && V2Mock.state && V2Mock.state().verified === true, null, { timeout: 120000, polling: 500 }).then(() => true, () => false);
  const st = await chainState(pg); rec(label + ': chain read verified (V2Mock load)', ok, st);
  const g = await pg.evaluate(() => Promise.race([V2Mock.whenFresh().then(x => x, e => ({ reject: String(e && e.message || e) })), new Promise(r => setTimeout(() => r({ timeout: '90s' }), 90000))])).catch(e => ({ error: e.message }));
  rec(label + ': burn freshness gate whenFresh ok', g && g.ok === true, g);
}
async function tieStep(b, w) {
  for (const id of IDS) {
    let o = await open(b, w, '/pet.html?id=' + id);
    const info = await o.pg.waitForFunction(i => { const M = window.V2Mock; const W = M && M.state && M.state().verified && M.world && M.world(); return W && W.byId && W.byId[i] ? { owner: W.byId[i].owner, tied: !!(window.V2Rules && V2Rules.deedOf && (V2Rules.deedOf(W, W.byId[i]) || {}).ok), dead: !!W.byId[i].dead } : null; }, id, { timeout: 120000, polling: 1000 }).then(h => h.jsonValue(), () => null);
    await o.ctx.close(); if (!info || !info.owner || info.tied || info.dead) continue;
    o = await open(b, w, '/pet.html?id=' + id + '&addr=' + info.owner, info.owner);
    const btn = await o.pg.waitForFunction(() => { const x = document.querySelector('#pcTokTie'); return x && !x.disabled ? 'on' : (document.querySelector('#pcTokMint') ? 'mint' : null); }, null, { timeout: 90000, polling: 1000 }).then(h => h.jsonValue(), () => null);
    if (btn !== 'on') { await o.ctx.close(); continue; }
    const want = await o.pg.evaluate(i => { const T = window.V2Sales && V2Sales.tok, pd = T && T.pend(i); return pd && pd.asset ? { asset: pd.asset, tag: V2Rules.deedTag(i, pd.asset) } : null; }, id);
    await o.pg.click('#pcTokTie');
    const sent = await o.pg.waitForFunction(() => window.__smoke && window.__smoke.gate && window.__smoke.sent.length ? window.__smoke : null, null, { timeout: 120000, polling: 500 }).then(h => h.jsonValue(), () => o.pg.evaluate(() => window.__smoke));
    const msg = await o.pg.evaluate(() => (document.getElementById('pcTokMsg') || {}).textContent || '');
    const s = sent && sent.sent && sent.sent[0], tagOk = !!(s && want && s.via === 'send' && s.tag === want.tag && new RegExp('^pet:deed:' + id + ':[0-9a-z]+$').test(s.tag));
    rec('w' + w + ': tokenize step 2 reaches V2Wallet.send with the pet:deed tag (#' + id + ', stubbed wallet, nothing signed)', tagOk && sent.gate && sent.gate.ok === true, { sent: s, want: want && want.tag, gate: sent && sent.gate, msg: msg.slice(0, 120) });
    rec('w' + w + ': tokenize page has 0 page errors', !o.errs.length, o.errs.slice(0, 2).join(' | ')); await o.ctx.close(); return;
  }
  rec('w' + w + ': tokenize step 2 (no candidate pet showed "Tie it: step 2"; pass --ids with a pet that has a made, untied token)', false, { tried: IDS });
}
(async () => {
  const t0 = Date.now(), px = proxy(); if (!JSONOUT) console.log('live-smoke ' + BASE + (px ? ' via ' + px : ' direct') + (WANT ? ' want build ' + WANT : ''));
  if (!LOCAL) { const r = cp.spawnSync('curl', ['-sS', '-m', '20', BASE + '/build-id.txt?_=' + t0], { encoding: 'utf8' }); const live = (r.stdout || '').trim();
    rec('build-id.txt' + (WANT ? ' = ' + WANT : ''), /^[0-9a-f]{10}$/.test(live) && (!WANT || live === WANT), live || r.stderr); }
  const b = await chromium().launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'], proxy: px ? { server: px } : undefined });
  try {
    for (const w of [1280, 390]) {
      for (const [name, url] of PAGES) {
        const o = await open(b, w, url); const label = 'w' + w + ' ' + name;
        if (name !== 'home') await chainCheck(o.pg, label); else await o.pg.waitForTimeout(6000);
        const v = await o.pg.evaluate(() => [...document.querySelectorAll('script[src*="?v="]')].map(s => (/[?&]v=([0-9a-f]+)/.exec(s.src) || [])[1]).filter((x, i, a) => a.indexOf(x) === i));
        if (WANT) rec(label + ': every ?v= = ' + WANT, v.length === 1 && v[0] === WANT, v.join(','));
        const rep = await o.pg.evaluate(() => !!document.head.innerHTML.match(/<!--err-report-1102-->/));
        rec(label + ': page-error reporter present', rep);
        await o.pg.waitForTimeout(1500); rec(label + ': 0 page errors', !o.errs.length, o.errs.slice(0, 2).join(' | ')); await o.ctx.close();
      }
      await tieStep(b, w);
    }
  } finally { await b.close(); }
  const out = { status: failed ? 'FAIL' : 'PASS', base: BASE, build: WANT, failed, checks: results.length, elapsed_s: Math.round((Date.now() - t0) / 1000), results };
  if (JSONOUT) console.log(JSON.stringify(out)); else console.log('live-smoke: ' + out.status + ' (' + (results.length - failed) + '/' + results.length + ' checks, ' + out.elapsed_s + ' s)');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.log('live-smoke: SETUP ERROR ' + (e && e.stack || e)); process.exit(2); });
