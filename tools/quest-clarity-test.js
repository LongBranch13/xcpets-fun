#!/usr/bin/env node
/* quest-clarity-1103: the quest outcome list (js/v2-quest-clarity.js) uses the rule numbers from js/v2-rules.js, and its mirrored constants match. */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert'), L = require('./lib/load-rules');
const src = fs.readFileSync(path.join(L.ROOT, 'js/v2-rules.js'), 'utf8');
const num = n => { const m = new RegExp('\\b' + n + '\\s*=\\s*(\\d+)').exec(src); assert(m, 'no ' + n + ' in v2-rules.js'); return +m[1]; };
const c = L.load(['js/v2-quest-clarity.js']), M = c.V2QuestClarity.MIRROR, R = c.V2Rules;
assert.strictEqual(M.QUEST_STAT_CAP, num('QUEST_STAT_CAP')); assert.strictEqual(M.AMBUSH_1_IN, num('AMBUSH_1_IN'));
assert(/% AMBUSH_1_IN < \(isFT \? 2 : 1\)/.test(src), 'FUNTRUMP ambush 2 in 69 changed');
const J = /var JACKPOT = \{ twin1In: (\d+), mutation1In: (\d+), hidden1In: (\d+), legMix1In: (\d+) \}/.exec(src); assert(J, 'no JACKPOT');
assert.deepStrictEqual([M.JACKPOT.twin1In, M.JACKPOT.mutation1In, M.JACKPOT.hidden1In, M.JACKPOT.legMix1In], J.slice(1).map(Number));
const s = L.snap(), w = L.run(c, s, [], s.tip), p = w.pets.find(x => R.isMythic(x) && !x.dead) || w.pets[0], b = R.ACTIVATE_QUEST_BLOCK || 972952;
const pct = bp => String(Number((bp / 100).toFixed(2))) + '%';
R.QUEST_CODES.forEach(code => { const h = c.V2QuestClarity.outcomes(w, p, code, b + 1), o = R.questOdds(w, p, code, b + 1), Q = R.QUESTS[code];
  [o.haul, o.loot, o.empty].forEach(bp => assert(h.includes('>' + pct(bp) + '<'), code + ' missing ' + pct(bp)));
  assert.strictEqual(o.haul + o.loot + o.empty, 10000); assert.strictEqual(o.loot, Q.odds[1]);
  const txt = h.replace(/<[^>]+>/g, ' ');
  assert(!/\b(series|discount|price)\b/i.test(txt), code + ': banned word'); assert(!/\d\s*x\b|\bx\s*\d/i.test(txt), code + ': use "times", not x'); });
console.log('quest-clarity-test: ok (' + R.QUEST_CODES.length + ' quests, mirror constants match js/v2-rules.js)');
