#!/usr/bin/env node
/* quest-shards-1103 tests (dev tooling only): Power Shards (Option B), gated by V2Rules.ACTIVATE_QUEST_SHARDS_BLOCK.
 *  1) shard grants: table, spread across the two favoured stats, caps (15 per pet incl. old questBoost, 8 per stat)
 *  2) breeding at half strength: base path unchanged, inherited points bounded, safeguard (no growth over generations), twins
 *  3) replay: simulated quests on snapshot 972901 with the quest and shard gates moved IN MEMORY to 972300 (Haul/Loot shards, Cold Loot no spin,
 *     no old +1), and the gate at its real block (> snapshot tip) changes nothing
 *  4) text: rules.html section, gate comment markers, wording rules on the added text */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert'), crypto = require('crypto'), { execSync } = require('child_process');
const L = require('./lib/load-rules'), ROOT = L.ROOT, rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const c = L.load(), V = c.V2Rules, GATE0 = V.ACTIVATE_QUEST_SHARDS_BLOCK;
let pass = 0, fail = 0; const t = (n, f) => { try { f(); pass++; console.log('ok   ' + n); } catch (e) { fail++; console.log('FAIL ' + n + ': ' + (e && e.stack ? e.stack.split('\n').slice(0, 2).join(' ') : e)); } };
const KEYS = c.PetCore.STAT_KEYS, sum = o => Object.values(o || {}).reduce((a, b) => a + b, 0);
const pet = (id, sp, st, extra) => Object.assign({ id, species: sp, tier: 2, stats: Object.assign({}, st), parents: null, children: [], breeds: 0, carried: [] }, extra || {});
const flat = v => KEYS.reduce((o, k) => (o[k] = v, o), {});

t('gate: 974485 (tip 974479 + 6), off before it, null-able', () => { assert.strictEqual(GATE0, 974485); assert.strictEqual(V.shardsOn(GATE0 - 1), false); assert.strictEqual(V.shardsOn(GATE0), true);
  V._setQuestShardsActivation(null); try { assert.strictEqual(V.shardsOn(999999999), false); } finally { V._setQuestShardsActivation(GATE0); } });
t('table [Haul, Loot] and caps', () => { assert.deepStrictEqual(JSON.parse(JSON.stringify(V.QUEST_SHARDS)), { spam: [2, 1], cold: [3, 1], kek: [4, 2], wiz: [5, 2], mine: [6, 3] }); assert.strictEqual(V.SHARD_CAP, 15); assert.strictEqual(V.SHARD_STAT_MAX, 8); });
t('a grant spreads across the two favoured stats and adds to stats', () => { const P = pet(1, 'pepe', flat(20)), Q = V.QUESTS.mine, a = V._shardGrant(P, Q, 6, sha('h1'));
  assert.strictEqual(sum(a), 6); Q.fav.forEach(k => { assert.strictEqual(P.shards[k], 3); assert.strictEqual(P.stats[k], 23); }); assert.strictEqual(V.shardSum(P), 6); assert.strictEqual(V.shardRoom(P), 9); });
t('an odd grant: the tie goes to the hash pick', () => { for (let i = 0; i < 20; i++) { const h = sha('odd' + i), P = pet(1, 'pepe', flat(20)), Q = V.QUESTS.spam, a = V._shardGrant(P, Q, 1, h);
  assert.deepStrictEqual(Object.keys(a), [Q.fav[parseInt(h.slice(16, 18), 16) % 2]]); } });
t('caps: repeated spam Hauls stop at 15 (8 + 7), then nothing', () => { const P = pet(1, 'pepe', flat(20)), Q = V.QUESTS.spam; let n = 0; for (let i = 0; i < 12; i++) { const a = V._shardGrant(P, Q, 2, sha('r' + i)); n += sum(a); }
  assert.strictEqual(n, 15); assert.strictEqual(JSON.stringify(Q.fav.map(k => P.shards[k]).sort()), '[7,8]'); assert.strictEqual(V._shardGrant(P, Q, 2, sha('x')), null); assert.strictEqual(V.shardRoom(P), 0); });
