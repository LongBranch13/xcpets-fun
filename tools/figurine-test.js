#!/usr/bin/env node
/* Figurine maker (tools/figurine, Nov 24 2026): every model must be one closed, watertight, outward-facing surface,
 * corner-only pixel contacts and floating bits must be handled, and the print files must be well formed. No replay needed:
 * it uses the saved sprites in tools/figurine/samples plus small made-up sprites. */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const V = require('./figurine/voxel.js'), M = require('./figurine/make.js'), R = require('./figurine/render.js');
let bad = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) bad++; };
const tight = (fig, m) => { const c = V.checkMesh(fig.mesh); ok(!c.open && !c.nonManifold && !c.flipped && c.volumeCm3 > 0 && Math.abs(c.volumeCm3 - fig.stats.volumeCm3) < 0.2, m + ' is watertight with outward normals ' + JSON.stringify(c)); };
function fake(rows, info) { const h = rows.length, w = rows[0].length, rgba = [], mask = [];
  rows.forEach(r => r.split('').forEach(ch => { const on = ch !== '.'; mask.push(on ? 1 : 0); rgba.push(on ? 200 : 0, ch === 'x' ? 40 : 120, 90, 255); }));
  return { id: 7, w, h, rgba, mask, tip: 1, info: Object.assign({ name: 'TEST', species: 'dodo', tier: 2, stage: 2 }, info || {}) }; }

/* corner-only contacts (non-manifold edges if left alone) */
const diag = V.build(fake(['#...', '.#..', '..#.', '...#', '####']), { heightMm: 40 });
tight(diag, 'diagonal staircase');
ok(diag.notes.some(n => /corner-touching/.test(n)), 'corner-touching pixels are filled');
/* a floating part close by is bridged, a far speck is dropped */
const isl = V.build(fake(['.##.....', '.##.....', '........', '.####...', '.####...', '.####..#']), { heightMm: 40 });
tight(isl, 'floating parts');
ok(isl.notes.some(n => /joined a floating part/.test(n)), 'a nearby floating part is joined: ' + isl.notes.join('; '));
ok(isl.notes.some(n => /tiny floating speck/.test(n)), 'a 1-px speck is dropped');
/* a checkerboard is the worst case for the clean-up pass */
const chk = V.build(fake(['#.#.#.', '.#.#.#', '#.#.#.', '######']), { heightMm: 40 });
tight(chk, 'checkerboard');

/* real sprites drawn by the site renderer */
for (const f of fs.readdirSync(path.join(__dirname, 'figurine/samples'))) {
  const s = JSON.parse(fs.readFileSync(path.join(__dirname, 'figurine/samples', f), 'utf8'));
  for (const h of [50, 75, 100]) {
    const fig = V.build(s, { heightMm: h });
    tight(fig, f + ' at ' + h + ' mm');
    ok(Math.abs(fig.stats.heightMm - h) < 0.01, f + ' is ' + h + ' mm tall (' + fig.stats.heightMm + ')');
    ok(fig.stats.thinnestMm >= 1.5, f + ' thinnest part ' + fig.stats.thinnestMm + ' mm >= 1.5 mm (full-colour resin needs > 1 mm)');
  }
  const fig = V.build(s, { heightMm: 75 }), files = V.objFiles(fig, 'x');
  const obj = files['x.obj'], vt = (obj.match(/^vt /gm) || []).length, fl = (obj.match(/^f /gm) || []).length;
  ok(vt === fig.pal.length && fl === fig.stats.triangles && /map_Kd x\.png/.test(files['x.mtl']), f + ' OBJ has one texture point per colour and every triangle');
  ok(files['x.png'].slice(1, 4).toString() === 'PNG', f + ' colour texture is a PNG');
  const z = V.threeMF(fig);
  ok(z.readUInt32LE(0) === 0x04034b50 && z.includes(Buffer.from('3D/3dmodel.model')), f + ' 3MF is a zip with the model part');
  /* read the model back out of the zip and check its triangle count */
  const at = z.indexOf(Buffer.from('3D/3dmodel.model')), clen = z.readUInt32LE(at - 30 + 18), xml = zlib.inflateRawSync(z.slice(at + 16, at + 16 + clen)).toString();
  ok((xml.match(/<triangle /g) || []).length === fig.stats.triangles && /unit="millimeter"/.test(xml), f + ' 3MF model has every triangle, in millimetres');
  const im = R.still(fig, { size: 120 }); ok(im.w === 120 && im.d.length === 120 * 120 * 4, f + ' preview renders');
}
/* species check: hybrids take the strictest parent */
ok(M.speciesLevel('funtrump').level === 'stop', 'FUNTRUMP is stop');
ok(M.speciesLevel('hyb:dodo:funtrump').level === 'stop', 'a FUNTRUMP hybrid is stop');
ok(M.speciesLevel('dodo').level === 'ok', 'Dodo is ok');
ok(M.speciesLevel('hyb3:dodo:snibby:pepe').level === 'ask', 'a Pepe three-way hybrid is ask');
console.log(bad ? bad + ' FAILED' : 'all figurine checks passed');
process.exit(bad ? 1 : 0);
