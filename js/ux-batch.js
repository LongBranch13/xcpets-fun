/* XCPETS ux-batch (2026-10-16, Jake approved): UI-only layer for play.html. Battle face-off card, selection bar, controls row, origin badges,
 * inventory paper-doll + bag + collection log, gear-roll odds / crates / reveal flair. Reads the replayed world through window.V2UI (js/v2.js)
 * and V2Rules helpers; every burn still goes through the existing v2.js buttons / confirmPlans with the exact same tags and amounts. */
(function () {
  'use strict';
  /* power-tooltip-values (Oct 25 2026, display only): hovers show the pet's real numbers (js/v2-power-tip.js) */
  function ptA(p) { return window.V2PowerTip ? V2PowerTip.attr(V2PowerTip.power(p)) : ''; } 
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
  /* species-sort (2026-10-19, display only): species filter (13 hatchable species + Hybrids, owner's counts) and 'Species' sort; the community Bitcoin Wizard is never listed (he isn't an owned pet); owned player Wizards are (wiz-display-fix) */
  var SPF = ['bobo', 'chud', 'dodo', 'doge', 'kevin', 'lenny', 'mumu', 'nakamoto', 'peepo', 'pepe', 'sarutobi', 'snibby', 'wojak'];
  function spOf(p) { return isHyb(p) ? 'hybrid' : p.species; }
  function spName(id) { return id === 'hybrid' ? 'Hybrids' : id === 'kevin' ? 'Kevin' : spL(id); }
  function paintSpecies(pets) { var sel = $('fSpecies'); if (!sel) return; var c = { all: pets.length };
    pets.forEach(function (p) { var k = spOf(p); c[k] = (c[k] || 0) + 1; });
    /* wiz-display-fix (Oct 20 2026, display only): player Bitcoin Wizards / Lord Kek / any other non-hybrid species the list doesn't know get an option when owned */
    var extra = Object.keys(c).filter(function (k) { return k !== 'all' && k !== 'hybrid' && SPF.indexOf(k) < 0; }), list = SPF.concat(extra).sort(function (a, b) { return spName(a).toLowerCase() < spName(b).toLowerCase() ? -1 : 1; });
    var h = '<option value="all">All (' + fmt(c.all) + ')</option>' + list.concat(['hybrid']).map(function (k) { return '<option value="' + k + '">' + esc(spName(k)) + ' (' + fmt(c[k] || 0) + ')</option>'; }).join('');
    if (sel.__h !== h) { sel.innerHTML = h; sel.__h = h; } sel.value = F.sp || 'all'; }
  window.UXB = {};
  UXB.power = power; /* My Pets 'Power' sort: same measure as the ranking Power board and the fighter picker */
  UXB.filters = function () { var q = String(F.q || '').trim().toLowerCase().replace(/^#/, ''), SM = window.V2PetSearch && q ? V2PetSearch.matcher(F.q, lastW || U.world()) : null; /* species-ranks-split: free-text AND search (js/v2-pet-search.js) */
    return { flip: !!F.flip, spKey: function (p) { return isHyb(p) ? '~' + spL(p.species).toLowerCase() : spL(p.species).toLowerCase(); }, keep: function (p) { if (p.tier < (F.min || 0)) return false; if (F.origin !== 'all' && originOf(p) !== F.origin) return false; if (F.sp && F.sp !== 'all' && spOf(p) !== F.sp) return false;
      if (SM) return SM(p);
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
    $('fShowing').textContent = shown ? fmt(shown.length) + ' of ' + fmt(alive.length) + ' pets match' : ''; /* bigfix: the cards themselves page 150 at a time (see #petPager) */
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
    var n = S.sel.length, selS0 = new Set(S.sel), onShown = shown.filter(function (p) { return selS0.has(p.id); }).length, cb = $('selAll');
    cb.checked = shown.length > 0 && onShown === shown.length; cb.indeterminate = onShown > 0 && onShown < shown.length;
    $('selCount').textContent = fmt(n) + ' of ' + fmt(shown.length) + ' selected';
    var hungry = alive.filter(function (p) { return p.hungry; }), hq = V.feedQueue(w, ME, hungry.map(function (p) { return p.id; }));
    $('bFeedHungry').innerHTML = 'Feed all hungry <span class="cost">(' + fmt(hungry.length) + ' pet' + (hungry.length === 1 ? '' : 's') + ' · ' + fmt(sum(hq)) + ' XCPETS · ' + fmt(hq.length) + ' burn' + (hq.length === 1 ? '' : 's') + ')</span>'; $('bFeedHungry').disabled = !hungry.length;
    var bar = $('selBar'); bar.hidden = !n; document.body.classList.toggle('has-sel', !!n);
    if ($('bRelease')) $('bRelease').disabled = !n; if ($('bRelease')) $('bRelease').title = n ? 'Release ' + n + ' selected pet' + (n === 1 ? '' : 's') + ' (a burn, final)' : 'Select pets first';
    if (window.V2LairQoL && V2LairQoL.mount && document.getElementById('lairQol')) { try { V2LairQoL.mount(w); if (window.V2Shop && V2Shop.refreshRoll) V2Shop.refreshRoll(); } catch (e) { } }
    if (!n) return;
    var ids = S.sel.slice(), idS = new Set(ids), fq = ids.length > 200 ? w.pets.filter(function (p) { return p.owner === ME && p.hungry && idS.has(p.id); }).map(function (p) { return { amount: p.nextMeal, petId: p.id }; }) : V.feedQueue(w, ME, ids), rn = Math.max(1, Math.min(10, Number($('rollN').value) || 1)), rq = V.rollQueue(w, ME, ids, rn);
    /* sticky-feed-bar: the bar is about feeding only (roll gear / auto-equip moved to the Lair, same #bRoll/#bAuto handlers). */
    var fedN = fq.reduce(function (t, x) { return t + ((x.petIds && x.petIds.length) || (x.petId != null ? 1 : 0) || 1); }, 0);
    $('selBarCount').innerHTML = '<b>' + fmt(n) + '</b> selected';
    $('selMeal').innerHTML = fq.length ? '🍖 <b>' + fmt(fedN) + '</b> hungry · meal <b>' + fmt(sum(fq)) + '</b> XCPETS' : '😋 all fed today';
    $('bFeedSel').innerHTML = 'Feed ' + (fq.length ? fmt(fedN) : '') + ' <span class="cost">' + (fq.length ? fmt(sum(fq)) + ' XCPETS' : 'nothing to feed') + '</span>'; $('bFeedSel').disabled = !fq.length;
    $('bRoll').innerHTML = 'Roll gear ×' + rn + ' <span class="cost">' + (rq.length ? fmt(rq.length) + ' roll' + (rq.length === 1 ? '' : 's') + ' · ' + fmt(sum(rq)) + ' XCPETS' : '345 XCPETS per roll · select pets first') + '</span>'; $('bRoll').disabled = !rq.length; $('bRoll').title = rq.length ? '' : 'Select one or more of your pets, then roll gear (345 XCPETS per roll)';
    var ae = V.autoEquipOps(w, ME, ids, S.tip); $('bAuto').innerHTML = '✨ Auto-equip <span class="cost">' + (ae.length ? ae.length + ' piece' + (ae.length === 1 ? '' : 's') + ' · free' : '') + '</span>'; $('bAuto').disabled = !ae.length;
    $('selWhy').textContent = '';
  };
  function bindSel() {
    $('selAll').onchange = function () { var w = U.world(), S = U.S(), shown = U.petList(w).filter(function (p) { return !p.dead; }).map(function (p) { return p.id; });
      var selS = new Set(S.sel), shS = new Set(shown), all = shown.every(function (id) { return selS.has(id); });
      if (all) S.sel = S.sel.filter(function (id) { return !shS.has(id); }); else shown.forEach(function (id) { if (!selS.has(id)) { selS.add(id); S.sel.push(id); } });
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
    /* fight-owner-labels: whose pet is whose on the fight / accept confirm */
    var FT = window.V2FightTag; plans.forEach(function (x) { var m = /^pet:(?:fight:(\d+):(\d+)|accept:(\d+))$/.exec(x.tag), A, B; if (!m || !FT) return;
      if (m[3]) { var f = (w.fights || [])[m[3] - 1]; if (!f) return; A = w.byId[f.b]; B = w.byId[f.a]; } else { A = w.byId[m[2]]; B = w.byId[m[1]]; }
      if (A && B) out += '<div class="ftsum">' + FT.html(A, B) + ' <b>VS</b> ' + FT.html(B, A) + '</div>'; });
    var rolls = plans.filter(function (x) { return /^pet:(roll|fr|of):\d+$/.test(x.tag); });
    if (rolls.length) { var ids = []; rolls.forEach(function (x) { var id = Number(x.tag.split(':')[2]); if (ids.indexOf(id) < 0) ids.push(id); });
      out += '<div class="small grwhat"><b>🎲 What you get:</b> ' + (rolls.length === 1 ? 'one random gear piece' : rolls.length + ' random gear pieces, one per roll') + ', for the pet named in each burn. ' + (U.autoEquip && U.autoEquip() ? 'Auto-equip is on: a new piece is worn right away unless the pet already wears something better.' : 'New pieces go to your stash (Auto-equip is off); equip them in The Rare Room (free).') + '</div><div class="small muted">🎁 Your gear arrives once the burn confirms, usually in about 10 minutes.</div>' +
        '<div class="small"><b>🎲 Your odds</b> (per roll)</div>' + ids.slice(0, 3).map(function (id) { var p = w.byId[id]; return p ? '<div class="small">#' + id + ' ' + esc(p.name) + ' ' + pill(p.tier) + '</div>' + oddsHtml(p, true) : ''; }).join('') + (ids.length > 3 ? '<div class="small muted">… and ' + (ids.length - 3) + ' more pets</div>' : '') +
        ''; }
    var spins = plans.filter(function (x) { return x.tag === 'pet:spin'; }); if (spins.length) { var pool = V.wheelPool ? V.wheelPool(w, ME) : [], WW = V.WHEEL_W || [1, 2, 4, 8], tw = pool.reduce(function (t, q) { return t + WW[q.tier || 0]; }, 0), pc = function (k) { return tw ? (WW[k] / tw * 100).toPrecision(2) + '%' : '—'; }; out += '<div class="small grwhat"><b>🎡 Pepe Wheel:</b> ' + (spins.length === 1 ? 'one random gear piece' : spins.length + ' random gear pieces') + ' for a <b>random pet of yours</b> (' + pool.length.toLocaleString('en-US') + ' living pets with an open slot; rarer pets are likelier: Common 1 · Uncommon 2 · Rare 4 · Legendary 8, so each Common pet ' + pc(0) + ', each Legendary ' + pc(3) + ' per spin). The piece is rolled for that pet like a normal roll and worn right away. The wheel shows who got what once the burn confirms, usually in about 10 minutes.</div>'; }
    if (plans.some(function (x) { return /^pet:c:roll/.test(x.tag); })) out += '<div class="small grwhat"><b>🎲 What you get:</b> the community pet gets one random gear piece and wears it right away. A new piece replaces the one in that slot. It shows once the burn confirms, usually in about 10 minutes.</div>';
    var rel = plans.filter(function (x) { return /^pet:rel/.test(x.tag); });
    if (rel.length) { var S = U.S(), names = S.sel.map(function (id) { var p = w.byId[id]; return p ? '#' + id + ' ' + esc(p.name) + ' (' + TL[p.tier] + ' ' + esc(spL(p.species)) + ')' : '#' + id; });
      out += '<div class="relwarn"><b>🔥 Releasing ' + names.length + ' pet' + (names.length === 1 ? '' : 's') + ':</b> ' + names.slice(0, 30).join(', ') + (names.length > 30 ? ' … +' + (names.length - 30) + ' more' : '') + '<br><b>Burns are final.</b> Released pets are gone for good and cannot be restored.</div>'; }
    return out; };

  // pending crates: our unconfirmed pet:roll burns (this browser's tracker + node mempool)
  function pendingRolls() { var S = U.S(), conf = {}, out = [], seen = {}; (S.rows || []).forEach(function (r) { conf[r.tx_hash] = 1; });
    function add(tx, tag, at) { var m = /^pet:(roll|fr|of):(\d+)$/.exec(String(tag)), c = /^pet:c:roll/.test(String(tag)), sp = String(tag) === 'pet:spin'; if (!tx || seen[tx] || conf[tx] || !(m || c || sp)) return; seen[tx] = 1; out.push({ tx: tx, id: m ? Number(m[2]) : null, community: c, spin: sp, kind: m ? m[1] : sp ? 'spin' : 'croll', at: at }); }
    try { if (window.V2Wallet && V2Wallet.tracker) V2Wallet.tracker.list().forEach(function (t) { if (t.status !== 'confirmed') add(t.txid, t.tag, t.at); }); } catch (e) { }
    (S.mempool || []).forEach(function (x) { if (x.source === ME) add(x.tx_hash, x.tag, x.at); }); return out; }
  function paintAeRow() { var inv = $('invPanel'); if (!inv || $('aeRow') || !U.aeToggleHtml) return; var d = document.createElement('div'); d.id = 'aeRow'; d.className = 'aerow'; d.innerHTML = U.aeToggleHtml();
    var h = inv.querySelector('h2'); inv.insertBefore(d, h ? h.nextSibling : inv.firstChild); U.bindAeTogs(d); }
  function paintCrates(w) { paintAeRow(); var box = $('crates'); if (!box) { box = document.createElement('div'); box.id = 'crates'; box.className = 'crates'; var inv = $('invPanel'); inv.insertBefore(box, inv.querySelector('.statline')); }
    var L = pendingRolls(); box.hidden = !L.length;
    box.innerHTML = L.length ? '<div class="small"><b>🎁 Gear on the way: ' + L.length + ' roll' + (L.length === 1 ? '' : 's') + '</b> · each piece arrives once its burn confirms, usually in about 10 minutes.</div><div class="cratelist">' + L.slice(0, 24).map(function (c) { var p = c.id != null ? w.byId[c.id] : null;
      return '<div class="crate" title="' + (c.community ? 'Community gear roll' : c.spin ? 'Pepe Wheel spin (random pet)' : 'Gear roll for #' + c.id) + ' · tx ' + esc(c.tx.slice(0, 10)) + '…"><span class="box8">📦</span><span class="small">' + (c.community ? 'Community pet' : c.spin ? '🎡 Wheel spin' : '#' + c.id + (p ? ' ' + esc(p.name) : '')) + '</span></div>'; }).join('') + '</div>' : ''; }
  /** pendingFor(petId): this pet's gear rolls still waiting to confirm (for the pet detail's pending line). */
  UXB.pendingSpins = function () { return pendingRolls().filter(function (c) { return c.spin; }).length; };
  UXB.pendingFor = function (petId) { return pendingRolls().filter(function (c) { return c.id === petId; }).length; };
  /* gear results (2026-10-19): cards only flash/glow by tier; the meme caption is ONE line for the whole batch (v2.js UXB_CAP, best piece),
   * never per card (per-card captions used the global .meme headline style: 34-64px Bangers with a 4px shadow, so they overlapped the cards). */
  UXB.revealCard = function (d, x, w) { var t = x.legendary ? 3 : x.tier || 0; d.classList.add('ux-flash', 'ux-t' + t); if (x.legendary) d.classList.add('ux-fanfare'); };

  UXB.revealDone = function () { }; /* the red "replaced your … / better piece in your stock" notice is gone (2026-10-19): the popup says where each piece went instead */

  // ================================================================ C. inventory: lucky drops, paper-doll, bag, collection log
  var IV = Object.assign({ view: 'bag', filter: 'all', slot: 'all', pet: null }, load('inv', {}));
  function saveIV() { store('inv', IV); }
  var COND = [['age', 2, '2 days old'], ['age', 5, '5 days old'], ['age', 10, '10 days old'], ['fed', 0.5, 'fed on 50% of its days'], ['fed', 0.8, 'fed on 80% of its days (min 3 fed days)']];
  function unmet(p) { var age = p.ageDays || 0, fd = p.fedDays || 0, ratio = fd / Math.max(1, age + 1);
    return COND.filter(function (c) { return c[0] === 'age' ? age < c[1] : c[1] === 0.5 ? !(ratio >= 0.5 && fd >= 1) : !(ratio >= 0.8 && fd >= 3); }).map(function (c) { return c[2]; }); }
  function srcLabel(g) { return { roll: '🎲 gear roll', token: '🎟️ lucky drop', live: '⛓️ v1 game', froll: '🎁 free roll', oroll: '🎁 overflow roll', founder: '🥇 founder kit', trophy: '🏆 trophy', fight: '⚔️ battle spoils' }[g.src] || (g.src ? esc(g.src) : 'unknown'); }
  function invPets(w) { return U.mine(w).filter(function (p) { return !p.dead; }); }
  /* stash pet cap fix (owner, Oct 20 2026): the pet dropdowns listed only the first 2,000 pets, so big owners (5,000+) could not reach new pets.
   * Now: a small '#ID / name / species' find box filters the dropdown over ALL the owner's pets; the list shows up to PET_OPT_MAX matches
   * (newest first when not filtering) and always keeps the selected pet. Display only. */
  var PET_OPT_MAX = 300;
  function petMatch(q, f) { if (!f) return true; var t = f.replace(/^#/, ''); if (/^\d+$/.test(t)) return String(q.id).indexOf(t) === 0;
    var k = t.toLowerCase(); return String(q.name || '').toLowerCase().indexOf(k) >= 0 || String(spL(q.species) || q.species || '').toLowerCase().indexOf(k) >= 0; }
  function petOpts(pets, sel, f, tierTxt) { f = String(f || '').trim(); var L = pets.filter(function (q) { return petMatch(q, f); });
    if (!f && L.length > PET_OPT_MAX) L = L.slice().sort(function (a, b) { return b.id - a.id; });
    var out = L.slice(0, PET_OPT_MAX); if (sel != null && !out.some(function (q) { return q.id === sel; })) { var sp = pets.filter(function (q) { return q.id === sel; })[0]; if (sp) out.unshift(sp); }
    var o = out.map(function (q) { return '<option value="' + q.id + '"' + (q.id === sel ? ' selected' : '') + '>#' + q.id + ' ' + esc(q.name) + (tierTxt ? ' · ' + TL[q.tier] : '') + '</option>'; }).join('');
    if (L.length > out.length) o += '<option value="" disabled>… ' + (L.length - PET_OPT_MAX).toLocaleString('en-US') + ' more: type #ID, name or species</option>';
    return o; }
  function findBox(id, f, n) { return n > PET_OPT_MAX ? ' <input type="search" id="' + id + '" class="pick petfind" placeholder="Find #ID / species" value="' + esc(f || '') + '" style="width:11em;max-width:45%" aria-label="Find a pet by #ID, name or species">' : ''; }
  function bindFind(inp, selId, pets, getSel, tierTxt, after) { var i = $(inp), sl = $(selId); if (!i || !sl) return; var t = null;
    i.oninput = function () { clearTimeout(t); var v = i.value; t = setTimeout(function () { var cur = getSel(); sl.innerHTML = petOpts(pets, cur, v, tierTxt);
      var first = pets.filter(function (q) { return petMatch(q, v.trim()); })[0]; if (v.trim() && first && sl.value !== String(first.id) && /^#?\d+$/.test(v.trim())) { sl.value = String(first.id); if (after) after(first.id, v); } }, 150); }; }
  function paintInv(w) {
    var box = $('inv'); if (!box) return; var fold = box.closest ? box.closest('details') : null;
    if (fold && !fold._lp) { fold._lp = 1; fold.addEventListener('toggle', function () { if (fold.open && fold._stale) { fold._stale = 0; paintInv(U.world()); } }); }
    if (fold && !fold.open) { fold._stale = 1; $('tokens').textContent = String(V.tokensOf(w, ME)); return; } /* lair-perf: a closed stash is painted when it opens */
    var items = w.itemList.filter(function (g) { return g.owner === ME; }), pets = invPets(w), S = U.S();
    $('tokens').textContent = String(V.tokensOf(w, ME));
    if (IV.pet == null || !w.byId[IV.pet] || w.byId[IV.pet].owner !== ME) IV.pet = (S.sel[0] != null && w.byId[S.sel[0]]) ? S.sel[0] : (pets[0] && pets[0].id);
    var p = w.byId[IV.pet], h = '';
    h += '<div class="pettabs invtabs" role="tablist"><button type="button" class="tab' + (IV.view === 'bag' ? ' on' : '') + '" data-iv="bag">📦 My stash</button><button type="button" class="tab' + (IV.view === 'log' ? ' on' : '') + '" data-iv="log">📖 Collection log</button></div>';
    if (IV.view === 'bag') {
      if (p) { var nm = p.capacity < 6 ? unmet(p) : [];
        h += '<div class="doll"><div class="dollhead"><label class="small">Pet <select id="ivPet" class="pick">' + petOpts(pets, p.id, IV.q, true) + '</select></label>' + findBox('ivFind', IV.q, pets.length) + ' <span class="small muted">' + V.wornOf(w, p.id).length + '/' + p.capacity + ' slots open</span></div><div class="dollrow"><canvas id="ivSprite" width="32" height="32" class="sprite big"></canvas><div class="dollslots">' +
          SLOTS.concat(p.species === 'wizard' ? ['weapon'] : []).map(function (sl, i) { var g = V.wornOf(w, p.id).filter(function (x) { return x.slot === sl; })[0], locked = V.slotOpen ? !V.slotOpen(p, sl) : p.openSlots.indexOf(sl) < 0; /* + Wizard-only Staff slot, Wizards only */
            var need = locked && sl === 'weapon' ? 'Opens with the Grip slot' : locked ? (i - p.capacity === 0 ? 'Unlocks at ' + (nm.length ? nm.join(' or ') : 'next milestone') : 'Needs ' + (i - p.capacity + 1) + ' more of: ' + nm.join(', ')) : '';
            return '<button type="button" class="dslot' + (locked ? ' locked' : '') + (g ? ' t' + (g.legendary ? 3 : g.tier) : '') + (IV.slot === sl ? ' on' : '') + '" data-dslot="' + sl + '" title="' + esc(locked ? need : g ? g.label : 'empty') + '"><span class="dl">' + esc(SL(sl)) + '</span>' + (g ? '<span class="gi" data-icon="' + esc(g.item) + '"></span><span class="small">' + esc(g.label) + (g.legendary ? ' ★' : '') + '</span>' : locked ? '<span class="small muted">🔒 ' + esc(need) + '</span>' : '<span class="small muted">empty</span>') + '</button>'; }).join('') + '</div></div></div>'; }
      h += '<div class="chips slotfilter">' + [['all', 'All'], ['worn', 'Worn'], ['bag', 'In stash'], ['star', '★']].map(function (f) { return '<button type="button" class="q' + (IV.filter === f[0] ? ' on' : '') + '" data-if="' + f[0] + '">' + f[1] + '</button>'; }).join('') + ' · <button type="button" class="q' + (IV.slot === 'all' ? ' on' : '') + '" data-is="all">All slots</button>' + SLOTS.map(function (sl) { return '<button type="button" class="q' + (IV.slot === sl ? ' on' : '') + '" data-is="' + sl + '">' + esc(SL(sl)) + '</button>'; }).join('') + '</div>';
      var groups = {}; items.forEach(function (g) { if (IV.slot !== 'all' && g.slot !== IV.slot) return; if (IV.filter === 'worn' && g.on == null) return; if (IV.filter === 'bag' && g.on != null) return; if (IV.filter === 'star' && !g.legendary) return;
        var k = g.item; (groups[k] = groups[k] || { item: g.item, label: g.label, slot: g.slot, tier: g.tier || 0, legendary: g.legendary, copies: [] }).copies.push(g); });
      var G = Object.keys(groups).map(function (k) { return groups[k]; }).sort(function (a, b) { return (b.legendary ? 4 : b.tier) - (a.legendary ? 4 : a.tier) || SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot) || (a.label < b.label ? -1 : 1); });
      var keyF = IV.filter + '|' + IV.slot; if (IV.pgKey !== keyF) { IV.pgKey = keyF; IV.pgN = 0; } var PGN = (window.matchMedia && matchMedia('(max-width:520px)').matches) ? 24 : 48, upto = Math.max(PGN, IV.pgN || 0), Gall = G; G = G.slice(0, upto); /* lair-perf: stash paged, filters/sort over ALL pieces first */
      h += G.length ? '<div class="baggrid">' + G.map(function (g) { var worn = g.copies.filter(function (c) { return c.on != null; }).length;
        return '<button type="button" class="bagitem t' + (g.legendary ? 3 : g.tier) + '" data-bag="' + esc(g.item) + '" title="' + esc(g.label) + ' · ' + esc(SL(g.slot)) + ' · ' + TL[g.tier] + (window.V2Rules && V2Rules.lockHint && V2Rules.lockHint(g.item) ? ' · ' + esc(V2Rules.lockHint(g.item)) : '') + '"><span class="gi" data-icon="' + esc(g.item) + '"></span><span class="bl">' + esc(g.label) + (g.legendary ? ' ★' : '') + '</span>' + (g.copies.length > 1 ? '<span class="cnt">×' + g.copies.length + '</span>' : '') + (worn ? '<span class="wn">' + worn + ' worn</span>' : '') + '</button>'; }).join('') + '</div>' + (Gall.length > G.length ? '<div class="row petmore" style="justify-content:center;margin:10px 0"><button type="button" class="q" id="ivMore">Show more (' + (Gall.length - G.length).toLocaleString('en-US') + ' left)</button></div>' : '') + (Gall.length > PGN ? '<p class="small muted" id="ivPager">Showing ' + G.length.toLocaleString('en-US') + ' of ' + Gall.length.toLocaleString('en-US') + ' kinds of gear</p>' : '')
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
    bindFind('ivFind', 'ivPet', invPets(U.world()), function () { return IV.pet; }, true, function (id, v) { IV.pet = id; IV.q = v; saveIV(); paintInv(U.world()); var f = $('ivFind'); if (f) { f.focus(); try { f.setSelectionRange(f.value.length, f.value.length); } catch (e) {} } });
    if ($('ivFind')) $('ivFind').addEventListener('change', function () { IV.q = this.value; });
    box.querySelectorAll('[data-bag]').forEach(function (b) { b.onclick = function (e) { e.stopPropagation(); popover(b, b.dataset.bag); }; });
    if ($('ivMore')) $('ivMore').onclick = function (e) { e.stopPropagation(); var y = window.scrollY, pg = (window.matchMedia && matchMedia('(max-width:520px)').matches) ? 24 : 48; IV.pgN = Math.max(pg, IV.pgN || 0) + pg; paintInv(U.world()); window.scrollTo(0, y); };
  }
  function equipOp(petId, slot, gid, msg) { var S = U.S(); S.ops.push({ kind: 'equip', owner: ME, petId: petId, slot: slot, gid: gid, block_index: S.tip }); U.save(); U.render(); U.toast(esc(msg) + ' (free)'); }
  function popover(anchor, itemId) { closePop(); var w = U.world(), it = V.GEAR_BY_ID[itemId] || {}, copies = w.itemList.filter(function (g) { return g.owner === ME && g.item === itemId; }), pets = invPets(w);
    var free = copies.filter(function (g) { return g.on == null; }), p0 = IV.pet != null ? IV.pet : pets[0] && pets[0].id;
    var d = document.createElement('div'); d.className = 'invpop'; d.id = 'invPop'; d.setAttribute('role', 'dialog');
    d.innerHTML = '<button type="button" class="q pclose" aria-label="Close">✕</button><div class="ph"><span class="gi"></span><div><b>' + esc(it.label || itemId) + (it.exclusive ? ' ★' : '') + '</b><div class="small">' + esc(SL(it.slot)) + ' · ' + pill(it.tier || 0) + (it.exclusive ? ' · ' + esc(spL(it.origin)) + '-only signature' : '') + (window.V2Rules && V2Rules.lockHint && V2Rules.lockHint(itemId) ? ' · ' + esc(V2Rules.lockHint(itemId)) : '') + '</div></div></div>' +
      '<div class="small"><b>You own ' + copies.length + '</b>: ' + copies.map(function (g) { return (g.on != null ? 'worn by <a href="#" data-pj="' + g.on + '">#' + g.on + '</a>' : 'in your stash') + ' · ' + srcLabel(g); }).join('<br>') + '</div>' +
      '<div class="row pact"><label class="small">Equip on <select id="popPet" class="pick">' + petOpts(pets, p0, '', false) + '</select></label>' + findBox('popFind', '', pets.length) + '<button type="button" class="btn" id="popEq">Equip</button></div><div class="small warn" id="popWhy"></div>' +
      (copies.some(function (g) { return g.on != null; }) ? '<div class="row">' + copies.filter(function (g) { return g.on != null; }).slice(0, 6).map(function (g) { return '<button type="button" class="q" data-off="' + g.gid + '" data-pid="' + g.on + '">Take off #' + g.on + '</button>'; }).join('') + '</div>' : '');
    document.body.appendChild(d); d.querySelector('.gi').appendChild(R.iconCanvas(itemId, ''));
    var r = anchor.getBoundingClientRect(); d.style.top = Math.min(window.innerHeight - 20, r.bottom + 6) + window.scrollY + 'px'; d.style.left = Math.max(8, Math.min(window.innerWidth - 330, r.left)) + window.scrollX + 'px';
    function check() { var pid = Number($('popPet').value), c = V.equipCheck(U.world(), ME, pid, itemId), why = c.ok ? (free.length || c.gid ? '' : '') : (c.worn ? 'Already wearing it.' : c.why);
      $('popWhy').textContent = why ? '✋ ' + why : ''; $('popEq').disabled = !c.ok; return c; }
    $('popPet').onchange = check; bindFind('popFind', 'popPet', pets, function () { return Number($('popPet').value); }, false, function () { check(); }); check();
    $('popEq').onclick = function () { var pid = Number($('popPet').value), c = check(); if (!c.ok) return; closePop(); equipOp(pid, it.slot, c.gid, 'Equipped ' + (it.label || itemId) + ' on #' + pid + (c.from ? ' (moved from #' + c.from + ')' : '')); };
    d.querySelectorAll('[data-off]').forEach(function (b) { b.onclick = function () { closePop(); equipOp(Number(b.dataset.pid), it.slot, null, 'Took ' + (it.label || itemId) + ' off #' + b.dataset.pid); }; });
    d.querySelectorAll('[data-pj]').forEach(function (a) { a.onclick = function (e) { e.preventDefault(); closePop(); U.detail(Number(a.dataset.pj)); }; });
    d.querySelector('.pclose').onclick = closePop; }
  function closePop() { var d = $('invPop'); if (d) d.remove(); }
  document.addEventListener('click', function (e) { var d = $('invPop'); if (d && !d.contains(e.target)) closePop(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePop(); });
  /* bigfix 2026-10-20: Lucky drops show every piece: newest first, 60 at a time with 'Show more (N left)' and a total count */
  function bindTokens() { var TN = 60; $('tokStat').onclick = function () { var L = $('tokList'), w = U.world(); if (!L.hidden) { L.hidden = true; return; }
    var T = w.itemList.filter(function (g) { return g.owner === ME && g.src === 'token'; }).reverse(); TN = 60;
    var card = function (g) { return '<span class="bagitem t' + (g.legendary ? 3 : g.tier || 0) + '"><span class="gi" data-icon="' + esc(g.item) + '"></span><span class="bl">' + esc(g.label) + (g.legendary ? ' ★' : '') + '</span><span class="wn">' + (g.on != null ? 'on #' + g.on : '🎒') + (g.rolledOn != null ? ' · from #' + g.rolledOn : '') + '</span></span>'; };
    var icons = function (el) { el.querySelectorAll('.gi[data-icon]').forEach(function (s) { if (!s.firstChild) s.appendChild(R.iconCanvas(s.getAttribute('data-icon'), '')); }); };
    L.innerHTML = T.length ? '<div class="small"><b>🎟️ Lucky drops: ' + fmt(T.length) + '</b> · newest first · each one was rolled and worn the moment it dropped:</div><div class="baggrid">' + T.slice(0, TN).map(card).join('') + '</div>' + (T.length > TN ? '<button type="button" class="q" id="tokMore">Show more (' + fmt(T.length - TN) + ' left)</button>' : '')
      : '<p class="small muted">' + (V.tokensOf(w, ME) ? 'Your lucky drops came from the v1 game; their pieces are mixed into your stash.' : 'No lucky drops yet. Each stage-up has a 25% chance and each meal 2%.') + '</p>';
    icons(L); L.hidden = false;
    var mb = $('tokMore'); if (mb) mb.onclick = function (e) { e.stopPropagation(); var g = L.querySelector('.baggrid'), a = TN; TN += 60; g.insertAdjacentHTML('beforeend', T.slice(a, TN).map(card).join('')); icons(g);
      if (T.length > TN) mb.textContent = 'Show more (' + fmt(T.length - TN) + ' left)'; else mb.remove(); }; }; }

  // ================================================================ A. battle face-off card
  var FO = { a: null, b: null }, IGN = load('ignored', []);
  function today(w) { return V.day(U.S().tip || w.tip || 0); }
  function whyNot(p, w) { var f = V.fightable ? V.fightable(p) : null; if (p.dead) return 'dead'; if (p.released) return 'released'; if (p.stage < 2) return 'not Juvenile yet'; if (p.neglected) return 'neglected'; if (p.fightDays && p.fightDays[today(w)]) return 'fought today'; return f; }
  function side(p, w, mine, other) { if (!p) return '<button type="button" class="fside empty" data-side="' + (mine ? 'a' : 'b') + '"><span class="big">＋</span><span>' + (mine ? 'Pick your pet' : 'Pick an opponent') + '</span></button>';
    var g = V.wornOf(w, p.id), why = whyNot(p, w);
    var FT = window.V2FightTag; /* fight-owner-labels */
    return '<button type="button" class="fside t' + p.tier + (why ? ' no' : '') + (FT && FT.mine(p) ? ' fme' : '') + '" data-side="' + (mine ? 'a' : 'b') + '" aria-label="' + (mine ? 'Change your pet' : 'Change opponent') + '">' + (FT ? FT.html(p, other) : '') + '<span class="fsp" data-fsp="' + p.id + '"></span><span class="fn"><b>' + esc(p.name) + '</b> <span class="muted">#' + p.id + '</span>' + (p.blackEye ? ' 🤕' : '') + '</span><span class="small">' + pill(p.tier) + ' ' + esc(spL(p.species)) + ' · ' + p.stageName + '</span><span class="fpow"' + ptA(p) + '>⚡ ' + power(p) + ' Power</span>' +
      '<span class="fstats">' + STATS.map(function (k) { var v = (p.stats || {})[k] || 0, o = other ? (other.stats || {})[k] || 0 : 0; return '<span class="fst"><span class="sk">' + k.slice(0, 3).toUpperCase() + '</span><span class="fb"><i class="' + (other && v > o ? 'up' : other && v < o ? 'dn' : '') + '" style="width:' + Math.min(100, 100 * v / 35).toFixed(0) + '%"></i></span><b>' + v + '</b></span>'; }).join('') + '</span>' +
      '<span class="fgear">' + (g.length ? g.map(function (x) { return '<span class="gi" data-icon="' + esc(x.item) + '" title="' + esc(x.label) + (x.legendary ? ' ★ (safe)' : '') + '"></span>'; }).join('') : '<span class="small muted">no gear worn</span>') + '</span>' + (why ? '<span class="small warn">✋ ' + esc(why) + '</span>' : '') + (mine ? '<span class="fchg">✎ Change</span>' : '') + '</button>'; }
  function paintFace(w) { var box = $('faceoff'); if (!box) return; var mine = U.mine(w).filter(function (p) { return !p.dead; });
    if (FO.a && (!w.byId[FO.a] || w.byId[FO.a].owner !== ME)) FO.a = null; if (FO.b && (!w.byId[FO.b] || w.byId[FO.b].owner === ME)) FO.b = null;
    /* 2026-10-19: no default pet on your side. It used to auto-pick your first eligible fighter (lowest pet number), which hid that the card opens the picker.
     * Your side now starts empty ('Pick your pet') unless you arrived with a pet on purpose (UXB.battleWith / play.html#battle-ID). */
    if (FO.want != null) { var wp = w.byId[FO.want]; if (wp && wp.owner === ME && !wp.dead && !wp.released) { FO.a = wp.id; FO.want = null; var bp = $('battlePanel'); if (bp) setTimeout(function () { bp.scrollIntoView(); }, 0); }
      /* fight-preselect (owner Oct 24 2026): fight.html#battle-ID for someone else's living pet puts it on the opponent side (you still pick yours) */
      else if (wp && ME && wp.owner !== ME && !wp.dead && !wp.released) { FO.b = wp.id; FO.want = null; } }
    var A = FO.a && w.byId[FO.a], B = FO.b && w.byId[FO.b], okA = A && !whyNot(A, w), okB = B && !whyNot(B, w), sw = okA && okB && window.V2UI && V2UI.sendWhy ? V2UI.sendWhy({ tag: 'pet:fight:' + A.id + ':' + B.id }) : null; if (sw) okA = false; /* wasted-burn guard: engine rules (open challenge, etc.) */
    var TIP = (window.V2UI && V2UI.S().tip) || w.tip || 0, inc = (w.fights || []).filter(function (f) { var q = w.byId[f.b]; return f.status === 'open' && TIP + 1 - f.block <= V.FIGHT_WINDOW && q && q.owner === ME && IGN.indexOf(f.id) < 0; }); /* wasted-burn guard: expired challenges drop out */
    /* arena-sharp-text (owner 9:34 PM CT): one Challenge area with two tabs; the Incoming tab carries a count badge so incoming fights show at a glance */
    var tab = FO.tab || 'new', nInc = inc.length;
    var h = '<div class="ch-tabs" role="tablist"><button type="button" role="tab" class="ch-tab' + (tab === 'new' ? ' on' : '') + '" data-chtab="new" aria-selected="' + (tab === 'new') + '">⚔️ New challenge</button><button type="button" role="tab" class="ch-tab' + (tab === 'inc' ? ' on' : '') + (nInc ? ' hot' : '') + '" data-chtab="inc" aria-selected="' + (tab === 'inc') + '">📥 Incoming <span class="ch-badge">' + nInc + '</span></button></div>';
    if (tab === 'new') h += '<div class="fcard"><div class="fgrid">' + side(A, w, true, B) + '<div class="vs" aria-hidden="true">VS</div>' + side(B, w, false, A) + '</div>' +
      '<button type="button" class="btn ico-flame fgo" id="foGo"' + (okA && okB ? '' : ' disabled') + '>' + (!A ? 'Pick your pet first' : B ? 'Challenge #' + B.id + ' · burn 690 XCPETS' : 'Pick an opponent to challenge') + '</button> <button type="button" class="q ar-qm" id="arQuick">🎲 Quick match</button><span class="small ar-qmsg" id="arQmsg" aria-live="polite"></span>' + (A && B && (!okA || !okB) ? '<div class="small warn">✋ ' + esc(sw ? sw : !okA ? 'Your pet: ' + whyNot(A, w) : 'Opponent: ' + whyNot(B, w)) + '</div>' : '') + '</div>';
    if (tab === 'inc') h += (nInc ? '' : '<p class="small muted">No incoming challenges right now. When someone challenges your pet it shows up here.</p>') + inc.slice(0, 10).map(function (f) { var X = w.byId[f.b], Y = w.byId[f.a];
      return '<div class="fcard inc"><div class="fgrid">' + side(X, w, true, Y).replace('data-side="a"', 'data-noside="1"').replace('<span class="fchg">✎ Change</span>', '') + '<div class="vs">VS</div>' + side(Y, w, false, X).replace('data-side="b"', 'data-noside="1"') + '</div><div class="small fstake">Fight ' + f.id + ' · accept by block ' + fmt(f.expires) + ' · loser gives 1 random worn piece, ★ safe</div><div class="row"><button type="button" class="btn ico-flame" data-facc="' + f.id + '"' + (function (y) { return y ? ' disabled title="' + esc(y) + '">Can\'t accept: ' + esc(y) : '>Accept (' + fmt(V.COSTS.accept) + ')'; })(window.V2UI && V2UI.sendWhy ? V2UI.sendWhy({ tag: 'pet:accept:' + f.id }) : null) + '</button><button type="button" class="q" data-fign="' + f.id + '">Ignore</button></div></div>'; }).join('');
    box.innerHTML = h;
    box.querySelectorAll('[data-chtab]').forEach(function (b) { b.onclick = function () { FO.tab = b.dataset.chtab; paintFace(U.world()); }; });
    if ($('arQuick')) $('arQuick').onclick = function () { var my = U.fighters(w, ME), th = U.fighters(w, ME, true), q = window.V2QuickMatch && V2QuickMatch(w, my, th, (U.S() && U.S().tip) || w.tip, FO.a ? String(FO.a) : '');
      if (!q) { $('arQmsg').textContent = '✋ No fair opponent free today'; return; } FO.a = q.a.id; FO.b = q.b.id; paintFace(U.world()); if ($('arQmsg')) $('arQmsg').textContent = '#' + q.a.id + ' ⚡' + power(q.a) + ' vs #' + q.b.id + ' ⚡' + power(q.b) + ' · tap Challenge to sign'; var g = $('foGo'); if (g) { g.classList.add('ar-flash'); setTimeout(function () { g.classList.remove('ar-flash'); }, 1600); } };
    box.querySelectorAll('[data-fsp]').forEach(function (s) { var p = w.byId[s.getAttribute('data-fsp')]; s.appendChild(canvasFor(p, w, 'sprite big')); });
    box.querySelectorAll('.gi[data-icon]').forEach(function (s) { s.appendChild(R.iconCanvas(s.getAttribute('data-icon'), '')); });
    box.querySelectorAll('[data-side]').forEach(function (b) { b.onclick = function () { picker(b.dataset.side); }; });
    if ($('foGo')) $('foGo').onclick = function () { var a = FO.a, b = FO.b; if (!a || !b) return; var sa = $('fMine'), sb = $('fTheirs');
      if (!Array.prototype.some.call(sa.options, function (o) { return o.value === String(a); }) || !Array.prototype.some.call(sb.options, function (o) { return o.value === String(b); })) return U.toast('That pair can’t fight right now');
      sa.value = String(a); sb.value = String(b); $('fGo').click(); };
    box.querySelectorAll('[data-facc]').forEach(function (b) { b.onclick = function () { var id = b.dataset.facc; U.confirmPlans('Accept fight ' + id, [{ tag: 'pet:accept:' + id, amount: (V2Rules.acceptCost ? V2Rules.acceptCost(V2Mock.world(), +(id)) : 690) }], function () { U.afterAccept(id); }); }; });
    box.querySelectorAll('[data-fign]').forEach(function (b) { b.onclick = function () { IGN.push(Number(b.dataset.fign)); store('ignored', IGN); paintFace(U.world()); U.toast('Ignored here. It expires on its own if nobody accepts.'); }; }); if (window.V2Easy) V2Easy.fight(w); /* easy-flows */ }
  /* P13 (2026-10-21): the fight picker is also the shared pet browser. picker(sideId, o) with o = { title, pets, why(p, w), okLabel, onPick(id) }
   * browses any list with the same search, sort, chips and thumbnails (motel breeding uses it); without o it is exactly the fight picker. */
  function picker(sideId, o) { o = o || null; var w = U.world(), mineSide = sideId === 'a', WN = o && o.why ? o.why : whyNot, L = o && o.pets ? o.pets : w.pets.filter(function (p) { return (mineSide ? p.owner === ME : p.owner !== ME) && !p.dead && !p.released; });
    var m = document.createElement('div'); m.className = 'fpick on'; m.id = 'fPick'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-label', o && o.title ? o.title : mineSide ? 'Pick your pet' : 'Pick an opponent');
    m.innerHTML = '<div class="box"><div class="row"><b>' + esc(o && o.title ? o.title : mineSide ? 'Pick your fighter' : 'Pick an opponent') + '</b><input type="search" id="fpQ" class="amt" placeholder="# or name" aria-label="Search"><select id="fpS" class="pick" aria-label="Sort"><option value="score">⭐ Pet Score</option><option value="pow">⚡ Power</option><option value="tier">💎 Rarest</option><option value="num">Pet number</option><option value="stage">Stage</option></select><button type="button" class="q" id="fpX">✕</button></div><div class="pk-chips fp-chips" id="fpC"></div><div class="fpgrid" id="fpG"></div></div>';
    document.body.appendChild(m);
    /* arena-sharp-text (owner 9:35 PM CT): search + short filter chips like the Lair strip: can fight now, species, rareness, Pet Score and power bands */
    var PF = FO.pf = FO.pf || {}, pf = PF[sideId] = PF[sideId] || { ok: true, sp: '', tier: -1, sc: 0, pw: 0 }, scoreOf = function (p) { var r = window.PetScore && PetScore.of(w, p); return r ? r.score : 0; }; var rbits = function (p) { return window.PetScore && PetScore.bitsOf ? PetScore.bitsOf(w, p) : -1; }; /* rarity-sort */
    var SPS = {}; L.forEach(function (p) { SPS[p.species] = 1; }); var pws = L.map(power).sort(function (a, b) { return a - b; }), q3 = function (f) { return pws.length ? pws[Math.floor((pws.length - 1) * f)] : 0; }, PB = [q3(.5), q3(.75)], scs = L.map(scoreOf).sort(function (a, b) { return a - b; }), SB = [0.5, 0.75].map(function (f) { return scs.length ? scs[Math.floor((scs.length - 1) * f)] : 0; });
    function chips() { var c = function (k, v, on, t) { return '<button type="button" class="pk-chip' + (on ? ' on' : '') + '" data-fk="' + k + '" data-fv="' + v + '" aria-pressed="' + !!on + '">' + t + '</button>'; };
      $('fpC').innerHTML = c('ok', 1, pf.ok, o && o.okLabel ? esc(o.okLabel) : '✅ Can fight now') + TL.map(function (t, i) { return c('tier', i, pf.tier === i, esc(t)); }).join('') + c('sc', SB[0], pf.sc === SB[0] && SB[0], '⭐ ' + SB[0] + '+') + c('sc', SB[1], pf.sc === SB[1] && SB[1], '⭐ ' + SB[1] + '+') + c('pw', PB[0], pf.pw === PB[0] && PB[0], '⚡ ' + PB[0] + '+') + c('pw', PB[1], pf.pw === PB[1] && PB[1], '⚡ ' + PB[1] + '+') +
        '<select class="pick fp-sp" id="fpSp" aria-label="Species"><option value="">All species</option>' + Object.keys(SPS).sort().map(function (k) { return '<option value="' + esc(k) + '"' + (pf.sp === k ? ' selected' : '') + '>' + esc(spL(k)) + '</option>'; }).join('') + '</select>';
      $('fpC').querySelectorAll('[data-fk]').forEach(function (b) { b.onclick = function () { var k = b.dataset.fk, v = Number(b.dataset.fv); if (k === 'ok') pf.ok = !pf.ok; else pf[k] = pf[k] === v ? (k === 'tier' ? -1 : 0) : v; chips(); draw(); }; });
      $('fpSp').onchange = function () { pf.sp = this.value; draw(); }; }
    function draw() { var q = $('fpQ').value.trim().toLowerCase().replace(/^#/, ''), s = $('fpS').value, ok = pf.ok;
      var X = L.filter(function (p) { return (!q || String(p.id).indexOf(q) === 0 || String(p.name || '').toLowerCase().indexOf(q) >= 0) && (!ok || !WN(p, w)) && (!pf.sp || p.species === pf.sp) && (pf.tier < 0 || p.tier === pf.tier) && (!pf.sc || scoreOf(p) >= pf.sc) && (!pf.pw || power(p) >= pf.pw); });
      X.sort(function (a, b) { return s === 'score' ? scoreOf(b) - scoreOf(a) || power(b) - power(a) : s === 'pow' ? power(b) - power(a) : s === 'tier' ? b.tier - a.tier || rbits(b) - rbits(a) || power(b) - power(a) : s === 'stage' ? b.stage - a.stage || power(b) - power(a) : a.id - b.id; });
      $('fpG').innerHTML = X.slice(0, 120).map(function (p) { var why = WN(p, w); return '<button type="button" class="fpc t' + p.tier + (why ? ' no' : '') + '" data-pk="' + p.id + '"' + (why ? ' aria-disabled="true"' : '') + '><span class="fsp" data-fsp="' + p.id + '"></span><b>#' + p.id + ' ' + esc(p.name) + '</b><span class="small">' + TL[p.tier] + ' ' + esc(spL(p.species)) + ' · ' + p.stageName + '</span><span class="small"><span' + ptA(p) + '>⚡ ' + power(p) + '</span>' + (window.PetScore ? ' · ⭐ ' + scoreOf(p) : '') + (p.blackEye ? ' · 🤕' : '') + '</span>' + (why ? '<span class="small warn">' + esc(why) + '</span>' : '') + '</button>'; }).join('') + (X.length > 120 ? '<p class="small muted">Showing 120 of ' + X.length + '. Search to narrow down.</p>' : '') + (X.length ? '' : '<p class="small muted">No pet matches.</p>');
      $('fpG').querySelectorAll('[data-fsp]').forEach(function (s2) { s2.appendChild(canvasFor(w.byId[s2.getAttribute('data-fsp')], w, 'sprite')); });
      $('fpG').querySelectorAll('[data-pk]').forEach(function (b) { b.onclick = function () { if (b.getAttribute('aria-disabled')) return; m.remove(); if (o && o.onPick) return o.onPick(Number(b.dataset.pk)); FO[sideId] = Number(b.dataset.pk); paintFace(U.world()); }; }); }
    $('fpQ').oninput = draw; $('fpS').onchange = draw; chips(); $('fpX').onclick = function () { m.remove(); }; m.onclick = function (e) { if (e.target === m) m.remove(); }; draw(); $('fpQ').focus(); }
  /* easy-flows (2026-10-22, display only): the easy battle picker (js/v2-easy-flows.js) shares this face-off state, so deep links, Quick match and
   * the Challenge burn (#foGo -> #fMine/#fTheirs -> #fGo) stay exactly the same. */
  UXB.faceoff = function () { return FO; }; UXB.whyNot = whyNot;
  UXB.setFace = function (a, b) { if (a !== undefined) FO.a = a; if (b !== undefined) FO.b = b; FO.tab = 'new'; paintFace(U.world()); };
  UXB.fightIgnored = function () { return IGN.slice(); }; UXB.ignoreFight = function (id) { IGN.push(Number(id)); store('ignored', IGN); paintFace(U.world()); };
  window.UXB.browsePets = function (sideId, o) { return picker(sideId, o); }; /* P13: shared pet browser (motel breeding) */

  /* arrived with a pet on purpose (e.g. a future pet-page 'Battle' button linking to play.html#battle-ID): keep that pet on your side */
  UXB.battleWith = function (id) { FO.want = Number(id); var w = U.world(); if (w) paintFace(w); return true; };
  function battleRoute() { var m = /^#battle-(\d+)$/.exec(location.hash); if (m) UXB.battleWith(Number(m[1])); }
  window.addEventListener('hashchange', battleRoute);

  // ================================================================ wiring
  UXB.after = function (w) { lastW = w; paintControls(w); UXB.sel(); if (!U.lairOn || U.lairOn()) paintInv(w); else { var ib = $('inv'); if (ib && ib.querySelector('.invgrid')) ib.innerHTML = ''; } paintFace(w); paintCrates(w); };
  UXB.paintInv = function (w) { paintInv(w || U.world()); };
  bindControls(); bindSel(); bindTokens();
  U.render(); battleRoute();
})();
