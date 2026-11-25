#!/usr/bin/env node
/* The live-burn-list half of resume-equiv-test.js (api/boot.json: full list, splits, tip-only).
 * It is its own test file because each half replays the whole game several times and the two together
 * ran past the suite's 600 s per-test limit. The snap-fixture half is XP_SNAP_ONLY=1 resume-equiv-test.js,
 * which is what the suite runs for that file; nothing is skipped, the work is split in two.
 *   node tools/resume-equiv-live-test.js */
'use strict';
const cp = require('child_process'), path = require('path');
const r = cp.spawnSync(process.execPath, [path.join(__dirname, 'resume-equiv-test.js')],
  { stdio: 'inherit', env: Object.assign({}, process.env, { XP_LIVE_ONLY: '1' }) });
process.exit(r.status == null ? 1 : r.status);
