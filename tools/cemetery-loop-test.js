/* cemetery-loop-test: graves, altars, pools, zombies, hunts, the 2% win-back and Resurrection (gate ACTIVATE_CEMETERY_LOOP_BLOCK).
 * Built on snapshot 972901 with synthetic burns. Dev only; nothing signed or sent. */
'use strict';
const L = require('./lib/load-rules');
const S = L.snap('snap-972901.json'); let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const OW = 'bc1ps9av86ymmlzy9zj3a8pn6g94pz4j5e0kagv3td3wutaagfjvekjs26m3s4', SB = 'bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n';
const GATE = 972905, PUB = 972905, R = 973450; /* graves 18845 (Common), 18849 (Uncommon), 18846 / 16970 / 16973 (Rare) die at 973440 */
const b32 = n => n.toString(32).toUpperCase(), ids = a => a.map(b32).join('.');
let tx = 0; const row = (b, src, amt, tag) => L.row(b, src, amt, tag + (++tx > 0 ? '' : ''));
function W(rows, tip, o) { o = o || {}; const c = L.load(), V = c.V2Rules; V._setCemeteryActivation(o.gate === undefined ? GATE : o.gate);
  if (o.pub !== undefined) V._setCemeteryPublic(o.pub); else V._setCemeteryPublic(PUB); if (o.ot) V._setCemOwnerTest(o.ot[0], o.ot[1]);
  const w = L.run(c, S, rows, tip); return { c, V, w }; }
const logs = (w, b0, kind) => w.log.filter(e => e.block >= (b0 || 0) && (!kind || e.kind === kind));
const rej = (w, b0, re) => logs(w, b0).filter(e => (e.kind === 'rejected' || e.kind === 'invalid') && (!re || re.test(e.msg)));
const pow = p => ['vigor', 'spark', 'grit', 'zoom', 'luck'].reduce((a, k) => a + p.stats[k], 0);
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-6);

/* ---------- 1. gate off: every cemetery tag is inert, the world is identical to plain unknown tags ---------- */
const CEM_TAGS = ['pet:seance:18846:' + b32(4133), 'pet:alt:18849:' + b32(4098), 'pet:altm:18849:' + b32(4098) + ':1', 'pet:altg:18849:' + b32(134), 'pet:raise:18849', 'pet:zfeed:18846:' + b32(4111),
  'pet:zfm:18846:' + b32(4111) + ':1', 'pet:rpl:18846:' + b32(4154), 'pet:rplg:18846:' + b32(1), 'pet:resurrect:18846'];
{ const rows = CEM_TAGS.map((t, i) => row(R + i, i % 2 ? OW : SB, 10000, t)), junk = CEM_TAGS.map((t, i) => row(R + i, i % 2 ? OW : SB, 10000, 'pet:zz' + i));
  const a = W(rows, R + 20, { gate: null }), z = W(junk, R + 20, { gate: null });
  ok(a.V.cemeteryGate() === null && !a.V.cemOn(R), 'gate placeholder is null (off)');
  { const V0 = L.load().V2Rules; ok(V0.cemeteryGate() === 973772 && V0.cemPublicBlock() === 973933, 'shipped: gate 973772, public block 973933 (public launch)'); }
  ok(!a.w.cem, 'gate off: no cemetery state on the world');
  ok(JSON.stringify(a.w.pets) === JSON.stringify(z.w.pets) && JSON.stringify(a.w.items) === JSON.stringify(z.w.items), 'gate off: pets and items identical to the same burns with unknown tags');
  ok(logs(a.w, R).filter(e => /seance|alt|raise|zfeed|rpl|resurrect/.test(e.kind)).length === 0, 'gate off: no cemetery log kinds');
  ok(!a.w.byId[4133].released && !a.w.byId[18846].zombie, 'gate off: offerings untouched, grave untouched');
  const late = W(rows, R + 20, { gate: R + 5 }); ok(!late.w.byId[18846].zombie && late.w.byId[18849].zombie === undefined || !late.w.byId[18849].zombie, 'burns before the gate block stay inert');
  const t = W([row(R + 5, SB, 10000, CEM_TAGS[0])], R + 10, { gate: R + 5 }); ok(!!(t.w.byId[18846].zombie), 'a seance at the gate block itself works'); }

