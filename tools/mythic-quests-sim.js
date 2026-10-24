'use strict';
/* Mythic quests: OFFLINE simulation + checks (2026-10-24). Never touches the chain.
 *   node tools/mythic-quests-sim.js [--snap FILE] [--gate B] [--out FILE]
 * Loads the same scripts as tools/replay-check.js, sets the quest gate IN MEMORY ONLY (V2Rules._setQuestActivation),
 * adds SIMULATED pet:quest / pet:aura burns from the real owners of real Mythics, replays, prints outcomes and runs assertions.
 * Simulated tx hashes are sha256('SIMULATED-xcpets-quest:'+n); blocks with no hash in the snapshot get a SIMULATED hash. */
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const A = process.argv.slice(2), opt = k => { const i = A.indexOf(k); return i >= 0 ? A[i + 1] : null; };
const ROOT = path.resolve(__dirname, '..');
const SNAP = JSON.parse(fs.readFileSync(path.resolve(opt('--snap') || path.join(__dirname, 'snapshots', 'snap-972901.json')), 'utf8'));
const GATE = +(opt('--gate') || 972500), TIP = SNAP.tip;
const SCRIPTS = ['rjs/config.js', 'rjs/pet-core.js', 'rjs/game-core.js', 'rjs/bonus-gear.js', 'rjs/real-core.js', 'rjs/chain.js', '@LIVE', 'js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/v2-rules.js', 'js/block-hashes.js'];
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
function load(patch) { const store = {}; const ls = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const win = { console: { log() {}, warn() {}, error() {}, info() {} }, localStorage: ls, sessionStorage: ls, location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/' }, navigator: { userAgent: 'node' }, setTimeout: () => 0, clearTimeout() {}, URLSearchParams, URL, TextEncoder, TextDecoder, fetch: () => Promise.reject(new Error('offline')) };
  win.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {}, body: null, documentElement: { style: {} } };
  win.addEventListener = () => {}; win.window = win; win.self = win; win.globalThis = win; const ctx = vm.createContext(win);
  for (const f of SCRIPTS) { if (f === '@LIVE') { vm.runInContext("window.LiveEngine={RealCore:window.RealCore,Chain:window.Chain&&window.Chain.Chain,CFG:window.XCPETS_CONFIG};", ctx); continue; } const p = path.join(ROOT, f); if (fs.existsSync(p)) { let src = fs.readFileSync(p, 'utf8'); if (patch && f === 'js/v2-rules.js') src = patch(src); vm.runInContext(src, ctx, { filename: f }); } }
  return ctx; }
const ctx = load(), V = ctx.V2Rules, E = ctx.LiveEngine;
const baseHashes = Object.assign({}, ctx.XCPETS_BLOCK_HASHES || {}, SNAP.hashes);
const hex = s => Buffer.from(s, 'utf8').toString('hex');
let ok = 0, bad = 0; const check = (c, m) => { if (c) ok++; else { bad++; console.log('  FAIL', m); } };
function run(sim, gate) { V._setQuestActivation(gate); const hs = Object.assign({}, baseHashes);
  const simH = {}; if (gate != null) for (let b = gate; b <= TIP; b++) if (!hs[b]) { hs[b] = simH[b] = sha('SIMULATED-xcpets-block:' + b); }
  const rows = SNAP.rows.concat(sim).sort((a, b) => a.block_index - b.block_index || a.tx_index - b.tx_index);
  const w = V.replay(rows, hs, [], { tip: TIP, live: E && E.RealCore }); return { w, simH }; }
let txi = 9e8, nonce = 0;
function row(b, src, tag, amt, want) { /* want(txHash) -> bool lets the sim pick a showcase outcome; still a plain row */
  let tx; do { tx = sha('SIMULATED-xcpets-quest:' + (nonce++)); } while (want && !want(tx));
  return { tx_index: txi++, tx_hash: tx, block_index: b, source: src, asset: 'XCPETS', quantity: Math.round(amt * 1e8), tag: hex(tag), status: 'valid', simulated: true }; }
