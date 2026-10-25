#!/usr/bin/env node
/* EGG POWER tests (dev only; hotel-breed-power): js/egg-power.js must match the real breed outcome.
 * Breeds real pairs through V2Rules.breedOne (js/v2-rules.js) on many hashes and checks every egg's Power and stats fall inside the preview
 * range, the mean is close to the preview's expected Power, and the hybrid best-stat keep and carried floors hold.  node tools/egg-power-test.js */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');
const REPO = path.resolve(__dirname, '..');
const SCRIPTS = ['js/pet-core.js', 'js/bonus-gear.js', 'js/v2-gear.js', 'js/v2-fit.js', 'js/kek-sprite.js', 'js/wizard-sprite.js', 'js/v2-rules.js', 'js/egg-power.js'];
const st = {}, ls = { getItem: k => st[k] || null, setItem: (k, v) => { st[k] = String(v); }, removeItem: k => { delete st[k]; } };
const win = { console: { log() {}, warn() {}, error() {}, info() {} }, localStorage: ls, sessionStorage: ls, location: { search: '', hostname: 'xcpets.fun', href: 'https://xcpets.fun/' }, navigator: { userAgent: 'node' }, setTimeout, clearTimeout, crypto: crypto.webcrypto, TextEncoder, TextDecoder };
win.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ getContext: () => null, style: {} }), addEventListener() {}, body: null, documentElement: { style: {} } };
win.addEventListener = () => {}; win.window = win; win.self = win; win.globalThis = win;
const ctx = vm.createContext(win); for (const f of SCRIPTS) { const p = path.join(REPO, f); if (fs.existsSync(p)) vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f }); }
const V = ctx.V2Rules, E = ctx.EggPower, H = s => crypto.createHash('sha256').update(s).digest('hex');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const S = (v, s, g, z, l) => ({ vigor: v, spark: s, grit: g, zoom: z, luck: l }), pow = s => Object.values(s).reduce((a, b) => a + b, 0);
const B = 972900, mkW = () => ({ pets: [], byId: {}, nextId: 50000, owners: {} });
const pet = (id, sp, tier, stats, o) => Object.assign({ id, species: sp, tier, stats, owner: 'bc1qme', breeds: 0, children: [], parents: [] }, o || {});
const cases = [
  ['same species', pet(1, 'pepe', 1, S(20, 14, 9, 30, 11)), pet(2, 'pepe', 0, S(12, 18, 25, 7, 16))],
  ['cross species', pet(3, 'pepe', 0, S(10, 22, 8, 14, 9)), pet(4, 'doge', 2, S(31, 12, 19, 11, 26))],
  ['carried floor', pet(5, 'wojak', 0, S(5, 5, 5, 5, 5), { carried: [{ stat: 'zoom', value: 40, from: 9 }] }), pet(6, 'wojak', 0, S(7, 9, 4, 6, 8))],
  ['low stats', pet(7, 'chud', 0, S(1, 2, 1, 3, 1)), pet(8, 'chud', 0, S(1, 1, 2, 1, 1))]];
for (const [name, A, Bp] of cases) {
  const pv = E.preview(A, Bp, B); let sum = 0, n = 0, inRange = true, statOk = true, hy = 0; const N = 1500;
  for (let i = 0; i < N; i++) { let kid; try { kid = V.breedOne(mkW(), JSON.parse(JSON.stringify(A)), JSON.parse(JSON.stringify(Bp)), H(name + i), 'tx' + i, B, 'bc1qme'); } catch (e) { ok(false, name + ' breedOne threw ' + e.message); break; }
    const P = pow(kid.stats); sum += P; n++; if (P < pv.lo || P > pv.hi) inRange = false; if (kid.hybrid) hy++;
    for (const k of E.KEYS) if (kid.stats[k] < pv.stats[k].lo || kid.stats[k] > pv.stats[k].hi + (pv.bredTrue ? 3 : 0)) statOk = false;
    if (A.carried && kid.stats.zoom < 40) statOk = false; }
  const mean = sum / n; console.log(name + ': preview ' + pv.lo + '..' + pv.hi + ' exp ' + pv.exp + ' | real mean ' + mean.toFixed(2) + ' hybrid ' + (hy / n * 100).toFixed(1) + '% (preview ' + pv.hybridPct + '%)');
  ok(inRange, name + ': every real egg Power inside the preview range'); ok(statOk, name + ': every real egg stat inside its range (and carried floor)');
  ok(mean >= pv.exp - 1 && mean <= pv.expHi + 1, name + ': real mean inside the expected Power band');
  if (pv.hybridPct) ok(Math.abs(hy / n * 100 - pv.hybridPct) < 4, name + ': hybrid share matches');
}
const x = E.preview(cases[1][1], cases[1][2], B); ok(x.passes.some(s => /best GRIT 8|best SPARK 22/.test(s)) && x.passes.some(s => /VIGOR 31/.test(s)), 'hybrid keeps each parent best stat');
ok(!/price|series|discount|×|\dx\b/i.test(JSON.stringify(cases.map(c => E.preview(c[1], c[2], B)))), 'words');
console.log('egg-power-test: ' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
