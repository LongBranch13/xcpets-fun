#!/usr/bin/env node
/* JACKPOT CHILD replay diff (dev tooling only). Replays a snapshot with origin/main's rules and with this tree's rules, the
 * jackpot-child gate either at its placeholder or forced to --gate N, and lists every pet whose state differs, with breed
 * counts before/after and any parent over the lifetime cap.
 *   node tools/jackpot-child-diff.js [--snap FILE] [--base REF] [--gate N] [--json OUT] */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os'), cp = require('child_process');
const A = process.argv.slice(2), opt = k => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : null; };
const ROOT = path.resolve(__dirname, '..'), SNAP = path.resolve(opt('--snap') || path.join(__dirname, 'snapshots', 'snap-971786.json'));
const BASE = opt('--base') || 'origin/main', GATE = opt('--gate') != null ? +opt('--gate') : null;
const SCRIPTS = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', '@LIVE', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js', 'js/block-hashes.js'];
function canon(v) { if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']'; if (v && typeof v === 'object') return '{' + Object.keys(v).sort().filter(k => v[k] !== undefined && typeof v[k] !== 'function').map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}'; return JSON.stringify(v); }
function load(repo) { const store = {}, ls = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const win = { console: { log() {}, warn() {}, error() {}, info() {} }, localStorage: ls, sessionStorage: ls, location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/' }, navigator: { userAgent: 'node' }, setTimeout: () => 0, clearTimeout() {}, URLSearchParams, URL, TextEncoder, TextDecoder, fetch: () => Promise.reject(new Error('offline')) };
  win.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {}, body: null, documentElement: { style: {} } };
  win.addEventListener = () => {}; win.window = win; win.self = win; win.globalThis = win; const ctx = vm.createContext(win);
  for (const f of SCRIPTS) { if (f === '@LIVE') { vm.runInContext("window.LiveEngine={RealCore:window.RealCore,Chain:window.Chain&&window.Chain.Chain,CFG:window.XCPETS_CONFIG};", ctx); continue; } const p = path.join(repo, f); if (!fs.existsSync(p)) continue; vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f }); }
  return ctx; }
function run(ctx, snap) { const V = ctx.V2Rules, E = ctx.LiveEngine, rows = snap.rows.filter(r => r.block_index <= snap.tip), hashes = Object.assign({}, ctx.XCPETS_BLOCK_HASHES || {}, snap.hashes);
  return { V, w: V.replay(rows, hashes, [], { tip: snap.tip, live: E && E.RealCore }) }; }
const snap = JSON.parse(fs.readFileSync(SNAP, 'utf8')), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'xcpets-jc-'));
try {
  for (const f of SCRIPTS.filter(x => x[0] !== '@')) { let t; try { t = cp.execSync(`git -C "${ROOT}" show ${BASE}:${f}`, { maxBuffer: 64e6 }); } catch (e) { continue; } fs.mkdirSync(path.join(tmp, path.dirname(f)), { recursive: true }); fs.writeFileSync(path.join(tmp, f), t); }
  const a = run(load(tmp), snap), cb = load(ROOT); if (GATE != null) cb.V2Rules._setJackpotChildActivation(GATE); const b = run(cb, snap);
  const CAP = b.V.BREED_CAP_V2, gate = GATE != null ? GATE : b.V.ACTIVATE_JACKPOT_CHILD_BLOCK, byA = new Map(a.w.pets.map(p => [p.id, p])), rows = [];
  const strip = p => { const o = Object.assign({}, p); delete o.children; if (o.jackpot) { o.jackpot = Object.assign({}, o.jackpot); delete o.jackpot.child; } return o; };
  let other = 0;
  b.w.pets.forEach(p => { const q = byA.get(p.id); if (!q) { rows.push({ id: p.id, note: 'only in branch' }); return; }
    const chg = canon(p) !== canon(q); if (!chg) return;
    const ch = (p.children || []).filter(x => (q.children || []).indexOf(x) < 0);
    const r = { id: p.id, name: p.name, owner: p.owner, breedsBefore: q.breeds || 0, breedsAfter: p.breeds || 0, v2Before: q.breedsV2 || 0, v2After: p.breedsV2 || 0, newChildren: ch,
      genBefore: a.V.genOf(a.w, p.id && a.w.byId[p.id]), genAfter: b.V.genOf(b.w, p), overCap: (p.breedsV2 || 0) > CAP, flagOnly: !!(p.jackpot && p.jackpot.child && !(q.jackpot && q.jackpot.child)) };
    if (canon(strip(p)) !== canon(strip(q)) && !(r.breedsAfter !== r.breedsBefore || r.v2After !== r.v2Before)) { r.other = true; other++; }
    rows.push(r); });
  a.w.pets.forEach(q => { if (!b.w.byId[q.id]) rows.push({ id: q.id, note: 'only in base' }); });
  const parents = rows.filter(r => r.breedsAfter !== r.breedsBefore || r.v2After !== r.v2Before), kids = rows.filter(r => r.flagOnly && !parents.includes(r));
  const sameCount = a.w.pets.length === b.w.pets.length, sameItems = canon(a.w.itemList || Object.values(a.w.items || {})) === canon(b.w.itemList || Object.values(b.w.items || {}));
  const genDiff = b.w.pets.filter(p => a.V.genOf(a.w, a.w.byId[p.id]) !== b.V.genOf(b.w, p)).map(p => ({ id: p.id, before: a.V.genOf(a.w, a.w.byId[p.id]), after: b.V.genOf(b.w, p) }));
  const res = { snap: path.basename(SNAP), tip: snap.tip, base: BASE, gate, pets: b.w.pets.length, samePetCount: sameCount, sameItems, changedPets: rows.length, parents, jackpotKidsFlagOnly: kids.map(r => r.id), otherChanges: rows.filter(r => r.other || r.note), overCap: parents.filter(r => r.overCap), genChanges: genDiff };
  if (opt('--json')) fs.writeFileSync(opt('--json'), JSON.stringify(res, null, 1));
  console.log(`${res.snap} tip ${snap.tip} gate ${gate} vs ${BASE}: ${rows.length ? 'DIFF' : 'SAME'} | pets ${res.pets} same count ${sameCount} | items same ${sameItems} | parents changed ${parents.length} | kids marked ${kids.length} | other ${res.otherChanges.length} | over cap ${res.overCap.length} | gen changes ${genDiff.length}`);
  parents.forEach(r => console.log(`  #${r.id} ${r.name}: breeds ${r.breedsBefore} -> ${r.breedsAfter}, lifetime ${r.v2Before}/${CAP} -> ${r.v2After}/${CAP}${r.overCap ? ' OVER CAP' : ''}, new children ${r.newChildren.map(x => '#' + x).join(' ')}`));
  res.otherChanges.forEach(r => console.log('  other change #' + r.id + (r.note ? ' ' + r.note : '')));
  process.exitCode = 0;
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
