#!/usr/bin/env node
/* 1 OF 1 CROSSES + TWINS ALIKE FOR EVERY TWIN (branch allpets-crosses-1101, owner Nov 1 2026 7:36 PM CT, PREVIEW). Gates null on main (tested via setters).
 * Crosses: a baby with a Bo Jackson or Rarepigeon parent gets that 1 of 1's body in the partner's colours + tell; two hybrid-engine 1 of 1s (Viking,
 * Lord Kekamozard, Don Kekamoto) give a fixed mixed hybrid plan. Looks only: species / tier / stats / name unchanged. Twins: breed AND jackpot twins alike.
 * node tools/allpets-crosses-test.js */
'use strict';
const { load, snap, run, fakeHash } = require('./lib/load-rules');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const c = load(['js/kek-sprite.js', 'js/wizard-sprite.js', 'js/funtrump-sprite.js', 'js/homer-sprite.js', 'js/viking-sprite.js', 'js/bo-sprite.js', 'js/rarepigeon-sprite.js', 'js/contest-sprite.js']), _vr = (c.setInterval = () => 0, c.document.readyState = 'loading', c.clearInterval = () => {}, c.requestAnimationFrame = () => 0, c.ImageData = c.ImageData || function (d, w, h) { this.data = d; this.width = w; this.height = h; }, require('vm').runInContext(require('fs').readFileSync(require('path').join(__dirname, '../js/v2-render.js'), 'utf8'), c)), V = c.V2Rules, P = c.PetCore, R = c.V2Render, s0 = snap(), H = Object.assign({}, c.XCPETS_BLOCK_HASHES, s0.hashes);
ok(V.crossGate() === 974214 && V.ACTIVATE_ONEOFONE_CROSS_BLOCK === 974214 && !V.crossOn(974213) && V.crossOn(974214), '1 of 1 cross gate 974214 (go-live)');
ok(V.twinAlikeGate() === 974214 && !V.twinAlikeOn(974213) && V.twinAlikeOn(974214) && V.borpGate() === 974214, 'twins-alike + Bo Pigeon gates 974214 (go-live)');
const tip = Math.max.apply(null, s0.rows.map(r => r.block_index).filter(b => H[b])), s = { tip, rows: s0.rows.filter(r => r.block_index <= tip), hashes: Object.assign({}, s0.hashes) };
const END = Math.max(tip, V.ACTIVATE_VIKING_BLOCK) + 400; for (let x = tip - 50; x <= END + 5000; x++) if (!s.hashes[x] && !H[x]) s.hashes[x] = fakeHash(x);
V._setBo(Math.min(V.ACTIVATE_BO_BLOCK, tip)); V._setRp(Math.min(V.ACTIVATE_RP_BLOCK, tip)); V._setViking(Math.min(V.ACTIVATE_VIKING_BLOCK, tip)); V._setBurnLordsSnapshot(tip - 20);
['_setSupremeLineage', '_setOneOfOneLooks', '_setRareTiers', '_setHybridFix'].forEach(k => V[k] && V[k](tip)); /* live-like: these are on before the cross gate */
const w = run(c, s, [], tip), one = id => w.pets.find(p => p.species === id || (p.supreme && p.supreme.id === id && p.supreme.of === 1));
const bo = one('bojackson'), rp = one('rarepigeon'), vk = one('viking'), km = one('archmage'), dn = one('don'); ok(bo && rp && vk && km && dn, 'all five 1 of 1s in the test world');
const wb = JSON.parse(JSON.stringify(w)); wb.byId = {}; wb.pets.forEach(p => { wb.byId[p.id] = p; }); [bo, rp, vk, km, dn].forEach(q => { wb.byId[q.id].stage = 3; wb.byId[q.id].care = 999; });
const wbRest = JSON.stringify(Object.assign({}, wb, { pets: undefined, byId: undefined }));
const clone = (ids) => { const ww = JSON.parse(wbRest); ww.pets = wb.pets.slice(); ww.byId = Object.assign({}, wb.byId); (ids || []).forEach(id => { const q = JSON.parse(JSON.stringify(wb.byId[id])); ww.byId[id] = q; ww.pets[ww.pets.indexOf(wb.byId[id])] = q; }); return ww; };
const live = wb.pets.filter(p => !p.dead && !p.released && !p.supreme && !p.burnLord && !p.contest && !['bojackson', 'rarepigeon', 'viking'].includes(p.species));
const bySp = {}; live.forEach(p => { if (!bySp[p.species]) bySp[p.species] = p; });
const plainSp = P.SPECIES.map(x => x.id).filter(id => bySp[id]); const hyb = live.filter(p => V.isHybrid(p.species) && p.art && p.art.hybrid).slice(0, 4);
ok(plainSp.length >= 10, 'plain partners ' + plainSp.length); ok(hyb.length >= 2, 'hybrid partners ' + hyb.length);
const strip = k => { const o = JSON.parse(JSON.stringify(k)); delete o.art.cross; return JSON.stringify(o); };
const px = (a, st, g) => R.framesWith(a, st, g || [], [])[0].data, dif = (a, b) => { let d = 0; for (let q = 0; q < 4096; q += 4) if (a[q] !== b[q] || a[q + 1] !== b[q + 1] || a[q + 2] !== b[q + 2]) d++; return d; };
const G = END; let i = 0; const sheet = [];
function pair(A, B, tag) { const bh = fakeHash(G + (i++ % 300)), tx = 'test:cx:' + tag + ':' + i;
  V._setOneOfOneCross(null); const w0 = clone([A.id, B.id]), k0 = V.breedOne(w0, w0.byId[A.id], w0.byId[B.id], bh, tx, G, A.owner);
  V._setOneOfOneCross(G + 1); const wl = clone([A.id, B.id]), kl = V.breedOne(wl, wl.byId[A.id], wl.byId[B.id], bh, tx, G, A.owner);
  V._setOneOfOneCross(G); const w1 = clone([A.id, B.id]), k1 = V.breedOne(w1, w1.byId[A.id], w1.byId[B.id], bh, tx, G, A.owner); V._setOneOfOneCross(null);
  ok(JSON.stringify(kl) === JSON.stringify(k0), tag + ': gate after the block = unchanged'); ok(!k0.art.cross, tag + ': no cross with the gate off');
  ok(k1.species === k0.species && k1.tier === k0.tier && JSON.stringify(k1.stats) === JSON.stringify(k0.stats) && k1.name === k0.name, tag + ': species / tier / stats / name unchanged');
  return { k0, k1 }; }