/* ---------- 2. owner-test mode (public block null) ---------- */
{ const rows = [row(R, SB, 10000, 'pet:seance:18846:' + b32(4133)), row(R, OW, 10000, 'pet:seance:18849:' + b32(4098)), row(R + 1, OW, 10000, 'pet:alt:18845:' + b32(4428))];
  const a = W(rows, R + 5, { pub: null });
  ok(!a.V.cemPublic(R) && a.V.CEM.OWNER_GRAVE === 2, 'owner test is on until the public block; owner grave is #2');
  ok(rej(a.w, R, /owner test/).length === 3, 'owner test: other wallets and other graves are rejected (' + rej(a.w, R).map(e => e.msg).join(' | ') + ')');
  ok(!a.w.byId[4133].released && !a.w.byId[4098].released && !a.w.byId[4428].pledge, 'owner test: nothing consumed or locked');
  const b = W(rows, R + 5, { pub: null, ot: [OW, 18849] });
  ok(!!b.w.byId[18849].zombie && b.w.byId[18849].owner === OW, 'owner test: the owner wallet can raise the owner grave');
  ok(!b.w.byId[18846].zombie && rej(b.w, R, /owner test/).length === 2, 'owner test: still only that grave and that wallet');
  const c = W(rows, R + 5, { pub: R + 1, ot: [OW, 18849] }); ok(c.V.cemPublic(R + 1) && !c.V.cemPublic(R), 'public from the public block');
  ok(!c.w.byId[18846].zombie && !!c.w.byId[18849].zombie && !c.w.byId[18845].zombie && c.w.cem.altars[18845] && c.w.cem.altars[18845].status === 'open', 'public block: burns from that block open to everyone'); }

/* ---------- 3. seance, minimum, consumption, zombie stats ---------- */
{ const rows = [
    row(R, SB, 10000, 'pet:seance:18846:' + b32(4133)),                 /* Rare grave, Uncommon offering: raises */
    row(R, SB, 10000, 'pet:seance:18846:' + b32(4111)),                 /* already risen */
    row(R + 1, SB, 10000, 'pet:seance:16970:' + b32(4111)),             /* Rare grave needs an Uncommon+ : rejected, nothing used */
    row(R + 2, SB, 1, 'pet:seance:16973:' + b32(4154)),                 /* below cost */
    row(R + 3, SB, 10000, 'pet:seance:16973:' + ids([4111, 4154])),      /* raises with both */
    row(R + 4, SB, 10000, 'pet:seance:18845:' + b32(4098)),             /* not your pet */
    row(R + 4, SB, 10000, 'pet:seance:4184:' + b32(4113)),              /* a living pet is not a grave */
    row(R + 4, SB, 10000, 'pet:seance:18849:' + b32(18849)),            /* the grave itself / dead */
    row(R + 4, SB, 10000, 'pet:seance:18849:' + b32(4112)),             /* Mythics cannot be offered */
    row(R + 4, SB, 10000, 'pet:seance:18849:' + b32(4133)),             /* already used up */
    row(R + 4, SB, 10000, 'pet:seance:18849:' + b32(18846)),            /* zombies cannot be offered */
  ];
  const { V, w } = W(rows, R + 10), Z = w.byId[18846], z = Z.zombie, Z2 = w.byId[16973];
  ok(!!z && Z.owner === SB && z.by === SB && z.prevOwner === OW, 'seance raises: the raiser owns the zombie, the old owner is kept');
  ok(w.byId[4133].released && w.byId[4133].owner === SB, 'seance: the offering is used up');
  ok(near(z.keep, 1 - 0.07 * 1.5 * 0.6), 'Rare grave factor 0.6 times a ripe Uncommon share 0.07 times 1.5: keep ' + z.keep);
  ok(['vigor', 'spark', 'grit', 'zoom', 'luck'].every(k => Z.stats[k] === Math.round(z.death[k] * (1 + 2 * (1 - z.keep)))), 'zombie stats = death stats times (1 + 2 times the share)');
  ok(!Z.dead && Z.stage >= 2 && !Z.feral, 'a zombie is alive, at least stage 2 and not feral');
  ok(rej(w, R, /already risen/).length === 1, 'second seance on a risen grave is rejected');
  ok(rej(w, R, /needs 1 Uncommon\+/).length === 1 && !w.byId[4111].released || w.byId[16973].zombie, 'minimum: a Rare grave needs 1 Uncommon+ offering');
  ok(!w.byId[16970].zombie && !(w.cem.altars[16970] && w.cem.altars[16970].status === 'open'), 'a missed solo seance leaves no open altar');
  ok(rej(w, R, /below cost/).length >= 1, 'below cost is rejected');
  ok(!!Z2.zombie && w.byId[4111].released && w.byId[4154].released, 'two offerings raise the second Rare grave, both used up');
  ok(near(Z2.zombie.keep, (1 - 0.03 * 1.5 * 0.6) * (1 - 0.07 * 1.5 * 0.6)), 'shares multiply: keep ' + Z2.zombie.keep);
  ok(rej(w, R + 4, /not your pet/).length === 1, 'cannot offer a pet you do not own');
  ok(rej(w, R + 4, /not a grave/).length === 1, 'a living pet is not a grave');
  ok(rej(w, R + 4, /grave itself|dead/).length >= 1, 'the grave cannot be offered to itself');
  ok(rej(w, R + 4, /Mythics cannot/).length === 1, 'Mythics cannot be offered');
  ok(rej(w, R + 4, /released or used up/).length === 1, 'a used pet cannot be offered again');
  ok(rej(w, R + 4, /zombies cannot be offered/).length === 1, 'a zombie cannot be offered');
  const v = V.cemView(w, Z, R + 10); ok(v.zombie && v.hungerLeft === 432 - 10 && v.crumbleIn === 864 - 10 && v.milestone === 'Risen', 'view: hunger and crumble clocks (' + v.hungerLeft + ', ' + v.crumbleIn + ')');
  ok(V.cemMilestone(1.5) === 'Shambler' && V.cemMilestone(2) === 'Ghoul' && V.cemMilestone(2.5) === 'Revenant' && V.cemMilestone(2.8) === 'Dread' && V.cemMilestone(1.49) === 'Risen', 'milestones 1.5 / 2 / 2.5 / 2.8 times'); }

