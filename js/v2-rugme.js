/* RUG ME (branch rug-me, Oct 22 2026; PREVIEW, NOT LIVE): a Tinder-style swipe stack for breeding, its own tab next to the
 * existing No-Tail Motel check-in (which stays as it is). Rules: V2Rules (pet:ad / pet:rug / pet:unad, gate ACTIVATE_RUGME_BLOCK).
 * Swipe LEFT = skip: local only (localStorage per pet per chain day), never sent, never visible to anyone. Undo brings it back.
 * Swipe RIGHT = opens the normal single XCP Wallet confirm (V2UI.confirmPlans). Nothing is ever burned without that confirm.
 * Cards = only POSTED pets: other owners' open ads my "Swiping as" pet qualifies for (pet:rug accepts; the egg goes to the poster).
 * Never my own pets. Posting: one or several of my pets, packed into as few <=34-byte pet:ad tags as fit, queued one wallet window each. */
(function () {
  'use strict';
  var V = window.V2Rules, $ = function (id) { return document.getElementById(id); };
  if (!V || !V.openAds) return;
  var TL = ['Common', 'Uncommon', 'Rare', 'Legendary'], TID = ['common', 'uncommon', 'rare', 'legendary'], ST = ['Egg', 'Baby', 'Teen', 'Adult', 'Elder', 'Mythic'];
  /* preset joke bios only (owner-approved list in design/breed-board.md); all about pet stats, never about people. Picked from the ad tx hash. */
  var BIOS = ['Only Legendaries. No broke pets.', 'Looking for Daddy (Legendary)', "If you can't fit in the Crown, you can't fit in my family tree.", 'No Commons, no Wojaks, no unfed degens.',
    "Must be Elder+. I don't date Hatchlings, I'm not a babysitter.", "6 breeds left and I'm not wasting one on a Common.", 'Show me your Power level. Under 60, swipe left.',
    "I'm a 10 and my stats prove it on chain.", 'Fed 9 days straight. You should be too.', 'Not looking for hybrids. Pure-bred or bye.', 'Diamond paws only. Paper paws need not apply.',
    'Ser, this is a Legendary-only motel.', "Wen breed? Now. If you're Rare+."];
  function pick(list, h) { return list[parseInt(V.sha(String(h) + 'XCPETS:rugme:bio').slice(0, 8), 16) % list.length]; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return Number(n).toLocaleString('en-US'); }
  function U() { return window.V2UI; }
  function tip() { var u = U(); return (u && u.S && u.S().tip) || 0; }
  function postCost() { var u = U(); try { return V.costAt(u.world(), V.RUG_AD_COST || 69, tip() + 1); } catch (e) { return 69; } } /* posting: 69 per pet (halving-aware) */
  function cost() { var u = U(); try { var b = tip() + 1; return V.costAt(u.world(), V.rugCost ? V.rugCost(b) : 690, b); } catch (e) { return V.rugCost ? V.rugCost(tip() + 1) : 690; } } /* halving / fire sale: the price at the next block, same costAt the replay checks */
  function NET() { return (window.XCPETS_CONFIG && XCPETS_CONFIG.network) || 'main'; }
  var st = { as: null, i: 0, tab: 'motel', post: {}, per: {}, perMode: false, edit: null, sel: {}, lastSkip: [] };
  function bioOf(ad) { return pick(BIOS, ad.tx + ':' + ad.pet); } /* always random: deterministic from ad tx hash + pet (owner 8:47 PM) */
  var MARK = '💘 On Rug Me'; /* the one place the posted-pet marker is named */
  /* ---------- skips: local only ---------- */
  function skipKey(petId) { return 'xcpets-v2-rugskip-' + NET() + '-' + (U().ME || '') + '-' + petId + '-' + V.day(tip() + 1); }
  function skips(petId) { try { return JSON.parse(localStorage.getItem(skipKey(petId)) || '[]'); } catch (e) { return []; } }
  function setSkips(petId, a) { try { localStorage.setItem(skipKey(petId), JSON.stringify(a)); } catch (e) { } }
  /* ---------- data ---------- */
  function myPets(w, ME) { return w.pets.filter(function (p) { return p.owner === ME && !p.dead && !p.released && !p.community && p.stage >= 3; }); }
  function cardKey(c) { return c.ad ? 'a' + c.ad.id : 'd' + c.pet.id; }
  /** deck(w, me, my): open ads (newest first) that my pet `my` qualifies for. Only posted pets ever appear. */
  function deck(w, ME, my, withSkipped) { var b = tip() + 1, sk = withSkipped ? [] : skips(my.id), out = [];
    V.openAds(w, tip()).forEach(function (ad) { if (ad.owner === ME) return; var P = w.byId[ad.pet];
      if (V.meetsReq(w, my, ad.req) || V.breedable(my, b) || V.breedable(P, b) || (V.breedV2On(b) && V.kinWhy(P, my))) return; out.push({ ad: ad, pet: P, bio: bioOf(ad) }); });
    return out.filter(function (c) { return sk.indexOf(cardKey(c)) < 0; }); }
  /* ---------- card ---------- */
  function sprite(p, w) { var c = document.createElement('canvas'); c.width = c.height = 32; c.className = 'rm-sprite';
    try { var fr = window.V2Render.petFrames(p, w); window.V2Render.paint(c, fr[0]); if (window.V2Render.animate) V2Render.animate(c, fr); } catch (e) { } return c; }
  function statBlock(p) { var MAX = 31, s = p.stats || {}, tot = 0;
    return '<div class="statbox rm-stats">' + ((window.PetCore && PetCore.STAT_KEYS) || ['vigor', 'spark', 'grit', 'zoom', 'luck']).map(function (k) { var v = s[k] || 0; tot += v;
      return '<div class="stat"><span class="sk">' + k.toUpperCase() + '</span><span class="sbar"><i style="width:' + Math.min(100, 100 * v / MAX).toFixed(0) + '%"></i></span><b>' + v + '</b></div>'; }).join('') +
      '<div class="stat tot"><span class="sk">⚡ POWER</span><b>' + tot + '</b></div></div>'; }
  function traits(p) { var a = p.art || {}, o = []; if (a.pattern) o.push(a.pattern); if (a.eyes) o.push(a.eyes + ' eyes'); if (p.hidden && p.shows) o.push(p.shows); return o; }
  function cardHtml(c, w) { var p = c.pet, b = tip() + 1, left = c.ad.block + V.AD_WINDOW - b;
    return '<div class="rm-top"><span class="pill tier tier-' + TID[p.tier] + '">' + TL[p.tier] + '</span>' + '<span class="rm-n">Ad ' + c.ad.id + '</span></div>' +
      '<div class="rm-art"></div><div class="rm-name">' + esc(p.name) + ' <span class="muted">#' + p.id + '</span>' + (window.V2Badges && V2Badges.oldMoneyMark ? ' ' + V2Badges.oldMoneyMark(p) : '') + '</div>' +
      '<div class="rm-sub">' + esc(V.speciesLabel(p.species)) + ' · ' + ST[p.stage] + (traits(p).length ? ' · ' + esc(traits(p).join(' · ')) : '') + '</div>' + statBlock(p) +
      '<div class="rm-bio">“' + esc(c.bio) + '”</div>' +
      '<div class="rm-wants">Wants: <b>' + esc(V.reqText(c.ad.req)) + '</b> · ' + fmt(Math.max(0, left)) + ' blocks left</div>' +
      '<div class="rm-stamp yes">RUG ME</div><div class="rm-stamp no">NGMI</div>'; }
  /* ---------- actions ---------- */
  function rugRight(c) { var u = U(), my = st.as, plan = { tag: 'pet:rug:' + my + ':' + c.ad.id, amount: cost() }, title = 'Rug me: #' + my + ' × #' + c.pet.id + ' (ad ' + c.ad.id + ', the egg goes to the poster)';
    var why = u.sendWhy && u.sendWhy(plan); if (why) return u.toast('⚠️ ' + esc(why));
    u.confirmPlans(title, [plan], function () { u.toast('💘 Sent. It\u2019s a match once it confirms.'); u.render(); }); }
  function skip(c) { var a = skips(st.as); a.push(cardKey(c)); setSkips(st.as, a); st.lastSkip.push(cardKey(c)); paint(); }
  function undo() { var k = st.lastSkip.pop(); if (!k) return; setSkips(st.as, skips(st.as).filter(function (x) { return x !== k; })); paint(); }
  /** openPost(id): owner shortcut (pet pop-up / pet page): the Rug Me tab with the post form open and that pet ticked. */
  function openPost(id) { st.sel = {}; st.sel[id] = 1; st.postOpen = true; if (U() && U().world().byId[id] && U().world().byId[id].stage >= 3) st.as = id; try { var d = $('detail'); if (d && d.classList.contains('on')) $('dClose').click(); } catch (e) { }
    setTab('rug'); setTimeout(function () { var f = document.querySelector('.rm-post'); if (f) f.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 60); }
  window.V2RugPost = openPost;
  /* ---------- panel ---------- */
  function mount() { var panel = $('breedPanel'); if (!panel || $('rmTabs')) return !!panel;
    var tabs = document.createElement('div'); tabs.id = 'rmTabs'; tabs.className = 'rm-tabs'; tabs.setAttribute('role', 'tablist');
    tabs.innerHTML = '<button class="btn" role="tab" data-rmtab="motel">🛎️ Check in</button><button class="btn" role="tab" data-rmtab="rug">💘 Rug Me</button>';
    var h = panel.querySelector('h2,h3'); panel.insertBefore(tabs, h ? h.nextSibling : panel.firstChild);
    var box = document.createElement('div'); box.id = 'rugMe'; box.className = 'rug-me'; box.hidden = true; panel.appendChild(box);
    tabs.querySelectorAll('[data-rmtab]').forEach(function (b) { b.onclick = function () { setTab(b.getAttribute('data-rmtab')); }; }); setTab(st.tab); return true; }
  function setTab(t) { st.tab = t; var panel = $('breedPanel'); if (!panel) return; panel.classList.toggle('rm-on', t === 'rug');
    panel.querySelectorAll('[data-rmtab]').forEach(function (b) { var on = b.getAttribute('data-rmtab') === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
    $('rugMe').hidden = t !== 'rug'; if (t === 'rug') paint(); }
  function paint() { var u = U(), box = $('rugMe'); if (!u || !box || box.hidden) return; var w = u.world(), ME = u.ME, b = tip() + 1;
    if (!V.rugOn(b)) { box.innerHTML = '<p class="small muted">💘 Rug Me opens at block ' + (V.rugGate() != null ? fmt(V.rugGate()) : '(not set yet)') + '.</p>'; return; }
    if (!ME) { box.innerHTML = '<p class="small">Connect XCP Wallet to swipe. You swipe as one of your Adult+ pets.</p>'; return; }
    var mine = myPets(w, ME); if (!mine.length) { box.innerHTML = '<p class="small">You need an Adult or older pet to swipe.</p>'; return; }
    if (!st.as || !mine.some(function (p) { return p.id === st.as; })) st.as = mine[0].id; var my = w.byId[st.as], cards = deck(w, ME, my), c = cards[0];
    var others = mine.filter(function (p) { return p.id !== my.id; }), alsoQ = c && c.ad ? others.filter(function (p) { return !V.meetsReq(w, p, c.ad.req) && !V.breedable(p, b); }) : [];
    var myAds = (w.ads || []).filter(function (a) { return a.owner === ME && V.adState(w, a, tip() + 1) === 'open'; });
    box.innerHTML = '<div class="rm-as"><label class="small">Swiping as <select id="rmAs">' + mine.map(function (p) { return '<option value="' + p.id + '"' + (p.id === my.id ? ' selected' : '') + '>#' + p.id + ' ' + esc(p.name) + ' (' + TL[p.tier] + ' ' + esc(V.speciesLabel(p.species)) + ' ' + ST[p.stage] + ')' + (V.onRug(w, p, b) ? ' · on Rug Me' : '') + '</option>'; }).join('') + '</select></label>' +
      '<button class="btn ghost rm-posttog" id="rmPostGo">📌 Post on Rug Me</button></div>' +
      (V.breedable(my, b) ? '<p class="small warn">#' + my.id + ' can\u2019t breed right now (' + esc(V.breedable(my, b)) + '). Pick another pet.</p>' : '') +
      '<div class="rm-stack" id="rmStack">' + (c ? (cards[1] ? '<div class="rm-card rm-under"></div>' : '') + '<div class="rm-card" id="rmCard" tabindex="0">' + cardHtml(c, w) + '</div>' : '<div class="rm-empty">💤 No more cards for #' + my.id + ' today.<br><span class="small muted">0 pets qualify. Standards: delusional. Skips reset each chain day.</span></div>') + '</div>' +
      (alsoQ.length ? '<p class="small rm-hint">💡 Also qualifies: ' + alsoQ.slice(0, 3).map(function (p) { return '<a href="#" data-rmas="' + p.id + '">#' + p.id + ' ' + esc(p.name) + '</a>'; }).join(', ') + '</p>' : '') +
      '<div class="rm-btns"><button class="btn rm-no" id="rmNo"' + (c ? '' : ' disabled') + ' aria-label="Skip (swipe left)">✖ NGMI</button><button class="btn ghost" id="rmUndo"' + (st.lastSkip.length ? '' : ' disabled') + '>↶ Undo</button>' +
      '<button class="btn rm-yes" id="rmYes"' + (c ? '' : ' disabled') + '>💘 Rug me · ' + fmt(cost()) + '</button></div>' +
      '<p class="small muted rm-note">' + cards.length + ' card' + (cards.length === 1 ? '' : 's') + ' · ← / → keys on desktop · skips are only on this device, nobody sees them.</p>' +
      '<details class="rm-mine"' + (st.postOpen ? ' open' : '') + '><summary>📌 My ads (' + myAds.length + ')</summary>' + myAds.map(function (a) { var P = w.byId[a.pet];
        return '<div class="rm-adrow">Ad ' + a.id + ': #' + a.pet + ' ' + esc(P ? P.name : '') + ' · wants ' + esc(V.reqText(a.req)) + ' · ' + fmt(a.block + V.AD_WINDOW - b) + ' blocks left <button class="btn ghost" data-unad="' + a.id + '">Cancel</button></div>'; }).join('') + postForm(w, mine) + '</details>';
    var art = box.querySelector('#rmCard .rm-art'); if (art) art.appendChild(sprite(c.pet, w));
    $('rmAs').onchange = function () { st.as = +this.value; st.lastSkip = []; paint(); };
    $('rmPostGo').onclick = function () { openPost(my.id); };
    box.querySelectorAll('[data-rmas]').forEach(function (a) { a.onclick = function (e) { e.preventDefault(); st.as = +a.getAttribute('data-rmas'); paint(); }; });
    $('rmNo').onclick = function () { if (c) fling(-1, c); }; $('rmYes').onclick = function () { if (c) rugRight(c); }; $('rmUndo').onclick = undo;
    box.querySelectorAll('[data-unad]').forEach(function (x) { x.onclick = function () { var plan = { tag: 'pet:unad:' + x.getAttribute('data-unad'), amount: 0.00000001 }, why = u.sendWhy(plan); if (why) return u.toast('⚠️ ' + esc(why)); u.confirmPlans('Cancel Rug Me ad ' + x.getAttribute('data-unad') + ' · a 1-dander burn' + ' (no refund)', [plan], function () { u.render(); }); }; });
    bindPost(w, mine); if (c) drag($('rmCard'), c); }
  /* ---------- post ads (one or several pets; same standards for all, or per pet; bio always random) ---------- */
  function setFor(id) { return st.perMode && st.per[id] ? st.per[id] : { q: st.post }; }
  /** packPlans(w, ids): group pets by standards, pack each group into as few pet:ad tags as fit MAX 34 bytes. One plan per tag, 69 per pet (halving via planAmount). */
  function packPlans(w, ids) { var groups = {}, order = [], plans = [];
    ids.forEach(function (id) { var s = setFor(id), k = V.reqTag(s.q); if (!groups[k]) { groups[k] = { req: k, ids: [] }; order.push(k); } groups[k].ids.push(id); });
    order.forEach(function (k) { var g = groups[k], cur = [];
      g.ids.forEach(function (id) { var t = cur.concat([id]); if (cur.length && V.reqWhy(g.req, t)) { plans.push(cur); cur = [id]; } else cur = t; }); if (cur.length) plans.push(cur);
      plans = plans.map(function (x) { return x.req ? x : { req: g.req, ids: x }; }); });
    return plans.map(function (x) { return { tag: V.adTag(x.ids, x.req), amount: postCost() * x.ids.length, ids: x.ids, why: V.reqWhy(x.req, x.ids) }; }); }
  function postForm(w, mine) { var b = tip() + 1, ok = mine.filter(function (p) { return !V.adWhy(p, b) && !V.onRug(w, p, b); });
    Object.keys(st.sel).forEach(function (id) { if (!ok.some(function (p) { return p.id === +id; })) delete st.sel[id]; });
    var sel = ok.filter(function (p) { return st.sel[p.id]; }).map(function (p) { return p.id; });
    if (st.perMode && (!st.edit || sel.indexOf(st.edit) < 0)) st.edit = sel[0] || null;
    var ed = st.perMode && st.edit ? (st.per[st.edit] = st.per[st.edit] || { q: Object.assign({}, st.post) }) : { q: st.post }, q = ed.q, E = st.edit ? w.byId[st.edit] : (sel[0] ? w.byId[sel[0]] : mine[0]);
    var owned = Object.keys(w.items || {}).map(function (k) { return w.items[k]; }).filter(function (g) { return E && g.owner === E.owner && (g.on === E.id || g.bag === E.id); });
    var chip = function (k, v, label) { return '<button class="chip rm-chip' + (q[k] === v ? ' on' : '') + '" data-rk="' + k + '" data-rv="' + v + '">' + esc(label) + '</button>'; };
    var plans = sel.length ? packPlans(w, sel) : [], total = plans.reduce(function (a, p) { return a + p.amount; }, 0), bad = plans.filter(function (p) { return p.why; })[0];
    return '<div class="rm-post"><div class="small"><b>📌 Post on Rug Me</b> · pick pets (' + sel.length + ' of ' + ok.length + ' can post):</div>' +
      '<div class="chips rm-pets">' + ok.map(function (p) { return '<label class="chip rm-chip rm-pk' + (st.sel[p.id] ? ' on' : '') + '"><input type="checkbox" data-rsel="' + p.id + '"' + (st.sel[p.id] ? ' checked' : '') + '> #' + p.id + ' ' + esc(p.name) + '</label>'; }).join('') +
        (ok.length > 1 ? '<button class="chip rm-chip" data-rall="1">' + (sel.length === ok.length ? 'None' : 'All') + '</button>' : '') + '</div>' +
      (mine.length > ok.length ? '<div class="small muted">' + (mine.length - ok.length) + ' pet(s) hidden: already on Rug Me or can\u2019t breed.</div>' : '') +
      (sel.length > 1 ? '<div class="small rm-mode"><label><input type="radio" name="rmMode" data-rmode="same"' + (st.perMode ? '' : ' checked') + '> Same standards for all</label> <label><input type="radio" name="rmMode" data-rmode="per"' + (st.perMode ? ' checked' : '') + '> Per pet</label>' +
        (st.perMode ? ' · editing <select id="rmEdit">' + sel.map(function (id) { return '<option value="' + id + '"' + (id === st.edit ? ' selected' : '') + '>#' + id + ' ' + esc(w.byId[id].name) + '</option>'; }).join('') + '</select>' : '') + '</div>' : '') +
      '<div class="small">Standards (max 4):</div>' +
      '<div class="chips">' + chip('tier', 1, 'Uncommon+') + chip('tier', 2, 'Rare+') + chip('tier', 3, 'Legendary') + '</div>' +
      '<div class="chips">' + chip('stage', 3, 'Adult+') + chip('stage', 4, 'Elder+') + chip('stage', 5, 'Mythic') + '</div>' +
      '<div class="chips">' + chip('species', E && E.species && E.species.indexOf('hyb') !== 0 ? E.species : 'pepe', 'Same species' + (E ? ' (' + V.speciesLabel(E.species) + ')' : '')) + chip('species', 'hyb', 'Hybrid') + '</div>' +
      '<div class="chips">' + chip('power', 50, 'Power 50+') + chip('power', 60, 'Power 60+') + chip('power', 80, 'Power 80+') + '</div>' +
      '<div class="chips">' + ['jeweled-crown', 'goldcape'].concat(owned.slice(0, 3).map(function (g) { return V.resolveItem(g.item); })).filter(function (x, i, a) { return a.indexOf(x) === i && V.itemOf(x); }).slice(0, 4).map(function (id) { return chip('gear', id, 'Owns ' + V.itemOf(id).label); }).join('') + '</div>' +
      '<div class="small muted">Wants: ' + esc(V.reqText(q)) + ' · ' + fmt(postCost()) + ' per pet · open 1,008 blocks (~7 days) · one ad per pet · a pet resting after a breed can still post (the ad waits) · bio: a random preset · the egg comes to you</div>' +
      (sel.length ? '<div class="small rm-sum"><b>' + sel.length + ' pet' + (sel.length > 1 ? 's' : '') + ' · ' + plans.length + ' burn' + (plans.length > 1 ? 's' : '') + ' · total ' + fmt(total) + ' XCPETS</b>' + (plans.length > 1 ? ' (one XCP Wallet window per burn, with progress; you can stop and resume)' : '') + '<br><span class="muted">' + plans.map(function (p) { return '<code>' + esc(p.tag) + '</code>'; }).join(' · ') + '</span></div>' : '') +
      (bad ? '<div class="small warn">' + esc(bad.why) + '. Drop a standard.</div>' : '') +
      '<button class="btn" id="rmPost"' + (!sel.length || bad ? ' disabled' : '') + '>📌 Post on Rug Me · ' + fmt(total || postCost()) + '</button></div>'; }
  function bindPost(w, mine) { var box = $('rugMe');
    box.querySelectorAll('[data-rk]').forEach(function (x) { x.onclick = function () { var k = x.getAttribute('data-rk'), v = x.getAttribute('data-rv'), q = st.perMode && st.edit && st.per[st.edit] ? st.per[st.edit].q : st.post; v = /^\d+$/.test(v) ? +v : v; if (q[k] === v) delete q[k]; else q[k] = v; st.postOpen = true; paint(); }; });
    box.querySelectorAll('[data-rsel]').forEach(function (x) { x.onchange = function () { var id = +x.getAttribute('data-rsel'); if (x.checked) st.sel[id] = 1; else delete st.sel[id]; paint(); }; });
    var all = box.querySelector('[data-rall]'); if (all) all.onclick = function () { var b = tip() + 1, ok = mine.filter(function (p) { return !V.adWhy(p, b) && !V.onRug(w, p, b); }), on = ok.every(function (p) { return st.sel[p.id]; }); st.sel = {}; if (!on) ok.forEach(function (p) { st.sel[p.id] = 1; }); paint(); };
    box.querySelectorAll('[data-rmode]').forEach(function (x) { x.onchange = function () { st.perMode = x.getAttribute('data-rmode') === 'per'; paint(); }; });
    if ($('rmEdit')) $('rmEdit').onchange = function () { st.edit = +this.value; paint(); };
    var bp = $('rmPost'); if (bp) bp.onclick = function () { var u = U(), ids = Object.keys(st.sel).map(Number), plans = packPlans(w, ids).map(function (p) { return { tag: p.tag, amount: p.amount }; });
      for (var i = 0; i < plans.length; i++) { var why = u.sendWhy(plans[i]); if (why) return u.toast('⚠️ ' + esc(why)); }
      u.confirmPlans('Post on Rug Me: ' + ids.map(function (id) { return '#' + id; }).join(', ') + ' (' + plans.length + ' burn' + (plans.length > 1 ? 's' : '') + ')', plans, function () { st.sel = {}; st.per = {}; u.toast('📌 Posted. Your pets show in other players\u2019 stacks once it confirms.'); u.render(); }); };
    box.querySelector('.rm-mine').ontoggle = function () { st.postOpen = this.open; }; }
  /* ---------- swipe ---------- */
  function fling(dir, c) { var el = $('rmCard'); if (!el) return; if (dir > 0) { spring(el); return rugRight(c); } el.style.transition = 'transform .25s ease-out, opacity .25s'; el.style.transform = 'translateX(-130%) rotate(-18deg)'; el.style.opacity = '0'; setTimeout(function () { skip(c); }, 230); }
  function spring(el) { el.style.transition = 'transform .2s'; el.style.transform = ''; el.classList.remove('go-yes', 'go-no'); }
  function drag(el, c) { var x0 = null, dx = 0;
    el.addEventListener('pointerdown', function (e) { x0 = e.clientX; dx = 0; el.setPointerCapture(e.pointerId); el.style.transition = 'none'; });
    el.addEventListener('pointermove', function (e) { if (x0 == null) return; dx = e.clientX - x0; el.style.transform = 'translateX(' + dx + 'px) rotate(' + (dx / 18) + 'deg)'; el.classList.toggle('go-yes', dx > 40); el.classList.toggle('go-no', dx < -40); });
    function up() { if (x0 == null) return; x0 = null; var lim = Math.min(110, el.offsetWidth * 0.3); if (dx > lim) fling(1, c); else if (dx < -lim) fling(-1, c); else spring(el); }
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); }
  document.addEventListener('keydown', function (e) { if (st.tab !== 'rug' || !$('rmCard') || /INPUT|SELECT|TEXTAREA/.test((e.target || {}).tagName || '')) return; var u = U(), w = u.world(), c = deck(w, u.ME, w.byId[st.as])[0]; if (!c) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); fling(-1, c); } else if (e.key === 'ArrowRight') { e.preventDefault(); fling(1, c); } });
  /* ---------- pet pop-up (#detail): 'On Rug Me' marker; owner-only 'Post on Rug Me' ---------- */
  function decorateDetail() { var u = U(), info = $('dInfo'), t = $('dTitle'); if (!u || !info || !t || info.querySelector('.rm-drow')) return; var m = /#(\d+)/.exec(t.textContent || ''); if (!m) return;
    var w = u.world(), p = w.byId[+m[1]], b = tip() + 1; if (!p || !V.rugOn(b)) return; var on = V.onRug(w, p, b), mineP = p.owner === u.ME && !(u.viewOnly && u.viewOnly()) && !p.dead && !p.released && p.stage >= 3 && !V.adWhy(p, b);
    if (!on && !mineP) return; var d = document.createElement('div'); d.className = 'row rm-drow';
    d.innerHTML = on ? '<span class="rm-mark">' + MARK + '</span>' : '<button class="btn ghost" data-rmpost="' + p.id + '">📌 Post on Rug Me</button>';
    info.insertBefore(d, info.firstChild); var bt = d.querySelector('[data-rmpost]'); if (bt) bt.onclick = function () { openPost(p.id); }; }
  function hashPost() { var m = /^#rugpost-(\d+)$/.exec(location.hash || ''); if (!m || !U() || !U().ME) return; history.replaceState(null, '', location.pathname + location.search); setTimeout(function () { openPost(+m[1]); }, 400); }
  /* ---------- hook into the normal render ---------- */
  function boot() { if (!U() || !$('breedPanel')) return setTimeout(boot, 300); mount();
    if (window.V2Motel && V2Motel.render) { var mr = V2Motel.render; V2Motel.render = function () { var r = mr.apply(this, arguments); try { mount(); paint(); } catch (e) { if (window.console) console.error(e); } return r; }; }
    var di = $('dInfo'); if (di && window.MutationObserver) new MutationObserver(function () { try { decorateDetail(); } catch (e) { } }).observe(di, { childList: true });
    paint(); hashPost(); }
  window.V2RugMe = { paint: paint, setTab: setTab, deck: deck, BIOS: BIOS, MARK: MARK, openPost: openPost, packPlans: packPlans, _st: st };
  boot();
})();
