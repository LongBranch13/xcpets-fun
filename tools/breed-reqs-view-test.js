#!/usr/bin/env node
/* Gooby's requests on fast-loaded pages (Nov 23 2026): the slim summary carries the open breed requests, and the page's slim world uses them. */
'use strict';
const fs = require('fs'), path = require('path');
const S = require('./sync-server/split');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('ok   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const w = { breedReqs: [
  { a: 1, b: 2, block: 1000, tx: 't1', owner: 'x' },
  { a: 3, b: 4, block: 900, tx: 't2', owner: 'y', used: true },
  { a: 5, b: 6, block: 700, tx: 't3', owner: 'z' }] };
const live = S.liveBreedReqs(w, 1100);
ok(live.length === 1 && live[0].tx === 't1' && live[0].owner === 'x' && live[0].b === 2, 'open request inside the window is kept, used and old ones dropped');
ok(S.liveBreedReqs({}, 5).length === 0, 'no requests: empty list');
const src = fs.readFileSync(path.join(__dirname, '../js/v2-split.js'), 'utf8');
ok(/breedReqs: \(\(pack && pack\.breedReqs\) \|\| summary\.breedReqs \|\| \[\]\)/.test(src), 'assemble() fills breedReqs from the worker, else the summary');
ok(/viewHold\.breedReqs = m\.breedReqs/.test(src), 'burn check results refresh the requests');
const vw = fs.readFileSync(path.join(__dirname, '../js/v2-verify-worker.js'), 'utf8');
ok(/breedReqs: last \? \(self\._reqs/.test(vw), 'verify worker sends the open requests');
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
