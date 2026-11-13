#!/usr/bin/env node
/* Mythic owner head start (owner decision Nov 11 2026). For MYTHIC_HEADSTART_BLOCKS after a Mythic dies, only the
 * wallet that owned it at death can raise that grave. Another wallet's seance is rejected like any other invalid
 * grave: nothing pledged, offered pets and gear not sacrificed. Non-Mythic graves are unchanged. Before
 * ACTIVATE_MYTHIC_HEADSTART_BLOCK (live at 975529, tip 975523 + 6) replay of history is unchanged, including
 * the seance on grave #1765 at block 975499. Later burns (meals, a token, a resurrect) may change that pet;
 * the rule must not. Dev only. Nothing is signed or sent.
 *   node tools/mythic-headstart-test.js
 */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const L = require('./lib/load-rules');
const ROOT = path.resolve(__dirname, '..');
const S = L.snap('snap-972901.json');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const OW = 'bc1ps9av86ymmlzy9zj3a8pn6g94pz4j5e0kagv3td3wutaagfjvekjs26m3s4';
const SB = 'bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n';
const GATE = 972905, R = 973450, MEAL_H = 'ab'.repeat(32);
const b32 = n => n.toString(32).toUpperCase();
const row = (b, src, amt, tag) => L.row(b, src, amt, tag);
function W(rows, tip, o) {
  o = o || {};
  const c = L.load(), V = c.V2Rules;
  V._setCemeteryActivation(GATE); V._setCemeteryPublic(GATE); V._setSeanceRaisesActivation(GATE);
  V._setMythicUnleashActivation(o.mg === undefined ? GATE : o.mg);
  V._setMythicHeadstartActivation(o.hs === undefined ? GATE : o.hs);
  V.MG.HOLD = 0;
  const w = L.run(c, S, rows, tip, o.hashes);
  return { c, V, w };
}
const logs = (w, b0, kind) => w.log.filter(e => e.block >= (b0 || 0) && (!kind || e.kind === kind));
const rej = (w, b0, re) => logs(w, b0).filter(e => e.kind === 'rejected' && (!re || re.test(e.msg)));
const H = () => { const h = {}; h[R + 446] = MEAL_H; return h; };
const SEANCE = row(R, SB, 100000, 'pet:seance:18846:' + b32(4133));
const UNL = row(R + 440, SB, 100000, 'pet:unleash:18846');
const base = [SEANCE, UNL];

/* ---------- the shipped block ---------- */
{ const V = L.load().V2Rules;
  ok(V.mythicHeadstartGate() === 975529 && V.MYTHIC_HEADSTART_BLOCKS === 144, 'window is the named constant 144 and the gate is block 975529 (tip 975523 + 6)');
  ok(!V.mythicHeadstartOn(975499) && !V.mythicHeadstartOn(975528) && V.mythicHeadstartOn(975529), 'the rule is off for all of today\'s history, including block 975499, and on at 975529'); }

/* the eaten Mythic: the meal log names it (the pool shrinks once it is dead, so it cannot be re-picked afterwards) */
const pre = W(base, R + 449, { hashes: H() });
const meal = pre.w.log.find(e => e.kind === 'mgmeal' && e.block === R + 446);
const E = meal && meal.mythic;
const death = R + 446, openAt = death + 143, after = death + pre.V.MYTHIC_HEADSTART_BLOCKS;
ok(pre.w.byId[E] && pre.w.byId[E].mgDead && pre.w.byId[E].mgDead.owner === SB && pre.w.byId[E].mgDead.block === death, 'Mythic #' + E + ' dies at block ' + death + ' owned by its last owner');
const hs = pre.V.mythicHeadStart(pre.w, pre.w.byId[E], death);
ok(!!hs && hs.owner === SB && hs.left === 144 && hs.until === death + 144, 'at the death block the last owner has 144 blocks left (' + (hs ? pre.V.mythicHeadStartWhy(hs) : 'none') + ')');

const leg = (w, src) => w.pets.find(p => p.owner === src && (p.tier | 0) >= 3 && !p.dead && !p.released && p.id !== E && !pre.V.isMythic(p) && (p.deathBlock == null || p.deathBlock > after + 20));
const gear = w => Object.keys(w.items).map(k => w.items[k]).find(g => g && g.owner === OW && !g.spent && /^g\d+$/.test(g.gid || '') && (g.tier | 0) >= 0);
const ownLeg = leg(pre.w, SB), otherLeg = leg(pre.w, OW), gPiece = gear(pre.w);
ok(!!ownLeg && !!otherLeg, 'a Legendary offering for the last owner (#' + (ownLeg && ownLeg.id) + ') and for another wallet (#' + (otherLeg && otherLeg.id) + ')');
ok(!!gPiece, 'the other wallet has a gear piece that can be offered (' + (gPiece && gPiece.gid) + ')');

