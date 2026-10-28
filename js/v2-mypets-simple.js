/* mypets-simple (owner, Oct 27 2026: "one simple flow", "having stars and check boxes is redundant"). FRONT END ONLY, no rule change.
 * My Pets has ONE mark: the ★ on each card (same browser-only list as before, localStorage xcpets-keep-<network>-<address>; nothing on chain).
 * Checkboxes and Select mode are gone. Two bulk actions:
 *   🍖 Feed my kept pets: the hungry, alive, starred, not discarded pets you own, as explicit pet-number burns (pet:feed / pet:fm / pet:fl).
 *      Never feed all, never a skip list (feed all fed dead pets: blocks 973486 + 973489).
 *   🗑️ Discard…: one dialog. Pick which UNSTARRED pets (Commons / Never fed / Everything not starred), then one confirm.
 *      The same free local Discard as before (hidden in this browser, Undo toast, restorable from the Discard pile). Starred pets never go.
 * The old bulk controls stay hidden in #bulkOld so older scripts that look them up keep working. Uses only existing classes (.reveal .box .btn .q .q.on .rkctl). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function D() { return window.__demo; }
  function fmt(n) { return Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function mineAlive() { var d = D(), w = d && d.world(); if (!w || !d.mine) return { w: w, list: [] }; return { w: w, list: d.mine(w).filter(function (p) { return !p.dead && !p.released; }) }; }
  function neverFed(p) { return p.lastFed == null && !Object.keys(p.feedDays || {}).length; }
  /** keptHungry(): ids for Feed my kept pets (mine() already leaves out discarded pets; hidden list checked again below) */
  function keptHungry() { var d = D(), m = mineAlive(), k = new Set((d && d.keptIds ? d.keptIds() : []).map(Number)), h = new Set(d && d.hiddenIds ? d.hiddenIds() : []);
    var kept = m.list.filter(function (p) { return k.has(p.id) && !h.has(p.id); });
    return { w: m.w, kept: kept, hungry: kept.filter(function (p) { return p.hungry; }) }; }
  var CHOICES = [
    { k: 'common', label: 'Commons', why: 'alive Common pets you have not starred', f: function (p) { return p.tier === 0; } },
    { k: 'unfed', label: 'Never fed', why: 'alive pets that never had a meal and are not starred', f: neverFed },
    { k: 'all', label: 'Everything not starred', why: 'every alive pet you have not starred', f: function () { return true; } }];
  function discardSet(k) { var d = D(), m = mineAlive(), c = CHOICES.filter(function (x) { return x.k === k; })[0] || CHOICES[0];
    return m.list.filter(function (p) { return !(d.isKept && d.isKept(p.id)) && c.f(p); }).map(function (p) { return p.id; }); }
  function label() { var b = $('bFeedKept'), a = $('bDiscAsk'); if (!b || !D() || !D().world) return;
    var r = keptHungry(), q = r.hungry.length && D().feedQueueList ? D().feedQueueList(r.w, r.hungry.map(function (p) { return p.id; })) : [], sum = q.reduce(function (t, x) { return t + (x.amount || 0); }, 0);
    b.innerHTML = '🍖 Feed my kept pets <span class="cost">(' + (r.hungry.length ? fmt(r.hungry.length) + ' hungry of ' + fmt(r.kept.length) + ' kept · ' + fmt(sum) + ' XCPETS · ' + fmt(q.length) + ' burn' + (q.length === 1 ? '' : 's') : r.kept.length ? 'all ' + fmt(r.kept.length) + ' kept pets fed' : 'star pets to keep them') + ')</span>';
    b.disabled = !r.hungry.length;
    var pile = D().hiddenIds ? D().hiddenIds().length : 0; if (a) a.textContent = '🗑️ Discard…' + (pile ? '' : ''); }
  var pick = 'common';
  function dialog() { var box = $('discAskBox'); if (!box) { box = document.createElement('div'); box.className = 'reveal'; box.id = 'discAskBox'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'daTitle');
      box.innerHTML = '<div class="box"><h2 id="daTitle" class="sec">🗑️ Discard pets</h2><div id="daBody"></div><div class="row"><button type="button" class="btn" id="daYes"></button><button type="button" class="btn ghost" id="daNo">Cancel</button></div></div>';
      document.body.appendChild(box);
      box.addEventListener('click', function (e) { if (e.target === box) box.classList.remove('on'); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && box.classList.contains('on')) box.classList.remove('on'); });
      $('daNo').onclick = function () { box.classList.remove('on'); };
      $('daYes').onclick = function () { var ids = discardSet(pick); box.classList.remove('on'); if (ids.length) D().discardIds(ids); setTimeout(label, 0); }; }
    fill(); box.classList.add('on'); $('daYes').focus(); }
  function fill() { var d = D(), ids = discardSet(pick), c = CHOICES.filter(function (x) { return x.k === pick; })[0], kept = d.keptIds ? d.keptIds().length : 0, pile = d.hiddenIds ? d.hiddenIds().length : 0;
    $('daBody').innerHTML = '<p class="small">Which pets? Starred ★ pets are never discarded.</p><div class="row rkctl" role="radiogroup" aria-label="Which pets to discard">' +
      CHOICES.map(function (x) { var n = discardSet(x.k).length, on = x.k === pick; return '<button type="button" class="q' + (on ? ' on' : '') + '" role="radio" aria-checked="' + on + '" data-da="' + x.k + '">' + esc(x.label) + ' (' + fmt(n) + ')</button>'; }).join('') + '</div>' +
      '<p class="small">' + fmt(ids.length) + ' ' + esc(c.why) + '. Free: no burn, nothing signed, only hidden in this browser. Undo anytime from the Discard pile.' + (kept ? ' ' + fmt(kept) + ' starred pets stay.' : '') + '</p>' +
      (pile ? '<p class="small"><button type="button" class="q" id="daPile">↩️ Discard pile (' + fmt(pile) + ')</button></p>' : '');
    $('daBody').querySelectorAll('[data-da]').forEach(function (b) { b.onclick = function () { pick = b.dataset.da; fill(); }; });
    var pb = $('daPile'); if (pb) pb.onclick = function () { $('discAskBox').classList.remove('on'); d.openPile(); };
    $('daYes').textContent = ids.length ? '🗑️ Discard ' + fmt(ids.length) + ' pet' + (ids.length === 1 ? '' : 's') : 'Nothing to discard'; $('daYes').disabled = !ids.length; }
  function init() { var d = D(), b = $('bFeedKept'), a = $('bDiscAsk'); if (!d || !b || b.__mps) return; b.__mps = true;
    try { var S = d.S(); if (S.sel && S.sel.length) { S.sel = []; d.selUi(); } } catch (e) { } /* a selection saved by an older build would keep the old selection bar open */
    b.onclick = function () { var r = keptHungry(); if (!r.hungry.length) return; d.feedIds('Feed my kept pets (' + r.hungry.length + ')', r.hungry.map(function (p) { return p.id; })); };
    a.onclick = dialog;
    var sc = $('selCount'), t = null; if (sc && window.MutationObserver) new MutationObserver(function () { clearTimeout(t); t = setTimeout(label, 50); }).observe(sc, { childList: true, characterData: true, subtree: true });
    document.addEventListener('click', function (e) { if (e.target && e.target.closest && e.target.closest('.keepbtn')) setTimeout(label, 0); }, true);
    label(); }
  window.V2MyPetsSimple = { init: init, label: label, keptHungry: keptHungry, discardSet: discardSet, CHOICES: CHOICES };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.addEventListener('load', init);
})();
