/* XCPETS PLAY DEMO v2 UI — LOCAL ONLY. Mock wallet + mock chain in localStorage. Nothing is signed, broadcast or sent anywhere. */
(function () {
  'use strict';
  var V = window.V2Rules, $ = function (id) { return document.getElementById(id); }, KEY = V2Mock.KEY, ME = V2Mock.ME;
  var fmt = function (n) { return Number(n).toLocaleString('en-US', { maximumFractionDigits: 8 }); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }

  // ---------------------------------------------------------------- mock chain (shared with the other demo pages: js/v2-mock.js)
  var M = window.V2Mock, S = M.state();
  function save() { M.save(); } function burn(src, tag, amount) { M.burn(src, tag, amount); } function adv(n) { M.adv(n); }
  function world() { return M.world(); } function seedWorld() { M.seed(); S = M.state(); }

  // ---------------------------------------------------------------- rendering (shared with every demo page: js/v2-render.js)
  var R = window.V2Render, paint = R.paint, petFrames = R.petFrames;
  var animated = { push: function (a) { R.animate(a.c, a.fr); } };
  var TL = V.TIER_LABELS, TC = ['#9aa3b2', '#5fd35f', '#4f9dff', '#ffb02e'];
  function spLabel(id) { return V.speciesLabel(id); } // purebreds + hybrids ('Dobo (hybrid)')

  // ================================================================ UI on the LIVE play.html markup (ids/classes from xcpets.fun/play.html)
  var TIER_ID = ['common', 'uncommon', 'rare', 'legendary'], SL = V.slotLabel;
  var cem = false, detailId = null;
  function tierPill(t) { return '<span class="pill tier tier-' + TIER_ID[t] + '">' + TL[t] + '</span>'; }
  function toast(html, ms) { var t = document.createElement('div'); t.className = 'toast'; t.innerHTML = html; $('toasts').appendChild(t); setTimeout(function () { t.remove(); }, ms || 4000); }
  function open(id) { $(id).classList.add('on'); } function close(id) { $(id).classList.remove('on'); }
  /* Local discard (any rarity) = live xcpets.fun: no burn, no wallet, hidden in THIS browser per network + address; still on chain; restorable. */
  var NET = (window.LiveEngine && LiveEngine.CFG && LiveEngine.CFG.network) || (M.prod ? 'mainnet' : 'v2demo');
  function hidKey() { return 'xcpets-hidden-' + NET + '-' + (ME || ''); }
  function hiddenIds() { try { return JSON.parse(localStorage.getItem(hidKey()) || '[]'); } catch (e) { return []; } }
  function setHidden(l) { localStorage.setItem(hidKey(), JSON.stringify(l.filter(function (x, i, a) { return a.indexOf(x) === i; }))); }
  function hideLocal(ids) { setHidden(hiddenIds().concat(ids)); S.sel = S.sel.filter(function (x) { return ids.indexOf(x) < 0; }); save(); render();
    toast('🗑️ Hid ' + ids.length + ' pet' + (ids.length > 1 ? 's' : '') + ' in this browser (free, still on chain). <a href="#" class="undo">Undo</a>', 9000);
    var u = $('toasts').lastChild.querySelector('.undo'); if (u) u.onclick = function (e) { e.preventDefault(); restoreLocal(ids); this.parentNode.remove(); }; }
  function restoreLocal(ids) { setHidden(hiddenIds().filter(function (x) { return ids.indexOf(x) < 0; })); render(); toast('Restored #' + ids.join(', #') + '.'); }
  function discardIds(ids) { if (!ids.length) { toast('Tick Discard on at least one pet first.'); return; } hideLocal(ids); }
  function mine(w) { var h = hiddenIds(); return w.pets.filter(function (p) { return p.owner === ME && !p.released && h.indexOf(p.id) < 0; }); }
  function sel() { return S.sel.slice(); }
  var commAnim = null;
  // ---------------------------------------------------------------- gear-win notification (single roll, bulk rolls, live/free-token rolls, trophies)
  var WKEY = 'xcpets-v2-seen-' + KEY + '-' + ME;
  function notifyWins(w) {
    var seen = null; try { seen = JSON.parse(localStorage.getItem(WKEY)); } catch (e) { }
    var r = V.newWins(w, ME, seen); try { localStorage.setItem(WKEY, JSON.stringify(r.seen)); } catch (e) { }
    if (r.wins.length) revealQ.push({ kind: 'gear', wins: r.wins }); return r.wins;
  }
  // ---------------------------------------------------------------- hatch popup = live #packBox review (live game.js showPack/drawPack), gear wins use the same box
  var HKEY = 'xcpets-v2-hatched-' + KEY + '-' + ME, revealQ = [], rev = null, REV_PAGE = 36, TIERS = (window.PetCore && PetCore.TIERS) || [{ label: 'Common' }, { label: 'Uncommon' }, { label: 'Rare' }, { label: 'Legendary' }];
  function notifyHatch(w) {
    var seen = null; try { seen = JSON.parse(localStorage.getItem(HKEY)); } catch (e) { }
    var r = V.newHatches(w, ME, seen); try { localStorage.setItem(HKEY, JSON.stringify(r.seen)); } catch (e) { }
    r.groups.forEach(function (g) { revealQ.push({ kind: 'eggs', eggs: g.eggs.map(function (p) { return p.id; }) }); }); return r.groups;
  }
  function nextReveal() { if ($('packBox').classList.contains('on') || !revealQ.length) return; rev = revealQ.shift(); rev.page = 0; rev.sel = {}; drawReveal(); open('packBox'); }
  function drawReveal() {
    var w = world(), gear = rev.kind === 'gear', list = gear ? rev.wins : rev.eggs.map(function (id) { return w.byId[id]; }).filter(Boolean), tiers = [0, 0, 0, 0];
    var pages = Math.max(1, Math.ceil(list.length / REV_PAGE)); rev.page = Math.min(rev.page, pages - 1);
    list.forEach(function (x) { tiers[gear ? (x.legendary ? 3 : x.tier) : x.art.tierIndex]++; });
    $('packTitle').textContent = gear ? '🎁 ' + (list.length === 1 ? 'You won ' + list[0].label : list.length + ' pieces won') : list.length + ' egg' + (list.length > 1 ? 's' : '') + ' to review';
    $('packSummary').innerHTML = esc(TIERS.map(function (t, i) { return tiers[i] + ' ' + t.label; }).join(' · ')) + (gear ? '' : ' · ' + Object.keys(rev.sel).length + ' ticked') +
      (pages > 1 ? ' <span class="pager"><button class="q" type="button" id="pkPrev"' + (rev.page ? '' : ' disabled') + '>‹ Prev</button> page ' + (rev.page + 1) + '/' + pages + ' <button class="q" type="button" id="pkNext"' + (rev.page < pages - 1 ? '' : ' disabled') + '>Next ›</button></span>' : '');
    if ($('pkPrev')) { $('pkPrev').onclick = function () { rev.page--; drawReveal(); }; $('pkNext').onclick = function () { rev.page++; drawReveal(); }; }
    var grid = $('packGrid'); grid.innerHTML = '';
    list.slice(rev.page * REV_PAGE, rev.page * REV_PAGE + REV_PAGE).forEach(function (x) {
      var d = document.createElement('div');
      if (gear) { d.className = 'egg gearwin t' + (x.legendary ? 3 : x.tier); d.innerHTML = '<span class="ic"></span><div><b>' + esc(x.label) + '</b></div><div>' + esc(x.tierName) + (x.legendary ? ' ★' : '') + '</div><div class="muted">' + esc(x.slotName) + (x.rolledOn != null ? ' · #' + x.rolledOn : '') + '</div>';
        d.querySelector('.ic').appendChild(V2Render.iconCanvas(x.item, 'gicon')); grid.appendChild(d); return; }
      d.className = 'egg t' + x.art.tierIndex + (rev.sel[x.id] ? ' discard' : ''); d.innerHTML = '<canvas width="32" height="32"></canvas><div>#' + x.id + ' ' + esc(TIERS[x.art.tierIndex].label) + '</div><div class="muted">' + esc(x.species) + '</div><label class="small disc"><input type="checkbox" data-id="' + x.id + '"' + (rev.sel[x.id] ? ' checked' : '') + '> Discard</label>';
      grid.appendChild(d); var c = d.querySelector('canvas'), fr = petFrames(x, w); paint(c, fr[0]); R.animate(c, fr);
      d.querySelector('input').onchange = function () { if (this.checked) rev.sel[x.id] = 1; else delete rev.sel[x.id]; d.classList.toggle('discard', this.checked); };
    });
    ['packCommons', 'packDiscard', 'packSkip'].forEach(function (id) { $(id).style.display = gear ? 'none' : ''; }); $('packClose').textContent = gear ? 'Nice → Inventory' : 'Keep the rest → My Pets';
  }
  function hideIds(ids) { discardIds(ids); }
  function closeReveal() { close('packBox'); rev = null; render(); setTimeout(nextReveal, 250); }
  function render() {
    var w = world(), c = w.community; notifyHatch(w); notifyWins(w); setTimeout(nextReveal, 0);
    $('bal').textContent = fmt(S.balance); V2Wallet.paint(ME, $);
    $('tip').textContent = fmt(S.tip); $('dayn').textContent = V.day(S.tip); $('cut').textContent = fmt(V.V2_FROM_BLOCK);
    $('cBurned').textContent = fmt(c.burned); $('cGame').textContent = fmt(S.rows.length); $('cPets').textContent = fmt(w.pets.length);
    // community pet (Jake 2026-10-14): Nakamoto at Mythic until The Return (1,111,111 burned in total), then the next community pet (same .commsprite slot as live)
    var wiz = !!c.returned, fr;
    if (wiz) fr = WizardSprite.frames(c.wizardStage, '#2a3a2e');
    else fr = R.communityFrames(w); /* community roll (2026-10-15): Nakamoto wears its community-roll gear */
    if (!commAnim) { var cv = document.createElement('canvas'); cv.width = cv.height = 32; cv.className = 'commsprite'; $('community').parentNode.insertBefore(cv, $('community')); commAnim = { c: cv }; }
    R.animate(commAnim.c, fr); commAnim.fr = fr;
    var T = V.WIZARD_THRESHOLDS, nx = wiz && c.wizardStage < 5 ? T[c.wizardStage + 1] : null, rp = V.returnProgress(c.burned);
    $('community').innerHTML = '<b>' + esc(c.petName) + '</b> · ' + c.petStageName + ' · ' + fmt(Math.floor(c.burned)) + ' <span class="asset">XCPETS</span> burned' +
      (!wiz && R.communityGearText(w) ? '<div class="small muted">Gear: ' + esc(R.communityGearText(w)) + '</div>' : '');
    var crOn = V.crollOn(S.tip); $('crollBtn').textContent = 'Community roll (' + fmt(V.COSTS.croll) + ')'; $('crollBtn').disabled = !crOn;
    if (!crOn) $('community').insertAdjacentHTML('beforeend', '<div class="small muted" id="crollNote">Community roll switches on at block ' + fmt(V.ACTIVATE_CROLL_BLOCK) + '.</div>');
    $('crollBtn').title = crOn ? 'Burn ' + fmt(V.COSTS.croll) + ' XCPETS: Nakamoto gets one random gear item' : 'Community roll switches on at block ' + fmt(V.ACTIVATE_CROLL_BLOCK);
    $('goalBar').style.width = (rp.pct * 100).toFixed(2) + '%';
    $('goalTxt').innerHTML = wiz ? '<b>' + fmt(Math.floor(c.burned)) + '</b> <span class="asset">XCPETS</span> burned' : '<b>' + fmt(Math.floor(rp.count)) + '</b> / ' + fmt(V.COMMUNITY_GOAL) + ' <span class="asset">XCPETS</span> burned (' + (rp.pct * 100).toFixed(1) + '%)'; /* Cold Storage bar: no Return wording (Jake 2026-10-14) */
    $('lb').innerHTML = c.leaderboard.slice(0, 8).map(function (x) { return '<li' + (x.address === ME ? ' class="me"' : '') + '>' + esc(x.address) + ' · ' + fmt(x.amount) + '</li>'; }).join('');
    var amt = Math.floor(Number($('cAmt').value) || 0); $('cfeedBtn').textContent = 'Feed community (' + fmt(Math.max(amt, 0)) + ')';
    renderPets(w); renderInv(w); renderBattles(w); renderRumble(w); renderBreed(w); renderLog(w);
    if (detailId && $('detail').classList.contains('on')) detail(w.byId[detailId], w);
  }
  // ---------------------------------------------------------------- My Pets (live card markup + checkbox)
  /* hotfix 3: the filtered + sorted pet list (shared by renderPets and the sort-only reorder) */
  function petList(alive, dead) { var fT = $('fTier').value, fS = $('fSort').value, hide = Number($('fHide').value);
    var list = (cem ? dead : V.hideAtOrBelow(alive, hide)).filter(function (p) { return cem || fT === 'all' || TIER_ID[p.tier] === fT; }).slice().reverse();
    if (fS === 'tier') list.sort(function (a, b) { return b.tier - a.tier || b.id - a.id; }); if (fS === 'stage') list.sort(function (a, b) { return b.stage - a.stage || b.care - a.care || b.id - a.id; });
    return list; }
  /* hotfix 3: a sort change only reorders the existing cards (same set, new order); anything else falls back to a full render */
  function resort() { var w = world(), all = mine(w), list = petList(all.filter(function (p) { return !p.dead; }), all.filter(function (p) { return p.dead; })), box = $('pets'), m = {};
    box.querySelectorAll(':scope > .pet.card[data-pid]').forEach(function (d) { m[d.dataset.pid] = d; });
    if (Object.keys(m).length !== list.length || !list.every(function (p) { return m[p.id]; })) return false;
    var f = document.createDocumentFragment(); list.forEach(function (p) { f.appendChild(m[p.id]); }); box.insertBefore(f, box.firstChild); return true; }
  function renderPets(w) {
    var all = mine(w), alive = all.filter(function (p) { return !p.dead; }), dead = all.filter(function (p) { return p.dead; });
    $('nAlive').textContent = alive.length; $('nDead').textContent = dead.length; $('petBadge').textContent = alive.length;
    var list = petList(alive, dead);
    S.sel = S.sel.filter(function (id) { return alive.some(function (p) { return p.id === id; }); });
    $('selAll').checked = list.length > 0 && list.every(function (p) { return S.sel.indexOf(p.id) >= 0; });
    $('selCount').textContent = S.sel.length + ' selected · ' + alive.filter(function (p) { return p.hungry; }).length + ' hungry';
    $('bulkRow').style.display = cem ? 'none' : '';
    var box = $('pets'); box.innerHTML = list.length ? '' : '<p class="muted">No pets match this filter.</p>';
    /* hotfix 3: cards are built in chunks of 150 with a yield between them, so a 2,000-pet wallet never blocks the page for seconds */
    var tok = renderPets.tok = (renderPets.tok || 0) + 1, CH = 150, tail = document.createComment('pets-more');
    function mk(p) {
      var d = document.createElement('div'), on = S.sel.indexOf(p.id) >= 0; d.className = 'pet card' + (p.dead ? ' dead' : '') + (on ? ' selected' : ''); d.tabIndex = 0; d.dataset.pid = p.id;
      var th = V.thresholdsFor(p.species), fed = p.dead ? '🪦 Died of neglect' : p.fedToday ? 'Fed today: ✓' : p.nextMeal ? 'Hungry · meal ' + fmt(p.nextMeal) : 'Full';
      d.innerHTML = (p.dead ? '' : '<input type="checkbox" class="pick-cb" aria-label="Select #' + p.id + '"' + (on ? ' checked' : '') + '>') + '<canvas class="sprite" width="32" height="32"></canvas><h4>' + esc(p.name) + ' <span class="muted">#' + p.id + '</span>' + (p.blackEye ? ' 🤕' : '') + (p.crowned ? ' 👑' : '') + '</h4><div class="chips">' +
        '<span class="chip">' + esc(spLabel(p.species)) + '</span>' + tierPill(p.tier) + '<span class="chip stg">' + p.stageName + '</span><span class="chip' + (p.hungry ? ' warn' : '') + '">' + fed + '</span>' +
        '<span class="chip gearchip">🎒 ' + R.worn(w, p.id).length + '/' + p.capacity + ' slots</span>' + (p.neglected && !p.dead ? '<span class="chip warn">neglected</span>' : '') + '</div>' +
        '<div class="bar"><i style="width:' + Math.min(100, 100 * p.care / th[5]).toFixed(1) + '%"></i></div><div class="small muted">care ' + fmt(p.care) + ' / ' + fmt(th[5]) + '</div>';
      var cb = d.querySelector('.pick-cb'); if (cb) cb.onclick = function (e) { e.stopPropagation(); toggle(p.id); };
      d.onclick = function () { detailId = p.id; detail(p, w); };
      return d; }
    function put(ps, before) { var f = document.createDocumentFragment(), ds = ps.map(function (p) { var d = mk(p); f.appendChild(d); return [d, p]; }); if (before) box.insertBefore(f, before); else box.appendChild(f);
      ds.forEach(function (x) { R.lazy(x[0].querySelector('canvas'), function () { return petFrames(x[1], w); }); }); }
    put(list.slice(0, CH)); box.appendChild(tail);
    (function more(i) { if (i >= list.length) return; setTimeout(function () { if (renderPets.tok !== tok || !tail.parentNode) return; put(list.slice(i, i + CH), tail); more(i + CH); }, 0); })(CH);
    var gone = w.pets.filter(function (p) { return p.owner === ME && !p.released && hiddenIds().indexOf(p.id) >= 0; });
    if (gone.length && !cem) { var hb = document.createElement('div'); hb.className = 'hiddenbox'; hb.innerHTML = '<details><summary>Show discarded (' + gone.length + ')</summary><p class="small muted">Pets you hid in this browser. They still exist on-chain (others and other devices see them).</p>' +
      gone.map(function (p) { return '<span class="chip">#' + p.id + ' ' + esc(p.name || spLabel(p.species)) + ' <a href="#" data-restore="' + p.id + '">Restore</a></span>'; }).join(' ') + '</details>';
      box.appendChild(hb); hb.querySelectorAll('[data-restore]').forEach(function (a) { a.onclick = function (e) { e.preventDefault(); restoreLocal([Number(a.getAttribute('data-restore'))]); }; }); }
    $('petPager').textContent = list.length + ' of ' + (cem ? dead.length : alive.length) + ' pets';
  }
  /* hotfix 2: a selection change only updates that card + the count (no full render / replay) */
  function selUi() { var w = world(), alive = mine(w).filter(function (p) { return !p.dead; }), cards = document.querySelectorAll('#pets .pet.card[data-pid]');
    $('selCount').textContent = S.sel.length + ' selected · ' + alive.filter(function (p) { return p.hungry; }).length + ' hungry';
    var all = cards.length > 0; cards.forEach(function (d) { var on = S.sel.indexOf(Number(d.dataset.pid)) >= 0; d.classList.toggle('selected', on); var cb = d.querySelector('.pick-cb'); if (cb) cb.checked = on; if (!on) all = false; }); $('selAll').checked = all; }
  function toggle(id) { var i = S.sel.indexOf(id); if (i >= 0) S.sel.splice(i, 1); else S.sel.push(id); save(); selUi(); }
  $('tabAlive').onclick = function () { cem = false; this.classList.add('on'); $('tabCem').classList.remove('on'); render(); };
  $('tabCem').onclick = function () { cem = true; this.classList.add('on'); $('tabAlive').classList.remove('on'); render(); };
  ['fTier', 'fSort', 'fHide'].forEach(function (id) { $(id).onchange = function () { S['ui_' + id] = this.value; save(); if (id === 'fSort' && resort()) return; render(); }; if (S['ui_' + id] != null) $(id).value = S['ui_' + id]; });
  $('selAll').onchange = function () { var w = world(), hide = Number($('fHide').value), fT = $('fTier').value;
    var shown = V.hideAtOrBelow(mine(w).filter(function (p) { return !p.dead; }), hide).filter(function (p) { return fT === 'all' || TIER_ID[p.tier] === fT; });
    S.sel = this.checked ? shown.map(function (p) { return p.id; }) : []; save(); selUi(); };
  $('selNone').onclick = function () { S.sel = []; save(); selUi(); toast('Selection cleared'); };
  /* Feed all hungry / Feed selected NEVER include a discarded pet: filtered by the discard set itself (hiddenIds), not by what is on screen,
   * so 'Show discarded', a stale selection or an active filter can't leak one in. */
  function noDiscarded(plans) { var h = hiddenIds(); return plans.filter(function (q) { return h.indexOf(q.petId) < 0; }); }
  $('bFeedHungry').onclick = function () { var w = world(), h = hiddenIds(); confirmPlans('Feed all hungry pets', noDiscarded(V.feedQueue(w, ME, w.pets.filter(function (p) { return p.owner === ME && h.indexOf(p.id) < 0; }).map(function (p) { return p.id; })))); };
  $('bFeedSel').onclick = function () { var h = hiddenIds(); confirmPlans('Feed selected pets', noDiscarded(V.feedQueue(world(), ME, sel().filter(function (id) { return h.indexOf(id) < 0; })))); };
  $('bRoll').onclick = function () { confirmPlans('Gear-roll queue', V.rollQueue(world(), ME, sel(), Number($('rollN').value) || 1)); };
  $('bRelease').onclick = function () { if (!S.sel.length) return toast('Select pets first'); confirmPlans('Release ' + S.sel.length + ' pets (max ' + V.MAX_RELEASE_PER_BURN + ' per burn)', V.releaseBatches(sel())); };
  $('bAuto').onclick = function () { var ops = V.autoEquipOps(world(), ME, sel(), S.tip); S.ops = S.ops.concat(ops); save(); toast('✨ Auto-equip: ' + ops.length + ' pieces (free, no burn)'); render(); };
  if ($('bOutfit')) $('bOutfit').onclick = function () {
    if (!S.sel.length) return toast('Select pets first'); var w = world(), inv = w.itemList.filter(function (g) { return g.owner === ME && g.on == null; });
    $('outfitBody').innerHTML = '<p class="small">Uses free copies from your inventory. Missing copies or closed slots are skipped.</p>' + V.V2_SLOTS.map(function (sl) { var k = {}; inv.filter(function (g) { return g.slot === sl; }).forEach(function (g) { (k[g.item] = k[g.item] || { l: g.label, n: 0 }).n++; });
      return '<div class="row small"><b class="slotname">' + SL(sl) + '</b> <select class="pick" data-o="' + sl + '"><option value="">(leave)</option>' + Object.keys(k).map(function (id) { return '<option value="' + id + '">' + esc(k[id].l) + ' · ' + k[id].n + ' free ' + (k[id].n === 1 ? 'copy' : 'copies') + (k[id].n < S.sel.length ? ' (not enough for ' + S.sel.length + ')' : '') + '</option>'; }).join('') + '</select></div>'; }).join('') + '<p class="small muted">' + S.sel.length + ' pets selected. Each pet needs its own free copy (one item = one pet).</p>';
    $('oGo').style.display = ''; $('oNo').textContent = 'Cancel'; open('outfitBox'); };
  $('oNo').onclick = function () { close('outfitBox'); };
  $('oGo').onclick = function () { var o = {}; document.querySelectorAll('[data-o]').forEach(function (s) { if (s.value) o[s.dataset.o] = s.value; });
    if (!Object.keys(o).length) return toast('Pick at least one piece');
    var r = V.outfitOps(world(), ME, sel(), o, S.tip); S.ops = S.ops.concat(r.ops); save(); render();
    // keep the dialog open with the full per-pet result (no silent skips)
    $('outfitBody').innerHTML = '<p class="' + (r.report.ok ? '' : 'warn') + '"><b>' + (r.report.ok ? '✓ Outfit applied to all ' + S.sel.length + ' selected pets' : '⚠️ Only part of the outfit could be equipped') + '</b></p>' +
      '<div class="logbox small">' + r.report.text.split('\n').map(function (l) { return '<div>' + esc(l) + '</div>'; }).join('') + '</div>' +
      (r.report.ok ? '' : '<p class="small muted">Gear works like the live game: each piece is one rolled item and can be worn by one pet at a time, so each pet needs its own copy.</p>');
    $('oGo').style.display = 'none'; $('oNo').textContent = 'Close'; };

  // ---------------------------------------------------------------- detail dialog (live #detail)
  function statBars(p) { var MAX = 31, tot = 0; return PetCore.STAT_KEYS.map(function (k) { var v = p.stats[k]; tot += v; return '<div class="stat"><span class="sk">' + k.toUpperCase() + '</span><span class="sbar"><i style="width:' + Math.min(100, 100 * v / MAX).toFixed(0) + '%"></i></span><b>' + v + '</b></div>'; }).join('') + '<div class="stat tot"><span class="sk">TOTAL</span><b>' + tot + '</b></div>'; }
  function tree(t) { if (!t) return ''; return '<ul class="tree"><li>#' + t.id + ' ' + esc(t.name) + ' <span class="muted">' + spLabel(t.species) + ' · ' + TL[t.tier] + '</span>' + t.parents.map(tree).join('') + '</li></ul>'; }
  function detail(p, w) {
    if (!p) return; w = w || world(); $('dTitle').innerHTML = esc(p.name) + ' <span class="muted">#' + p.id + '</span> ' + tierPill(p.tier);
    var frs = petFrames(p, w); paint($('dCanvas'), frs[0]); R.animate($('dCanvas'), frs);
    $('dStats').innerHTML = statBars(p);
    var inv = w.itemList.filter(function (g) { return g.owner === ME && g.on == null; }), legAll = V.legendaryOf(p.species), leg = legAll[0];
    var h = '<a class="btn openpet" id="dOpenPet" href="pet.html?id=' + p.id + '">Open pet page →</a><p>' + esc(spLabel(p.species)) + ' · ' + p.stageName + ' · care ' + fmt(p.care) + ' / ' + fmt(V.thresholdsFor(p.species)[5]) + (p.species === 'nakamoto' ? ' (Nakamoto: 10× thresholds, ~30 daily meals to Mythic)' : '') + ' · W' + (p.wins || 0) + '/L' + (p.losses || 0) + '</p>';
    if (!p.dead) h += '<div class="row"><button class="btn ico-flame" data-a="feed"' + (p.hungry ? '' : ' disabled') + '>Feed (' + fmt(p.nextMeal) + ')</button><button class="btn ghost ico-flame" data-a="roll">Gear roll (345)</button><button class="act ghost" id="dDiscard" title="Hides it in this browser. Free; restore any time from Show discarded.">🗑️ Discard pet</button></div>';
    h += '<h3 class="sec" data-ico="gear">Gear <span class="small muted gcount">' + V.wornOf(w, p.id).length + '/' + p.capacity + '</span></h3><div class="gpicker" id="gPicker"></div>'; // pop-up cleanup 2026-10-14: no long capacity/signature/how-to text
    h += '<h3 class="sec" data-ico="egg">Born traits</h3><table class="small borntraits">' + V.bornTraits(p, p.stage).map(function (r) { return '<tr><td class="muted">' + esc(r[0]) + '</td><td>' + (r[0] === 'Background colour' ? '<span style="display:inline-block;width:10px;height:10px;border:1px solid #000;background:' + esc(r[1]) + '"></span> ' : '') + esc(r[1]) + '</td></tr>'; }).join('') + '</table>';
    h += '<h3 class="sec" data-ico="egg">Family tree</h3>' + tree(V.familyTree(w, p.id)) + '<p class="small">Children: ' + (p.children.length ? '#' + p.children.join(', #') : 'none') + ' · breedings ' + p.breeds + '/' + V.BREED_MAX + (p.lastBreed != null && S.tip - p.lastBreed < V.BREED_COOLDOWN ? ' · cooldown ' + (V.BREED_COOLDOWN - (S.tip - p.lastBreed)) + ' blocks' : '') + '</p>';
    var keepOpen = $('gPicker') ? $('gPicker').getAttribute('data-open') : null, keepY = $('detail').querySelector('.box') ? $('detail').querySelector('.box').scrollTop : 0;
    $('dInfo').innerHTML = h;
    if (keepOpen && detail.lastId === p.id) $('gPicker').setAttribute('data-open', keepOpen); detail.lastId = p.id;
    R.gearPicker($('gPicker'), { compact: true, world: w, owner: ME, pet: p, msg: detail.msg, onEquip: function (op, m) { op.block_index = S.tip; S.ops.push(op); save(); detail.msg = '✓ ' + m; render(); detail.msg = null; toast(esc(m) + ' (free)'); } });
    $('detail').querySelector('.box').scrollTop = keepY;
    if ($('dDiscard')) $('dDiscard').onclick = function () { var id = p.id; close('detail'); discardIds([id]); };
    $('dInfo').querySelectorAll('button[data-a]').forEach(function (b) { b.onclick = function () { var a = b.dataset.a; confirmPlans(a === 'feed' ? 'Feed #' + p.id : 'Gear roll #' + p.id, a === 'feed' ? V.feedQueue(world(), ME, [p.id]) : V.rollQueue(world(), ME, [p.id], 1)); }; });
    open('detail');
  }
  $('dClose').onclick = function () { close('detail'); detailId = null; };

  // ---------------------------------------------------------------- inventory (live invcards)
  var invView = S.ui_inv || 'mine', invSlot = S.ui_invSlot || 'all';
  function renderInv(w) {
    var items = w.itemList.filter(function (g) { return g.owner === ME; }), box = $('inv'); $('invCount').textContent = items.filter(function (g) { return g.on == null; }).length;
    $('tokens').textContent = '0'; $('keys').textContent = '0';
    var cat = V.catalogBySlot(), slots = invSlot === 'all' ? V.V2_SLOTS : [invSlot];
    var h = '<div class="pettabs invtabs" role="tablist"><button type="button" class="tab' + (invView === 'mine' ? ' on' : '') + '" data-iv="mine">My gear by slot</button><button type="button" class="tab' + (invView === 'all' ? ' on' : '') + '" data-iv="all">Every piece by slot (' + V.ALL_GEAR.length + ')</button></div>' +
      '<div class="chips slotfilter"><button type="button" class="q' + (invSlot === 'all' ? ' on' : '') + '" data-is="all">All slots</button>' + V.V2_SLOTS.map(function (sl) { return '<button type="button" class="q' + (invSlot === sl ? ' on' : '') + '" data-is="' + sl + '">' + SL(sl) + '</button>'; }).join('') + '</div>';
    box.innerHTML = h;
    if (invView === 'mine' && !items.length) box.insertAdjacentHTML('beforeend', '<p class="muted small">No gear yet. Open a pet and burn for a gear roll.</p>');
    slots.forEach(function (sl) {
      var l = invView === 'mine' ? items.filter(function (g) { return g.slot === sl; }).sort(function (a, b) { return b.tier - a.tier || (a.label < b.label ? -1 : 1); }) : cat[sl];
      if (!l.length && invView === 'mine') return;
      var hd = document.createElement('div'); hd.className = 'invslot'; hd.textContent = SL(sl) + ' · ' + l.length + (invView === 'all' ? ' pieces' : ''); box.appendChild(hd);
      var gr = document.createElement('div'); gr.className = 'invgrid'; box.appendChild(gr);
      l.forEach(function (g) { var id = invView === 'mine' ? g.item : g.id, it = V.GEAR_BY_ID[id] || g, c = document.createElement('div'), tier = it.tier || 0, leg = invView === 'mine' ? g.legendary : g.exclusive;
        var own = invView === 'all' ? items.filter(function (x) { return x.item === id; }).length : 0;
        c.className = 'invcard t' + tier + (invView === 'all' && !own ? ' unowned' : ''); c.title = it.label + ' · ' + SL(sl) + ' · ' + TL[tier] + (leg ? ' · ' + spLabel(it.origin) + '-only legendary' : '');
        c.innerHTML = (invView === 'mine' ? (g.on != null ? '<span class="worn">#' + g.on + '</span>' : '<span class="worn bag">🎒</span>') : (own ? '<span class="worn">×' + own + '</span>' : '')) + esc(it.label || g.label) + (leg ? ' ★' : '');
        c.insertBefore(V2Render.iconCanvas(id, ''), c.firstChild); gr.appendChild(c); });
    });
    box.querySelectorAll('[data-iv]').forEach(function (b) { b.onclick = function () { invView = S.ui_inv = b.dataset.iv; save(); renderInv(world()); }; });
    box.querySelectorAll('[data-is]').forEach(function (b) { b.onclick = function () { invSlot = S.ui_invSlot = b.dataset.is; save(); renderInv(world()); }; });
  }

  // ---------------------------------------------------------------- confirm (live #confirmBox) + per-burn mock signing with progress
  var pendingPlans = null, pendingAfter = null;
  function confirmPlans(title, plans, after) {
    var bw = world(), skip = []; plans = plans.filter(function (p) { var m = V.battleBlock(bw, p.tag, S.tip); if (m) skip.push(m); return !m; }); /* battle cap (2026-10-14) */
    if (skip.length) { toast(skip.length === 1 ? skip[0] : 'Skipped ' + skip.length + ' battles: ' + skip.join(' · ')); window.V2LastBlocked = skip; }
    if (!plans.length) { if (!skip.length) toast('Nothing to do'); return; }
    var s = V.burnSummary(plans); pendingPlans = plans; pendingAfter = after;
    $('cfTitle').textContent = title;
    $('cfBody').innerHTML = '<div class="bigamt">' + fmt(s.total) + ' XCPETS</div><p class="small">' + s.burns + ' burn' + (s.burns > 1 ? 's' : '') + ', each signed separately · network fees ~' + fmt(s.feeSats) + ' sats (' + s.feeBtc.toFixed(8) + ' BTC, estimate; XCP Wallet shows the real fee) · balance after ' + fmt(S.balance - s.total) + '</p>' +
      '<div class="logbox small">' + plans.slice(0, 12).map(function (p) { return '<div><code>' + esc(p.tag) + '</code> · ' + fmt(p.amount) + '</div>'; }).join('') + (plans.length > 12 ? '<div>… +' + (plans.length - 12) + ' more</div>' : '') + '</div>' +
      '<div class="bar"><i id="pg" style="width:0"></i></div><div class="small" id="pgt"></div>';
    $('cfYes').textContent = 'Sign & burn in XCP Wallet'; $('cfYes').disabled = false; $('cfNo').disabled = false; open('confirmBox');
  }
  $('cfNo').onclick = function () { close('confirmBox'); pendingPlans = null; };
  $('cfYes').onclick = function () { var plans = pendingPlans; if (!plans) return; var s = V.burnSummary(plans); if (!ME || V2Wallet.current() !== ME) { toast('Connecting XCP Wallet…'); V2Wallet.connect().then(function (a) { if (a !== ME) location.reload(); else $('cfYes').onclick(); }, function (e) { toast(V2Wallet.errHtml(e)); }); return; } if (s.total > S.balance) return toast('Not enough XCPETS in this wallet');
    $('cfYes').disabled = true; $('cfNo').disabled = true; var i = 0;
    (function step() { if (i >= plans.length) { save(); $('pgt').textContent = '✓ ' + plans.length + ' burn' + (plans.length > 1 ? 's' : '') + ' sent from XCP Wallet. They appear here once confirmed in a block.'; var nr = plans.filter(function (q) { return /^pet:roll:/.test(q.tag); }).length; if (nr) toast('🎲 ' + (nr > 1 ? nr + ' rolls' : 'Roll') + ' submitted. The piece depends on the block your burn lands in: you will see exactly what you won here once it is confirmed.', 9000); setTimeout(function () { close('confirmBox'); var a = pendingAfter; pendingPlans = null; render(); if (a) a(); }, 400); return; }
      var p = plans[i++], k = i; $('pgt').textContent = 'Burn ' + k + ' of ' + plans.length + ': building ' + p.tag + ', then approve it in XCP Wallet…'; V2Wallet.send(p, ME).then(function (r) { $('pg').style.width = (100 * k / plans.length) + '%'; $('pgt').textContent = 'Burn ' + k + ' of ' + plans.length + ' sent: ' + p.tag + ' · tx ' + r.txid.slice(0, 10) + '…'; if (plans.length <= 3) toast('⏳ Broadcast: ' + esc(p.label || p.tag) + ' · <a target="_blank" rel="noopener" href="https://mempool.space/tx/' + r.txid + '">' + r.txid.slice(0, 6) + '… mempool ↗</a>' + (/^pet:hatch/.test(p.tag) ? ' · 🥚 your egg' + (p.tag === 'pet:hatch' ? '' : 's') + ' hatch when this confirms (the hatch popup opens then)' : ' · result when confirmed'), 9000); renderLog(world()); step(); }, function (e) { $('pgt').innerHTML = '<span class="warn">Stopped at burn ' + k + ' of ' + plans.length + ' (' + (k - 1) + ' sent): ' + V2Wallet.errHtml(e) + '</span>'; $('cfNo').disabled = false; pendingPlans = plans.slice(k - 1); if (!e.reload) { $('cfYes').textContent = 'Continue from burn ' + k; $('cfYes').disabled = false; } }); })(); };

  // ---------------------------------------------------------------- hatch + community (live buttons)
  $('hatchBtn').textContent = 'Hatch (69)'; $('hatchBtn').onclick = function () { confirmPlans('Hatch', [{ tag: 'pet:hatch', amount: 69 }]); };
  $('dozenBtn').onclick = function () { confirmPlans('Dozen ×12', [{ tag: 'pet:hatch12', amount: 690 }]); };
  $('caseBtn').onclick = function () { confirmPlans('Case ×144', [{ tag: 'pet:hatch144', amount: 6900 }]); };
  $('reload').onclick = function () { render(); toast('Reloaded from the chain'); };
  /* community feed amount (2026-10-15, Jake): three fixed choices 69 / 690 / 6,900 (69 by default) instead of a free amount field; same tag + burn flow */
  document.querySelectorAll('[data-camt]').forEach(function (b) { b.onclick = function () { $('cAmt').value = b.dataset.camt;
    document.querySelectorAll('[data-camt]').forEach(function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)); }); render(); }; });
  document.querySelectorAll('[data-q]').forEach(function (b) { b.onclick = function () { $('cAmt').value = b.dataset.q; render(); }; });
  $('cAmt').oninput = function () { $('cfeedBtn').textContent = 'Feed community (' + fmt(Math.floor(Number(this.value) || 0)) + ')'; };
  $('cfeedBtn').onclick = function () { var p = V.communityFeedPlan($('cAmt').value); if (!p.ok) return toast('⚠️ ' + p.error); confirmPlans('Feed the ' + V.COMMUNITY_PET, [{ tag: p.tag, amount: p.amount }]); };
  /* community roll (2026-10-15, Jake): pet:c:roll, 690, Nakamoto gets one random gear item; offered only once the tip reaches ACTIVATE_CROLL_BLOCK */
  $('crollBtn').onclick = function () { if (!V.crollOn(S.tip)) return toast('Community roll switches on at block ' + fmt(V.ACTIVATE_CROLL_BLOCK) + ' (chain tip ' + fmt(S.tip) + ').');
    var pl = V.communityRollPlan(); confirmPlans('Community roll: Nakamoto gets one random gear item', [pl], function () { toast('🎲 Community roll submitted. Nakamoto\'s new piece depends on the block your burn lands in.', 9000); }); };
  $('balRefresh').onclick = render;

  // ---------------------------------------------------------------- battles
  function fighters(w, owner, not) { return w.pets.filter(function (p) { return (not ? p.owner !== owner : p.owner === owner) && !p.dead && !p.released && p.stage >= 2 && !p.neglected; }); }
  function opt(p) { return '<option value="' + p.id + '">#' + p.id + ' ' + esc(p.name) + ' (' + spLabel(p.species) + ' ' + p.stageName + ')' + (p.owner !== ME ? ' — ' + esc(p.owner) : '') + '</option>'; }
  function renderBattles(w) {
    var a = $('fMine').value, b = $('fTheirs').value;
    $('fMine').innerHTML = fighters(w, ME).map(opt).join('') || '<option value="">no eligible pet</option>'; $('fTheirs').innerHTML = fighters(w, ME, true).map(opt).join('');
    if (a) $('fMine').value = a; if (b) $('fTheirs').value = b;
    $('fights').innerHTML = w.fights.slice().reverse().map(function (f) { var A = w.byId[f.a], B = w.byId[f.b];
      return '<div class="txrow">⚔️ fight ' + f.id + ': #' + f.a + ' ' + esc(A.name) + ' vs #' + f.b + ' ' + esc(B.name) + ' · ' + f.status + (f.status === 'open' ? ' (accept by block ' + f.expires + ')' : '') +
        (f.status === 'done' ? ' · winner #' + f.winner + (f.spoils ? ' took ' + esc(f.spoils.label) : '') + ' <button class="q" data-view="' + f.id + '">▶ Replay</button>' : '') +
        (f.status === 'open' && B.owner !== ME ? ' <button class="q" data-npc="' + f.id + '">Rival accepts</button>' : '') + (f.status === 'open' && B.owner === ME ? ' <button class="btn ico-flame" data-acc="' + f.id + '">Accept (690)</button>' : '') + '</div>'; }).join('') || '<p class="muted small">No fights yet.</p>';
    $('fights').querySelectorAll('[data-view]').forEach(function (x) { x.onclick = function () { playFight(world().fights[x.dataset.view - 1]); }; });
    $('fights').querySelectorAll('[data-npc]').forEach(function (x) { x.onclick = function () { var f = world().fights[x.dataset.npc - 1]; adv(3); burn(world().byId[f.b].owner, 'pet:accept:' + f.id, 690); save(); render(); playFight(world().fights[f.id - 1]); }; });
    $('fights').querySelectorAll('[data-acc]').forEach(function (x) { x.onclick = function () { confirmPlans('Accept fight ' + x.dataset.acc, [{ tag: 'pet:accept:' + x.dataset.acc, amount: 690 }], function () { playFight(world().fights[x.dataset.acc - 1]); }); }; });
  }
  $('fGo').onclick = function () { var a = $('fMine').value, b = $('fTheirs').value; if (!a || !b) return toast('Pick both pets'); confirmPlans('Challenge #' + b, [{ tag: V.buildTag('fight', { a: a, b: b }), amount: 690 }]); };
  $('fNpc').onclick = function () { var w = world(), my = fighters(w, ME), np = fighters(w, ME, true).filter(function (p) { return !p.fightDays[V.day(S.tip)]; });
    if (!my.length || !np.length) return toast('No eligible pets'); var m = my[S.n % my.length], n = np[S.n % np.length]; burn(n.owner, 'pet:fight:' + n.id + ':' + m.id, 690); save(); render(); toast('⚔️ ' + n.owner + ' challenged #' + m.id); };
  // Animation pop-up (2026-10-14): battle / rumble / breeding animations play in a centred modal over a dimmed backdrop; the page never scrolls.
  // The arena element is moved into the modal and put back on close (finish, Skip, Esc, backdrop click); scroll position is restored.
  var animM = { el: null, home: null, y: 0, iv: null, onClose: null };
  function animOpen(el, iv, onClose) { animClose(true); var box = $('animBox'); if (!box) { box = document.createElement('div'); box.id = 'animBox'; box.className = 'reveal anim'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
      box.innerHTML = '<div class="box wide"><button type="button" class="q" id="animClose" style="float:right" aria-label="Close">&times;</button><div id="animSlot"></div></div>'; document.body.appendChild(box);
      box.addEventListener('click', function (e) { if (e.target === box) animClose(); }); $('animClose').onclick = function () { animClose(); }; }
    animM.y = window.scrollY; animM.el = el; animM.home = document.createComment('arena'); el.parentNode.insertBefore(animM.home, el); $('animSlot').appendChild(el); animM.onClose = onClose || null;
    box.classList.add('on'); window.scrollTo(0, animM.y); }
  function animClose(silent) { var box = $('animBox'); if (!animM.el) return; var y = animM.y, cb = animM.onClose; animM.home.parentNode.insertBefore(animM.el, animM.home); animM.home.remove(); animM.el = null; animM.onClose = null;
    if (box) box.classList.remove('on'); if (!silent && cb) cb(); window.scrollTo(0, y); }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && animM.el) animClose(); });
  window.V2AnimClose = animClose; window.V2PlayFight = function (f) { playFight(f); };
  function playFight(f) {
    if (!f || !f.turns) return; var w = world(), c = $('arena'), ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
    var A = w.byId[f.a], B = w.byId[f.b], fa = petFrames(Object.assign({}, A, { blackEye: false, crowned: false }), w), fb = petFrames(Object.assign({}, B, { blackEye: false, crowned: false }), w);
    var fl = petFrames(Object.assign({}, f.loser === A.id ? A : B, { blackEye: true }), w), tmp = document.createElement('canvas'); tmp.width = tmp.height = 32;
    var t = 0, k = 0, hpA = f.maxA, hpB = f.maxB, msg = 'FIGHT: #' + A.id + ' vs #' + B.id, sp = f.spoils ? (typeof f.spoils === 'string' ? f.spoils : f.spoils.label) : null;
    $('fightLog').innerHTML = f.turns.map(function (x) { return '<li>#' + (x.by === 'a' ? A.id : B.id) + ' swings ' + esc(x.weapon) + (x.dodge ? ' — dodged!' : ' for ' + x.dmg + (x.crit ? ' CRIT' : '')) + ' (HP ' + x.hpA + ' / ' + x.hpB + ')</li>'; }).join('') + '<li><b>Winner #' + f.winner + '</b>' + (sp ? ' takes ' + esc(sp) : '') + ' · loser: black eye ' + V.BLACK_EYE_BLOCKS + ' blocks</li>';
    clearInterval(playFight.iv);
    function draw(img, x, flip, lunge) { tmp.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(img.data), 32, 32), 0, 0); ctx.save(); if (flip) { ctx.translate(x + 96 + lunge, 40); ctx.scale(-1, 1); ctx.drawImage(tmp, 0, 0, 96, 96); } else ctx.drawImage(tmp, x + lunge, 40, 96, 96); ctx.restore(); }
    playFight.iv = setInterval(function () { k++; var cur = f.turns[t], ph = k % 4, done = t >= f.turns.length;
      ctx.fillStyle = '#0a0f0b'; ctx.fillRect(0, 0, c.width, c.height);
      draw(done && f.loser === A.id ? fl[k % 4] : fa[k % 4], 30, false, !done && cur.by === 'a' && ph === 1 ? 40 : 0); draw(done && f.loser === B.id ? fl[k % 4] : fb[k % 4], 234, true, !done && cur.by === 'b' && ph === 1 ? -40 : 0);
      ctx.fillStyle = '#2a3a2e'; ctx.fillRect(20, 14, 140, 8); ctx.fillRect(200, 14, 140, 8); ctx.fillStyle = '#3ddc84'; ctx.fillRect(20, 14, 140 * hpA / f.maxA, 8); ctx.fillRect(200, 14, 140 * hpB / f.maxB, 8);
      ctx.fillStyle = '#e8f5ec'; ctx.font = '9px "Press Start 2P", monospace'; ctx.fillText(msg, 12, 158);
      if (!done && ph === 1) { hpA = cur.hpA; hpB = cur.hpB; msg = 'T' + cur.n + ' #' + (cur.by === 'a' ? A.id : B.id) + ' ' + cur.weapon + (cur.dodge ? ' MISS' : ' -' + cur.dmg + (cur.crit ? '!' : '')); ctx.fillStyle = cur.crit ? '#ffc93c' : '#ff5a5a'; ctx.font = '16px "Press Start 2P", monospace'; ctx.fillText(cur.dodge ? 'MISS' : '-' + cur.dmg, cur.by === 'a' ? 250 : 60, 40); }
      if (!done && ph === 3) t++;
      if (done) { msg = 'WINNER #' + f.winner + (sp ? ' +' + sp : ''); if (!playFight.endAt) playFight.endAt = k + 12; if (k >= playFight.endAt) { clearInterval(playFight.iv); playFight.endAt = 0; animClose(); } } }, 220);
    playFight.endAt = 0; animOpen(c.parentNode, playFight.iv, function () { clearInterval(playFight.iv); playFight.endAt = 0; });
  }
  // ---------------------------------------------------------------- rumble
  function renderRumble(w) {
    var wk = V.weekOf(S.tip), R = w.rumbles[wk], sb = V.seedBlockOfWeek(wk);
    $('rInfo').innerHTML = 'Week <b>' + wk + '</b> · seed block <b>' + fmt(sb) + '</b> (' + (sb - S.tip) + ' blocks left) · entrants <b>' + (R ? R.entrants.length : 0) + '</b>' + (R && R.entrants.length ? ': ' + R.entrants.map(function (e) { return '#' + e.id + (e.stake === 'burn' ? ' (690 stake)' : ''); }).join(', ') : '');
    $('rPet').innerHTML = fighters(w, ME).map(function (p) { var has = V.wornOf(w, p.id).some(function (g) { return !g.legendary; }); return '<option value="' + p.id + '" data-c="' + (has ? 69 : 759) + '">#' + p.id + ' ' + esc(p.name) + ' — ' + (has ? 'risks 1 gear piece · 69' : 'no gear · 69 + 690') + '</option>'; }).join('');
    var done = Object.keys(w.rumbles).map(function (k) { return w.rumbles[k]; }).filter(function (r) { return r.done && r.rounds.length; }).pop(), h = '';
    if (done) { h += '<h3 class="sec" data-ico="trophy">Week ' + done.week + ' bracket</h3><p class="small muted">seed ' + done.seedHash.slice(0, 24) + '…</p><div class="bracket">';
      done.rounds.forEach(function (ms, ri) { h += '<div class="rcol"><b class="small">' + (ri === done.rounds.length - 1 ? 'Final' : 'Round ' + (ri + 1)) + '</b>' + ms.map(function (m, mi) {
        return '<div class="chips">' + (m.bye ? '<span class="chip">#' + m.a + ' bye</span>' : '<span class="chip' + (m.winner === m.a ? ' win' : '') + '">#' + m.a + '</span><span class="chip' + (m.winner === m.b ? ' win' : '') + '">#' + m.b + '</span><button class="q" data-rm="' + ri + ':' + mi + '">▶</button>') + '</div>'; }).join('') + '</div>'; });
      h += '<div class="rcol"><b class="small">Champion</b><span class="pill tier tier-legendary">👑 #' + done.champion + '</span></div></div><h3 class="sec" data-ico="flame">Highlights</h3><div class="logbox small">' + done.highlights.map(function (x) { return '<div>' + esc(x) + '</div>'; }).join('') + '</div>'; }
    else h = '<p class="muted small">No rumble resolved yet: enter pets, let rivals enter, then advance past the seed block.</p>';
    $('rBody').innerHTML = h;
    $('rBody').querySelectorAll('[data-rm]').forEach(function (b) { b.onclick = function () { var q = b.dataset.rm.split(':'), m = done.rounds[q[0]][q[1]]; playFight({ a: m.a, b: m.b, turns: m.turns, maxA: m.maxA, maxB: m.maxB, winner: m.winner, loser: m.loser, spoils: m.spoils }); }; });
  }
  $('rGo').onclick = function () { var o = $('rPet').selectedOptions[0]; if (!o) return toast('No eligible pet'); confirmPlans('Royal Rumble entry #' + o.value, [{ tag: 'pet:rumble:' + o.value, amount: Number(o.dataset.c) }]); };
  $('rNpc').onclick = function () { var w = world(); fighters(w, ME, true).forEach(function (p) { var has = V.wornOf(w, p.id).some(function (g) { return !g.legendary; }); burn(p.owner, 'pet:rumble:' + p.id, has ? 69 : 759); }); save(); render(); };
  $('rSeed').onclick = function () { adv(V.seedBlockOfWeek(V.weekOf(S.tip)) - S.tip + 1); save(); render(); };
  // ---------------------------------------------------------------- breeding
  function renderBreed(w) {
    var a = $('bA').value, b = $('bB').value, L = V.breedPicker(w, ME, S.tip, a);
    if (a && !L.mine.some(function (x) { return String(x.p.id) === a && !x.why; })) a = $('bA').value = '';
    if (b && !L.partners.some(function (x) { return String(x.p.id) === b && !x.why; })) b = $('bB').value = '';
    /* perf (2026-10-14): a 2,000-pet wallet has ~6,000 picker cards. Eligibility is one breedPicker pass per render (cheap); the cards are built
     * ONCE per world (one HTML string -> one fragment, lazy sprites, one delegated click per grid) and a pick only updates the affected cards. */
    function card(x, role, sel) { var p = x.p, on = String(p.id) === sel;
      return '<button type="button" class="pet card' + (on ? ' sel' : '') + (x.why ? ' off' : '') + '" data-role="' + role + '" data-pid="' + p.id + '" title="' + esc(x.why ? 'Can\'t pick: ' + x.why : 'Pick #' + p.id + ' as parent ' + role) + '" aria-pressed="' + on + '">' +
        '<canvas width="32" height="32"></canvas><b style="color:var(--ink)">' + esc(p.name) + '</b><div class="muted">#' + p.id + ' · ' + esc(spLabel(p.species)) + ' · ' + p.stageName + '</div>' + (p.owner !== ME ? '<div class="muted">' + esc(p.owner) + '</div>' : '') + '</button>'; }
    function patch(box, pid, role) { var x = pid && box.__by[pid], d = x && box.querySelector('.pet.card[data-pid="' + pid + '"]'); if (!d) return;
      d.classList.toggle('off', !!x.why); d.title = x.why ? 'Can\'t pick: ' + x.why : 'Pick #' + pid + ' as parent ' + role; }
    function grid(box, list, sel, role, input) {
      var by = {}; list.forEach(function (x) { by[x.p.id] = x; }); var k = S.tip + '|' + list.length;
      if (box.__w === w && box.__k === k) { var oldA = box.__a; box.__by = by; box.__a = a; if (oldA !== a) { patch(box, oldA, role); patch(box, a, role); }
        box.querySelectorAll('.pet.card.sel').forEach(function (d) { if (d.dataset.pid !== sel) { d.classList.remove('sel'); d.setAttribute('aria-pressed', 'false'); } });
        var d = sel && box.querySelector('.pet.card[data-pid="' + sel + '"]'); if (d) { d.classList.add('sel'); d.setAttribute('aria-pressed', 'true'); } return; }
      box.__w = w; box.__k = k; box.__by = by; box.__a = a;
      if (!list.length) { box.innerHTML = '<span class="muted small">no pets</span>'; return; }
      var t = document.createElement('template'); t.innerHTML = list.map(function (x) { return card(x, role, sel); }).join(''); box.textContent = ''; box.appendChild(t.content);
      var cs = box.getElementsByTagName('canvas'); for (var i = 0; i < cs.length; i++) (function (p) { R.lazy(cs[i], function () { return petFrames(p, w); }, true); })(list[i].p);
      if (!box.__deleg) { box.__deleg = 1; box.addEventListener('click', function (e) { var d = e.target.closest && e.target.closest('.pet.card[data-pid]'); if (!d || !box.contains(d)) return; var x = box.__by[d.dataset.pid]; if (!x) return; var p = x.p;
        if (x.why) return toast('#' + p.id + ': ' + x.why); input.value = String(p.id) === input.value ? '' : String(p.id); if (input === $('bA') && $('bB').value === input.value) $('bB').value = ''; renderBreed(world()); }); } }
    /* eligible only (2026-10-14, Jake): the pickers list just the pets that can breed RIGHT NOW under the replay's breedable() rule
     * (Adult+ = stage >= 3, not neglected/dead/released, under BREED_MAX breedings, BREED_COOLDOWN blocks since the last one; no Nakamoto/community).
     * B also excludes the pet picked as A. An 'N of M can breed now' note and an empty state that names the real reasons. */
    function why0(r) { return /^breeding cooldown/.test(r) ? 'breeding cooldown' : r; }
    function reasons(list) { var c = {}; list.forEach(function (x) { if (x.why) { var k = why0(x.why); c[k] = (c[k] || 0) + 1; } });
      return Object.keys(c).sort(function (x, y) { return c[y] - c[x]; }).map(function (k) { return esc(k) + ' (' + fmt(c[k]) + ')'; }).join(', '); }
    var RULE = 'A pet can breed when it is <b>Adult or older</b> (stage 3+: Adult, Elder, Mythic), not neglected, has bred fewer than <b>' + V.BREED_MAX + '</b> times and its last breeding was at least <b>' + fmt(V.BREED_COOLDOWN) + ' blocks</b> ago (about a week). Nakamoto and community pets never breed.';
    var okA = L.mine.filter(function (x) { return !x.why; }), okB = L.partners.filter(function (x) { return !x.why; });
    function note(id, after, html) { var n = $(id); if (!n) { n = document.createElement('div'); n.id = id; n.className = 'small muted bnote'; after.parentNode.insertBefore(n, after); } n.innerHTML = html; }
    note('bNoteA', $('bGridA'), fmt(okA.length) + ' of ' + fmt(L.mine.length) + ' of your pets can breed now.');
    note('bNoteB', $('bGridB'), fmt(okB.length) + ' of ' + fmt(L.partners.length) + ' pets can breed now' + (a ? ' (excluding parent A #' + esc(a) + ')' : '') + '.');
    grid($('bGridA'), okA, a, 'A', $('bA')); grid($('bGridB'), okB, b, 'B', $('bB'));
    if (!okA.length) $('bGridA').innerHTML = '<p class="small bempty">' + (L.mine.length ? 'None of your pets can breed yet: ' + reasons(L.mine) + '. ' : 'You have no living pets. ') + RULE + '</p>';
    if (!okB.length) $('bGridB').innerHTML = '<p class="small bempty">No partner can breed right now' + (L.partners.length ? ': ' + reasons(L.partners) : '') + '. ' + RULE + '</p>';
    if (!okA.length) $('bGridA').__w = null; if (!okB.length) $('bGridB').__w = null;
    $('bSelA').textContent = a ? '#' + a + ' ' + w.byId[a].name : 'pick one'; $('bSelB').textContent = b ? '#' + b + ' ' + w.byId[b].name : 'pick one';
    $('bKids').innerHTML = w.pets.filter(function (p) { return p.parents; }).map(function (k) { return '<span class="chip">#' + k.id + ' ' + esc(k.name) + ' · ' + TL[k.tier] + ' ' + spLabel(k.species) + ' · ' + k.stageName + ' ← #' + k.parents.join(' × #') + '</span>'; }).join('') || '<span class="muted">none yet</span>';
    $('bReqs').innerHTML = w.breedReqs.filter(function (r) { return !r.used && S.tip - r.block <= V.BREED_WINDOW; }).map(function (r) { return '<div>#' + r.a + ' → #' + r.b + ' (until block ' + (r.block + V.BREED_WINDOW) + ') ' + (w.byId[r.b].owner !== ME ? '<button class="q" data-bacc="' + r.a + ':' + r.b + '">Partner accepts</button>' : '') + '</div>'; }).join('') || '<div class="muted">none</div>';
    $('bReqs').querySelectorAll('[data-bacc]').forEach(function (x) { x.onclick = function () { var q = x.dataset.bacc.split(':'), n0 = petIds(); burn(world().byId[q[1]].owner, 'pet:breed:' + q[1] + ':' + q[0], 690); save(); render(); playBreed(q[0], q[1], n0); }; });
  }
  $('bGo').onclick = function () { var a = $('bA').value, b = $('bB').value; if (!a || !b) return toast('Pick parent A and parent B'); var n0 = petIds();
    confirmPlans('Breed #' + a + ' × #' + b, [{ tag: V.buildTag('breed', { a: a, b: b }), amount: 690 }], function () { var y = window.scrollY; $('bA').value = ''; $('bB').value = ''; render(); window.scrollTo(0, y); playBreed(a, b, n0); }); };
  function petIds() { var o = {}; world().pets.forEach(function (p) { o[p.id + ':' + (p.parents || '')] = 1; }); return o; } // pets before the breed (ids are not append-only: Max Pepe is replayed last)
  /** playBreed: the battle arena's approach for a breed. Both parents hop together, hearts, the egg appears, then the result. Display only. Skippable. */
  /** feedEgg(id): the normal feed flow for a freshly bred egg (existing confirm dialog, default 69). */
  function feedEgg(id) { if (animM.el) animClose(true); var y = window.scrollY; confirmPlans('Feed #' + id, [{ tag: 'pet:feed:' + id, amount: 69, petId: id, label: 'Feed #' + id }], function () { render(); window.scrollTo(0, y); toast('🍼 Fed egg #' + id); }); }
  window.V2FeedEgg = feedEgg;
  function playBreed(a, b, n0) {
    var w = world(), A = w.byId[a], B = w.byId[b], kid = w.pets.filter(function (p) { return !n0[p.id + ':' + (p.parents || '')]; }).filter(function (p) { return p.parents && p.parents.map(String).indexOf(String(a)) >= 0 && p.parents.map(String).indexOf(String(b)) >= 0; })[0];
    if (!A || !B) return; var c = $('breedArena'), ctx = c.getContext('2d'), tmp = document.createElement('canvas'); tmp.width = tmp.height = 32; ctx.imageSmoothingEnabled = false;
    var fa = petFrames(A, w), fb = petFrames(B, w), fk = kid ? petFrames(kid, w) : null, k = 0, END = 64;
    $('breedStage').style.display = ''; $('breedMsg').textContent = kid ? '' : 'Request sent: the partner\'s owner must mirror it within 144 blocks.';
    function draw(img, x, y, flip, size) { size = size || 96; tmp.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(img.data), 32, 32), 0, 0); ctx.save();
      if (flip) { ctx.translate(x + size, y); ctx.scale(-1, 1); ctx.drawImage(tmp, 0, 0, size, size); } else ctx.drawImage(tmp, x, y, size, size); ctx.restore(); }
    function heart(x, y, col) { ctx.fillStyle = col; [[1, 0], [2, 0], [4, 0], [5, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [2, 3], [3, 3], [4, 3], [3, 4]].forEach(function (q) { ctx.fillRect(x + q[0] * 3, y + q[1] * 3, 3, 3); }); }
    function frame() { var t = Math.min(k, END), walk = Math.min(1, t / 14), hop = t < 14 ? -Math.abs(Math.sin(t * 0.9)) * 10 : 0, back = t > 30 ? Math.min(1, (t - 30) / 8) : 0;
      ctx.fillStyle = '#0a0f0b'; ctx.fillRect(0, 0, c.width, c.height);
      var xa = 30 + 60 * walk - 50 * back, xb = 234 - 60 * walk + 50 * back;
      draw(fa[k % 4], xa, 40 + hop, false); draw(fb[k % 4], xb, 40 + hop, true);
      if (t >= 14 && t < 34) for (var h = 0; h < 3; h++) heart(160 + (h - 1) * 22 + Math.sin((t + h * 3) * 0.6) * 4, 60 - ((t - 14) * 2 + h * 9) % 50, h % 2 ? '#ff8fd0' : '#ff5a5a');
      if (t >= 22 && t < 34 && t % 2) { ctx.fillStyle = '#ffc93c'; ctx.fillRect(176 + (t % 7) * 3 - 9, 92 - (t % 5) * 6, 3, 3); ctx.fillRect(170 - (t % 5) * 4, 70 + (t % 3) * 8, 3, 3); }
      if (t >= 30 && fk) { var s = Math.min(64, 16 + (t - 30) * 6); draw(fk[k % 4], 180 - s / 2, 120 - s, false, s); }
      ctx.fillStyle = '#e8f5ec'; ctx.font = '9px "Press Start 2P", monospace';
      ctx.fillText(t < 14 ? 'BREED: #' + A.id + ' x #' + B.id : t < 30 ? '<3 <3 <3' : kid ? (kid.hybrid ? 'HYBRID! ' + kid.hybrid.name.toUpperCase() : 'EGG #' + kid.id + '!') : 'REQUEST SENT', 12, 158);
      if (t >= 40 && kid && !$('bFeedEgg')) { $('breedMsg').innerHTML = (kid.hybrid ? '🧬 <span class="chip hyb">HYBRID</span> <b>' + esc(kid.hybrid.name) + '</b> (' + esc(V.speciesLabel(kid.hybrid.a)) + ' × ' + esc(V.speciesLabel(kid.hybrid.b)) + ') · ' : '') + '🥚 <b>#' + kid.id + ' ' + esc(kid.name) + '</b> · ' + TL[kid.tier] + ' ' + esc(spLabel(kid.species)) + ' · starts as an Egg · parents #' + A.id + ' × #' + B.id + '<br><span class="hatchnote">Your new egg #' + kid.id + ' is in My Pets. Feed it 69 XCPETS to hatch.</span> <button type="button" class="q" id="bFeedEgg" data-egg="' + kid.id + '">🍼 Feed to hatch</button>'; $('bFeedEgg').onclick = function () { feedEgg(kid.id); }; } }
    clearInterval(playBreed.iv); frame(); playBreed.iv = setInterval(function () { k++; frame(); if (k >= END) { clearInterval(playBreed.iv); setTimeout(function () { if (animM.el === $('breedStage')) animClose(); }, 1200); } }, 120);
    $('bSkip').onclick = function () { clearInterval(playBreed.iv); k = END; frame(); animClose(); };
    animOpen($('breedStage'), playBreed.iv, function () { clearInterval(playBreed.iv); k = END; frame(); });
  }
  window.V2PlayBreed = playBreed; window.V2PetIds = petIds; // used by the screenshot/UI check
  // ---------------------------------------------------------------- burns + log (live .txrow look)
  function renderLog(w) {
    var row = function (l) { return '<a href="#" class="txrow" data-tx="' + esc(l.tx) + '">' + esc(l.kind) + ' · block ' + l.block + ' · ' + esc(l.msg) + '</a>'; };
    var mineTx = {}; S.rows.forEach(function (r) { if (r.source === ME) mineTx[r.tx_hash] = 1; });
    var pend = V2Wallet.tracker.list().filter(function (t) { return !S.rows.some(function (x) { return x.tx_hash === t.txid; }); }).reverse().map(function (t) { return '<div class="small">⏳ ' + esc(t.label || t.tag) + ' · ' + fmt(t.amount) + ' XCPETS · <a target="_blank" rel="noopener" href="https://mempool.space/tx/' + t.txid + '">' + t.txid.slice(0, 8) + '…</a> · waiting for a block</div>'; }).join('');
    $('pending').innerHTML = pend + (w.log.filter(function (l) { return mineTx[l.tx]; }).slice(-8).reverse().map(row).join('') || (pend ? '' : 'None yet.'));
    $('log').innerHTML = w.log.slice(-200).reverse().map(row).join('');
  }
  $('advDay').onclick = function () { adv(144); save(); render(); }; $('advBlk').onclick = function () { adv(12); save(); render(); };
  $('reset').onclick = function () { if (confirm('Reset the local demo?')) { localStorage.removeItem(KEY); localStorage.removeItem(WKEY); localStorage.removeItem(HKEY); seedWorld(); render(); } };
  // ---------------------------------------------------------------- every other live control works in the demo
  $('dcYes').onclick = function () { var ids = mine(world()).filter(function (p) { return p.tier === 0; }).map(function (p) { return p.id; }); close('delCommonsBox'); if (!ids.length) return toast('No Commons to hide.'); discardIds(ids); };
  $('dcNo').onclick = function () { close('delCommonsBox'); };
  $('itemClose').onclick = function () { close('itemBox'); };
  $('packClose').onclick = closeReveal; $('packSkip').onclick = closeReveal;
  $('packCommons').onclick = function () { if (!rev || rev.kind !== 'eggs') return; var w = world(), ids = rev.eggs.filter(function (id) { return w.byId[id] && w.byId[id].art.tierIndex === 0; });
    if (!ids.length) return toast('No Commons in this hatch.'); hideIds(ids); rev.eggs = rev.eggs.filter(function (id) { return ids.indexOf(id) < 0; }); if (rev.eggs.length) drawReveal(); else closeReveal(); };
  $('packDiscard').onclick = function () { if (!rev || rev.kind !== 'eggs') return; var ids = Object.keys(rev.sel).map(Number); if (!ids.length) return toast('Tick Discard on at least one pet first.');
    hideIds(ids); rev.eggs = rev.eggs.filter(function (id) { return ids.indexOf(id) < 0; }); rev.sel = {}; if (rev.eggs.length) drawReveal(); else closeReveal(); };
  $('txClose').onclick = function () { close('txBox'); };
  $('waitCancel').onclick = function () { close('waitOverlay'); };
  $('introSkip').onclick = function () { close('intro'); };
  $('replayIntro').onclick = function (e) { e.preventDefault(); var fr = commAnim && commAnim.fr ? commAnim.fr : WizardSprite.frames(world().community.wizardStage, '#2a3a2e'); R.animate($('introCv'), fr); /* current community pet (Nakamoto before The Return: no Wizard spoiler) */ $('introText').textContent = 'Welcome to XCPETS v2'; open('intro'); setTimeout(function () { close('intro'); }, 2500); };
  $('wdisconnect').onclick = function () { toast('Read-only build: open play.html?addr=YOUR_ADDRESS to view your pets'); };
  $('gWallet').onclick = function () { toast('Demo: no owner login needed'); };
  function showTx(tx) { var w = world(), l = w.log.filter(function (x) { return x.tx === tx; })[0], r = S.rows.filter(function (x) { return x.tx_hash === tx; })[0]; if (!l) return;
    $('txInfo').innerHTML = '<p class="small"><b>' + esc(l.kind) + '</b> · ' + esc(l.msg) + '</p><table class="small"><tr><td>block</td><td>' + l.block + '</td></tr><tr><td>tx</td><td><code>' + esc(tx) + '</code></td></tr>' + (r ? '<tr><td>from</td><td>' + esc(r.source) + '</td></tr><tr><td>tag</td><td><code>' + esc(r.tag) + '</code></td></tr><tr><td>amount</td><td>' + fmt(r.amount) + ' XCPETS</td></tr>' : '') + '</table><p class="small muted">Burn sent from your XCP Wallet.</p>'; open('txBox'); }
  ['pending', 'log'].forEach(function (id) { $(id).onclick = function (e) { var a = e.target.closest('a[data-tx]'); if (!a) return; e.preventDefault(); showTx(a.dataset.tx); }; });
  function route() { var m = /^#pet-(\d+)$/.exec(location.hash); if (m && world().byId[m[1]]) { detailId = Number(m[1]); detail(world().byId[detailId]); }
    var dm = /^#discard-(\d+)$/.exec(location.hash); if (dm) { var dp = world().byId[dm[1]]; history.replaceState(null, '', location.pathname + location.search);
      if (dp && dp.owner === ME) setTimeout(function () { discardIds([dp.id]); }, 300); else toast('Connect the wallet that owns that pet to discard it.'); } }
  window.addEventListener('hashchange', route);
  /* layout hotfix (2026-10-14): the bulk row was position:sticky; top:0 with the same z-index as the sticky nav, so it slid over the nav
   * (and at 390 px a 270 px-tall bulk row covered most of the screen). Now the filter row + bulk row share ONE sticky wrapper that sits
   * just under the nav (top = measured nav height), below it in z-order, with an opaque background; on narrow screens it doesn't stick. */
  (function () { var ctl = document.querySelector('#petsPanel .petctl'), bulk = $('bulkRow'); if (!ctl || !bulk || ctl.parentNode.classList.contains('petsticky')) return;
    var wrap = document.createElement('div'); wrap.className = 'petsticky'; ctl.parentNode.insertBefore(wrap, ctl); wrap.appendChild(ctl); wrap.appendChild(bulk);
    function navH() { var n = document.querySelector('header.nav'); document.documentElement.style.setProperty('--navh', (n ? Math.ceil(n.getBoundingClientRect().height) : 0) + 'px'); }
    navH(); window.addEventListener('resize', navH); })();
  render(); route(); setInterval(function () { M.refresh(render); }, 60000); /* new confirmed burns (e.g. your roll result) */
  window.__demo = { S: function () { return S; }, world: world, render: render, toggle: toggle, detail: function (id) { detailId = id; detail(world().byId[id]); }, playFight: playFight, discardIds: discardIds, mine: mine, selUi: selUi, confirmPlans: confirmPlans };
})();
