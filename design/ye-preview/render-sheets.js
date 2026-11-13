/* Draw the Ye preview sheets with the live renderer.
 * Loads js/pet-core.js, bonus-gear, v2-gear, v2-fit, v2-rules, v2-render.
 * Injects Ye into PetCore.SPECIES in this process only. Does not write those files.
 *
 *   node design/ye-preview/render-sheets.js [outDir]
 * Writes frames.json (raw 32px RGBA) for the sheet compositor.
 */
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var ROOT = path.resolve(__dirname, '../..');
var Ye = require('./ye-sprite.js');

var window = {
  console: console,
  setInterval: function () { return 0; },
  clearInterval: function () {},
  setTimeout: function () { return 0; },
  clearTimeout: function () {},
  document: { hidden: true }
};
var ctx = vm.createContext(window);
window.window = window;
window.global = window;
function load(rel) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), ctx, { filename: rel });
}
['js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js', 'js/v2-render.js'].forEach(load);

var PC = window.PetCore, BG = window.BonusGear, R = window.V2Rules, VR = window.V2Render;
if (!PC || !BG || !R || !VR || !window.V2Fit) throw new Error('live renderer did not load');
if (PC.SPECIES.some(function (s) { return s.id === 'ye'; })) throw new Error('Ye is already in the live species list');

PC.SPECIES.push(Ye.SPECIES);
BG.DEFS[Ye.SHADES.id] = Ye.SHADES;
if (R.GEAR_BY_ID) {
  R.GEAR_BY_ID[Ye.SHADES.id] = { id: Ye.SHADES.id, label: Ye.SHADES.label, slot: 'face', tier: 3, origin: 'ye', exclusive: true, legendary: true, sig: true, overlay: true, noRoll: true, w: 0 };
}

var DNA = 'a7'.repeat(32);
function art(species) {
  return {
    species: species, dna: DNA, eyes: 'classic', pattern: 'none',
    background: 'solid', bgColor: '#1d2b53', tier: 'legendary', tierIndex: 3,
    cheeks: false
  };
}
function frames(a, stage, items, extra) {
  var fr = VR.anatomyFramesWith(a, stage, items || [], extra || [], 5, {});
  if (!fr || !fr[0] || !fr[0].data || fr[0].data.length !== 4096) throw new Error('bad frame for ' + a.species + ' stage ' + stage);
  return fr.map(function (f) { return Array.from(f.data); });
}
function one(a, stage, items, extra) { return frames(a, stage, items, extra)[0]; }

var shades = ['ye-shades'];
var ye = art('ye');
var stages = [1, 2, 3, 4, 5].map(function (s) {
  return { stage: s, with: one(ye, s, [], shades), bare: one(ye, s, [], []) };
});
var bob = frames(ye, 3, [], shades).map(function (d, i) { return { frame: i, px: d }; });

/* One live piece per v2 slot. Head is an overlay hat (the PR #40 fitter).
 * Body is legendary gold armour (torso box). Back is the legendary midnight cape. */
function idLike(slot, test) {
  var hit = null;
  Object.keys(R.GEAR_BY_ID).forEach(function (k) {
    var it = R.GEAR_BY_ID[k];
    if (hit || !it || it.slot !== slot || it.exclusive) return;
    if (test(it, k)) hit = k;
  });
  return hit;
}
var headId = R.GEAR_BY_ID['hard-hat'] ? 'hard-hat' : idLike('head', function (it) { return it.src !== 'core'; });
var handId = R.GEAR_BY_ID['feels-mug'] ? 'feels-mug' : idLike('hand', function () { return true; });
var feetId = idLike('feet', function (it, k) { return /sneaker|slipper|boot|flipper|paw|croc|loafer|tabi/.test((it.label || '') + k); }) || idLike('feet', function () { return true; });
var bodyId = 'gold';
var backId = 'midnight';
if (!headId || !handId || !feetId || !R.GEAR_BY_ID[bodyId] || !R.GEAR_BY_ID[backId]) {
  throw new Error('missing gear ids ' + JSON.stringify({ headId: headId, handId: handId, feetId: feetId, body: !!R.GEAR_BY_ID[bodyId], back: !!R.GEAR_BY_ID[backId] }));
}
var slotItems = [
  { slot: 'Headwear', id: headId, items: [headId], extra: shades },
  { slot: 'Guise', id: 'ye-shades', items: [], extra: shades },
  { slot: 'Drip', id: backId, items: [backId], extra: shades },
  { slot: 'Outfits', id: bodyId, items: [bodyId], extra: shades },
  { slot: 'Grip', id: handId, items: [handId], extra: shades },
  { slot: 'Footwear', id: feetId, items: [feetId], extra: shades }
];
var worn = slotItems.map(function (s) {
  return { slot: s.slot, id: s.id, label: (R.GEAR_BY_ID[s.id] || Ye.SHADES).label, px: one(ye, 3, s.items, s.extra) };
});
var allIds = slotItems.filter(function (s) { return s.id !== 'ye-shades'; }).map(function (s) { return s.id; });
var allOn = { slot: 'All six', id: 'all', label: 'All six slots', px: one(ye, 3, allIds, shades) };

function hybrid(shape, color) {
  var a = art(shape);
  a.hybrid = { key: 'hyb:' + shape + ':' + color, shape: shape, color: color, feature: 'head', eyes: 'classic', parts: [], roots: [shape, color] };
  var extra = shape === 'ye' ? shades : [];
  return { shape: shape, color: color, px: one(a, 3, [], extra) };
}
var crosses = [
  hybrid('ye', 'pepe'), hybrid('ye', 'doge'), hybrid('ye', 'wojak'), hybrid('ye', 'dodo'),
  hybrid('pepe', 'ye'), hybrid('doge', 'ye')
];
var wearers = ['pepe', 'peepo', 'doge', 'wojak'].map(function (sp) {
  return { species: sp, px: one(art(sp), 3, [], shades) };
});

var out = {
  stages: stages, bob: bob, worn: worn, allOn: allOn, crosses: crosses, wearers: wearers,
  gear: { head: headId, hand: handId, feet: feetId, body: bodyId, back: backId },
  rules: 'js/v2-rules.js'
};
var dest = process.argv[2] || path.join(__dirname, 'frames.json');
fs.writeFileSync(dest, JSON.stringify(out));
console.log('wrote', dest, 'gear', JSON.stringify(out.gear));
