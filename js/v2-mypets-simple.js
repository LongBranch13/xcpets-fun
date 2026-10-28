/* mypets-simple (Oct 27 2026) -> mypets-checkbox (owner Oct 28 2026 10:21 AM CT: "No stars bring back check box"). FRONT END ONLY, no rule change.
 * My Pets has ONE mark again: the ☑ checkbox on each card (S.sel, saved with the page state). Stars are gone (js/v2.js keeps no-op stubs).
 * Tick a box, shift-click a second box to tick the whole range, or use Select all / Select none / Select mode. Bulk actions on the checked pets:
 *   🍖 Feed selected: the hungry, alive, checked, not discarded pets you own, as explicit pet-number burns (pet:feed / pet:fm / pet:fl).
 *      Never feed all, never a skip list (feed all fed dead pets: blocks 973486 + 973489). The cost and burn count show on the button first.
 *   🗑️ Discard selected: the same free local Discard as before (confirm first, hidden in this browser, Undo toast, restorable from the Discard pile).
 * Feed all hungry is unchanged. This file keeps the mypets-top layout: #bFeedKept is the big main button (same id, so the same CSS), and the
 * Discard selected button (js/v2-petdiscard.js) moves next to Feed all hungry where Discard… was. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function D() { return window.__demo; }
  function fmt(n) { return Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
  /** selHungry(): the checked pets for Feed selected (mine() already leaves out discarded pets; hidden list checked again below) */
  function selHungry() { var d = D(), w = d && d.world && d.world(); if (!w || !d.mine) return { w: w, sel: [], hungry: [] };
    var s = new Set((d.S().sel || []).map(Number)), h = new Set(d.hiddenIds ? d.hiddenIds() : []);
    var sel = d.mine(w).filter(function (p) { return s.has(p.id) && !p.dead && !p.released && !h.has(p.id); });
    return { w: w, sel: sel, hungry: sel.filter(function (p) { return p.hungry; }) }; }
  function label() { var b = $('bFeedKept'); if (!b || !D() || !D().world) return;
    var r = selHungry(), q = r.hungry.length && D().feedQueueList ? D().feedQueueList(r.w, r.hungry.map(function (p) { return p.id; })) : [], sum = q.reduce(function (t, x) { return t + (x.amount || 0); }, 0);
    b.innerHTML = '🍖 Feed selected <span class="cost">(' + (r.hungry.length ? fmt(r.hungry.length) + ' hungry of ' + fmt(r.sel.length) + ' selected · ' + fmt(sum) + ' XCPETS · ' + fmt(q.length) + ' burn' + (q.length === 1 ? '' : 's') : r.sel.length ? 'all ' + fmt(r.sel.length) + ' selected pets fed' : 'tick pets to feed them') + ')</span>';
    b.disabled = !r.hungry.length; }
  /* the Discard selected button is made by js/v2-petdiscard.js; it takes the place of the old Discard… button */
  function placeDisc() { var ds = $('bDiscSel'), a = $('bDiscAsk'), fh = $('bFeedHungry'); if (!ds || !fh || ds.__mpc) return !!(ds && ds.__mpc);
    ds.__mpc = true; fh.parentNode.insertBefore(ds, fh); if (a) { a.hidden = true; a.setAttribute('aria-hidden', 'true'); } return true; }
  function init() { var d = D(), b = $('bFeedKept'); if (!d || !b || b.__mps) return; b.__mps = true;
    b.title = 'Feeds your hungry checked pets, one pet number per burn list. Never feed all.';
    b.onclick = function () { var r = selHungry(); if (!r.hungry.length) return; d.feedIds('Feed selected pets (' + r.hungry.length + ')', r.hungry.map(function (p) { return p.id; })); };
    var a = $('bDiscAsk'); if (a) { a.hidden = true; a.setAttribute('aria-hidden', 'true'); }
    var n = 0; (function pd() { if (!placeDisc() && n++ < 100) setTimeout(pd, 100); })();
    var t = null, soon = function () { clearTimeout(t); t = setTimeout(label, 60); };
    var sc = $('selCount'); if (sc && window.MutationObserver) new MutationObserver(soon).observe(sc, { childList: true, characterData: true, subtree: true });
    document.addEventListener('xcpets-sel', soon);
    label(); }
  window.V2MyPetsSimple = { init: init, label: label, selHungry: selHungry };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.addEventListener('load', init);
})();
