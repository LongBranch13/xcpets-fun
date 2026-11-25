/* Builds the published world for the play-test rig at the pretend chain's current tip, like the game server does every 6 blocks.
 * node tools/playtest/build-world.js <input.json> <dataDir>   (input: { rows, hashes, tip, dex }). Prints the new latest.json. */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const S = require(path.join(ROOT, 'tools/sync-server/snapshot')), I = require(path.join(ROOT, 'tools/sync-server/index'));
(async () => {
  const inp = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), DATA = process.argv[3];
  const out = path.join(DATA, 'world', 'pending-' + inp.tip);
  fs.rmSync(out, { recursive: true, force: true });
  const b = await S.buildSnapshot({ rows: inp.rows, hashes: inp.hashes, tip: inp.tip, dex: inp.dex, outDir: out, compress: false, inSigOf: o => S.chainInSig(o.rows, o.hashes, o.tip, o.dex) });
  const wdir = path.join(DATA, 'world', b.rsig, String(inp.tip)); fs.rmSync(wdir, { recursive: true, force: true }); fs.mkdirSync(path.dirname(wdir), { recursive: true }); fs.renameSync(out, wdir);
  const latest = { v: 1, rsig: b.rsig, tip: inp.tip, manifest: '/xp/v1/world/' + b.rsig + '/' + inp.tip + '/manifest.json' };
  I.writeLatest(DATA, latest);
  console.log(JSON.stringify(latest));
})().catch(e => { console.error(e); process.exit(1); });
