/* Homer Pepe's 3-way syllables live in h3part(): Ho (start), mer (middle), mer (end).
 * The same pieces were already used by wr3Name and by the viking / Old Hickory / Orange Dragon
 * 2-way fallback. hybridName() is what replay stores on the pet as hybrid.name.
 *   hyb3:homer:djpepe:dodo  (#202394)  Hodjdo
 *   hyb3:kek:homer:dodo     (#176224)  Kekmerdo
 * 2-way names are a different table and stay hyphenated (homer-dodo).
 * Dev only: nothing is signed or sent. */
'use strict';
const assert = require('assert');
const { load } = require('./lib/load-rules');
const V = load().V2Rules;
let n = 0, fail = 0;
function ok(fn) { try { fn(); n++; } catch (e) { fail++; console.log('FAIL ' + (e && e.message ? e.message : e)); } }

/* Pull one syllable out of the live 3-way namer by parking the other two slots on species whose parts we know. */
function partOf(sp, pos) {
  if (pos === 0) {
    const name = V.hybridName('hyb3:' + sp + ':dodo:kevin');
    assert.ok(name.endsWith('dovin'), sp + ' start slot did not end dovin: ' + name);
    return name.slice(0, -5);
  }
  if (pos === 1) {
    const name = V.hybridName('hyb3:pepe:' + sp + ':kevin');
    assert.ok(name.startsWith('Pe') && name.endsWith('vin'), sp + ' middle slot was not Pe…vin: ' + name);
    return name.slice(2, -3);
  }
  const name = V.hybridName('hyb3:pepe:dodo:' + sp);
  assert.ok(name.startsWith('Pedo'), sp + ' end slot did not start Pedo: ' + name);
  return name.slice(4);
}
const HOMER = ['Ho', 'mer', 'mer'];
function proposed3(a, b, c) {
  const part = [a, b, c].map(function (sp, i) { return sp === 'homer' ? HOMER[i] : partOf(sp, i); });
  return part.join('');
}

/* Evidence the syllables are already chosen, on paths that do have a Homer case. */
ok(function () { assert.strictEqual(V.hybridName('hyb3:homer:pepe:rabbit'), 'Hopebbit'); });
ok(function () { assert.strictEqual(V.hybridName('hyb3:pepe:homer:rabbit'), 'Pemerabbit'); });
ok(function () { assert.strictEqual(V.hybridName('hyb:homer:viking'), 'Hoking'); });
ok(function () { assert.strictEqual(V.hybridName('hyb:viking:homer'), 'Vikmer'); });

/* The two published pets. Personal names stay Wookibo and Shechugokin. The species mashup is the stored hybrid.name. */
ok(function () { assert.strictEqual(V.hybridName('hyb3:homer:djpepe:dodo'), 'Hodjdo'); });
ok(function () { assert.strictEqual(V.hybridLabel('hyb3:homer:djpepe:dodo'), 'Hodjdo'); });
ok(function () { assert.strictEqual(V.speciesLabel('hyb3:homer:djpepe:dodo'), 'Hodjdo (hybrid)'); });
ok(function () { assert.strictEqual(V.hybridPlan('ab'.repeat(32), 'hyb3:homer:djpepe:dodo', 976914).name, 'Hodjdo'); });
ok(function () { assert.strictEqual(proposed3('homer', 'djpepe', 'dodo'), 'Hodjdo'); });
ok(function () { assert.strictEqual(V.hybridName('hyb3:kek:homer:dodo'), 'Kekmerdo'); });
ok(function () { assert.strictEqual(V.hybridPlan('cd'.repeat(32), 'hyb3:kek:homer:dodo', 976000).name, 'Kekmerdo'); });
ok(function () { assert.strictEqual(proposed3('kek', 'homer', 'dodo'), 'Kekmerdo'); });
ok(function () { assert.strictEqual(proposed3('kek', 'dodo', 'homer'), 'Kekdomer'); });
ok(function () { assert.strictEqual(V.hybridName('hyb3:kek:dodo:homer'), 'Kekdomer'); });

/* Known good rows, so a bad slice cannot hide a missing species. */
const KNOWN = {
  pepe: ['Pe', 'pe', 'pe'], wojak: ['Wo', 'jo', 'jak'], funtrump: ['Fun', 'tru', 'trump'],
  djpepe: ['DJ', 'dj', 'pe'], chad: ['Cha', 'cha', 'chad'], viking: ['Vik', 'vi', 'king'],
  jacksonpepe: ['Hick', 'hick', 'ory'], orangedragon: ['Dra', 'dra', 'gon'], homer: ['Ho', 'mer', 'mer']
};
Object.keys(KNOWN).forEach(function (sp) {
  ok(function () { assert.deepStrictEqual([0, 1, 2].map(function (i) { return partOf(sp, i); }), KNOWN[sp], sp); });
});

/* Live hybrid roots. Rabbit 3-ways use wr3Name, not the three slots, so it is checked above. */
const LIVE = ['pepe', 'wojak', 'chud', 'bobo', 'mumu', 'snibby', 'dodo', 'kevin', 'peepo', 'sarutobi', 'doge', 'lenny', 'nakamoto', 'kek', 'wizard', 'funtrump', 'homer', 'chad', 'djpepe', 'viking', 'jacksonpepe', 'orangedragon'];
const undefinedRoots = LIVE.filter(function (sp) { return [0, 1, 2].some(function (i) { return partOf(sp, i) === 'undefined'; }); });
ok(function () { assert.deepStrictEqual(undefinedRoots, []); });

/* No syllable at all: the namer pastes the raw id. These are not normal breed roots
 * (contest pets breed as the partner; kekamozard and don are cross labels). */
const RAW = ['bojackson', 'rarepigeon', 'borp', 'starlordkek', 'gooby', 'lukespam', 'kekamozard', 'don'];
RAW.forEach(function (sp) {
  ok(function () { assert.deepStrictEqual([0, 1, 2].map(function (i) { return partOf(sp, i); }), [sp, sp, sp], sp); });
});

/* 2-way table is separate. Homer and Chad fall through to "a-b" for an ordinary partner.
 * The 3-way proposal above does not rename these. */
ok(function () { assert.strictEqual(V.hybridName('hyb:homer:dodo'), 'homer-dodo'); });
ok(function () { assert.strictEqual(V.hybridName('hyb:doge:chad'), 'doge-chad'); });
ok(function () { assert.strictEqual(V.hybridName('hyb3:chad:pepe:dodo'), 'Chapedo'); });

/* Short arrays make the Homer fallback (Ho / mer) fire for chad and djpepe too.
 * DJ_NAMES had asked for DJiking; the viking loop overwrites it. No such pet is published yet. */
ok(function () { assert.strictEqual(V.hybridName('hyb:viking:djpepe'), 'Vikmer'); });
ok(function () { assert.strictEqual(V.hybridName('hyb:djpepe:viking'), 'Hoking'); });
ok(function () { assert.strictEqual(V.hybridName('hyb:viking:chad'), 'Vikmer'); });
ok(function () { assert.strictEqual(V.hybridName('hyb:chad:viking'), 'Hoking'); });

if (fail) { console.log('FAIL ' + fail + ' of ' + (n + fail)); process.exit(1); }
console.log('PASS ' + n + ' homer 3-way name checks');
