/* mg-road-test: the Road to Mythic God panel, the honest wording, the odds ceiling and the fast-world guard.
 * Display only: js/v2-rules.js is not touched by this change and its bytes stay put (checked below).
 * Built on a snapshot with synthetic burns, the same way tools/mythic-god-test.js does. Dev only; nothing signed or sent.
 *
 * What it locks in (audit Nov 25 2026, after three real runs all ended in dust):
 *   1. no page promises a second chance after a failed Mythic Resurrection,
 *   2. the odds ceiling is told to the player before pledges are wasted,
 *   3. the panel names the step a pet is on,
 *   4. a slim world without w.cem.mg never offers an unleash and never claims 0 of 21 seats,
 *   5. zombies.json publishes the Mythic God table, and v2-split.js keeps it.
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const L = require('./lib/load-rules'), ROOT = L.ROOT, S = L.snap('snap-972901.json');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const b32 = n => n.toString(32).toUpperCase(), row = (b, src, amt, tag) => L.row(b, src, amt, tag);
const SB = 'bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n';
const GATE = 972905, R = 973450, MEAL_H = 'ab'.repeat(32);

/* ---------- the world: zombie #18846 is unleashed, eats a Mythic, the Mythic grave is raised and pledged to ---------- */
function world(rows, tip, hashes) {
  const c = L.load(), V = c.V2Rules;
  V._setCemeteryActivation(GATE); V._setCemeteryPublic(GATE); V._setMythicUnleashActivation(GATE); V.MG.HOLD = 0;
  const h = { [R + 446]: MEAL_H }; Object.assign(h, hashes || {});
  return { c, V, w: L.run(c, S, rows, tip, h) };
}
const SEANCE = row(R, SB, 100000, 'pet:seance:18846:' + b32(4133));
const UNL = row(R + 440, SB, 100000, 'pet:unleash:18846');
const A = world([SEANCE, UNL], R + 450);
const eaten = (A.w.cem.mg.meals[0] || {}).mythic;
ok(eaten > 0 && A.w.byId[eaten].mgDead, 'set-up: zombie #18846 ate Mythic #' + eaten + ', which now rests in a violet grave');

/* raise the violet grave with one Legendary offering, then pledge to its Resurrection */
/* the offering a Mythic grave needs: the best-rarity pet of that owner the rules will take (Legendary, MG.NEED_TIER) */
function offeringFor(x, owner, b) { return x.w.pets.filter(q => q.owner === owner && !x.V.cemOfferWhy(x.w, q, owner, b)).sort((p, q) => (q.tier | 0) - (p.tier | 0))[0]; }
const GR = eaten, gOwner = A.w.byId[GR].owner;
const leg = offeringFor(A, gOwner, R + 460);
const RAISE = leg ? [row(R + 460, gOwner, 100000, 'pet:seance:' + GR + ':' + b32(leg.id))] : [];
const B = world([SEANCE, UNL].concat(RAISE), R + 470);
const MZ = B.w.byId[GR];
ok(!!leg && MZ.zombie && !MZ.zombie.end && MZ.zombie.mythic, 'set-up: the violet grave rose as a Mythic zombie (offering #' + (leg && leg.id) + ')');

/* ---------- 1. the panel: V2MgRoad loads with no DOM and names the step ---------- */
function roadCtx(c) {
  const ctx = c; /* the rules context already has the window/document shim from load-rules */
  vm.runInContext(read('js/v2-mg-road.js'), ctx, { filename: 'js/v2-mg-road.js' });
  return ctx.window.V2MgRoad || ctx.V2MgRoad;
}
const MR = roadCtx(B.c);
ok(MR && typeof MR.html === 'function', 'js/v2-mg-road.js loads with no DOM and exports V2MgRoad');
{
  const b = R + 470, h = MR.html(B.w, MZ, MZ.owner, b);
  ok(/Road to Mythic God/.test(h) && /step \d of 6/.test(h), 'the panel names the step: ' + (/step \d of 6/.exec(h) || [''])[0]);
  ok(/One try only/.test(h) && /gone forever/.test(h), 'the panel tells the player a failed roll destroys the Mythic');
  ok(!/raise(d)? it again|raised again/i.test(h), 'the panel never promises a second raise');
  const z = B.w.byId[18846], hz = MR.html(B.w, z, z.owner, b);
  ok(/cured forever/.test(hz) && new RegExp('violet grave of #' + GR).test(hz), 'the cured zombie\'s panel points at the violet grave it created');
  ok(MR.html(B.w, B.w.pets.filter(p => !p.dead && !p.zombie && !p.mgDead && !p.mythicGod)[0], null, b) === '', 'an ordinary pet gets no panel');
}

/* ---------- 2. the odds ceiling, from the rules' own constants ---------- */
{
  const M = B.V.MG, b = R + 470;
  const room = M.RES_TOP - M.RES_BASE, want = Math.ceil(M.RES_K * room / (M.RES_SPAN - room));
  const c0 = MR.capInfo(B.w, MZ, b);
  ok(c0 && c0.capPts === want, 'capInfo: the ceiling (' + Math.round(M.RES_TOP * 100) + '%) is reached at ' + want + ' points');
  const chanceAt = P => Math.min(M.RES_TOP, M.RES_BASE + M.RES_SPAN * (P / (P + M.RES_K)));
  ok(Math.abs(chanceAt(want) - M.RES_TOP) < 1e-9 && chanceAt(want - 1) < M.RES_TOP, 'the ceiling point is the smallest one that reaches the top: ' + want);
  ok(chanceAt(want + 5000) === chanceAt(want), 'points past the ceiling buy nothing, which is what the line has to say');
  const line = MR.capLine(B.w, MZ, b);
  ok(/more point|Best odds reached/.test(line), 'capLine says where the player stands: ' + line);
  const fake = Object.assign({}, MZ, { zombie: Object.assign({}, MZ.zombie) });
  ok(MR.capInfo(B.w, B.w.byId[18846], b) === null, 'capInfo is only for a Mythic zombie (an ordinary one keeps the old copy)');
  ok(/One try only/.test(MR.riskLine(MZ)) && MR.riskLine(MZ, true).indexOf('&#') < 0, 'riskLine has a plain form for the confirm sheet');
}

