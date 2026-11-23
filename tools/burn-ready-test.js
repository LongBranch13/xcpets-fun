#!/usr/bin/env node
/* Faster first burn (Nov 23 2026). The status line says "Up to date" for a current published world instead of "Saved copy · checking the
 * chain", and the full check starts quietly in the background once a wallet is connected, so a burn does not wait for it. */
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('ok  ', m); } else { fail++; console.log('FAIL', m); } };

function statusLine(S, feedTip, health) {
  const el = { innerHTML: '', hidden: false, setAttribute() {} };
  const doc = { readyState: 'complete', head: { appendChild() {} }, body: { insertBefore() {}, firstChild: null }, getElementById: id => id === 'statusLine' ? el : null,
    querySelector: () => null, createElement: () => el, addEventListener() {} };
  const win = { location: { pathname: '/play.html' }, document: doc, V2Mock: { state: () => S }, V2Sales: { feed: { tip: feedTip || 0 } }, V2Split: { healthTip: () => health || 0 }, fetch: () => new Promise(() => {}), setInterval() {} };
  win.window = win; vm.createContext(win); vm.runInContext(R('js/v2-status.js'), win); return el.innerHTML;
}
ok(/Up to date/.test(statusLine({ tip: 977130, chainTip: 977131, view: true, verified: false })), 'published world 1 block behind: Up to date');
ok(!/checking the chain/.test(statusLine({ tip: 977130, chainTip: 977131, view: true, verified: false })), 'no "checking the chain" for a current published world');
ok(/Catching up/.test(statusLine({ tip: 977120, chainTip: 977131, view: true, verified: false })), 'published world 11 blocks behind: Catching up');
ok(/Catching up/.test(statusLine({ tip: 977125, chainTip: 977131, view: false, verified: false })), 'a chain copy 6 behind: still Catching up (unchanged)');
ok(/Saved copy/.test(statusLine({ tip: 977130, chainTip: 0, view: true, verified: false })), 'tip unknown: still Saved copy');
ok(/Up to date<\/span> · block 977,131$/.test(statusLine({ tip: 977131, view: true, verified: false }, 0, 977132)), 'tip from the server health check: Up to date');
ok(/Up to date.*6 newer blocks in the next update/.test(statusLine({ tip: 977131, view: true, verified: false }, 0, 977137)), '6 behind (normal between server builds): Up to date, names the coming blocks');
ok(/Catching up/.test(statusLine({ tip: 977120, view: true, verified: false }, 0, 977137)), '17 behind: Catching up');
ok(/Saved copy/.test(statusLine({ tip: 977130, chainTip: 977131, view: false, verified: false })), 'a stale chain copy (not the published world) is still Saved copy');
ok(/Live/.test(statusLine({ tip: 977131, chainTip: 977131, view: true, verified: true })), 'checked: Live');

const sp = R('js/v2-split.js');
ok(/function warm\(\)/.test(sp) && /startVerify\(true\)/.test(sp), 'the check starts quietly (startVerify(true))');
ok(/connected\(\)/.test(sp) && /V2Wallet\.current/.test(sp), 'only with a connected wallet (not view-only)');
ok(/deviceMemory && navigator\.deviceMemory < 4/.test(sp) && /saveData/.test(sp), 'skipped on small-memory devices and Data Saver');
ok(/wantBar && document\.getElementById\('splitViewBar'\)/.test(sp), 'progress reaches the bar only when someone waits on it');
ok(/function deviceCheck\(plans\) \{\s*showProgress\(\);/.test(sp), 'a burn waiting on the device check shows its progress');
ok(/readyP = null/.test(sp), 'a failed check is retried by the next burn');
const vw = R('js/v2-verify-worker.js');
ok(/for \(L = 0; L < 4; L\+\+\) lanes\.push\(lane\(\)\)/.test(vw), 'the worker downloads four parts at a time');
ok(/if \(h !== f\.sha256\) throw new Error\('bad hash'\)/.test(vw), 'every part is still hash-checked');
console.log(`burn-ready-test: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
