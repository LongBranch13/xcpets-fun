/* XCPETS shop "The XCPETS Lair of Locks, Leverage, Layers, Luster, Looks, and Leathers" (owner's final name 8:01 PM CT; Captain Dan is the shopkeeper character, not in the name) (UI-only mockup, owner 7:18 PM CT; branch pet-shop, NOT LIVE). No rule change, no new burns.
 * An 8-bit cartoon-Roman shop floor on top of the existing Pet Shop: Captain Dan (an affectionate 8-bit caricature of the creator of XCP.fun, Bitcorn Crops, bitcorns.com and DigiRare.io)
 * waves from behind the counter when approached; your owned gear sits on the shelves (real item icons). Tap a shelf item -> the existing racks below jump to
 * that slot (same gear actions as before: pick a pet, tap a slot, equip/unequip). prefers-reduced-motion: static scene. */
(function () {
  'use strict';
  var W = 320, H = 150, RM = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  /* Captain Dan's lines (owner 7:36/7:37 PM CT): affectionate, farm/Bitcorn/Bitcoin humor; facts used: creator of XCP.fun, Bitcorn Crops, bitcorns.com, DigiRare.io. No other bio. */
  var LINES = ['gm from the farm!', 'Fresh off the field!', 'Harvest\u2019s in, matey', 'Gear grows like Bitcorn', 'Plant a roll, reap gear', 'Bitcorn Crops taught me well',
    'XCP.fun built this barn', 'Hand-picked at dawn', 'Every piece, homegrown', 'bitcorns.com sends love', 'DigiRare.com says hi!', 'Rare as a DigiRare', 'Good soil, good drops',
    'Shelves full like silos', 'Tap a crop, kit a pet', 'Ripe for the wearing!', 'Stack sats, stack corn', 'HODL the harvest', 'Ahoy from the cornfield!', 'Fresh harvest, fair deal',
    /* 28 lines approved by the owner Mon Oct 19 2026 (previews/pet-shop/dan-lines-final.md) */
    'Ahoy! THIS! IS! BITCORN!', 'Only 100 CROPS. Sail careful, matey', 'BITCORN can\'t be bought. Only farmed!', '21M BITCORN, just like the big coin', 'Harvest #1 hit April Fools 2018. Legit', 'Land ho! A HELIPAD on the farm', 'Docked the boat at YACHTDOCK',
    'LAMBOGARAGE? I came by ship', 'CORNPARTY on deck, all hands!', 'THESCARECROW guards my shelves', 'FARMHAND wanted. Pay: corn', 'CORNCOMBINE: 364 cards to swab', 'Every farm\'s a Bitcoin address', 'Join a coop, me hearties!',
    'Captain of the Bitcorn fleet, gm', 'Memecoins? Try XCP.fun, sailor', 'XCP.fun: 69 crew to set sail', 'On XCP.fun, no admin key aboard', 'Grails ahoy on DigiRare.com!', 'Card hunting? DigiRare.com, matey', 'Spells of Genesis sailed first',
    'HOMERPEPE: 1 of 1. Arr!', 'Burn a FAKEASF, speak your fake', 'Rare Pepes, Fake Rares, all Bitcoin', 'Counterparty? I AM the party', 'Not your keys, not your corn', 'Batten the hatches, harvest\'s in!', 'Swab the deck, stack the sats'];
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
    x.textAlign = 'center'; px(x, '#000', 33, 1, 256, 19); px(x, '#c8102e', 31, 0, 256, 18); px(x, '#ffd166', 31, 0, 256, 1); px(x, '#ffd166', 31, 17, 256, 1); /* phone pass: banner widened so the long name sits inside it */
    x.font = '6px "Press Start 2P", monospace'; x.fillStyle = '#ffd166'; x.fillText('THE XCPETS LAIR OF', 159, 8);
    x.font = '6px "Press Start 2P", monospace'; x.fillStyle = '#fff6c8'; x.fillText('LOCKS\u00b7LEVERAGE\u00b7LAYERS\u00b7LUSTER\u00b7LOOKS & LEATHERS', 159, 15.5, 250); x.textAlign = 'left';
    px(x, '#3ddc84', 47, 6, 3, 3); px(x, '#3ddc84', 268, 6, 3, 3); /* laurels */
    S.hits = []; var shelves = [[6, 22], [6, 56], [222, 22], [222, 56]], k = 0;
    shelves.forEach(function (s) { px(x, '#7a4f2a', s[0], s[1] + 18, 92, 4); px(x, '#5a3a1e', s[0], s[1] + 22, 92, 2);
      for (var i = 0; i < 5; i++) { var it = S.items[k++], ix = s[0] + 2 + i * 18, iy = s[1]; if (!it) continue; var ic = S.icons[it.item]; var sel = S.sel && S.sel.gid === it.gid, hov = S.hov && S.hov.gid === it.gid, lift = sel || hov ? (reduced() ? 4 : 4 + (Math.floor(t / 200) % 2)) : 0;
        if (it.on != null) { var ga = reduced() ? .9 : .55 + .45 * Math.abs(Math.sin(t / 400)); x.strokeStyle = 'rgba(255,209,102,' + ga + ')'; x.lineWidth = 2; x.strokeRect(ix - 1, iy - 1 - lift, 18, 18); }
        if (ic) x.drawImage(ic, ix, iy - lift + (reduced() || lift ? 0 : (Math.floor(t / 400 + i + k) % 7 === 0 ? -1 : 0)), 16, 16);
        if (it.on != null) { x.font = '5px "Press Start 2P", monospace'; px(x, '#ffd166', ix - 2, iy + 17, 20, 6); x.fillStyle = '#140f24'; x.fillText('EQP', ix + 1, iy + 22); }
        if (sel) { px(x, '#fff', ix - 1, iy - lift - 1, 18, 1); px(x, '#fff', ix - 1, iy - lift + 16, 18, 1); }
        S.hits.push({ x: ix, y: iy - 4, w: 16, h: 22, it: it }); } });
    if (!S.items.length) { x.font = '6px "Press Start 2P", monospace'; x.fillStyle = '#ffd166'; x.fillText('Stash empty: roll gear!', 8, 46); }
    /* owner 9:39 PM CT: the shelves are YOUR stash (not for sale): lock name plates under the top shelves, '+N MORE' when over 20 */
    [[6, 47], [222, 47]].forEach(function (q) { px(x, '#000', q[0] + 13, q[1], 66, 8); px(x, '#3ddc84', q[0] + 14, q[1] + 1, 64, 6); px(x, '#000', q[0] + 17, q[1] + 3, 4, 3); px(x, '#000', q[0] + 18, q[1] + 1, 2, 2); x.font = '5px "Press Start 2P", monospace'; x.fillStyle = '#04140a'; x.fillText('YOUR STASH', q[0] + 23, q[1] + 6); });
    if (S.more > 0) { x.font = '5px "Press Start 2P", monospace'; x.fillStyle = '#ffd166'; x.textAlign = 'right'; x.fillText('+' + S.more + ' MORE', 314, 88); x.textAlign = 'left'; }
    dan(x, DAN.x, DAN.y, t); mood(x, t); px(x, '#7a4f2a', 70, 96, 180, 10); px(x, '#5a3a1e', 70, 106, 180, 30); px(x, '#ffd166', 70, 96, 180, 1); /* counter */
    x.font = '6px "Press Start 2P", monospace'; x.fillStyle = '#ffd166'; x.textAlign = 'center'; x.fillText('YOUR STASH: ' + S.free + ' UNWORN \u00b7 ' + (S.total - S.free) + ' WORN', 160, 120, 176); x.textAlign = 'left';
    px(x, '#4a3626', 0, 136, W, 14); for (var f = 0; f < W; f += 20) px(x, '#3c2b1e', f, 136, 1, 14); /* floor */
    bubble(x, S.say || LINES[S.line % LINES.length], 160, 47);
    if (!reduced()) S.raf = requestAnimationFrame(function (n) { if (n - (S.lt || 0) > 3200) { S.lt = n; S.line++; S.say = null; } draw(n); }); else S.raf = 0; }
  function render(w) { var U = window.V2UI, R = window.V2Render, box = document.getElementById('shopScene'); if (!box || !U || !R || !w) return;
    var ME = U.ME, items = (w.itemList || []).filter(function (g) { return g.owner === ME; }).sort(function (a, b) { return (b.tier || 0) - (a.tier || 0) || (String(a.gid) < String(b.gid) ? -1 : 1); });
    S.total = items.length; S.free = items.filter(function (g) { return g.on == null; }).length; var SL = (window.V2LairQoL ? V2LairQoL.apply(items) : items.filter(function (g) { return g.on == null; }).concat(items.filter(function (g) { return g.on != null; }))); S.items = SL.slice(0, 20); S.more = Math.max(0, SL.length - 20); /* tonight bundle: Lair chip strip narrows/sorts the shelves */
    S.items.forEach(function (g) { if (!S.icons[g.item]) try { S.icons[g.item] = R.iconCanvas(g.item); } catch (e) { } });
    var c = box.querySelector('canvas'); if (!c) { box.innerHTML = '<canvas width="' + W + '" height="' + H + '" role="img" aria-label="The XCPETS Lair of Locks, Leverage, Layers, Luster, Looks, and Leathers: Captain Dan behind the counter, your stash of gear on the shelves"></canvas><div class="shop-hint small">Tap a piece in your stash · pick a pet · wear it</div>'; c = box.querySelector('canvas');
      if (window.IntersectionObserver) new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) waveNow(); }); }, { threshold: 0.5 }).observe(c);
      c.addEventListener('mousemove', function (e) { if (onDan(c, e)) waveNow(); var h = hitAt(c, e); var g = h ? h.it : null; if ((g && g.gid) !== (S.hov && S.hov.gid)) { S.hov = g; if (g) say(g); if (reduced()) draw(performance.now()); } });
      c.addEventListener('dblclick', function () { var wb = document.getElementById('scWear'); if (wb && !wb.disabled) wb.click(); }); /* quick wins: double-tap a shelf piece to wear it (same free equip op) */
      c.addEventListener('mouseleave', function () { S.hov = null; if (reduced()) draw(performance.now()); });
      c.addEventListener('click', function (e) { var r = c.getBoundingClientRect(), mx = (e.clientX - r.left) * W / r.width, my = (e.clientY - r.top) * H / r.height;
        var h = S.hits.filter(function (q) { return mx >= q.x && mx < q.x + q.w && my >= q.y && my < q.y + q.h; })[0]; if (onDan(c, e)) waveNow(); if (!h) return; waveNow();
        S.sel = h.it; say(h.it); counter(); draw(performance.now()); if (window.V2LairQoL) V2LairQoL.viewed(h.it); }); }
    var mo = box.querySelector('.shop-more'); if (S.more > 0) { if (!mo) { box.insertAdjacentHTML('beforeend', '<a href="#" class="shop-more small"></a>'); mo = box.querySelector('.shop-more'); mo.onclick = function (e) { e.preventDefault(); var d = document.querySelector('details.shop-all'); if (d) { d.open = true; d.scrollIntoView({ block: 'start' }); } }; } mo.textContent = '+' + S.more + ' more in your stash: see them all ▸'; } else if (mo) mo.remove();
    counter(); clearance(w); if (window.V2LairQoL) V2LairQoL.mount(w);
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
    if (!g) { var oS = document.querySelector('#shopScene .sc-sign'); if (oS) oS.remove(); var HP = w.byId[S.pet != null ? S.pet : S.rollPet] || pets[0]; el.innerHTML = (HP ? hero(w, HP) : '') + '<div class="sc-empty">👆 Tap a piece in your stash</div>' + rollRow(w, pets); if (HP) paintHero(el, w, HP); bindRoll(el); return; }
    g = w.items[g.gid] || g; S.sel = g; var it = (V.GEAR_BY_ID || {})[g.item] || g, sl = it.slot || g.slot;
    var fit = pets.filter(function (p) { return (p.openSlots || []).indexOf(sl) >= 0; }); if (S.pet == null || !fit.some(function (p) { return p.id === S.pet; })) S.pet = g.on != null ? g.on : fit[0] && fit[0].id;
    var P = w.byId[S.pet], cur = P ? V.wornOf(w, P.id).filter(function (x) { return x.slot === sl; })[0] : null, c = P ? V.equipCheck(w, ME, P.id, g.item) : { ok: false, why: 'no pet with a free ' + sl + ' slot' };
    var d = dmg(g.item) - (cur ? dmg(cur.item) : 0), wearing = cur && cur.gid === g.gid;
    var tot0 = P ? V.wornOf(w, P.id).reduce(function (s, x) { return s + dmg(x.item); }, 0) : 0, tot1 = tot0 + (wearing ? 0 : d);
    if (S.moodFor !== g.gid + ':' + S.pet) { S.moodFor = g.gid + ':' + S.pet; S.mood = wearing || !P ? null : d > 0 ? 'up' : d < 0 ? 'shrug' : null; S.moodUntil = performance.now() + 2600; if (S.mood) { S.say = S.mood === 'up' ? 'Upgrade! \u{1F44D}' : 'Meh. Your call.'; S.lt = performance.now(); } }
    /* sticky-feed-bar (owner 9:30 PM CT): the piece info (name, slot, tier, gear-damage diff vs worn, Wear / Take off) is a price-tag sign INSIDE the shop scene by Dan. */
    var TN = ['Common', 'Uncommon', 'Rare', 'Legendary'], tn = TN[it.tier != null ? it.tier : g.tier || 0] || '', dd = tot1 - tot0;
    var sign = '<div class="sc-sign" role="status"><div class="sc-item"><span class="sc-ic"></span><div><b>' + esc(it.label || g.label) + '</b><br><span class="sc-tag">' + esc(lword(sl)) + '</span> <span class="sc-tag">' + (it.exclusive || g.legendary ? '★ ' : '') + esc(tn) + '</span>' + (g.on != null ? ' <span class="sc-eq">EQUIPPED #' + g.on + '</span>' : '') + '</div></div>' +
      (P ? '<div class="sc-big ' + (dd > 0 ? 'up' : dd < 0 ? 'dn' : '') + '">\u2694 ' + tot0 + ' \u2192 ' + tot1 + ' <b>' + (dd > 0 ? '+' + dd : dd < 0 ? dd : '\u00b10') + '</b></div>' +
        '<div class="sc-delta">' + (wearing ? 'Worn by #' + P.id : 'on #' + P.id + ' · <b class="' + (d > 0 ? 'up' : d < 0 ? 'dn' : '') + '">' + (d > 0 ? '+' : '') + d + '</b> vs ' + (cur ? esc(cur.label) : 'empty slot')) + '</div>' : '') +
      '<div class="sc-act">' + (P && !wearing ? '<button type="button" class="btn" id="scWear"' + (c.ok ? '' : ' disabled') + '>👕 Wear on #' + P.id + '</button>' : '') + (g.on != null ? '<button type="button" class="q" id="scOff">Take off</button>' : '') + '</div>' +
      (P && !wearing && !c.ok ? '<div class="sc-why">✋ ' + esc(c.worn ? 'Already wearing it' : c.why) + '</div>' : '') + '</div>';
    var scn = document.getElementById('shopScene'), old = scn && scn.querySelector('.sc-sign'); if (old) old.remove(); if (scn) scn.insertAdjacentHTML('beforeend', sign);
    el.innerHTML = (P ? hero(w, P) : '') + (P ? tryOn(w, P, g, cur, sl, wearing, tot0, tot1) : '') + '<div class="sc-pets" id="scPick"></div><div class="sc-act sc-act-anchor"></div>' + rollRow(w, pets);
    var sgn = scn && scn.querySelector('.sc-sign');
    if (R && R.iconCanvas && sgn) sgn.querySelector('.sc-ic').appendChild(R.iconCanvas(g.item, ''));
    if (P) { paintTry(el, w, P, g, sl, wearing); paintHero(el, w, P); } bindBest(el, w, P);
    if (window.V2Picker) V2Picker.mount(document.getElementById('scPick'), { w: w, me: ME, selected: String(S.pet), per: 8, sorts: ['score', 'power', 'newest'], records: function () { return fit.map(function (p) { return { key: String(p.id), pets: [p], newest: p.hatchBlock, html: V2Picker.petChip(w) }; }); },
      onPick: function (r) { S.pet = +r.key; S.rollPet = S.pet; counter(); } });
    var wb = document.getElementById('scWear'); if (wb) wb.onclick = function () { if (U.viewOnly && U.viewOnly()) return U.confirmPlans('Equip', [{}]); var c2 = V.equipCheck(U.world(), ME, P.id, g.item); if (!c2.ok) return; op(P.id, sl, c2.gid, 'Equipped ' + (it.label || '') + ' on #' + P.id); };
    var ob = document.getElementById('scOff'); if (ob) ob.onclick = function () { if (U.viewOnly && U.viewOnly()) return U.confirmPlans('Equip', [{}]); op(g.on, sl, null, 'Took ' + (it.label || '') + ' off #' + g.on); };
    bindRoll(el); }
  /* LAIR UX (quick wins 2026-10-19, display + the same free local equip op; no rule change): live try-on (the chosen pet now -> wearing the piece),
   * a big gear-damage readout (⚔ 12 -> 15 +3), WEARING NOW tag on what it has on, 'Wear best' per slot, double-tap to wear, a poof when gear changes,
   * Dan thumbs-up on an upgrade / shrug on a downgrade. */
  function tryOn(w, P, g, cur, sl, wearing, tot0, tot1) { var dd = tot1 - tot0;
    return '<div class="sc-try' + (S.poofT && performance.now() - S.poofT < 900 ? ' poof' : '') + '"><div class="sc-tp"><canvas class="sc-now" width="32" height="32"></canvas><small>NOW</small></div><span class="sc-arrow">\u2192</span><div class="sc-tp"><canvas class="sc-after" width="32" height="32"></canvas><small>' + (wearing ? 'WEARING' : 'TRY-ON') + '</small></div>' +
      (cur ? '<div class="sc-wearing">WEARING NOW: ' + esc(cur.label || '') + '</div>' : '<div class="sc-wearing empty">' + esc(lword(sl)) + ' slot empty</div>') + '</div>'; }
  /* sticky-feed-bar 2026-10-19 (owner 9:27 PM CT 'can't see my pet'): the Lair pet shown big next to its six slots (worn piece / empty / locked). Display only. */
  function hero(w, P) { var V = window.V2Rules, worn = V.wornOf(w, P.id), open = P.openSlots || [];
    var rows = SLOT_ORDER.map(function (sl) { var x = worn.filter(function (q) { return q.slot === sl; })[0], on = open.indexOf(sl) >= 0;
      return '<li class="' + (x ? 'on' : on ? 'open' : 'lock') + '"><span>' + esc(lword(sl).split(' ')[0]) + '</span> ' + (x ? esc(x.label || '') : on ? 'empty' : '🔒') + '</li>'; }).join('');
    return '<div class="sc-hero"><div class="sc-hp"><canvas class="sc-hc" width="32" height="32"></canvas><b>#' + P.id + ' ' + esc(String(P.name || '')) + '</b><small>' + esc(V.speciesLabel(P.species)) + '</small></div><ul class="sc-slots">' + rows + '</ul></div>'; }
  function paintHero(el, w, P) { put(el.querySelector('.sc-hc'), framesFor(w, P, window.V2Rules.wornOf(w, P.id).map(function (x) { return x.item; }))); }
  var SLOT_ORDER = ['head', 'hand', 'body', 'back', 'face', 'feet'];
  function framesFor(w, P, ids) { var R = window.V2Render; try { return R.framesWith(P.art, P.stage, ids, P.blackEye ? ['v2-black-eye'] : []); } catch (e) { return null; } }
  function put(c, fr) { if (!c || !fr || !fr[0]) return; try { c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(fr[0].data), 32, 32), 0, 0); } catch (e) { } }
  function paintTry(el, w, P, g, sl, wearing) { var V = window.V2Rules, worn = V.wornOf(w, P.id), now = worn.map(function (x) { return x.item; }), aft = worn.filter(function (x) { return x.slot !== sl; }).map(function (x) { return x.item; }).concat([g.item]);
    put(el.querySelector('.sc-now'), framesFor(w, P, now)); put(el.querySelector('.sc-after'), framesFor(w, P, wearing ? now : aft)); }
  function bindBest(el, w, P) { var U = window.V2UI, V = window.V2Rules, ME = U.ME; if (!P) return; var free = (w.itemList || []).filter(function (x) { return x.owner === ME && x.on == null; }), worn = V.wornOf(w, P.id), out = [];
    (P.openSlots || []).forEach(function (sl) { var cur = worn.filter(function (x) { return x.slot === sl; })[0], c0 = cur ? dmg(cur.item) : 0;
      var best = free.filter(function (x) { var it = (V.GEAR_BY_ID || {})[x.item]; return it && it.slot === sl && V.equipCheck(w, ME, P.id, x.item).ok; }).sort(function (a, b) { return dmg(b.item) - dmg(a.item); })[0];
      if (best && dmg(best.item) > c0) out.push({ sl: sl, g: best, d: dmg(best.item) - c0 }); });
    if (!out.length) return; var row = document.createElement('div'); row.className = 'sc-best'; row.innerHTML = '<span class="sc-best-h">\u26a1 Wear best on #' + P.id + ':</span> ' + out.map(function (o, i) { return '<button type="button" class="q" data-best="' + i + '">' + esc(lword(o.sl).split(' ')[0]) + ' +' + o.d + '</button>'; }).join(' ');
    var act = el.querySelector('.sc-act'); (act || el).parentNode.insertBefore(row, act ? act.nextSibling : null);
    row.querySelectorAll('[data-best]').forEach(function (b) { b.onclick = function () { if (U.viewOnly && U.viewOnly()) return U.confirmPlans('Equip', [{}]); var o = out[+b.dataset.best], c2 = V.equipCheck(U.world(), ME, P.id, o.g.item); if (!c2.ok) return; S.sel = o.g; op(P.id, o.sl, c2.gid, 'Equipped ' + ((V.GEAR_BY_ID || {})[o.g.item] || {}).label + ' on #' + P.id); }; }); }
  function mood(x, t) { if (!S.mood || t > S.moodUntil) return; var ox = DAN.x, oy = DAN.y;
    if (S.mood === 'up') { px(x, '#000', ox + 33, oy + 11, 6, 8); px(x, '#c6846f', ox + 34, oy + 14, 4, 4); px(x, '#c6846f', ox + 35, oy + 10, 2, 4); px(x, '#3ddc84', ox + 31, oy + 4, 9, 1); }
    else { px(x, '#c6846f', ox - 6, oy + 12, 4, 3); px(x, '#c6846f', ox + 34, oy + 12, 4, 3); px(x, '#1a1c1e', ox - 3, oy + 15, 3, 4); px(x, '#1a1c1e', ox + 33, oy + 15, 3, 4); px(x, '#ff5d5d', ox + 14, oy - 4, 4, 1); } }
  /* ROLL BY SPECIES (sticky-feed-bar 2026-10-19, owner 9:24 PM CT; cosmetic, SAME burn): pick a species with the shared picker, the roll goes to the
   * same pet:roll:ID tag (345 XCPETS) for ONE of your living pets of that species (the Lair pet if it is that species, else the one with the most open
   * slots, then lowest #). The rule rolls into a random OPEN slot of that pet from its species' pool, and the piece is worn by that pet.
   * Target 'sel' (board selection, the old sticky-bar Roll gear ×N) clicks the same #bRoll handler as before. */
  function rollPick(w, pets, sp) { var L = pets.filter(function (q) { return q.species === sp; }); if (!L.length) return null; var lp = S.pet != null ? S.pet : S.rollPet;
    return L.filter(function (q) { return q.id === lp; })[0] || L.slice().sort(function (a, b) { return (b.openSlots || []).length - (a.openSlots || []).length || a.id - b.id; })[0]; }
  function slotWords(P) { return (P.openSlots || []).map(function (sl) { return lword(sl).split(' ')[0]; }); }
  function rollRow(w, pets) { if (!pets.length) return ''; var V = window.V2Rules, U = window.V2UI, cur = pets.filter(function (q) { return q.id === (S.pet != null ? S.pet : S.rollPet); })[0] || pets[0];
    if (!S.rollSp || !pets.some(function (q) { return q.species === S.rollSp; })) S.rollSp = cur.species;
    var P = rollPick(w, pets, S.rollSp), tgt = (window.V2LairQoL && V2LairQoL.target()) || 'pet', nSel = U.S().sel.length;
    if (tgt === 'sel' && nSel) { var rn = Math.max(1, Math.min(10, Number((document.getElementById('rollN') || {}).value) || 1)), rq = V.rollQueue(w, U.ME, U.S().sel, rn);
      return '<div class="sc-roll"><div class="sc-rh">🎲 Roll gear · your ' + nSel + ' selected pet' + (nSel === 1 ? '' : 's') + '</div><label class="small sc-rn">Rolls per pet <input class="amt small" id="scRollN" type="number" min="1" max="10" value="' + rn + '" aria-label="Rolls per pet"></label>' +
        '<button type="button" class="btn ico-flame" id="scRollSel"' + (rq.length ? '' : ' disabled') + '>🎲 Roll ' + rq.length + ' time' + (rq.length === 1 ? '' : 's') + ' <span class="cost">' + fmtN(rq.length * V.COSTS.roll) + ' XCPETS</span></button>' + (rq.length ? '' : '<div class="sc-why">✋ No living pet of yours selected</div>') + '</div>'; }
    S.rollPet = P.id; var lg = (V.legendaryOf && V.legendaryOf(P.species) || [])[0] || null, sw = slotWords(P);
    return '<div class="sc-roll"><div class="sc-rh">🎲 Roll gear · pick a species</div><div class="sc-pets" id="scSpPick"></div>' +
      '<div class="sc-rinfo"><b>' + esc(V.speciesLabel(P.species)) + '</b> → rolls on <b>#' + P.id + '</b> ' + esc(String(P.name || '')) + '<br>Can land in: ' + (sw.length ? sw.map(function (x) { return '<span class="sc-tag">' + esc(x) + '</span>'; }).join(' ') : '—') +
      (lg ? '<br><small>★ ' + esc(V.speciesLabel(P.species)) + ' signature hat: ' + esc(lg.label) + ' (Legendary pets)</small>' : '') + '</div>' +
      '<button type="button" class="btn ico-flame" id="scRoll" data-pid="' + P.id + '">🎲 Roll for ' + esc(V.speciesLabel(P.species)) + ' <span class="cost">345 XCPETS</span></button></div>'; }
  function fmtN(n) { return Number(n).toLocaleString('en-US'); }
  function bindRoll(el) { var U = window.V2UI, V = window.V2Rules, rb = document.getElementById('scRoll');
    if (rb) rb.onclick = function () { var id = +rb.dataset.pid; U.confirmPlans('Gear roll for #' + id, [{ tag: V.buildTag('roll', { petId: id }), amount: V.COSTS.roll }]); };
    var rs = document.getElementById('scRollSel'); if (rs) rs.onclick = function () { var b = document.getElementById('bRoll'); if (b) b.click(); };
    var rn = document.getElementById('scRollN'); if (rn) rn.oninput = function () { var h = document.getElementById('rollN'); if (h) { h.value = rn.value; h.dispatchEvent(new Event('input')); } var w = U.world(), pets = U.mine(w).filter(function (p) { return !p.dead; }), q = V.rollQueue(w, U.ME, U.S().sel, Math.max(1, Math.min(10, Number(rn.value) || 1))); if (rs) { rs.disabled = !q.length; rs.innerHTML = '🎲 Roll ' + q.length + ' time' + (q.length === 1 ? '' : 's') + ' <span class="cost">' + fmtN(q.length * V.COSTS.roll) + ' XCPETS</span>'; } };
    var pk = document.getElementById('scSpPick'); if (pk && window.V2Picker) { var w = U.world(), pets = U.mine(w).filter(function (p) { return !p.dead && !p.released; }), by = {};
      pets.forEach(function (p) { (by[p.species] = by[p.species] || []).push(p); });
      V2Picker.mount(pk, { w: w, me: U.ME, selected: String(S.rollSp), per: 8, sorts: ['score', 'power', 'newest'], records: function () { return Object.keys(by).map(function (sp) { var L = by[sp]; return { key: sp, pets: L, newest: Math.max.apply(null, L.map(function (p) { return p.hatchBlock || 0; })),
        html: function () { var b = rollPick(w, pets, sp); return '<b>' + esc(V.speciesLabel(sp)).slice(0, 14) + '</b><span>' + L.length + ' pet' + (L.length === 1 ? '' : 's') + '</span><small>#' + b.id + ' · ' + (b.openSlots || []).length + ' slot' + ((b.openSlots || []).length === 1 ? '' : 's') + '</small>'; } }; }); },
        onPick: function (r) { S.rollSp = r.key; var b = rollPick(w, pets, r.key); if (b) S.rollPet = b.id; counter(); } }); } }
  function refreshRoll() { counter(); }
  function op(pid, slot, gid, msg) { var U = window.V2UI, St = U.S(); St.ops.push({ kind: 'equip', owner: U.ME, petId: pid, slot: slot, gid: gid, block_index: St.tip }); U.save(); S.poofT = performance.now(); S.moodFor = null; U.render(); S.say = 'Lookin\u2019 sharp!'; S.lt = performance.now(); U.toast(esc(msg) + ' (free)'); }
  window.V2Shop = { drawDan: dan, rackPick: rackPick, clearance: clearance, render: render, wave: waveNow, select: function (g) { S.sel = g; say(g); waveNow(); counter(); draw(performance.now()); }, hover: function (g) { S.hov = g; if (g) say(g); draw(performance.now()); }, _state: function () { return S; }, refreshRoll: refreshRoll, LINES: LINES, dmg: dmg, op: op };
})();
