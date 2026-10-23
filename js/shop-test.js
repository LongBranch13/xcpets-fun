/* shop-test.html: hidden live test of the pet-shop flow (owner asked Oct 22 2026), for pet #2. INERT: no game rule reads anything here while
 * ACTIVATE_SPAM_CITY_BLOCK is null. Each step composes an unsigned tx on the site's compose nodes, shows it + the fee, and signs ONLY in XCP Wallet on click.
 * Verified-token check here mirrors V2Rules.deedScan (newest pet:deed tie by the pet's current owner whose token was first issued by that owner, qty 1,
 * indivisible, locked, description = the pet's URL). The buy screen is read only. */
(function () {
  'use strict';
  var CFG = window.XCPETS_CONFIG, W = window.V2Wallet, $ = function (i) { return document.getElementById(i); };
  var READ = (CFG.read || [])[0] || 'https://api.xcp.fun/node/v2', DEED_MIN = '95428956661682177', DEED_MAX = '18446744073709551615', B36 = '0123456789abcdefghijklmnopqrstuvwxyz';
  var me = null, composed = null, plan = null, pet = null, orders = [], verified = null;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function errOut(el, e) { $(el).innerHTML = '<div class="dt-err">' + esc((e && e.message) || e) + '</div>'; }
  function getJ(u) { return fetch(u, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + u); return r.json(); }); }
  function numCmp(a, z) { return a.length - z.length || (a < z ? -1 : a > z ? 1 : 0); }
  function deedOk(a) { var m = /^A([1-9][0-9]{16,19})$/.exec(a || ''); return !!m && numCmp(m[1], DEED_MIN) >= 0 && numCmp(m[1], DEED_MAX) <= 0; }
  function to36(a) { var n = BigInt(String(a).slice(1)), s = ''; while (n > 0n) { s = B36[Number(n % 36n)] + s; n /= 36n; } return s || '0'; }
  function from36(s) { var n = 0n; String(s).split('').forEach(function (c) { n = n * 36n + BigInt(B36.indexOf(c)); }); return 'A' + n.toString(); }
  function randomDeed() { var b = new Uint8Array(8); crypto.getRandomValues(b); var n = 0n; for (var i = 0; i < 8; i++) n = n * 256n + BigInt(b[i]); if (n < BigInt(DEED_MIN)) n += BigInt(DEED_MIN); return 'A' + n; }
  function freeDeed(k) { k = k || 0; var A = randomDeed(); return fetch(READ + '/assets/' + A).then(function (r) { if (r.status === 404) return A; if (k >= 5) throw new Error('no free token name'); return freeDeed(k + 1); }); }
  function id() { return +$('stId').value; }
  function url(id) { return 'https://xcpets.fun/t/' + id + '.json'; }
  function descOk(d, id) { return d === url(id) || d === 'xcpets pet #' + id || d === 'xcpets.fun/t/' + id + '.json' || d === 'http://xcpets.fun/t/' + id + '.json'; }
  function unhex(t) { if (typeof t === 'string' && /^([0-9a-f]{2})+$/i.test(t)) { try { return decodeURIComponent(t.replace(/(..)/g, '%$1')); } catch (e) { } } return t; }
  function firstIss(A) { return getJ(READ + '/assets/' + A + '/issuances?verbose=true').then(function (j) { return (j.result || []).filter(function (i) { return !i.status || i.status === 'valid'; }).sort(function (a, b) { return a.tx_index - b.tx_index; })[0] || null; }, function () { return null; }); }
  function issWhy(i, pid, src, b) { if (!i) return 'token not issued (or not confirmed)'; if ((i.source || i.issuer) !== src) return 'token issued by another address';
    if (b != null && i.block_index > b) return 'token issued after the tie'; if (Number(i.quantity) !== 1 || i.divisible || !i.locked) return 'token is not qty 1 / indivisible / locked';
    if (!descOk(i.description, pid)) return 'description is not this pet\u2019s'; return null; }
  /* newest valid pet:deed:<id>: tie by the current owner (scans XCPETS destructions newest first, up to 3000) */
  function findTie(pid, owner) { var re = new RegExp('^pet:deed:' + pid + ':([0-9a-z]+)$'), ties = [], cur = null, n = 0;
    function page() { return getJ(READ + '/assets/XCPETS/destructions?limit=1000' + (cur ? '&cursor=' + cur : '')).then(function (j) {
      (j.result || []).forEach(function (r) { var m = re.exec(unhex(r.tag) || ''); if (m && (!r.status || r.status === 'valid')) ties.push({ asset: from36(m[1]), block: r.block_index, tx: r.tx_hash, by: r.source, qty: Number(r.quantity) }); });
      cur = j.next_cursor; n++; if (cur && n < 3) return page(); }); }
    return page().then(function () { var mine = ties.filter(function (t) { return t.by === owner && t.qty >= 1; });
      return mine.reduce(function (p, t) { return p.then(function (ok) { return ok || firstIss(t.asset).then(function (i) { return issWhy(i, pid, owner, t.block) ? null : t; }); }); }, Promise.resolve(null))
        .then(function (v) { return { v: v, other: ties.filter(function (t) { return !v || t.tx !== v.tx; }) }; }); }); }
  function refresh() { var pid = id(); $('stStatus').textContent = 'Loading…';
    return getJ('api/pets.json').then(function (j) { pet = j.pets.filter(function (p) { return p.id === pid; })[0];
      if (!pet) throw new Error('pet #' + pid + ' not in the hourly feed');
      return findTie(pid, pet.owner); }).then(function (r) { verified = r.v; var A = $('stAsset').value.trim() || (verified && verified.asset) || '';
      if (!$('stAsset').value && A) $('stAsset').value = A;
      var h = '<p>Pet #' + pid + ' <b>' + esc(pet.name) + '</b>, owner <code>' + esc(pet.owner) + '</code>' + (me && me !== pet.owner ? ' <span class="st-bad">(not your connected address)</span>' : '') + '</p>';
      h += verified ? '<p class="st-ok">✔ Verified token: <code>' + esc(verified.asset) + '</code> (tied in block ' + verified.block + ')</p>' : '<p class="st-bad">Not tied yet: no valid owner tie found.</p>';
      if (A && verified && A !== verified.asset) h += '<p class="st-bad">⚠ ' + esc(A) + ' is NOT the real token of pet #' + pid + '.</p>';
      if (r.other.length) h += '<p class="small muted">Ignored ties (not owner / bad token / replaced): ' + r.other.map(function (t) { return esc(t.asset) + ' by ' + esc(t.by.slice(0, 10)) + '…'; }).join(', ') + '</p>';
      $('stStatus').innerHTML = h + '<p class="small muted">The game does not count this yet (shop off).</p>';
      return A ? book(A) : null; }).catch(function (e) { errOut('stStatus', e); }); }
  function book(A) { return Promise.all(['XCPETS', 'XCP'].map(function (q) { return getJ(READ + '/orders/' + A + '/' + q + '?status=all&verbose=true').then(function (j) { return j.result || []; }, function () { return []; }); })).then(function (r) {
      orders = r[0].concat(r[1]).filter(function (o, i, a) { return a.findIndex(function (x) { return x.tx_hash === o.tx_hash; }) === i; }).sort(function (a, b) { return b.tx_index - a.tx_index; });
      var real = verified && A === verified.asset;
      $('stBook').innerHTML = orders.length ? '<table class="dt-sum">' + orders.map(function (o) { return '<tr><td>' + esc(o.status) + '</td><td>give ' + esc(o.give_quantity) + ' ' + esc(o.give_asset) + ' for ' + esc(o.get_quantity_normalized || o.get_quantity) + ' ' + esc(o.get_asset) + '<br><code>' + esc(o.tx_hash) + '</code> · block ' + o.block_index + ', expires ' + esc(o.expire_index) + '</td></tr>'; }).join('') + '</table>' : 'No orders for ' + esc(A) + '.';
      var open = orders.filter(function (o) { return o.status === 'open' && o.give_asset === A; });
      $('stOrder').innerHTML = open.length ? open.map(function (o) { return '<option value="' + o.tx_hash + '">' + o.tx_hash.slice(0, 12) + '… (' + esc(o.get_quantity_normalized || o.get_quantity) + ' ' + esc(o.get_asset) + ')</option>'; }).join('') : '<option value="">no open listing</option>';
      $('stBuy').innerHTML = !open.length ? 'Nothing for sale.' : open.map(function (o) { return '<p>' + (real ? '<span class="st-ok">✔ real token of pet #' + id() + '</span>' : '<span class="st-bad">⚠ Not the real token: the game would never honour this</span>') +
        '<br>A buyer would compose a DEX order giving <b>' + esc(o.get_quantity_normalized || o.get_quantity) + ' ' + esc(o.get_asset) + '</b> for <b>1 ' + esc(A) + '</b>, matching <code>' + esc(o.tx_hash.slice(0, 16)) + '…</code>. <i>Read only: no buy button in this test.</i></p>'; }).join(''); }); }
  var STEPS = {
    mint: function () { return freeDeed().then(function (A) { return { label: 'Mint token for pet #' + id(), route: 'issuance', q: { asset: A, quantity: 1, divisible: false, lock: true, description: url(id()) }, asset: A }; }); },
    tie: function () { var A = $('stAsset').value.trim(); if (!deedOk(A)) throw new Error('Enter the token (step 1) first.');
      return firstIss(A).then(function (i) { var w = issWhy(i, id(), me, null); if (w) throw new Error('Not tieable: ' + w); return { label: 'Tie ' + A + ' to pet #' + id(), route: 'destroy', q: { asset: 'XCPETS', quantity: 1, tag: 'pet:deed:' + id() + ':' + to36(A) } }; }); },
    list: function () { var A = $('stAsset').value.trim(), g = $('stGet').value, p = Math.round(Number($('stPrice').value) * 1e8); if (!deedOk(A)) throw new Error('Enter the token first.'); if (!(p >= 1)) throw new Error('Bad price.');
      return { label: 'List ' + A, route: 'order', q: { give_asset: A, give_quantity: 1, get_asset: g, get_quantity: p, expiration: 288, fee_required: 0 } }; },
    cancel: function () { var o = $('stOrder').value; if (!o) throw new Error('No open listing selected.'); return { label: 'Cancel order ' + o.slice(0, 12), route: 'cancel', q: { offer_hash: o } }; },
    unsell: function () { var o = $('stOrder').value; if (!o) throw new Error('No open listing selected.'); return { label: 'Unsell burn for ' + o.slice(0, 12), route: 'destroy', q: { asset: 'XCPETS', quantity: 1, tag: 'pet:unsell:' + o.slice(0, 8).toLowerCase() } }; } };
  function check(res, p) { var pr = (res && res.params) || {}, bad = []; if (!/^[0-9a-f]+$/i.test(res.rawtransaction || '')) bad.push('no raw tx');
    if (pr.source && pr.source !== me) bad.push('source differs');
    Object.keys(p.q).forEach(function (k) { if (pr[k] == null) return; var a = pr[k], b = p.q[k]; if (k === 'tag') a = unhex(a); if (typeof b === 'boolean') a = !!a; else if (typeof b === 'number') a = Number(a); if (a !== b) bad.push(k + ' differs'); });
    if (p.route === 'issuance' && pr.transfer_destination) bad.push('has a transfer'); return bad; }
  function compose(p, fee) { var urls = W.composeNodes(), errs = [];
    function go(i) { if (i >= urls.length) return Promise.reject(new Error('Every compose node failed:\n' + errs.join('\n')));
      var q = Object.keys(p.q).map(function (k) { return k + '=' + encodeURIComponent(p.q[k]); }).concat(['encoding=opreturn', 'verbose=true', 'validate=true', 'exclude_utxos_with_balances=true', 'sat_per_vbyte=' + fee]);
      var u = urls[i].replace(/\/+$/, '') + '/addresses/' + encodeURIComponent(me) + '/compose/' + p.route + '?' + q.join('&'), ac = new AbortController(), t = setTimeout(function () { ac.abort(); }, 20000);
      $('stTxStatus').textContent = 'Asking compose node ' + (i + 1) + ' of ' + urls.length + '…';
      return fetch(u, { signal: ac.signal }).then(function (r) { clearTimeout(t); return r.json(); }).then(function (j) { if (j.error) throw new Error(typeof j.error === 'string' ? j.error : JSON.stringify(j.error));
        var bad = check(j.result, p); if (bad.length) throw new Error('compose mismatch: ' + bad.join(', ')); j.result._url = u; return j.result; })
        .catch(function (e) { clearTimeout(t); errs.push(urls[i].replace(/^https?:\/\//, '').replace(/\/.*/, '') + ': ' + (e.name === 'AbortError' ? 'timed out' : e.message)); return go(i + 1); }); }
    return go(0); }
  Array.prototype.forEach.call(document.querySelectorAll('[data-step]'), function (b) { b.onclick = function () {
    composed = null; $('stSign').disabled = true; $('stSum').innerHTML = ''; $('stOut').innerHTML = '';
    if (!me) return errOut('stTxStatus', 'Connect XCP Wallet first.'); if (pet && pet.owner !== me) return errOut('stTxStatus', 'Connected address is not the owner of pet #' + id() + '.');
    var fee; $('stTx').scrollIntoView({ behavior: 'smooth' });
    Promise.resolve().then(function () { return STEPS[b.dataset.step](); }).then(function (p) { plan = p; return W.feeRate(); }).then(function (f) { fee = f; return compose(plan, fee); }).then(function (res) {
      composed = res; var btc = Number(res.btc_fee);
      $('stTxStatus').textContent = 'Built. Nothing has been signed. The game does not count this yet.';
      $('stSum').innerHTML = '<table class="dt-sum">' + [['Step', esc(plan.label)], ['Type', 'compose/' + plan.route]].concat(Object.keys(plan.q).map(function (k) { return [k, '<code>' + esc(plan.q[k]) + '</code>']; }))
        .concat([['BTC miner fee', isFinite(btc) ? btc.toLocaleString() + ' sats (' + (btc / 1e8).toFixed(8) + ' BTC)' : 'not reported'], ['Fee rate', fee + ' sat/vB'], ['Tx size', res.rawtransaction.length / 2 + ' bytes unsigned'], ['From', '<code>' + esc(me) + '</code>'], ['Node', '<code>' + esc(res._url.replace(/\?.*/, '')) + '</code>']])
        .map(function (x) { return '<tr><td>' + x[0] + '</td><td>' + x[1] + '</td></tr>'; }).join('') + '</table>';
      $('stSign').disabled = false; }).catch(function (e) { errOut('stTxStatus', e); }); }; });
  $('stSign').onclick = function () { if (!composed) return; $('stSign').disabled = true; $('stOut').innerHTML = '<p class="small">XCP Wallet window opened. Approve or reject there.</p>';
    W.getWallet().then(function (w) { if (w.address !== me) throw new Error('Connected wallet differs from the address used to build.'); return w.signAndBroadcast(composed); }).then(function (r) {
      if (plan.asset) $('stAsset').value = plan.asset;
      $('stOut').innerHTML = '<p class="dt-ok">Broadcast. txid: ' + esc(r.txid) + '</p><p><a target="_blank" rel="noopener" href="https://mempool.space/tx/' + encodeURIComponent(r.txid) + '">mempool.space ↗</a> · wait for 1 confirmation, then Refresh status.</p>';
      composed = null; }, function (e) { errOut('stOut', e); $('stSign').disabled = false; }); };
  $('stConnect').onclick = function () { $('stConnect').disabled = true; W.getWallet().then(function (w) { me = w.address; $('stMe').textContent = me; $('stConnect').textContent = '✓ Connected'; refresh(); }, function (e) { $('stConnect').disabled = false; errOut('stStatus', e); }); };
  $('stCheck').onclick = refresh; refresh();
})();
