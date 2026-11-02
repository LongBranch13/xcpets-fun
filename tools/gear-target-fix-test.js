#!/usr/bin/env node
/* gear-target-fix (owner Nov 2 2026 [pt2652u]; PREVIEW, gate null as shipped): saved spins land only on picked pets (pet:ut:N:AA:RUNS) from
 * ACTIVATE_SPIN_TARGET_BLOCK, the old pet:usespin tags then rejected with nothing spent, and the one-time re-wear (pet:rw:AA:RUNS) for the
 * owner's 1,011 pieces that pet:usespin:all put on pets he never fed (tx 38a32dc6…, block 974,216).
 *   1. parse.  2. gate off: pet:ut / pet:rw = unknown tag (community food), world identical; the grant note does not touch pets or items.
 *   3. gate on (tip + 1, live world api/boot.json): old tags rejected, nothing spent; pet:ut spends exactly N on the picked pets only;
 *      the planner splits big picks over several burns that each fit 34 bytes; daily chores leaves spins out.
 *   4. re-wear: every noted piece comes off and goes on a picked pet or stays in the stash; once only; other wallets have none.
 *   node tools/gear-target-fix-test.js [--boot FILE] */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { load, ROOT } = require('./lib/load-rules');
const A = process.argv.slice(2), opt = k => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : null; };
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const hex = s => Buffer.from(s, 'utf8').toString('hex');
const ctx = load(), V = ctx.V2Rules, E = ctx.LiveEngine;
const OWNER = 'bc1ps9av86ymmlzy9zj3a8pn6g94pz4j5e0kagv3td3wutaagfjvekjs26m3s4', OWNER_TX = '38a32dc60285b3d50a4133098178709153aa6bdc2923481e94447fb3f82d2848', GMONEY = 'bc1qtke38j72qv4d8eljn7pccaykypw8luytfwdn7q';
/* 1. parse */
const P = t => V.parseTag(t);
const u1 = P('pet:ut:ALL:A1:0513'); ok(u1.action === 'usespint' && u1.all && u1.a === parseInt('A1', 32) && JSON.stringify(u1.runs) === '[0,5,1,3]', 'parse: pet:ut:ALL:A1:0513');
const u2 = P('pet:ut:250:00:02'); ok(u2.action === 'usespint' && !u2.all && u2.n === 250, 'parse: pet:ut:250 = 250 spins');
ok(P('pet:ut:0:00:02').action === 'invalid' && P('pet:ut:10000:00:02').action === 'invalid' && P('pet:ut:ALL:00').action === 'invalid' && P('pet:ut:ALL:00:0').action === 'invalid' && P('pet:ut:ALL:00:00').action === 'invalid', 'parse: 0, 10000, missing / half / zero-take runs = invalid');
ok(P('pet:ut:ALL:00:' + '1'.repeat(20)).action === 'usespint' && P('pet:ut:ALL:00:' + '1'.repeat(22)).action === 'invalid', 'parse: 34-byte limit');
const r1 = P('pet:rw:0F:0513'); ok(r1.action === 'rewear' && r1.a === 15 && r1.runs.length === 4 && P('pet:rw:0F').action === 'invalid', 'parse: pet:rw:AA:RUNS');
ok(P('pet:rw:00:00').action === 'invalid', 'parse: pet:rw zero-take run = invalid');
ok(P('pet:usespin:all').action === 'usespin' && P('pet:usespin:3').n === 3, 'parse: old pet:usespin tags unchanged');
/* live world */
const boot = JSON.parse(fs.readFileSync(path.resolve(opt('--boot') || path.join(ROOT, 'api', 'boot.json')), 'utf8'));
const rows = boot.rows.slice().sort((a, b) => a.block_index - b.block_index || a.tx_index - b.tx_index), tip = boot.tip || rows[rows.length - 1].block_index, nb = tip + 1;
const hashes = Object.assign({}, ctx.XCPETS_BLOCK_HASHES || {}, boot.hashes || {}); for (let b = nb; b < nb + 12; b++) if (!hashes[b]) hashes[b] = crypto.createHash('sha256').update('fake-block-' + b).digest('hex');
const opts = t => ({ tip: t, live: E && E.RealCore, dex: boot.dex }); let txi = rows[rows.length - 1].tx_index + 1;
const mk = (b, src, tag, seed) => ({ tx_index: txi++, tx_hash: crypto.createHash('sha256').update('gtf-test:' + (seed || tag) + ':' + b + ':' + txi).digest('hex'), block_index: b, source: src, asset: 'XCPETS', quantity: 1, tag: hex(tag), status: 'valid' });
const G0 = V.spinTargetGate(); ok(G0 === null && !V.spinTargetOn(nb) && !V.spinTargetOn(9e9), 'gate in the code: ACTIVATE_SPIN_TARGET_BLOCK = ' + G0 + ' (PREVIEW: off at every block until set to tip + 6 at deploy)');
const w = V.replay(rows, hashes, [], opts(tip));
/* the grant note */
const hasOwner = rows.some(r => r.tx_hash === OWNER_TX), gr = V.rewearGrant(w, OWNER);
if (hasOwner) { ok(gr && gr.tx === OWNER_TX && gr.total === 1014 && !gr.used, 'grant note: the owner\'s use-all burn (1,161 spins with the sale data the site replays) put ' + (gr && gr.total) + ' pieces on pets with no meal yet (expect 1,014), ' + (gr && gr.n) + ' still his');
  ok(V.rewearGrant(w, GMONEY) === null, 'grant note: G Money (768-spin use-all) has no re-wear (owner decision)'); }
