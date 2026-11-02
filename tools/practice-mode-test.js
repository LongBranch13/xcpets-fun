#!/usr/bin/env node
/* practice-mode-1101 (owner approved Nov 1 2026 9:28 PM CT, PREVIEW): guest practice page (practice.html + js/v2-practice.js).
 * Checks: no wallet / chain / network code on the page, practice state only under 'xcpets-practice-v1' and never read by the real game,
 * never a flame crown or an edition / 1 of 1 / special egg, copy rules. Pure source checks (no network, no browser).
 *   node tools/practice-mode-test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..'), rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const html = rd('practice.html'), js = rd('js/v2-practice.js'), css = rd('css/practice.css');
const scripts = (html.match(/<script src="([^"?]+)/g) || []).map(s => s.replace('<script src="', ''));
['js/pet-core.js', 'js/v2-rules.js', 'js/v2-render.js', 'js/v2-life-anim.js', 'js/v2-practice.js'].forEach(f => ok(scripts.includes(f), 'practice.html loads ' + f));
ok(scripts.every(f => !/^rjs\/|wallet|chain|burn|block-hashes|v2\.js$|v2-view|casa-connect|insc-gate/.test(f)), 'practice.html loads no wallet / chain / burn code: ' + scripts.join(' '));
ok(!/fetch\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource|import\(/.test(js), 'v2-practice.js makes no network calls');
const code = js.replace(/\/\*[\s\S]*?\*\//g, ''); ok(!/\bsign\w*|wallet|broadcast|api\.counterparty|api\.xcp\.fun|webxcp|psbt/i.test(code), 'v2-practice.js never signs or calls a wallet / chain API');
ok((js.match(/localStorage\.(get|set)Item\(([^)]*)\)/g) || []).every(s => /\(KEY/.test(s)), 'v2-practice.js only reads / writes its own key');
ok(/var KEY = 'xcpets-practice-v1'/.test(js), "practice key is 'xcpets-practice-v1'");
const others = fs.readdirSync(path.join(ROOT, 'js')).filter(f => /\.js$/.test(f) && f !== 'v2-practice.js').concat(fs.readdirSync(path.join(ROOT, 'rjs')).map(f => '../rjs/' + f));
ok(others.every(f => rd('js/' + f).indexOf('xcpets-practice') < 0), 'no real-game script reads the practice key (rankings, feeds, replay never see practice pets)');
/* PRACTICE marks everywhere */
ok(/PRACTICE MODE/.test(html) && /class="pr-badge">PRACTICE</.test(js) && /\.pr-card::after\{content:'PRACTICE'/.test(css) && /\.la-ov::after\{content:'PRACTICE/.test(css) && /body\.pr-page::before/.test(css), 'PRACTICE badge on cards, watermark on cards, page and scenes');
ok(/<body class="pr-page"/.test(html), 'page watermark class on body');
ok(/href="play\.html">Play the real game/.test(html), 'gentle nudge to the real game');
ok(/href="practice\.html"/.test(rd('index.html')), 'index links to practice mode');
ok(/noindex/.test(html), 'preview page is noindex');
/* copy rules: times not x, no series / discount, never api.xcp.fun */
const copy = (html + js + css).replace(/<[^>]+>/g, ' ');
ok(!/\b\d[\d,.]*\s?x\b|\bx\s?\d/.test(copy), "copy writes 'times', never 'x' for multiplying");
ok(!/series|discount|api\.xcp\.fun/i.test(html + js + css), "no 'series', 'discount' or api.xcp.fun");
ok(!/flame-crown'?\s*[,}]/.test(js.replace("a.crown === 'flame-crown'", '')), 'practice never picks a flame crown on its own');
/* load v2-practice.js with stubs (the page boot is skipped: no #practice) and check the art filters */
const sb = { window: {}, document: { readyState: 'complete', getElementById: () => null }, localStorage: { getItem: () => null, setItem: () => { } } };
sb.window.V2Rules = { SPECIES12: [{ id: 'pepe' }, { id: 'doge' }] }; sb.window.PetCore = {}; sb.window.V2Render = {}; sb.window.V2LifeAnim = {}; sb.window.document = sb.document;
vm.createContext(sb); vm.runInContext(js, sb); const P = sb.window.V2Practice;
ok(P && P.KEY === 'xcpets-practice-v1', 'V2Practice exported');
ok(P.tidy({ crown: 'flame-crown' }).crown === 'jeweled-crown', 'a rolled flame crown becomes a jeweled crown');
ok(P.tidy({ crown: 'gold-crown' }).crown === 'gold-crown', 'other crowns unchanged');
ok(!('edition' in P.tidy({ edition: 1 })) && !('auraFire' in P.tidy({ auraFire: 1 })), 'no edition frame or fire aura flags');
ok(P.okArt({ species: 'pepe' }) && !P.okArt({ species: 'nakamoto' }) && !P.okArt({ species: 'pepe', rareTier: 'x1' }) && !P.okArt({ species: 'pepe', boMark: 1 }) && !P.okArt({ species: 'wizard' }), 'only normal eggs (no special / edition / 1 of 1 pets)');
ok(P.HATCH.map(h => h.cost).join() === '69,690,6900' && P.HATCH.map(h => h.n).join() === '1,12,144', 'practice hatch sizes match the real 69 / 690 / 6,900');
/* rule files untouched by this page */
ok(!/V2Rules\.\w+\s*=|PetCore\.\w+\s*=|_set\w+Activation/.test(js), 'practice never changes V2Rules / PetCore');
console.log('practice-mode-test: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
