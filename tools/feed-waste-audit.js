#!/usr/bin/env node
/* Feed waste audit (Nov 28 2026; dev tooling, not loaded by any page, not run by the tests). Replays api/boot.json with the real rules and
 * lists every feed burn that paid for meals the rules did not serve: a multi-feed or runs burn whose money was not all spent (a pet died,
 * was already fed, a zombie...), and any feed burn the rules rejected outright. The rules file on disk is not changed: one line is added in
 * memory to note each multi-feed's leftover.
 *   node --max-old-space-size=9000 tools/feed-waste-audit.js [--boot api/boot.json] [--from 971501] [--csv out.csv]
 * Found Nov 28 2026 by the play-test robot: "Do it all in one burn" on a 40,000-pet wallet paid for 135 never-fed hatchlings that died of
 * hunger at the next chain-day turn, two blocks before the burn landed. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const A = process.argv.slice(2), opt = k => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : null; };
const SCRIPTS = ['js/species-registry.js', 'rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', '@LIVE', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js', 'js/v2-sales.js', 'js/block-hashes.js'];
function patch(text) {
  const swap = (src, from, to) => { const n = src.split(from).length - 1; if (n !== 1) throw new Error('feed-waste-audit: anchor found ' + n + ' times (want 1): ' + from.slice(0, 80)); return src.replace(from, () => to); };
  let t = swap(text, "w._fireFull = w._fireFullM || null; w._fireFullM = 0; if (!fed.length)", "(self.__FW || (self.__FW = [])).push({ tx: r.tx_hash, b: b, src: src, amt: amt, left: left, fed: fed.length, skip: skip.slice(0, 400), sale: !!saleAt(w, b) }); w._fireFull = w._fireFullM || null; w._fireFullM = 0; if (!fed.length)");
  t = swap(t, "w._fireFull = w._fireFullM || null; w._fireFullM = 0; if (!afed.length)", "(self.__FW || (self.__FW = [])).push({ tx: r.tx_hash, b: b, src: src, amt: amt, left: aleft, fed: afed.length, skip: [], all: askip, sale: !!saleAt(w, b) }); w._fireFull = w._fireFullM || null; w._fireFullM = 0; if (!afed.length)");
  return t;
}
const st = {}, ls = { getItem: k => st[k] || null, setItem: (k, v) => { st[k] = String(v); }, removeItem: k => { delete st[k]; } };
const win = { console: { log() {}, warn() {}, error() {}, info() {} }, localStorage: ls, sessionStorage: ls, location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/' }, navigator: { userAgent: 'node' }, setTimeout: () => 0, clearTimeout() {}, URLSearchParams, URL, TextEncoder, TextDecoder, fetch: () => Promise.reject(new Error('offline')) };
win.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {}, body: null, documentElement: { style: {} } };
win.addEventListener = () => {}; win.window = win; win.self = win;
const c = vm.createContext(win);
for (const f of SCRIPTS) { if (f === '@LIVE') { vm.runInContext('window.LiveEngine={RealCore:window.RealCore,Chain:window.Chain&&window.Chain.Chain,CFG:window.XCPETS_CONFIG}', c); continue; } const p = path.join(ROOT, f); if (!fs.existsSync(p)) continue; const src = fs.readFileSync(p, 'utf8'); vm.runInContext(f === 'js/v2-rules.js' ? patch(src) : src, c, { filename: f }); }
const boot = JSON.parse(fs.readFileSync(path.resolve(opt('--boot') || path.join(ROOT, 'api/boot.json')), 'utf8'));
const from = Number(opt('--from') || 971501), H = Object.assign({}, c.XCPETS_BLOCK_HASHES, boot.hashes);
const dex = boot.dex && c.V2Sales && c.V2Sales.normalizeDex ? c.V2Sales.normalizeDex(boot.dex) : boot.dex || undefined; /* same as tools/sync-server/snapshot.js */
const t0 = Date.now(), w = c.V2Rules.replay(boot.rows, H, [], { tip: boot.tip, live: c.LiveEngine.RealCore, dex });
const V = c.V2Rules, tagOf = r => { try { return Buffer.from(r.tag || '', 'hex').toString('utf8'); } catch (e) { return ''; } };
const byTx = {}; boot.rows.forEach(r => { byTx[r.tx_hash] = r; });
const out = [];
(c.__FW || []).forEach(e => { if (e.b < from) return; const r = byTx[e.tx] || {}, tag = tagOf(r), chores = /^pet:dc:/.test(tag), slack = (chores ? V.COSTS.wagmi : 0) + 1e-6;
  if (e.sale || !(e.left > slack)) return; /* a sale: a full-price meal earns a spin, so extra money is not waste */
  const why = {}; e.skip.forEach(s => { const k = String(s).replace(/^#\d+ /, '').replace(/ [\d.]+$/, ''); why[k] = (why[k] || 0) + 1; });
  out.push({ block: e.b, tx: e.tx, wallet: e.src, tag, burned: e.amt, wasted: +(e.left - (chores ? V.COSTS.wagmi : 0)).toFixed(8), fed: e.fed, why: Object.keys(why).map(k => why[k] + ' ' + k).join('; ') }); });
w.log.forEach(e => { if (e.kind !== 'rejected' || e.block < from) return; const r = byTx[e.tx]; if (!r) return; const tag = tagOf(r); if (!/^pet:(feed|fm|fl|fr|fa|fx|fy|dc):/.test(tag + ':')) return;
  if (out.some(o => o.tx === e.tx)) return; out.push({ block: e.block, tx: e.tx, wallet: r.source, tag, burned: r.quantity / 1e8, wasted: r.quantity / 1e8, fed: 0, why: e.msg }); });
out.sort((a, b) => a.block - b.block);
const tot = {}; out.forEach(o => { tot[o.wallet] = (tot[o.wallet] || 0) + o.wasted; });
console.log('replayed to ' + boot.tip + ' in ' + ((Date.now() - t0) / 1000 | 0) + ' s; ' + out.length + ' feed burns paid for meals the rules did not serve (from block ' + from + ')');
out.forEach(o => console.log(o.block + ' ' + o.wallet.slice(0, 12) + '… ' + o.tag.slice(0, 40) + ' burned ' + o.burned + ' wasted ' + o.wasted + ' fed ' + o.fed + ' | ' + String(o.why).slice(0, 160)));
Object.keys(tot).sort((a, b) => tot[b] - tot[a]).forEach(k => console.log('TOTAL ' + k + ' ' + tot[k].toFixed(8)));
if (opt('--csv')) fs.writeFileSync(opt('--csv'), 'block,tx,wallet,tag,burned,wasted,fed,why\n' + out.map(o => [o.block, o.tx, o.wallet, o.tag, o.burned, o.wasted, o.fed, '"' + String(o.why).replace(/"/g, "'") + '"'].join(',')).join('\n') + '\n');
