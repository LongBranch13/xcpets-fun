#!/usr/bin/env node
/* speed phase 1: rules bytes, Doom Week stays off, the cache never prefers a stored rules file,
 * practice pages do not load doom-week, and PetScore.ensure matches PetScore.compute. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
let fail = 0, pass = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (c) pass++; else fail++; };
const rules = fs.readFileSync(path.join(ROOT, 'js/v2-rules.js'));
ok(crypto.createHash('md5').update(rules).digest('hex') === '8e98664087bab2e991680ebdb80ba143', 'js/v2-rules.js MD5 unchanged');
const doom = fs.readFileSync(path.join(ROOT, 'js/doom-week.js'), 'utf8');
ok(/var ENABLED = false/.test(doom), 'doom-week ENABLED is false');
const events = fs.readFileSync(path.join(ROOT, 'js/v2-events.js'), 'utf8');
ok(/var DOOM_ENABLED = false/.test(events), 'v2-events keeps Doom Week off');
ok(/practice/.test(events) && /add\('js\/doom-week\.js'\)/.test(events), 'doom-week is loaded only from the events file');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
ok(/function isRules/.test(sw) && /isRules\(url\)\)/.test(sw) && /networkFirst/.test(sw), 'rules are on the network-first path');
ok(/latest\.json/.test(sw) && /isCheckpoint/.test(sw), 'latest.json is not the checkpoint cache');
const fetchBody = sw.split("addEventListener('fetch'")[1] || '';
ok(/isRules\(url\)\)[\s\S]*networkFirst/.test(fetchBody) && fetchBody.indexOf('isRules(url)') < fetchBody.indexOf('cacheFirst(req)'), 'a rules request is network-first, ahead of the static cache');
['practice.html', 'practice-breed.html', 'practice-fight.html', 'practice-pet.html', 'practice-rare.html'].forEach(f => {
  ok(!fs.readFileSync(path.join(ROOT, f), 'utf8').includes('doom-week.js'), f + ' does not load doom-week');
});
const PS = require(path.join(ROOT, 'js/pet-score.js'));
function world(n) {
  const pets = [];
  for (let i = 1; i <= n; i++) pets.push({ id: i, species: i % 3 ? 'pepe' : 'doge', owner: 'x', care: i * 10, wins: i % 4, losses: i % 3, stage: 1,
    art: { eyes: 'e' + (i % 5), pattern: 'p' + (i % 4), background: 'b' + (i % 3), cheeks: i % 2 ? 'blush' : false, crown: '', cape: '', armor: '' },
    stats: { vigor: i % 7, spark: i % 5, grit: 2, zoom: 1, luck: i % 3 } });
  return { tip: 100, pets: pets, items: {} };
}
function slim(r) { return r.ranked.map(x => [x.id, x.score, x.rank, x.rarityBits]); }
(async () => {
  const a = PS.compute(world(30));
  const b = await new Promise(res => PS.ensure(world(30), res));
  ok(JSON.stringify(slim(a)) === JSON.stringify(slim(b)), 'ensure matches compute for 30 pets');
  const empty = await new Promise(res => PS.ensure({ tip: 1, pets: [], items: {} }, res));
  ok(empty && empty.n === 0 && empty.ranked.length === 0, 'ensure on an empty world is empty');
  const hit = PS.cached(world(2));
  ok(hit === null, 'a different world object is not a cache hit');
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
