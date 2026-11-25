/* Pause-aware zombie clocks. A zombie fed before the downtime pause keeps the hunger span() already
 * uses, and from ACTIVATE_ZOMBIE_CLOCK_BLOCK its stored feralAt / crumbleAt match that span.
 * Before the block the stored clocks stay raw sums, so fixture replays match main.
 * Dev only. Nothing is signed or broadcast. Does not use the owner wallet. */
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const L = require('./lib/load-rules');
const ROOT = L.ROOT, S = L.snap('snap-972901.json');
const SB = 'bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n';
const FED = 975489, GATE_TIP = 976762, LIVE = 976800, OFFER = 22051, GRAVE = 18845;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const b32 = n => n.toString(32).toUpperCase();
const row = (b, src, amt, tag) => L.row(b, src, amt, tag);
const logs = (w, kind) => (w.log || []).filter(e => !kind || e.kind === kind);
function W(rows, tip, o) {
  o = o || {};
  const c = L.load(), V = c.V2Rules;
  V.MG.HOLD = 0;
  if ('clock' in o) V._setZombieClockActivation(o.clock);
  const w = L.run(c, S, rows, tip);
  return { V, w };
}
const FEEDS = [row(974000, SB, 100000, 'pet:feed:' + OFFER), row(975000, SB, 100000, 'pet:feed:' + OFFER)];
const SEANCE = row(FED, SB, 100000, 'pet:seance:' + GRAVE + ':' + b32(OFFER));
const RISE = FEEDS.concat([SEANCE]);
const dueOf = (start, n) => L.load().V2Rules.spanAt(start, n);

/* ---------- spanAt: the first block where span(block, start) >= n ---------- */
{
  const V = L.load().V2Rules;
  ok(V.zombieClockGate() === 976767, 'shipped gate is 976767 (tip 976761 + 6)');
  ok(V.spanAt(970000, 432) === 970432 && V.spanAt(970000, 864) === 970864, 'a window before the pause is start + n');
  ok(V.spanAt(976667, 432) === 977099 && V.spanAt(976667, 864) === 977531, 'a window after the pause is start + n');
  ok(V.spanAt(975596, 432) === 976729 && V.spanAt(975596, 864) === 977161, 'a window across the pause lands 701 blocks later (#74534)');
  ok(V.spanAt(975375, 864) === 976940 && V.spanAt(975489, 864) === 977054, 'first living crumble and this fixture share the same skip');
  ok(V.spanAt(976000, 432) === 976949, 'a meal during the pause starts from the frozen clock');
  ok(V.span(V.spanAt(975489, 864), 975489) === 864 && V.span(V.spanAt(975489, 864) - 1, 975489) === 863, 'spanAt is the first block that reaches n');
}

/* ---------- before the gate the raw sum still blocks unleash ---------- */
{
  const { V, w } = W(RISE, GATE_TIP), Z = w.byId[GRAVE], z = Z && Z.zombie;
  if (!z) console.log(logs(w).filter(e => e.block >= 973900).map(e => e.block + ' ' + e.kind + ' ' + e.msg).join('\n'));
  ok(!!z && z.fedAt === FED && !Z.dead && Z.feral, 'pre-pause meal is still a living feral zombie before the gate');
  ok(z && z.crumbleAt === FED + 864 && z.feralAt === FED + 432, 'before the gate the stored clocks stay raw sums (' + (z && z.crumbleAt) + ')');
  const why = z && V.mgUnleashWhy(w, Z, SB, GATE_TIP);
  ok(why && /too late/.test(why), 'before the gate unleash still says too late: ' + why);
}

/* ---------- after the gate, unleash is allowed and the crumble block matches span() ---------- */
{
  const { V, w } = W(RISE, LIVE), Z = w.byId[GRAVE], z = Z && Z.zombie;
  const due = V.spanAt(FED, 864), feral = V.spanAt(FED, 432);
  const why = z && V.mgUnleashWhy(w, Z, SB, LIVE);
  ok(!!z && z.fedAt === FED && z.crumbleAt === due && z.feralAt === feral && Z.deathBlock === due, 'stored crumble is the pause-aware block ' + due);
  ok(!!Z && !Z.dead && Z.feral && V.span(LIVE, FED) < 864, 'still alive: span has not reached 864');
  ok(!!z && why == null, 'unleash allowed for a pre-pause meal: ' + why);
  /* Sabo #1765 uses this same clock. Past the old raw crumble, span() has not run out, so it is not dead. */
  const sabo = w.byId[1765];
  ok(!!sabo, 'Sabo #1765 is in the world');
  if (sabo) {
    const copy = JSON.parse(JSON.stringify(sabo));
    copy.zombie = { gen: 1, fedAt: 975499, raisedAt: 975499, keep: 1, death: {}, bonus: {}, cap: 3 };
    copy.dead = true; copy.feral = false;
    V._liveAt(w, copy, LIVE);
    ok(copy.dead === false && copy.zombie.crumbleAt === V.spanAt(975499, 864), 'Sabo #1765 is not dead past the raw crumble while span() remains (' + copy.zombie.crumbleAt + ')');
  }
}
{
  const { w } = W(RISE.concat([row(LIVE, SB, 100000, 'pet:unleash:' + GRAVE)]), LIVE + 5);
  const hit = logs(w, 'unleash').filter(e => e.block === LIVE);
  if (!hit.length) console.log(logs(w).filter(e => e.block >= FED).map(e => e.block + ' ' + e.kind + ' ' + e.msg).join('\n'));
  ok(hit.length === 1 && !/too late|rejected/.test(hit[0].msg), 'the unleash burn is accepted: ' + (hit[0] && hit[0].msg));
}

