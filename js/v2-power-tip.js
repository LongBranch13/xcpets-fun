/* power-tooltip-values (Oct 25 2026, display only): Power and stat hovers show the pet's real numbers, not the formula.
 *   V2PowerTip.power(p)  -> 'Vigor 12 + Spark 9 + Grit 7 + Zoom 10 + Luck 10 = 48'   (same sum as V2Rules.petPower)
 *   V2PowerTip.stats(p)  -> 'Vigor 12 · Spark 9 · Grit 7 · Zoom 10 · Luck 10'
 *   V2PowerTip.hp(p)     -> '40 + 2 times Vigor 12 + Grit 7 + 6 times stage 3 (Adult) = 89'  (simulateFight HP)
 *   V2PowerTip.gear(list)-> 'Ruby crown 5 + Fetch Stick 3 = +8 per hit'  (each piece 1 + 2 times its tier)
 *   V2PowerTip.attr(text)-> ' data-ptip="…" aria-label="…" tabindex="0"' for any element.
 * One shared bubble: shows on mouse hover / keyboard focus, and on a tap on touch screens (tap again or tap elsewhere to close).
 * carrier-tip (Nov 24 2026, Evan): each stat the pet CARRIES (p.carried, the breed carry from a two-owner breed) shows beside it in another colour,
 *   e.g. 'Vigor 29 (30) + Spark 26 + Grit 28 (30) ...'. In the text it is marked ⟦30⟧; show() paints it as a coloured '(30)' and attr() reads it
 *   as '(carries 30)' for screen readers. Only stats that have a carrier are marked. Highest carried value per stat (the breed floor uses each one).
 * Nothing here touches rules, replay or burns. */
