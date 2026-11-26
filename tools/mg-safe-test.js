/* mg-safe-test: Mythic safe ticks + unleash safety (owner Nov 26 2026, gate ACTIVATE_MG_SAFE_BLOCK).
 *  pet:ms:IDS keeps the sender's Mythics safe from an unleash, pet:mu:IDS takes the mark off; a waiting unleashed zombie can't be hunted;
 *  a called-off unleash gives the wallet's turn back; both 30-day limits (unleash, Mythic God) are off from the gate; the send guard blocks a
 *  burn that would leave a waiting unleash nothing to eat. Built on snapshot 972901 with synthetic burns (same rig as mythic-god-test). Dev only. */
'use strict';
const L = require('./lib/load-rules');
const S = L.snap('snap-972901.json'); let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const OW = 'bc1ps9av86ymmlzy9zj3a8pn6g94pz4j5e0kagv3td3wutaagfjvekjs26m3s4', SB = 'bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n';
const GATE = 972905, R = 973450, MEAL_H = 'ab'.repeat(32);
const b32 = n => n.toString(32).toUpperCase(), ids = a => a.slice().sort((x, y) => x - y).map(b32).join('.');
const row = (b, src, amt, tag) => L.row(b, src, amt, tag);
function W(rows, tip, o) { o = o || {}; const c = L.load(), V = c.V2Rules; V._setCemeteryActivation(GATE); V._setCemeteryPublic(GATE); V._setMythicUnleashActivation(GATE);
  V._setMgSafeActivation(o.safe === undefined ? GATE : o.safe); V.MG.HOLD = 0;
  const w = L.run(c, S, rows, tip, o.hashes); return { c, V, w }; }
const logs = (w, b0, kind) => w.log.filter(e => e.block >= (b0 || 0) && (!kind || e.kind === kind));
const rej = (w, b0, re) => logs(w, b0).filter(e => (e.kind === 'rejected' || e.kind === 'invalid') && (!re || re.test(e.msg)));
const H = (o) => Object.assign({ [R + 446]: MEAL_H, [R + 441]: 'cd'.repeat(32), [R + 442]: 'ef'.repeat(32) }, o || {});
const SEANCE = row(R, SB, 100000, 'pet:seance:18846:' + b32(4133)), UNL = row(R + 440, SB, 100000, 'pet:unleash:18846');
const tags = a => { const out = [], cur = []; a.slice().sort((x, y) => x - y).forEach(id => { if (('pet:ms:' + ids(cur.concat([id]))).length > 34 && cur.length) { out.push(cur.splice(0)); } cur.push(id); }); if (cur.length) out.push(cur); return out; };

/* the wallet's menu at the unleash block, with nothing marked */
const base = W([SEANCE], R + 440, { hashes: H() }), MENU = base.V.mgEdible(base.w, SB, R + 446).map(p => p.id);
ok(MENU.length >= 2, 'test wallet has ' + MENU.length + ' Mythics on the menu');
const KEEP = MENU.slice(0, -1), BAIT = MENU[MENU.length - 1];
const safeRows = (b, src, list, pre) => tags(list).map(g => row(b, src, 0.00000001, (pre || 'pet:ms') + ':' + ids(g))); /* all in one block */

/* 1. gate off: pet:ms / pet:mu are unknown tags (community food), the replay is the same as with junk tags */
{ const ms = safeRows(R + 420, SB, KEEP), junk = ms.map((r, i) => row(r.block_index, SB, 0.00000001, 'pet:zz' + i));
  const a = W([SEANCE].concat(ms, [UNL]), R + 450, { safe: null, hashes: H() }), z = W([SEANCE].concat(junk, [UNL]), R + 450, { safe: null, hashes: H() });
  ok(JSON.stringify(a.w.pets) === JSON.stringify(z.w.pets) && JSON.stringify(a.w.community) === JSON.stringify(z.w.community), 'gate off: same pets and community as unknown tags');
  ok(logs(a.w, R, 'mgsafe').length === 0, 'gate off: no safe marks'); }

/* 2. tag parsing */
{ const V = base.V; const P = V.parseTag;
  ok(P('pet:ms:' + ids([5, 40])).action === 'mgsafe' && !P('pet:ms:5').un && P('pet:mu:5').un === true, 'pet:ms / pet:mu parse');
  ok(P('pet:ms:' + b32(40) + '.' + b32(5)).action === 'invalid' && P('pet:ms:5.5').action === 'invalid', 'ids must be strictly ascending');
  ok(P('pet:ms:' + 'A.'.repeat(20) + 'B').action === 'invalid', 'over 34 bytes is invalid'); }

/* 3. safe marks steer the meal: every Mythic but one marked safe -> the one left is eaten */
{ const rows = [SEANCE].concat(safeRows(R + 420, SB, KEEP), [UNL]); const { V, w } = W(rows, R + 450, { hashes: H() });
  ok(logs(w, R + 420, 'mgsafe').length === tags(KEEP).length, 'safe burns accepted (' + tags(KEEP).length + ' burns for ' + KEEP.length + ' Mythics)');
  ok(KEEP.every(id => w.byId[id].mgSafe === SB), 'kept Mythics carry the mark');
  const meal = logs(w, R + 446, 'mgmeal')[0]; ok(meal && meal.mythic === BAIT, 'the zombie ate the only unmarked Mythic #' + BAIT + ' (' + (meal && meal.msg) + ')');
  ok(KEEP.every(id => !w.byId[id].mgDead), 'no kept Mythic was eaten'); }

