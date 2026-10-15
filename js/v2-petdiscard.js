/* Per-pet discard (2026-10-14, DEMO working build). A small 🗑️ button in the bottom-right of each living pet card on play.html.
 * Click -> confirm -> the SAME free local Discard as 'Delete all Commons' (hidden in this browser, Undo toast, restorable). No burn, nothing signed.
 * One capture-phase listener on #pets (event delegation, fine for 2,000 pets); it stops propagation so the card's selection/detail never toggles.
 * Buttons are added to cards as they are rendered (chunked) by one MutationObserver on #pets. */
(function () {
  'use strict';
  var CLS = 'pet-discard', DW = 'Discard: free, only hidden in this browser, Undo anytime, no burn.', RW = 'Release: on-chain burn, permanent, you sign it in your wallet.', RC = 'pet-release', RT = 'Release: on-chain burn, permanent, signed in your wallet';
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
    if (!window.confirm('Discard pet #' + id + '?\n\n' + DW)) return;
    D.discardIds([id]);
  }
  function init() {
    var D = window.__demo, box = document.getElementById('pets'); if (!D || !box || box.__petDiscard) return; box.__petDiscard = true;
    var st = document.createElement('style');
    st.textContent = '#pets .pet.card{position:relative}#pets .' + CLS + '{position:absolute;right:4px;bottom:4px;padding:1px 4px;font-size:12px;line-height:1;min-width:0;cursor:pointer;opacity:.7;background:transparent;border:1px solid rgba(255,255,255,.25);border-radius:4px}#pets .' + CLS + ':hover,#pets .' + CLS + ':focus{opacity:1}#pets .pet.card{padding-bottom:26px}#pets .' + RC + '{position:absolute;left:4px;bottom:4px;padding:1px 6px;font-size:11px;line-height:1.3;min-width:0;cursor:pointer;background:rgba(255,90,40,.12);border:1px solid rgba(255,120,60,.55);border-radius:4px;color:inherit}';
    document.head.appendChild(st);
    var rel = document.getElementById('bRelease');  /* Release vs Discard hint (wording only; release logic untouched) */
    if (rel && !document.getElementById('relHint')) { rel.title = RW; var h = document.createElement('span'); h.id = 'relHint'; h.className = 'small muted'; h.textContent = RW; h.style.marginLeft = '6px'; rel.parentNode.insertBefore(h, rel.nextSibling); }
    box.addEventListener('click', function (e) { onClick(e, D); }, true);
    box.querySelectorAll('.pet.card[data-pid]').forEach(addBtn);
    if (window.MutationObserver) new MutationObserver(function (ms) { ms.forEach(function (m) { for (var i = 0; i < m.addedNodes.length; i++) addBtn(m.addedNodes[i]); }); }).observe(box, { childList: true });
  }
  window.V2PetDiscard = { DW: DW, RW: RW, init: init, addBtn: addBtn, onClick: onClick };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
