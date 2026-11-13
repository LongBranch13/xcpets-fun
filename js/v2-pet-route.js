/* /pet/<id> on GitHub Pages. A real pet/<id>/index.html (when one was generated) already
 * has the og tags. This script then loads pet.html in place so the address stays /pet/<id>.
 * Missing ids hit 404.html, which loads this same script. Crawlers do not run it. */
(function () {
  'use strict';
  function idOf() {
    var m = String(location.pathname || '').match(/\/pet\/(\d+)\/?$/);
    if (m) return +m[1];
    if (window.__XCPETS_PET_ID >= 1) return +window.__XCPETS_PET_ID;
    return 0;
  }
  var id = idOf();
  if (!(id > 0) || document.getElementById('petCard')) return;
  window.__XCPETS_PET_ID = id;
  document.documentElement.style.visibility = 'hidden';
  fetch('/pet.html', { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error('pet'); return r.text(); }).then(function (html) {
    var tag = '<base href="/"><script>window.__XCPETS_PET_ID=' + id + ';<\/script>';
    if (/<head[^>]*>/i.test(html)) html = html.replace(/<head[^>]*>/i, function (h) { return h + tag; });
    else html = tag + html;
    document.open();
    document.write(html);
    document.close();
  }).catch(function () {
    document.documentElement.style.visibility = '';
    location.replace('/pet.html?id=' + id + (location.search || ''));
  });
})();
