#!/usr/bin/env node
/* Gear-roots + gear-stick test (branch gear-stick-fix, owner approved 2026-10-28). Dev tooling only.
 *   node tools/gear-roots-test.js
 * 1) Wear rule: from ACTIVATE_GEAR_ROOTS_BLOCK a hybrid may WEAR ★ gear of every species it is made of (heads, FUNTRUMP look pieces, Wizard
 *    staff included) and a 1 of 1 (supreme / contest) may wear ALL gear. Before the gate nothing changes. Roll pools (no pet passed) never change.
 * 2) Local ops merge: a tab saving an old ops list keeps the equips another tab stored (js/v2-chain.js mergeOps). */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const SCRIPTS = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js', 'js/block-hashes.js'];
function load() { const store = {}, ls = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const win = { console: { log() {}, warn() {}, error() {}, info() {} }, localStorage: ls, sessionStorage: ls, location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/' }, navigator: { userAgent: 'node' }, setTimeout: () => 0, clearTimeout() {}, URLSearchParams, URL, TextEncoder, TextDecoder, fetch: () => Promise.reject(new Error('offline')) };
  win.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {}, body: null, documentElement: { style: {} } };
  win.addEventListener = () => {}; win.window = win; win.self = win; win.globalThis = win; const ctx = vm.createContext(win);
  for (const f of SCRIPTS) { const p = path.join(ROOT, f); if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f }); }
  return ctx; }
let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const V = load().V2Rules, G = V.ACTIVATE_GEAR_ROOTS_BLOCK, BEFORE = G - 1;
const at = (b, it, sp, pet, body, tier) => { V._setEligB(b); return V.eligible(it, sp, body, tier, pet); };
const hyb = 'hyb:pepe:dodo', don = { id: 46073, species: 'hyb3:nakamoto:kek:funtrump', supreme: { id: 'don', n: 1, of: 1 } }, bo = { id: 49075, species: 'bo', supreme: { id: 'bo', n: 1, of: 1 } };
const hp = { id: 1, species: hyb }, plain = { id: 2, species: 'pepe' };
ok(G === 973646 && G > 973638, 'gate ' + G + ' is after tip 973638');
ok(V.eligible && V.isOneOfOne(don) && V.isOneOfOne(bo) && !V.isOneOfOne(hp) && V.isOneOfOne({ contest: { id: 'x' } }), 'isOneOfOne: supreme + contest editions only');
// before the gate: old rule exactly
ok(!at(BEFORE, 'pimp-hat', hyb, hp) && !at(BEFORE, 'v2-dodo-hat', hyb, hp), 'before gate: hybrid still refused its roots\' head sigs');
ok(at(BEFORE, 'sig-dodo-cape', hyb, hp) && at(BEFORE, 'golden-sword', hyb, hp), 'before gate: hybrid keeps parent sigs + shared gear');
ok(!at(BEFORE, 'sig-dodo-cape', don.species, don) && !at(BEFORE, 'pimp-hat', 'bo', bo), 'before gate: 1 of 1s refused other species\' sigs');
// from the gate
ok(at(G, 'pimp-hat', hyb, hp) && at(G, 'v2-dodo-hat', hyb, hp), 'from gate: hybrid wears head sigs of BOTH roots');
ok(!at(G, 'sig-wizard-staff', hyb, hp) && at(G, 'sig-wizard-staff', 'hyb:wizard:pepe', { id: 3, species: 'hyb:wizard:pepe' }), 'from gate: Wizard staff on a wizard-root hybrid, not on others');
ok(!at(G, 'name-tag', hyb, hp) && !at(G, 'sig-wizard-staff', hyb, hp), 'from gate: hybrid still refused non-root sigs');
ok(at(G, 'ft-samurai-sword', don.species, don) && at(G, 'ft-skateboard', don.species, don) && at(G, 'sig-dodo-cape', don.species, don) && at(G, 'name-tag', don.species, don), 'from gate: 1 of 1 Don wears FT look pieces + every species sig');
ok(at(G, 'pimp-hat', 'bo', bo) && at(G, 'sig-wizard-staff', 'bo', bo), 'from gate: Bo (1 of 1) wears every sig');
ok(at(G, 'ft-samurai-sword', 'hyb:funtrump:pepe', { id: 4, species: 'hyb:funtrump:pepe' }), 'from gate: FUNTRUMP-root hybrid wears look-locked FT pieces');
ok(!at(G, 'sig-dodo-cape', 'pepe', plain) && at(G, 'pimp-hat', 'pepe', plain), 'from gate: plain species unchanged');
// roll pools never get a pet -> unchanged
ok(!at(G, 'pimp-hat', hyb) && at(G, 'sig-dodo-cape', hyb), 'from gate: no pet passed (roll pools) = old rule');
V._setEligB(null);
// mergeOps (js/v2-chain.js)
const src = fs.readFileSync(path.join(ROOT, 'js/v2-chain.js'), 'utf8'), m = src.match(/function opKey[\s\S]*?\n  function mergeOps[\s\S]*?return out; \}/);
ok(!!m, 'mergeOps found in js/v2-chain.js');
const mergeOps = vm.runInNewContext(m[0] + '; mergeOps');
const e = (pid, gid, b) => ({ kind: 'equip', owner: 'G', petId: pid, slot: 'hand', gid, block_index: b });
const old = [e(1, 'a', 10)], stored = [e(1, 'a', 10), e(46073, 'g4569', 20)];
ok(JSON.stringify(mergeOps(stored, old)) === JSON.stringify(stored), 'old tab saving its stale list keeps the other tab\'s equip');
ok(JSON.stringify(mergeOps(stored, old.concat([e(2, 'b', 21)]))) === JSON.stringify(stored.concat([e(2, 'b', 21)])), 'old tab\'s own new equip is appended after the stored ones');
ok(JSON.stringify(mergeOps(stored, stored)) === JSON.stringify(stored), 'same list = unchanged (no duplicates)');
ok(mergeOps([e(1, 'a', 10)], [e(1, 'a', 10), e(1, 'a', 10)]).length === 2, 'a real repeat op is kept (counted)');
ok(JSON.stringify(mergeOps([], old)) === JSON.stringify(old), 'nothing stored = this tab\'s list');
console.log(fail ? fail + ' FAILED' : 'ALL PASS'); process.exit(fail ? 1 : 0);
