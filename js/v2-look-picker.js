/* Look picker (owner 2026-10-24): choose which looks show on which pet. Memo pet:look:ID:CODE:on|off (QUEST_FREE_MIN, owner only, from block
 * ACTIVATE_LOOK_PICK_BLOCK). Every look a wallet owns can go on any pet it owns: flame looks (per-look pet limits), and quest / earned looks, which
 * are one wallet-held copy each (placing a copy on another pet moves it). Player names live ONLY in NAMES below (Flex Forge, owner 2026-10-24 9:37 PM CT). Three places: the pet page panel, the My Pets list, and
 * the Rare Room station (pet picker + batch). UI only: builds plans with V2Rules.lookPlans and hands them to the normal wallet send. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function fmt(n) { return Number(n).toLocaleString('en-US'); }
  function M() { return window.V2Mock; }
  function world() { try { return M() && M().world && M().world(); } catch (e) { return null; } }
  function tip(w) { try { return (M().state && M().state().tip) || w.tip; } catch (e) { return w && w.tip; } }
  function me() { return M() && M().ME; }
  var TYPE_NAME = { crown: 'Head', aura: 'Aura', wings: 'Back', skin: 'Skin', trail: 'Trail', laurels: 'Head', halo: 'Head', foil: 'Skin' };
  var KIND = { flame: '🔥 Flame look', quest: '🗺️ Quest look', earn: '🏅 Earned look' };
  /* Player-facing names, all in one place (swap here). Internal code names and the pet:look memo stay unchanged. */
  var NAMES = { feature: 'Flex Forge', panel: 'Flex Forge', list: 'My Flex', station: 'Flex Forge Station', wear: 'Forge it on', off: 'Take off', move: 'Move it', send: 'Seal the card', cancel: 'Not yet', undo: 'Never mind' };
  /* Card look picker fonts (self-hosted, SIL OFL 1.1, fonts/looks/): Jersey 10 for headings and buttons, VT323 for body text. Scoped to the look picker
   * UI only (.lp panel/list, #lookStation, .lp-modal confirm window); the rest of the site keeps its fonts. */
  var DH = '"XcpLook Jersey","Press Start 2P",monospace', DB = '"XcpLook VT323",ui-monospace,monospace';
  function css() { if ($('lpCss')) return; var s = document.createElement('style'); s.id = 'lpCss';
    s.textContent = '@font-face{font-family:"XcpLook Jersey";src:url(fonts/looks/jersey10.woff2) format("woff2");font-weight:400;font-style:normal;font-display:swap}' +
      '@font-face{font-family:"XcpLook VT323";src:url(fonts/looks/vt323.woff2) format("woff2");font-weight:400;font-style:normal;font-display:swap}' +
      '.lp,.lp-modal [role=dialog],#lookStation{font-family:' + DB + ';font-size:17px;line-height:1.25}.lp h3,.lp summary b,#lookStation h2,.lp-modal h3{font-family:' + DH + ';font-weight:400;letter-spacing:.5px}' +
      '.lp h3,.lp-modal h3{font-size:24px}.lp summary b{font-size:22px;color:#ffd166}#lookStation h2{font-size:30px}.lp-card b{font-family:' + DH + ';font-weight:400;font-size:19px}.lp .btn,.lp .q,.lp-tg,.lp-modal .btn,.lp-modal .q{font-family:' + DH + ';font-weight:400;font-size:17px;letter-spacing:.5px}' +
      '.lp small,.lp .small,.lp-modal .small,#lookStation .small{font-size:15px}.lp-note{font-size:16px!important}.lp-mv select{font-family:' + DB + ';font-size:15px!important}.lp code,.lp-modal code{font-family:' + DB + ';font-size:16px}' +
      '.lp{border:2px solid #4b3f7a;background:#120e22;padding:8px;margin:8px 0}.lp h3{color:#ffd166;margin:4px 0 8px}' +
      '.lp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}.lp-card{position:relative;display:flex;flex-direction:column;align-items:center;gap:3px;background:#1b1530;border:2px solid #4b3f7a;padding:6px;color:#eee;font-size:12px;text-align:center;box-shadow:2px 2px 0 #000}' +
      '.lp-card canvas{width:96px;height:96px;image-rendering:pixelated;background:#0b0816}.lp-card b{color:#ffd166}.lp-card small{color:#9fe8ff}.lp-card.on{border-color:#ffd166}.lp-card.chg{outline:2px dashed #7CFF6B;outline-offset:1px}.lp-card.no{opacity:.55}' +
      '.lp-tg{font-size:12px;padding:4px 10px;border:2px solid #000;background:#2b2350;color:#ffd166;cursor:pointer}.lp-card.on .lp-tg{background:#ffd166;color:#140f24}.lp-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px}' +
      '.lp-list{margin:6px 0 0;padding:0;list-style:none}.lp-list li{position:relative;display:flex;gap:8px;align-items:center;padding:4px 0;border-bottom:1px solid #2b2350;font-size:13px}.lp-list canvas{width:40px;height:40px;image-rendering:pixelated;background:#0b0816;flex:0 0 40px}' +
      '.lp-mv{display:inline-flex;flex-wrap:wrap;gap:4px;align-items:center;margin-top:3px}.lp-mv select{max-width:170px;font-size:12px;background:#1b1530;color:#eee;border:2px solid #4b3f7a}.lp-tg[disabled]{opacity:.5;cursor:not-allowed}.lp-note{font-size:12px;color:#9fe8ff;margin:6px 0}@media (max-width:520px){.lp-grid{grid-template-columns:repeat(2,1fr)}.lp-card canvas{width:80px;height:80px}}';
    /* collectible card feel: each look is a little trading card (foil frame, holo sheen when on); the confirm window is a card being sealed */
    s.textContent += '.lp-card{border-radius:8px;border:3px solid #6d5bd0;background:linear-gradient(160deg,#2a1f4d,#151027 60%,#22193f);box-shadow:3px 3px 0 #000,inset 0 0 0 2px #0b0816}' +
      '.lp-card canvas{border:2px solid #ffd166;border-radius:4px;background:radial-gradient(circle,#2b2350,#0b0816)}.lp-card.on{border-color:#ffd166;background:linear-gradient(135deg,#3a2a10,#1b1530 40%,#24304f 70%,#3a2a10)}' +
      '.lp-card.on::after{content:"";position:absolute;inset:0;border-radius:6px;pointer-events:none;background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.18) 45%,rgba(159,232,255,.15) 55%,transparent 70%)}' +
      '.lp-modal [role=dialog]{border:4px solid #ffd166!important;border-radius:12px;background:linear-gradient(160deg,#2a1f4d,#120e22 70%)!important;color:#eee!important;box-shadow:0 0 0 3px #000,6px 6px 0 #000}.lp-modal p,.lp-modal .small{color:#eee!important}.lp-modal .muted{color:#b8b0d8!important}.lp-modal b{color:#ffd166}.lp-modal h3{color:#ffd166;text-align:center;border-bottom:2px dashed #6d5bd0;padding-bottom:6px}' +
      '@media (prefers-reduced-motion:no-preference){.lp-card.on::after{animation:lpSheen 3.5s linear infinite;background-size:250% 100%}@keyframes lpSheen{0%{background-position:100% 0}100%{background-position:-150% 0}}}';
    document.head.appendChild(s); }
  /* realistic preview: the pet's own sprite with just this look drawn by js/v2-looks.js */
  /* one card per look code: several earned copies of the same look are counted together */
  function grouped(V, w, ME) { var G = {}, out = []; V.ownedLooks(w, ME).forEach(function (L) { var g = G[L.code];
      if (!g) { g = G[L.code] = { code: L.code, kind: L.kind, id: L.id, name: L.name, type: L.type, cap: L.cap, on: [], n: 0, srcs: [] }; out.push(g); }
      g.n++; if (L.src) g.srcs.push(L.src); L.on.forEach(function (i) { if (g.on.indexOf(i) < 0) g.on.push(i); }); }); return out; }
  function copies(L) { return L.kind === 'flame' ? '' : L.n > 1 ? ' · ' + L.n + ' copies' : L.srcs.length ? ' · from #' + L.srcs[0] : ''; }
  function preview(c, w, p, L) { try { var R = window.V2Render, fr = R.petFrames(p, w, { looks: L ? [L] : [], noHunger: true }); R.paint(c, fr[0]); } catch (e) { } }
  function lookFx(L) { return { id: L.id, type: L.type, name: L.name, kind: L.kind }; }
  function gateText(w) { var V = window.V2Rules, b = tip(w) + 1; return V.lookPickOn(b) ? '' : NAMES.feature + ' opens at block ' + fmt(V.lookPickGate()) + ' (about ' + Math.max(1, V.lookPickGate() - b) + ' blocks from now). Until then, this is a sneak peek at the looks you own.'; }
  function send(petId, ops, done) { var V = window.V2Rules, plans = V.lookPlans(petId, ops), ME = me(); if (!plans.length) return;
    var m = document.createElement('div'); m.className = 'qs-modal lp-modal'; m.innerHTML = '<div role="dialog" aria-modal="true"><h3>🃏 ' + esc(NAMES.feature) + ' for card #' + petId + '</h3><p class="small">' + ops.length + ' card change' + (ops.length === 1 ? '' : 's') + ' in ' + plans.length + ' burn' + (plans.length === 1 ? '' : 's') + ' of <b>' + Number(plans[0].amount).toLocaleString('en-US', { maximumFractionDigits: 8 }) + ' XCPETS</b> each:</p>' +
      plans.map(function (pl) { return '<p class="small"><code>' + esc(pl.tag) + '</code></p>'; }).join('') + '<p class="small muted">The game reads each burn from the chain. A change that fails its check when it confirms is skipped; if every change in a burn fails, that burn becomes community food.</p><p><button class="q" data-x>' + NAMES.cancel + '</button> <button class="btn" data-go>✨ ' + NAMES.send + '</button></p></div>';
    document.body.appendChild(m); m.onclick = function (e) { if (e.target === m) m.remove(); }; m.querySelector('[data-x]').onclick = function () { m.remove(); };
    m.querySelector('[data-go]').onclick = function () { m.remove(); if (!window.V2Wallet || !ME) { alert('Connect the owner wallet first.'); return; }
      plans.reduce(function (pr, pl) { return pr.then(function () { return window.V2Wallet.send(pl, ME); }); }, Promise.resolve()).then(function () { if (done) done(true); }, function (e) { if (done) done(false, e); }); }; return m; }
  /* panel(el, w, p, ME): every look the wallet owns, previewed on pet p, each with an on/off toggle; changes are batched */
  function panel(el, w, p, ME, opt) { var V = window.V2Rules; opt = opt || {}; css();
    var owned = grouped(V, w, ME), st = el.__lp && el.__lp.pid === p.id ? el.__lp : (el.__lp = { pid: p.id, want: {} });
    var isOn = function (L) { return L.on.indexOf(p.id) >= 0; }, want = function (L) { return st.want[L.code] == null ? isOn(L) : st.want[L.code]; };
    var ops = owned.filter(function (L) { return want(L) !== isOn(L); }).map(function (L) { return { code: L.code, on: want(L) }; });
    var where = function (L) { return L.on.length ? 'on ' + L.on.map(function (i) { return '#' + i; }).join(', ') : 'not on a pet'; };
    var h = '<div class="lp" id="' + (opt.id || '') + '"><h3>🃏 ' + esc(NAMES.panel) + ' · card #' + p.id + ' ' + esc(p.name || '') + '</h3>' + (gateText(w) ? '<p class="lp-note">' + esc(gateText(w)) + '</p>' : '') +
      (owned.length ? '<div class="lp-grid">' + owned.map(function (L, i) { var on = want(L), cap = L.kind === 'flame' ? (L.cap ? ' · up to ' + L.cap + ' pet' + (L.cap === 1 ? '' : 's') : '') : L.n > 1 ? ' · one pet each' : '';
        var hint = !on || isOn(L) ? '' : L.kind === 'flame' ? (L.cap && L.on.length >= L.cap ? (L.cap === 1 ? 'moves here from #' + L.on[0] : 'already on ' + L.cap + ' pets; take it off one first') : '') : (L.on.length >= L.n ? 'moves here from #' + L.on[0] : '');
        return '<div class="lp-card' + (on ? ' on' : '') + (on !== isOn(L) ? ' chg' : '') + '"><canvas width="32" height="32" data-i="' + i + '"></canvas><b>' + esc(L.name) + '</b><small>' + KIND[L.kind] + copies(L) + cap + '</small><small>Now ' + esc(where(L)) + '</small>' +
          (hint ? '<small style="color:#7CFF6B">' + esc(hint) + '</small>' : '') + '<button type="button" class="lp-tg" data-code="' + L.code + '" aria-pressed="' + on + '">' + (on ? NAMES.off : NAMES.wear) + '</button></div>'; }).join('') + '</div>'
        : '<p class="lp-note">Your closet is empty. Burn for flame looks, go questing, or earn looks with this pet to decorate its card.</p>') +
      '<div class="lp-bar"><button type="button" class="btn" data-send' + (ops.length && V.lookPickOn(tip(w) + 1) ? '' : ' disabled') + '>Send ' + ops.length + ' card change' + (ops.length === 1 ? '' : 's') + (ops.length ? ' (' + V.lookPlans(p.id, ops).length + ' burn' + (V.lookPlans(p.id, ops).length === 1 ? '' : 's') + ')' : '') + '</button>' +
      (ops.length ? '<button type="button" class="q" data-reset>' + NAMES.undo + '</button>' : '') + '<span class="small muted">One look of each kind per pet: a new one swaps out the old on the card.</span></div></div>';
    el.innerHTML = h;
    el.querySelectorAll('canvas[data-i]').forEach(function (c) { preview(c, w, p, lookFx(owned[+c.dataset.i])); });
    el.querySelectorAll('.lp-tg').forEach(function (b) { b.onclick = function () { var L = owned.filter(function (x) { return x.code === b.dataset.code; })[0]; st.want[L.code] = !want(L); panel(el, w, p, ME, opt); }; });
    var r = el.querySelector('[data-reset]'); if (r) r.onclick = function () { st.want = {}; panel(el, w, p, ME, opt); };
    el.querySelector('[data-send]').onclick = function () { send(p.id, ops, function (ok) { if (ok) { st.want = {}; } }); };
    return { owned: owned.length, ops: ops }; }
  /* one-tap move row for My Looks: a pet menu (pets this look is not on) + Move, and Off when it is on a pet */
  function moveRow(w, ME, L, i) { var V = window.V2Rules, open = V.lookPickOn(tip(w) + 1), pets = w.pets.filter(function (q) { return q.owner === ME && !q.dead && !q.released && !q.community && L.on.indexOf(q.id) < 0; }).sort(function (a, b) { return a.id - b.id; });
    if (!pets.length && !L.on.length) return '';
    var full = L.kind === 'flame' && L.cap > 1 && L.on.length >= L.cap;
    return '<span class="lp-mv">' + (pets.length ? '<select data-mvs="' + i + '" aria-label="Move ' + esc(L.name) + ' to">' + pets.slice(0, 300).map(function (q) { return '<option value="' + q.id + '">#' + q.id + (q.name ? ' ' + esc(q.name) : '') + '</option>'; }).join('') + '</select> <button type="button" class="lp-tg" data-mv="' + i + '"' + (open && !full ? '' : ' disabled') + '>' + (L.on.length ? NAMES.move : NAMES.wear) + '</button>' : '') +
      (L.on.length ? ' <button type="button" class="lp-tg" data-off="' + i + '"' + (open ? '' : ' disabled') + '>' + NAMES.off + '</button>' : '') + (full ? ' <small class="muted">on ' + L.cap + ' pets: take it off one first</small>' : '') + '</span>'; }
  /* My Looks list: each owned look and where it is now */
  function myLooks(el, w, ME) { var V = window.V2Rules; css(); var owned = grouped(V, w, ME);
    el.innerHTML = '<details class="lp shop-fold" open><summary><b>🃏 ' + esc(NAMES.list) + ' (' + owned.length + ')</b> · who is wearing what</summary>' + (gateText(w) ? '<p class="lp-note">' + esc(gateText(w)) + '</p>' : '') +
      (owned.length ? '<ul class="lp-list">' + owned.map(function (L, i) { return '<li><canvas width="32" height="32" data-i="' + i + '"></canvas><span><b style="color:#ffd166">' + esc(L.name) + '</b> <small class="muted">' + KIND[L.kind] + copies(L) + '</small><br>' +
        (L.on.length ? 'On ' + L.on.slice(0, 6).map(function (id) { var q = w.byId[id]; return '<a href="pet.html?id=' + id + '#looks">#' + id + (q && q.name ? ' ' + esc(q.name) : '') + '</a>'; }).join(', ') + (L.on.length > 6 ? ' and ' + (L.on.length - 6) + ' more' : '') : '<span class="muted">Not on a card yet</span>') + (L.kind === 'flame' && L.cap ? ' <small class="muted">(up to ' + L.cap + ' pets)</small>' : '') + '<br>' + moveRow(w, ME, L, i) + '</span></li>'; }).join('') + '</ul>' +
        '<p class="lp-note">' + NAMES.move + ': pick a pet and tap ' + NAMES.move + ' (one burn). ' + NAMES.off + ' takes it off every card. For several changes at once use a pet\'s ' + NAMES.panel + ' or the ' + NAMES.station + ' in The Rare Room.</p>' : '<p class="lp-note">No looks yet. Go earn some!</p>') + '</details>';
    el.querySelectorAll('[data-mv]').forEach(function (b) { b.onclick = function () { var L = owned[+b.dataset.mv], sel = el.querySelector('select[data-mvs="' + b.dataset.mv + '"]'), to = sel && +sel.value; if (!to) return; send(to, [{ code: L.code, on: true }]); }; });
    el.querySelectorAll('[data-off]').forEach(function (b) { b.onclick = function () { var L = owned[+b.dataset.off]; L.on.forEach(function (pid) { send(pid, [{ code: L.code, on: false }]); }); }; });
    el.querySelectorAll('canvas[data-i]').forEach(function (c) { var L = owned[+c.dataset.i], p = w.byId[L.on[0]] || w.pets.filter(function (q) { return q.owner === ME && !q.dead && !q.released; })[0]; if (p) preview(c, w, p, lookFx(L)); }); }
  /* Rare Room Looks station: pick one of your pets (shared picker + sort menu), then the panel for it */
  function station(el, w, ME) { css(); if (!el.__st) el.__st = { pid: 0 }; var S = el.__st, live = w.pets.filter(function (p) { return p.owner === ME && !p.dead && !p.released && !p.community; });
    if (!S.pid && live[0]) { var sc = function (p) { var r = window.PetScore && PetScore.of(w, p); return (V2Rules.shownLooks(w, p).length * 1e5) + (r ? r.score : 0); }; S.pid = live.slice().sort(function (a, b) { return sc(b) - sc(a) || a.id - b.id; })[0].id; } /* start on the pet already wearing the most looks, then the best Pet Score */
    el.innerHTML = '<h2 class="sec" data-ico="gear">🃏 ' + esc(NAMES.station) + '</h2><p class="small muted">Pick a pet, then decorate its card with any look you own. All changes go out together.</p><div id="lpPick"></div><div id="lpBody"></div>';
    if (window.V2Picker) V2Picker.mount($('lpPick'), { id: 'looks', w: w, me: ME, noWho: true, dir: true, sorts: ['score', 'rarity', 'power', 'newest'], selected: S.pid,
      records: function () { return live.map(function (p) { return { key: p.id, pets: [p], newest: p.hatchBlock || p.id, html: V2Picker.petChip(w) }; }); },
      onPick: function (r) { S.pid = r.key; station(el, w, ME); } });
    var p = w.byId[S.pid]; if (p) panel($('lpBody'), w, p, ME, { id: 'lpStation' }); else $('lpBody').innerHTML = '<p class="lp-note">No living pets to dress up in this wallet.</p>'; }
  var keys = {};
  function tick() { var V = window.V2Rules, w = world(), ME = me(); if (!V || !V.ownedLooks || !w || !w.byId) return;
    var k = [w.tip, ME, w.lookCopies ? Object.keys(w.lookCopies).length : 0, !!window.V2Looks, ME ? V.ownedLooks(w, ME).map(function (L) { return L.code + L.on.join('.'); }).join() : ''].join('|'), page = document.body.getAttribute('data-split'), id = Number(new URLSearchParams(location.search).get('id'));
    if (/pet\.html/.test(location.pathname) && id) { var p = w.byId[id], anchor = $('questCard') || $('starveWarn') || $('facts'), el = $('lookPanel');
      if (!p || !ME || p.owner !== ME || p.dead || p.released) { if (el) el.remove(); }
      else if (anchor && keys.pet !== k + id) { keys.pet = k + id; if (!el) { el = document.createElement('section'); el.id = 'lookPanel'; el.className = 'panel'; anchor.parentNode.insertBefore(el, anchor.nextSibling); } panel(el, w, p, ME, { id: 'looks' }); } }
    var pp = $('petsPanel'); if (pp && ME && page === 'play' && keys.my !== k) { keys.my = k; var ml = $('myLooks'); if (!ml) { ml = document.createElement('div'); ml.id = 'myLooks'; pp.appendChild(ml); } /* below the pet list (owner 2026-10-27: pets first) */ myLooks(ml, w, ME); }
    var inv = $('invPanel'); if (inv && ME && page === 'rare' && keys.rr !== k) { keys.rr = k; var s = $('lookStation'); if (!s) { s = document.createElement('section'); s.id = 'lookStation'; s.className = 'panel shop8 split-keep'; inv.parentNode.insertBefore(s, inv.nextSibling); } station(s, w, ME); } }
  if (typeof document !== 'undefined') { setInterval(tick, 3000); if (document.readyState !== 'loading') setTimeout(tick, 600); else document.addEventListener('DOMContentLoaded', function () { setTimeout(tick, 600); }); }
  window.V2LookPicker = { panel: panel, myLooks: myLooks, station: station, tick: function () { keys = {}; tick(); } };
})();
