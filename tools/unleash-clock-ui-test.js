/* Unleash card vs a stale tip. Display only: js/v2-rules.js is not loaded any differently and its
 * bytes stay put. A tab whose tip is still below ACTIVATE_ZOMBIE_CLOCK_BLOCK (976767) used to read
 * the raw fedAt+864 and say the zombie turns to dust. The card must not print that deadline.
 * #74534 (bc1pfvk…, crumble 977161) and the bc1qs88… ferals are read here. Nothing is signed or sent.
 * Dev only. Does not use the owner wallet. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), vm = require('vm');
const L = require('./lib/load-rules');
const ROOT = L.ROOT, SNAP = L.snap('snap-972901.json');
const SB = 'bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n';
const PFVK = 'bc1pfvkpmllr7mtn5uazqxumwp39h2ny3c8l6fmrgvjv2cqn5wlpt7hssf3gqd';
const FED = 975489, STALE = 976740, GATE = 976767, PET74534_FED = 975596, PET74534_DUST = 977161;
const OFFER = 22051, GRAVE = 18845;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const b32 = n => n.toString(32).toUpperCase();
const row = (b, src, amt, tag) => L.row(b, src, amt, tag);
const src = fs.readFileSync(path.join(ROOT, 'js/v2.js'), 'utf8');
function grab(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('missing ' + name);
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); }
  throw new Error('unclosed ' + name);
}
const ctx = { window: {}, console: console };
vm.createContext(ctx);
vm.runInContext([grab('unleashPos'), grab('unleashMax'), grab('unleashTips'), grab('unleashFix'), grab('unleashPlain'), grab('unleashCard')].join('\n'), ctx);
const card = ctx.unleashCard, tipsOf = ctx.unleashTips, fixOf = ctx.unleashFix;
const rulesMd5 = crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, 'js/v2-rules.js'))).digest('hex');
ok(rulesMd5 === require('./lib/rules-md5').MAIN, 'js/v2-rules.js matches main (' + rulesMd5 + ')');
ok(/function mgUnlHtml\(/.test(src) && /return unleashCard\(V, S, w, p, ME/.test(src), 'the My Pets unleash box is the pause-aware card');
ok(/unleashEvalBlock\(world\(\)/.test(src), 'the confirm dialog prices the burn at the same tip the card used');
const play = fs.readFileSync(path.join(ROOT, 'play.html'), 'utf8');
ok(/js\/v2\.js\?v=[\w.-]+/.test(play) && /js\/v2-split\.js\?v=[\w.-]+/.test(play) && /js\/v2-art\.js\?v=[\w.-]+/.test(play), 'play.html bumps v2.js, v2-art.js and v2-split.js');
ok(!/js\/v2\.js\?v=8a0853d5cb/.test(play) && !/js\/v2-split\.js\?v=d4b8e198c7/.test(play), 'play.html does not keep the previous v2.js or v2-split.js url');

const V0 = L.load().V2Rules;
ok(V0.zombieClockGate() === GATE && V0.spanAt(PET74534_FED, 864) === PET74534_DUST, '#74534 pause-aware crumble is 977161');
ok(V0.spanAt(FED, 864) === 977054 && (FED + 864) === 976353, 'the bc1qs88 fixture raw crumble and the span crumble differ');

const FEEDS = [row(974000, SB, 100000, 'pet:feed:' + OFFER), row(975000, SB, 100000, 'pet:feed:' + OFFER)];
const RISE = FEEDS.concat([row(FED, SB, 100000, 'pet:seance:' + GRAVE + ':' + b32(OFFER))]);
const c = L.load(), V = c.V2Rules;
V.MG.HOLD = 0;
const w = L.run(c, SNAP, RISE, STALE);
const Z = w.byId[GRAVE];
ok(!!Z && Z.zombie && !Z.zombie.end && Z.owner === SB && w.tip === STALE, 'bc1qs88 feral is on the world at the stale tip ' + STALE);
const staleWhy = V.mgUnleashWhy(w, Z, SB, STALE + 1);
ok(staleWhy && /too late/.test(staleWhy) && /976353/.test(staleWhy), 'the rules at a below-gate tip still say the raw deadline: ' + staleWhy);

const staleHtml = card(V, { tip: STALE }, w, Z, SB, {});
ok(/Checking the chain…/.test(staleHtml), 'a stale tip below 976767 says it is checking the chain');
ok(!/turn to dust/i.test(staleHtml) && !/too late/i.test(staleHtml) && !/976353/.test(staleHtml), 'that card does not show the old deadline: ' + staleHtml);
const heldHtml = card(V, { tip: STALE, healthTip: STALE }, w, Z, SB, {});
ok(/Checking the chain…/.test(heldHtml) && !/976353/.test(heldHtml), 'a below-gate health tip is not trusted until this page has refreshed');
const heldFresh = card(V, { tip: STALE, healthTip: STALE }, w, Z, SB, { fresh: true });
ok(/turn to dust/i.test(heldFresh) && /976353/.test(heldFresh), 'after that refresh, a chain that is still below the gate keeps the rules deadline');

const liveHtml = card(V, { tip: STALE, chainTip: 976900 }, w, Z, SB, {});
ok(/mg-unlbtn/.test(liveHtml) && /977054/.test(liveHtml), 'with the chain tip past the gate the button names the pause-aware dust block');
ok(!/turn to dust/i.test(liveHtml) && !/976353/.test(liveHtml), 'the chain-tip card does not show the raw deadline: ' + liveHtml);

const worldTip = w.tip;
w.tip = 976900;
const worldHtml = card(V, { tip: STALE }, w, Z, SB, {});
ok(/mg-unlbtn/.test(worldHtml) && /977054/.test(worldHtml) && !/976353/.test(worldHtml), 'a fresh world tip is enough; the raw block stays off the card');
w.tip = worldTip;

Z.feral = true;
const unknownHtml = card(V, { tip: 0 }, { tip: 0, byId: w.byId, pets: w.pets, cem: w.cem }, Z, SB, { hunger: { feral: true } });
ok(/Checking the chain…/.test(unknownHtml) && !/turn to dust/i.test(unknownHtml) && !/976353/.test(unknownHtml), 'an unknown tip says checking, not too late');

/* #74534: fed at 975596, pause-aware dust 977161, raw dust 976460. Viewed as that wallet. */
const prevFed = Z.zombie.fedAt, prevOwner = Z.owner;
const edible = V.mgEdible(w, SB, 976951);
ok(edible.length > 0, 'the read-only bc1qs88 wallet has a Mythic the fixture can lend for the view');
const myth = edible[0], mythOwner = myth.owner;
Z.zombie.fedAt = PET74534_FED; Z.owner = PFVK; myth.owner = PFVK;
const petHtml = card(V, { tip: STALE, healthTip: 976950 }, w, Z, PFVK, {});
ok(/mg-unlbtn/.test(petHtml) && /977161/.test(petHtml), '#74534 card at a stale tab tip uses dust block 977161');
ok(!/turn to dust/i.test(petHtml) && !/976460/.test(petHtml), '#74534 card does not show the raw 976460 deadline: ' + petHtml);
const lateHtml = card(V, { tip: STALE, healthTip: 977154 }, w, Z, PFVK, {});
ok(/turn to dust/i.test(lateHtml) && /977161/.test(lateHtml) && !/976460/.test(lateHtml), 'when the pause-aware clock really has run out, the card names 977161');
Z.zombie.fedAt = prevFed; Z.owner = prevOwner; myth.owner = mythOwner;

const below = tipsOf({ tip: STALE }, { tip: STALE }, GATE);
ok(below.real === STALE && below.pause === false && below.b === STALE + 1, 'tips below the gate stay below the gate');
const above = tipsOf({ tip: STALE, bootTip: 976800, healthTip: 976950, chainTip: 976900 }, { tip: STALE }, GATE);
ok(above.real === 976950 && above.pause === true && above.b === 976951, 'the card uses the highest of boot, health, chain and world');
const cleared = fixOf(V, 'too late: it crumbles at block 976460 before the meal block', above, PET74534_FED);
ok(cleared.cleared === true && cleared.why == null && cleared.crumble === PET74534_DUST, 'a raw too-late line is dropped once the real tip is past the gate');

console.log('unleash-clock-ui-test: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
