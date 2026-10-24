#!/usr/bin/env node
/* HatchBot automatic warnings (halving; Fire Sales on the fire-sales branch). OFF until deploy: ENABLED must be flipped to true in the deploy commit
 * AND the caller must pass enabled:true. Nothing here posts unless both are true and a real send() is injected/allowed.
 * Built Oct 22 2026 ~12:10 PM CT (owner request). Every post: fires once (dedupe id in announce-rate.json), goes through send-guard
 * announceViolations, max 1,000 characters, "times" never "x", no price/trading talk, only link xcpets.fun.
 *   Halving 1: Lord Kek care crosses ~90% and ~99% of Mythic (6,906,900), then "halving set" when Mythic is reached (burns cost half in 6 blocks).
 *   Halving 2+: started 6 blocks after each later community pet goes to Cold Storage (auto-halving; old path: COMMUNITY_PET_ARRIVAL_BLOCKS), so: "set" once its block is known, "about a day" at 144 blocks to go,
 *   and "next block-ish" at 6 blocks to go.
 *   Fire Sales: warning phase starts (sale in N blocks) and sale goes live (fire-sales branch, via tools/hatchbot-firesale.js).
 * A watcher that comes back late posts only the newest step of each kind (older ones are recorded as 'skipped', never posted late).
 *   node tools/hatchbot-warnings.js --samples   (prints every warning text; sends nothing) */
'use strict';
const ENABLED = false;
const MYTHIC = 6906900, STEPS = [{ id: 90, at: 0.9 }, { id: 99, at: 0.99 }];
const n = x => Number(x).toLocaleString('en-US');
const ord = k => ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'][k] || ('number ' + k);
function halvingTexts() { return {
  care90: (c) => '⭐🐸 HALVING WATCH 🐸⭐\nLord Kek is about 90% of the way to Mythic (' + n(Math.floor(c)) + ' of ' + n(MYTHIC) + ' care). When STAR LORD KEK takes him all the way, every burn costs half, 6 blocks later.\nxcpets.fun',
  care99: (c) => '⭐🐸 HALVING VERY CLOSE 🐸⭐\nLord Kek is 99% of the way to Mythic (' + n(Math.floor(c)) + ' of ' + n(MYTHIC) + ' care). The next big feed could set the halving: every burn costs half 6 blocks after he reaches Mythic.\nxcpets.fun',
  set1: (b, h) => '⭐🐸 THE HALVING IS SET 🐸⭐\nSTAR LORD KEK defeated Lord Kek at block ' + n(b) + '. Lord Kek is in Cold Storage. From block ' + n(h) + ' (6 blocks, about an hour) every burn costs half: hatching, meals, gear spins, fights, breeding, community rolls and community feeding.\nxcpets.fun',
  setN: (k, h) => '⭐ HALVING ' + k + ' IS SET ⭐\nA community pet went to Cold Storage. From block ' + n(h) + ' every burn costs half again (the ' + ord(k) + ' halving).\nxcpets.fun',
  dayN: (k, h) => '⭐ HALVING ' + k + ' IN ABOUT A DAY ⭐\nAt block ' + n(h) + ' every burn costs half again, for the new community pet.\nxcpets.fun',
  soonN: (k, h) => '⭐ HALVING ' + k + ' IN 6 BLOCKS ⭐\nAbout an hour to go: from block ' + n(h) + ' every burn costs half again.\nxcpets.fun' }; }
/** events(w, tip, V): every warning step that is due at tip, oldest first, as { id, kind, text }. Pure, no I/O. */
function halvingEvents(w, tip, V) { const T = halvingTexts(), out = [];
  const care = w && w.kek ? w.kek.fed : 0, km = w && w.kekMythic, mythic = (V && V.COMMUNITY_THRESHOLDS && V.COMMUNITY_THRESHOLDS[5]) || MYTHIC;
  if (km) { const hb = V.halvingBlocks(w); out.push({ id: 'HB-HALVING1-SET-' + km.block, kind: 'halving1', text: T.set1(km.block, hb[0]) });
    hb.slice(1).forEach((h, i) => { const k = i + 2, base = 'HB-HALVING' + k + '-' + h;
      if (tip >= h) return; out.push({ id: base + '-SET', kind: 'halving' + k, text: T.setN(k, h) });
      if (tip >= h - 144) out.push({ id: base + '-DAY', kind: 'halving' + k, text: T.dayN(k, h) });
      if (tip >= h - 6) out.push({ id: base + '-SOON', kind: 'halving' + k, text: T.soonN(k, h) }); }); }
  else STEPS.forEach(s => { if (care + 1e-9 >= s.at * mythic) out.push({ id: 'HB-KEKCARE-' + s.id, kind: 'halving1', text: T['care' + s.id](care) }); });
  return out; }
function fireEvents(w, tip, V) { let F; try { F = require('./hatchbot-firesale'); } catch (e) { return []; }
  if (!V.fireInfo) return []; const fi = V.fireInfo(w, tip), out = [];
  F.due(fi, null, tip).forEach(m => out.push({ id: 'HB-' + m.key.toUpperCase(), kind: 'fire-' + m.key.split('-')[2], text: m.text }));
  return out; }
function events(w, tip, V) { return halvingEvents(w, tip, V).concat(fireEvents(w, tip, V)); }
/** tick(o): o = { w, tip, V, enabled, rate: {load(), save(obj)}, guard: send-guard module, send: async text => result, now }.
 * Posts each due event once. Older steps of the same kind that were never posted are recorded as skipped (no late spam). */
async function tick(o) { if (!(ENABLED || o.forceEnabledForTest) || o.enabled !== true) return { posted: [], skipped: [], reason: 'disabled' };
  const ar = o.rate.load() || {}; ar.posts = ar.posts || []; const seen = new Set(ar.posts.map(p => p.id)), posted = [], skipped = [], blocked = [];
  const ev = events(o.w, o.tip, o.V).filter(e => !seen.has(e.id)), lastOf = {}; ev.forEach(e => { lastOf[e.kind] = e.id; });
  for (const e of ev) { const t = o.now ? o.now() : Date.now();
    if (lastOf[e.kind] !== e.id) { ar.posts.push({ t, id: e.id, kind: 'announce-skipped', priority: 'auto-warning' }); skipped.push(e.id); continue; }
    const v = o.guard.announceViolations(e.text); if (e.text.length > 1000) v.push('over 1000 chars'); if (/\d\s?x\b|\bx\s?\d/i.test(e.text)) v.push('"x" for times');
    if (v.length) { blocked.push({ id: e.id, v }); continue; }
    await o.send(e.text); ar.posts.push({ t, id: e.id, kind: 'announce', priority: 'auto-warning' }); posted.push(e.id); o.rate.save(ar); }
  o.rate.save(ar); return { posted, skipped, blocked }; }
module.exports = { ENABLED, events, halvingEvents, fireEvents, tick, halvingTexts, MYTHIC };
if (require.main === module && process.argv.includes('--samples')) { const T = halvingTexts(); const s = { care90: T.care90(6216210), care99: T.care99(6837831), set1: T.set1(973100, 973106), setN: T.setN(2, 980006), dayN: T.dayN(2, 980006), soonN: T.soonN(2, 980006) };
  try { const F = require('./hatchbot-firesale'), m = F.messages({ arm: 973500, start: 973506, end: 973542 }); s.fireWarning = m.warning.text; s.fireLive = m.start.text; } catch (e) { }
  Object.keys(s).forEach(k => console.log('--- ' + k + ' (' + s[k].length + ' chars)\n' + s[k])); }
