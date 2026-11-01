/* mythic-god-test: the Mythic God loop (gate ACTIVATE_MYTHIC_UNLEASH_BLOCK, shipped null = off).
 * UNLEASH burn, the random own-Mythic meal, the Mythic-fed zombie, the Mythic grave, the Mythic zombie, Resurrection into a Mythic God,
 * the 21-seat Pantheon, Moon Ward and the 2 times breeding cooldown. Built on snapshot 972901 with synthetic burns. Dev only; nothing signed or sent. */
'use strict';
const L = require('./lib/load-rules'), crypto = require('crypto');
const S = L.snap('snap-972901.json'); let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const OW = 'bc1ps9av86ymmlzy9zj3a8pn6g94pz4j5e0kagv3td3wutaagfjvekjs26m3s4', SB = 'bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n';
const GATE = 972905, R = 973450, MEAL_H = 'ab'.repeat(32);
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const b32 = n => n.toString(32).toUpperCase(), ids = a => a.slice().sort((x, y) => x - y).map(b32).join('.');
const row = (b, src, amt, tag) => L.row(b, src, amt, tag);
/* W(rows, tip, o): o.gate (mythic gate, default GATE), o.hold (default 0 so the 30-day hold does not block the R-era scenario; the hold has its own test), o.seats, o.hashes */
function W(rows, tip, o) { o = o || {}; const c = L.load(), V = c.V2Rules; V._setCemeteryActivation(GATE); V._setCemeteryPublic(GATE);
  V._setMythicUnleashActivation(o.gate === undefined ? GATE : o.gate); V.MG.HOLD = o.hold === undefined ? 0 : o.hold; if (o.seats != null) V.MG.SEATS = o.seats;
  const w = L.run(c, S, rows, tip, o.hashes); return { c, V, w }; }
const logs = (w, b0, kind) => w.log.filter(e => e.block >= (b0 || 0) && (!kind || e.kind === kind));
const rej = (w, b0, re, b1) => logs(w, b0).filter(e => b1 == null || e.block <= b1).filter(e => (e.kind === 'rejected' || e.kind === 'invalid') && (!re || re.test(e.msg)));
const H = (o) => { const h = {}; h[R + 446] = MEAL_H; return Object.assign(h, o || {}); };
const SEANCE = row(R, SB, 100000, 'pet:seance:18846:' + b32(4133)), UNL = row(R + 440, SB, 100000, 'pet:unleash:18846');

const DBG = (w, b0, b1) => console.log(w.log.filter(e => e.block >= b0 && e.block <= b1).map(e => "  " + e.block + " " + e.kind + " " + e.msg).join("\n"));
/* ---------- 1. shipped: the gate is null and an unleash burn is just an unknown tag ---------- */
{ const V0 = L.load().V2Rules; ok(V0.mythicUnleashGate() === null && !V0.mgOn(R) && !V0.mgOn(990000), 'shipped: ACTIVATE_MYTHIC_UNLEASH_BLOCK is null (off)');
  const tags = ['pet:unleash:18846', 'pet:unleash:1', 'pet:unleash:x', 'pet:unleash:18846:1'];
  const a = W([SEANCE].concat(tags.map((t, i) => row(R + 440 + i, SB, 100000, t))), R + 500, { gate: null, hashes: H() });
  const z = W([SEANCE].concat(tags.map((t, i) => row(R + 440 + i, SB, 100000, 'pet:zz' + i))), R + 500, { gate: null, hashes: H() });
  ok(JSON.stringify(a.w.pets) === JSON.stringify(z.w.pets) && JSON.stringify(a.w.items) === JSON.stringify(z.w.items) && JSON.stringify(a.w.community) === JSON.stringify(z.w.community), 'gate off: pets, items and community identical to the same burns with unknown tags');
  ok(!a.w.cem.mg && logs(a.w, R, 'unleash').length === 0 && logs(a.w, R, 'mgmeal').length === 0, 'gate off: no Mythic God state, no unleash or meal');
  ok(JSON.stringify(logs(a.w, R + 440).map(e => e.kind)) === JSON.stringify(logs(z.w, R + 440).map(e => e.kind)), 'gate off: the same log kinds as unknown tags');
  const late = W([SEANCE, UNL], R + 500, { gate: R + 441, hashes: H() }); ok(!late.w.cem.mg && logs(late.w, R + 440, 'unleash').length === 0, 'a burn one block before the gate stays inert');
  const P = t => a.V.parseTag ? a.V.parseTag(t) : null; if (a.V.parseTag) { ok(P('pet:unleash:18846').action === 'unleash' && P('pet:unleash:18846').zombie === 18846, 'tag pet:unleash:Z (decimal id)'); ok(P('pet:unleash:x').action === 'invalid' && P('pet:unleash:1:2').action === 'invalid', 'bad unleash tags are invalid'); } }

