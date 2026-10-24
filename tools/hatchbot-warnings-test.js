#!/usr/bin/env node
/* Tests for tools/hatchbot-warnings.js with a FAKE send (nothing goes to Telegram). Uses HatchBot's real send-guard when present. */
'use strict';
const fs = require('fs'), path = require('path'), H = require('./hatchbot-warnings'), { load, snap, run } = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const GP = process.env.XCPETS_SEND_GUARD || '/workspace/xcpets/telegram/send-guard.js' /* optional: HatchBot's guard lives outside the repo; the fallback below runs on a fresh checkout */, guard = fs.existsSync(GP) ? require(GP) : { announceViolations: t => (/price|wagmi/i.test(t) ? ['banned'] : []) };
const c = load(), V = c.V2Rules, S = snap(), live = run(c, S, [], S.tip);
const mk = () => { let st = { posts: [] }; return { load: () => JSON.parse(JSON.stringify(st)), save: o => { st = JSON.parse(JSON.stringify(o)); }, get: () => st }; };
const fake = () => { const sent = []; return { sent, send: async t => { sent.push(t); return { message_id: sent.length }; } }; };
(async () => {
  ok(H.ENABLED === false, 'hooks are OFF by default (ENABLED=false)');
  { const r = mk(), f = fake(); const x = await H.tick({ w: { kek: { fed: 6.9e6 } }, tip: 1, V, enabled: true, rate: r, guard, send: f.send }); ok(x.reason === 'disabled' && f.sent.length === 0, 'flag off: nothing sent even with enabled:true'); }
  const T = o => Object.assign({ forceEnabledForTest: true, enabled: true, V, guard }, o);
  ok(H.events(live, S.tip, V).length === 0, 'live chain now (care ' + Math.floor(live.kek ? live.kek.fed : 0) + ', not 90%): no warnings due');
  { const r = mk(), f = fake(); let x = await H.tick(T({ w: { kek: { fed: 6216210 } }, tip: 2, rate: r, send: f.send }));
    ok(x.posted.join() === 'HB-KEKCARE-90' && f.sent.length === 1, '90% crossing posts once');
    x = await H.tick(T({ w: { kek: { fed: 6300000 } }, tip: 3, rate: r, send: f.send })); ok(x.posted.length === 0 && f.sent.length === 1, 'dedupe: 90% not posted again');
    x = await H.tick(T({ w: { kek: { fed: 6840000 } }, tip: 4, rate: r, send: f.send })); ok(x.posted.join() === 'HB-KEKCARE-99', '99% crossing posts once');
    const km = { block: 973100, tx: 't' }; x = await H.tick(T({ w: { kek: { fed: 6906900 }, kekMythic: km }, tip: 973100, rate: r, send: f.send }));
    ok(x.posted.join() === 'HB-HALVING1-SET-973100' && /block 973,106/.test(f.sent[2]), 'Mythic reached: "halving set" with the halving block');
    x = await H.tick(T({ w: { kek: { fed: 6906900 }, kekMythic: km }, tip: 973101, rate: r, send: f.send })); ok(x.posted.length === 0 && f.sent.length === 3, 'set posted once');
    ok(r.get().posts.every(p => p.priority === 'auto-warning'), 'every post recorded in announce-rate.json'); }
  { const r = mk(), f = fake(); const x = await H.tick(T({ w: { kek: { fed: 6906900 }, kekMythic: { block: 973100 } }, tip: 973100, rate: r, send: f.send }));
    ok(f.sent.length === 1 && x.posted[0].startsWith('HB-HALVING1-SET'), 'late watcher: only the newest step posts (no stale 90/99)'); }
  { const r = mk(), f = fake(); const x = await H.tick(T({ w: { kek: { fed: 6850000 } }, tip: 5, rate: r, send: f.send }));
    ok(x.posted.join() === 'HB-KEKCARE-99' && x.skipped.join() === 'HB-KEKCARE-90', 'jump past 90 straight to 99: 99 posts, 90 recorded as skipped'); }
  { const V2 = Object.assign({}, V, { halvingBlocks: () => [973106, 980006] }), w = { kek: { fed: 6906900 }, kekMythic: { block: 973100 } }, r = mk(), f = fake();
    r.save({ posts: [{ id: 'HB-HALVING1-SET-973100', t: 0 }] });
    let x = await H.tick(T({ V: V2, w, tip: 975000, rate: r, send: f.send })); ok(x.posted.join() === 'HB-HALVING2-980006-SET', 'halving 2 set');
    x = await H.tick(T({ V: V2, w, tip: 979862, rate: r, send: f.send })); ok(x.posted.join() === 'HB-HALVING2-980006-DAY', 'halving 2: about a day (144 blocks)');
    x = await H.tick(T({ V: V2, w, tip: 980000, rate: r, send: f.send })); ok(x.posted.join() === 'HB-HALVING2-980006-SOON', 'halving 2: 6 blocks');
    x = await H.tick(T({ V: V2, w, tip: 980006, rate: r, send: f.send })); ok(x.posted.length === 0, 'nothing after halving 2 starts'); }
  { const r = mk(), f = fake(), bad = Object.assign({}, guard, { announceViolations: () => ['test block'] });
    const x = await H.tick(T({ w: { kek: { fed: 6216210 } }, tip: 2, rate: r, send: f.send, guard: bad })); ok(f.sent.length === 0 && x.blocked.length === 1 && !r.get().posts.length, 'guard violation: not sent, not marked posted'); }
  { const t = H.halvingTexts(), all = [t.care90(6216210), t.care99(6837831), t.set1(973100, 973106), t.setN(2, 980006), t.dayN(2, 980006), t.soonN(12, 980006)];
    try { const F = require('./hatchbot-firesale'), m = F.messages({ arm: 973500, start: 973506, end: 973542 }, 973500); all.push(m.warning.text, m.start.text); } catch (e) { }
    ok(all.every(s => s.length <= 1000 && !guard.announceViolations(s).length && !/\d\s?x\b|\bx\s?\d|wagmi/i.test(s)), 'every warning text passes send-guard, <= 1,000 chars, no "x", no WAGMI (' + all.length + ' texts)'); }
  if (V.fireInfo) await require('./hatchbot-warnings-fire-test')({ ok, H, V, guard, mk, fake, T });
  console.log('hatchbot-warnings-test: ' + pass + '/' + (pass + fail) + (fail ? ' FAIL' : ' pass')); process.exit(fail ? 1 : 0); })();
