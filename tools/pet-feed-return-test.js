#!/usr/bin/env node
/* pet-feed-return tests (Nov 2 2026, owner 7:10 PM CT, UI only): a feed started on pet.html must come back to that pet page.
 *   (1) pet page Feed links (petActs, starve CTA, intuitive action row) go to play.html#act-feed-ID-pet,
 *   (2) js/v2.js actRoute: sent -> pet.html?id=ID&fed=<block>, cancelled -> pet.html?id=ID, not hungry -> back after the toast,
 *   (3) feeds from other places (play.html#act-feed-ID without -pet, rolls) still stay on Play with the old back link toast,
 *   (4) the pet page shows '⏳ Feed sent' (no second Feed link) until the burn confirms, then the fed note.   node tools/pet-feed-return-test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const REPO = path.resolve(__dirname, '..'), rd = f => fs.readFileSync(path.join(REPO, f), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const slice = (src, a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); if (i < 0 || j < 0) throw new Error('block not found: ' + a); return src.slice(i, j); };

// ---- (1) links on the pet page
const pages = rd('js/v2-pages.js'), render = rd('js/v2-render.js'), intu = rd('js/v2-intuitive.js');
ok(/href="play\.html#act-feed-' \+ p\.id \+ '-pet"/.test(pages), 'petActs Feed button links to play.html#act-feed-ID-pet');
ok(/feedActHref: 'play\.html#act-feed-' \+ p\.id \+ '-pet'/.test(pages), 'starve warning CTA gets the feed-and-return link');
ok(/esc\(o\.feedActHref \|\| o\.feedHref\)/.test(render), 'starveHtml uses feedActHref for the Feed CTA');
ok(/'act-feed-' \+ id \+ '-pet'/.test(intu), 'intuitive pet action row Feed goes to the feed-and-return link');
ok(/data-sgrave="[^]*esc\(o\.feedHref\)/.test(render) && !/data-sgrave[^\n]*feedActHref/.test(render), 'grave-gear link still uses the plain Play link (never a feed)');

// ---- (2)(3) actRoute / actBack from js/v2.js
const v2 = rd('js/v2.js');
const block = slice(v2, '  function petBackGo(id, tip)', '\n  /* pet-gift') + slice(v2, '  function actRoute() {', '\n  function detail(p, w)');
function run(hash, pet, opts) {
  opts = opts || {}; const timers = [], toasts = [], confirms = [], obs = [];
  const cb = { cls: new Set(['on']), classList: { contains: c => cb.cls.has(c) } };
  const loc = { hash, pathname: '/play.html', search: '', href: 'https://xcpets.fun/play.html' + hash };
  const ctx = vm.createContext({ location: loc, history: { replaceState: () => { loc.hash = ''; } },
    setTimeout: (f, ms) => timers.push({ f, ms }), MutationObserver: function (f) { this.observe = () => obs.push(f); this.disconnect = () => {}; },
    __t: h => toasts.push(String(h)), __c: (t, pl, after) => confirms.push({ t, pl, after }) });
  vm.runInContext('var ME = "bc1qme", S = { rows: [1], tip: 100 }, V = { freeRollPlan: id => ({ tag: "pet:fr:" + id }), overflowRollPlan: id => ({ tag: "pet:of:" + id }), rollQueue: () => [{ tag: "pet:roll" }] };' +
    'var W = { byId: {} }; function world() { return W; } function cemRoute() { return false; } function giftRoute() { return false; } function toast(h) { __t(h); } function esc(s) { return String(s); }' +
    'function ZB() { return false; } function feedQ(w, me, ids) { return [{ tag: "pet:feed:" + ids[0] }]; } function confirmPlans(t, pl, after) { __c(t, pl, after); }' +
    'var BODY = { insertAdjacentHTML: function (w, h) { BODY.h = h; } }; function $(id) { return id === "confirmBox" ? __cb : id === "cfBody" ? BODY : null; }\n' + block + '\nthis.T = { actRoute: actRoute, W: W, BODY: BODY };', Object.assign(ctx, { __cb: cb }));
  ctx.T.W.byId[pet.id] = pet; const r = ctx.T.actRoute();
  const flush = (max) => { let n = 0; while (timers.length && n++ < 20) { const t = timers.shift(); if (max != null && t.ms > max) { timers.unshift(t); break; } t.f(); } };
  flush(100); // actBack's 50 ms sheet hook
  return { r, loc, toasts, confirms, obs, body: ctx.T.BODY, close() { cb.cls.delete('on'); }, flush, timers };
}
const pet = (o) => Object.assign({ id: 74349, name: 'Kek', owner: 'bc1qme', hungry: true, nextMeal: 0.5 }, o || {});
// sent from the pet page
let x = run('#act-feed-74349-pet', pet());
ok(x.r === true && x.confirms.length === 1 && x.confirms[0].t === 'Feed #74349' && typeof x.confirms[0].after === 'function', 'pet-page feed opens the confirm with a return step');
ok(/you return there after the feed/.test(x.body.h || ''), 'confirm sheet says it returns to the pet page');
x.close(); x.confirms[0].after(); x.obs.forEach(f => f());
ok(x.loc.href === 'pet.html?id=74349&fed=101', 'sent feed returns to pet.html?id=74349&fed=101 (got ' + x.loc.href + ')');
ok(!x.toasts.length, 'no stray Play toast after the return');
// cancelled from the pet page
x = run('#act-feed-74349-pet', pet()); x.close(); x.obs.forEach(f => f());
ok(x.loc.href === 'pet.html?id=74349', 'cancelled pet-page feed returns to pet.html?id=74349 (got ' + x.loc.href + ')');
// not hungry from the pet page: toast, then back
x = run('#act-feed-74349-pet', pet({ hungry: false }));
ok(x.confirms.length === 0 && /not hungry/.test(x.toasts.join(' ')), 'not-hungry pet: toast, no confirm');
x.flush(); ok(x.loc.href === 'pet.html?id=74349', 'not-hungry pet: back on its pet page after the toast');
// not the owner: stays on Play (wallet connect is there)
x = run('#act-feed-74349-pet', pet({ owner: 'bc1qother' })); x.flush();
ok(/Only the owner/.test(x.toasts.join(' ')) && /play\.html/.test(x.loc.href), 'other wallet: stays on Play to connect');
// feed from elsewhere (no -pet): old behaviour, stays on Play with the back-link toast
x = run('#act-feed-74349', pet());
ok(x.confirms.length === 1 && x.confirms[0].after == null, 'plain act-feed has no return step');
x.close(); x.confirms[0].after && x.confirms[0].after(); x.obs.forEach(f => f());
ok(/play\.html/.test(x.loc.href) && /Back to #74349/.test(x.toasts.join(' ')), 'plain act-feed stays on Play and shows the back-link toast');
// rolls unchanged
x = run('#act-froll-74349', pet()); x.close(); x.obs.forEach(f => f());
ok(x.confirms.length === 1 && x.confirms[0].t === 'Free roll #74349' && /play\.html/.test(x.loc.href), 'free roll from the pet page unchanged');

// ---- (4) pet page fed status (fedSent / fedNote / petActs from js/v2-pages.js)
const pblock = slice(pages, '  function fedSent(w, p)', '  function petActs(w, p)') + slice(pages, '  function petActs(w, p)', '\n  document.addEventListener(');
function page(search, p, tip) {
  const ctx = vm.createContext({ location: { search }, URLSearchParams, ME: 'bc1qme', V: {}, esc: s => String(s), fmt: n => String(n), kept: () => false });
  vm.runInContext(pblock + '\nthis.T = { fedSent: fedSent, fedNote: fedNote, petActs: petActs };', ctx);
  const w = { tip }; return { s: ctx.T.fedSent(w, p), note: ctx.T.fedNote(w, p), acts: ctx.T.petActs(w, p) };
}
let g = page('?id=74349&fed=101', pet(), 101);
ok(g.s === 'pending' && /Feed sent for #74349/.test(g.note) && /⏳ Feed sent/.test(g.acts) && !/act-feed-74349/.test(g.acts), 'pending: note + disabled ⏳ Feed sent, no second Feed link');
g = page('?id=74349&fed=101', pet({ hungry: false, fedToday: true }), 102);
ok(g.s === 'fed' && /is fed/.test(g.note) && /Fed today/.test(g.acts), 'confirmed: fed note + Fed today');
g = page('?id=74349', pet(), 101);
ok(g.s === '' && g.note === '' && /act-feed-74349-pet/.test(g.acts), 'no fed param: normal Feed link to act-feed-ID-pet');
g = page('?id=74349&fed=80', pet(), 101);
ok(g.s === '', 'old fed param (> 12 blocks) is ignored');

console.log('pet-feed-return: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
