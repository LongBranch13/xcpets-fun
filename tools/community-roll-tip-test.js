/* community-roll-tip-test (Nov 1 2026): the community pet hover/tap tooltip shows each worn piece with slot + rarity and
 * 'Your recent community rolls'; the roll result card names the community pet. Display only. Static checks. */
'use strict';
const fs = require('fs'), path = require('path'), rd = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const r = rd('js/v2-render.js'), v = rd('js/v2.js'), pg = rd('js/v2-pages.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
ok(/function communityTipHtml\(w, me\)/.test(r), 'communityTipHtml(w, me) exists');
ok(r.includes("' wears'") && /esc\(e\.slotName\) \+ ': ' \+ esc\(e\.label\) \+ ' ' \+ ctPill\(/.test(r), 'each worn piece: slot: name + rarity pill');
ok(r.includes('🎲 Your recent community rolls') && /g\.by === me/.test(r) && /\.slice\(-3\)\.reverse\(\)/.test(r), 'last 3 rolls by this wallet, newest first');
ok(/cur = vis\[g\.slot\]/.test(r), "only a piece the sprite draws can 'replace' a roll");
ok(/tip\.innerHTML = communityTipHtml\(w2, cv\._ctipMe\)/.test(r), 'tooltip uses communityTipHtml');
ok(/communityTipHtml: communityTipHtml/.test(r), 'communityTipHtml exported on V2Render');
ok(/bindCommunityTip\(commAnim\.c, w, ME\)/.test(v), 'play page passes ME to the tooltip');
ok(/bindCommunityTip\(\$\('crCanvas'\), w, ME\)/.test(pg), 'home page passes ME to the tooltip');
ok(/Community roll for ' \+ /.test(v) && /Worn by ' \+ /.test(v), 'roll result card names the community pet');
ok(!/Wearing:/.test(v.split('\n').filter(l => /commName|croll/.test(l)).join('\n')), "no visible 'Wearing:' line back on the card (removed Oct 29)");
console.log('community-roll-tip-test: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
