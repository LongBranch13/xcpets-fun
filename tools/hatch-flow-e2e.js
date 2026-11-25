#!/usr/bin/env node
'use strict';
/* Shock Box reveal, full flow at real scale in a real browser (Nov 25 2026, Jake: 3 Shock Boxes in one block, no pop-up, no pill,
 * Select all froze the page). Slow (~5 min, ~9 GB peak during the two replays), needs Playwright + Chromium. Fast checks: tools/hatch-unopened-test.js.
 *   node --max-old-space-size=9000 tools/hatch-flow-e2e.js [--keep DIR]
 * What it does, from api/boot.json:
 *   - takes the newest pet:hatchzap burn (its wallet = the player) and adds two copies in the same block: 3 boxes, 3,000 eggs, one block;
 *   - builds the published world at the block before (what the page paints) and the chain to the boxes' block (what the burn check replays),
 *     serves both with tools/sync-server/server.js and the repo as the site, view-only (nothing can be signed);
 *   - plays it: the check brings the 3 boxes in -> the reveal says 3 Shock Boxes -> Later -> pill -> reload -> the pill is back ->
 *     open it -> See all -> Select all shown -> Discard selected -> Done (pill gone) -> My Pets Select all -> Discard -> Undo ->
 *     Discard pile Restore all -> Last hatch reopens the review.
 * Fails on any page error, a missing step, or a step that blocks the page for more than 1.5 s. */
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process'), http = require('http'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const A = process.argv.slice(2), opt = k => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : null; };
const DIR = opt('--keep') || fs.mkdtempSync(path.join(os.tmpdir(), 'xcpets-hatchflow-'));
const STEP_MS = 1500;
function knownHashes() { const vm = require('vm'), c = { window: {} }; c.window.window = c.window; c.self = c.window; vm.createContext(c); vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/block-hashes.js'), 'utf8'), c); return c.window.XCPETS_BLOCK_HASHES || c.XCPETS_BLOCK_HASHES || {}; }
function inputs() {
  const boot = JSON.parse(fs.readFileSync(path.join(ROOT, 'api/boot.json'), 'utf8'));
  const hz = boot.rows.filter(r => r.status === 'valid' && Buffer.from(r.tag || '', 'hex').toString() === 'pet:hatchzap').sort((a, b) => b.block_index - a.block_index || b.tx_index - a.tx_index)[0];
  if (!hz) throw new Error('no pet:hatchzap burn in api/boot.json');
  const rows = boot.rows.slice();
  [1, 2].forEach(k => { const c = Object.assign({}, hz); c.tx_index = hz.tx_index + k / 10; c.tx_hash = crypto.createHash('sha256').update('hatch-flow-e2e-box-' + k + hz.tx_hash).digest('hex'); rows.push(c); });
  return { boot, rows, hashes: Object.assign({}, knownHashes(), boot.hashes), owner: hz.source, block: hz.block_index };
}
/* child: build one world */
if (A[0] === '--build') {
  const out = A[1], tip = +A[2], I = inputs(), snap = require('./sync-server/snapshot'), ans = require('./sync-server/answer');
  const rows = I.rows.filter(r => r.block_index <= tip), state = { rows, hashes: I.hashes, tip, dex: I.boot.dex, dexTip: I.boot.dexTip, dexHash: I.boot.dexHash, dexAssets: I.boot.dexAssets };
  fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, 'state.json'), JSON.stringify(state));
  const view = ans.pageInputs(state), rsig = snap.rulesSig(snap.loadBytes(ROOT)), wd = path.join(out, 'world', rsig, String(tip));
  snap.buildSnapshot({ rows: view.rows, hashes: view.hashes, tip, dex: view.dex, outDir: wd, inSigOf: o => snap.chainInSig(o.rows, o.hashes, o.tip, o.dex) }).then(() => {
    const latest = JSON.stringify({ v: 1, rsig, tip, manifest: '/xp/v1/world/' + rsig + '/' + tip + '/manifest.json', builtAt: new Date().toISOString() });
    fs.writeFileSync(path.join(out, 'world', rsig, 'latest.json'), latest); fs.writeFileSync(path.join(out, 'world', 'latest.json'), latest); process.exit(0);
  }, e => { console.error(e); process.exit(1); });
  return;
}
function build(out, tip) { return new Promise((res, rej) => { if (fs.existsSync(path.join(out, 'world', 'latest.json'))) return res();
  const p = cp.spawn(process.execPath, ['--max-old-space-size=9000', __filename, '--build', out, String(tip)], { stdio: 'inherit' }); p.on('exit', c => c ? rej(new Error('build ' + tip + ' failed')) : res()); }); }
