#!/usr/bin/env node
/* FEED ALL LIVE CHECK (ACTIVATE_FEEDALL_LIVECHECK_BLOCK, owner Oct 27 2026 'no, i make the sacrifice').
 * The real pet:fa abe068af… at block 973,486 (bc1ps9av…m3s4, 100,928.25 XCPETS) fed 86 dead never-fed pets (#18845-#18937) because the
 * feeda handler did not refresh death (liveAt). Before the gate that burn must replay exactly as it did (no retroactive change);
 * the same burn made after the gate must feed only live pets. Uses the repo's api/boot.json (live chain data). */
'use strict';
const fs = require('fs'), path = require('path'), L = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('ok   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const B = JSON.parse(fs.readFileSync(path.join(L.ROOT, 'api', 'boot.json'), 'utf8'));
const REAL = B.rows.find(r => r.tx_hash && r.tx_hash.indexOf('abe068af3fbdb1a7') === 0);
if (!REAL) { console.log('ok   skipped: pet:fa abe068af (973,486) not in api/boot.json'); process.exit(0); }
const ME = REAL.source, AMT = REAL.quantity / 1e8, BLK = REAL.block_index, GATE = BLK + 6;
const KNOWN_DEAD = [18845, 18846, 18847, 18848, 18849, 18851, 18852, 18853, 18854, 18855]; // first 10 of the 86 in reports/owner-feedall-973486-pets.txt
function run(gate, rows, tip) { const c = L.load(); if (gate !== undefined) c.V2Rules._setFeedAllLiveCheckActivation(gate); return { c, w: L.run(c, { rows, hashes: B.hashes }, [], tip) }; }
const logOf = (w, tx) => (w.log || []).find(l => l.tx === tx && (l.kind === 'feed' || l.kind === 'rejected'));
{ const c = L.load(); ok(c.V2Rules.ACTIVATE_FEEDALL_LIVECHECK_BLOCK === null || c.V2Rules.ACTIVATE_FEEDALL_LIVECHECK_BLOCK > BLK, 'gate is after the 973,486 burn (' + c.V2Rules.ACTIVATE_FEEDALL_LIVECHECK_BLOCK + ')'); }
// 1) history: the real burn, before the gate, replays exactly as before (gate OFF == gate after it)
const hist = B.rows.filter(r => r.block_index <= BLK);
const off = run(null, hist, BLK + 1), pre = run(GATE, hist, BLK + 1);
const fOff = logOf(off.w, REAL.tx_hash), fPre = logOf(pre.w, REAL.tx_hash);
ok(fOff && fOff.kind === 'feed' && fOff.petIds.length === 94, 'gate OFF: 973,486 pet:fa fed 94 pets as on chain (' + (fOff && fOff.petIds.length) + ')');
ok(KNOWN_DEAD.every(id => fOff.petIds.includes(id)), 'gate OFF: the dead never-fed pets #18845… are in that feed (history kept)');
ok(fPre && JSON.stringify(fPre.petIds) === JSON.stringify(fOff.petIds) && fPre.msg === fOff.msg, 'before the gate (gate ' + GATE + '): same 94 pets, same log line');
ok(JSON.stringify(pre.w.pets.filter(p => p.owner === ME).map(p => [p.id, p.care, p.dead, p.stage])) === JSON.stringify(off.w.pets.filter(p => p.owner === ME).map(p => [p.id, p.care, p.dead, p.stage])), 'before the gate: every pet of the wallet ends identical (care/dead/stage)');
// 2) the same burn made after the gate (history up to 973,485 without the real burn)
const prior = B.rows.filter(r => r.block_index < BLK);
const row = L.row(GATE, ME, AMT, 'pet:fa');
const after = (() => { const c = L.load(); c.V2Rules._setFeedAllLiveCheckActivation(GATE); return { c, w: L.run(c, { rows: prior, hashes: B.hashes }, [row], GATE + 1) }; })();
const fA = logOf(after.w, row.tx_hash);
ok(fA && fA.kind === 'feed', 'after the gate: the 973,486-style pet:fa is a feed (' + (fA && fA.msg.slice(0, 70)) + ')');
ok(fA && !fA.petIds.some(id => KNOWN_DEAD.includes(id)), 'after the gate: none of the dead never-fed pets #18845… is fed');
// every fed pet was alive at the gate block: replay the same history to GATE without the burn and check dead flags there
const ref = (() => { const c = L.load(); c.V2Rules._setFeedAllLiveCheckActivation(GATE); return L.run(c, { rows: prior, hashes: B.hashes }, [], GATE); })();
const deadAtGate = new Set(ref.pets.filter(p => p.owner === ME && p.dead).map(p => p.id));
ok(fA && fA.petIds.every(id => !deadAtGate.has(id)), 'after the gate: every fed pet is alive at block ' + GATE + ' (' + (fA && fA.petIds.length) + ' fed, ' + deadAtGate.size + ' dead skipped)');
const liveHungry = ref.pets.filter(p => p.owner === ME && p.hungry && !p.dead && !p.released).map(p => p.id).sort((a, b) => a - b);
const plan = after.c.V2Rules.feedQueue(ref, ME, null, GATE), feeds = plan.filter(q => !q.setOnly), planned = [].concat(...feeds.map(q => q.petIds || [q.petId])).sort((a, b) => a - b);
ok(feeds.length >= 1 && !planned.some(id => deadAtGate.has(id)), 'planner: Feed all plans only live hungry pets (' + plan.length + ' burn(s): ' + plan.map(q => q.tag.split(':').slice(0, 2).join(':')).join(', ') + '; ' + planned.length + ' pets, 0 dead)');
const rows2 = plan.map(q => L.row(GATE, ME, q.amount, q.tag)), w2 = (() => { const c = L.load(); c.V2Rules._setFeedAllLiveCheckActivation(GATE); return L.run(c, { rows: prior, hashes: B.hashes }, rows2, GATE + 1); })();
const fed2 = [].concat(...(w2.log || []).filter(l => rows2.some(r => r.tx_hash === l.tx) && l.kind === 'feed').map(l => l.petIds || [l.petId])).sort((a, b) => a - b);
ok(fed2.join() === planned.join() && planned.join() === liveHungry.join(), 'after the gate: the planned burns feed exactly the ' + liveHungry.length + ' live hungry pets, no dead pet (' + fed2.length + ' fed)');
// 3) same burn after the gate block but gate OFF: still feeds dead pets (shows the gate is what changes it)
const offAfter = (() => { const c = L.load(); c.V2Rules._setFeedAllLiveCheckActivation(null); return L.run(c, { rows: prior, hashes: B.hashes }, [row], GATE + 1); })(), fO = logOf(offAfter, row.tx_hash);
ok(fO && fO.petIds.some(id => KNOWN_DEAD.includes(id)), 'gate OFF at the same block: dead pets still eaten (old behaviour, ' + (fO && fO.petIds.length) + ' fed)');
// 4) owner Oct 27 2026 10:27 PM CT: "Dead pets can never be fed" and "Discarded pets can never be fed". Every feed path after the gate:
// pet:feed (single) and pet:fl / pet:fm (list) already refresh death through pet() and reject dead and released pets; pet:fa / fx / fy now do too.
// Discard is browser-only (hidden in this browser, no burn), so the engine has no discard state; released (pet:rel) is the on-chain removal.
{ const b32 = n => n.toString(32).toUpperCase(), D = KNOWN_DEAD.find(id => deadAtGate.has(id)), A = liveHungry[0], R = liveHungry[1];
  const rs = [L.row(GATE, ME, 1, 'pet:rel:' + R), L.row(GATE + 1, ME, AMT, 'pet:feed:' + D), L.row(GATE + 1, ME, AMT, 'pet:fl:' + [A, D].sort((x, y) => x - y).map(b32).join('.')),
    L.row(GATE + 1, ME, AMT, 'pet:feed:' + R), L.row(GATE + 1, ME, AMT, 'pet:fa')];
  const go = gate => { const c = L.load(); c.V2Rules._setFeedAllLiveCheckActivation(gate); const z = L.run(c, { rows: prior, hashes: B.hashes }, rs, GATE + 2); return rs.map(r => logOf(z, r.tx_hash) || (z.log || []).find(l => l.tx === r.tx_hash)); };
  const [rel, f1, fl, f2, fa] = go(GATE), [, o1, ol, o2, oa] = go(null);
  ok(D && rel && rel.kind === 'release', 'setup: dead never-fed #' + D + ', live #' + A + ', #' + R + ' released at ' + GATE + ' (' + (rel && rel.kind) + ')');
  ok(f1 && f1.kind === 'rejected' && /dead/.test(f1.msg), 'after the gate: pet:feed on dead #' + D + ' rejected (' + (f1 && f1.msg) + ')');
  ok(fl && fl.kind === 'feed' && fl.petIds.join() === String(A) && /dead/.test(fl.msg), 'after the gate: pet:fl feeds live #' + A + ' only, dead #' + D + ' skipped (' + (fl && fl.msg.slice(0, 80)) + ')');
  ok(f2 && f2.kind === 'rejected' && /released/.test(f2.msg), 'after the gate: pet:feed on released #' + R + ' rejected (' + (f2 && f2.msg) + ')');
  ok(fa && fa.kind === 'feed' && !fa.petIds.includes(D) && !fa.petIds.includes(R) && !fa.petIds.some(id => deadAtGate.has(id)), 'after the gate: pet:fa feeds no dead and no released pet (' + (fa && fa.petIds.length) + ' fed)');
  ok(o1 && o1.msg === f1.msg && ol && ol.msg === fl.msg && o2 && o2.msg === f2.msg, 'single and list feeds behave the same with the gate OFF (they always refreshed death)');
  /* (#D itself was refreshed to dead by the pet:feed above, so OFF skips it; the other stale-dead pets are still eaten) */
  ok(oa && oa.petIds.some(id => deadAtGate.has(id)) && !oa.petIds.includes(R), 'gate OFF: pet:fa still eats stale-dead pets (old behaviour, ' + (oa && oa.petIds.filter(id => deadAtGate.has(id)).length) + '), never the released #' + R); }
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
