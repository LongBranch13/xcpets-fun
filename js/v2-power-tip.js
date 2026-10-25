/* power-tooltip-values (Oct 25 2026, display only): Power and stat hovers show the pet's real numbers, not the formula.
 *   V2PowerTip.power(p)  -> 'Vigor 12 + Spark 9 + Grit 7 + Zoom 10 + Luck 10 = 48'   (same sum as V2Rules.petPower)
 *   V2PowerTip.stats(p)  -> 'Vigor 12 · Spark 9 · Grit 7 · Zoom 10 · Luck 10'
 *   V2PowerTip.hp(p)     -> '40 + 2 times Vigor 12 + Grit 7 + 6 times stage 3 (Adult) = 89'  (simulateFight HP)
 *   V2PowerTip.gear(list)-> 'Ruby crown 5 + Fetch Stick 3 = +8 per hit'  (each piece 1 + 2 times its tier)
 *   V2PowerTip.attr(text)-> ' data-ptip="…" aria-label="…" tabindex="0"' for any element.
 * One shared bubble: shows on mouse hover / keyboard focus, and on a tap on touch screens (tap again or tap elsewhere to close).
 * Nothing here touches rules, replay or burns. */
(function () {
  'use strict';
  var K = ['vigor', 'spark', 'grit', 'zoom', 'luck'], N = { vigor: 'Vigor', spark: 'Spark', grit: 'Grit', zoom: 'Zoom', luck: 'Luck' };
  var STG = ['Egg', 'Hatchling', 'Juvenile', 'Adult', 'Elder', 'Mythic'];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function st(p, k) { return Number(((p && p.stats) || {})[k]) || 0; }
  function total(p) { return K.reduce(function (a, k) { return a + st(p, k); }, 0); }
  function power(p) { return K.map(function (k) { return N[k] + ' ' + st(p, k); }).join(' + ') + ' = ' + total(p); }
  function stats(p) { return K.map(function (k) { return N[k] + ' ' + st(p, k); }).join(' · '); }
  function hp(p) { var s = (p && p.stage) || 0; return '40 + 2 times Vigor ' + st(p, 'vigor') + ' + Grit ' + st(p, 'grit') + ' + 6 times stage ' + s + (STG[s] ? ' (' + STG[s] + ')' : '') + ' = ' + (40 + 2 * st(p, 'vigor') + st(p, 'grit') + 6 * s); }
  /* list: [{label, tier}] -> each piece adds 1 + 2 times its tier per hit */
  function gear(list) { list = list || []; if (!list.length) return 'No gear worn: +0 per hit'; var t = 0;
    return list.map(function (g) { var v = 1 + 2 * (Number(g.tier) || 0); t += v; return g.label + ' ' + v; }).join(' + ') + ' = +' + t + ' per hit (each piece 1 + 2 times its tier)'; }
  function attr(text) { var e = esc(text); return ' data-ptip="' + e + '" aria-label="' + e + '" tabindex="0"'; }
  var api = { power: power, stats: stats, hp: hp, gear: gear, attr: attr, total: total };
  window.V2PowerTip = api;
  if (typeof document === 'undefined') return;
  var d = document, bub = null, cur = null;
  function css() { if (d.getElementById('ptipCss')) return; var s = d.createElement('style'); s.id = 'ptipCss';
    s.textContent = '[data-ptip]{cursor:help}.ptip-b{position:fixed;z-index:99999;max-width:min(320px,92vw);padding:6px 9px;background:#14122b;color:#eee;border:2px solid #ffd166;border-radius:10px;font-size:12px;line-height:1.35;pointer-events:none;box-shadow:0 6px 18px rgba(0,0,0,.5);text-align:left;white-space:normal}';
    (d.head || d.documentElement).appendChild(s); }
  function show(el) { css(); if (!bub) { bub = d.createElement('div'); bub.className = 'ptip-b'; bub.setAttribute('role', 'tooltip'); d.body.appendChild(bub); }
    cur = el; bub.textContent = el.getAttribute('data-ptip'); bub.style.display = 'block'; bub.style.left = '0px'; bub.style.top = '0px';
    var r = el.getBoundingClientRect(), bw = bub.offsetWidth, bh = bub.offsetHeight, vw = d.documentElement.clientWidth;
    var x = Math.max(4, Math.min(vw - bw - 4, r.left + r.width / 2 - bw / 2)), y = r.top - bh - 6; if (y < 4) y = r.bottom + 6;
    bub.style.left = x + 'px'; bub.style.top = y + 'px'; }
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
