/* low-friction-1102 (owner, Nov 2 2026; PREVIEW, display only, NO rule change, never signs): play with fewer clicks.
 * 1) Pet dock under Gooby's breeding scene (#motelScene): your pets in a strip. Drag one (mouse, pen or finger, move up/down)
 *    onto 🥚 Nest (first guest, then the partner), 💎 Rare Room or 🍼 Bowl. Same thing without dragging: tap / click / Enter a pet
 *    to pick it up, then tap / click / Enter a target. Targets that can't take the held pet are greyed out and say why
 *    (V2Rules.breedPicker: Gods only with Gods, kin, already parent A, burn waiting...; Bowl: not hungry / not yours).
 *    The Nest only fills #bA / #bB like the existing pickers; every burn still goes through the existing single burn confirm,
 *    the wallet and the whenFresh / S.verified gate (V2UI.feed -> confirmPlans; #bGo; #bFeedSel; #dcBtn).
 * 2) One-tap 🍼 Feed / 💞 Breed / 🧹 Chores on every My Pets card.
 * 3) Smart defaults: the last pet used comes first (and goes into the empty Nest on the breed page); then hungry pets, cheapest meal first.
 * 4) Batch: "Feed N selected" = the existing Feed selected (one burn list, existing chaining rules). Breed stays one pair per
 *    burn and chores are one account-wide burn, so there is no batch for those (the rules have none).
 * 5) Phones: My Pets opens in the existing swipe view ("One at a time") unless you picked a view before.
 * localStorage: xcpets-lf-last = last pet id used here. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); }, U = function () { return window.V2UI; }, V = function () { return window.V2Rules; };
  var LS = window.localStorage, KL = 'xcpets-lf-last', st = { held: null, q: '', n: 40, drag: null };
  function get(k) { try { return LS.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { LS.setItem(k, String(v)); } catch (e) { } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function mode() { return window.V2PageSplit ? V2PageSplit.mode() : ((document.body && document.body.getAttribute('data-split')) || 'play'); }
  function toast(m) { var u = U(); if (u && u.toast) u.toast(m); }
  function css() { if ($('lfCss')) return; var s = document.createElement('style'); s.id = 'lfCss'; s.textContent =
    '#lfDock{margin:8px auto 4px;max-width:900px;border:2px solid #000;border-radius:12px;background:#132016;padding:8px}' +
    '.lf-tg{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px}' +
    '.lf-t{font:inherit;font-weight:700;font-size:13px;color:var(--ink,#e9fbe9);background:#1f2d23;border:3px dashed #3ddc84;border-radius:12px;min-height:64px;padding:6px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;line-height:1.2}' +
    '.lf-t .e{font-size:24px}.lf-t small{font-weight:400;font-size:11px;opacity:.85}.lf-t.hot{background:#2a4a33;border-style:solid;transform:scale(1.04)}' +
    '.lf-t[aria-disabled="true"]{opacity:.38;filter:grayscale(1);border-color:#555;cursor:not-allowed}.lf-t:focus-visible,.lf-p:focus-visible{outline:3px solid #ffc93c;outline-offset:2px}' +
    '.lf-bar{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:6px;font-size:12px}.lf-bar input{flex:1 1 140px;min-width:0;padding:7px 9px;background:#0a0f0b;color:inherit;border:1px solid #2c4a36;border-radius:8px;font:inherit}' +
    '.lf-strip{display:flex;gap:6px;overflow-x:auto;scroll-snap-type:x proximity;padding:2px 2px 8px;-webkit-overflow-scrolling:touch}' +
    '.lf-p{flex:0 0 auto;scroll-snap-align:start;width:84px;font:inherit;font-size:11px;color:inherit;background:#1a281e;border:2px solid #000;border-radius:10px;padding:4px;cursor:grab;touch-action:pan-x;user-select:none;-webkit-user-select:none;display:flex;flex-direction:column;align-items:center;gap:2px}' +
    '.lf-p canvas{width:56px!important;height:56px!important;image-rendering:pixelated;pointer-events:none}.lf-p .nm{max-width:76px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.lf-p.held{border-color:#ffc93c;background:#3a3417;box-shadow:0 0 0 2px #ffc93c}.lf-p .hb{color:#ffb347}.lf-p.last{border-color:#3ddc84}' +
    '.lf-ghost{position:fixed;z-index:99980;pointer-events:none;opacity:.9;transform:translate(-50%,-60%) scale(1.1)}' +
    '.lf-hint{font-size:11px;opacity:.75;text-align:center;margin-top:2px}' +
    '.lf-acts{display:flex;gap:4px;justify-content:center;margin-top:4px;flex-wrap:wrap}.lf-acts button{font:inherit;font-size:12px;min-height:34px;min-width:40px;padding:3px 7px;border-radius:8px;border:2px solid #000;background:#1f2d23;color:var(--ink,#e9fbe9);cursor:pointer}' +
    '.lf-acts button[aria-disabled="true"]{opacity:.4;cursor:not-allowed}.lf-acts button:hover{border-color:#3ddc84}' +
    '@media (max-width:520px){.lf-t{min-height:56px;font-size:12px}.lf-t .e{font-size:20px}}';
    document.head.appendChild(s); }
  function W() { var u = U(); try { return u && u.world ? u.world() : null; } catch (e) { return null; } }
  function tip(w) { var u = U(); return (w && w.tip) || (u && u.S && u.S().tip) || 0; }
  function pend() { var u = U(); return u && u.pendingBreedIds ? u.pendingBreedIds() : null; }
  function mine(w) { var u = U(); if (!u || !w) return []; try { return (u.petList ? u.petList(w) : []).filter(function (p) { return !p.dead && !p.released; }); } catch (e) { return []; } }
  function owns(p) { var u = U(); return !!(u && u.ME && p && p.owner === u.ME && !p.dead && !p.released); }
  /* why a target can't take pet p right now (null = it can) */
  function whyNest(w, p) { var Vr = V(); if (!Vr || !Vr.breedPicker) return 'Breeding is not loaded yet'; if (vo()) return 'View only: connect the wallet to breed'; var a = ($('bA') || {}).value || '', b = ($('bB') || {}).value || '';
    try { if (!a || a === String(p.id) || b) { var m = Vr.breedPicker(w, U().ME, tip(w), '', pend()).mine.filter(function (x) { return x.p.id === p.id; })[0]; return m ? m.why : 'Only your own pets can check in first'; }
      var q = Vr.breedPicker(w, U().ME, tip(w), a, pend()).partners.filter(function (x) { return x.p.id === p.id; })[0]; return q ? q.why : 'This pet can’t breed right now'; } catch (e) { return 'This pet can’t breed right now'; } }
  function whyRare(w, p) { return owns(p) ? null : 'Only the owner can dress a pet'; }
  function vo() { var u = U(); return !!(u && u.viewOnly && u.viewOnly()); }
  function whyBowl(w, p) { if (!owns(p)) return 'Only the owner can feed a pet'; if (vo()) return 'View only: connect the wallet to feed'; return p.hungry ? null : 'Not hungry right now'; }
  function remember(id) { set(KL, id); }
  /* actions: they only pick / route; every burn uses the existing confirm + wallet */
  function nest(w, p) { var a = $('bA'), b = $('bB');
    if (!a || !b || mode() !== 'breed') { if (!owns(p)) return toast('#' + p.id + ': Only the owner can breed a pet'); remember(p.id); location.href = 'breed.html' + location.search + '#breed-' + p.id; return; }
    var why = whyNest(w, p); if (why) return toast('#' + p.id + ': ' + why);
    if (!a.value || a.value === String(p.id) || b.value) { a.value = String(p.id); b.value = ''; toast('🥚 #' + p.id + ' is the first guest. Now drop or tap a partner.'); }
    else { b.value = String(p.id); toast('🥚 #' + a.value + ' + #' + p.id + ' are in the Nest. Check in when you are ready.'); }
    remember(p.id); U().render(); var go = $('bGo'); if (go && b.value) setTimeout(function () { try { go.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { } }, 60); }
  function rare(w, p) { var why = whyRare(w, p); if (why) return toast('#' + p.id + ': ' + why); remember(p.id);
    if (mode() === 'rare' && window.V2Shop && V2Shop.enterDress) { V2Shop.enterDress(p.id); var r = $('rare-room') || $('invPanel'); if (r) r.scrollIntoView({ behavior: 'smooth' }); return; }
    location.href = 'rare-room.html' + location.search + '#rare-room-' + p.id; }
  function bowl(w, p) { var why = whyBowl(w, p); if (why) return toast('#' + p.id + ': ' + why); remember(p.id); U().feed(p.id); }
  var ACT = { nest: [nest, whyNest], rare: [rare, whyRare], bowl: [bowl, whyBowl] };
  function drop(k, id) { var w = W(), p = w && w.byId[id]; if (!p) return; ACT[k][0](w, p); hold(null); }
  /* --- the dock --- */
  function order(w, L) { var last = Number(get(KL)) || 0; return L.slice().sort(function (a, b) { var la = a.id === last ? 0 : 1, lb = b.id === last ? 0 : 1; if (la !== lb) return la - lb;
    var ha = a.hungry ? 0 : 1, hb = b.hungry ? 0 : 1; if (ha !== hb) return ha - hb; if (a.hungry && b.hungry) return (Number(a.nextMeal) || 0) - (Number(b.nextMeal) || 0); return 0; }); }
  function tileHtml(p, last) { return '<button type="button" class="lf-p' + (p.id === last ? ' last' : '') + '" data-lf="' + p.id + '" aria-pressed="false" aria-label="#' + p.id + ' ' + esc(p.name || '') + (p.hungry ? ', hungry' : '') + '. Pick up, then choose Nest, Rare Room or Bowl"><span class="sp"></span><span class="nm">#' + p.id + ' ' + esc(p.name || '') + '</span>' + (p.hungry ? '<span class="hb">🍼 ' + (p.nextMeal ? Number(p.nextMeal).toLocaleString('en-US') : 'hungry') + '</span>' : '<span class="hb" style="opacity:.5">fed</span>') + '</button>'; }
  function dock() { var sc = $('motelScene'); if (!sc || !U() || !U().cardFor) return false; var d = $('lfDock');
    if (!d) { css(); d = document.createElement('div'); d.id = 'lfDock'; d.setAttribute('role', 'region'); d.setAttribute('aria-label', 'Pet dock: drag or tap a pet, then a target');
      d.innerHTML = '<div class="lf-tg" role="group" aria-label="Targets"><button type="button" class="lf-t" data-t="nest"><span class="e">🥚</span>Nest<small>breed</small></button><button type="button" class="lf-t" data-t="rare"><span class="e">💎</span>Rare Room<small>dress up</small></button><button type="button" class="lf-t" data-t="bowl"><span class="e">🍼</span>Bowl<small>feed</small></button></div>' +
        '<div class="lf-bar"><input type="search" id="lfQ" placeholder="Find: #12, name, species" aria-label="Find a pet in the dock"><button type="button" class="q" id="lfFeedSel" hidden>🍼 Feed selected</button></div><div class="lf-strip" id="lfStrip" role="listbox" aria-label="Your pets" aria-orientation="horizontal"></div>' +
        '<div class="lf-hint">Drag a pet up onto a target, or tap a pet then a target (keyboard: Tab, Enter). Greyed out = that pet can’t go there. Burns still ask once in the burn window.</div>';
      sc.parentNode.insertBefore(d, sc.nextSibling);
      $('lfQ').oninput = function () { st.q = this.value.trim().toLowerCase().replace(/^#/, ''); st.n = 40; paint(); };
      $('lfFeedSel').onclick = function () { var b = $('bFeedSel'); if (b && !b.disabled) b.click(); else toast('Tick pets in My Pets first.'); };
      d.querySelectorAll('.lf-t').forEach(function (t) { t.onclick = function () { var k = t.dataset.t; if (st.held == null) return toast('Pick up a pet first: tap one in the strip below.'); if (t.getAttribute('aria-disabled') === 'true') return toast(t.title || 'Not here'); drop(k, st.held); }; });
      var strip = $('lfStrip'); strip.addEventListener('click', function (e) { var b = e.target.closest('[data-lf]'); if (b && !st.dragged) hold(Number(b.dataset.lf) === st.held ? null : Number(b.dataset.lf)); st.dragged = false; var m = e.target.closest('[data-more]'); if (m) { st.n += 60; paint(); } });
      strip.addEventListener('pointerdown', down); document.addEventListener('xcpets-sel', selBtn); }
    paint(); return true; }
  function selBtn() { var b = $('lfFeedSel'), u = U(), n = u && u.pickIds ? u.pickIds().length : 0; if (!b) return; b.hidden = !n; b.textContent = '🍼 Feed ' + n.toLocaleString('en-US') + ' selected'; }
  var pk = ''; function paint() { var w = W(), s = $('lfStrip'); if (!w || !s) return; var last = Number(get(KL)) || 0, L = order(w, mine(w)).filter(function (p) { return !st.q || String(p.id).indexOf(st.q) === 0 || String(p.name || '').toLowerCase().indexOf(st.q) >= 0 || String(p.species || '').toLowerCase().indexOf(st.q) >= 0; });
    var key = L.slice(0, st.n).map(function (p) { return p.id + (p.hungry ? 'h' + p.nextMeal : ''); }).join(',') + '|' + last + '|' + st.n + '|' + L.length; if (key === pk && s.childNodes.length) { targets(); return; } pk = key;
    if (!L.length) { s.innerHTML = '<span class="muted small">' + (U().ME ? 'No pets here.' : 'Connect a wallet (or view an address) to see your pets.') + '</span>'; targets(); return; }
    s.innerHTML = L.slice(0, st.n).map(function (p) { return tileHtml(p, last); }).join('') + (L.length > st.n ? '<button type="button" class="lf-p" data-more="1">+' + (L.length - st.n).toLocaleString('en-US') + ' more</button>' : '');
    s.querySelectorAll('[data-lf]').forEach(function (b) { var p = w.byId[b.dataset.lf], d = p && U().cardFor(p, w), c = d && d.querySelector('canvas'); if (c) { c.removeAttribute('style'); c.className = ''; b.querySelector('.sp').appendChild(c); } });
    if (st.held != null && !w.byId[st.held]) st.held = null; mark(); targets(); selBtn(); }
  function mark() { document.querySelectorAll('#lfStrip [data-lf]').forEach(function (b) { var on = Number(b.dataset.lf) === st.held; b.classList.toggle('held', on); b.setAttribute('aria-pressed', String(on)); }); }
  function targets() { var w = W(), p = w && st.held != null ? w.byId[st.held] : null; document.querySelectorAll('#lfDock .lf-t').forEach(function (t) { var why = p ? ACT[t.dataset.t][1](w, p) : null; var ad = why ? 'true' : 'false', ti = why ? '#' + p.id + ': ' + why : ''; if (t.getAttribute('aria-disabled') !== ad) t.setAttribute('aria-disabled', ad); if (t.title !== ti) t.title = ti;
      var sm = t.querySelector('small'), tx = why ? why : ({ nest: ($('bA') && $('bA').value && !$('bB').value) ? 'partner for #' + $('bA').value : 'breed', rare: 'dress up', bowl: p && p.hungry && p.nextMeal ? 'feed · ' + Number(p.nextMeal).toLocaleString('en-US') : 'feed' })[t.dataset.t]; if (sm && sm.textContent !== tx) sm.textContent = tx; }); }
  function hold(id) { st.held = id; if (id != null) remember(id); mark(); targets(); }
  /* pointer drag (mouse, pen, touch). Vertical move starts a drag; sideways move scrolls the strip. Tap/click/Enter does the same as a drag. */
  function down(e) { var b = e.target.closest('[data-lf]'); if (!b || e.button > 0) return; var x0 = e.clientX, y0 = e.clientY, id = Number(b.dataset.lf), g = null, hot = null;
    function at(x, y) { var el = document.elementFromPoint(x, y), t = el && el.closest && el.closest('#lfDock .lf-t'); return t && t.getAttribute('aria-disabled') !== 'true' ? t : null; }
    function mv(ev) { var dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (!g) { if (Math.abs(dy) < 10 || Math.abs(dy) < Math.abs(dx)) { if (Math.abs(dx) > 12) end(); return; } hold(id); g = b.cloneNode(true); g.className = 'lf-p lf-ghost held'; g.removeAttribute('data-lf'); var c0 = b.querySelector('canvas'), c1 = g.querySelector('canvas'); if (c0 && c1) c1.getContext('2d').drawImage(c0, 0, 0); document.body.appendChild(g); st.dragged = true; try { b.setPointerCapture(ev.pointerId); } catch (x) { } }
      ev.preventDefault(); g.style.left = ev.clientX + 'px'; g.style.top = ev.clientY + 'px'; var t = at(ev.clientX, ev.clientY); if (t !== hot) { if (hot) hot.classList.remove('hot'); hot = t; if (hot) hot.classList.add('hot'); } }
    function end() { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', end); if (g) g.remove(); if (hot) hot.classList.remove('hot'); }
    function up(ev) { var t = g ? at(ev.clientX, ev.clientY) : null, was = !!g; end(); if (was) { setTimeout(function () { st.dragged = false; }, 0); if (t) drop(t.dataset.t, id); else { var w = W(), el = document.elementFromPoint(ev.clientX, ev.clientY), dt = el && el.closest && el.closest('#lfDock .lf-t'); if (dt && w) toast(dt.title || 'Not here'); } } }
    document.addEventListener('pointermove', mv, { passive: false }); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', end); }
  /* --- one-tap buttons on each My Pets card --- */
  function cardActs() { var box = $('pets'), w = W(); if (!box || !w) return; css(); var dc = $('dcBtn'), dcOk = !!(dc && !dc.disabled);
    box.querySelectorAll('.pet.card[data-pid]').forEach(function (c) { var p = w.byId[c.dataset.pid]; if (!p || p.dead || p.released) return; var k = (p.hungry ? 'h' : 'f') + (owns(p) ? 'o' : 'v') + (dcOk ? 'c' : ''), r = c.querySelector(':scope > .lf-acts');
      if (r && r.dataset.k === k) return; if (!r) { r = document.createElement('div'); r.className = 'lf-acts'; c.appendChild(r); } r.dataset.k = k;
      var fw = whyBowl(w, p), bw = owns(p) ? null : 'Only the owner can breed a pet', cw = dcOk ? null : 'Daily chores are not open right now';
      r.innerHTML = '<button type="button" data-lfa="feed" aria-label="Feed #' + p.id + (fw ? ': ' + esc(fw) : '') + '" title="' + esc(fw || 'Feed #' + p.id + (p.nextMeal ? ' · ' + Number(p.nextMeal).toLocaleString('en-US') : '')) + '"' + (fw ? ' aria-disabled="true"' : '') + '>🍼</button>' +
        '<button type="button" data-lfa="breed" aria-label="Breed #' + p.id + (bw ? ': ' + bw : '') + '" title="' + esc(bw || 'Breed #' + p.id + ' at Gooby’s') + '"' + (bw ? ' aria-disabled="true"' : '') + '>💞</button>' +
        '<button type="button" data-lfa="chores" aria-label="Daily chores (all pets)' + (cw ? ': ' + cw : '') + '" title="' + esc(cw || 'Daily chores: WAGMI + feed + spins for all pets, one burn') + '"' + (cw ? ' aria-disabled="true"' : '') + '>🧹</button>'; }); }
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('.lf-acts [data-lfa]'); if (!b) return; e.stopPropagation(); e.preventDefault(); var c = b.closest('.pet.card[data-pid]'), w = W(), p = w && c && w.byId[c.dataset.pid]; if (!p) return;
    if (b.getAttribute('aria-disabled') === 'true') return toast(b.title); var a = b.dataset.lfa; remember(p.id);
    if (a === 'feed') return U().feed(p.id); if (a === 'breed') return nest(w, p); if (a === 'chores') { var dc = $('dcBtn'); if (dc && !dc.disabled) dc.click(); } }, true);
  /* smart default: on the breed page an empty Nest gets the last pet used, if it can check in */
  var seeded = false; function seed() { if (seeded || mode() !== 'breed' || /^#breed-\d+/.test(location.hash)) return; var a = $('bA'), w = W(), id = Number(get(KL)) || 0; if (!a || !w || !U().ME || !w.pets || !w.pets.length) return; seeded = true; var p = w.byId[id];
    if (!a.value && p && !whyNest(w, p)) { a.value = String(id); U().render(); toast('🥚 Your last pet #' + id + ' is in the Nest. Tap ✕ or another pet to change.'); } }
  /* phones: the swipe view default lives in js/v2-mypets-swipe.js (One at a time when no view was chosen before) */
  var t = null; function tick() { clearTimeout(t); t = setTimeout(function () { try { dock(); cardActs(); seed(); } catch (e) { if (window.console) console.warn('lowfriction', e); } }, 60); }
  (function boot() { if (!U() || !U().cardFor || !document.body) return setTimeout(boot, 300); tick();
    var pets = $('pets'); if (pets) new MutationObserver(tick).observe(pets, { childList: true, subtree: true });
    var bp = $('breedPanel'); if (bp) new MutationObserver(function (ms) { var d = $('lfDock'); if (ms.some(function (m) { return !d || !d.contains(m.target); })) targets(); }).observe(bp, { childList: true, subtree: true, attributes: true, attributeFilter: ['value'] });
    ['xcpets-sel', 'xcpets-world', 'xcpets-render'].forEach(function (ev) { document.addEventListener(ev, tick); }); setInterval(tick, 4000); })();
  window.V2LowFriction = { hold: hold, drop: drop, held: function () { return st.held; } };
})();
