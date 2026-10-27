// read-only: loads live xcpets.fun, renders before/after motel card + caption. Posts nothing.
const pp = require('/workspace/xcpets/node_modules/puppeteer-core'), fs = require('fs'), D = __dirname;
const T = '/workspace/wt-hatchbot-parent/tools/hatchbot-telegram-next/';
const { CARD, breedCardSpec } = require(T + 'render.js'), R = require(T + 'routines.js');
(async () => { const b = await pp.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
 try { const pg = await b.newPage(); await pg.setViewport({ width: 1100, height: 1300 });
  await pg.goto('https://xcpets.fun/play.html', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await pg.waitForFunction(() => window.V2UI && V2UI.world && V2UI.world() && V2UI.world().tip, { timeout: 240000 });
  const info = await pg.evaluate(() => { const w = V2UI.world(); return { tip: w.tip, eggs: [49077, 49078, 49079].map(id => { const p = w.byId[id]; return p && { id, name: p.name, species: p.species, parents: p.parents, parentNames: Object.fromEntries((p.parents || []).filter(x => w.byId[x]).map(x => [x, w.byId[x].name + ' (' + w.byId[x].species + ', stage ' + w.byId[x].stage + ')'])), jackpot: p.jackpot || null, block: p.hatchBlock }; }) }; });
  fs.writeFileSync(D + '/game-data.json', JSON.stringify(info, null, 1));
  const kid = info.eggs[0], par = kid.parents;
  const before = { title: 'NEW ARRIVAL AT THE NO-TAIL MOTEL', pets: [{ id: par[0], k: 0.7, sub: 'parent' }, { id: 49077, k: 0.7, sub: 'new hatch' }, { id: par[1], k: 0.7, sub: 'parent' }], mid: [] };
  for (const [n, s] of [['before', before], ['after', breedCardSpec(49077, kid)]]) { const u = await pg.evaluate(CARD, s); fs.writeFileSync(D + '/card-' + n + '.png', Buffer.from(u.split(',')[1], 'base64')); }
  const facts = { tip: info.tip, bred: info.eggs.map(e => Object.assign({}, e, { parentNames: Object.fromEntries(Object.entries(e.parentNames).map(([k, v]) => [k, v.split(' (')[0]])) })) };
  const oldText = '🥚 New arrival at the No-Tail Motel: Laha #49077 (hyb:pepe:dodo), from #5880 × #undefined. Plus 2 more eggs checked out.';
  fs.writeFileSync(D + '/text-before-after.txt', 'BEFORE (as posted):\n' + oldText + '\n\nAFTER (fixed routines.js, same facts):\n' + R.CAPTIONS.motel_alert(Object.assign({}, facts, { tip: 973391 })).text + '\n');
  console.log(JSON.stringify(info));
 } finally { await b.close(); } })().catch(e => { console.error(e); process.exit(1); });