/* 1) gate off: tags inert */
const off = run([], null).w;
/* world at the gate, to pick real Mythics + owners */
V._setQuestActivation(GATE); const w0 = V.replay(SNAP.rows.filter(r => r.block_index < GATE), baseHashes, [], { tip: GATE - 1, live: E && E.RealCore });
const myth = w0.pets.filter(p => !p.dead && !p.community && !p.released && V.isMythic(p) && !V.questBusyWhy(p, GATE));
const owners = {}; myth.forEach(p => { (owners[p.owner] = owners[p.owner] || []).push(p); });
const tied = w0.pets.filter(p => V.deedOf && V.deedOf(w0, p)).map(p => p.id);
console.log('gate', GATE, 'tip', TIP, 'Mythics', myth.length, 'owners', Object.keys(owners).length, 'tied', tied.join(','));
const burnedTop = Object.keys(owners).sort((a, b) => V.walletBurned(w0, b) - V.walletBurned(w0, a));
const pickFrom = (n) => { const out = []; const tiedM = myth.filter(p => tied.includes(p.id)); tiedM.forEach(p => out.push(p));
  for (let i = 0; out.length < n && i < 50; i++) burnedTop.forEach(o => { const q = owners[o][i]; if (q && out.length < n && !out.includes(q)) out.push(q); }); return out.slice(0, n); };
const P = pickFrom(6); console.log('picked', P.map(p => '#' + p.id + ' ' + p.name + ' (' + p.owner.slice(0, 8) + '… burned ' + Math.round(V.walletBurned(w0, p.owner)) + ')').join('\n       '));
const R = (bh, tx, id) => parseInt(sha(bh + tx + id + 'quest').slice(0, 8), 16) % 10000, AMB = (bh, tx, id) => parseInt(sha(bh + tx + id + 'quest').slice(8, 16), 16) % 69 === 0;
const H = b => baseHashes[b] || sha('SIMULATED-xcpets-block:' + b);
const sim = [], plan = []; const amt = (id, code, b) => V.questPlan(id, code, w0, b).amount;
function send(p, code, b, want) { const end = b + V.QUESTS[code].len; const r = row(b, p.owner, 'pet:quest:' + p.id + ':' + code, amt(p.id, code, b), want && (tx => want(R(H(end), tx, p.id), AMB(H(end), tx, p.id)))); sim.push(r); plan.push([p.id, code, b, end]); return end; }
const [a, bb, c, d, e, f] = P;
let end1 = send(a, 'spam', GATE + 1, (r, am) => r < 1500 && am);            /* Legendary Haul + FUNTRUMP Ambush */
send(a, 'spam', end1 + Math.floor(V.QUESTS.spam.len / 2) + 1, (r, am) => r > 2600 && r < 7500 && !am); /* after Nap Time: Loot */
send(bb, 'cold', GATE + 2, (r, am) => r < 1200 && !am);                      /* Jackpot Egg */
send(c, 'kek', GATE + 3);                                                   /* still away at tip: Gone Questing */
send(d, 'wiz', GATE + 4);
send(e, 'mine', GATE + 5);
if (f) send(f, 'spam', GATE + 6, (r, am) => r > 8200 && !am);             /* Came Home Empty */
sim.push(row(GATE + 7, a.owner, 'pet:aura:' + a.id + ':off', 0.00000001)); sim.push(row(GATE + 9, a.owner, 'pet:aura:' + a.id + ':on', 0.00000001));
const bad1 = row(GATE + 8, c.owner, 'pet:quest:' + c.id + ':spam', amt(c.id, 'spam', GATE + 8)); sim.push(bad1); /* already away: must be rejected */
const below = row(GATE - 3, a.owner, 'pet:quest:' + a.id + ':spam', 690); sim.push(below); /* below the gate: unknown tag */
const { w, simH } = run(sim, GATE);
const offSim = run(sim, null).w; V._setQuestActivation(GATE);
console.log('\nresults at tip', TIP);
P.forEach(p => { const q = V.questInfo(w, w.byId[p.id], TIP); const x = w.byId[p.id]; console.log(' #' + p.id, JSON.stringify({ away: q && q.away, hist: (x.questHist || []).map(h => [h.code, h.tier, h.ambush ? 'AMBUSH' : '', (h.rewards || []).map(r => r.kind + (r.label ? ':' + r.label : r.n ? ':' + r.n : r.petId ? ':#' + r.petId : '')).join('+')]), badges: x.questBadges, prog: x.questProgress, looks: (q.looks||[]).map(l=>l.id||l.name||l), nap: q && q.napUntil, pob: V.pobOf(w, x), flame: V.flameTierOf(w, x.owner) })); });
/* assertions */
check(V.questOn(TIP), 'gate set in memory for the sim');
check(offSim.pets.length === off.pets.length, 'gate off: simulated quest tags change nothing but community food');
const A1 = w.byId[a.id]; check(A1.questHist && A1.questHist.length === 2, 'pet a finished 2 spam runs');
check(A1.questHist[0].tier === 'haul' && A1.questHist[0].ambush, 'first run Legendary Haul + Ambush');
check(A1.questBadges && A1.questBadges.spam === 2 && A1.questBadges.funtrump === 1, 'spam badge x2 + FUNTRUMP');
check(A1.questHist[0].free === true && A1.questHist[1].free === false, 'first quest free, second paid');
const B1 = w.byId[bb.id]; check(B1.questHist && B1.questHist[0].tier === 'haul' && B1.questHist[0].rewards.some(r => r.kind === 'egg'), 'cold haul -> Jackpot Egg');
const egg = B1.questHist[0].rewards.find(r => r.kind === 'egg'); const EP = egg && w.byId[egg.petId]; check(EP && EP.owner === bb.owner && EP.jackpot, 'Jackpot Egg hatched to owner');
check(V.questInfo(w, w.byId[c.id], TIP).away, 'kek pet still away');
check(String(V.questBusyWhy(w.byId[c.id], TIP) || '').length > 0, 'away pet busy reason');
const badRow = (w.log || []).find(l => l.tx === bad1.tx_hash); check(!badRow || badRow.invalid || badRow.kind !== 'quest', 'double send rejected');
{ const ex = w.pets.find(p => ['nakamoto', 'wizard', 'kek', 'funtrump'].includes(p.species) && !p.dead && !p.released && V.isMythic(p) && !V.questBusyWhy(p, TIP));
  check(!ex || V.questWhy(w, ex, ex.owner, 'spam', 9999, TIP) === null, 'player-held former community species Mythic can quest' + (ex ? ' (#' + ex.id + ' ' + ex.species + ')' : '')); }
