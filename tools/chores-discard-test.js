#!/usr/bin/env node
/* chores-skip-discards-1103 (owner Nov 3 2026 [pt2751u] "daily chores is useless because it feeds discards"): UI only.
 * Daily chores (js/v2-chores.js plan()) must never put a discarded pet (V2UI.hiddenIds, browser-only) in its burns, and the sheet must count
 * the pets it will really feed. Checks, on the live world api/boot.json with the chores gate on at tip + 1 (test only):
 *  1. before the fix the rules planner alone (no ids) feeds the discarded pets (the bug this fixes);
 *  2. V2Chores.plan() leaves every discarded pet out of every burn (petIds and the places the pet:dc / pet:fr runs really point at);
 *  3. replaying the planned burns feeds exactly the not-discarded hungry eaters and none of the discarded ones;
 *  4. P.feedTotal = pets really fed, P.discardedSkipped = discarded eaters left out; nothing discarded -> same plan as the rules planner.
 * node tools/chores-discard-test.js [--boot FILE] */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), vm = require('vm');
const { load, ROOT } = require('./lib/load-rules');
const A = process.argv.slice(2), opt = k => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : null; };
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const hex = s => Buffer.from(s, 'utf8').toString('hex');
const ctx = load(), V = ctx.V2Rules, E = ctx.LiveEngine;
ctx.setInterval = () => 0; vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'v2-chores.js'), 'utf8'), ctx, { filename: 'js/v2-chores.js' });
const C = ctx.V2Chores; ok(!!(C && C.plan), 'js/v2-chores.js loads (V2Chores.plan)');
const boot = JSON.parse(fs.readFileSync(path.resolve(opt('--boot') || path.join(ROOT, 'api', 'boot.json')), 'utf8'));
const rows = boot.rows.slice().sort((a, b) => a.block_index - b.block_index || a.tx_index - b.tx_index), tip = boot.tip || rows[rows.length - 1].block_index, nb = tip + 1;
const hashes = Object.assign({}, ctx.XCPETS_BLOCK_HASHES || {}, boot.hashes || {}); [nb, nb + 1].forEach(b => { if (!hashes[b]) hashes[b] = crypto.createHash('sha256').update('fake-block-' + b).digest('hex'); });
const opts = t => ({ tip: t, live: E && E.RealCore, dex: boot.dex }); let txi = rows[rows.length - 1].tx_index + 1;
const mk = (b, src, amt, tag) => ({ tx_index: txi++, tx_hash: crypto.createHash('sha256').update('dcd-test:' + tag + ':' + b + ':' + txi).digest('hex'), block_index: b, source: src, asset: 'XCPETS', quantity: Math.round(amt * 1e8), tag: hex(tag), status: 'valid' });
const G = V.dailyChoresGate(); V._setDailyChoresActivation(nb);
const w = V.replay(rows, hashes, [], opts(tip)), eaters = {};
w.pets.forEach(p => { if (!p.community && !p.dead && !p.released && p.owner && V.frEats(p, nb)) (eaters[p.owner] = eaters[p.owner] || []).push(p); });
const cand = Object.keys(eaters).map(o => ({ o, n: eaters[o].length })).filter(x => x.n >= 6 && x.n <= 600).sort((a, b) => b.n - a.n);
ok(cand.length > 0, 'a wallet with 6-600 hungry eaters at tip ' + tip + ' (' + cand.length + ' found)');
const who = cand[0].o, mine = eaters[who].slice().sort((a, b) => a.id - b.id);
let hidden = mine.filter((p, i) => i % 3 === 1).map(p => p.id); /* every third pet discarded: forces 0 places inside the runs */
ctx.V2UI = { world: () => w, ME: who, S: () => ({ tip }), hiddenIds: () => hidden.slice() };
console.log('  test wallet ' + who.slice(0, 10) + '…: ' + mine.length + ' hungry eaters, ' + hidden.length + ' discarded in this browser');
const ids = P => P.plans.reduce((a, q) => a.concat(q.petIds || (q.petId != null ? [q.petId] : [])), []);
const runsIds = P => P.plans.reduce((a, q) => { const t = V.parseTag(q.tag); if (t && t.runs) return a.concat(V.feedRunsIds(w, who, { action: 'feedr', a: t.a, runs: t.runs }, nb)); return a; }, []);
/* 1. the bug */
const raw = V.dailyChoresPlan(w, who, nb), H = new Set(hidden);
ok(!!raw && ids(raw).some(id => H.has(id)), 'before the fix: the planner with no ids feeds ' + (raw ? ids(raw).filter(id => H.has(id)).length : 0) + ' discarded pets (the bug)');
/* 2. the fix */
const P = C.plan(); ok(!!P && /^pet:dc:[0-3]/.test(P.plans[0].tag), 'plan: first burn is pet:dc [' + (P && P.plans.map(q => q.tag + ' @ ' + q.amount).join(' | ')) + ']');
ok(P && !ids(P).some(id => H.has(id)), 'plan: no discarded pet in any burn\u2019s petIds');
ok(P && !runsIds(P).some(id => H.has(id)), 'plan: no discarded pet at the places the runs point at (' + (P ? runsIds(P).length : 0) + ' places decoded)');
ok(P && P.plans.every(q => Buffer.byteLength(q.tag) <= 34), 'plan: every tag fits 34 bytes');
/* 3. replay the burns */
if (P) { const all = P.plans.map(q => mk(nb, who, q.amount, q.tag)), w2 = V.replay(rows.concat(all), hashes, [], opts(nb + 1));
  const fed = w2.pets.filter(p => p.lastFed === nb && p.owner === who).map(p => p.id), want = mine.filter(p => !H.has(p.id)).map(p => p.id);
  ok(!fed.some(id => H.has(id)), 'engine: none of the ' + hidden.length + ' discarded pets ate');
  ok(fed.length === want.length && want.every(id => fed.indexOf(id) >= 0), 'engine: fed exactly the ' + want.length + ' not-discarded hungry eaters (fed ' + fed.length + ')');
  /* 4. counts in the sheet */
  ok(P.feedTotal === fed.length, 'sheet count: feedTotal ' + P.feedTotal + ' = pets really fed ' + fed.length);
  ok(P.discardedSkipped === hidden.length, 'sheet count: ' + P.discardedSkipped + ' discarded pets left out');
  const html = C.sheetTitle(P); ok(html.indexOf('feed ' + P.feedTotal.toLocaleString('en-US') + ' pet') >= 0 && /discarded pets? left out/.test(html), 'sheet title: "' + html + '"'); }
/* everything discarded: no feed part, WAGMI/spins only (or nothing) */
hidden = mine.map(p => p.id); const P2 = C.plan(); ok(!P2 || !ids(P2).some(id => mine.some(p => p.id === id)), 'all discarded: no pet of this wallet is fed' + (P2 ? ' [' + P2.plans.map(q => q.tag).join(' | ') + ']' : ' (nothing to do)'));
/* nothing discarded: same burns as the rules planner */
hidden = []; const P3 = C.plan(); ok(!!P3 && JSON.stringify(P3.plans.map(q => [q.tag, q.amount])) === JSON.stringify(raw.plans.map(q => [q.tag, q.amount])), 'nothing discarded: same burns as V2Rules.dailyChoresPlan');
V._setDailyChoresActivation(G);
console.log('\n' + (fails ? fails + ' FAILED' : 'all ok')); process.exitCode = fails ? 1 : 0;
