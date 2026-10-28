/* My Pets bulk discard (wizard-story-short P4, owner 2026-10-21; replaces '🗑️ Delete Commons' / '🗑️ Delete Uncommons').
 * '🗑️ Discard unfed': every pet of mine that was NEVER fed (no meal ever: lastFed null and no fed day), however it arrived (hatched, bred, granted).
 * Dead, released, already-discarded (mine() hides them) and community pets are left out (mypets-checkbox: no star skip any more).
 * Confirm lists the pets (number + thumbnail) first, then runs the SAME free local Discard (hidden in this browser, Undo toast, restorable from
 * Show discarded). No burn, nothing signed, so the wasted-burn guard has nothing to drop. 'Discard selected' is unchanged.
 * P5: '▲ Hide pets' / '▼ Show pets' collapses the whole My Pets grid (localStorage xcpets-v2-grid-hidden); hidden cards never reach the lazy
 * sprite observer, so no thumbnails are drawn while collapsed. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function neverFed(p) { return p.lastFed == null && !Object.keys(p.feedDays || {}).length; }
  function unfed(D) { return D.mine(D.world()).filter(function (p) { return !p.dead && !p.released && !p.community && neverFed(p); }); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var GKEY = 'xcpets-v2-grid-hidden';
  function gridHidden() { try { return localStorage.getItem(GKEY) === '1'; } catch (e) { return false; } }
  function applyGrid(btn) { var h = gridHidden(), g = $('pets'); if (g) g.style.display = h ? 'none' : ''; document.body.classList.toggle('pets-collapsed', h);
    if (btn) { btn.textContent = h ? '▼ Show pets' : '▲ Hide pets'; btn.setAttribute('aria-expanded', String(!h)); } }
  function init() {
    var D = window.__demo, rel = $('bulkAnchor'); if (!D || !rel || $('bDiscUnfed')) return;
    var b = document.createElement('button'); b.className = 'q'; b.id = 'bDiscUnfed'; b.type = 'button'; b.textContent = '🗑️ Discard unfed';
    b.title = 'Discard every pet you have never fed. Free, only hidden in this browser, Undo anytime, no burn.'; rel.parentNode.insertBefore(b, rel.nextSibling);
    var box = document.createElement('div'); box.className = 'reveal'; box.id = 'discUnfedBox'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'duTitle');
    box.innerHTML = '<div class="box"><h2 id="duTitle" class="sec">Discard unfed</h2><div id="duBody"></div><div class="row" style="justify-content:center"><button class="btn" id="duYes">🗑️ Discard these pets</button><button class="q" id="duNo">Cancel</button></div></div>';
    document.body.appendChild(box);
    var ids = [], prevSel = null, R = window.V2Render;
    b.onclick = function () { var L = unfed(D); ids = L.map(function (p) { return p.id; }); if (!ids.length) return toast('No never-fed pets to discard.');
      var S = D.S(); prevSel = S.sel.slice(); S.sel = ids.slice(); D.selUi();
      $('duBody').innerHTML = '<p><b>Discard ' + ids.length.toLocaleString('en-US') + ' never-fed pet' + (ids.length > 1 ? 's' : '') + '?</b></p>' +
        '<div class="du-list">' + L.map(function (p) { return '<span class="du-pet" title="' + esc(p.name) + '"><canvas width="32" height="32" data-du="' + p.id + '"></canvas>#' + p.id + '</span>'; }).join('') + '</div>' +
        '<p class="small"><b>Free, only hidden in this browser, Undo anytime, no burn.</b> They stay on chain; restore them from the <i>🗑️ Discard pile</i> at the bottom of My Pets.' + '</p>';
      box.classList.add('on'); var w = D.world();
      if (R) box.querySelectorAll('[data-du]').forEach(function (c) { var p = w.byId[c.getAttribute('data-du')]; if (p) R.lazy(c, function () { return R.petFrames(p, w); }, true); }); };
    $('duNo').onclick = function () { box.classList.remove('on'); if (prevSel) { D.S().sel = prevSel; prevSel = null; D.selUi(); } };
    $('duYes').onclick = function () { box.classList.remove('on'); prevSel = null; var now = unfed(D).map(function (p) { return p.id; }).filter(function (id) { return ids.indexOf(id) >= 0; }); if (!now.length) return toast('No never-fed pets to discard.'); D.discardIds(now); };
    /* P5: collapse the whole grid */
    var ctl = $('ctlRow');
    if (ctl && !$('gridToggle')) { var g = document.createElement('button'); g.type = 'button'; g.className = 'q gridtoggle'; g.id = 'gridToggle'; g.setAttribute('aria-controls', 'pets');
      ctl.insertBefore(g, ctl.firstChild.nextSibling); g.onclick = function () { var h = !gridHidden(); try { localStorage.setItem(GKEY, h ? '1' : '0'); } catch (e) { } applyGrid(g); if (!h && D.render) D.render(); };
      applyGrid(g); }
  }
  function toast(t) { var c = $('toasts'); if (!c) return; var d = document.createElement('div'); d.className = 'toast'; d.textContent = t; c.appendChild(d); setTimeout(function () { d.remove(); }, 4000); }
  var css = document.createElement('style'); css.textContent = '.du-list{display:flex;flex-wrap:wrap;gap:6px;max-height:40vh;overflow:auto;justify-content:center;margin:8px 0;padding:4px}' +
    '.du-pet{display:inline-flex;flex-direction:column;align-items:center;font-size:11px;gap:2px}.du-pet canvas{width:40px;height:40px;image-rendering:pixelated;border:2px solid #000;background:#0a0f0b}' +
    '.gridtoggle{white-space:nowrap}';
  document.head.appendChild(css);
  window.V2DelUnc = { init: init, unfed: unfed, neverFed: neverFed };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
