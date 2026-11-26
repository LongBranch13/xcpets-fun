#!/usr/bin/env node
/* rare-room-rethink PR 1 (Nov 23 2026): the Dress drawer, now opened from the pet page (card-tidy). Display only.
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
{ const RP = require('./lib/rules-pin'); ok(RP.md5('js/v2-rules.js') === RP.pin('js/v2-rules.js'), 'js/v2-rules.js is the reviewed, pinned rules file (tools/fixtures/rules-pin.json)'); } /* was: matches origin/main, which turned red on every rules PR */
ok(/kind: 'equip'/.test(src) && !/pet:[a-z]/.test(src) && !/confirmPlans\('(?!Equip)/.test(src), 'only the free local equip op, no burn tags');
ok(/html\.viewonly #pcDress/.test(src), 'the pet page button is hidden in view-only mode');
/* card-tidy (Jake Nov 23 2026): no Dress button on My Pets cards; dress from the pet's own page */
ok(!/dressbtn' ?;? ?b\.dataset\.dress|'pets', 'mpsBox'/.test(src) && !/querySelectorAll\('\.pet\.card/.test(src), 'My Pets cards get no Dress button');
ok(/data-v2page'\) === 'pet'/.test(src) && /pcDress/.test(src) && /V2Mock\.save\(\)/.test(src), 'the pet page gets the Dress button, saving through V2Mock like V2UI.save');
const pet = rd('pet.html'), pp = rd('practice-pet.html');
ok(pet.indexOf('js/v2-dress.js?v=' + tok) > pet.indexOf('js/v2-pet-card.js'), 'pet.html loads js/v2-dress.js?v=' + tok + ' after the pet card');
ok(pp.indexOf('js/v2-dress.js?v=' + tok) >= 0, 'practice-pet.html loads it too');
ok(/window\.__xcPetRedraw = function/.test(rd('js/v2-pages.js')), 'the pet page repaints its gear after a wear');
const v2 = rd('js/v2.js'), ct = rd('js/v2-card-tidy.js'), ctok = md5(ct).slice(0, 10);
ok(/zCta\(p, w\)/.test(v2) && !/zb-by">.{0,40}Raised by ' \+ shortAddr\(p\.zombie\.by\) \+ '<\/div>' \+ zZoneHtml\(p, w\)/.test(v2), 'zombie cards: no feed panel on the card, one tap-to-feed line');
ok(/zZoneHtml\(p, world\(\)\)/.test(v2), 'zombie feeding stays in the Open panel');
ok(/class="cbr"/.test(v2) && /chip fed/.test(v2), 'card chips: a break between who and numbers, fed chip marked');
['templates/game.html', 'play.html', 'practice.html'].forEach(f => ok(rd(f).indexOf('js/v2-card-tidy.js?v=' + ctok) > rd(f).indexOf('js/v2-mypets-calm.js'), f + ' loads js/v2-card-tidy.js?v=' + ctok));
ok(/#pets \.pet\.card/.test(ct) && /#mpsBox \.pet\.card/.test(ct) && !/v2-rules|pet:[a-z]/.test(ct), 'card tidy is CSS for My Pets cards only');
ok(/\.dw-layer \{[^}]*z-index: -1/.test(rd('css/doom-week.css')), 'Doom 2 decor falls behind the page content');
try { new Function(src); ok(true, 'js/v2-dress.js parses'); } catch (e) { ok(false, 'js/v2-dress.js parses: ' + e.message); }
const rr = rd('js/v2-rr-doors.js'), tok2 = md5(rr).slice(0, 10);
['templates/game.html', 'rare-room.html', 'practice-rare.html'].forEach(f => ok(rd(f).indexOf('js/v2-rr-doors.js?v=' + tok2) > rd(f).indexOf('js/v2-dress.js'), f + ' loads js/v2-rr-doors.js?v=' + tok2 + ' after the drawer'));
ok(/data-split'\) === 'rare'/.test(rr), 'the doors run only on the Rare Room page');
ok(/'spin'/.test(rr) && /'closet'/.test(rr) && /'flex'/.test(rr) && /#lookStation/.test(rr) && /#pepeWheel/.test(rr), 'three doors: Spin = Pepe Wheel, Closet, Flex = Flex Forge');
ok(/i \+ 400/.test(rr) && /setTimeout\(step, 0\)/.test(rr), 'Best upgrades is worked out 400 pets per slice');
ok(!/pet:[a-z]/.test(rr) && !/ops\.push/.test(rr), 'the doors send nothing: every wear goes through the drawer');
try { new Function(rr); ok(true, 'js/v2-rr-doors.js parses'); } catch (e) { ok(false, 'js/v2-rr-doors.js parses: ' + e.message); }
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
