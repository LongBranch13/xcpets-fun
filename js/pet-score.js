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
  /** rarityAll(w) -> [{ id, bits, oneIn }] for every ranked pet (community and released pets left out), in world order. Cached per world. */
  var rcache = typeof WeakMap === 'function' ? new WeakMap() : null;
  function rarityAll(w) { if (!w) return []; var c0 = cache && cache.get(w), n = (w.pets || []).length; if (c0 && c0.tip === w.tip && c0.len === n) return c0.r.ranked.map(function (r) { return { id: r.id, bits: r.rarityBits, oneIn: r.rarityOneIn }; });
    var c = rcache && rcache.get(w); if (c && c.tip === w.tip && c.len === n) return c.r;
    var pets = population(w), b = traitBits(pets).bits, r = pets.map(function (p, i) { return { id: p.id, bits: b[i], oneIn: Math.pow(2, b[i]) }; });
    if (rcache) rcache.set(w, { tip: w.tip, len: n, r: r }); return r; }
  /* speed-phase0: the population tables (prep) and the per-pet score (one) are the same maths as before.
   * compute() still does them in one turn. ensure() paints nothing itself; the page calls it and yields between slices. */
  function prep(w, opt) {
    opt = opt || {}; var V = opt.rules || root.V2Rules, tip = w.tip || 0;
    var pets = (w.pets || []).filter(function (p) { return !isComm(p) && !p.released; }), N = pets.length;
    if (!N) return { w: w, tip: tip, N: 0, pets: pets, V: V };
    /* Stats: total percentile within species (hybrids vs hybrids) */
    var grp = {}; pets.forEach(function (p, i) { var g = isHyb(p) ? 'hybrid' : String(p.species); (grp[g] = grp[g] || []).push(i); });
    var sStats = new Array(N); Object.keys(grp).forEach(function (g) { var ix = grp[g], pc = pctMap(ix.map(function (i) { return total(pets[i]); })); ix.forEach(function (i, k) { sStats[i] = pc[k]; }); });
    /* Looks: inverse frequency of the exact eyes+pattern+crown+cape+armor combo, log-scaled, as a percentile across all pets */
    var ck = pets.map(function (p) { var a = p.art || {}; return [a.eyes, a.pattern, a.crown, a.cape, a.armor].join('|'); }), cf = {};
    ck.forEach(function (k) { cf[k] = (cf[k] || 0) + 1; }); var sLooks = pctMap(ck.map(function (k) { return Math.log(N / cf[k]); }));
    /* Gear: pieces won from on-chain rolls (and battle spoils) credited to the pet that won them; equip state is browser-only and ignored */
    var gv = {}; (w.itemList || Object.keys(w.items || {}).map(function (k) { return w.items[k]; })).forEach(function (it) {
      var pid = it.wonBy != null ? it.wonBy : it.rolledOn; if (pid == null) return; var v = V && V.itemView ? V.itemView(it.item) || {} : {}, t = +it.tier || 0;
      var val = t + 1 + (t >= 3 ? 3 : 0) + (it.legendary || v.exclusive ? 4 : 0) + (v.sig ? 2 : 0); gv[pid] = (gv[pid] || 0) + val; });
    /* Trait rarity (rarity-sort 2026-10-20, owner approved 8:58 PM CT; display only): bits = sum of -log2(freq / N) over species (hybrids one bucket,
     * player Wizards / Lord Kek their own species), eyes, pattern, background and cheeks, from the global frequencies of this same population. */
    var TR = traitBits(pets), RF = TR.RF, rk = TR.rk, rBits = TR.bits;
    /* Scarcity: inverse species count */
    var sc = {}; pets.forEach(function (p) { var g = isHyb(p) ? 'hybrid' : String(p.species); sc[g] = (sc[g] || 0) + 1; });
    var minC = Math.min.apply(null, Object.keys(sc).map(function (k) { return sc[k]; })), maxL = Math.log(N / minC) || 1;
    return { w: w, tip: tip, N: N, pets: pets, V: V, sStats: sStats, sLooks: sLooks, ck: ck, cf: cf, gv: gv, RF: RF, rk: rk, rBits: rBits, sc: sc, maxL: maxL };
  }
  function one(p, i, c) {
    var V = c.V, tip = c.tip, N = c.N, gv = c.gv, sc = c.sc, maxL = c.maxL, sStats = c.sStats, sLooks = c.sLooks, ck = c.ck, cf = c.cf, rBits = c.rBits, rk = c.rk, RF = c.RF;
    var th = null; try { th = V && V.petThresholds ? V.petThresholds(c.w, p, tip) : null; } catch (e) { th = null; }
    var my = th && th[5] ? th[5] : 69069, prog = p.ascended || p.mythicCare ? 1 : Math.min(1, (p.care || 0) / my), st = streak(p, tip);
    var growth = Math.min(1, 0.85 * prog + 0.15 * Math.min(st, 7) / 7);
    var gear = 1 - Math.exp(-(gv[p.id] || 0) / 12);
    var f = (p.wins || 0) + (p.losses || 0), battles = f < 3 ? 0.5 : 0.6 * (p.wins || 0) / f + 0.4 * Math.min(1, (p.wins || 0) / 10);
    var g = isHyb(p) ? 'hybrid' : String(p.species), inv = Math.log(N / sc[g]) / maxL;
    var scarcity = Math.min(1, 0.4 * inv + (isHyb(p) ? 0.4 : 0) + (RARE_SP[p.species] ? 0.3 : 0) + (p.parents ? 0.2 : 0)); /* rarity-sort 2026-10-20: player Wizards get Nakamoto's +0.3 (by species) */
    var parts = { stats: sStats[i], looks: sLooks[i], growth: growth, gear: gear, battles: battles, scarcity: scarcity }, s = 0, bd = {};
    Object.keys(W).forEach(function (k) { var v = Math.max(0, Math.min(1, parts[k])); s += W[k] * v; bd[k] = { value: Math.round(v * 1000) / 1000, weight: W[k], points: Math.round(W[k] * v * 1000) }; });
    bd.stats.total = total(p); bd.looks.sameCombo = cf[ck[i]]; bd.growth.streak = st; bd.growth.mythicPct = Math.round(prog * 100); bd.gear.won = gv[p.id] || 0; bd.battles.fights = f; bd.battles.wins = p.wins || 0;
    return { id: p.id, score: Math.round(s * 1000), dead: !!p.dead, breakdown: bd, rarityBits: rBits[i], rarityOneIn: Math.pow(2, rBits[i]), traitOneIn: rk[i].map(function (k) { return N / RF[k]; }) };
  }
  function cmpScore(a, b) { return b.score - a.score || a.id - b.id; }
  function rank(res, tip) {
    var N = res.length, byId = {};
    res.sort(cmpScore);
    res.forEach(function (r, i) { r.rank = i > 0 && res[i - 1].score === r.score ? res[i - 1].rank : i + 1; r.percentile = Math.round(1000 * (1 - (r.rank - 1) / N)) / 10;
      r.top = Math.max(1, Math.ceil(100 * r.rank / N)); byId[r.id] = r; });
    return { tip: tip, n: N, byId: byId, ranked: res };
  }
  function compute(w, opt) {
    var c = prep(w, opt); if (!c.N) return { tip: c.tip, n: 0, byId: {}, ranked: [] };
    var res = new Array(c.N), i; for (i = 0; i < c.N; i++) res[i] = one(c.pets[i], i, c); return rank(res, c.tip);
  }
  function yieldNow() {
    try { if (typeof scheduler !== 'undefined' && scheduler.yield) return scheduler.yield(); } catch (e) {}
    return new Promise(function (res) { setTimeout(res, 0); });
  }
  var jobs = typeof WeakMap === 'function' ? new WeakMap() : null;
  function cached(w) { if (!w || !cache) return null; var c = cache.get(w); if (c && c.tip === w.tip && c.len === (w.pets || []).length) return c.r; return null; }
  /* ensure(w, cb): same result as compute(), written into the same cache, but the per-pet slice yields so the first cards can paint. */
  function ensure(w, cb) {
    var hit = cached(w); if (hit) { if (cb) cb(hit); return; }
    if (!w) return;
    var job = jobs && jobs.get(w); if (job) { if (cb) job.cbs.push(cb); return; }
    job = { cbs: cb ? [cb] : [] }; if (jobs) jobs.set(w, job);
    var SLICE = 1500, ctx = null, res = null, i = 0, phase = 0;
    function finish(out) { if (cache) cache.set(w, { tip: w.tip, len: (w.pets || []).length, r: out }); if (jobs) jobs.delete(w); job.cbs.forEach(function (fn) { try { fn(out); } catch (e) {} }); }
    function step() {
      try {
        if (phase === 0) { ctx = prep(w, {}); phase = 1; if (!ctx.N) return finish({ tip: ctx.tip, n: 0, byId: {}, ranked: [] }); res = new Array(ctx.N); return yieldNow().then(step); }
        if (phase === 1) { var end = Math.min(ctx.N, i + SLICE); for (; i < end; i++) res[i] = one(ctx.pets[i], i, ctx); if (i < ctx.N) return yieldNow().then(step); phase = 2; return yieldNow().then(step); }
        finish(rank(res, ctx.tip));
      } catch (e) { if (jobs) jobs.delete(w); }
    }
    yieldNow().then(step);
  }
  var cache = typeof WeakMap === 'function' ? new WeakMap() : null;
  function get(w) { if (!w) return null; var c = cache && cache.get(w); if (c && c.tip === w.tip && c.len === (w.pets || []).length) return c.r;
    var r = compute(w); if (cache) cache.set(w, { tip: w.tip, len: (w.pets || []).length, r: r }); return r; }
  function of(w, p) { var r = get(w); return r && p ? r.byId[p.id] || null : null; }
  /** rarity(w, p) -> { bits, oneIn } or null (community / released pets). Display only. */
  function rarity(w, p) { var s = of(w, p); return s ? { bits: s.rarityBits, oneIn: s.rarityOneIn } : null; }
  function bitsOf(w, p) { var s = of(w, p); return s ? s.rarityBits : -1; }
  function fmtN(n) { if (!(n >= 1)) return '1'; var u = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']]; for (var i = 0; i < u.length; i++) if (n >= u[i][0]) { var v = n / u[i][0]; return (v >= 100 ? Math.round(v) : Math.round(v * 10) / 10) + u[i][1]; } return String(Math.round(n)); }
  function rarityLine(w, p) { var r = rarity(w, p); return r ? '💎 Rarity ' + r.bits.toFixed(1) + ' · 1 in ' + fmtN(r.oneIn) : ''; }
  function rarityChip(w, p) { if (!p || isComm(p)) return ''; var r = rarity(w, p); if (!r) return '';
    return '<span class="chip prar" title="Trait rarity: how unusual this pet\'s species, eyes, pattern, background, cheeks, mutation and throwback trait are across every pet (display only, not the hatch tier)">💎 Rarity ' + r.bits.toFixed(1) + ' · 1 in ' + fmtN(r.oneIn) + '</span>'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function label(s) { return s.score + ' · top ' + s.top + '%'; }
  function badge(w, p) { if (!p || isComm(p)) return ''; var s = of(w, p); if (!s) return ''; var b = s.breakdown;
    var rows = Object.keys(W).map(function (k) { return '<tr><td>' + LABEL[k] + '</td><td>' + Math.round(W[k] * 100) + '%</td><td>' + b[k].points + '</td></tr>'; }).join('');
    var tip = Object.keys(W).map(function (k) { return LABEL[k] + ' ' + b[k].points + '/' + Math.round(W[k] * 1000); }).join(' · ');
    return '<span class="psw" tabindex="0" role="button" aria-label="Pet Score ' + s.score + ', rank ' + s.rank + '. Tap for breakdown" title="' + esc('Pet Score (rank #' + s.rank + '): ' + tip) + '"><span class="chip pscore' + (s.dead ? ' psdead' : '') + '">⭐ ' + esc(label(s)) + (s.dead ? ' · 🪦' : '') + '</span>' +
      '<span class="psbd"><b>Pet Score ' + s.score + '/1000</b> · rank #' + s.rank + (s.dead ? ' · 🪦 dead' : '') + '<table>' + rows + '</table><span class="muted">Display only, from the chain replay. Not the hatch tier.</span></span></span>'; }
  /* score-popup (display only): the breakdown used to be position:absolute under the chip, so a card edge could cut it off.
   * The owner's phone shot is a My Pets card (mint hover border, ~6px corner, care bar): the chip sits on that bottom edge,
   * and hover/focus applies a transform (css/game.css .pet.card:hover) which mobile browsers clip to the rounded border.
   * The phone "one at a time" stage clips too (overflow:hidden on .mps-stage), and the same chip on pet.html sits in
   * .pcard / .pc-inner. The table is moved to document.body and placed in the viewport: under the chip when it fits,
   * otherwise above it. Score math is unchanged. */
  var CSS = '.chip.prar{background:#1d2b53;border-color:#7fd3ff;color:#bfe9ff;white-space:nowrap}.psw{position:relative;display:inline-block;cursor:pointer;outline:none}.chip.pscore{background:#2b2350;border-color:#ffd166;color:#ffd166;white-space:nowrap}.chip.pscore.psdead{opacity:.75}' +
    '.psbd{display:none;position:fixed;z-index:240;left:0;top:0;min-width:190px;max-width:min(260px,calc(100vw - 16px));background:#14122b;color:#eee;border:2px solid #ffd166;border-radius:10px;padding:8px 10px;font-size:12px;line-height:1.35;text-align:left;box-shadow:0 6px 18px rgba(0,0,0,.5);white-space:normal}' +
    '.psbd table{width:100%;border-collapse:collapse;margin:4px 0}.psbd td{padding:1px 4px}.psbd td:nth-child(n+2){text-align:right}.psbd .muted{font-size:11px}' +
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
  var api = { discardInfo: discardInfo, rarityChip: rarityChip, rarityAll: rarityAll, rarity: rarity, bitsOf: bitsOf, rarityLine: rarityLine, fmtN: fmtN, compute: compute, ensure: ensure, cached: cached, get: get, of: of, badge: badge, label: label, WEIGHTS: W, LABELS: LABEL, install: install };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') { window.PetScore = api; if (window.document && document.createElement && document.head) try { install(document); } catch (e) {} }
})(typeof window !== 'undefined' ? window : globalThis);