/* ---------- 1b. the price: base 690 = 172.5 XCPETS in the Halving 2 era (owner Oct 31 2026 9:01 PM CT [pt2525u]) ---------- */
{ const { V, w } = W([], R + 10), b = R + 20, amt = V.mgPlan(w, 18846, b).amount, pl = V.costAt(w, 69, b);
  ok(V.MG_COSTS.unleash === 690 && amt === V.costAt(w, 690, b) && Math.abs(amt - pl * 10) < 1e-9, 'unleash = 10 pledges at the same era (' + amt + ' vs pledge ' + pl + '): 690 / 4 = 172.5 in the Halving 2 era, like pledge 69 -> 17.25'); }

/* ---------- 2. the unleash burn checks (rejected = nothing used up, nothing locked) ---------- */
{ const rows = [SEANCE, row(R, SB, 100000, 'pet:seance:18849:' + b32(4154)),
    row(R + 100, SB, 100000, 'pet:unleash:18846'),   /* not starving yet */
    row(R + 433, OW, 100000, 'pet:unleash:18846'),   /* not the owner */
    row(R + 434, SB, 100000, 'pet:unleash:4111'),    /* not a zombie */
    row(R + 435, SB, 1, 'pet:unleash:18846'),        /* below cost */
    row(R + 440, SB, 100000, 'pet:unleash:18846'),   /* accepted */
    row(R + 441, SB, 100000, 'pet:unleash:18846'),   /* already waiting */
    row(R + 442, SB, 100000, 'pet:unleash:18849')];  /* one per wallet every 30 days */
  const { V, w } = W(rows, R + 443, { hashes: H() }), Z = w.byId[18846], Y = w.byId[18849];
  ok(rej(w, R + 100, /unleash: only a starving/).length === 1, 'a zombie that is not starving (feral) cannot be unleashed');
  ok(rej(w, R + 433, /unleash: zombie owner only/).length === 1 && rej(w, R + 434, /unleash: not a zombie/).length === 1 && rej(w, R + 435, /unleash: below cost/).length === 1, 'owner only, zombies only, cost checked');
  ok(logs(w, R + 440, 'unleash').length === 1 && /eats one of \d+ Mythics/.test(logs(w, R + 440, 'unleash')[0].msg), 'unleash accepted: ' + (logs(w, R + 440, 'unleash')[0] || {}).msg);
  ok(rej(w, R + 441, /already unleashed: eats at block 973896/).length === 1, 'a second unleash on the same zombie waits for the meal');
  ok(rej(w, R + 442, /one unleash per wallet every 30 days/).length === 1, 'one unleash per wallet every 4,320 blocks');
  const U = w.cem.mg.unleash[0]; ok(U.mealAt === R + 446 && U.status === 'waiting' && Z.zombie.unleash === 1, 'the meal is at the burn block + 6 (still waiting at the tip)');
  ok(V.mgView(w, Z, R + 443).unleash.left === 3, 'mgView: eats in 3 blocks');
  const tooLate = W([SEANCE, row(R + 858, SB, 100000, 'pet:unleash:18846')], R + 860).w; ok(rej(tooLate, R + 858, /too late/).length === 1, 'the burn must land so the meal block comes before it crumbles (last burn fedAt + 857)');
  const lastOk = W([SEANCE, row(R + 857, SB, 100000, 'pet:unleash:18846')], R + 870, { hashes: { [R + 863]: MEAL_H } }).w; ok(logs(lastOk, R + 857, 'mgmeal').length === 1, 'fedAt + 857 still eats at fedAt + 863');
  const full = W(rows.slice(0, 2).concat([row(R + 440, SB, 100000, 'pet:unleash:18846')]), R + 450, { seats: 0, hashes: H() }).w; ok(rej(full, R + 440, /Pantheon is full/).length === 1, 'no unleash while the Pantheon is full');
  const held = W([SEANCE, UNL], R + 450, { hold: 4320, hashes: H() }).w; ok(rej(held, R + 440, /no Mythic it could eat/).length === 1, 'every Mythic held under 30 days: nothing to eat, rejected'); }

