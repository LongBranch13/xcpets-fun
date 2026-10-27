'use strict';
// HatchBot routine renders (STAGED). Loads xcpets.fun in headless Chrome and draws with the site's OWN code
// (V2Render.petFrames for sprites+gear+black eye, V2ArenaScene for fights). No site changes. Output PNG < 1 MB.
// node render.js pet <id> <out.png> | fight <fightId> <out.png> | breed <childId> <out.png> | facts <out.json>
const fs = require('fs');
const SITE = process.env.XCPETS_SITE || 'https://xcpets.fun';
async function open() {
  const pp = require('../telegram/node_modules/puppeteer-core'); const b = await pp.launch({ executablePath: require('../telegram/platform').CHROME, args: ['--no-sandbox'] });
  const pg = await b.newPage(); await pg.setViewport({ width: 1100, height: 1300 });
  await pg.goto(SITE + '/play.html', { waitUntil: 'networkidle2', timeout: 120000 });
  await pg.waitForFunction(() => window.V2UI && V2UI.world && V2UI.world() && V2UI.world().tip, { timeout: 90000 });
  return { b, pg };
}
// Composite card: sprites scaled x12 (nearest), dark backdrop, labels. Drawn in-page from petFrames.
const CARD = (spec) => {
  const w = V2UI.world(), R = V2Render, S = 12, c = document.createElement('canvas'); c.width = 1000; c.height = 560;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.fillStyle = '#1b1530'; x.fillRect(0, 0, 1000, 560);
  x.fillStyle = '#f5c542'; x.font = 'bold 34px monospace'; x.textAlign = 'center'; x.fillText(spec.title, 500, 52);
  spec.pets.forEach((s, i) => { const p = w.byId[s.id]; if (!p) return; const fr = R.petFrames(Object.assign({}, p, s.over || {}), w); const t = document.createElement('canvas'); t.width = t.height = 32;
    t.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(fr[0].data), 32, 32), 0, 0); const cx = (i + 0.5) * 1000 / spec.pets.length;
    x.drawImage(t, cx - 16 * S * s.k, 90, 32 * S * s.k, 32 * S * s.k); x.fillStyle = '#fff'; x.font = 'bold 26px monospace';
    x.fillText((p.name || '') + ' #' + p.id, cx, 90 + 32 * S * s.k + 40); x.font = '20px monospace'; x.fillStyle = '#b9b3d6'; x.fillText(s.sub || (V2Rules.speciesLabel ? V2Rules.speciesLabel(p.species) : p.species), cx, 90 + 32 * S * s.k + 70); });
  if (spec.mid) { x.fillStyle = '#f5c542'; x.font = 'bold 60px monospace'; spec.mid.forEach(m => x.fillText(m.t, m.x, 280)); }
  return c.toDataURL('image/png');
};
// Breed card layout: two parents flank the hatch; a one-parent (Mythic quest jackpot) egg shows parent + hatch only, never an empty slot.
function breedCardSpec(id, kid) {
  const ps = (Array.isArray(kid.parents) ? kid.parents : []).filter(x => x != null && x !== '' && !Number.isNaN(+x)).map(Number);
  const hatch = { id, k: 0.7, sub: 'new hatch' };
  if (ps.length >= 2) return { title: 'NEW ARRIVAL AT THE NO-TAIL MOTEL', pets: [{ id: ps[0], k: 0.7, sub: 'parent' }, hatch, { id: ps[1], k: 0.7, sub: 'parent' }], mid: [] };
  if (ps.length === 1) return { title: 'NEW ARRIVAL AT THE NO-TAIL MOTEL', pets: [{ id: ps[0], k: 0.7, sub: kid.jackpot ? 'quest parent' + (kid.jackpot.wild ? ' + wild ' + kid.jackpot.wild : '') : 'parent' }, hatch], mid: [] };
  return { title: 'NEW ARRIVAL AT THE NO-TAIL MOTEL', pets: [hatch], mid: [] };
}
const save = (u, out) => { const buf = Buffer.from(u.split(',')[1], 'base64'); fs.writeFileSync(out, buf); if (buf.length > 1e6) throw new Error('render > 1 MB'); return buf.length; };
async function main() {
  const [mode, arg, out] = process.argv.slice(2); const { b, pg } = await open();
  try {
    if (mode === 'facts') { fs.writeFileSync(arg, JSON.stringify(await pg.evaluate(() => { const w = V2UI.world(); const ps = Object.values(w.byId);
      return { tip: w.tip, fights: (w.fights || []).filter(f => f.winner).map(f => ({ id: f.id, a: f.a, b: f.b, winner: f.winner, loser: f.loser, block: f.acceptBlock, spoils: f.spoils && f.spoils.label })),
        bred: ps.filter(p => p.parents).sort((a, b) => b.hatchBlock - a.hatchBlock).slice(0, 5).map(p => ({ id: p.id, name: p.name, species: p.species, parents: p.parents, parentNames: Object.fromEntries((p.parents || []).filter(x => w.byId[x]).map(x => [x, w.byId[x].name])), jackpot: p.jackpot ? { from: p.jackpot.from, wild: p.jackpot.wild } : null, block: p.hatchBlock })),
        top: ps.filter(p => !p.dead && window.PetScore).map(p => ({ id: p.id, name: p.name, species: p.species, score: ((PetScore.of(w, p) || {}).score) || 0 })).sort((a, b) => b.score - a.score).slice(0, 5) }; }), null, 1)); }
    else if (mode === 'pet') console.log(save(await pg.evaluate(CARD, { title: 'PET OF THE DAY', pets: [{ id: +arg, k: 1 }] }), out));
    else if (mode === 'breed') { const kid = await pg.evaluate(id => { const p = V2UI.world().byId[id]; return { parents: p.parents, jackpot: p.jackpot ? { wild: p.jackpot.wild } : null }; }, +arg);
      console.log(save(await pg.evaluate(CARD, breedCardSpec(+arg, kid)), out)); }
    else if (mode === 'fight') { // arena scene for THIS fight only, read straight from the arena canvas (site pop-ups/modals can't leak in)
      const ok = await pg.evaluate(id => { const f = (V2UI.world().fights || []).find(x => x.id === id && x.winner); if (!f) return 'no such finished fight';
        const c = document.querySelector('canvas[id*=arena],.ar-scene canvas'); if (!c) return 'arena canvas missing';
        c.scrollIntoView(); window.__hbFight = id; V2ArenaScene.sequence(f); return 'ok'; }, +arg);
      if (ok !== 'ok') throw new Error('fight render refused: ' + ok);
      await new Promise(r => setTimeout(r, 14000));
      const u = await pg.evaluate(id => { if (window.__hbFight !== id) return null; const c = document.querySelector('canvas[id*=arena],.ar-scene canvas'); return c && c.width > 50 && c.height > 50 ? c.toDataURL('image/png') : null; }, +arg);
      if (!u || !/^data:image\/png;base64,/.test(u)) throw new Error('fight render refused: arena canvas not readable');
      console.log(save(u, out)); }
    else throw new Error('mode?');
  } finally { await b.close(); }
}
if (require.main === module) main().catch(e => { console.error(e.message); process.exit(1); });
module.exports = { breedCardSpec, CARD };
