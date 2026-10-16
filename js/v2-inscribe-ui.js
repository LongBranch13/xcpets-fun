/* XCPETS v2: REAL inscription UI (2026-10-15). Preview -> XCP Wallet connect -> spendable UTXOs (no Counterparty assets, no likely inscriptions)
 * -> commit PSBT + temp-key-signed reveal -> FORCED recovery-file download -> XCP Wallet signs the commit (xcp_signBitcoinPsbt) -> broadcast commit, then reveal
 * -> confirmation tracking. Inscriptions page: chain-rebuilt registry (V2InscribeReg), pending list, Recover / Refund screen (loads the recovery file).
 * Rules kept from the mock (Jake 2026-10-14): PETS ONLY, still PNG only, single entry point request({ petId, frame }) via V2Inscribe.checkRequest; the art is ALWAYS
 * rendered here from the chain (canonical render at block b + the declared worn gear), never taken from the caller.
 * Jake 2026-10-15: XCP Wallet ONLY; the player pays Bitcoin fees only (no site fee output); no XCPETS burn; numbers from the registry (block height, tx index).
 * Environment (network, APIs, wallet provider, chain replay) comes from window.V2InscribeEnv (live: v2-inscribe-env.js; demo: signet simulation). */
(function () {
  'use strict';
  var I = window.V2Inscribe, V = window.V2Rules, R = window.V2Render, M = window.V2Mock, E = window.V2InscribeEnv, B = window.BtcSigner;
  if (!I || !V || !R || !M || !E || !B) return;
  var T = window.V2InscribeTx, G = window.V2InscribeReg(T), PKEY = 'xcpets-insc-pending-' + E.network, VKEY = 'xcpets-insc-valid-' + E.network, LIKELY_INSC_MAX = 10000;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function $(id) { return document.getElementById(id); }
  function sats(n) { return Number(n || 0).toLocaleString('en-US') + ' sats'; }
  function lsGet(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function pending() { return lsGet(PKEY, []); }
  function savePending(rec) { var l = pending().filter(function (x) { return x.commitTxid !== rec.commitTxid; }); l.push(rec); lsSet(PKEY, l); }
  function F(p, o) { return E.fetch(E.mempoolApi + p, o); }
  function json(p) { return F(p).then(function (r) { if (!r.ok) { var e = new Error('HTTP ' + r.status); e.status = r.status; throw e; } return r.json(); }); }
  function broadcast(raw) { return F('/tx', { method: 'POST', body: raw }).then(function (r) { return r.text().then(function (t) { if (!r.ok) throw new Error('broadcast refused: ' + t.slice(0, 200)); return t.trim(); }); }); }
  function txLink(id) { return '<a href="' + esc(E.explorer) + '/tx/' + esc(id) + '" target="_blank" rel="noopener">' + esc(id.slice(0, 10)) + '…</a>'; }
  function inscLink(id) { return E.ordinals ? '<a href="' + esc(E.ordinals) + '/inscription/' + esc(id) + '" target="_blank" rel="noopener">' + esc(id.slice(0, 10)) + '…i0</a>' : '<span title="' + esc(id) + '">' + esc(id.slice(0, 10)) + '…i0</span>'; }
  function toF(img) { return { w: img.width || 32, h: img.height || 32, data: new Uint8ClampedArray(img.data) }; }
  function distinctFrames(fr) { var out = [fr[0]]; for (var k = 1; k < fr.length; k++) { var a = fr[k].data, b = fr[0].data, same = true; for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) { same = false; break; } if (!same) out.push(fr[k]); } return out.length > 1 ? fr : [fr[0]]; }
  /* ---- canonical render: the ONLY art source (inscribing AND validating others' inscriptions) ---- */
  var wcache = {};
  function worldAt(b, ops) { var k = b + '|' + JSON.stringify(ops); if (!wcache[k]) { if (Object.keys(wcache).length > 24) wcache = {}; wcache[k] = E.replayAt(b, ops); } return wcache[k]; }
  function canonical(m) { var w0 = worldAt(m.b, []), p0 = w0.byId ? w0.byId[m.pet] : w0.pets.filter(function (q) { return q.id === m.pet; })[0];
    if (!p0) return { error: 'pet #' + m.pet + ' does not exist at block ' + m.b }; if (p0.dead || p0.released) return { error: 'pet #' + m.pet + ' is not alive at block ' + m.b };
    var ops = (m.g || []).map(function (x) { return { kind: 'equip', owner: p0.owner, petId: m.pet, slot: x[0], gid: x[1], block_index: m.b }; });
    var w = ops.length ? worldAt(m.b, ops) : w0, p = w.byId ? w.byId[m.pet] : w.pets.filter(function (q) { return q.id === m.pet; })[0], fr = distinctFrames(R.petFrames(p, w, { noHunger: true }).map(toF));
    if (m.f >= fr.length) return { error: 'frame ' + m.f + ' does not exist' };
    return { pet: p, world: w, frames: fr, frame: I.stampName(fr[m.f], p.name, m.s), owner: E.addrOf(p.owner), ownerKey: p.owner }; }
  function inflate(z) { if (E.inflate) return E.inflate(z); var ds = new DecompressionStream('deflate'), s = new Blob([z]).stream().pipeThrough(ds); return new Response(s).arrayBuffer().then(function (b) { return new Uint8Array(b); }); }
  function bytesFromDataURL(u) { var b = atob(u.split(',')[1]), o = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) o[i] = b.charCodeAt(i); return o; }
  function pngBrowser(f, colors) { var P = I.palette([f], Math.min(256, colors || 256)), c = document.createElement('canvas'); c.width = f.w; c.height = f.h;
    var id = c.getContext('2d').createImageData(f.w, f.h); for (var i = 0; i < f.data.length; i += 4) { var p = P.pal[P.map(f.data[i], f.data[i + 1], f.data[i + 2])]; id.data[i] = p[0]; id.data[i + 1] = p[1]; id.data[i + 2] = p[2]; id.data[i + 3] = 255; }
    c.getContext('2d').putImageData(id, 0, 0); return { bytes: bytesFromDataURL(c.toDataURL('image/png')), colors: P.pal.length, unique: P.unique }; }
  function b64(bytes) { var s = ''; for (var i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192)); return btoa(s); }
  function pngURL(bytes) { return 'data:image/png;base64,' + b64(bytes); }
  /** prepare(req): checkRequest (pets only, yours, alive) + canonical render at the current tip with the pet's CURRENT worn gear. Never takes image data from the caller. */
  function prepare(req) {
    var w = M.world(), c = I.checkRequest(req, w, M.ME); if (!c.ok) return c;
    var g = V.wornOf(w, c.pet.id).map(function (x) { return [x.slot, x.gid]; }).sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
    var meta = { pet: c.pet.id, b: E.tip(), f: req.frame || 0, s: req.nameStamp || I.NAME_POS[0], g: g }, K = canonical(meta); if (K.error) return { ok: false, error: 'Rejected: ' + K.error + '.' };
    var r = I.shrink({ frames: [K.frame], pixelArt: true }, { encodePNG: pngBrowser }), err = I.payloadError(r.bytes);
    if (err) return { ok: false, error: err }; if (!r.ok) return { ok: false, error: 'Rejected: PNG over the 385 KB cap.' };
    return { ok: true, pet: c.pet, meta: meta, frames: K.frames, still: K.frame, r: r, owner: K.owner, hash: I.imageHash(r.bytes) }; }
  /** selfCheck: the bytes we are about to inscribe must pass the SAME pixel validation every visitor will run (else it would get no number). */
  function selfCheck(P) { return G.decodePNG(P.r.bytes, inflate).then(function (img) { if (!G.pixelsMatch(img, canonical(P.meta).frame)) throw new Error('This art would not validate (palette fallback changed pixels). Pick another frame or no name stamp.'); }); }
  /* ---- modal ---- */
  function ensureBox() { var b = $('inscBox'); if (b) return b; b = document.createElement('div'); b.id = 'inscBox'; b.className = 'reveal insc'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-modal', 'true');
    b.innerHTML = '<div class="box wide" id="inscInner"></div>'; document.body.appendChild(b);
    b.addEventListener('click', function (e) { if (e.target === b && !b.busy) close(); }); document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && b.classList.contains('on') && !b.busy) close(); }); return b; }
  function close() { var b = $('inscBox'); if (b) { b.classList.remove('on'); b.busy = false; } }
  function chip() { return E.label ? ' <span class="chip">' + esc(E.label) + '</span>' : ''; }
  function shell(title, body) { var b = ensureBox(); $('inscInner').innerHTML = '<button type="button" class="q" id="inscX" style="float:right" aria-label="Close">&times;</button><h2 class="sec">⛓️ ' + esc(title) + chip() + '</h2>' + body;
    $('inscX').onclick = function () { if (!b.busy || confirm('Close? If the commit was already signed, finish or recover it later from the Inscriptions page (your recovery file has everything).')) close(); }; b.classList.add('on'); return b; }
  function fail(msg) { shell('Inscribe', '<p class="stuck" id="inscErr">⛔ ' + esc(msg) + '</p><p><button type="button" class="btn ghost" id="inscBack">Close</button></p>'); $('inscBack').onclick = close; return { ok: false, error: msg }; }
  function feeRate() { return json('/v1/fees/recommended').then(function (f) { var x = Math.ceil(Number(f.halfHourFee || f.hourFee)); return x >= 1 ? x : 2; }).catch(function () { return 4; }); }
  /** spendable(addr): confirmed UTXOs minus Counterparty-attached ones (CP API, must answer) minus <= 10,000-sat outputs (likely inscriptions/attached dust). */
  function spendable(addr) {
    var cp = (E.cpRead || []).slice();
    function cpUtxos(i) { if (i >= cp.length) return Promise.reject(new Error('Could not check your UTXOs for Counterparty assets (all Counterparty APIs failed). Nothing was signed; try again later.'));
      return E.fetch(cp[i] + '/addresses/' + addr + '/balances?type=utxo&limit=1000').then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (j) { if (!j || !Array.isArray(j.result)) throw new Error('bad answer'); var o = {}; j.result.forEach(function (x) { if (x.utxo) o[x.utxo] = 1; }); return o; }, function () { return cpUtxos(i + 1); }); }
    return Promise.all([json('/address/' + addr + '/utxo'), cpUtxos(0)]).then(function (r) { var all = r[0], att = r[1], ex = { cp: 0, small: 0, unconf: 0 };
      var ok = all.filter(function (u) { if (!u.status || !u.status.confirmed) { ex.unconf++; return false; } if (att[u.txid + ':' + u.vout]) { ex.cp++; return false; } if (u.value <= LIKELY_INSC_MAX) { ex.small++; return false; } return true; })
        .map(function (u) { return { txid: u.txid, vout: u.vout, value: u.value }; });
      return { utxos: ok, excluded: ex }; }); }
  function download(name, obj) { var a = document.createElement('a'), u = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })); a.href = u; a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 1000); }
  /** request({ petId, frame?, nameStamp? }, onDone): the single entry point. */
  function request(req, onDone) {
    var P = prepare(req); if (!P.ok) return fail(P.error);
    var pet = P.pet, r = P.r, thumb = pngURL(r.bytes);
    shell('Inscribe pet #' + pet.id, '<div class="inscprev"><img alt="" src="' + thumb + '" style="width:192px;height:192px;image-rendering:pixelated"><div class="small">' +
      '<p><b>' + esc(pet.name) + '</b> · pet #' + pet.id + ' · rendered from the chain at block ' + P.meta.b + (P.meta.g.length ? ' with its worn gear' : '') + '</p>' +
      '<p>Still PNG ' + r.width + '×' + r.height + ' (' + esc(r.scale) + ', lossless) · ' + r.kb + ' KB</p>' +
      (P.frames.length > 1 ? '<p><label>Frame to inscribe <select id="inscFrame">' + P.frames.map(function (_, i) { return '<option value="' + i + '"' + (i === P.meta.f ? ' selected' : '') + '>frame ' + (i + 1) + '</option>'; }).join('') + '</select></label></p>' : '') +
      '<p><label>Name stamp <select id="inscStamp">' + I.NAME_POS.map(function (x) { return '<option value="' + x + '"' + (x === P.meta.s ? ' selected' : '') + '>' + (x === 'none' ? 'No name' : x) + '</option>'; }).join('') + '</select></label></p>' +
      '<p><label>Fee rate <input type="number" id="inscRate" min="1" max="500" value="" style="width:5em"> sat/vB</label> <span id="inscFee" class="muted"></span></p>' +
      '<p class="muted">This exact still will be inscribed to your address <b>' + esc(P.owner) + '</b>. You pay Bitcoin network fees only (no site fee, no XCPETS). Signed in <b>XCP Wallet</b>.</p></div></div>' +
      '<div id="inscSteps" class="small"></div><p><button type="button" class="btn" id="inscGo2">Continue with XCP Wallet…</button> <button type="button" class="btn ghost" id="inscBack">Back</button></p>');
    $('inscBack').onclick = close;
    var re = function () { request({ petId: pet.id, frame: $('inscFrame') ? Number($('inscFrame').value) : 0, nameStamp: $('inscStamp').value }, onDone); };
    if ($('inscFrame')) $('inscFrame').onchange = re; $('inscStamp').onchange = re;
    function est() { var x = Number($('inscRate').value); if (!(x > 0)) return; try { var pl = T.plan({ tempPriv: T.newTempKey(), meta: P.meta, bytes: r.bytes, network: E.network, feeRate: x, receiver: P.owner });
        $('inscFee').textContent = '≈ ' + sats(pl.revealFee + Math.ceil(150 * x)) + ' network fees + ' + sats(pl.postage) + ' that stays with the inscription in your wallet'; } catch (e) { $('inscFee').textContent = e.message; } }
    feeRate().then(function (x) { if ($('inscRate')) { $('inscRate').value = x; est(); } }); $('inscRate').oninput = est;
    $('inscGo2').onclick = function () { flow(P, Number($('inscRate').value), onDone); };
    return { ok: true, petId: pet.id, frame: P.meta.f, nameStamp: P.meta.s, kb: r.kb, hash: P.hash };
  }
  function step(html, cls) { var s = $('inscSteps'); if (s) s.insertAdjacentHTML('beforeend', '<div class="' + (cls || '') + '">' + html + '</div>'); }
  function flow(P, rate, onDone) {
    var b = ensureBox(), go = $('inscGo2'), back = $('inscBack'); if (!(rate > 0 && rate <= 500)) return step('⛔ Enter a fee rate between 1 and 500 sat/vB.', 'stuck');
    go.disabled = true; b.busy = true; ['inscFrame', 'inscStamp', 'inscRate'].forEach(function (k) { if ($(k)) $(k).disabled = true; });
    var prov, addr, rec, C, tempPriv = T.newTempKey();
    function stop(e) { b.busy = false; step('⛔ ' + esc(e && e.message || e), 'stuck'); back.textContent = 'Close'; }
    selfCheck(P).then(function () { step('🔌 Connecting XCP Wallet…'); return E.provider(); }).then(function (p) { prov = p; return p.request({ method: 'xcp_requestAccounts' }); })
      .then(function (res) { addr = (res && res.accounts && res.accounts[0]) || (Array.isArray(res) ? res[0] : null);
        if (addr !== P.owner) throw new Error('XCP Wallet is on ' + (addr || 'no address') + ', but pet #' + P.pet.id + ' belongs to ' + P.owner + '. Switch the active address in XCP Wallet.');
        T.requireOwnerAddr(addr, E.network); step('✓ Connected: ' + esc(addr) + '. Reading your spendable BTC…');
        return Promise.all([spendable(addr), prov.request({ method: 'xcp_getAddresses' }).catch(function () { return null; })]); })
      .then(function (x) { var S = x[0], ga = x[1], pk = ga && ga.active && (ga.active.publicKey || ga.active.pubkey), tik = null;
        if (pk && T.addrType(addr, E.network) === 'tr') tik = pk.length === 66 ? pk.slice(2) : pk;
        if (S.excluded.cp || S.excluded.small || S.excluded.unconf) step('<span class="muted">Not used: ' + [S.excluded.cp && S.excluded.cp + ' UTXO(s) holding Counterparty assets', S.excluded.small && S.excluded.small + ' small UTXO(s) ≤ 10,000 sats (may hold inscriptions)', S.excluded.unconf && S.excluded.unconf + ' unconfirmed'].filter(Boolean).join(' · ') + '.</span>');
        var pl = T.plan({ tempPriv: tempPriv, meta: P.meta, bytes: P.r.bytes, network: E.network, feeRate: rate, receiver: addr });
        C = T.buildCommitPsbt({ plan: pl, from: addr, utxos: S.utxos, feeRate: rate, network: E.network, tapInternalKey: tik });
        var Rv = T.revealFromLeaf({ tempPriv: tempPriv, leaf: pl.leaf, network: E.network, receiver: addr, commitTxid: C.txid, commitAmount: pl.commitAmount });
        rec = { network: E.network, petId: P.pet.id, owner: addr, tempPriv: T.hex.encode(tempPriv), tempPubX: pl.tempPubX, commitAddress: pl.commitAddress, commitTxid: C.txid, commitAmount: pl.commitAmount,
          commitPsbtHex: C.psbtHex, revealHex: Rv.hex, revealTxid: Rv.txid, leafHex: pl.leafHex, status: 'unsigned', created: new Date().toISOString(), meta: P.meta };
        savePending(rec);
        step('🧾 Commit: ' + sats(pl.commitAmount) + ' to the inscription script + ' + sats(C.fee) + ' fee' + (C.change ? ' (change ' + sats(C.change) + ' back to you)' : '') + ' · Reveal: ' + sats(pl.revealFee) + ' fee, ' + sats(pl.postage) + ' to you with the inscription. <b>Total network fees ' + sats(C.fee + pl.revealFee) + '</b>.');
        step('💾 <b>Download the recovery file first.</b> It holds the one-time key for this inscription\'s commit and the signed reveal; with it you can always finish or refund. <button type="button" class="btn" id="inscDl">Download recovery file</button> <button type="button" class="btn" id="inscSign" disabled>Sign in XCP Wallet</button>');
        $('inscDl').onclick = function () { download('xcpets-inscription-pet' + P.pet.id + '-' + C.txid.slice(0, 8) + '.json', T.recoveryFile(rec)); rec.fileSaved = true; savePending(rec); $('inscSign').disabled = false; };
        $('inscSign').onclick = function () { this.disabled = true; $('inscDl').disabled = true; sign(); };
        b.busy = false; })
      .catch(stop);
    function sign() { b.busy = true; step('✍️ Approve the payment in XCP Wallet (to ' + esc(rec.commitAddress.slice(0, 14)) + '…, ' + sats(rec.commitAmount) + ')…');
      var si = {}; si[addr] = C.used.map(function (_, i) { return i; });
      prov.request({ method: 'xcp_signBitcoinPsbt', params: [{ hex: C.psbtHex, signInputs: si, sighashTypes: C.used.map(function () { return 1; }),
        intent: { standard: 'xcp-wallet/bitcoin-payment', version: 1, action: 'pay', outputs: [{ address: rec.commitAddress, amountSats: rec.commitAmount }], description: 'XCPETS inscription of pet #' + rec.petId + ' (commit)', reference: 'xcpets-insc-' + rec.petId } }] })
        .then(function (res) { var Fz = T.finalizeSigned(typeof res === 'string' ? res : res && res.hex); if (Fz.txid !== rec.commitTxid) throw new Error('XCP Wallet returned a different commit (' + Fz.txid.slice(0, 10) + '…); not broadcasting. Nothing was sent.');
          rec.commitHex = Fz.hex; rec.status = 'signed'; savePending(rec); step('📡 Broadcasting the commit…');
          return broadcast(Fz.hex).catch(function (e) { return prov.request({ method: 'xcp_broadcastTransaction', params: [Fz.hex] }).then(function (x) { return x && x.txid; }, function () { throw e; }); }); })
        .then(function () { rec.status = 'commit-sent'; savePending(rec); step('✓ Commit sent ' + txLink(rec.commitTxid) + '. 📡 Broadcasting the reveal…');
          return broadcast(rec.revealHex).then(function () { rec.status = 'reveal-sent'; savePending(rec); step('✓ Reveal sent ' + txLink(rec.revealTxid) + '. Inscription ' + inscLink(rec.revealTxid) + ' gets its XCPETS number when it confirms.'); },
            function (e) { step('⚠️ Reveal not accepted yet (' + esc(e.message) + '). Your BTC is safe in the commit output: <b>do not re-commit</b>. It will be retried automatically; you can also retry from the Inscriptions page.', 'stuck'); }); })
        .then(function () { b.busy = false; back.textContent = 'Close'; track(rec, function (st) { step(st); if (onDone) onDone(rec); }); })
        .catch(function (e) { if (e && e.code === 4001) { rec.status = 'cancelled'; savePending(rec); return stop('You cancelled in XCP Wallet. Nothing was signed or sent.'); } stop(e); }); }
  }
  /* ---- confirmation tracking (+ automatic reveal retry once the commit is in) ---- */
  var tracking = {};
  function track(rec, cb) { if (tracking[rec.commitTxid]) return; tracking[rec.commitTxid] = 1;
    (function poll() { Promise.all([json('/tx/' + rec.commitTxid + '/status').catch(function () { return null; }), json('/tx/' + rec.revealTxid + '/status').catch(function () { return null; })]).then(function (s) {
      var c = s[0], v = s[1];
      if (v && v.confirmed) { rec.status = 'confirmed'; rec.height = v.block_height; savePending(rec); delete tracking[rec.commitTxid]; return cb && cb('✅ Inscription confirmed in block ' + v.block_height + '.'); }
      if (c && !v && rec.status !== 'refunded') broadcast(rec.revealHex).then(function () { rec.status = 'reveal-sent'; savePending(rec); }, function () {});
      setTimeout(poll, E.pollMs || 30000); }); })(); }
  /* ---- recovery / refund (loads the recovery file) ---- */
  function recover(o, host) {
    host.innerHTML = '<p class="small">Checking ' + txLink(o.commitTxid) + '…</p>';
    Promise.all([json('/tx/' + o.commitTxid + '/status').catch(function (e) { return e.status === 404 || e.status === 400 ? null : Promise.reject(e); }), json('/tx/' + o.commitTxid + '/outspend/0').catch(function () { return null; })]).then(function (s) {
      var st = s[0], sp = s[1], h = '<p class="small">Pet #' + esc(o.petId) + ' · owner ' + esc(o.owner) + ' · commit ' + txLink(o.commitTxid) + ' (' + sats(o.commitAmountSats) + ')</p>';
      if (!st) { host.innerHTML = h + '<p>The commit was never broadcast (or not seen yet): nothing was spent. If you just signed it, wait a minute and load the file again.</p>'; return; }
      if (sp && sp.spent) { host.innerHTML = h + (sp.txid === o.revealTxid ? '<p>✅ Already revealed: inscription ' + inscLink(o.revealTxid) + '.</p>' : '<p>The commit output was already spent by ' + txLink(sp.txid) + ' (refunded?). Nothing left to do.</p>'); return; }
      host.innerHTML = h + '<p>The commit output is unspent' + (st.confirmed ? ' (confirmed)' : ' (unconfirmed)') + '. Finish the inscription, or take the BTC back.</p>' +
        '<p><button type="button" class="btn" id="recReveal">Broadcast reveal</button> <label class="small">or refund at <input type="number" id="recRate" min="1" max="500" value="3" style="width:4em"> sat/vB</label> <button type="button" class="btn ghost" id="recRefund">Refund to ' + esc(o.owner.slice(0, 12)) + '…</button></p><p class="small" id="recMsg"></p>';
      $('recReveal').onclick = function () { broadcast(o.revealTxHex).then(function () { $('recMsg').innerHTML = '✓ Reveal sent: ' + inscLink(o.revealTxid); }, function (e) { $('recMsg').textContent = '⛔ ' + e.message; }); };
      $('recRefund').onclick = function () { try { var Rf = T.buildRefund({ tempPriv: o.tempPrivateKey, leaf: o.envelopeLeafHex, network: o.network, feeRate: Number($('recRate').value), to: o.owner, commitTxid: o.commitTxid, commitAmount: o.commitAmountSats });
          if (!confirm('Refund ' + sats(Rf.amount) + ' to ' + o.owner + ' (fee ' + sats(Rf.fee) + ')? The inscription will NOT happen.')) return;
          broadcast(Rf.hex).then(function () { $('recMsg').innerHTML = '✓ Refund sent ' + txLink(Rf.txid); var l = pending(); l.forEach(function (x) { if (x.commitTxid === o.commitTxid) x.status = 'refunded'; }); lsSet(PKEY, l); }, function (e) { $('recMsg').textContent = '⛔ ' + e.message; }); }
        catch (e) { $('recMsg').textContent = '⛔ ' + e.message; } };
    }, function (e) { host.innerHTML = '<p class="stuck">⛔ Could not reach ' + esc(E.mempoolApi) + ': ' + esc(e.message) + '</p>'; }); }
  function recoverPanel(host) {
    host.innerHTML = '<h3 class="sec">Recover / refund</h3><p class="small">Load the recovery file you downloaded before signing. It finishes a stuck inscription or returns the commit BTC to your address. Nothing leaves this browser except the transaction you choose to broadcast.</p>' +
      '<p><input type="file" id="recFile" accept="application/json,.json"></p><div id="recOut"></div>' +
      (pending().filter(function (x) { return x.status !== 'confirmed' && x.status !== 'refunded' && x.status !== 'cancelled'; }).map(function (x) {
        return '<p class="small">⏳ Pet #' + esc(x.petId) + ' · ' + esc(x.status) + ' · commit ' + txLink(x.commitTxid) + ' <button type="button" class="btn ghost" data-rec="' + esc(x.commitTxid) + '">Check / recover</button></p>'; }).join(''));
    $('recFile').onchange = function () { var f = this.files && this.files[0]; if (!f) return; if (f.size > 2e6) { $('recOut').textContent = '⛔ File too large.'; return; }
      f.text().then(function (t) { var o; try { o = T.parseRecovery(t); } catch (e) { $('recOut').textContent = '⛔ ' + e.message; return; } if (o.network !== E.network) { $('recOut').textContent = '⛔ This file is for ' + o.network + '; this page is on ' + E.network + '.'; return; } recover(o, $('recOut')); }); };
    host.querySelectorAll('[data-rec]').forEach(function (bt) { bt.onclick = function () { var x = pending().filter(function (q) { return q.commitTxid === bt.getAttribute('data-rec'); })[0]; if (x) recover(T.recoveryFile(x), $('recOut')); }; }); }
  /* ---- registry (numbers) ---- */
  var regP = null;
  function registry(force) { if (regP && !force) return regP; var w = M.world(), owners = {};
    w.pets.forEach(function (p) { var a = E.addrOf(p.owner); try { if (a) { T.requireOwnerAddr(a, E.network); owners[a] = 1; } } catch (e) {} });
    var cache = lsGet(VKEY, {}), Rg = new G.Registry({ fetch: E.fetch, mempoolApi: E.mempoolApi, fromBlock: E.fromBlock, inflate: inflate, cache: cache, expected: function (m) { try { return canonical(m); } catch (e) { return { error: e.message }; } } });
    regP = Rg.build(Object.keys(owners)).then(function (res) { lsSet(VKEY, Rg.cache); return res; }); return regP; }
  function petSection(host, pet, w, mine) {
    host.innerHTML = '<h2 class="sec" data-ico="pet">⛓️ On-chain art' + chip() + '</h2><p class="small" id="inscPetList">Reading inscriptions…</p>' +
      (mine && !pet.dead ? '<p><button type="button" class="btn" id="inscPetBtn">⛓️ Inscribe on-chain…</button> <span class="small muted">Signed in XCP Wallet; you pay Bitcoin fees only.</span></p>' : '');
    if ($('inscPetBtn')) $('inscPetBtn').onclick = function () { request({ petId: pet.id }, function () { regP = null; }); };
    registry().then(function (res) { var mineL = res.list.filter(function (c) { return c.petId === pet.id; }), pend = res.pending.filter(function (c) { return c.meta.pet === pet.id; });
      $('inscPetList').innerHTML = (mineL.length ? mineL.map(function (c) { return '⛓️ <b>Inscription #' + c.n + '</b> (' + c.perPet + ' of this pet) · block ' + c.height + ' · ' + inscLink(c.revealTxid); }).join('<br>') : 'Art: hosted (not inscribed yet).') +
        (pend.length ? '<br>⏳ ' + pend.length + ' pending (unconfirmed)' : ''); }, function (e) { $('inscPetList').textContent = 'Could not read inscriptions: ' + e.message; }); }
  function page() {
    var w = M.world(), sel = $('inscPet'), mine = w.pets.filter(function (p) { return I.checkRequest({ petId: p.id }, w, M.ME).ok; });
    sel.innerHTML = mine.length ? mine.map(function (p) { return '<option value="' + p.id + '">#' + p.id + ' ' + esc(p.name) + ' (' + esc(V.speciesLabel(p.species)) + ', ' + esc(p.stageName) + ')</option>'; }).join('') : '<option value="">(no pets yet: connect your wallet on Play)</option>';
    $('inscGo').onclick = function () { if (!/^[1-9]\d*$/.test(sel.value)) return fail('Pick one of your pets.'); request({ petId: Number(sel.value) }, function () { regP = null; page(); }); };
    if ($('inscRecover')) recoverPanel($('inscRecover'));
    pending().filter(function (x) { return x.status === 'reveal-sent' || x.status === 'commit-sent'; }).forEach(function (x) { track(x); });
    $('status').textContent = 'Reading inscriptions from the chain…';
    registry(true).then(function (res) {
      $('status').textContent = res.list.length + ' XCPETS inscription' + (res.list.length === 1 ? '' : 's') + (res.pending.length ? ' · ' + res.pending.length + ' pending' : '') + ' · numbered in chain order (block, position in block) · only pet art that matches the pet\'s render gets a number.' + (res.errors.length ? ' (' + res.errors.length + ' address lookup(s) failed; reload to retry)' : '');
      $('inscList').innerHTML = (res.list.length ? '<table class="insctable"><tr><th>#</th><th>art</th><th>pet</th><th>block</th><th>inscription</th></tr>' + res.list.slice().reverse().map(function (c) {
        return '<tr id="insc-' + c.n + '"><td><b>#' + c.n + '</b></td><td><img class="inscthumb" alt="" src="' + pngURL(c.body) + '" style="width:64px;height:64px;image-rendering:pixelated"></td><td><a href="pet.html?id=' + c.petId + '">pet #' + c.petId + '</a><div class="muted">inscription ' + c.perPet + ' of this pet</div></td><td>' + c.height + '</td><td>' + inscLink(c.revealTxid) + '</td></tr>'; }).join('') + '</table>' : '<p class="muted">No inscriptions yet.</p>') +
        (res.invalid.length ? '<details class="small"><summary>' + res.invalid.length + ' XCPETS-tagged inscription(s) without a number</summary>' + res.invalid.map(function (c) { return '<div>' + txLink(c.revealTxid) + ': ' + esc(c.reason) + '</div>'; }).join('') + '</details>' : ''); },
      function (e) { $('status').textContent = 'Could not read inscriptions: ' + e.message; }); }
  window.V2InscribeUI = { request: request, open: request, prepare: prepare, canonical: canonical, selfCheck: selfCheck, petSection: petSection, page: page, registry: registry, recover: recover, close: close, spendable: spendable, track: track };
})();
