/* XCPETS shop "The XCPETS Lair of Locks, Leverage, Layers, Luster, Looks, and Leathers" (owner's final name 8:01 PM CT; Captain Dan is the shopkeeper character, not in the name) (UI-only mockup, owner 7:18 PM CT; branch pet-shop, NOT LIVE). No rule change, no new burns.
 * An 8-bit cartoon-Roman shop floor on top of the existing Pet Shop: Captain Dan (an affectionate 8-bit caricature of the creator of XCP.fun, Bitcorn Crops, bitcorns.com and DigiRare.io)
 * waves from behind the counter when approached; your owned gear sits on the shelves (real item icons). Tap a shelf item -> the existing racks below jump to
 * that slot (same gear actions as before: pick a pet, tap a slot, equip/unequip). prefers-reduced-motion: static scene. */
(function () {
  'use strict';
  var W = 320, H = 150, RM = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  /* Captain Dan's lines (owner 7:36/7:37 PM CT): affectionate, farm/Bitcorn/Bitcoin humor; facts used: creator of XCP.fun, Bitcorn Crops, bitcorns.com, DigiRare.io. No other bio. */
  var LINES = ['gm from the farm!', 'Fresh off the field!', 'Harvest\u2019s in, matey', 'Gear grows like Bitcorn', 'Plant a roll, reap gear', 'Bitcorn Crops taught me well',
    'XCP.fun built this barn', 'Hand-picked at dawn', 'Every piece, homegrown', 'bitcorns.com sends love', 'DigiRare.io says hi!', 'Rare as a DigiRare', 'Good soil, good drops',
    'Shelves full like silos', 'Tap a crop, kit a pet', 'Ripe for the wearing!', 'Stack sats, stack corn', 'HODL the harvest', 'Ahoy from the cornfield!', 'Fresh harvest, fair deal'];
  var S = { c: null, x: null, items: [], icons: {}, raf: 0, hits: [], line: 0 };
  function reduced() { return !!RM.matches || !!window.__shopReduced; }
  function px(x, c, a, b, w, h) { x.fillStyle = c; x.fillRect(a, b, w, h); }
  /* Captain Dan, traced from the CAPTAINDAN token art (xcp.fun/full/CAPTAINDAN, 226 px pixel art) downsampled to 32x32 with the token's own colours; '.' = transparent. Faces left like the token. */
  var DAN_PAL = {'b': '#064884', 'g': '#ffcb4d', 'h': '#c6846f', 'k': '#141618', 'l': '#9fa2a3', 'o': '#d79b37', 'w': '#e6e9ef'}, DAN_MAP = [
    '................................',
    '........lwwwwwww................',
    '.......wwwwwwwwwwww.............',
    '......wwwwkkkwwwwwwwww..........',
    '.....wwwwkkokkwwwwwwwww.........',
    '......wwwkkkkkwwwwwwwwwww.......',
    '......wwwkoookkwwwwwwwwwwww.....',
    '.......wkkkokkkkkkkwwwwwwwww....',
    '.......oooooogkkkkkkkwwwwwww....',
    '......kkkkkkkkkkoookkkkkwwww....',
    '.....kkkkkkkkkkkkkkkgokkkwww....',
    '.....kkkkkkkkkkkkkkkkkokkw......',
    '.......kkhhhhhhhhhhkkkkkk.......',
    '.........hhhhhhhhhhkkkkkk.......',
    '......llllhhllllhhhkkkkkk.......',
    '......lhhlhhlhhlhhhkkkkkk.......',
    '..........hhhhhhhhhhhhkk........',
    '........hhhhhhhhhhhhhhkk........',
    '........hhhhhhhhhhhhhhkk........',
    '.........kkkhhhhhhhhhhkk........',
    '.........kkkkhhhhhhkhhh.........',
    '.........hhkkhhhhhhkhhh.........',
    '.........hhhhhhhhhkkhhh.........',
    '.........kkkkkkkkkkkhhw.........',
    '.........kkkkkkkkkkhhwwk........',
    '..........kkkkkkkkhwwwkkkk......',
    '..........kkwkbkwwwwwkkkkkk.....',
    '.......ookkkwbbbwwwwkkkkkkooo...',
    '......ookkkkwbbbwwwkkkkkkkkooo..',
    '.....kkkkkkkwbbbwwkkkkokkkkkkkk.',
    '.....kkkkkkkwbbbwwkkkkkkkkkkkkk.',
    '.....kkkkkkkwbbbwwkkkkkkkkkkkkk.'];
  function dan(x, ox, oy, t) { var blink = !reduced() && Math.floor(t / 2200) % 6 === 0;
    for (var r = 0; r < 32; r++) for (var q = 0; q < 32; q++) { var ch = DAN_MAP[r][q]; if (ch !== '.') px(x, DAN_PAL[ch], ox + q, oy + r, 1, 1); }
    px(x, blink ? DAN_PAL.l : '#e8eef4', ox + 7, oy + 15, 1, 1); px(x, blink ? DAN_PAL.l : '#e8eef4', ox + 13, oy + 15, 1, 1); /* lens glints on the left (gaze left); blink */
    px(x, '#c6846f', ox + 5, oy + 30, 2, 2); /* left hand resting */
    var wf = waving(t) ? Math.floor((S.waveUntil - t) / 300) % 2 : -1; /* triggered wave: raise, wave a few times, lower back to rest */
    if (wf < 0) px(x, '#c6846f', ox + 28, oy + 30, 2, 2); /* right hand resting at his side, mirrors the left */
    else if (wf) { px(x, '#141618', ox + 29, oy + 18, 3, 10); px(x, '#c6846f', ox + 29, oy + 15, 3, 3); } else { px(x, '#141618', ox + 29, oy + 21, 3, 7); px(x, '#c6846f', ox + 31, oy + 18, 3, 3); } }
  /* Dan waves only when triggered (hover/tap on him, opening the counter, the shop scrolling into view, or V2Shop.wave() when he moves); never with prefers-reduced-motion */
  var DAN = { x: 144, y: 64, w: 34, h: 32 };
  function waving(t) { return !reduced() && t < (S.waveUntil || 0); }
  function waveNow() { if (reduced()) return; var n = performance.now(); if (n < (S.waveUntil || 0) - 300) return; S.waveUntil = n + 1800; }
  function onDan(c, e) { var r = c.getBoundingClientRect(), mx = (e.clientX - r.left) * W / r.width, my = (e.clientY - r.top) * H / r.height; return mx >= DAN.x && mx < DAN.x + DAN.w && my >= DAN.y && my < DAN.y + DAN.h; }
  function bubble(x, s, bx, by) { x.font = '6px "Press Start 2P", monospace'; var w = Math.ceil(x.measureText(s).width) + 8; bx = Math.max(2, Math.min(W - w - 2, bx - w / 2));
    px(x, '#000', bx + 1, by + 1, w, 12); px(x, '#fff8e1', bx, by, w, 12); px(x, '#fff8e1', bx + w / 2 - 2, by + 12, 4, 3); x.fillStyle = '#1b1b1b'; x.fillText(s, bx + 4, by + 9); }
  function draw(t) { var x = S.x; if (!x) return; x.imageSmoothingEnabled = false;
    px(x, '#2a1d14', 0, 0, W, H); for (var y = 0; y < 96; y += 8) for (var b = (y / 8 % 2) * -8; b < W; b += 16) px(x, (y + b) % 3 ? '#3a2a1e' : '#35261b', b + 1, y + 1, 14, 6); /* brick */
    px(x, '#e9e1cf', 120, 8, 80, 6); for (var a = 0; a < 40; a++) { var hh = Math.round(Math.sqrt(Math.max(0, 1 - Math.pow((a - 20) / 20, 2))) * 22); px(x, '#1a2b4a', 120 + a * 2, 36 - hh, 2, hh + 52); } /* arch window */
    for (var st = 0; st < 14; st++) px(x, '#fff', 124 + (st * 37) % 72, 18 + (st * 13) % 40, 1, 1);
    [112, 204].forEach(function (cx) { px(x, '#e9e1cf', cx, 10, 6, 84); px(x, '#bfb49c', cx + 2, 12, 1, 80); px(x, '#f5efe0', cx - 2, 8, 10, 3); px(x, '#f5efe0', cx - 2, 92, 10, 3); });
    /* final name (owner 8:01 PM CT): "The XCPETS Lair of Locks, Leverage, Layers, Luster, Looks, and Leathers", stacked on two lines */
    x.textAlign = 'center'; px(x, '#000', 54, 1, 214, 19); px(x, '#c8102e', 52, 0, 214, 18); px(x, '#ffd166', 52, 0, 214, 1); px(x, '#ffd166', 52, 17, 214, 1);
    x.font = '6px "Press Start 2P", monospace'; x.fillStyle = '#ffd166'; x.fillText('THE XCPETS LAIR OF', 159, 8);
    x.font = '5px "Press Start 2P", monospace'; x.fillStyle = '#fff6c8'; x.fillText('LOCKS\u00b7LEVERAGE\u00b7LAYERS\u00b7LUSTER\u00b7LOOKS & LEATHERS', 159, 15.5); x.textAlign = 'left';
    px(x, '#3ddc84', 47, 6, 3, 3); px(x, '#3ddc84', 268, 6, 3, 3); /* laurels */
    S.hits = []; var shelves = [[6, 22], [6, 56], [222, 22], [222, 56]], k = 0;
    shelves.forEach(function (s) { px(x, '#7a4f2a', s[0], s[1] + 18, 92, 4); px(x, '#5a3a1e', s[0], s[1] + 22, 92, 2);
      for (var i = 0; i < 5; i++) { var it = S.items[k++], ix = s[0] + 2 + i * 18, iy = s[1]; if (!it) continue; var ic = S.icons[it.item]; var sel = S.sel && S.sel.gid === it.gid, hov = S.hov && S.hov.gid === it.gid, lift = sel || hov ? (reduced() ? 4 : 4 + (Math.floor(t / 200) % 2)) : 0;
        if (it.on != null) { var ga = reduced() ? .9 : .55 + .45 * Math.abs(Math.sin(t / 400)); x.strokeStyle = 'rgba(255,209,102,' + ga + ')'; x.lineWidth = 2; x.strokeRect(ix - 1, iy - 1 - lift, 18, 18); }
        if (ic) x.drawImage(ic, ix, iy - lift + (reduced() || lift ? 0 : (Math.floor(t / 400 + i + k) % 7 === 0 ? -1 : 0)), 16, 16);
        if (it.on != null) { x.font = '5px "Press Start 2P", monospace'; px(x, '#ffd166', ix - 2, iy + 17, 20, 6); x.fillStyle = '#140f24'; x.fillText('EQP', ix + 1, iy + 22); }
        if (sel) { px(x, '#fff', ix - 1, iy - lift - 1, 18, 1); px(x, '#fff', ix - 1, iy - lift + 16, 18, 1); }
        S.hits.push({ x: ix, y: iy - 4, w: 16, h: 22, it: it }); } });
    if (!S.items.length) { x.font = '6px "Press Start 2P", monospace'; x.fillStyle = '#ffd166'; x.fillText('Shelves empty: roll gear!', 8, 46); }
    dan(x, DAN.x, DAN.y, t); px(x, '#7a4f2a', 70, 96, 180, 10); px(x, '#5a3a1e', 70, 106, 180, 30); px(x, '#ffd166', 70, 96, 180, 1); /* counter */
    x.font = '6px "Press Start 2P", monospace'; x.fillStyle = '#ffd166'; x.textAlign = 'center'; x.fillText(S.free + ' IN STOCK \u00b7 ' + (S.total - S.free) + ' WORN', 160, 120); x.textAlign = 'left';
    px(x, '#4a3626', 0, 136, W, 14); for (var f = 0; f < W; f += 20) px(x, '#3c2b1e', f, 136, 1, 14); /* floor */
    bubble(x, S.say || LINES[S.line % LINES.length], 160, 47);
    if (!reduced()) S.raf = requestAnimationFrame(function (n) { if (n - (S.lt || 0) > 3200) { S.lt = n; S.line++; S.say = null; } draw(n); }); else S.raf = 0; }
  function render(w) { var U = window.V2UI, R = window.V2Render, box = document.getElementById('shopScene'); if (!box || !U || !R || !w) return;
    var ME = U.ME, items = (w.itemList || []).filter(function (g) { return g.owner === ME; }).sort(function (a, b) { return (b.tier || 0) - (a.tier || 0) || (String(a.gid) < String(b.gid) ? -1 : 1); });
    S.total = items.length; S.free = items.filter(function (g) { return g.on == null; }).length; S.items = items.filter(function (g) { return g.on == null; }).concat(items.filter(function (g) { return g.on != null; })).slice(0, 20);
    S.items.forEach(function (g) { if (!S.icons[g.item]) try { S.icons[g.item] = R.iconCanvas(g.item); } catch (e) { } });
    var c = box.querySelector('canvas'); if (!c) { box.innerHTML = '<canvas width="' + W + '" height="' + H + '" role="img" aria-label="The XCPETS Lair of Locks, Leverage, Layers, Luster, Looks, and Leathers: Captain Dan behind the counter, your stock on the shelves"></canvas><div class="shop-hint small">Tap gear on a shelf · pick a pet · wear it</div>'; c = box.querySelector('canvas');
      if (window.IntersectionObserver) new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) waveNow(); }); }, { threshold: 0.5 }).observe(c);
      c.addEventListener('mousemove', function (e) { if (onDan(c, e)) waveNow(); var h = hitAt(c, e); var g = h ? h.it : null; if ((g && g.gid) !== (S.hov && S.hov.gid)) { S.hov = g; if (g) say(g); if (reduced()) draw(performance.now()); } });
      c.addEventListener('mouseleave', function () { S.hov = null; if (reduced()) draw(performance.now()); });
      c.addEventListener('click', function (e) { var r = c.getBoundingClientRect(), mx = (e.clientX - r.left) * W / r.width, my = (e.clientY - r.top) * H / r.height;
        var h = S.hits.filter(function (q) { return mx >= q.x && mx < q.x + q.w && my >= q.y && my < q.y + q.h; })[0]; if (onDan(c, e)) waveNow(); if (!h) return; waveNow();
        S.sel = h.it; say(h.it); counter(); draw(performance.now()); }); }
    counter(); clearance(w);
    S.c = c; S.x = c.getContext('2d'); cancelAnimationFrame(S.raf); draw(performance.now()); }
  /* CLEARANCE RACK (PREVIEW, NOT ACTIVE; owner idea, rules undecided): 4 pieces that rotate once per 144-block chain day, picked from the
   * existing gear catalog (no signature/legendary-exclusive or retired pieces) by sha256(first-block-of-the-day hash + ':clearance:' + i).
   * Display only: no price, no button that burns, nothing changes in the replay. */
  function rackPick(V, G, hash, n) { var pool = (G.ITEMS || []).filter(function (it) { return !it.exclusive && !it.legendary && !(G.RETIRED && G.RETIRED[it.id]) && !(G.REMOVED && G.REMOVED[it.id]) && !it.alias; }), out = [], seen = {};
    for (var i = 0; out.length < n && i < 64 && pool.length; i++) { var h = V.sha(hash + ':clearance:' + i), it = pool[parseInt(h.slice(0, 8), 16) % pool.length]; if (!seen[it.id]) { seen[it.id] = 1; out.push(it); } } return out; }
  function clearance(w) { var el = document.getElementById('shopClearance'), U = window.V2UI, V = window.V2Rules, G = window.V2Gear, R = window.V2Render; if (!el || !U || !V || !G) return;
    var st = U.S ? U.S() : {}, tip = st.tip || w.tip || 0, d = V.day(tip), b0 = d * V.BLOCKS_PER_DAY, H = st.hashes || {}, hb = null;
    for (var b = b0; b <= tip; b++) if (H[b]) { hb = b; break; }
    if (hb == null) { el.innerHTML = '<div class="cr"><b class="cr-h">🏷️ CLEARANCE RACK</b> <span class="cr-pv">Preview, not active</span><div class="cr-none">Restocks when block ' + b0 + '’s hash is in</div></div>'; return; }
    var L = rackPick(V, G, H[hb], 4), T = ['Common', 'Uncommon', 'Rare', 'Legendary'], left = b0 + V.BLOCKS_PER_DAY - tip;
    el.innerHTML = '<div class="cr"><div class="cr-top"><b class="cr-h">🏷️ CLEARANCE RACK</b> <span class="cr-pv">Preview, not active</span></div>' +
      '<div class="cr-row">' + L.map(function (it) { var src = ''; try { src = R.iconCanvas(it.id).toDataURL(); } catch (e) { } return '<div class="cr-it t' + it.tier + '"><span class="cr-tag">SALE</span>' + (src ? '<img alt="" src="' + src + '">' : '') + '<b>' + esc(it.label) + '</b><small>' + esc(lword(it.slot) + ' · ' + (T[it.tier] || '')) + '</small><button type="button" class="q" disabled>Price TBD</button></div>'; }).join('') + '</div>' +
      '<div class="cr-hint small">New rack in ' + left + ' blocks · picked from block ' + hb + '’s hash</div><details class="small muted"><summary>How the rack is picked</summary>Each chain day (144 blocks) the hash of the day’s first block picks 4 pieces from the gear catalog (no signature pieces). Anyone can check it. Buying isn’t wired: prices and rules are still the owner’s call.</details></div>'; }
  var LW = { Headwear: 'Locks', Grip: 'Leverage', Outfits: 'Layers', Drip: 'Luster', Guise: 'Looks', Footwear: 'Leathers' };
  function lword(sl) { var V = window.V2Rules, l = V && V.slotLabel ? V.slotLabel(sl) : sl; return LW[l] ? LW[l] + ' \u00b7 ' + l : l; }
  function hitAt(c, e) { var r = c.getBoundingClientRect(), mx = (e.clientX - r.left) * W / r.width, my = (e.clientY - r.top) * H / r.height; return S.hits.filter(function (q) { return mx >= q.x && mx < q.x + q.w && my >= q.y && my < q.y + q.h; })[0]; }
  function say(g) { S.lt = performance.now(); S.say = g.on != null ? 'On #' + g.on + '. Swap it?' : String(g.label || 'This one').slice(0, 18) + '? Fresh crop!'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function dmg(itemId) { var V = window.V2Rules, it = V && (V.GEAR_BY_ID || {})[itemId]; return it ? 1 + 2 * (it.tier || 0) : 0; }
  /* the counter: in place under the shelves (no pop-up). Pick a pet chip -> gear-damage delta vs what it wears in that slot -> Wear / Take off / Roll. */
  function counter() { var U = window.V2UI, V = window.V2Rules, R = window.V2Render, el = document.getElementById('shopCounter'); if (!el || !U) return; var w = U.world(), ME = U.ME, g = S.sel;
    var pets = U.mine(w).filter(function (p) { return !p.dead; });
    if (!g) { el.innerHTML = '<div class="sc-empty">👆 Tap gear on a shelf</div>' + rollRow(w, pets); bindRoll(el); return; }
    g = w.items[g.gid] || g; S.sel = g; var it = (V.GEAR_BY_ID || {})[g.item] || g, sl = it.slot || g.slot;
    var fit = pets.filter(function (p) { return (p.openSlots || []).indexOf(sl) >= 0; }); if (S.pet == null || !fit.some(function (p) { return p.id === S.pet; })) S.pet = g.on != null ? g.on : fit[0] && fit[0].id;
    var P = w.byId[S.pet], cur = P ? V.wornOf(w, P.id).filter(function (x) { return x.slot === sl; })[0] : null, c = P ? V.equipCheck(w, ME, P.id, g.item) : { ok: false, why: 'no pet with a free ' + sl + ' slot' };
    var d = dmg(g.item) - (cur ? dmg(cur.item) : 0), wearing = cur && cur.gid === g.gid;
    el.innerHTML = '<div class="sc-item"><span class="sc-ic"></span><div><b>' + esc(it.label || g.label) + '</b> <span class="sc-tag">' + esc(lword(sl)) + '</span>' + (g.on != null ? ' <span class="sc-eq">EQUIPPED #' + g.on + '</span>' : '') + '</div></div>' +
      '<div class="sc-pets" id="scPick"></div>' +
      (P ? '<div class="sc-delta">' + (wearing ? 'Worn by #' + P.id : 'Gear dmg <b class="' + (d > 0 ? 'up' : d < 0 ? 'dn' : '') + '">' + (d > 0 ? '+' : '') + d + '</b> vs ' + (cur ? esc(cur.label) : 'empty slot')) + '</div>' : '') +
      '<div class="sc-act">' + (P && !wearing ? '<button type="button" class="btn" id="scWear"' + (c.ok ? '' : ' disabled') + '>👕 Wear on #' + P.id + '</button>' : '') + (g.on != null ? '<button type="button" class="q" id="scOff">Take off</button>' : '') + '</div>' +
      (P && !wearing && !c.ok ? '<div class="sc-why">✋ ' + esc(c.worn ? 'Already wearing it' : c.why) + '</div>' : '') + rollRow(w, pets);
    if (R && R.iconCanvas) el.querySelector('.sc-ic').appendChild(R.iconCanvas(g.item, ''));
    if (window.V2Picker) V2Picker.mount(document.getElementById('scPick'), { w: w, me: ME, selected: String(S.pet), per: 8, sorts: ['score', 'power', 'newest'], records: function () { return fit.map(function (p) { return { key: String(p.id), pets: [p], newest: p.hatchBlock, html: V2Picker.petChip(w) }; }); },
      onPick: function (r) { S.pet = +r.key; S.rollPet = S.pet; counter(); } });
    var wb = document.getElementById('scWear'); if (wb) wb.onclick = function () { if (U.viewOnly && U.viewOnly()) return U.confirmPlans('Equip', [{}]); var c2 = V.equipCheck(U.world(), ME, P.id, g.item); if (!c2.ok) return; op(P.id, sl, c2.gid, 'Equipped ' + (it.label || '') + ' on #' + P.id); };
    var ob = document.getElementById('scOff'); if (ob) ob.onclick = function () { if (U.viewOnly && U.viewOnly()) return U.confirmPlans('Equip', [{}]); op(g.on, sl, null, 'Took ' + (it.label || '') + ' off #' + g.on); };
    bindRoll(el); }
  function rollRow(w, pets) { if (!pets.length) return ''; var p = pets.filter(function (q) { return q.id === (S.pet != null ? S.pet : S.rollPet); })[0] || pets[0]; S.rollPet = p.id;
    return '<div class="sc-roll"><button type="button" class="btn ico-flame" id="scRoll" data-pid="' + p.id + '">🎲 Roll new gear for #' + p.id + ' · 345</button></div>'; }
  function bindRoll(el) { var U = window.V2UI, V = window.V2Rules, rb = document.getElementById('scRoll');
    if (rb) rb.onclick = function () { var id = +rb.dataset.pid; U.confirmPlans('Gear roll for #' + id, [{ tag: V.buildTag('roll', { petId: id }), amount: V.COSTS.roll }]); }; }
  function op(pid, slot, gid, msg) { var U = window.V2UI, St = U.S(); St.ops.push({ kind: 'equip', owner: U.ME, petId: pid, slot: slot, gid: gid, block_index: St.tip }); U.save(); U.render(); S.say = 'Lookin\u2019 sharp!'; S.lt = performance.now(); U.toast(esc(msg) + ' (free)'); }
  window.V2Shop = { rackPick: rackPick, clearance: clearance, render: render, wave: waveNow, select: function (g) { S.sel = g; say(g); waveNow(); counter(); draw(performance.now()); }, hover: function (g) { S.hov = g; if (g) say(g); draw(performance.now()); }, _state: function () { return S; }, LINES: LINES };
})();
