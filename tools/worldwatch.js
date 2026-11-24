#!/usr/bin/env node
/* World watch (Nov 22 2026). Is the live site loading fast for players right now?
 * Reads only public URLs: the rule files the live site serves, node.xcpets.fun's health and latest.json, the feed's meta.json.
 *   node tools/worldwatch.js                  one check; exit 1 when players would get the slow load (or the world is far behind)
 *   node tools/worldwatch.js --wait 10        keep checking every minute for up to 10 minutes until it is fine (after a deploy)
 *   node tools/worldwatch.js --rsig-of-checkout   print the rules signature of this checkout and exit
 *   node tools/worldwatch.js --wait-for-rsig <rsig> --wait 35
 *                                             used by the pages deploy: when this push changes the rules the live site runs,
 *                                             wait until the server has a world for the new rules. Exits 0 to deploy, 2 to hold
 *                                             the deploy (still no world at the cap: the site stays on the old rules and their
 *                                             world, and worldwatch re-runs the deploy once the new world exists).
 *                                             A server that does not answer is waited for, not skipped (Nov 22 2026: the
 *                                             Seasons rules went live with no world while the server was out of memory).
 * Writes a short report to $GITHUB_STEP_SUMMARY and, with --json <file>, the findings as JSON. Nothing about the server is printed
 * beyond what its public health answer shows. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const SITE = process.env.WW_SITE || 'https://xcpets.fun', NODE = process.env.WW_NODE || 'https://node.xcpets.fun';
const RULES = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js', 'js/v2-replay-worker.js'];
const BEHIND_MAX = +(process.env.WW_BEHIND_MAX || 18);   /* blocks (~3 h). Pages stop using a world 48 blocks behind; builds run every 6. */
const FEED_BEHIND_MAX = +(process.env.WW_FEED_BEHIND_MAX || 12);
/* Nov 24 2026: the follower froze at 977,257 for hours and every check here said fine, because "chain tip" was the server's own
 * (frozen) tip. The chain height now comes from outside (mempool.space, then blockstream.info), and the server's own tip is
 * checked against it. */
const FOLLOW_BEHIND_MAX = +(process.env.WW_FOLLOW_BEHIND_MAX || 3);
const A = process.argv.slice(2), opt = k => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : null; };

function rulesSig(bufs) {
  let n = 0; bufs.forEach(b => { n += b.length + 8; });
  const all = Buffer.alloc(n); let o = 0;
  bufs.forEach(b => { all.writeUInt32BE(b.length, o); o += 8; b.copy(all, o); o += b.length; });
  return 'r' + crypto.createHash('sha256').update(all).digest('hex').slice(0, 32);
}
const checkoutRsig = () => rulesSig(RULES.map(f => fs.readFileSync(path.join(ROOT, f))));
async function get(u, as) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 20000);
  /* the node cache passes queries on to Counterparty, which answers 400 to an unknown parameter: no cache-buster there */
  const cb = u.indexOf(NODE + '/v2/') === 0 ? '' : (u.includes('?') ? '&' : '?') + 'cb=' + Date.now();
  try { const r = await fetch(u + cb, { cache: 'no-store', signal: ctl.signal, headers: { 'User-Agent': 'xcpets-worldwatch' } });
    if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
    return as === 'buf' ? Buffer.from(await r.arrayBuffer()) : await r.json(); } finally { clearTimeout(t); }
}
const tryGet = (u, as) => get(u, as).catch(e => ({ __err: e.status ? 'HTTP ' + e.status : 'not answering' }));