/* FUNTRUMP rules (2026-10-24): a second rules copy where pet f counts as a player-held FUNTRUMP (no real one exists yet in the snapshot) */
if (f) { const c2 = load(src => src.replace("function isFuntrumpPet(p) { return !!p && p.species === 'funtrump' && !p.community; }", "function isFuntrumpPet(p) { return !!p && p.id === " + f.id + "; }")), V2 = c2.V2Rules;
  V2._setQuestActivation(GATE); const hs = Object.assign({}, baseHashes, simH); const rows = SNAP.rows.concat(sim).sort((x, y) => x.block_index - y.block_index || x.tx_index - y.tx_index);
  const w2 = V2.replay(rows, hs, [], { tip: TIP, live: c2.LiveEngine && c2.LiveEngine.RealCore });
  const a2 = w2.byId[a.id], f2 = w2.byId[f.id];
  check(!a2.questHist[0].ambush && !(a2.questBadges.funtrump), 'no Ambush on others while FUNTRUMP is Gone Questing');
  check(f2.questHist[0].ftOwn && f2.questBadges.funtrump >= 1, "FUNTRUMP's own quest always earns the FUNTRUMP badge");
  check(/% AMBUSH_1_IN < \(isFT \? 2 : 1\)/.test(fs.readFileSync(path.join(ROOT, 'js/v2-rules.js'), 'utf8')), 'FUNTRUMP ambush odds 2 in 69'); }
fs.writeFileSync(opt('--out') || '/workspace/tmp/quest-sim.json', JSON.stringify({ gate: GATE, tip: TIP, rows: sim, simHashes: simH, plan, picked: P.map(p => p.id), tied }));
/* who may quest (2026-10-24 go-live): community trackers never; player pets only when Mythic */
{ const cm = w.pets.find(p => p.community && !p.dead) || Object.assign({}, a, { community: true }); check(!!cm && V.questWhy(w, cm, cm.owner, 'spam', 9999, TIP) !== null, 'community pet cannot quest' + (cm ? ' (#' + cm.id + ')' : ''));
  const nm = w.pets.find(p => !p.community && !p.dead && !p.released && !V.isMythic(p)); check(!!nm && V.questWhy(w, nm, nm.owner, 'spam', 9999, TIP) !== null, 'non-Mythic player pet cannot quest (#' + (nm && nm.id) + ')');
  const bRow = (w.log || []).find(l => l.tx === below.tx_hash); check(!w.byId[a.id].questHist.some(h => h.start < GATE), 'burn below the gate did not start a quest'); }
console.log('\nchecks ok', ok, 'failed', bad); process.exitCode = bad ? 1 : 0;
