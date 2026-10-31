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
// Coach skip flow: steps 0 connect (hidden once connected), 1 crack, 2 pets, 3 feed, 4 quests. Skipped set persists like localStorage.
const sk = {}, ok = k => k !== 0 && !sk[k], P2 = T.pickStep;
let ci = P2(-1, 1, 5, ok); eq('coach starts on crack step', ci, 1);
sk[ci] = 1; ci = P2(ci, 1, 5, ok); eq('Skip on crack advances (no action needed)', ci, 2);
eq('Back from pets never returns to skipped crack or hidden connect', P2(ci, -1, 5, ok), 2);
eq('re-entering the tour skips the remembered crack step', P2(-1, 1, 5, ok), 2);
eq('Next past last step ends the tour', P2(4, 1, 5, ok), 5);
eq('skip key name', T.CSKIP, 'xcpets-tut-coach-skip');
eq('mythic line 21,000 + Mythic 69,069 from v2-rules.js', [N.mythicLine, N.thresholds[5]], [K('MYTHIC_DISCOUNT_CARE'), pick('THRESHOLDS')[5]]);
eq('raised-only wording (no "own a living Mythic")', /\bown(s)? a (living )?Mythic/i.test(src + fs.readFileSync(path.join(ROOT, 'js/v2-intuitive.js'), 'utf8')), false);
// tutorial-cemetery: the raise steps mirror the cemetery gate and numbers from v2-rules.js
eq('cemetery gate + public block + owner test grave/wallet', [N.cemGate, N.cemPublic, N.cemOwnerGrave, N.cemOwner], [V.cemeteryGate(), V.cemPublicBlock(), V.CEM.OWNER_GRAVE, V.CEM.OWNER]);
eq('cemetery pool, feral, cap, ripe', [N.cemPool, N.cemFeral, N.cemCap, N.cemRipe], [V.CEM.POOL, V.CEM.FERAL, V.CEM.CAP, +(/CEM_RIPE = ([\d.]+)/.exec(RS) || [])[1]]);
const cem = T.CH.filter(ch => ch.id === 'cem')[0], cs = cem.steps.map(x => typeof x[1] === 'function' ? x[1]() : x[1]).join('\n');
eq('cemetery chapter teaches the raise (Hold seance, Pledge only, Raise now, Take all back, My Pets)', ['Hold seance', 'Pledge only', 'Raise now', 'Take all back', 'My Pets'].every(k => cs.indexOf(k) >= 0), true);
eq('raise steps say it opens soon while the cemetery is owner test', V.cemPublicBlock() != null || /Opens soon/.test(cs), true);
// tutorial-cemetery-v2: zombies eat pets (zombie-feed-pets picker), feral clock, whole-burn rule
eq('cemetery chapter teaches zombie meals (pets not meals, discarded first, Select all discarded, starred never, fee per burn, hunger full, tier + neglect, whole burn fails, feral)',
  ['pets, not meals', 'discarded', 'Select all discarded', 'Starred pets are never offered', 'only a fee per burn', 'refills its hunger to full', 'tier', 'neglect', 'whole burn fails', 'feral', 'Whoever raises it owns it'].every(k => cs.indexOf(k) >= 0), true);
eq('zombie meal + Select all discarded exist in the play UI', /Select all discarded/.test(fs.readFileSync(path.join(ROOT, 'js/v2.js'), 'utf8')), true);
eq('whole burn fails = rules reject the zfeed burn on the first bad pet', /if \(bad\) return L\(r, 'rejected', 'zombie meal: ' \+ bad\)/.test(RS), true);
eq('no x / times symbol, price, series, discount or giveaway in the cemetery chapter', /\d ?(x|×)\b|×|\bprice|\bseries|discount|giveaway/i.test(cs), false);
// resurrect-odds: the Resurrection step mirrors cemResInfo (points by tier, 25 minimum, 5% + 60% of P/(P+100), caps, Halloween +10 and window)
const RK = n => +(new RegExp('\\b' + n + ' = ([\\d.]+)').exec(RS) || [])[1];
eq('resurrection points by tier + minimum', [N.resPts, N.resMin], [V.CEM.POINTS, V.CEM.RES_MIN]);
eq('resurrection base, span, cap, Halloween points + cap', [N.resBase, N.resSpan, N.resTop, N.resHwPts, N.resHwTop], ['CEM_RES_BASE', 'CEM_RES_SPAN', 'CEM_RES_TOP', 'CEM_RES_HW_PTS', 'CEM_RES_HW_TOP'].map(RK));
eq('Halloween window blocks', N.cemHw, [V.CEM.HW_FROM, V.CEM.HW_TO]);
eq('cemPts maps tier 0..3 (Common..Legendary) to CEM_POINTS', /function cemPts\(x\) \{ return CEM_POINTS\[cemTier\(x\.tier\)\]; \}/.test(RS) && /function cemTier\(x\) \{ return Math\.max\(0, Math\.min\(3, x \| 0\)\); \}/.test(RS), true);
eq('resurrection chance formula in the rules is the one the tutorial uses', /P = pts \+ \(hw \? CEM_RES_HW_PTS : 0\), ch = Math\.min\(hw \? CEM_RES_HW_TOP : CEM_RES_TOP, CEM_RES_BASE \+ CEM_RES_SPAN \* \(P \/ \(P \+ 100\)\)\)/.test(RS), true);
eq('odds table (25, 50, 100, 300, 1000 points; normal | Halloween)', N.resRows.map(p => [T.resChance(p), T.resChance(p, 1)]), [[0.17, 0.2056], [0.25, 0.275], [0.35, 0.3643], [0.5, 0.5037], [0.5955, 0.5959]]);
eq('Halloween window by block = Oct 31 to Nov 11 (cemHw)', [V.cemHw(N.cemHw[0] - 1), V.cemHw(N.cemHw[0]), V.cemHw(N.cemHw[1]), V.cemHw(N.cemHw[1] + 1)], [false, true, true, false]);
eq('Resurrection step teaches points, 25 minimum, one roll, dust forever, halo, Halloween bonus, live chance', ['Common 1', 'Uncommon 3', 'Rare 10', 'Legendary 33', '25 points', 'one roll', 'dust forever', 'halo', '+10 bonus points', 'live chance'].every(k => cs.indexOf(k) >= 0), true);
eq('cemetery card shows the live chance next to Resurrect', /Math\.round\(res\.chance \* 100\) \+ '% chance; a miss turns it to dust/.test(fs.readFileSync(path.join(ROOT, 'js/v2-cemetery-scene.js'), 'utf8')), true);
eq('no G Money in the tutorial', /G Money/i.test(src), false);
console.log(fail ? fail + ' FAILED' : 'tutorial: all checks pass'); process.exit(fail ? 1 : 0);
