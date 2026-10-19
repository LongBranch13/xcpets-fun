/*!
 * XCPETS v2 game rules (live game). Rules only: nothing here signs or broadcasts.
 * Pure + deterministic: world = replay(rows, blockHashes, ops, opts). rows = destroy rows {tx_hash, block_index, source, amount, tag};
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
  var FEE_SATS = 1500;                 // fallback BTC miner fee estimate per burn tx (sats)
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
  /* List feed (2026-10-19, scattered-feeding fix): pet:fl:ID.ID.ID… feeds the listed pets in ONE burn. IDs are base 32 (0-9 A-V, case-insensitive,
   * no leading zero), joined by '.', strictly ascending, at least 2, whole tag <= 34 bytes. Valued and validated exactly like pet:fm: pets in
   * ascending id order, each takes its own meal from the burn, a pet that can't be fed (or that the rest of the burn can't pay for) is skipped.
   * Inert before FEED_LIST_BLOCK: before it a pet:fl tag replays exactly as today (unknown pet: tag, community food only).
   * Activation block set at deploy (chain tip + 6). */
  var FEED_LIST_BLOCK = 972132;    // set at deploy 2026-10-19: chain tip 972126 + 6 (Counterparty API 972126, Bitcoin 972126)
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
  var COMMUNITY_GOAL = 1111111, COMMUNITY_GOAL_NAME = 'community goal', COMMUNITY_PET = 'community pet', COMMUNITY_WIZARD_NAME = 'Bitcoin Wizard', BURN_ADDRESS = null;  // not shown to players (no spoilers)
  // totals are float sums of 8-decimal amounts: round to 1e-8 so 1,111,111 exactly always fires and the counter shows clean numbers
  function returnProgress(burned) { var b = Math.round(Math.max(0, Number(burned) || 0) * 1e8) / 1e8, x = Math.min(b, COMMUNITY_GOAL); return { count: x, goal: COMMUNITY_GOAL, pct: x / COMMUNITY_GOAL, done: b >= COMMUNITY_GOAL }; }
  var STAGE_NAMES = ['Egg', 'Hatchling', 'Juvenile', 'Adult', 'Elder', 'Mythic'];
  var V2_SLOTS = ['head', 'hand', 'body', 'back', 'face', 'feet'];  // unlock order (capacity n => first n slots)
  // display names only (internal keys unchanged; body and back stay separate slots). No emojis.
  var SLOT_LABELS = { head: 'Headwear', face: 'Guise', back: 'Drip', hand: 'Grip', body: 'Outfits', feet: 'Footwear' };
  function slotLabel(sl) { return SLOT_LABELS[sl] || String(sl); }
  /* Slot-name codes for pet:c:roll:SLOT (2026-10-16): from ACTIVATE_SLOTNAME_BLOCK the tag also accepts the player-facing slot names
   * HEADWEAR / GRIP / OUTFITS / DRIP / GUISE / FOOTWEAR (same slots as HEAD / HAND / BODY / BACK / FACE / FEET, which stay valid forever).
   * Before the block a name code is an unknown tag (community food), exactly as it always was. */
  var ACTIVATE_SLOTNAME_BLOCK = 971773; // tip 971,767 + 6 at push time (2026-10-16)
  var SLOT_NAME_CODES = { HEADWEAR: 'head', GRIP: 'hand', OUTFITS: 'body', DRIP: 'back', GUISE: 'face', FOOTWEAR: 'feet' };
  var BLACK_EYE_BLOCKS = 72, FIGHT_WINDOW = 144, FIGHT_TURNS = 12;
  var BREED_COOLDOWN = 1008, BREED_MAX = 3, BREED_WINDOW = 144;
  var ACTIVATE_BREED_UNCAPPED_BLOCK = 971789; // RULE (gated, owner approved 2026-10-16): no breeding cap from this block (tip 971,783 + 6); before it, max BREED_MAX breedings as before
  function breedCapOn(b) { return b == null || b < ACTIVATE_BREED_UNCAPPED_BLOCK; }
  var RARITY_UP_10K = 500, RARITY_HIGH_10K = 3000;                  // 5% one tier above best parent; 30% the higher parent; else the lower
  var TIER_LABELS = ['Common', 'Uncommon', 'Rare', 'Legendary'];
  var NAKAMOTO_CAST_STAGE = 3;         // Nakamoto joins the front-page Cast once any hatched Nakamoto reaches this stage (3 = Adult; set 5 for Mythic)
  /** castShowsNakamoto(w): true once any hatched Nakamoto (dead/released ones count: they reached it) is at NAKAMOTO_CAST_STAGE or higher. */
  function castShowsNakamoto(w) { return !!(w && w.pets || []).some(function (p) { return p.species === 'nakamoto' && p.stage >= NAKAMOTO_CAST_STAGE; }); }

  // ---------------------------------------------------------------- helpers
  function sha(s) { return PetCore.sha256Hex(String(s)); }
  function stream(seed) { var n = 0, buf = '', i = 0; return function () { if (i + 8 > buf.length) { buf = sha(seed + ':' + (n++)); i = 0; } var v = parseInt(buf.slice(i, i + 8), 16); i += 8; return v; }; }
  function day(b) { return Math.floor(b / BLOCKS_PER_DAY); }
  /* Rumble off (Jake 2026-10-16): from ACTIVATE_RUMBLE_OFF_BLOCK a pet:rumble burn is not an entry (it still burns and feeds the community pet like
   * any stray burn). A rumble whose entries were made before the block still resolves normally at its seed block. Before the block: unchanged. */
  var ACTIVATE_RUMBLE_OFF_BLOCK = 971771; // tip 971,765 + 6 at push time (Jake approved 2026-10-16)
  function rumbleOff(b) { return b != null && b >= ACTIVATE_RUMBLE_OFF_BLOCK; }
  function weekOf(b) { return Math.floor(b / WEEK); }
  function seedBlockOfWeek(w) { return (w + 1) * WEEK; }
  function utf8Len(s) { return unescape(encodeURIComponent(s)).length; }

  // ---------------------------------------------------------------- species (13)
  var SPECIES13 = PetCore.SPECIES.filter(function (s) { return !s.community; }).map(function (s) { return { id: s.id, label: s.label, w: s.w }; });
  SPECIES13.push({ id: 'nakamoto', label: 'Nakamoto', w: 5 });     // 13th hatchable species (rare-ish weight like KEVIN/Lenny)
  function pickSpecies(hex) { var tot = SPECIES13.reduce(function (a, s) { return a + s.w; }, 0), r = parseInt(hex.slice(0, 8), 16) % tot;
    for (var i = 0; i < SPECIES13.length; i++) { if (r < SPECIES13[i].w) return SPECIES13[i].id; r -= SPECIES13[i].w; } return SPECIES13[0].id; }
  /* Hatched Nakamoto: normal growth + breeding (Jake approved 2026-10-15). From ACTIVATE_NAKA_NORMAL_BLOCK a hatched (or bred) Nakamoto uses the
   * standard THRESHOLDS / MEAL_SIZES (its stage is recomputed from total care, so existing ones may jump stages) and can breed like any species
   * (child species by the normal 50/50 parent rule). Before the block: exactly the old 10x thresholds and 'Nakamoto cannot breed'.
   * The community pet (p.community) and WIZARD_THRESHOLDS are unaffected. b omitted => old behaviour (pre-activation). */
  var ACTIVATE_NAKA_NORMAL_BLOCK = 971659;  // Bitcoin tip 971,653 at 2026-10-15 21:55 CT + 6 (Jake approved)
  /* Nakamoto 1 in 777, always Legendary (Jake approved 2026-10-15, option D). From ACTIVATE_NAKA_777_BLOCK every hatch (single, dozen, case) first draws
   * sha(bh + id + 'XCPETS:v2:naka777') mod 777 == 0 -> Nakamoto; otherwise the species comes from the other 12 with their SPECIES13 weights (total 99).
   * A hatched Nakamoto is forced Legendary: tier, stats and every tier-weighted look come from the SAME seed rolled at tier 3 (exactly what a naturally
   * Legendary pet with that seed gets). A breed child whose species comes out Nakamoto is also forced Legendary (tier only; stats stay parent-derived).
   * Before the block: exactly the old 13-way pick (Nakamoto 5/104, any tier). Existing pets keep their tier. Community pet / Wizard untouched. */
  var ACTIVATE_NAKA_777_BLOCK = 971665;  // Bitcoin tip 971,659 at 2026-10-15 22:52 CT + 6 (Jake approved)
  var SPECIES12 = SPECIES13.filter(function (s) { return s.id !== 'nakamoto'; });
  function naka777(b) { return b != null && b >= ACTIVATE_NAKA_777_BLOCK; }
  function pickSpecies12(hex) { var tot = SPECIES12.reduce(function (a, s) { return a + s.w; }, 0), r = parseInt(hex.slice(0, 8), 16) % tot;
    for (var i = 0; i < SPECIES12.length; i++) { if (r < SPECIES12[i].w) return SPECIES12[i].id; r -= SPECIES12[i].w; } return SPECIES12[0].id; }
  /* Tier-gated species (Jake request 2026-10-15). From ACTIVATE_TIER_SPECIES_BLOCK a hatched egg that is not the 1-in-777 Nakamoto keeps its rolled tier
   * and picks its species from that tier's pool, seed sha(bh + id + 'XCPETS:v2:tierspecies'): a species is eligible when its unlock tier t <= the egg's tier,
   * weight w, x4 in its own unlock tier (the pre-v2 PetCore rule). Original 7 keep their pet-core unlock tiers; the v2 five are a PROPOSAL for Jake
   * (Peepo/Doge Common, Sarutobi/Lenny Uncommon, KEVIN Rare). Nakamoto is never in the pool. Before the block: unchanged. Existing pets are never re-tiered. */
  var ACTIVATE_TIER_SPECIES_BLOCK = 971669;  // Bitcoin tip 971,663 at 2026-10-15 23:18 CT + 6 (Jake approved)
  var TIER_UNLOCK = { pepe: 0, wojak: 0, chud: 0, bobo: 1, mumu: 1, snibby: 2, dodo: 3, peepo: 0, doge: 0, sarutobi: 1, lenny: 1, kevin: 2 };
  function tierSpeciesOn(b) { return b != null && b >= ACTIVATE_TIER_SPECIES_BLOCK; }
  /* Legendary boost (Jake approved 2026-10-16): from ACTIVATE_LEG_BOOST_BLOCK the Legendary-tier pool uses weights x LEG_SCALE and
   * KEVIN, Sarutobi and Lenny get LEG_BOOST_W each instead of 5 x LEG_SCALE, so P(Legendary X) = 0.03 x 776/777 x 66112/1338336 ~= 1.14999 x (1/777)
   * (~1 in 676 each) and Nakamoto (1 in 777) is the rarest Legendary again. Tier odds, the 777 check and the Common/Uncommon/Rare pools are
   * unchanged; the other Legendary species renormalize slightly. Before the block: exactly the old pool. */
  var ACTIVATE_LEG_BOOST_BLOCK = 971771; // tip 971,765 + 6 at push time (Jake approved 2026-10-16)
  var LEG_SCALE = 10000, LEG_BOOST_W = { kevin: 66112, sarutobi: 66112, lenny: 66112 };
  function legBoostOn(b) { return b != null && b >= ACTIVATE_LEG_BOOST_BLOCK; }
  function tierPool(tierIdx, b) { var boost = tierIdx === 3 && legBoostOn(b); return SPECIES12.filter(function (s) { return TIER_UNLOCK[s.id] <= tierIdx; })
    .map(function (s) { var w = s.w * (TIER_UNLOCK[s.id] === tierIdx ? 4 : 1); if (boost) w = LEG_BOOST_W[s.id] || w * LEG_SCALE; return { id: s.id, label: s.label, w: w }; }); }
  function pickTierSpecies(hex, tierIdx, b) { var P = tierPool(tierIdx, b), tot = P.reduce(function (a, s) { return a + s.w; }, 0), r = parseInt(hex.slice(0, 8), 16) % tot;
    for (var i = 0; i < P.length; i++) { if (r < P[i].w) return P[i].id; r -= P[i].w; } return P[0].id; }
  /* Relabel (Jake request 2026-10-15): from ACTIVATE_TIER_SPECIES_BLOCK every existing pet whose species is below its lowest allowed tier
   * (TIER_UNLOCK; Nakamoto = Legendary, incl. pre-777 hatched Nakamotos) keeps its species but is raised to that tier, once, the first time replay
   * reaches the block (before that block's burns). Stats get the tier bonus difference (PetCore TIERS statBonus 0/3/6/10); looks are kept (every
   * trait rolled at a lower tier is still valid at a higher one); v2 gear slots do not depend on tier. Hybrids and the community pet are untouched.
   * Bred children from the block are floored the same way. Nothing changes before the block, so replays/port-check at the cutoff are identical. */
  function minTierOf(species) { return species === 'nakamoto' ? 3 : (TIER_UNLOCK[species] != null ? TIER_UNLOCK[species] : 0); }
  function raiseTier(o, statsKey) { var m = minTierOf(o.species); if (o.tier == null || o.tier >= m) return null;
    var d = PetCore.TIERS[m].statBonus - PetCore.TIERS[o.tier].statBonus, from = o.tier; Object.keys(o[statsKey]).forEach(function (k) { o[statsKey][k] += d; }); o.tier = m; return { from: from, to: m, bonus: d }; }
  function relabelTiers(w, b) { if (w.tierRelabeled || !tierSpeciesOn(b)) return; w.tierRelabeled = b;
    w.pets.forEach(function (p) { if (p.community || p.hybrid || (p.art && p.art.hybrid)) return; var r = raiseTier(p, 'stats'); if (!r) return;
      if (p.art) { p.art.tierIndex = p.tier; p.art.tier = PetCore.TIERS[p.tier].id; } p.relabeled = { block: b, from: r.from, to: r.to, bonus: r.bonus }; }); }
  var LEG_KEYS = ['tier', 'tierIndex', 'pattern', 'eyes', 'band', 'armor', 'cape', 'weapon', 'crown', 'baseStats'];
  /** hatchArt(bh, id, b): the art for one hatched egg (seed id = tx or tx:i), species set. */
  function hatchArt(bh, id, b) { var art = PetCore.generate({ blockHash: bh, petId: id, blockHeight: b }), spHex = sha(bh + id + 'XCPETS:v2:species');
    if (!naka777(b)) { art.species = pickSpecies(spHex); return art; }
    if (parseInt(sha(bh + id + 'XCPETS:v2:naka777').slice(0, 12), 16) % 777 !== 0) { art.species = tierSpeciesOn(b) ? pickTierSpecies(sha(bh + id + 'XCPETS:v2:tierspecies'), art.tierIndex, b) : pickSpecies12(spHex); return art; }
    var L = PetCore.generate({ blockHash: bh, petId: id, blockHeight: b, community: true }); /* same seed, tier forced 3 */
    LEG_KEYS.forEach(function (k) { art[k] = L[k]; }); if (!art.bgV2) art.background = L.background; art.species = 'nakamoto'; return art; }
  function nakaNormal(b) { return b != null && b >= ACTIVATE_NAKA_NORMAL_BLOCK; }
  function thresholdsFor(species, b) { return species === 'nakamoto' && !nakaNormal(b) ? NAKAMOTO_THRESHOLDS : THRESHOLDS; }
  function mealSizesFor(species, b) { return species === 'nakamoto' && !nakaNormal(b) ? NAKAMOTO_MEAL_SIZES : MEAL_SIZES; }
  /* MYTHIC DISCOUNT (owner request 2026-10-16). From ACTIVATE_MYTHIC_DISCOUNT_BLOCK, once an owner address has a Mythic pet, the Mythic threshold of ALL
   * that owner's pets drops from 69,069 (or the species' own Mythic threshold, if lower stays lower) to 21,000. Ownership rule: the address qualifies at the
   * first block (at/after activation) where it owns a living, non-released, non-community pet at stage 5; it then stays qualified (Mythic pets never starve,
   * pets never change owner, and release is no longer offered). w.mythicOwners[addr] = that block. At qualification every pet of that owner is re-staged
   * at once; later care crossing 21,000 goes Mythic via the normal stage logic. Care is never changed. Lower stage thresholds are untouched; a discounted
   * threshold may sit below Elder/Adult, and stageFor() then jumps straight to Mythic. The community pet (Bitcoin Wizard) is excluded. */
  var ACTIVATE_MYTHIC_DISCOUNT_BLOCK = 971806; // tip 971800 + 6
  var MYTHIC_DISCOUNT_CARE = 21000;
  function mythicDiscountOn(b) { return b != null && b >= ACTIVATE_MYTHIC_DISCOUNT_BLOCK; }
  /** petThresholds(w, p, b): the stage thresholds that apply to pet p at block b (the discounted copy when its owner qualifies). */
  function petThresholds(w, p, b) { var th = thresholdsFor(p.species, b); if (!p || p.community || !mythicDiscountOn(b) || !w || !w.mythicOwners) return th;
    var q = w.mythicOwners[p.owner]; if (q == null || q > b || th[5] <= MYTHIC_DISCOUNT_CARE) return th; th = th.slice(); th[5] = MYTHIC_DISCOUNT_CARE; return th; }
  /** registers p's owner as discount-qualified at block b if p is a living Mythic, and re-stages all that owner's pets. */
  function noteMythicOwner(w, p, b) { if (!mythicDiscountOn(b) || !p || p.community || p.released || p.dead || p.stage !== 5 || !p.owner) return;
    w.mythicOwners = w.mythicOwners || {}; if (w.mythicOwners[p.owner] != null) return; w.mythicOwners[p.owner] = b;
    (w.pets || []).forEach(function (o) { if (o !== p && o.owner === p.owner && !o.community && !o.released) liveAt(w, o, b); }); }
  /* OVERFLOW-TO-ROLLS (owner approved 2026-10-16, same block): once a pet's owner has the discount, the pet earns floor((care - 21,000) / 1,000) free gear
   * rolls (so a first Mythic raised to 69,069 earns 48). Earned minus used (w.overflowUsed[petId], kept on the world, not the pet) = left. Any later care
   * keeps earning at the same rate. Claimed with a pet:of:ID burn (see case 'oroll'). */
  function overflowEarned(w, p, b) { var th = petThresholds(w, p, b); return th[5] === MYTHIC_DISCOUNT_CARE && p.care > MYTHIC_DISCOUNT_CARE ? Math.floor((p.care - MYTHIC_DISCOUNT_CARE) / 1000) : 0; }
  function overflowLeft(w, p, b) { return Math.max(0, overflowEarned(w, p, b) - ((w.overflowUsed && w.overflowUsed[p.id]) || 0)); }
  /** overflowRolls(w, p, pendingTags): what the pet page may offer (after replay, minus this pet's unconfirmed pet:of burns). */
  function overflowRolls(w, p, pendingTags) { if (!p || w.tip == null || !mythicDiscountOn(w.tip)) return { on: false, left: 0, pending: 0 };
    var pend = (pendingTags || []).filter(function (t) { return String(t).toUpperCase() === 'PET:OF:' + p.id; }).length, left = Math.max(0, overflowLeft(w, p, w.tip) - pend);
    return { on: left > 0 && !p.dead && !p.released, left: left, pending: pend, earned: overflowEarned(w, p, w.tip) }; }
  /* GRAVE GEAR (2026-10-19, owner request 7:38 AM CT; REVIEW BRANCH, not live). Default unchanged: a pet that dies of neglect drops its worn gear back into the owner's bag
   * (finish(): on = null). From ACTIVATE_GRAVE_GEAR_BLOCK the owner can opt in, per pet, with a burn they sign themselves: pet:grave:ID (any amount, 1 sat of XCPETS is enough)
   * = "leave the gear it wears on the grave if it dies"; pet:grave:ID:off = cancel. Only while the pet is alive (a dead pet's flag is final). At death a flagged pet keeps
   * every piece it wears at that moment: on stays = the dead pet's id and grave = its id, so the piece can't be equipped elsewhere (applyOp/equipCheck refuse it);
   * the owner still owns and sees it. Before the block a pet:grave tag replays exactly as today (unknown pet: tag, community food). The block must be after the
   * deploy tip and BEFORE the first death block 972,432 (no pet has died yet, so no past result changes). Set at deploy (chain tip + 6). */
  var ACTIVATE_GRAVE_GEAR_BLOCK = 972157; // deploy tip 972151 + 6 (Oct 19 2026 ~8:19 AM CT); must stay < first death block 972432
  function graveOn(b) { return b != null && b >= ACTIVATE_GRAVE_GEAR_BLOCK; }
  function gravePlan(petId, on) { return { tag: 'pet:grave:' + petId + (on === false ? ':off' : ''), amount: COSTS.froll, petId: petId, label: (on === false ? 'Cancel grave gear #' : 'Leave gear on the grave #') + petId }; }
  /** graveLocked(w, g, b): the piece rests on a flagged pet that is dead at block b (left on the grave). */
  function graveLocked(w, g, b) { if (!g) return false; if (g.grave != null) return true; var q = g.on != null ? w.byId[g.on] : null; if (!q || !q.graveGear || !graveOn(q.graveGear)) return false; if (b != null) liveAt(w, q, b); return !!q.dead; }
  function overflowRollPlan(petId) { return { tag: 'pet:of:' + petId, amount: COSTS.froll, petId: petId, label: 'Overflow roll #' + petId }; }
  function mdSweep(w, b) { if (w._mdSwept || !mythicDiscountOn(b)) return; w._mdSwept = true; (w.pets || []).forEach(function (p) { noteMythicOwner(w, p, b); }); }
  function stageFor(care, th) { var s = 0; for (var k = 1; k < 6; k++) if (care >= th[k]) s = k; return s; }
  function mealFor(care, species, b, thOverride) { var th = thOverride || thresholdsFor(species, b), ms = mealSizesFor(species, b); if (care >= th[5]) return 0; if (care < th[1]) return th[1] - care;
    var k = Math.min(4, Math.max(1, stageFor(care, th))); return Math.min(ms[k], Math.min(th[k + 1], th[5]) - care); }
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
    (V2Gear.ITEMS || []).forEach(function (x) { out.push({ id: x.id, label: x.label, slot: x.slot, tier: x.tier, w: x.exclusive ? 5 : 10, src: 'v2', origin: x.origin, exclusive: !!x.exclusive, sig: !!x.exclusive, overlay: true, kind: x.kind, alias: x.alias, since: x.since }); });
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
  function isLegendary(it) { it = typeof it === 'string' ? BY_ID[it] : it; it = view(it); return !!(it && it.exclusive); }
  /* Lenny-only monocle (owner approved 2026-10-16): from ACTIVATE_LENNY_MONOCLE_BLOCK the Lenny-face monocle can only be rolled by / worn on a Lenny
   * (or a hybrid with a Lenny root). Gated because roll pools and worn gear (gear power) feed replay and battles. ELIG_B = the block being replayed
   * (set in handle/applyOp; after replay it stays at the last block, so UI checks use the current rules). At the block, non-Lenny wearers have it
   * taken off (kept owned). On chain at 971,783: 1 owned, worn by a Lenny (#4048), so no pet is affected. */
  var ACTIVATE_LENNY_MONOCLE_BLOCK = 971789, ELIG_B = null; // tip 971,783 + 6
  function monocleLennyOn(b) { return b != null && b >= ACTIVATE_LENNY_MONOCLE_BLOCK; }
  function lennyOk(species) { return hybridRoots(species).indexOf('lenny') >= 0; }
  /* species locks (same pattern): item -> { sp, from }. KEVIN name tag is KEVIN-only from the sig-shuffle block (owner approved 2026-10-16; hybrids with a
   * KEVIN root allowed). Non-matching wearers keep it owned but it is taken off at the block and never drawn (v2-render). rare-card stays open. */
  var SPECIES_LOCK = { 'lenny-monocle': { sp: 'lenny', from: ACTIVATE_LENNY_MONOCLE_BLOCK }, 'name-tag': { sp: 'kevin', from: 971789 /* = ACTIVATE_SIG_SHUFFLE_BLOCK */ },
    'stick': { sp: 'doge', from: 971789 /* = ACTIVATE_SIG_SHUFFLE_BLOCK (owner add-on 2026-10-16): Fetch Stick Doge-only; hybrids with a Doge root allowed; non-Doge wearers unequipped at the block, kept owned */ } };
  function lockedOut(id, species, b) { var L = SPECIES_LOCK[id]; return !!(L && b != null && b >= L.from && hybridRoots(species).indexOf(L.sp) < 0); }
  function monoSweep(w, b) { Object.keys(SPECIES_LOCK).forEach(function (id) { var L = SPECIES_LOCK[id], flag = '_lockSwept_' + id; if (w[flag] || b == null || b < L.from) return; w[flag] = true;
    Object.keys(w.items || {}).forEach(function (k) { var g = w.items[k]; if (g.item !== id || g.on == null) return; var p = w.byId[g.on]; if (p && lockedOut(id, p.species, b)) g.on = null; }); }); }
  /* SIG-GEAR SHUFFLE (owner approved 2026-10-16). From ACTIVATE_SIG_SHUFFLE_BLOCK: the "Wow" bandana leaves Doge's back/Drip ★ slot and becomes an OPEN
   * Outfits (body) piece at tier 1 (its bonus-gear tier), weight 10; Doge's new back ★ is 'sig-doge-cape' (Much-wow cape, tier 3, Doge-only, weight 5),
   * which exists in no roll pool before the block. Tier / slot / exclusivity feed roll pools and gear power, so everything goes through view(it),
   * which applies SHUFFLE only when ELIG_B (the block being replayed) is at/after the block. At the block every owned Wow bandana is re-slotted to
   * Outfits (kept owned); a worn one stays worn only if its pet's Outfits slot is open and empty, else it is taken off. */
  var ACTIVATE_SIG_SHUFFLE_BLOCK = 971789; // tip 971,783 + 6
  function shuffleOn(b) { return b != null && b >= ACTIVATE_SIG_SHUFFLE_BLOCK; }
  var SHUFFLE = { 'wow-bandana': { slot: 'body', tier: 1, w: 10, exclusive: false, sig: false } };
  /* GEAR AUDIT (owner approved 2026-10-16, "1 through 11"). From ACTIVATE_GEAR_AUDIT_BLOCK: the four open look-alike weapons (Red-candle dagger, Green-candle
   * staff, Black Swan quill, Moon rocket) drop from tier 3 to tier 2; Wojak's ash hoodie and the KEVIN name tag move to Outfits (body); Lenny's ★ held is the
   * new 'sig-lenny-teacup' and the old 'sig-lenny-held' (Monocle on a chain) leaves the roll pools (owned copies kept and wearable). Owned copies are
   * re-tiered / re-slotted at the block (gaSweep, shuffleSweep pattern: a worn moved piece stays worn only if the new slot is open and empty). */
  var ACTIVATE_GEAR_AUDIT_BLOCK = 971791; // tip 971,785 + 6
  function gaOn(b) { return b != null && b >= ACTIVATE_GEAR_AUDIT_BLOCK; }
  var GA = { 'red-dagger': { tier: 2 }, 'green-staff': { tier: 2 }, 'swan-quill': { tier: 2 }, 'moon-rocket': { tier: 2 }, 'v2-wojak-cape': { slot: 'body' }, 'name-tag': { slot: 'body' }, 'sig-lenny-held': { noRoll: true } };
  /* STAR GEAR BATCH (owner request 2026-10-16): 12 new OPEN companion pieces (V2Gear.STAR_BATCH, item.since 'star-batch') join the roll pools from
   * ACTIVATE_STAR_BATCH_BLOCK. Before it view() hides them, so every earlier roll replays exactly. No existing item changes; owners keep everything. */
  var ACTIVATE_STAR_BATCH_BLOCK = 971803; // tip 971,797 + 6
  function starBatchOn(b) { return b != null && b >= ACTIVATE_STAR_BATCH_BLOCK; }
  function view(it) { if (!it) return it; if (it.since === 'star-batch' && !starBatchOn(ELIG_B)) return null; if (it.since === 'sig-shuffle' && !shuffleOn(ELIG_B)) return null; if (it.since === 'gear-audit' && !gaOn(ELIG_B)) return null;
    if (shuffleOn(ELIG_B) && SHUFFLE[it.id]) it = Object.assign({}, it, SHUFFLE[it.id]); if (gaOn(ELIG_B) && GA[it.id]) it = Object.assign({}, it, GA[it.id]); return it; }
  /** moveToSlot(w, g, slot): re-slot an owned gear piece at a rule switch-on block. A worn piece stays worn only if its pet has that slot open and
   * nothing else already sits in it; otherwise it is taken off (kept owned). Shared by the sig-shuffle and gear-audit sweeps (refactor 2026-10-16). */
  function moveToSlot(w, g, slot) { var p = g.on != null ? w.byId[g.on] : null;
    if (p) { var other = Object.keys(w.items).some(function (k2) { var o = w.items[k2]; return o !== g && o.on === p.id && o.slot === slot; }); if (other || (p.openSlots || []).indexOf(slot) < 0) g.on = null; }
    g.slot = slot; }
  function gaSweep(w, b) { if (w._gaSwept || !gaOn(b)) return; w._gaSwept = true;
    Object.keys(w.items || {}).forEach(function (k) { var g = w.items[k], nv = GA[g.item]; if (!nv) return; if (nv.tier != null) g.tier = nv.tier;
      if (nv.slot && g.slot !== nv.slot) moveToSlot(w, g, nv.slot); }); }
  function shuffleSweep(w, b) { if (w._shufSwept || !shuffleOn(b)) return; w._shufSwept = true;
    Object.keys(w.items || {}).forEach(function (k) { var g = w.items[k]; if (!SHUFFLE[g.item]) return; var nv = SHUFFLE[g.item];
      moveToSlot(w, g, nv.slot); g.tier = nv.tier; g.legendary = !!nv.exclusive; }); }
  function eligible(it, species) { it = typeof it === 'string' ? itemOf(it) : it; it = view(it); if (!it) return false;
    if (lockedOut(it.id, species, ELIG_B)) return false;
    if (isHybrid(species)) { if (!it.exclusive) return true; var par = species.split(':').slice(1); return it.slot !== 'head' && par.indexOf(it.origin) >= 0; } /* hybrids (Jake's locked spec): shared + both parents' signatures EXCEPT their legendary head pieces */
    return !it.exclusive || it.origin === species; }
  function legendaryOf(species) { return ALL.map(view).filter(function (x) { return x && !x.noRoll && x.exclusive && x.origin === species; }).sort(function (a, b) { return (b.slot === 'head') - (a.slot === 'head'); }); } // head signature first, then the 6 other ★ pieces
  function pool(slot, species, tierIdx) {
    var all = RAW.map(view).filter(function (x) { return x && !x.noRoll && x.slot === slot && eligible(x.alias ? BY_ID[x.alias] : x, species); });
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
  function dampWCalc(w0, c) { var x = w0 * DEDUP_SCALE; for (var i = 0; i < c && x > 1; i++) x = Math.floor(x * DEDUP_NUM / DEDUP_DEN); return Math.max(1, x); }
  var DAMP_MEMO = {}; /* smooth-perf (2026-10-19): dampW is a pure function of (w0, c); remembering answers gives the same integers without the loop */
  function dampW(w0, c) { var k = w0 + '|' + c, v = DAMP_MEMO[k]; if (v === undefined) v = DAMP_MEMO[k] = dampWCalc(w0, c); return v; }

  /* GEAR INDEX (smooth-perf, owner approved 2026-10-19; from the load-investigation prototype). wornOf / ownedCounts / repairGear / finish used to scan
   * every item in w.items on every call (3,600+ items, called per token drop, roll and wear), which made the replay grow quadratically. Every item the
   * replay creates goes through trk(), which keeps a per-world index: pet id -> worn items (kept in creation order = Object.keys(w.items) order, so
   * "first match" / "oldest stays" picks are unchanged) and owner -> item counts. g.on / g.owner become accessors that update the index on write.
   * Same answers, same order, so the replay output is identical (tools/replay-check SAME). A world without the index (built elsewhere) falls back to the scan. */
  function ixOf(w){ if(!w.__ix) Object.defineProperty(w,'__ix',{value:{on:new Map(),own:new Map(),seq:new Map(),n:0},enumerable:false}); return w.__ix; }
  function ixAdd(X,k,g){ var a=X.on.get(k); if(!a){a=[];X.on.set(k,a);} var s=X.seq.get(g),i=a.length; while(i>0&&X.seq.get(a[i-1])>s)i--; a.splice(i,0,g); }
  function ixRem(X,k,g){ var a=X.on.get(k); if(!a)return; var i=a.indexOf(g); if(i>=0)a.splice(i,1); }
  function ixCnt(X,o,it,d){ var m=X.own.get(o); if(!m){m={};X.own.set(o,m);} m[it]=(m[it]||0)+d; }
  function trk(w,g){ var X=ixOf(w); X.seq.set(g,X.n++); var on=g.on, ow=g.owner; ixAdd(X,on,g); ixCnt(X,ow,g.item,1);
    Object.defineProperty(g,'on',{enumerable:true,configurable:true,get:function(){return on},set:function(v){ if(v===on)return; ixRem(X,on,g); on=v; ixAdd(X,on,g); }});
    Object.defineProperty(g,'owner',{enumerable:true,configurable:true,get:function(){return ow},set:function(v){ if(v===ow)return; ixCnt(X,ow,g.item,-1); ow=v; ixCnt(X,ow,g.item,1); }});
    return g; }
  /** reindex(w): build the gear index on a world that has none (e.g. a structured clone restored from the cross-visit cache), in w.items key order. */
  function reindex(w) { if (!w || w.__ix || !w.items) return w; Object.keys(w.items).forEach(function (k) { trk(w, w.items[k]); }); return w; }
  function ownedCountsScan(w, owner) { var m = {}; Object.keys(w.items).forEach(function (k) { var g = w.items[k]; if (g.owner === owner) m[g.item] = (m[g.item] || 0) + 1; }); return m; }
  function ownedCounts(w, owner) { if (!w.__ix) return ownedCountsScan(w, owner); var m = {}, c = w.__ix.own.get(owner) || {}; Object.keys(c).forEach(function (k) { if (c[k] > 0) m[k] = c[k]; }); return m; }
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
    if (a === 'GRAVE' && p.length === 3 && idOk(p[2])) return { action: 'grave', petId: n(2), on: true }; /* grave gear opt-in; inert before ACTIVATE_GRAVE_GEAR_BLOCK */
    if (a === 'GRAVE' && p.length === 4 && idOk(p[2]) && p[3] === 'OFF') return { action: 'grave', petId: n(2), on: false };
    if (a === 'OF' && p.length === 3 && idOk(p[2])) return { action: 'oroll', petId: n(2) }; /* overflow roll (Mythic discount); inert before ACTIVATE_MYTHIC_DISCOUNT_BLOCK */
    if (a === 'FIGHT' && p.length === 4 && idOk(p[2]) && idOk(p[3])) return { action: 'fight', a: n(2), b: n(3) };
    if (a === 'ACCEPT' && p.length === 3 && idOk(p[2])) return { action: 'accept', fightId: n(2) };
    if (a === 'RUMBLE' && p.length === 3 && idOk(p[2])) return { action: 'rumble', petId: n(2) };
    if (a === 'BREED' && p.length === 4 && idOk(p[2]) && idOk(p[3])) return { action: 'breed', a: n(2), b: n(3) };
    if (a === 'FM' && p.length === 4 && idOk(p[2]) && /^[0-9A-V]{1,27}$/.test(p[3])) { var fids = [];
      for (var q = 0; q < p[3].length; q++) { var fv = parseInt(p[3][q], 32); for (var fb = 0; fb < 5; fb++) if (fv & (1 << fb)) fids.push(n(2) + 5 * q + fb); } return { action: 'feedm', ids: fids }; }
    if (a === 'FL' && p.length === 3 && p[2].length <= MAX_TAG_BYTES - 7 && /^[1-9A-V][0-9A-V]{0,5}(\.[1-9A-V][0-9A-V]{0,5})+$/.test(p[2])) { /* pet:fl (inert before FEED_LIST_BLOCK) */
      var lids = p[2].split('.').map(function (x) { return parseInt(x, 32); });
      for (var li = 1; li < lids.length; li++) if (!(lids[li] > lids[li - 1])) return { action: 'invalid' };
      return { action: 'feedl', ids: lids }; }
    if (a === 'C' && p[2] === 'ROLL' && (p.length === 3 || (p.length === 4 && V2_SLOTS.indexOf(p[3].toLowerCase()) >= 0))) return { action: 'croll', slot: p.length === 4 ? p[3].toLowerCase() : null };
    if (a === 'C' && p[2] === 'ROLL' && p.length === 4 && SLOT_NAME_CODES[p[3]]) return { action: 'croll', slot: SLOT_NAME_CODES[p[3]], nameCode: true }; /* new slot-name codes, valid from ACTIVATE_SLOTNAME_BLOCK */
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
  function gearPower(gear) { return (gear || []).reduce(function (a, g) { var it = view(BY_ID[g.item]); return a + 1 + (it ? it.tier : 0) * 2; }, 0); }
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
    w.freeRolls = {}; w.overflowUsed = {}; w.mythicOwners = {}; w.founderSeen = {}; preRows.forEach(function (r) { w.founderSeen[r.raw ? r.raw.tx_hash : r.tx_hash] = 1; });
    ev.forEach(function (e) {
      grantFounders(w, e.b); relabelTiers(w, e.b); repairGear(w, e.b); maybeRumbles(e.b);
      if (e.op) { applyOp(w, e.op); return; }
      var r = e.r; if (seen[r.tx_hash]) return; seen[r.tx_hash] = 1;
      var amt = Number(r.amount), bh = blockHashes[r.block_index], t = parseTag(r.tag), v2 = r.block_index >= V2_FROM_BLOCK;
      w.community.burned += amt; // EVERY valid burn feeds the community pet (incl. failed actions, fights, rumbles, breeds)
      if (w.community.returnBlock == null && returnProgress(w.community.burned).done) { w.community.returnBlock = r.block_index; w.community.returnTx = r.tx_hash; }
      if (!v2 && (t.action === 'fight' || t.action === 'accept' || t.action === 'rumble' || t.action === 'breed')) { L(r, 'plain', 'before v2 cutoff block ' + V2_FROM_BLOCK + ': plain burn (community food)'); return; }
      handle(w, r, t, amt, bh, L);
    });
    grantFounders(w, tip); relabelTiers(w, tip); repairGear(w, tip); maybeRumbles(tip);
    w.pets.forEach(function (p) { finish(w, p, tip); });
    var rp = returnProgress(w.community.burned), cm = w.community;
    if (rp.done && cm.returnBlock == null) cm.returnBlock = w.cutoff ? w.cutoff.lastLiveBlock : tip; // already past it in the imported live total
    cm.returned = rp.done; cm.returnCount = rp.count; cm.goal = COMMUNITY_GOAL; cm.goalPct = rp.pct;
    cm.wizardFed = rp.done ? cm.burned - COMMUNITY_GOAL : 0; cm.current = rp.done ? 'wizard' : 'nakamoto';
    cm.wizardStage = rp.done ? wizardStage(cm.wizardFed) : 0; cm.wizardStageName = STAGE_NAMES[cm.wizardStage];
    cm.petName = rp.done ? COMMUNITY_WIZARD_NAME : 'Nakamoto'; cm.petRole = COMMUNITY_PET; /* display only (2026-10-16): the wizard community pet is named 'Bitcoin Wizard'; internal id stays 'wizard' */ cm.petStage = rp.done ? cm.wizardStage : 5; cm.petStageName = STAGE_NAMES[cm.petStage];
    w.community.leaderboard = Object.keys(w.community.feeders).map(function (a) { return { address: a, amount: w.community.feeders[a] }; }).sort(function (a, b) { return b.amount - a.amount || (a.address < b.address ? -1 : 1); });
    w.fights.forEach(function (f) { if (f.status === 'open' && tip - f.block > FIGHT_WINDOW) f.status = 'expired'; });
    w.itemList = Object.keys(w.items).map(function (k) { return w.items[k]; });
    return w;
  }
  function liveAt(w, p, b) { // refresh age/death/neglect at block b
    var last = p.lastFed != null ? p.lastFed : p.hatchBlock, th = petThresholds(w, p, b); if (p.clockFrom != null) last = Math.max(last, p.clockFrom); // live pets: live death-clock anchor
    p.mythicCare = p.care >= th[5] || !!p.ascended;
    p.deathBlock = p.mythicCare ? null : (day(last) + NEGLECT_DAYS + 1) * BLOCKS_PER_DAY;
    p.dead = !p.released && p.deathBlock != null && b >= p.deathBlock;
    p.neglected = !p.mythicCare && day(b) - day(last) >= NEGLECTED_AFTER_DAYS;
    p.stage = p.ascended ? 5 : stageFor(p.care, th); p.stageName = STAGE_NAMES[p.stage]; if (p.stage === 5) noteMythicOwner(w, p, b);
    p.ageDays = day(b) - day(p.hatchBlock); p.fedDays = Object.keys(p.feedDays).length;
    p.capacity = capacity(p.ageDays, p.fedDays); p.openSlots = V2_SLOTS.slice(0, p.capacity);
    if (p.liveSlots) { p.liveSlots.forEach(function (sl) { if (p.openSlots.indexOf(sl) < 0) p.openSlots.push(sl); }); p.openSlots.sort(function (a, b) { return V2_SLOTS.indexOf(a) - V2_SLOTS.indexOf(b); }); p.capacity = p.openSlots.length; } // slots = max(live, v2)
  }
  function finish(w, p, tip) {
    liveAt(w, p, tip);
    if (p.dead) { var keep = !!p.graveGear && graveOn(p.graveGear); /* grave gear: a flagged pet keeps what it wore at death (on + grave = its id); default: back to the bag */
      wornOf(w, p.id).forEach(function (g) { if (keep) g.grave = p.id; else g.on = null; }); } /* gear index (smooth-perf): same items taken off, no full scan per dead pet */
    p.fedToday = !!p.feedDays[day(tip)]; p.nextMeal = mealFor(p.care, p.species, tip, petThresholds(w, p, tip)); p.hungry = !p.dead && !p.released && !p.fedToday && p.nextMeal > 0;
    p.blackEye = p.blackEyeUntil != null && tip < p.blackEyeUntil; p.crowned = p.crownUntil != null && tip < p.crownUntil;
  }
  // ---------------------------------------------------------------- live reader + cutoff import (2026-10-14)
  var LIVE_ENGINE = null; function setLiveEngine(e) { LIVE_ENGINE = e || null; }
  /** readBurns(rows): the live burn reader's rules. Only status 'valid' rows (when a status is given); amount = quantity / UNIT (raw API rows) or
   *  the given amount (test rows); duplicates dropped; order = block_index, then tx_index (chain order; rows without tx_index keep their order). r.raw = the API row for the live engine. */
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
      trk(w, w.items[gid] = { gid: gid, item: it.id, label: it.label, slot: it.slot, tier: it.tier, legendary: isLegendary(it), owner: g.owner, on: on, src: 'live', liveGid: g.gid, liveSlot: g.slot, liveItem: g.item, rolledOn: g.rolledOn }); });
    var c = st.community || {}; w.community.burned = c.burned || 0; Object.keys(c.feeders || {}).forEach(function (a) { w.community.feeders[a] = c.feeders[a]; w.community.feeds += c.feeders[a]; });
    w.cutoff = { block: cut /* first v2 block */, lastLiveBlock: cut - 1, pets: all.length, items: (st.items || []).length, burns: c.burns || null };
  }
  /** migrateLoadout(w, owner, lo): a live per-device loadout { petId: { slot: { gid } } } -> v2 equip ops (old slot + item ids mapped; live gid -> 'L' + gid). */
  function migrateLoadout(w, owner, lo, block) { var ops = [];
    Object.keys(lo || {}).forEach(function (pid) { Object.keys(lo[pid] || {}).forEach(function (sl) { var o = lo[pid][sl] || {}, v2sl = CORE_SLOT[sl] || sl;
      ops.push({ kind: 'equip', owner: owner, petId: Number(pid), slot: v2sl, gid: o.gid == null ? null : 'L' + o.gid, block_index: block != null ? block : (w.cutoff ? w.cutoff.block : V2_FROM_BLOCK) }); }); });
    return ops; }
  /* Gear cap repair (2026-10-16, Jake approved). Root cause: the live loadout import mapped the live game's separate band and crown slots both onto v2
   * 'head' (and a later roll could add to it), so a few pets wear two items in one slot: worn count > capacity (e.g. #2393 5/4). From
   * ACTIVATE_GEAR_CAP_BLOCK: once, the first time replay reaches the block (before its burns), every pet keeps at most one worn item per open slot and
   * nothing in a locked slot; the excess goes back to the owner's inventory (unequipped, never deleted), the most recently created item first
   * (item creation order). Logged ('gearfix') on the pet's history and in p.gearFix. Also from the block, wearing an item clears EVERY item in that slot. */
  var ACTIVATE_GEAR_CAP_BLOCK = 971720;  // Bitcoin tip 971,714 at 2026-10-16 08:20 CT + 6 (Jake approved)
  function gearCapOn(b) { return b != null && b >= ACTIVATE_GEAR_CAP_BLOCK; }
  function repairGear(w, b) { if (w.gearRepaired || !gearCapOn(b)) return; w.gearRepaired = b; var ks = Object.keys(w.items);
    w.pets.forEach(function (p) { if (p.community) return; if (p.hatchBlock != null) liveAt(w, p, b); var mine = wornOf(w, p.id), keep = {}, off = [];
      mine.forEach(function (g) { if ((p.openSlots || []).indexOf(g.slot) < 0 || keep[g.slot]) off.push(g); else keep[g.slot] = g; }); /* oldest stays, newer duplicates come off */
      if (!off.length) return; off.forEach(function (g) { g.on = null; });
      p.gearFix = { block: b, items: off.map(function (g) { return g.label || g.item; }) };
      w.log.push({ block: b, tx: null, kind: 'gearfix', petId: p.id, msg: '#' + p.id + ': gear over capacity repaired, back to inventory: ' + p.gearFix.items.join(', ') }); }); }
  function wornOf(w, pid) { if (!w.__ix) return Object.keys(w.items || {}).map(function (k) { return w.items[k]; }).filter(function (g) { return g.on === pid; });
    var a = w.__ix.on.get(pid); return a ? a.slice() : []; }
  function wornIn(w, pid, slot) { return wornOf(w, pid).filter(function (g) { return g.slot === slot; })[0] || null; }
  function newItem(w, it, owner, src) { var gid = 'g' + (w.nextItem++); w.items[gid] = { gid: gid, item: it.id, label: it.label, slot: it.slot, tier: it.tier, legendary: isLegendary(it), owner: owner, on: null, src: src }; trk(w, w.items[gid]); return w.items[gid]; }
  function wear(w, p, g) { if (p.openSlots.indexOf(g.slot) < 0) return false; if (!eligible(g.item, p.species)) return false; var cur = wornIn(w, p.id, g.slot); if (cur) cur.on = null; if (gearCapOn(w._b)) wornOf(w, p.id).forEach(function (x) { if (x.slot === g.slot) x.on = null; }); g.on = p.id; return true; }
  function giveRandomPiece(w, loser, winnerPet, seedHex, why) {
    var take = wornOf(w, loser.id).filter(function (g) { return !g.legendary; }); // legendary species pieces are never takeable
    if (!take.length) return null;
    var g = take[parseInt(seedHex.slice(0, 8), 16) % take.length]; g.on = null; g.owner = winnerPet.owner; g.from = loser.id; g.wonBy = winnerPet.id; g.why = why;
    liveAt(w, winnerPet, w._b || 0); if (!wornIn(w, winnerPet.id, g.slot)) wear(w, winnerPet, g);
    return g;
  }
  function fightable(p, b) { if (!p) return 'no such pet'; if (p.released) return 'released'; if (p.dead) return 'dead'; if (p.stage < 2) return 'Egg/Hatchling pets cannot fight'; if (p.neglected) return 'neglected pets cannot fight'; return null; }
  function breedable(p, b) { if (!p) return 'no such pet'; if (p.released) return 'released'; if (p.dead) return 'dead'; if (p.species === 'nakamoto' && (!nakaNormal(b) || p.community)) return 'Nakamoto cannot breed';
    if (p.community) return 'community pet cannot breed'; if (p.stage < 3) return 'needs Adult+'; if (p.neglected) return 'neglected'; if (breedCapOn(b) && p.breeds >= BREED_MAX) return 'max ' + BREED_MAX + ' breedings';
    if (p.lastBreed != null && b - p.lastBreed < BREED_COOLDOWN) return 'breeding cooldown (' + (BREED_COOLDOWN - (b - p.lastBreed)) + ' blocks left)'; return null; }

  function handle(w, r, t, amt, bh, L) {
    var b = r.block_index, src = r.source; w._b = b; ELIG_B = b; monoSweep(w, b); shuffleSweep(w, b); gaSweep(w, b); mdSweep(w, b);
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
        var art = hatchArt(bh, r.tx_hash, b), sp = art.species;
        var p = mk(w, src, noBornShades(art), b, COSTS.hatch, r.tx_hash);
        var hl = L(r, 'hatch', 'hatched #' + p.id + ' ' + sp, { petId: p.id }); token(p, 'stageUp'); return hl;
      }
      case 'pack': {
        if (amt < t.cost) return L(r, 'rejected', 'below pack price ' + t.cost);
        if (!bh) return L(r, 'rejected', 'block hash pending');
        var first = w.nextPet; for (var i = 0; i < t.n; i++) { var a2 = hatchArt(bh, r.tx_hash + ':' + i, b); mk(w, src, noBornShades(a2), b, COSTS.hatch, r.tx_hash + ':' + i); }
        var pl = L(r, 'hatch', 'pack hatched #' + first + '-#' + (w.nextPet - 1)); for (var pi = first; pi < w.nextPet; pi++) token(w.byId[pi], 'stageUp'); return pl;
      }
      case 'cfeed': {
        if (!validFeedAmount(amt, b)) return L(r, 'rejected', 'community feed min ' + (b < V2_FROM_BLOCK ? COSTS.feedMinV1 : COSTS.feedMin) + ' (burn still feeds the community pet)');
        w.community.feeds += amt; w.community.feeders[src] = (w.community.feeders[src] || 0) + amt;
        return L(r, 'cfeed', 'fed ' + COMMUNITY_PET + ' ' + amt);
      }
      case 'feed': {
        var q = pet(t.petId), why = !q ? 'no such pet' : q.released ? 'released' : q.owner !== src ? 'owner only' : q.dead ? 'dead (Pet Cemetery)' : q.feedDays[day(b)] ? 'already fed this day' : mealFor(q.care, q.species, b, petThresholds(w, q, b)) === 0 ? 'fully fed' : amt < mealFor(q.care, q.species, b, petThresholds(w, q, b)) ? 'below meal ' + mealFor(q.care, q.species, b, petThresholds(w, q, b)) : null;
        if (why) return L(r, 'rejected', why);
        var qs = q.stage; q.care += mealFor(q.care, q.species, b, petThresholds(w, q, b)); q.feedDays[day(b)] = 1; q.lastFed = b; liveAt(w, q, b);
        var fl = L(r, 'feed', 'fed #' + q.id + ' (care ' + q.care + ')', { petId: q.id }); token(q, q.stage > qs ? 'stageUp' : 'meal'); return fl;
      }
      case 'feedl': if (b < FEED_LIST_BLOCK) return L(r, 'rejected', 'unknown pet: tag (community food)'); /* falls through: same valuation/validation as feedm */
      case 'feedm': {  /* pets in ascending id order, each takes its own meal from the burn; a pet that can't be fed (or that the rest of the burn can't pay for) is skipped */
        if (t.action === 'feedm' && b < ACTIVATE_FEEDM_BLOCK) return L(r, 'rejected', 'unknown pet: tag (community food)');
        var left = amt, fed = [], skip = [], up = {};
        t.ids.forEach(function (id) { var z = pet(id), m = z ? mealFor(z.care, z.species, b, petThresholds(w, z, b)) : 0,
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
        if (rumbleOff(b)) return L(r, 'rejected', 'Royal Rumble entries are off (retired): plain burn (community food)');
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
        if (t.nameCode && b < ACTIVATE_SLOTNAME_BLOCK) return L(r, 'rejected', 'unknown pet: tag (community food)');
        if (amt < COSTS.croll) return L(r, 'rejected', 'below community roll cost ' + COSTS.croll + ' (burn still feeds the community pet)');
        if (!bh) return L(r, 'rejected', 'block hash pending');
        var ch = sha(bh + r.tx_hash + 'XCPETS:v2:community-roll'), cs = t.slot || V2_SLOTS[parseInt(ch.slice(16, 24), 16) % V2_SLOTS.length], ci = pickItem(ch, cs, 'nakamoto', 3, b >= ACTIVATE_DEDUP_BLOCK ? communityCounts(w) : null);
        if (!ci) return L(r, 'rejected', 'no community gear for ' + slotLabel(cs));
        var cg = { item: ci.id, label: ci.label, slot: ci.slot, tier: ci.tier, legendary: isLegendary(ci), block: b, tx: r.tx_hash, by: src };
        w.community.gear[ci.slot] = cg; w.community.gearLog.push(cg);
        return L(r, 'croll', 'community roll: the community pet got ' + ci.label + ' (' + slotLabel(ci.slot) + ')', { item: ci.id, slot: ci.slot });
      }
      case 'invalid': return L(r, 'rejected', 'unknown pet: tag (community food)');
      case 'grave': {  /* GRAVE GEAR opt-in / cancel (see ACTIVATE_GRAVE_GEAR_BLOCK): owner only, living pet only, any amount */
        if (!graveOn(b)) return L(r, 'rejected', 'unknown pet: tag (community food)');
        var gq = pet(t.petId), gw = !gq ? 'no such pet' : gq.community ? 'community pet' : gq.released ? 'released' : gq.owner !== src ? 'owner only' : gq.dead ? 'dead (Pet Cemetery): too late to change' : null;
        if (gw) return L(r, 'rejected', gw);
        if (t.on) { gq.graveGear = b; gq.graveTx = r.tx_hash; } else { delete gq.graveGear; delete gq.graveTx; }
        return L(r, 'grave', t.on ? '#' + gq.id + ': worn gear stays on the grave if it dies' : '#' + gq.id + ': grave gear cancelled (gear goes back to the bag at death)', { petId: gq.id });
      }
      case 'oroll': {  /* OVERFLOW ROLL (Mythic discount): pet:of:ID, any amount (1 sat of XCPETS is enough), signed by the owner. Spends one of the pet's overflow rolls
         * (floor((care - 21,000) / 1,000) once the owner's discount applies, minus rolls used). Same gear roll as pet:roll, seeded from block hash + tx id with its own salt. */
        if (!mythicDiscountOn(b)) return L(r, 'rejected', 'unknown pet: tag (community food)');
        var og = pet(t.petId), ow = !og ? 'no such pet' : og.community ? 'community pet' : og.released ? 'released' : og.owner !== src ? 'owner only' : og.dead ? 'dead' : !(overflowLeft(w, og, b) > 0) ? 'no overflow rolls left' : !bh ? 'block hash pending' : null;
        if (ow) return L(r, 'rejected', ow);
        var oh = sha(bh + r.tx_hash + 'XCPETS:v2:overflow-roll'), osl = og.openSlots[parseInt(oh.slice(16, 24), 16) % og.openSlots.length], oit = pickItem(oh, osl, og.species, og.tier, dedupFor(w, b, og.owner));
        w.overflowUsed[og.id] = (w.overflowUsed[og.id] || 0) + 1; var oni = newItem(w, oit, og.owner, 'oroll'); oni.rolledOn = og.id; wear(w, og, oni);
        return L(r, 'roll', '#' + og.id + ' overflow roll: ' + oit.label + ' (' + slotLabel(osl) + ') · ' + overflowLeft(w, og, b) + ' overflow rolls left', { petId: og.id, gid: oni.gid, free: true });
      }
      default: return L(r, 'plain', 'plain burn (community food)');
    }
  }
  /* Jake 2026-10-14: black sunglasses are GEAR only ('v2-bobo-face' "Shades"), never a born trait. v2 births (hatch / pack / breed / hybrids)
   * go through noBornShades: Bobo's DNA shades trait is forced off (pet.shades = false) and the 'beady' eye trait (label "Sunglasses",
   * same tier 0 as 'classic') becomes 'classic'. pet-core.js is untouched; pre-cutoff pets come from the frozen live engine and keep theirs. */
  function noBornShades(art) { art.shades = false; if (art.eyes === 'beady') art.eyes = 'classic'; if (art.hybrid && art.hybrid.eyes === 'beady') art.hybrid.eyes = 'classic'; return art; }
  /** bornTraits(pet, stage): the birth traits the generator assigned, as drawn (v2 overrides applied: no born sunglasses after the cutoff). Read-only. */
  function bornTraits(p, stage) { if (!p || !p.art || !PetCore.describe) return [];
    var art = Object.assign({}, p.art, { species: p.hybrid ? p.hybrid.shape || p.species : p.species }), d = {}; try { d = PetCore.describe(art, stage == null ? 3 : stage) || {}; } catch (e) { d = {}; }
    var rows = [['Pattern', d.Pattern], ['Eye trait', d.Eyes], ['Cheeks', d.Cheeks], ['Background', d.Background], ['Background colour', p.art.bgColor], ['Expression', d.Expression]];
    if (d.Shades && d.Shades !== 'None') rows.splice(2, 0, ['Shades', d.Shades]);
    if (p.breedBonus) rows.push(['Bred-true bonus', p.breedBonus.label]);
    if (p.hybrid) rows.unshift(['Hybrid', speciesLabel(p.hybrid.a || p.hybrid.shape) + ' × ' + speciesLabel(p.hybrid.b || p.hybrid.color)]);
    return rows.filter(function (r) { return r[1] != null && r[1] !== ''; }); }
  function mk(w, owner, art, b, care, tx) {
    var p = { id: w.nextPet++, owner: owner, art: art, species: art.species, tier: art.tierIndex, stats: Object.assign({}, art.baseStats), name: art.defaultName, care: care, hatchBlock: b, hatchTx: tx,
      lastFed: null, feedDays: {}, fightDays: {}, breeds: 0, lastBreed: null, parents: null, children: [], wins: 0, losses: 0, trophies: [] };
    w.pets.push(p); w.byId[p.id] = p; liveAt(w, p, b); return p;
  }
  // ---------------------------------------------------------------- HYBRIDS (v2, 2026-10-14)
  // HYBRID_NAMES: display name per ORDERED pair 'parentA:parentB' (A = the requester / first pet). 13 x 12 = 156 entries; the 24 Nakamoto pairs
  // are reachable from block 971,674 (ACTIVATE_HYBRID_RATE_BLOCK: all pets can hybrid). Names are mashups of both parents (renamed 2026-10-16);
  // display-only: keys, replay and pet records never use them. Keep names unique and never equal to a species name.
  var HYBRID_NAMES = {
    'pepe:wojak': 'Pejak', 'pepe:chud': 'Pechud', 'pepe:bobo': 'Pebo', 'pepe:mumu': 'Pemu', 'pepe:snibby': 'Pebby', 'pepe:dodo': 'Pepodo', 'pepe:kevin': 'Pevin', 'pepe:peepo': 'Pepeep', 'pepe:sarutobi': 'Pebi', 'pepe:doge': 'Pege', 'pepe:lenny': 'Pelen', 'pepe:nakamoto': 'Peto',
    'wojak:pepe': 'Wope', 'wojak:chud': 'Wochud', 'wojak:bobo': 'Wobo', 'wojak:mumu': 'Womu', 'wojak:snibby': 'Wobby', 'wojak:dodo': 'Wodo', 'wojak:kevin': 'Wovin', 'wojak:peepo': 'Wopo', 'wojak:sarutobi': 'Wobi', 'wojak:doge': 'Woge', 'wojak:lenny': 'Wolen', 'wojak:nakamoto': 'Woto',
    'chud:pepe': 'Chupe', 'chud:wojak': 'Chujak', 'chud:bobo': 'Chubo', 'chud:mumu': 'Chumu', 'chud:snibby': 'Chusnib', 'chud:dodo': 'Chudo', 'chud:kevin': 'Chuvin', 'chud:peepo': 'Chupo', 'chud:sarutobi': 'Chubi', 'chud:doge': 'Chuge', 'chud:lenny': 'Chulen', 'chud:nakamoto': 'Chuto',
    'bobo:pepe': 'Bope', 'bobo:wojak': 'Bojak', 'bobo:chud': 'Bochud', 'bobo:mumu': 'Bomu', 'bobo:snibby': 'Bosnib', 'bobo:dodo': 'Bodo', 'bobo:kevin': 'Bovin', 'bobo:peepo': 'Bopo', 'bobo:sarutobi': 'Bobi', 'bobo:doge': 'Boge', 'bobo:lenny': 'Bolen', 'bobo:nakamoto': 'Bomoto',
    'mumu:pepe': 'Mupe', 'mumu:wojak': 'Mujak', 'mumu:chud': 'Muchud', 'mumu:bobo': 'Mubo', 'mumu:snibby': 'Mubby', 'mumu:dodo': 'Mudod', 'mumu:kevin': 'Muvin', 'mumu:peepo': 'Mupo', 'mumu:sarutobi': 'Mubi', 'mumu:doge': 'Muge', 'mumu:lenny': 'Mulen', 'mumu:nakamoto': 'Mumoto',
    'snibby:pepe': 'Snipe', 'snibby:wojak': 'Snijak', 'snibby:chud': 'Snichud', 'snibby:bobo': 'Snibo', 'snibby:mumu': 'Snimu', 'snibby:dodo': 'Snido', 'snibby:kevin': 'Snivin', 'snibby:peepo': 'Snipo', 'snibby:sarutobi': 'Snibi', 'snibby:doge': 'Snige', 'snibby:lenny': 'Snilen', 'snibby:nakamoto': 'Snito',
    'dodo:pepe': 'Dopep', 'dodo:wojak': 'Dojak', 'dodo:chud': 'Dochud', 'dodo:bobo': 'Dobo', 'dodo:mumu': 'Domu', 'dodo:snibby': 'Dosnib', 'dodo:kevin': 'Dovin', 'dodo:peepo': 'Dopeep', 'dodo:sarutobi': 'Dobi', 'dodo:doge': 'Dodog', 'dodo:lenny': 'Dolen', 'dodo:nakamoto': 'Doto',
    'kevin:pepe': 'Kepe', 'kevin:wojak': 'Kejak', 'kevin:chud': 'Kechud', 'kevin:bobo': 'Kebo', 'kevin:mumu': 'Kemu', 'kevin:snibby': 'Kebby', 'kevin:dodo': 'Kedo', 'kevin:peepo': 'Kepo', 'kevin:sarutobi': 'Kebi', 'kevin:doge': 'Kege', 'kevin:lenny': 'Kelen', 'kevin:nakamoto': 'Kemoto',
    'peepo:pepe': 'Peepep', 'peepo:wojak': 'Peejak', 'peepo:chud': 'Peechud', 'peepo:bobo': 'Peebo', 'peepo:mumu': 'Peemu', 'peepo:snibby': 'Peebby', 'peepo:dodo': 'Peedo', 'peepo:kevin': 'Peevin', 'peepo:sarutobi': 'Peebi', 'peepo:doge': 'Peege', 'peepo:lenny': 'Peelen', 'peepo:nakamoto': 'Peeto',
    'sarutobi:pepe': 'Sape', 'sarutobi:wojak': 'Sajak', 'sarutobi:chud': 'Sachud', 'sarutobi:bobo': 'Sabo', 'sarutobi:mumu': 'Samu', 'sarutobi:snibby': 'Sabby', 'sarutobi:dodo': 'Sadod', 'sarutobi:kevin': 'Savin', 'sarutobi:peepo': 'Sapeep', 'sarutobi:doge': 'Sadoge', 'sarutobi:lenny': 'Salen', 'sarutobi:nakamoto': 'Samoto',
    'doge:pepe': 'Dogpe', 'doge:wojak': 'Dogjak', 'doge:chud': 'Dogchud', 'doge:bobo': 'Dogbo', 'doge:mumu': 'Dogmu', 'doge:snibby': 'Dogsnib', 'doge:dodo': 'Dogdo', 'doge:kevin': 'Dogvin', 'doge:peepo': 'Dogpeep', 'doge:sarutobi': 'Dogtobi', 'doge:lenny': 'Doglen', 'doge:nakamoto': 'Dogmoto',
    'lenny:pepe': 'Lepe', 'lenny:wojak': 'Lejak', 'lenny:chud': 'Lechud', 'lenny:bobo': 'Lebo', 'lenny:mumu': 'Lemu', 'lenny:snibby': 'Lebby', 'lenny:dodo': 'Ledo', 'lenny:kevin': 'Lekev', 'lenny:peepo': 'Lepo', 'lenny:sarutobi': 'Lebi', 'lenny:doge': 'Lege', 'lenny:nakamoto': 'Leto',
    'nakamoto:pepe': 'Napep', 'nakamoto:wojak': 'Najak', 'nakamoto:chud': 'Nachud', 'nakamoto:bobo': 'Nabo', 'nakamoto:mumu': 'Namu', 'nakamoto:snibby': 'Nabby', 'nakamoto:dodo': 'Nadod', 'nakamoto:kevin': 'Navin', 'nakamoto:peepo': 'Napo', 'nakamoto:sarutobi': 'Nabi', 'nakamoto:doge': 'Nage', 'nakamoto:lenny': 'Nalen'
  };
  var HYBRID_CHANCE_10K = 1500;      // LEGACY (blocks 971,501-971,673 only, kept so those breeds replay exactly): old 15% cross-species hybrid rate
  var HYBRID_RARITY_UP_10K = 1000;   // hybrid rarity = higher parent's tier; 10% one tier up (capped at Legendary)
  /* Hybrid rate (Jake 2026-10-16, "all pets can hybrid"): from ACTIVATE_HYBRID_RATE_BLOCK two DIFFERENT purebred species (Nakamoto included) breed a
   * hybrid with probability exactly 684773435 / 1e9 (68.4773435%), replacing HYBRID_CHANCE_10K and the Nakamoto exclusion. stream() gives 32-bit draws, and
   * 2^32 mod 1e9 would bias the result by ~3 points, so after activation TWO draws are combined into a 53-bit integer (x = d1 * 2^21 + (d2 >>> 11)),
   * then x mod 1e9: bias < 1e9 / 2^53 ~ 1.1e-7. Before the block the old single 10K draw (and no draw for Nakamoto pairs) is used, so replays are identical.
   * Same-species pairs stay purebred; hybrid-parent rules unchanged. */
  var ACTIVATE_HYBRID_RATE_BLOCK = 971674;  // Bitcoin tip 971,668 at 2026-10-16 00:14 CT + 6 (Jake approved)
  var HYBRID_RATE_1E9 = 684773435;
  function hybridRateOn(b) { return b != null && b >= ACTIVATE_HYBRID_RATE_BLOCK; }
  function draw1e9(R) { var hi = R(), lo = R() >>> 11; return (hi * 2097152 + lo) % 1e9; }
  /* Bred-true bonus (Jake 2026-10-16, PROPOSAL pool): from ACTIVATE_HYBRID_RATE_BLOCK every same-species purebred breed (incl. Nakamoto x Nakamoto)
   * gives exactly one bonus, from its own stream sha-seeded 'XCPETS:v2:breed-bonus:' + hex (no existing draw moves). Pool (weights of 100):
   *   stat 50: +BRED_TRUE_STAT to one random stat;  pattern 30: the rarest pattern allowed at the child's tier (t <= tier) it doesn't already have;
   *   eyes 20: the rarest eye trait allowed at its tier it doesn't have (never Sunglasses/'beady': no born shades after the cutoff).
   * Laser eyes / Galaxy / Rainbow only for Legendary children, Star / Checker / Two-tone from Rare, etc. (PetCore t rule). If no new trait is allowed
   * (e.g. a Common child already on Classic eyes), it falls back to the stat bonus. The game has no shiny/sparkle effect, so none is offered. */
  var BRED_TRUE_STAT = 3, BRED_TRUE_POOL = [{ k: 'stat', w: 50 }, { k: 'pattern', w: 30 }, { k: 'eyes', w: 20 }];
  /* Breed fix (Jake approved drafting 2026-10-16). From ACTIVATE_BREED_FIX_BLOCK, for EVERY breed (same species, cross-species, hybrids):
   * (1) CAP: every tier-gated born trait of the baby (pattern, eyes, band, armor, cape, weapon, crown, background from PetCore.BACKGROUNDS, and a
   *     hybrid's plan eyes) whose unlock tier t is above the baby's FINAL tier is replaced by the first-listed option at the highest t <= that tier
   *     (deterministic, no randomness). Traits already allowed are untouched. Applied before the bred-true bonus.
   * (2) BONUS: the bred-true pattern / eye bonus applies only if the chosen option is a strict upgrade (higher t) over the (capped) trait;
   *     otherwise the SAME draw x gives the +BRED_TRUE_STAT stat bonus. The bonus can never downgrade, side-grade or no-op.
   * Before the block: byte-identical to the old behaviour. Forward-only: no migration of existing babies. */
  var ACTIVATE_BREED_FIX_BLOCK = 971772; // tip 971766 + 6 at push time (Jake approved 2026-10-16)
  function breedFixOn(b) { return b != null && b >= ACTIVATE_BREED_FIX_BLOCK; }
  var CAP_POOLS = { pattern: 'PATTERNS', eyes: 'EYES', band: 'BANDS', armor: 'ARMORS', cape: 'CAPES', weapon: 'WEAPONS', crown: 'CROWNS', background: 'BACKGROUNDS' };
  function capOne(pool, id, tier) { var cur = pool.filter(function (o) { return o.id === id; })[0]; if (!cur || cur.t <= tier) return id;
    var ok = pool.filter(function (o) { return o.t <= tier; }), top = Math.max.apply(null, ok.map(function (o) { return o.t; })); return ok.filter(function (o) { return o.t === top; })[0].id; }
  /** capTraits(art, tier) -> [{trait, from, to}] (mutates art). */
  function capTraits(art, tier) { var out = [];
    Object.keys(CAP_POOLS).forEach(function (k) { var pool = PetCore[CAP_POOLS[k]]; if (!pool || art[k] == null) return; var v = capOne(pool, art[k], tier); if (v !== art[k]) { out.push({ trait: k, from: art[k], to: v }); art[k] = v; } });
    if (art.hybrid && art.hybrid.eyes != null) { var he = capOne(PetCore.EYES, art.hybrid.eyes, tier); if (he !== art.hybrid.eyes) { out.push({ trait: 'hybrid.eyes', from: art.hybrid.eyes, to: he }); art.hybrid.eyes = he; } }
    return out; }
  function tOf(pool, id) { var o = pool.filter(function (q) { return q.id === id; })[0]; return o ? o.t : -1; }
  function bredTrueBonus(hex, art, tier, stats, fix) { var R = stream('XCPETS:v2:breed-bonus:' + hex), r = R() % 100, kind = 'stat';
    for (var i = 0; i < BRED_TRUE_POOL.length; i++) { if (r < BRED_TRUE_POOL[i].w) { kind = BRED_TRUE_POOL[i].k; break; } r -= BRED_TRUE_POOL[i].w; }
    var x = R();
    function rarest(pool, cur, skip) { var ok = pool.filter(function (o) { return o.t <= tier && o.id !== cur && skip.indexOf(o.id) < 0; }); if (!ok.length) return null;
      var top = Math.max.apply(null, ok.map(function (o) { return o.t; })); ok = ok.filter(function (o) { return o.t === top; }); return ok[x % ok.length]; }
    if (kind === 'pattern') { var pt = rarest(PetCore.PATTERNS, art.pattern, []); if (pt && (!fix || pt.t > tOf(PetCore.PATTERNS, art.pattern))) { art.pattern = pt.id; return { kind: 'pattern', id: pt.id, label: pt.label }; } }
    if (kind === 'eyes') { var ey = rarest(PetCore.EYES, art.eyes, ['beady']); if (ey && (!fix || ey.t > tOf(PetCore.EYES, art.eyes))) { art.eyes = ey.id; return { kind: 'eyes', id: ey.id, label: ey.label }; } }
    var keys = PetCore.STAT_KEYS, sk = keys[x % keys.length]; stats[sk] += BRED_TRUE_STAT; return { kind: 'stat', stat: sk, value: BRED_TRUE_STAT, label: '+' + BRED_TRUE_STAT + ' ' + sk.toUpperCase() }; }
  var HYBRID_TRUE_10K = 5000;        // hybrid x a root species: 50% that hybrid again, else the purebred
  function isHybrid(sp) { return typeof sp === 'string' && (sp.indexOf('hyb:') === 0 || sp.indexOf('hyb3:') === 0); }
  function isHybrid3(sp) { return typeof sp === 'string' && sp.indexOf('hyb3:') === 0; }
  function hybridKey(a, b) { return 'hyb:' + a + ':' + b; }
  function hybrid3Key(a, b, c) { return 'hyb3:' + a + ':' + b + ':' + c; }
  function hybridRoots(sp) { return isHybrid3(sp) ? sp.slice(5).split(':') : isHybrid(sp) ? sp.slice(4).split(':') : [sp]; }
  /* Three-way names (display-only): first part of A + middle of B + end of C, e.g. hyb3:pepe:dodo:kevin = Pe+do+vin = 'Pedovin'. */
  var H3_ORDER = ['pepe', 'wojak', 'chud', 'bobo', 'mumu', 'snibby', 'dodo', 'kevin', 'peepo', 'sarutobi', 'doge', 'lenny', 'nakamoto'];
  var H3_S1 = ['Pe', 'Wo', 'Chu', 'Bo', 'Mu', 'Sni', 'Do', 'Ke', 'Pee', 'Sa', 'Dog', 'Le', 'Na'], H3_S2 = ['pe', 'jo', 'chu', 'bo', 'mu', 'nib', 'do', 'ke', 'pee', 'ru', 'go', 'len', 'ka'],
    H3_S3 = ['pe', 'jak', 'chud', 'bo', 'mu', 'by', 'do', 'vin', 'po', 'tobi', 'ge', 'ny', 'moto'];
  function h3part(T, sp) { var i = H3_ORDER.indexOf(sp); return i < 0 ? sp : T[i]; }
  function hybridName(sp) { var r = hybridRoots(sp); if (r.length === 3) return h3part(H3_S1, r[0]) + h3part(H3_S2, r[1]) + h3part(H3_S3, r[2]);
    return HYBRID_NAMES[r[0] + ':' + r[1]] || (r[0] + '-' + r[1]); }
  function speciesLabel(sp) { if (isHybrid(sp)) return hybridName(sp) + ' (hybrid)'; var s = PetCore.SPECIES.filter(function (x) { return x.id === sp; })[0]; return s ? s.label : sp; }
  /** OPEN DECISION (placeholder): two hybrids of the SAME ordered pair breed true HYBRID_TRUE_10K of the time, otherwise a coin flip between the roots. */
  function samePairHybridRule(R, key) { var r = hybridRoots(key); return R() % 10000 < HYBRID_TRUE_10K ? key : r[R() % 2]; }
  /** hybridSpecies(R, A, B): the child's species under the hybrid rules (R = the breed hash stream; draws happen after the purebred draws). */
  /* THREE-WAY MIXES + "hybrids never go pure" (owner 2026-10-16). From ACTIVATE_HYBRID3_BLOCK, any breed with at least one hybrid parent ALWAYS
   * gives a hybrid (never a pure species). U = the union of both parents' root species (A's roots first, then B's new ones). All draws come from
   * the breed stream R after the purebred draws; one 50% draw (R() % 2), then deterministic picks:
   *   |U| = 2 (same pair either order, or a 2-way x one of its roots): 50% the hybrid parent's key (A's if both), else that pair in reverse order.
   *   two 3-ways with the SAME three species: 50% parent A's 3-way key, else a 2-way of two of the three (R-shuffle, first two, in that order).
   *   any other |U| >= 3 (2-way x 2-way of different pairs, 2-way x outside pure, 3-way x pure/2-way/other 3-way): 50% a 3-way of an R-shuffle
   *     of U (first three, in that order), else a 2-way of the first two.
   * Pure x pure is unchanged (68.4773435% hybrid). Before the block the old rules below run unchanged (no 3-way pets can exist yet). */
  var ACTIVATE_HYBRID3_BLOCK = 971789; // tip 971,783 + 6 at push time (2026-10-16)
  function hybrid3On(b) { return b != null && b >= ACTIVATE_HYBRID3_BLOCK; }
  function shuffled(R, arr) { var u = arr.slice(); for (var i = u.length - 1; i > 0; i--) { var j = R() % (i + 1), t = u[i]; u[i] = u[j]; u[j] = t; } return u; }
  function hybrid3Species(R, a, b) {
    var ra = hybridRoots(a), rb = hybridRoots(b), U = ra.slice(); rb.forEach(function (x) { if (U.indexOf(x) < 0) U.push(x); });
    var keep = R() % 2 === 0;
    if (U.length === 2) { var H = isHybrid(a) ? a : b, r = hybridRoots(H); return keep ? H : hybridKey(r[1], r[0]); }
    if (isHybrid3(a) && isHybrid3(b) && U.length === 3) { if (keep) return a; var s2 = shuffled(R, U); return hybridKey(s2[0], s2[1]); }
    var s = shuffled(R, U); return keep ? hybrid3Key(s[0], s[1], s[2]) : hybridKey(s[0], s[1]);
  }
  function hybridSpecies(R, a, b, coin, blk) {
    var ha = isHybrid(a), hb = isHybrid(b);
    if ((ha || hb) && hybrid3On(blk)) return hybrid3Species(R, a, b);
    if (!ha && !hb) { if (a === b) return coin; if (hybridRateOn(blk)) return draw1e9(R) < HYBRID_RATE_1E9 ? hybridKey(a, b) : coin;
      if (a === 'nakamoto' || b === 'nakamoto') return coin; /* LEGACY (971,501-971,673): Nakamoto exclusion + 15% rate */ return R() % 10000 < HYBRID_CHANCE_10K ? hybridKey(a, b) : coin; }
    if (ha && hb && a === b) return samePairHybridRule(R, a);
    var H = ha ? a : b, O = ha ? b : a, roots = hybridRoots(H);
    if (!isHybrid(O) && roots.indexOf(O) >= 0) return R() % 10000 < HYBRID_TRUE_10K ? H : O; // hybrid x one of its roots
    return roots[R() % 2]; // hybrid x anything else (incl. a different hybrid pair: parent A's hybrid roots if A is a hybrid): no 3-species hybrids
  }
  /** hybridPlan(hex, key): deterministic art assembly from the breed hash: body/head shape from one parent, colours + eyes + one signature feature from the other. */
  function hybridPlan(hex, key) { var r = hybridRoots(key), R = stream('XCPETS:v2:hybrid-art:' + hex);
    if (r.length === 3) { var o = shuffled(R, r); /* 3-way: body shape, colours and signature feature each from a different parent */
      return { key: key, a: r[0], b: r[1], c: r[2], roots: r.slice(), name: hybridName(key), shape: o[0], color: o[1], featSp: o[2], feature: ['head', 'side'][R() % 2], eyes: PetCore.EYES[R() % PetCore.EYES.length].id }; }
    var s = R() % 2, shape = r[s], color = r[1 - s]; // 2-way: unchanged
    return { key: key, a: r[0], b: r[1], roots: r.slice(), name: hybridName(key), shape: shape, color: color, feature: ['head', 'side'][R() % 2], eyes: PetCore.EYES[R() % PetCore.EYES.length].id }; }
  function speciesObj(id) { return PetCore.SPECIES.filter(function (x) { return x.id === id; })[0]; }
  /** hybridRender(art, opts): PetCore.render for a hybrid (art.hybrid = plan). Split-colour egg at stage 0; a small hybrid badge on every frame. */
  /** hybridRender(art, opts): PetCore.render for a hybrid (art.hybrid = plan). Split-colour egg at stage 0; a small hybrid badge on every frame.
   * 3-way plans take the signature feature from plan.featSp (2-way: from the colour parent). Cleanup 2026-10-16: a Nakamoto body takes the colour
   * parent's skin/hair (no grey hood, each blend distinct); Mumu bodies take the colour parent's belly on the blaze/snout and Pepe bodies its accent
   * on the lips (so Pepe- and Mumu-bodied blends read apart); laser beams stop at the sprite edge; side features keep only pixels connected to the
   * body; the badge moves to the top-left corner when a crest fills the top-right. */
  function hybridRender(art, opts) {
    var h = art.hybrid, S = speciesObj(h.shape), C = speciesObj(h.color), F = speciesObj(h.featSp || h.color), o = Object.assign({}, opts || {}), img;
    var shapeArt = Object.assign({}, art, { species: h.shape }), colArt = Object.assign({}, art, { species: h.color }), featArt = Object.assign({}, art, { species: F.id });
    var hx = function (c3) { return [parseInt(c3.slice(1, 3), 16), parseInt(c3.slice(3, 5), 16), parseInt(c3.slice(5, 7), 16)]; };
    var shade = function (c3, k) { var v = hx(c3); return '#' + v.map(function (n) { var m = Math.max(0, Math.min(255, Math.round(n * k))); return (m < 16 ? '0' : '') + m.toString(16); }).join(''); };
    function withColours(fn) { var keep = S.canon, kc = S.colors, cc = C.canon; S.canon = cc;
      if (S.id === 'nakamoto' && kc) S.colors = Object.assign({}, kc, { '3': cc.body, '4': shade(cc.body, 0.78), '1': shade(cc.accent, 0.8), '2': shade(cc.accent, 1.15), '5': cc.accent, '8': shade(cc.accent, 0.65), '9': cc.belly });
      if (S.id === 'mumu' && kc) S.colors = Object.assign({}, kc, { '2': shade(cc.belly, 1.05), '3': cc.belly, '4': shade(cc.belly, 1.15) });
      if (S.id === 'pepe' && C.id !== 'pepe') S.canon = Object.assign({}, cc, { belly: cc.accent });
      try { return fn(); } finally { S.canon = keep; S.colors = kc; } }
    if ((o.stage == null ? 3 : o.stage) === 0) { var L = PetCore.render(shapeArt, o), Rt = PetCore.render(colArt, o); img = { width: 32, height: 32, data: new Uint8ClampedArray(L.data) };
      for (var y = 0; y < 32; y++) for (var x = 16; x < 32; x++) for (var c = 0; c < 4; c++) img.data[(y * 32 + x) * 4 + c] = Rt.data[(y * 32 + x) * 4 + c];
    } else {
      var calm = PetCore.EYES[0].id, laser = h.eyes === 'laser';
      shapeArt.eyes = h.eyes; img = withColours(function () { return PetCore.render(shapeArt, o); });
      var key = function (a2) { return Object.assign({}, a2, { background: 'solid', bgColor: '#ff00ff', pattern: 'none' }); };
      var kS = withColours(function () { return PetCore.render(key(Object.assign({}, shapeArt, { eyes: calm })), o); }), kF = PetCore.render(key(Object.assign({}, featArt, { eyes: calm })), o);
      var sil = function (k, i) { return !(k.data[i] === 255 && k.data[i + 1] === 0 && k.data[i + 2] === 255); }, top = 32, x0 = 32, x1 = -1;
      if (laser) { var base = withColours(function () { return PetCore.render(Object.assign({}, shapeArt, { eyes: calm }), o); }); // clip beams to the body
        for (var q0 = 0; q0 < 1024; q0++) if (!sil(kS, q0 * 4)) for (var c1 = 0; c1 < 4; c1++) img.data[q0 * 4 + c1] = base.data[q0 * 4 + c1]; }
      for (var i = 0; i < 1024; i++) if (sil(kS, i * 4)) { top = Math.min(top, i >> 5); x0 = Math.min(x0, i & 31); x1 = Math.max(x1, i & 31); }
      var pick = function (feat) { var out = []; for (var j = 0; j < 1024; j++) { var yy = j >> 5, xx = j & 31; if (!sil(kF, j * 4) || sil(kS, j * 4)) continue;
        if (feat === 'head' ? yy < top : (yy >= top + 8 && (xx < x0 || xx > x1))) out.push(j); }
        /* ear fix (2026-10-14): ears + head outline always come from the SHAPE parent; a head crest is kept only where it grows out of the shape.
         * Side fix (2026-10-16): side features likewise keep only pixels connected (4-way) to the body, so no stray/floating pixels. */
        var on = {}, keep = {}, qq = []; out.forEach(function (j) { on[j] = 1; });
        var touches = function (j) { var xx = j & 31; return (feat === 'head' ? [j + 32] : [j + 32, j - 32, xx > 0 ? j - 1 : -1, xx < 31 ? j + 1 : -1]).some(function (n) { return n >= 0 && n < 1024 && sil(kS, n * 4); }); };
        out.forEach(function (j) { if (touches(j)) { keep[j] = 1; qq.push(j); } });
        while (qq.length) { var c0 = qq.pop(); [c0 - 1, c0 + 1, c0 - 32, c0 + 32].forEach(function (n) { if (on[n] && !keep[n] && Math.abs((n & 31) - (c0 & 31)) <= 1) { keep[n] = 1; qq.push(n); } }); }
        return out.filter(function (j) { return keep[j]; }); };
      var px = pick(h.feature); if (px.length < 3) px = pick(h.feature === 'head' ? 'side' : 'head');
      px.forEach(function (j) { for (var c2 = 0; c2 < 3; c2++) img.data[j * 4 + c2] = kF.data[j * 4 + c2]; });
      var busy = 0; for (var by = 0; by < 6; by++) for (var bx = 26; bx < 32; bx++) { var bj = by * 32 + bx; if (sil(kS, bj * 4) || px.indexOf(bj) >= 0) busy++; }
      var left = busy > 2;
    }
    var mark = [[29, 0, '#1a1020'], [28, 1, '#1a1020'], [30, 1, '#1a1020'], [27, 2, '#1a1020'], [31, 2, '#1a1020'], [28, 2, S.canon.body], [29, 1, S.canon.body], [29, 2, '#ffc93c'], [30, 2, C.canon.body], [29, 3, C.canon.body], [28, 3, '#1a1020'], [30, 3, '#1a1020'], [29, 4, '#1a1020']];
    if (h.featSp) mark.push([30, 3, F.canon.body], [28, 3, F.canon.body]);
    mark.forEach(function (q) { var v = hx(q[2]), qx = left ? q[0] - 27 : q[0], k3 = (q[1] * 32 + qx) * 4; img.data[k3] = v[0]; img.data[k3 + 1] = v[1]; img.data[k3 + 2] = v[2]; img.data[k3 + 3] = 255; });
    return img;
  }
  function hybridFrames(art, opts) { var fr = []; for (var f = 0; f < 4; f++) fr.push(hybridRender(art, Object.assign({}, opts, { frame: f }))); return fr; }
  /** castHybrids(w): one Cast entry per hybrid pair that exists in the state (Cast "Hybrids" tab). */
  function castHybrids(w) { var seen = {}, out = []; (w && w.pets || []).forEach(function (p) { if (!isHybrid(p.species) || seen[p.species]) return; seen[p.species] = 1;
      var r = hybridRoots(p.species), plan = hybridPlan(sha('cast:' + p.species), p.species);
      /* builds: one plan per possible body shape (each root as the body; colours/feature from the others), for the Cast tab */
      var builds = r.map(function (sh, i) { var rest = r.filter(function (x, j) { return j !== i; }); return Object.assign({}, plan, { shape: sh, color: rest[0], featSp: rest.length > 1 ? rest[1] : undefined }); });
      out.push({ key: p.species, name: hybridName(p.species), a: r[0], b: r[1], c: r[2], roots: r, plan: plan, builds: builds }); }); return out; }
  /** breedChild(hex, A, B) -> { species, tier, stats } (pure: used by replay and by the odds test). */
  function breedChild(hex, A, B, blk) {
    var R = stream('XCPETS:v2:breed:' + hex), species = R() % 2 ? B.species : A.species, lo = Math.min(A.tier, B.tier), hi = Math.max(A.tier, B.tier), roll = R() % 10000;
    var tier = roll < RARITY_UP_10K ? Math.min(3, hi + 1) : roll < RARITY_UP_10K + RARITY_HIGH_10K ? hi : lo, stats = {};
    Object.keys(A.stats).forEach(function (k) { stats[k] = Math.max(1, Math.round((A.stats[k] + B.stats[k]) / 2) + (R() % 5) - 2); });
    // hybrids: extra draws from the SAME stream, after the purebred draws (so purebred-only pairs give exactly the same results as before)
    if (isHybrid(A.species) || isHybrid(B.species) || A.species !== B.species) species = hybridSpecies(R, A.species, B.species, species, blk);
    if (isHybrid(species)) {
      var up = R() % 10000; tier = up < HYBRID_RARITY_UP_10K ? Math.min(3, hi + 1) : hi;
      var best = function (P) { return Object.keys(P.stats).reduce(function (m, k) { return P.stats[k] > P.stats[m] ? k : m; }, Object.keys(P.stats)[0]); };
      var ka = best(A), kb = best(B); stats[ka] = A.stats[ka]; stats[kb] = Math.max(kb === ka ? stats[kb] : 0, B.stats[kb]);
      return { species: species, tier: tier, stats: stats, hybrid: true, best: [ka, kb] };
    }
    return { species: species, tier: tier, stats: stats };
  }
  function breed(w, A, B, bh, tx, b, owner) {
    var c = breedChild(sha(bh + tx), A, B, b), art = PetCore.generate({ blockHash: bh, petId: tx + ':child', blockHeight: b });
    if (c.species === 'nakamoto' && naka777(b)) c.tier = 3; if (tierSpeciesOn(b) && !c.hybrid) raiseTier(c, 'stats'); art.species = c.species; art.tierIndex = c.tier; art.tier = PetCore.TIERS[c.tier].id; art.baseStats = c.stats;
    if (c.hybrid) { var plan = hybridPlan(sha(bh + tx), c.species); art.species = plan.shape; art.hybrid = plan; }
    var fix = breedFixOn(b), capped = fix ? capTraits(art, c.tier) : null;
    if (b >= ACTIVATE_BREEDCARRY_BLOCK) [A, B].forEach(function (P) { (P.carried || []).forEach(function (cr) { if (c.stats[cr.stat] != null && c.stats[cr.stat] < cr.value) c.stats[cr.stat] = cr.value; }); }); /* carried stat floor */
    var bonus = hybridRateOn(b) && !c.hybrid && !isHybrid(A.species) && A.species === B.species ? bredTrueBonus(sha(bh + tx), art, c.tier, c.stats, fix) : null;
    var kid = mk(w, owner, noBornShades(art), b, 0, tx); kid.species = c.species; if (c.hybrid) kid.hybrid = art.hybrid; if (bonus) kid.breedBonus = bonus; if (capped && capped.length) kid.traitCap = capped; kid.parents = [A.id, B.id]; // no gear or care inherited: starts as an Egg (feed 69 to hatch)
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
        var g = w.items['g' + w.nextItem] = trk(w, { gid: 'g' + (w.nextItem++), item: it.id, label: it.label, slot: 'hand', tier: 2, legendary: false, owner: p.owner, on: null, src: 'trophy' }); if (k > 0) p.trophies.push(it.label); });
      R.highlights.push('FINAL: #' + champ.id + ' is the Royal Rumble champion (crown until block ' + (b + WEEK) + ')');
    }
  }
  function applyOp(w, o) {
    if (o.kind !== 'equip') return; ELIG_B = o.block_index; monoSweep(w, o.block_index); shuffleSweep(w, o.block_index); gaSweep(w, o.block_index); var p = w.byId[o.petId]; if (!p || p.owner !== o.owner) return; liveAt(w, p, o.block_index); if (p.dead || p.released) return;
    if (o.gid == null) { var cur = wornIn(w, p.id, o.slot); if (cur) cur.on = null; return; }
    var g = w.items[o.gid]; if (!g || g.owner !== o.owner || graveLocked(w, g, o.block_index)) return; wear(w, p, g);
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
  // ---------------------------------------------------------------- bulk planners (pure; UI turns plans into burns)
  function feedQueue(w, owner, ids, nextBlock) { // ids null => all hungry. From ACTIVATE_FEEDM_BLOCK: always bundled, as many pets per burn as the 34-byte tag fits
    var ps = w.pets.filter(function (p) { return p.owner === owner && p.hungry && (!ids || ids.indexOf(p.id) >= 0); });
    var nb = nextBlock != null ? nextBlock : (w.tip || 0);  /* bundle only once the chain TIP itself is >= ACTIVATE_FEEDM_BLOCK (no tip -> 0 -> single feeds) */
    if (nb < ACTIVATE_FEEDM_BLOCK || ps.length < 2) return ps.map(function (p) { return { tag: 'pet:feed:' + p.id, amount: p.nextMeal, petId: p.id, label: 'Feed #' + p.id }; });
    return feedListOn(nb) ? feedPlan(ps) : feedBatches(ps);
  }
  /** feedListOn(tip): the UI offers pet:fl bundles only once the chain tip has reached FEED_LIST_BLOCK. */
  function feedListOn(tip) { return tip != null && Number(tip) >= FEED_LIST_BLOCK; }
  function b32(n) { return Number(n).toString(32).toUpperCase(); }
  /** feedPlan(pets) (FEED_LIST_BLOCK on): fewest burns. Sorted by id, split into consecutive groups by DP; each group is one pet:feed (1 pet),
   * one pet:fm window (dense run) or one pet:fl list (scattered), whichever fits in 34 bytes. Ties: fewer tag bytes, then fm before fl.
   * amount = the sum of the group's meals (exact, rounded to 8 dp), same as feedBatches. */
  function feedPlan(ps) {
    ps = ps.slice().sort(function (a, b) { return a.id - b.id; }); var n = ps.length, best = [{ c: 0, by: 0 }];
    function enc(i, j) { /* group ps[i..j] -> tag or null */
      var s = ps[i].id, e = ps[j].id; if (i === j) return 'pet:feed:' + s;
      var opts = [], fm = 'pet:fm:' + s + ':', nch = Math.floor((e - s) / 5) + 1;
      if (fm.length + nch <= MAX_TAG_BYTES) { var d = []; for (var k = 0; k < nch; k++) d.push(0); for (k = i; k <= j; k++) { var o = ps[k].id - s; d[Math.floor(o / 5)] |= 1 << (o % 5); }
        opts.push(fm + d.map(b32).join('')); }
      var fl = 'pet:fl:' + ps.slice(i, j + 1).map(function (p) { return b32(p.id); }).join('.'); if (fl.length <= MAX_TAG_BYTES) opts.push(fl);
      return opts.length ? opts.sort(function (a, b) { return a.length - b.length; })[0] : null; }
    for (var j = 0; j < n; j++) { best[j + 1] = null;
      for (var i = j; i >= 0; i--) { var t = enc(i, j); if (!t) { if (j - i > 30) break; continue; } var pr = best[i]; if (!pr) continue;
        var c = { c: pr.c + 1, by: pr.by + t.length, i: i, tag: t }; if (!best[j + 1] || c.c < best[j + 1].c || (c.c === best[j + 1].c && c.by < best[j + 1].by)) best[j + 1] = c; } }
    var out = [], at = n; while (at > 0) { var x = best[at], grp = ps.slice(x.i, at), amount = Math.round(grp.reduce(function (a, p) { return a + p.nextMeal; }, 0) * 1e8) / 1e8;
      out.unshift(grp.length === 1 ? { tag: x.tag, amount: amount, petId: grp[0].id, label: 'Feed #' + grp[0].id } : { tag: x.tag, amount: amount, petIds: grp.map(function (p) { return p.id; }), label: 'Feed ' + grp.length + ' pets' }); at = x.i; }
    out.forEach(function (p, k) { if (out.length > 1) p.label += ' (burn ' + (k + 1) + ' of ' + out.length + ')'; });
    return out;
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
  function communityRollPlan(slot, tip) { var code = slot ? String(slot).toUpperCase() : ''; if (code && tip != null && Number(tip) >= ACTIVATE_SLOTNAME_BLOCK) { var nm = (SLOT_LABELS[code.toLowerCase()] || '').toUpperCase(); if (SLOT_NAME_CODES[nm]) code = nm; } var tag = 'pet:c:roll' + (code ? ':' + code : ''); return { tag: tag, amount: COSTS.croll, label: 'Community gear roll' }; }
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
    var other = mineCopies.filter(function (g) { var q = w.byId[g.on]; return q && q.id !== p.id && !graveLocked(w, g); })[0];
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
  /** breedPicker(w, owner, tip, selA): cards for the breeding picker. Nakamoto + the community pet are left out silently (rule unchanged).
   * mine = owner's living pets (parent A), partners = every other living pet (parent B); each { p, why } where why = null if selectable. */
  function breedPicker(w, owner, tip, selA) {
    var live = w.pets.filter(function (p) { return !p.dead && !p.released && (p.species !== 'nakamoto' || nakaNormal(tip)) && !p.community; });
    var why = function (p) { var r = breedable(p, tip); if (!r && selA != null && String(p.id) === String(selA)) r = 'already parent A'; return r || null; };
    return { mine: live.filter(function (p) { return p.owner === owner; }).map(function (p) { return { p: p, why: breedable(p, tip) || null }; }),
      partners: live.map(function (p) { return { p: p, why: why(p) }; }) }; }
  function myRanks(ranked, owner) { var n = ranked.length;
    return ranked.filter(function (r) { return r.p.owner === owner; }).map(function (r) {
      var top = r.rank <= n - r.rank + 1, pct = Math.max(1, Math.ceil((top ? r.rank : n - r.rank + 1) / n * 100));
      return { rank: r.rank, total: n, id: r.p.id, name: r.p.name, half: top ? 'top' : 'bottom', pct: pct, label: '#' + r.rank + ' of ' + n, note: (top ? 'top ' : 'bottom ') + pct + '%' }; }); }
  return { ACTIVATE_BREED_FIX_BLOCK: ACTIVATE_BREED_FIX_BLOCK, breedFixOn: breedFixOn, capTraits: capTraits, breed: breed, _setBreedFixActivation: function (b) { ACTIVATE_BREED_FIX_BLOCK = b; }, ACTIVATE_RUMBLE_OFF_BLOCK: ACTIVATE_RUMBLE_OFF_BLOCK, rumbleOff: rumbleOff, _setRumbleOffActivation: function (b) { ACTIVATE_RUMBLE_OFF_BLOCK = b; }, ACTIVATE_LEG_BOOST_BLOCK: ACTIVATE_LEG_BOOST_BLOCK, LEG_SCALE: LEG_SCALE, LEG_BOOST_W: LEG_BOOST_W, legBoostOn: legBoostOn, _setLegBoostActivation: function (b) { ACTIVATE_LEG_BOOST_BLOCK = b; }, ACTIVATE_GEAR_CAP_BLOCK: ACTIVATE_GEAR_CAP_BLOCK, gearCapOn: gearCapOn, repairGear: repairGear, _setGearCapActivation: function (b) { ACTIVATE_GEAR_CAP_BLOCK = b; }, ACTIVATE_HYBRID_RATE_BLOCK: ACTIVATE_HYBRID_RATE_BLOCK, HYBRID_RATE_1E9: HYBRID_RATE_1E9, hybridRateOn: hybridRateOn, draw1e9: draw1e9, bredTrueBonus: bredTrueBonus, BRED_TRUE_POOL: BRED_TRUE_POOL, BRED_TRUE_STAT: BRED_TRUE_STAT, _setHybridRateActivation: function (b) { ACTIVATE_HYBRID_RATE_BLOCK = b; }, ACTIVATE_TIER_SPECIES_BLOCK: ACTIVATE_TIER_SPECIES_BLOCK, TIER_UNLOCK: TIER_UNLOCK, tierSpeciesOn: tierSpeciesOn, tierPool: tierPool, pickTierSpecies: pickTierSpecies, minTierOf: minTierOf, relabelTiers: relabelTiers, _setTierSpeciesActivation: function (b) { ACTIVATE_TIER_SPECIES_BLOCK = b; }, CUTOFF_BLOCK: CUTOFF_BLOCK, ACTIVATE_NAKA_777_BLOCK: ACTIVATE_NAKA_777_BLOCK, naka777: naka777, hatchArt: hatchArt, SPECIES12: SPECIES12, ACTIVATE_NAKA_NORMAL_BLOCK: ACTIVATE_NAKA_NORMAL_BLOCK, nakaNormal: nakaNormal, LIVE_DEATH_FROM_BLOCK: LIVE_DEATH_FROM_BLOCK, RETIRED: RETIRED, resolveItem: resolveItem, itemOf: itemOf, readBurns: readBurns, importLive: importLive, migrateLoadout: migrateLoadout, setLiveEngine: setLiveEngine, V2_FROM_BLOCK: V2_FROM_BLOCK, BLOCKS_PER_DAY: BLOCKS_PER_DAY, WEEK: WEEK, COSTS: COSTS, FEED_QUICK: FEED_QUICK, FEE_SATS: FEE_SATS, MAX_RELEASE_PER_BURN: MAX_RELEASE_PER_BURN,
    THRESHOLDS: THRESHOLDS, NAKAMOTO_THRESHOLDS: NAKAMOTO_THRESHOLDS, NAKAMOTO_MEAL_SIZES: NAKAMOTO_MEAL_SIZES, WIZARD_THRESHOLDS: WIZARD_THRESHOLDS, COMMUNITY_GOAL: COMMUNITY_GOAL, returnProgress: returnProgress, noBornShades: noBornShades, bornTraits: bornTraits, _breed: breed, BURN_ADDRESS: BURN_ADDRESS,
    COMMUNITY_GOAL_NAME: COMMUNITY_GOAL_NAME, COMMUNITY_PET: COMMUNITY_PET, ACTIVATE_SLOTNAME_BLOCK: ACTIVATE_SLOTNAME_BLOCK, SLOT_NAME_CODES: SLOT_NAME_CODES, COMMUNITY_WIZARD_NAME: COMMUNITY_WIZARD_NAME, STAGE_NAMES: STAGE_NAMES, V2_SLOTS: V2_SLOTS, NAKAMOTO_CAST_STAGE: NAKAMOTO_CAST_STAGE, castShowsNakamoto: castShowsNakamoto, SLOT_LABELS: SLOT_LABELS, slotLabel: slotLabel, newWins: newWins, newHatches: newHatches, TIER_LABELS: TIER_LABELS, equipCheck: equipCheck, pickerPieces: pickerPieces, catalogBySlot: catalogBySlot, BLACK_EYE_BLOCKS: BLACK_EYE_BLOCKS, FIGHT_WINDOW: FIGHT_WINDOW,
    BREED_COOLDOWN: BREED_COOLDOWN, ACTIVATE_BREEDCARRY_BLOCK: ACTIVATE_BREEDCARRY_BLOCK, BREED_MAX: BREED_MAX, ACTIVATE_BREED_UNCAPPED_BLOCK: ACTIVATE_BREED_UNCAPPED_BLOCK, breedCapOn: breedCapOn, BREED_WINDOW: BREED_WINDOW, TIER_LABELS: TIER_LABELS, SPECIES13: SPECIES13, ALL_GEAR: ALL, GEAR_BY_ID: BY_ID,
    sha: sha, day: day, weekOf: weekOf, seedBlockOfWeek: seedBlockOfWeek, pickSpecies: pickSpecies, thresholdsFor: thresholdsFor, mealFor: mealFor, mealsToMythic: mealsToMythic, stageFor: stageFor, wizardStage: wizardStage,
    isLegendary: isLegendary, eligible: eligible, legendaryOf: legendaryOf, pool: pool, pickItem: pickItem, capacity: capacity, parseTag: parseTag, battleBlock: battleBlock, releaseBatches: releaseBatches, burnSummary: burnSummary,
    validFeedAmount: validFeedAmount, simulateFight: simulateFight, replay: replay, breedChild: breedChild, breedable: breedable, feedQueue: feedQueue, feedBatches: feedBatches, feedPlan: feedPlan, feedListOn: feedListOn, FEED_LIST_BLOCK: FEED_LIST_BLOCK, _setFeedListActivation: function (b) { FEED_LIST_BLOCK = b; }, freeRolls: freeRolls, freeRollPlan: freeRollPlan, gravePlan: gravePlan, graveOn: graveOn, graveLocked: graveLocked, ACTIVATE_GRAVE_GEAR_BLOCK: ACTIVATE_GRAVE_GEAR_BLOCK, ACTIVATE_FOUNDER_BLOCK: ACTIVATE_FOUNDER_BLOCK, _setFounderActivation: function (b) { ACTIVATE_FOUNDER_BLOCK = b; }, _setFounderGrant: function (kit, credits) { if (kit) FOUNDER_KIT_PER_ROLL = kit; if (credits != null) FOUNDER_CREDITS_PER_ROLL = credits; }, founderGrant: function () { return { kit: FOUNDER_KIT_PER_ROLL.slice(), credits: FOUNDER_CREDITS_PER_ROLL }; }, FOUNDER_ROLLS: FOUNDER_ROLLS, ACTIVATE_CROLL_BLOCK: ACTIVATE_CROLL_BLOCK, _setCrollActivation: function (b) { ACTIVATE_CROLL_BLOCK = b; }, crollOn: crollOn, communityRollPlan: communityRollPlan, communityGear: communityGear, ACTIVATE_DEDUP_BLOCK: ACTIVATE_DEDUP_BLOCK, _setDedupActivation: function (b) { ACTIVATE_DEDUP_BLOCK = b; }, ownedCounts: ownedCounts, dampW: dampW, ACTIVATE_TOKENS_BLOCK: ACTIVATE_TOKENS_BLOCK, _setTokensActivation: function (b) { ACTIVATE_TOKENS_BLOCK = b; }, TOKEN_DROP_10K: TOKEN_DROP_10K, tokensOf: function (w, owner) { return (w && w.tokens && w.tokens[owner]) || 0; }, ACTIVATE_FEEDM_BLOCK: ACTIVATE_FEEDM_BLOCK, _setFeedmActivation: function (b) { ACTIVATE_FEEDM_BLOCK = b; }, rollQueue: rollQueue, communityFeedPlan: communityFeedPlan,
    autoEquipOps: autoEquipOps, outfitOps: outfitOps, outfitReport: outfitReport, hideAtOrBelow: hideAtOrBelow, familyTree: familyTree, buildTag: buildTag, wornOf: wornOf, reindex: reindex, myRanks: myRanks, breedPicker: breedPicker,
    HYBRID_NAMES: HYBRID_NAMES, HYBRID_CHANCE_10K: HYBRID_CHANCE_10K, HYBRID_RARITY_UP_10K: HYBRID_RARITY_UP_10K, HYBRID_TRUE_10K: HYBRID_TRUE_10K, isHybrid: isHybrid, hybridKey: hybridKey, hybridRoots: hybridRoots,
    hybridName: hybridName, speciesLabel: speciesLabel, samePairHybridRule: samePairHybridRule, hybridSpecies: hybridSpecies, hybridPlan: hybridPlan, hybridRender: hybridRender, hybridFrames: hybridFrames, castHybrids: castHybrids, ACTIVATE_SIG_SHUFFLE_BLOCK: ACTIVATE_SIG_SHUFFLE_BLOCK, shuffleOn: shuffleOn, ACTIVATE_GEAR_AUDIT_BLOCK: ACTIVATE_GEAR_AUDIT_BLOCK, gaOn: gaOn, ACTIVATE_STAR_BATCH_BLOCK: ACTIVATE_STAR_BATCH_BLOCK, ACTIVATE_MYTHIC_DISCOUNT_BLOCK: ACTIVATE_MYTHIC_DISCOUNT_BLOCK, MYTHIC_DISCOUNT_CARE: MYTHIC_DISCOUNT_CARE, mythicDiscountOn: mythicDiscountOn, petThresholds: petThresholds, overflowRolls: overflowRolls, overflowRollPlan: overflowRollPlan, overflowEarned: overflowEarned, starBatchOn: starBatchOn, lockHint: function (id) { var L = SPECIES_LOCK[id]; return L ? '\uD83D\uDD12 ' + speciesLabel(L.sp) + '-only' : ''; }, itemView: function (id) { return view(itemOf(id)); }, ACTIVATE_LENNY_MONOCLE_BLOCK: ACTIVATE_LENNY_MONOCLE_BLOCK, monocleLennyOn: monocleLennyOn, eligBlock: function () { return ELIG_B; }, SPECIES_LOCK: SPECIES_LOCK, isHybrid3: isHybrid3, hybrid3Key: hybrid3Key, ACTIVATE_HYBRID3_BLOCK: ACTIVATE_HYBRID3_BLOCK, hybrid3On: hybrid3On, hybrid3Species: hybrid3Species, _setHybrid3Activation: function (b) { ACTIVATE_HYBRID3_BLOCK = b; } };
});