(async () => {
  const I = inputs(); console.log('player', I.owner.slice(0, 10) + '…', '3 Shock Boxes in block', I.block, '· data in', DIR);
  const before = path.join(DIR, 'before'), after = path.join(DIR, 'after'), mix = path.join(DIR, 'mix'), cur = path.join(DIR, 'cur');
  console.log('building the two worlds (2-4 min)…'); await Promise.all([build(before, I.block - 1), build(after, I.block)]);
  fs.mkdirSync(mix, { recursive: true }); for (const [n, src] of [['world', path.join(before, 'world')], ['state.json', path.join(after, 'state.json')]]) { try { fs.unlinkSync(path.join(mix, n)); } catch (e) { } fs.symlinkSync(src, path.join(mix, n)); }
  const point = d => { try { fs.unlinkSync(cur); } catch (e) { } fs.symlinkSync(d, cur); load(); };
  let state = null; function load() { state = JSON.parse(fs.readFileSync(path.join(cur, 'state.json'), 'utf8')); const l = JSON.parse(fs.readFileSync(path.join(cur, 'world', 'latest.json'), 'utf8')); state.ready = true; state.world = { ready: true, rsig: l.rsig, tip: l.tip, manifest: l.manifest }; state.coreHeight = state.tip; state.lastBlockAt = new Date().toISOString(); }
  point(mix);
  const sync = require('./sync-server/server').createServer({ getState: () => state, dataDir: cur, ratePer10s: 1e6 }).server; await new Promise(r => sync.listen(0, '127.0.0.1', r));
  const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.webp': 'image/webp', '.woff2': 'font/woff2' };
  const web = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; const f = path.join(ROOT, path.normalize(p)); if (!f.startsWith(ROOT)) { r.writeHead(403); return r.end(); }
    fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); r.end(b); }); });
  await new Promise(r => web.listen(0, '127.0.0.1', r));
  const SYNC = 'http://127.0.0.1:' + sync.address().port, SITE = 'http://127.0.0.1:' + web.address().port;
  const { chromium } = require('playwright'), b = await chromium.launch(), ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } }), pg = await ctx.newPage();
  const errs = [], fails = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept());
  await ctx.addInitScript(([s, o]) => { localStorage.setItem('xcpets-sync', s); localStorage.setItem('xcpets-v2-me', o); }, [SYNC, I.owner]);
  const lag = () => pg.evaluate(() => new Promise(r => { const t = performance.now(); requestAnimationFrame(() => setTimeout(() => r(Math.round(performance.now() - t)), 0)); }));
  const check = (c, msg) => { if (!c) { fails.push(msg); console.log('  FAIL', msg); } else console.log('  ok  ', msg); };
  const step = async (label, fn) => { const t = Date.now(); await fn(); const l = await lag(), ms = Date.now() - t; check(ms < STEP_MS && l < 500, label + ' (' + ms + ' ms, then ' + l + ' ms busy)'); };
  const shut = () => pg.evaluate(() => document.querySelectorAll('.returnov .retclose').forEach(x => x.click()));
  const pill = () => pg.evaluate(() => { const e = document.getElementById('hatchTray'); return e ? e.textContent : ''; });
  const on = () => pg.evaluate(() => document.getElementById('packBox').classList.contains('on'));
  try {
    await pg.goto(SITE + '/play.html'); await pg.waitForTimeout(12000); await shut(); await pg.waitForTimeout(1500);
    await pg.evaluate(() => V2Split.startVerify(true));
    await pg.waitForFunction(() => document.getElementById('packBox').classList.contains('on'), null, { timeout: 120000 }).catch(() => {});
    check(await on(), 'the burns-are-open check brings the 3 boxes in and the reveal opens');
    check(/3 Shock Boxes opened/.test(await pg.textContent('#packTitle')), 'the reveal says 3 Shock Boxes');
    check(/3,000 new pets/.test(await pg.textContent('.pkisub').catch(() => '')), 'it counts 3,000 new pets');
    await pg.waitForTimeout(2000); await step('Later', () => pg.click('#pkiLater')); await pg.waitForTimeout(600);
    check(/3,000 new pets hatched/.test(await pill()), 'Later puts all 3,000 in the pill');
    point(after); await pg.reload(); await pg.waitForTimeout(14000); await shut();
    await pg.waitForFunction(() => !!document.getElementById('hatchTray'), null, { timeout: 60000 }).catch(() => {});
    check(/3,000 new pets hatched/.test(await pill()), 'after a reload the pill is back (a missed pop-up is never lost)');
    check(/Last hatch \(3,000\)/.test(await pg.evaluate(() => { const a = document.getElementById('lhJump'); return a && !a.hidden ? a.textContent : ''; })), 'My Pets shows 🥚 Last hatch (3,000)');
    await step('open the pill', async () => { await pg.click('#hatchTray .htgo'); await pg.waitForFunction(() => document.getElementById('packBox').classList.contains('on')); });
    await pg.waitForTimeout(800); await step('See all & sort', () => pg.click('#pkiAll'));
    await step('Select all shown', () => pg.click('#pkSelAll'));
    const nSel = Number(((await pg.textContent('#packDiscard')).match(/\(([\d,]+)\)/) || [0, '0'])[1].replace(/,/g, '')); check(nSel > 2000, 'Select all shown picks ' + nSel + ' pets');
    await step('Discard selected', () => pg.click('#packDiscard')); await pg.waitForTimeout(300);
    await step('Done', () => pg.click('#packClose')); await pg.waitForTimeout(1500);
    check(!(await pill()), 'after Done the pill is gone');
    check(await pg.evaluate(() => !Object.keys(localStorage).some(k => k.indexOf('xcpets-v2-unopened-') === 0)), 'nothing is left unopened');
    await step('My Pets Select all', () => pg.evaluate(() => { const c = document.getElementById('selAll'); c.checked = true; c.dispatchEvent(new Event('change')); }));
    await step('My Pets Discard selected', () => pg.evaluate(() => document.getElementById('bDiscSel').click())); await pg.waitForTimeout(300);
    await step('Undo', () => pg.evaluate(() => { const u = Array.from(document.querySelectorAll('#toasts .undo')); if (!u.length) throw new Error('no Undo'); u.forEach(x => x.click()); }));
    await pg.waitForTimeout(800);
    await step('Discard pile → Restore all', async () => { await pg.evaluate(() => document.getElementById('dpJump').click()); await pg.waitForTimeout(500); await pg.evaluate(() => { const x = Array.from(document.querySelectorAll('button')).find(y => /^Restore all/.test(y.textContent.trim()) && y.offsetParent); if (x) x.click(); }); });
    await pg.waitForTimeout(800); check(await pg.evaluate(() => { const a = document.getElementById('dpJump'); return !a || a.hidden; }), 'the Discard pile is empty again');
    await pg.evaluate(() => document.querySelectorAll('.reveal.on').forEach(e => e.classList.remove('on')));
    await step('Last hatch reopens the review', async () => { await pg.evaluate(() => document.getElementById('lhJump').click()); await pg.waitForFunction(() => document.getElementById('packBox').classList.contains('on')); });
    check(/3 Shock Boxes opened/.test(await pg.textContent('#packTitle')), 'Last hatch shows the 3 boxes');
    if (opt('--shots')) await pg.screenshot({ path: path.join(opt('--shots'), 'last-hatch.png') });
  } catch (e) { fails.push('crashed: ' + e.message.split('\n')[0]); console.log('  FAIL crashed:', e.message.split('\n')[0]); }
  check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close(); sync.close(); web.close();
  if (!opt('--keep')) fs.rmSync(DIR, { recursive: true, force: true });
  console.log(fails.length ? fails.length + ' FAILED' : 'all good'); process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
