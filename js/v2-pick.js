/* XCPETS pet pick (pet-picker, owner Jake Nov 22 2026: "It should be fun and easy to see or pick which pet you are breeding, fighting, putting
 * gear on with or against" / "Intuitive is what I mean by easy" / "Does this replace the crap we have": yes, one picker per place, the old lists go).
 * ONE shared look for choosing pets in a place:
 *  - a face-off stage on top: two big slots (your pet + the other side), a "+" or "VS" between them, one plain verdict line under them.
 *    Tap a slot to choose which side the cards below fill. The slot being filled glows.
 *  - shelves (big pill tabs) instead of long sorted lists: Best match, Favorites (the same ★ as My Pets), Recent, and place-specific ones.
 *  - big sprite cards (3-4 a row), each with the one number that matters there; pets that can't go yet are greyed with the reason.
 *  - search box for the whole side (name, #number, species). Cards can also be dragged onto a slot or onto the place scene.
 *  - your buddy: the last pet you used (localStorage xcpets-lf-last, shared with the old motel dock and the pet page links) is marked BUDDY.
 * Display and picking only: callers keep their own state and burns (the motel bell, the face-off button). No rules, tags or amounts here.
 * Big wallets (2k-12k pets): callers hand in already-sorted lists; this paints at most st.n cards (24, +24 per "Show more") and draws every
 * sprite through V2Render.lazy, so nothing scores or paints the whole wallet. */
