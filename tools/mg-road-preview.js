/* mg-road-preview: screenshots of the Road to Mythic God panel at every step, for design review.
 * Builds a real world from a snapshot with synthetic burns (the same way tools/mg-road-test.js does), asks
 * js/v2-mg-road.js for the panel HTML at each step, drops those into one page with the site's own CSS and
 * shoots it on a phone and a desktop. Dev only: nothing signed, nothing sent, no live data.
 *   node tools/mg-road-preview.js [--out previews/mg-road]
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const L = require('./lib/load-rules'), ROOT = L.ROOT, S = L.snap('snap-972901.json');
const A = process.argv.slice(2), opt = (k, d) => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('--out', 'previews/mg-road'));
const SB = 'bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n';
const GATE = 972905, R = 973450, MEAL_H = 'ab'.repeat(32), b32 = n => n.toString(32).toUpperCase();
const row = (b, src, amt, tag) => L.row(b, src, amt, tag);

function world(rows, tip) {
  const c = L.load(), V = c.V2Rules;
  V._setCemeteryActivation(GATE); V._setCemeteryPublic(GATE); V._setMythicUnleashActivation(GATE); V.MG.HOLD = 0;
  const w = L.run(c, S, rows, tip, { [R + 446]: MEAL_H });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/v2-mg-road.js'), 'utf8'), c, { filename: 'js/v2-mg-road.js' });
  return { c, V, w, MR: c.window.V2MgRoad || c.V2MgRoad };
}
const SEANCE = row(R, SB, 100000, 'pet:seance:18846:' + b32(4133));
const UNL = row(R + 440, SB, 100000, 'pet:unleash:18846');
const cards = [];
function card(title, note, html) { cards.push({ title, note, html: html || '<p class="small muted">(no panel)</p>' }); }

/* steps 1 and 2: a zombie that is fed, then the same zombie once it is feral */
{ const X = world([SEANCE], R + 100); const Z = X.w.byId[18846];
  card('Step 1 · the zombie is fed', 'Its owner sees what the road needs next.', X.MR.html(X.w, Z, Z.owner, R + 100)); }
{ const X = world([SEANCE], R + 440); const Z = X.w.byId[18846];
  card('Step 2 · feral', 'Three days unfed: now it can be unleashed.', X.MR.html(X.w, Z, Z.owner, R + 440)); }
/* step 3: the unleash is in, the meal is 6 blocks away */
{ const X = world([SEANCE, UNL], R + 443); const Z = X.w.byId[18846];
  card('Step 3 · unleashed, waiting for the meal', 'The pool size and the meal block come from the chain.', X.MR.html(X.w, Z, Z.owner, R + 443)); }
/* step 4: the zombie is Mythic-fed and the eaten Mythic has a violet grave */
const A1 = world([SEANCE, UNL], R + 450), eaten = (A1.w.cem.mg.meals[0] || {}).mythic;
{ const Z = A1.w.byId[18846];
  card('Step 4 · cured forever', 'The zombie is done; the panel sends the player to the violet grave it made.', A1.MR.html(A1.w, Z, Z.owner, R + 450)); }
{ const G = A1.w.byId[eaten];
  card('Step 4b · the violet grave', 'The eaten Mythic #' + eaten + ', waiting for one Legendary offering.', A1.MR.html(A1.w, G, G.owner, R + 450)); }
/* step 5 and 6: raise it, then pledge halo points */
const gOwner = A1.w.byId[eaten].owner;
const leg = A1.w.pets.filter(q => q.owner === gOwner && !A1.V.cemOfferWhy(A1.w, q, gOwner, R + 460)).sort((p, q) => (q.tier | 0) - (p.tier | 0))[0];
const RAISE = [row(R + 460, gOwner, 100000, 'pet:seance:' + eaten + ':' + b32(leg.id))];
{ const X = world([SEANCE, UNL].concat(RAISE), R + 470), MZ = X.w.byId[eaten];
  card('Step 5 · a Mythic zombie', 'Raised from the violet grave: now it needs halo points.', X.MR.html(X.w, MZ, MZ.owner, R + 470)); }
