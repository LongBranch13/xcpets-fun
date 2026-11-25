/* Crumble = gone forever (owner Nov 25 2026). From ACTIVATE_CRUMBLE_GONE_BLOCK a zombie that crumbles from hunger leaves the
 * world at once (no grave, never raised again); Mythics, Sabo and community pets keep their grave. Before the block nothing changes.
 * Same fixture as tools/zombie-clock-test.js: grave #18845 raised at 975489 with #22051, never fed again.
 * Dev only. Nothing is signed or broadcast. Does not use the owner wallet. */
'use strict';
const L = require('./lib/load-rules');
const S = L.snap('snap-972901.json');
const SB = 'bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n';
const FED = 975489, OFFER = 22051, GRAVE = 18845;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const b32 = n => n.toString(32).toUpperCase();
const RISE = [L.row(974000, SB, 100000, 'pet:feed:' + OFFER), L.row(975000, SB, 100000, 'pet:feed:' + OFFER), L.row(FED, SB, 100000, 'pet:seance:' + GRAVE + ':' + b32(OFFER))];
function W(tip, gate) { const c = L.load(), V = c.V2Rules; V.MG.HOLD = 0; if (gate !== undefined) V._setCrumbleGoneActivation(gate); return { V, w: L.run(c, S, RISE, tip) }; }
const crumbles = w => (w.log || []).filter(e => e.kind === 'crumble' && e.petId === GRAVE);

const V0 = L.load().V2Rules, due = V0.spanAt(FED, 864);
ok(typeof V0.crumbleGoneGate === 'function', 'crumbleGoneGate is exported');

/* ---------- the rule switched off: the old outcome (a grave that can be raised again) ---------- */
{
  const { w } = W(due + 2, null), G = w.byId[GRAVE], c = crumbles(w);
  ok(c.length === 1 && !c[0].gone && /can be raised again/.test(c[0].msg), 'switched off: old crumble line (' + (c[0] && c[0].msg) + ')');
  ok(!G || (G.dead && !(G.zombie && !G.zombie.end)), 'switched off: a grave, or swept by the 14-day rule (the old mixed outcome)');
  ok(!w.crumbledGone, 'switched off: no crumbledGone map');
}

/* ---------- a gate after the crumble does not touch it ---------- */
{
  const { w } = W(due + 2, due + 1), c = crumbles(w);
  ok(c.length === 1 && !c[0].gone && !(w.crumbledGone && w.crumbledGone[GRAVE]), 'a crumble before the gate keeps the old rule');
}

/* ---------- switched on: gone forever ---------- */
{
  const { V, w } = W(due + 2, due - 50), c = crumbles(w);
  ok(c.length === 1 && c[0].gone === true && c[0].block === due, 'logged once as gone at ' + due + ' (' + JSON.stringify(c[0] && { b: c[0].block, g: c[0].gone }) + ')');
  ok(c[0] && /gone forever/.test(c[0].msg) && !/raised again/.test(c[0].msg), 'the log line says gone forever: ' + (c[0] && c[0].msg));
  ok(c[0] && c[0].owner === SB && typeof c[0].species === 'string' && c[0].tier != null, 'the log line keeps owner, species and tier for pages and HatchBot');
  ok(!w.byId[GRAVE] && !w.pets.some(p => p.id === GRAVE), 'the pet left the world');
  ok(!(w.cem.zombies || []).includes(GRAVE), 'not on the zombie list');
  ok(w.crumbledGone && w.crumbledGone[GRAVE] === due, 'crumbledGone records the block');
  ok(!Object.keys(w.items || {}).some(k => { const g = w.items[k]; return g && (g.on === GRAVE || g.bag === GRAVE || g.grave === GRAVE); }), 'no gear still points at it');
  const why = V.retireDeadSendWhy ? V.retireDeadSendWhy(w, { action: 'seance', grave: GRAVE }, due + 3) : null;
  if (why != null) ok(/crumbled to dust/.test(why), 'a burn at it is refused before signing: ' + why);
  /* a later seance on that id does nothing */
  const c2 = L.load(); c2.V2Rules.MG.HOLD = 0; c2.V2Rules._setCrumbleGoneActivation(due - 50);
  const w2 = L.run(c2, S, RISE.concat([L.row(due + 5, SB, 100000, 'pet:seance:' + GRAVE + ':' + b32(OFFER))]), due + 8);
  ok(!w2.byId[GRAVE], 'a seance after it crumbled cannot bring it back');
}

/* ---------- who keeps a grave ---------- */
{
  const V = V0, w = { everMythic: { 7: 970000 } };
  ok(V.crumbleKeeps(w, { id: 1765 }), 'Sabo keeps its grave');
  ok(V.crumbleKeeps(w, { id: 5, community: true }), 'community pets keep theirs');
  ok(V.crumbleKeeps(w, { id: 6, mgDead: { block: 1 } }), 'a Mythic grave stays a Mythic grave');
  ok(V.crumbleKeeps(w, { id: 7 }), 'an ever-Mythic pet stays');
  ok(V.crumbleKeeps(w, { id: 8, stage: 5 }), 'a Mythic-stage pet stays');
  ok(!V.crumbleKeeps(w, { id: 9, tier: 3, stage: 2 }), 'a Legendary zombie is gone forever');
}

console.log('crumble-gone: ' + pass + '/' + (pass + fail) + ' checks');
process.exit(fail ? 1 : 0);
