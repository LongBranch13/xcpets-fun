/* Checkpoint for tests that replay the live burn list once per scenario.
 * One full replay of api/boot.json is about a minute and a half. seance-raises and retire-tags
 * used to do that for every scenario and were killed at 600s. This loads the same rules files
 * as tools/lib/load-rules.js, with two optional replay flags added in memory only:
 *   opts._forkSave  after the burn loop, before the end-of-tip sweeps, keep a structured clone
 *   opts._forkUse   skip burns at or below that block and continue from the saved clone
 * The rules file on disk is not modified. A clone drops the non-enumerable gear index (__ix)
 * and the sales cursor (_dexPos, _grand); those are rebuilt with reindex() and copied back,
 * which is the same restore the rules already describe for a structured clone.
 * Callers still compare a forked replay with a full one, so a bad checkpoint fails the test.
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
const SCRIPTS = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', '@LIVE', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js', 'js/block-hashes.js'];

function patchRules(name, text) {
  if (name !== 'js/v2-rules.js') return text;
  const next = text
    .replace('function replay(rows, blockHashes, ops, opts) {', 'var FORK=null; function replay(rows, blockHashes, ops, opts) {')
    .replace('    ev.forEach(function (e) {\n      cemFlush(w, e.b); /* SEANCE ALWAYS RAISES: finish earlier blocks\' seances first */',
`    var __resume = !!(opts && opts._forkUse && FORK && opts._forkUse === FORK.tip);
    if (__resume) {
      w = reindex(FORK.w());
      if (FORK.dex != null) Object.defineProperty(w, '_dexPos', { value: FORK.dex, enumerable: false, writable: true, configurable: true });
      if (FORK.grand) Object.defineProperty(w, '_grand', { value: FORK.grand, enumerable: false, writable: true, configurable: true });
      seen = Object.assign({}, FORK.seen); w.tip = tip;
    }
    ev.forEach(function (e) {
      if (__resume && e.b <= opts._forkUse && !e.op) return;
      cemFlush(w, e.b); /* SEANCE ALWAYS RAISES: finish earlier blocks' seances first */`)
    .replace('    cemFlush(w, tip, true); if (saleIx) settleSales(w, tip, saleIx, true);',
`    if (opts && opts._forkSave) {
      var __snap = structuredClone(w), __seen = Object.assign({}, seen), __dex = w._dexPos, __grand = w._grand;
      FORK = { tip: tip, seen: __seen, dex: __dex, grand: __grand, w: function () { return structuredClone(__snap); } };
    }
    cemFlush(w, tip, true); if (saleIx) settleSales(w, tip, saleIx, true);`);
  if (next === text) throw new Error('fork-replay: js/v2-rules.js no longer matches the checkpoint patch');
  return next;
}

function load() {
  const st = {}, ls = { getItem: k => st[k] || null, setItem: (k, v) => { st[k] = String(v); }, removeItem: k => { delete st[k]; } };
  const win = { console: { log() {}, warn() {}, error() {}, info() {} }, localStorage: ls, sessionStorage: ls, location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/' }, navigator: { userAgent: 'node' }, setTimeout: () => 0, clearTimeout() {}, URLSearchParams, URL, TextEncoder, TextDecoder, structuredClone, fetch: () => Promise.reject(new Error('offline')) };
  win.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {}, body: null, documentElement: { style: {} } };
  win.addEventListener = () => {}; win.window = win; win.self = win;
  const c = vm.createContext(win);
  for (const f of SCRIPTS) {
    if (f === '@LIVE') { vm.runInContext('window.LiveEngine={RealCore:window.RealCore}', c); continue; }
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    vm.runInContext(patchRules(f, fs.readFileSync(p, 'utf8')), c, { filename: f });
  }
  return c;
}

module.exports = { load, patchRules };
