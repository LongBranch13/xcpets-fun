#!/usr/bin/env node
/* practice-fun-1102 (owner Nov 1 2026 11:04 PM CT, PREVIEW): practice mode is the REAL game pages (practice*.html, built from play / fight /
 * rare-room / breed / pet by tools/build-practice-page.js) over a pretend in-browser chain (js/practice-engine.js + js/practice-guard.js).
 * Checks: pages are current and carry the PRACTICE bar + "Play for real"; no wallet connector, cached chain data or real block hashes on them;
 * practice storage only under 'xcpets-practice-' and never read by a real-game script; boosted but rule-legal luck (no flame crown, fire aura,
 * edition, special egg); trading / gifting / flame looks refused; copy rules. No network, no browser.
 *   node tools/practice-mode-test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..'), rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const PAGES = ['practice.html', 'practice-fight.html', 'practice-rare.html', 'practice-breed.html', 'practice-pet.html'];
const OWN = ['practice-engine.js', 'practice-guard.js', 'practice-ui.js', 'v2-practice-wallet.js'];

/* 1 · built pages are current (the builder's own --check) */
let chk = ''; try { chk = cp.execFileSync(process.execPath, [path.join(ROOT, 'tools/build-practice-page.js'), '--check'], { encoding: 'utf8' }); ok(true); } catch (e) { ok(false, 'practice pages are stale: run node tools/build-practice-page.js\n' + (e.stdout || '') + (e.stderr || '')); }

/* 2 · every practice page */
PAGES.forEach(f => {
  const h = rd(f), src = (h.match(/<script[^>]*src="([^"?]+)/g) || []).map(s => s.replace(/.*src="/, ''));
  ok(src[0] === 'js/practice-guard.js' && src[1] === 'js/practice-engine.js', f + ': guard + pretend chain load before everything else');
  ok(src.includes('js/practice-ui.js'), f + ': loads the practice bar');
  ok(!src.some(s => /casa-connect|block-hashes|v2-cached|smooth-perf/.test(s)), f + ': no wallet connector, cached chain data or real block hashes: ' + src.join(' '));
  ok(/class="px-bar"/.test(h) && /PRACTICE/.test(h) && /class="px-badge"/.test(h), f + ': PRACTICE bar');
  ok(/<a class="btn px-real[^"]*" href="play\.html"/.test(h), f + ': Play for real button');
  ok(/noindex/.test(h), f + ': preview page is noindex');
  ok(/<body[^>]*class="[^"]*\bpractice\b/.test(h), f + ': body.practice');
  ok(!/<link[^>]*rel="(preconnect|prefetch|dns-prefetch)"[^>]*(counterparty|xcp\.io|mempool)/i.test(h), f + ': no chain preconnects');
});
ok(/data-split="fight"/.test(rd('practice-fight.html')) && /data-split="breed"/.test(rd('practice-breed.html')) && /data-split="rare"/.test(rd('practice-rare.html')), 'game places keep their real layouts');
ok(/href="practice\.html"/.test(rd('index.html')), 'index links to practice mode');

