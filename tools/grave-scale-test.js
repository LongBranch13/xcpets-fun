#!/usr/bin/env node
/* Grave index scale + closed discard pile. Display only: no rule file may change.
 *   node tools/grave-scale-test.js
 * Times a million-row page query and a compact pass over a large dead list.
 * Checks the cemetery page source does not call cemGraves, and a closed discard
 * pile returns before any discard card or sprite is built. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), http = require('http'), os = require('os');
const ROOT = path.join(__dirname, '..');
const GI = require('../js/v2-grave-index');
const graves = require('./sync-server/graves');
const { createServer } = require('./sync-server/server');
const fail = [];
const ok = (c, m) => { if (c) console.log('ok', m); else { fail.push(m); console.log('FAIL', m); } };
function md5(p) { return crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex'); }
function gitFile(f) { return require('child_process').execFileSync('git', ['show', 'origin/main:' + f], { cwd: ROOT }); }
const RULES_MD5 = 'bd2bd8784a4c726615af9c91572431ac';
const RULES = ['js/v2-rules.js', 'js/pet-core.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/real-core.js', 'rjs/burn-core.js', 'rjs/config.js'];
RULES.forEach(f => { const a = md5(path.join(ROOT, f)); ok(f === 'js/v2-rules.js' ? a === RULES_MD5 : a === crypto.createHash('md5').update(gitFile(f)).digest('hex'), f === 'js/v2-rules.js' ? 'js/v2-rules.js MD5 is ' + RULES_MD5 : 'rule MD5 unchanged ' + f); });

const scene = fs.readFileSync(path.join(ROOT, 'js/v2-cemetery-scene.js'), 'utf8');
ok(!/V\.cemGraves\s*\(/.test(scene), 'cemetery page does not call V.cemGraves');
ok(/V2GraveIndex/.test(scene) && /showDetail/.test(scene), 'cemetery pages an index and loads a grave when it is opened');
const ui = fs.readFileSync(path.join(ROOT, 'js/v2.js'), 'utf8');
const pileAt = ui.indexOf('function discardedBox'), lazyAt = ui.indexOf('R.lazy(d.querySelector', pileAt);
const closedAt = ui.indexOf('if (!DS.open)', pileAt);
ok(pileAt > 0 && closedAt > pileAt && closedAt < lazyAt, 'a closed discard pile returns before discard cards and sprites');
ok(/zList\(\{ items: L[\s\S]{0,240}\}, true\)/.test(ui), 'the zombie meal list is not built until its section is opened');

function row(i) {
  return { id: i + 1, name: 'Pet ' + (i + 1), species: i % 5 === 0 ? 'doge' : 'pepe', spl: 'Pepe', tier: i % 4, stage: i % 6, stageName: 'Adult',
    owner: i % 50 === 0 ? 'me' : 'bc1qother', gear: i % 7, power: i % 1000, born: 900000, died: 970000 + (i % 800), fed: i % 3 === 0 ? null : 960000,
    hybrid: false, days: i % 40, diff: i % 11 === 0 ? 'closed' : 'easy', need: 0, needLabel: 'Common+', state: null, open: i % 17 === 0 ? 1 : 0,
    raisable: i % 11 === 0 ? 0 : 1, af: 1, crumbles: 0, mythic: 0, rank: i % 4, rbits: -1, oneIn: '' };
}
const N = 1000000;
const tBuild = Date.now();
const rows = new Array(N);
for (let i = 0; i < N; i++) rows[i] = row(i);
const buildMs = Date.now() - tBuild;
const tQ = Date.now();
const page = GI.query(rows, { page: 40, per: 60, sort: 'newest', mine: true, owner: 'me', text: '' });
const queryMs = Date.now() - tQ;
ok(page.rows.length === 60, 'desktop page is 60 graves (' + page.rows.length + ')');
ok(page.rows.length <= 60 && page.matched > 60, 'the query does not return the whole index (' + page.matched + ' matched, ' + page.rows.length + ' sent)');
const phone = GI.query(rows, { page: 0, per: 24, sort: 'id' });
ok(phone.rows.length === 24 && phone.rows[0].id === 1, 'phone page is 24 graves');
const mine = page.rows.every(r => r.owner === 'me');
ok(mine, 'my graves filter is applied before the page is cut');
console.log('MEASURE million-row index build ' + buildMs + 'ms, newest+mine page ' + queryMs + 'ms, matched ' + page.matched + ' of ' + N);

const pets = [];
for (let i = 0; i < 8000; i++) pets.push({ id: i + 1, owner: i % 2 ? 'me' : 'them', species: 'pepe', tier: i % 4, stage: 2, stageName: 'Juvenile', dead: i % 3 === 0, deathBlock: 1000 + i, hatchBlock: 10, name: 'C' + i, stats: { vigor: 1, spark: 1, grit: 1, zoom: 1, luck: 1 }, community: false, released: false });
const tC = Date.now();
const compact = GI.compact({ pets: pets, byId: {}, cem: { altars: {} } }, 5000, { BLOCKS_PER_DAY: 144, speciesLabel: s => s, STAGE_NAMES: [] });
const compactMs = Date.now() - tC;
const one = GI.query(compact, { page: 2, per: 60, sort: 'id' });
ok(one.rows.length === 60 && one.total === compact.length && compact.length < pets.length, 'compact pass keeps graves only and pages them (' + compact.length + ' graves, ' + compactMs + 'ms)');
ok(!compact.some(r => !r.id), 'every compact row has an id');
console.log('MEASURE compact 8000 pets ' + compactMs + 'ms, graves ' + compact.length);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'graves-'));
const counts = graves.writeIndex(dir, compact, { tip: 5000 });
ok(counts.dead === compact.length && counts.shards >= 1, 'snapshot writer shards the index (' + counts.shards + ' shards)');
const ans = graves.answer(dir, { page: 1, per: 24, sort: 'oldest' });
ok(ans.rows.length === 24 && ans.per === 24 && ans.source === 'index', 'server answer is one 24-grave page');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xp-graves-'));
const rsig = 'r' + 'ab'.repeat(16), tip = '9';
fs.mkdirSync(path.join(dataDir, 'world', rsig, tip), { recursive: true });
fs.cpSync(dir, path.join(dataDir, 'world', rsig, tip, 'graves'), { recursive: true });
fs.writeFileSync(path.join(dataDir, 'world', 'latest.json'), JSON.stringify({ rsig: rsig, tip: 9 }));
const srv = createServer({ getState: () => ({ tip: 9, ready: true, upstream: 'public' }), dataDir: dataDir });
srv.server.listen(0, '127.0.0.1', async () => {
  const port = srv.server.address().port;
  const got = await new Promise((res, rej) => http.get({ hostname: '127.0.0.1', port: port, path: '/xp/v1/graves?page=0&per=60&sort=id' }, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(JSON.parse(b))); }).on('error', rej));
  ok(got.rows && got.rows.length === 60 && got.counts && got.counts.dead === compact.length, 'GET /xp/v1/graves returns one page plus the count (' + (got.rows && got.rows.length) + ')');
  const post = await new Promise(res => { const q = http.request({ hostname: '127.0.0.1', port: port, path: '/xp/v1/graves', method: 'POST' }, r => res(r.statusCode)); q.end(); });
  ok(post === 405, 'the grave index stays GET-only (' + post + ')');
  srv.server.close();
  if (fail.length) { console.log(fail.length + ' failed'); process.exit(1); }
  console.log('grave scale ok');
});
