#!/usr/bin/env node
/* XCPETS replay check (dev tooling only; not loaded by any page).
 * Loads the repo's rules (same script order as play.html) in a Node vm with a tiny window shim, replays a burn snapshot
 * (tools/snapshots/*.json: { tip, rows, hashes }) and prints stable hashes. No network needed for replay.
 *   node tools/replay-check.js [--snap FILE] [--tip N] [--repo DIR]
 *   node tools/replay-check.js --compare <git-ref> [--snap FILE] [--tip N]
 *   node tools/replay-check.js --fetch [--snap FILE]   (headless Chrome via puppeteer-core: saves a fresh snapshot from xcpets.fun)
 * Hash = 32-bit FNV-1a over canonical JSON (sorted keys). "gear (no names)" drops every 'label' field. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os'), cp = require('child_process');
const A = process.argv.slice(2), opt = k => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : null; }, has = k => A.includes(k);
const ROOT = path.resolve(__dirname, '..');
const SNAP = path.resolve(opt('--snap') || path.join(__dirname, 'snapshots', 'snap-971786.json'));
const SCRIPTS = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', '@LIVE', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js', 'js/block-hashes.js'];
function canon(v) { if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']'; if (v && typeof v === 'object') return '{' + Object.keys(v).sort().filter(k => v[k] !== undefined && typeof v[k] !== 'function').map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}'; return JSON.stringify(v === undefined ? null : v); }
function fnv(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, '0'); }
const strip = (v) => JSON.parse(JSON.stringify(v, (k, x) => k === 'label' ? undefined : x));
function replay(repo, snap, tip) {
  const store = {}; const ls = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const win = { console: { log() {}, warn() {}, error() {}, info() {} }, localStorage: ls, sessionStorage: ls, location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/' }, navigator: { userAgent: 'node' }, setTimeout: () => 0, clearTimeout() {}, URLSearchParams, URL, TextEncoder, TextDecoder, fetch: () => Promise.reject(new Error('offline')) };
  win.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {}, body: null, documentElement: { style: {} } };
  win.addEventListener = () => {}; win.window = win; win.self = win; win.globalThis = win;
  const ctx = vm.createContext(win);
  for (const f of SCRIPTS) { if (f === '@LIVE') { vm.runInContext("window.LiveEngine={RealCore:window.RealCore,Chain:window.Chain&&window.Chain.Chain,CFG:window.XCPETS_CONFIG};", ctx); continue; } const p = path.join(repo, f); if (!fs.existsSync(p)) continue; vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f }); }
  const V = ctx.V2Rules, E = ctx.LiveEngine; if (!V || !V.replay) throw new Error('V2Rules not loaded from ' + repo);
  const rows = snap.rows.filter(r => r.block_index <= tip); const hashes = Object.assign({}, ctx.XCPETS_BLOCK_HASHES || {}, snap.hashes); /* same merge as v2-chain.js load() */
  const w = V.replay(rows, hashes, [], { tip, live: E && E.RealCore });
  const items = w.itemList || Object.values(w.items || {});
  const pets = w.pets.map(p => { const o = Object.assign({}, p); delete o.children; return o; });
  return { tip, rows: rows.length, pets: w.pets.length, items: items.length,
    h: { overall: fnv(canon({ pets, items, community: w.community, fights: w.fights, breedReqs: w.breedReqs })), pets: fnv(canon(pets)), gear: fnv(canon(items)), gearNoNames: fnv(canon(strip(items))) },
    _pets: pets, _items: strip(items) };
}
function show(tag, r) { console.log(`${tag}  tip ${r.tip}  rows ${r.rows}  pets ${r.pets}  items ${r.items}\n  overall ${r.h.overall}  pets ${r.h.pets}  gear ${r.h.gear}  gear(no names) ${r.h.gearNoNames}`); }
function diffSummary(a, b) { const out = []; const ia = new Map(a._items.map(x => [x.gid, canon(x)])); let n = 0; b._items.forEach(x => { if (ia.get(x.gid) !== canon(x)) { if (n++ < 5) out.push('  item ' + x.gid + ' ' + x.item); } }); if (n) out.push('  ' + n + ' item(s) differ');
  const pa = new Map(a._pets.map(x => [x.id, canon(x)])); let m = 0; b._pets.forEach(x => { if (pa.get(x.id) !== canon(x)) { if (m++ < 5) out.push('  pet #' + x.id); } }); if (m) out.push('  ' + m + ' pet(s) differ'); if (a.pets !== b.pets) out.push('  pet count ' + a.pets + ' vs ' + b.pets); return out.join('\n'); }
async function fetchSnap() { const p = require('puppeteer-core'); const b = await p.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] }); const g = await b.newPage();
  await g.goto('https://xcpets.fun/play.html', { waitUntil: 'domcontentloaded' }); await g.waitForFunction(() => window.V2Mock && V2Mock.world && V2Mock.world() && V2Mock.world().pets.length > 0, { timeout: 180000 });
  const c = await g.evaluate(() => { const S = V2Mock.state(); return { tip: S.tip, rows: S.rows, hashes: S.hashes }; }); await b.close();
  const out = opt('--snap') ? SNAP : path.join(__dirname, 'snapshots', 'snap-' + c.tip + '.json'); fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ tip: c.tip, rows: c.rows, hashes: c.hashes })); console.log('saved', out, 'tip', c.tip, 'rows', c.rows.length); }
(async () => {
  if (has('--fetch')) return fetchSnap();
  const snap = JSON.parse(fs.readFileSync(SNAP, 'utf8')), tip = +(opt('--tip') || snap.tip);
  const ref = opt('--compare');
  if (!ref) { show('working tree', replay(path.resolve(opt('--repo') || ROOT), snap, tip)); return; }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'xcpets-rc-'));
  try { for (const f of SCRIPTS.filter(x => x[0] !== '@')) { let t; try { t = cp.execSync(`git -C "${ROOT}" show ${ref}:${f}`, { maxBuffer: 64e6 }); } catch (e) { continue; } fs.mkdirSync(path.join(tmp, path.dirname(f)), { recursive: true }); fs.writeFileSync(path.join(tmp, f), t); }
    const a = replay(tmp, snap, tip), b = replay(ROOT, snap, tip); show(ref, a); show('working tree', b);
    const same = a.h.overall === b.h.overall, sameNN = a.h.pets === b.h.pets && a.h.gearNoNames === b.h.gearNoNames;
    console.log(same ? 'SAME' : sameNN ? 'SAME (names aside): only display names differ' : 'DIFF\n' + diffSummary(a, b)); process.exitCode = same || sameNN ? 0 : 1;
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
})().catch(e => { console.error(e.stack || e); process.exit(2); });
