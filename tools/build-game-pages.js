#!/usr/bin/env node
/* species-ranks-split (owner Oct 24 2026): ONE source (templates/game.html) -> play.html, fight.html, rare-room.html, breed.html.
 * Each place page keeps only its own panel; play.html keeps hatch / My Pets / community / burns and a small "Places to go" card.
 * Same scripts and element ids everywhere, so every existing flow runs unchanged. No copies to keep in sync by hand.
 *   node tools/build-game-pages.js          write the four pages
 *   node tools/build-game-pages.js --check  exit 1 if any page differs from the template (used by tools/game-pages-test.js) */
'use strict';
const fs = require('fs'), path = require('path'), ROOT = path.join(__dirname, '..');
const PANELS = { fight: 'arenaPanel', rare: 'invPanel', breed: 'breedPanel', raid: 'raidPanel' };
const PAGES = {
  play: { file: 'play.html', nav: null, title: 'XCPETS: Play', desc: null },
  fight: { file: 'fight.html', nav: 'navfight', title: 'XCPETS: X Circus Kekimus', desc: 'Battle your 8-bit XCPETS pets on the sand of X Circus Kekimus. Every fight is a Counterparty burn.' },
  rare: { file: 'rare-room.html', nav: 'navrare', title: 'XCPETS: The Rare Room', desc: 'The Rare Room: your gear, framed. Try on the drip, equip your pets and spin the Pepe Wheel to roll new gear.' },
  raid: { file: 'raid.html', nav: 'navraid', title: 'XCPETS: Raid Boss', desc: 'Raid the boss with your XCPETS pets. Every attack is a Counterparty burn; if the boss falls, every attacker is rewarded.' },
  breed: { file: 'breed.html', nav: 'navbreed', title: 'XCPETS: Gooby\u2019s No-Tail Motel', desc: 'Check in two XCPETS pets at Gooby\u2019s No-Tail Motel and breed an egg. Every stay is a Counterparty burn.' }
};
/* park <section id=ID> on a page that is not its place: kept in the DOM (v2.js wires its buttons at load, so removing it
 * throws and stops the page init) but hidden with .split-off. Was: cut <section ... id="ID">...</section> (nested sections counted) */
function cut(s, id) { const m = new RegExp('<section[^>]*\\bid="' + id + '"').exec(s); if (!m) throw new Error('no section ' + id);
  const re = /<section\b|<\/section>/g; re.lastIndex = m.index + 1; let d = 1, x; while ((x = re.exec(s))) { d += x[0] === '</section>' ? -1 : 1; if (!d) break; }
  if (!x) throw new Error('unclosed ' + id); return s.slice(0, m.index) + s.slice(re.lastIndex); }
function park(s, id) { const re = new RegExp('<section([^>]*)\\bid="' + id + '"'); if (!re.test(s)) throw new Error('no section ' + id);
  return s.replace(re, (a, b) => /class="/.test(b) ? a.replace('class="', 'class="split-off ') : a.replace('<section', '<section class="split-off"')).replace(new RegExp('(<section[^>]*\\bid="' + id + '")'), '$1 hidden aria-hidden="true"'); }
function attr(s, sel, val) { return s.replace(new RegExp('(<meta (?:name|property)="' + sel + '" content=")[^"]*"'), (a, b) => b + val.replace(/"/g, '&quot;') + '"'); }
function build(mode) { const P = PAGES[mode]; let s = fs.readFileSync(path.join(ROOT, 'templates/game.html'), 'utf8').replace(/^<!--[^\n]*-->\n/, '');
  s = s.replace('data-split="@MODE@"', 'data-split="' + mode + '"');
  Object.keys(PANELS).forEach(k => { if (k !== mode) s = park(s, PANELS[k]); });
  if (mode === 'play') return s;
  s = park(s, 'splitGo');
  s = s.replace(new RegExp('(<section class="[^"]*)("[^>]*\\bid="' + PANELS[mode] + '")'), '$1 split-main$2');
  s = s.replace(/<title>[^<]*<\/title>/, '<title>' + P.title + '</title>');
  ['og:title', 'twitter:title'].forEach(k => { s = attr(s, k, P.title); }); ['description', 'og:description', 'twitter:description'].forEach(k => { s = attr(s, k, P.desc); });
  s = attr(s, 'og:url', 'https://xcpets.fun/' + P.file);
  s = s.replace('<nav>', '<nav><a class="navplay" href="play.html"><span class="navegg" aria-hidden="true"></span>Play</a>');
  s = s.replace('<a class="' + P.nav + '" ', '<a class="' + P.nav + '" aria-current="page" ');
  return s; }
const check = process.argv.includes('--check'); let bad = 0;
Object.keys(PAGES).forEach(m => { const f = path.join(ROOT, PAGES[m].file), out = build(m);
  if (check) { const cur = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : ''; if (cur !== out) { bad++; console.log('OUT OF DATE: ' + PAGES[m].file + ' (run node tools/build-game-pages.js)'); } }
  else { fs.writeFileSync(f, out); console.log('wrote ' + PAGES[m].file); } });
if (check) { console.log(bad ? 'game pages: ' + bad + ' out of date' : 'game pages: all ' + Object.keys(PAGES).length + ' match templates/game.html'); process.exit(bad ? 1 : 0); }
module.exports = { build, PAGES };