else console.log('  (boot file has no owner use-all burn: grant checks skipped)');
ok(V.spinTargetPlans(w, OWNER, [1], 'all', nb) === null && V.rewearPlan(w, OWNER, [1], nb) === null, 'gate off: planners offer nothing');
ok(/later block/.test(V.sendBlock(w, { tag: 'pet:ut:ALL:00:02' }, tip, { me: OWNER }) || ''), 'gate off: send guard says picking opens at a later block');
/* pick wallets */
const pets = {}; w.pets.forEach(p => { if (!p.community && !p.dead && !p.released && p.owner) (pets[p.owner] = pets[p.owner] || []).push(p); });
const rich = Object.keys(pets).filter(a => pets[a].length >= 4 && a !== OWNER).map(a => ({ a, s: V.spinsLeft(w, a, nb) })).sort((x, y) => y.s - x.s);
const W = rich[0].a, WS = rich[0].s, W2 = rich.find(x => x.a !== W && x.s > 0 && x.s <= 50) || rich[1];
console.log('  spin wallet ' + W.slice(0, 10) + '…: ' + WS + ' saved spins, ' + pets[W].length + ' living pets; chores wallet ' + W2.a.slice(0, 10) + '…: ' + W2.s + ' spins');
/* 2. gate off: same as any unknown tag */
{ const ta = mk(nb, W, 'pet:ut:ALL:' + (tip % 1024 < 32 ? '0' : '') + (tip % 1024).toString(32).toUpperCase() + ':03', 'off'), tb = Object.assign({}, ta, { tag: hex('pet:zz:ALL:00:03') });
  const rw = mk(nb + 1, OWNER, 'pet:rw:00:03', 'offrw'), rwb = Object.assign({}, rw, { tag: hex('pet:zz:00:03') });
  const a = V.replay(rows.concat([ta, rw]), hashes, [], opts(nb + 2)), b = V.replay(rows.concat([tb, rwb]), hashes, [], opts(nb + 2));
  const la = a.log.find(x => x.tx === ta.tx_hash), lr = a.log.find(x => x.tx === rw.tx_hash);
  ok(la && la.kind === 'rejected' && /unknown pet: tag/.test(la.msg) && lr && lr.kind === 'rejected' && /unknown pet: tag/.test(lr.msg), 'gate off: pet:ut and pet:rw = unknown pet: tag (community food) [' + (la && la.msg) + ']');
  const strip = x => JSON.stringify({ log: x.log.map(l => [l.tx, l.kind, l.msg]), items: x.items, spins: x.spins, pets: x.pets.map(p => [p.id, p.owner, p.care, p.stage, p.dead]) });
  ok(strip(a) === strip(b), 'gate off: world identical to an unknown tag with the same tx');
  ok(V.spinsLeft(a, W, nb + 2) === WS, 'gate off: no spins spent'); }
