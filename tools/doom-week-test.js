#!/usr/bin/env node
/* Doom Week display pass. Rules file stays the published MD5. The new art is not in the roll pools. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('ok  ', m); } else { fail++; console.log('FAIL', m); } }
const md5 = crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, 'js/v2-rules.js'))).digest('hex');
ok(md5 === '8e98664087bab2e991680ebdb80ba143', 'js/v2-rules.js MD5 is 8e98664087bab2e991680ebdb80ba143 (' + md5 + ')');
const listeners = {};
const doc = {
  readyState: 'loading', currentScript: { src: 'js/doom-week.js?v=test' },
  documentElement: { classList: { add() {}, remove() {} }, style: {} },
  head: { appendChild() {} }, body: { getAttribute: () => '', appendChild() {}, insertBefore() {} },
  addEventListener(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
  getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
  createElement: () => ({ className: '', style: {}, setAttribute() {}, appendChild() {} })
};
const win = { console, document: doc, location: { search: '', href: 'https://xcpets.fun/index.html', hostname: 'xcpets.fun', pathname: '/index.html' },
  navigator: { userAgent: 'node' }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  setTimeout: () => 0, setInterval: () => 0, clearTimeout() {}, clearInterval() {}, addEventListener() {},
  URLSearchParams, URL, TextEncoder, TextDecoder, fetch: () => Promise.reject(new Error('offline')), Uint8ClampedArray };
win.window = win; win.self = win;
const ctx = vm.createContext(win);
function run(f) { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }
['js/bonus-gear.js', 'js/v2-fit.js', 'js/pet-core.js', 'js/v2-gear.js', 'js/v2-rules.js', 'js/doom-gear.js', 'js/doom-week.js'].forEach(run);
const V = ctx.V2Rules, G = ctx.V2Gear, F = ctx.V2Fit, D = ctx.DoomGear, W = ctx.XCDoomWeek;
ok(G.ITEMS.every(it => !/^doom-/.test(it.id)), 'doom pieces are not in V2Gear.ITEMS');
ok(!V.GEAR_BY_ID['doom-flag'], 'rules catalog does not know the doom flag');
const pool = V.pool('hand', 'pepe', 3, null).map(x => x.it.id);
ok(pool.indexOf('doom-flag') < 0 && pool.indexOf('doom-hodl-sign') < 0, 'hand pool has no doom gear');
ok(F.doomAnchor('peepo', 'head').aboveEyes === 2 && F.doomAnchor('wojak', 'head').lift === 2 && F.doomAnchor('wojak', 'head').scale === 0.85, 'peepo and wojak head anchors');
ok(F.doomAnchor('pepe', 'hand').inset === 1 && F.isCape('doom-candle-cape'), 'held inset and red candle cape');
ok(D && D.IDS.length === 5 && D.frames(ctx.PetCore.characterPet('pepe', { tier: 'legendary' }), 3).length === 4, 'pepe doom frames render');
ok(D.frames(ctx.PetCore.characterPet('pepe', { tier: 'legendary' }), 0) === null, 'eggs are not dressed');
const rows = [
  { tx_hash: 'a', block_index: 975640, source: 'bc1qdoom', status: 'valid', amount: 69 },
  { tx_hash: 'b', block_index: 975639, source: 'bc1qearly', status: 'valid', amount: 69 },
  { tx_hash: 'c', block_index: 976000, source: 'bc1qdoom', status: 'invalid', amount: 69 }
];
ok(W.survivedAddr('bc1qdoom', rows, 976100) && !W.survivedAddr('bc1qearly', rows, 976100) && !W.survivedAddr('bc1qnobody', rows, 976100), 'badge is any real burn inside the window');
ok(W.COUNT_PETS == null && !/petCount|BTC down, pets up/.test(fs.readFileSync(path.join(ROOT, 'js/doom-week.js'), 'utf8')), 'the counter has no pet-count reading');
ok(W.parseCoinbase({ data: { amount: '68593.695' } }) === 68593.695 && W.parseKraken({ result: { XXBTZUSD: { c: ['68624.4', '1'] } } }) === 68624.4, 'Coinbase spot, then Kraken last');
ok(W.parseSupply({ result: { supply: '6851580174498903' } }) === 6851580174498903 / 1e8, 'supply is raw units divided by 1e8');
ok(W.parseCoinbase({}) === null && W.parseKraken({}) === null && W.parseSupply({ error: 'no' }) === null, 'a bad quote or supply parses to null');
var line = W.counterText(68593.695, 68515801.74498902);
ok(line === '1 BTC: $68,594 · XCPETS left: 68.516 million' && !/price/i.test(line), 'counter line is the dollars-and-supply reading');
ok(W.downFlags(null, 68000, 68e6).btc === false && W.downFlags(null, 68000, 68e6).supply === false, 'first reading has no arrow');
ok(W.downFlags({ usd: 68764.4, tokens: 68515801.74 }, 68600.2, 68515801.74).btc === true, 'a lower dollar reading gets an arrow');
ok(W.downFlags({ usd: 68764.4, tokens: 68515801.74 }, 68764.6, 68510000).supply === true && W.downFlags({ usd: 68764.4, tokens: 68515801.74 }, 68764.6, 68510000).btc === false, 'only the number that fell gets an arrow');
ok(W.downFlags({ usd: 68000, tokens: 68e6 }, 68000.4, 68e6 + 100).btc === false && W.downFlags({ usd: 68000, tokens: 68e6 }, 68100, 69e6).supply === false, 'a tie or a rise is not a drop');
ok(W.downFlags({ usd: 68764.4, tokens: 68515801.74 }, 68764.4, 68515701.74).supply === false, 'a supply dip too small to change the shown millions is not a drop');
var html = W.counterHtml(68000, 68e6, { btc: true, supply: false });
ok(html.indexOf('dw-down') === html.lastIndexOf('dw-down') && html.indexOf('$68,000') < html.indexOf('dw-down') && html.indexOf('dw-down') < html.indexOf('XCPETS left') && !/price/i.test(html), 'the arrow sits beside the number that went down');
ok(!/price/i.test(fs.readFileSync(path.join(ROOT, 'js/doom-week.js'), 'utf8').split('function paintCount')[1].split('function burners')[0]), 'the counter markup does not say price');
ok(W.START === 975640 && W.END === 976648 && W.SABO_ID === 1765, 'window and Sabo id');
['img/doom/sp-pepe.png', 'img/doom/sp-kek.png', 'img/doom/sp-wizard.png', 'img/doom/xcpets-cast.gif', 'img/doom/logo.png', 'img/doom/token.png', 'img/doom/badge.png', 'img/doom/doom-flag.png'].forEach(f => ok(fs.existsSync(path.join(ROOT, f)), 'asset ' + f));
ok(!fs.readFileSync(path.join(ROOT, 'practice.html'), 'utf8').includes('doom-week.js'), 'practice pages are not wired');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