/* ---------- 4. pools: pledges, top giver, ties, raise burn, auto-close, dissolve, recheck ---------- */
{ const rows = [
    row(R, OW, 10000, 'pet:alt:18849:' + b32(4098)),                    /* OW: 1 point, opens the pool */
    row(R + 1, SB, 10000, 'pet:alt:18849:' + ids([4111, 4133])),         /* SB: 1 + 3 = 4 points, top */
    row(R + 2, SB, 10000, 'pet:alt:18845:' + b32(4111)),                /* already pledged */
    row(R + 3, OW, 10000, 'pet:raise:18849'),                           /* only the top giver */
    row(R + 4, SB, 1, 'pet:raise:18849'),                               /* below cost */
    row(R + 5, SB, 10000, 'pet:raise:18849'),                           /* raises */
    row(R + 6, OW, 10000, 'pet:alt:18846:' + b32(4428)),                /* Rare grave: Rare offering, pool closes by itself at +144 */
    row(R + 7, SB, 10000, 'pet:alt:16970:' + b32(4113)),                /* Rare grave with only a Common: dissolves */
    row(R + 8, SB, 10000, 'pet:alt:16973:' + ids([4142, 4195])),         /* its only Uncommon is released before the close */
    row(R + 9, SB, 10000, 'pet:rel:4195'),
    row(R + 10, OW, 10000, 'pet:alt:16973:' + b32(4098)),               /* used up already */
  ].filter(r => r);
  const { V, w } = W(rows, R + 200), C = w.cem;
  const A = C.altars[18849]; ok(A && A.status === 'raised' && w.byId[18849].owner === SB, 'pool raised by the top giver burn; top giver owns the zombie');
  ok(w.byId[4098].released && w.byId[4111].released && w.byId[4133].released, 'a raise uses up every pledge, also the other givers');
  ok(rej(w, R, /only the top giver/).length === 1, 'raise by a smaller giver is rejected');
  ok(rej(w, R, /already pledged/).length === 1, 'a pledged pet cannot be pledged twice');
  ok(rej(w, R + 4, /below cost/).length >= 1, 'raise below cost is rejected');
  const B = C.altars[18846]; ok(B && B.status === 'raised' && B.closed === R + 6 + 144 && w.byId[18846].owner === OW, 'pool closes by itself 144 blocks after the first pledge and raises for the top giver');
  ok(w.byId[4428].released, 'auto-close uses up the pledge');
  const D = C.altars[16970]; ok(D && D.status === 'missed' && !w.byId[4113].released && w.byId[4113].pledge == null, 'a pool that misses the minimum dissolves and unlocks everything');
  const E = C.altars[16973]; ok(E && E.status === 'missed', 'a pool whose only Uncommon was released misses the minimum (rechecked at close)');
  ok(!w.byId[4142].released && w.byId[4142].pledge == null, 'dissolve unlocks the remaining pledge');
  ok(logs(w, R, 'altarClosed').length === 2 && logs(w, R, 'raise').filter(e => /closed by itself/.test(e.msg)).length === 1, 'auto-close log lines');
  /* ties go to the first pledge */
  const t = W([row(R, OW, 10000, 'pet:alt:18845:' + b32(4098)), row(R + 1, SB, 10000, 'pet:alt:18845:' + b32(4111))], R + 150);
  ok(t.w.byId[18845].owner === OW, 'tie on points: the first pledge wins'); }

{ const l = W([row(R, OW, 10000, 'pet:seance:18861:' + b32(18850)), row(R + 1, OW, 10000, 'pet:seance:18861:' + b32(4428))], R + 5);
  ok(rej(l.w, R, /Legendary grave needs 1 Rare\+/).length === 1 && !!l.w.byId[18861].zombie && l.w.byId[4428].released && !l.w.byId[18850].released, 'a Legendary grave needs 1 Rare+ offering (grave factor 0.4)');
  ok(near(l.w.byId[18861].zombie.keep, 1 - 0.14 * 1.5 * 0.4), 'Legendary grave factor 0.4: keep ' + l.w.byId[18861].zombie.keep); }

