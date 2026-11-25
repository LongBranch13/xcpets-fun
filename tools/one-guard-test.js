#!/usr/bin/env node
/* One safety check for every pet-removing button (Nov 24 2026, root cause #4): js/v2-sac-guard.js holds the rules, every path calls it.
 *   node tools/one-guard-test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..'), rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let fails = 0, n = 0; const ok = (c, m) => { n++; console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const ME = 'bc1qme', starred = [3];
const ctx = vm.createContext({ console, JSON, Array, Number, String, Object });
ctx.window = ctx; ctx.V2UI = { isKept: id => starred.indexOf(+id) >= 0 }; ctx.document = { getElementById: () => null };
vm.runInContext(rd('js/v2-sac-guard.js'), ctx);
const G = ctx.V2SacGuard;
const pets = [{ id: 1, owner: ME }, { id: 2, owner: ME, zombie: { gen: 1 } }, { id: 3, owner: ME }, { id: 4, owner: ME, zombie: { gen: 1, end: { kind: 'resurrected' } } }, { id: 5, owner: ME, tier: 3 }];
const w = { tip: 1000, pets, byId: Object.fromEntries(pets.map(p => [p.id, p])) };
ok(G.never('discard', w, w.byId[1], ME) === null, 'an ordinary pet can be discarded');
ok(G.never('discard', w, w.byId[2], ME) === 'zombie', 'a risen zombie is never discarded');
ok(G.never('discard', w, w.byId[3], ME) === 'starred', 'a starred pet is never discarded');
ok(G.never('discard', w, w.byId[4], ME) === null, 'a pet whose zombie life ended (resurrected) is a normal pet again');
const sp = G.split('discard', w, [1, 2, 3, 4, 5], ME);
ok(JSON.stringify(sp.go) === '[1,4,5]' && JSON.stringify(sp.no.zombie) === '[2]' && JSON.stringify(sp.no.starred) === '[3]', 'split: go 1,4,5 · zombie 2 · starred 3');
ok(G.never('grind', w, w.byId[1], ME) === null && G.never('sacrifice', w, w.byId[5], ME) === null, 'actions without a hard no fall through to the rules engine');
let went = null; G.check({ w, ids: [1, 4], me: ME, onGo: ids => { went = ids; } });
ok(JSON.stringify(went) === '[1,4]', 'check: nothing special = goes on at once with every pet');
ok(G.flags(w, w.byId[5], ME).some(f => f.k === 'leg') && G.flags(w, w.byId[3], ME).some(f => f.k === 'star'), 'flags: Legendary and starred are special');

/* big wallets (Nov 25 2026): the star list is read once per split/check, and the sheet draws at most 40 rows */
let kc = 0; ctx.V2UI = { isKept: id => starred.indexOf(+id) >= 0, keptIds: () => { kc++; return starred.slice(); } };
const many = []; for (let i = 0; i < 2000; i++) many.push(i % 2 ? 1 : 3);
const spBig = G.split('discard', w, many, ME);
ok(kc === 1 && spBig.no.starred.length === 1000 && spBig.go.length === 1000, 'split over 2,000 pets reads the star list once (' + kc + ')');
ctx.V2UI = { isKept: id => starred.indexOf(+id) >= 0 };
ok(/bad\.slice\(0, SHOW\)\.map/.test(rd('js/v2-sac-guard.js')) && /var SHOW = 40;/.test(rd('js/v2-sac-guard.js')), 'the sheet draws at most 40 special pets, then a count');
/* wiring: every pet-removing path goes through the guard */
const v2 = rd('js/v2.js'), gr = rd('js/v2-grinder.js'), sg = rd('js/v2-sac-guard.js');
const dI = v2.slice(v2.indexOf('function discardIds('), v2.indexOf('function hiddenSet('));
ok(/V2SacGuard\.split\('discard', wz, ids, ME\)/.test(dI) && !/kset|ZB\(dp\)/.test(dI), 'browser discard (every discard button) asks the guard; no rule of its own');
const cD = v2.slice(v2.indexOf('function chainDiscardIds('), v2.indexOf('function chainDiscardBar('));
ok(/!restore && !chainDiscardIds\._ok && window\.V2SacGuard\) return V2SacGuard\.check\(/.test(cD) && cD.indexOf('V2SacGuard.check') < cD.indexOf('V.hdPlan(w, ME, ids'), 'permanent discard shows the special-pet sheet before the burn is built');
ok(cD.indexOf('hdSettleThen(ids, restore)') < cD.indexOf('V2SacGuard.check'), 'the sheet comes after the pet list is complete (no second sheet)');
ok(/V2SacGuard\.check\(\{ w: w, ids: gx, me: a, verb: 'grind them', all: true/.test(gr), 'the Meat Grinder shows the sheet (all-or-nothing: it takes every discarded pet)');
ok(/\(ok\.length && !o\.all \? '<button type="button" class="sg-ok"/.test(sg), 'all-or-nothing mode has no "leave them out" button');
ok(/z-index:10100/.test(sg) && /\.mgr-bg\{position:fixed;inset:0;z-index:10050/.test(gr), 'the sheet sits above the Grinder');
const sacCallers = ['js/v2.js', 'js/v2-cem-sacrifice.js', 'js/v2-cemetery-altar.js', 'js/v2-cemetery-scene.js'].filter(f => /V2SacGuard\.check\(/.test(rd(f)));
ok(sacCallers.length === 4, 'zombie meals, pledges, halo points and altar offerings still use the guard (' + sacCallers.length + '/4)');
const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).concat(['templates/game.html']);
const bad = pages.filter(f => { const s = rd(f).replace(/<link rel="prefetch"[^>]*>/g, ''), a = s.indexOf('js/v2.js?'); if (a < 0) return false; const g = s.indexOf('js/v2-sac-guard.js'); return g < 0 || g > a; });
ok(!bad.length, 'every page with v2.js loads the guard before it' + (bad.length ? ' (' + bad.join(', ') + ')' : ''));
console.log(`one-guard: ${n - fails} passed, ${fails} failed`); process.exit(fails ? 1 : 0);
