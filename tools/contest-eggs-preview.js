#!/usr/bin/env node
/* DRAFT preview dump for the contest eggs (dev only): writes frames JSON; tools/contest-eggs-preview.py turns it into PNG sheets. */
'use strict';
const C = require('../js/contest-sprite.js'), K = require('../js/kek-sprite.js'), fs = require('fs');
const out = { strips: {}, gear: {}, hybrids: [], ref: [] }, bg = '#14101e';
/* before/after for the Star-Lord v2 redesign: the old art is read from git commit 7067b53 */
try { const src = require('child_process').execSync('git show 7067b53:js/contest-sprite.js', { cwd: __dirname + '/..' }).toString(), m = { exports: {} }; new Function('module', 'exports', src)(m, m.exports);
  out.slOld = [0, 1, 2, 3, 4, 5].map(s => m.exports.render('starlordkek', s, 0, bg).data); } catch (e) { out.slOld = null; }
C.SPECIES.forEach(sp => { out.strips[sp] = [0, 1, 2, 3, 4, 5].map(s => C.frames(sp, s, bg).map(f => f.data));
  const G = { head: { label: 'Party crown', cols: ['#ffd23f', '#c49a1a'] }, hand: { label: 'Torch', cols: ['#8a5a2a', '#ff8a2a'] }, back: { label: 'Cape', cols: ['#2bb5c8'] }, feet: { label: 'Boots', cols: ['#6b3f1f', '#4a2a12'] } };
  if (sp === 'starlordkek') out.slNew = [0, 1, 2, 3, 4, 5].map(s => C.render(sp, s, 0, bg).data);
  out.gear[sp] = [3, 5].map(s => C.render(sp, s, 0, bg, G).data); });
/* BABIES (owner Oct 25 2026): no signature parts. contest x normal = the partner's species; contest x contest = one normal random species.
 * Drawn with the normal in-game pet renderer (PetCore), same as any bred egg. */
const L = require('./lib/load-rules'), ctx = L.load(), PC = ctx.PetCore, V = ctx.V2Rules, h = i => require('crypto').createHash('sha256').update('contest-baby-' + i).digest('hex');
const babyFr = (sp, i) => [0, 1, 3, 5].map(st => { const a = PC.generate({ blockHash: h(i), petId: 'baby' + i, blockHeight: 973500 }); a.species = sp; return Array.from(PC.render(a, { stage: st, frame: 0 }).data); });
[['starlordkek', 'pepe'], ['gooby', 'doge'], ['lukespam', 'wojak'], ['starlordkek', 'gooby'], ['gooby', 'lukespam'], ['lukespam', 'starlordkek']].forEach(([a, b], i) => {
  const both = V.isContestSp(a) && V.isContestSp(b), sp = both ? V.pickSpecies12(h(i)) : (V.isContestSp(a) ? b : a);
  out.hybrids.push({ a, b, sp, both, frames: babyFr(sp, i) }); });
out.ref = [0, 1, 2, 3, 4, 5].map(s => K.render(s, 0, '#2a3a2e').data);
fs.writeFileSync(process.argv[2] || '/tmp/contest-frames.json', JSON.stringify(out));
