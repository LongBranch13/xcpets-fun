/* XCPETS play page UI (live game): reads real XCPETS burns via js/v2-chain.js; every burn is signed by the player in XCP Wallet. */
(function () {
  'use strict';
  var V = window.V2Rules, $ = function (id) { return document.getElementById(id); }, KEY = V2Mock.KEY, ME = V2Mock.ME;
  var fmt = function (n) { n = Number(n); return n.toLocaleString('en-US', { maximumFractionDigits: Math.abs(n) >= 1 || n === 0 ? 2 : 8 }); }; /* >= 1: 2 decimals (hides float noise like 1,335,328.99999996) */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }

  // ---------------------------------------------------------------- chain state (shared with the other pages: js/v2-chain.js, V2Mock interface)
  var M = window.V2Mock, S = M.state();
  function save() { M.save(); } function burn(src, tag, amount) { M.burn(src, tag, amount); } function adv(n) { M.adv(n); }
  function world() { return M.world(); }

  // ---------------------------------------------------------------- rendering (shared with every page: js/v2-render.js)
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
  function idList(ids) { return '#' + ids.slice(0, 5).join(', #') + (ids.length > 5 ? ' +' + (ids.length - 5) + ' more' : ''); }
  function restoreLocal(ids) { setHidden(hiddenIds().filter(function (x) { return ids.indexOf(x) < 0; })); render(); toast('Restored ' + idList(ids) + '.'); }
  /* Keep/star (build 2, 2026-10-16): browser-only flag per network + address. Kept pets are skipped by the bulk discards; nothing on chain. */
  function keepKey() { return 'xcpets-keep-' + NET + '-' + (ME || ''); }
  function keptIds() { try { return JSON.parse(localStorage.getItem(keepKey()) || '[]'); } catch (e) { return []; } }
  function isKept(id) { return keptIds().indexOf(Number(id)) >= 0; }
  function toggleKeep(id) { id = Number(id); var l = keptIds(), i = l.indexOf(id); if (i >= 0) l.splice(i, 1); else l.push(id); try { localStorage.setItem(keepKey(), JSON.stringify(l)); } catch (e) { }
    var on = i < 0; document.querySelectorAll('.keepbtn[data-keep="' + id + '"]').forEach(function (b) { b.textContent = on ? '★' : '☆'; b.setAttribute('aria-pressed', String(on)); b.title = on ? 'Kept: skipped by bulk discards. Click to unstar.' : 'Keep: star this pet so bulk discards skip it'; });
    toast(on ? '★ #' + id + ' kept: bulk discards skip it.' : '☆ #' + id + ' no longer kept.'); return on; }
  function keepBtn(id) { var on = isKept(id); return '<button type="button" class="keepbtn" data-keep="' + id + '" aria-pressed="' + on + '" aria-label="Keep #' + id + '" title="' + (on ? 'Kept: skipped by bulk discards. Click to unstar.' : 'Keep: star this pet so bulk discards skip it') + '">' + (on ? '★' : '☆') + '</button>'; }
  function dropKept(ids) { var k = keptIds(); return ids.filter(function (id) { return k.indexOf(id) < 0; }); }
  function discardIds(ids) { if (!ids.length) { toast('Tick Discard on at least one pet first.'); return; } hideLocal(ids); }
  function mine(w) { var h = hiddenIds(); return w.pets.filter(function (p) { return p.owner === ME && !p.released && h.indexOf(p.id) < 0; }); }
  function sel() { return S.sel.slice(); }
  var commAnim = null;
  // ---------------------------------------------------------------- gear-win notification (single roll, bulk rolls, live/free-token rolls, trophies)
  var WKEY = 'xcpets-v2-seen-' + KEY + '-' + ME;
  var winsLooks = 0; /* wins found on the first look or in the first 2 minutes after page load = they landed while the player was away ("While you were away") */
  function notifyWins(w) {
    var seen = null; try { seen = JSON.parse(localStorage.getItem(WKEY)); } catch (e) { }
    var r = V.newWins(w, ME, seen); try { localStorage.setItem(WKEY, JSON.stringify(r.seen)); } catch (e) { }
    if (r.wins.length) try { if (autoEquipChoice(w, r.wins)) setTimeout(render, 0); } catch (e) { if (window.console) console.warn('auto-equip choice', e); }
    var cw = communityWins(w), all = r.wins.concat(cw);
    if (all.length) revealQ.push({ kind: 'gear', wins: all, away: winsLooks === 0 || (window.performance && performance.now() < 120000) }); winsLooks++; return all;
  }
  /* AUTO-EQUIP SETTING (owner, 2026-10-19): a per-device choice, stored next to the player's local equips. No chain rule changes: replay still
   * wears a newly rolled piece (exactly as before), and this layer then adds ordinary free local equip ops (the same ops as tapping Equip / Take off).
   *  - OFF (default): every newly landed piece that replay put on goes to the bag; the pet keeps what it wore before the batch (or that slot is emptied).
   *  - ON: works as before, but never a downgrade: if the pet wore a better piece in that slot before the batch (or an earlier piece of the same batch
   *    is better), that one goes back on and the new one goes to the bag. Rank = tier, ★ legendary highest; ties keep the newest.
   * Battle spoils (owner, 2026-10-19): a piece your pet wins in a battle or rumble (replay: worn only if that slot was empty) follows the same setting:
   *    OFF: it goes to the bag; ON: it is worn unless the pet already wears something better in that slot (ties keep the newest). Same free local ops.
   * Community pet (Bitcoin Wizard): not a player item, always wears its newest community roll; no setting. */
  var AEKEY = 'xcpets-v2-autoequip-' + KEY + '-' + ME;
  function autoEquipIsOn() { try { return localStorage.getItem(AEKEY) === 'on'; } catch (e) { return false; } }
  function setAutoEquip(on) { try { localStorage.setItem(AEKEY, on ? 'on' : 'off'); } catch (e) { } document.querySelectorAll('[data-aetog]').forEach(paintAeTog); }
  function paintAeTog(b) { var on = autoEquipIsOn(); b.textContent = on ? 'On' : 'Off'; b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.classList.toggle('on', on); }
  function aeToggleHtml() { return '<span class="aetog small">Auto-equip new gear: <button type="button" class="q" data-aetog="1" aria-pressed="false">Off</button> <span class="muted">On: a new piece is worn right away, never a downgrade. Off: it goes to your bag.</span></span>'; }
  function bindAeTogs(root) { (root || document).querySelectorAll('[data-aetog]').forEach(function (b) { paintAeTog(b); b.onclick = function () { setAutoEquip(!autoEquipIsOn()); toast('Auto-equip new gear: ' + (autoEquipIsOn() ? 'On. New pieces are worn right away unless the pet already wears something better.' : 'Off. New pieces go to your bag.') + ' Applies to gear that lands from now on.', 6000); }; }); }
  function wornInSlot(w, pid, slot) { return V.wornOf(w, pid).filter(function (g) { return g.slot === slot; })[0] || null; }
  function gearRank(g) { return g ? (g.legendary ? 4 : (g.tier || 0)) : -1; }
  function autoEquipChoice(w, wins) {
    var by = {}, logB = {}, minB = Infinity, on = autoEquipIsOn();
    (w.log || []).forEach(function (l) { if (l.gid) logB[l.gid] = l.block; });
    wins.forEach(function (x) { var g = w.items[x.gid]; if (!g || g.owner !== ME || g.wonBy != null || x.rolledOn == null || !/^(roll|token|froll|oroll)$/.test(g.src || '')) return; var b = logB[x.gid]; if (b == null) return;
      var k = x.rolledOn + ':' + g.slot; (by[k] = by[k] || { pet: x.rolledOn, slot: g.slot, wins: [] }).wins.push(g); if (b < minB) minB = b; });
    var keys = Object.keys(by).filter(function (k) { var c = wornInSlot(w, by[k].pet, by[k].slot); return c && by[k].wins.indexOf(c) >= 0; }); /* only slots where replay put a new piece on */
    var ops = spoilsChoice(w, wins, keys, on);
    if (!keys.length) return ops.length ? (S.ops = S.ops.concat(ops), save(), ops.length) : 0;
    var E = window.LiveEngine, w0 = V.replay(S.rows.filter(function (r) { return r.block_index < minB; }), S.hashes, (S.ops || []).filter(function (o) { return o.block_index < minB; }), { tip: minB - 1, live: E && E.RealCore });
    keys.forEach(function (k) { var e = by[k], cur = wornInSlot(w, e.pet, e.slot), p0 = wornInSlot(w0, e.pet, e.slot), prev = p0 ? w.items[p0.gid] : null;
      if (prev && (prev.owner !== ME || prev.item !== p0.item || (prev.on != null && prev.on !== e.pet))) prev = null; /* gone, or worn by another pet now: don't move it */
      var want;
      if (!on) want = prev; /* OFF: back to what it wore before (or empty) */
      else { want = cur; [prev].concat(e.wins).forEach(function (g) { if (g && g.owner === ME && (g.on == null || g.on === e.pet) && gearRank(g) > gearRank(want)) want = g; }); }
      if (want === cur) return;
      ops.push({ kind: 'equip', owner: ME, petId: e.pet, slot: e.slot, gid: null, block_index: S.tip });
      if (want) ops.push({ kind: 'equip', owner: ME, petId: e.pet, slot: e.slot, gid: want.gid, block_index: S.tip }); });
    if (!ops.length) return 0; S.ops = S.ops.concat(ops); save(); return ops.length; }
  /* battle spoils: won pieces (g.wonBy = winning pet) per pet+slot; slots already handled by the roll pass above are left alone. Returns ops. */
  function spoilsChoice(w, wins, skip, on) {
    var by = {}, ops = [];
    wins.forEach(function (x) { var g = w.items[x.gid]; if (!g || g.owner !== ME || g.wonBy == null) return; var p = w.byId[g.wonBy]; if (!p || p.owner !== ME || p.dead || p.released) return;
      var k = g.wonBy + ':' + g.slot; if (skip.indexOf(k) >= 0) return; (by[k] = by[k] || { pet: g.wonBy, slot: g.slot, wins: [] }).wins.push(g); });
    Object.keys(by).forEach(function (k) { var e = by[k], cur = wornInSlot(w, e.pet, e.slot);
      if (!on) { if (cur && e.wins.indexOf(cur) >= 0) ops.push({ kind: 'equip', owner: ME, petId: e.pet, slot: e.slot, gid: null, block_index: S.tip }); return; } /* OFF: to the bag */
      var want = cur; e.wins.forEach(function (g) { if (g !== cur && (g.on == null || g.on === e.pet) && gearRank(g) >= gearRank(want)) want = g; }); /* ON: never a downgrade, ties keep the newest */
      if (want && want !== cur) ops.push({ kind: 'equip', owner: ME, petId: e.pet, slot: e.slot, gid: want.gid, block_index: S.tip }); });
    return ops; }
  /* this player's own community gear rolls since the last look (key = burn tx; first look = silent baseline). Display only. */
  function communityWins(w) { var k = WKEY + '-croll', seen = null; try { seen = JSON.parse(localStorage.getItem(k)); } catch (e) { }
    var first = !seen, s = Object.assign({}, seen || {}), out = [];
    ((w.community && w.community.gearLog) || []).forEach(function (g) { if (g.by !== ME || !g.tx || s[g.tx]) return; s[g.tx] = 1; if (first) return;
      out.push({ gid: 'c:' + g.tx, item: g.item, label: g.label, slot: g.slot, slotName: SL(g.slot), tier: g.tier, tierName: g.legendary ? 'Legendary' : (TL[g.tier] || ''), legendary: !!g.legendary, src: 'croll', community: true }); });
    try { localStorage.setItem(k, JSON.stringify(s)); } catch (e) { } return out; }
  /** gear results: where a piece came from, in plain words (no block numbers). Returns { key, long, short }. */
  function winSource(x, w, logBy) { var p = x.rolledOn != null ? w.byId[x.rolledOn] : null, nm = x.rolledOn != null ? '#' + x.rolledOn + (p ? ' ' + p.name : '') : '', g = w.items[x.gid] || {};
    if (x.community) return { key: 'croll', long: 'Your community gear roll', short: 'Community roll' };
    if (g.wonBy != null) { var vs = g.from != null ? ' vs #' + g.from : ''; return { key: 'fight', long: 'Battle win' + vs + ' (won by #' + g.wonBy + ')', short: 'Battle win' + vs, pet: g.wonBy, vs: g.from }; }
    if (x.src === 'roll') return { key: 'roll', long: 'Gear roll you burned for ' + nm, short: 'Gear roll' };
    if (x.src === 'froll') return { key: 'froll', long: 'Founder free roll for ' + nm, short: 'Free roll' };
    if (x.src === 'oroll') return { key: 'oroll', long: 'Overflow roll for ' + nm, short: 'Overflow roll' };
    if (x.src === 'token') { var l = logBy[x.gid] || {}, htx = p ? String(p.hatchTx || '').replace(/:\d+$/, '') : '';
      if (l.tx && htx && l.tx === htx) return { key: 'hatch', long: 'Free bonus roll from hatching ' + nm, short: 'Hatch bonus' };
      if (/meal/.test(l.msg || '')) return { key: 'meal', long: 'Free bonus roll from feeding ' + nm, short: 'Meal bonus' };
      return { key: 'stage', long: 'Free bonus roll: ' + nm + ' grew a stage', short: 'Stage-up bonus' }; }
    if (x.src === 'trophy') return { key: 'trophy', long: 'Rumble trophy', short: 'Trophy' };
    if (x.src === 'live') return { key: 'live', long: 'From the first version of the game', short: 'First game' };
    return { key: 'other', long: 'New piece', short: 'New piece' }; }
  var SRC_PLURAL = { roll: ['gear roll you burned', 'gear rolls you burned'], hatch: ['free bonus roll from hatching', 'free bonus rolls from hatching'], stage: ['free bonus roll from growing a stage', 'free bonus rolls from growing a stage'], meal: ['free bonus roll from a meal', 'free bonus rolls from meals'], froll: ['founder free roll', 'founder free rolls'], oroll: ['overflow roll', 'overflow rolls'], croll: ['community gear roll', 'community gear rolls'], fight: ['battle win', 'battle wins'], trophy: ['trophy', 'trophies'], live: ['piece from the first game', 'pieces from the first game'], other: ['new piece', 'new pieces'] };
  function communityName(w) { return w.community && w.community.returned ? 'the Bitcoin Wizard, the community pet' : 'the community pet'; }
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
    $('packTitle').textContent = gear ? '🎁 ' + (list.length === 1 ? 'You got ' + list[0].label : list.length + ' new gear pieces') : list.length + ' egg' + (list.length > 1 ? 's' : '') + ' to review';
    $('packBox').classList.toggle('gearmode', gear); $('packTitle').setAttribute('data-ico', gear ? 'gear' : 'egg'); if ($('packNote')) $('packNote').hidden = gear; /* the discard note belongs to the egg review only */
    var logBy = {}, info = '', where = { on: 0, bag: 0, comm: 0 };
    if (gear) { (w.log || []).forEach(function (l) { if (l.gid) logBy[l.gid] = l; });
      var srcN = {}, order = [], pets = [], vsIds = [];
      list.forEach(function (x) { x._src = winSource(x, w, logBy); if (!srcN[x._src.key]) { srcN[x._src.key] = 0; order.push(x._src.key); } srcN[x._src.key]++;
        var g = w.items[x.gid], on = x.community ? 'c' : g ? g.on : x.on; x._on = on; if (on === 'c') where.comm++; else if (on != null) where.on++; else where.bag++;
        x._pet = x._src.key === 'fight' ? x._src.pet : x.rolledOn; /* battle spoils belong to the WINNING pet, not the pet the piece was first rolled for */
        if (x._src.key === 'fight' && x._src.vs != null && vsIds.indexOf(x._src.vs) < 0) vsIds.push(x._src.vs);
        if (x._pet != null && pets.indexOf(x._pet) < 0) pets.push(x._pet); });
      var n = list.length, nf = srcN.fight || 0, nr = n - nf, rollTxt = nr === 1 ? 'a gear roll landed' : nr + ' gear rolls landed', fightTxt = nf === 1 ? 'you won gear in battle' : nf + ' pieces won in battles';
      var lead = (rev.away ? 'While you were away, ' : '') + (nf && nr ? rollTxt + ' and ' + (nf === 1 ? '1 piece was won in battle' : fightTxt) : nf ? fightTxt : rollTxt) + '.';
      lead = lead.charAt(0).toUpperCase() + lead.slice(1); if (nf) lead = '⚔️ ' + lead;
      info = '<div class="grinfo small" role="status"><p class="grlead"><b>' + esc(lead) + '</b></p>' +
        '<p>From: ' + order.map(function (k) { var q = SRC_PLURAL[k] || SRC_PLURAL.other; return srcN[k] + ' ' + q[srcN[k] === 1 ? 0 : 1] + (k === 'fight' && vsIds.length ? ' vs ' + vsIds.slice(0, 6).map(function (id) { return '#' + id; }).join(', ') + (vsIds.length > 6 ? ' and ' + (vsIds.length - 6) + ' more' : '') : ''); }).map(esc).join(' · ') + '</p>' +
        (pets.length ? '<p>Pets: ' + pets.slice(0, 6).map(function (id) { var q = w.byId[id]; return '#' + id + (q ? ' ' + esc(q.name) : ''); }).join(', ') + (pets.length > 6 ? ' and ' + (pets.length - 6) + ' more' : '') + '</p>' : '') +
        '<p>Where they went: ' + [where.on ? where.on + ' equipped' : '', where.bag ? where.bag + ' in your bag' : '', where.comm ? where.comm + ' equipped on ' + esc(communityName(w)) : ''].filter(Boolean).join(' · ') + '</p>' +
        '<p class="grnext">' + (where.bag ? '👉 New gear is in your bag. Equip it from Inventory (free).' : '👉 See all your gear in Inventory.') + '</p>' +
        '<p class="graemode">' + aeToggleHtml() + '</p></div>' +
        (UXB_CAP(list) ? '<p class="grcap" aria-hidden="true">' + esc(UXB_CAP(list)) + '</p>' : ''); }
    $('packSummary').innerHTML = info + '<span class="grtiers">' + esc(TIERS.map(function (t, i) { return gear && !tiers[i] ? '' : tiers[i] + ' ' + t.label; }).filter(Boolean).join(' · ')) + '</span>' + (gear ? '' : ' · ' + Object.keys(rev.sel).length + ' ticked') +
      (pages > 1 ? ' <span class="pager"><button class="q" type="button" id="pkPrev"' + (rev.page ? '' : ' disabled') + '>‹ Prev</button> page ' + (rev.page + 1) + '/' + pages + ' <button class="q" type="button" id="pkNext"' + (rev.page < pages - 1 ? '' : ' disabled') + '>Next ›</button></span>' : '');
    bindAeTogs($('packSummary'));
    if ($('pkPrev')) { $('pkPrev').onclick = function () { rev.page--; drawReveal(); }; $('pkNext').onclick = function () { rev.page++; drawReveal(); }; }
    var grid = $('packGrid'); grid.innerHTML = '';
    list.slice(rev.page * REV_PAGE, rev.page * REV_PAGE + REV_PAGE).forEach(function (x) {
      var d = document.createElement('div');
      if (gear) { d.className = 'egg gearwin t' + (x.legendary ? 3 : x.tier) + ' ux-flash ux-t' + (x.legendary ? 3 : x.tier || 0) + (x.legendary ? ' ux-fanfare' : ''); d.title = x._src.long; d.innerHTML = '<span class="ic"></span><div class="gwname"><b>' + esc(x.label) + '</b></div><div>' + esc(x.tierName) + (x.legendary ? ' ★' : '') + ' · ' + esc(x.slotName) + '</div><div class="muted gwsrc">' + esc(x._src.short) + (x._pet != null ? ' · pet #' + x._pet : '') + '</div>' +
          '<div class="gwwhere">' + (x._on === 'c' ? '✓ On the community pet' : x._on != null ? '✓ Equipped on #' + x._on : '🎒 In your bag') + '</div>';
        d.querySelector('.ic').appendChild(V2Render.iconCanvas(x.item, 'gicon')); grid.appendChild(d); if (window.UXB) UXB.revealCard(d, x, w); return; }
      d.className = 'egg t' + x.art.tierIndex + (rev.sel[x.id] ? ' discard' : ''); d.innerHTML = '<canvas width="32" height="32"></canvas><div>#' + x.id + ' ' + esc(TIERS[x.art.tierIndex].label) + '</div><div class="muted">' + esc(x.species) + '</div>' + (x.parents && R.bredFrom ? '<div class="small">' + R.bredFrom(w, x, false) + '</div>' : '') + '<label class="small disc"><input type="checkbox" data-id="' + x.id + '"' + (rev.sel[x.id] ? ' checked' : '') + '> Discard</label>';
      grid.appendChild(d); var c = d.querySelector('canvas'), fr = petFrames(x, w); paint(c, fr[0]); R.animate(c, fr);
      d.querySelector('input').onchange = function () { if (this.checked) rev.sel[x.id] = 1; else delete rev.sel[x.id]; d.classList.toggle('discard', this.checked); };
    });
    ['packCommons', 'packDiscard', 'packSkip'].forEach(function (id) { $(id).style.display = gear ? 'none' : ''; }); $('packClose').textContent = gear ? (where.bag ? 'Equip in Inventory →' : 'Go to Inventory →') : 'Keep the rest → My Pets';
  }
  function hideIds(ids) { discardIds(ids); }
  /* ONE caption per gear batch, for the best piece (the per-card captions overlapped the cards). Lives here, not in ux-batch.js, because the popup can open
   * on the first render, before ux-batch.js has loaded. */
  var GEAR_CAPS = [['gm. it\'s something.', 'ser, this is a Common.', 'it\'s honest work.'], ['not bad, anon.', 'a little drip never hurt.', 'up only (slightly).'], ['wen moon? now.', 'rare drip acquired.', 'number go up.'], ['MUCH WOW. VERY RARE.', 'GIGABRAIN DROP.', 'WAGMI. legendary pull.']];
  function UXB_CAP(list) { var best = null; list.forEach(function (x) { var t = x.legendary ? 3 : x.tier || 0; if (!best || t > best.t) best = { t: t, x: x }; });
    return best ? GEAR_CAPS[best.t][(String(best.x.gid || best.x.item).length + best.t) % 3] : ''; }
  function closeReveal() { var toInv = rev && rev.kind === 'gear'; close('packBox'); rev = null; render(); setTimeout(nextReveal, 250);
    if (toInv && $('invPanel')) setTimeout(function () { if (!$('packBox').classList.contains('on')) try { $('invPanel').scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { } }, 300); }
  /* pet total near the hatch buttons (2026-10-19, display only): every pet in the replayed world (w.pets.length, same as the top 'pets hatched'),
   * incl. dead, released and bred pets. Shows '…' until every burn's block hash is known, so an incomplete replay never shows a wrong number. */
  var ptLast = null, ptT = null;
  function petTotal(w) { var el = $('petTotal'); if (!el) return;
    var miss = (S.rows || []).some(function (r) { return !(S.hashes || {})[r.block_index]; });
    if (miss) { $('ptN').textContent = '…'; $('ptAlive').textContent = '· syncing'; ptLast = null; return; }
    var n = w.pets.length, alive = w.pets.filter(function (p) { return !p.dead && !p.released; }).length;
    $('ptN').textContent = fmt(n); $('ptAlive').textContent = '· ' + fmt(alive) + ' alive';
    if (ptLast != null && n > ptLast) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); clearTimeout(ptT); ptT = setTimeout(function () { el.classList.remove('bump'); }, 1600); }
    ptLast = n; }
  function render() {
    var w = world(), c = w.community; notifyHatch(w); notifyWins(w); setTimeout(nextReveal, 0);
    $('bal').textContent = fmt(S.balance); V2Wallet.paint(ME, $);
    $('cBurned').textContent = fmt(c.burned); $('cGame').textContent = fmt(S.rows.length); $('cPets').textContent = fmt(w.pets.length);
    petTotal(w);
    // community pet (Jake 2026-10-14): Nakamoto at Mythic until The Return (1,111,111 burned in total), then the next community pet (same .commsprite slot as live)
    var wiz = !!c.returned, fr;
    fr = R.communityFrames(w); /* community gear roll: the community pet (Bitcoin Wizard, or Nakamoto before) wears its community-roll gear (display only) */
    if (!commAnim) { var cv = document.createElement('canvas'); cv.width = cv.height = 32; cv.className = 'commsprite'; $('community').parentNode.insertBefore(cv, $('community')); commAnim = { c: cv }; }
    R.animate(commAnim.c, fr); commAnim.fr = fr;
    var T = V.WIZARD_THRESHOLDS, nx = wiz && c.wizardStage < 5 ? T[c.wizardStage + 1] : null, rp = V.returnProgress(c.burned);
    $('community').innerHTML = '<b>' + esc(c.petName) + '</b>' + (c.petRole && c.petName !== 'Nakamoto' ? ' · ' + esc(c.petRole) : '') + ' · ' + c.petStageName + ' · ' + fmt(Math.floor(c.burned)) + ' <span class="asset">XCPETS</span> burned' +
      '<div class="small muted" id="cWearing">' + esc(R.communityWearing ? R.communityWearing(w) : 'Gear: ' + R.communityGearText(w)) + '</div>';
    /* home-page community readout on play (same numbers as index: V2Render.communityStats) */
    if (R.communityStats) { var cs = R.communityStats(w, (V2Mock.state().rows || []).length), F = function (n) { return fmt(n); };
      $('community').insertAdjacentHTML('beforeend', '<div class="sharedwrap cstats"><div class="stats"><div><span>Stage</span><b id="pcStage">' + esc(cs.stage) + '</b></div><div><span>Fed to the community pet</span><b id="pcFed">' + F(cs.fed) + '</b></div><div><span>Next stage</span><b id="pcNext">' + (cs.next != null ? F(cs.next) + ' to ' + esc(cs.nextName) : 'Mythic reached') + '</b></div></div>' +
        '<div class="progress"><div id="pcProg" style="width:' + cs.pct.toFixed(1) + '%"></div></div><div class="stats"><div><span>Burns</span><b id="pcBurns">' + F(cs.burns) + '</b></div><div><span>Pets hatched</span><b id="pcPets">' + F(cs.pets) + '</b></div></div></div>'); }
    var crOn = V.crollOn(S.tip); $('crollBtn').textContent = 'Community gear roll (' + fmt(V.COSTS.croll) + ')'; $('crollBtn').disabled = !crOn;
    if (!crOn) $('community').insertAdjacentHTML('beforeend', '<div class="small muted" id="crollNote">Community gear roll switches on at block ' + fmt(V.ACTIVATE_CROLL_BLOCK) + '.</div>');
    $('crollBtn').title = crOn ? 'Burn ' + fmt(V.COSTS.croll) + ' XCPETS: the community pet gets one random gear piece and wears it right away (a new piece replaces the old one in that slot)' : 'Community gear roll switches on at block ' + fmt(V.ACTIVATE_CROLL_BLOCK);
    $('goalBar').style.width = (rp.pct * 100).toFixed(2) + '%';
    $('goalTxt').innerHTML = wiz ? '<b>' + fmt(Math.floor(c.burned)) + '</b> <span class="asset">XCPETS</span> burned' : '<b>' + fmt(Math.floor(rp.count)) + '</b> / ' + fmt(V.COMMUNITY_GOAL) + ' <span class="asset">XCPETS</span> burned (' + (rp.pct * 100).toFixed(1) + '%)'; /* Cold Storage bar: no Return wording (Jake 2026-10-14) */
    $('lb').innerHTML = c.leaderboard.slice(0, 8).map(function (x) { return '<li' + (x.address === ME ? ' class="me"' : '') + '>' + esc(x.address) + ' · ' + fmt(x.amount) + '</li>'; }).join('');
    var amt = Math.floor(Number($('cAmt').value) || 0); $('cfeedBtn').textContent = 'Feed community (' + fmt(Math.max(amt, 0)) + ')';
    renderPets(w); renderInv(w); renderBattles(w); notifyFights(w); notifyBreeds(w); renderBreed(w); renderLog(w); try { inReqPopup(w); } catch (e) { if (window.console) console.error(e); } if (window.UXB) { try { UXB.after(w); } catch (e) { if (window.console) console.error(e); } }
    if (detailId && $('detail').classList.contains('on')) detail(w.byId[detailId], w);
    offerResume();
  }
  // ---------------------------------------------------------------- My Pets (live card markup + checkbox)
  /* hotfix 3: the filtered + sorted pet list (shared by renderPets and the sort-only reorder) */
  function petList(alive, dead) { var fT = $('fTier').value, fS = $('fSort').value, hide = Number($('fHide').value), X = window.UXB ? UXB.filters() : null;
    var list = (cem ? dead : V.hideAtOrBelow(alive, hide)).filter(function (p) { return cem || fT === 'all' || TIER_ID[p.tier] === fT; }).slice().reverse();
    if (X) list = list.filter(function (p) { return X.keep(p); }); /* ux-batch: minimum rarity, origin, search (display only) */
    if (fS === 'num') list.sort(function (a, b) { return a.id - b.id; });
    if (fS === 'tier') list.sort(function (a, b) { return b.tier - a.tier || b.id - a.id; }); if (fS === 'power' && window.UXB && UXB.power) list.sort(function (a, b) { return UXB.power(b) - UXB.power(a) || a.id - b.id; }); if (fS === 'stage') list.sort(function (a, b) { return b.stage - a.stage || b.care - a.care || b.id - a.id; });
    if (X && X.flip) list.reverse();
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
      var ct = R.careTarget(w, p, S.tip), /* the engine's per-pet thresholds (Mythic discount), shared with the detail panel and pet page */ fed = p.dead ? '🪦 Died of neglect' : p.fedToday ? 'Fed today: ✓' : p.nextMeal ? 'Hungry · meal ' + fmt(p.nextMeal) : 'Full';
      d.innerHTML = (p.dead ? '' : '<input type="checkbox" class="pick-cb" aria-label="Select #' + p.id + '"' + (on ? ' checked' : '') + '>') + '<canvas class="sprite" width="32" height="32"></canvas><h4>' + keepBtn(p.id) + esc(p.name) + ' <span class="muted">#' + p.id + '</span>' + (p.blackEye ? ' 🤕' : '') + (p.crowned ? ' 👑' : '') + '</h4><div class="chips">' +
        '<span class="chip">' + esc(spLabel(p.species)) + '</span>' + tierPill(p.tier) + '<span class="chip stg">' + p.stageName + '</span><span class="chip' + (p.hungry ? ' warn' : '') + '">' + fed + '</span>' +
        '<span class="chip gearchip">🎒 ' + R.worn(w, p.id).length + '/' + p.capacity + ' slots</span>' + (window.UXB && UXB.power ? '<span class="chip pow" title="Power = Vigor + Spark + Grit + Zoom + Luck">⚡ ' + UXB.power(p) + '</span>' : '') + (window.UXB ? UXB.origin(p, w) : '') + (p.neglected && !p.dead ? '<span class="chip warn">neglected</span>' : '') + '</div>' +
        '<div class="bar"><i style="width:' + ct.pct.toFixed(1) + '%"></i></div><div class="small muted">care ' + fmt(p.care) + ' / ' + fmt(ct.mythic) + (ct.discount ? ' <span title="Your Mythic discount: you own a Mythic, so all your pets reach Mythic at ' + fmt(ct.mythic) + ' care">(Mythic discount)</span>' : '') + '</div>';
      var cb = d.querySelector('.pick-cb'); if (cb) cb.onclick = function (e) { e.stopPropagation(); if (window.UXB) UXB.cardTap(p.id, e); else toggle(p.id); };
      d.querySelector('.keepbtn').onclick = function (e) { e.stopPropagation(); e.preventDefault(); toggleKeep(p.id); };
      if (!p.dead && window.UXB) { d.insertAdjacentHTML('beforeend', '<button type="button" class="q openbtn" aria-label="Open #' + p.id + '">Open ▸</button>');
        d.onclick = function (e) { if (e.target.closest('a')) return; /* build fix: card opens detail again; shift-click or Select mode selects */ if (!e.target.closest('.openbtn') && (e.shiftKey || document.body.classList.contains('selmode'))) return UXB.cardTap(p.id, e); detailId = p.id; detail(p, w); }; }
      else d.onclick = function () { detailId = p.id; detail(p, w); };
      return d; }
    function put(ps, before) { var f = document.createDocumentFragment(), ds = ps.map(function (p) { var d = mk(p); f.appendChild(d); return [d, p]; }); if (before) box.insertBefore(f, before); else box.appendChild(f);
      ds.forEach(function (x) { R.lazy(x[0].querySelector('canvas'), function () { return petFrames(x[1], w); }); }); }
    put(list.slice(0, CH)); box.appendChild(tail);
    (function more(i) { if (i >= list.length) return; setTimeout(function () { if (renderPets.tok !== tok || !tail.parentNode) return; put(list.slice(i, i + CH), tail); more(i + CH); }, 0); })(CH);
    var gone = w.pets.filter(function (p) { return p.owner === ME && !p.released && hiddenIds().indexOf(p.id) >= 0 && !!p.dead === !!cem; });
    if (gone.length) box.appendChild(discardedBox(gone, w));
    $('petPager').textContent = list.length + ' of ' + (cem ? dead.length : alive.length) + ' pets';
  }
  /* Discarded list (build 2, 2026-10-16): small cards (lazy sprite, tier, species, stage, Restore) with sort, tier filter, search and
   * checkboxes for 'Restore selected' / 'Restore all'. Alive tab = discarded living pets, Graveyard tab = discarded dead pets. Browser-only. */
  var DS = { open: false, flip: false, sort: 'new', tier: 'all', q: '', sel: {}, n: 120 };
  function discardedBox(gone, w) {
    var hb = document.createElement('div'); hb.className = 'hiddenbox';
    var q = DS.q.trim().toLowerCase(), list = gone.filter(function (p) { return (DS.tier === 'all' || TIER_ID[p.tier] === DS.tier) && (!q || ('#' + p.id + ' ' + (p.name || '') + ' ' + spLabel(p.species)).toLowerCase().indexOf(q) >= 0); });
    if (DS.sort === 'new') list.sort(function (a, b) { return b.id - a.id; }); if (DS.sort === 'num') list.sort(function (a, b) { return a.id - b.id; });
    if (DS.sort === 'tier') list.sort(function (a, b) { return b.tier - a.tier || b.id - a.id; }); if (DS.sort === 'stage') list.sort(function (a, b) { return b.stage - a.stage || b.care - a.care || b.id - a.id; });
    var pw = function (p) { return window.UXB && UXB.power ? UXB.power(p) : 0; }; if (DS.sort === 'power') list.sort(function (a, b) { return pw(b) - pw(a) || a.id - b.id; }); if (DS.flip) list.reverse(); /* Power sort + reverse (discarded section) */
    Object.keys(DS.sel).forEach(function (k) { if (!gone.some(function (p) { return String(p.id) === k; })) delete DS.sel[k]; });
    var nsel = Object.keys(DS.sel).length, shown = list.slice(0, DS.n);
    hb.innerHTML = '<details' + (DS.open ? ' open' : '') + '><summary>Show discarded (' + gone.length + ')</summary><p class="small muted">Pets you hid in this browser. They still exist on-chain (others and other devices see them).</p>' +
      '<div class="row small dctl"><label>Sort <select data-ds="sort"><option value="new">Newest</option><option value="num">Pet number</option><option value="tier">Rarity</option><option value="stage">Stage</option><option value="power">Power</option></select></label> <button type="button" class="q" data-dsa="dir" aria-label="Reverse sort order" title="Reverse order">' + (DS.flip ? '🔽' : '🔼') + '</button> ' +
      '<label>Tier <select data-ds="tier"><option value="all">All</option>' + TIER_ID.map(function (t, k) { return '<option value="' + t + '">' + TL[k] + '</option>'; }).join('') + '</select></label> ' +
      '<label>Search <input type="search" data-ds="q" placeholder="#id, name, species" value="' + esc(DS.q) + '"></label> ' +
      '<button type="button" class="q" data-dsa="sel"' + (nsel ? '' : ' disabled') + '>Restore selected' + (nsel ? ' (' + nsel + ')' : '') + '</button> <button type="button" class="q" data-dsa="all">Restore all (' + gone.length + ')</button></div>' +
      '<div class="dgrid">' + (shown.length ? shown.map(function (p) { return '<div class="dcard" data-did="' + p.id + '"><input type="checkbox" class="dcb" aria-label="Select #' + p.id + '"' + (DS.sel[p.id] ? ' checked' : '') + '><canvas class="sprite" width="32" height="32"></canvas><div class="small"><b>' + esc(p.name || spLabel(p.species)) + '</b> <span class="muted">#' + p.id + '</span></div><div class="chips">' + tierPill(p.tier) + '<span class="chip">' + esc(spLabel(p.species)) + '</span><span class="chip stg">' + (p.dead ? '🪦 ' : '') + p.stageName + '</span>' + (window.UXB && UXB.power ? '<span class="chip pow" title="Power = Vigor + Spark + Grit + Zoom + Luck">⚡ ' + UXB.power(p) + '</span>' : '') + '</div><button type="button" class="q" data-restore="' + p.id + '">Restore</button></div>'; }).join('') : '<p class="muted small">No discarded pets match.</p>') + '</div>' +
      (list.length > shown.length ? '<p><button type="button" class="q" data-dsa="more">Show more (' + (list.length - shown.length) + ' left)</button></p>' : '') + '</details>';
    hb.querySelector('details').ontoggle = function () { DS.open = this.open; };
    hb.querySelector('[data-ds="sort"]').value = DS.sort; hb.querySelector('[data-ds="tier"]').value = DS.tier;
    hb.querySelectorAll('select[data-ds]').forEach(function (x) { x.onchange = function () { DS[x.dataset.ds] = x.value; render(); }; });
    var si = hb.querySelector('[data-ds="q"]'), st = null; si.oninput = function () { clearTimeout(st); st = setTimeout(function () { DS.q = si.value; render(); var n = document.querySelector('.hiddenbox [data-ds="q"]'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 250); };
    hb.querySelectorAll('.dcb').forEach(function (c) { c.onchange = function () { var id = c.closest('.dcard').dataset.did; if (c.checked) DS.sel[id] = 1; else delete DS.sel[id]; var b = hb.querySelector('[data-dsa="sel"]'), n = Object.keys(DS.sel).length; b.disabled = !n; b.textContent = 'Restore selected' + (n ? ' (' + n + ')' : ''); }; });
    hb.querySelectorAll('[data-restore]').forEach(function (a) { a.onclick = function (e) { e.preventDefault(); var id = Number(a.getAttribute('data-restore')); delete DS.sel[id]; restoreLocal([id]); }; });
    hb.querySelectorAll('[data-dsa]').forEach(function (b) { b.onclick = function () { var a = b.dataset.dsa; if (a === 'dir') { DS.flip = !DS.flip; return render(); } if (a === 'more') { DS.n += 120; return render(); }
      var ids = a === 'all' ? gone.map(function (p) { return p.id; }) : Object.keys(DS.sel).map(Number); if (!ids.length) return;
      if (a === 'all' && ids.length > 1 && !window.confirm('Restore all ' + ids.length + ' discarded pets on this tab?')) return; DS.sel = {}; restoreLocal(ids); }; });
    hb.querySelectorAll('.dcard').forEach(function (d) { var p = w.byId[d.dataset.did]; if (p) R.lazy(d.querySelector('canvas'), function () { return petFrames(p, w); }); });
    return hb; }
  /* hotfix 2: a selection change only updates that card + the count (no full render / replay) */
  function selUi() { var w = world(), alive = mine(w).filter(function (p) { return !p.dead; }), cards = document.querySelectorAll('#pets .pet.card[data-pid]');
    $('selCount').textContent = S.sel.length + ' selected · ' + alive.filter(function (p) { return p.hungry; }).length + ' hungry';
    var all = cards.length > 0; cards.forEach(function (d) { var on = S.sel.indexOf(Number(d.dataset.pid)) >= 0; d.classList.toggle('selected', on); var cb = d.querySelector('.pick-cb'); if (cb) cb.checked = on; if (!on) all = false; }); $('selAll').checked = all; if (window.UXB) UXB.sel(); }
  function toggle(id) { var i = S.sel.indexOf(id); if (i >= 0) S.sel.splice(i, 1); else S.sel.push(id); save(); selUi(); }
  $('tabAlive').onclick = function () { cem = false; this.classList.add('on'); $('tabCem').classList.remove('on'); render(); };
  $('tabCem').onclick = function () { cem = true; this.classList.add('on'); $('tabAlive').classList.remove('on'); render(); };
  ['fTier', 'fSort', 'fHide'].forEach(function (id) { $(id).onchange = function () { S['ui_' + id] = this.value; save(); if (id === 'fSort' && resort()) return; render(); }; if (S['ui_' + id] != null) $(id).value = S['ui_' + id]; });
  $('selAll').onchange = function () { var w = world(), hide = Number($('fHide').value), fT = $('fTier').value;
    var shown = V.hideAtOrBelow(mine(w).filter(function (p) { return !p.dead; }), hide).filter(function (p) { return fT === 'all' || TIER_ID[p.tier] === fT; });
    S.sel = this.checked ? shown.map(function (p) { return p.id; }) : []; save(); selUi(); };
  if ($('selMode')) $('selMode').onclick = function () { var on = document.body.classList.toggle('selmode'); this.classList.toggle('on', on); this.setAttribute('aria-pressed', on ? 'true' : 'false'); toast(on ? 'Select mode on: tap cards to select' : 'Select mode off: tap a card to open it'); };
  $('selNone').onclick = function () { S.sel = []; save(); selUi(); toast('Selection cleared'); };
  /* Feed all hungry / Feed selected NEVER include a discarded pet: filtered by the discard set itself (hiddenIds), not by what is on screen,
   * so 'Show discarded', a stale selection or an active filter can't leak one in. */
  function noDiscarded(plans) { var h = hiddenIds(); return plans.filter(function (q) { return h.indexOf(q.petId) < 0; }); }
  $('bFeedHungry').onclick = function () { var w = world(), h = hiddenIds(); confirmPlans('Feed all hungry pets', noDiscarded(V.feedQueue(w, ME, w.pets.filter(function (p) { return p.owner === ME && h.indexOf(p.id) < 0; }).map(function (p) { return p.id; })))); };
  $('bFeedSel').onclick = function () { var h = hiddenIds(); confirmPlans('Feed selected pets', noDiscarded(V.feedQueue(world(), ME, sel().filter(function (id) { return h.indexOf(id) < 0; })))); };
  $('bRoll').onclick = function () { confirmPlans('Gear-roll queue', V.rollQueue(world(), ME, sel(), Number($('rollN').value) || 1)); };
  if ($('bRelease')) $('bRelease').onclick = function () { if (!S.sel.length) return toast('Select pets first'); confirmPlans('Release ' + S.sel.length + ' pets (max ' + V.MAX_RELEASE_PER_BURN + ' per burn)', V.releaseBatches(sel())); };
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
  /* family-tree-fix (2026-10-19): the root also lists its own children (V2Render's chart replaces this ul.tree with ancestors above + children below). */
  function tree(t, kids) { if (!t) return ''; var w0 = kids && world(), ch = kids && w0 ? (t.children || []).map(function (id) { return w0.byId[id]; }).filter(Boolean) : [];
    return '<ul class="tree"><li>#' + t.id + ' ' + esc(t.name) + ' <span class="muted">' + spLabel(t.species) + ' · ' + TL[t.tier] + '</span>' + t.parents.map(function (x) { return tree(x); }).join('') +
      (ch.length ? '<ul class="treekids">' + ch.map(function (c) { return '<li>child #' + c.id + ' ' + esc(c.name) + '</li>'; }).join('') + '</ul>' : '') + '</li></ul>'; }
  function detail(p, w) {
    if (!p) return; w = w || world(); $('dTitle').innerHTML = (p.owner === ME ? keepBtn(p.id) : '') + esc(p.name) + ' <span class="muted">#' + p.id + '</span> ' + tierPill(p.tier);
    var kb = $('dTitle').querySelector('.keepbtn'); if (kb) kb.onclick = function (e) { e.preventDefault(); toggleKeep(p.id); };
    var frs = petFrames(p, w); paint($('dCanvas'), frs[0]); R.animate($('dCanvas'), frs);
    $('dStats').innerHTML = statBars(p);
    var inv = w.itemList.filter(function (g) { return g.owner === ME && g.on == null; }), legAll = V.legendaryOf(p.species), leg = legAll[0];
    var h = '<a class="btn openpet" id="dOpenPet" href="pet.html?id=' + p.id + '">Open pet page →</a>' + (R.bredFrom ? '<div class="chips dbred">' + R.bredFrom(w, p, true) + '</div>' : '') + '<p>' + esc(spLabel(p.species)) + ' · ' + p.stageName + ' · care ' + fmt(p.care) + ' / ' + fmt(R.careTarget(w, p, S.tip).mythic) + (R.careTarget(w, p, S.tip).discount ? ' (Mythic discount)' : '') + (p.species === 'nakamoto' && !V.nakaNormal(S.tip) ? ' (Nakamoto: 10× thresholds until block ' + fmt(V.ACTIVATE_NAKA_NORMAL_BLOCK) + ', then normal growth)' : '') + ' · W' + (p.wins || 0) + '/L' + (p.losses || 0) + '</p>';
    if (!p.dead) h += '<div class="row"><button class="btn ico-flame" data-a="feed"' + (p.hungry ? '' : ' disabled') + '>Feed (' + fmt(p.nextMeal) + ')</button><button class="btn ghost ico-flame" data-a="roll" title="Burn ' + fmt(V.COSTS.roll) + ' XCPETS for one random gear piece for this pet">🎲 Roll for gear (' + fmt(V.COSTS.roll) + ')</button>' + frBtn(w) + ofBtn(w, p) + '<button class="act ghost" id="dDiscard" title="Hides it in this browser. Free; restore any time from Show discarded.">🗑️ Discard pet</button></div>' +
      (p.owner === ME ? rollHelp(p) : '');
    h += '<h3 class="sec" data-ico="gear">Gear <span class="small muted gcount">' + V.wornOf(w, p.id).length + '/' + p.capacity + '</span></h3><div class="gpicker" id="gPicker"></div>' + (window.UXB && !p.dead ? UXB.petOdds(p, w) : ''); // pop-up cleanup 2026-10-14: no long capacity/signature/how-to text
    h += '<h3 class="sec" data-ico="egg">Born traits</h3><table class="small borntraits">' + V.bornTraits(p, p.stage).map(function (r) { return '<tr><td class="muted">' + esc(r[0]) + '</td><td>' + (r[0] === 'Background colour' ? '<span style="display:inline-block;width:10px;height:10px;border:1px solid #000;background:' + esc(r[1]) + '"></span> ' : '') + esc(r[1]) + '</td></tr>'; }).join('') + '</table>';
    h += '<h3 class="sec" data-ico="egg">Family tree</h3>' + tree(V.familyTree(w, p.id), true) + R.familyHtml(w, p, S.tip) + '';
    var keepOpen = $('gPicker') ? $('gPicker').getAttribute('data-open') : null, keepY = $('detail').querySelector('.box') ? $('detail').querySelector('.box').scrollTop : 0;
    $('dInfo').innerHTML = h;
    $('dInfo').querySelectorAll('.dbred [data-jump]').forEach(function (a) { a.onclick = function (e) { var q = w.byId[a.getAttribute('data-jump')]; if (!q) return; e.preventDefault(); detailId = q.id; detail(q, w); }; });
    if (keepOpen && detail.lastId === p.id) $('gPicker').setAttribute('data-open', keepOpen); detail.lastId = p.id;
    R.gearPicker($('gPicker'), { compact: true, world: w, owner: ME, pet: p, msg: detail.msg, onEquip: function (op, m) { op.block_index = S.tip; S.ops.push(op); save(); detail.msg = '✓ ' + m; render(); detail.msg = null; toast(esc(m) + ' (free)'); },
      onEquipMany: function (ops, m) { ops.forEach(function (op) { op.block_index = S.tip; S.ops.push(op); }); save(); detail.msg = '✓ ' + m; render(); detail.msg = null; toast(esc(m) + ' (free)'); } });
    $('detail').querySelector('.box').scrollTop = keepY;
    if ($('dDiscard')) $('dDiscard').onclick = function () { var id = p.id; if (isKept(id) && !window.confirm('#' + id + ' is starred as kept. Discard it anyway?')) return; close('detail'); discardIds([id]); };
    $('dInfo').querySelectorAll('button[data-a]').forEach(function (b) { b.onclick = function () { var a = b.dataset.a; if (a === 'froll') return confirmPlans('Free roll #' + p.id, [V.freeRollPlan(p.id)]); if (a === 'oroll') return confirmPlans('Overflow roll #' + p.id, [V.overflowRollPlan(p.id)]); confirmPlans(a === 'feed' ? 'Feed #' + p.id : 'Gear roll #' + p.id, a === 'feed' ? V.feedQueue(world(), ME, [p.id]) : V.rollQueue(world(), ME, [p.id], 1)); }; });
    open('detail');
  }
  /* founder free rolls (prototype 2026-10-15): pet:fr:ID button + "Free rolls left: N" (minus our unconfirmed pet:fr burns); hidden at 0, non-founders, before activation */
  function frPendingTags() { var T = window.V2Wallet && V2Wallet.tracker ? V2Wallet.tracker.list() : []; return T.filter(function (t) { return !S.rows.some(function (x) { return x.tx_hash === t.txid; }); }).map(function (t) { return t.tag; }); }
  /* Mythic discount overflow rolls: one gear roll per full 1,000 care above 21,000; claimed with a 1-sat pet:of:ID burn (same style as the founder Free roll) */
  function ofBtn(w, p) { var f = V.overflowRolls ? V.overflowRolls(w, p, frPendingTags()) : null; return f && f.on ? freeRollButton('oroll', 'Mythic discount', 'Overflow roll', f.left) : ''; }
  /** one free-roll button + its "left" counter (founder Free roll and Mythic-discount Overflow roll share the same markup) */
  function freeRollButton(action, why, label, left) { return '<button class="btn ghost ico-flame" data-a="' + action + '" title="' + why + ': one random gear piece for this pet. You only burn 1 sat of XCPETS">' + label + '</button><span class="small muted frleft">' + label + 's left: ' + fmt(left) + '</span>'; }
  /** the plain "what a roll gives" line under the pet's roll button, plus a pending line while this pet's roll burns wait to confirm */
  function rollHelp(p) { var n = window.UXB && UXB.pendingFor ? UXB.pendingFor(p.id) : 0, bag = !autoEquipIsOn();
    return '<p class="small muted grhelp">🎲 Roll for gear: burn ' + fmt(V.COSTS.roll) + ' XCPETS for one random piece for this pet. ' + (bag ? 'It goes to your bag (Auto-equip is off); equip it free.' : 'Auto-equip is on: it is worn right away unless the pet already wears something better.') + '</p>' +
      (n ? '<p class="small grpending" role="status">🎁 Gear on the way' + (n > 1 ? ' (' + n + ' rolls)' : '') + ': it arrives once your burn confirms, usually in about 10 minutes.</p>' : ''); }
  function frBtn(w) { var f = V.freeRolls(w, ME, frPendingTags()); return f.on ? freeRollButton('froll', 'Founder reward', 'Free roll', f.left) : ''; }
  $('dClose').onclick = function () { close('detail'); detailId = null; };

  // ---------------------------------------------------------------- inventory (live invcards)
  var invView = S.ui_inv || 'mine', invSlot = S.ui_invSlot || 'all';
  function renderInv(w) {
    var items = w.itemList.filter(function (g) { return g.owner === ME; }), box = $('inv'); $('invCount').textContent = items.filter(function (g) { return g.on == null; }).length;
    $('tokens').textContent = String(V.tokensOf(w, ME)); // roll tokens this wallet's pets found (each already became a free gear item)
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

  // ---------------------------------------------------------------- confirm (live #confirmBox) + per-burn XCP Wallet signing with progress
  var pendingPlans = null, pendingAfter = null;
  function confirmPlans(title, plans, after) {
    if (!ME) { /* no wallet (2026-10-16): say so and open the connect prompt instead of silently doing nothing */ toast('🔌 Connect XCP Wallet first: every action is a burn signed in your wallet. Opening the connect prompt…'); var wc = $('wconnect'); if (wc) { try { wc.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { } wc.click(); } return; }
    var bw = world(), skip = []; plans = plans.filter(function (p) { var m = V.battleBlock(bw, p.tag, S.tip); if (m) skip.push(m); return !m; }); /* battle cap (2026-10-14) */
    if (skip.length) { toast(skip.length === 1 ? skip[0] : 'Skipped ' + skip.length + ' battles: ' + skip.join(' · ')); window.V2LastBlocked = skip; }
    var fg = feedGuard(bw, plans); plans = fg.plans;
    if (!plans.length) { if (fg.skipped.length) toast('🍽️ Feed not sent: ' + fg.text); else if (!skip.length) toast('Nothing to do'); return; }
    var s = V.burnSummary(plans); pendingPlans = plans; pendingAfter = after;
    $('cfTitle').textContent = title;
    $('cfBody').innerHTML = '<div class="bigamt">' + fmt(s.total) + ' XCPETS</div><p class="small">' + s.burns + ' burn' + (s.burns > 1 ? 's' : '') + ', each signed separately · network fees ~' + fmt(s.feeSats) + ' sats (' + s.feeBtc.toFixed(8) + ' BTC, estimate; XCP Wallet shows the real fee) · balance after ' + fmt(S.balance - s.total) + '</p>' +
      '<div class="logbox small">' + plans.slice(0, 12).map(function (p) { return '<div><code>' + esc(p.tag) + '</code> · ' + fmt(p.amount) + '</div>'; }).join('') + (plans.length > 12 ? '<div>… +' + (plans.length - 12) + ' more</div>' : '') + '</div>' +
      (fg.skipped.length ? '<p class="small warn">🍽️ Skipped ' + fg.skipped.length + ' pet' + (fg.skipped.length > 1 ? 's' : '') + ' that would gain nothing from a meal: ' + esc(fg.text) + '</p>' : '') +
      (window.UXB ? UXB.confirmExtra(plans, bw) : '') + '<div class="bar"><i id="pg" style="width:0"></i></div><div class="small" id="pgt"></div>';
    $('cfYes').textContent = 'Sign & burn in XCP Wallet'; $('cfYes').disabled = false; $('cfNo').disabled = false; open('confirmBox');
  }
  /* Overfeed guard (build 2, 2026-10-16, UI only; rules unchanged): before a feed / bundled feed is signed, drop pets the engine says gain nothing
   * (dead, Mythic, already fed this 144-block day, no meal due) and pets with a feed burn of ours still unconfirmed (so a reload never re-burns
   * them), then rebuild the burns with V.feedQueue from the pets that remain. */
  function pendingFeedIds() { var o = {}, conf = {}; (S.rows || []).forEach(function (r) { conf[r.tx_hash] = 1; });
    function add(tag) { var t = V.parseTag(tag); if (!t) return; if (t.action === 'feed') o[t.petId] = 1; if (t.action === 'feedm' || t.action === 'feedl') t.ids.forEach(function (id) { o[id] = 1; }); }
    try { if (window.V2Wallet && V2Wallet.tracker) V2Wallet.tracker.list().forEach(function (t) { if (t.status !== 'confirmed' && !conf[t.txid]) add(t.tag); }); } catch (e) { }
    (S.mempool || []).forEach(function (x) { if (x && x.source === ME && !conf[x.tx_hash]) add(x.tag); }); return o; }
  function feedGuard(w, plans) { var feedIds = [], other = [], why = {}, pend = null;
    plans.forEach(function (q) { var t = V.parseTag(q.tag); if (t && t.action === 'feed') feedIds.push(t.petId); else if (t && (t.action === 'feedm' || t.action === 'feedl')) feedIds = feedIds.concat(t.ids); else other.push(q); });
    if (!feedIds.length) return { plans: plans, skipped: [], text: '' };
    pend = pendingFeedIds(); var ok = feedIds.filter(function (id) { var p = w.byId[id], r = !p ? 'not found' : p.owner !== ME ? 'not yours' : p.dead ? 'dead' : p.released ? 'released' : (p.mythicCare || p.stage >= 5) ? 'Mythic (never starves)' : p.fedToday ? 'already fed this chain day' : pend[id] ? 'a feed burn is still waiting to confirm' : !(p.nextMeal > 0) || !p.hungry ? 'no meal due' : null;
      if (r) (why[r] = why[r] || []).push(id); return !r; });
    var skipped = feedIds.filter(function (id) { return ok.indexOf(id) < 0; }); if (!skipped.length) return { plans: plans, skipped: [], text: '' };
    var text = Object.keys(why).map(function (r) { return idList(why[r]) + ' ' + r; }).join(' · ');
    return { plans: other.concat(ok.length ? V.feedQueue(w, ME, ok) : []), skipped: skipped, text: text }; }
  /* Resume (build 2): the unsent part of a stopped multi-burn run is kept per network + address so a reload offers Continue instead of rebuilding sent burns */
  function resumeKey() { return 'xcpets-v2-resume-' + NET + '-' + (ME || ''); }
  function saveResume(title, rest) { try { if (rest && rest.length) localStorage.setItem(resumeKey(), JSON.stringify({ title: title, plans: rest, at: Date.now() })); else localStorage.removeItem(resumeKey()); } catch (e) { } }
  function loadResume() { try { var o = JSON.parse(localStorage.getItem(resumeKey()) || 'null'); if (o && o.plans && o.plans.length && Date.now() - o.at < 24 * 3600e3) return o; localStorage.removeItem(resumeKey()); } catch (e) { } return null; }
  var resumeShown = false;
  function offerResume() { if (resumeShown || !ME) return; var o = loadResume(); if (!o) return; resumeShown = true;
    toast('⏸️ ' + o.plans.length + ' burn' + (o.plans.length > 1 ? 's' : '') + ' from an unfinished run (' + esc(o.title || 'burns') + ') were not sent. <a href="#" class="resume">Continue</a> · <a href="#" class="resdrop">Dismiss</a>', 30000);
    var t = $('toasts').lastChild; t.querySelector('.resume').onclick = function (e) { e.preventDefault(); t.remove(); confirmPlans('Continue: ' + (o.title || 'burns'), o.plans); };
    t.querySelector('.resdrop').onclick = function (e) { e.preventDefault(); t.remove(); saveResume(null, null); }; }
  $('cfNo').onclick = function () { close('confirmBox'); pendingPlans = null; };
  $('cfYes').onclick = function () { var plans = pendingPlans; if (!plans) return; var s = V.burnSummary(plans); if (!ME || V2Wallet.current() !== ME) { toast('Connecting XCP Wallet…'); V2Wallet.connect().then(function (a) { if (a !== ME) location.reload(); else $('cfYes').onclick(); }, function (e) { toast(V2Wallet.errHtml(e)); }); return; } if (s.total > S.balance) return toast('Not enough XCPETS in this wallet');
    $('cfYes').disabled = true; $('cfNo').disabled = true; var i = 0, title = $('cfTitle').textContent; saveResume(title, plans);
    function sendOnce(p) { return V2Wallet.send(p, ME).catch(function (e) { if (e && e.code === -32005) { $('pgt').textContent = 'XCP Wallet is busy: retrying in a few seconds…'; return new Promise(function (r) { setTimeout(r, 4000); }).then(function () { return V2Wallet.send(p, ME); }); } throw e; }); }
    (function step() { if (i >= plans.length) { save(); saveResume(null, null); $('pgt').textContent = '✓ ' + plans.length + ' burn' + (plans.length > 1 ? 's' : '') + ' sent from XCP Wallet. They appear here once confirmed in a block.'; var nr = plans.filter(function (q) { return /^pet:(roll|fr|of):/.test(q.tag); }).length; if (nr) toast('🎁 Gear on the way' + (nr > 1 ? ' (' + nr + ' rolls)' : '') + '. Your piece' + (nr > 1 ? 's show' : ' shows') + ' up here once the burn confirms, usually in about 10 minutes.', 9000); setTimeout(function () { close('confirmBox'); var a = pendingAfter; pendingPlans = null; render(); if (a) a(); }, 400); return; }
      var p = plans[i++], k = i; $('pgt').textContent = 'Burn ' + k + ' of ' + plans.length + ': building ' + p.tag + ', then approve it in XCP Wallet…'; sendOnce(p).then(function (r) { saveResume(title, plans.slice(k)); $('pg').style.width = (100 * k / plans.length) + '%'; $('pgt').textContent = 'Burn ' + k + ' of ' + plans.length + ' sent: ' + p.tag + ' · tx ' + r.txid.slice(0, 10) + '…'; if (plans.length <= 3) toast('⏳ Broadcast: ' + esc(p.label || p.tag) + ' · <a target="_blank" rel="noopener" href="https://mempool.space/tx/' + r.txid + '">' + r.txid.slice(0, 6) + '… mempool ↗</a>' + (/^pet:hatch/.test(p.tag) ? ' · 🥚 your egg' + (p.tag === 'pet:hatch' ? '' : 's') + ' hatch when this confirms (the hatch popup opens then)' : ' · result when confirmed'), 9000); renderLog(world()); if (i < plans.length) setTimeout(step, 1500); else step(); }, function (e) { var raw = e ? (e.message || (e.data && (e.data.message || JSON.stringify(e.data))) || String(e)) : '', eh = e && e.waitConfirm ? esc(k > 1 ? 'Burn ' + (k - 1) + ' is waiting to confirm. Wait about one block, then press Continue.' : 'An earlier burn of yours is waiting to confirm. Wait about one block, then press Continue.') : V2Wallet.errHtml(e);
        saveResume(title, plans.slice(k - 1)); $('pgt').innerHTML = '<span class="warn">Stopped at burn ' + k + ' of ' + plans.length + ' (' + (k - 1) + ' sent): ' + eh + (raw && !e.waitConfirm ? ' <span class="muted">· wallet/node said: <code>' + esc(raw) + '</code></span>' : '') + '</span>'; $('cfNo').disabled = false; pendingPlans = plans.slice(k - 1); if (!e.reload) { $('cfYes').textContent = 'Continue from burn ' + k; $('cfYes').disabled = false; } }); })(); };

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
  /* community gear roll (2026-10-15, Jake): pet:c:roll, 690, the community pet gets one random gear piece; offered only once the tip reaches ACTIVATE_CROLL_BLOCK */
  $('crollBtn').onclick = function () { if (!V.crollOn(S.tip)) return toast('Community gear roll switches on at block ' + fmt(V.ACTIVATE_CROLL_BLOCK) + ' (chain tip ' + fmt(S.tip) + ').');
    var pl = V.communityRollPlan(); confirmPlans('Community gear roll: the community pet gets one random gear item', [pl], function () { toast('🎲 Community gear roll submitted. The community pet\'s new piece depends on the block your burn lands in.', 9000); }); };
  $('balRefresh').onclick = render;

  // ---------------------------------------------------------------- battles
  function fighters(w, owner, not) { return w.pets.filter(function (p) { return (not ? p.owner !== owner : p.owner === owner) && !p.dead && !p.released && p.stage >= 2 && !p.neglected; }); }
  function opt(p) { return '<option value="' + p.id + '">#' + p.id + ' ' + esc(p.name) + ' (' + spLabel(p.species) + ' ' + p.stageName + ')' + (p.owner !== ME ? ' — ' + esc(p.owner) : '') + '</option>'; }
  /* pending challenges (2026-10-15, Jake): the battles box lists the connected player's open challenges in BOTH directions:
   * sent (still waiting for acceptance) and received (with Accept). Confirmed ones come from the replayed world (w.fights, status 'open');
   * unconfirmed ones come from the node mempool (S.mempool, read-only) + this browser's sent-burn tracker. Display only: nothing here feeds the replay. */
  /* breeding UI (build fix): short address (ranking-board format 6…4) with the full one in title; pet label with tier pill */
  function shortAddr(a) { a = String(a || ''); return '<span class="addr" title="' + esc(a) + '">' + esc(a.length > 14 ? a.slice(0, 6) + '…' + a.slice(-4) : a) + '</span>'; }
  function petLblT(w, id) { var p = w.byId[id]; return petLbl(w, id) + (p ? ' ' + tierPill(p.tier) : ''); }
  function breedSum(w, a, b) { var A = w.byId[a], B = w.byId[b]; return '<div class="bsum small">' + [A, B].map(function (p, i) { return p ? '<div><b>' + (i ? 'Partner' : 'Your pet') + ':</b> ' + esc(p.name) + ' <span class="muted">#' + p.id + '</span> ' + tierPill(p.tier) + (p.owner !== ME ? ' <span class="muted">owner ' + shortAddr(p.owner) + '</span>' : '') + '</div>' : ''; }).join('') + '</div>'; }
  function petLbl(w, id) { var p = w.byId[id]; return (p && p.name ? esc(p.name) + ' ' : 'Pet ') + '#' + id; }
  function agoLbl(ms) { if (!ms) return ''; var m = Math.max(0, Math.round((Date.now() - ms) / 60000)); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : Math.round(m / 60) + ' h ago'; }
  function pendingBattles(w) {
    var out = [], confirmed = {}, tip = S.tip || w.tip || 0; (S.rows || []).forEach(function (r) { confirmed[r.tx_hash] = 1; });
    var accepting = {}, unconf = [], seen = {};
    function addU(x, mine) { if (!x || !x.tx_hash || seen[x.tx_hash] || confirmed[x.tx_hash]) return; seen[x.tx_hash] = 1; var t = V.parseTag(x.tag); if (t) unconf.push({ x: x, t: t, mine: mine || x.source === ME }); }
    (S.mempool || []).forEach(function (x) { addU(x); });
    try { if (window.V2Wallet && V2Wallet.tracker) V2Wallet.tracker.list().forEach(function (t) { addU({ tx_hash: t.txid, source: ME, tag: t.tag, amount: t.amount, at: t.at }, true); }); } catch (e) { }
    unconf.forEach(function (u) { if (u.t.action === 'accept') accepting[u.t.fightId] = u.x; });
    function txa(h) { return h ? ' · <a target="_blank" rel="noopener" href="https://mempool.space/tx/' + h + '">tx ' + h.slice(0, 8) + '…</a>' : ''; }
    function left(f) { var n = f.expires - tip; return n > 0 ? 'expires at block ' + fmt(f.expires) + ' (~' + (n >= 12 ? Math.round(n / 6) + ' h' : n * 10 + ' min') + ' left)' : 'expires at block ' + fmt(f.expires); }
    w.fights.forEach(function (f) { if (f.status !== 'open' || (tip && tip - f.block > V.FIGHT_WINDOW)) return; var A = w.byId[f.a], B = w.byId[f.b], acc = accepting[f.id];
      if (A && A.owner === ME) out.push('<div class="txrow pend-out">📤 <b>Challenged:</b> ' + petLbl(w, f.a) + ' vs ' + petLbl(w, f.b) + ' · fight ' + f.id + ' · ' + (acc ? 'accept burn pending confirmation' : 'challenge sent, waiting for acceptance') +
        ' · sent at block ' + fmt(f.block) + ' · stake ' + fmt(V.COSTS.fight) + ' XCPETS burned · ' + left(f) + txa(f.tx) + '</div>');
      else if (B && B.owner === ME) out.push('<div class="txrow pend-in">📥 <b>Challenged by:</b> ' + petLbl(w, f.a) + ' vs your ' + petLbl(w, f.b) + ' · fight ' + f.id + ' · from ' + esc(String(f.challenger || (A && A.owner) || '').slice(0, 10)) + '… at block ' + fmt(f.block) + ' · ' + left(f) +
        (acc ? ' · ⏳ your accept is pending confirmation' + txa(acc.tx_hash) : ' <button class="btn ico-flame" data-acc="' + f.id + '">Accept (' + fmt(V.COSTS.accept) + ')</button>') + '</div>'); });
    unconf.forEach(function (u) { if (u.t.action !== 'fight') return; var A = w.byId[u.t.a], B = w.byId[u.t.b], when = agoLbl(u.x.at);
      if (u.mine) out.push('<div class="txrow pend-out">⏳ <b>Challenged:</b> ' + petLbl(w, u.t.a) + ' vs ' + petLbl(w, u.t.b) + ' · challenge sent, pending confirmation' + (when ? ' · sent ' + when : '') + ' · stake ' + fmt(u.x.amount || V.COSTS.fight) + ' XCPETS · opponent has ' + V.FIGHT_WINDOW + ' blocks to accept once it confirms' + txa(u.x.tx_hash) + '</div>');
      else if (B && B.owner === ME) out.push('<div class="txrow pend-in">⏳ <b>Challenged by:</b> ' + petLbl(w, u.t.a) + ' vs your ' + petLbl(w, u.t.b) + ' · pending confirmation' + (when ? ' · seen ' + when : '') + ' · you can accept once it confirms' + txa(u.x.tx_hash) + '</div>'); });
    /* breed requests (2026-10-15): incoming = a request for one of your pets (Accept burns the mirrored pet:breed:B:A), outgoing = yours, waiting */
    var bwin = V.BREED_WINDOW, bacc = {}; unconf.forEach(function (u) { if (u.t.action === 'breed') bacc[u.t.b + ':' + u.t.a] = u.x; });
    w.breedReqs.forEach(function (r) { if (r.used || (tip && tip - r.block > bwin)) return; var A = w.byId[r.a], B = w.byId[r.b], m = bacc[r.a + ':' + r.b], until = 'until block ' + fmt(r.block + bwin);
      if (r.owner === ME) out.push('<div class="txrow pend-out">💞 <b>Breed request sent:</b> ' + petLblT(w, r.a) + ' × ' + petLblT(w, r.b) + ' · ' + (m ? 'partner accepted, pending confirmation' : 'waiting for the owner of #' + r.b + ' to accept') + ' · sent at block ' + fmt(r.block) + ' · ' + until + txa(r.tx) + '</div>');
      else if (B && B.owner === ME) out.push('<div class="txrow pend-in">💞 <b>Breed request:</b> ' + petLblT(w, r.a) + ' asks your ' + petLblT(w, r.b) + ' · from ' + shortAddr(r.owner) + ' at block ' + fmt(r.block) + ' · ' + until + ' · the egg goes to the requester' +
        (m ? ' · ⏳ your accept is pending confirmation' + txa(m.tx_hash) : ' <button class="btn ico-flame" data-bracc="' + r.b + ':' + r.a + '">Accept breed (' + fmt(V.COSTS.breed) + ')</button>') + '</div>'); });
    unconf.forEach(function (u) { if (u.t.action !== 'breed') return; var B = w.byId[u.t.b]; if (!B) return;
      if (u.mine && B.owner === ME) { out.push('<div class="txrow pend-out">⏳ <b>Breeding ' + petLblT(w, u.t.a) + ' × ' + petLblT(w, u.t.b) + ':</b> your egg appears once this confirms' + txa(u.x.tx_hash) + '</div>'); return; }
      if (w.breedReqs.some(function (r) { return !r.used && r.a === u.t.b && r.b === u.t.a; })) return; /* it is an accept, shown above */
      if (u.mine) out.push('<div class="txrow pend-out">⏳ <b>Breed request sent:</b> ' + petLblT(w, u.t.a) + ' × ' + petLblT(w, u.t.b) + ' · pending confirmation' + txa(u.x.tx_hash) + '</div>');
      else if (B.owner === ME) out.push('<div class="txrow pend-in">⏳ <b>Breed request:</b> ' + petLblT(w, u.t.a) + ' asks your ' + petLblT(w, u.t.b) + ' · pending confirmation · you can accept once it confirms' + txa(u.x.tx_hash) + '</div>'); });
    return out;
  }
  /* fight results (2026-10-15, Jake): on live the accept only resolves once its burn CONFIRMS, so playing the fight right after sending did nothing
   * (the fight had no turns yet). Now: after sending, say so; when a fight involving one of your pets turns 'done' in the replayed world, BOTH players
   * get the fight animation once (per browser) plus a result toast: winner, the piece taken, the loser's black eye. Display only, nothing replayed differently. */
  function afterAccept(id) { var f = world().fights[id - 1]; if (f && f.status === 'done') { seenFight(f.id); return playFight(f); }
    toast('⚔️ Accept sent for fight ' + id + '. The fight plays here for both players once your accept burn confirms in a block.', 9000); }
  var FKEY = 'xcpets-v2-fights-seen-' + KEY + '-' + ME;
  function fightSeen() { try { return JSON.parse(localStorage.getItem(FKEY)); } catch (e) { return null; } }
  function seenFight(id) { var s = fightSeen() || {}; s[id] = 1; try { localStorage.setItem(FKEY, JSON.stringify(s)); } catch (e) { } }
  function notifyFights(w) { if (!ME) return; var seen = fightSeen(), first = !seen, tip = S.tip || w.tip || 0; seen = seen || {}; var q = [];
    w.fights.forEach(function (f) { if (f.status !== 'done' || seen[f.id]) return; var A = w.byId[f.a], B = w.byId[f.b]; if (!(A && A.owner === ME) && !(B && B.owner === ME) && f.challenger !== ME) return;
      seen[f.id] = 1; if (first && tip - f.acceptBlock > V.FIGHT_WINDOW) return; q.push(f); }); /* first visit: only fights resolved in the last day play */
    try { localStorage.setItem(FKEY, JSON.stringify(seen)); } catch (e) { }
    q.forEach(function (f) { var win = w.byId[f.winner], los = w.byId[f.loser], mineWon = win && win.owner === ME;
      toast('⚔️ Fight ' + f.id + ' result: ' + (mineWon ? 'your ' : '') + esc(win ? win.name : '') + ' #' + f.winner + ' beat ' + (!mineWon ? 'your ' : '') + esc(los ? los.name : '') + ' #' + f.loser +
        (f.spoils ? ' and took ' + esc(f.spoils.label) : ' (no takeable gear)') + ' · #' + f.loser + ' has a black eye until block ' + fmt(f.acceptBlock + V.BLACK_EYE_BLOCKS) + '. <a href="#" data-replay="' + f.id + '">▶ Replay</a>', 15000);
      var a = $('toasts').lastChild.querySelector('[data-replay]'); if (a) a.onclick = function (e) { e.preventDefault(); playFight(world().fights[f.id - 1]); }; });
    q.forEach(function (f) { queueAnim(function () { playFight(world().fights[f.id - 1]); }); }); }
  /* breed results (2026-10-15, Jake): a breed between two owners resolves when the partner's owner burns the mirrored tag (pet:breed:B:A within
   * BREED_WINDOW blocks; the egg goes to the requester). Only the sender used to see the animation, right after sending. Now: when an egg whose parent
   * (or the egg itself) is one of your pets appears in the replayed world, BOTH owners get the breeding animation once per browser + a message with Replay.
   * Same first-visit cut-off as fights (only breeds from the last 144 blocks auto-play). Display only. */
  var BKEY = 'xcpets-v2-breeds-seen-' + KEY + '-' + ME;
  function breedSeen() { try { return JSON.parse(localStorage.getItem(BKEY)); } catch (e) { return null; } }
  function seenBreed(id) { var s = breedSeen() || {}; s[id] = 1; try { localStorage.setItem(BKEY, JSON.stringify(s)); } catch (e) { } }
  function replayBreed(kidId) { var w = world(), kid = w.byId[kidId]; if (!kid || !kid.parents) return; var n0 = petIds(); delete n0[kid.id + ':' + (kid.parents || '')]; playBreed(kid.parents[0], kid.parents[1], n0); }
  function notifyBreeds(w) { if (!ME) return; var seen = breedSeen(), first = !seen, tip = S.tip || w.tip || 0; seen = seen || {}; var q = [];
    w.pets.forEach(function (k) { if (!k.parents || seen[k.id]) return; var A = w.byId[k.parents[0]], B = w.byId[k.parents[1]];
      if (k.owner !== ME && !(A && A.owner === ME) && !(B && B.owner === ME)) return; seen[k.id] = 1; if (first && tip - k.hatchBlock > V.BREED_WINDOW) return; q.push(k); });
    try { localStorage.setItem(BKEY, JSON.stringify(seen)); } catch (e) { }
    q.forEach(function (k) { var A = w.byId[k.parents[0]], B = w.byId[k.parents[1]], nm = function (p, id) { return (p && p.owner === ME ? 'your ' : '') + esc(p ? p.name : 'Pet') + ' #' + id; };
      toast('🥚 Breed: ' + nm(A, k.parents[0]) + ' × ' + nm(B, k.parents[1]) + ' → ' + (k.owner === ME ? 'your ' : '') + 'egg ' + esc(k.name) + ' #' + k.id + (k.hybrid ? ' (hybrid ' + esc(k.hybrid.name) + ')' : '') +
        (k.owner === ME ? '' : ' (owner ' + esc(String(k.owner).slice(0, 8)) + '…)') + ' at block ' + fmt(k.hatchBlock) + '. <a href="#" data-breplay="' + k.id + '">▶ Replay</a>', 15000);
      var a = $('toasts').lastChild.querySelector('[data-breplay]'); if (a) a.onclick = function (e) { e.preventDefault(); replayBreed(k.id); }; });
    q.forEach(function (k) { queueAnim(function () { replayBreed(k.id); }); }); }
  function renderBattles(w) {
    var a = $('fMine').value, b = $('fTheirs').value;
    $('fMine').innerHTML = fighters(w, ME).map(opt).join('') || '<option value="">no eligible pet</option>'; $('fTheirs').innerHTML = fighters(w, ME, true).map(opt).join('');
    if (a) $('fMine').value = a; if (b) $('fTheirs').value = b;
    $('fights').innerHTML = w.fights.slice().reverse().map(function (f) { var A = w.byId[f.a], B = w.byId[f.b];
      return '<div class="txrow">⚔️ fight ' + f.id + ': #' + f.a + ' ' + esc(A.name) + ' vs #' + f.b + ' ' + esc(B.name) + ' · ' + f.status + (f.status === 'open' ? ' (accept by block ' + f.expires + ')' : '') +
        (f.status === 'done' ? ' · winner #' + f.winner + (f.spoils ? ' took ' + esc(f.spoils.label) : '') + ' <button class="q" data-view="' + f.id + '">▶ Replay</button>' : '') +
        (f.status === 'open' && B.owner !== ME ? (M.prod ? ' <span class="muted small">waiting for the owner of #' + f.b + ' to accept</span>' : ' <button class="q" data-npc="' + f.id + '">Rival accepts</button>') : '') + (f.status === 'open' && B.owner === ME ? ' <button class="btn ico-flame" data-acc="' + f.id + '">Accept (690)</button>' : '') + '</div>'; }).join('') || '<p class="muted small">No fights yet.</p>';
    var pb = ME ? pendingBattles(w) : [];
    $('fPending').innerHTML = '<h3 class="sec" data-ico="sword">Your pending challenges &amp; breed requests</h3>' + (pb.join('') || '<p class="muted small">' + (ME ? 'No pending challenges sent or received.' : 'Connect your wallet to see your challenges.') + '</p>');
    $('fPending').querySelectorAll('[data-bracc]').forEach(function (x) { x.onclick = function () { var q = x.dataset.bracc.split(':'); confirmPlans('Accept breed: your #' + q[0] + ' × #' + q[1], [{ tag: 'pet:breed:' + q[0] + ':' + q[1], amount: 690 }], function () { toast('💞 Breed accept sent. The egg appears and both owners see the breeding once it confirms.', 9000); render(); }); if (ME && $('confirmBox').classList.contains('on')) $('cfBody').insertAdjacentHTML('afterbegin', breedSum(world(), q[0], q[1])); }; });
    $('fPending').querySelectorAll('[data-acc]').forEach(function (x) { x.onclick = function () { confirmPlans('Accept fight ' + x.dataset.acc, [{ tag: 'pet:accept:' + x.dataset.acc, amount: 690 }], function () { afterAccept(x.dataset.acc); }); }; });
    $('fights').querySelectorAll('[data-view]').forEach(function (x) { x.onclick = function () { playFight(world().fights[x.dataset.view - 1]); }; });
    $('fights').querySelectorAll('[data-npc]').forEach(function (x) { x.onclick = function () { var f = world().fights[x.dataset.npc - 1]; adv(3); burn(world().byId[f.b].owner, 'pet:accept:' + f.id, 690); save(); render(); playFight(world().fights[f.id - 1]); }; });
    $('fights').querySelectorAll('[data-acc]').forEach(function (x) { x.onclick = function () { confirmPlans('Accept fight ' + x.dataset.acc, [{ tag: 'pet:accept:' + x.dataset.acc, amount: 690 }], function () { afterAccept(x.dataset.acc); }); }; });
  }
  $('fGo').onclick = function () { var a = $('fMine').value, b = $('fTheirs').value; if (!a || !b) return toast('Pick both pets'); confirmPlans('Challenge #' + b, [{ tag: V.buildTag('fight', { a: a, b: b }), amount: 690 }]); };
  $('fNpc').onclick = function () { var w = world(), my = fighters(w, ME), np = fighters(w, ME, true).filter(function (p) { return !p.fightDays[V.day(S.tip)]; });
    if (!my.length || !np.length) return toast('No eligible pets'); var m = my[S.n % my.length], n = np[S.n % np.length]; burn(n.owner, 'pet:fight:' + n.id + ':' + m.id, 690); save(); render(); toast('⚔️ ' + n.owner + ' challenged #' + m.id); };
  // Animation pop-up (2026-10-14): battle / breeding animations play in a centred modal over a dimmed backdrop; the page never scrolls.
  // The arena element is moved into the modal and put back on close (finish, Skip, Esc, backdrop click); scroll position is restored.
  var animM = { el: null, home: null, y: 0, iv: null, onClose: null }, animQ = [];
  /* result animations (fights, breeds) queue up and play one after another, each once (2026-10-15) */
  function queueAnim(fn) { animQ.push(fn); if (!animM.el && animQ.length === 1) setTimeout(nextAnim, 600); }
  function nextAnim() { if (animM.el || !animQ.length) return; animQ.shift()(); }
  function animOpen(el, iv, onClose) { animClose(true); var box = $('animBox'); if (!box) { box = document.createElement('div'); box.id = 'animBox'; box.className = 'reveal anim'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
      box.innerHTML = '<div class="box wide"><button type="button" class="q" id="animClose" style="float:right" aria-label="Close">&times;</button><div id="animSlot"></div></div>'; document.body.appendChild(box);
      box.addEventListener('click', function (e) { if (e.target === box) animClose(); }); $('animClose').onclick = function () { animClose(); }; }
    animM.y = window.scrollY; animM.el = el; animM.home = document.createComment('arena'); el.parentNode.insertBefore(animM.home, el); $('animSlot').appendChild(el); animM.onClose = onClose || null;
    box.classList.add('on'); window.scrollTo(0, animM.y); }
  function animClose(silent) { var box = $('animBox'); if (!animM.el) return; var y = animM.y, cb = animM.onClose; animM.home.parentNode.insertBefore(animM.el, animM.home); animM.home.remove(); animM.el = null; animM.onClose = null;
    if (box) box.classList.remove('on'); if (!silent && cb) cb(); window.scrollTo(0, y); if (animQ.length) setTimeout(nextAnim, 500); }
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
  if (M.prod) ['fNpc'].forEach(function (id) { if ($(id)) $(id).style.display = 'none'; }); /* NPC simulation buttons: nothing to simulate on the live chain */
  // ---------------------------------------------------------------- breeding
  function renderBreed(w) {
    var a = $('bA').value, b = $('bB').value, L = V.breedPicker(w, ME, S.tip, a);
    if (a && !L.mine.some(function (x) { return String(x.p.id) === a && !x.why; })) a = $('bA').value = '';
    if (b && !L.partners.some(function (x) { return String(x.p.id) === b && !x.why; })) b = $('bB').value = '';
    /* perf (2026-10-14): a 2,000-pet wallet has ~6,000 picker cards. Eligibility is one breedPicker pass per render (cheap); the cards are built
     * ONCE per world (one HTML string -> one fragment, lazy sprites, one delegated click per grid) and a pick only updates the affected cards. */
    function card(x, role, sel) { var p = x.p, on = String(p.id) === sel;
      return '<button type="button" class="pet card' + (on ? ' sel' : '') + (x.why ? ' off' : '') + '" data-role="' + role + '" data-pid="' + p.id + '" title="' + esc(x.why ? 'Can\'t pick: ' + x.why : 'Pick #' + p.id + ' as parent ' + role) + '" aria-pressed="' + on + '">' +
        '<canvas width="32" height="32"></canvas><b style="color:var(--ink)">' + esc(p.name) + '</b><div class="muted">#' + p.id + ' ' + tierPill(p.tier) + ' · ' + esc(spLabel(p.species)) + ' · ' + p.stageName + '</div>' + (p.owner !== ME ? '<div class="muted">' + shortAddr(p.owner) + '</div>' : '') + '</button>'; }
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
    var RULE = 'A pet can breed when it is <b>Adult or older</b> (stage 3+: Adult, Elder, Mythic), not neglected, ' + (V.breedCapOn && V.breedCapOn(S.tip) ? 'has bred fewer than <b>' + V.BREED_MAX + '</b> times and ' : 'and ') + 'its last breeding was at least <b>' + fmt(V.BREED_COOLDOWN) + ' blocks</b> ago (about a week). Nakamoto and community pets never breed.';
    var okA = L.mine.filter(function (x) { return !x.why; }), okB = L.partners.filter(function (x) { return !x.why; });
    function note(id, after, html) { var n = $(id); if (!n) { n = document.createElement('div'); n.id = id; n.className = 'small muted bnote'; after.parentNode.insertBefore(n, after); } n.innerHTML = html; }
    note('bNoteA', $('bGridA'), fmt(okA.length) + ' of ' + fmt(L.mine.length) + ' of your pets can breed now.');
    note('bNoteB', $('bGridB'), fmt(okB.length) + ' of ' + fmt(L.partners.length) + ' pets can breed now' + (a ? ' (excluding parent A #' + esc(a) + ')' : '') + '.');
    grid($('bGridA'), okA, a, 'A', $('bA')); grid($('bGridB'), okB, b, 'B', $('bB'));
    if (!okA.length) $('bGridA').innerHTML = '<p class="small bempty">' + (L.mine.length ? 'None of your pets can breed yet: ' + reasons(L.mine) + '. ' : 'You have no living pets. ') + RULE + '</p>';
    if (!okB.length) $('bGridB').innerHTML = '<p class="small bempty">No partner can breed right now' + (L.partners.length ? ': ' + reasons(L.partners) : '') + '. ' + RULE + '</p>';
    if (!okA.length) $('bGridA').__w = null; if (!okB.length) $('bGridB').__w = null;
    $('bSelA').innerHTML = a ? '#' + a + ' ' + esc(w.byId[a].name) + ' ' + tierPill(w.byId[a].tier) : 'pick one'; $('bSelB').innerHTML = b ? '#' + b + ' ' + esc(w.byId[b].name) + ' ' + tierPill(w.byId[b].tier) + (w.byId[b].owner !== ME ? ' <span class="muted">' + shortAddr(w.byId[b].owner) + '</span>' : '') : 'pick one';
    $('bKids').innerHTML = w.pets.filter(function (p) { return p.parents; }).map(function (k) { return '<span class="chip">#' + k.id + ' ' + esc(k.name) + ' · ' + TL[k.tier] + ' ' + spLabel(k.species) + ' · ' + k.stageName + ' ← #' + k.parents.join(' × #') + '</span>'; }).join('') || '<span class="muted">none yet</span>';
    $('bReqs').innerHTML = w.breedReqs.filter(function (r) { return !r.used && S.tip - r.block <= V.BREED_WINDOW; }).map(function (r) { return '<div data-btx="' + esc(r.tx || '') + '">' + petLblT(w, r.a) + ' → ' + petLblT(w, r.b) + ' (until block ' + (r.block + V.BREED_WINDOW) + ') ' + ((w.byId[r.b] || {}).owner !== ME ? '<span class="muted">waiting for the owner of #' + r.b + ' to accept</span>' : '<span class="muted">accept it in Your pending challenges above</span>') + '</div>'; }).join('') + unconfBreeds(w) || '<div class="muted">none</div>';
  }
  /* unconfirmed breed burns (node mempool + this browser's tracker) shown in the open list until the tx is in S.rows (display only) */
  function unconfBreeds(w) { var conf = {}, seen = {}, out = []; (S.rows || []).forEach(function (r) { conf[r.tx_hash] = 1; });
    var L = (S.mempool || []).map(function (x) { return { h: x.tx_hash, tag: x.tag, src: x.source }; });
    try { if (window.V2Wallet && V2Wallet.tracker) V2Wallet.tracker.list().forEach(function (t) { L.push({ h: t.txid, tag: t.tag, src: ME }); }); } catch (e) { }
    L.forEach(function (x) { if (!x.h || conf[x.h] || seen[x.h]) return; seen[x.h] = 1; var t = V.parseTag(x.tag); if (!t || t.action !== 'breed') return; var A = w.byId[t.a], B = w.byId[t.b];
      var tx = ' · <a target="_blank" rel="noopener" href="https://mempool.space/tx/' + esc(x.h) + '">tx ' + esc(String(x.h).slice(0, 8)) + '…</a>';
      if (A && B && A.owner === B.owner) { if (A.owner === ME) out.push('<div>⏳ Breeding ' + petLblT(w, t.a) + ' × ' + petLblT(w, t.b) + ': your egg appears once this confirms' + tx + '</div>'); return; }
      if (x.src !== ME && !(B && B.owner === ME)) return;
      out.push('<div>' + petLblT(w, t.a) + ' → ' + petLblT(w, t.b) + ' <span class="muted">⏳ pending confirmation</span>' + tx + '</div>'); });
    return out.join(''); }
  $('bGo').onclick = function () { if (!ME) return confirmPlans('Breed', [{}]); var a = $('bA').value, b = $('bB').value; if (!a || !b) return toast('Pick parent A and parent B'); var n0 = petIds();
    confirmPlans('Breed #' + a + ' × #' + b, [{ tag: V.buildTag('breed', { a: a, b: b }), amount: 690 }], function () { var y = window.scrollY; $('bA').value = ''; $('bB').value = ''; render(); window.scrollTo(0, y); playBreed(a, b, n0); var w2 = world(), A2 = w2.byId[a], B2 = w2.byId[b]; toast(A2 && B2 && A2.owner === B2.owner ? '⏳ Breeding #' + a + ' × #' + b + ': your egg appears once this confirms.' : '💞 Breed request sent: #' + a + ' → #' + b + '. The partner\'s owner can accept it once it confirms.', 9000); }); if (ME && $('confirmBox').classList.contains('on')) $('cfBody').insertAdjacentHTML('afterbegin', breedSum(world(), a, b)); };
  function petIds() { var o = {}; world().pets.forEach(function (p) { o[p.id + ':' + (p.parents || '')] = 1; }); return o; } // pets before the breed
  /** playBreed: the battle arena's approach for a breed. Both parents hop together, hearts, the egg appears, then the result. Display only. Skippable. */
  /** feedEgg(id): the normal feed flow for a freshly bred egg (existing confirm dialog, default 69). */
  function feedEgg(id) { if (animM.el) animClose(true); var y = window.scrollY; confirmPlans('Feed #' + id, [{ tag: 'pet:feed:' + id, amount: 69, petId: id, label: 'Feed #' + id }], function () { render(); window.scrollTo(0, y); toast('🍼 Fed egg #' + id); }); }
  window.V2FeedEgg = feedEgg;
  /* breed review Skip (fix): dismiss the current result (persisted per address), hide the box, then advance: next queued breed/egg animation,
   * else the next open breed request not yet reviewed (scrolled to + flashed), else 'Nothing left to review'. Display only. */
  var BRKEY = 'xcpets-v2-breedrev-dismissed-' + KEY + '-' + ME;
  function brDis() { try { return JSON.parse(localStorage.getItem(BRKEY)) || {}; } catch (e) { return {}; } }
  function brMark(k) { var d = brDis(); d[k] = 1; try { localStorage.setItem(BRKEY, JSON.stringify(d)); } catch (e) { } }
  function breedSkip(kidId) { if (kidId != null) { brMark('k' + kidId); seenBreed(kidId); }
    if (animM.el === $('breedStage')) animClose(); $('breedStage').style.display = 'none'; $('breedMsg').textContent = '';
    if (animQ.length) return; /* nextAnim plays the next queued breed/egg result */
    var d = brDis(), row = [].slice.call($('bReqs').querySelectorAll('[data-btx]')).filter(function (x) { return x.dataset.btx && !d['r' + x.dataset.btx]; })[0];
    if (row) { brMark('r' + row.dataset.btx); row.scrollIntoView({ block: 'center', behavior: 'smooth' }); row.classList.add('flash'); setTimeout(function () { row.classList.remove('flash'); }, 2400); toast('Next to review: open breed request ' + esc(row.innerText.split(' (until')[0])); return; }
    toast('Nothing left to review'); }
  /* incoming-request pop-up (2026-10-16): open battle challenges and cross-owner breed requests waiting for YOUR accept, once per request per session,
   * queued. Accept clicks the existing Accept button in 'Your pending challenges' (same confirm + burn flow); View scrolls to it; Later closes. Display only. */
  var IRQ = [], irqCur = null;
  function irqSeen() { try { return JSON.parse(sessionStorage.getItem('xcpets-inreq-seen-' + ME) || '{}'); } catch (e) { return {}; } }
  function irqMark(k) { var o = irqSeen(); o[k] = 1; try { sessionStorage.setItem('xcpets-inreq-seen-' + ME, JSON.stringify(o)); } catch (e) { } }
  function inReqPopup(w) { if (!ME) return; var tip = S.tip || w.tip || 0, seen = irqSeen(), have = {}; IRQ.concat(irqCur ? [irqCur] : []).forEach(function (x) { have[x.k] = 1; });
    w.fights.forEach(function (f) { if (f.status !== 'open' || (tip && tip - f.block > V.FIGHT_WINDOW)) return; var A = w.byId[f.a], B = w.byId[f.b]; if (!B || B.owner !== ME) return;
      var k = 'f' + f.id; if (seen[k] || have[k]) return; IRQ.push({ k: k, sel: '[data-acc="' + f.id + '"]', kind: 'fight', a: f.a, b: f.b, title: '📥 Battle challenge', who: f.challenger || (A && A.owner), pets: petLblT(w, f.a) + ' vs your ' + petLblT(w, f.b), cost: V.COSTS.accept, until: f.block + V.FIGHT_WINDOW, label: 'Accept (' + fmt(V.COSTS.accept) + ')' }); });
    w.breedReqs.forEach(function (r) { if (r.used || (tip && tip - r.block > V.BREED_WINDOW)) return; var B = w.byId[r.b]; if (!B || B.owner !== ME || r.owner === ME) return;
      var k = 'b' + (r.tx || r.a + ':' + r.b); if (seen[k] || have[k]) return; IRQ.push({ k: k, sel: '[data-bracc="' + r.b + ':' + r.a + '"]', kind: 'breed', a: r.a, b: r.b, title: '💞 Breed request', who: r.owner, pets: petLblT(w, r.a) + ' asks your ' + petLblT(w, r.b) + ' · the egg goes to the requester', cost: V.COSTS.breed, until: r.block + V.BREED_WINDOW, label: 'Accept breed (' + fmt(V.COSTS.breed) + ')' }); });
    irqNext(); }
  /* side-by-side decision info (theirs | yours). Fight numbers follow V2Rules.simulateFight: HP 40+2·vigor+grit+6·stage, gear bonus Σ(1+2·tier),
   * crit 5+⌊luck/4⌋ %, dodge ⌊zoom/5⌋ % (defender's zoom), first strike zoom + d10. Breed numbers follow breedChild/breed. No win % is shown. */
  function irqCompare(w, x) { var A = w.byId[x.a], B = w.byId[x.b]; if (!A || !B) return ''; var K = ['vigor', 'spark', 'grit', 'zoom', 'luck'];
    var pw = function (p) { return K.reduce(function (t, k) { return t + (p.stats[k] || 0); }, 0); };
    var gear = function (p) { return V.wornOf(w, p.id).map(function (g) { var it = (V.GEAR_BY_ID || {})[g.item]; return { slot: g.slot, label: it ? it.label : (g.label || g.item), tier: it ? it.tier : (g.legendary ? 3 : (g.tier || 0)) }; }); };
    var best = function (p) { return K.reduce(function (m, k) { return p.stats[k] > p.stats[m] ? k : m; }, K[0]); };
    var hp = function (p) { return 40 + p.stats.vigor * 2 + p.stats.grit + p.stage * 6; }, gp = function (p) { return gear(p).reduce(function (t, g) { return t + 1 + g.tier * 2; }, 0); };
    function col(p, o, who) { var g = gear(p), grip = g.filter(function (q) { return q.slot === 'hand'; })[0], h = '<div class="irqcol"><div class="small muted">' + who + '</div><canvas width="32" height="32" class="sprite" data-irqp="' + p.id + '"></canvas><div><b>' + esc(p.name) + '</b> <span class="muted">#' + p.id + '</span></div><div class="chips">' + tierPill(p.tier) + '<span class="chip">' + esc(spLabel(p.species)) + '</span><span class="chip stg">' + p.stageName + '</span><span class="chip pow">⚡ ' + pw(p) + '</span></div>' +
        '<table class="small irqst">' + K.map(function (k) { return '<tr><td>' + k + '</td><td><b>' + p.stats[k] + '</b>' + (x.kind === 'breed' && k === best(p) ? ' ★' : '') + '</td></tr>'; }).join('') + '</table>';
      if (x.kind === 'fight') { h += '<div class="small">HP <b>' + hp(p) + '</b> · gear dmg +<b>' + gp(p) + '</b> · crit <b>' + (5 + Math.floor(p.stats.luck / 4)) + '%</b> · dodge <b>' + Math.floor(p.stats.zoom / 5) + '%</b></div><div class="small">Grip: <b>' + esc(grip ? grip.label : 'bare paws') + '</b></div>' +
        '<div class="small muted">' + (g.length ? g.map(function (q) { return esc(V.slotLabel(q.slot)) + ': ' + esc(q.label) + ' (' + TL[Math.min(3, q.tier)] + ')'; }).join(' · ') : 'no gear worn') + '</div>'; }
      else { var bk = best(p), cr = (p.carried || []).filter(function (c) { return c.stat === bk; })[0]; h += '<div class="small">Best stat: <b>' + bk + ' ' + p.stats[bk] + '</b>' + (cr ? ' <span class="muted">(carries ' + bk + ' ' + cr.value + ' from #' + cr.from + ')</span>' : '') + '</div>'; }
      return h + '</div>'; }
    var out = '<div class="irqcmp">' + col(A, B, 'Theirs') + col(B, A, 'Yours') + '</div>';
    if (x.kind === 'fight') { var e = []; var za = A.stats.zoom, zb = B.stats.zoom; e.push(za === zb ? 'first strike is a coin flip (equal zoom)' : (zb > za ? 'yours' : 'theirs') + ' likely strikes first (zoom ' + Math.max(za, zb) + ' vs ' + Math.min(za, zb) + ', +d10 each)');
      e.push(hp(A) === hp(B) ? 'equal HP' : (hp(B) > hp(A) ? 'yours' : 'theirs') + ' has more HP');
      var dm = function (p, d) { return 4 + Math.floor(p.stats.spark / 3) + gp(p) - Math.floor(d.stats.grit / 6); }, da = dm(A, B), db = dm(B, A); e.push(da === db ? 'similar base damage' : (db > da ? 'yours' : 'theirs') + ' hits harder (base ' + Math.max(1, Math.max(da, db)) + ' vs ' + Math.max(1, Math.min(da, db)) + ' +0–7 per hit)');
      out += '<p class="small"><b>Edge:</b> ' + e.join(' · ') + '. Fights last up to ' + 12 + ' turns; no win odds are shown.</p>'; }
    else { var tip = S.tip || w.tip || 0, hyb = V.isHybrid && (V.isHybrid(A.species) || V.isHybrid(B.species));
      var sp = A.species === B.species && !hyb ? 'Same species: the egg is ' + esc(spLabel(A.species)) + ' with a bred-true bonus (+3 to one stat 50%, pattern 30% or eyes 20%).' : (hyb && V.hybrid3On && V.hybrid3On(tip + 1) ? 'Hybrid parent: the egg is always a hybrid (the same mix, another mix of these species, or a three-way mix when three or more species are involved); a hybrid keeps each parent\'s best stat.' : 'Different species' + (hyb ? ' (hybrid parent)' : '') + ': a hybrid ' + (tip >= 971674 ? '68.4773435%' : '') + ' of the time (a hybrid keeps each parent\'s best stat); otherwise one parent\'s species.');
      out += '<p class="small">' + sp + '</p><p class="small"><b>Baby stats</b> (parent average ±2, min 1): ' + K.map(function (k) { var m = Math.round((A.stats[k] + B.stats[k]) / 2); return k + ' ' + Math.max(1, m - 2) + '–' + (m + 2); }).join(' · ') + '. Carried stats can raise the floor.</p>'; }
    return out; }
  function irqNext() { if (irqCur || !IRQ.length) return; if (($('confirmBox') && $('confirmBox').classList.contains('on')) || animM.el) return setTimeout(irqNext, 1500);
    var x = irqCur = IRQ.shift(); irqMark(x.k); var box = $('inReqBox');
    if (!box) { box = document.createElement('div'); box.id = 'inReqBox'; box.className = 'reveal'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'irqTitle'); document.body.appendChild(box); }
    var btn = document.querySelector('#fPending ' + x.sel);
    box.innerHTML = '<div class="box"><h2 id="irqTitle" class="sec" data-ico="sword">' + esc(x.title) + '</h2><p class="small">From ' + shortAddr(x.who) + '</p><p>' + x.pets + '</p><p class="small">Cost to accept: <b>' + fmt(x.cost) + ' <span class="asset">XCPETS</span></b> · expires at block <b>' + fmt(x.until) + '</b>' + (IRQ.length ? ' · ' + IRQ.length + ' more waiting' : '') + '</p>' + irqCompare(world(), x) +
      '<div class="row" style="justify-content:center">' + (btn ? '<button class="btn ico-flame" data-irq="acc">' + esc(x.label) + '</button>' : '') + '<button class="q" data-irq="view">View</button><button class="q" data-irq="later">Later</button></div></div>';
    box.classList.add('on'); box.querySelectorAll('canvas[data-irqp]').forEach(function (c) { var p = world().byId[c.dataset.irqp]; if (p) try { paint(c, petFrames(p, world())[0]); } catch (e) { } });
    box.querySelectorAll('[data-irq]').forEach(function (b) { b.onclick = function () { var a = b.dataset.irq; box.classList.remove('on'); irqCur = null; var t = document.querySelector('#fPending ' + x.sel);
      if (a === 'acc' && t) t.click();
      else if (a === 'view') { var row = t ? t.closest('.txrow') : $('fPending'); if (row) { row.scrollIntoView({ block: 'center', behavior: 'smooth' }); row.classList.add('flash'); setTimeout(function () { row.classList.remove('flash'); }, 2400); } }
      setTimeout(irqNext, 400); }; }); }
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
      if (t >= 40 && kid && !$('bFeedEgg')) { $('breedMsg').innerHTML = (kid.hybrid ? '🧬 <span class="chip hyb">HYBRID</span> <b>' + esc(kid.hybrid.name) + '</b> (' + (kid.hybrid.roots || [kid.hybrid.a, kid.hybrid.b]).map(function (r) { return esc(V.speciesLabel(r)); }).join(' × ') + ') · ' : '') + '🥚 <b>#' + kid.id + ' ' + esc(kid.name) + '</b> · ' + TL[kid.tier] + ' ' + esc(spLabel(kid.species)) + ' · starts as an Egg · parents #' + A.id + ' × #' + B.id + '<br><span class="hatchnote">Your new egg #' + kid.id + ' is in My Pets. Feed it 69 XCPETS to hatch.</span> <button type="button" class="q" id="bFeedEgg" data-egg="' + kid.id + '">🍼 Feed to hatch</button>'; $('bFeedEgg').onclick = function () { feedEgg(kid.id); }; } }
    clearInterval(playBreed.iv); frame(); playBreed.iv = setInterval(function () { k++; frame(); if (k >= END) { clearInterval(playBreed.iv); setTimeout(function () { if (animM.el === $('breedStage')) animClose(); }, 1200); } }, 120);
    $('bSkip').onclick = function () { clearInterval(playBreed.iv); k = END; frame(); breedSkip(kid ? kid.id : null); };
    $('bSkip').disabled = false; var bn = $('bSkipNote'); if (bn) bn.remove();
    animOpen($('breedStage'), playBreed.iv, function () { clearInterval(playBreed.iv); k = END; frame(); });
  }
  window.V2PlayBreed = playBreed; window.V2PetIds = petIds; // used by the screenshot/UI check
  // ---------------------------------------------------------------- burns + log (live .txrow look)
  function renderLog(w) {
    var KL = { fight: 'challenge', fightDone: 'fight result' }; /* 2026-10-15: plain labels for battle lines (display only) */
    var row = function (l) { return '<a href="#" class="txrow" data-tx="' + esc(l.tx) + '">' + esc(KL[l.kind] || l.kind) + ' · block ' + l.block + ' · ' + esc(l.msg) + '</a>'; };
    var mineTx = {}; S.rows.forEach(function (r) { if (r.source === ME) mineTx[r.tx_hash] = 1; });
    var pend = V2Wallet.tracker.list().filter(function (t) { return !S.rows.some(function (x) { return x.tx_hash === t.txid; }); }).reverse().map(function (t) { return '<div class="small">⏳ ' + esc(t.label || t.tag) + ' · ' + fmt(t.amount) + ' XCPETS · <a target="_blank" rel="noopener" href="https://mempool.space/tx/' + t.txid + '">' + t.txid.slice(0, 8) + '…</a> · waiting for a block</div>'; }).join('');
    $('pending').innerHTML = pend + (w.log.filter(function (l) { return mineTx[l.tx]; }).slice(-8).reverse().map(row).join('') || (pend ? '' : 'None yet.'));
    $('log').innerHTML = w.log.slice(-200).reverse().map(row).join('');
  }
  // ---------------------------------------------------------------- other controls
  $('dcYes').onclick = function () { var ids = dropKept(mine(world()).filter(function (p) { return p.tier === 0 && !p.dead; }).map(function (p) { return p.id; })); close('delCommonsBox'); if (!ids.length) return toast('No Commons to hide.'); discardIds(ids); };
  $('dcNo').onclick = function () { close('delCommonsBox'); };
  $('itemClose').onclick = function () { close('itemBox'); };
  $('packClose').onclick = closeReveal; $('packSkip').onclick = function () { close('packBox'); rev = null; render(); setTimeout(nextReveal, 250); };
  $('packCommons').onclick = function () { if (!rev || rev.kind !== 'eggs') return; var w = world(), all = rev.eggs.filter(function (id) { return w.byId[id] && w.byId[id].art.tierIndex === 0; }), ids = dropKept(all);
    if (!ids.length) return toast(all.length ? 'All Commons in this hatch are starred as kept.' : 'No Commons in this hatch.');
    if (!window.confirm('Discard ' + ids.length + ' Common pet' + (ids.length > 1 ? 's' : '') + ' from this hatch?' + (all.length > ids.length ? ' (' + (all.length - ids.length) + ' kept pet' + (all.length - ids.length > 1 ? 's are' : ' is') + ' skipped.)' : '') + '\n\nFree, only hidden in this browser, Undo anytime, no burn.')) return; hideIds(ids); rev.eggs = rev.eggs.filter(function (id) { return ids.indexOf(id) < 0; }); if (rev.eggs.length) drawReveal(); else closeReveal(); };
  $('packDiscard').onclick = function () { if (!rev || rev.kind !== 'eggs') return; var ids = Object.keys(rev.sel).map(Number); if (!ids.length) return toast('Tick Discard on at least one pet first.');
    var kk = ids.filter(isKept); if (kk.length && !window.confirm(kk.length + ' of these ' + ids.length + ' pets ' + (kk.length > 1 ? 'are' : 'is') + ' starred as kept (' + idList(kk) + '). Discard them anyway?')) return;
    hideIds(ids); rev.eggs = rev.eggs.filter(function (id) { return ids.indexOf(id) < 0; }); rev.sel = {}; if (rev.eggs.length) drawReveal(); else closeReveal(); };
  $('txClose').onclick = function () { close('txBox'); };
  $('waitCancel').onclick = function () { close('waitOverlay'); };
  $('introSkip').onclick = function () { close('intro'); };
  $('replayIntro').onclick = function (e) { e.preventDefault(); var fr = commAnim && commAnim.fr ? commAnim.fr : WizardSprite.frames(world().community.wizardStage, '#2a3a2e'); R.animate($('introCv'), fr); /* current community pet (Nakamoto before The Return: no Wizard spoiler) */ $('introText').textContent = 'Welcome to XCPETS v2'; open('intro'); setTimeout(function () { close('intro'); }, 2500); };
  $('wdisconnect').onclick = function () { toast('Read-only build: open play.html?addr=YOUR_ADDRESS to view your pets'); };
  $('gWallet').onclick = function () { var b = $('gWallet'); if (!window.xcpwallet) { toast('XCP Wallet not found. Install the XCP Wallet Chrome extension, then refresh this page to connect.', 9000); return; }
    b.disabled = true; window.xcpwallet.request({ method: 'xcp_requestAccounts' }).then(function (r) { var a = (r && r.accounts && r.accounts[0]) || (Array.isArray(r) ? r[0] : null); b.disabled = false;
      if (!a) return toast('XCP Wallet returned no address.'); try { localStorage.setItem('xcpets-v2-me', a); localStorage.setItem('xcpets-xcpwallet-address', a); } catch (e) { }
      if (a !== ME) location.reload(); else toast('✓ XCP Wallet connected'); }, function (e) { b.disabled = false; toast(e && e.code === 4001 ? 'You cancelled in the wallet.' : 'XCP Wallet connect failed: ' + ((e && e.message) || 'try again')); }); };
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
  window.V2UI = { autoEquip: autoEquipIsOn, aeToggleHtml: aeToggleHtml, bindAeTogs: bindAeTogs, S: function () { return S; }, ME: ME, world: world, render: render, toast: toast, confirmPlans: confirmPlans, save: save, selUi: selUi, mine: mine, fighters: fighters, afterAccept: afterAccept, detail: function (id) { detailId = id; detail(world().byId[id]); }, petList: function (w) { var all = mine(w); return petList(all.filter(function (p) { return !p.dead; }), all.filter(function (p) { return p.dead; })); }, cem: function () { return cem; }, playFight: playFight };
  render(); route(); setInterval(function () { M.refresh(render); }, 60000); /* new confirmed burns (e.g. your roll result) */
  window.__demo = { S: function () { return S; }, world: world, render: render, toggle: toggle, detail: function (id) { detailId = id; detail(world().byId[id]); }, playFight: playFight, discardIds: discardIds, mine: mine, isKept: isKept, keptIds: keptIds, toggleKeep: toggleKeep, idList: idList, selUi: selUi, confirmPlans: confirmPlans };
})();
