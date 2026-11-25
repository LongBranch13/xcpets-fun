#!/usr/bin/env node
/* Cemetery Gods door (Nov 24 2026, found by fastcheck): a fast page counted Gods from the pets it had loaded, so the door said
 * "0 / 2 / 6 brought back" while the game has 19. The server's summary now lists every living God (split.js godsOf -> summary.gods,
 * js/v2-split.js -> w._gods) and the cemetery's gods() merges it with the page's own pets.
 *   node tools/cem-gods-test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..'), rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let fails = 0, n = 0; const ok = (c, m) => { n++; console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const S = require('./sync-server/split');
const pets = [{ id: 1, resurrected: { block: 10 }, owner: 'a', name: 'A' }, { id: 2, resurrected: { block: 30 }, owner: 'b', name: 'B' }, { id: 3, resurrected: { block: 20 }, dead: true },
  { id: 4, owner: 'a' }, { id: 5, zombie: { gen: 1 } }];
const world = { pets };
const g = S.godsOf(world);
ok(JSON.stringify(g.map(x => x.id)) === '[2,1]', 'godsOf: living Gods only, newest first (' + g.map(x => x.id) + ')');
ok(g[0].owner === 'b' && g[0].block === 30 && g[0].name === 'B', 'godsOf keeps id, name, owner, block');
ok(/const gods = godsOf\(world\);[^]{0,1500}?\n  return spill\(\)/.test(rd('tools/sync-server/split.js')) && /\n    gods: gods,?\n/.test(rd('tools/sync-server/split.js')), 'the summary takes gods before spill() frees world.pets');
ok(/_gods: summary\.gods \|\| null/.test(rd('js/v2-split.js')), 'the fast world keeps them as w._gods');
/* the cemetery's gods(): run the real function text on a fast world that loaded only one God */
const src = rd('js/v2-cemetery-scene.js'), a = src.indexOf('    function gods() {'), b = src.indexOf('return out.sort', a);
const fn = src.slice(a, src.indexOf('\n', b) + 1);
const ctx = vm.createContext({}); const fast = { pets: [pets[0]], byId: { 1: pets[0] }, _gods: g };
vm.runInContext('var w = ' + JSON.stringify(fast) + '; w.byId = { 1: w.pets[0] };\n' + fn + '\nthis.r = gods();', ctx);
ok(ctx.r.length === 2 && ctx.r[0].id === 2 && ctx.r[1].id === 1, 'gods(): a page that loaded 1 of 2 Gods shows both (' + ctx.r.map(x => x.id) + ')');
ok(ctx.r[0].resurrected && ctx.r[0].resurrected.block === 30, 'a God the page never loaded still has its block and name for the list');
vm.runInContext('w._gods = null; this.r2 = gods();', ctx);
ok(ctx.r2.length === 1, 'an older summary without gods: falls back to the pets in memory');
vm.runInContext('w._gods = [{ id: 1, block: 10 }]; w.pets[0].dead = true; this.r3 = gods();', ctx);
ok(ctx.r3.length === 0, 'a God that died after the summary (the page knows) is not listed');
ok(/var H = gods\(\);/.test(src), 'the Gods door uses gods()');
/* the real writer, end to end (the first version read world.pets after spill() had freed it, so every summary said gods: []) */
(async () => {
  const os = require('os'), out = fs.mkdtempSync(path.join(os.tmpdir(), 'cemgods-'));
  const W = { tip: 40, pets: JSON.parse(JSON.stringify(pets)).map(p => Object.assign({ species: 'pepe', tier: 0, stats: {}, hatchBlock: 1 }, p)), items: {}, community: { burned: 0 }, log: [] };
  try { await S.write(out, W, { tip: 40, rsig: 'rtest' }); const sm = JSON.parse(fs.readFileSync(path.join(out, 'summary.json'), 'utf8'));
    ok(Array.isArray(sm.gods) && JSON.stringify(sm.gods.map(x => x.id)) === '[2,1]', 'split.write: summary.json lists the living Gods (' + JSON.stringify(sm.gods && sm.gods.map(x => x.id)) + ')');
  } catch (e) { ok(false, 'split.write ran: ' + String(e && e.message || e).split('\n')[0]); }
  done();
})();
function done() {
console.log(`cem-gods: ${n - fails} passed, ${fails} failed`); process.exit(fails ? 1 : 0);
}
