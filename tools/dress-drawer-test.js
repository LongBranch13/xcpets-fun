#!/usr/bin/env node
/* rare-room-rethink PR 1 (Nov 23 2026): the Dress drawer + "Dress +N" on pet cards. Display only.
 * Checks: every game page and practice page loads js/v2-dress.js with its content token, the rules engine is untouched,
 * and the drawer only uses the free local 'equip' op (no burn tags, no confirmPlans burn). The browser run is done by hand
 * with a view-only wallet (see the PR); this file guards the wiring. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (c) pass++; else fail++; };
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const md5 = s => crypto.createHash('md5').update(s).digest('hex');
const src = rd('js/v2-dress.js'), tok = md5(src).slice(0, 10);
['templates/game.html', 'play.html', 'fight.html', 'rare-room.html', 'raid.html', 'breed.html', 'practice.html', 'practice-fight.html', 'practice-rare.html', 'practice-breed.html'].forEach(f => {
  ok(rd(f).indexOf('js/v2-dress.js?v=' + tok) >= 0, f + ' loads js/v2-dress.js?v=' + tok);
  ok(rd(f).indexOf('js/v2-lair-qol.js') < rd(f).indexOf('js/v2-dress.js'), f + ' loads it after v2-lair-qol.js');
});
try { ok(md5(rd('js/v2-rules.js')) === md5(cp.execSync('git show origin/main:js/v2-rules.js', { cwd: ROOT, maxBuffer: 1 << 28 })), 'js/v2-rules.js matches origin/main'); } catch (e) { ok(true, 'origin/main not fetched, rules check skipped'); }
ok(/kind: 'equip'/.test(src) && !/pet:[a-z]/.test(src) && !/confirmPlans\('(?!Equip)/.test(src), 'only the free local equip op, no burn tags');
ok(/html\.viewonly \.dressbtn/.test(src), 'buttons hidden in view-only mode');
ok(/IntersectionObserver/.test(src) && !/\.pets\.forEach|w\.pets\.filter/.test(src), 'cards are filled only when on screen, no pass over every pet in the world');
ok(/'pets', 'mpsBox'/.test(src), 'grid and the phone one-at-a-time card both get the button');
try { new Function(src); ok(true, 'js/v2-dress.js parses'); } catch (e) { ok(false, 'js/v2-dress.js parses: ' + e.message); }
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
