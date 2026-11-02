#!/usr/bin/env node
/* nav-cache-1102: page-to-page speed without changing what is read or replayed.
 *   node tools/nav-cache-test.js   (pure + source checks, no network)
 * mergeRows (only new burns are read): the merged list must be exactly what a full read gives, and anything unusual must fall back to the
 * full read (null). Plus source checks: prerendered pages write nothing and start no chain reads until opened, and copies never count as verified. */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), src = fs.readFileSync(path.join(ROOT, 'js/v2-chain.js'), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const body = src.match(/function mergeRows\(j, base, baseTip\) \{[\s\S]*?return out; \}/)[0];
const mergeRows = new Function('INC_DEPTH', 'INC_OVERLAP', body + '; return mergeRows;')(6, 20);
const boot = JSON.parse(fs.readFileSync(path.join(ROOT, 'api/boot.json'), 'utf8'));
const full = boot.rows.slice(), tip = boot.tip, C = x => JSON.parse(JSON.stringify(x));
ok(full.length > 1000, 'fixture: api/boot.json has more than one page of burns (' + full.length + ')');
for (let k = 1; k < full.length; k++) if (full[k].block_index > full[k - 1].block_index) { ok(false, 'fixture rows newest first'); break; }
const page = (rows, n) => ({ result: C(rows.slice(0, 1000)), next_cursor: rows.length > 1000 ? 12345 : null, result_count: n == null ? rows.length : n });
const nb = (b, i) => ({ tx_index: 9000000 + i, tx_hash: 'f'.repeat(60) + String(1000 + i), block_index: b, source: 'bc1qnew' + i, asset: 'XCPETS', quantity: 100000000000 + i, tag: '78637065747321', status: 'valid' });
/* 1. nothing new: same list */
let m = mergeRows(page(full), full, tip); ok(m && JSON.stringify(m) === JSON.stringify(full), 'no new burns -> exactly the full list');
/* 2. three new burns in two new blocks */
let fresh = [nb(tip + 2, 1), nb(tip + 2, 2), nb(tip + 1, 3)].concat(full);
m = mergeRows(page(fresh), full, tip); ok(m && JSON.stringify(m) === JSON.stringify(fresh), 'new burns on top -> same as a full read');
/* 3. without result_count still fine */
let p3 = page(fresh); delete p3.result_count; m = mergeRows(p3, full, tip); ok(m && JSON.stringify(m) === JSON.stringify(fresh), 'no result_count -> same as a full read');
/* 4. a burn within the last 6 blocks changed (reorg): taken from the node, not the copy */
const shallowIdx = full.findIndex(x => x.block_index > tip - 6);
if (shallowIdx >= 0) { const re = C(full); re[shallowIdx].status = 'invalid: reorged'; m = mergeRows(page(re), full, tip); ok(m && JSON.stringify(m) === JSON.stringify(re), 'a change within 6 blocks of the tip comes from the node'); }
else { const re = C(full); re.unshift(nb(tip - 2, 9)); const base = full; m = mergeRows(page(re), base, tip); ok(m && JSON.stringify(m) === JSON.stringify(re), 'a burn appearing within 6 blocks of the old tip comes from the node'); }
/* 5. an older burn changed (deeper than 6 blocks, inside page 1) -> full read */
const deepIdx = full.findIndex(x => x.block_index <= tip - 6) + 3; let ch = C(full); ch[deepIdx].quantity += 1; ok(mergeRows(page(ch), full, tip) === null, 'an older burn differs -> full read');
/* 6. an older burn missing / extra -> full read */
ch = C(full); ch.splice(deepIdx, 1); ok(mergeRows(page(ch), full, tip) === null, 'an older burn missing -> full read');
ch = C(full); ch.splice(deepIdx, 0, nb(full[deepIdx].block_index, 7)); ok(mergeRows(page(ch), full, tip) === null, 'an extra older burn -> full read');
/* 7. a change beyond page 1 shows in result_count -> full read */
ch = C(full); ch.splice(2500, 1); ok(mergeRows(page(ch), full, tip) === null, 'a burn missing beyond page 1 -> full read (count differs)');
/* 8. page 1 is the whole list (no next_cursor) -> null (the page itself is the full read) */
ok(mergeRows({ result: C(full.slice(0, 500)), next_cursor: null }, full.slice(0, 500), tip) === null, 'single page -> handled as a full read');
/* 9. too many new burns: page 1 doesn't reach 20 rows below the copy -> full read */
fresh = []; for (let i = 0; i < 990; i++) fresh.push(nb(tip + 1 + Math.floor((990 - i) / 10), i)); fresh = fresh.concat(full);
ok(mergeRows(page(fresh), full, tip) === null, 'more than ~980 new burns -> full read');
/* 10. order / bad input */
ch = C(full); const t = ch[deepIdx]; ch[deepIdx] = ch[deepIdx + 1]; ch[deepIdx + 1] = t; ok(mergeRows(page(ch), full, tip) === null, 'same burns in a different order -> full read');
ok(mergeRows(page(full), [], tip) === null && mergeRows(page(full), full, 0) === null && mergeRows(null, full, tip) === null && mergeRows({ result: [] , next_cursor: 1 }, full, tip) === null, 'empty or bad input -> full read');
/* 11. field shape differs (e.g. a node adds a field) -> full read */
ch = C(full).map(x => Object.assign({}, x, { block_time: 1 })); ok(mergeRows(page(ch), full, tip) === null, 'rows with other fields -> full read');
/* source checks */
ok(/function readRows\(chain\)[\s\S]*?now - S\.fullAt < INC_MS/.test(src) && /INC_MS = 30 \* 60e3/.test(src), 'only a copy from a full read under 30 min old is a base');
ok(/function readRows\(chain\)[\s\S]*?seen\[jj\.next_cursor\]\) throw/.test(src), 'full read keeps the repeated-cursor stop');
ok(/S\.fullAt = fullAt; S\.verified = true;/.test(src) && /function applyStale[\s\S]*?S\.verified = false; S\.stale = true;/.test(src), 'copies never count as verified; a read sets verified');
ok(/function bootShow[\s\S]*?pre\(\) && \(cache \|\| \(S\.provisional && lastW\)\)[\s\S]*?held = true; wkBusy\+\+/.test(src), 'prerender: provisional world held (no main-thread replay)');
ok(/function bootStale\(st, then\) \{ bootShow\(st, then, function \(\) \{ setTimeout\(function \(\) \{ revalidate\(0\); \}, 50\); \}\); \}/.test(src) && /whenOpen\(function \(\) \{ \(cache \? Promise/.test(src), 'prerender: re-read / replay wait until opened');
ok(/LAST_NOW = 5 \* 60e3/.test(src) && /last\.build === BUILD && age >= 0 && age <= LAST_NOW && applyStale\(last, null\)/.test(src), 'saved copy shown at once only same build, under 5 min, as a stale copy');
const pages = fs.readdirSync(ROOT).filter(f => /\.html$/.test(f) && !/^practice/.test(f)).concat(['templates/game.html']);
fs.readdirSync(ROOT).filter(f => /^practice.*\.html$/.test(f)).forEach(f => { const h = fs.readFileSync(path.join(ROOT, f), 'utf8'); ok(h.indexOf('nav-cache-1102') < 0 && h.indexOf('speculationrules') < 0, f + ': practice page has no prerender guard or rules (never prerendered)'); });
pages.forEach(f => { const h = fs.readFileSync(path.join(ROOT, f), 'utf8');
  ok((h.match(/<!--nav-cache-1102--><script>/g) || []).length === 1 && h.indexOf('<!--nav-cache-1102-->') < h.indexOf('<script', h.indexOf('<!--nav-cache-1102-->') + 30) + 1, f + ': prerender guard first in <head>');
  ok(/<script type="speculationrules">\{"prerender":\[\{"where":\{"and":\[\{"href_matches":"\/\*"\}[\s\S]*?a\[href\*='fresh='\], a\[href\*='addr='\][\s\S]*?a\[href\*='practice'\][\s\S]*?"eagerness":"moderate"/.test(h), f + ': same-site .html links only, moderate, no fresh=/addr= links');
  if (/__xcpPre/.test(h)) ok(/try\{if\(document\.prerendering\|\|/.test(h), f + ': head chain reads skipped while prerendered');
  ok(h.indexOf('<!--nav-cache-1102-->') < h.indexOf('<script src='), f + ': guard runs before any page script'); });
const ch2 = fs.readFileSync(path.join(ROOT, 'rjs/chain.js'), 'utf8');
ok(/HEDGE_MS = 1200/.test(ch2) && /PRIMARY_MS = 4000/.test(ch2) && /BACKUP_MS = 3000/.test(ch2), 'failover: backup races after 1.2 s, timeouts per node unchanged');
ok(!/api\.xcp\.fun/.test(src.slice(src.indexOf('function readRows'), src.indexOf('function load('))), 'new reads never use api.xcp.fun');
console.log('nav-cache: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
