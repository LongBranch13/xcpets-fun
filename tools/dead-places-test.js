#!/usr/bin/env node
/* Dead pets leave the pick lists (rules, ACTIVATE_DEAD_PLACES_BLOCK) + the before-signing "picked pets = named pets" check (sendBlock).
 * Nov 25 2026, G Money: "missing like 60 pets". The discard list (hdPlaceList) kept G Money's dead Mythic Sabo #1765 (a grave since
 * 975,488) because frDeadAt never calls a Mythic dead, while the page, which plans a discard without loading graves, had no place for it.
 * His 12 discard burns at 977,453-977,472 each moved down one place: 68 kept pets (46 Mythics) were discarded, 68 hatchlings were not.
 * Checks, on the real chain (api/boot.json):
 *  1. live gate is after the replayed chain (replay unchanged: tools/rebuild-bench.js --compare origin/main prints SAME);
 *  2. gate off: those 12 burns name other pets than a list without the dead pet (68 wrong pets), #1765 holds a place;
 *  3. gate on: the same 12 burns name exactly the pets the page's list names;
 *  4. a discard planned on a page world without graves: gate off -> sendBlock refuses it (both petIds and the server's want text);
 *     gate on -> sendBlock lets it through; a plan with the wrong want is refused;
 *  5. gate on: every wallet's discard / spin list holds no dead pet.
 *   node --max-old-space-size=9000 tools/dead-places-test.js [--boot FILE] */
'use strict';
const fs = require('fs'), path = require('path');
const { load, ROOT } = require('./lib/load-rules');
const A = process.argv.slice(2), opt = k => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : null; };
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const boot = JSON.parse(fs.readFileSync(path.resolve(opt('--boot') || path.join(ROOT, 'api', 'boot.json')), 'utf8'));
const GM = 'bc1qtke38j72qv4d8eljn7pccaykypw8luytfwdn7q', TIP = 977472;
const rows = boot.rows.filter(r => r.block_index <= TIP).sort((a, b) => a.block_index - b.block_index || a.tx_index - b.tx_index);
if (!rows.some(r => r.block_index === 977472 && r.source === GM)) { console.log('skip: api/boot.json does not reach block 977,472'); process.exit(0); }
const c = load(), V = c.V2Rules;
ok(typeof V.ACTIVATE_DEAD_PLACES_BLOCK === 'number' && V.ACTIVATE_DEAD_PLACES_BLOCK > TIP, 'live gate ' + V.ACTIVATE_DEAD_PLACES_BLOCK + ' is after the replayed burns (' + TIP + '; once the feed passes it the replay is the gate-on one, tools/rebuild-bench.js checked SAME when it shipped)');
const LIVE = V.ACTIVATE_DEAD_PLACES_BLOCK;
const w = V.replay(rows, Object.assign({}, c.XCPETS_BLOCK_HASHES || {}, boot.hashes || {}), [], { tip: TIP, live: c.LiveEngine && c.LiveEngine.RealCore, dex: boot.dex });
const hd = rows.filter(r => r.source === GM && r.block_index >= 977453).map(r => ({ b: r.block_index, t: V.parseTag(Buffer.from(r.tag, 'hex').toString()) })).filter(x => x.t && x.t.action === 'hd');
ok(hd.length === 12, '12 discard burns by G Money at 977,453-977,472 (' + hd.length + ')');
const runIds = (list, runs) => { const o = []; let pos = 0; runs.forEach((n, q) => { if (q % 2 === 0) { pos += n; return; } for (let j = 0; j < n && pos < list.length; j++) o.push(list[pos++].id); }); return o; };
const pageList = (b, x) => { const a = V.frAnchor(b, x.t.a); return V.hdPlaceList(w, GM, a, b).filter(p => p.id !== 1765); }; /* the page has no graves: Sabo, dead since 975,488 */
function wrong() { let n = 0; hd.forEach(x => { const page = new Set(runIds(pageList(x.b, x), x.t.runs)); n += V.hdIdsOf(w, GM, x.t, x.b).filter(id => !page.has(id)).length; }); return n; }
V._setDeadPlacesActivation(null);
ok(V.hdPlaceList(w, GM, 977465, 977469).some(p => p.id === 1765), 'gate off: dead Mythic #1765 holds a place in the discard list');
const wOff = wrong(); ok(wOff === 68, 'gate off: the 12 burns named ' + wOff + ' pets the page did not pick (68 expected)');
V._setDeadPlacesActivation(977440);
const wOn = wrong(); ok(wOn === 0, 'gate on: the 12 burns name exactly the page\'s picks (' + wOn + ' differ)');
/* a discard planned the way a fast page plans it: on a world with no graves */
const page = Object.assign({}, w, { pets: w.pets.filter(p => !p.dead || (p.zombie && !p.zombie.end)), tip: TIP });
const keep = w.pets.filter(p => p.owner === GM && !p.dead && !p.hd && !p.released && !(p.zombie) && p.id > 1765).slice(0, 12).map(p => p.id);
function plan() { const r = V.hdPlan(page, GM, keep, TIP + 1); return r && r.ok ? r.plans[0] : null; }
V._setDeadPlacesActivation(null);
let pl = plan(); ok(!!pl, 'page plan: ' + (pl && pl.tag));
const why = pl && V.sendBlock(w, pl, TIP, { me: GM });
ok(!!why && /different pets/.test(why), 'gate off: sendBlock refuses the shifted discard (' + why + ')');
const why2 = pl && V.sendBlock(w, { tag: pl.tag, amount: pl.amount, want: V.pickWant(pl.petIds) }, TIP, { me: GM });
ok(!!why2 && /different pets/.test(why2), 'gate off: the server check (want text only) refuses it too');
V._setDeadPlacesActivation(977440);
pl = plan();
ok(pl && V.sendBlock(w, pl, TIP, { me: GM }) === null, 'gate on: the same discard passes the check');
ok(pl && V.sendBlock(w, { tag: pl.tag, amount: pl.amount, want: V.pickWant(pl.petIds) }, TIP, { me: GM }) === null, 'gate on: the server check (want text) passes');
ok(pl && /different pets/.test(V.sendBlock(w, { tag: pl.tag, amount: pl.amount, want: V.pickWant(keep.slice(1)) }, TIP, { me: GM }) || ''), 'a want for other pets is refused');
ok(V.sendBlock(w, { tag: pl.tag, amount: pl.amount }, TIP, { me: GM }) === null, 'a plan without picks is judged as before');
const owners = [...new Set(w.pets.map(p => p.owner).filter(Boolean))];
let deadIn = 0, deadOff = 0; owners.forEach(o => { deadIn += V.hdPlaceList(w, o, TIP, TIP + 1).filter(p => p.dead).length + (V.spinList ? V.spinList(w, o, TIP, TIP + 1).filter(p => p.dead).length : 0); });
ok(deadIn === 0, 'gate on: no dead pet in any wallet\'s discard or spin list at the tip (' + deadIn + ')');
V._setDeadPlacesActivation(null); owners.forEach(o => { deadOff += V.hdPlaceList(w, o, TIP, TIP + 1).filter(p => p.dead).length; });
ok(deadOff > 0, 'gate off: ' + deadOff + ' dead pet(s) held a discard-list place');
V._setDeadPlacesActivation(LIVE);
console.log(fails ? fails + ' failed' : 'all passed'); process.exit(fails ? 1 : 0);