(function (root) {
  'use strict';
  var TL = ['Common', 'Uncommon', 'Rare', 'Legendary'], TID = ['common', 'uncommon', 'rare', 'legendary'], PER = 24;
  var KB = 'xcpets-lf-last', KR = 'xcpets-pick-recent';
  var NF = typeof Intl !== 'undefined' ? new Intl.NumberFormat('en-US') : null;
  function fmt(n) { return NF ? NF.format(n) : String(n); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function get(k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { root.localStorage.setItem(k, String(v)); } catch (e) { } }
  function U() { return root.V2UI; }
  function short(a) { a = String(a || ''); return a.length > 12 ? a.slice(0, 6) + '…' + a.slice(-4) : a; }

  /* ---- buddy, recent, favorites ---- */
  function buddy() { return Number(get(KB)) || 0; }
  function recent() { try { var l = JSON.parse(get(KR) || '[]'); return Array.isArray(l) ? l.map(Number).filter(function (x) { return x > 0; }) : []; } catch (e) { return []; } }
  /** used(id, mine): remember a pick. Your own pets become the buddy; every pick goes on the Recent shelf (12 kept). */
  function used(id, mine) { id = Number(id); if (!(id > 0)) return; if (mine) set(KB, id); var l = [id].concat(recent().filter(function (x) { return x !== id; })).slice(0, 12); set(KR, JSON.stringify(l)); }
  function isFav(id) { var u = U(); return !!(u && u.isKept && u.isKept(id)); }
  function favIds() { var u = U(); return u && u.keptIds ? u.keptIds() : []; }
  function toggleFav(id) { var u = U(); if (u && u.toggleKeep) u.toggleKeep(id); }
  /** shelf helpers: keep the order of `list` (items {p}) but only favorites / recent ones */
  function favOf(list) { var F = new Set(favIds()); return list.filter(function (x) { return F.has(x.p.id); }); }
  function recentOf(list) { var R = recent(), at = {}; R.forEach(function (id, i) { at[id] = i; }); return list.filter(function (x) { return x.p.id in at; }).sort(function (a, b) { return at[a.p.id] - at[b.p.id]; }); }
  function match(p, q, spL) { if (!q) return true; q = String(q).toLowerCase().trim().replace(/^#/, ''); if (!q) return true;
    return String(p.id).indexOf(q) === 0 || String(p.name || '').toLowerCase().indexOf(q) >= 0 || (spL ? String(spL(p.species) || '') : String(p.species || '')).toLowerCase().indexOf(q) === 0 || (q.length >= 4 && String(p.owner || '').toLowerCase().indexOf(q) === 0); }

  /* ---- markup ---- */
  function pill(p) { return '<span class="pill tier tier-' + (p.resurrected ? 'god' : TID[p.tier] || 'common') + '">' + esc((p.resurrected ? 'God' : TL[p.tier]) || '') + '</span>'; }
  function slotHtml(s, on) {
    var p = s.pet;
    return '<button type="button" class="pk2-slot' + (on ? ' live' : '') + (p ? '' : ' empty') + (s.locked ? ' locked' : '') + '" data-pk2slot="' + esc(s.key) + '"' + (s.locked ? ' aria-disabled="true"' : '') +
      ' aria-pressed="' + !!on + '" aria-label="' + esc(s.label + ': ' + (p ? (p.name || 'Pet') + ' #' + p.id + (s.locked ? '' : '. Tap to change') : 'empty. Tap, then pick a pet below')) + '">' +
      '<span class="pk2-sl">' + esc(s.label) + '</span>' +
      (p ? (s.art || '<span class="pk2-big" data-pk2sp="' + p.id + '"></span>') + '<b class="pk2-sn">' + esc(p.name || 'Pet') + '</b><span class="pk2-si">#' + p.id + ' ' + pill(p) + '</span>' + (s.sub ? '<span class="pk2-ss">' + s.sub + '</span>' : '')
        : '<span class="pk2-big pk2-q" aria-hidden="true">?</span><b class="pk2-sn">' + esc(s.empty || 'Tap a pet below') + '</b>') +
      (p && s.buddy ? '<span class="pk2-bud" title="Your buddy: the last pet you used. It comes with you to every place.">BUDDY</span>' : '') +
      (p && s.clear && !s.locked ? '<span class="pk2-x" data-pk2clear="' + esc(s.key) + '" role="button" tabindex="0" aria-label="Empty ' + esc(s.label) + '">✕</span>' : '') + '</button>';
  }
  function card(c, sel) {
    var p = c.p, why = c.why || '';
    return '<div class="pk2-cw"><button type="button" class="pk2-c t' + (p.tier | 0) + (sel ? ' on' : '') + (why ? ' no' : '') + '" data-pk2="' + esc(c.key || p.id) + '" data-pk2id="' + p.id + '"' + (why ? ' aria-disabled="true"' : '') +
      ' aria-pressed="' + !!sel + '" title="' + esc('#' + p.id + ' ' + (p.name || '') + (why ? ' · ' + why : '')) + '">' +
      (c.tag ? '<span class="pk2-tag' + (c.tagMe ? ' me' : '') + '">' + c.tag + '</span>' : '') +
      '<span class="pk2-sp" data-pk2sp="' + p.id + '"></span><b class="pk2-nm">' + esc(p.name || 'Pet') + '</b><span class="pk2-id">#' + p.id + (p.blackEye ? ' 🤕' : '') + '</span>' +
      (c.stat ? '<span class="pk2-st">' + c.stat + '</span>' : pill(p)) + (c.line ? '<span class="pk2-ln">' + c.line + '</span>' : '') +
      (why ? '<span class="pk2-why">✋ ' + esc(why) + '</span>' : sel ? '<span class="pk2-ok">✔ PICKED</span>' : '') + '</button>' +
      (c.noStar ? '' : '<button type="button" class="pk2-star' + (isFav(p.id) ? ' on' : '') + '" data-pk2star="' + p.id + '" aria-pressed="' + isFav(p.id) + '" aria-label="' + (isFav(p.id) ? 'Unstar' : 'Star') + ' #' + p.id + ' as a favorite">' + (isFav(p.id) ? '★' : '☆') + '</button>') + '</div>';
  }

  /** render(el, cfg, st): paints the whole picker into el.
   * cfg = { id, w, slots: [{key,label,pet,empty,buddy,locked,clear,sub,art}], mid, active, verdict: {big, small, tone: good|meh|bad|wait},
   *         prompt, shelves: [{id,label,hot,list:[{p,why,stat,line,tag,tagMe,key}],why,empty,top}], shelf, searchList, searchPh, selected,
   *         extra (html after the cards), onSlot(key), onClear(key), onShelf(id), onPick(item, slotKey), drop: [elements that take a dragged card] }
   * st = the caller's state object for this side (q, n); kept between paints. */
  function render(el, cfg, st) {
    if (!el) return; st = st || {}; if (!(st.n > 0)) st.n = PER;
    var spL = root.V2Rules && V2Rules.speciesLabel ? function (s) { return V2Rules.speciesLabel(s); } : null;
    var sh = cfg.shelves.filter(function (s) { return s.id === cfg.shelf; })[0] || cfg.shelves[0];
    var q = String(st.q || '').trim(), list = q ? (cfg.searchList || sh.list).filter(function (x) { return match(x.p, q, spL); }) : sh.list;
    var view = list.slice(0, st.n), selId = String(cfg.selected || '');
    var v = cfg.verdict || {};
    var h = '<div class="pk2" data-pk2id="' + esc(cfg.id) + '">' +
      '<div class="pk2-stage">' + slotHtml(cfg.slots[0], cfg.active === cfg.slots[0].key) + '<span class="pk2-mid" aria-hidden="true">' + esc(cfg.mid || 'VS') + '</span>' +
      (cfg.slots[1] ? slotHtml(cfg.slots[1], cfg.active === cfg.slots[1].key) : '') + '</div>' +
      (v.big ? '<div class="pk2-v ' + esc(v.tone || 'wait') + '" aria-live="polite"><b>' + v.big + '</b>' + (v.small ? '<span>' + v.small + '</span>' : '') + '</div>' : '') +
      '<div class="pk2-pick"><div class="pk2-pr">' + esc(cfg.prompt || '') + ' <span aria-hidden="true">⬇</span></div>' +
      '<div class="pk2-tabs" role="tablist" aria-label="Suggestions">' + cfg.shelves.map(function (s) { var on = s.id === sh.id && !q;
        return '<button type="button" role="tab" class="pk2-tab' + (on ? ' on' : '') + (s.hot ? ' hot' : '') + '" data-pk2shelf="' + esc(s.id) + '" aria-selected="' + on + '">' + s.label + '</button>'; }).join('') + '</div>' +
      '<p class="pk2-why0">' + (q ? 'Search: ' + fmt(list.length) + ' match' + (list.length === 1 ? '' : 'es') + ' for "' + esc(q) + '"' : (sh.why || '')) + '</p>' +
      '<label class="pk2-q"><span class="pk2-mag" aria-hidden="true">🔎</span><span class="pk2-vh">Search</span><input type="search" data-pk2q autocomplete="off" value="' + esc(st.q || '') + '" placeholder="' + esc(cfg.searchPh || 'Name, #number or species') + '"></label>' +
      (sh.top && !q ? sh.top : '') +
      '<div class="pk2-grid" role="list">' + (view.map(function (c) { return card(c, selId && String(c.key || c.p.id) === selId); }).join('') ||
        '<p class="pk2-empty">' + (q ? 'No pet matches. Try a name, a #number or a species.' : esc(sh.empty || 'No pets here yet.')) + '</p>') + '</div>' +
      (list.length > view.length ? '<button type="button" class="pk2-more" data-pk2more="1">Show ' + fmt(Math.min(PER, list.length - view.length)) + ' more · ' + fmt(list.length - view.length) + ' left</button>' : '') +
      (cfg.extra || '') + '</div></div>';
    el.innerHTML = h;
    sprites(el, cfg.w);
    var byKey = {}; list.slice(0, st.n).forEach(function (c) { byKey[String(c.key || c.p.id)] = c; });
    el.querySelectorAll('[data-pk2slot]').forEach(function (b) { b.onclick = function (e) { if (e.target.closest('[data-pk2clear]')) return; if (b.getAttribute('aria-disabled')) return; if (cfg.onSlot) cfg.onSlot(b.dataset.pk2slot); }; });
    el.querySelectorAll('[data-pk2clear]').forEach(function (b) { var go = function (e) { e.stopPropagation(); e.preventDefault(); if (cfg.onClear) cfg.onClear(b.dataset.pk2clear); }; b.onclick = go; b.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') go(e); }; });
    el.querySelectorAll('[data-pk2shelf]').forEach(function (b) { b.onclick = function () { st.q = ''; st.n = PER; if (cfg.onShelf) cfg.onShelf(b.dataset.pk2shelf); }; });
    el.querySelectorAll('[data-pk2star]').forEach(function (b) { b.onclick = function () { toggleFav(+b.dataset.pk2star); var on = isFav(+b.dataset.pk2star); b.classList.toggle('on', on); b.textContent = on ? '★' : '☆'; b.setAttribute('aria-pressed', String(on)); }; });
    var more = el.querySelector('[data-pk2more]'); if (more) more.onclick = function () { st.n += PER; if (cfg.onRedraw) cfg.onRedraw(); };
    var qi = el.querySelector('[data-pk2q]'); if (qi) qi.oninput = function () { st.q = qi.value; st.n = PER; var pos = qi.selectionStart; if (cfg.onRedraw) cfg.onRedraw(); var j = el.querySelector('[data-pk2q]'); if (j && j !== qi) { j.focus(); try { j.setSelectionRange(pos, pos); } catch (e) { } } };
    var tap = function (b, slotKey) { var c = byKey[b.dataset.pk2]; if (!c) return; if (c.why) { var u = U(); if (u && u.toast) u.toast('#' + c.p.id + ' can’t go yet: ' + c.why); return; } if (cfg.onPick) cfg.onPick(c, slotKey || null); };
    el.querySelectorAll('[data-pk2]').forEach(function (b) { b.onclick = function () { if (DR.moved) { DR.moved = false; return; } tap(b); }; b.addEventListener('pointerdown', function (e) { dragStart(e, b, el, cfg, tap); }); });
  }
  function sprites(el, w) { var R = root.V2Render; if (!R || !w) return; el.querySelectorAll('[data-pk2sp]').forEach(function (s) { if (s.firstChild) return; var p = w.byId && w.byId[s.getAttribute('data-pk2sp')]; if (!p) return;
    var c = document.createElement('canvas'); c.width = c.height = 32; c.className = 'sprite'; s.appendChild(c); if (R.lazy && R.petFrames) R.lazy(c, function () { return R.petFrames(p, w); }, true); }); }

  /* ---- drag a card onto a slot (or the place scene) with a mouse or pen. Tap still works: a drag only starts after the pointer moves 12px. ---- */
  var DR = { moved: false };
  function dragStart(e, b, el, cfg, tap) {
    if (e.button > 0 || e.pointerType === 'touch' || b.getAttribute('aria-disabled')) return; /* phones: tap only, so a finger always scrolls */ var x0 = e.clientX, y0 = e.clientY, ghost = null, on = null;
    var targets = function () { return [].slice.call(el.querySelectorAll('[data-pk2slot]:not([aria-disabled])')).concat((cfg.drop || []).filter(Boolean)); };
    var hit = function (x, y) { var t = document.elementFromPoint(x, y); if (!t) return null; var L = targets(); for (var i = 0; i < L.length; i++) if (L[i] === t || L[i].contains(t)) return L[i]; return null; };
    function move(ev) { var dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (!ghost) { if (Math.abs(dx) + Math.abs(dy) < 12) return;
        var cv = b.querySelector('canvas'); ghost = document.createElement('div'); ghost.className = 'pk2-ghost'; if (cv) { var g = document.createElement('canvas'); g.width = cv.width; g.height = cv.height; try { g.getContext('2d').drawImage(cv, 0, 0); } catch (er) { } ghost.appendChild(g); }
        document.body.appendChild(ghost); DR.moved = true; try { b.setPointerCapture(ev.pointerId); } catch (er) { } }
      ev.preventDefault(); ghost.style.transform = 'translate(' + (ev.clientX - 36) + 'px,' + (ev.clientY - 36) + 'px)';
      var t = hit(ev.clientX, ev.clientY); if (t !== on) { if (on) on.classList.remove('pk2-hot'); on = t; if (on) on.classList.add('pk2-hot'); } }
    function up(ev) { b.removeEventListener('pointermove', move); b.removeEventListener('pointerup', up); b.removeEventListener('pointercancel', up);
      if (!ghost) return; ghost.remove(); if (on) on.classList.remove('pk2-hot'); var t = ev.type === 'pointerup' ? hit(ev.clientX, ev.clientY) : null;
      if (t) tap(b, t.getAttribute('data-pk2slot') || null); setTimeout(function () { DR.moved = false; }, 0); }
    b.addEventListener('pointermove', move); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
  }

  var CSS = '.pk2{margin:8px 0;font-size:14px;color:#f3eefe}' +
    '.pk2-stage,.pk2-v{max-width:720px;margin-left:auto;margin-right:auto}.pk2-stage{position:relative;display:grid;grid-template-columns:minmax(0,1fr) 44px minmax(0,1fr);align-items:stretch;gap:4px;border:3px solid #000;box-shadow:4px 4px 0 #000;padding:12px 8px 8px;background:radial-gradient(circle at 50% 125%,#3a2a6b 0,#1e1638 70%)}' +
    '.pk2-slot{position:relative;display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 4px;min-height:176px;background:#120e22;border:3px solid #000;color:#f3eefe;font:inherit;cursor:pointer;min-width:0;text-align:center}' +
    '.pk2-slot:hover{border-color:#9fe8ff}.pk2-slot.locked{cursor:default}.pk2-slot.locked:hover{border-color:#000}' +
    '.pk2-slot.live{box-shadow:0 0 0 3px #ffd166,0 0 18px #ffd166;animation:pk2glow 1.1s ease-in-out infinite}@keyframes pk2glow{50%{box-shadow:0 0 0 3px #ffd166,0 0 4px #ffd166}}' +
    '.pk2-slot.pk2-hot,.pk2-hot{outline:4px solid #3ddc84;outline-offset:-2px}' +
    '.pk2-sl{font-family:"Press Start 2P",monospace;font-size:8px;color:#ffd166;letter-spacing:.5px}' +
    '.pk2-big{display:flex;align-items:center;justify-content:center;width:104px;height:104px}.pk2-big canvas{width:104px;height:104px;image-rendering:pixelated;display:block;border:2px solid #000;animation:pk2bob 1.6s ease-in-out infinite}' +
    '@keyframes pk2bob{50%{transform:translateY(-4px)}}.pk2-q{border:3px dashed #ffd166;font-family:Bangers,Impact,sans-serif;font-size:48px;color:#ffd166;box-sizing:border-box}' +
    '.pk2-sn{font-size:15px;line-height:1.1;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pk2-si{font-size:12px;color:#c9bff0}.pk2-si .pill{font-size:10px}.pk2-ss{font-size:12px;color:#9fe8ff;line-height:1.25}' +
    '.pk2-bud{position:absolute;top:-10px;left:-6px;background:#3ddc84;color:#04130a;border:2px solid #000;font-family:"Press Start 2P",monospace;font-size:7px;padding:3px 4px;transform:rotate(-6deg)}' +
    '.pk2-x{position:absolute;top:2px;right:2px;min-width:30px;min-height:30px;display:flex;align-items:center;justify-content:center;color:#c9bff0;font-size:14px;cursor:pointer}.pk2-x:hover{color:#fff}' +
    '.pk2-mid{align-self:center;justify-self:center;font-family:Bangers,Impact,sans-serif;font-size:30px;color:#ff5c8a;text-shadow:2px 2px 0 #000;animation:pk2zap 1.2s ease-in-out infinite}@keyframes pk2zap{0%,100%{transform:scale(1) rotate(-6deg)}50%{transform:scale(1.15) rotate(6deg)}}' +
    '.pk2-v{display:flex;flex-direction:column;gap:2px;text-align:center;margin:8px 0 0;padding:7px 10px;border:3px solid #000;box-shadow:3px 3px 0 #000;color:#140f24;background:#ffd166}.pk2-v b{font-family:Bangers,Impact,sans-serif;font-size:21px;letter-spacing:1px;line-height:1.05;font-weight:400}.pk2-v span{font-size:13px;font-weight:700}' +
    '.pk2-v.good{background:#3ddc84}.pk2-v.bad{background:#ff8fab}.pk2-v.meh{background:#ffd166}.pk2-v.wait{background:#c9bff0}' +
    '.pk2-pick{margin-top:10px;border:3px solid #000;background:#1b1530;box-shadow:4px 4px 0 #000;padding:8px}' +
    '.pk2-pr{font-family:"Press Start 2P",monospace;font-size:9px;color:#ffd166;line-height:1.6;margin:0 0 6px}.pk2-pr span{display:inline-block;animation:pk2nudge .9s ease-in-out infinite}@keyframes pk2nudge{50%{transform:translateY(3px)}}' +
    '.pk2-tabs{display:flex;gap:6px;overflow-x:auto;padding:0 2px 4px;-webkit-overflow-scrolling:touch}' +
    '.pk2-tab{flex:none;min-height:40px;padding:4px 12px;font:inherit;font-weight:700;font-size:14px;border:2px solid #000;border-radius:20px;background:#2b2350;color:#f3eefe;cursor:pointer;white-space:nowrap}' +
    '.pk2-tab.on{background:#3ddc84;color:#04130a}.pk2-tab.hot:not(.on){background:#ff9ad5;color:#2a1530}' +
    '.pk2-why0{margin:2px 0 6px;font-size:13px;color:#c9bff0}' +
    '.pk2-q{display:flex;align-items:center;gap:8px;background:#0e0a1c;border:2px solid #4b3f7a;padding:0 10px;min-height:44px;margin-bottom:8px}.pk2-q input{flex:1;min-width:0;background:transparent;border:0;color:#f3eefe;font:inherit;font-weight:700;font-size:15px;min-height:40px;outline:none}' +
    '.pk2-mag{font-size:16px;line-height:1;flex:none}.pk2-q:focus-within{border-color:#9fe8ff}.pk2-vh{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}' +
    '.pk2-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:8px}' +
    '.pk2-cw{position:relative;min-width:0}' +
    '.pk2-c{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 4px 6px;border:3px solid #4b3f7a;background:#2a1d14;color:#f3eefe;font:inherit;font-size:12px;line-height:1.2;box-shadow:3px 3px 0 #000;cursor:pointer;min-width:0;text-align:center;user-select:none;-webkit-user-select:none}' +
    '.pk2-c.t1{border-color:#3ddc84}.pk2-c.t2{border-color:#4aa8ff}.pk2-c.t3{border-color:#ffb020}.pk2-c:hover{transform:translateY(-2px)}' +
    '.pk2-c.on{background:#ffd166;color:#140f24;border-color:#000}.pk2-c.on .pk2-id,.pk2-c.on .pk2-st,.pk2-c.on .pk2-ln{color:#140f24}.pk2-c.no{opacity:.55;cursor:not-allowed}.pk2-c.no canvas{filter:grayscale(1)}.pk2-c.no:hover{transform:none}' +
    '.pk2-sp canvas{width:80px;height:80px;image-rendering:pixelated;display:block;border:2px solid #000}' +
    '.pk2-nm{font-size:14px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pk2-id{color:#b9b0d6}.pk2-st{font-family:"Press Start 2P",monospace;font-size:8px;color:#9fe8ff;line-height:1.5}.pk2-ln{color:#d9d2f0;font-size:11px;max-width:100%;overflow-wrap:anywhere}' +
    '.pk2-why{color:#ff9a9a;font-weight:700;font-size:11px}.pk2-ok{font-family:"Press Start 2P",monospace;font-size:7px;color:#140f24}' +
    '.pk2-tag{font-size:10px;font-weight:700;background:#4b3f7a;padding:1px 3px;max-width:100%;overflow-wrap:anywhere}.pk2-tag.me{background:#4fd18b;color:#0d1a12}' +
    '.pk2-star{position:absolute;top:2px;right:2px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:transparent;border:0;color:#c9bff0;font-size:18px;cursor:pointer;text-shadow:1px 1px 0 #000}.pk2-star.on{color:#ffd166}' +
    '.pk2-more{display:block;width:100%;margin-top:8px;min-height:44px;background:#1e1638;border:2px solid #4b3f7a;color:#ffd166;font-family:"Press Start 2P",monospace;font-size:9px;cursor:pointer}' +
    '.pk2-empty{grid-column:1/-1;margin:0;padding:14px;text-align:center;border:2px dashed #4b3f7a;color:#c9bff0}' +
    '.pk2-ghost{position:fixed;left:0;top:0;z-index:99999;pointer-events:none;width:72px;height:72px}.pk2-ghost canvas{width:72px;height:72px;image-rendering:pixelated;border:2px solid #ffd166;box-shadow:0 0 16px #ffd166}' +
    '.pk2 button:focus-visible,.pk2 input:focus-visible,.pk2-x:focus-visible{outline:3px solid #9fe8ff;outline-offset:2px}' +
    '@media (max-width:520px){.pk2-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.pk2-sp canvas{width:64px;height:64px}.pk2-nm{font-size:13px}.pk2-big,.pk2-big canvas{width:88px;height:88px}.pk2-slot{min-height:160px}.pk2-mid{font-size:24px}.pk2-stage{grid-template-columns:minmax(0,1fr) 30px minmax(0,1fr)}}' +
    '@media (prefers-reduced-motion:reduce){.pk2-slot.live,.pk2-big canvas,.pk2-mid,.pk2-pr span{animation:none}}';
  function css() { if (typeof document === 'undefined' || document.getElementById('pk2Css')) return; var s = document.createElement('style'); s.id = 'pk2Css'; s.textContent = CSS; (document.head || document.documentElement).appendChild(s); }
  css();
  root.V2Pick = { render: render, used: used, buddy: buddy, recent: recent, favOf: favOf, recentOf: recentOf, isFav: isFav, match: match, short: short, fmt: fmt, esc: esc, PER: PER };
})(typeof window !== 'undefined' ? window : this);
