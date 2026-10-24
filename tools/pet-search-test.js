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
console.log('pet-search-test: ' + pass + ' passed, ' + fail + ' failed (' + pets.length + ' pets)'); process.exit(fail ? 1 : 0);