/* ---------- 3. the pages carry the honest wording and the ceiling line ---------- */
{
  const v2 = read('js/v2.js'), anim = read('js/v2-mg-anim.js'), scene = read('js/v2-cemetery-scene.js');
  ok(!/You can raise it again/.test(v2), 'v2.js: the unleash pop-up no longer says "You can raise it again"');
  ok(/one<\/b> Resurrection roll/.test(v2) && /gone forever/.test(v2), 'v2.js: the unleash pop-up says one roll, and dust forever on a miss');
  ok(!/violet grave can be raised again/.test(anim), 'v2-mg-anim.js: the failed-roll caption no longer promises another raise');
  ok(/gone forever/.test(anim), 'v2-mg-anim.js: the failed-roll caption says the Mythic is gone forever');
  ok(/V2MgRoad\.capLine/.test(v2) && /V2MgRoad\.riskLine/.test(v2), 'v2.js: the pledge box and the confirm sheet use the ceiling and risk lines');
  ok(/V2MgRoad\.capLine/.test(scene) && /V2MgRoad\.riskLine/.test(scene), 'the cemetery card uses them too');
  ok(/V2MgRoad\.html/.test(v2), 'v2.js: the step panel is on the zombie zone and on a grave / God');
}

/* ---------- 4. the fast-world guard ---------- */
{
  const b = R + 470;
  ok(MR.mgReady(B.w), 'a replayed world is trustworthy');
  const slim = Object.assign({}, B.w, { cem: Object.assign({}, B.w.cem, { _slim: 1 }) });
  ok(!MR.mgReady(slim), 'a slim world marked by v2-split.js cemFill is not');
  const bare = Object.assign({}, B.w, { cem: Object.assign({}, B.w.cem) }); delete bare.cem.mg;
  ok(MR.mgReady(bare), 'a replayed world with no unleash yet (no mg table, no _slim mark) is still trustworthy');
  ok(/mgReady/.test(read('js/v2.js')) && /mgReady/.test(read('js/v2-cemetery-scene.js')) && /mgReady/.test(read('js/v2-pantheon.js')),
    'the unleash button, the cemetery card and the Pantheon count all check it');
  const split = read('js/v2-split.js');
  ok(/c\._slim = 1/.test(split) && /delete c\._slim/.test(split), 'v2-split.js marks a slim cem and clears the mark when the table arrives');
  ok(/cemMg\(cemFill\(/.test(split) && /z\.mg/.test(split), 'v2-split.js reads mg out of zombies.json');
  const srv = read('tools/sync-server/split.js');
  ok(/mg: mg/.test(srv) && /seats: mgSrc\.seats/.test(srv) && /byWallet/.test(srv), 'the world builder publishes the Mythic God table in view/zombies.json');
  const pan = read('js/v2-pantheon.js');
  ok(/Reading the seats from the chain/.test(pan), 'the Pantheon says it is still loading instead of "0 of 21 seats filled"');
}

/* ---------- 5. the rules are untouched: the replay is byte for byte the same ---------- */
{
  const before = crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, 'js/v2-rules.js'))).digest('hex');
  const git = require('child_process').execFileSync('git', ['-C', ROOT, 'diff', '--name-only', 'origin/main', '--', 'js/v2-rules.js', 'rjs/chain.js', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js'], { encoding: 'utf8' }).trim();
  ok(git === '', 'no rule file changed, so the rules signature and every replay stay as they are' + (git ? ' (changed: ' + git + ')' : ''));
  ok(/^[0-9a-f]{32}$/.test(before), 'js/v2-rules.js md5 ' + before);
}

/* ---------- 6. every page that loads the Mythic God looks also loads the road ---------- */
{
  const pages = fs.readdirSync(ROOT).filter(f => /\.html$/.test(f));
  const want = pages.filter(f => read(f).indexOf('js/v2-mythic-god.js') >= 0);
  const miss = want.filter(f => read(f).indexOf('js/v2-mg-road.js') < 0);
  ok(want.length > 0 && miss.length === 0, want.length + ' pages load v2-mythic-god.js and all of them load v2-mg-road.js' + (miss.length ? ' (missing: ' + miss.join(', ') + ')' : ''));
  /* The tokens these scripts had before this change. Later PRs bump them again, so the check is "not the old one",
   * never "exactly mgroad1125": an exact pin turns into a false failure the next time anyone touches the file. */
  const OLD = { 'v2.js': 'a1125f2ee0', 'v2-split.js': 'wslow1125', 'v2-cemetery-scene.js': 'c1125b', 'v2-pantheon.js': 'spn1124', 'v2-mg-anim.js': 'e6db15afb2', 'v2-pet-card.js': 'spn1124' };
  const stale = Object.keys(OLD).filter(base => pages.some(p => { const m = new RegExp('js/' + base.replace('.', '\\.') + '\\?v=([0-9a-z]+)').exec(read(p)); return m && m[1] === OLD[base]; }));
  ok(stale.length === 0, 'every changed script is cache-busted to the new token' + (stale.length ? ' (stale: ' + stale.join(', ') + ')' : ''));
}

console.log('mg-road-test: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