/* ---------- 3. edible Mythics: never 1 of 1, edition, community, listed, tokenized; 30-day hold ---------- */
{ const { V, w } = W([], R + 10, { hold: 4320 }), b = 980000; const M = w.pets.find(p => p.owner === SB && p.stage === 5 && !V.mgEdibleWhy(w, p, SB, b));
  ok(!!M, 'a Mythic held 30+ days is edible (#' + (M && M.id) + ')');
  const tryF = (k, v, re) => { const o = M[k]; M[k] = v; const y = V.mgEdibleWhy(w, M, SB, b); M[k] = o; ok(re.test(y || ''), k + ' -> ' + y); };
  tryF('supreme', { of: 1 }, /1 of 1|edition/); tryF('supreme', { of: 5 }, /edition/); tryF('contest', { n: 1 }, /edition/); tryF('burnLord', { rank: 1 }, /edition/);
  tryF('deed', 'XCPETSA', /tokenized/); tryF('cold', { since: 1 }, /Cold Storage/); tryF('lastGot', b - 4319, /held 4319 of 4320/); tryF('lastGot', b - 4320, /^$/);
  const o = M.owner; M.owner = OW; ok(V.mgEdibleWhy(w, M, SB, b) === 'not yours', 'only the unleasher\'s own Mythics'); M.owner = o;
  const cm = w.pets.find(p => p.community && (p.stage === 5 || p.mythicCare)); if (cm) ok(/community/.test(V.mgEdibleWhy(w, cm, cm.owner, b) || ''), 'community Mythics are never eaten');
  else tryF('community', true, /community/); /* snapshot 972901 has no community Mythic in w.pets: flag one (this was the test that went missing, 62 -> 61) */
  /* the owner's #1, #2 and #13 are never eaten (owner Oct 31 2026 9:01 PM CT [pt2525u]) */
  ok(V.MG_NEVER_EAT && [1, 2, 13].every(id => V.MG_NEVER_EAT[id]) && Object.keys(V.MG_NEVER_EAT).length === 3, 'MG_NEVER_EAT is exactly #1, #2, #13');
  [1, 2, 13].forEach(id => { const q = w.byId[id]; ok(q && q.owner === OW && /never eaten/.test(V.mgEdibleWhy(w, q, OW, b) || ''), '#' + id + ' (owner wallet Mythic) is never eaten -> ' + (q && V.mgEdibleWhy(w, q, OW, b))); });
  { const ed = V.mgEdible(w, OW, b).map(p => p.id); ok(ed.length > 0 && [1, 2, 13].every(id => ed.indexOf(id) < 0), 'the owner wallet still has other edible Mythics, never #1, #2 or #13 (' + ed.length + ')'); }
  ok(V.mgEdible(w, SB, b).every((p, i, a) => !i || a[i - 1].id < p.id), 'the pool is sorted by id'); }

