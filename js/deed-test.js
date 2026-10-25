/* deed-test.html: hidden live fee test for ONE pet token (owner asked Oct 22 2026). Composes the numeric-asset issuance exactly as pet-shop-sales does
 * (A + random digits, 404-checked, qty 1, indivisible, locked, description 'https://xcpets.fun/t/ID.json' = the pet's metadata JSON so explorers show its picture) on the site's compose nodes. Signing happens ONLY in XCP Wallet after a click.
 * No game rule, no replay input, no pet:deed burn. Minimal copies of the pet-shop-sales helpers below (randomDeed / dexUrl / dexCheck for issuance). */
(function () {
  'use strict';
  var CFG = window.XCPETS_CONFIG, W = window.V2Wallet, $ = function (i) { return document.getElementById(i); };
  var READ = (CFG.read || [])[0] || 'https://api.counterparty.io:4000/v2', DEED_MIN = '95428956661682177', DEED_MAX = '18446744073709551615';
  var qs = new URLSearchParams(location.search), viewOnly = qs.get('addr') || null, me = null, composed = null, plan = null, pets = [];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function errOut(el, e) { $(el).innerHTML = '<div class="dt-err">' + (e && typeof e === 'object' ? W.errHtml(e) : esc(e)) + '</div>'; }
  function numCmp(a, z) { return a.length - z.length || (a < z ? -1 : a > z ? 1 : 0); }
  function mulDec(a, k) { var r = '', c = 0; for (var i = a.length - 1; i >= 0; i--) { var x = +a[i] * k + c; r = (x % 10) + r; c = Math.floor(x / 10); } while (c) { r = (c % 10) + r; c = Math.floor(c / 10); } return r.replace(/^0+(?=\d)/, ''); }
  function addDec(a, z) { var r = '', c = 0, i = a.length - 1, j = z.length - 1; while (i >= 0 || j >= 0 || c) { var s = (i >= 0 ? +a[i--] : 0) + (j >= 0 ? +z[j--] : 0) + c; r = (s % 10) + r; c = s >= 10 ? 1 : 0; } return r.replace(/^0+(?=\d)/, ''); }
  function randomDeed() { var b = new Uint8Array(8); crypto.getRandomValues(b); var n = '0'; for (var i = 0; i < 8; i++) n = addDec(mulDec(n, 256), String(b[i]));
    if (numCmp(n, DEED_MIN) < 0) n = addDec(n, DEED_MIN); return 'A' + n; }
  function deedOk(a) { var m = /^A([1-9][0-9]{16,19})$/.exec(a); return !!m && numCmp(m[1], DEED_MIN) >= 0 && numCmp(m[1], DEED_MAX) <= 0; }
  function freeDeed(n) { n = n || 0; var A = randomDeed(); if (!deedOk(A)) return freeDeed(n);
    return fetch(READ + '/assets/' + A).then(function (r) { if (r.status === 404) return A; if (r.ok) { if (n >= 5) throw new Error('could not find a free token name'); return freeDeed(n + 1); } throw new Error('asset check HTTP ' + r.status); }); }
  function dexUrl(base, addr, p, fee) { var q = ['asset=' + encodeURIComponent(p.asset), 'quantity=1', 'divisible=false', 'lock=true', 'description=' + encodeURIComponent(p.description),
      'encoding=opreturn', 'verbose=true', 'validate=true', 'exclude_utxos_with_balances=true', 'sat_per_vbyte=' + fee];
    return base.replace(/\/+$/, '') + '/addresses/' + encodeURIComponent(addr) + '/compose/issuance?' + q.join('&'); }
  function dexCheck(r, addr, p) { var pr = (r && r.params) || {}, bad = []; if (!r || !/^[0-9a-f]+$/i.test(r.rawtransaction || '')) bad.push('no raw transaction hex');
    if (pr.source && pr.source !== addr) bad.push('source differs'); if (!deedOk(p.asset)) bad.push('not a numeric asset');
    if (pr.asset != null && pr.asset !== p.asset) bad.push('asset differs'); if (pr.quantity != null && Number(pr.quantity) !== 1) bad.push('quantity differs');
    if (pr.divisible != null && !!pr.divisible !== false) bad.push('divisible differs'); if (pr.lock != null && !!pr.lock !== true) bad.push('lock differs');
    if (pr.description != null && pr.description !== p.description) bad.push('description differs'); if (pr.transfer_destination) bad.push('has a transfer');
    if (pr.fee != null && Number(pr.fee) !== 0) bad.push('asset fee is not 0 (' + pr.fee + ')'); return bad; }
  function compose(addr, p, fee) { var urls = W.composeNodes(), errs = [];
    function go(i) { if (i >= urls.length) return Promise.reject(new Error('Every compose node failed:\n' + errs.join('\n')));
      $('dtStatus').textContent = 'Asking compose node ' + (i + 1) + ' of ' + urls.length + '…'; var url = dexUrl(urls[i], addr, p, fee), ac = new AbortController(), t = setTimeout(function () { ac.abort(); }, 20000);
      return fetch(url, { signal: ac.signal }).then(function (r) { clearTimeout(t); return r.json(); }).then(function (j) {
        if (j.error) throw new Error(typeof j.error === 'string' ? j.error : JSON.stringify(j.error)); var bad = dexCheck(j.result, addr, p).concat(W._dexCheck(j.result, addr, { kind: 'issuance', asset: p.asset, description: p.description }, fee)); if (bad.length) throw new Error('Safety check stopped this before signing (nothing was signed or sent): ' + bad.join(', '));
        j.result._url = url; return j.result; }).catch(function (e) { clearTimeout(t); errs.push(urls[i].replace(/^https?:\/\//, '').replace(/\/.*/, '') + ': ' + (e.name === 'AbortError' ? 'timed out after 20 s' : e.message)); return go(i + 1); }); }
    return go(0); }
  function loadPets(addr) { $('dtPick').innerHTML = '<option value="">loading your pets…</option>';
    return fetch('api/pets.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
      pets = j.pets.filter(function (p) { return p.owner === addr && p.status === 'alive' && !p.community; });
      $('dtPick').innerHTML = pets.length ? pets.map(function (p) { return '<option value="' + p.id + '">#' + p.id + ' ' + esc(p.name) + ' (' + esc(p.speciesLabel) + ', ' + esc(p.stageName) + ')</option>'; }).join('') : '<option value="">no live pets for this address in the hourly feed: type an ID</option>';
    }).catch(function () { $('dtPick').innerHTML = '<option value="">could not load the pet list: type an ID</option>'; }); }
  function setMe(a, how) { me = a; $('dtMe').textContent = a + ' (' + how + ')'; loadPets(a); }
  $('dtConnect').onclick = function () { $('dtConnect').disabled = true; W.getWallet().then(function (w) { setMe(w.address, 'XCP Wallet'); $('dtConnect').textContent = '✓ Connected'; }, function (e) { $('dtConnect').disabled = false; errOut('dtStatus', e); }); };
  if (viewOnly) setMe(viewOnly, 'view only: signing disabled');
  $('dtCompose').onclick = function () {
    var id = +($('dtId').value || $('dtPick').value || 0); composed = null; $('dtSign').disabled = true; $('dtSum').innerHTML = ''; $('dtOut').innerHTML = '';
    if (!me) return errOut('dtStatus', 'Connect XCP Wallet first.'); if (!(id > 0)) return errOut('dtStatus', 'Pick a pet or type a pet ID.');
    var p = pets.filter(function (x) { return x.id === id; })[0]; if (pets.length && !p) $('dtStatus').textContent = 'Note: #' + id + ' is not in your pet list (fine for this test).';
    $('dtCompose').disabled = true; $('dtStatus').textContent = 'Finding a free token name…'; var fee;
    Promise.all([freeDeed(), W.feeRate()]).then(function (r) { fee = r[1]; plan = { asset: r[0], description: 'https://xcpets.fun/t/' + id + '.json', petId: id, fee: fee }; return compose(me, plan, fee); }).then(function (res) {
      composed = res; var pr = res.params || {}, bytes = res.rawtransaction.length / 2, btc = Number(res.btc_fee), vs = btc > 0 ? Math.round(btc / fee) : null;
      $('dtStatus').textContent = 'Built. Nothing has been signed.';
      $('dtSum').innerHTML = '<table class="dt-sum">' + [
        ['Asset name', '<code>' + esc(plan.asset) + '</code> (free numeric asset, checked: not issued yet)'], ['Description', esc(plan.description)],
        ['Quantity', '1, indivisible, locked'], ['XCP fee', (pr.fee != null ? esc(Number(pr.fee) / 1e8) + ' XCP' : '0 XCP (numeric assets have no XCP fee; the node reported none)')],
        ['BTC miner fee', isFinite(btc) ? btc.toLocaleString() + ' sats (' + (btc / 1e8).toFixed(8) + ' BTC)' : 'node did not report btc_fee'], ['Fee rate', fee + ' sat/vB (mempool.space hour fee)'],
        ['Tx size', bytes + ' bytes unsigned' + (vs ? ' · about ' + vs + ' vB signed (btc_fee ÷ rate)' : '')], ['From', '<code>' + esc(me) + '</code>'], ['Compose node', '<code>' + esc(res._url.replace(/\?.*/, '')) + '</code>']
      ].map(function (x) { return '<tr><td>' + x[0] + '</td><td>' + x[1] + '</td></tr>'; }).join('') + '</table>';
      var w = W.current && W.current(); $('dtSign').disabled = !(w && w === me); if (viewOnly && !(w && w === me)) $('dtOut').innerHTML = '<p class="small muted">View-only address: connect XCP Wallet with this address to sign.</p>';
    }).catch(function (e) { errOut('dtStatus', e); }).then(function () { $('dtCompose').disabled = false; }); };
  $('dtSign').onclick = function () { if (!composed) return; $('dtSign').disabled = true; $('dtOut').innerHTML = '<p class="small">XCP Wallet window opened. Approve or reject there.</p>';
    W.getWallet().then(function (w) { if (w.address !== me) throw new Error('Connected wallet differs from the address used to build.'); return w.signAndBroadcast(composed); }).then(function (r) {
      var A = encodeURIComponent(plan.asset), tx = encodeURIComponent(r.txid);
      $('dtOut').innerHTML = '<p class="dt-ok">Broadcast. txid: ' + esc(r.txid) + '</p><p><a target="_blank" rel="noopener" href="https://mempool.space/tx/' + tx + '">mempool.space tx ↗</a> · <a target="_blank" rel="noopener" href="https://api.xcp.fun/node/v2/assets/' + A + '">' + esc(plan.asset) + ' on api.xcp.fun ↗</a> · <a target="_blank" rel="noopener" href="https://api.xcp.fun/node/v2/assets/' + A + '/issuances">issuances ↗</a> · <a target="_blank" rel="noopener" href="https://www.xchain.io/asset/' + A + '">XChain ↗</a></p><p class="small muted">The asset appears after the tx confirms. This still does nothing in the game.</p>';
      composed = null; }, function (e) { errOut('dtOut', e); $('dtSign').disabled = false; }); };
})();
