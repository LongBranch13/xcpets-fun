/* token-gallery (owner 1:17 AM CT Oct 25, 2026, pt1589u): tokens.html "Proof Parade", every tokenized pet in tokenize order.
 * Display only: reads api/ties.json, t/<id>.png and the replayed world (V2Mock.world()) for the current holder and open Spam City
 * listings. Never signs, no rule change, replay untouched. Shows the tied block only (token-gallery-2, Oct 26 2026: no per-block chain calls). Token links go to https://xcp.io/asset/<asset>. */
(function () {
  'use strict';
  var M = window.V2Mock, V = window.V2Rules || {}, R = window.V2Render || {};
  function $(i) { return document.getElementById(i); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function fmt(n) { return Number(n).toLocaleString('en-US'); }
  function short(a) { a = String(a || ''); return a.length > 14 ? a.slice(0, 6) + '…' + a.slice(-4) : a; }
  function ord(n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  var RAR = ['Common', 'Uncommon', 'Rare', 'Legendary', 'Mythic'], TID = ['common', 'uncommon', 'rare', 'legendary', 'mythic'];
  var st = { newest: false, holder: '', rarity: '', species: '', list: [] };
  var ME = M && M.ME;

  function load() {
    return fetch('api/ties.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : { ties: [] }; }).catch(function () { return { ties: [] }; });
  }
  function build(feed) {
    var w = null; try { w = M && M.world(); } catch (e) {}
    var tip = (M && M.state && M.state().tip) || (w && w.tip) || feed.lastBlock || 0, listed = {};
    if (w && V.openListings) try { V.openListings(w, tip + 1).forEach(function (S) { listed[S.petId] = S; }); } catch (e) {}
    var by = {}, out = [];
    (feed.ties || []).forEach(function (t, i) { by[t.id] = { idx: i, id: t.id, asset: t.asset, block: t.tiedBlock, tx: t.tiedTx, kind: t.kind, name: t.name, rarity: t.rarity, species: t.speciesLabel, stage: t.stage }; });
    /* ties newer than the feed (replayed live): same fields from the world */
    if (w && w.deeds) Object.keys(w.deeds).forEach(function (a) { var D = w.deeds[a], p = D && w.byId[D.petId]; if (!p || p.deed !== a || D.destroyed || by[p.id]) return;
      by[p.id] = { idx: Infinity, id: p.id, asset: a, block: D.block, tx: D.tx, kind: 'deed', name: p.name, rarity: RAR[p.tier], species: (p.species === 'kevin' ? 'KEVIN' : String(p.species || '').charAt(0).toUpperCase() + String(p.species || '').slice(1)), stage: p.stageName }; });
    Object.keys(by).forEach(function (k) { var e = by[k], p = w && w.byId && w.byId[e.id];
      if (p) { e.owner = p.owner; e.name = p.name || e.name; e.stage = p.stageName || e.stage; e.pet = p; if (p.deed && p.deed !== e.asset) e.asset = p.deed; }
      e.listed = !!listed[e.id]; out.push(e); });
    /* same block: api/ties.json order (its index); ties replayed past the feed come after, by tx then id */
    out.sort(function (a, b) { return a.block - b.block || (a.idx === b.idx ? 0 : a.idx === Infinity ? 1 : b.idx === Infinity ? -1 : a.idx - b.idx) || String(a.tx).localeCompare(String(b.tx)) || a.id - b.id; });
    out.forEach(function (e, i) { e.no = i + 1; });
    return out;
  }
  function tile(e) {
    var rid = TID[RAR.indexOf(e.rarity)] || 'common', me = ME && e.owner === ME;
    var art = '<img class="tg-art" src="t/' + e.id + '.png" alt="Proof of Pet for ' + esc(e.name) + ' #' + e.id + '" loading="lazy" data-id="' + e.id + '">';
    return '<div class="tg-tile" id="tok-' + e.id + '"><div class="tg-no">' + ord(e.no) + '</div><a href="pet.html?id=' + e.id + '" aria-label="' + esc(e.name) + ' #' + e.id + ' pet card">' + art + '</a>' +
      '<h4><a href="pet.html?id=' + e.id + '">' + esc(e.name) + '</a> <span class="muted">#' + e.id + '</span></h4>' +
      '<div class="small"><span class="pill tier tier-' + rid + '">' + esc(e.rarity) + '</span>' + (e.species ? ' · ' + esc(e.species) : '') + '</div>' +
      '<div class="small muted tg-asset" title="' + esc(e.asset) + '">🎟️ <a href="https://xcp.io/asset/' + encodeURIComponent(e.asset) + '" target="_blank" rel="noopener" aria-label="Token ' + esc(e.asset) + ' on xcp.io">' + esc(e.asset) + ' ↗</a></div>' +
      '<div class="small muted">⛓️ tied in block ' + fmt(e.block) + (e.stage ? ' · ' + esc(e.stage) : '') + '</div>' +
      '<div class="small" title="' + esc(e.owner || '') + '">holder ' + esc(short(e.owner) || 'unknown') + (me ? ' (you)' : '') + '</div>' +
      (e.listed ? '<a class="pill tg-spam" href="shop.html">🛒 Spam City</a>' : '') + '</div>';
  }
  function swapArt() { /* a pet with no Proof of Pet image falls back to its live pixel art */
    $('tgGrid').querySelectorAll('img.tg-art').forEach(function (im) { im.onerror = function () { var w = M && M.world(), p = w && w.byId[im.getAttribute('data-id')]; if (!p || !R.petFrames) { im.onerror = null; return; }
      var c = document.createElement('canvas'); c.width = 32; c.height = 32; c.className = 'tg-art'; im.replaceWith(c); R.lazy(c, function () { return R.petFrames(p, w); }, true); }; if (im.complete && !im.naturalWidth) im.onerror(); });
  }
  function render() {
    var q = st.holder.trim().toLowerCase();
    var show = st.list.filter(function (e) { return (!st.rarity || e.rarity === st.rarity) && (!st.species || e.species === st.species) && (!q || String(e.owner || '').toLowerCase().indexOf(q) >= 0); });
    if (st.newest) show = show.slice().reverse();
    var holders = {}; st.list.forEach(function (e) { if (e.owner) holders[e.owner] = 1; });
    $('status').textContent = fmt(st.list.length) + ' tokenized pet' + (st.list.length === 1 ? '' : 's') + ' from ' + fmt(Object.keys(holders).length) + ' holder' + (Object.keys(holders).length === 1 ? '' : 's') + '.';
    $('tgCount').textContent = show.length === st.list.length ? 'Showing all ' + fmt(show.length) + '.' : 'Showing ' + fmt(show.length) + ' of ' + fmt(st.list.length) + '.';
    $('tgGrid').innerHTML = show.length ? show.map(tile).join('') : '<p class="muted small">No tokenized pets match.</p>';
    swapArt();
  }
  function wire() {
    var sel = $('tgRarity'); RAR.forEach(function (r) { if (st.list.some(function (e) { return e.rarity === r; })) { var o = document.createElement('option'); o.value = r; o.textContent = r; sel.appendChild(o); } });
    sel.onchange = function () { st.rarity = sel.value; render(); };
    var sp = $('tgSpecies'); st.list.map(function (e) { return e.species; }).filter(function (x, i, a) { return x && a.indexOf(x) === i; }).sort().forEach(function (x) { var o = document.createElement('option'); o.value = x; o.textContent = x; sp.appendChild(o); });
    sp.onchange = function () { st.species = sp.value; render(); };
    $('tgHolder').oninput = function () { st.holder = this.value; render(); };
    var b = $('tgOrder'); b.onclick = function () { st.newest = !st.newest; b.setAttribute('aria-pressed', String(st.newest)); b.textContent = st.newest ? '⬇️ Newest first' : '⬆️ Oldest first'; render(); };
  }
  load().then(function (feed) { st.list = build(feed); wire(); render(); window.V2TokenGallery = { list: function () { return st.list; } }; });
})();
