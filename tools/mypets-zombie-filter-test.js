#!/usr/bin/env node
/* MY PETS ZOMBIE FILTER tests (dev only; mypets-zombie-filter, owner Oct 30 2026). Display only, no rule change.
 * js/v2-zombie-filter.js: All zombies / Hungry / Feral / Crumbling soon filters, Find-box zombie words, 'Zombie time left' sort,
 * plus the wiring in js/v2.js, js/v2-pet-search.js and the game pages.
 *   node tools/mypets-zombie-filter-test.js [snap-file-name] */
'use strict';
const fs = require('fs'), path = require('path');
const { load, snap } = require('./lib/load-rules');
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const S = snap(process.argv[2]), c = load(), V = c.V2Rules;
global.V2Rules = V; if (c.PetCore) global.PetCore = c.PetCore;
const ZF = require(path.join(ROOT, 'js', 'v2-zombie-filter.js'));
const PS = require(path.join(ROOT, 'js', 'v2-pet-search.js'));

/* 1) real engine on the real feed: the module reads the engine's own zombie view, and with no zombie nothing is filtered in */
const w = V.replay(S.rows, Object.assign({}, c.XCPETS_BLOCK_HASHES, S.hashes), [], { tip: S.tip, live: c.LiveEngine.RealCore });
const pets = Object.keys(w.pets).map(k => w.pets[k]), b = (w.tip || 0) + 1;
ok(typeof V.cemView === 'function' && typeof V.cemOfferWhy === 'function' && typeof V.cemOn === 'function', 'engine zombie view is there (cemView, cemOfferWhy, cemOn)');
const zs = pets.filter(ZF.isZ), cn = ZF.counts(w, pets, b, null);
ok(cn.all === zs.length, 'All zombies counts every risen zombie (' + cn.all + ')');
ok(pets.filter(p => !ZF.isZ(p)).every(p => ZF.info(w, p, b, p.owner) === null && !ZF.match('all', w, p, b, p.owner) && ZF.words(w, p, b, p.owner).length === 0), 'a pet that is not a zombie never passes a zombie filter');
ok(pets.slice(0, 50).every(p => ZF.match('', w, p, b, p.owner)), 'filter off keeps every pet');
zs.forEach(p => { const o = V.cemView(w, p, b), z = ZF.info(w, p, b, p.owner);
  ok(z && z.feral === !!o.feral && z.crumbleIn === o.crumbleIn && z.hungerLeft === o.hungerLeft, '#' + p.id + ': info is the engine zombie view'); });

/* 2) fake engine: every branch, no chain needed */
const Z = (id, feralAt, crumbleAt, owner, sp, name) => ({ id, owner: owner || 'me', name: name || 'Z' + id, species: sp || 'pepe', zombie: { feralAt, crumbleAt }, tier: 1 });
const B = 1000, fw = { tip: B - 1, pets: [] };
const a = Z(11, B + 300, B + 732), f1 = Z(12, B - 10, B + 422), f2 = Z(13, B - 400, B + 32, 'me', 'gooby', 'Rotten Kevin'), other = Z(14, B + 50, B + 482, 'them');
const live = { id: 20, owner: 'me', tier: 0 }, dust = { id: 15, owner: 'me', zombie: { feralAt: 1, crumbleAt: 2, end: { kind: 'dust' } } };
fw.pets = [a, f1, f2, other, live, dust];
let on = true, offer = true;
global.V2Rules = { cemOn: () => on, cemOfferWhy: (w2, p, me) => (offer && p.owner === me ? null : 'no'),
  cemView: (w2, p, bb) => ({ zombie: true, feral: p.zombie.feralAt <= bb, hungerLeft: Math.max(0, p.zombie.feralAt - bb), crumbleIn: Math.max(0, p.zombie.crumbleAt - bb) }) };
