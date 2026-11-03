#!/usr/bin/env node
/* motel-partner-1103 (display only): source checks for
 *  1) Gooby's 💘 Rug Me tab: the retire gate (V2Rules.retireOn, block 974,163) is re-checked on every motel render, not only once at boot;
 *  2) the 🛎️ Check in tab scrolls to the check-in flow (motel scene + dock) instead of only re-selecting itself;
 *  3) the drag dock: once guest 1 is in, the strip lists the dates from V2Rules.breedPicker partners (your pets + other players'),
 *     never a mixed God / non-God pair (resPairWhy), with All / Mine / Other players chips. */
'use strict';
const fs = require('fs'), path = require('path'), ROOT = path.resolve(__dirname, '..');
let bad = 0; const ok = (c, m) => { if (!c) bad++; console.log((c ? 'ok   ' : 'FAIL ') + m); };
const rm = fs.readFileSync(path.join(ROOT, 'js/v2-rugme.js'), 'utf8'), lf = fs.readFileSync(path.join(ROOT, 'js/v2-lowfriction.js'), 'utf8'), css = fs.readFileSync(path.join(ROOT, 'css/rugme.css'), 'utf8');
ok(/V2Motel\.render = function \(\) \{ var r = mr\.apply\(this, arguments\); try \{ mount\(\); setTab\(st\.tab\);/.test(rm), 'rug me: every motel render re-runs setTab (retire gate re-checked once the chain tip is known)');
ok(/function setTab\(t\) \{ var rt = !!\(V && V\.retireOn && V\.retireOn\(tip\(\) \+ 1\)\); if \(rt && t === 'rug'\) t = 'motel';/.test(rm), 'rug me: a retired Rug Me tab can never be opened (falls back to Check in)');
ok(/x\.hidden = rt; x\.style\.display = rt \? 'none' : ''/.test(rm), 'rug me: the Rug Me tab is hidden (also against .btn display rules) once retired');
ok(/if \(t === 'motel'\) goCheckIn\(\);/.test(rm) && /function goCheckIn\(\) \{ var sc = \$\('motelScene'\)/.test(rm) && /scrollIntoView\(\{ block: 'start'/.test(rm), 'check in: the 🛎️ Check in tab scrolls to the motel scene + dock');
ok(/f\.focus\(\{ preventScroll: true \}\)/.test(rm), 'check in: focus moves to the first pet in the dock (keyboard / screen reader)');
ok(/\.rm-tabs\.rm-solo \.btn\{opacity:1/.test(css), 'check in: retired bar shows one full-strength Check in button');
ok(/pick\(BIOS, ad\.tx \+ ':' \+ ad\.pet\)/.test(rm) && /V\.rugCost\(b\)/.test(rm), 'rug me: rule-facing code strings unchanged');
ok(/function pool\(w\) \{ var a = dateFor\(w\); if \(!a\) return mine\(w\);/.test(lf), 'dock: step 1 lists your own pets, step 2 (guest 1 in) the date pool');
ok(/Vr\.breedPicker\(w, U\(\)\.ME, tip\(w\), a, pend\(\)\)\.partners\.forEach/.test(lf) && /WC\.pl\.push\(x\.p\)/.test(lf), 'dock: the date pool comes from V2Rules.breedPicker partners (other players\' pets too)');
ok(/rx = function \(p\) \{ return !!\(A && Vr\.resPairWhy && Vr\.resPairWhy\(A, p, T\)\); \}/.test(lf) && /!rx\(x\.p\)\) WC\.pl\.push/.test(lf), 'dock: never lists a mixed God / non-God pair (gods-breed-gods-1102)');
ok(/\['mine', '👤 Mine'\], \['other', '🌍 Other players'\]/.test(lf) && /st\.who === 'other' \? p\.owner !== me/.test(lf), 'dock: All / Mine / Other players chips');
ok(/id="lfA0">↺ Change guest 1/.test(lf), 'dock: Change guest 1 button');
ok(/else \{ b\.value = String\(p\.id\);/.test(lf), 'dock: a dropped date fills #bB like the pickers (burn stays the existing confirm)');
ok(!/pet:(breed|accept|ad|rug)/.test(lf.split('motel-partner-1103')[1] || ''), 'dock: no burn tag written by the new code');
console.log(bad ? bad + ' FAILED' : 'all ok'); process.exit(bad ? 1 : 0);