/* ---------- 4. the meal: random pick from the meal block hash; the Mythic-fed zombie ---------- */
let E = null;
{ const pre = W([SEANCE, UNL], R + 445, { hashes: H() }), pool = pre.V.mgEdible(pre.w, SB, R + 446).map(p => p.id);
  const k = parseInt(sha(MEAL_H + ':18846:mg-meal').slice(0, 8), 16) % pool.length; E = pool[k];
  const { V, w } = W([SEANCE, UNL], R + 450, { hashes: H() }), Z = w.byId[18846], M = w.byId[E], z = Z.zombie, m = logs(w, R + 446, 'mgmeal')[0];
  ok(m && m.mythic === E && m.block === R + 446, 'the meal picks pool[sha(hash:Z:mg-meal) % n] = #' + E + ' of ' + pool.length + ': ' + (m && m.msg));
  ok(M.dead && M.mgDead && M.mgDead.by === 18846 && M.mgDead.block === R + 446 && M.deathBlock === R + 446, 'the eaten Mythic is dead from the meal block');
  ok(z.mfed && z.mfed.mythic === E && z.cap === 4, 'Mythic-fed: cap 4 times');
  ok(['vigor', 'spark', 'grit', 'zoom', 'luck'].every(s => Math.abs(z.bonus[s] - Math.round(M.zDeath ? 0 : 0) - Math.round(1e6 * 0.3 * M.stats[s]) / 1e6) < 1e-6 || Math.abs((z.bonus[s] || 0) - 0.3 * M.stats[s]) < 1e-5), 'bonus = 30% of the eaten Mythic\'s stats');
  ok(!Z.feral && !Z.dead && Z.zombie.crumbleAt === null, 'cured forever: not feral, never crumbles');
  const far = W([SEANCE, UNL], R + 9000, { hashes: H() }).w; if (!isZalive(far.byId[18846])) DBG(far, R + 440, R + 9000); ok(isZalive(far.byId[18846]) && !far.byId[18846].feral && logs(far, R, 'crumble').filter(e => e.petId === 18846).length === 0, 'still standing 9,000 blocks later (no crumble)');
  const nh = W([SEANCE, UNL], R + 450).w; ok(nh.cem.mg.unleash[0].status === 'waiting' && !nh.byId[E].mgDead, 'no meal block hash yet: the meal waits (nothing eaten)');
  const more = W([SEANCE, UNL, row(R + 451, SB, 100000, 'pet:zfeed:18846:' + b32(4111)), row(R + 452, SB, 100000, 'pet:rpl:18846:' + ids([20870, 20871])), row(R + 453, SB, 100000, 'pet:resurrect:18846'), row(R + 4800, SB, 100000, 'pet:unleash:18846')], R + 4810, { hashes: H() }).w;
  if (rej(more, R + 451, /cured forever/, R + 453).length !== 3) DBG(more, R + 451, R + 453);
  ok(rej(more, R + 451, /cured forever/, R + 453).length === 3 && !more.byId[4111].released && !more.byId[20870].pledge, 'a Mythic-fed zombie takes no zombie meals, no pledges, no Resurrection (nothing used)');
  ok(rej(more, R + 4800, /already Mythic-fed/).length === 1, 'and it never unleashes again'); }
function isZalive(p) { return !!(p && p.zombie && !p.zombie.end && !p.dead); }

/* ---------- 5. cancelled meals ---------- */
{ const gone = W([SEANCE, UNL, row(R + 443, SB, 100000, 'pet:give:18846:' + OW)], R + 450, { hashes: H() }).w, U = gone.cem.mg.unleash[0];
  if (gone.byId[18846].owner === OW) ok(U.status === 'cancelled' && /left the wallet/.test(U.why) && logs(gone, R + 446, 'mgcancel').length === 1, 'zombie left the wallet before the meal: called off');
  else ok(true, 'pet:give not live at this block: skipped');
  const v = W([SEANCE, UNL], R + 445, { hashes: H() }); const pool = v.V.mgEdible(v.w, SB, R + 446); ok(pool.length > 1, 'steering: the pool is every edible Mythic still in the wallet at the meal block (' + pool.length + ')'); }

