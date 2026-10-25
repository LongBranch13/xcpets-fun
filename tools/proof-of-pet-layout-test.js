/* Proof of Pet token badge layout (owner Oct 24 2026 "Check mark covers name"): name, rarity and token lines never touch each other, the
 * art or the seal, and stay inside the frame (no ink at rows >= 117 or in the corner squares), for short, long (16-letter) names and long assets. */
'use strict';
const N = require('../js/v2-papers.js'); let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log('FAIL ' + m); } };
const B = N.render({ id: 1, name: '', tier: '', speciesLabel: '', asset: '' }, null, 'token');
const S = N.render({ id: 1, name: '', tier: '', speciesLabel: '', asset: '' }, new Uint8ClampedArray(4096).fill(255), 'token');
const cases = [['Zolu', 1643, 'Legendary', 'Bobo', 'A16220480534474716542'], ['Doodiwikinbit', 5301, 'Common', 'Pepe', 'A13371337133713371337'],
  ['Zooyokoopopipbun', 99999, 'Legendary', 'Funtrump', 'A18446744073709551615'], ['Mo', 1, 'Common', 'Bobo', 'A100000000000000001'], ['Nusa', 1111, 'Uncommon', 'Pepe', 'A9059073792275355799']];
let artBottom = 0, sealTop = 128; for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) { const i = (y * 128 + x) * 4; if (S.data[i] !== B.data[i]) artBottom = Math.max(artBottom, y); if (x > 90 && y > 30 && B.data[i] !== N.render({ id: 1, name: '', tier: '', speciesLabel: '', asset: '' }, null, 'token').data[i]) sealTop = 0; }
for (const c of cases) { const r = N.render({ name: c[0], id: c[1], tier: c[2], speciesLabel: c[3], asset: c[4] }, null, 'token'), rows = [];
  let minx = 999, maxx = 0, seal = false;
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) { const i = (y * 128 + x) * 4; if (r.data[i] === B.data[i] && r.data[i + 1] === B.data[i + 1] && r.data[i + 2] === B.data[i + 2]) continue;
    if (y < 90) { if (y > 28) seal = true; continue; } if (!rows.includes(y)) rows.push(y); minx = Math.min(minx, x); maxx = Math.max(maxx, x); if (y >= 111) ok(x >= 14 && x <= 113, c[0] + ' token ink in corner x' + x); }
  rows.sort((a, b) => a - b); const g = []; rows.forEach(y => { const L = g[g.length - 1]; if (L && y === L[1] + 1) L[1] = y; else g.push([y, y]); });
  ok(g.length === 3, c[0] + ' expected 3 separate text lines, got ' + JSON.stringify(g)); ok(rows[0] > artBottom, c[0] + ' text touches art'); ok(rows[rows.length - 1] <= 116, c[0] + ' text clipped by frame');
  ok(!seal, c[0] + ' text drawn in the art/seal area'); ok(minx >= 12 && maxx <= 115, c[0] + ' text outside frame x ' + minx + '..' + maxx);
  console.log(c[0], JSON.stringify(g), 'x', minx, maxx); }
console.log(bad ? bad + ' FAILED' : 'proof-of-pet-layout: all ok'); process.exit(bad ? 1 : 0);