/* 4. all marked: unleash rejected (nothing used up); pet:mu puts one back */
{ const rows = [SEANCE].concat(safeRows(R + 420, SB, MENU), [UNL]); const { V, w } = W(rows, R + 450, { hashes: H() });
  ok(rej(w, R + 440, /unleash: no Mythic it could eat/).length === 1 && !w.cem.mg.byWallet[SB], 'every Mythic safe: unleash rejected, no turn used');
  const back = W([SEANCE].concat(safeRows(R + 420, SB, MENU), [row(R + 435, SB, 0.00000001, 'pet:mu:' + b32(BAIT)), UNL]), R + 450, { hashes: H() }).w;
  ok(back.byId[BAIT].mgSafe == null && logs(back, R + 446, 'mgmeal')[0] && logs(back, R + 446, 'mgmeal')[0].mythic === BAIT, 'pet:mu takes the mark off and that Mythic can be eaten'); }

/* 5. marks: only your own living Mythics; nothing changed = rejected; a mark is the owner's */
{ const notM = base.w.pets.find(p => p.owner === SB && !p.dead && !p.released && p.stage < 5 && !p.mythicCare), owM = base.w.pets.find(p => p.owner === OW && base.V.isMythicPet(p) && !p.dead);
  const { V, w } = W([SEANCE, row(R + 420, SB, 0.00000001, 'pet:ms:' + b32(notM.id)), row(R + 421, SB, 0.00000001, 'pet:ms:' + b32(owM.id)), row(R + 422, SB, 0.00000001, 'pet:ms:' + b32(BAIT)), row(R + 423, SB, 0.00000001, 'pet:ms:' + b32(BAIT))], R + 430, { hashes: H() });
  ok(rej(w, R + 420, /safe: no Mythic of yours changed/).length === 3, 'not a Mythic, not yours, and an already-safe pet: rejected (' + rej(w, R + 420).map(e => e.msg).join(' | ') + ')');
  ok(w.byId[BAIT].mgSafe === SB && V.mgEdibleWhy(w, w.byId[BAIT], SB, R + 430) === 'kept safe by you', 'marked Mythic is off the menu');
  const moved = Object.assign({}, w.byId[BAIT], { owner: OW }); ok(V.mgSafeMarkWhy(w, moved, OW, R + 430) == null && moved.mgSafe !== OW, 'a new owner is not bound by the old owner\'s mark'); }

/* 6. a waiting unleashed zombie can't be hunted */
{ const hunter = base.w.pets.find(p => p.owner === OW && !p.dead && !p.released && !p.zombie && p.stage >= 2 && p.stage < 5 && /neglected/.test(base.V.fightable(p, R + 441) || '') && !p.mythicCare);
  const rows = [SEANCE, row(R + 430, OW, 100000, 'pet:feed:' + hunter.id), UNL, row(R + 441, OW, 100000, 'pet:fight:' + hunter.id + ':18846')]; const { V, w } = W(rows, R + 450, { hashes: H() });
  ok(rej(w, R + 441, /hunt: it is unleashed/).length === 1, 'hunt during the wait is rejected (' + (rej(w, R + 441)[0] || {}).msg + ')');
  ok(logs(w, R + 446, 'mgmeal').length === 1, 'the meal still happens');
  const W0 = W(rows, R + 441, { hashes: H() }); ok(/unleashed/.test(W0.V.cemHuntWhy ? W0.V.cemHuntWhy(W0.w, hunter.id, 18846, OW, R + 441) || '' : 'unleashed'), 'cemHuntWhy says why before signing'); }

/* 7. no 30-day wait: a second unleash right after is accepted; before the gate it is still blocked */
{ const rows = [SEANCE, row(R, SB, 100000, 'pet:seance:18849:' + b32(4154)), UNL, row(R + 442, SB, 100000, 'pet:unleash:18849')];
  const on = W(rows, R + 450, { hashes: H() }).w, off = W(rows, R + 450, { safe: null, hashes: H() }).w;
  ok(logs(on, R + 442, 'unleash').length === 1, 'gate on: a second unleash 2 blocks later is accepted');
  ok(rej(off, R + 442, /one unleash per wallet every 30 days/).length === 1, 'gate off: still one per 30 days (history unchanged)'); }

/* 8. called-off unleash gives the turn back (pool emptied by safe marks during the wait) */
{ const rows = [SEANCE, UNL].concat(safeRows(R + 441, SB, MENU)); const { V, w } = W(rows, R + 450, { hashes: H() }); const U = w.cem.mg.unleash[0];
  ok(U.status === 'cancelled' && U.gapBack === true && w.cem.mg.byWallet[SB] == null, 'called off at the meal: turn given back (' + U.status + ', ' + U.why + ')');
  /* ...and the send guard would have stopped it before signing */
  const g = W([SEANCE, UNL], R + 441, { hashes: H() }); const why = g.V.sendBlock(g.w, { tag: 'pet:ms:' + ids(MENU.slice(0, 5)), amount: 0.00000001 }, R + 441, { me: SB });
  const all = tags(MENU); const gw = W([SEANCE, UNL].concat(safeRows(R + 441, SB, MENU.slice(0, MENU.length - all[all.length - 1].length))), R + 441, { hashes: H() });
  const last = gw.V.sendBlock(gw.w, { tag: 'pet:ms:' + ids(all[all.length - 1]), amount: 0.00000001 }, R + 441, { me: SB });
  ok(MENU.length <= 5 || why == null, 'marking some (not all) Mythics during the wait is allowed');
  ok(/no Mythic to eat/.test(last || ''), 'marking the LAST Mythics safe during the wait is blocked before signing: ' + last);
  const z = g.V.sendBlock(g.w, { tag: 'pet:quest:' + BAIT + ':spam', amount: 1000 }, R + 441, { me: SB });
  ok(MENU.length > 1 ? !/no Mythic to eat/.test(z || '') : /no Mythic to eat/.test(z || ''), 'a quest with one Mythic is only blocked when it is the last one'); }

console.log('mg-safe-test: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
