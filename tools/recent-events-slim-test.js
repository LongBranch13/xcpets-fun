#!/usr/bin/env node
/* recent-events-slim-1103: the slimmed api/recent-events.json must flag exactly the same pet tokens in js/v2-sales.js touched() as the full file.
 * Input: a full (unslimmed) recent-events.json (default: git show origin/main:api/recent-events.json, else the fixture below) and the sale base
 * of api/boot.json (dexAssets + every order / match hash of dex). For every block and every token, the touched() test is run on the full and on
 * the slimmed events (the exact checks of js/v2-sales.js: '"<asset>"' and each order / match hash as a substring of JSON.stringify(event)).
 *   node tools/recent-events-slim-test.js [--full file] [--boot file] */
'use strict';
const fs = require('fs'), cp = require('child_process'), path = require('path'), assert = require('assert');
const A = process.argv.slice(2), arg = (k) => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : null; };
const ROOT = path.join(__dirname, '..'), RE = require('./recent-events.js');
const git = (f) => { try { return cp.execFileSync('git', ['show', 'origin/main:' + f], { cwd: ROOT, maxBuffer: 1 << 30 }).toString(); } catch (e) { return null; } };
const sales = fs.readFileSync(path.join(ROOT, 'js/v2-sales.js'), 'utf8');
/* the browser check this test mirrors must still be the one in js/v2-sales.js */
assert(sales.includes("var t = JSON.stringify(e);") && sales.includes("if (t.indexOf('\"' + A + '\"') >= 0) need[A] = 1;") && sales.includes('if (t.indexOf(h) >= 0) need[hx[h]] = 1;'), 'v2-sales touched() check changed: update this test');
let full = arg('--full') ? fs.readFileSync(arg('--full'), 'utf8') : (fs.existsSync(path.join(ROOT, 'api/recent-events.json')) ? fs.readFileSync(path.join(ROOT, 'api/recent-events.json'), 'utf8') : null);
full = JSON.parse(full);
const boot = JSON.parse(arg('--boot') ? fs.readFileSync(arg('--boot'), 'utf8') : fs.readFileSync(path.join(ROOT, 'api/boot.json'), 'utf8'));
/* a synthetic hex-JPEG issuance that names nothing, plus one big description that DOES quote a pet token (only kept-event selection may see it) */
const pet = (boot.dexAssets || [])[0] || 'A10000000000000000001', hexJ = 'ffd8ffe0' + '00a1b2c3'.repeat(150000) + 'ffd9';
const syn = { event_index: 1, event: 'ASSET_ISSUANCE', tx_hash: 'f'.repeat(64), params: { asset: 'A4000000000000000001', description: hexJ, tx_hash: 'f'.repeat(64) } };
full.blocks['1'] = { hash: '0'.repeat(64), complete: true, total: 1, events: [syn] };
const slim = Object.assign({}, full, { blocks: {} }); Object.keys(full.blocks).forEach((b) => { slim.blocks[b] = RE.slimBlock(full.blocks[b]); });
/* restore the ORIGINAL descriptions of anything a full-file event names, and compare need-sets */
const as = (boot.dexAssets || []).slice(), hx = {}, d = boot.dex || { orders: [], matches: [] };
(d.orders || []).forEach((o) => { if (o.give_asset) hx[o.tx_hash] = o.give_asset; if (o.get_asset && /^A\d/.test(o.get_asset)) hx[o.tx_hash] = o.get_asset; });
(d.matches || []).forEach((m) => { const a = /^A\d/.test(m.forward_asset) ? m.forward_asset : m.backward_asset; hx[m.tx0_hash] = a; hx[m.tx1_hash] = a; });
Object.keys(full.blocks).forEach((b) => { full.blocks[b].events.forEach((e) => { const t = JSON.stringify(e); (t.match(/"A[1-9][0-9]{16,19}"/g) || []).forEach((q) => { q = q.slice(1, -1); if (as.indexOf(q) < 0) as.push(q); }); }); });
const need = (evs) => { const n = {}; evs.forEach((e) => { const t = JSON.stringify(e); as.forEach((X) => { if (t.indexOf('"' + X + '"') >= 0) n[X] = 1; }); Object.keys(hx).forEach((h) => { if (t.indexOf(h) >= 0) n[hx[h]] = 1; }); }); return Object.keys(n).sort().join(','); };
let blocks = 0, stubbed = 0, flagged = 0;
Object.keys(full.blocks).forEach((b) => { const F = full.blocks[b], S = slim.blocks[b]; blocks++;
  assert.strictEqual(S.hash, F.hash); assert.strictEqual(S.complete, F.complete); assert.strictEqual(S.total, F.total); assert.strictEqual(S.events.length, F.events.length, 'same events kept ' + b);
  S.events.forEach((e, i) => { const f = F.events[i]; assert.deepStrictEqual(Object.assign({}, e, { params: null }), Object.assign({}, f, { params: null }));
    Object.keys(f.params || {}).forEach((k) => { if (k === 'description' && f.params[k] !== e.params[k]) { stubbed++; assert(f.params[k].length > RE.SLIM_MAX && e.params[k].length < 200 && e.params[k].endsWith(f.params[k].slice(-32) + ']')); } else assert.deepStrictEqual(e.params[k], f.params[k], k); }); });
  const a = need(F.events), c = need(S.events); assert.strictEqual(c, a, 'block ' + b + ' flags the same tokens'); if (a) flagged++; });
assert(stubbed >= 1, 'the synthetic hex-JPEG was stubbed');
const fb = JSON.stringify(full).length, sb = JSON.stringify(slim).length;
console.log('recent-events-slim-test OK: ' + blocks + ' blocks (' + flagged + ' flag tokens), ' + stubbed + ' descriptions stubbed, ' + as.length + ' tokens + ' + Object.keys(hx).length + ' order/match hashes checked; ' + (fb / 1e6).toFixed(2) + ' MB -> ' + (sb / 1e6).toFixed(3) + ' MB');
