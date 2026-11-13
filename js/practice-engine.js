/* PRACTICE NODE (practice-fun-1102, preview; owner Nov 1 2026 11:04 PM CT: "Practice mode isn't like playing at all. It just be really fun so
 * people want to play they should hatch the reallycool pets").
 * practice.html is the REAL play page (same screens, same V2Rules replay, same V2Render pets, same hatch reveal). This file is the pretend chain
 * it reads: a tiny in-browser "Counterparty node" whose burns live only in this browser (localStorage 'xcpets-practice-ledger'), answered by the
 * fetch router in js/practice-guard.js. Nothing is ever sent to a chain, a wallet or a server; the real game never reads this key, so practice
 * pets can never show up in the real rankings, feeds or replay.
 * The ONLY practice twist is luck: before a pretend burn is written, many pretend transaction ids are tried with the real rules (V2Rules.hatchArt,
 * the real breeding mutation draw, a full V2Rules.replay for gear / fights) and an exciting one is kept. Rule files are not changed.
 * Never kept: special 1-of-777 eggs, editions, a flame crown, a fire aura or a gold frame. */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory; else root.XcpPractice = factory(root); })(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';
  var LKEY = 'xcpets-practice-ledger', VERSION = 3;
  var START_TIP = 974400, START_BAL = 1000000, BPD = 144, UNIT = 1e8;
  /* practice addresses: valid-looking bech32 (js/v2-wallet.js validAddr), clearly not anyone's wallet */
  function pad(s) { while (s.length < 42) s += 'q'; return s; }
  var ME = pad('bc1qxcpetspractcepets'), NPCS = [pad('bc1qxcpetsrvlpepefan'), pad('bc1qxcpetsrvldegenz'), pad('bc1qxcpetsrvlwagmrc')];
  var NPC_NAMES = {}; NPC_NAMES[NPCS[0]] = 'Rival Pepe Fan'; NPC_NAMES[NPCS[1]] = 'Rival Degen'; NPC_NAMES[NPCS[2]] = 'Rival Wagmi Crew';
  /* boosted luck (pretend only). Real eggs: Legendary 3%, Rare 10%, Uncommon 27%, Common 60%. */
  var EGG_ODDS = [['legendary', 40], ['rare', 30], ['uncommon', 18], ['common', 12]]; /* single egg target tier, percent */
  var WOW_LEG = 70;          /* percent of practice Legendaries that also get a showy trait (laser eyes, galaxy / rainbow skin, aurora / cosmic sky) */
  var PACK_TRIES = { 12: 400, 144: 200 }, PACK_MS = { 12: 700, 144: 1600 }; /* best of up to N pretend boxes in a time budget */
  var BREED_ODDS = { glitch: 15, palette: 10 }; /* percent of practice breeds that come out with a Glitch / palette mutation (real: about 0.5% each) */
  var GRIND_MS = 900, GRIND_MAX = 16, LUCK_OFF = 20; /* LUCK_OFF: percent of those burns left to plain luck, so a fight can still be lost */  /* other luck (gear rolls, spins, fights, quests): best of up to 16 replays in 0.9 s */

  var ls = function () { return root.__xcpPracticeStore || null; };
  var L = null;
  function now() { return Date.now(); }
  function sha(s) { return root.PetCore.sha256Hex(String(s)); }
  function rnd64() { var a = new Uint8Array(32), s = ''; root.crypto.getRandomValues(a); for (var i = 0; i < 32; i++) s += (a[i] < 16 ? '0' : '') + a[i].toString(16); return s; }
  function hexTag(t) { var s = unescape(encodeURIComponent(String(t))), o = ''; for (var i = 0; i < s.length; i++) { var h = s.charCodeAt(i).toString(16); o += (h.length < 2 ? '0' : '') + h; } return o; }
  function r8(x) { return Math.round(Number(x) * UNIT) / UNIT; }

  /* ---- ledger */
  function blank() { return { v: VERSION, salt: rnd64().slice(0, 16), tip: START_TIP, start: START_TIP, bal: START_BAL, burned: 0, rows: [], n: 0, made: now(), stats: { hatched: 0, legendary: 0, wow: 0, glitch: 0 } }; }
  function load() { if (L) return L; var S = ls(); try { var o = S && JSON.parse(S.get(LKEY)); if (o && o.v === VERSION && Array.isArray(o.rows)) return (L = o); } catch (e) {} L = blank(); seed(L); save(); return L; }
  function save() { var S = ls(); if (S && L) try { S.set(LKEY, JSON.stringify(L)); } catch (e) {} }
  function blockHash(n) { var l = load(); n = Number(n); if (!(n > 0) || n > l.tip) return null; return sha('xcpets-practice-block:' + l.salt + ':' + n); }
  function row(l, src, tag, amt, b, tx) { l.n++; var r = { tx_index: 100000000 + l.n, tx_hash: tx || rnd64(), block_index: b, source: src, asset: 'XCPETS', asset_longname: null, quantity: Math.round(amt * UNIT), tag: hexTag(tag), status: 'valid', _t: tag }; l.rows.push(r); return r; }

  /* ---- the luck grinders (real rules, pretend tx ids) */
  var SPECIAL = null;
  function okArt(a, crownOk) { if (!SPECIAL) { SPECIAL = {}; (root.V2Rules.SPECIES12 || []).forEach(function (s) { SPECIAL[s.id || s] = 1; }); }
    return !!a && !!SPECIAL[a.species] && (crownOk || a.crown !== 'flame-crown') && !a.auraFire && !a.edition && !a.goldFrame && !a.burnLord && !a.supreme && !a.contest && !a.community && !a.rareTier && !a.boMark && !a.rpMark && !a.boLook && !a.rpLook; }
  function wowOf(a) { var n = 0; if (a.eyes === 'laser') n++; if (a.pattern === 'galaxy' || a.pattern === 'rainbow') n++; if (!a.bgV2 && (a.background === 'aurora' || a.background === 'cosmic')) n++; if (a.shades) n++; return n; }
  function pick(odds) { var t = 0, x = Math.random() * 100; for (var i = 0; i < odds.length; i++) { t += odds[i][1]; if (x < t) return odds[i][0]; } return odds[odds.length - 1][0]; }
  function eggScore(a) { return [0, 3, 9, 30][a.tierIndex | 0] + 8 * wowOf(a); }
  function grindHatch(bh, b, first) { var want = first ? 'legendary' : pick(EGG_ODDS), wow = first || (want === 'legendary' && Math.random() * 100 < WOW_LEG), best = null, bs = -1, t0 = now();
    for (var i = 0; i < 20000 && now() - t0 < 1500; i++) { var tx = rnd64(), a = (root.V2Rules._rawHatchArt || root.V2Rules.hatchArt)(bh, tx, b); if (!okArt(a)) continue;
      if (a.tier === want && (!wow || wowOf(a) > 0)) return { tx: tx, art: a };
      var s = a.tier === want ? 1000 + eggScore(a) : eggScore(a); if (s > bs) { bs = s; best = { tx: tx, art: a }; } }
    return best; }
  function grindPack(bh, b, n) { var best = null, bs = -1, tries = PACK_TRIES[n] || 8, t0 = now();
    for (var k = 0; k < tries * 6 && (k < tries || !best) && (!best || now() - t0 < (PACK_MS[n] || 500)) && now() - t0 < 6000; k++) { var tx = rnd64(), s = 0, ok = true, arts = [];
      for (var i = 0; i < n; i++) { var a = (root.V2Rules._rawHatchArt || root.V2Rules.hatchArt)(bh, tx + ':' + i, b); if (!okArt(a, true)) { ok = false; break; } s += eggScore(a); arts.push(a); }
      if (ok && s > bs) { bs = s; best = { tx: tx, arts: arts }; } }
    return best; }
  function mutationOf(bh, tx) { var hex = sha(bh + tx), seed = 'XCPETS:v2:mutation:' + hex, n = 0;
    function next() { var h = sha(seed + ':' + (n++)); return parseInt(h.slice(0, 8), 16); }
    if (next() % 100 !== 0) return null; return next() % 2 ? 'glitch' : 'palette'; }
  function breedWant() { var x = Math.random() * 100; return x < BREED_ODDS.glitch ? 'glitch' : x < BREED_ODDS.glitch + BREED_ODDS.palette ? 'palette' : null; }
  function grindBreed(bh, want) { if (want === undefined) want = breedWant(); if (!want) return null;
    for (var i = 0; i < 40000; i++) { var tx = rnd64(); if (mutationOf(bh, tx) === want) return tx; } return null; }
  /* breeding: the wanted mutation (or none), then the best of a few real replays (hybrid kids and high tiers score higher; nothing forbidden) */
  function grindBreedFull(src, tag, amt, b, bh) { var want = breedWant(), l = load(), base = l.rows.slice(), best = null, bs = -Infinity, t0 = now();
    for (var k = 0; k < 8; k++) { if (k && now() - t0 > GRIND_MS) break; var tx = want ? grindBreed(bh, want) : rnd64(); if (!tx) tx = rnd64(); var w;
      try { w = replayRows(base.concat([fake(src, tag, amt, b, tx)]), b); } catch (e) { return tx; }
      if (forbidden(w)) continue; var s = myScore(w) + Math.random(); if (s > bs) { bs = s; best = tx; } }
    return best; }

  /* ---- replays (the real V2Rules.replay over the practice ledger) */
  function hashesTo(tip) { var h = {}, l = load(); var from = Math.max(l.start - 40 * BPD, 0); l.rows.forEach(function (r) { h[r.block_index] = blockHash(r.block_index); }); for (var b = Math.max(from, l.tip - 2 * BPD); b <= tip; b++) h[b] = h[b] || hashAt(b, tip); return h; }
  function hashAt(b, tip) { var l = load(); return sha('xcpets-practice-block:' + l.salt + ':' + b); }
  function replayRows(rows, tip) { var V = root.V2Rules, E = root.LiveEngine || {}; var h = {}, l = load(), G = [V.ACTIVATE_FIRESALE_BLOCK, V.questGate && V.questGate(), V.raidGate && V.raidGate()].filter(function (x) { return x != null; });
    var lo = G.length ? Math.min.apply(null, G) : tip; rows.forEach(function (r) { h[r.block_index] = hashAt(r.block_index); }); for (var b = lo; b <= tip; b++) if (!h[b]) h[b] = hashAt(b);
    var sorted = rows.slice().sort(function (a, b) { return b.tx_index - a.tx_index; });
    return (V._rawReplay || V.replay)(sorted, h, [], { tip: tip, live: E.RealCore }); }
  function forbidden(w) { var bad = false; (w.pets || []).forEach(function (p) { if (bad || p.owner !== ME) return; var a = p.art || {};
      if (a.auraFire || a.edition || a.goldFrame || p.goldFrame || p.auraFire || (p.flameLooks || []).indexOf('flame-aura') >= 0) bad = true; }); return bad; }
  function myScore(w) { var s = 0; (w.pets || []).forEach(function (p) { if (p.owner !== ME || p.dead || p.released) return; var a = p.art || {};
      s += [0, 3, 9, 30][a.tierIndex | 0] + 8 * wowOf(a) + (p.mutation || a.mutation ? 40 : 0) + (/^hyb/.test(p.species || '') ? 6 : 0) + 6 * (p.wins || 0) + 2 * (p.stage || 0); });
    var items = w.itemList || Object.keys(w.items || {}).map(function (k) { return w.items[k]; });
    items.forEach(function (g) { var o = g && w.byId && w.byId[g.petId || g.owner || g.pet]; if (!o || o.owner !== ME) return; s += 4 + 6 * (g.tier || g.tierIndex || 0) + (g.legendary ? 30 : 0); });
    return s; }
  function grindReplay(src, tag, amt, b) { var l = load(), best = null, bs = -Infinity, t0 = now(), base = l.rows.slice();
    for (var k = 0; k < GRIND_MAX; k++) { if (k && now() - t0 > GRIND_MS) break; var tx = rnd64(), cand = base.concat([fake(src, tag, amt, b, tx)]), w;
      try { w = replayRows(cand, b); } catch (e) { return tx; }
      if (forbidden(w)) continue; var s = myScore(w) + Math.random(); if (s > bs) { bs = s; best = tx; } if (!k && Math.random() * 100 < LUCK_OFF) return tx; }
    return best || rnd64(); }
  function fake(src, tag, amt, b, tx) { return { tx_index: 100000000 + load().n + 1, tx_hash: tx, block_index: b, source: src, asset: 'XCPETS', quantity: Math.round(amt * UNIT), tag: hexTag(tag), status: 'valid' }; }

  /* ---- NPC rivals: three pretend players with grown pets, so Fights and Breeding have partners */
  function seed(l) { var V = root.V2Rules, b0 = l.start - 11 * BPD;
    NPCS.forEach(function (a, k) { for (var j = 0; j < 2; j++) { var b = b0 + k * 3 + j, bh = sha('xcpets-practice-block:' + l.salt + ':' + b), g = grindHatch(bh, b) || { tx: rnd64() }; row(l, a, 'pet:hatch', 69, b, g.tx); } });
    var w = replayRows(l.rows, b0 + 20), ids = w.pets.filter(function (p) { return NPCS.indexOf(p.owner) >= 0; }).map(function (p) { return { id: p.id, owner: p.owner }; });
    for (var d = 1; d <= 10; d++) ids.forEach(function (p, i) { if (i % 3 === 2 && d > 6) return; /* some Adults, some Mythic */ row(l, p.owner, 'pet:feed:' + p.id, 9660, b0 + d * BPD + 5 + i); });
    l.npcPets = ids.map(function (p) { return p.id; }); }
  function npcTurn() { var l = load(), w; try { w = replayRows(l.rows, l.tip); } catch (e) { return 0; } var acts = [];
    (w.fights || []).forEach(function (F) { if (!F || F.status !== 'open') return; var B = w.byId[F.b]; if (B && NPCS.indexOf(B.owner) >= 0 && l.tip - F.block <= 140) acts.push([B.owner, 'pet:accept:' + F.id, 690]); });
    (w.breedReqs || []).forEach(function (q) { if (q.used || l.tip - q.block > 140) return; var B = w.byId[q.b]; if (B && NPCS.indexOf(B.owner) >= 0) acts.push([B.owner, 'pet:breed:' + q.b + ':' + q.a, 690, true]); });
    acts.forEach(function (x) { var b = ++l.tip, bh = blockHash(b), tx = x[3] ? (grindBreed(bh) || rnd64()) : grindReplay(x[0], x[1], x[2], b); row(l, x[0], x[1], x[2], b, tx); });
    if (acts.length) save(); return acts.length; }

  /* ---- pretend burns from the practice wallet */
  function burn(plan) { var l = load(), tag = String(plan.tag || ''), amt = r8(plan.amount), T = tag.toLowerCase();
    if (!(amt > 0)) throw err('That burn has no amount.');
    if (amt > l.bal + 1e-9) throw err('Not enough practice XCPETS. Tap "Refill" in the PRACTICE bar (it is pretend and free).');
    if (/^pet:hatchzap$/.test(T)) throw err('The Electric Shock Box (1,000 eggs) is not in practice.');
    if (/^pet:hatch(12|144|wiz)$/.test(T) || (T === 'pet:hatch' && l.stats.hatched >= 1)) throw err('One practice pet per browser. Reset the practice pet if you want a new one.');
    if (/^pet:aura:/.test(T) || (/^pet:look:/.test(T) && /:ka:/.test(T + ':'))) throw err('Flame looks are not part of practice.');
    if (/^pet:(order|deed|unsell|swap|give|gives|sell)/.test(T) || plan.kind) throw err('Trading and gifting are real-wallet only. In practice, hatch, feed, gear up, fight and breed.');
    var b = ++l.tip, bh = blockHash(b), tx = null, src = ME;
    if (T === 'pet:hatch' || T === 'pet:hatchwiz') { var g = grindHatch(bh, b, !l.stats.hatched); tx = g && g.tx; if (g) { l.stats.hatched++; if (g.art.tierIndex === 3) l.stats.legendary++; if (wowOf(g.art)) l.stats.wow++; } }
    else if (T === 'pet:hatch12' || T === 'pet:hatch144') { var n = T === 'pet:hatch12' ? 12 : 144, pk = grindPack(bh, b, n); tx = pk && pk.tx; if (pk) pk.arts.forEach(function (a) { l.stats.hatched++; if (a.tierIndex === 3) l.stats.legendary++; if (wowOf(a)) l.stats.wow++; }); }
    else if (/^pet:breed:/.test(T)) { tx = grindBreedFull(src, tag, amt, b, bh); }
    else if (/^pet:(roll|fr|of|spin|usespin|fight|accept|quest|raid|croll)\b/.test(T)) tx = grindReplay(src, tag, amt, b);
    if (!tx) tx = rnd64();
    var r = row(l, src, tag, amt, b, tx); l.bal = r8(l.bal - amt); l.burned = r8(l.burned + amt); save();
    try { npcTurn(); } catch (e) {}
    return { txid: r.tx_hash, block: b }; }
  function err(m) { var e = new Error(m); e.retry = false; e.practice = true; return e; }
  function nextDay() { var l = load(); l.tip += BPD; save(); try { npcTurn(); } catch (e) {} return l.tip; }
  /* "Grow a day": feed every hungry practice pet (the real feed burn, one meal each, its real cost), then skip to the next chain day */
  function growDay() { var l = load(), w = replayRows(l.rows, l.tip), V = root.V2Rules, n = 0; if (l.bal < START_BAL / 4) l.bal = START_BAL; /* pretend money: a free top-up so growing never stalls */
    (w.pets || []).forEach(function (p) { if (p.owner !== ME || p.dead || p.released || p.fedToday || !(p.nextMeal > 0)) return;
      var amt = p.nextMeal; try { if (V.mealCost) { var c = V.mealCost(w, p, p.nextMeal, l.tip + 1); if (c > amt) amt = c; } } catch (e) {}
      if (amt > l.bal) return; try { burn({ tag: 'pet:feed:' + p.id, amount: amt }); n++; } catch (e) {} });
    nextDay(); return n; }
  function refill() { var l = load(); l.bal = START_BAL; save(); return l.bal; }
  function reset() { L = blank(); seed(L); save(); return L; }
  function state() { var l = load(); return { tip: l.tip, bal: l.bal, burned: l.burned, rows: l.rows.length, day: Math.floor((l.tip - l.start) / BPD) + 1, stats: l.stats }; }

  /* ---- display tidy (practice page only): the real art can roll a flame crown; practice shows a jeweled crown instead and never a fire aura,
   * gold frame or edition mark. Applied to copies the page reads (wrapped V2Rules.replay / hatchArt exports); the rules themselves are untouched. */
  var FLAGS = ['auraFire', 'goldFrame', 'edition', 'burnLord', 'supreme'];
  function tidyArt(a) { if (!a || typeof a !== 'object') return a; if (a.crown === 'flame-crown') a.crown = 'jeweled-crown'; FLAGS.forEach(function (k) { if (a[k]) a[k] = undefined; }); return a; }
  function tidyWorld(w) { if (w && w.pets) w.pets.forEach(function (p) { tidyArt(p.art); FLAGS.forEach(function (k) { if (p[k]) p[k] = undefined; }); if (Array.isArray(p.flameLooks)) p.flameLooks = p.flameLooks.filter(function (x) { return x !== 'flame-aura' && x !== 'flame'; }); if (p.aura === 'flame' || p.aura === 'flame-aura') p.aura = null; }); return w; }
  function wrapRules(V) { if (!V || V.__practiceWrapped) return; var R = V.replay, H = V.hatchArt; V.__practiceWrapped = true;
    V.replay = function () { return tidyWorld(R.apply(this, arguments)); }; V.hatchArt = function () { return tidyArt(H.apply(this, arguments)); }; V._rawHatchArt = H; V._rawReplay = R; }

  /* ---- the pretend node: answers the same URLs rjs/chain.js and js/v2-chain.js read */
  function serve(url) { var l = load(), u; try { u = new URL(url, root.location && root.location.href); } catch (e) { return null; } var p = u.pathname.replace(/\/+$/, '') || '/';
    var core = /:4000$/.test(u.host) || /counterparty|unspendablelabs|xcp\.fun|node\.xcpets\.fun/.test(u.host), mp = /mempool\.space|blockstream\.info/.test(u.host);
    if (mp) { var m;
      if ((m = /\/block-height\/(\d+)$/.exec(p))) { var h = blockHash(m[1]); return h ? txt(h) : txt('Block height out of range', 404); }
      if (/\/blocks\/tip\/height$/.test(p)) return txt(String(l.tip));
      if (/\/fees\/recommended$/.test(p)) return json({ fastestFee: 1, halfHourFee: 1, hourFee: 1, economyFee: 1, minimumFee: 1 });
      if (/\/tx\/[0-9a-f]{64}\/status$/.test(p)) return json({ confirmed: true });
      return txt('not in practice', 404); }
    if (!core) return null;
    p = p.replace(/^\/v2/, '') || '/';
    if (p === '/' || p === '') return json({ result: { counterparty_height: l.tip, last_block: { block_index: l.tip }, network: 'mainnet', practice: true } });
    if (/^\/assets\/XCPETS\/destructions$/i.test(p)) return json({ result: l.rows.slice().reverse().map(clean), next_cursor: null, result_count: l.rows.length });
    var m2;
    if ((m2 = /^\/blocks\/(\d+)$/.exec(p))) { var bh = blockHash(m2[1]); return bh ? json({ result: { block_index: Number(m2[1]), block_hash: bh } }) : json({ error: 'Not found' }, 404); }
    if ((m2 = /^\/addresses\/([^/]+)\/balances\/XCPETS$/i.exec(p))) return json({ result: [{ address: m2[1], asset: 'XCPETS', quantity: m2[1] === ME ? Math.round(l.bal * UNIT) : NPCS.indexOf(m2[1]) >= 0 ? 1e14 : 0 }] });
    if ((m2 = /^\/transactions\/([0-9a-f]{64})$/.exec(p))) { var r = l.rows.filter(function (x) { return x.tx_hash === m2[1]; })[0]; return r ? json({ result: { tx_hash: r.tx_hash, block_index: r.block_index, confirmed: true } }) : json({ error: 'Not found' }, 404); }
    return json({ result: [], next_cursor: null, result_count: 0 }); }
  function clean(r) { var o = {}; Object.keys(r).forEach(function (k) { if (k !== '_t') o[k] = r[k]; }); return o; }
  function json(o, st) { return { status: st || 200, type: 'application/json', body: JSON.stringify(o) }; }
  function txt(s, st) { return { status: st || 200, type: 'text/plain', body: String(s) }; }

  return { ME: ME, NPCS: NPCS, NPC_NAMES: NPC_NAMES, LKEY: LKEY, START_BAL: START_BAL, START_TIP: START_TIP, EGG_ODDS: EGG_ODDS, WOW_LEG: WOW_LEG, BREED_ODDS: BREED_ODDS, PACK_TRIES: PACK_TRIES,
    tidyArt: tidyArt, tidyWorld: tidyWorld, wrapRules: wrapRules, load: load, save: save, serve: serve, burn: burn, nextDay: nextDay, growDay: growDay, refill: refill, reset: reset, state: state, blockHash: blockHash, npcTurn: npcTurn,
    _grindHatch: grindHatch, _grindPack: grindPack, _grindBreed: grindBreed, _mutationOf: mutationOf, _okArt: okArt, _wowOf: wowOf, _replay: replayRows, _forget: function () { L = null; } };
});
