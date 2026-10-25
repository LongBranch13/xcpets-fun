/* Dev tooling: load the repo's rules in a Node vm (same order as tools/replay-check.js) and build synthetic burn rows. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..', '..');
const SCRIPTS = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', '@LIVE', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js', 'js/block-hashes.js'];
function load(extra) {
  const st = {}, ls = { getItem: k => st[k] || null, setItem: (k, v) => { st[k] = String(v); }, removeItem: k => { delete st[k]; } };
  const win = { console: { log() {}, warn() {}, error() {}, info() {} }, localStorage: ls, sessionStorage: ls, location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/' }, navigator: { userAgent: 'node' }, setTimeout: () => 0, clearTimeout() {}, URLSearchParams, URL, TextEncoder, TextDecoder, fetch: () => Promise.reject(new Error('offline')) };
  win.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {}, body: null, documentElement: { style: {} } };
  win.addEventListener = () => {}; win.window = win; win.self = win;
  const c = vm.createContext(win);
  for (const f of SCRIPTS.concat(extra || [])) { if (f === '@LIVE') { vm.runInContext('window.LiveEngine={RealCore:window.RealCore}', c); continue; } const p = path.join(ROOT, f); if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), c, { filename: f }); }
  return c;
}
const hex = s => Buffer.from(s, 'utf8').toString('hex');
const fakeHash = b => crypto.createHash('sha256').update('fake-block-' + b).digest('hex');
let n = 0;
function row(block, source, amount, tag) { n++; return { tx_index: 9e9 + n, tx_hash: crypto.createHash('sha256').update('tx' + n + ':' + tag + ':' + block).digest('hex'), block_index: block, source, asset: 'XCPETS', quantity: Math.round(amount * 1e8), tag: hex(tag), status: 'valid' }; }
/* snap(): newest tools/snapshots/snap-*.json (untracked; built from tools/fixtures on a fresh checkout, or make a newer one with: node tools/replay-check.js --fetch) */
function snap(name) { const d = path.join(ROOT, 'tools', 'snapshots'); require('./fixtures').ensure(); /* fresh checkout: rebuild the snapshots from tools/fixtures */ if (!name || !fs.existsSync(path.join(d, name))) name = fs.readdirSync(d).filter(f => /^snap-\d+\.json$/.test(f)).sort().pop(); return JSON.parse(fs.readFileSync(path.join(d, name), 'utf8')); }
function run(c, s, extraRows, tip, hashes) { const H = Object.assign({}, c.XCPETS_BLOCK_HASHES, s.hashes, hashes || {}); (extraRows || []).forEach(r => { if (!H[r.block_index]) H[r.block_index] = fakeHash(r.block_index); });
  return c.V2Rules.replay(s.rows.concat(extraRows || []), H, [], { tip, live: c.LiveEngine.RealCore }); }
module.exports = { load, row, snap, run, fakeHash, ROOT };
