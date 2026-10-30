/* Per-pet discard (2026-10-14, v2). A small 🗑️ button in the bottom-right of each living pet card on play.html.
 * Click -> confirm -> the SAME free local Discard as 'Discard all Commons' (hidden in this browser, Undo toast, restorable). No burn, nothing signed.
 * One capture-phase listener on #pets (event delegation, fine for 2,000 pets); it stops propagation so the card's selection/detail never toggles.
 * Buttons are added to cards as they are rendered (chunked) by one MutationObserver on #pets. */
(function () {
  'use strict';
  var CLS = 'pet-discard', DW = 'Discard: free, only hidden in this browser, Undo anytime, no burn. Starred pets are never discarded.', RW = 'Release: on-chain burn, permanent, you sign it in your wallet.', RC = 'pet-release', RT = 'Release: on-chain burn, permanent, signed in your wallet';
  function addBtn(d) {
    if (!d || !d.classList || !d.classList.contains('card') || !d.dataset || !d.dataset.pid || d.classList.contains('dead') || d.querySelector('.' + CLS)) return;
    var b = document.createElement('button'); b.type = 'button'; b.className = CLS; b.dataset.discard = d.dataset.pid; b.title = DW;
    b.setAttribute('aria-label', 'Discard #' + d.dataset.pid); b.textContent = '🗑️'; d.appendChild(b);
    var r = document.createElement('button'); r.type = 'button'; r.className = RC; r.dataset.release = d.dataset.pid; r.title = RT; r.setAttribute('aria-label', 'Release #' + d.dataset.pid + ' (on-chain burn)'); r.textContent = '🔥 Release'; d.appendChild(r);
  }
  function onClick(e, D) {
    var t = e.target, rb = t && t.closest ? t.closest('.' + RC) : null;
    if (rb) { e.stopPropagation(); e.preventDefault(); var rid = Number(rb.dataset.release); if (!rid) return;  /* the existing single-pet release path: same plans + burn confirmation as 'Release selected' */
      D.confirmPlans('Release #' + rid + ' (on-chain burn, permanent)', window.V2Rules.releaseBatches([rid])); return; }
    var b = t && t.closest ? t.closest('.' + CLS) : null; if (!b) return;
    e.stopPropagation(); e.preventDefault();
    var id = Number(b.dataset.discard); if (!id) return;
    if (D.isKept && D.isKept(id)) { D.discardIds([id]); return; } /* starred: discardIds skips it and says why (never discarded) */
    if (!window.confirm('Discard pet #' + id + '?\n\nIt moves to the Discard pile at the bottom of My Pets.\n' + DW)) return;
    D.discardIds([id]);
  }
  function init() {
    var D = window.__demo, box = document.getElementById('pets'); if (!D || !box || box.__petDiscard) return; box.__petDiscard = true;
    var st = document.createElement('style');
    st.textContent = '#pets .pet.card{position:relative}#pets .' + CLS + '{position:absolute;right:4px;bottom:4px;padding:1px 4px;font-size:12px;line-height:1;min-width:0;cursor:pointer;opacity:.7;background:transparent;border:1px solid rgba(255,255,255,.25);border-radius:4px}#pets .' + CLS + ':hover,#pets .' + CLS + ':focus{opacity:1}#pets .pet.card{padding-bottom:26px}#pets .' + RC + '{position:absolute;left:4px;bottom:4px;padding:1px 6px;font-size:11px;line-height:1.3;min-width:0;cursor:pointer;background:rgba(255,90,40,.12);border:1px solid rgba(255,120,60,.55);border-radius:4px;color:inherit}';
    document.head.appendChild(st);
    var rel = document.getElementById('bulkAnchor');  /* anchor for the bulk Discard buttons (Release is still a game action: owner decision 2026-10-19, the per-pet Release button stays; pet:rel replay untouched) */
    /* '🗑️ Discard selected' (bulk): confirm with the count -> the same free local discard (Undo toast) -> selection cleared. Disabled with 0 selected. */
    if (rel && !document.getElementById('bDiscSel')) { var ds = document.createElement('button'); ds.type = 'button'; ds.className = 'q'; ds.id = 'bDiscSel'; ds.textContent = '🗑️ Discard selected'; ds.title = DW;
      var hn = document.getElementById('relHint'); rel.parentNode.insertBefore(ds, (hn || rel).nextSibling);
      var upd = function () { var n = D.S().sel.length; ds.disabled = !n; ds.textContent = '🗑️ Discard selected' + (n ? ' (' + n + ')' : ''); };
      ds.onclick = function () { var ids = D.S().sel.slice(); if (!ids.length) return; var n = ids.length;
        var kk = D.isKept ? ids.filter(D.isKept) : [], go = n - kk.length; if (!go) { D.discardIds(ids); return; } /* favorite-star-restore: starred pets skipped (as before 8ef7007) */
        if (!window.confirm('Discard ' + go + ' selected pet' + (go > 1 ? 's' : '') + '? (' + D.idList(ids.filter(function (id) { return kk.indexOf(id) < 0; })) + ')' + (kk.length ? '\n\n' + kk.length + ' starred pet' + (kk.length > 1 ? 's are' : ' is') + ' skipped (' + D.idList(kk) + '): starred pets are never discarded.' : '') + '\n\nThey move to the Discard pile at the bottom of My Pets. Free, only hidden in this browser, Undo anytime, no burn.')) return;
        D.discardIds(ids); var S = D.S(); S.sel = []; D.selUi(); upd(); };
      var sc = document.getElementById('selCount'); if (sc && window.MutationObserver) new MutationObserver(upd).observe(sc, { childList: true, characterData: true, subtree: true }); upd();
      window.V2PetDiscard && (window.V2PetDiscard.updDiscSel = upd); }
    box.addEventListener('click', function (e) { onClick(e, D); }, true);
    box.querySelectorAll('.pet.card[data-pid]').forEach(addBtn);
    if (window.MutationObserver) new MutationObserver(function (ms) { ms.forEach(function (m) { for (var i = 0; i < m.addedNodes.length; i++) addBtn(m.addedNodes[i]); }); }).observe(box, { childList: true });
  }
  window.V2PetDiscard = { DW: DW, RW: RW, init: init, addBtn: addBtn, onClick: onClick };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
