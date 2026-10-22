/* XCPETS Pet Score (owner approved 2026-10-19 5:52 PM CT). Display only: a deterministic 0-1000 score computed off-chain from the replayed
 * world. No rule change, nothing on chain, separate from the hatch tier. Pure function of the world: PetScore.compute(w) ->
 * { tip, n, byId: { id: { score, rank, percentile, top, dead, breakdown } } }. The community pet (Bitcoin Wizard) and released pets are not ranked.
 * Growth = 85% feeding progress toward Mythic + 15% owner wallet check-in streak (cap 7 days).
 * Weights: Stats 30, Looks 20, Growth 15, Gear 15, Battles 10, Scarcity 10. Works in the browser (window.PetScore) and in Node (module.exports). */
(function (root) {
  'use strict';
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
  /* Growth streak (DRAFT 2026-10-19, login-streak branch): the OWNER WALLET's current daily check-in streak (any valid game burn that chain day,
   * or the 1-sat pet:checkin), capped at 7, replaces the old per-pet feed streak. Same 144-block chain day as feeding. */
  function streak(w, p, tip, V) { if (V && V.streakOf && w.checkins) return V.streakOf(w, p.owner, tip).current;
    var fd = p.feedDays || {}, d = Math.floor(tip / BPD); if (!fd[d]) d--; var n = 0; while (fd[d]) { n++; d--; } return n; }
  function compute(w, opt) {
    opt = opt || {}; var V = opt.rules || root.V2Rules, tip = w.tip || 0;
    var pets = (w.pets || []).filter(function (p) { return !isComm(p) && !p.released; }), N = pets.length, byId = {};
    if (!N) return { tip: tip, n: 0, byId: byId, ranked: [] };
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
    var RF = {}, rk = pets.map(function (p) { var a = p.art || {}, v = [isHyb(p) ? 'hybrid' : String(p.species), a.eyes, a.pattern, a.background, cheekKey(a.cheeks)];
      for (var t = 0; t < v.length; t++) { var key = t + ':' + v[t]; RF[key] = (RF[key] || 0) + 1; v[t] = key; } return v; });
    var rBits = rk.map(function (v) { var b = 0; for (var t = 0; t < v.length; t++) b -= Math.log2(RF[v[t]] / N); return b; });
    /* Scarcity: inverse species count */
    var sc = {}; pets.forEach(function (p) { var g = isHyb(p) ? 'hybrid' : String(p.species); sc[g] = (sc[g] || 0) + 1; });
    var minC = Math.min.apply(null, Object.keys(sc).map(function (k) { return sc[k]; })), maxL = Math.log(N / minC) || 1;
    var res = pets.map(function (p, i) {
      var th = null; try { th = V && V.petThresholds ? V.petThresholds(w, p, tip) : null; } catch (e) { th = null; }
      var my = th && th[5] ? th[5] : 69069, prog = p.ascended || p.mythicCare ? 1 : Math.min(1, (p.care || 0) / my), st = streak(w, p, tip, V);
      var growth = Math.min(1, 0.85 * prog + 0.15 * Math.min(st, 7) / 7);
      var gear = 1 - Math.exp(-(gv[p.id] || 0) / 12);
      var f = (p.wins || 0) + (p.losses || 0), battles = f < 3 ? 0.5 : 0.6 * (p.wins || 0) / f + 0.4 * Math.min(1, (p.wins || 0) / 10);
      var g = isHyb(p) ? 'hybrid' : String(p.species), inv = Math.log(N / sc[g]) / maxL;
      var scarcity = Math.min(1, 0.4 * inv + (isHyb(p) ? 0.4 : 0) + (RARE_SP[p.species] ? 0.3 : 0) + (p.parents ? 0.2 : 0)); /* rarity-sort 2026-10-20: player Wizards get Nakamoto's +0.3 (by species) */
      var parts = { stats: sStats[i], looks: sLooks[i], growth: growth, gear: gear, battles: battles, scarcity: scarcity }, s = 0, bd = {};
      Object.keys(W).forEach(function (k) { var v = Math.max(0, Math.min(1, parts[k])); s += W[k] * v; bd[k] = { value: Math.round(v * 1000) / 1000, weight: W[k], points: Math.round(W[k] * v * 1000) }; });
      bd.stats.total = total(p); bd.looks.sameCombo = cf[ck[i]]; bd.growth.streak = st; bd.growth.mythicPct = Math.round(prog * 100); bd.gear.won = gv[p.id] || 0; bd.battles.fights = f; bd.battles.wins = p.wins || 0;
      return { id: p.id, score: Math.round(s * 1000), dead: !!p.dead, breakdown: bd, rarityBits: rBits[i], rarityOneIn: Math.pow(2, rBits[i]) }; });
    res.sort(function (a, b) { return b.score - a.score || a.id - b.id; });
    res.forEach(function (r, i) { r.rank = i > 0 && res[i - 1].score === r.score ? res[i - 1].rank : i + 1; r.percentile = Math.round(1000 * (1 - (r.rank - 1) / N)) / 10;
      r.top = Math.max(1, Math.ceil(100 * r.rank / N)); byId[r.id] = r; });
    return { tip: tip, n: N, byId: byId, ranked: res };
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
    return '<span class="chip prar" title="Trait rarity: how unusual this pet\'s species, eyes, pattern, background and cheeks are across every pet (display only, not the hatch tier)">💎 Rarity ' + r.bits.toFixed(1) + ' · 1 in ' + fmtN(r.oneIn) + '</span>'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function label(s) { return s.score + ' · top ' + s.top + '%'; }
  function badge(w, p) { if (!p || isComm(p)) return ''; var s = of(w, p); if (!s) return ''; var b = s.breakdown;
    var rows = Object.keys(W).map(function (k) { return '<tr><td>' + LABEL[k] + '</td><td>' + Math.round(W[k] * 100) + '%</td><td>' + b[k].points + '</td></tr>'; }).join('');
    var tip = Object.keys(W).map(function (k) { return LABEL[k] + ' ' + b[k].points + '/' + Math.round(W[k] * 1000); }).join(' · ');
    return '<span class="psw" tabindex="0" role="button" aria-label="Pet Score ' + s.score + ', rank ' + s.rank + '. Tap for breakdown" title="' + esc('Pet Score (rank #' + s.rank + '): ' + tip) + '"><span class="chip pscore' + (s.dead ? ' psdead' : '') + '">⭐ ' + esc(label(s)) + (s.dead ? ' · 🪦' : '') + '</span>' +
      '<span class="psbd"><b>Pet Score ' + s.score + '/1000</b> · rank #' + s.rank + (s.dead ? ' · 🪦 dead' : '') + '<table>' + rows + '</table><span class="muted">Display only, from the chain replay. Not the hatch tier.</span></span></span>'; }
  var CSS = '.chip.prar{background:#1d2b53;border-color:#7fd3ff;color:#bfe9ff;white-space:nowrap}.psw{position:relative;display:inline-block;cursor:pointer;outline:none}.chip.pscore{background:#2b2350;border-color:#ffd166;color:#ffd166;white-space:nowrap}.chip.pscore.psdead{opacity:.75}' +
    '.psbd{display:none;position:absolute;z-index:80;left:0;top:100%;margin-top:4px;min-width:190px;max-width:min(260px,86vw);background:#14122b;color:#eee;border:2px solid #ffd166;border-radius:10px;padding:8px 10px;font-size:12px;line-height:1.35;text-align:left;box-shadow:0 6px 18px rgba(0,0,0,.5);white-space:normal}' +
    '.psbd table{width:100%;border-collapse:collapse;margin:4px 0}.psbd td{padding:1px 4px}.psbd td:nth-child(n+2){text-align:right}.psbd .muted{font-size:11px}' +
    '@media (hover:hover){.psw:hover .psbd{display:block}}.psw:focus .psbd,.psw.open .psbd{display:block}.psw.open,.psw:hover,.psw:focus{z-index:90}*:has(> .chips .psw.open),*:has(> .chips .psw:hover),*:has(> .chips .psw:focus),#chips:has(.psw.open){position:relative;z-index:60}';
  function install(doc) { if (!doc || doc.getElementById('psCss')) return; var s = doc.createElement('style'); s.id = 'psCss'; s.textContent = CSS; (doc.head || doc.documentElement).appendChild(s);
    doc.addEventListener('click', function (e) { var t = e.target && e.target.closest ? e.target.closest('.psw') : null;
      doc.querySelectorAll('.psw.open').forEach(function (x) { if (x !== t) x.classList.remove('open'); });
      if (t) { e.stopPropagation(); e.preventDefault(); t.classList.toggle('open'); } }, true); }
  var api = { rarityChip: rarityChip, rarity: rarity, bitsOf: bitsOf, rarityLine: rarityLine, fmtN: fmtN, compute: compute, get: get, of: of, badge: badge, label: label, WEIGHTS: W, LABELS: LABEL, install: install };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') { window.PetScore = api; if (window.document && document.createElement && document.head) try { install(document); } catch (e) {} }
})(typeof window !== 'undefined' ? window : globalThis);
