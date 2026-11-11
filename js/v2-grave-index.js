/* Paged grave index (display only). Cemetery cards come from this compact list, one visible
 * page at a time (24 on a phone, 60 on a desktop). It does not call V.cemGraves and it does
 * not change replay, refList, feeds, or cemetery place-in-line math.
 * A published index (GET /xp/v1/graves) is preferred. Without one, the page builds the same
 * compact rows from pets already in memory and still paints only the visible page.
 * Full grave facts (V.cemView, the stone, a raise) are loaded for a grave the player opens. */
(function (root) {
  'use strict';
  var PHONE = 24, DESK = 60, DAY = 144;
  var SORTS = {
    rarest: function (a, c) { return c.rank - a.rank || (c.rbits || 0) - (a.rbits || 0) || c.power - a.power || a.id - c.id; },
    newest: function (a, c) { return c.died - a.died || a.id - c.id; },
    oldest: function (a, c) { return a.died - c.died || a.id - c.id; },
    easiest: function (a, c) { return (c.raisable - a.raisable) || a.need - c.need || (c.af || 0) - (a.af || 0) || a.id - c.id; },
    strongest: function (a, c) { return c.power - a.power || a.id - c.id; },
    gear: function (a, c) { return c.gear - a.gear || c.power - a.power || a.id - c.id; },
    lived: function (a, c) { return life(c) - life(a) || a.id - c.id; },
    id: function (a, c) { return a.id - c.id; }
  };
  function life(p) { return p.born != null && p.died != null ? p.died - p.born : -1; }
  function day(b, V) { return Math.floor((b || 0) / ((V && V.BLOCKS_PER_DAY) || DAY)); }
  function per() { try { return root.matchMedia && root.matchMedia('(max-width: 640px)').matches ? PHONE : DESK; } catch (e) { return DESK; } }
  function base() {
    try { if (root.V2BootSync && V2BootSync.base) return V2BootSync.base() || ''; } catch (e) {}
    return '';
  }
  /** compactPet(p, b, V, w): one grave row, or null when the pet is not a grave. No world scan. */
  function compactPet(p, b, V, w) {
    if (!p || p.community || p.released) return null;
    if (p.zombie && !p.zombie.end) return null;
    if (!p.dead) return null;
    var d0 = p.zFirstDeath != null ? p.zFirstDeath : p.deathBlock, tier = Math.max(0, Math.min(3, p.tier | 0));
    var st = p.graveState || (p.resurrected ? 'halo' : null);
    var diff = st ? 'closed' : (p.mgDead || tier >= 3) ? 'hard' : tier === 2 ? 'medium' : 'easy';
    var stage = p.stage | 0, mythic = !!(p.mgDead || stage >= 5 || p.mythicCare);
    var stats = p.zDeath || p.stats || {}, power = 0, keys = ['vigor', 'spark', 'grit', 'zoom', 'luck'], i;
    for (i = 0; i < keys.length; i++) power += stats[keys[i]] || 0;
    var altar = w && w.cem && w.cem.altars && w.cem.altars[p.id];
    return {
      id: p.id, name: p.name || ('#' + p.id), species: p.species,
      spl: V && V.speciesLabel ? V.speciesLabel(p.species) : (p.species || ''),
      tier: tier, stage: stage, stageName: V && V.stageLabelOf ? V.stageLabelOf(p) : (p.stageName || ''),
      owner: p.owner || '', gear: 0, power: power, born: p.hatchBlock != null ? p.hatchBlock : null, died: d0,
      fed: p.lastFed != null ? p.lastFed : null, hybrid: V && V.isHybrid ? !!V.isHybrid(p.species) : !!p.hybrid,
      days: Math.max(0, day(b, V) - day(d0, V)), diff: diff,       need: p.mgDead ? Math.max(tier, Math.max(0, tier - 1)) : Math.max(0, tier - 1),
      needLabel: ['Common', 'Uncommon', 'Rare', 'Legendary'][p.mgDead ? Math.max(tier, Math.max(0, tier - 1)) : Math.max(0, tier - 1)] + '+',
      state: st, restUntil: null, restOwner: null, open: !!(altar && altar.status === 'open'),
      raisable: st ? 0 : 1, af: 1, crumbles: p.zCrumbles || 0, mythic: p.mgDead ? 1 : 0, rank: mythic ? 4 : tier, rbits: -1, oneIn: '',
      resurrected: st === 'halo' ? 1 : 0
    };
  }
  function compact(w, b, V) {
    var pets = (w && w.pets) || [], out = [], i, row;
    for (i = 0; i < pets.length; i++) { row = compactPet(pets[i], b, V, w); if (row) out.push(row); }
    return out;
  }
  function pass(p, q) {
    if (q.tier !== '' && q.tier != null && p.tier !== +q.tier) return false;
    if (q.stage !== '' && q.stage != null && p.stage !== +q.stage) return false;
    if (q.diff && p.diff !== q.diff) return false;
    if (q.raisable && !p.raisable) return false;
    if (q.open && !p.open) return false;
    if (q.mine && q.owner && p.owner !== q.owner) return false;
    if (q.sp) { if (q.sp === '__hyb' ? !p.hybrid : p.species !== q.sp || p.hybrid) return false; }
    if (q.minDays != null && p.days < q.minDays) return false;
    if (q.maxDays != null && p.days > q.maxDays) return false;
    if (q.meals === 'fed' && p.fed == null) return false;
    if (q.meals === 'nf' && p.fed != null) return false;
    var text = q.text || '';
    if (!text) return true;
    var exact = q.exact, num = q.num, low = String(p.name || '').toLowerCase();
    if (exact) return String(p.id) === text;
    if (num) return String(p.id).indexOf(text) === 0;
    return low.indexOf(text) >= 0 || String(p.spl || '').toLowerCase().indexOf(text) >= 0 || String(p.owner || '').toLowerCase() === text || (text.length >= 6 && String(p.owner || '').toLowerCase().indexOf(text) >= 0);
  }
  /** query(rows, q): filter, sort, and return ONLY the visible page. q.page is 0-based, q.per is 24 or 60. */
  function query(rows, q) {
    q = q || {};
    var list = [], i, text = String(q.text || q.q || '').trim().toLowerCase().replace(/^#/, '');
    var exact = /^#\d+$/.test(String(q.text || q.q || '').trim().toLowerCase()) || q.exact;
    var box = { tier: q.tier, stage: q.stage, diff: q.diff || '', raisable: !!q.raisable, open: !!q.open, mine: !!q.mine, owner: q.owner || '', sp: q.sp || '', meals: q.meals || '', minDays: q.minDays, maxDays: q.maxDays, text: text, exact: exact, num: /^\d+$/.test(text) };
    for (i = 0; i < rows.length; i++) if (pass(rows[i], box)) list.push(rows[i]);
    list.sort(SORTS[q.sort] || SORTS.rarest);
    if (box.num) list.sort(function (a, c) { return (String(c.id) === text) - (String(a.id) === text); });
    var size = q.per > 0 ? q.per : DESK, pages = Math.max(1, Math.ceil(list.length / size)), page = Math.max(0, Math.min(q.page || 0, pages - 1));
    return { total: rows.length, matched: list.length, page: page, pages: pages, per: size, rows: list.slice(page * size, page * size + size) };
  }
  function countsOf(rows) {
    var species = {}, stages = {}, i, p;
    for (i = 0; i < rows.length; i++) { p = rows[i]; species[p.hybrid ? '__hyb' : p.species] = (species[p.hybrid ? '__hyb' : p.species] || 0) + 1; stages[p.stage] = (stages[p.stage] || 0) + 1; }
    return { dead: rows.length, species: species, stages: stages };
  }
  function qs(q) {
    var parts = [], k, v;
    q = q || {};
    for (k in q) if (Object.prototype.hasOwnProperty.call(q, k) && q[k] !== '' && q[k] != null && q[k] !== false) { v = q[k] === true ? '1' : String(q[k]); parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(v)); }
    return parts.join('&');
  }
  function fetchJson(url) {
    return fetch(url, { method: 'GET' }).then(function (r) { if (!r.ok) throw new Error('graves ' + r.status); return r.json(); });
  }
  function counts(syncBase) {
    if (!syncBase) return Promise.reject(new Error('no sync'));
    return fetchJson(String(syncBase).replace(/\/+$/, '') + '/xp/v1/graves/counts');
  }
  function fetchPage(syncBase, q) {
    if (!syncBase) return Promise.reject(new Error('no sync'));
    return fetchJson(String(syncBase).replace(/\/+$/, '') + '/xp/v1/graves?' + qs(q));
  }
  var api = { PHONE: PHONE, DESK: DESK, per: per, base: base, compactPet: compactPet, compact: compact, query: query, countsOf: countsOf, counts: counts, fetchPage: fetchPage, SORTS: SORTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.V2GraveIndex = api;
})(typeof window !== 'undefined' ? window : globalThis);
