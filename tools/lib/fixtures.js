#!/usr/bin/env node
/* Test fixtures for a fresh checkout (dev tooling only).
 * tools/fixtures/burns-972901.json.gz is one public burn snapshot { tip, rows, hashes } (on-chain XCPETS burns + block hashes,
 * nothing private). Every named snapshot the tests read (snap-<block>.json, snap-now.json, snap-fresh-v2.json) is that file cut at
 * the snapshot's tip: rows and hashes with block <= tip. That reproduces the dev snapshots byte for byte (checked 2026-10-24).
 * ensure() writes any missing ones into tools/snapshots/ (gitignored); it never overwrites a snapshot you already have.
 *   node tools/lib/fixtures.js        -> writes the missing snapshots and lists them */
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const ROOT = path.resolve(__dirname, '..', '..'), DIR = path.join(ROOT, 'tools', 'snapshots'), FIX = path.join(ROOT, 'tools', 'fixtures', 'burns-972901.json.gz');
const ALIAS = { 'snap-now.json': 972634, 'snap-fresh-v2.json': 972555 };
const NEEDED = ['snap-971786.json', 'snap-972550.json', 'snap-972561.json', 'snap-972634.json', 'snap-972877.json', 'snap-972883.json', 'snap-972901.json', 'snap-now.json', 'snap-fresh-v2.json'];
let big = null;
function cut(tip) {
  big = big || JSON.parse(zlib.gunzipSync(fs.readFileSync(FIX)).toString('utf8'));
  const hashes = {}; Object.keys(big.hashes).forEach(k => { if (+k <= tip) hashes[k] = big.hashes[k]; });
  return { tip, rows: big.rows.filter(r => r.block_index <= tip), hashes };
}
function tipOf(name) { if (ALIAS[name]) return ALIAS[name]; const m = /^snap-(\d+)\.json$/.exec(name); return m ? +m[1] : null; }
function ensure(names) {
  fs.mkdirSync(DIR, { recursive: true }); const made = [];
  (names || NEEDED).forEach(n => { const p = path.join(DIR, n), t = tipOf(n); if (fs.existsSync(p) || t == null || t > 972901) return; fs.writeFileSync(p, JSON.stringify(cut(t))); made.push(n); });
  return made;
}
module.exports = { ensure, cut, NEEDED, DIR };
if (require.main === module) { const m = ensure(); console.log(m.length ? 'fixtures: wrote ' + m.join(', ') : 'fixtures: all snapshots present'); }
