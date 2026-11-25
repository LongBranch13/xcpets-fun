#!/usr/bin/env node
/* Part of places-perf-test.js: reduced motion, the origin/main scripts baseline and Spam City.
 * Split out because each browser context replays the whole feed cold, and all of them in one file passed 600 s on CI.
 *   node tools/places-perf-calm-test.js      (PLACES_PART=all node tools/places-perf-test.js runs every part) */
'use strict';
const cp = require('child_process'), path = require('path');
const r = cp.spawnSync(process.execPath, [path.join(__dirname, 'places-perf-test.js')],
  { stdio: 'inherit', env: Object.assign({}, process.env, { PLACES_PART: 'calm' }) });
process.exit(r.status == null ? 1 : r.status);
