/* XCPETS: full trait list (same fields as the generator, via PetCore.describe) for a replayed real-game pet. */
(function (root, f) { var m = f(); if (typeof module === 'object' && module.exports) module.exports = m; else root.XcpetsDetails = m; })(typeof self !== 'undefined' ? self : this, function () {
  var SLOT = { band: 'Band', armor: 'Armor', cape: 'Cape', weapon: 'Weapon', crown: 'Crown', face: 'Face', back: 'Back', feet: 'Feet' };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function rows(PetCore, p) {
    var a = p.art, d = PetCore.describe(a, p.stage), out = [];
    ['Tier', 'Species', 'Pattern', 'Eyes', 'Cheeks', 'Shades', 'Background', 'Stage', 'Expression'].forEach(function (k) { if (d[k] != null) out.push([k, d[k]]); });
    var eq = p.equip || {}, slots = Object.keys(eq);
    if (!slots.length) out.push(['Gear', 'None']);
    slots.forEach(function (s) { var r = (p.rolls || []).filter(function (x) { return x.slot === s && x.item === eq[s]; }).pop(); out.push(['Gear · ' + (SLOT[s] || s), r ? r.label : eq[s]]); });
    out.push(['DNA', a.dna]);
    var st = PetCore.stats(a, p.stage, p.care);
    PetCore.STAT_KEYS.forEach(function (k) { out.push([k.charAt(0).toUpperCase() + k.slice(1), st[k] != null ? st[k] : a.baseStats[k]]); });
    out.push(['Power', st.power]);
    return out;
  }
  function html(PetCore, p) {
    return '<details class="traits"><summary>Details</summary><table>' + rows(PetCore, p).map(function (r) {
      return '<tr><th>' + esc(r[0]) + '</th><td' + (r[0] === 'DNA' ? ' class="dna"' : '') + '>' + esc(r[1]) + '</td></tr>'; }).join('') + '</table></details>';
  }
  return { rows: rows, html: html };
});
