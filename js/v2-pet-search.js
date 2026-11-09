/* species-ranks-split (Oct 24 2026, display only): free-text pet search for My Pets (#fSearch). Matches as you type, case-insensitive.
 * Every word must match (AND). A word matches a pet's name, #number, species, hybrid, rarity tier (Common..Legendary, Mythic), stage,
 * looks (pattern, eyes, cheeks, background, shades), worn gear (name, slot, tier), traits/stat names, status words (alive, starving, community).
 * Zombies (mypets-zombie-filter, Oct 30 2026): 'zombie' / 'risen', plus 'hungry' (can eat a zombie meal now), 'feral', 'crumbling' (dust within a day).
 * Stat words can carry a number: "vigor:18" / "vigor=18" (exact), "vigor>15", "vigor>=15", "luck<5".
 * A list of pet numbers (spaces, commas or newlines, optional #) shows those pets only: exact ids, duplicates ignored.
 * One number is that pet only, not every id that starts with those digits. A broken token (12abc) matches nothing, so a bad paste
 * cannot land on some other pet. About 5,000 ids is the practical cap. Name and species words stay the normal search.
 * No rule changes: it only decides which cards are shown. Pure; tested in tools/pet-search-test.js. */
(function (root) {
  var STATS = ['vigor', 'spark', 'grit', 'zoom', 'luck'], TL = ['common', 'uncommon', 'rare', 'legendary'];
  function V() { return root.V2Rules || {}; }
  function words(q) { return String(q || '').toLowerCase().split(/[\s,]+/).filter(Boolean); }
  /* id-list (t3278u): paste any number of pet ids. Exact ids only, capped so a huge paste stays a filter and not a freeze. */
  var ID_CAP = 5000, ID_CHARS = 80000;
  function cleanId(tok) { var m = /^#?(\d+)$/.exec(tok); if (!m || m[1].length > 15) return null; var n = parseInt(m[1], 10); return n >= 0 && n <= 9007199254740991 ? n : null; }
  function idLike(tok) { return tok.charAt(0) === '#' || /\d/.test(tok); }
  /** idQuery(q) -> null (ordinary words) | { mode:'ids', ids, asked, capped } | { mode:'bad', bad }. Display only. */
  function idQuery(q) {
    var raw = String(q == null ? '' : q); if (!raw.trim()) return null; if (raw.length > ID_CHARS) raw = raw.slice(0, ID_CHARS);
    var tokens = raw.split(/[\s,]+/).filter(Boolean); if (!tokens.length) return null;
    var ids = [], seen = {}, bad = [], i, n, listish = /[,\n\r]/.test(String(q)) || tokens.length > 1;
    for (i = 0; i < tokens.length; i++) { n = cleanId(tokens[i]); if (n == null) bad.push(tokens[i]); else if (!seen[n]) { seen[n] = 1; ids.push(n); } }
    if (!bad.length && ids.length) return { mode: 'ids', ids: ids.length > ID_CAP ? ids.slice(0, ID_CAP) : ids, asked: Math.min(ids.length, ID_CAP), pasted: ids.length, capped: ids.length > ID_CAP || String(q).length > ID_CHARS };
    if (listish && bad.some(idLike) && (ids.length || bad.length > 1 || /[,\n\r]/.test(String(q)))) return { mode: 'bad', bad: bad.slice(0, 4) };
    return null;
  }
  function bindPaste(el) { if (!el || el.__idPaste) return; el.__idPaste = 1; el.addEventListener('paste', function (e) {
    var t = e.clipboardData && e.clipboardData.getData('text'); if (!t || !/[\r\n]/.test(t)) return; e.preventDefault();
    var v = t.replace(/\r\n/g, '\n').replace(/[\r\n]+/g, ' '), a = el.selectionStart || 0, b = el.selectionEnd == null ? a : el.selectionEnd, cur = el.value || '';
    el.value = cur.slice(0, a) + v + cur.slice(b); var p = a + v.length; try { el.setSelectionRange(p, p); } catch (err) {}
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }); }
  function hay(p, w, ks, fs) { var V2 = V(), out = [p.name, '#' + p.id, p.species];
    try { out.push(V2.speciesLabel(p.species)); } catch (e) { }
    var hyb = !!(p.hybrid || (p.art && p.art.hybrid) || (V2.isHybrid && V2.isHybrid(p.species)));
    if (hyb) out.push('hybrid'); if (p.parents && p.parents.length) out.push('bred'); else out.push('hatched');
    out.push(TL[p.tier] || ''); if (p.stage >= 5) out.push('mythic'); if (p.resurrected) out.push('god', 'gods');
    try { out.push((V2.STAGE_NAMES || [])[p.stage]); } catch (e) { }
    if (p.dead) out.push('dead'); else out.push('alive'); if (p.community) out.push('community'); if (p.released) out.push('released');
    if (p.status) out.push(p.status); if (p.oldMoney) out.push('old money'); if (p.zombie && !p.zombie.end) out.push('risen', 'zombie'); if (p.feral) out.push('feral'); if ((p.zPast || []).some(function (z) { return z.end && z.end.kind === 'resurrected'; })) out.push('resurrected'); /* cemetery loop */
    try { var ZF = root.V2ZombieFilter; if (ZF && w && ZF.isZ(p)) Array.prototype.push.apply(out, ZF.words(w, p, (w.tip || 0) + 1, p.owner)); } catch (e) { } /* mypets-zombie-filter: 'zombie hungry', 'feral', 'crumbling' (engine zombie view, display only) */
    if (ks && ks.has(p.id)) out.push('selected', 'checked'); /* mypets-checkbox: the checked pets */
    if (fs && fs.has(p.id)) out.push('starred', 'kept', 'favorite'); /* favorite-star-restore: the ★ favorites */
    if (p.hungry && !p.dead) out.push('hungry'); if (p.lastFed == null && !(p.zombie && !p.zombie.end) && !Object.keys(p.feedDays || {}).length) out.push('unfed', 'never fed');
    STATS.forEach(function (k) { if (p.stats && p.stats[k] != null) out.push(k); });
    try { if (root.PetCore && p.art) { var d = root.PetCore.describe(p.art); Object.keys(d).forEach(function (k) { if (k !== 'Tier' && d[k]) out.push(d[k]); }); } } catch (e) { }
    var rh = (p.art && p.art.rareHatch && p.art.rareHatch.version === 1 && p.art.rareHatch) || (p.rareHatch && p.rareHatch.version === 1 && p.rareHatch) || null;
    if (rh && rh.kind) { out.push(rh.kind, String(rh.kind).replace(/-/g, ' ')); var WK = { tiny: 1, giant: 1, 'two-headed': 1, inverted: 1, ghost: 1, backwards: 1, 'wrong-egg': 1 }, LK = { djpepe: 1, wizard: 1, kek: 1, god: 1 }; if (WK[rh.kind]) out.push('weird', 'birth'); if (LK[rh.kind]) out.push('legend', 'legendary'); }
    try { if (w && V2.wornOf) V2.wornOf(w, p.id).forEach(function (g) { out.push('gear', g.label, g.item, g.slot, TL[g.tier] || '', g.legendary ? 'legendary' : '');
      try { out.push(V2.slotLabel(g.slot)); } catch (e) { } }); } catch (e) { }
    return out.filter(Boolean).join(' | ').toLowerCase(); }
  function cmp(a, op, b) { return op === '>' ? a > b : op === '>=' ? a >= b : op === '<' ? a < b : op === '<=' ? a <= b : a === b; }
  function one(t, p, h) { var m = /^([a-z]+)\s*(>=|<=|>|<|=|:)\s*(\d+)$/.exec(t);
    if (m && STATS.indexOf(m[1]) >= 0) { var v = p.stats && p.stats[m[1]]; return v != null && cmp(Number(v), m[2], Number(m[3])); }
    if (t.charAt(0) === '#') return false; /* a broken # token must not match every pet, because the haystack starts with #id */
    var n = t.replace(/^#/, ''); if (/^\d+$/.test(n)) return Number(p.id) === parseInt(n, 10);
    return h.indexOf(t) >= 0; }
  /** matcher(q, w) -> function(p) true when the pet is shown; null when q is empty. An id list is exact (OR). Words stay AND. */
  function matcher(q, w) { var iq = idQuery(q); if (iq && iq.mode === 'bad') return function () { return false; };
    if (iq && iq.mode === 'ids') { var set = new Set(iq.ids); return function (p) { return set.has(Number(p.id)); }; }
    var ws = words(q); if (!ws.length) return null; var cache = new Map(), ks = null; try { var U = root.V2UI; if (U && U.S) ks = new Set((U.S().sel || []).map(Number)); } catch (e) { } var fs = null; try { var U2 = root.V2UI; if (U2 && U2.keptIds) fs = new Set(U2.keptIds().map(Number)); } catch (e) { }
    return function (p) { var h = cache.get(p); if (h == null) { h = hay(p, w, ks, fs); cache.set(p, h); } return ws.every(function (t) { return one(t, p, h); }); }; }
  var api = { matcher: matcher, words: words, haystack: hay, idQuery: idQuery, bindPaste: bindPaste, ID_CAP: ID_CAP };
  root.V2PetSearch = api; if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
