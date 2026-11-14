#!/usr/bin/env node
/* Service worker routing and the seasonal loader. No game rules. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (c) pass++; else fail++; };
const ROOT = path.join(__dirname, '..');
const md5 = crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, 'js/v2-rules.js'))).digest('hex');
ok(md5 === '8e98664087bab2e991680ebdb80ba143', 'rules MD5 unchanged');
ok(/var ENABLED = false/.test(fs.readFileSync(path.join(ROOT, 'js/doom-week.js'), 'utf8')), 'doom week file stays off');
ok(/var DOOM_ENABLED = false/.test(fs.readFileSync(path.join(ROOT, 'js/v2-events.js'), 'utf8')), 'loader doom switch stays off');
ok(!fs.readFileSync(path.join(ROOT, 'practice.html'), 'utf8').includes('doom-week.js'), 'practice html does not name doom-week');
ok(fs.readFileSync(path.join(ROOT, 'play.html'), 'utf8').includes('js/v2-events.js'), 'play loads the event loader');
ok(!/<script src="js\/doom-week\.js/.test(fs.readFileSync(path.join(ROOT, 'play.html'), 'utf8')), 'play does not preload doom-week');

const handlers = {};
const selfObj = {
  addEventListener(ev, fn) { handlers[ev] = fn; },
  skipWaiting() {},
  clients: { claim() { return Promise.resolve(); } },
  registration: { unregister() { return Promise.resolve(true); } },
  location: { origin: 'http://127.0.0.1:8766' }
};
const ctx = { self: selfObj, caches: {}, fetch() { return Promise.resolve({ ok: true, type: 'basic', clone() { return this; } }); }, URL, Promise, console };
ctx.self = selfObj;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), ctx, { filename: 'sw.js' });
const S = selfObj.__sw;
const U = s => new URL(s);
const sig = 'r' + 'ab'.repeat(16);
const base = 'https://node.xcpets.fun/xp/v1/world/' + sig + '/975800/';
ok(S.isWorldFile(U(base + 'cp-root.json')) && S.isWorldFile(U(base + 'cp-meta.json')) && S.isWorldFile(U(base + 'cp-part-003.json')), 'checkpoint files are cached');
ok(S.isWorldFile(U(base + 'view/summary.json')) && S.isWorldFile(U(base + 'view/own/' + 'ab'.repeat(32) + '.json')) && S.isWorldFile(U(base + 'view/own/' + 'cd'.repeat(32) + '.2.json')) && S.isWorldFile(U(base + 'view/p/00012.json')), 'view pages are cached');
ok(!S.isWorldFile(U('https://node.xcpets.fun/xp/v1/world/latest.json')), 'latest.json is not cached');
ok(!S.isWorldFile(U('https://node.xcpets.fun/xp/v1/sync')) && !S.isWorldFile(U('https://node.xcpets.fun/v2/blocks/975800')), 'live chain API is not a world file');
ok(S.isRules(U('https://xcpets.fun/js/v2-rules.js')) && !S.versionedStatic(U('https://xcpets.fun/js/v2-rules.js?v=abc')), 'rules are not cache-first');
ok(S.versionedStatic(U('http://127.0.0.1:8766/js/v2.js?v=abc')) && !S.versionedStatic(U('http://127.0.0.1:8766/js/v2.js')), 'only versioned static files are cache-first');
ok(!S.versionedStatic(U('http://127.0.0.1:8766/sw.js?v=sw60-1')), 'the worker script is not cached');
ok(S.worldTip(U(base + 'cp-root.json')) === 975800 && S.KEEP_TIPS === 2 && S.MAX_ENTRIES === 220, 'tip parsing and the cache cap');

const store = new Map();
const cache = {
  match(req) { return Promise.resolve(store.get(req.url) || null); },
  put(req, res) { store.set(req.url, res); return Promise.resolve(); },
  keys() { return Promise.resolve([...store.keys()].map(u => ({ url: u }))); },
  delete(req) { store.delete(req.url); return Promise.resolve(true); }
};
const reqs = [975700, 975800, 975815].flatMap(tip => [1, 2, 3].map(i => ({ url: 'https://node.xcpets.fun/xp/v1/world/' + sig + '/' + tip + '/cp-part-00' + i + '.json' })));
reqs.forEach(r => store.set(r.url, { ok: 1 }));
S.trim(cache).then(() => {
  const left = [...store.keys()];
  ok(left.every(u => /\/9758(00|15)\//.test(u)) && left.length === 6, 'tips older than the two newest are dropped (' + left.length + ')');
  return events();
}).then(() => { console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0); }).catch(e => { console.error(e); process.exit(1); });

function events() {
  function run(search, pathname, now) {
    const added = [];
    const doc = { currentScript: { src: 'js/v2-events.js?v=abc' }, querySelector() { return null; }, body: { appendChild(s) { added.push(s.src); } }, createElement() { return { src: '' }; } };
    const nav = { serviceWorker: null };
    const loc = { search: search, pathname: pathname, protocol: 'http:', hostname: 'xcpets.fun' };
    const RealDate = Date;
    function FakeDate() { return arguments.length ? new RealDate(...arguments) : new RealDate(now); }
    FakeDate.UTC = RealDate.UTC;
    FakeDate.parse = RealDate.parse;
    const ctx2 = { document: doc, location: loc, navigator: nav, window: {}, Date: FakeDate };
    ctx2.window = ctx2;
    vm.createContext(ctx2);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/v2-events.js'), 'utf8'), ctx2, { filename: 'js/v2-events.js' });
    return added;
  }
  const off = run('', '/play.html', Date.UTC(2026, 10, 14));
  ok(off.length === 0, 'no seasonal script on a normal November day');
  ok(run('?halloween=1', '/play.html', Date.UTC(2026, 10, 14)).some(s => s.indexOf('halloween.js') >= 0), 'halloween preview flag loads it');
  ok(run('?votingday=1', '/index.html', Date.UTC(2026, 10, 14)).some(s => s.indexOf('voting-day.js') >= 0), 'voting-day preview flag loads it');
  ok(!run('?doom=1', '/practice.html', Date.UTC(2026, 10, 14)).some(s => s.indexOf('doom-week.js') >= 0), 'practice never loads doom-week');
  ok(run('?doom=1', '/play.html', Date.UTC(2026, 10, 14)).some(s => s.indexOf('doom-week.js') >= 0), 'doom preview flag loads it on the real game');
  ok(run('', '/play.html', Date.UTC(2026, 9, 31, 12)).some(s => s.indexOf('halloween.js') >= 0), 'halloween loads inside its window');
}
