#!/usr/bin/env node
/* Share links: pretty URL, ?ref= hook, static og page, Sabo #1765 never described as dead.
 * Display only. js/v2-rules.js must stay the published bytes. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert');
const ROOT = path.resolve(__dirname, '..');
const S = require(path.join(ROOT, 'js/v2-share.js'));
const P = require(path.join(__dirname, 'share-page.js'));
const md5 = crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, 'js/v2-rules.js'))).digest('hex');
assert.strictEqual(md5, '8e98664087bab2e991680ebdb80ba143', 'v2-rules.js md5 moved');
assert.strictEqual(S.url(15004), 'https://xcpets.fun/pet/15004?ref=');
assert.strictEqual(S.url(15004, ''), 'https://xcpets.fun/pet/15004?ref=');
assert.strictEqual(S.url(15004, 'abc'), 'https://xcpets.fun/pet/15004?ref=abc');
assert.strictEqual(S.url(9, 'a b'), 'https://xcpets.fun/pet/9?ref=a%20b');
const link = S.url(15004);
const intent = S.xIntent(S.text({ id: 15004, name: 'Miwa', tier: 3, stageName: 'Mythic' }), link);
assert.ok(intent.indexOf('https://x.com/intent/post?') === 0, intent);
assert.ok(intent.indexOf(encodeURIComponent(link)) > 0, 'intent missing url');
assert.ok(intent.indexOf('Miwa') > 0, 'intent missing name');
const tg = S.tgIntent('hello', link);
assert.ok(tg.indexOf('https://t.me/share/url?url=') === 0, tg);
const sabo = S.text({ id: 1765, name: 'Sabo', tier: 3, stageName: 'Mythic', dead: true });
assert.ok(!/dead|cemetery|grave|R\.I\.P/i.test(sabo), sabo);
assert.ok(/Sabo/.test(sabo) && /Mythic/.test(sabo), sabo);
const other = S.text({ id: 3, name: 'Zoru', tier: 0, stageName: 'Hatchling', dead: true });
assert.ok(/Remembering/.test(other) && !/cemetery/i.test(other), other);
assert.throws(function () { P.page({ id: 1765, name: 'Sabo' }); });
const page = P.page({ id: 15004, name: 'Miwa', tier: 'Legendary', stageName: 'Mythic', speciesLabel: 'Nakamoto', owner: 'bc1ps9av86ymmlzy9zj3a8pn6g94pz4j5e0kagv3td3wutaagfjvekjs26m3s4' });
assert.ok(page.indexOf('property="og:image" content="https://xcpets.fun/pet/15004/card.png"') > 0, 'og:image');
assert.ok(page.indexOf('name="twitter:card" content="summary_large_image"') > 0, 'twitter card');
assert.ok(page.indexOf('og:title" content="#15004 Miwa"') > 0, 'og title');
assert.ok(page.indexOf('owner bc1ps9') > 0 && page.indexOf('\u2026') > 0, 'short owner');
assert.ok(page.indexOf('__XCPETS_PET_ID=15004') > 0, 'id hook');
assert.ok(page.indexOf('/js/v2-pet-route.js') > 0, 'route');
assert.strictEqual(P.shortAddr('bc1ps9av86ymmlzy9zj3a8pn6g94pz4j5e0kagv3td3wutaagfjvekjs26m3s4'), 'bc1ps9\u2026m3s4');
const miss = fs.readFileSync(path.join(ROOT, '404.html'), 'utf8');
assert.ok(miss.indexOf('/js/v2-pet-route.js') > 0, '404 routes /pet/<id>');
assert.ok(miss.indexOf('/pet/(\\d+)') > 0 || miss.indexOf('/pet\\/(\\d+)') > 0, '404 path test');
const css = fs.readFileSync(path.join(ROOT, 'css/v2-share.css'), 'utf8');
assert.ok(!/Luckiest Guy/i.test(css), 'font');
assert.ok(!/f7931a/i.test(css), 'bitcoin orange');
assert.ok(/transform:\s*none/.test(css), 'phone toast is not shifted');
assert.ok(/max-width:\s*600px/.test(css), 'phone query');
const shareJs = fs.readFileSync(path.join(ROOT, 'js/v2-share.js'), 'utf8');
assert.ok(!/Luckiest Guy/i.test(shareJs) && !/f7931a/i.test(shareJs));
const setPath = path.join(ROOT, 'share/set.json');
if (fs.existsSync(setPath)) {
  const set = JSON.parse(fs.readFileSync(setPath, 'utf8'));
  assert.ok(set.ids.indexOf(1765) < 0, 'set includes Sabo');
  set.ids.forEach(function (id) {
    const f = path.join(ROOT, 'pet', String(id), 'index.html');
    const card = path.join(ROOT, 'pet', String(id), 'card.png');
    assert.ok(fs.existsSync(f) && fs.existsSync(card), 'missing files for ' + id);
    const h = fs.readFileSync(f, 'utf8');
    assert.ok(h.indexOf('og:image') > 0 && h.indexOf('twitter:card') > 0, id);
    assert.ok(h.indexOf('pet/' + id + '/card.png') > 0, id);
  });
}
console.log('ok share-links');
