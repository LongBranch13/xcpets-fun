/* mypets-swipe (owner, Oct 22 2026): "One at a time" view for My Pets. DISPLAY ONLY: no burns of its own, no rule change.
 * A toggle next to the pet tabs switches between the existing grid and one big card. The list is the same filtered + sorted
 * list the grid uses (V2UI.petList), so every filter / sort / Starred / Cemetery tab is respected. The big card contains the
 * exact grid card (checkbox, chips, badges, care bar, Open) plus stats, worn gear and actions (Feed, Fight, Breed,
 * Details, Pet page) that route into the existing flows, which keep their own confirm windows. Swipe (touch / pointer, same
 * handling style as the Rug Me board, but nothing is ever burned by a swipe), arrow buttons and keyboard arrows move.
 * localStorage: xcpets-mypets-view = 'grid' | 'one'; xcpets-mypets-pos = last pet id shown. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); }, LS = window.localStorage, KV = 'xcpets-mypets-view', KP = 'xcpets-mypets-pos';
  function get(k, d) { try { return LS.getItem(k) || d; } catch (e) { return d; } }
  function set(k, v) { try { LS.setItem(k, String(v)); } catch (e) { } }
  var st = { view: get(KV, 'grid'), id: Number(get(KP, 0)) || 0, busy: false }, U = function () { return window.V2UI; };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function css() { if ($('mpsCss')) return; var s = document.createElement('style'); s.id = 'mpsCss';
    s.textContent = '.mps-tog{display:flex;gap:6px;margin:6px 0;flex-wrap:wrap}.mps-tog .q[aria-pressed="true"]{outline:2px solid #ffc93c;color:#ffc93c}' +
      'body.mps-one #pets,body.mps-one #petPager{display:none!important}#mpsBox{display:none}body.mps-one #mpsBox{display:block}' +
      '.mps-nav{display:flex;align-items:center;justify-content:center;gap:10px;margin:6px 0}.mps-nav .btn{min-width:48px;min-height:44px;font-size:18px}' +
      '.mps-pos{font-family:"Press Start 2P",monospace;font-size:12px;min-width:90px;text-align:center}' +
      '.mps-stage{overflow:hidden;position:relative;touch-action:pan-y;max-width:520px;margin:0 auto}' +
      '.mps-card{user-select:none;-webkit-user-select:none;will-change:transform}.mps-card>.pet.card{width:auto;max-width:none;margin:0;cursor:grab}' +
      '.mps-card>.pet.card canvas.sprite{width:192px!important;height:192px!important;display:block;margin:6px auto;image-rendering:pixelated}' +
      '.mps-card>.pet.card h4{font-size:14px;text-align:center}.mps-card .chips{justify-content:center}' +
      '.mps-extra{margin-top:8px}.mps-extra .statbox{max-width:340px;margin:0 auto}.mps-gear{font-size:12px;margin:6px 0}.mps-acts{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:8px}.mps-acts .btn{min-height:42px}' +
      '.mps-hint{text-align:center;font-size:11px;opacity:.7;margin-top:6px}';
    document.head.appendChild(s); }
  function list() { var u = U(); return u && u.petList ? u.petList(u.world()) : []; }
  function mount() { var tabs = document.querySelector('#petsPanel .pettabs'); if (!tabs || $('mpsTog')) return !!tabs; css();
    var t = document.createElement('div'); t.className = 'mps-tog'; t.id = 'mpsTog'; t.setAttribute('role', 'group'); t.setAttribute('aria-label', 'My Pets view');
    t.innerHTML = '<button type="button" class="q" id="mpsGrid">▦ Grid</button><button type="button" class="q" id="mpsOne">🃏 One at a time</button>';
    tabs.parentNode.insertBefore(t, tabs.nextSibling);
    var b = document.createElement('div'); b.id = 'mpsBox'; $('pets').parentNode.insertBefore(b, $('pets'));
    $('mpsGrid').onclick = function () { setView('grid'); }; $('mpsOne').onclick = function () { setView('one'); };
    new MutationObserver(function () { if (st.view === 'one') sched(); }).observe($('pets'), { childList: true });
    setView(st.view, true); return true; }
  function setView(v, quiet) { st.view = v === 'one' ? 'one' : 'grid'; set(KV, st.view); document.body.classList.toggle('mps-one', st.view === 'one');
    $('mpsGrid').setAttribute('aria-pressed', st.view === 'grid'); $('mpsOne').setAttribute('aria-pressed', st.view === 'one'); if (st.view === 'one') draw(); else if (!quiet) $('mpsBox').innerHTML = ''; }
  var tm = null; function sched() { clearTimeout(tm); tm = setTimeout(function () { if (!st.busy) draw(); }, 30); }
  function idx(L) { var i = L.findIndex(function (p) { return p.id === st.id; }); return i < 0 ? 0 : i; }
  function gearHtml(u, w, p) { var R = window.V2Render, g = R && R.worn ? R.worn(w, p.id) : []; if (!g.length) return '<div class="mps-gear muted">🎒 No gear worn (' + (p.capacity || 0) + ' slots)</div>';
    return '<div class="mps-gear">🎒 ' + g.map(function (x) { return esc((x.slot ? x.slot + ': ' : '') + (x.label || x.item || x.gid)); }).join(' · ') + '</div>'; }
  function acts(u, w, p) { var V = window.V2Rules, me = u.ME, own = !!me && p.owner === me && !p.dead && !p.released, h = '';
    if (own) { h += '<button type="button" class="btn ico-flame" data-m="feed"' + (p.hungry ? '' : ' disabled title="Not hungry right now"') + '>🍼 Feed' + (p.hungry && p.nextMeal ? ' (' + Number(p.nextMeal).toLocaleString() + ')' : '') + '</button>';
      var canF = $('fMine') && [].some.call($('fMine').options, function (o) { return o.value === String(p.id); }); h += '<button type="button" class="btn ghost" data-m="fight"' + (canF ? '' : ' disabled title="Not eligible to fight right now"') + '>⚔️ Fight</button>';
      var bw = null; try { var L = V.breedPicker(w, me, w.tip || u.S().tip, '', u.pendingBreedIds ? u.pendingBreedIds() : []); var m = L.mine.filter(function (x) { return x.p.id === p.id; })[0]; bw = m ? m.why || null : 'Not eligible to breed'; } catch (e) { bw = null; }
      h += '<button type="button" class="btn ghost" data-m="breed"' + (bw ? ' disabled title="' + esc(bw) + '"' : '') + '>💞 Breed</button>'; }
    h += '<button type="button" class="btn ghost" data-m="detail">🔎 Details &amp; gear</button><a class="btn ghost" data-m="page" href="pet.html?id=' + p.id + '">Pet page →</a>';
    return '<div class="mps-acts">' + h + '</div>'; }
  function draw(dir) { var u = U(), box = $('mpsBox'); if (!u || !box || !u.cardFor) return; var w = u.world(), L = list();
    if (!L.length) { box.innerHTML = '<p class="muted">No pets match this filter.</p>'; return; }
    var i = idx(L), p = L[i]; st.id = p.id; set(KP, p.id);
    box.innerHTML = '<div class="mps-nav"><button type="button" class="btn ghost" id="mpsPrev" aria-label="Previous pet"' + (L.length < 2 ? ' disabled' : '') + '>◀</button><span class="mps-pos" id="mpsPos" aria-live="polite">' + (i + 1) + ' / ' + L.length + '</span><button type="button" class="btn ghost" id="mpsNext" aria-label="Next pet"' + (L.length < 2 ? ' disabled' : '') + '>▶</button></div>' +
      '<div class="mps-stage" id="mpsStage"><div class="mps-card" id="mpsCard"></div></div><div class="mps-hint">Swipe, or use ◀ ▶ / arrow keys. Swiping only changes the pet shown; it never burns anything.</div><div class="mps-hint" id="mpsStars" aria-live="polite">' + starLine() + '</div>';
    var c = $('mpsCard'), d = u.cardFor(p, w); if (!d) return; c.appendChild(d);
    var ex = document.createElement('div'); ex.className = 'mps-extra'; ex.innerHTML = '<div class="statbox rm-stats">' + (u.statBars ? u.statBars(p) : '') + '</div>' + gearHtml(u, w, p) + acts(u, w, p); d.appendChild(ex);
    ex.addEventListener('click', function (e) { e.stopPropagation(); var b = e.target.closest('[data-m]'); if (!b || b.disabled) return; var m = b.getAttribute('data-m');
      if (m === 'page') return; e.preventDefault();
      if (m === 'feed') return u.feed(p.id); if (m === 'detail') return u.detail(p.id);
      if (m === 'fight') { $('fMine').value = String(p.id); $('fMine').dispatchEvent(new Event('change', { bubbles: true })); return $('arenaPanel').scrollIntoView({ behavior: 'smooth' }); }
      if (m === 'breed') { $('bA').value = String(p.id); u.render(); return $('breedPanel').scrollIntoView({ behavior: 'smooth' }); } });
    $('mpsPrev').onclick = function () { go(-1); }; $('mpsNext').onclick = function () { go(1); };
    if (dir) { c.style.transition = 'none'; c.style.transform = 'translateX(' + (dir * 100) + '%)'; c.offsetWidth; c.style.transition = 'transform .25s ease-out'; c.style.transform = ''; }
    drag(c); }
  /* mypets-checkbox (owner Oct 28 2026): the ☑ checkbox on the card is the mark again (no stars). Feed selected, Discard selected and the Rare Room roll / Auto-equip act on the checked pets. */
  function starLine() { var u = U(), n = u && u.pickIds ? u.pickIds().length : 0; return '☑ <b>' + n.toLocaleString('en-US') + '</b> selected pet' + (n === 1 ? '' : 's') + '. Tick the box on a card to select it. Feed selected, Discard selected and the Rare Room multi-pet roll + Auto-equip act on your selected pets.'; }
  document.addEventListener('xcpets-sel', function () { var e = $('mpsStars'); if (e) e.innerHTML = starLine(); });
  function go(dir) { var L = list(); if (L.length < 2 || st.busy) return; var i = idx(L), c = $('mpsCard'); st.id = L[(i + dir + L.length) % L.length].id; set(KP, st.id);
    if (!c || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return draw();
    st.busy = true; c.style.transition = 'transform .22s ease-in, opacity .22s'; c.style.transform = 'translateX(' + (-dir * 110) + '%)'; c.style.opacity = '.3';
    setTimeout(function () { st.busy = false; draw(dir); }, 210); }
  /* swipe: same pointer handling as the Rug Me board (pointerdown/move/up, 30% / 110px threshold, spring back) - display only */
  function drag(el) { var x0 = null, y0 = 0, dx = 0, moved = false;
    el.addEventListener('pointerdown', function (e) { if (e.target.closest('button,a,input,select')) return; x0 = e.clientX; y0 = e.clientY; dx = 0; moved = false; el.style.transition = 'none'; });
    el.addEventListener('pointermove', function (e) { if (x0 == null) return; dx = e.clientX - x0; if (!moved && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - y0)) { moved = true; try { el.setPointerCapture(e.pointerId); } catch (x) { } } if (moved) el.style.transform = 'translateX(' + dx + 'px) rotate(' + (dx / 40) + 'deg)'; });
    function up() { if (x0 == null) return; x0 = null; var lim = Math.min(110, el.offsetWidth * 0.3); if (moved && dx < -lim) go(1); else if (moved && dx > lim) go(-1); else { el.style.transition = 'transform .2s'; el.style.transform = ''; } }
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('click', function (e) { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true); }
  document.addEventListener('keydown', function (e) { if (st.view !== 'one' || !$('mpsCard') || /INPUT|SELECT|TEXTAREA/.test((e.target || {}).tagName || '') || document.querySelector('.modal.on,#detail.on')) return;
    var r = $('petsPanel').getBoundingClientRect(); if (r.bottom < 0 || r.top > window.innerHeight) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); } else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); } });
  (function boot() { if (!U() || !U().cardFor || !$('pets') || !mount()) return setTimeout(boot, 300); })();
  window.V2MyPetsSwipe = { view: function () { return st.view; }, setView: setView, go: go, id: function () { return st.id; } };
})();