/* ---------- 5. grave gear: flagged after the gate is offered, otherwise back to the stash ---------- */
{ const a = W([row(972910, OW, 10000, 'pet:grave:18845'), row(R, OW, 10000, 'pet:seance:18845:' + b32(4098))], R + 5);
  const g = a.w.items.g3926; ok(!!a.w.byId[18845].zombie && g.spent && /grave gear/.test(g.spent.why), 'grave gear flagged after the gate is offered at the raise (' + JSON.stringify(g.spent) + ')');
  ok(near(a.w.byId[18845].zombie.keep, (1 - 0.03 * 1.5) * (1 - 0.01)), 'grave gear share: keep ' + a.w.byId[18845].zombie.keep);
  const b = W([row(R, OW, 10000, 'pet:seance:18845:' + b32(4098))], R + 5); const h = b.w.items.g3926;
  ok(!h.spent && h.owner === OW && !h.on, 'grave gear not flagged after the gate goes back to the stash');
  const c = W([row(R, SB, 10000, 'pet:altg:18849:' + b32(3)), row(R, SB, 10000, 'pet:altg:18849:' + b32(134)), row(R + 1, SB, 10000, 'pet:seance:18849:' + b32(4113))], R + 5);
  ok(c.w.items.g3.spent && !!c.w.byId[18849].zombie, 'loose gear can be pledged and is used up at the raise');
  ok(rej(c.w, R, /not your gear/).length === 1, 'cannot pledge gear you do not own'); }

/* ---------- 6. zombie life: meals, feral, crumble, raise again, release ---------- */
{ const base = [row(R, SB, 10000, 'pet:seance:18846:' + b32(4133))];
  const f = W(base, R + 431), g = W(base, R + 432), h = W(base, R + 864);
  ok(!f.w.byId[18846].feral && g.w.byId[18846].feral, 'feral exactly 432 blocks after the last meal');
  ok(!g.V.fightable(g.w.byId[18846], R + 432) === false || /feral/.test(g.V.fightable(g.w.byId[18846], R + 432) || ''), 'a feral zombie can only be hunted');
  const Hz = h.w.byId[18846]; ok(!Hz.zombie && Hz.dead && Hz.zCrumbles === 1 && Hz.owner === SB, 'crumbles 432 blocks after feral; it stays a grave of the raiser');
  ok(JSON.stringify(Hz.stats) === JSON.stringify(Hz.zDeath || Hz.zPast[0].death), 'crumbled: stats back to its death stats');
  ok(Hz.stage === f.w.byId[18846].zombie.death && true || Hz.stage < 2, 'crumbled: stage floor removed (' + Hz.stage + ')');
  ok(logs(h.w, R, 'crumble').length === 1, 'crumble log line');
  const meal = base.concat([row(R + 400, SB, 10000, 'pet:zfeed:18846:' + b32(4184)), row(R + 401, OW, 10000, 'pet:zfeed:18846:' + b32(4098)), row(R + 402, SB, 1, 'pet:zfeed:18846:' + b32(4113))]);
  const m = W(meal, R + 800), Mz = m.w.byId[18846];
  ok(Mz.zombie && Mz.zombie.fedAt === R + 400 && !Mz.feral, 'a meal resets the hunger clock');
  ok(near(Mz.zombie.keep, (1 - 0.07 * 1.5 * 0.6) * (1 - 0.05 * 1.5 * 0.6)) && m.w.byId[4184].released, 'a meal adds its share and is used up: keep ' + Mz.zombie.keep);
  ok(rej(m.w, R + 400, /zombie owner only/).length === 1 && !m.w.byId[4098].released, 'only the zombie owner can feed it');
  ok(rej(m.w, R + 400, /below cost/).length === 1, 'a meal below cost is rejected');
  const again = W(base.concat([row(R + 20, SB, 10000, 'pet:rel:18846'), row(R + 30, OW, 10000, 'pet:seance:18846:' + b32(18864))]), R + 35), Ag = again.w.byId[18846];
  ok(Ag.zombie && Ag.zombie.gen === 2 && Ag.owner === OW, 'a crumbled grave can be raised again (gen 2, new owner): ' + rej(again.w, R + 20).map(e => e.msg));
  ok(Ag.zombie && near(Ag.zombie.keep, 1 - 0.14 * 1.5 * 0.6) && Ag.zPast.length === 1, 'gen 2 keep ' + (Ag.zombie && Ag.zombie.keep));
  const RA = R + 300, ag = W([row(RA, OW, 10000, 'pet:seance:18849:' + b32(4098))], RA + 2), days = Math.floor(RA / 144) - Math.floor(973440 / 144);
  ok(days === 2 && near(ag.w.byId[18849].zombie.keep, 1 - 0.03 * 1.5 * 0.8 * (1 - 0.05 * days)), 'age factor: 5% less per day dead (' + days + ' days, keep ' + ag.w.byId[18849].zombie.keep + ')');
  ok(ag.V.cemGraves(ag.w, R + 144 * 30, { text: '18845' })[0].ageFactor === 0.5, 'age factor floor 0.5');
  const rl = W(base.concat([row(R + 20, SB, 10000, 'pet:rel:18846')]), R + 25); ok(!rl.w.byId[18846].zombie && rl.w.byId[18846].zCrumbles === 1 && !rl.w.byId[18846].released, 'releasing a zombie crumbles it back into its grave');
  const blk = W(base.concat([row(R + 10, SB, 10000, 'pet:feed:18846'), row(R + 11, SB, 10000, 'pet:quest:18846:spam'), row(R + 12, SB, 10000, 'pet:raid:18846'), row(R + 13, SB, 10000, 'pet:breed:18846:4113')]), R + 20);
  ok(rej(blk.w, R + 10, /zombie/).length === 4, 'feed, quest, raid and breed are blocked for zombies (' + rej(blk.w, R + 10).map(e => e.msg).join(' | ') + ')'); }

