/* FUNTRUMP flags preview dump (branch funtrump-flags, PREVIEW): node design/art/src/funtrump_flags_previews.js > /tmp/ft-flags.json; then funtrump_flags_previews.py. */
const path = require('path'); process.argv = [process.argv[0], path.join(__dirname, '../../../tools/community-pet-check.js'), '--pet', 'none'];
const fs = require('fs'), ROOT = path.resolve(__dirname, '../../..');
const src = fs.readFileSync(path.join(ROOT, 'tools/community-pet-check.js'), 'utf8').replace(/^#!.*\n/, '').split('const out = {')[0] + 'module.exports={ctx,V,R,P,baseArt,planFor};';
const m = { exports: {} }; new Function('require', 'module', '__dirname', 'process', src)(require, m, path.join(ROOT, 'tools'), process); const { ctx, R, baseArt, planFor } = m.exports;
const px = img => Array.from(img.data);
const ftA = look => Object.assign(baseArt('funtrump'), { bgColor: '#1f2a44', ftLook: look, tierIndex: look === 'hoodie' ? 3 : 2 });
const FL = [['ft-us-flag', 'American flag (Grip T2)'], ['ft-kek-flag', 'Kekistan flag (Grip T1)']], out = { rows: [], hyb: [] };
for (const look of ['suit', 'hoodie']) for (const [id, lab] of FL) out.rows.push({ label: look.toUpperCase() + ' + ' + lab, cells: [0, 1, 2, 3, 4, 5].map(st => px(R.framesWith(ftA(look), st, [id])[0])) });
const hy = [['FT body x pepe', 'hyb:funtrump:pepe', { shape: 'funtrump', color: 'pepe', feature: 'head' }, 'pepe'], ['doge x FT colours', 'hyb:doge:funtrump', { shape: 'doge', color: 'funtrump', feature: 'head' }, 'doge']];
for (const [lab, sp, pl, base] of hy) { const p = planFor(sp, pl); const art = Object.assign(baseArt(pl.shape === 'funtrump' ? 'funtrump' : base), { hybrid: p });
  out.hyb.push({ label: lab, cells: FL.map(([id]) => px(R.framesWith(art, 4, [id])[0])) }); }
process.stdout.write(JSON.stringify(out));