const run = (k, me) => fw.pets.filter(p => ZF.match(k, fw, p, B, me)).map(p => p.id);
const W = () => ({ tip: B - 1, pets: fw.pets }); /* fresh world object = fresh memo, like a new replay */
ok(run('all', 'me').join() === '11,12,13,14', 'All zombies: the risen ones, not dust, not a living pet');
ok(run('feral', 'me').join() === '12,13', 'Feral: the engine feral flag');
ok(run('soon', 'me').join() === '13', 'Crumbling soon: dust within ' + ZF.SOON + ' blocks (about a day)');
ok(run('hungry', 'me').join() === '11,12,13', 'Hungry: my zombies that can eat a zombie meal now (not someone else\'s)');
offer = false; let w2 = W(); ok(ZF.counts(w2, w2.pets, B, 'me').hungry === 0, 'Hungry: none when I have no pet a zombie may eat');
offer = true; on = false; w2 = W(); ok(ZF.counts(w2, w2.pets, B, 'me').hungry === 0, 'Hungry: none while the cemetery loop is off');
on = true; w2 = W(); ok(ZF.counts(w2, w2.pets, B, null).hungry === 0, 'Hungry: none with no wallet connected');
w2 = W(); const C = ZF.counts(w2, w2.pets, B, 'me'); ok(C.all === 4 && C.hungry === 3 && C.feral === 2 && C.soon === 1, 'counts ' + JSON.stringify(C));
ok(ZF.info(w2, f2, B, 'me').left === 32 && ZF.info(w2, a, B, 'me').left === 300, 'time left: to dust when feral, to feral when not');
w2 = W(); const srt = w2.pets.slice().sort(ZF.comparator(w2, B)).map(p => p.id);
ok(srt.join() === '13,12,14,11,15,20', 'Zombie time left sort: zombies first, least time left first, then the rest by pet # (' + srt + ')');
ok(ZF.words(w2, f2, B, 'me').join(' ') === 'zombie zombies risen undead feral hungry zombie meal crumbling crumble dust soon', 'zombie words');
/* Find box: number, name, species, plus zombie words (fake world needs byId-free hay: the search reads only the pet) */
global.V2Rules = Object.assign({}, global.V2Rules, { speciesLabel: s => s === 'gooby' ? 'Gooby' : 'Pepe' });
const find = q => { const ww = W(); ww.pets.forEach(p => { if (!p.owner) p.owner = 'me'; }); const m = PS.matcher(q, ww); return m ? ww.pets.filter(m).map(p => p.id) : null; };
const has = (q, id) => { const r = find(q); return r && r.indexOf(id) >= 0; };
ok(has('13', 13) && has('#13', 13), 'search: zombie by pet number');
ok(has('rotten kevin', 13) && !has('rotten kevin', 11), 'search: zombie by name');
ok(has('zombie gooby', 13) && !has('zombie gooby', 11), 'search: zombie by species');
ok(has('zombie feral', 12) && has('zombie feral', 13) && !has('zombie feral', 11) && !has('zombie', 20), 'search: zombie + feral words');
ok(has('crumbling', 13) && !has('crumbling', 12), 'search: crumbling word');

/* 3) wiring + copy */
const v2 = fs.readFileSync(path.join(ROOT, 'js', 'v2.js'), 'utf8'), mod = fs.readFileSync(path.join(ROOT, 'js', 'v2-zombie-filter.js'), 'utf8');
ok(/fS === 'ztime'/.test(v2) && /V2ZombieFilter\.match\(ZFK/.test(v2) && /id = 'zbGroup'/.test(v2) && /'\|z' \+ ZFK/.test(v2), 'v2.js: sort, filter, row and paging key wired');
ok(/NF\[nfK\] = !nfOnly; if \(NF\[nfK\] && ZFK\)/.test(v2), 'Never fed only stays optional and clears the zombie filter');
ok(/var PG = \{ n: 150, key: '' \}, NF = \{\}/.test(v2), 'Never fed only off by default');
['templates/game.html', 'play.html', 'fight.html', 'rare-room.html', 'breed.html', 'raid.html'].forEach(f => { const h = fs.readFileSync(path.join(ROOT, f), 'utf8');
  ok(/"js\/v2-zombie-filter\.js\?v=[0-9a-f]+"/.test(h) && /<option value="ztime">🧟 Zombie time left<\/option>/.test(h), f + ': zombie filter script and sort option'); });
const copy = (mod.match(/'[^']*'/g) || []).concat(ZF.KINDS.map(k => k[2] + ' ' + k[3])).join(' ') + ZF.rowHtml({ all: 4, hungry: 3, feral: 2, soon: 1 }, 'feral', 2) + ZF.rowHtml({ all: 1, hungry: 0, feral: 0, soon: 0 }, '', 0);
ok(!/×|\bprice|series|discount|G Money|\d\s?x\b|\bx\s?\d/i.test(copy), 'wording: no multiplier x, price, series, discount, G Money');
ok(/aria-pressed="true"/.test(ZF.rowHtml({ all: 1, hungry: 1, feral: 1, soon: 1 }, 'all', 1)) && /aria-pressed="false"/.test(ZF.rowHtml({ all: 1, hungry: 1, feral: 1, soon: 1 }, '', 1)), 'row: aria-pressed pills');

console.log('mypets zombie filter tests: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
