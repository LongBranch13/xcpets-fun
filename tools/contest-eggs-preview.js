#!/usr/bin/env node
/* DRAFT preview dump for the contest eggs (dev only): writes frames JSON; tools/contest-eggs-preview.py turns it into PNG sheets. */
'use strict';
const C = require('../js/contest-sprite.js'), K = require('../js/kek-sprite.js'), fs = require('fs');
const out = { strips: {}, gear: {}, hybrids: [], ref: [] }, bg = '#14101e';
C.SPECIES.forEach(sp => { out.strips[sp] = [0, 1, 2, 3, 4, 5].map(s => C.frames(sp, s, bg).map(f => f.data));
  const G = { head: { label: 'Party crown', cols: ['#ffd23f', '#c49a1a'] }, hand: { label: 'Torch', cols: ['#8a5a2a', '#ff8a2a'] }, back: { label: 'Cape', cols: ['#2bb5c8'] }, feet: { label: 'Boots', cols: ['#6b3f1f', '#4a2a12'] } };
  out.gear[sp] = [3, 5].map(s => C.render(sp, s, 0, bg, G).data); });
[['starlordkek', 'gooby'], ['gooby', 'starlordkek'], ['lukespam', 'starlordkek'], ['starlordkek', 'lukespam'], ['gooby', 'lukespam'], ['lukespam', 'gooby']].forEach(([b, d]) =>
  out.hybrids.push({ body: b, donor: d, frames: [0, 1, 3, 5].map(s => C.hybrid(b, d, s, 0, bg, d).data) }));
out.ref = [0, 1, 2, 3, 4, 5].map(s => K.render(s, 0, '#2a3a2e').data);
fs.writeFileSync(process.argv[2] || '/tmp/contest-frames.json', JSON.stringify(out));
