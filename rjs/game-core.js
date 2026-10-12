/*!
 * XCPETS game-core.js — burn-tag parser + deterministic indexer.
 * Shared by the website (window.GameCore) and Node tests (require).
 * Input: rows from GET /v2/assets/<ASSET>/destructions (real shape, see test/fixtures).
 * All costs/thresholds here are PROPOSALS (see WHITEPAPER.md §4) and can be changed before launch.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GameCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var UNIT = 1e8; // XCPETS is divisible (XCP-69 requires divisible=true): 1 token = 1e8 raw units

  // PROPOSED minimum burns, in whole tokens.
  var COSTS = { hatch: 10000, feed: 100, feedPet: 100, play: 500, name: 2500, evolve: 50000 };

  // PROPOSED cumulative thresholds (whole tokens). Index = stage (Egg..Mythic).
  var PET_THRESHOLDS = [0, 20000, 100000, 400000, 1500000, 5000000];        // Mythic also needs pet:evolve
  var COMMUNITY_THRESHOLDS = [0, 100000, 1000000, 5000000, 15000000, 30000000];
  var STAGE_NAMES = ['Egg', 'Hatchling', 'Juvenile', 'Adult', 'Elder', 'Mythic'];

  // Community pet growing name (COMMUNITY_PET.md §2). Elder = COMMUNITY_THRESHOLDS[4].
  // COMMUNITY_QUEST_END: total burned that completes The Return quest.
  var COMMUNITY_QUEST_END = 69000000;
  var COMMUNITY_NAMES = ['Sat', 'Satoshi Nakamoto',
    'Satoshi Nakamoto, the creator of Bitcoin. One of the most rare Pepes in existence.'];
  function communityName(burned) {
    var b = Number(burned) || 0;
    if (b >= COMMUNITY_QUEST_END) return COMMUNITY_NAMES[2];
    if (b >= COMMUNITY_THRESHOLDS[4]) return COMMUNITY_NAMES[1];
    return COMMUNITY_NAMES[0];
  }
  var NAME_RE = /^[A-Z][A-Z0-9_-]{0,15}$/;

  function decodeTag(hexTag) {
    if (hexTag == null) return '';
    var h = String(hexTag);
    if (!/^([0-9a-fA-F]{2})*$/.test(h)) return h; // already plain text (some nodes/verbose modes)
    var bytes = [];
    for (var i = 0; i < h.length; i += 2) bytes.push(parseInt(h.substr(i, 2), 16));
    try {
      if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes));
      return decodeURIComponent(bytes.map(function (b) { return '%' + (b < 16 ? '0' : '') + b.toString(16); }).join(''));
    } catch (e) { return String.fromCharCode.apply(null, bytes); }
  }

  /**
   * parseTag("PET:Feed:7") -> {action:'feedPet', petId:7}
   * Returns {action:'none'} for tags outside the pet: namespace and {action:'invalid', reason} for malformed pet: tags.
   */
  function parseTag(tag) {
    var t = String(tag || '').trim().toUpperCase();
    if (t.indexOf('PET:') !== 0) return { action: 'none' };
    var p = t.split(':');
    var verb = p[1] || '';
    function id(s) { return /^[0-9]{1,9}$/.test(s) ? parseInt(s, 10) : null; }
    switch (verb) {
      case 'HATCH': return p.length === 2 ? { action: 'hatch' } : { action: 'invalid', reason: 'pet:hatch takes no arguments' };
      case 'FEED':
        if (p.length === 2) return { action: 'feed' };
        if (p.length === 3 && id(p[2]) !== null) return { action: 'feedPet', petId: id(p[2]) };
        return { action: 'invalid', reason: 'bad pet id' };
      case 'PLAY':
        if (p.length === 2) return { action: 'play', petId: null };
        if (p.length === 3 && id(p[2]) !== null) return { action: 'play', petId: id(p[2]) };
        return { action: 'invalid', reason: 'bad pet id' };
      case 'EVOLVE':
        if (p.length === 2) return { action: 'evolve', petId: null };
        if (p.length === 3 && id(p[2]) !== null) return { action: 'evolve', petId: id(p[2]) };
        return { action: 'invalid', reason: 'bad pet id' };
      case 'NAME':
        if (p.length === 3 && NAME_RE.test(p[2])) return { action: 'name', petId: null, name: p[2] };
        if (p.length === 4 && id(p[2]) !== null && NAME_RE.test(p[3])) return { action: 'name', petId: id(p[2]), name: p[3] };
        return { action: 'invalid', reason: 'name must be 1-16 chars A-Z 0-9 _ - starting with a letter' };
      default: return { action: 'invalid', reason: 'unknown pet: verb' };
    }
  }

  function stageFor(care, thresholds, ascended) {
    var s = 0;
    for (var i = 1; i < 5; i++) if (care >= thresholds[i]) s = i;
    if (care >= thresholds[5] && (ascended || thresholds === COMMUNITY_THRESHOLDS)) s = 5;
    return s;
  }

  function sortRows(rows) {
    return rows.slice().sort(function (a, b) {
      return (a.block_index - b.block_index) || (a.tx_index - b.tx_index);
    });
  }

  /**
   * buildState(rows, opts)
   *  rows: destructions rows {tx_index, tx_hash, block_index, source, asset, quantity, tag(hex), status}
   *  opts.startBlock: ignore burns before this block (PROPOSAL: graduation block)
   *  opts.divisible: default true
   *  opts.costs: override COSTS
   *  opts.ownerOf(pet, row): optional sub-asset ownership hook (see subassets/owners.js). Returns the address
   *    that holds the pet's XCPETS.<SPECIES>.<N> sub-asset at that row's block/tx (row is null = now), or null to
   *    fall back to the hatcher. Used for name/evolve owner checks and reported as pet.holder.
   * Returns { community, pets, burners, log, totals } — pure function of input.
   */
  function buildState(rows, opts) {
    opts = opts || {};
    var costs = {}, k;
    for (k in COSTS) costs[k] = COSTS[k];
    if (opts.costs) for (k in opts.costs) costs[k] = opts.costs[k];
    // opts.petThresholds: cumulative care per stage [Egg..Mythic] (default = the real game's PET_THRESHOLDS; the play demo passes its own)
    var T = opts.petThresholds || PET_THRESHOLDS;
    // opts.communityThresholds: cumulative burns per shared-pet stage (default COMMUNITY_THRESHOLDS); it always ascends on its own
    var CT = opts.communityThresholds || COMMUNITY_THRESHOLDS;
    var unit = opts.divisible === false ? 1 : UNIT;
    var seen = {}, pets = [], byOwner = {}, burners = {}, log = [];
    var community = { burned: 0, burns: 0, feeds: 0, feeders: {} };
    var sorted = sortRows(rows || []);
    for (var i = 0; i < sorted.length; i++) {
      var r = sorted[i];
      if (!r || seen[r.tx_hash]) continue;
      seen[r.tx_hash] = true;
      if (String(r.status || '').toLowerCase() !== 'valid') { log.push(entry(r, 'skip', 'status ' + r.status)); continue; }
      if (opts.startBlock && r.block_index < opts.startBlock) { log.push(entry(r, 'skip', 'before game start block')); continue; }
      var amt = Number(r.quantity) / unit;
      var tagText = decodeTag(r.tag);
      var cmd = parseTag(tagText);
      // every valid burn feeds the community pet and the burner leaderboard
      community.burned += amt; community.burns++;
      var b = burners[r.source] || (burners[r.source] = { address: r.source, burned: 0, burns: 0, pets: 0, firstBlock: r.block_index });
      b.burned += amt; b.burns++;
      var res = apply(cmd, r, amt);
      log.push(entry(r, res.ok ? cmd.action : (cmd.action === 'none' ? 'plain' : 'rejected'), res.msg, tagText, amt, res.petId));
    }

    function entry(r, kind, msg, tagText, amt, petId) {
      return { tx_hash: r.tx_hash, tx_index: r.tx_index, block_index: r.block_index, source: r.source, kind: kind, msg: msg || '', tag: tagText || '', amount: amt || 0, petId: petId == null ? null : petId };
    }
    function ownerOf(pet, r) { var o = opts.ownerOf ? opts.ownerOf(pet, r) : null; return o || pet.owner; }
    function latestPet(owner) { var l = byOwner[owner]; return l && l.length ? l[l.length - 1] : null; }
    function target(petId, owner) { return petId == null ? latestPet(owner) : (pets[petId - 1] || null); }

    function apply(cmd, r, amt) {
      var pet;
      switch (cmd.action) {
        case 'none': return { ok: false, msg: 'no pet: tag — counts as community food' };
        case 'invalid': return { ok: false, msg: cmd.reason };
        case 'feed':
          if (amt < costs.feed) return { ok: false, msg: 'below feed minimum' };
          community.feeds++; community.feeders[r.source] = (community.feeders[r.source] || 0) + amt;
          return { ok: true, msg: 'fed the community pet' };
        case 'hatch':
          if (amt < costs.hatch) return { ok: false, msg: 'below hatch cost' };
          pet = { id: pets.length + 1, owner: r.source, hatchTx: r.tx_hash, hatchTxIndex: r.tx_index, hatchBlock: r.block_index,
            care: amt, plays: 0, feeds: 0, name: null, ascended: false, feeders: {} };
          pet.feeders[r.source] = amt;
          pets.push(pet); (byOwner[r.source] = byOwner[r.source] || []).push(pet); burners[r.source].pets++;
          return { ok: true, msg: 'hatched pet #' + pet.id, petId: pet.id };
        case 'feedPet':
          pet = target(cmd.petId, r.source);
          if (!pet) return { ok: false, msg: 'no such pet' };
          if (amt < costs.feedPet) return { ok: false, msg: 'below feed minimum' };
          pet.care += amt; pet.feeds++; pet.feeders[r.source] = (pet.feeders[r.source] || 0) + amt;
          return { ok: true, msg: 'fed pet #' + pet.id, petId: pet.id };
        case 'play':
          pet = target(cmd.petId, r.source);
          if (!pet) return { ok: false, msg: 'no pet to play with' };
          if (amt < costs.play) return { ok: false, msg: 'below play cost' };
          pet.care += amt; pet.plays++;
          return { ok: true, msg: 'played with pet #' + pet.id, petId: pet.id };
        case 'name':
          pet = target(cmd.petId, r.source);
          if (!pet) return { ok: false, msg: 'no pet to name' };
          if (ownerOf(pet, r) !== r.source) return { ok: false, msg: 'only the owner can name a pet', petId: pet.id };
          if (amt < costs.name) return { ok: false, msg: 'below name cost', petId: pet.id };
          pet.name = cmd.name; pet.care += amt;
          return { ok: true, msg: 'named pet #' + pet.id + ' ' + cmd.name, petId: pet.id };
        case 'evolve':
          pet = target(cmd.petId, r.source);
          if (!pet) return { ok: false, msg: 'no pet to evolve' };
          if (ownerOf(pet, r) !== r.source) return { ok: false, msg: 'only the owner can evolve a pet', petId: pet.id };
          if (pet.ascended) return { ok: false, msg: 'already Mythic', petId: pet.id };
          if (amt < costs.evolve) return { ok: false, msg: 'below evolve cost', petId: pet.id };
          pet.care += amt;
          if (pet.care < T[5]) return { ok: false, msg: 'care below Mythic threshold (burn still added as care)', petId: pet.id };
          pet.ascended = true;
          return { ok: true, msg: 'pet #' + pet.id + ' ascended to Mythic', petId: pet.id };
      }
      return { ok: false, msg: 'unhandled' };
    }

    if (opts.ownerOf) for (i = 0; i < pets.length; i++) pets[i].holder = ownerOf(pets[i], null);
    for (i = 0; i < pets.length; i++) { pets[i].stage = stageFor(pets[i].care, T, pets[i].ascended); pets[i].stageName = STAGE_NAMES[pets[i].stage]; }
    community.stage = stageFor(community.burned, CT, true);
    community.stageName = STAGE_NAMES[community.stage];
    community.next = community.stage < 5 ? CT[community.stage + 1] : null;
    var burnerList = Object.keys(burners).map(function (a) { return burners[a]; })
      .sort(function (a, b) { return (b.burned - a.burned) || (a.firstBlock - b.firstBlock) || (a.address < b.address ? -1 : 1); });
    return { community: community, pets: pets, burners: burnerList, log: log, costs: costs, petThresholds: T, communityThresholds: CT };
  }

  return {
    UNIT: UNIT, COSTS: COSTS, PET_THRESHOLDS: PET_THRESHOLDS, COMMUNITY_THRESHOLDS: COMMUNITY_THRESHOLDS, STAGE_NAMES: STAGE_NAMES,
    COMMUNITY_QUEST_END: COMMUNITY_QUEST_END, COMMUNITY_NAMES: COMMUNITY_NAMES, communityName: communityName,
    decodeTag: decodeTag, parseTag: parseTag, stageFor: stageFor, sortRows: sortRows, buildState: buildState
  };
});
