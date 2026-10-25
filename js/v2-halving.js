/* XCPETS halving UI (halving-v1, owner approved Oct 22 2026; design/halving-schedule.md). DISPLAY ONLY: reads V2Rules.halvingInfo / costsAt from the
 * replayed world; burns are still built by the game's own confirm flow (V2Rules.planAmount) and signed in the player's wallet. Nothing shows until
 * STAR LORD KEK defeats Lord Kek on chain (w.kekMythic). ?preview=halving shows the halving ribbon, ?preview=halving-soon the countdown (fake state,
 * prices untouched). Copy rule: never price or trading talk, only 'burns cost half'. */
(function () {
  'use strict';
  var V = window.V2Rules, M = window.V2Mock; if (!V || !V.halvingInfo || !M) return;
  var pv = /[?&]preview=halving(-soon)?\b/.exec(location.search);
  function fmt(n) { return Number(n).toLocaleString('en-US', { maximumFractionDigits: 8 }); }
  function info() { var w = M.world && M.world(); if (!w) return null; var S = M.state(), tip = S.tip || w.tip || 0, h = V.halvingInfo(w, tip);
    if (pv) { h = Object.assign({}, h, pv[1] ? { era: 0, next: tip + 4, defeat: { block: tip - 2 } } : { era: 1, next: null, defeat: { block: tip - 30 } }); }
    h.tip = tip; return h; }
  function ribbon(h) { var el = document.getElementById('halvingRibbon');
    var show = h && h.defeat && (h.era > 0 || h.next); if (!show) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'halvingRibbon'; el.className = 'halving-ribbon'; el.setAttribute('role', 'status');
      var host = document.querySelector('main') || document.body, nav = document.querySelector('nav, .nav, header'); if (nav && nav.parentNode) nav.parentNode.insertBefore(el, nav.nextSibling); else host.insertBefore(el, host.firstChild); }
    var left = h.next ? Math.max(0, h.next - h.tip) : 0;
    el.innerHTML = h.era > 0
      ? '<b>👑 The halving</b> <span>STAR LORD KEK defeated Lord Kek. Every burn costs half' + (h.era > 1 ? ' again' : '') + '.</span> <a href="archive.html">Lord Kek&rsquo;s farewell</a>'
      : '<b>⚔️ Lord Kek has been defeated</b> <span>From block ' + fmt(h.next) + ' (' + left + ' block' + (left === 1 ? '' : 's') + ' away) every burn costs half.</span> <a href="archive.html">Lord Kek&rsquo;s farewell</a>'; }
  function labels() { if (!V.COSTS || !V.COSTS.era) return; var C = V.COSTS, set = function (id, t) { var b = document.getElementById(id); if (b && b.textContent !== t) b.textContent = t; };
    set('hatchBtn', 'Crack One Open (' + fmt(C.hatch) + ')'); set('dozenBtn', 'Crack Pack · 12 eggs (' + fmt(C.hatch12) + ')'); set('caseBtn', 'Yolk Booster Box · 144 eggs (' + fmt(C.hatch144) + ')');
    if (C.hatchzap != null) { var zt = document.querySelector('#zapBtn .zap-t'), zs = '⚡ Electric Shock Box · 1,000 eggs (' + fmt(C.hatchzap) + ')'; if (zt && zt.textContent !== zs) zt.textContent = zs; } set('bGo', '🛎️ Check in · ' + fmt(C.breed));
    /* community feed choices halve too (owner Oct 22 2026): relabel the 69 / 690 / 6,900 buttons and keep the chosen amount in step */
    var q = C.cquick || [], bs = document.querySelectorAll('[data-camt]'), ca = document.getElementById('cAmt'), on = null;
    [].forEach.call(bs, function (b, i) { if (!b.dataset.cbase) b.dataset.cbase = b.dataset.camt; var j = [69, 690, 6900].indexOf(+b.dataset.cbase); if (j < 0 || q[j] == null) return; var v = String(q[j]); if (b.dataset.camt !== v) { b.dataset.camt = v; b.textContent = fmt(q[j]); } if (b.classList.contains('on')) on = v; });
    if (ca && on != null && ca.value !== on) ca.value = on; var cf = document.getElementById('cfeedBtn'); if (cf && ca && /\(/.test(cf.textContent)) set('cfeedBtn', 'Feed community (' + fmt(ca.value) + ')');
    var cr = document.getElementById('crollBtn'); if (cr && /\(/.test(cr.textContent)) set('crollBtn', 'Community gear roll (' + fmt(C.croll) + ')'); }
  function tick() { if (document.getElementById('v2boot') || !(M.state().rows || []).length) return; /* wait for the page's own boot; never trigger a replay */ try { var h = info(); ribbon(h); labels(); } catch (e) { } }
  function start() { tick(); setInterval(tick, 3000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
