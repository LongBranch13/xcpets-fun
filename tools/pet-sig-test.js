#!/usr/bin/env node
/* An open page takes in the changes of its own burns (Nov 27 2026, G Money: "this burn would land on different pets than the ones you picked").
 * After the first load, a fast page only gets the pets whose petSig differs between the page and the check worker (js/v2-split.js requestSync,
 * js/v2-verify-worker.js syncMine). The sig left out the discard flag, so the page never saw its own pet:hd / pet:hu (or feeds, renames, fights)
 * until a reload, and the next discard or add-back it planned was refused before signing. This runs both real petSig copies and checks:
 *  1. the two copies give the same sig for the same pet (else every pet would be re-sent on every sync);
 *  2. a change from each kind of burn changes the sig: discard, add back, feed, rename, fight, breed, quest, Grinder, death, owner;
 *  3. a copy of the pet gives the same sig (no churn on a quiet sync).
 *   node tools/pet-sig-test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
function sigOf(file) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8'), at = src.indexOf('function petSig(p)');
  if (at < 0) throw new Error(file + ': no petSig');
  let i = src.indexOf('{', at), d = 0; for (; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}' && --d === 0) break; }
  const ctx = {}; vm.runInNewContext(src.slice(at, i + 1) + '; this.petSig = petSig;', ctx); return ctx.petSig;
}
const A = sigOf('js/v2-split.js'), B = sigOf('js/v2-verify-worker.js');
const ME = 'bc1qfixture';
const base = () => ({ id: 276587, owner: ME, species: 'homer', tier: 3, name: 'Febebun', care: 69, stage: 1, hatchBlock: 977748, lastFed: null, deathBlock: 978192, dead: false,
  wins: 0, losses: 0, breeds: 0, hd: ME, hdH: [[977749, null]], art: { tierIndex: 3 } });
const p0 = base();
ok(A(p0) === B(p0), 'page and worker give the same sig');
ok(A(p0) === A(JSON.parse(JSON.stringify(p0))), 'a copy of the pet has the same sig (a quiet sync sends nothing)');
ok(A(null) === B(null), 'no pet: same answer in both copies');
const changes = {
  'add back (pet:hu)': p => { delete p.hd; p.hdH.push([977843, ME]); },
  'discard (pet:hd)': null, /* below: starts from a pet that is not discarded */
  'feed': p => { p.lastFed = 977850; p.deathBlock = 978300; },
  'rename': p => { p.name = 'Homer Prime'; },
  'fight': p => { p.wins = 1; },
  'breed': p => { p.breeds = 1; },
  'quest': p => { p.quest = { id: 1 }; },
  'Meat Grinder': p => { p.usedUp = 'grind'; p.released = 977860; },
  'dies': p => { p.dead = true; },
  'new owner': p => { p.owner = 'bc1qother'; },
  'rarity': p => { p.tier = 2; }
};
for (const [k, f] of Object.entries(changes)) {
  if (k === 'discard (pet:hd)') { const q = base(); delete q.hd; q.hdH = []; const s0 = A(q); q.hd = ME; q.hdH.push([977849, null]); ok(A(q) !== s0 && A(q) === B(q), 'a discard (pet:hd) changes the sig, same in both copies'); continue; }
  const p = base(), s0 = A(p); f(p); ok(A(p) !== s0 && A(p) === B(p), 'a ' + k + ' changes the sig, same in both copies');
}
console.log(fails ? fails + ' FAILED' : 'PASS');
process.exit(fails ? 1 : 0);
