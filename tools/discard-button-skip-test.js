#!/usr/bin/env node
/* DISCARD BUTTONS SKIP PETS ALREADY DISCARDED (Nov 26 2026, Jake: "the button should have known I had burned for some of the discards").
 * He picked 2,002 pets, 2,000 were already discarded on chain: every screen let him pick them, the sheet dropped them only at the end, offered
 * 2 tiny burns and a heading that said "does not fit in one 34-byte burn" twice plus a list of left-out pets.
 * Every discard button (My Pets, hatch / box review, "Make my browser discards permanent", Clear the pile) ends in js/v2.js chainDiscardIds,
 * so this runs that real function (and the bar's count) with stubs:
 *  1. pets discarded on chain or named by a discard burn still confirming are not counted and not sent to the planner;
 *  2. all of them already discarded = no sheet, one plain line;
 *  3. the heading says it once: N pets, B burns, left out by reason (no repeat, no per-pet list);
 *  4. the "Make my browser discards permanent (N)" count is browser-only pets;
 *  5. while a discard burn is still confirming no new discard sheet opens (XCP Wallet blocks a burn on its unconfirmed change: 'Couldn't verify
 *     asset status'), and the bell's Continue rebuilds a saved discard run from its pets instead of re-sending the saved tag;
 *  6. the zombie card names pets discarded only in this browser (a zombie eats only on-chain discards) and offers Make permanent;
 *  7. adding back 50+ pets (G Money signed pet:hu:ALL for 15,971) asks once, with the count, before the sheet.
 *  5. while a discard burn is still confirming no new discard sheet opens (XCP Wallet blocks a burn on its unconfirmed change: 'Couldn't verify
 *     asset status'), and the bell's Continue rebuilds a saved discard run from its pets instead of re-sending the saved tag;
 *  6. the zombie card names pets discarded only in this browser (a zombie eats only on-chain discards) and offers Make permanent;
 *  7. adding back 50+ pets (G Money signed pet:hu:ALL for 15,971) asks once, with the count, before the sheet.
 *   node tools/discard-button-skip-test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const REPO = path.resolve(__dirname, '..'), src = fs.readFileSync(path.join(REPO, 'js', 'v2.js'), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('ok   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const fn = name => { const i = src.indexOf('  function ' + name + '('); if (i < 0) throw new Error('no ' + name); let d = 0, j = src.indexOf('{', i);
  for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) break; } return src.slice(i, j + 1); };
const st = {}, ls = { getItem: k => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); }, removeItem: k => { delete st[k]; } };
const own = vm.createContext({ console, localStorage: ls }); own.window = own; own.self = own;
vm.runInContext(fs.readFileSync(path.join(REPO, 'js', 'v2-own.js'), 'utf8'), own);
const ME = 'me', N = 2002, pets = [];
for (let i = 1; i <= N; i++) pets.push({ id: i, owner: ME, hd: i <= 2000 ? ME : undefined });
pets.push({ id: 3001, owner: ME }); /* named by a discard burn still confirming */
const w = { pets, byId: {}, tip: 977600 }; pets.forEach(p => { w.byId[p.id] = p; });
st['xcpets-hidden-mainnet-' + ME] = JSON.stringify(pets.map(p => p.id));
own.V2UI = { pendingFeedIds: () => ({ hd: { 3001: 1 } }) };
let asked = null, sheet = null, toasts = [], pendTags = [], saved = null;
const V = { hdOn: () => true, ACTIVATE_ONCHAIN_DISCARD_BLOCK: 1, hdPlan: (w, me, ids) => { asked = ids.slice();
  const left = ids.filter(id => w.byId[id].hd === me).map(id => ({ id, why: 'already discarded on chain' })), go = ids.filter(id => w.byId[id].hd !== me);
  return { ok: !!go.length, one: false, plans: [{ tag: 'pet:hd:A', amount: 1e-8, petIds: go.slice(0, 1) }, { tag: 'pet:hd:B', amount: 1e-8, petIds: go.slice(1) }], left,
    why: 'This selection does not fit in one 34-byte burn. These 2 burns are exact.' }; } };
const ctx = vm.createContext({ console, ME, V, V2Own: own.V2Own, S: { tip: 977600 }, world: () => w, fmt: n => Number(n).toLocaleString('en-US'),
  hdSettleThen: () => false, myPendingTags: () => pendTags, loadResume: () => saved, saveResume: (t, r) => { saved = r && r.length ? { title: t, plans: r } : null; }, toast: m => toasts.push(m), confirmPlans: (t, plans) => { sheet = { t, plans }; }, noteHuSent() {}, window: {},
  hiddenIds: () => JSON.parse(st['xcpets-hidden-mainnet-' + ME]), isKept: () => false, onChainDiscarded: p => own.V2Own.onChain(p, ME),
  document: { createElement: () => ({ querySelector: () => null, set innerHTML(h) { ctx.__html = h; } }) } });
vm.runInContext(['hdConfirming', 'hdWaitNote', 'chainDiscardIds', 'chainDiscardBar', 'resumeGo', 'zBrowserOnly', 'zPermHtml'].map(fn).join('\n') + '\nthis.cd = chainDiscardIds; this.bar = chainDiscardBar; this.resumeGo = resumeGo; this.zbo = zBrowserOnly; this.zperm = zPermHtml;', ctx);

