/* XCPETS Gear Collection book (gear-closet, Jake Nov 28 2026: "I love all your suggestions" on the gear plan: "A Petdex for gear: every piece,
 * a silhouette for ones you haven't found, and a badge when you finish a set"). DISPLAY ONLY: reads the page's world, nothing is signed.
 * Lives as the 🎽 Gear tab of the Petdex (petdex.html?tab=gear, js/v2-petdex.js calls html / after / tip).
 *   Sets   the gear sets (V2Rules.GEAR_SETS once the rules ship them, the draft list until then, from js/v2-closet.js): own every piece of a
 *          set = SET COMPLETE badge. Set bonuses count only pieces worn on Bitcoin (the rules decide that, not this page).
 *   Slots  every piece in the game by slot (V2Rules.catalogBySlot), rarest last; a piece you own shows in colour with ×copies, one you don't
 *          is a black silhouette. Filters: All / Found / Missing.
 * compute(cat, owned, sets) is pure and node-testable (tools/closet-test.js). Big catalogs: icons draw only when on screen, ~12 ms per frame. */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.V2GearBook = api;
})(typeof window !== 'undefined' ? window : this, function (root) {
  'use strict';
  var d = root && root.document;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return Number(n || 0).toLocaleString('en-US'); }
  var TIERS = ['Common', 'Uncommon', 'Rare', 'Legendary'], TCOL = ['#a7adb5', '#55c35a', '#3d8bff', '#ffb300'];
  var RANKS = [[100, 'DRIP GOD'], [80, 'Fashion Kek'], [60, 'Closet Whale'], [40, 'Drip Lord'], [20, 'Thrift Pepe'], [5, 'Fresh Fit'], [0, 'Naked Chad']];
  /** compute(cat, owned, sets): cat = { slot: [items] } (catalogBySlot), owned = { itemId: copies }, sets = closet sets.
   * { got, total, pct, rank, slots: [{ slot, got, of, items: [{ it, n }] }], sets: [{ set, n, done, have: [bool] }], setsDone } */
  function compute(cat, owned, sets) { var out = { got: 0, total: 0, slots: [], sets: [], setsDone: 0 }; owned = owned || {};
    Object.keys(cat || {}).forEach(function (sl) { var L = (cat[sl] || []).filter(function (it) { return it && !it.alias && !it.retired; }), g = 0;
      var items = L.map(function (it) { var n = owned[it.id] || 0; if (n) g++; return { it: it, n: n }; });
      if (!items.length) return; out.slots.push({ slot: sl, got: g, of: items.length, items: items }); out.got += g; out.total += items.length; });
    (sets || []).forEach(function (s) { var have = s.items.map(function (id) { return !!owned[id]; }), n = have.filter(Boolean).length, done = n >= s.need; if (done) out.setsDone++; out.sets.push({ set: s, n: n, done: done, have: have }); });
    out.pct = out.total ? Math.round(100 * out.got / out.total) : 0; out.rank = RANKS.filter(function (r) { return out.pct >= r[0]; })[0][1]; return out; }
  var F = 'all', X = null, CELLS = [];
  function V() { return root.V2Rules; }
  function C() { return root.V2Closet; }
  function slotName(sl) { try { if (root.XcpSlots) return root.XcpSlots.label(sl); return V().slotLabel(sl); } catch (e) { return sl; } }
  function label(id) { return C() ? C().label(id) : id; }
  function data(w, me) { var R = V(), Cl = C(); if (!R || !R.catalogBySlot || !Cl) return null; return compute(R.catalogBySlot(), me ? Cl.owned(w, me) : {}, Cl.sets()); }
  function cell(it, n) { var i = CELLS.push({ it: it, n: n }) - 1, t = it.tier || 0;
    return '<button type="button" class="gk-c ' + (n ? 'got' : 'miss') + '" style="--rc:' + TCOL[t] + '" data-gb="' + i + '" aria-label="' + esc(label(it.id) + ', ' + TIERS[t] + (n ? ', found' : ', not found yet')) + '"><canvas data-gbi="' + i + '" width="32" height="32"></canvas>' + (n > 1 ? '<b>×' + fmt(n) + '</b>' : '') + (it.exclusive ? '<i>★</i>' : '') + '</button>'; }
  function html(w, me) { X = data(w, me); CELLS = []; if (!X) return '<p class="pdx-note">Loading the gear list…</p>';
    var draft = X.sets.length && X.sets[0].set.draft;
    var h = '<div class="gk-top"><span class="pdx-score"><b>' + X.got + '</b>/' + X.total + ' pieces found</span><span class="pdx-rank">' + esc(X.rank) + '</span><span class="small">' + X.setsDone + ' of ' + X.sets.length + ' sets complete</span><div class="pdx-bar"><i style="width:' + Math.max(2, X.pct) + '%"></i></div></div>' +
      (loading(w) ? '<p class="pdx-note">⏳ Still counting your gear… the book fills in as your pets load.</p>' : '') + '<div class="gk-f" role="group" aria-label="Show">' + [['all', 'All'], ['got', 'Found'], ['miss', 'Missing']].map(function (f) { return '<button type="button" data-gbf="' + f[0] + '" aria-pressed="' + (F === f[0]) + '">' + f[1] + '</button>'; }).join('') + '</div>';
    if (X.sets.length) h += '<h3 class="gk-h">✨ Sets' + (draft ? ' <small>coming soon: bonuses switch on with a rules update</small>' : '') + '</h3><div class="gk-sets">' + X.sets.filter(function (s) { return F === 'all' || (F === 'got' ? s.n : !s.done); }).map(function (s) {
      return '<div class="gk-set' + (s.done ? ' done' : '') + '"' + (s.set.glow ? ' style="--glow:' + esc(s.set.glow) + '"' : '') + '><div class="gk-sn"><b>' + esc(s.set.name) + '</b><small>' + s.n + '/' + s.set.items.length + '</small>' + (s.done ? '<span class="pdx-stamp">SET COMPLETE</span>' : '') + '</div><div class="gk-si">' +
        s.set.items.map(function (id) { var it = (V().GEAR_BY_ID || {})[id]; return it ? cell(it, (C().owned(w, me) || {})[id] || 0) : ''; }).join('') + '</div></div>'; }).join('') + '</div>' +
      '<p class="pdx-note">Wear all ' + (X.sets[0] ? X.sets[0].set.need : 3) + ' pieces of a set on Bitcoin (Gear up in the Rare Room) for its glow' + (draft ? '' : ' and fight bonus') + '. Looks from the 🪞 Wardrobe don’t count.</p>';
    X.slots.forEach(function (s) { var L = s.items.filter(function (x) { return F === 'all' || (F === 'got' ? x.n : !x.n); }); if (!L.length) return;
      h += '<h3 class="gk-h">' + esc(slotName(s.slot)) + ' <small>' + s.got + '/' + s.of + '</small>' + (s.got === s.of ? ' <span class="pdx-stamp">MASTERED</span>' : '') + '</h3><div class="gk-grid">' + L.map(function (x) { return cell(x.it, x.n); }).join('') + '</div>'; });
    return h; }
  /* draw the icons only when on screen, in ~12 ms slices (a full catalog is a few hundred icons) */
  var q = [], qt = 0, obs = null;
  function drawOne(cv) { var x = CELLS[+cv.getAttribute('data-gbi')], R = root.V2Render; if (!x || !R || !R.itemIcon) return; try { R.paint(cv, R.itemIcon(x.it.id)); if (!x.n && C()) C().silhouette(cv); } catch (e) { } }
  function run() { qt = 0; var t0 = Date.now(); while (q.length && Date.now() - t0 < 12) { var c = q.shift(); if (c.isConnected) drawOne(c); } if (q.length) qt = (root.requestAnimationFrame || setTimeout)(run); }
  function soon(c) { q.push(c); if (!qt) qt = (root.requestAnimationFrame || setTimeout)(run); }
  function after(host, scroller) { var cs = host.querySelectorAll('canvas[data-gbi]'); if (!('IntersectionObserver' in root)) { cs.forEach(soon); return; }
    if (obs) obs.disconnect(); obs = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { obs.unobserve(e.target); soon(e.target); } }); }, { root: scroller || null, rootMargin: '200px' });
    cs.forEach(function (c) { obs.observe(c); }); }
  /** click(target): a filter -> true (repaint); a square -> the tip html */
  function click(t) { var f = t.closest('[data-gbf]'); if (f) { F = f.getAttribute('data-gbf'); return { repaint: true }; }
    var c = t.closest('[data-gb]'); if (!c) return null; var x = CELLS[+c.getAttribute('data-gb')]; if (!x) return null; var it = x.it, s = C() && C().setOf(it.id), how = it.exclusive ? 'a species ★ piece: rolls only on ' + esc(it.origin || 'its species') + ' (and its hybrids)' : 'rolls on the Pepe Wheel, fights and the Rumble';
    return { tip: (x.n ? '✅ <b>' + esc(label(it.id)) + '</b> ' + TIERS[it.tier || 0] + ' ' + esc(slotName(it.slot)) + ': you have <b>' + fmt(x.n) + '</b>. Show it on any pet with 🪞 Looks in its Dress drawer.' : '❓ <b>' + esc(label(it.id)) + '</b> ' + TIERS[it.tier || 0] + ' ' + esc(slotName(it.slot)) + ': not found yet. It ' + how + '.') + (s ? ' Part of the <b>' + esc(s.name) + '</b> set.' : '') }; }
  function loading(w) { return !w || !w.itemList || !w.itemList.length || !!(w._pages && w._pages.got < w._pages.total); }
  function tabLabel(w, me) { var x = data(w, me); return x ? 'Gear ' + x.got + '/' + x.total : 'Gear'; }
  var CSS = '#petdex .gk-top{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;margin:0 0 8px}#petdex .gk-f{display:flex;gap:6px;margin:0 0 6px}#petdex .gk-f button{font:13px "Comic Neue",sans-serif;font-weight:700;padding:6px 12px;min-height:36px;border:3px solid #2b2b2b;border-radius:18px;background:#fff;cursor:pointer}#petdex .gk-f button[aria-pressed=true]{background:#2b2b2b;color:#ffe27a}' +
    '#petdex .gk-h{font:22px/1.1 Bangers,Impact,sans-serif;letter-spacing:1px;margin:14px 0 6px;color:#2b2b2b}#petdex .gk-h small{font:12px "Comic Neue",sans-serif;font-weight:700;letter-spacing:0;color:#6b6b6b}' +
    '#petdex .gk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(56px,1fr));gap:6px}#petdex .gk-c{position:relative;aspect-ratio:1;padding:3px;border:3px solid #2b2b2b;border-bottom:6px solid var(--rc);border-radius:8px;background:#140a22;cursor:pointer}' +
    '#petdex .gk-c canvas{width:100%;height:100%;image-rendering:pixelated;display:block}#petdex .gk-c.miss{background:#3a3550;border-bottom-color:#8a8a9a}#petdex .gk-c b{position:absolute;right:1px;bottom:0;font:9px "Press Start 2P",monospace;color:#fff;text-shadow:1px 1px 0 #000}#petdex .gk-c i{position:absolute;left:2px;top:0;font-style:normal;font-size:11px;color:#ffd166;text-shadow:1px 1px 0 #000}' +
    '#petdex .gk-sets{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px}#petdex .gk-set{border:3px solid #2b2b2b;border-radius:10px;background:#fff;padding:6px 8px}#petdex .gk-set.done{background:#eaffe0;box-shadow:0 0 0 3px var(--glow,#55c35a) inset}' +
    '#petdex .gk-sn{display:flex;align-items:center;gap:6px;margin:0 0 4px}#petdex .gk-sn b{font:18px Bangers,Impact,sans-serif;letter-spacing:1px}#petdex .gk-sn small{font-weight:700}#petdex .gk-si{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}';
  function css() { if (!d || d.getElementById('gkCss')) return; var s = d.createElement('style'); s.id = 'gkCss'; s.textContent = CSS; (d.head || d.documentElement).appendChild(s); }
  return { compute: compute, html: function (w, me) { css(); return html(w, me); }, after: after, click: click, tabLabel: tabLabel, RANKS: RANKS };
});
