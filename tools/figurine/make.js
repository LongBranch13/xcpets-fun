#!/usr/bin/env node
/* FIGURINES (Nov 24 2026): pet # -> a full-colour voxel figurine ready for a print service, plus pictures for the player.
 *
 *   node tools/figurine/make.js --ids 205424            one pet, 75 mm tall (the "standard" size)
 *   node tools/figurine/make.js --ids 1,27 --size big   sizes: mini 50 mm, standard 75 mm, big 100 mm (or --height MM)
 *   node tools/figurine/make.js --sprite FILE.json      skip the replay and use a saved sprite (sprite.json from an earlier run)
 *   options: --out DIR (default figurines/)   --allow-stop (species marked stop in species-check.json)
 *
 * For each pet it writes DIR/pet-<id>/:
 *   xcpets-<id>-<size>-obj.zip  OBJ + MTL + PNG colours in one zip: the file to upload for full-colour printing
 *   xcpets-<id>-<size>.3mf      the same model as 3MF (colour per triangle), the other format print services take
 *   preview.png                 a big picture to show the player before ordering
 *   spin.gif                    the figurine turning around (for Telegram)
 *   order.txt                   size, volume, warnings and the species check, to copy into the order
 *   sprite.json                 the pet's pixels, so a re-size never needs the replay again
 * The pet is drawn by the site's own renderer at the feed's latest block (api/boot.json), so gear, hybrid looks, stage and
 * zombie looks are exactly what the player sees. Display only: never changes the game. */
'use strict';
const fs = require('fs'), path = require('path');
const V = require('./voxel.js'), R = require('./render.js'), ART = require('../../hatchbot/art.js');
const A = process.argv.slice(2), opt = k => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : null; }, flag = k => A.includes(k);
const SIZES = { mini: 50, standard: 75, big: 100 };
const CHECK = JSON.parse(fs.readFileSync(path.join(__dirname, 'species-check.json'), 'utf8'));

function speciesLevel(species) {
  const roots = /^hyb3?:/.test(species || '') ? species.replace(/^hyb3?:/, '').split(':') : [species];
  let lvl = 'ok', why = [];
  for (const r of roots) {
    const l = CHECK.stop.includes(r) ? 'stop' : CHECK.ask.includes(r) ? 'ask' : CHECK.ok.includes(r) ? 'ok' : 'ask';
    if (l !== 'ok') why.push(r + ' = ' + l + (CHECK.stop.includes(r) || CHECK.ask.includes(r) || CHECK.ok.includes(r) ? '' : ' (not in the list yet)'));
    if (l === 'stop' || (l === 'ask' && lvl === 'ok')) lvl = l;
  }
  return { level: lvl, roots, why };
}

function sizeName(h) { const k = Object.keys(SIZES).find(k => SIZES[k] === h); return k || h + 'mm'; }

