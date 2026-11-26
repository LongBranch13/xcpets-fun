#!/usr/bin/env node
/* Guards for the bugs the play-test robot (tools/playtest) found on Nov 25 2026. The robot itself is the end-to-end test; these are the
 * quick checks that run with the rest of tools/*-test.js.
 *   node tools/playtest-fixes-test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..'), rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let fails = 0, n = 0; const ok = (c, m) => { n++; console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };

/* 1. a discarded (pet:hd) pet is never fed: the rules refuse its meal, so no feed burn may pay for it */
const H = require(path.join(ROOT, 'js/v2-habits.js'));
const me = 'bc1qme', V = { questOn: () => false };
const base = { id: 7, owner: me, hungry: true, nextMeal: 3, stage: 2 };
ok(H.feedWhy({}, Object.assign({}, base), me, {}, 100, V) === null, 'a hungry pet of mine can be fed');
ok(/discarded/.test(H.feedWhy({}, Object.assign({}, base, { hd: me }), me, {}, 100, V) || ''), 'a pet I discarded on chain is refused (the rules say "discarded")');
ok(/zombie/.test(H.feedWhy({}, Object.assign({}, base, { zombie: { fedAt: 1 } }), me, {}, 100, V) || ''), 'a risen zombie is refused (it eats pets)');
const w = { pets: [Object.assign({}, base, { id: 1 }), Object.assign({}, base, { id: 2, hd: me })], byId: {} }; w.pets.forEach(p => { w.byId[p.id] = p; });
const g = H.feedGuardPlans(w, [{ tag: 'pet:feed:1', amount: 1 }, { tag: 'pet:feed:2', amount: 1 }], { me, pend: {}, nb: 100, V: { parseTag: t => ({ action: 'feed', petId: +t.split(':')[2] }), questOn: () => false }, queue: ids => ids.map(id => ({ tag: 'pet:feed:' + id, amount: 1 })) });
ok(g.plans.length === 1 && g.plans[0].tag === 'pet:feed:1' && g.skipped.indexOf(2) >= 0, 'the burn sheet guard drops the discarded pet before anything is signed');

/* 2. V2Own.canEat: the one answer for "hungry and feedable" (Today, My Pets header) */
const ctx = { self: {} }; vm.createContext(ctx); vm.runInContext(rd('js/v2-own.js'), ctx);
const O = ctx.self.V2Own;
ok(O.canEat(Object.assign({}, base), me) && !O.canEat(Object.assign({}, base, { hd: me }), me) && !O.canEat(Object.assign({}, base, { zombie: {} }), me) && !O.canEat(Object.assign({}, base, { dead: true }), me), 'V2Own.canEat leaves out discarded, zombie and dead pets');
ok(/V2Own\.discarded\(p, u\.ME, dz\)/.test(rd('js/v2-chores.js')), 'Daily chores leaves out pets discarded on chain, via the one discard answer (it charged 294,249 XCPETS for 146 real meals; behaviour: tools/discard-one-answer-test.js, chores-discard-test.js)');
ok(/V2Own\.canEat/.test(rd('js/v2-today.js')) && /V2Own\.canEat/.test(rd('js/v2-mypets-top.js')), 'the hungry counts (Today, My Pets) use V2Own.canEat');

/* 3. drawing a pet with no art (fast pages carry other players' pets without it) never throws */
const R = rd('js/v2-render.js');
ok(/function petFrames\(p, w, extra\) \{ if \(!p \|\| !p\.art\) return artless\(p\);/.test(R), 'V2Render.petFrames draws a placeholder egg (and asks for the art) when a pet has no art');
ok(/!A \|\| !B \|\| !A\.art \|\| !B\.art/.test(rd('js/v2.js')), 'a fight replay loads both pets before it plays');

/* 4. fast pages follow new blocks (the check worker catches up; the eggs of a burn show without a reload) */
ok(/m\.cmd === 'follow'/.test(rd('js/v2-verify-worker.js')), 'the check worker answers follow');
ok(/function follow\(\)/.test(rd('js/v2-split.js')) && /V2Split\.follow\(\)/.test(rd('js/v2-chain.js')), 'the 60 s poll asks the check worker to follow newer blocks');
const tok = (rd('js/v2-split.js').match(/v2-verify-worker\.js\?v=([a-z0-9]+)/) || [])[1];
ok(tok && tok !== "stable1125a" && tok !== "stable1125b", 'the check worker URL carries a new cache token (' + tok + ')');

/* 4b. the eggs of a hatch the page picked up after the published world carry their art (the box reveal threw without it) */
ok(/self\._arts\[p\.id\]/.test(rd('js/v2-verify-worker.js')), 'the check worker sends the art of pets the page has never seen');
ok(/function revNeedsArt\(\)/.test(rd('js/v2.js')) && /if \(revNeedsArt\(\)\) return; rev = revealQ\.shift\(\)/.test(rd('js/v2.js')), 'the box reveal asks for missing egg art before it opens');

/* 5. replays wait for open sheets; the wallet pill steps aside while selecting */
ok(/sheetOpen\(\)\) return setTimeout\(nextAnim/.test(rd('js/v2.js')), 'a queued replay waits while a sheet (Sign & burn...) is open');
ok(/body\.mpc-sel #xwPill\{display:none!important\}/.test(rd('js/v2-mypets-calm.js')), 'the wallet pill hides while the selection bar is pinned (it covered Discard selected)');

ok(/if \(keepBusy\)/.test(rd('js/v2-split.js')) && /var e = keepQ\[nm\]; if \(!e\) return next\(\)/.test(rd('js/v2-split.js')), 'only one saved-shard flush runs at a time (see tools/split-keep-test.js)');

/* 6. Nov 25 2026 (robot red on every PR): arrivals and the away reveal wait their turn; the cemetery fog stays inside the scene */
['js/v2-rabbit-arrival.js', 'js/v2-groyper-arrival.js', 'js/v2-kek-arrival.js'].forEach(f => ok(/function playFree\(/.test(rd(f)) && /playFree\(w, getW\); return true;/.test(rd(f)), f + ': the arrival waits while another sheet or scene is open'));
ok(/function otherUp\(\) \{[^}]*picking\(\)/.test(rd('js/v2.js')), 'the hatch reveal waits while the player is selecting pets (it swallowed Discard selected)');
ok(/function otherUp\(\) \{ return \[\]\.some\.call\(document\.querySelectorAll\('\.reveal\.on:not\(#packBox\)'\), shown\)/.test(rd('js/v2.js')), 'only a visible sheet holds the hatch reveal (a hidden breed request blocked new eggs forever)');
ok(/var A = w\.byId\[f\.a\] \|\| \{ name: '', owner: null \}, B = w\.byId\[f\.b\] \|\| \{ name: '', owner: null \}/.test(rd('js/v2.js')), 'the fight list survives a fighter missing from a fast world (reading name on fight.html)');
ok(/\.dw-cemfx \{[^}]*overflow: hidden/.test(rd('css/doom-week.css')), 'the cemetery fog is clipped to its scene (tablet scrolled sideways)');

console.log(`playtest-fixes: ${n - fails} passed, ${fails} failed`); process.exit(fails ? 1 : 0);
