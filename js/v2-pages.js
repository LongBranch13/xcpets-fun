/* XCPETS v2: the live front page / ranking / cemetery / pet page wired to the LOCAL mock chain (js/v2-mock.js).
 * Same markup + ids as xcpets.fun; data comes from V2Mock.world() instead of the Counterparty API. No network, nothing signed. */
(function () {
  'use strict';
  var V = window.V2Rules, M = window.V2Mock, R = window.V2Render, ME = M.ME, $ = function (id) { return document.getElementById(id); }, esc = R.esc;
  var fmt = function (n) { return Number(n).toLocaleString('en-US', { maximumFractionDigits: 8 }); };
  var TL = V.TIER_LABELS, TID = ['common', 'uncommon', 'rare', 'legendary'];
  function spLabel(id) { return V.speciesLabel(id); }
  function streak(p, tip) { var d = V.day(tip), n = 0; if (!p.feedDays[d]) d--; while (p.feedDays[d]) { n++; d--; } return n; }
  function small(fr, c) { R.animate(c, fr); }
  var page = document.body.getAttribute('data-v2page');
  // demo banner (same .panel component as the live site)
  var bar = document.createElement('section'); bar.className = 'panel compact mockbar'; bar.id = 'mockBar';
  bar.innerHTML = '<b>XCPETS v2</b> · live chain data (read-only) · block <b>' + fmt(M.state().tip) + '</b> · <a href="play.html">play →</a>';
  var main = document.querySelector('main'); if (main) main.insertBefore(bar, main.firstChild);

  /** Cast gating: Nakamoto joins the live Cast (12 species) only once V2Rules.castShowsNakamoto(world) (stage >= NAKAMOTO_CAST_STAGE). */
  function cast(w) {
    var show = V.castShowsNakamoto(w), G = window.GenPetCore || PetCore, box = $('castRows'); if (!box) return show;
    // rarity no longer caps gear in v2: drop the live "(1/2/4/5 gear)" from the tier tabs
    Array.prototype.forEach.call($('castTiers').children, function (b) { b.textContent = b.textContent.replace(/, \d gear\)/, ')'); });
    function add() { if (!show || window.PromoLiveCast || box.querySelector('[data-sp="nakamoto"]')) return; /* live-rules cast (promo.js) has its own Nakamoto row on the Legendary tab */ var sp = G.SPECIES.filter(function (x) { return x.id === 'nakamoto'; })[0]; if (!sp) return;
      var on = $('castTiers').querySelector('.on'), tier = on ? on.getAttribute('data-tier') : 'legendary', pet = G.characterPet('nakamoto', { tier: tier });
      var row = document.createElement('div'); row.className = 'cast-row'; row.setAttribute('data-sp', 'nakamoto');
      row.innerHTML = '<div><h4>Nakamoto</h4><p class="muted">Hatchable 13th species (v2) · rare · grows and breeds like the others from block 971,659</p><p class="muted">' + sp.arc.map(function (x) { return esc(x[0]); }).join(' → ') + '</p></div>';
      var strip = document.createElement('div'); strip.className = 'strip6';
      G.STAGES.forEach(function (name, si) { var d = document.createElement('div'), c = document.createElement('canvas'); c.width = c.height = 32; c.setAttribute('role', 'img'); c.setAttribute('aria-label', 'Nakamoto, ' + name);
        R.paint(c, G.render(pet, { stage: si })); d.appendChild(c); d.appendChild(document.createTextNode(name)); strip.appendChild(d); });
      row.appendChild(strip); box.appendChild(row); }
    add(); new MutationObserver(add).observe(box, { childList: true });
    if (show) { var t = function (sel, a, b) { var e = document.querySelector(sel); if (e) e.innerHTML = e.innerHTML.replace(a, b); };
      t('#cast p.muted', 'one of twelve', 'one of thirteen'); t('.hero-copy .lede', 'Twelve pixel meme characters', 'Thirteen pixel meme characters'); t('.hero-copy .lede', 'Doge and Lenny.', 'Doge, Lenny and Nakamoto.'); }
    // Hybrids tab: appears once any hybrid exists in the demo state; one Cast entry per hybrid pair (Egg..Mythic of its own look)
    var hyb = V.castHybrids(w);
    if (hyb.length && !$('castHybTab')) { var tb = document.createElement('button'); tb.type = 'button'; tb.id = 'castHybTab'; tb.className = ($('castTiers').firstElementChild || {}).className || '';
      tb.classList.remove('on'); tb.textContent = '🧬 Hybrids (' + hyb.length + ')'; $('castTiers').appendChild(tb);
      var hb = document.createElement('div'); hb.className = 'cast'; hb.id = 'castHybrids'; hb.style.display = 'none'; box.parentNode.insertBefore(hb, box.nextSibling);
      hyb.forEach(function (e) { var art = (window.GenPetCore || PetCore).characterPet(e.plan.shape, { tier: 'legendary' }); art.hybrid = e.plan;
        var row = document.createElement('div'); row.className = 'cast-row'; row.setAttribute('data-hyb', e.key);
        row.innerHTML = '<div><h4>' + esc(e.name) + ' <span class="chip hyb">HYBRID</span></h4><p class="muted">' + esc(spLabel(e.a)) + ' × ' + esc(spLabel(e.b)) + ' (parent A × parent B) · ' + esc(spLabel(e.plan.shape)) + ' build, ' + esc(spLabel(e.plan.color)) + ' colours</p></div>';
        var strip = document.createElement('div'); strip.className = 'strip6';
        V.STAGE_NAMES.forEach(function (name, si) { var d = document.createElement('div'), c = document.createElement('canvas'); c.width = c.height = 32; c.setAttribute('role', 'img'); c.setAttribute('aria-label', e.name + ', ' + name);
          R.paint(c, V.hybridRender(art, { stage: si, frame: 0 })); d.appendChild(c); d.appendChild(document.createTextNode(name)); strip.appendChild(d); });
        row.appendChild(strip); hb.appendChild(row); });
      $('castTiers').addEventListener('click', function (ev) { var b = ev.target.closest('button'); if (!b) return; var isH = b === tb;
        Array.prototype.forEach.call($('castTiers').children, function (x) { if (x !== b) x.classList.remove('on'); }); b.classList.add('on');
        hb.style.display = isH ? '' : 'none'; box.style.display = isH ? 'none' : ''; }, true); }
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
  function withReturn(cb) { if (window.V2Return) return cb(); var t = document.createElement('script'); t.src = 'js/v2-return.js?v=d7a842c9a5'; t.onload = cb; document.body.appendChild(t); }
  /* Community Pets Archive (archive.html, Jake 2026-10-14): one box per COMPLETED community pet, from chain state. Registry: each community pet
   * brings its own Mythic sprite + Return animation; future pets (e.g. the next one) append an entry. Spoiler-free: empty until a cycle completes
   * (?preview=return in the demo shows Nakamoto's entry from current data). */
  function nakaFrames() { var NG = window.GenPetCore || PetCore; if (V2Gear.reworkNakamoto) V2Gear.reworkNakamoto(NG);
    var nk = Object.assign(NG.characterPet('nakamoto', { tier: 'legendary' }), { band: 'none', crown: 'none', armor: 'none', cape: 'none', weapon: 'none', background: 'solid', bgColor: '#2a3a2e', pattern: 'none' });
    return [0, 1, 2, 3].map(function (f) { return NG.render(nk, { stage: 5, frame: f, gearOverride: {} }); }); }
  var ARCHIVE = [
    { id: 'nakamoto', name: 'Nakamoto', done: function (c) { return c.returned; }, block: function (c) { return c.returnBlock; }, tx: function (c) { return c.returnTx; },
      sprites: nakaFrames, play: function (info) { V2Return.play({ sprites: { nakamoto: nakaFrames(), egg: WizardSprite.frames(0, '#2a3a2e') }, info: info }); } }
  ];
  function archiveEntries(w, preview) { var c = w.community, rows = M.state().rows;
    return ARCHIVE.map(function (e) { var done = e.done(c); if (!done && !preview) return null;
      var blk = done ? e.block(c) : null, tot = {}, sum = 0;
      rows.forEach(function (r) { if (blk != null && r.block_index > blk) return; var a = Number(r.amount) || 0; sum += a; tot[r.source] = (tot[r.source] || 0) + a; });
      var all = Object.keys(tot).map(function (k) { return { address: k, amount: tot[k] }; }).sort(function (x, y) { return y.amount - x.amount; });
      return { e: e, done: done, block: blk, tx: done ? e.tx(c) : null, total: sum, feeders: all.length, top: all.slice(0, 5), row: done ? rows.filter(function (r) { return r.tx_hash === e.tx(c); })[0] : null }; }).filter(Boolean); }
  /* Archive layout = Jake's Option C (gallery with featured player); styles in css/archive.css (.archive-*). Spoiler rules: nothing before The Return on chain
   * (neutral empty state); after it, Nakamoto (completed: Return blurb + replay) and the next community pet (in progress: one general line; never its sprite).
   * No placeholder for a next pet. */
  function shortAddr(s) { s = String(s || ''); return s.length > 14 ? s.slice(0, 6) + '…' + s.slice(-4) : s; }
  function archive() {
    var w = M.world(), c = w.community, preview = /preview=return/.test(location.search), list = archiveEntries(w, preview), box = $('archList');
    if (!list.length) { box.innerHTML = '<p class="muted archive-empty">No community pets in the archive yet.</p>'; return; }
    var items = list.map(function (x) { return { kind: 'done', x: x, id: x.e.id, name: x.e.name, done: x.done }; });
    if (c.returned) items.push({ kind: 'live', id: 'wizard', name: 'Bitcoin Wizard · community pet', done: false });
    var filt = 'all', sel = items[0].id;
    function sprites(it) { return it.kind === 'live' ? (c.wizardStage > 0 ? WizardSprite.frames(c.wizardStage, '#2a3a2e') : null) : it.x.e.sprites(); }
    function feat(it) {
      if (it.kind === 'live') return '<div class="archive-player"><span class="archive-cap">COMMUNITY PET · IN PROGRESS</span>' + (c.wizardStage > 0 ? '<canvas class="archive-fsprite" width="32" height="32" id="archFeatCv"></canvas>' : '') +
        '</div><div class="archive-fdesc"><span class="archive-tag live">IN PROGRESS</span> <span class="archive-tag myth">' + esc(V.STAGE_NAMES[c.wizardStage].toUpperCase()) + '</span>' +
        '<h2 class="archive-name">Community pet</h2><p>The community pet grows with every XCPETS burn, from anyone.</p><div class="archive-stats"><div class="archive-stat"><b>' + fmt(Math.floor(c.wizardFed)) + '</b><span>XCPETS burned so far</span></div><div class="archive-stat"><b>' + esc(V.STAGE_NAMES[c.wizardStage]) + '</b><span>Stage</span></div></div></div>';
      var x = it.x, dt = x.row && x.row.block_time ? new Date(x.row.block_time * 1000).toISOString().slice(0, 10) : '';
      return '<div class="archive-player"><span class="archive-cap">▶ REPLAY · ' + esc(x.e.name.toUpperCase()) + '</span><canvas class="archive-fsprite" width="32" height="32" id="archFeatCv"></canvas>' +
        '<div class="archive-play"><button class="btn archive-watch archplay" type="button">▶ Watch the replay</button></div></div><div class="archive-fdesc"><span class="archive-tag done">' + (x.done ? 'COMPLETED' : 'PREVIEW') + '</span> <span class="archive-tag myth">MYTHIC</span>' +
        '<h2 class="archive-name">' + esc(x.e.name) + '</h2><p>The community cycle came full circle.</p><div class="archive-stats">' +
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
      var pb = box.querySelector('.archplay'); if (pb && cur && cur.x) pb.onclick = function () { withReturn(function () { cur.x.e.play(cur.x.e.name + "'s replay" + (cur.x.done ? ' · block ' + fmt(cur.x.block) : ' (preview)')); }); };
      if (cur && cur.x && cur.x.done && !(cur.x.row && cur.x.row.block_time) && window.LiveEngine && LiveEngine.Chain) try { new LiveEngine.Chain().getJson('/blocks/' + cur.x.block).then(function (j) { var bt = j && j.result && j.result.block_time, el = box.querySelector('.archdate'); if (bt && el) el.textContent = new Date(bt * 1000).toISOString().slice(0, 10); }, function () {}); } catch (e) { }
    }
    draw(); withReturn(function () {});
  }
  function front() {
    heroGrid();
    var w = M.world(), c = w.community, T = V.WIZARD_THRESHOLDS, N = V.STAGE_NAMES, wiz = !!c.returned, st = c.petStage, rp = V.returnProgress(c.burned);
    // community pet (Jake 2026-10-14): Nakamoto at Mythic until The Return (1,111,111 burned in total); then the next community pet, grown by later burns
    var NG = window.GenPetCore || PetCore; if (NG.SPECIES.filter(function (x) { return x.id === 'nakamoto'; })[0] && V2Gear.reworkNakamoto) V2Gear.reworkNakamoto(NG);
    var nk = Object.assign(NG.characterPet('nakamoto', { tier: 'legendary' }), { band: 'none', crown: 'none', armor: 'none', cape: 'none', weapon: 'none', background: 'solid', bgColor: '#2a3a2e', pattern: 'none' });
    var nkFrames = [0, 1, 2, 3].map(function (f) { return NG.render(nk, { stage: 5, frame: f, gearOverride: {} }); }), eggFrames = WizardSprite.frames(0, '#2a3a2e');
    R.animate($('crCanvas'), wiz ? WizardSprite.frames(st, '#2a3a2e') : R.communityFrames(w)); /* community roll gear (2026-10-15) */
    if ($('crGearTxt')) $('crGearTxt').textContent = !wiz && R.communityGearText(w) ? 'Gear: ' + R.communityGearText(w) : ''; $('crCanvas').setAttribute('aria-label', 'Community pet: ' + c.petName + ', ' + N[st]);
    $('crName').textContent = wiz ? c.petName + ' · community pet' : c.petName; $('crStage').textContent = N[st]; $('crFed').textContent = fmt(Math.floor(wiz ? c.wizardFed : c.burned));
    var lo = wiz ? T[st] : 0, hi = wiz && st < 5 ? T[st + 1] : null, fed = wiz ? c.wizardFed : 0;
    $('crNext').textContent = hi ? fmt(hi - fed) + ' to ' + N[st + 1] : 'Mythic reached';
    $('crProg').style.width = (hi ? Math.min(100, 100 * (fed - lo) / (hi - lo)) : 100).toFixed(1) + '%';
    $('crBurned').textContent = fmt(Math.floor(c.burned)); $('crBurns').textContent = fmt(M.state().rows.length); $('crPets').textContent = fmt(w.pets.length);
    $('crQuest').style.width = (rp.pct * 100).toFixed(2) + '%';
    $('crQuestTxt').textContent = wiz ? fmt(Math.floor(c.burned)) + ' XCPETS burned' : fmt(Math.floor(rp.count)) + ' XCPETS burned by the community';
    var info = wiz ? 'Community cycle · block ' + fmt(c.returnBlock) + (c.returnTx ? ' · tx ' + String(c.returnTx).slice(0, 12) + '…' : '') : 'Preview (not reached yet)';
    var opts = { sprites: { nakamoto: nkFrames, egg: eggFrames }, info: info };
    withReturn(function () {
      /* no Watch The Return button on the active community pet (Jake 2026-10-14): replays live only in Cold Storage (archive.html); the one-time autoplay stays */
      V2Return.maybeAutoplay(w, opts);
    });
    if ($('crGear')) $('crGear').textContent = wiz ? 'Wizard hat, staff and robe grow with its stage (' + N[st] + ')' : '';
    $('crNet').textContent = ' chain'; $('crNote').textContent = 'Replayed from ' + M.state().rows.length + ' XCPETS burns on chain at block ' + fmt(M.state().tip) + '.';
    cast(w);
    var b = $('xcpConnect'); if (b) { b.removeAttribute('data-xcp-connect'); b.textContent = ME ? 'Connected: ' + ME.slice(0, 8) + '…' : 'Connect XCP Wallet'; b.onclick = function () { $('xcpMsg').textContent = 'Looking for XCP Wallet…'; V2Wallet.connect().then(function (a) { b.textContent = 'Connected: ' + a.slice(0, 8) + '…'; $('xcpMsg').innerHTML = 'Connected <b>' + esc(a) + '</b> · <a href="play.html">go play →</a>'; }, function (e) { $('xcpMsg').innerHTML = V2Wallet.errHtml(e); }); }; }
  }
  function ranking() {
    var w = M.world(), all = false, score = function (p) { return p.stage * 1e7 + streak(p, w.tip) * 1e5 + Math.min(p.care, 99999); };
    var rows = w.pets.filter(function (p) { return !p.dead && !p.released; }).sort(function (a, b) { return score(b) - score(a) || a.id - b.id; }).map(function (p, i) { return { rank: i + 1, p: p }; });
    function render() {
      var mine = V.myRanks(rows, ME), mineIds = {}; mine.forEach(function (m) { mineIds[m.id] = 1; });
      /* top 100 (Jake 2026-10-15): ranks 1-100 in the same format (all of them when fewer than 100); 'Show all' lists the rest */
      var TOP = 100, show = all || rows.length <= TOP ? rows : rows.slice(0, TOP);
      $('board').innerHTML = '<div class="tw"><table class="board"><tr class="end"><td colspan="4">🚀 WAGMI</td></tr>' + show.map(function (r) {
        if (r.gap) return '<tr class="gap"><td colspan="4">… ' + r.gap + ' more …</td></tr>';
        var p = r.p, s = streak(p, w.tip);
        return '<tr' + (p.owner === ME ? ' class="me"' : '') + '><td class="rk">#' + r.rank + (p.owner === ME ? '<div class="small">' + (mine.filter(function (m) { return m.id === p.id; })[0] || {}).note + '</div>' : '') + '</td><td><canvas width="32" height="32" data-id="' + p.id + '" style="width:48px;height:48px;image-rendering:pixelated"></canvas></td><td><a href="pet.html?id=' + p.id + '"><b>' + esc(p.name) + '</b></a> <span class="muted">#' + p.id + ' · ' + esc(spLabel(p.species)) + ' · ' + TL[p.tier] + ' · ' + p.stageName + '</span><div class="small muted">owner ' + esc(p.owner.slice(0, 8)) + (p.owner === ME ? ' (you)' : '…') + '</div></td><td>' +
          (s ? '🔥 ' + s + '-day streak' : '<span class="badge bad">no streak</span>') + '<div class="small muted">care ' + fmt(p.care) + ' · W' + (p.wins || 0) + '/L' + (p.losses || 0) + '</div></td></tr>';
      }).join('') + '<tr class="end"><td colspan="4">💀 NGMI</td></tr></table></div>';
      document.querySelectorAll('canvas[data-id]').forEach(function (c) { var p = w.byId[c.getAttribute('data-id')]; R.lazy(c, function () { return R.petFrames(p, w); }, true); });
      var b = $('boardAll'); b.style.display = rows.length > TOP ? '' : 'none'; b.textContent = all ? 'Show top ' + TOP : 'Show all ' + rows.length;
    }
    $('boardAll').onclick = function () { all = !all; render(); };
    /* 'Your pets' summary removed from the rankings page (Jake 2026-10-15); your rows stay highlighted in the board */
    /* closest to dying (Jake 2026-10-15): the 10 living pets with the fewest blocks left, using the engine's own death block
     * (V2Rules liveAt: deathBlock = (day of last feed + 7 + 1) x 144; Mythic-care pets never starve, so they are not listed) */
    if ($('nearDeath')) { var tipB = w.tip, near = w.pets.filter(function (p) { return !p.dead && !p.released && p.deathBlock != null && p.deathBlock > tipB; })
        .sort(function (a, b) { return a.deathBlock - b.deathBlock || a.id - b.id; }).slice(0, 10);
      var left = function (n) { var m = n * 10; return fmt(n) + ' block' + (n === 1 ? '' : 's') + ' (~' + (m < 120 ? m + ' min' : m < 2880 ? Math.round(m / 60) + ' h' : (m / 1440).toFixed(1) + ' days') + ')'; };
      $('nearDeath').innerHTML = '<h2 class="sec" data-ico="pet">Closest to dying</h2><p class="small muted">Living pets with the least time left before they starve (no feed for 7 full days after the day of their last feed). Feed them to reset the clock.</p>' +
        (near.length ? '<div class="tw"><table class="board">' + near.map(function (p, i) { return '<tr' + (p.owner === ME ? ' class="me"' : '') + '><td class="rk">' + (i + 1) + '</td><td><canvas width="32" height="32" data-id="' + p.id + '" style="width:48px;height:48px;image-rendering:pixelated"></canvas></td><td><a href="pet.html?id=' + p.id + '"><b>' + esc(p.name) + '</b></a> <span class="muted">#' + p.id + ' · ' + esc(spLabel(p.species)) + ' · ' + p.stageName + '</span><div class="small muted">owner ' + esc(p.owner.slice(0, 8)) + (p.owner === ME ? ' (you)' : '…') + '</div></td><td>💀 dies in ' + left(p.deathBlock - tipB) + '<div class="small muted">at block ' + fmt(p.deathBlock) + '</div></td></tr>'; }).join('') + '</table></div>' : '<p class="muted small">No living pet is on a death clock.</p>');
      $('nearDeath').querySelectorAll('canvas[data-id]').forEach(function (c) { var p = w.byId[c.getAttribute('data-id')]; R.lazy(c, function () { return R.petFrames(p, w); }, true); }); }
    $('status').textContent = rows.length + ' pets ranked from ' + M.state().rows.length + ' XCPETS burns.'; render();
  }
  function cemetery() {
    var w = M.world(), dead = w.pets.filter(function (p) { return p.dead && !p.released; }).sort(function (a, b) { return b.deathBlock - a.deathBlock; });
    $('status').textContent = dead.length + ' pet' + (dead.length === 1 ? '' : 's') + ' in the Pet Cemetery, from ' + M.state().rows.length + ' XCPETS burns. A pet dies after 7 full chain days (144 blocks each) with no feed.';
    $('tombs').innerHTML = dead.length ? dead.map(function (p) {
      return '<div class="tomb" id="tomb-' + p.id + '"><canvas width="32" height="32" data-id="' + p.id + '" role="img" aria-label="ghost of #' + p.id + '"></canvas><h4><a href="pet.html?id=' + p.id + '">' + esc(p.name) + '</a> <span class="muted">#' + p.id + '</span></h4>' +
        '<div class="small">' + esc(spLabel(p.species)) + ' · <span class="pill tier tier-' + TID[p.tier] + '">' + TL[p.tier] + '</span> · reached ' + esc(p.stageName) + '</div><div class="small muted">owner ' + esc(p.owner) + '</div><div class="died">🪦 died at block ' + fmt(p.deathBlock) + '</div></div>'; }).join('')
      : '<p class="muted">The Pet Cemetery is empty. Every pet is still being fed. 🌱</p>';
    dead.forEach(function (p) { var c = document.querySelector('canvas[data-id="' + p.id + '"]'); if (c) R.paint(c, R.framesWith(p.art, p.stage, [])[0]); });
  }
  function pet() {
    $('page').style.display = 'block';
    var id = Number(new URLSearchParams(location.search).get('id')), w = M.world();
    if (!(id >= 1)) { var mineP = w.pets.filter(function (p) { return p.owner === ME && !p.released; }); id = mineP.length ? mineP[0].id : 1; history.replaceState(null, '', 'pet.html?id=' + id); }
    var p = w.byId[id];
    if (!p) { $('title').textContent = 'Pet #' + id + ' does not exist (yet).'; return; }
    function draw(msg) {
      w = M.world(); p = w.byId[id];
      $('title').textContent = '#' + p.id + ' ' + p.name; document.title = 'XCPETS ' + $('title').textContent + ' (v2)';
      R.animate($('cv'), R.petFrames(p, w)); $('cv').style.filter = p.dead ? 'grayscale(1) brightness(.75)' : '';
      var T = 0; $('stats').innerHTML = PetCore.STAT_KEYS.map(function (k) { var v = p.stats[k]; T += v; return '<div class="stat"><span class="sk">' + k.toUpperCase() + '</span><span class="sbar"><i style="width:' + Math.min(100, 100 * v / 31).toFixed(0) + '%"></i></span><b>' + v + '</b></div>'; }).join('') + '<div class="stat tot"><span class="sk">TOTAL</span><b>' + T + '</b></div>';
      $('chips').innerHTML = [TL[p.tier], spLabel(p.species), p.stageName, '🔥 streak ' + streak(p, w.tip), '🎒 ' + V.wornOf(w, p.id).length + '/' + p.capacity + ' slots', 'W' + (p.wins || 0) + '/L' + (p.losses || 0)].map(function (c) { return '<span class="chip">' + esc(c) + '</span>'; }).join('') + (p.blackEye ? '<span class="chip">🤕 black eye</span>' : '') + (p.crowned ? '<span class="chip">👑 Rumble champion</span>' : '');
      $('facts').innerHTML = (p.dead ? '<p class="deathnote" id="deathNote">🪦 Died of neglect at block ' + fmt(p.deathBlock) + ' and rests in the <a href="cemetery.html">Pet Cemetery</a>. Its gear went back to the owner\'s inventory.</p>' : '') +
        'Owner <code class="addr" tabindex="0" role="button" title="' + esc(p.owner) + '" data-full="' + esc(p.owner) + '" data-short="' + esc(String(p.owner).length > 16 ? String(p.owner).slice(0, 6) + '…' + String(p.owner).slice(-4) : p.owner) + '" onclick="this.textContent=this.textContent===this.dataset.full?this.dataset.short:this.dataset.full;this.classList.toggle(\'open\')">' + esc(String(p.owner).length > 16 ? String(p.owner).slice(0, 6) + '…' + String(p.owner).slice(-4) : p.owner) + '</code>' + (p.owner === ME ? ' (you) <a class="btn" href="play.html#discard-' + p.id + '" title="Free: hides it in your browser; restore from My Pets">🗑️ Discard</a>' : '') + ' · hatched in block ' + fmt(p.hatchBlock) + ' (tx ' + esc(String(p.hatchTx).slice(0, 12)) + '…) · care ' + fmt(p.care) + ' / ' + fmt(V.thresholdsFor(p.species)[5]) + (p.parents ? ' · child of #' + p.parents.join(' × #') : '') +
        (p.owner === ME && !p.dead ? ' <a class="btn" href="play.html#pet-' + p.id + '">Open in the game</a>' : '');
      var g = $('gear');
      if (p.dead) g.innerHTML = '<p class="small">No gear: a pet in the Pet Cemetery can\'t wear anything.</p>';
      else if (p.owner !== ME) g.innerHTML = '<div class="chips">' + V.V2_SLOTS.map(function (sl) { var x = V.wornOf(w, p.id).filter(function (q) { return q.slot === sl; })[0]; return '<span class="chip">' + V.slotLabel(sl) + ': ' + (x ? esc(x.label) : p.openSlots.indexOf(sl) < 0 ? 'locked' : 'empty') + '</span>'; }).join('') + '</div><p class="small muted">Only the owner can change this pet\'s gear.</p>';
      else { if (!g.querySelector('.gpicker')) g.innerHTML = '<p class="small muted">Click a slot, then click a piece to equip it (free, saved in this browser).</p><div class="gpicker" id="gPicker"></div>';
        R.gearPicker($('gPicker'), { world: w, owner: ME, pet: p, msg: msg, onEquip: function (op, m) { op.block_index = M.state().tip; M.state().ops.push(op); M.save(); draw('✓ ' + m); } }); }
      var hist = w.log.filter(function (e) { return e.petId === id || (e.ids && e.ids.indexOf(id) >= 0) || new RegExp(':' + id + '(:|$)').test((M.state().rows.filter(function (r) { return r.tx_hash === e.tx; })[0] || {}).tag || ''); });
      $('hist').innerHTML = '<tr><td>block</td><td>from</td><td>XCPETS</td><td>tag</td><td>result</td></tr>' + hist.map(function (e) { var r = M.state().rows.filter(function (x) { return x.tx_hash === e.tx; })[0] || {};
        return '<tr><td>' + e.block + '</td><td>' + esc(String(r.source || '').slice(0, 12)) + '</td><td>' + fmt(r.amount || 0) + '</td><td>' + esc(r.tag || '') + '</td><td>' + esc(e.kind + ': ' + e.msg) + '</td></tr>'; }).join('');
    }
    draw();
    // On-chain art (inscriptions, MOCK): hosted by default, upgrade action + lineage
    (function () { var gs0 = $('gear').closest('section') || $('gear').parentNode, bt = $('bornTraits') || document.createElement('section'); bt.className = 'panel'; bt.id = 'bornTraits';
      bt.innerHTML = '<h2 class="sec" data-ico="egg">Born traits</h2><table class="small borntraits">' + V.bornTraits(p, p.stage).map(function (r) { return '<tr><td class="muted">' + esc(r[0]) + '</td><td>' + (r[0] === 'Background colour' ? '<span style="display:inline-block;width:10px;height:10px;border:1px solid #000;background:' + esc(r[1]) + '"></span> ' : '') + esc(r[1]) + '</td></tr>'; }).join('') + '</table>';
      if (!bt.parentNode) gs0.parentNode.insertBefore(bt, gs0.nextSibling); })();
    /* family tree on the PUBLIC pet page for every visitor (2026-10-15, Jake): chart (V2Render turns ul.tree into the family chart) + parents / bred-with / breedings */
    (function () { var fs = $('famTree') || document.createElement('section'); fs.className = 'panel'; fs.id = 'famTree';
      fs.innerHTML = '<h2 class="sec" data-ico="egg">Family tree</h2><ul class="tree"><li>#' + p.id + ' ' + esc(p.name) + '</li></ul>' + R.familyHtml(M.world(), M.world().byId[p.id], M.state().tip);
      if (!fs.parentNode) $('bornTraits').parentNode.insertBefore(fs, $('bornTraits').nextSibling); })();
    if (window.V2InscribeEnv && window.V2InscribeUI) { var gs1 = $('gear').closest('section') || $('gear').parentNode, h1 = document.createElement('section'); h1.className = 'panel'; h1.id = 'inscPanel'; gs1.parentNode.insertBefore(h1, gs1.nextSibling); V2InscribeUI.petSection(h1, p, w, p.owner === ME); return; } // TEST LINK only (?inscribe=test)
    // Inscriptions: COMING SOON (the inscribe flow is not live; no preview/commit is offered)
    (function () { var gs = $('gear').closest('section') || $('gear').parentNode, host = document.createElement('section'); host.className = 'panel'; host.id = 'inscPanel';
      host.innerHTML = '<h2 class="sec" data-ico="pet">On-chain art</h2><p><button type="button" class="btn" disabled aria-disabled="true">⛓️ Inscribe: coming soon</button></p><p class="small muted">Inscribing pet art on Bitcoin is not live yet. Art is hosted on this site for now.</p>';
      gs.parentNode.insertBefore(host, gs.nextSibling); })();
  }
  function inscriptions() { if (window.V2InscribeEnv && window.V2InscribeUI) V2InscribeUI.page(); /* else coming soon: static notice only */ }
  var go = { front: front, ranking: ranking, cemetery: cemetery, pet: pet, inscriptions: inscriptions, archive: archive }[page]; if (go) go();
})();