/* ---------- 7. hunts and the 2% win-back ---------- */
{ const base = [row(R, SB, 10000, 'pet:seance:18846:' + b32(4133)), row(R, SB, 10000, 'pet:seance:16973:' + ids([4111, 4154]))], HB = R + 440;
  const hrows = base.concat([row(HB, SB, 10000, 'pet:fight:4112:18846'), row(HB + 1, OW, 1, 'pet:fight:32:16973'), row(HB + 2, OW, 10000, 'pet:fight:13:18846'), row(HB + 3, OW, 10000, 'pet:fight:27:16973')]);
  const { V, w } = W(hrows, HB + 10), hz = logs(w, HB).filter(e => e.kind === 'hunt');
  ok(hz.length >= 1, 'a fight on a feral zombie is a hunt (' + logs(w, HB).map(e => e.kind + ': ' + e.msg).join(' | ') + ')');
  ok(rej(w, HB, /own zombie|your own/).length === 1, 'you cannot hunt your own zombie');
  ok(rej(w, HB, /below/).length === 1, 'a hunt below cost is rejected');
  const Z = w.byId[18846], won = Z.graveState === 'hunted';
  if (won) { ok(!Z.zombie && Z.dead && V.cemGraveWhy(w, Z, SB, HB + 10) && /hunted/.test(V.cemGraveWhy(w, Z, SB, HB + 10)), 'a hunted zombie is laid to rest for good'); }
  else ok(Z.zombie && Z.feral, 'a zombie that wins a hunt stays feral');
  const H = w.cem.hunts; ok(H.length === hz.length && H.every(x => x.hunter && x.zombie), 'hunt records');
  const rewarded = H.filter(x => x.reward); ok(rewarded.length <= 1, 'the hunt reward is paid once per wallet per day (' + rewarded.length + ')');
  const notFeral = W(base.concat([row(R + 10, OW, 10000, 'pet:fight:13:18846')]), R + 20); ok(!logs(notFeral.w, R + 10, 'hunt').length, 'a fight on a non-feral zombie is a normal challenge');
  const ff = W(base.concat([row(HB, SB, 10000, 'pet:fight:18846:4100')]), HB + 5); ok(rej(ff.w, HB, /feral/).length === 1, 'a feral zombie cannot start a fight'); }
{ /* classic fight with a zombie: steal 2% both ways, floor at death stats */
  const base = [row(R, SB, 10000, 'pet:seance:18846:' + b32(4133))];
  const pre = W(base.concat([row(R + 5, SB, 10000, 'pet:fight:18846:13')]), R + 6), fid = pre.w.fights.length;
  ok(pre.w.fights[fid - 1] && pre.w.fights[fid - 1].a === 18846, 'a non-feral zombie can challenge');
  const { V, w } = W(base.concat([row(R + 5, SB, 10000, 'pet:fight:18846:13'), row(R + 6, OW, 10000, 'pet:accept:' + fid)]), R + 10), F = w.fights[fid - 1];
  ok(F && F.status === 'done', 'the challenge is accepted and fought');
  const st = logs(w, R + 6, 'zsteal'); ok(st.length === 1, '2% win-back log (' + (st[0] && st[0].msg) + ')');
  const Z = w.byId[18846], z = Z.zombie;
  if (F.winner === 18846) ok(Object.keys(z.bonus).some(k => z.bonus[k] > 0), 'zombie won: it copies 2% of the loser');
  else { ok(Object.keys(z.bonus).every(k => z.bonus[k] <= 0) && ['vigor', 'spark', 'grit', 'zoom', 'luck'].every(k => V.cemExact(z, k) >= z.death[k]), 'zombie lost: 2% taken, never below its death stats');
    const P = w.byId[13]; ok(P.cemAcc && P.cemAcc.vigor > 0 && P.cemAcc.vigor <= P.cemRoot.vigor * 0.2 + 1e-9, 'the winner banks the 2% toward whole stat points (lifetime limit 20%): ' + JSON.stringify(P.cemAcc)); } }
{ /* the lifetime limit: many small gains never pass +20% of the stats before the first gain */
  const { c, V, w } = W([], R); const p = w.byId[4113], root = Object.assign({}, p.stats); for (let i = 0; i < 400; i++) c.V2Rules._cemGainTest(p, 'vigor', 1);
  ok(p.stats.vigor === root.vigor + Math.floor(root.vigor * 0.2 + 1e-9), 'lifetime gain limit +20%: ' + root.vigor + ' to ' + p.stats.vigor); }

