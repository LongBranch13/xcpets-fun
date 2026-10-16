/*!
 * XCPETS demo v2 rules (LOCAL DEMO ONLY: mocked chain, nothing is ever signed or broadcast).
 * Pure + deterministic: world = replay(rows, blockHashes, ops, opts). rows = mock destroy rows {tx_hash, block_index, source, amount, tag};
 * ops = free local actions (equip) {block_index, kind:'equip', owner, petId, gid|null, slot}. No Math.random; all luck = sha256(block hash + tx + label).
 * Every number is a PROPOSAL for the owner to approve.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../../../generator/pet-core.js'), require('../bonus-gear.js'), require('./v2-gear.js'));
  else root.V2Rules = factory(root.PetCore, root.BonusGear, root.V2Gear);
})(this, function (PetCore, BonusGear, V2Gear) {
  'use strict';
  // ---------------------------------------------------------------- constants
  // CUTOFF_BLOCK (2026-10-14, GO_LIVE_CHECKLIST item 1): the ONE switch between the live rules and v2. Burns in blocks <= CUTOFF_BLOCK replay
  // exactly like live xcpets.fun (the frozen live engine, when one is attached with setLiveEngine / opts.live), then v2 rules apply from it on.
  // FINAL (Jake, 2026-10-14): CUTOFF_BLOCK = 971500 is INCLUSIVE = the LAST block replayed with the live rules ("at or before 971,500").
  // v2 rules apply from V2_FROM_BLOCK = CUTOFF_BLOCK + 1 = 971501. Every comparison below uses V2_FROM_BLOCK: block < V2_FROM_BLOCK <=> block <= CUTOFF_BLOCK (live).
  var CUTOFF_BLOCK = 971500;
  var V2_FROM_BLOCK = CUTOFF_BLOCK + 1; // first v2 block: v2 tags (fight/accept/rumble/breed, 69-min community feed) count from here
  var LIVE_DEATH_FROM_BLOCK = 971280, LIVE_UNIT = 1e8; // live real-core.js: death clock anchor; GameCore.UNIT (raw quantity per XCPETS)
  var BLOCKS_PER_DAY = 144, WEEK = 1008, NEGLECT_DAYS = 7, NEGLECTED_AFTER_DAYS = 3;
  var COSTS = { hatch: 69, roll: 345, feedMin: 69, feedMinV1: 7, fight: 690, accept: 690, rumble: 69, rumbleStake: 690, breed: 690, release: 0.00000001, croll: 690, froll: 0.00000001 };
  var FEED_QUICK = [69, 690, 6900];
  var FEE_SATS = 1500;                 // mock BTC miner fee per burn tx (shown up front in the confirm modal)
  var MAX_RELEASE_PER_BURN = 120, MAX_TAG_BYTES = 34;
  /* Multi-pet feed (2026-10-15, Jake): pet:fm:START:MASK feeds every pet in the base32 bitmask (same mask format as pet:rel) in ONE burn.
   * Inert until ACTIVATE_FEEDM_BLOCK: before it a pet:fm tag replays exactly as today (unknown pet: tag, community food only). */
  /* Community roll (2026-10-15, Jake approved): pet:c:roll[:SLOT] (SLOT = a v2 slot id: HEAD HAND BODY BACK FACE FEET) burns 690 and gives the
   * community pet Nakamoto one gear item right away (seed: block hash + tx, like a token roll). Inert until ACTIVATE_CROLL_BLOCK: before it the tag
   * replays exactly as before (unknown pet: tag, community food only). The 7 old 25,000 pet:c:roll burns are pre-cutoff (frozen live engine). */
  var ACTIVATE_CROLL_BLOCK = 971519;  // Bitcoin tip 971,516 at 2026-10-15 00:40 CT + 3 (Jake approved)
  /* Roll tokens (2026-10-15, Jake approved): from ACTIVATE_TOKENS_BLOCK a pet that moves up a stage (hatching counts: single hatch and packs)
   * has a 25% chance of a roll token, and a pet that eats without a stage-up 2% (each pet of a bundled pet:fm feed rolls on its own); at most
   * one token per pet per burn. Seed = sha(block hash + tx + ':' + pet id + 'XCPETS:v2:token-drop'). A token turns into one free gear item right
   * away, rolled like a paid pet:roll (random open slot, same pool) from sha(block hash + tx + ':' + pet id + 'XCPETS:v2:token-roll').
   * Inert before the block: older burns replay exactly as before. */
  var ACTIVATE_TOKENS_BLOCK = 971525;  // Bitcoin tip 971,522 at 2026-10-15 01:11 CT + 3 (Jake approved)
  var TOKEN_DROP_10K = { stageUp: 2500, meal: 200 };
  /* FOUNDER GRANT (PROTOTYPE 2026-10-15, not live): per pre-cutoff 25,000 pet:c:roll burn, the burner's address gets FOUNDER_KIT_PER_ROLL (EXISTING
   * Legendary pieces, into the inventory, unequipped) + FOUNDER_CREDITS_PER_ROLL free gear rolls (spent with pet:fr:ID, any amount >= 1 sat) at
   * ACTIVATE_FOUNDER_BLOCK. Hard-coded by txid so replay is exact; nothing changes before the block.
   * Switch: gear-only = CREDITS 0 · rolls-only = KIT [] and CREDITS 72 or 36 · mix = both (default). */
  var ACTIVATE_FOUNDER_BLOCK = 971526;  // Bitcoin tip 971,523 at 2026-10-15 01:21 CT + 3 (Jake approved)
  var FOUNDER_KIT_PER_ROLL = ['v2-crown-gold', 'golden-sword', 'gold', 'goldcape', 'v2-gold-aviators']; // Royal gold crown, Golden sword, Gold armor, Golden cape, Gold aviators
  var FOUNDER_CREDITS_PER_ROLL = 36;
  var FOUNDER_ROLLS = [ // [block, txid, address] in chain order (6 x bc1qs88..., 1 x bc1pvnxv...)
    [971084, 'f0c82ec93a28357b6c3a2db6c51d4bc7d8f79a46c68e5a9cd5c7df986b854545', 'bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n'],
    [971087, 'd0c3016929f382efb94103e83df630b3b2a9c7daf827f1ab6511b3397fe821d5', 'bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n'],
    [971102, '6a1b691dd27a31a9df16c8a971d5a9bf20d642e956aaf051d7644d637abb20ac', 'bc1pvnxvtzx2u2wctpnl0m2n8hvz8hy59k5c0u4947qmeph8grsyg6fswcrnsm'],
    [971152, 'abccbb66eaf9b41088d9bc0793920836f9fba38d4dd3d90d5bda72a288e69cae', 'bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n'],
    [971153, 'c20620b8c46a5850415da75836ffbf5065e1f2f654d32825eea9e2ae0b0e20ec', 'bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n'],
    [971153, 'e29199376ebc12f3e142a4ee0a1e7b6c7c21fd7de580252fafb8c9e47f1e32c7', 'bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n'],
    [971187, '9b76d1fc9b64ffec5bb1e15300503b1e42b6ae34cf2511f772a2eff8c81b64ea', 'bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n']];
  /** grantFounders(w, b): once, the first time replay reaches block b >= ACTIVATE_FOUNDER_BLOCK (before that block's burns). Only rolls the frozen engine saw count. */
  function grantFounders(w, b) { if (w.founderGranted || b < ACTIVATE_FOUNDER_BLOCK) return; w.founderGranted = b;
    FOUNDER_ROLLS.forEach(function (f) { if (w.founderSeen && !w.founderSeen[f[1]]) return; var got = [];
      FOUNDER_KIT_PER_ROLL.forEach(function (id) { var it = BY_ID[id]; if (!it) return; var g = newItem(w, it, f[2], 'founder'); g.founderTx = f[1]; got.push(it.label); });
      w.freeRolls[f[2]] = (w.freeRolls[f[2]] || 0) + FOUNDER_CREDITS_PER_ROLL;
      w.log.push({ block: b, tx: f[1], kind: 'founder', msg: 'founder grant for community roll ' + f[1].slice(0, 10) + '…: ' + (got.length ? got.join(', ') : 'no gear') + ' + ' + FOUNDER_CREDITS_PER_ROLL + ' free rolls' }); }); }
  /** freeRolls(w, owner, pendingTags): founder free rolls the play page may offer = credits after replay minus this address's still-unconfirmed pet:fr burns.
   * on = false before ACTIVATE_FOUNDER_BLOCK (by chain tip), for non-founders and when nothing is left. */
  function freeRolls(w, owner, pendingTags) { var have = (w.freeRolls && w.freeRolls[owner]) || 0, pend = (pendingTags || []).filter(function (t) { return /^pet:fr:\d+$/i.test(String(t)); }).length, left = Math.max(0, have - pend);
    return { on: w.tip != null && w.tip >= ACTIVATE_FOUNDER_BLOCK && left > 0, left: left, pending: pend }; }
  function freeRollPlan(petId) { return { tag: 'pet:fr:' + petId, amount: COSTS.froll, petId: petId, label: 'Free roll #' + petId }; }
  var ACTIVATE_FEEDM_BLOCK = 971515;  // Bitcoin tip 971,512 at 2026-10-15 00:14 CT + 3 (Jake approved)
  var THRESHOLDS = [0, 69, 8349, 22149, 41469, 69069];             // normal pets (unchanged; Mythic day 9 at 1 meal/day)
  var MEAL_SIZES = [0, 4140, 6900, 9660, 9200];
  function x10(a) { return a.map(function (v, i) { return i <= 1 ? v : v * 10; }); }
  var NAKAMOTO_THRESHOLDS = x10(THRESHOLDS);                       // [0, 69, 83490, 221490, 414690, 690690]; hatch stays 69
  var NAKAMOTO_MEALS = [0, 7, 7, 7, 9];                            // 30 daily meals => Mythic ~ day 30 (~a month)
  var NAKAMOTO_MEAL_SIZES = NAKAMOTO_MEALS.map(function (n, k) { return k ? Math.ceil((NAKAMOTO_THRESHOLDS[k + 1] - NAKAMOTO_THRESHOLDS[k]) / n) : 0; });
  var WIZARD_THRESHOLDS = NAKAMOTO_THRESHOLDS.map(function (v, i) { return i === 1 ? 69000 : v * 10; }); // community pet: 10x Nakamoto => Mythic 6,906,900; hatch 69,000 (Jake 2026-10-15, immediate, no activation block)
  /* THE RETURN (Jake 2026-10-14, final): ONE constant, COMMUNITY_GOAL = 1,111,111 TOTAL community XCPETS burned (every valid burn, all-time,
   * the same total as the live site), counted from zero: progress = min(burned, 1,111,111) / 1,111,111; The Return fires when burned >= 1,111,111.
   * Until then the community pet is Nakamoto at Mythic; after it a new community pet and grows from the burns AFTER the
   * trigger (WIZARD_THRESHOLDS). It is chain state, so every visitor sees it. Mainnet at go-live: 725,034 -> 65.3%. */
  var COMMUNITY_GOAL = 1111111, COMMUNITY_GOAL_NAME = 'The Return', COMMUNITY_PET = 'community pet', BURN_ADDRESS = null;  // not shown to players (no spoilers)
  // totals are float sums of 8-decimal amounts: round to 1e-8 so 1,111,111 exactly always fires and the counter shows clean numbers
  function returnProgress(burned) { var b = Math.round(Math.max(0, Number(burned) || 0) * 1e8) / 1e8, x = Math.min(b, COMMUNITY_GOAL); return { count: x, goal: COMMUNITY_GOAL, pct: x / COMMUNITY_GOAL, done: b >= COMMUNITY_GOAL }; }
  var STAGE_NAMES = ['Egg', 'Hatchling', 'Juvenile', 'Adult', 'Elder', 'Mythic'];
  var V2_SLOTS = ['head', 'hand', 'body', 'back', 'face', 'feet'];  // unlock order (capacity n => first n slots)
  // display names only (internal keys unchanged; body and back stay separate slots). No emojis.
  var SLOT_LABELS = { head: 'Headwear', face: 'Guise', back: 'Drip', hand: 'Grip', body: 'Outfits', feet: 'Footwear' };
  function slotLabel(sl) { return SLOT_LABELS[sl] || String(sl); }
  var BLACK_EYE_BLOCKS = 72, FIGHT_WINDOW = 144, FIGHT_TURNS = 12;
  var BREED_COOLDOWN = 1008, BREED_MAX = 3, BREED_WINDOW = 144;
  var RARITY_UP_10K = 500, RARITY_HIGH_10K = 3000;                  // 5% one tier above best parent; 30% the higher parent; else the lower
  var TIER_LABELS = ['Common', 'Uncommon', 'Rare', 'Legendary'];
  var NAKAMOTO_CAST_STAGE = 3;         // Nakamoto joins the front-page Cast once any hatched Nakamoto reaches this stage (3 = Adult; set 5 for Mythic)
  /** castShowsNakamoto(w): true once any hatched Nakamoto (dead/released ones count: they reached it) is at NAKAMOTO_CAST_STAGE or higher. */
  function castShowsNakamoto(w) { return !!(w && w.pets || []).some(function (p) { return p.species === 'nakamoto' && !p.max && p.stage >= NAKAMOTO_CAST_STAGE; }); }

  // ---------------------------------------------------------------- helpers
  function sha(s) { return PetCore.sha256Hex(String(s)); }
  function stream(seed) { var n = 0, buf = '', i = 0; return function () { if (i + 8 > buf.length) { buf = sha(seed + ':' + (n++)); i = 0; } var v = parseInt(buf.slice(i, i + 8), 16); i += 8; return v; }; }
  function day(b) { return Math.floor(b / BLOCKS_PER_DAY); }
  function weekOf(b) { return Math.floor(b / WEEK); }
  function seedBlockOfWeek(w) { return (w + 1) * WEEK; }
  function utf8Len(s) { return unescape(encodeURIComponent(s)).length; }

  // ---------------------------------------------------------------- species (13)
  var SPECIES13 = PetCore.SPECIES.filter(function (s) { return !s.community; }).map(function (s) { return { id: s.id, label: s.label, w: s.w }; });
  SPECIES13.push({ id: 'nakamoto', label: 'Nakamoto', w: 5 });     // 13th hatchable species (rare-ish weight like KEVIN/Lenny)
  function pickSpecies(hex) { var tot = SPECIES13.reduce(function (a, s) { return a + s.w; }, 0), r = parseInt(hex.slice(0, 8), 16) % tot;
    for (var i = 0; i < SPECIES13.length; i++) { if (r < SPECIES13[i].w) return SPECIES13[i].id; r -= SPECIES13[i].w; } return SPECIES13[0].id; }
  function thresholdsFor(species) { return species === 'nakamoto' ? NAKAMOTO_THRESHOLDS : THRESHOLDS; }
  function mealSizesFor(species) { return species === 'nakamoto' ? NAKAMOTO_MEAL_SIZES : MEAL_SIZES; }
  function stageFor(care, th) { var s = 0; for (var k = 1; k < 6; k++) if (care >= th[k]) s = k; return s; }
  function mealFor(care, species) { var th = thresholdsFor(species), ms = mealSizesFor(species); if (care >= th[5]) return 0; if (care < th[1]) return th[1] - care;
    var k = Math.min(4, Math.max(1, stageFor(care, th))); return Math.min(ms[k], th[k + 1] - care); }
  function mealsToMythic(species) { var c = THRESHOLDS[1], n = 0; while (mealFor(c, species) > 0) { c += mealFor(c, species); n++; } return n; }
  function wizardStage(burned) { return stageFor(burned, WIZARD_THRESHOLDS); }

  // ---------------------------------------------------------------- universal gear pool
  var CORE_SLOT = { band: 'head', crown: 'head', armor: 'body', cape: 'back', weapon: 'hand', face: 'face', back: 'back', feet: 'feet' };
  var CORE_LISTS = { band: 'BANDS', armor: 'ARMORS', cape: 'CAPES', weapon: 'WEAPONS', crown: 'CROWNS' };
  var V2_SLOT_FIX = { 'sats-stack': 'hand', 'wow-bandana': 'back' /* Doge's ★ back/Drip neckerchief */ }; // a held stack of sats, not footwear (it drew beside the pet, never on the feet)
  var CARD_FIX = { 'rare-card': 1, 'v2-nakamoto-held': 1 };
  var ALL = (function () {
    var out = [];
    Object.keys(CORE_LISTS).forEach(function (sl) { (PetCore[CORE_LISTS[sl]] || []).forEach(function (x) { if (x.id === 'none') return;
      out.push({ id: x.id, label: x.label, slot: CORE_SLOT[sl], coreSlot: sl, tier: x.t || 0, w: x.w || 10, src: 'core', origin: null, exclusive: false }); }); });
    (BonusGear.ITEMS || []).forEach(function (x) { if ((V2Gear.REMOVED || []).indexOf(x.id) >= 0) return; out.push({ id: x.id, label: ((V2Gear.HEAD_REDO || {})[x.id] || {}).label || x.label, slot: V2_SLOT_FIX[x.id] || CORE_SLOT[x.slot], coreSlot: x.slot, tier: x.tier, w: 10, src: 'bonus', origin: x.species || null, exclusive: V2Gear.isSig(x.species, x.id), overlay: true }); if (V2Gear.isSig(x.species, x.id)) { out[out.length - 1].tier = 3; out[out.length - 1].w = 5; out[out.length - 1].sig = true; } });
    (V2Gear.ITEMS || []).forEach(function (x) { out.push({ id: x.id, label: x.label, slot: x.slot, tier: x.tier, w: x.exclusive ? 5 : 10, src: 'v2', origin: x.origin, exclusive: !!x.exclusive, sig: !!x.exclusive, overlay: true, kind: x.kind, alias: x.alias }); });
    // polish pass 2026-10-14: the two cards are rare Legendaries (tier 3 = the top gear-power band, weight 1 = rarest roll in v2); shared, not species-locked
    out.forEach(function (x) { if (CARD_FIX[x.id]) { x.tier = 3; x.w = 1; x.card = true; } });
    return out;
  })();
  var RAW = ALL; ALL = RAW.filter(function (x) { return !x.alias; }); // alias entries (removed duplicate mug) keep their roll-pool position but resolve to the kept item
  var BY_ID = {}; ALL.forEach(function (x) { BY_ID[x.id] = x; });
  // retired + alias ids resolve to a current item (append-only pool: an old id never vanishes and is never re-rolled)
  var RETIRED = {}; (V2Gear.RETIRED || []).forEach(function (r) { RETIRED[r[0]] = r[1]; }); RAW.forEach(function (x) { if (x.alias && !RETIRED[x.id]) RETIRED[x.id] = x.alias; });
  function resolveItem(id) { var n = 0; while (id != null && !BY_ID[id] && RETIRED[id] && n++ < 8) id = RETIRED[id]; return id; }
  function itemOf(id) { return BY_ID[resolveItem(id)] || null; }
  // legendary = species-exclusive (exactly one per species). Old signature items (Rare Pepe card, Feels Good mug...) are open to all now.
  function isLegendary(it) { it = typeof it === 'string' ? BY_ID[it] : it; return !!(it && it.exclusive); }
  function eligible(it, species) { it = typeof it === 'string' ? itemOf(it) : it; if (!it) return false;
    if (isHybrid(species)) { if (!it.exclusive) return true; var par = species.split(':').slice(1); return it.slot !== 'head' && par.indexOf(it.origin) >= 0; } /* hybrids (Jake's locked spec): shared + both parents' signatures EXCEPT their legendary head pieces */
    return !it.exclusive || it.origin === species; }
  function legendaryOf(species) { return ALL.filter(function (x) { return x.exclusive && x.origin === species; }).sort(function (a, b) { return (b.slot === 'head') - (a.slot === 'head'); }); } // head signature first, then the 6 other ★ pieces
  function pool(slot, species, tierIdx) {
    var all = RAW.filter(function (x) { return x.slot === slot && eligible(x.alias ? BY_ID[x.alias] : x, species); });
    var p = all.filter(function (x) { return x.tier <= tierIdx; });
    if (!p.length && all.length) { var m = Math.min.apply(null, all.map(function (x) { return x.tier; })); p = all.filter(function (x) { return x.tier === m; }); }
    return p.map(function (x) { return { it: x, w: x.w * (x.tier === tierIdx ? 4 : 1) }; });
  }
  /* Duplicate damping (2026-10-15, Jake approved): from ACTIVATE_DEDUP_BLOCK each copy of an item the roller already owns makes that item 10% less
   * likely (weight x 0.9 per copy, integer math so every replay is exact). Rarity odds are unchanged: the tier is still the tier of the
   * old draw (hex 8..16); only the item inside that tier is redrawn (hex 24..32) with damped weights, and only if the roller owns a copy of
   * something in that tier (else the old pick stands). copies(id) = items held by the address (inventory + worn, all pets, incl. gear of
   * released/dead pets and pets hidden by the local discard, since those stay owned on chain); community roll = every piece Nakamoto has rolled. */
  /* breed carry (2026-10-15, Jake approved; PLACEHOLDER block = tip 971,610 + 40, confirm before pushing): from this block, when a TWO-OWNER breed resolves,
   * the accepting owner's pet (parent B, the one that did not get the egg) carries parent A's best stat: { from: A.id, species: A.species, stat: k, value: A.stats[k] }.
   * In that carrier's later breeds (at/after this block) the child's stat k is at least the carried value. No RNG draw is added or moved, species/tier/hybrid
   * logic is untouched, so every earlier breed (incl. 42 x 2451 at 971,605) and every breed without a carrier replays exactly as before. */
  var ACTIVATE_BREEDCARRY_BLOCK = 971650;
  var ACTIVATE_DEDUP_BLOCK = 971588;  // Bitcoin tip 971,585 at 2026-10-15 09:20 CT + 3 (Jake approved)
  var DEDUP_NUM = 9, DEDUP_DEN = 10, DEDUP_SCALE = 1000000;
  function dampW(w0, c) { var x = w0 * DEDUP_SCALE; for (var i = 0; i < c && x > 1; i++) x = Math.floor(x * DEDUP_NUM / DEDUP_DEN); return Math.max(1, x); }
  function ownedCounts(w, owner) { var m = {}; Object.keys(w.items).forEach(function (k) { var g = w.items[k]; if (g.owner === owner) m[g.item] = (m[g.item] || 0) + 1; }); return m; }
  function communityCounts(w) { var m = {}; (w.community.gearLog || []).forEach(function (g) { m[g.item] = (m[g.item] || 0) + 1; }); return m; }
  function pickItem(hex, slot, species, tierIdx, owned) { var p = pool(slot, species, tierIdx); if (!p.length) return null;
    var tot = p.reduce(function (a, b) { return a + b.w; }, 0), r = parseInt(hex.slice(8, 16), 16) % tot;
    var hit = p[p.length - 1].it; for (var i = 0; i < p.length; i++) { if (r < p[i].w) { hit = p[i].it; break; } r -= p[i].w; }
    if (owned) { var rid = function (x) { return x.alias || x.id; }, tier = p.filter(function (e) { return e.it.tier === hit.tier; });
      if (tier.some(function (e) { return owned[rid(e.it)] > 0; })) {
        var dw = tier.map(function (e) { return dampW(e.w, owned[rid(e.it)] || 0); }), dt = dw.reduce(function (a, b) { return a + b; }, 0), r2 = parseInt(hex.slice(24, 32), 16) % dt;
        hit = tier[tier.length - 1].it; for (var j = 0; j < tier.length; j++) { if (r2 < dw[j]) { hit = tier[j].it; break; } r2 -= dw[j]; } } }
    return hit.alias ? BY_ID[hit.alias] : hit; }
  function dedupFor(w, b, owner) { return b >= ACTIVATE_DEDUP_BLOCK ? ownedCounts(w, owner) : null; }

  // ---------------------------------------------------------------- capacity by AGE + CARE (not rarity)
  /** capacity(ageDays, fedDays): 1 base + 1 each at age 2/5/10 days + 1 at >=50% of days fed + 1 at >=80% (min 3 fed days). Max 6. */
  function capacity(ageDays, fedDays) {
    ageDays = Math.max(0, ageDays | 0); fedDays = Math.max(0, fedDays | 0);
    var ratio = fedDays / Math.max(1, ageDays + 1), n = 1 + (ageDays >= 2) + (ageDays >= 5) + (ageDays >= 10) + (ratio >= 0.5 && fedDays >= 1) + (ratio >= 0.8 && fedDays >= 3);
    return Math.min(V2_SLOTS.length, n);
  }

  // ---------------------------------------------------------------- tags
  function idOk(s) { return /^[0-9]{1,9}$/.test(s || ''); }
  /** battleBlock(w, tag, tip) -> null | message. Same once-per-144-block-day rule the battle button and replay use; checked before any
   * fight / accept burn is composed (single, bulk, wallet), so a pet that already battled today can't have a battle burn sent. */
  function battleBlock(w, tag, tip) { var t = parseTag(tag); if (!t || (t.action !== 'fight' && t.action !== 'accept')) return null; var d = day(tip), ids;
    if (t.action === 'fight') ids = [t.a, t.b]; else { var F = w.fights && w.fights[t.fightId - 1]; if (!F) return null; ids = [F.b].concat(day(F.block) !== d ? [F.a] : []); }
    for (var i = 0; i < ids.length; i++) { var p = w.byId[ids[i]]; if (p && p.fightDays && p.fightDays[d]) return 'This pet already battled today: #' + p.id + (p.name ? ' ' + p.name : '') + ' (one battle per pet per 144-block day)'; }
    return null; }
  function parseTag(tag) {
    var t = String(tag || '').trim().toUpperCase(), p = t.split(':'); if (p[0] !== 'PET') return { action: 'plain' };
    var a = p[1], n = function (i) { return parseInt(p[i], 10); };
    if (a === 'HATCH' && p.length === 2) return { action: 'hatch' };
    if ((a === 'HATCH12' || a === 'HATCH144') && p.length === 2) return { action: 'pack', n: a === 'HATCH12' ? 12 : 144, cost: a === 'HATCH12' ? 690 : 6900 };
    if (a === 'FEED' && p.length === 2) return { action: 'cfeed' };
    if (a === 'FEED' && p.length === 3 && idOk(p[2])) return { action: 'feed', petId: n(2) };
    if (a === 'ROLL' && p.length === 3 && idOk(p[2])) return { action: 'roll', petId: n(2) };
    if (a === 'FR' && p.length === 3 && idOk(p[2])) return { action: 'froll', petId: n(2) };
    if (a === 'FIGHT' && p.length === 4 && idOk(p[2]) && idOk(p[3])) return { action: 'fight', a: n(2), b: n(3) };
    if (a === 'ACCEPT' && p.length === 3 && idOk(p[2])) return { action: 'accept', fightId: n(2) };
    if (a === 'RUMBLE' && p.length === 3 && idOk(p[2])) return { action: 'rumble', petId: n(2) };
    if (a === 'BREED' && p.length === 4 && idOk(p[2]) && idOk(p[3])) return { action: 'breed', a: n(2), b: n(3) };
    if (a === 'FM' && p.length === 4 && idOk(p[2]) && /^[0-9A-V]{1,27}$/.test(p[3])) { var fids = [];
      for (var q = 0; q < p[3].length; q++) { var fv = parseInt(p[3][q], 32); for (var fb = 0; fb < 5; fb++) if (fv & (1 << fb)) fids.push(n(2) + 5 * q + fb); } return { action: 'feedm', ids: fids }; }
    if (a === 'C' && p[2] === 'ROLL' && (p.length === 3 || (p.length === 4 && V2_SLOTS.indexOf(p[3].toLowerCase()) >= 0))) return { action: 'croll', slot: p.length === 4 ? p[3].toLowerCase() : null };
    if (a === 'REL') {
      if (p.length === 3 && idOk(p[2])) return { action: 'release', ids: [n(2)] };
      if (p.length === 4 && idOk(p[2]) && /^[0-9A-V]{1,24}$/.test(p[3])) { var ids = [];
        for (var j = 0; j < p[3].length; j++) { var v = parseInt(p[3][j], 32); for (var b = 0; b < 5; b++) if (v & (1 << b)) ids.push(n(2) + 5 * j + b); } return { action: 'release', ids: ids }; }
    }
    return { action: 'invalid' };
  }
  /** releaseBatches(ids) -> burn plans, each <= 120 pets AND a <= 34-byte pet:rel tag (START:base32 mask). */
  function releaseBatches(ids) {
    ids = ids.map(Number).filter(function (x, i, a) { return x >= 1 && a.indexOf(x) === i; }).sort(function (a, b) { return a - b; });
    var out = [], i = 0;
    while (i < ids.length) {
      var start = ids[i], cap = MAX_TAG_BYTES - ('pet:rel:' + start + ':').length, maxId = start + 5 * cap - 1, inB = [];
      while (i < ids.length && ids[i] <= maxId && inB.length < MAX_RELEASE_PER_BURN) inB.push(ids[i++]);
      var tag;
      if (inB.length === 1) tag = 'pet:rel:' + start;
      else { var d = []; inB.forEach(function (x) { var o = x - start, j = Math.floor(o / 5); while (d.length <= j) d.push(0); d[j] |= 1 << (o % 5); });
        tag = 'pet:rel:' + start + ':' + d.map(function (v) { return v.toString(32).toUpperCase(); }).join(''); }
      out.push({ tag: tag, ids: inB, amount: COSTS.release, label: 'Release ' + inB.length + ' pet' + (inB.length > 1 ? 's' : '') });
    }
    out.forEach(function (p, k) { if (out.length > 1) p.label += ' (burn ' + (k + 1) + ' of ' + out.length + ')'; });
    return out;
  }
  function burnSummary(plans) { var total = plans.reduce(function (a, p) { return a + Number(p.amount || 0); }, 0);
    return { burns: plans.length, total: Math.round(total * 1e8) / 1e8, feeSats: plans.length * FEE_SATS, feeBtc: plans.length * FEE_SATS / 1e8 }; }
  function validFeedAmount(amount, block) { var min = block != null && block < V2_FROM_BLOCK ? COSTS.feedMinV1 : COSTS.feedMin; return Number(amount) >= min; }

  // ---------------------------------------------------------------- fights (pure, replayable)
  function gearPower(gear) { return (gear || []).reduce(function (a, g) { var it = BY_ID[g.item]; return a + 1 + (it ? it.tier : 0) * 2; }, 0); }
  function snapshot(p, w) { return { id: p.id, name: p.name, species: p.species, tier: p.tier, stage: p.stage, stats: Object.assign({}, p.stats),
    gear: w ? wornOf(w, p.id).map(function (g) { return { gid: g.gid, item: g.item, slot: g.slot }; }) : [] }; }
  function weaponOf(s) { var h = (s.gear || []).filter(function (g) { return g.slot === 'hand'; })[0]; return h && BY_ID[h.item] ? BY_ID[h.item].label : 'bare paws'; }
  /** simulateFight(seedStr, snapA, snapB) -> { winner:'a'|'b', turns:[...], hp } — pure; same inputs => same fight. */
  function simulateFight(seedStr, A, B) {
    var R = stream('XCPETS:v2:fight:' + seedStr + ':' + JSON.stringify([A.stats, A.gear, B.stats, B.gear]));
    function hp0(s) { return 40 + s.stats.vigor * 2 + s.stats.grit + s.stage * 6; }
    var hp = { a: hp0(A), b: hp0(B) }, max = { a: hp.a, b: hp.b }, side = { a: A, b: B }, turns = [];
    var first = (A.stats.zoom + R() % 10) >= (B.stats.zoom + R() % 10) ? 'a' : 'b';
    for (var t = 0; t < FIGHT_TURNS && hp.a > 0 && hp.b > 0; t++) {
      var at = t % 2 === 0 ? first : (first === 'a' ? 'b' : 'a'), df = at === 'a' ? 'b' : 'a', s = side[at];
      var crit = R() % 100 < 5 + Math.floor(s.stats.luck / 4), dodge = R() % 100 < Math.floor(side[df].stats.zoom / 5);
      var dmg = dodge ? 0 : Math.max(1, 4 + Math.floor(s.stats.spark / 3) + gearPower(s.gear) + (R() % 8) - Math.floor(side[df].stats.grit / 6)) * (crit ? 2 : 1);
      hp[df] = Math.max(0, hp[df] - dmg);
      turns.push({ n: t + 1, by: at, weapon: weaponOf(s), dmg: dmg, crit: crit, dodge: dodge, hpA: hp.a, hpB: hp.b });
    }
    var winner = hp.a / max.a === hp.b / max.b ? (R() % 2 ? 'a' : 'b') : (hp.a / max.a > hp.b / max.b ? 'a' : 'b');
    return { winner: winner, turns: turns, maxA: max.a, maxB: max.b };
  }

  // ---------------------------------------------------------------- replay
  function replay(rows, blockHashes, ops, opts) {
    rows = rows || []; blockHashes = blockHashes || {}; ops = ops || []; opts = opts || {};
    var cut = (opts.cutoff != null ? opts.cutoff : CUTOFF_BLOCK) + 1 /* cut = first v2 block; opts.cutoff is inclusive like CUTOFF_BLOCK */, eng = opts.live !== undefined ? opts.live : LIVE_ENGINE;
    rows = readBurns(rows);
    var preRows = eng ? rows.filter(function (r) { return r.block_index < cut; }) : [];
    if (preRows.length) rows = rows.filter(function (r) { return r.block_index >= cut; });
    var ev = rows.map(function (r, i) { return { r: r, i: i, b: r.block_index, o: 0 }; }).concat(ops.map(function (o, i) { return { op: o, i: i, b: o.block_index, o: 1 }; }));
    ev.sort(function (x, y) { return x.b - y.b || x.o - y.o || x.i - y.i; });
    var tip = opts.tip != null ? opts.tip : ev.reduce(function (a, e) { return Math.max(a, e.b); }, 0);
    var w = { pets: [], byId: {}, items: {}, nextPet: 1, log: [], community: { burned: 0, feeds: 0, feeders: {}, gear: {}, gearLog: [] }, fights: [], rumbles: {}, breedReqs: [], tip: tip, nextItem: 1, tokens: {} };
    var seen = {};
    if (preRows.length) importLive(w, eng.replay(preRows.map(function (r) { return r.raw; }), blockHashes, { tip: cut - 1 }), cut);
    function L(e, kind, msg, extra) { var o = Object.assign({ block: e.block_index, tx: e.tx_hash, kind: kind, msg: msg }, extra || {}); w.log.push(o); return o; }
    var resolvedWeeks = {};
    function maybeRumbles(b) { Object.keys(w.rumbles).forEach(function (wk) { var R = w.rumbles[wk]; if (!R.done && b >= R.seedBlock && blockHashes[R.seedBlock]) resolveRumble(w, R, blockHashes[R.seedBlock]); }); }
    w.freeRolls = {}; w.founderSeen = {}; preRows.forEach(function (r) { w.founderSeen[r.raw ? r.raw.tx_hash : r.tx_hash] = 1; });
    ev.forEach(function (e) {
      grantFounders(w, e.b); maybeRumbles(e.b);
      if (e.op) { applyOp(w, e.op); return; }
      var r = e.r; if (seen[r.tx_hash]) return; seen[r.tx_hash] = 1;
      var amt = Number(r.amount), bh = blockHashes[r.block_index], t = parseTag(r.tag), v2 = r.block_index >= V2_FROM_BLOCK;
      w.community.burned += amt; // EVERY valid burn feeds the community pet (incl. failed actions, fights, rumbles, breeds)
      if (w.community.returnBlock == null && returnProgress(w.community.burned).done) { w.community.returnBlock = r.block_index; w.community.returnTx = r.tx_hash; }
      if (!v2 && (t.action === 'fight' || t.action === 'accept' || t.action === 'rumble' || t.action === 'breed')) { L(r, 'plain', 'before v2 cutoff block ' + V2_FROM_BLOCK + ': plain burn (community food)'); return; }
      handle(w, r, t, amt, bh, L);
    });
    grantFounders(w, tip); maybeRumbles(tip);
    w.pets.forEach(function (p) { finish(w, p, tip); });
    var rp = returnProgress(w.community.burned), cm = w.community;
    if (rp.done && cm.returnBlock == null) cm.returnBlock = w.cutoff ? w.cutoff.lastLiveBlock : tip; // already past it in the imported live total
    cm.returned = rp.done; cm.returnCount = rp.count; cm.goal = COMMUNITY_GOAL; cm.goalPct = rp.pct;
    cm.wizardFed = rp.done ? cm.burned - COMMUNITY_GOAL : 0; cm.current = rp.done ? 'wizard' : 'nakamoto';
    cm.wizardStage = rp.done ? wizardStage(cm.wizardFed) : 0; cm.wizardStageName = STAGE_NAMES[cm.wizardStage];
    cm.petName = rp.done ? COMMUNITY_PET : 'Nakamoto'; cm.petStage = rp.done ? cm.wizardStage : 5; cm.petStageName = STAGE_NAMES[cm.petStage];
    w.community.leaderboard = Object.keys(w.community.feeders).map(function (a) { return { address: a, amount: w.community.feeders[a] }; }).sort(function (a, b) { return b.amount - a.amount || (a.address < b.address ? -1 : 1); });
    w.fights.forEach(function (f) { if (f.status === 'open' && tip - f.block > FIGHT_WINDOW) f.status = 'expired'; });
    w.itemList = Object.keys(w.items).map(function (k) { return w.items[k]; });
    return w;
  }
  function liveAt(w, p, b) { // refresh age/death/neglect at block b
    var last = p.lastFed != null ? p.lastFed : p.hatchBlock, th = thresholdsFor(p.species); if (p.clockFrom != null) last = Math.max(last, p.clockFrom); // live pets: live death-clock anchor
    p.mythicCare = p.care >= th[5] || !!p.ascended;
    p.deathBlock = p.mythicCare ? null : (day(last) + NEGLECT_DAYS + 1) * BLOCKS_PER_DAY;
    p.dead = !p.released && p.deathBlock != null && b >= p.deathBlock;
    p.neglected = !p.mythicCare && day(b) - day(last) >= NEGLECTED_AFTER_DAYS;
    p.stage = p.ascended ? 5 : stageFor(p.care, th); p.stageName = STAGE_NAMES[p.stage];
    p.ageDays = day(b) - day(p.hatchBlock); p.fedDays = Object.keys(p.feedDays).length;
    p.capacity = capacity(p.ageDays, p.fedDays); p.openSlots = V2_SLOTS.slice(0, p.capacity);
    if (p.liveSlots) { p.liveSlots.forEach(function (sl) { if (p.openSlots.indexOf(sl) < 0) p.openSlots.push(sl); }); p.openSlots.sort(function (a, b) { return V2_SLOTS.indexOf(a) - V2_SLOTS.indexOf(b); }); p.capacity = p.openSlots.length; } // slots = max(live, v2)
  }
  function finish(w, p, tip) {
    liveAt(w, p, tip);
    if (p.dead) Object.keys(w.items).forEach(function (k) { if (w.items[k].on === p.id) w.items[k].on = null; });
    p.fedToday = !!p.feedDays[day(tip)]; p.nextMeal = mealFor(p.care, p.species); p.hungry = !p.dead && !p.released && !p.fedToday && p.nextMeal > 0;
    p.blackEye = p.blackEyeUntil != null && tip < p.blackEyeUntil; p.crowned = p.crownUntil != null && tip < p.crownUntil;
  }
  // ---------------------------------------------------------------- live reader + cutoff import (2026-10-14)
  var LIVE_ENGINE = null; function setLiveEngine(e) { LIVE_ENGINE = e || null; }
  /** readBurns(rows): the live burn reader's rules. Only status 'valid' rows (when a status is given); amount = quantity / UNIT (raw API rows) or
   *  the given amount (mock rows); duplicates dropped; order = block_index, then tx_index (chain order; mock rows without tx_index keep their order). r.raw = the API row for the live engine. */
  function readBurns(rows) { var seen = {}, out = [];
    (rows || []).forEach(function (r, i) { if (!r || seen[r.tx_hash]) return; seen[r.tx_hash] = 1; if (r.status != null && String(r.status).toLowerCase() !== 'valid') return;
      var amt = r.quantity != null ? Number(r.quantity) / LIVE_UNIT : Number(r.amount), tag = r.tag;
      if (r.quantity != null && typeof tag === 'string' && /^([0-9a-f]{2})+$/i.test(tag)) { try { tag = decodeURIComponent(tag.replace(/(..)/g, '%$1')); } catch (e) { } }
      var raw = r.quantity != null ? r : Object.assign({ quantity: Math.round(Number(r.amount) * LIVE_UNIT), status: 'valid', tx_index: i }, r);
      out.push(Object.assign({}, r, { amount: amt, tag: tag, _i: i, raw: raw })); });
    return out.sort(function (a, b) { return a.block_index - b.block_index || (a.tx_index != null && b.tx_index != null ? a.tx_index - b.tx_index : a._i - b._i); }); }
  /** importLive(w, st, cut): the live engine's state at the cutoff becomes the v2 world: same ids, owners, art/species, names, care, stage, feed days,
   *  death clock, ascension, worn + inventory gear (ids mapped through resolveItem; live gid tx_index kept as 'L<tx_index>'), slots = max(live, v2). */
  function importLive(w, st, cut) {
    var all = (st.pets || []).concat(st.releasedPets || []), maxId = 0;
    all.sort(function (a, b) { return a.id - b.id; }).forEach(function (q) { var art = q.art || {}; maxId = Math.max(maxId, q.id);
      var p = { id: q.id, owner: q.owner, art: art, species: art.species, tier: art.tierIndex, stats: Object.assign({}, art.baseStats), name: q.name || art.defaultName, care: q.care, hatchBlock: q.hatchBlock, hatchTx: q.hatchTx,
        lastFed: q.lastFedBlock != null ? q.lastFedBlock : null, feedDays: {}, fightDays: {}, breeds: 0, lastBreed: null, parents: null, children: [], wins: 0, losses: 0, trophies: [],
        fromLive: true, clockFrom: LIVE_DEATH_FROM_BLOCK, ascended: !!q.ascended, released: !!q.released, liveStage: q.stage, liveTokens: q.tokens || 0, liveKeys: q.keys || 0,
        liveSlots: (q.openSlots || []).map(function (sl) { return CORE_SLOT[sl]; }).filter(function (sl, i, a) { return sl && a.indexOf(sl) === i; }) };
      Object.keys(q.feedDays || {}).forEach(function (d) { p.feedDays[d] = 1; });
      w.pets.push(p); w.byId[p.id] = p; liveAt(w, p, cut - 1); });
    w.nextPet = maxId + 1;
    (st.items || []).forEach(function (g) { var it = itemOf(g.item); if (!it) return; var gid = 'L' + g.gid, on = g.on != null && w.byId[g.on] && !w.byId[g.on].dead ? g.on : null;
      w.items[gid] = { gid: gid, item: it.id, label: it.label, slot: it.slot, tier: it.tier, legendary: isLegendary(it), owner: g.owner, on: on, src: 'live', liveGid: g.gid, liveSlot: g.slot, liveItem: g.item, rolledOn: g.rolledOn }; });
    var c = st.community || {}; w.community.burned = c.burned || 0; Object.keys(c.feeders || {}).forEach(function (a) { w.community.feeders[a] = c.feeders[a]; w.community.feeds += c.feeders[a]; });
    w.cutoff = { block: cut /* first v2 block */, lastLiveBlock: cut - 1, pets: all.length, items: (st.items || []).length, burns: c.burns || null };
  }
  /** migrateLoadout(w, owner, lo): a live per-device loadout { petId: { slot: { gid } } } -> v2 equip ops (old slot + item ids mapped; live gid -> 'L' + gid). */
  function migrateLoadout(w, owner, lo, block) { var ops = [];
    Object.keys(lo || {}).forEach(function (pid) { Object.keys(lo[pid] || {}).forEach(function (sl) { var o = lo[pid][sl] || {}, v2sl = CORE_SLOT[sl] || sl;
      ops.push({ kind: 'equip', owner: owner, petId: Number(pid), slot: v2sl, gid: o.gid == null ? null : 'L' + o.gid, block_index: block != null ? block : (w.cutoff ? w.cutoff.block : V2_FROM_BLOCK) }); }); });
    return ops; }
  function wornOf(w, pid) { return Object.keys(w.items).map(function (k) { return w.items[k]; }).filter(function (g) { return g.on === pid; }); }
  function wornIn(w, pid, slot) { return wornOf(w, pid).filter(function (g) { return g.slot === slot; })[0] || null; }
  function newItem(w, it, owner, src) { var gid = 'g' + (w.nextItem++); w.items[gid] = { gid: gid, item: it.id, label: it.label, slot: it.slot, tier: it.tier, legendary: isLegendary(it), owner: owner, on: null, src: src }; return w.items[gid]; }
  function wear(w, p, g) { if (p.openSlots.indexOf(g.slot) < 0) return false; if (!eligible(g.item, p.species)) return false; var cur = wornIn(w, p.id, g.slot); if (cur) cur.on = null; g.on = p.id; return true; }
  function giveRandomPiece(w, loser, winnerPet, seedHex, why) {
    var take = wornOf(w, loser.id).filter(function (g) { return !g.legendary; }); // legendary species pieces are never takeable
    if (!take.length) return null;
    var g = take[parseInt(seedHex.slice(0, 8), 16) % take.length]; g.on = null; g.owner = winnerPet.owner; g.from = loser.id; g.wonBy = winnerPet.id; g.why = why;
    liveAt(w, winnerPet, w._b || 0); if (!wornIn(w, winnerPet.id, g.slot)) wear(w, winnerPet, g);
    return g;
  }
  function fightable(p, b) { if (!p) return 'no such pet'; if (p.released) return 'released'; if (p.dead) return 'dead'; if (p.stage < 2) return 'Egg/Hatchling pets cannot fight'; if (p.neglected) return 'neglected pets cannot fight'; return null; }
  function breedable(p, b) { if (!p) return 'no such pet'; if (p.released) return 'released'; if (p.dead) return 'dead'; if (p.species === 'nakamoto') return 'Nakamoto cannot breed';
    if (p.community) return 'community pet cannot breed'; if (p.stage < 3) return 'needs Adult+'; if (p.neglected) return 'neglected'; if (p.breeds >= BREED_MAX) return 'max ' + BREED_MAX + ' breedings';
    if (p.lastBreed != null && b - p.lastBreed < BREED_COOLDOWN) return 'breeding cooldown (' + (BREED_COOLDOWN - (b - p.lastBreed)) + ' blocks left)'; return null; }

  function handle(w, r, t, amt, bh, L) {
    var b = r.block_index, src = r.source; w._b = b;
    function pet(id) { var p = w.byId[id]; if (p) liveAt(w, p, b); return p; }
    /* roll token (from ACTIVATE_TOKENS_BLOCK): kind 'stageUp' (incl. hatching) or 'meal'; a token becomes one gear item at once, logged on the pet */
    function token(p, kind) { if (b < ACTIVATE_TOKENS_BLOCK || !bh || !p) return;
      var d = sha(bh + r.tx_hash + ':' + p.id + 'XCPETS:v2:token-drop'); if (parseInt(d.slice(0, 8), 16) % 10000 >= TOKEN_DROP_10K[kind]) return;
      liveAt(w, p, b); p.tokens = (p.tokens || 0) + 1; w.tokens[p.owner] = (w.tokens[p.owner] || 0) + 1;
      var h = sha(bh + r.tx_hash + ':' + p.id + 'XCPETS:v2:token-roll'), sl = p.openSlots[parseInt(h.slice(16, 24), 16) % p.openSlots.length], it = pickItem(h, sl, p.species, p.tier, dedupFor(w, b, p.owner));
      if (!it) return L(r, 'token', '#' + p.id + ' found a roll token (' + (kind === 'meal' ? 'meal' : 'stage-up') + '), no gear for ' + slotLabel(sl), { petId: p.id, token: true });
      var ni = newItem(w, it, p.owner, 'token'); ni.rolledOn = p.id; wear(w, p, ni);
      return L(r, 'token', '#' + p.id + ' found a roll token (' + (kind === 'meal' ? 'meal' : 'stage-up') + '): free roll ' + it.label + ' (' + slotLabel(sl) + ')', { petId: p.id, gid: ni.gid, token: true, wk: 'tok' + p.id }); }
    switch (t.action) {
      case 'hatch': {
        if (amt < COSTS.hatch) return L(r, 'rejected', 'below hatch cost 69');
        if (!bh) return L(r, 'rejected', 'block hash pending');
        var art = PetCore.generate({ blockHash: bh, petId: r.tx_hash, blockHeight: b }), sp = pickSpecies(sha(bh + r.tx_hash + 'XCPETS:v2:species'));
        art.species = sp; var p = mk(w, src, noBornShades(art), b, COSTS.hatch, r.tx_hash);
        var hl = L(r, 'hatch', 'hatched #' + p.id + ' ' + sp, { petId: p.id }); token(p, 'stageUp'); return hl;
      }
      case 'pack': {
        if (amt < t.cost) return L(r, 'rejected', 'below pack price ' + t.cost);
        if (!bh) return L(r, 'rejected', 'block hash pending');
        var first = w.nextPet; for (var i = 0; i < t.n; i++) { var a2 = PetCore.generate({ blockHash: bh, petId: r.tx_hash + ':' + i, blockHeight: b }); a2.species = pickSpecies(sha(bh + r.tx_hash + ':' + i + 'XCPETS:v2:species')); mk(w, src, noBornShades(a2), b, COSTS.hatch, r.tx_hash + ':' + i); }
        var pl = L(r, 'hatch', 'pack hatched #' + first + '-#' + (w.nextPet - 1)); for (var pi = first; pi < w.nextPet; pi++) token(w.byId[pi], 'stageUp'); return pl;
      }
      case 'cfeed': {
        if (!validFeedAmount(amt, b)) return L(r, 'rejected', 'community feed min ' + (b < V2_FROM_BLOCK ? COSTS.feedMinV1 : COSTS.feedMin) + ' (burn still feeds the community pet)');
        w.community.feeds += amt; w.community.feeders[src] = (w.community.feeders[src] || 0) + amt;
        return L(r, 'cfeed', 'fed ' + COMMUNITY_PET + ' ' + amt);
      }
      case 'feed': {
        var q = pet(t.petId), why = !q ? 'no such pet' : q.released ? 'released' : q.owner !== src ? 'owner only' : q.dead ? 'dead (Pet Cemetery)' : q.feedDays[day(b)] ? 'already fed this day' : mealFor(q.care, q.species) === 0 ? 'fully fed' : amt < mealFor(q.care, q.species) ? 'below meal ' + mealFor(q.care, q.species) : null;
        if (why) return L(r, 'rejected', why);
        var qs = q.stage; q.care += mealFor(q.care, q.species); q.feedDays[day(b)] = 1; q.lastFed = b; liveAt(w, q, b);
        var fl = L(r, 'feed', 'fed #' + q.id + ' (care ' + q.care + ')', { petId: q.id }); token(q, q.stage > qs ? 'stageUp' : 'meal'); return fl;
      }
      case 'feedm': {  /* pets in ascending id order, each takes its own meal from the burn; a pet that can't be fed (or that the rest of the burn can't pay for) is skipped */
        if (b < ACTIVATE_FEEDM_BLOCK) return L(r, 'rejected', 'unknown pet: tag (community food)');
        var left = amt, fed = [], skip = [], up = {};
        t.ids.forEach(function (id) { var z = pet(id), m = z ? mealFor(z.care, z.species) : 0,
            no = !z ? 'no such pet' : z.released ? 'released' : z.owner !== src ? 'owner only' : z.dead ? 'dead (Pet Cemetery)' : z.feedDays[day(b)] ? 'already fed this day' : m === 0 ? 'fully fed' : left + 1e-9 < m ? 'burn too small for meal ' + m : null;
          if (no) { skip.push('#' + id + ' ' + no); return; }
          var zs = z.stage; left -= m; z.care += m; z.feedDays[day(b)] = 1; z.lastFed = b; liveAt(w, z, b); up[z.id] = z.stage > zs; fed.push(z.id); });
        if (!fed.length) return L(r, 'rejected', 'multi-feed fed nobody: ' + skip.join(', '));
        var ml = L(r, 'feed', 'fed ' + fed.length + ' pets #' + fed.join(', #') + (skip.length ? ' · skipped ' + skip.join(', ') : ''), { petIds: fed, petId: fed[0] });
        fed.forEach(function (id) { token(w.byId[id], up[id] ? 'stageUp' : 'meal'); }); return ml;
      }
      case 'roll': {
        var g = pet(t.petId), wy = !g ? 'no such pet' : g.released ? 'released' : g.owner !== src ? 'owner only' : g.dead ? 'dead' : amt < COSTS.roll ? 'below roll cost 345' : !bh ? 'block hash pending' : null;
        if (wy) return L(r, 'rejected', wy);
        var h = sha(bh + r.tx_hash + 'XCPETS:v2:gear-roll'), slot = g.openSlots[parseInt(h.slice(16, 24), 16) % g.openSlots.length], it = pickItem(h, slot, g.species, g.tier, dedupFor(w, b, g.owner));
        var ni = newItem(w, it, g.owner, 'roll'); ni.rolledOn = g.id; wear(w, g, ni);
        return L(r, 'roll', '#' + g.id + ' rolled ' + it.label + ' (' + slotLabel(slot) + ')', { petId: g.id, gid: ni.gid });
      }
      case 'froll': {  /* free gear roll (founder credits): any amount (1 sat of XCPETS is enough); same roll as pet:roll; one credit per successful roll */
        if (b < ACTIVATE_FOUNDER_BLOCK) return L(r, 'rejected', 'unknown pet: tag (community food)');
        var fg = pet(t.petId), fw = !(w.freeRolls[src] > 0) ? 'no free rolls left' : !fg ? 'no such pet' : fg.released ? 'released' : fg.owner !== src ? 'owner only' : fg.dead ? 'dead' : !bh ? 'block hash pending' : null;
        if (fw) return L(r, 'rejected', fw);
        var fh = sha(bh + r.tx_hash + 'XCPETS:v2:gear-roll'), fsl = fg.openSlots[parseInt(fh.slice(16, 24), 16) % fg.openSlots.length], fit = pickItem(fh, fsl, fg.species, fg.tier, dedupFor(w, b, fg.owner));
        w.freeRolls[src]--; var fni = newItem(w, fit, fg.owner, 'froll'); fni.rolledOn = fg.id; wear(w, fg, fni);
        return L(r, 'roll', '#' + fg.id + ' free roll: ' + fit.label + ' (' + slotLabel(fsl) + ') · ' + w.freeRolls[src] + ' free rolls left', { petId: fg.id, gid: fni.gid, free: true });
      }
      case 'release': {
        var done = []; t.ids.forEach(function (id) { var x = w.byId[id]; if (x && !x.released && x.owner === src) { x.released = b; done.push(id); wornOf(w, id).forEach(function (gg) { gg.on = null; }); } });
        return L(r, done.length ? 'release' : 'rejected', done.length ? 'released #' + done.join(', #') : 'nothing released', { ids: done });
      }
      case 'fight': {
        var A = pet(t.a), B = pet(t.b), e = amt < COSTS.fight ? 'below fight cost 690' : !A || A.owner !== src ? 'challenger must be your pet' : t.a === t.b ? 'cannot fight itself' : fightable(A, b) || (fightable(B, b) ? 'opponent: ' + fightable(B, b) : null);
        if (!e && (A.fightDays[day(b)] || B.fightDays[day(b)])) e = 'one challenge fight per pet per 144-block day';
        if (!e && w.fights.some(function (f) { return f.status === 'open' && (f.a === t.a || f.b === t.a) && b - f.block <= FIGHT_WINDOW; })) e = 'pet already has an open challenge';
        if (e) return L(r, 'rejected', e);
        A.fightDays[day(b)] = 1;
        var f = { id: w.fights.length + 1, a: t.a, b: t.b, block: b, tx: r.tx_hash, status: 'open', expires: b + FIGHT_WINDOW, challenger: src };
        w.fights.push(f); return L(r, 'fight', '#' + t.a + ' challenged #' + t.b + ' (fight ' + f.id + ', accept by block ' + f.expires + ')', { fightId: f.id });
      }
      case 'accept': {
        var F = w.fights[t.fightId - 1], err = !F ? 'no such fight' : amt < COSTS.accept ? 'below accept cost 690' : F.status !== 'open' ? 'fight is ' + F.status : b - F.block > FIGHT_WINDOW ? 'challenge expired' : null;
        if (!err && w.byId[F.b].owner !== src) err = 'only the challenged pet\'s owner can accept';
        if (F && !err && b - F.block > FIGHT_WINDOW) F.status = 'expired';
        var Pa = F && pet(F.a), Pb = F && pet(F.b);
        if (!err) err = fightable(Pa, b) || fightable(Pb, b); if (!err && Pb.fightDays[day(b)]) err = 'pet already fought this day';
        if (!err && day(F.block) !== day(b) && Pa.fightDays[day(b)]) err = 'challenger already fought this day'; /* 2026-10-14: a challenge from an earlier day can't give the challenger a second battle today */
        if (!err && !bh) err = 'block hash pending';
        if (err) { if (F && err === 'challenge expired') F.status = 'expired'; return L(r, 'rejected', err); }
        Pb.fightDays[day(b)] = 1; Pa.fightDays[day(b)] = 1;
        var sa = snapshot(Pa, w), sb = snapshot(Pb, w), seedStr = bh + ':' + r.tx_hash, res = simulateFight(seedStr, sa, sb);
        var win = res.winner === 'a' ? Pa : Pb, los = res.winner === 'a' ? Pb : Pa;
        var piece = giveRandomPiece(w, los, win, sha(seedStr + ':spoils'), 'fight ' + F.id);
        los.blackEyeUntil = b + BLACK_EYE_BLOCKS; win.wins = (win.wins || 0) + 1; los.losses = (los.losses || 0) + 1;
        Object.assign(F, { status: 'done', acceptBlock: b, acceptTx: r.tx_hash, seed: seedStr, snapA: sa, snapB: sb, winner: win.id, loser: los.id, turns: res.turns, maxA: res.maxA, maxB: res.maxB, spoils: piece ? { gid: piece.gid, label: piece.label } : null });
        return L(r, 'fightDone', 'fight ' + F.id + ': #' + win.id + ' beat #' + los.id + (piece ? ' and took ' + piece.label : ' (no takeable gear)'), { fightId: F.id });
      }
      case 'rumble': {
        var P = pet(t.petId), wk = weekOf(b), R = w.rumbles[wk] || (w.rumbles[wk] = { week: wk, seedBlock: seedBlockOfWeek(wk), entrants: [], done: false });
        var hasGear = P && wornOf(w, P.id).some(function (g) { return !g.legendary; }), need = COSTS.rumble + (hasGear ? 0 : COSTS.rumbleStake);
        var er = !P || P.owner !== src ? 'your pet only' : fightable(P, b) || (b >= R.seedBlock ? 'entries closed (seed block)' : null) || (R.entrants.some(function (x) { return x.id === P.id; }) ? 'already entered' : null) || (amt < need ? 'needs ' + need + (hasGear ? '' : ' (69 entry + 690 stake: no gear to risk)') : null);
        if (er) return L(r, 'rejected', er);
        R.entrants.push({ id: P.id, stake: hasGear ? 'gear' : 'burn' });
        return L(r, 'rumble', '#' + P.id + ' entered Royal Rumble week ' + wk + ' (seed block ' + R.seedBlock + ', stake: ' + (hasGear ? 'one gear piece' : '690 burn') + ')');
      }
      case 'breed': {
        var X = pet(t.a), Y = pet(t.b), be = amt < COSTS.breed ? 'below breed cost 690' : !X || X.owner !== src ? 'first pet must be yours' : t.a === t.b ? 'two different pets' : breedable(X, b) || (breedable(Y, b) ? 'partner: ' + breedable(Y, b) : null);
        if (be) return L(r, 'rejected', be);
        if (Y.owner !== src) { // two owners: this is a request (or the acceptance of the partner's mirrored request)
          var req = w.breedReqs.filter(function (q) { return q.a === t.b && q.b === t.a && !q.used && b - q.block <= BREED_WINDOW; })[0];
          if (!req) { w.breedReqs.push({ a: t.a, b: t.b, block: b, tx: r.tx_hash, owner: src }); return L(r, 'breedReq', '#' + t.a + ' asked #' + t.b + ' to breed (partner burns pet:breed:' + t.b + ':' + t.a + ' within ' + BREED_WINDOW + ' blocks)'); }
          req.used = true; if (!bh) return L(r, 'rejected', 'block hash pending');
          var kid = breed(w, Y, X, bh, r.tx_hash, b, req.owner); return L(r, 'breed', 'bred #' + Y.id + ' x #' + X.id + ' -> Egg #' + kid.id, { petId: kid.id });
        }
        if (!bh) return L(r, 'rejected', 'block hash pending');
        var k2 = breed(w, X, Y, bh, r.tx_hash, b, src); return L(r, 'breed', 'bred #' + X.id + ' x #' + Y.id + ' -> Egg #' + k2.id, { petId: k2.id });
      }
      case 'croll': {  /* community roll: Nakamoto (Mythic, every slot open) gets one item; the newest roll in a slot is worn */
        if (b < ACTIVATE_CROLL_BLOCK) return L(r, 'rejected', 'unknown pet: tag (community food)');
        if (amt < COSTS.croll) return L(r, 'rejected', 'below community roll cost ' + COSTS.croll + ' (burn still feeds the community pet)');
        if (!bh) return L(r, 'rejected', 'block hash pending');
        var ch = sha(bh + r.tx_hash + 'XCPETS:v2:community-roll'), cs = t.slot || V2_SLOTS[parseInt(ch.slice(16, 24), 16) % V2_SLOTS.length], ci = pickItem(ch, cs, 'nakamoto', 3, b >= ACTIVATE_DEDUP_BLOCK ? communityCounts(w) : null);
        if (!ci) return L(r, 'rejected', 'no community gear for ' + slotLabel(cs));
        var cg = { item: ci.id, label: ci.label, slot: ci.slot, tier: ci.tier, legendary: isLegendary(ci), block: b, tx: r.tx_hash, by: src };
        w.community.gear[ci.slot] = cg; w.community.gearLog.push(cg);
        return L(r, 'croll', 'community roll: Nakamoto got ' + ci.label + ' (' + slotLabel(ci.slot) + ')', { item: ci.id, slot: ci.slot });
      }
      case 'invalid': return L(r, 'rejected', 'unknown pet: tag (community food)');
      default: return L(r, 'plain', 'plain burn (community food)');
    }
  }
  /* Jake 2026-10-14: black sunglasses are GEAR only ('v2-bobo-face' "Shades"), never a born trait. v2 births (hatch / pack / breed / hybrids /
   * showcase) go through noBornShades: Bobo's DNA shades trait is forced off (pet.shades = false) and the 'beady' eye trait (label "Sunglasses",
   * same tier 0 as 'classic') becomes 'classic'. pet-core.js is untouched; pre-cutoff pets come from the frozen live engine and keep theirs. */
  function noBornShades(art) { art.shades = false; if (art.eyes === 'beady') art.eyes = 'classic'; if (art.hybrid && art.hybrid.eyes === 'beady') art.hybrid.eyes = 'classic'; return art; }
  /** bornTraits(pet, stage): the birth traits the generator assigned, as drawn (v2 overrides applied: no born sunglasses after the cutoff). Read-only. */
  function bornTraits(p, stage) { if (!p || !p.art || !PetCore.describe) return [];
    var art = Object.assign({}, p.art, { species: p.hybrid ? p.hybrid.shape || p.species : p.species }), d = {}; try { d = PetCore.describe(art, stage == null ? 3 : stage) || {}; } catch (e) { d = {}; }
    var rows = [['Pattern', d.Pattern], ['Eye trait', d.Eyes], ['Cheeks', d.Cheeks], ['Background', d.Background], ['Background colour', p.art.bgColor], ['Expression', d.Expression]];
    if (d.Shades && d.Shades !== 'None') rows.splice(2, 0, ['Shades', d.Shades]);
    if (p.hybrid) rows.unshift(['Hybrid', speciesLabel(p.hybrid.a || p.hybrid.shape) + ' × ' + speciesLabel(p.hybrid.b || p.hybrid.color)]);
    return rows.filter(function (r) { return r[1] != null && r[1] !== ''; }); }
  function mk(w, owner, art, b, care, tx) {
    var p = { id: w.nextPet++, owner: owner, art: art, species: art.species, tier: art.tierIndex, stats: Object.assign({}, art.baseStats), name: art.defaultName, care: care, hatchBlock: b, hatchTx: tx,
      lastFed: null, feedDays: {}, fightDays: {}, breeds: 0, lastBreed: null, parents: null, children: [], wins: 0, losses: 0, trophies: [] };
    w.pets.push(p); w.byId[p.id] = p; liveAt(w, p, b); return p;
  }
  // ---------------------------------------------------------------- HYBRIDS (demo v2, 2026-10-14)
  // HYBRID_NAMES: display name per ORDERED pair 'parentA:parentB' (A = the requester / first pet). 13 x 12 = 156 entries; the 24 Nakamoto pairs
  // are listed for completeness but unreachable (Nakamoto can't breed). PLACEHOLDER names, generated as blends (first part of A + end of B).
  // Edit freely: one line per parent A; keep names unique.
  var HYBRID_NAMES = {
    'pepe:wojak': 'Pejak', 'pepe:chud': 'Pechud', 'pepe:bobo': 'Pebo', 'pepe:mumu': 'Pemu', 'pepe:snibby': 'Pebby', 'pepe:dodo': 'Pedo', 'pepe:kevin': 'Pevin', 'pepe:peepo': 'Pepo', 'pepe:sarutobi': 'Pebi', 'pepe:doge': 'Pege', 'pepe:lenny': 'Penny', 'pepe:nakamoto': 'Peto',
    'wojak:pepe': 'Wope', 'wojak:chud': 'Wochud', 'wojak:bobo': 'Wobo', 'wojak:mumu': 'Womu', 'wojak:snibby': 'Wobby', 'wojak:dodo': 'Wodo', 'wojak:kevin': 'Wovin', 'wojak:peepo': 'Wopo', 'wojak:sarutobi': 'Wobi', 'wojak:doge': 'Woge', 'wojak:lenny': 'Wonny', 'wojak:nakamoto': 'Woto',
    'chud:pepe': 'Chupe', 'chud:wojak': 'Chujak', 'chud:bobo': 'Chubo', 'chud:mumu': 'Chumu', 'chud:snibby': 'Chubby', 'chud:dodo': 'Chudo', 'chud:kevin': 'Chuvin', 'chud:peepo': 'Chupo', 'chud:sarutobi': 'Chubi', 'chud:doge': 'Chuge', 'chud:lenny': 'Chunny', 'chud:nakamoto': 'Chuto',
    'bobo:pepe': 'Bope', 'bobo:wojak': 'Bojak', 'bobo:chud': 'Bochud', 'bobo:mumu': 'Bomu', 'bobo:snibby': 'Bobby', 'bobo:dodo': 'Bodo', 'bobo:kevin': 'Bovin', 'bobo:peepo': 'Bopo', 'bobo:sarutobi': 'Bobi', 'bobo:doge': 'Boge', 'bobo:lenny': 'Bonny', 'bobo:nakamoto': 'Boto',
    'mumu:pepe': 'Mupe', 'mumu:wojak': 'Mujak', 'mumu:chud': 'Muchud', 'mumu:bobo': 'Mubo', 'mumu:snibby': 'Mubby', 'mumu:dodo': 'Mudo', 'mumu:kevin': 'Muvin', 'mumu:peepo': 'Mupo', 'mumu:sarutobi': 'Mubi', 'mumu:doge': 'Muge', 'mumu:lenny': 'Munny', 'mumu:nakamoto': 'Muto',
    'snibby:pepe': 'Snipe', 'snibby:wojak': 'Snijak', 'snibby:chud': 'Snichud', 'snibby:bobo': 'Snibo', 'snibby:mumu': 'Snimu', 'snibby:dodo': 'Snido', 'snibby:kevin': 'Snivin', 'snibby:peepo': 'Snipo', 'snibby:sarutobi': 'Snibi', 'snibby:doge': 'Snige', 'snibby:lenny': 'Sninny', 'snibby:nakamoto': 'Snito',
    'dodo:pepe': 'Dope', 'dodo:wojak': 'Dojak', 'dodo:chud': 'Dochud', 'dodo:bobo': 'Dobo', 'dodo:mumu': 'Domu', 'dodo:snibby': 'Dobby', 'dodo:kevin': 'Dovin', 'dodo:peepo': 'Dopo', 'dodo:sarutobi': 'Dobi', 'dodo:doge': 'Dodoge', 'dodo:lenny': 'Donny', 'dodo:nakamoto': 'Doto',
    'kevin:pepe': 'Kepe', 'kevin:wojak': 'Kejak', 'kevin:chud': 'Kechud', 'kevin:bobo': 'Kebo', 'kevin:mumu': 'Kemu', 'kevin:snibby': 'Kebby', 'kevin:dodo': 'Kedo', 'kevin:peepo': 'Kepo', 'kevin:sarutobi': 'Kebi', 'kevin:doge': 'Kege', 'kevin:lenny': 'Kenny', 'kevin:nakamoto': 'Keto',
    'peepo:pepe': 'Peepe', 'peepo:wojak': 'Peejak', 'peepo:chud': 'Peechud', 'peepo:bobo': 'Peebo', 'peepo:mumu': 'Peemu', 'peepo:snibby': 'Peebby', 'peepo:dodo': 'Peedo', 'peepo:kevin': 'Peevin', 'peepo:sarutobi': 'Peebi', 'peepo:doge': 'Peege', 'peepo:lenny': 'Peenny', 'peepo:nakamoto': 'Peeto',
    'sarutobi:pepe': 'Sape', 'sarutobi:wojak': 'Sajak', 'sarutobi:chud': 'Sachud', 'sarutobi:bobo': 'Sabo', 'sarutobi:mumu': 'Samu', 'sarutobi:snibby': 'Sabby', 'sarutobi:dodo': 'Sado', 'sarutobi:kevin': 'Savin', 'sarutobi:peepo': 'Sapo', 'sarutobi:doge': 'Sage', 'sarutobi:lenny': 'Sanny', 'sarutobi:nakamoto': 'Sato',
    'doge:pepe': 'Dopepe', 'doge:wojak': 'Dowojak', 'doge:chud': 'Dogechud', 'doge:bobo': 'Dobobo', 'doge:mumu': 'Domumu', 'doge:snibby': 'Dosnibby', 'doge:dodo': 'Dododo', 'doge:kevin': 'Dokevin', 'doge:peepo': 'Dopeepo', 'doge:sarutobi': 'Dotobi', 'doge:lenny': 'Dolenny', 'doge:nakamoto': 'Domoto',
    'lenny:pepe': 'Lepe', 'lenny:wojak': 'Lejak', 'lenny:chud': 'Lechud', 'lenny:bobo': 'Lebo', 'lenny:mumu': 'Lemu', 'lenny:snibby': 'Lebby', 'lenny:dodo': 'Ledo', 'lenny:kevin': 'Levin', 'lenny:peepo': 'Lepo', 'lenny:sarutobi': 'Lebi', 'lenny:doge': 'Lege', 'lenny:nakamoto': 'Leto',
    'nakamoto:pepe': 'Nape', 'nakamoto:wojak': 'Najak', 'nakamoto:chud': 'Nachud', 'nakamoto:bobo': 'Nabo', 'nakamoto:mumu': 'Namu', 'nakamoto:snibby': 'Nabby', 'nakamoto:dodo': 'Nado', 'nakamoto:kevin': 'Navin', 'nakamoto:peepo': 'Napo', 'nakamoto:sarutobi': 'Nabi', 'nakamoto:doge': 'Nage', 'nakamoto:lenny': 'Nanny'
  };
  var HYBRID_CHANCE_10K = 1500;      // 15% of cross-species purebred breeds give a hybrid
  var HYBRID_RARITY_UP_10K = 1000;   // hybrid rarity = higher parent's tier; 10% one tier up (capped at Legendary)
  var HYBRID_TRUE_10K = 5000;        // hybrid x a root species: 50% that hybrid again, else the purebred
  function isHybrid(sp) { return typeof sp === 'string' && sp.indexOf('hyb:') === 0; }
  function hybridKey(a, b) { return 'hyb:' + a + ':' + b; }
  function hybridRoots(sp) { return isHybrid(sp) ? sp.slice(4).split(':') : [sp]; }
  function hybridName(sp) { var r = hybridRoots(sp); return HYBRID_NAMES[r[0] + ':' + r[1]] || (r[0] + '-' + r[1]); }
  function speciesLabel(sp) { if (isHybrid(sp)) return hybridName(sp) + ' (hybrid)'; var s = PetCore.SPECIES.filter(function (x) { return x.id === sp; })[0]; return s ? s.label : sp; }
  /** OPEN DECISION (placeholder): two hybrids of the SAME ordered pair breed true HYBRID_TRUE_10K of the time, otherwise a coin flip between the roots. */
  function samePairHybridRule(R, key) { var r = hybridRoots(key); return R() % 10000 < HYBRID_TRUE_10K ? key : r[R() % 2]; }
  /** hybridSpecies(R, A, B): the child's species under the hybrid rules (R = the breed hash stream; draws happen after the purebred draws). */
  function hybridSpecies(R, a, b, coin) {
    var ha = isHybrid(a), hb = isHybrid(b);
    if (!ha && !hb) { if (a === b || a === 'nakamoto' || b === 'nakamoto') return coin; return R() % 10000 < HYBRID_CHANCE_10K ? hybridKey(a, b) : coin; }
    if (ha && hb && a === b) return samePairHybridRule(R, a);
    var H = ha ? a : b, O = ha ? b : a, roots = hybridRoots(H);
    if (!isHybrid(O) && roots.indexOf(O) >= 0) return R() % 10000 < HYBRID_TRUE_10K ? H : O; // hybrid x one of its roots
    return roots[R() % 2]; // hybrid x anything else (incl. a different hybrid pair: parent A's hybrid roots if A is a hybrid): no 3-species hybrids
  }
  /** hybridPlan(hex, key): deterministic art assembly from the breed hash: body/head shape from one parent, colours + eyes + one signature feature from the other. */
  function hybridPlan(hex, key) { var r = hybridRoots(key), R = stream('XCPETS:v2:hybrid-art:' + hex), s = R() % 2, shape = r[s], color = r[1 - s];
    return { key: key, a: r[0], b: r[1], name: hybridName(key), shape: shape, color: color, feature: ['head', 'side'][R() % 2], eyes: PetCore.EYES[R() % PetCore.EYES.length].id }; }
  function speciesObj(id) { return PetCore.SPECIES.filter(function (x) { return x.id === id; })[0]; }
  /** hybridRender(art, opts): PetCore.render for a hybrid (art.hybrid = plan). Split-colour egg at stage 0; a small hybrid badge on every frame. */
  function hybridRender(art, opts) {
    var h = art.hybrid, S = speciesObj(h.shape), C = speciesObj(h.color), o = Object.assign({}, opts || {}), img;
    var shapeArt = Object.assign({}, art, { species: h.shape }), colArt = Object.assign({}, art, { species: h.color });
    function withColours(fn) { var keep = S.canon; S.canon = C.canon; try { return fn(); } finally { S.canon = keep; } }
    if ((o.stage == null ? 3 : o.stage) === 0) { var L = PetCore.render(shapeArt, o), Rt = PetCore.render(colArt, o); img = { width: 32, height: 32, data: new Uint8ClampedArray(L.data) };
      for (var y = 0; y < 32; y++) for (var x = 16; x < 32; x++) for (var c = 0; c < 4; c++) img.data[(y * 32 + x) * 4 + c] = Rt.data[(y * 32 + x) * 4 + c];
    } else {
      shapeArt.eyes = h.eyes; img = withColours(function () { return PetCore.render(shapeArt, o); });
      var key = function (a2) { return Object.assign({}, a2, { background: 'solid', bgColor: '#ff00ff', pattern: 'none' }); };
      var kS = withColours(function () { return PetCore.render(key(shapeArt), o); }), kF = PetCore.render(key(colArt), o);
      var sil = function (k, i) { return !(k.data[i] === 255 && k.data[i + 1] === 0 && k.data[i + 2] === 255); }, top = 32, x0 = 32, x1 = -1;
      for (var i = 0; i < 1024; i++) if (sil(kS, i * 4)) { top = Math.min(top, i >> 5); x0 = Math.min(x0, i & 31); x1 = Math.max(x1, i & 31); }
      var pick = function (feat) { var out = []; for (var j = 0; j < 1024; j++) { var yy = j >> 5, xx = j & 31; if (!sil(kF, j * 4) || sil(kS, j * 4)) continue;
        if (feat === 'head' ? yy < top : (yy >= top + 8 && (xx < x0 || xx > x1))) out.push(j); }
        /* ear fix (2026-10-14): ears + head outline always come from the SHAPE parent. 'head' used to take the colour parent's top 3 rows,
         * which pasted that parent's ears (or crown dome) beside/between the shape's own ears = doubled, misplaced ears (e.g. Bobo x Sarutobi).
         * Now only a crest that rises ABOVE the shape's head, kept only where it grows out of the shape (no floating bits). */
        if (feat === 'head') { var on = {}, keep = {}, q = []; out.forEach(function (j) { on[j] = 1; });
          out.forEach(function (j) { if (sil(kS, (j + 32) * 4) && (j >> 5) < 31) { keep[j] = 1; q.push(j); } });
          while (q.length) { var c0 = q.pop(); [c0 - 1, c0 + 1, c0 - 32, c0 + 32].forEach(function (n) { if (on[n] && !keep[n] && Math.abs((n & 31) - (c0 & 31)) <= 1) { keep[n] = 1; q.push(n); } }); }
          out = out.filter(function (j) { return keep[j]; }); }
        return out; };
      var px = pick(h.feature); if (px.length < 3) px = pick(h.feature === 'head' ? 'side' : 'head');
      px.forEach(function (j) { for (var c2 = 0; c2 < 3; c2++) img.data[j * 4 + c2] = kF.data[j * 4 + c2]; });
    }
    var hex = function (c3) { return [parseInt(c3.slice(1, 3), 16), parseInt(c3.slice(3, 5), 16), parseInt(c3.slice(5, 7), 16)]; };
    [[29, 0, '#1a1020'], [28, 1, '#1a1020'], [30, 1, '#1a1020'], [27, 2, '#1a1020'], [31, 2, '#1a1020'], [28, 2, S.canon.body], [29, 1, S.canon.body], [29, 2, '#ffc93c'], [30, 2, C.canon.body], [29, 3, C.canon.body], [28, 3, '#1a1020'], [30, 3, '#1a1020'], [29, 4, '#1a1020']]
      .forEach(function (q) { var v = hex(q[2]), k3 = (q[1] * 32 + q[0]) * 4; img.data[k3] = v[0]; img.data[k3 + 1] = v[1]; img.data[k3 + 2] = v[2]; img.data[k3 + 3] = 255; });
    return img;
  }
  function hybridFrames(art, opts) { var fr = []; for (var f = 0; f < 4; f++) fr.push(hybridRender(art, Object.assign({}, opts, { frame: f }))); return fr; }
  /** castHybrids(w): one Cast entry per hybrid pair that exists in the state (Cast "Hybrids" tab). */
  function castHybrids(w) { var seen = {}, out = []; (w && w.pets || []).forEach(function (p) { if (!isHybrid(p.species) || seen[p.species]) return; seen[p.species] = 1;
      var r = hybridRoots(p.species); out.push({ key: p.species, name: hybridName(p.species), a: r[0], b: r[1], plan: hybridPlan(sha('cast:' + p.species), p.species) }); }); return out; }
  /** breedChild(hex, A, B) -> { species, tier, stats } (pure: used by replay and by the odds test). */
  function breedChild(hex, A, B) {
    var R = stream('XCPETS:v2:breed:' + hex), species = R() % 2 ? B.species : A.species, lo = Math.min(A.tier, B.tier), hi = Math.max(A.tier, B.tier), roll = R() % 10000;
    var tier = roll < RARITY_UP_10K ? Math.min(3, hi + 1) : roll < RARITY_UP_10K + RARITY_HIGH_10K ? hi : lo, stats = {};
    Object.keys(A.stats).forEach(function (k) { stats[k] = Math.max(1, Math.round((A.stats[k] + B.stats[k]) / 2) + (R() % 5) - 2); });
    // hybrids: extra draws from the SAME stream, after the purebred draws (so purebred-only pairs give exactly the same results as before)
    if (isHybrid(A.species) || isHybrid(B.species) || A.species !== B.species) species = hybridSpecies(R, A.species, B.species, species);
    if (isHybrid(species)) {
      var up = R() % 10000; tier = up < HYBRID_RARITY_UP_10K ? Math.min(3, hi + 1) : hi;
      var best = function (P) { return Object.keys(P.stats).reduce(function (m, k) { return P.stats[k] > P.stats[m] ? k : m; }, Object.keys(P.stats)[0]); };
      var ka = best(A), kb = best(B); stats[ka] = A.stats[ka]; stats[kb] = Math.max(kb === ka ? stats[kb] : 0, B.stats[kb]);
      return { species: species, tier: tier, stats: stats, hybrid: true, best: [ka, kb] };
    }
    return { species: species, tier: tier, stats: stats };
  }
  function breed(w, A, B, bh, tx, b, owner) {
    var c = breedChild(sha(bh + tx), A, B), art = PetCore.generate({ blockHash: bh, petId: tx + ':child', blockHeight: b });
    art.species = c.species; art.tierIndex = c.tier; art.tier = PetCore.TIERS[c.tier].id; art.baseStats = c.stats;
    if (c.hybrid) { var plan = hybridPlan(sha(bh + tx), c.species); art.species = plan.shape; art.hybrid = plan; }
    if (b >= ACTIVATE_BREEDCARRY_BLOCK) [A, B].forEach(function (P) { (P.carried || []).forEach(function (cr) { if (c.stats[cr.stat] != null && c.stats[cr.stat] < cr.value) c.stats[cr.stat] = cr.value; }); }); /* carried stat floor */
    var kid = mk(w, owner, noBornShades(art), b, 0, tx); kid.species = c.species; if (c.hybrid) kid.hybrid = art.hybrid; kid.parents = [A.id, B.id]; // no gear or care inherited: starts as an Egg (feed 69 to hatch)
    [A, B].forEach(function (p) { p.breeds++; p.lastBreed = b; p.children.push(kid.id); });
    if (b >= ACTIVATE_BREEDCARRY_BLOCK && B.owner !== owner && A.owner === owner) { var bk = Object.keys(A.stats).reduce(function (m, k) { return A.stats[k] > A.stats[m] ? k : m; }, Object.keys(A.stats)[0]);
      (B.carried = B.carried || []).push({ from: A.id, species: A.species, stat: bk, value: A.stats[bk], block: b, child: kid.id }); } /* breed carry: parent B (accepting owner, no egg) */
    return kid;
  }
  function resolveRumble(w, R, seedHash) {
    R.done = true; R.seedHash = seedHash; var b = R.seedBlock; w._b = b;
    var ents = R.entrants.map(function (e) { var p = w.byId[e.id]; if (p) liveAt(w, p, b); return p && !fightable(p, b) ? p : null; }).filter(Boolean);
    ents.sort(function (x, y) { var hx = sha(seedHash + ':seat:' + x.id), hy = sha(seedHash + ':seat:' + y.id); return hx < hy ? -1 : 1; });
    R.bracket = [ents.map(function (p) { return p.id; })]; R.rounds = []; R.highlights = [];
    var alive = ents.slice(), round = 0;
    while (alive.length > 1) {
      round++; var next = [], matches = [];
      for (var i = 0; i < alive.length; i += 2) {
        var A = alive[i], B = alive[i + 1]; if (!B) { next.push(A); matches.push({ a: A.id, b: null, winner: A.id, bye: true }); continue; }
        var sa = snapshot(A, w), sb = snapshot(B, w), s = seedHash + ':r' + round + ':' + A.id + ':' + B.id, res = simulateFight(s, sa, sb);
        var win = res.winner === 'a' ? A : B, los = res.winner === 'a' ? B : A, pc = giveRandomPiece(w, los, win, sha(s + ':spoils'), 'rumble week ' + R.week);
        var m = { a: A.id, b: B.id, winner: win.id, loser: los.id, seed: s, turns: res.turns, maxA: res.maxA, maxB: res.maxB, snapA: sa, snapB: sb, spoils: pc ? pc.label : null };
        matches.push(m); next.push(win);
        var sum = function (p) { var t = 0; for (var k in p.stats) t += p.stats[k]; return t; };
        if (sum(win) < sum(los)) R.highlights.push('Upset in round ' + round + ': #' + win.id + ' knocked out #' + los.id);
        if (pc) R.highlights.push('#' + win.id + ' took ' + pc.label + ' from #' + los.id);
      }
      R.rounds.push(matches); alive = next; R.bracket.push(alive.map(function (p) { return p.id; }));
    }
    if (alive.length === 1) {
      var champ = alive[0]; R.champion = champ.id; champ.crownUntil = b + WEEK; champ.trophies.push('Rumble champion wk ' + R.week);
      var last = R.rounds[R.rounds.length - 1] || [], semis = R.rounds[R.rounds.length - 2] || [];
      var top = [champ.id]; last.forEach(function (m) { if (m.loser) top.push(m.loser); }); semis.forEach(function (m) { if (m.loser) top.push(m.loser); });
      R.top = top;
      top.forEach(function (id, k) { var p = w.byId[id], it = { id: 'rumble-trophy', label: (k === 0 ? 'Gold' : k === 1 ? 'Silver' : 'Bronze') + ' Rumble trophy wk ' + R.week, slot: 'hand', tier: 2 };
        var g = w.items['g' + w.nextItem] = { gid: 'g' + (w.nextItem++), item: it.id, label: it.label, slot: 'hand', tier: 2, legendary: false, owner: p.owner, on: null, src: 'trophy' }; if (k > 0) p.trophies.push(it.label); });
      R.highlights.push('FINAL: #' + champ.id + ' is the Royal Rumble champion (crown until block ' + (b + WEEK) + ')');
    }
  }
  /** bestKit(species): the BEST piece for every slot in the game. classic = the 5 pet-core kit slots (band/armor/cape/weapon/crown,
   * highest tier, first listed on ties); slots = the 6 v2 slots (head = the species legendary; others = highest-tier eligible overlay piece,
   * the species' own piece first on ties). */
  function bestKit(species) {
    var classic = {}; Object.keys(CORE_LISTS).forEach(function (k) { var l = (PetCore[CORE_LISTS[k]] || []).filter(function (x) { return x.id !== 'none'; }), m = Math.max.apply(null, l.map(function (x) { return x.t || 0; }));
      classic[k] = l.filter(function (x) { return (x.t || 0) === m; })[0].id; });
    var slots = {}; V2_SLOTS.forEach(function (sl) {
      var lh = legendaryOf(species).filter(function (x) { return x.slot === 'head'; })[0]; if (sl === 'head' && lh) { slots[sl] = lh.id; return; }
      var c = ALL.filter(function (x) { return x.slot === sl && x.src !== 'core' && x.kind !== 'banner' && x.kind !== 'jewelry' && !(x.sig && x.slot !== 'head') && !x.card && eligible(x, species); }), /* signature pieces (except the head one) stay out of the showcase kit: Max Pepe's look is unchanged */ /* 2026-10-14 additions stay out of Max Pepe's showcase kit (unchanged look) */ m = Math.max.apply(null, c.map(function (x) { return x.tier; }));
      c = c.filter(function (x) { return x.tier === m; }).sort(function (a, b) { return (b.origin === species) - (a.origin === species) || (b.src === 'v2') - (a.src === 'v2') || (a.label < b.label ? -1 : 1); });
      slots[sl] = c[0].id; });
    return { classic: classic, slots: slots };
  }
  /** op 'maxpet': the showcase pet (e.g. Max Pepe): Legendary, Mythic, every stat 31, all 6 slots open, best piece in every slot + full classic kit. */
  function makeMaxPet(w, o) {
    var sp = o.species || 'pepe', art = PetCore.characterPet(sp, { tier: 'legendary', bgColor: o.bgColor || '#2a3a2e' }), kit = bestKit(sp);
    art.tierIndex = 3; art.tier = 'legendary'; PetCore.STAT_KEYS.forEach(function (k) { art.baseStats[k] = 31; }); Object.assign(art, kit.classic);
    var b0 = o.block_index - 30 * BLOCKS_PER_DAY, p = mk(w, o.owner, noBornShades(art), b0, thresholdsFor(sp)[5], 'maxpet:' + sp);
    p.name = o.name || 'Max Pepe'; p.max = true; p.classicKit = kit.classic; p.showcase = Object.keys(kit.slots).map(function (k) { return kit.slots[k]; });
    for (var d = day(b0); d <= day(o.block_index); d++) p.feedDays[d] = 1; p.lastFed = o.block_index;
    V2_SLOTS.forEach(function (sl) { var g = newItem(w, BY_ID[kit.slots[sl]], o.owner, 'showcase'); liveAt(w, p, o.block_index); wear(w, p, g); });
    return p;
  }
  function applyOp(w, o) {
    if (o.kind === 'maxpet') { if (!w.pets.some(function (q) { return q.max && q.owner === o.owner; })) makeMaxPet(w, o); return; }
    if (o.kind !== 'equip') return; var p = w.byId[o.petId]; if (!p || p.owner !== o.owner) return; liveAt(w, p, o.block_index); if (p.dead || p.released) return;
    if (o.gid == null) { var cur = wornIn(w, p.id, o.slot); if (cur) cur.on = null; return; }
    var g = w.items[o.gid]; if (!g || g.owner !== o.owner) return; wear(w, p, g);
  }

  /** newWins(w, owner, seen) -> {wins, seen, first}: gear the owner gained since `seen` (a {gid:1} map; null = first look = baseline, no wins).
   *  Covers paid rolls (src 'roll', v2), live-engine rolls incl. free roll tokens before the cutoff (src 'live'), trophies/won pieces. */
  function newWins(w, owner, seen) {
    // identity must survive replays: v2 gids are sequential, so an earlier-ordered burn renumbers later items. Key = creating tx (roll log),
    // live gid for imported pieces, else src+item+slot+occurrence.
    var first = !seen, s = Object.assign({}, seen || {}), out = [], byGid = {}, occ = {};
    (w.log || []).forEach(function (l) { if (l.gid && l.tx) byGid[l.gid] = 'tx:' + l.tx + ':' + (l.wk || l.gid.replace(/^g\d+$/, '')); });
    Object.keys(w.items).forEach(function (gid) { var g = w.items[gid]; if (!g || g.owner !== owner) return;
      var k = g.liveGid != null ? 'L' + g.liveGid : byGid[gid] || (function () { var b = (g.src || '') + ':' + g.item + ':' + g.slot; occ[b] = (occ[b] || 0) + 1; return b + '#' + occ[b]; })();
      if (s[k]) return; s[k] = 1;
      if (!first) out.push({ gid: gid, item: g.item, label: g.label, slot: g.slot, slotName: slotLabel(g.slot), tier: g.tier, tierName: g.legendary ? 'Legendary' : (TIER_LABELS[g.tier] || ''), legendary: !!g.legendary, src: g.src, on: g.on, rolledOn: g.rolledOn }); });
    return { wins: out, seen: s, first: first };
  }
  /** newHatches(w, owner, seen) -> {groups:[{tx, eggs:[pet], n}], seen, first}: pets the owner hatched (single, dozen, case, breeding child)
   *  since `seen` (null = first look = silent baseline), grouped per hatch burn like the live packBox review. Key = hatch tx + position. */
  function newHatches(w, owner, seen) {
    var first = !seen, s = Object.assign({}, seen || {}), g = {}, order = [], pos = {};
    w.pets.forEach(function (p) { if (p.owner !== owner || p.community) return; var tx = String(p.hatchTx || ('id' + p.id)).replace(/:\d+$/, ''); pos[tx] = (pos[tx] || 0) + 1; var k = tx + ':' + pos[tx];
      if (s[k]) return; s[k] = 1; if (first) return;
      if (!g[tx]) { g[tx] = []; order.push(tx); } g[tx].push(p); });
    return { groups: order.map(function (tx) { return { tx: tx, eggs: g[tx], n: g[tx].length }; }), seen: s, first: first };
  }
  // ---------------------------------------------------------------- bulk planners (pure; UI turns plans into mock burns)
  function feedQueue(w, owner, ids, nextBlock) { // ids null => all hungry. From ACTIVATE_FEEDM_BLOCK: always bundled, as many pets per burn as the 34-byte tag fits
    var ps = w.pets.filter(function (p) { return p.owner === owner && p.hungry && (!ids || ids.indexOf(p.id) >= 0); });
    var nb = nextBlock != null ? nextBlock : (w.tip || 0);  /* bundle only once the chain TIP itself is >= ACTIVATE_FEEDM_BLOCK (no tip -> 0 -> single feeds) */
    if (nb < ACTIVATE_FEEDM_BLOCK || ps.length < 2) return ps.map(function (p) { return { tag: 'pet:feed:' + p.id, amount: p.nextMeal, petId: p.id, label: 'Feed #' + p.id }; });
    return feedBatches(ps);
  }
  /** feedBatches(pets) -> pet:fm:START:MASK plans (<= 34 bytes), amount = the sum of those pets' meals (exact, rounded to 8 dp). */
  function feedBatches(ps) {
    ps = ps.slice().sort(function (a, b) { return a.id - b.id; }); var out = [], i = 0;
    while (i < ps.length) {
      var start = ps[i].id, cap = MAX_TAG_BYTES - ('pet:fm:' + start + ':').length, maxId = start + 5 * cap - 1, inB = [];
      while (i < ps.length && ps[i].id <= maxId) inB.push(ps[i++]);
      var amount = Math.round(inB.reduce(function (a, p) { return a + p.nextMeal; }, 0) * 1e8) / 1e8;
      if (inB.length === 1) { out.push({ tag: 'pet:feed:' + start, amount: amount, petId: start, label: 'Feed #' + start }); continue; }
      var d = []; inB.forEach(function (p) { var o = p.id - start, j = Math.floor(o / 5); while (d.length <= j) d.push(0); d[j] |= 1 << (o % 5); });
      out.push({ tag: 'pet:fm:' + start + ':' + d.map(function (v) { return v.toString(32).toUpperCase(); }).join(''), amount: amount, petIds: inB.map(function (p) { return p.id; }), label: 'Feed ' + inB.length + ' pets' });
    }
    out.forEach(function (p, k) { if (out.length > 1) p.label += ' (burn ' + (k + 1) + ' of ' + out.length + ')'; });
    return out;
  }
  function rollQueue(w, owner, ids, n) { var out = []; w.pets.forEach(function (p) { if (p.owner !== owner || ids.indexOf(p.id) < 0 || p.dead || p.released) return;
    for (var i = 0; i < (n || 1); i++) out.push({ tag: 'pet:roll:' + p.id, amount: COSTS.roll, petId: p.id, label: 'Gear roll #' + p.id }); }); return out; }
  /** crollOn(tip): the play page offers the community roll only once the chain tip has reached ACTIVATE_CROLL_BLOCK (unknown tip => off). */
  function crollOn(tip) { return tip != null && Number(tip) >= ACTIVATE_CROLL_BLOCK; }
  function communityRollPlan(slot) { var tag = 'pet:c:roll' + (slot ? ':' + String(slot).toUpperCase() : ''); return { tag: tag, amount: COSTS.croll, label: 'Community roll' }; }
  /** communityGear(w) -> worn community item ids (newest roll per slot, slot order). */
  function communityGear(w) { var g = (w.community && w.community.gear) || {}; return V2_SLOTS.filter(function (s) { return g[s]; }).map(function (s) { return g[s].item; }); }
  function communityFeedPlan(amount) { amount = Math.floor(Number(amount)); if (!(amount >= COSTS.feedMin)) return { ok: false, error: 'minimum community feed is ' + COSTS.feedMin }; return { ok: true, tag: 'pet:feed', amount: amount }; }
  /** autoEquipOps: for each selected pet and open slot, wear the best free (inventory) eligible item of the owner. */
  function autoEquipOps(w, owner, ids, block) {
    var used = {}, ops = [];
    w.pets.forEach(function (p) { if (p.owner !== owner || ids.indexOf(p.id) < 0 || p.dead) return;
      p.openSlots.forEach(function (sl) { var cur = wornIn(w, p.id, sl), best = cur;
        w.itemList.forEach(function (g) { if (g.owner === owner && g.on == null && !used[g.gid] && g.slot === sl && eligible(g.item, p.species) && (!best || g.tier > best.tier)) best = g; });
        if (best && best !== cur) { used[best.gid] = 1; ops.push({ kind: 'equip', owner: owner, petId: p.id, slot: sl, gid: best.gid, block_index: block }); } }); });
    return ops;
  }
  /** outfitOps: apply one outfit {slot: itemId} to ALL selected pets. Gear model = the real game's: every piece is a unique instance
   * (one roll = one item, worn by at most one pet), so each pet needs its own free copy. Equips one copy per pet while copies last and
   * reports EVERY pet that did not get a piece, with the reason (never a silent skip). Returns { ops, missing, report }. */
  function outfitOps(w, owner, ids, outfit, block) {
    var used = {}, ops = [], missing = [], got = {};
    function miss(pid, sl, why) { var p = w.byId[pid], it = BY_ID[outfit[sl]] || {}; missing.push({ petId: pid, name: p ? p.name : '?', slot: sl, item: outfit[sl], label: it.label || outfit[sl], why: why }); }
    ids.forEach(function (pid) { var p = w.byId[pid];
      Object.keys(outfit).forEach(function (sl) {
        if (!p || p.owner !== owner || p.released) return miss(pid, sl, 'not your pet');
        if (p.dead) return miss(pid, sl, 'pet is dead (Pet Cemetery)');
        if (p.openSlots.indexOf(sl) < 0) return miss(pid, sl, slotLabel(sl) + ' slot not unlocked yet (capacity ' + p.capacity + ')');
        if (!eligible(outfit[sl], p.species)) return miss(pid, sl, 'species-only legendary');
        var cur = wornIn(w, pid, sl); if (cur && cur.item === outfit[sl]) { got[sl] = (got[sl] || 0) + 1; return; } // already wearing it
        var g = w.itemList.filter(function (x) { return x.owner === owner && x.on == null && !used[x.gid] && x.item === outfit[sl]; })[0];
        if (!g) return miss(pid, sl, 'no free copy left (each piece is one item; roll more or take one off another pet)');
        used[g.gid] = 1; got[sl] = (got[sl] || 0) + 1; ops.push({ kind: 'equip', owner: owner, petId: pid, slot: sl, gid: g.gid, block_index: block }); }); });
    return { ops: ops, missing: missing, report: outfitReport(ops, missing, ids.length, outfit, got) };
  }
  function outfitReport(ops, missing, n, outfit, got) {
    var lines = Object.keys(outfit).map(function (sl) { var it = BY_ID[outfit[sl]] || {}, m = missing.filter(function (x) { return x.slot === sl; });
      return (it.label || outfit[sl]) + ': ' + (got[sl] || 0) + ' of ' + n + ' pets' + (m.length ? ' — not equipped: ' + m.map(function (x) { return '#' + x.petId + ' ' + x.name + ' (' + x.why + ')'; }).join('; ') : ' ✓'); });
    return { ok: !missing.length, equipped: ops.length, text: lines.join('\n') };
  }
  /** equipCheck(w, owner, petId, itemId) -> { ok, why, gid, from, worn } — the click-to-equip picker's rule (same rules as replay's wear()).
   * Prefers a free (bagged) copy; otherwise moves a copy from another of the owner's pets. */
  function equipCheck(w, owner, petId, itemId) {
    var p = w.byId[petId], it = BY_ID[itemId];
    if (!p || p.owner !== owner || p.released) return { ok: false, why: 'not your pet' };
    if (p.dead) return { ok: false, why: 'pet is dead (Pet Cemetery)' };
    if (!it) return { ok: false, why: 'unknown piece' };
    if (p.openSlots.indexOf(it.slot) < 0) return { ok: false, why: slotLabel(it.slot) + ' slot not unlocked yet (capacity ' + p.capacity + '/6 grows with age + care)' };
    if (!eligible(it, p.species)) return { ok: false, why: (it.origin ? it.origin.charAt(0).toUpperCase() + it.origin.slice(1) : 'species') + '-only legendary' };
    var cur = wornIn(w, p.id, it.slot); if (cur && cur.item === itemId) return { ok: false, worn: true, why: 'already wearing it', gid: cur.gid };
    var mineCopies = (w.itemList || []).filter(function (g) { return g.owner === owner && g.item === itemId; });
    if (!mineCopies.length) return { ok: false, why: 'you own no copy (gear-roll, win fights or the Rumble to get one)' };
    var free = mineCopies.filter(function (g) { return g.on == null; })[0];
    if (free) return { ok: true, gid: free.gid, from: null, copies: mineCopies.length, free: mineCopies.filter(function (g) { return g.on == null; }).length };
    var other = mineCopies.filter(function (g) { var q = w.byId[g.on]; return q && q.id !== p.id; })[0];
    return other ? { ok: true, gid: other.gid, from: other.on, copies: mineCopies.length, free: 0 } : { ok: false, why: 'no free copy' };
  }
  /** pickerPieces(w, owner, petId, slot): every piece of the slot with its equip state (owned/free counts + why not). Owned first. */
  function pickerPieces(w, owner, petId, slot) {
    return ALL.filter(function (x) { return x.slot === slot; }).map(function (x) {
      var c = equipCheck(w, owner, petId, x.id), owned = (w.itemList || []).filter(function (g) { return g.owner === owner && g.item === x.id; });
      return { id: x.id, label: x.label, tier: x.tier, legendary: !!x.exclusive, origin: x.origin, owned: owned.length, free: owned.filter(function (g) { return g.on == null; }).length, check: c };
    }).sort(function (a, b) { return (b.check.worn ? 2 : b.check.ok ? 1 : 0) - (a.check.worn ? 2 : a.check.ok ? 1 : 0) || (b.owned > 0) - (a.owned > 0) || b.tier - a.tier || (a.label < b.label ? -1 : 1); });
  }
  /** catalogBySlot(): every gear piece, grouped by slot (V2_SLOTS order). */
  function catalogBySlot() { var o = {}; V2_SLOTS.forEach(function (sl) { o[sl] = ALL.filter(function (x) { return x.slot === sl; }).sort(function (a, b) { return a.tier - b.tier || (a.label < b.label ? -1 : 1); }); }); return o; }
  function hideAtOrBelow(pets, tierIdx) { return tierIdx == null || tierIdx < 0 ? pets : pets.filter(function (p) { return p.tier > tierIdx; }); }
  function familyTree(w, id, depth) { var p = w.byId[id]; if (!p) return null; depth = depth == null ? 3 : depth;
    return { id: p.id, name: p.name, species: p.species, tier: p.tier, parents: depth && p.parents ? p.parents.map(function (x) { return familyTree(w, x, depth - 1); }) : [], children: p.children.slice() }; }
  function buildTag(kind, o) { o = o || {}; var t = { hatch: 'pet:hatch', cfeed: 'pet:feed', feed: 'pet:feed:' + o.petId, roll: 'pet:roll:' + o.petId, fight: 'pet:fight:' + o.a + ':' + o.b,
    accept: 'pet:accept:' + o.fightId, rumble: 'pet:rumble:' + o.petId, breed: 'pet:breed:' + o.a + ':' + o.b }[kind]; return t && utf8Len(t) <= MAX_TAG_BYTES ? t : null; }

  /** Ranking-page "where do my pets rank": ranked = [{rank, p}] (rank 1 = best). Returns the owner's entries with "#R of N" and a top/bottom X% note. */
  /** kitWith(classicKit, wornIds): a pet with a classic kit (Max Pepe) still shows what it actually wears. A worn core piece (iron/gold armor,
   * capes, bands...) REPLACES the kit's piece in that core slot. Bug fixed 2026-10-14: worn core pieces were filtered out and the kit's piece
   * was drawn instead, so equipping Iron or Gold armor (or any core piece) on such a pet never showed. Returns { go, ids (overlays only) }. */
  // A worn non-core piece that is NOT part of the showcase defaults replaces the classic piece drawn in that slot (headwear -> crown, outfit -> armor, drip -> cape, grip -> weapon).
  var KIT_SLOT_OF = { head: 'crown', body: 'armor', back: 'cape', hand: 'weapon' };
  function kitWith(classicKit, wornIds, showcase) { var go = Object.assign({}, classicKit || {}), ids = [];
    (wornIds || []).forEach(function (id) { var it = BY_ID[id]; if (it && it.src === 'core') go[it.coreSlot] = id; else { ids.push(id); if (it && KIT_SLOT_OF[it.slot] && (showcase || []).indexOf(id) < 0) delete go[KIT_SLOT_OF[it.slot]]; } });
    return { go: go, ids: ids }; }
  /** breedPicker(w, owner, tip, selA): cards for the breeding picker. Nakamoto + the community pet are left out silently (rule unchanged).
   * mine = owner's living pets (parent A), partners = every other living pet (parent B); each { p, why } where why = null if selectable. */
  function breedPicker(w, owner, tip, selA) {
    var live = w.pets.filter(function (p) { return !p.dead && !p.released && p.species !== 'nakamoto' && !p.community; });
    var why = function (p) { var r = breedable(p, tip); if (!r && selA != null && String(p.id) === String(selA)) r = 'already parent A'; return r || null; };
    return { mine: live.filter(function (p) { return p.owner === owner; }).map(function (p) { return { p: p, why: breedable(p, tip) || null }; }),
      partners: live.map(function (p) { return { p: p, why: why(p) }; }) }; }
  function myRanks(ranked, owner) { var n = ranked.length;
    return ranked.filter(function (r) { return r.p.owner === owner; }).map(function (r) {
      var top = r.rank <= n - r.rank + 1, pct = Math.max(1, Math.ceil((top ? r.rank : n - r.rank + 1) / n * 100));
      return { rank: r.rank, total: n, id: r.p.id, name: r.p.name, half: top ? 'top' : 'bottom', pct: pct, label: '#' + r.rank + ' of ' + n, note: (top ? 'top ' : 'bottom ') + pct + '%' }; }); }
  return { CUTOFF_BLOCK: CUTOFF_BLOCK, LIVE_DEATH_FROM_BLOCK: LIVE_DEATH_FROM_BLOCK, RETIRED: RETIRED, resolveItem: resolveItem, itemOf: itemOf, readBurns: readBurns, importLive: importLive, migrateLoadout: migrateLoadout, setLiveEngine: setLiveEngine, V2_FROM_BLOCK: V2_FROM_BLOCK, BLOCKS_PER_DAY: BLOCKS_PER_DAY, WEEK: WEEK, COSTS: COSTS, FEED_QUICK: FEED_QUICK, FEE_SATS: FEE_SATS, MAX_RELEASE_PER_BURN: MAX_RELEASE_PER_BURN,
    THRESHOLDS: THRESHOLDS, NAKAMOTO_THRESHOLDS: NAKAMOTO_THRESHOLDS, NAKAMOTO_MEAL_SIZES: NAKAMOTO_MEAL_SIZES, WIZARD_THRESHOLDS: WIZARD_THRESHOLDS, COMMUNITY_GOAL: COMMUNITY_GOAL, returnProgress: returnProgress, noBornShades: noBornShades, bornTraits: bornTraits, _breed: breed, BURN_ADDRESS: BURN_ADDRESS,
    COMMUNITY_GOAL_NAME: COMMUNITY_GOAL_NAME, COMMUNITY_PET: COMMUNITY_PET, STAGE_NAMES: STAGE_NAMES, V2_SLOTS: V2_SLOTS, NAKAMOTO_CAST_STAGE: NAKAMOTO_CAST_STAGE, castShowsNakamoto: castShowsNakamoto, bestKit: bestKit, SLOT_LABELS: SLOT_LABELS, slotLabel: slotLabel, newWins: newWins, newHatches: newHatches, TIER_LABELS: TIER_LABELS, equipCheck: equipCheck, pickerPieces: pickerPieces, catalogBySlot: catalogBySlot, BLACK_EYE_BLOCKS: BLACK_EYE_BLOCKS, FIGHT_WINDOW: FIGHT_WINDOW,
    BREED_COOLDOWN: BREED_COOLDOWN, ACTIVATE_BREEDCARRY_BLOCK: ACTIVATE_BREEDCARRY_BLOCK, BREED_MAX: BREED_MAX, BREED_WINDOW: BREED_WINDOW, TIER_LABELS: TIER_LABELS, SPECIES13: SPECIES13, ALL_GEAR: ALL, GEAR_BY_ID: BY_ID,
    sha: sha, day: day, weekOf: weekOf, seedBlockOfWeek: seedBlockOfWeek, pickSpecies: pickSpecies, thresholdsFor: thresholdsFor, mealFor: mealFor, mealsToMythic: mealsToMythic, stageFor: stageFor, wizardStage: wizardStage,
    isLegendary: isLegendary, eligible: eligible, legendaryOf: legendaryOf, pool: pool, pickItem: pickItem, capacity: capacity, parseTag: parseTag, battleBlock: battleBlock, releaseBatches: releaseBatches, burnSummary: burnSummary,
    validFeedAmount: validFeedAmount, simulateFight: simulateFight, replay: replay, breedChild: breedChild, feedQueue: feedQueue, feedBatches: feedBatches, freeRolls: freeRolls, freeRollPlan: freeRollPlan, ACTIVATE_FOUNDER_BLOCK: ACTIVATE_FOUNDER_BLOCK, _setFounderActivation: function (b) { ACTIVATE_FOUNDER_BLOCK = b; }, _setFounderGrant: function (kit, credits) { if (kit) FOUNDER_KIT_PER_ROLL = kit; if (credits != null) FOUNDER_CREDITS_PER_ROLL = credits; }, founderGrant: function () { return { kit: FOUNDER_KIT_PER_ROLL.slice(), credits: FOUNDER_CREDITS_PER_ROLL }; }, FOUNDER_ROLLS: FOUNDER_ROLLS, ACTIVATE_CROLL_BLOCK: ACTIVATE_CROLL_BLOCK, _setCrollActivation: function (b) { ACTIVATE_CROLL_BLOCK = b; }, crollOn: crollOn, communityRollPlan: communityRollPlan, communityGear: communityGear, ACTIVATE_DEDUP_BLOCK: ACTIVATE_DEDUP_BLOCK, _setDedupActivation: function (b) { ACTIVATE_DEDUP_BLOCK = b; }, ownedCounts: ownedCounts, dampW: dampW, ACTIVATE_TOKENS_BLOCK: ACTIVATE_TOKENS_BLOCK, _setTokensActivation: function (b) { ACTIVATE_TOKENS_BLOCK = b; }, TOKEN_DROP_10K: TOKEN_DROP_10K, tokensOf: function (w, owner) { return (w && w.tokens && w.tokens[owner]) || 0; }, ACTIVATE_FEEDM_BLOCK: ACTIVATE_FEEDM_BLOCK, _setFeedmActivation: function (b) { ACTIVATE_FEEDM_BLOCK = b; }, rollQueue: rollQueue, communityFeedPlan: communityFeedPlan,
    autoEquipOps: autoEquipOps, outfitOps: outfitOps, outfitReport: outfitReport, hideAtOrBelow: hideAtOrBelow, familyTree: familyTree, buildTag: buildTag, wornOf: wornOf, myRanks: myRanks, kitWith: kitWith, breedPicker: breedPicker,
    HYBRID_NAMES: HYBRID_NAMES, HYBRID_CHANCE_10K: HYBRID_CHANCE_10K, HYBRID_RARITY_UP_10K: HYBRID_RARITY_UP_10K, HYBRID_TRUE_10K: HYBRID_TRUE_10K, isHybrid: isHybrid, hybridKey: hybridKey, hybridRoots: hybridRoots,
    hybridName: hybridName, speciesLabel: speciesLabel, samePairHybridRule: samePairHybridRule, hybridSpecies: hybridSpecies, hybridPlan: hybridPlan, hybridRender: hybridRender, hybridFrames: hybridFrames, castHybrids: castHybrids };
});
