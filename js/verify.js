/* verify.html: genuine = listed in api/ties.json (built by deedScan from on-chain tie burns + first issuances). Anything else is NOT a real tied token. */
(function () { 'use strict';
  var $ = function (i) { return document.getElementById(i); }, T = null;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function show() { var q = ($('vq').value || '').trim(), o = $('vout'); if (!q || !T) return; var hit = null;
    if (/^\d+$/.test(q) && !/^A/i.test(q)) hit = T.ties.filter(function (t) { return String(t.id) === q; })[0];
    else hit = T.ties.filter(function (t) { return t.asset === q; })[0]; /* exact match only: no case or unicode folding */
    if (hit) o.innerHTML = '✅ <b>GENUINE</b>: ' + esc(hit.asset) + ' is the one real token of <a href="pet.html?id=' + hit.id + '">pet #' + hit.id + '</a>' + (hit.name ? ' (' + esc(hit.name) + ')' : '') + '.';
    else if (/^\d+$/.test(q)) o.innerHTML = '⚠️ Pet #' + esc(q) + ' has <b>no tied token</b>. Any token offered for it is NOT real.';
    else o.innerHTML = '❌ <b>NOT A REAL PET TOKEN</b>: ' + esc(q) + ' is not tied to any pet. It gets no Proof of Pet and moves nothing, even if its picture and description look right.'; }
  $('vf').addEventListener('submit', function (e) { e.preventDefault(); show(); });
  fetch('api/ties.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) { T = j;
    $('vlist').innerHTML = j.ties.map(function (t) { return '<div><code>' + esc(t.asset) + '</code> → <a href="pet.html?id=' + t.id + '">#' + t.id + '</a></div>'; }).join('') + '<p>' + j.count + ' tokens, chain block ' + j.lastBlock + '.</p>';
    var q = new URLSearchParams(location.search).get('asset') || new URLSearchParams(location.search).get('id'); if (q) { $('vq').value = q; show(); } })
    .catch(function () { $('vlist').textContent = 'Could not load the list. Try again later.'; });
})();