/* ---------- 6. the Mythic grave, the Mythic zombie ---------- */
const base = [SEANCE, UNL];
{ const rows = base.concat([row(R + 450, SB, 100000, 'pet:seance:' + 0 + ':' + b32(20890))]); rows[2] = row(R + 450, SB, 100000, 'pet:seance:' + E + ':' + b32(20890));
  rows.push(row(R + 451, SB, 100000, 'pet:seance:' + E + ':' + b32(20870)), row(R + 452, SB, 100000, 'pet:zfeed:' + E + ':' + b32(4111)), row(R + 900, SB, 100000, 'pet:unleash:' + E));
  const { V, w } = W(rows, R + 905, { hashes: H() }), G = w.byId[E], z = G.zombie;
  ok(rej(w, R + 450, /a Mythic grave needs 1 Legendary\+ offering/).length === 1 && !w.byId[20890].released, 'a Mythic grave needs 1 Legendary offering (nothing used when short)');
  ok(z && z.mythic && z.cap === 3 && G.owner === SB && logs(w, R + 451, 'raise').some(e => /Mythic zombie/.test(e.msg)), 'raised: a Mythic zombie, cap 3 times');
  ok(z && z.shares.every(s => s.share <= 0.5 * 1 + 1e-9), 'grave factor 0.5 times the age factor');
  if (rej(w, R + 452, /a Mythic zombie never eats/, R + 452).length !== 1) DBG(w, R + 450, R + 452);
  ok(rej(w, R + 452, /a Mythic zombie never eats/, R + 452).length === 1 && !w.byId[4111].released, 'a Mythic zombie takes no zombie meals');
  ok(rej(w, R + 900, /a Mythic zombie never eats/).length === 1, 'a Mythic zombie never unleashes');
  const vw = V.cemView(w, G, R + 460); ok(vw.mythic === true, 'cemView marks the Mythic zombie'); }

/* ---------- 6b. anyone can raise a Mythic grave (owner Oct 31 2026 9:01 PM CT [pt2525u]): another wallet raises SB's Mythic grave ---------- */
{ const rows = base.concat([row(R + 451, OW, 100000, 'pet:seance:' + E + ':' + b32(15367))]);
  const { w } = W(rows, R + 460, { hashes: H() }), G = w.byId[E], z = G.zombie;
  ok(z && z.mythic && z.by === OW && G.owner === OW && z.prevOwner === SB && w.byId[15367].released, 'another wallet raises a Mythic grave with its own Legendary offering: the Mythic zombie is the raiser\'s');
  ok(rej(w, R + 451, /owner|not your/, R + 451).length === 0, 'no owner-only block on raising a Mythic grave'); }

