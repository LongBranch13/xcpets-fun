#!/usr/bin/env node
/* retire-tags (go-live Nov 1 2026 [pt2580u], md items 1-8): ONE shared gate ACTIVATE_RETIRE_TAGS_BLOCK retires pet:rel, pet:roll:ID, pet:fa/fx/fy, pet:sk/su,
 * pet:fl, pet:sd/tt/join, Rug Me (pet:ad/rug/unad; open ads close), pet:aura, pet:sign. Checks:
 *   1. the gate in the code is a block number and equals ACTIVATE_DAILY_CHORES_BLOCK; keep-list tags are never retired.
 *   2. below the gate every retired tag replays exactly as before (past effects stay); full replay identical with the gate on or off.
 *   3. at / after the gate every retired tag is rejected as community food (credited to the pot like any unknown tag, no other effect).
 *   4. open Rug Me ads close at the gate; the send guard blocks retired tags; the feed planner stops offering pet:fl / fa / fx / fy.
 *   5. pet:dc (daily chores) works after its gate while retired tags are rejected.   node tools/retire-tags-test.js [--boot FILE] */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { load, ROOT } = require('./lib/load-rules');
const A = process.argv.slice(2), opt = k => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : null; };
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const hex = s => Buffer.from(s, 'utf8').toString('hex'), unhex = h => Buffer.from(h, 'hex').toString('utf8');
const ctx = load(), V = ctx.V2Rules, E = ctx.LiveEngine;
const G0 = V.retireGate(), C0 = V.dailyChoresGate();
/* 1. gate in the code */
ok(Number.isInteger(G0) && G0 === C0, 'gate in the code: ACTIVATE_RETIRE_TAGS_BLOCK = ' + G0 + ' = ACTIVATE_DAILY_CHORES_BLOCK (' + C0 + ')');
ok(V.retireOn(G0) && !V.retireOn(G0 - 1), 'retireOn: on from ' + G0 + ', off at ' + (G0 - 1));
const KEEP = ['pet:feed:12', 'pet:fm:1.2.3', 'pet:fr:A1:05', 'pet:wagmi', 'pet:spin', 'pet:usespin:all', 'pet:breed:1:2', 'pet:accept:3', 'pet:fight:1:2', 'pet:look:12:ab',
  'pet:c:roll', 'pet:dc:3', 'pet:ar:12', 'pet:sr:12', 'pet:zr:12', 'pet:seance:12', 'pet:unleash:12'];
ok(KEEP.every(t => !V.retiredAt(V.parseTag(t), 9e9)), 'keep list never retired (' + KEEP.map(t => V.parseTag(t).action).join(', ') + ')');
/* live world */
const boot = JSON.parse(fs.readFileSync(path.resolve(opt('--boot') || path.join(ROOT, 'api', 'boot.json')), 'utf8'));
const rows = boot.rows.slice().sort((a, b) => a.block_index - b.block_index || a.tx_index - b.tx_index), tip = boot.tip || rows[rows.length - 1].block_index, nb = tip + 1, G = nb + 1;
const hashes = Object.assign({}, ctx.XCPETS_BLOCK_HASHES || {}, boot.hashes || {}); [nb, G, G + 1, G + 2].forEach(b => { if (!hashes[b]) hashes[b] = crypto.createHash('sha256').update('fake-block-' + b).digest('hex'); });
const opts = t => ({ tip: t, live: E && E.RealCore, dex: boot.dex }); let txi = rows[rows.length - 1].tx_index + 1;
const mk = (b, src, amt, tag, seed) => ({ tx_index: txi++, tx_hash: crypto.createHash('sha256').update('rt-test:' + (seed || tag) + ':' + b + ':' + txi).digest('hex'), block_index: b, source: src, asset: 'XCPETS', quantity: Math.round(amt * 1e8), tag: hex(tag), status: 'valid' });
const strip = x => JSON.stringify({ wagmi: x.wagmi, spins: x.spins, ads: x.ads, fights: x.fights, pets: x.pets.map(p => [p.id, p.owner, p.care, p.lastFed, p.released, p.dead, p.skipBy, p.aura, p.gear]), c: x.community.burned });
const stripLog = x => JSON.stringify(x.log.map(l => [l.tx, l.kind, l.msg]));
/* 2a. full replay: gate on at tip + 1 vs off */
V._setRetireActivation(null); const w0 = V.replay(rows, hashes, [], opts(tip));
V._setRetireActivation(nb); const w1 = V.replay(rows, hashes, [], opts(tip));
ok(strip(w0) === strip(w1) && stripLog(w0) === stripLog(w1), 'full replay of ' + rows.length + ' burns: identical with the gate at tip + 1 or off (past effects stay)');
/* sample tags: the latest real burn of each retired action, re-sent by the same wallet */
const sample = {}; rows.forEach(r => { let s; try { s = unhex(r.tag); } catch (e) { return; } const t = V.parseTag(s); if (t && V.RETIRED_ACTIONS[t.action]) sample[t.action] = { tag: s, src: r.source, amt: r.quantity / 1e8 }; });
const owner = Object.keys(w0.pets.reduce((m, p) => { if (p.owner && !p.dead && !p.released && !p.community) m[p.owner] = 1; return m; }, {}))[0];
const mine = w0.pets.filter(p => p.owner === owner && !p.dead && !p.released), pa = mine[0] ? mine[0].id : 1, pb = mine[1] ? mine[1].id : 2;
[['sd', 'pet:sd:' + pa + ':' + pb], ['tt', 'pet:tt:' + pa + '.' + pb + ':' + pa + '.' + pb], ['join', 'pet:join:1:' + pa], ['unad', 'pet:unad:1'], ['release', 'pet:rel:' + pa], ['rug', 'pet:rug:' + pa + ':1'], ['wsign', 'pet:sign']]
  .forEach(([k, tag]) => { if (!sample[k]) sample[k] = { tag, src: owner, amt: 1 }; });
