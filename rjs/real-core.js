/*!
 * XCPETS real-core.js — REAL game rules layer (phase 1, read-only viewer + unsigned tx builder).
 * Pure + deterministic: state = replay of XCPETS destroy rows (Counterparty API v2 /assets/XCPETS/destructions) plus a map
 * block_index -> block_hash. No randomness from Math.random, no clock: days are 144-block windows.
 * Uses GameCore.buildState for hatch/care/stages/evolve/community (the shared rules) and adds the demo-era extensions
 * (meal sizes, daily feed limit, streaks, roll tokens, slot keys, gear rolls) on top. ALL NUMBERS ARE PROPOSALS (REAL_GAME_PLAN.md §5).
 * It never signs or broadcasts anything.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../../js/game-core.js'), require('../../js/pet-core.js'), safeReq('../bonus-gear.js'));
  else root.RealCore = factory(root.GameCore, root.PetCore, root.BonusGear);
  function safeReq(p) { try { return require(p); } catch (e) { return null; } }
})(typeof self !== 'undefined' ? self : this, function (GameCore, PetCore, BonusGear) {
  'use strict';
  var ASSET = (typeof XCPETS_CONFIG !== 'undefined' && XCPETS_CONFIG.asset) || 'XCPETS', MAX_TAG_BYTES = 34, BLOCKS_PER_DAY = 144;
  // PROPOSED real economy (needs owner approval): demo x ~14.49 roll = 5,000 as the user suggested; hatch 69 (packs: 12 eggs 690, 144 eggs 6,900) per the user 2026-10-11.
  // Feeding v2 (2026-10-11): ONE feed per pet per 144-block day, meals 3x bigger so stage days are unchanged
  // (2/2/2/3 meals per stage = the old 6/6/6/8 at 3 a day: Juvenile day 2, Adult day 4, Elder day 6, Mythic day 9; total cost 69,000 unchanged).
  // Feeds in blocks before FEED_V2_FROM_BLOCK replay under v1 (3/day, MEAL_SIZES_V1) so existing pets keep their care.
  var FEED_V2_FROM_BLOCK = 971040; // mainnet tip was 971035 when this was added (2026-10-11)
  // Pet Cemetery (neglect, 2026-10-11): a pet that goes NEGLECT_DAYS (7) FULL 144-block days without a feed dies at the first block of
  // day 8. Clock anchor = the day of max(last accepted feed, hatch, DEATH_FROM_BLOCK) so no pet dies retroactively. Exempt: Mythic care
  // (>= 69,069; can no longer be fed, incl. ascended) and the community pet (not a pet record). Eggs: none are exempt, because every
  // hatch burn (single or pack) creates a hatched Hatchling at once; an egg with its block hash still pending is the same pet record and uses the same clock.
  // Dead pets keep their page but take no actions; burns tagged for them are ignored (community food) and their gear returns to the owner.
  // No paid evolve (2026-10-12): from EVOLVE_OFF_FROM_BLOCK on, a pet:evolve:ID burn is a plain burn (community food, log note), and a pet
  // ascends to Mythic automatically once its care reaches THRESHOLDS[5] (69,069) by feeding. Pets that evolved before the cutoff stay Mythic.
  // No-burn tokens and keys (2026-10-12), same cutoff: from EVOLVE_OFF_FROM_BLOCK on, roll tokens and slot keys need no transaction.
  // A token resolves by itself into a gear item, seeded from the block hash + tx of the burn that EARNED it (+ 'XCPETS:token-roll:v2'),
  // so the result is fixed by the token and every replay gets the same item; the slot is picked by the same seed among the pet's
  // open slots. The item goes to the owner's inventory (equip it with the free local loadout; it is worn at once if the slot is empty).
  // A key unlocks the next bonus slot by itself. Tokens/keys still unused at the cutoff resolve at the cutoff, in the order earned.
  // Dust pet:troll / pet:key burns before the cutoff keep counting; after it they are plain burns with a log note.
  var NOBURN_DUST_V1 = 0.00000001; // the old 'free' token-roll/key price (one raw unit), kept only to describe pre-cutoff burns
  /* GRAVE GEAR (2026-10-19, review branch): same rule as V2Rules (js/v2-rules.js ACTIVATE_GRAVE_GEAR_BLOCK, keep the two equal). pet:grave:ID = the owner opts in: if the pet
   * dies of neglect it keeps the gear it wears (on stays its id, grave = its id); pet:grave:ID:off cancels. Owner only, living pets only, any amount. Default (no flag):
   * worn gear goes back to the owner's inventory at death, as before. Before the block pet:grave tags stay unknown (community food), so past burns replay the same.
   * (In the v2 site this engine only replays burns before the v2 cutoff, so it is kept in step for the real-wallet path rather than for today's live data.) */
  var GRAVE_GEAR_FROM_BLOCK = 972150; // PLACEHOLDER: = V2Rules.ACTIVATE_GRAVE_GEAR_BLOCK (deploy tip + 6, < first death block 972432)
  var EVOLVE_OFF_FROM_BLOCK = 971052; // = mainnet tip (api.xcp.fun/node/v2) when this was added, 2026-10-12
  var DEATH_FROM_BLOCK = 971280, NEGLECT_DAYS = 7; // tip was 971040 when added; 971280 = first block of day 6745 (~1.7 days ahead)
  var MEAL_SIZES = [0, 4140, 6900, 9660, 9200];           // per meal by current stage Hatchling..Elder (v2)
  var MEAL_SIZES_V1 = [0, 1380, 2300, 3220, 3450];        // v1, blocks < FEED_V2_FROM_BLOCK
  var THRESHOLDS = [0, 69, 8349, 22149, 41469, 69069]; // = promo PLAY_README: 2/2/2/3 meals per stage (v1: 6/6/6/8), Mythic at 69,069 care
  var EVOLVE_COST_V1 = 69009; // pre-cutoff evolve price, kept only to replay old evolve burns
  var FREE = 0.00000001; // 'free' in the demo; on chain a destroy needs >= 1 raw unit, so free actions burn 0.00000001 XCPETS
  var COSTS = { hatch: 69, hatch12: 690, hatch144: 6900, feed: 7, feedPet: FREE, play: 1000000000, name: 2500, roll: 345, croll: 25000, cback: 1000 };
  var COMMUNITY_THRESHOLDS = [0, 41400, 82800, 124200, 165600, 207000]; // = promo PLAY_README (41,400 per stage); FLAG: whitepaper had 0/100k/1M/5M/15M/30M
  var FEEDS_PER_DAY = 1, FEEDS_PER_DAY_V1 = 3;
  var DROP = { stageUp: 2500, meal: 200, key: 100 };          // out of 10,000: 25% token per stage-up, 2% per meal, 1% key per roll
  var SLOTS = ['band', 'armor', 'cape', 'weapon', 'crown'], BONUS = ['face', 'back', 'feet'];
  var LISTS = { band: 'BANDS', armor: 'ARMORS', cape: 'CAPES', weapon: 'WEAPONS', crown: 'CROWNS' };
  var SLOT_CODES = { BAND: 'band', ARMOR: 'armor', CAPE: 'cape', WEAPON: 'weapon', CROWN: 'crown', FACE: 'face', BACK: 'back', FEET: 'feet' };
  var CSLOTS = ['HR', 'HD', 'HL', 'GR', 'NK', 'FC', 'BK', 'RL'];
  var RULES = { costs: COSTS, petThresholds: THRESHOLDS };

  /* Egg packs: ONE destroy, N eggs. Each egg is a full hatch (care = single hatch cost); egg i is seeded by block hash + '<tx_hash>:<i>'. */
  var PACKS = { hatch12: { n: 12, tag: 'pet:hatch12' }, hatch144: { n: 144, tag: 'pet:hatch144' } };
  function careStage(care) { var k = 1; while (k < 4 && care >= THRESHOLDS[k + 1]) k++; return k; }
  function isV2(block) { return block == null || Number(block) >= FEED_V2_FROM_BLOCK; }
  function mealSizesAt(block) { return isV2(block) ? MEAL_SIZES : MEAL_SIZES_V1; }
  function feedsPerDayAt(block) { return isV2(block) ? FEEDS_PER_DAY : FEEDS_PER_DAY_V1; }
  // mealFor(care[, block]): meal size = care cap per feed burn; block omitted = current (v2) rules
  function mealFor(care, block) { if (care >= THRESHOLDS[5]) return 0; var k = careStage(care); return Math.min(mealSizesAt(block)[k], THRESHOLDS[k + 1] - care); }
  function day(block) { return Math.floor(block / BLOCKS_PER_DAY); }
  /** deathBlock(care, lastBlock) -> first block at which the pet is dead, or null if exempt (Mythic care). lastBlock = last feed or hatch block. */
  function deathBlock(care, lastBlock) { if (care >= THRESHOLDS[5]) return null; return (day(Math.max(Number(lastBlock) || 0, DEATH_FROM_BLOCK)) + NEGLECT_DAYS + 1) * BLOCKS_PER_DAY; }
  function isDeadAt(care, lastBlock, block) { var d = deathBlock(care, lastBlock); return d != null && block != null && Number(block) >= d; }
  function utf8Len(s) { return unescape(encodeURIComponent(s)).length; }
  function seed(blockHash, txHash, label) { return PetCore.sha256Hex(String(blockHash || '') + String(txHash) + label); }
  function roll10k(hex) { return parseInt(hex.slice(0, 8), 16) % 10000; }

  /** Extension tags (GameCore treats these as unknown => community food; real-core gives them meaning). */
  function parseExt(tag) {
    var t = String(tag || '').trim().toUpperCase(), p = t.split(':');
    if (p[0] !== 'PET') return null;
    function id(s) { return /^[0-9]{1,9}$/.test(s || '') ? parseInt(s, 10) : null; }
    if (p[1] === 'ROLL' || p[1] === 'TROLL') {
      if ((p.length === 3 || p.length === 4) && id(p[2]) !== null && (p.length === 3 || SLOT_CODES[p[3]])) return { action: p[1] === 'ROLL' ? 'roll' : 'tokenRoll', petId: id(p[2]), slot: p[3] ? SLOT_CODES[p[3]] : null };
      return { action: 'invalid', reason: 'roll needs pet:roll:ID[:SLOT]' };
    }
    if (p[1] === 'HATCH12' || p[1] === 'HATCH144') return p.length === 2 ? { action: p[1].toLowerCase(), eggs: PACKS[p[1].toLowerCase()].n } : { action: 'invalid', reason: 'pack tag takes no arguments' };
    if (p[1] === 'REL') {
      // pet:rel:ID  or  pet:rel:START:MASK  (MASK = base-32 digits 0-9A-V; digit j bit b => pet START+5j+b; bit 0 of digit 0 = START)
      if (p.length === 3 && id(p[2]) !== null) return { action: 'release', ids: [id(p[2])] };
      if (p.length === 4 && id(p[2]) !== null && /^[0-9A-V]{1,24}$/.test(p[3])) { var ids = [];
        for (var j = 0; j < p[3].length; j++) { var v = parseInt(p[3][j], 32); for (var b = 0; b < 5; b++) if (v & (1 << b)) ids.push(id(p[2]) + 5 * j + b); }
        return ids.length ? { action: 'release', ids: ids } : { action: 'invalid', reason: 'empty release mask' }; }
      return { action: 'invalid', reason: 'pet:rel:ID or pet:rel:START:MASK' };
    }
    if (p[1] === 'GRAVE') { if (p.length === 3 && id(p[2]) !== null) return { action: 'grave', petId: id(p[2]), on: true }; if (p.length === 4 && id(p[2]) !== null && p[3] === 'OFF') return { action: 'grave', petId: id(p[2]), on: false }; return null; }
    if (p[1] === 'KEY') return p.length === 3 && id(p[2]) !== null ? { action: 'key', petId: id(p[2]) } : { action: 'invalid', reason: 'pet:key:ID' };
    if (p[1] === 'C' && p[2] === 'ROLL') {
      if (p.length === 3) return { action: 'croll', slot: null };
      if (p.length === 4 && CSLOTS.indexOf(p[3]) >= 0) return { action: 'croll', slot: p[3] };
      return { action: 'invalid', reason: 'bad community slot' };
    }
    if (p[1] === 'C' && p[2] === 'BACK') return p.length === 4 && /^[0-9]{1,12}$/.test(p[3]) ? { action: 'cback', candidate: parseInt(p[3], 10) } : { action: 'invalid', reason: 'pet:c:back:TXINDEX' };
    return null;
  }

  /** releaseTags(ids) -> tags (each <= 34 bytes) covering every id once; as few burns as possible. */
  function releaseTags(ids) {
    ids = ids.map(Number).filter(function (x, i, a) { return x >= 1 && a.indexOf(x) === i; }).sort(function (a, b) { return a - b; });
    var out = [], i = 0;
    while (i < ids.length) {
      var start = ids[i], cap = MAX_TAG_BYTES - ('pet:rel:' + start + ':').length, maxId = start + 5 * cap - 1, inBatch = [];
      while (i < ids.length && ids[i] <= maxId) inBatch.push(ids[i++]);
      if (inBatch.length === 1) { out.push({ tag: 'pet:rel:' + start, ids: inBatch }); continue; }
      var digits = []; inBatch.forEach(function (x) { var o = x - start, j = Math.floor(o / 5); while (digits.length <= j) digits.push(0); digits[j] |= 1 << (o % 5); });
      out.push({ tag: 'pet:rel:' + start + ':' + digits.map(function (d) { return d.toString(32).toUpperCase(); }).join(''), ids: inBatch });
    }
    return out;
  }
  /** releasePlans(ids) -> burn plans (smallest unit each). Owner check happens on replay. */
  function releasePlans(ids) {
    var t = releaseTags(ids);
    return t.map(function (x, k) { return { ok: true, tag: x.tag, ids: x.ids, amount: '0.00000001', release: true, eggs: 0,
      label: 'Discard ' + x.ids.length + ' pet' + (x.ids.length > 1 ? 's' : '') + (t.length > 1 ? ' (burn ' + (k + 1) + ' of ' + t.length + ')' : '') }; });
  }
  /** buildTag(kind, {petId, slot, candidate}) — every tag <= 34 bytes and round-trips through the parsers. */
  function buildTag(kind, o) {
    o = o || {}; var id = o.petId != null ? String(Number(o.petId)) : '', tag;
    var needId = { feedPet: 1, roll: 1, tokenRoll: 1, key: 1, evolve: 1 };
    if (needId[kind] && !(Number(o.petId) >= 1 && /^[0-9]{1,9}$/.test(id))) return { ok: false, error: 'pet id required (1-9 digits)' };
    var slot = o.slot ? String(o.slot).toUpperCase() : '';
    switch (kind) {
      case 'hatch': tag = 'pet:hatch'; break;
      case 'feedPet': tag = 'pet:feed:' + id; break;
      case 'evolve': tag = 'pet:evolve:' + id; break;
      case 'roll': tag = 'pet:roll:' + id + (slot ? ':' + slot : ''); break;
      case 'tokenRoll': tag = 'pet:troll:' + id + (slot ? ':' + slot : ''); break;
      case 'key': tag = 'pet:key:' + id; break;
      case 'feed': tag = 'pet:feed'; break;
      case 'hatch12': case 'hatch144': tag = PACKS[kind].tag; break;
      case 'croll': tag = 'pet:c:roll' + (slot ? ':' + slot : ''); break;
      case 'cback': if (!/^[0-9]{1,12}$/.test(String(o.candidate))) return { ok: false, error: 'candidate tx_index' }; tag = 'pet:c:back:' + o.candidate; break;
      default: return { ok: false, error: 'unknown action' };
    }
    if (utf8Len(tag) > MAX_TAG_BYTES) return { ok: false, error: 'tag over 34 bytes' };
    var g = GameCore.parseTag(tag), x = parseExt(tag);
    var got = x ? x.action : g.action;
    if (got !== kind) return { ok: false, error: 'tag did not round-trip: ' + got };
    return { ok: true, tag: tag };
  }

  // "Bumped a notch" rule: every rarity plays with the NEXT tier's base gear slots and stat bonus. Rarity label/art unchanged.
  // Slots by rarity: Common 1 (band), Uncommon 2, Rare 4, Legendary 5 (max). Stats: original tier bonuses (no bump). Uncommon 2->4 +3, Rare 4->5 +4, Legendary 5 base + 1 free bonus slot (face) +4.
  var BUMP_SLOTS = [1, 2, 4, 5], BUMP_FREE_BONUS = [0, 0, 0, 0], BUMP_STATS = [0, 0, 0, 0], MIN_SLOTS = 1;
  function tierPool(slot, species, tierIdx) {
    var extra = ((BonusGear && BonusGear.ITEMS) || []).filter(function (x) { return x.slot === slot && (!x.species || x.species === species); })
      .map(function (x) { return { id: x.id, label: x.label, t: x.tier, w: 10, species: x.species, overlay: true }; });
    var all = BONUS.indexOf(slot) >= 0 ? extra : PetCore[LISTS[slot]].map(function (x) { return { id: x.id, label: x.label, t: x.t, w: x.w || 10 }; }).concat(extra);
    var pool = all.filter(function (x) { return x.t <= tierIdx; });
    if (!pool.length && all.length) { var m = Math.min.apply(null, all.map(function (x) { return x.t; })); pool = all.filter(function (x) { return x.t === m; }); }
    return pool.map(function (x) { return { it: x, w: x.w * (x.t === tierIdx ? 4 : 1) }; });
  }
  function pickItem(hex, slot, species, tierIdx) {
    var pool = tierPool(slot, species, tierIdx); if (!pool.length) return null;
    var tot = pool.reduce(function (a, b) { return a + b.w; }, 0), r = parseInt(hex.slice(8, 16), 16) % tot;
    for (var i = 0; i < pool.length; i++) { if (r < pool[i].w) return pool[i].it; r -= pool[i].w; }
    return pool[pool.length - 1].it;
  }

  /**
   * replay(rows, blockHashes, opts) -> state. opts.startBlock = game start (graduation) block; opts.tip = current block (for statuses).
   * Pass 1 (pre-filter, same order as GameCore): enforce meal size + daily feed limit (v2: 1, v1 before FEED_V2_FROM_BLOCK: 3) per pet per 144-block day for pet:feed:ID; a failing feed
   *   keeps its burn as community food (tag stripped). Pass 2: GameCore.buildState with the real rules. Pass 3: extensions.
   */
  function replay(rows, blockHashes, opts) {
    opts = opts || {}; blockHashes = blockHashes || {};
    var sorted = GameCore.sortRows(rows || []), seen = {}, pre = [], petN = 0, pets = {}, notes = {}, packEgg = {}, credit = {}, deadBurn = {}, plain = {}, maxBlock = 0;
    sorted.forEach(function (r) {
      if (!r || seen[r.tx_hash]) return; seen[r.tx_hash] = 1; if (r.block_index > maxBlock) maxBlock = r.block_index;
      var ok = String(r.status || '').toLowerCase() === 'valid' && !(opts.startBlock && r.block_index < opts.startBlock);
      var amt = Number(r.quantity) / GameCore.UNIT, tag = GameCore.decodeTag(r.tag), c = GameCore.parseTag(tag);
      var pk = ok ? parseExt(tag) : null;
      if (pk && PACKS[pk.action]) {
        if (amt < COSTS[pk.action]) { notes[r.tx_hash] = 'below ' + pk.action + ' pack price (' + COSTS[pk.action] + ')'; pre.push(r); return; }
        // expand into N synthetic hatch rows; raw quantity split exactly (egg 0 takes the remainder) so community credit = what was burned
        var raw = Math.round(Number(r.quantity)), n = pk.eggs, base = Math.floor(raw / n);
        for (var i = 0; i < n; i++) { petN++; pets[petN] = { care: COSTS.hatch, owner: r.source, feeds: {}, last: r.block_index }; packEgg[r.tx_hash + ':' + i] = { tx: r.tx_hash, i: i, n: n, pack: pk.action };
          pre.push(Object.assign({}, r, { tx_hash: r.tx_hash + ':' + i, tag: 'pet:hatch', quantity: base + (i === 0 ? raw - base * n : 0) })); }
        return;
      }
      if (ok && c.action === 'hatch' && amt < COSTS.hatch) { notes[r.tx_hash] = 'below hatch cost (' + COSTS.hatch + ')'; r = Object.assign({}, r, { tag: '' }); }
      else if (ok && c.action === 'hatch') { petN++; credit[r.tx_hash] = Math.min(amt, COSTS.hatch); pets[petN] = { care: credit[r.tx_hash], owner: r.source, feeds: {}, last: r.block_index }; } // hatch care capped at 69; overpay is just burned (community)
      else if (ok && pk && pk.action === 'release') { pk.ids.forEach(function (pid) { var rp = pets[pid]; if (rp && !rp.released && rp.owner === r.source) rp.released = true; }); }
      else if (ok && c.action === 'feedPet') {
        var p = pets[c.petId], why = null;
        if (!p) why = 'no such pet';
        else if (p.released) why = 'pet was released';
        else if (p.owner !== r.source) why = 'only the owner can feed this pet';
        else if (p.care >= THRESHOLDS[5]) why = 'pet is fully fed (Mythic care)';
        else if (isDeadAt(p.care, p.last, r.block_index)) { why = 'pet died of neglect at block ' + deathBlock(p.care, p.last) + ' (in the Pet Cemetery): burn ignored'; deadBurn[r.tx_hash] = c.petId; }
        else if (amt < mealFor(p.care, r.block_index)) why = 'below this stage\'s meal (' + mealFor(p.care, r.block_index) + ')';
        else if ((p.feeds[day(r.block_index)] || 0) >= feedsPerDayAt(r.block_index)) why = feedsPerDayAt(r.block_index) === 1 ? 'already fed this day' : 'already fed ' + feedsPerDayAt(r.block_index) + 'x this day';
        if (why) { notes[r.tx_hash] = why; r = Object.assign({}, r, { tag: '' }); }
        else { credit[r.tx_hash] = Math.min(amt, mealFor(p.care, r.block_index)); p.care += credit[r.tx_hash]; p.feeds[day(r.block_index)] = (p.feeds[day(r.block_index)] || 0) + 1; p.last = r.block_index; if (p.care >= THRESHOLDS[5] && p.fullAt == null) p.fullAt = r.block_index; }
      } else if (ok && c.action === 'evolve' && r.block_index >= EVOLVE_OFF_FROM_BLOCK) {
        plain[r.tx_hash] = 'evolve burns are off from block ' + EVOLVE_OFF_FROM_BLOCK + ' (pets now reach Mythic by feeding): treated as a plain burn (counts as community food)'; r = Object.assign({}, r, { tag: '' });
      } else if (ok && c.action === 'evolve') {
        // Evolve = 69,009 XCPETS (or more; extra is just burned). Needs 69,069 care FIRST: the evolve burn itself adds no care
        // (otherwise one big evolve burn would skip all the feeding). A failing evolve is community food, never refunded.
        var q = pets[c.petId], ew = null;
        if (!q) ew = 'no such pet'; else if (q.released) ew = 'pet was released'; else if (amt < EVOLVE_COST_V1) ew = 'below evolve cost (' + EVOLVE_COST_V1 + ')'; else if (isDeadAt(q.care, q.last, r.block_index)) { ew = 'pet died of neglect at block ' + deathBlock(q.care, q.last) + ' (in the Pet Cemetery): burn ignored'; deadBurn[r.tx_hash] = c.petId; } else if (q.care < THRESHOLDS[5]) ew = 'needs ' + THRESHOLDS[5] + ' care before evolving';
        if (ew) { notes[r.tx_hash] = ew; r = Object.assign({}, r, { tag: '' }); }
      }
      pre.push(r);
    });
    var st = GameCore.buildState(pre, { startBlock: opts.startBlock, costs: Object.assign({}, COSTS, { hatch: 1e-8, evolve: EVOLVE_COST_V1 }), petThresholds: THRESHOLDS, communityThresholds: COMMUNITY_THRESHOLDS }); // hatch minimums enforced above
    st.log.forEach(function (e) { if (notes[e.tx_hash]) { e.kind = 'rejected'; e.msg = notes[e.tx_hash] + ' (counts as community food)'; } if (deadBurn[e.tx_hash] != null) e.deadPetId = deadBurn[e.tx_hash]; if (plain[e.tx_hash]) { e.kind = 'plain'; e.msg = plain[e.tx_hash]; } });
    st.log.forEach(function (e) { var pe = packEgg[e.tx_hash]; if (pe) { e.pack = pe; e.packTx = pe.tx; if (e.kind === 'hatch') e.msg += ' (egg ' + (pe.i + 1) + '/' + pe.n + ' of a ' + pe.n + '-egg pack)'; } });
    // care caps: GameCore credited the full amount; take back the overpay (it still counts as burned for the community pet)
    var capBack = {}; st.log.forEach(function (e) { if ((e.kind === 'hatch' || e.kind === 'feedPet') && e.petId != null && credit[e.tx_hash] != null && e.amount > credit[e.tx_hash]) { capBack[e.petId] = (capBack[e.petId] || 0) + e.amount - credit[e.tx_hash]; e.credited = credit[e.tx_hash]; } });
    var evolveAmt = {}; st.log.forEach(function (e) { if (e.kind === 'evolve' && e.petId != null) evolveAmt[e.petId] = (evolveAmt[e.petId] || 0) + e.amount; });
    var byId = {}; st.pets.forEach(function (p) {
      if (capBack[p.id]) { p.care -= capBack[p.id]; p.overpaid = capBack[p.id]; }
      if (evolveAmt[p.id]) { p.care -= evolveAmt[p.id]; p.evolveBurned = evolveAmt[p.id]; } // GameCore adds the evolve burn as care; the real game does not
      var pe = packEgg[p.hatchTx]; p.pack = pe || null; p.hatchTxid = pe ? pe.tx : p.hatchTx;
      if (pe) { var share = st.log.filter(function (e) { return e.tx_hash === p.hatchTx; })[0].amount; p.care += COSTS.hatch - share; /* egg care = single hatch, not its price share */ p.stage = GameCore.stageFor(p.care, THRESHOLDS, p.ascended); p.stageName = GameCore.STAGE_NAMES[p.stage]; }
      // auto-ascend (no evolve burn) once the chain is at/after the cutoff and care is full; block = later of reaching full care and the cutoff
      var tipNow = opts.tip != null ? Number(opts.tip) : maxBlock, full = pets[p.id] && pets[p.id].fullAt != null ? pets[p.id].fullAt : null;
      if (!p.ascended && p.care >= THRESHOLDS[5] && tipNow >= EVOLVE_OFF_FROM_BLOCK && full != null && (!pets[p.id].released)) { p.ascended = true; p.autoAscended = Math.max(full, EVOLVE_OFF_FROM_BLOCK); }
      p.stage = GameCore.stageFor(p.care, THRESHOLDS, p.ascended); p.stageName = GameCore.STAGE_NAMES[p.stage];
      byId[p.id] = p; p.blockHash = blockHashes[p.hatchBlock] || null;
      p.art = p.blockHash ? PetCore.generate({ blockHash: p.blockHash, petId: p.hatchTx, blockHeight: p.hatchBlock }) : null;
      p.tokens = 0; p.keys = 0; p.tokenSrc = []; p.keySrc = []; p.bonusUnlocked = 0; p.equip = {}; p.gearOverride = {}; p.extraGear = {}; p.rolls = []; p.feedDays = {}; p.lastFedBlock = null; p.dead = null; p.reached = 1;
      p.care0 = 0; p.pendingArt = !p.blockHash;
      p.statBump = 0;
    });
    // Pass 3: walk the log again (it is in chain order) for drops, streaks, rolls and keys.
    var careNow = {}, extLog = [], loose = [], items = {}; // items: gid -> {gid, tx, slot, item, label, tier, owner, on (pet id or null = inventory), species (signature only)}
    function wear(p, slot, g) { // g = item record or null; keeps equip/gearOverride/extraGear in sync
      delete p.equip[slot]; delete p.gearOverride[slot]; delete p.extraGear[slot];
      if (g) { p.equip[slot] = g.item; (g.overlay || BONUS.indexOf(slot) >= 0 ? p.extraGear : p.gearOverride)[slot] = g.item; g.on = p.id; }
    }
    function wornGid(p, slot) { for (var k in items) if (items[k].on === p.id && items[k].slot === slot) return items[k]; return null; }
    var cutDone = false;
    function cutover(block) { // first time the walk reaches the cutoff: resolve leftover tokens and keys, oldest first
      if (cutDone || block < EVOLVE_OFF_FROM_BLOCK) return; cutDone = true;
      st.pets.forEach(function (p) { if (p.released || !p.art) return; while (p.keys > 0) autoKey(p, EVOLVE_OFF_FROM_BLOCK); while (p.tokens > 0) autoToken(p, EVOLVE_OFF_FROM_BLOCK); });
    }
    function autoKey(p, block) {
      p.keys--; var k = p.keySrc.shift();
      if (p.bonusUnlocked >= BONUS.length) { extLog.push({ kind: 'autoKey', petId: p.id, block_index: block, msg: 'slot key from ' + (k ? k.tx : '?') + ' unused: all bonus slots open' }); return; }
      p.bonusUnlocked++; extLog.push({ kind: 'autoKey', petId: p.id, block_index: block, tx_hash: k ? k.tx : null, msg: 'slot key (no burn) unlocked ' + BONUS[p.bonusUnlocked - 1] + ' slot' });
    }
    function autoToken(p, block) {
      p.tokens--; var t = p.tokenSrc.shift(); if (!t || !p.art) return;
      if (isDeadAt(careNow[p.id], p.lastFedBlock || p.hatchBlock, block)) { extLog.push({ kind: 'autoToken', petId: p.id, block_index: block, msg: 'roll token lost: pet died of neglect' }); return; }
      var open = openSlots(p); if (!open.length) return;
      var h = seed(t.bh, t.tx + ':token', 'XCPETS:token-roll:v2'), slot = open[parseInt(h.slice(16, 24), 16) % open.length], it = pickItem(h, slot, p.art.species, p.art.tierIndex);
      var gid = 't:' + t.tx; p.rolls.push({ tx: t.tx, gid: gid, slot: slot, item: it.id, label: it.label, tier: it.t, token: true });
      items[gid] = { gid: gid, tx: t.tx, slot: slot, item: it.id, label: it.label, tier: it.t, owner: p.owner, on: null, overlay: !!it.overlay, species: it.species || null, rolledOn: p.id, token: true };
      if (!wornGid(p, slot)) wear(p, slot, items[gid]);
      var key = roll10k(seed(t.bh, t.tx + ':token', 'XCPETS:key:v2')) < DROP.key; if (key) { p.keys++; p.keySrc.push({ tx: t.tx }); }
      extLog.push({ kind: 'autoToken', petId: p.id, block_index: block, tx_hash: t.tx, msg: 'roll token (no burn) → ' + it.label + ' (' + slot + ')' + (key ? ' + Slot Key!' : '') });
      if (key) autoKey(p, block);
    }
    st.log.forEach(function (e) {
      cutover(e.block_index);
      var r = e, bh = blockHashes[e.block_index], ext = parseExt(e.tag), p = e.petId != null ? byId[e.petId] : null;
      if (ext && ext.action === 'grave' && e.block_index < GRAVE_GEAR_FROM_BLOCK) ext = null; // inert before the block (unknown tag, as before)
      if (e.kind === 'hatch' && p) { careNow[p.id] = e.pack ? COSTS.hatch : (credit[e.tx_hash] != null ? credit[e.tx_hash] : e.amount); p.reached = GameCore.stageFor(careNow[p.id], THRESHOLDS, false); if (p.reached >= 1) drop(p, e, bh, 'stageUp'); return; }
      if (e.kind === 'feedPet' && p) {
        var before = GameCore.stageFor(careNow[p.id], THRESHOLDS, false); careNow[p.id] += (credit[e.tx_hash] != null ? credit[e.tx_hash] : e.amount);
        var after = GameCore.stageFor(careNow[p.id], THRESHOLDS, false);
        var d = day(e.block_index); p.feedDays[d] = (p.feedDays[d] || 0) + 1; p.lastFedBlock = e.block_index;
        drop(p, e, bh, after > before ? 'stageUp' : 'meal'); return;
      }
      if (!ext || PACKS[ext.action] || (e.kind !== 'rejected' && e.kind !== 'plain')) return;
      if ((ext.action === 'tokenRoll' || ext.action === 'key') && e.block_index >= EVOLVE_OFF_FROM_BLOCK) { e.kind = 'plain'; e.ext = ext.action; e.msg = (ext.action === 'key' ? 'slot keys' : 'roll tokens') + ' need no burn from block ' + EVOLVE_OFF_FROM_BLOCK + ' (they apply by themselves): treated as a plain burn (counts as community food)'; extLog.push(e); return; }
      var res = applyExt(ext, e, bh); e.ext = ext.action; e.msg = res.msg; if (res.ok) e.kind = ext.action; extLog.push(e);
    });
    function drop(p, e, bh, kind) {
      if (!bh) return; if (roll10k(seed(bh, e.tx_hash, 'XCPETS:drop:v1')) < DROP[kind]) { p.tokens++; p.tokenSrc.push({ tx: e.tx_hash, bh: bh, block: e.block_index }); e.drop = 'token'; if (e.block_index >= EVOLVE_OFF_FROM_BLOCK) autoToken(p, e.block_index); }
    }
    function applyExt(x, e, bh) {
      if (x.action === 'invalid') return { ok: false, msg: x.reason };
      if (x.action === 'croll' || x.action === 'cback') {
        if (e.amount < COSTS[x.action]) return { ok: false, msg: 'below ' + x.action + ' minimum' };
        return { ok: true, msg: 'community ' + (x.action === 'croll' ? 'roll candidate C' + e.tx_index : 'backing for C' + x.candidate) + ' (window scoring: phase 2)' };
      }
      if (x.action === 'release') {
        var done = [], why = [];
        x.ids.forEach(function (pid) { var q = byId[pid];
          if (!q || q.released) { why.push('#' + pid + ' no such pet'); return; } if (q.owner !== e.source) { why.push('#' + pid + ' owner only'); return; }
          q.released = e.block_index; done.push(pid);
          for (var k in items) if (items[k].on === q.id) items[k].on = null; // worn gear goes to the owner's inventory
          q.rolls.forEach(function (g) { loose.push({ owner: q.owner, slot: g.slot, item: g.item, label: g.label, tier: g.tier, tx: g.tx, fromPet: q.id, species: q.art && q.art.species }); }); });
        return done.length ? { ok: true, msg: 'released #' + done.join(', #') + (why.length ? ' (skipped ' + why.join(', ') + ')' : '') } : { ok: false, msg: why.join(', ') || 'nothing released' };
      }
      var p = byId[x.petId];
      if (!p) return { ok: false, msg: 'no such pet' };
      if (p.released) return { ok: false, msg: 'pet was released' };
      if (p.owner !== e.source) return { ok: false, msg: 'owner only' };
      if (isDeadAt(careNow[p.id], p.lastFedBlock || p.hatchBlock, e.block_index)) { e.deadPetId = p.id; return { ok: false, msg: 'pet died of neglect at block ' + deathBlock(careNow[p.id], p.lastFedBlock || p.hatchBlock) + ' (Pet Cemetery): burn ignored' }; }
      if (x.action === 'grave') { if (x.on) { p.graveGear = e.block_index; p.graveTx = e.tx_hash; } else { delete p.graveGear; delete p.graveTx; }
        return { ok: true, msg: x.on ? 'worn gear stays on the grave if #' + p.id + ' dies' : 'grave gear cancelled for #' + p.id }; }
      if (!bh || !p.art) return { ok: false, msg: 'block hash unknown (pending)' };
      if (x.action === 'key') {
        if (p.keys < 1) return { ok: false, msg: 'no slot key' };
        if (p.bonusUnlocked >= BONUS.length) return { ok: false, msg: 'all bonus slots open' };
        p.keys--; p.keySrc.shift(); p.bonusUnlocked++; return { ok: true, msg: 'unlocked ' + BONUS[p.bonusUnlocked - 1] + ' slot' };
      }
      if (x.action === 'tokenRoll') { if (p.tokens < 1) return { ok: false, msg: 'no roll token' }; }
      else if (e.amount < COSTS.roll) return { ok: false, msg: 'below roll cost ' + COSTS.roll };
      var open = openSlots(p), h = seed(bh, e.tx_hash, 'XCPETS:gear-roll:v1');
      if (!open.length) return { ok: false, msg: 'pet has no open gear slots' };
      var slot = x.slot && open.indexOf(x.slot) >= 0 ? x.slot : open[parseInt(h.slice(16, 24), 16) % open.length];
      if (x.action === 'tokenRoll') { p.tokens--; p.tokenSrc.shift(); }
      var it = pickItem(h, slot, p.art.species, p.art.tierIndex);
      p.rolls.push({ tx: e.tx_hash, gid: e.tx_index, slot: slot, item: it.id, label: it.label, tier: it.t });
      var prev = wornGid(p, slot); if (prev) prev.on = null; // newest roll equips; the one it replaces goes to inventory
      items[e.tx_index] = { gid: e.tx_index, tx: e.tx_hash, slot: slot, item: it.id, label: it.label, tier: it.t, owner: p.owner, on: null, overlay: !!it.overlay, species: it.species || null, rolledOn: p.id };
      wear(p, slot, items[e.tx_index]);
      var key = roll10k(seed(bh, e.tx_hash, 'XCPETS:key:v1')) < DROP.key; if (key) { p.keys++; p.keySrc.push({ tx: e.tx_hash }); if (e.block_index >= EVOLVE_OFF_FROM_BLOCK) autoKey(p, e.block_index); }
      return { ok: true, msg: 'rolled ' + it.label + ' (' + slot + ')' + (key ? ' + Slot Key!' : '') };
    }
    function openSlots(p) { var n = Math.max(MIN_SLOTS, Math.min(SLOTS.length, BUMP_SLOTS[p.art.tierIndex])); return SLOTS.slice(0, n).concat(BONUS.slice(0, p.bonusUnlocked)); }
    if (opts.tip != null && opts.tip >= EVOLVE_OFF_FROM_BLOCK) cutover(opts.tip); else if (maxBlock >= EVOLVE_OFF_FROM_BLOCK) cutover(maxBlock);
    var tipDay = opts.tip != null ? day(opts.tip) : null;
    st.pets.forEach(function (p) {
      p.deathBlock = deathBlock(p.care, p.lastFedBlock || p.hatchBlock);
      if (opts.tip != null && p.deathBlock != null && opts.tip >= p.deathBlock) {
        p.dead = { block: p.deathBlock, day: day(p.deathBlock), cause: 'neglect' };
        var keep = p.graveGear != null && p.graveGear >= GRAVE_GEAR_FROM_BLOCK; // grave gear opt-in: it stays on the dead pet
        for (var k in items) if (items[k].on === p.id) { if (keep) items[k].grave = p.id; else items[k].on = null; } // default: worn gear goes back to the owner's inventory
      }
      p.daysLeft = p.deathBlock != null && tipDay != null && !p.dead ? day(p.deathBlock) - tipDay : null; // 1 = last day to feed
      p.openSlots = p.art && !p.dead ? openSlots(p) : [];
      p.nextMeal = mealFor(p.care, opts.tip); p.feedLimit = feedsPerDayAt(opts.tip);
      p.fedToday = tipDay != null ? (p.feedDays[tipDay] || 0) : null;
      var s = 0; if (tipDay != null) { var d0 = p.feedDays[tipDay] ? tipDay : tipDay - 1; while (p.feedDays[d0 - s]) s++; } p.streak = s;
    });
    // growing name with the REAL community thresholds: Sat -> Satoshi Nakamoto at Elder -> full title after The Return (69M burned)
    var cb = st.community.burned; st.communityName = cb >= GameCore.COMMUNITY_QUEST_END ? GameCore.communityName(cb) : cb >= COMMUNITY_THRESHOLDS[4] ? 'Satoshi Nakamoto' : 'Sat';
    st.releasedPets = st.pets.filter(function (p) { return p.released; }); st.pets = st.pets.filter(function (p) { return !p.released; }); st.looseGear = loose;
    // Pet Cemetery: newest death first (then highest id). Dead pets stay in st.pets (their page still opens) but the UI drops them from My Pets and the ranking.
    st.cemetery = st.pets.filter(function (p) { return p.dead; }).sort(function (a, b) { return b.dead.block - a.dead.block || b.id - a.id; });
    st.alive = st.pets.filter(function (p) { return !p.dead; });
    st.log.forEach(function (e) { if (e.deadPetId != null && byId[e.deadPetId]) byId[e.deadPetId].ignoredBurns = (byId[e.deadPetId].ignoredBurns || 0) + 1; });
    st.items = Object.keys(items).map(function (k) { return items[k]; }); st._chainOn = st.items.map(function (g) { return g.on; }); // chain-worn snapshot for applyLoadout
    st.inventoryOf = function (a) { return st.items.filter(function (g) { return g.owner === a && g.on == null; }); };
    st.ext = extLog; st.rules = { COMMUNITY_THRESHOLDS: COMMUNITY_THRESHOLDS, MEAL_SIZES: MEAL_SIZES, THRESHOLDS: THRESHOLDS, COSTS: COSTS, FEEDS_PER_DAY: FEEDS_PER_DAY, FEED_V2_FROM_BLOCK: FEED_V2_FROM_BLOCK, MEAL_SIZES_V1: MEAL_SIZES_V1, FEEDS_PER_DAY_V1: FEEDS_PER_DAY_V1, BLOCKS_PER_DAY: BLOCKS_PER_DAY, DEATH_FROM_BLOCK: DEATH_FROM_BLOCK, NEGLECT_DAYS: NEGLECT_DAYS, EVOLVE_OFF_FROM_BLOCK: EVOLVE_OFF_FROM_BLOCK };
    return st;
  }
  /** actionPlan(kind, {pet, slot, candidate}) -> {ok, tag, amount (whole XCPETS, PROPOSED/UNAPPROVED), label} */
  var LABELS = { hatch: 'Hatch', hatch12: 'Dozen egg pack (12 eggs)', hatch144: 'Case egg pack (144 eggs)', feedPet: 'Feed', roll: 'Gear roll', tokenRoll: 'Token roll', key: 'Use slot key', feed: 'Feed community', croll: 'Community roll', cback: 'Back candidate' };
  function actionPlan(kind, o) {
    o = o || {}; var pet = o.pet || null;
    var t = buildTag(kind, { petId: pet ? pet.id : o.petId, slot: o.slot, candidate: o.candidate });
    if (!t.ok) return t;
    var amt = { hatch: COSTS.hatch, hatch12: COSTS.hatch12, hatch144: COSTS.hatch144, roll: COSTS.roll, feed: COSTS.feed, croll: COSTS.croll, cback: COSTS.cback }[kind];
    if (pet && pet.dead) return { ok: false, error: 'pet died of neglect at block ' + pet.dead.block + ' (Pet Cemetery): no actions' };
    if (kind === 'feedPet') { if (!pet) return { ok: false, error: 'pick a pet' }; amt = pet.nextMeal != null ? pet.nextMeal : mealFor(pet.care); if (!amt) return { ok: false, error: 'pet is fully fed' };
      var lim = pet.feedLimit || FEEDS_PER_DAY;
      if (pet.fedToday != null && pet.fedToday >= lim) return { ok: false, error: lim === 1 ? 'already fed this 144-block day (1 feed a day)' : 'already fed ' + lim + 'x this 144-block day' }; }
    if (kind === 'tokenRoll' || kind === 'key') return { ok: false, error: (kind === 'key' ? 'Slot keys' : 'Roll tokens') + ' need no burn: they apply by themselves (no transaction)' };
    if (kind === 'evolve') return { ok: false, error: 'Evolve was removed: pets reach Mythic automatically when fed to ' + THRESHOLDS[5].toLocaleString() + ' care' };
    if (amt === FREE) amt = '0.00000001';
    return { ok: true, tag: t.tag, amount: amt, label: LABELS[kind], eggs: PACKS[kind] ? PACKS[kind].n : (kind === 'hatch' ? 1 : 0), unapproved: true };
  }
  /**
   * Local loadout (free, per device): lo = { petId: { slot: { gid: <roll tx_index> | null (take off), base: <chain-worn gid or null when set>, t: <order> } } }.
   * applyLoadout(st, owner, lo) resets st to the chain's worn gear (newest roll per slot), then applies the owner's overrides in
   * order with the same rules (owner only, slot open, species-only items, one pet per item, replaced item -> inventory).
   * An override is dropped (stale) if its pet is gone/not owned, the slot is closed, the item is gone/not owned/wrong slot or
   * species, or the chain's worn item in that slot changed since it was set (e.g. a new roll). Returns { lo: cleaned, dropped }.
   */
  function applyLoadout(st, owner, lo) {
    var byId = {}, items = {}, out = {}, dropped = [], list = [];
    st.pets.forEach(function (p) { byId[p.id] = p; });
    st.items.forEach(function (g, i) { g.on = st._chainOn[i]; items[g.gid] = g; });
    function sync(p) { p.equip = {}; p.gearOverride = {}; p.extraGear = {}; }
    st.pets.forEach(sync);
    st.items.forEach(function (g) { var p = g.on != null ? byId[g.on] : null; if (p) put(p, g); else g.on = null; });
    function put(p, g) { p.equip[g.slot] = g.item; (g.overlay || BONUS.indexOf(g.slot) >= 0 ? p.extraGear : p.gearOverride)[g.slot] = g.item; g.on = p.id; }
    function off(p, slot) { delete p.equip[slot]; delete p.gearOverride[slot]; delete p.extraGear[slot]; }
    function wornOn(pid, slot) { for (var k in items) if (items[k].on === pid && items[k].slot === slot) return items[k]; return null; }
    var chainWorn = {}; st.items.forEach(function (g) { if (g.on != null) chainWorn[g.on + ':' + g.slot] = g.gid; });
    Object.keys(lo || {}).forEach(function (pid) { var e = lo[pid] || {}; Object.keys(e).forEach(function (sl) { if (e[sl]) list.push({ pid: Number(pid), slot: sl, o: e[sl] }); }); });
    list.sort(function (a, b) { return (a.o.t || 0) - (b.o.t || 0); });
    list.forEach(function (x) {
      var p = byId[x.pid], gid = x.o.gid == null ? null : (isNaN(Number(x.o.gid)) ? x.o.gid : Number(x.o.gid)), g = gid == null ? null : items[gid], why = null;
      var base = chainWorn[x.pid + ':' + x.slot]; base = base == null ? null : base;
      if (!p || p.owner !== owner || !p.art) why = 'pet gone or not yours';
      else if (p.dead) why = 'pet is in the Pet Cemetery';
      else if (p.openSlots.indexOf(x.slot) < 0) why = 'slot not open';
      else if ((x.o.base == null ? null : Number(x.o.base)) !== base) why = 'chain gear in this slot changed';
      else if (gid != null && (!g || g.owner !== owner || g.slot !== x.slot)) why = 'item gone or not yours';
      else if (g && g.species && g.species !== p.art.species) why = 'species-only item';
      if (why) { dropped.push({ petId: x.pid, slot: x.slot, gid: gid, why: why }); return; }
      var cur = wornOn(p.id, x.slot);
      if (g && cur === g) { (out[x.pid] = out[x.pid] || {})[x.slot] = x.o; return; }
      if (cur) { cur.on = null; off(p, x.slot); }
      if (g) { var from = g.on != null ? byId[g.on] : null; if (from) off(from, g.slot); put(p, g); }
      (out[x.pid] = out[x.pid] || {})[x.slot] = x.o;
    });
    return { lo: out, dropped: dropped };
  }
  /** loadoutSet(st, lo, petId, slot, gid|null, t) -> new lo with one override added (records the chain-worn base for staleness). */
  function loadoutSet(st, lo, petId, slot, gid, t) {
    var n = JSON.parse(JSON.stringify(lo || {}));
    function base(pid, sl) { var b = null; st.items.forEach(function (g, i) { if (st._chainOn[i] === pid && g.slot === sl) b = g.gid; }); return b; }
    if (gid != null) { // the item leaves wherever it is now: record that pet's slot as empty so later edits can't bring it back
      Object.keys(n).forEach(function (pid) { Object.keys(n[pid]).forEach(function (sl) { var o = n[pid][sl]; if (o && o.gid === gid && Number(pid) !== petId) n[pid][sl] = { gid: null, base: o.base, t: t }; }); });
      var g = st.items.filter(function (x) { return x.gid === gid; })[0];
      if (g && g.on != null && g.on !== petId) (n[g.on] = n[g.on] || {})[g.slot] = { gid: null, base: base(g.on, g.slot), t: t };
    }
    (n[petId] = n[petId] || {})[slot] = { gid: gid == null ? null : gid, base: base(petId, slot), t: t + (gid != null ? 0.5 : 0) };
    return n;
  }
  function cemeteryOf(st, address) { return (st.cemetery || []).filter(function (p) { return !address || p.owner === address; }); }
  function petsOf(st, address) { return st.pets.filter(function (p) { return p.owner === address; }); }

  return { GRAVE_GEAR_FROM_BLOCK: GRAVE_GEAR_FROM_BLOCK, NOBURN_DUST_V1: NOBURN_DUST_V1, EVOLVE_OFF_FROM_BLOCK: EVOLVE_OFF_FROM_BLOCK, EVOLVE_COST_V1: EVOLVE_COST_V1, BUMP_SLOTS: BUMP_SLOTS, BUMP_FREE_BONUS: BUMP_FREE_BONUS, BUMP_STATS: BUMP_STATS, MIN_SLOTS: MIN_SLOTS, SLOTS: SLOTS, ASSET: ASSET, MEAL_SIZES: MEAL_SIZES, MEAL_SIZES_V1: MEAL_SIZES_V1, FEEDS_PER_DAY_V1: FEEDS_PER_DAY_V1, FEED_V2_FROM_BLOCK: FEED_V2_FROM_BLOCK, DEATH_FROM_BLOCK: DEATH_FROM_BLOCK, NEGLECT_DAYS: NEGLECT_DAYS, deathBlock: deathBlock, isDeadAt: isDeadAt, cemeteryOf: cemeteryOf, feedsPerDayAt: feedsPerDayAt, THRESHOLDS: THRESHOLDS, COSTS: COSTS, FEEDS_PER_DAY: FEEDS_PER_DAY, DROP: DROP, BLOCKS_PER_DAY: BLOCKS_PER_DAY,
    PACKS: PACKS, FREE: FREE, COMMUNITY_THRESHOLDS: COMMUNITY_THRESHOLDS, SLOTS: SLOTS, BONUS: BONUS, CSLOTS: CSLOTS, RULES: RULES, mealFor: mealFor, day: day, parseExt: parseExt, buildTag: buildTag, replay: replay, petsOf: petsOf, pickItem: pickItem, actionPlan: actionPlan, LABELS: LABELS, releaseTags: releaseTags, releasePlans: releasePlans, applyLoadout: applyLoadout, loadoutSet: loadoutSet };
});