/* 3 + 4. gate on */
const G = nb; V._setSpinTargetActivation(G); ok(V.spinTargetOn(G) && !V.spinTargetOn(G - 1), 'gate set for the test: ' + G);
ok(/only on pets you pick/.test(V.sendBlock(w, { tag: 'pet:usespin:all' }, tip, { me: W }) || '') && /only on pets you pick/.test(V.sendBlock(w, { tag: 'pet:usespin:3' }, tip, { me: W }) || ''), 'send guard: old pet:usespin tags say "pick pets"');
const pick = pets[W].slice(0, Math.min(3, pets[W].length)).map(p => p.id), plans = V.spinTargetPlans(w, W, pick, 'all', G);
ok(plans && plans.length === 1 && plans[0].tag.length <= 34 && /^pet:ut:ALL:/.test(plans[0].tag) && plans[0].amount === 0.00000001 && plans[0].n === WS && JSON.stringify(plans[0].petIds) === JSON.stringify(pick), 'planner: one 1-sat burn ' + (plans && plans[0].tag) + ' for ' + WS + ' spins on #' + pick.join(', #'));
ok(V.sendBlock(w, plans[0], tip, { me: W }) === null, 'send guard: the picked-pet plan is allowed');
/* big scattered pick -> several burns */
const big = Object.keys(pets).map(a => [a, pets[a].length]).sort((x, y) => y[1] - x[1])[0][0], bigIds = V.spinList(w, big, tip, G).filter((p, i) => i % 3 === 0).map(p => p.id);
const bigS = V.spinsLeft(w, big, G), bp = bigS > 0 ? V.spinTargetPlans(w, big, bigIds, 'all', G) : null;
if (bp) { const u = [].concat.apply([], bp.map(p => p.petIds)).sort((x, y) => x - y);
  ok(bp.every(p => p.tag.length <= 34) && JSON.stringify(u) === JSON.stringify(bigIds.slice().sort((x, y) => x - y)) && bp.reduce((s, p) => s + p.n, 0) === bigS, 'planner: ' + bigIds.length + ' scattered pets -> ' + bp.length + ' burns, all <= 34 bytes, every pet once, ' + bigS + ' spins in total');
  ok(bp.every(p => { const t = P(p.tag); return t.action === 'usespint' && JSON.stringify(V.spinList(w, big, tip, G).filter((q, i) => { let pos = 0, inn = false; for (let k = 0; k < t.runs.length; k++) { if (k % 2 === 0) { pos += t.runs[k]; continue; } if (i >= pos && i < pos + t.runs[k]) inn = true; pos += t.runs[k]; } return inn; }).map(q => q.id)) === JSON.stringify(p.petIds); }), 'planner: each burn decodes back to exactly its pets'); }
else console.log('  (largest wallet has no saved spins: split check skipped)');
/* chores leave spins out after the gate */
const dcp = V.dailyChoresGate && V.dailyChoresGate() != null ? V.dailyChoresPlan(w, W2.a, G) : null; if (dcp) ok(!(P(dcp.tag || (dcp[0] || {}).tag || '').spins), 'daily chores plan: no "use all spins" part after the gate');
/* re-wear picks: owner's fed living pets, as many as fit one burn (max 12) */
let rwPick = null, rwPlan = null; if (hasOwner) { const fed = pets[OWNER].filter(p => p.lastFed != null).sort((x, y) => (y.tier || 0) - (x.tier || 0) || x.id - y.id);
  for (let k = Math.min(12, fed.length); k > 0 && !rwPlan; k--) { rwPick = fed.slice(0, k).map(p => p.id); rwPlan = V.rewearPlan(w, OWNER, rwPick, G); }
  ok(rwPlan && rwPlan.tag.length <= 34 && /^pet:rw:/.test(rwPlan.tag), 're-wear planner: ' + (rwPlan && rwPlan.tag) + ' (' + (rwPlan && rwPlan.label) + ')');
  var rwPick2 = fed.slice(rwPick.length, rwPick.length + 40).map(p => p.id), rwAll = V.rewearPlans(w, OWNER, fed.map(p => p.id), G), rwPlan2 = V.rewearPlans(w, OWNER, rwPick2, G);
  ok(rwAll && rwAll.every(p => p.tag.length <= 34) && [].concat.apply([], rwAll.map(p => p.petIds)).length === fed.length, 're-wear planner: all ' + fed.length + ' fed pets of the owner -> ' + (rwAll && rwAll.length) + ' burns, each <= 34 bytes'); }
