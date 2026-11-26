#!/usr/bin/env node
/* homer-songs-test: Homer Pepe's new Pantheon songs and his stage (Nov 26 2026, display only; js/v2-rules.js untouched).
 * Checks: the Prologue counts the Mythics eaten and lost at the gate; a Lament names the Mythic, its zombie and the real roll;
 * The Fall and The Usurper name both Gods and the seat; every song is stable (same words for every visitor) and carries no wallet;
 * a slim fast world (no Mythic God table) gets no laments; the stage's lyre stays silent while sound is off.
 *   node tools/homer-songs-test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { load, ROOT } = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const c = load(['js/v2-mythic-god.js', 'js/v2-pantheon.js']), P = c.V2Pantheon;
ok(P && ['prologue', 'lament', 'fallSong', 'usurpSong', 'coda', 'dusted'].every(k => typeof P[k] === 'function'), 'song functions load');
const ADDR = 'bc1qexampleowneraddressshouldnotappearxx';
const dust = { kind: 'dust', block: 977120, roll: 8171, need: 3967 };
const w = { byId: {
  19801: { id: 19801, name: 'Saru', species: 'dodo', owner: ADDR, graveState: 'dust', mgDead: { block: 977107 }, zPast: [{ end: dust }] },
  50836: { id: 50836, name: 'Vavabun', species: 'kevin', owner: ADDR },
  700: { id: 700, name: 'Zoka', species: 'pepe', owner: ADDR, mythicGod: { seat: 3 } },
  701: { id: 701, name: 'Fuwa', species: 'pepe', owner: ADDR, mythicGod: { seat: 3 } } },
  cem: { mg: { seats: [], meals: [{ block: 977107, zombie: 50836, mythic: 19801, owner: ADDR, n: 3 }], unleash: [] } } };
const all = [];
const pro = P.prologue(w, [], true); all.push(pro);
ok(pro.join(' ').indexOf('1 Mythic was eaten') >= 0 && pro.join(' ').indexOf('1 of them turned to dust') >= 0 && /every one of them empty/.test(pro[0]), 'Prologue counts the real meals and the dust: ' + pro[2]);
ok(/Keeper of the Genesis Block/.test(pro.join(' ')), 'Prologue names the next open seat');
const d = P.dusted(w); ok(d.length === 1 && d[0].mythic === 19801, 'dusted() finds the Mythic lost at the gate');
const lam = P.lament(d[0], w); all.push(lam);
ok(lam.length === 6 && /Saru/.test(lam.join(' ')) && /Vavabun/.test(lam.join(' ')) && /81\.71%/.test(lam.join(' ')) && /39\.67%/.test(lam.join(' ')), 'Lament names Saru, its zombie Vavabun and the real roll (81.71% vs 39.67%)');
ok(JSON.stringify(P.lament(d[0], w)) === JSON.stringify(lam), 'Lament is the same for every visitor');
const w2 = JSON.parse(JSON.stringify(w)); delete w2.byId[19801].zPast[0].end.roll; const lam2 = P.lament(w2.cem.mg.meals[0], w2);
ok(!/undefined|NaN|\{ROLL\}/.test(lam2.join(' ')), 'Lament without a stored roll still reads cleanly');
const slim = JSON.parse(JSON.stringify(w)); slim.cem._slim = true; ok(P.dusted(slim).length === 0, 'a slim fast world gets no laments (no half-read graves)');
const B = { n: 1, seat: 3, winner: 701, loser: 700, block: 978123, tx: 'tx-b1' };
const fall = P.fallSong(B, w), us = P.usurpSong(B, w); all.push(fall, us);
ok(fall.length === 8 && /Zoka/.test(fall.join(' ')) && /Fuwa/.test(fall.join(' ')) && /Fallen|fall/i.test(fall.join(' ')) && /(Seat III|third)/.test(fall.join(' ')), 'The Fall names the fallen God, the challenger and Seat III');
ok(us.length === 6 && /Fuwa/.test(us.join(' ')) && /Zoka/.test(us.join(' ')) && /Oracle of the Halving/.test(us.join(' ')), 'The Usurper names the new holder, the God it beat and the seat title');
ok(JSON.stringify(P.fallSong(B, w)) === JSON.stringify(fall) && JSON.stringify(P.usurpSong(B, w)) === JSON.stringify(us), 'battle songs are stable');
ok(typeof P.coda('lament-19801') === 'string' && P.coda('x') === P.coda('x'), 'Homer\'s aside is stable');
const txt = all.map(a => a.join('\n')).join('\n');
ok(!/bc1|\{[A-Z]+\}|undefined|NaN/.test(txt), 'no wallet address, no unfilled {FIELD}, no undefined in any song');
[P.LAMENT, P.FALL, P.USURP].forEach((T, i) => ok(T.every(v => Array.isArray(v) && v.length >= 2), 'song ' + i + ': every line has 2+ variants'));
/* the stage: parses, exposes mount, and the lyre is silent while the shared sound setting is off */
const g = { window: {}, document: {}, location: { search: '' } }; g.window = g; vm.createContext(g);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/v2-homer-stage.js'), 'utf8'), g);
ok(g.V2HomerStage && typeof g.V2HomerStage.mount === 'function' && g.V2HomerStage.mount(null) === null, 'stage loads; mount(null) is a no-op');
g.V2Sfx = { on: () => false }; ok(g.V2HomerStage.pluckSound(0, 'rise') === false, 'lyre is silent while sound is off');
const page = fs.readFileSync(path.join(ROOT, 'pantheon.html'), 'utf8');
ok(page.indexOf('js/v2-homer-stage.js?v=') >= 0 && page.indexOf('js/v2-sfx.js?v=') >= 0 && page.indexOf('js/v2-homer-stage.js') < page.indexOf('js/v2-pantheon.js'), 'pantheon.html loads the stage and the sound switch before the Pantheon script');
console.log('homer-songs-test: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
