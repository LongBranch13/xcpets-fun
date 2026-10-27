#!/usr/bin/env node
/* PET ANIMATIONS PREVIEW (branch pet-animations, preview tooling only; not loaded by any page).
 * Rebuilds the world from api/boot.json with the game's own scripts (tools/api-feed.js context) and dumps the REAL
 * game sprite frames (32x32, Adult stage, no gear) for every pet kind, keyed out on two background colours so the
 * sprite pixels are exact. Output: JSON {kind: {label, frames:[[rgba hex or null x1024] ...]}} for make_anims.py.
 *   node tools/pet-animations/extract.js OUT.json [stage]  */
'use strict';
const path = require('path'), fs = require('fs'), vm = require('vm'), ROOT = path.resolve(__dirname, '..', '..');
const F = require(path.join(ROOT, 'tools/api-feed.js'));
const ctx = F.context(); ctx.setInterval = () => 0; ctx.clearInterval = () => {}; ctx.document.head = { appendChild() {} }; ctx.document.addEventListener = undefined;
for (const f of ['js/wizard-sprite.js', 'js/kek-sprite.js', 'js/funtrump-sprite.js', 'js/contest-sprite.js', 'js/dan-sprite.js', 'js/v2-bg.js', 'js/v2-looks.js', 'js/v2-render.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
const b = JSON.parse(fs.readFileSync(path.join(ROOT, 'api/boot.json'), 'utf8')), V = ctx.V2Rules, R = ctx.V2Render, E = ctx.LiveEngine;
const w = V.replay(b.rows, Object.assign({}, ctx.XCPETS_BLOCK_HASHES || {}, b.hashes), [], { tip: b.tip, live: E && E.RealCore });
const STAGE = +(process.argv[3] || 3), A = '#ff00fe', B = '#00ff01';
const solid = (art, bg) => Object.assign({}, art, { background: 'solid', bgColor: bg, pattern: 'none' });
const hex = (d, i) => '#' + [d[i], d[i + 1], d[i + 2]].map(v => v.toString(16).padStart(2, '0')).join('');
function key(fa, fb) { return fa.map((f, n) => { const a = f.data, c = (fb[n] || fb[0]).data, o = []; for (let i = 0; i < 4096; i += 4) { const ha = hex(a, i), hb = hex(c, i); o.push(ha === hb ? ha : null); } return o; }); }
const plain = p => p.art && (!p.art.eyes || p.art.eyes === 'classic') && !p.art.shades && !p.art.powered && !(p.art.tierIndex >= 3); /* classic eyes, no shades: closest to the Pet Guide look */
const first = sp => w.pets.find(p => p.species === sp && !p.dead && !p.released && plain(p)) || w.pets.find(p => p.species === sp && !p.dead && !p.released) || w.pets.find(p => p.species === sp);
const out = { tip: b.tip, stage: STAGE, kinds: {} };
function add(id, label, src, mk) { try { const fr = key(mk(A), mk(B)); out.kinds[id] = { label, src, frames: fr }; console.log('ok', id, fr.length, 'frames', src); } catch (e) { console.log('FAIL', id, e.message); } }
const pet = (id, label, p) => add(id, label, '#' + p.id + ' ' + p.name + ' (' + p.species + ')', bg => R.framesWith(solid(p.art, bg), STAGE, [], []));
['pepe', 'wojak', 'chud', 'peepo', 'doge', 'bobo', 'mumu', 'sarutobi', 'lenny', 'snibby', 'kevin', 'dodo', 'nakamoto', 'wizard', 'kek'].forEach(sp => { const p = first(sp); if (p) pet(sp, (ctx.PetCore.SPECIES.find(s => s.id === sp) || {}).label || sp, p); else console.log('none', sp); });
add('funtrump', 'FUNTRUMP', 'FuntrumpSprite community', bg => ctx.FuntrumpSprite.frames(STAGE, bg, {}, { community: true }));
add('wizard-community', 'Bitcoin Wizard (community)', 'WizardSprite community', bg => ctx.WizardSprite.frames(STAGE, bg, { head: ctx.WizardSprite.WIZARD_HAT }, { community: true }));
add('kek-community', 'Lord Kek (community)', 'KekSprite community', bg => ctx.KekSprite.frames(STAGE, bg, {}, { community: true }));
ctx.ContestSprite.SPECIES.forEach(sp => add(sp, ctx.ContestSprite.NAMES ? (ctx.ContestSprite.NAMES[sp] && (ctx.ContestSprite.NAMES[sp].name || ctx.ContestSprite.NAMES[sp])) || sp : sp, 'ContestSprite ' + sp, bg => ctx.ContestSprite.frames(sp, STAGE, bg, {})));
/* edition pets: petFramesRaw keeps the Burn Lord / supreme edition look (burnLordFx) */
const ed = (id, label, p) => add(id, label, '#' + p.id + ' ' + p.name + ' (' + p.species + ')', bg => R.petFramesRaw(Object.assign({}, p, { stage: STAGE, art: solid(p.art, bg) }), w, { noHunger: true, noLooks: true }));
const bl = w.pets.find(p => p.burnLord && p.burnLord.n === 1); if (bl) ed('burnlord', 'Burn Lord', bl);
const kz = w.pets.find(p => p.supreme && p.supreme.id === 'archmage'); if (kz) ed('kekamozard', 'Lord Kekamozard', kz);
const dn = w.pets.find(p => p.supreme && p.supreme.id === 'don'); if (dn) ed('don', 'Don Kekamoto', dn);
/* hybrid families: one 2-way and one 3-way (hybrids reuse the body-shape kind's animation, see plan.md) */
[['hyb:doge:wojak', 'hybrid2', 'Hybrid (2-way)'], ['hyb3:mumu:dodo:doge', 'hybrid3', 'Hybrid (3-way)']].forEach(([s, id, l]) => { const p = first(s); if (p) ed(id, l + ' ' + p.name, p); });
const hy = {}; w.pets.filter(p => p.hybrid && !p.burnLord && !p.supreme).forEach(p => { hy[p.species] = (hy[p.species] || 0) + 1; });
out.hybrids = hy; out.community = w.community && { current: w.community.current };
fs.writeFileSync(process.argv[2] || '/tmp/pet-frames.json', JSON.stringify(out)); console.log('wrote', Object.keys(out.kinds).length, 'kinds; hybrid keys', Object.keys(hy).length);