const old1 = mk(G, W, 'pet:usespin:all', 'o1'), old2 = mk(G, W, 'pet:usespin:3', 'o2'), ut = mk(G + 1, W, plans[0].tag, 'ut'), ut2 = mk(G + 2, W, plans[0].tag, 'ut2');
const frVar = n => { const d = [n % 16]; n = Math.floor(n / 16); while (n > 0) { d.unshift(16 + n % 16); n = Math.floor(n / 16); } return d.map(x => x.toString(32).toUpperCase()).join(''); };
const dc = mk(G + 1, W2.a, 'pet:dc:2', 'dc'), bad = mk(G + 1, W2.a, 'pet:ut:1:' + plans[0].tag.split(':')[3] + ':' + frVar(V.spinList(w, W2.a, tip, G).length + 5) + '1', 'bad');
const extra = [old1, old2, ut, ut2, dc, bad]; let rwr = null, rw2 = null, rwg = null;
if (rwPlan) { rwr = mk(G + 3, OWNER, rwPlan.tag, 'rw'); rw2 = mk(G + 4, OWNER, rwPlan2[0].tag, 'rw2'); rwg = mk(G + 3, GMONEY, rwPlan.tag, 'rwg'); extra.push(rwr, rw2, rwg); }
const w2 = V.replay(rows.concat(extra), hashes, [], opts(G + 6)), lg = t => w2.log.find(x => x.tx === t.tx_hash) || {};
ok(lg(old1).kind === 'rejected' && /pick/.test(lg(old1).msg) && lg(old2).kind === 'rejected', 'gate on: pet:usespin:all and pet:usespin:3 rejected [' + lg(old1).msg + ']');
const lu = lg(ut), sp = lu.spins || [];
ok(lu.kind === 'roll' && sp.length === WS, 'gate on: pet:ut:ALL used all ' + WS + ' spins (nothing was spent by the rejected old tags) [' + lu.msg + ']');
ok(sp.length > 0 && sp.every(s => pick.indexOf(s.petId) >= 0), 'gate on: every piece landed on a picked pet (' + [...new Set(sp.map(s => s.petId))].map(i => '#' + i).join(' ') + ')');
ok(sp.every(s => w2.items[s.gid] && w2.items[s.gid].owner === W && w2.items[s.gid].src === 'usespin'), 'gate on: pieces are the signer\'s, rolled as saved spins');
ok(V.spinsLeft(w2, W, G + 6) === 0 && lg(ut2).kind === 'rejected', 'gate on: 0 spins left, a second ALL is rejected [' + lg(ut2).msg + ']');
ok(lg(bad).kind === 'rejected' && /no pets at those places/.test(lg(bad).msg), 'gate on: runs past the end of the list rejected, nothing spent [' + lg(bad).msg + ']');
const dcl = lg(dc); ok(!dcl.kind || dcl.kind !== 'roll', 'gate on: pet:dc spins part does not spin [' + (dcl.kind + ': ' + dcl.msg) + ']');
ok(V.spinsLeft(w2, W2.a, G + 6) === V.spinsLeft(w, W2.a, G + 6), 'gate on: chores wallet keeps its ' + V.spinsLeft(w2, W2.a, G + 6) + ' spins');
if (rwPlan) { const R = w._rw[OWNER_TX], set = new Set(R.gids), l = lg(rwr), rr = l.rewear || {};
  ok(l.kind === 'rewear' && rr.worn + rr.stash + rr.skipped === gr.n, 're-wear: ' + l.msg);
  const moved = R.gids.map(g => w2.items[g]).filter(g => g && g.owner === OWNER);
  const PK = rwPick.concat(rwPlan2[0].petIds), l2 = lg(rw2), r2 = l2.rewear || {};
  ok(l2.kind === 'rewear' && r2.worn > 0 && r2.worn + r2.stash === rr.stash, 're-wear, second burn (more picks): ' + l2.msg);
  rwPick = PK; rr.worn += r2.worn;
  ok(moved.every(g => g.on == null || rwPick.indexOf(g.on) >= 0 || (w.items[g.gid].on === g.on && rr.skipped > 0)) && moved.every(g => g.bag == null), 're-wear: every noted piece is now on a picked pet or in the stash (none left in a bag)');
  ok(moved.filter(g => g.on != null && rwPick.indexOf(g.on) >= 0).length === rr.worn && rr.worn > 0, 're-wear: ' + rr.worn + ' worn over both burns on ' + rwPick.length + ' picked pets');
  ok(Object.keys(w.items).length + WS === Object.keys(w2.items).length && Object.keys(w.items).every(k => w.items[k].owner === w2.items[k].owner), 're-wear: no piece created, destroyed or moved to another wallet');
  ok(Object.keys(w.items).filter(k => !set.has(k) && w.items[k].on !== w2.items[k].on).every(k => w2.items[k].on == null && rwPick.indexOf(w.items[k].on) >= 0 && w.items[k].owner === OWNER || w.items[k].owner === W), 're-wear: other pieces touched only when a better noted piece took their slot on a picked pet');
  const wornBy = {}; Object.keys(w2.items).forEach(k => { const g = w2.items[k]; if (g.on != null && rwPick.indexOf(g.on) >= 0) { const key = g.on + ':' + g.slot; wornBy[key] = (wornBy[key] || 0) + 1; } });
  ok(Object.values(wornBy).every(n => n === 1), 're-wear: one piece per slot on every picked pet');
  ok(lg(rwg).kind === 'rejected' && /no re-wear grant/.test(lg(rwg).msg), 're-wear: G Money has none [' + lg(rwg).msg + ']');
  const g2 = V.rewearGrant(w2, OWNER); ok(g2.used === G + 3 && g2.burns === 2 && g2.n === r2.stash, 're-wear: first used at ' + g2.used + ', 2 burns, ' + g2.n + ' pieces still in the stash for more picks'); }
V._setSpinTargetActivation(null);
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
