/* XCPETS v2: the front page / ranking / cemetery / pet page, wired to the live chain via js/v2-chain.js (V2Mock interface).
 * Data comes from real XCPETS burns read from the Counterparty API. Nothing is signed here. */
(function () {
  'use strict';
  var V = window.V2Rules, M = window.V2Mock, R = window.V2Render, ME = M.ME, $ = function (id) { return document.getElementById(id); }, esc = R.esc;
  var fmt = function (n) { n = Number(n); return n.toLocaleString('en-US', { maximumFractionDigits: Math.abs(n) >= 1 || n === 0 ? 2 : 8 }); }; /* >= 1: 2 decimals (hides float noise like 1,335,328.99999996) */
  var TL = V.TIER_LABELS, TID = ['common', 'uncommon', 'rare', 'legendary'];
  function spLabel(id) { return V.speciesLabel(id); }
  function streak(p, tip) { var d = V.day(tip), n = 0; if (!p.feedDays[d]) d--; while (p.feedDays[d]) { n++; d--; } return n; }
  function small(fr, c) { R.animate(c, fr); }
  function tagText(t) { t = t == null ? '' : String(t); if (/^([0-9a-f]{2})+$/i.test(t)) { try { return decodeURIComponent(t.replace(/(..)/g, '%$1')); } catch (e) { } } return t; }
  function burnAmt(r) { return r.amount != null ? Number(r.amount) || 0 : (Number(r.quantity) || 0) / 1e8; }
  /* intuitive-pass item 12 (display only): plain-language burn-history rows; the raw tag stays one tap away */
  function plainRes(res, tag) { var t = String(tag || ''), m = String(res || ''), body = m.replace(/^[a-zA-Z]+: /, ''), k = (/^pet:([a-z0-9]+)/i.exec(t) || [])[1] || '';
    var L = { feed: 'Fed', fm: 'Fed (bundle)', hatch: 'Hatched', hatch12: 'Hatched (dozen)', hatch144: 'Hatched (case)', roll: 'Gear roll', fight: 'Fight challenge', accept: 'Fight accepted', breed: 'Breed', rumble: 'Royal Rumble (retired)', rel: 'Released', fr: 'Free roll', of: 'Overflow roll', grave: 'Grave gear' }[k.toLowerCase()];
    if (/^before v2: /.test(m)) return (L ? L : 'Burn') + ' (before v2)'; if (/^born: /.test(m)) return 'Born: ' + m.slice(6); if (/^hatch: /.test(m)) return 'Hatched · ' + body;
    return L ? L + ' · ' + body : m; }
  var page = document.body.getAttribute('data-v2page');

  /** Cast gating: Nakamoto joins the live Cast (12 species) only once V2Rules.castShowsNakamoto(world) (stage >= NAKAMOTO_CAST_STAGE). */
  function cast(w) {
    var show = V.castShowsNakamoto(w), G = window.GenPetCore || PetCore, box = $('castRows'); if (!box) return show;
    // rarity no longer caps gear in v2: drop the legacy "(1/2/4/5 gear)" from the tier tabs (only if present: the cast cards carry markup)
    Array.prototype.forEach.call($('castTiers').children, function (b) { if (/, \d gear\)/.test(b.textContent)) b.textContent = b.textContent.replace(/, \d gear\)/, ')'); });
    function add() { if (!show || window.PromoLiveCast || box.querySelector('[data-sp="nakamoto"]')) return; /* live-rules cast (promo.js) has its own Nakamoto row on the Legendary tab */ var sp = G.SPECIES.filter(function (x) { return x.id === 'nakamoto'; })[0]; if (!sp) return;
      var on = $('castTiers').querySelector('.on'), tier = on ? on.getAttribute('data-tier') : 'legendary', pet = G.characterPet('nakamoto', { tier: tier });
      var row = document.createElement('div'); row.className = 'cast-row'; row.setAttribute('data-sp', 'nakamoto');
      row.innerHTML = '<div><h3 class="ch">Nakamoto</h3><p class="muted">Always Legendary · no longer hatched, existing ones kept</p><p class="muted">' + sp.arc.map(function (x) { return esc(x[0]); }).join(' → ') + '</p></div>';
      var strip = document.createElement('div'); strip.className = 'strip6';
      G.STAGES.forEach(function (name, si) { var d = document.createElement('div'), c = document.createElement('canvas'); c.width = c.height = 32; c.setAttribute('role', 'img'); c.setAttribute('aria-label', 'Nakamoto, ' + name);
        R.paint(c, G.render(pet, { stage: si })); d.appendChild(c); d.appendChild(document.createTextNode(name)); strip.appendChild(d); });
      row.appendChild(strip); box.appendChild(row); }
    add(); new MutationObserver(add).observe(box, { childList: true });
    if (show) { var t = function (sel, a, b) { var e = document.querySelector(sel); if (e) e.innerHTML = e.innerHTML.replace(a, b); };
      t('#cast p.muted', 'one of twelve', 'one of thirteen'); t('.hero-copy .lede', 'Twelve pixel meme characters', 'Thirteen pixel meme characters'); t('.hero-copy .lede', 'Doge and Lenny.', 'Doge, Lenny and Nakamoto.'); }
    /* Hybrids (homepage-cast, 2026-10-19): ONE fixed-size card in the cast row with the count and a sample sprite, linking to hybrids.html.
     * Before this, every hybrid pair found on chain (V.castHybrids) was appended inline as its own cast row under a growing tab, so each
     * new hybrid stretched the home page and its multi-body rows fell out of the cast-row grid. The full list now lives on hybrids.html. */
    var hyb = V.castHybrids(w), hc = $('castHybCount'), ico = $('castHybIco'), card = $('castHybCard');
    if (hc) hc.textContent = hyb.length ? fmt(hyb.length) + ' so far →' : 'none yet →';
    if (card) card.setAttribute('aria-label', 'Hybrids: ' + (hyb.length ? hyb.length + ' so far' : 'none yet') + ', browse them all');
    if (ico) { if (hyb.length) { var s0 = hyb[0].builds ? hyb[0].builds[0] : hyb[0].plan, art0 = (window.GenPetCore || PetCore).characterPet(s0.shape, { tier: 'legendary' }); art0.hybrid = s0;
      R.paint(ico, V.hybridRender(art0, { stage: 5, frame: 0 })); ico.title = hyb[0].name; } else ico.style.display = 'none'; }
    document.body.setAttribute('data-cast-hybrids', hyb.length ? 'yes' : 'no');
    document.body.setAttribute('data-cast-nakamoto', show ? 'yes' : 'no');
    return show;
  }
  // Hero grid (Jake 2026-10-14): v2 sprites in the same varied kits as the cast GIF (V2Gear.CAST_KITS; one crown in total), not the
  // live all-crowns legendary kit. The live promo.js grid is replaced by a fresh node so its timer paints nothing visible.
  // Elder or Mythic only: Wojak shows at Elder, where pet-core gives him the classic open sad eyes (his Mythic arc closes them into a ^^ smile)
  var HERO_STAGE = { wojak: 4 };
  function heroGrid() { var old = $('heroPets'); if (!old || !V2Gear.CAST_KITS) return; var box = old.cloneNode(false); old.parentNode.replaceChild(box, old);
    var G = window.GenPetCore || PetCore, live = window.PetCore, ids = live.SPECIES.map(function (s) { return s.id; }), cache = {}, k = 0, NONE = { band: 'none', crown: 'none', armor: 'none', cape: 'none', weapon: 'none' };
    function frames(id) { if (cache[id]) return cache[id]; var kit = (V2Gear.CAST_KITS[id] || []).filter(function (g) { var it = V.GEAR_BY_ID[g]; return it && V.eligible(it, id); });
      window.PetCore = G; try { cache[id] = R.framesWith(Object.assign(G.characterPet(id, { tier: 'legendary' }), NONE), HERO_STAGE[id] || 5, kit, [], 5); } finally { window.PetCore = live; } return cache[id]; }
    var slots = []; for (var i = 0; i < 9; i++) { var c = document.createElement('canvas'); c.width = c.height = 32; box.appendChild(c); slots.push(c); }
    function fill() { slots.forEach(function (c, i) { var id = ids[(k + i) % ids.length]; c.setAttribute('role', 'img'); c.setAttribute('aria-label', V.speciesLabel(id) + ' at ' + (HERO_STAGE[id] === 4 ? 'Elder' : 'Mythic')); c.setAttribute('data-sp', id); R.animate(c, frames(id)); }); k = (k + 9) % ids.length; }
    fill(); setInterval(fill, 4200); }
  function withReturn(cb) { if (window.V2Return) return cb(); var t = document.createElement('script'); t.src = 'js/v2-return.js?v=2aa060cca9'; t.onload = cb; document.body.appendChild(t); }
  /* Community Pets Archive (archive.html, Jake 2026-10-14): one box per COMPLETED community pet, from chain state. Registry: each community pet
   * brings its own Mythic sprite + Return animation; future pets (e.g. the next one) append an entry. Spoiler-free: empty until a cycle completes
   * (?preview=return shows Nakamoto's entry from current data). */
  /* Cold Storage rule (owner 2026-10-20, display only, general): every community pet in Cold Storage (Nakamoto, the Bitcoin Wizard, Lord Kek and any
   * future entry) is drawn at its MYTHIC stage art (COLD_STAGE). Nakamoto is bare; the others keep their best-gear loadout. New ARCHIVE entries must use COLD_STAGE. */
  var COLD_STAGE = 5;
  function nakaFrames() { var NG = window.GenPetCore || PetCore; if (V2Gear.reworkNakamoto) V2Gear.reworkNakamoto(NG);
    var nk = Object.assign(NG.characterPet('nakamoto', { tier: 'legendary' }), { band: 'none', crown: 'none', armor: 'none', cape: 'none', weapon: 'none', background: 'solid', bgColor: '#2a3a2e', pattern: 'none' });
    return [0, 1, 2, 3].map(function (f) { return NG.render(nk, { stage: COLD_STAGE, frame: f, gearOverride: {} }); }); }
  var ARCHIVE = [
    { id: 'nakamoto', name: 'Nakamoto', done: function (c) { return c.returned; }, block: function (c) { return c.returnBlock; }, tx: function (c) { return c.returnTx; },
      sprites: nakaFrames, play: function (info) { V2Return.play({ sprites: { nakamoto: nakaFrames(), egg: WizardSprite.frames(0, '#2a3a2e', { head: WizardSprite.WIZARD_HAT }, { community: true }) }, info: info }); } },
    /* #2 Bitcoin Wizard (Oct 19 2026): Mythic at 6,906,900 burned since The Return -> Cold Storage. Chain state = w.wizardMythic (V2Rules.replay, from history). */
    { id: 'wizard', name: 'Bitcoin Wizard', sp: 'wizard', loadout: ['wizard-hat', 'sig-wizard-staff', 'sig-wizard-sign'], /* signature loadout: pointy hat, Bitcoin staff, Join us sign */ done: function (c, w) { return !!(w && w.wizardMythic); }, block: function (c, w) { return w.wizardMythic.block; }, tx: function (c, w) { return w.wizardMythic.tx; },
      stats: function (w) { var x = w.wizardMythic || {}; return { total: x.total || 0, feeders: x.feeders || 0, top: x.top || [] }; }, watch: 'Watch the farewell', farewell: true,
      story: ['2013. A forum asked for an ad.', 'Someone drew a wizard in MS Paint.', 'Blue robe. Stars. A staff.', '"Magic Internet Money." "Join us."', 'It ran on Reddit. Bitcoin passed $1,000.', 'The wizard stayed.',
        '2026. Nakamoto went into Cold Storage. An egg was left behind.', 'Every burn fed it. Nobody owned it. 100× slower than any pet.', '6,906,900 burned. Mythic.', 'Then he put down the sign and walked into Cold Storage, next to Nakamoto.', 'The sign stayed behind. So did an egg. Now anyone can hatch one. Join us.'],
      sprites: function () { return coldEntryFrames(this); }, play: function (info) { withFarewell(function () { V2Farewell.play({ sprites: farewellSprites(M.world()), info: info }); }); } }
  ];
  /* Cold Storage portrait (owner 2026-10-20): every community pet shows at Mythic (COLD_STAGE) in its full signature loadout, read from the entry's
   * sp + loadout (data only, no pet ids). Nakamoto is the exception (bare, nakaFrames). A future entry (e.g. Lord Kek: sp 'kek', loadout [...]) just
   * sets sp/loadout and sprites: function () { return coldEntryFrames(this); }. */
  function coldEntryFrames(e) { return (R && R.coldFrames && R.coldFrames(e.sp, e.loadout || [], COLD_STAGE)) || wizMythicFrames(M.world()); }
  function wizMythicFrames(w) { var g = R && R.wizardGear ? R.wizardGear(w) : { head: WizardSprite.WIZARD_HAT }; return WizardSprite.frames(COLD_STAGE, '#2a3a2e', g, { community: true }); }
  function farewellSprites(w) { var x = w.wizardMythic; return { wizard: wizMythicFrames(w), egg: WizardSprite.frames(0, '#2a3a2e', { head: WizardSprite.WIZARD_HAT }, {}), nakamoto: nakaFrames(), total: x ? x.total : V.WIZARD_THRESHOLDS[5] }; }
  function withFarewell(cb) { if (window.V2Farewell) return cb(); var t = document.createElement('script'); t.src = 'js/v2-wizard-farewell.js?v=2aa060cca9'; t.onload = cb; document.body.appendChild(t); }
  function archiveEntries(w, preview) { var c = w.community, rows = M.state().rows;
    return ARCHIVE.map(function (e) { var done = e.done(c, w); if (e.stats && !done && preview !== e.id && preview !== true) return null; if (!done && !preview) return null;
      var blk = done ? e.block(c, w) : null, tot = {}, sum = 0;
      if (e.stats) { var st = e.stats(w); return { e: e, done: done, block: blk, tx: done ? e.tx(c, w) : null, total: done ? st.total : (c.wizardFed || 0), feeders: done ? st.feeders : 0, top: st.top, row: done ? rows.filter(function (r) { return r.tx_hash === e.tx(c, w); })[0] : null }; }
      rows.forEach(function (r) { if (blk != null && r.block_index > blk) return; var a = burnAmt(r); sum += a; tot[r.source] = (tot[r.source] || 0) + a; });
      var all = Object.keys(tot).map(function (k) { return { address: k, amount: tot[k] }; }).sort(function (x, y) { return y.amount - x.amount; });
      return { e: e, done: done, block: blk, tx: done ? e.tx(c, w) : null, total: sum, feeders: all.length, top: all.slice(0, 5), row: done ? rows.filter(function (r) { return r.tx_hash === e.tx(c, w); })[0] : null }; }).filter(Boolean); }
  /* Archive layout = Jake's Option C (gallery with featured player); styles in css/archive.css (.archive-*). Spoiler rules: nothing before The Return on chain
   * (neutral empty state); after it, Nakamoto (completed: Return blurb + replay) and the next community pet (in progress: one general line; never its sprite).
   * No placeholder for a next pet. */
  function shortAddr(s) { s = String(s || ''); return s.length > 14 ? s.slice(0, 6) + '…' + s.slice(-4) : s; }
  function archive() {
    var w = M.world(), c = w.community, preview = /preview=return/.test(location.search) ? 'nakamoto' : /preview=wizard/.test(location.search) ? 'wizard' : false, list = archiveEntries(w, preview), box = $('archList');
    if (!list.length) { box.innerHTML = '<p class="muted archive-empty">No community pets in the archive yet.</p>'; return; }
    var items = list.map(function (x) { return { kind: 'done', x: x, id: x.e.id, name: x.e.name, done: x.done }; });
    if (c.returned && !w.wizardMythic) items.push({ kind: 'live', id: 'wizard', name: 'Bitcoin Wizard · community pet', done: false });
    var filt = 'all', sel = items[0].id;
    function sprites(it) { return it.kind === 'live' ? (c.wizardStage > 0 ? (R && R.communityFrames ? R.communityFrames(w) : WizardSprite.frames(c.wizardStage, '#2a3a2e', { head: WizardSprite.WIZARD_HAT }, { community: true })) : null) : it.x.e.sprites(); }
    function feat(it) {
      if (it.kind === 'live') return '<div class="archive-player"><span class="archive-cap">COMMUNITY PET · IN PROGRESS</span>' + (c.wizardStage > 0 ? '<canvas class="archive-fsprite" width="32" height="32" id="archFeatCv"></canvas>' : '') +
        '</div><div class="archive-fdesc"><span class="archive-tag live">IN PROGRESS</span> <span class="archive-tag myth">' + esc(V.STAGE_NAMES[c.wizardStage].toUpperCase()) + '</span>' +
        '<h2 class="archive-name">Community pet</h2><p>The community pet grows with every XCPETS burn, from anyone.</p><div class="archive-stats"><div class="archive-stat"><b>' + fmt(Math.floor(c.wizardFed)) + '</b><span>XCPETS burned so far</span></div><div class="archive-stat"><b>' + esc(V.STAGE_NAMES[c.wizardStage]) + '</b><span>Stage</span></div></div>' + (R && R.communityWearing ? '<p class="small muted">' + esc(R.communityWearing(w)) + '</p>' : '') + '</div>';
      var x = it.x, dt = x.row && x.row.block_time ? new Date(x.row.block_time * 1000).toISOString().slice(0, 10) : '';
      return '<div class="archive-player"><span class="archive-cap">▶ REPLAY · ' + esc(x.e.name.toUpperCase()) + '</span><canvas class="archive-fsprite" width="32" height="32" id="archFeatCv"></canvas>' +
        '<div class="archive-play"><button class="btn archive-watch archplay" type="button">▶ ' + esc(x.e.watch || 'Watch the replay') + '</button></div></div><div class="archive-fdesc"><span class="archive-tag done">' + (x.done ? 'COMPLETED' : 'PREVIEW') + '</span> <span class="archive-tag myth">MYTHIC</span>' +
        '<h2 class="archive-name">' + esc(x.e.name) + '</h2>' + (x.e.story ? '<div class="archive-story small">' + x.e.story.map(function (l) { return '<p>' + esc(l) + '</p>'; }).join('') + '</div>' : '<p>The community cycle came full circle.</p>') + '<div class="archive-stats">' +
        '<div class="archive-stat"><b>' + (x.done ? '#' + fmt(x.block) : '—') + '</b><span>Completed at block</span></div><div class="archive-stat"><b class="archdate">' + (dt || '—') + '</b><span>Date (UTC)</span></div>' +
        '<div class="archive-stat"><b>' + fmt(Math.floor(x.total)) + '</b><span>XCPETS burned total</span></div><div class="archive-stat"><b>' + fmt(x.feeders) + '</b><span>Feeders</span></div></div>' +
        (x.tx ? '<p class="small archive-tx">Triggering tx <code>' + esc(x.tx) + '</code></p>' : '') + '<h3 class="archive-h3">Top feeders</h3><ol class="archive-feed">' + x.top.map(function (t) { return '<li title="' + esc(t.address) + '">' + esc(shortAddr(t.address)) + ' · <span>' + fmt(Math.floor(t.amount)) + '</span></li>'; }).join('') + '</ol></div>'; }
    function card(it, i) { return '<button type="button" class="archive-card' + (it.id === sel ? ' sel' : '') + '" data-id="' + it.id + '">' + (sprites(it) ? '<canvas class="archive-csprite" width="32" height="32" id="archCv' + i + '"></canvas>' : '<div class="archive-csprite archive-nosprite"></div>') +
      '<h3>#' + (i + 1) + ' ' + esc(it.name) + '</h3><p>' + (it.kind === 'live' ? '<span class="archive-tag live">LIVE</span> The community pet grows with every XCPETS burn, from anyone.</p><p>' + fmt(Math.floor(c.wizardFed)) + ' burned' :
        '<span class="archive-tag done">' + (it.done ? 'DONE' : 'PREVIEW') + '</span> ' + fmt(Math.floor(it.x.total)) + ' burned') + '</p></button>'; }
    function draw() {
      var vis = items.filter(function (it) { return filt === 'all' || (filt === 'done' ? it.kind === 'done' : it.kind === 'live'); });
      if (!vis.some(function (it) { return it.id === sel; }) && vis.length) sel = vis[0].id;
      var cur = items.filter(function (it) { return it.id === sel; })[0], nd = items.filter(function (it) { return it.kind === 'done'; }).length;
      box.innerHTML = '<p class="archive-intro">Every community pet is raised by everyone together: each XCPETS burn, from any player, feeds it. When a cycle ends, its story is kept here. Watch how each one finished.</p>' +
        '<div class="archive-tabs">' + [['all', 'All (' + items.length + ')'], ['done', '✔ Completed (' + nd + ')'], ['live', '⏳ In progress (' + (items.length - nd) + ')']].map(function (t) { return '<button type="button" class="archive-chip' + (t[0] === filt ? ' on' : '') + '" data-f="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' +
        (cur ? '<section class="panel archive-feat archive-pet" id="arch-' + cur.id + '">' + feat(cur) + '</section>' : '') + '<h2 class="archive-h2">All community pets</h2><div class="archive-grid">' + vis.map(function (it) { return card(it, items.indexOf(it)); }).join('') + '</div>' +
        '<p><a class="archive-back" href="index.html">← Back to the community pet</a></p>';
      items.forEach(function (it, i) { var cv = $('archCv' + i), fr = cv && sprites(it); if (fr) R.animate(cv, fr); });
      if (cur && $('archFeatCv')) R.animate($('archFeatCv'), sprites(cur));
      Array.prototype.forEach.call(box.querySelectorAll('.archive-chip'), function (b) { b.onclick = function () { filt = b.dataset.f; draw(); }; });
      Array.prototype.forEach.call(box.querySelectorAll('.archive-card'), function (b) { b.onclick = function () { sel = b.dataset.id; draw(); }; });
      var pb = box.querySelector('.archplay'); if (pb && cur && cur.x) pb.onclick = function () { withReturn(function () { cur.x.e.play(cur.x.e.name + (cur.x.e.farewell ? "'s farewell" : "'s replay") + (cur.x.done ? ' · block ' + fmt(cur.x.block) : ' (preview)')); }); };
      if (cur && cur.x && cur.x.done && !(cur.x.row && cur.x.row.block_time) && window.LiveEngine && LiveEngine.Chain) try { new LiveEngine.Chain().getJson('/blocks/' + cur.x.block).then(function (j) { var bt = j && j.result && j.result.block_time, el = box.querySelector('.archdate'); if (bt && el) el.textContent = new Date(bt * 1000).toISOString().slice(0, 10); }, function () {}); } catch (e) { }
    }
    draw(); withReturn(function () {}); if (preview === 'wizard') withFarewell(function () { V2Farewell.play({ sprites: farewellSprites(w), info: 'Bitcoin Wizard farewell (preview)' }); });
  }
  function front() {
    heroGrid();
    var w = M.world(), c = w.community, T = V.WIZARD_THRESHOLDS, N = V.STAGE_NAMES, wiz = !!c.returned, st = c.petStage, rp = V.returnProgress(c.burned);
    // community pet (Jake 2026-10-14): Nakamoto at Mythic until The Return (1,111,111 burned in total); then the next community pet, grown by later burns
    var NG = window.GenPetCore || PetCore; if (NG.SPECIES.filter(function (x) { return x.id === 'nakamoto'; })[0] && V2Gear.reworkNakamoto) V2Gear.reworkNakamoto(NG);
    var nk = Object.assign(NG.characterPet('nakamoto', { tier: 'legendary' }), { band: 'none', crown: 'none', armor: 'none', cape: 'none', weapon: 'none', background: 'solid', bgColor: '#2a3a2e', pattern: 'none' });
    var nkFrames = [0, 1, 2, 3].map(function (f) { return NG.render(nk, { stage: 5, frame: f, gearOverride: {} }); }), eggFrames = WizardSprite.frames(0, '#2a3a2e', { head: WizardSprite.WIZARD_HAT }, { community: true });
    var gap = R.communityGap && R.communityGap(w); /* no community pet (Cold Storage gap): the card, feature tile and nav link STAY, with a coming-soon mystery egg (owner rule Oct 20 2026) */
    R.animate($('crCanvas'), gap ? R.comingSoonFrames() : R.communityFrames(w)); /* community roll gear: the community pet wears it (display only) */
    if ($('crGearTxt')) $('crGearTxt').textContent = R.communityWearing ? R.communityWearing(w) : ''; if (R.kekOn && R.kekOn(w) && window.V2KekArrival && $('crGearTxt')) { var kr = $('kekReplayRow'); if (!kr) { $('crGearTxt').insertAdjacentHTML('afterend', '<p class="small" id="kekReplayRow">' + V2KekArrival.LINK + '</p>'); kr = $('kekReplayRow'); } V2KekArrival.bindReplay(kr, M.world); V2KekArrival.watch($('crCanvas'), M.world); } /* Lord Kek arrival scene (display only) */ $('crCanvas').setAttribute('aria-label', 'Community pet: ' + c.petName + ', ' + N[st]);
    $('crName').textContent = c.petName; $('crStage').textContent = N[st]; $('crFed').textContent = fmt(Math.floor(wiz ? c.wizardFed : c.burned));
    var lo = wiz ? T[st] : 0, hi = wiz && st < 5 ? T[st + 1] : null, fed = wiz ? c.wizardFed : 0;
    $('crNext').textContent = hi ? fmt(Math.ceil(hi - fed - 1e-6)) + ' to ' + N[st + 1] : 'Mythic reached';
    $('crProg').style.width = (hi ? Math.min(100, 100 * (fed - lo) / (hi - lo)) : 100).toFixed(1) + '%';
    if (c.current === 'kek' && R.communityStats) { var ks = R.communityStats(w, M.state().rows.length); /* Lord Kek: care = burns since the Wizard's Mythic, 100x community thresholds */
      $('crFed').textContent = fmt(ks.fed); $('crNext').textContent = ks.next != null ? fmt(ks.next) + ' to ' + ks.nextName : 'Mythic reached'; $('crProg').style.width = ks.pct.toFixed(1) + '%'; }
    if ($('crBurned')) $('crBurned').textContent = fmt(Math.floor(c.burned)); $('crBurns').textContent = fmt(M.state().rows.length); $('crPets').textContent = fmt(w.pets.length);
    $('crQuest').style.width = (rp.pct * 100).toFixed(2) + '%';
    $('crQuestTxt').textContent = wiz ? 'Nakamoto\'s finished story' : fmt(Math.floor(rp.count)) + ' XCPETS burned by the community';
    if (gap) { var soon = R.comingSoonText(), nn = '#' + R.COMMUNITY_NEXT_NO; $('crName').textContent = nn + ' coming soon'; $('crCanvas').setAttribute('aria-label', soon);
      $('crStage').textContent = 'Coming soon'; $('crFed').textContent = '–'; $('crNext').textContent = 'Opens when pet ' + nn + ' arrives'; $('crProg').style.width = '0%';
      if ($('crGearTxt')) $('crGearTxt').innerHTML = '<b>' + esc(soon) + '</b>. The Bitcoin Wizard reached Mythic and is in Cold Storage. Community feeding opens when pet ' + nn + ' arrives.' + R.wizardTopHtml(w, esc, fmt);
      var ft = $('featCommunity') && $('featCommunity').querySelector('span'); if (ft) ft.textContent = soon + '. The Bitcoin Wizard reached Mythic and is in Cold Storage; everyone grows the next shared pet together.'; }
    var info = wiz ? 'Community cycle · block ' + fmt(c.returnBlock) + (c.returnTx ? ' · tx ' + String(c.returnTx).slice(0, 12) + '…' : '') : 'Preview (not reached yet)';
    var opts = { sprites: { nakamoto: nkFrames, egg: eggFrames }, info: info };
    var returning = false; try { returning = !!localStorage.getItem('xcpets-v2-return-seen'); } catch (e) { }
    if (w.wizardMythic || /preview=wizard/.test(location.search)) withFarewell(function () { V2Farewell.maybeAutoplay(w, { sprites: farewellSprites(w), info: w.wizardMythic ? 'Bitcoin Wizard · Mythic at block ' + fmt(w.wizardMythic.block) + ' · now in Cold Storage' : 'Preview (not reached yet)' }, returning); }); /* farewell: once per browser, returning visitors only */
    withReturn(function () {
      /* no Watch The Return button on the active community pet (Jake 2026-10-14): replays live only in Cold Storage (archive.html); the one-time autoplay stays */
      /* UX polish 2026-10-16 (owner): no full-screen autoplay for visitors, so new players see the game first; mark it seen (Cold Storage still replays it) */
      try { var ck = String(c.returnTx || c.returnBlock); if (c.returned && V2Return.seen() !== ck) localStorage.setItem(V2Return.SEEN_KEY, ck); } catch (e) { } if (V2Return.previewRequested()) V2Return.maybeAutoplay(w, opts);
    });
    if ($('crGear')) $('crGear').textContent = wiz ? 'Wizard hat, staff and robe grow with its stage (' + N[st] + ')' : '';
    $('crNet').textContent = ' chain'; $('crNote').textContent = 'Replayed from ' + M.state().rows.length + ' XCPETS burns on chain at block ' + fmt(M.state().tip) + '.';
    cast(w);
    var b = $('xcpConnect'); if (b) { b.removeAttribute('data-xcp-connect'); b.textContent = ME && !(window.V2View && V2View.viewOnly()) ? 'Connected: ' + ME.slice(0, 8) + '…' : 'Connect XCP Wallet'; /* address-lookup: a viewed address is not a connection */ b.onclick = function () { $('xcpMsg').textContent = 'Looking for XCP Wallet…'; V2Wallet.connect().then(function (a) { b.textContent = 'Connected: ' + a.slice(0, 8) + '…'; $('xcpMsg').innerHTML = 'Connected <b>' + esc(a) + '</b> · <a href="play.html">go play →</a>'; }, function (e) { $('xcpMsg').innerHTML = V2Wallet.errHtml(e); }); }; }
  }
  function ranking() {
    var w = M.world(), score = function (p) { return p.stage * 1e7 + streak(p, w.tip) * 1e5 + Math.min(p.care, 99999); };
    /* ranking tabs (ux-batch 2026-10-16, UI only): every board is computed from the same replayed world; dead and released pets never count */
    var live = w.pets.filter(function (p) { return !p.dead && !p.released; }), tip = w.tip || M.state().tip || 0, WEEK = 1008, RW = [1, 3, 10, 33];
    var power = function (p) { var s = p.stats || {}; return ['vigor', 'spark', 'grit', 'zoom', 'luck'].reduce(function (a, k) { return a + (s[k] || 0); }, 0); };
    var inWeek = function (b) { return b != null && b > tip - WEEK; };
    var BOARDS = [
      { id: 'wagmi', label: 'WAGMI → NGMI', note: 'Stage first, then feed streak, then care (XCPETS fed). Best cared for at the top.', pets: true },
      { id: 'pets', label: 'Most pets', note: 'Living pets owned.', players: true, week: true },
      { id: 'power', label: 'Most powerful', note: 'Power = Vigor + Spark + Grit + Zoom + Luck. Players: their single strongest pet.', pets: true, players: true },
      { id: 'rare', label: 'Rarest collection', note: 'Common 1 · Uncommon 3 · Rare 10 · Legendary 33 points per living pet.', players: true, week: true },
      { id: 'burn', label: 'Top burners', note: 'Total XCPETS burned, all actions.', players: true, week: true },
      { id: 'wins', label: 'Battle wins', note: 'Battles won. W/L = battle wins/losses.', pets: true, players: true, week: true },
      { id: 'leg', label: 'Legendary hunters', note: 'Living Legendary pets owned.', players: true, week: true },
      { id: 'old', label: 'Oldest pets', note: 'Living pets by hatch block, oldest first.', pets: true }
    ];
    var STEP = window.matchMedia && matchMedia('(max-width: 640px)').matches ? 25 : 100; /* content-fixes 2026-10-19: one Show more button, 25 rows a page on phones */
    var q = new URLSearchParams(location.search), st = { board: q.get('board') || 'wagmi', mode: q.get('mode') || null, span: q.get('span') === 'week' ? 'week' : 'all', n: STEP };
    if (!BOARDS.some(function (x) { return x.id === st.board; })) st.board = 'wagmi';
    var burned = {}, burnedWk = {}; (M.state().rows || []).forEach(function (r) { if (r.status != null && String(r.status).toLowerCase() !== 'valid') return; var a = r.amount != null ? Number(r.amount) || 0 : (Number(r.quantity) || 0) / 1e8; /* chain rows carry raw quantity (1e8 units), not amount */ burned[r.source] = (burned[r.source] || 0) + a; if (inWeek(r.block_index)) burnedWk[r.source] = (burnedWk[r.source] || 0) + a; });
    var winsWk = {}; (w.fights || []).forEach(function (f) { if (f.status === 'done' && inWeek(f.acceptBlock)) winsWk[f.winner] = (winsWk[f.winner] || 0) + 1; });
    function board() { return BOARDS.filter(function (x) { return x.id === st.board; })[0]; }
    function mode(B) { return B.pets && B.players ? (st.mode === 'players' ? 'players' : 'pets') : B.pets ? 'pets' : 'players'; }
    function petRows(B, wk) { var L = live.slice(), sc;
      if (B.id === 'wagmi') { L.sort(function (a, b) { return score(b) - score(a) || a.id - b.id; }); return L.map(function (p) { var s = streak(p, tip); return { p: p, score: s ? '🔥 ' + s + '-day streak' : '<span class="badge bad">no streak</span>', sub: 'care ' + fmt(p.care) + ' · W' + (p.wins || 0) + '/L' + (p.losses || 0), subQ: window.IPQ ? IPQ.mythicQ(p) : '' }; }); }
      if (B.id === 'old') { L = L.filter(function (p) { return p.hatchBlock != null; }).sort(function (a, b) { return a.hatchBlock - b.hatchBlock || a.id - b.id; }); return L.map(function (p) { return { p: p, score: 'block ' + fmt(p.hatchBlock), sub: '~' + Math.max(0, Math.floor((tip - p.hatchBlock) / 144)) + ' days old' }; }); }
      sc = B.id === 'power' ? power : function (p) { return wk ? (winsWk[p.id] || 0) : (p.wins || 0); };
      L = L.map(function (p) { return { p: p, v: sc(p) }; }).filter(function (r) { return r.v > 0; }).sort(function (a, b) { return b.v - a.v || a.p.id - b.p.id; });
      return L.map(function (r) { return { p: r.p, score: fmt(r.v) + (B.id === 'power' ? ' power' : ' win' + (r.v === 1 ? '' : 's')), sub: B.id === 'wins' ? 'W' + (r.p.wins || 0) + '/L' + (r.p.losses || 0) : '' }; }); }
    function playerRows(B, wk) { var m = {}, best = {};
      function add(o, v, p) { m[o] = (m[o] || 0) + v; if (p && (!best[o] || p.tier > best[o].tier || (p.tier === best[o].tier && p.stage > best[o].stage))) best[o] = p; }
      if (B.id === 'burn') Object.keys(wk ? burnedWk : burned).forEach(function (o) { add(o, (wk ? burnedWk : burned)[o]); });
      live.forEach(function (p) { var fresh = !wk || inWeek(p.hatchBlock);
        if (B.id === 'pets' && fresh) add(p.owner, 1, p);
        if (B.id === 'rare' && fresh) add(p.owner, RW[p.tier] || 0, p);
        if (B.id === 'leg' && fresh && p.tier === 3) add(p.owner, 1, p);
        if (B.id === 'wins') add(p.owner, wk ? (winsWk[p.id] || 0) : (p.wins || 0), p);
        if (B.id === 'power') { var v = power(p); if (!m[p.owner] || v > m[p.owner]) { m[p.owner] = v; best[p.owner] = p; } }
        if (B.id === 'burn' && m[p.owner] && (!best[p.owner] || p.tier > best[p.owner].tier)) best[p.owner] = p; });
      var unit = { pets: ' pets', rare: ' pts', leg: ' Legendary', wins: ' wins', power: ' power', burn: ' XCPETS' }[B.id];
      return Object.keys(m).filter(function (o) { return m[o] > 0; }).sort(function (a, b) { return m[b] - m[a] || (a < b ? -1 : 1); }).map(function (o) { return { owner: o, p: best[o] || null, score: fmt(Math.round(m[o] * 1e8) / 1e8) + unit }; }); }
    var MED = ['🥇', '🥈', '🥉'], TCOL = ['#9aa3b5', '#4fd18b', '#4f9dff', '#ffc93c'];
    function short(a) { return a ? a.slice(0, 6) + '…' + a.slice(-4) : ''; }
    function cur() { var B = board(), md = mode(B), wk = !!B.week && st.span === 'week'; return { B: B, md: md, wk: wk, rows: md === 'pets' ? petRows(B, wk) : playerRows(B, wk) }; }
    function render() {
      var c0 = cur(), B = c0.B, md = c0.md, wk = c0.wk, rows = c0.rows;
      try { var u = new URL(location.href); u.searchParams.set('board', B.id); if (B.pets && B.players) u.searchParams.set('mode', md); else u.searchParams.delete('mode'); if (wk) u.searchParams.set('span', 'week'); else u.searchParams.delete('span'); history.replaceState(null, '', u); } catch (e) { }
      var tabs = '<div class="pettabs rktabs" role="tablist">' + BOARDS.map(function (x) { return '<button type="button" role="tab" class="tab' + (x.id === B.id ? ' on' : '') + '" data-board="' + x.id + '" aria-selected="' + (x.id === B.id) + '">' + esc(x.label) + '</button>'; }).join('') + '</div>';
      var ctl = '<div class="row rkctl">' + (B.pets && B.players ? '<span class="seg"><button type="button" class="q' + (md === 'pets' ? ' on' : '') + '" data-mode="pets">Pets</button><button type="button" class="q' + (md === 'players' ? ' on' : '') + '" data-mode="players">Players</button></span>' : '') +
        (B.week ? '<span class="seg"><button type="button" class="q' + (wk ? ' on' : '') + '" data-span="week">This week</button><button type="button" class="q' + (!wk ? ' on' : '') + '" data-span="all">All time</button></span>' : '') +
        (ME ? '<button type="button" class="q" id="rkFind">📍 Find me</button>' : '') + '</div><p class="small muted rknote">' + esc(B.note) + (wk ? ' This week = the last 7 days (1,008 blocks): new pets, burns or wins in that time.' : '') + '</p>';
      var show = rows.slice(0, st.n), extra = (st.hits || []).filter(function (i) { return i >= st.n && i < rows.length; }), mineRank = -1; rows.forEach(function (r, i) { if (mineRank < 0 && (r.owner || (r.p && r.p.owner)) === ME) mineRank = i; });
      var rowHtml = function (r, i) { var p = r.p, own = r.owner || (p && p.owner), me = !!ME && own === ME, col = p ? TCOL[p.tier] : '#666';
        var who = md === 'pets' ? '<a href="pet.html?id=' + p.id + '"><b>' + esc(p.name) + '</b></a> <span class="muted">#' + p.id + ' · ' + esc(spLabel(p.species)) + ' · ' + TL[p.tier] + ' · ' + p.stageName + '</span><div class="small muted">owner ' + esc(short(own)) + (me ? ' (you)' : '') + '</div>'
          : '<b title="' + esc(own) + '">' + esc(short(own)) + '</b>' + (me ? ' <span class="chip">you</span>' : '') + (p ? '<div class="small muted">top pet <a href="pet.html?id=' + p.id + '">#' + p.id + ' ' + esc(p.name) + '</a> · ' + TL[p.tier] + '</div>' : '');
        return '<tr id="rk' + i + '"' + (me ? ' class="me"' : '') + '><td class="rk">' + (i < 3 ? MED[i] + ' ' : '') + '#' + (i + 1) + '</td><td>' + (p ? '<canvas width="32" height="32" data-id="' + p.id + '" style="width:48px;height:48px;image-rendering:pixelated;border:2px solid ' + col + ';border-radius:4px"></canvas>' : '') + '</td><td>' + who + '</td><td class="num"><b>' + r.score + '</b>' + (r.sub ? '<div class="small muted">' + esc(r.sub) + (r.subQ || '') + '</div>' : '') + '</td></tr>'; };
      var hl = st.all ? st.all.length : 0, hn = st.hits ? st.hits.length : 0, hmore = hl > hn ? '<tr class="end"><td colspan="4"><span class="small">Showing ' + fmt(hn) + ' of ' + fmt(hl) + ' matches</span> <button type="button" class="q" id="rkMoreHits">Show more matches (' + fmt(hl - hn) + ' left)</button></td></tr>' : '';
      var body = show.map(rowHtml).join('') + (extra.length ? '<tr class="end"><td colspan="4">⋯ found further down</td></tr>' + extra.map(function (i) { return rowHtml(rows[i], i); }).join('') : '') + hmore;
      var head = B.id === 'wagmi' ? '<tr class="end"><td colspan="4">🚀 WAGMI</td></tr>' : '', foot = B.id === 'wagmi' ? '<tr class="end"><td colspan="4">💀 NGMI</td></tr>' : '';
      $('board').innerHTML = tabs + ctl + (rows.length ? '<div class="tw"><table class="board">' + head + body + foot + '</table></div>' : '<p class="muted small">Nobody on this board yet.</p>');
      var bAll = $('boardAll'); bAll.style.display = rows.length > st.n ? '' : 'none'; bAll.textContent = 'Show more (' + fmt(rows.length - st.n) + ' left)';
      $('board').querySelectorAll('canvas[data-id]').forEach(function (c) { var p = w.byId[c.getAttribute('data-id')]; R.lazy(c, function () { return R.petFrames(p, w); }, true); });
      $('board').querySelectorAll('[data-board]').forEach(function (x) { x.onclick = function () { st.board = x.dataset.board; st.n = STEP; st.hits = null; st.all = null; render(); }; });
      $('board').querySelectorAll('[data-mode]').forEach(function (x) { x.onclick = function () { st.mode = x.dataset.mode; st.n = STEP; st.hits = null; st.all = null; render(); }; });
      $('board').querySelectorAll('[data-span]').forEach(function (x) { x.onclick = function () { st.span = x.dataset.span; st.n = STEP; st.hits = null; st.all = null; render(); }; });
      if ($('rkFind')) $('rkFind').onclick = function () { if (mineRank < 0) { $('rkFind').textContent = '📍 Not on this board yet'; return; } if (mineRank >= st.n) { st.n = mineRank + 1; render(); } var e = $('rk' + mineRank); if (e) { e.scrollIntoView({ block: 'center' }); e.classList.add('flash'); } };
      $('status').textContent = fmt(rows.length) + (md === 'pets' ? ' pets' : ' players') + ' on this board · from ' + fmt(M.state().rows.length) + ' XCPETS burns.';
    }
    $('boardAll').onclick = function () { st.n += STEP; render(); mark(); };
    /* content-fixes 2026-10-19: Find my pet searches EVERY row of the current board (not only the loaded ones), loads up to the first hit and highlights it.
     * q = { id: N } | { text: 'name' } | { owner: address }. Returns the number of matches. Used by js/ux-polish.js rankingFind(). */
    /* bigfix 2026-10-20: every match is highlighted; matches beyond the first 50 load with 'Show more matches (N left)' */
    function mark() { (st.hits || []).forEach(function (i) { var e = $('rk' + i); if (e) e.classList.add('uxp-hit'); }); var b = $('rkMoreHits'); if (b) b.onclick = function () { st.hits = st.all.slice(0, st.hits.length + 50); render(); mark(); }; }
    window.V2Ranking = { find: function (q) { var c = cur(), hits = [];
      c.rows.forEach(function (r, i) { var p = r.p, own = r.owner || (p && p.owner) || '';
        if (q.id != null ? p && p.id === q.id : q.owner ? own === q.owner : q.text ? (p && String(p.name).toLowerCase().indexOf(String(q.text).toLowerCase()) >= 0) || own.toLowerCase() === String(q.text).toLowerCase() : false) hits.push(i); });
      st.all = hits; st.hits = hits.slice(0, 50); render(); if (!hits.length) return 0; mark(); var e0 = $('rk' + hits[0]); if (e0) { e0.scrollIntoView({ block: 'center' }); e0.classList.add('flash'); } return hits.length; } };
    /* 'Your pets' summary removed from the rankings page (Jake 2026-10-15); your rows stay highlighted in the board */
    /* closest to dying (Jake 2026-10-15): the 10 living pets with the fewest blocks left, using the engine's own death block
     * (V2Rules liveAt: deathBlock = (day of last feed + 7 + 1) x 144; Mythic-care pets never starve, so they are not listed) */
    if ($('nearDeath')) { var tipB = w.tip, near = w.pets.filter(function (p) { return !p.dead && !p.released && p.deathBlock != null && p.deathBlock > tipB; })
        .sort(function (a, b) { return a.deathBlock - b.deathBlock || a.id - b.id; }).slice(0, 10);
      var left = function (n) { var m = n * 10; return fmt(n) + ' block' + (n === 1 ? '' : 's') + ' (~' + (m < 120 ? m + ' min' : m < 2880 ? Math.round(m / 60) + ' h' : (m / 1440).toFixed(1) + ' days') + ')'; };
      $('nearDeath').innerHTML = '<h2 class="sec" data-ico="skull">NGMI</h2><p class="small"><b>NGMI: closest to starving.</b></p><p class="small muted">Living pets with the least time left before they starve (7 full days with no meal). If one is yours, feed it on Play to reset its clock. Mythic pets never starve. A pet that dies goes to the Pet Cemetery and its gear goes back to the owner\'s stash.</p>' +
        (near.length ? '<div class="tw"><table class="board">' + near.map(function (p, i) { return '<tr' + (p.owner === ME ? ' class="me"' : '') + '><td class="rk">' + (i + 1) + '</td><td><canvas width="32" height="32" data-id="' + p.id + '" style="width:48px;height:48px;image-rendering:pixelated"></canvas></td><td><a href="pet.html?id=' + p.id + '"><b>' + esc(p.name) + '</b></a> <span class="muted">#' + p.id + ' · ' + esc(spLabel(p.species)) + ' · ' + TL[p.tier] + ' · ' + p.stageName + '</span><div class="small muted">owner <span title="' + esc(p.owner) + '">' + esc(shortAddr(p.owner)) + '</span>' + (p.owner === ME ? ' (you)' : '') + '</div></td><td>💀 dies in ' + left(p.deathBlock - tipB) + '<div class="small muted">at block ' + fmt(p.deathBlock) + '</div></td></tr>'; }).join('') + '</table></div>' : '<p class="muted small">No living pet is on a death clock.</p>');
      $('nearDeath').querySelectorAll('canvas[data-id]').forEach(function (c) { var p = w.byId[c.getAttribute('data-id')]; R.lazy(c, function () { return R.petFrames(p, w); }, true); }); }
    render();
  }
  /* cemetery-paging 2026-10-20 (owner approved, list-cap audit finding 5): ~15,000 pets reach their death block within a week.
   * Graves render a page at a time (Show more, same as Ranking: 100 a page, 25 on phones) and a Find box searches EVERY grave
   * (#ID, name, species, owner address). Canvases paint lazily. The status count still uses the full dead list. Display only. */
  function cemetery() {
    var w = M.world(), dead = w.pets.filter(function (p) { return p.dead && !p.released; }).sort(function (a, b) { return b.deathBlock - a.deathBlock || b.id - a.id; });
    var STEP = window.matchMedia && matchMedia('(max-width: 640px)').matches ? 25 : 100, st = { n: STEP, q: '', mine: false, list: dead };
    $('status').textContent = fmt(dead.length) + ' pet' + (dead.length === 1 ? '' : 's') + ' in the Pet Cemetery, from ' + fmt(M.state().rows.length) + ' XCPETS burns. A pet dies after 7 full chain days (144 blocks each) with no feed.';
    var tombs = $('tombs');
    if (window.V2CemeteryScene) V2CemeteryScene.mount(w, dead); /* cemetery-scene branch: pixel scene over the list (newest 12 graves) */
    if (!dead.length) { tombs.innerHTML = '<p class="muted">No pets have died yet. See which pets are <a href="ranking.html">close to starving</a> on the ranking page.</p>'; return; }
    var tomb = function (p) { var gc = R.graveCount(w, p);
      return '<div class="tomb" id="tomb-' + p.id + '"><canvas width="32" height="32" data-id="' + p.id + '" role="img" aria-label="ghost of #' + p.id + '"></canvas><h4><a href="pet.html?id=' + p.id + '">' + esc(p.name) + '</a> <span class="muted">#' + p.id + '</span></h4>' +
        '<div class="small">' + esc(spLabel(p.species)) + ' · <span class="pill tier tier-' + TID[p.tier] + '">' + TL[p.tier] + '</span> · reached ' + esc(p.stageName) + '</div><div class="small muted tombowner" title="' + esc(p.owner) + '" style="overflow-wrap:anywhere">owner ' + esc(shortAddr(p.owner)) + (ME && p.owner === ME ? ' (you)' : '') + '</div><div class="died">🪦 died at block ' + fmt(p.deathBlock) + '</div>' + (gc ? '<div class="small buried">' + R.graveLine(w, p) + '</div>' : '') + '</div>'; };
    var bar = document.createElement('div'); bar.className = 'uxp-find cemfind';
    bar.innerHTML = '<label class="small" for="cemFind">Find a grave</label><input id="cemFind" type="search" placeholder="Pet #, name, species or owner" autocomplete="off"><button type="button" class="btn" id="cemGo">Find</button>' + (ME ? '<button type="button" class="btn ghost" id="cemMine" aria-pressed="false">My graves</button>' : '') + '<span class="small muted" id="cemMsg" aria-live="polite"></span>';
    tombs.parentNode.insertBefore(bar, tombs);
    var more = document.createElement('button'); more.type = 'button'; more.className = 'q'; more.id = 'tombsMore'; more.style.display = 'none'; tombs.parentNode.insertBefore(more, tombs.nextSibling);
    function paint(from, to) { var frag = st.list.slice(from, to).map(tomb).join(''); tombs.insertAdjacentHTML('beforeend', frag);
      st.list.slice(from, to).forEach(function (p) { var c = tombs.querySelector('canvas[data-id="' + p.id + '"]'); if (c) R.lazy(c, function () { return R.framesWith(p.art, p.stage, []); }, true); });
      more.style.display = st.list.length > to ? '' : 'none'; more.textContent = 'Show more (' + fmt(st.list.length - to) + ' left)'; }
    function apply() { var q = st.q.trim().toLowerCase().replace(/^#/, ''), num = /^\d+$/.test(q);
      st.list = dead.filter(function (p) { if (st.mine && p.owner !== ME) return false; if (!q) return true;
        return num ? String(p.id) === q || String(p.id).indexOf(q) === 0 : String(p.name).toLowerCase().indexOf(q) >= 0 || String(spLabel(p.species)).toLowerCase().indexOf(q) >= 0 || String(p.owner).toLowerCase() === q || (q.length >= 6 && String(p.owner).toLowerCase().indexOf(q) >= 0); });
      if (num) st.list.sort(function (a, b) { return (String(b.id) === q) - (String(a.id) === q); });
      st.n = STEP; tombs.innerHTML = ''; paint(0, st.n);
      $('cemMsg').textContent = (q || st.mine) ? (st.list.length ? fmt(st.list.length) + ' grave' + (st.list.length === 1 ? '' : 's') + ' found' : 'No grave found' + (q ? ' for "' + st.q.trim() + '"' : '') + '.') : '';
      if (!st.list.length) tombs.innerHTML = '<p class="muted small">No grave matches. Try a pet number, a name, a species or a full owner address.</p>'; }
    more.onclick = function () { var a = st.n; st.n += STEP; paint(a, st.n); };
    var inp = $('cemFind'), tmr; inp.oninput = function () { clearTimeout(tmr); tmr = setTimeout(function () { st.q = inp.value; apply(); }, 200); };
    inp.onkeydown = function (e) { if (e.key === 'Enter') { clearTimeout(tmr); st.q = inp.value; apply(); } };
    $('cemGo').onclick = function () { clearTimeout(tmr); st.q = inp.value; apply(); };
    if ($('cemMine')) $('cemMine').onclick = function () { st.mine = !st.mine; this.setAttribute('aria-pressed', st.mine); this.classList.toggle('on', st.mine); this.textContent = st.mine ? 'All graves' : 'My graves'; apply(); };
    var deep = (location.hash.match(/^#tomb-(\d+)$/) || [])[1] || new URLSearchParams(location.search).get('id');
    if (deep && w.byId[deep] && w.byId[deep].dead) { inp.value = '#' + deep; st.q = deep; apply(); var e = $('tomb-' + deep); if (e) { e.scrollIntoView({ block: 'center' }); e.classList.add('flash'); } }
    else paint(0, st.n);
  }
  function pet() {
    $('page').style.display = 'block';
    var id = Number(new URLSearchParams(location.search).get('id')), w = M.world();
    if (!(id >= 1)) { var mineP = w.pets.filter(function (p) { return p.owner === ME && !p.released; }); id = mineP.length ? mineP[0].id : 1; history.replaceState(null, '', 'pet.html?id=' + id); }
    var p = w.byId[id];
    if (!p) { $('title').textContent = 'Pet #' + id + ' does not exist (yet).'; return; }
    function draw(msg) {
      w = M.world(); p = w.byId[id];
      $('title').textContent = '#' + p.id + ' ' + p.name; document.title = 'XCPETS ' + $('title').textContent;
      R.animate($('cv'), R.petFrames(p, w)); $('cv').style.filter = p.dead ? 'grayscale(1) brightness(.75)' : '';
      var T = 0; $('stats').innerHTML = PetCore.STAT_KEYS.map(function (k) { var v = p.stats[k]; T += v; return '<div class="stat"><span class="sk">' + k.toUpperCase() + '</span><span class="sbar"><i style="width:' + Math.min(100, 100 * v / 31).toFixed(0) + '%"></i></span><b>' + v + '</b></div>'; }).join('') + '<div class="stat tot"><span class="sk">TOTAL</span><b>' + T + '</b></div>';
      $('chips').innerHTML = [TL[p.tier], spLabel(p.species), p.stageName, '🔥 streak ' + streak(p, w.tip), '🎒 ' + V.wornOf(w, p.id).length + '/' + p.capacity + ' slots', 'W' + (p.wins || 0) + '/L' + (p.losses || 0)].map(function (c) { return '<span class="chip">' + esc(c) + '</span>'; }).join('') + (p.blackEye ? '<span class="chip">🤕 black eye</span>' : '') + (R.bredFrom ? R.bredFrom(w, p, false) : '') + (window.PetScore ? PetScore.badge(w, p) : '');
      if (window.V2Rivals) { var rvEl = $('rivals'); if (!rvEl) { rvEl = document.createElement('div'); rvEl.id = 'rivals'; $('chips').parentNode.insertBefore(rvEl, $('chips').nextSibling); } rvEl.innerHTML = V2Rivals.strip(w, p.id, function (fid) { return 'play.html#replay-' + fid; }); } /* rivals strip (battle-arena DRAFT, off-chain) */
      $('facts').innerHTML = (p.dead ? '<p class="deathnote" id="deathNote">🪦 Died of neglect at block ' + fmt(p.deathBlock) + ' and rests in the <a href="cemetery.html">Pet Cemetery</a>. ' + (R.graveCount(w, p) ? 'Its ' + R.graveCount(w, p) + ' gear piece' + (R.graveCount(w, p) === 1 ? '' : 's') + ' stay' + (R.graveCount(w, p) === 1 ? 's' : '') + ' on its grave (the owner chose this on chain).' : 'Its gear went back to the owner\'s stash.') + '</p>' : '') +
        'Owner <code class="addr" tabindex="0" role="button" title="' + esc(p.owner) + '" data-full="' + esc(p.owner) + '" data-short="' + esc(String(p.owner).length > 16 ? String(p.owner).slice(0, 6) + '…' + String(p.owner).slice(-4) : p.owner) + '" onclick="this.textContent=this.textContent===this.dataset.full?this.dataset.short:this.dataset.full;this.classList.toggle(\'open\')">' + esc(String(p.owner).length > 16 ? String(p.owner).slice(0, 6) + '…' + String(p.owner).slice(-4) : p.owner) + '</code>' + (p.owner === ME ? ' (you)' + (p.dead ? '' : ' <a class="btn" href="play.html#discard-' + p.id + '" title="Free: hides it in your browser; restore from My Pets">🗑️ Discard</a>') : '') + ' · hatched in block ' + fmt(p.hatchBlock) + ' (tx ' + esc(String(p.hatchTx).slice(0, 12)) + '…) · care ' + fmt(p.care) + ' / ' + fmt(R.careTarget(w, p, w.tip).mythic) + (R.careTarget(w, p, w.tip).discount ? ' (Mythic discount)' : '') + (p.parents ? ' · child of #' + p.parents.join(' × #') : '') +
        (p.owner === ME && !p.dead ? ' <a class="btn" href="play.html#pet-' + p.id + '">Open in the game</a>' : '');
      var g = $('gear');
      if (p.dead) g.innerHTML = R.graveCount(w, p) ? '<p class="small">' + R.graveLine(w, p) + ': ' + V.wornOf(w, p.id).map(function (x) { return esc(V.slotLabel(x.slot) + ': ' + x.label); }).join(' · ') + '. Left on the grave: they can\'t be worn or moved.</p>' : '<p class="small">A pet in the Pet Cemetery can\'t wear gear. Its gear went back to the owner\'s stash.</p>';
      else if (p.owner !== ME) g.innerHTML = '<div class="chips">' + V.V2_SLOTS.map(function (sl) { var x = V.wornOf(w, p.id).filter(function (q) { return q.slot === sl; })[0]; return '<span class="chip">' + V.slotLabel(sl) + ': ' + (x ? esc(x.label) : p.openSlots.indexOf(sl) < 0 ? 'locked' : 'empty') + '</span>'; }).join('') + '</div><p class="small muted">Only the owner can change this pet\'s gear.</p>';
      else { if (!g.querySelector('.gpicker')) g.innerHTML = '<p class="small muted">Click a slot, then click a piece to equip it (free, saved in this browser).</p><div class="gpicker" id="gPicker"></div>';
        R.gearPicker($('gPicker'), { world: w, owner: ME, pet: p, msg: msg, viewOnly: !!(window.V2View && V2View.viewOnly()), onEquip: function (op, m) { if (window.V2View && V2View.viewOnly()) return; op.block_index = M.state().tip; M.state().ops.push(op); M.save(); draw('✓ ' + m); },
          onEquipMany: function (ops, m) { if (window.V2View && V2View.viewOnly()) return; ops.forEach(function (op) { op.block_index = M.state().tip; M.state().ops.push(op); }); M.save(); draw('✓ ' + m); } }); }

      if ($('starveWarn')) { $('starveWarn').innerHTML = R.starveHtml(w, p, ME, { feedHref: 'play.html#pet-' + p.id }); R.bindStarve($('starveWarn'), w, p, ME, {}); }
      /* history (2026-10-16 fix): chain rows carry hex tags + raw quantity; decode them, match every log entry that names this pet
       * (petId / ids / '#ID' in the message incl. pack ranges and fights), add the hatch row and pre-v2 burns, in chain order. */
      var RW = M.state().rows || [], byTx = {}; RW.forEach(function (r) { byTx[r.tx_hash] = r; });
      var rx = new RegExp('#' + id + '(?![0-9])'), tagRx = new RegExp(':' + id + '(:|$)');
      function names(e) { if (e.petId === id || (e.ids && e.ids.indexOf(id) >= 0) || rx.test(e.msg || '')) return true;
        var m = /#(\d+)-#(\d+)/.exec(e.msg || ''); if (m && id >= +m[1] && id <= +m[2]) return true; return tagRx.test(tagText((byTx[e.tx] || {}).tag)); }
      var hist = w.log.filter(names).map(function (e) { return { block: e.block, tx: e.tx, res: e.kind + ': ' + e.msg }; }), seen = {}; hist.forEach(function (h) { if (h.tx) seen[h.tx] = 1; });
      var cut = V.CUTOFF_BLOCK || 971500;
      RW.forEach(function (r) { if (seen[r.tx_hash] || r.block_index > cut) return; var t = tagText(r.tag);
        if (r.tx_hash === p.hatchTx) hist.push({ block: r.block_index, tx: r.tx_hash, res: 'hatch: hatched #' + id + ' (before v2)' });
        else if (tagRx.test(t)) hist.push({ block: r.block_index, tx: r.tx_hash, res: 'before v2: ' + t }); seen[r.tx_hash] = 1; });
      if (p.hatchBlock != null && !hist.some(function (h) { return /^hatch/.test(h.res) || (p.hatchTx && h.tx === p.hatchTx); })) hist.push({ block: p.hatchBlock, tx: p.hatchTx, res: p.parents ? 'born: egg from #' + p.parents.join(' x #') : 'hatch: hatched #' + id });
      hist.sort(function (x, y) { return x.block - y.block; });
      $('hist').innerHTML = '<tr><td>block</td><td>from</td><td>XCPETS</td><td>tag</td><td>result</td></tr>' + hist.map(function (e) { var r = byTx[e.tx] || {};
        return '<tr><td>' + e.block + '</td><td>' + esc(String(r.source || '').slice(0, 12)) + '</td><td>' + (e.tx && byTx[e.tx] ? fmt(burnAmt(r)) : '') + '</td><td>' + (tagText(r.tag) ? '<details class="ip-raw"><summary>tag</summary><code>' + esc(tagText(r.tag)) + '</code></details>' : '') + '</td><td>' + esc(plainRes(e.res, tagText(r.tag))) + '</td></tr>'; }).join('');
    }
    draw();
    // On-chain art (inscriptions): hosted by default, upgrade action + lineage
    (function () { var gs0 = $('gear').closest('section') || $('gear').parentNode, bt = $('bornTraits') || document.createElement('section'); bt.className = 'panel'; bt.id = 'bornTraits';
      bt.innerHTML = '<h2 class="sec" data-ico="egg">Born traits</h2><table class="small borntraits">' + V.bornTraits(p, p.stage).map(function (r) { return '<tr><td class="muted">' + esc(r[0]) + '</td><td>' + (r[0] === 'Background colour' ? '<span style="display:inline-block;width:10px;height:10px;border:1px solid #000;background:' + esc(r[1]) + '"></span> ' : '') + esc(r[1]) + '</td></tr>'; }).join('') + '</table>';
      if (!bt.parentNode) gs0.parentNode.insertBefore(bt, gs0.nextSibling); })();
    /* family tree on the PUBLIC pet page for every visitor (2026-10-15, Jake): chart (V2Render turns ul.tree into the family chart) + parents / bred-with / breedings */
    (function () { var fs = $('famTree') || document.createElement('section'); fs.className = 'panel'; fs.id = 'famTree';
      fs.innerHTML = '<h2 class="sec" data-ico="egg">Family tree</h2><ul class="tree"><li>#' + p.id + ' ' + esc(p.name) + '</li></ul>' + R.familyHtml(M.world(), M.world().byId[p.id], M.state().tip);
      if (!fs.parentNode) $('bornTraits').parentNode.insertBefore(fs, $('bornTraits').nextSibling); })();
    if (window.V2InscribeEnv && window.V2InscribeUI) { var gs1 = $('gear').closest('section') || $('gear').parentNode, h1 = document.createElement('section'); h1.className = 'panel'; h1.id = 'inscPanel'; gs1.parentNode.insertBefore(h1, gs1.nextSibling); V2InscribeUI.petSection(h1, p, w, p.owner === ME); return; } // TEST LINK only (?inscribe=test)
  }
  /* Hybrids browser (hybrids.html, homepage-cast 2026-10-19): every hybrid mix that exists on chain (V.castHybrids, the same list the
   * home cast used to print inline), one fixed card per mix in a wrapping grid, each body it can hatch with shown at the picked stage. */
  function hybrids() {
    var w = M.world(), list = V.castHybrids(w), n = {}, G = window.GenPetCore || PetCore, stage = 5, grid = $('hybGrid'), tabs = $('hybStages');
    (w.pets || []).forEach(function (p) { if (V.isHybrid(p.species) && !p.released) n[p.species] = (n[p.species] || 0) + 1; });
    var three = list.filter(function (e) { return (e.roots || []).length > 2; }).length;
    $('hybStatus').textContent = list.length ? fmt(list.length) + ' hybrid mix' + (list.length === 1 ? '' : 'es') + ' so far' + (three ? ' (' + fmt(three) + ' three-way)' : '') + ', replayed from ' + fmt(M.state().rows.length) + ' XCPETS burns.' : 'No hybrids yet. Breed two different species to make the first one.';
    function draw() {
      grid.innerHTML = list.map(function (e, i) { var roots = e.roots || [e.a, e.b], k = n[e.key] || 0;
        return '<div class="hybitem" data-hyb="' + esc(e.key) + '"><h3 class="ch">' + esc(e.name) + ' <span class="chip hyb">' + (roots.length > 2 ? '3-WAY' : 'HYBRID') + '</span></h3>' +
          '<p class="muted small">' + roots.map(function (r) { return esc(spLabel(r)); }).join(' × ') + (k ? ' · ' + fmt(k) + ' pet' + (k === 1 ? '' : 's') : '') + '</p><div class="hybbodies">' +
          (e.builds || [e.plan]).map(function (pl, j) { return '<figure><canvas width="32" height="32" data-i="' + i + '" data-j="' + j + '" role="img" aria-label="' + esc(e.name + ', ' + spLabel(pl.shape) + ' body, ' + V.STAGE_NAMES[stage]) + '"></canvas><figcaption class="small muted">' + esc(spLabel(pl.shape)) + ' body</figcaption></figure>'; }).join('') + '</div></div>'; }).join('');
      Array.prototype.forEach.call(grid.querySelectorAll('canvas[data-i]'), function (c) { var e = list[+c.getAttribute('data-i')], pl = (e.builds || [e.plan])[+c.getAttribute('data-j')], art = G.characterPet(pl.shape, { tier: 'legendary' }); art.hybrid = pl;
        R.paint(c, V.hybridRender(art, { stage: stage, frame: 0 })); });
      Array.prototype.forEach.call(tabs.children, function (b) { b.classList.toggle('on', +b.getAttribute('data-st') === stage); });
    }
    tabs.innerHTML = V.STAGE_NAMES.map(function (nm, si) { return si ? '<button type="button" data-st="' + si + '">' + esc(nm) + '</button>' : ''; }).join('');
    tabs.onclick = function (ev) { var b = ev.target.closest('button'); if (!b) return; stage = +b.getAttribute('data-st'); draw(); };
    draw(); document.body.setAttribute('data-hyb-ready', String(list.length));
  }
  function inscriptions() { if (window.V2InscribeEnv && window.V2InscribeUI) V2InscribeUI.page(); /* without the test flag the page redirects home (inscriptions.html) */ }
  var go = { front: front, ranking: ranking, cemetery: cemetery, pet: pet, inscriptions: inscriptions, archive: archive, hybrids: hybrids }[page]; if (go) go();
  /* smooth-perf (2026-10-19): in-page anchors (e.g. hybrids.html "Back to the cast" -> index.html#cast) land under the sticky nav, not behind it:
   * --navh = measured nav height feeds scroll-margin-top (css/style.css). The browser jumps to the anchor before the chain data fills the page, so
   * once it is drawn, the anchor is re-aligned instantly, unless the visitor already scrolled, tapped or used the keyboard. */
  (function () { function navH() { var n = document.querySelector('header.nav, .nav'); if (n) document.documentElement.style.setProperty('--navh', Math.ceil(n.getBoundingClientRect().height) + 'px'); }
    navH(); window.addEventListener('resize', navH);
    var moved = false, mark = function () { moved = true; }; ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(function (e) { window.addEventListener(e, mark, { passive: true, once: true }); });
    var h = location.hash && /^#[A-Za-z][\w-]*$/.test(location.hash) ? document.getElementById(location.hash.slice(1)) : null;
    if (h) setTimeout(function () { if (moved) return; var d = document.documentElement, o = d.style.scrollBehavior; d.style.scrollBehavior = 'auto'; h.scrollIntoView({ block: 'start' }); d.style.scrollBehavior = o; }, 60); })();
})();
