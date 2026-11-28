#!/usr/bin/env node
/* GEAR FIT CHECK (Jake Nov 28 2026: "scarf doesnt really fit and pets dont have feet shouldnt have shoes"; he expects glitches to be caught before he sees them).
 * Draws every shared gear piece on every main species (adult, display code js/v2-render.js) and checks the fit rules:
 *  1) shoes are never drawn on a body with no feet (busts), and are drawn on bodies with feet;
 *  2) a front neck piece (scarf, bandana, amulet) sits on the body: no pixel off the body, none below the body's lowest row;
 *  3) every piece shows (at least 2 pixels change; studs and rings are 2 px on purpose), unless the piece is meant to be hidden on that species (KNOWN below, with a reason);
 *  4) worn pieces other than footwear, capes and held items never paint below the pet's ground row.
 * A new piece or species that breaks a rule fails here. node tools/gear-fit-check-test.js [--list] */
'use strict';
const { load } = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const LIST = process.argv.indexOf('--list') >= 0;
const c = load(['js/kek-sprite.js', 'js/wizard-sprite.js', 'js/funtrump-sprite.js', 'js/bo-sprite.js', 'js/contest-sprite.js']);
c.setInterval = () => 0; c.document.readyState = 'loading'; c.clearInterval = () => {}; c.requestAnimationFrame = () => 0; c.ImageData = c.ImageData || function (d, w, h) { this.data = d; this.width = w; this.height = h; };
require('vm').runInContext(require('fs').readFileSync(require('path').join(__dirname, '../js/v2-render.js'), 'utf8'), c);
const V = c.V2Rules, P = c.PetCore, R = c.V2Render, D = c.BonusGear.DEFS, G = V.GEAR_BY_ID;
/* meant to be hidden: Chud's beard style pieces on species with no chin for them (BEARD_EXCLUDE in the rules) */
const KNOWN = {};
const arts = {}; for (let i = 0; i < 40000; i++) { const a = P.generate({ blockHash: '00'.repeat(32), petId: 'fit' + i, blockHeight: 980000 }); if (!a.hybrid && !arts[a.species]) arts[a.species] = Object.assign({}, a, { background: 'solid', bgColor: '#ff00fe', pattern: 'none' }); }
const SP = Object.keys(arts); ok(SP.length >= 12, 'main species drawn: ' + SP.join(' '));
const isBg = (d, q) => d[q * 4] === 255 && d[q * 4 + 1] === 0 && d[q * 4 + 2] === 254;
const items = Object.keys(G).filter(id => { const it = G[id]; return it && !it.exclusive && !it.alias && !it.noRoll && D[id]; });
ok(items.length > 50, items.length + ' shared pieces');
const gaps = [];
SP.forEach(sp => { const art = arts[sp], base = R.framesWith(art, 4, [], [])[0].data; let ground = 0; for (let q = 0; q < 1024; q++) if (!isBg(base, q)) ground = Math.max(ground, q >> 5);
  const feet = R.gearShow.hasFeet(art, 4);
  items.forEach(id => { const it = G[id], d0 = D[id]; if (!V.eligible(id, sp, null, 3)) return; let fr; try { fr = R.framesWith(art, 4, [id], [])[0].data; } catch (e) { ok(false, sp + ' ' + id + ' throws ' + e.message); return; }
    let n = 0, off = 0, below = 0; for (let q = 0; q < 1024; q++) { const k = q * 4; if (fr[k] === base[k] && fr[k + 1] === base[k + 1] && fr[k + 2] === base[k + 2]) continue; n++; if (isBg(base, q)) off++; if ((q >> 5) > ground) below++; }
    const tag = sp + ' ' + id + ' (' + it.slot + ')';
    if (R.gearShow.isShoe(id)) { if (!feet) { ok(n === 0, tag + ': shoes on a body with no feet (' + n + ' px)'); return; } ok(n > 0, tag + ': shoes missing on a body with feet'); }
    if (d0.at === 'neck' && !d0.behind) { ok(off === 0, tag + ': neck piece off the body (' + off + ' px)'); ok(below === 0, tag + ': neck piece below the body (' + below + ' px)'); }
    if (n < 2 && !KNOWN[sp + ' ' + id]) gaps.push(tag + ': hardly shows (' + n + ' px)');
    if (below > 0 && ['feet', 'back', 'hand', 'weapon'].indexOf(it.slot) < 0 && !KNOWN[sp + ' ' + id]) gaps.push(tag + ': ' + below + ' px below the ground row'); }); });
if (LIST) gaps.forEach(g => console.log('GAP', g));
ok(gaps.length === 0, gaps.length + ' fit gaps' + (gaps.length ? ' (first: ' + gaps.slice(0, 5).join('; ') + ')' : ''));
console.log('gear-fit-check: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
