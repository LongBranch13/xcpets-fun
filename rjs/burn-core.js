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
    { id: 'play', label: 'pet:play / pet:play:ID — play with your newest pet (or #ID)', minKey: 'play', id_: 'optional', name: false, help: 'Adds care and +1 play to your newest pet, or to pet #ID.' },
    { id: 'name', label: 'pet:name:NAME / pet:name:ID:NAME — name your pet (owner only)', minKey: 'name', id_: 'optional', name: true, help: 'Names your newest pet (or #ID). 1-16 characters A-Z 0-9 _ -, starting with a letter. Owner only; the last valid naming wins.' },
    { id: 'evolve', label: 'pet:evolve / pet:evolve:ID — ascend an Elder to Mythic (owner only)', minKey: 'evolve', id_: 'optional', name: false, help: 'Ascends the pet to Mythic if its care (including this burn) reaches 5,000,000. If care is too low the burn is still added as care.' }
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
      case 'name': tag = 'pet:name:' + (idStr ? idStr + ':' : '') + name; break;
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
    if (a && a.id === 'evolve') warnings.push('Evolve only succeeds if the pet\'s care including this burn is at least 5,000,000; otherwise it is just added as care.');
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

  /**
   * checkComposeResult(result, expected) -> {ok, problems[]}: the node echoes `params` with verbose=true. Make sure it
   * composed exactly what the player asked for (source, asset, raw quantity, tag) and returned an unsigned tx.
   */
  function checkComposeResult(r, exp) {
    var problems = [];
    if (!r || typeof r !== 'object') return { ok: false, problems: ['empty response'] };
    if (!r.rawtransaction || !/^[0-9a-f]+$/i.test(r.rawtransaction)) problems.push('no raw transaction hex');
    var pr = r.params || {};
    if (r.name && r.name !== 'destroy') problems.push('composed a ' + r.name + ', not a destroy');
    if (pr.source && pr.source !== exp.address) problems.push('source address differs');
    if (pr.asset && String(pr.asset).toUpperCase() !== ASSET) problems.push('asset differs: ' + pr.asset);
    if (pr.quantity != null && String(pr.quantity) !== String(exp.quantityRaw)) problems.push('quantity differs: ' + pr.quantity);
    if (pr.tag != null && String(pr.tag) !== String(exp.tag || '')) problems.push('tag differs: ' + pr.tag);
    if (!r.params) problems.push('node did not echo params (verbose)');
    return { ok: problems.length === 0, problems: problems };
  }

  return {
    ASSET: ASSET, ACTIONS: ACTIONS, MAX_TAG_BYTES: MAX_TAG_BYTES, DEFAULT_COMPOSE_API: DEFAULT_COMPOSE_API, READ_API: READ_API, LAUNCH_API: LAUNCH_API,
    ESCROW_ADDRESS: ESCROW_ADDRESS, NETWORK: NETWORK, action: action, buildTag: buildTag, toRaw: toRaw, fromRaw: fromRaw, cmpRaw: cmpRaw, isAddress: isAddress,
    burnable: burnable, checkAmount: checkAmount, composeUrl: composeUrl, checkComposeResult: checkComposeResult
  };
});