ok(Object.keys(V.RETIRED_ACTIONS).every(k => sample[k] && V.parseTag(sample[k].tag).action === k), 'a sample burn for every retired action (' + Object.keys(V.RETIRED_ACTIONS).length + ': ' + Object.keys(sample).map(k => sample[k].tag.split(':').slice(0, 2).join(':')).join(', ') + ')');
/* 2b / 3: all samples in one block, replayed together (few replays keep the test fast) */
const K = Object.keys(V.RETIRED_ACTIONS).filter(k => sample[k]);
const pre = K.map(k => mk(nb, sample[k].src, sample[k].amt, sample[k].tag, 'pre-' + k));
V._setRetireActivation(null); const a0 = V.replay(rows.concat(pre), hashes, [], opts(nb));
V._setRetireActivation(G); const a1 = V.replay(rows.concat(pre), hashes, [], opts(nb));
ok(strip(a0) === strip(a1) && stripLog(a0) === stripLog(a1) && !a1.log.some(x => /was retired/.test(x.msg || '')), K.length + ' retired-tag burns at ' + nb + ' (below the gate ' + G + '): world and log the same as with no gate');
const at = K.map(k => mk(G, sample[k].src, sample[k].amt, sample[k].tag, 'at-' + k)), unk = at.map(r => Object.assign({}, r, { tag: hex('pet:zz:9') }));
const b1 = V.replay(rows.concat(at), hashes, [], opts(G)), b2 = V.replay(rows.concat(unk), hashes, [], opts(G));
K.forEach((k, i) => { const la = b1.log.filter(x => x.tx === at[i].tx_hash);
  ok(la.length === 1 && la[0].kind === 'rejected' && /was retired at block \d+ \(community food\)/.test(la[0].msg), sample[k].tag.slice(0, 26) + ' at ' + G + ' (the gate): rejected [' + (la[0] && la[0].msg) + ']');
  ok(/was retired at block/.test(V.sendBlock(w0, { tag: sample[k].tag, amount: sample[k].amt }, G - 1, { me: sample[k].src }) || ''), '  ... send guard blocks it once the next block is the gate'); });
const sum = K.reduce((t, k) => t + sample[k].amt, 0);
ok(strip(b1) === strip(b2) && Math.abs(b1.community.burned - w0.community.burned - sum) < 1e-6, 'at the gate: all ' + K.length + ' burns are community food (+' + sum.toFixed(8) + '), world identical to the same burns with an unknown pet: tag');
/* 4. open ads close at the gate */
V._setRetireActivation(G);
const ap = mine.find(p => p.stage >= 3) || mine[0], fake = { state: 'open', pet: ap.id, owner: owner, block: G - 2, id: 999 };
const aw = Object.assign({}, w0, { ads: (w0.ads || []).concat([fake]) });
ok(V.adState(aw, fake, G - 1) === 'open' && V.adState(aw, fake, G) === 'closed', 'Rug Me: an open ad is open at ' + (G - 1) + ', closed at the gate ' + G);
ok(V.openAds(aw, G - 1).length === 0 && !V.onRug(aw, ap, G), 'Rug Me: no open ads (and no pet on the rug) from the gate on');
ok(V.retiredUI({ tip: G - 1 }) && !V.retiredUI({ tip: G - 2 }), 'retiredUI(world): hides the retired buttons once the next block is the gate');
/* feed planner after the gate: no pet:fl / fa / fx / fy / sk / su */
let bad = 0, nq = 0; Object.keys(w0.pets.reduce((m, p) => { if (p.owner && p.hungry) m[p.owner] = 1; return m; }, {})).slice(0, 40).forEach(o => { const q = V.feedQueue(w0, o, null, G) || []; (q.plans || q).forEach(x => { nq++; if (/^pet:(fl|fa|fx|fy|sk|su)(:|$)/.test(x.tag || '')) bad++; }); });
ok(bad === 0, 'feed planner at the gate offers no retired feed tags (' + nq + ' planned burns checked)');
V._setRetireActivation(nb); ok(!V.feedAllOn || !V.feedAllOn(tip), 'feed-all (pet:fa) button off once the gate is the next block');
/* 5. pet:dc works after its gate, retired tags rejected in the same block */
V._setRetireActivation(G); V._setDailyChoresActivation(G);
const said = o => !!(w0.wagmi[o] && w0.wagmi[o][V.day(G)]), dcO = Object.keys(w0.pets.reduce((m, p) => { if (p.owner && !p.dead) m[p.owner] = 1; return m; }, {})).find(o => !said(o)) || owner;
const dc = mk(G, dcO, 0.00000001, 'pet:dc:1'), fl = mk(G, sample.feedl.src, sample.feedl.amt, sample.feedl.tag, 'dc-fl'), w5 = V.replay(rows.concat([dc, fl]), hashes, [], opts(G));
ok(w5.log.some(x => x.tx === dc.tx_hash && x.kind === 'chores') && !!(w5.wagmi[dcO] && w5.wagmi[dcO][V.day(G)]), 'pet:dc:1 at its gate ' + G + ': chores burn works (WAGMI counted)');
ok(w5.log.some(x => x.tx === fl.tx_hash && x.kind === 'rejected' && /was retired/.test(x.msg)), 'pet:fl in the same block: retired (community food)');
V._setRetireActivation(G0); V._setDailyChoresActivation(C0);
console.log('\n' + (fails ? fails + ' FAILED' : 'all ok') + '  (gates in the code: retire ' + V.retireGate() + ', chores ' + V.dailyChoresGate() + ')'); process.exitCode = fails ? 1 : 0;
