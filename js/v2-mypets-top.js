/* mypets-top (owner playtest note 4, Oct 27 2026: "five different spots" to sort; "he just wants to sort his pets and feed them"). LAYOUT ONLY:
 * no burn, no rule change, same classes / fonts / pixel style. Everything above the pet cards in My Pets becomes:
 *   1. one status line (#mptStat): pets, ☑ selected, hungry, neglected + when the first one dies (text, not a second sort button)
 *   2. the main action: 🍖 Feed selected (big), then the small secondary Discard selected and Feed all hungry, then Select all / Select none / Select mode
 *      (mypets-checkbox, Oct 28 2026: checkboxes back, stars gone)
 *   3. one tools row: 🔎 Find (search words also cover rarity, species, origin, selected, hungry, unfed) + ↕️ Sort (one menu) + one view toggle
 * Dropped from view (elements stay in the page, hidden, so older scripts that look them up keep working): the single My Pets tab, the red
 * 🪦 N tab and the "see most urgent ▸" line (both only set Sort = Most urgent), 💎 Show, ⚙️ More filters (🔼 reverse, Rarity,
 * Origin, Species), ▲ Hide pets, the two-button Grid / One at a time pair. A filter saved by an older build is turned into search words once,
 * so nothing stays filtered by a control the player can no longer see. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); }, d = document, BPD = 144;
  function fmt(n) { return Number(n || 0).toLocaleString('en-US'); }
  function U() { return window.V2UI; }
  function css() { if ($('mptCss')) return; var s = d.createElement('style'); s.id = 'mptCss';
    s.textContent =
      '#petsPanel #ipUrg,#petsPanel #ipNba,#petsPanel #mpsTog,#petsPanel #gridToggle,#petsPanel #bDiscUnfed{display:none!important}' +
      '#petsPanel .petsticky{display:flex;flex-direction:column}#petsPanel #bulkRow{order:-1;margin-bottom:6px}' +
      '#petsPanel #bulkRow #bFeedKept{font-size:14px;padding:9px 16px;min-height:44px}' +
      '#petsPanel .mpt-alt{display:inline-flex;flex-wrap:wrap;gap:8px}#petsPanel .mpt-hint{flex-basis:100%}' +
      '#petsPanel .mpt-stat{margin:4px 0 8px}#petsPanel .mpt-stat .warn{white-space:nowrap}' +
      '#petsPanel .ctlrow .mpt-view{white-space:nowrap}#petsPanel #fShowingSlot:empty{display:none}' +
      '#petsPanel .pettabs{display:none!important}#petsPanel #bulkRow #bFeedKept{font-size:15px;padding:10px 20px}' +
      '@media (max-width:640px){#petsPanel #bulkRow #bFeedKept{flex:1 1 0;min-width:0}#petsPanel .mpt-alt{flex:1 1 100%}#petsPanel .mpt-alt .q{flex:1 1 0;min-width:0}' +
      '#petsPanel .ctlrow .psort{flex:1 1 0;min-width:0;display:flex}#petsPanel .ctlrow .psort select{flex:1 1 0;min-width:0;width:100%}#petsPanel .ctlrow .mpt-view{flex:0 0 auto}#petsPanel #fShowingSlot{flex-basis:100%}}';
    d.head.appendChild(s); }
  function left(blocks) { var m = blocks * 10, dd = Math.floor(m / 1440), h = Math.round((m % 1440) / 60); return dd ? dd + 'd ' + h + 'h' : h + 'h'; }
  function stat() { var el = $('mptStat'), u = U(); if (!el || !u || !u.world) return; var me = u.ME; try { me = me || localStorage.getItem('xcpets-v2-me'); } catch (e) { }
    var w = u.world(); if (!w || !me) { el.textContent = ''; return; } var L = w.pets.filter(function (p) { return p.owner === me && !p.dead && !p.released && !p.community; });
    var k = new Set(((u.S && u.S().sel) || []).map(Number)), kept = L.filter(function (p) { return k.has(p.id); }).length, hungry = L.filter(function (p) { return p.hungry; }).length;
    var urg = L.filter(function (p) { return p.neglected && !p.mythicCare && p.deathBlock != null && p.deathBlock > w.tip; });
    var h = '<b>' + fmt(L.length) + '</b> pet' + (L.length === 1 ? '' : 's') + ' · ☑ <b>' + fmt(kept) + '</b> selected · 🍽️ <b>' + fmt(hungry) + '</b> hungry';
    if (urg.length) h += ' · <span class="warn">🪦 ' + fmt(urg.length) + ' neglected, first dies in ~' + left(Math.min.apply(null, urg.map(function (p) { return p.deathBlock - w.tip; }))) + '</span>';
    if (el.innerHTML !== h) el.innerHTML = h; }
  function view() { var b = $('mptView'); if (!b) return; var one = d.body.classList.contains('mps-one'); b.textContent = one ? '▦ Grid' : '🃏 One at a time'; b.setAttribute('aria-pressed', String(one)); b.title = one ? 'Show all your pets as a grid' : 'Show one big pet at a time (swipe)'; }
  /* one time per page load: an older build's hidden filters become search words, then the hidden controls go back to "all" */
  function migrate() { var q = $('fSearch'), words = [], ch = false; if (!q) return;
    function reset(id, v) { var e = $(id); if (e && e.value !== v) { var o = e.value; e.value = v; ch = true; return o; } return null; }
    var t = reset('fTier', 'all'); if (t) words.push(t);
    var o = reset('fOrigin', 'all'); if (o) words.push(o);
    var sp = reset('fSpecies', 'all'); if (sp) words.push(sp);
    var mn = reset('fMin', '0'); if (mn === '3') words.push('legendary');
    var st = $('fStarred'); if (st && st.getAttribute('aria-pressed') === 'true') { st.click(); words.push('starred'); } /* favorite-star-restore: the hidden Starred filter becomes the search word */
    var dir = $('fDir'), s = $('fSort'); if (dir && s && (s.value === 'num' ? dir.textContent.trim() === '🔽' : dir.title === 'Reversed')) dir.click();
    try { if (localStorage.getItem('xcpets-v2-grid-hidden') === '1') { var g = $('gridToggle'); if (g) g.click(); else { localStorage.setItem('xcpets-v2-grid-hidden', '0'); var P = $('pets'); if (P) P.style.display = ''; d.body.classList.remove('pets-collapsed'); } } } catch (e) { }
    if (words.length) { var cur = q.value.trim(); q.value = (cur ? cur + ' ' : '') + words.filter(function (x) { return (' ' + cur + ' ').indexOf(' ' + x + ' ') < 0; }).join(' '); }
    if (ch || words.length) { var e2 = $('fSort'); if (e2) e2.dispatchEvent(new Event('change', { bubbles: true })); } }
  var done = false;
  function init() { if (done) return; var u = U(), b = $('bulkRow'), v = $('mptView'); if (!u || !u.world || !b || !v || !$('fSort')) return; done = true; css();
    v.onclick = function () { var one = d.body.classList.contains('mps-one'), t = $(one ? 'mpsGrid' : 'mpsOne'); if (t) t.click(); setTimeout(view, 0); };
    var fs = $('fShowing'), slot = $('fShowingSlot'); if (fs && slot) slot.appendChild(fs);
    var mt = 0; (function wm() { var f = $('fSort'); if (f && f.onchange) setTimeout(migrate, 50); else if (mt++ < 100) setTimeout(wm, 100); })();
    var tm = null; function soon() { clearTimeout(tm); tm = setTimeout(function () { stat(); view(); }, 80); }
    var P = $('pets'); if (P && window.MutationObserver) new MutationObserver(soon).observe(P, { childList: true });
    d.addEventListener('xcpets-sel', soon); /* mypets-checkbox: the checked count changed */
    new MutationObserver(view).observe(d.body, { attributes: true, attributeFilter: ['class'] });
    setInterval(stat, 60000); soon(); }
  window.V2MyPetsTop = { init: init, stat: stat, migrate: migrate };
  var tries = 0; (function poll() { init(); if (!done && tries++ < 600) setTimeout(poll, 200); })();
})();
