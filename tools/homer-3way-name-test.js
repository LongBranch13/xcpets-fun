/* Display labels for Homer and Chad hybrids. hybridName() is what replay stores on hybrid.name.
 * It still says undefineddjdo / homer-dodo. hybridLabel() is what the page shows.
 * Homer's display syllables are Ho / mo / mer (start / middle / end).
 *   A middle of mer would name #176224 Kekmerdo. mo names it Kekmodo.
 *   #202394 is Homer first, so both middles name it Hodjdo.
 * Dev only: nothing is signed or sent. */
'use strict';
const assert = require('assert');
const { load } = require('./lib/load-rules');
const V = load().V2Rules;
let n = 0, fail = 0;
function ok(fn) { try { fn(); n++; } catch (e) { fail++; console.log('FAIL ' + (e && e.message ? e.message : e)); } }

const LIVE = ['pepe', 'wojak', 'chud', 'bobo', 'mumu', 'snibby', 'dodo', 'kevin', 'peepo', 'sarutobi', 'doge', 'lenny', 'nakamoto', 'kek', 'wizard', 'funtrump', 'homer', 'rabbit', 'chad', 'djpepe', 'viking', 'jacksonpepe', 'orangedragon'];

/* Stored names stay the ones already on the pets. */
ok(function () { assert.strictEqual(V.hybridName('hyb3:homer:djpepe:dodo'), 'undefineddjdo'); });
ok(function () { assert.strictEqual(V.hybridPlan('ab'.repeat(32), 'hyb3:homer:djpepe:dodo', 976914).name, 'undefineddjdo'); });
ok(function () { assert.strictEqual(V.hybridName('hyb3:kek:homer:dodo'), 'Kekundefineddo'); });
ok(function () { assert.strictEqual(V.hybridPlan('cd'.repeat(32), 'hyb3:kek:homer:dodo', 976000).name, 'Kekundefineddo'); });
ok(function () { assert.strictEqual(V.hybridName('hyb:homer:dodo'), 'homer-dodo'); });
ok(function () { assert.strictEqual(V.hybridName('hyb:homer:kek'), 'homer-kek'); });
ok(function () { assert.strictEqual(V.hybridName('hyb:doge:chad'), 'doge-chad'); });
ok(function () { assert.strictEqual(V.hybridName('hyb3:pepe:dodo:kevin'), 'Pedovin'); });
ok(function () { assert.strictEqual(V.hybridName('hyb3:homer:pepe:rabbit'), 'Hopebbit'); });
ok(function () { assert.strictEqual(V.hybridName('hyb3:pepe:homer:rabbit'), 'Pemerabbit'); });
ok(function () { assert.strictEqual(V.hybridLabel('hyb3:nakamoto:kek:funtrump'), 'Trukekamoto'); });

/* Shown labels. mo middle: Kekmodo. mer middle would have been Kekmerdo. #202394 is Hodjdo either way. */
ok(function () { assert.strictEqual(V.hybridLabel('hyb3:homer:djpepe:dodo'), 'Hodjdo'); });
ok(function () { assert.strictEqual(V.speciesLabel('hyb3:homer:djpepe:dodo'), 'Hodjdo (hybrid)'); });
ok(function () { assert.strictEqual(V.hybridLabel('hyb3:kek:homer:dodo'), 'Kekmodo'); });
ok(function () { assert.strictEqual(V.speciesLabel('hyb3:kek:homer:dodo'), 'Kekmodo (hybrid)'); });
ok(function () { assert.strictEqual(V.hybridLabel('hyb3:kek:dodo:homer'), 'Kekdomer'); });
ok(function () { assert.strictEqual(V.hybridLabel('hyb3:pepe:homer:dodo'), 'Pemodo'); });

/* Published 2-ways that used to show a dash. */
ok(function () { assert.strictEqual(V.hybridLabel('hyb:homer:dodo'), 'Hodo'); });
ok(function () { assert.strictEqual(V.hybridLabel('hyb:dodo:homer'), 'Domer'); });
ok(function () { assert.strictEqual(V.hybridLabel('hyb:homer:kek'), 'Hokek'); });
ok(function () { assert.strictEqual(V.hybridLabel('hyb:kek:homer'), 'Kekmer'); });
ok(function () { assert.strictEqual(V.hybridLabel('hyb:homer:funtrump'), 'Hotrump'); });
ok(function () { assert.strictEqual(V.hybridLabel('hyb:funtrump:homer'), 'Funmer'); });
ok(function () { assert.strictEqual(V.hybridLabel('hyb:lenny:homer'), 'Lemer'); });
ok(function () { assert.strictEqual(V.hybridLabel('hyb:doge:chad'), 'Dogchad'); });
ok(function () { assert.strictEqual(V.hybridLabel('hyb:snibby:chad'), 'Snichad'); });
ok(function () { assert.strictEqual(V.hybridLabel('hyb:dodo:chad'), 'Dochad'); });
ok(function () { assert.strictEqual(V.hybridLabel('hyb:chad:pepe'), 'Chape'); });

/* Every real 2-way label, and every 3-way that puts each live root in each slot, has no "undefined" and no dash. */
LIVE.forEach(function (a) {
  LIVE.forEach(function (b) {
    if (a === b) return;
    ok(function () {
      const lab = V.hybridLabel('hyb:' + a + ':' + b);
      assert.ok(lab.indexOf('undefined') < 0 && lab.indexOf('-') < 0, a + '+' + b + ' label ' + lab);
    });
  });
});
LIVE.forEach(function (sp) {
  ok(function () {
    const labs = [V.hybridLabel('hyb3:' + sp + ':pepe:dodo'), V.hybridLabel('hyb3:pepe:' + sp + ':dodo'), V.hybridLabel('hyb3:pepe:dodo:' + sp)];
    labs.forEach(function (lab) { assert.ok(lab.indexOf('undefined') < 0 && lab.indexOf('-') < 0, sp + ' 3-way label ' + lab); });
  });
});

if (fail) { console.log('FAIL ' + fail + ' of ' + (n + fail)); process.exit(1); }
console.log('PASS ' + n + ' homer 3-way name checks');
