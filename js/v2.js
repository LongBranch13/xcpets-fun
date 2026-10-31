/* XCPETS play page UI (live game): reads real XCPETS burns via js/v2-chain.js; every burn is signed by the player in XCP Wallet. */
(function () {
  function ZB(p) { return !!(p && p.zombie && !p.zombie.end); } /* CEMETERY LOOP: a risen zombie (an ended record means dust or resurrected) */
  /* CEMETERY LOOP (owner Oct 29 2026 "I'd see them there and feed them there"): a zombie is fed from its own My Pets card (and its detail panel).
   * A zombie meal is the cemetery's pet:zfeed burn: the zombie meal cost (V.cemCost 'zmeal', halving-aware, no other boost) plus one of your living
   * pets that it eats. Same confirm sheet and send guard as every other burn. Not part of Feed all: Feed all never spends a pet. */
  var zMealsMemo = null;
  function zMeals(w, me, b) { if (zMealsMemo && zMealsMemo.w === w && zMealsMemo.me === me && zMealsMemo.b === b) return zMealsMemo.L;
    var L = !V.cemOfferWhy ? [] : (w.pets || []).filter(function (a) { return a.owner === me && !a.dead && !a.released && !ZB(a) && !V.cemOfferWhy(w, a, me, b); })
      .sort(function (a, c) { return (a.tier | 0) - (c.tier | 0) || (a.stage | 0) - (c.stage | 0) || a.id - c.id; }); zMealsMemo = { w: w, me: me, b: b, L: L }; return L; }
  /* zombie-feed-pets (owner Oct 30 2026 "I fed the zombie but it was xcpets instead of other pets I dont want"): the meal is a PICK, never a default.
   * Nothing is pre-selected (the old dropdown silently pre-picked the weakest pet), starred pets and pets already in an unconfirmed zombie meal are
   * left out, you tick any number of unwanted pets, and the button names the pets plus the fee. One pet:zfeed burn eats every listed pet for one
   * fee (rules unchanged: cemHandle zfeed), so the picks are packed into as few 34-byte tags as fit. A pending meal shows on the card. UI only. */
  function zPendMeals(z) { var o = []; myPendingTags().forEach(function (tag) { var t = V.parseTag ? V.parseTag(tag) : null; if (t && t.action === 'zfeed' && +t.zombie === +z) (t.ids || []).forEach(function (id) { o.push(+id); }); }); return o; }
  function zAllPend() { var o = []; myPendingTags().forEach(function (tag) { var t = V.parseTag ? V.parseTag(tag) : null; if (t && t.action === 'zfeed') (t.ids || []).forEach(function (id) { o.push(+id); }); }); return o; }
  /* Owner Oct 30 2026 6:39 PM CT "I want to use discarded pets": the picker lists your DISCARDED pets first (the free My Pets Discard, hidden in
   * this browser, plus the on-chain feed-all skip list pet:sk), with one "Select all discarded" tick. Discard is not a rule state, so pet:zfeed already
   * accepts them (cemOfferWhy never looks at it). Other living pets sit in a closed "not discarded" list. Starred pets are never listed.
   * Packing: one burn = one meal fee and eats every pet it names. Each burn uses whichever fits more pets in 34 bytes: the id list
   * (pet:zfeed:Z:A.B.C) or the range mask (pet:zfm:Z:START:MASK, 5 ids per mask character, rules parse it since the cemetery loop shipped). */
  function zB32(n) { return n.toString(32).toUpperCase(); }
  function zFeedPlans(w, z, ids, b) { var s = ids.slice().sort(function (a, c) { return a - c; }).filter(function (x, i, A) { return !i || A[i - 1] !== x; }), out = [], i = 0, cost = V.cemCost(w, 'zmeal', b);
    while (i < s.length) {
      var lst = [], k = i; while (k < s.length) { var t = 'pet:zfeed:' + z + ':' + lst.concat([s[k]]).map(zB32).join('.'); if (t.length > 34) break; lst.push(s[k]); k++; }
      var st = s[i], room = 34 - ('pet:zfm:' + z + ':' + st + ':').length, span = Math.max(0, room) * 5, msk = [], m = i; while (m < s.length && s[m] < st + span) { msk.push(s[m]); m++; }
      var tag, eat; if (msk.length > lst.length) { var ch = []; msk.forEach(function (id) { var o = id - st, c = Math.floor(o / 5); while (ch.length <= c) ch.push(0); ch[c] |= 1 << (o % 5); });
        tag = 'pet:zfm:' + z + ':' + st + ':' + ch.map(zB32).join(''); eat = msk; i = m; } else { tag = 'pet:zfeed:' + z + ':' + lst.map(zB32).join('.'); eat = lst; i = k; }
      out.push({ tag: tag, amount: cost, petId: z, label: 'zmeal', zEat: eat }); }
    return out; }
  function zBtnText(w, z, ids, b) { var cost = V.cemCost(w, 'zmeal', b); if (!ids.length) return '🍖 Tick pets above to feed it';
    var n = zFeedPlans(w, z, ids, b).length; return '🍖 Feed ' + fmt(ids.length) + ' pet' + (ids.length > 1 ? 's' : '') + ' · ' + n + ' burn' + (n > 1 ? 's' : '') + ' × ' + fmt(cost) + ' = ' + fmt(cost * n) + ' XCPETS'; }
  function zDiscarded(w) { var h = {}; hiddenIds().forEach(function (id) { h[+id] = 1; }); (w.pets || []).forEach(function (a) { if (ME && a.skipBy === ME) h[a.id] = 1; }); return h; }
  function zFeedHtml(p, w) { if (!ZB(p) || !ME || p.owner !== ME || !V.cemOn || !V.cemCost) return ''; var b = (S.tip || 0) + 1; if (!V.cemOn(b)) return ''; zPickCss();
    var pend = zPendIds(['zfeed', 'rpl']), mine = zPendMeals(p.id), all = zMeals(w, ME, b).filter(function (a) { return a.id !== p.id && pend.indexOf(a.id) < 0 && !zPledgedAny(w, a.id); });
    var L = all.filter(function (a) { return !isKept(a.id); }), kept = all.length - L.length, H = zDiscarded(w), D = L.filter(function (a) { return H[a.id]; }), cost = V.cemCost(w, 'zmeal', b), v = V.cemView(w, p, b) || {};
    var pn = mine.length ? '<div class="small zb-pend">⏳ Meal waiting for a block: ' + mine.map(function (id) { var a = w.byId[id]; return esc((a && a.name) || '#' + id) + ' #' + id; }).join(', ') + '. It is eaten (and hunger refills) when that burn confirms; until then the pet still shows on your list.</div>' : '';
    return '<div class="zb-feed zb-pk" data-zf="' + p.id + '" data-pk="feed">' + pn + '<details class="zb-pickbox"' + (D.length ? ' open' : '') + '><summary class="small">🍖 Feed ' + esc(p.name || '#' + p.id) + ' pets you pick <span class="muted">(' + fmt(D.length) + ' discarded · ' + fmt(L.length - D.length) + ' other)</span></summary>' +
      '<p class="small zb-warn">A zombie eats <b>pets</b>, not XCPETS. Every pet you tick is <b>used up for good</b>. The fee is ' + fmt(cost) + ' XCPETS <b>per burn</b>, and one burn eats as many pets as fit in it (pets with close ids pack best). Any meal refills hunger to full. Each row shows the <b>⚡ power</b> that pet alone would add (rules math). Nothing is ticked for you.' + zCapNote(p) + (kept ? ' ★ Starred pets are never listed (' + fmt(kept) + ').' : '') + '</p>' +
      zSortBar('feed', D.length) + '<div class="zb-list">' + (zRows(w, L, H, function (a) { return zMealGain(w, p, [a]); }, '⚡').join('') || '<div class="small muted">No pets it can eat. Discard pets in My Pets (🗑️, free) and they show first here.</div>') + '</div>' +
      '<div class="small zb-sum" data-pow="' + (v.power || 0) + '"></div></details>' +
      '<button type="button" class="btn zb-feedbtn" disabled>' + zBtnText(w, p.id, [], b) + '</button></div>'; }
  /* cem-pickers (owner Oct 30 2026 7:55 PM CT "sacrifice options shown by rarity or pet score or power or something not all pick best"): both pet
   * pickers (zombie meal + Resurrection pledge) get a sort (discarded first / rarity / pet score / power / what it adds) and a rarity + discarded-only
   * filter, and every row shows what that pet is worth here: the ⚡ power it alone would add to the zombie (zfeed math read from V.CEM.MEAL_SHARE,
   * GRAVE_FACTOR and V.cemExact) or the Resurrection points it adds (V.CEM.POINTS by tier, 1/3/10/33). Nothing is pre-ticked. Display only. */
  function zPickCss() { if (document.getElementById('zbPickCss')) return; var s = document.createElement('style'); s.id = 'zbPickCss';
    s.textContent = '.zb-sortbar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:4px 0;color:#c9d6a9}.zb-sortbar select{max-width:170px;font-size:12px}.zb-sortbar label{display:inline-flex;gap:4px;align-items:center}' +
      '.zb-opt{flex-wrap:wrap}.zb-opt .zb-nm{flex:1 1 auto;min-width:0}.zb-v{margin-left:auto;font-weight:700;color:#d8f08a;white-space:nowrap}.zb-v.rp{color:#ffe27a}.zb-mt{color:#8f9a80;font-size:11px;white-space:nowrap}.zb-dt{color:#e3a35a}' +
      '.zb-sum{flex:1 1 100%;margin-top:4px;color:#d9e6b8;min-height:1em}.zb-sum b{color:#fff}.zb-sum .lo{color:#e3a35a}.zb-rpl .zb-pickbox summary{color:#f3e3a2}.zb-rpl{border-top:1px dashed #4d5a3a;padding-top:6px}.zb-gear{margin-top:6px}.zb-pled{flex:1 1 100%;color:#c9b97a}.zb-resbtn:disabled{opacity:.5;cursor:not-allowed}';
    (document.head || document.documentElement).appendChild(s); }
  function zScore(w, a) { try { var s = window.PetScore && PetScore.of ? PetScore.of(w, a) : null; return s ? Math.round(s.score) : -1; } catch (e) { return -1; } }
  function zPow(a) { try { return window.UXB && UXB.power ? Math.round(UXB.power(a)) : 0; } catch (e) { return 0; } }
  function zCapNote(Z) { var z = Z && Z.zombie; if (!z || !z.cap) return ''; var m = Math.min(z.cap, 1 + 2 * (1 - z.keep)); return m >= z.cap - 0.05 ? ' <b>' + esc(Z.name || '#' + Z.id) + ' is at ×' + (Math.round(m * 100) / 100) + ' of its ×' + z.cap + ' power cap</b>, so meals now add almost no power (shown as +0); they still refill hunger.' : ''; }
  function zPowAt(z, keep) { var c = Object.assign({}, z, { keep: keep }); return Object.keys(z.death || {}).reduce(function (s, k) { return s + V.cemExact(c, k); }, 0); }
  /* the zfeed keep step of cemHandle, read-only: s = min(0.95, MEAL_SHARE[tier] × (ripe ? 1.5 : 1) × GRAVE_FACTOR[zombie tier]); keep ×= 1 − s */
  function zMealGain(w, Z, meals) { var C = V.CEM, z = Z && Z.zombie; if (!C || !z || !V.cemExact || !C.MEAL_SHARE) return 0; var T = function (x) { return Math.max(0, Math.min(3, x | 0)); }, gf = C.GRAVE_FACTOR[T(Z.tier)], k = z.keep;
    meals.forEach(function (a) { var s = Math.min(0.95, C.MEAL_SHARE[T(a.tier)] * (a.neglected ? 1.5 : 1) * gf); k = Math.round(k * (1 - s) * 1e6) / 1e6; });
    return Math.round(zPowAt(z, k)) - Math.round(zPowAt(z, z.keep)); }
  function zRpPts(x) { var P = (V.CEM && V.CEM.POINTS) || [1, 3, 10, 33]; return P[Math.max(0, Math.min(3, (x && x.tier) | 0))]; }
  function zSortBar(kind, nd) { var val = kind === 'feed' ? '⚡ Power it adds: most first' : '✨ Points it adds: most first';
    var O = [['disc', '🗑️ Discarded first'], ['tier', 'Rarity: common first'], ['tier-d', 'Rarity: legendary first'], ['score', 'Pet score: lowest first'], ['score-d', 'Pet score: highest first'], ['pow', 'Power: lowest first'], ['pow-d', 'Power: highest first'], ['val-d', val]];
    return '<div class="zb-sortbar small"><label>Sort <select class="zb-sort">' + O.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('') + '</select></label>' +
      '<label>Rarity <select class="zb-tf"><option value="">All</option>' + TL.map(function (t, i) { return '<option value="' + i + '">' + esc(t) + '</option>'; }).join('') + '</select></label>' +
      '<label><input type="checkbox" class="zb-donly"> Discarded only</label>' + (nd ? ' <button type="button" class="q zb-alld">Select all discarded (' + fmt(nd) + ')</button>' : '') + ' <button type="button" class="q zb-none">Clear</button></div>'; }
  function zRows(w, L, H, valOf, unit) { var A = L.slice().sort(function (a, c) { return (H[c.id] ? 1 : 0) - (H[a.id] ? 1 : 0) || (a.tier | 0) - (c.tier | 0) || a.id - c.id; }).slice(0, 3000);
    return A.map(function (a) { var sc = zScore(w, a), pw = zPow(a), vl = valOf(a), d = H[a.id] ? 1 : 0;
      return '<label class="zb-opt" data-id="' + a.id + '" data-t="' + (a.tier | 0) + '" data-s="' + sc + '" data-p="' + pw + '" data-v="' + vl + '" data-d="' + d + '"><input type="checkbox" class="zb-pick' + (d ? ' zb-disc' : '') + '" value="' + a.id + '"> <span class="zb-nm">' + (d ? '<span class="zb-dt" title="Discarded">🗑️</span> ' : '') + esc(a.name || '#' + a.id) +
        ' <span class="muted">#' + a.id + ' · ' + TL[a.tier | 0] + ' · ' + esc(a.stageName || '') + (a.neglected ? ' · ripe' : '') + '</span></span> <span class="zb-mt">' + (sc >= 0 ? 'score ' + sc + ' · ' : '') + 'pow ' + fmt(pw) + '</span> <span class="zb-v' + (unit === '⚡' ? '' : ' rp') + '">+' + fmt(vl) + ' ' + unit + '</span></label>'; }); }
  function zPickSort(el) { var sel = el.querySelector('.zb-sort'), tf = el.querySelector('.zb-tf'), dn = el.querySelector('.zb-donly'); if (!sel) return; var m = sel.value, desc = /-d$/.test(m), key = m.replace(/-d$/, '');
    var N = function (r, k) { return +r.getAttribute('data-' + k) || 0; }, f = { disc: 'd', tier: 't', score: 's', pow: 'p', val: 'v' }[key] || 'd';
    el.querySelectorAll('.zb-list').forEach(function (list) { var R = Array.prototype.slice.call(list.querySelectorAll('.zb-opt'));
      R.sort(function (a, c) { var x = N(a, f), y = N(c, f); if (key === 'disc') return y - x || N(a, 't') - N(c, 't') || N(a, 'id') - N(c, 'id'); return (desc ? y - x : x - y) || N(c, 'd') - N(a, 'd') || N(a, 'id') - N(c, 'id'); });
      R.forEach(function (r) { list.appendChild(r); r.style.display = (tf && tf.value !== '' && N(r, 't') !== +tf.value) || (dn && dn.checked && !N(r, 'd')) ? 'none' : ''; }); }); }
  function zPendIds(acts, z) { var o = []; myPendingTags().forEach(function (tag) { var t = V.parseTag ? V.parseTag(tag) : null; if (t && acts.indexOf(t.action) >= 0 && (z == null || +t.zombie === +z)) (t.ids || []).forEach(function (id) { o.push(+id); }); }); return o; }
  function zPledgedAny(w, id) { return (w.pets || []).some(function (Z) { return Z.zombie && !Z.zombie.end && (Z.zombie.rpl || []).some(function (e) { return e.id === id; }); }); }
  /* Resurrection pledge picker (owner Oct 30 2026 7:54 PM CT "should be able to sacrifice more than one at a time and should have animation"): the
   * zombie's card lists your pets (discarded first, starred never) and your gear; tick any number; the card shows the running points total and the
   * live chance (V.cemResInfo on the zombie with the ticked pets added, read-only). Packing: the rules parse only the list form for rpl / rplg
   * (pet:rpl:Z:A.B.C, base-32, ascending, 34 bytes; there is no range form for rpl), so picks are packed greedily into as few list tags as fit,
   * one Resurrection pledge fee (V.cemCost 'rpl') per burn. Pledged pets are only used up when the Resurrection is tried. Rules unchanged. */
  function zRplPlans(w, z, act, ids, b) { var s = ids.slice().sort(function (a, c) { return a - c; }).filter(function (x, i, A) { return !i || A[i - 1] !== x; }), out = [], i = 0, cost = V.cemCost(w, 'rpl', b);
    while (i < s.length) { var lst = [], k = i; while (k < s.length) { var t = 'pet:' + act + ':' + z + ':' + lst.concat([s[k]]).map(zB32).join('.'); if (t.length > 34) break; lst.push(s[k]); k++; }
      if (!lst.length) { i++; continue; } out.push({ tag: 'pet:' + act + ':' + z + ':' + lst.map(zB32).join('.'), amount: cost, petId: z, label: 'rpl', zEat: lst }); i = k; }
    return out; }
  function zMyGear(w, Z, b) { var pend = zPendIds(['rplg'], Z.id), on = {}; (Z.zombie.rpl || []).forEach(function (e) { if (e.gid) on[e.gid] = 1; });
    return Object.keys(w.items || {}).map(function (k) { return w.items[k]; }).filter(function (g) { if (!g || !/^g\d+$/.test(g.gid || '') || g.owner !== ME || on[g.gid] || !V.cemGearWhy || V.cemGearWhy(w, g, ME, b)) return false; return pend.indexOf(+g.gid.slice(1)) < 0; })
      .sort(function (a, c) { return (a.tier | 0) - (c.tier | 0) || (+a.gid.slice(1)) - (+c.gid.slice(1)); }); }
  function zResInfo(w, Z, pets, gids, b) { var z = Z.zombie, F = { id: Z.id, owner: Z.owner, tier: Z.tier, zombie: { rpl: (z.rpl || []).concat(pets.map(function (id) { return { id: id }; }), gids.map(function (n) { return { gid: 'g' + n }; })) } };
    try { return V.cemResInfo(w, F, b); } catch (e) { return { points: 0, chance: 0 }; } }
  function zRplHtml(p, w) { if (!ZB(p) || !ME || p.owner !== ME || !V.cemOn || !V.cemCost || !V.cemResInfo) return ''; var b = (S.tip || 0) + 1; if (!V.cemOn(b)) return '';
    var pend = zPendIds(['zfeed', 'rpl']), mine = zPendIds(['rpl', 'rplg'], p.id), z = p.zombie, done = {}; (z.rpl || []).forEach(function (e) { if (e.id != null) done[e.id] = 1; });
    var all = zMeals(w, ME, b).filter(function (a) { return a.id !== p.id && pend.indexOf(a.id) < 0 && !done[a.id] && !zPledgedAny(w, a.id); }), L = all.filter(function (a) { return !isKept(a.id); }), kept = all.length - L.length;
    var H = zDiscarded(w), D = L.filter(function (a) { return H[a.id]; }), G = zMyGear(w, p, b), cost = V.cemCost(w, 'rpl', b), MIN = (V.CEM && V.CEM.RES_MIN) || 25, ri = V.cemResInfo(w, p, b);
    var pl = (ri.pets || []).map(function (a) { return esc(a.name || '#' + a.id) + ' #' + a.id + ' (+' + zRpPts(a) + ')'; }).concat((ri.gear || []).map(function (g) { return esc(g.label || g.gid) + ' (+' + zRpPts(g) + ')'; }));
    var gr = G.slice(0, 400).map(function (g) { var n = +g.gid.slice(1), v = zRpPts(g); return '<label class="zb-opt" data-id="' + n + '" data-t="' + (g.tier | 0) + '" data-s="-1" data-p="0" data-v="' + v + '" data-d="0"><input type="checkbox" class="zb-gpick" value="' + n + '"> <span class="zb-nm">' + esc(g.label || g.gid) + ' <span class="muted">' + esc(g.gid) + ' · ' + TL[g.tier | 0] + (g.slot ? ' · ' + esc(g.slot) : '') + (g.on != null ? ' · worn by #' + g.on : '') + '</span></span> <span class="zb-v rp">+' + v + ' ✨</span></label>'; }).join('');
    return '<div class="zb-feed zb-pk zb-rpl" data-zr="' + p.id + '" data-pk="rpl">' + (pl.length ? '<div class="small zb-pled">😇 Already pledged: ' + pl.join(', ') + '</div>' : '') +
      (mine.length ? '<div class="small zb-pend">⏳ Pledge waiting for a block: ' + mine.length + ' item' + (mine.length > 1 ? 's' : '') + '. It counts when that burn confirms.</div>' : '') +
      '<details class="zb-pickbox"><summary class="small">😇 Pledge pets &amp; gear to ' + esc(p.name || '#' + p.id) + '’s Resurrection <span class="muted">(' + ri.points + (ri.bonus ? ' + ' + ri.bonus + ' Halloween' : '') + ' of ' + MIN + ' points · ' + Math.round(ri.chance * 100) + '% chance)</span></summary>' +
      '<p class="small zb-warn">Pledged pets and gear are <b>used up when the Resurrection is tried</b>, win or lose. Points by rarity: ' + TL.map(function (t, i) { return esc(t) + ' ' + zRpPts({ tier: i }); }).join(' · ') + '. It needs ' + MIN + ' points to try. The fee is ' + fmt(cost) + ' XCPETS <b>per burn</b>; one burn pledges as many as fit in it. Nothing is ticked for you.' + (kept ? ' ★ Starred pets are never listed (' + fmt(kept) + ').' : '') + '</p>' +
      zSortBar('rpl', D.length) + '<div class="zb-list">' + (zRows(w, L, H, zRpPts, '✨').join('') || '<div class="small muted">No pets you can pledge.</div>') + '</div>' +
      (G.length ? '<details class="zb-gear"><summary class="small">🛡️ Your gear (' + fmt(G.length) + ')</summary><div class="zb-list">' + gr + '</div></details>' : '') +
      '<div class="small zb-sum"></div></details>' +
      '<button type="button" class="btn zb-feedbtn" disabled>' + zRplBtn(w, p.id, [], [], b) + '</button> <button type="button" class="btn ghost zb-resbtn"' + (ri.points < MIN ? ' disabled title="Needs ' + MIN + ' points"' : '') + '>😇 Resurrect · ' + fmt(V.cemCost(w, 'resurrect', b)) + ' XCPETS</button></div>'; }
  function zRplBtn(w, z, ids, gids, b) { if (!ids.length && !gids.length) return '😇 Tick pets or gear above to pledge'; var cost = V.cemCost(w, 'rpl', b), n = zRplPlans(w, z, 'rpl', ids, b).length + zRplPlans(w, z, 'rplg', gids, b).length, c = ids.length + gids.length;
    return '😇 Pledge ' + fmt(c) + ' · ' + n + ' burn' + (n > 1 ? 's' : '') + ' × ' + fmt(cost) + ' = ' + fmt(cost * n) + ' XCPETS'; }
  function zFeedBind(root) { if (!root) return; root.querySelectorAll('.zb-pk').forEach(function (el) { if (el._zb) return; el._zb = true; var rp = el.dataset.pk === 'rpl', z = +(el.dataset.zf || el.dataset.zr);
    function picked(c) { return Array.prototype.map.call(el.querySelectorAll((c || '.zb-pick') + ':checked'), function (x) { return +x.value; }); }
    function upd() { var w = world(), b = (S.tip || 0) + 1, ids = picked(), gids = rp ? picked('.zb-gpick') : [], bt = el.querySelector('.zb-feedbtn'), sm = el.querySelector('.zb-sum'), Z = w.byId[z]; bt.disabled = !ids.length && !gids.length;
      bt.textContent = rp ? zRplBtn(w, z, ids, gids, b) : zBtnText(w, z, ids, b); if (!sm || !Z) return;
      if (!rp) { var p0 = +sm.dataset.pow || 0, g = ids.length ? zMealGain(w, Z, ids.map(function (i) { return w.byId[i]; }).filter(Boolean)) : 0; sm.innerHTML = ids.length ? 'Ticked <b>' + ids.length + '</b> · power <b>' + fmt(p0) + ' → ' + fmt(p0 + g) + '</b> (+' + fmt(g) + ' ⚡) · hunger refills to <b>100%</b>' : ''; return; }
      var MIN = (V.CEM && V.CEM.RES_MIN) || 25, a = zResInfo(w, Z, [], [], b), c = zResInfo(w, Z, ids, gids, b), P = c.points + (c.bonus || 0);
      sm.innerHTML = (ids.length || gids.length ? 'Ticked <b>' + (ids.length + gids.length) + '</b> · points <b>' + a.points + ' → ' + c.points + '</b>' + (c.bonus ? ' (+' + c.bonus + ' Halloween)' : '') + ' of ' + MIN + ' · chance <b>' + Math.round(a.chance * 100) + '% → ' + Math.round(c.chance * 100) + '%</b>' + (c.points < MIN ? ' <span class="lo">· needs ' + (MIN - c.points) + ' more to try</span>' : '') : '') + (P < 0 ? '' : ''); }
    el.addEventListener('change', function (e) { if (e.target.closest('.zb-sort,.zb-tf,.zb-donly')) { zPickSort(el); return; } if (e.target.classList.contains('zb-pick') || e.target.classList.contains('zb-gpick')) upd(); });
    el.addEventListener('click', function (e) { e.stopPropagation(); if (e.target.closest('.zb-alld,.zb-none')) { var on = !!e.target.closest('.zb-alld'); el.querySelectorAll(on ? '.zb-pick.zb-disc' : '.zb-pick,.zb-gpick').forEach(function (c) { c.checked = on; }); upd(); return; }
      var w = world(), b = (S.tip || 0) + 1, Z = w.byId[z];
      if (e.target.closest('.zb-resbtn')) { if (!Z || e.target.closest('.zb-resbtn').disabled) return; var ri = V.cemResInfo(w, Z, b); confirmPlans('😇 Try the Resurrection of ' + esc(Z.name || '#' + z) + ' #' + z + ' · ' + ri.points + ' points · ' + Math.round(ri.chance * 100) + '% chance · every pledged pet and gear is used up, win or lose', [{ tag: V.cemPlan(w, 'resurrect', z, null, b).tag, amount: V.cemCost(w, 'resurrect', b), petId: z, label: 'resurrect' }]); return; }
      var bt = e.target.closest('.zb-feedbtn'); if (!bt) return; var ids = picked(), gids = rp ? picked('.zb-gpick') : [];
      if (!Z || (!ids.length && !gids.length)) return toast('Tick the ' + (rp ? 'pets or gear you want to pledge to ' : 'pets you want ') + (Z ? esc(Z.name || '#' + z) : 'the zombie') + (rp ? '' : ' to eat') + ' first.');
      var names = ids.map(function (f) { var F = w.byId[f]; return esc((F && F.name) || '#' + f) + ' #' + f; }).concat(gids.map(function (n) { var g = w.items['g' + n]; return esc((g && g.label) || 'g' + n) + ' (gear)'; }));
      var nm = names.slice(0, 6).join(', ') + (names.length > 6 ? ' +' + (names.length - 6) + ' more' : '');
      if (!rp) return confirmPlans('🍖 Feed zombie ' + esc(Z.name || '#' + z) + ' #' + z + ' · eats ' + ids.length + ' pet' + (ids.length > 1 ? 's' : '') + ' for good: ' + nm, zFeedPlans(w, z, ids, b));
      var c = zResInfo(w, Z, ids, gids, b); confirmPlans('😇 Pledge to the Resurrection of ' + esc(Z.name || '#' + z) + ' #' + z + ' · ' + names.length + ' (used up when it is tried): ' + nm + ' · points → ' + c.points + ' · chance → ' + Math.round(c.chance * 100) + '%', zRplPlans(w, z, 'rpl', ids, b).concat(zRplPlans(w, z, 'rplg', gids, b))); });
    el.addEventListener('keydown', function (e) { e.stopPropagation(); }); }); }
  'use strict';
  /* power-tooltip-values (Oct 25 2026, display only): hovers show the pet's real numbers (js/v2-power-tip.js) */
  function ptA(p) { return window.V2PowerTip ? V2PowerTip.attr(V2PowerTip.power(p)) : ''; } 
  var V = window.V2Rules, $ = function (id) { return document.getElementById(id); }, KEY = V2Mock.KEY, ME = V2Mock.ME;
  /* feed-all-pause (owner Oct 27 2026 10:03 PM CT 'yes take it off'): ONE flag, front end only, rules and replay unchanged.
   * true = the one-burn Feed all (pet:fa / fx / fy) and its skip-list setup burns (pet:sk / su) are off: Feed all hungry is hidden,
   * Feed selected and single feeds use plain pet-number feed burns (pet:feed / fl / fm), and an unfinished Feed all run is not continued.
   * UNDO: set FEED_ALL_PAUSED = false, re-stamp the build, deploy.
   * feed-all-unpause (owner Oct 27 2026 11:17 PM CT, deployed at tip >= ACTIVATE_FEEDALL_LIVECHECK_BLOCK 973496): Feed all hungry is back
   * (pet:fa / fx / fy now skip dead pets on chain). Feed selected KEEPS the plain pet-number list burns (pet:feed / fl / fm): feedQ(..., list=true). */
  var FEED_ALL_PAUSED = false, FA_NOTE = 'Feed all is paused for a fix.';
  window.XCPETS_FEED_ALL_PAUSED = FEED_ALL_PAUSED;
  function isFeedAllTag(tag) { return /^pet:(fa|fx|fy|sk|su)(:|$)/i.test(String(tag || '')); }
  /* feedQueue for the UI: while paused, plan as if the feed-all gate were not reached (same pet-number bundles as before it) */
  function faNb(w, nb, list) { var b = nb != null ? nb : ((w && w.tip) || 0); return (FEED_ALL_PAUSED || list) && V.feedAllOn(b) ? V.FEED_ALL_BLOCK - 1 : nb; }
  /* feed-all-one-burn (owner Oct 28 2026 8:28 PM CT): once the chain reaches V.ACTIVATE_FEED_RUNS_BLOCK, Feed all hungry and Feed selected feed only pets
   * that really eat (V.frEats: no Mythic, no pet away on a quest) and use ONE pet:fr burn for the total (more only if the 34-byte tag can't hold the
   * runs), whenever that is no more burns than the old plan. Below the gate: exactly the old plans. */
  function runsOn(w, nb) { var b = nb != null ? nb : ((w && w.tip) || 0); return !!(V.feedRunsOn && V.feedRunsOn(b)) ? b : null; }
  function eaters(w, me, ids, nb) { return (ids || w.pets.filter(function (p) { return p.owner === me; }).map(function (p) { return p.id; })).filter(function (id) { var p = w.byId[id]; return p && p.owner === me && V.frEats(p, nb); }); }
  function feedQold(w, me, ids, nb, list) { var q = V.feedQueue(w, me, ids, faNb(w, nb, list)); return (FEED_ALL_PAUSED || list) ? q.filter(function (p) { return !isFeedAllTag(p.tag); }) : q; }
  function feedQ(w, me, ids, nb, list) { var rb = runsOn(w, nb); if (rb == null) return feedQold(w, me, ids, nb, list);
    var ok = eaters(w, me, ids, rb), fr = ok.length > 1 ? V.feedRunsPlan(w, me, ok.map(function (id) { return w.byId[id]; }), rb) : null;
    if (fr && (ok.length >= 300 || fr.length === 1)) return fr; /* big feeds: the runs plan, without the slow pet-number planner */
    var q = feedQold(w, me, ok, nb, list); return fr && fr.length <= q.length ? fr : q; }
  function feedSelQ(w, me, ids, nb) { return feedQ(w, me, ids, nb, true); } /* Feed selected: list burns only */
  var fmt = function (n) { n = Number(n); return n.toLocaleString('en-US', { maximumFractionDigits: Math.abs(n) >= 1 || n === 0 ? 2 : 8 }); }; /* >= 1: 2 decimals (hides float noise like 1,335,328.99999996) */
  /* similar-bugs-fix: the accept cost of fight id now (a Tag Team accept costs the team cost, not the 1v1 accept), same halving / Fire Sale as V.COSTS. Display only; planAmount sets the burn. */
  function accNow(w, id) { return V.COSTS.accept * V.acceptCost(w, id) / V.acceptCost(null, 0); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }

  // ---------------------------------------------------------------- chain state (shared with the other pages: js/v2-chain.js, V2Mock interface)
  var M = window.V2Mock, S = M.state();
  try { window.addEventListener('xcpets-ops-sync', function () { try { render(); } catch (e) {} }); } catch (e) {} /* gear-stick: equips saved in another tab show here too */
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
    toast('🗑️ Moved ' + ids.length + ' pet' + (ids.length > 1 ? 's' : '') + ' to the Discard pile (only hidden in this browser, still on chain). <a href="#" class="undo">Undo</a>', 9000);
    var u = $('toasts').lastChild.querySelector('.undo'); if (u) u.onclick = function (e) { e.preventDefault(); restoreLocal(ids); this.parentNode.remove(); }; }
  function idList(ids) { return '#' + ids.slice(0, 5).join(', #') + (ids.length > 5 ? ' +' + (ids.length - 5) + ' more' : ''); }
  var JUST_BACK = []; /* restore-fix (owner Oct 27 2026, "I can't find my never fed pets I took out of the discard pile"): pets restored this visit go to the top of My Pets, outside the Never fed fold, so they show right away (they used to land folded inside Never fed, often past the first 150 cards) */
  function restoreLocal(ids) { setHidden(hiddenIds().filter(function (x) { return ids.indexOf(x) < 0; })); JUST_BACK = ids.map(Number).concat(JUST_BACK.filter(function (x) { return ids.indexOf(x) < 0; })); render(); toast('↩️ Restored ' + idList(ids) + ' to My Pets. They are at the top of the list.'); }
  /* mypets-checkbox (owner Oct 28 2026 10:21 AM CT: "No stars bring back check box"): stars are retired. The ☑ checkbox on each card (S.sel) is the
   * one mark. The old browser-only star list (localStorage xcpets-keep-<network>-<address>) is left untouched: never read, never written, so no
   * hidden star protects or picks anything. keptIds / isKept / toggleKeep / keepFed / keepBtn stay as no-ops for older callers. Nothing on chain. */
  /* favorite-star-restore (owner Oct 29 2026: "Players want the star back. They use it to mark favorite pets"): the ★ is back as its OWN favorite
   * marker, next to the ☑ checkbox (the checkbox stays the selection for Feed / Discard / Rare Room). Same browser-only list as before
   * (localStorage xcpets-keep-<network>-<address>), so stars saved by older builds show again. A star does not pick pets for bulk actions.
   * Owner Oct 29 2026 (6 PM CT): BOTH old star behaviours are back, as the pre-8ef7007 code did them: a feed burn sent from this browser stars
   * the fed pets (keepFed + once-per-pet autoStarBackfill), and starred pets are never discarded (discardIds / dropKept skip them with a note,
   * card 🗑️ / detail / Discard selected / Discard unfed / hatch review). Nothing on chain. */
  function keepKey() { return 'xcpets-keep-' + NET + '-' + (ME || ''); }
  function keptIds() { try { var l = JSON.parse(localStorage.getItem(keepKey()) || '[]'); return Array.isArray(l) ? l.map(Number) : []; } catch (e) { return []; } }
  function isKept(id) { return keptIds().indexOf(Number(id)) >= 0; }
  function toggleKeep(id) { id = Number(id); var l = keptIds(), i = l.indexOf(id); if (i >= 0) l.splice(i, 1); else l.push(id); try { localStorage.setItem(keepKey(), JSON.stringify(l)); } catch (e) { }
    var on = i < 0; document.querySelectorAll('.keepbtn[data-keep="' + id + '"]').forEach(function (b) { b.textContent = on ? '★' : '☆'; b.setAttribute('aria-pressed', String(on)); b.title = on ? 'Favorite: never discarded. Click to unstar.' : 'Star this pet as a favorite (never discarded)'; });
    toast(on ? '★ #' + id + ' starred: a favorite, never discarded.' : '☆ #' + id + ' unstarred: it can be discarded again.'); try { document.dispatchEvent(new CustomEvent('xcpets-stars')); } catch (e) { }
    if (S.ui_starOnly || $('fSort').value === 'starred' || /\b(starred|kept|favorite)\b/i.test(($('fSearch') || {}).value || '')) setTimeout(render, 0); return on; }
  /* pickIds() = the CHECKED pets you own that are alive, not released and not discarded in this browser. The Rare Room multi-pet roll, Auto-equip,
   * Outfit, the lair 'Acts on' chip and the swipe view act on them (as before starred-acts). starIds stays as an alias for older callers. */
  function pickIds(w) { w = w || world(); if (!ME || !w) return []; var hs = new Set(hiddenIds()); return S.sel.map(Number).filter(function (id) { var p = w.byId[id]; return p && p.owner === ME && !p.dead && !p.released && !hs.has(id); }); }
  var starIds = pickIds;
  /* owner add-on 2026-10-21 (restored Oct 29 2026): a feed burn sent from this browser stars the fed pets (never un-stars), so a later bulk discard can't take them. UI/localStorage only. */
  function keepFed(tag, plan) { var t = V.parseTag(tag), ids = !t ? [] : t.action === 'feed' ? [t.petId] : (t.action === 'feedm' || t.action === 'feedl') ? t.ids : [];
    if (!ids.length && plan && !plan.setOnly && Array.isArray(plan.petIds) && /^pet:(fr|fa|fx|fy|fl|fm|feed):/i.test(String(tag) + ':')) ids = plan.petIds; /* Oct 30 2026: Feed all / Feed selected run burns (pet:fr runs, pet:fa/fx/fy) carry the fed ids on the plan */ if (!ids.length) return 0; var l = keptIds(), n = 0;
    ids.forEach(function (id) { id = Number(id); if (l.indexOf(id) < 0) { l.push(id); n++; document.querySelectorAll('.keepbtn[data-keep="' + id + '"]').forEach(function (b) { b.textContent = '★'; b.setAttribute('aria-pressed', 'true'); b.title = 'Favorite: never discarded. Click to unstar.'; }); } });
    if (n) try { localStorage.setItem(keepKey(), JSON.stringify(l)); } catch (e) { } return n; }
  function keptToast(n) { if (n) toast('★ ' + fmt(n) + ' fed pet' + (n > 1 ? 's' : '') + ' starred: never discarded.', 7000); }
  /* backfill auto-star (owner 2026-10-21 9:18 PM, restored Oct 29 2026): once per pet, star every owned living pet that has ever been fed; the per-address
   * autoStarSeen set means a later un-star is respected. UI/localStorage only. */
  function autoStarBackfill(w) { if (!ME || !w || !w.pets) return; var sk = 'xcpets-v2-autoStarSeen-' + NET + '-' + ME, seen; try { seen = JSON.parse(localStorage.getItem(sk) || '[]'); } catch (e) { seen = []; }
    var ss = {}; seen.forEach(function (id) { ss[id] = 1; }); var l = keptIds(), ks = {}; l.forEach(function (id) { ks[id] = 1; }); var n = 0, add = 0;
    w.pets.forEach(function (p) { if (p.owner !== ME || p.dead || p.released || ss[p.id]) return; if (p.lastFed == null && !Object.keys(p.feedDays || {}).length) return;
      seen.push(p.id); add++; if (!ks[p.id]) { l.push(p.id); ks[p.id] = 1; n++; } });
    if (!add) return; try { localStorage.setItem(sk, JSON.stringify(seen)); if (n) localStorage.setItem(keepKey(), JSON.stringify(l)); } catch (e) { }
    if (n) { document.querySelectorAll('.keepbtn[data-keep]').forEach(function (b) { if (ks[b.dataset.keep]) { b.textContent = '★'; b.setAttribute('aria-pressed', 'true'); } }); toast('★ ' + fmt(n) + ' fed pet' + (n > 1 ? 's' : '') + ' starred: never discarded.', 8000); } }
  function keepBtn(id) { var on = isKept(id); return '<button type="button" class="keepbtn" data-keep="' + id + '" aria-pressed="' + on + '" aria-label="Favorite #' + id + '" title="' + (on ? 'Favorite: never discarded. Click to unstar.' : 'Star this pet as a favorite (never discarded)') + '">' + (on ? '★' : '☆') + '</button>'; } /* favorite-star-restore: the original ☆/★ button (css .keepbtn) */
  function dropKept(ids) { var k = keptIds(); return ids.filter(function (id) { return k.indexOf(Number(id)) < 0; }); }
  /* discard-pile 2026-10-21 (restored Oct 29 2026): starred pets are NEVER discarded, on every path (card 🗑️, detail, Discard selected, pack review, #discard-ID). Unstar first. */
  function discardIds(ids) { if (!ids.length) { toast('Tick the box on at least one pet first.'); return; } var kk = ids.filter(isKept); ids = dropKept(ids);
    if (kk.length) toast('★ Skipped ' + idList(kk) + ': starred pets are never discarded. Unstar ' + (kk.length > 1 ? 'them' : 'it') + ' first.', 7000); if (ids.length) hideLocal(ids); }
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
   *  - OFF (default): every newly landed piece that replay put on goes to your stock; the pet keeps what it wore before the batch (or that slot is emptied).
   *  - ON: works as before, but never a downgrade: if the pet wore a better piece in that slot before the batch (or an earlier piece of the same batch
   *    is better), that one goes back on and the new one goes to your stock. Rank = tier, ★ legendary highest; ties keep the newest.
   * Battle spoils (owner, 2026-10-19): a piece your pet wins in a battle or rumble (replay: worn only if that slot was empty) follows the same setting:
   *    OFF: it goes to your stock; ON: it is worn unless the pet already wears something better in that slot (ties keep the newest). Same free local ops.
   * Community pet (Bitcoin Wizard): not a player item, always wears its newest community roll; no setting. */
  var AEKEY = 'xcpets-v2-autoequip-' + KEY + '-' + ME;
  function autoEquipIsOn() { try { return localStorage.getItem(AEKEY) === 'on'; } catch (e) { return false; } }
  function setAutoEquip(on) { try { localStorage.setItem(AEKEY, on ? 'on' : 'off'); } catch (e) { } document.querySelectorAll('[data-aetog]').forEach(paintAeTog); }
  function paintAeTog(b) { var on = autoEquipIsOn(); b.textContent = on ? 'On' : 'Off'; b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.classList.toggle('on', on); }
  function aeToggleHtml() { return '<span class="aetog small">Auto-equip new gear: <button type="button" class="q" data-aetog="1" aria-pressed="false">Off</button> <span class="muted">On: a new piece is worn right away, never a downgrade. Off: it goes to your stash.</span></span>'; }
  function bindAeTogs(root) { (root || document).querySelectorAll('[data-aetog]').forEach(function (b) { paintAeTog(b); b.onclick = function () { setAutoEquip(!autoEquipIsOn()); toast('Auto-equip new gear: ' + (autoEquipIsOn() ? 'On. New pieces are worn right away unless the pet already wears something better.' : 'Off. New pieces go to your stash.') + ' Applies to gear that lands from now on.', 6000); }; }); }
  function wornInSlot(w, pid, slot) { return V.wornOf(w, pid).filter(function (g) { return g.slot === slot; })[0] || null; }
  function gearRank(g) { return g ? (g.legendary ? 4 : (g.tier || 0)) : -1; }
  function autoEquipChoice(w, wins) { if (viewOnly()) return 0; /* address-lookup: view only never writes equips */
    var by = {}, logB = {}, minB = Infinity, on = autoEquipIsOn();
    (w.log || []).forEach(function (l) { if (l.gid) logB[l.gid] = l.block; });
    wins.forEach(function (x) { var g = w.items[x.gid]; if (!g || g.owner !== ME || g.wonBy != null || g.wheel || x.rolledOn == null || !/^(roll|token|froll|oroll)$/.test(g.src || '')) return; var b = logB[x.gid]; if (b == null) return;
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
      if (!on) { if (cur && e.wins.indexOf(cur) >= 0) ops.push({ kind: 'equip', owner: ME, petId: e.pet, slot: e.slot, gid: null, block_index: S.tip }); return; } /* OFF: to stock */
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
  function communityName(w) { var c = w.community; return c && c.current === 'homer' ? 'Homer Pepe, the community pet' : c && c.current === 'funtrump' ? 'FUNTRUMP, the community pet' : c && c.current === 'kek' ? 'Lord Kek, the community pet' : c && c.returned && !w.wizardMythic ? 'the Bitcoin Wizard, the community pet' : 'the community pet'; }
  // ---------------------------------------------------------------- hatch popup = live #packBox review (live game.js showPack/drawPack), gear wins use the same box
  var packY = null, lastHatchN = 0; /* hatch-exit 2026-10-21: scroll spot when the results opened + size of the last hatch (for 🥚 Hatch more) */
  var HKEY = 'xcpets-v2-hatched-' + KEY + '-' + ME, revealQ = [], rev = null, REV_PAGE = 36, TIERS = (window.PetCore && PetCore.TIERS) || [{ label: 'Common' }, { label: 'Uncommon' }, { label: 'Rare' }, { label: 'Legendary' }];
  function notifyHatch(w) { dataSeen();
    var seen = null; try { seen = JSON.parse(localStorage.getItem(HKEY)); } catch (e) { }
    var r = V.newHatches(w, ME, seen); try { localStorage.setItem(HKEY, JSON.stringify(r.seen)); } catch (e) { }
    r.groups.forEach(function (g) { revealQ.push({ kind: 'eggs', eggs: g.eggs.map(function (p) { return p.id; }) }); }); return r.groups;
  }
  var wspinOn = false; /* wheel-spin-anim: the 8-bit Pepe Wheel reveal (js/v2-wheel-anim.js) plays once before a gear batch that came from a wheel spin. Display only. */
  function nextReveal() { if (wspinOn || $('packBox').classList.contains('on') || !revealQ.length) return; if (holding()) { heldR = true; awayPing(); return; } rev = revealQ.shift(); rev.page = 0; rev.sel = {}; if (rev.kind === 'eggs' && rev.sort == null && rev.eggs.length > 1) rev.sort = 'rar'; if (rev.kind === 'eggs') { rev.n0 = rev.eggs.length; rev.gone = 0; } /* pet-flow-smoother: a hatch review opens Rarest first (Legendaries on page 1); the Sort menu still offers Hatch order */ if (packY == null) packY = window.scrollY || 0; if (rev.kind === 'eggs') lastHatchN = rev.eggs.length;
    var WA = window.V2WheelAnim, ws = null; if (rev.kind === 'gear' && WA) try { ws = WA.fromWins(rev.wins, world(), communityName(world())); } catch (e) { ws = null; }
    if (ws) { wspinOn = true; var r0 = rev; WA.reveal(ws, function () { wspinOn = false; if (rev !== r0) return; drawReveal(); open('packBox'); }); return; }
    drawReveal(); open('packBox'); }
  /* egg-review-sort 2026-10-24: the sort options and logic now live in js/pet-sort.js (PetSort), shared with Gooby's Hotel mate search. */
  function sortEggs(w, list, k) { return window.PetSort ? PetSort.sort(w, list, k) : list; }
  /* hatch-review-simple 2026-10-28 (owner 1:28 AM CT: 'I dont like ticked duds. we need better wording. make this all very simple to do and sort through').
   * Replaces the Dud Duster wording and controls. UI only: hiding = the SAME free local Discard (hidden in this browser, Undo, restorable from the
   * Discard pile). No burn, no wallet, no chain rule touched, replay unchanged. Protected pets (Legendary, Mythic, wearing gear, starred) are never
   * picked by Keep Rare and up or Select all, and need an extra confirm to select by hand; starred pets can't be hidden at all (restored Oct 29 2026). */
  function dudGuard(w, p) { var r = []; if (p.art && p.art.tierIndex >= 3) r.push(TIERS[p.art.tierIndex].label); if (p.stage === 5) r.push('Mythic');
    var n = R.worn ? R.worn(w, p.id).length : 0; if (n) r.push('wearing ' + n + ' gear piece' + (n > 1 ? 's' : '')); if (isKept(p.id)) r.push('starred'); return r; }
  var REV_SHOW = [['all', 'All'], ['my', 'Mythic'], ['3', 'Legendary'], ['2', 'Rare'], ['1', 'Uncommon'], ['0', 'Common']];
  function revShows(f, x) { return f === 'all' || !f || (f === 'my' ? x.stage === 5 : f === 'sel' ? !!rev.sel[x.id] : String(x.art.tierIndex) === f); }
  function plural(n, a) { return n.toLocaleString('en-US') + ' ' + a + (n === 1 ? '' : 's'); }
  function revHide(ids, msg) { /* one confirm, then the usual free local discard; the review keeps going with what is left */
    var kk = ids.filter(isKept), go = ids.length - kk.length; if (!go) { toast('★ Starred pets can\'t be hidden. Unstar them first.', 6000); return; }
    if (!window.confirm(msg + (kk.length ? '\n\n★ ' + kk.length + ' starred pet' + (kk.length > 1 ? 's stay' : ' stays') + ' (starred pets are never hidden).' : '') + '\n\nThey go to the 🗑️ Discard pile in My Pets. Free, no burn, only in this browser. Undo anytime.')) return;
    hideIds(ids); ids = ids.filter(function (id) { return kk.indexOf(id) < 0; }); /* starred pets stay in the review too */ rev.gone = (rev.gone || 0) + go; rev.eggs = rev.eggs.filter(function (id) { return ids.indexOf(id) < 0; }); ids.forEach(function (id) { delete rev.sel[id]; });
    if (rev.f !== 'all' && rev.f !== 'sel') { var w = world(); if (!rev.eggs.some(function (id) { var x = w.byId[id]; return x && revShows(rev.f, x); })) rev.f = 'all'; }
    if (rev.eggs.length) drawReveal(); else closeReveal(); }
  function revKeepTier(w, all, top) { /* top 1 = Keep Rare and up (hides Common + Uncommon), top 2 = Keep Legendary and up (also hides Rare) */
    var ids = all.filter(function (x) { return x.art.tierIndex <= top && !dudGuard(w, x).length; }).map(function (x) { return x.id; });
    revHide(ids, (top === 1 ? 'Keep Rare and up?\n\nThis hides ' + plural(ids.length, 'Common and Uncommon pet') : 'Keep Legendary and up?\n\nThis hides ' + plural(ids.length, 'Common, Uncommon and Rare pet')) + '. Mythic, starred and gear-wearing pets always stay.'); }
  function revKeepN(w, all, top) { return all.filter(function (x) { return x.art.tierIndex <= top && !dudGuard(w, x).length; }).length; }
  function revSelectShown(w, shown) { var n = 0, safe = 0; shown.forEach(function (x) { if (dudGuard(w, x).length) { safe++; return; } if (!rev.sel[x.id]) n++; rev.sel[x.id] = 1; });
    drawReveal(); toast('✓ Selected ' + plural(n, 'more pet') + ' (' + Object.keys(rev.sel).length.toLocaleString('en-US') + ' selected).' + (safe ? ' 🛡️ ' + plural(safe, 'protected pet') + ' left out.' : ''), 5000); }
  function revToggle(w, x, d) { var on = !rev.sel[x.id];
    if (on && isKept(x.id)) { toast('★ #' + x.id + ' is starred, so it can\'t be hidden. Unstar it first.', 6000); return; }
    if (on) { var gg = dudGuard(w, x); if (gg.length && !window.confirm('Select #' + x.id + ' to hide? It is ' + gg.join(', ') + '.')) return; rev.sel[x.id] = 1; } else delete rev.sel[x.id];
    d.classList.toggle('picked', on); d.setAttribute('aria-checked', String(on)); revCount(); }
  function revCount() { var n = Object.keys(rev.sel).length, b = $('packDiscard'); if (b) { b.textContent = 'Hide selected (' + n.toLocaleString('en-US') + ')'; b.disabled = !n; }
    var c = $('pkSelN'); if (c) c.textContent = n.toLocaleString('en-US'); var cl = $('pkClear'); if (cl) cl.hidden = !n; }
  function drawReveal() {
    var w = world(), gear = rev.kind === 'gear', list = gear ? rev.wins : rev.eggs.map(function (id) { return w.byId[id]; }).filter(Boolean), tiers = [0, 0, 0, 0];
    if (!gear) list = sortEggs(w, list, rev.sort); /* egg-review-sort 2026-10-24: display order only; rev.sel is keyed by pet id, so ticks survive re-sorting */
    var all = list; list.forEach(function (x) { tiers[gear ? (x.legendary ? 3 : x.tier) : x.art.tierIndex]++; });
    var nMy = gear ? 0 : list.filter(function (x) { return x.stage === 5; }).length;
    if (!gear) { if (!rev.f) rev.f = 'all'; list = all.filter(function (x) { return revShows(rev.f, x); }); if (!list.length && rev.f !== 'sel') { rev.f = 'all'; list = all; } } /* hatch-review-simple: the Show filter */
    var pages = Math.max(1, Math.ceil(list.length / REV_PAGE)); rev.page = Math.min(rev.page, pages - 1);
    $('packTitle').textContent = gear ? '🎁 ' + (list.length === 1 ? 'You got ' + list[0].label : list.length + ' new gear pieces') : ((rev.n0 || all.length) === 1 ? '1 egg hatched' : (rev.n0 || all.length).toLocaleString('en-US') + ' eggs hatched') + (tiers[3] ? ' · ' + tiers[3] + ' Legendary' : '') + (nMy ? ' · ' + nMy + ' Mythic' : '');
    $('packBox').classList.toggle('gearmode', gear); $('packTitle').setAttribute('data-ico', gear ? 'gear' : 'egg'); if ($('packNote')) { $('packNote').hidden = gear; if (!gear) $('packNote').textContent = 'Hiding is free and only in this browser. Undo anytime from 🗑️ Discard pile in My Pets.'; } /* the hide note belongs to the egg review only */
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
        '<p>Where they went: ' + [where.on ? where.on + ' equipped' : '', where.bag ? where.bag + ' in your stash' : '', where.comm ? where.comm + ' equipped on ' + esc(communityName(w)) : ''].filter(Boolean).join(' · ') + '</p>' +
        '<p class="grnext">' + (where.bag ? '👉 New gear is in your stash. Wear it in The Rare Room (free).' : '👉 See your whole stash in The Rare Room.') + '</p>' +
        '<p class="graemode">' + aeToggleHtml() + '</p></div>' +
        (UXB_CAP(list) ? '<p class="grcap" aria-hidden="true">' + esc(UXB_CAP(list)) + '</p>' : ''); }
    var tierLine = TIERS.map(function (t, i) { if (!tiers[i] && (gear || rev.gone)) return ''; var c = esc(tiers[i] + ' ' + t.label); return !gear && i >= 3 && tiers[i] ? '<b>' + c + '</b>' : c; }).filter(Boolean).join(' · ') + (nMy ? ' · <b>' + nMy + ' Mythic</b>' : '') + (rev.gone ? ' · <span class="muted">' + rev.gone.toLocaleString('en-US') + ' discarded (Undo in 🗑️ Discard pile)</span>' : '');
    var pager = pages > 1 ? ' <span class="pager"><button class="q" type="button" id="pkPrev"' + (rev.page ? '' : ' disabled') + '>‹ Prev</button> page ' + (rev.page + 1) + '/' + pages + ' <button class="q" type="button" id="pkNext"' + (rev.page < pages - 1 ? '' : ' disabled') + '>Next ›</button></span>' : '';
    if (gear) $('packSummary').innerHTML = info + '<span class="grtiers">' + tierLine + '</span>' + pager;
    else { /* hatch-review-simple: two equal quick choices, a Show filter by rarity, one Sort, Select all shown / Clear selection, the pager */
      var kR = revKeepN(w, all, 1), kL = revKeepN(w, all, 2), many = all.length > 1, cnt = { all: all.length, my: nMy, sel: Object.keys(rev.sel).length };
      tiers.forEach(function (n, i) { cnt[i] = n; });
      var keepRow = many && (kR || kL) ? '<div class="pkkeep" role="group" aria-label="Quick choices">' +
        '<button type="button" class="btn pkq" id="pkKeepRare" data-top="1"' + (kR ? '' : ' disabled') + '>Keep Rare and up<small>hides ' + kR.toLocaleString('en-US') + ' Common &amp; Uncommon</small></button>' +
        '<button type="button" class="btn pkq" id="pkKeepLeg" data-top="2"' + (kL ? '' : ' disabled') + '>Keep Legendary and up<small>hides ' + kL.toLocaleString('en-US') + ' Common, Uncommon &amp; Rare</small></button>' +
        '<div class="muted small pksafe">🛡️ Mythic, starred and gear-wearing pets always stay.</div></div>' : '';
      var chips = many ? '<div class="pkshow" role="group" aria-label="Show"><span class="muted">Show</span> ' + REV_SHOW.concat([['sel', '✓ Selected']]).filter(function (f) { return f[0] === 'all' || f[0] === 'sel' || cnt[f[0]]; }).map(function (f) {
        return '<button type="button" class="q pkchip' + (f[0] === '3' || f[0] === 'my' ? ' pkgold' : '') + '" data-f="' + f[0] + '" aria-pressed="' + (rev.f === f[0]) + '">' + f[1] + ' <b' + (f[0] === 'sel' ? ' id="pkSelN"' : '') + '>' + cnt[f[0]].toLocaleString('en-US') + '</b></button>'; }).join('') +
        (rev.gone ? '<span class="muted pkgone">' + rev.gone.toLocaleString('en-US') + ' hidden</span>' : '') + '</div>' : '';
      var tools = many ? '<div class="pktools"><label class="pksort">Sort <select id="pkSort" aria-label="Sort the pets">' + (window.PetSort ? PetSort.options(rev.sort) : '') + '</select></label>' +
        ' <button type="button" class="q" id="pkSelAll">Select all shown</button> <button type="button" class="q" id="pkClear"' + (cnt.sel ? '' : ' hidden') + '>Clear selection</button>' + pager + '</div>' +
        '<div class="muted small pktip">Tap a pet to select it, then Hide selected.</div>' : '';
      $('packSummary').innerHTML = keepRow + chips + tools; }
    bindAeTogs($('packSummary'));
    if (!gear) { $('packSummary').querySelectorAll('.pkq').forEach(function (b) { b.onclick = function () { revKeepTier(w, all, +b.dataset.top); }; });
      $('packSummary').querySelectorAll('[data-f]').forEach(function (b) { b.onclick = function () { rev.f = b.dataset.f; rev.page = 0; drawReveal(); var g = $('packGrid'); if (g) g.scrollTop = 0; }; });
      if ($('pkSelAll')) $('pkSelAll').onclick = function () { revSelectShown(w, list); };
      if ($('pkClear')) $('pkClear').onclick = function () { rev.sel = {}; if (rev.f === 'sel') rev.f = 'all'; drawReveal(); }; }
    if ($('pkSort')) $('pkSort').onchange = function () { rev.sort = this.value; rev.page = 0; drawReveal(); };
    if ($('pkPrev')) { $('pkPrev').onclick = function () { rev.page--; drawReveal(); }; $('pkNext').onclick = function () { rev.page++; drawReveal(); }; }
    var grid = $('packGrid'); grid.innerHTML = '';
    list.slice(rev.page * REV_PAGE, rev.page * REV_PAGE + REV_PAGE).forEach(function (x) {
      var d = document.createElement('div');
      if (gear) { d.className = 'egg gearwin t' + (x.legendary ? 3 : x.tier) + ' ux-flash ux-t' + (x.legendary ? 3 : x.tier || 0) + (x.legendary ? ' ux-fanfare' : ''); d.title = x._src.long; d.innerHTML = '<span class="ic"></span><div class="gwname"><b>' + esc(x.label) + '</b></div><div>' + esc(x.tierName) + (x.legendary ? ' ★' : '') + ' · ' + esc(x.slotName) + '</div><div class="muted gwsrc">' + esc(x._src.short) + (x._pet != null ? ' · pet #' + x._pet : '') + '</div>' +
          '<div class="gwwhere">' + (x._on === 'c' ? '✓ On the community pet' : x._on != null ? '✓ Equipped on #' + x._on : '📦 In your stash') + '</div>';
        d.querySelector('.ic').appendChild(V2Render.iconCanvas(x.item, 'gicon')); grid.appendChild(d); if (window.UXB) UXB.revealCard(d, x, w); return; }
      var gd = dudGuard(w, x), on = !!rev.sel[x.id]; d.className = 'egg pkcard t' + x.art.tierIndex + (on ? ' picked' : ''); d.tabIndex = 0; d.setAttribute('role', 'checkbox'); d.setAttribute('aria-checked', String(on)); d.setAttribute('aria-label', 'Select #' + x.id + ' to hide'); d.title = 'Tap to select or unselect';
      d.innerHTML = '<span class="pkcheck" aria-hidden="true">✓</span><canvas width="32" height="32"></canvas><div>#' + x.id + ' ' + esc(TIERS[x.art.tierIndex].label) + (x.stageName ? ' · ' + esc(x.stageName) : '') + '</div><div class="muted">' + esc(V.speciesLabel ? V.speciesLabel(x.species) : x.species) + '</div>' + (x.parents && R.bredFrom ? '<div class="small">' + R.bredFrom(w, x, false) + '</div>' : '') + (window.PetScore && PetScore.discardInfo ? PetScore.discardInfo(w, x, V.speciesLabel ? V.speciesLabel(x.species) : null) : '') + (gd.length ? '<div class="small dudg" title="Protected: never picked for you">🛡️ Protected · ' + esc(gd.join(', ')) + '</div>' : '');
      grid.appendChild(d); var c = d.querySelector('canvas'), fr = petFrames(x, w); paint(c, fr[0]); R.animate(c, fr);
      d.onclick = function (e) { if (e.target.closest && e.target.closest('a,button,input,select')) return; revToggle(w, x, d); };
      d.onkeydown = function (e) { if (e.target === d && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); revToggle(w, x, d); } };
    });
    $('packSkip').style.display = 'none'; $('packDiscard').style.display = gear ? 'none' : ''; $('packClose').textContent = gear ? (where.bag ? 'Wear it in The Rare Room →' : 'Go to The Rare Room →') : 'Done'; /* hatch-review-simple: Later = ✕ (same: keeps every pet) */
    $('packClose').title = gear ? '' : 'Keep the rest and see them in My Pets'; if ($('packX')) { $('packX').textContent = gear ? '✕ Close' : '✕'; $('packX').setAttribute('aria-label', 'Close'); } if (!gear) revCount();
  }
  function hideIds(ids) { discardIds(ids); }
  /* ONE caption per gear batch, for the best piece (the per-card captions overlapped the cards). Lives here, not in ux-batch.js, because the popup can open
   * on the first render, before ux-batch.js has loaded. */
  var GEAR_CAPS = [['gm. it\'s something.', 'ser, this is a Common.', 'it\'s honest work.'], ['not bad, anon.', 'a little drip never hurt.', 'up only (slightly).'], ['wen moon? now.', 'rare drip acquired.', 'number go up.'], ['MUCH WOW. VERY RARE.', 'GIGABRAIN DROP.', 'WAGMI. legendary pull.']];
  function UXB_CAP(list) { var best = null; list.forEach(function (x) { var t = x.legendary ? 3 : x.tier || 0; if (!best || t > best.t) best = { t: t, x: x }; });
    return best ? GEAR_CAPS[best.t][(String(best.x.gid || best.x.item).length + best.t) % 3] : ''; }
  function closeReveal() { var toInv = rev && rev.kind === 'gear', toPets = rev && rev.kind === 'eggs' && lastHatchN > 1; if (toPets && window.UXB && UXB.afterHatch) UXB.afterHatch(); if (!revealQ.length) packY = null; close('packBox'); rev = null; render(); setTimeout(nextReveal, 250);
    if (toPets && $('petsPanel')) setTimeout(function () { if (!$('packBox').classList.contains('on')) try { $('petsPanel').scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { } }, 300);
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
  /* WIZARD_EGG_ON_SALE (hotfix Oct 19 2026): false hides the play.html Wizard egg buy button (pet:hatchwiz). Set true to restore when the egg is ready. UI only; replay unchanged. */
  var WIZARD_EGG_ON_SALE = false;
  /* WIZARD_SIGN_CLAIM_ON (hotfix Oct 19 2026): false hides the play.html "Join us" sign claim button (pet:sign). Set true to restore at launch. UI only. */
  var WIZARD_SIGN_CLAIM_ON = false;
  function render() {
    var w = world(), c = w.community; try { autoStarBackfill(w); } catch (e) { } notifyHatch(w); notifyWins(w); setTimeout(nextReveal, 0);
    $('bal').textContent = fmt(S.balance); V2Wallet.paint(ME, $);
    $('cBurned').textContent = fmt(c.burned); $('cGame').textContent = fmt(S.rows.length); $('cPets').textContent = fmt(w.pets.length);
    petTotal(w);
    /* Wizard Cold Storage (Oct 19 2026): egg + sign claim buttons appear once the rule is on at the next block (V2Rules.wizColdOn) */
    var wzOn = V.wizColdOn && V.wizColdOn(w, (S.tip || 0) + 1), wm = w.wizardMythic; if ($('wizEggBtn')) { $('wizEggBtn').hidden = !(WIZARD_EGG_ON_SALE && wzOn); $('wizEggBtn').style.display = $('wizEggBtn').hidden ? 'none' : ''; }
    if ($('wizSignBtn')) { $('wizSignBtn').hidden = !(WIZARD_SIGN_CLAIM_ON && wzOn && ME && wm && wm.by && wm.by[ME] > 0 && !(wm.claimed && wm.claimed[ME])); $('wizSignBtn').style.display = $('wizSignBtn').hidden ? 'none' : ''; }
    // community pet (Jake 2026-10-14): Nakamoto at Mythic until The Return (1,111,111 burned in total), then the next community pet (same .commsprite slot as live)
    var wiz = !!c.returned, fr, gap = R.communityGap && R.communityGap(w);
    /* no community pet (Cold Storage gap): the panel STAYS with a coming-soon mystery egg; feed + gear roll disabled (owner rule Oct 20 2026, display only) */
    fr = gap ? R.comingSoonFrames() : R.communityFrames(w); /* community gear roll: the community pet (Bitcoin Wizard, or Nakamoto before) wears its community-roll gear (display only) */
    if (!commAnim) { var cv = document.createElement('canvas'); cv.width = cv.height = 32; cv.className = 'commsprite'; $('community').parentNode.insertBefore(cv, $('community')); commAnim = { c: cv }; }
    if (fr) R.animate(commAnim.c, fr); commAnim.fr = fr; if (R.bindCommunityTip) R.bindCommunityTip(commAnim.c, w); /* community-gear-hover: hover/tap shows what he wears */
    var T = V.WIZARD_THRESHOLDS, nx = wiz && c.wizardStage < 5 ? T[c.wizardStage + 1] : null, rp = V.returnProgress(c.burned);
    var cFed = c.current === 'homer' ? c.homerFed || 0 : c.current === 'funtrump' ? c.funtrumpFed || 0 : c.current === 'kek' ? c.kekFed || 0 : null; /* site-audit 2026-10-27: each community pet's own counter */
    $('community').innerHTML = '<b>' + esc(c.petName) + '</b>' + (c.petRole && c.petName !== 'Nakamoto' ? ' · ' + esc(c.petRole) : '') + ' · ' + c.petStageName + ' · ' + fmt(Math.floor(cFed != null ? cFed : c.burned)) + ' <span class="asset">XCPETS</span> ' + (cFed != null ? 'fed to ' + esc(c.petName) : 'burned'); /* community-gear-hover: old 'Wearing:' line removed (owner 2026-10-29); hover/tap tooltip shows worn gear */
    /* home-page community readout on play (same numbers as index: V2Render.communityStats) */
    if (R.communityStats) { var cs = R.communityStats(w, (V2Mock.state().rows || []).length), F = function (n) { return fmt(n); };
      $('community').insertAdjacentHTML('beforeend', '<div class="sharedwrap cstats"><div class="stats"><div><span>Stage</span><b id="pcStage">' + esc(cs.stage) + '</b></div><div><span>Fed to the community pet</span><b id="pcFed">' + F(cs.fed) + '</b></div><div><span>Next stage</span><b id="pcNext">' + (cs.next != null ? F(cs.next) + ' to ' + esc(cs.nextName) : 'Mythic reached') + '</b></div></div>' +
        '<div class="progress"><div id="pcProg" style="width:' + cs.pct.toFixed(1) + '%"></div></div><div class="stats"><div><span>Burns</span><b id="pcBurns">' + F(cs.burns) + '</b></div><div><span>Pets hatched</span><b id="pcPets">' + F(cs.pets) + '</b></div></div></div>'); }
    if (R.kekOn && R.kekOn(w)) $('community').insertAdjacentHTML('beforeend', '<details class="small muted" id="kekCard"><summary>Card</summary>' + esc(R.KEK_CARD) + '</details>'); /* gated: only when Lord Kek is the community pet */
    if (R.kekOn && R.kekOn(w) && window.V2KekArrival) { $('community').insertAdjacentHTML('beforeend', '<div class="small" id="kekReplayRow">' + V2KekArrival.LINK + '</div>'); V2KekArrival.bindReplay($('community'), world); V2KekArrival.watch($('communityPanel') || commAnim.c, world); } /* Lord Kek arrival scene: once per player, display only */
    if (gap && w.kekMythic && R.setNextNo) R.setNextNo(4); /* gated: Lord Kek in Cold Storage -> next is #4 */
    if (gap) { var nn = '#' + R.COMMUNITY_NEXT_NO; $('community').innerHTML = '<b>' + esc(R.comingSoonText()) + '</b>' + '<div class="small muted">' + (w.kekMythic ? 'Lord Kek' : 'The Bitcoin Wizard') + ' reached Mythic and is in Cold Storage. Community feeding and gear rolls open when pet ' + nn + ' arrives.</div>' + (R.wizardTopHtml ? R.wizardTopHtml(w, esc, fmt) : ''); }
    var crOn = V.crollOn(S.tip) && !gap; $('crollBtn').textContent = 'Community gear roll (' + fmt(V.COSTS.croll) + ')'; $('crollBtn').disabled = !crOn;
    if (!crOn && !gap) $('community').insertAdjacentHTML('beforeend', '<div class="small muted" id="crollNote">Community gear roll switches on at block ' + fmt(V.ACTIVATE_CROLL_BLOCK) + '.</div>');
    $('crollBtn').title = crOn ? 'Burn ' + fmt(V.COSTS.croll) + ' XCPETS: the community pet gets one random gear piece and wears it right away (a new piece replaces the old one in that slot)' : 'Community gear roll switches on at block ' + fmt(V.ACTIVATE_CROLL_BLOCK);
    $('goalBar').style.width = (rp.pct * 100).toFixed(2) + '%';
    $('goalTxt').innerHTML = wiz ? '<b>' + fmt(Math.floor(c.burned)) + '</b> <span class="asset">XCPETS</span> burned' : '<b>' + fmt(Math.floor(rp.count)) + '</b> / ' + fmt(V.COMMUNITY_GOAL) + ' <span class="asset">XCPETS</span> burned (' + (rp.pct * 100).toFixed(1) + '%)'; /* Cold Storage bar: no Return wording (Jake 2026-10-14) */
    $('lb').innerHTML = c.leaderboard.slice(0, 8).map(function (x) { return '<li' + (x.address === ME ? ' class="me"' : '') + '>' + esc(x.address) + ' · ' + fmt(x.amount) + '</li>'; }).join('');
    var amt = Math.floor(Number($('cAmt').value) || 0); $('cfeedBtn').textContent = 'Feed community (' + fmt(Math.max(amt, 0)) + ')'; $('cfeedBtn').disabled = !!gap;
    if (gap) { var sn = 'Opens when pet #' + R.COMMUNITY_NEXT_NO + ' arrives'; $('cfeedBtn').textContent = 'Feed community · ' + sn.toLowerCase(); $('crollBtn').textContent = 'Community gear roll · ' + sn.toLowerCase(); $('cfeedBtn').title = $('crollBtn').title = sn; } else $('cfeedBtn').title = '';
    renderPets(w); renderInv(w); lairRender(w); /* pet-shop mockup; lair-perf: only while the Lair is on (or near) screen */ renderBattles(w); notifyFights(w); notifyBreeds(w); notifyCem(w); renderBreed(w); if (window.V2Motel) { try { V2Motel.render(w); } catch (e) { if (window.console) console.error(e); } } /* no-tail-motel mockup */ renderLog(w); try { inReqPopup(w); } catch (e) { if (window.console) console.error(e); } if (window.UXB) { try { UXB.after(w); } catch (e) { if (window.console) console.error(e); } }
    if (detailId && $('detail').classList.contains('on')) detail(w.byId[detailId], w);
    offerResume();
  }
  // ---------------------------------------------------------------- My Pets (live card markup + checkbox)
  /* hotfix 3: the filtered + sorted pet list (shared by renderPets and the sort-only reorder) */
  function petList(alive, dead, noZF) { var fT = $('fTier').value, fS = $('fSort').value, hide = Number($('fHide').value), X = window.UXB ? UXB.filters() : null;
    var list = (cem ? dead : V.hideAtOrBelow(alive, hide)).filter(function (p) { return cem || fT === 'all' || TIER_ID[p.tier] === fT; }).slice().reverse();
    if (!cem && S.ui_starOnly) { var KS = new Set(keptIds()); list = list.filter(function (p) { return KS.has(p.id); }); } /* Starred filter (favorite-star-restore, display only) */
    if (X) list = list.filter(function (p) { return X.keep(p); }); /* ux-batch: minimum rarity, origin, search (display only) */
    if (fS === 'num') list.sort(function (a, b) { return a.id - b.id; }); if (fS === 'urgent' && window.IPQ) { var UW = world(); list.sort(function (a, b) { var x = IPQ.urgency(UW, a), y = IPQ.urgency(UW, b); return (x === y ? 0 : x < y ? -1 : 1) || a.id - b.id; }); } /* intuitive-pass item 2: most urgent first (engine deathBlock - tip), display only */
    if (fS === 'tier') { var RW = world(), RB = function (p) { return window.PetScore ? PetScore.bitsOf(RW, p) : -1; }; list.sort(function (a, b) { return b.tier - a.tier || RB(b) - RB(a) || a.id - b.id; }); } /* rarity-sort 2026-10-20: tier, trait-rarity bits, pet number (display only) */ if (fS === 'power' && window.UXB && UXB.power) list.sort(function (a, b) { return UXB.power(b) - UXB.power(a) || a.id - b.id; }); if (fS === 'stage') list.sort(function (a, b) { return b.stage - a.stage || b.care - a.care || b.id - a.id; });
    if (fS === 'species' && X && X.spKey) list.sort(function (a, b) { var x = X.spKey(a), y = X.spKey(b); return x < y ? -1 : x > y ? 1 : a.id - b.id; }); /* species-sort (2026-10-19, display only) */
    if (fS === 'score' && window.PetScore) { var PSw = world(); list.sort(function (a, b) { var x = PetScore.of(PSw, a), y = PetScore.of(PSw, b); return (y ? y.score : -1) - (x ? x.score : -1) || a.id - b.id; }); } /* pet-score (2026-10-19, display only) */
    if (window.V2PetSort && ['new', 'old', 'name', 'vigor', 'spark', 'grit', 'zoom', 'luck', 'wins', 'gear'].indexOf(fS) >= 0) { var PSc = V2PetSort.comparator(fS, world()); if (PSc) list.sort(PSc); } /* pet-sort (Oct 24 2026, display only): js/v2-pet-sort.js */
    if (fS === 'starred') { var KS3 = new Set(keptIds()); list.sort(function (a, b) { return (KS3.has(b.id) ? 1 : 0) - (KS3.has(a.id) ? 1 : 0) || a.id - b.id; }); } /* favorite-star-restore (display only): starred favorites first, then pet # */
    if (fS === 'sel') { var KS2 = new Set(S.sel.map(Number)); list.sort(function (a, b) { return (KS2.has(b.id) ? 1 : 0) - (KS2.has(a.id) ? 1 : 0) || a.id - b.id; }); } /* mypets-checkbox (display only): checked pets first, then pet # (was starred first) */
    if (fS === 'ztime' && window.V2ZombieFilter) { var ZTw = world(); list.sort(V2ZombieFilter.comparator(ZTw, (ZTw.tip || 0) + 1)); } /* mypets-zombie-filter (Oct 30 2026, display only): zombies first, least time left before feral / dust */
    if (!cem && !noZF && ZFK && window.V2ZombieFilter) { var ZFw = world(), ZFb = (ZFw.tip || 0) + 1; list = list.filter(function (p) { return V2ZombieFilter.match(ZFK, ZFw, p, ZFb, ME); }); } /* mypets-zombie-filter: All zombies / Hungry / Feral / Crumbling soon (optional, off by default) */
    if (X && X.flip) list.reverse();
    return list; }
  /* hotfix 3: a sort change only reorders the existing cards (same set, new order); anything else falls back to a full render */
  function resort() { var w = world(), all = mine(w), list = petList(all.filter(function (p) { return !p.dead; }), all.filter(function (p) { return p.dead; })), box = $('pets'), m = {};
    box.querySelectorAll(':scope > .pet.card[data-pid]').forEach(function (d) { m[d.dataset.pid] = d; });
    if (Object.keys(m).length !== list.length || !list.every(function (p) { return m[p.id]; })) return false;
    var f = document.createDocumentFragment(); list.forEach(function (p) { f.appendChild(m[p.id]); }); box.insertBefore(f, box.firstChild); return true; }
  var PG = { n: 150, key: '' }, NF = {}, ZFK = window.V2ZombieFilter ? V2ZombieFilter.load() : ''; /* mypets-zombie-filter: '' (off) | all | hungry | feral | soon, this browser session */ /* habits-ux: never-fed group open state per tab (a = alive, c = cemetery), this visit only */
  /* WAGMI bar: streak alive = WAGMI + day count; a missed chain day = NGMI with a joke (never shaming); 'new' = how to start. Only pet:wagmi counts (not feeding). */
  var NGMI_JOKES = ['Your streak took a nap. One WAGMI wakes it up.', 'Streak got rugged (by a good night\u2019s sleep). Day 1 is one tap away.', 'Just a vibe check. Say WAGMI and you\u2019re so back.', 'Even Satoshi took days off. Probably. Tap WAGMI to restart.', 'Ser, the streak fell in the mempool. Fish it out with a WAGMI.'];
  function wagmiBar(stk, w) { var tip = w.tip || S.tip || 0, left = 144 - (tip % 144), hrs = left * 10 / 60, lt = hrs >= 1 ? '~' + Math.round(hrs) + 'h' : '~' + Math.max(1, Math.round(left * 10)) + ' min';
    var on = V.wagmiOn && V.wagmiOn(tip + 1), ro = viewOnly() || !ME, why = !on ? 'WAGMI check-ins open soon' : stk.today ? 'Already said WAGMI today' : ro ? 'View only: connect your wallet to say WAGMI' : '';
    var btn = '<button type="button" class="btn sk-btn" id="wagmiBtn"' + (why ? ' disabled title="' + esc(why) + '"' : ' title="Burns 1 dander of XCPETS with the tag pet:wagmi"') + '>' + (stk.today ? '✓ WAGMI\u2019d today' : '🚀 Say WAGMI') + ' <span class="cost">' + (on ? '1 dander' : 'soon') + '</span></button>';
    var msg = stk.state === 'wagmi' ? '<span class="sk-tag sk-w">WAGMI</span> <b>🔥 ' + stk.current + '-day streak</b> <span class="sk-best">best ' + stk.best + '</span> ' + (stk.today ? '<span class="sk-ok">see you next chain day</span>' : '<span class="sk-warn">say WAGMI in the next ' + lt + ' to make it ' + (stk.current + 1) + '</span>')
      : stk.state === 'ngmi' ? '<span class="sk-tag sk-n">NGMI</span> <b>💀 streak reset</b> <span class="sk-joke">' + esc(NGMI_JOKES[Math.floor(tip / 144) % NGMI_JOKES.length]) + '</span> <span class="sk-best">best ' + stk.best + '</span>'
      : '<span class="sk-tag sk-w">WAGMI?</span> <b>Say WAGMI once a chain day</b> <span class="sk-joke">and watch your 🔥 streak grow. 1 dander, no feeding needed.</span>';
    setTimeout(function () { var b = $('wagmiBtn'); if (b && !b.disabled) b.onclick = function () { confirmPlans('WAGMI check-in', [{ tag: 'pet:wagmi', amount: 0.00000001 }]); }; }, 0);
    return '<span class="sk-msg">' + msg + '</span>' + btn; }
  /* wagmi-daily (owner, Oct 22 2026): right after V2Wallet.connect, offer WAGMI once per wallet per chain day if it can be sent (gate open, not said
   * today, none pending; same sendBlock check as the button). One tap opens the normal confirm (one XCP Wallet window, one-window lock applies).
   * Dismiss = not again today. localStorage key xcpets-wagmi-offer:<addr> = chain day it was shown. The My Pets WAGMI button stays. */
  var WAGMI_PLAN = { tag: 'pet:wagmi', amount: 0.00000001 };
  function wagmiOffer(w) { try {
    if (!ME || viewOnly() || !w || !w.tip || !V.wagmiOn || !V.wagmiOn(w.tip + 1)) return; var ss = window.sessionStorage, ls = window.localStorage;
    if (ss.getItem('xcpets-wagmi-connect') !== ME) return; var d = Math.floor((w.tip + 1) / 144), k = 'xcpets-wagmi-offer:' + ME;
    if (ls.getItem(k) === String(d) || $('wagmiOffer') || sendWhy(WAGMI_PLAN)) return;
    ls.setItem(k, String(d)); ss.removeItem('xcpets-wagmi-connect');
    var first = V.wagmiFirst ? V.wagmiFirst(w, d).length : 5, prize = V.wagmiPrizeOn && V.wagmiPrizeOn(w.tip + 1) && first < (V.WAGMI_PRIZE_N || 5);
    var el = document.createElement('div'); el.id = 'wagmiOffer'; el.className = 'wagmi-offer'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Say WAGMI today');
    el.innerHTML = '<b>🚀 gm! Say WAGMI for today?</b><span>One tap keeps your 🔥 streak going (1 dander, plus the network fee).' + (prize ? ' Only ' + first + ' of 5 Day One Degen spots taken today: the first five wallets each get +1 saved Pepe Wheel spin.' : '') + '</span>' +
      '<div class="wo-btns"><button type="button" class="btn" id="wagmiOfferGo">🚀 Say WAGMI</button><button type="button" class="btn ghost" id="wagmiOfferNo">Not today</button></div>';
    document.body.appendChild(el);
    $('wagmiOfferGo').onclick = function () { el.remove(); confirmPlans('WAGMI check-in', [WAGMI_PLAN]); };
    $('wagmiOfferNo').onclick = function () { el.remove(); };
  } catch (e) { } }
  window.addEventListener('xcpets:connected', function () { setTimeout(function () { wagmiOffer(world()); }, 0); });
  if (!document.getElementById('wagmiOfferCss')) { var woc = document.createElement('style'); woc.id = 'wagmiOfferCss';
    woc.textContent = '.wagmi-offer{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:60;width:min(440px,calc(100vw - 24px));background:#181327;color:#ece6ff;border:3px solid #ffc93c;border-radius:12px;padding:12px 14px;box-shadow:0 6px 24px #000a;display:flex;flex-direction:column;gap:6px}' +
      '.wagmi-offer b{font-family:"Press Start 2P",monospace;font-size:11px;color:#ffc93c;line-height:1.5}.wagmi-offer span{font-size:13px;line-height:1.4}.wagmi-offer .wo-btns{display:flex;gap:8px;flex-wrap:wrap}.wagmi-offer .btn{min-height:40px}';
    document.head.appendChild(woc); }
  function renderPets(w) {
    var all = mine(w), alive = all.filter(function (p) { return !p.dead; }), dead = all.filter(function (p) { return p.dead; });
    if (V.streakOf && $('streakBar')) { var stk = ME ? V.streakOf(w, ME, w.tip) : null; /* WAGMI / NGMI daily check-in (login-streak rework, Oct 21 2026) */
      $('streakBar').style.display = stk ? '' : 'none'; if (stk) $('streakBar').innerHTML = wagmiBar(stk, w);  wagmiOffer(w); }
    $('nAlive').textContent = alive.length; $('nDead').textContent = dead.length; $('petBadge').textContent = alive.length;
    var list = petList(alive, dead);
    /* habits-ux (Oct 27 2026) folded never-fed pets into one collapsed group; mypets-show-all (owner, Oct 28 2026) lists every pet again and the
     * fold becomes an opt-in 'Never fed only' filter (My Pets and Cemetery tab). Discarded pets are already out (mine). One O(n) pass, so 9k-pet wallets stay fast. */
    var nfK = cem ? 'c' : 'a', listAll = ZFK && !cem ? petList(alive, dead, true) : list, nfs = V2Habits.splitNeverFed(listAll) /* mypets-zombie-filter: the Never fed chip counts without the zombie filter, so it stays there */ /* mypets-show-all: count every never-fed pet for the optional filter */, nfN = nfs.nf.length;
    /* mypets-show-all (owner Oct 28 2026): every pet is in the main list by default; 'Never fed only' is an optional filter, off by default (NF[tab] = on) */
    var nfOnly = !!NF[nfK] && nfN > 0; if (nfOnly) list = nfs.nf;
    if (!cem && JUST_BACK.length) { var JB = new Set(JUST_BACK), jb = petList(alive, dead).filter(function (p) { return JB.has(p.id); }); if (jb.length) { list = jb.concat(list.filter(function (p) { return !JB.has(p.id); })); } } /* restore-fix: just restored first (still counted in the Never fed chip) */ /* nf-fold fix (Oct 27 2026): opened never-fed pets go first, right under the fold. They used to go last, past the 150-card page, so the fold opened onto nothing. */
    var aliveS = new Set(alive.map(function (p) { return p.id; })); S.sel = S.sel.filter(function (id) { return aliveS.has(id); }); var selS = new Set(S.sel); /* bigfix: Sets, not nested scans */
    $('selAll').checked = list.length > 0 && list.every(function (p) { return selS.has(p.id); });
    $('selCount').textContent = S.sel.length + ' selected · ' + alive.filter(function (p) { return p.hungry; }).length + ' hungry';
    $('bulkRow').style.display = cem ? 'none' : '';
    var box = $('pets'); box.innerHTML = list.length || nfN ? '' : '<p class="muted">No pets match this filter.</p>';
    if (nfN) { var nfg = document.createElement('div'); nfg.className = 'row nffilter'; nfg.id = 'nfGroup'; nfg.style.cssText = 'gap:8px;align-items:center;margin:0 0 8px;width:100%;grid-column:1/-1;flex-wrap:wrap';
      nfg.innerHTML = '<button type="button" class="q" id="nfOnly" aria-pressed="' + nfOnly + '">' + (cem ? '🪦' : '🥚') + ' ' + (nfOnly ? '✓ ' : '') + 'Never fed only <span class="chip">' + fmt(nfN) + '</span></button> <span class="small muted">' + (nfOnly ? 'only pets that ' + (cem ? 'died without a single meal' : 'never had a meal') + ' · tap to show all' : 'optional filter, off: all pets are listed') + '</span>';
      nfg.querySelector('button').onclick = function (e) { e.stopPropagation(); NF[nfK] = !nfOnly; if (NF[nfK] && ZFK) { ZFK = ''; V2ZombieFilter.save(''); } render(); }; box.appendChild(nfg); }
    /* mypets-zombie-filter (owner Oct 30 2026): zombie filter pills under the search, only when you own a zombie (or one is on). Counts follow the search + sort list. */
    if (!cem && window.V2ZombieFilter) { var ZFw2 = w, zcAll = petList(alive, dead, true), zc = V2ZombieFilter.counts(ZFw2, zcAll, (ZFw2.tip || 0) + 1, ME), zAny = ZFK || zc.all || alive.some(ZB);
      if (zAny) { V2ZombieFilter.css(); var zg = document.createElement('div'); zg.className = 'row zbfilter'; zg.id = 'zbGroup'; zg.style.cssText = 'gap:8px;align-items:center;margin:0 0 8px;width:100%;grid-column:1/-1;flex-wrap:wrap';
        zg.innerHTML = V2ZombieFilter.rowHtml(zc, ZFK, list.length);
        zg.querySelectorAll('[data-zf]').forEach(function (bt) { bt.onclick = function (e) { e.stopPropagation(); var k = bt.getAttribute('data-zf'); ZFK = ZFK === k ? '' : k; V2ZombieFilter.save(ZFK); if (ZFK) NF[nfK] = false; render(); }; });
        var zm = box.querySelector(':scope > p.muted'); if (zm) box.insertBefore(zg, zm); else box.appendChild(zg);
        if (ZFK && !list.length) { var ze = document.createElement('p'); ze.className = 'muted'; ze.style.gridColumn = '1/-1'; ze.textContent = 'No zombies match this filter' + ($('fSearch') && $('fSearch').value.trim() ? ' and search.' : '.'); if (zm) zm.remove(); box.appendChild(ze); } } }
    /* hotfix 3: cards are built in chunks of 150 with a yield between them, so a 2,000-pet wallet never blocks the page for seconds */
    var tok = renderPets.tok = (renderPets.tok || 0) + 1, CH = 150, tail = document.createComment('pets-more');
    function mk(p) {
      var d = document.createElement('div'), on = S.sel.indexOf(p.id) >= 0; d.className = 'pet card' + (p.dead ? ' dead' : '') + (ZB(p) ? ' zombie' : '') + (on ? ' selected' : ''); var qWhy = !p.dead && V.questBusyWhy ? V.questBusyWhy(p, S.tip + 1) : null, qNap = !p.dead && !qWhy && V.questNap && V.questNap(p, S.tip + 1); if (qWhy) d.className += ' quest-away'; /* Mythic quests: greyed while away (inert while the quest gate is null) */ d.tabIndex = 0; d.dataset.pid = p.id;
      var ct = R.careTarget(w, p, S.tip), /* the engine's per-pet thresholds (Mythic discount), shared with the detail panel and pet page */ fed = p.dead ? '🪦 Died of neglect' : ZB(p) ? '' /* v2-zombies preview: no normal meals; the zombie hunger chip below replaces this one */ : p.fedToday ? 'Fed today: ✓' : p.nextMeal ? 'Hungry · meal ' + fmt(p.nextMeal) : 'Full';
      d.innerHTML = /* mypets-checkbox: the checkbox is back; favorite-star-restore: the ★ favorite is back next to the name */ (p.dead ? '' : '<input type="checkbox" class="pick-cb" aria-label="Select #' + p.id + '"' + (on ? ' checked' : '') + '>') + '<canvas class="sprite" width="32" height="32"></canvas><h4>' + (p.dead ? '' : keepBtn(p.id)) + esc(p.name) + ' <span class="muted">#' + p.id + '</span>' + (p.blackEye ? ' 🤕' : '') + (p.crowned ? ' 👑' : '') + '</h4><div class="chips">' +
        (ZB(p) ? '<span class="chip zb-risen" title="Raised at the seance altar in the cemetery">🧟 Risen</span>' : p.resurrected ? '<span class="chip zb-halo" title="Brought back to life by a Resurrection at block ' + fmt(p.resurrected.block) + ': a halo for good, power ceiling ' + p.resurrected.cap + ' times">😇 Halo</span>' : '') + '<span class="chip">' + esc(spLabel(p.species)) + '</span>' + tierPill(p.tier) + '<span class="chip stg">' + p.stageName + '</span>' + (ZB(p) && window.V2Zombies && V2Zombies.hungerChip ? V2Zombies.hungerChip(p, w) : '<span class="chip' + (p.hungry ? ' warn' : '') + '">' + fed + '</span>') +
        (R.genChip ? R.genChip(w, p) : '') + '<span class="chip gearchip">🎒 ' + R.worn(w, p.id).length + '/' + p.capacity + ' slots</span>' + (window.UXB && UXB.power ? (ZB(p) ? (function (h) { return '<span class="chip pow zb-pow" title="Zombie power, set at the seance altar' + (h ? ': ' + h.times + ' times its death stats' + (h.milestone ? ' (' + esc(h.milestone) + ')' : '') : '') + '">⚡ ' + UXB.power(p) + ' zombie</span>'; })(window.V2Zombies && V2Zombies.hunger ? V2Zombies.hunger(p, w) : null) : '<span class="chip pow"' + ptA(p) + '>⚡ ' + UXB.power(p) + '</span>') : '') + (V.streakOf && !p.dead ? (function (st) { return st.current ? '<span class="chip streak" title="Owner says WAGMI every chain day (best ' + st.best + ')">🚀 WAGMI ' + st.current + 'd</span>' : ''; })(V.streakOf(w, p.owner, w.tip)) : '') + (window.PetScore ? PetScore.badge(w, p) : '') + (window.PetScore && PetScore.rarityChip ? PetScore.rarityChip(w, p) : '') + (window.UXB ? UXB.origin(p, w) : '') + (p.neglected && !p.dead ? '<span class="chip warn">neglected</span>' : '') + (R.starveChip ? R.starveChip(w, p) : '') + (qWhy ? '<span class="chip quest-chip" title="' + esc(qWhy) + ': can\'t fight, breed, feed, gift or sell until it is home">🗺️ Gone Questing · back at ' + fmt(p.quest.end) + '</span>' : '') + (qNap ? '<span class="chip" title="Resting after a quest: can fight, breed and eat, but can\'t start a new quest yet">💤 Nap Time until ' + fmt(p.napUntil) + '</span>' : '') + '</div>' +
        (ZB(p) ? (window.V2Zombies && V2Zombies.hungerBar ? V2Zombies.hungerBar(p, w) : '') + '<div class="small zb-by">🧟 Raised by ' + shortAddr(p.zombie.by) + '</div>' + zFeedHtml(p, w) + zRplHtml(p, w) : '<div class="bar"><i style="width:' + ct.pct.toFixed(1) + '%"></i></div><div class="small muted"' + (ct.discount ? ' title="Mythic at ' + fmt(ct.mythic) + ' care instead of 69,069: you raised a Mythic yourself (never left you, or more than half its care fed by you)"' : '') + '>care ' + fmt(p.care) + ' / ' + fmt(ct.mythic) /* owner Oct 27 2026: no "Mythic shortcut" words in My Pets; the lower target stays in the number and the hover note */ + '</div>');
      if (ZB(p)) zFeedBind(d);
      var kb = d.querySelector('.keepbtn'); if (kb) kb.onclick = function (e) { e.stopPropagation(); e.preventDefault(); toggleKeep(p.id); }; /* favorite-star-restore */
      var cb = d.querySelector('.pick-cb'); if (cb) cb.onclick = function (e) { e.stopPropagation(); if (window.UXB) UXB.cardTap(p.id, e); else toggle(p.id); };
      if (!p.dead && window.UXB) { d.insertAdjacentHTML('beforeend', '<button type="button" class="q openbtn" aria-label="Open #' + p.id + '">Open ▸</button>');
        d.onclick = function (e) { if (e.target.closest('a')) return; /* build fix: card opens detail again; shift-click or Select mode selects (mypets-checkbox: restored) */ if (!e.target.closest('.openbtn') && (e.shiftKey || document.body.classList.contains('selmode'))) return UXB.cardTap(p.id, e); goPet(p.id, e); }; }
      else d.onclick = function (e) { goPet(p.id, e); }; /* P10 (owner 2026-10-21): a card opens the pet page directly (Ctrl/Cmd-click: new tab) */
      return d; }
    renderPets.mk = mk; /* mypets-swipe: the One at a time view reuses the exact grid card (display only) */
    function put(ps, before) { var f = document.createDocumentFragment(), ds = ps.map(function (p) { var d = mk(p); f.appendChild(d); return [d, p]; }); if (before) box.insertBefore(f, before); else box.appendChild(f);
      ds.forEach(function (x) { R.lazy(x[0].querySelector('canvas'), function () { return petFrames(x[1], w); }); }); }
    /* bigfix 2026-10-20: Ranking-style paging. Only the first PG.n cards are built (150 a page); 'Show more (N left)' adds the next 150.
     * Counts, Select all, filters and bulk feed still work from the full list, not from the cards on screen. */
    var key = [cem ? 'c' : 'a'].concat(['fTier', 'fHide', 'fSort', 'fMin', 'fOrigin', 'fSearch', 'fSpecies', 'fDir'].map(function (k) { var e = $(k); return e ? (e.value != null && e.tagName !== 'BUTTON' ? e.value : e.textContent) : ''; })).join('|') + '|' + (S.ui_starOnly ? 's' : '') + '|' + (NF[cem ? 'c' : 'a'] ? 'n' : '') + '|z' + ZFK + '|' + (window.UXB && UXB.spsKey ? UXB.spsKey() : ''); if (PG.key !== key) { PG.key = key; PG.n = CH; }
    var upto = Math.min(list.length, Math.max(CH, PG.n));
    put(list.slice(0, Math.min(CH, upto))); box.appendChild(tail);
    (function more(i) { if (i >= upto) return; setTimeout(function () { if (renderPets.tok !== tok || !tail.parentNode) return; put(list.slice(i, Math.min(upto, i + CH)), tail); more(i + CH); }, 0); })(CH);
    if (list.length > upto) { var mb = document.createElement('div'); mb.className = 'row petmore'; mb.style.cssText = 'justify-content:center;margin:10px 0;width:100%;grid-column:1/-1';
      mb.innerHTML = '<button type="button" class="q" id="petMore">Show more (' + fmt(list.length - upto) + ' left)</button>';
      box.appendChild(mb); mb.querySelector('button').onclick = function (e) { e.stopPropagation(); var i0 = upto; PG.n = upto + CH; upto = Math.min(list.length, PG.n); mb.remove();
        put(list.slice(i0, upto), tail); if (list.length > upto) { mb.querySelector('button').textContent = 'Show more (' + fmt(list.length - upto) + ' left)'; box.insertBefore(mb, tail.nextSibling); } else mb.remove();
        $('petPager').textContent = 'Showing ' + fmt(upto) + ' of ' + fmt(list.length) + ' pets'; if (window.UXB && UXB.sel) UXB.sel(); }; }
    var gone = w.pets.filter(function (p) { return p.owner === ME && !p.released && hiddenIds().indexOf(p.id) >= 0 && !!p.dead === !!cem; });
    if (gone.length) box.appendChild(discardedBox(gone, w));
    if (!cem) pileLink(gone.length); /* discard-pile jump link */
    $('petPager').textContent = list.length > upto ? 'Showing ' + fmt(upto) + ' of ' + fmt(list.length) + ' pets' : list.length + ' of ' + (cem ? dead.length : alive.length) + ' pets';
  }
  /* Discard pile (discard-pile, 2026-10-21; was 'Show discarded', build 2 2026-10-16). Display/localStorage only: no burn, nothing on chain.
   * Same cards as My Pets: name + #id + star, species / rarity / stage / fed state / gear / Power chips, a 'Last fed' line, Open ▸ (pet page) and ↩️ Restore.
   * Sort: recently discarded (the order pets went onto the pile), newest / oldest pet, rarity, species, stage, last fed, Power, plus ⇅ Reverse.
   * Filters: Rarity, Species, Search. Selection: 'Select all shown', Clear, 'Restore selected (N)', 'Restore all (N)'.
   * Alive tab = discarded living pets, Pet Cemetery tab = discarded dead pets. Starred pets are never discarded (discardIds skips them). */
  var DS = { open: false, flip: false, sort: 'recent', tier: 'all', sp: 'all', q: '', sel: {}, n: 120 };
  var DS_SORTS = [['recent', 'Recently discarded'], ['new', 'Newest pet'], ['num', 'Oldest pet'], ['tier', 'Rarity'], ['species', 'Species'], ['stage', 'Stage'], ['fed', 'Last fed'], ['power', 'Power']];
  function dsFed(p, w) { if (p.dead) return { chip: '🪦 Died of neglect', warn: true, line: 'Died of neglect' };
    var never = p.lastFed == null, ago = never ? null : Math.max(0, Math.floor(w.tip / 144) - Math.floor(p.lastFed / 144));
    var line = never ? 'Never fed' : ago === 0 ? 'Last fed today' : 'Last fed ' + ago + ' day' + (ago === 1 ? '' : 's') + ' ago';
    return { chip: p.fedToday ? 'Fed today ✓' : p.nextMeal ? 'Hungry · meal ' + fmt(p.nextMeal) : 'Full', warn: !!p.hungry, line: line }; }
  function discardedBox(gone, w) {
    var hb = document.createElement('div'); hb.className = 'hiddenbox dpile'; hb.id = 'discardPile';
    var order = hiddenIds(), pos = {}; order.forEach(function (id, i) { pos[id] = i; });
    var spOf = function (p) { return spLabel(p.species); }, spList = gone.map(spOf).filter(function (x, i, a) { return a.indexOf(x) === i; }).sort();
    if (DS.sp !== 'all' && spList.indexOf(DS.sp) < 0) DS.sp = 'all';
    var q = DS.q.trim().toLowerCase(), list = gone.filter(function (p) { return (DS.tier === 'all' || TIER_ID[p.tier] === DS.tier) && (DS.sp === 'all' || spOf(p) === DS.sp) && (!q || ('#' + p.id + ' ' + (p.name || '') + ' ' + spOf(p) + ' ' + p.stageName).toLowerCase().indexOf(q) >= 0); });
    var S0 = DS.sort, pw = function (p) { return window.UXB && UXB.power ? UXB.power(p) : 0; };
    if (S0 === 'recent') list.sort(function (a, b) { return (pos[b.id] || 0) - (pos[a.id] || 0) || b.id - a.id; });
    if (S0 === 'new') list.sort(function (a, b) { return b.id - a.id; }); if (S0 === 'num') list.sort(function (a, b) { return a.id - b.id; });
    if (S0 === 'tier') { var DB = function (p) { return window.PetScore ? PetScore.bitsOf(w, p) : -1; }; list.sort(function (a, b) { return b.tier - a.tier || DB(b) - DB(a) || a.id - b.id; }); } /* rarity-sort */
    if (S0 === 'species') list.sort(function (a, b) { var x = spOf(a).toLowerCase(), y = spOf(b).toLowerCase(); return x < y ? -1 : x > y ? 1 : b.tier - a.tier || a.id - b.id; });
    if (S0 === 'stage') list.sort(function (a, b) { return b.stage - a.stage || b.care - a.care || b.id - a.id; });
    if (S0 === 'fed') list.sort(function (a, b) { var x = a.lastFed == null ? -1 : a.lastFed, y = b.lastFed == null ? -1 : b.lastFed; return y - x || b.id - a.id; });
    if (S0 === 'power') list.sort(function (a, b) { return pw(b) - pw(a) || a.id - b.id; });
    if (DS.flip) list.reverse();
    Object.keys(DS.sel).forEach(function (k) { if (!gone.some(function (p) { return String(p.id) === k; })) delete DS.sel[k]; });
    var nsel = Object.keys(DS.sel).length, shown = list.slice(0, DS.n), allOn = shown.length > 0 && shown.every(function (p) { return DS.sel[p.id]; });
    var card = function (p) { var f = dsFed(p, w), on = !!DS.sel[p.id];
      return '<div class="dcard' + (on ? ' selected' : '') + (p.dead ? ' dead' : '') + '" data-did="' + p.id + '"><input type="checkbox" class="dcb" aria-label="Select #' + p.id + '"' + (on ? ' checked' : '') + '><canvas class="sprite" width="32" height="32"></canvas>' +
        '<h4>' + esc(p.name || spOf(p)) + ' <span class="muted">#' + p.id + '</span>' + (p.blackEye ? ' 🤕' : '') + (p.crowned ? ' 👑' : '') + '</h4>' +
        '<div class="chips"><span class="chip">' + esc(spOf(p)) + '</span>' + tierPill(p.tier) + '<span class="chip stg">' + p.stageName + '</span><span class="chip' + (f.warn ? ' warn' : '') + '">' + f.chip + '</span>' +
        '<span class="chip gearchip" title="Gear worn / slots">🎒 ' + R.worn(w, p.id).length + '/' + p.capacity + ' slots</span>' + (window.UXB && UXB.power ? '<span class="chip pow"' + ptA(p) + '>⚡ ' + pw(p) + '</span>' : '') + '</div>' +
        (window.PetScore && PetScore.discardInfo ? PetScore.discardInfo(w, p, spOf(p)) : '') +
        '<div class="small muted dp-fed">' + f.line + '</div>' +
        '<div class="row dp-acts"><a class="q" href="pet.html?id=' + p.id + '" aria-label="Open #' + p.id + '">Open ▸</a><button type="button" class="btn" data-restore="' + p.id + '" title="Put #' + p.id + ' back in My Pets">↩️ Restore</button></div></div>'; };
    hb.innerHTML = '<details' + (DS.open ? ' open' : '') + '><summary><span class="dp-title">🗑️ Discard pile</span> <span class="chip">' + gone.length + ' pet' + (gone.length === 1 ? '' : 's') + '</span> <span class="small muted">' + (DS.open ? 'tap to close' : 'tap to open') + '</span></summary>' +
      '<p class="small muted">Pets you discarded. They are only hidden in this browser: they still exist on chain (other devices and players still see them). Restore puts them back in My Pets. Free, no burn. Starred pets are never discarded.</p>' +
      '<div class="row small dctl"><label>Sort <select data-ds="sort">' + DS_SORTS.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('') + '</select></label> <button type="button" class="q" data-dsa="dir" aria-pressed="' + DS.flip + '" title="Reverse the order">⇅ Reverse</button> ' +
      '<label>Rarity <select data-ds="tier"><option value="all">All</option>' + TIER_ID.map(function (t, k) { return '<option value="' + t + '">' + TL[k] + '</option>'; }).join('') + '</select></label> ' +
      '<label>Species <select data-ds="sp"><option value="all">All (' + gone.length + ')</option>' + spList.map(function (s) { return '<option value="' + esc(s) + '">' + esc(s) + ' (' + gone.filter(function (p) { return spOf(p) === s; }).length + ')</option>'; }).join('') + '</select></label> ' +
      '<label>Search <input type="search" data-ds="q" placeholder="#id, name, species" value="' + esc(DS.q) + '"></label> <span class="muted">' + list.length + ' of ' + gone.length + ' match</span></div>' +
      '<div class="row small dctl dsel"><label><input type="checkbox" data-dsa="selall"' + (allOn ? ' checked' : '') + '> Select all shown (' + shown.length + ')</label> <span class="dp-n">' + nsel + ' selected</span> <button type="button" class="q" data-dsa="none"' + (nsel ? '' : ' disabled') + '>Clear</button> ' +
      '<button type="button" class="btn" data-dsa="sel"' + (nsel ? '' : ' disabled') + '>↩️ Restore selected' + (nsel ? ' (' + nsel + ')' : '') + '</button> <button type="button" class="q" data-dsa="all">Restore all (' + gone.length + ')</button></div>' +
      '<div class="dgrid">' + (shown.length ? shown.map(card).join('') : '<p class="muted small">No discarded pets match.</p>') + '</div>' +
      (list.length > shown.length ? '<p><button type="button" class="q" data-dsa="more">Show more (' + (list.length - shown.length) + ' left)</button></p>' : '') + '</details>';
    hb.querySelector('details').ontoggle = function () { DS.open = this.open; var t = hb.querySelector('summary .small'); if (t) t.textContent = this.open ? 'tap to close' : 'tap to open'; };
    hb.querySelector('[data-ds="sort"]').value = DS.sort; hb.querySelector('[data-ds="tier"]').value = DS.tier; hb.querySelector('[data-ds="sp"]').value = DS.sp;
    hb.querySelectorAll('select[data-ds]').forEach(function (x) { x.onchange = function () { DS[x.dataset.ds] = x.value; render(); }; });
    var si = hb.querySelector('[data-ds="q"]'), st = null; si.oninput = function () { clearTimeout(st); st = setTimeout(function () { DS.q = si.value; render(); var n = document.querySelector('.hiddenbox [data-ds="q"]'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 250); };
    var selUpd = function () { var n = Object.keys(DS.sel).length, b = hb.querySelector('[data-dsa="sel"]'); b.disabled = !n; b.textContent = '↩️ Restore selected' + (n ? ' (' + n + ')' : ''); hb.querySelector('[data-dsa="none"]').disabled = !n; hb.querySelector('.dp-n').textContent = n + ' selected';
      hb.querySelector('[data-dsa="selall"]').checked = shown.length > 0 && shown.every(function (p) { return DS.sel[p.id]; }); };
    hb.querySelectorAll('.dcb').forEach(function (c) { c.onchange = function () { var d = c.closest('.dcard'), id = d.dataset.did; if (c.checked) DS.sel[id] = 1; else delete DS.sel[id]; d.classList.toggle('selected', c.checked); selUpd(); }; });
    hb.querySelector('[data-dsa="selall"]').onchange = function () { var on = this.checked; shown.forEach(function (p) { if (on) DS.sel[p.id] = 1; else delete DS.sel[p.id]; }); hb.querySelectorAll('.dcard').forEach(function (d) { d.classList.toggle('selected', on); d.querySelector('.dcb').checked = on; }); selUpd(); };
    hb.querySelectorAll('[data-restore]').forEach(function (a) { a.onclick = function (e) { e.preventDefault(); var id = Number(a.getAttribute('data-restore')); delete DS.sel[id]; restoreLocal([id]); }; });
    hb.querySelectorAll('button[data-dsa]').forEach(function (b) { b.onclick = function () { var a = b.dataset.dsa; if (a === 'dir') { DS.flip = !DS.flip; return render(); } if (a === 'more') { DS.n += 120; return render(); } if (a === 'none') { DS.sel = {}; return render(); }
      var ids = a === 'all' ? gone.map(function (p) { return p.id; }) : Object.keys(DS.sel).map(Number); if (!ids.length) return;
      if (ids.length > 1 && !window.confirm('Restore ' + (a === 'all' ? 'all ' : '') + ids.length + ' pets from the Discard pile to My Pets?\n\nFree, no burn. They show in My Pets again in this browser.')) return; DS.sel = {}; restoreLocal(ids); }; });
    hb.querySelectorAll('.dcard').forEach(function (d) { var p = w.byId[d.dataset.did]; if (p) R.lazy(d.querySelector('canvas'), function () { return petFrames(p, w); }); });
    return hb; }
  /* 'Discard pile (N)' jump link next to the bulk discard buttons: opens + scrolls to the pile */
  function openPile() { DS.open = true; var d = document.querySelector('#discardPile details'); if (d) { d.open = true; d.scrollIntoView({ block: 'start' }); } else render(); }
  function pileLink(n) { var a = $('dpJump'); if (!a) { var anc = $('bulkAnchor'); if (!anc) return; a = document.createElement('button'); a.type = 'button'; a.className = 'q'; a.id = 'dpJump'; anc.parentNode.appendChild(a);
      a.onclick = openPile; }
    a.hidden = !n; a.textContent = '🗑️ Discard pile (' + n + ')'; a.title = 'Open the Discard pile: restore pets you discarded'; }
  /* hotfix 2: a selection change only updates that card + the count (no full render / replay) */
  function selUi() { var w = world(), alive = mine(w).filter(function (p) { return !p.dead; }), cards = document.querySelectorAll('#pets .pet.card[data-pid]');
    $('selCount').textContent = S.sel.length + ' selected · ' + alive.filter(function (p) { return p.hungry; }).length + ' hungry';
    var all = cards.length > 0; cards.forEach(function (d) { var on = S.sel.indexOf(Number(d.dataset.pid)) >= 0; d.classList.toggle('selected', on); var cb = d.querySelector('.pick-cb'); if (cb) cb.checked = on; if (!on) all = false; }); $('selAll').checked = all; if (window.UXB) UXB.sel(); try { document.dispatchEvent(new CustomEvent('xcpets-sel')); } catch (e) { } } /* mypets-checkbox: 'xcpets-sel' tells the status line, swipe view and Rare Room the checked count changed */
  function toggle(id) { var i = S.sel.indexOf(id); if (i >= 0) S.sel.splice(i, 1); else S.sel.push(id); save(); selUi(); }
  $('tabAlive').onclick = function () { cem = false; this.classList.add('on'); render(); }; /* mypets-simple: the Pet Cemetery tab is gone (Places → Pet Cemetery, cemetery.html) */
  if ($('tabCem')) $('tabCem').onclick = function () { location.href = 'cemetery.html'; };
  /* favorite-star-restore: 'starred' is a real sort again (★ Starred first) and the Starred filter works again */
  ['fTier', 'fSort', 'fHide'].forEach(function (id) { $(id).onchange = function () { S['ui_' + id] = this.value; save(); if (id === 'fSort' && resort()) return; render(); }; if (S['ui_' + id] != null) $(id).value = S['ui_' + id]; });
  if ($('fStarred')) { $('fStarred').setAttribute('aria-pressed', String(!!S.ui_starOnly)); $('fStarred').onclick = function () { S.ui_starOnly = !S.ui_starOnly; this.setAttribute('aria-pressed', String(S.ui_starOnly)); save(); render(); }; } /* favorite-star-restore */
  $('selAll').onchange = function () { var w = world(), hide = Number($('fHide').value), fT = $('fTier').value;
    var shown = V.hideAtOrBelow(mine(w).filter(function (p) { return !p.dead; }), hide).filter(function (p) { return fT === 'all' || TIER_ID[p.tier] === fT; });
    S.sel = this.checked ? shown.map(function (p) { return p.id; }) : []; save(); selUi(); };
  if ($('selMode')) $('selMode').onclick = function () { var on = document.body.classList.toggle('selmode'); this.classList.toggle('on', on); this.setAttribute('aria-pressed', on ? 'true' : 'false'); toast(on ? 'Select mode on: tap cards to select' : 'Select mode off: tap a card to open it'); };
  $('selNone').onclick = function () { S.sel = []; save(); selUi(); toast('Selection cleared'); }; /* Select none */
  /* Feed all hungry / Feed selected NEVER include a discarded pet: filtered by the discard set itself (hiddenIds), not by what is on screen,
   * so 'Show discarded', a stale selection or an active filter can't leak one in. */
  function noDiscarded(plans) { var h = hiddenIds(); return plans.filter(function (q) { return h.indexOf(q.petId) < 0; }); }
  /* bigfix 2026-10-20: big feeds are planned in small slices (V.feedQueueAsync) with a progress bar in the confirm box, so the page never freezes.
   * The overfeed guard runs on the pet list first, so the plan is built once. Same burns as before. */
  var feedTok = 0;
  function feedAsync(title, ids, list) { if (viewBlock()) return; if (!ME) return confirmPlans(title, []);
    var w = world(), hs = new Set(hiddenIds()), hungry = ids.filter(function (id) { var p = w.byId[id]; return !hs.has(id) && p && p.owner === ME && p.hungry; });
    if (runsOn(w) != null) { var gr = guardIds(w, hungry); if (!gr.ok.length) return feedBlocked(title, gr.text); return confirmPlans(title, noDiscarded(feedQ(w, ME, gr.ok, undefined, list)), null, gr); } /* feed-all-one-burn: runs plan, no slow planner */
    if (hungry.length < 300 || !V.feedQueueAsync) return confirmPlans(title, noDiscarded(feedQ(w, ME, hungry, undefined, list)));
    var g = guardIds(w, hungry), tok = ++feedTok; if (!g.ok.length) return feedBlocked(title, g.text); /* habits-ux: block, never the unguarded queue */
    pendingPlans = null; $('cfTitle').textContent = title;
    $('cfBody').innerHTML = '<p class="small">🍖 Getting your meals ready for <b>' + fmt(g.ok.length) + '</b> hungry pets…</p><div class="bar"><i id="pg" style="width:0"></i></div><div class="small" id="pgt">0 of ' + fmt(g.ok.length) + ' pets</div>';
    $('cfYes').textContent = 'Sign & burn in XCP Wallet'; $('cfNo').textContent = 'Cancel'; $('cfYes').disabled = true; $('cfNo').disabled = false; open('confirmBox');
    var t0 = performance.now();
    V.feedQueueAsync(w, ME, g.ok, faNb(w, null, list), function (d, n) { if (tok !== feedTok) return; var pc = n ? 100 * d / n : 100; if ($('pg')) $('pg').style.width = pc.toFixed(1) + '%'; if ($('pgt')) $('pgt').textContent = fmt(d) + ' of ' + fmt(n) + ' pets'; })
      .then(function (plans) { if (list) plans = plans.filter(function (q) { return !isFeedAllTag(q && q.tag); }); window.V2LastFeedPlanMs = Math.round(performance.now() - t0); if (tok !== feedTok || !$('confirmBox').classList.contains('on')) return; confirmPlans(title, noDiscarded(plans), null, g); }, function (e) { toast('Could not plan the feed: ' + esc(String(e && e.message || e))); });
  }
  $('cfNo').addEventListener('click', function () { feedTok++; });
  if (FEED_ALL_PAUSED) { $('bFeedHungry').style.display = 'none'; $('bFeedHungry').insertAdjacentHTML('afterend', '<span class="small muted" id="faPaused">' + FA_NOTE + '</span>'); }
  $('bFeedHungry').onclick = function () { if (FEED_ALL_PAUSED) return toast(FA_NOTE); var w = world(); feedAsync('Feed all hungry pets', w.pets.filter(function (p) { return p.owner === ME; }).map(function (p) { return p.id; })); };
  $('bFeedSel').onclick = function () { feedAsync('Feed selected pets', window.UXB && UXB.shownSel ? UXB.shownSel(sel()) : sel(), true); }; /* mypets-species-filter: only the checked pets that are shown */
  $('bRoll').onclick = function () { var ids = pickIds(), rn = Math.max(1, Math.min(10, Number($('rollN').value) || 1)), q = V.rollQueue(world(), ME, ids, rn); if (!ids.length) return toast('☑ Tick pets in My Pets first: the roll acts on your selected pets.'); var sp = ids.length + ' selected pet' + (ids.length === 1 ? '' : 's'), wh = q.length && q[0].tag === 'pet:spin'; confirmPlans(wh ? '🎡 ' + q.length + ' wheel spin' + (q.length === 1 ? '' : 's') + ' for your ' + sp + ' (' + rn + ' each; the wheel picks a random pet)' : '🎲 Roll gear for your ' + sp + ' · ' + q.length + ' roll' + (q.length === 1 ? '' : 's'), q); }; /* mypets-checkbox: selected pets */
  if ($('bRelease')) $('bRelease').onclick = function () { if (!S.sel.length) return toast('Select pets first'); confirmPlans('Release ' + S.sel.length + ' pets (max ' + V.MAX_RELEASE_PER_BURN + ' per burn)', V.releaseBatches(sel())); };
  $('bAuto').onclick = function () { if (viewBlock()) return; var ids = pickIds(); if (!ids.length) return toast('☑ Tick pets in My Pets first: Auto-equip acts on your selected pets.'); var ops = V.autoEquipOps(world(), ME, ids, S.tip); S.ops = S.ops.concat(ops); save(); toast('✨ Auto-equip on ' + ids.length + ' selected pet' + (ids.length === 1 ? '' : 's') + ': ' + ops.length + ' pieces (free, no burn)'); render(); }; /* mypets-checkbox: selected pets */
  if ($('bOutfit')) $('bOutfit').onclick = function () { if (viewBlock()) return;
    if (!pickIds().length) return toast('☑ Tick pets in My Pets first: Outfit acts on your selected pets.'); var w = world(), inv = w.itemList.filter(function (g) { return g.owner === ME && g.on == null; });
    $('outfitBody').innerHTML = '<p class="small">Uses free copies from your stash. Missing copies or closed slots are skipped.</p>' + V.V2_SLOTS.map(function (sl) { var k = {}; inv.filter(function (g) { return g.slot === sl; }).forEach(function (g) { (k[g.item] = k[g.item] || { l: g.label, n: 0 }).n++; });
      return '<div class="row small"><b class="slotname">' + SL(sl) + '</b> <select class="pick" data-o="' + sl + '"><option value="">(leave)</option>' + Object.keys(k).map(function (id) { return '<option value="' + id + '">' + esc(k[id].l) + ' · ' + k[id].n + ' free ' + (k[id].n === 1 ? 'copy' : 'copies') + (k[id].n < S.sel.length ? ' (not enough for ' + S.sel.length + ')' : '') + '</option>'; }).join('') + '</select></div>'; }).join('') + '<p class="small muted">' + S.sel.length + ' pets selected. Each pet needs its own free copy (one item = one pet).</p>';
    $('oGo').style.display = ''; $('oNo').textContent = 'Cancel'; open('outfitBox'); };
  $('oNo').onclick = function () { close('outfitBox'); };
  $('oGo').onclick = function () { if (viewBlock()) return; var o = {}; document.querySelectorAll('[data-o]').forEach(function (s) { if (s.value) o[s.dataset.o] = s.value; });
    if (!Object.keys(o).length) return toast('Pick at least one piece');
    var r = V.outfitOps(world(), ME, pickIds(), o, S.tip); /* mypets-checkbox: selected pets */ S.ops = S.ops.concat(r.ops); save(); render();
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
  function goPet(id, e) { var u = 'pet.html?id=' + id; if (e && (e.ctrlKey || e.metaKey || e.button === 1)) window.open(u, '_blank'); else { try { sessionStorage.setItem('xcpets-v2-petret', JSON.stringify({ y: Math.round(window.scrollY), id: id, at: Date.now(), path: location.pathname + location.search })); } catch (x) { } location.href = u; } }
  /* flow-fixes (2026-10-22): coming back from a pet page (Back, or its back link) puts My Pets where you left it and flashes that card. UI only. */
  function petReturn() { var r = null; try { r = JSON.parse(sessionStorage.getItem('xcpets-v2-petret')); } catch (e) { } if (!r || Date.now() - r.at > 1800000 || r.path !== location.pathname + location.search) return;
    var nav = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || {}; if (nav.type !== 'back_forward' && !/pet\.html/.test(document.referrer)) return;
    try { sessionStorage.removeItem('xcpets-v2-petret'); } catch (e) { } window.__ipNoPin = true; var n = 0, user = false; ['wheel', 'touchstart', 'keydown'].forEach(function (ev) { window.addEventListener(ev, function () { user = true; }, { once: true, passive: true }); });
    (function aim() { if (user) return; var c = document.querySelector('#pets .pet.card[data-pid="' + r.id + '"]');
      if (c) { c.scrollIntoView({ block: 'center', behavior: 'instant' }); c.classList.add('flash'); setTimeout(function () { c.classList.remove('flash'); if (!user) c.scrollIntoView({ block: 'center', behavior: 'instant' }); }, 2400); return; }
      window.scrollTo({ top: r.y, behavior: 'instant' }); if (++n < 75) setTimeout(aim, 400); })(); }
  petReturn();
  /* P10: pet-page actions that need this page's burn flow (confirmPlans + wasted-burn guard) arrive as play.html#act-<feed|roll|froll|oroll>-ID;
   * the pet detail pop-up stays reachable as play.html#pet-ID ('More in the game' on the pet page) so nothing is lost. */
  function actBack(p) { setTimeout(function () { var cb = $('confirmBox'); if (!cb || !cb.classList.contains('on')) return; var link = '<a href="pet.html?id=' + p.id + '">← Back to #' + p.id + ' ' + esc(p.name || '') + '</a>';
      $('cfBody').insertAdjacentHTML('afterbegin', '<p class="small cf-back">' + link + '</p>');
      var mo = new MutationObserver(function () { if (cb.classList.contains('on')) return; mo.disconnect(); toast(link + ' <span class="muted">· results show on the pet page once the burn confirms</span>', 15000); }); mo.observe(cb, { attributes: true, attributeFilter: ['class'] }); }, 50); }
  /* pet-gift: pet.html / the batch picker arrive as play.html#gift-<id.id.id>-<player# base 32>; the confirm then signs each 1-dander burn in turn
   * (same confirmPlans queue: one XCP Wallet window at a time, Stop + Resume). Locked pets are dropped here and skipped by the engine anyway. */
  function swapRoute() { var m = /^#(swap)-(\d+)-(\d+)$|^#(swapok|swapno)-(\d+)$/.exec(location.hash); if (!m || !V.swapPlan) return false; if (V.tokenOnly && V.tokenOnly()) { history.replaceState(null, '', location.pathname + location.search); toast('🔁 Swap burns are off: swap by gifting each other the pet tokens, or a token-for-token DEX order.', 9000); return true; }
    if (!world() || !ME || !S.rows || !S.rows.length) { swapRoute.n = (swapRoute.n || 0) + 1; if (swapRoute.n < 90) setTimeout(swapRoute, 2000); return true; }
    history.replaceState(null, '', location.pathname + location.search);
    if (m[1]) confirmPlans('🔁 Offer #' + m[2] + ' for #' + m[3], [V.swapPlan(Number(m[2]), Number(m[3]))]); else if (m[4] === 'swapok') confirmPlans('🔁 Accept swap ' + m[5], [V.swapOkPlan(Number(m[5]))]); else confirmPlans('Close swap offer ' + m[5], [V.swapNoPlan(Number(m[5]))]); return true; }
  window.V2HiGo = function () { confirmPlans('👋 Get my player #', [V.hiPlan]); };
  window.V2SwapGo = function (h) { location.hash = h; swapRoute(); };
  function giftRoute() { if (swapRoute()) return true; var m = /^#gift-([0-9.]+)-([0-9A-Va-v]+)$/.exec(location.hash); if (!m || !V.giveBatches) return false;
    if (V.tokenOnly && V.tokenOnly()) { history.replaceState(null, '', location.pathname + location.search); toast('🎁 Gifts are pet token sends now: use 🎁 Gift (pick pets, paste the address, Send).', 9000); return true; }
    var w = world(); if (!w || !ME || !S.rows || !S.rows.length) { giftRoute.n = (giftRoute.n || 0) + 1; if (giftRoute.n < 90) setTimeout(giftRoute, 2000); return true; }
    history.replaceState(null, '', location.pathname + location.search); var n = parseInt(m[2], 32), b = (S.tip || 0) + 1, ok = [], no = [];
    m[1].split('.').map(Number).forEach(function (id) { var why = V.giveWhy(w, { petId: id, to: n }, ME, b); if (why) no.push('#' + id + ' ' + why); else ok.push(id); });
    if (no.length) toast('🎁 Not in the gift: ' + esc(no.join(' · ')), 9000); if (!ok.length) return true;
    confirmPlans('🎁 Gift ' + ok.length + ' pet' + (ok.length > 1 ? 's' : '') + ' to player #' + V.playerCode(n), V.giveBatches(ok, n)); return true; }
  window.V2GiftConfirm = function (ids, n) { location.hash = 'gift-' + ids.join('.') + '-' + V.playerCode(n); giftRoute(); };
  /* CEMETERY LOOP (Oct 29 2026): cemetery.html hands its burns here (#cem-<tag>~<tag>…), so they go through this page's one guarded confirm sheet
   * (send guard, stale check, fee line, XCP Wallet signing). Only cemetery tags and hunts (pet:fight on a zombie) are accepted; each amount is
   * worked out again here from the cost list at the next block (V.cemCost, halving-aware), never taken from the link. */
  var CEM_KIND = { seance: 'seance', alt: 'pledge', altm: 'pledge', altg: 'pledge', raise: 'raise', zfeed: 'zmeal', zfm: 'zmeal', rpl: 'rpl', rplg: 'rpl', resurrect: 'resurrect' };
  function cemRoute() { var m = /^#cem-(.+)$/.exec(location.hash); if (!m || !V.cemCost) return false; var tags; try { tags = decodeURIComponent(m[1]).split('~').slice(0, 24); } catch (e) { return false; }
    var w = world(); if (!ME || !S.rows || !S.rows.length) { cemRoute.n = (cemRoute.n || 0) + 1; if (cemRoute.n < 90) setTimeout(cemRoute, 2000); return true; } /* wait for the wallet and the chain replay */
    history.replaceState(null, '', location.pathname + location.search); var b = (S.tip || 0) + 1, bad = null;
    var plans = tags.map(function (tag) { var t = V.parseTag(tag); if (!t) { bad = bad || tag; return null; } var k = CEM_KIND[t.action] || (t.action === 'fight' && w.byId[t.b] && ZB(w.byId[t.b]) ? 'hunt' : null); if (!k) { bad = bad || tag; return null; }
      return { tag: tag, amount: V.cemCost(w, k, b), petId: t.grave != null ? t.grave : t.zombie != null ? t.zombie : t.b, label: k }; }).filter(Boolean);
    if (bad || !plans.length) { toast('That cemetery link holds a burn this page does not send (' + esc(String(bad || 'none')) + ').'); return true; }
    var hunt = plans[0].label === 'hunt'; confirmPlans(hunt ? '🗡️ Zombie hunt' : '🕯️ Cemetery: ' + plans.length + ' burn' + (plans.length > 1 ? 's' : ''), plans); return true; }
  function actRoute() { if (cemRoute()) return true; if (giftRoute()) return true; var m = /^#act-(feed|roll|froll|oroll)-(\d+)$/.exec(location.hash); if (!m) return false;
    var w = world(), p = w && w.byId[m[2]], a = m[1]; if (!p || !ME || !S.rows || !S.rows.length) { actRoute.n = (actRoute.n || 0) + 1; if (actRoute.n < 90) setTimeout(actRoute, 2000); return true; } /* wait for the chain replay */
    history.replaceState(null, '', location.pathname + location.search); if (!ME || p.owner !== ME || p.dead || p.released) { toast('Only the owner of a living pet can do that. Connect the wallet that owns #' + p.id + '.'); return true; }
    actBack(p);
    if (a === 'feed') { if (p.mythicCare || !p.hungry) { toast('#' + p.id + (ZB(p) ? ' is a risen zombie: it eats pets, not meals. Use 🍖 Feed zombie on its card.' : p.mythicCare ? ' is Mythic: no meals needed.' : ' is not hungry right now.')); return true; } confirmPlans('Feed #' + p.id, feedQ(w, ME, [p.id])); }
    else if (a === 'froll') confirmPlans('Free roll #' + p.id, [V.freeRollPlan(p.id)]); else if (a === 'oroll') confirmPlans('Overflow roll #' + p.id, [V.overflowRollPlan(p.id)]);
    else confirmPlans('Gear roll #' + p.id, V.rollQueue(w, ME, [p.id], 1)); return true; }
  function detail(p, w) {
    if (!p) return; w = w || world(); $('dTitle').innerHTML = (p.owner === ME && !p.dead ? keepBtn(p.id) : '') + esc(p.name) + ' <span class="muted">#' + p.id + '</span> ' + tierPill(p.tier);
    var kb = $('dTitle').querySelector('.keepbtn'); if (kb) kb.onclick = function (e) { e.preventDefault(); toggleKeep(p.id); };
    var frs = petFrames(p, w); paint($('dCanvas'), frs[0]); R.animate($('dCanvas'), frs);
    $('dStats').innerHTML = statBars(p);
    var inv = w.itemList.filter(function (g) { return g.owner === ME && g.on == null; }), legAll = V.legendaryOf(p.species), leg = legAll[0];
    var h = '<a class="btn openpet" id="dOpenPet" href="pet.html?id=' + p.id + '">Open pet page →</a>' + (window.V2Rivals ? V2Rivals.strip(w, p.id, function (fid) { return 'fight.html#replay-' + fid; }) : '') + (R.bredFrom ? '<div class="chips dbred">' + R.bredFrom(w, p, true) + '</div>' : '') + '<p>' + esc(spLabel(p.species)) + ' · ' + p.stageName + ' · care ' + fmt(p.care) + ' / ' + fmt(R.careTarget(w, p, S.tip).mythic) + (R.careTarget(w, p, S.tip).discount ? ' (Mythic at ' + fmt(R.careTarget(w, p, S.tip).mythic) + ' care because you raised a Mythic)' : '') + (p.species === 'nakamoto' && !V.nakaNormal(S.tip) ? ' (Nakamoto: 10× thresholds until block ' + fmt(V.ACTIVATE_NAKA_NORMAL_BLOCK) + ', then normal growth)' : '') + ' · W' + (p.wins || 0) + '/L' + (p.losses || 0) + '</p>';
    if (ZB(p)) h += zFeedHtml(p, world()) + zRplHtml(p, world());
    if (!p.dead && !p.released && ME && p.owner === ME) h += '<div class="row">' + (ZB(p) ? '' : '<button class="btn ico-flame" data-a="feed"' + (p.hungry ? '' : ' disabled') + '>Feed (' + fmt(p.nextMeal) + ')</button>') + /* zombie-feed-pets: a zombie never takes a normal meal, so no Feed button on its panel */ (V.wheelOn && V.wheelOn((S.tip || 0) + 1) ? '<a class="btn ghost" href="#rare-room" title="Gear rolls are Pepe Wheel spins: the piece goes to a random pet of yours">🎡 Spin the Pepe Wheel</a>' : '<button class="btn ghost ico-flame" data-a="roll" title="Burn ' + fmt(V.COSTS.roll) + ' XCPETS for one random gear piece for this pet">🎲 Roll for gear (' + fmt(V.COSTS.roll) + ')</button>') + frBtn(w) + ofBtn(w, p) + '<button class="act ghost" id="dDiscard" title="Moves it to the Discard pile (only hidden in this browser). Free, no burn; restore any time.">🗑️ Discard pet</button></div>' +
      (p.owner === ME ? rollHelp(p) : '');
    h += R.starveHtml ? R.starveHtml(w, p, ME) : ''; /* starve-warning (2026-10-19): neglected + gear worn -> countdown, worn pieces, Feed (display only) */
    h += '<h3 class="sec" data-ico="gear">Gear <span class="small muted gcount">' + V.wornOf(w, p.id).length + '/' + p.capacity + '</span></h3><div class="gpicker" id="gPicker"></div>' + (window.UXB && !p.dead ? UXB.petOdds(p, w) : ''); // pop-up cleanup 2026-10-14: no long capacity/signature/how-to text
    h += '<h3 class="sec" data-ico="egg">Born traits</h3><table class="small borntraits">' + V.bornTraits(p, p.stage).map(function (r) { return '<tr><td class="muted">' + esc(r[0]) + '</td><td>' + (r[0] === 'Background colour' ? '<span style="display:inline-block;width:10px;height:10px;border:1px solid #000;background:' + esc(r[1]) + '"></span> ' : '') + esc(r[1]) + '</td></tr>'; }).join('') + '</table>';
    h += '<h3 class="sec" data-ico="egg">Family tree</h3>' + tree(V.familyTree(w, p.id), true) + R.familyHtml(w, p, S.tip) + '';
    var keepOpen = $('gPicker') ? $('gPicker').getAttribute('data-open') : null, keepY = $('detail').querySelector('.box') ? $('detail').querySelector('.box').scrollTop : 0;
    $('dInfo').innerHTML = h;
    $('dInfo').querySelectorAll('.dbred [data-jump]').forEach(function (a) { a.onclick = function (e) { var q = w.byId[a.getAttribute('data-jump')]; if (!q) return; e.preventDefault(); detailId = q.id; detail(q, w); }; });
    if (keepOpen && detail.lastId === p.id) $('gPicker').setAttribute('data-open', keepOpen); detail.lastId = p.id;
    R.gearPicker($('gPicker'), { compact: true, world: w, owner: ME, pet: p, msg: detail.msg, viewOnly: viewOnly(), onBlocked: viewBlock, onEquip: function (op, m) { if (viewBlock()) return; op.block_index = S.tip; S.ops.push(op); save(); detail.msg = '✓ ' + m; render(); detail.msg = null; toast(esc(m) + ' (free)'); },
      onEquipMany: function (ops, m) { if (viewBlock()) return; ops.forEach(function (op) { op.block_index = S.tip; S.ops.push(op); }); save(); detail.msg = '✓ ' + m; render(); detail.msg = null; toast(esc(m) + ' (free)'); } });
    $('detail').querySelector('.box').scrollTop = keepY;
    if ($('dDiscard')) $('dDiscard').onclick = function () { var id = p.id; if (!ME || p.owner !== ME || p.dead) return; if (isKept(id)) return toast('★ #' + id + ' is starred, so it is never discarded. Unstar it first.'); close('detail'); discardIds([id]); };
    zFeedBind($('dInfo'));
    $('dInfo').querySelectorAll('button[data-a]').forEach(function (b) { b.onclick = function () { var a = b.dataset.a; if (!ME || p.owner !== ME || p.dead || p.released) return toast('Only the owner of a living pet can do that. Connect the wallet that owns #' + p.id + '.'); if (a === 'froll') return confirmPlans('Free roll #' + p.id, [V.freeRollPlan(p.id)]); if (a === 'oroll') return confirmPlans('Overflow roll #' + p.id, [V.overflowRollPlan(p.id)]); confirmPlans(a === 'feed' ? 'Feed #' + p.id : 'Gear roll #' + p.id, a === 'feed' ? V.feedQueue(world(), ME, [p.id]) : V.rollQueue(world(), ME, [p.id], 1)); }; });
    open('detail');
  }
  /* founder free rolls (prototype 2026-10-15): pet:fr:ID button + "Free rolls left: N" (minus our unconfirmed pet:fr burns); hidden at 0, non-founders, before activation */
  function frPendingTags() { var T = window.V2Wallet && V2Wallet.tracker ? V2Wallet.tracker.list() : []; return T.filter(function (t) { return !S.rows.some(function (x) { return x.tx_hash === t.txid; }); }).map(function (t) { return t.tag; }); }
  /* Mythic discount overflow rolls: one gear roll per full 1,000 care above 21,000; claimed with a 1-sat pet:of:ID burn (same style as the founder Free roll) */
  function ofBtn(w, p) { var f = V.overflowRolls ? V.overflowRolls(w, p, frPendingTags()) : null; return f && f.on ? freeRollButton('oroll', 'Care past Mythic', 'Overflow roll', f.left) : ''; }
  /** one free-roll button + its "left" counter (founder Free roll and Mythic-discount Overflow roll share the same markup) */
  function freeRollButton(action, why, label, left) { return '<button class="btn ghost ico-flame" data-a="' + action + '" title="' + why + ': one random gear piece for this pet. You only burn 1 dander of XCPETS">' + label + '</button><span class="small muted frleft">' + label + 's left: ' + fmt(left) + '</span>'; }
  /** the plain "what a roll gives" line under the pet's roll button, plus a pending line while this pet's roll burns wait to confirm */
  function rollHelp(p) { var n = window.UXB && UXB.pendingFor ? UXB.pendingFor(p.id) : 0, bag = !autoEquipIsOn();
    if (V.wheelOn && V.wheelOn((S.tip || 0) + 1)) return '<p class="small muted grhelp">🎡 Gear rolls are Pepe Wheel spins: burn ' + fmt(V.COSTS.roll) + ' XCPETS and the wheel picks a random living pet of yours (rarer pets come up more often: Common 1 · Uncommon 2 · Rare 4 · Legendary 8), then puts one random piece straight on it' + (V.allSlotsNow && V.allSlotsNow(world()) ? '' : ', or in its bag 🎒 if that slot is still locked') + '. It may not be this pet.</p>' +
      (n ? '<p class="small grpending" role="status">🎁 Gear on the way' + (n > 1 ? ' (' + n + ' spins)' : '') + ': it arrives once your burn confirms, usually in about 10 minutes.</p>' : ''); /* similar-bugs-fix: since the wheel (972,589) a roll is not 'for this pet' */
    return '<p class="small muted grhelp">🎲 Roll for gear: burn ' + fmt(V.COSTS.roll) + ' XCPETS for one random piece for this pet. ' + (bag ? 'It goes to your stash (Auto-equip is off); equip it free.' : 'Auto-equip is on: it is worn right away unless the pet already wears something better.') + '</p>' +
      (n ? '<p class="small grpending" role="status">🎁 Gear on the way' + (n > 1 ? ' (' + n + ' rolls)' : '') + ': it arrives once your burn confirms, usually in about 10 minutes.</p>' : ''); }
  function frBtn(w) { var f = V.freeRolls(w, ME, frPendingTags()); return f.on ? freeRollButton('froll', 'Founder reward', 'Free roll', f.left) : ''; }
  $('dClose').onclick = function () { close('detail'); detailId = null; };

  // ---------------------------------------------------------------- inventory (live invcards)
  var invView = S.ui_inv || 'mine', invSlot = S.ui_invSlot || 'all';
  /* lair-perf (owner Oct 20 2026): the Lair scene + stash are only rebuilt while #invPanel is on screen (or within 800px of it); off screen a
   * render marks them stale and they catch up the moment the Lair scrolls into view. Display only. */
  var lairVis = null, lairStale = false, lairIO = null;
  function lairOn() { if (!window.IntersectionObserver) return true; var el = $('invPanel'); if (!el) return true;
    if (!lairIO) { lairIO = new IntersectionObserver(function (es) { var v = es[es.length - 1].isIntersecting; lairVis = v; if (v && lairStale) { lairStale = false; var w = world(); if (w) { lairPaint(w); if (window.UXB && UXB.paintInv) try { UXB.paintInv(w); } catch (e) { if (window.console) console.error(e); } } } }, { rootMargin: '800px 0px' }); lairIO.observe(el); }
    if (lairVis === null) { var r = el.getBoundingClientRect(); lairVis = r.bottom > -800 && r.top < innerHeight + 800; }
    return lairVis; }
  function lairPaint(w) { if (window.V2Shop) { try { V2Shop.render(w); } catch (e) { if (window.console) console.error(e); } } }
  function lairRender(w) { if (lairOn()) lairPaint(w); else lairStale = true; }
  function renderInv(w) {
    var items = w.itemList.filter(function (g) { return g.owner === ME; }), box = $('inv'); var nFree = items.filter(function (g) { return g.on == null; }).length; $('invCount').textContent = items.length; if ($('invCountTxt')) $('invCountTxt').textContent = (items.length === 1 ? 'piece' : 'pieces') + ' of gear · ' + nFree + ' unworn'; /* one gear count (owner Oct 20 2026): same 'N pieces · U unworn' as the Lair */
    $('tokens').textContent = String(V.tokensOf(w, ME)); // roll tokens this wallet's pets found (each already became a free gear item)
    if (window.UXB && UXB.paintInv) return; /* lair-perf (Oct 20 2026): ux-batch paints #inv (My stash / Collection log) right after, so this per-piece grid (2,000+ icons for big owners) was drawn and thrown away */
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
  /* address-lookup (2026-10-19): view only = this page shows an address that is not this browser's XCP Wallet (play.html?addr= or the
   * View pets by address box). Everything stays viewable; wallet actions (burns, equip / unequip, auto-equip, outfits) show the same
   * connect prompt as the not-connected case instead. Nothing is signed or sent. */
  /* flow-fixes (2026-10-22): no wallet / view-only burn tap -> small sheet: Connect XCP Wallet · View by address · Cancel. Nothing moves until you pick. */
  function nwSheet(msg) { var b = $('nwBox'); if (!b) { b = document.createElement('div'); b.className = 'reveal'; b.id = 'nwBox'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-modal', 'true');
      b.innerHTML = '<div class="box"><h2 class="sec" data-ico="flame">Connect to burn</h2><p class="small" id="nwMsg"></p><div class="row" style="justify-content:center"><button type="button" class="btn" id="nwConnect">🔌 Connect XCP Wallet</button><button type="button" class="btn ghost" id="nwView">👀 View by address</button><button type="button" class="q" id="nwCancel">Cancel</button></div></div>';
      document.body.appendChild(b); b.addEventListener('click', function (e) { if (e.target === b) close('nwBox'); });
      $('nwCancel').onclick = function () { close('nwBox'); };
      $('nwConnect').onclick = function () { close('nwBox'); var wc = $('wconnect'); if (wc) wc.click(); };
      $('nwView').onclick = function () { close('nwBox'); var av = $('addrView'), inp = $('avAddr'); if (av) { av.hidden = false; try { av.scrollIntoView({ block: 'center', behavior: 'instant' }); } catch (e) { } } if (inp) try { inp.focus({ preventScroll: true }); } catch (e) { } }; }
    $('nwMsg').innerHTML = msg; open('nwBox'); }
  function viewOnly() { return !!(ME && window.V2View && window.V2View.viewOnly()); }
  function viewBlock() { if (!viewOnly()) return false;
    nwSheet('👀 Viewing ' + esc(V2View.short(ME)) + ': view only. Connect the XCP Wallet that owns these pets to feed, equip, battle, breed or roll.');
    return true; }
  function zEatNote(plans, w) { var ids = []; plans.forEach(function (q) { if (q && q.zEat) ids = ids.concat(q.zEat); else { var t = q && /^pet:(zfeed|zfm):/.test(q.tag || '') && V.parseTag ? V.parseTag(q.tag) : null; if (t && t.ids) ids = ids.concat(t.ids.map(Number)); } }); if (!ids.length) return '';
    return '<p class="small warn zb-eatnote">🧟 The zombie eats these pets for good: ' + ids.map(function (f) { var F = w.byId[f]; return '<b>' + esc((F && F.name) || '#' + f) + ' #' + f + '</b>' + (F ? ' (' + TL[F.tier | 0] + ')' : ''); }).join(', ') + '. The XCPETS below is only the meal fee.</p>'; }
  function confirmPlans(title, plans, after, pre) {
    if (viewBlock()) return;
    if (!ME) { /* no wallet: a small sheet (flow-fixes 2026-10-22: no auto-scroll / auto-click any more) */ nwSheet('🔌 Every action is a burn signed in your own XCP Wallet (desktop Chrome extension). Connect it to play, or look up any address to view its pets.'); return; }
    if (FEED_ALL_PAUSED && plans.some(function (q) { return isFeedAllTag(q && q.tag); })) { plans = plans.filter(function (q) { return !isFeedAllTag(q && q.tag); }); toast(FA_NOTE + ' Those burns were not sent.'); if (!plans.length) return; }
    var bw = world(), skip = []; if (V.planAmount) plans = plans.map(function (p) { return V.planAmount(bw, p, (S.tip || 0) + 1); }); /* halving: burn the price at the next block */ plans = plans.filter(function (p) { var m = V.battleBlock(bw, p.tag, S.tip); if (m) skip.push(m); return !m; }); /* battle cap (2026-10-14) */
    var sp = myPendingTags(); plans = plans.filter(function (p) { var m = V.sendBlock ? V.sendBlock(bw, p, S.tip, { me: ME, pending: sp }) : null; if (m) skip.push('🚫 Not sent (' + p.tag + '): ' + m); else sp.push(p.tag); return !m; }); /* wasted-burn guard (2026-10-20): one shared check mirroring the engine (breed, accept, fight, rolls); never ask the wallet to sign a burn the replay would reject */
    if (skip.length) { toast(skip.length === 1 ? skip[0] : 'Skipped ' + skip.length + ': ' + skip.join(' · ')); window.V2LastBlocked = skip; }
    var fg = feedGuard(bw, plans); plans = fg.plans; if (pre && pre.skipped.length && !fg.skipped.length) fg = { plans: plans, skipped: pre.skipped, text: pre.text };
    if (!plans.length) { if (fg.skipped.length || fg.blocked) feedBlocked(title, fg.text); else if (!skip.length) toast('Nothing to do'); return; }
    var s = V.burnSummary(plans); pendingPlans = plans; pendingAfter = after;
    $('cfTitle').textContent = title;
    $('cfBody').innerHTML = zEatNote(plans, bw) + '<div class="bigamt">' + fmt(s.total) + ' XCPETS</div><p class="small">' + s.burns + ' burn' + (s.burns > 1 ? 's, each signed separately' : '') + (plans.some(function (q) { return q && q.runs; }) ? ' feeding ' + fmt(plans.reduce(function (a, q) { return a + (q && q.petIds ? q.petIds.length : 0); }, 0)) + ' pets (Mythics never eat)' : '') + ' · <span id="cfFee">' + feeLine(s.burns, null) + '</span> · balance after ' + fmt(S.balance - s.total) + '</p>' +
      blocksNote(s.burns) + setupNote(plans) + spinNote(plans, bw) + '<div class="logbox small">' + plans.slice(0, 12).map(function (p) { return '<div><code>' + esc(p.tag) + '</code> · ' + fmt(p.amount) + '</div>'; }).join('') + (plans.length > 12 ? '<div>… +' + (plans.length - 12) + ' more</div>' : '') + '</div>' +
      (fg.skipped.length ? '<p class="small warn">🍽️ Skipped ' + fg.skipped.length + ' pet' + (fg.skipped.length > 1 ? 's' : '') + ' that would gain nothing from a meal: ' + esc(fg.text) + '</p>' : '') +
      (window.UXB ? UXB.confirmExtra(plans, bw) : '') + '<div class="bar"><i id="pg" style="width:0"></i></div><div class="small" id="pgt"></div>';
    $('cfYes').textContent = 'Sign & burn in XCP Wallet'; $('cfNo').textContent = 'Cancel'; $('cfYes').disabled = false; $('cfNo').disabled = false; open('confirmBox');
    if (window.V2Wallet && V2Wallet.feeQuote) V2Wallet.feeQuote().then(function (q) { var el = $('cfFee'); if (el && pendingPlans === plans) el.innerHTML = feeLine(s.burns, q); });
  }
  /* cheaper-fees (owner Oct 27 2026): the confirm sheet shows the live fee rate (mempool.space precise, about 0.1 to 1 sat/vB on a quiet day)
   * and the sats it comes to, per burn and for the whole run, instead of the old flat 1,500 sats per burn guess. Each burn's exact fee is shown
   * again on the progress line right before its XCP Wallet window. */
  function feeLine(n, q) { if (!q || !window.V2Wallet || !V2Wallet.feeEstimate) return 'network fee: checking the rate…';
    var one = V2Wallet.feeEstimate(1, q.rate), all = V2Wallet.feeEstimate(n, q.rate);
    return 'network fee ~' + fmt(one) + ' sats per burn at ' + esc(V2Wallet.rateText(q.rate)) + (n > 1 ? ', ~' + fmt(all) + ' sats for all ' + fmt(n) + ' burns' : '') + ' (estimate; the exact fee shows before each signing)'; }
  /* Overfeed guard (build 2, 2026-10-16, UI only; rules unchanged): before a feed / bundled feed is signed, drop pets the engine says gain nothing
   * (dead, Mythic, already fed this 144-block day, no meal due) and pets with a feed burn of ours still unconfirmed (so a reload never re-burns
   * them), then rebuild the burns with V.feedQueue from the pets that remain. */
  /** myPendingTags(): tags of my burns not yet in the confirmed rows (this browser's tracker + node mempool) */
  function myPendingTags() { var o = [], conf = {}, seen = {}; (S.rows || []).forEach(function (r) { conf[r.tx_hash] = 1; });
    function add(h, tag) { if (!tag || conf[h] || seen[h]) return; seen[h] = 1; o.push(String(tag)); }
    try { if (window.V2Wallet && V2Wallet.tracker) V2Wallet.tracker.list().forEach(function (t) { if (t.status !== 'confirmed') add(t.txid, t.tag); }); } catch (e) { }
    (S.mempool || []).forEach(function (x) { if (x && x.source === ME) add(x.tx_hash, x.tag); }); return o; }
  /* burn-stale-fix (2026-10-24): what this burn depends on, taken before the chain re-read and compared after it (V2Wallet.send).
   * Only a change that matters stops the burn: a pet named in the tag (owner, alive, stage, meal, fed today), the cost list for the
   * next block, a wallet balance below this burn, or the normal send guard (sendBlock) now saying no. New burns by other players don't. */
  function staleCheck(p) { var egg = /^pet:hatch/.test(p.tag); function ids() { var t = V.parseTag(p.tag) || {}, o = []; ['petId', 'a', 'b', 'mine', 'theirs'].forEach(function (k) { if (typeof t[k] === 'number') o.push(t[k]); }); (Array.isArray(t.ids) ? t.ids : []).forEach(function (id) { if (typeof id === 'number') o.push(id); }); return o; }
    function look() { var w = world(), b = (S.tip || 0) + 1, pets = ids().map(function (id) { var q = w.byId[id]; return q ? [id, q.owner, !!q.dead, !!q.released, q.stage, q.nextMeal, !!q.fedToday] : [id, null]; });
      return JSON.stringify({ pets: pets, costs: V.costsAt ? V.costsAt(w, b) : null }); }
    /* still(snap) -> null = go on (nothing that matters changed), '' = plain double-check note, or words that fit the action */
    return { snap: function () { try { return look(); } catch (e) { return null; } },
      still: function (before) { try { if (S.balance != null && Number(p.amount) > S.balance) return 'your wallet now holds ' + fmt(S.balance) + ' XCPETS, less than the ' + fmt(p.amount) + ' this ' + (egg ? 'egg buy' : 'burn') + ' needs';
        var why = sendWhy(p); if (why) return (egg ? 'these eggs can\'t be bought right now (' : 'this pet action can\'t go now (') + why + ')';
        if (before == null) return ''; var now = JSON.parse(look()), was = JSON.parse(before);
        if (JSON.stringify(now.costs) !== JSON.stringify(was.costs)) return egg ? 'the egg cost changed' : 'the burn cost changed';
        if (JSON.stringify(now.pets) !== JSON.stringify(was.pets)) return 'a pet in this burn changed (owner, stage or meal)';
        return null; } catch (e) { return ''; } } }; }
  function sendWhy(plan) { return V.sendBlock ? V.sendBlock(world(), plan, S.tip, { me: ME, pending: myPendingTags() }) : null; }
  function pendingBreedIds() { var o = {}; myPendingTags().forEach(function (g) { var t = V.parseTag(g); if (t && t.action === 'breed') { o[t.a] = 1; var A = world().byId[t.a], B = world().byId[t.b]; if (A && B && A.owner === B.owner) o[t.b] = 1; } }); return o; }
  function pendingFeedIds() { var o = {}, conf = {}; (S.rows || []).forEach(function (r) { conf[r.tx_hash] = 1; });
    function add(tag) { var t = V.parseTag(tag); if (!t) return; if (t.action === 'feed') o[t.petId] = 1; if (t.action === 'feedm' || t.action === 'feedl') t.ids.forEach(function (id) { o[id] = 1; }); if (t.action === 'feedr' && V.feedRunsIds) V.feedRunsIds(world(), ME, t, (S.tip || 0) + 1).forEach(function (id) { o[id] = 1; }); if (t.action === 'feeda') { var ex = new Set(t.ex); world().pets.forEach(function (p) { if (p.owner === ME && (t.un ? (ex.has(p.id) || p.skipBy !== ME) : (!ex.has(p.id) && p.skipBy !== ME))) o[p.id] = 1; }); } }
    try { if (window.V2Wallet && V2Wallet.tracker) V2Wallet.tracker.list().forEach(function (t) { if (t.status !== 'confirmed' && !conf[t.txid]) add(t.tag); }); } catch (e) { }
    (S.mempool || []).forEach(function (x) { if (x && x.source === ME && !conf[x.tx_hash]) add(x.tag); }); return o; }
  /* bigfix 2026-10-20: plain-words heads-up for runs longer than the unconfirmed-burn limit */
  /* feed-burns-fix: say plainly what pet:sk / pet:su burns are, so a feed with setup burns is not a surprise. */
  function setupNote(plans) { var n = plans.filter(function (p) { return /^pet:s[ku]:/.test(p.tag); }).length; if (!n) return '';
    return '<p class="small"><b>ℹ️ ' + fmt(n) + ' of these ' + (n > 1 ? 'are one-time setup burns' : 'is a one-time setup burn') + '.</b> They tell the chain which of your pets Feed all should leave out (pets you discarded or did not pick). After that, Feed all hungry is 1 burn each time.</p>'; }
  /* use-all-spins (owner Oct 27 2026): pet:usespin:all spends every saved spin in this 1 burn; say how many and where the pieces go. */
  function spinNote(plans, w) { if (!plans.some(function (p) { return p.tag === 'pet:usespin:all'; })) return '';
    var n = V.spinsLeft ? V.spinsLeft(w, ME, (S.tip || 0) + 1, myPendingTags()) : 0;
    return '<p class="small"><b>🎁 This 1 burn uses all ' + fmt(n) + ' of your saved spins.</b> Only the Bitcoin fee, nothing else. ' + (V.allSlotsNow && V.allSlotsNow(w) ? 'Each spin picks a random pet of yours and rolls one piece for one of its 6 slots (every pet has all 6 open). A piece it swaps out or can\'t wear goes to your stash.' : 'Each spin picks a random pet of yours (pets with an open slot first) and rolls one piece for one of its 6 slots. <b>Pieces go on your pets\' open slots first; the rest land in bags or the stash.</b> A piece for a slot that is still locked waits in that pet\'s bag until the slot opens, and a piece it swaps out or can\'t wear goes to your stash.') + ' Wear them later in the Dressing room.</p>'; }
  function blocksNote(burns) { var cap = (window.V2Wallet && V2Wallet.CHAIN_CAP) || 24; if (burns <= cap) return '';
    var blocks = Math.ceil(burns / cap); return '<p class="small"><b>📦 ' + fmt(burns) + ' burns, about ' + blocks + ' Bitcoin blocks (~' + (blocks * 10) + ' min).</b> Bitcoin lets about ' + cap + ' of your burns wait at once, so you sign ' + cap + ', wait for the next block, then press Continue. Nothing is lost if you stop: Continue picks up where you left off.</p>'; }
  function guardIds(w, ids) { var pend = pendingFeedIds(), why = {}, ok = ids.filter(function (id) { var r = V2Habits.feedWhy(w, w.byId[id], ME, pend, (S.tip || 0) + 1, V); /* habits-ux: + away on a quest */
      if (r) (why[r] = why[r] || []).push(id); return !r; }), oks = new Set(ok), skipped = ids.filter(function (id) { return !oks.has(id); });
    return { ok: ok, skipped: skipped, text: Object.keys(why).map(function (r) { return idList(why[r]) + ' ' + r; }).join(' · ') }; }
  /* habits-ux (Oct 27 2026): check feeds before signing, for pet:feed/fm/fl and feed-all (fa/fx/fy + sk/su). Pets already fed this chain day, dead,
   * away on a quest (and the older checks) are dropped; blocked = no pet left, so no feed burn (and no lone skip-list burn) is composed. */
  function feedGuard(w, plans) { return V2Habits.feedGuardPlans(w, plans, { me: ME, pend: pendingFeedIds(), nb: (S.tip || 0) + 1, V: V, idList: idList, queue: function (ok) { return feedQ(w, ME, ok, undefined, !plans.some(function (q) { return isFeedAllTag(q && q.tag); })); } }); } /* the guard keeps the plan's kind: list burns stay list burns */
  function feedBlocked(title, text) { pendingPlans = null; $('cfTitle').textContent = title || 'Feed';
    $('cfBody').innerHTML = '<p class="warn"><b>🍽️ Nothing to feed, so no burn was made.</b></p><p class="small">' + esc(text || 'no pet left to feed') + '</p><p class="small muted">Nothing was signed and no XCPETS were burned.</p>';
    $('cfYes').disabled = true; $('cfYes').style.display = 'none'; $('cfNo').textContent = 'Close'; $('cfNo').disabled = false; open('confirmBox'); window.V2LastBlocked = [text];
    var cb = $('confirmBox'), y = $('cfYes'), mo = new MutationObserver(function () { if (!cb.classList.contains('on')) { y.style.display = ''; mo.disconnect(); } }); mo.observe(cb, { attributes: true, attributeFilter: ['class'] }); }
  /* Resume (build 2): the unsent part of a stopped multi-burn run is kept per network + address so a reload offers Continue instead of rebuilding sent burns */
  function resumeKey() { return 'xcpets-v2-resume-' + NET + '-' + (ME || ''); }
  function saveResume(title, rest) { try { if (rest && rest.length) localStorage.setItem(resumeKey(), JSON.stringify({ title: title, plans: rest, at: Date.now() })); else localStorage.removeItem(resumeKey()); } catch (e) { } }
  function loadResume() { try { var o = JSON.parse(localStorage.getItem(resumeKey()) || 'null'); if (o && o.plans && o.plans.length && Date.now() - o.at < 24 * 3600e3) return o; localStorage.removeItem(resumeKey()); } catch (e) { } return null; }
  var resumeShown = false;
  function offerResume() { if (resumeShown || !ME || viewOnly()) return; var o = loadResume(); if (!o) return; resumeShown = true;
    if (FEED_ALL_PAUSED && o.plans.some(function (q) { return isFeedAllTag(q && q.tag); })) { saveResume(null, null); toast('⏸️ ' + FA_NOTE + ' Your unfinished Feed all run was stopped. Nothing more will be sent.', 15000); return; }
    toast('⏸️ ' + o.plans.length + ' burn' + (o.plans.length > 1 ? 's' : '') + ' from an unfinished run (' + esc(o.title || 'burns') + ') were not sent. <a href="#" class="resume">Continue</a> · <a href="#" class="resdrop">Dismiss</a>', 30000);
    var t = $('toasts').lastChild; t.querySelector('.resume').onclick = function (e) { e.preventDefault(); t.remove(); confirmPlans('Continue: ' + (o.title || 'burns'), o.plans); };
    t.querySelector('.resdrop').onclick = function (e) { e.preventDefault(); t.remove(); saveResume(null, null); }; }
  $('cfNo').onclick = function () { close('confirmBox'); pendingPlans = null; };
  $('cfYes').onclick = function () { var plans = pendingPlans; if (!plans) return; var s = V.burnSummary(plans); if (!ME || V2Wallet.current() !== ME) { toast('Connecting XCP Wallet…'); V2Wallet.connect().then(function (a) { if (a !== ME) location.reload(); else $('cfYes').onclick(); }, function (e) { toast(V2Wallet.errHtml(e)); }); return; } if (s.total > S.balance && !(S.stale && !S.verified)) return toast('Not enough XCPETS in this wallet'); /* direct-counterparty-api: a saved copy has no balance yet (0); the pre-burn re-read reads it and v2-wallet re-checks */
    $('cfYes').disabled = true; $('cfNo').disabled = true; var i = 0, title = $('cfTitle').textContent, day0 = V.day(S.tip || 0); saveResume(title, plans);
    /* wasted-burn guard (2026-10-20): a long Feed all queue can cross a 144-block chain day while it is being signed. When the day changes, the unsent
     * feed burns are rebuilt for the new day (same feedGuard), so no meal is sized or skipped for the old day. Other burns are untouched. */
    function redayFeeds() { var d = V.day(S.tip || 0); if (d === day0) return; day0 = d; var rest = plans.slice(i); if (!rest.some(function (q) { var t = V.parseTag(q.tag); return t && /^feed/.test(t.action); })) return;
      var g = feedGuard(world(), rest); plans = plans.slice(0, i).concat(g.plans); if (g.skipped.length) toast('🍽️ New chain day: rebuilt the remaining meals · ' + esc(g.text)); else toast('🍽️ New chain day: rebuilt the remaining meals for the new day.'); }
    /* habits-ux: right before each feed burn is composed (wallet chaining too), drop it if none of its pets can still eat */
    function feedDrop() { var q = plans[i], t = q && V.parseTag(q.tag); if (!t || !/^feed/.test(t.action)) return false; var g = feedGuard(world(), [q]); if (!g.blocked) return false;
      plans.splice(i, 1); toast('🍽️ Skipped ' + esc(q.tag) + ' before signing: ' + esc(g.text)); return true; }
    function sendOnce(p, k, n) { /* wallet-one-window: no auto-retry on -32005 (each retry rebuilt the burn and opened another XCP Wallet window); V2Wallet.send turns it into a finish-or-close message */
      /* burn-compose-fix: show which step the burn is on (chain check / fee / node i of n / safety check / XCP Wallet) instead of one static line */
      var pre = 'Burn ' + k + ' of ' + n + ': ';
      return V2Wallet.send(p, ME, function (a, b, ph, fi) { var m = ph === 'fresh' ? 'checking the latest chain data…' : ph === 'fee' ? 'getting the network fee rate…' : ph === 'check' ? 'safety-checking ' + p.tag + ' (node ' + a + ' of ' + b + ')…' : ph === 'sign' ? (fi && fi.text ? fi.text + ' · ' : '') + 'approve ' + p.tag + ' in XCP Wallet now. If no window opened, click the XCP Wallet icon in your browser toolbar.' : 'building ' + p.tag + ' on Counterparty node ' + a + ' of ' + b + '…'; $('pgt').textContent = pre + m; }, staleCheck(p)); }
    var starred = 0;
    (function step() { if (i >= plans.length) { keptToast(starred); starred = 0; save(); saveResume(null, null); if (plans.some(function (p) { return p.tag === 'pet:hatchzap'; })) try { window.dispatchEvent(new Event('xcpets:zap')); } catch (e) { } $('pgt').textContent = '✓ ' + plans.length + ' burn' + (plans.length > 1 ? 's' : '') + ' sent from XCP Wallet. They appear here once confirmed in a block.'; var nr = plans.filter(function (q) { return /^pet:(roll|fr|of):/.test(q.tag); }).length; if (nr) toast('🎁 Gear on the way' + (nr > 1 ? ' (' + nr + ' rolls)' : '') + '. Your piece' + (nr > 1 ? 's show' : ' shows') + ' up here once the burn confirms, usually in about 10 minutes.', 9000); setTimeout(function () { close('confirmBox'); var a = pendingAfter; pendingPlans = null; render(); if (a) a(); }, 400); return; }
      redayFeeds(); if (i >= plans.length) return step(); if (feedDrop()) return step();
      if (FEED_ALL_PAUSED && isFeedAllTag(plans[i].tag)) { keptToast(starred); starred = 0; saveResume(null, null); pendingPlans = null; $('pgt').innerHTML = '<span class="warn">' + FA_NOTE + ' Stopped before burn ' + (i + 1) + ' of ' + plans.length + ' (' + i + ' sent). Nothing more will be sent.</span>'; $('cfNo').textContent = 'Close'; $('cfNo').disabled = false; return; }
      var p = plans[i++], k = i; $('pgt').textContent = 'Burn ' + k + ' of ' + plans.length + ': building ' + p.tag + ', then approve it in XCP Wallet…'; sendOnce(p, k, plans.length).then(function (r) { S.lastTx = r && r.txid; starred += keepFed(p.tag, p); saveResume(title, plans.slice(k)); $('pg').style.width = (100 * k / plans.length) + '%'; $('pgt').textContent = 'Burn ' + k + ' of ' + plans.length + ' sent: ' + p.tag + ' · tx ' + r.txid.slice(0, 10) + '…'; if (plans.length <= 3) toast('⏳ Broadcast: ' + esc(p.label || p.tag) + ' · <a target="_blank" rel="noopener" href="https://mempool.space/tx/' + r.txid + '">' + r.txid.slice(0, 6) + '… mempool ↗</a>' + (/^pet:hatch/.test(p.tag) ? ' · 🥚 your egg' + (p.tag === 'pet:hatch' ? '' : 's') + ' hatch when this confirms (the hatch popup opens then)' : ' · result when confirmed'), 9000); renderLog(world()); if (i < plans.length) setTimeout(step, 1500); else step(); }, function (e) { var raw = e ? (e.message || (e.data && (e.data.message || JSON.stringify(e.data))) || String(e)) : '', eh = e && e.confirmNote ? V2Wallet.confirmNoteHtml(true) : e && e.waitConfirm ? esc(k > 1 ? 'Burn ' + (k - 1) + ' is waiting to confirm. Wait about one block, then press Continue.' : 'An earlier burn of yours is waiting to confirm. Wait about one block, then press Continue.') : V2Wallet.errHtml(e);
        keptToast(starred); starred = 0; saveResume(title, plans.slice(k - 1)); $('pgt').innerHTML = '<span class="warn">Stopped at burn ' + k + ' of ' + plans.length + ' (' + (k - 1) + ' sent): ' + eh + (raw && !e.waitConfirm && !e.walletBusy && !e.stale && String(eh).replace(/<[^>]*>/g, '').indexOf(raw) < 0 ? ' <span class="muted">· wallet/node said: <code>' + esc(raw) + '</code></span>' : '') + '</span>'; $('cfNo').disabled = false; pendingPlans = plans.slice(k - 1); if (!e.reload) { $('cfYes').textContent = e.retry ? (k > 1 ? 'Retry from burn ' + k : 'Retry') : 'Continue from burn ' + k; $('cfYes').disabled = false; }
        /* burn-wait-confirm: the note's Continue = re-check for confirmed coins from this burn; 'Try anyway' = one compose on the unconfirmed change */
        if (e && e.confirmNote) { var nb = $('pgt').querySelector('.bwc-go'), nt = $('pgt').querySelector('.bwc-try');
          if (nb) nb.onclick = function () { $('cfYes').onclick(); };
          if (nt) nt.onclick = function (ev) { ev.preventDefault(); V2Wallet.allowUnconfirmedOnce(); $('cfYes').onclick(); }; } }); })(); };

  // ---------------------------------------------------------------- hatch + community (live buttons)
  /* stale-egg-costs (owner Oct 28 2026): the three egg buttons used to show and burn the ORIGINAL 69 / 690 / 6,900 until the halving UI caught up.
   * Now they say (…) and stay disabled until the replayed world has set the current costs (V.COSTS.era is only set by syncCosts on a real world),
   * and a click burns that current cost (planAmount still re-prices it at the next block). The Electric Shock Box is unchanged. UI only. */
  var EGGS = [['hatchBtn', 'Crack One Open', 'pet:hatch', 'hatch'], ['dozenBtn', 'Crack Pack · 12 eggs', 'pet:hatch12', 'hatch12'], ['caseBtn', 'Yolk Booster Box · 144 eggs', 'pet:hatch144', 'hatch144']];
  function eggCost(k) { var C = V.COSTS; return C && C.era != null && C[k] > 0 ? C[k] : null; } /* reads only: never asks for the world (no replay) */
  function eggButtons() { EGGS.forEach(function (e) { var b = $(e[0]); if (!b) return; var c = eggCost(e[3]), t = e[1] + ' (' + (c == null ? '…' : fmt(c)) + ')'; if (b.textContent !== t) b.textContent = t; if (b.disabled !== (c == null)) b.disabled = c == null; }); }
  EGGS.forEach(function (e) { var b = $(e[0]); if (b) b.onclick = function () { var c = eggCost(e[3]); if (c == null) { eggButtons(); toast('Still loading the current egg price… try again in a moment.'); return; } confirmPlans(e[1], [{ tag: e[2], amount: c }]); }; });
  eggButtons(); setInterval(eggButtons, 1000);
  /* ELECTRIC EGGS (preview): one pet:hatchzap burn = 1,000 eggs with boosted tier odds. The button stays locked until the chain tip reaches the gate block. */
  if ($('zapBtn')) { var zapSync = function () { var g = V.electricGate && V.electricGate(), tip = (S && S.tip) || 0, on = g != null && tip + 1 >= g; $('zapBtn').disabled = !on; var zw = $('zapWhen'); if (zw) zw.textContent = g == null ? 'coming soon' : on ? 'live' : 'from block ' + fmt(g); };
    zapSync(); setInterval(zapSync, 5000); $('zapBtn').onclick = function () { confirmPlans('⚡ Electric Shock Box · 1,000 eggs', [{ tag: 'pet:hatchzap', amount: V.ELECTRIC_COST }]); }; }
  if ($('wizEggBtn') && WIZARD_EGG_ON_SALE) { $('wizEggBtn').textContent = '🧙 Bitcoin Wizard egg (' + fmt(V.WIZ_EGG_COST) + ')'; $('wizEggBtn').onclick = function () { confirmPlans('Bitcoin Wizard egg', [{ tag: 'pet:hatchwiz', amount: V.WIZ_EGG_COST }]); }; }
  if ($('wizSignBtn') && WIZARD_SIGN_CLAIM_ON) $('wizSignBtn').onclick = function () { confirmPlans('"Join us" sign (free claim)', [{ tag: 'pet:sign', amount: V.WIZ_SIGN_MIN }]); };
  $('reload').onclick = function () { render(); toast('Reloaded from the chain'); };
  /* community feed amount (2026-10-15, Jake): three fixed choices 69 / 690 / 6,900 (69 by default) instead of a free amount field; same tag + burn flow */
  document.querySelectorAll('[data-camt]').forEach(function (b) { b.onclick = function () { $('cAmt').value = b.dataset.camt;
    document.querySelectorAll('[data-camt]').forEach(function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)); }); render(); }; });
  document.querySelectorAll('[data-q]').forEach(function (b) { b.onclick = function () { $('cAmt').value = b.dataset.q; render(); }; });
  $('cAmt').oninput = function () { if (R.communityGap && R.communityGap(world())) return; $('cfeedBtn').textContent = 'Feed community (' + fmt(Math.floor(Number(this.value) || 0)) + ')'; };
  $('cfeedBtn').onclick = function () { if (R.communityGap && R.communityGap(world())) return toast('Community feeding opens when pet #' + R.COMMUNITY_NEXT_NO + ' arrives.'); var p = V.communityFeedPlan($('cAmt').value); if (!p.ok) return toast('⚠️ ' + p.error); confirmPlans('Feed the ' + V.COMMUNITY_PET, [{ tag: p.tag, amount: p.amount }]); };
  /* community gear roll (2026-10-15, Jake): pet:c:roll, 690, the community pet gets one random gear piece; offered only once the tip reaches ACTIVATE_CROLL_BLOCK */
  $('crollBtn').onclick = function () { if (R.communityGap && R.communityGap(world())) return toast('Community gear rolls open when pet #' + R.COMMUNITY_NEXT_NO + ' arrives.'); if (!V.crollOn(S.tip)) return toast('Community gear roll switches on at block ' + fmt(V.ACTIVATE_CROLL_BLOCK) + ' (chain tip ' + fmt(S.tip) + ').');
    var pl = V.communityRollPlan(); confirmPlans('Community gear roll: the community pet gets one random gear item', [pl], function () { toast('🎲 Community gear roll submitted. The community pet\'s new piece depends on the block your burn lands in.', 9000); }); };
  $('balRefresh').onclick = render;

  // ---------------------------------------------------------------- battles
  function fighters(w, owner, not) { var oc = {}; if (!not) { (w.fights || []).forEach(function (f) { if (f.status === 'open' && (S.tip || 0) + 1 - f.block <= V.FIGHT_WINDOW) { oc[f.a] = 1; oc[f.b] = 1; } }); myPendingTags().forEach(function (g) { var t = V.parseTag(g); if (t && t.action === 'fight') { oc[t.a] = 1; oc[t.b] = 1; } }); } /* engine: a challenger may not have an open challenge (sent or received) */
    return w.pets.filter(function (p) { return (not ? p.owner !== owner : p.owner === owner) && !p.dead && !p.released && p.stage >= 2 && !p.neglected && !oc[p.id]; }); }
  function opt(p) { return '<option value="' + p.id + '">#' + p.id + ' ' + esc(p.name) + ' (' + spLabel(p.species) + ' ' + p.stageName + ')' + (p.owner !== ME ? ' — ' + esc(p.owner) : '') + '</option>'; }
  /* pending challenges (2026-10-15, Jake): the battles box lists the connected player's open challenges in BOTH directions:
   * sent (still waiting for acceptance) and received (with Accept). Confirmed ones come from the replayed world (w.fights, status 'open');
   * unconfirmed ones come from the node mempool (S.mempool, read-only) + this browser's sent-burn tracker. Display only: nothing here feeds the replay. */
  /* breeding UI (build fix): short address (ranking-board format 6…4) with the full one in title; pet label with tier pill */
  function shortAddr(a) { a = String(a || ''); return '<span class="addr" title="' + esc(a) + '">' + esc(a.length > 14 ? a.slice(0, 6) + '…' + a.slice(-4) : a) + '</span>'; }
  function petLblT(w, id) { var p = w.byId[id]; return petLbl(w, id) + (p ? ' ' + tierPill(p.tier) : ''); }
  function breedSum(w, a, b) { var A = w.byId[a], B = w.byId[b]; return '<div class="bsum small">' + [A, B].map(function (p, i) { return p ? '<div><b>' + (i ? 'Partner' : 'Your pet') + ':</b> ' + esc(p.name) + ' <span class="muted">#' + p.id + '</span> ' + tierPill(p.tier) + (p.owner !== ME ? ' <span class="muted">owner ' + shortAddr(p.owner) + '</span>' : '') + '</div>' : ''; }).join('') + '</div>'; }
  /* breed-picker-fix (2026-10-19): review panel at the TOP of the existing breed confirm (same plans, tag and 690 amount; the wallet is only asked on
   * 'Confirm breed'): both pets with sprite, #, species, rarity pill, Pet Score, owner badge; buttons relabelled Confirm breed / Back. */
  function breedReview(w, a, b) { if (!ME || !$('confirmBox').classList.contains('on')) return; var short = function (x) { x = String(x || ''); return x.length > 12 ? x.slice(0, 4) + '\u2026' + x.slice(-3) : x; };
    var card = function (p, lab) { if (!p) return ''; var sc = window.PetScore && PetScore.of(w, p);
      return '<div class="brv-pet"><span class="brv-sp" data-brv="' + p.id + '"></span><div><b>' + lab + '</b><div class="brv-nm">#' + p.id + ' ' + esc(p.name || '') + '</div><div>' + esc(V.speciesLabel(p.species)) + ' ' + tierPill(p.tier) + ' <span class="brv-sc">⭐ ' + (sc ? sc.score : '–') + '</span></div>' +
        (p.owner === ME ? '<em class="bk-own me">My Pets</em>' : '<em class="bk-own" title="' + esc(p.owner) + '">Other Pets ' + esc(short(p.owner)) + '</em>') + '</div></div>'; };
    $('cfBody').insertAdjacentHTML('afterbegin', '<div class="brv">' + card(w.byId[a], 'Pet 1') + card(w.byId[b], 'Pet 2') + '</div>');
    $('cfBody').querySelectorAll('[data-brv]').forEach(function (s2) { var c = document.createElement('canvas'); c.width = c.height = 32; c.className = 'sprite'; s2.appendChild(c); R.lazy(c, function () { return R.petFrames(w.byId[s2.getAttribute('data-brv')], w); }, true); });
    $('cfYes').textContent = '💞 Confirm breed · sign in XCP Wallet'; $('cfNo').textContent = '← Back'; }
  if (!document.getElementById('brvCss')) { var brs = document.createElement('style'); brs.id = 'brvCss'; brs.textContent = '.brv{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 8px}.brv-pet{display:flex;gap:8px;align-items:center;border:2px solid #4b3f7a;background:#120e22;padding:6px;min-width:0}.brv-pet>div{min-width:0;overflow-wrap:anywhere;font-size:14px}.brv-sp canvas{width:64px;height:64px;image-rendering:pixelated}.brv-nm{font-weight:700}.brv-sc{color:#ffd166;white-space:nowrap}.brv .pill.tier{white-space:nowrap}.brv .bk-own{font-style:normal;font-weight:700;font-size:12px;letter-spacing:.5px;padding:2px 4px;border:1px solid #000;background:#4b3f7a;color:#fff;display:inline-block;margin-top:3px}.brv .bk-own.me{background:#4fd18b;color:#0d1a12}@media (max-width:520px){.brv{grid-template-columns:1fr}}'; document.head.appendChild(brs); }
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
        (acc ? ' · ⏳ Accepted, waiting for confirmation' + txa(acc.tx_hash) : (function (y) { return y ? ' · ' + '<span class="small mr-no">🚫 Can\'t accept: ' + esc(y) + '</span>' : ' <button class="btn ico-flame" data-acc="' + f.id + '">Accept (' + fmt(accNow(w, f.id)) + ')</button>'; })(V.sendBlock && V.sendBlock(w, { tag: 'pet:accept:' + f.id }, tip, { me: ME }))) + '</div>'); });
    unconf.forEach(function (u) { if (u.t.action !== 'fight') return; var A = w.byId[u.t.a], B = w.byId[u.t.b], when = agoLbl(u.x.at);
      if (u.mine) out.push('<div class="txrow pend-out">⏳ <b>Challenged:</b> ' + petLbl(w, u.t.a) + ' vs ' + petLbl(w, u.t.b) + ' · challenge sent, pending confirmation' + (when ? ' · sent ' + when : '') + ' · stake ' + fmt(u.x.amount || V.COSTS.fight) + ' XCPETS · opponent has ' + V.FIGHT_WINDOW + ' blocks to accept once it confirms' + txa(u.x.tx_hash) + '</div>');
      else if (B && B.owner === ME) out.push('<div class="txrow pend-in">⏳ <b>Challenged by:</b> ' + petLbl(w, u.t.a) + ' vs your ' + petLbl(w, u.t.b) + ' · pending confirmation' + (when ? ' · seen ' + when : '') + ' · you can accept once it confirms' + txa(u.x.tx_hash) + '</div>'); });
    /* breed requests (2026-10-15): incoming = a request for one of your pets (Accept burns the mirrored pet:breed:B:A), outgoing = yours, waiting */
    var bwin = V.BREED_WINDOW, bacc = {}; unconf.forEach(function (u) { if (u.t.action === 'breed') bacc[u.t.b + ':' + u.t.a] = u.x; });
    w.breedReqs.forEach(function (r) { if (r.used || (tip && tip - r.block > bwin)) return; var A = w.byId[r.a], B = w.byId[r.b], m = bacc[r.a + ':' + r.b], until = 'until block ' + fmt(r.block + bwin);
      if (r.owner === ME) out.push('<div class="txrow pend-out">💞 <b>Breed request sent:</b> ' + petLblT(w, r.a) + ' × ' + petLblT(w, r.b) + ' · ' + (m ? 'partner accepted, pending confirmation' : 'waiting for the owner of #' + r.b + ' to accept') + ' · sent at block ' + fmt(r.block) + ' · ' + until + txa(r.tx) + '</div>');
      else if (B && B.owner === ME) out.push('<div class="txrow pend-in">💞 <b>Breed request:</b> ' + petLblT(w, r.a) + ' asks your ' + petLblT(w, r.b) + ' · from ' + shortAddr(r.owner) + ' at block ' + fmt(r.block) + ' · ' + until + ' · the egg goes to the requester' +
        (m ? ' · ⏳ Accepted, waiting for confirmation' + txa(m.tx_hash) + (V.sendBlock && V.sendBlock(w, { tag: 'pet:breed:' + r.b + ':' + r.a, accept: true }, tip, { me: ME }) ? ' · 🚫 Can\'t accept: ' + esc(V.sendBlock(w, { tag: 'pet:breed:' + r.b + ':' + r.a, accept: true }, tip, { me: ME })) + ' · this accept will be rejected when it confirms' : '') : V.sendBlock && V.sendBlock(w, { tag: 'pet:breed:' + r.b + ':' + r.a, accept: true }, tip, { me: ME }) ? ' · 🚫 Can\'t accept: ' + esc(V.sendBlock(w, { tag: 'pet:breed:' + r.b + ':' + r.a, accept: true }, tip, { me: ME })) + (function (j) { return j ? ' · your accept at block ' + fmt(j.block) + ' was rejected' + txa(j.tx) : ''; })(V.acceptRejected && V.acceptRejected(w, S.rows, r)) : (function (j) { return j ? ' · Accept rejected: ' + esc(j.msg) + txa(j.tx) : ''; })(V.acceptRejected && V.acceptRejected(w, S.rows, r)) + ' <a class="btn ico-flame" href="#no-tail-motel" data-bmotel="' + r.b + ':' + r.a + '">🏨 Answer at the Gooby’s No-Tail Motel desk</a>') + '</div>'); }); /* tonight bundle: breeding happens only at the motel; this heads-up row links to Gooby's desk (same Accept burn there) */
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
  function notifyFights(w) { if (!ME) return; dataSeen(); var seen = fightSeen(), first = !seen, tip = S.tip || w.tip || 0; seen = seen || {}; var q = [];
    w.fights.forEach(function (f) { if (f.status !== 'done' || seen[f.id]) return; var A = w.byId[f.a], B = w.byId[f.b]; if (!(A && A.owner === ME) && !(B && B.owner === ME) && f.challenger !== ME) return;
      seen[f.id] = 1; if (first && tip - f.acceptBlock > V.FIGHT_WINDOW) return; q.push(f); }); /* first visit: only fights resolved in the last day play */
    try { localStorage.setItem(FKEY, JSON.stringify(seen)); } catch (e) { }
    q.forEach(function (f) { var win = w.byId[f.winner], los = w.byId[f.loser], mineWon = win && win.owner === ME;
      toast('⚔️ Fight ' + f.id + ' result: ' + (mineWon ? 'your ' : '') + esc(win ? win.name : '') + ' #' + f.winner + ' beat ' + (!mineWon ? 'your ' : '') + esc(los ? los.name : '') + ' #' + f.loser +
        (f.spoils ? ' and took ' + esc(f.spoils.label) : ' (no takeable gear)') + ' · #' + f.loser + ' has a black eye until block ' + fmt(f.acceptBlock + V.BLACK_EYE_BLOCKS) + '.' + (window.V2Sponsor && V2Sponsor.state && V2Sponsor.line(V2Sponsor.state, f.acceptBlock) ? ' 🏟️ X Circus Kekimus · ' + esc(V2Sponsor.line(V2Sponsor.state, f.acceptBlock)) + '.' : '') + ' <a href="#" data-replay="' + f.id + '">▶ Replay</a>', 15000);
      var a = $('toasts').lastChild.querySelector('[data-replay]'); if (a) a.onclick = function (e) { e.preventDefault(); playFight(world().fights[f.id - 1]); }; });
    q.forEach(function (f) { queueAnim(function () { playFight(world().fights[f.id - 1], { auto: true }); }, '⚔️ Fight ' + f.id + ' replay'); }); }
  /* breed results (2026-10-15, Jake): a breed between two owners resolves when the partner's owner burns the mirrored tag (pet:breed:B:A within
   * BREED_WINDOW blocks; the egg goes to the requester). Only the sender used to see the animation, right after sending. Now: when an egg whose parent
   * (or the egg itself) is one of your pets appears in the replayed world, BOTH owners get the breeding animation once per browser + a message with Replay.
   * Same first-visit cut-off as fights (only breeds from the last 144 blocks auto-play). Display only. */
  var BKEY = 'xcpets-v2-breeds-seen-' + KEY + '-' + ME;
  function breedSeen() { try { return JSON.parse(localStorage.getItem(BKEY)); } catch (e) { return null; } }
  function seenBreed(id) { var s = breedSeen() || {}; s[id] = 1; try { localStorage.setItem(BKEY, JSON.stringify(s)); } catch (e) { } }
  function replayBreed(kidId) { var w = world(), kid = w.byId[kidId]; if (!kid || !kid.parents) return; var n0 = petIds(); delete n0[kid.id + ':' + (kid.parents || '')]; playBreed(kid.parents[0], kid.parents[1], n0); }
  function notifyBreeds(w) { if (!ME) return; dataSeen(); var seen = breedSeen(), first = !seen, tip = S.tip || w.tip || 0; seen = seen || {}; var q = [];
    w.pets.forEach(function (k) { if (!k.parents || seen[k.id]) return; var A = w.byId[k.parents[0]], B = w.byId[k.parents[1]];
      if (k.owner !== ME && !(A && A.owner === ME) && !(B && B.owner === ME)) return; seen[k.id] = 1; if (first && tip - k.hatchBlock > V.BREED_WINDOW) return; q.push(k); });
    try { localStorage.setItem(BKEY, JSON.stringify(seen)); } catch (e) { }
    q.forEach(function (k) { var A = w.byId[k.parents[0]], B = w.byId[k.parents[1]], nm = function (p, id) { return (p && p.owner === ME ? 'your ' : '') + esc(p ? p.name : 'Pet') + ' #' + id; };
      toast('🥚 Breed: ' + nm(A, k.parents[0]) + ' × ' + nm(B, k.parents[1]) + ' → ' + (k.owner === ME ? 'your ' : '') + 'egg ' + esc(k.name) + ' #' + k.id + (k.hybrid ? ' (hybrid ' + esc(window.V2Rules && V2Rules.hybridLabel ? V2Rules.hybridLabel(k.hybrid.key) : k.hybrid.name) + ')' : '') +
        (k.owner === ME ? '' : ' (owner ' + esc(String(k.owner).slice(0, 8)) + '…)') + ' at block ' + fmt(k.hatchBlock) + '. <a href="#" data-breplay="' + k.id + '">▶ Replay</a>', 15000);
      var a = $('toasts').lastChild.querySelector('[data-breplay]'); if (a) a.onclick = function (e) { e.preventDefault(); replayBreed(k.id); }; });
    q.forEach(function (k) { queueAnim(function () { replayBreed(k.id); }, '🥚 Breed replay: egg #' + k.id); }); if (q.length && window.V2Motel && V2Motel.eggPop) V2Motel.eggPop(w, q[q.length - 1]); /* breed-picker-fix: one-time egg pop (notifyBreeds' seen ids keep it once per pet) */ }
  /* cemetery-animations (owner Oct 30 2026 [pt2341u]): confirmed cemetery results (a zombie rising, a Resurrection roll, a zombie meal, feral, crumble,
   * hunted) play their 8-bit animation ONCE (js/v2-cem-anim.js keeps the seen keys), through the same queue / 'While you were away' hold as fights
   * and breeds, plus a toast with Replay. ?anim=raise|resurrect-win|resurrect-fail|zmeal|feral|crumble previews one any time. Display only. */
  function notifyCem(w) { var CA = window.V2CemAnim; if (!CA) return; if (CA.preview(w, ME)) return; if (!ME) return; dataSeen(); var q = CA.collect(w, ME, S.tip || w.tip || 0);
    q.forEach(function (ev) { toast(esc(CA.caption(ev, w)) + ' <a href="#" data-cemreplay="1">▶ Replay</a>', 15000); var a = $('toasts').lastChild && $('toasts').lastChild.querySelector('[data-cemreplay]');
      if (a) a.onclick = function (e) { e.preventDefault(); CA.play(ev, { w: world() }); };
      queueAnim(function () { CA.play(ev, { w: world() }); }, '🧟 ' + CA.caption(ev, w).replace(/^\S+\s/, '').slice(0, 60)); }); }
  function renderBattles(w) {
    var a = $('fMine').value, b = $('fTheirs').value;
    $('fMine').innerHTML = fighters(w, ME).map(opt).join('') || '<option value="">no eligible pet</option>'; $('fTheirs').innerHTML = fighters(w, ME, true).map(opt).join('');
    if (a) $('fMine').value = a; if (b) $('fTheirs').value = b;
    $('fights').innerHTML = w.fights.slice().reverse().map(function (f) { var A = w.byId[f.a], B = w.byId[f.b];
      return '<div class="txrow">⚔️ fight ' + f.id + ': #' + f.a + ' ' + esc(A.name) + ' vs #' + f.b + ' ' + esc(B.name) + ' · ' + f.status + (f.status === 'open' ? ' (accept by block ' + f.expires + ')' : '') +
        (f.status === 'done' ? ' · winner #' + f.winner + (f.spoils ? ' took ' + esc(f.spoils.label) : '') + ' <button class="q" data-view="' + f.id + '">▶ Replay</button>' : '') +
        (f.status === 'open' && B.owner !== ME ? (M.prod ? ' <span class="muted small">waiting for the owner of #' + f.b + ' to accept</span>' : ' <button class="q" data-npc="' + f.id + '">Rival accepts</button>') : '') + (f.status === 'open' && B.owner === ME ? (function (y) { return y ? ' ' + '<span class="small mr-no">🚫 Can\'t accept: ' + esc(y) + '</span>' : ' <button class="btn ico-flame" data-acc="' + f.id + '">Accept (' + fmt(accNow(w, f.id)) + ')</button>'; })(V.sendBlock && V.sendBlock(w, { tag: 'pet:accept:' + f.id }, S.tip, { me: ME })) : '') + '</div>'; }).join('') || '<p class="muted small">No fights yet.</p>';
    var pb = ME ? pendingBattles(w) : [];
    $('fPending').innerHTML = '<h3 class="sec" data-ico="sword">Your pending challenges &amp; breed requests</h3>' + (pb.join('') || '<p class="muted small">' + (ME ? 'No pending challenges sent or received.' : 'Connect your wallet to see your challenges.') + '</p>');
    $('fPending').querySelectorAll('[data-bmotel]').forEach(function (x) { var row = x.closest('.txrow'); if (row) { row.classList.add('pend-tap'); row.onclick = function (e) { if (e.target.closest('a[href^="http"]')) return; e.preventDefault(); if (window.V2MotelReqs) V2MotelReqs.go(x.dataset.bmotel); }; } });
    $('fPending').querySelectorAll('[data-bracc]').forEach(function (x) { x.onclick = function () { var q = x.dataset.bracc.split(':'); confirmPlans('Accept breed: your #' + q[0] + ' × #' + q[1], [{ tag: 'pet:breed:' + q[0] + ':' + q[1], amount: 690, accept: true }], function () { toast('💞 Breed accept sent. The egg appears and both owners see the breeding once it confirms.', 9000); render(); if (window.V2Motel && V2Motel.celebrate) V2Motel.celebrate(S.lastTx); }); if (ME && $('confirmBox').classList.contains('on')) $('cfBody').insertAdjacentHTML('afterbegin', breedSum(world(), q[0], q[1])); breedReview(world(), q[0], q[1]); }; });
    $('fPending').querySelectorAll('[data-acc]').forEach(function (x) { x.onclick = function () { confirmPlans('Accept fight ' + x.dataset.acc, [{ tag: 'pet:accept:' + x.dataset.acc, amount: (V2Rules.acceptCost ? V2Rules.acceptCost(V2Mock.world(), +(x.dataset.acc)) : 690) }], function () { afterAccept(x.dataset.acc); }); }; });
    $('fights').querySelectorAll('[data-view]').forEach(function (x) { x.onclick = function () { playFight(world().fights[x.dataset.view - 1]); }; });
    $('fights').querySelectorAll('[data-npc]').forEach(function (x) { x.onclick = function () { var f = world().fights[x.dataset.npc - 1]; adv(3); burn(world().byId[f.b].owner, 'pet:accept:' + f.id, 690); save(); render(); playFight(world().fights[f.id - 1]); }; });
    $('fights').querySelectorAll('[data-acc]').forEach(function (x) { x.onclick = function () { confirmPlans('Accept fight ' + x.dataset.acc, [{ tag: 'pet:accept:' + x.dataset.acc, amount: (V2Rules.acceptCost ? V2Rules.acceptCost(V2Mock.world(), +(x.dataset.acc)) : 690) }], function () { afterAccept(x.dataset.acc); }); }; });
    if (window.V2Arena) try { V2Arena.render(w); } catch (e) { console.warn('arena', e); } /* battle-arena (DRAFT 2026-10-19, display only) */
  }
  $('fGo').onclick = function () { var a = $('fMine').value, b = $('fTheirs').value; if (!a || !b) return toast('Pick both pets'); confirmPlans('Challenge #' + b, [{ tag: V.buildTag('fight', { a: a, b: b }), amount: 690 }]); };
  $('fNpc').onclick = function () { var w = world(), my = fighters(w, ME), np = fighters(w, ME, true).filter(function (p) { return !p.fightDays[V.day(S.tip)]; });
    if (!my.length || !np.length) return toast('No eligible pets'); var m = my[S.n % my.length], n = np[S.n % np.length]; burn(n.owner, 'pet:fight:' + n.id + ':' + m.id, 690); save(); render(); toast('⚔️ ' + n.owner + ' challenged #' + m.id); };
  // Animation pop-up (2026-10-14): battle / breeding animations play in a centred modal over a dimmed backdrop; the page never scrolls.
  // The arena element is moved into the modal and put back on close (finish, Skip, Esc, backdrop click); scroll position is restored.
  var animM = { el: null, home: null, y: 0, iv: null, onClose: null }, animQ = [];
  /* keepScroll(y): put the page back where it was after a re-render, instantly (html has scroll-behavior:smooth, which would animate a plain scrollTo) */
  function keepScroll(y) { if (Math.abs(window.scrollY - y) < 1) return; var h = document.documentElement, old = h.style.scrollBehavior; h.style.scrollBehavior = 'auto'; window.scrollTo(0, y); h.style.scrollBehavior = old; }
  /* result animations (fights, breeds) queue up and play one after another, each once (2026-10-15) */
  /* flow-fixes (2026-10-22): results that arrive with the first chain load are HELD for the 'While you were away' sheet (Watch all / Skip all) instead of
   * popping one after another; results that land later play as before. The arena calls V2AnimDone when a fight ends so the queue moves on (it never opens
   * the pop-up, so animClose never advanced it). A queued animation waits while the hatch/gear results are open. */
  var heldA = [], heldR = false, released = false, firstDataT = 0;
  function dataSeen() { if (!firstDataT) firstDataT = Date.now(); }
  function holding() { return !released && document.documentElement.classList.contains('ip-hold') && firstDataT && Date.now() - firstDataT < 8000; }
  function awayPing() { if (window.V2IpChip) try { V2IpChip(); } catch (e) { } }
  window.V2Held = { count: function () { return heldA.length + (heldR ? revealQ.length : 0); },
    list: function () { return (heldR ? revealQ.map(function (r) { return r.kind === 'gear' ? '🎁 ' + r.wins.length + ' new gear piece' + (r.wins.length > 1 ? 's' : '') : '🥚 ' + r.eggs.length + ' egg' + (r.eggs.length > 1 ? 's' : '') + ' hatched'; }) : []).concat(heldA.map(function (a) { return a.label; })); },
    run: function () { released = true; heldR = false; var a = heldA; heldA = []; a.forEach(function (x) { queueAnim(x.fn); }); nextReveal(); awayPing(); },
    skip: function () { released = true; heldR = false; heldA = []; revealQ.length = 0; awayPing(); } };
  function queueAnim(fn, label) { if (holding()) { heldA.push({ fn: fn, label: label || '▶ Replay' }); awayPing(); return; } animQ.push(fn); if (!animM.el && animQ.length === 1) setTimeout(nextAnim, 600); }
  function nextAnim() { if (animM.el || !animQ.length) return; if (window.V2CemAnim && V2CemAnim.busy()) return; /* a cemetery animation is on screen; it calls V2AnimDone when it ends */ if ($('packBox').classList.contains('on')) return setTimeout(nextAnim, 1000); animQ.shift()(); }
  window.V2AnimDone = function () { if (!animM.el && animQ.length) setTimeout(nextAnim, 500); };
  function animOpen(el, iv, onClose) { animClose(true); var box = $('animBox'); if (!box) { box = document.createElement('div'); box.id = 'animBox'; box.className = 'reveal anim'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
      box.innerHTML = '<div class="box wide"><button type="button" class="q" id="animClose" style="float:right" aria-label="Close">&times;</button><div id="animSlot"></div></div>'; document.body.appendChild(box);
      box.addEventListener('click', function (e) { if (e.target === box) animClose(); }); $('animClose').onclick = function () { animClose(); }; }
    /* smooth-perf scroll fix (owner approved 2026-10-19): the pop-up never moves the page. The arena's spot in the page is held by a placeholder of the
     * same size while it is in the modal, so nothing below it shifts, and there is no window.scrollTo any more (with html scroll-behavior:smooth those
     * calls became long animated scrolls that dragged the page back when queued animations opened/closed). The user's scroll position is kept. */
    animM.y = window.scrollY; animM.el = el; animM.home = document.createElement('div'); animM.home.className = 'animhome'; animM.home.setAttribute('aria-hidden', 'true');
    var r = el.getBoundingClientRect(), cs = window.getComputedStyle(el); animM.home.style.cssText = 'height:' + r.height + 'px;margin:' + cs.marginTop + ' ' + cs.marginRight + ' ' + cs.marginBottom + ' ' + cs.marginLeft + ';display:' + (cs.display === 'none' ? 'none' : (cs.display === 'inline' ? 'inline-block' : cs.display)) + (r.width ? ';width:' + r.width + 'px;max-width:100%' : '') + ';visibility:hidden;pointer-events:none';
    el.parentNode.insertBefore(animM.home, el); $('animSlot').appendChild(el); animM.onClose = onClose || null;
    box.classList.add('on'); }
  function animClose(silent) { var box = $('animBox'); if (!animM.el) return; var y = animM.y, cb = animM.onClose; animM.home.parentNode.insertBefore(animM.el, animM.home); animM.home.remove(); animM.el = null; animM.onClose = null;
    if (box) box.classList.remove('on'); if (!silent && cb) cb(); if (animQ.length) setTimeout(nextAnim, 500); }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && animM.el) animClose(); });
  window.V2AnimClose = animClose; window.V2PlayFight = function (f, o) { playFight(f, o); }; window.V2ReplayBreed = function (kidId) { replayBreed(kidId); }; /* smooth-perf: breed replay hook for tests (same as a toast's ▶ Replay) */
  function playFight(f, o) {
    if (!f || !f.turns) return; if (window.V2ArenaScene && V2ArenaScene.sequence && document.getElementById('arScene')) return V2ArenaScene.sequence(f, o); /* battle-arena: fights play in the X Circus Kekimus scene, no pop-up */ var w = world(), c = $('arena'), ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
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
      ctx.fillStyle = '#e8f5ec'; ctx.font = '8px "Press Start 2P", monospace'; ctx.fillText(msg, 12, 158);
      if (!done && ph === 1) { hpA = cur.hpA; hpB = cur.hpB; msg = 'T' + cur.n + ' #' + (cur.by === 'a' ? A.id : B.id) + ' ' + cur.weapon + (cur.dodge ? ' MISS' : ' -' + cur.dmg + (cur.crit ? '!' : '')); ctx.fillStyle = cur.crit ? '#ffc93c' : '#ff5a5a'; ctx.font = '16px "Press Start 2P", monospace'; ctx.fillText(cur.dodge ? 'MISS' : '-' + cur.dmg, cur.by === 'a' ? 250 : 60, 40); }
      if (!done && ph === 3) t++;
      if (done) { msg = 'WINNER #' + f.winner + (sp ? ' +' + sp : ''); if (!playFight.endAt) playFight.endAt = k + 12; if (k >= playFight.endAt) { clearInterval(playFight.iv); playFight.endAt = 0; animClose(); } } }, 220);
    playFight.endAt = 0; animOpen(c.parentNode, playFight.iv, function () { clearInterval(playFight.iv); playFight.endAt = 0; });
  }
  if (M.prod) ['fNpc'].forEach(function (id) { if ($(id)) $(id).style.display = 'none'; }); /* NPC simulation buttons: nothing to simulate on the live chain */
  // ---------------------------------------------------------------- breeding
  function renderBreed(w) {
    var a = $('bA').value, b = $('bB').value, L = V.breedPicker(w, ME, S.tip, a, pendingBreedIds());
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
    $('bReqs').innerHTML = w.breedReqs.filter(function (r) { return !r.used && S.tip - r.block <= V.BREED_WINDOW; }).map(function (r) { return '<div data-btx="' + esc(r.tx || '') + '">' + petLblT(w, r.a) + ' → ' + petLblT(w, r.b) + ' (until block ' + (r.block + V.BREED_WINDOW) + ') ' + ((w.byId[r.b] || {}).owner !== ME ? '<span class="muted">waiting for the owner of #' + r.b + ' to accept</span>' : (V.sendBlock && V.sendBlock(w, { tag: 'pet:breed:' + r.b + ':' + r.a, accept: true }, S.tip, { me: ME }) ? '<span class="muted">can\'t accept: ' + esc(V.sendBlock(w, { tag: 'pet:breed:' + r.b + ':' + r.a, accept: true }, S.tip, { me: ME })) + '</span>' : '<span class="muted">accept it in Your pending challenges above</span>')) + '</div>'; }).join('') + unconfBreeds(w) || '<div class="muted">none</div>';
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
    confirmPlans('Breed #' + a + ' × #' + b, [{ tag: V.buildTag('breed', { a: a, b: b }), amount: 690 }], function () { var y = window.scrollY; if (window.V2Motel) { V2Motel.checkedIn(a, b); if (V2Motel.celebrate) V2Motel.celebrate(S.lastTx); } else { $('bA').value = ''; $('bB').value = ''; } /* no-tail-motel: keep the pair so the door can open in place */ render(); keepScroll(y); playBreed(a, b, n0); var w2 = world(), A2 = w2.byId[a], B2 = w2.byId[b]; toast(A2 && B2 && A2.owner === B2.owner ? '⏳ Breeding #' + a + ' × #' + b + ': your egg appears once this confirms.' : '💞 Breed request sent: #' + a + ' → #' + b + '. The partner\'s owner can accept it once it confirms.', 9000); }); if (ME && $('confirmBox').classList.contains('on')) { $('cfBody').insertAdjacentHTML('afterbegin', breedSum(world(), a, b)); breedReview(world(), a, b); } };
  function petIds() { var o = {}; world().pets.forEach(function (p) { o[p.id + ':' + (p.parents || '')] = 1; }); return o; } // pets before the breed
  /** playBreed: the battle arena's approach for a breed. Both parents hop together, hearts, the egg appears, then the result. Display only. Skippable. */
  /** feedEgg(id): the normal feed flow for a freshly bred egg (existing confirm dialog, default 69). */
  function feedEgg(id) { if (animM.el) animClose(true); var y = window.scrollY; confirmPlans('Feed #' + id, [{ tag: 'pet:feed:' + id, amount: 69, petId: id, label: 'Feed #' + id }], function () { render(); keepScroll(y); toast('🍼 Fed egg #' + id); }); }
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
    w.fights.forEach(function (f) { if (f.status !== 'open' || (tip && tip - f.block > V.FIGHT_WINDOW)) return; var A = w.byId[f.a], B = w.byId[f.b]; if (!B || B.owner !== ME) return; if (V.sendBlock && V.sendBlock(w, { tag: 'pet:accept:' + f.id }, tip, { me: ME })) return; /* wasted-burn guard: no pop-up for a challenge that can't be accepted */
      var k = 'f' + f.id; if (seen[k] || have[k]) return; IRQ.push({ k: k, sel: '[data-acc="' + f.id + '"]', kind: 'fight', a: f.a, b: f.b, title: '📥 Battle challenge', who: f.challenger || (A && A.owner), pets: petLblT(w, f.a) + ' vs your ' + petLblT(w, f.b), cost: accNow(w, f.id), until: f.block + V.FIGHT_WINDOW, label: 'Accept (' + fmt(accNow(w, f.id)) + ')' }); });
    w.breedReqs.forEach(function (r) { if (r.used || (tip && tip - r.block > V.BREED_WINDOW)) return; var B = w.byId[r.b]; if (!B || B.owner !== ME || r.owner === ME) return; if (V.sendBlock && V.sendBlock(w, { tag: 'pet:breed:' + r.b + ':' + r.a, accept: true }, tip, { me: ME })) return; /* breed-accept-guard: no pop-up for a request that can't be accepted */
      var k = 'b' + (r.tx || r.a + ':' + r.b); if (seen[k] || have[k]) return; IRQ.push({ k: k, sel: '[data-bracc="' + r.b + ':' + r.a + '"]', kind: 'breed', a: r.a, b: r.b, title: '💞 Breed request', who: r.owner, pets: petLblT(w, r.a) + ' asks your ' + petLblT(w, r.b) + ' · the egg goes to the requester', cost: V.COSTS.breed, until: r.block + V.BREED_WINDOW, label: 'Accept breed (' + fmt(V.COSTS.breed) + ')' }); });
    irqNext(); }
  /* side-by-side decision info (theirs | yours). Fight numbers follow V2Rules.simulateFight: HP 40+2·vigor+grit+6·stage, gear bonus Σ(1+2·tier),
   * crit 5+⌊luck/4⌋ %, dodge ⌊zoom/5⌋ % (defender's zoom), first strike zoom + d10. Breed numbers follow breedChild/breed. No win % is shown. */
  function irqCompare(w, x) { var A = w.byId[x.a], B = w.byId[x.b]; if (!A || !B) return ''; var K = ['vigor', 'spark', 'grit', 'zoom', 'luck'];
    var pw = function (p) { return K.reduce(function (t, k) { return t + (p.stats[k] || 0); }, 0); };
    var gear = function (p) { return V.wornOf(w, p.id).map(function (g) { var it = (V.GEAR_BY_ID || {})[g.item]; return { slot: g.slot, label: it ? it.label : (g.label || g.item), tier: it ? it.tier : (g.legendary ? 3 : (g.tier || 0)) }; }); };
    var best = function (p) { return K.reduce(function (m, k) { return p.stats[k] > p.stats[m] ? k : m; }, K[0]); };
    var hp = function (p) { return 40 + p.stats.vigor * 2 + p.stats.grit + p.stage * 6; }, gp = function (p) { return gear(p).reduce(function (t, g) { return t + 1 + g.tier * 2; }, 0); };
    function col(p, o, who) { var g = gear(p), grip = g.filter(function (q) { return q.slot === 'hand'; })[0], h = '<div class="irqcol' + (window.V2FightTag && V2FightTag.mine(p) ? ' fme' : '') + '"><div class="small muted">' + (window.V2FightTag && x.kind === 'fight' ? V2FightTag.html(p, o) : who) + '</div><canvas width="32" height="32" class="sprite" data-irqp="' + p.id + '"></canvas><div><b>' + esc(p.name) + '</b> <span class="muted">#' + p.id + '</span></div><div class="chips">' + tierPill(p.tier) + '<span class="chip">' + esc(spLabel(p.species)) + '</span><span class="chip stg">' + p.stageName + '</span><span class="chip pow"' + ptA(p) + '>⚡ ' + pw(p) + '</span></div>' +
        '<table class="small irqst">' + K.map(function (k) { return '<tr><td>' + k + '</td><td><b>' + p.stats[k] + '</b>' + (x.kind === 'breed' && k === best(p) ? ' ★' : '') + '</td></tr>'; }).join('') + '</table>';
      if (x.kind === 'fight') { h += '<div class="small"><span' + (window.V2PowerTip ? V2PowerTip.attr(V2PowerTip.hp(p)) : '') + '>HP <b>' + hp(p) + '</b></span> · <span' + (window.V2PowerTip ? V2PowerTip.attr(V2PowerTip.gear(g)) : '') + '>gear dmg +<b>' + gp(p) + '</b></span> · crit <b>' + (5 + Math.floor(p.stats.luck / 4)) + '%</b> · dodge <b>' + Math.floor(p.stats.zoom / 5) + '%</b></div><div class="small">Grip: <b>' + esc(grip ? grip.label : 'bare paws') + '</b></div>' +
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
    var btn = (document.querySelector('#motelReqs ' + x.sel) || document.querySelector('#fPending ' + x.sel));
    box.innerHTML = '<div class="box"><h2 id="irqTitle" class="sec" data-ico="sword">' + esc(x.title) + '</h2><p class="small">From ' + shortAddr(x.who) + '</p><p>' + x.pets + '</p><p class="small">Cost to accept: <b>' + fmt(x.cost) + ' <span class="asset">XCPETS</span></b> · expires at block <b>' + fmt(x.until) + '</b>' + (IRQ.length ? ' · ' + IRQ.length + ' more waiting' : '') + '</p>' + irqCompare(world(), x) +
      '<div class="row" style="justify-content:center">' + (btn ? '<button class="btn ico-flame" data-irq="acc">' + esc(x.label) + '</button>' : '') + '<button class="q" data-irq="view">View</button><button class="q" data-irq="later">Later</button></div></div>';
    box.classList.add('on'); box.querySelectorAll('canvas[data-irqp]').forEach(function (c) { var p = world().byId[c.dataset.irqp]; if (p) try { paint(c, petFrames(p, world())[0]); } catch (e) { } });
    box.querySelectorAll('[data-irq]').forEach(function (b) { b.onclick = function () { var a = b.dataset.irq; box.classList.remove('on'); irqCur = null; var t = (document.querySelector('#motelReqs ' + x.sel) || document.querySelector('#fPending ' + x.sel));
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
      ctx.fillStyle = '#e8f5ec'; ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillText(t < 14 ? 'BREED: #' + A.id + ' x #' + B.id : t < 30 ? '<3 <3 <3' : kid ? (kid.hybrid ? 'HYBRID! ' + (window.V2Rules && V2Rules.hybridLabel ? V2Rules.hybridLabel(kid.hybrid.key) : kid.hybrid.name).toUpperCase() : 'EGG #' + kid.id + '!') : 'REQUEST SENT', 12, 158);
      if (t >= 40 && kid && !$('bFeedEgg')) { $('breedMsg').innerHTML = (kid.hybrid ? '🧬 <span class="chip hyb">HYBRID</span> <b>' + esc((window.V2Rules && V2Rules.hybridLabel ? V2Rules.hybridLabel(kid.hybrid.key) : kid.hybrid.name)) + '</b> (' + (kid.hybrid.roots || [kid.hybrid.a, kid.hybrid.b]).map(function (r) { return esc(V.speciesLabel(r)); }).join(' × ') + ') · ' : '') + '🥚 <b>#' + kid.id + ' ' + esc(kid.name) + '</b> · ' + TL[kid.tier] + ' ' + esc(spLabel(kid.species)) + ' · starts as an Egg · parents #' + A.id + ' × #' + B.id + '<br><span class="hatchnote">Your new egg #' + kid.id + ' is in My Pets. Feed it ' + fmt(kid.nextMeal > 0 ? kid.nextMeal : V.COSTS.feedMin) + ' XCPETS to hatch.</span> <button type="button" class="q" id="bFeedEgg" data-egg="' + kid.id + '">🍼 Feed to hatch</button>'; $('bFeedEgg').onclick = function () { feedEgg(kid.id); }; } }
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
    var pl = V2Wallet.tracker.list(); if (V2Wallet.pollPending && pl.some(function (t) { return t.status !== 'confirmed'; })) V2Wallet.pollPending().then(function (n) { if (n) try { renderLog(world()); } catch (e) { } }); /* post-buy-fixes */
    var pend = pl.filter(function (t) { return t.status !== 'confirmed' && !S.rows.some(function (x) { return x.tx_hash === t.txid; }); }).reverse().map(function (t) { var dex = t.kind === 'dex' || /^(order|cancel|issuance|send|mpma)$/.test(t.tag || ''), act = t.act || { issuance: 'token', mpma: 'send' }[t.tag] || t.tag; var what = dex ? (t.give && t.give.qty ? 'gives ' + fmt(t.give.qty) + ' ' + esc(t.give.asset) : esc({ token: 'token issue', cancel: 'cancel', send: 'token send', order: 'order' }[act] || act || 'order')) : t.amount != null ? fmt(t.amount) + ' XCPETS' : '';
      return '<div class="small">⏳ ' + esc(t.label || t.tag) + (what ? ' · ' + what : '') + ' · <a target="_blank" rel="noopener" href="https://mempool.space/tx/' + t.txid + '">' + t.txid.slice(0, 8) + '…</a> · waiting for a block</div>'; }).join('');
    $('pending').innerHTML = pend + (w.log.filter(function (l) { return mineTx[l.tx]; }).slice(-8).reverse().map(row).join('') || (pend ? '' : 'None yet.'));
    /* bigfix 2026-10-20: say how many lines are shown and let players load older ones (200 at a time) */
    var LN = renderLog.n = renderLog.n || 200, tot = w.log.length, sh = Math.min(LN, tot);
    $('log').innerHTML = (tot ? '<div class="small muted">Latest ' + fmt(sh) + ' of ' + fmt(tot) + ' burns, newest first</div>' : '') + w.log.slice(-sh).reverse().map(row).join('') +
      (tot > sh ? '<button type="button" class="q" id="logMore">Show older (' + fmt(tot - sh) + ' left)</button>' : '');
    if ($('logMore')) $('logMore').onclick = function (e) { e.preventDefault(); renderLog.n = LN + 200; renderLog(world()); };
  }
  // ---------------------------------------------------------------- other controls
  $('dcYes').onclick = function () { var ids = dropKept(mine(world()).filter(function (p) { return p.tier === 0 && !p.dead; }).map(function (p) { return p.id; })); close('delCommonsBox'); if (!ids.length) return toast('No Commons to hide.'); discardIds(ids); };
  $('dcNo').onclick = function () { close('delCommonsBox'); };
  $('itemClose').onclick = function () { close('itemBox'); };
  /* hatch-exit (2026-10-21, display only): '🥚 Hatch more' and '✕ Close' under every hatch / gear result. Both keep every pet (same as Later: nothing discarded),
   * still show any queued result next, and never jump to the inventory. Hatch more scrolls to the hatch buttons and highlights the size you hatched last
   * (it does NOT open a burn confirm); Close puts you back where you were when the results opened. */
  function packExit(then) { close('packBox'); rev = null; render(); setTimeout(nextReveal, 250);
    setTimeout(function () { if ($('packBox').classList.contains('on')) return; var y = packY; packY = null; then(y); }, 300); }
  if ($('packX')) $('packX').onclick = function () { packExit(function (y) { if (y != null) window.scrollTo({ top: y, behavior: 'auto' }); }); };
  if ($('packHatchMore')) $('packHatchMore').onclick = function () { packExit(function () { var hp = $('hatchPanel'); if (!hp) return; try { hp.scrollIntoView({ behavior: 'auto', block: 'start' }); } catch (e) { }
    var b = $(lastHatchN >= 1000 ? 'zapBtn' : lastHatchN >= 144 ? 'caseBtn' : lastHatchN >= 12 ? 'dozenBtn' : 'hatchBtn'); if (b) { try { b.focus({ preventScroll: true }); } catch (e) { } b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash'); setTimeout(function () { b.classList.remove('flash'); }, 2400); } }); };
  $('packClose').onclick = closeReveal; $('packSkip').onclick = function () { if (!revealQ.length) packY = null; close('packBox'); rev = null; render(); setTimeout(nextReveal, 250); };
  /* egg-review-sort 2026-10-24: the review's 'Discard all Commons' button is removed (owner); Rarity: low to high puts Commons first. My Pets' own Discard all Commons (delCommonsBox) is unchanged. */
  $('packDiscard').onclick = function () { if (!rev || rev.kind !== 'eggs') return; var ids = Object.keys(rev.sel).map(Number); if (!ids.length) return toast('Tap a pet to select it first.');
    var dw = world(), gd = ids.filter(function (id) { var p = dw.byId[id]; return p && !isKept(id) && dudGuard(dw, p).length; });
    revHide(ids, 'Hide ' + ids.length.toLocaleString('en-US') + ' selected pet' + (ids.length > 1 ? 's' : '') + '?' + (gd.length ? '\n\n🛡️ ' + gd.length + ' of them ' + (gd.length > 1 ? 'are' : 'is') + ' protected (Legendary, Mythic or wearing gear): ' + idList(gd) + '.' : '')); };
  $('txClose').onclick = function () { close('txBox'); };
  $('waitCancel').onclick = function () { close('waitOverlay'); };
  $('introSkip').onclick = function () { close('intro'); };
  $('replayIntro').onclick = function (e) { e.preventDefault(); var iw = world(), gp = R.communityGap && R.communityGap(iw), fr = gp ? R.comingSoonFrames() : commAnim && commAnim.fr ? commAnim.fr : R.communityFrames(iw); if (fr) R.animate($('introCv'), fr); /* current community pet (Nakamoto before The Return: no Wizard spoiler) */ $('introText').textContent = 'Welcome to XCPETS v2'; open('intro'); setTimeout(function () { close('intro'); }, 2500); };
  $('wdisconnect').onclick = function () { toast('To view any address read-only, use 👀 View pets by address (or open play.html?addr=YOUR_ADDRESS).'); };
  $('gWallet').onclick = function () { var b = $('gWallet'); if (!window.xcpwallet) { toast('XCP Wallet not found. Install the XCP Wallet Chrome extension, then refresh this page to connect.', 9000); return; }
    b.disabled = true; /* wallet-one-window: share V2Wallet's single connect (no second wallet window) */ (window.V2Wallet && V2Wallet.connect ? V2Wallet.connect().then(function (a) { return { accounts: [a] }; }) : window.xcpwallet.request({ method: 'xcp_requestAccounts' })).then(function (r) { var a = (r && r.accounts && r.accounts[0]) || (Array.isArray(r) ? r[0] : null); b.disabled = false;
      if (!a) return toast('XCP Wallet returned no address.'); try { localStorage.setItem('xcpets-v2-me', a); localStorage.setItem('xcpets-xcpwallet-address', a); } catch (e) { }
      if (a !== ME) location.reload(); else toast('✓ XCP Wallet connected'); }, function (e) { b.disabled = false; toast(e && e.code === 4001 ? 'You cancelled in the wallet.' : 'XCP Wallet connect failed: ' + ((e && e.message) || 'try again')); }); };
  function showTx(tx) { var w = world(), l = w.log.filter(function (x) { return x.tx === tx; })[0], r = S.rows.filter(function (x) { return x.tx_hash === tx; })[0]; if (!l) return;
    $('txInfo').innerHTML = '<p class="small"><b>' + esc(l.kind) + '</b> · ' + esc(l.msg) + '</p><table class="small"><tr><td>block</td><td>' + l.block + '</td></tr><tr><td>tx</td><td><code>' + esc(tx) + '</code></td></tr>' + (r ? '<tr><td>from</td><td>' + esc(r.source) + '</td></tr><tr><td>tag</td><td><code>' + esc(r.tag) + '</code></td></tr><tr><td>amount</td><td>' + fmt(r.amount) + ' XCPETS</td></tr>' : '') + '</table><p class="small muted">Burn sent from your XCP Wallet.</p>'; open('txBox'); }
  ['pending', 'log'].forEach(function (id) { $(id).onclick = function (e) { var a = e.target.closest('a[data-tx]'); if (!a) return; e.preventDefault(); showTx(a.dataset.tx); }; });
  function route() { if (actRoute()) return; var m = /^#pet-(\d+)$/.exec(location.hash); if (m && world().byId[m[1]]) { detailId = Number(m[1]); detail(world().byId[detailId]); }
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
  window.V2UI = { pickIds: pickIds, starIds: starIds, keptIds: keptIds, isKept: isKept, toggleKeep: toggleKeep, feedAllPaused: FEED_ALL_PAUSED, feedQueue: feedQ, feedSelQueue: feedSelQ, lairOn: function () { var on = lairOn(); if (!on) lairStale = true; return on; }, sendWhy: sendWhy, myPendingTags: myPendingTags, pendingBreedIds: pendingBreedIds, viewOnly: viewOnly, viewBlock: viewBlock, autoEquip: autoEquipIsOn, aeToggleHtml: aeToggleHtml, bindAeTogs: bindAeTogs, S: function () { return S; }, ME: ME, world: world, render: render, toast: toast, confirmPlans: confirmPlans, breedSum: breedSum, breedReview: breedReview, save: save, selUi: selUi, mine: mine, fighters: fighters, afterAccept: afterAccept, detail: function (id) { detailId = id; detail(world().byId[id]); }, petList: function (w) { var all = mine(w); return petList(all.filter(function (p) { return !p.dead; }), all.filter(function (p) { return p.dead; })); }, cem: function () { return cem; }, playFight: playFight, cardFor: function (p, w) { if (!renderPets.mk) return null; var d = renderPets.mk(p); R.lazy(d.querySelector('canvas'), function () { return petFrames(p, w || world()); }); return d; }, statBars: statBars, goPet: goPet, feed: function (id) { if (viewBlock()) return; var p = world().byId[id]; if (!ME || !p || p.owner !== ME || p.dead || p.released) return toast('Only the owner of a living pet can do that. Connect the wallet that owns #' + id + '.'); confirmPlans('Feed #' + id, V.feedQueue(world(), ME, [id])); } };
  render(); route();
  /* new confirmed burns (e.g. your roll result) every 60 s. smooth-perf (2026-10-19): skipped while the tab is hidden (no background API calls or
   * re-renders); coming back to the tab after a missed poll reads the chain once right away. An unchanged chain keeps the same world (v2-chain.js). */
  var lastPoll = Date.now(); function poll() { lastPoll = Date.now(); M.refresh(render); }
  setInterval(function () { if (document.hidden) return; poll(); }, 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && Date.now() - lastPoll > 60000) poll(); });
  window.__demo = { pickIds: pickIds, starIds: starIds, queueAnim: queueAnim, S: function () { return S; }, world: world, render: render, toggle: toggle, detail: function (id) { detailId = id; detail(world().byId[id]); }, playFight: playFight, discardIds: discardIds, mine: mine, isKept: isKept, keptIds: keptIds, toggleKeep: toggleKeep, idList: idList, selUi: selUi, confirmPlans: confirmPlans, feedIds: function (title, ids) { feedAsync(title, ids, true); }, hiddenIds: hiddenIds, openPile: openPile, feedQueueList: function (w, ids) { return feedSelQ(w, ME, ids); } /* list burns only (pet:feed/fl/fm), never pet:fa */ };
})();
