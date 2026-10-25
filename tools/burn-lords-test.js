#!/usr/bin/env node
/* Burn Lords tests (dev only, preview branch burn-lords): gate null = inert, exactly 3 Legendary Kek x Wizard hybrids (both ways) to the top 3
 * burners at the gate, one time only, ranking frozen before the gate, tie-break, edition flag not inherited. node tools/burn-lords-test.js [--json OUT] */
'use strict';
const fs = require('fs');
const { load, row, snap, run } = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const c = load(), V = c.V2Rules, s0 = snap(), H = Object.assign({}, c.XCPETS_BLOCK_HASHES, s0.hashes);
/* gate = the newest burn block that has a known hash (stands in for 'gate at current tip'); rows after it dropped */
const tip = Math.max.apply(null, s0.rows.map(r => r.block_index).filter(b => H[b])), s = { tip, rows: s0.rows.filter(r => r.block_index <= tip), hashes: s0.hashes };
ok(V.burnLordsSnapshot() === 973300, 'snapshot block 973,300');
const w0 = run(c, s, [], tip); ok(!w0.pets.some(p => p.burnLord), 'before 973,301: no Burn Lord pets');
V._setBurnLordsSnapshot(tip); const w1 = run(c, s, [], tip); ok(!w1.pets.some(p => p.burnLord) && w1.pets.length === w0.pets.length, 'grant block not reached yet: nothing changes');
ok(H[tip], 'snapshot has the tip block hash'); /* snapshot = tip-1 -> grant at the tip block (it has a burn row + hash); burns IN the tip block are after the snapshot */
const sm = s.rows.filter(r => r.block_index < tip).reduce((m, r) => Math.max(m, r.block_index), 0); V._setBurnLordsSnapshot(sm); const pre = Object.assign({}, s, { rows: s.rows.filter(r => r.block_index <= sm) }); const wpre = run(c, pre, [], sm); const w = run(c, s, [], tip), BL = w.pets.filter(p => p.burnLord);
ok(BL.length === 3, 'exactly 3 Burn Lord pets (' + BL.length + ')');
const top = Object.keys(wpre.burnedBy).filter(a => wpre.burnedBy[a] > 0).sort((a, b) => wpre.burnedBy[b] - wpre.burnedBy[a]).slice(0, 3);
ok(BL.map(p => p.owner).join() === top.join(), 'owners = top 3 by burnedBy, rank order');
BL.forEach((p, i) => { ok(p.tier === 3, '#' + p.id + ' Legendary'); ok(p.species === 'hyb:kek:wizard' && p.hybrid.shape === 'kek' && p.hybrid.color === 'kek' && p.hybrid.kekBlue === true && p.art.species === 'kek', '#' + p.id + ' body = blue Lord Kek (Kekzard) ' + p.species);
  ok(p.burnLord.n === i + 1 && p.burnLord.of === 3 && p.burnLord.gate === sm, '#' + p.id + ' edition ' + (i + 1) + ' of 3'); ok(p.hatchBlock === tip, 'born at the first block after the snapshot'); });
ok(new Set(BL.map(p => p.id)).size === 3 && BL[1].id === BL[0].id + 1 && BL[2].id === BL[1].id + 1, 'ids consecutive in rank order');
/* one time: later burns at/after the gate never re-grant or re-rank */
const big = row(tip, 'bc1qburnlordtestxxxxxxxxxxxxxxxxxxxxxxxx', 9e9, 'PET:HATCH'); const w2 = run(c, s, [big], tip + 5);
ok(w2.pets.filter(p => p.burnLord).length === 3 && !w2.pets.some(p => p.burnLord && p.owner === big.source), 'a huge burn after the snapshot block gets nothing; still 3');
const w3 = run(c, s, [row(sm, 'bc1qburnlordtestyyyyyyyyyyyyyyyyyyyyyyyy', 9e9, 'PET:HATCH')], tip);
ok(w3.pets.filter(p => p.burnLord)[0].owner === 'bc1qburnlordtestyyyyyyyyyyyyyyyyyyyyyyyy', 'a burn IN the snapshot block counts');
/* tie-break: equal totals -> earlier first burn, then address */
const tw = { burnedBy: { zz: 5, aa: 5, mm: 7, bb: 5 } }; ok(V.burnLordsRank(tw).map(x => x.address).join() === 'mm,zz,aa', 'tie: earlier first burn wins (zz before aa)');
/* both ways: across many gate hashes both orders appear, always Legendary */
const keys = {}; for (let i = 0; i < 64; i++) { const a = V.burnLordArt(require('crypto').createHash('sha256').update('g' + i).digest('hex'), 1 + i % 3, 990000); keys[a.key] = 1; ok(a.art.tierIndex === 3 && a.art.hybrid.shape === 'kek' && a.art.hybrid.kekBlue, 'art Legendary blue Kek body'); }
ok(Object.keys(keys).join() === 'hyb:kek:wizard', 'never the Wikek flip: always hyb:kek:wizard');
/* not inherited: breedOne builds kids without burnLord */
const src = fs.readFileSync(require('path').join(__dirname, '..', 'js', 'v2-rules.js'), 'utf8'); const bo = src.slice(src.indexOf('function breedOne('), src.indexOf('function breed(w,'));
ok(bo.length > 100 && !/burnLord/.test(bo), 'breedOne never copies burnLord (offspring never get the edition)');
ok(!/kekBlue/.test(bo), 'breeding never sets kekBlue');
const bd = V.breederBadges(w, BL[0]); ok(bd.some(b => b.name === 'Burn Lord' && /1 of 3/.test(b.tip)), 'Burn Lord badge with edition');
V._setBurnLordsSnapshot(973300);
const J = process.argv.indexOf('--json'); if (J > 0) fs.writeFileSync(process.argv[J + 1], JSON.stringify({ tip, snapshot: sm, top: BL.map(p => ({ id: p.id, owner: p.owner, total: p.burnLord.total, species: p.species, name: p.name, label: V.speciesLabel(p.species), edition: p.burnLord })), pets: BL }, null, 1));
console.log((fail ? 'FAILED ' : 'ALL PASS ') + pass + ' pass, ' + fail + ' fail');
process.exitCode = fail ? 1 : 0;