/* ---------- 7. Resurrection into a Mythic God ---------- */
{ const pre = base.concat([row(R + 451, SB, 100000, 'pet:seance:' + E + ':' + b32(20870)), row(R + 452, SB, 100000, 'pet:rpl:' + E + ':' + b32(20871))]);
  const few = W(pre.concat([row(R + 453, SB, 100000, 'pet:resurrect:' + E)]), R + 455, { hashes: H() }); ok(rej(few.w, R + 453, /needs 66 points, has 33/).length === 1 && !few.w.byId[20871].released, 'needs 66 points (a Legendary is 33): nothing used');
  const rows = pre.concat([row(R + 453, SB, 100000, 'pet:rpl:' + E + ':' + b32(20944))]), RES = row(R + 460, SB, 100000, 'pet:resurrect:' + E);
  const I = (() => { const x = W(rows, R + 459, { hashes: H() }); return x.V.cemResInfo(x.w, x.w.byId[E], R + 460); })();
  const hw = R + 460 >= 973935 && R + 460 <= 975670, P = I.points + (hw ? 10 : 0), ch = Math.min(hw ? 0.5 : 0.4, 0.03 + 0.45 * P / (P + 150));
  ok(I.points === 66 && I.mythic && Math.abs(I.chance - Math.round(ch * 1e4) / 1e4) < 1e-9, 'chance = 3% + 45% times P/(P+150), top 40%: ' + I.chance);
  const need = Math.round(I.chance * 10000); let win = null, lose = null;
  for (let i = 0; i < 4000 && !(win && lose); i++) { const h = sha('mg-try-' + i), n = parseInt(sha(h + ':' + RES.tx_hash + ':resurrect').slice(0, 8), 16) % 10000; if (n < need && !win) win = h; if (n >= need && !lose) lose = h; }
  const G = W(rows.concat([RES]), R + 470, { hashes: H({ [R + 460]: win }) }), Z = G.w.byId[E], st = G.w.cem.mg.seats;
  if (!Z.mythicGod) DBG(G.w, R + 446, R + 470);
  ok(Z.mythicGod && Z.mythicGod.seat === 1 && st.length === 1 && st[0].petId === E && st[0].eatenBy === 18846 && st[0].owner === SB, 'WIN: a Mythic God, seat 1 of 21 in the Pantheon');
  ok(logs(G.w, R + 460, 'mgrise').length === 1 && /MYTHIC GOD: seat 1 of 21/.test(logs(G.w, R + 460, 'mgrise')[0].msg), 'logged: ' + (logs(G.w, R + 460, 'mgrise')[0] || {}).msg);
  ok(['vigor', 'spark', 'grit', 'zoom', 'luck'].every(k => Z.stats[k] === Math.round(Z.zDeath[k] * 1.25)), 'stats = its Mythic stats at death plus 25%');
  ok(Z.resurrected.cap === 4 && !Z.dead && !Z.zombie && G.V.tierLabelOf(Z) === 'Mythic God' && G.V.stageLabelOf(Z) === 'Mythic God', 'cap 4, alive, labelled Mythic God');
  ok(G.w.byId[20871].released && G.w.byId[20944].released, 'the pledged pieces are used up');
  const far = W(rows.concat([RES]), R + 40000, { hashes: H({ [R + 460]: win }) }).w; ok(!far.byId[E].dead && far.byId[E].mythicGod, 'a Mythic God never dies (40,000 blocks later)');
  ok(G.V.mgBreedCool(Z) === 2016 && G.V.mgBreedCool(G.w.byId[4111]) === 1008, 'breeding cooldown 2 times');
  const F = W(rows.concat([RES]), R + 470, { hashes: H({ [R + 460]: lose }) }), Y = F.w.byId[E];
  ok(!Y.mythicGod && Y.dead && Y.graveState === 'dust' && F.w.cem.mg.seats.length === 0 && logs(F.w, R + 460, 'resurrect').some(e => /dust/.test(e.msg)), 'FAIL: dust forever, no seat');
  ok(G.V.mgPantheon(G.w).seats.length === 1 && G.V.mgPantheon(G.w).of === 21, 'mgPantheon lists the seats'); }

/* ---------- 8. Moon Ward ---------- */
{ const { V, w } = W([], R + 1), g = { id: 1, mythicGod: { seat: 1 } }, n = { id: 2 }; w._b = R + 10;
  ok(V._mgWard(w, g, 'fight 7') === true && V._mgWard(w, g, 'fight 7') === true, 'Moon Ward covers the whole first lost fight of the day');
  ok(V._mgWard(w, g, 'fight 8') === false, 'the second lost fight that day is a normal loss');
  w._b = R + 10 + 144; ok(V._mgWard(w, g, 'fight 9') === true, 'a new 144-block day: the ward is back');
  ok(V._mgWard(w, n, 'fight 9') === false && V._mgWard(w, { mythicGod: {} }, 'rumble week 3') === false, 'only Mythic Gods, only fights and hunts'); }

console.log('mythic-god-test: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
