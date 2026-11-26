/* style-collision-test (Nov 25 2026). The Meat Grinder screen opened unstyled at the bottom of the page because js/v2-mg-road.js
 * (Road to Mythic God) injected its own <style id="mgrCss"> with a ".mgr" box, and js/v2-grinder.js skips its CSS when that id
 * already exists. This test fails when two scripts create an element with the same id, or both define the same top-level CSS class
 * in their injected styles (".x{...}" not scoped under another selector). Static, no browser. node tools/style-collision-test.js */
'use strict';
const fs = require('fs'), path = require('path');
const JS = path.join(__dirname, '..', 'js');
/* shared on purpose: the same host element filled by two scripts, or shared class names that mean the same thing */
const SHARED_IDS = { cemAltar: 1, nfGroup: 1, dwCss: 1 /* the one Doom stylesheet link: js/boot-look.js writes it in <head>, js/doom-week.js reuses it (creates it only if boot-look did not) */ };
const SHARED_CLASSES = { chip: 1, 'ez-c': 1, 'lf-acts': 1, 'lq-chip': 1, mfx: 1, 'mg-unl': 1, 'mps-card': 1, 'mr-row': 1, open: 1, pet: 1, 'pk-key': 1, 'pk-keys': 1, shop8: 1, 'zb-opt': 1 };
const ids = new Map(), cls = new Map(), put = (m, k, f) => { if (!m.has(k)) m.set(k, new Set()); m.get(k).add(f); };
for (const f of fs.readdirSync(JS).filter(n => n.endsWith('.js'))) {
  const s = fs.readFileSync(path.join(JS, f), 'utf8');
  for (const m of s.matchAll(/\.id\s*=\s*['"]([A-Za-z0-9_-]+)['"]/g)) put(ids, m[1], f);
  for (const m of s.matchAll(/'([^'\n]*\{[^'\n]*)'/g)) {
    for (const r of m[1].matchAll(/(?:^|\})\s*([^{}@]+)\{/g)) for (let sel of r[1].split(',')) {
      sel = sel.trim(); const c = /^\.([a-zA-Z][\w-]*)(?:[\s:.\[>]|$)/.exec(sel); if (c) put(cls, c[1], f);
    }
  }
}
let fail = 0;
for (const [k, v] of ids) if (v.size > 1 && !Object.prototype.hasOwnProperty.call(SHARED_IDS, k)) { fail++; console.log('FAIL id "' + k + '" is created by ' + [...v].join(' and ')); }
for (const [k, v] of cls) if (v.size > 1 && !Object.prototype.hasOwnProperty.call(SHARED_CLASSES, k)) { fail++; console.log('FAIL class ".' + k + '" is styled at top level by ' + [...v].join(' and ')); }
console.log('style-collision-test: ' + (fail ? fail + ' collision(s)' : 'no collisions'));
process.exit(fail ? 1 : 0);