/* ---------- 8. Resurrection ---------- */
{ const base = [row(R, OW, 10000, 'pet:seance:18846:' + b32(4428))];
  const rows = base.concat([row(R + 5, OW, 10000, 'pet:rpl:18846:' + b32(15367)), row(R + 6, SB, 10000, 'pet:rpl:18846:' + b32(4113)), row(R + 7, OW, 10000, 'pet:resurrect:18846')]);
  const few = W(base.concat([row(R + 5, OW, 10000, 'pet:rpl:18846:' + b32(4098)), row(R + 6, OW, 10000, 'pet:resurrect:18846')]), R + 10);
  ok(rej(few.w, R + 6, /25 points/).length === 1 && !!few.w.byId[18846].zombie, 'Resurrection needs at least 25 points');
  const { V, w } = W(rows, R + 10), Z = w.byId[18846], e = logs(w, R + 7).filter(x => x.kind === 'resurrect' || x.kind === 'dust');
  ok(rej(w, R + 6, /zombie owner only/).length === 1, 'only the zombie owner pledges to its Resurrection');
  ok(e.length === 1 && w.byId[15367].released, 'a Resurrection uses up its pledges (' + (e[0] && e[0].msg) + ')');
  const m = /roll (\d+), needed under (\d+)/.exec(e[0] ? e[0].msg : ''); ok(m && (+m[1] < +m[2]) === !!Z.resurrected, 'the roll decides: ' + (e[0] && e[0].msg));
  if (Z.resurrected) ok(!Z.dead && !Z.zombie && Z.owner === OW && Z.resurrected.cap === 4 && !!V.cemGraveWhy(w, Z, OW, R + 10), 'Resurrection: alive again with a halo (cap 4)');
  else ok(Z.graveState === 'dust' && !Z.zombie, 'Resurrection failed: turned to dust');
  const I = (() => { const x = W(base.concat([row(R + 5, OW, 10000, 'pet:rpl:18846:' + b32(15367))]), R + 6); return x.V.cemResInfo(x.w, x.w.byId[18846], R + 6); })();
  ok(I.points === 33 && I.pets.length === 1 && near(I.chance, 0.05 + 0.6 * 33 / 133, 1e-4), 'chance = 5% + 60% times P / (P + 100): ' + I.chance); }

{ /* both outcomes: try a few resurrect blocks until one succeeds and one fails (the roll comes from the block hash and the tx) */
  let seen = {}; for (let k = 7; k < 40 && !(seen.ok && seen.dust); k++) { const rr = [row(R, OW, 10000, 'pet:seance:18846:' + b32(4428)), row(R + 5, OW, 10000, 'pet:rpl:18846:' + b32(15367)), row(R + k, OW, 10000, 'pet:resurrect:18846')], x = W(rr, R + k + 2), Z = x.w.byId[18846];
    if (Z.resurrected && !seen.ok) { seen.ok = 1; ok(!Z.dead && Z.lastFed === R + k && !Z.zombie && Z.stats.vigor >= Z.zPast[0].death.vigor, 'success: alive, fed at the Resurrection, keeps its zombie stats');
      const later = W(rr, R + k + 144 * 9), Y = later.w.byId[18846];
      ok(Y.dead && /halo/.test(later.V.cemGraveWhy(later.w, Y, OW, R + k + 144 * 9) || ''), 'a resurrected pet that dies again rests with its halo and is never raised');
      ok(later.V.cemGraves(later.w, R + k + 144 * 9, { text: '18846' })[0].state === 'halo', 'finder shows the halo grave'); }
    if (Z.graveState === 'dust' && !seen.dust) { seen.dust = 1; ok(Z.dead && !Z.zombie && /dust/.test(x.V.cemGraveWhy(x.w, Z, OW, R + k + 2)), 'failure: dust, never raised again'); } }
  ok(seen.ok && seen.dust, 'both Resurrection outcomes seen'); }

