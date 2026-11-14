#!/usr/bin/env node
/* Builds practice.html from play.html (practice-fun-1102). Practice is the REAL play page (same screens, rules, renderer and reveal) with:
 *  - js/practice-guard.js first (storage prefix 'xcpets-practice-', fetch answered by the pretend node, no IndexedDB / Worker),
 *  - js/practice-engine.js (the pretend chain + boosted luck), js/v2-practice-wallet.js after js/v2-wallet.js (pretend, free burns),
 *  - the real-chain extras left out (prefetch, block-hash seed, cached game feed, Casa connect, address viewer, Electric Eggs, community feed),
 *  - a PRACTICE bar (pretend balance, Grow a day, Next day, Refill, Reset practice pet) and "Hatch a real pet" / "Play for real".
 * It also builds practice-fight.html, practice-rare.html and practice-breed.html from the other game places (same template),
 * and practice-pet.html from pet.html (the real pet page over the same pretend ledger).
 * Usage: node tools/build-practice-page.js          (writes practice.html and practice-pet.html)
 *        node tools/build-practice-page.js --check  (exit 1 if either file is not what play.html / pet.html build) */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const B = () => (fs.readFileSync(path.join(ROOT, 'build-id.txt'), 'utf8').trim() || 'dev');
function common(src) { let h = fs.readFileSync(path.join(ROOT, src), 'utf8'); h = h.replace(/<script src="js\/v2-resume\.js\?v=[^"]*"><\/script>/g, ''); h = h.replace(/<script src="js\/v2-boot-sync\.js\?v=[^"]*"><\/script>/g, ''); h = h.replace(/<!--nav-cache-1102-->[\s\S]*?<!--nav-cache-1102-->/, ''); h = h.replace(/<!--err-report-1102-->[\s\S]*?<!--err-report-1102-->/, ''); h = h.replace(/<!--mypets-snap-1103-->[\s\S]*?<!--mypets-snap-1103-->/, ''); /* site-speed-1103: no saved My Pets view on practice pages */ /* safeguards-1102: practice pages send nothing anywhere (practice-guard refuses outside hosts), so no page-error reporter */ /* nav-cache-1102: practice pages are never prerendered (links to them are left out), so no prerender guard here */ const b = B();
  const must = (re, what) => { if (!re.test(h)) throw new Error('build-practice-page: ' + src + ' changed, cannot find ' + what); };
  const sub = (re, to, what) => { must(re, what); h = h.replace(re, to); };
  h = h.replace(/<link rel="preconnect" href="https:\/\/api\.counterparty\.io[^>]*>/g, '').replace(/<link rel="prefetch"[^>]*>/g, '');
  sub(/<script>\/\* smooth-perf:[\s\S]*?<\/script>/, '', 'smooth-perf prefetch');
  sub(/<meta charset="utf-8">/, '<meta charset="utf-8"><script src="js/practice-guard.js?v=' + b + '"></script><script src="js/practice-engine.js?v=' + b + '"></script>', 'charset');
  sub(/(<link rel="stylesheet" href="css\/v2\.css\?v=[^"]*">)/, '$1<link rel="stylesheet" href="css/practice.css?v=' + b + '">', 'v2.css');
  sub(/(<script src="js\/v2-wallet\.js\?v=[^"]*"><\/script>)/, '$1<script src="js/v2-practice-wallet.js?v=' + b + '"></script>', 'v2-wallet.js');
  sub(/(<script src="js\/v2-rules\.js\?v=[^"]*"><\/script>)/, '$1<script>XcpPractice.wrapRules(window.V2Rules);</script>', 'v2-rules.js');
  ['block-hashes', 'v2-cached', 'casa-connect', 'doom-gear'].forEach(n => sub(new RegExp('<script src="js/' + n + '\\.js\\?v=[^"]*"( defer)?><\\/script>'), '', n + '.js'));
  h = h.replace(/<script src="js\/doom-week\.js\?v=[^"]*"( defer)?><\/script>/g, ''); /* speed-phase0: doom-week is fetched by v2-events.js only while the week is on */
  sub(/<\/body>/, '<script src="js/practice-ui.js?v=' + b + '" defer></script></body>', '</body>');
  sub(/<nav>[\s\S]*?<\/nav>/, PXNAV, 'nav');
  sub(/(<\/header><div class="pixdiv" aria-hidden="true"><\/div>)/, '$1\n' + BAR, 'header end');
  return { get: () => h, set: v => { h = v; }, sub, must }; }
function buildPet() { const c = common('pet.html'), sub = c.sub;
  sub(/<title>[^<]*<\/title>/, '<title>XCPETS: Practice pet (pretend)</title><meta name="robots" content="noindex">', 'title');
  sub(/<body data-v2page="pet">/, '<body data-v2page="pet" data-practice="1" class="practice">', 'body');
  sub(/<a href="play\.html" id="petBack">← Back to the game<\/a>/, '<a href="practice.html" id="petBack">← Back to practice</a>', 'petBack');
  sub(/Live chain data\./, 'PRACTICE: a pretend pet that lives only in this browser. Nothing is sent to Bitcoin or Counterparty. <a href="play.html" data-real="1"><b>Play for real</b></a>.', 'footer');
  sub(/<script>\/\* pet token \(verified asset\)[\s\S]*?<\/script>/, '', 'pet token script');
  return c.get(); }
function build(src, title) {
  let h = fs.readFileSync(path.join(ROOT, src || 'play.html'), 'utf8'); h = h.replace(/<script src="js\/v2-resume\.js\?v=[^"]*"><\/script>/g, ''); h = h.replace(/<script src="js\/v2-boot-sync\.js\?v=[^"]*"><\/script>/g, ''); h = h.replace(/<!--nav-cache-1102-->[\s\S]*?<!--nav-cache-1102-->/, ''); h = h.replace(/<!--err-report-1102-->[\s\S]*?<!--err-report-1102-->/, ''); h = h.replace(/<!--mypets-snap-1103-->[\s\S]*?<!--mypets-snap-1103-->/, ''); /* site-speed-1103: no saved My Pets view on practice pages */ /* safeguards-1102: practice pages send nothing anywhere (practice-guard refuses outside hosts), so no page-error reporter */ /* nav-cache-1102: practice pages are never prerendered (links to them are left out), so no prerender guard here */
  const B = (fs.readFileSync(path.join(ROOT, 'build-id.txt'), 'utf8').trim() || 'dev');
  const must = (re, what) => { if (!re.test(h)) throw new Error('build-practice-page: ' + (src || 'play.html') + ' changed, cannot find ' + what); };
  const sub = (re, to, what) => { must(re, what); h = h.replace(re, to); };
  /* head */
  sub(/<title>[^<]*<\/title>/, '<title>XCPETS: Practice' + (title ? ' · ' + title : '') + ' (pretend burns, free)</title><meta name="robots" content="noindex">', 'title');
  h = h.replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="Practice XCPETS for free: hatch, feed, gear up, fight and breed with pretend burns. Nothing goes on chain.">');
  h = h.replace(/<link rel="preconnect" href="https:\/\/api\.counterparty\.io[^>]*>/g, '');
  sub(/<script>\/\* smooth-perf:[\s\S]*?<\/script>/, '', 'smooth-perf prefetch');
  h = h.replace(/<link rel="prefetch"[^>]*>/g, '');
  sub(/<meta charset="utf-8">/, '<meta charset="utf-8"><script src="js/practice-guard.js?v=' + B + '"></script><script src="js/practice-engine.js?v=' + B + '"></script>', 'charset');
  sub(/(<link rel="stylesheet" href="css\/v2\.css\?v=[^"]*">)/, '$1<link rel="stylesheet" href="css/practice.css?v=' + B + '">', 'v2.css');
  sub(/<body class="/, '<body data-practice="1" class="practice ', 'body');
  /* scripts */
  sub(/(<script src="js\/v2-wallet\.js\?v=[^"]*"><\/script>)/, '$1<script src="js/v2-practice-wallet.js?v=' + B + '"></script>', 'v2-wallet.js');
  sub(/(<script src="js\/v2-rules\.js\?v=[^"]*"><\/script>)/, '$1<script>XcpPractice.wrapRules(window.V2Rules);</script>', 'v2-rules.js');
  ['block-hashes', 'v2-cached', 'casa-connect', 'doom-gear'].forEach(n => sub(new RegExp('<script src="js/' + n + '\\.js\\?v=[^"]*"( defer)?><\\/script>'), '', n + '.js'));
  h = h.replace(/<script src="js\/doom-week\.js\?v=[^"]*"( defer)?><\/script>/g, ''); /* speed-phase0: doom-week is fetched by v2-events.js only while the week is on */
  sub(/<\/body>/, '<script src="js/practice-ui.js?v=' + B + '" defer></script></body>', '</body>');
  /* header nav: practice stays on this page; the rest of the site is the real game */
  sub(/<nav>[\s\S]*?<\/nav>/, PXNAV, 'nav');
  /* the PRACTICE bar, right under the header */
  sub(/(<\/header><div class="pixdiv" aria-hidden="true"><\/div>)/, '$1\n' + BAR, 'header end');
  /* real-chain only panels */
  sub(/<section class="panel compact" id="communityPanel">/, '<section class="panel compact" id="communityPanel" hidden style="display:none">', 'communityPanel');
  sub(/<section class="panel" id="counter">/, '<section class="panel" id="counter" hidden style="display:none">', 'counter');
  sub(/<form class="addrview" id="addrView"/, '<form class="addrview" id="addrView" hidden style="display:none"', 'addrView');
  sub(/Your <span class="asset">XCPETS<\/span> \(on-chain\)/, 'Practice <span class="asset">XCPETS</span> (pretend)', 'balance label');
  sub(/(<p class="small zap-odds" id="zapOdds")/, '<p class="small px-odds" id="pxOdds">🍀 <b>Practice luck:</b> Legendary 40% · Rare 30% · Uncommon 18% · Common 12%. Most practice Legendaries also get laser eyes, a galaxy or rainbow skin, or an aurora or cosmic sky, and your first egg is always a Legendary. Real eggs: 3% · 10% · 27% · 60%.</p>$1 hidden style="display:none"', 'zapOdds');
  sub(/(<section class="panel" id="hatchPanel">[\s\S]*?<\/section>)/, '$1\n' + CTA, 'hatchPanel');
  sub(/Every pet is rebuilt from real <span class="asset">XCPETS<\/span> burns on Bitcoin \(Counterparty\)\./, 'PRACTICE: every burn here is pretend and stays in this browser. Nothing is sent to Bitcoin or Counterparty, and practice pets never show in the real rankings. <a href="play.html" data-real="1"><b>Play for real</b></a>.', 'footer');
  sub(/<p class="risk-short risk-sign">[^<]*<\/p>/, '<p class="risk-short risk-sign px-sign">🧪 Practice burn: free and pretend. Nothing is signed, nothing goes on chain, and the pet stays in this browser. Real burns are permanent.</p>', 'risk-sign');
  sub(/<p class="risk">[^<]*<\/p>/, '<p class="risk">Practice luck is much higher than the real game. Real burns are irreversible: you can lose XCPETS and Bitcoin transaction fees. Use at your own risk.</p>', 'risk');
  return h;
}
const PXNAV = '<nav class="px-nav" aria-label="Practice places"><a href="practice.html">🥚 Hatch</a><a href="practice-fight.html">⚔️ Fight</a><a href="practice-rare.html">💎 Gear</a><a href="practice-breed.html">💞 Breed</a><a class="btn px-real px-hatch" href="play.html?connect=1#hatchPanel">Hatch a real pet</a><a class="btn px-real" href="play.html">▶ Play for real</a></nav>';
const BAR = '<div class="px-bar" id="pxBar" role="region" aria-label="Practice mode"><span class="px-badge">PRACTICE</span><span class="px-txt">Pretend burns, free. Nothing goes on chain. <b>Day <span id="pxDay">1</span></b> · <span id="pxBal">…</span> pretend <span class="asset">XCPETS</span></span>'
  + '<span class="px-btns"><button type="button" class="btn px-grow" id="pxGrow" title="Feed every hungry pet one meal, then skip to the next chain day">🍽️ Grow a day</button><button type="button" class="q" id="pxDayBtn" title="Skip 144 pretend blocks">⏭️ Next day</button><button type="button" class="q" id="pxRefill">💰 Refill</button><button type="button" class="q" id="pxReset" title="Clears only the practice pet in this browser. Real pets are not touched.">↺ Reset practice pet</button><a class="btn px-real px-hatch" href="play.html?connect=1#hatchPanel">Hatch a real pet</a><a class="btn px-real" href="play.html">▶ Play for real</a></span><span class="px-msg small" id="pxMsg" aria-live="polite"></span></div>';
const CTA = '  <section class="panel px-cta" id="pxCta"><h2 class="sec" data-ico="egg">Ready for a real pet?</h2><p>This practice pet stays in this browser. It is never sent on chain, never listed, and never counted with real pets. Connect your wallet, then hatch a real one.</p><p class="px-cta-row"><a class="btn px-real px-hatch big" id="pxHatchReal" href="play.html?connect=1#hatchPanel">Hatch a real pet</a> <a class="btn ghost" href="rules-short.html">Short rules</a></p><p class="small muted" id="pxStats"></p></section>';
/* the game places are separate pages built from one template (tools/build-game-pages.js); each gets a practice copy */
const OUT = [['practice.html', build('play.html')], ['practice-fight.html', build('fight.html', 'X Circus Kekimus')], ['practice-rare.html', build('rare-room.html', 'The Rare Room')],
  ['practice-breed.html', build('breed.html', 'No-Tail Motel')], ['practice-pet.html', buildPet()]];
let bad = 0;
OUT.forEach(([name, out]) => { const file = path.join(ROOT, name);
  if (process.argv.includes('--check')) { const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''; if (cur !== out) { console.error(name + ' is out of date: run node tools/build-practice-page.js'); bad = 1; } else console.log(name + ' is up to date'); }
  else { fs.writeFileSync(file, out); console.log('wrote ' + name + ' (' + out.length + ' bytes)'); } });
if (bad) process.exit(1);
