/* Preview dumps for FUNTRUMP (branch funtrump-community): node design/art/src/funtrump_previews.js > /tmp/ft-prev.json; then funtrump_previews.py draws the sheets. */
const path = require('path'); process.argv = [process.argv[0], path.join(__dirname, '../../../tools/community-pet-check.js'), '--pet', 'none'];
const fs = require('fs'), vm = require('vm'), ROOT = path.resolve(__dirname, '../../..');
const src = fs.readFileSync(path.join(ROOT, 'tools/community-pet-check.js'), 'utf8').replace(/^#!.*\n/, '').split('const out = {')[0] + 'module.exports={ctx,V,R,P,baseArt,planFor};';
const m = { exports: {} }; new Function('require', 'module', '__dirname', 'process', src)(require, m, path.join(ROOT, 'tools'), process); const { ctx, V, R, baseArt, planFor } = m.exports;
const roots = ['pepe', 'wojak', 'chud', 'bobo', 'mumu', 'snibby', 'dodo', 'kevin', 'peepo', 'sarutobi', 'doge', 'lenny', 'nakamoto', 'wizard', 'kek'];
const px = img => Array.from(img.data); const out = { hyb: [], h3: [], gear: [], load: [] };
for (const o of roots) { const row = { root: o, name1: V.hybridName('hyb:funtrump:' + o), cells: [] };
  for (const [sh, co] of [['funtrump', o], [o, 'funtrump']]) for (const feat of ['head']) { const p = planFor('hyb:funtrump:' + o, { shape: sh, color: co, feature: feat }); const a = Object.assign(baseArt(sh), { species: sh, hybrid: p });
    for (const st of [0, 2, 3, 5]) row.cells.push({ label: sh + ' body s' + st, px: px(V.hybridFrames(a, { stage: st })[0]) }); }
  out.hyb.push(row); }
for (const tri of [['funtrump', 'pepe', 'kek'], ['funtrump', 'wizard', 'doge'], ['funtrump', 'wojak', 'mumu'], ['funtrump', 'bobo', 'nakamoto']]) { const key = 'hyb3:' + tri.join(':');
  for (const ord of [[0, 1, 2], [1, 0, 2], [2, 1, 0]]) { const p = planFor(key, { shape: tri[ord[0]], color: tri[ord[1]], featSp: tri[ord[2]] }); const a = Object.assign(baseArt(p.shape), { species: p.shape, hybrid: p });
    out.h3.push({ label: V.hybridName(key) + ' ' + p.shape[0] + '/' + p.color[0] + '/' + p.featSp[0], px: px(V.hybridFrames(a, { stage: 4 })[0]) }); } }
const ft = baseArt('funtrump'); ft.bgColor = '#1f2a44';
for (const id of Object.keys(V.GEAR_BY_ID).concat(['ft-hairspray'])) { const it = V.GEAR_BY_ID[id] || { slot: 'hand', label: 'Golden Hairspray' }; out.gear.push({ id, slot: it.slot, label: it.label || id, px: [1, 3, 5].map(s => px(R.framesWith(ft, s, [id])[0])) }); }
const bySlot = {}; Object.keys(V.GEAR_BY_ID).forEach(id => { const s = V.GEAR_BY_ID[id].slot; (bySlot[s] = bySlot[s] || []).push(id); });
const sets = [[], ['ft-hairspray'], Object.values(bySlot).map(a => a[0]), Object.values(bySlot).map(a => a[a.length - 1]), Object.values(bySlot).map(a => a[(a.length / 2) | 0])];
for (const ids of sets) out.load.push({ ids, px: [1, 2, 3, 4, 5].map(s => [0, 1, 2, 3].map(f => px(R.framesWith(ft, s, ids)[f]))) });
process.stdout.write(JSON.stringify(out));
