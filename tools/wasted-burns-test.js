#!/usr/bin/env node
/* wasted-burns-test (Nov 25 2026): guards for the burns a full replay of the real chain showed the game ignored, rejected or overcharged.
 * Each block below names the real case it stands for.   node tools/wasted-burns-test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const REPO = path.resolve(__dirname, '..'), rd = f => fs.readFileSync(path.join(REPO, f), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const between = (src, a, b) => { const i = src.indexOf(a); if (i < 0) throw new Error('missing ' + a); const j = src.indexOf(b, i); if (j < 0) throw new Error('missing ' + b); return src.slice(i, j); };

/* 1. The pre-sign check on fast pages knows this wallet's own burns that are still on their way.
 *    Real cases: Evan's breed accept sent twice in one run (977,453), a breed with a pet whose other breed was still waiting (977,509),
 *    a zombie meal for a pet whose Resurrection was still waiting (977,092). The server and the device check were asked with pending: []. */
const sp = rd('js/v2-split.js');
ok(!/pending:\s*\[\]/.test(sp), 'v2-split.js: no pre-sign check is asked with an empty pending list');
ok(/\/xp\/v1\/check[\s\S]{0,300}pending: pendingForCheck\(null\)/.test(sp), 'server check sends the pending list');
ok(/cmd: 'check'[^\n]*pending: pendingForCheck\(checkedTip\)/.test(sp), 'device check sends the pending list (plus my burns newer than its world)');
{ const code = between(sp, '  function tagText(t)', '  function deviceCheck(plans)');
  const ctx = vm.createContext({ window: {} });
  ctx.window.V2UI = { myPendingTags: () => ['pet:breed:16857:19975'] };
  ctx.window.V2Mock = { state: () => ({ rows: [
    { source: 'me', block_index: 100, tag: 'pet:feed:5' },
    { source: 'me', block_index: 103, tag: '7065743a72657375727265637414' === 'x' ? '' : '7065743a726573757272656374' + Buffer.from(':14196').toString('hex') },
    { source: 'them', block_index: 104, tag: 'pet:feed:9' }] }) };
  vm.runInContext('function pageWallet() { return "me"; }\n' + code + '\nthis.P = pendingForCheck;', ctx);
  const a = ctx.P(101); ok(a.includes('pet:breed:16857:19975'), 'unconfirmed burns are pending'); ok(a.includes('pet:resurrect:14196'), 'my confirmed burn newer than the check world is pending (hex tag decoded)');
  ok(!a.includes('pet:feed:5'), 'a burn already inside the check world is not pending'); ok(!a.includes('pet:feed:9'), "another wallet's burn is not pending");
  ok(ctx.P(0).length === 1, 'no check world yet: only the unconfirmed burns'); }

/* 2. Fire Sale end: a plan already at full cost is not divided by 0.31 again (block 977,493: a 2-pet meal of 17.25 went out as 55.65). */
{ const v2 = rd('js/v2.js'), code = between(v2, '  var FIRE_END_WARN', '  function fireEndNote(fe)');
  const sale = { start: 900, end: 930 };
  const ctx = vm.createContext({});
  vm.runInContext('var S = { tip: 926 }; var V = { fireInfo: function (w, t) { var b = t + 1, s = ' + JSON.stringify(sale) + '; return { live: b >= s.start && b < s.end ? s : null, nextBlock: b }; },' +
    ' parseTag: function (g) { var p = g.split(":"); return p[1] === "fm" ? { action: "feedm" } : p[1] === "feed" ? { action: "feed", petId: +p[2] } : p[1] === "hatchzap" ? { action: "zap" } : { action: p[1] }; },' +
    ' planAmount: function (w, p, b) { return /hatchzap/.test(p.tag) && b >= 930 ? Object.assign({}, p, { amount: 12500 }) : p; } };\n' + code + '\nthis.F = fireEndPlans;', ctx);
  const w = { byId: { 1: { nextMeal: 2.67375 }, 2: { nextMeal: 2.67375 } } };
  let fe = ctx.F(w, [{ tag: 'pet:fm:1:1', amount: 17.25, petIds: [1, 2] }]);
  ok(fe === null, 'a 2-pet meal already at full cost (17.25) is not raised to 55.65');
  fe = ctx.F(w, [{ tag: 'pet:fm:1:1', amount: 5.3475, petIds: [1, 2] }]);
  ok(fe && fe.full[0].amount > 17.24 && fe.full[0].amount < 17.26, 'a 2-pet meal at the sale cost is raised to the full cost (' + (fe && fe.full[0].amount) + ')');
  fe = ctx.F(w, [{ tag: 'pet:hatchzap', amount: 3875 }]);
  ok(fe && fe.full[0].amount === 12500, 'an Electric Egg case at the sale cost gets the rules full cost 12,500 (' + (fe && fe.full[0].amount) + ')');
  ok(ctx.F(w, [{ tag: 'pet:hatchzap', amount: 12500 }]) === null, 'an Electric Egg case already at 12,500 is left alone'); }

console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
