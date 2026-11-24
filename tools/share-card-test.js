#!/usr/bin/env node
/* Pet share links on the game server (tools/sync-server/share.js): preview page tags, the card PNG, the disk copy when the
 * check service is busy, the generic picture when there is no card, and the one-button share row (js/v2-share.js). */
'use strict';
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const ROOT = path.resolve(__dirname, '..');
const share = require(path.join(ROOT, 'tools/sync-server/share.js'));
const { createServer } = require(path.join(ROOT, 'tools/sync-server/server.js'));
const S = require(path.join(ROOT, 'js/v2-share.js'));

assert.deepStrictEqual(share.petPath('/xp/v1/pet/42'), { id: 42, png: false });
assert.deepStrictEqual(share.petPath('/xp/v1/pet/42.png'), { id: 42, png: true });
assert.strictEqual(share.petPath('/xp/v1/pet/0'), null);
assert.strictEqual(share.petPath('/xp/v1/pet/abc'), null);
assert.strictEqual(share.petPath('/xp/v1/pet/1/../2'), null);
const pg = share.page(7, { title: 'Bad<b> #7', line: 'Rare · Pepe · Adult', dead: false }, 'abc');
assert.ok(pg.indexOf('Bad&lt;b&gt; #7') > 0 && pg.indexOf('<b>') < 0, 'names are escaped');
assert.ok(pg.indexOf('property="og:image" content="https://node.xcpets.fun/xp/v1/pet/7.png?v=abc"') > 0, 'og:image');
assert.ok(pg.indexOf('name="twitter:card" content="summary_large_image"') > 0, 'twitter card');
assert.ok(pg.indexOf('https://xcpets.fun/pet.html?id=7') > 0, 'sends people to the pet page');
assert.strictEqual(S.cardUrl(7), 'https://node.xcpets.fun/xp/v1/pet/7');
assert.strictEqual(S.pageUrl(7), 'https://xcpets.fun/pet.html?id=7');

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xp-share-'));
let calls = 0, mode = 'ok';
const card = id => { calls++; if (mode === 'down') return Promise.resolve({ ok: false, error: 'not ready' });
  if (id === 99) return Promise.resolve({ ok: true, none: 1 });
  return Promise.resolve({ ok: true, tip: 5, png: PNG.toString('base64'), meta: { id, name: 'Miwa', title: 'Miwa #' + id, line: 'Legendary · Nakamoto · Mythic', dead: false } }); };
const { server } = createServer({ getState: () => ({}), dataDir: dir, card: card });
function get(p) { return new Promise((res, rej) => { http.get({ host: '127.0.0.1', port: server.address().port, path: p }, r => { const b = []; r.on('data', d => b.push(d)); r.on('end', () => res({ status: r.statusCode, headers: r.headers, body: Buffer.concat(b) })); }).on('error', rej); }); }
server.listen(0, '127.0.0.1', async () => {
  try {
    let r = await get('/xp/v1/pet/15004');
    assert.strictEqual(r.status, 200); assert.ok(/text\/html/.test(r.headers['content-type']));
    assert.ok(r.body.toString().indexOf('Miwa #15004 on XCPETS') > 0, 'title from the card');
    r = await get('/xp/v1/pet/15004.png');
    assert.strictEqual(r.status, 200); assert.strictEqual(r.headers['content-type'], 'image/png'); assert.ok(r.body.equals(PNG), 'png bytes');
    assert.strictEqual(r.headers['access-control-allow-origin'], '*');
    assert.strictEqual(calls, 1, 'second request reads the disk copy');
    mode = 'down';
    r = await get('/xp/v1/pet/15004.png'); assert.strictEqual(r.status, 200, 'disk copy while the check service is down');
    r = await get('/xp/v1/pet/123.png'); assert.strictEqual(r.status, 302); assert.strictEqual(r.headers.location, 'https://xcpets.fun/img/og.png');
    r = await get('/xp/v1/pet/123'); assert.strictEqual(r.status, 200); assert.ok(r.body.toString().indexOf('Pet #123 on XCPETS') > 0, 'generic page');
    mode = 'ok';
    r = await get('/xp/v1/pet/99.png'); assert.strictEqual(r.status, 302, 'no such pet');
    const v = fs.readFileSync(path.join(ROOT, 'js/v2-share.js'), 'utf8');
    assert.ok(!/Share to Telegram/.test(v), 'one Share button, not two');
    console.log('share-card-test: ok');
  } catch (e) { console.error(e); process.exitCode = 1; }
  server.close(); fs.rmSync(dir, { recursive: true, force: true });
});
