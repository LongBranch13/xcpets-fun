#!/usr/bin/env node
/* PET SEARCH tests (dev only; species-ranks-split): free-text My Pets search (js/v2-pet-search.js). Display only, no rule change.
 *   node tools/pet-search-test.js [snap-file-name] */
'use strict';
const path = require('path');
const { load, snap } = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const S = snap(process.argv[2]), c = load(), V = c.V2Rules;
global.V2Rules = V; if (c.PetCore) global.PetCore = c.PetCore;
const PS = require(path.join(__dirname, '..', 'js', 'v2-pet-search.js'));
const w = V.replay(S.rows, Object.assign({}, c.XCPETS_BLOCK_HASHES, S.hashes), [], { tip: S.tip, live: c.LiveEngine.RealCore });
const pets = Object.keys(w.pets).map(k => w.pets[k]);
const f = q => { const m = PS.matcher(q, w); return m ? pets.filter(m) : pets; };
ok(PS.matcher('', w) === null && PS.matcher('   ', w) === null, 'empty query = no filter');
const p = pets.find(x => x.name && x.stats) || pets[0];
ok(f(String(p.id)).includes(p), 'bare number matches pet #');
ok(f('#' + p.id).includes(p), '#number matches pet #');
if (p.name) { ok(f(p.name.toUpperCase()).includes(p), 'name, case-insensitive'); }
const sp = V.speciesLabel(p.species);
ok(f(sp.toLowerCase()).includes(p), 'species label');
ok(f('VIGOR').length === pets.filter(x => x.stats && x.stats.vigor != null).length, 'trait name');
const v = p.stats.vigor; ok(f('vigor:' + v).every(x => x.stats.vigor === v) && f('vigor:' + v).includes(p), 'vigor:N exact');
ok(f('vigor>' + v).every(x => x.stats.vigor > v) && !f('vigor>' + v).includes(p), 'vigor>N');
ok(f('vigor>=' + v).includes(p), 'vigor>=N');
const tl = ['common', 'uncommon', 'rare', 'legendary'];
ok(f('legendary').length >= pets.filter(x => x.tier === 3).length, 'tier word');
ok(f('mythic').every(x => x.stage >= 5 || V.wornOf(w, x.id).length || /mythic/i.test(x.name || '')), 'mythic');
const both = f(sp + ' ' + tl[p.tier]);
ok(both.includes(p) && both.length <= f(sp).length && both.length <= f(tl[p.tier]).length, 'AND of words narrows');
ok(f('zzqqxxnotaword').length === 0, 'no match');
const geared = pets.find(x => V.wornOf(w, x.id).length);
if (geared) { const g = V.wornOf(w, geared.id)[0]; ok(f(String(g.label).split(/\s+/)[0]).includes(geared), 'gear name'); ok(f('gear').includes(geared), 'gear word'); }
const bag = [
  { id: 12, name: 'OnlyTwelve', species: 'pepe', tier: 0, stage: 3, stats: { vigor: 4 }, art: { rareHatch: { version: 1, kind: 'giant' } } },
  { id: 120, name: 'OneTwenty', species: 'pepe', tier: 0, stage: 3, stats: { vigor: 4 }, art: {} },
  { id: 34, name: 'Thirty', species: 'doge', tier: 3, stage: 4, stats: {}, art: { rareHatch: { version: 1, kind: 'kek' } } }
];
const fm = q => { const m = PS.matcher(q, w); return m ? bag.filter(m) : bag.slice(); };
ok(fm('12').length === 1 && fm('12')[0].id === 12, 'single id is exact, not a prefix of 120');
ok(fm('#012').length === 1 && fm('#012')[0].id === 12, 'optional hash and leading zeros');
ok(fm('12, 120, 12\n#34').map(p => p.id).sort((a, b) => a - b).join() === '12,34,120', 'spaces, commas, newlines, duplicates');
ok(fm('12, 99, 34').length === 2, 'absent id is skipped, not an error');
ok(fm('12abc').length === 0, '12abc does not match 12 or 120');
ok(fm('12, 12abc, 34').length === 0, 'a broken token matches nothing');
ok(fm('#').length === 0, 'a bare hash does not match every pet');
ok(fm('pepe').map(p => p.id).sort().join() === '12,120', 'a name or species stays a normal search');
ok(fm('weird').length === 1 && fm('weird')[0].id === 12, 'weird still means the birth trait');
ok(fm('vigor>3').some(p => p.id === 12) && fm('vigor>3').every(p => p.stats.vigor > 3), 'stat words still work');
const iq = PS.idQuery('  #12, 12, 99\n34 ');
ok(iq && iq.mode === 'ids' && iq.ids.join() === '12,99,34' && !iq.capped, 'id list dedupes in first-seen order');
const many = []; for (let i = 0; i < 6000; i++) many.push(String(i + 1));
const t0 = Date.now(); const big = PS.idQuery(many.join(',')); const m = PS.matcher(many.slice(0, 5000).join(' '), w);
bag.forEach(p => m(p)); const ms = Date.now() - t0;
ok(big && big.capped && big.ids.length === PS.ID_CAP && big.pasted === 6000, 'a longer paste keeps the first 5,000 ids');
ok(ms < 250, 'parsing 6,000 ids stays cheap (' + ms + 'ms)');
console.log('pet-search-test: ' + pass + ' passed, ' + fail + ' failed (' + pets.length + ' pets)'); process.exit(fail ? 1 : 0);
