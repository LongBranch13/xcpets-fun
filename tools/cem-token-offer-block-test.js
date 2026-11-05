#!/usr/bin/env node
/* CEMETERY DISCARD / TOKEN OFFER GUARD (offer-discards-only-1105, owner Nov 5 2026):
 * Gate live 974735. Replay at tip before gate stays SAME. When on: tied pets (deed in w.deeds) can't be offered (cemOfferWhy)
 * and cemetery runs skip them (cemRunPass). Discard itself is browser-only — not asserted here.
 *   node tools/cem-token-offer-block-test.js [snap] */
'use strict';
const { load, snap } = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('ok  ', m); } else { fail++; console.log('FAIL', m); } };
const S = snap(process.argv[2]), T = S.tip, G = T + 6;
const c = load(), V = c.V2Rules; V._setTokenOnly(false);
const H = Object.assign({}, c.XCPETS_BLOCK_HASHES, S.hashes);
function run(tip) { return V.replay(S.rows, H, [], { tip: tip != null ? tip : T, live: c.LiveEngine.RealCore }); }

ok(V.ACTIVATE_CEM_TOKEN_OFFER_BLOCK === 974735, 'gate live at 974735');
ok(typeof V.cemTokenOfferOn === 'function' && V.cemTokenOfferOn(974735) === true && V.cemTokenOfferOn(974734) === false, 'cemTokenOfferOn respects live gate');
ok(typeof V.cemTied === 'function' && typeof V._setCemTokenOfferActivation === 'function', 'cemTied + _setCemTokenOfferActivation exported');

const base = run(T);
const free = base.pets.filter(p => !V.cemTied(base, p) && p.owner && !p.dead && !p.released && !p.community && !V.isMythic(p) && !p.cold).sort((a, b) => a.id - b.id)[0];
ok(!!free, 'found an untied living pet #' + (free && free.id));
/* Frozen snaps have no deeds; bind a synthetic pet token onto a clone so cemTied / cemOfferWhy can be exercised. */
const DEED = 'A8460821284708930705';
const tied = free ? Object.assign({}, free, { id: 999999001, deed: DEED, name: 'TiedClone' }) : null;
if (tied) { base.pets.push(tied); base.byId[tied.id] = tied; base.deeds = base.deeds || {}; base.deeds[DEED] = { asset: DEED, petId: tied.id, owner: tied.owner }; }
ok(!!tied && V.cemTied(base, tied), 'synthetic tied pet #' + (tied && tied.id) + ' cemTied=true');

/* Gate OFF: tied pet offerable (same as today — #40225 was offered while tokenized). */
ok(!V.cemOfferWhy(base, tied, tied.owner, T), 'gate OFF: tied pet cemOfferWhy=null (can offer) — why=' + V.cemOfferWhy(base, tied, tied.owner, T));
ok(!V.cemOfferWhy(base, free, free.owner, T), 'gate OFF: free pet offerable');

/* Gate ON at G: tip still T < G so gate not yet active at T; force call at G. */
V._setCemTokenOfferActivation(G);
ok(V.cemTokenOfferOn(G - 1) === false && V.cemTokenOfferOn(G) === true, 'cemTokenOfferOn flips at gate ' + G);
ok(V.cemOfferWhy(base, tied, tied.owner, G) === "Tokenized pets can't be offered", 'gate ON: tied pet blocked — got: ' + V.cemOfferWhy(base, tied, tied.owner, G));
ok(!V.cemOfferWhy(base, free, free.owner, G) || V.cemOfferWhy(base, free, free.owner, G) !== "Tokenized pets can't be offered",
  'gate ON: free pet not blocked for token reason — why=' + V.cemOfferWhy(base, free, free.owner, G));
ok(V.cemRunPass(base, tied, G, 999999) === true, 'gate ON: cemRunPass skips tied pet');
ok(V.cemRunPass(base, free, G, 999999) === false, 'gate ON: cemRunPass does not skip free pet (unless other pass reasons)');

/* Gate back to null: replay tip T SAME pets (gate never fires). */
V._setCemTokenOfferActivation(null);
const off = run(T);
V._setCemTokenOfferActivation(G);
const gated = run(T); /* tip T < G */
V._setCemTokenOfferActivation(null);
const canon = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, kk) => (o[kk] = x[kk], o), {}) : x);
const strip = w => w.pets.map(p => { const o = Object.assign({}, p); delete o.children; return o; });
ok(canon(strip(off)) === canon(strip(gated)), 'replay at tip ' + T + ' (before gate ' + G + '): SAME pets with gate set vs null');

/* #40225 state on this snap if present: report whether it was discarded (engine has no discard) */
const p402 = base.byId[40225];
if (p402) {
  console.log('note  #40225 on snap: released=' + p402.released + ' usedUp=' + JSON.stringify(p402.usedUp) + ' deed=' + p402.deed + ' cemTied=' + V.cemTied(base, p402));
  console.log('note  Discard is browser-only (xcpets-hidden-*); engine cannot know if #40225 was Discarded at offer time.');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