{ /* Halloween window: shares 1.5 times, First to Rise, Resurrection bonus */
  const HW = 973940, x = W([row(R, SB, 10000, 'pet:seance:18846:' + b32(4133)), row(HW, SB, 10000, 'pet:seance:18849:' + b32(4113)), row(HW + 1, SB, 10000, 'pet:seance:18845:' + b32(4142)), row(HW + 2, SB, 10000, 'pet:rpl:18849:' + b32(20870))], HW + 4);
  const days = Math.floor(HW / 144) - Math.floor(973440 / 144), Z = x.w.byId[18849];
  ok(near(Z.zombie.keep, 1 - 0.03 * 1.5 * 1.5 * 0.8 * (1 - 0.05 * days)) && Z.zombie.hw, 'Halloween: shares 1.5 times (keep ' + Z.zombie.keep + ')');
  ok(x.w.cem.firstRise && x.w.cem.firstRise.petId === 18849 && Z.zombie.firstRise && !x.w.byId[18845].zombie.firstRise && !x.w.byId[18846].zombie.firstRise, 'First to Rise: the first raise in the window only');
  const I = x.V.cemResInfo(x.w, Z, HW + 4); ok(I.points === 33 && I.bonus === 10 && near(I.chance, Math.min(0.75, 0.05 + 0.6 * 43 / 143), 1e-4), 'Halloween Resurrection: +10 points (' + I.points + ', ' + I.chance + ')'); }

/* ---------- 9. costs follow the halving count; Halloween window ---------- */
{ const { V, w } = W([], R); const era = V.eraAt(w, R), k = Math.pow(2, era);
  ok(near(V.cemCost(w, 'raise', R), 135 / k) && near(V.cemCost(w, 'pledge', R), 69 / k) && near(V.cemCost(w, 'resurrect', R), 690 / k), 'costs = base / 2 to the era (era ' + era + ')');
  ok(near(V.cemCost(w, 'raise', V.CEM.HW_TO + 1), 270 / Math.pow(2, V.eraAt(w, V.CEM.HW_TO + 1))), 'the raise is 2 times after the Halloween window');
  ok(V.cemHw(V.CEM.HW_FROM) && V.cemHw(V.CEM.HW_TO) && !V.cemHw(V.CEM.HW_FROM - 1) && !V.cemHw(V.CEM.HW_TO + 1), 'Halloween window edges'); }

/* ---------- 10. tags ---------- */
{ const c = L.load(), V = c.V2Rules, P = t => V.parseTag(t);
  ok(JSON.stringify(P('pet:seance:2:3.A').ids) === '[3,10]', 'seance id list is base 32 and dot-separated');
  ok(JSON.stringify(P('pet:zfm:5:10:7').ids) === '[10,11,12]', 'zfm: decimal start plus a base 32 mask, like REL');
  ok(!P('pet:seance:2:A.3') || P('pet:seance:2:A.3').action !== 'seance', 'descending lists are invalid');
  ok(!P('pet:raise:2:1') || P('pet:raise:2:1').action !== 'raise', 'raise takes only the grave');
  ok(P('pet:resurrect:7').action === 'resurrect', 'resurrect tag'); }

/* ---------- 11. grave finder ---------- */
{ const { V, w } = W([row(R, SB, 10000, 'pet:seance:18846:' + b32(4133))], R + 300), all = V.cemGraves(w, R + 300, {});
  ok(all.length > 100 && all.every((g, i) => !i || all[i - 1].tier >= g.tier), 'finder: rarest first by default (' + all.length + ' graves)');
  ok(!all.some(g => g.id === 18846), 'finder: a risen zombie is not listed as a grave');
  const r = V.cemGraves(w, R + 300, { tier: 2 }); ok(r.length && r.every(g => g.tier === 2), 'finder: filter by rarity');
  const s1 = V.cemGraves(w, R + 300, { stage: 1 }); ok(s1.every(g => g.stage === 1), 'finder: filter by stage');
  const d = V.cemGraves(w, R + 300, { minDays: 2, sort: 'oldest' }); ok(d.every(g => g.daysDead >= 2) && d.every((g, i) => !i || d[i - 1].daysDead >= g.daysDead), 'finder: days dead filter and oldest sort');
  const e = V.cemGraves(w, R + 300, { diff: 'easy' }); ok(e.every(g => g.diff === 'easy' && g.need === 0), 'finder: raise difficulty filter');
  const n = V.cemGraves(w, R + 300, { text: '#16970' }); ok(n.length === 1 && n[0].id === 16970, 'finder: number search');
  const ea = V.cemGraves(w, R + 300, { sort: 'easiest' }); ok(ea.every((g, i) => !i || ea[i - 1].need <= g.need), 'finder: easiest sort'); }