/* Bo / Rarepigeon times every plain species, hybrids, and the other 1 of 1s */
[[bo, 'bojackson'], [rp, 'rarepigeon']].forEach(([O, body]) => {
  const partners = plainSp.map(id => bySp[id]).concat(hyb, [vk, km, dn]);
  partners.forEach((Q, n) => { [[O, Q], [Q, O]].forEach(([A, B], ord) => { const tag = body + '-times-' + (Q.supreme ? Q.supreme.id : Q.species) + (ord ? ':rev' : ''), r = pair(A, B, tag), x = r.k1.art.cross;
    ok(x && x.body === body, tag + ': cross body ' + body); ok(strip(r.k1) === JSON.stringify(r.k0), tag + ': only art.cross added');
    const want = Q.species === 'viking' ? 'viking' : Q.supreme ? ({ archmage: 'kekamozard', don: 'don' })[Q.supreme.id] : (Q.art.hybrid ? Q.art.hybrid.shape : Q.species); ok(x && x.tell === want, tag + ': tell ' + (x && x.tell) + ' want ' + want);
    if (!ord) { for (const st of [0, 1, 3, 5]) { let f; try { f = R.framesWith(r.k1.art, st, [], []); } catch (e) { ok(false, tag + ' render st' + st + ' ' + e.message); continue; } ok(f.length === 4 && f[0].data.length === 4096, tag + ' frames st' + st);
        const plain = px(Object.assign({}, r.k1.art, { cross: null, species: body, hybrid: null }), st); ok(dif(f[0].data, plain) > (st ? 6 : 2), tag + ': differs from the plain ' + body + ' st' + st); }
      ok(V.breederBadges(w, Object.assign({}, r.k1, { children: [] })).some(b => b.id === 'cross' && /Bo|Pigeon/.test(b.tip)), tag + ': 1 OF 1 CROSS badge');
      if (n < 25) sheet.push({ tag, name: V.crossLabel(x), sp: r.k1.species, f: [0, 1, 2, 3, 4, 5].map(st => Array.from(px(r.k1.art, st))), before: (() => { try { return Array.from(px(r.k0.art, 4)); } catch (e) { console.log("main render fails (gate off) " + tag + " " + r.k0.species + " " + JSON.stringify(r.k0.art.hybrid).slice(0, 300)); return null; } })() }); } }); }); });
