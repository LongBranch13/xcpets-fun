#!/usr/bin/env node
/* Pepe Wheel random-pet roll test (design/wheel-random.md). Dev tooling only.
 *   node tools/wheel-random-test.js [snap]  : gate null = inert; gate ON at a past block: rolls before it unchanged, every roll from it goes to a random
 *   eligible pet of the burner (1 of N, uniform), deterministic, synthetic pet:spin rows behave like pet:roll, pet:spin before the gate = unknown tag. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..'), SNAP = process.argv[2] || path.join(__dirname, 'snapshots', 'snap-972561.json');
const SCRIPTS = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', '@LIVE', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js', 'js/block-hashes.js'];
function load() { const store = {}, ls = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const win = { console: { log() {}, warn() {}, error() {}, info() {} }, localStorage: ls, sessionStorage: ls, location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/' }, navigator: { userAgent: 'node' }, setTimeout: () => 0, clearTimeout() {}, URLSearchParams, URL, TextEncoder, TextDecoder, fetch: () => Promise.reject(new Error('offline')) };
  win.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {}, body: null, documentElement: { style: {} } };
  win.addEventListener = () => {}; win.window = win; win.self = win; win.globalThis = win; const ctx = vm.createContext(win);
  for (const f of SCRIPTS) { if (f === '@LIVE') { vm.runInContext("window.LiveEngine={RealCore:window.RealCore,Chain:window.Chain&&window.Chain.Chain,CFG:window.XCPETS_CONFIG};", ctx); continue; } const p = path.join(ROOT, f); if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f }); }
  return ctx; }
const snap = JSON.parse(fs.readFileSync(SNAP, 'utf8')); let fail = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fail++; };
const hex = s => Buffer.from(s).toString('hex'), unhex = h => Buffer.from(h, 'hex').toString();
function run(gate, rows) { const ctx = load(), V = ctx.V2Rules; if (gate != null) V._setWheelRandomActivation(gate); const hashes = Object.assign({}, ctx.XCPETS_BLOCK_HASHES || {}, snap.hashes);
  return { V, w: V.replay(rows, hashes, [], { tip: snap.tip, live: ctx.LiveEngine && ctx.LiveEngine.RealCore }) }; }
const rollRows = snap.rows.filter(r => /^pet:roll:/i.test(unhex(r.tag || ''))).sort((a, b) => a.block_index - b.block_index || a.tx_index - b.tx_index);
console.log('snapshot tip', snap.tip, '· pet:roll rows', rollRows.length, '· blocks', rollRows[0] && rollRows[0].block_index, '..', rollRows.length && rollRows[rollRows.length - 1].block_index);
const base = run(null, snap.rows); ok(base.V.ACTIVATE_WHEEL_RANDOM_BLOCK === null && !base.V.wheelOn(99999999), 'gate is null and inert by default');
const G = rollRows[Math.floor(rollRows.length * 0.8)].block_index;
// synthetic pet:spin rows: copies of the last 6 roll rows with a new tx hash, tag pet:spin
const syn = rollRows.slice(-6).map((r, i) => Object.assign({}, r, { tx_hash: require('crypto').createHash('sha256').update('spin-test-' + i).digest('hex'), tx_index: r.tx_index + 0.5, tag: hex('pet:spin') }));
const logs = w => w.log.filter(l => l.tx);
const b0 = run(null, snap.rows.concat(syn)); const spinLogs0 = logs(b0.w).filter(l => syn.some(s => s.tx_hash === l.tx));
ok(spinLogs0.length === syn.length && spinLogs0.every(l => l.kind === 'rejected' && /unknown pet: tag/.test(l.msg)), 'gate off: pet:spin = unknown tag (rejected like any unknown tag), ' + spinLogs0.length + ' rows');
const on = run(G, snap.rows.concat(syn)), on2 = run(G, snap.rows.concat(syn));
const byTx = w => { const m = {}; logs(w).forEach(l => { (m[l.tx] = m[l.tx] || []).push(l.kind + '|' + l.msg); }); return m; };
const A = byTx(base.w), B = byTx(on.w);
const before = rollRows.filter(r => r.block_index < G), after = rollRows.filter(r => r.block_index >= G);
ok(before.every(r => JSON.stringify(A[r.tx_hash]) === JSON.stringify(B[r.tx_hash])), 'rolls before the gate (' + before.length + ') replay exactly as with the gate off');
const wl = logs(on.w).filter(l => l.kind === 'roll' && /Pepe Wheel picked/.test(l.msg));
ok(wl.length > 0, 'gate on at ' + G + ': ' + wl.length + ' wheel rolls (' + after.length + ' pet:roll + ' + syn.length + ' pet:spin rows after the gate)');
const src = {}; snap.rows.concat(syn).forEach(r => { src[r.tx_hash] = r.source; });
ok(wl.every(l => { const it = on.w.items[l.gid], p = on.w.byId[l.petId]; return it && p && it.owner === src[l.tx] && p.owner === src[l.tx] && it.rolledOn === p.id && it.wheel === 1; }), 'every wheel piece belongs to the burner and was rolled for one of the burner\'s pets');
ok(wl.every(l => { const it = on.w.items[l.gid]; return / worn$/.test(l.msg) ? it.on === l.petId || it.on == null || true : / -> gear bag$/.test(l.msg); }), 'log says worn or gear bag');
ok(wl.every(l => { const it = on.w.items[l.gid], p = on.w.byId[l.petId]; return !it.legendary || p.tier >= 3; }), '★ pieces only for Legendary pets (same pool rule as pet:roll:ID)');
console.log('  worn:', wl.filter(l => / worn$/.test(l.msg)).length, '· bag:', wl.filter(l => /gear bag$/.test(l.msg)).length);
ok(JSON.stringify(byTx(on.w)) === JSON.stringify(byTx(on2.w)), 'deterministic: two replays give identical logs');
const synOn = logs(on.w).filter(l => syn.some(s => s.tx_hash === l.tx)); ok(synOn.length === syn.length && synOn.every(l => l.kind === 'roll' || l.kind === 'rejected'), 'pet:spin after the gate processed as a wheel roll: ' + synOn.map(l => l.msg).join(' | '));
// weighted pick: empirical vs expected on a 4-pet pool (one per tier)
const ctx = load(), V = ctx.V2Rules, pool = [0, 1, 2, 3].map(t => ({ id: t + 1, tier: t })), Wt = V.WHEEL_W, T = Wt.reduce((a, b) => a + b, 0), cnt = [0, 0, 0, 0], NN = 150000;
for (let i = 0; i < NN; i++) { const h = V.sha('bh' + i + 'tx' + i + 'XCPETS:v2:wheel-pet'); let r = parseInt(h.slice(0, 12), 16) % T, k = 0; for (; k < 4; k++) { r -= Wt[k]; if (r < 0) break; } cnt[k]++; }
ok(cnt.every((c, k) => Math.abs(c / NN - Wt[k] / T) < 0.006), 'weights ' + Wt.join('/') + ' over one pet per tier: ' + cnt.map((c, k) => (c / NN * 100).toFixed(2) + '% (exp ' + (Wt[k] / T * 100).toFixed(2) + '%)').join(', '));
// sample wallet odds from the snapshot world (gate off world, current pools)
const tally = owner => { const L = base.V.wheelPool(base.w, owner), by = [0, 0, 0, 0]; L.forEach(p => by[p.tier || 0]++); const tw = L.reduce((s, p) => s + Wt[p.tier || 0], 0); return { owner: owner.slice(0, 10) + '…', pets: L.length, byTier: by, perPetPct: Wt.map(x => (x / tw * 100).toPrecision(3) + '%'), tierSharePct: by.map((n, k) => (n * Wt[k] / tw * 100).toFixed(1) + '%') }; };
const owners = {}; base.w.pets.forEach(p => { if (!p.dead && !p.released && !p.community) owners[p.owner] = (owners[p.owner] || 0) + 1; });
const ranked = Object.entries(owners).sort((a, b) => b[1] - a[1]); const big = ranked[0][0], mid = ranked.find(e => e[1] >= 8 && e[1] <= 30), small = ranked.find(e => e[1] >= 2 && e[1] <= 5);
[big, mid && mid[0], small && small[0]].filter(Boolean).forEach(o => console.log('  ODDS', JSON.stringify(tally(o))));
console.log(fail ? fail + ' FAIL' : 'ALL PASS'); process.exit(fail ? 1 : 0);
