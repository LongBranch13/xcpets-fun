/* XCPETS play demo UI (play money only; no network calls). Game rules: GameCore; art: PetCore; wallet + loot: DemoCore. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  // hunger label; 'N days until it dies' once a pet is at risk (5 demo days or fewer left), red on the last day
  function fedLabel(p) { if (p.dead) return '🪦 Died of neglect'; if (p.feedsToday >= p.feedLimit) return 'Fed today: ✓'; if (p.daysLeft != null && p.daysLeft <= 5) return 'Hungry: ' + p.daysLeft + (p.daysLeft === 1 ? ' day' : ' days') + ' until it dies' + (p.daysLeft === 1 ? ' (last day to feed!)' : ''); return 'Hungry: feed today'; }
  function fedCls(p) { return p.feedsToday >= p.feedLimit ? '' : p.daysLeft === 1 ? ' danger' : p.daysLeft != null && p.daysLeft <= 5 ? ' warn' : ''; }
  function deathNote(p) { return '🪦 ' + p.art.defaultName + ' died of neglect on ' + new Date(p.dead.at).toLocaleDateString() + ' after ' + DemoCore.NEGLECT_DAYS + ' full demo days without a meal. It rests in the Pet Cemetery: no feeding, evolving, rolls, keys or gear, and its gear went back to your inventory.'; }
  var cemView = false;
  var fmt = function (n) { return Number(n).toLocaleString('en-US', { maximumFractionDigits: 8 }); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  // loot and fake hashes use the browser's crypto RNG; every roll is saved in the same write as its burn
  function cryptoRand() { var a = new Uint32Array(1); window.crypto.getRandomValues(a); return a[0] / 4294967296; }
  var demo = new DemoCore(window.localStorage, cryptoRand);
  var C = DemoCore.COSTS, T = DemoCore.THRESHOLDS, N = GameCore.STAGE_NAMES;
  var SLOT_LABEL = { band: 'Band', armor: 'Armor', cape: 'Cape', weapon: 'Weapon', crown: 'Crown', face: 'Face', back: 'Back', feet: 'Feet' };
  var SLOT_ICON = { band: '🎗️', armor: '🛡️', cape: '🧣', weapon: '⚔️', crown: '👑', face: '👀', back: '🚩', feet: '🪙' };

  var animated = [];
  setInterval(function () { animated.forEach(function (a) { a.f = (a.f + 1) % a.frames.length; paint(a.ctx, a.frames[a.f]); }); }, 280);
  function paint(ctx, img) { ctx.putImageData(new ImageData(new Uint8ClampedArray(img.data), 32, 32), 0, 0); }
  function show(canvas, pet, stage, gearOverride, bonusGear) {
    var frames = PetCore.renderFrames(pet, { stage: stage, gearOverride: gearOverride || {} }), ctx = canvas.getContext('2d');
    if (bonusGear && window.BonusGear) BonusGear.decorate(PetCore, pet, stage, frames, bonusGear, gearOverride);
    paint(ctx, frames[0]);
    animated = animated.filter(function (a) { return a.canvas !== canvas && document.body.contains(a.canvas); });
    animated.push({ canvas: canvas, ctx: ctx, frames: frames, f: 0 });
  }
  function speciesLabel(id) { var s = PetCore.SPECIES.filter(function (x) { return x.id === id; })[0]; return s ? s.label : id; }
  function tierOf(p) { return PetCore.TIERS[p.art.tierIndex]; }
  function itemPill(it) { return '<span class="pill tier tier-' + it.tierId + '">' + SLOT_ICON[it.slot] + ' ' + esc(it.label) + (it.species ? ' <small>(' + esc(speciesLabel(it.species)) + ' only)</small>' : '') + '</span>'; }
  function toast(html) {
    var t = document.createElement('div'); t.className = 'toast'; t.innerHTML = html; $('toasts').appendChild(t);
    setTimeout(function () { t.remove(); }, 5000);
  }
  function lootToast(d) { if (d && d.token) toast('🎟️ +1 free roll token'); }
  function rollToast(r) {
    toast('Rolled: ' + PetCore.TIERS[r.item.tier].label + ' ' + esc(r.item.label) + ' <span class="muted">(' + SLOT_LABEL[r.item.slot].toLowerCase() +
      (r.equipped ? ', equipped' : ', added to your inventory') + ')</span>');
    if (r.key) toast('🔑 +1 Slot Key');
  }


  function render() {
    var st = demo.state();
    $('bal').innerHTML = fmt(st.balance) + ' <small>play XCPETS</small>';
    $('tokens').textContent = st.tokens; $('keys').textContent = st.keys;
    var box = $('pets'); box.innerHTML = '';
    $('noPets').style.display = st.pets.length ? 'none' : '';
    // paginated (PAGE cards; only visible cards render/animate), filter by rarity, sort
    $('nAlive').textContent = st.pets.length; $('nDead').textContent = st.cemetery.length;
    var ft = $('fTier').value, list = cemView ? st.cemetery.slice() : st.pets.filter(function (p) { return ft === '' || p.art.tierIndex === Number(ft); }), so = $('fSort').value;
    if (!cemView) list.sort(so === 'tier' ? function (a, b) { return b.art.tierIndex - a.art.tierIndex || b.id - a.id; } : so === 'stage' ? function (a, b) { return b.stage - a.stage || b.id - a.id; } : function (a, b) { return b.id - a.id; });
    listIds = list.map(function (p) { return p.id; });
    var pages = Math.max(1, Math.ceil(list.length / PAGE)); page = Math.min(page, pages - 1);
    animated = animated.filter(function (a) { return document.body.contains(a.canvas) && !box.contains(a.canvas); });
    list.slice(page * PAGE, page * PAGE + PAGE).forEach(function (p) { box.appendChild(petCard(p)); });
    $('petCount').textContent = cemView ? list.length + ' in the Pet Cemetery' : list.length + ' of ' + st.pets.length + ' pets';
    if (cemView && !list.length) box.innerHTML = '<p class="muted">Your Pet Cemetery is empty. Feed each pet at least once every ' + DemoCore.NEGLECT_DAYS + ' demo days to keep it that way.</p>';
    $('pgInfo').textContent = 'page ' + (page + 1) + ' / ' + pages; $('pgPrev').disabled = page === 0; $('pgNext').disabled = page >= pages - 1;
    document.querySelectorAll('button.bulk').forEach(function (b) { b.disabled = DemoCore.BULK[b.dataset.bulk].price > st.balance; });
    $('hatch').disabled = C.hatch > st.balance;
    renderInv(st); $('petBadge').textContent = st.pets.length;
    var sh = st.shared;
    $('sharedBar').style.width = Math.round(sh.progress * 100) + '%';
    $('sharedTxt').textContent = 'Stage ' + sh.stageName + ' · ' + fmt(sh.burned) + ' play XCPETS burned in total' +
      (sh.next == null ? ' · fully grown' : ' · ' + fmt(sh.next - sh.burned) + ' to the next stage');
    $('log').innerHTML = st.log.slice(-50).reverse().map(function (l, i) {
      return '<tr><td>' + (st.log.length - i) + '</td><td><code>' + esc(l.tag || '(none)') + '</code></td><td>' + fmt(l.amount) + '</td><td>' + esc(l.msg) + '</td></tr>';
    }).join('');
  }

  // ---- Inventory: picture grid grouped by slot. Each icon = the item worn by a plain pet (its own species for signature gear).
  var INV_ORDER = ['band', 'armor', 'cape', 'weapon', 'crown', 'face', 'back', 'feet'], iconCache = {};
  function itemFrames(it) {
    var key = it.id + '|' + (it.species || ''); if (iconCache[key]) return iconCache[key];
    var base = PetCore.characterPet(it.species || 'pepe', { tier: 'common', bgColor: '#142018' }), go = {}, extra = {};
    if (it.overlay || it.bonus) extra[it.slot] = it.id; else go[it.slot] = it.id;
    var fr = PetCore.renderFrames(base, { stage: 3, gearOverride: go });
    if (window.BonusGear && Object.keys(extra).length) BonusGear.decorate(PetCore, base, 3, fr, extra, go);
    return (iconCache[key] = fr);
  }
  function renderInv(st) {
    var box = $('inv'); box.innerHTML = '';
    animated = animated.filter(function (a) { return document.body.contains(a.canvas) && !box.contains(a.canvas); });
    if (!st.inventory.length) { box.innerHTML = '<p class="muted small">No gear yet. Open a pet and tap Roll on a slot.</p>'; return; }
    INV_ORDER.forEach(function (slot) {
      var items = st.inventory.filter(function (it) { return it.slot === slot; }).sort(function (a, b) { return b.tier - a.tier || b.uid - a.uid; });
      if (!items.length) return;
      var h = document.createElement('div'); h.className = 'invslot'; h.textContent = SLOT_ICON[slot] + ' ' + SLOT_LABEL[slot] + (['face', 'back', 'feet'].indexOf(slot) >= 0 ? ' (bonus)' : '') + ' · ' + items.length; box.appendChild(h);
      var g = document.createElement('div'); g.className = 'invgrid'; box.appendChild(g);
      items.forEach(function (it) {
        var c = document.createElement('div'); c.className = 'invcard t' + it.tier; c.tabIndex = 0; c.title = it.label + ' (' + PetCore.TIERS[it.tier].label + ')';
        c.innerHTML = '<canvas width="32" height="32"></canvas>' + (it.on ? '<span class="worn">#' + it.on + '</span>' : '') + esc(it.label);
        g.appendChild(c);
        var fr = itemFrames(it), ctx = c.querySelector('canvas').getContext('2d'); paint(ctx, fr[0]);
        c.onclick = c.onkeydown = function (e) { if (e.type === 'click' || e.key === 'Enter' || e.key === ' ') { if (e.preventDefault) e.preventDefault(); openItem(it.uid); } };
      });
    });
  }
  var itemUid = null;
  function openItem(uid) {
    itemUid = uid; var st = demo.state(), it = st.inventory.filter(function (x) { return x.uid === uid; })[0]; if (!it) return closeItem();
    $('itemTitle').textContent = SLOT_ICON[it.slot] + ' ' + it.label;
    show($('itemCanvas'), PetCore.characterPet(it.species || 'pepe', { tier: 'common', bgColor: '#142018' }), 3, (it.overlay || it.bonus) ? {} : (function () { var o = {}; o[it.slot] = it.id; return o; })(), (it.overlay || it.bonus) ? (function () { var o = {}; o[it.slot] = it.id; return o; })() : null);
    var fits = st.pets.filter(function (p) { return !it.species || p.art.species === it.species; });
    $('itemInfo').innerHTML = '<p>' + itemPill(it) + '<br><span class="small muted">' + SLOT_LABEL[it.slot] + ' slot · ' + PetCore.TIERS[it.tier].label + (it.species ? ' · ' + esc(speciesLabel(it.species)) + ' signature gear' : '') +
      (it.on ? ' · worn by pet #' + it.on : ' · not worn') + '</span></p>' +
      (fits.length ? '<div class="row" style="justify-content:center"><select class="pick" id="itemPet" aria-label="Pick a pet">' + fits.map(function (p) {
        return '<option value="' + p.id + '"' + (p.id === it.on ? ' selected' : '') + '>#' + p.id + ' ' + esc(p.art.defaultName) + ' (' + esc(speciesLabel(p.art.species)) + ', ' + p.stageName + ')</option>'; }).join('') +
        '</select><button class="btn" id="itemEquip">Equip</button>' + (it.on ? '<button class="q" id="itemOff">Take off</button>' : '') + '</div>' : '<p class="muted small">No pet can wear this yet' + (it.species ? ' (needs a ' + esc(speciesLabel(it.species)) + ')' : '') + '.</p>');
    $('itemMsg').textContent = ''; $('itemBox').classList.add('on');
    var eq = $('itemEquip'); if (eq) eq.onclick = function () { itemAct(function () { demo.equip(Number($('itemPet').value), uid); }); };
    var off = $('itemOff'); if (off) off.onclick = function () { itemAct(function () { demo.unequip(it.on, it.slot); }); };
  }
  function itemAct(fn) { try { fn(); render(); openItem(itemUid); $('itemMsg').className = 'msg ok'; $('itemMsg').textContent = 'Done.'; } catch (e) { $('itemMsg').className = 'msg err'; $('itemMsg').textContent = e.message; if (!e.demo) throw e; } }
  function closeItem() { $('itemBox').classList.remove('on'); itemUid = null; }
  $('itemClose').onclick = closeItem; $('itemBox').onclick = function (e) { if (e.target === $('itemBox')) closeItem(); };
  function nextLine(p) {
    if (p.ascended) return 'Mythic';
    if (p.canEvolve) return 'Ready to evolve';
    return '→ ' + N[p.stage + 1] + ': ' + p.mealsNext + ' 🍖';
  }
  function lootLine(p) {
    if (!p.stage) return '<div class="small muted">Rolls: hatch first.</div>';
    if (!p.baseSlots) return '<div class="small muted">Common pets have no base gear slots (gear by rarity: Uncommon 2, Rare 4, Legendary 5). Bonus slots still open with a Slot Key.</div>';
    var names = ['Common', 'Uncommon', 'Rare', 'Legendary'], o = DemoCore.rarityOdds(p.art.tierIndex, 'band', p.art.species);
    return '<div class="small loot"><b>Roll odds (' + PetCore.TIERS[p.art.tierIndex].label + ' pet, ' + p.baseSlots + ' slots; band shown, items up to its rarity, own rarity 4x):</b> ' + o.map(function (w, i) { return w ? names[i] + ' ' + Math.round(w * 100) + '%' : ''; }).filter(Boolean).join(' / ') +
      ' <span class="muted">(' + fmt(C.roll) + ' per roll or 1 free token; 1% Slot Key chance per roll)</span></div>';
  }
  function slotHtml(sl, inv, tokens, species, tierIdx) {
    var label = SLOT_ICON[sl.slot] + ' ' + SLOT_LABEL[sl.slot];
    if (!sl.unlocked) return sl.bonus ? '' : '<div class="slot" style="opacity:.45">' + label + ' <span class="muted">🔒 locked (higher rarity)</span></div>';
    var n = inv.filter(function (it) { return it.slot === sl.slot && (!it.species || it.species === species) && (!sl.item || it.uid !== sl.item.uid); }).length;
    var sel = n ? '<button class="gpill equip" data-slot="' + sl.slot + '">' + (sl.item ? 'Swap' : 'Equip') + ' (' + n + ')</button>' : '';
    return '<div class="slot">' + label + ' ' + (sl.item ? itemPill(sl.item) + ' <button class="gpill off unequip" data-slot="' + sl.slot + '">Take off</button>' : '<span class="muted">empty</span>') +
      (sel ? ' ' + sel : '') + ' <button class="q roll" data-slot="' + sl.slot + '">Roll (' + fmt(C.roll) + ')</button>' +
      (tokens ? '<button class="q roll tok" data-slot="' + sl.slot + '">🎟️</button>' : '') + '</div>';
  }
  function slotsHtml(p, inv, st) {
    var nb = p.bonusSlots.filter(function (x) { return x.unlocked; }).length;
    return p.slots.map(function (sl) { return slotHtml(sl, inv, st.tokens, p.art.species, p.art.tierIndex); }).join('') +
      (st.keys && nb < 3 ? '<div class="small" style="margin-top:4px"><button class="q usekey">🔑 Use key (' + st.keys + ')</button></div>' : '') +
      p.bonusSlots.map(function (sl) { return slotHtml(sl, inv, st.tokens, p.art.species, p.art.tierIndex); }).join('');
  }
  function lab(list, id) { var x = (PetCore[list] || []).filter(function (q) { return q.id === id; })[0]; return x ? x.label : id; }
  function chip(txt, cls) { return '<span class="chip' + (cls ? ' ' + cls : '') + '">' + esc(txt) + '</span>'; }
  function traitChips(p) {
    var a = p.art;
    return chip('▦ ' + lab('PATTERNS', a.pattern)) + chip('👁 ' + lab('EYES', a.eyes)) + chip('🖼 ' + lab('BACKGROUNDS', a.background)) + (PetCore.cheeksId && PetCore.cheeksId(a) !== 'none' ? chip('☺ ' + PetCore.CHEEKS.filter(function (c) { return c.id === PetCore.cheeksId(a); })[0].label) : (a.cheeks === true ? chip('☺ Blush') : ''));
  }
  function gearChips(p) {
    return p.slots.concat(p.bonusSlots).filter(function (sl) { return sl.unlocked && sl.item; })
      .map(function (sl) { return '<span class="chip gearchip tier-' + sl.item.tierId + '">' + SLOT_ICON[sl.slot] + ' ' + esc(sl.item.label) + '</span>'; }).join('');
  }
  // My Pets gallery card: overview only (no actions). Click / Enter opens the detail view, where every action lives.
  function petCard(p) {
    var t = tierOf(p), d = document.createElement('div'); d.className = 'pet card'; d.id = 'pet-' + p.id;
    d.setAttribute('role', 'button'); d.tabIndex = 0; d.setAttribute('aria-label', 'Open ' + p.art.defaultName + ' #' + p.id);
    var fed = p.ascended ? '' : '<span class="chip' + (p.dead ? ' dead' : fedCls(p)) + '">' + fedLabel(p) + '</span>';
    if (p.dead) d.className = 'pet card dead';
    d.innerHTML = '<canvas class="pixel sprite" width="32" height="32"></canvas>' +
      '<div class="ov"><h4>' + esc(p.art.defaultName) + ' <span class="muted small">#' + p.id + '</span></h4>' +
      '<div class="chips">' + chip(speciesLabel(p.art.species)) + '<span class="pill tier tier-' + t.id + '">' + t.label + '</span>' + chip(p.stageName, 'stg') + fed + '</div>' +
      '<div class="bar" aria-label="progress to next stage"><i style="width:' + Math.round(p.progress * 100) + '%"></i></div>' +
      '<div class="hunger" aria-label="hunger meter" title="Hunger ' + Math.round(p.hunger * 100) + '%"><i style="width:' + Math.round(p.hunger * 100) + '%"></i></div>' +
      '<div class="chips traits">' + traitChips(p) + '</div>' +
      '<div class="chips gearchips">' + gearChips(p) + '</div></div>';
    show(d.querySelector('canvas'), p.art, p.stage, p.gearOverride, p.bonusGear);
    d.onclick = function () { openDetail(p.id); };
    d.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(p.id); } };
    return d;
  }
  // Detail view (modal): big animated sprite, attributes, roll odds and ALL actions (feed, evolve, gear, rolls, keys, release).
  var detailId = null, listIds = [];
  function stepDetail(dir) {
    var ids = listIds.length ? listIds : demo.state().pets.map(function (p) { return p.id; }), i = ids.indexOf(detailId);
    if (!ids.length) return; detailId = ids[(i + dir + ids.length) % ids.length]; renderDetail();
  }
  function setTab(c) { cemView = c; page = 0; $('tabAlive').classList.toggle('on', !c); $('tabCem').classList.toggle('on', c); $('tabAlive').setAttribute('aria-selected', String(!c)); $('tabCem').setAttribute('aria-selected', String(c)); render(); }
  $('tabAlive').onclick = function () { setTab(false); }; $('tabCem').onclick = function () { setTab(true); };
  $('zoomPrev').onclick = function () { stepDetail(-1); }; $('zoomNext').onclick = function () { stepDetail(1); };
  function openDetail(id) { detailId = id; renderDetail(); $('zoomBox').classList.add('on'); $('zoomClose').focus(); }
  function closeZoom() { $('zoomBox').classList.remove('on'); detailId = null; }
  $('zoomClose').onclick = closeZoom;
  $('zoomBox').onclick = function (e) { if (e.target === $('zoomBox')) closeZoom(); };
  document.addEventListener('keydown', function (e) {
    if (!$('zoomBox').classList.contains('on')) return;
    if (e.key === 'Escape') { closeZoom(); closeItem(); }
    else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !/^(SELECT|INPUT)$/.test(document.activeElement.tagName)) stepDetail(e.key === 'ArrowLeft' ? -1 : 1);
  });
  function renderDetail(msgText, ok) {
    if (detailId == null) return;
    var st = demo.state(), p = st.byId[detailId];
    if (!p) { closeZoom(); return; }
    var t = tierOf(p), d = $('zoomInfo'), fedOut = p.feedsToday >= p.feedLimit, dis = fedOut ? ' disabled title="Already fed today, back tomorrow"' : '';
    $('zoomTitle').textContent = p.art.defaultName + ' #' + p.id;
    var pos = listIds.indexOf(p.id); $('zoomPos').textContent = pos >= 0 ? (pos + 1) + ' / ' + listIds.length : '';
    show($('zoomCanvas'), p.art, p.stage, p.gearOverride, p.bonusGear); $('zoomCanvas').classList.toggle('dead-sprite', !!p.dead);
    if (p.dead) { d.innerHTML = '<div class="chips">' + chip(speciesLabel(p.art.species)) + '<span class="pill tier tier-' + t.id + '">' + t.label + '</span>' + chip('reached ' + p.stageName, 'stg') + chip(fmt(p.care) + ' care') + '</div>' +
      '<p class="deathnote">' + esc(deathNote(p)) + '</p><p class="small"><a href="cemetery.html">🪦 Visit the Pet Cemetery</a></p>'; return; }
    d.innerHTML = '<div class="chips">' + chip(speciesLabel(p.art.species)) + '<span class="pill tier tier-' + t.id + '">' + t.label + '</span>' + chip(p.stageName, 'stg') + chip(fmt(p.care) + ' care') + '</div>' +
      '<div class="bar" aria-label="progress to next stage"><i style="width:' + Math.round(p.progress * 100) + '%"></i></div>' +
      '<div class="small next">' + nextLine(p) + ' · 🍖 ' + Math.round(p.hunger * 100) + '%</div>' +
      '<div class="hunger" aria-label="hunger meter"><i style="width:' + Math.round(p.hunger * 100) + '%"></i></div>' +
      '<div class="chips traits">' + traitChips(p) + '</div>' +
      (p.ascended ? '' : '<div class="row" style="margin-top:8px">' + (p.canEvolve ? '' : '<button class="btn feed big"' + dis + '>Feed (' + fmt(p.meal) + ')</button>') +
        '<button class="btn evolve"' + (p.canEvolve ? '' : ' disabled') + '>Evolve</button> <span class="small feeds' + (fedOut ? ' err' : '') + '">' + fedLabel(p) + '</span></div>') +
      '<div class="gear">' + slotsHtml(p, st.inventory, st) + '</div>' + lootLine(p) +
      '<div class="row" style="margin-top:8px"><button class="q release">Release</button> <a class="small" href="how-it-works.html">How It Works</a></div>' +
      '<div class="msg" id="detailMsg" aria-live="polite"></div>';
    var msg = $('detailMsg');
    if (msgText) { msg.className = 'msg ' + (ok ? 'ok' : 'err'); msg.textContent = msgText; }
    d.querySelector('.release').onclick = function () {
      if (window.confirm('Release ' + p.art.defaultName + ' #' + p.id + '? It is deleted from the demo with no refund; its gear goes back to your inventory.')) { demo.release(p.id); closeZoom(); render(); }
    };
    var big = d.querySelector('.feed.big');
    if (big) big.onclick = function () { act(function () { return demo.feed(p.id); }, msg); };
    var ev = d.querySelector('.evolve');
    if (ev) ev.onclick = function () { act(function () { return demo.evolve(p.id); }, msg); };
    d.querySelectorAll('button.equip').forEach(function (b) { b.onclick = function () { pickGear(p, b.dataset.slot, msg); }; });
    d.querySelectorAll('button.roll').forEach(function (b) { b.onclick = function () {
      gearAct(function () { rollToast(demo.roll(p.id, b.dataset.slot, b.classList.contains('tok'))); }, msg);
    }; });
    var uk = d.querySelector('button.usekey');
    if (uk) uk.onclick = function () { gearAct(function () { var r = demo.useKey(p.id); toast('🔑 ' + r.slot + ' slot unlocked on #' + p.id); }, msg); };
    d.querySelectorAll('button.unequip').forEach(function (b) { b.onclick = function () { var sl = b.dataset.slot, it = p.slots.concat(p.bonusSlots).filter(function (x) { return x.slot === sl; })[0].item;
      gearAct(function () { demo.unequip(p.id, sl); }, msg);
      toast('Took ' + esc(it.label) + ' off #' + p.id + ' (free). <button class="q gundo" type="button">Undo</button>');
      var u = document.querySelector('.gundo:not([data-b])'); if (u) { u.setAttribute('data-b', '1'); u.onclick = function () { try { demo.equip(p.id, it.uid); render(); renderDetail(); } catch (e) { if (!e.demo) throw e; } this.parentNode.remove(); }; } }; });
  }
  // Equip picker: thumbnails of every fitting item (inventory or another pet, "on #N"), live preview, one Confirm. Free.
  function pickGear(p, slot, msg) {
    var inv = demo.state().inventory.filter(function (it) { return it.slot === slot && (!it.species || it.species === p.art.species) && it.on !== p.id; })
      .sort(function (a, b) { return (a.on ? 1 : 0) - (b.on ? 1 : 0) || b.tier - a.tier; });
    var cur = !!p.slots.concat(p.bonusSlots).filter(function (x) { return x.slot === slot && x.item; }).length;
    GearUI.pick({ title: GearUI.ICON[slot] + ' ' + GearUI.LABEL[slot] + ' for ' + p.art.defaultName + ' #' + p.id,
      now: GearUI.wearing(PetCore, window.BonusGear, p.art, p.stage, p.gearOverride, p.extraGear, {}), empty: 'No item fits. Roll one first.',
      items: inv.map(function (it) { var g = { slot: it.slot, item: it.id, overlay: it.overlay || it.bonus, species: it.species };
        return { it: it, label: it.label, frames: itemFrames(it), badge: it.on ? 'on #' + it.on : '🎒', inv: !it.on, swap: cur,
          preview: function () { var ch = {}; ch[slot] = g; return GearUI.wearing(PetCore, window.BonusGear, p.art, p.stage, p.gearOverride, p.extraGear, ch); } }; }),
      onConfirm: function (x) { gearAct(function () { demo.equip(p.id, x.it.uid); }, msg); toast('Equipped ' + esc(x.label) + ' on #' + p.id + (x.it.on ? ' (moved from #' + x.it.on + ')' : '') + '.'); } });
  }
  function gearAct(fn, msgEl) { try { fn(); render(); renderDetail(); } catch (e) { msgEl.className = 'msg err'; msgEl.textContent = e.message; if (!e.demo) throw e; } }
  function act(fn, msgEl) {
    try { var r = fn(); render(); if (detailId != null && r.pet && r.pet.id === detailId) renderDetail(r.entry.msg, true); lootToast(r.drop); return r; }
    catch (e) { msgEl.className = 'msg err'; msgEl.textContent = e.message; if (!e.demo) throw e; }
  }

  document.querySelectorAll('[data-h]').forEach(function (b) { b.onclick = function () { $('hatchAmt').value = b.getAttribute('data-h'); }; });
  function doHatch() {
    var r = act(function () { return demo.hatch(Number($('hatchAmt').value)); }, $('hatchMsg'));
    if (r) { $('hatchMsg').className = 'msg ok'; $('hatchMsg').textContent = 'Hatched pet #' + r.pet.id + ' (play money).'; reveal(r.pet); }
    return r;
  }
  $('hatch').onclick = doHatch;
  setInterval(function () { if (!document.hidden) document.querySelectorAll('.hunger').length && render(); }, 600000); // hunger drains; refresh every 10 min
  var PAGE = 12, page = 0, lastBatch = null;
  $('fTier').onchange = $('fSort').onchange = function () { page = 0; render(); };
  $('pgPrev').onclick = function () { page = Math.max(0, page - 1); render(); };
  $('pgNext').onclick = function () { page++; render(); };
  document.querySelectorAll('button.bulk').forEach(function (b) { b.onclick = function () {
    try { var r = demo.hatchBulk(b.dataset.bulk); page = 0; render(); bulkReveal(r, b.dataset.bulk); }
    catch (e) { $('hatchMsg').className = 'msg err'; $('hatchMsg').textContent = e.message; if (!e.demo) throw e; }
  }; });
  function bulkReveal(r, kind) {
    lastBatch = r.pets.map(function (p) { return p.id; });
    var byT = [0, 0, 0, 0], bySp = {};
    r.pets.forEach(function (p) { byT[p.art.tierIndex]++; bySp[p.art.species] = (bySp[p.art.species] || 0) + 1; });
    $('bulkTitle').textContent = DemoCore.BULK[kind].label + ': ' + r.pets.length + ' pets hatched';
    $('bulkSummary').innerHTML = PetCore.TIERS.map(function (t, i) { return '<span class="pill tier tier-' + t.id + '">' + t.label + ' ' + byT[i] + '</span>'; }).join(' ') +
      '<br>' + Object.keys(bySp).sort(function (a, b) { return bySp[b] - bySp[a]; }).map(function (k) { return esc(speciesLabel(k)) + ' ' + bySp[k]; }).join(' · ') +
      '<br><span class="muted">Paid ' + fmt(r.paid) + ' play XCPETS' + (r.tokens ? ' · ' + r.tokens + ' free roll token' + (r.tokens > 1 ? 's' : '') + ' dropped' : '') + '</span>';
    var g = $('bulkGrid'); g.innerHTML = '';
    r.pets.slice().sort(function (a, b) { return b.art.tierIndex - a.art.tierIndex || a.id - b.id; }).forEach(function (p) {
      var c = document.createElement('div'); c.className = 'egg t' + p.art.tierIndex;
      c.innerHTML = '<canvas width="32" height="32"></canvas><div>' + esc(speciesLabel(p.art.species)) + '</div>';
      g.appendChild(c); paint(c.querySelector('canvas').getContext('2d'), PetCore.render(p.art, { stage: 1, frame: 0, gearOverride: {} })); // still image: cheap for 144
    });
    $('bulkReleaseCommons').disabled = !byT[0];
    $('bulkReleaseCommons').textContent = 'Release all ' + byT[0] + ' Commons from this batch';
    $('bulkReveal').classList.add('on');
  }
  $('bulkClose').onclick = function () { $('bulkReveal').classList.remove('on'); };
  $('bulkReleaseCommons').onclick = function () {
    var st = demo.state(), ids = (lastBatch || []).filter(function (id) { var p = st.byId[id]; return p && p.art.tierIndex === 0; });
    if (!ids.length || !window.confirm('Release ' + ids.length + ' Common pets from this batch? They are deleted with no refund.')) return;
    demo.releaseMany(ids); render(); $('bulkReveal').classList.remove('on'); toast('Released ' + ids.length + ' Commons.');
  };
  $('hatchAgain').onclick = function () { if (!doHatch()) { $('revealText').textContent = $('hatchMsg').textContent; } };
  $('revealRelease').onclick = function () { var id = Number($('reveal').dataset.pet); if (id) { demo.release(id); render(); } $('reveal').classList.remove('on'); };
  $('sharedFeed').onclick = function () {
    var m = $('sharedMsg');
    try { var r = demo.feedShared(Number($('sharedAmt').value)); render(); m.className = 'msg ok'; m.textContent = r.entry.msg + ' (play money)'; }
    catch (e) { m.className = 'msg err'; m.textContent = e.message; if (!e.demo) throw e; }
  };
  $('refill').onclick = function () { demo.refill(); render(); };
  $('reset').onclick = function () { if (window.confirm('Reset the play demo? This deletes your play pets, loot and play wallet in this browser.')) { demo.reset(); render(); } };

  function reveal(p) {
    var c = $('revealCanvas'), t = tierOf(p); $('reveal').dataset.pet = p.id;
    $('revealTitle').textContent = 'Hatching…'; $('revealText').textContent = ''; $('reveal').classList.add('on');
    show(c, p.art, 0);
    setTimeout(function () {
      show(c, p.art, p.stage === 0 ? 1 : p.stage, p.gearOverride, p.bonusGear);
      $('revealTitle').textContent = 'It\'s ' + (/^[AEIOU]/.test(t.label) ? 'an ' : 'a ') + t.label + ' ' + speciesLabel(p.art.species) + '!';
      $('revealText').textContent = p.art.defaultName + ' · pet #' + p.id + ' · ' + p.stageName;
    }, 1300);
  }
  $('revealClose').onclick = function () { $('reveal').classList.remove('on'); };
  render();
})();
