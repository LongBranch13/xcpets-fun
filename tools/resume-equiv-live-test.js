#!/usr/bin/env node
/* The live-burn-list part of resume-equiv-test.js (api/boot.json): the full list.
 * The half-way split, the three-blocks-back split and tip-only are resume-equiv-half-test.js, resume-equiv-back-test.js and resume-equiv-tip-test.js.
 * Each part replays the whole game a few times; together they ran past the suite's 600 s per-test limit. The snap-fixture half is XP_SNAP_ONLY=1 resume-equiv-test.js,
 * which is what the suite runs for that file; nothing is skipped, the work is split in two.
 *   node tools/resume-equiv-live-test.js */
'use strict';
const cp = require('child_process'), path = require('path');
const r = cp.spawnSync(process.execPath, [path.join(__dirname, 'resume-equiv-test.js')],
  { stdio: 'inherit', env: Object.assign({}, process.env, { XP_LIVE_ONLY: process.env.XP_PART || 'a' }) });
process.exit(r.status == null ? 1 : r.status);
