/* Wizard breeding odds test (wizard-hybrids branch). Loads the rule scripts like tools/replay-check.js, checks the gate is inert by default,
 * then simulates the gate ON and samples breedChild/breed: hybrid rate, 50/50 split, Nakamoto Legendary, Wizard x Wizard bred-true, hybrid x Wizard 3-ways. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..'), N = +(process.argv[2] || 200000);
const store = {}, ls = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
const win = { console, localStorage: ls, sessionStorage: ls, location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/' }, navigator: { userAgent: 'node' }, setTimeout: () => 0, clearTimeout() {}, URLSearchParams, URL, TextEncoder, TextDecoder };
win.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {}, body: null, documentElement: { style: {} } };
win.addEventListener = () => {}; win.window = win; win.self = win; win.globalThis = win; const ctx = vm.createContext(win);
['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js', 'js/wizard-sprite.js'].forEach(f => { const p = path.join(ROOT, f); if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f }); });
const V = ctx.V2Rules; let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const st = { vigor: 10, spark: 10, grit: 10, zoom: 10, luck: 10 };
const pet = (id, sp, tier, extra) => Object.assign({ id, species: sp, tier, stats: Object.assign({}, st), stage: 3, breeds: 0, children: [], owner: 'bc1qtest', lastBreed: null }, extra || {});
const B = 972400;
// 1) gate inert by default
ok(V.ACTIVATE_WIZ_BREED_BLOCK === null, 'ACTIVATE_WIZ_BREED_BLOCK is null (inert placeholder)');
ok(V.wizBreedOn(B) === false && V.wizBreedOn(99999999) === false, 'wizBreedOn false at every block while null');
ok(/cannot breed/.test(V.breedable(pet(1, 'wizard', 1), B) || ''), 'gate inert: player Wizard cannot breed: "' + V.breedable(pet(1, 'wizard', 1), B) + '"');
// 2) simulate gate ON
V._setWizBreedActivation(B);
ok(V.breedable(pet(1, 'wizard', 1), B) === null, 'gate on: adult player Wizard can breed at the gate block');
ok(/cannot breed/.test(V.breedable(pet(1, 'wizard', 1), B - 1) || ''), 'gate on: still blocked one block before the gate');
ok(!!V.breedable(pet(1, 'wizard', 1, { community: true }), B), 'gate on: community pet still never breeds (' + V.breedable(pet(1, 'wizard', 1, { community: true }), B) + ')');
ok(!!V.breedable(pet(1, 'wizard', 1, { stage: 2 }), B), 'gate on: Juvenile Wizard still needs Adult+');
// 3) odds, pure breedChild (unchanged function)
const sps = ['pepe', 'wojak', 'chud', 'bobo', 'mumu', 'snibby', 'dodo', 'kevin', 'peepo', 'sarutobi', 'doge', 'lenny', 'nakamoto'];
let H = 0, A0 = 0, B0 = 0, T = 0; const hyKeys = {};
for (let i = 0; i < N; i++) { const o = sps[i % 13], A = pet(1, i % 2 ? 'wizard' : o, 1), Bp = pet(2, i % 2 ? o : 'wizard', 1), c = V.breedChild(V.sha('wiz-odds:' + i), A, Bp, B); T++;
  if (c.hybrid) { H++; hyKeys[c.species] = 1; } else if (c.species === A.species) A0++; else if (c.species === Bp.species) B0++; }
const rate = H / T, exp = 0.684773435, se = Math.sqrt(exp * (1 - exp) / T);
console.log(`  Wizard x other (13 species, both orders), N=${T}: hybrid ${(rate * 100).toFixed(4)}% (expected 68.4773%, z=${((rate - exp) / se).toFixed(2)}); non-hybrid: parent A ${A0} / parent B ${B0} = ${(A0 / (A0 + B0) * 100).toFixed(2)}% A`);
ok(Math.abs(rate - exp) < 4 * se, 'hybrid rate within 4 sigma of 68.4773435%');
ok(Math.abs(A0 / (A0 + B0) - 0.5) < 4 * Math.sqrt(0.25 / (A0 + B0)), 'non-hybrid children split 50/50 between the parents\' species');
ok(Object.keys(hyKeys).length === 26, 'all 26 ordered Wizard pairs appear as hybrids (' + Object.keys(hyKeys).length + ')');
ok(Object.keys(hyKeys).every(k => !/-/.test(V.hybridName(k))), 'every Wizard hybrid has a name');
let ww = 0; for (let i = 0; i < 20000; i++) { const c = V.breedChild(V.sha('ww:' + i), pet(1, 'wizard', 1), pet(2, 'wizard', 1), B); if (c.species === 'wizard' && !c.hybrid) ww++; }
ok(ww === 20000, 'Wizard x Wizard always gives a Wizard (' + ww + '/20000)');
// tier rules unchanged vs a regular same-tier pair (stream draws identical)
let same = 0; for (let i = 0; i < 20000; i++) { const h = V.sha('tier:' + i), a = V.breedChild(h, pet(1, 'wizard', 0), pet(2, 'wizard', 2), B), b = V.breedChild(h, pet(1, 'pepe', 0), pet(2, 'pepe', 2), B); if (a.tier === b.tier && JSON.stringify(a.stats) === JSON.stringify(b.stats)) same++; }
ok(same === 20000, 'Wizard x Wizard tier/stat rolls identical to any same-species pair (' + same + '/20000)');
// hybrid x Wizard -> 3-way rules
let h3 = 0, h2 = 0, pure = 0; for (let i = 0; i < 20000; i++) { const c = V.breedChild(V.sha('h3:' + i), pet(1, 'hyb:pepe:dodo', 2), pet(2, 'wizard', 1), B); if (/^hyb3:/.test(c.species) && c.species.indexOf('wizard') >= 0) h3++; else if (/^hyb:/.test(c.species)) h2++; else pure++; }
console.log(`  Pepodo x Wizard N=20000: 3-way ${(h3 / 200).toFixed(2)}%  2-way ${(h2 / 200).toFixed(2)}%  pure ${pure}`);
ok(pure === 0 && Math.abs(h3 / 20000 - 0.5) < 0.02, 'hybrid x Wizard: always a hybrid, ~50% three-way with a Wizard root');
// 4) full breed(): Nakamoto child forced Legendary + Wizard bred-true bonus (needs a world: replay an empty chain)
const w = V.replay([], {}, [], { tip: B }); let nk = 0, nkL = 0, bt = 0;
for (let i = 0; i < 4000; i++) { const k = V.breed(w, pet(100000 + i * 2, 'wizard', 0), pet(100001 + i * 2, 'nakamoto', 0), V.sha('bh' + i), V.sha('tx' + i), B, 'bc1qtest'); if (k.species === 'nakamoto') { nk++; if (k.tierIndex === 3 || (k.art && k.art.tierIndex === 3) || k.tier === 3) nkL++; } }
ok(nk > 0 && nk === nkL, 'Wizard x Nakamoto: every Nakamoto child is Legendary (' + nkL + '/' + nk + ')');
for (let i = 0; i < 500; i++) { const k = V.breed(w, pet(300000 + i * 2, 'wizard', 1), pet(300001 + i * 2, 'wizard', 1), V.sha('wb' + i), V.sha('wt' + i), B, 'bc1qtest'); if (k.breedBonus) bt++; }
ok(bt === 500, 'Wizard x Wizard gets the bred-true bonus (' + bt + '/500)');
// 5) wizard-breed-on: final names, breed cost (breed 135 rules), community never breeds in a real world, copy placeholder guard
const WP = V.wizHybridPairs(); ok(WP.length === 13 && WP.every(e => e.nameA && e.nameB && V.hybridName(e.a) === e.nameA && V.hybridName(e.b) === e.nameB), '13 Wizard pairs, both orders named (' + WP.map(e => e.nameA + '/' + e.nameB).join(', ') + ')');
ok(new Set(WP.map(e => e.nameA).concat(WP.map(e => e.nameB))).size === 26, '26 distinct Wizard hybrid names');
ok(V.breed135Gate() === 972703 && V.breedCost(Math.max(B, 972703)) === 135 && V.breedCost(972702) === 690, 'Wizard breeds use breedCost (species-agnostic): 135 from 972703');
{ const pw = V.replay([], {}, [], { tip: 972710 }); ok(V.planAmount(pw, { tag: 'pet:breed:16822:1', amount: 690 }, 972710).amount === 135, 'pet:breed with a Wizard parent plans 135 after 972703'); }
ok(!!V.breedable(pet(1, 'wizard', 3, { community: true, stage: 5 }), 99999999), 'community Bitcoin Wizard (Mythic) never breeds, any block');
{ const html = ['pets.html', 'rules.html', 'how-it-works.html'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join(''); const ph = (html.match(/__WIZ_BREED_BLOCK__/g) || []).length;
  ok(V.ACTIVATE_WIZ_BREED_BLOCK === null || ph === 0, 'copy placeholder __WIZ_BREED_BLOCK__ (' + ph + ' left) must be replaced once the gate is set'); }
console.log(fail ? `${fail} FAILED` : 'ALL PASS'); process.exit(fail ? 1 : 0);
