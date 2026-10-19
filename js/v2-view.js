/* XCPETS view pets by address (2026-10-19, branch address-lookup). READ-ONLY: type or paste a Counterparty/Bitcoin address and the
 * existing view-only path (play.html?addr=ADDRESS, js/v2-chain.js) shows that address's pets. This file never signs, never sends,
 * never talks to a wallet and never changes game rules. It only checks the address (bech32 / bech32m / base58check checksums, mainnet),
 * remembers the last viewed address in this browser, and tells the play page whether it is in view-only mode so wallet actions
 * (feed, equip, battle, breed, rolls) stay disabled and show the connect prompt instead.
 * A connected XCP Wallet wins: viewing another address asks first, and Stop viewing goes back to the wallet's own pets.
 * Browser: window.V2View. Node (tests): module.exports = { check }. */
(function (root) {
  'use strict';
  var ME_KEY = 'xcpets-v2-me', ADDR_KEY = 'xcpets-xcpwallet-address', VIEW_KEY = 'xcpets-v2-view';
  var ls = { get: function (k) { try { return root.localStorage.getItem(k) || ''; } catch (e) { return ''; } },
    set: function (k, v) { try { root.localStorage.setItem(k, v); } catch (e) { } }, del: function (k) { try { root.localStorage.removeItem(k); } catch (e) { } } };

  /* ---- SHA-256 over a byte array (for base58check) */
  var K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  function sha256(bytes) {
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19], m = bytes.slice(), n = bytes.length, i, j;
    m.push(0x80); while (m.length % 64 !== 56) m.push(0); for (i = 7; i >= 0; i--) m.push(i > 3 ? 0 : (n * 8 >>> (i * 8)) & 255);
    var w = new Array(64), rr = function (x, s) { return (x >>> s) | (x << (32 - s)); };
    for (i = 0; i < m.length; i += 64) {
      for (j = 0; j < 16; j++) w[j] = (m[i + 4 * j] << 24) | (m[i + 4 * j + 1] << 16) | (m[i + 4 * j + 2] << 8) | m[i + 4 * j + 3];
      for (j = 16; j < 64; j++) { var s0 = rr(w[j - 15], 7) ^ rr(w[j - 15], 18) ^ (w[j - 15] >>> 3), s1 = rr(w[j - 2], 17) ^ rr(w[j - 2], 19) ^ (w[j - 2] >>> 10); w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0; }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (j = 0; j < 64; j++) { var t1 = (h + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & f) ^ (~e & g)) + K[j] + w[j]) | 0, t2 = ((rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0; }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0; H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0; }
    var out = []; H.forEach(function (x) { out.push((x >>> 24) & 255, (x >>> 16) & 255, (x >>> 8) & 255, x & 255); }); return out; }

  /* ---- base58check: legacy 1... (P2PKH, version 0x00) and 3... (P2SH, version 0x05) */
  var B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  function b58(s) { var bytes = [0]; for (var i = 0; i < s.length; i++) { var c = B58.indexOf(s[i]); if (c < 0) return null;
      for (var j = 0; j < bytes.length; j++) { c += bytes[j] * 58; bytes[j] = c & 255; c >>= 8; } while (c) { bytes.push(c & 255); c >>= 8; } }
    for (var k = 0; k < s.length && s[k] === '1'; k++) bytes.push(0); return bytes.reverse(); }
  function legacyOk(s) { var b = b58(s); if (!b) return null; while (b.length > 25 && b[0] === 0) b.shift(); if (b.length !== 25) return false;
    var body = b.slice(0, 21), sum = sha256(sha256(body)); if (sum[0] !== b[21] || sum[1] !== b[22] || sum[2] !== b[23] || sum[3] !== b[24]) return false;
    return (s[0] === '1' && b[0] === 0) || (s[0] === '3' && b[0] === 5); }

  /* ---- bech32 (BIP173, bc1q... witness v0) and bech32m (BIP350, bc1p... taproot v1) */
  var CH = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l', GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  function polymod(v) { var c = 1; for (var i = 0; i < v.length; i++) { var b = c >>> 25; c = ((c & 0x1ffffff) << 5) ^ v[i]; for (var j = 0; j < 5; j++) if ((b >>> j) & 1) c ^= GEN[j]; } return c >>> 0; }
  function segwitOk(s) { var d = [], i; for (i = 3; i < s.length; i++) { var x = CH.indexOf(s[i]); if (x < 0) return false; d.push(x); }
    if (d.length < 7) return false; var pm = polymod([3, 3, 0, 2, 3].concat(d)), ver = d[0]; /* hrp 'bc' expanded */
    if (!(ver === 0 && pm === 1) && !(ver === 1 && pm === 0x2bc830a3)) return false;
    var acc = 0, bits = 0, prog = []; for (i = 1; i < d.length - 6; i++) { acc = (acc << 5) | d[i]; bits += 5; if (bits >= 8) { bits -= 8; prog.push((acc >>> bits) & 255); } }
    if (bits >= 5 || ((acc << (8 - bits)) & 255)) return false;
    return ver === 0 ? (prog.length === 20 || prog.length === 32) : prog.length === 32; }

  /** clean(raw): trims pasted text: spaces / line breaks / zero-width characters anywhere, a 'bitcoin:' prefix, ?amount=... and quotes. */
  function clean(raw) { var s = String(raw == null ? '' : raw).replace(/[\s\u200b-\u200d\u2060\ufeff]+/g, '');
    s = s.replace(/^bitcoin:/i, '').replace(/[?#].*$/, '').replace(/^["'<(\[]+|["'>)\].,;:]+$/g, ''); return s; }
  /** check(raw): { ok, addr, error }. addr is the canonical form (bech32 lower-case). */
  function check(raw) { var s = clean(raw);
    if (!s) return { ok: false, error: 'Type or paste a Bitcoin address first.' };
    if (/^(tb1|bcrt1)/i.test(s) || /^[mn2][1-9A-HJ-NP-Za-km-z]{25,34}$/.test(s)) return { ok: false, error: 'That looks like a testnet address. XCPETS runs on Bitcoin mainnet: use an address starting with bc1q, bc1p, 1 or 3.' };
    if (/^bc1/i.test(s)) { if (s !== s.toLowerCase() && s !== s.toUpperCase()) return { ok: false, error: 'That address mixes capital and small letters. Paste it again exactly as your wallet shows it.' };
      s = s.toLowerCase(); if (!/^bc1[qp]/.test(s)) return { ok: false, error: 'Use an address starting with bc1q, bc1p, 1 or 3.' };
      if (s.length < 42 || s.length > 62) return { ok: false, error: 'That address is too ' + (s.length < 42 ? 'short' : 'long') + '. Check that you copied all of it.' };
      return segwitOk(s) ? { ok: true, addr: s } : { ok: false, error: 'That address has a typo (its checksum does not match). Check it and try again.' }; }
    if (/^[13]/.test(s)) { if (!/^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/.test(s)) return { ok: false, error: 'That doesn\'t look like a Bitcoin address. Check that you copied all of it.' };
      return legacyOk(s) ? { ok: true, addr: s } : { ok: false, error: 'That address has a typo (its checksum does not match). Check it and try again.' }; }
    return { ok: false, error: 'That doesn\'t look like a Bitcoin address. Use one that starts with bc1q, bc1p, 1 or 3.' }; }
  if (typeof module === 'object' && module.exports) { module.exports = { check: check, clean: clean }; return; }

  var doc = root.document, loc = root.location;
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function q(k) { try { return new URLSearchParams(loc.search).get(k) || ''; } catch (e) { return ''; } }
  function short(a) { a = String(a || ''); return a.length > 16 ? a.slice(0, 8) + '…' + a.slice(-4) : a; }
  /** the address the page shows: same rule as js/v2-chain.js (?addr= first, then the saved one). */
  function me() { return (root.V2Mock && root.V2Mock.ME) || q('addr') || ls.get(ME_KEY); }
  function walletAddr() { return ls.get(ADDR_KEY); }
  /** viewOnly(): the page shows an address that is not this browser's XCP Wallet. Wallet actions are disabled. */
  function viewOnly() { var m = me(); if (!m) return false; var cur = root.V2Wallet && root.V2Wallet.current && root.V2Wallet.current(); if (cur && cur === m) return false; return walletAddr() !== m; }
  function remembered() { return ls.get(VIEW_KEY); }
  /** view(raw): check, ask first if a different XCP Wallet is connected, remember, then open play.html?addr=. Returns an error string or ''. */
  function view(raw) { var c = check(raw); if (!c.ok) return c.error; var w = walletAddr();
    if (w && c.addr === w) { ls.del(VIEW_KEY); ls.set(ME_KEY, w); loc.href = 'play.html'; return ''; } /* your own wallet: the normal, connected view */
    if (w && !root.confirm('Your XCP Wallet (' + short(w) + ') is connected in this browser.\n\nView ' + c.addr + ' instead? It is view only: nothing can be fed, equipped or burned. Your wallet stays connected; tap Stop viewing to go back to your own pets.')) return 'Kept your XCP Wallet pets. Nothing changed.';
    ls.set(VIEW_KEY, c.addr); loc.href = 'play.html?addr=' + encodeURIComponent(c.addr); return ''; }
  /** stop(): forget the viewed address and go back to the connected wallet's pets (or to the not-connected page). */
  function stop(stay) { ls.del(VIEW_KEY); var w = walletAddr(), m = ls.get(ME_KEY); if (w) ls.set(ME_KEY, w); else if (m) ls.del(ME_KEY);
    if (!stay) loc.href = 'play.html'; }

  /* ---- the box (static HTML in play.html / index.html, form.addrview); bound here so it works before the chain finishes loading */
  function bind(form) { if (!form || form._av) return; form._av = 1;
    var inp = form.querySelector('input'), err = form.querySelector('.av-err'), st = form.querySelector('.av-state'), onPlay = form.getAttribute('data-page') === 'play';
    function say(t) { err.textContent = t || ''; err.hidden = !t; inp.setAttribute('aria-invalid', t ? 'true' : 'false'); }
    function paint() { var v = onPlay && viewOnly() ? me() : '', r = remembered();
      if (v) { st.innerHTML = '👀 Viewing <code class="av-addr">' + esc(v) + '</code>: view only <button type="button" class="q" data-avstop="1">Stop viewing</button>'; if (!inp.value) inp.value = v; }
      else if (r) { st.innerHTML = '<span class="muted">Last viewed <code class="av-addr">' + esc(r) + '</code></span> <button type="button" class="q" data-avclear="1">Clear</button>'; if (!inp.value) inp.value = r; }
      else st.innerHTML = '';
      st.hidden = !st.innerHTML;
      var b = st.querySelector('[data-avstop]'); if (b) b.onclick = function () { inp.value = ''; stop(); };
      var c = st.querySelector('[data-avclear]'); if (c) c.onclick = function () { inp.value = ''; say(''); stop(true); paint(); inp.focus(); }; }
    form.addEventListener('submit', function (e) { e.preventDefault(); say(view(inp.value)); });
    inp.addEventListener('input', function () { if (!err.hidden) say(''); });
    paint(); form._paint = paint; }
  function bindAll() { Array.prototype.forEach.call(doc.querySelectorAll('form.addrview'), bind); }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', bindAll); else bindAll();

  /* view-only hides wallet controls (owner 2026-10-19 8:03 AM CT): html.viewonly + css/style.css hide every owner, burn and equip control
   * (feed/roll/hatch/breed/battle/discard/release/keep, auto-equip, take off, grave buttons); the pets, gear and stats stay visible. */
  function mark() { try { doc.documentElement.classList.toggle('viewonly', viewOnly()); } catch (e) { } }
  mark(); if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', mark);
  root.V2View = { check: check, clean: clean, viewOnly: viewOnly, me: me, walletAddr: walletAddr, remembered: remembered, view: view, stop: stop, short: short, bindAll: bindAll, mark: mark };
})(typeof self !== 'undefined' ? self : this);
