#!/usr/bin/env node
/* Holder welcome gift card (js/v2-welcome-gift.js): what the Play card says in each state. Pure, no browser. Dev tooling only.
 *  not listed = nothing · before the gate = "unlocks in about N hours" (no button) · open = CLAIM with the cost said plainly ·
 *  claim sent = waiting (no second button) · claimed = "see my eggs" until closed · window over = nothing.
 *   node tools/welcome-gift-page-test.js */
'use strict';
const path = require('path'), fs = require('fs');
const W = require(path.join(__dirname, '..', 'js', 'v2-welcome-gift.js'));
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const base = { listed: true, on: true, open: true, claimed: false, eggs: 3, meals: 3, gate: 977990, daysLeft: 60 };
ok(W.view(Object.assign({}, base, { listed: false }), 977991) === null, 'a wallet not on the list sees nothing');
const soon = W.view(Object.assign({}, base, { on: false, open: false }), 977950);
ok(soon && soon.k === 'soon' && !soon.btn && /about 7 hours/.test(soon.text), 'before the gate: "unlocks in about 7 hours", no button (' + soon.text + ')');
const cl = W.view(base, 977991);
ok(cl && cl.k === 'claim' && /CLAIM/.test(cl.btn) && /1 dander/.test(cl.text) && /Bitcoin fee/.test(cl.text) && /60 days left/.test(cl.text), 'open: CLAIM button, cost and days left said plainly');
const wt = W.view(base, 977991, true);
ok(wt && wt.k === 'wait' && !wt.btn, 'after sending the claim: a waiting note, no second claim button');
const dn = W.view(Object.assign({}, base, { claimed: true }), 977995);
ok(dn && dn.k === 'done' && /SEE MY EGGS/.test(dn.btn) && /Pantry/.test(dn.text), 'claimed: "see my eggs", the Pantry meals hatch them');
ok(W.view(Object.assign({}, base, { claimed: true }), 977995, false, true) === null, 'claimed and closed: nothing');
ok(W.view(Object.assign({}, base, { open: false }), 990000) === null, 'window over and not claimed: nothing');
const tpl = fs.readFileSync(path.join(__dirname, '..', 'templates', 'game.html'), 'utf8');
ok(/js\/v2-welcome-gift\.js\?v=[0-9a-f]+"/.test(tpl), 'the game template loads js/v2-welcome-gift.js (with a cache token)');
console.log(fails ? fails + ' FAILED' : 'welcome-gift-page-test: all checks pass'); process.exit(fails ? 1 : 0);
