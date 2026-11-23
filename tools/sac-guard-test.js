// Sacrifice guard (js/v2-sac-guard.js): names Gods, Mythics, Legendaries, Wizards and recently fed pets before they are fed to a zombie,
// pledged or offered at an altar, and hooks into every place a pet can be picked for that. UI only. node tools/sac-guard-test.js [snap-file]
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { load, snap, run, ROOT } = require('./lib/load-rules.js');
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const c = load(), s = snap(process.argv[2]), w = run(c, s, [], s.tip);
vm.runInContext(rd('js/v2-sac-guard.js'), c);
const G = c.V2SacGuard; ok(G && typeof G.check === 'function' && typeof G.flags === 'function', 'V2SacGuard loads');
const has = (p, k) => G.flags(w, p, '').some(f => f.k === k);
const live = w.pets.filter(p => !p.dead && !p.community);
const leg = live.find(p => (p.tier | 0) >= 3 && p.stage < 5), myth = live.find(p => p.stage >= 5), wiz = live.find(p => p.species === 'wizard');
const plain = live.find(p => (p.tier | 0) === 0 && p.stage < 5 && p.species !== 'wizard' && !p.resurrected && (p.lastFed == null || w.tip - p.lastFed >= 288));
ok(leg && has(leg, 'leg'), 'a Legendary is flagged (#' + (leg && leg.id) + ')');
ok(myth && has(myth, 'mythic'), 'a Mythic is flagged (#' + (myth && myth.id) + ')');
ok(!wiz || has(wiz, 'wiz'), 'a Bitcoin Wizard is flagged');
ok(plain && G.flags(w, plain, '').length === 0, 'an unfed Common is not flagged (#' + (plain && plain.id) + ')');
ok(has(Object.assign({}, plain, { resurrected: true }), 'god'), 'a God (resurrected) is flagged');
ok(has(Object.assign({}, plain, { lastFed: w.tip - 10 }), 'fed'), 'a pet fed 10 blocks ago is flagged');
ok(!has(Object.assign({}, plain, { lastFed: w.tip - 300 }), 'fed'), 'a pet last fed 300 blocks ago is not');
let got = null; G.check({ w, ids: [plain.id], me: '', onGo: ids => { got = ids; } });
ok(got && got.length === 1 && got[0] === plain.id, 'nothing special: goes straight on, no sheet');

const hooks = { 'js/v2.js': /V2SacGuard\.check\(\{ w: w, ids: ids, me: ME/, 'js/v2-cem-sacrifice.js': /V2SacGuard\.check\(\{ w: w, ids: I/, 'js/v2-cemetery-altar.js': /V2SacGuard\.check\(\{ w: A\.ctx\.w, ids: pk/, 'js/v2-cemetery-scene.js': /function sgGo\(/ };
Object.keys(hooks).forEach(f => ok(hooks[f].test(rd(f)), f + ' asks the guard before sending'));
ok(/sgGo\(w, f, /.test(rd('js/v2-cemetery-scene.js')) && /sgGo\(w, r, /.test(rd('js/v2-cemetery-scene.js')), 'cemetery quick zombie meal and pledge both go through it');
const g = rd('templates/game.html'), cem = rd('cemetery.html');
ok(/"js\/v2-sac-guard\.js\?v=[0-9a-f]{10}"/.test(g) && /"js\/v2-sac-guard\.js\?v=[0-9a-f]{10}"/.test(cem), 'game pages and the cemetery load it');
console.log(fails ? fails + ' failed' : 'all passed'); process.exit(fails ? 1 : 0);
