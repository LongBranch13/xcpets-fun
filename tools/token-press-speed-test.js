// token-press-speed-1104: static checks that the Token Press list paints in slices
// (no ~1 s freeze) and that an early Town bar station click does not reload the shop.
'use strict';
const fs = require('fs'), path = require('path');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const sales = R('js/v2-sales.js'), scene = R('js/v2-shop-scene.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
ok(/var paintQ = \[\], paintOn = false;/.test(sales), 'paint queue exists');
ok(/function paintRun\(\)[\s\S]{0,200}Date\.now\(\) - t0 < 10/.test(sales), 'paintRun is time-sliced (~10 ms)');
ok(/paintQ\.push\(\{ ?c/.test(sales), 'paint() queues sprites instead of drawing them inline');
ok(/isConnected/.test(sales), 'paintRun skips canvases removed from the page');
ok(/#townBar \.tb-st a\[href\^="shop\.html#"\]/.test(sales), 'early Town bar station click is intercepted');
ok(/preventDefault\(\)[\s\S]{0,400}history\.replaceState\(null, ?'', ?'#' ?\+ ?tk\)/.test(sales), 'early station click sets the hash without reloading');
ok(/id === 'press'[\s\S]{0,120}history\.replaceState\(null, ?'', ?'#press'\)/.test(scene), 'press chip before ready queues #press');
console.log('token-press-speed-test: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
