/* XCPETS Lair calm + phone stash (owner approved Oct 20 2026). Display only, no rule change.
 * 1) While the Lair is in use (a tap/key inside #invPanel in the last 15 s and the panel still on screen) the incoming-request dialog, the new-egg
 *    pop-up and background toasts (fight/breed results) are QUEUED: dialogs wait hidden and show when you leave; toasts are replayed afterwards.
 *    Toasts within 1.5 s of your own tap are your action's feedback and show right away.
 * 2) Phone (<=520px): 'Your stash · all your gear' opens by default as a tap-friendly grid (once; your own close is respected). */
(function () {
  'use strict';
  var d = document, html = d.documentElement, lastLair = 0, lastAct = 0, Q = [], vis = false;
  function panel() { return d.getElementById('invPanel'); }
  function busy() { return vis && Date.now() - lastLair < 15000; }
  d.addEventListener('pointerdown', mark, true); d.addEventListener('keydown', mark, true);
  function mark(e) { lastAct = Date.now(); var p = panel(); if (p && p.contains(e.target)) lastLair = lastAct; tick(); }
  function isToast(n) { return n.nodeType === 1 && n.classList && n.classList.contains('toast'); }
  function tick() { var b = busy(); html.classList.toggle('lair-calm', b); if (!b && Q.length) flush(); }
  function flush() { var t = d.getElementById('toasts'); if (!t) return; var L = Q.splice(0, Q.length), show = L.slice(-3);
    if (L.length > 3) show.unshift('+' + (L.length - 3) + ' more updates while you were in The Rare Room');
    show.forEach(function (h, i) { var x = d.createElement('div'); x.className = 'toast'; x.innerHTML = h; x.setAttribute('data-calm', '1'); setTimeout(function () { t.appendChild(x); setTimeout(function () { x.remove(); }, 5000); }, i * 400); }); }
  function watchToasts() { var t = d.getElementById('toasts'); if (!t || t._calm) return; t._calm = 1;
    new MutationObserver(function (ms) { if (!busy()) return; ms.forEach(function (m) { m.addedNodes.forEach(function (n) { if (!isToast(n) || n.getAttribute('data-calm') || Date.now() - lastAct < 1500) return; Q.push(n.innerHTML); n.remove(); }); }); }).observe(t, { childList: true }); }
  function watchPanel() { var p = panel(); if (!p || p._calm) return; p._calm = 1;
    if (window.IntersectionObserver) new IntersectionObserver(function (es) { vis = es[0].isIntersecting; tick(); }, { threshold: 0.15 }).observe(p); else vis = true; }
  function phoneStash() { if (!(window.matchMedia && matchMedia('(max-width:520px)').matches)) return; var s = d.querySelector('details.shop-all'); if (!s || s._calm) return; s._calm = 1; s.open = true; }
  var css = 'html.lair-calm #inReqBox.on,html.lair-calm #eggPop{display:none!important}' +
    '@media (max-width:520px){.shop8 details.shop-all .baggrid{grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px}.shop8 details.shop-all .bagitem{min-height:72px;padding:8px 4px;font-size:12px}.shop8 details.shop-all .bagitem .wn{font-size:11px;opacity:.95}' +
    '.shop8 details.shop-all .slotfilter .q,.shop8 details.shop-all .invtabs .tab{min-height:40px}.lq-chip{font-size:10px!important;min-height:40px;padding:9px 10px}.shop8 details.shop-all>summary{min-height:44px;display:flex;align-items:center}}';
  var st = d.createElement('style'); st.id = 'lairCalmCss'; st.textContent = css; (d.head || html).appendChild(st);
  function boot() { watchToasts(); watchPanel(); phoneStash(); }
  boot(); setInterval(function () { boot(); tick(); }, 2000);
  window.V2LairCalm = { busy: busy, queued: function () { return Q.length; } };
})();
