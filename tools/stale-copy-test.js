#!/usr/bin/env node
/* stale-copy-fix (2026-10-26): which copy a page shows first, the feed fallback after ANY failed Core read, and the 'blocks behind' text.
 *   node tools/stale-copy-test.js            (pure + source checks, no network)
 *   STALE_E2E=1 node tools/stale-copy-test.js (also headless Chrome on a local server, port 8873: normal / 429 / blocked, stale saved copy) */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), src = fs.readFileSync(path.join(ROOT, 'js/v2-chain.js'), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
/* pickCopy, lifted out of js/v2-chain.js as written */
const body = src.match(/function pickCopy\(last, feed, now\) \{[\s\S]*?return null; \}/)[0];
const pickCopy = new Function('LAST_FRESH', body + '; return pickCopy;')(30 * 60e3);
const now = Date.parse('2026-10-26T23:20:00Z'), min = 60e3;
ok(pickCopy({ tip: 973246, at: now - 9 * 60 * min }, { tip: 973306 }, now) === 'feed', 'player case: 9 h old saved copy at 973,246 vs feed 973,306 -> feed');
ok(pickCopy({ tip: 973310, at: now - 9 * 60 * min }, { tip: 973306 }, now) === 'feed', 'saved copy older than 30 min loses even with a higher tip');
ok(pickCopy({ tip: 973306, at: now - 5 * min }, { tip: 973306 }, now) === 'last', 'normal: fresh saved copy, same tip -> saved copy (own verified read)');
ok(pickCopy({ tip: 973307, at: now - 5 * min }, { tip: 973306 }, now) === 'last', 'fresh saved copy with a higher tip -> saved copy');
ok(pickCopy({ tip: 973300, at: now - 5 * min }, { tip: 973306 }, now) === 'feed', 'fresh saved copy but the feed is newer -> feed (higher tip wins)');
ok(pickCopy({ tip: 973246, at: now - 9 * 60 * min }, null, now) === 'last', 'boot.json failed to load -> an older saved copy is still used');
ok(pickCopy(null, { tip: 973306 }, now) === 'feed', 'first visit -> feed');
ok(pickCopy(null, null, now) === null, 'nothing -> full chain read');
/* source checks: any failed read falls back to the feed; burns still wait for a Core read */
const rv = src.slice(src.indexOf('function revalidate('), src.indexOf('function whenFresh('));
ok(/S\.feed = true; feedPoll\(feedCb\);\s*if \(n < RETRY_MS\.length\)/.test(rv), '429 / 5xx path: feed check after every failed read, Core retries kept');
ok(/if \(blocked\(\)\) \{ toFeed\(\); feedPoll\(feedCb\); return; \}/.test(rv), 'blocked path: feed at once, no timer retries');
ok(/function applyStale[\s\S]*?S\.verified = false; S\.stale = true;/.test(src), 'a feed / saved copy never counts as verified (burns wait)');
const mine = ['function fetchStatic', 'function pickCopy', 'function fromBest', 'function refTip', 'function behindTxt', 'function feedCb'].map(k => src.slice(src.indexOf(k), src.indexOf('\n', src.indexOf(k)) + 400)).join('\n'); ok(!/api\.xcp\.fun/.test(mine), 'no api.xcp.fun in the new code');
const cfg = fs.readFileSync(path.join(ROOT, 'rjs/config.js'), 'utf8'); ok(/COUNTERPARTY_CORE = 'https:\/\/api\.counterparty\.io:4000\/v2', CORE_BACKUP = 'https:\/\/api\.unspendablelabs\.com:4000\/v2'/.test(cfg), 'Core order: counterparty.io:4000 then unspendablelabs.com:4000');
/* banner + #crNote text */
const L = require('../js/v2-datalag.js');
ok(L.behind({ dataTip: 973246, chainTip: 973308 }) === 62 && L.behind({ dataTip: 973246, feedTip: 973306 }) === 60 && L.behind({ dataTip: 973308, chainTip: 973308 }) === 0, 'behind = newest known tip - shown tip');
ok(L.note(1753, { dataTip: 973246, chainTip: 973308 }) === 'Replayed from 1,753 XCPETS burns on chain at block 973,246 (62 blocks behind the tip, catching up).', '#crNote shows blocks behind');
ok(L.note(1820, { dataTip: 973308, chainTip: 973308 }) === 'Replayed from 1,820 XCPETS burns on chain at block 973,308.', '#crNote unchanged when current');
ok(L.behindText({ dataTip: 973307, chainTip: 973308 }) === 'Showing block 973,307, 1 block behind the tip.', 'banner text, singular');
const newTxt = [L.note(5, { dataTip: 1, chainTip: 9 }), L.behindText({ dataTip: 1, chainTip: 9 })].join(' ') + (mine.match(/'[^']*'/g) || []).join(' ');
ok(!/\b(price|series|discount)\b/i.test(newTxt) && !/\d\s?x\b/.test(newTxt), "player text: no price/series/discount, no 'x' for times");
async function e2e() {
  const { chromium, devices } = require(process.env.PW || '/workspace/pw/node_modules/playwright-core'); const cp = require('child_process');
  const srv = cp.spawn('python3', ['-m', 'http.server', '8873', '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' }); await new Promise(r => setTimeout(r, 800));
  const boot = JSON.parse(fs.readFileSync(path.join(ROOT, 'api/boot.json'))), old = JSON.parse(fs.readFileSync(process.env.OLD_BOOT || '/workspace/pw/old-boot.json'));
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  try { for (const mode of ['normal', '429', 'blocked']) {
    const c = await b.newContext({ ...devices['iPhone 13'] });
    await c.addInitScript(([o]) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', 1); localStorage.setItem('xcpets-v2-last-1', JSON.stringify({ at: Date.now() - 9 * 3600e3, build: 'x', rows: o.rows, tip: o.tip, dex: o.dex })); localStorage.setItem('xcpets-v2-prod-hashes', JSON.stringify(o.hashes)); }, [old]);
    let xcpfun = 0; await c.route(/api\.xcp\.fun/, r => { xcpfun++; r.abort(); });
    await c.route(/:4000\//, r => mode === '429' ? r.fulfill({ status: 429, headers: { 'access-control-allow-origin': '*' }, body: '{}' }) : mode === 'blocked' ? r.abort('timedout') : r.continue());
    const p = await c.newPage(); await p.goto('http://127.0.0.1:8873/play.html', { waitUntil: 'load' }); await p.waitForTimeout(mode === 'normal' ? 40000 : 15000);
    const s = await p.evaluate(() => { const S = V2Mock.state(); return { tip: S.tip, verified: !!S.verified }; });
    ok(s.tip >= boot.tip, mode + ': stale saved copy (' + old.tip + ') replaced, shows ' + s.tip + ' >= feed ' + boot.tip);
    ok(mode === 'normal' ? true : !s.verified, mode + ': feed copy is not verified, burns wait');
    ok(xcpfun === 0 || mode === 'normal', mode + ': no api.xcp.fun Core calls'); await c.close(); }
  } finally { await b.close(); srv.kill(); } }
(process.env.STALE_E2E ? e2e() : Promise.resolve()).then(() => { console.log('stale-copy-test: ' + pass + ' pass, ' + fail + ' fail'); process.exit(fail ? 1 : 0); }, e => { console.log('FAIL e2e error', e.message); process.exit(1); });
