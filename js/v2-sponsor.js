/* XCPETS X Circus Kekimus "presented by" strip (battle-arena DRAFT, NOT LIVE).
 * 2026-10-19 8:53 PM CT: the XCP-burn sponsorship bid mechanic (pet:sponsor:NAME destroys, 0.5 XCP opening bid, x1.2 steps, hold until outbid,
 * name filter, chain reads) was RETIRED by the owner. Replaced by FIXED pseudo-sponsors: a hard-coded list of Counterparty projects, rotated
 * deterministically by block (one per chain day of 144 blocks). No user input, no burns, no network reads. Display only: pets, fights and the
 * replay hashes are untouched. Pure functions work in Node. */
(function (root) {
  'use strict';
  var SPONSORS = ['XCP.fun', 'DigiRare.com', 'Dank Rares', 'Rare Pepe', 'Spells of Genesis', 'Bitcorn Crops', 'Bitcoin Stamps', 'SaruTobi'];
  /** sponsorAt(block) -> the fixed sponsor shown at that block (rotates every 144 blocks) */
  function sponsorAt(b) { b = Math.max(0, Math.floor(Number(b) || 0)); return SPONSORS[Math.floor(b / 144) % SPONSORS.length]; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function tipOf(st) { return st && st.tip != null ? st.tip : 0; }
  /** line(st, block) -> 'Presented by NAME' for a fight at that block (or the current tip) */
  function line(st, b) { return 'Presented by ' + sponsorAt(b != null ? b : tipOf(st)); }
  function postLine(st) { return '🏟️ X Circus Kekimus · ' + line(st); }
  /** billboard(st) -> HTML for the top of the arena (same board look) */
  function billboard(st) { return '<div class="sp-board" role="note"><div class="sp-name">Presented by <b>' + esc(sponsorAt(tipOf(st))) + '</b></div></div>'; }
  /* ---- the back wall: a pixel stone wall with "All XCP becomes spectacle" faintly carved in (owner 6:48 PM CT; part of the art, low contrast; legible up close).
   * No burn address on the wall (decorative carving only). */
  var WALL_TEXT = 'All XCP becomes spectacle';
  var F = { '1': '010110010010111', 'C': '011100100100011', 'o': '000011101101110', 'u': '000101101101011', 'n': '000110101101101', 't': '010111010010011', 'e': '000011111100011', 'r': '000011100100100', 'p': '000110101110100', 'a': '000011101101011', 'y': '000101011001110', 'X': '101101010101101', 'U': '101101101101111', 'W': '101101101111101', 'L': '100100100100111', 'V': '101101101101010', 'P': '110101110100100', 'b': '100100110101110', 'd': '001001011101011', 'h': '100100110101101', 'A': '010101111101101', 'l': '110010010010111', 'c': '000011100100011', 'm': '000111111101101', 's': '000011110001110' };
  function wall(c, text) { var x = c.getContext && c.getContext('2d'); if (!x) return; var W = c.width, H = c.height; x.imageSmoothingEnabled = false;
    x.fillStyle = '#2a2238'; x.fillRect(0, 0, W, H);
    for (var y = 0, row = 0; y < H; y += 8, row++) for (var bx = (row % 2) * -8; bx < W; bx += 16) { x.fillStyle = (row * 7 + bx) % 3 ? '#30283f' : '#2d2540'; x.fillRect(bx + 1, y + 1, 14, 6); }
    var s = 1, cw = 4 * s, tw = text.length * cw, ox = Math.max(2, Math.round((W - tw) / 2)), oy = H - 9; x.fillStyle = '#3b3250'; /* carved: only a shade lighter than the stone */
    for (var i = 0; i < text.length; i++) { var g = F[text[i]]; if (!g) continue; for (var k = 0; k < 15; k++) if (g[k] === '1') x.fillRect(ox + i * cw + (k % 3) * s, oy + Math.floor(k / 3) * s, s, s); }
    x.fillStyle = '#251e33'; for (i = 0; i < text.length; i++) { g = F[text[i]]; if (!g) continue; for (k = 0; k < 15; k++) if (g[k] === '1' && (k % 3 === 2 || g[k + 1] !== '1')) x.fillRect(ox + i * cw + (k % 3) * s + 1, oy + Math.floor(k / 3) * s + 1, s, s); } }
  var api = { SPONSORS: SPONSORS.slice(), sponsorAt: sponsorAt, line: line, at: function (st, b) { return { name: sponsorAt(b) }; }, postLine: postLine, billboard: billboard, wall: wall, WALL_TEXT: WALL_TEXT, state: null };
  /** load(tip): no network; just records the tip the strip rotates by */
  api.load = function (tip, done) { api.state = { tip: tip }; if (done) done(api.state); };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.V2Sponsor = api;
})(typeof window !== 'undefined' ? window : globalThis);
