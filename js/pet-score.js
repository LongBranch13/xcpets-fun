/* XCPETS Pet Score (owner approved 2026-10-19 5:52 PM CT). Display only: a deterministic 0-1000 score computed off-chain from the replayed
 * world. No rule change, nothing on chain, separate from the hatch tier. Pure function of the world: PetScore.compute(w) ->
 * { tip, n, byId: { id: { score, rank, percentile, top, dead, breakdown } } }. The community pet (Bitcoin Wizard) and released pets are not ranked.
 * Weights: Stats 30, Looks 20, Growth 15, Gear 15, Battles 10, Scarcity 10. Works in the browser (window.PetScore) and in Node (module.exports). */
(function (root) {
  'use strict';
  /* power-tooltip-values (Oct 25 2026, display only): hovers show the pet's real numbers (js/v2-power-tip.js) */
  function ptA(p) { return window.V2PowerTip ? V2PowerTip.attr(V2PowerTip.power(p)) : ''; } 
  var W = { stats: 0.30, looks: 0.20, growth: 0.15, gear: 0.15, battles: 0.10, scarcity: 0.10 };
  var LABEL = { stats: 'Stats', looks: 'Looks', growth: 'Growth', gear: 'Gear', battles: 'Battles', scarcity: 'Scarcity' };
  var BPD = 144;
  function isHyb(p) { return !!p.hybrid || /^hyb:/.test(String(p.species)) || !!(p.art && p.art.hybrid); }
  var RARE_SP = { nakamoto: 1, wizard: 1 };
  function cheekKey(c) { return c === true ? 'blush' : (!c ? 'none' : String(c)); }
  function isComm(p) { return !!(p.community || (p.art && p.art.community)); }
  function total(p) { var s = p.stats || {}, t = 0; for (var k in s) t += +s[k] || 0; return t; }
  /* mid-rank percentile of each value inside its own list (ties share), 0..1; a list of one is 0.5 */
  function pctMap(vals) { var n = vals.length, idx = vals.map(function (v, i) { return i; }).sort(function (a, b) { return vals[a] - vals[b]; }), out = new Array(n), i = 0;
    while (i < n) { var j = i; while (j + 1 < n && vals[idx[j + 1]] === vals[idx[i]]) j++; var pc = n === 1 ? 0.5 : ((i + j) / 2) / (n - 1); for (var k = i; k <= j; k++) out[idx[k]] = pc; i = j + 1; }
    return out; }
  function streak(p, tip) { var fd = p.feedDays || {}, d = Math.floor(tip / BPD); if (!fd[d]) d--; var n = 0; while (fd[d]) { n++; d--; } return n; }
  /* trait-rank-1101 (display only): the trait rarity part of compute() on its own, so the 💎 Trait rarity board (js/v2-trait-rank.js) can rank
   * every pet without the full score. Same population, same keys, same numbers as compute(). */
  function population(w) { return (w.pets || []).filter(function (p) { return !isComm(p) && !p.released; }); }
  function traitBits(pets) { var N = pets.length, RF = {}, rk = pets.map(function (p) { var a = p.art || {}, v = [isHyb(p) ? 'hybrid' : String(p.species), a.eyes, a.pattern, a.background, cheekKey(a.cheeks), p.mutation ? 'mut-' + (p.mutation.kind || 'odd') : 'none', p.shows ? 'tb-' + p.shows : 'none']; /* glitch-display-1102: a mutation and a showing throwback trait are traits too (display only) */
      for (var t = 0; t < v.length; t++) { var key = t + ':' + v[t]; RF[key] = (RF[key] || 0) + 1; v[t] = key; } return v; });
    return { RF: RF, rk: rk, bits: rk.map(function (v) { var b = 0; for (var t = 0; t < v.length; t++) b -= Math.log2(RF[v[t]] / N); return b; }) }; }
  /* SCORE BASE (Nov 28 2026, Jake: "pet scores dont seem to match between my pets and the pet card"). Every number here is graded on a
   * curve against a population of pets: Stats against the same species, Looks and the 💎 trait rarity against every pet, the final ⭐
   * rank against every score. A full replay holds every pet in the game, but a fast page holds only the pets it has loaded: your own
   * pets, page by page, plus the odd parent or the pet a pet page asked for. So the same pet scored against "your pets so far" on My
   * Pets, against a slightly different set on its pet page, and against the whole game on a full replay (a one-pet wallet read
   * "top 100%, Rarity 0.0" instead of "top 22%, Rarity 19.4"). The game server now publishes the whole game's population tables in
   * view/summary.json (psBase, made by basis() below from its full replay), and a fast world scores its pets against those. A full
   * world never uses a base, so its numbers are exactly what they always were. tools/pet-score-base-test.js checks both. */
  function grpOf(p) { return isHyb(p) ? 'hybrid' : String(p.species); }
  function comboOf(p) { var a = p.art || {}; return [a.eyes, a.pattern, a.crown, a.cape, a.armor].join('|'); }
  function gearVals(w, V) { var gv = {}; (w.itemList || Object.keys(w.items || {}).map(function (k) { return w.items[k]; })).forEach(function (it) {
      if (!it) return; var pid = it.wonBy != null ? it.wonBy : it.rolledOn; if (pid == null) return; var v = V && V.itemView ? V.itemView(it.item) || {} : {}, t = +it.tier || 0;
      var val = t + 1 + (t >= 3 ? 3 : 0) + (it.legendary || v.exclusive ? 4 : 0) + (v.sig ? 2 : 0); gv[pid] = (gv[pid] || 0) + val; });
    return gv; }
  /** basis(w, opt) -> the population tables of a FULL world (server side), for summary.psBase:
   *  { v: 1, tip, n, stat: { group: [total, count, total, count, ...] }, combo: { d: [part, ...], k: [5 part indexes, count, ...] } (the Looks
   *    combos eyes|pattern|crown|cape|armor and how many pets share each, the parts written once: 155 KB as plain keys, 40 KB like this), rf: { traitKey: count },
   *    hist: [score, count, ...], gv: { petId: gear value } }. */
  function basis(w, opt) { var r = (opt && opt.scored) || compute(w, opt), pets = population(w), stat = {}, combo = {}, hist = {}, gv = {}, out = { v: 1, tip: w.tip || 0, n: r.n, stat: {}, combo: combo, rf: traitBits(pets).RF, hist: [], gv: gv };
    pets.forEach(function (p) { var g = grpOf(p), t = total(p), m = stat[g] = stat[g] || {}; m[t] = (m[t] || 0) + 1; var k = comboOf(p); combo[k] = (combo[k] || 0) + 1; });
    Object.keys(stat).forEach(function (g) { var a = []; Object.keys(stat[g]).map(Number).sort(function (x, y) { return x - y; }).forEach(function (t) { a.push(t, stat[g][t]); }); out.stat[g] = a; });
    r.ranked.forEach(function (s) { hist[s.score] = (hist[s.score] || 0) + 1; if (s.breakdown.gear.won) gv[s.id] = s.breakdown.gear.won; });
    Object.keys(hist).map(Number).sort(function (x, y) { return x - y; }).forEach(function (s) { out.hist.push(s, hist[s]); });
    var d = [], di = {}, k = []; Object.keys(combo).forEach(function (key) { key.split('|').forEach(function (part) { if (di[part] == null) { di[part] = d.length; d.push(part); } k.push(di[part]); }); k.push(combo[key]); });
    out.combo = { d: d, k: k }; return out; }
  function comboMap(c) { if (!c || !Array.isArray(c.d) || !Array.isArray(c.k)) return c || {}; var m = {}, d = c.d, k = c.k;
    for (var i = 0; i + 5 < k.length; i += 6) m[d[k[i]] + '|' + d[k[i + 1]] + '|' + d[k[i + 2]] + '|' + d[k[i + 3]] + '|' + d[k[i + 4]]] = k[i + 5]; return m; }
  function okBase(b) { return b && b.v === 1 && b.n > 0 && b.stat && b.combo && b.rf && b.hist ? b : null; }
  /** the base a world is scored against: a fast world's published base, or null for a full world (scored against its own pets).
   * A world copied or rebuilt without the field still gets the page's base when it holds fewer pets than the game (a partial world). */
  function baseOf(w, opt) { if (opt && opt.base !== undefined) return okBase(opt.base); if (!w) return null; if (w._psBase) return okBase(w._psBase);
    var S = root.V2Split, b = null; try { b = S && S.scoreBase ? okBase(S.scoreBase()) : null; } catch (e) { b = null; }
    return b && (w._view || (w.pets || []).length < b.n) ? b : null; }
  /* lookups made once per base: mid-rank percentile of a value inside a counted list, exactly as pctMap() ranks a full list */
  var bix = typeof WeakMap === 'function' ? new WeakMap() : null;
  function baseIx(b) { var x = bix && bix.get(b); if (x) return x; x = { stat: {}, size: {}, looks: {}, above: {}, combo: comboMap(b.combo) };
    Object.keys(b.stat).forEach(function (g) { var a = b.stat[g], m = {}, below = 0, i, n = 0; for (i = 1; i < a.length; i += 2) n += a[i];
      for (i = 0; i < a.length; i += 2) { m[a[i]] = [below, a[i + 1]]; below += a[i + 1]; } x.stat[g] = { m: m, a: a, n: n }; x.size[g] = n; });
    /* Looks = log(N / combo count): fewer pets sharing the combo = higher. Pets whose combo count is c share one value. */
    var byC = {}; Object.keys(x.combo).forEach(function (k) { var c = x.combo[k]; byC[c] = (byC[c] || 0) + c; });
    var cs = Object.keys(byC).map(Number).sort(function (p, q) { return q - p; }), less = 0; cs.forEach(function (c) { x.looks[c] = [less, byC[c]]; less += byC[c]; }); x.looksCs = cs;
    var h = b.hist, above = 0; for (var j = h.length - 2; j >= 0; j -= 2) { x.above[h[j]] = above; above += h[j + 1]; } x.hist = h;
    if (bix) bix.set(b, x); return x; }
  function midPc(less, eq, n) { if (n <= 1) return 0.5; return eq > 0 ? (less + (eq - 1) / 2) / (n - 1) : less / (n - 1); }
  function statPc(x, g, t) { var s = x.stat[g]; if (!s) return 0.5; var e = s.m[t]; if (e) return midPc(e[0], e[1], s.n);
    var below = 0; for (var i = 0; i < s.a.length && s.a[i] < t; i += 2) below += s.a[i + 1]; return midPc(below, 0, s.n); }
  function looksPc(x, c, n) { var e = x.looks[c]; if (e) return midPc(e[0], e[1], n); var less = 0; x.looksCs.forEach(function (k) { if (k > c) less += x.looks[k][1]; }); return midPc(less, 0, n); }
  function aboveOf(x, s) { if (x.above[s] != null) return x.above[s]; var a = 0, h = x.hist; for (var i = 0; i < h.length; i += 2) if (h[i] > s) a += h[i + 1]; return a; }
  function baseBits(b, pets) { var RF = b.rf, N = b.n, rk = pets.map(function (p) { var a = p.art || {}, v = [isHyb(p) ? 'hybrid' : String(p.species), a.eyes, a.pattern, a.background, cheekKey(a.cheeks), p.mutation ? 'mut-' + (p.mutation.kind || 'odd') : 'none', p.shows ? 'tb-' + p.shows : 'none'];
      for (var t = 0; t < v.length; t++) v[t] = t + ':' + v[t]; return v; });
    var rf = {}; rk.forEach(function (v) { v.forEach(function (k) { if (!rf[k]) rf[k] = RF[k] || 1; }); });
    return { RF: rf, rk: rk, bits: rk.map(function (v) { var bb = 0; for (var t = 0; t < v.length; t++) bb -= Math.log2(rf[v[t]] / N); return bb; }) }; }
  /** rarityAll(w) -> [{ id, bits, oneIn }] for every ranked pet (community and released pets left out), in world order. Cached per world. */
  var rcache = typeof WeakMap === 'function' ? new WeakMap() : null;
  function rarityAll(w) { if (!w) return []; var c0 = cache && cache.get(w), n = (w.pets || []).length; if (c0 && c0.tip === w.tip && c0.len === n) return c0.r.ranked.map(function (r) { return { id: r.id, bits: r.rarityBits, oneIn: r.rarityOneIn }; });
    var c = rcache && rcache.get(w); if (c && c.tip === w.tip && c.len === n) return c.r;
    var B = baseOf(w), pets = population(w), b = (B ? baseBits(B, pets) : traitBits(pets)).bits, r = pets.map(function (p, i) { return { id: p.id, bits: b[i], oneIn: Math.pow(2, b[i]) }; });
    if (rcache) rcache.set(w, { tip: w.tip, len: n, r: r }); return r; }
  /* freeze-hunt (Nov 22 2026): compute() is split into prep -> one pet at a time -> finish, so computeAsync() can do the same work in short
   * slices. Over a full world (about 160,000 pets) the score took 1.2 s on a fast PC and about 3 s on a laptop in one go: the page froze
   * ('Page Unresponsive') whenever the server's ready-made world was missing. Same numbers either way. */
  function prep(w, opt, staged) {
    opt = opt || {}; var V = opt.rules || root.V2Rules, tip = w.tip || 0, B = baseOf(w, opt), X = B ? baseIx(B) : null;
    var pets, N, byId = {}, grp, sStats, ck, cf, sLooks, gv, TR, RF, rk, rBits, sc, minC, maxL;
    var stages = [function () {
    pets = (w.pets || []).filter(function (p) { return !isComm(p) && !p.released; }); N = B ? B.n : pets.length;
    }, function () {
    if (X) { sStats = pets.map(function (p) { return statPc(X, grpOf(p), total(p)); }); return; }
    /* Stats: total percentile within species (hybrids vs hybrids) */
    grp = {}; pets.forEach(function (p, i) { var g = isHyb(p) ? 'hybrid' : String(p.species); (grp[g] = grp[g] || []).push(i); });
    sStats = new Array(N); Object.keys(grp).forEach(function (g) { var ix = grp[g], pc = pctMap(ix.map(function (i) { return total(pets[i]); })); ix.forEach(function (i, k) { sStats[i] = pc[k]; }); });
    }, function () {
    /* Looks: inverse frequency of the exact eyes+pattern+crown+cape+armor combo, log-scaled, as a percentile across all pets */
    ck = pets.map(comboOf); cf = {};
    if (X) { ck.forEach(function (k) { cf[k] = X.combo[k] || 1; }); sLooks = ck.map(function (k) { return looksPc(X, cf[k], N); }); return; }
    ck.forEach(function (k) { cf[k] = (cf[k] || 0) + 1; }); sLooks = pctMap(ck.map(function (k) { return Math.log(N / cf[k]); }));
    }, function () {
    /* Gear: pieces won from on-chain rolls (and battle spoils) credited to the pet that won them; equip state is browser-only and ignored */
    /* a fast world holds only its own wallet's pieces, so a piece the pet won that now sits in another wallet was missed: the base has every pet's value */
    gv = B && B.gv ? B.gv : gearVals(w, V);
    }, function () {
    /* Trait rarity (rarity-sort 2026-10-20, owner approved 8:58 PM CT; display only): bits = sum of -log2(freq / N) over species (hybrids one bucket,
     * player Wizards / Lord Kek their own species), eyes, pattern, background and cheeks, from the global frequencies of this same population. */
    TR = B ? baseBits(B, pets) : traitBits(pets); RF = TR.RF; rk = TR.rk; rBits = TR.bits;
    }, function () {
    /* Scarcity: inverse species count */
    if (X) { sc = {}; Object.keys(X.size).forEach(function (g) { sc[g] = X.size[g]; }); pets.forEach(function (p) { var g = grpOf(p); if (!sc[g]) sc[g] = 1; }); }
    else { sc = {}; pets.forEach(function (p) { var g = isHyb(p) ? 'hybrid' : String(p.species); sc[g] = (sc[g] || 0) + 1; }); }
    minC = Math.min.apply(null, Object.keys(sc).map(function (k) { return sc[k]; })); maxL = Math.log(N / minC) || 1;
    }];
    function ready() { return N ? { tip: tip, N: N, byId: byId, pets: pets, one: one, X: X } : { tip: tip, N: 0, byId: byId }; }
    if (staged) return { stages: stages, ready: ready, empty: function () { return !N; } };
    stages[0](); if (!N) return ready(); for (var si = 1; si < stages.length; si++) stages[si]();
    function one(p, i) {
      var th = null; try { th = V && V.petThresholds ? V.petThresholds(w, p, tip) : null; } catch (e) { th = null; }
      var my = th && th[5] ? th[5] : 69069, prog = p.ascended || p.mythicCare ? 1 : Math.min(1, (p.care || 0) / my), st = streak(p, tip);
      var growth = Math.min(1, 0.85 * prog + 0.15 * Math.min(st, 7) / 7);
      var gear = 1 - Math.exp(-(gv[p.id] || 0) / 12);
      var f = (p.wins || 0) + (p.losses || 0), battles = f < 3 ? 0.5 : 0.6 * (p.wins || 0) / f + 0.4 * Math.min(1, (p.wins || 0) / 10);
      var g = isHyb(p) ? 'hybrid' : String(p.species), inv = Math.log(N / sc[g]) / maxL;
      var scarcity = Math.min(1, 0.4 * inv + (isHyb(p) ? 0.4 : 0) + (RARE_SP[p.species] ? 0.3 : 0) + (p.parents ? 0.2 : 0)); /* rarity-sort 2026-10-20: player Wizards get Nakamoto's +0.3 (by species) */
      var parts = { stats: sStats[i], looks: sLooks[i], growth: growth, gear: gear, battles: battles, scarcity: scarcity }, s = 0, bd = {};
      Object.keys(W).forEach(function (k) { var v = Math.max(0, Math.min(1, parts[k])); s += W[k] * v; bd[k] = { value: Math.round(v * 1000) / 1000, weight: W[k], points: Math.round(W[k] * v * 1000) }; });
      bd.stats.total = total(p); bd.looks.sameCombo = cf[ck[i]]; bd.growth.streak = st; bd.growth.mythicPct = Math.round(prog * 100); bd.gear.won = gv[p.id] || 0; bd.battles.fights = f; bd.battles.wins = p.wins || 0;
      return { id: p.id, score: Math.round(s * 1000), dead: !!p.dead, breakdown: bd, rarityBits: rBits[i], rarityOneIn: Math.pow(2, rBits[i]), traitOneIn: rk[i].map(function (k) { return N / RF[k]; }) }; }
    return ready();
  }
  function finish(st, res) { var N = st.N, byId = st.byId, tip = st.tip, X = st.X;
    res.sort(function (a, b) { return b.score - a.score || a.id - b.id; });
    /* with a base the rank is the pet's place among every scored pet in the game: 1 + the pets scored higher */
    res.forEach(function (r, i) { r.rank = X ? Math.min(N, 1 + aboveOf(X, r.score)) : i > 0 && res[i - 1].score === r.score ? res[i - 1].rank : i + 1; r.percentile = Math.round(1000 * (1 - (r.rank - 1) / N)) / 10;
      r.top = Math.max(1, Math.ceil(100 * r.rank / N)); byId[r.id] = r; });
    return { tip: tip, n: N, byId: byId, ranked: res };
  }
  function compute(w, opt) { var st = prep(w, opt); if (!st.N) return { tip: st.tip, n: 0, byId: st.byId, ranked: [] }; return finish(st, st.pets.map(st.one)); }
  /** computeAsync(w, opt, done): compute() in slices of about 12 ms with a break between them (setTimeout), then done(result). Same result. */
  function computeAsync(w, opt, done) { var pr = null, k = 0, st, res, i = 0, n;
    function step() { var t0 = Date.now(); try {
        if (!pr) pr = prep(w, opt, true);
        if (!st) { pr.stages[k++](); if (k === 1 && pr.empty()) { st = pr.ready(); return done({ tip: st.tip, n: 0, byId: st.byId, ranked: [] }); }
          if (k < pr.stages.length) return setTimeout(step, 0); st = pr.ready(); n = st.pets.length; res = new Array(n); /* with a base N is the whole game, the list is the loaded pets */ return setTimeout(step, 0); }
        while (i < n && Date.now() - t0 < 12) { res[i] = st.one(st.pets[i], i); i++; }
        if (i < n) return setTimeout(step, 0);
        done(finish(st, res)); } catch (e) { done(null); } }
    setTimeout(step, 0); }
  var cache = typeof WeakMap === 'function' ? new WeakMap() : null;
  function get(w) { if (!w) return null; var c = cache && cache.get(w); if (c && c.tip === w.tip && c.len === (w.pets || []).length) return c.r;
    var r = compute(w); if (cache) cache.set(w, { tip: w.tip, len: (w.pets || []).length, r: r }); return r; }
  function of(w, p) { var r = get(w); return r && p ? r.byId[p.id] || null : null; }
  /* freeze-hunt (Nov 22 2026): card chips use peek(). A big world (a full rebuild in the browser holds every pet in the game) is scored in
   * the background in short slices; until then the chips are left out, and the page repaints once the scores are ready. Small worlds (the
   * normal fast load holds only your pets) are scored at once, exactly as before. Sorting by score still uses of() and gets the full answer. */
  var SOFT_MIN = 6000, busy = typeof WeakMap === 'function' ? new WeakMap() : null;
  function peekAll(w) { if (!w) return null; var c = cache && cache.get(w), n = (w.pets || []).length; if (c && c.tip === w.tip && c.len === n) return c.r;
    if (n < SOFT_MIN || !busy || typeof setTimeout !== 'function') return get(w);
    var b = busy.get(w); if (b && b.tip === w.tip && b.len === n) return null;
    busy.set(w, { tip: w.tip, len: n });
    computeAsync(w, null, function (r) { if (!r) return; var c2 = cache && cache.get(w); if (c2 && c2.tip === w.tip && c2.len === (w.pets || []).length) return; /* a sort already scored it */
      if (w.tip !== busy.get(w).tip || (w.pets || []).length !== n) return; if (cache) cache.set(w, { tip: w.tip, len: n, r: r });
      try { if (root.V2UI && root.V2UI.render && root.V2UI.world && root.V2UI.world() === w) root.V2UI.render(); } catch (e) {}
      try { if (root.document && root.CustomEvent) root.document.dispatchEvent(new root.CustomEvent('xcpets-score-ready')); } catch (e2) {} });
    return null; }
  function peek(w, p) { var r = peekAll(w); return r && p ? r.byId[p.id] || null : null; }
  /** rarity(w, p) -> { bits, oneIn } or null (community / released pets). Display only. */
  function rarity(w, p) { var s = of(w, p); return s ? { bits: s.rarityBits, oneIn: s.rarityOneIn } : null; }
  function bitsOf(w, p) { var s = of(w, p); return s ? s.rarityBits : -1; }
  function fmtN(n) { if (!(n >= 1)) return '1'; var u = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']]; for (var i = 0; i < u.length; i++) if (n >= u[i][0]) { var v = n / u[i][0]; return (v >= 100 ? Math.round(v) : Math.round(v * 10) / 10) + u[i][1]; } return String(Math.round(n)); }
  function rarityLine(w, p) { var r = rarity(w, p); return r ? '💎 Rarity ' + r.bits.toFixed(1) + ' · 1 in ' + fmtN(r.oneIn) : ''; }
  function rarityChip(w, p) { if (!p || isComm(p)) return ''; var s0 = peek(w, p), r = s0 ? { bits: s0.rarityBits, oneIn: s0.rarityOneIn } : null; if (!r) return '';
    return '<span class="chip prar" title="Trait rarity: how unusual this pet\'s species, eyes, pattern, background, cheeks, mutation and throwback trait are across every pet. It shifts a little as new pets hatch, because it compares with every pet (display only, not the hatch tier)">💎 Rarity ' + r.bits.toFixed(1) + ' · 1 in ' + fmtN(r.oneIn) + '</span>'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function label(s) { return s.score + ' · top ' + s.top + '%'; }
  /* score-why (Nov 23 2026, owner "whatever best"; display only, score math unchanged). The score is graded on a curve against every pet, so it
   * moves when other pets hatch, grow or fight even if this one doesn't ("rarity score went down on my pets"). This browser keeps one line per
   * pet it has shown (localStorage, newest 4,000): the score, the number of pets scored and the pet's own inputs, per chain day. The chip gets
   * a small arrow and the breakdown says how much it moved and whether this pet changed or only the others did. */
  var HK = 'xcpets-ps-hist2', /* hist2 (Nov 28 2026): fast pages now grade on the whole game's curve, so the old lines would show one false jump */ HMAX = 4000, hist = null, hT = 0;
  function ls() { try { return root.localStorage || null; } catch (e) { return null; } }
  function hLoad() { if (hist) return hist; hist = {}; var L = ls(); try { if (L && L.getItem('xcpets-ps-hist') != null) L.removeItem('xcpets-ps-hist'); } catch (e0) { } try { var v = L && JSON.parse(L.getItem(HK) || '{}'); if (v && typeof v === 'object' && !Array.isArray(v)) hist = v; } catch (e) { } return hist; }
  function hSave() { if (hT || typeof setTimeout !== 'function') return; hT = setTimeout(function () { hT = 0; var L = ls(); if (!L) return; try { var k = Object.keys(hist);
      if (k.length > HMAX) k.sort(function (a, b) { return hist[a].d - hist[b].d; }).slice(0, k.length - HMAX).forEach(function (x) { delete hist[x]; }); L.setItem(HK, JSON.stringify(hist)); } catch (e) { } }, 1500); }
  function selfKey(s) { var b = s.breakdown || {}; return [b.stats && b.stats.total, b.growth && b.growth.mythicPct, b.growth && b.growth.streak, b.gear && b.gear.won, b.battles && b.battles.fights, b.battles && b.battles.wins].join(','); }
  /** moved(w, p, s, n) -> null | { delta, days, self, newPets }: change since the last chain day this browser showed the pet. */
  function moved(w, p, s, n) { if (!ls() || !w || w.tip == null || !s || !n) return null; var H = hLoad(), d = Math.floor(w.tip / BPD), r = H[p.id], k = selfKey(s);
    if (!r || typeof r !== 'object') { H[p.id] = { d: d, s: s.score, n: n, k: k }; hSave(); return null; }
    if (r.d < d) { r = H[p.id] = { d: d, s: s.score, n: n, k: k, pd: r.d, ps: r.s, pn: r.n, pk: r.k }; hSave(); }
    else if (r.d === d && (r.s !== s.score || r.n !== n || r.k !== k)) { r.s = s.score; r.n = n; r.k = k; hSave(); }
    if (r.pd == null || r.d !== d) return null; return { delta: s.score - r.ps, days: d - r.pd, self: k !== r.pk, newPets: n - r.pn }; }
  function nOf(w) { var r = peekAll(w); return r ? r.n : 0; }
  function fmtI(n) { return Number(n || 0).toLocaleString('en-US'); }
  function arrow(m) { return m && m.delta ? '<span class="psmv ' + (m.delta > 0 ? 'up' : 'dn') + '">' + (m.delta > 0 ? '▲' : '▼') + Math.abs(m.delta) + '</span>' : ''; }
  function whyHtml(m, n) { var when = m && m.days === 1 ? 'since yesterday' : m ? 'since you last saw it ' + m.days + ' days ago' : '';
    var h = m ? (m.delta === 0 ? '<b>No change</b> ' + when + '.' : '<b>' + (m.delta > 0 ? '▲ Up ' : '▼ Down ') + Math.abs(m.delta) + '</b> ' + when + '. ' +
      (m.self ? 'This pet changed (it grew, fought or won gear) and the other pets moved too.' : 'This pet didn\'t change: ' + (m.newPets > 0 ? fmtI(m.newPets) + ' new pets hatched and others grew, fought or won gear' : 'other pets grew, fought or won gear') + ', so the curve moved.')) : '';
    return '<span class="pswhy">' + (h ? h + '<br>' : '') + '<b>Why it moves:</b> the score is graded on a curve against all ' + fmtI(n) + ' pets. It can go up or down when other pets hatch, grow or fight, even if yours doesn\'t.</span>'; }
  function badge(w, p) { if (!p || isComm(p)) return ''; var s = peek(w, p); if (!s) return ''; var b = s.breakdown, n = nOf(w), mv = null; try { mv = moved(w, p, s, n); } catch (e) { mv = null; }
    var rows = Object.keys(W).map(function (k) { return '<tr><td>' + LABEL[k] + '</td><td>' + Math.round(W[k] * 100) + '%</td><td>' + b[k].points + '</td></tr>'; }).join('');
    var tip = Object.keys(W).map(function (k) { return LABEL[k] + ' ' + b[k].points + '/' + Math.round(W[k] * 1000); }).join(' · ');
    return '<span class="psw" tabindex="0" role="button" aria-label="Pet Score ' + s.score + ', rank ' + s.rank + '. Tap for breakdown" title="' + esc('Pet Score (rank #' + s.rank + '): ' + tip) + '"><span class="chip pscore' + (s.dead ? ' psdead' : '') + '">⭐ ' + esc(label(s)) + (s.dead ? ' · 🪦' : '') + arrow(mv) + '</span>' +
      '<span class="psbd"><b>Pet Score ' + s.score + '/1000</b> · rank #' + s.rank + (s.dead ? ' · 🪦 dead' : '') + '<table>' + rows + '</table>' + whyHtml(mv, n) + '<span class="muted">Display only, from the chain replay. Not the hatch tier.</span></span></span>'; }
  /* score-popup (display only): the breakdown used to be position:absolute under the chip, so a card edge could cut it off.
   * The owner's phone shot is a My Pets card (mint hover border, ~6px corner, care bar): the chip sits on that bottom edge,
   * and hover/focus applies a transform (css/game.css .pet.card:hover) which mobile browsers clip to the rounded border.
   * The phone "one at a time" stage clips too (overflow:hidden on .mps-stage), and the same chip on pet.html sits in
   * .pcard / .pc-inner. The table is moved to document.body and placed in the viewport: under the chip when it fits,
   * otherwise above it. Score math is unchanged. */
  var CSS = '.chip.prar{background:#1d2b53;border-color:#7fd3ff;color:#bfe9ff;white-space:nowrap}.psw{position:relative;display:inline-block;cursor:pointer;outline:none}.chip.pscore{background:#2b2350;border-color:#ffd166;color:#ffd166;white-space:nowrap}.chip.pscore.psdead{opacity:.75}' +
    '.psbd{display:none;position:fixed;z-index:240;left:0;top:0;min-width:190px;max-width:min(260px,calc(100vw - 16px));background:#14122b;color:#eee;border:2px solid #ffd166;border-radius:10px;padding:8px 10px;font-size:12px;line-height:1.35;text-align:left;box-shadow:0 6px 18px rgba(0,0,0,.5);white-space:normal}' +
    '.psbd table{width:100%;border-collapse:collapse;margin:4px 0}.psbd td{padding:1px 4px}.psbd td:nth-child(n+2){text-align:right}.psbd .muted{font-size:11px}' +
    '.psmv{margin-left:4px;font-size:10px}.psmv.up{color:#7dff6a}.psmv.dn{color:#ff8a8a}.pswhy{display:block;margin:4px 0;padding:5px 0 0;border-top:1px dashed #6b5a2a}' +
    '.psbd.on{display:block}.psw.open,.psw:hover,.psw:focus{z-index:90}';

  /* player-qol 2026-10-24 (display only): everything a player needs to decide Keep or Discard, inline on the egg review / Discard pile card,
   * so no clicking in and out. Traits = species, eyes, pattern, background, cheeks (plus mutation and throwback in the score), each with its own '1 in N' across every pet; the
   * 💎 Rarity score is the same trait-rarity bits as the rarity chip/sort (sum of -log2(freq/N) of those traits); ⭐ Pet Score; ⚡ Power. */
  var TR = ['Species', 'Eyes', 'Pattern', 'Bg', 'Cheeks'], SK = [['vigor', 'VIG'], ['spark', 'SPK'], ['grit', 'GRT'], ['zoom', 'ZM'], ['luck', 'LCK']];
  function cap(s) { s = String(s == null ? '' : s).replace(/[-_]/g, ' '); return s.charAt(0).toUpperCase() + s.slice(1); }
  function discardInfo(w, p, spName) { if (!p || isComm(p)) return ''; var s = of(w, p), a = p.art || {}, st = p.stats || {};
    var val = [spName || cap(isHyb(p) ? 'hybrid' : p.species), cap(a.eyes || '-'), cap(a.pattern || '-'), cap(a.background || '-'), cap(cheekKey(a.cheeks))];
    var rows = TR.map(function (t, i) { var o = s && s.traitOneIn ? s.traitOneIn[i] : 0; return '<li><span class="dit">' + t + '</span> <b>' + esc(val[i]) + '</b>' + (o ? ' <span class="dio">1/' + fmtN(o) + '</span>' : '') + '</li>'; }).join('');
    var pw = total(p), stl = SK.map(function (k) { return k[1] + ' ' + (+st[k[0]] || 0); }).join(' · ');
    return '<div class="dinfo">' + (s ? '<div class="dihead"><span class="dirar" title="Rarity score: trait rarity of species, eyes, pattern, background, cheeks, mutation and throwback trait across every pet (display only, not the hatch tier)">💎 Rarity ' + s.rarityBits.toFixed(1) + ' <span class="dio">1 in ' + fmtN(s.rarityOneIn) + '</span></span> <span class="disc2" title="Pet Score (display only)">⭐ ' + s.score + '</span> <span class="dipw"' + ptA(p) + '>⚡ Power ' + pw + '</span></div>' : '<div class="dihead"><span class="dipw"' + ptA(p) + '>⚡ Power ' + pw + '</span></div>') +
      '<ul class="ditr">' + rows + '</ul><div class="dist">' + stl + '</div></div>'; }
  var DCSS = '.dinfo{text-align:left;font-size:11px;line-height:1.3;margin-top:3px}.dinfo .dihead{display:flex;flex-wrap:wrap;gap:3px 6px;justify-content:center;margin-bottom:2px}' +
    '.dinfo .dirar{color:#bfe9ff;font-weight:bold}.dinfo .disc2{color:#ffd166}.dinfo .dipw{color:#9fe8b5}.dinfo .dio{color:#9aa4b8;font-weight:normal;font-size:10px}' +
    '.dinfo .ditr{list-style:none;margin:0;padding:0}.dinfo .ditr li{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dinfo .dit{color:#9aa4b8;display:inline-block;min-width:46px}.dinfo .dist{color:#cfd6e4;font-size:10px;margin-top:2px}' +
    '#packBox:not(.gearmode) .packgrid{grid-template-columns:repeat(auto-fill,minmax(168px,1fr))}#packBox:not(.gearmode) .packgrid .egg{min-width:0;font-size:11px}' +
    '@media (max-width:600px){#packBox:not(.gearmode) .packgrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}.dinfo .dit{min-width:40px}}' +
    '.dcard .dinfo{margin:4px 0}';
  function install(doc) { if (!doc || doc.getElementById('psCss')) return; var s = doc.createElement('style'); s.id = 'psCss'; s.textContent = CSS + DCSS; (doc.head || doc.documentElement).appendChild(s);
    var view = doc.defaultView, open = null, hover = null, timer = null;
    var canHover = !!(view && view.matchMedia && view.matchMedia('(hover: hover) and (pointer: fine)').matches);
    function ownerOf(node) { if (!node || !node.closest) return null; var psw = node.closest('.psw'); if (psw) return psw; var bd = node.closest('.psbd'); return (bd && bd._psw) || null; }
    function park(psw) { var bd = psw && psw._bd; if (!bd) return; bd.classList.remove('on'); bd.style.left = bd.style.top = bd.style.visibility = bd.style.maxHeight = bd.style.maxWidth = bd.style.minWidth = bd.style.overflow = ''; bd.removeAttribute('data-ps-place');
      if (psw.isConnected) psw.appendChild(bd); else if (bd.parentNode) bd.parentNode.removeChild(bd); psw._bd = null; }
    function dismiss(psw) { if (!psw) return; if (psw._psRaf && view && view.cancelAnimationFrame) view.cancelAnimationFrame(psw._psRaf); psw._psRaf = 0; psw.classList.remove('open'); if (psw.setAttribute) psw.setAttribute('aria-expanded', 'false'); park(psw); if (hover === psw) hover = null; if (open === psw) open = null; }
    function place(psw) {
      var bd = psw._bd; if (!bd || !psw.isConnected) { dismiss(psw); return; }
      var vw = doc.documentElement.clientWidth || (view && view.innerWidth) || 0, vh = doc.documentElement.clientHeight || (view && view.innerHeight) || 0, r = psw.getBoundingClientRect();
      if (vw && vh && (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw)) { dismiss(psw); return; }
      var m = 8, gap = 4, cap = Math.max(120, Math.min(260, (vw || 260) - m * 2)), shown = bd.classList.contains('on');
      bd.style.minWidth = Math.min(190, cap) + 'px'; bd.style.maxWidth = cap + 'px'; bd.style.maxHeight = ''; bd.style.overflow = ''; if (!shown) bd.style.visibility = 'hidden'; bd.classList.add('on');
      var w = bd.offsetWidth, h = bd.offsetHeight, left = r.left, below = vh - r.bottom - gap - m, above = r.top - gap - m, placeBelow = h <= below || below >= above, top = placeBelow ? r.bottom + gap : r.top - gap - h;
      if (left + w > vw - m) left = vw - m - w; if (left < m) left = m;
      if (vh && h > vh - m * 2) { bd.style.maxHeight = (vh - m * 2) + 'px'; bd.style.overflow = 'auto'; top = m; bd.setAttribute('data-ps-place', 'scroll'); }
      else { if (top < m) top = m; if (vh && top + h > vh - m) top = Math.max(m, vh - m - h); bd.setAttribute('data-ps-place', placeBelow ? 'below' : 'above'); }
      bd.style.left = Math.round(left) + 'px'; bd.style.top = Math.round(top) + 'px'; bd.style.visibility = 'visible';
    }
    function arm(psw) { if (!view || !view.requestAnimationFrame || psw._psRaf) return; psw._psRaf = view.requestAnimationFrame(function () { psw._psRaf = 0; if (open !== psw) return; if (!psw.isConnected) { dismiss(psw); return; }
      var r = psw.getBoundingClientRect(), key = (r.top | 0) + ',' + (r.left | 0) + ',' + (r.bottom | 0); if (key !== psw._psAt) { psw._psAt = key; place(psw); } if (open === psw) arm(psw); }); }
    function show(psw) { if (!psw) return; if (open && open !== psw) dismiss(open); var bd = psw.querySelector('.psbd') || psw._bd; if (!bd) return; psw._bd = bd; bd._psw = psw; if (doc.body && bd.parentNode !== doc.body) doc.body.appendChild(bd); open = psw; if (psw.setAttribute) psw.setAttribute('aria-expanded', 'true'); place(psw);
      if (open === psw) { var r = psw.getBoundingClientRect(); psw._psAt = (r.top | 0) + ',' + (r.left | 0) + ',' + (r.bottom | 0); arm(psw); } }
    doc.addEventListener('click', function (e) { var t = ownerOf(e.target); clearTimeout(timer);
      if (!t) { if (open) dismiss(open); return; }
      e.stopPropagation(); e.preventDefault();
      if (t.classList.contains('open')) { t.classList.remove('open'); if (hover !== t) dismiss(t); }
      else { t.classList.add('open'); show(t); }
    }, true);
    if (canHover) {
      doc.addEventListener('pointerover', function (e) { var t = ownerOf(e.target); if (!t) return; clearTimeout(timer); hover = t; if (open !== t) show(t); });
      doc.addEventListener('pointerout', function (e) { var t = ownerOf(e.target); if (!t || t !== open) return; var n = e.relatedTarget; if (n && (t.contains(n) || (t._bd && t._bd.contains(n)))) return;
        clearTimeout(timer); timer = setTimeout(function () { if (hover === t) hover = null; if (!t.classList.contains('open')) dismiss(t); }, 140); });
    }
    doc.addEventListener('focusin', function (e) { var t = e.target && e.target.closest && e.target.closest('.psw'); if (t) show(t); });
    doc.addEventListener('focusout', function (e) { var t = e.target && e.target.closest && e.target.closest('.psw'); if (!t) return;
      setTimeout(function () { if (t.contains(doc.activeElement)) return; if (!t.classList.contains('open') && hover !== t) dismiss(t); }, 0); });
    function repos() { if (open && open.isConnected) place(open); else if (open) dismiss(open); }
    doc.addEventListener('scroll', repos, true);
    if (view) { view.addEventListener('resize', repos); if (view.visualViewport) { view.visualViewport.addEventListener('resize', repos); view.visualViewport.addEventListener('scroll', repos); } }
  }
  var api = { basis: basis, baseOf: baseOf, moved: moved, whyHtml: whyHtml, discardInfo: discardInfo, rarityChip: rarityChip, rarityAll: rarityAll, rarity: rarity, bitsOf: bitsOf, rarityLine: rarityLine, fmtN: fmtN, compute: compute, computeAsync: computeAsync, get: get, of: of, peek: peek, badge: badge, label: label, WEIGHTS: W, LABELS: LABEL, install: install };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') { window.PetScore = api; if (window.document && document.createElement && document.head) try { install(document); } catch (e) {} }
})(typeof window !== 'undefined' ? window : globalThis);