async function liveRsig() {
  const live = await Promise.all(RULES.map(f => get(SITE + '/' + f, 'buf').catch(() => null)));
  return live.every(Boolean) ? rulesSig(live) : null;
}
async function realHeight() {
  for (const u of ['https://mempool.space/api/blocks/tip/height', 'https://blockstream.info/api/blocks/tip/height']) {
    try { const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 15000);
      try { const r = await fetch(u, { signal: ctl.signal, headers: { 'User-Agent': 'xcpets-worldwatch' } }); const n = parseInt((await r.text()).trim(), 10); if (r.ok && n > 0) return n; } finally { clearTimeout(t); }
    } catch (e) { }
  }
  return null;
}
/* the game server's own follower: does it keep up with the chain, and is its follow loop moving? */
function followProblems(h, real) {
  const out = [];
  if (!h || h.__err) return out;
  const tip = h.tip || 0, loop = h.loop || null;
  if (loop && loop.stepSec >= 600) out.push('The game server\'s chain follower has been stuck on one step for ' + Math.round(loop.stepSec / 60) + ' minutes (tip ' + tip + '). It restarts itself after 10 minutes; if this stays, run Actions > server-restart.');
  if (loop && loop.restarts1h >= 3) out.push('The game server\'s sync service keeps restarting (' + loop.restarts1h + ' times in the last hour; it was at block ' + tip + ', heap ' + (loop.heapMB || '?') + ' of ' + (loop.heapLimitMB || '?') + ' MB). Usually it runs out of memory.');
  if (real && tip && real - tip >= FOLLOW_BEHIND_MAX) out.push('The game server stopped following the chain: it is at block ' + tip + ', the chain is at ' + real + ' (' + (real - tip) + ' behind)' +
    (loop && loop.errorRun ? ', its last ' + loop.errorRun + ' reads failed (' + (loop.lastError || 'error') + ')' : '') + '. New burns do not show until it catches up.');
  return out;
}
async function check() {
  const out = { at: new Date().toISOString(), problems: [], notes: [] };
  out.liveRsig = await liveRsig();
  try { out.mainRsig = checkoutRsig(); } catch (e) { out.mainRsig = null; }
  const [h, latest, meta, cache] = await Promise.all([tryGet(NODE + '/xp/v1/health'), tryGet(NODE + '/xp/v1/world/latest.json'), tryGet(SITE + '/api/meta.json'),
    tryGet(NODE + '/v2/assets/XCPETS')]);
  /* Nov 22 2026: the node cache (node.xcpets.fun/v2, the pages' first chain read and the feed's) answered 502 while /xp/v1 was fine. */
  out.nodeCache = cache && !cache.__err ? 'ok' : (cache && cache.__err) || 'not answering';
  if (out.nodeCache !== 'ok') out.problems.push('The node cache (node.xcpets.fun/v2) is ' + out.nodeCache + '. Pages fall back to the slower public Counterparty nodes and the feed and recap cannot be built. Last time the node cache had hung: Actions > server-restart (type RESTART) fixed it.');
  if (h.__err) out.problems.push('The game server (node.xcpets.fun) health check is ' + h.__err + '. Pages fall back to the slow load.');
  out.serverTip = h.tip || null; out.realTip = await realHeight();
  out.chainTip = Math.max(h.tip || 0, out.realTip || 0) || null; out.builder = h.builder || null; out.follow = h.rules || null; out.loop = h.loop || null;
  const fp = followProblems(h, out.realTip); fp.forEach(p => out.problems.push(p));
  /* what worldwatch-alert.js may heal by itself when it lasts (a reboot through server-restart): the server not answering at all, or
   * a follower that stays stuck after the server's own guard and watchdog had their chance */
  /* a crash loop alone is not healed by a reboot (memory); only a server that does not answer or a follower that stays behind */
  out.heal = h.__err ? 'down' : followProblems(Object.assign({}, h, { loop: Object.assign({}, h.loop || {}, { restarts1h: 0 }) }), out.realTip).length ? 'stuck' : null;
  if (!out.liveRsig) out.problems.push('Could not read the rule files from the live site.');
  let world = latest && !latest.__err ? latest : null;
  out.latestRsig = world && world.rsig || null; out.latestTip = world && world.tip || null;
  if (world && out.liveRsig && world.rsig !== out.liveRsig) {
    const own = await tryGet(NODE + '/xp/v1/world/' + out.liveRsig + '/latest.json');
    world = own && !own.__err && own.rsig === out.liveRsig ? own : null;
    if (!world) out.problems.push('The published world was built with other rules (' + out.latestRsig + ') than the live site runs (' + out.liveRsig + '), and there is no world for the live rules. Every player gets the slow load until the server builds one.');
    else out.notes.push('latest.json has other rules; pages use the world kept for the live rules (tip ' + world.tip + ').');
  } else if (latest && latest.__err) out.problems.push('The published world (latest.json) is ' + latest.__err + '.');
  out.worldTip = world && world.tip || null;
  if (world && out.chainTip) {
    out.behind = out.chainTip - world.tip;
    if (out.behind > BEHIND_MAX) out.problems.push('The published world is ' + out.behind + ' blocks behind the chain (tip ' + world.tip + ', chain ' + out.chainTip + '). At 48 blocks pages stop using it.');
  }
  if (out.builder && out.builder.fails >= 3) out.problems.push('The world builder failed ' + out.builder.fails + ' times in a row (last: ' + (out.builder.lastExit || '?') + ').');
  if (out.follow && out.mainRsig && out.follow.rsig && out.follow.rsig !== out.mainRsig) out.notes.push('The server follows rules ' + out.follow.rsig + ', main has ' + out.mainRsig + ' (it checks main every 3 minutes).');
  if (out.follow && out.follow.fails >= 5 && out.follow.lastError) out.notes.push('The server could not check main ' + out.follow.fails + ' times: ' + out.follow.lastError);
  if (out.liveRsig && out.mainRsig && out.liveRsig !== out.mainRsig) {
    /* a rules deploy held back until its world exists: say whether it can go out now (worldwatch then re-runs the deploy) */
    const mw = await tryGet(NODE + '/xp/v1/world/' + out.mainRsig + '/latest.json');
    out.mainWorldTip = mw && !mw.__err && mw.rsig === out.mainRsig ? mw.tip : null;
    out.notes.push('The live site does not serve main\'s rule files yet (a deploy is running, or it is held until the server has a world for them). ' +
      (out.mainWorldTip ? 'The world for main\'s rules exists now (tip ' + out.mainWorldTip + '): the deploy can go out.' : 'No world for main\'s rules yet.'));
  }
  const feedTip = meta && !meta.__err ? (meta.blockHeight || meta.tip || null) : null;
  out.feedTip = feedTip;
  if (feedTip && out.chainTip && out.chainTip - feedTip > FEED_BEHIND_MAX) out.problems.push('The feed (api/meta.json) is ' + (out.chainTip - feedTip) + ' blocks behind the chain.');
  return out;
}
function report(r) {
  const lines = [(r.problems.length ? '### ⚠️ World watch: players may get the slow load' : '### ✅ World watch: fast load is working'), '',
    '| | |', '|---|---|',
    '| Chain tip (outside) / game server tip | ' + (r.realTip || '?') + ' / ' + (r.serverTip || '?') + ' |', '| World players use | ' + (r.worldTip || 'none') + (r.behind != null ? ' (' + r.behind + ' behind)' : '') + ' |',
    '| Live rules / main rules | ' + (r.liveRsig || '?') + ' / ' + (r.mainRsig || '?') + ' |', '| latest.json rules | ' + (r.latestRsig || '?') + ' |',
    '| Server follows main | ' + (r.follow ? (r.follow.follow ? 'yes, ' + (r.follow.sha || '?') + ' ' + (r.follow.rsig || '') : 'off') : 'not installed yet') + ' |',
    '| Feed tip | ' + (r.feedTip || '?') + ' |', '| Node cache (/v2) | ' + (r.nodeCache || '?') + ' |', ''];
  r.problems.forEach(p => lines.push('- **' + p + '**')); r.notes.forEach(n => lines.push('- ' + n));
  const md = lines.join('\n') + '\n';
  if (process.env.GITHUB_STEP_SUMMARY) try { fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md); } catch (e) {}
  console.log(md);
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
if (require.main === module) (async () => {
  if (A.includes('--rsig-of-checkout')) { console.log(checkoutRsig()); return; }
  const waitMin = +(opt('--wait') || 0), until = Date.now() + waitMin * 60000;
  const want = opt('--wait-for-rsig');
  if (want) {
    const now = await liveRsig();
    if (now === want) { console.log('This push does not change the rules the live site runs (' + want + '). Deploying.'); return; }
    console.log('This push changes the rules: live ' + (now || 'unreadable') + ', new ' + want + '. Waiting up to ' + waitMin + ' min for the server to build a world for them.');
    for (;;) {
      const h = await tryGet(NODE + '/xp/v1/health');
      if (!h.__err && h.rules && h.rules.follow === false) { console.log('The server does not follow main (turned off): not waiting.'); return; }
      const own = await tryGet(NODE + '/xp/v1/world/' + want + '/latest.json');
      if (own && !own.__err && own.rsig === want) { console.log('The server has a world for rules ' + want + ' (tip ' + own.tip + '). Deploying.'); return; }
      if (Date.now() >= until) {
        const msg = 'Held: no world for rules ' + want + ' after ' + waitMin + ' minutes' + (h.__err ? ' (the game server is ' + h.__err + ')' : '') +
          '. The site stays on the previous rules and their world, so players keep the fast load. World watch re-runs this deploy once the world exists.';
        console.log('::error::' + msg);
        if (process.env.GITHUB_STEP_SUMMARY) try { fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '### ⏸️ Rules deploy held\n\n' + msg + '\n'); } catch (e) {}
        process.exit(2);
      }
      console.log(new Date().toISOString() + ' waiting for the server to build a world for ' + want + ' (' + (h.__err ? 'server ' + h.__err : 'follows ' + ((h.rules && h.rules.rsig) || '?') + ', builder ' + (h.builder && h.builder.running ? 'running ' + h.builder.runningSec + ' s' : 'idle')) + ')');
      await sleep(60000);
    }
  }
  let r;
  for (;;) { r = await check(); if (!r.problems.length || Date.now() >= until) break; console.log(r.at + ' not fine yet: ' + r.problems.join(' | ')); await sleep(60000); }
  report(r);
  if (opt('--json')) fs.writeFileSync(opt('--json'), JSON.stringify(r, null, 1));
  process.exit(r.problems.length ? 1 : 0);
})().catch(e => { console.error('worldwatch failed: ' + (e && e.message || e)); if (!A.includes('--wait-for-rsig')) process.exit(1); });
module.exports = { followProblems, FOLLOW_BEHIND_MAX };
