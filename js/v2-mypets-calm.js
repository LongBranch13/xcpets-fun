/* mypets-calm (owner Nov 23 2026: "I want my pets to be easier to look at and sort. there is too much going on here"). LAYOUT ONLY:
 * no burn, no rule change, no new state. Every control stays in the page with the same id and the same handler; this file only moves
 * and restyles them so the pets are the first thing you see:
 *   1. one header line: pets · hungry, with 🧹 Daily chores (full size, with its WAGMI + feed + spins note) on the right; the WAGMI streak bar stays above it
 *   2. one toolbar: 🔎 Find + ↕️ Sort + 🃏 view + ⚙️ More + ☑️ Select, then the rarity pills with "N of N pets match" on the right
 *   3. ⚙️ More opens a drawer: Show (species, token, Never fed only, zombie filters) and Care (Feed all hungry,
 *      Discard pile, next feed cycle) and a link to Flex Forge in The Rare Room
 *   4. the ☑ checkboxes on the cards and the Feed selected / Discard selected / Select all / Select none / Gear in The Rare Room buttons only show while you
 *      select (☑️ Select on, or any pet ticked); they ride in one bar pinned to the bottom of the screen (the older in-list selection bar #selBar is hidden: same buttons)
 * Elements made later by other scripts (Daily chores row, species button, Discard pile button, Never fed row) are adopted when they appear. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); }, d = document;
  var NF = new Intl.NumberFormat('en-US');
  function fmt(n) { return NF.format(Number(n) || 0); }
  function U() { return window.V2UI; }
  function css() { if ($('mpcCss')) return; var s = d.createElement('style'); s.id = 'mpcCss';
    s.textContent =
      /* header: badges and the WAGMI streak get smaller, the stat line and Daily chores share one row */
      '#petsPanel #myBadges{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:0 0 6px}#petsPanel #myBadges .bdg-head{font-size:11px}#petsPanel #myBadges .bdg-row{display:flex;gap:4px;margin:0}' +
      '#petsPanel #myBadges .bdg{width:30px;height:30px;padding:0;min-height:0}#petsPanel #myBadges .bdg img{width:26px;height:26px}' +
      '#petsPanel #streakBar{padding:6px 10px!important;margin:0 0 6px!important;flex-wrap:nowrap}#petsPanel #streakBar .sk-joke{display:none}#petsPanel #streakBar .sk-msg{flex:1 1 auto;min-width:0}#petsPanel #streakBar .sk-btn{flex:0 0 auto;width:auto;padding:4px 12px;min-height:36px;font-size:13px}#petsPanel #streakBar .sk-btn .cost{display:none}' +
      '#petsPanel .mpc-head{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;margin:2px 0 8px}#petsPanel .mpc-head .mpt-stat{margin:0!important;flex:1 1 auto;font-size:13px}' +
      '#petsPanel .mpc-head .mpt-stat br,#petsPanel .mpc-head .mpt-stat .mpt-next{display:none}#petsPanel .mpc-head #dcRow{margin:0!important;padding:0!important;flex:0 0 auto;justify-content:flex-end}' +
      /* owner Nov 23 2026: "I dont want to lose wagmi and daily chores": Daily chores keeps its full size and its one-line "WAGMI + feed + spins in one burn" note */
      '#petsPanel .mpc-head #dcRow{display:flex;align-items:center;gap:4px 10px;flex-wrap:wrap}#petsPanel .mpc-head #dcRow .dc-note{display:inline;font-size:12px;max-width:340px}' +
      /* toolbar */
      '#petsPanel .petsticky{background:transparent}#petsPanel #ctlRow{display:flex;flex-wrap:nowrap;align-items:center;gap:8px;margin:0}' +
      '#petsPanel #ctlRow .mpt-view{flex:0 0 auto;min-height:40px}#petsPanel #ctlRow .psearch{flex:1 1 auto;min-width:0;display:flex;align-items:center;gap:4px}#petsPanel #ctlRow .psearch input{flex:1;min-width:0;width:100%;min-height:40px;font-size:15px}' +
      '#petsPanel #ctlRow .psort{flex:0 0 auto;display:flex;align-items:center;gap:4px}#petsPanel #ctlRow .mpc-tb{flex:0 0 auto;min-height:40px;white-space:nowrap;position:relative}' +
      '#petsPanel #ctlRow .mpc-tb[aria-pressed=true],#petsPanel #ctlRow .mpc-tb[aria-expanded=true]{background:#2a3a2e;color:#fff;border-color:var(--acc2,#3ddc84)}' +
      '#petsPanel #ctlRow .mpc-dot{position:absolute;top:-5px;right:-5px;min-width:16px;height:16px;border-radius:8px;background:#ffd166;color:#140f24;font-size:10px;line-height:16px;text-align:center;padding:0 3px;border:1px solid #000}' +
      '#petsPanel .mpc-rar{display:flex;align-items:center;gap:8px;margin:8px 0 4px}#petsPanel .mpc-rar #fRarRow{flex:1 1 auto;margin:0!important}#petsPanel .mpc-rar #fShowingSlot{flex:0 0 auto;white-space:nowrap;font-size:12px}' +
      /* the More drawer */
      '#mpcMore{border:2px solid #2c4a26;border-radius:8px;background:#0d140f;padding:10px 12px;margin:6px 0 8px;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px 18px}#mpcMore[hidden]{display:none}' +
      '#mpcMore h4{margin:0 0 6px;font-family:"Press Start 2P",monospace;font-size:10px;color:#9be08a;letter-spacing:.5px}#mpcMore .mpc-sec{display:flex;flex-wrap:wrap;gap:8px;align-items:center;align-content:flex-start}' +
      '#mpcMore .mpc-sec>*{margin:0!important}#mpcMore .psp,#mpcMore .ptok{display:inline-flex;align-items:center;gap:4px}#mpcMore .mpc-next{font-size:12px;color:#ffd166;flex-basis:100%}#mpcMore .mpc-next:empty{display:none}' +
      '#mpcMore #nfProxy[aria-pressed=true],#mpcMore #zbProxy[aria-pressed=true]{border-color:#9be08a;box-shadow:0 0 0 2px #2c4a26 inset}#mpcMore a.q{text-decoration:none}' +
      /* filters that live in the pet list show only while they are on (or opened from More) */
      '#petsPanel #pets #nfGroup:not(:has(#nfOnly[aria-pressed=true])){display:none!important}#petsPanel #pets #nfGroup .muted{display:none}' +
      'body:not(.mpc-zb) #petsPanel #pets .zbfilter:not(:has(.zbf-btn.on)){display:none!important}' +
      /* select: checkboxes only while selecting; the actions ride in a bar pinned to the bottom */
      'body:not(.selmode):not(.mpc-sel) #petsPanel .pet.card .pick-cb{display:none}' +
      '#petsPanel #bulkRow{display:none!important}#petsPanel #selBar{display:none!important}#petsPanel #bulkRow #selLair{white-space:nowrap}' +
      'body.mpc-inview.selmode #petsPanel #bulkRow,body.mpc-inview.mpc-sel #petsPanel #bulkRow{display:flex!important;position:fixed;left:50%;transform:translateX(-50%);bottom:10px;z-index:900;width:min(980px,calc(100% - 16px));box-sizing:border-box;' +
        'flex-wrap:wrap;align-items:center;gap:8px;margin:0!important;padding:8px 10px;background:#101a12;border:3px solid #3ddc84;border-radius:10px;box-shadow:4px 4px 0 #000,0 0 0 2px #000}' +
      'body.selmode #petsPanel,body.mpc-sel #petsPanel{padding-bottom:96px}' +
      /* playtest (Nov 25 2026): the wallet pill (bottom-left, z-index 9000) sat on top of this bar and covered Discard selected; it steps aside while you select */
      'body.mpc-inview.selmode #xwPill,body.mpc-inview.mpc-sel #xwPill{display:none!important}' +
      '#petsPanel #bulkRow .ip-why,#petsPanel #bulkRow #keepHint,#petsPanel #bulkRow .grow,#petsPanel #bulkRow #bDiscUnfed{display:none!important}' +
      '#petsPanel #bulkRow .mpc-count{font-weight:bold;white-space:nowrap;order:-2}#petsPanel #bulkRow .mpc-count small{display:block;font-weight:normal;color:#9be08a;font-size:11px}' +
      '#petsPanel #bulkRow #bulkOld{display:inline-flex;flex-wrap:wrap;gap:6px;align-items:center;order:-1}#petsPanel #bulkRow #selCount,#petsPanel #bulkRow #selMode{display:none}' +
      '#petsPanel #bulkRow #mpcDone{order:0}#petsPanel #bulkRow #bFeedKept{order:1;font-size:14px!important;padding:8px 14px!important;min-height:42px;margin-left:auto}#petsPanel #bulkRow .mpt-alt{order:2}#petsPanel #bulkRow #selLair{order:3}#petsPanel #bulkRow #bFeedKept .cost{display:block;font-size:11px}' +
      '#petsPanel #bulkRow .mpt-alt{display:inline-flex;gap:6px;order:2}#petsPanel #bulkRow #bFeedHungry,#petsPanel #bulkRow #bDiscAsk{display:none!important}' +
      '@media (max-width:640px){#petsPanel .mpc-head #dcRow{flex:1 1 100%}#petsPanel .mpc-head #dcRow .dc-note{flex:1 1 140px}#petsPanel #ctlRow{flex-wrap:wrap}#petsPanel #ctlRow .psearch{flex:1 1 100%}#petsPanel #ctlRow .psort{flex:1 1 0;min-width:0}#petsPanel #ctlRow .psort xc-select{flex:1;min-width:0}' +
        '#petsPanel #ctlRow .psort{font-size:0}#petsPanel #ctlRow .psort xc-select{font-size:14px}#petsPanel #ctlRow .mpc-tb,#petsPanel #ctlRow .mpt-view{padding-left:8px;padding-right:8px;font-size:13px}#petsPanel .mpc-rar{flex-wrap:wrap}#petsPanel .mpc-rar #fRarRow{flex:1 1 100%;flex-wrap:nowrap;overflow-x:auto}#petsPanel .mpc-rar #fShowingSlot{display:none}' +
        'body.mpc-inview.selmode #petsPanel #bulkRow,body.mpc-inview.mpc-sel #petsPanel #bulkRow{bottom:0;width:100%;border-radius:10px 10px 0 0;border-width:3px 0 0;padding:8px 10px calc(8px + env(safe-area-inset-bottom))}' +
        '#petsPanel #bulkRow #bFeedKept{flex:1 1 100%;order:3}#petsPanel #bulkRow .mpt-alt{order:2}#petsPanel #bulkRow .selall{font-size:13px}}';
    d.head.appendChild(s); }
  function el(tag, attrs, html) { var e = d.createElement(tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; }
  function selN() { var u = U(); try { return ((u && u.S && u.S().sel) || []).length; } catch (e) { return 0; } }
  var B = {}; /* the pieces this file makes */
  function build() { var P = $('petsPanel'), ctl = $('ctlRow'), bulk = $('bulkRow'), h2 = P && P.querySelector('h2'); if (!P || !ctl || !bulk || !h2 || !$('fSearch') || !$('selMode')) return false;
    css(); d.body.classList.add('mpc-on');
    B.head = el('div', { 'class': 'mpc-head', id: 'mpcHead' }); var anchor = $('streakBar') || h2; anchor.parentNode.insertBefore(B.head, anchor.nextSibling);
    B.more = el('button', { type: 'button', 'class': 'q mpc-tb', id: 'mpcMoreBtn', 'aria-expanded': 'false', 'aria-controls': 'mpcMore', title: 'Species, token, never fed, feed all hungry, discard pile, Flex Forge' }, '⚙️ More<span class="mpc-dot" hidden></span>');
    B.sel = el('button', { type: 'button', 'class': 'q mpc-tb', id: 'mpcSelBtn', 'aria-pressed': 'false', title: 'Tick pets to feed or discard them together' }, '☑️ Select');
    ctl.appendChild(B.more); ctl.appendChild(B.sel);
    B.rar = el('div', { 'class': 'mpc-rar', id: 'mpcRar' }); ctl.parentNode.insertBefore(B.rar, ctl.nextSibling);
    B.drawer = el('div', { id: 'mpcMore', hidden: '' },
      '<div><h4>SHOW</h4><div class="mpc-sec" id="mpcShow"><button type="button" class="q" id="nfProxy" aria-pressed="false" hidden>🥚 Never fed only</button><button type="button" class="q" id="zbProxy" aria-pressed="false" hidden>🧟 Zombie filters</button></div></div>' +
      '<div><h4>CARE</h4><div class="mpc-sec" id="mpcCare"><span class="mpc-next" id="mpcNext"></span></div></div>' +
      '<div><h4>LOOKS</h4><div class="mpc-sec"><a class="q" href="rare-room.html#lookStation" id="mpcFlex" title="Put flame, quest and earned looks on your pets">🃏 Flex Forge in The Rare Room ▸</a></div></div>');
    B.rar.parentNode.insertBefore(B.drawer, B.rar.nextSibling);
    B.bulk = bulk; B.count = el('span', { 'class': 'mpc-count', id: 'mpcCount' }); bulk.insertBefore(B.count, bulk.firstChild);
    B.done = el('button', { type: 'button', 'class': 'q', id: 'mpcDone', title: 'Stop selecting and untick every pet' }, '✕ Done'); bulk.appendChild(B.done);
    B.more.onclick = function () { var open = B.drawer.hidden; B.drawer.hidden = !open; B.more.setAttribute('aria-expanded', String(open)); };
    B.sel.onclick = function () { if (d.body.classList.contains('selmode') || selN()) { done(); return; } $('selMode').click(); sync(); };
    B.done.onclick = done;
    $('nfProxy').onclick = function () { var b = $('nfOnly'); if (b) b.click(); setTimeout(sync, 50); };
    $('zbProxy').onclick = function () { d.body.classList.toggle('mpc-zb'); sync(); };
    return true; }
  function done() { if (selN() && $('selNone')) $('selNone').click(); if (d.body.classList.contains('selmode')) $('selMode').click(); setTimeout(sync, 0); }
  /* move a late element once it exists; scripts find them by id, so they keep working wherever they sit */
  function adopt(id, into, before) { var e = typeof id === 'string' ? $(id) : id; if (!e || !into || e.parentNode === into) return; if (before && before.parentNode === into) into.insertBefore(e, before); else into.appendChild(e); }
  function sync() { if (!B.head) return; var n = selN(), on = d.body.classList.contains('selmode');
    adopt('mptStat', B.head); adopt('dcRow', B.head);
    adopt('fRarRow', B.rar); adopt('fShowingSlot', B.rar);
    var show = $('mpcShow'), care = $('mpcCare'), nf = $('nfProxy');
    adopt('fSpWrap', show, nf); var tok = d.querySelector('#petsPanel .ptok'); adopt(tok, show, nf); var phone = window.matchMedia && matchMedia('(max-width:640px)').matches; if (phone) adopt('mptView', show); else adopt('mptView', $('ctlRow'), B.more);
    adopt('selLair', B.bulk);
    adopt('bFeedHungry', care, $('mpcNext')); adopt('dpJump', care, $('mpcNext'));
    var nx = d.querySelector('#mptStat .mpt-next'), nt = nx ? nx.textContent.trim() : ''; if ($('mpcNext').textContent !== nt) $('mpcNext').textContent = nt;
    var nfb = $('nfOnly'); nf.hidden = !nfb; if (nfb) { var p = nfb.getAttribute('aria-pressed') === 'true', c = nfb.querySelector('.chip'), t = (p ? '✓ ' : '') + '🥚 Never fed only' + (c ? ' (' + c.textContent + ')' : '');
      if (nf.textContent !== t) nf.textContent = t; nf.setAttribute('aria-pressed', String(p)); }
    var zb = d.querySelector('#pets .zbfilter'), zbOn = !!(zb && zb.querySelector('.zbf-btn.on')), zp = $('zbProxy'); zp.hidden = !zb; zp.setAttribute('aria-pressed', String(zbOn || d.body.classList.contains('mpc-zb')));
    /* a dot on More when a filter hidden in it is on, so nothing stays filtered out of sight */
    var act = 0; if (nfb && nfb.getAttribute('aria-pressed') === 'true') act++; if (zbOn) act++;
    var tk = $('fTok'); if (tk && tk.value) act++; var spb = $('fSpBtn'); if (spb && !/All species/.test(spb.textContent)) act++;
    var dot = B.more.querySelector('.mpc-dot'); dot.hidden = !act; dot.textContent = act ? String(act) : '';
    d.body.classList.toggle('mpc-sel', n > 0);
    B.sel.setAttribute('aria-pressed', String(on || n > 0)); B.sel.textContent = on || n > 0 ? '☑️ Selecting' : '☑️ Select';
    var h = '☑ ' + fmt(n) + ' selected<small>' + (n ? 'Feed or discard them below' : 'Tap pets to tick them') + '</small>'; if (B.count.innerHTML !== h) B.count.innerHTML = h; }
  var started = false;
  function init() { if (started) return true; if (!build()) return false; started = true;
    var t = null, soon = function () { clearTimeout(t); t = setTimeout(sync, 60); };
    var P = $('pets'); if (P && window.MutationObserver) new MutationObserver(soon).observe(P, { childList: true });
    var sc = $('selCount'); if (sc && window.MutationObserver) new MutationObserver(soon).observe(sc, { childList: true, characterData: true, subtree: true });
    if (window.MutationObserver) new MutationObserver(soon).observe(d.body, { attributes: true, attributeFilter: ['class'] });
    d.addEventListener('xcpets-sel', soon); d.addEventListener('change', function (e) { if (e.target && e.target.closest && e.target.closest('#petsPanel')) soon(); }, true);
    /* Nov 26 2026 (Jake: "this feed bar is stuck"): the selection bar was pinned to the screen whenever a pet was ticked, so it followed
     * you down Play to the Grinder, the Pantry and over their burn sheets. It now pins only while My Pets is on screen (class mpc-inview);
     * scroll back to My Pets and it is there again, with your ticks kept. */
    var panel = $('petsPanel'); if (panel && window.IntersectionObserver) new IntersectionObserver(function (es) { es.forEach(function (e) { d.body.classList.toggle('mpc-inview', e.isIntersecting); }); }, { rootMargin: '0px 0px -140px 0px' }).observe(panel);
    else d.body.classList.add('mpc-inview');
    setInterval(sync, 2000); sync(); return true; }
  window.V2MyPetsCalm = { init: init, sync: sync };
  var tries = 0; (function poll() { if (!init() && tries++ < 600) setTimeout(poll, 200); })();
})();
