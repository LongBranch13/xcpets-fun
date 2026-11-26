/* XCPETS play page UI (live game): reads real XCPETS burns via js/v2-chain.js; every burn is signed by the player in XCP Wallet. */
(function () {
  function ZB(p) { return !!(p && p.zombie && !p.zombie.end); } /* CEMETERY LOOP: a risen zombie (an ended record means dust or resurrected) */
  /* CEMETERY LOOP (owner Oct 29 2026 "I'd see them there and feed them there"): a zombie is fed from its own My Pets card (and its detail panel).
   * A zombie meal is the cemetery's pet:zfeed burn: the zombie meal cost (V.cemCost 'zmeal', halving-aware, no other boost) plus one of your living
   * pets that it eats. Same confirm sheet and send guard as every other burn. Not part of Feed all: Feed all never spends a pet. */
  var zMealsMemo = null, zHidRev = 0;
  function zMeals(w, me, b) { if (zMealsMemo && zMealsMemo.w === w && zMealsMemo.me === me && zMealsMemo.b === b && zMealsMemo.d === zHidRev) return zMealsMemo.L;
    /* offer-discards-only-1105: when the cemetery token/discard gate is on, only Discarded pets (browser Discard pile) can be offered/eaten.
     * Discard is not on chain; the picker enforces it. Tied pets are also refused by cemOfferWhy under the same gate. */
    var discOnly = !!(V.cemTokenOfferOn && V.cemTokenOfferOn(b)), H0 = discOnly ? zDiscarded(w) : null;
    var L = !V.cemOfferWhy ? [] : (w.pets || []).filter(function (a) { return V2Own.isLiving(a, me, { zombies: false }) && !V.cemOfferWhy(w, a, me, b) && (!discOnly || H0[a.id]); })
      .sort(function (a, c) { return (a.tier | 0) - (c.tier | 0) || (a.stage | 0) - (c.stage | 0) || a.id - c.id; }); zMealsMemo = { w: w, me: me, b: b, d: zHidRev, L: L }; return L; }
  /* zombie-feed-pets (owner Oct 30 2026 "I fed the zombie but it was xcpets instead of other pets I dont want"): the meal is a PICK, never a default.
   * Nothing is pre-selected (the old dropdown silently pre-picked the weakest pet), starred pets and pets already in an unconfirmed zombie meal are
   * left out, you tick any number of unwanted pets, and the button names the pets plus the fee. One pet:zfeed burn eats every listed pet for one
   * fee (rules unchanged: cemHandle zfeed), so the picks are packed into as few 34-byte tags as fit. A pending meal shows on the card. UI only. */
  function zPendMeals(z) { var o = []; myPendingTags().forEach(function (tag) { var t = zParse(tag); if (t && t.action === 'zfeed' && +t.zombie === +z) (t.ids || []).forEach(function (id) { o.push(+id); }); }); return o; }
  function zAllPend() { var o = []; myPendingTags().forEach(function (tag) { var t = zParse(tag); if (t && t.action === 'zfeed') (t.ids || []).forEach(function (id) { o.push(+id); }); }); return o; }
  /* Owner Oct 30 2026 6:39 PM CT "I want to use discarded pets": the picker lists your DISCARDED pets first (the free My Pets Discard, hidden in
   * this browser, plus the on-chain feed-all skip list pet:sk), with one "Select all discarded" tick. Discard is not a rule state, so pet:zfeed already
   * accepts them (cemOfferWhy never looks at it). Other living pets sit in a closed "not discarded" list. Starred pets are never listed.
   * Packing: one burn = one meal fee and eats every pet it names. Each burn uses whichever fits more pets in 34 bytes: the id list
   * (pet:zfeed:Z:A.B.C) or the range mask (pet:zfm:Z:START:MASK, 5 ids per mask character, rules parse it since the cemetery loop shipped). */
  function zB32(n) { return n.toString(32).toUpperCase(); }
  /* CEMETERY RUNS (owner standing rule Oct 31 2026: as few burns as technically possible): from ACTIVATE_CEM_RUNS_BLOCK the picker also tries
   * the run form (pet:zr / pet:rr, places in your pet list, V.cemRunsPlan): never more burns than the list form, usually 1 for any pick, and
   * priced PER PET (owner Oct 31 2026: each pet costs its one-by-one fee; V.cemRunsCost). Buttons and the confirm sum the plan amounts. */
  function zSum(L) { return L.reduce(function (a, q) { return a + (q.amount || 0); }, 0); }
  function zParse(tag) { var t = V.parseTag ? V.parseTag(tag) : null; if (t && t.action === 'cemr' && V.cemRunsResolve) { var w = world(); t = w ? V.cemRunsResolve(w, ME, t, (S.tip || 0) + 1) : null; } return t; }
  function zFewest(a, r, w, b) { var pp = function (q) { return V.cemPetAmount ? V.cemPetAmount(w, q, b) : q; }; return (r && r.length && r.length <= a.length ? r : a).map(pp); } /* fewest burns; from the runs gate every pet burn is priced per pet (V.cemPetAmount), so the form never changes the total */
  function zFeedPlans(w, z, ids, b) { return zFewest(zFeedPlansList(w, z, ids, b), V.cemRunsPlan ? V.cemRunsPlan(w, 'zfeed', z, ids, ME, b) : null, w, b); }
  function zFeedPlansList(w, z, ids, b) { var s = ids.slice().sort(function (a, c) { return a - c; }).filter(function (x, i, A) { return !i || A[i - 1] !== x; }), out = [], i = 0, cost = V.cemCost(w, 'zmeal', b);
    while (i < s.length) {
      var lst = [], k = i; while (k < s.length) { var t = 'pet:zfeed:' + z + ':' + lst.concat([s[k]]).map(zB32).join('.'); if (t.length > 34) break; lst.push(s[k]); k++; }
      var st = s[i], room = 34 - ('pet:zfm:' + z + ':' + st + ':').length, span = Math.max(0, room) * 5, msk = [], m = i; while (m < s.length && s[m] < st + span) { msk.push(s[m]); m++; }
      var tag, eat; if (msk.length > lst.length) { var ch = []; msk.forEach(function (id) { var o = id - st, c = Math.floor(o / 5); while (ch.length <= c) ch.push(0); ch[c] |= 1 << (o % 5); });
        tag = 'pet:zfm:' + z + ':' + st + ':' + ch.map(zB32).join(''); eat = msk; i = m; } else { tag = 'pet:zfeed:' + z + ':' + lst.map(zB32).join('.'); eat = lst; i = k; }
      out.push({ tag: tag, amount: cost, petId: z, label: 'zmeal', zEat: eat }); }
    return out; }
  function zBtnText(w, z, ids, b) { var cost = V.cemCost(w, 'zmeal', b); if (!ids.length) return '🍖 Tick a discarded pet to feed it';
    var L = zFeedPlans(w, z, ids, b), n = L.length, pp = !!(V.cemRunsOn && V.cemRunsOn(b)), one = ids.length === 1 ? '1 discarded pet' : fmt(ids.length) + ' pets';
    var mult = pp && ids.length > 1 ? fmt(ids.length) + ' times ' + fmt(cost) + ' = ' + fmt(zSum(L)) : fmt(zSum(L));
    return '🍖 Feed ' + one + ' · ' + n + ' burn' + (n > 1 ? 's' : '') + ' · ' + mult + ' XCPETS'; }
  function zDiscarded(w) { var h = {}; hiddenIds().forEach(function (id) { h[+id] = 1; }); /* Nov 25 2026: on-chain discards are in the pile too (the rules feed zombies ONLY those) */ (w.pets || []).forEach(function (a) { if (ME && a.owner === ME && a.hd === ME && !ZB(a)) h[a.id] = 1; }); if (!(V.retiredUI && V.retiredUI(w))) (w.pets || []).forEach(function (a) { if (ME && a.skipBy === ME) h[a.id] = 1; }); /* skip lists stop mattering once pet:sk / su are retired */ return h; }
  function zQ(html) { return '<button type="button" class="ip-q zb-qbtn" aria-expanded="false" aria-label="What is this?">?</button><div class="zb-help" hidden>' + html + '</div>'; }
  /* least rare Discarded pet, not ripe, lowest id. One meal refills hunger, so the default is a single cheap Discarded pet, named on the button. */
  function zDefaultMeal(L, H) { var best = null, bk = Infinity, any = false; L.forEach(function (a) { if (H[a.id]) any = true; }); if (!any) return null;
    L.forEach(function (a) { if (!H[a.id]) return; var key = ((a.tier | 0) * 2 + (a.neglected ? 1 : 0)) * 1e12 + a.id; if (key < bk) { bk = key; best = a; } }); return best; }
  function zFeedHtml(p, w) { if (!ZB(p) || !ME || p.owner !== ME || !V.cemOn || !V.cemCost) return ''; var b = (S.tip || 0) + 1; if (!V.cemOn(b)) return ''; zPickCss();
    var pend = zPendIds(['zfeed', 'rpl']), mine = zPendMeals(p.id), all = zMeals(w, ME, b).filter(function (a) { return a.id !== p.id && pend.indexOf(a.id) < 0 && !zPledgedAny(w, a.id); });
    var L = all.filter(function (a) { return !isKept(a.id); }), kept = all.length - L.length, H = zDiscarded(w), D = L.filter(function (a) { return H[a.id]; }), cost = V.cemCost(w, 'zmeal', b), v = V.cemView(w, p, b) || {};
    var meal = zDefaultMeal(L, H), pre = meal ? [meal.id] : [], gate = !!(V.cemTokenOfferOn && V.cemTokenOfferOn(b)), cap = zAtCap(p);
    var pn = mine.length ? '<div class="small zb-pend">⏳ Meal waiting for a block: ' + mine.map(function (id) { var a = w.byId[id]; return esc((a && a.name) || '#' + id) + ' #' + id; }).join(', ') + '. It is eaten (and hunger refills) when that burn confirms; until then the pet still shows on your list.</div>' : '';
    var help = 'A zombie eats <b>pets</b>, not XCPETS meals. Every pet you tick is <b>eaten for good</b>. The fee is ' + fmt(cost) + ' XCPETS <b>per burn</b>, and one burn eats as many pets as fit in it (pets with close ids pack best). Any meal refills hunger to full. Each row shows the <b>power</b> that pet alone would add.' + zCapNote(p) + (gate ? ' <b>Only Discarded pets</b> can be offered (🗑️ Discard in My Pets). Tokenized pets can\'t be offered.' : '') + (kept ? ' ★ Starred pets are never listed (' + fmt(kept) + ').' : '') + ' Pets offered at a seance are Sacrificed. A meal is different: the zombie eats the pet.';
    var note = meal ? 'One Discarded pet is ticked: the least rare one. A meal refills hunger. Each row says what that meal does.' : (D.length ? 'Tick a Discarded pet. A meal refills hunger.' : 'No Discarded pets to feed yet. Discard pets in My Pets first.');
    if (cap) note += ' This zombie is at its power cap, so meals add no power. They still refill hunger.';
    var empty = gate ? 'No Discarded pets it can eat. Discard pets in My Pets (🗑️, free) first. Tokenized pets can\'t be offered.' : 'No pets it can eat. Discard pets in My Pets (🗑️, free) and they show first here.';
    return '<div class="zb-feed zb-pk zb-step" data-zf="' + p.id + '" data-pk="feed">' + pn +
      '<h3 class="zb-h">Feed discarded pets ' + zQ(help) + '</h3>' +
      '<p class="small zb-stepnote">' + note + '</p>' +
      '<p class="small muted">' + fmt(D.length) + ' discarded' + (L.length - D.length ? ' · ' + fmt(L.length - D.length) + ' other' : '') + '</p>' +
      '<div class="small zb-sum" data-pow="' + (v.power || 0) + '"></div>' +
      '<p class="small zb-noact zb-need"' + (pre.length ? ' hidden' : '') + '>' + (D.length ? 'Tick a Discarded pet to feed it.' : 'No Discarded pets to feed. Discard pets in My Pets first.') + '</p>' +
      '<button type="button" class="btn zb-feedbtn"' + (pre.length ? '' : ' hidden') + '>' + zBtnText(w, p.id, pre, b) + '</button>' +
      '<details class="zb-meals"><summary class="small">Pick pets (' + fmt(D.length) + ' discarded' + (L.length - D.length ? ', ' + fmt(L.length - D.length) + ' other' : '') + ')</summary>' +
      zSortBar('feed', D.length, L.length > D.length) +
      zList({ items: L, w: w, H: H, pre: pre, valOf: function (a) { return zMealGain(w, p, [a]); }, unit: '⚡', empty: empty }, true) +
      '</details></div>'; }
  /* cem-pickers (owner Oct 30 2026 7:55 PM CT "sacrifice options shown by rarity or pet score or power or something not all pick best"): both pet
   * pickers (zombie meal + Resurrection pledge) get a sort (discarded first / rarity / pet score / power / what it adds) and a rarity + discarded-only
   * filter, and every row shows what that pet is worth here: the ⚡ power it alone would add to the zombie (zfeed math read from V.CEM.MEAL_SHARE,
   * GRAVE_FACTOR and V.cemExact) or the Resurrection points it adds (V.CEM.POINTS by tier, 1/3/10/33). Nothing is pre-ticked. Display only. */
  function zPickCss() { if (document.getElementById('zbPickCss')) return; var s = document.createElement('style'); s.id = 'zbPickCss';
    s.textContent = '.zb-sortbar{display:flex;flex-direction:column;gap:6px;align-items:stretch;margin:4px 0;color:#c9d6a9}.zb-sorts,.zb-rares,.zb-tools{display:flex;flex-wrap:wrap;gap:4px;align-items:center}.zb-sortb,.zb-rarb{min-height:32px}' +
      '.zb-sortb.on,.zb-rarb.on{background:#3ddc84;color:#04130a;font-weight:700}.zb-filters{margin:2px 0}.zb-filters>summary{cursor:pointer;color:#c9d6a9}' +
      '.zb-opt{flex-wrap:wrap}.zb-opt .zb-nm{flex:1 1 auto;min-width:0}.zb-v{margin-left:auto;font-weight:700;color:#d8f08a;white-space:nowrap}.zb-v.rp{color:#ffe27a}.zb-mt{color:#8f9a80;font-size:11px;white-space:nowrap}.zb-dt{color:#e3a35a}' +
      '.zb-sum{flex:1 1 100%;margin:4px 0;color:#d9e6b8;min-height:1em}.zb-sum b{color:#fff}.zb-sum .lo{color:#e3a35a}.zb-rpl .zb-pickbox summary{color:#f3e3a2}.zb-rpl{border-top:1px dashed #4d5a3a;padding-top:6px;flex:1 1 100%}.zb-gear{margin-top:6px}.zb-pled{flex:1 1 100%;color:#c9b97a}.zb-resbtn:disabled{opacity:.5;cursor:not-allowed}' +
      '.zb-ql input{width:150px;max-width:44vw;font-size:12px}.zb-more{display:block;width:100%;margin:4px 0;font-size:12px}.zb-cnt{margin:2px 0 0;font-size:11px}';
    (document.head || document.documentElement).appendChild(s); }
  function zScore(w, a) { try { var s = window.PetScore && PetScore.of ? PetScore.of(w, a) : null; return s ? Math.round(s.score) : -1; } catch (e) { return -1; } }
  function zPow(a) { try { return window.UXB && UXB.power ? Math.round(UXB.power(a)) : 0; } catch (e) { return 0; } }
  function zAtCap(Z) { var z = Z && Z.zombie; if (!z || !z.cap) return false; return Math.min(z.cap, 1 + 2 * (1 - z.keep)) >= z.cap - 0.05; }
  function zCapNote(Z) { if (!zAtCap(Z)) return ''; var z = Z.zombie, times = Math.round(Math.min(z.cap, 1 + 2 * (1 - z.keep)) * 100) / 100; return ' <b>' + esc(Z.name || '#' + Z.id) + ' is at ' + times + ' times its power cap of ' + z.cap + ' times</b>, so a meal adds almost no power (shown as +0). It still refills hunger.'; }
  function zPowAt(z, keep) { var c = Object.assign({}, z, { keep: keep }); return Object.keys(z.death || {}).reduce(function (s, k) { return s + V.cemExact(c, k); }, 0); }
  /* the zfeed keep step of cemHandle, read-only: s = min(0.95, MEAL_SHARE[tier] × (ripe ? 1.5 : 1) × GRAVE_FACTOR[zombie tier]).
     A Mythic zombie uses that same rarity grave factor (not the 0.5 raise factor) once ACTIVATE_MYTHIC_ZFEED_BLOCK is on. */
  function zMealGain(w, Z, meals) { var C = V.CEM, z = Z && Z.zombie; if (!C || !z || !V.cemExact || !C.MEAL_SHARE) return 0; var T = function (x) { return Math.max(0, Math.min(3, x | 0)); }, gf = C.GRAVE_FACTOR[T(Z.tier)], k = z.keep;
    meals.forEach(function (a) { var s = Math.min(0.95, C.MEAL_SHARE[T(a.tier)] * (a.neglected ? 1.5 : 1) * gf); k = Math.round(k * (1 - s) * 1e6) / 1e6; });
    return Math.round(zPowAt(z, k)) - Math.round(zPowAt(z, z.keep)); }
  function zRpPts(x) { var P = (V.CEM && V.CEM.POINTS) || [1, 3, 10, 33]; return P[Math.max(0, Math.min(3, (x && x.tier) | 0))]; }
  function zSortBar(kind, nd, mixed) { var val = kind === 'feed' ? 'Adds most' : 'Most points';
    var O = [['disc', 'Discarded'], ['tier-d', 'Rarest'], ['tier', 'Common'], ['score', 'Score low'], ['score-d', 'Score high'], ['pow', 'Power low'], ['pow-d', 'Power high'], ['val-d', val]];
    var sorts = O.map(function (o, i) { return '<button type="button" class="q zb-sortb' + (i ? '' : ' on') + '" data-sort="' + o[0] + '" aria-pressed="' + (i ? 'false' : 'true') + '">' + o[1] + '</button>'; }).join('');
    var rares = '<button type="button" class="q zb-rarb on" data-tier="" aria-pressed="true">All</button>' + TL.map(function (t, i) { return '<button type="button" class="q zb-rarb" data-tier="' + i + '" aria-pressed="false">' + esc(t) + '</button>'; }).join('');
    return '<div class="zb-sortbar small"><div class="zb-sorts" role="radiogroup" aria-label="Sort">' + sorts + '</div>' +
      '<div class="zb-tools"><label class="zb-ql">🔎 <input type="search" class="zb-q" placeholder="Name or #id" aria-label="Search the list by name or #id"></label> <button type="button" class="q zb-none">Clear</button></div>' +
      '<details class="zb-filters"><summary>Filters' + (nd ? ' · Select all discarded (' + fmt(nd) + ')' : '') + '</summary><div class="zb-rares" role="radiogroup" aria-label="Rarity">' + rares + '</div>' +
      (mixed ? '<label class="zb-dlab"><input type="checkbox" class="zb-donly"> Discarded only</label> ' : '<input type="checkbox" class="zb-donly" hidden aria-hidden="true">') +
      (nd ? '<button type="button" class="q zb-alld">Select all discarded (' + fmt(nd) + ')</button>' : '') + '</details></div>'; }
  /* pledge-picker-all (owner Oct 31 2026 "The pledge list only shows your first 3,000 pets, and since it lists Commons first, every Rare and
   * Legendary gets cut off"): zRows sorted Commons first and cut the list at 3,000 rows (the Resurrection gear list at 400). Now every eligible
   * pet and gear stays in JS (ZPK), the default order is discarded first, then rarest first (Legendary → Common), only ZPAGE rows are drawn at a
   * time (Show more), a search box (name, #id, rarity, stage) narrows the whole list, and the sort, the filters, "Select all discarded", the
   * ticks and the running sum all work on the full list, not on the drawn rows. Score / power / value are computed only for rows that are drawn
   * or when that sort is picked (memoised), so a 10,000-pet wallet stays fast. Display only: the same ids reach the same plan functions. */
  var ZPK = {}, ZPKn = 0, ZPAGE = 200;
  function zReg(o) { Object.keys(ZPK).forEach(function (k) { var r = ZPK[k]; if (r.el && !r.el.isConnected) delete ZPK[k]; }); var ks = Object.keys(ZPK); while (ks.length > 400) delete ZPK[ks.shift()];
    var k = 'zk' + (++ZPKn); o.sel = new Set((o.pre || []).map(function (id) { return +id; })); o.shown = ZPAGE; o.memo = {}; o.hay = {}; ZPK[k] = o; return k; }
  function zF(R, a, f) { if (f === 't') return a.tier | 0; if (f === 'id') return R.gear ? +a.gid.slice(1) : a.id; if (f === 'd') return !R.gear && R.H[a.id] ? 1 : 0;
    if (R.gear) return f === 'v' ? zRpPts(a) : f === 's' ? -1 : 0;
    var m = R.memo[f] || (R.memo[f] = {}), id = a.id; if (!(id in m)) m[id] = f === 's' ? zScore(R.w, a) : f === 'p' ? zPow(a) : R.valOf(a); return m[id]; }
  function zHay(R, a) { var k = zF(R, a, 'id'); if (R.hay[k] == null) R.hay[k] = (R.gear ? [a.label || '', a.gid, TL[a.tier | 0], a.slot || ''] : [a.name || '', '#' + a.id, TL[a.tier | 0], (V.stageLabelOf ? V.stageLabelOf(a) : a.stageName) || '', a.neglected ? 'ripe' : '']).join(' ').toLowerCase(); return R.hay[k]; }
  function zView(el, R) { var sb = el && el.querySelector('.zb-sortb[aria-pressed="true"]'), rb = el && el.querySelector('.zb-rarb[aria-pressed="true"]'), dn = el && el.querySelector('.zb-donly'), qb = el && el.querySelector('.zb-q');
    var m = sb ? sb.getAttribute('data-sort') : 'disc', desc = /-d$/.test(m), key = m.replace(/-d$/, ''), f = { disc: 'd', tier: 't', score: 's', pow: 'p', val: 'v' }[key] || 'd';
    var tv = rb && rb.getAttribute('data-tier') !== '' ? +rb.getAttribute('data-tier') : null, don = !!(dn && dn.checked), q = String((qb && qb.value) || '').trim().toLowerCase(), I = function (a) { return zF(R, a, 'id'); };
    var A = R.items.filter(function (a) { return (tv == null || (a.tier | 0) === tv) && (!don || zF(R, a, 'd')) && (!q || zHay(R, a).indexOf(q) >= 0); });
    A.sort(function (a, c) { var x = zF(R, a, f), y = zF(R, c, f); if (key === 'disc') return y - x || zF(R, c, 't') - zF(R, a, 't') || I(a) - I(c); return (desc ? y - x : x - y) || zF(R, c, 'd') - zF(R, a, 'd') || I(a) - I(c); });
    if (R.sel && R.sel.size && R.sel.size <= 30) { var pin = [], rest = []; A.forEach(function (a) { (R.sel.has(I(a)) ? pin : rest).push(a); }); A = pin.concat(rest); }
    return A; }
  function zRow(R, a) { var on = zF(R, a, 'id'), ck = R.sel.has(on) ? ' checked' : '';
    if (R.gear) { var v = zRpPts(a); return '<label class="zb-opt" data-id="' + on + '" data-t="' + (a.tier | 0) + '"><input type="checkbox" class="zb-gpick" value="' + on + '"' + ck + '> <span class="zb-nm">' + esc(a.label || a.gid) + ' <span class="muted">' + esc(a.gid) + ' · ' + TL[a.tier | 0] + (a.slot ? ' · ' + esc(a.slot) : '') + (a.on != null ? ' · worn by #' + a.on : '') + '</span></span> <span class="zb-v rp">+' + v + ' ✨</span></label>'; }
    var sc = zF(R, a, 's'), pw = zF(R, a, 'p'), vl = zF(R, a, 'v'), d = zF(R, a, 'd');
    return '<label class="zb-opt" data-id="' + a.id + '" data-t="' + (a.tier | 0) + '"><input type="checkbox" class="zb-pick' + (d ? ' zb-disc' : '') + '" value="' + a.id + '"' + ck + '> <span class="zb-nm">' + (d ? '<span class="zb-dt" title="Discarded">🗑️</span> ' : '') + esc(a.name || '#' + a.id) +
      ' <span class="muted">#' + a.id + ' · ' + TL[a.tier | 0] + ' · ' + esc((V.stageLabelOf ? V.stageLabelOf(a) : a.stageName) || '') + (a.neglected ? ' · ripe' : '') + '</span></span> <span class="zb-mt">' + (sc >= 0 ? 'score ' + sc + ' · ' : '') + 'pow ' + fmt(pw) + '</span> <span class="zb-v' + (R.unit === '⚡' ? '' : ' rp') + '">' + (R.unit === '⚡' ? 'hunger full · +' + fmt(vl) + ' power' : '+' + fmt(vl) + ' points') + '</span></label>'; }
  function zListInner(el, R) { var A = zView(el, R), n = Math.min(A.length, R.shown), nm = R.gear ? 'gear' : 'pets';
    var h = (A.length ? A.slice(0, n).map(function (a) { return zRow(R, a); }).join('') : '<div class="small muted">' + (R.items.length ? 'No ' + nm + ' match this filter or search.' : R.empty) + '</div>') +
      (A.length > n ? '<button type="button" class="q zb-more">Show ' + fmt(Math.min(ZPAGE, A.length - n)) + ' more (' + fmt(A.length - n) + ' left)</button>' : '');
    var sn = 'Discarded'; if (el) { var sb = el.querySelector('.zb-sortb[aria-pressed="true"]'); if (sb) sn = sb.textContent; }
    return { h: h, c: R.items.length ? 'Showing ' + fmt(n) + ' of ' + fmt(A.length) + (A.length < R.items.length ? ' (' + fmt(R.items.length) + ' in all)' : '') + ' ' + nm + ' · ' + sn + ' · ' + fmt(R.sel.size) + ' ticked' : '' }; }
  /* the list box for one picker: R = { items, w, H, valOf, unit, empty } for pets or { gear: true, items, empty } for gear */
  function zList(R, defer) { var k = zReg(R); if (defer) return '<div class="zb-lazy" data-zk="' + k + '"></div>'; var o = zListInner(null, R); return '<div class="zb-list" data-zk="' + k + '">' + o.h + '</div><div class="small muted zb-cnt">' + o.c + '</div>'; }
  function zMaterialize(root) { if (!root) return; root.querySelectorAll('.zb-lazy[data-zk]').forEach(function (host) {
      var box = host.closest('details'); if (box && !box.open) return; if (host.dataset.filled) return; host.dataset.filled = '1';
      var k = host.getAttribute('data-zk'), list = document.createElement('div'), cnt = document.createElement('div');
      list.className = 'zb-list'; list.setAttribute('data-zk', k); cnt.className = 'small muted zb-cnt'; host.replaceWith(list, cnt); }); }
  function zListDraw(el, list, keep) { var R = ZPK[list.getAttribute('data-zk')]; if (!R) return; R.el = el; if (!keep) R.shown = ZPAGE; var st = list.scrollTop, o = zListInner(el, R); list.innerHTML = o.h; list.scrollTop = keep ? st : 0;
    var c = list.nextElementSibling; if (c && c.classList.contains('zb-cnt')) c.textContent = o.c; }
  function zPickSort(el, keep) { el.querySelectorAll('.zb-list[data-zk]').forEach(function (list) { zListDraw(el, list, keep); }); }
  function zRec(el, gear) { var L = el.querySelectorAll('.zb-list[data-zk], .zb-lazy[data-zk]'); for (var i = 0; i < L.length; i++) { var R = ZPK[L[i].getAttribute('data-zk')]; if (R && !!R.gear === !!gear) return R; } return null; }
  function zPendIds(acts, z) { var o = []; myPendingTags().forEach(function (tag) { var t = zParse(tag); if (t && acts.indexOf(t.action) >= 0 && (z == null || +t.zombie === +z)) (t.ids || []).forEach(function (id) { o.push(+id); }); }); return o; }
  /* unresp-1101: zPledgedAny was O(all pets) per candidate pet, run for every candidate of every zombie card on every render(), so with many pets
   * + zombies each button press (all call render) froze the page ~10 s. Same answer from one pass: a set of ids pledged to any open zombie,
   * built once per world per task (cleared on the next macrotask, so it never goes stale). */
  var zPledW = null, zPledS = null;
  function zPledgedAny(w, id) { if (zPledW !== w || !zPledS) { var s = {}; (w.pets || []).forEach(function (Z) { if (Z && Z.zombie && !Z.zombie.end) (Z.zombie.rpl || []).forEach(function (e) { if (e && e.id != null) s[e.id] = 1; }); });
      zPledW = w; zPledS = s; setTimeout(function () { zPledW = null; zPledS = null; }, 0); }
    return zPledS[id] === 1; }
  /* Resurrection pledge picker (owner Oct 30 2026 7:54 PM CT "should be able to sacrifice more than one at a time and should have animation"): the
   * zombie's card lists your pets (discarded first, starred never) and your gear; tick any number; the card shows the running points total and the
   * live chance (V.cemResInfo on the zombie with the ticked pets added, read-only). Packing: the rules parse only the list form for rpl / rplg
   * (pet:rpl:Z:A.B.C, base-32, ascending, 34 bytes; there is no range form for rpl), so picks are packed greedily into as few list tags as fit,
   * one Resurrection pledge fee (V.cemCost 'rpl') per burn. Pledged pets are only used up when the Resurrection is tried. Rules unchanged. */
  function zRplPlans(w, z, act, ids, b) { var L = zRplPlansList(w, z, act, ids, b); return act === 'rpl' && ids.length && V.cemRunsPlan ? zFewest(L, V.cemRunsPlan(w, 'rpl', z, ids, ME, b), w, b) : act === 'rpl' ? zFewest(L, null, w, b) : L; }
  function zRplPlansList(w, z, act, ids, b) { var s = ids.slice().sort(function (a, c) { return a - c; }).filter(function (x, i, A) { return !i || A[i - 1] !== x; }), out = [], i = 0, cost = V.cemCost(w, 'rpl', b);
    while (i < s.length) { var lst = [], k = i; while (k < s.length) { var t = 'pet:' + act + ':' + z + ':' + lst.concat([s[k]]).map(zB32).join('.'); if (t.length > 34) break; lst.push(s[k]); k++; }
      if (!lst.length) { i++; continue; } out.push({ tag: 'pet:' + act + ':' + z + ':' + lst.map(zB32).join('.'), amount: cost, petId: z, label: 'rpl', zEat: lst }); i = k; }
    return out; }
  function zMyGear(w, Z, b) { var pend = zPendIds(['rplg'], Z.id), on = {}; (Z.zombie.rpl || []).forEach(function (e) { if (e.gid) on[e.gid] = 1; });
    return Object.keys(w.items || {}).map(function (k) { return w.items[k]; }).filter(function (g) { if (!g || !/^g\d+$/.test(g.gid || '') || g.owner !== ME || on[g.gid] || !V.cemGearWhy || V.cemGearWhy(w, g, ME, b)) return false; return pend.indexOf(+g.gid.slice(1)) < 0; })
      .sort(function (a, c) { return (a.tier | 0) - (c.tier | 0) || (+a.gid.slice(1)) - (+c.gid.slice(1)); }); }
  function zResInfo(w, Z, pets, gids, b) { var z = Z.zombie, F = { id: Z.id, owner: Z.owner, tier: Z.tier, mgDead: Z.mgDead, zombie: { rpl: (z.rpl || []).concat(pets.map(function (id) { return { id: id }; }), gids.map(function (n) { return { gid: 'g' + n }; })) } };
    try { return V.cemResInfo(w, F, b); } catch (e) { return { points: 0, chance: 0 }; } }
  function zRplHtml(p, w) { if (!ZB(p) || !ME || p.owner !== ME || !V.cemOn || !V.cemCost || !V.cemResInfo) return ''; var b = (S.tip || 0) + 1; if (!V.cemOn(b)) return '';
    var pend = zPendIds(['zfeed', 'rpl']), mine = zPendIds(['rpl', 'rplg'], p.id), z = p.zombie, done = {}; (z.rpl || []).forEach(function (e) { if (e.id != null) done[e.id] = 1; });
    var all = zMeals(w, ME, b).filter(function (a) { return a.id !== p.id && pend.indexOf(a.id) < 0 && !done[a.id] && !zPledgedAny(w, a.id); }), L = all.filter(function (a) { return !isKept(a.id); }), kept = all.length - L.length;
    var H = zDiscarded(w), D = L.filter(function (a) { return H[a.id]; }), G = zMyGear(w, p, b), cost = V.cemCost(w, 'rpl', b), ri = V.cemResInfo(w, p, b), MIN = ri.min || (V.CEM && V.CEM.RES_MIN) || 25;
    var pl = (ri.pets || []).map(function (a) { return esc(a.name || '#' + a.id) + ' #' + a.id + ' (+' + zRpPts(a) + ')'; }).concat((ri.gear || []).map(function (g) { return esc(g.label || g.gid) + ' (+' + zRpPts(g) + ')'; }));
    var gr = G.length ? zList({ gear: true, items: G, empty: 'No gear you can pledge.' }, true) : '';
    var pts = TL.map(function (t, i) { return esc(t) + ' ' + zRpPts({ tier: i }); }).join(' · ');
    var ready = ri.points >= MIN, resCost = fmt(V.cemCost(w, 'resurrect', b));
    /* mg-odds-ceiling (Nov 25 2026): the odds stop climbing at the rules' ceiling. Without this line a player pledged
     * 1,353 points where about 694 already bought the best odds, and dozens of pets went in for nothing. */
    var capL = window.V2MgRoad ? V2MgRoad.capLine(w, p, b) : '', riskL = window.V2MgRoad && p.mgDead ? V2MgRoad.riskLine(p) : '';
    var resHelp = 'Pledged pets and gear are <b>used up when the Resurrection is tried</b>, win or lose. Points by rarity: ' + pts + '. It needs ' + MIN + ' points to try. The pledge fee is ' + fmt(cost) + ' XCPETS <b>per burn</b>; one burn pledges as many as fit in it. Resurrect itself is ' + resCost + ' XCPETS. You have ' + ri.points + (ri.bonus ? ' plus ' + ri.bonus + ' Halloween' : '') + ' points, about ' + Math.round(ri.chance * 100) + '% chance.' + (capL ? ' ' + capL : '') + (riskL ? ' ' + riskL : '') + (kept ? ' ★ Starred pets are never listed (' + fmt(kept) + ').' : '') + ' Pets offered at a seance are Sacrificed. A pledge is used up only when you try the Resurrection.';
    var res = ready ? '<button type="button" class="btn ghost zb-resbtn">😇 Resurrect · ' + resCost + ' XCPETS</button> ' + zQ(resHelp) : '<p class="zb-noact">Resurrect needs ' + (MIN - ri.points) + ' more points (now ' + ri.points + (ri.bonus ? ' + ' + ri.bonus + ' Halloween' : '') + ' of ' + MIN + ', ' + Math.round(ri.chance * 100) + '% chance). ' + zQ(resHelp) + '</p>';
    var mgNote = p.mgDead && (capL || riskL) ? '<p class="small zb-mgcap">' + (capL ? '🎯 ' + capL + (riskL ? '<br>' : '') : '') + (riskL ? '⚠️ ' + riskL : '') + '</p>' : '';
    return '<div class="zb-feed zb-pk zb-rpl" data-zr="' + p.id + '" data-pk="rpl">' + mgNote + (pl.length ? '<div class="small zb-pled">😇 Already pledged: ' + pl.join(', ') + '</div>' : '') +
      (mine.length ? '<div class="small zb-pend">⏳ Pledge waiting for a block: ' + mine.length + ' item' + (mine.length > 1 ? 's' : '') + '. It counts when that burn confirms.</div>' : '') +
      res +
      '<details class="zb-pickbox"><summary class="small">😇 Pledge pets &amp; gear <span class="muted">(' + ri.points + (ri.bonus ? ' + ' + ri.bonus + ' Halloween' : '') + ' of ' + MIN + ' points · ' + Math.round(ri.chance * 100) + '% chance)</span></summary>' +
      '<p class="small zb-stepnote">Tick pets or gear. They are used up when you try the Resurrection.</p>' +
      zSortBar('rpl', D.length, L.length > D.length) + zList({ items: L, w: w, H: H, valOf: zRpPts, unit: '✨', empty: (V.cemTokenOfferOn && V.cemTokenOfferOn((S.tip || 0) + 1) ? 'No Discarded pets you can pledge. Discard pets in My Pets (🗑️) first. Tokenized pets can\'t be offered.' : 'No pets you can pledge.') }, true) +
      (G.length ? '<details class="zb-gear"><summary class="small">🛡️ Your gear (' + fmt(G.length) + ')</summary>' + gr + '</details>' : '') +
      '<div class="small zb-sum"></div>' +
      '<p class="small zb-noact zb-need">Tick a pet or a gear piece to pledge it.</p>' +
      '<button type="button" class="btn zb-feedbtn" hidden>' + zRplBtn(w, p.id, [], [], b) + '</button></details></div>'; }
  /* MYTHIC GOD LOOP (display + burns through confirmPlans; the rules are V.mg*, gated by ACTIVATE_MYTHIC_UNLEASH_BLOCK):
   * a Mythic-fed zombie is done (no feeding, no pledges); a Mythic zombie can be pledged to its Resurrection (66+ points).
   * Zombie meals (the same picker as any zombie) show beside that pledge once tip+1 reaches ACTIVATE_MYTHIC_ZFEED_BLOCK.
   * Before that block the card stays pledge-only, matching the old "a Mythic zombie never eats" rule. Unleash stays off for a Mythic zombie.
   * a starving (feral) zombie of yours gets the red Unleash button, and after the burn "Unleashed: eats in N blocks". */
  /* card-tidy: the one line a hungry or feral zombie keeps on its My Pets card; feeding happens after a tap (pet page or Open ▸) */
  function zCta(p, w) { var h = null; try { h = window.V2Zombies && V2Zombies.hunger ? V2Zombies.hunger(p, w) : null; } catch (e) { h = null; } if (!h || (p.zombie && p.zombie.mfed) || !(h.feral || h.pct <= 33)) return '';
    var sp = window.V2Zombies && V2Zombies.span ? V2Zombies.span : function (n) { return n + ' blocks'; };
    return '<p class="small zb-cta' + (h.feral ? ' feral' : '') + '">🍖 ' + (h.feral ? 'Feral: feed it within ' + sp(h.crumbleIn) : 'Hungry: feed it within ' + sp(h.left)) + '. Tap to feed.</p>'; }
  function zZoneHtml(p, w) { var blk = unleashEvalBlock(w), b = blk || ((S.tip || 0) + 1), mv = null; try { mv = V.mgView ? V.mgView(w, p, b) : null; } catch (e) { mv = null; }
    /* mg-road (Nov 25 2026): one panel that says which step of the road to Mythic God this pet is on and what the next burn is. */
    var road = ''; try { if (window.V2MgRoad && ME && p.owner === ME) road = V2MgRoad.html(w, p, ME, b); } catch (e) { road = ''; }
    if (mv && mv.fed) return road; if (mv && mv.mythicZombie) return road + (V.mythicZfeedOn && V.mythicZfeedOn(b) ? zFeedHtml(p, w) : '') + zRplHtml(p, w); return road + zFeedHtml(p, w) + zRplHtml(p, w) + mgUnlHtml(p, w, mv); }
  function unleashPlain(why) { if (!why) return '';
    if (/no Mythic it could eat/i.test(why)) return 'Unleash can\'t be used: you have no Mythic it can eat. A Mythic has to be held 30 days, and it can\'t be a 1 of 1, an edition, a community pet, listed, or tokenized.';
    if (/only a starving/i.test(why)) return 'Unleash can\'t be used until this zombie is feral.';
    if (/already unleashed/i.test(why)) return 'Unleash can\'t be used: it is already unleashed.';
    if (/one unleash per wallet/i.test(why)) return 'Unleash can\'t be used: one unleash per wallet every 30 days.';
    if (/Pantheon is full/i.test(why)) return 'Unleash can\'t be used: the Pantheon is full (21 of 21).';
    if (/too late/i.test(why)) return 'Unleash can\'t be used: it would turn to dust before the meal.';
    if (/already Mythic-fed/i.test(why)) return 'Unleash can\'t be used: this zombie is already Mythic-fed.';
    if (/Mythic zombie never/i.test(why)) return 'Unleash can\'t be used: a Mythic zombie cannot be unleashed.';
    return 'Unleash can\'t be used: ' + why; }
  /* Display only. Replay still asks cemDue at the burn's own block. A tab that still has S.tip below
   * ACTIVATE_ZOMBIE_CLOCK_BLOCK would otherwise read the raw fedAt+864 and say the zombie already
   * turned to dust. Hunger uses span() at whatever block it is given. Unleash does that too once the
   * highest known tip (this tab, the world, boot, health, or the chain) is at or past the gate. */
  function unleashPos(n) { n = Number(n); return isFinite(n) && n > 0 ? (n | 0) : 0; }
  function unleashMax(xs) { var m = 0, i; for (i = 0; i < xs.length; i++) if (xs[i] > m) m = xs[i]; return m; }
  function unleashTips(S, w, gate) {
    S = S || {};
    var health = unleashPos(S.healthTip), boot = unleashPos(S.feedTip) || unleashPos(S.bootTip), chain = unleashPos(S.chainTip);
    try { if (typeof window !== 'undefined' && window.V2Split && typeof V2Split.healthTip === 'function') { var h = unleashPos(V2Split.healthTip()); if (h > health) health = h; } } catch (e) {}
    var live = unleashMax([boot, health, chain]), replay = unleashMax([unleashPos(S.tip), unleashPos(w && w.tip)]), real = unleashMax([replay, live]);
    gate = gate | 0;
    var unknown = real <= 0, pause = !unknown && gate > 0 && real >= gate;
    return { real: real, live: live, replay: replay, gate: gate, unknown: unknown, pause: !!pause, b: unknown ? 0 : real + 1 };
  }
  function unleashFix(V, why, tips, fedAt) {
    var fed = fedAt | 0, raw = fed + 864, spanC = V && typeof V.spanAt === 'function' ? V.spanAt(fed, 864) : raw, crosses = spanC !== raw;
    if (!tips || tips.unknown) { if (why && /too late/i.test(why)) return { why: null, checking: true, crumble: null, raw: raw }; return { why: why || null, checking: false, crumble: null, raw: raw }; }
    if (tips.pause && V && typeof V.span === 'function' && typeof V.spanAt === 'function') {
      var b = tips.b, delay = (V.MG && V.MG.DELAY) || 6, late = V.span(b, fed) >= 864 || (b + delay) >= spanC;
      if (why && /too late/i.test(why)) {
        if (!late) return { why: null, checking: false, crumble: spanC, raw: raw, cleared: true };
        return { why: 'too late: it crumbles at block ' + spanC + ' before the meal block', checking: false, crumble: spanC, raw: raw };
      }
      return { why: why || null, checking: false, crumble: spanC, raw: raw };
    }
    if (crosses && why && /too late/i.test(why) && !tips.fresh) return { why: null, checking: true, crumble: null, raw: raw };
    return { why: why || null, checking: false, crumble: null, raw: raw };
  }
  function unleashGate() { return (V.zombieClockGate && V.zombieClockGate()) || 976767; }
  function unleashEvalBlock(w) { var tips = unleashTips(S, w, unleashGate()); return tips.b || 0; }
  var unleashFresh = false;
  function unleashAsk() {
    if (unleashAsk.busy) return;
    if (unleashAsk.at && Date.now() - unleashAsk.at < 20000) return;
    unleashAsk.busy = true; unleashAsk.at = Date.now();
    var jobs = [], saw = 0;
    function keep(n, key) { n = unleashPos(n); if (!n) return; saw = Math.max(saw, n); if (S && n > unleashPos(S[key])) S[key] = n; }
    try { if (window.V2Split && V2Split.pingHealth) jobs.push(V2Split.pingHealth().then(function (n) { keep(n, 'healthTip'); }, function () {})); } catch (e) {}
    try {
      if (typeof fetch === 'function') {
        jobs.push(fetch('api/boot.json?t=' + Math.floor(Date.now() / 60000), { cache: 'no-store' }).then(function (r) { return r && r.ok ? r.json() : null; }).then(function (j) { if (j && j.tip) keep(j.tip, 'feedTip'); }, function () {}));
        var cfg = window.XCPETS_CONFIG || (window.LiveEngine && LiveEngine.CFG), api = (cfg && cfg.mempoolApi) || 'https://mempool.space/api';
        jobs.push(fetch(api + '/blocks/tip/height', { cache: 'no-store' }).then(function (r) { return r && r.ok ? r.text() : ''; }).then(function (t) { var n = parseInt(t, 10); if (n > 0) keep(n, 'chainTip'); }, function () {}));
      }
    } catch (e) {}
    if (!jobs.length) { unleashAsk.busy = false; return; }
    Promise.all(jobs).then(function () { unleashAsk.busy = false; if (!saw) return; unleashFresh = true; try { render(); } catch (e) {} }, function () { unleashAsk.busy = false; });
  }
  function unleashCard(V, S, w, p, me, opt) {
    opt = opt || {};
    if (!V || !p || !me || p.owner !== me || !V.mgPlan || !V.mgView) return '';
    var uq = function (html) { return '<button type="button" class="ip-q zb-qbtn" aria-expanded="false" aria-label="What is this?">?</button><div class="zb-help" hidden>' + html + '</div>'; };
    var nf = function (n) { n = Number(n); return n.toLocaleString('en-US', { maximumFractionDigits: Math.abs(n) >= 1 || n === 0 ? 2 : 8 }); };
    var es = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
    var gate = (typeof V.zombieClockGate === 'function' && V.zombieClockGate()) || 976767;
    var tips = unleashTips(S, w, gate); tips.fresh = !!opt.fresh;
    var feralN = (V.CEM && V.CEM.FERAL) || 432, dustN = feralN + ((V.CEM && V.CEM.CRUMBLE) || 432);
    var checking = '<div class="mg-unl zb-quiet" data-mgu="' + p.id + '"><p class="zb-noact">Checking the chain…</p></div>';
    if (tips.unknown) {
      if ((opt.hunger && opt.hunger.feral) || p.feral) { if (opt.ask) opt.ask(); return checking; }
      return '';
    }
    var b = tips.b, mv = null;
    try { mv = V.mgView(w, p, b); } catch (e) { mv = null; }
    if (!mv || !mv.on || mv.fed || mv.mythicZombie) return '';
    /* mg-fast-world (Nov 25 2026): a slim world without w.cem.mg cannot see a pending unleash, the 30-day wallet gap or
     * the free Pantheon seats, so the button would offer a burn the rules reject. Wait for the table instead. */
    if (window.V2MgRoad && !V2MgRoad.mgReady(w)) { if (opt.ask) opt.ask(); return ((opt.hunger && opt.hunger.feral) || p.feral) ? checking : ''; }
    if (mv.unleash) return '<div class="small mg-pend mg-unl" data-mgu="' + p.id + '">🩸 Unleashed: eats in ' + nf(mv.unleash.left) + ' block' + (mv.unleash.left === 1 ? '' : 's') + ' (block ' + nf(mv.unleash.mealAt) + ') · one of your ' + nf(mv.unleash.pool) + ' Mythic' + (mv.unleash.pool === 1 ? '' : 's') + ', picked by that block\'s hash</div>';
    if ((opt.pending || []).indexOf('pet:unleash:' + p.id) >= 0) return '<div class="small mg-pend mg-unl">⏳ Unleash burn waiting for a block. The meal comes 6 blocks after it confirms.</div>';
    var fed = p.zombie && p.zombie.fedAt, fix = unleashFix(V, mv.unleashWhy, tips, fed == null ? 0 : fed);
    if (fix.checking) { if (opt.ask) opt.ask(); return checking; }
    var spanFeral = false;
    if (fed != null && typeof V.span === 'function') { var sp = V.span(b, fed | 0); spanFeral = sp >= feralN && sp < dustN; }
    var feral = tips.pause ? spanFeral : !!((opt.hunger && opt.hunger.feral) || p.feral);
    if (!feral) return '';
    var why = fix.why, cost = V.mgPlan(w, p.id, b).amount, nEat = (mv.edible || []).length;
    var said = why || 'it can be unleashed';
    if (tips.pause && fix.crumble != null && !why && typeof V.span === 'function') said += '. Dust at block ' + fix.crumble + ' (' + Math.max(0, dustN - V.span(b, fed | 0)) + ' blocks left)';
    var more = 'The game said: ' + es(said) + '. Unleash spends ' + nf(cost) + ' XCPETS. Six blocks later the zombie eats one eligible Mythic at random. A Mythic has to be held 30 days. It can\'t be a 1 of 1, an edition, a community pet, listed, or tokenized.';
    if (why) return '<div class="mg-unl zb-quiet" data-mgu="' + p.id + '"><p class="zb-noact">' + es(unleashPlain(why)) + ' ' + uq(more) + '</p></div>';
    return '<div class="mg-unl" data-mgu="' + p.id + '"><button type="button" class="btn mg-red mg-unlbtn" data-z="' + p.id + '">🩸 Unleash · ' + nf(cost) + ' XCPETS</button> ' + uq('Starving: unleash it and it eats ONE of your ' + nf(nEat) + ' Mythic' + (nEat === 1 ? '' : 's') + ' that can be eaten, picked at random 6 blocks later. ' + more) + '</div>';
  }
  function mgUnlHtml(p, w, mv) {
    if (!ME || !p || p.owner !== ME || !V.mgPlan) return '';
    if (mv && mv.fed) return '';
    if (mv && mv.mythicZombie) return '';
    var hunger = window.V2Zombies && V2Zombies.hunger ? V2Zombies.hunger(p, w) : null;
    return unleashCard(V, S, w, p, ME, { pending: typeof myPendingTags === 'function' ? myPendingTags() : [], hunger: hunger, ask: unleashAsk, fresh: unleashFresh });
  }
  function mgUnlDialog(z) {
    if (window.V2Split && V2Split.ownersReady && !V2Split.ownersKnown()) { toast('loading owners'); V2Split.ownersReady().then(function () { mgUnlDialog(z); }); return; }
    var w = world(), b = unleashEvalBlock(w) || ((S.tip || 0) + 1), Z = w.byId[z], mv = V.mgView ? V.mgView(w, Z, b) : null; if (!Z || !mv || !mv.edible || !mv.edible.length) return toast(mv && mv.unleashWhy ? 'Can\'t unleash: ' + mv.unleashWhy : 'No Mythic of yours can be eaten.');
    var nm = Z.name || ('#' + z), old = document.getElementById('mgDlg'); if (old) old.remove(); var d = document.createElement('div'); d.id = 'mgDlg'; d.className = 'mg-dlg-wrap';
    d.innerHTML = '<div class="mg-dlg" role="dialog" aria-modal="true" aria-labelledby="mgDlgT"><h3 id="mgDlgT">🩸 Unleash ' + esc(nm) + ' #' + z + '</h3>' +
      /* honest-mg-copy (Nov 25 2026): this line used to promise another raise after a failed roll. The rules give ONE
       * Resurrection try, and a miss turns the Mythic to dust for good. Three players were told otherwise and lost theirs. */
      '<p class="mg-dlg-warn">Your zombie ' + esc(nm) + ' will EAT ONE of these Mythics, picked at random. The eaten Mythic dies and leaves a violet grave. You raise that grave and get <b>one</b> Resurrection roll: win and it is a Mythic God, lose and it turns to dust and is gone forever.</p>' +
      '<div class="mg-dlg-list">' + mv.edible.map(function (id) { var q = w.byId[id]; return '<div class="mg-ed"><canvas width="32" height="32" data-id="' + id + '"></canvas><span>' + esc((q && q.name) || '#' + id) + '</span><span class="muted">#' + id + '</span></div>'; }).join('') + '</div>' +
      '<p class="small">The meal comes 6 blocks after the burn confirms, picked by that block\'s hash from the Mythics above that can still be eaten then. 1-of-1, edition, community, listed and tokenized Mythics, the owner\'s pets #1, #2 and #13, and Mythics held under 30 days, are never on the menu. If ' + esc(nm) + ' is hunted, leaves your wallet or crumbles first, nothing is eaten. One unleash per wallet every 30 days.</p>' +
      '<label class="small">Type <b>' + esc(nm) + '</b> to unleash it <input type="text" class="mg-name" autocomplete="off" spellcheck="false"></label>' +
      '<div class="mg-dlg-btns"><button type="button" class="btn ghost mg-no">Cancel</button> <button type="button" class="btn mg-red mg-yes" disabled>🩸 Unleash · ' + fmt(V.mgPlan(w, z, b).amount) + ' XCPETS</button></div></div>';
    document.body.appendChild(d); var inp = d.querySelector('.mg-name'), yes = d.querySelector('.mg-yes');
    d.querySelectorAll('canvas[data-id]').forEach(function (c) { var q = w.byId[+c.dataset.id]; try { if (q) R.paint(c, R.petFrames(q, w)[0]); } catch (e) {} });
    inp.addEventListener('input', function () { yes.disabled = inp.value.trim().toLowerCase() !== String(nm).trim().toLowerCase(); });
    inp.addEventListener('keydown', function (e) { e.stopPropagation(); if (e.key === 'Escape') d.remove(); });
    d.querySelector('.mg-no').onclick = function () { d.remove(); }; d.addEventListener('click', function (e) { if (e.target === d) d.remove(); });
    yes.onclick = function () { if (yes.disabled) return; d.remove(); var P = V.mgPlan(world(), z, unleashEvalBlock(world()) || b); confirmPlans('🩸 Unleash ' + esc(nm) + ' #' + z + ' · it eats ONE of your ' + mv.edible.length + ' Mythic' + (mv.edible.length === 1 ? '' : 's') + ' at random, 6 blocks after this burn', [{ tag: P.tag, amount: P.amount, petId: z, label: 'unleash' }]); };
    setTimeout(function () { try { inp.focus(); } catch (e) {} }, 0); }
  if (typeof document !== 'undefined') document.addEventListener('click', function (e) {
    var qb = e.target && e.target.closest && e.target.closest('.zb-qbtn');
    if (qb) { e.preventDefault(); e.stopPropagation(); var box = qb.nextElementSibling; if (!box || !box.classList || !box.classList.contains('zb-help')) box = qb.parentNode && qb.parentNode.nextElementSibling; if (box && box.classList && box.classList.contains('zb-help')) { var open = box.hidden; box.hidden = !open; qb.setAttribute('aria-expanded', open ? 'true' : 'false'); } return; }
    var bt = e.target && e.target.closest && e.target.closest('.mg-unlbtn'); if (!bt) return; e.stopPropagation(); e.preventDefault(); if (!bt.disabled) mgUnlDialog(+bt.dataset.z);
  }, true);
  try { var mgc = document.createElement('style'); mgc.textContent = '.mg-dlg-wrap{position:fixed;inset:0;background:rgba(0,0,0,.66);z-index:9999;display:flex;align-items:center;justify-content:center;padding:12px}.mg-dlg{background:#1a0c0c;border:2px solid #b3261e;border-radius:10px;max-width:520px;width:100%;padding:14px;color:#f6e7e5;box-shadow:0 0 24px rgba(179,38,30,.5)}.mg-dlg h3{margin:0 0 6px;color:#ff8a80}.mg-dlg canvas{width:48px;height:48px;image-rendering:pixelated}.mg-dlg-btns{display:flex;gap:8px;justify-content:flex-end;margin-top:10px}.mg-dlg .btn.mg-red{background:#b3261e;border-color:#7a1c1c;color:#fff}.mg-dlg .btn.mg-red:disabled{opacity:.45}'; (document.head || document.documentElement).appendChild(mgc); } catch (e) {}
  function zRplBtn(w, z, ids, gids, b) { if (!ids.length && !gids.length) return '😇 Tick pets or gear above to pledge'; var L = zRplPlans(w, z, 'rpl', ids, b).concat(zRplPlans(w, z, 'rplg', gids, b)), n = L.length, c = ids.length + gids.length;
    return '😇 Pledge ' + fmt(c) + ' · ' + n + ' burn' + (n > 1 ? 's' : '') + ' = ' + fmt(zSum(L)) + ' XCPETS' + (V.cemRunsOn && V.cemRunsOn(b) ? ' (' + fmt(V.cemCost(w, 'rpl', b)) + ' per pet)' : ''); }
  function zFeedBind(root) { if (!root) return; root.querySelectorAll('.zb-pk').forEach(function (el) { if (el._zb) return; el._zb = true; var rp = el.dataset.pk === 'rpl', z = +(el.dataset.zf || el.dataset.zr);
    function picked(c) { var R = zRec(el, c === '.zb-gpick'); return R ? Array.from(R.sel) : []; } /* the ticks live in JS (ZPK), so ticked rows that are not drawn still count */
    function cnt() { el.querySelectorAll('.zb-list[data-zk]').forEach(function (list) { var R = ZPK[list.getAttribute('data-zk')], c = list.nextElementSibling; if (R && c && c.classList.contains('zb-cnt')) c.textContent = c.textContent.replace(/[\d,]+ ticked$/, fmt(R.sel.size) + ' ticked'); }); }
    el.querySelectorAll('.zb-list[data-zk], .zb-lazy[data-zk]').forEach(function (list) { var R = ZPK[list.getAttribute('data-zk')]; if (R) R.el = el; });
    el.addEventListener('toggle', function (e) { var d = e.target; if (!d || !d.open || !d.classList) return; if (!d.classList.contains('zb-meals') && !d.classList.contains('zb-pickbox') && !d.classList.contains('zb-gear')) return; zMaterialize(d); zPickSort(el); }, true);
    function press(sel, on) { el.querySelectorAll(sel).forEach(function (x) { var hit = x === on; x.setAttribute('aria-pressed', hit ? 'true' : 'false'); x.classList.toggle('on', hit); }); }
    function upd() { var w = world(), b = (S.tip || 0) + 1, ids = picked(), gids = rp ? picked('.zb-gpick') : [], bt = el.querySelector('.zb-feedbtn'), sm = el.querySelector('.zb-sum'), need = el.querySelector('.zb-need'), Z = w.byId[z];
      var ready = !!(ids.length || gids.length); if (bt) { bt.hidden = !ready; bt.disabled = !ready; bt.textContent = rp ? zRplBtn(w, z, ids, gids, b) : zBtnText(w, z, ids, b); } if (need) need.hidden = ready; if (!sm || !Z) return;
      if (!rp) { var p0 = +sm.dataset.pow || 0, g = ids.length ? zMealGain(w, Z, ids.map(function (i) { return w.byId[i]; }).filter(Boolean)) : 0; sm.innerHTML = ids.length ? 'Ticked <b>' + ids.length + '</b> · power <b>' + fmt(p0) + ' → ' + fmt(p0 + g) + '</b> (+' + fmt(g) + ' ⚡) · hunger refills to <b>100%</b>' : ''; return; }
      var a = zResInfo(w, Z, [], [], b), MIN = a.min || (V.CEM && V.CEM.RES_MIN) || 25, c = zResInfo(w, Z, ids, gids, b), P = c.points + (c.bonus || 0);
      sm.innerHTML = (ids.length || gids.length ? 'Ticked <b>' + (ids.length + gids.length) + '</b> · points <b>' + a.points + ' → ' + c.points + '</b>' + (c.bonus ? ' (+' + c.bonus + ' Halloween)' : '') + ' of ' + MIN + ' · chance <b>' + Math.round(a.chance * 100) + '% → ' + Math.round(c.chance * 100) + '%</b>' + (c.points < MIN ? ' <span class="lo">· needs ' + (MIN - c.points) + ' more to try</span>' : '') : '') + (P < 0 ? '' : ''); }
    el.addEventListener('change', function (e) { if (e.target.closest('.zb-sort,.zb-tf,.zb-donly')) { zPickSort(el); return; } var g = e.target.classList.contains('zb-gpick'); if (g || e.target.classList.contains('zb-pick')) { var R = zRec(el, g); if (R) { if (e.target.checked) R.sel.add(+e.target.value); else R.sel.delete(+e.target.value); } cnt(); upd(); } });
    var qt = 0; el.addEventListener('input', function (e) { if (!e.target.classList.contains('zb-q')) return; clearTimeout(qt); qt = setTimeout(function () { zPickSort(el); }, 150); });
    el.addEventListener('click', function (e) { e.stopPropagation();
      var sb = e.target.closest('.zb-sortb'); if (sb) { press('.zb-sortb', sb); zPickSort(el); return; }
      var rb = e.target.closest('.zb-rarb'); if (rb) { press('.zb-rarb', rb); zPickSort(el); return; }
      var mo = e.target.closest('.zb-more'); if (mo) { var ml = mo.closest('.zb-list[data-zk]'), MR = ml && ZPK[ml.getAttribute('data-zk')]; if (MR) { MR.shown += ZPAGE; zListDraw(el, ml, true); } return; }
      if (e.target.closest('.zb-alld,.zb-none')) { var on = !!e.target.closest('.zb-alld'), RP = zRec(el, false), RG = zRec(el, true); if (on) { if (RP) RP.items.forEach(function (a) { if (zF(RP, a, 'd')) RP.sel.add(a.id); }); } else { if (RP) RP.sel.clear(); if (RG) RG.sel.clear(); } zPickSort(el, true); upd(); return; }
      var w = world(), b = (S.tip || 0) + 1, Z = w.byId[z];
      if (e.target.closest('.zb-resbtn')) { if (!Z || e.target.closest('.zb-resbtn').disabled) return; var ri = V.cemResInfo(w, Z, b);
        /* honest-mg-copy: a Mythic zombie's roll is one try, and a fail destroys the Mythic. Say it on the sheet that signs it. */
        var mgTail = Z.mgDead && window.V2MgRoad ? ' · ' + V2MgRoad.riskLine(Z, true) : '';
        confirmPlans('😇 Try the Resurrection of ' + esc(Z.name || '#' + z) + ' #' + z + ' · ' + ri.points + ' points · ' + Math.round(ri.chance * 100) + '% chance · every pledged pet and gear is used up, win or lose' + mgTail, [{ tag: V.cemPlan(w, 'resurrect', z, null, b).tag, amount: V.cemCost(w, 'resurrect', b), petId: z, label: 'resurrect' }]); return; }
      var bt = e.target.closest('.zb-feedbtn'); if (!bt) return; var ids = picked(), gids = rp ? picked('.zb-gpick') : [];
      if (!Z || (!ids.length && !gids.length)) return toast('Tick the ' + (rp ? 'pets or gear you want to pledge to ' : 'pets you want ') + (Z ? esc(Z.name || '#' + z) : 'the zombie') + (rp ? '' : ' to eat') + ' first.');
      if (window.V2SacGuard && ids.length && !bt._sgOk) return V2SacGuard.check({ w: w, ids: ids, me: ME, verb: rp ? 'pledge them to the Resurrection of ' + (Z.name || '#' + z) : 'feed them to ' + (Z.name || 'the zombie'), onGo: function (keep) { /* sac-guard: special pets left out -> untick them, then the same button again */
        var RP = zRec(el, false); if (RP) ids.forEach(function (id) { if (keep.indexOf(id) < 0) { RP.sel.delete(id); var cb = el.querySelector('input.zb-pick[value="' + id + '"]'); if (cb) cb.checked = false; } }); try { upd(); } catch (x) { } if (!keep.length && !gids.length) return; bt._sgOk = 1; try { bt.click(); } finally { bt._sgOk = 0; } } });
      var names = ids.map(function (f) { var F = w.byId[f]; return esc((F && F.name) || '#' + f) + ' #' + f; }).concat(gids.map(function (n) { var g = w.items['g' + n]; return esc((g && g.label) || 'g' + n) + ' (gear)'; }));
      var nm = names.slice(0, 6).join(', ') + (names.length > 6 ? ' +' + (names.length - 6) + ' more' : '');
      if (!rp) return confirmPlans('🍖 Feed zombie ' + esc(Z.name || '#' + z) + ' #' + z + ' · eats ' + ids.length + ' pet' + (ids.length > 1 ? 's' : '') + ' for good: ' + nm, zFeedPlans(w, z, ids, b));
      var c = zResInfo(w, Z, ids, gids, b);
      /* mg-odds-ceiling: when the pledge cannot raise the odds any further, say so on the sheet that signs it. */
      var a0 = V.cemResInfo(w, Z, b), capT = Z.mgDead && window.V2MgRoad && Math.round((c.chance || 0) * 10000) <= Math.round((a0.chance || 0) * 10000) ? ' · ⚠️ this does not raise the odds: ' + V2MgRoad.capLine(w, Z, b) : '';
      confirmPlans('😇 Pledge to the Resurrection of ' + esc(Z.name || '#' + z) + ' #' + z + ' · ' + names.length + ' (used up when it is tried): ' + nm + ' · points → ' + c.points + ' · chance → ' + Math.round(c.chance * 100) + '%' + capT, zRplPlans(w, z, 'rpl', ids, b).concat(zRplPlans(w, z, 'rplg', gids, b))); });
    el.addEventListener('keydown', function (e) { e.stopPropagation(); }); upd(); }); }
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
  /* Nov 23 2026 (a 29,000-pet wallet 'can't even feed my pets'): runs (pet:fr) and feed-all tags (pet:fa/fx/fy) name pets by their place in
   * the owner's WHOLE list, and their amount is for every hungry pet. While the list is still arriving in pages that list is short here, so the
   * burn would point at other pets and the check refused it. Until every page is in, feed by pet number only (exact, always safe). */
  function feedQ(w, me, ids, nb, list) { if (!hatchListSettled(w)) return feedQold(w, me, eaters(w, me, ids, (nb != null ? nb : ((w && w.tip) || 0) + 1)), nb, true);
    var rb = runsOn(w, nb); if (rb == null) return feedQold(w, me, ids, nb, list);
    var ok = eaters(w, me, ids, rb), fr = ok.length > 1 ? V.feedRunsPlan(w, me, ok.map(function (id) { return w.byId[id]; }), rb) : null;
    if (fr && (ok.length >= 300 || fr.length === 1)) return fr; /* big feeds: the runs plan, without the slow pet-number planner */
    var q = feedQold(w, me, ok, nb, list); return fr && fr.length <= q.length ? fr : q; }
  function feedSelQ(w, me, ids, nb) { return feedQ(w, me, ids, nb, true); } /* Feed selected: list burns only */
  var fmt = (function () { var F2 = null, F8 = null; try { F2 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }); F8 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 }); } catch (e) {} /* freeze-hunt: one formatter each, not a new one per number (was the top cost of drawing big pet lists) */
    return function (n) { n = Number(n); var two = Math.abs(n) >= 1 || n === 0; if (F2) return (two ? F2 : F8).format(n); return n.toLocaleString('en-US', { maximumFractionDigits: two ? 2 : 8 }); }; })();
  function cfeedText() { var a = Number(($('cAmt') || {}).value) || 0; return 'Feed community (' + fmt(Math.max(a, 0)) + ')'; } /* hatchspeed-1101: display only (halving amounts like 172.5 keep their decimals, as v2-halving.js shows them) */ /* >= 1: 2 decimals (hides float noise like 1,335,328.99999996) */
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
  function spLabel(id) { return id && typeof id === 'object' ? (V.petSpeciesLabel ? V.petSpeciesLabel(id) : V.speciesLabel(id.species)) : V.speciesLabel(id); } /* a pet object: its shown name (cross pets: 'Star-Lord Pigeon') */ // purebreds + hybrids ('Dobo (hybrid)')

  // ================================================================ UI on the LIVE play.html markup (ids/classes from xcpets.fun/play.html)
  var TIER_ID = ['common', 'uncommon', 'rare', 'legendary'], SL = V.slotLabel;
  var cem = false, detailId = null;
  function tierPill(t, p) { if (p && p.resurrected) return '<span class="pill tier tier-god" title="Resurrected pet: shows as God (display only)">' + (V.GOD_LABEL || 'God') + '</span>'; return '<span class="pill tier tier-' + TIER_ID[t] + '">' + TL[t] + '</span>'; } /* resurrected-breed-only: resurrected pets show 'God' (display only) */
  /* toast-tidy-1101 (owner phone screenshot): live-event toasts (the ones with a ▶ Replay link) used to stack down the whole screen on page open
   * (every breed / rise / meal / resurrection seen since the last visit). Now: a burst of event toasts (each within 2 s of the last) collapses into
   * ONE toast: the newest event + '+N more'; repeated meals of the same zombie in the same block are summed into one line. On narrow screens
   * (<= 600 px) only one toast shows at a time, compact at the bottom, event toasts close after 5 s, and a tap on a toast (not on a link) closes it.
   * Callers still find their toast as $('toasts').lastChild. Display only. */
  var TEV = { at: 0, more: 0, meal: null };
  function narrowScreen() { try { return window.matchMedia('(max-width: 600px)').matches; } catch (e) { return false; } }
  function toast(html, ms) { var box = $('toasts'), now = Date.now(), evt = /▶ Replay<\/a>/.test(String(html)), narrow = narrowScreen(), prev = null;
    if (evt) { prev = TEV.el && TEV.el.parentNode === box && now - TEV.at < 2000 ? TEV.el : null;
      var mm = /^🍖 (#\d+[^<]*?) ate (\d+) pets? \(.*?\)\. Hunger full · block ([\d,]+)/.exec(String(html)), merged = false;
      if (prev) { TEV.more++; if (mm && TEV.meal && TEV.meal.who === mm[1] && TEV.meal.block === mm[3]) { TEV.more--; TEV.meal.n += +mm[2]; merged = true; html = '🍖 ' + mm[1] + ' ate ' + TEV.meal.n + ' pets. Hunger full · block ' + mm[3] + String(html).slice(String(html).indexOf(' <a ')); } prev.remove(); } else TEV.more = 0;
      if (mm && !merged) TEV.meal = { who: mm[1], block: mm[3], n: +mm[2] }; else if (!mm) TEV.meal = null;
      if (TEV.more > 0) html += ' <span class="muted small">· +' + TEV.more + ' more event' + (TEV.more === 1 ? '' : 's') + '</span>'; TEV.at = now; }
    if (narrow) { Array.prototype.slice.call(box.children).forEach(function (c) { if (c.classList && c.classList.contains('toast')) c.remove(); }); if (evt) ms = Math.min(ms || 4000, 5000); }
    var t = document.createElement('div'); t.className = 'toast' + (evt ? ' evtoast' : ''); t.innerHTML = html; box.appendChild(t); if (evt) TEV.el = t;
    t.addEventListener('click', function (e) { if (!(e.target && e.target.closest && e.target.closest('a,button'))) t.remove(); });
    setTimeout(function () { t.remove(); }, ms || 4000); }
  function open(id) { $(id).classList.add('on'); } function close(id) { $(id).classList.remove('on'); }
  /* Local discard (any rarity) = live xcpets.fun: no burn, no wallet, hidden in THIS browser per network + address; still on chain; restorable. */
  var NET = (window.LiveEngine && LiveEngine.CFG && LiveEngine.CFG.network) || (M.prod ? 'mainnet' : 'v2demo');
  function hidKey() { return 'xcpets-hidden-' + NET + '-' + (ME || ''); }
  function hiddenIds() { try { return JSON.parse(localStorage.getItem(hidKey()) || '[]'); } catch (e) { return []; } }
  function setHidden(l) { zHidRev++; var seen = new Set(), out = [], i, x; for (i = 0; i < l.length; i++) { x = l[i]; if (seen.has(x)) continue; seen.add(x); out.push(x); } localStorage.setItem(hidKey(), JSON.stringify(out)); }
  function hideLocal(ids) { setHidden(hiddenIds().concat(ids)); var drop = new Set(); for (var i = 0; i < ids.length; i++) { drop.add(ids[i]); drop.add(Number(ids[i])); } S.sel = S.sel.filter(function (x) { return !drop.has(x) && !drop.has(Number(x)); }); save(); render();
    toast('🗑️ Moved ' + ids.length + ' pet' + (ids.length > 1 ? 's' : '') + ' to the Discard pile. ' + (hdLive() ? 'Sign the tiny burn to make it permanent on every device. ' : '') + '<a href="#" class="undo">Undo</a>', 9000);
    var u = $('toasts').lastChild.querySelector('.undo'); if (u) u.onclick = function (e) { e.preventDefault(); hdQueue = hdQueue.filter(function (x) { return ids.indexOf(x) < 0; }); restoreLocal(ids); this.parentNode.remove(); };
    hdLater(ids); }
  /* Discard = permanent (owner Nov 22 2026, 'Permanent only'). The pet hides at once in this browser, then ONE on-chain pet:hd burn is offered
   * for everything discarded in the last moment (1 dander + the Bitcoin fee, however many pets fit the tag). During a hatch or gear review
   * it waits until the review closes, so sorting eggs asks once. Cancelling leaves them browser-only, and the 'Make my browser discards
   * permanent' bar keeps offering it. Nothing is signed without the wallet window. */
  var hdQueue = [], hdTimer = null;
  function hdLive() { return !!(ME && V.hdOn && V.hdPlan && V.hdOn((S.tip || 0) + 1)); }
  function hdLater(ids) { if (!hdLive()) return; ids.forEach(function (id) { id = Number(id); if (hdQueue.indexOf(id) < 0) hdQueue.push(id); }); clearTimeout(hdTimer); hdTimer = setTimeout(hdFlush, 900); }
  function hdFlush() { clearTimeout(hdTimer); if (!hdQueue.length) return; if (rev || ($('packBox') && $('packBox').classList.contains('on'))) return; /* closeReveal flushes */
    var w = world(), ids = hdQueue.filter(function (id) { var p = w.byId[id]; return p && V2Own.isLiving(p, ME) && p.hd !== ME && !isKept(id); }); hdQueue = [];
    if (ids.length) chainDiscardIds(ids, false); }
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
  /* Nov 25 2026 (big wallets): the star list is parsed again only when the stored text changed; isKept is a Set lookup.
     Before, every isKept() parsed the whole list, so a check over 2,000 pets with thousands of stars froze the page. */
  var KC = { raw: null, l: [], s: null };
  function keptRead() { var raw = localStorage.getItem(keepKey()) || '[]'; if (raw !== KC.raw) { var l = JSON.parse(raw); KC = { raw: raw, l: Array.isArray(l) ? l.map(Number) : [], s: null }; } return KC; }
  function keptIds() { try { return keptRead().l.slice(); } catch (e) { return []; } }
  function isKept(id) { try { var k = keptRead(); if (!k.s) k.s = new Set(k.l); return k.s.has(Number(id)); } catch (e) { return false; } }
  function toggleKeep(id) { id = Number(id); var l = keptIds(), i = l.indexOf(id); if (i >= 0) l.splice(i, 1); else l.push(id); try { localStorage.setItem(keepKey(), JSON.stringify(l)); } catch (e) { }
    var on = i < 0; document.querySelectorAll('.keepbtn[data-keep="' + id + '"]').forEach(function (b) { b.textContent = on ? '★' : '☆'; b.setAttribute('aria-pressed', String(on)); b.title = on ? 'Favorite: never discarded. Click to unstar.' : 'Star this pet as a favorite (never discarded)'; });
    toast(on ? '★ #' + id + ' starred: a favorite, never discarded.' : '☆ #' + id + ' unstarred: it can be discarded again.'); try { document.dispatchEvent(new CustomEvent('xcpets-stars')); } catch (e) { }
    if (S.ui_starOnly || $('fSort').value === 'starred' || /\b(starred|kept|favorite)\b/i.test(($('fSearch') || {}).value || '')) setTimeout(render, 0); return on; }
  /* pickIds() = the CHECKED pets you own that are alive, not released and not discarded in this browser. The Rare Room multi-pet roll, Auto-equip,
   * Outfit, the lair 'Acts on' chip and the swipe view act on them (as before starred-acts). starIds stays as an alias for older callers. */
  function pickIds(w) { w = w || world(); if (!ME || !w) return []; var hs = new Set(hiddenIds()); return S.sel.map(Number).filter(function (id) { var p = w.byId[id]; return p && V2Own.isLiving(p, ME) && !hs.has(id); }); }
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
  /* gmoney-god-1102 (display/localStorage only): a pet in this browser's Discard pile that is now a God (resurrected) comes back to My Pets once.
   * Risen zombies eat zombie meals, so 'Discard unfed' used to sweep them; after a Resurrection the God stayed hidden. Once per pet (godBackSeen),
   * so a God the player discards on purpose later stays in the pile. */
  function godUnhide(w) { if (!ME || !w || !w.pets) return; var hid = hiddenIds(); if (!hid.length) return; var sk = 'xcpets-v2-godBackSeen-' + NET + '-' + ME, seen; try { seen = JSON.parse(localStorage.getItem(sk) || '[]'); } catch (e) { seen = []; }
    /* ROOT FIX (Nov 24 2026): risen zombies come back too, every time (discardIds no longer lets one in, so any zombie in the pile was swept
     * there by a bulk discard or discarded in an earlier life). Gods still come back once per pet, so a God discarded on purpose stays. */
    var back = [], zb = []; hid.forEach(function (id) { var p = w.byId[id]; if (!p || p.owner !== ME || p.released) return; if (ZB(p)) zb.push(p.id); else if (p.resurrected && seen.indexOf(p.id) < 0) back.push(p.id); });
    if (!back.length && !zb.length) return; if (back.length) try { localStorage.setItem(sk, JSON.stringify(seen.concat(back))); } catch (e) { }
    var all = back.concat(zb); setHidden(hid.filter(function (id) { return all.indexOf(Number(id)) < 0; }));
    if (back.length) toast('😇 ' + idList(back) + (back.length > 1 ? ' are Gods now and are' : ' is a God now and is') + ' back in My Pets (it was in this browser\u2019s Discard pile from its zombie days).', 10000);
    if (zb.length) toast('🧟 ' + idList(zb) + (zb.length > 1 ? ' are back' : ' is back') + ' in My Pets. Zombies are never discarded: ' + (zb.length > 1 ? 'they were' : 'it was') + ' stuck in this browser\u2019s Discard pile.', 10000); }
  function keepBtn(id) { var on = isKept(id); return '<button type="button" class="keepbtn" data-keep="' + id + '" aria-pressed="' + on + '" aria-label="Favorite #' + id + '" title="' + (on ? 'Favorite: never discarded. Click to unstar.' : 'Star this pet as a favorite (never discarded)') + '">' + (on ? '★' : '☆') + '</button>'; } /* favorite-star-restore: the original ☆/★ button (css .keepbtn) */
  function dropKept(ids) { var k = new Set(keptIds()); return ids.filter(function (id) { return !k.has(Number(id)); }); }
  /* discard-pile 2026-10-21 (restored Oct 29 2026): starred pets are NEVER discarded, on every path (card 🗑️, detail, Discard selected, pack review, #discard-ID). Unstar first. */
  function discardIds(ids) { if (!ids.length) { toast('Tick the box on at least one pet first.'); return; } var kk = [], keep = [], zz = [], wz = world();
    /* ROOT FIX (Nov 24 2026): every discard path (card, pet page, Select all, Hide all Commons, Clear the pile, #discard-ID) ends here, so the
     * zombie rule lives here once instead of in each button: a risen zombie is never discarded (the rules refuse it on chain too). */
    /* Nov 24 2026: the rule itself now lives in js/v2-sac-guard.js (V2SacGuard.never), the one table every pet-removing button uses. */
    if (!window.V2SacGuard || !V2SacGuard.split) return toast('Discard is still loading. Try again in a moment.');
    var sp = V2SacGuard.split('discard', wz, ids, ME); kk = sp.no.starred || []; zz = sp.no.zombie || []; keep = sp.go; ids = keep;
    if (zz.length) toast('🧟 Skipped ' + idList(zz) + ': zombies are never discarded. Feed ' + (zz.length > 1 ? 'them' : 'it') + ' zombie meals, or leave ' + (zz.length > 1 ? 'them' : 'it') + ' hungry and ' + (zz.length > 1 ? 'they turn' : 'it turns') + ' to dust on ' + (zz.length > 1 ? 'their' : 'its') + ' own.', 8000);
    if (kk.length) toast('★ Skipped ' + idList(kk) + ': starred pets are never discarded. Unstar ' + (kk.length > 1 ? 'them' : 'it') + ' first.', 7000); if (ids.length) hideLocal(ids); }
  function hiddenSet() { var a = hiddenIds(), s = new Set(); for (var i = 0; i < a.length; i++) s.add(a[i]); return s; }
  /* On-chain discard (pet:hd) is this owner's flag on the pet. It survives a cache clear.
   * Browser Discard is a separate list. The main profile hides both. */
  /* ROOT FIX (Nov 24 2026, Jake: "why do zombies keep disappearing"): a discard belongs to one life of a pet. A risen zombie can never be
   * discarded (the rules refuse pet:hd for zombies, so it could never be made permanent), so neither flag hides it: an old on-chain
   * discard from before it died, or this browser's pile, where bulk discards (Select all, Hide all Commons) used to sweep zombies for good.
   * inPile() is the ONE answer to 'is this pet in my Discard pile?': My Pets, the pile box and every V2UI.mine() reader use it. */
  function onChainDiscarded(p) { return !!(p && ME && p.hd === ME && !ZB(p)); }
  function inPile(p, h) { return !!p && !ZB(p) && (h.has(p.id) || onChainDiscarded(p)); }
  function mine(w) { var h = hiddenSet(); return w.pets.filter(function (p) { return p.owner === ME && !p.released && !inPile(p, h); }); }
  function sel() { return S.sel.slice(); }
  var commAnim = null;
  // ---------------------------------------------------------------- gear-win notification (single roll, bulk rolls, live/free-token rolls, trophies)
  var WKEY = 'xcpets-v2-seen-' + KEY + '-' + ME;
  var winsLooks = 0; /* wins found on the first look or in the first 2 minutes after page load = they landed while the player was away ("While you were away") */
  function notifyWins(w) {
    /* Nov 22 2026 ("The Great Remembering"): a player's pets and gear arrive in pages. Looking before they are all here made every piece
     * from a later page look new, so a new browser or a cleared cache replayed old gear as 'While you were away'. Wait for the full list,
     * like notifyHatch does. Wallets too big to load in the background keep the old behaviour. */
    if (!hatchListSettled(w) && !(w._pages && (w._pages.n || 0) > ((window.V2Split && V2Split.AUTO_CAP) || 5000))) return [];
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
  function commName(w) { var c = w && w.community; return (c && c.petName) || 'the community pet'; } /* community-roll-tip: the pet's own name on the roll result card */
  function winSource(x, w, logBy) { var p = x.rolledOn != null ? w.byId[x.rolledOn] : null, nm = x.rolledOn != null ? '#' + x.rolledOn + (p ? ' ' + p.name : '') : '', g = w.items[x.gid] || {};
    if (x.community) return { key: 'croll', long: 'Your community gear roll: ' + commName(w) + ' (the community pet) got it and wears it', short: 'Community roll for ' + commName(w) };
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
  function communityName(w) { var c = w.community; return c && c.current === 'groyper' ? 'Groyper, the community pet' : c && c.current === 'rabbit' ? 'the White Rabbit, the community pet' : c && c.current === 'homer' ? 'Homer Pepe, the community pet' : c && c.current === 'funtrump' ? 'FUNTRUMP, the community pet' : c && c.current === 'kek' ? 'Lord Kek, the community pet' : c && c.returned && !w.wizardMythic ? 'the Bitcoin Wizard, the community pet' : 'the community pet'; }
  // ---------------------------------------------------------------- hatch popup = live #packBox review (live game.js showPack/drawPack), gear wins use the same box
  var packY = null, lastHatchN = 0; /* hatch-exit 2026-10-21: scroll spot when the results opened + size of the last hatch (for 🥚 Hatch more) */
  var HKEY = 'xcpets-v2-hatched-' + KEY + '-' + ME, revealQ = [], rev = null, REV_PAGE = 36, TIERS = (window.PetCore && PetCore.TIERS) || [{ label: 'Common' }, { label: 'Uncommon' }, { label: 'Rare' }, { label: 'Legendary' }];
  /* hatchloop-fix-1104: the seen-hatch list used to be saved as one 'tx:pos' key per pet (~73 chars each, 1.3M chars for an 18k-pet wallet).
   * Big wallets filled localStorage (5M quota), the save failed silently, and every render re-queued the same eggs -> the hatch animation
   * played over and over. Now: (1) saved compact as {v:2, t:{tx:'1-1000,1003'}} (same keys, ranges per hatch tx, ~1/20 the size; old saves
   * still read); (2) the last seen set is also kept in memory, so a failed save can never re-queue a hatch in the same page. Display only:
   * V.newHatches gets exactly the same key object it always did. */
  var hMem = null;
  /* hatch-replay-1114: the published world paints one owner page, then the rest.
   * A missing seen-list (a cache clear) used to baseline only that first page and then
   * open a sort screen for every older hatch. Pets already in this published tip are
   * not a new hatch. A saved baseline still announces hatches that landed after it.
   * Display only. newHatches is unchanged. Nothing is signed. */
  function hatchListSettled(w) {
    if (!w || w.pending) return false;
    var pg = w._pages;
    if (pg && !w._full && (pg.got || 1) < (pg.pages || 1)) return false;
    return true;
  }
  function hatchKeepGroups(groups, tip, haveBaseline) {
    if (haveBaseline) return groups || [];
    var out = [], i, g, eggs, j, p;
    for (i = 0; i < (groups || []).length; i++) {
      g = groups[i]; eggs = [];
      for (j = 0; j < (g.eggs || []).length; j++) { p = g.eggs[j]; if ((p.hatchBlock || 0) > tip) eggs.push(p); }
      if (eggs.length) out.push({ tx: g.tx, eggs: eggs, n: eggs.length });
    }
    return out;
  }
  var hatchTip = null;
  /* /hatch-replay-1114 */
  function hPack(s) { var t = {}; Object.keys(s).forEach(function (k) { var i = k.lastIndexOf(':'), n = Number(k.slice(i + 1)); if (i < 1 || !(n > 0) || n % 1) { (t['!'] = t['!'] || []).push(k); return; } (t[k.slice(0, i)] = t[k.slice(0, i)] || []).push(n); });
    Object.keys(t).forEach(function (tx) { if (tx === '!') return; var a = t[tx].sort(function (x, y) { return x - y; }), out = [], lo = a[0], hi = a[0];
      for (var j = 1; j <= a.length; j++) { if (j < a.length && a[j] === hi + 1) { hi = a[j]; continue; } out.push(lo === hi ? String(lo) : lo + '-' + hi); if (j < a.length) lo = hi = a[j]; } t[tx] = out.join(','); });
    var o = { v: 2, t: t }; if (hatchTip != null) o.tip = hatchTip; return o; }
  function hUnpack(o) { if (!o || typeof o !== 'object') return null; if (o.v !== 2 || !o.t) return o; var s = {};
    Object.keys(o.t).forEach(function (tx) { if (tx === '!') { (o.t[tx] || []).forEach(function (k) { s[k] = 1; }); return; }
      String(o.t[tx]).split(',').forEach(function (r) { var m = r.split('-'), lo = Number(m[0]), hi = m.length > 1 ? Number(m[1]) : lo; for (var n = lo; n <= hi; n++) s[tx + ':' + n] = 1; }); });
    return s; }
  function notifyHatch(w) { dataSeen();
    if (!ME || !w || !w.pets) return [];
    var raw = null; try { raw = JSON.parse(localStorage.getItem(HKEY)); } catch (e) { }
    var persisted = hUnpack(raw);
    var hasKeys = !!(persisted && Object.keys(persisted).length);
    var savedTip = raw && raw.v === 2 && raw.tip != null ? Number(raw.tip) : null;
    var seen = persisted ? Object.assign({}, persisted) : null;
    if (hMem) seen = Object.assign(seen || {}, hMem);
    if (hatchTip == null) hatchTip = savedTip != null ? savedTip : (w.tip || 0);
    var settled = hatchListSettled(w);
    /* hatch-tray-1124 (owner Nov 24 2026: one Shock Box opened as three pop-ups, 47 then 353 then 600, and 'the animation just popping up is annoying').
     * A big wallet arrives in owner pages, and each page used to open its own review. Now nothing is counted until the list has settled
     * (90 s safety cap, then the old way), so one hatch = one review. Display only: same newHatches keys, nothing signed. */
    if (!settled) { if (!hDefer0) hDefer0 = Date.now(); if (Date.now() - hDefer0 < HDEFER_MS) return []; }
    /* box-reveal-1124: past the cap (HDEFER_MS) the list counts as settled for 'live vs away' too. Before, a wallet whose pages were still loading
     * never set hSessTip, so every hatch (even one you watched land) went quietly into the tray. */
    var counted = settled || !!hDefer0;
    var r = V.newHatches(w, ME, seen); hMem = r.seen;
    if (hasKeys || settled) { try { localStorage.setItem(HKEY, JSON.stringify(hPack(r.seen))); } catch (e) { } }
    var groups = hatchKeepGroups(r.groups, hatchTip, hasKeys);
    if (hSessTip == null && counted) hSessTip = w.tip || 0;
    /* box-reveal-1124 (GMONEY via owner Nov 24 2026: 'the egg boxes dont pop up to preview like before'; owner: 'I didnt want to lose that popup.
     * It just need to be better'). A box hatches a block or more after you burn it, so most boxes land 'while you were away' and the tray pill
     * hid them. Away eggs open the box reveal again (one pop-up per load: every away batch merges into one), without the egg-crack animation;
     * 'Later' on the reveal puts them in the pill. Eggs that hatch while you watch still get the egg-crack moment first. Display only. */
    var away = [], live = [];
    groups.forEach(function (g) { g.eggs.forEach(function (p) { ((hSessTip == null || (p.hatchBlock || 0) <= hSessTip) ? away : live).push(p.id); }); });
    uAdd(away.concat(live)); /* unopened-1125: kept until the review is closed, so a reveal that never opens is never lost */
    if (away.length) { var qa = null; for (var ia = 0; ia < revealQ.length; ia++) if (revealQ[ia].kind === 'eggs' && revealQ[ia].away) { qa = revealQ[ia]; break; }
      if (rev && rev.kind === 'eggs' && rev.away && $('packBox').classList.contains('on')) { away = away.filter(function (id) { return rev.eggs.indexOf(id) < 0; }); if (away.length) { rev.eggs = rev.eggs.concat(away); rev.n0 = (rev.n0 || 0) + away.length; rev.luck = null; rev.best = null; drawReveal(); } }
      else if (qa) away.forEach(function (id) { if (qa.eggs.indexOf(id) < 0) qa.eggs.push(id); });
      else revealQ.push({ kind: 'eggs', eggs: away, away: 1, hatchAnim: 1 });
      if (tray) { tray.eggs = tray.eggs.filter(function (id) { return away.indexOf(id) < 0; }); trayDraw(); } }
    if (live.length) { var q = null; for (var i = revealQ.length - 1; i >= 0; i--) if (revealQ[i].kind === 'eggs' && !revealQ[i].tray) { q = revealQ[i]; break; }
      if (rev && rev.kind === 'eggs' && !rev.tray && $('packBox').classList.contains('on')) { rev.eggs = rev.eggs.concat(live); rev.n0 = (rev.n0 || 0) + live.length; rev.luck = null; rev.best = null; drawReveal(); }
      else if (q) q.eggs = q.eggs.concat(live); else revealQ.push({ kind: 'eggs', eggs: live }); }
    if (counted) uRestore(w);
    return groups;
  }
  /* box-reveal-1124: 25 s (was 90 s). A big wallet (GMONEY, ~31k pets) took about a minute to settle, so the reveal came late. Pages load newest
   * first, so a new box is on the first pages, and eggs from a later page now merge into the open reveal instead of opening a second one. */
  var hDefer0 = 0, hSessTip = null, tray = null, HDEFER_MS = 25000;
  /* hatch-tray-1124: the calm 'new pets' pill. One per page, merges every away batch, shows the best finds so you know if it's worth a look. */
  function hatchFinds(w, ids) { var out = { n: 0, leg: 0, weird: 0, special: 0 };
    ids.forEach(function (id) { var x = w.byId[id]; if (!x) return; out.n++; if (!x.art) return; if (x.art.tierIndex >= 3) out.leg++; var k = null; try { k = revStar(x); } catch (e) { }
      if (k === 'weird') out.weird++; else if (k) out.special++; });
    return out; }
  /* unopened-1125 (Jake, Nov 25 2026: 3 Shock Boxes in one block, no pop-up, 'what if a player misses the popup', 'I've never seen the pill').
   * Hatches used to be remembered as seen the moment they were found, before anyone saw them, so a reveal that never opened (a crash, a
   * closed tab, a reload during the egg animation) lost them for good. Now every new egg also goes in an 'unopened' list in this browser
   * until its review is closed with Done / Keep all / Discard, or the pill's ✕. Later keeps it. On every load the unopened eggs come back
   * as the pill, so a missed pop-up is never lost. Display only: nothing is signed, discarded or changed in the game. */
  var UKEY = 'xcpets-v2-unopened-' + KEY + '-' + ME, U_MAX = 60000;
  function uRead() { try { var o = JSON.parse(localStorage.getItem(UKEY) || 'null'); if (!o || !o.r) return []; var out = [];
      String(o.r).split(',').forEach(function (r) { if (!r) return; var m = r.split('-'), lo = Number(m[0]), hi = m.length > 1 ? Number(m[1]) : lo; if (!(lo > 0) || !(hi >= lo) || hi - lo > U_MAX) return; for (var n = lo; n <= hi; n++) out.push(n); });
      return out; } catch (e) { return []; } }
  function uWrite(ids) { try { if (!ids.length) { localStorage.removeItem(UKEY); return; } var a = ids.map(Number).filter(function (n) { return n > 0; }).sort(function (x, y) { return x - y; }), out = [], lo = a[0], hi = a[0];
      if (a.length > U_MAX) a = a.slice(a.length - U_MAX);
      for (var j = 1; j <= a.length; j++) { if (j < a.length && a[j] <= hi + 1) { hi = Math.max(hi, a[j]); continue; } out.push(lo === hi ? String(lo) : lo + '-' + hi); if (j < a.length) lo = hi = a[j]; }
      localStorage.setItem(UKEY, JSON.stringify({ v: 1, r: out.join(','), at: Date.now() })); } catch (e) { } }
  function uAdd(ids) { if (!ME || !ids || !ids.length) return; var cur = uRead(), s = new Set(cur), n0 = cur.length; ids.forEach(function (id) { id = Number(id); if (!s.has(id)) { s.add(id); cur.push(id); } }); if (cur.length !== n0) uWrite(cur); }
  function uDel(ids) { if (!ME || !ids || !ids.length) return; var cur = uRead(); if (!cur.length) return; var d = new Set(ids.map(Number)), left = cur.filter(function (id) { return !d.has(id); }); if (left.length !== cur.length) uWrite(left); }
  /* On a settled list: unopened eggs that are still yours, alive and not discarded, and not already queued or open, go to the pill. */
  /* Runs on every settled look (cheap: a short range string). A pet this page has not loaded yet (a published world from before the hatch)
   * stays in the list and comes back once it arrives; a pet that is gone, moved or discarded leaves the list. */
  function uRestore(w) { if (!ME || !w || !w.byId) return; var cur = uRead(); if (!cur.length) return;
    var busy = new Set(); revealQ.forEach(function (q) { (q.eggs || []).forEach(function (id) { busy.add(id); }); }); if (rev && rev.eggs) rev.eggs.forEach(function (id) { busy.add(id); }); if (tray) tray.eggs.forEach(function (id) { busy.add(id); });
    var h = hiddenSet(), keep = [], back = [];
    cur.forEach(function (id) { var p = w.byId[id]; if (!p) { keep.push(id); return; } if (p.owner !== ME || p.dead || p.released || inPile(p, h)) return; keep.push(id); if (!busy.has(id) && p.art) back.push(id); });
    if (keep.length !== cur.length) uWrite(keep); if (back.length) trayAdd(back); }
  function trayAdd(ids) { if (!tray) tray = { eggs: [] }; var s = new Set(tray.eggs); ids.forEach(function (id) { if (!s.has(id)) { s.add(id); tray.eggs.push(id); } }); trayDraw(); }
  function trayDraw() { var el = $('hatchTray');
    if (!tray || !tray.eggs.length) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'hatchTray'; el.className = 'htray'; el.setAttribute('role', 'status'); document.body.appendChild(el);
      el.addEventListener('click', function (e) { if (e.target.closest('.htx')) { if (tray) uDel(tray.eggs); tray = null; trayDraw(); return; } if (e.target.closest('.htgo')) trayOpen(); }); }
    var f = hatchFinds(world(), tray.eggs), n = f.n || tray.eggs.length, bits = [];
    if (f.weird) bits.push('<b class="htw">🌀 ' + f.weird + ' weird</b>'); if (f.special) bits.push('<b class="hts">✨ ' + f.special + ' special</b>'); if (f.leg) bits.push('<b class="htl">🏆 ' + f.leg.toLocaleString('en-US') + ' Legendary</b>');
    el.innerHTML = '<button type="button" class="htgo" title="See your new pets"><span class="hticon" aria-hidden="true">🥚</span><span class="httxt"><span class="htn">' + n.toLocaleString('en-US') + ' new pet' + (n === 1 ? '' : 's') + ' hatched</span>' +
      (bits.length ? '<span class="htbits">' + bits.join(' ') + '</span>' : '') + '</span><span class="htcta">Open ›</span></button><button type="button" class="htx" aria-label="Hide this (your pets stay)" title="Hide this (your pets stay in My Pets)">✕</button>';
    el.classList.toggle('htgold', !!(f.weird || f.special)); }
  function trayOpen() { if (!tray) return; var ids = tray.eggs; tray = null; trayDraw(); if (rev && $('packBox').classList.contains('on')) closeReveal();
    revealQ.unshift({ kind: 'eggs', eggs: ids, all: ids.slice(), tray: 1, hatchAnim: 1, away: 1 }); released = true; nextReveal(); }
  var wspinOn = false; /* wheel-spin-anim: the 8-bit Pepe Wheel reveal (js/v2-wheel-anim.js) plays once before a gear batch that came from a wheel spin. Display only. */
  /* box-reveal-1124: never open on top of another pop-up (a community pet's arrival, a pixel scene, a burn confirm); try again when it closes */
  var otherT = 0;
  /* playtest Nov 25 2026: the 'while you were away' box reveal opened a few seconds after load, often in the middle of Select all ->
   * Discard selected, and covered the bar (the discard never asked). It also waits while the player is picking pets. */
  function picking() { var b = document.body; return !!(b && (b.classList.contains('selmode') || b.classList.contains('mpc-sel'))); }
  /* playtest Nov 25 2026: only a sheet the player can SEE holds the reveal. In the Rare Room calm mode (js/v2-lair-calm.js) an incoming
   * request (#inReqBox) stays .on but hidden (it waits in the away chip), and the new eggs never opened: no reveal, no pill. */
  function shown(e) { return !!(e.offsetWidth || e.offsetHeight); }
  function otherUp() { return [].some.call(document.querySelectorAll('.reveal.on:not(#packBox)'), shown) || picking() || !!(window.V2LifeAnim && V2LifeAnim.busy && V2LifeAnim.busy()); }
  /* playtest-1125: an egg with no art (a fast page that picked the hatch up after the published world) made the box reveal throw on
   * x.art.tierIndex inside the egg-crack callback, so the reveal never opened. Ask for the art once; eggs still without it skip the review. */
  function revNeedsArt() { var q = revealQ[0], w = world(); if (!q || q.kind !== 'eggs' || !w || !w.byId) return false;
    var miss = q.eggs.filter(function (id) { var x = w.byId[id]; return x && !x.art; }); if (!miss.length) return false;
    if (!q.artAsked && window.V2Split && V2Split.dress) { q.artAsked = 1; V2Split.dress(miss).then(function () { nextReveal(); }, function () { nextReveal(); }); return true; }
    q.eggs = q.eggs.filter(function (id) { var x = w.byId[id]; return !x || x.art; }); if (!q.eggs.length) { revealQ.shift(); setTimeout(nextReveal, 0); return true; } return false; }
  function nextReveal() { if (wspinOn || $('packBox').classList.contains('on') || !revealQ.length) return; if (otherUp()) { if (!otherT) otherT = setTimeout(function () { otherT = 0; nextReveal(); }, 1500); return; } if (holding()) { heldR = true; awayPing(); if (!holdT) holdT = setTimeout(function () { holdT = 0; nextReveal(); }, Math.max(50, 8050 - (Date.now() - firstDataT))); return; } /* box-reveal-1124: the 8 s hold used to end only at the next repaint (about a minute later), so the reveal came late */ if (revNeedsArt()) return; rev = revealQ.shift(); rev.page = 0; rev.sel = {}; if (rev.kind === 'eggs' && rev.sort == null && rev.eggs.length > 1) rev.sort = 'rar'; if (rev.kind === 'eggs') { if (!rev.all) rev.all = rev.eggs.slice(); revReady(rev); if (!rev.eggs.length) { rev = null; return nextReveal(); } rev.n0 = rev.eggs.length; rev.gone = 0; if (rev.intro == null) rev.intro = rev.eggs.length >= INTRO_MIN; } /* box-reveal-1124: 7+ eggs open on the box reveal first */ /* pet-flow-smoother: a hatch review opens Rarest first (Legendaries on page 1); the Sort menu still offers Hatch order */ if (packY == null) packY = window.scrollY || 0; if (rev.kind === 'eggs') lastHatchN = rev.eggs.length;
    var WA = window.V2WheelAnim, ws = null; if (rev.kind === 'gear' && WA) try { ws = WA.fromWins(rev.wins, world(), communityName(world())); } catch (e) { ws = null; }
    var paid = rev.kind === 'gear' && !rev.gearAnim && !lifeReduced() && (rev.wins || []).some(function (x) { return x && x.src === 'roll'; }); /* pixel-anims batch 4: a paid gear roll's piece lands on the pet (js/v2-life-anim.js gearRoll, lazy) after the wheel */
    var openG = function (r2) { if (paid && !r2.gearAnim) { r2.gearAnim = 1; wspinOn = true; withLife(function (ok) { var go2 = function () { wspinOn = false; if (rev !== r2) return; drawReveal(); open('packBox'); }; if (!ok || !window.V2LifeAnim || !V2LifeAnim.gearRoll) return go2(); try { V2LifeAnim.gearRoll(world(), r2.wins, ME, go2); } catch (e) { go2(); } }); return; } drawReveal(); open('packBox'); };
    if (ws) { wspinOn = true; var r0 = rev; WA.reveal(ws, function () { wspinOn = false; if (rev !== r0) return; openG(r0); }); return; }
    if (paid) return openG(rev);
    if (rev.kind === 'eggs' && !rev.hatchAnim && !lifeReduced()) { rev.hatchAnim = 1; wspinOn = true; var r1 = rev, go = function () { wspinOn = false; if (rev !== r1) return; drawReveal(); open('packBox'); }; /* pixel-anims: the eggs crack open first (js/v2-life-anim.js, lazy) */
      withLife(function (ok) { if (!ok || !window.V2LifeAnim) return go(); try { V2LifeAnim.hatch(world(), r1.eggs, go); } catch (e) { go(); } }); return; }
    drawReveal(); open('packBox'); }
  /* share-links: the real hatch review, for a preview (?moment=hatch&pet=ID). Display only. Sabo #1765 is left out. */
  window.V2RevealPreview = function (ids) { ids = (ids || []).map(Number).filter(function (n) { return n >= 1 && n !== 1765; }); if (!ids.length || !$('packBox')) return; revealQ.push({ kind: 'eggs', eggs: ids }); nextReveal(); };
  /* egg-review-sort 2026-10-24: the sort options and logic now live in js/pet-sort.js (PetSort), shared with Gooby's Hotel mate search. */
  function sortEggs(w, list, k) { return window.PetSort ? PetSort.sort(w, list, k) : list; }
  /* hatch-review-simple 2026-10-28 (owner 1:28 AM CT: 'I dont like ticked duds. we need better wording. make this all very simple to do and sort through').
   * Replaces the Dud Duster wording and controls. UI only: hiding = the SAME free local Discard (hidden in this browser, Undo, restorable from the
   * Discard pile). No burn, no wallet, no chain rule touched, replay unchanged. Protected pets (Legendary, Mythic, wearing gear, starred) are never
   * picked by Keep Rare and up or Select all, and need an extra confirm to select by hand; starred pets can't be hidden at all (restored Oct 29 2026). */
  function dudGuard(w, p) { var r = []; if (p.art && p.art.tierIndex >= 3) r.push(TIERS[p.art.tierIndex].label); if (p.stage === 5) r.push('Mythic');
    var n = R.worn ? R.worn(w, p.id).length : 0; if (n) r.push('wearing ' + n + ' gear piece' + (n > 1 ? 's' : '')); if (isKept(p.id)) r.push('starred'); return r; }
  var REV_SHOW = [['all', 'All'], ['wx', '🌀 Weird &amp; special'], ['my', 'Mythic'], ['3', 'Legendary'], ['2', 'Rare'], ['1', 'Uncommon'], ['0', 'Common']];
  function revShows(f, x) { return f === 'all' || !f || (f === 'wx' ? !!revStar(x) : f === 'my' ? x.stage === 5 : f === 'sel' ? !!revPick()[x.id] : String(x.art.tierIndex) === f); }
  /* hatch-tray-1124 (owner: 'Id like to see if I hatched any weird pets'). DISPLAY ONLY. 'weird' = a weird hatch (tiny, giant, two-headed, ghost...),
   * 'special' = a Legend egg or a special species (the 1 in 777 egg: Homer, the White Rabbit, FUNTRUMP...). Ordinary species and hybrids are neither. */
  var REV_PLAIN = { pepe: 1, wojak: 1, chud: 1, bobo: 1, mumu: 1, snibby: 1, dodo: 1, kevin: 1, peepo: 1, sarutobi: 1, doge: 1, lenny: 1, chad: 1 };
  function revStar(x) { if (!x) return null; var RI = window.V2Render && V2Render.rareInfo, i = RI ? RI(x) : null; if (i) return i.weird ? 'weird' : 'special';
    if (x.hybrid || (x.art && x.art.hybrid) || (V.isHybrid && V.isHybrid(x.species))) return null; return x.species && !REV_PLAIN[x.species] ? 'special' : null; }
  function revStarLabel(x) { var RI = window.V2Render && V2Render.rareInfo, i = RI ? RI(x) : null; if (i) return i.icon + ' ' + (i.weird ? i.name.toUpperCase() : i.banner);
    return '✨ ' + String(V.petSpeciesLabel ? V.petSpeciesLabel(x) : x.species).toUpperCase() + '!'; }
  function revOneIn(w, x) { var r = window.PetScore && PetScore.peek ? PetScore.peek(w, x) : null; return r && r.rarityOneIn ? r.rarityOneIn : 0; }
  /* Best finds: every weird / special pet first, then the rarest-looking Legendaries, up to 6. */
  function revBest(w, all) { var st = [], rest = [];
    all.forEach(function (x) { var k = revStar(x); if (k) st.push(x); else if (x.art && x.art.tierIndex >= 2) rest.push(x); });
    st.sort(function (a, b) { return (revStar(a) === 'weird' ? 0 : 1) - (revStar(b) === 'weird' ? 0 : 1) || b.art.tierIndex - a.art.tierIndex; });
    if (st.length < 6) { rest.forEach(function (x) { x._oneIn = revOneIn(w, x); }); rest.sort(function (a, b) { return b.art.tierIndex - a.art.tierIndex || b._oneIn - a._oneIn; }); st = st.concat(rest.slice(0, 6 - st.length)); }
    return st.slice(0, Math.max(6, st.length)).slice(0, 12); }
  /* Shock Box luck line: the box's real tier odds (V2Rules.ELECTRIC_TIER_10K) next to what you got, so a dry box reads as luck, not a bug. */
  function revEl(x) { return !!(x && (x.electric || (x.art && x.art.electric))); }
  function revLuck(w, all) { var nEl = all.filter(revEl).length; if (nEl < 100) return '';
    var T = V.ELECTRIC_TIER_10K || [3000, 4000, 2200, 800], leg = all.filter(function (x) { return revEl(x) && x.art.tierIndex >= 3; }).length, ex = Math.round(nEl * T[3] / 10000), odd = all.filter(function (x) { return revEl(x) && revStar(x); }).length, exO = nEl * (1 / 777 + (V.RARE_BUCKETS && V.RARE_D ? V.RARE_BUCKETS.reduce(function (a, b) { return a + b[1]; }, 0) / V.RARE_D : 1 / 330));
    var face = leg >= ex * 1.1 ? '🍀 lucky box!' : leg <= ex * 0.85 ? '😤 a bit dry' : '👌 right on average';
    return '<div class="pkluck small" title="Shock Box odds per egg: Legendary ' + T[3] / 100 + '% · Rare ' + T[2] / 100 + '% · Uncommon ' + T[1] / 100 + '% · Common ' + T[0] / 100 + '%. Plus a 1 in 777 special egg, about 1 in 776 weird hatches and rare Legend eggs.">⚡ Shock Box luck: <b>' + leg.toLocaleString('en-US') + ' Legendary</b> (average ' + ex.toLocaleString('en-US') + ') · <b>' + odd + ' weird or special</b> (average ' + exO.toFixed(1) + ') · ' + face + '</div>'; }
  /* hatch-species-filter 2026-10-30 (owner 9:35 PM CT [pt2372u]: 'not a to z but just show particular species'). DISPLAY ONLY: a Species dropdown
   * in the hatch review shows only one species (or Hybrids). It combines with the rarity Show chips (each side counts within the other), Select all shown and paging. */
  function revSp(x) { return (x.hybrid || (x.art && x.art.hybrid) || (V.isHybrid && V.isHybrid(x.species))) ? 'hybrid' : x.species; }
  function revSpName(k) { return k === 'hybrid' ? 'Hybrids' : k === 'kevin' ? 'Kevin' : (V.speciesLabel ? V.speciesLabel(k) : k); }
  function revSpShows(k, x) { return !k || k === 'all' || revSp(x) === k; }
  function plural(n, a) { return n.toLocaleString('en-US') + ' ' + a + (n === 1 ? '' : 's'); }
  function revHide(ids, msg) { /* one confirm, then the usual free local discard; the review keeps going with what is left */
    var kk = ids.filter(isKept), go = ids.length - kk.length; if (!go) { toast('★ Starred pets can\'t be discarded. Unstar them first.', 6000); return; }
    if (!window.confirm(msg + (kk.length ? '\n\n★ ' + kk.length + ' starred pet' + (kk.length > 1 ? 's stay' : ' stays') + ' (starred pets are never discarded).' : '') + '\n\nThey go to the 🗑️ Discard pile in My Pets. When you close this review you can make it permanent on every device with one tiny burn (1 dander).')) return;
    hideIds(ids); ids = ids.filter(function (id) { return kk.indexOf(id) < 0; }); /* starred pets stay in the review too */ rev.gone = (rev.gone || 0) + go; rev.eggs = rev.eggs.filter(function (id) { return ids.indexOf(id) < 0; }); ids.forEach(function (id) { delete rev.sel[id]; if (rev.keep) delete rev.keep[id]; });
    if (rev.f !== 'all' && rev.f !== 'sel') { var w = world(); if (!rev.eggs.some(function (id) { var x = w.byId[id]; return x && revShows(rev.f, x) && revSpShows(rev.sp, x); })) rev.f = 'all'; }
    if (rev.sp && rev.sp !== 'all') { var w2 = world(); if (!rev.eggs.some(function (id) { var x = w2.byId[id]; return x && revSpShows(rev.sp, x); })) rev.sp = 'all'; }
    if (rev.eggs.length) drawReveal(); else closeReveal(); }
  /* hide-all-1103 (owner [pt2745u] 'a discard all even legendary would be helpful'). DISPLAY ONLY: top 3 = Hide all, Legendary included. Starred, Mythic
   * and gear-wearing pets stay protected (revGuard drops only the Legendary reason for top 3); hiding is the same free local Discard pile, Restore undoes it. */
  function revGuard(w, x, top) { return top >= 3 ? x.stage === 5 || isKept(x.id) || !!(R.worn && R.worn(w, x.id).length) : dudGuard(w, x).length > 0; }
  function revKeepTier(w, all, top) { /* top 1 = Keep Rare & Legendary (hides Common + Uncommon), top 2 = Keep Legendary only (also hides Rare), top 3 = Hide all */
    var ids = all.filter(function (x) { return x.art.tierIndex <= top && !revGuard(w, x, top); }).map(function (x) { return x.id; });
    var st = revSafeNote(w, all, top), nL = top >= 3 ? all.filter(function (x) { return x.art.tierIndex >= 3 && !revGuard(w, x, 3); }).length : 0;
    revHide(ids, (top === 1 ? 'Keep Rare & Legendary?\n\nThis discards ' + plural(ids.length, 'Common and Uncommon pet') : top === 2 ? 'Keep Legendary only?\n\nThis discards ' + plural(ids.length, 'Common, Uncommon and Rare pet') :
      'Discard all?\n\nThis discards ' + plural(ids.length, 'pet') + ' from this hatch' + (nL ? '. Legendary pets will be discarded too (' + nL.toLocaleString('en-US') + ')' : '')) + '.' + (st ? ' ' + st + '.' : '')); }
  function revKeepN(w, all, top) { return all.filter(function (x) { return x.art.tierIndex <= top && !revGuard(w, x, top); }).length; }
  /* hatch-review-tiers-1103 (owner [pt2741u] 'you dont hatch these sorts of pets'). DISPLAY ONLY. Eggs hatch only Common/Uncommon/Rare/Legendary
   * (Mythic is a feeding stage; a new pet has no gear and is never auto-starred because it was never fed), so the old fixed line
   * 'Mythic, starred and gear-wearing pets always stay.' described pets a hatch never makes. dudGuard still protects them (a late review can
   * hold fed, starred or geared pets); the note now names only the protected pets that are really in the tiers the buttons would hide. */
  function revSafeNote(w, all, top) { var my = 0, sk = 0, gr = 0;
    all.forEach(function (x) { if (x.art.tierIndex > top) return; if (isKept(x.id)) sk++; else if (x.stage === 5) my++; else if (R.worn && R.worn(w, x.id).length) gr++; });
    var bits = []; if (sk) bits.push(plural(sk, 'starred pet')); if (gr) bits.push(plural(gr, 'pet') + ' wearing gear'); if (my) bits.push(plural(my, 'Mythic'));
    return bits.length ? 'These stay too: ' + bits.join(', ') : ''; }
  /* keep-pick (Jake Nov 26 2026: 'it would be easier to select what to keep instead of discard'). DISPLAY ONLY until Done, same as before.
   * Two tap modes in the hatch review, the player's choice remembered in this browser (default Keep):
   *   ✅ Keep:    tap the pets you want to KEEP (rev.keep); 'Keep N · Discard the rest (M)' discards every other pet of this hatch, on every page and
   *               behind every filter. Protected pets (Legendary, Mythic, wearing gear, starred: dudGuard) are always kept, as with Keep Rare & Legendary.
   *   🗑️ Discard: the old way, tap the pets to discard (rev.sel), Discard selected (N).
   * Both end in the same revHide -> discardIds -> Done -> one pet:hd burn whose plan names the pets (sendBlock's pickSendWhy check), so the
   * before-signing check is the same for both. A hatch of one pet keeps the old Discard mode. */
  var REV_MODE_KEY = 'xcpets-v2-revmode';
  function revModePref() { try { return localStorage.getItem(REV_MODE_KEY) === 'discard' ? 'discard' : 'keep'; } catch (e) { return 'keep'; } }
  function revMode() { if (!rev || rev.kind !== 'eggs') return 'discard'; if (!rev.mode) rev.mode = revModePref(); return (rev.n0 || rev.eggs.length) > 1 ? rev.mode : 'discard'; }
  function revPick() { if (!rev) return {}; if (revMode() === 'keep') return rev.keep || (rev.keep = {}); return rev.sel; }
  /* what 'Discard the rest' would discard right now: every pet of this review that is not picked to keep and not protected */
  function revRest(w) { var r = { ids: [], kept: 0, prot: 0, why: {}, tiers: [0, 0, 0, 0] }, k = rev.keep || {};
    rev.eggs.forEach(function (id) { var x = w.byId[id]; if (!x) return; if (k[id]) { r.kept++; return; } var gc = rev._g || (rev._g = {}), g = gc[id] || (gc[id] = revKG(w, x)); if (g.length) { r.prot++; g.forEach(function (q) { q = /^wearing/.test(q) ? 'wearing gear' : q; r.why[q] = (r.why[q] || 0) + 1; }); return; }
      r.ids.push(id); if (x.art) r.tiers[x.art.tierIndex]++; });
    return r; }
  /* in Keep mode a weird or special find is always kept too, so 'Discard the rest' never sweeps a 1 in 777 pet away by accident */
  function revKG(w, x) { var g = dudGuard(w, x); return revStar(x) ? g.concat([revStar(x) === 'weird' ? 'weird' : 'special']) : g; }
  function revWhy(r) { return Object.keys(r.why).map(function (q) { return r.why[q].toLocaleString('en-US') + ' ' + q; }).join(', '); }
  function revSelectShown(w, shown) { var n = 0, safe = 0, pk = revPick(), keep = revMode() === 'keep'; shown.forEach(function (x) { if ((keep ? revKG : dudGuard)(w, x).length) { safe++; return; } if (!pk[x.id]) n++; pk[x.id] = 1; });
    drawReveal(); toast(keep ? '✅ Keeping ' + plural(n, 'more pet') + ' (' + Object.keys(pk).length.toLocaleString('en-US') + ' picked).' + (safe ? ' 🛡️ ' + plural(safe, 'protected pet') + ' are kept anyway.' : '')
      : '✓ Selected ' + plural(n, 'more pet') + ' (' + Object.keys(pk).length.toLocaleString('en-US') + ' selected).' + (safe ? ' 🛡️ ' + plural(safe, 'protected pet') + ' left out.' : ''), 5000); }
  function revToggle(w, x, d) { var pk = revPick(), on = !pk[x.id];
    if (revMode() === 'keep') { var kg = revKG(w, x); if (kg.length) { toast('🛡️ #' + x.id + ' is always kept (' + kg.join(', ') + '). Nothing to do.', 5000); return; }
      if (on) pk[x.id] = 1; else delete pk[x.id]; d.classList.toggle('picked', on); d.setAttribute('aria-checked', String(on)); revCount(); return; }
    if (on && isKept(x.id)) { toast('★ #' + x.id + ' is starred, so it can\'t be discarded. Unstar it first.', 6000); return; }
    if (on) { var gg = dudGuard(w, x); if (gg.length && !window.confirm('Select #' + x.id + ' to discard? It is ' + gg.join(', ') + '.')) return; pk[x.id] = 1; } else delete pk[x.id];
    d.classList.toggle('picked', on); d.setAttribute('aria-checked', String(on)); revCount(); }
  function revCount() { var pk = revPick(), n = Object.keys(pk).length, b = $('packDiscard'), keep = revMode() === 'keep', r = keep ? revRest(world()) : null;
    if (b) { if (keep) { b.textContent = n ? 'Keep ' + n.toLocaleString('en-US') + ' · Discard the rest (' + r.ids.length.toLocaleString('en-US') + ')' : 'Discard the rest'; b.disabled = !n || !r.ids.length;
        b.title = n ? 'Discards every other pet of this hatch (all pages and filters). Protected pets stay.' : 'Tap the pets you want to keep first'; }
      else { b.textContent = 'Discard selected (' + n.toLocaleString('en-US') + ')'; b.disabled = !n; b.title = ''; } b.classList.toggle('pkrest', keep); }
    var g = $('packGrid'); if (g) g.classList.toggle('pkhaspick', keep && n > 0);
    var pl = $('pkPlan'); if (pl) pl.innerHTML = keep ? (n ? '✅ Keeping <b>' + n.toLocaleString('en-US') + '</b> you picked' + (r.prot ? ' + <b>' + r.prot.toLocaleString('en-US') + '</b> always kept (' + esc(revWhy(r)) + ')' : '') + ' · 🗑️ <b class="pkgo">' + r.ids.length.toLocaleString('en-US') + '</b> will be discarded'
        : 'Tap the pets you want to <b>keep</b>. Then <b>Discard the rest</b> clears out every other pet of this hatch.' + (r.prot ? ' 🛡️ ' + r.prot.toLocaleString('en-US') + ' protected pet' + (r.prot === 1 ? ' is' : 's are') + ' always kept.' : '')) : 'Tap a pet to select it for discarding, then Discard selected.';
    var c = $('pkSelN'); if (c) c.textContent = n.toLocaleString('en-US'); var cl = $('pkClear'); if (cl) cl.hidden = !n; }
  function revSetMode(m) { if (!rev || rev.kind !== 'eggs' || rev.mode === m) return; rev.mode = m; try { localStorage.setItem(REV_MODE_KEY, m); } catch (e) { } if (rev.f === 'sel') rev.f = 'all'; drawReveal();
    toast(m === 'keep' ? '✅ Tap the pets you want to keep.' : '🗑️ Tap the pets you want to discard.', 3500); }
  /* box-reveal-1124: the box reveal. The first screen of a hatch of 7+ eggs: a big meme headline, the rarity tally counting up,
   * the best finds dealt in like cards (weird and special first), the Shock Box luck line, then 'See all' opens the sort & discard review.
   * Fast (about 1.5 s, tap to skip), one screen on a phone, reduced motion = no animation. Display only: nothing is signed or discarded here. */
  var INTRO_MIN = 7, INTRO_CAPS = { weird: ['ser... what did you just hatch?', 'WEIRD FLEX. KEEP IT.', 'this one is not like the others.'], luck: ['MUCH WOW. VERY LUCK.', 'the box loves you, anon.', 'up only.'],
    3: ['WAGMI. legendary pull.', 'GIGABRAIN HATCH.', 'number go up.'], 2: ['wen moon? now.', 'not bad, anon.', 'rare drip, fresh eggs.'], 1: ['it\'s honest work.', 'a little something.', 'gm, new frens.'], 0: ['gm. it\'s something.', 'ser, these are Commons.', 'it\'s honest work.'] };
  var TIER_C = ['#a9b8ad', '#3ddc84', '#5aa9ff', '#ffd166'];
  function drawIntro(w) {
    var all = rev.eggs.map(function (id) { return w.byId[id]; }).filter(Boolean), n = all.length, tiers = [0, 0, 0, 0], nEl = 0;
    all.forEach(function (x) { tiers[x.art.tierIndex]++; if (revEl(x)) nEl++; });
    if (!rev.best) rev.best = revBest(w, all).map(function (id) { return id.id; }); if (rev.luck == null) rev.luck = revLuck(w, all);
    var best = rev.best.map(function (id) { return w.byId[id]; }).filter(Boolean).slice(0, 6), star = best.filter(revStar), wd = all.filter(function (x) { return revStar(x) === 'weird'; }).length, sp = all.filter(revStar).length - wd;
    var nBox = (function () { var t = {}, k = 0; all.forEach(function (x) { if (!revEl(x)) return; var b = String(x.hatchTx || '').replace(/:\d+$/, ''); if (b && !t[b]) { t[b] = 1; k++; } }); return k; })();
    var box = nEl >= 100 && nEl >= n / 2, ex = Math.round(nEl * (V.ELECTRIC_TIER_10K || [3000, 4000, 2200, 800])[3] / 10000);
    var ck = star.length ? 'weird' : box && ex && tiers[3] >= ex * 1.1 ? 'luck' : tiers[3] ? 3 : tiers[2] ? 2 : tiers[1] ? 1 : 0, caps = INTRO_CAPS[ck], cap = caps[(n + tiers[3]) % caps.length];
    $('packTitle').textContent = box ? (nBox > 1 ? '⚡ ' + nBox + ' Shock Boxes opened!' : '⚡ Shock Box opened!') : '🥚 ' + n.toLocaleString('en-US') + ' eggs hatched!';
    var bars = [3, 2, 1, 0].map(function (t) { var c = tiers[t], pc = n ? Math.max(c ? 2 : 0, Math.round(c * 100 / n)) : 0;
      return '<div class="pkibar t' + t + '"><span class="pkil">' + esc(TIERS[t].label) + '</span><span class="pkit"><i data-w="' + pc + '" style="width:0;background:' + TIER_C[t] + '"></i></span><b class="pkic" data-n="' + c + '">0</b></div>'; }).join('');
    var head = star.length ? (wd ? '🌀 ' + wd + ' weird' : '') + (wd && sp ? ' + ' : '') + (sp ? '✨ ' + sp + ' special' : '') + (star.length === 1 && !(wd + sp > 1) ? ' find!' : ' finds!') : '🏆 Your best pulls';
    var cards = best.map(function (x, i) { var k = revStar(x), oi = revOneIn(w, x);
      var kp = isKept(x.id);
      return '<div class="pkic-card t' + x.art.tierIndex + (k ? ' pkb-' + k : '') + '" style="--d:' + i + '"><a class="pkic-open" href="pet.html?id=' + x.id + '" target="_blank" rel="noopener" title="Open #' + x.id + ' in a new tab"><canvas width="32" height="32" data-bid="' + x.id + '"></canvas>' +
        '<span class="pkbtag">' + esc(k ? revStarLabel(x) : TIERS[x.art.tierIndex].label.toUpperCase()) + '</span><span class="pkbname">#' + x.id + ' ' + esc(V.speciesLabel ? V.speciesLabel(x.species) : x.species) + '</span>' + (oi ? '<span class="pkbodd">💎 1 in ' + (window.PetScore && PetScore.fmtN ? PetScore.fmtN(oi) : oi) + '</span>' : '') + '</a>' +
        '<button type="button" class="keepbtn pkistar" data-keep="' + x.id + '" aria-pressed="' + kp + '" title="' + (kp ? 'Favorite: never discarded. Click to unstar.' : 'Star this pet as a favorite (never discarded)') + '">' + (kp ? '★' : '☆') + '</button></div>'; }).join('');
    /* owner Nov 24 2026: 'Make it easy to find and keep the best pets'. One tap stars the best: every weird & special find plus the cards shown. Starred = never discarded. */
    var keepL = all.filter(revStar).concat(best).filter(function (x, i, a) { return a.indexOf(x) === i; }).map(function (x) { return x.id; }), keepN = keepL.filter(function (id) { return !isKept(id); }).length;
    $('packSummary').innerHTML = '<div class="pki' + (rev.introDone || lifeReduced() ? ' pki-done' : '') + '">' +
      '<div class="pkisub">' + (rev.away ? 'While you were away, ' : '') + (rev.away ? 'your ' : 'Your ') + (box ? (nBox > 1 ? nBox + ' boxes' : 'box') : 'eggs') + ' gave you <b>' + n.toLocaleString('en-US') + ' new pet' + (n === 1 ? '' : 's') + '</b></div>' +
      '<div class="pkibars" role="img" aria-label="' + esc([3, 2, 1, 0].map(function (t) { return tiers[t] + ' ' + TIERS[t].label; }).join(', ')) + '">' + bars + '</div>' +
      (cards ? '<div class="pkifinds"><div class="pkbh">' + head + '</div><div class="pkirow">' + cards + '</div></div>' : '') +
      '<div class="pkicap" aria-hidden="true">' + esc(cap) + '</div>' + rev.luck +
      '<div class="pkigo">' + (keepL.length ? '<button type="button" class="btn pkibest" id="pkiStar"' + (keepN ? '' : ' disabled') + ' title="Stars them: starred pets are favorites and are never discarded">' + (keepN ? '⭐ Keep the best (star ' + keepL.length + ')' : '★ Best ' + (keepL.length === 1 ? 'one' : keepL.length) + ' starred') + '</button>' : '') +
        '<button type="button" class="btn pkiall" id="pkiAll">See all ' + n.toLocaleString('en-US') + ' &amp; sort ›</button></div>' +
      '<div class="pkigo pkigo2"><button type="button" class="q" id="pkiKeep" title="Keep every pet. They are already in My Pets.">Done, keep all</button><button type="button" class="q" id="pkiLater" title="Puts a small button at the bottom of the page so you can open this again">Later</button></div></div>';
    $('packSummary').querySelectorAll('canvas[data-bid]').forEach(function (c) { var x = w.byId[+c.getAttribute('data-bid')]; if (!x) return; try { var fr = petFrames(x, w); paint(c, fr[0]); R.animate(c, fr); } catch (e) { } });
    var root = $('packSummary').querySelector('.pki'), t0 = 0, DUR = 700, fin = function () { rev && (rev.introDone = 1); root.classList.add('pki-done');
        root.querySelectorAll('.pkic').forEach(function (b) { b.textContent = (+b.getAttribute('data-n')).toLocaleString('en-US'); }); };
    root.querySelectorAll('.pkit i').forEach(function (b) { b.style.width = root.classList.contains('pki-done') ? b.getAttribute('data-w') + '%' : '0'; });
    if (root.classList.contains('pki-done')) fin();
    else { requestAnimationFrame(function () { root.querySelectorAll('.pkit i').forEach(function (b) { b.style.width = b.getAttribute('data-w') + '%'; }); });
      var tick = function (ts) { if (!root.isConnected || root.classList.contains('pki-done')) return; if (!t0) t0 = ts; var k = Math.min(1, (ts - t0) / DUR), e = 1 - Math.pow(1 - k, 3);
        root.querySelectorAll('.pkic').forEach(function (b) { b.textContent = Math.round(+b.getAttribute('data-n') * e).toLocaleString('en-US'); }); if (k < 1) requestAnimationFrame(tick); else setTimeout(function () { if (root.isConnected) fin(); }, 900); };
      requestAnimationFrame(tick); root.addEventListener('click', function (e) { if (!e.target.closest('a,button')) fin(); }); }
    $('pkiAll').onclick = function () { rev.intro = false; rev.page = 0; drawReveal(); var g = $('packGrid'); if (g) g.scrollTop = 0; };
    $('pkiKeep').onclick = closeReveal;
    root.querySelectorAll('.pkistar').forEach(function (b) { b.onclick = function () { rev.introDone = 1; toggleKeep(+b.getAttribute('data-keep')); drawReveal(); }; });
    if ($('pkiStar')) $('pkiStar').onclick = function () { rev.introDone = 1; var add = keepL.filter(function (id) { return !isKept(id); }); if (!add.length) return;
      var l = keptIds().concat(add); try { localStorage.setItem(keepKey(), JSON.stringify(l)); } catch (e) { } try { document.dispatchEvent(new CustomEvent('xcpets-stars')); } catch (e) { }
      toast('⭐ Starred ' + plural(add.length, 'pet') + ': your favorites, never discarded. Find them with Sort → Starred in My Pets.', 6000); drawReveal(); };
    $('pkiLater').onclick = function () { var ids = rev.eggs.slice(); if (!revealQ.length) packY = null; close('packBox'); rev = null; trayAdd(ids); render(); setTimeout(nextReveal, 250); };
    try { $('pkiAll').focus({ preventScroll: true }); } catch (e) { }
  }
  /* unopened-1125: a pet without its look (art) used to throw inside the review, after the eggs were already marked seen, so the pop-up
   * never opened and nothing showed. revReady() moves such eggs to the pill (they open once their look has loaded); drawReveal() never
   * throws: on any error the review closes and its eggs go to the pill. */
  function revReady(r) { var w = world(), bad = []; r.eggs = r.eggs.filter(function (id) { var x = w.byId[id]; if (x && x.art) return true; if (x) bad.push(id); return false; }); if (bad.length) trayAdd(bad); }
  function drawReveal() { try { drawReveal0(); } catch (e) { if (window.console) console.warn('hatch review', e); var r = rev; if (r && r.kind === 'eggs') { close('packBox'); rev = null; trayAdd(r.eggs); setTimeout(nextReveal, 250); } else throw e; } }
  function drawReveal0() {
    if (rev) rev._g = null; /* keep-pick: protected-pet answers are cached for one draw (taps reuse them) */
    $('packBox').classList.toggle('pkintro', !!(rev.kind === 'eggs' && rev.intro));
    if (rev.kind === 'eggs' && rev.intro) { var wi = world(); if (rev.eggs.some(function (id) { return wi.byId[id]; })) return drawIntro(wi); rev.intro = false; }
    var w = world(), gear = rev.kind === 'gear', list = gear ? rev.wins : rev.eggs.map(function (id) { return w.byId[id]; }).filter(Boolean), tiers = [0, 0, 0, 0];
    if (!gear) list = sortEggs(w, list, rev.sort); /* egg-review-sort 2026-10-24: display order only; rev.sel is keyed by pet id, so ticks survive re-sorting */
    var all = list; list.forEach(function (x) { tiers[gear ? (x.legendary ? 3 : x.tier) : x.art.tierIndex]++; });
    var nMy = gear ? 0 : list.filter(function (x) { return x.stage === 5; }).length;
    var spAll = gear ? all : all.filter(function (x) { return revSpShows(rev.sp, x); }); /* hatch-species-filter: pets of the chosen species (any rarity) */
    if (!gear) { if (!rev.f) rev.f = 'all'; if (!rev.sp) rev.sp = 'all';
      if (rev.sp !== 'all' && !spAll.length) { rev.sp = 'all'; spAll = all; }
      list = spAll.filter(function (x) { return revShows(rev.f, x); }); if (!list.length && rev.f !== 'sel') { rev.f = 'all'; list = spAll; } } /* hatch-review-simple: the Show filter (+ species) */
    var pages = Math.max(1, Math.ceil(list.length / REV_PAGE)); rev.page = Math.min(rev.page, pages - 1);
    $('packTitle').textContent = gear ? '🎁 ' + (list.length === 1 ? 'You got ' + list[0].label : list.length + ' new gear pieces') : ((rev.n0 || all.length) === 1 ? '1 egg hatched' : (rev.n0 || all.length).toLocaleString('en-US') + ' eggs hatched') + (tiers[3] ? ' · ' + tiers[3] + ' Legendary' : '') + (nMy ? ' · ' + nMy + ' Mythic' : '') + (function () { var k = gear ? 0 : all.filter(function (x) { return revStar(x) === 'weird'; }).length; return k ? ' · ' + k + ' Weird' : ''; })();
    $('packBox').classList.toggle('gearmode', gear); $('packBox').classList.toggle('pkkeepm', !gear && revMode() === 'keep'); $('packTitle').setAttribute('data-ico', gear ? 'gear' : 'egg'); if ($('packNote')) { $('packNote').hidden = gear; if (!gear) $('packNote').textContent = hdLive() ? 'Discarded pets leave My Pets right away. When you tap Done, you sign one small burn (1 dander) that makes it permanent on every device. Until then, Undo from 🗑️ Discard pile in My Pets.' : 'Discarding is free and only in this browser. Undo anytime from 🗑️ Discard pile in My Pets.'; } /* keep-pick: Done does send the pet:hd burn (closeReveal -> hdFlush) */ /* the hide note belongs to the egg review only */
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
      var pk = revPick(), keepM = revMode() === 'keep', kR = revKeepN(w, all, 1), kL = revKeepN(w, all, 2), kA = revKeepN(w, all, 3), many = all.length > 1, spOn = rev.sp !== 'all', cnt = { all: spAll.length, wx: 0, my: 0, sel: 0, 0: 0, 1: 0, 2: 0, 3: 0 };
      spAll.forEach(function (x) { cnt[x.art.tierIndex]++; if (revStar(x)) cnt.wx++; if (x.stage === 5) cnt.my++; if (pk[x.id]) cnt.sel++; }); /* chip counts = within the chosen species */
      if (!spOn) cnt.sel = Object.keys(pk).length;
      var spC = {}, spK = [], spBase = all.filter(function (x) { return revShows(rev.f, x); }); all.forEach(function (x) { var k = revSp(x); if (spC[k] == null) { spC[k] = 0; spK.push(k); } });
      spBase.forEach(function (x) { spC[revSp(x)]++; }); /* species counts = within the chosen rarity chip */
      spK.sort(function (a, b) { if (a === 'hybrid' || b === 'hybrid') return a === 'hybrid' ? 1 : -1; var x = revSpName(a).toLowerCase(), y = revSpName(b).toLowerCase(); return x < y ? -1 : x > y ? 1 : 0; });
      var spSel = many && spK.length > 1 ? '<label class="pksort pkspl">Species <xc-select id="pkSp" aria-label="Show only one species"' + (spOn ? ' class="pkon"' : '') + '><option value="all">All species ' + spBase.length.toLocaleString('en-US') + '</option>' +
        spK.map(function (k) { return '<option value="' + esc(k) + '"' + (rev.sp === k ? ' selected' : '') + (spC[k] || rev.sp === k ? '' : ' disabled') + '>' + esc(revSpName(k)) + ' ' + spC[k].toLocaleString('en-US') + '</option>'; }).join('') + '</xc-select></label>' +
        (spOn ? ' <button type="button" class="q" id="pkSpX" title="Show every species again">✕ ' + esc(revSpName(rev.sp)) + '</button>' : '') : '';
      var keepRow = many && (kR || kL || kA) ? '<div class="pkkeep" role="group" aria-label="Quick choices">' +
        '<button type="button" class="btn pkq" id="pkKeepRare" data-top="1"' + (kR ? '' : ' disabled') + '>Keep Rare &amp; Legendary<small>discards ' + kR.toLocaleString('en-US') + ' Common &amp; Uncommon</small></button>' +
        '<button type="button" class="btn pkq" id="pkKeepLeg" data-top="2"' + (kL ? '' : ' disabled') + '>Keep Legendary only<small>discards ' + kL.toLocaleString('en-US') + ' Common, Uncommon &amp; Rare</small></button>' +
        '<button type="button" class="btn pkq pkall" id="pkHideAll" data-top="3"' + (kA ? '' : ' disabled') + '>Discard all<small>discards ' + kA.toLocaleString('en-US') + ', Legendary too</small></button>' +
        '<div class="muted small pksafe">🛡️ Legendary pets are never discarded, except by Discard all.' + (function () { var t = revSafeNote(w, all, 3); return t ? ' ' + esc(t.replace(/^These stay too: /, 'Always kept: ')) + '.' : ''; })() + '</div></div>' : ''; /* hide-all-1103: owner wording 'Discard', not 'Hide' */
      var chips = many ? '<div class="pkshow" role="group" aria-label="Show"><span class="muted">Show</span> ' + REV_SHOW.concat([['sel', keepM ? '✅ Keeping' : '✓ Selected']]).filter(function (f) { return f[0] === 'all' || f[0] === 'sel' || cnt[f[0]] || rev.f === f[0]; }).map(function (f) {
        return '<button type="button" class="q pkchip' + (f[0] === '3' || f[0] === 'my' || f[0] === 'wx' ? ' pkgold' : '') + '" data-f="' + f[0] + '" aria-pressed="' + (rev.f === f[0]) + '">' + f[1] + ' <b' + (f[0] === 'sel' ? ' id="pkSelN"' : '') + '>' + cnt[f[0]].toLocaleString('en-US') + '</b></button>'; }).join('') +
        (rev.gone ? '<span class="muted pkgone">' + rev.gone.toLocaleString('en-US') + ' discarded</span>' : '') + '</div>' : '';
      var tools = many ? '<div class="pktools">' + spSel + ' <label class="pksort">Sort <xc-select id="pkSort" aria-label="Sort the pets">' + (window.PetSort ? PetSort.options(rev.sort) : '') + '</xc-select></label>' +
        ' <button type="button" class="q" id="pkSelAll">' + (keepM ? 'Keep all shown' : 'Select all shown') + '</button> <button type="button" class="q" id="pkClear"' + (cnt.sel ? '' : ' hidden') + '>' + (keepM ? 'Clear picks' : 'Clear selection') + '</button>' + pager + '</div>' +
        /* keep-pick: which mode you are in, always in sight, and what Discard the rest will do (filled by revCount) */
        '<div class="pkmode" role="group" aria-label="What a tap on a pet does"><span>Tap pets to</span><button type="button" class="pkmb pkmk" data-mode="keep" aria-pressed="' + keepM + '">✅ Keep</button><button type="button" class="pkmb pkmd" data-mode="discard" aria-pressed="' + !keepM + '">🗑️ Discard</button></div>' +
        '<div class="small pktip' + (keepM ? ' pktipk' : '') + '" id="pkPlan" role="status"></div>' : '';
      if (!rev.best) rev.best = revBest(w, all).map(function (x) { return x.id; }); /* hatch-tray-1124: fixed when the review opens, so it doesn't jump around while you discard */
      if (rev.luck == null) rev.luck = revLuck(w, all);
      var bestL = rev.best.map(function (id) { return w.byId[id]; }).filter(function (x) { return x && rev.eggs.indexOf(x.id) >= 0; });
      var best = bestL.length && all.length > 1 ? '<div class="pkbest" aria-label="Best finds"><div class="pkbh">' + (bestL.some(revStar) ? '🌀 Weird &amp; special finds!' : '✨ Best of this hatch') + '</div><div class="pkbrow">' +
        bestL.map(function (x) { var k = revStar(x), oi = revOneIn(w, x); return '<a class="pkbc t' + x.art.tierIndex + (k ? ' pkb-' + k : '') + '" href="pet.html?id=' + x.id + '" target="_blank" rel="noopener" title="Open #' + x.id + ' in a new tab"><canvas width="32" height="32" data-bid="' + x.id + '"></canvas>' +
          '<span class="pkbtag">' + esc(k ? revStarLabel(x) : TIERS[x.art.tierIndex].label) + '</span><span class="pkbname">#' + x.id + ' ' + esc(V.petSpeciesLabel ? V.petSpeciesLabel(x) : x.species) + '</span>' + (oi ? '<span class="pkbodd">💎 1 in ' + (window.PetScore && PetScore.fmtN ? PetScore.fmtN(oi) : oi) + '</span>' : '') + '</a>'; }).join('') + '</div></div>' : '';
      $('packSummary').innerHTML = rev.luck + best + keepRow + chips + tools;
      $('packSummary').querySelectorAll('canvas[data-bid]').forEach(function (c) { var x = w.byId[+c.getAttribute('data-bid')]; if (!x) return; try { var fr = petFrames(x, w); paint(c, fr[0]); R.animate(c, fr); } catch (e) { } }); }
    bindAeTogs($('packSummary'));
    if (!gear) { $('packSummary').querySelectorAll('.pkq').forEach(function (b) { b.onclick = function () { revKeepTier(w, all, +b.dataset.top); }; });
      $('packSummary').querySelectorAll('[data-f]').forEach(function (b) { b.onclick = function () { rev.f = b.dataset.f; rev.page = 0; drawReveal(); var g = $('packGrid'); if (g) g.scrollTop = 0; }; });
      if ($('pkSelAll')) $('pkSelAll').onclick = function () { revSelectShown(w, list); };
      if ($('pkSp')) { $('pkSp').value = rev.sp; $('pkSp').onchange = function () { rev.sp = this.value; rev.page = 0; drawReveal(); var g = $('packGrid'); if (g) g.scrollTop = 0; }; }
      if ($('pkSpX')) $('pkSpX').onclick = function () { rev.sp = 'all'; rev.page = 0; drawReveal(); };
      if ($('pkClear')) $('pkClear').onclick = function () { if (revMode() === 'keep') rev.keep = {}; else rev.sel = {}; if (rev.f === 'sel') rev.f = 'all'; drawReveal(); };
      $('packSummary').querySelectorAll('[data-mode]').forEach(function (b) { b.onclick = function () { revSetMode(b.dataset.mode); }; }); }
    if ($('pkSort')) $('pkSort').onchange = function () { rev.sort = this.value; rev.page = 0; drawReveal(); };
    if ($('pkPrev')) { $('pkPrev').onclick = function () { rev.page--; drawReveal(); }; $('pkNext').onclick = function () { rev.page++; drawReveal(); }; }
    var grid = $('packGrid'); grid.innerHTML = '';
    list.slice(rev.page * REV_PAGE, rev.page * REV_PAGE + REV_PAGE).forEach(function (x) {
      var d = document.createElement('div');
      if (gear) { d.className = 'egg gearwin t' + (x.legendary ? 3 : x.tier) + ' ux-flash ux-t' + (x.legendary ? 3 : x.tier || 0) + (x.legendary ? ' ux-fanfare' : ''); d.title = x._src.long; d.innerHTML = '<span class="ic"></span><div class="gwname"><b>' + esc(x.label) + '</b></div><div>' + esc(x.tierName) + (x.legendary ? ' ★' : '') + ' · ' + esc(x.slotName) + '</div><div class="muted gwsrc">' + esc(x._src.short) + (x._pet != null ? ' · pet #' + x._pet : '') + '</div>' +
          '<div class="gwwhere">' + (x._on === 'c' ? '✓ Worn by ' + esc(commName(w)) + ' (community pet)' : x._on != null ? '✓ Equipped on #' + x._on : '📦 In your stash') + '</div>';
        d.querySelector('.ic').appendChild(V2Render.iconCanvas(x.item, 'gicon')); grid.appendChild(d); if (window.UXB) UXB.revealCard(d, x, w); return; }
      var gd = dudGuard(w, x), km = revMode() === 'keep', on = !!revPick()[x.id]; var sk = revStar(x); d.className = 'egg pkcard t' + x.art.tierIndex + (sk ? ' pkstar' : '') + (on ? ' picked' : '') + (km && revKG(w, x).length ? ' pkauto' : ''); d.tabIndex = 0; d.setAttribute('role', 'checkbox'); var kgd = km && revKG(w, x).length; d.setAttribute('aria-checked', String(kgd ? true : on));
      d.setAttribute('aria-label', km ? (kgd ? '#' + x.id + ' is always kept' : 'Keep #' + x.id) : 'Select #' + x.id + ' to discard'); d.title = km ? (kgd ? 'Always kept (protected)' : 'Tap to keep, tap again to let it go') : 'Tap to select or unselect';
      d.innerHTML = '<span class="pkcheck" aria-hidden="true">✓</span><canvas width="32" height="32"></canvas><div>#' + x.id + ' ' + esc(TIERS[x.art.tierIndex].label) + (x.stageName ? ' · ' + esc(V.stageLabelOf ? V.stageLabelOf(x) : x.stageName) : '') + '</div><div class="muted">' + esc(V.petSpeciesLabel ? V.petSpeciesLabel(x) : x.species) + '</div>' + (R.eraChip ? R.eraChip(w, x) : '') + (x.parents && R.bredFrom ? '<div class="small">' + R.bredFrom(w, x, false) + '</div>' : '') + (window.PetScore && PetScore.discardInfo ? PetScore.discardInfo(w, x, V.petSpeciesLabel ? V.petSpeciesLabel(x) : null) : '') + (function () { var gk = km ? revKG(w, x) : gd; return gk.length ? '<div class="small dudg" title="Protected: never picked for you">🛡️ ' + (km ? 'Always kept' : 'Protected') + ' · ' + esc(gk.join(', ')) + '</div>' : ''; })();
      grid.appendChild(d); var c = d.querySelector('canvas'), fr = petFrames(x, w); paint(c, fr[0]); R.animate(c, fr);
      d.onclick = function (e) { if (e.target.closest && e.target.closest('a,button,input,select,xc-select')) return; revToggle(w, x, d); };
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
  function closeReveal() { if (rev && rev.kind === 'eggs') uDel(rev.all || rev.eggs); setTimeout(hdFlush, 400); var toInv = rev && rev.kind === 'gear', toPets = rev && rev.kind === 'eggs' && lastHatchN > 1; if (toPets && window.UXB && UXB.afterHatch) UXB.afterHatch(); if (!revealQ.length) packY = null; close('packBox'); rev = null; render(); setTimeout(nextReveal, 250);
    if (toPets && $('petsPanel')) setTimeout(function () { if (!$('packBox').classList.contains('on')) try { $('petsPanel').scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { } }, 300);
    if (toInv && $('invPanel')) setTimeout(function () { if (!$('packBox').classList.contains('on')) try { $('invPanel').scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { } }, 300); }
  /* pet total near the hatch buttons (2026-10-19, display only): every pet in the replayed world (w.pets.length, same as the top 'pets hatched'),
   * incl. dead, released and bred pets. Shows '…' until every burn's block hash is known, so an incomplete replay never shows a wrong number. */
  var ptLast = null, ptT = null;
  function petTotal(w) { var el = $('petTotal'); if (!el) return;
    if (w && w._counts) { $('ptN').textContent = fmt(w._counts.n); $('ptAlive').textContent = '· ' + fmt(w._counts.alive) + ' alive'; ptLast = w._counts.n; return; }
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
  /* Nov 23 2026 (players: 'the hungry pets are all off'): a fast-loaded page paints the published world, whose fed-today and hungry flags
   * are for the game day of the published block. Once the game day turns (or the page paints an older world while the server rebuilds),
   * every pet kept yesterday's flags until a reload. The pet records carry their feed days, so set those two flags for the current
   * block the way the rules do (fedToday = fed on this game day; hungry = alive, not fed today, a meal costs something). Display only. */
  function freshHunger(w) { if (!w || !w._view || !w.pets || !ME || !V.day) return; var t = Math.max(S.tip || 0, w.tip || 0); if (w._hungerAt === t) return; w._hungerAt = t;
    var d = V.day(t); if (V.day(w.tip || 0) === d && !w._hungerDay) return; w._hungerDay = d;
    for (var i = 0; i < w.pets.length; i++) { var p = w.pets[i]; if (!p || p.owner !== ME || !p.feedDays || p.dead || p.released || (p.zombie && !p.zombie.end)) continue;
      p.fedToday = !!p.feedDays[d]; p.hungry = !p.fedToday && (p.nextMeal || 0) > 0; } }
  function render() {
    var w = world(), c = w.community; try { freshHunger(w); } catch (e) { } try { godUnhide(w); } catch (e) { } try { sweepHu(w); } catch (e) { } try { autoStarBackfill(w); } catch (e) { } notifyHatch(w); notifyWins(w); setTimeout(nextReveal, 0);
    $('bal').textContent = S.balanceAt ? fmt(S.balance) : '\u2013'; V2Wallet.paint(ME, $);
    $('cBurned').textContent = fmt(w._counts && w._counts.burned != null ? w._counts.burned : c.burned); $('cGame').textContent = fmt(w._counts && w._counts.burns != null ? w._counts.burns : S.rows.length); $('cPets').textContent = fmt(w._counts ? w._counts.n : w.pets.length);
    petTotal(w);
    /* Wizard Cold Storage (Oct 19 2026): egg + sign claim buttons appear once the rule is on at the next block (V2Rules.wizColdOn) */
    var wzOn = V.wizColdOn && V.wizColdOn(w, (S.tip || 0) + 1), wm = w.wizardMythic; if ($('wizEggBtn')) { $('wizEggBtn').hidden = !(WIZARD_EGG_ON_SALE && wzOn); $('wizEggBtn').style.display = $('wizEggBtn').hidden ? 'none' : ''; }
    if ($('wizSignBtn')) { $('wizSignBtn').hidden = !(WIZARD_SIGN_CLAIM_ON && wzOn && ME && wm && wm.by && wm.by[ME] > 0 && !(wm.claimed && wm.claimed[ME])); $('wizSignBtn').style.display = $('wizSignBtn').hidden ? 'none' : ''; }
    // community pet (Jake 2026-10-14): Nakamoto at Mythic until The Return (1,111,111 burned in total), then the next community pet (same .commsprite slot as live)
    var wiz = !!c.returned, fr, gap = R.communityGap && R.communityGap(w);
    /* no community pet (Cold Storage gap): the panel STAYS with a coming-soon mystery egg; feed + gear roll disabled (owner rule Oct 20 2026, display only) */
    fr = gap ? R.comingSoonFrames() : R.communityFrames(w); /* community gear roll: the community pet (Bitcoin Wizard, or Nakamoto before) wears its community-roll gear (display only) */
    if (!commAnim) { var cv = document.createElement('canvas'); cv.width = cv.height = 32; cv.className = 'commsprite'; $('community').parentNode.insertBefore(cv, $('community')); commAnim = { c: cv }; }
    if (fr) R.animate(commAnim.c, fr); commAnim.fr = fr; if (R.bindCommunityTip) R.bindCommunityTip(commAnim.c, w, ME); /* community-gear-hover: hover/tap shows what he wears */
    var T = V.WIZARD_THRESHOLDS, nx = wiz && c.wizardStage < 5 ? T[c.wizardStage + 1] : null, rp = V.returnProgress(c.burned);
    var cFed = c.current === 'groyper' ? c.groyperFed || 0 : c.current === 'rabbit' ? c.rabbitFed || 0 : c.current === 'homer' ? c.homerFed || 0 : c.current === 'funtrump' ? c.funtrumpFed || 0 : c.current === 'kek' ? c.kekFed || 0 : null; /* site-audit 2026-10-27: each community pet's own counter */
    $('community').innerHTML = '<b>' + esc(c.petName) + '</b>' + (c.petRole && c.petName !== 'Nakamoto' ? ' · ' + esc(c.petRole) : '') + ' · ' + c.petStageName + ' · ' + fmt(Math.floor(cFed != null ? cFed : c.burned)) + ' <span class="asset">XCPETS</span> ' + (cFed != null ? 'fed to ' + esc(c.petName) : 'burned'); /* community-gear-hover: old 'Wearing:' line removed (owner 2026-10-29); hover/tap tooltip shows worn gear */
    /* home-page community readout on play (same numbers as index: V2Render.communityStats) */
    if (R.communityStats) { var cs = R.communityStats(w, w._counts && w._counts.burns != null ? w._counts.burns : (V2Mock.state().rows || []).length), F = function (n) { return fmt(n); };
      $('community').insertAdjacentHTML('beforeend', '<div class="sharedwrap cstats"><div class="stats"><div><span>Stage</span><b id="pcStage">' + esc(cs.stage) + '</b></div><div><span>Fed to the community pet</span><b id="pcFed">' + F(cs.fed) + '</b></div><div><span>Next stage</span><b id="pcNext">' + (cs.next != null ? F(cs.next) + ' to ' + esc(cs.nextName) : 'Mythic reached') + '</b></div></div>' +
        '<div class="progress"><div id="pcProg" style="width:' + cs.pct.toFixed(1) + '%"></div></div><div class="stats"><div><span>Burns</span><b id="pcBurns">' + F(cs.burns) + '</b></div><div><span>Pets hatched</span><b id="pcPets">' + F(cs.pets) + '</b></div></div></div>'); if (R.communityGoalFill) R.communityGoalFill($('pcFed'), $('pcNext'), w); /* same framing as the pop-up (Jake Nov 23 2026) */ }
    if (R.kekOn && R.kekOn(w)) $('community').insertAdjacentHTML('beforeend', '<details class="small muted" id="kekCard"><summary>Card</summary>' + esc(R.KEK_CARD) + '</details>'); /* gated: only when Lord Kek is the community pet */
    if (R.kekOn && R.kekOn(w) && window.V2KekArrival) { $('community').insertAdjacentHTML('beforeend', '<div class="small" id="kekReplayRow">' + V2KekArrival.LINK + '</div>'); V2KekArrival.bindReplay($('community'), world); V2KekArrival.watch($('communityPanel') || commAnim.c, world); } /* Lord Kek arrival scene: once per player, display only */ if (w.community && w.community.current === 'rabbit') { (function () { function go() { if (!window.V2RabbitArrival) { var s = document.createElement('script'); s.src = 'js/v2-rabbit-arrival.js?v=e6db15afb2'; s.onload = go; document.body.appendChild(s); return; } var row = $('rabbitReplayRow'); if (!row && $('community')) { $('community').insertAdjacentHTML('beforeend', '<div class="small" id="rabbitReplayRow">' + V2RabbitArrival.LINK + '</div>'); row = $('rabbitReplayRow'); } if (row) { V2RabbitArrival.bindReplay(row, world); V2RabbitArrival.watch($('communityPanel') || (commAnim && commAnim.c), world); } } go(); })(); } /* White Rabbit arrival: once per player, display only */
    /* the gap's next number comes from R.communityGap (latest Cold Storage record + 1); the old fixed setNextNo(4) here pulled it back to #4 */
    if (gap) { var nn = '#' + R.COMMUNITY_NEXT_NO; $('community').innerHTML = '<b>' + esc(R.comingSoonText()) + '</b>' + '<div class="small muted">' + esc(R.lastColdName ? R.lastColdName(w) : (w.kekMythic ? 'Lord Kek' : 'The Bitcoin Wizard')) + ' reached Mythic and is in Cold Storage. Community feeding and gear rolls open when pet ' + nn + ' arrives.</div>' + (R.wizardTopHtml ? R.wizardTopHtml(w, esc, fmt) : ''); }
    var crOn = V.crollOn(S.tip) && !gap; $('crollBtn').textContent = 'Community gear roll (' + fmt(V.COSTS.croll) + ')'; $('crollBtn').disabled = !crOn;
    if (!crOn && !gap) $('community').insertAdjacentHTML('beforeend', '<div class="small muted" id="crollNote">Community gear roll switches on at block ' + fmt(V.ACTIVATE_CROLL_BLOCK) + '.</div>');
    $('crollBtn').title = crOn ? 'Burn ' + fmt(V.COSTS.croll) + ' XCPETS: the community pet gets one random gear piece and wears it right away (a new piece replaces the old one in that slot)' : 'Community gear roll switches on at block ' + fmt(V.ACTIVATE_CROLL_BLOCK);
    $('goalBar').style.width = (rp.pct * 100).toFixed(2) + '%';
    $('goalTxt').innerHTML = wiz ? '<b>' + fmt(Math.floor(c.burned)) + '</b> <span class="asset">XCPETS</span> burned' : '<b>' + fmt(Math.floor(rp.count)) + '</b> / ' + fmt(V.COMMUNITY_GOAL) + ' <span class="asset">XCPETS</span> burned (' + (rp.pct * 100).toFixed(1) + '%)'; /* Cold Storage bar: no Return wording (Jake 2026-10-14) */
    $('lb').innerHTML = (c.leaderboard || []).slice(0, 8).map(function (x) { return '<li' + (x.address === ME ? ' class="me"' : '') + '>' + esc(x.address) + ' · ' + fmt(x.amount) + '</li>'; }).join('');
    $('cfeedBtn').textContent = cfeedText(); $('cfeedBtn').disabled = !!gap; /* hatchspeed-1101: same label as the chip fast path (172.5 showed as 172 though 172.5 is burned) */
    if (gap) { var sn = 'Opens when pet #' + R.COMMUNITY_NEXT_NO + ' arrives'; $('cfeedBtn').textContent = 'Feed community · ' + sn.toLowerCase(); $('crollBtn').textContent = 'Community gear roll · ' + sn.toLowerCase(); $('cfeedBtn').title = $('crollBtn').title = sn; } else $('cfeedBtn').title = '';
    renderPets(w); renderInv(w); lairRender(w); /* pet-shop mockup; lair-perf: only while the Lair is on (or near) screen */ renderBattles(w); notifyFights(w); notifyBreeds(w); notifyCem(w); notifyLife(w); renderBreed(w); if (window.V2Motel) { try { V2Motel.render(w); } catch (e) { if (window.console) console.error(e); } } /* no-tail-motel mockup */ renderLog(w); try { inReqPopup(w); } catch (e) { if (window.console) console.error(e); } if (window.UXB) { try { UXB.after(w); } catch (e) { if (window.console) console.error(e); } } if (window.V2PlaceBar) { try { V2PlaceBar.render(w); } catch (e) { if (window.console) console.error(e); } } /* places round two: the what-now bar */
    if (detailId && $('detail').classList.contains('on')) detail(w.byId[detailId], w);
    offerResume();
  }
  // ---------------------------------------------------------------- My Pets (live card markup + checkbox)
  /* hotfix 3: the filtered + sorted pet list (shared by renderPets and the sort-only reorder) */
  function tokKind() { var e = $('fTok'), v = e ? e.value : ''; return window.V2TokFilter ? V2TokFilter.norm(v) : (/^(yes|no|away)$/.test(v) ? v : ''); }
  function petList(alive, dead, noZF, noTok) { var fT = $('fTier').value, fS = $('fSort').value, hide = Number($('fHide').value), X = window.UXB ? UXB.filters() : null;
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
    if (fS === 'weird' && window.V2Render && V2Render.rareInfo) list.sort(function (a, b) { var ia = V2Render.rareInfo(a), ib = V2Render.rareInfo(b), sa = ia ? (ia.weird ? 2 : ia.legend ? 1 : 0) : 0, sb = ib ? (ib.weird ? 2 : ib.legend ? 1 : 0) : 0; return sb - sa || String((ia && ia.kind) || '').localeCompare(String((ib && ib.kind) || '')) || a.id - b.id; }); /* places-perf: Weird birth traits first, then Legends, so a shock-box haul can be sorted before discard */
    if (fS === 'tok' && window.V2TokFilter) list.sort(V2TokFilter.comparator(world())); /* mypets-tok-filter: tokenized pets together, ahead of the ones with no token */
    if (!cem && !noZF && ZFK && window.V2ZombieFilter) { var ZFw = world(), ZFb = (ZFw.tip || 0) + 1; list = list.filter(function (p) { return V2ZombieFilter.match(ZFK, ZFw, p, ZFb, ME); }); } /* mypets-zombie-filter: All zombies / Hungry / Feral / Crumbling soon (optional, off by default) */
    if (!noTok && window.V2TokFilter) { var tk = tokKind(); if (tk) { var Tw = world(); list = list.filter(function (p) { return V2TokFilter.match(tk, Tw, p); }); } } /* mypets-tok-filter: optional, off by default; noTok counts the other filters without this one */
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
  function wagmiBar(stk, w) { var tip = w.tip || S.tip || 0, game = V.clock ? V.clock(tip) : tip, left = 144 - (game % 144), hrs = left * 10 / 60, lt = hrs >= 1 ? '~' + Math.round(hrs) + 'h' : '~' + Math.max(1, Math.round(left * 10)) + ' min';
    var on = V.wagmiOn && V.wagmiOn(tip + 1), ro = viewOnly() || !ME, why = !on ? 'WAGMI check-ins open soon' : stk.today ? 'Already said WAGMI today' : ro ? 'View only: connect your wallet to say WAGMI' : '';
    var btn = '<button type="button" class="btn sk-btn" id="wagmiBtn"' + (why ? ' disabled title="' + esc(why) + '"' : ' title="Burns 1 dander of XCPETS with the tag pet:wagmi"') + '>' + (stk.today ? '✓ WAGMI\u2019d today' : '🚀 Say WAGMI') + ' <span class="cost">' + (on ? '1 dander' : 'soon') + '</span></button>';
    var msg = stk.state === 'wagmi' ? '<span class="sk-tag sk-w">WAGMI</span> <b>🔥 ' + stk.current + '-day streak</b> <span class="sk-best">best ' + stk.best + '</span> ' + (stk.today ? '<span class="sk-ok">see you next chain day</span>' : '<span class="sk-warn">say WAGMI in the next ' + lt + ' to make it ' + (stk.current + 1) + '</span>')
      : stk.state === 'ngmi' ? '<span class="sk-tag sk-n">NGMI</span> <b>💀 streak reset</b> <span class="sk-joke">' + esc(NGMI_JOKES[Math.floor(game / 144) % NGMI_JOKES.length]) + '</span> <span class="sk-best">best ' + stk.best + '</span>'
      : '<span class="sk-tag sk-w">WAGMI?</span> <b>Say WAGMI once a chain day</b> <span class="sk-joke">and watch your 🔥 streak grow. 1 dander, no feeding needed.</span>';
    setTimeout(function () { var b = $('wagmiBtn'); if (b && !b.disabled) b.onclick = function () { confirmPlans('WAGMI check-in', [{ tag: 'pet:wagmi', amount: 0.00000001 }]); }; }, 0);
    return '<span class="sk-msg">' + msg + '</span>' + btn; }
  /* wagmi-daily (owner, Oct 22 2026): right after V2Wallet.connect, offer WAGMI once per wallet per chain day if it can be sent (gate open, not said
   * today, none pending; same sendBlock check as the button). One tap opens the normal confirm (one XCP Wallet window, one-window lock applies).
   * Dismiss = not again today. localStorage key xcpets-wagmi-offer:<addr> = chain day it was shown. The My Pets WAGMI button stays. */
  var WAGMI_PLAN = { tag: 'pet:wagmi', amount: 0.00000001 };
  function wagmiOffer(w) { try {
    if (!ME || viewOnly() || !w || !w.tip || !V.wagmiOn || !V.wagmiOn(w.tip + 1)) return; var ss = window.sessionStorage, ls = window.localStorage;
    if (ss.getItem('xcpets-wagmi-connect') !== ME) return; var d = V.day ? V.day(w.tip + 1) : Math.floor((w.tip + 1) / 144), k = 'xcpets-wagmi-offer:' + ME;
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
  var CARDC = new Map(); /* speed2-1101: last grid card per pet id (see mk) */
  function renderPets(w) {
    if (CARDC.size > 4000) CARDC.clear();
    var all = mine(w), alive = all.filter(function (p) { return !p.dead; }), dead = all.filter(function (p) { return p.dead; });
    if (V.streakOf && $('streakBar')) { var stk = ME ? V.streakOf(w, ME, w.tip) : null; /* WAGMI / NGMI daily check-in (login-streak rework, Oct 21 2026) */
      $('streakBar').style.display = stk ? '' : 'none'; if (stk) $('streakBar').innerHTML = wagmiBar(stk, w);  wagmiOffer(w); }
    var rost = w._roster, partial = !!(rost && !w._full);
    $('nAlive').textContent = partial ? rost.alive : alive.length; $('nDead').textContent = partial ? rost.dead : dead.length; $('petBadge').textContent = partial ? rost.alive : alive.length;
    if (window.V2TokFilter && $('fTok')) { var tc = V2TokFilter.counts(w, petList(alive, dead, false, true));
      if (partial && rost.tokenized != null && !($('fSearch') && $('fSearch').value) && !($('fSpecies') && $('fSpecies').value && $('fSpecies').value !== 'all')) { tc.yes = rost.tokenized; tc.away = rost.away || 0; tc.no = Math.max(0, (cem ? rost.dead : rost.alive) - tc.yes - tc.away); tc.all = cem ? rost.dead : rost.alive; }
      [['', 'All', tc.all], ['yes', 'Tokenized', tc.yes], ['no', 'Not tokenized', tc.no], ['away', 'Token held elsewhere', tc.away]].forEach(function (x) { var o = $('fTok').querySelector('option[value="' + x[0] + '"]'); if (!o) return; var t = x[1] + ' · ' + fmt(x[2]); if (o.textContent !== t) o.textContent = t; }); } /* mypets-tok-filter: counts follow the other filters, one pass, labels change only when a number does */
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
    var iqE = window.V2PetSearch && V2PetSearch.idQuery && V2PetSearch.idQuery(($('fSearch') || {}).value || '');
    var box = $('pets'); box.innerHTML = list.length || nfN ? '' : '<p class="muted">' + (iqE && iqE.mode === 'bad' ? 'Those entries are not pet numbers. Nothing was selected or discarded.' : iqE && iqE.mode === 'ids' ? 'None of those IDs are in this list.' : 'No pets match this filter.') + '</p>';
    if (nfN) { var nfg = document.createElement('div'); nfg.className = 'row nffilter'; nfg.id = 'nfGroup'; nfg.style.cssText = 'gap:8px;align-items:center;margin:0 0 8px;width:100%;grid-column:1/-1;flex-wrap:wrap';
      nfg.innerHTML = '<button type="button" class="q" id="nfOnly" aria-pressed="' + nfOnly + '">' + (cem ? '🪦' : '🥚') + ' ' + (nfOnly ? '✓ ' : '') + 'Never fed only <span class="chip">' + fmt(nfN) + '</span></button> <span class="small muted">' + (nfOnly ? 'only pets that ' + (cem ? 'died without a single meal' : 'never had a meal') + ' · tap to show all' : 'optional filter, off: all pets are listed') + '</span>';
      nfg.querySelector('button').onclick = function (e) { e.stopPropagation(); NF[nfK] = !nfOnly; if (NF[nfK] && ZFK) { ZFK = ''; V2ZombieFilter.save(''); } render(); }; box.appendChild(nfg); }
    /* mypets-zombie-filter (owner Oct 30 2026): zombie filter pills under the search, only when you own a zombie (or one is on). Counts follow the search + sort list. */
    if (!cem && window.V2ZombieFilter) { var ZFw2 = w, zcAll = petList(alive, dead, true), zc = V2ZombieFilter.counts(ZFw2, zcAll, (ZFw2.tip || 0) + 1, ME), zAny = ZFK || zc.all || (partial && rost.zombies) || alive.some(ZB);
      if (partial && rost.zombies != null && !($('fSearch') && $('fSearch').value)) zc.all = Math.max(zc.all, rost.zombies);
      if (zAny) { V2ZombieFilter.css(); var zg = document.createElement('div'); zg.className = 'row zbfilter'; zg.id = 'zbGroup'; zg.style.cssText = 'gap:8px;align-items:center;margin:0 0 8px;width:100%;grid-column:1/-1;flex-wrap:wrap';
        zg.innerHTML = V2ZombieFilter.rowHtml(zc, ZFK, partial && rost.zombies != null ? rost.zombies : list.length);
        zg.querySelectorAll('[data-zf]').forEach(function (bt) { bt.onclick = function (e) { e.stopPropagation(); var k = bt.getAttribute('data-zf'); ZFK = ZFK === k ? '' : k; V2ZombieFilter.save(ZFK); if (ZFK) NF[nfK] = false; render(); }; });
        var zm = box.querySelector(':scope > p.muted'); if (zm) box.insertBefore(zg, zm); else box.appendChild(zg);
        if (ZFK && !list.length) { var ze = document.createElement('p'); ze.className = 'muted'; ze.style.gridColumn = '1/-1'; ze.textContent = 'No zombies match this filter' + ($('fSearch') && $('fSearch').value.trim() ? ' and search.' : '.'); if (zm) zm.remove(); box.appendChild(ze); } } }
    /* hotfix 3: cards are built in chunks of 150 with a yield between them, so a 2,000-pet wallet never blocks the page for seconds */
    var tok = renderPets.tok = (renderPets.tok || 0) + 1, CH = 150, tail = document.createComment('pets-more');
    /* mypets-tok-badge (display only): tokenized / not tokenized from the pet's deed already on the replayed world (V2Rules.deedOf).
     * A chip in the info row, with species and stage. Never drawn on the sprite. No chain read. */
    function tokMark(p) {
      var d0 = V.deedOf ? V.deedOf(w, p) : null, cls, word, label;
      if (d0) { var a = String(d0.asset || ''), sh = a.length > 16 ? a.slice(0, 6) + '\u2026' + a.slice(-4) : a;
        if (d0.ok) { cls = 'tok-yes'; word = 'Tokenized'; label = 'Tokenized. Pet token ' + sh + ' is tied to this pet, and you hold it.'; }
        else { cls = 'tok-away'; word = 'Token held elsewhere'; label = 'Tokenized, but token ' + sh + ' is held by another address.'; } }
      else { cls = 'tok-no'; word = 'Not tokenized'; label = 'Not tokenized yet.'; }
      return { state: cls === 'tok-yes' ? 'yes' : cls === 'tok-away' ? 'away' : 'no', html: '<span class="chip tokmark ' + cls + '" title="' + esc(label) + '" aria-label="' + esc(label) + '">' + word + '</span>' }; }
    function mk(p) {
      var d = document.createElement('div'), on = selS.has(p.id); d.className = 'pet card' + (p.dead ? ' dead' : '') + (ZB(p) ? ' zombie' : '') + (on ? ' selected' : ''); var qWhy = !p.dead && V.questBusyWhy ? V.questBusyWhy(p, S.tip + 1) : null, qNap = !p.dead && !qWhy && V.questNap && V.questNap(p, S.tip + 1); if (qWhy) d.className += ' quest-away'; /* Mythic quests: greyed while away (inert while the quest gate is null) */ d.tabIndex = 0; d.dataset.pid = p.id;
      var tm = tokMark(p); d.dataset.tok = tm.state;
      var ct = R.careTarget(w, p, S.tip), /* the engine's per-pet thresholds (Mythic discount), shared with the detail panel and pet page */ fed = p.dead ? '🪦 Died of neglect' : ZB(p) ? '' /* v2-zombies preview: no normal meals; the zombie hunger chip below replaces this one */ : p.fedToday ? 'Fed today: ✓' : p.nextMeal ? 'Hungry · meal ' + fmt(p.nextMeal) : 'Full';
      var head = /* mypets-checkbox: the checkbox is back; favorite-star-restore: the ★ favorite is back next to the name */ (p.dead ? '' : '<input type="checkbox" class="pick-cb" aria-label="Select #' + p.id + '"' + (on ? ' checked' : '') + '>') + '<canvas class="sprite" width="32" height="32"></canvas><h4>' + (p.dead ? '' : keepBtn(p.id)) + esc(p.name) + ' <span class="muted">#' + p.id + '</span>' + (p.blackEye ? ' 🤕' : '') + (p.crowned ? ' 👑' : '') + '</h4>';
      var mark = ZB(p) ? '<span class="chip zb-risen" title="Raised at the seance altar in the cemetery. Pets offered there are Sacrificed.">🧟 Risen</span>' : (p.resurrected ? '<span class="chip zb-halo" title="Brought back to life by a Resurrection at block ' + fmt(p.resurrected.block) + ': a halo for good, power ceiling ' + p.resurrected.cap + ' times">😇 Halo</span>' : '');
      var idCore = tm.html + mark + (R.godBornChip ? R.godBornChip(w, p) : '') + (R.traitChips ? R.traitChips(w, p, 'card') : '') /* trait-badges-1126 */ + (window.V2MythicGod ? V2MythicGod.chips(p, w) : '') + '<span class="chip">' + esc(spLabel(p)) + '</span>' + tierPill(p.tier, p) + '<span class="chip stg">' + esc((V.stageLabelOf ? V.stageLabelOf(p) : p.stageName)) + '</span>';
      var powChip = window.UXB && UXB.power ? (ZB(p) ? (function (h) { return '<span class="chip pow zb-pow" title="Zombie power, set at the seance altar' + (h ? ': ' + h.times + ' times its death stats' + (h.milestone ? ' (' + esc(h.milestone) + ')' : '') : '') + '">⚡ ' + UXB.power(p) + ' zombie</span>'; })(window.V2Zombies && V2Zombies.hunger ? V2Zombies.hunger(p, w) : null) : '<span class="chip pow"' + ptA(p) + '>⚡ ' + UXB.power(p) + '</span>') : '';
      var numChips = '<span class="chip gearchip">🎒 ' + R.worn(w, p.id).length + '/' + p.capacity + ' slots</span>' + powChip + (window.PetScore ? PetScore.badge(w, p) : '') + (window.PetScore && PetScore.rarityChip ? PetScore.rarityChip(w, p) : '') + (window.UXB ? UXB.origin(p, w) : '') + (p.neglected && !p.dead ? '<span class="chip warn">neglected</span>' : '') + (R.starveChip ? R.starveChip(w, p) : '') + (qWhy ? '<span class="chip quest-chip" title="' + esc(qWhy) + ': can\'t fight, breed, feed, gift or sell until it is home">🗺️ Gone Questing · back at ' + fmt(p.quest.end) + '</span>' : '') + (qNap ? '<span class="chip" title="Resting after a quest: can fight, breed and eat, but can\'t start a new quest yet">💤 Nap Time until ' + fmt(p.napUntil) + '</span>' : '');
      var genEra = (R.genChip ? R.genChip(w, p) : '') + (R.eraChip ? R.eraChip(w, p) : '');
      var _h = ZB(p)
        /* card-tidy (Jake Nov 23 2026: "the zombies make the card really long so maybe feeding them you need to click the card first"): a zombie card keeps
         * its chips and one hunger chip; the hunger bar, the feed / pledge / unleash panel and "Raised by" live on its pet page and in the Open ▸ panel. */
        ? head + '<div class="chips zb-groups"><div class="zb-chiprow zb-who" aria-label="Who this zombie is">' + idCore + (R.eraChip ? R.eraChip(w, p) : '') + '</div><div class="zb-chiprow zb-nums" aria-label="Numbers">' + (window.V2Zombies && V2Zombies.hungerChip ? V2Zombies.hungerChip(p, w) : '') + (R.genChip ? R.genChip(w, p) : '') + numChips + '</div></div>' + zCta(p, w)
        : head + '<div class="chips">' + idCore + '<span class="chip fed' + (p.hungry ? ' warn' : ' ok') + '">' + fed + '</span>' + genEra + '<i class="cbr" aria-hidden="true"></i>' + numChips + '</div><div class="bar"><i style="width:' + ct.pct.toFixed(1) + '%"></i></div><div class="small muted"' + (ct.discount ? ' title="Mythic at ' + fmt(ct.mythic) + ' care instead of 69,069: you raised a Mythic yourself (never left you, or more than half its care fed by you)"' : '') + '>care ' + fmt(p.care) + ' / ' + fmt(ct.mythic) /* owner Oct 27 2026: no "Mythic shortcut" words in My Pets; the lower target stays in the number and the hover note */ + '</div>';
      /* speed2-1101: in the grid, a card whose markup, classes, sprite and block are unchanged keeps its old element (no re-parse, no sprite repaint) */
      var _sig = (w.tip || 0) + '|' + d.className + '|' + (R.frKey ? R.frKey(p, w) : Math.random()) + '|' + _h;
      if (mk.reuse) { var _o = CARDC.get(p.id); if (_o && _o._sig === _sig && _o.className === d.className && !_o.parentNode) { _o._reused = 1; return _o; } }
      d.innerHTML = _h; d._sig = _sig; if (mk.reuse) CARDC.set(p.id, d);
      if (ZB(p)) zFeedBind(d);
      var kb = d.querySelector('.keepbtn'); if (kb) kb.onclick = function (e) { e.stopPropagation(); e.preventDefault(); toggleKeep(p.id); }; /* favorite-star-restore */
      var cb = d.querySelector('.pick-cb'); if (cb) cb.onclick = function (e) { e.stopPropagation(); if (window.UXB) UXB.cardTap(p.id, e); else toggle(p.id); };
      if (!p.dead && window.UXB) { d.insertAdjacentHTML('beforeend', '<button type="button" class="q openbtn" aria-label="Open #' + p.id + '">Open ▸</button>');
        d.onclick = function (e) { if (e.target.closest('a')) return; /* build fix: card opens detail again; shift-click or Select mode selects (mypets-checkbox: restored) */ if (!e.target.closest('.openbtn') && (e.shiftKey || document.body.classList.contains('selmode'))) return UXB.cardTap(p.id, e); goPet(p.id, e); }; }
      else d.onclick = function (e) { goPet(p.id, e); }; /* P10 (owner 2026-10-21): a card opens the pet page directly (Ctrl/Cmd-click: new tab) */
      return d; }
    renderPets.mk = mk; /* mypets-swipe: the One at a time view reuses the exact grid card (display only) */
    function put(ps, before) { var f = document.createDocumentFragment(); mk.reuse = true; var ds; try { ds = ps.map(function (p) { var d = mk(p); f.appendChild(d); return [d, p]; }); } finally { mk.reuse = false; } if (before) box.insertBefore(f, before); else box.appendChild(f);
      ds.forEach(function (x) { if (x[0]._reused) { x[0]._reused = 0; if (R.revive) R.revive(x[0].querySelector('canvas')); /* mypets-first3-1103: outline + animation back */ return; } R.lazy(x[0].querySelector('canvas'), function () { return petFrames(x[1], w); }); }); }
    /* bigfix 2026-10-20: Ranking-style paging. Only the first PG.n cards are built (150 a page); 'Show more (N left)' adds the next 150.
     * Counts, Select all, filters and bulk feed still work from the full list, not from the cards on screen. */
    var key = [cem ? 'c' : 'a'].concat(['fTier', 'fHide', 'fSort', 'fMin', 'fOrigin', 'fSearch', 'fSpecies', 'fDir'].map(function (k) { var e = $(k); return e ? (e.value != null && e.tagName !== 'BUTTON' ? e.value : e.textContent) : ''; })).join('|') + '|' + (S.ui_starOnly ? 's' : '') + '|' + (NF[cem ? 'c' : 'a'] ? 'n' : '') + '|z' + ZFK + '|t' + tokKind() + '|' + (window.UXB && UXB.spsKey ? UXB.spsKey() : ''); if (PG.key !== key) { PG.key = key; PG.n = CH; }
    var upto = Math.min(list.length, Math.max(CH, PG.n));
    put(list.slice(0, Math.min(CH, upto))); box.appendChild(tail);
    (function more(i) { if (i >= upto) return; setTimeout(function () { if (renderPets.tok !== tok || !tail.parentNode) return; put(list.slice(i, Math.min(upto, i + CH)), tail); more(i + CH); }, 0); })(CH);
    var autoLoad = !!(w._pages && (w._pages.n || 0) <= (window.V2Split && V2Split.AUTO_CAP || 5000));
    var morePages = !autoLoad && !!(w._pages && !w._full && (w._pages.got || 1) < w._pages.pages);
    if (list.length > upto || morePages) { var mb = document.createElement('div'); mb.className = 'row petmore'; mb.style.cssText = 'justify-content:center;margin:10px 0;width:100%;grid-column:1/-1';
      var leftMem = Math.max(0, list.length - upto);
      mb.innerHTML = '<button type="button" class="q" id="petMore">' + (leftMem ? 'Show more (' + fmt(leftMem) + ' left)' : 'Show more living pets') + '</button>';
      box.appendChild(mb); mb.querySelector('button').onclick = function (e) { e.stopPropagation();
        if (upto >= list.length && morePages && window.V2Split && V2Split.more) { PG.n = upto + CH; this.disabled = true; this.textContent = 'Loading more pets…'; V2Split.more(V2Split.SCREEN_PAGES || 7); return; }
        var i0 = upto; PG.n = upto + CH; upto = Math.min(list.length, PG.n); mb.remove();
        put(list.slice(i0, upto), tail); if (list.length > upto || morePages) { mb.querySelector('button').textContent = list.length > upto ? 'Show more (' + fmt(list.length - upto) + ' left)' : 'Show more living pets'; box.insertBefore(mb, tail.nextSibling); } else mb.remove();
        $('petPager').textContent = 'Showing ' + fmt(upto) + ' of ' + fmt(list.length) + ' pets'; if (window.UXB && UXB.sel) UXB.sel(); };
      /* Nov 22 2026: scrolling near the end shows the next batch by itself (players had to press Show more again and again). The button stays for keyboards. */
      if (window.IntersectionObserver) { var mbIo = new IntersectionObserver(function (es) { if (renderPets.tok !== tok || !mb.parentNode) { if (renderPets.tok !== tok) mbIo.disconnect(); return; }
        var bt = mb.querySelector('button'); if (es[0] && es[0].isIntersecting && bt && !bt.disabled) bt.click(); }, { rootMargin: '800px 0px' }); mbIo.observe(mb); } }
    /* Nov 25 2026 (Evan: "pets I can't feed because they are said to be in discard pile but they aren't"): the pile listed only THIS browser's
     * list, while My Pets also hides every pet discarded ON CHAIN (inPile). Pets discarded from another device, before a cache clear or by a burn
     * that landed on other pets were hidden everywhere: not in My Pets, not in the pile, and the feed check said 'discarded'. The pile is now
     * inPile's whole answer: this browser's list plus this wallet's living on-chain discards (⛓ chip, Restore signs the Add back burn). */
    var hs = hiddenSet(), gone = V2Own.pileList(w, ME, hs, !!cem); /* a risen zombie is never in the pile (inPile) */ /* one read of the discard list: parsing it once per owned pet froze My Pets when the pile held thousands */
    if (gone.length) box.appendChild(discardedBox(gone, w));
    if (!cem && V.hdPlan) { var hdBar = chainDiscardBar(w); if (hdBar) box.appendChild(hdBar); }
    if (!cem) { pileLink(gone.length); lastHatchLink(w); } /* discard-pile jump link; unopened-1125: the last hatch, always one tap away */
    $('petPager').textContent = partial ? (fmt(alive.length) + ' of ' + fmt(rost.alive) + ' loaded') : (w._pages && !w._full) ? 'Showing ' + fmt(Math.min(upto, list.length)) + ' of ' + fmt(list.length) + ' loaded · ' + fmt(w._pages.n) + ' living' : (list.length > upto ? 'Showing ' + fmt(upto) + ' of ' + fmt(list.length) + ' pets' : list.length + ' of ' + (cem ? dead.length : alive.length) + ' pets');
  }
  /* Discard pile (discard-pile, 2026-10-21; was 'Show discarded', build 2 2026-10-16). Display/localStorage only: no burn, nothing on chain.
   * Same cards as My Pets: name + #id + star, species / rarity / stage / fed state / gear / Power chips, a 'Last fed' line, Open ▸ (pet page) and ↩️ Restore.
   * Sort: recently discarded (the order pets went onto the pile), newest / oldest pet, rarity, species, stage, last fed, Power, plus ⇅ Reverse.
   * Filters: Rarity, Species, Search. Selection: 'Select all shown', Clear, 'Restore selected (N)', 'Restore all (N)'.
   * Alive tab = discarded living pets, Pet Cemetery tab = discarded dead pets. Starred pets are never discarded (discardIds skips them). */
  var DS = { open: false, flip: false, sort: 'recent', tier: 'all', sp: 'all', q: '', birth: '', sel: {}, n: 120 };
  var DS_SORTS = [['recent', 'Recently discarded'], ['weird', 'Weird first'], ['legend', 'Legends first'], ['new', 'Newest pet'], ['num', 'Oldest pet'], ['tier', 'Rarity'], ['species', 'Species'], ['stage', 'Stage'], ['fed', 'Last fed'], ['power', 'Power']];
  function dsRare(p) { var R2 = window.V2Render; return R2 && R2.rareInfo ? R2.rareInfo(p) : null; }
  function dsFed(p, w) { if (p.dead) return { chip: '🪦 Died of neglect', warn: true, line: 'Died of neglect' };
    var never = p.lastFed == null, ago = never ? null : Math.max(0, Math.floor(w.tip / 144) - Math.floor(p.lastFed / 144));
    var line = never ? 'Never fed' : ago === 0 ? 'Last fed today' : 'Last fed ' + ago + ' day' + (ago === 1 ? '' : 's') + ' ago';
    return { chip: p.fedToday ? 'Fed today ✓' : p.nextMeal ? 'Hungry · meal ' + fmt(p.nextMeal) : 'Full', warn: !!p.hungry, line: line }; }
  function pileSummary(n, open) { return '<details' + (open ? ' open' : '') + '><summary><span class="dp-title">🗑️ Discard pile</span> <span class="chip">' + n + ' pet' + (n === 1 ? '' : 's') + '</span> <span class="small muted">' + (open ? 'tap to close' : 'tap to open') + '</span></summary></details>'; }
  function pileToggle(det) { det.ontoggle = function () { if (discardedBox.busy || this.open === DS.open) return; DS.open = this.open; discardedBox.busy = true; try { render(); } finally { discardedBox.busy = false; } }; }
  function discardedBox(gone, w) {
    var hb = document.createElement('div'); hb.className = 'hiddenbox dpile'; hb.id = 'discardPile';
    /* Closed pile: title, count, and tap-to-open only. Filters, sort, cards, and sprites wait until it is opened. */
    if (!DS.open) { hb.innerHTML = pileSummary(gone.length, false); pileToggle(hb.querySelector('details')); return hb; }
    var order = hiddenIds(), pos = {}; order.forEach(function (id, i) { pos[id] = i; });
    var spOf = function (p) { return spLabel(p); }, spList = gone.map(spOf).filter(function (x, i, a) { return a.indexOf(x) === i; }).sort();
    if (DS.sp !== 'all' && spList.indexOf(DS.sp) < 0) DS.sp = 'all';
    var q = DS.q.trim().toLowerCase(), iq = window.V2PetSearch && V2PetSearch.idQuery && V2PetSearch.idQuery(DS.q), idSet = iq && iq.mode === 'ids' ? {} : null; if (idSet) iq.ids.forEach(function (id) { idSet[id] = 1; });
    var kinds = [], list = gone.filter(function (p) { var i = dsRare(p); if (i && kinds.indexOf(i.kind) < 0) kinds.push(i.kind);
      if (DS.birth === 'weird' && !(i && i.weird)) return false; if (DS.birth === 'legend' && !(i && i.legend)) return false; if (DS.birth && DS.birth !== 'weird' && DS.birth !== 'legend' && !(i && i.kind === DS.birth)) return false;
      if ((DS.tier !== 'all' && TIER_ID[p.tier] !== DS.tier) || (DS.sp !== 'all' && spOf(p) !== DS.sp)) return false;
      if (iq && iq.mode === 'bad') return false; if (idSet) return !!idSet[p.id];
      var blob = ('#' + p.id + ' ' + (p.name || '') + ' ' + spOf(p) + ' ' + (p.stageName || '') + (i ? ' ' + i.kind + ' ' + i.name + ' ' + i.label + (i.weird ? ' weird' : '') + (i.legend ? ' legend' : '') : '')).toLowerCase();
      return !q || blob.indexOf(q) >= 0; });
    var S0 = DS.sort, pw = function (p) { return window.UXB && UXB.power ? UXB.power(p) : 0; };
    if (S0 === 'weird' || S0 === 'legend') list.sort(function (a, b) { var ia = dsRare(a), ib = dsRare(b), ra = function (i) { return !i ? 0 : S0 === 'weird' ? (i.weird ? 2 : i.legend ? 1 : 0) : (i.legend ? 2 : i.weird ? 1 : 0); }; return ra(ib) - ra(ia) || String((ia && ia.kind) || '').localeCompare(String((ib && ib.kind) || '')) || a.id - b.id; });
    if (S0 === 'recent') list.sort(function (a, b) { return (pos[b.id] || 0) - (pos[a.id] || 0) || b.id - a.id; });
    if (S0 === 'new') list.sort(function (a, b) { return b.id - a.id; }); if (S0 === 'num') list.sort(function (a, b) { return a.id - b.id; });
    if (S0 === 'tier') { var DB = function (p) { return window.PetScore ? PetScore.bitsOf(w, p) : -1; }; list.sort(function (a, b) { return b.tier - a.tier || DB(b) - DB(a) || a.id - b.id; }); } /* rarity-sort */
    if (S0 === 'species') list.sort(function (a, b) { var x = spOf(a).toLowerCase(), y = spOf(b).toLowerCase(); return x < y ? -1 : x > y ? 1 : b.tier - a.tier || a.id - b.id; });
    if (S0 === 'stage') list.sort(function (a, b) { return b.stage - a.stage || b.care - a.care || b.id - a.id; });
    if (S0 === 'fed') list.sort(function (a, b) { var x = a.lastFed == null ? -1 : a.lastFed, y = b.lastFed == null ? -1 : b.lastFed; return y - x || b.id - a.id; });
    if (S0 === 'power') list.sort(function (a, b) { return pw(b) - pw(a) || a.id - b.id; });
    if (DS.flip) list.reverse();
    Object.keys(DS.sel).forEach(function (k) { if (!gone.some(function (p) { return String(p.id) === k; })) delete DS.sel[k]; });
    var nChain = gone.filter(onChainDiscarded).length;
    var nsel = Object.keys(DS.sel).length, shown = list.slice(0, DS.n), allOn = shown.length > 0 && shown.every(function (p) { return DS.sel[p.id]; });
    var inPile = 0; if (idSet) gone.forEach(function (p) { if (idSet[p.id]) inPile++; });
    var meta = iq && iq.mode === 'bad' ? 'Not pet numbers. Nothing was selected.' : iq && iq.mode === 'ids' ? (list.length + ' shown · ' + inPile + ' of ' + iq.ids.length + ' IDs in this pile' + (iq.ids.length - inPile > 0 ? ' · ' + (iq.ids.length - inPile) + ' not in this pile' : '') + (iq.capped ? ' · first ' + iq.ids.length + ' of ' + iq.pasted : '')) : (list.length + ' of ' + gone.length + ' match');
    var card = function (p) { var f = dsFed(p, w), on = !!DS.sel[p.id];
      return '<div class="dcard' + (on ? ' selected' : '') + (p.dead ? ' dead' : '') + '" data-did="' + p.id + '"><input type="checkbox" class="dcb" aria-label="Select #' + p.id + '"' + (on ? ' checked' : '') + '><canvas class="sprite" width="32" height="32"></canvas>' +
        '<h4>' + esc(p.name || spOf(p)) + ' <span class="muted">#' + p.id + '</span>' + (p.blackEye ? ' 🤕' : '') + (p.crowned ? ' 👑' : '') + '</h4>' +
        '<div class="chips"><span class="chip">' + esc(spOf(p)) + '</span>' + tierPill(p.tier, p) + '<span class="chip stg">' + esc((V.stageLabelOf ? V.stageLabelOf(p) : p.stageName)) + '</span><span class="chip' + (f.warn ? ' warn' : '') + '">' + f.chip + '</span>' +
        (R.eraChip ? R.eraChip(w, p) : '') +
        '<span class="chip gearchip" title="Gear worn / slots">🎒 ' + R.worn(w, p.id).length + '/' + p.capacity + ' slots</span>' + (window.UXB && UXB.power ? '<span class="chip pow"' + ptA(p) + '>⚡ ' + pw(p) + '</span>' : '') + (onChainDiscarded(p) ? '<span class="chip warn" title="Discarded on chain: hidden on every device and the rules never feed it. Restore signs a tiny Add back burn (1 dander).">⛓ On chain</span>' : '') + '</div>' +
        (window.PetScore && PetScore.discardInfo ? PetScore.discardInfo(w, p, spOf(p)) : '') +
        '<div class="small muted dp-fed">' + f.line + '</div>' +
        '<div class="row dp-acts"><a class="q" href="pet.html?id=' + p.id + '" aria-label="Open #' + p.id + '">Open ▸</a><button type="button" class="btn" data-restore="' + p.id + '" title="Put #' + p.id + ' back in My Pets">↩️ Restore</button></div></div>'; };
    hb.innerHTML = '<details' + (DS.open ? ' open' : '') + '><summary><span class="dp-title">🗑️ Discard pile</span> <span class="chip">' + gone.length + ' pet' + (gone.length === 1 ? '' : 's') + '</span> <span class="small muted">' + (DS.open ? 'tap to close' : 'tap to open') + '</span></summary>' +
      '<p class="small muted">Pets you discarded. ' + (nChain ? '<b>⛓ ' + fmt(nChain) + ' discarded on chain</b>: hidden on every device and never fed. Restoring them signs one tiny Add back burn (1 dander), nothing else. ' : '') + (nChain < gone.length ? 'The others are only hidden in this browser: Restore is free, no burn. ' : '') + 'Starred pets are never discarded.</p>' +
      '<div class="row small dctl dp-birth" role="group" aria-label="Birth trait">' + [['', 'All births'], ['weird', '🌀 Weird'], ['legend', '🏆 Legends']].concat(kinds.map(function (k) { var sample = gone.filter(function (p) { var i = dsRare(p); return i && i.kind === k; })[0], i = sample && dsRare(sample); return [k, (i && i.icon ? i.icon + ' ' : '') + (i && i.name || k)]; })).map(function (o) { return '<button type="button" class="q' + (DS.birth === o[0] ? ' on' : '') + '" data-dbirth="' + esc(o[0]) + '" aria-pressed="' + (DS.birth === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>' +
      '<div class="row small dctl"><label>Sort <xc-select data-ds="sort">' + DS_SORTS.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('') + '</xc-select></label> <button type="button" class="q" data-dsa="dir" aria-pressed="' + DS.flip + '" title="Reverse the order">⇅ Reverse</button> ' +
      '<label>Rarity <xc-select data-ds="tier"><option value="all">All</option>' + TIER_ID.map(function (t, k) { return '<option value="' + t + '">' + TL[k] + '</option>'; }).join('') + '</xc-select></label> ' +
      '<label>Species <xc-select data-ds="sp"><option value="all">All (' + gone.length + ')</option>' + spList.map(function (s) { return '<option value="' + esc(s) + '">' + esc(s) + ' (' + gone.filter(function (p) { return spOf(p) === s; }).length + ')</option>'; }).join('') + '</xc-select></label> ' +
      '<label>Search <input type="search" data-ds="q" placeholder="name, weird, or paste #ids" value="' + esc(DS.q) + '"></label> <span class="muted" data-ds="meta">' + meta + '</span></div>' +
      '<div class="row small dctl dsel"><label><input type="checkbox" data-dsa="selall"' + (allOn ? ' checked' : '') + '> Select all shown (' + shown.length + ')</label> <span class="dp-n">' + nsel + ' selected</span> <button type="button" class="q" data-dsa="none"' + (nsel ? '' : ' disabled') + '>Clear</button> ' +
      '<button type="button" class="btn" data-dsa="sel"' + (nsel ? '' : ' disabled') + '>↩️ Restore selected' + (nsel ? ' (' + nsel + ')' : '') + '</button> <button type="button" class="q" data-dsa="all">Restore all (' + gone.length + ')</button></div>' +
      '<div class="dgrid">' + (shown.length ? shown.map(card).join('') : '<p class="muted small">' + (iq && iq.mode === 'bad' ? 'Those entries are not pet numbers. Nothing was restored or discarded.' : iq && iq.mode === 'ids' ? 'None of those IDs are in the Discard pile.' : 'No discarded pets match.') + '</p>') + '</div>' +
      (list.length > shown.length ? '<p><button type="button" class="q" data-dsa="more">Show more (' + (list.length - shown.length) + ' left)</button></p>' : '') + '</details>';
    pileToggle(hb.querySelector('details'));
    hb.querySelector('[data-ds="sort"]').value = DS.sort; hb.querySelector('[data-ds="tier"]').value = DS.tier; hb.querySelector('[data-ds="sp"]').value = DS.sp;
    hb.querySelectorAll('[data-dbirth]').forEach(function (b) { b.onclick = function () { DS.birth = b.getAttribute('data-dbirth') || ''; DS.n = 120; render(); }; });
    hb.querySelectorAll('xc-select[data-ds]').forEach(function (x) { x.onchange = function () { DS[x.dataset.ds] = x.value; render(); }; });
    var si = hb.querySelector('[data-ds="q"]'), st = null; si.oninput = function () { clearTimeout(st); st = setTimeout(function () { DS.q = si.value; render(); var n = document.querySelector('.hiddenbox [data-ds="q"]'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 250); }; if (window.V2PetSearch && V2PetSearch.bindPaste) V2PetSearch.bindPaste(si);
    var selUpd = function () { var n = Object.keys(DS.sel).length, b = hb.querySelector('[data-dsa="sel"]'); b.disabled = !n; b.textContent = '↩️ Restore selected' + (n ? ' (' + n + ')' : ''); hb.querySelector('[data-dsa="none"]').disabled = !n; hb.querySelector('.dp-n').textContent = n + ' selected';
      hb.querySelector('[data-dsa="selall"]').checked = shown.length > 0 && shown.every(function (p) { return DS.sel[p.id]; }); };
    hb.querySelectorAll('.dcb').forEach(function (c) { c.onchange = function () { var d = c.closest('.dcard'), id = d.dataset.did; if (c.checked) DS.sel[id] = 1; else delete DS.sel[id]; d.classList.toggle('selected', c.checked); selUpd(); }; });
    hb.querySelector('[data-dsa="selall"]').onchange = function () { var on = this.checked; shown.forEach(function (p) { if (on) DS.sel[p.id] = 1; else delete DS.sel[p.id]; }); hb.querySelectorAll('.dcard').forEach(function (d) { d.classList.toggle('selected', on); d.querySelector('.dcb').checked = on; }); selUpd(); };
    hb.querySelectorAll('[data-restore]').forEach(function (a) { a.onclick = function (e) { e.preventDefault(); var id = Number(a.getAttribute('data-restore')); delete DS.sel[id]; pileRestore([id]); }; });
    hb.querySelectorAll('button[data-dsa]').forEach(function (b) { b.onclick = function () { var a = b.dataset.dsa; if (a === 'dir') { DS.flip = !DS.flip; return render(); } if (a === 'more') { DS.n += 120; return render(); } if (a === 'none') { DS.sel = {}; return render(); }
      var ids = a === 'all' ? gone.map(function (p) { return p.id; }) : Object.keys(DS.sel).map(Number); if (!ids.length) return;
      var nc = ids.filter(function (id) { return onChainDiscarded(w.byId[id]); }).length;
      if (ids.length > 1 && !window.confirm('Restore ' + (a === 'all' ? 'all ' : '') + ids.length + ' pets from the Discard pile to My Pets?\n\n' + (nc ? nc + ' of them ' + (nc === 1 ? 'was' : 'were') + ' discarded on chain: you sign one tiny Add back burn (1 dander) for ' + (nc === 1 ? 'it' : 'them') + '. ' : '') + (nc < ids.length ? (ids.length - nc) + ' only hidden in this browser come back free, no burn.' : ''))) return; DS.sel = {}; pileRestore(ids); }; });
    hb.querySelectorAll('.dcard').forEach(function (d) { var p = w.byId[d.dataset.did]; if (p) R.lazy(d.querySelector('canvas'), function () { return petFrames(p, w); }); });
    return hb; }
  /* pileRestore (Nov 25 2026, Evan): Restore in the pile undoes BOTH kinds of discard. Browser-only pets come back at once (free); pets
   * discarded on chain get the Add back burn (pet:hu) for exactly those pets, in the normal confirm sheet; they leave this browser's list too
   * once it confirms (sweepHu). Restoring only the browser list left an on-chain pet hidden, unfed and unfeedable. */
  function pileRestore(ids) { var w = world(), chain = [], local = [];
    ids.map(Number).forEach(function (id) { var p = w.byId[id]; if (onChainDiscarded(p) && !p.dead && !p.released) chain.push(id); else local.push(id); });
    if (local.length) restoreLocal(local);
    if (chain.length) { if (!(V.hdOn && V.hdOn((S.tip || 0) + 1))) return toast('These pets were discarded on chain. Add back opens again at block ' + fmt(V.ACTIVATE_ONCHAIN_DISCARD_BLOCK) + '.'); chainDiscardIds(chain, true); } }
  /* 'Discard pile (N)' jump link next to the bulk discard buttons: opens + scrolls to the pile */
  function openPile() { DS.open = true; var d = document.querySelector('#discardPile .dgrid'); if (d) { var det = d.closest('details'); if (det) det.open = true; d.scrollIntoView({ block: 'start' }); return; } render(); var d2 = document.querySelector('#discardPile details'); if (d2) d2.scrollIntoView({ block: 'start' }); }
  /* On-chain discard. The game never signs: this only fills the same confirm sheet as every other burn.
   * One burn is 1 dander. If the pets do not fit one 34-byte tag, the sheet says so and lists the exact burns. */
  function huKey() { return 'xcpets-hu-sent-' + NET + '-' + (ME || ''); }
  function noteHuSent(ids) { try { var cur = JSON.parse(sessionStorage.getItem(huKey()) || '[]'); sessionStorage.setItem(huKey(), JSON.stringify(cur.concat(ids))); } catch (e) {} }
  function sweepHu(w) { if (!ME || !w || !V.hdOn || !V.hdOn((S.tip || 0) + 1)) return; var cur; try { cur = JSON.parse(sessionStorage.getItem(huKey()) || '[]'); } catch (e) { return; }
    if (!cur || !cur.length) return; var drop = {}; cur.forEach(function (id) { var p = w.byId[id]; if (p && p.owner === ME && !p.hd) drop[id] = 1; });
    var hid = hiddenIds(), next = hid.filter(function (id) { return !drop[Number(id)]; }); if (next.length !== hid.length) setHidden(next);
    try { sessionStorage.setItem(huKey(), JSON.stringify(cur.filter(function (id) { return !drop[id]; }))); } catch (e) {} }
  /* clear-pile (Nov 23 2026): a discard tag names pets by their place in the owner's WHOLE living list (class filters and runs).
   * While the pet list is still arriving in pages that list is short here, so a run would point at different pets on chain.
   * Wait until every page is in (asking for the rest), then build the burn. Until then the pets are only hidden in this browser. */
  var hdWait = null;
  function hdSettleThen(ids, restore) { var w = world(), pg = w && w._pages; if (hatchListSettled(w)) return false;
    hdWait = { ids: (hdWait && hdWait.restore === !!restore ? hdWait.ids : []).concat(ids), restore: !!restore, until: Date.now() + 10 * 60e3 };
    var pull = function () { var w2 = world(), p2 = w2 && w2._pages; if (p2 && window.V2Split && V2Split.more) try { V2Split.more(Math.min(200, Math.max(1, (p2.pages || 1) - (p2.got || 1)))); /* Nov 23 2026: one big batch = one repaint (was 40 pages and a full repaint per batch) */ } catch (e) { } }; pull();
    toast('⏳ Loading the rest of your pets first, so the permanent burn names exactly these pets. It is offered as soon as they are in. Until then they are hidden in this browser only.', 9000);
    if (!hdSettleThen.t) hdSettleThen.t = setInterval(function () { if (!hdWait) { clearInterval(hdSettleThen.t); hdSettleThen.t = null; return; }
      if (Date.now() > hdWait.until) { hdWait = null; return; } if (!hatchListSettled(world())) return pull(); var job = hdWait; hdWait = null; chainDiscardIds(job.ids, job.restore); }, 3000);
    return true; }
  function chainDiscardIds(ids, restore) { var w = world(), b = (S.tip || 0) + 1; if (!V.hdOn(b)) return toast('On-chain discard opens at block ' + fmt(V.ACTIVATE_ONCHAIN_DISCARD_BLOCK) + '. Until then, Discard only hides pets in this browser.');
    if (hdSettleThen(ids, restore)) return;
    /* Nov 24 2026 (one safety check): a permanent discard is what feeds the Meat Grinder, so special pets get the same sheet as a sacrifice first */
    if (!restore && !chainDiscardIds._ok && window.V2SacGuard) return V2SacGuard.check({ w: w, ids: ids, me: ME, verb: 'discard them permanently',
      lead: 'You\'re about to discard these pets permanently, on every device. Pets discarded on chain can go in the Meat Grinder, where they are gone for good.',
      onGo: function (go) { if (!go.length) return; chainDiscardIds._ok = true; try { chainDiscardIds(go, false); } finally { chainDiscardIds._ok = false; } } });
    var plan = V.hdPlan(w, ME, ids, b, { restore: !!restore }); if (!plan || !plan.ok) return toast((plan && plan.why) || 'No exact burn for that selection.');
    var n = plan.plans.reduce(function (a, q) { return a + ((q.petIds && q.petIds.length) || 0); }, 0);
    var title = (restore ? 'Add ' + fmt(n) + ' pets back to My Pets' : 'Discard ' + fmt(n) + ' pet' + (n === 1 ? '' : 's') + ' permanently (every device)');
    if (!plan.one) title = 'This selection does not fit in one 34-byte burn. ' + plan.plans.length + ' exact burns, 1 dander each. ' + (plan.why || '');
    else title += plan.why ? ' · ' + plan.why : ''; /* burn-click-menu: the cost (1 burn, 1 dander + Bitcoin fee) is already in the sheet's amount line, not repeated in the title */
    confirmPlans(title, plan.plans, restore ? function () { noteHuSent(plan.plans.reduce(function (a, q) { return a.concat(q.petIds || []); }, [])); } : null); }
  function chainDiscardBar(w) { if (!ME || !V.hdPlan || !V.hdOn) return null; var b = (S.tip || 0) + 1, on = V.hdOn(b);
    var hid = hiddenIds().map(Number).filter(function (id) { var p = w.byId[id]; return p && V2Own.isLiving(p, ME, { zombies: false }) && !isKept(id); });
    var chain = (w.pets || []).filter(function (p) { return p.owner === ME && onChainDiscarded(p) && !p.dead && !p.released; }); /* inPile rule: an old flag on a risen zombie does not count */
    if (!hid.length && !chain.length) return null;
    var el = document.createElement('div'); el.className = 'small hdbar'; el.id = 'hdBar';
    el.innerHTML = '<p class="muted">' + (on ? 'On-chain discard is 1 dander for the burn, however many pets it names. If they do not fit one tag, you will see the smallest number of exact burns before anything is sent. The game does not sign the burn.' : 'On-chain discard opens at block ' + fmt(V.ACTIVATE_ONCHAIN_DISCARD_BLOCK) + '. Until then, Discard only hides pets in this browser.') + '</p>' +
      (hid.length ? '<button type="button" class="btn" id="hdMigrate">Make my browser discards permanent (' + fmt(hid.length) + ')</button> ' : '') +
      (on && chain.length ? '<button type="button" class="q" id="hdBack">Add discarded pets back (' + fmt(chain.length) + ')</button>' : '');
    var m = el.querySelector('#hdMigrate'); if (m) m.onclick = function () { chainDiscardIds(hid, false); };
    var bk = el.querySelector('#hdBack'); if (bk) bk.onclick = function () { chainDiscardIds(chain.map(function (p) { return p.id; }), true); };
    return el; }
  /* unopened-1125 (Jake: 'what if a player misses the popup'): '🥚 Last hatch (N)' next to the Discard pile reopens the review of your newest
   * hatch (every egg of the newest hatch block, last 7 days, still yours and not discarded), with Keep Rare & Legendary, Discard all, sort. */
  var LH = { w: null, ids: [] };
  function lastHatchIds(w) { var h = hiddenSet(); if (LH.w === w && LH.nh === h.size) return LH.ids; var top = 0, ids = [], lo = (w.tip || 0) - 1008, i, p;
    for (i = 0; i < w.pets.length; i++) { p = w.pets[i]; if (!p || p.owner !== ME || p.dead || p.released || p.community || p.lastGot != null || !(p.hatchBlock >= lo) || /^XCPETS:/.test(p.hatchTx || '') || inPile(p, h)) continue;
      if (p.hatchBlock > top) { top = p.hatchBlock; ids = []; } if (p.hatchBlock === top) ids.push(p.id); }
    LH = { w: w, nh: h.size, ids: ids }; return ids; }
  function lastHatchLink(w) { var a = $('lhJump'), ids = ME ? lastHatchIds(w) : []; if (!a) { var anc = $('bulkAnchor'); if (!anc || !ids.length) return; a = document.createElement('button'); a.type = 'button'; a.className = 'q'; a.id = 'lhJump'; anc.parentNode.appendChild(a);
      a.onclick = function () { var L = lastHatchIds(world()).slice(); if (!L.length) return; if (rev && $('packBox').classList.contains('on')) closeReveal(); revealQ.unshift({ kind: 'eggs', eggs: L, all: L.slice(), tray: 1, hatchAnim: 1, away: 1 }); released = true; nextReveal(); }; }
    a.hidden = !ids.length; a.textContent = '🥚 Last hatch (' + fmt(ids.length) + ')'; a.title = 'Open your newest hatch again: sort it, keep the best, discard the rest'; }
  function pileLink(n) { var a = $('dpJump'); if (!a) { var anc = $('bulkAnchor'); if (!anc) return; a = document.createElement('button'); a.type = 'button'; a.className = 'q'; a.id = 'dpJump'; anc.parentNode.appendChild(a);
      a.onclick = openPile; }
    a.hidden = !n; a.textContent = '🗑️ Discard pile (' + n + ')'; a.title = 'Open the Discard pile: restore pets you discarded'; }
  /* hotfix 2: a selection change only updates that card + the count (no full render / replay) */
  function selUi() { var w = world(), alive = mine(w).filter(function (p) { return !p.dead; }), cards = document.querySelectorAll('#pets .pet.card[data-pid]');
    var onSet = {}; for (var si = 0; si < S.sel.length; si++) onSet[S.sel[si]] = 1;
    $('selCount').textContent = S.sel.length + ' selected · ' + alive.filter(function (p) { return p.hungry; }).length + ' hungry';
    var all = cards.length > 0; cards.forEach(function (d) { var on = !!onSet[d.dataset.pid] || !!onSet[Number(d.dataset.pid)]; d.classList.toggle('selected', on); var cb = d.querySelector('.pick-cb'); if (cb) cb.checked = on; if (!on) all = false; }); $('selAll').checked = all; if (window.UXB) UXB.sel(); try { document.dispatchEvent(new CustomEvent('xcpets-sel')); } catch (e) { } } /* mypets-checkbox: 'xcpets-sel' tells the status line, swipe view and Rare Room the checked count changed */
  function toggle(id) { var i = S.sel.indexOf(id); if (i >= 0) S.sel.splice(i, 1); else S.sel.push(id); save(); selUi(); }
  $('tabAlive').onclick = function () { cem = false; this.classList.add('on'); render(); }; /* mypets-simple: the Pet Cemetery tab is gone (Places → Pet Cemetery, cemetery.html) */
  if ($('tabCem')) $('tabCem').onclick = function () { location.href = 'cemetery.html'; };
  /* favorite-star-restore: 'starred' is a real sort again (★ Starred first) and the Starred filter works again */
  (function () { var s = $('fSort'); if (!s || s.querySelector('option[value="weird"]')) return; var g = document.createElement('optgroup'); g.setAttribute('label', 'Birth'); var o = document.createElement('option'); o.value = 'weird'; o.textContent = '🌀 Weird first'; g.appendChild(o); s.appendChild(g); })();
  (function () { var s = $('fSort'); if (!window.V2TokFilter || !s || s.querySelector('option[value="tok"]')) return; var g = document.createElement('optgroup'); g.setAttribute('label', 'Token'); var o = document.createElement('option'); o.value = 'tok'; o.textContent = '🎟 Tokenized first'; g.appendChild(o); s.appendChild(g); })(); /* mypets-tok-filter: only when the filter module loaded, so a page without it does not grow a sort that does nothing */
  if ($('fTok') && window.V2TokFilter) { var tk0 = V2TokFilter.load(); if (tk0) $('fTok').value = tk0; $('fTok').onchange = function () { V2TokFilter.save(this.value); render(); }; } /* mypets-tok-filter: sessionStorage, same visit, like the zombie filter and Spam City filters */
  ['fTier', 'fSort', 'fHide'].forEach(function (id) { $(id).onchange = function () { S['ui_' + id] = this.value; save(); if (id === 'fSort' && resort()) return; render(); }; if (S['ui_' + id] != null) $(id).value = S['ui_' + id]; });
  if ($('fStarred')) { $('fStarred').setAttribute('aria-pressed', String(!!S.ui_starOnly)); $('fStarred').onclick = function () { S.ui_starOnly = !S.ui_starOnly; this.setAttribute('aria-pressed', String(S.ui_starOnly)); save(); render(); }; } /* favorite-star-restore */
  $('selAll').onchange = function () { var w = world(), hide = Number($('fHide').value), fT = $('fTier').value;
    var shown = V.hideAtOrBelow(mine(w).filter(function (p) { return !p.dead; }), hide).filter(function (p) { return fT === 'all' || TIER_ID[p.tier] === fT; });
    S.sel = this.checked ? shown.map(function (p) { return p.id; }) : []; save(); selUi(); };
  if ($('selMode')) $('selMode').onclick = function () { var on = document.body.classList.toggle('selmode'); this.classList.toggle('on', on); this.setAttribute('aria-pressed', on ? 'true' : 'false'); toast(on ? 'Select mode on: tap cards to select' : 'Select mode off: tap a card to open it'); };
  $('selNone').onclick = function () { S.sel = []; save(); selUi(); toast('Selection cleared'); }; /* Select none */
  /* Feed all hungry / Feed selected NEVER include a discarded pet: the browser discard list, or an on-chain pet:hd flag.
   * Filtered by those sets, not by what is on screen, so a cache clear or an active filter can't feed a discarded pet. */
  function noDiscarded(plans) { var h = hiddenIds(); return plans.filter(function (q) { return h.indexOf(q.petId) < 0 && !(q.petId && onChainDiscarded(world().byId[q.petId])); }); }
  /* bigfix 2026-10-20: big feeds are planned in small slices (V.feedQueueAsync) with a progress bar in the confirm box, so the page never freezes.
   * The overfeed guard runs on the pet list first, so the plan is built once. Same burns as before. */
  var feedTok = 0;
  function feedAsync(title, ids, list) { if (viewBlock()) return; if (!ME) return confirmPlans(title, []);
    var w = world(), hs = new Set(hiddenIds()), hungry = ids.filter(function (id) { var p = w.byId[id]; return !hs.has(id) && p && p.owner === ME && p.hungry && !onChainDiscarded(p); });
    if (runsOn(w) != null) { var gr = guardIds(w, hungry); if (!gr.ok.length) return feedBlocked(title, gr.text); return confirmPlans(title, noDiscarded(feedQ(w, ME, gr.ok, undefined, list)), null, gr); } /* feed-all-one-burn: runs plan, no slow planner */
    if (hungry.length < 300 || !V.feedQueueAsync) return confirmPlans(title, noDiscarded(feedQ(w, ME, hungry, undefined, list)));
    var g = guardIds(w, hungry), tok = ++feedTok; if (!g.ok.length) return feedBlocked(title, g.text); /* habits-ux: block, never the unguarded queue */
    pendingPlans = null; $('cfTitle').textContent = title;
    $('cfBody').innerHTML = '<p class="small">🍖 Getting your meals ready for <b>' + fmt(g.ok.length) + '</b> hungry pets…</p><div class="bar"><i id="pg" style="width:0"></i></div><div class="small" id="pgt">0 of ' + fmt(g.ok.length) + ' pets</div>';
    $('cfYes').textContent = window.XcpHandoff && XcpHandoff.on() ? '\ud83d\udcf2 Add to my computer list' : 'Sign & burn in ' + (V2Wallet.label ? V2Wallet.label() : 'XCP Wallet'); $('cfNo').textContent = 'Cancel'; $('cfYes').disabled = true; $('cfNo').disabled = false; open('confirmBox');
    var t0 = performance.now();
    V.feedQueueAsync(w, ME, g.ok, faNb(w, null, list), function (d, n) { if (tok !== feedTok) return; var pc = n ? 100 * d / n : 100; if ($('pg')) $('pg').style.width = pc.toFixed(1) + '%'; if ($('pgt')) $('pgt').textContent = fmt(d) + ' of ' + fmt(n) + ' pets'; })
      .then(function (plans) { if (list) plans = plans.filter(function (q) { return !isFeedAllTag(q && q.tag); }); window.V2LastFeedPlanMs = Math.round(performance.now() - t0); if (tok !== feedTok || !$('confirmBox').classList.contains('on')) return; confirmPlans(title, noDiscarded(plans), null, g); }, function (e) { toast('Could not plan the feed: ' + esc(String(e && e.message || e))); });
  }
  $('cfNo').addEventListener('click', function () { feedTok++; });
  if (FEED_ALL_PAUSED) { $('bFeedHungry').style.display = 'none'; $('bFeedHungry').insertAdjacentHTML('afterend', '<span class="small muted" id="faPaused">' + FA_NOTE + '</span>'); }
  $('bFeedHungry').onclick = function () { if (FEED_ALL_PAUSED) return toast(FA_NOTE); var w = world(); feedAsync('Feed all hungry pets', w.pets.filter(function (p) { return p.owner === ME; }).map(function (p) { return p.id; })); };
  $('bFeedSel').onclick = function () { feedAsync('Feed selected pets', window.UXB && UXB.shownSel ? UXB.shownSel(sel()) : sel(), true); }; /* mypets-species-filter: only the checked pets that are shown */
  $('bRoll').onclick = function () { var ids = pickIds(), rn = Math.max(1, Math.min(10, Number($('rollN').value) || 1)), q = V.rollQueue(world(), ME, ids, rn); if (!ids.length) return toast('☑ Tick pets in My Pets first: the roll acts on your selected pets.'); var sp = ids.length + ' selected pet' + (ids.length === 1 ? '' : 's'), wh = q.length && q[0].tag === 'pet:spin'; confirmPlans(wh ? '🎡 ' + q.length + ' wheel spin' + (q.length === 1 ? '' : 's') + ' for your ' + sp + ' (' + rn + ' each; the wheel picks a random pet)' : '🎲 Roll gear for your ' + sp + ' · ' + q.length + ' roll' + (q.length === 1 ? '' : 's'), q); }; /* mypets-checkbox: selected pets */
  if ($('bRelease')) $('bRelease').onclick = function () { if (V.retiredUI && V.retiredUI(world())) return toast('Release (pet:rel) was retired at block ' + V.retireGate() + '. Use Discard instead.'); if (!S.sel.length) return toast('Select pets first'); confirmPlans('Release ' + S.sel.length + ' pets (max ' + V.MAX_RELEASE_PER_BURN + ' per burn)', V.releaseBatches(sel())); };
  $('bAuto').onclick = function () { if (viewBlock()) return; var ids = pickIds(); if (!ids.length) return toast('☑ Tick pets in My Pets first: Auto-equip acts on your selected pets.'); var plan = window.V2LairQoL && V2LairQoL.autoEquipOps ? V2LairQoL.autoEquipOps : V.autoEquipOps, ops = plan(world(), ME, ids, S.tip); S.ops = S.ops.concat(ops); save(); toast('✨ Auto-equip on ' + ids.length + ' selected pet' + (ids.length === 1 ? '' : 's') + ': ' + ops.length + ' pieces (free, no burn)'); render(); }; /* mypets-checkbox: selected pets. The lair planner picks the same pieces without scanning every item for every pet. */
  if ($('bOutfit')) $('bOutfit').onclick = function () { if (viewBlock()) return;
    if (!pickIds().length) return toast('☑ Tick pets in My Pets first: Outfit acts on your selected pets.'); var w = world(), inv = w.itemList.filter(function (g) { return g.owner === ME && g.on == null; });
    $('outfitBody').innerHTML = '<p class="small">Uses free copies from your stash. Missing copies or closed slots are skipped.</p>' + V.V2_SLOTS.map(function (sl) { var k = {}; inv.filter(function (g) { return g.slot === sl; }).forEach(function (g) { (k[g.item] = k[g.item] || { l: g.label, n: 0 }).n++; });
      return '<div class="row small"><b class="slotname">' + SL(sl) + '</b> <xc-select class="pick" data-o="' + sl + '"><option value="">(leave)</option>' + Object.keys(k).map(function (id) { return '<option value="' + id + '">' + esc(k[id].l) + ' · ' + k[id].n + ' free ' + (k[id].n === 1 ? 'copy' : 'copies') + (k[id].n < S.sel.length ? ' (not enough for ' + S.sel.length + ')' : '') + '</option>'; }).join('') + '</xc-select></div>'; }).join('') + '<p class="small muted">' + S.sel.length + ' pets selected. Each pet needs its own free copy (one item = one pet).</p>';
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
  function statBars(p) { var MAX = 31, tot = 0, st = p.stats || {}; return PetCore.STAT_KEYS.map(function (k) { var v = st[k] || 0; tot += v; return '<div class="stat"><span class="sk">' + k.toUpperCase() + '</span><span class="sbar"><i style="width:' + Math.min(100, 100 * v / MAX).toFixed(0) + '%"></i></span><b>' + v + '</b></div>'; }).join('') + '<div class="stat tot"><span class="sk">TOTAL</span><b>' + tot + '</b></div>'; }
  /* family-tree-fix (2026-10-19): the root also lists its own children (V2Render's chart replaces this ul.tree with ancestors above + children below). */
  function tree(t, kids) { if (!t) return ''; var w0 = kids && world(), ch = kids && w0 ? (t.children || []).map(function (id) { return w0.byId[id]; }).filter(Boolean) : [];
    return '<ul class="tree"><li>#' + t.id + ' ' + esc(t.name) + ' <span class="muted">' + spLabel(t) + ' · ' + (t && t.resurrected ? 'God' : TL[t.tier]) + '</span>' + t.parents.map(function (x) { return tree(x); }).join('') +
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
  /* feed-return (Nov 2 2026, owner 7:10 PM CT): a feed started on pet.html (play.html#act-feed-ID-pet) goes back to that pet page:
   * sent -> pet.html?id=ID&fed=<tip> (the pet page shows the fed status), closed / cancelled -> pet.html?id=ID. Other feeds (My Pets, Feed all, cards) stay on Play as before. UI only. */
  function petBackGo(id, tip) { actBack.going = 1; location.href = 'pet.html?id=' + id + (tip ? '&fed=' + tip : ''); }
  function actBack(p, back) { actBack.going = 0; setTimeout(function () { var cb = $('confirmBox'); if (!cb || !cb.classList.contains('on')) return; var link = '<a href="pet.html?id=' + p.id + '">← Back to #' + p.id + ' ' + esc(p.name || '') + '</a>';
      $('cfBody').insertAdjacentHTML('afterbegin', '<p class="small cf-back">' + link + (back ? ' <span class="muted">· you return there after the feed</span>' : '') + '</p>');
      var mo = new MutationObserver(function () { if (cb.classList.contains('on')) return; mo.disconnect(); if (actBack.going) return; if (back) return petBackGo(p.id); toast(link + ' <span class="muted">· results show on the pet page once the burn confirms</span>', 15000); }); mo.observe(cb, { attributes: true, attributeFilter: ['class'] }); }, 50); }
  /* card-actions-fast (Nov 26 2026, Jake: "I pressed Unleash on a Mythic and it just went back to My Pets"): every hand-off from the pet
   * page, the Pet Cemetery card and the gift / swap sheets (#act-, #gift-, #swap-, #cem-) waited for burn rows (S.rows), but a fast
   * (published-world) page never has burn rows, so the link sat for 3 minutes in silence and was then dropped. They now wait for the
   * page's own world (V2Mock.ready, the same test the Fire Sale banner uses), say what they are opening, fetch a pet the slim world has
   * not loaded yet, and say plainly when it still cannot open. They open a pop-up over My Pets and never touch its filter or sort.
   * Nothing is ever sent from here: every burn still goes through the confirm sheet. */
  function routeReady() { if (!ME) return false; try { return (M.ready ? !!M.ready() : !!(S.rows && S.rows.length)) && !!world(); } /* ready first: world() before then would replay an empty chain */ catch (e) { return false; } }
  function routeWait(fn, what, id) { var h = location.hash, k = fn.wait && fn.wait.h === h ? fn.wait : (fn.wait = { h: h, n: 0 }); k.n++;
    var WL = window.V2Wallet && V2Wallet.label ? V2Wallet.label() : 'XCP Wallet';
    if (k.n === 3) toast(ME ? '⏳ Opening ' + what + '… (still loading your pets)' : 'Connect ' + esc(WL) + ' to open ' + what + '. It opens here once connected.', 12000);
    if (id && !k.asked && ME && routeReady() && !world().byId[id] && window.V2Split && V2Split.ensurePet) { k.asked = 1; V2Split.ensurePet(+id).then(function () { if (location.hash === h) fn(); }, function () {}); }
    if (k.n < 90) { setTimeout(function () { if (location.hash === h) fn(); }, 2000); return true; }
    fn.wait = null; history.replaceState(null, '', location.pathname + location.search);
    toast('⚠️ ' + what.charAt(0).toUpperCase() + what.slice(1) + ' did not open: ' + (!ME ? 'no wallet is connected' : !routeReady() ? 'the game data did not finish loading' : 'this page could not find pet #' + id) + '. Nothing was sent. Reload the page and press it again.', 20000); return true; }
  /* pet-gift: pet.html / the batch picker arrive as play.html#gift-<id.id.id>-<player# base 32>; the confirm then signs each 1-dander burn in turn
   * (same confirmPlans queue: one XCP Wallet window at a time, Stop + Resume). Locked pets are dropped here and skipped by the engine anyway. */
  function swapRoute() { var m = /^#(swap)-(\d+)-(\d+)$|^#(swapok|swapno)-(\d+)$/.exec(location.hash); if (!m || !V.swapPlan) return false; if (V.tokenOnly && V.tokenOnly()) { history.replaceState(null, '', location.pathname + location.search); toast('🔁 Swap burns are off: swap by gifting each other the pet tokens, or a token-for-token DEX order.', 9000); return true; }
    if (!routeReady()) return routeWait(swapRoute, 'the swap'); swapRoute.wait = null;
    history.replaceState(null, '', location.pathname + location.search);
    if (m[1]) confirmPlans('🔁 Offer #' + m[2] + ' for #' + m[3], [V.swapPlan(Number(m[2]), Number(m[3]))]); else if (m[4] === 'swapok') confirmPlans('🔁 Accept swap ' + m[5], [V.swapOkPlan(Number(m[5]))]); else confirmPlans('Close swap offer ' + m[5], [V.swapNoPlan(Number(m[5]))]); return true; }
  window.V2HiGo = function () { confirmPlans('👋 Get my player #', [V.hiPlan]); };
  window.V2SwapGo = function (h) { location.hash = h; swapRoute(); };
  function giftRoute() { if (swapRoute()) return true; var m = /^#gift-([0-9.]+)-([0-9A-Va-v]+)$/.exec(location.hash); if (!m || !V.giveBatches) return false;
    if (V.tokenOnly && V.tokenOnly()) { history.replaceState(null, '', location.pathname + location.search); toast('🎁 Gifts are pet token sends now: use 🎁 Gift (pick pets, paste the address, Send).', 9000); return true; }
    if (!routeReady()) return routeWait(giftRoute, 'the gift'); giftRoute.wait = null; var w = world();
    history.replaceState(null, '', location.pathname + location.search); var n = parseInt(m[2], 32), b = (S.tip || 0) + 1, ok = [], no = [];
    m[1].split('.').map(Number).forEach(function (id) { var why = V.giveWhy(w, { petId: id, to: n }, ME, b); if (why) no.push('#' + id + ' ' + why); else ok.push(id); });
    if (no.length) toast('🎁 Not in the gift: ' + esc(no.join(' · ')), 9000); if (!ok.length) return true;
    confirmPlans('🎁 Gift ' + ok.length + ' pet' + (ok.length > 1 ? 's' : '') + ' to player #' + V.playerCode(n), V.giveBatches(ok, n)); return true; }
  window.V2GiftConfirm = function (ids, n) { location.hash = 'gift-' + ids.join('.') + '-' + V.playerCode(n); giftRoute(); };
  /* CEMETERY LOOP (Oct 29 2026): cemetery.html hands its burns here (#cem-<tag>~<tag>…), so they go through this page's one guarded confirm sheet
   * (send guard, stale check, fee line, XCP Wallet signing). Only cemetery tags and hunts (pet:fight on a zombie) are accepted; each amount is
   * worked out again here from the cost list at the next block (V.cemCost, halving-aware), never taken from the link. */
  var CEM_KIND = { seance: 'seance', alt: 'pledge', altm: 'pledge', altg: 'pledge', raise: 'raise', zfeed: 'zmeal', zfm: 'zmeal', rpl: 'rpl', rplg: 'rpl', resurrect: 'resurrect' };
  var CEM_ROUTE_MAX = 200;
  function cemRoute() { var m = /^#cem-(.+)$/.exec(location.hash); if (!m || !V.cemCost) return false; var tags; try { tags = decodeURIComponent(m[1]).split('~'); } catch (e) { return false; } /* was .slice(0, 24): a 25th+ tag (often the seance itself, it is last) was dropped without a word */
    if (tags.length > CEM_ROUTE_MAX) { history.replaceState(null, '', location.pathname + location.search); toast('That cemetery link holds ' + tags.length + ' burns, more than ' + CEM_ROUTE_MAX + ' at once. Offer fewer pets per send.'); return true; }
    if (!routeReady()) return routeWait(cemRoute, 'your ' + tags.length + ' cemetery burn' + (tags.length > 1 ? 's' : '') + ' (your offering is also saved in the Pet Cemetery)'); cemRoute.wait = null; var w = world(); /* wait for the wallet and the page's world (card-actions-fast: no longer burn rows, which fast pages never have) */
    history.replaceState(null, '', location.pathname + location.search); var b = (S.tip || 0) + 1, bad = null;
    var plans = tags.map(function (tag) { var t = V.parseTag(tag); if (!t) { bad = bad || tag; return null; } var rn = null; if (t.action === 'cemr') { if (!V.cemRunsOn || !V.cemRunsOn(b) || !V.cemRunsCost) { bad = bad || tag; return null; } rn = { kind: t.kind, n: V.cemRunsIds(w, ME, t, b).length }; if (!rn.n) { bad = bad || tag; return null; } t = { action: t.kind, grave: t.kind === 'alt' || t.kind === 'seance' ? t.target : null, zombie: t.kind === 'zfeed' || t.kind === 'rpl' ? t.target : null }; } var k = CEM_KIND[t.action] || (t.action === 'fight' && w.byId[t.b] && ZB(w.byId[t.b]) ? 'hunt' : null); if (!k) { bad = bad || tag; return null; }
      return { tag: tag, amount: rn ? V.cemRunsCost(w, rn.kind, rn.n, b) : (V.cemPetAmount ? V.cemPetAmount(w, { tag: tag, amount: V.cemCost(w, k, b) }, b).amount : V.cemCost(w, k, b)), runs: rn ? true : undefined, ids: rn ? V.cemRunsIds(w, ME, V.parseTag(tag), b) : undefined, petId: t.grave != null ? t.grave : t.zombie != null ? t.zombie : t.b, label: k }; }).filter(Boolean);
    var nPets = 0; tags.forEach(function (tag) { var t = zParse(tag); if (t && t.ids && !/^(altg|rplg)$/.test(t.action)) nPets += t.ids.length; });
    if (bad || !plans.length) { toast('That cemetery link holds a burn this page does not send (' + esc(String(bad || 'none')) + ').'); return true; }
    var hunt = plans[0].label === 'hunt', ttl = hunt ? '🗡️ Zombie hunt' : '🕯️ Cemetery: ' + (nPets ? fmt(nPets) + ' pet' + (nPets > 1 ? 's' : '') + ' in ' : '') + plans.length + ' burn' + (plans.length > 1 ? 's' : '');
    saveResume(ttl, plans); resumeShown = true; /* cemetery-handoff (Nov 1 2026): the link's burns are saved before the sheet opens, so Cancel, a wallet reload or a closed tab no longer loses them (the usual Continue / Dismiss note offers them again) */
    confirmPlans(ttl, plans); return true; }
  /* pet-page-zombies: play.html#act-unleash-ID (the Unleash link on the pet page and in the Pet Cemetery) opens that zombie's pop-up here,
   * where the Unleash button keeps its live chain-tip checks */
  function unleashRoute() { var m = /^#act-unleash-(\d+)$/.exec(location.hash); if (!m) return false; var w = world(), p = w && w.byId[m[1]];
    if (!routeReady() || !p) return routeWait(unleashRoute, 'Unleash for #' + m[1], m[1]); unleashRoute.wait = null;
    history.replaceState(null, '', location.pathname + location.search); detailId = p.id; detail(p);
    /* card-actions-fast: land on the Unleash part of the pop-up (it sits under the big picture), or say why there is none */
    (function aim(n, hit) { var on = $('detail').classList.contains('on'), u = on && $('dInfo').querySelector('.mg-unl'), box = $('detail').querySelector('.box');
      if (u && box) { var r = u.getBoundingClientRect(), br = box.getBoundingClientRect(); if (r.top < br.top || r.bottom > br.bottom) box.scrollTop += r.top - br.top - Math.max(0, (br.height - r.height) / 2);
        if (!hit) { u.style.boxShadow = '0 0 0 3px #ff6b5a, 0 0 16px rgba(255,107,90,.6)'; setTimeout(function () { var v = $('dInfo').querySelector('.mg-unl'); if (v) v.style.boxShadow = ''; }, 2600); }
        if (n < 3) setTimeout(function () { aim(n + 1, true); }, 700); return; } /* the pop-up repaints once more as the page settles, so aim again twice */
      if (hit || !on) return; if (n < 8) return setTimeout(function () { aim(n + 1); }, 500);
      toast(p.owner !== ME ? '#' + p.id + ' is not in your wallet, so you can\'t unleash it.' : '#' + p.id + ' can\'t be unleashed right now: it has to be your feral zombie, not fed by a Mythic, and you can unleash once every 30 days. The pop-up shows its state.', 12000); })(0);
    return true; }
  function actRoute() { if (cemRoute()) return true; if (giftRoute()) return true; if (unleashRoute()) return true; var m = /^#act-(feed|roll|froll|oroll)-(\d+)(-pet)?$/.exec(location.hash); if (!m) return false;
    var w = world(), p = w && w.byId[m[2]], a = m[1]; if (!routeReady() || !p) return routeWait(actRoute, ({ feed: 'Feed', roll: 'Gear roll', froll: 'Free roll', oroll: 'Overflow roll' })[a] + ' for #' + m[2], m[2]); actRoute.wait = null; /* card-actions-fast: wait for the page's world, not burn rows */
    history.replaceState(null, '', location.pathname + location.search); var back = !!m[3] && a === 'feed', bounce = function () { if (back) setTimeout(function () { petBackGo(p.id); }, 3500); return true; };
    if (!ME || p.owner !== ME || p.dead || p.released) { toast('Only the owner of a living pet can do that. Connect the wallet that owns #' + p.id + '.'); return true; } /* stays on Play: the wallet connect is here */
    if (a === 'feed') { if (p.mythicCare || !p.hungry) { toast('#' + p.id + (ZB(p) ? ' is a risen zombie: it eats pets, not meals. Use 🍖 Feed zombie on its card.' : p.mythicCare ? ' is Mythic: no meals needed.' : ' is not hungry right now.')); return bounce(); } actBack(p, back); confirmPlans('Feed #' + p.id, feedQ(w, ME, [p.id]), back ? function () { petBackGo(p.id, (S.tip || 0) + 1); } : null); }
    else { actBack(p); if (a === 'froll') confirmPlans('Free roll #' + p.id, [V.freeRollPlan(p.id)]); else if (a === 'oroll') confirmPlans('Overflow roll #' + p.id, [V.overflowRollPlan(p.id)]);
    else confirmPlans('Gear roll #' + p.id, V.rollQueue(w, ME, [p.id], 1)); } return true; }
  function detail(p, w) {
    if (!p) return; w = w || world(); $('dTitle').innerHTML = (p.owner === ME && !p.dead ? keepBtn(p.id) : '') + esc(p.name) + ' <span class="muted">#' + p.id + '</span> ' + tierPill(p.tier, p);
    var kb = $('dTitle').querySelector('.keepbtn'); if (kb) kb.onclick = function (e) { e.preventDefault(); toggleKeep(p.id); };
    var frs = petFrames(p, w); paint($('dCanvas'), frs[0]); R.animate($('dCanvas'), frs);
    $('dStats').innerHTML = (R.eraChip ? R.eraChip(w, p) : '') + statBars(p);
    var inv = w.itemList.filter(function (g) { return g.owner === ME && g.on == null; }), legAll = V.legendaryOf(p.species), leg = legAll[0];
    var h = '<a class="btn openpet" id="dOpenPet" href="pet.html?id=' + p.id + '">Open pet page →</a>' + (window.V2Rivals ? V2Rivals.strip(w, p.id, function (fid) { return 'fight.html#replay-' + fid; }) : '') + (R.bredFrom ? '<div class="chips dbred">' + R.bredFrom(w, p, true) + '</div>' : '') + '<p>' + esc(spLabel(p)) + ' · ' + p.stageName + ' · care ' + fmt(p.care) + ' / ' + fmt(R.careTarget(w, p, S.tip).mythic) + (R.careTarget(w, p, S.tip).discount ? ' (Mythic at ' + fmt(R.careTarget(w, p, S.tip).mythic) + ' care because you raised a Mythic)' : '') + (p.species === 'nakamoto' && !V.nakaNormal(S.tip) ? ' (Nakamoto: 10× thresholds until block ' + fmt(V.ACTIVATE_NAKA_NORMAL_BLOCK) + ', then normal growth)' : '') + ' · W' + (p.wins || 0) + '/L' + (p.losses || 0) + '</p>';
    if (ZB(p)) h += (window.V2Zombies && V2Zombies.hungerBar ? V2Zombies.hungerBar(p, world()) : '') + zZoneHtml(p, world());
    /* mg-road: a violet grave and a Mythic God are not zombies, so their step panel is added here. */
    else if (window.V2MgRoad && (p.mgDead || p.mythicGod)) { try { h += V2MgRoad.html(w, p, ME); } catch (e) {} }
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
    R.gearPicker($('gPicker'), { compact: true, world: w, owner: ME, pet: p, msg: detail.msg, viewOnly: viewOnly(), onBlocked: viewBlock, onEquip: function (op, m) { if (viewBlock()) return; op.block_index = S.tip; S.ops.push(op); save(); detail.msg = '✓ ' + m; refreshGear(p.id); detail.msg = null; toast(esc(m) + ' (free)'); },
      onEquipMany: function (ops, m) { if (viewBlock()) return; ops.forEach(function (op) { op.block_index = S.tip; S.ops.push(op); }); save(); detail.msg = '✓ ' + m; refreshGear(p.id); detail.msg = null; toast(esc(m) + ' (free)'); } });
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
  /* rare-room-unequip: a free equip only redraws the dressing room (and this pet's open gear box). It does not rebuild My Pets, the arena, the raid list or the log. */
  function refreshGear(pid) { var w; try { w = world(); } catch (e) { return; }
    if (window.V2Shop && V2Shop.afterGear) { try { V2Shop.afterGear(w, pid); } catch (e) { if (window.console) console.error(e); } }
    if (detailId && $('detail').classList.contains('on') && w.byId[detailId]) { var msg = detail.msg; detail(w.byId[detailId], w); detail.msg = msg; }
    var chip = pid && document.querySelector('#pets .pet.card[data-pid="' + pid + '"] .gearchip'), pet = pid && w.byId[pid];
    if (chip && pet) chip.textContent = '🎒 ' + (V.wornOf ? V.wornOf(w, pet.id).length : 0) + '/' + pet.capacity + ' slots';
  }
  function lairRender(w) { if (lairOn()) lairPaint(w); else lairStale = true; }
  function renderInv(w) {
    var items = w.itemList.filter(function (g) { return g.owner === ME; }), box = $('inv'); var nFree = items.filter(function (g) { return g.on == null; }).length; $('invCount').textContent = items.length; if ($('invCountTxt')) $('invCountTxt').textContent = (items.length === 1 ? 'piece' : 'pieces') + ' of gear · ' + nFree + ' unworn'; /* one gear count (owner Oct 20 2026): same 'N pieces · U unworn' as the Lair */
    $('tokens').textContent = String(V.tokensOf(w, ME)); // roll tokens this wallet's pets found (each already became a free gear item)
    /* freeze-hunt (Nov 22 2026): the first render runs before js/ux-batch.js has loaded, so it drew this whole per-piece grid (one icon per
     * gear piece; the 0.3 to 1 s freeze when My Pets opens, measured) and ux-batch threw it away right after. Hidden panel: skip it.
     * ux-batch still loading: wait one turn and let it paint its own stash. */
    var ipn = $('invPanel'); if (ipn && ipn.hidden) return;
    if (!window.UXB && (renderInv.n = (renderInv.n || 0) + 1) <= 100 && document.querySelector('script[src*="js/ux-batch.js"]')) { clearTimeout(renderInv.t); renderInv.t = setTimeout(function () { var w2 = world(); if (window.UXB && UXB.paintInv) { if (lairOn()) UXB.paintInv(w2); } else renderInv(w2); }, 50); return; }
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
      b.innerHTML = '<div class="box"><h2 class="sec" data-ico="flame">Connect to burn</h2><p class="small" id="nwMsg"></p><div class="row" style="justify-content:center"><button type="button" class="btn" id="nwConnect">🔌 Connect ' + esc((window.V2Wallet && V2Wallet.label ? V2Wallet.label() : 'XCP Wallet')) + '</button><button type="button" class="btn ghost" id="nwView">👀 View by address</button><button type="button" class="q" id="nwCancel">Cancel</button></div></div>';
      document.body.appendChild(b); b.addEventListener('click', function (e) { if (e.target === b) close('nwBox'); });
      $('nwCancel').onclick = function () { close('nwBox'); };
      $('nwConnect').onclick = function () { close('nwBox'); var wc = $('wconnect'); if (wc) wc.click(); };
      $('nwView').onclick = function () { close('nwBox'); var av = $('addrView'), inp = $('avAddr'); if (av) { av.hidden = false; try { av.scrollIntoView({ block: 'center', behavior: 'instant' }); } catch (e) { } } if (inp) try { inp.focus({ preventScroll: true }); } catch (e) { } }; }
    $('nwMsg').innerHTML = msg; open('nwBox'); }
  function viewOnly() { return !!(ME && window.V2View && window.V2View.viewOnly()); }
  function viewBlock() { if (!viewOnly()) return false;
    nwSheet('👀 Viewing ' + esc(V2View.short(ME)) + ': view only. Connect the ' + (window.V2Wallet && V2Wallet.label ? V2Wallet.label() : 'XCP Wallet') + ' that owns these pets to feed, equip, battle, breed or roll.');
    return true; }
  function zEatNote(plans, w) { var ids = []; plans.forEach(function (q) { if (q && q.zEat) ids = ids.concat(q.zEat); else { var t = q && /^pet:(zfeed|zfm|zr):/i.test(q.tag || '') && V.parseTag ? zParse(q.tag) : null; if (t && t.ids) ids = ids.concat(t.ids.map(Number)); } }); if (!ids.length) return '';
    return '<p class="small warn zb-eatnote">🧟 The zombie eats these pets for good: ' + ids.map(function (f) { var F = w.byId[f]; return '<b>' + esc((F && F.name) || '#' + f) + ' #' + f + '</b>' + (F ? ' (' + TL[F.tier | 0] + ')' : ''); }).join(', ') + '. The XCPETS below is only the meal fee.</p>'; }
  /* cemetery runs in the confirm: pets x per-pet fee (+ the raise for a seance) = the total above. Per pet, owner Oct 31 2026. */
  function cemRunsNote(plans, w) { var b = (S.tip || 0) + 1; if (!w || !V.cemRunsOn || !V.cemRunsOn(b)) return ''; var by = {}, tot = 0, sr = false, runs = false;
    plans.forEach(function (q) { var t = q && q.tag ? V.parseTag(q.tag) : null; if (!t) return; var isR = t.action === 'cemr', a = isR ? t.kind : t.action; if (!/^(alt|seance|zfeed|rpl)$/.test(a)) return;
      var n = isR ? (q.ids ? q.ids.length : V.cemRunsIds(w, ME, t, b).length) : (t.ids || []).length, k = a === 'zfeed' ? 'zmeal' : a === 'rpl' ? 'rpl' : 'pledge'; by[k] = (by[k] || 0) + n; tot += n; if (a === 'seance') sr = true; if (isR) runs = true; });
    if (!tot) return ''; var parts = Object.keys(by).map(function (k) { return fmt(by[k]) + ' pet' + (by[k] === 1 ? '' : 's') + ' times ' + fmt(V.cemCost(w, k, b)); });
    return ' (cost per pet: ' + parts.join(' + ') + (sr ? ' + raise ' + fmt(V.cemCost(w, 'raise', b)) : '') + (runs ? '; cemetery runs name pets by their place in your pet list' : '') + ')'; }
  /* The ids a burn tag names. The send check reads w.byId[id], which can be a different object from the card. */
  function sendIds(plans) {
    var ids = [], i, t;
    if (!V.parseTag) return null;
    for (i = 0; i < (plans || []).length; i++) {
      t = plans[i] && plans[i].tag ? V.parseTag(plans[i].tag) : null;
      if (!t) continue;
      if (window.XcpArt && XcpArt.tagPetIds) ids = ids.concat(XcpArt.tagPetIds(t));
      else {
        if (typeof t.a === 'number') ids.push(t.a);
        if (typeof t.b === 'number') ids.push(t.b);
        if (typeof t.petId === 'number') ids.push(t.petId);
        if (typeof t.zombie === 'number') ids.push(t.zombie);
      }
    }
    return ids;
  }
  function confirmPlans(title, plans, after, pre) {
    if (window.V2Split && V2Split.ownersReady && !V2Split.ownersKnown()) { toast('loading owners'); return V2Split.ownersReady().then(function () { confirmPlans(title, plans, after, pre); }); }
    if (window.XcpMaint && XcpMaint.on()) return XcpMaint.stop();
    if (viewBlock()) return;
    if (!ME) { /* no wallet: a small sheet (flow-fixes 2026-10-22: no auto-scroll / auto-click any more) */ nwSheet('🔌 Every action is a burn signed in your own wallet: XCP Wallet on desktop Chrome, or the Casa Tookan app on your phone (open xcpets.fun inside it). Connect it to play, or look up any address to view its pets.'); return; }
    if (FEED_ALL_PAUSED && plans.some(function (q) { return isFeedAllTag(q && q.tag); })) { plans = plans.filter(function (q) { return !isFeedAllTag(q && q.tag); }); toast(FA_NOTE + ' Those burns were not sent.'); if (!plans.length) return; }
    var bw = world(), skip = []; if (window.V2Split && V2Split.resolveWorld) V2Split.resolveWorld(bw, sendIds(plans)); if (V.planAmount) plans = plans.map(function (p) { return V.planAmount(bw, p, (S.tip || 0) + 1); }); if (V.cemPetAmount) plans = plans.map(function (p) { return V.cemPetAmount(bw, p, (S.tip || 0) + 1); }); /* cemetery: per pet from the runs gate */ /* halving: burn the price at the next block */ plans = plans.filter(function (p) { var m = V.battleBlock(bw, p.tag, S.tip); if (m) skip.push(m); return !m; }); /* battle cap (2026-10-14) */
    var sp = myPendingTags(); plans = plans.filter(function (p) { if (bw && bw._view) return true; /* the background check judges this burn before anything is signed */ var m = V.sendBlock ? V.sendBlock(bw, p, S.tip, { me: ME, pending: sp }) : null; if (m) skip.push('🚫 Not sent (' + p.tag + '): ' + m); else sp.push(p.tag); return !m; }); /* wasted-burn guard (2026-10-20): one shared check mirroring the engine (breed, accept, fight, rolls); never ask the wallet to sign a burn the replay would reject */
    if (skip.length) { toast(skip.length === 1 ? skip[0] : 'Skipped ' + skip.length + ': ' + skip.join(' · ')); window.V2LastBlocked = skip; }
    var fg = feedGuard(bw, plans); plans = fg.plans; if (pre && pre.skipped.length && !fg.skipped.length) fg = { plans: plans, skipped: pre.skipped, text: pre.text };
    if (!plans.length) { if (fg.skipped.length || fg.blocked) feedBlocked(title, fg.text); else if (!skip.length) toast('Nothing to do'); return; }
    var fe = fireEndPlans(bw, plans); /* firesale-countdown-1104: last 2 sale blocks -> offer the full cost */
    var s = V.burnSummary(plans); pendingPlans = plans; pendingAfter = after;
    $('cfTitle').textContent = title; $('cfTitle').classList.toggle('cf-long', String(title).length > 44); /* burn-click-menu (Nov 25 2026): a long title (the permanent discard one) wrapped into five huge lines and pushed the Sign button off screen */
    $('cfBody').innerHTML = zEatNote(plans, bw) + (fe ? fireEndNote(fe) : '') + '<div class="bigamt" id="cfAmt">' + fmt(s.total) + ' XCPETS</div><p class="small">' + s.burns + ' burn' + (s.burns > 1 ? 's, each signed separately' : '') + cemRunsNote(plans, bw) + (plans.some(function (q) { return q && q.runs && q.petIds; }) ? ' feeding ' + fmt(plans.reduce(function (a, q) { return a + (q && q.petIds ? q.petIds.length : 0); }, 0)) + ' pets (Mythics never eat)' : '') + ' · <span id="cfFee">' + feeLine(s.burns, null) + '</span> · balance after ' + (S.balanceAt ? fmt(S.balance - s.total) : '\u2013') + '</p>' +
      blocksNote(s.burns) + setupNote(plans) + spinNote(plans, bw) + '<div class="logbox small" id="cfLog">' + plans.slice(0, 12).map(function (p) { return '<div><code>' + esc(p.tag) + '</code> · ' + fmt(p.amount) + '</div>'; }).join('') + (plans.length > 12 ? '<div>… +' + (plans.length - 12) + ' more</div>' : '') + '</div>' +
      (fg.skipped.length ? '<p class="small warn">🍽️ Skipped ' + fg.skipped.length + ' pet' + (fg.skipped.length > 1 ? 's' : '') + ' that would gain nothing from a meal: ' + esc(fg.text) + '</p>' : '') +
      (window.UXB ? UXB.confirmExtra(plans, bw) : '') + '<div class="bar"><i id="pg" style="width:0"></i></div><div class="small" id="pgt"></div>';
    $('cfYes').textContent = window.XcpHandoff && XcpHandoff.on() ? '\ud83d\udcf2 Add to my computer list' : 'Sign & burn in ' + (V2Wallet.label ? V2Wallet.label() : 'XCP Wallet'); $('cfNo').textContent = 'Cancel'; $('cfYes').disabled = false; $('cfNo').disabled = false; open('confirmBox');
    if (window.V2Wallet && V2Wallet.feeQuote) V2Wallet.feeQuote().then(function (q) { var el = $('cfFee'); if (el && (pendingPlans === plans || (fe && pendingPlans === fe.full))) el.innerHTML = feeLine(s.burns, q); });
    if (window.V2Wallet && V2Wallet.mountFeePicker && V2Wallet.feeUiOn && V2Wallet.feeUiOn()) { var slot = document.createElement('div'); slot.id = 'cfFeePick'; $('cfBody').appendChild(slot);
      V2Wallet.mountFeePicker(slot, { burns: s.burns, onQuote: function (q) { var el = $('cfFee'), n = pendingPlans ? V.burnSummary(pendingPlans).burns : s.burns; if (el && (pendingPlans === plans || (fe && (pendingPlans === fe.full || pendingPlans === fe.sale)))) el.innerHTML = feeLine(n, q); } }); }
    if (fe) fireEndWire(fe);
  }
  /* firesale-countdown-1104 (UI only, rules unchanged): a burn is judged at the block it confirms in. In the last 2 blocks of a live Fire Sale
   * a burn sent at the sale cost may land after the sale and then pays only part of a meal list. The confirm sheet warns and offers the full
   * cost (sale amount / 0.31, rounded up, plus 2 sats per pet for the 8-place rounding), keeping the sale cost as the other choice. */
  var FIRE_END_WARN = 6, FIRE_SALE_PART = 0.31; /* sale-guard (Nov 23 2026): 2 -> 6 blocks (about an hour): a player sent feeds 3 blocks before the end and they landed after it */
  function fireEndPlans(w, plans) { if (!V.fireInfo || !plans || !plans.length) return null; var f; try { f = V.fireInfo(w, S.tip || 0); } catch (e) { return null; }
    var sl = f && f.live; if (!sl) return null; var left = sl.end - f.nextBlock; if (left + (f.grace || 0) > FIRE_END_WARN) return null; /* FIRE SALE GRACE (rules, from block 977,560): a sale-priced burn that lands up to 6 blocks after the end still counts, so no warning is needed */ var any = false;
    /* wasted-burns audit (Nov 25 2026): a plan that was already priced at full cost was divided by 0.31 again (block 977,493: a 2-pet meal of
     * 17.25 went out as 55.65). Only a plan at the sale price is raised: priced actions take their full cost from the rules at the first block
     * after the sale (planAmount), meals from the pets' own sale-priced next meals. A plan already at (or above) full cost is left alone. */
    function fullOf(p, a, n) { var t = V.parseTag ? V.parseTag(p.tag) : null, ids = p.petIds || (t && t.action === 'feed' ? [t.petId] : null), sale = 0;
      if (ids && ids.length && t && /^(feed|feedm|feedr|chores)$/.test(t.action)) { ids.forEach(function (id) { var q = w.byId && w.byId[id]; sale += q && q.nextMeal > 0 ? Number(q.nextMeal) : 0; });
        if (sale > 0 && a + 1e-8 >= sale / FIRE_SALE_PART - 1e-6) return null; }
      else if (V.planAmount) { var pa = V.planAmount(w, Object.assign({}, p, { amount: 1e12 }), sl.end), fa = pa && Number(pa.amount); if (fa > 0 && fa < 1e12) return a + 1e-8 >= fa ? null : fa; }
      return (Math.ceil(a / FIRE_SALE_PART * 1e8 - 1e-6) + 2 * n) / 1e8; }
    var full = plans.map(function (p) { var a = Number(p && p.amount); if (!(a >= 0.001)) return p; var n = (p.petIds && p.petIds.length) || 1, fa = fullOf(p, a, n); if (fa == null) return p; any = true;
      return Object.assign({}, p, { amount: fa }); });
    return any ? { sale: plans, full: full, left: left, end: sl.end } : null; }
  function fireEndNote(fe) { return '<div class="warn fs-endwarn" id="cfFireEnd" role="alert"><p><b>🔥 Sale may end before this confirms. Pay full cost to be safe?</b></p><p class="small">' +
      (fe.left === 1 ? 'This is the last block' : 'Only ' + fe.left + ' blocks are') + ' left in the Fire Sale (it ends at block ' + fmt(fe.end) + '). A burn is judged at the block it lands in, and a burn can wait a few blocks in line (a block sometimes takes an hour). If it lands after the sale at the sale cost, only some of the pets get fed.</p>' +
      '<div class="row"><button type="button" class="q" id="cfPayFull" aria-pressed="false">Pay full cost · ' + fmt(V.burnSummary(fe.full).total) + '</button> <button type="button" class="q" id="cfPaySale" aria-pressed="true">Keep sale cost · ' + fmt(V.burnSummary(fe.sale).total) + '</button></div></div>'; }
  function fireEndWire(fe) { function pick(full) { var L = full ? fe.full : fe.sale; if (pendingPlans !== fe.sale && pendingPlans !== fe.full) return; pendingPlans = L;
      var a = $('cfAmt'); if (a) a.textContent = fmt(V.burnSummary(L).total) + ' XCPETS'; var g = $('cfLog'); if (g) g.innerHTML = L.slice(0, 12).map(function (p) { return '<div><code>' + esc(p.tag) + '</code> · ' + fmt(p.amount) + '</div>'; }).join('') + (L.length > 12 ? '<div>… +' + (L.length - 12) + ' more</div>' : '');
      var bf = $('cfPayFull'), bs = $('cfPaySale'); if (bf) bf.setAttribute('aria-pressed', String(!!full)); if (bs) bs.setAttribute('aria-pressed', String(!full)); }
    var bf = $('cfPayFull'), bs = $('cfPaySale'); if (bf) bf.onclick = function () { pick(true); }; if (bs) bs.onclick = function () { pick(false); }; }
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
      still: function (before) { try { if (S.balanceAt && Number(p.amount) > S.balance) return 'your wallet now holds ' + fmt(S.balance) + ' XCPETS, less than the ' + fmt(p.amount) + ' this ' + (egg ? 'egg buy' : 'burn') + ' needs';
        var why = sendWhy(p); if (why) return (egg ? 'these eggs can\'t be bought right now (' : 'this pet action can\'t go now (') + why + ')';
        if (before == null) return ''; var now = JSON.parse(look()), was = JSON.parse(before);
        if (JSON.stringify(now.costs) !== JSON.stringify(was.costs)) return egg ? 'the egg cost changed' : 'the burn cost changed';
        if (JSON.stringify(now.pets) !== JSON.stringify(was.pets)) return 'a pet in this burn changed (owner, stage or meal)';
        return null; } catch (e) { return ''; } } }; }
  function sendWhy(plan) { var w = world(); if (window.V2Split && V2Split.resolveWorld) V2Split.resolveWorld(w, sendIds([plan])); return V.sendBlock ? V.sendBlock(w, plan, S.tip, { me: ME, pending: myPendingTags() }) : null; }
  function pendingBreedIds() { var o = {}; myPendingTags().forEach(function (g) { var t = V.parseTag(g); if (t && t.action === 'breed') { o[t.a] = 1; var A = world().byId[t.a], B = world().byId[t.b]; if (A && B && A.owner === B.owner) o[t.b] = 1; } }); return o; }
  function pendingFeedIds() { var o = {}, conf = {}; (S.rows || []).forEach(function (r) { conf[r.tx_hash] = 1; });
    /* Nov 25 2026 (G Money lost 5,267 XCPETS): a discard burn still waiting to confirm counts too. o.hd = the pets it names, so the feed guard
     * (V2Habits.feedWhy) leaves them out instead of paying for meals the rules refuse once the discard lands first. */
    var hdW = null; o.hd = {}; function hdAdd(t) { if (!V.hdIdsOf) return; try { hdW = hdW || world(); if (hdW) V.hdIdsOf(hdW, ME, t, (S.tip || 0) + 1).forEach(function (id) { o.hd[id] = 1; }); } catch (e) { } }
    function add(tag) { var t = V.parseTag(tag); if (!t) return; if (t.action === 'hd') return hdAdd(t); if (t.action === 'feed') o[t.petId] = 1; if (t.action === 'feedm' || t.action === 'feedl') t.ids.forEach(function (id) { o[id] = 1; }); if (t.action === 'feedr' && V.feedRunsIds) V.feedRunsIds(world(), ME, t, (S.tip || 0) + 1).forEach(function (id) { o[id] = 1; }); if (t.action === 'feeda') { var ex = new Set(t.ex); world().pets.forEach(function (p) { if (p.owner === ME && (t.un ? (ex.has(p.id) || p.skipBy !== ME) : (!ex.has(p.id) && p.skipBy !== ME))) o[p.id] = 1; }); } }
    try { if (window.V2Wallet && V2Wallet.tracker) V2Wallet.tracker.list().forEach(function (t) { if (t.status !== 'confirmed' && !conf[t.txid]) add(t.tag); }); } catch (e) { }
    (S.mempool || []).forEach(function (x) { if (x && x.source === ME && !conf[x.tx_hash]) add(x.tag); }); return o; }
  /* bigfix 2026-10-20: plain-words heads-up for runs longer than the unconfirmed-burn limit */
  /* feed-burns-fix: say plainly what pet:sk / pet:su burns are, so a feed with setup burns is not a surprise. */
  function setupNote(plans) { var n = plans.filter(function (p) { return /^pet:s[ku]:/.test(p.tag); }).length; if (!n) return '';
    return '<p class="small"><b>ℹ️ ' + fmt(n) + ' of these ' + (n > 1 ? 'are one-time setup burns' : 'is a one-time setup burn') + '.</b> They tell the chain which of your pets Feed all should leave out (pets you discarded or did not pick). After that, Feed all hungry is 1 burn each time.</p>'; }
  /* use-all-spins (owner Oct 27 2026): pet:usespin:all spends every saved spin in this 1 burn; say how many and where the pieces go. */
  function spinNote(plans, w) { /* gear-target-fix-1102: picked-pet spins (pet:ut) and the one-time re-wear (pet:rw) */
    var ut = plans.filter(function (p) { return /^pet:ut:/.test(p.tag); }), rw = plans.filter(function (p) { return /^pet:rw:/.test(p.tag); }), pc = function (L) { return L.reduce(function (a, p) { return a + (p.petIds ? p.petIds.length : 0); }, 0); };
    if (ut.length) return '<p class="small"><b>🎯 ' + fmt(ut.reduce(function (a, p) { return a + (p.n || 0); }, 0)) + ' saved spins, each landing on one of the ' + fmt(pc(ut)) + ' pets you picked.</b> No other pet of yours can get a piece. Only the Bitcoin fee. A piece it swaps out or can\'t wear goes to your stash.</p>';
    if (rw.length) return '<p class="small"><b>♻️ One-time re-wear onto the ' + fmt(pc(rw)) + ' pets you picked.</b> The pieces from your Use all burn come off the pets you never fed and go on these, best first, one per slot. What doesn\'t fit stays in your stash. Only the Bitcoin fee.</p>';
    if (!plans.some(function (p) { return p.tag === 'pet:usespin:all'; })) return '';
    var n = V.spinsLeft ? V.spinsLeft(w, ME, (S.tip || 0) + 1, myPendingTags()) : 0;
    return '<p class="small"><b>🎁 This 1 burn uses all ' + fmt(n) + ' of your saved spins.</b> Only the Bitcoin fee, nothing else. ' + (V.allSlotsNow && V.allSlotsNow(w) ? 'Each spin picks a random pet of yours and rolls one piece for one of its 6 slots (every pet has all 6 open). A piece it swaps out or can\'t wear goes to your stash.' : 'Each spin picks a random pet of yours (pets with an open slot first) and rolls one piece for one of its 6 slots. <b>Pieces go on your pets\' open slots first; the rest land in bags or the stash.</b> A piece for a slot that is still locked waits in that pet\'s bag until the slot opens, and a piece it swaps out or can\'t wear goes to your stash.') + ' Wear them later in the Dressing room.</p><p class="small warn">⚠️ <b>Random means any living pet of yours</b>: pets you never fed and pets you discarded too (Discard only hides a pet in this browser). With ' + fmt(n) + ' spins in 1 burn, most pieces can land on pets you don\'t play with.</p>'; }
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
  function saveResume(title, rest) { if (window.XCPETS_MAINTENANCE) { try { localStorage.removeItem(resumeKey()); } catch (eM) {} return; } try { if (rest && rest.length) localStorage.setItem(resumeKey(), JSON.stringify({ title: title, plans: rest, at: Date.now() })); else localStorage.removeItem(resumeKey()); } catch (e) { } }
  function loadResume() { try { var o = JSON.parse(localStorage.getItem(resumeKey()) || 'null'); if (o && o.plans && o.plans.length && Date.now() - o.at < 24 * 3600e3) return o; localStorage.removeItem(resumeKey()); } catch (e) { } return null; }
  var resumeShown = false;
  /* chores-resume-1110: Continue / Dismiss are not onclick on the toast node. The away sheet (and the Rare Room queue)
   * copy the toast's HTML and drop those handlers. js/v2-intuitive.js listens on the document, so the same links work
   * in the toast and in the copied sheet. Both call these. */
  function resumeGo() { if (window.XcpMaint && XcpMaint.on()) return XcpMaint.stop(); var o = loadResume(); if (!o || !o.plans || !o.plans.length) return false; confirmPlans('Continue: ' + (o.title || 'burns'), o.plans); return true; }
  function resumeDrop() { saveResume(null, null); return true; }
  function resumePending() { var o = loadResume(); return !!(o && o.plans && o.plans.length); }
  /* X / Skip all close the sheet and drop its copied HTML. The saved run is still there, so show a live Continue toast once the hold is off. Dismiss is the only action that forgets it. */
  function resumeReoffer() { if (!resumePending()) return false; resumeShown = false; offerResume(); return true; }
  function replayFight(id) { var w = world(), f = w && w.fights && w.fights[+id - 1]; if (f) playFight(f); }
  function replayCem(key) { var ev = window.V2CemReplay && window.V2CemReplay[key], CA = window.V2CemAnim; if (ev && CA && CA.play) CA.play(ev, { w: world() }); }
  function offerResume() { if (window.XCPETS_MAINTENANCE) { try { saveResume(null, null); } catch (eM) {} return; } if (resumeShown || !ME || viewOnly()) return; var o = loadResume(); if (!o) return; resumeShown = true;
    if (FEED_ALL_PAUSED && o.plans.some(function (q) { return isFeedAllTag(q && q.tag); })) { saveResume(null, null); toast('⏸️ ' + FA_NOTE + ' Your unfinished Feed all run was stopped. Nothing more will be sent.', 15000); return; }
    toast('⏸️ ' + o.plans.length + ' burn' + (o.plans.length > 1 ? 's' : '') + ' from an unfinished run (' + esc(o.title || 'burns') + ') ' + (o.plans.length > 1 ? 'were' : 'was') + ' not sent. <a href="#" class="resume">Continue</a> · <a href="#" class="resdrop">Dismiss</a>', 30000); }
  /* error-card (Nov 1 2026, owner-approved critique plan item 5): one plain-words card when a burn run stops. It says what happened,
   * whether anything was sent (Nothing was sent / N sent, waiting for a block, or "may have been sent" after a broadcast timeout),
   * links every sent tx, and points at the Retry / Continue button. Same stop logic as before: nothing new is sent without a click. */
  function WL() { try { return V2Wallet.label ? V2Wallet.label() : 'XCP Wallet'; } catch (e) { return 'XCP Wallet'; } }
  function errCard(k, n, eh, raw, e, sent, canRetry) { var plain = String(eh || '').replace(/<[^>]*>/g, ''), maybe = /may still have been sent/i.test(plain),
      tx = function (t) { return '<a target="_blank" rel="noopener" href="https://mempool.space/tx/' + esc(t) + '">' + esc(t.slice(0, 10)) + '… ↗</a>'; }, was;
    if (!sent.length && !maybe) was = '<b>Nothing was sent.</b> No XCPETS and no fee left your wallet for burn ' + k + (n > 1 ? ' or the ones after it' : '') + '.';
    else was = (sent.length ? '<b>' + sent.length + ' of ' + n + ' sent, waiting for a block:</b> ' + sent.map(tx).join(' · ') + '. They show up here once confirmed. ' : '') +
      (maybe ? '<b>Burn ' + k + ' may have been sent.</b> Check your address on <a target="_blank" rel="noopener" href="https://mempool.space/address/' + esc(ME || '') + '">mempool.space ↗</a> before you retry, so it is not sent twice.' : '<b>Burn ' + k + (k < n ? ' and the rest were' : ' was') + ' not sent.</b>');
    return '<div class="xc-err" role="alert" style="text-align:left;border:1px solid #e0a43a;border-radius:10px;padding:8px 10px;margin:6px 0;background:rgba(224,164,58,.08)">' +
      '<div><b>⚠️ Stopped at burn ' + k + ' of ' + n + '.</b></div><div style="margin-top:4px"><b>What happened:</b> <span class="warn">' + eh + '</span>' +
      (raw ? ' <span class="muted">· wallet/node said: <code>' + esc(raw) + '</code></span>' : '') + '</div><div style="margin-top:4px">' + was + '</div>' +
      (canRetry ? '<div class="small muted" style="margin-top:4px">Press <b>' + (e && e.retry ? 'Retry' : 'Continue') + '</b> below to try burn ' + k + ' again, or Close to stop here. Nothing more is sent until you approve it in ' + WL() + '.</div>' : '<div class="small muted" style="margin-top:4px">Reload the page, then try again. Nothing more is sent until you approve it in ' + WL() + '.</div>') + '</div>'; }
  /* burn-stuck-1101 [pt2589u]: Cancel always works while burns are being prepared: it stops this run (no next burn starts) and tells
   * V2Wallet to drop a burn that has not reached the wallet window yet (nothing is signed or sent). A window already open stays the wallet's own choice. */
  var sendRun = null;
  $('cfNo').onclick = function () { if (sendRun) { sendRun.stop = true; sendRun = null; try { if (V2Wallet.cancel) V2Wallet.cancel(); } catch (e) { } } try { if (V2Wallet.feeBatchEnd) V2Wallet.feeBatchEnd(); } catch (e) { } close('confirmBox'); pendingPlans = null; };
  /* modal-close (Nov 1 2026, the one fix kept from feed-setup-cheaper 37451f59): Esc and a click on the dark background close the confirm box
   * exactly like Cancel (same handler: stops a running burn queue and cancels a pending wallet request). Nothing is signed here. */
  $('confirmBox').addEventListener('click', function (e) { if (e.target === $('confirmBox')) $('cfNo').click(); });
  /* burn-click-menu (Nov 25 2026): Jake pressed Sign & burn and got Chrome's right-click menu. A web page cannot open that menu itself: it comes from
   * a press the computer reads as a right-click (touchpad corner / two-finger tap, touchscreen or pen press-and-hold). On the sheet's buttons that
   * menu is never useful, so it is blocked. A touch or pen hold counts as the tap it was meant to be; a mouse right-click gets a hint instead. */
  (function () { var lastPt = 'mouse'; document.addEventListener('pointerdown', function (e) { lastPt = e.pointerType || 'mouse'; }, true);
    document.addEventListener('contextmenu', function (e) { var b = e.target && e.target.closest && e.target.closest('.reveal.on button'); if (!b) return; e.preventDefault();
      if (b.disabled) return; if (lastPt === 'touch' || lastPt === 'pen') return b.click(); if (b.id === 'cfYes') toast('That press came in as a right-click, so nothing was sent. Click ' + (b.textContent || 'the button') + ' once with a normal (left) click.'); }); })();
  document.addEventListener('keydown', function (e) { if ((e.key === 'Escape' || e.key === 'Esc') && $('confirmBox').classList.contains('on')) $('cfNo').click(); });
  $('cfYes').onclick = function () { if (window.XcpMaint && XcpMaint.on()) return XcpMaint.stop(); var plans = pendingPlans; if (!plans) return; if (window.XcpHandoff && XcpHandoff.on()) { if (XcpHandoff.show($('cfTitle').textContent, plans)) $('cfNo').click(); return; } /* phone plan mode (js/handoff.js): finish on the computer, nothing is signed here */ var s = V.burnSummary(plans); if (!ME || V2Wallet.current() !== ME) { toast('Connecting ' + WL() + '…'); V2Wallet.connect().then(function (a) { if (a !== ME) location.reload(); else $('cfYes').onclick(); }, function (e) { toast(V2Wallet.errHtml(e)); }); return; } if ($('cfYes')._balWait) return toast('⏳ Checking your XCPETS balance first. ' + WL() + ' opens in a moment.'); if (!S.balanceAt && !(S.stale && !S.verified) && !$('cfYes')._balPass) { $('cfYes')._balWait = 1; var yb = $('cfYes'), yt = yb.textContent; yb.textContent = '⏳ Checking balance…'; var again = $('cfYes').onclick, go = function () { $('cfYes')._balWait = 0; $('cfYes')._balPass = 1; if (yb.textContent === '⏳ Checking balance…') yb.textContent = yt; again(); }; /* burn-click-menu: the first click used to wait for the balance with no sign at all, so it looked dead and players clicked again harder */ if (M.readBalance) M.readBalance({ force: true }).then(go, go); else go(); return; } $('cfYes')._balPass = 0; if (S.balanceAt && s.total > S.balance && !(S.stale && !S.verified)) return toast('Not enough XCPETS in this wallet'); /* an unread balance is not 0: re-read once, and only a landed read can stop the burn */
    var run = sendRun = { stop: false }; $('cfYes').disabled = true; $('cfNo').disabled = false; $('cfNo').textContent = 'Cancel'; var i = 0, sentTx = [], title = $('cfTitle').textContent, day0 = V.day(S.tip || 0); saveResume(title, plans);
    /* wasted-burn guard (2026-10-20): a long Feed all queue can cross a 144-block chain day while it is being signed. When the day changes, the unsent
     * feed burns are rebuilt for the new day (same feedGuard), so no meal is sized or skipped for the old day. Other burns are untouched. */
    function redayFeeds() { var d = V.day(S.tip || 0); if (d === day0) return; day0 = d; var rest = plans.slice(i); if (!rest.some(function (q) { var t = V.parseTag(q.tag); return t && /^feed/.test(t.action); })) return;
      var g = feedGuard(world(), rest); plans = plans.slice(0, i).concat(g.plans); if (g.skipped.length) toast('🍽️ New chain day: rebuilt the remaining meals · ' + esc(g.text)); else toast('🍽️ New chain day: rebuilt the remaining meals for the new day.'); }
    /* habits-ux: right before each feed burn is composed (wallet chaining too), drop it if none of its pets can still eat */
    function feedDrop() { var q = plans[i], t = q && V.parseTag(q.tag); if (!t || !/^feed/.test(t.action)) return false; var g = feedGuard(world(), [q]); if (!g.blocked) return false;
      plans.splice(i, 1); toast('🍽️ Skipped ' + esc(q.tag) + ' before signing: ' + esc(g.text)); return true; }
    function sendOnce(p, k, n) { if (window.XcpMaint && XcpMaint.on()) return Promise.reject(XcpMaint.err()); /* wallet-one-window: no auto-retry on -32005 (each retry rebuilt the burn and opened another XCP Wallet window); V2Wallet.send turns it into a finish-or-close message */
      /* burn-compose-fix: show which step the burn is on (chain check / fee / node i of n / safety check / XCP Wallet) instead of one static line */
      var pre = 'Burn ' + k + ' of ' + n + ': ';
      return V2Wallet.send(p, ME, function (a, b, ph, fi) { var m = ph === 'precheck' ? (fi && fi.text ? fi.text : 'safety-checking your pets…') + ' Nothing is signed yet; ' + WL() + ' opens after this. Cancel stops it.' : ph === 'wallet' ? 'opening ' + WL() + '… if it asks you to unlock, unlock it.' : ph === 'owners' ? 'loading owners…' : ph === 'fresh' ? 'checking the latest chain data…' : ph === 'world' ? 'updating pets to the latest block on this device… nothing is signed until this finishes.' : ph === 'fee' ? 'getting the network fee rate…' : ph === 'check' ? 'safety-checking ' + p.tag + ' (node ' + a + ' of ' + b + ')…' : ph === 'sign' ? (fi && fi.text ? fi.text + ' · ' : '') + 'approve ' + p.tag + ' in ' + WL() + ' now.' + (WL() === 'XCP Wallet' ? ' If no window opened, click the XCP Wallet icon in your browser toolbar.' : '') : 'building ' + p.tag + ' on Counterparty node ' + a + ' of ' + b + '…'; $('pgt').textContent = pre + m; }, staleCheck(p)); }
    var starred = 0;
    function step() { if (run.stop) return; if (i >= plans.length) { if (sendRun === run) sendRun = null; try { if (V2Wallet.feeBatchEnd) V2Wallet.feeBatchEnd(); } catch (e) { } keptToast(starred); starred = 0; save(); saveResume(null, null); if (plans.some(function (p) { return p.tag === 'pet:hatchzap'; })) try { window.dispatchEvent(new Event('xcpets:zap')); } catch (e) { } $('pgt').textContent = '✓ ' + plans.length + ' burn' + (plans.length > 1 ? 's' : '') + ' sent from ' + WL() + '. They appear here once confirmed in a block.'; var nr = plans.filter(function (q) { return /^pet:(roll|fr|of):/.test(q.tag); }).length; if (nr) toast('🎁 Gear on the way' + (nr > 1 ? ' (' + nr + ' rolls)' : '') + '. Your piece' + (nr > 1 ? 's show' : ' shows') + ' up here once the burn confirms, usually in about 10 minutes.', 9000); setTimeout(function () { close('confirmBox'); var a = pendingAfter; pendingPlans = null; render(); if (a) a(); }, 400); return; }
      redayFeeds(); if (i >= plans.length) return step(); if (feedDrop()) return step();
      if (FEED_ALL_PAUSED && isFeedAllTag(plans[i].tag)) { try { if (V2Wallet.feeBatchEnd) V2Wallet.feeBatchEnd(); } catch (e) { } keptToast(starred); starred = 0; saveResume(null, null); pendingPlans = null; $('pgt').innerHTML = '<span class="warn">' + FA_NOTE + ' Stopped before burn ' + (i + 1) + ' of ' + plans.length + ' (' + i + ' sent). Nothing more will be sent.</span>'; $('cfNo').textContent = 'Close'; $('cfNo').disabled = false; return; }
      var p = plans[i++], k = i; $('pgt').textContent = 'Burn ' + k + ' of ' + plans.length + ': building ' + p.tag + ', then approve it in ' + WL() + '…'; sendOnce(p, k, plans.length).then(function (r) { if (run.stop) { if (r && r.txid) toast('⏳ Broadcast after Cancel: ' + esc(p.label || p.tag) + ' · tx ' + String(r.txid).slice(0, 10) + '… (approved in ' + WL() + ')', 9000); return; } S.lastTx = r && r.txid; if (r && r.txid) sentTx.push(r.txid); starred += keepFed(p.tag, p); saveResume(title, plans.slice(k)); $('pg').style.width = (100 * k / plans.length) + '%'; $('pgt').textContent = 'Burn ' + k + ' of ' + plans.length + ' sent: ' + p.tag + ' · tx ' + r.txid.slice(0, 10) + '…'; if (plans.length <= 3) toast('⏳ Broadcast: ' + esc(p.label || p.tag) + ' · <a target="_blank" rel="noopener" href="https://mempool.space/tx/' + r.txid + '">' + r.txid.slice(0, 6) + '… mempool ↗</a>' + (/^pet:hatch/.test(p.tag) ? ' · 🥚 your egg' + (p.tag === 'pet:hatch' ? '' : 's') + ' hatch when this confirms (the hatch popup opens then)' : ' · result when confirmed'), 9000); renderLog(world()); if (i < plans.length) setTimeout(step, 1500); else step(); }, function (e) { if (run.stop) return; if (sendRun === run) sendRun = null; var raw = e ? (e.message || (e.data && (e.data.message || JSON.stringify(e.data))) || String(e)) : '', eh = e && e.confirmNote ? V2Wallet.confirmNoteHtml(true) : e && e.waitConfirm ? esc(k > 1 ? 'Burn ' + (k - 1) + ' is waiting to confirm. Wait about one block, then press Continue.' : 'An earlier burn of yours is waiting to confirm. Wait about one block, then press Continue.') : V2Wallet.errHtml(e);
        keptToast(starred); starred = 0; saveResume(title, plans.slice(k - 1)); $('pgt').innerHTML = errCard(k, plans.length, eh, raw && !e.waitConfirm && !e.walletBusy && !e.stale && String(eh).replace(/<[^>]*>/g, '').indexOf(raw) < 0 ? raw : '', e, sentTx, !e.reload); $('cfNo').disabled = false; pendingPlans = plans.slice(k - 1); if (!e.reload) { $('cfYes').textContent = e.retry ? (k > 1 ? 'Retry from burn ' + k : 'Retry') : 'Continue from burn ' + k; $('cfYes').disabled = false; }
        /* burn-wait-confirm: the note's Continue = re-check for confirmed coins from this burn; 'Try anyway' = one compose on the unconfirmed change */
        if (e && e.confirmNote) { var nb = $('pgt').querySelector('.bwc-go'), nt = $('pgt').querySelector('.bwc-try');
          if (nb) nb.onclick = function () { $('cfYes').onclick(); };
          if (nt) nt.onclick = function (ev) { ev.preventDefault(); V2Wallet.allowUnconfirmedOnce(); $('cfYes').onclick(); }; } }); }
    if (V2Wallet.feeBatchBegin) V2Wallet.feeBatchBegin(false).then(step, step); else step();
  };

  // ---------------------------------------------------------------- hatch + community (live buttons)
  /* stale-egg-costs (owner Oct 28 2026): the three egg buttons used to show and burn the ORIGINAL 69 / 690 / 6,900 until the halving UI caught up.
   * Now they say (…) and stay disabled until the replayed world has set the current costs (V.COSTS.era is only set by syncCosts on a real world),
   * and a click burns that current cost (planAmount still re-prices it at the next block). The Electric Shock Box is unchanged. UI only. */
  var EGGS = [['hatchBtn', 'Crack One Open', 'pet:hatch', 'hatch'], ['dozenBtn', 'Crack Pack · 12 eggs', 'pet:hatch12', 'hatch12'], ['caseBtn', 'Yolk Booster Box · 144 eggs', 'pet:hatch144', 'hatch144']];
  function eggCost(k) { var C = V.COSTS; return C && C.era != null && C[k] > 0 ? C[k] : null; } /* reads only: never asks for the world (no replay) */
  function eggButtons() { EGGS.forEach(function (e) { var b = $(e[0]); if (!b) return; var c = eggCost(e[3]), t = e[1] + ' (' + (c == null ? '…' : fmt(c)) + ')'; if (b.textContent !== t) b.textContent = t; if (b.disabled !== (c == null)) b.disabled = c == null; }); }
  EGGS.forEach(function (e) { var b = $(e[0]); if (b) b.onclick = function () { var c = eggCost(e[3]); if (c == null) { eggButtons(); toast('Still loading the current egg cost… try again in a moment.'); return; } confirmPlans(e[1], [{ tag: e[2], amount: c }]); }; });
  eggButtons(); setInterval(eggButtons, 1000);
  /* ELECTRIC EGGS (preview): one pet:hatchzap burn = 1,000 eggs with boosted tier odds. The button stays locked until the chain tip reaches the gate block. */
  if ($('zapBtn')) { var zapSync = function () { var g = V.electricGate && V.electricGate(), tip = (S && S.tip) || 0, on = g != null && tip + 1 >= g; $('zapBtn').disabled = !on; var zw = $('zapWhen'); if (zw) zw.textContent = g == null ? 'coming soon' : on ? 'live' : 'from block ' + fmt(g);
      /* shockbox-price-1123 (Jake Nov 23 2026: "wrong price on the shock box"): the label showed the base 100,000 on the fast load, where the
       * halving label pass (v2-halving.js) does not run. Same source as the egg buttons: the current cost once the replayed world set it. */
      var zc = eggCost('hatchzap'), zt = document.querySelector('#zapBtn .zap-t'), zs = zc == null ? null : '\u26a1 Electric Shock Box \u00b7 1,000 eggs (' + fmt(zc) + ')'; if (zt && zs && zt.textContent !== zs) zt.textContent = zs; };
    zapSync(); setInterval(zapSync, 5000); $('zapBtn').onclick = function () { confirmPlans('⚡ Electric Shock Box · 1,000 eggs', [{ tag: 'pet:hatchzap', amount: eggCost('hatchzap') || V.ELECTRIC_COST }]); }; } /* shockbox-price-1123: the confirm shows the current cost (planAmount re-prices it at the next block either way) */
  if ($('wizEggBtn') && WIZARD_EGG_ON_SALE) { $('wizEggBtn').textContent = '🧙 Bitcoin Wizard egg (' + fmt(V.WIZ_EGG_COST) + ')'; $('wizEggBtn').onclick = function () { confirmPlans('Bitcoin Wizard egg', [{ tag: 'pet:hatchwiz', amount: V.WIZ_EGG_COST }]); }; }
  if ($('wizSignBtn') && WIZARD_SIGN_CLAIM_ON) $('wizSignBtn').onclick = function () { confirmPlans('"Join us" sign (free claim)', [{ tag: 'pet:sign', amount: V.WIZ_SIGN_MIN }]); };
  $('reload').onclick = function () { render(); toast('Reloaded from the chain'); };
  /* community feed amount (2026-10-15, Jake): three fixed choices 69 / 690 / 6,900 (69 by default) instead of a free amount field; same tag + burn flow */
  /* hatchspeed-1101 (owner [pt2616u], UI only): an amount chip changes only the chosen amount (#cAmt), the chip highlight and the Feed community label.
   * It used to call render() (whole page: My Pets, motel, arena, log...), about 0.4-0.5 s per click; now it touches just those three things.
   * The burn is still built from #cAmt by V.communityFeedPlan at Feed community, exactly as before. The label is left alone while feeding is closed (gap). */
  function cfeedPick(v) { $('cAmt').value = v; var cf = $('cfeedBtn'); if (cf && /\(/.test(cf.textContent)) { var t = cfeedText(); if (cf.textContent !== t) cf.textContent = t; } }
  document.querySelectorAll('[data-camt]').forEach(function (b) { b.onclick = function () { cfeedPick(b.dataset.camt);
    document.querySelectorAll('[data-camt]').forEach(function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)); }); }; });
  document.querySelectorAll('[data-q]').forEach(function (b) { b.onclick = function () { cfeedPick(b.dataset.q); }; });
  $('cAmt').oninput = function () { if (R.communityGap && R.communityGap(world())) return; $('cfeedBtn').textContent = 'Feed community (' + fmt(Math.floor(Number(this.value) || 0)) + ')'; };
  $('cfeedBtn').onclick = function () { if (R.communityGap && R.communityGap(world())) return toast('Community feeding opens when pet #' + R.COMMUNITY_NEXT_NO + ' arrives.'); var p = V.communityFeedPlan($('cAmt').value); if (!p.ok) return toast('⚠️ ' + p.error); confirmPlans('Feed the ' + V.COMMUNITY_PET, [{ tag: p.tag, amount: p.amount }]); };
  /* community gear roll (2026-10-15, Jake): pet:c:roll, 690, the community pet gets one random gear piece; offered only once the tip reaches ACTIVATE_CROLL_BLOCK */
  $('crollBtn').onclick = function () { if (R.communityGap && R.communityGap(world())) return toast('Community gear rolls open when pet #' + R.COMMUNITY_NEXT_NO + ' arrives.'); if (!V.crollOn(S.tip)) return toast('Community gear roll switches on at block ' + fmt(V.ACTIVATE_CROLL_BLOCK) + ' (chain tip ' + fmt(S.tip) + ').');
    var pl = V.communityRollPlan(); confirmPlans('Community gear roll: the community pet gets one random gear item', [pl], function () { toast('🎲 Community gear roll submitted. The community pet\'s new piece depends on the block your burn lands in.', 9000); }); };
  $('balRefresh').onclick = render;

  // ---------------------------------------------------------------- battles
  function fighters(w, owner, not) { var oc = {}; if (!not) { (w.fights || []).forEach(function (f) { if (f.status === 'open' && (S.tip || 0) + 1 - f.block <= V.FIGHT_WINDOW) { oc[f.a] = 1; oc[f.b] = 1; } }); myPendingTags().forEach(function (g) { var t = V.parseTag(g); if (t && t.action === 'fight') { oc[t.a] = 1; oc[t.b] = 1; } }); } /* engine: a challenger may not have an open challenge (sent or received) */
    return w.pets.filter(function (p) { return (not ? p.owner !== owner : V2Own.isLiving(p, owner)) && p.stage >= 2 && !p.neglected && !oc[p.id]; }); }
  function opt(p) { return '<option value="' + p.id + '">#' + p.id + ' ' + esc(p.name) + ' (' + spLabel(p) + ' ' + (V.stageLabelOf ? V.stageLabelOf(p) : p.stageName) + ')' + (p.owner !== ME ? ' — ' + esc(p.owner) : '') + '</option>'; }
  /* pending challenges (2026-10-15, Jake): the battles box lists the connected player's open challenges in BOTH directions:
   * sent (still waiting for acceptance) and received (with Accept). Confirmed ones come from the replayed world (w.fights, status 'open');
   * unconfirmed ones come from the node mempool (S.mempool, read-only) + this browser's sent-burn tracker. Display only: nothing here feeds the replay. */
  /* breeding UI (build fix): short address (ranking-board format 6…4) with the full one in title; pet label with tier pill */
  function shortAddr(a) { a = String(a || ''); return '<span class="addr" title="' + esc(a) + '">' + esc(a.length > 14 ? a.slice(0, 6) + '…' + a.slice(-4) : a) + '</span>'; }
  function petLblT(w, id) { var p = w.byId[id]; return petLbl(w, id) + (p ? ' ' + tierPill(p.tier, p) : ''); }
  function breedSum(w, a, b) { var A = w.byId[a], B = w.byId[b]; return '<div class="bsum small">' + [A, B].map(function (p, i) { return p ? '<div><b>' + (i ? 'Partner' : 'Your pet') + ':</b> ' + esc(p.name) + ' <span class="muted">#' + p.id + '</span> ' + tierPill(p.tier, p) + (p.owner !== ME ? ' <span class="muted">owner ' + shortAddr(p.owner) + '</span>' : '') + '</div>' : ''; }).join('') + '</div>'; }
  /* two-owner flip (display only, 2026-11-10): pet:breed:A:B is a request. The other owner's pet:breed:B:A is the accept if their request
   * confirms first (or already has). The first confirmed request gets the egg; the accepting pet gets the stat carry. Nothing here changes a burn. */
  function breedTagText(tag) { tag = String(tag || ''); if (tag.length % 2 === 0 && /^[0-9a-f]+$/i.test(tag)) { try { return decodeURIComponent(tag.replace(/../g, function (h) { return '%' + h; })); } catch (e) { } } return tag; }
  function breedFlip(w, a, b) { a = +a; b = +b; if (!w || !w.byId || !(a > 0) || !(b > 0) || a === b) return null;
    var A = w.byId[a], B = w.byId[b]; if (!A || !B || !B.owner || A.owner === B.owner) return null;
    var tip = S.tip || w.tip || 0, win = V.BREED_WINDOW || 144, me = A.owner;
    var live = (w.breedReqs || []).filter(function (r) { return r && !r.used && +r.a === b && +r.b === a && r.owner !== me && !(tip && tip - r.block > win); }).sort(function (p, q) { return q.block - p.block; })[0];
    if (live) return { kind: 'confirmed', req: live };
    var conf = {}, seen = {}, hit = null; (S.rows || []).forEach(function (r) { if (r && r.tx_hash) conf[r.tx_hash] = 1; });
    function look(h, tag, src) { if (hit || !h || conf[h] || seen[h]) return; seen[h] = 1; if (src && src === me) return; var t = V.parseTag(breedTagText(tag)); if (t && t.action === 'breed' && +t.a === b && +t.b === a) hit = h; }
    (S.mempool || []).forEach(function (x) { if (x) look(x.tx_hash, x.tag, x.source); });
    try { if (window.V2Wallet && V2Wallet.tracker) V2Wallet.tracker.list().forEach(function (t) { if (t && t.status !== 'confirmed') look(t.txid, t.tag, ME); }); } catch (e) { }
    return hit ? { kind: 'pending', tx: hit } : null; }
  function breedFlipText(flip) { if (!flip) return ''; return flip.kind === 'pending'
    ? 'They already asked for this pair, still waiting to confirm. If theirs confirms first, this accepts it: they get the egg, your pet gets the stat carry.'
    : 'This accepts their request. They get the egg. Your pet gets the stat carry, not the egg.'; }
  function breedFlipNote(flip) { var t = breedFlipText(flip); if (!t) return ''; var i = t.indexOf('. '); return '<p class="brv-flip" role="alert"><b>' + t.slice(0, i + 1) + '</b> ' + t.slice(i + 2) + '</p>'; }
  /* breed-picker-fix (2026-10-19): review panel at the TOP of the existing breed confirm (same plans, tag and 690 amount; the wallet is only asked on
   * 'Confirm breed'): both pets with sprite, #, species, rarity pill, Pet Score, owner badge; buttons relabelled Confirm breed / Back. */
  function breedReview(w, a, b) { if (!ME || !$('confirmBox').classList.contains('on')) return; var short = function (x) { x = String(x || ''); return x.length > 12 ? x.slice(0, 4) + '\u2026' + x.slice(-3) : x; };
    var card = function (p, lab) { if (!p) return ''; var sc = window.PetScore && PetScore.of(w, p);
      return '<div class="brv-pet"><span class="brv-sp" data-brv="' + p.id + '"></span><div><b>' + lab + '</b><div class="brv-nm">#' + p.id + ' ' + esc(p.name || '') + '</div><div>' + esc((V.petSpeciesLabel ? V.petSpeciesLabel(p) : V.speciesLabel(p.species))) + ' ' + tierPill(p.tier, p) + ' <span class="brv-sc">⭐ ' + (sc ? sc.score : '–') + '</span></div>' +
        (p.owner === ME ? '<em class="bk-own me">My Pets</em>' : '<em class="bk-own" title="' + esc(p.owner) + '">Other Pets ' + esc(short(p.owner)) + '</em>') + '</div></div>'; };
    var flip = breedFlip(w, a, b); if (flip && flip.kind === 'confirmed') { var ct = $('cfTitle'); if (ct && !/accept/i.test(ct.textContent || '')) ct.textContent = 'Accept their check-in · #' + a + ' × #' + b; }
    $('cfBody').insertAdjacentHTML('afterbegin', (flip ? breedFlipNote(flip) : '') + '<div class="brv">' + card(w.byId[a], 'Pet 1') + card(w.byId[b], 'Pet 2') + '</div>');
    $('cfBody').querySelectorAll('[data-brv]').forEach(function (s2) { var c = document.createElement('canvas'); c.width = c.height = 32; c.className = 'sprite'; s2.appendChild(c); R.lazy(c, function () { return R.petFrames(w.byId[s2.getAttribute('data-brv')], w); }, true); });
    $('cfYes').textContent = '💞 Confirm breed · sign in ' + (V2Wallet.label ? V2Wallet.label() : 'XCP Wallet'); $('cfNo').textContent = '← Back'; }
  if (!document.getElementById('brvCss')) { var brs = document.createElement('style'); brs.id = 'brvCss'; brs.textContent = '.brv{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 8px}.brv-pet{display:flex;gap:8px;align-items:center;border:2px solid #4b3f7a;background:#120e22;padding:6px;min-width:0}.brv-pet>div{min-width:0;overflow-wrap:anywhere;font-size:14px}.brv-sp canvas{width:64px;height:64px;image-rendering:pixelated}.brv-nm{font-weight:700}.brv-sc{color:#ffd166;white-space:nowrap}.brv .pill.tier{white-space:nowrap}.brv .bk-own{font-style:normal;font-weight:700;font-size:12px;letter-spacing:.5px;padding:2px 4px;border:1px solid #000;background:#4b3f7a;color:#fff;display:inline-block;margin-top:3px}.brv .bk-own.me{background:#4fd18b;color:#0d1a12}.brv-flip{margin:0 0 8px;padding:8px 10px;border:3px solid #000;background:#ffd166;color:#1b1b1b;font-size:14px;line-height:1.35;text-align:left;box-shadow:3px 3px 0 #000;overflow-wrap:anywhere}.brv-flip b{display:block;margin:0 0 2px}.mr-row .brv-flip{flex:1 1 100%;margin-top:2px}@media (max-width:520px){.brv{grid-template-columns:1fr}.brv-flip{font-size:15px}}'; document.head.appendChild(brs); }
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
    (w.fights || []).forEach(function (f) { if (f.status !== 'open' || (tip && tip - f.block > V.FIGHT_WINDOW)) return; var A = w.byId[f.a], B = w.byId[f.b], acc = accepting[f.id];
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
      else if (B && B.owner === ME) out.push('<div class="txrow pend-in">💞 <b>Breed request:</b> ' + petLblT(w, r.a) + ' asks your ' + petLblT(w, r.b) + ' · from ' + shortAddr(r.owner) + ' at block ' + fmt(r.block) + ' · ' + until + ' · the egg goes to the requester · your pet gets the stat carry, not the egg' +
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
  function afterAccept(id) { var f = (world().fights || [])[id - 1]; if (f && f.status === 'done') { seenFight(f.id); return playFight(f); }
    toast('⚔️ Accept sent for fight ' + id + '. The fight plays here for both players once your accept burn confirms in a block.', 9000); }
  var FKEY = 'xcpets-v2-fights-seen-' + KEY + '-' + ME;
  function fightSeen() { try { return JSON.parse(localStorage.getItem(FKEY)); } catch (e) { return null; } }
  function seenFight(id) { var s = fightSeen() || {}; s[id] = 1; try { localStorage.setItem(FKEY, JSON.stringify(s)); } catch (e) { } }
  function notifyFights(w) { if (!ME || !w) return; dataSeen(); var seen = fightSeen(), first = !seen, tip = S.tip || w.tip || 0; seen = seen || {}; var q = [];
    (w.fights || []).forEach(function (f) { if (f.status !== 'done' || seen[f.id]) return; var A = w.byId[f.a], B = w.byId[f.b]; if (!(A && A.owner === ME) && !(B && B.owner === ME) && f.challenger !== ME) return;
      seen[f.id] = 1; if (first && tip - f.acceptBlock > V.FIGHT_WINDOW) return; q.push(f); }); /* first visit: only fights resolved in the last day play */
    try { localStorage.setItem(FKEY, JSON.stringify(seen)); } catch (e) { }
    q.forEach(function (f) { var win = w.byId[f.winner], los = w.byId[f.loser], mineWon = win && win.owner === ME;
      toast('⚔️ Fight ' + f.id + ' result: ' + (mineWon ? 'your ' : '') + esc(win ? win.name : '') + ' #' + f.winner + ' beat ' + (!mineWon ? 'your ' : '') + esc(los ? los.name : '') + ' #' + f.loser +
        (f.spoils ? ' and took ' + esc(f.spoils.label) : ' (no takeable gear)') + ' · #' + f.loser + ' has a black eye until block ' + fmt(f.acceptBlock + V.BLACK_EYE_BLOCKS) + '.' + (window.V2Sponsor && V2Sponsor.state && V2Sponsor.line(V2Sponsor.state, f.acceptBlock) ? ' 🏟️ X Circus Kekimus · ' + esc(V2Sponsor.line(V2Sponsor.state, f.acceptBlock)) + '.' : '') + ' <a href="#" data-replay="' + f.id + '">▶ Replay</a>', 15000); });
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
        (k.owner === ME ? '' : ' (owner ' + esc(String(k.owner).slice(0, 8)) + '…)') + ' at block ' + fmt(k.hatchBlock) + '. <a href="#" data-breplay="' + k.id + '">▶ Replay</a>', 15000); });
    q.forEach(function (k) { queueAnim(function () { replayBreed(k.id); }, '🥚 Breed replay: egg #' + k.id); }); if (q.length && window.V2Motel && V2Motel.eggPop) V2Motel.eggPop(w, q[q.length - 1]); /* breed-picker-fix: one-time egg pop (notifyBreeds' seen ids keep it once per pet) */ }
  /* cemetery-animations (owner Oct 30 2026 [pt2341u]): confirmed cemetery results (a zombie rising, a Resurrection roll, a zombie meal, feral, crumble,
   * hunted) play their 8-bit animation ONCE (js/v2-cem-anim.js keeps the seen keys), through the same queue / 'While you were away' hold as fights
   * and breeds, plus a toast with Replay. ?anim=raise|resurrect-win|resurrect-fail|zmeal|feral|crumble previews one any time. Display only. */
  /* pixel-anims (owner Oct 31 2026 4:50 PM CT [pt2513u] "Do them all"): hatching, feeding, stage-ups, Mythic and starvation each get an 8-bit scene
   * (js/v2-life-anim.js). That file is loaded only when needed: a ?anim= preview, a first look, or a confirmed feed / death of MY pets newer than the
   * mark it left last time. It keeps the seen keys (once per tx) and plays through the same queue / 'While you were away' hold. Display only. */
  var LIFE_PV = /[?&]anim=(hatch|hatch-bulk|feed|feed-many|stage|mythic|starve|god|birth-[a-z]+|sold|bought|listed|closed|gift-in|gift-out|swap|gear|hunt-won|hunt-lost|altar|arrival|grant)(&|$)/.test(location.search);
  function lifeReduced() { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function withLife(cb) { if (window.V2LifeAnim) return cb(true); var q = withLife.q = withLife.q || []; q.push(cb); if (q.length > 1) return; var t = document.createElement('script'); t.src = 'js/v2-life-anim.js?v=snd1123a';
    var fin = function (ok) { var a = withLife.q; withLife.q = []; a.forEach(function (f) { try { f(ok); } catch (e) { if (window.console) console.warn('life anim', e); } }); }; t.onload = function () { fin(true); }; t.onerror = function () { fin(false); }; document.body.appendChild(t); }
  function lifeNeeded(w) { if (!ME || !w || !w.log) return false; var m = 0; try { m = Number(localStorage.getItem('xcpets-life-mark-' + ME)) || 0; } catch (e) { return false; } if (!m) return true; var tip = S.tip || w.tip || 0; if (tip <= m) return false;
    for (var i = w.log.length - 1; i >= 0 && w.log[i].block > m; i--) { var l = w.log[i]; if (l.kind === 'feed' && (l.petIds || [l.petId]).some(function (id) { var p = w.byId[id]; return p && p.owner === ME; })) return true; }
    var G = w.giftLog || []; for (var j = G.length - 1; j >= 0 && G[j].block > m; j--) if (G[j].from === ME || G[j].to === ME) return true;
    if ((w.listings || []).some(function (L) { return L && (L.seller === ME || L.buyer === ME) && (L.block > m || L.soldBlock > m || (L.status === 'open' && ((L.endBlock > m) || (L.expire + 1 > m && L.expire < tip + 1)))); })) return true;
    var CM = w.cem; if (CM && ((CM.hunts || []).some(function (H) { return H && H.by === ME && H.block > m; }) || (CM.altarList || []).some(function (A) { return (A.pledges || []).some(function (q) { return q && q.src === ME && q.block > m; }); }))) return true; /* pixel-anims batch 5: my hunts + altar pledges */
    if (w.pets.some(function (p) { return p.owner === ME && (p.supreme || p.contest || p.burnLord) && p.hatchBlock > m; }) || (w.founderGranted > m || Object.keys(w.items || {}).some(function (k) { var it = w.items[k]; return it && it.owner === ME && it.src === 'ft-flag-grant' && it.grantBlock > m; }))) return true; /* pixel-anims batch 7: 1-of-1 / edition eggs and gear grants */
    return w.pets.some(function (p) { return p.owner === ME && ((p.dead && p.deathBlock > m && p.deathBlock <= tip) || (p.resurrected && p.resurrected.block > m)); }); }
  function notifyLife(w) { if (LIFE_PV) { LIFE_PV = false; withLife(function (ok) { if (ok) V2LifeAnim.preview(world(), ME); }); return; } if (!lifeNeeded(w)) return; dataSeen();
    withLife(function (ok) { if (!ok) return; var LA = window.V2LifeAnim, w2 = world(), q = LA.collect(w2, ME, S.tip || w2.tip || 0);
      q.forEach(function (ev) { queueAnim(function () { LA.play(ev, { w: world() }); }, LA.caption(ev, w2).slice(0, 70)); }); }); }
  function notifyCem(w) { var CA = window.V2CemAnim; if (!CA) return; if (CA.preview(w, ME)) return; if (!ME) return; dataSeen(); var q = CA.collect(w, ME, S.tip || w.tip || 0);
    q.forEach(function (ev) { var key = ev.key || (ev.kind + ':' + (ev.id || '') + ':' + (ev.tx || ev.block || '')); window.V2CemReplay = window.V2CemReplay || {}; window.V2CemReplay[key] = ev;
      toast(esc(CA.caption(ev, w)) + ' <a href="#" data-cemreplay="' + esc(key) + '">▶ Replay</a>', 15000);
      queueAnim(function () { CA.play(ev, { w: world() }); }, '🧟 ' + CA.caption(ev, w).replace(/^\S+\s/, '').slice(0, 60)); }); }
  /* rare-room-unequip: the arena panel is hidden on Rare Room (and every place except the fight page). Filling the two
   * fighter lists and the arena scene scanned the whole world on every render, including a free Take off. */
  function placeShown(id) { var el = $(id); return !!(el && !el.hidden && el.getAttribute('aria-hidden') !== 'true' && !el.classList.contains('split-off')); }
  function renderBattles(w) {
    if (!placeShown('arenaPanel')) return;
    var a = $('fMine').value, b = $('fTheirs').value;
    $('fMine').innerHTML = fighters(w, ME).map(opt).join('') || '<option value="">no eligible pet</option>'; $('fTheirs').innerHTML = fighters(w, ME, true).map(opt).join('');
    if (a) $('fMine').value = a; if (b) $('fTheirs').value = b;
    if (window.V2Lookup) V2Lookup.mount($('battlePanel'), { id: 'fightLook', mode: 'fight', onReady: function () { render(); } });
    /* playtest Nov 25 2026: a fast world carries every fight (summary.state) but only this wallet's pets, so another wallet's fighter
     * can be missing from byId ("reading 'name'" on fight.html). Show its number and name what we have. */
    $('fights').innerHTML = (w.fights || []).slice().reverse().map(function (f) { var A = w.byId[f.a] || { name: '', owner: null }, B = w.byId[f.b] || { name: '', owner: null };
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
  var heldA = [], heldR = false, released = false, firstDataT = 0, holdT = 0;
  function dataSeen() { if (!firstDataT) firstDataT = Date.now(); }
  function holding() { return !released && document.documentElement.classList.contains('ip-hold') && firstDataT && Date.now() - firstDataT < 8000; }
  function awayPing() { if (window.V2IpChip) try { V2IpChip(); } catch (e) { } }
  window.V2Held = { count: function () { return heldA.length + (heldR ? revealQ.length : 0); },
    list: function () { return (heldR ? revealQ.map(function (r) { return r.kind === 'gear' ? '🎁 ' + r.wins.length + ' new gear piece' + (r.wins.length > 1 ? 's' : '') : '🥚 ' + r.eggs.length + ' egg' + (r.eggs.length > 1 ? 's' : '') + ' hatched'; }) : []).concat(heldA.map(function (a) { return a.label; })); },
    run: function () { released = true; heldR = false; var a = heldA; heldA = []; a.forEach(function (x) { queueAnim(x.fn); }); nextReveal(); awayPing(); },
    skip: function () { released = true; heldR = false; heldA = []; revealQ.length = 0; awayPing(); } };
  function queueAnim(fn, label) { if (holding()) { heldA.push({ fn: fn, label: label || '▶ Replay' }); awayPing(); return; } animQ.push(fn); if (!animM.el && animQ.length === 1) setTimeout(nextAnim, 600); }
  function nextAnim() { if (animM.el || !animQ.length) return; if ((window.V2CemAnim && V2CemAnim.busy()) || (window.V2LifeAnim && V2LifeAnim.busy())) return; /* a cemetery animation is on screen; it calls V2AnimDone when it ends */ if ($('packBox').classList.contains('on') || sheetOpen()) return setTimeout(nextAnim, 1500); animQ.shift()(); }
  /* playtest (Nov 25 2026): a fight replay used to pop up in front of the Sign & burn sheet (or any other open sheet) a few seconds after the
   * page opened, and the player's press landed on the replay. Replays wait until no sheet is open. */
  function sheetOpen() { var L = document.querySelectorAll('.reveal.on, [aria-modal="true"]'); for (var i = 0; i < L.length; i++) { var e = L[i]; if (e.id === 'animBox' || e.closest('#animBox')) continue; if (e.offsetWidth || e.offsetHeight) return true; } return false; }
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
    var A = w.byId[f.a], B = w.byId[f.b];
    /* playtest (Nov 25 2026): on fast pages the other player's pet may not be loaded (or has no art yet). Load both, then play; never crash. */
    if ((!A || !B || !A.art || !B.art) && !(o && o.loaded) && window.V2Split && V2Split.ensurePet) { Promise.all([V2Split.ensurePet(f.a), V2Split.ensurePet(f.b)]).then(function () { return V2Split.dress ? V2Split.dress([f.a, f.b]) : 0; }).then(function () { playFight(f, Object.assign({}, o || {}, { loaded: 1 })); }, function () {}); return; }
    if (!A || !B) return;
    var fa = petFrames(Object.assign({}, A, { blackEye: false, crowned: false }), w), fb = petFrames(Object.assign({}, B, { blackEye: false, crowned: false }), w);
    var fl = petFrames(Object.assign({}, f.loser === A.id ? A : B, { blackEye: true }), w), tmp = document.createElement('canvas'); tmp.width = tmp.height = 32;
    var t = 0, k = 0, hpA = f.maxA, hpB = f.maxB, msg = 'FIGHT: #' + A.id + ' vs #' + B.id, sp = f.spoils ? (typeof f.spoils === 'string' ? f.spoils : f.spoils.label) : null;
    $('fightLog').innerHTML = f.turns.map(function (x) { return '<li>#' + (x.by === 'a' ? A.id : B.id) + ' swings ' + esc(x.weapon) + (x.dodge ? ' — dodged!' : ' for ' + x.dmg + (x.crit ? ' CRIT' : '')) + ' (HP ' + x.hpA + ' / ' + x.hpB + ')</li>'; }).join('') + '<li><b>Winner #' + f.winner + '</b>' + (sp ? ' takes ' + esc(sp) : '') + ' · loser: black eye ' + V.BLACK_EYE_BLOCKS + ' blocks</li>';
    clearInterval(playFight.iv);
    function draw(img,x,flip,lunge){R.drawSprite(ctx,img,x+lunge,40,96,flip,{x:0,y:16,w:ctx.canvas.width,h:128});}
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
    if (window.V2Motel && V2Motel.placeOn && !V2Motel.placeOn()) return; /* hidden on every place except Gooby: do not scan the world or build cards */
    var a = $('bA').value, b = $('bB').value, pick = window.V2Motel && V2Motel.picker ? V2Motel.picker : V.breedPicker.bind(V), L = pick(w, ME, S.tip, a, pendingBreedIds());
    if (a && !L.mine.some(function (x) { return String(x.p.id) === a && !x.why; })) a = $('bA').value = '';
    if (b && !L.partners.some(function (x) { return String(x.p.id) === b && !x.why; })) b = $('bB').value = '';
    /* perf (2026-10-14): a 2,000-pet wallet has ~6,000 picker cards. Eligibility is one breedPicker pass per render (cheap); the cards are built
     * ONCE per world (one HTML string -> one fragment, lazy sprites, one delegated click per grid) and a pick only updates the affected cards. */
    function card(x, role, sel) { var p = x.p, on = String(p.id) === sel;
      return '<button type="button" class="pet card' + (on ? ' sel' : '') + (x.why ? ' off' : '') + '" data-role="' + role + '" data-pid="' + p.id + '" title="' + esc(x.why ? 'Can\'t pick: ' + x.why : 'Pick #' + p.id + ' as parent ' + role) + '" aria-pressed="' + on + '">' +
        '<canvas width="32" height="32"></canvas><b style="color:var(--ink)">' + esc(p.name) + '</b><div class="muted">#' + p.id + ' ' + tierPill(p.tier, p) + ' · ' + esc(spLabel(p)) + ' · ' + esc((V.stageLabelOf ? V.stageLabelOf(p) : p.stageName)) + '</div>' + (p.owner !== ME ? '<div class="muted">' + shortAddr(p.owner) + '</div>' : '') + '</button>'; }
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
    var RULE = 'A pet can breed when it is <b>Adult or older</b> (stage 3+: Adult, Elder, Mythic), not neglected, ' + (V.breedCapOn && V.breedCapOn(S.tip) ? 'has bred fewer than <b>' + V.BREED_MAX + '</b> times and ' : 'and ') + 'its last breeding was at least <b>' + fmt(V.BREED_COOLDOWN) + ' blocks</b> ago (about a week). ' + (V.breedV2On && V.breedV2On(S.tip + 1) ? 'It can\'t breed with its parent, child or sibling. Community pets and risen zombies never breed.' : 'Nakamoto and community pets never breed.'); /* glitch-display-1102: Nakamoto breeds like any pet since breeding v2 (pets.html), the old line said it never does */
    var gridsOff = $('bGridA') && $('bGridA').closest && $('bGridA').closest('[hidden]');
    if (gridsOff) { /* the old grids are hidden (easy flow is the picker). Building a card per breedable pet in the world locked the page. */
      recentKids(w); reqsLine(w); return; }
    var okA = L.mine.filter(function (x) { return !x.why; }), okB = L.partners.filter(function (x) { return !x.why; });
    function note(id, after, html) { var n = $(id); if (!n) { n = document.createElement('div'); n.id = id; n.className = 'small muted bnote'; after.parentNode.insertBefore(n, after); } n.innerHTML = html; }
    note('bNoteA', $('bGridA'), fmt(okA.length) + ' of ' + fmt(L.mine.length) + ' of your pets can breed now.');
    note('bNoteB', $('bGridB'), fmt(okB.length) + ' of ' + fmt(L.partners.length) + ' pets can breed now' + (a ? ' (excluding parent A #' + esc(a) + ')' : '') + '.');
    grid($('bGridA'), okA, a, 'A', $('bA')); grid($('bGridB'), okB, b, 'B', $('bB'));
    if (!okA.length) $('bGridA').innerHTML = '<p class="small bempty">' + (L.mine.length ? 'None of your pets can breed yet: ' + reasons(L.mine) + '. ' : 'You have no living pets. ') + RULE + '</p>';
    if (!okB.length) $('bGridB').innerHTML = '<p class="small bempty">No partner can breed right now' + (L.partners.length ? ': ' + reasons(L.partners) : '') + '. ' + RULE + '</p>';
    if (!okA.length) $('bGridA').__w = null; if (!okB.length) $('bGridB').__w = null;
    $('bSelA').innerHTML = a ? '#' + a + ' ' + esc(w.byId[a].name) + ' ' + tierPill(w.byId[a].tier, w.byId[a]) : 'pick one'; $('bSelB').innerHTML = b ? '#' + b + ' ' + esc(w.byId[b].name) + ' ' + tierPill(w.byId[b].tier, w.byId[b]) + (w.byId[b].owner !== ME ? ' <span class="muted">' + shortAddr(w.byId[b].owner) + '</span>' : '') : 'pick one';
    recentKids(w); reqsLine(w);
  }
  /* House-rules children used to print every egg in the world into the DOM on each refresh. Newest 24, plus the real count. One shared newest-first list (V2Motel.bredKids) so this does not sort the world again. */
  function recentKids(w) { var box = $('bKids'); if (!box) return; var all = window.V2Motel && V2Motel.bredKids ? V2Motel.bredKids(w) : null, last, n;
    if (!all) { last = []; n = 0; for (var i = 0; i < w.pets.length; i++) { var p = w.pets[i]; if (!p.parents) continue; n++; last.push(p); if (last.length > 24) last.shift(); } }
    else { n = all.length; last = all.slice(0, 24); }
    var key = n + '|' + (last[0] ? last[0].id : 0); if (box.__rk === key) return; box.__rk = key;
    box.innerHTML = (n > last.length ? '<span class="muted">Newest ' + last.length + ' of ' + fmt(n) + ' eggs. </span>' : '') + (last.map(function (k) { return '<span class="chip">#' + k.id + ' ' + esc(k.name) + ' · ' + (V.tierLabelOf ? V.tierLabelOf(k) : TL[k.tier]) + ' ' + spLabel(k) + ' · ' + k.stageName + ' ← #' + k.parents.join(' × #') + '</span>'; }).join('') || '<span class="muted">none yet</span>'); }
  function reqsLine(w) { var box = $('bReqs'); if (!box) return;
    box.innerHTML = w.breedReqs.filter(function (r) { return !r.used && S.tip - r.block <= V.BREED_WINDOW; }).map(function (r) { return '<div data-btx="' + esc(r.tx || '') + '">' + petLblT(w, r.a) + ' → ' + petLblT(w, r.b) + ' (until block ' + (r.block + V.BREED_WINDOW) + ') ' + ((w.byId[r.b] || {}).owner !== ME ? '<span class="muted">waiting for the owner of #' + r.b + ' to accept</span>' : (V.sendBlock && V.sendBlock(w, { tag: 'pet:breed:' + r.b + ':' + r.a, accept: true }, S.tip, { me: ME }) ? '<span class="muted">can\'t accept: ' + esc(V.sendBlock(w, { tag: 'pet:breed:' + r.b + ':' + r.a, accept: true }, S.tip, { me: ME })) + '</span>' : '<span class="muted">accept it in Your pending challenges above</span>')) + '</div>'; }).join('') + unconfBreeds(w) || '<div class="muted">none</div>'; }
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
  $('bGo').onclick = function () { if (!ME) return confirmPlans('Breed', [{}]); var a = $('bA').value, b = $('bB').value; if (!a || !b) return toast('Pick parent A and parent B'); var n0 = petIds(), flip0 = breedFlip(world(), a, b);
    confirmPlans('Breed #' + a + ' × #' + b, [{ tag: V.buildTag('breed', { a: a, b: b }), amount: 690 }], function () { var y = window.scrollY; if (window.V2Motel) { V2Motel.checkedIn(a, b); if (V2Motel.celebrate) V2Motel.celebrate(S.lastTx); } else { $('bA').value = ''; $('bB').value = ''; } /* no-tail-motel: keep the pair so the door can open in place */ render(); keepScroll(y); playBreed(a, b, n0); var w2 = world(), A2 = w2.byId[a], B2 = w2.byId[b]; toast(flip0 ? '💞 ' + breedFlipText(flip0) : (A2 && B2 && A2.owner === B2.owner ? '⏳ Breeding #' + a + ' × #' + b + ': your egg appears once this confirms.' : '💞 Breed request sent: #' + a + ' → #' + b + '. The partner\'s owner can accept it once it confirms.'), 9000); }); if (ME && $('confirmBox').classList.contains('on')) { $('cfBody').insertAdjacentHTML('afterbegin', breedSum(world(), a, b)); breedReview(world(), a, b); } };
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
    (w.fights || []).forEach(function (f) { if (f.status !== 'open' || (tip && tip - f.block > V.FIGHT_WINDOW)) return; var A = w.byId[f.a], B = w.byId[f.b]; if (!B || B.owner !== ME) return; if (V.sendBlock && V.sendBlock(w, { tag: 'pet:accept:' + f.id }, tip, { me: ME })) return; /* wasted-burn guard: no pop-up for a challenge that can't be accepted */
      var k = 'f' + f.id; if (seen[k] || have[k]) return; IRQ.push({ k: k, sel: '[data-acc="' + f.id + '"]', kind: 'fight', a: f.a, b: f.b, title: '📥 Battle challenge', who: f.challenger || (A && A.owner), pets: petLblT(w, f.a) + ' vs your ' + petLblT(w, f.b), cost: accNow(w, f.id), until: f.block + V.FIGHT_WINDOW, label: 'Accept (' + fmt(accNow(w, f.id)) + ')' }); });
    w.breedReqs.forEach(function (r) { if (r.used || (tip && tip - r.block > V.BREED_WINDOW)) return; var B = w.byId[r.b]; if (!B || B.owner !== ME || r.owner === ME) return; if (V.sendBlock && V.sendBlock(w, { tag: 'pet:breed:' + r.b + ':' + r.a, accept: true }, tip, { me: ME })) return; /* breed-accept-guard: no pop-up for a request that can't be accepted */
      var k = 'b' + (r.tx || r.a + ':' + r.b); if (seen[k] || have[k]) return; IRQ.push({ k: k, sel: '[data-bracc="' + r.b + ':' + r.a + '"]', kind: 'breed', a: r.a, b: r.b, title: '💞 Breed request', who: r.owner, pets: petLblT(w, r.a) + ' asks your ' + petLblT(w, r.b) + ' · the egg goes to the requester · your pet gets the stat carry, not the egg', cost: V.COSTS.breed, until: r.block + V.BREED_WINDOW, label: 'Accept breed (' + fmt(V.COSTS.breed) + ')' }); });
    irqNext(); }
  /* side-by-side decision info (theirs | yours). Fight numbers follow V2Rules.simulateFight: HP 40+2·vigor+grit+6·stage, gear bonus Σ(1+2·tier),
   * crit 5+⌊luck/4⌋ %, dodge ⌊zoom/5⌋ % (defender's zoom), first strike zoom + d10. Breed numbers follow breedChild/breed. No win % is shown. */
  function irqCompare(w, x) { var A = w.byId[x.a], B = w.byId[x.b]; if (!A || !B) return ''; var K = ['vigor', 'spark', 'grit', 'zoom', 'luck'];
    var pw = function (p) { return K.reduce(function (t, k) { return t + (p.stats[k] || 0); }, 0); };
    var gear = function (p) { return V.wornOf(w, p.id).map(function (g) { var it = (V.GEAR_BY_ID || {})[g.item]; return { slot: g.slot, label: it ? it.label : (g.label || g.item), tier: it ? it.tier : (g.legendary ? 3 : (g.tier || 0)) }; }); };
    var best = function (p) { return K.reduce(function (m, k) { return p.stats[k] > p.stats[m] ? k : m; }, K[0]); };
    var hp = function (p) { return 40 + p.stats.vigor * 2 + p.stats.grit + p.stage * 6; }, gp = function (p) { return gear(p).reduce(function (t, g) { return t + 1 + g.tier * 2; }, 0); };
    function col(p, o, who) { var g = gear(p), grip = g.filter(function (q) { return q.slot === 'hand'; })[0], h = '<div class="irqcol' + (window.V2FightTag && V2FightTag.mine(p) ? ' fme' : '') + '"><div class="small muted">' + (window.V2FightTag && x.kind === 'fight' ? V2FightTag.html(p, o) : who) + '</div><canvas width="32" height="32" class="sprite" data-irqp="' + p.id + '"></canvas><div><b>' + esc(p.name) + '</b> <span class="muted">#' + p.id + '</span></div><div class="chips">' + tierPill(p.tier, p) + '<span class="chip">' + esc(spLabel(p)) + '</span><span class="chip stg">' + p.stageName + '</span><span class="chip pow"' + ptA(p) + '>⚡ ' + pw(p) + '</span></div>' +
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
    box.innerHTML = '<div class="box"><h2 id="irqTitle" class="sec" data-ico="sword">' + esc(x.title) + '</h2><p class="small">From ' + shortAddr(x.who) + '</p><p>' + x.pets + '</p>' + (x.kind === 'breed' ? breedFlipNote({ kind: 'confirmed' }) : '') + '<p class="small">Cost to accept: <b>' + fmt(x.cost) + ' <span class="asset">XCPETS</span></b> · expires at block <b>' + fmt(x.until) + '</b>' + (IRQ.length ? ' · ' + IRQ.length + ' more waiting' : '') + '</p>' + irqCompare(world(), x) +
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
    $('breedStage').style.display = ''; $('breedMsg').textContent = kid ? '' : (function () { var f = breedFlip(w, a, b); return f ? breedFlipText(f) : 'Request sent: the partner\'s owner must mirror it within 144 blocks.'; })();
    function draw(img,x,y,flip,size){R.drawSprite(ctx,img,x,y,size||96,flip,{x:0,y:16,w:ctx.canvas.width,h:ctx.canvas.height-32});}
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
      if (t >= 40 && kid && !$('bFeedEgg')) { $('breedMsg').innerHTML = (kid.hybrid ? '🧬 <span class="chip hyb">HYBRID</span> <b>' + esc((window.V2Rules && V2Rules.hybridLabel ? V2Rules.hybridLabel(kid.hybrid.key) : kid.hybrid.name)) + '</b> (' + (kid.hybrid.roots || [kid.hybrid.a, kid.hybrid.b]).map(function (r) { return esc(V.speciesLabel(r)); }).join(' × ') + ') · ' : '') + '🥚 <b>#' + kid.id + ' ' + esc(kid.name) + '</b> · ' + TL[kid.tier] + ' ' + esc(spLabel(kid)) + ' · starts as an Egg · parents #' + A.id + ' × #' + B.id + '<br><span class="hatchnote">Your new egg #' + kid.id + ' is in My Pets. Feed it ' + fmt(kid.nextMeal > 0 ? kid.nextMeal : V.COSTS.feedMin) + ' XCPETS to hatch.</span> <button type="button" class="q" id="bFeedEgg" data-egg="' + kid.id + '">🍼 Feed to hatch</button>'; $('bFeedEgg').onclick = function () { feedEgg(kid.id); }; } }
    clearInterval(playBreed.iv); frame(); playBreed.iv = setInterval(function () { k++; frame(); if (k >= END) { clearInterval(playBreed.iv); setTimeout(function () { if (animM.el === $('breedStage')) animClose(); }, 1200); } }, 120);
    $('bSkip').onclick = function () { clearInterval(playBreed.iv); k = END; frame(); breedSkip(kid ? kid.id : null); };
    $('bSkip').disabled = false; var bn = $('bSkipNote'); if (bn) bn.remove();
    animOpen($('breedStage'), playBreed.iv, function () { clearInterval(playBreed.iv); k = END; frame(); });
  }
  window.V2PlayBreed = playBreed; window.V2PetIds = petIds; // used by the screenshot/UI check
  // ---------------------------------------------------------------- burns + log (live .txrow look)
  function renderLog(w) {
    var KL = { fight: 'challenge', fightDone: 'fight result' }; /* 2026-10-15: plain labels for battle lines (display only) */
    var row = function (l) { return '<a href="#" class="txrow" data-tx="' + esc(l.tx) + '">' + esc(KL[l.kind] || l.kind) + ' · block ' + l.block + ' · ' + esc(window.XcpSlots ? XcpSlots.text(l.msg) : l.msg) + '</a>'; };
    var mineTx = {}; S.rows.forEach(function (r) { if (r.source === ME) mineTx[r.tx_hash] = 1; });
    /* A published view has no replay log. attachBurns fills display lines and marks each with src. */
    function mineLine(l) { return mineTx[l.tx] || (l.src && l.src === ME); }
    if (V2Wallet.sweepPending) V2Wallet.sweepPending();
    var pl = V2Wallet.tracker.list(); if (V2Wallet.pollPending && pl.some(function (t) { return t.status !== 'confirmed'; })) V2Wallet.pollPending().then(function (n) { if (n) try { renderLog(world()); } catch (e) { } }); /* post-buy-fixes */
    pl = V2Wallet.tracker.list();
    var pend = pl.filter(function (t) { return t.status !== 'confirmed' && !S.rows.some(function (x) { return x.tx_hash === t.txid; }); }).reverse().map(function (t) { var dex = t.kind === 'dex' || /^(order|cancel|issuance|send|mpma)$/.test(t.tag || ''), act = t.act || { issuance: 'token', mpma: 'send' }[t.tag] || t.tag; var what = dex ? (t.give && t.give.qty ? 'gives ' + fmt(t.give.qty) + ' ' + esc(t.give.asset) : esc({ token: 'token issue', cancel: 'cancel', send: 'token send', order: 'order' }[act] || act || 'order')) : t.amount != null ? fmt(t.amount) + ' XCPETS' : '';
      return '<div class="small">⏳ ' + esc(t.label || t.tag) + (what ? ' · ' + what : '') + ' · <a target="_blank" rel="noopener" href="https://mempool.space/tx/' + t.txid + '">' + t.txid.slice(0, 8) + '…</a> · waiting for a block <button type="button" class="q" data-drop="' + t.txid + '">Dismiss</button></div>'; }).join('');
    $('pending').innerHTML = pend + (w.log.filter(mineLine).slice(-8).reverse().map(row).join('') || (pend ? '' : 'None yet.'));
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
  function packExit(then) { if (rev && rev.kind === 'eggs') uDel(rev.all || rev.eggs); close('packBox'); rev = null; render(); setTimeout(nextReveal, 250);
    setTimeout(function () { if ($('packBox').classList.contains('on')) return; var y = packY; packY = null; then(y); }, 300); }
  if ($('packX')) $('packX').onclick = function () { packExit(function (y) { if (y != null) window.scrollTo({ top: y, behavior: 'auto' }); }); };
  if ($('packHatchMore')) $('packHatchMore').onclick = function () { packExit(function () { var hp = $('hatchPanel'); if (!hp) return; try { hp.scrollIntoView({ behavior: 'auto', block: 'start' }); } catch (e) { }
    var b = $(lastHatchN >= 1000 ? 'zapBtn' : lastHatchN >= 144 ? 'caseBtn' : lastHatchN >= 12 ? 'dozenBtn' : 'hatchBtn'); if (b) { try { b.focus({ preventScroll: true }); } catch (e) { } b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash'); setTimeout(function () { b.classList.remove('flash'); }, 2400); } }); };
  $('packClose').onclick = closeReveal; $('packSkip').onclick = function () { if (rev && rev.kind === 'eggs') uDel(rev.all || rev.eggs); if (!revealQ.length) packY = null; close('packBox'); rev = null; render(); setTimeout(nextReveal, 250); };
  /* egg-review-sort 2026-10-24: the review's 'Discard all Commons' button is removed (owner); Rarity: low to high puts Commons first. My Pets' own Discard all Commons (delCommonsBox) is unchanged. */
  $('packDiscard').onclick = function () { if (!rev || rev.kind !== 'eggs') return;
    if (revMode() === 'keep') { /* keep-pick: discard every pet of this hatch that is not picked to keep and not protected; the confirm names the count and rarities */
      var kw = world(), r = revRest(kw), nk = Object.keys(rev.keep || {}).length; if (!nk) return toast('Tap the pets you want to keep first.'); if (!r.ids.length) return toast('Nothing left to discard: every other pet is protected.');
      var tl = [3, 2, 1, 0].filter(function (t) { return r.tiers[t]; }).map(function (t) { return r.tiers[t].toLocaleString('en-US') + ' ' + TIERS[t].label; }).join(', ');
      return revHide(r.ids, 'Keep ' + plural(nk, 'pet') + ' and discard the rest?\n\n🗑️ This discards ' + plural(r.ids.length, 'pet') + ' from this hatch (' + tl + ').\n\n✅ Kept: ' + nk.toLocaleString('en-US') + ' you picked' + (r.prot ? ' + ' + r.prot.toLocaleString('en-US') + ' always kept (' + revWhy(r) + ')' : '') + '.'); }
    var ids = Object.keys(rev.sel).map(Number); if (!ids.length) return toast('Tap a pet to select it first.');
    var dw = world(), gd = ids.filter(function (id) { var p = dw.byId[id]; return p && !isKept(id) && dudGuard(dw, p).length; });
    revHide(ids, 'Discard ' + ids.length.toLocaleString('en-US') + ' selected pet' + (ids.length > 1 ? 's' : '') + '?' + (gd.length ? '\n\n🛡️ ' + gd.length + ' of them ' + (gd.length > 1 ? 'are' : 'is') + ' protected (' + (function () { var why = []; gd.forEach(function (id) { dudGuard(dw, dw.byId[id]).forEach(function (r) { r = /^wearing/.test(r) ? 'wearing gear' : r; if (why.indexOf(r) < 0) why.push(r); }); }); return why.join(', '); })() + '): ' + idList(gd) + '.' : '')); };
  $('txClose').onclick = function () { close('txBox'); };
  $('waitCancel').onclick = function () { close('waitOverlay'); };
  $('introSkip').onclick = function () { close('intro'); };
  $('replayIntro').onclick = function (e) { e.preventDefault(); var iw = world(), gp = R.communityGap && R.communityGap(iw), fr = gp ? R.comingSoonFrames() : commAnim && commAnim.fr ? commAnim.fr : R.communityFrames(iw); if (fr) R.animate($('introCv'), fr); /* current community pet (Nakamoto before The Return: no Wizard spoiler) */ $('introText').textContent = 'Welcome to XCPETS v2'; open('intro'); setTimeout(function () { close('intro'); }, 2500); };
  $('wdisconnect').onclick = function () { toast('To view any address read-only, use 👀 View pets by address (or open play.html?addr=YOUR_ADDRESS).'); };
  $('gWallet').onclick = function () { var b = $('gWallet'), WL = window.V2Wallet && V2Wallet.label ? V2Wallet.label() : 'XCP Wallet'; /* casatookan-wallet: XCP Wallet or Casa Tookan (webXCP) */
    if (!window.xcpwallet && !window.webXCP && !window.web3xcp) { toast((window.V2Wallet && V2Wallet.NOT_FOUND) || 'No wallet found. Use the XCP Wallet Chrome extension, or open xcpets.fun in the Casa Tookan app.', 9000); return; }
    b.disabled = true; /* wallet-one-window: share V2Wallet's single connect (no second wallet window) */ (window.V2Wallet && V2Wallet.connect ? V2Wallet.connect().then(function (a) { return { accounts: [a] }; }) : window.xcpwallet.request({ method: 'xcp_requestAccounts' })).then(function (r) { var a = (r && r.accounts && r.accounts[0]) || (Array.isArray(r) ? r[0] : null); b.disabled = false;
      if (!a) return toast(WL + ' returned no address.'); try { localStorage.setItem('xcpets-v2-me', a); localStorage.setItem('xcpets-xcpwallet-address', a); } catch (e) { }
      if (a !== ME) location.reload(); else toast('✓ ' + WL + ' connected'); }, function (e) { b.disabled = false; toast(e && e.code === 4001 ? 'You cancelled in the wallet.' : WL + ' connect failed: ' + ((e && e.message) || 'try again')); }); };
  function showTx(tx) { var w = world(), l = w.log.filter(function (x) { return x.tx === tx; })[0], r = S.rows.filter(function (x) { return x.tx_hash === tx; })[0]; if (!l) return;
    $('txInfo').innerHTML = '<p class="small"><b>' + esc(l.kind) + '</b> · ' + esc(window.XcpSlots ? XcpSlots.text(l.msg) : l.msg) + '</p><table class="small"><tr><td>block</td><td>' + l.block + '</td></tr><tr><td>tx</td><td><code>' + esc(tx) + '</code></td></tr>' + (r ? '<tr><td>from</td><td>' + esc(r.source) + '</td></tr><tr><td>tag</td><td><code>' + esc(r.tag) + '</code></td></tr><tr><td>amount</td><td>' + fmt(r.amount) + ' XCPETS</td></tr>' : '') + '</table><p class="small muted">Burn sent from your ' + esc((window.V2Wallet && V2Wallet.label ? V2Wallet.label() : 'XCP Wallet')) + '.</p>'; open('txBox'); }
  ['pending', 'log'].forEach(function (id) { $(id).onclick = function (e) { var drop = e.target.closest('[data-drop]'); if (drop && window.V2Wallet && V2Wallet.dismissPending) { e.preventDefault(); V2Wallet.dismissPending(drop.getAttribute('data-drop')); renderLog(world()); return; } var a = e.target.closest('a[data-tx]'); if (!a) return; e.preventDefault(); showTx(a.dataset.tx); }; });
  /* pet-page-zombies (Nov 23 2026, Jake: one pet page for every pet): a risen zombie's old link play.html#pet-ID forwards to pet.html?id=ID,
   * which now feeds, pledges, resurrects and hunts it. Other pets still open the pop-up here ('More in the game' on the pet page). */
  function route() { if (actRoute()) return; var m = /^#pet-(\d+)$/.exec(location.hash), mp = m && world().byId[m[1]];
    if (mp && ZB(mp)) { location.replace('pet.html?id=' + mp.id); return; }
    if (m && !mp && window.V2Split && V2Split.ensurePet && !route.ask) { route.ask = 1; V2Split.ensurePet(+m[1]).then(function () { route.ask = 0; if (location.hash === m[0] && world().byId[m[1]]) route(); }, function () { route.ask = 0; }); }
    if (mp) { detailId = Number(m[1]); detail(mp); }
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
  window.V2UI = { hiddenIds: hiddenIds, pickIds: pickIds, starIds: starIds, keptIds: keptIds, isKept: isKept, toggleKeep: toggleKeep, feedAllPaused: FEED_ALL_PAUSED, feedQueue: feedQ, feedSelQueue: feedSelQ, lairOn: function () { var on = lairOn(); if (!on) lairStale = true; return on; }, sendWhy: sendWhy, myPendingTags: myPendingTags, pendingFeedIds: pendingFeedIds, pendingBreedIds: pendingBreedIds, viewOnly: viewOnly, viewBlock: viewBlock, autoEquip: autoEquipIsOn, aeToggleHtml: aeToggleHtml, bindAeTogs: bindAeTogs, S: function () { return S; }, ME: ME, world: world, render: render, refreshGear: refreshGear, toast: toast, confirmPlans: confirmPlans, resumeGo: resumeGo, resumeDrop: resumeDrop, resumePending: resumePending, resumeReoffer: resumeReoffer, replayFight: replayFight, replayBreed: replayBreed, replayCem: replayCem, breedSum: breedSum, breedReview: breedReview, breedFlip: breedFlip, breedFlipText: breedFlipText, breedFlipNote: breedFlipNote, save: save, selUi: selUi, mine: mine, fighters: fighters, afterAccept: afterAccept, detail: function (id) { detailId = id; detail(world().byId[id]); }, petList: function (w) { var all = mine(w); return petList(all.filter(function (p) { return !p.dead; }), all.filter(function (p) { return p.dead; })); }, cem: function () { return cem; }, playFight: playFight, cardFor: function (p, w) { if (!renderPets.mk) return null; var d = renderPets.mk(p); R.lazy(d.querySelector('canvas'), function () { return petFrames(p, w || world()); }); return d; }, statBars: statBars, goPet: goPet, feed: function (id) { if (viewBlock()) return; var p = world().byId[id]; if (!ME || !p || p.owner !== ME || p.dead || p.released) return toast('Only the owner of a living pet can do that. Connect the wallet that owns #' + id + '.'); confirmPlans('Feed #' + id, V.feedQueue(world(), ME, [id])); } };
  if (window.V2Split && V2Split.rest) setTimeout(V2Split.rest, 0); /* enough living pets for the first screen; the rest wait for Show more */
  render(); route();
  /* freeze-hunt (Nov 22 2026): while a big wallet's pages are still arriving, the world is replaced 5 or 6 times and each one redrew the whole
   * page (0.3 to 0.5 s each on a phone, measured). Partial worlds now repaint at most every 4 s, with one repaint after the last batch;
   * the complete world repaints at once, exactly as before. */
  var freshAt = 0, freshT = 0;
  function freshRender() { var w = null; try { w = world(); } catch (e) {} var pg = w && w._pages, partial = !!(pg && !w._full && (pg.got || 1) < (pg.pages || 1));
    if (freshT) { clearTimeout(freshT); freshT = 0; }
    var wait = partial ? freshAt + 4000 - Date.now() : 0;
    if (wait > 0) { freshT = setTimeout(freshRender, wait); return; }
    /* Nov 25 2026 (robot, 40,000-pet wallet: breed/fight/raid froze ~1 s): a partial repaint ran inside the same task as the owner-page
     * batch that set the world, so the two costs added up into one freeze. Paint it in its own task; the complete world still paints at once. */
    if (partial) { freshAt = Date.now(); freshT = setTimeout(function () { freshT = 0; render(); }, 0); return; }
    freshAt = Date.now(); render(); }
  if (M.onFresh) M.onFresh(freshRender); /* boot-from-cache: repaint when the fresh world replaces the saved one */
  /* new confirmed burns (e.g. your roll result) every 60 s. smooth-perf (2026-10-19): skipped while the tab is hidden (no background API calls or
   * re-renders); coming back to the tab after a missed poll reads the chain once right away. An unchanged chain keeps the same world (v2-chain.js). */
  var lastPoll = Date.now(); function poll() { lastPoll = Date.now(); M.refresh(render); }
  setInterval(function () { if (document.hidden) return; poll(); }, 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && Date.now() - lastPoll > 60000) poll(); });
  window.__demo = { pickIds: pickIds, starIds: starIds, queueAnim: queueAnim, S: function () { return S; }, world: world, render: render, toggle: toggle, detail: function (id) { detailId = id; detail(world().byId[id]); }, playFight: playFight, discardIds: discardIds, mine: mine, isKept: isKept, keptIds: keptIds, toggleKeep: toggleKeep, idList: idList, selUi: selUi, confirmPlans: confirmPlans, feedIds: function (title, ids) { feedAsync(title, ids, true); }, hiddenIds: hiddenIds, openPile: openPile, feedQueueList: function (w, ids) { return feedSelQ(w, ME, ids); } /* list burns only (pet:feed/fl/fm), never pet:fa */ };
})();
