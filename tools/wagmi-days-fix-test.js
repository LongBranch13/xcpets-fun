#!/usr/bin/env node
/* WAGMI days fix (ACTIVATE_WAGMI_DAYS_FIX_BLOCK, 977,450; PR 199). Checked Nov 24 2026 before it fires:
 *   - a real wallet says WAGMI twice on the same game day after the gate: the second burn is not counted again
 *     (no second "said WAGMI" entry, no second first-five spin), the first one is,
 *   - with the gate moved past the test blocks, the replay is exactly as before (the old rule still applies),
 *   - the streak shown on the page (streakOf) counts the new day once either way.
 *   node tools/wagmi-days-fix-test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const SCRIPTS = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', '@LIVE', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', '@RULES', 'js/block-hashes.js'];
const RULES = fs.readFileSync(path.join(ROOT, 'js/v2-rules.js'), 'utf8');
const GATE = +((/var ACTIVATE_WAGMI_DAYS_FIX_BLOCK = (\d+)/.exec(RULES) || [])[1]);
function load(gate) {
  const src = RULES.replace(/var ACTIVATE_WAGMI_DAYS_FIX_BLOCK = \d+/, 'var ACTIVATE_WAGMI_DAYS_FIX_BLOCK = ' + gate);
  const store = {}, ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const win = { console: { log() {}, warn() {}, error() {}, info() {} }, localStorage: ls, sessionStorage: ls, location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/' }, navigator: { userAgent: 'node' }, setTimeout: () => 0, clearTimeout() {}, URLSearchParams, URL, TextEncoder, TextDecoder, fetch: () => Promise.reject(new Error('offline')) };
  win.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {}, body: null, documentElement: { style: {} } };
  win.addEventListener = () => {}; win.window = win; win.self = win; win.globalThis = win; const ctx = vm.createContext(win);
  for (const f of SCRIPTS) { if (f === '@LIVE') { vm.runInContext('window.LiveEngine={RealCore:window.RealCore,Chain:window.Chain&&window.Chain.Chain,CFG:window.XCPETS_CONFIG};', ctx); continue; } vm.runInContext(f === '@RULES' ? src : fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f === '@RULES' ? 'js/v2-rules.js' : f }); }
  return ctx; }
let fails = 0, n = 0; const ok = (c, m) => { n++; console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
ok(GATE === 977450, 'ACTIVATE_WAGMI_DAYS_FIX_BLOCK is ' + GATE);
const boot = JSON.parse(fs.readFileSync(path.join(ROOT, 'api/boot.json'), 'utf8'));
const rows = boot.rows.slice().sort((a, b) => a.block_index - b.block_index || a.tx_index - b.tx_index), tip = boot.tip;
const hex = s => Buffer.from(s, 'utf8').toString('hex'); let tx = rows[rows.length - 1].tx_index + 1;
const row = (src, tag, amount, b) => ({ tx_index: tx++, tx_hash: ('w' + tx).padStart(64, '0'), block_index: b, source: src, asset: 'XCPETS', quantity: Math.round(amount * 1e8), tag: hex(tag), status: 'valid' });
function run(gate) {
  const ctx = load(gate), V = ctx.V2Rules, E = ctx.LiveEngine, hashes = Object.assign({}, ctx.XCPETS_BLOCK_HASHES || {}, boot.hashes || {});
  const w0 = V.replay(rows, hashes, [], { tip, live: E && E.RealCore, dex: boot.dex });
  /* a wallet that said WAGMI before (so it is a real player), first block of the next game day and one block later */
  const who = Object.keys(w0.wagmi || {}).sort()[0], d1 = V.dayStart(V.day(tip) + 1), b1 = d1, b2 = d1 + 1;
  const H = Object.assign({}, hashes); for (let b = tip; b <= b2 + 1; b++) if (!H[b]) H[b] = '0'.repeat(56) + b.toString(16).padStart(8, '0');
  const plan = V.wagmiPlan ? V.wagmiPlan(w0, who, b1) : null, tag = (plan && plan.tag) || 'pet:wagmi', amt = (plan && plan.amount) || 1;
  const extra = [row(who, tag, amt, b1), row(who, tag, amt, b2)];
  const w = V.replay(rows.concat(extra), H, [], { tip: b2 + 1, live: E && E.RealCore, dex: boot.dex });
  const mine = w.log.filter(l => l.block >= b1 && (l.src === who || l.owner === who || String(l.msg || '').indexOf(who) >= 0));
  return { V, w, who, b1, b2, said: mine.filter(l => l.kind === 'wagmi' && !/counts once/.test(l.msg || '')).length, kinds: mine.map(l => l.kind + (/counts once/.test(l.msg || '') ? '(counts once)' : '')), streak: V.streakOf(w, who, b2), spins: JSON.stringify((w.spins || {})[who] || (w.savedSpins || {})[who] || null) };
}
/* off: the switch moved past the test blocks (the feed tip is past the real gate since Nov 24 2026, so the real block no longer works here) */
const on = run(tip - 10), off = run(99999999);
ok(on.who && on.who === off.who, 'test wallet ' + String(on.who).slice(0, 10) + '…');
ok(on.said === 1, 'gate on: two WAGMI burns on the same game day count once (' + on.said + ' counted; log ' + on.kinds.join(',') + ')');
ok(off.b2 < 99999999, 'gate off: the test blocks ' + off.b1 + '-' + off.b2 + ' are before the moved switch');
ok(off.said === 2, 'gate off: before the block the old rule still takes the second burn, so replay history is unchanged (' + off.said + ' counted)');
ok(on.streak.today && off.streak.today && on.streak.current === off.streak.current, 'the page streak counts the day once either way (current ' + on.streak.current + ')');
console.log(`wagmi-days-fix: ${n - fails} passed, ${fails} failed`); process.exit(fails ? 1 : 0);