/* Bo times Rarepigeon: no cross (Bo Pigeon gate), plain times plain: no cross */
{ const r = pair(bo, rp, 'boxrp'); ok(!r.k1.art.cross, 'Bo times Rarepigeon: no cross body (Bo Pigeon has its own gate)'); const a = bySp[plainSp[0]], b2 = bySp[plainSp[1]], r2 = pair(a, b2, 'plain'); ok(!r2.k1.art.cross && JSON.stringify(r2.k1) === JSON.stringify(r2.k0), 'plain times plain: unchanged'); }
/* plan crosses between the hybrid-engine 1 of 1s */
const plans = [[km, dn, 'don+kekamozard'], [vk, km, 'kekamozard+viking'], [vk, dn, 'don+viking']];
plans.forEach(([A, B, key]) => { [[A, B], [B, A]].forEach(([X, Y], ord) => { const r = pair(X, Y, key + (ord ? ':rev' : '')), D = V.CROSS_PLANS[key], h = r.k1.art.hybrid;
  ok(r.k1.art.cross && r.k1.art.cross.plan === key, key + ': plan cross'); ok(h && h.shape === D.shape && h.color === D.color && JSON.stringify(h.parts) === JSON.stringify(D.parts) && r.k1.art.species === D.shape, key + ': plan body ' + D.shape + ' / ' + D.color);
  ok(!!r.k1.hybrid === !!r.k0.hybrid, key + ': kid.hybrid as before');
  if (!ord) { for (const st of [0, 1, 3, 5]) { try { R.framesWith(r.k1.art, st, [], []); ok(true); } catch (e) { ok(false, key + ' render ' + e.message); } }
    ok(dif(px(r.k1.art, 4), px(r.k0.art, 4)) > 10, key + ': looks different from before'); ok(V.crossLabel(r.k1.art.cross) === D.name, key + ' label');
    sheet.push({ tag: key, name: D.name, sp: r.k1.species, f: [0, 1, 2, 3, 4, 5].map(st => Array.from(px(r.k1.art, st))), before: Array.from(px(r.k0.art, 4)) }); } }); });
/* gear on a cross body */
{ const r = pair(bo, bySp.pepe || bySp[plainSp[0]], 'gear'), gids = (c.V2Gear.ITEMS || []).map(x => x.id).filter(id => V.itemOf(id) && V.eligible(V.itemOf(id), r.k1.species, null, r.k1.tier)).slice(0, 40); let g = 0;
  gids.forEach(id => { try { R.framesWith(r.k1.art, 4, [id], []); g++; } catch (e) { ok(false, 'gear ' + id + ' ' + e.message); } }); ok(g === gids.length && g > 0, 'gear renders on a cross body (' + g + ')'); }
