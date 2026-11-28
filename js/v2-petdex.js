/* XCPETS PETDEX (Nov 23 2026, owner "who does it best" list, item 4: "a Petdex of every species, rarity and hybrid, with silhouettes for
 * the ones you don't have yet; finishing a row earns a badge"). DISPLAY ONLY: reads the page's world, never changes it, nothing is signed.
 *   Species rows   every main species (PetCore.SPECIES) x Common / Uncommon / Rare / Legendary / Mythic. A cell is shown only when at
 *                  least one pet like it exists on chain, so every square can really be collected. Own one now (alive) = caught.
 *                  Catching every square of a row = MASTERED stamp on that row.
 *   Legends        the special species (Bitcoin Wizard, Lord Kek, FUNTRUMP, Homer, DJ Pepe, 1 of 1s...): one square each, any rarity.
 *   Hybrids        every hybrid bred so far (2-way and 3-way), rarest last. Counted on their own (Hybrid Hunter), not in the Petdex score.
 * Missing squares show a black silhouette of a real pet of that kind. Tap any square for how many exist and how to get one.
 * "Share" copies a Wordle-style square grid (no address, no name). Lives on petdex.html (?tab=legends|hybrids); the Today card on Play links there.
 * On that page only, a view-only world reads every living pet once (V2Split.loadBoard, view/rank.json, as Rankings and Hybrids do).
 * compute(w, me) is pure and node-testable (tools/petdex-test.js). */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.V2Petdex = api;
  if (root && root.document) api.start();
})(typeof window !== 'undefined' ? window : this, function (root) {
  'use strict';
  var COLS = [
    { k: 0, name: 'Common', short: 'C', col: '#a7adb5' },
    { k: 1, name: 'Uncommon', short: 'U', col: '#55c35a' },
    { k: 2, name: 'Rare', short: 'R', col: '#3d8bff' },
    { k: 3, name: 'Legendary', short: 'L', col: '#ffb300' },
    { k: 'M', name: 'Mythic', short: 'M', col: '#b46cff' }
  ];
  var RANKS = [[100, 'PETDEX GOD'], [90, 'Professor Kek'], [70, 'Gotta Burn Em All'], [50, 'Dex Degen'], [30, 'Collector'], [10, 'Pet Curious'], [0, 'Egg Sniffer']];
  function isHyb(sp) { sp = String(sp || ''); return sp.indexOf('hyb:') === 0 || sp.indexOf('hyb3:') === 0; }
  function colOf(p) { return (p.stage | 0) >= 5 ? 'M' : (p.tier | 0); }
  function counts(p) { return p && p.owner && !p.released && !p.community && !(p.art && p.art.community) && p.species; }
  function mainIds() { var PC = root && (root.GenPetCore || root.PetCore); var L = PC && PC.SPECIES ? PC.SPECIES.map(function (s) { return s.id; }) : null;
    return L && L.length ? L : ['pepe', 'wojak', 'chud', 'chad', 'peepo', 'doge', 'bobo', 'mumu', 'sarutobi', 'lenny', 'snibby', 'kevin', 'dodo', 'nakamoto']; }
  function label(sp) { var V = root && root.V2Rules; var s = sp; try { if (V && V.speciesLabel) s = V.speciesLabel(sp); } catch (e) { } return String(s).replace(/ \(hybrid\)$/, ''); }
  function rankOf(pct) { for (var i = 0; i < RANKS.length; i++) if (pct >= RANKS[i][0]) return RANKS[i][1]; return RANKS[RANKS.length - 1][1]; }

  /** compute(w, me) -> { rows, legends, hybrids, got, total, pct, rank, mastered }. Pure. */
  function compute(w, me, mainList) {
    var MAIN = mainList || mainIds(), isMain = {}; MAIN.forEach(function (s) { isMain[s] = 1; });
    var cells = {}, legend = {}, hyb = {}, pets = (w && w.pets) || [];
    for (var i = 0; i < pets.length; i++) { var p = pets[i]; if (!counts(p)) continue;
      var sp = p.species, mine = !!me && p.owner === me && !p.dead, bucket, key;
      if (isHyb(sp)) { bucket = hyb; key = sp; }
      else if (isMain[sp]) { bucket = cells; key = sp + '|' + colOf(p); }
      else { bucket = legend; key = sp; }
      var c = bucket[key] || (bucket[key] = { n: 0, owners: {}, mine: 0, sample: null, best: null });
      c.n++; c.owners[p.owner] = 1; if (!c.sample || (!p.dead && c.sample.dead)) c.sample = p;
      if (mine) { c.mine++; if (!c.best || (p.tier | 0) > (c.best.tier | 0) || ((p.stage | 0) > (c.best.stage | 0))) c.best = p; } }
    function fin(c) { c.players = Object.keys(c.owners).length; delete c.owners; return c; }
    var got = 0, total = 0, mastered = [];
    var rows = MAIN.map(function (sp) {
      var r = { sp: sp, name: label(sp), cells: COLS.map(function (col) { var c = cells[sp + '|' + col.k]; return c ? Object.assign(fin(c), { col: col.k }) : null; }) };
      r.have = r.cells.filter(function (c) { return c && c.mine; }).length; r.of = r.cells.filter(Boolean).length;
      r.done = r.of > 0 && r.have === r.of; if (r.done) mastered.push(sp); got += r.have; total += r.of; return r;
    }).filter(function (r) { return r.of > 0; });
    function list(B) { return Object.keys(B).map(function (sp) { return Object.assign(fin(B[sp]), { sp: sp, name: label(sp) }); })
      .sort(function (a, b) { return (b.mine ? 1 : 0) - (a.mine ? 1 : 0) || b.n - a.n || (a.name < b.name ? -1 : 1); }); }
    var legends = list(legend), hybrids = list(hyb);
    var lg = legends.filter(function (c) { return c.mine; }).length, hg = hybrids.filter(function (c) { return c.mine; }).length;
    got += lg; total += legends.length; /* the score is species + legends; hybrids are their own side quest (126+ mixes, many 1 of 1) */
    var pct = total ? Math.floor(got * 100 / total) : 0;
    return { rows: rows, legends: legends, hybrids: hybrids, got: got, total: total, pct: pct, rank: rankOf(pct), mastered: mastered,
      species: { got: rows.reduce(function (a, r) { return a + r.have; }, 0), of: rows.reduce(function (a, r) { return a + r.of; }, 0) },
      legendGot: lg, hybridGot: hg };
  }
  /** shareText(dex): Wordle-style grid. No address, no name. */
  function shareText(dex) {
    var sq = { 0: '⬜', 1: '🟩', 2: '🟦', 3: '🟨', M: '🟪' };
    var lines = dex.rows.map(function (r) { return r.cells.filter(Boolean).map(function (c) { return c.mine ? sq[c.col] : '⬛'; }).join('') + (r.done ? ' ⭐' : ''); });
    return '📖 My XCPETS Petdex: ' + dex.got + '/' + dex.total + ' (' + dex.pct + '%) · ' + dex.rank + '\n' + lines.join('\n') +
      '\nLegends ' + dex.legendGot + '/' + dex.legends.length + ' · Hybrids ' + dex.hybridGot + '/' + dex.hybrids.length + '\nxcpets.fun';
  }

  /* ---------------------------------------------------------------- page */
  var d = root && root.document, el = null, dexNow = null, wNow = null, tab = 'species', obs = null;
  function $(id) { return d.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return Number(n).toLocaleString('en-US'); }
  function world() { try { return (root.V2Mock && root.V2Mock.world && root.V2Mock.world()) || (root.V2UI && root.V2UI.world) || null; } catch (e) { return null; } }
  function me() { try { return (root.V2UI && root.V2UI.ME) || (root.V2Mock && root.V2Mock.ME) || localStorage.getItem('xcpets-v2-me') || ''; } catch (e) { return ''; } }
  function css() { if ($('pdxCss')) return; var s = d.createElement('style'); s.id = 'pdxCss'; s.textContent =
    '#petdex{position:fixed;inset:0;z-index:100009;background:rgba(10,8,20,.82);display:flex;align-items:flex-start;justify-content:center;overflow:auto;-webkit-overflow-scrolling:touch;padding:14px 10px 40px}' +
    '#petdex[hidden]{display:none}#petdex.pdx-page{position:static;inset:auto;z-index:auto;background:none;padding:0;overflow:visible}#petdex.pdx-page .pdx-x{display:none}#petdex.pdx-page .pdx{max-width:900px;margin:0 auto}' +
    '#petdex .pdx{position:relative;width:100%;max-width:760px;background:#fff8dc;color:#2b2b2b;border:4px solid #2b2b2b;border-radius:14px;box-shadow:0 6px 0 #2b2b2b;padding:14px 12px 18px;font-family:"Comic Neue",var(--comic,sans-serif)}' +
    '#petdex h2{font:28px/1 Bangers,var(--meme,Impact),sans-serif;letter-spacing:1px;margin:0 40px 6px 0;color:#2b2b2b;text-shadow:2px 2px 0 #ffe27a}' +
    '#petdex .pdx-x{position:absolute;top:8px;right:8px;width:38px;height:38px;border:3px solid #2b2b2b;border-radius:10px;background:#ff6b6b;color:#fff;font:18px "Press Start 2P",monospace;cursor:pointer;box-shadow:0 3px 0 #2b2b2b}' +
    '#petdex .pdx-top{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;margin:4px 0 10px}' +
    '#petdex .pdx-score{font:14px "Press Start 2P",monospace}#petdex .pdx-rank{font:20px Bangers,Impact,sans-serif;letter-spacing:1px;background:#2b2b2b;color:#ffe27a;padding:4px 10px;border-radius:8px;transform:rotate(-2deg)}' +
    '#petdex .pdx-bar{flex:1 1 100%;height:16px;border:3px solid #2b2b2b;border-radius:8px;background:#fff;overflow:hidden}#petdex .pdx-bar i{display:block;height:100%;background:repeating-linear-gradient(90deg,#55c35a 0 8px,#4aa84f 8px 16px);transition:width .6s steps(12)}' +
    '#petdex .pdx-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 10px}#petdex .pdx-tabs button{font:11px/1.4 "Press Start 2P",monospace;padding:8px 10px;border:3px solid #2b2b2b;border-radius:10px;background:#fff;color:#2b2b2b;cursor:pointer;box-shadow:0 3px 0 #2b2b2b}' +
    '#petdex .pdx-tabs button[aria-pressed=true]{background:#ffe27a}#petdex .pdx-share{margin-left:auto;background:#7ad7ff!important}' +
    '#petdex .pdx-head,#petdex .pdx-row{display:grid;grid-template-columns:minmax(78px,1.2fr) repeat(5,minmax(44px,92px));gap:6px;align-items:center}' +
    '#petdex .pdx-head{font:10px "Press Start 2P",monospace;text-align:center;margin-bottom:4px}#petdex .pdx-head span:first-child{text-align:left}' +
    '#petdex .pdx-row{padding:5px;border-radius:10px;margin-bottom:4px}#petdex .pdx-row.done{background:linear-gradient(90deg,#ffe27a,#fff1a8);box-shadow:inset 0 0 0 3px #2b2b2b}' +
    '#petdex .pdx-nm{font:18px/1 Bangers,Impact,sans-serif;letter-spacing:.5px;display:flex;flex-direction:column;gap:3px}#petdex .pdx-nm small{font:10px "Press Start 2P",monospace;opacity:.75}' +
    '#petdex .pdx-stamp{font:11px Bangers,Impact,sans-serif;letter-spacing:1px;color:#fff;background:#e11d2e;border:2px solid #2b2b2b;border-radius:6px;padding:1px 5px;transform:rotate(-6deg);align-self:flex-start;animation:pdxStamp .5s steps(4) both}' +
    '@keyframes pdxStamp{0%{transform:scale(2.4) rotate(-14deg);opacity:0}100%{transform:scale(1) rotate(-6deg);opacity:1}}' +
    '#petdex .pdx-c{position:relative;aspect-ratio:1;border:3px solid var(--rc);border-radius:10px;background:#fff;cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center;overflow:hidden}' +
    '#petdex .pdx-c canvas{width:84%;height:84%;image-rendering:pixelated}' +
    '#petdex .pdx-c.got{background:radial-gradient(circle,#fff 40%,color-mix(in srgb,var(--rc) 35%,#fff))}#petdex .pdx-c.got::after{content:"\\2713";position:absolute;right:2px;bottom:0;font:10px "Press Start 2P",monospace;color:#2b2b2b}' +
    '#petdex .pdx-c.miss{background:#e9e4d0;border-style:dashed}#petdex .pdx-c.miss canvas{opacity:.85}' +
    '#petdex .pdx-c.none{visibility:hidden}#petdex .pdx-c b{position:absolute;left:3px;top:2px;font:8px "Press Start 2P",monospace;color:#2b2b2b;opacity:.7}' +
    '#petdex .pdx-c.solo b{opacity:1;color:#e11d2e}' +
    '#petdex .pdx-c:active{transform:translateY(2px)}#petdex .pdx-c.pop{animation:pdxPop .35s steps(3)}@keyframes pdxPop{50%{transform:scale(1.15)}}' +
    '#petdex .pdx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(86px,1fr));gap:8px}' +
    '#petdex .pdx-card{display:flex;flex-direction:column;align-items:center;gap:4px;font:15px/1.05 Bangers,Impact,sans-serif;letter-spacing:.4px;text-align:center;min-width:0}#petdex .pdx-card span{max-width:100%;overflow-wrap:anywhere}' +
    '#petdex .pdx-card .pdx-c{width:100%}#petdex .pdx-card.miss span{opacity:.55}' +
    '#petdex .pdx-body{padding-bottom:6px}#petdex .pdx-tip{position:sticky;bottom:0;box-shadow:0 -8px 0 #fff8dc;margin-top:12px;background:#2b2b2b;color:#fff8dc;border-radius:10px;padding:10px 12px;font-size:14px;line-height:1.35;min-height:20px}' +
    '#petdex .pdx-tip b{color:#ffe27a}#petdex .pdx-note{font-size:13px;margin:0 0 8px;opacity:.85}' +
    '@media (max-width:520px){#petdex .pdx-head,#petdex .pdx-row{grid-template-columns:minmax(64px,1fr) repeat(5,minmax(36px,1fr));gap:4px}#petdex .pdx-nm{font-size:15px}#petdex h2{font-size:24px}#petdex .pdx-c{border-width:2px;border-radius:8px}' +
    '#petdex .pdx-stamp{font-size:9px;padding:1px 3px}#petdex .pdx-tabs button{font-size:9px;padding:7px 8px}#petdex .pdx-grid{grid-template-columns:repeat(auto-fill,minmax(72px,1fr))}#petdex .pdx-card{font-size:13px}}' +
    '@media (prefers-reduced-motion:reduce){#petdex .pdx-stamp,#petdex .pdx-c.pop{animation:none}#petdex .pdx-bar i{transition:none}}' +
    'body.pdx-open{overflow:hidden}' +
    '.td-dex{display:flex;align-items:center;gap:10px;width:100%;margin-top:10px;font:inherit;font-size:13px;text-align:left;color:inherit;cursor:pointer;padding:10px 12px;border:2px solid #2b2b2b;border-radius:10px;background:linear-gradient(90deg,rgba(180,108,255,.18),rgba(255,226,122,.18));box-shadow:0 3px 0 #2b2b2b}' +
    '.td-dex b{font:12px "Press Start 2P",monospace}.td-dex .td-go{margin-left:auto;white-space:nowrap;opacity:.85}';
    d.head.appendChild(s); }

  /* sprites: a real pet of that kind, drawn on a transparent background. Missing = solid silhouette. Drawn only when on screen. */
  function draw(c) { var x = CELLS[+c.getAttribute('data-pdx')]; if (!x) return; var p = x.mine ? x.best || x.sample : x.sample, w = wNow; if (p && !p.art && w && w.byId && w.byId[p.id]) p = w.byId[p.id]; c.__sil = !x.mine; if (!p || !w || !p.art) return; if (!root.V2Render || !root.V2Render.petFrames) { if ((c.__try = (c.__try || 0) + 1) < 40) setTimeout(function () { draw(c); }, 500); return; }
    try { var kp = Object.assign({}, p, { art: Object.assign({}, p.art, { background: 'solid', bgColor: '#ff00fe', pattern: 'none' }) }), f = root.V2Render.petFrames(kp, w, { noHunger: true })[0];
      if (!f || !f.data || f.data.length !== 4096) return; c.width = c.height = 32; var g = c.getContext('2d'), id = g.createImageData(32, 32), s = f.data, o = id.data, sil = !!c.__sil;
      for (var i = 0; i < 4096; i += 4) { var r = s[i], gg = s[i + 1], b = s[i + 2]; if (r > 200 && gg < 110 && b > 200 && r - gg > 120) { o[i + 3] = 0; continue; } /* magenta key, incl. the lighter backdrop texture */
        if (sil) { o[i] = 34; o[i + 1] = 30; o[i + 2] = 48; o[i + 3] = 255; } else { o[i] = r; o[i + 1] = gg; o[i + 2] = b; o[i + 3] = 255; } }
      g.putImageData(id, 0, 0); } catch (e) { } }
  /* screens (Nov 25 2026): a tall screen shows ~100 squares at once and drawing them all in one go froze the page for 3+ s
   * (tools/layout-check, tablet and desktop). Squares now draw in slices of ~12 ms, one slice per frame. */
  var drawQ = [], drawT = 0;
  function drawSoon(c) { drawQ.push(c); if (!drawT) drawT = (root.requestAnimationFrame || setTimeout)(drawRun); }
  function drawRun() { drawT = 0; var t0 = Date.now(); while (drawQ.length && Date.now() - t0 < 12) { var c = drawQ.shift(); if (c.isConnected) draw(c); }
    if (drawQ.length) drawT = (root.requestAnimationFrame || setTimeout)(drawRun); }
  /* board pets (view/rank.json) carry no art until V2Split.dress fetches it, the same way Rankings paints its sprites */
  function dressThen(cs) { var B = root.V2Split, ids = [], todo = [];
    cs.forEach(function (c) { var x = CELLS[+c.getAttribute('data-pdx')], p = x && (x.mine ? x.best || x.sample : x.sample); if (p && !p.art) { ids.push(p.id); todo.push(c); } });
    if (!ids.length || !B || !B.dress) return; B.dress(ids).then(function () { todo.forEach(function (c) { if (c.isConnected) drawSoon(c); }); }, function () { }); }
  function watch(scope) { var cs = scope.querySelectorAll('canvas[data-pdx]'); dressThen(Array.prototype.slice.call(cs));
    if (!('IntersectionObserver' in root)) { cs.forEach(draw); return; }
    if (!obs) obs = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { obs.unobserve(e.target); drawSoon(e.target); } }); }, { root: el, rootMargin: '200px' });
    cs.forEach(function (c) { obs.observe(c); }); }
  var CELLS = [];
  function cellHtml(c, col, tag) { if (!c) return '<span class="pdx-c none"></span>';
    var i = CELLS.push(c) - 1, rc = col ? col.col : '#2b2b2b', cls = c.mine ? 'got' : 'miss', solo = c.n === 1 ? ' solo' : '';
    return '<button type="button" class="pdx-c ' + cls + solo + '" style="--rc:' + rc + '" data-i="' + i + '" aria-label="' + esc((c.name || '') + ' ' + (col ? col.name : '') + (c.mine ? ', caught' : ', not caught yet')) + '">' +
      (tag ? '<b>' + tag + '</b>' : '') + '<canvas data-pdx="' + i + '" width="32" height="32"></canvas></button>'; }
  function GB() { return root.V2GearBook && root.V2Closet && root.V2Rules && root.V2Rules.catalogBySlot ? root.V2GearBook : null; }
  function body() { var x = dexNow; CELLS = [];
    if (tab === 'gear') return GB() ? GB().html(wNow, me()) : '<p class="pdx-note">Loading the gear list…</p>'; /* 🎽 Gear Collection book (js/v2-gearbook.js) */
    if (tab === 'species') return '<div class="pdx-head"><span></span>' + COLS.map(function (c) { return '<span style="color:' + c.col + ';text-shadow:1px 1px 0 #2b2b2b">' + c.short + '</span>'; }).join('') + '</div>' +
      x.rows.map(function (r) { return '<div class="pdx-row' + (r.done ? ' done' : '') + '"><span class="pdx-nm">' + esc(r.name) + '<small>' + r.have + '/' + r.of + '</small>' + (r.done ? '<span class="pdx-stamp">MASTERED</span>' : '') + '</span>' +
        r.cells.map(function (c, j) { if (c) c.name = r.name; return cellHtml(c, COLS[j], c && c.n === 1 ? '1!' : ''); }).join('') + '</div>'; }).join('');
    var L = tab === 'legends' ? x.legends : x.hybrids;
    if (!L.length) return '<p class="pdx-note">Nothing here yet.</p>';
    return '<p class="pdx-note">' + (tab === 'legends' ? 'Special pets: Wizards, Keks, FUNTRUMPs, Homers, DJs and the 1 of 1s. Any rarity counts.' : 'Every hybrid bred so far. Breed two different species for a shot at one. Rarest at the end.') + '</p>' +
      '<div class="pdx-grid">' + L.map(function (c) { return '<div class="pdx-card ' + (c.mine ? 'got' : 'miss') + '">' + cellHtml(c, c.mine ? { col: '#ffb300', name: '' } : null, c.n === 1 ? '1!' : '') + '<span>' + esc(c.name) + '</span></div>'; }).join('') + '</div>'; }
  function tipFor(c) { var col = COLS.filter(function (k) { return k.k === c.col; })[0];
    var what = esc(c.name) + (col ? ' <b>' + col.name + '</b>' : '');
    if (c.mine) return '✅ ' + what + ': you have <b>' + fmt(c.mine) + '</b>. ' + fmt(c.n) + ' exist' + (c.n === 1 ? 's' : '') + ' on chain' + (c.n === 1 ? '. The only one. Absolute flex.' : '.');
    var how = col && col.k === 'M' ? 'Raise one to Mythic (Road to Mythic on its pet page).' : isHyb(c.sp) ? 'Breed its parent species together, or find one for sale in Spam City.' : col ? 'Hatch eggs, breed, or find one for sale in Spam City.' : 'These are rare. Watch Spam City and the Telegram for one.';
    return '❓ ' + what + ': not yet. <b>' + fmt(c.n) + '</b> exist' + (c.n === 1 ? 's' : '') + ', held by ' + fmt(c.players) + ' player' + (c.players === 1 ? '' : 's') + '. ' + how; }
  var pKey = '', pTimer = 0, boardAsked = 0;
  function paint() { var w = world(), m = me(); if (!el) return; wNow = w; pKey = m + '|' + (w && w.tip) + '|' + (w && w.pets ? w.pets.length : 0) + '|' + (w && w._full ? 1 : 0) + (w && w._ranked ? 'r' : '') + '|' + (w && w.itemList ? w.itemList.length : 0);
    if (!pTimer) pTimer = setInterval(function () { if (!el || el.hidden) { clearInterval(pTimer); pTimer = 0; return; } var w2 = world(), k = me() + '|' + (w2 && w2.tip) + '|' + (w2 && w2.pets ? w2.pets.length : 0) + '|' + (w2 && w2._full ? 1 : 0) + (w2 && w2._ranked ? 'r' : '') + '|' + (w2 && w2.itemList ? w2.itemList.length : 0); if (k !== pKey) paint(); }, 2000); /* the world keeps loading */
    var box = el.querySelector('.pdx'); if (!w || !w.pets || !w.pets.length) { box.querySelector('.pdx-body').innerHTML = '<p class="pdx-note">' + (m ? 'Reading the chain… the Petdex opens once your pets have loaded.' : 'Connect your wallet at the top (or view any wallet) to open your Petdex: every species, rarity, legend and hybrid on chain, and which ones you have caught.') + '</p>'; return; }
    /* a view-only / fast world carries only this wallet's pets: read every living pet once (view/rank.json, the same file Rankings uses) so
     * "how many exist" and the silhouettes are real. Until it lands the squares count only what this wallet has. */
    var B = root.V2Split; if (PAGE && w._view && !w._ranked && B && B.loadBoard && !boardAsked) { boardAsked = 1; B.loadBoard().then(function () { boardAsked = 2; sumKey = ''; if (el && !el.hidden) paint(); }, function () { boardAsked = 2; }); }
    var counting = PAGE && w._view && !w._ranked && boardAsked !== 2;
    dexNow = compute(w, m);
    box.querySelector('.pdx-score').innerHTML = '<b>' + dexNow.got + '</b>/' + dexNow.total + ' caught';
    box.querySelector('.pdx-rank').textContent = dexNow.rank;
    box.querySelector('.pdx-bar i').style.width = Math.max(2, dexNow.pct) + '%';
    box.querySelector('.pdx-sub').textContent = !m ? 'Connect a wallet (or view one) to see what you have caught.' : counting ? 'Counting every pet on chain\u2026 ' : (w._pages && !w._full && !w._ranked ? 'Still loading some pets… ' : '') + dexNow.mastered.length + ' row' + (dexNow.mastered.length === 1 ? '' : 's') + ' mastered · tap any square';
    [['species', 'Species ' + dexNow.species.got + '/' + dexNow.species.of], ['legends', 'Legends ' + dexNow.legendGot + '/' + dexNow.legends.length], ['hybrids', 'Hybrids ' + dexNow.hybridGot + '/' + dexNow.hybrids.length]].forEach(function (t) {
      var b = box.querySelector('[data-tab=' + t[0] + ']'); b.textContent = t[1]; b.setAttribute('aria-pressed', String(tab === t[0])); });
    var gb = box.querySelector('[data-tab=gear]'); if (gb) { gb.hidden = !GB(); gb.textContent = '🎽 ' + (GB() ? GB().tabLabel(w, m) : 'Gear'); gb.setAttribute('aria-pressed', String(tab === 'gear')); }
    var bd = box.querySelector('.pdx-body'); bd.innerHTML = body(); if (tab === 'gear' && GB()) GB().after(bd, PAGE ? null : el); else watch(bd); }
  var PAGE = false;
  function open() { if (!PAGE) { location.href = 'petdex.html'; return; } css(); var w = world(); if (!el) { el = d.createElement('div'); el.id = 'petdex'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Petdex');
      el.innerHTML = '<div class="pdx"><button type="button" class="pdx-x" aria-label="Close">×</button><h2>📖 PETDEX</h2>' +
        '<div class="pdx-top"><span class="pdx-score"></span><span class="pdx-rank"></span><span class="pdx-sub small"></span><div class="pdx-bar"><i></i></div></div>' +
        '<div class="pdx-tabs"><button type="button" data-tab="species"></button><button type="button" data-tab="legends"></button><button type="button" data-tab="hybrids"></button><button type="button" data-tab="gear" hidden></button><button type="button" class="pdx-share" data-share="1">📤 Share</button></div>' +
        '<div class="pdx-body"></div><div class="pdx-tip">Tap a square: what it is, how many exist, how to get one.</div></div>';
      var mount = $('petdexMount'); if (mount) { el.className = 'pdx-page'; mount.appendChild(el); } else d.body.appendChild(el);
      el.addEventListener('click', function (e) { if (e.target === el || e.target.closest('.pdx-x')) return close();
        var t = e.target.closest('[data-tab]'); if (t) { tab = t.getAttribute('data-tab'); el.scrollTop = 0; return paint(); }
        if (e.target.closest('[data-share]')) return share(e.target.closest('[data-share]'));
        if (tab === 'gear' && GB()) { var r = GB().click(e.target); if (r && r.repaint) return paint(); if (r && r.tip) { el.querySelector('.pdx-tip').innerHTML = r.tip; return; } }
        var c = e.target.closest('.pdx-c[data-i]'); if (c) { var x = CELLS[+c.getAttribute('data-i')]; if (x) { el.querySelector('.pdx-tip').innerHTML = tipFor(x); c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); if (root.V2Sfx && root.V2Sfx.blip) try { root.V2Sfx.blip(); } catch (er) { } } } });
      d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && el && !el.hidden) close(); }); }
    el.hidden = false; if (!PAGE) d.body.classList.add('pdx-open'); paint(); void w;
    try { root.dispatchEvent(new CustomEvent('xcpets:petdex-open')); } catch (e) { } /* daily loot tick (js/v2-daily-loot.js) */
  }
  function close() { if (!el || PAGE) return; el.hidden = true; d.body.classList.remove('pdx-open'); try { if (location.hash === '#petdex') history.replaceState(null, '', location.pathname + location.search); } catch (e) { } }
  function share(b) { if (!dexNow) return; var t = shareText(dexNow), done = function () { var o = b.textContent; b.textContent = '✅ Copied!'; setTimeout(function () { b.textContent = o; }, 1600); };
    try { if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) { navigator.share({ text: t }).catch(function () { }); return; } } catch (e) { }
    try { navigator.clipboard.writeText(t).then(done, function () { root.prompt('Copy your Petdex:', t); }); } catch (e) { root.prompt('Copy your Petdex:', t); } }
  /* Today card entry: one line under the tiles (js/v2-today.js asks summary()). */
  var sumKey = '', sumVal = null;
  function summary() { var w = world(), m = me(); if (!w || !w.pets || !m) return null; var k = m + '|' + w.tip + '|' + w.pets.length; if (k !== sumKey) { sumKey = k; sumVal = compute(w, m); } return sumVal; }
  function todayHtml() { var w = world(); if (w && w._view && !w._ranked) { css(); return '<button type="button" class="td-dex" data-td="dex">\ud83d\udcd6 <span>Petdex: every species, rarity and hybrid. What are you missing?</span><span class="td-go">gotta burn em all \u203a</span></button>'; }
    var x = summary(); if (!x) return ''; css();
    return '<button type="button" class="td-dex" data-td="dex">📖 <span>Petdex <b>' + x.got + '/' + x.total + '</b> · ' + esc(x.rank) + (x.mastered.length ? ' · ⭐ ' + x.mastered.length + ' mastered' : '') + '</span><span class="td-go">gotta burn em all ›</span></button>'; }
  function start() { if (!d) return; var q = /[?&]petdex=(\w+)/.exec(location.search) || /[?&]tab=(\w+)/.exec(location.search); if (q && /^(species|legends|hybrids|gear)$/.test(q[1])) tab = q[1];
    var go = function () { PAGE = d.body && d.body.getAttribute('data-v2page') === 'petdex';
      if (!PAGE && (location.hash === '#petdex' || /[?&]petdex=/.test(location.search))) { location.replace('petdex.html' + (q ? '?tab=' + q[1] : '')); return; }
      if (!PAGE) return; var n = 0, t = setInterval(function () { var w = world(); if ((w && w.pets && w.pets.length) || ++n > 120 || (n > 20 && !me())) { clearInterval(t); open(); } }, 500); };
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', go); else go(); }
  return { compute: compute, shareText: shareText, open: open, close: close, todayHtml: todayHtml, start: start, COLS: COLS, rankOf: rankOf };
});
