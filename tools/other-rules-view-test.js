#!/usr/bin/env node
/* Never slow after a rules update (Nov 22 2026): when the server has no world for this page's rules yet, the page paints
 * from the newest world built with the previous rules instead of replaying the whole game in the browser. */
'use strict';
const R = require('path').join(__dirname, '..') + '/';
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const split = require(R + 'tools/sync-server/split');
async function run(pageRsig, ownWorld) {
  const pets = []; for (let i = 1; i <= 5; i++) pets.push({ id: i, owner: 'carol', name: 'P' + i, species: 'pepe', tier: 0, stage: 1, care: i, dead: false, wins: 0, losses: 0, released: false });
  const world = { tip: 98, pets, items: {}, community: { burned: 1, leaderboard: [] }, log: [] };
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'or-'));
  await split.write(path.join(out, 'view'), world, { tip: 98, rsig: 'rOLD' });
  const ROOT = 'https://node.test';
  const fetch = async (url) => {
    const u = String(url).replace(/\?.*$/, '');
    let body = null;
    if (u === ROOT + '/xp/v1/health') body = { tip: 100 };
    else if (u === ROOT + '/xp/v1/world/latest.json') body = { rsig: 'rOLD', tip: 98, manifest: '/xp/v1/world/w1/manifest.json' };
    else if (u === ROOT + '/xp/v1/world/' + pageRsig + '/latest.json' && ownWorld) body = { rsig: pageRsig, tip: 98, manifest: '/xp/v1/world/w1/manifest.json' };
    else if (u.startsWith(ROOT + '/xp/v1/world/w1/')) { const f = path.join(out, u.slice((ROOT + '/xp/v1/world/w1/').length)); if (fs.existsSync(f)) body = JSON.parse(fs.readFileSync(f, 'utf8')); }
    return { ok: !!body, status: body ? 200 : 404, json: async () => body };
  };
  const store = { 'xcpets-v2-me': 'carol' };
  const win = { V2BootSync: { base: () => ROOT, localOnly: () => false }, addEventListener() {}, dispatchEvent() {} };
  const ctx = { window: win, location: { search: '', href: 'https://xcpets.fun/play.html' }, localStorage: { getItem: k => store[k] || null, setItem() {}, removeItem() {} },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} }, fetch, crypto: globalThis.crypto, TextEncoder, URLSearchParams, URL, AbortController, setTimeout, clearTimeout, Promise, console,
    document: { scripts: [], getElementById: () => null, createElement: () => ({ style: {} }), body: { insertBefore() {} }, addEventListener() {} }, Event: function () {} };
  win.window = win; Object.assign(win, ctx);
  let src = fs.readFileSync(R + 'js/v2-split.js', 'utf8').replace('var sigP = pageRsig();', 'var sigP = Promise.resolve(' + JSON.stringify(pageRsig) + ');');
  vm.createContext(ctx); ctx.self = win; vm.runInContext(src.replace(/\bwindow\./g, 'window.'), ctx);
  const S = ctx.window.V2Split || win.V2Split;
  return await new Promise(res => S.prepare(v => res(v)));
}
(async () => {
  const same = await run('rOLD', false);
  const other = await run('rNEW', false);
  let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
  ok(same && same.pets.length === 5 && same.tip === 98, 'same rules: paints the published world');
  ok(other && other.pets.length === 5 && other.tip === 98, 'new rules with no world yet: paints the previous-rules world (no full replay)');
  console.log(fail ? fail + ' failed' : '2 passed, 0 failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
