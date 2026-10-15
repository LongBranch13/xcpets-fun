/* '🗑️ Delete Uncommons' (2026-10-14, DEMO working build). Bulk-row button next to 'Release selected': selects every one of my Uncommon pets
 * (same S.sel selection as the checkboxes), asks for confirmation with the count, then runs the SAME free local Discard as 'Delete all Commons'
 * (hide in this browser, Undo toast, restorable; nothing is burned or signed). Release selected is different: it is a pet:rel BURN. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function uncommons(D) { return D.mine(D.world()).filter(function (p) { return p.tier === 1; }).map(function (p) { return p.id; }); }
  function init() {
    var D = window.__demo, rel = $('bRelease'); if (!D || !rel || $('bDelUnc')) return;
    var b = document.createElement('button'); b.className = 'q'; b.id = 'bDelUnc'; b.type = 'button'; b.textContent = '🗑️ Delete Uncommons'; b.title = 'Discard: free, only hidden in this browser, Undo anytime, no burn.'; rel.parentNode.insertBefore(b, rel.nextSibling);
    var box = document.createElement('div'); box.className = 'reveal'; box.id = 'delUncBox'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'duTitle');
    box.innerHTML = '<div class="box"><h2 id="duTitle" class="sec">Delete Uncommons</h2><div id="duBody"></div><div class="row" style="justify-content:center"><button class="btn" id="duYes">Hide Uncommons</button><button class="q" id="duNo">Cancel</button></div></div>';
    document.body.appendChild(box);
    var ids = [];
    b.onclick = function () { ids = uncommons(D); if (!ids.length) return toast('No Uncommons to hide.');
      var S = D.S(); S.sel = ids.slice(); D.selUi();
      $('duBody').innerHTML = '<p><b>Delete ' + ids.length + ' Uncommon pet' + (ids.length > 1 ? 's' : '') + '?</b></p><p class="small"><b>Discard: free, only hidden in this browser, Undo anytime, no burn.</b> They stay on chain; restore them from <i>Show discarded</i>.</p>';
      box.classList.add('on'); };
    $('duNo').onclick = function () { box.classList.remove('on'); };
    $('duYes').onclick = function () { box.classList.remove('on'); var now = uncommons(D).filter(function (id) { return ids.indexOf(id) >= 0; }); if (!now.length) return toast('No Uncommons to hide.'); D.discardIds(now); };
  }
  function toast(t) { var c = $('toasts'); if (!c) return; var d = document.createElement('div'); d.className = 'toast'; d.textContent = t; c.appendChild(d); setTimeout(function () { d.remove(); }, 4000); }
  window.V2DelUnc = { init: init, uncommons: uncommons };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
