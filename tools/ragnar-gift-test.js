// Ragnar Vigor gift (js/v2-rules.js ragnarGift, ACTIVATE_RAGNAR_GIFT_BLOCK). Offline, nothing is signed.
// Replays api/boot.json the way the server's world builder does (tools/sync-server/snapshot.js), twice: gift OFF (null) and gift moved to the
// boot tip, then compares every pet. Only Ragnar Kekbeard #73324 (gains a Vigor 33 carry) and Naking #205411 (Vigor -> 33) may change.
// node tools/ragnar-gift-test.js [--boot api/boot.json]   (two full replays, ~2 GB memory each)
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const S = require('./sync-server/snapshot');
const ROOT = path.resolve(__dirname, '..'), A = process.argv.slice(2), bootF = A.indexOf('--boot') >= 0 ? A[A.indexOf('--boot') + 1] : path.join(ROOT, 'api/boot.json');
const boot = JSON.parse(fs.readFileSync(bootF, 'utf8'));
function knownHashes() { const x = { window: {} }; x.window.window = x.window; x.self = x.window; vm.createContext(x); vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/block-hashes.js'), 'utf8'), x); return x.window.XCPETS_BLOCK_HASHES || x.XCPETS_BLOCK_HASHES || {}; }
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const H = Object.assign({}, knownHashes(), boot.hashes);
const ctx = S.workerFns(), w = S.replayWorld(ctx, boot.rows, H, boot.tip, boot.dex || null), V = ctx.V2Rules, G0 = V.ACTIVATE_RAGNAR_GIFT_BLOCK;
ok(G0 === 977520 && V.RAGNAR_GIFT.pet === 73324 && V.RAGNAR_GIFT.value === 33, 'gate 977,520, Ragnar #73324, Vigor 33');
ok(boot.tip < G0 && !w.ragnarGift, 'boot tip ' + boot.tip + ' is before the gate: the gift has not fired, the live world is unchanged until then');
const sig = p => JSON.stringify({ stats: p.stats, carried: p.carried || [], owner: p.owner, species: p.species, dead: !!p.dead, stage: p.stage, tier: p.tier });
const before = {}; w.pets.forEach(p => { before[p.id] = sig(p); }); const nV = w.byId[205411].stats.vigor, nOther = Object.assign({}, w.byId[205411].stats), logN = w.log.length;
V.ragnarGift(w, G0 - 1); ok(!w.ragnarGift, 'one block before the gate: nothing happens');
V.ragnarGift(w, G0); ok(w.ragnarGift === G0, 'at the gate: the gift fires once');
const changed = w.pets.filter(p => before[p.id] !== sig(p)).map(p => p.id).sort((a, b) => a - b);
console.log('     pets that change: ' + JSON.stringify(changed));
ok(JSON.stringify(changed) === '[73324,205411]', 'only Ragnar #73324 and Naking #205411 change');
const after = sig(w.byId[73324]); V.ragnarGift(w, G0 + 10); ok(sig(w.byId[73324]) === after, 'never fires twice');
const byOn = w.byId, byOff = { 205411: { stats: nOther } };
const R = byOn[73324], N = byOn[205411];
ok(R && (R.carried || []).some(c => c.stat === 'vigor' && c.value === 33 && c.from === 93702 && c.gift), 'Ragnar carries Vigor 33 from Ladoyupip #93702 ' + JSON.stringify(R && R.carried));
ok(N && N.stats.vigor === 33 && nV === 25, 'Naking Vigor 25 -> 33');
['spark', 'grit', 'zoom', 'luck'].forEach(k => ok(N.stats[k] === byOff[205411].stats[k], 'Naking ' + k + ' unchanged (' + N.stats[k] + ')'));
ok(w.log.length === logN, 'adds no log entries');
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