t('caps: 8 in one stat even when the other is full from another quest', () => { const P = pet(1, 'pepe', flat(20)); V._shardGrant(P, V.QUESTS.kek, 4, sha('a')); /* spark 2 luck 2 */
  for (let i = 0; i < 6; i++) V._shardGrant(P, V.QUESTS.wiz, 5, sha('b' + i)); /* spark, zoom */ assert.ok(KEYS.every(k => (P.shards[k] || 0) <= 8)); assert.strictEqual(V.shardSum(P), 15); });
t('caps: old Legendary Haul gains count toward the 15', () => { const P = pet(1, 'pepe', flat(20), { questBoost: 3 }); assert.strictEqual(V.shardRoom(P), 12); let n = 0; for (let i = 0; i < 10; i++) n += sum(V._shardGrant(P, V.QUESTS.mine, 6, sha('q' + i)));
  assert.strictEqual(n, 12); });
t('shardView: base = stats minus shards; half = base + floor(shards/2)', () => { const P = pet(1, 'pepe', { vigor: 30, spark: 25, grit: 20, zoom: 20, luck: 20 }, { shards: { vigor: 7, spark: 3 } });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(V.shardView(P, 0).stats)), { vigor: 23, spark: 22, grit: 20, zoom: 20, luck: 20 });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(V.shardView(P, 1).stats)), { vigor: 26, spark: 23, grit: 20, zoom: 20, luck: 20 }); assert.strictEqual(V.shardView(pet(2, 'pepe', flat(9)), 1).stats.vigor, 9); });

/* breeding: V.breedOne needs a world for mk(); use a tiny world shell */
function W() { return { pets: [], byId: {}, nextPet: 900000, owners: {}, log: [] }; }
const B = 974500, OWN = 'bc1qtest';
function kidOf(A, Bp, i, b) { const w = W(); try { return V.breedOne(w, A, Bp, sha('bh' + i), sha('tx' + i), b == null ? B : b, OWN); } catch (e) { throw e; } }
const capA = () => pet(11, 'pepe', { vigor: 38, spark: 37, grit: 30, zoom: 30, luck: 30 }, { shards: { vigor: 8, spark: 7 } });
const capB = () => pet(12, 'pepe', { vigor: 38, spark: 37, grit: 30, zoom: 30, luck: 30 }, { shards: { vigor: 8, spark: 7 } });
const plainB = () => pet(13, 'pepe', { vigor: 30, spark: 30, grit: 30, zoom: 30, luck: 30 });
t('breeding: the base result equals a breed of the parents without their shards', () => { for (let i = 0; i < 60; i++) { const k = kidOf(capA(), plainB(), i), k0 = kidOf(Object.assign(V.shardView(capA(), 0), { shards: undefined }), plainB(), i);
  KEYS.forEach(s => assert.strictEqual(k.stats[s] - ((k.shards || {})[s] || 0), k0.stats[s], 'hash ' + i + ' ' + s)); assert.ok(!k0.shards); } });
t('breeding: inherited points are bounded (per stat by the halves, 8 per stat, 15 total) and marked as inherited', () => { let tot = 0, n = 0;
  for (let i = 0; i < 200; i++) { const A = capA(), Bp = capB(), k = kidOf(A, Bp, i); const s = k.shards || {};
    KEYS.forEach(x => { assert.ok((s[x] || 0) <= Math.min(8, Math.floor((A.shards[x] || 0) / 2) + Math.floor((Bp.shards[x] || 0) / 2)), 'stat ' + x); });
    assert.ok(sum(s) <= 15); assert.strictEqual(k.shardsIn || 0, sum(s)); tot += sum(s); n++; }
  const avg = tot / n; console.log('     two capped parents: average inherited shard points ' + avg.toFixed(2)); assert.ok(avg > 5 && avg < 9, 'about 7'); });
t('breeding: one capped parent and one plain parent gives about 3 to 4', () => { let tot = 0; for (let i = 0; i < 200; i++) tot += sum(kidOf(capA(), plainB(), i).shards); const avg = tot / 200;
  console.log('     one capped parent: average inherited shard points ' + avg.toFixed(2)); assert.ok(avg > 2 && avg < 5.5); });
t('breeding: no shards in either parent = no shards in the egg, same stats as before the gate', () => { for (let i = 0; i < 40; i++) { const a = kidOf(plainB(), Object.assign(plainB(), { id: 14 }), i), b = kidOf(plainB(), Object.assign(plainB(), { id: 14 }), i, GATE0 - 10);
  assert.ok(!a.shards); assert.deepStrictEqual(JSON.parse(JSON.stringify(a.stats)), JSON.parse(JSON.stringify(b.stats))); } });
