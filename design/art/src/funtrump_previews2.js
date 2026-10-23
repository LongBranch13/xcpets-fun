/* Phase-2 preview dumps (two looks + FUNTRUMP gear): node design/art/src/funtrump_previews2.js > /tmp/ft-prev2.json; then funtrump_previews2.py. PREVIEW only. */
const path = require('path'); process.argv = [process.argv[0], path.join(__dirname, '../../../tools/community-pet-check.js'), '--pet', 'none'];
const fs = require('fs'), ROOT = path.resolve(__dirname, '../../..');
const src = fs.readFileSync(path.join(ROOT, 'tools/community-pet-check.js'), 'utf8').replace(/^#!.*\n/, '').split('const out = {')[0] + 'module.exports={ctx,V,R,P,baseArt,planFor};';
const m = { exports: {} }; new Function('require', 'module', '__dirname', 'process', src)(require, m, path.join(ROOT, 'tools'), process); const { ctx, V, R, baseArt, planFor } = m.exports;
const px = img => Array.from(img.data), S = ctx.FuntrumpSprite, FT = ctx.V2Gear.FT_BATCH;
const ftA = (look) => Object.assign(baseArt('funtrump'), { bgColor: '#1f2a44', ftLook: look, tierIndex: look === 'hoodie' ? 3 : 2 });
const out = { looks: {}, gear: { ids: FT.map(x => [x[0], x[1], x[2], x[3], x[9] || (x[4] ? 'FUNTRUMP' : 'open')]), bodies: [] }, sig: [] };
for (const look of ['suit', 'hoodie']) out.looks[look] = [0, 1, 2, 3, 4, 5].map(st => [0, 1, 2, 3].map(f => px(S.render(st, f, '#1f2a44', {}, { look }))));
const p = planFor('hyb:funtrump:pepe', { shape: 'funtrump', color: 'pepe', feature: 'head' }), q = planFor('hyb:doge:funtrump', { shape: 'doge', color: 'funtrump', feature: 'head' });
const bodies = [['FT suit', 'funtrump', ftA('suit'), 2], ['FT hoodie', 'funtrump', ftA('hoodie'), 3], ['pepe', 'pepe', baseArt('pepe')], ['doge', 'doge', baseArt('doge')], ['wojak', 'wojak', baseArt('wojak')], ['wizard', 'wizard', baseArt('wizard')], ['kek', 'kek', baseArt('kek')],
  ['FT body x pepe', 'hyb', Object.assign(baseArt('funtrump'), { hybrid: p })], ['doge x FT colours', 'hyb', Object.assign(baseArt('doge'), { hybrid: q })]];
for (const [lab, sp, art, tier] of bodies) out.gear.bodies.push({ label: lab, cells: FT.map(x => V.eligible(x[0], sp, sp, tier) && !(sp === 'kek' && x[2] === 'head') ? px(R.framesWith(art, 4, [x[0]])[0]) : null) });
const kits = [['SUIT (Rare) + samurai sword', 'suit', ['ft-samurai-sword']], ['SUIT full kit: sword, FUN cap, aviators, hairspray', 'suit', ['ft-samurai-sword', 'ft-fun-cap', 'ft-aviators', 'ft-hairspray']],
  ['HOODIE (Legendary) + skateboard', 'hoodie', ['ft-skateboard']], ['HOODIE full kit: skateboard, FUN cap, aviators, gold phone', 'hoodie', ['ft-skateboard', 'ft-fun-cap', 'ft-aviators', 'ft-gold-phone']]];
for (const [lab, look, ids] of kits) out.sig.push({ label: lab, frames: [3, 5].map(st => R.framesWith(ftA(look), st, ids).map(px)) });
process.stdout.write(JSON.stringify(out));
