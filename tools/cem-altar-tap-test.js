#!/usr/bin/env node
/* Quick taps on the Cemetery altar never freeze the page (Nov 28 2026, Jake: Chrome "Page Unresponsive" while tapping pets onto the altar
 * fast, 1,983 offerable pets).
 * Root cause: one tap redid all the screen's work. Every "+N POWER" guess (48 tiles + up to 300 "gets you there" candidates) re-ran the whole
 * offering, and each run re-read every chain row (heldParts -> pendParts -> confirmed); the burn plan (V2Rules.cemRunsPlan, which walks the
 * whole wallet) was rebuilt 4-5 times per tap. A real 17,843-pet wallet took 300-600 ms per tap on a fast PC, so quick taps queued up.
 * This runs the real js/v2-cemetery-altar.js in a vm with a small fake page and checks:
 *  1. a tap builds NO burn plan and reads the chain rows at most once; the plan is built once, 300 ms after the last tap;
 *  2. the quick "+N POWER" guess equals the full re-run (project(false, [pet])) for every pet, from 0 offered up to the ceiling;
 *  3. the plan the screen shows equals a fresh plans(), and Hold seance signs from a fresh plans() (never a kept copy);
 *  4. the zombie Feed / halo sheet (js/v2-cem-sacrifice.js) and the My Pets zombie card (js/v2.js) price their burns after the ticks stop.
 *   node tools/cem-altar-tap-test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..'), rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('ok   ' + m); } else { fail++; console.log('FAIL ' + m); } };

/* a fake page: every element exists and accepts anything */
const els = {};
function mkEl(id) { const e = { id, hidden: false, disabled: false, innerHTML: '', textContent: '', title: '', value: '', style: { setProperty() {} }, dataset: {}, isConnected: true, children: [],
  classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, setAttribute() {}, getAttribute: () => null, removeAttribute() {}, appendChild(c) { return c; }, remove() {}, insertBefore() {},
  addEventListener() {}, removeEventListener() {}, querySelector: (s) => { const m = /^#(\w+)$/.exec(s); return m ? doc.getElementById(m[1]) : mkEl('q'); }, querySelectorAll: () => [], closest: () => null,
  getContext: () => new Proxy({}, { get: (t, k) => (k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : () => {}) }), getBoundingClientRect: () => ({ width: 0, height: 0, top: 0, left: 0 }),
  scrollIntoView() {}, focus() {}, animate: null, offsetWidth: 1, offsetHeight: 1, parentNode: null, nextElementSibling: null };
  e.parentNode = { insertBefore() {}, removeChild() {}, classList: e.classList }; return e; }
const doc = { readyState: 'complete', getElementById: id => (els[id] = els[id] || mkEl(id)), createElement: () => mkEl('new'), querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, currentScript: null, body: mkEl('body'), head: mkEl('head'), hidden: false };
const timers = []; let now = 0;
const win = { console, document: doc, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, matchMedia: () => ({ matches: true, addEventListener() {} }), requestAnimationFrame: () => 1, cancelAnimationFrame() {},
  setTimeout: (f, ms) => { timers.push({ f, at: now + (ms || 0) }); return timers.length; }, clearTimeout: (i) => { if (timers[i - 1]) timers[i - 1].f = null; }, setInterval: () => 1, clearInterval() {}, getComputedStyle: () => ({ position: 'static', getPropertyValue: () => '' }), innerHeight: 800,
  addEventListener() {}, performance: { now: () => now }, Promise, WeakMap, Map, Object, Math, JSON, Date, navigator: {} };
win.window = win; win.self = win;
function advance(ms) { now += ms; let ran = true; while (ran) { ran = false; for (const t of timers) if (t.f && t.at <= now) { const f = t.f; t.f = null; f(); ran = true; } } }

/* the rules, as far as the altar asks them (same power formula as js/v2-rules.js cemPreview: times = min(cap, 1 + 2 * (1 - keep))) */
const ME = 'bc1qme', CAP = 3, SHARE = [0.04, 0.09, 0.2, 0.45], tip = 977900;
const pets = [], byId = {}; for (let i = 1; i <= 2000; i++) { const p = { id: i, owner: ME, hd: ME, name: 'Pet ' + i, tier: i % 4 === 3 && i % 3 ? 2 : i % 4, stage: 2, neglected: i % 3 === 0, deathBlock: tip + 900 }; pets.push(p); byId[i] = p; }
const G = { id: 5000, name: 'Gravey', tier: 1, dead: true, stats: { vigor: 20, spark: 30, grit: 30, zoom: 30, luck: 29 }, deathBlock: tip - 50 }; pets.push(G); byId[G.id] = G;
const w = { tip, pets, byId, items: {}, cem: { altars: {} } };
const count = { runs: 0, rows: 0 };
let rest = false;
const V = { CEM: { CAP, MILESTONES: [{ at: 1.5, name: 'Shambler' }, { at: 2, name: 'Ghoul' }, { at: 2.5, name: 'Revenant' }, { at: 2.9, name: 'Dread' }], COSTS: {} },
  cemHw: () => false, cemPublic: () => true, cemTokenOfferOn: () => true, seanceOn: () => true, cemHeld: () => null, cemRunsOn: () => true,
  cemOfferWhy: (w, p, src) => (p.owner !== src ? 'not your pet' : p.dead ? 'dead' : p.hd !== src ? 'only a discarded pet can be offered' : null), cemGearWhy: () => 'no', cemGraveWhy: () => null,
  cemView: () => ({ need: 0, grave: true }), cemCost: () => 8.625, parseTag: () => null, itemOf: () => null, wornOf: () => [],
  cemPreview: (w, G, ps, gear) => { let keep = 1; const list = []; ps.forEach(p => { const s = Math.min(0.6, SHARE[p.tier] * (p.neglected ? 1.5 : 1) * 0.8); keep *= 1 - s; list.push({ id: p.id, share: s, ripe: !!p.neglected }); });
    if (rest) keep = 1; const times = Math.round(Math.min(CAP, 1 + 2 * (1 - keep)) * 1e6) / 1e6, dp = Object.values(G.stats).reduce((a, b) => a + b, 0);
    return { times, milestone: 0, power: Math.round(dp * times), deathPower: dp, ceiling: dp * CAP, list, gf: 0.8 }; },
  cemPlan: (w, kind, id, ids) => ({ ok: true, tag: 'pet:' + kind + ':' + id + ':' + ids.join('.'), amount: 8.625 * ids.length, ids }),
  cemRunsPlan: (w, kind, id, ids) => { count.runs++; return [{ ok: true, tag: 'pet:sr:' + id + ':' + ids.length, amount: 8.625 * ids.length, ids: ids.slice(), runs: true }]; },
  cemPetAmount: (w, p) => p };
const rows = new Proxy([], { get: (t, k) => { if (k === 'forEach') count.rows++; return t[k]; } });
const M = { state: () => ({ rows }), world: () => w, updating: () => false };
win.V2Own = { isLiving: (p, who) => p.owner === who && !p.dead, discardSet: () => { const h = {}; pets.forEach(p => { if (p.hd === ME) h[p.id] = 1; }); return h; } };
win.xcpLivingFill = () => Promise.resolve();
const ctx = vm.createContext(win);
vm.runInContext(rd('js/v2-cemetery-altar.js'), ctx);
const X = ctx.V2CemeteryAltar, A = X._state();
(async () => {
X.open({ id: G.id, name: G.name, tier: G.tier }, { w, V, M, R: { lazy() {}, framesWith: () => [] }, ME, b: tip + 1, shortAddr: a => a, fmt: n => String(n) });
advance(1000);
const cand = A.mine.filter(p => !p.why);
ok(cand.length === 2000, 'the altar lists the 2,000 discarded pets (' + cand.length + ')');

/* 1. taps */
count.runs = 0; count.rows = 0;
A.sentLog = [{ txid: 'aa', at: Date.now(), ids: [cand[1999].id], tag: 'pet:sr' }]; /* a burn sent earlier, still waiting: the rows are read to see if it confirmed */
for (let i = 0; i < 25; i++) { if (i === 12) rows.push({ tx_hash: 'bb' }); /* a new block arrives mid-tapping */ X._offer(cand[i].id); await Promise.resolve(); await Promise.resolve(); } /* each tap is its own task */
ok(A.offered.length === 25, '25 quick taps put 25 pets on the altar');
ok(count.runs === 0, 'no burn plan is built while tapping (' + count.runs + ' plans)');
ok(count.rows === 1, 'chain rows re-read only when they change (' + count.rows + ' reads for 25 taps and 1 new row; was ~300 per tap)');
ok(X.project().held.pend === 1, 'the sent burn still counts as waiting (the kept answer is the right one)');
rows.push({ tx_hash: 'aa' }); await Promise.resolve(); ok(X.project().held.pend === 0, 'once its row arrives the sent burn counts as confirmed at once');
advance(310);
ok(count.runs >= 1 && count.runs <= 2, 'the burn plan is built once after the taps stop (' + count.runs + ')');
ok(/XCPETS/.test(doc.getElementById('altSum').innerHTML) && !/counting/.test(doc.getElementById('altSum').innerHTML), 'the cost shows after the taps stop');

/* 2. the quick power guess equals the full re-run */
function gainsMatch(label) { const P = X.project(); let worst = 0, n = 0; cand.slice(1000, 1400).forEach(p => { if (A.offered.some(o => o.id === p.id)) return; worst = Math.max(worst, Math.abs(X._gain(p.id, P.exact) - X._gainSlow(p.id, P.exact))); n++; }); ok(worst < 1e-3, label + ': quick "+N POWER" = full re-run for ' + n + ' pets (worst gap ' + worst.toExponential(1) + ')'); }
A.offered = []; A.sentLog = []; gainsMatch('0 offered');
for (let i = 0; i < 5; i++) X._offer(cand[i].id); gainsMatch('5 offered');
for (let i = 5; i < 60; i++) X._offer(cand[i].id); gainsMatch('60 offered');
for (let i = 60; i < 900; i++) X._offer(cand[i].id); gainsMatch('900 offered (at the ceiling)');
rest = true; await Promise.resolve(); gainsMatch('a resting grave (power stays 1 time)'); rest = false;
advance(310);

/* 3. what is shown = what is signed */
ok(JSON.stringify(X._plansV('seance')) === JSON.stringify(X.plans('seance')), 'the plan on screen equals a fresh plans()');
const src = rd('js/v2-cemetery-altar.js'), holdFn = /function hold\(mode\)[^\n]*/.exec(src)[0];
ok(/var L = plans\(mode\)/.test(holdFn) && !/plansV/.test(holdFn), 'Hold seance / Raise now sign from a fresh plans(), never the kept one'); /* stale-pin-ok: the guarantee is that this line builds fresh */
const k0 = count.runs; X._offer(cand[1500].id); const a = X._plansV('seance'); const b2 = X._plansV('seance'); ok(count.runs === k0 + 1 && a[0].ids.length === b2[0].ids.length, 'one task builds the plan once however many parts of the screen ask');
X._offer(cand[1501].id); ok(X._plansV('seance')[0].ids.length === a[0].ids.length + 1, 'a new tap is never answered with the old plan');

/* 4. the other pickers price after the ticks stop */
const sac = rd('js/v2-cem-sacrifice.js'), v2 = rd('js/v2.js');
ok(/costT = setTimeout\(function \(\) \{[^\n]*plans\(o, I\)/.test(sac) && /function sendIds\(I\) \{ var PL = plans\(o, I\)/.test(sac), 'Feed / halo sheet: cost priced after the ticks stop, Feed signs from a fresh plans()'); /* stale-pin-ok: these lines are the guarantee */
ok(/el\._zbT = setTimeout/.test(v2), 'My Pets zombie card: button cost priced after the ticks stop'); /* stale-pin-ok: same */
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})();
