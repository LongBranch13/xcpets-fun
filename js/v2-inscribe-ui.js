/* XCPETS v2: inscription UI (MOCK). Preview modal -> mock commit -> mock reveal; lineage; Inscriptions page list.
 * NOTHING is signed, broadcast or sent to a wallet: ids are sha-derived fakes, links are ordinals.com-STYLE text only (not live links).
 * 2026-10-14 (Jake): PETS ONLY + STILL PNG ONLY.
 *  - The single entry point is request({ petId, frame }) (open() is an alias). It accepts ONLY a positive integer id of a live pet owned by the mock wallet;
 *    any image / dataURL / url / bytes / frames field is rejected. The image is ALWAYS rendered here from the pet's sprite + worn gear.
 *  - The art is re-derived from the pet id and its hash compared before the mock commit AND before the reveal; any mismatch / tamper aborts and
 *    leaves no record. Headwear-as-child inscriptions are gone (hats are not pets; a worn hat is part of the pet's own inscription).
 *  - Animated pets inscribe ONE still frame (frame picker in the preview, default frame 0). No GIFs.
 *  Client-only demo: this is UX + tamper resistance, not security. Live needs the indexer/server to re-derive and refuse anything else. */
(function () {
  'use strict';
  var I = window.V2Inscribe, V = window.V2Rules, R = window.V2Render, M = window.V2Mock;
  if (!I || !V || !R || !M) return;
  var MOCK_ADDR = 'bc1p' + V.sha('xcpets-demo-v2-taproot').replace(/[^02-9ac-hj-np-z]/g, '').slice(0, 58).padEnd(58, 'q');
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function $(id) { return document.getElementById(id); }
  var THUMB_RE = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;
  /** list(): the mock registry, sanitised on every read (tampered localStorage cannot inject non-pet / GIF / foreign-image records into the page). */
  function list() { var S = M.state(), w = null; S.insc = (S.insc || []).filter(function (x) {
      if (!x || x.kind !== 'pet' || x.format !== 'png' || !Number.isSafeInteger(x.petId) || x.petId <= 0 || !Number.isSafeInteger(x.n)) return false;
      w = w || M.world(); if (!w.pets.some(function (p) { return p.id === x.petId; })) return false;
      if (x.thumb && !THUMB_RE.test(x.thumb)) x.thumb = null; return true; });
    return S.insc; }
  function toF(img) { return { w: img.width || 32, h: img.height || 32, data: new Uint8ClampedArray(img.data) }; }
  function bytesFromDataURL(u) { var b = atob(u.split(',')[1]), o = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) o[i] = b.charCodeAt(i); return o; }
  function pngBrowser(f, colors) { var P = I.palette([f], Math.min(256, colors || 256)), c = document.createElement('canvas'); c.width = f.w; c.height = f.h;
    var id = c.getContext('2d').createImageData(f.w, f.h); for (var i = 0; i < f.data.length; i += 4) { var p = P.pal[P.map(f.data[i], f.data[i + 1], f.data[i + 2])]; id.data[i] = p[0]; id.data[i + 1] = p[1]; id.data[i + 2] = p[2]; id.data[i + 3] = 255; }
    c.getContext('2d').putImageData(id, 0, 0); return { bytes: bytesFromDataURL(c.toDataURL('image/png')), colors: P.pal.length, unique: P.unique }; }
  function b64(bytes) { var s = ''; for (var i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192)); return btoa(s); }
  function mockLink(id) { return '<span class="insclink" title="MOCK id: not on chain, not a live link">ordinals.com/inscription/' + esc(String(id).slice(0, 10)) + '…' + esc(String(id).slice(-6)) + ' <em>(mock)</em></span>'; }
  function thumb(frame) { var c = document.createElement('canvas'), f = I.scaleUp(frame, 2); c.width = f.w; c.height = f.h; var d = c.getContext('2d').createImageData(f.w, f.h); d.data.set(f.data); c.getContext('2d').putImageData(d, 0, 0); return c.toDataURL('image/png'); }
  function distinctFrames(fr) { var out = [fr[0]]; for (var k = 1; k < fr.length; k++) { var a = fr[k].data, b = fr[0].data, same = true; for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) { same = false; break; } if (!same) out.push(fr[k]); } return out.length > 1 ? fr : [fr[0]]; }
  /** prepare(req): validate + render the still from the pet id. Never takes image data from the caller. -> { ok, pet, frame, frames, still, r, hash } | { ok:false, error } */
  function prepare(req) {
    var w = M.world(), c = I.checkRequest(req, w, M.ME); if (!c.ok) return c;
    var all = distinctFrames(R.petFrames(c.pet, w).map(toF)), frame = req.frame || 0, pos = req.nameStamp || I.NAME_POS[0];
    if (frame >= all.length) return { ok: false, error: 'Rejected: pet #' + c.pet.id + ' has ' + all.length + ' frame' + (all.length > 1 ? 's' : '') + ' (got frame ' + frame + ').' };
    var still = I.stampName(all[frame], c.pet.name, pos), r = I.shrink({ frames: [still], pixelArt: true }, { encodePNG: pngBrowser }), err = I.payloadError(r.bytes);
    if (err) return { ok: false, error: err }; if (!r.ok) return { ok: false, error: 'Rejected: PNG over the 385 KB cap.' };
    return { ok: true, pet: c.pet, frame: frame, nameStamp: pos, nameText: pos === 'none' ? '' : I.sanitizeName(c.pet.name), frames: all, still: still, r: r, hash: I.imageHash(r.bytes), world: w }; }
  function ensureBox() { var b = $('inscBox'); if (b) return b; b = document.createElement('div'); b.id = 'inscBox'; b.className = 'reveal insc'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-modal', 'true');
    b.innerHTML = '<div class="box wide" id="inscInner"></div>'; document.body.appendChild(b);
    b.addEventListener('click', function (e) { if (e.target === b && !b.busy) close(); }); document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && b.classList.contains('on') && !b.busy) close(); }); return b; }
  function close() { var b = $('inscBox'); if (b) b.classList.remove('on'); }
  function lineage(pet) { var L = list(), mine = I.ofPet(L, pet.id), h = [];
    if (pet.parents && pet.parents.length === 2) { var pa = I.latestOfPet(L, pet.parents[0]), pb = I.latestOfPet(L, pet.parents[1]);
      h.push('Parents: <a href="pet.html?id=' + pet.parents[0] + '">#' + pet.parents[0] + '</a> ' + (pa ? '(inscription #' + pa.n + ')' : '(not inscribed)') + ' × <a href="pet.html?id=' + pet.parents[1] + '">#' + pet.parents[1] + '</a> ' + (pb ? '(inscription #' + pb.n + ')' : '(not inscribed)') +
        (pa && pb ? ' · a new inscription of this pet records both as parents' : ' · parents are recorded only when both are inscribed')); }
    mine.forEach(function (x) { var par = (x.parents || []).map(function (id) { var p = L.filter(function (q) { return q.id === id; })[0]; return p ? '#' + p.n : 'mock'; });
      h.push('⛓️ Inscription <b>#' + x.n + '</b> (inscription ' + x.perPet + ' of this pet) · still PNG, frame ' + ((x.frame || 0) + 1) + ' · ' + x.kb + ' KB · ' + mockLink(x.id) + (par.length ? ' · parents ' + par.join(' × ') : '')); });
    L.filter(function (c) { return (c.parents || []).length && c.parents.some(function (id) { return mine.some(function (m) { return m.id === id; }); }); }).forEach(function (c) { h.push('Child pet: <a href="pet.html?id=' + c.petId + '">#' + c.petId + '</a> (inscription #' + c.n + ')'); });
    return h.join('<br>'); }
  function fail(msg) { var b = ensureBox(); b.busy = false;
    $('inscInner').innerHTML = '<button type="button" class="q" id="inscX" style="float:right" aria-label="Close">&times;</button><h2 class="sec">⛓️ Inscribe <span class="chip">MOCK</span></h2><p class="stuck" id="inscErr">⛔ ' + esc(msg) + '</p><p><button type="button" class="btn ghost" id="inscBack">Close</button></p>';
    $('inscX').onclick = close; $('inscBack').onclick = close; b.classList.add('on'); return { ok: false, error: msg }; }
  // Persistent 'Inscribing' pet header card (Jake 2026-10-14): shown through every step (preview, commit, reveal, stuck/retry, done),
  // in the modal and at the top of the Inscriptions page for in-progress inscriptions.
  var STEPS = { preview: '👀 Preview', commit: '⏳ Committing', reveal: '🔓 Revealing', stuck: '⚠️ Stuck: reveal pending', done: '✅ Inscribed' };
  function stepOf(rec) { return !rec ? 'preview' : rec.status === 'inscribed' ? 'done' : rec.status === 'commit-only' ? (rec.stuck ? 'stuck' : 'reveal') : 'commit'; }
  function headCard(o) { // o: { pet?, petId, name, species, stageName, tier, thumb, n, perPet, step }
    var tl = (V.TIER_LABELS || [])[o.tier], sp = o.species ? (V.speciesLabel ? V.speciesLabel(o.species) : o.species) : '';
    return '<div class="inschead" data-step="' + esc(o.step) + '" data-pet="' + esc(o.petId) + '">' + (o.thumb ? '<img class="insctb" alt="" src="' + esc(o.thumb) + '">' : '') +
      '<div class="ihb"><div class="ihk">Inscribing</div><div class="ihn"><b>' + esc(o.name) + '</b> <span class="muted">pet #' + esc(o.petId) + '</span></div>' +
      '<div class="ihm">' + esc(sp) + (o.stageName ? ' · ' + esc(o.stageName) : '') + (tl ? ' · <span class="ihr t' + o.tier + '">' + esc(tl) + '</span>' : '') + '</div>' +
      '<div class="ihm">Inscription <b>#' + esc(o.n) + '</b> · ' + esc(o.perPet) + (o.perPet === 1 ? 'st' : o.perPet === 2 ? 'nd' : o.perPet === 3 ? 'rd' : 'th') + ' of this pet</div></div>' +
      '<div class="ihs">' + (STEPS[o.step] || esc(o.step)) + '</div></div>'; }
  function petInfo(petId) { var w = M.world(), p = w.pets.filter(function (q) { return q.id === petId; })[0]; return p || { id: petId, name: '#' + petId }; }
  function cardFor(rec) { var p = petInfo(rec.petId); return headCard({ petId: rec.petId, name: p.name, species: p.species, stageName: p.stageName, tier: p.tier, thumb: rec.thumb, n: rec.n, perPet: rec.perPet, step: stepOf(rec) }); }
  function active() { var L = list(); return L.filter(function (x) { return x.status !== 'inscribed'; }); }
  function renderActive() { var host = $('inscActive'); if (!host) { var lst = $('inscList'); if (!lst) return; host = document.createElement('div'); host.id = 'inscActive'; lst.parentNode.insertBefore(host, lst); }
    var A = active(); host.innerHTML = A.length ? '<h3 class="sec">In progress</h3>' + A.slice().reverse().map(function (x) { return cardFor(x) + (x.status === 'commit-only' && x.stuck ? '<p class="small stuck">Commit in, reveal pending: reopen this pet\'s inscription to retry the reveal (do not re-commit).</p>' : ''); }).join('') : ''; }
  function setStep(step, rec) { var h = document.querySelector('#inscInner .inschead'); if (h) { h.setAttribute('data-step', step); h.querySelector('.ihs').innerHTML = STEPS[step]; } renderActive(); }
  /** request(req, onDone): THE entry point. req = { petId:int, frame?:int }. Returns { ok } or { ok:false, error } (and shows the error). */
  function request(req, onDone) {
    var P = prepare(req); if (!P.ok) return fail(P.error);
    var pet = P.pet, r = P.r, L = list(), b = ensureBox(), n = I.nextNumber(L), per = I.ofPet(L, pet.id).length + 1, parents = I.parentsFor(L, pet);
    var parentTxt = parents.length ? 'parents: inscriptions ' + parents.map(function (id) { return '#' + L.filter(function (q) { return q.id === id; })[0].n; }).join(' × ') : (pet.parents ? 'no parent link (both parents must be inscribed first)' : 'no parents (hatched)');
    var what = '#' + pet.id + ' ' + pet.name, nf = P.frames.length;
    var picker = nf > 1 ? '<p class="small" id="inscFramePick">Frame to inscribe: ' + P.frames.map(function (f, k) { return '<button type="button" class="btn ghost' + (k === P.frame ? ' on' : '') + '"' + (k === P.frame ? '' : ' style="opacity:.5"') + ' data-frame="' + k + '" aria-pressed="' + (k === P.frame) + '">' + (k + 1) + '</button>'; }).join(' ') + ' <span class="muted">(your pet is animated; the inscription is ONE still frame)</span></p>' : '';
    $('inscInner').innerHTML = '<button type="button" class="q" id="inscX" style="float:right" aria-label="Close">&times;</button><h2 class="sec">⛓️ Inscribe ' + esc(what) + ' <span class="chip">MOCK</span></h2>' +
      headCard({ petId: pet.id, name: pet.name, species: pet.species, stageName: pet.stageName, tier: pet.tier, thumb: thumb(P.still), n: n, perPet: per, step: 'preview' }) +
      '<p class="small" id="inscNamePick">Name on the art: ' + I.NAME_POS.map(function (k) { return '<button type="button" class="btn ghost' + (k === P.nameStamp ? ' on' : '') + '"' + (k === P.nameStamp ? '' : ' style="opacity:.5"') + ' data-name="' + k + '" aria-pressed="' + (k === P.nameStamp) + '">' + { top: 'Top', bottom: 'Bottom', none: 'No name' }[k] + '</button>'; }).join(' ') +
      (P.nameText ? ' <span class="muted">“' + esc(P.nameText) + '” (your pet\'s name, 3×5 pixel font)</span>' : '') + '</p>' +
      '<p class="small">Will be <b>inscription #' + n + '</b> · <b>inscription ' + per + ' of this pet</b> · ' + esc(parentTxt) + '</p>' + picker +
      '<div class="inscgrid"><figure><canvas id="inscOrig" width="32" height="32"></canvas><figcaption class="small">Hosted art (32×32' + (nf > 1 ? ', animated: stays hosted, not inscribed' : '') + ')</figcaption></figure><figure><img id="inscImg" alt="exact still PNG that will be inscribed" src="data:image/png;base64,' + b64(r.bytes) + '"><figcaption class="small"><b>This exact still will be inscribed</b>: PNG ' + r.width + '×' + r.height + ' (integer scale ' + r.scale + ')' + (nf > 1 ? ', frame ' + (P.frame + 1) + ' of ' + nf : '') + '</figcaption></figure></div>' +
      '<p class="bigamt" id="inscKB">' + r.kb + ' KB <span class="small muted">/ 385 KB cap · still PNG · ' + r.colors + ' colours · quality ' + (r.psnr >= 99 ? 'lossless' : r.psnr + ' dB') + '</span></p>' +
      '<p class="small" id="inscTrim">Trimmed: ' + (r.trims.length ? esc(r.trims.join('; ')) : 'nothing (fits at full scale)') + '</p>' +
      '<p class="small"><label>Fee rate <input type="number" id="inscRate" min="1" max="500" value="12" style="width:5em"> sat/vB</label> · <span id="inscFee"></span></p>' +
      '<p class="small">🔑 Taproot only: the inscription goes to a <b>bc1p…</b> address (mock: <code>' + MOCK_ADDR.slice(0, 14) + '…</code> ' + (I.isTaproot(MOCK_ADDR) ? '✓ Taproot' : '✗') + '). Pets only: the image is always rendered from your pet (no uploads). Hosted mode (default) stays free.</p>' +
      '<p class="small"><label><input type="checkbox" id="inscStuck"> simulate a stuck reveal (commit in, reveal not)</label></p>' +
      '<div id="inscStatus" class="logbox small" aria-live="polite"></div>' +
      '<p><button type="button" class="btn ghost" id="inscBack">← Back</button> <button type="button" class="btn" id="inscOk">Confirm (mock)</button></p>';
    R.animate($('inscOrig'), P.frames.map(function (f) { return { width: 32, height: 32, data: f.data }; }));
    Array.prototype.forEach.call(document.querySelectorAll('#inscFramePick [data-frame]'), function (el) { el.onclick = function () { request({ petId: pet.id, frame: Number(el.getAttribute('data-frame')), nameStamp: P.nameStamp }, onDone); }; });
    Array.prototype.forEach.call(document.querySelectorAll('#inscNamePick [data-name]'), function (el) { el.onclick = function () { request({ petId: pet.id, frame: P.frame, nameStamp: el.getAttribute('data-name') }, onDone); }; });
    function rate() { var v = Number($('inscRate').value); return isFinite(v) && v >= 1 ? Math.min(500, v) : 1; }
    function feeTxt() { var f = I.fee(r.bytes.length, rate()); $('inscFee').innerHTML = 'estimate <b>' + f.sats.toLocaleString('en-US') + ' sats</b> (' + f.btc.toFixed(8) + ' BTC) for ~' + f.vbytes + ' vB (commit + reveal; image KB/4 vbytes)'; return f; }
    feeTxt(); $('inscRate').oninput = feeTxt; $('inscBack').onclick = close; $('inscX').onclick = close;
    $('inscOk').onclick = function () {
      var st = $('inscStatus'), stuck = $('inscStuck').checked;
      function abort(msg, rec) { if (rec) { var LL = list(), i = LL.indexOf(rec); if (i >= 0) LL.splice(i, 1); M.save(); renderActive(); }
        st.innerHTML += '<div class="stuck" id="inscErr">⛔ ' + esc(msg) + ' Nothing was recorded.</div>'; b.busy = false; $('inscBack').disabled = false; $('inscBack').textContent = 'Close'; }
      // re-validate + re-derive BEFORE COMMIT (pet still yours? art unchanged since the preview?)
      var P2 = prepare({ petId: pet.id, frame: P.frame, nameStamp: P.nameStamp }); if (!P2.ok) return abort(P2.error);
      if (P2.hash !== P.hash) return abort('The pet\'s art changed since the preview (gear / state). Reopen the preview.');
      var f = feeTxt(), commitTx = V.sha('mock-commit:' + n + ':' + what), id = V.sha('mock-reveal:' + n + ':' + what) + 'i0';
      b.busy = true; $('inscOk').disabled = true; $('inscBack').disabled = true; Array.prototype.forEach.call(document.querySelectorAll('#inscFramePick [data-frame], #inscNamePick [data-name]'), function (el) { el.disabled = true; });
      var rec = I.record(list(), { id: id, kind: 'pet', petId: pet.id, label: what, parents: parents, frame: P.frame, nameStamp: P.nameStamp, imgHash: P.hash, kb: r.kb, format: 'png', size: r.width + 'x' + r.height, scale: r.scale,
        frames: 1, colors: r.colors, feeRate: rate(), feeSats: f.sats, block: M.state().tip, commitTx: commitTx, thumb: thumb(P.still) });
      rec.status = 'committing'; M.save(); setStep('commit', rec);
      var steps = [function () { st.innerHTML += '<div>⏳ Committing… (mock: building the commit to ' + MOCK_ADDR.slice(0, 14) + '…, nothing is signed)</div>'; },
        function () { rec.status = 'commit-only'; M.save(); setStep('commit', rec); st.innerHTML += '<div>📡 Commit broadcast (mock txid ' + commitTx.slice(0, 12) + '…)</div>'; },
        function () { if (stuck) { rec.stuck = true; M.save(); setStep('stuck', rec); st.innerHTML += '<div class="stuck">⚠️ The commit is in, but the reveal has not confirmed. Your sats are safe in the commit output: <b>do not re-commit</b>. ' +
            'Wait for the commit to confirm, then retry the reveal with the same key (or a higher fee rate). Keep this page open; the reveal can be retried any time from the commit output.</div>' +
            '<button type="button" class="btn" id="inscRetry">Retry reveal (mock)</button>'; b.busy = false; $('inscRetry').onclick = function () { this.disabled = true; b.busy = true; stuck = false; rec.stuck = false; M.save(); setStep('reveal', rec); run(3); }; return 'stop'; }
          setStep('reveal', rec); st.innerHTML += '<div>🔓 Revealing… (mock)</div>'; },
        function () { // re-validate + re-derive BEFORE REVEAL: the revealed bytes must be the pet's own art, hash-identical to the commit
          var P3 = prepare({ petId: pet.id, frame: rec.frame, nameStamp: rec.nameStamp }); if (!P3.ok) { abort(P3.error, rec); return 'stop'; }
          if (P3.hash !== rec.imgHash) { abort('Reveal refused: the art no longer matches the committed pet image.', rec); return 'stop'; }
          rec.status = 'inscribed'; delete rec.stuck; M.save(); setStep('done', rec); st.innerHTML += '<div>✅ Inscribed! <b>Inscription #' + rec.n + '</b> (inscription ' + rec.perPet + ' of this pet, still PNG) · ' + mockLink(id) + '</div>';
          b.busy = false; $('inscBack').disabled = false; $('inscBack').textContent = 'Close'; if (onDone) onDone(rec); }];
      function run(i) { if (i >= steps.length) return; setTimeout(function () { if (steps[i]() === 'stop') return; run(i + 1); }, 650); }
      run(0); };
    b.classList.add('on'); return { ok: true, petId: pet.id, frame: P.frame, nameStamp: P.nameStamp, kb: r.kb, hash: P.hash }; }
  /** pet page section */
  function petSection(host, pet, w, mine) {
    var L = list(), insc = I.ofPet(L, pet.id), head = w ? V.wornOf(w, pet.id).filter(function (g) { return g.slot === 'head'; })[0] : null;
    host.innerHTML = '<h2 class="sec" data-ico="pet">⛓️ On-chain art <span class="chip">MOCK</span></h2><p class="small">' + (insc.length ? 'Inscribed ' + insc.length + '× (latest: inscription #' + insc[insc.length - 1].n + '). The hosted art stays the default view.' : 'Art: <b>hosted</b> (default, free). Upgrade it to an on-chain inscription: one still PNG of your pet (Taproot, under 385 KB).') + '</p>' +
      '<p class="small" id="inscLineage">' + (lineage(pet) || 'No inscriptions yet.') + '</p>' +
      (mine && !pet.dead ? '<p><button type="button" class="btn" id="inscPetBtn">⛓️ Inscribe on-chain…</button>' + (head ? ' <span class="small muted">' + esc(head.label) + ' is drawn on the pet in its own inscription (only pets are inscribed).</span>' : '') + '</p>' : '');
    var re = function () { petSection(host, pet, M.world(), mine); };
    if ($('inscPetBtn')) $('inscPetBtn').onclick = function () { request({ petId: pet.id }, re); }; }
  /** Inscriptions page: the picker lists ONLY pets that pass the entry-point check (exist, yours, alive). */
  function page() {
    var w = M.world(), L = list(), sel = $('inscPet');
    var mine = w.pets.filter(function (p) { return I.checkRequest({ petId: p.id }, w, M.ME).ok; });
    sel.innerHTML = mine.length ? mine.map(function (p) { return '<option value="' + p.id + '">#' + p.id + ' ' + esc(p.name) + ' (' + esc(V.speciesLabel(p.species)) + ', ' + esc(p.stageName) + ')' + (I.ofPet(L, p.id).length ? ' ⛓️' : '') + '</option>'; }).join('') : '<option value="">(no pets you can inscribe)</option>';
    $('inscGo').onclick = function () { if (!/^[1-9]\d*$/.test(sel.value)) return fail('Pick one of your pets.'); request({ petId: Number(sel.value) }, page); };
    $('status').textContent = L.length + ' preview inscription' + (L.length === 1 ? '' : 's') + ' (global numbers #1…#' + L.length + ') · pets only · still PNG · nothing here is on chain.';
    $('inscList').innerHTML = L.length ? '<table class="insctable"><tr><th>#</th><th>art</th><th>pet</th><th>status</th><th>parent(s)</th><th>size</th><th>fee est.</th><th>id</th></tr>' + L.slice().reverse().map(function (x) {
      var par = (x.parents || []).map(function (id) { var p = L.filter(function (q) { return q.id === id; })[0]; return p ? '<a href="#insc-' + p.n + '">#' + p.n + '</a>' : '?'; }).join(' × ') || '—';
      return '<tr id="insc-' + x.n + '"><td><b>#' + x.n + '</b></td><td>' + (x.thumb ? '<img class="inscthumb" src="' + esc(x.thumb) + '" alt="">' : '') + '</td><td><a href="pet.html?id=' + x.petId + '">' + esc(x.label) + '</a><div class="muted">pet · inscription ' + x.perPet + ' of this pet · still frame ' + ((x.frame || 0) + 1) + '</div></td>' +
        '<td>' + (x.status === 'inscribed' ? '✅ inscribed' : x.status === 'commit-only' ? '⚠️ commit in, reveal pending' : '⏳ ' + esc(x.status)) + '</td><td>' + par + '</td><td>' + esc(x.kb) + ' KB PNG<div class="muted">' + esc(x.size) + ' ' + esc(x.scale) + '</div></td><td>' + Number(x.feeSats || 0).toLocaleString('en-US') + ' sats<div class="muted">@ ' + esc(x.feeRate) + ' sat/vB</div></td><td>' + mockLink(x.id) + '</td></tr>'; }).join('') + '</table>'
      : '<p class="muted">No inscriptions yet. Pick a pet above, or use “Inscribe on-chain” on any pet page.</p>'; renderActive(); }
  window.V2InscribeUI = { headCard: headCard, active: active, renderActive: renderActive, request: request, open: request, prepare: prepare, petSection: petSection, page: page, lineage: lineage, close: close, list: list, MOCK_ADDR: MOCK_ADDR };
})();
