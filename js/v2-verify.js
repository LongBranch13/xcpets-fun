/* XCPETS "Verify it yourself" (verify-pet.html). Critique 2026-11-01 item 6, owner Nov 1 2026 7:42 PM CT [pt2615u]. DISPLAY ONLY.
 * No wallet, no burns, no sign sheet, and it never changes the rules, tags, costs or the replay. It shows the proof behind one pet and lets you
 * re-run the published replay yourself:
 *  - a pet: its hatch tx, hatch block, that block's hash, the seed (blockHash:petId), the DNA (SHA-256 of the seed, computed here with the
 *    browser's own crypto.subtle, not the game's code), and the traits re-rolled right now with PetCore.generate / V2Rules.hatchArt.
 *  - the replay: download api/pets.json, replay every burn up to its blockHeight in this tab exactly like tools/api-feed.js does
 *    (V2Rules.replay(rows <= height, hashes, [], {tip, live: RealCore, dex})), then compare a SHA-256 of the same core fields on both sides. */
(function (root) {
  'use strict';
  var M = root.V2Mock, R = root.V2Render, V = root.V2Rules, PC = root.PetCore, d = document, $ = function (id) { return d.getElementById(id); };
  if (!M || !V || !PC || !$('vfForm')) return;
  var NOPE = /crown|frame|fire|flame|aura/i, TIERS = ['Common', 'Uncommon', 'Rare', 'Legendary'];
  var RULES = { raw: 'the basic roll (PetCore.generate)', hatchArt: 'the egg rule (V2Rules.hatchArt)', electricArt: 'the Electric egg rule (V2Rules.electricArt)', kekArt: 'the Lord Kek egg rule',
    ftArt: 'the FUNTRUMP egg rule', hpArt: 'the Homer Pepe egg rule', burnLordArt: 'the Burn Lord rule', supremeArt: 'the Supreme rule' };
  var TRAITS = [['tier', 'Rarity'], ['species', 'Species'], ['pattern', 'Pattern'], ['eyes', 'Eyes'], ['cheeks', 'Cheeks'], ['band', 'Band'], ['armor', 'Armor'], ['cape', 'Cape'],
    ['weapon', 'Weapon'], ['crown', 'Hat'], ['background', 'Background'], ['bgColor', 'Background color'], ['baseStats', 'Base stats'], ['defaultName', 'Name']];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return Number(n).toLocaleString('en-US'); }
  function txt(v) { if (v == null) return '—'; if (typeof v === 'object') return Object.keys(v).map(function (k) { return k + ' ' + v[k]; }).join(', '); return String(v); }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join(''); }
  function sha256(str) { if (root.crypto && crypto.subtle && root.TextEncoder) return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(hex);
    return Promise.resolve(PC.sha256Hex(str)); }
  function code(s) { return '<code class="vf-code">' + esc(s) + '</code>'; }
  function txLink(tx) { return '<a href="https://mempool.space/tx/' + esc(tx) + '" target="_blank" rel="noopener">' + code(tx) + '</a>'; }
  function blockLink(h, n) { return '<a href="https://mempool.space/block/' + esc(h || n) + '" target="_blank" rel="noopener">' + esc(h ? h : fmt(n)) + '</a>'; }
  var W = null, S = null;
  function world() { try { W = M.world(); S = M.state(); } catch (e) { W = null; } return W; }
  function readId() { try { var v = new URLSearchParams(location.search).get('id'); return v && /^\d{1,7}$/.test(v) ? +v : null; } catch (e) { return null; } }
  function frames(p) { var ids = []; try { ids = (R.worn(W, p.id) || []).map(function (g) { return g.item; }).filter(function (it) { return it && !NOPE.test(it); }); } catch (e) {}
    try { var f = R.framesWith(p.art, p.stage, ids, []); if (f && f.length && f[0] && f[0].data) return f; } catch (e) {} return R.petFrames(p, W); }
  /* ---- one pet ---- */
  function show(id) {
    var out = $('vfOut'), err = $('vfErr'); err.textContent = '';
    if (!world()) { err.textContent = 'Still reading the chain. Try again in a moment.'; return; }
    var p = W.byId[id];
    if (!p) { out.hidden = true; err.textContent = 'There is no pet #' + id + ' (yet). The newest pet is #' + fmt(W.pets.length ? W.pets[W.pets.length - 1].id : 0) + '.'; return; }
    try { history.replaceState(null, '', 'verify-pet.html?id=' + id); } catch (e) {}
    var a = p.art || {}, seed = String(a.seed || ''), bh = seed.slice(0, 64), pid = seed.slice(65), hb = p.hatchBlock, chainHash = (S && S.hashes && S.hashes[hb]) || (root.XCPETS_BLOCK_HASHES || {})[hb] || '';
    /* every published roll rule, same seed in: the one that matches the most traits is the one this egg used */
    var rule = null, ruleName = '', best = -1;
    [['raw', function () { return PC.generate({ blockHash: bh, petId: pid, blockHeight: hb }); }]].concat(Object.keys(RULES).filter(function (k) { return typeof V[k] === 'function'; }).map(function (k) { return [k, function () { return V[k](bh, pid, hb); }]; }))
      .forEach(function (c) { var r = null; try { r = c[1](); } catch (e) {} if (!r) return; var n = TRAITS.filter(function (t) { return same(r[t[0]], a[t[0]]); }).length; if (n > best) { best = n; rule = r; ruleName = c[0]; } });
    $('vfName').textContent = '#' + p.id + (p.name ? ' ' + p.name : '');
    $('vfSub').textContent = (p.dead ? 'Dead' : p.released ? 'Released' : p.stageName || '') + ' · ' + (V.speciesLabel ? V.speciesLabel(p.species) : p.species) + ' · ' + (TIERS[p.tier] || '');
    var c0 = $('vfSprite'), c = c0.cloneNode(false); c0.parentNode.replaceChild(c, c0); try { if (R && R.lazy) R.lazy(c, function () { return frames(p); }, false); } catch (e) {}
    c.classList.toggle('vf-dead', !!p.dead);
    var rows = [
      ['Hatched by burn (tx)', p.hatchTx ? txLink(p.hatchTx) : '—'],
      ['In block', hb != null ? blockLink('', hb) : '—'],
      ['That block\u2019s hash', chainHash ? blockLink(chainHash) : '—'],
      ['Seed = block hash : pet id', code(seed)],
      ['DNA = SHA-256(seed)', '<span id="vfDna">' + code(a.dna || '') + '</span>']
    ];
    $('vfFacts').innerHTML = rows.map(function (r) { return '<div class="vf-row"><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>'; }).join('');
    var checks = [];
    checks.push(chainHash && bh === chainHash.toLowerCase() ? ['ok', 'The seed starts with the real hash of block ' + fmt(hb) + '.'] : ['warn', chainHash ? 'The seed\u2019s block hash is not block ' + fmt(hb) + '\u2019s hash (this pet was rolled from another block, e.g. a special egg).' : 'Block ' + fmt(hb) + '\u2019s hash isn\u2019t loaded here, so check it on the block link.']);
    checks.push(p.hatchTx && pid.indexOf(String(p.hatchTx).toLowerCase()) === 0 ? ['ok', 'The pet id in the seed is the hatch burn\u2019s tx' + (pid.length > 64 ? ' plus "' + esc(pid.slice(64)) + '"' + (/^:\d+$/.test(pid.slice(64)) ? ' (its number in a pack burn)' : pid.slice(64) === ':child' ? ' (a motel egg)' : '') : '') + '.'] : ['warn', 'The pet id in the seed is not just the hatch tx (' + esc(pid.slice(0, 40)) + (pid.length > 40 ? '…' : '') + '), as for special eggs.']);
    $('vfChecks').innerHTML = checks.map(function (k) { return '<li class="vf-' + k[0] + '">' + (k[0] === 'ok' ? '✓ ' : '• ') + k[1] + '</li>'; }).join('') + '<li id="vfDnaCheck">… checking the DNA with your browser\u2019s own SHA-256</li>';
    sha256(seed).then(function (h) { var li = $('vfDnaCheck'); if (!li) return; var ok = h === String(a.dna || '').toLowerCase(); li.className = ok ? 'vf-ok' : 'vf-bad';
      li.textContent = ok ? '✓ Your browser\u2019s SHA-256 of the seed gives the same DNA.' : '✗ Your browser\u2019s SHA-256 of the seed is ' + h + ', not the DNA above.'; });
    var ruleAll = rule && best === TRAITS.length, ruleLbl = RULES[ruleName] || ruleName;
    $('vfTraits').innerHTML = '<tr><th scope="col">Trait</th><th scope="col">This pet</th><th scope="col">Rolled again now</th><th scope="col"></th></tr>' + TRAITS.map(function (t) {
      var k = t[0], mine = a[k], again = rule ? rule[k] : undefined, ok = same(mine, again), hide = NOPE.test(txt(mine)) || NOPE.test(txt(again));
      return '<tr class="' + (ok ? 'vf-ok' : 'vf-diff') + '"><th scope="row">' + t[1] + '</th><td>' + (hide ? (ok ? 'same' : '·') : esc(txt(mine))) + '</td><td>' + (hide ? (ok ? 'same' : '·') : esc(txt(again))) + '</td><td>' + (ok ? '✓' : '≠') + '</td></tr>'; }).join('');
    $('vfTraitNote').innerHTML = ruleAll ? 'Every trait matches ' + esc(ruleLbl) + ', re-run in this tab just now.'
      : p.parents ? 'This egg came from the motel, so it mixes its parents, <a href="verify-pet.html?id=' + p.parents[0] + '">#' + p.parents[0] + '</a> and <a href="verify-pet.html?id=' + p.parents[1] + '">#' + p.parents[1] + '</a>: the ≠ rows came from them, the rest from its own seed.'
      : 'Closest roll: ' + esc(ruleLbl) + '. The ≠ rows changed after the egg hatched or came from an older egg rule: early pack eggs got a rarity bump, and eyes change with earned looks and fights.';
    $('vfLinks').innerHTML = '<a class="btn ghost" href="pet.html?id=' + p.id + '">Pet page</a> <a class="btn ghost" href="https://xcpets.fun/api/pets.json" target="_blank" rel="noopener">pets.json</a>';
    out.hidden = false; }
  /* ---- the whole replay ---- */
  var CORE_KEYS = ['id', 'species', 'tier', 'stage', 'care', 'status', 'owner', 'parents', 'bornBlock', 'lastFedBlock', 'deathBlock'];
  function proj(p) { return [p.id, p.species, TIERS[p.tier] || (p.art && p.art.tier ? p.art.tier[0].toUpperCase() + p.art.tier.slice(1) : null), p.stage, p.care, p.released ? 'released' : p.dead ? 'dead' : 'alive', p.owner, p.parents ? p.parents.slice() : null, p.hatchBlock, p.lastFed == null ? null : p.lastFed, p.deathBlock == null ? null : p.deathBlock]; }
  function projPub(p) { return CORE_KEYS.map(function (k) { return p[k] === undefined ? null : p[k]; }); }
  function say(s) { $('vfRunOut').innerHTML = s; }
  function run() {
    var b = $('vfRun'); if (b.disabled) return; if (!world()) { say('Still reading the chain. Try again in a moment.'); return; }
    b.disabled = true; say('Downloading api/pets.json…'); var t0 = Date.now(), text = '';
    fetch('api/pets.json', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.text(); }).then(function (t) { text = t; return sha256(t); }).then(function (fileHash) {
      var pub = JSON.parse(text), h = +pub.blockHeight;
      if (!(h > 0)) throw new Error('no blockHeight');
      if (S.tip < h) { say('pets.json is at block ' + fmt(h) + ' but this tab has only read up to ' + fmt(S.tip) + '. Reload in a minute and run it again.'); b.disabled = false; return; }
      say('Replaying ' + fmt(S.rows.filter(function (r) { return r.block_index <= h; }).length) + ' burns up to block ' + fmt(h) + ' in this tab…');
      setTimeout(function () {
        var w2, mine, theirs, diffs = [];
        try { w2 = V.replay(S.rows.filter(function (r) { return r.block_index <= h; }), S.hashes, [], { tip: h, live: root.LiveEngine && root.LiveEngine.RealCore, dex: S.dex || undefined }); }
        catch (e) { say('The replay stopped: ' + esc(e && e.message)); b.disabled = false; return; }
        mine = w2.pets.slice().sort(function (x, y) { return x.id - y.id; }).map(proj); theirs = pub.pets.map(projPub);
        var n = Math.max(mine.length, theirs.length);
        for (var i = 0; i < n && diffs.length < 20; i++) if (!same(mine[i], theirs[i])) diffs.push(i);
        Promise.all([sha256(JSON.stringify(mine)), sha256(JSON.stringify(theirs))]).then(function (hs) {
          var ok = hs[0] === hs[1], secs = ((Date.now() - t0) / 1000).toFixed(1);
          var html = '<p class="' + (ok ? 'vf-ok' : 'vf-bad') + '"><b>' + (ok ? '✓ SAME.' : '✗ DIFFERENT.') + '</b> Your replay of block ' + fmt(h) + ' and pets.json agree on ' + (ok ? 'every one of ' : '') + fmt(theirs.length) + ' pets (' + secs + ' s).</p>' +
            '<dl class="vf-facts"><div class="vf-row"><dt>pets.json file SHA-256</dt><dd>' + code(fileHash) + '</dd></div>' +
            '<div class="vf-row"><dt>Published core fields SHA-256</dt><dd>' + code(hs[1]) + '</dd></div><div class="vf-row"><dt>Your replay\u2019s core fields SHA-256</dt><dd>' + code(hs[0]) + '</dd></div></dl>' +
            '<p class="small muted">Core fields, in this order for every pet: ' + CORE_KEYS.join(', ') + '. Hashed as one JSON array of arrays.</p>';
          if (!ok) html = html.replace(' agree on ', ' differ on ') + '<p class="small">First differences: ' + diffs.map(function (i) { var x = theirs[i] || mine[i]; return '<a href="verify-pet.html?id=' + x[0] + '">#' + x[0] + '</a>'; }).join(', ') +
            '. If a block landed between the file and your replay (a pet sale, say), run it again after the next hourly feed.</p>';
          say(html); b.disabled = false; root.V2Verify.last = { ok: ok, h: h, mine: hs[0], theirs: hs[1], file: fileHash, n: theirs.length, diffs: diffs.length }; }); }, 30); })
      .catch(function (e) { say('Could not read api/pets.json (' + esc(e && e.message) + ').'); b.disabled = false; }); }
  function start() {
    var id = readId(); if (id != null) $('vfId').value = id;
    $('vfForm').addEventListener('submit', function (e) { e.preventDefault(); var v = String($('vfId').value || '').replace(/[#\s,]/g, ''); if (!/^\d{1,7}$/.test(v)) { $('vfErr').textContent = 'Type a pet number, like 1 or 4104.'; return; } show(+v); });
    $('vfRun').addEventListener('click', run);
    $('vfRandom').addEventListener('click', function () { if (!world() || !W.pets.length) return; var p = W.pets[Math.floor(Math.random() * W.pets.length)]; $('vfId').value = p.id; show(p.id); });
    var go = function () { if (world()) { $('vfStatus').textContent = 'Read up to block ' + fmt(S.tip) + ' (' + fmt(W.pets.length) + ' pets). Everything below is computed in this tab.'; if (id != null && $('vfOut').hidden) show(id); } };
    var tries = 0; (function wait() { if (world()) go(); else if (tries++ < 120) setTimeout(wait, 1000); })(); if (M.onFresh) M.onFresh(go); }
  root.V2Verify = { show: show, run: run };
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start); else start();
})(window);