t('breeding before the gate: shards (if any) are ordinary stats, nothing is halved', () => { for (let i = 0; i < 40; i++) { const k = kidOf(capA(), plainB(), i, GATE0 - 10), k2 = kidOf(Object.assign(capA(), { shards: undefined }), plainB(), i, GATE0 - 10);
  assert.ok(!k.shards); assert.deepStrictEqual(JSON.parse(JSON.stringify(k.stats)), JSON.parse(JSON.stringify(k2.stats))); } });
t('safeguard: over 8 generations of capped quest parents, shard points never pass 15 and the base does not climb from shards', () => { let A = capA(), Bp = capB(); const base0 = sum(V.shardView(A, 0).stats);
  for (let g = 1; g <= 8; g++) { const k1 = kidOf(A, Bp, 'g' + g), k2 = kidOf(A, Bp, 'h' + g); [k1, k2].forEach(k => { assert.ok(V.shardSum(k) <= 15); /* quest to the cap again */ for (let i = 0; i < 10; i++) V._shardGrant(k, V.QUESTS.spam, 2, sha(g + ':' + i + k.id)); assert.ok(V.shardSum(k) <= 15); });
    k1.id = 21; k2.id = 22; A = k1; Bp = k2; }
  const baseN = sum(V.shardView(A, 0).stats); assert.ok(Math.abs(baseN - base0) <= 25, 'base drift is only the normal +/-2 per stat noise: ' + base0 + ' -> ' + baseN); });
t('twins share the same shard points', () => { const k = kidOf(capA(), capB(), 1), tw = kidOf(capA(), capB(), 2); V._shardTwin(k, tw); assert.deepStrictEqual(JSON.parse(JSON.stringify(tw.shards || null)), JSON.parse(JSON.stringify(k.shards || null)));
  const k2 = kidOf(plainB(), Object.assign(plainB(), { id: 14 }), 3), tw2 = Object.assign(kidOf(capA(), capB(), 4)); V._shardTwin(k2, tw2); assert.ok(!tw2.shards && !tw2.shardsIn); });