/* ---------- the hunger crumble is logged at that same pause-aware block ---------- */
{
  const due = dueOf(FED, 864), { w } = W(RISE, due);
  const c = logs(w, 'crumble').filter(e => e.petId === GRAVE);
  const Z = w.byId[GRAVE];
  /* From the 14-day dead-pet rule (block 977,026) a crumbled zombie whose last real meal is old leaves w.byId at once (w.retiredDead):
   * retireDeathClock falls back to lastFed after cemEnd. This test only pins the crumble block; that retire question is a rules decision. */
  ok(c.length === 1 && c[0].block === due && (!Z ? w.retiredDead > 0 : Z.dead && !(Z.zombie && !Z.zombie.end)), 'crumbles at ' + due + ' (' + (c[0] && c[0].block) + ')');
  ok(!logs(w, 'crumble').some(e => e.petId === GRAVE && e.block === FED + 864), 'the raw sum is not the crumble block');
}

/* ---------- a crumble that fires before the gate still records the raw sum ---------- */
{
  const early = 975100, rows = FEEDS.concat([row(early, SB, 100000, 'pet:seance:' + GRAVE + ':' + b32(OFFER))]);
  const tip = 976700, raw = early + 864, due = dueOf(early, 864);
  ok(due < L.load().V2Rules.zombieClockGate() && due <= tip && raw !== due, 'this meal crumbles before the gate and the two blocks differ');
  const old = W(rows, tip), hit = logs(old.w, 'crumble').filter(e => e.petId === GRAVE);
  if (!hit.length) console.log(logs(old.w).filter(e => e.block >= 974000).map(e => e.block + ' ' + e.kind + ' ' + e.msg).join('\n'));
  ok(hit.length === 1 && hit[0].block === raw, 'before the gate the sweep still writes the raw block ' + raw + ' (' + (hit[0] && hit[0].block) + ')');
  const moved = W(rows, tip, { clock: early }), hit2 = logs(moved.w, 'crumble').filter(e => e.petId === GRAVE);
  ok(hit2.length === 1 && hit2[0].block === due, 'with the gate already open the sweep writes ' + due);
}

/* ---------- Sabo is still never described as dead on the pages that draw pets ---------- */
{
  const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
  ok(/p\.id !== 1765/.test(read('js/v2-pet-card.js')), 'pet card never marks Sabo #1765 dead');
  ok(/p\.id !== 1765/.test(read('js/v2-pages.js')), 'pages never draw Sabo #1765 dead');
  ok(/q\.id === 1765/.test(read('js/v2-render.js')), 'render never labels Sabo #1765 gone');
  const sabo = require(path.join(ROOT, 'js/v2-share.js')).text({ id: 1765, name: 'Sabo', tier: 3, stageName: 'Mythic', dead: true });
  ok(/Sabo/.test(sabo) && !/dead|cemetery|grave|Remembering/i.test(sabo), 'share text does not call Sabo #1765 dead: ' + sabo);
}

/* ---------- fixture replays match main (no zombie exists in these snapshots) ---------- */
{
  const snaps = ['snap-971786.json', 'snap-972883.json', 'snap-972901.json'];
  for (const name of snaps) {
    let out = '', code = 0;
    try {
      out = cp.execFileSync(process.execPath, ['tools/replay-check.js', '--compare', 'origin/main', '--snap', path.join('tools', 'snapshots', name)], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64e6 });
    } catch (e) { code = e.status || 1; out = (e.stdout || '') + (e.stderr || ''); }
    const same = code === 0 && out.split('\n').some(l => l.trim() === 'SAME');
    ok(same, name + ' replays SAME as main' + (same ? '' : '\n' + out.split('\n').slice(-8).join('\n')));
  }
}

console.log('zombie-clock-test: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
