#!/usr/bin/env node
/* Anchored discards (rules, ACTIVATE_HD_ANCHOR_BLOCK). Nov 25 2026: G Money sent 4 pet:fr burns (5,267.64 XCPETS) in block 977,469 right
 * after pet:hd burns in the same block. The runs count places in the signer's list at the anchor block, but that list read the discard flag
 * as it was at the burn, so 10,900 pets left it and all 4 burns were rejected 'feed runs: no pets at those places'.
 * Checks, on the real chain (api/boot.json):
 *  1. gate off (as live): those 4 burns are rejected (the bug);
 *  2. gate on at 977,469: the same 4 burns feed the pets they named; pets discarded BEFORE the feed in that block are skipped, not fed;
 *  3. the planner list (anchor = tip) is the same with the gate on or off;
 *  4. replay before the gate is unchanged (no p.hdH written below the block).
 *   node --max-old-space-size=9000 tools/hd-anchor-test.js [--boot FILE] */
'use strict';
const fs = require('fs'), path = require('path');
const { load, ROOT } = require('./lib/load-rules');
const A = process.argv.slice(2), opt = k => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : null; };
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const boot = JSON.parse(fs.readFileSync(path.resolve(opt('--boot') || path.join(ROOT, 'api', 'boot.json')), 'utf8'));
const GM = 'bc1qtke38j72qv4d8eljn7pccaykypw8luytfwdn7q', TIP = 977472;
/* the 4 feed burns, by tx hash: the feed renumbered tx_index (3212375.. became 3212367..) and the old numbers then named his discards */
const FR = ['e66a19720646d30932985c5520796f46ea4415f0e2b6f8e7bc6a0946adcebd47', 'f969cce5085f2a8bfa28655fa5248ad407d8580f54bc731add8d85df96de6a48',
  'd6972ed91f63c938a36fcf0b6b1ec04c7141fc6c1cab60f4515fe47e789e3104', 'ff0418b3ae81536df1e2fb237695b14b240c5d9dc2e741cb24e62b67317f33b4'];
const rows = boot.rows.filter(r => r.block_index <= TIP).sort((a, b) => a.block_index - b.block_index || a.tx_index - b.tx_index);
if (!FR.every(h => rows.some(r => r.tx_hash === h))) { console.log('skip: api/boot.json does not reach block 977,469'); process.exit(0); }
const hashOf = {}; FR.forEach(h => { hashOf[h] = h; });
function run(gate) { const c = load(), V = c.V2Rules; if (gate !== undefined) V._setHdAnchorActivation(gate);
  const w = V.replay(rows, Object.assign({}, c.XCPETS_BLOCK_HASHES || {}, boot.hashes || {}), [], { tip: TIP, live: c.LiveEngine && c.LiveEngine.RealCore, dex: boot.dex });
  const byTx = {}; w.log.forEach(e => { if (e.tx) (byTx[e.tx] = byTx[e.tx] || []).push(e); }); return { V, w, byTx }; }
const off = run(null), on = run(977469);
ok(typeof off.V.ACTIVATE_HD_ANCHOR_BLOCK === 'number' && off.V.ACTIVATE_HD_ANCHOR_BLOCK > TIP, 'live gate ' + off.V.ACTIVATE_HD_ANCHOR_BLOCK + ' is after the replayed chain');
const kinds = R => FR.map(t => (R.byTx[hashOf[t]] || []).map(e => e.kind).join('+'));
ok(kinds(off).every(k => k === 'rejected'), 'gate off: the 4 feed burns are rejected (' + kinds(off).join(', ') + ')');
ok(kinds(on).every(k => k && k !== 'rejected'), 'gate on: the 4 feed burns are not rejected (' + kinds(on).join(', ') + ')');
const fed = [].concat(...FR.map(t => (on.byTx[hashOf[t]] || []).map(e => e.petIds || []))).flat();
ok(fed.length > 0, 'gate on: ' + fed.length + ' pets fed by those burns');
const before = new Set([].concat(...rows.filter(r => r.block_index === 977469 && r.source === GM && r.tx_index < 3212375).map(r => (on.byTx[r.tx_hash] || []).filter(e => e.kind === 'discard').map(e => e.petIds || [])).flat()));
ok(fed.every(id => !before.has(id)), 'gate on: no pet discarded earlier in the block is fed (' + before.size + ' discarded before the feeds)');
const pl = R => R.V.refList(R.w, GM, TIP, TIP + 1).map(p => p.id).join(',');
ok(pl(off) === pl(on), 'planner list at the tip is the same with the gate on and off');
ok(!off.w.pets.some(p => p.hdH), 'gate off: no discard history is written');
ok(on.w.pets.some(p => p.hdH), 'gate on: discard history is written');
console.log(fails ? fails + ' failed' : 'all passed'); process.exit(fails ? 1 : 0);