/* 3 · storage + isolation */
const guard = rd('js/practice-guard.js'), ui = rd('js/practice-ui.js'), eng = rd('js/practice-engine.js'), wal = rd('js/v2-practice-wallet.js'), css = rd('css/practice.css');
ok(/xcpets-practice-/.test(guard) && /indexedDB/.test(guard) && /serviceWorker/.test(guard), 'guard prefixes storage and turns off IndexedDB / service workers');
ok(/'xcpets-practice-ledger'/.test(eng), "pretend chain key is 'xcpets-practice-ledger'");
const realJs = fs.readdirSync(path.join(ROOT, 'js')).filter(f => /\.js$/.test(f) && !OWN.includes(f)).map(f => 'js/' + f).concat(fs.readdirSync(path.join(ROOT, 'rjs')).filter(f => /\.js$/.test(f)).map(f => 'rjs/' + f));
ok(realJs.every(f => rd(f).indexOf('xcpets-practice') < 0 && rd(f).indexOf('XcpPractice') < 0), 'no real-game script reads practice data (rankings, feeds, replay never see practice pets)');
ok(!fs.existsSync(path.join(ROOT, 'js/v2-practice.js')), 'old stand-alone practice script removed');
const own = OWN.filter(f => f !== 'practice-guard.js').map(f => rd('js/' + f).replace(/\/\*[\s\S]*?\*\//g, '')).join('\n');
ok(!/\bsignPsbt|signTransaction|broadcast\w*\(|sendBeacon|WebSocket|EventSource/.test(own), 'practice code never signs, broadcasts or opens sockets');
ok(/sendBeacon/.test(guard) && !/sendBeacon\(/.test(guard.replace(/\/\*[\s\S]*?\*\//g, '')), 'guard switches off sendBeacon, never calls it');
ok(!/fetch\(\s*['"]https?:/.test(own), 'practice code fetches nothing outside the page');

/* 4 · copy rules on practice wording */
const copy = (OWN.map(f => rd('js/' + f)).join('\n') + css + rd('tools/build-practice-page.js')).replace(/\/\*[\s\S]*?\*\//g, ' ');
const txt = (copy.match(/'[^'\n]{12,}'/g) || []).join(' ');
ok(!/\b\d[\d,.]*\s?x\b|\bx\s?\d/.test(txt), "copy writes 'times', never 'x' for multiplying");
ok(!/series|discount|api\.xcp\.fun/i.test(copy), "no 'series', 'discount' or api.xcp.fun");

/* 5 · the pretend chain, run with the real rules in a vm */
const c = require('./lib/load-rules').load(); c.crypto = require('crypto').webcrypto; c.URL = URL;
const st = {}; c.__xcpPracticeStore = { get: k => (k in st ? st[k] : null), set: (k, v) => { st[k] = String(v); } };
vm.runInContext(eng, c); const X = c.XcpPractice, V = c.V2Rules;
ok(X && typeof X.burn === 'function' && typeof X.serve === 'function', 'XcpPractice exported');
ok(X.EGG_ODDS.map(e => e[0] + e[1]).join() === 'legendary40,rare30,uncommon18,common12', 'practice egg odds 40 / 30 / 18 / 12 percent');
X.load(); const s0 = X.state();
ok(s0.bal === X.START_BAL && s0.tip === X.START_TIP && s0.day === 1, 'fresh practice wallet: 1,000,000 pretend XCPETS, day 1');
const r1 = X.burn({ tag: 'pet:hatch', amount: 69 }), s1 = X.state();
ok(/^[0-9a-f]{64}$/.test(r1.txid) && r1.block === X.START_TIP + 1 && s1.bal === X.START_BAL - 69, 'a hatch burn mines one pretend block and costs 69 pretend XCPETS');
ok(s1.stats.hatched === 1 && s1.stats.legendary === 1 && s1.stats.wow === 1, 'the first practice egg is a Legendary with a showy trait');
const L = X.load(), w = X._replay(L.rows, L.tip), mine = w.pets.filter(p => p.owner === X.ME);
ok(mine.length === 1 && mine[0].tier === 3, 'the real replay sees the practice pet as a Legendary');
let leg = 0, bad = 0; const N = 30;
/* blockHash() is null above the practice tip. A null hash is not a rare-hatch seed, so this luck check uses its own 64-hex block hash. */
for (let i = 0; i < N; i++) { const b = 980000 + i, bh = crypto.createHash('sha256').update('practice-rare-hatch:' + b).digest('hex'), g = X._grindHatch(bh, b, false); if (!g) continue; if (g.art.tierIndex === 3) leg++;
  if (g.art.crown === 'flame-crown' || g.art.auraFire || g.art.edition || !X._okArt(g.art)) bad++; }
ok(leg >= 5, 'boosted eggs: ' + leg + ' of ' + N + ' Legendary (real eggs about 1)');
ok(bad === 0, 'never a flame crown, fire aura, edition or special egg');
ok(X.tidyArt({ crown: 'flame-crown', auraFire: 1, edition: 2, goldFrame: 1 }).crown === 'jeweled-crown', 'a rolled flame crown shows as a jeweled crown');
const t = X.tidyArt({ auraFire: 1, edition: 2, goldFrame: 1 }); ok(!t.auraFire && !t.edition && !t.goldFrame, 'no fire aura, edition or gold frame on practice pets');
const refuse = tag => { try { X.burn({ tag, amount: 69 }); return false; } catch (e) { return !!e.practice; } };
ok(refuse('pet:hatchzap') && refuse('pet:aura:1') && refuse('pet:deed:1') && refuse('pet:give:1:x') && refuse('pet:sell:1'), 'shock box, flame aura, trade, gift and sell burns refused in practice');
ok((() => { try { X.burn({ tag: 'pet:hatch', amount: 9e9 }); return false; } catch (e) { return /Refill/.test(e.message); } })(), 'over-spending asks for a free Refill');
const d0 = X.state().day; X.nextDay(); ok(X.state().day === d0 + 1, 'Next day skips one pretend day');
X.reset(); ok(X.state().rows >= 0 && X.state().stats.hatched === 0 && X.state().bal === X.START_BAL, 'Start over gives a fresh pretend wallet');
ok(Object.keys(st).every(k => /^xcpets-practice-/.test(k)), 'saved only under xcpets-practice-*: ' + Object.keys(st).join(','));
const core = X.serve('https://api.counterparty.io:4000/v2/blocks/last');
ok(core !== null, 'the pretend node answers Core URLs (nothing reaches the real API)');
ok(X.serve('https://node.xcpets.fun/v2/') !== null, 'the pretend node answers the mainnet read cache (practice stays offline)');

console.log('practice-mode-test: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