(function () {
  'use strict';
  var K = ['vigor', 'spark', 'grit', 'zoom', 'luck'], N = { vigor: 'Vigor', spark: 'Spark', grit: 'Grit', zoom: 'Zoom', luck: 'Luck' };
  var STG = ['Egg', 'Hatchling', 'Juvenile', 'Adult', 'Elder', 'Mythic'];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function st(p, k) { return Number(((p && p.stats) || {})[k]) || 0; }
  /* carried(p) -> { stat: highest carried value } for the stats this pet carries (v2-rules breed carry: in its later breeds the egg's stat is at least this) */
  function carried(p) { var o = {}, L = (p && p.carried) || []; for (var i = 0; i < L.length; i++) { var c = L[i], v = c ? Number(c.value) : NaN; if (c && N[c.stat] && isFinite(v) && !(o[c.stat] >= v)) o[c.stat] = v; } return o; }
  function cTag(c, k) { return c[k] != null ? ' ⟦' + c[k] + '⟧' : ''; }
  /* one plain line under the sum, with this pet's own first carried stat as the example */
  function cNote(c) { var ks = K.filter(function (k) { return c[k] != null; }); if (!ks.length) return ''; var k = ks[0];
    return '\n⟦' + c[k] + '⟧ = carried: when this pet breeds, its egg gets at least ' + c[k] + ' ' + N[k] + (ks.length > 1 ? ' (same for each coloured number)' : '') + '.'; }
  function total(p) { return K.reduce(function (a, k) { return a + st(p, k); }, 0); }
  function shards(p) { var S = (p && p.shards) || {}; return K.reduce(function (a, k) { return a + (Number(S[k]) || 0); }, 0); } /* POWER SHARDS (quest-shards-1103): shard points are already inside the stats */
  function power(p) { var s = shards(p), c = carried(p); return K.map(function (k) { return N[k] + ' ' + st(p, k) + cTag(c, k); }).join(' + ') + ' = ' + total(p) + (s ? ' (includes ' + s + ' shard point' + (s === 1 ? '' : 's') + ' from quests' + (p.shardsIn ? ', ' + p.shardsIn + ' from its parents' : '') + ')' : '') + cNote(c); }
  function stats(p) { var c = carried(p); return K.map(function (k) { return N[k] + ' ' + st(p, k) + cTag(c, k); }).join(' · ') + cNote(c); }
  function hp(p) { var s = (p && p.stage) || 0; return '40 + 2 times Vigor ' + st(p, 'vigor') + ' + Grit ' + st(p, 'grit') + ' + 6 times stage ' + s + (STG[s] ? ' (' + STG[s] + ')' : '') + ' = ' + (40 + 2 * st(p, 'vigor') + st(p, 'grit') + 6 * s); }
  /* list: [{label, tier}] -> each piece adds 1 + 2 times its tier per hit */
  function gear(list) { list = list || []; if (!list.length) return 'No gear worn: +0 per hit'; var t = 0;
    return list.map(function (g) { var v = 1 + 2 * (Number(g.tier) || 0); t += v; return g.label + ' ' + v; }).join(' + ') + ' = +' + t + ' per hit (each piece 1 + 2 times its tier)'; }
  /* plain(text): the words a screen reader (or any plain-text use) gets: ⟦30⟧ -> (carries 30) */
  function plain(text) { return String(text == null ? '' : text).replace(/\n⟦(\d+)⟧ = carried:/g, '. Carried:').replace(/⟦(\d+)⟧/g, '(carries $1)').replace(/\n/g, ' '); }
  function attr(text) { return ' data-ptip="' + esc(text) + '" aria-label="' + esc(plain(text)) + '" tabindex="0"'; }
  var api = { shards: shards, power: power, stats: stats, hp: hp, gear: gear, attr: attr, total: total, carried: carried, plain: plain };
  window.V2PowerTip = api;
  if (typeof document === 'undefined') return;
  var d = document, bub = null, cur = null;
  function css() { if (d.getElementById('ptipCss')) return; var s = d.createElement('style'); s.id = 'ptipCss';
    s.textContent = '[data-ptip]{cursor:help}.ptip-b{position:fixed;z-index:99999;max-width:min(320px,92vw);padding:6px 9px;background:#14122b;color:#eee;border:2px solid #ffd166;border-radius:10px;font-size:12px;line-height:1.35;pointer-events:none;box-shadow:0 6px 18px rgba(0,0,0,.5);text-align:left;white-space:pre-line}.ptip-c{color:#7fdcff;font-weight:700}';
    (d.head || d.documentElement).appendChild(s); }
  function show(el) { css(); if (!bub) { bub = d.createElement('div'); bub.className = 'ptip-b'; bub.setAttribute('role', 'tooltip'); d.body.appendChild(bub); }
    cur = el; fill(bub, el.getAttribute('data-ptip') || ''); bub.style.display = 'block'; bub.style.left = '0px'; bub.style.top = '0px';
    var r = el.getBoundingClientRect(), bw = bub.offsetWidth, bh = bub.offsetHeight, vw = d.documentElement.clientWidth;
    var x = Math.max(4, Math.min(vw - bw - 4, r.left + r.width / 2 - bw / 2)), y = r.top - bh - 6; if (y < 4) y = r.bottom + 6;
    bub.style.left = x + 'px'; bub.style.top = y + 'px'; }
  /* text -> bubble: plain text nodes, carried values (⟦30⟧) as a coloured (30). Never innerHTML, so pet names stay text. */
  function fill(b, t) { b.textContent = ''; var parts = String(t).split(/⟦(\d+)⟧/);
    for (var i = 0; i < parts.length; i++) { if (i % 2 === 0) { if (parts[i]) b.appendChild(d.createTextNode(parts[i])); continue; }
      var sp = d.createElement('span'); sp.className = 'ptip-c'; sp.textContent = '(' + parts[i] + ')'; b.appendChild(sp); } }
  function hide() { if (bub) bub.style.display = 'none'; cur = null; }
  var touch = false;
  d.addEventListener('touchstart', function () { touch = true; }, { passive: true, capture: true });
  d.addEventListener('mouseover', function (e) { if (touch) return; var t = e.target.closest && e.target.closest('[data-ptip]'); if (t) show(t); else if (cur) hide(); });
  d.addEventListener('focusin', function (e) { if (touch) return; var t = e.target.closest && e.target.closest('[data-ptip]'); if (t) show(t); });
  d.addEventListener('focusout', function () { if (!touch) hide(); });
  /* tap to show (capture, so a tap on the chip inside a card shows the numbers instead of opening the card) */
  d.addEventListener('click', function (e) { var t = e.target.closest && e.target.closest('[data-ptip]');
    if (t && touch) { e.preventDefault(); e.stopPropagation(); if (cur === t) hide(); else show(t); return; }
    if (!t && cur && touch) hide(); }, true);
  window.addEventListener('scroll', function () { if (cur && touch) hide(); }, { passive: true });
})();
