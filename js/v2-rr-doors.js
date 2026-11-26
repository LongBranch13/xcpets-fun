/* XCPETS Rare Room doors (rare-room-rethink part 2, Jake Nov 23 2026: "maybe the rare room needs to change a lot"; picked "Both, one shared drawer").
 * Display only, no rule change, nothing is signed. Under the room picture three doors split the page into one simple screen each:
 *   🎡 SPIN   = the Pepe Wheel (spin, free spins, lucky drops): the existing #pepeWheel / statline, unchanged.
 *   👕 CLOSET = new: the mirror pet + "Best upgrades for you" across all your pets + your gear by slot with counts.
 *              Every Dress / Wear opens the shared drawer (js/v2-dress.js, V2Dress), the same one the My Pets cards use.
 *              The old "gear that fits" grid and the Dress up button are hidden (the drawer replaces them); More gear tools and the stash stay here.
 *   🃏 FLEX   = Flex Forge (#lookStation), unchanged.
 * Door from the address: #spin #closet #flex; #rare-room-ID (from a pet page or the drawer's Spin for gear) = Spin with that pet;
 * #dressing-room (the room's mirror and door) = Closet + the drawer; #lookStation = Flex. Last door is remembered (localStorage). */
(function () {
  'use strict';
  var d = document, KEY = 'xcpets-rr-door', DOORS = [['spin', '🎡', 'SPIN'], ['closet', '👕', 'CLOSET'], ['flex', '🃏', 'FLEX']];
  function $(id) { return d.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function on() { return d.body && d.body.getAttribute('data-split') === 'rare'; }
  function U() { return window.V2UI; }
  function D() { return window.V2Dress; }
  function ok() { var u = U(), x = D(); return !!(u && x && x.ready && x.ready() && u.world && u.world()); }
  function lsGet() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function lsSet(v) { try { localStorage.setItem(KEY, v); } catch (e) { } }
  var fmt = (function () { var f = null; return function (n) { try { f = f || new Intl.NumberFormat('en-US'); return f.format(n); } catch (e) { return String(n); } }; })();
  var ST = { door: null, pet: null, slot: 'head', find: '', ups: null, upsKey: null, upsBusy: 0, more: false };

  /* ---- doors */
  function fromHash() { var h = (location.hash || '').slice(1); if (h === 'spin' || h === 'closet' || h === 'flex') return h; if (/^rare-room-\d+$/.test(h)) return 'spin'; if (h === 'lookStation' || /^flex-\d+$/.test(h)) return 'flex'; if (h === 'dressing-room') return 'closet'; return null; }
  function setDoor(k, push) { if (!k) return; ST.door = k; lsSet(k); var b = d.body; DOORS.forEach(function (x) { b.classList.toggle('rrd-' + x[0], x[0] === k); });
    var nav = $('rrDoors'); if (nav) nav.querySelectorAll('[data-door]').forEach(function (a) { var y = a.getAttribute('data-door') === k; a.classList.toggle('on', y); a.setAttribute('aria-selected', String(y)); });
    if (push) try { history.replaceState(history.state, '', '#' + k); } catch (e) { }
    if (k === 'closet') closet(); }
  function counts() { var nav = $('rrDoors'); if (!nav || !ok()) return; var u = U(), w = u.world(), V = window.V2Rules, ME = u.ME, sp = '', cl = '';
    try { var tip = (w.tip || 0) + 1; if (V.spinsLeft) { var n = V.spinsLeft(w, ME, tip, u.myPendingTags ? u.myPendingTags() : []) || 0; sp = n ? fmt(n) + ' free spin' + (n === 1 ? '' : 's') : 'new gear'; } } catch (e) { sp = 'new gear'; }
    try { var L = (w.itemList || []).filter(function (g) { return g.owner === ME; }), f = L.filter(function (g) { return g.on == null; }).length; cl = L.length ? fmt(f) + ' spare of ' + fmt(L.length) : 'your gear'; } catch (e) { cl = 'your gear'; }
    var t = { spin: sp || 'new gear', closet: cl, flex: 'card looks' }; Object.keys(t).forEach(function (k) { var s = nav.querySelector('[data-door="' + k + '"] .rrd-sub'); if (s && s.textContent !== t[k]) s.textContent = t[k]; }); }
  function build() { var sc = $('shopScene'); if (!sc || $('rrDoors')) return !!$('rrDoors');
    var nav = d.createElement('nav'); nav.id = 'rrDoors'; nav.className = 'rrd-bar'; nav.setAttribute('role', 'tablist'); nav.setAttribute('aria-label', 'The Rare Room: pick a door');
    nav.innerHTML = DOORS.map(function (x) { return '<a href="#' + x[0] + '" role="tab" class="rrd-door rrd-d-' + x[0] + '" data-door="' + x[0] + '" aria-selected="false"><span class="rrd-ic" aria-hidden="true">' + x[1] + '</span><span class="rrd-lab">' + x[2] + '</span><span class="rrd-sub">…</span></a>'; }).join('');
    sc.parentNode.insertBefore(nav, sc.nextSibling);
    var cl = d.createElement('div'); cl.id = 'rrCloset'; cl.className = 'rrc'; cl.setAttribute('role', 'tabpanel'); cl.setAttribute('aria-label', 'Closet'); nav.parentNode.insertBefore(cl, $('shopCounter') || nav.nextSibling);
    nav.addEventListener('click', function (e) { var a = e.target.closest('[data-door]'); if (!a) return; e.preventDefault(); setDoor(a.getAttribute('data-door'), true); var p = $('rrDoors'); if (p && p.getBoundingClientRect().top < 0) p.scrollIntoView({ block: 'start' }); });
    cl.addEventListener('click', act); cl.addEventListener('input', function (e) { if (e.target.id === 'rrcFind') { ST.find = e.target.value; drawFind(); } });
    d.body.classList.add('rrd-on'); return true; }

  /* ---- closet */
  function mine(w) { return U().mine(w).filter(function (p) { return !p.dead && !p.released; }); }
  function mirrorPet(w) { var id = ST.pet; if (id == null) { try { var s = window.V2Shop && V2Shop._state && V2Shop._state(); id = s && (s.pet != null ? s.pet : s.rollPet); } catch (e) { } }
    var p = id != null && w.byId[id]; if (p && !p.dead && p.owner === U().ME) return p; if (ST.ups && ST.ups.length) return ST.ups[0].p; var L = mine(w); L.sort(function (a, b) { return (b.stage || 0) - (a.stage || 0) || (b.tier || 0) - (a.tier || 0) || a.id - b.id; }); return L[0] || null; }
  /* best upgrades across all your pets: V2Dress.plan per pet, worked out 400 pets per slice so a 9k-pet wallet never freezes the page */
  function ups(w, then) { var ix = D().index(w); if (ST.upsKey === ix && ST.ups) return then(ST.ups); if (ST.upsBusy) return; var L = mine(w), out = [], i = 0, tok = ST.upsBusy = (ST.upsBusy || 0) + 1;
    (function step() { if (ST.upsBusy !== tok) return; var end = Math.min(L.length, i + 400); for (; i < end; i++) { var pl = D().plan(w, L[i]); if (pl.gain > 0) out.push({ p: L[i], gain: pl.gain, n: pl.n, now: pl.now, by: pl.by }); }
      if (i < L.length) return setTimeout(step, 0); out.sort(function (a, b) { return b.gain - a.gain || (b.p.stage || 0) - (a.p.stage || 0) || a.p.id - b.p.id; }); ST.ups = out; ST.upsKey = ix; ST.upsBusy = 0; then(out); })(); }
  function sprite(cv, p, w) { try { var R = window.V2Render; R.lazy(cv, function () { return R.petFrames(p, w); }); } catch (e) { } }
  function closet() { var el = $('rrCloset'); if (!el || !on() || ST.door !== 'closet') return; if (!ok()) { el.innerHTML = '<p class="small muted">Reading your gear from the chain…</p>'; return; }
    var u = U(), w = u.world(); if (U().viewOnly && U().viewOnly()) { el.innerHTML = '<p class="small muted">View only: connect the wallet that owns these pets to dress them. Your gear is listed below.</p>' + gearHtml(w, null); bindSprites(el, w); return; }
    ups(w, function () { draw(w); }); if (!ST.ups || ST.upsKey !== D().index(w)) draw(w); }
  function draw(w) { var el = $('rrCloset'); if (!el) return; var P = mirrorPet(w), X = D(), h = '';
    if (!P) { el.innerHTML = '<p class="small">Hatch a pet first, then come back to dress it.</p>' + gearHtml(w, null); return; }
    var pl = X.plan(w, P), total = (ST.ups || []).reduce(function (s, x) { return s + x.gain; }, 0), nUp = (ST.ups || []).length;
    h += '<div class="rrc-mirror"><div class="rrc-glass"><canvas width="32" height="32" data-pid="' + P.id + '" role="img" aria-label="#' + P.id + ' in the mirror"></canvas></div><div class="rrc-mi">' +
      '<button type="button" class="q rrc-pet" data-rc="pick" aria-expanded="' + !!ST.picking + '">#' + P.id + ' ' + esc(P.name || '') + ' · change pet ▾</button>' +
      '<div class="rrc-pow">⚔ ' + pl.now + (pl.gain ? ' → <b class="pos">' + (pl.now + pl.gain) + '</b> <small>in its best gear</small>' : ' <small>wearing the best you own</small>') + '</div>' +
      '<button type="button" class="btn rrc-dress" data-dress="' + P.id + '">👕 Dress #' + P.id + (pl.gain ? ' · +' + pl.gain : '') + '</button></div></div>';
    h += '<div class="rrc-find"' + (ST.picking ? '' : ' hidden') + '><label class="small">Find a pet <input type="search" id="rrcFind" placeholder="#12 or a name" value="' + esc(ST.find) + '" autocomplete="off"></label><div class="rrc-chips" id="rrcChips"></div></div>';
    h += '<section class="rrc-ups" aria-label="Best upgrades for you"><div class="rrc-uh"><h3>Best upgrades for you</h3><span class="small">' + (ST.ups ? nUp ? fmt(nUp) + ' pet' + (nUp === 1 ? '' : 's') + ' can wear better spare gear' : 'every pet wears the best spare gear you own' : 'checking your pets…') + '</span></div>' +
      (ST.ups || []).slice(0, ST.more ? 30 : 5).map(function (x) { var sl = Object.keys(x.by), first = sl[0] && x.by[sl[0]];
        return '<div class="rrc-up"><canvas width="32" height="32" data-pid="' + x.p.id + '" aria-hidden="true"></canvas><div class="rrc-ut"><b>#' + x.p.id + ' ' + esc(x.p.name || '') + '</b><small>' + (first ? esc(X.label(first.g.item)) + ' in ' + esc(X.slotName(sl[0])) + (sl.length > 1 ? ' + ' + (sl.length - 1) + ' more' : '') : '') + '</small></div><span class="rrc-g">+' + x.gain + '</span><button type="button" class="btn rrc-go" data-dress="' + x.p.id + '">Dress</button></div>'; }).join('') +
      (nUp > 5 ? '<button type="button" class="q rrc-more" data-rc="more">' + (ST.more ? 'Show fewer' : 'Show ' + Math.min(25, nUp - 5) + ' more') + '</button>' : '') +
      (nUp ? '<button type="button" class="btn ico-flame rrc-all" data-rc="all">⚡ Dress all ' + fmt(nUp) + ' · +' + fmt(total) + ' gear power <span class="cost">free</span></button>' : '') + '</section>';
    h += gearHtml(w, P);
    el.innerHTML = h; bindSprites(el, w); if (ST.picking) drawFind(); }
  function bindSprites(el, w) { el.querySelectorAll('canvas[data-pid]').forEach(function (c) { var p = w.byId[+c.getAttribute('data-pid')]; if (p) sprite(c, p, w); }); }
  /* your gear by slot: a tab per slot with counts, then one tile per piece kind (copies, spare, who wears it, what it adds on the mirror pet) */
  function gearHtml(w, P) { var u = U(), X = D(), V = window.V2Rules, ME = u.ME, SL = (V.V2_SLOTS || ['head', 'hand', 'body', 'back', 'face', 'feet']).slice(), by = {}, tot = 0, spare = 0;
    (w.itemList || []).forEach(function (g) { if (g.owner !== ME) return; var it = (V.GEAR_BY_ID || {})[g.item]; if (!it) return; var s = it.slot; if (SL.indexOf(s) < 0) SL.push(s); var o = (by[s] = by[s] || {}), k = o[g.item] = o[g.item] || { id: g.item, n: 0, spare: 0, on: [], tier: it.tier || 0 }; k.n++; tot++; if (g.on == null) { k.spare++; spare++; } else k.on.push(g.on); });
    if (!tot) return '<section class="rrc-gear"><h3>Your gear</h3><p class="small">No gear yet. Open the 🎡 Spin door and spin the Pepe Wheel.</p></section>';
    if (!by[ST.slot]) ST.slot = SL.filter(function (s) { return by[s]; })[0];
    var cur = P ? (V.wornOf(w, P.id) || []).filter(function (g) { return (g.slot || ((V.GEAR_BY_ID || {})[g.item] || {}).slot) === ST.slot; })[0] : null, floor = cur ? X.dmg(cur.item) : 0, slotOpen = P ? X.slotsOf(P).indexOf(ST.slot) >= 0 : false;
    var h = '<section class="rrc-gear" aria-label="Your gear by slot"><div class="rrc-uh"><h3>Your gear</h3><span class="small">' + fmt(tot) + ' pieces · ' + fmt(spare) + ' spare</span></div><div class="rrc-tabs" role="tablist">' +
      SL.filter(function (s) { return by[s]; }).map(function (s) { var n = Object.keys(by[s]).reduce(function (a, k) { return a + by[s][k].n; }, 0); return '<button type="button" role="tab" class="rrc-tab' + (s === ST.slot ? ' on' : '') + '" aria-selected="' + (s === ST.slot) + '" data-slot="' + s + '">' + esc(X.slotName(s)) + ' <b>' + fmt(n) + '</b></button>'; }).join('') + '</div>';
    var L = Object.keys(by[ST.slot] || {}).map(function (k) { return by[ST.slot][k]; }).sort(function (a, b) { return b.tier - a.tier || b.spare - a.spare || (a.id < b.id ? -1 : 1); }), shown = L.slice(0, ST.allGear ? 400 : 48);
    h += (P ? '<p class="small rrc-hint">' + (slotOpen ? 'Green = makes #' + P.id + ' stronger. Tap a piece to try it on #' + P.id + '.' : esc(X.slotName(ST.slot)) + ' is still locked on #' + P.id + ': it opens as the pet grows.') + '</p>' : '') + '<div class="rrc-grid">' + shown.map(function (k) {
      var fit = P && slotOpen && k.spare && k.id !== (cur && cur.item) ? V.equipCheck(w, ME, P.id, k.id) : null, df = fit && fit.ok ? X.dmg(k.id) - floor : null, wearing = cur && cur.item === k.id;
      var where = wearing ? 'on #' + P.id : k.spare ? fmt(k.spare) + ' spare' + (k.on.length ? ' · ' + fmt(k.on.length) + ' worn' : '') : 'on ' + k.on.slice(0, 2).map(function (x) { return '#' + x; }).join(', ') + (k.on.length > 2 ? ' +' + (k.on.length - 2) : '');
      return '<button type="button" class="rrc-pc' + (df > 0 ? ' up' : '') + (wearing ? ' worn' : '') + '" data-pc="' + esc(k.id) + '"' + (P ? '' : ' disabled') + '>' + X.iconHtml(k.id, 28) + '<span class="rrc-pn">' + esc(X.label(k.id)) + (k.n > 1 ? ' ×' + k.n : '') + '</span><span class="rrc-ps">' + X.stars(k.id) + '</span>' +
        (df != null ? '<em class="' + (df > 0 ? 'pos' : df < 0 ? 'neg' : '') + '">' + (df > 0 ? '+' : '') + df + '</em>' : '') + '<small>' + esc(where) + '</small></button>'; }).join('') + '</div>' +
      (L.length > shown.length ? '<button type="button" class="q rrc-more" data-rc="allgear">Show all ' + fmt(L.length) + '</button>' : '') + '</section>';
    return h; }
  function drawFind() { var box = $('rrcChips'); if (!box || !ok()) return; var w = U().world(), q = ST.find.trim().toLowerCase().replace(/^#/, ''), L;
    if (!q) L = (ST.ups || []).slice(0, 8).map(function (x) { return x.p; }); else L = mine(w).filter(function (p) { return String(p.id).indexOf(q) === 0 || String(p.name || '').toLowerCase().indexOf(q) >= 0; }).slice(0, 12);
    if (!L.length && !q) L = mine(w).sort(function (a, b) { return (b.stage || 0) - (a.stage || 0) || (b.tier || 0) - (a.tier || 0); }).slice(0, 8);
    box.innerHTML = L.length ? L.map(function (p) { return '<button type="button" class="q rrc-chip" data-pick="' + p.id + '"><canvas width="32" height="32" data-pid="' + p.id + '" aria-hidden="true"></canvas>#' + p.id + ' ' + esc(String(p.name || '').slice(0, 14)) + '</button>'; }).join('') : '<span class="small">No pet matches.</span>'; bindSprites(box, w); }
  function act(e) { var b = e.target.closest('button'); if (!b || !$('rrCloset').contains(b)) return; var w = U().world(), X = D(), ds = b.dataset;
    if (ds.dress) return X.open(+ds.dress);
    if (ds.pick) { ST.pet = +ds.pick; ST.picking = false; ST.find = ''; try { var s = V2Shop._state(); s.pet = ST.pet; } catch (er) { } return draw(w); }
    if (ds.slot) { ST.slot = ds.slot; ST.allGear = false; return draw(w); }
    if (ds.pc) { var P = mirrorPet(w); if (P) X.open(P.id, { slot: (window.V2Rules.GEAR_BY_ID[ds.pc] || {}).slot || ST.slot }); return; }
    if (ds.rc === 'pick') { ST.picking = !ST.picking; draw(w); var f = $('rrcFind'); if (f && ST.picking) try { f.focus({ preventScroll: true }); } catch (er) { } return; }
    if (ds.rc === 'more') { ST.more = !ST.more; return draw(w); }
    if (ds.rc === 'allgear') { ST.allGear = true; return draw(w); }
    if (ds.rc === 'all') { X.dressAll(); ST.ups = null; setTimeout(closet, 600); } }

  /* ---- the room's mirror and door open the drawer here (they used to switch the page into #dressing-room) */
  function onHash() { var h = location.hash; if (h === '#dressing-room') { var pid = null; try { var s = V2Shop._state(); pid = s.pet != null ? s.pet : s.mpId; } catch (e) { }
      setDoor('closet', false); try { history.replaceState(null, '', '#closet'); window.dispatchEvent(new HashChangeEvent('hashchange')); } catch (e) { }
      if (pid != null && D()) { ST.pet = +pid; try { V2Shop._state().pet = +pid; } catch (e) { } D().open(+pid); } return; }
    var k = fromHash(); if (k && k !== ST.door) setDoor(k, false); }
  var CSS = 'body.rrd-on #rrFits,body.rrd-on #drEnter{display:none!important}' +
    'body.rrd-on:not(.rrd-spin) #shopCounter,body.rrd-on:not(.rrd-spin) #pepeWheel,body.rrd-on:not(.rrd-spin) #invPanel .statline,body.rrd-on:not(.rrd-spin) #tokList,body.rrd-on:not(.rrd-spin) #crates,body.rrd-on:not(.rrd-spin) #shopClearance{display:none!important}' +
    'body.rrd-on:not(.rrd-closet) #rrCloset,body.rrd-on:not(.rrd-closet) #lairMore,body.rrd-on:not(.rrd-closet) #invPanel details.shop-fold{display:none!important}' +
    'body.rrd-on:not(.rrd-flex) #lookStation{display:none!important}body.rrd-on.rrd-flex #invPanel>*:not(h2):not(#shopScene):not(#rrDoors):not(.scene-anchor){display:none!important}' +
    '.rrd-bar{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;padding:12px 12px 0;margin:8px 0 12px;background:repeating-linear-gradient(90deg,#3a1f66 0 22px,#331a5c 22px 44px);border-bottom:6px solid #ffd166;border-radius:8px 8px 0 0}' +
    '.rrd-door{display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 4px 8px;min-height:64px;border:3px solid #000;border-bottom:0;border-radius:30px 30px 0 0;text-decoration:none;box-shadow:inset 0 0 0 2px rgba(255,255,255,.15)}' +
    '.rrd-d-spin{background:#1f3f5a;color:#bfeaff}.rrd-d-closet{background:#4a3a1a;color:#ffe28a}.rrd-d-flex{background:#4a1f4f;color:#ffc2f0}.rrd-door.on.rrd-d-spin{background:#7fd8ff;color:#10263a}.rrd-door.on.rrd-d-closet{background:#ffd166;color:#2a1530}.rrd-door.on.rrd-d-flex{background:#ff8ad8;color:#2a1030}' +
    '.rrd-ic{font-size:20px;line-height:1}.rrd-lab{font-family:"Press Start 2P",monospace;font-size:10px}.rrd-sub{font-size:12px;font-weight:700;text-align:center}.rrd-door:focus-visible{outline:3px solid #fff;outline-offset:2px}' +
    '.rrc{display:flex;flex-direction:column;gap:12px;margin-bottom:12px}.rrc h3{margin:0;font-family:Bangers,cursive;font-size:22px;letter-spacing:1px;font-weight:400}.rrc .pos{color:#3ddc84}.rrc .neg{color:#ff8a8a}' +
    '.rrc-mirror{display:flex;gap:12px;align-items:center;background:#160c28;border:3px solid #ffd166;border-radius:10px;padding:10px}.rrc-glass{flex:0 0 auto;width:120px;height:136px;border:5px solid #c08a2a;border-radius:60px 60px 8px 8px;background:radial-gradient(#bfeaff,#2c5f86 72%);display:flex;align-items:center;justify-content:center}' +
    '.rrc-glass canvas{width:104px;height:104px;image-rendering:pixelated}.rrc-mi{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}.rrc-pet{min-height:40px;text-align:left}.rrc-pow{font-family:Bangers,cursive;font-size:28px;letter-spacing:1px}.rrc-pow small{font-family:"Comic Neue",sans-serif;font-size:13px;letter-spacing:0;opacity:.8}.rrc-dress{min-height:46px}' +
    '.rrc-find[hidden]{display:none!important}.rrc-find{display:flex;flex-direction:column;gap:6px}.rrc-find input{min-height:40px;width:min(320px,100%)}.rrc-chips{display:flex;flex-wrap:wrap;gap:6px}.rrc-chip{display:inline-flex;align-items:center;gap:6px;min-height:44px}.rrc-chip canvas{width:28px;height:28px;image-rendering:pixelated}' +
    '.rrc-ups,.rrc-gear{background:#1b1030;border:2px solid #3ddc84;border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:6px}.rrc-gear{border-color:#6b5590}.rrc-uh{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:6px}.rrc-ups h3{color:#3ddc84}.rrc-gear h3{color:#ffd166}' +
    '.rrc-up{display:flex;align-items:center;gap:8px;min-height:48px}.rrc-up canvas{width:40px;height:40px;image-rendering:pixelated;border-radius:4px}.rrc-ut{flex:1;min-width:0;display:flex;flex-direction:column}.rrc-ut small{opacity:.8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rrc-g{font-family:Bangers,cursive;font-size:22px;color:#3ddc84}.rrc-go{min-height:40px}.rrc-all{min-height:48px;margin-top:4px}' +
    '.rrc-tabs{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:6px}.rrc-tab{min-height:44px;font-family:"Press Start 2P",monospace;font-size:8px;background:#2a1748;color:#f3eaff;border:2px solid #6b5590;border-radius:6px;cursor:pointer}.rrc-tab b{color:#ffd166}.rrc-tab.on{background:#ffd166;color:#2a1530;border-color:#000}.rrc-tab.on b{color:#2a1530}' +
    '.rrc-hint{margin:2px 0}.rrc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px}.rrc-pc{display:grid;grid-template-columns:30px 1fr auto;grid-template-rows:auto auto;column-gap:6px;align-items:center;text-align:left;min-height:56px;padding:6px;background:#2a1748;color:#f3eaff;border:2px solid #3a2560;border-radius:6px;cursor:pointer;font:inherit;font-size:13px}' +
    '.rrc-pc .dz-ic{grid-row:1/3}.rrc-pn{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}.rrc-ps{color:#ffd166;font-size:11px}.rrc-pc em{font-style:normal;font-family:Bangers,cursive;font-size:17px;grid-column:3;grid-row:2;justify-self:end}.rrc-pc small{grid-column:2;opacity:.8;font-size:11px}.rrc-pc.up{border-color:#3ddc84}.rrc-pc.worn{border-color:#ffd166}.rrc-pc:disabled{cursor:default}' +
    '.rrc-more{align-self:flex-start;min-height:40px}@media (max-width:520px){.rrc-glass{width:100px;height:116px}.rrc-glass canvas{width:88px;height:88px}.rrc-pow{font-size:24px}.rrd-sub{font-size:11px}}';
  function css() { if ($('rrdCss')) return; var s = d.createElement('style'); s.id = 'rrdCss'; s.textContent = CSS; (d.head || d.documentElement).appendChild(s); }
  var lastW = null, lastIx = null;
  function tick() { if (!on()) return; css(); if (!build()) return; if (!ST.door) { var k = fromHash() || lsGet() || 'closet'; if (location.hash === '#dressing-room') return onHash(); setDoor(k, false); }
    counts(); if (ST.door === 'closet' && ok()) { var w = U().world(), ix = D().index(w); if (w !== lastW || ix !== lastIx) { lastW = w; lastIx = ix; closet(); } } }
  window.addEventListener('hashchange', function () { if (on()) onHash(); });
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', tick); else tick();
  setInterval(tick, 1500);
  window.V2RRDoors = { door: function () { return ST.door; }, setDoor: setDoor, refresh: function () { ST.ups = null; closet(); } };
})();