function seance(b, src, grave, pet) { return row(b, src, 100000, 'pet:seance:' + grave + ':' + b32(pet)); }
const gid = gPiece ? +String(gPiece.gid).slice(1) : 0;

/* ---------- owner raise inside the window ---------- */
{ const rows = base.concat([seance(death + 4, SB, E, ownLeg.id)]);
  const { w } = W(rows, death + 4, { hashes: H() }), G = w.byId[E], ev = logs(w, death + 4, 'raise')[0];
  ok(ev && G.zombie && G.zombie.mythic && G.owner === SB && G.zombie.by === SB && w.byId[ownLeg.id].released, 'last owner raises inside the window: #' + E + ' rises for them (' + (ev && ev.msg) + ')'); }

/* ---------- another wallet is blocked inside the window; pets and gear are not used ---------- */
{ const rows = base.concat([
    row(death + 4, OW, 100000, 'pet:altg:' + E + ':' + b32(gid)),
    seance(death + 4, OW, E, otherLeg.id)]);
  const { V, w } = W(rows, death + 4, { hashes: H() }), G = w.byId[E], hsNow = V.mythicHeadStart(w, G, death + 4), why = hsNow ? V.mythicHeadStartWhy(hsNow) : '';
  const bad = rej(w, death + 4, /Owner's head start/);
  ok(bad.length === 2 && bad.every(e => e.msg.indexOf(why) >= 0), 'seance and gear part from another wallet are both rejected (' + bad.map(e => e.msg).join(' | ') + ')');
  ok(!G.zombie && G.dead && G.owner === SB && !w.byId[otherLeg.id].released && w.byId[otherLeg.id].pledge == null, 'the grave stays the last owner\'s and the offered pet is not sacrificed');
  const g = w.items[gPiece.gid];
  ok(g && !g.spent && g.owner === OW && g.pledge == null, 'the offered gear is not sacrificed and is not held on the grave');
  ok(/Owner's head start/.test(V.cemSendWhy(w, { action: 'seance', grave: E, ids: [otherLeg.id] }, OW, death + 4, []) || ''), 'the send guard stops the other wallet before a burn is signed');
  ok(V.cemSendWhy(w, { action: 'seance', grave: E, ids: [ownLeg.id] }, SB, death + 4, []) == null, 'the send guard lets the last owner hold the seance');
  const edge = W(base, openAt, { hashes: H() });
  ok(edge.V.mythicHeadStart(edge.w, edge.w.byId[E], openAt).left === 1, 'one block before the window ends, 1 block is left'); }

/* ---------- after the window, the other wallet can raise it ---------- */
{ const rows = base.concat([seance(after, OW, E, otherLeg.id)]);
  const { V, w } = W(rows, after, { hashes: H() }), G = w.byId[E];
  ok(V.mythicHeadStart(w, G, after) == null && G.zombie && G.zombie.by === OW && G.owner === OW && w.byId[otherLeg.id].released, 'at death + ' + V.MYTHIC_HEADSTART_BLOCKS + ' anyone can raise the Mythic, as today'); }

/* ---------- a non-Mythic grave is not in a head-start window ---------- */
{ const g = pre.w.pets.find(p => p.dead && !p.mgDead && !p.zombie && !p.released && !p.community && !p.resurrected && p.graveState !== 'dust' && p.graveState !== 'hunted' && (p.tier | 0) === 0);
  const offer = pre.w.pets.find(p => p.owner === OW && !p.dead && !p.released && !pre.V.isMythic(p) && (p.tier | 0) === 0 && p.id !== (g && g.id) && (p.deathBlock == null || p.deathBlock > death + 20));
  ok(!!g && !!offer, 'a Common grave (#' + (g && g.id) + ') and a Common offering (#' + (offer && offer.id) + ')');
  if (g && offer) {
    const rows = base.concat([seance(death + 4, OW, g.id, offer.id)]);
    const { V, w } = W(rows, death + 4, { hashes: H() }), G = w.byId[g.id];
    ok(V.mythicHeadStart(w, G, death + 4) == null && G.zombie && G.owner === OW && w.byId[offer.id].released && rej(w, death + 4, /head start/).length === 0, 'a non-Mythic grave at the same block is raised by anyone, head start does not apply');
  } }

/* ---------- a crumbled Mythic zombie: the wallet that owned it at the crumble gets a new window ---------- */
{ const raised = death + 4, crumble = raised + 864;
  const rows = base.concat([seance(raised, SB, E, ownLeg.id), seance(crumble + 1, OW, E, otherLeg.id)]);
  const { V, w } = W(rows, crumble + 1, { hashes: H() }), G = w.byId[E], hs2 = V.mythicHeadStart(w, G, crumble + 1);
  ok(!!w.log.find(e => e.kind === 'crumble' && e.petId === E && e.block === crumble), 'the Mythic zombie crumbles back into its grave at fed + 864');
  ok(hs2 && hs2.owner === SB && hs2.death === crumble && hs2.left === 143 && !G.zombie && G.dead && !w.byId[otherLeg.id].released, 'after it crumbles, only the wallet that owned it at that death can raise it (' + (hs2 && V.mythicHeadStartWhy(hs2)) + ')'); }

/* ---------- before the activation block the old rule stands ---------- */
{ const rows = base.concat([seance(death + 4, OW, E, otherLeg.id)]);
  const { V, w } = W(rows, death + 4, { hashes: H(), hs: death + 200 }), G = w.byId[E];
  ok(!V.mythicHeadstartOn(death + 4) && V.mythicHeadStart(w, G, death + 4) == null && G.zombie && G.zombie.by === OW && w.byId[otherLeg.id].released && rej(w, death + 4, /head start/).length === 0, 'a burn before the activation block still lets another wallet raise the Mythic'); }

/* ---------- all existing history, including Sabo #1765 at block 975499, replays the same ---------- */
{ const boot = JSON.parse(fs.readFileSync(path.join(ROOT, 'api', 'boot.json'), 'utf8'));
  const feed = require(path.join(ROOT, 'js', 'pets-feed.js')).expand(JSON.parse(fs.readFileSync(path.join(ROOT, 'api', 'pets.json'), 'utf8')));
  const saboTx = boot.rows.map(r => Object.assign({}, r, { tag: Buffer.from(r.tag, 'hex').toString('utf8') })).find(r => r.block_index === 975499 && r.tag.indexOf('pet:seance:1765') === 0);
  ok(!!saboTx, 'boot.json has the seance on grave #1765 at block 975499');
  const sig = w => crypto.createHash('sha256').update(JSON.stringify({
    pets: w.pets.map(p => [p.id, p.owner, !!p.dead, p.stage, p.care, p.deathBlock, p.released || null, p.zombie ? [p.zombie.by, p.zombie.raisedAt, p.zombie.end ? p.zombie.end.kind : null] : null, p.mgDead ? [p.mgDead.block, p.mgDead.owner, p.mgDead.over || null] : null]),
    log: w.log.map(e => [e.block, e.tx, e.kind, e.msg, e.petId || null])
  })).digest('hex');
  function play(hs) { const c = L.load(), V = c.V2Rules; if (hs !== undefined) V._setMythicHeadstartActivation(hs);
    const Hsh = Object.assign({}, c.XCPETS_BLOCK_HASHES || {}, boot.hashes || {});
    return V.replay(boot.rows, Hsh, [], { tip: boot.tip, live: c.LiveEngine && c.LiveEngine.RealCore, dex: boot.dex || undefined }); }
  const on = play(), off = play(null), pOn = on.byId[1765], pOff = off.byId[1765];
  const line = w => saboTx ? w.log.find(e => e.tx === saboTx.tx_hash) : null;
  ok(sig(on) === sig(off), 'full history to tip ' + boot.tip + ' (' + boot.rows.length + ' burns) is byte-identical with the placeholder gate and with the rule off');
  ok(line(on) && line(on).kind === 'raise' && line(on).block === 975499 && JSON.stringify(line(on)) === JSON.stringify(line(off)), 'Sabo #1765 seance at 975499 still raises, same log line (' + (line(on) && line(on).msg) + ')');
  const pub = feed.pets.find(p => p.id === 1765);
  ok(pub && pOn.owner === pub.owner && (pOn.dead ? 'dead' : 'alive') === pub.status && pOn.deathBlock === pub.deathBlock && pOn.stage === pub.stage, 'replayed Sabo #1765 matches the published feed (owner, ' + (pub && pub.status) + ', death ' + (pub && pub.deathBlock) + ', stage ' + (pub && pub.stage) + ')');
  ok(!!pOn && pOn.owner === pOff.owner && pOn.dead === pOff.dead && pOn.deathBlock === pOff.deathBlock && JSON.stringify(pOn.zombie) === JSON.stringify(pOff.zombie), 'pet #1765 matches with the rule on and off (owner ' + (pOn && pOn.owner) + ', dead ' + (pOn && pOn.dead) + ', death ' + (pOn && pOn.deathBlock) + ', zombie ' + (pOn && pOn.zombie ? pOn.zombie.raisedAt : 'none') + ')'); }

console.log('\n' + (fail ? fail + ' FAILED' : 'all ok') + '  (' + pass + ' checks)');
process.exitCode = fail ? 1 : 0;
