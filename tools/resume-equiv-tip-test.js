#!/usr/bin/env node
/* Part of resume-equiv-test.js on the live burn list (api/boot.json): tip-only: a checkpoint at the live tip resumed one block later.
 * Split out of resume-equiv-live-test.js so each part fits the suite's 600 s per-test limit.
 *   node tools/resume-equiv-tip-test.js */
'use strict';
const cp = require('child_process'), path = require('path');
const r = cp.spawnSync(process.execPath, [path.join(__dirname, 'resume-equiv-test.js')],
  { stdio: 'inherit', env: Object.assign({}, process.env, { XP_LIVE_ONLY: 'tip' }) });
process.exit(r.status == null ? 1 : r.status);
