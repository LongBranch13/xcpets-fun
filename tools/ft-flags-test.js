#!/usr/bin/env node
/* FUNTRUMP flags tests (dev only, branch funtrump-flags): American flag replaces the Gold phone's Grip T2 roll spot and the Kekistan flag (Grip T1)
 * joins the pools only from ACTIVATE_FT_FLAGS_BLOCK; owned phones stay wearable; one Kekistan flag per address holding a living pet, granted once.
 * node tools/ft-flags-test.js */
'use strict';
const { load, snap } = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const c = load(), V = c.V2Rules, GR = c.V2Gear;
ok(V.ACTIVATE_FT_FLAGS_BLOCK === null || V.ACTIVATE_FT_FLAGS_BLOCK > 973330, 'gate null or a future block');
const D = GR.DEFS; ok(D['ft-us-flag'] && D['ft-us-flag'].slot === 'hand' && D['ft-us-flag'].tier === 2 && !D['ft-us-flag'].exclusive, 'American flag = open Grip T2');
ok(D['ft-kek-flag'] && D['ft-kek-flag'].slot === 'hand' && D['ft-kek-flag'].tier === 1 && !D['ft-kek-flag'].exclusive, 'Kekistan flag = open Grip T1');
const ids = (b, tier, sp) => { V._setEligB(b); const p = V.pool('hand', sp || 'funtrump', tier, sp || 'funtrump') || []; return p.map(x => x.it ? x.it.id : x); };
const G = 980000;
const check = (tag) => { const a = ids(G - 1, 3), b = ids(G, 3), pp = ids(G, 3, 'pepe');
  return { phoneBefore: a.includes('ft-gold-phone'), flagsBefore: a.includes('ft-us-flag') || a.includes('ft-kek-flag'), phoneAfter: b.includes('ft-gold-phone'), us: b.includes('ft-us-flag'), kek: b.includes('ft-kek-flag'), pepeUs: pp.includes('ft-us-flag') }; };
V._setFtFlagsActivation(null); let r = check(); ok(r.phoneAfter && !r.us && !r.kek, 'gate null: phone rolls, no flags');
V._setFtFlagsActivation(G); r = check();
ok(r.phoneBefore && !r.flagsBefore, 'before the gate: phone rolls, no flags'); ok(!r.phoneAfter && r.us && r.kek, 'at/after the gate: flags roll, phone does not');
V._setEligB(G); ok(V.eligible('ft-gold-phone', 'funtrump', 'funtrump', 3), 'owned gold phone still wearable after the gate');
V._setEligB(G - 1); ok(!V.eligible('ft-us-flag', 'funtrump', 'funtrump', 3), 'flags not wearable before the gate');
/* grant on the latest snapshot: gate = a block inside the snapshot, replay to tip */
const s = snap(process.argv[2]), tip = s.tip || Math.max(...s.rows.map(x => x.block_index));
const run = (gate) => { const cc = load(), VV = cc.V2Rules; VV._setFtFlagsActivation(gate); const w = VV.replay(s.rows, Object.assign({}, cc.XCPETS_BLOCK_HASHES || {}, s.hashes), [], { tip, live: cc.LiveEngine && cc.LiveEngine.RealCore });
  const items = w.itemList || Object.values(w.items || {}); return { w, VV, g: items.filter(x => x.src === 'ft-flag-grant') }; };
const a = run(tip), want = a.VV.kekFlagHolders(a.w, tip);
ok(a.g.length === want.length && a.g.length > 0, 'one grant per living-pet address (' + a.g.length + ')');
ok(new Set(a.g.map(x => x.owner)).size === a.g.length && a.g.every(x => x.item === 'ft-kek-flag'), 'exactly one Kekistan flag per address');
const b2 = run(tip); ok(JSON.stringify(b2.g.map(x => [x.gid, x.owner])) === JSON.stringify(a.g.map(x => [x.gid, x.owner])), 'grant deterministic');
const mid = run(tip - 40); ok(mid.g.every(x => x.grantBlock === tip - 40) && new Set(mid.g.map(x => x.owner)).size === mid.g.length, 'mid-snapshot gate: granted once (' + mid.g.length + ')');
console.log('GRANT latest snapshot tip ' + tip + ': ' + a.g.length + ' addresses get one Kekistan flag');
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
