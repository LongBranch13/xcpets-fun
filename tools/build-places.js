#!/usr/bin/env node
/* all-places (owner Oct 24 2026): writes the same header "🗺️ Places" menu (from js/v2-places.js) into every page with a <nav>, between
 * <!--places--> and <!--/places-->, and makes sure js/v2-places.js is loaded. Then rebuilds the game pages from templates/game.html.
 *   node tools/build-places.js            write      node tools/build-places.js --check   exit 1 if any page is out of date */
'use strict';
const fs = require('fs'), path = require('path'), ROOT = path.join(__dirname, '..'), P = require('../js/v2-places.js');
const SKIP = ['play.html', 'fight.html', 'rare-room.html', 'breed.html', 'raid.html', '404.html'];
const TAG = '<script src="js/v2-places.js?v=lm1123a" defer></script>';
function fix(s) { const M = '<!--places-->' + P.menu() + '<!--/places-->';
  s = /<!--places-->[\s\S]*?<!--\/places-->/.test(s) ? s.replace(/<!--places-->[\s\S]*?<!--\/places-->/, M) : s.replace(/(<a class="navplay"[^>]*>[\s\S]*?<\/a>|<nav>)/, '$1' + M);
  /* fewer-pages (Nov 22 2026): the how-to links now live in the Learn menu, so drop their old one-off copies from the header bar */
  s = s.replace(/<header[\s\S]*?<\/header>/, h => h.replace(/<!--\/places-->([\s\S]*?)<\/nav>/, (m, tail) => '<!--/places-->' + tail.replace(/<a href="(?:index\.html#cast|pets\.html|rules\.html|rules-short\.html|how-it-works\.html)"[^>]*>[\s\S]*?<\/a>/g, '') + '</nav>'));
  if (s.indexOf('js/v2-places.js') < 0) s = s.replace('</body>', TAG + '\n</body>'); return s; }
const files = fs.readdirSync(ROOT).filter(f => /\.html$/.test(f) && SKIP.indexOf(f) < 0).concat(['templates/game.html']);
const check = process.argv.includes('--check'); let bad = 0;
files.forEach(f => { const p = path.join(ROOT, f), s = fs.readFileSync(p, 'utf8'); if (!/<nav[\s>]/.test(s)) return; const o = fix(s);
  if (o !== s) { if (check) { bad++; console.log('OUT OF DATE: ' + f); } else { fs.writeFileSync(p, o); console.log('places menu: ' + f); } } });
if (check) { console.log(bad ? bad + ' page(s) out of date (run node tools/build-places.js)' : 'places menu: every page matches js/v2-places.js'); process.exit(bad ? 1 : 0); }
require('child_process').execFileSync(process.execPath, [path.join(__dirname, 'build-game-pages.js')], { stdio: 'inherit' });
