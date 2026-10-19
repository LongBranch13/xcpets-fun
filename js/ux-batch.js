/* XCPETS ux-batch (2026-10-16, Jake approved): UI-only layer for play.html. Battle face-off card, selection bar, controls row, origin badges,
 * inventory paper-doll + bag + collection log, gear-roll odds / crates / reveal flair. Reads the replayed world through window.V2UI (js/v2.js)
 * and V2Rules helpers; every burn still goes through the existing v2.js buttons / confirmPlans with the exact same tags and amounts. */
(function () {
  'use strict';
  var V = window.V2Rules, U = window.V2UI, R = window.V2Render; if (!V || !U || !R) return;
  var $ = function (id) { return document.getElementById(id); }, ME = U.ME;
  var fmt = function (n) { n = Number(n); return n.toLocaleString('en-US', { maximumFractionDigits: Math.abs(n) >= 1 || n === 0 ? 2 : 8 }); }; /* >= 1: 2 decimals (hides float noise like 1,335,328.99999996) */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  var TL = V.TIER_LABELS, TID = ['common', 'uncommon', 'rare', 'legendary'], SL = V.slotLabel, SLOTS = V.V2_SLOTS, STATS = ['vigor', 'spark', 'grit', 'zoom', 'luck'];
  var LSK = 'xcpets-ux-' + (ME || 'anon');
  function load(k, d) { try { var v = JSON.parse(localStorage.getItem(LSK + '-' + k)); return v == null ? d : v; } catch (e) { return d; } }
  function store(k, v) { try { localStorage.setItem(LSK + '-' + k, JSON.stringify(v)); } catch (e) { } }
  function pill(t) { return '<span class="pill tier tier-' + TID[t] + '">' + TL[t] + '</span>'; }
  function spL(id) { return V.speciesLabel(id); }
  function power(p) { var s = p.stats || {}; return STATS.reduce(function (a, k) { return a + (s[k] || 0); }, 0); }
  function canvasFor(p, w, cls) { var c = document.createElement('canvas'); c.width = c.height = 32; c.className = cls || 'sprite'; R.lazy(c, function () { return R.petFrames(p, w); }, true); return c; }
  var lastW = null;

  // ================================================================ E. controls row (filters persist in this browser)
  var F = Object.assign({ q: '', sort: 'num', flip: false, min: 0, tier: 'all', origin: 'all', sp: 'all' }, load('filters', {}));
  function saveF() { store('filters', F); }
  function isHyb(p) { return !!(p.hybrid || (p.art && p.art.hybrid) || V.isHybrid(p.species)); }
  function originOf(p) { return isHyb(p) && p.parents ? 'hybrid' : p.parents && p.parents.length ? 'bred' : isHyb(p) ? 'hybrid' : 'hatched'; }
  function filtered() { return !!(F.q || F.min || F.tier !== 'all' || F.origin !== 'all' || (F.sp && F.sp !== 'all') || F.flip || F.sort !== 'num'); }
  /* species-sort (2026-10-19, display only): species filter (13 hatchable species + Hybrids, owner's counts) and 'Species (A–Z)' sort; the community Bitcoin Wizard is never listed */
  var SPF = ['pepe', 'wojak', 'chud', 'mumu', 'doge', 'peepo', 'bobo', 'sarutobi', 'lenny', 'snibby', 'kevin', 'dodo', 'nakamoto'];
  function spOf(p) { return isHyb(p) ? 'hybrid' : p.species; }
  function spName(id) { return id === 'hybrid' ? 'Hybrids' : id === 'kevin' ? 'Kevin' : spL(id); }
  function paintSpecies(pets) { var sel = $('fSpecies'); if (!sel) return; var c = { all: pets.length };
    pets.forEach(function (p) { var k = spOf(p); c[k] = (c[k] || 0) + 1; });
    var h = '<option value="all">All (' + fmt(c.all) + ')</option>' + SPF.concat(['hybrid']).map(function (k) { return '<option value="' + k + '">' + esc(spName(k)) + ' (' + fmt(c[k] || 0) + ')</option>'; }).join('');
    if (sel.__h !== h) { sel.innerHTML = h; sel.__h = h; } sel.value = F.sp || 'all'; }
  window.UXB = {};
  UXB.power = power; /* My Pets 'Power' sort: same measure as the ranking Power board and the fighter picker */
  UXB.filters = function () { var q = String(F.q || '').trim().toLowerCase().replace(/^#/, '');
    return { flip: !!F.flip, spKey: function (p) { return isHyb(p) ? '~' + spL(p.species).toLowerCase() : spL(p.species).toLowerCase(); }, keep: function (p) { if (p.tier < (F.min || 0)) return false; if (F.origin !== 'all' && originOf(p) !== F.origin) return false; if (F.sp && F.sp !== 'all' && spOf(p) !== F.sp) return false;
      if (q) { if (/^\d+$/.test(q)) return String(p.id) === q || String(p.id).indexOf(q) === 0; return String(p.name || '').toLowerCase().indexOf(q) >= 0 || spL(p.species).toLowerCase().indexOf(q) >= 0; } return true; } }; };
  function bindControls() {
    $('fSort').value = F.sort; $('fTier').value = F.tier; $('fMin').value = String(F.min); $('fOrigin').value = F.origin; $('fSearch').value = F.q; $('fHide').value = '-1'; if ($('fSpecies')) $('fSpecies').value = F.sp || 'all';
    function upd() { F.sort = $('fSort').value; F.tier = $('fTier').value; F.min = Number($('fMin').value) || 0; F.origin = $('fOrigin').value; F.q = $('fSearch').value; if ($('fSpecies')) F.sp = $('fSpecies').value; saveF(); U.render(); }
    ['fSort', 'fTier', 'fMin', 'fOrigin', 'fSpecies'].forEach(function (id) { $(id).onchange = upd; });
    var t; $('fSearch').oninput = function () { clearTimeout(t); t = setTimeout(upd, 200); };
    $('fDir').onclick = function () { F.flip = !F.flip; saveF(); U.render(); };
    $('fReset').onclick = function (e) { e.preventDefault(); F = { q: '', sort: 'num', flip: false, min: 0, tier: 'all', origin: 'all', sp: 'all' }; saveF(); bindControls(); U.render(); };
    $('ctlToggle').onclick = function () { var o = $('ctlRow').classList.toggle('open'); this.setAttribute('aria-expanded', String(o)); };
  }
  function paintControls(w) {
    var asc = F.sort === 'num' ? !F.flip : F.flip; $('fDir').textContent = asc ? '🔼' : '🔽'; $('fDir').title = F.sort === 'num' ? (asc ? 'Lowest number first' : 'Highest number first') : (F.flip ? 'Reversed' : 'Normal order');
    var alive = U.mine(w).filter(function (p) { return !p.dead; }); paintSpecies(U.cem() ? U.mine(w).filter(function (p) { return p.dead; }) : alive); var shown = U.cem() ? null : U.petList(w);
    $('fShowing').textContent = shown ? 'Showing ' + fmt(shown.length) + ' of ' + fmt(alive.length) + ' pets' : '';
    $('fReset').style.display = filtered() ? '' : 'none';
    $('ctlToggle').textContent = '⚙️ Filter & sort' + (filtered() ? ' •' : '');
  }

  // ================================================================ F. origin badges
  UXB.origin = function (p, w) { var o = originOf(p), par = p.parents || [];
    function lk(id) { var q = w.byId[id]; return '<a href="pet.html?id=' + id + '" data-jump="' + id + '">#' + id + '</a>' + (o === 'hybrid' && q ? ' ' + esc(spL(q.species)) : ''); }
    if (o === 'hatched') return '<span class="chip origin" title="Hatched from an egg burn">🥚 Hatched</span>';
    var two = par.length >= 2, bonus = p.breedBonus ? ' <span title="Bred true: same-species bonus (' + esc(p.breedBonus.kind || 'bonus') + ')">✨</span>' : '', R = window.V2Render;
    var bf = two && R && R.bredFrom ? R.bredFrom(w, p, true) : '';
    if (o === 'hybrid') return '<span class="chip origin hybrid">🧬 ' + (two ? lk(par[0]) + ' × ' + lk(par[1]) : 'Hybrid') + bonus + '</span>' + bf;
    if (bf) return bf.replace(/<\/span>$/, bonus + '</span>');
    return '<span class="chip origin bred">💞 Bred' + bonus + '</span>'; };
  function jump(id) { var c = document.querySelector('#pets .pet.card[data-pid="' + id + '"]'); if (c) { c.scrollIntoView({ block: 'center', behavior: 'smooth' }); c.classList.add('flash'); setTimeout(function () { c.classList.remove('flash'); }, 1600); } else U.detail(Number(id)); }

  // ================================================================ D. selection: tri-state, tap/shift-range, sticky bar with costs
  var lastTap = null;
  UXB.cardTap = function (id, e) { var S = U.S(), w = U.world(), list = U.petList(w).filter(function (p) { return !p.dead; }).map(function (p) { return p.id; });
    if (e && e.shiftKey && lastTap != null && list.indexOf(lastTap) >= 0 && list.indexOf(id) >= 0) { var a = list.indexOf(lastTap), b = list.indexOf(id), lo = Math.min(a, b), hi = Math.max(a, b), on = S.sel.indexOf(lastTap) >= 0;
      list.slice(lo, hi + 1).forEach(function (x) { var i = S.sel.indexOf(x); if (on && i < 0) S.sel.push(x); if (!on && i >= 0) S.sel.splice(i, 1); }); }
    else { var i = S.sel.indexOf(id); if (i >= 0) S.sel.splice(i, 1); else S.sel.push(id); }
    lastTap = id; U.save(); U.selUi(); };
  function sum(plans) { return plans.reduce(function (a, p) { return a + (Number(p.amount) || 0); }, 0); }
  UXB.sel = function () { var w = lastW || U.world(), S = U.S(), alive = U.mine(w).filter(function (p) { return !p.dead; }), shown = U.petList(w).filter(function (p) { return !p.dead; });
    var n = S.sel.length, onShown = shown.filter(function (p) { return S.sel.indexOf(p.id) >= 0; }).length, cb = $('selAll');
    cb.checked = shown.length > 0 && onShown === shown.length; cb.indeterminate = onShown > 0 && onShown < shown.length;
    $('selCount').textContent = fmt(n) + ' of ' + fmt(shown.length) + ' selected';
    var hungry = alive.filter(function (p) { return p.hungry; }), hq = V.feedQueue(w, ME, hungry.map(function (p) { return p.id; }));
    $('bFeedHungry').innerHTML = 'Feed all hungry <span class="cost">(' + fmt(hungry.length) + ' pet' + (hungry.length === 1 ? '' : 's') + ' · ' + fmt(sum(hq)) + ' XCPETS)</span>'; $('bFeedHungry').disabled = !hungry.length;
    var bar = $('selBar'); bar.hidden = !n; document.body.classList.toggle('has-sel', !!n);
    if ($('bRelease')) $('bRelease').disabled = !n; if ($('bRelease')) $('bRelease').title = n ? 'Release ' + n + ' selected pet' + (n === 1 ? '' : 's') + ' (a burn, final)' : 'Select pets first';
    if (!n) return;
    var ids = S.sel.slice(), fq = V.feedQueue(w, ME, ids), rn = Math.max(1, Math.min(10, Number($('rollN').value) || 1)), rq = V.rollQueue(w, ME, ids, rn);
    $('selBarCount').innerHTML = '<b>' + n + '</b> selected';
    $('bFeedSel').innerHTML = 'Feed selected <span class="cost">' + (fq.length ? fmt(fq.length) + ' pet' + (fq.length === 1 ? '' : 's') + ' · ' + fmt(sum(fq)) + ' XCPETS' : '') + '</span>'; $('bFeedSel').disabled = !fq.length;
    $('bRoll').innerHTML = 'Roll gear ×' + rn + ' <span class="cost">' + (rq.length ? fmt(rq.length) + ' roll' + (rq.length === 1 ? '' : 's') + ' · ' + fmt(sum(rq)) + ' XCPETS' : '345 XCPETS per roll · select pets first') + '</span>'; $('bRoll').disabled = !rq.length; $('bRoll').title = rq.length ? '' : 'Select one or more of your pets, then roll gear (345 XCPETS per roll)';
    var ae = V.autoEquipOps(w, ME, ids, S.tip); $('bAuto').innerHTML = '✨ Auto-equip <span class="cost">' + (ae.length ? ae.length + ' piece' + (ae.length === 1 ? '' : 's') + ' · free' : '') + '</span>'; $('bAuto').disabled = !ae.length;
    var why = []; if (!fq.length) why.push('Feed: none of them is hungry'); if (!rq.length) why.push('Roll: no living pet of yours selected'); if (!ae.length) why.push('Auto-equip: nothing better in your bag');
    $('selWhy').textContent = why.join(' · ');
  };
  function bindSel() {
    $('selAll').onchange = function () { var w = U.world(), S = U.S(), shown = U.petList(w).filter(function (p) { return !p.dead; }).map(function (p) { return p.id; });
      var all = shown.every(function (id) { return S.sel.indexOf(id) >= 0; });
      if (all) S.sel = S.sel.filter(function (id) { return shown.indexOf(id) < 0; }); else shown.forEach(function (id) { if (S.sel.indexOf(id) < 0) S.sel.push(id); });
      U.save(); U.selUi(); };
    $('rollN').oninput = function () { UXB.sel(); };
    $('pets').addEventListener('click', function (e) { var a = e.target.closest('[data-jump]'); if (!a) return; e.preventDefault(); e.stopPropagation(); jump(a.getAttribute('data-jump')); }, true);
  }

  // ================================================================ G. odds (computed from the live pool() + slot rules)
  function slotOdds(p, slot) { var P = V.pool(slot, p.species, p.tier), tot = P.reduce(function (a, e) { return a + e.w; }, 0), t = [0, 0, 0, 0], sig = 0, hat = 0;
    P.forEach(function (e) { t[e.it.tier] += e.w; if (e.it.exclusive) { sig += e.w; if (slot === 'head') hat += e.w; } });
    return { n: P.length, tot: tot, tier: t.map(function (x) { return tot ? x / tot : 0; }), sig: tot ? sig / tot : 0, hat: tot ? hat / tot : 0 }; }
  function oneIn(x) { return x > 0 ? '~1 in ' + fmt(Math.max(1, Math.round(1 / x))) : 'no chance'; }
  function oddsHtml(p, compact) { var open = p.openSlots || [], k = open.length || 1, sigHat = 0, sigAny = 0, rows = '';
    open.forEach(function (sl) { var o = slotOdds(p, sl); sigHat += o.hat / k; sigAny += o.sig / k;
      rows += '<tr><td>' + esc(SL(sl)) + '</td>' + o.tier.map(function (x, i) { return '<td class="num t' + i + '">' + (x ? (x * 100).toFixed(x < 0.1 ? 1 : 0) + '%' : '–') + '</td>'; }).join('') + '<td class="num">' + o.n + '</td></tr>'; });
    var lead = p.tier === 3 ? 'Next roll: <b>' + oneIn(sigHat) + '</b> for your signature hat · ' + oneIn(sigAny) + ' for any ★ piece' : '★ signature pieces only roll on Legendary pets. This ' + TL[p.tier] + ' pet rolls gear up to ' + TL[p.tier] + '.';
    var locked = SLOTS.filter(function (s) { return open.indexOf(s) < 0; });
    return '<div class="oddsbox' + (compact ? ' compact' : '') + '"><div class="small">🎲 ' + lead + '</div>' + (compact ? '' : '<div class="small muted">Each roll picks one of the ' + k + ' open slot' + (k === 1 ? '' : 's') + ' at random (' + (100 / k).toFixed(0) + '% each), then a piece by weight. Owning copies makes repeats a bit rarer (×0.9 per copy).</div>') +
      '<div class="tw"><table class="odds small"><tr><th>Slot</th><th class="num">C</th><th class="num">U</th><th class="num">R</th><th class="num">L</th><th class="num">pieces</th></tr>' + rows + '</table></div>' + (locked.length && !compact ? '<div class="small muted">Locked: ' + locked.map(SL).join(', ') + '</div>' : '') + '</div>'; }
  UXB.petOdds = function (p, w) { return '<details class="oddsdet"><summary class="small">🎲 Gear roll odds for #' + p.id + '</summary>' + oddsHtml(p) + '</details>'; };
  UXB.confirmExtra = function (plans, w) { w = w || U.world(); var out = '';
    var rolls = plans.filter(function (x) { return /^pet:(roll|fr|of):\d+$/.test(x.tag); });
    if (rolls.length) { var ids = []; rolls.forEach(function (x) { var id = Number(x.tag.split(':')[2]); if (ids.indexOf(id) < 0) ids.push(id); });
      out += '<div class="small grwhat"><b>🎲 What you get:</b> ' + (rolls.length === 1 ? 'one random gear piece' : rolls.length + ' random gear pieces, one per roll') + ', for the pet named in each burn. ' + (U.autoEquip && U.autoEquip() ? 'Auto-equip is on: a new piece is worn right away unless the pet already wears something better.' : 'New pieces go to your bag (Auto-equip is off); equip them from Inventory (free).') + '</div><div class="small muted">🎁 Your gear arrives once the burn confirms, usually in about 10 minutes.</div>' +
        '<div class="small"><b>🎲 Your odds</b> (per roll)</div>' + ids.slice(0, 3).map(function (id) { var p = w.byId[id]; return p ? '<div class="small">#' + id + ' ' + esc(p.name) + ' ' + pill(p.tier) + '</div>' + oddsHtml(p, true) : ''; }).join('') + (ids.length > 3 ? '<div class="small muted">… and ' + (ids.length - 3) + ' more pets</div>' : '') +
        ''; }
    if (plans.some(function (x) { return /^pet:c:roll/.test(x.tag); })) out += '<div class="small grwhat"><b>🎲 What you get:</b> the community pet gets one random gear piece and wears it right away. A new piece replaces the one in that slot. It shows once the burn confirms, usually in about 10 minutes.</div>';
    var rel = plans.filter(function (x) { return /^pet:rel/.test(x.tag); });
    if (rel.length) { var S = U.S(), names = S.sel.map(function (id) { var p = w.byId[id]; return p ? '#' + id + ' ' + esc(p.name) + ' (' + TL[p.tier] + ' ' + esc(spL(p.species)) + ')' : '#' + id; });
      out += '<div class="relwarn"><b>🔥 Releasing ' + names.length + ' pet' + (names.length === 1 ? '' : 's') + ':</b> ' + names.slice(0, 30).join(', ') + (names.length > 30 ? ' … +' + (names.length - 30) + ' more' : '') + '<br><b>Burns are final.</b> Released pets are gone for good and cannot be restored.</div>'; }
    return out; };

  // pending crates: our unconfirmed pet:roll burns (this browser's tracker + node mempool)
  function pendingRolls() { var S = U.S(), conf = {}, out = [], seen = {}; (S.rows || []).forEach(function (r) { conf[r.tx_hash] = 1; });
    function add(tx, tag, at) { var m = /^pet:(roll|fr|of):(\d+)$/.exec(String(tag)), c = /^pet:c:roll/.test(String(tag)); if (!tx || seen[tx] || conf[tx] || !(m || c)) return; seen[tx] = 1; out.push({ tx: tx, id: m ? Number(m[2]) : null, community: c, kind: m ? m[1] : 'croll', at: at }); }
    try { if (window.V2Wallet && V2Wallet.tracker) V2Wallet.tracker.list().forEach(function (t) { if (t.status !== 'confirmed') add(t.txid, t.tag, t.at); }); } catch (e) { }
    (S.mempool || []).forEach(function (x) { if (x.source === ME) add(x.tx_hash, x.tag, x.at); }); return out; }
  function paintAeRow() { var inv = $('invPanel'); if (!inv || $('aeRow') || !U.aeToggleHtml) return; var d = document.createElement('div'); d.id = 'aeRow'; d.className = 'aerow'; d.innerHTML = U.aeToggleHtml();
    var h = inv.querySelector('h2'); inv.insertBefore(d, h ? h.nextSibling : inv.firstChild); U.bindAeTogs(d); }
  function paintCrates(w) { paintAeRow(); var box = $('crates'); if (!box) { box = document.createElement('div'); box.id = 'crates'; box.className = 'crates'; var inv = $('invPanel'); inv.insertBefore(box, inv.querySelector('.statline')); }
    var L = pendingRolls(); box.hidden = !L.length;
    box.innerHTML = L.length ? '<div class="small"><b>🎁 Gear on the way: ' + L.length + ' roll' + (L.length === 1 ? '' : 's') + '</b> · each piece arrives once its burn confirms, usually in about 10 minutes.</div><div class="cratelist">' + L.slice(0, 24).map(function (c) { var p = c.id != null ? w.byId[c.id] : null;
      return '<div class="crate" title="' + (c.community ? 'Community gear roll' : 'Gear roll for #' + c.id) + ' · tx ' + esc(c.tx.slice(0, 10)) + '…"><span class="box8">📦</span><span class="small">' + (c.community ? 'Community pet' : '#' + c.id + (p ? ' ' + esc(p.name) : '')) + '</span></div>'; }).join('') + '</div>' : ''; }
  /** pendingFor(petId): this pet's gear rolls still waiting to confirm (for the pet detail's pending line). */
  UXB.pendingFor = function (petId) { return pendingRolls().filter(function (c) { return c.id === petId; }).length; };
  /* gear results (2026-10-19): cards only flash/glow by tier; the meme caption is ONE line for the whole batch (v2.js UXB_CAP, best piece),
   * never per card (per-card captions used the global .meme headline style: 34-64px Bangers with a 4px shadow, so they overlapped the cards). */
  UXB.revealCard = function (d, x, w) { var t = x.legendary ? 3 : x.tier || 0; d.classList.add('ux-flash', 'ux-t' + t); if (x.legendary) d.classList.add('ux-fanfare'); };

  UXB.revealDone = function () { }; /* the red "replaced your … / better piece in your bag" notice is gone (2026-10-19): the popup says where each piece went instead */

  // ================================================================ C. inventory: lucky drops, paper-doll, bag, collection log
  var IV = Object.assign({ view: 'bag', filter: 'all', slot: 'all', pet: null }, load('inv', {}));
  function saveIV() { store('inv', IV); }
  var COND = [['age', 2, '2 days old'], ['age', 5, '5 days old'], ['age', 10, '10 days old'], ['fed', 0.5, 'fed on 50% of its days'], ['fed', 0.8, 'fed on 80% of its days (min 3 fed days)']];
  function unmet(p) { var age = p.ageDays || 0, fd = p.fedDays || 0, ratio = fd / Math.max(1, age + 1);
    return COND.filter(function (c) { return c[0] === 'age' ? age < c[1] : c[1] === 0.5 ? !(ratio >= 0.5 && fd >= 1) : !(ratio >= 0.8 && fd >= 3); }).map(function (c) { return c[2]; }); }
  function srcLabel(g) { return { roll: '🎲 gear roll', token: '🎟️ lucky drop', live: '⛓️ v1 game', froll: '🎁 free roll', oroll: '🎁 overflow roll', founder: '🥇 founder kit', trophy: '🏆 trophy', fight: '⚔️ battle spoils' }[g.src] || (g.src ? esc(g.src) : 'unknown'); }
  function invPets(w) { return U.mine(w).filter(function (p) { return !p.dead; }); }
  function paintInv(w) {
    var box = $('inv'); if (!box) return; var items = w.itemList.filter(function (g) { return g.owner === ME; }), pets = invPets(w), S = U.S();
    $('tokens').textContent = String(V.tokensOf(w, ME));
    if (IV.pet == null || !w.byId[IV.pet] || w.byId[IV.pet].owner !== ME) IV.pet = (S.sel[0] != null && w.byId[S.sel[0]]) ? S.sel[0] : (pets[0] && pets[0].id);
    var p = w.byId[IV.pet], h = '';
    h += '<div class="pettabs invtabs" role="tablist"><button type="button" class="tab' + (IV.view === 'bag' ? ' on' : '') + '" data-iv="bag">🎒 My gear</button><button type="button" class="tab' + (IV.view === 'log' ? ' on' : '') + '" data-iv="log">📖 Collection log</button></div>';
    if (IV.view === 'bag') {
      if (p) { var nm = p.capacity < 6 ? unmet(p) : [];
        h += '<div class="doll"><div class="dollhead"><label class="small">Pet <select id="ivPet" class="pick">' + pets.slice(0, 2000).map(function (q) { return '<option value="' + q.id + '"' + (q.id === p.id ? ' selected' : '') + '>#' + q.id + ' ' + esc(q.name) + ' · ' + TL[q.tier] + '</option>'; }).join('') + '</select></label> <span class="small muted">' + V.wornOf(w, p.id).length + '/' + p.capacity + ' slots open</span></div><div class="dollrow"><canvas id="ivSprite" width="32" height="32" class="sprite big"></canvas><div class="dollslots">' +
          SLOTS.map(function (sl, i) { var g = V.wornOf(w, p.id).filter(function (x) { return x.slot === sl; })[0], locked = p.openSlots.indexOf(sl) < 0;
            var need = locked ? (i - p.capacity === 0 ? 'Unlocks at ' + (nm.length ? nm.join(' or ') : 'next milestone') : 'Needs ' + (i - p.capacity + 1) + ' more of: ' + nm.join(', ')) : '';
            return '<button type="button" class="dslot' + (locked ? ' locked' : '') + (g ? ' t' + (g.legendary ? 3 : g.tier) : '') + (IV.slot === sl ? ' on' : '') + '" data-dslot="' + sl + '" title="' + esc(locked ? need : g ? g.label : 'empty') + '"><span class="dl">' + esc(SL(sl)) + '</span>' + (g ? '<span class="gi" data-icon="' + esc(g.item) + '"></span><span class="small">' + esc(g.label) + (g.legendary ? ' ★' : '') + '</span>' : locked ? '<span class="small muted">🔒 ' + esc(need) + '</span>' : '<span class="small muted">empty</span>') + '</button>'; }).join('') + '</div></div></div>'; }
      h += '<div class="chips slotfilter">' + [['all', 'All'], ['worn', 'Worn'], ['bag', 'In bag'], ['star', '★']].map(function (f) { return '<button type="button" class="q' + (IV.filter === f[0] ? ' on' : '') + '" data-if="' + f[0] + '">' + f[1] + '</button>'; }).join('') + ' · <button type="button" class="q' + (IV.slot === 'all' ? ' on' : '') + '" data-is="all">All slots</button>' + SLOTS.map(function (sl) { return '<button type="button" class="q' + (IV.slot === sl ? ' on' : '') + '" data-is="' + sl + '">' + esc(SL(sl)) + '</button>'; }).join('') + '</div>';
      var groups = {}; items.forEach(function (g) { if (IV.slot !== 'all' && g.slot !== IV.slot) return; if (IV.filter === 'worn' && g.on == null) return; if (IV.filter === 'bag' && g.on != null) return; if (IV.filter === 'star' && !g.legendary) return;
        var k = g.item; (groups[k] = groups[k] || { item: g.item, label: g.label, slot: g.slot, tier: g.tier || 0, legendary: g.legendary, copies: [] }).copies.push(g); });
      var G = Object.keys(groups).map(function (k) { return groups[k]; }).sort(function (a, b) { return (b.legendary ? 4 : b.tier) - (a.legendary ? 4 : a.tier) || SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot) || (a.label < b.label ? -1 : 1); });
      h += G.length ? '<div class="baggrid">' + G.map(function (g) { var worn = g.copies.filter(function (c) { return c.on != null; }).length;
        return '<button type="button" class="bagitem t' + (g.legendary ? 3 : g.tier) + '" data-bag="' + esc(g.item) + '" title="' + esc(g.label) + ' · ' + esc(SL(g.slot)) + ' · ' + TL[g.tier] + (window.V2Rules && V2Rules.lockHint && V2Rules.lockHint(g.item) ? ' · ' + esc(V2Rules.lockHint(g.item)) : '') + '"><span class="gi" data-icon="' + esc(g.item) + '"></span><span class="bl">' + esc(g.label) + (g.legendary ? ' ★' : '') + '</span>' + (g.copies.length > 1 ? '<span class="cnt">×' + g.copies.length + '</span>' : '') + (worn ? '<span class="wn">' + worn + ' worn</span>' : '') + '</button>'; }).join('') + '</div>'
        : '<p class="muted small">' + (items.length ? 'Nothing matches this filter.' : 'No gear yet. Select a pet and Roll gear, or feed it: stage-ups and meals can bring a lucky drop.') + '</p>';
    } else {
      var cat = V.catalogBySlot(), own = {}; items.forEach(function (g) { own[g.item] = (own[g.item] || 0) + 1; }); var found = 0, total = 0;
      var body = SLOTS.map(function (sl) { var L = (cat[sl] || []).filter(function (it) { return !it.exclusive || !p || true; }); var f = L.filter(function (it) { return own[it.id]; }).length; found += f; total += L.length;
        return '<div class="invslot">' + esc(SL(sl)) + ' · ' + f + '/' + L.length + ' found</div><div class="loggrid">' + L.map(function (it) { var o = own[it.id];
          return '<span class="logitem' + (o ? ' t' + (it.exclusive ? 3 : it.tier || 0) : ' unfound') + '" title="' + esc(o ? it.label + ' · ' + TL[it.tier || 0] + (it.exclusive ? ' · ' + spL(it.origin) + ' ★' : '') + ' · ×' + o : (it.exclusive ? spL(it.origin) + ' ★ signature, ' : '') + TL[it.tier || 0] + ' · not found yet') + '"><span class="gi" data-icon="' + esc(it.id) + '"></span>' + (o ? '' : '<span class="q8">?</span>') + '</span>'; }).join('') + '</div>'; }).join('');
      h += '<p class="small"><b>' + found + ' / ' + total + '</b> pieces found (' + (100 * found / Math.max(1, total)).toFixed(1) + '%). ★ signature pieces only roll on Legendary pets of that species.</p>' + body;
    }
    box.innerHTML = h;
    box.querySelectorAll('.gi[data-icon]').forEach(function (s) { s.appendChild(R.iconCanvas(s.getAttribute('data-icon'), '')); });
    if ($('ivSprite') && p) { var fr = R.petFrames(p, w); R.paint($('ivSprite'), fr[0]); R.animate($('ivSprite'), fr); }
    box.querySelectorAll('[data-iv]').forEach(function (b) { b.onclick = function () { IV.view = b.dataset.iv; saveIV(); paintInv(U.world()); }; });
    box.querySelectorAll('[data-if]').forEach(function (b) { b.onclick = function () { IV.filter = b.dataset.if; saveIV(); paintInv(U.world()); }; });
    box.querySelectorAll('[data-is]').forEach(function (b) { b.onclick = function () { IV.slot = b.dataset.is; saveIV(); paintInv(U.world()); }; });
    box.querySelectorAll('[data-dslot]').forEach(function (b) { b.onclick = function () { IV.slot = IV.slot === b.dataset.dslot ? 'all' : b.dataset.dslot; saveIV(); paintInv(U.world()); }; });
    if ($('ivPet')) $('ivPet').onchange = function () { IV.pet = Number(this.value); saveIV(); paintInv(U.world()); };
    box.querySelectorAll('[data-bag]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); popover(b, b.dataset.bag); }; });
  }
  function equipOp(petId, slot, gid, msg) { var S = U.S(); S.ops.push({ kind: 'equip', owner: ME, petId: petId, slot: slot, gid: gid, block_index: S.tip }); U.save(); U.render(); U.toast(esc(msg) + ' (free)'); }
  function popover(anchor, itemId) { closePop(); var w = U.world(), it = V.GEAR_BY_ID[itemId] || {}, copies = w.itemList.filter(function (g) { return g.owner === ME && g.item === itemId; }), pets = invPets(w);
    var free = copies.filter(function (g) { return g.on == null; }), p0 = IV.pet != null ? IV.pet : pets[0] && pets[0].id;
    var d = document.createElement('div'); d.className = 'invpop'; d.id = 'invPop'; d.setAttribute('role', 'dialog');
    d.innerHTML = '<button type="button" class="q pclose" aria-label="Close">✕</button><div class="ph"><span class="gi"></span><div><b>' + esc(it.label || itemId) + (it.exclusive ? ' ★' : '') + '</b><div class="small">' + esc(SL(it.slot)) + ' · ' + pill(it.tier || 0) + (it.exclusive ? ' · ' + esc(spL(it.origin)) + '-only signature' : '') + (window.V2Rules && V2Rules.lockHint && V2Rules.lockHint(itemId) ? ' · ' + esc(V2Rules.lockHint(itemId)) : '') + '</div></div></div>' +
      '<div class="small"><b>You own ' + copies.length + '</b>: ' + copies.map(function (g) { return (g.on != null ? 'worn by <a href="#" data-pj="' + g.on + '">#' + g.on + '</a>' : '🎒 in bag') + ' · ' + srcLabel(g); }).join('<br>') + '</div>' +
      '<div class="row pact"><label class="small">Equip on <select id="popPet" class="pick">' + pets.slice(0, 2000).map(function (q) { return '<option value="' + q.id + '"' + (q.id === p0 ? ' selected' : '') + '>#' + q.id + ' ' + esc(q.name) + '</option>'; }).join('') + '</select></label><button type="button" class="btn" id="popEq">Equip</button></div><div class="small warn" id="popWhy"></div>' +
      (copies.some(function (g) { return g.on != null; }) ? '<div class="row">' + copies.filter(function (g) { return g.on != null; }).slice(0, 6).map(function (g) { return '<button type="button" class="q" data-off="' + g.gid + '" data-pid="' + g.on + '">Take off #' + g.on + '</button>'; }).join('') + '</div>' : '');
    document.body.appendChild(d); d.querySelector('.gi').appendChild(R.iconCanvas(itemId, ''));
    var r = anchor.getBoundingClientRect(); d.style.top = Math.min(window.innerHeight - 20, r.bottom + 6) + window.scrollY + 'px'; d.style.left = Math.max(8, Math.min(window.innerWidth - 330, r.left)) + window.scrollX + 'px';
    function check() { var pid = Number($('popPet').value), c = V.equipCheck(U.world(), ME, pid, itemId), why = c.ok ? (free.length || c.gid ? '' : '') : (c.worn ? 'Already wearing it.' : c.why);
      $('popWhy').textContent = why ? '✋ ' + why : ''; $('popEq').disabled = !c.ok; return c; }
    $('popPet').onchange = check; check();
    $('popEq').onclick = function () { var pid = Number($('popPet').value), c = check(); if (!c.ok) return; closePop(); equipOp(pid, it.slot, c.gid, 'Equipped ' + (it.label || itemId) + ' on #' + pid + (c.from ? ' (moved from #' + c.from + ')' : '')); };
    d.querySelectorAll('[data-off]').forEach(function (b) { b.onclick = function () { closePop(); equipOp(Number(b.dataset.pid), it.slot, null, 'Took ' + (it.label || itemId) + ' off #' + b.dataset.pid); }; });
    d.querySelectorAll('[data-pj]').forEach(function (a) { a.onclick = function (e) { e.preventDefault(); closePop(); U.detail(Number(a.dataset.pj)); }; });
    d.querySelector('.pclose').onclick = closePop; }
  function closePop() { var d = $('invPop'); if (d) d.remove(); }
  document.addEventListener('click', function (e) { var d = $('invPop'); if (d && !d.contains(e.target)) closePop(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePop(); });
  function bindTokens() { $('tokStat').onclick = function () { var L = $('tokList'), w = U.world(); if (!L.hidden) { L.hidden = true; return; }
    var T = w.itemList.filter(function (g) { return g.owner === ME && g.src === 'token'; });
    L.innerHTML = T.length ? '<div class="small"><b>🎟️ Lucky drops</b> · each one was rolled and worn the moment it dropped:</div><div class="baggrid">' + T.slice(0, 300).map(function (g) { return '<span class="bagitem t' + (g.legendary ? 3 : g.tier || 0) + '"><span class="gi" data-icon="' + esc(g.item) + '"></span><span class="bl">' + esc(g.label) + (g.legendary ? ' ★' : '') + '</span><span class="wn">' + (g.on != null ? 'on #' + g.on : '🎒') + (g.rolledOn != null ? ' · from #' + g.rolledOn : '') + '</span></span>'; }).join('') + '</div>'
      : '<p class="small muted">' + (V.tokensOf(w, ME) ? 'Your lucky drops came from the v1 game; their pieces are mixed into your bag.' : 'No lucky drops yet. Each stage-up has a 25% chance and each meal 2%.') + '</p>';
    L.querySelectorAll('.gi[data-icon]').forEach(function (s) { s.appendChild(R.iconCanvas(s.getAttribute('data-icon'), '')); }); L.hidden = false; }; }

  // ================================================================ A. battle face-off card
  var FO = { a: null, b: null }, IGN = load('ignored', []);
  function today(w) { return V.day(U.S().tip || w.tip || 0); }
  function whyNot(p, w) { var f = V.fightable ? V.fightable(p) : null; if (p.dead) return 'dead'; if (p.released) return 'released'; if (p.stage < 2) return 'not Juvenile yet'; if (p.neglected) return 'neglected'; if (p.fightDays && p.fightDays[today(w)]) return 'fought today'; return f; }
  function side(p, w, mine, other) { if (!p) return '<button type="button" class="fside empty" data-side="' + (mine ? 'a' : 'b') + '"><span class="big">＋</span><span>' + (mine ? 'Pick your pet' : 'Pick an opponent') + '</span></button>';
    var g = V.wornOf(w, p.id), why = whyNot(p, w);
    return '<button type="button" class="fside t' + p.tier + (why ? ' no' : '') + '" data-side="' + (mine ? 'a' : 'b') + '" aria-label="' + (mine ? 'Change your pet' : 'Change opponent') + '"><span class="fsp" data-fsp="' + p.id + '"></span><span class="fn"><b>' + esc(p.name) + '</b> <span class="muted">#' + p.id + '</span>' + (p.blackEye ? ' 🤕' : '') + '</span><span class="small">' + pill(p.tier) + ' ' + esc(spL(p.species)) + ' · ' + p.stageName + '</span><span class="fpow">⚡ ' + power(p) + ' Power</span>' +
      '<span class="fstats">' + STATS.map(function (k) { var v = (p.stats || {})[k] || 0, o = other ? (other.stats || {})[k] || 0 : 0; return '<span class="fst"><span class="sk">' + k.slice(0, 3).toUpperCase() + '</span><span class="fb"><i class="' + (other && v > o ? 'up' : other && v < o ? 'dn' : '') + '" style="width:' + Math.min(100, 100 * v / 35).toFixed(0) + '%"></i></span><b>' + v + '</b></span>'; }).join('') + '</span>' +
      '<span class="fgear">' + (g.length ? g.map(function (x) { return '<span class="gi" data-icon="' + esc(x.item) + '" title="' + esc(x.label) + (x.legendary ? ' ★ (safe)' : '') + '"></span>'; }).join('') : '<span class="small muted">no gear worn</span>') + '</span>' + (why ? '<span class="small warn">✋ ' + esc(why) + '</span>' : '') + (mine ? '<span class="fchg">✎ Change</span>' : '') + '</button>'; }
  function paintFace(w) { var box = $('faceoff'); if (!box) return; var mine = U.mine(w).filter(function (p) { return !p.dead; });
    if (FO.a && (!w.byId[FO.a] || w.byId[FO.a].owner !== ME)) FO.a = null; if (FO.b && (!w.byId[FO.b] || w.byId[FO.b].owner === ME)) FO.b = null;
    /* 2026-10-19: no default pet on your side. It used to auto-pick your first eligible fighter (lowest pet number), which hid that the card opens the picker.
     * Your side now starts empty ('Pick your pet') unless you arrived with a pet on purpose (UXB.battleWith / play.html#battle-ID). */
    if (FO.want != null) { var wp = w.byId[FO.want]; if (wp && wp.owner === ME && !wp.dead && !wp.released) { FO.a = wp.id; FO.want = null; var bp = $('battlePanel'); if (bp) setTimeout(function () { bp.scrollIntoView(); }, 0); } }
    var A = FO.a && w.byId[FO.a], B = FO.b && w.byId[FO.b], okA = A && !whyNot(A, w), okB = B && !whyNot(B, w);
    var inc = (w.fights || []).filter(function (f) { var q = w.byId[f.b]; return f.status === 'open' && q && q.owner === ME && IGN.indexOf(f.id) < 0; });
    var h = '<div class="fcard"><div class="fgrid">' + side(A, w, true, B) + '<div class="vs" aria-hidden="true">VS</div>' + side(B, w, false, A) + '</div>' +
      '<button type="button" class="btn ico-flame fgo" id="foGo"' + (okA && okB ? '' : ' disabled') + '>' + (!A ? 'Pick your pet first' : B ? 'Challenge #' + B.id + ' · burn 690 XCPETS' : 'Pick an opponent to challenge') + '</button>' + (A && B && (!okA || !okB) ? '<div class="small warn">✋ ' + esc(!okA ? 'Your pet: ' + whyNot(A, w) : 'Opponent: ' + whyNot(B, w)) + '</div>' : '') + '</div>';
    if (inc.length) h += '<h3 class="sec" data-ico="sword">Incoming challenges (' + inc.length + ')</h3>' + inc.slice(0, 10).map(function (f) { var X = w.byId[f.b], Y = w.byId[f.a];
      return '<div class="fcard inc"><div class="fgrid">' + side(X, w, true, Y).replace('data-side="a"', 'data-noside="1"').replace('<span class="fchg">✎ Change</span>', '') + '<div class="vs">VS</div>' + side(Y, w, false, X).replace('data-side="b"', 'data-noside="1"') + '</div><div class="small fstake">Fight ' + f.id + ' · accept by block ' + fmt(f.expires) + ' · loser gives 1 random worn piece, ★ safe</div><div class="row"><button type="button" class="btn ico-flame" data-facc="' + f.id + '">Accept (' + fmt(V.COSTS.accept) + ')</button><button type="button" class="q" data-fign="' + f.id + '">Ignore</button></div></div>'; }).join('');
    box.innerHTML = h;
    box.querySelectorAll('[data-fsp]').forEach(function (s) { var p = w.byId[s.getAttribute('data-fsp')]; s.appendChild(canvasFor(p, w, 'sprite big')); });
    box.querySelectorAll('.gi[data-icon]').forEach(function (s) { s.appendChild(R.iconCanvas(s.getAttribute('data-icon'), '')); });
    box.querySelectorAll('[data-side]').forEach(function (b) { b.onclick = function () { picker(b.dataset.side); }; });
    $('foGo').onclick = function () { var a = FO.a, b = FO.b; if (!a || !b) return; var sa = $('fMine'), sb = $('fTheirs');
      if (!Array.prototype.some.call(sa.options, function (o) { return o.value === String(a); }) || !Array.prototype.some.call(sb.options, function (o) { return o.value === String(b); })) return U.toast('That pair can’t fight right now');
      sa.value = String(a); sb.value = String(b); $('fGo').click(); };
    box.querySelectorAll('[data-facc]').forEach(function (b) { b.onclick = function () { var id = b.dataset.facc; U.confirmPlans('Accept fight ' + id, [{ tag: 'pet:accept:' + id, amount: 690 }], function () { U.afterAccept(id); }); }; });
    box.querySelectorAll('[data-fign]').forEach(function (b) { b.onclick = function () { IGN.push(Number(b.dataset.fign)); store('ignored', IGN); paintFace(U.world()); U.toast('Ignored here. It expires on its own if nobody accepts.'); }; }); }
  function picker(sideId) { var w = U.world(), mineSide = sideId === 'a', L = w.pets.filter(function (p) { return (mineSide ? p.owner === ME : p.owner !== ME) && !p.dead && !p.released; });
    var m = document.createElement('div'); m.className = 'fpick on'; m.id = 'fPick'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-label', mineSide ? 'Pick your pet' : 'Pick an opponent');
    m.innerHTML = '<div class="box"><div class="row"><b>' + (mineSide ? 'Pick your fighter' : 'Pick an opponent') + '</b><input type="search" id="fpQ" class="amt" placeholder="# or name" aria-label="Search"><select id="fpS" class="pick" aria-label="Sort"><option value="pow">Power</option><option value="tier">Rarest</option><option value="num">Pet number</option><option value="stage">Stage</option></select><label class="small"><input type="checkbox" id="fpOk" checked> Eligible only</label><button type="button" class="q" id="fpX">✕</button></div><div class="fpgrid" id="fpG"></div></div>';
    document.body.appendChild(m);
    function draw() { var q = $('fpQ').value.trim().toLowerCase().replace(/^#/, ''), s = $('fpS').value, ok = $('fpOk').checked;
      var X = L.filter(function (p) { return (!q || String(p.id).indexOf(q) === 0 || String(p.name || '').toLowerCase().indexOf(q) >= 0) && (!ok || !whyNot(p, w)); });
      X.sort(function (a, b) { return s === 'pow' ? power(b) - power(a) : s === 'tier' ? b.tier - a.tier || power(b) - power(a) : s === 'stage' ? b.stage - a.stage || power(b) - power(a) : a.id - b.id; });
      $('fpG').innerHTML = X.slice(0, 120).map(function (p) { var why = whyNot(p, w); return '<button type="button" class="fpc t' + p.tier + (why ? ' no' : '') + '" data-pk="' + p.id + '"' + (why ? ' aria-disabled="true"' : '') + '><span class="fsp" data-fsp="' + p.id + '"></span><b>#' + p.id + ' ' + esc(p.name) + '</b><span class="small">' + TL[p.tier] + ' ' + esc(spL(p.species)) + ' · ' + p.stageName + '</span><span class="small">⚡ ' + power(p) + (p.blackEye ? ' · 🤕' : '') + '</span>' + (why ? '<span class="small warn">' + esc(why) + '</span>' : '') + '</button>'; }).join('') + (X.length > 120 ? '<p class="small muted">Showing 120 of ' + X.length + '. Search to narrow down.</p>' : '') + (X.length ? '' : '<p class="small muted">No pet matches.</p>');
      $('fpG').querySelectorAll('[data-fsp]').forEach(function (s2) { s2.appendChild(canvasFor(w.byId[s2.getAttribute('data-fsp')], w, 'sprite')); });
      $('fpG').querySelectorAll('[data-pk]').forEach(function (b) { b.onclick = function () { if (b.getAttribute('aria-disabled')) return; FO[sideId] = Number(b.dataset.pk); m.remove(); paintFace(U.world()); }; }); }
    $('fpQ').oninput = draw; $('fpS').onchange = draw; $('fpOk').onchange = draw; $('fpX').onclick = function () { m.remove(); }; m.onclick = function (e) { if (e.target === m) m.remove(); }; draw(); $('fpQ').focus(); }

  /* arrived with a pet on purpose (e.g. a future pet-page 'Battle' button linking to play.html#battle-ID): keep that pet on your side */
  UXB.battleWith = function (id) { FO.want = Number(id); var w = U.world(); if (w) paintFace(w); return true; };
  function battleRoute() { var m = /^#battle-(\d+)$/.exec(location.hash); if (m) UXB.battleWith(Number(m[1])); }
  window.addEventListener('hashchange', battleRoute);

  // ================================================================ wiring
  UXB.after = function (w) { lastW = w; paintControls(w); UXB.sel(); paintInv(w); paintFace(w); paintCrates(w); };
  bindControls(); bindSel(); bindTokens();
  U.render(); battleRoute();
})();
