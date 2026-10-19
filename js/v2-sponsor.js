/* XCPETS Circus Maximus sponsorship (owner approved 2026-10-19 6:19 PM CT; DRAFT on battle-arena, NOT LIVE).
 * Anyone can sponsor (name) the arena by BURNING real XCP: a Counterparty send of XCP to the unspendable burn address
 * 1CounterpartyXXXXXXXXXXXXXXXUWLpVr with the memo pet:sponsor:NAME. Opening bid 0.5 XCP; each next bid >= current x 1.2 rounded UP to 0.1 XCP
 * (0.5, 0.6, 0.8, 1.0, 1.2, 1.5, 1.8, 2.2 ...). The highest valid bid HOLDS the billboard until outbid (no weekly reset); a new holder shows from
 * the block AFTER the bid's block. NAME: 1-16 chars, letters/numbers/spaces only (no links, no @handles), bad-word filter. Invalid or too-low
 * sends are still burned (we never hold funds) but do not change the billboard.
 * Separate from V2Rules.replay: pets, items, fights and the replay hashes are untouched. Inert before ACTIVATE_SPONSOR_BLOCK. Pure compute() works in Node. */
(function (root) {
  'use strict';
  var BURN_ADDRESS = '1CounterpartyXXXXXXXXXXXXXXXUWLpVr';
  var ACTIVATE_SPONSOR_BLOCK = 972230; // Counterparty tip 972,224 at 2026-10-19 18:20 CT + 6. Re-set to tip+6 at deploy.
  var SAT = 1e8, OPEN_BID = 0.5 * SAT, TENTH = 0.1 * SAT, NAME_MAX = 16;
  /* bad-word filter: matched on the name lower-cased with spaces and digit look-alikes folded (0->o 1->i 3->e 4->a 5->s 7->t) */
  var BAD = ['fuck', 'shit', 'cunt', 'bitch', 'nigg', 'fag', 'retard', 'whore', 'slut', 'rape', 'nazi', 'hitler', 'porn', 'dick', 'cock', 'pussy', 'kike', 'spic', 'chink', 'twat', 'wank', 'scam', 'rug'];
  function fold(s) { return String(s).toLowerCase().replace(/\s+/g, '').replace(/[013457]/g, function (c) { return { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't' }[c]; }); }
  /** nextMin(q) -> the minimum next bid in sats after a current bid of q sats (null = opening bid). x1.2, rounded UP to 0.1 XCP. */
  function nextMin(q) { if (q == null) return OPEN_BID; return Math.ceil(q * 12 / 10 / TENTH - 1e-9) * TENTH; }
  function memoText(r) { var m = r.memo != null ? r.memo : r.memo_hex != null ? r.memo_hex : r.tag; if (m == null) return '';
    m = String(m); if (/^([0-9a-f]{2})+$/i.test(m) && !/^pet:/i.test(m)) { try { m = decodeURIComponent(m.replace(/(..)/g, '%$1')); } catch (e) { } } return m.trim(); }
  /** checkName(raw) -> { ok, name, why } */
  function checkName(raw) { var n = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
    if (!n) return { ok: false, why: 'empty name' }; if (n.length > NAME_MAX) return { ok: false, why: 'max ' + NAME_MAX + ' characters' };
    if (!/^[A-Za-z0-9 ]+$/.test(n)) return { ok: false, why: 'letters, numbers and spaces only (no links, no @handles)' };
    var f = fold(n); for (var i = 0; i < BAD.length; i++) if (f.indexOf(BAD[i]) >= 0) return { ok: false, why: 'name not allowed' };
    return { ok: true, name: n }; }
  /** parseMemo(memo) -> { ok, name, why } for "pet:sponsor:NAME" (prefix case-insensitive) */
  function parseMemo(m) { var x = /^pet:sponsor:(.*)$/i.exec(String(m || '')); return x ? checkName(x[1]) : { ok: false, why: 'memo is not pet:sponsor:NAME' }; }
  /** compute(sends, tip) -> { holder, pending, nextMin, bids, rejected }. sends = Counterparty send rows (any order) {tx_hash, tx_index, block_index, source,
   *  destination, asset, quantity (sats), memo|memo_hex, status}. Deterministic: chain order (block, tx_index). */
  function compute(sends, tip, opt) { opt = opt || {}; var from = opt.activate != null ? opt.activate : ACTIVATE_SPONSOR_BLOCK, seen = {}, bids = [], rejected = [], cur = null;
    (sends || []).filter(function (r) { return r && r.destination === BURN_ADDRESS && String(r.asset).toUpperCase() === 'XCP' && (r.status == null || String(r.status).toLowerCase() === 'valid') && r.block_index >= from && (tip == null || r.block_index <= tip); })
      .sort(function (a, b) { return a.block_index - b.block_index || (a.tx_index || 0) - (b.tx_index || 0); })
      .forEach(function (r) { if (seen[r.tx_hash]) return; seen[r.tx_hash] = 1; var q = Math.round(Number(r.quantity)), memo = memoText(r), p = parseMemo(memo), need = nextMin(cur ? cur.q : null);
        if (!/^pet:sponsor:/i.test(memo)) return; /* other burns to the address are not bids */
        var why = !p.ok ? p.why : q < need ? 'below minimum bid ' + (need / SAT).toFixed(1) + ' XCP' : null;
        if (why) { rejected.push({ tx: r.tx_hash, block: r.block_index, source: r.source, xcp: q / SAT, memo: memo, why: why }); return; }
        cur = { name: p.name, q: q, xcp: q / SAT, source: r.source, tx: r.tx_hash, block: r.block_index, showsFrom: r.block_index + 1 }; bids.push(cur); });
    var holder = null, pending = null; for (var i = bids.length - 1; i >= 0; i--) { if (tip == null || bids[i].showsFrom <= tip) { holder = bids[i]; break; } if (!pending) pending = bids[i]; }
    return { holder: holder, pending: pending, nextMin: nextMin(cur ? cur.q : null) / SAT, bids: bids, rejected: rejected, active: tip == null || tip >= from, activateBlock: from }; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  /** text lines for result cards and HatchBot arena posts */
  /** at(st, block) -> the bid that held the billboard at that block (for fight result cards) */
  function at(st, b) { var h = null; (st && st.bids || []).forEach(function (x) { if (x.showsFrom <= b) h = x; }); return h; }
  function line(st, b) { if (b != null) { var h = at(st, b); return h ? 'Sponsored by ' + h.name : ''; }
    return lineNow(st); }
  function lineNow(st) { return st && st.holder ? 'Sponsored by ' + st.holder.name : ''; }
  function postLine(st) { return '🏟️ Circus Maximus' + (st && st.holder ? ' · Sponsored by ' + st.holder.name : ''); }
  /** billboard(st) -> HTML for the top of the arena */
  function billboard(st) { var h = st && st.holder, nm = (st ? st.nextMin : OPEN_BID / SAT).toFixed(1);
    return '<div class="sp-board' + (h ? '' : ' sp-open') + '" role="note"><div class="sp-name">' + (h ? 'Sponsored by <b>' + esc(h.name) + '</b>' : 'Sponsor slot open') + '</div>' +
      '<div class="sp-how small">' + (h ? 'held with ' + h.xcp.toFixed(1) + ' XCP burned · ' : '') + 'outbid with ≥ <b>' + nm + ' XCP</b>: send XCP to the Counterparty burn address with memo <code>pet:sponsor:NAME</code> (max 16 letters/numbers/spaces). XCP is burned forever; holds until outbid; shows from the next block.' +
      (st && st.pending ? ' · next up: ' + esc(st.pending.name) + ' (block ' + st.pending.showsFrom + ')' : '') + (st && !st.active ? ' · opens at block ' + st.activateBlock : '') + (st && st.unavailable ? ' · <span class="muted">sponsor feed unavailable right now</span>' : '') + '</div></div>'; }
  /* ---- the back wall: a pixel stone wall with the burn address faintly carved in (part of the art, low contrast; legible up close) */
  var F = { '1': '010110010010111', 'C': '011100100100011', 'o': '000011101101110', 'u': '000101101101011', 'n': '000110101101101', 't': '010111010010011', 'e': '000011111100011', 'r': '000011100100100', 'p': '000110101110100', 'a': '000011101101011', 'y': '000101011001110', 'X': '101101010101101', 'U': '101101101101111', 'W': '101101101111101', 'L': '100100100100111', 'V': '101101101101010', 'r2': '' };
  function wall(c, text) { var x = c.getContext && c.getContext('2d'); if (!x) return; var W = c.width, H = c.height; x.imageSmoothingEnabled = false;
    x.fillStyle = '#2a2238'; x.fillRect(0, 0, W, H);
    for (var y = 0, row = 0; y < H; y += 8, row++) for (var bx = (row % 2) * -8; bx < W; bx += 16) { x.fillStyle = (row * 7 + bx) % 3 ? '#30283f' : '#2d2540'; x.fillRect(bx + 1, y + 1, 14, 6); }
    var s = 1, cw = 4 * s, tw = text.length * cw, ox = Math.max(2, Math.round((W - tw) / 2)), oy = H - 9; x.fillStyle = '#3b3250'; /* carved: only a shade lighter than the stone */
    for (var i = 0; i < text.length; i++) { var g = F[text[i]]; if (!g) continue; for (var k = 0; k < 15; k++) if (g[k] === '1') x.fillRect(ox + i * cw + (k % 3) * s, oy + Math.floor(k / 3) * s, s, s); }
    x.fillStyle = '#251e33'; for (i = 0; i < text.length; i++) { g = F[text[i]]; if (!g) continue; for (k = 0; k < 15; k++) if (g[k] === '1' && (k % 3 === 2 || g[k + 1] !== '1')) x.fillRect(ox + i * cw + (k % 3) * s + 1, oy + Math.floor(k / 3) * s + 1, s, s); } }
  var api = { BURN_ADDRESS: BURN_ADDRESS, ACTIVATE_SPONSOR_BLOCK: ACTIVATE_SPONSOR_BLOCK, OPEN_BID_XCP: OPEN_BID / SAT, NAME_MAX: NAME_MAX, nextMin: function (xcp) { return nextMin(xcp == null ? null : Math.round(xcp * SAT)) / SAT; },
    checkName: checkName, at: at, parseMemo: parseMemo, compute: compute, line: line, postLine: postLine, billboard: billboard, wall: wall, state: null };
  /* browser: read the sends to the burn address (read-only, display only). On any error the billboard shows the open slot. */
  api.load = function (tip, done) { var cfg = root.XCPETS_CONFIG || {}, net = (cfg.networks && cfg.networks.mainnet) || cfg, bases = (net.read || ['https://api.xcp.fun/node/v2']).slice(0, 3), i = 0, out = [];
    function fin(st) { api.state = st; if (done) done(st); }
    function next() { if (i >= bases.length) return fin(Object.assign(compute([], tip), { unavailable: true }));
      var b = bases[i++]; root.fetch(b + '/addresses/' + BURN_ADDRESS + '/sends?limit=1000&verbose=true').then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (j) { if (!j || !Array.isArray(j.result)) throw new Error('no result'); out = j.result; fin(compute(out, tip)); }).catch(next); }
    if (!root.fetch) return fin(Object.assign(compute([], tip), { unavailable: true })); next(); };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.V2Sponsor = api;
})(typeof window !== 'undefined' ? window : globalThis);
