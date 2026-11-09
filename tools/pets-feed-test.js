/* pages-feed: columnar api/pets.json round-trips to the old objects, and the packed file is small enough to publish.
 * Reads the committed api/pets.json (no chain, nothing signed). */
'use strict';
const fs = require('fs'), path = require('path');
const F = require('../js/pets-feed.js');
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const pet = (over) => Object.assign({
  id: 1, name: 'Pori', species: 'wojak', speciesLabel: 'Wojak', hybrid: false, tier: 'Common', rarityScore: 556, rarityRank: 1281,
  stage: 5, stageName: 'Mythic', care: 22149, status: 'alive', usedUp: null, community: false,
  owner: 'bc1ps9av86ymmlzy9zj3a8pn6g94pz4j5e0kagv3td3wutaagfjvekjs26m3s4', generation: 0, parents: null, gear: [],
  stats: { vigor: 18, spark: 19, grit: 17, zoom: 9, luck: 4 }, wins: 0, losses: 0, bornBlock: 870000, lastFedBlock: 975000, deathBlock: null, rareHatch: null,
  url: 'https://xcpets.fun/pet.html?id=1'
}, over);
const samples = [
  pet({}),
  pet({ id: 2, name: 'Hy', species: 'hyb3:mumu:dodo:peepo', speciesLabel: 'Mudopo (hybrid)', hybrid: true, tier: 'Rare', rarityScore: null, rarityRank: null, stage: 0, stageName: 'Egg', care: 0, status: 'released', usedUp: 'Resurrection of #2', generation: 2, parents: [1, 9], lastFedBlock: null, deathBlock: 974000, rareHatch: { version: 1, kind: 'backwards', block: 974962, expected: 'a', actual: 'b' }, gear: [{ slot: 'head', item: 'v2-wojak-hat', name: 'Grey bobble beanie', tier: 'Uncommon' }, { slot: 'hand', item: 'v2-x', name: 'A "quote"', tier: null }], url: 'https://xcpets.fun/pet.html?id=2' }),
  pet({ id: 3, owner: 'bc1qother', species: 'pepe', speciesLabel: 'Pepe', tier: 'Legendary', status: 'dead', stage: 4, stageName: 'Elder', wins: 3, losses: 1, community: true, url: 'https://xcpets.fun/pet.html?id=3' })
];
const text = F.stringify(samples, 975220);
const back = F.expand(JSON.parse(text));
ok(back.v === 2 && back.blockHeight === 975220 && back.count === 3, 'header');
ok(back.pets.map(p => JSON.stringify(p)).join('\n') === samples.slice().sort((a, b) => a.id - b.id).map(p => JSON.stringify(p)).join('\n'), 'sample round-trip\n' + back.pets.map(p => JSON.stringify(p)).join('\n'));
ok(F.stringify(samples, 975220) === text, 'deterministic');
const lines = text.trim().split('\n');
ok(lines.length === 5 && lines[1].startsWith('[') && lines[3].startsWith('['), 'one pet per line (' + lines.length + ' lines)');
const old = { blockHeight: 5, count: 1, pets: [pet({ id: 7, url: 'https://xcpets.fun/pet.html?id=7' })] };
ok(JSON.stringify(F.expand(old).pets[0]) === JSON.stringify(old.pets[0]), 'v1 object file expands as itself');
const srcV = fs.readFileSync(path.join(ROOT, 'js/v2-verify.js'), 'utf8');
const srcH = fs.readFileSync(path.join(ROOT, 'verify-pet.html'), 'utf8');
ok(/XCPETSPetsFeed\.expand/.test(srcV), 'verify expands the feed before comparing');
ok(srcH.indexOf('js/pets-feed.js') < srcH.indexOf('js/v2-verify.js'), 'pets-feed.js loads before v2-verify.js');
const wf = fs.readFileSync(path.join(ROOT, '.github/workflows/pages.yml'), 'utf8');
ok(/timeout: 1800000/.test(wf) && /exclude previews/.test(wf) && /actions\/deploy-pages@v5/.test(wf), 'pages workflow raises the sync budget and omits previews');
ok(/group: pages-actions/.test(wf) && /cancel-in-progress: false/.test(wf), 'Actions deploys queue on their own group and do not cancel a running sync');
const feed = fs.readFileSync(path.join(ROOT, 'tools/api-feed.js'), 'utf8');
ok(/PetsFeed\.stringify/.test(feed), 'api-feed writes v2');
const live = JSON.parse(fs.readFileSync(path.join(ROOT, 'api/pets.json'), 'utf8'));
const packed = F.stringify(live.pets, live.blockHeight);
const again = F.expand(JSON.parse(packed));
let bad = 0;
for (let i = 0; i < live.pets.length; i++) if (JSON.stringify(live.pets[i]) !== JSON.stringify(again.pets[i])) bad++;
ok(bad === 0 && again.pets.length === live.pets.length, 'committed pets.json round-trips (' + bad + ' mismatches, ' + again.pets.length + ' pets)');
ok(packed.length < 20 * 1024 * 1024 && packed.length < JSON.stringify(live).length * 0.3, 'packed pets.json is under 20MB and under 30% of the object file (' + packed.length + ')');
console.log('pets-feed-test: ' + pass + ' passed, ' + fail + ' failed; packed ' + packed.length + ' bytes');
process.exit(fail ? 1 : 0);
