/* XCPETS shared in-place picker (2026-10-19, owner 7:32/7:35 PM CT). No pop-up, no flat scroll: search (name or #ID), toggle chips (species,
 * tier, Mine / Others, Hybrid), sort (Pet Score, power, newest), one-tap "Mine first", a match count and a paged row (~8 per page, arrows +
 * swipe). Works on any records that carry pets: rec = { key, pets: [pet...], newest: number, html: fn(rec) -> chip HTML }.
 * Optional: opt.cls = extra class on the box; sort 'rarity' (tier, then Pet Score); opt.dir = show a High→Low / Low→High toggle (2026-10-19 breed-picker-fix).
 * Pure UI: reads the replayed world only, changes nothing. */
(function () {
  'use strict';
  /* power-tooltip-values (Oct 25 2026, display only): hovers show the pet's real numbers (js/v2-power-tip.js) */
  function ptA(p) { return window.V2PowerTip ? V2PowerTip.attr(V2PowerTip.power(p)) : ''; } 
  var TIERS = ['Common', 'Uncommon', 'Rare', 'Legendary'];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pow(p) { var s = p.stats || {}, t = 0; for (var k in s) t += +s[k] || 0; return t; }
  function score(w, p) { var s = window.PetScore && PetScore.of(w, p); return s ? s.score : 0; }
  /* wiz-display-fix (Oct 20 2026): species options show the player-facing name (Bitcoin Wizard, Lord Kek, KEVIN...), value stays the id */
  function spLabel(id) { try { return window.V2Rules && V2Rules.speciesLabel ? V2Rules.speciesLabel(id) : id; } catch (e) { return id; } }
  function isHyb(p) { return !!p.hybrid || /^hyb:/.test(String(p.species)) || !!(p.art && p.art.hybrid); }
  /** mount(el, opt): opt = { id, w, me, records: fn() -> recs, onPick: fn(rec), per: 8, sorts: ['score','power','newest'], title, selected: key } */
  function mount(el, opt) { if (!el) return; var st = el.__pk || (el.__pk = { q: '', sp: '', tier: -1, who: '', hyb: false, sort: (opt.sorts || ['score'])[0], mineFirst: false, page: 0 });
    var PS = window.V2PetSort, XS = PS ? ['vigor', 'spark', 'grit', 'zoom', 'luck', 'wins', 'gear', 'name'] : [], sorts = (opt.sorts || ['score', 'power', 'newest']).concat(XS.filter(function (k) { return (opt.sorts || []).indexOf(k) < 0; })), per = opt.per || 8, w = opt.w, me = opt.me;
    var LSK = 'xcpets-pk-sort-' + (opt.id || opt.cls || el.id || 'pk'); if (!st.__ls) { st.__ls = 1; try { var sv = localStorage.getItem(LSK); if (sv && sorts.indexOf(sv) >= 0) st.sort = sv; } catch (e) { } } /* pet-sort: remember the picker sort in this browser */
    var all = opt.records(), sp = {}; all.forEach(function (r) { r.pets.forEach(function (p) { if (!isHyb(p)) sp[p.species] = 1; }); });
    function hit(r) { var q = st.q.trim().toLowerCase().replace(/^#/, '');
      return r.pets.some(function (p) { return (!q || String(p.id) === q || String(p.name || '').toLowerCase().indexOf(q) >= 0) && (!st.sp || p.species === st.sp) && (st.tier < 0 || p.tier === st.tier) &&
        (!st.who || (st.who === 'mine' ? p.owner === me : p.owner !== me)) && (!st.hyb || isHyb(p)); }); }
    var L = all.filter(hit), key = function (r) { var p = r.pets[0]; return st.sort === 'power' ? -Math.max.apply(null, r.pets.map(pow)) : st.sort === 'newest' ? -(r.newest || 0) : st.sort === 'rarity' ? -Math.max.apply(null, r.pets.map(function (p) { return (p.tier || 0) * 1e4 + score(w, p); })) : -Math.max.apply(null, r.pets.map(function (p) { return score(w, p); })); };
    var key1 = key; key = function (r) { if (PS && XS.indexOf(st.sort) >= 0 && st.sort !== 'name') { var k = PS.key(st.sort, w); return -Math.max.apply(null, r.pets.map(k)); } return key1(r); }; /* pet-sort: stat / wins / gear high-first */
    var KC = new Map(), key0 = key; key = function (r) { var v = KC.get(r); if (v === undefined) { v = key0(r); KC.set(r, v); } return v; }; /* lair-perf: each sort key worked out once per record, not per comparison */
    var nmK = function (r) { return String((r.pets[0] || {}).name || '').toLowerCase(); }; if (st.sort === 'name') key = function () { return 0; };
    L.sort(function (a, b) { if (st.sort === 'name') { var na = nmK(a), nb = nmK(b); if (na !== nb) return (st.asc ? -1 : 1) * (na < nb ? -1 : 1); } var ma = st.mineFirst && a.pets.some(function (p) { return p.owner === me; }) ? 0 : 1, mb = st.mineFirst && b.pets.some(function (p) { return p.owner === me; }) ? 0 : 1; return ma - mb || (st.asc ? -1 : 1) * (key(a) - key(b)) || (a.newest || 0) - (b.newest || 0); });
    var pages = Math.max(1, Math.ceil(L.length / per)); st.page = Math.min(st.page, pages - 1); var view = L.slice(st.page * per, st.page * per + per);
    var chip = function (k, v, on, label) { return '<button type="button" class="pk-chip' + (on ? ' on' : '') + '" data-k="' + k + '" data-v="' + esc(v) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + label + '</button>'; };
    el.innerHTML = '<div class="pk' + (opt.cls ? ' ' + esc(opt.cls) : '') + '"><div class="pk-top"><input type="search" class="pk-q" placeholder="Name or #ID" aria-label="Search by pet name or #ID" value="' + esc(st.q) + '">' +
      '<select class="pk-sp" aria-label="Species"><option value="">All species</option>' + Object.keys(sp).sort(function (a, b) { return spLabel(a).toLowerCase() < spLabel(b).toLowerCase() ? -1 : 1; }).map(function (s) { return '<option value="' + esc(s) + '"' + (st.sp === s ? ' selected' : '') + '>' + esc(spLabel(s)) + '</option>'; }).join('') + '</select>' +
      '<select class="pk-sort" aria-label="Sort">' + sorts.map(function (s) { return '<option value="' + s + '"' + (st.sort === s ? ' selected' : '') + '>' + ({ score: '⭐ Pet Score', rarity: '💎 Rarity', power: '⚡ Power', newest: '🆕 Newest', vigor: '💪 Most Vigor', spark: '✨ Most Spark', grit: '🪨 Most Grit', zoom: '💨 Most Zoom', luck: '🍀 Most Luck', wins: '🏆 Most wins', gear: '🎽 Most gear', name: '🔤 Name A-Z' }[s] || s) + '</option>'; }).join('') + '</select>' +
      (opt.dir ? '<button type="button" class="pk-dir" aria-label="Sort direction: ' + (st.asc ? 'low to high' : 'high to low') + '">' + (st.asc ? '↑ Low→High' : '↓ High→Low') + '</button>' : '') + '<span class="pk-n" aria-live="polite">' + L.length + ' match' + (L.length === 1 ? '' : 'es') + '</span></div>' +
      '<div class="pk-chips">' + (opt.noWho ? '' : chip('who', 'mine', st.who === 'mine', (opt.labels && opt.labels.mine) || 'Mine') + chip('who', 'others', st.who === 'others', (opt.labels && opt.labels.others) || 'Others')) + chip('hyb', '1', st.hyb, '🧬 Hybrid') +
      TIERS.map(function (t, i) { return chip('tier', i, st.tier === i, t); }).join('') + (opt.noWho ? '' : chip('mf', '1', st.mineFirst, '⬆ ' + ((opt.labels && opt.labels.mineFirst) || 'Mine first'))) + '</div>' +
      '<div class="pk-row"><button type="button" class="pk-arr" data-p="-1" aria-label="Previous page"' + (st.page ? '' : ' disabled') + '>◀</button><div class="pk-keys">' +
      (view.map(function (r) { return '<button type="button" class="pk-key' + (opt.selected === r.key ? ' sel' : '') + '" data-key="' + esc(r.key) + '"' + '>' + r.html(r, st.sort) + '</button>'; }).join('') || (opt.empty ? opt.empty(st) : '') || '<span class="pk-none">No matches</span>') +
      '</div><button type="button" class="pk-arr" data-p="1" aria-label="Next page"' + (st.page < pages - 1 ? '' : ' disabled') + '>▶</button></div><div class="pk-pg">' + (st.page + 1) + ' / ' + pages + '</div></div>';
    var re = function () { mount(el, opt); }, q = el.querySelector('.pk-q');
    q.oninput = function () { st.q = q.value; st.page = 0; var pos = q.selectionStart; re(); var q2 = el.querySelector('.pk-q'); q2.focus(); try { q2.setSelectionRange(pos, pos); } catch (e) { } };
    var dirB = el.querySelector('.pk-dir'); if (dirB) dirB.onclick = function () { st.asc = !st.asc; st.page = 0; re(); };
    el.querySelector('.pk-sp').onchange = function () { st.sp = this.value; st.page = 0; re(); }; el.querySelector('.pk-sort').onchange = function () { st.sort = this.value; try { localStorage.setItem(LSK, st.sort); } catch (e) { } st.page = 0; re(); };
    el.querySelectorAll('.pk-chip').forEach(function (b) { b.onclick = function () { var k = b.dataset.k, v = b.dataset.v; if (k === 'who') st.who = st.who === v ? '' : v; else if (k === 'hyb') st.hyb = !st.hyb; else if (k === 'mf') st.mineFirst = !st.mineFirst; else if (k === 'tier') st.tier = st.tier === +v ? -1 : +v; st.page = 0; re(); }; });
    el.querySelectorAll('.pk-arr').forEach(function (b) { b.onclick = function () { st.page += +b.dataset.p; re(); }; });
    el.querySelectorAll('.pk-key').forEach(function (b) { b.onclick = function () { var r = L.filter(function (x) { return String(x.key) === b.dataset.key; })[0]; if (r && opt.onPick) opt.onPick(r); }; });
    var row = el.querySelector('.pk-keys'), x0 = null; row.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    row.addEventListener('touchend', function (e) { if (x0 == null) return; var dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 40) { st.page = Math.max(0, Math.min(pages - 1, st.page + (dx < 0 ? 1 : -1))); re(); } }, { passive: true });
    return { matches: L.length, pages: pages }; }
  /* fix-display-mismatch (Oct 20 2026, display only): the chip number follows the sort (Pet Score / Rarity -> ⭐ score, Power / Newest -> ⚡ power) */
  function stat(w, p, sort) { return (sort === 'score' || sort === 'rarity') && window.PetScore ? '⭐' + score(w, p) : '<span' + ptA(p) + '>⚡' + pow(p) + '</span>'; }
  function petChip(w) { return function (r, sort) { var p = r.pets[0]; return '<b>#' + p.id + '</b><span>' + esc(String(p.name || '').slice(0, 10)) + '</span><small>' + esc((p.resurrected ? 'God' : TIERS[p.tier]) || '') + ' · ' + stat(w, p, sort) + '</small>'; }; }
  var CSS = '.pk{border:2px solid #4b3f7a;background:#120e22;padding:6px;margin:6px 0}.pk-top{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.pk-q{flex:1 1 140px;min-width:0}.pk-top select{max-width:46%}' +
    '.pk-n{font-family:"Press Start 2P",monospace;font-size:9px;color:#ffd166}.pk-chips{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0}.pk-chip{font-size:12px;padding:3px 8px;border:2px solid #4b3f7a;background:#1b1530;color:#eee;border-radius:0;cursor:pointer}' +
    '.pk-chip.on{background:#ffd166;color:#140f24;border-color:#000}.pk-row{display:flex;align-items:stretch;gap:4px}.pk-arr{flex:0 0 30px;font-size:14px;background:#2b2350;color:#ffd166;border:2px solid #000;cursor:pointer}.pk-arr[disabled]{opacity:.35}' +
    '.pk-keys{flex:1;display:grid;grid-template-columns:repeat(4,1fr);gap:4px;min-width:0}.pk-key{display:flex;flex-direction:column;align-items:center;gap:1px;padding:4px 2px;background:#2a1d14;border:2px solid #7a4f2a;color:#ffd166;cursor:pointer;min-width:0;box-shadow:2px 2px 0 #000}' +
    '.pk-key b{font-family:"Press Start 2P",monospace;font-size:9px}.pk-key span{font-size:12px;color:#eee;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pk-key small{font-size:10px;color:#9fe8ff}.pk-key.sel{background:#ffd166;color:#140f24}.pk-key.sel span,.pk-key.sel small{color:#140f24}' +
    '.pk-dir{font-size:12px;padding:3px 8px;border:2px solid #4b3f7a;background:#1b1530;color:#ffd166;border-radius:0;cursor:pointer;white-space:nowrap}.pk-key.no{opacity:.6;cursor:not-allowed}.pk-key.no:hover{transform:none}.pk-none{grid-column:1/-1;text-align:center;color:#9fe8ff;padding:8px}.pk-pg{text-align:center;font-size:11px;color:#9fe8ff;margin-top:2px}@media (max-width:520px){.pk-keys{grid-template-columns:repeat(2,1fr)}}';
  if (typeof document !== 'undefined' && !document.getElementById('pkCss')) { var s = document.createElement('style'); s.id = 'pkCss'; s.textContent = CSS; (document.head || document.documentElement).appendChild(s); }
  window.V2Picker = { mount: mount, petChip: petChip, stat: stat, pow: pow, isHyb: isHyb };
})();
