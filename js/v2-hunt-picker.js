/* UI only. A suggestion is never a selection; the existing rule validator is authoritative. */
(function () {
  'use strict';
  var keys = ['vigor', 'spark', 'grit', 'zoom', 'luck'];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function open(c) {
    var prior = document.getElementById('huntPicker'); if (prior) prior.close();
    var V = c.V, w = c.w, Z = w.byId[c.zombie], focus = document.activeElement, page = 0, query = '', chosen = null, size = 24;
    var d = document.createElement('dialog'); d.id = 'huntPicker'; d.className = 'hunt-picker'; d.setAttribute('aria-labelledby', 'huntTitle');
    var revised = V.huntRulesOn && V.huntRulesOn(c.block);
    var rows = [], best = null;
    function build(pets) {
      rows = (pets || []).map(function (p) { var why = V.cemHuntWhy(w, p.id, Z.id, c.me, c.block); return {p:p, why:why, power:V.petPower(p) * (revised ? 1 + V.huntQuote(w, p.id, Z.id, c.block).bonus / 100 : 1), search:((p.name || '') + ' #' + p.id).toLowerCase()}; });
      rows.sort(function (a,b) { return b.power - a.power || a.p.id - b.p.id; });
      best = rows.filter(function (r) { return !r.why; })[0];
    }
    build(c.pets);
    function close() { d.close(); }
    d.addEventListener('close', function () { d.remove(); if (focus && focus.isConnected) focus.focus(); });
    function name(p) { return esc(p.name || 'Pet') + ' #' + p.id; }
    function sprite(p) { return '<canvas width="32" height="32" data-hsprite="' + p.id + '" aria-label="' + name(p) + '"></canvas>'; }
    function paint() { d.querySelectorAll('[data-hsprite]').forEach(function (el) { var p = w.byId[+el.dataset.hsprite]; if (p && p.art && c.R.lazy) c.R.lazy(el, function () { return c.R.petFrames ? c.R.petFrames(p, w) : c.R.framesWith(p.art, p.stage, []); }, true); }); }
    function shell(title) { d.innerHTML = '<header><h2 id="huntTitle">' + title + '</h2><button type="button" class="q" data-close aria-label="Close hunter picker">✕</button></header><div id="huntBody"></div>'; d.querySelector('[data-close]').onclick = close; }
    /* pet-picker (owner Jake Nov 22 2026): the hunter list is the shared picker (js/v2-pick.js): YOUR HUNTER vs the FERAL ZOMBIE on top, the
     * burn and the win/lose terms under them, then shelves of big sprite cards. One screen: pick, read, hunt. Same cemHuntWhy / cemHuntPlan / send. */
    var PS = { shelf: 'best', st: {} };
    function pick() {
      var PK = window.V2Pick; if (!PK) return pickOld();
      if (!d.querySelector('#huntPk')) { shell('⚔️ Choose your hunter'); d.querySelector('#huntBody').innerHTML = '<div id="huntPk"></div><p class="small" id="huntError" role="alert"></p><footer><button type="button" class="btn" data-ready disabled>Pick a hunter</button></footer>'; }
      var gb = d.querySelector('[data-ready]'); gb.disabled = !chosen; gb.textContent = chosen ? '🗡️ Hunt with ' + (chosen.name || 'Pet') + ' #' + chosen.id + ' · ' + V.cemHuntPlan(w, chosen.id, Z.id, c.block).amount + ' XCPETS' : 'Pick a hunter';
      var deco = function (r) { return { p: r.p, why: r.why, stat: '⚡ ' + Math.round(r.power * 100) / 100, line: r === best ? '★ suggested' : '' }; };
      var ready = rows.filter(function (r) { return !r.why; }), n = PS.st.n || 24, dec = function (L) { return L.slice(0, n).map(deco).concat(L.slice(n).map(function (r) { return { p: r.p, why: r.why }; })); };
      var plan = chosen ? V.cemHuntPlan(w, chosen.id, Z.id, c.block) : null, zp = Math.round(V.petPower(Z) * (revised ? 0.9 : 1) * 100) / 100;
      var cr = chosen && rows.filter(function (r) { return r.p.id === chosen.id; })[0], hp = cr ? Math.round(cr.power * 100) / 100 : 0;
      var shelves = [{ id: 'best', label: '⭐ Strongest', list: dec(ready), why: 'Your pets that can hunt today, strongest first.', empty: c.pending ? 'Loading your pets…' : 'None of your pets can hunt right now. Try 📋 All my pets to see why.' }]
        .concat(PK.canFav() ? [{ id: 'fav', label: '★ Favorites', list: dec(PK.favOf(rows)), why: 'Your ★ pets.', empty: 'No favorites here.' }] : [])
        .concat([{ id: 'recent', label: '🕘 Recent', list: dec(PK.recentOf(rows)), why: 'Pets you picked lately, here and in other places.', empty: 'Nothing picked yet.' },
          { id: 'all', label: '📋 All my pets', list: dec(rows), why: 'Every pet. The ones that can\u2019t hunt say why.', empty: c.pending ? 'Loading your pets…' : 'No pets yet.' }]);
      PK.render(d.querySelector('#huntPk'), { id: 'hunt', w: w, mid: 'VS', active: 'A', prompt: 'Pick your hunter', shelf: PS.shelf, shelves: shelves, selected: chosen ? chosen.id : '',
        searchList: PS.st.q ? dec(rows.filter(function (r) { return PK.match(r.p, PS.st.q); })) : null, searchPh: 'Search ' + rows.length.toLocaleString('en-US') + ' pets: name or #number',
        slots: [{ key: 'A', label: 'YOUR HUNTER', pet: chosen, empty: 'Pick a hunter', clear: true, buddy: chosen && chosen.id === PK.buddy(), sub: chosen ? '⚡ ' + hp + ' hunt power' : '' },
          { key: 'B', label: 'FERAL ZOMBIE', pet: Z, locked: true, sub: '⚡ ' + zp + (revised ? ' (fights at 90%)' : '') }],
        verdict: chosen ? { tone: hp >= zp ? 'good' : hp >= zp * 0.8 ? 'meh' : 'bad', big: hp >= zp ? 'STRONGER THAN THE ZOMBIE' : hp >= zp * 0.8 ? 'CLOSE FIGHT' : 'THE ZOMBIE IS STRONGER',
          small: (revised ? 'Win: capture it and feed it. Lose: +5% Grudge (up to +15%) and a quarter of the burn back as rematch credit, for 432 blocks.' + (plan ? ' Your Grudge: +' + plan.grudge + '%. Credit used: ' + plan.credit + ' XCPETS.' : '') : 'A win lays the zombie to rest. A loss gives your hunter a black eye for 72 blocks.') + ' One fight per pet per chain day.' }
          : { tone: 'wait', big: 'PICK WHO HUNTS ' + esc(String(Z.name || 'THE ZOMBIE').toUpperCase()), small: '⭐ Strongest is sorted by hunt power.' },
        onRedraw: pick, onSlot: function () { }, onClear: function () { chosen = null; pick(); }, onShelf: function (id) { PS.shelf = id; pick(); },
        onPick: function (cc) { var p = w.byId[cc.p.id], why = V.cemHuntWhy(w, p.id, Z.id, c.me, c.block); if (why) { d.querySelector('#huntError').textContent = why; return; } chosen = p; PK.used(p.id, true); PS.st.q = ''; pick(); } }, PS.st);
      var go = d.querySelector('[data-ready]'); go.onclick = function () { if (!chosen) return; var why = V.cemHuntWhy(w, chosen.id, Z.id, c.me, c.block); if (why) { d.querySelector('#huntError').textContent = why; return; }
        var pl = V.cemHuntPlan(w, chosen.id, Z.id, c.block); pl.label = 'Hunt with ' + (chosen.name || 'Pet') + ' #' + chosen.id + ' against ' + (Z.name || 'Zombie') + ' #' + Z.id + ' · ' + pl.amount + ' XCPETS';
        var title = 'Hunt with ' + (chosen.name || 'Pet') + ' #' + chosen.id + ' against #' + Z.id + ' · ' + pl.amount + ' XCPETS'; close(); c.send([pl], title); };
    }
    function pickOld() {
      chosen = null;
      shell('⚔️ Choose your hunter');
      d.querySelector('#huntBody').innerHTML = '<p>Your pet. Your fight. Tap a fighter to face ' + name(Z) + '.</p><label for="huntSearch">Find by name or pet number</label><input id="huntSearch" type="search" autocomplete="off" placeholder="Name or #number"><p class="small">Strongest first · suggested is not selected</p><div id="huntResults"></div>';
      var inp = d.querySelector('#huntSearch'); inp.value = query;
      inp.oninput = function () { query = inp.value; page = 0; list(); }; list();
    }
    function list() {
      var q = query.trim().toLowerCase(), filtered = rows.filter(function (r) { return !q || (/^#?\d+$/.test(q) ? String(r.p.id) === q.replace(/^#/, '') : r.search.indexOf(q) >= 0); }), pages = Math.max(1, Math.ceil(filtered.length / size));
      page = Math.max(0, Math.min(page, pages - 1));
      var el = d.querySelector('#huntResults');
      if (c.pending && !query && !rows.length) { el.innerHTML = '<p class="small" role="status">Loading your pets…</p>'; return; }
      var note = c.pending ? '<p class="small" role="status">Loading the rest of your pets…</p>' : '';
      el.innerHTML = note + '<p class="small" role="status">' + filtered.length.toLocaleString() + ' pets · Page ' + (page + 1) + ' of ' + pages + '</p><div class="hunt-grid">' + filtered.slice(page*size, (page+1)*size).map(function (r) {
        return '<button type="button" class="hunt-card' + (r === best ? ' suggested' : '') + '" data-pick="' + r.p.id + '"' + (r.why ? ' disabled' : '') + '>' + (r === best ? '<b class="hunt-badge">★ SUGGESTED</b>' : '') + sprite(r.p) + '<strong>' + name(r.p) + '</strong><span>⚡ ' + Math.round(r.power * 100) / 100 + ' power</span><small>' + (r.why ? esc(r.why) : 'Ready to hunt') + '</small></button>';
      }).join('') + '</div>' + (!filtered.length ? '<p>No pets match. Try another name or number.</p>' : '') + '<nav aria-label="Hunter pages"><button type="button" class="btn" data-prev' + (!page ? ' disabled' : '') + '>◀ Previous</button><button type="button" class="btn" data-next' + (page+1 >= pages ? ' disabled' : '') + '>Next ▶</button></nav>';
      el.querySelector('[data-prev]').onclick = function () { page--; list(); d.scrollTop = 0; el.querySelector('[data-prev]').focus(); };
      el.querySelector('[data-next]').onclick = function () { page++; list(); d.scrollTop = 0; el.querySelector('[data-next]').focus(); };
      el.querySelectorAll('[data-pick]').forEach(function (bt) { bt.onclick = function () { var p = w.byId[+bt.dataset.pick], why = V.cemHuntWhy(w, p.id, Z.id, c.me, c.block); if (why) { bt.disabled = true; return; } chosen = p; versus(); }; }); paint();
    }
    function stats(p, label) { var mult = revised ? (p.id === Z.id ? 0.9 : 1 + V.huntQuote(w, p.id, Z.id, c.block).bonus / 100) : 1; return '<article class="hunt-side"><b>' + label + '</b>' + sprite(p) + '<h3>' + name(p) + '</h3><strong>⚡ ' + Math.round(V.petPower(p) * mult * 100) / 100 + ' fight power</strong><dl>' + keys.map(function (k) { return '<div><dt>' + k[0].toUpperCase()+k.slice(1) + '</dt><dd>' + esc(Math.round(((p.stats || {})[k] || 0) * mult * 100) / 100) + '</dd></div>'; }).join('') + '</dl></article>'; }
    function versus() {
      shell('⚔️ Face the feral');
      var plan = V.cemHuntPlan(w, chosen.id, Z.id, c.block);
      plan.label = 'Hunt with ' + (chosen.name || 'Pet') + ' #' + chosen.id + ' against ' + (Z.name || 'Zombie') + ' #' + Z.id + ' · ' + plan.amount + ' XCPETS';
      d.querySelector('#huntBody').innerHTML = '<div class="hunt-versus">' + stats(chosen, 'YOUR HUNTER') + '<b class="hunt-vs">VS</b>' + stats(Z, 'FERAL ZOMBIE') + '</div><p>' + (revised ? 'Win: capture this zombie and feed it. Lose: no new black eye; +5% Grudge (up to +15%) and a quarter of this burn as rematch credit, for 432 blocks. Feral fights at 90% power. Your Grudge: +' + plan.grudge + '%. Credit used: ' + plan.credit + ' XCPETS. One fight per pet per chain day.' : 'A win lays the zombie to rest. A loss gives your hunter a black eye for 72 blocks. One fight per pet per chain day.') + '</p><p><b>Hunter: ' + name(chosen) + '</b><br>Burn: ' + esc(plan.amount) + ' XCPETS · wallet confirmation comes next.</p><p class="small" id="huntError" role="alert"></p><footer><button type="button" class="btn ghost" data-back>◀ Change hunter</button><button type="button" class="btn" data-ready>Continue with ' + name(chosen) + '</button></footer>';
      d.querySelector('[data-back]').onclick = pick;
      d.querySelector('[data-ready]').onclick = function () { if (!chosen) return; var why = V.cemHuntWhy(w, chosen.id, Z.id, c.me, c.block); if (why) { d.querySelector('#huntError').textContent = why; return; } var title = 'Hunt with ' + (chosen.name || 'Pet') + ' #' + chosen.id + ' against #' + Z.id + ' · ' + plan.amount + ' XCPETS'; close(); c.send([plan], title); }; paint(); d.querySelector('[data-back]').focus();
    }
    d._fill = function (pets, world) {
      c.pending = false;
      if (world) { w = world; if (world.byId && world.byId[c.zombie]) Z = world.byId[c.zombie]; }
      if (!Z) return;
      build(pets);
      if (d.isConnected) { if (window.V2Pick) pick(); else if (!chosen) { page = 0; list(); } }
    };
    document.body.appendChild(d); pick(); d.showModal();
  }
  window.V2HuntPicker = { open: open };
})();
