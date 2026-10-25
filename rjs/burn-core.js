/*!
 * XCPETS burn-core.js — pure helpers for the burn builder (site/burn.html).
 * Builds the destroy tag, converts token amounts to raw units, checks minimums and burnability, and builds the
 * Counterparty API v2 compose URL. It NEVER signs, never broadcasts and never sees a key: compose returns an
 * UNSIGNED transaction that the player signs in their own wallet.
 * Browser (window.BurnCore) and Node (require). Uses GameCore (game-core.js) to round-trip every tag.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./game-core.js'), require('./config.js'));
  else root.BurnCore = factory(root.GameCore, root.XCPETS_CONFIG);
})(typeof self !== 'undefined' ? self : this, function (GameCore, CFG) {
  'use strict';
  CFG = CFG || null; // XCPETS_CONFIG (config.js); null = mainnet constants below

  var ASSET = CFG ? CFG.asset : 'XCPETS';
  var MAX_TAG_BYTES = 34;            // counterparty-core destroy.py MAX_TAG_LENGTH: longer tags are silently truncated
  var DECIMALS = 8;                  // divisible assets: 1 token = 1e8 raw units
  var MAX_INT = '9223372036854775807'; // counterparty-core config.MAX_INT
  var DEFAULT_COMPOSE_API = CFG ? CFG.compose : 'https://api.counterparty.io:4000/v2';
  var READ_API = CFG ? CFG.read[0] : 'https://api.xcp.fun/node/v2';
  var LAUNCH_API = CFG ? CFG.launch : 'https://api.xcp.fun/v2'; // null on testnets (xcp.fun is mainnet-only)
  var ESCROW_ADDRESS = CFG ? CFG.burnAddr : '1CounterpartyXXXXXXXXXXXXXXXUWLpVr';
  var NETWORK = CFG ? CFG.network : 'mainnet';

  /** Actions offered by the builder (WHITEPAPER §4). minKey indexes GameCore.COSTS; null = no minimum. */
  var ACTIONS = [
    { id: 'plain', label: 'Plain burn (no tag): feeds the community pet', minKey: null, id_: 'none', name: false, help: 'Any XCPETS destroy feeds the community pet and counts on the burner board. No tag needed.' },
    { id: 'feed', label: 'pet:feed — feed the community pet (feeder board)', minKey: 'feed', id_: 'none', name: false, help: 'Feeds the community pet and also counts on the community feeder board.' },
    { id: 'hatch', label: 'pet:hatch — hatch your own pet', minKey: 'hatch', id_: 'none', name: false, help: 'Hatches a new pet owned by this address. Its look comes from the block hash your burn lands in plus the tx hash. The whole amount becomes its starting care.' },
    { id: 'feedPet', label: 'pet:feed:ID — feed pet #ID (anyone can)', minKey: 'feedPet', id_: 'required', name: false, help: 'Adds the amount to pet #ID\'s care. Gifting to other players\' pets is allowed.' },
    { id: 'play', label: 'pet:play / pet:play:ID — play with your newest pet (or #ID)', minKey: 'play', id_: 'optional', name: false, help: 'Adds care and +1 play to your newest pet, or to pet #ID.' }
  ];
  function action(id) { for (var i = 0; i < ACTIONS.length; i++) if (ACTIONS[i].id === id) return ACTIONS[i]; return null; }

  function utf8Len(s) { return unescape(encodeURIComponent(s)).length; }

  /**
   * buildTag(actionId, {petId, name}) -> {ok, tag, parsed} | {ok:false, error}
   * The tag is lowercase "pet:" + uppercase name (the indexer uppercases anyway). Every tag is parsed back with
   * GameCore.parseTag and must give the same action, pet id and name, and must fit the 34-byte destroy tag.
   */
  function buildTag(actionId, opts) {
    opts = opts || {};
    var a = action(actionId); if (!a) return { ok: false, error: 'unknown action' };
    var idStr = opts.petId == null ? '' : String(opts.petId).trim().replace(/^#/, '');
    var name = opts.name == null ? '' : String(opts.name).trim().toUpperCase();
    if (a.id_ === 'none' && idStr) return { ok: false, error: 'this action takes no pet id' };
    if (a.id_ === 'required' && !idStr) return { ok: false, error: 'enter a pet id' };
    if (idStr && !/^[0-9]{1,9}$/.test(idStr)) return { ok: false, error: 'pet id must be a whole number (1-9 digits)' };
    if (idStr && Number(idStr) < 1) return { ok: false, error: 'pet ids start at 1' };
    idStr = idStr ? String(Number(idStr)) : '';
    if (a.name && !/^[A-Z][A-Z0-9_-]{0,15}$/.test(name)) return { ok: false, error: 'name must be 1-16 characters A-Z 0-9 _ -, starting with a letter' };
    var tag;
    switch (a.id) {
      case 'plain': tag = ''; break;
      case 'feed': tag = 'pet:feed'; break;
      case 'hatch': tag = 'pet:hatch'; break;
      case 'feedPet': tag = 'pet:feed:' + idStr; break;
      default: tag = 'pet:' + a.id + (idStr ? ':' + idStr : '');
    }
    if (utf8Len(tag) > MAX_TAG_BYTES) return { ok: false, error: 'tag is ' + utf8Len(tag) + ' bytes; destroy tags are cut at ' + MAX_TAG_BYTES };
    var p = GameCore.parseTag(tag), want = a.id === 'plain' ? 'none' : a.id;
    if (p.action !== want) return { ok: false, error: 'internal: tag did not round-trip (' + p.action + ')' };
    if (idStr && p.petId !== Number(idStr)) return { ok: false, error: 'internal: pet id did not round-trip' };
    if (a.name && p.name !== name) return { ok: false, error: 'internal: name did not round-trip' };
    return { ok: true, tag: tag, parsed: p };
  }

  /** "1,234.5" -> "123450000000" (string, exact; no floating point). Throws on bad input. */
  function toRaw(amount, divisible) {
    if (divisible == null) divisible = true;
    var s = String(amount == null ? '' : amount).trim().replace(/[,_\s]/g, '');
    if (!/^[0-9]*\.?[0-9]*$/.test(s) || s === '' || s === '.') throw new Error('enter an amount like 100 or 2500.5');
    var parts = s.split('.'), whole = parts[0] || '0', frac = parts[1] || '';
    var dec = divisible ? DECIMALS : 0;
    if (frac.length > dec) throw new Error(divisible ? 'at most 8 decimal places' : 'this asset is indivisible: whole numbers only');
    var raw = (whole + (frac + '00000000').slice(0, dec)).replace(/^0+(?=\d)/, '');
    if (/^0+$/.test(raw)) throw new Error('amount must be greater than 0');
    if (raw.length > MAX_INT.length || (raw.length === MAX_INT.length && raw > MAX_INT)) throw new Error('amount too large');
    return raw;
  }
  /** "123450000000" -> "1,234.5" */
  function fromRaw(raw, divisible) {
    if (divisible == null) divisible = true;
    var s = String(raw == null ? '0' : raw).replace(/^0+(?=\d)/, '');
    var dec = divisible ? DECIMALS : 0, whole = s, frac = '';
    if (dec) { s = ('000000000' + s).slice(-Math.max(s.length, dec + 1)); whole = s.slice(0, -dec); frac = s.slice(-dec).replace(/0+$/, ''); }
    whole = whole.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return whole + (frac ? '.' + frac : '');
  }
  function cmpRaw(a, b) { a = String(a).replace(/^0+(?=\d)/, ''); b = String(b).replace(/^0+(?=\d)/, ''); return a.length !== b.length ? (a.length < b.length ? -1 : 1) : (a < b ? -1 : a > b ? 1 : 0); }

  /** Rough mainnet address check (legacy, P2SH, bech32 v0, taproot). The compose node does the real validation. */
  function isAddress(a) {
    if (CFG) return CFG.isAddress(a);
    a = String(a || '').trim();
    return /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(a) || /^bc1q[02-9ac-hj-np-z]{38}([02-9ac-hj-np-z]{20})?$/.test(a) || /^bc1p[02-9ac-hj-np-z]{58}$/.test(a);
  }

  /**
   * burnable({asset, launch, balanceRaw}) -> {burnable, state, message}
   * asset: GET /assets/XCPETS result (or null), launch: xcp.fun launch record (or null), balanceRaw: the address's
   * XCPETS balance in raw units (string; null = unknown / no address).
   */
  function burnable(info) {
    info = info || {};
    var launch = info.launch, phase = launch && launch.phase;
    if (!info.asset) return { burnable: false, state: 'missing', message: ASSET + ' was not found on Counterparty.' };
    if (phase && phase !== 'graduated') {
      var sold = launch.earned_quantity ? fromRaw(launch.earned_quantity) : '?';
      return { burnable: false, state: 'escrow', message: 'Not burnable until graduation. The xcp.fun sale is still ' + phase + ' (' + sold + ' of 69,000,000 sold' +
        (launch.current_deadline_block ? ', deadline block ' + launch.current_deadline_block : '') + '). Until it sells out, every minted ' + ASSET +
        ' sits in protocol escrow, so no wallet holds any to burn. If the sale misses the deadline, minters are refunded and there is no game.' };
    }
    if (info.balanceRaw == null) return { burnable: true, state: 'open', message: ASSET + ' has graduated: tokens are burnable. Enter your address to check your balance.' };
    if (cmpRaw(info.balanceRaw, '0') <= 0) return { burnable: false, state: 'empty', message: 'This address holds no ' + ASSET + '.' };
    return { burnable: true, state: 'open', message: 'Balance: ' + fromRaw(info.balanceRaw) + ' ' + ASSET + '.' };
  }

  /** validate({actionId, raw, balanceRaw, costs}) -> {errors:[], warnings:[]}; raw = toRaw(amount). */
  function checkAmount(o) {
    var errors = [], warnings = [], a = action(o.actionId), costs = o.costs || GameCore.COSTS;
    if (a && a.minKey) {
      var minRaw = toRaw(costs[a.minKey], true);
      if (cmpRaw(o.raw, minRaw) < 0) errors.push('Minimum for ' + (a.id === 'feedPet' ? 'pet:feed:ID' : 'pet:' + a.id) + ' is ' + fromRaw(minRaw) + ' ' + ASSET +
        '. A smaller burn would only feed the community pet and do nothing else.');
    }
    if (o.balanceRaw != null && cmpRaw(o.raw, o.balanceRaw) > 0) errors.push('Amount is more than this address holds (' + fromRaw(o.balanceRaw) + ' ' + ASSET + ').');
    return { errors: errors, warnings: warnings };
  }

  /** The compose URL (GET). Refuses anything that is not a compose/destroy route. */
  function composeUrl(base, address, p) {
    base = String(base || DEFAULT_COMPOSE_API).trim().replace(/\/+$/, '');
    if (!/^https?:\/\/[^\s?#]+$/.test(base)) throw new Error('API base must be an http(s) URL without ? or #');
    if (/broadcast|sign/i.test(base)) throw new Error('refusing an API base that mentions broadcast/sign');
    if (!/\/v2$/.test(base)) base += '/v2';
    var q = ['asset=' + encodeURIComponent(p.asset || ASSET), 'quantity=' + encodeURIComponent(p.quantityRaw), 'tag=' + encodeURIComponent(p.tag || ''),
      'encoding=opreturn', 'verbose=true', 'validate=true', 'exclude_utxos_with_balances=true'];
    if (p.satPerVbyte != null && p.satPerVbyte !== '') {
      var f = Number(p.satPerVbyte);
      if (!(f > 0 && f <= 1000)) throw new Error('fee rate must be between 0 and 1000 sat/vB');
      q.push('sat_per_vbyte=' + f);
    }
    var url = base + '/addresses/' + encodeURIComponent(String(address).trim()) + '/compose/destroy?' + q.join('&');
    if (!/\/compose\/destroy\?/.test(url)) throw new Error('internal: not a compose route');
    return url;
  }

  /* ---- audit-fixes: independent raw-tx decode (no library). We never trust the node's echo alone. ---- */
  var MAX_FEE_SATS = 50000;            /* hard cap: a destroy is ~250 vB, so even 200 sat/vB stays far below this */
  function hexBytes(h) { var o = []; for (var i = 0; i < h.length; i += 2) o.push(parseInt(h.substr(i, 2), 16)); return o; }
  function bytesHex(a) { var s = ''; for (var i = 0; i < a.length; i++) s += (a[i] < 16 ? '0' : '') + a[i].toString(16); return s; }
  /** decodeRawTx(hex) -> {version, ins:[{txid, vout}], outs:[{value, script}], vsize} ; throws on anything malformed or trailing bytes */
  function decodeRawTx(hex) {
    if (typeof hex !== 'string' || !/^([0-9a-f]{2})+$/i.test(hex)) throw new Error('raw transaction is not hex');
    var b = hexBytes(hex.toLowerCase()), p = 0, seg = false;
    function need(n) { if (p + n > b.length) throw new Error('raw transaction is truncated'); }
    function u32() { need(4); var v = b[p] + b[p + 1] * 256 + b[p + 2] * 65536 + b[p + 3] * 16777216; p += 4; return v; }
    function u64() { need(8); var v = 0; for (var i = 7; i >= 0; i--) v = v * 256 + b[p + i]; p += 8; if (v > 2100000000000000) throw new Error('output value out of range'); return v; }
    function vi() { need(1); var x = b[p++]; if (x < 0xfd) return x; if (x === 0xfd) { need(2); x = b[p] + b[p + 1] * 256; p += 2; return x; } if (x === 0xfe) return u32(); throw new Error('varint too large'); }
    function take(n) { need(n); var s = b.slice(p, p + n); p += n; return s; }
    var version = u32();
    if (b[p] === 0 && b[p + 1] === 1) { seg = true; p += 2; }
    var nin = vi(), ins = [], i;
    if (!nin) throw new Error('transaction has no inputs');
    for (i = 0; i < nin; i++) { var h = take(32).reverse(), vout = u32(); take(vi()); u32(); ins.push({ txid: bytesHex(h), vout: vout }); }
    var nout = vi(), outs = [];
    for (i = 0; i < nout; i++) { var v = u64(); outs.push({ value: v, script: bytesHex(take(vi())) }); }
    var baseEnd = p;
    if (seg) for (i = 0; i < nin; i++) { var k = vi(); while (k--) take(vi()); }
    u32();
    if (p !== b.length) throw new Error('raw transaction has trailing bytes');
    var witLen = seg ? (p - baseEnd - 4) + 2 : 0, baseLen = b.length - witLen;
    return { version: version, ins: ins, outs: outs, vsize: Math.ceil((baseLen * 4 + witLen) / 4) };
  }
  function arc4(key, data) {
    var S = [], i, j = 0, t, o = [];
    for (i = 0; i < 256; i++) S[i] = i;
    for (i = 0; i < 256; i++) { j = (j + S[i] + key[i % key.length]) & 255; t = S[i]; S[i] = S[j]; S[j] = t; }
    i = 0; j = 0;
    for (var n = 0; n < data.length; n++) { i = (i + 1) & 255; j = (j + S[i]) & 255; t = S[i]; S[i] = S[j]; S[j] = t; o.push(data[n] ^ S[(S[i] + S[j]) & 255]); }
    return o;
  }
  /** OP_RETURN script hex -> pushed data bytes (single push only) or null */
  function opReturnData(script) {
    var b = hexBytes(script); if (b[0] !== 0x6a) return null;
    var n = b[1], p = 2; if (n === 0x4c) { n = b[2]; p = 3; } else if (n > 75) return null;
    if (p + n !== b.length) return null; return b.slice(p);
  }
  function assetId(name) { var n = 0; name = String(name).toUpperCase(); if (!/^[B-Z][A-Z]{3,11}$/.test(name)) return null; for (var i = 0; i < name.length; i++) n = n * 26 + (name.charCodeAt(i) - 65); return n; }
  /** Counterparty destroy payload: 'CNTRPRTY' + 0x6e + asset id (8 B) + quantity (8 B) + tag bytes. ARC4 key = first input txid. */
  function decodeDestroy(tx) {
    var rets = tx.outs.filter(function (o) { return o.script.slice(0, 2) === '6a'; });
    if (rets.length !== 1) throw new Error(rets.length ? 'more than one OP_RETURN output' : 'no OP_RETURN (Counterparty data) output');
    var d = opReturnData(rets[0].script); if (!d) throw new Error('OP_RETURN is not a single data push');
    var pl = arc4(hexBytes(tx.ins[0].txid), d);
    if (String.fromCharCode.apply(null, pl.slice(0, 8)) !== 'CNTRPRTY') throw new Error('OP_RETURN is not a Counterparty message');
    if (pl[8] !== 110) throw new Error('Counterparty message type ' + pl[8] + ' is not a destroy (110)');
    if (pl.length < 25) throw new Error('destroy payload is too short');
    function be(a) { var v = 0; for (var i = 0; i < a.length; i++) v = v * 256 + a[i]; return v; }
    var qb = pl.slice(17, 25);
    return { assetId: be(pl.slice(9, 17)), quantityHex: bytesHex(qb), quantity: be(qb), tagHex: bytesHex(pl.slice(25)), opReturnValue: rets[0].value };
  }
  /* address -> scriptPubKey hex (bech32/bech32m with checksum; base58 legacy without checksum: the address comes from the wallet itself) */
  var B32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  function polymod(v) { var G = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3], c = 1; v.forEach(function (x) { var t = c >>> 25; c = ((c & 0x1ffffff) << 5) ^ x; for (var i = 0; i < 5; i++) if ((t >>> i) & 1) c ^= G[i]; }); return c >>> 0; }
  function addressScript(addr) {
    addr = String(addr || '').trim(); var lo = addr.toLowerCase(), m = /^(bc|tb|bcrt)1([02-9ac-hj-np-z]+)$/.exec(lo);
    if (m) {
      var hrp = m[1], d = m[2].split('').map(function (c) { return B32.indexOf(c); }), ex = [];
      for (var i = 0; i < hrp.length; i++) ex.push(hrp.charCodeAt(i) >> 5); ex.push(0); for (i = 0; i < hrp.length; i++) ex.push(hrp.charCodeAt(i) & 31);
      var pm = polymod(ex.concat(d)), ver = d[0]; if (pm !== (ver === 0 ? 1 : 0x2bc830a3)) return null;
      var acc = 0, bits = 0, prog = []; d.slice(1, -6).forEach(function (x) { acc = (acc << 5) | x; bits += 5; while (bits >= 8) { bits -= 8; prog.push((acc >> bits) & 255); } });
      if (prog.length < 2 || prog.length > 40) return null;
      return bytesHex([ver ? 0x50 + ver : 0, prog.length].concat(prog));
    }
    var A = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz', n = [0];
    if (!/^[1-9A-HJ-NP-Za-km-z]{25,35}$/.test(addr)) return null;
    addr.split('').forEach(function (c) { var carry = A.indexOf(c); for (var j = 0; j < n.length; j++) { carry += n[j] * 58; n[j] = carry & 255; carry >>= 8; } while (carry) { n.push(carry & 255); carry >>= 8; } });
    for (var z = 0; addr[z] === '1'; z++) n.push(0);
    n = n.reverse(); if (n.length !== 25) return null; var h = bytesHex(n.slice(1, 21));
    if (n[0] === 0 || n[0] === 111) return '76a914' + h + '88ac';
    if (n[0] === 5 || n[0] === 196) return 'a914' + h + '87';
    return null;
  }
  function decToHex16(s) { s = String(s); if (!/^\d+$/.test(s)) return null; var d = [0, 0, 0, 0, 0, 0, 0, 0]; for (var i = 0; i < s.length; i++) { var c = +s[i]; for (var j = 7; j >= 0; j--) { var v = d[j] * 10 + c; d[j] = v & 255; c = v >> 8; } if (c) return null; } return bytesHex(d); }
  function utf8Hex(s) { s = unescape(encodeURIComponent(String(s || ''))); var o = []; for (var i = 0; i < s.length; i++) o.push(s.charCodeAt(i)); return bytesHex(o); }

  /** cpMessage(tx) -> {type, body[], opReturnValue}: the ONE OP_RETURN, ARC4-decrypted with the first input's txid, must start with CNTRPRTY. */
  function cpMessage(tx) {
    var rets = tx.outs.filter(function (o) { return o.script.slice(0, 2) === '6a'; });
    if (rets.length !== 1) throw new Error(rets.length ? 'more than one OP_RETURN output' : 'no OP_RETURN (Counterparty data) output');
    var d = opReturnData(rets[0].script); if (!d) throw new Error('OP_RETURN is not a single data push');
    var pl = arc4(hexBytes(tx.ins[0].txid), d);
    if (String.fromCharCode.apply(null, pl.slice(0, 8)) !== 'CNTRPRTY') throw new Error('OP_RETURN is not a Counterparty message');
    return { type: pl[8], body: pl.slice(9), opReturnValue: rets[0].value };
  }
  /** assetHex(name) -> 16 hex digits of the Counterparty asset id: XCP = 1, numeric A<digits> = the number, named = base 26. */
  function assetHex(name) { name = String(name || '').toUpperCase(); if (name === 'XCP') return decToHex16('1'); if (name === 'BTC') return decToHex16('0');
    var m = /^A([0-9]{17,20})$/.exec(name); if (m) return decToHex16(m[1]); var n = assetId(name); return n == null ? null : decToHex16(String(n)); }
  /** checkSpend(r, tx, me, exp, problems): OP_RETURN carries 0 sats, every other output is change to me, at most maxOuts outputs, fee known and capped. */
  function checkSpend(r, tx, me, exp, problems) {
    var mine = addressScript(me), outSum = 0, maxOuts = exp.maxOuts || 2;
    if (!mine) problems.push('cannot read your address to check change');
    tx.outs.forEach(function (o, i) { outSum += o.value; if (o.script.slice(0, 2) === '6a') { if (o.value !== 0) problems.push('OP_RETURN output carries ' + o.value + ' sats'); return; } if (o.script !== mine) problems.push('output ' + i + ' pays an unexpected destination'); });
    if (tx.outs.length > maxOuts) problems.push('unexpected extra outputs (' + tx.outs.length + ')');
    var btcIn = Number(r.btc_in), fee = btcIn - outSum;
    if (!(btcIn > 0)) { problems.push('node did not report input value (btc_in): cannot check the fee'); return null; }
    if (r.btc_fee != null && Number(r.btc_fee) !== fee) problems.push('node fee ' + r.btc_fee + ' does not match the decoded tx (' + fee + ')');
    var cap = exp.maxFeeSats || MAX_FEE_SATS;
    if (exp.satPerVbyte > 0) cap = Math.min(cap, Math.ceil(exp.satPerVbyte * tx.vsize * 2) + 1000);
    if (!(fee >= 0)) problems.push('outputs are more than inputs');
    else if (fee > cap) problems.push('network fee ' + fee + ' sats is above the cap of ' + cap + ' sats');
    return fee;
  }
  /* minimal CBOR reader for issuance v2 (type 22): [asset_id, quantity, divisible, lock, reset, mime_type, description] */
  function cbor(b) { var p = 0;
    function len(ai) { if (ai < 24) return ai; var n = ai === 24 ? 1 : ai === 25 ? 2 : ai === 26 ? 4 : ai === 27 ? 8 : -1; if (n < 0 || p + n > b.length) throw new Error('bad CBOR'); var h = bytesHex(b.slice(p, p + n)); p += n; return h; }
    function item() { if (p >= b.length) throw new Error('bad CBOR'); var x = b[p++], mt = x >> 5, ai = x & 31, l;
      if (mt === 0) { l = len(ai); return { u: typeof l === 'string' ? l : null, n: typeof l === 'number' ? l : null }; }
      if (mt === 2 || mt === 3) { l = len(ai); l = typeof l === 'string' ? parseInt(l, 16) : l; if (p + l > b.length) throw new Error('bad CBOR'); var s = b.slice(p, p + l); p += l; return { bytes: bytesHex(s) }; }
      if (mt === 4) { l = len(ai); var a = []; while (l--) a.push(item()); return a; }
      if (mt === 7 && (ai === 20 || ai === 21)) return { bool: ai === 21 };
      if (mt === 7 && ai === 22) return { nul: true };
      throw new Error('unexpected CBOR item'); }
    var v = item(); if (p !== b.length) throw new Error('trailing CBOR bytes'); return v; }
  function u16hex(n) { return decToHex16(String(n)); }
  function cborUint(it) { return it && (it.u != null ? ('0000000000000000' + it.u).slice(-16) : it.n != null ? u16hex(it.n) : null); }
  var MSG = { send: [2], mpma: [3], order: [10], cancel: [70], issuance: [20, 22] };
  /**
   * checkDexTx(r, me, plan, satPerVbyte) -> problems[]: the raw tx of a shop / gift / token compose, decoded here independently of the node.
   * Counterparty message type must match the plan; order, cancel and issuance bodies are checked field by field; send / mpma: asset and
   * quantity (send), message type (mpma, its recipients are checked from the node's params). Outputs: OP_RETURN + change to you only. Fee capped.
   */
  function checkDexTx(r, me, plan, satPerVbyte) {
    var problems = [], kind = plan.kind === 'send' || plan.kind === 'mpma' || plan.kind === 'cancel' || plan.kind === 'issuance' ? plan.kind : 'order';
    if (!r || !r.rawtransaction || !/^([0-9a-f]{2})+$/i.test(r.rawtransaction)) return ['no raw transaction hex'];
    try {
      var tx = decodeRawTx(r.rawtransaction), m = cpMessage(tx), b = m.body, H = function (x, y) { return bytesHex(b.slice(x, y)); };
      if (MSG[kind].indexOf(m.type) < 0) problems.push('raw tx is Counterparty message ' + m.type + ', not a ' + kind);
      else if (kind === 'order') {
        if (b.length !== 42) problems.push('order payload has the wrong length');
        if (H(0, 8) !== assetHex(plan.give_asset)) problems.push('raw tx give asset differs');
        if (H(8, 16) !== u16hex(Math.round(plan.give_quantity))) problems.push('raw tx give quantity differs');
        if (H(16, 24) !== assetHex(plan.get_asset)) problems.push('raw tx get asset differs');
        if (H(24, 32) !== u16hex(Math.round(plan.get_quantity))) problems.push('raw tx get quantity differs');
        if (b[32] * 256 + b[33] !== Math.round(plan.expiration)) problems.push('raw tx expiration differs');
        if (H(34, 42) !== u16hex(0)) problems.push('raw tx asks a BTC fee');
      } else if (kind === 'cancel') { if (H(0, b.length) !== String(plan.offer_hash || '').toLowerCase()) problems.push('raw tx cancels a different order'); }
      else if (kind === 'send') { if (H(0, 8) !== assetHex(plan.asset)) problems.push('raw tx asset differs'); if (H(8, 16) !== u16hex(1)) problems.push('raw tx quantity differs'); }
      else if (kind === 'issuance') {
        var desc = utf8Hex(plan.description);
        if (m.type === 22) { var a = cbor(b);
          if (!Array.isArray(a) || a.length !== 7) problems.push('issuance payload has the wrong shape');
          else { if (cborUint(a[0]) !== assetHex(plan.asset)) problems.push('raw tx asset differs'); if (cborUint(a[1]) !== u16hex(plan.quantity != null ? plan.quantity : 1)) problems.push('raw tx quantity differs');
            if (!a[2] || a[2].bool !== false) problems.push('raw tx divisible differs'); if (!a[3] || a[3].bool !== (plan.lock != null ? !!plan.lock : true)) problems.push('raw tx lock differs');
            if (!a[4] || a[4].bool !== false) problems.push('raw tx reset is on'); if (!a[6] || a[6].bytes !== desc) problems.push('raw tx description differs'); }
        } else problems.push('legacy issuance format (type 20): not checked, refusing');
      }
      checkSpend(r, tx, me, { satPerVbyte: satPerVbyte, maxFeeSats: plan.maxFeeSats }, problems);
    } catch (e) { problems.push('could not decode the raw tx: ' + e.message); }
    return problems;
  }
  /**
   * checkComposeResult(result, expected) -> {ok, problems[], decoded}. FAILS CLOSED: anything missing or different is a problem.
   * expected: {address, quantityRaw, tag, asset?, satPerVbyte?, maxFeeSats?}
   * 1) the node's echoed params must all be present and equal; 2) the raw tx is decoded here, independently of the node:
   * exactly one OP_RETURN (0 sats) carrying a Counterparty destroy of the expected asset, quantity and tag, every other
   * output pays back to the player's own address (change) and nothing else; 3) the fee is within the cap.
   */
  function checkComposeResult(r, exp) {
    var problems = [], dec = null; exp = exp || {};
    if (!r || typeof r !== 'object') return { ok: false, problems: ['empty response'] };
    var asset = String(exp.asset || ASSET).toUpperCase(), wantTag = String(exp.tag || ''), pr = r.params;
    if (r.name !== 'destroy') problems.push(r.name ? 'composed a ' + r.name + ', not a destroy' : 'node did not say what it composed');
    if (!pr || typeof pr !== 'object') problems.push('node did not echo params (verbose)');
    else {
      if (pr.source !== exp.address) problems.push(pr.source == null ? 'source missing' : 'source address differs');
      if (pr.asset == null || String(pr.asset).toUpperCase() !== asset) problems.push(pr.asset == null ? 'asset missing' : 'asset differs: ' + pr.asset);
      if (pr.quantity == null || String(pr.quantity) !== String(exp.quantityRaw)) problems.push(pr.quantity == null ? 'quantity missing' : 'quantity differs: ' + pr.quantity);
      if (pr.tag == null || String(pr.tag) !== wantTag) problems.push(pr.tag == null ? 'tag missing' : 'tag differs: ' + pr.tag);
    }
    if (!r.rawtransaction || !/^[0-9a-f]+$/i.test(r.rawtransaction)) { problems.push('no raw transaction hex'); return { ok: false, problems: problems }; }
    try {
      var tx = decodeRawTx(r.rawtransaction), d = decodeDestroy(tx), mine = addressScript(exp.address);
      dec = { tx: tx, destroy: d };
      if (d.assetId !== assetId(asset)) problems.push('raw tx destroys a different asset');
      if (d.quantityHex !== decToHex16(exp.quantityRaw)) problems.push('raw tx quantity differs');
      if (d.tagHex !== utf8Hex(wantTag)) problems.push('raw tx tag differs');
      if (d.opReturnValue !== 0) problems.push('OP_RETURN output carries ' + d.opReturnValue + ' sats');
      if (!mine) problems.push('cannot read your address to check change');
      var outSum = 0;
      tx.outs.forEach(function (o, i) { outSum += o.value; if (o.script.slice(0, 2) === '6a') return; if (o.script !== mine) problems.push('output ' + i + ' pays an unexpected destination'); });
      if (tx.outs.length > 2) problems.push('unexpected extra outputs (' + tx.outs.length + ')');
      var btcIn = Number(r.btc_in), fee = btcIn - outSum;
      if (!(btcIn > 0)) problems.push('node did not report input value (btc_in): cannot check the fee');
      else {
        if (r.btc_fee != null && Number(r.btc_fee) !== fee) problems.push('node fee ' + r.btc_fee + ' does not match the decoded tx (' + fee + ')');
        var cap = exp.maxFeeSats || MAX_FEE_SATS;
        if (exp.satPerVbyte > 0) cap = Math.min(cap, Math.ceil(exp.satPerVbyte * tx.vsize * 2) + 1000);
        if (!(fee >= 0)) problems.push('outputs are more than inputs');
        else if (fee > cap) problems.push('network fee ' + fee + ' sats is above the cap of ' + cap + ' sats');
      }
    } catch (e) { problems.push('could not decode the raw tx: ' + e.message); }
    return { ok: problems.length === 0, problems: problems, decoded: dec };
  }

  return {
    ASSET: ASSET, ACTIONS: ACTIONS, MAX_TAG_BYTES: MAX_TAG_BYTES, DEFAULT_COMPOSE_API: DEFAULT_COMPOSE_API, READ_API: READ_API, LAUNCH_API: LAUNCH_API,
    ESCROW_ADDRESS: ESCROW_ADDRESS, NETWORK: NETWORK, action: action, buildTag: buildTag, toRaw: toRaw, fromRaw: fromRaw, cmpRaw: cmpRaw, isAddress: isAddress,
    burnable: burnable, checkAmount: checkAmount, composeUrl: composeUrl, checkComposeResult: checkComposeResult,
    checkDexTx: checkDexTx, decodeRawTx: decodeRawTx, decodeDestroy: decodeDestroy, cpMessage: cpMessage, addressScript: addressScript, assetHex: assetHex, MAX_FEE_SATS: MAX_FEE_SATS
  };
});
