#!/usr/bin/env node
/* The breed list uses V2Rules.breedable, which counts cooldown with span() so the pause does not count.
 * The hover card, the cooldown panel and the pet history used raw blocks, so they said "ready" while the
 * list (and the rules) still had blocks left. Display only. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { load } = require('./lib/load-rules');
const ROOT = path.resolve(__dirname, '..');
let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const rules = fs.readFileSync(path.join(ROOT, 'js/v2-rules.js'));
ok(crypto.createHash('md5').update(rules).digest('hex') === require('./lib/rules-pin').pin('js/v2-rules.js'), 'rules MD5 unchanged');
const V = load().V2Rules;
const tip = 976619, last = 975366, b = tip;
const span = V.span(b, last), raw = b - last;
ok(raw >= V.BREED_COOLDOWN && span < V.BREED_COOLDOWN, 'a breed before the pause can be past 1,008 raw blocks and still inside the game cooldown (' + raw + ' raw, ' + span + ' clock)');
const p = { id: 1, owner: 'a', species: 'pepe', stage: 5, dead: false, released: false, neglected: false, breeds: 1, breedsV2: 1, lastBreed: last, community: false };
const why = V.breedable(p, b);
ok(why && /cooldown/.test(why) && why.indexOf(String(V.BREED_COOLDOWN - span)) >= 0, 'breedable uses the clock remainder (' + why + ')');
function src(f) { return fs.readFileSync(path.join(ROOT, f), 'utf8'); }
ok(/R\.span \? R\.span\(b, p\.lastBreed\)/.test(src('js/v2-hovercard.js')), 'hover card cooldown uses the game clock');
ok(/R\.span \? cool - R\.span\(b, p\.lastBreed\)/.test(src('js/v2-quest-clarity.js')), 'cooldown panel uses the game clock');
ok(/V2\.span \? V2\.span\(tip, p\.lastBreed\)/.test(src('js/v2-render.js')), 'pet history cooldown uses the game clock');
console.log(fail ? fail + ' failed' : 'breed-clock-test ok');
process.exit(fail ? 1 : 0);