/* 1 + 3: Jake's selection: 2,000 on chain + 2 browser-only + 1 confirming */
ctx.cd(pets.map(p => p.id), false);
ok(asked && asked.length === 2 && asked.every(id => id > 2000 && id < 3001), 'only the 2 pets not yet discarded reach the planner (' + (asked || []).length + ')');
ok(sheet && /^Discard 2 pets permanently/.test(sheet.t), 'heading counts the pets that move: "' + (sheet && sheet.t) + '"');
ok(sheet && (sheet.t.match(/one burn|34-byte/g) || []).length <= 1, 'heading says "does not fit" once');
ok(sheet && /left out: 2,000 already discarded on chain, 1 discard burn still confirming/.test(sheet.t), 'heading counts what was left out, by reason');
ok(sheet && !/#\d/.test(sheet.t), 'heading has no per-pet list');
/* 2: all already discarded */
asked = null; sheet = null; toasts = [];
ctx.cd(pets.slice(0, 2000).map(p => p.id), false);
ok(!asked && !sheet && toasts.length === 1 && /already discarded on chain/.test(toasts[0]), 'all already discarded: no sheet, one line (' + toasts[0] + ')');
ctx.cd([3001], false);
ok(!sheet && /still confirming/.test(toasts[1] || ''), 'only confirming: no sheet (' + toasts[1] + ')');
/* 4: the bar's count */
ctx.bar(w);
const m = /Make my browser discards permanent \((\d[\d,]*)\)/.exec(ctx.__html || '');
ok(m && m[1] === '2', 'bar offers the 2 browser-only pets, not ' + N + ' (' + (m && m[1]) + ')');
/* 6 (G Money, Nov 26 2026): the zombie card's empty list says which pets are discarded only in this browser and offers the burn */
const bo = ctx.zbo(w), zh = ctx.zperm(w);
ok(bo.join() === '2001,2002', 'zombie card: browser-only pets = the 2 never burned (not the 2,000 on chain, not the 1 confirming): ' + bo.join());
ok(/2 pets are in your Discard pile only in this browser/.test(zh) && /zb-mkperm/.test(zh), 'zombie card says so and has the Make permanent button');
ok(fs.readFileSync(path.join(REPO, 'js', 'v2.js'), 'utf8').indexOf("closest('.zb-mkperm')") > 0, 'the button is wired to the discard path');
/* 7 (G Money's pet:hu:ALL): adding back 50+ pets asks once with the count; Cancel opens no sheet */
let asks = [], answer = false; ctx.window.confirm = m => { asks.push(m); return answer; };
const V0 = V.hdPlan; V.hdPlan = (w, me, ids, b, o) => ({ ok: true, one: true, plans: [{ tag: 'pet:hu:ALL', amount: 1e-8, petIds: ids.slice() }], left: [] });
pendTags = []; sheet = null; ctx.cd(pets.slice(0, 2000).map(p => p.id), true);
ok(asks.length === 1 && /Add back 2,000 pets\?/.test(asks[0]) && /undoes 2,000 permanent discards/.test(asks[0]) && !sheet, 'add back 2,000: asks once with the count, Cancel = no sheet');
answer = true; asks = []; ctx.cd(pets.slice(0, 2000).map(p => p.id), true);
ok(asks.length === 1 && sheet && /^Add 2,000 pets back/.test(sheet.t), 'add back 2,000 after Yes: the sheet opens');
asks = []; sheet = null; ctx.cd([1, 2, 3], true);
ok(!asks.length && sheet, 'add back 3 pets: no extra question');
V.hdPlan = V0; delete ctx.window.confirm;
/* 5: a discard burn still confirming */
pendTags = ['pet:hd:M5:OOENA1HTB1KB1IA1H31IOF']; asked = null; sheet = null; toasts = [];
ctx.cd([2001, 2002], false);
ok(!asked && !sheet && /still confirming/.test(toasts[0] || ''), 'a discard burn still confirming: no new discard sheet, one line to wait');
saved = { title: 'Discard 2 pets', plans: [{ tag: 'pet:hd:M5:UG0IG71L31HJ61O81T01HL9', amount: 1e-8, petIds: [2002] }] }; toasts = [];
ctx.resumeGo();
ok(!asked && !sheet && saved && /still confirming/.test(toasts[0] || ''), 'bell Continue while confirming: waits and keeps the saved run');
pendTags = []; toasts = [];
ctx.resumeGo();
ok(asked && asked.join() === '2002' && !saved && sheet && sheet.plans.every(q => q.tag !== 'pet:hd:M5:UG0IG71L31HJ61O81T01HL9'), 'bell Continue after it confirms: rebuilt from its pets, the saved tag is not re-sent');
saved = { title: 'Discard', plans: [{ tag: 'pet:hd:M5:X', amount: 1e-8, petIds: [5] }] }; asked = null; sheet = null; toasts = [];
ctx.resumeGo();
ok(!asked && !sheet && !saved && /already discarded/.test(toasts[0] || ''), 'bell Continue for pets already discarded: nothing offered (' + toasts[0] + ')');
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
