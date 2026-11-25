// Cross pets (art.cross, e.g. #205414 Nedeweb "Star-Lord Pigeon") keep their mixed name in the view summary, and the Telegram
// mini app (tg/app.js, which does not load the rules) shows it. Replays api/boot.json the way the server's builder does.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..'), S = require('./sync-server/snapshot'), Split = require('./sync-server/split');
const boot = JSON.parse(fs.readFileSync(path.join(ROOT, 'api/boot.json'), 'utf8'));
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
function knownHashes() { const x = { window: {} }; x.window.window = x.window; x.self = x.window; vm.createContext(x); vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/block-hashes.js'), 'utf8'), x); return x.window.XCPETS_BLOCK_HASHES || x.XCPETS_BLOCK_HASHES || {}; }
const ctx = S.workerFns(), w = S.replayWorld(ctx, boot.rows, Object.assign({}, knownHashes(), boot.hashes), boot.tip, boot.dex || null), V = ctx.V2Rules;
const names = Split.crossNamesOf(w, V), crosses = w.pets.filter(p => p && p.art && p.art.cross);
ok(crosses.length > 0, 'world has cross pets (' + crosses.length + ')');
ok(crosses.every(p => names[p.id] === V.petSpeciesLabel(p)), 'every cross pet has its rules name in the summary map');
ok(Object.keys(names).length === crosses.length, 'only cross pets are listed (' + Object.keys(names).length + ')');
const ned = w.pets[205414] && w.pets[205414].id === 205414 ? w.pets[205414] : w.pets.find(p => p && p.id === 205414);
if (ned && boot.tip >= 977400) ok(names[205414] === 'Star-Lord Pigeon', '#205414 Nedeweb is a Star-Lord Pigeon (' + names[205414] + ')');
ok(JSON.stringify(Split.crossNamesOf(w, {})) === '{}', 'no rules function: empty map, no crash');
/* the mini app's label */
const src = fs.readFileSync(path.join(ROOT, 'tg/app.js'), 'utf8');
const m1 = /  function spLabel\(s\) \{[^\n]*\n/.exec(src), m2 = /  function petSp\(p\) \{[^\n]*\n/.exec(src);
ok(!!m1 && !!m2, 'tg/app.js has spLabel and petSp');
const c = { S: { sum: { crossNames: names } } }; vm.createContext(c); vm.runInContext(m1[0] + m2[0], c);
const any = crosses[0];
ok(c.petSp(any) === names[any.id], 'mini app shows the cross name (' + c.petSp(any) + ')');
ok(c.petSp({ id: 1, species: 'pepe' }) === c.spLabel('pepe'), 'other pets keep the species name');
c.S.sum = null; ok(c.petSp(any) === c.spLabel(any.species), 'older summary without the map: species name, no crash');
ok(!/spLabel\(p\.species\)/.test(src), 'no pet label in tg/app.js reads p.species directly');
console.log(fails ? fails + ' failed' : 'all passed'); process.exit(fails ? 1 : 0);
