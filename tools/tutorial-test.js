#!/usr/bin/env node
/* player-tutorial: every number the The Big Beautiful Tutorial shows (js/v2-tutorial.js N) must match the real rules, the copy must follow the
 * wording rules, and the guide art must never use Nakamoto or Wizard. Display-only feature: this test reads, never changes, rules. */
'use strict';
const fs = require('fs'), path = require('path'), ROOT = path.join(__dirname, '..');
const L = require('./lib/load-rules'), c = L.load(), V = c.V2Rules, P = c.PetCore || require('../js/pet-core.js');
global.window = {}; require('../js/v2-tutorial.js'); const T = global.window.V2Tutorial, N = T.N;
let fail = 0; const eq = (name, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) fail++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : ': tutorial ' + JSON.stringify(a) + ' rules ' + JSON.stringify(b))); };
const pick = (...ks) => { for (const k of ks) { const v = k.split('.').reduce((o, x) => o == null ? o : o[x], V); if (v != null) return v; } return undefined; };
const C = pick('COSTS') || {};
eq('hatch', N.hatch, C.hatch); const W0 = { pets: [] }, CA = V.costsAt(W0, 972000); eq('hatch12', N.hatch12, CA.hatch12); eq('hatch144', N.hatch144, CA.hatch144);
const RS = fs.readFileSync(path.join(ROOT, 'js/v2-rules.js'), 'utf8'), K = n => +(new RegExp('\\b' + n + ' = (\\d+)').exec(RS) || [])[1];
eq('roll', N.roll, C.roll); eq('fight', N.fight, C.fight); eq('croll', N.croll, C.croll);
eq('stage names', N.stages, pick('STAGE_NAMES')); eq('thresholds', N.thresholds, pick('THRESHOLDS'));
eq('blocks per day', N.blocksPerDay, pick('BLOCKS_PER_DAY')); eq('neglected after', N.neglectedAfter, K('NEGLECTED_AFTER_DAYS')); eq('death after', N.deathAfter, K('NEGLECT_DAYS'));
eq('tier bonus', N.tiers.map(t => t[2]), P.TIERS.map(t => t.statBonus)); eq('breed cooldown', N.breedCooldown, K('WEEK')); eq('mythic line', N.mythicLine, pick('MYTHIC_DISCOUNT_CARE'));
eq('tier odds', N.tiers.map(t => t[1]), P.TIERS.map(t => t.chance));
const src = fs.readFileSync(path.join(ROOT, 'js/v2-tutorial.js'), 'utf8');
const copy = (src.match(/'(?:[^'\\]|\\.)*'/g) || []).map(s => s.slice(1, -1)).filter(s => / /.test(s)).join('\n');
const bad = copy.match(/\b(price|prices|series|discount)\b|×|\b\d+x\b|\bx\d/gi); eq('wording rules', bad || [], []);
eq('no Nakamoto or Wizard art', /sprite\('(nakamoto|wizard)/.test(src), false);
eq('every chapter has steps', T.CH.every(ch => ch.steps.length > 0), true);
const s = T.stats({ tip: 144 * 10 + 5, pets: [{ owner: 'a', feedDays: { 8: 1, 9: 1, 10: 1 }, stage: 3, wins: 1, losses: 0, breeds: 0 }, { owner: 'b', feedDays: { 1: 1 }, stage: 5 }] }, 'a');
eq('streak + quests from history', [s.pets, s.best, s.cur, s.stage, s.fights], [1, 3, 3, 3, 1]);
console.log(fail ? fail + ' FAILED' : 'tutorial: all checks pass'); process.exit(fail ? 1 : 0);
