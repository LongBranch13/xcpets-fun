/* Static /pet/<id>/index.html for crawlers (X, Telegram). They do not run JavaScript.
 * Humans are handed to pet.html by js/v2-pet-route.js, which keeps the /pet/<id> address. */
'use strict';
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function shortAddr(s) { s = String(s || ''); return s.length > 16 ? s.slice(0, 6) + '\u2026' + s.slice(-4) : s; }
function page(p) {
  var id = Number(p.id);
  if (!(id >= 1) || id === 1765) throw new Error('refusing pet page for ' + id);
  var name = p.name || 'Pet';
  var title = '#' + id + ' ' + name;
  var bits = [];
  [p.tier, p.stageName || p.stage, p.speciesLabel || p.species, p.owner ? 'owner ' + shortAddr(p.owner) : ''].forEach(function (x) { if (x && bits.indexOf(x) < 0) bits.push(x); });
  var desc = bits.join(' · ') + ' · XCPETS';
  var url = 'https://xcpets.fun/pet/' + id + '?ref=';
  var img = 'https://xcpets.fun/pet/' + id + '/card.png';
  return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">\n' +
    '<title>' + esc(title) + ' · XCPETS</title>\n' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">\n' +
    '<meta name="description" content="' + esc(desc) + '">\n' +
    '<link rel="canonical" href="' + esc(url) + '">\n' +
    '<meta property="og:site_name" content="XCPETS">\n' +
    '<meta property="og:type" content="website">\n' +
    '<meta property="og:title" content="' + esc(title) + '">\n' +
    '<meta property="og:description" content="' + esc(desc) + '">\n' +
    '<meta property="og:url" content="' + esc(url) + '">\n' +
    '<meta property="og:image" content="' + img + '">\n' +
    '<meta property="og:image:width" content="1200">\n' +
    '<meta property="og:image:height" content="630">\n' +
    '<meta property="og:image:alt" content="' + esc(title + ', ' + (p.tier || '') + ' ' + (p.stageName || p.stage || '')) + '">\n' +
    '<meta name="twitter:card" content="summary_large_image">\n' +
    '<meta name="twitter:site" content="@XCPets">\n' +
    '<meta name="twitter:title" content="' + esc(title) + '">\n' +
    '<meta name="twitter:description" content="' + esc(desc) + '">\n' +
    '<meta name="twitter:image" content="' + img + '">\n' +
    '<meta name="twitter:image:alt" content="' + esc(title) + '">\n' +
    '<script>window.__XCPETS_PET_ID=' + id + ';</script>\n' +
    '</head><body>\n' +
    '<p>' + esc(title) + '</p>\n' +
    '<p><a href="/pet.html?id=' + id + '">Open this pet</a></p>\n' +
    '<script src="/js/v2-pet-route.js?v=e6db15afb2"></script>\n' +
    '</body></html>\n';
}
module.exports = { esc: esc, shortAddr: shortAddr, page: page };