function makeOne(sprite, out, heightMm) {
  const id = sprite.id, info = sprite.info || {}, dir = path.join(out, 'pet-' + id), sz = sizeName(heightMm), base = 'xcpets-' + id + '-' + sz;
  const chk = speciesLevel(info.species);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'sprite.json'), JSON.stringify(sprite));
  if (chk.level === 'stop' && !flag('--allow-stop')) {
    const msg = 'NOT MADE: ' + (info.speciesLabel || info.species) + ' is marked "stop" in tools/figurine/species-check.json (' + chk.why.join(', ') + '). Run with --allow-stop only if Jake says so.';
    fs.writeFileSync(path.join(dir, 'order.txt'), msg + '\n'); console.log('#' + id + ' ' + msg); return { id, made: false, why: msg };
  }
  const fig = V.build(sprite, { heightMm });
  const ck = V.checkMesh(fig.mesh);
  if (ck.open || ck.nonManifold || ck.flipped || !(ck.volumeCm3 > 0)) throw new Error('#' + id + ': the mesh is not watertight (' + JSON.stringify(ck) + ')');
  const files = V.objFiles(fig, base);
  fs.writeFileSync(path.join(dir, base + '-obj.zip'), V.zip(files));
  fs.writeFileSync(path.join(dir, base + '.3mf'), V.threeMF(fig));
  const cap = String(info.name || 'PET').toUpperCase() + ' #' + id;
  const hero = R.sheet([R.still(fig, { size: 480, yaw: -28, caption: cap, top: 14 }), R.still(fig, { size: 480, yaw: -160, top: 14, footer: 'XCPETS.FUN FIGURINE' })], 0);
  fs.writeFileSync(path.join(dir, 'preview.png'), ART.png(hero, 1));
  fs.writeFileSync(path.join(dir, 'spin.gif'), R.turntable(fig, { size: 300, frames: 24, caption: cap, top: 10 }));
  const s = fig.stats, lines = [
    'XCPETS figurine of pet #' + id + ' ' + (info.name || '') + ' (' + (info.speciesLabel || info.species) + ', ' + (info.stageName || '') + (info.zombie ? ', zombie' : '') + ')',
    'Drawn at block ' + sprite.tip + (info.gear && info.gear.length ? ', wearing ' + info.gear.join(', ') : ', no gear worn'),
    '',
    'Size: ' + s.widthMm + ' x ' + s.depthMm + ' x ' + s.heightMm + ' mm (wide x deep x tall), units = millimetres',
    'Volume: ' + s.volumeCm3 + ' cm3 (solid)   Thinnest part: ' + s.thinnestMm + ' mm   Colours: ' + s.colors + '   Triangles: ' + s.triangles,
    'Plinth: ' + s.plinth + ' colours, name on the front, #' + id + ' on the back',
    'Watertight check: passed (every edge shared by exactly 2 triangles, outward normals)',
    '',
    'Species check: ' + chk.level.toUpperCase() + (chk.why.length ? ' (' + chk.why.join(', ') + ')' : '') +
      (chk.level === 'ask' ? '  -> fine as a one-off for the pet\'s owner; ask Jake before selling this species publicly' : ''),
    '',
    'Upload: ' + base + '-obj.zip (choose Full-Color Resin, units mm). If the site wants 3MF instead: ' + base + '.3mf',
    fig.notes.length ? 'Shape notes: ' + fig.notes.join('; ') : 'Shape notes: none'
  ];
  fs.writeFileSync(path.join(dir, 'order.txt'), lines.join('\n') + '\n');
  console.log('#' + id + ' ' + (info.name || '') + ': ' + s.widthMm + 'x' + s.depthMm + 'x' + s.heightMm + ' mm, ' + s.volumeCm3 + ' cm3, species ' + chk.level + ' -> ' + dir);
  return { id, made: true, stats: s, check: chk.level, dir };
}

async function main() {
  const out = path.resolve(opt('--out') || 'figurines');
  const heightMm = opt('--height') ? +opt('--height') : SIZES[opt('--size') || 'standard'];
  if (!(heightMm >= 30 && heightMm <= 200)) throw new Error('size must be mini, standard, big or --height 30..200');
  let sprites = [];
  if (opt('--sprite')) sprites = [JSON.parse(fs.readFileSync(opt('--sprite'), 'utf8'))];
  else {
    const ids = String(opt('--ids') || '').split(/[,\s]+/).map(s => s.replace(/^#/, '')).filter(Boolean).map(Number);
    if (!ids.length || ids.some(n => !(n > 0))) throw new Error('give pet numbers: --ids 205424 or --ids 1,27');
    const S = require('./sprite.js'), t0 = Date.now();
    console.log('Replaying the game to draw the pets (about a minute)...');
    const W = S.loadWorld(opt('--boot'));
    console.log('replayed to block ' + W.tip + ' in ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
    for (const id of ids) { try { sprites.push(S.petSprite(W, id)); } catch (e) { console.log('#' + id + ': ' + e.message); process.exitCode = 1; } }
  }
  const res = [];
  for (const s of sprites) res.push(makeOne(s, out, heightMm));
  fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(res, null, 1));
}
if (require.main === module) main().catch(e => { console.error(e.message || e); process.exit(1); });
module.exports = { makeOne, speciesLevel, SIZES };
