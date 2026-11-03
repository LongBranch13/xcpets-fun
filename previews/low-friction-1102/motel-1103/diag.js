// motel-1103: why the old dock showed only dying pets (counts from the replayed world for the owner's address)
const { chromium } = require('/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core'); const { open } = require('./shoot.js'); const path = require('path');
(async () => { const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] }); const { pg } = await open(b, 1280);
  console.log(JSON.stringify(await pg.evaluate(() => { const w = V2UI.world(), U = V2UI, all = U.mine(w).filter(p => !p.dead), L = U.petList(w); const ok = V2Rules.breedPicker(w, U.ME, w.tip, '', null).mine.filter(x => !x.why && x.p.stage >= 3);
    const meals = {}; all.filter(p => p.hungry).forEach(p => meals[p.nextMeal] = (meals[p.nextMeal] || 0) + 1);
    return { fSort: document.getElementById('fSort').value, fHide: document.getElementById('fHide').value, alive: all.length, dockList: L.length, hungry: all.filter(p => p.hungry).length, neglected: all.filter(p => p.neglected).length, fed: all.filter(p => !p.hungry).length, canBreedNow: ok.length, mealCounts: meals,
      first40: [...document.querySelectorAll('#lfStrip [data-lf]')].slice(0, 40).map(b => w.byId[b.dataset.lf]).reduce((a, p) => { a.hungry += p.hungry ? 1 : 0; a.neglected += p.neglected ? 1 : 0; a.canBreed += ok.some(x => x.p.id === p.id) ? 1 : 0; return a; }, { hungry: 0, neglected: 0, canBreed: 0 }) }; })));
  await b.close(); })();