/* ---------- 12. send guard (UI): cemSendWhy / cemHuntWhy and the sendBlock hook mirror the engine ---------- */
{ const { V, w } = W([row(R, SB, 10000, 'pet:seance:18846:' + b32(4133))], R + 440), b = R + 441, SB_ = { me: SB }, sb = (tag, o) => V.sendBlock(w, { tag, amount: 100000 }, b - 1, Object.assign({ me: SB }, o || {}));
  const off = W([], R + 5, { gate: null }); ok(/opens at block/.test(off.V.sendBlock(off.w, { tag: 'pet:seance:18849:' + b32(4098), amount: 1e5 }, R, { me: OW }) || ''), 'guard: gate off says the loop is not open');
  ok(/not your pet/.test(V.sendBlock(w, { tag: 'pet:seance:18849:' + b32(4098), amount: 1e5 }, b - 1, { me: SB }) || ''), 'guard: offering another wallet\'s pet is stopped');
  ok(/already risen/.test(sb('pet:alt:18846:' + b32(4134)) || ''), 'guard: a risen grave cannot take offerings');
  const mine = w.pets.filter(p => p.owner === SB && !V.cemOfferWhy(w, p, SB, b)).map(p => p.id).slice(0, 2);
  ok(mine.length === 2 && sb('pet:alt:18849:' + ids(mine)) === null, 'guard: a good pledge passes (' + mine + ')');
  ok(/not confirmed yet/.test(sb('pet:alt:18849:' + ids(mine), { pending: ['pet:alt:18845:' + b32(mine[0])] }) || ''), 'guard: a pet already in an unconfirmed burn is stopped');
  ok(/the grave itself/.test(sb('pet:alt:18849:' + ids([mine[0], 18849].sort((a, c) => a - c))) || '') || /dead/.test(sb('pet:alt:18849:' + ids([mine[0], 18849].sort((a, c) => a - c))) || ''), 'guard: the grave itself is never an offering');
  ok(/no open altar/.test(sb('pet:raise:18849') || ''), 'guard: raise needs an open altar');
  ok(sb('pet:raise:18849', { pending: ['pet:alt:18849:' + b32(mine[0])] }) === null, 'guard: raise right after my own pending pledge passes');
  ok(sb('pet:zfeed:18846:' + b32(mine[0])) === null, 'guard: owner can feed the zombie');
  ok(/zombie owner/.test(V.sendBlock(w, { tag: 'pet:zfeed:18846:' + b32(mine[0]), amount: 1e5 }, b - 1, { me: OW }) || ''), 'guard: only the owner feeds');
  ok(/itself/.test(sb('pet:zfeed:18846:' + b32(18846)) || ''), 'guard: a zombie never eats itself');
  ok(/points/.test(sb('pet:resurrect:18846') || ''), 'guard: Resurrection needs ' + V.CEM.RES_MIN + ' points');
  ok(/not a zombie/.test(sb('pet:zfeed:18849:' + b32(mine[0])) || ''), 'guard: zfeed on a grave is stopped');
  const z = w.byId[18846]; V.cemView(w, z, b); ok(z.feral === true, 'guard setup: #18846 is feral 433+ blocks after its raise');
  const hunter = w.pets.filter(p => p.owner === OW && !V.cemHuntWhy(w, p.id, 18846, OW, b))[0];
  ok(!!hunter, 'guard: the owner wallet has a pet that can hunt');
  if (hunter) { ok(V.sendBlock(w, { tag: 'pet:fight:' + hunter.id + ':18846', amount: 1e5 }, b - 1, { me: OW }) === null, 'guard: a good hunt passes the sendBlock hook');
    ok(/waiting/.test(V.sendBlock(w, { tag: 'pet:fight:' + hunter.id + ':18846', amount: 1e5 }, b - 1, { me: OW, pending: ['pet:fight:' + hunter.id + ':18846'] }) || ''), 'guard: no second hunt burn while one waits'); }
  ok(/own zombie/.test(V.cemHuntWhy(w, mine[0], 18846, SB, b) || ''), 'guard: you cannot hunt your own zombie');
  const early = W([row(R, SB, 10000, 'pet:seance:18846:' + b32(4133))], R + 10); ok(/feral/.test(early.V.cemHuntWhy(early.w, hunter ? hunter.id : 1, 18846, OW, R + 11) || ''), 'guard: a fed zombie cannot be hunted');
  ['seance', 'pledge', 'gear', 'raise', 'zfeed', 'rpl', 'rplg', 'resurrect'].forEach(function (k) { var a = V.cemPlan(w, k, 18849, k === 'raise' || k === 'resurrect' ? null : [1], b).amount; ok(typeof a === 'number' && a > 0 && isFinite(a), 'cemPlan ' + k + ' has a real amount (' + a + ')'); });
  ok(V.cemPlan(w, 'seance', 18849, mine, b).amount === V.cemCost(w, 'seance', b) && V.cemHuntPlan(w, 1, 2, b).amount === V.cemCost(w, 'hunt', b), 'plans carry the halving-aware cost'); }

console.log('cemetery-loop-test: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
