/* XCPETS Dress drawer (rare-room-rethink, Jake Nov 23 2026: "there are so much gear and pets its hard to make sense of it with the rare room",
 * "dressing pets on the cards may be better"; he picked "Both, one shared drawer"). Display + the SAME free local equip op the Rare Room uses
 * (an 'equip' entry in V2UI.S().ops, V2UI.save(), V2UI.refreshGear). No burns, no rule change, nothing is signed.
 *  1) Every living pet card in My Pets gets a "👕 Dress" button. When spare gear you own would make that pet stronger it reads "👕 Dress +N"
 *     (gear power: 1 + 2 x tier per worn piece, the same number Equip Best and the fight math use). Worked out only for cards on screen.
 *  2) V2Dress.open(id): one drawer (a bottom sheet on phones) with a mirror, the six slots (what it wears, the best spare piece, +N, Wear or
 *     Take off, and every other spare piece that fits, tap = try it on in the mirror), "Wear all best" and Undo.
 *  3) ⚙️ More on My Pets gets "Dress every pet in its best gear" (one pass over your spare gear, strongest pets first, each piece used once).
 * View-only (someone else's address): the buttons are hidden. Big wallets: no pass over every pet, only the cards that scroll into view. */
(function () {
  'use strict';
  var d = document;
  function UI() { return window.V2UI; }
  function RL() { return window.V2Rules; }
  function $(id) { return d.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function ready() { var U = UI(), V = RL(); return !!(U && V && U.ME && U.world && V.equipCheck && V.wornOf && V.GEAR_BY_ID); }
  function viewOnly() { var U = UI(); try { return !!(U && U.viewOnly && U.viewOnly()); } catch (e) { return false; } }
  function item(id) { return (RL().GEAR_BY_ID || {})[id] || null; }
  function dmg(id) { var it = item(id); return it ? 1 + 2 * (it.tier || 0) : 0; }
  function label(id) { var it = item(id), s = it ? it.label || id : id; return window.XcpSlots ? XcpSlots.text(s) : s; }
  function slotName(sl) { try { if (window.XcpSlots) return XcpSlots.label(sl); return RL().slotLabel(sl); } catch (e) { return sl; } }
  function stars(id) { var it = item(id), t = it ? it.tier || 0 : 0; return t ? new Array(t + 1).join('★') : '☆'; }
  var TIERS = ['Common', 'Uncommon', 'Rare', 'Legendary'];
  function slotsOf(p) { var V = RL(), s = (p.openSlots || []).slice(); if (p.species === 'wizard' && V.slotOpen && V.slotOpen(p, 'weapon') && s.indexOf('weapon') < 0) s.push('weapon'); return s; }
  function allSlots(p) { var V = RL(), s = (V.V2_SLOTS || ['head', 'hand', 'body', 'back', 'face', 'feet']).slice(); if (slotsOf(p).indexOf('weapon') >= 0) s.push('weapon'); return s; }
  function icon(id) { var c = icon.c || (icon.c = {}); if (c[id] != null) return c[id]; var src = ''; try { src = window.V2Render && V2Render.iconCanvas ? V2Render.iconCanvas(id).toDataURL() : ''; } catch (e) { src = ''; } c[id] = src; return src; }
  function iconHtml(id, n) { var s = id ? icon(id) : ''; return s ? '<img class="dz-ic" src="' + s + '" alt="" width="' + (n || 28) + '" height="' + (n || 28) + '">' : '<span class="dz-ic dz-ic0" aria-hidden="true"></span>'; }

  /* ---- the stash index: your spare (not worn) pieces per slot, strongest first. Rebuilt when the world or your local ops change. */
  var IX = null, VER = 0;
  function opsN() { try { return (UI().S().ops || []).length; } catch (e) { return 0; } }
  /* who wears what, as one number: the world can be updated in place after an equip, so object identity and counts alone are not enough */
  function wornMark(list) { var m = list.length | 0; for (var i = 0; i < list.length; i++) { var on = list[i].on; if (on != null) m = (Math.imul(m, 31) + (on | 0) + i) | 0; } return m; }
  function index(w) { var U = UI(), ME = U.ME, list = w.itemList || [], n = list.length, o = opsN(), mk = wornMark(list);
    if (IX && IX.w === w && IX.n === n && IX.o === o && IX.me === ME && IX.mk === mk) return IX;
    var free = {};
    for (var i = 0; i < list.length; i++) { var g = list[i]; if (g.owner !== ME || g.on != null) continue; var it = item(g.item); if (!it) continue; (free[it.slot] = free[it.slot] || []).push({ g: g, i: i, d: 1 + 2 * (it.tier || 0) }); }
    Object.keys(free).forEach(function (s) { free[s].sort(function (a, b) { return b.d - a.d || a.i - b.i; }); });
    IX = { w: w, n: n, o: o, me: ME, mk: mk, free: free, can: {}, gain: {} }; VER++; return IX; }
  /* can this pet wear this piece? (equipCheck, cached per species / tier / body / one-of-one / piece like Auto-equip) */
  function can(w, ix, p, id) { var V = RL(), one = V.isOneOfOne && V.isOneOfOne(p) ? 1 : 0, body = V.bodyOf ? V.bodyOf(p) : p.species, k = p.species + '\0' + p.tier + '\0' + body + '\0' + one + '\0' + id + '\0' + slotsOf(p).join(',');
    var hit = ix.can[k]; if (hit != null) return hit; var c = V.equipCheck(w, UI().ME, p.id, id); hit = !!(c && (c.ok || c.worn)); ix.can[k] = hit; return hit; }
  function wornBySlot(w, p) { var o = {}; (RL().wornOf(w, p.id) || []).forEach(function (g) { var s = g.slot || (item(g.item) || {}).slot; if (s) o[s] = g; }); return o; }
  /* plan(w, p): for each open slot the strongest spare piece that beats what it wears now. { gain, by: { slot: {g, d} }, now } */
  function plan(w, p) { var ix = index(w), hit = ix.gain[p.id]; if (hit) return hit;
    var worn = wornBySlot(w, p), out = { gain: 0, by: {}, now: 0, n: 0 };
    Object.keys(worn).forEach(function (s) { out.now += dmg(worn[s].item); });
    slotsOf(p).forEach(function (sl) { var cur = worn[sl], floor = cur ? dmg(cur.item) : 0, arr = ix.free[sl] || [];
      for (var j = 0; j < arr.length; j++) { var x = arr[j]; if (x.d <= floor) break; if (cur && x.g.item === cur.item) continue; if (!can(w, ix, p, x.g.item)) continue; out.by[sl] = { g: x.g, d: x.d - floor }; out.gain += x.d - floor; out.n++; break; } });
    ix.gain[p.id] = out; return out; }
  /* every spare piece of a slot this pet can wear, one row per piece kind (copies counted), strongest first */
  function choices(w, p, sl) { var ix = index(w), arr = ix.free[sl] || [], seen = {}, out = [];
    for (var j = 0; j < arr.length; j++) { var g = arr[j].g; if (seen[g.item]) { seen[g.item].n++; continue; } if (!can(w, ix, p, g.item)) continue; seen[g.item] = { id: g.item, d: arr[j].d, n: 1 }; out.push(seen[g.item]); }
    return out; }

  /* ---- the equip op (same as the Rare Room's) */
  function push(pid, list) { var U = UI(), St = U.S(); list.forEach(function (o) { St.ops.push({ kind: 'equip', owner: U.ME, petId: pid, slot: o.sl, gid: o.gid, block_index: St.tip }); }); U.save();
    IX = null; try { if (U.refreshGear) U.refreshGear(pid); else U.render(); } catch (e) { if (window.console) console.error(e); } }
  function blocked() { var U = UI(); if (!viewOnly()) return false; try { U.confirmPlans('Equip', [{}]); } catch (e) { } return true; }

  /* ---- the drawer */
  var DR = { pid: null, tryOn: {}, exp: null, undo: null, back: null };
  function open(pid) { if (!ready()) return; var w = UI().world(), p = w && w.byId[pid]; if (!p || p.dead || p.released || p.owner !== UI().ME) { UI().toast('Only your own living pets can be dressed here.'); return; }
    if (DR.pid !== +pid) { DR.tryOn = {}; DR.exp = null; DR.undo = null; } DR.pid = +pid; DR.back = d.activeElement; draw(true); }
  function close() { var m = $('dzModal'); if (m) m.remove(); d.documentElement.classList.remove('dz-open'); DR.pid = null; DR.tryOn = {}; DR.exp = null; var b = DR.back; DR.back = null; if (b && b.focus && d.contains(b)) try { b.focus({ preventScroll: true }); } catch (e) { } }
  function row(w, p, sl, worn, pl) {
    var on = slotsOf(p).indexOf(sl) >= 0, nm = esc(slotName(sl));
    if (!on) return '<div class="dz-row lock" data-sl="' + sl + '"><span class="dz-sl">' + nm + '</span><span class="dz-ic dz-ic0" aria-hidden="true"></span><div class="dz-txt"><b>Locked</b><small>Opens as #' + p.id + ' grows and gets care</small></div></div>';
    var cur = worn[sl], best = pl.by[sl], ch = choices(w, p, sl), more = ch.filter(function (c) { return !best || c.id !== best.g.item; }).length, t = DR.tryOn[sl], h;
    if (best) h = '<div class="dz-row up" data-sl="' + sl + '"><span class="dz-sl">' + nm + '</span>' + iconHtml(best.g.item) + '<div class="dz-txt"><b>' + esc(label(best.g.item)) + ' <i>' + stars(best.g.item) + '</i></b><small>now: ' + (cur ? esc(label(cur.item)) : 'empty') + '</small></div><span class="dz-gain">+' + best.d + '</span><button type="button" class="btn dz-wear" data-wear="' + sl + '|' + esc(best.g.item) + '">Wear</button>';
    else if (cur) h = '<div class="dz-row ok" data-sl="' + sl + '"><span class="dz-sl">' + nm + '</span>' + iconHtml(cur.item) + '<div class="dz-txt"><b>' + esc(label(cur.item)) + ' <i>' + stars(cur.item) + '</i></b><small>✓ the best you own for #' + p.id + '</small></div><button type="button" class="q dz-off" data-off="' + sl + '">Take off</button>';
    else h = '<div class="dz-row none" data-sl="' + sl + '"><span class="dz-sl">' + nm + '</span><span class="dz-ic dz-ic0" aria-hidden="true"></span><div class="dz-txt"><b>Empty</b><small>' + (ch.length ? 'pick a piece below' : 'no spare piece fits. Spin the Pepe Wheel for one') + '</small></div>';
    if (more || (best && cur)) h += '<button type="button" class="q dz-more" data-exp="' + sl + '" aria-expanded="' + (DR.exp === sl) + '" title="Every spare piece that fits">' + (DR.exp === sl ? '▴' : '▾') + ' ' + ch.length + '</button>';
    h += '</div>';
    if (DR.exp === sl) { var floor = cur ? dmg(cur.item) : 0;
      h += '<div class="dz-list" role="group" aria-label="' + nm + ' pieces that fit #' + p.id + '">' + (ch.length ? ch.slice(0, 40).map(function (c) { var df = c.d - floor, sel = t === c.id;
        return '<button type="button" class="dz-pc' + (sel ? ' on' : '') + '" data-try="' + sl + '|' + esc(c.id) + '" aria-pressed="' + sel + '" title="' + esc(TIERS[(item(c.id) || {}).tier || 0] || '') + '">' + iconHtml(c.id, 24) + '<span>' + esc(label(c.id)) + (c.n > 1 ? ' ×' + c.n : '') + '</span><em class="' + (df > 0 ? 'pos' : df < 0 ? 'neg' : '') + '">' + (df > 0 ? '+' : '') + df + '</em></button>'; }).join('') : '<p class="small">No spare piece fits this slot.</p>') +
        (cur ? '<button type="button" class="q dz-pc dz-offpc" data-off="' + sl + '">Take off ' + esc(label(cur.item)) + '</button>' : '') + '</div>';
      if (t) h += '<div class="dz-tryrow"><span>Trying on <b>' + esc(label(t)) + '</b></span><button type="button" class="btn dz-wear" data-wear="' + sl + '|' + esc(t) + '">Wear it</button><button type="button" class="q" data-untry="' + sl + '">Never mind</button></div>'; }
    return h; }
  function mirror(cv, w, p, worn) { try { var ids = [], sl; for (sl in worn) if (!DR.tryOn[sl]) ids.push(worn[sl].item); for (sl in DR.tryOn) ids.push(DR.tryOn[sl]);
      var fr = V2Render.framesWith(p.art, p.stage, ids, []); if (fr && fr.length) V2Render.animate(cv, fr); } catch (e) { if (window.console) console.warn('dress mirror', e); } }
  function draw(first) { if (DR.pid == null) return; var U = UI(), w = U.world(), p = w && w.byId[DR.pid];
    if (!p || p.dead || p.released || p.owner !== U.ME) return close();
    var worn = wornBySlot(w, p), pl = plan(w, p), tryD = 0, sl;
    for (sl in DR.tryOn) tryD += dmg(DR.tryOn[sl]) - (worn[sl] ? dmg(worn[sl].item) : 0);
    var m = $('dzModal'), keep = m && m.querySelector('.dz-body') ? m.querySelector('.dz-body').scrollTop : 0;
    if (!m) { m = d.createElement('div'); m.id = 'dzModal'; m.className = 'dz-modal'; d.body.appendChild(m);
      m.addEventListener('click', function (e) { if (e.target === m) return close(); act(e); });
      m.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }); }
    d.documentElement.classList.add('dz-open');
    var power = Object.keys(DR.tryOn).length ? '⚔ ' + pl.now + ' → <b class="' + (tryD >= 0 ? 'pos' : 'neg') + '">' + (pl.now + tryD) + '</b> <small>trying on</small>' : pl.gain ? '⚔ ' + pl.now + ' → <b class="pos">' + (pl.now + pl.gain) + '</b> <small>in its best gear</small>' : '⚔ <b>' + pl.now + '</b> <small>wearing the best you own</small>';
    m.innerHTML = '<div class="dz-box" role="dialog" aria-modal="true" aria-labelledby="dzTitle"><div class="dz-grab" aria-hidden="true"></div>' +
      '<div class="dz-head"><h3 id="dzTitle">👕 Dress #' + p.id + ' ' + esc(p.name || '') + '</h3><button type="button" class="q dz-x" data-x="1" aria-label="Close">✕</button></div>' +
      '<div class="dz-body"><div class="dz-mirror"><div class="dz-glass"><canvas width="32" height="32" role="img" aria-label="#' + p.id + ' in the mirror"></canvas></div><div class="dz-pow"><span class="dz-cap">GEAR POWER</span><span class="dz-num">' + power + '</span><span class="small">Tap ▾ on a slot to try other pieces on. Wearing gear is free, no burn.</span></div></div>' +
      '<div class="dz-rows">' + allSlots(p).map(function (s) { return row(w, p, s, worn, pl); }).join('') + '</div></div>' +
      '<div class="dz-foot"><button type="button" class="btn ico-flame dz-all" data-all="1"' + (pl.gain ? '' : ' disabled') + '>⚡ Wear all best' + (pl.gain ? ' · +' + pl.gain : '') + ' <span class="cost">free</span></button>' + (DR.undo ? '<button type="button" class="q" data-undo="1">↩ Undo</button>' : '') +
      '<a class="q dz-spin" href="rare-room.html#rare-room-' + p.id + '">🎡 Spin for gear</a></div></div>';
    mirror(m.querySelector('canvas'), w, p, worn);
    if (keep) m.querySelector('.dz-body').scrollTop = keep;
    if (first) { var x = m.querySelector('.dz-x'); if (x) try { x.focus({ preventScroll: true }); } catch (e) { } } }
  function act(e) { var b = e.target.closest('button'); if (!b) return; var U = UI(), V = RL(), w = U.world(), p = w.byId[DR.pid], ds = b.dataset; if (!p) return close();
    if (ds.x) return close();
    if (ds.exp) { DR.exp = DR.exp === ds.exp ? null : ds.exp; return draw(); }
    if (ds.untry) { delete DR.tryOn[ds.untry]; return draw(); }
    if (ds.try) { var q = ds.try.split('|'); if (DR.tryOn[q[0]] === q[1]) { DR.tryOn[q[0]] = null; delete DR.tryOn[q[0]]; } else DR.tryOn[q[0]] = q[1]; return draw(); }
    if (blocked()) return;
    var worn = wornBySlot(w, p);
    if (ds.wear) { var r = ds.wear.split('|'), c = V.equipCheck(w, U.ME, p.id, r[1]); if (!c || !c.ok || !c.gid) { U.toast(esc((c && c.why) || 'Cannot wear that piece')); return; }
      DR.undo = [{ sl: r[0], gid: worn[r[0]] ? worn[r[0]].gid : null }]; delete DR.tryOn[r[0]]; push(p.id, [{ sl: r[0], gid: c.gid }]);
      U.toast('👕 #' + p.id + ' wears ' + esc(label(r[1])) + ' (free)'); return draw(); }
    if (ds.off) { if (!worn[ds.off]) return; DR.undo = [{ sl: ds.off, gid: worn[ds.off].gid }]; delete DR.tryOn[ds.off]; push(p.id, [{ sl: ds.off, gid: null }]); U.toast('#' + p.id + ' took off ' + esc(label(worn[ds.off].item)) + ' (free)'); return draw(); }
    if (ds.all) { var pl = plan(w, p), L = Object.keys(pl.by).map(function (s) { return { sl: s, gid: pl.by[s].g.gid }; }); if (!L.length) return;
      DR.undo = L.map(function (o) { return { sl: o.sl, gid: worn[o.sl] ? worn[o.sl].gid : null }; }); DR.tryOn = {}; push(p.id, L); U.toast('⚡ #' + p.id + ' in its best gear: ⚔ ' + pl.now + ' → ' + (pl.now + pl.gain) + ' (free)'); return draw(); }
    if (ds.undo && DR.undo) { var u = DR.undo; DR.undo = null; push(p.id, u); U.toast('↩ Outfit restored on #' + p.id + ' (free)'); return draw(); } }

  /* ---- the Dress button on My Pets cards. Filled in only when a card scrolls into view. */
  var io = null;
  function fill(b) { if (!ready() || !b.isConnected) return; var w = UI().world(), p = w && w.byId[+b.dataset.dress]; if (!p || p.dead || p.owner !== UI().ME) { b.hidden = true; return; }
    var pl = plan(w, p); b._v = VER; b.hidden = false; b.classList.toggle('up', pl.gain > 0);
    var t = pl.gain > 0 ? '👕 Dress +' + pl.gain : '👕 Dress'; if (b.textContent !== t) b.textContent = t;
    b.title = pl.gain > 0 ? 'Spare gear you own would add ' + pl.gain + ' gear power to #' + p.id + ' (' + pl.n + ' slot' + (pl.n === 1 ? '' : 's') + '). Wearing is free.' : 'Change #' + p.id + '’s gear'; }
  function watch(b) { if (!io) { if (!window.IntersectionObserver) return fill(b); io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { fill(e.target); io.unobserve(e.target); } }); }, { rootMargin: '300px 0px' }); }
    if (b._w === VER) return; b._w = VER; io.unobserve(b); io.observe(b); } /* once per index version: re-observing on every DOM change kept postponing the first callback */
  var BOXES = ['pets', 'mpsBox']; /* the grid, and the phone 'One at a time' card (js/v2-mypets-swipe.js, the same card via V2UI.cardFor) */
  function decorate() { if (!ready() || viewOnly()) return; var w = UI().world(); if (w) index(w); BOXES.forEach(function (id) { var box = $(id); if (box) dec(box, id === 'mpsBox'); }); }
  function dec(box, one) {
    var cs = box.querySelectorAll('.pet.card:not(.dead)'); for (var i = 0; i < cs.length; i++) { var c = cs[i], b = c.querySelector(':scope > .dressbtn');
      if (!b) { var pid = c.dataset.pid; if (!pid) continue; b = d.createElement('button'); b.type = 'button'; b.className = 'q dressbtn'; b.dataset.dress = pid; b.textContent = '👕 Dress'; b.setAttribute('aria-label', 'Dress #' + pid);
        var ob = c.querySelector(':scope > .openbtn'); if (ob) c.insertBefore(b, ob); else c.appendChild(b); if (one) fill(b); else watch(b); }
      else if (b._v !== VER) { if (one) fill(b); else watch(b); } } } /* the one-card view holds a single card: fill it at once (it slides in, so waiting on the observer missed it) */
  var queued = 0;
  function soon() { if (queued) return; queued = 1; (window.requestAnimationFrame || setTimeout)(function () { queued = 0; try { decorate(); } catch (e) { if (window.console) console.error(e); } }); }
  function hookPets() { BOXES.forEach(function (id) { var box = $(id); if (box && !box._dz) hook(box, id === 'mpsBox'); }); }
  function hook(box, deep) { box._dz = 1;
    new MutationObserver(soon).observe(box, { childList: true, subtree: deep });
    box.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('.dressbtn'); if (!b) return; e.stopPropagation(); e.preventDefault(); open(+b.dataset.dress); }, true);
    box.addEventListener('keydown', function (e) { if (e.target.classList && e.target.classList.contains('dressbtn') && (e.key === 'Enter' || e.key === ' ')) e.stopPropagation(); }, true);
    soon(); }

  /* ---- ⚙️ More on My Pets: dress every pet in its best gear (Auto-equip's pieces, one pass over your stash) */
  /* one pass: strongest pets first (stage, then tier), each open slot gets the strongest spare piece it can wear that beats its current one; a piece is used once */
  function allOps() { var U = UI(), w = U.world(); if (!w) return []; var ix = index(w), used = {}, ops = [], St = U.S();
    U.mine(w).filter(function (p) { return !p.dead && !p.released; }).sort(function (a, b) { return (b.stage || 0) - (a.stage || 0) || (b.tier || 0) - (a.tier || 0) || a.id - b.id; }).forEach(function (p) { var worn = null;
      slotsOf(p).forEach(function (sl) { var arr = ix.free[sl]; if (!arr || !arr.length) return; worn = worn || wornBySlot(w, p); var cur = worn[sl], floor = cur ? dmg(cur.item) : 0;
        for (var j = 0; j < arr.length; j++) { var x = arr[j]; if (x.d <= floor) break; if (used[x.g.gid] || (cur && x.g.item === cur.item) || !can(w, ix, p, x.g.item)) continue; used[x.g.gid] = 1; ops.push({ kind: 'equip', owner: U.ME, petId: p.id, slot: sl, gid: x.g.gid, block_index: St.tip }); break; } }); });
    return ops; }
  function hookMore() { var sec = $('mpcCare'); if (!sec || $('dzAllBtn') || !ready() || viewOnly()) return;
    var b = d.createElement('button'); b.type = 'button'; b.className = 'q'; b.id = 'dzAllBtn'; b.textContent = '👕 Dress every pet in its best gear'; b.title = 'Puts the strongest spare piece you own into every open slot it beats, on all your pets. Free, no burn.';
    b.onclick = function () { if (blocked()) return; var U = UI(), w = U.world(), ops = allOps(); if (!ops.length) return U.toast('Every pet already wears the best spare gear you own.');
      var gain = 0, pets = {}; ops.forEach(function (o) { var g = w.items[o.gid], cur = (wornBySlot(w, w.byId[o.petId]) || {})[o.slot]; gain += (g ? dmg(g.item) : 0) - (cur ? dmg(cur.item) : 0); pets[o.petId] = 1; });
      var St = U.S(); ops.forEach(function (o) { St.ops.push(o); }); U.save(); IX = null; U.render();
      U.toast('⚡ ' + Object.keys(pets).length + ' pets dressed: +' + gain + ' gear power (' + ops.length + ' pieces, free)'); };
    sec.insertBefore(b, sec.firstChild); }

  var CSS = '.dressbtn{display:block;width:100%;margin-top:6px;min-height:36px;font-family:"Press Start 2P",monospace;font-size:9px}.dressbtn.up{background:#ffd166;color:#2a1530;border-color:#000;box-shadow:2px 2px 0 #000}.dressbtn[hidden]{display:none}' +
    'html.viewonly .dressbtn,html.viewonly #dzAllBtn,body.selmode .dressbtn{display:none!important}' +
    '.dz-modal{position:fixed;inset:0;z-index:2147483000;background:rgba(8,4,16,.66);display:flex;align-items:flex-end;justify-content:center}html.dz-open{overflow:hidden}' +
    '.dz-box{width:100%;max-width:560px;max-height:92vh;display:flex;flex-direction:column;background:#221238;color:#f3eaff;border:3px solid #ffd166;border-bottom:0;border-radius:16px 16px 0 0;box-shadow:0 -6px 0 #000;font-family:"Comic Neue",sans-serif}' +
    '@media (min-width:700px){.dz-modal{align-items:center}.dz-box{border-bottom:3px solid #ffd166;border-radius:14px;max-height:88vh}}' +
    '.dz-grab{width:48px;height:5px;border-radius:3px;background:#6b5590;margin:8px auto 0}.dz-head{display:flex;align-items:center;gap:8px;padding:6px 14px 4px}.dz-head h3{flex:1;margin:0;font-family:Bangers,cursive;font-size:24px;letter-spacing:1px;color:#ffd166;font-weight:400}.dz-x{min-width:44px;min-height:44px}' +
    '.dz-body{overflow-y:auto;padding:4px 14px 10px;-webkit-overflow-scrolling:touch}.dz-mirror{display:flex;gap:12px;align-items:center;background:#160c28;border:2px solid #3a2560;border-radius:8px;padding:10px;margin-bottom:8px}' +
    '.dz-glass{flex:0 0 auto;width:104px;height:104px;border:4px solid #c08a2a;border-radius:50px 50px 6px 6px;background:radial-gradient(#bfeaff,#2c5f86 72%);display:flex;align-items:center;justify-content:center}.dz-glass canvas{width:88px;height:88px;image-rendering:pixelated}' +
    '.dz-pow{display:flex;flex-direction:column;gap:4px}.dz-cap{font-family:"Press Start 2P",monospace;font-size:8px;color:#c3b4e0}.dz-num{font-family:Bangers,cursive;font-size:28px;letter-spacing:1px}.dz-num small{font-family:"Comic Neue",sans-serif;font-size:13px;color:#c3b4e0;letter-spacing:0}.dz-pow .small{color:#c3b4e0}' +
    '.pos{color:#3ddc84}.neg{color:#ff8a8a}.dz-rows{display:flex;flex-direction:column;gap:6px}' +
    '.dz-row{display:flex;align-items:center;gap:8px;min-height:52px;padding:6px 8px;background:#2a1748;border:2px solid #3a2560;border-radius:6px}.dz-row.up{border-color:#ffd166}.dz-row.lock{opacity:.6}' +
    '.dz-sl{flex:0 0 66px;font-family:"Press Start 2P",monospace;font-size:7px;color:#ffd166;text-transform:uppercase;line-height:1.4}.dz-ic{flex:0 0 auto;image-rendering:pixelated;background:#140a22;border-radius:4px}.dz-ic0{width:28px;height:28px;display:inline-block}' +
    '.dz-txt{flex:1;min-width:0;display:flex;flex-direction:column}.dz-txt b{font-size:14px;overflow:hidden;text-overflow:ellipsis}.dz-txt b i{font-style:normal;color:#ffd166;font-size:11px}.dz-txt small{font-size:12px;color:#c3b4e0}' +
    '.dz-gain{font-family:Bangers,cursive;font-size:20px;color:#3ddc84}.dz-wear{min-height:38px;padding:6px 10px!important;font-size:12px!important}.dz-off,.dz-more{min-height:38px}' +
    '.dz-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px;padding:4px 2px 2px 14px}.dz-pc{display:flex;align-items:center;gap:6px;min-height:44px;padding:4px 6px;background:#160c28;color:#f3eaff;border:2px solid #3a2560;border-radius:6px;cursor:pointer;text-align:left;font:inherit;font-size:13px}' +
    '.dz-pc span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}.dz-pc em{font-style:normal;font-family:Bangers,cursive;font-size:16px;color:#c3b4e0}.dz-pc.on{border-color:#7fd8ff;box-shadow:0 0 0 2px #7fd8ff inset}.dz-offpc{justify-content:center}' +
    '.dz-tryrow{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:6px 2px 2px 14px;font-size:13px}' +
    '.dz-foot{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 14px calc(12px + env(safe-area-inset-bottom));border-top:2px solid #3a2560}.dz-all{flex:1 1 200px;min-height:48px}.dz-all:disabled{opacity:.5;filter:grayscale(1)}.dz-spin{min-height:44px;display:inline-flex;align-items:center;text-decoration:none}';
  function css() { if ($('dzCss')) return; var s = d.createElement('style'); s.id = 'dzCss'; s.textContent = CSS; (d.head || d.documentElement).appendChild(s); }
  function boot() { css(); hookPets(); hookMore(); }
  /* a fresh world (new block, fast-load page batch) or ops from another tab: rebuild the index, refresh the open drawer and the visible buttons */
  function tick() { try { boot(); var w = ready() && UI().world(); if (w && (!IX || IX.w !== w || IX.o !== opsN() || IX.mk !== wornMark(w.itemList || []))) { index(w); if (DR.pid != null && $('dzModal')) draw(); soon(); } } catch (e) { } }
  if (typeof window !== 'undefined') { boot(); setInterval(tick, 1500); }
  window.V2Dress = { open: open, close: close, plan: function (w, p) { return plan(w, p); }, decorate: decorate, _reset: function () { IX = null; } };
})();
