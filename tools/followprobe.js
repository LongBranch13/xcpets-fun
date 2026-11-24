'use strict';
/* Follow probe (Nov 24 2026): runs one follow step of the sync server (tools/sync-server, same code and rules as main) from
 * api/boot.json to the chain's current tip against the public Counterparty API, and prints which step failed and why. Read-only:
 * it writes nothing and signs nothing. Used to diagnose a follower that keeps failing on the game server. */
const fs = require('fs'), path = require('path'), Module = require('module');
const R = path.join(__dirname, 'sync-server', 'index.js');
const m = new Module(R, null); m.filename = R; m.paths = Module._nodeModulePaths(path.dirname(R));
m._compile(fs.readFileSync(R, 'utf8') + '\nmodule.exports.salesIo = salesIo;', R);
const { blank, tick } = require('./sync-server/follow');
const boot = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'api', 'boot.json'), 'utf8'));
(async () => {
  try { const h = await (await fetch('https://node.xcpets.fun/xp/v1/health?cb=' + Date.now())).json(); delete h.upstream;
    console.log('live health:', JSON.stringify({ tip: h.tip, coreHeight: h.coreHeight, ready: h.ready, lag: h.lag, lastBlockAt: h.lastBlockAt, lastSnapshotTip: h.lastSnapshotTip, loop: h.loop, rules: h.rules, builder: h.builder })); }
  catch (e) { console.log('live health not answering'); }
  if (process.env.PROBE_HEALTH_ONLY === '1') return;
  const bases = m.exports.PUBLIC;
  const io0 = m.exports.salesIo(bases, boot);
  const state = blank(); state.rows = boot.rows; state.tip = boot.tip; state.dex = boot.dex || null; state.dexTip = boot.dexTip || 0; state.dexHash = boot.dexHash || ''; state.dexAssets = boot.dexAssets || [];
  Object.keys(boot.hashes || {}).forEach(k => { if (+k <= boot.tip - 6) state.hashes[k] = boot.hashes[k]; });
  state.gates = io0.gates;
  const io = Object.assign({}, io0, { upstream: 'public' });
  const t0 = Date.now();
  console.log('boot tip', boot.tip, 'rows', boot.rows.length, 'gates', JSON.stringify(state.gates));
  try { await tick(state, io); console.log('OK: followed to', state.tip, 'in', Math.round((Date.now() - t0) / 1000), 's, rows', state.rows.length, 'dex', !!state.dex); }
  catch (e) { console.log('FAILED at step', state.step, 'after', Math.round((Date.now() - t0) / 1000), 's'); console.log('code:', m.exports.errCode(e)); console.log('name:', e && e.name); console.log(String(e && e.stack || e).split('\n').slice(0, 12).join('\n')); process.exitCode = 1; }
  setTimeout(() => process.exit(process.exitCode || 0), 500);
})();