/* replay: snapshot 972901, quests + shards moved in memory to 972500, simulated quest burns with chosen outcomes */
t('replay: simulated quests bring shards (Haul and Loot), Cold Loot brings no spin, no old +1; gate at its real block changes nothing', () => {
  const S = L.snap('snap-972901.json'), TIP = S.tip, G = 972300, H0 = Object.assign({}, c.XCPETS_BLOCK_HASHES, S.hashes), H = b => H0[b] || sha('SIMULATED-xcpets-block:' + b);
  const real = JSON.stringify(V.replay(S.rows, H0, [], { tip: TIP, live: c.LiveEngine.RealCore }).pets.map(p => [p.id, p.stats, p.shards || null]));
  V._setQuestShardsActivation(null); const nul = JSON.stringify(V.replay(S.rows, H0, [], { tip: TIP, live: c.LiveEngine.RealCore }).pets.map(p => [p.id, p.stats, p.shards || null])); V._setQuestShardsActivation(GATE0);
  assert.strictEqual(real, nul, 'gate at 974485 vs null: identical pets on 972901');
  const QG = V.questGate ? V.questGate() : null; V._setQuestActivation(G); V._setQuestShardsActivation(G);
  try { const w0 = V.replay(S.rows.filter(r => r.block_index < G), H0, [], { tip: G - 1, live: c.LiveEngine.RealCore });
    const myth = w0.pets.filter(p => !p.dead && !p.community && !p.released && V.isMythic(p) && !V.questBusyWhy(p, G)).slice(0, 3); assert.ok(myth.length >= 3, 'three Mythics at the gate');
    const hx = s => Buffer.from(s, 'utf8').toString('hex'), R = (bh, tx, id) => parseInt(sha(bh + tx + id + 'quest').slice(0, 8), 16) % 10000, AMB = (bh, tx, id) => parseInt(sha(bh + tx + id + 'quest').slice(8, 16), 16) % 69 === 0;
    let nn = 0, ti = 8e8; const rows = [], hs = Object.assign({}, H0); for (let b = G; b <= TIP; b++) if (!hs[b]) hs[b] = H(b);
    function send(p, code, b, want) { const end = b + V.QUESTS[code].len; let tx; do { tx = sha('SIMULATED-shards:' + (nn++)); } while (!want(R(hs[end], tx, p.id), AMB(hs[end], tx, p.id)));
      rows.push({ tx_index: ti++, tx_hash: tx, block_index: b, source: p.owner, asset: 'XCPETS', quantity: Math.round(V.questPlan(p.id, code, w0, b).amount * 1e8), tag: hx('pet:quest:' + p.id + ':' + code), status: 'valid' }); }
    const [a, bq, cq] = myth; send(a, 'spam', G + 1, (r, am) => r < 1500 && !am); send(bq, 'cold', G + 2, (r, am) => r > 2600 && r < 6500 && !am); send(cq, 'kek', G + 3, (r, am) => r < 1000 && !am);
    const all = S.rows.concat(rows).sort((x, y) => x.block_index - y.block_index || x.tx_index - y.tx_index), w = V.replay(all, hs, [], { tip: TIP, live: c.LiveEngine.RealCore });
    const A1 = w.byId[a.id], B1 = w.byId[bq.id], C1 = w.byId[cq.id];
    if (!A1.questHist || !A1.questHist[0]) console.log('     debug', JSON.stringify((w.log || []).filter(l => rows.some(r => r.tx_hash === l.tx)).slice(0, 5)).slice(0, 600));
    const ha = A1.questHist[0]; assert.strictEqual(ha.tier, 'haul'); assert.strictEqual(sum(ha.shards), 2); assert.ok(!ha.boost, 'no old +1'); assert.strictEqual(A1.questBoost || 0, a.questBoost || 0);
    KEYS.forEach(k => assert.strictEqual(A1.stats[k] - ((A1.shards || {})[k] || 0), a.stats[k], 'base stat ' + k + ' unchanged'));
    const hb = B1.questHist[0]; assert.strictEqual(hb.tier, 'loot'); assert.strictEqual(sum(hb.shards), 1); assert.ok(!hb.rewards.some(r => r.kind === 'spins'), 'Cold Loot: no saved spin');
    const hc = C1.questHist[0]; assert.strictEqual(hc.tier, 'haul'); assert.strictEqual(sum(hc.shards), Math.min(4, 15 - (cq.questBoost || 0)));
    assert.ok((w.log || []).some(l => /shard point/.test(l.text || l.msg || JSON.stringify(l))), 'log line names the shard points');
    V._setQuestShardsActivation(null); const w2 = V.replay(all, hs, [], { tip: TIP, live: c.LiveEngine.RealCore }); const A2 = w2.byId[a.id];
    assert.ok(!A2.shards && A2.questHist[0].boost, 'shard gate off: the old Haul +1 is back'); assert.ok(w2.byId[bq.id].questHist[0].rewards.some(r => r.kind === 'spins'), 'shard gate off: Cold Loot spin is back');
  } finally { V._setQuestShardsActivation(GATE0); V._setQuestActivation(QG); } });

t('rules.html: Power Shards section and rule history line, gate markers', () => { const h = rd('rules.html'); assert.ok(/id="power-shards"/.test(h)); assert.ok(/QUEST-SHARDS-GATE -->974,485/.test(h)); assert.ok(/QUEST-SHARDS-GATE -->:/.test(h));
  assert.ok(/half strength/.test(h) && /15 shard points per pet/.test(h)); });
t('wording rules on every added line (no "series", "discount", "price"; "times", not "x")', () => { let d = ''; try { d = execSync('git diff origin/main -- js css rules.html tools/quest-shards-test.js', { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 }); } catch (e) { return; }
  const added = d.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++') && /shard|Shard/.test(l) && !/wording rules/.test(l));
  added.forEach(l => { assert.ok(!/\bseries\b|\bdiscount|\bprices?\b/i.test(l), 'banned word: ' + l.slice(0, 120)); assert.ok(!/\d\s?x\b|\bx\d/.test(l.replace(/0x[0-9a-f]+/gi, '').replace(/\bhex\b/g, '')), '"x" for times: ' + l.slice(0, 120)); }); });
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exitCode = fail ? 1 : 0;
