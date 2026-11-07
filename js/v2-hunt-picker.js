/* UI only. A suggestion is never a selection; the existing rule validator is authoritative. */
(function () {
  'use strict';
  var keys = ['vigor', 'spark', 'grit', 'zoom', 'luck'];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function open(c) {
    var prior = document.getElementById('huntPicker'); if (prior) prior.close();
    var V = c.V, w = c.w, Z = w.byId[c.zombie], focus = document.activeElement, page = 0, query = '', chosen = null, size = 24;
    var d = document.createElement('dialog'); d.id = 'huntPicker'; d.className = 'hunt-picker'; d.setAttribute('aria-labelledby', 'huntTitle');
    var rows = c.pets.map(function (p) { var why = V.cemHuntWhy(w, p.id, Z.id, c.me, c.block); return {p:p, why:why, power:V.petPower(p), search:((p.name || '') + ' #' + p.id).toLowerCase()}; });
    rows.sort(function (a,b) { return b.power - a.power || a.p.id - b.p.id; });
    var best = rows.filter(function (r) { return !r.why; })[0];
    function close() { d.close(); }
    d.addEventListener('close', function () { d.remove(); if (focus && focus.isConnected) focus.focus(); });
    function name(p) { return esc(p.name || 'Pet') + ' #' + p.id; }
    function sprite(p) { return '<canvas width="32" height="32" data-hsprite="' + p.id + '" aria-label="' + name(p) + '"></canvas>'; }
    function paint() { d.querySelectorAll('[data-hsprite]').forEach(function (el) { var p = w.byId[+el.dataset.hsprite]; if (p && p.art && c.R.lazy) c.R.lazy(el, function () { return c.R.petFrames ? c.R.petFrames(p, w) : c.R.framesWith(p.art, p.stage, []); }, true); }); }
    function shell(title) { d.innerHTML = '<header><h2 id="huntTitle">' + title + '</h2><button type="button" class="q" data-close aria-label="Close hunter picker">✕</button></header><div id="huntBody"></div>'; d.querySelector('[data-close]').onclick = close; }
    function pick() {
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
      el.innerHTML = '<p class="small" role="status">' + filtered.length.toLocaleString() + ' pets · Page ' + (page + 1) + ' of ' + pages + '</p><div class="hunt-grid">' + filtered.slice(page*size, (page+1)*size).map(function (r) {
        return '<button type="button" class="hunt-card' + (r === best ? ' suggested' : '') + '" data-pick="' + r.p.id + '"' + (r.why ? ' disabled' : '') + '>' + (r === best ? '<b class="hunt-badge">★ SUGGESTED</b>' : '') + sprite(r.p) + '<strong>' + name(r.p) + '</strong><span>⚡ ' + r.power + ' power</span><small>' + (r.why ? esc(r.why) : 'Ready to hunt') + '</small></button>';
      }).join('') + '</div>' + (!filtered.length ? '<p>No pets match. Try another name or number.</p>' : '') + '<nav aria-label="Hunter pages"><button type="button" class="btn" data-prev' + (!page ? ' disabled' : '') + '>◀ Previous</button><button type="button" class="btn" data-next' + (page+1 >= pages ? ' disabled' : '') + '>Next ▶</button></nav>';
      el.querySelector('[data-prev]').onclick = function () { page--; list(); d.scrollTop = 0; el.querySelector('[data-prev]').focus(); };
      el.querySelector('[data-next]').onclick = function () { page++; list(); d.scrollTop = 0; el.querySelector('[data-next]').focus(); };
      el.querySelectorAll('[data-pick]').forEach(function (bt) { bt.onclick = function () { var p = w.byId[+bt.dataset.pick], why = V.cemHuntWhy(w, p.id, Z.id, c.me, c.block); if (why) { bt.disabled = true; return; } chosen = p; versus(); }; }); paint();
    }
    function stats(p, label) { return '<article class="hunt-side"><b>' + label + '</b>' + sprite(p) + '<h3>' + name(p) + '</h3><strong>⚡ ' + V.petPower(p) + ' power</strong><dl>' + keys.map(function (k) { return '<div><dt>' + k[0].toUpperCase()+k.slice(1) + '</dt><dd>' + esc((p.stats || {})[k] || 0) + '</dd></div>'; }).join('') + '</dl></article>'; }
    function versus() {
      shell('⚔️ Face the feral');
      var plan = V.cemHuntPlan(w, chosen.id, Z.id, c.block);
      plan.label = 'Hunt with ' + (chosen.name || 'Pet') + ' #' + chosen.id + ' against ' + (Z.name || 'Zombie') + ' #' + Z.id + ' · ' + plan.amount + ' XCPETS';
      d.querySelector('#huntBody').innerHTML = '<div class="hunt-versus">' + stats(chosen, 'YOUR HUNTER') + '<b class="hunt-vs">VS</b>' + stats(Z, 'FERAL ZOMBIE') + '</div><p>A win lays the zombie to rest. A loss gives your hunter a black eye for 72 blocks. One fight per pet per chain day.</p><p><b>Hunter: ' + name(chosen) + '</b><br>Burn: ' + esc(plan.amount) + ' XCPETS · wallet confirmation comes next.</p><p class="small" id="huntError" role="alert"></p><footer><button type="button" class="btn ghost" data-back>◀ Change hunter</button><button type="button" class="btn" data-ready>Continue with ' + name(chosen) + '</button></footer>';
      d.querySelector('[data-back]').onclick = pick;
      d.querySelector('[data-ready]').onclick = function () { if (!chosen) return; var why = V.cemHuntWhy(w, chosen.id, Z.id, c.me, c.block); if (why) { d.querySelector('#huntError').textContent = why; return; } var title = 'Hunt with ' + (chosen.name || 'Pet') + ' #' + chosen.id + ' against #' + Z.id + ' · ' + plan.amount + ' XCPETS'; close(); c.send([plan], title); }; paint(); d.querySelector('[data-back]').focus();
    }
    document.body.appendChild(d); pick(); d.showModal();
  }
  window.V2HuntPicker = { open: open };
})();