/* pledge enough to pass the minimum and reach the ceiling */
{ const X0 = world([SEANCE, UNL].concat(RAISE), R + 470);
  const pool = X0.w.pets.filter(q => q.owner === gOwner && !X0.V.cemOfferWhy(X0.w, q, gOwner, R + 471)).sort((p, q) => (q.tier | 0) - (p.tier | 0));
  /* one burn holds a limited tag, so pledges go in batches of 16, as the pledge sheet does */
  const batches = (n) => { const out = []; for (let i = 0; i < n; i += 16) out.push(row(R + 471 + (i / 16 | 0), gOwner, 100000, 'pet:rpl:' + eaten + ':' + pool.slice(i, i + 16).map(p => b32(p.id)).join('.'))); return out; };
  const one = [row(R + 471, gOwner, 100000, 'pet:rpl:' + eaten + ':' + b32(pool[pool.length - 1].id))]; /* one Common: 1 point, far below the 66 it needs */
  const X1 = world([SEANCE, UNL].concat(RAISE, one), R + 480), M1 = X1.w.byId[eaten];
  card('Step 6 · pledging halo points', 'Below the minimum: it says exactly how many more points it needs.', X1.MR.html(X1.w, M1, M1.owner, R + 480));
  const X2 = world([SEANCE, UNL].concat(RAISE, batches(16)), R + 480), M2 = X2.w.byId[eaten];
  const I = X2.V.cemResInfo(X2.w, M2, R + 480), C = X2.MR.capInfo(X2.w, M2, R + 480);
  card('Step 6b · ready to roll', 'The odds, how far the ceiling still is, and the one-try warning, before anything is signed.', X2.MR.html(X2.w, M2, M2.owner, R + 480));
  console.log('ready: ' + I.points + ' points, ' + Math.round(I.chance * 100) + '% chance, ceiling at ' + C.capPts + ' points');
  /* the same panel once the ceiling is reached (848 points pledged, 694 is all it takes) */
  const X3 = world([SEANCE, UNL].concat(RAISE, batches(64)), R + 480); const M3 = X3.w.byId[eaten];
  card('At the ceiling', 'What it says when more pledges cannot raise the odds. This is where 41 pets went in for nothing.', X3.MR.html(X3.w, M3, M3.owner, R + 480));
  /* the fast-page guard: the same pet on a slim world that has no Mythic God table */
  const slim = Object.assign({}, X2.w, { cem: Object.assign({}, X2.w.cem, { _slim: 1 }) });
  card('Fast page with no Pantheon data', 'The old pages offered the burn anyway; now they wait for the table.', X2.MR.html(slim, M2, M2.owner, R + 480));
}
/* a seated Mythic God (set by hand on a copy, the way the rules write it after a winning roll) */
{ const X = world([SEANCE, UNL].concat(RAISE), R + 480), G = X.w.byId[eaten];
  G.mythicGod = { seat: 1, block: R + 480, roll: 123, need: 4000 }; G.zombie = null; G.dead = false; G.mythicCare = true;
  X.w.cem.mg.seats.push({ n: 1, petId: G.id, owner: G.owner, block: R + 480 });
  card('The end of the road · a Mythic God', 'Seat I of 21, and it never dies.', X.MR.html(X.w, G, G.owner, R + 480)); }

const css = ['css/style.css', 'css/game.css', 'css/v2.css'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
const road = fs.readFileSync(path.join(ROOT, 'js/v2-mg-road.js'), 'utf8');
const page = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>Road to Mythic God: the panel at every step</title>' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bangers&family=Comic+Neue:wght@400;700&family=Press+Start+2P&display=swap">' +
  '<style>' + css + '</style><style>body{background:#100e14;color:#FAFAF5;font-family:"Comic Neue",system-ui,sans-serif;margin:0;padding:14px}' +
  'h1{font-family:Bangers,cursive;font-size:30px;margin:0 0 4px;color:#E8B33A}.pv-sub{margin:0 0 14px;color:#b9b0d6;font-size:13px}' +
  '.pv{border:3px solid #000;background:#14101f;box-shadow:3px 3px 0 #000;padding:9px;margin:0 0 12px}' +
  '.pv h2{font-family:"Press Start 2P",monospace;font-size:11px;color:#E8B33A;margin:0 0 3px}.pv p.n{margin:0 0 7px;font-size:12px;color:#9b90b8}</style></head><body>' +
  '<h1>Road to Mythic God</h1><p class="pv-sub">The same panel at every step, on a real replayed world. Nothing here is live and nothing can be signed.</p>' +
  cards.map(c => '<section class="pv"><h2>' + c.title + '</h2><p class="n">' + c.note + '</p>' + c.html + '</section>').join('') +
  /* the panel's own stylesheet comes from js/v2-mg-road.js, which only runs when the rules are present: a stub is enough here */
  '<script>window.V2Rules={MG:{SEATS:21}};</script><script>' + road + '</script></body></html>';
fs.mkdirSync(OUT, { recursive: true });
const file = path.join(OUT, 'panel.html');
fs.writeFileSync(file, page);

(async () => {
  let chromium; try { chromium = require('playwright-core').chromium; } catch (e) { try { chromium = require('playwright').chromium; } catch (e2) { console.log('wrote ' + file + ' (no Playwright: no PNGs)'); return; } }
  const exe = process.env.CHROME || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
  for (const v of [{ n: 'phone', w: 390, h: 844, s: 2 }, { n: 'desktop', w: 1100, h: 900, s: 2 }]) {
    const cx = await b.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: v.s });
    const pg = await cx.newPage(); await pg.goto('file://' + file, { waitUntil: 'load' }); await pg.waitForTimeout(900);
    await pg.screenshot({ path: path.join(OUT, 'road-' + v.n + '.png'), fullPage: true }); await cx.close();
  }
  await b.close();
  console.log('wrote ' + path.join(OUT, 'road-phone.png') + ' and road-desktop.png');
})();