/* twins alike on a cross: the twin gets the same cross body */
{ const bv2 = Math.max(G, V.ACTIVATE_BREEDING_V2_BLOCK || 0) + 10; let got = 0;
  for (let j = 0; j < 4000 && got < 3; j++) { const bh = fakeHash(bv2 + (j % 97)), tx = 'test:cxtw' + j; if (!V.twinDraw(V.sha(bh + tx))) continue; const Q = bySp[plainSp[j % plainSp.length]];
    V._setOneOfOneCross(bv2); V._setTwinAlike(bv2); const ww = clone([bo.id, Q.id]); ww.byId[bo.id].lastBreed = null; ww.byId[bo.id].breeds = 0; const a = V.breed(ww, ww.byId[bo.id], ww.byId[Q.id], bh, tx, bv2, bo.owner), t = ww.byId[a.twinOf]; V._setOneOfOneCross(null); V._setTwinAlike(null);
    if (!t) continue; got++; ok(a.art.cross && JSON.stringify(t.art.cross) === JSON.stringify(a.art.cross), 'cross twin shares the cross body'); ok(t.twinAlike, 'cross twin alike');
    if (got === 1) sheet.push({ tag: 'twins', name: 'Twins ' + V.crossLabel(a.art.cross), sp: a.species, f: [Array.from(px(a.art, 4)), Array.from(px(t.art, 4))], before: null }); }
  ok(got >= 1, 'cross twins found ' + got); }
/* jackpot / ambush twins alike */
{ const Q = live.find(p => p.stage >= 3 && !V.isHybrid(p.species)); let got = 0, tw0 = 0;
  for (let j = 0; j < 3000 && got < 4; j++) { const bh = fakeHash(G + 7 + (j % 50)), tx = 'test:jp' + j;
    V._setTwinAlike(null); const w0 = clone([Q.id]), e0 = V._jackpotEgg(w0, w0.byId[Q.id], bh, tx, G, Q.owner, 'jackpot'); if (!e0.twinOf) continue; tw0++;
    V._setTwinAlike(G); const w1 = clone([Q.id]), e1 = V._jackpotEgg(w1, w1.byId[Q.id], bh, tx, G, Q.owner, 'jackpot'), t1 = w1.byId[e1.twinOf], t0 = w0.byId[e0.twinOf]; V._setTwinAlike(null); got++;
    ok(JSON.stringify(e0) === JSON.stringify(e1), 'jackpot first egg unchanged'); ok(t1 && t1.twinAlike && t1.species === e1.species && t1.tier === e1.tier, 'jackpot twin alike (species + tier)');
    ok(t1 && Object.keys(e1.stats).every(k => Math.abs(t1.stats[k] - e1.stats[k]) <= 1), 'jackpot twin stats within 1'); ok(t0 && t0.species !== undefined, 'gate off twin as before');
    if (e1.hybrid) ok(JSON.stringify(t1.hybrid.parts) === JSON.stringify(e1.hybrid.parts), 'jackpot hybrid twin shares parts');
    if (got === 1) sheet.push({ tag: 'jackpot-twins', name: 'Jackpot twins', sp: e1.species, f: [Array.from(px(e1.art, 4)), Array.from(px(t0.art, 4)), Array.from(px(t1.art, 4))], before: null }); }
  ok(got >= 1, 'jackpot twins found ' + got); }
/* sprites: every body times every tell, every stage, with and without gear */
{ const CS = require('../js/contest-sprite.js'), T = CS.CROSS.TELLS; ok(T.length >= 20, 'tells ' + T.length); let n = 0;
  ['bojackson', 'rarepigeon'].forEach(body => T.forEach(t => { for (let st = 0; st <= 5; st++) { const f = CS.CROSS.frames({ body, col: t === 'kekamozard' ? 'wizard' : t === 'don' ? 'kek' : t, tell: t }, st, '#14101e', st ? { hand: { item: 'stick', cols: ['#8a5a2b', '#c8955a'] } } : null); if (f.length === 4 && f[0].data.length === 4096) n++; } }));
  ok(n === 2 * T.length * 6, 'cross sprite frames ' + n); }
if (process.env.CROSS_SHEET) require('fs').writeFileSync(process.env.CROSS_SHEET, JSON.stringify(sheet));
console.log(pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
