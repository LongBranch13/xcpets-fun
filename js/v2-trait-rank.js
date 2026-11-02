/* trait-rank-1101 (owner 8:14 PM CT Nov 1 2026, "We need a ranking for that too"; display only, no rule change): the 💎 Trait rarity board on
 * ranking.html?board=trait. Every pet PetScore ranks (js/pet-score.js: community and released pets are not ranked), sorted by its trait
 * rarity '1 in N' (2^bits over species, eyes, pattern, background, cheeks, mutation and throwback trait), rarest first; the same number as the 💎 chip on the pet page.
 * Filters: 🥚 Egg-hatched (no parents, not a hybrid: the same test as the 🥚 Hatched badge) or every pet, and alive only. One page of rows at a
 * time (50, 25 on phones); sprites draw lazily (V2Render.lazy). The sorted list is computed once per replayed world (WeakMap on the world,
 * tip and pet count, like PetScore.get) and only after the page has painted, so the page never freezes.
 * URL: ?board=trait[&pets=all][&alive=1][&page=N][&pet=ID]. pet=ID (the link on the pet page chip) opens the page with that pet and highlights it. */
(function () {
  'use strict';
  var cache = typeof WeakMap === 'function' ? new WeakMap() : null, MED = ['🥇', '🥈', '🥉'], TCOL = ['#9aa3b5', '#4fd18b', '#4f9dff', '#ffc93c'];
  function isHyb(p) { var V = window.V2Rules; return !!(p.hybrid || (p.art && p.art.hybrid) || (V && V.isHybrid ? V.isHybrid(p.species) : /^hyb3?:/.test(String(p.species)))); } /* same test as js/ux-batch.js originOf */
  function egg(p) { return !(p.parents && p.parents.length) && !isHyb(p); }
  /** sorted(w) -> [{ p, oneIn, bits }] rarest first (ties: lower pet # first). Cached per world. */
  function sorted(w) { var c = cache && cache.get(w), n = (w.pets || []).length; if (c && c.tip === w.tip && c.len === n) return c.list;
    var list = []; if (!window.PetScore) return list; /* rarityAll: only the trait part of PetScore (same numbers as the 💎 chip), not the full score */
    (PetScore.rarityAll ? PetScore.rarityAll(w) : PetScore.get(w).ranked.map(function (r) { return { id: r.id, bits: r.rarityBits, oneIn: r.rarityOneIn }; })).forEach(function (r) { var p = w.byId[r.id]; if (p) list.push({ p: p, oneIn: r.oneIn, bits: r.bits }); });
    list.sort(function (a, b) { return b.bits - a.bits || a.p.id - b.p.id; });
    if (cache) cache.set(w, { tip: w.tip, len: n, list: list }); return list; }
  function view(w, eggOnly, aliveOnly) { var L = sorted(w).filter(function (r) { return (!eggOnly || egg(r.p)) && (!aliveOnly || !r.p.dead); }), rk = 0;
    L.forEach(function (r, i) { rk = i > 0 && L[i - 1].bits === r.bits ? rk : i + 1; r.rank = rk; }); return L; }
  /** top(w, n, opts) -> the first n rows (opts.all: every pet; opts.alive: alive only). For checks and the brief. */
  function top(w, n, o) { o = o || {}; return view(w, !o.all, !!o.alive).slice(0, n || 5).map(function (r) { return { rank: r.rank, id: r.p.id, name: r.p.name, species: r.p.species, tier: r.p.tier, dead: !!r.p.dead, owner: r.p.owner, oneIn: r.oneIn, bits: r.bits }; }); }
  var api = { egg: egg, sorted: sorted, view: view, top: top, find: null };
  /** page(O): render the board into #board. O = { top: tabs html, wire: fn, w, ME, esc, fmt, spLabel, TL, R, V, status: fn(text) } */
  api.page = function (O) {
    var w = O.w, esc = O.esc, fmt = O.fmt, ME = O.ME, R = O.R, V = O.V, $ = function (id) { return document.getElementById(id); };
    var STEP = window.matchMedia && matchMedia('(max-width: 640px)').matches ? 25 : 50, q = new URLSearchParams(location.search);
    var st = { eggOnly: q.get('pets') !== 'all', alive: q.get('alive') === '1', pg: Math.max(1, +q.get('page') || 1), focus: +q.get('pet') || 0, hits: null };
    var ba = $('boardAll'); if (ba) ba.style.display = 'none';
    function short(a) { return a ? a.slice(0, 6) + '…' + a.slice(-4) : ''; }
    function url() { try { var u = new URL(location.href); u.searchParams.set('board', 'trait'); ['mode', 'span', 'species'].forEach(function (k) { u.searchParams.delete(k); });
      if (st.eggOnly) u.searchParams.delete('pets'); else u.searchParams.set('pets', 'all'); if (st.alive) u.searchParams.set('alive', '1'); else u.searchParams.delete('alive');
      if (st.pg > 1) u.searchParams.set('page', st.pg); else u.searchParams.delete('page'); if (st.focus) u.searchParams.set('pet', st.focus); else u.searchParams.delete('pet'); u.hash = ''; history.replaceState(null, '', u); } catch (e) { } }
    var NOTE = 'Trait rarity: how unusual a pet\u2019s species, eyes, pattern, background, cheeks, mutation and throwback trait are across every pet, shown as 1 in N (the 💎 chip on each pet page). Display only: it is not the hatch tier and changes nothing in the game.';
    function shell(inner) { $('board').innerHTML = (O.top || '') + '<p class="small muted rknote">' + NOTE + '</p>' + inner; if (O.wire) O.wire(); }
    shell('<p class="small muted" id="trWait">💎 Ranking every pet by trait rarity…</p>');
    var L = null;
    function rowHtml(r, i) { var p = r.p, me = !!ME && p.owner === ME, god = p.resurrected, col = TCOL[p.tier] || '#666', hit = st.hits && st.hits.indexOf(i) >= 0;
      var life = p.dead ? '<span class="badge bad">💀 dead</span>' : p.zombie && !p.zombie.end ? '<span class="chip tr-alive">🧟 risen</span>' : '<span class="chip tr-alive">💚 alive</span>';
      return '<tr id="rk' + i + '" data-pet="' + p.id + '" class="' + (me ? 'me' : '') + (hit ? ' uxp-hit' : '') + (p.id === st.focus ? ' tr-focus' : '') + '"><td class="rk">' + (r.rank <= 3 ? MED[r.rank - 1] + ' ' : '') + '#' + fmt(r.rank) + '</td>' +
        '<td><a href="pet.html?id=' + p.id + '" aria-label="' + esc(p.name) + ' #' + p.id + ' pet card"><canvas width="32" height="32" data-id="' + p.id + '" style="width:48px;height:48px;image-rendering:pixelated;border:2px solid ' + col + ';border-radius:4px' + (p.dead ? ';filter:grayscale(1) brightness(.75)' : '') + '"></canvas></a></td>' +
        '<td><a href="pet.html?id=' + p.id + '"><b>' + esc(p.name) + '</b></a> <span class="muted">#' + p.id + ' · ' + esc(O.spLabel(p.species)) + ' · <span style="color:' + col + '">' + (god ? 'God' : esc(O.TL[p.tier] || '')) + '</span></span> ' + life +
        '<div class="small muted">owner <span title="' + esc(p.owner || '') + '">' + esc(short(p.owner)) + '</span>' + (me ? ' (you)' : '') + '</div></td>' +
        '<td class="num"><b class="tr-n" title="Trait rarity ' + r.bits.toFixed(1) + '">1 in ' + esc(PetScore.fmtN(r.oneIn)) + '</b><div class="small muted">💎 ' + r.bits.toFixed(1) + '</div></td></tr>'; }
    function pager(n) { var P = Math.max(1, Math.ceil(n / STEP)); if (P <= 1) return '';
      return '<div class="rkctl tr-pager" role="navigation" aria-label="Pages"><button type="button" class="q" data-pg="1"' + (st.pg <= 1 ? ' disabled' : '') + '>« First</button><button type="button" class="q" data-pg="' + (st.pg - 1) + '"' + (st.pg <= 1 ? ' disabled' : '') + '>‹ Prev</button>' +
        '<span class="small">Page <b>' + fmt(st.pg) + '</b> of ' + fmt(P) + '</span><button type="button" class="q" data-pg="' + (st.pg + 1) + '"' + (st.pg >= P ? ' disabled' : '') + '>Next ›</button><button type="button" class="q" data-pg="' + P + '"' + (st.pg >= P ? ' disabled' : '') + '>Last »</button></div>'; }
    function draw(scroll) { L = view(w, st.eggOnly, st.alive); var P = Math.max(1, Math.ceil(L.length / STEP)); st.pg = Math.min(Math.max(1, st.pg), P); url();
      var a = (st.pg - 1) * STEP, rows = L.slice(a, a + STEP);
      var ctl = '<div class="rkctl tr-ctl"><span class="seg" role="group" aria-label="Which pets"><button type="button" class="q' + (st.eggOnly ? ' on' : '') + '" data-egg="1" aria-pressed="' + st.eggOnly + '">🥚 Egg-hatched</button><button type="button" class="q' + (!st.eggOnly ? ' on' : '') + '" data-egg="0" aria-pressed="' + !st.eggOnly + '">All pets</button></span>' +
        ' <label class="small tr-alivebox"><input type="checkbox" id="trAlive"' + (st.alive ? ' checked' : '') + '> Alive only</label>' + (ME ? ' <button type="button" class="q" id="trMine">📍 My rarest pet</button>' : '') + '</div>';
      var body = rows.map(function (r, k) { return rowHtml(r, a + k); }).join('');
      shell(ctl + pager(L.length) + (rows.length ? '<div class="tw"><table class="board trboard">' + body + '</table></div>' : '<p class="muted small">No pets match these filters yet.</p>') + pager(L.length));
      $('board').querySelectorAll('canvas[data-id]').forEach(function (c) { var p = w.byId[c.getAttribute('data-id')]; R.lazy(c, function () { return R.petFrames(p, w); }, true); });
      $('board').querySelectorAll('[data-egg]').forEach(function (x) { x.onclick = function () { st.eggOnly = x.dataset.egg === '1'; st.pg = 1; st.hits = null; st.focus = 0; draw(); }; });
      $('board').querySelectorAll('[data-pg]').forEach(function (x) { x.onclick = function () { st.pg = +x.dataset.pg; st.hits = null; draw(true); }; });
      if ($('trAlive')) $('trAlive').onchange = function () { st.alive = this.checked; st.pg = 1; st.hits = null; st.focus = 0; draw(); };
      if ($('trMine')) $('trMine').onclick = function () { var i = -1; L.some(function (r, k) { if (r.p.owner === ME) { i = k; return true; } return false; }); if (i < 0) { this.textContent = '📍 None of your pets here'; return; } st.focus = L[i].p.id; go(i); };
      if (O.status) O.status(fmt(L.length) + ' pet' + (L.length === 1 ? '' : 's') + ' ranked by trait rarity' + (st.eggOnly ? ' (egg-hatched' + (st.alive ? ', alive' : '') + ')' : st.alive ? ' (alive)' : '') + '.');
      if (scroll) { var t = $('board').querySelector('.trboard'); if (t && t.getBoundingClientRect().top < 0) t.scrollIntoView({ block: 'start' }); } }
    function go(i) { st.pg = Math.floor(i / STEP) + 1; draw(); var e = $('rk' + i); if (e) { e.scrollIntoView({ block: 'center' }); e.classList.add('flash'); } }
    api.find = function (qq) { if (!L) return 0; var hits = []; L.forEach(function (r, i) { var p = r.p, own = p.owner || '';
        if (qq.id != null ? p.id === qq.id : qq.owner ? own === qq.owner : qq.text ? String(p.name).toLowerCase().indexOf(String(qq.text).toLowerCase()) >= 0 || own.toLowerCase() === String(qq.text).toLowerCase() : false) hits.push(i); });
      st.hits = hits; if (hits.length) go(hits[0]); else draw(); return hits.length; };
    /* paint the tabs and the 'Ranking…' line first, then sort (PetScore.rarityAll once per world) on the next frame */
    (window.requestAnimationFrame || setTimeout)(function () { setTimeout(function () {
      var pid = st.focus, fp = pid && w.byId[pid];
      if (fp) { if (st.eggOnly && !egg(fp)) st.eggOnly = false; if (st.alive && fp.dead) st.alive = false; }
      L = view(w, st.eggOnly, st.alive); var fi = -1; if (fp) L.some(function (r, k) { if (r.p.id === pid) { fi = k; return true; } return false; });
      if (fi >= 0) go(fi); else { st.focus = 0; draw(); } }, 0); });
  };
  window.V2TraitRank = api;
})();
