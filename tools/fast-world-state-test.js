#!/usr/bin/env node
/* Fast world state (Nov 25 2026, root fix). Pages paint from the server's published view, not a replay. Every rules table the view
 * left out was a bug only fast pages had (Fire Sale price, Pantheon seats, saved spins, player numbers, the Mythic discount...).
 * tools/sync-server/split.js now carries every top-level world table in summary.state unless STATE_OWN / STATE_SKIP / STATE_SLIM
 * says otherwise. This test keeps it that way:
 *   1. every table the rules create is carried, or listed with a reason (a new table is carried by default: nothing to do),
 *   2. a page can never read a skipped table: no page script names it, and no rules function a page calls reads it (call graph),
 *   3. end to end: a world with every table goes through split.write and the page's own assemble() and comes out the same,
 *   4. the answers players saw wrong on fast pages (spins, player #, gift inbox, flame looks, Mythic discount, hunt grudges,
 *      the Pantheon seats on every page) are the same on the fast world as on the full one.
 *   node tools/fast-world-state-test.js */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..'), rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const split = require('./sync-server/split');
let pass = 0, fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (c) pass++; else fail++; };
const RULES = rd('js/v2-rules.js');

/* ---- 1. the tables the rules create */
function rulesTables() {
  const keys = new Set();
  const lit = /var w = \{([^;]*?)\};/.exec(RULES); /* the replay's starting world */
  if (lit) lit[1].replace(/(?:^|,)\s*([A-Za-z_$][\w$]*)\s*:/g, (m, k) => { keys.add(k); return m; });
  RULES.replace(/\bw\.([A-Za-z_$][\w$]*)\s*=(?!=)/g, (m, k) => { keys.add(k); return m; });
  RULES.replace(/\(w\.([A-Za-z_$][\w$]*)\s*=(?!=)/g, (m, k) => { keys.add(k); return m; });
  return keys;
}
const tables = rulesTables();
ok(tables.size > 50 && tables.has('spins') && tables.has('fire') && tables.has('cem') && tables.has('players'), 'found the rules tables (' + tables.size + ')');
const kinds = {}; tables.forEach(k => { kinds[k] = split.stateKind(k); });
ok(Object.keys(split.STATE_SKIP).every(k => typeof split.STATE_SKIP[k] === 'string' && split.STATE_SKIP[k].length > 10), 'every skipped table says why');
ok(Object.keys(split.STATE_SKIP).every(k => tables.has(k)), 'every skipped table is still a rules table (no stale entries): ' + Object.keys(split.STATE_SKIP).filter(k => !tables.has(k)).join(', '));
const carried = [...tables].filter(k => kinds[k] === 'carry' || kinds[k] === 'slim');
ok(['spins', 'players', 'playerList', 'giftLog', 'burnedBy', 'mythicGot', 'everMythic', 'swaps', 'listings', 'ads', '_rw', 'wagmiFirst', 'mythicOwners', 'tokens', 'cem', 'lookCopies', 'bags', 'fireSpins', 'overflowUsed', 'earlyBurner', 'streakSpin']
  .every(k => carried.indexOf(k) >= 0), 'the tables fast pages missed before Nov 25 are carried');

/* ---- 2. nobody on a page can read a skipped table */
/* named functions of the rules file and the text of each (up to the next named function at the same depth is good enough here) */
function namedFunctions(src) {
  const out = [], re = /function ([A-Za-z_$][\w$]*)\s*\(/g; let m;
  while ((m = re.exec(src))) out.push({ name: m[1], at: m.index });
  out.forEach((f, i) => { /* body: brace match from the first { after the name */
    let j = src.indexOf('{', f.at), depth = 0, k = j, q = null;
    for (; k < src.length; k++) { const c = src[k];
      if (q) { if (c === '\\') { k++; continue; } if (c === q) q = null; continue; }
      if (c === '"' || c === "'") { q = c; continue; }
      if (c === '/' && src[k + 1] === '/') { k = src.indexOf('\n', k); if (k < 0) break; continue; }
      if (c === '/' && src[k + 1] === '*') { k = src.indexOf('*/', k + 2) + 1; continue; }
      if (c === '{') depth++; else if (c === '}') { depth--; if (!depth) break; } }
    f.body = src.slice(j, k + 1); });
  return out;
}
const fns = namedFunctions(RULES), byName = {}; fns.forEach(f => { if (!byName[f.name] || f.body.length > byName[f.name].body.length) byName[f.name] = f; });
const names = Object.keys(byName);
/* readers[k] = rules functions that read table k (directly or through a function they call) */
function readersOf(k) {
  const direct = new Set(names.filter(n => new RegExp('\\bw\\.' + k.replace(/\$/g, '\\$') + '\\b').test(byName[n].body)));
  let grew = true; const all = new Set(direct);
  const callRe = {}; names.forEach(n => { callRe[n] = new RegExp('\\b' + n.replace(/\$/g, '\\$') + '\\s*\\('); });
  while (grew) { grew = false; names.forEach(n => { if (all.has(n)) return; for (const d of all) if (n !== d && callRe[d].test(byName[n].body)) { all.add(n); grew = true; break; } }); }
  return all;
}
/* the replay's own entry points: a function only they reach is never run by a page on its view world */
const REPLAY_ONLY = new Set(['replay', 'handle', 'reindex', 'resume', 'replayFrom']);
const pageFiles = fs.readdirSync(path.join(ROOT, 'js')).filter(f => /\.js$/.test(f) && !/^(v2-rules|v2-resume|qr\.min|block-hashes)\.js$/.test(f) && !/worker\.js$/.test(f)).map(f => 'js/' + f)
  .concat(fs.existsSync(path.join(ROOT, 'tg')) ? fs.readdirSync(path.join(ROOT, 'tg')).filter(f => /\.js$/.test(f)).map(f => 'tg/' + f) : []);
const pageText = pageFiles.map(f => [f, rd(f)]);
/* the call graph works: saved spins are read through spinsLeft, which pages call */
const spinReaders = readersOf('spins');
ok(spinReaders.has('spinsLeft') && pageText.some(([f, t]) => /\.spinsLeft\s*\(/.test(t)), 'call graph: pages reach w.spins through spinsLeft (' + spinReaders.size + ' rules functions read it)');
/* a skipped table a page function may still name because the rules guard its absence the same way a full world does */
const ABSENT_OK = { _cg: 'null on a full world too: chainList() falls back to the live list without it' };
Object.keys(split.STATE_SKIP).forEach(k => {
  const direct = pageText.filter(([f, t]) => new RegExp('\\.' + k + '\\b').test(t)).map(([f]) => f);
  ok(!direct.length, 'no page script reads w.' + k + (direct.length ? ' (read in ' + direct.join(', ') + ')' : ''));
  if (ABSENT_OK[k]) return;
  const rs = [...readersOf(k)].filter(n => !REPLAY_ONLY.has(n));
  const called = []; rs.forEach(n => { pageText.forEach(([f, t]) => { if (new RegExp('\\.' + n.replace(/\$/g, '\\$') + '\\s*\\(').test(t)) called.push(n + ' in ' + f); }); });
  ok(!called.length, 'no page calls a rules function that reads w.' + k + (called.length ? ': ' + called.slice(0, 6).join('; ') : ''));
});

/* ---- 3. end to end: split.write -> summary.json + owner page -> the page's own assemble() */
const { load: loadRulesVm } = require('./lib/load-rules');
function memStore() { const m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; }
function loadSplit(V) {
  const ctx = { console: console, setTimeout: setTimeout, clearTimeout: clearTimeout, crypto: crypto, URL: URL, URLSearchParams: URLSearchParams, TextEncoder: TextEncoder, TextDecoder: TextDecoder,
    fetch: () => Promise.reject(new Error('offline')), document: { scripts: [], getElementById: () => null, body: { insertBefore: () => {} } },
    location: { search: '', href: 'https://xcpets.fun/play.html' }, localStorage: memStore(), sessionStorage: memStore() };
  ctx.window = ctx; ctx.self = ctx; if (V) ctx.V2Rules = V; vm.createContext(ctx);
  vm.runInContext(rd('js/v2-art.js'), ctx, { filename: 'js/v2-art.js' });
  vm.runInContext(rd('js/v2-split.js'), ctx, { filename: 'js/v2-split.js' });
  return ctx.V2Split;
}
const ALICE = 'bc1qaliceexample000000000000000000000000', BOB = 'bc1qbobexample00000000000000000000000000', TIP = 977400, B = TIP + 1;
function pet(id, owner, extra) { return Object.assign({ id: id, owner: owner, name: 'P' + id, species: 'pepe', tier: 1, stage: 3, care: 5000, hatchBlock: 975000, lastFed: TIP - 10, feedDays: {}, fightDays: {}, dead: false, released: false, wins: 0, losses: 0, stats: { vigor: 10, spark: 10, grit: 10, zoom: 10, luck: 10 } }, extra || {}); }
const pets = [];
for (let i = 1; i <= 12; i++) pets.push(pet(i, ALICE, i === 1 ? { care: 70000, stage: 5, ascended: true } : null));
for (let i = 20; i <= 25; i++) pets.push(pet(i, BOB, i === 20 ? { care: 70000, stage: 5 } : null));
pets.push(pet(30, BOB, { dead: true, deathBlock: TIP - 3000 }));
const world = {
  tip: TIP, pets: pets, items: { g1: { gid: 'g1', item: 'hat', label: 'Hat', slot: 'head', tier: 1, owner: ALICE, on: 2, src: 'roll', rolledOn: 2, wheel: true } },
  deeds: {}, community: { burned: 3, leaderboard: [] }, log: [], fights: [], breedReqs: [],
  mythicOwners: { [ALICE]: 975500, [BOB]: 976000 },
  spins: { [ALICE]: { earned: 10, used: 3, log: [{ block: TIP - 50, tx: 'x', src: 'lucky', n: 10 }] }, [BOB]: { earned: 4, used: 4, log: [] } },
  fireSpins: { [ALICE]: 2 }, overflowUsed: {},
  players: { [ALICE]: 1, [BOB]: 2 }, playerList: [ALICE, BOB],
  giftLog: [{ block: TIP - 5, tx: 'g', petId: 3, from: BOB, to: ALICE }],
  burnedBy: { [ALICE]: 300000, [BOB]: 1200000 }, earlyBurner: { [ALICE]: 1 },
  mythicGot: { 1: { owner: ALICE, own: 1 } }, everMythic: { 1: 975400, 20: 975900 },
  tokens: { [ALICE]: 2 },
  lookCopies: { 'earn:wings:1': { key: 'earn:wings:1', kind: 'earn', id: 'wings', src: 1, holder: ALICE, at: 1 }, 'earn:halo:2': { key: 'earn:halo:2', kind: 'earn', id: 'halo', src: 2, holder: ALICE, at: 7 },
    'earn:wings:20': { key: 'earn:wings:20', kind: 'earn', id: 'wings', src: 20, holder: BOB, at: 20 } },
  cem: { huntedBy: { [ALICE]: 1 }, huntDay: { [ALICE]: Math.floor(TIP / 144) }, raisedBy: { [ALICE]: 2 }, grudges: { '3:30': { at: TIP - 20, by: ALICE, zOwner: BOB, credit: 100, stacks: 1, until: TIP + 500 } }, firstRise: null, zombies: [], log: [], pend: [],
    altars: { 30: { n: 1, grave: 30, opened: TIP - 10, status: 'open', pledges: [] }, 31: { n: 2, grave: 31, opened: TIP - 9000, status: 'raised', pledges: [] } },
    altarList: [], hunts: [{ n: 1, block: TIP - 5000 }, { n: 2, block: TIP - 10, by: ALICE }],
    mg: { seats: [{ seat: 1, petId: 99, owner: BOB }], meals: [], unleash: [{ n: 1, block: TIP - 3, petId: 5, owner: ALICE }], byWallet: { [ALICE]: TIP - 3 }, godBy: {} } },
  futureTable: { anything: [1, 2, 3] }, /* a table some future rules change adds: it must reach fast pages with nobody touching split.js */
  questFeed: [{ petId: 1, rec: {} }], lookOwners: { 1: ALICE } /* skipped */
};
world.cem.altarList = Object.keys(world.cem.altars).map(k => world.cem.altars[k]);
const J = v => JSON.stringify(v), clone = v => JSON.parse(JSON.stringify(v));
const full = clone(world); full.byId = {}; full.pets.forEach(p => { full.byId[p.id] = p; }); full.itemList = Object.keys(full.items).map(k => full.items[k]);
(async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'fast-state-'));
  await split.write(out, clone(world), { tip: TIP, rsig: 'r' + 'ab'.repeat(16) });
  const summary = JSON.parse(fs.readFileSync(path.join(out, 'summary.json'), 'utf8'));
  ok(summary.state && !summary.state.questFeed && !summary.state.lookOwners, 'summary.state is written and leaves out the skipped tables');
  ok(J(summary.state.futureTable) === J(world.futureTable), 'a brand-new rules table rides along with no code change');
  const page = JSON.parse(fs.readFileSync(path.join(out, 'own', split.ownerKey(ALICE) + '.json'), 'utf8'));
  ok(page.looks && page.looks['earn:wings:1'] && page.looks['earn:halo:2'] && !page.looks['earn:wings:20'], 'owner page 0 carries the look copies its wallet holds');
  const R = loadRulesVm(), V = R.V2Rules, S = loadSplit(V);
  S.openOwnerPets({ v: 3, looks: page.looks, owner: ALICE }, ALICE);
  const owners = {}; owners[ALICE] = clone(pets.filter(p => p.owner === ALICE)); owners[BOB] = clone(pets.filter(p => p.owner === BOB));
  const fast = S.assemble(summary, { owners: owners, mythicOwners: { [ALICE]: page.mythicAt }, owner: ALICE });
  const bad = [];
  Object.keys(world).forEach(k => {
    const kind = split.stateKind(k); if (kind === 'own' || kind === 'skip') return;
    let want = clone(world[k]);
    if (k === 'spins') Object.keys(want).forEach(a => { delete want[a].log; });
    if (k === 'lookCopies') want = { 'earn:wings:1': want['earn:wings:1'], 'earn:halo:2': want['earn:halo:2'] };
    if (k === 'cem') return;
    if (J(fast[k]) !== J(want) && !(k === 'lookCopies' && fast[k] && J(Object.keys(fast[k]).sort()) === J(Object.keys(want).sort()))) bad.push(k);
  });
  ok(!bad.length, 'every carried table arrives on the fast world unchanged' + (bad.length ? ': ' + bad.join(', ') : ''));
  ok(fast.questFeed === undefined && fast.lookOwners === undefined, 'skipped tables stay off the fast world');
  ok(fast.cem && fast.cem.mg && fast.cem.mg.unleash.length === 1 && !fast.cem._slim, 'the Pantheon table is on every fast page (no zombies.json needed), so V2MgRoad.mgReady is true');
  ok(fast.cem.grudges['3:30'] && fast.cem.huntDay[ALICE] && fast.cem.raisedBy[ALICE] === 2, 'hunt grudges, daily hunt marks and raisers reach the fast world');
  ok(Object.keys(fast.cem.altars).join() === '30' && fast.cem.altarList.length === 1 && fast.cem.hunts.length === 1, 'only open altars and the last week of hunts ride along');
  const opened = S.openOwnerPets(clone(page), ALICE), withGear = S.assemble(summary, { owners: { [ALICE]: opened.pets }, owner: ALICE }), g1 = withGear.items.g1;
  ok(g1 && g1.src === 'roll' && g1.rolledOn === 2 && g1.wheel === true && g1.on === 2, 'worn gear keeps where it came from (pet score, token drops)');
  const again = S.assemble(summary, { owners: owners });
  again.spins[ALICE].used = 99; again.cem.mg.unleash.push({});
  const third = S.assemble(summary, { owners: owners });
  ok(third.spins[ALICE].used === 3 && third.cem.mg.unleash.length === 1, 'each assembled world gets its own copy (the rules write to some tables)');

  /* ---- 4. the same answers as a replayed world */
  const f2 = S.assemble(summary, { owners: owners, mythicOwners: { [ALICE]: page.mythicAt } });
  const same = (label, fn) => { let a, b; try { a = J(fn(full)); } catch (e) { a = 'throw ' + e.message; } try { b = J(fn(f2)); } catch (e) { b = 'throw ' + e.message; } ok(a === b, label + (a === b ? '' : ': full ' + String(a).slice(0, 90) + ' | fast ' + String(b).slice(0, 90))); };
  same('saved spins (spinsLeft)', w => [V.spinsLeft(w, ALICE, B, []), V.spinsLeft(w, BOB, B, [])]);
  ok(V.spinsLeft(f2, ALICE, B, []) >= 9, 'saved spins on the fast world count earned - used + Fire Sale spins (' + V.spinsLeft(f2, ALICE, B, []) + ')');
  same('player numbers for gifts (playerNo / playerAddr)', w => [V.playerNo(w, ALICE), V.playerNo(w, BOB), V.playerAddr(w, 2)]);
  same('gift inbox (giftsTo)', w => V.giftsTo(w, ALICE));
  same('flame tier + flame looks (burn totals)', w => [V.flameTierOf(w, BOB), V.flameLooksOf(w, ALICE)]);
  same('Proof of Burn ash on a pet', w => V.pobOf(w, w.byId[20]));
  same('Mythic discount line (petThresholds) for a pet of another wallet', w => V.petThresholds(w, w.byId[21], B));
  same('raised-or-bought Mythic (raisedBy)', w => [V.raisedBy(w, w.byId[1]), V.raisedBy(w, w.byId[20])]);
  same('hunt price with a grudge (huntQuote)', w => V.huntQuote(w, 3, 30, B));
  same('Burn Lords ranking', w => V.burnLordsRank(w));
  same('owned looks (Looks picker)', w => V.ownedLooks(w, ALICE).map(L => L.code + ':' + L.on.join('.')));
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
