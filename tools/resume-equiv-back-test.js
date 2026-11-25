#!/usr/bin/env node
/* Part of resume-equiv-test.js on the live burn list (api/boot.json): the three-blocks-back split of the live burn list.
 * Split out of resume-equiv-live-test.js so each part fits the suite's 600 s per-test limit.
 *   node tools/resume-equiv-back-test.js */
'use strict';
const cp = require('child_process'), path = require('path');
const r = cp.spawnSync(process.execPath, [path.join(__dirname, 'resume-equiv-test.js')],
  { stdio: 'inherit', env: Object.assign({}, process.env, { XP_LIVE_ONLY: 'back' }) });
process.exit(r.status == null ? 1 : r.status);
