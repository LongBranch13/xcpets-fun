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
  var COSTS = { sd: 690, tt: 1380, join: 690, hatch: 69, roll: 345, feedMin: 69, feedMinV1: 7, fight: 690, accept: 690, rumble: 69, rumbleStake: 690, breed: 690, release: 0.00000001, wagmi: 0.00000001, give: 0.00000001, hi: 0.00000001, croll: 690, froll: 0.00000001 };
  var FEED_QUICK = [69, 690, 6900];
  var FEE_SATS = 1500;                 // fallback BTC miner fee estimate per burn tx (sats)
  var MAX_RELEASE_PER_BURN = 120, MAX_TAG_BYTES = 34;
  /* Multi-pet feed (2026-10-15, Jake): pet:fm:START:MASK feeds every pet in the base32 bitmask (same mask format as pet:rel) in ONE burn.
   * Inert until ACTIVATE_FEEDM_BLOCK: before it a pet:fm tag replays exactly as today (unknown pet: tag, community food only). */
  /* Community roll (2026-10-15, Jake approved): pet:c:roll[:SLOT] (SLOT = a v2 slot id: HEAD HAND BODY BACK FACE FEET) burns 690 and gives the
   * community pet Nakamoto one gear item right away (seed: block hash + tx, like a token roll). Inert until ACTIVATE_CROLL_BLOCK: before it the tag
   * replays exactly as before (unknown pet: tag, community food only). The 7 old 25,000 pet:c:roll burns are pre-cutoff (frozen live engine). */
  /* PET GIFTING (pet-gift preview, Phase 1, design/pet-market.md §1). pet:give:ID:P (P = recipient player # in base 32, 0-9A-V) moves a pet to
   * player P for a 1-dander burn (1 sat of XCPETS); pet:hi (1 dander) is a hello burn so a new wallet gets a player #. Player # = order of an
   * address's first XCPETS burn in history (block, then tx order), starting at 1; any burn counts, so it is derived from history alone.
   * Worn gear and the pet's bag move with the pet; the stash, saved spins, tokens, badges and rolls stay with the giver.
   * Locks: open fight, pending breed request, open ad / active listing (when those exist), dead / released / community pets.
   * A received pet waits GIVE_SETTLE blocks before it can be gifted again (also = one gift per pet per block). No randomness.
   * Inert until ACTIVATE_GIVE_BLOCK: before it pet:give / pet:hi replay exactly as today (unknown pet: tag, community food).
   * PLACEHOLDER: null = off. Set to Bitcoin tip + 6 at deploy. */
  /* SPAM CITY LAUNCH (owner, Oct 22 2026 10:07 PM CT): buying, selling (pet tokens) and gifting / batch gifting / swaps switch on TOGETHER.
   * Set ONLY this one block; ACTIVATE_GIVE_BLOCK and ACTIVATE_SALES_BLOCK both follow it. */
  var ACTIVATE_SPAM_CITY_BLOCK = 972729;
  var ACTIVATE_GIVE_BLOCK = ACTIVATE_SPAM_CITY_BLOCK, GIVE_SETTLE = 6, SWAP_WINDOW = 1008;
  /* TOKEN IS THE PET (owner final rule, Oct 23 2026): from the Spam City gate the ONLY way a pet changes hands is its token moving (send / MPMA /
   * DEX fill / dispenser...). pet:give, pet:gives and pet:swap / swapok / swapno burns do nothing (rejected, the 1 dander is spent as community food).
   * Below the gate nothing changes (they are unknown tags there anyway). */
  var TOKEN_ONLY = true, NO_BURN_GIFT = 'gifts are token sends now: send the pet token (Gift tab), pet:give / pet:gives / pet:swap burns do nothing';
  /* PET-FOR-PET SWAPS (same gate): pet:swap:MINE:THEIRS opens offer N (1, 2, ... in chain order); the owner of THEIRS burns pet:swapok:N to swap the owners
   * at that burn, only if the offer is open and within SWAP_WINDOW blocks, both pets still belong to the two players, are alive and pass the gift locks.
   * pet:swapno:N closes it (offerer = cancel, other owner = decline). Gear moves with each pet like a gift. 1 dander each, no randomness. */
  /* SPAM CITY RULES (owner, Oct 23 2026 6:59 AM CT), LIVE from ACTIVATE_SPAM_RULES_BLOCK = 972,783 (null would turn them off = old behaviour):
   *  1) a pet token sent to a burn address: the pet belongs to that address (out of play: nobody can sign for it), shown as "sent to a burn address".
   *  2) one move per pet per block: only the FIRST move of a pet in a block counts (block order = tx_index); later moves of it in that block are ignored.
   *  3) mint = tie: the FIRST issuance of a valid pet token (free numeric, qty 1, indivisible, locked, description = the pet's t/ID.json URL) by the pet's
   *     CURRENT owner ties it at once (no pet:deed burn needed) if the pet has no token. Third-party issuances are ignored (deedWhy: owner only).
   *  At the gate, every pre-sales-gate pet:deed tie that is still valid (owner unchanged, owner still holds the token) is honoured once (grandfather). */
  var ACTIVATE_SPAM_RULES_BLOCK = 972783;
  /* ONE TIE PATH (owner, Oct 24 2026 12:50 AM CT): there is ONE way to tokenize a pet: mint the token, then a separate pet:deed tie burn.
   * From ACTIVATE_ONE_TIE_PATH_BLOCK rule 3 (mint = tie) is off: a mint alone ties nothing. Pets already tied by a mint before it stay tied.
   * DEPLOYED Oct 24 2026 ~1:10 AM CT at tip 972890 + 6. null = off (mint = tie still applies). */
  var ACTIVATE_ONE_TIE_PATH_BLOCK = 972896;
  /* TOKEN REBIND GUARD (audit-fixes, Oct 24 2026; PREVIEW gate = tip + 6, re-set at merge): before it a pet:deed burn could tie a NEW token to a pet
   * whose current token its owner still holds; the old token then stays in the wallet as a stale token that no longer moves the pet, and could be
   * passed off to a buyer outside the shop. From the gate that rebind is refused: destroy the current token first (a new tie is still allowed when
   * the current token is out of sync, held by someone other than the pet's owner, or destroyed). null = off (old rule). */
  var ACTIVATE_DEED_REBIND_BLOCK = 973000; /* tip 972994 (mempool.space, Oct 24 2026 6:59 PM CT) + 6 */
  function rebindGuardOn(b) { return ACTIVATE_DEED_REBIND_BLOCK != null && b != null && Number(b) >= ACTIVATE_DEED_REBIND_BLOCK; }
  function oneTieOn(b) { return ACTIVATE_ONE_TIE_PATH_BLOCK != null && b != null && Number(b) >= ACTIVATE_ONE_TIE_PATH_BLOCK; }
  /** mintTiesOn(b): rule 3 (mint = tie) applies at block b. */
  function mintTiesOn(b) { return rulesOn(b) && !oneTieOn(b); }
  function rulesOn(b) { return ACTIVATE_SPAM_RULES_BLOCK != null && b != null && Number(b) >= ACTIVATE_SPAM_RULES_BLOCK; }
  /** isBurnAddr(a): a well-known provably unspendable address (Counterparty burn, Bitcoin Eater, 1111… and vanity XXXX… addresses). */
  var BURN_ADDRS = { '1CounterpartyXXXXXXXXXXXXXXXUWLpVr': 1, '1BitcoinEaterAddressDontSendf59kuE': 1, '1111111111111111111114oLvT2': 1, 'bc1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqquuu8': 0 };
  function isBurnAddr(a) { a = String(a || ''); return !!BURN_ADDRS[a] || /^1[1-9A-HJ-NP-Za-km-z]{0,20}X{12,}[1-9A-HJ-NP-Za-km-z]{0,8}$/.test(a) || /^1{20,}[1-9A-HJ-NP-Za-km-z]{0,12}$/.test(a); }
  function giveOn(b) { return ACTIVATE_GIVE_BLOCK != null && b != null && Number(b) >= ACTIVATE_GIVE_BLOCK; }
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
  function freeRolls(w, owner, pendingTags) { if (w && w.tip != null && spinsOn(w.tip + 1)) return { on: false, left: 0, pending: 0, have: 0 }; /* saved spins: founder credits converted */ var have = (w.freeRolls && w.freeRolls[owner]) || 0, pend = (pendingTags || []).filter(function (t) { return /^pet:fr:\d+$/i.test(String(t)); }).length, left = Math.max(0, have - pend);
    return { on: w.tip != null && w.tip >= ACTIVATE_FOUNDER_BLOCK && left > 0, left: left, pending: pend }; }
  function freeRollPlan(petId) { return { tag: 'pet:fr:' + petId, amount: COSTS.froll, petId: petId, label: 'Free roll #' + petId }; }
  var ACTIVATE_FEEDM_BLOCK = 971515;  // Bitcoin tip 971,512 at 2026-10-15 00:14 CT + 3 (Jake approved)
  /* List feed (2026-10-19, scattered-feeding fix): pet:fl:ID.ID.ID… feeds the listed pets in ONE burn. IDs are base 32 (0-9 A-V, case-insensitive,
   * no leading zero), joined by '.', strictly ascending, at least 2, whole tag <= 34 bytes. Valued and validated exactly like pet:fm: pets in
   * ascending id order, each takes its own meal from the burn, a pet that can't be fed (or that the rest of the burn can't pay for) is skipped.
   * Inert before FEED_LIST_BLOCK: before it a pet:fl tag replays exactly as today (unknown pet: tag, community food only).
   * Activation block set at deploy (chain tip + 6). */
  /* WAGMI DAILY CHECK-IN (rework Oct 21 2026, owner: must NOT depend on feeding; NOT LIVE). A wallet says WAGMI once per chain day
   * (floor(block/144), the same day as feeding) with the 1-sat burn pet:wagmi (the owner-approved 1-sat check-in, tag renamed while still ungated).
   * Only pet:wagmi counts: feeding and other game burns do NOT. Before ACTIVATE_WAGMI_BLOCK the tag replays exactly as today (unknown pet: tag,
   * community food). Wallet-level record w.wagmi[addr][day] = 1; display + leaderboard only, no pet, item or fight changes. */
  /* WHEEL RANDOM (owner final rule Oct 22 2026 12:59 AM CT, design/wheel-random.md). From ACTIVATE_WHEEL_RANDOM_BLOCK every PAID gear roll is a Pepe Wheel spin.
   * Tags: new 'pet:spin', and the old 'pet:roll:ID' (its ID is ignored from the gate). Cost 345 XCPETS as before.
   * (1) PICK A PET: the burner's own pets that are alive (age/death refreshed at the burn's block), not released, not community, with >= 1 open slot.
   *     Weighted by tier: Common 1, Uncommon 2, Rare 4, Legendary 8 (WHEEL_W). Pets sorted by #ID; r = int(sha256(blockHash + txHash + 'XCPETS:v2:wheel-pet')[0..12], 16)
   *     mod (sum of weights); walk the list subtracting weights; the pet where r falls is picked.
   * (2) ROLL for that pet exactly like pet:roll:ID today (unchanged stream sha256(blockHash + txHash + 'XCPETS:v2:gear-roll'): a random open slot, its species,
   *     tier cap, ★ only for a Legendary, LORDKEK card drop rule), (3) and the piece goes straight onto that pet (same wear as today: replaces what was in that slot).
   * FALLBACK: no pet with an open slot -> the same weighted pick over the burner's living pets; slot = V2_SLOTS[int(gear-roll hash[16..24], 16) mod 6]; piece rolled for
   *     that pet's species/tier and put in the gear bag (unworn). No living pet at all -> rejected (the site never sends it).
   * Before the gate pet:roll:ID replays exactly as before and pet:spin is an unknown tag. pet:fr:ID (founder credits) and pet:of:ID (Mythic overflow) stay per-pet. null = off. */
  var ACTIVATE_WHEEL_RANDOM_BLOCK = 972589, /* deploy Oct 22 2026: tip 972583 + 6 */ WHEEL_W = [1, 2, 4, 8];
  /* ANY-SLOT ROLLS (owner approved Oct 22 2026 ~12:12 PM CT, branch any-slot-rolls). From ACTIVATE_ANY_SLOT_BLOCK every gear roll (paid pet:roll, Pepe Wheel
   * spin, roll token, founder free roll, overflow roll) picks its slot evenly from ALL 6 slots (V2_SLOTS[int(hash[16..24], 16) mod 6], same as community rolls),
   * whatever the pet has unlocked. A piece for a LOCKED slot goes into that pet's BAG (g.bag = pet id, w.bags[petId] = [gid]): it is bound to the pet, not usable
   * on other pets, kept out of w.itemList (stash / pickers / Equip Best) and lost with the pet (death / release). When the slot unlocks (liveAt), the oldest bagged
   * piece is worn if that slot is empty (never replaces worn gear) and every bagged piece of that slot becomes normal gear. Before the gate nothing changes. */
  var ACTIVATE_ANY_SLOT_BLOCK = 972646; /* DEPLOYED Oct 22 2026 ~1:10 PM CT: tip 972640 + 6 */
  /* MYTHIC SLOTS (owner approved Oct 22 2026 ~6:49 PM CT, branch mythic-slots). From ACTIVATE_MYTHIC_SLOTS_BLOCK: (a) Mythic pets (stage 5 or mythicCare)
   * have capacity 6 = all slots open (they can't be fed, so the feeding slots used to decay); (b) every pet's open slots never close again: capacity = max
   * reached since the gate. Bagged pieces free up through the normal unbag path in liveAt. Below the gate nothing changes (replay SAME). */
  var ACTIVATE_MYTHIC_SLOTS_BLOCK = 972680; /* DEPLOYED Oct 22 2026 ~7:15 PM CT: tip 972674 + 6 */
  function mythicSlotsOn(b) { return ACTIVATE_MYTHIC_SLOTS_BLOCK != null && b != null && b >= ACTIVATE_MYTHIC_SLOTS_BLOCK; }
  function anySlotOn(b) { return ACTIVATE_ANY_SLOT_BLOCK != null && b != null && b >= ACTIVATE_ANY_SLOT_BLOCK; }
  function rollSlotOf(p, hex, b) { var n = parseInt(hex.slice(16, 24), 16); return anySlotOn(b) ? V2_SLOTS[n % V2_SLOTS.length] : p.openSlots[n % p.openSlots.length]; }
  /* place a freshly rolled piece: wear it (old rule) when its slot is open, else (from the gate) put it in the pet's bag */
  function placeRolled(w, p, g, b) { if (anySlotOn(b) && !slotOpen(p, g.slot)) { g.bag = p.id; (w.bags = w.bags || {})[p.id] = (w.bags[p.id] || []).concat(g.gid); if (w.itemList) w.itemList = w.itemList.filter(function (x) { return x !== g; }); return false; } return wear(w, p, g); }
  function unbag(w, p) { var L = w.bags && w.bags[p.id]; if (!L || !L.length || p.dead || p.released) return;
    var keep = []; L.forEach(function (gid) { var g = w.items[gid]; if (!g || g.bag !== p.id) return; if (!slotOpen(p, g.slot)) { keep.push(gid); return; }
      delete g.bag; if (!wornIn(w, p.id, g.slot)) wear(w, p, g); if (w.itemList && w.itemList.indexOf(g) < 0) w.itemList.push(g); });
    if (keep.length) w.bags[p.id] = keep; else delete w.bags[p.id]; }
  /** bagOf(w, petId) -> the pet's bagged (locked-slot) pieces, oldest first. */
  function bagOf(w, pid) { return ((w.bags && w.bags[pid]) || []).map(function (gid) { return w.items[gid]; }).filter(function (g) { return g && g.bag === pid; }); }
  /** slotUnlock(p, slot) -> { need, have, open, days, text }: what opens that slot (need = slots required; days = chain days if fed every day from now, null = never). */
  function slotUnlock(p, slot) { var need = V2_SLOTS.indexOf(slot) + 1, have = p.capacity || 0, open = slotOpen(p, slot), days = null, myth = !!(p.mythicCare || p.stage === 5);
    if (myth && open) return { need: need, have: have, open: true, days: null, mythic: true, text: 'Unlocked · Mythic pets have all 6 slots' };
    if (!open && !myth) for (var d = 1; d <= 30; d++) { if (capacity((p.ageDays || 0) + d, (p.fedDays || 0) + d) >= need) { days = d; break; } }
    var text = open ? 'Unlocked' : 'Needs ' + need + ' gear slots (has ' + have + '). Slots come from age 2 / 5 / 10 days and feeding on 50% / 80% of days' + (myth ? ' · Mythic pets have all 6 slots' + (ACTIVATE_MYTHIC_SLOTS_BLOCK != null ? ' from block ' + ACTIVATE_MYTHIC_SLOTS_BLOCK : '') : '') + (days != null ? ' · about ' + days + ' day' + (days === 1 ? '' : 's') + ' if fed daily' : '');
    return { need: need, have: have, open: open, days: days, text: text }; }
  function wheelOn(b) { return ACTIVATE_WHEEL_RANDOM_BLOCK != null && b != null && b >= ACTIVATE_WHEEL_RANDOM_BLOCK; }
  function wheelPets(w, owner, b, refresh) { return (w.pets || []).filter(function (p) { if (p.owner !== owner || p.community || p.released) return false; if (refresh && b != null) liveAt(w, p, b); return !p.dead; }).sort(function (a, c) { return a.id - c.id; }); }
  function wheelWt(p) { return WHEEL_W[Math.max(0, Math.min(3, p.tier || 0))]; }
  function wheelPool(w, owner, b, refresh) { var L = wheelPets(w, owner, b, refresh), o = L.filter(function (p) { return (p.openSlots || []).length > 0; }); return o.length ? o : L; }
  function wheelPick(pool, hex) { var T = pool.reduce(function (s, p) { return s + wheelWt(p); }, 0); if (!T) return null; var r = parseInt(hex.slice(0, 12), 16) % T; for (var i = 0; i < pool.length; i++) { r -= wheelWt(pool[i]); if (r < 0) return pool[i]; } return pool[pool.length - 1]; }
  var ACTIVATE_WAGMI_BLOCK = 972570; // set at deploy Oct 21 2026: chain tip 972,564 + 6
  function wagmiOn(b) { return b != null && b >= ACTIVATE_WAGMI_BLOCK; }
  /* WAGMI TOP-FIVE PRIZE (owner, Oct 22 2026): from ACTIVATE_WAGMI_PRIZE_BLOCK the first WAGMI_PRIZE_N distinct wallets to say WAGMI in a chain day
   * (floor(block/144); chain order = block, then tx position) each earn +1 saved Pepe Wheel spin. Only a wallet's first WAGMI of the day counts.
   * Record: w.wagmiFirst[day] = [addr, ...]. Below the gate nothing changes (replay SAME). */
  var ACTIVATE_WAGMI_PRIZE_BLOCK = 972681; // chain tip 972675 + 6 at deploy (Oct 22 2026)
  var WAGMI_PRIZE_N = 5;
  function wagmiPrizeOn(b) { return ACTIVATE_WAGMI_PRIZE_BLOCK != null && b != null && b >= ACTIVATE_WAGMI_PRIZE_BLOCK; }
  var FEED_LIST_BLOCK = 972132;    // set at deploy 2026-10-19: chain tip 972126 + 6 (Counterparty API 972126, Bitcoin 972126)
  var THRESHOLDS = [0, 69, 8349, 22149, 41469, 69069];             // normal pets (unchanged; Mythic day 9 at 1 meal/day)
  var MEAL_SIZES = [0, 4140, 6900, 9660, 9200];
  function x10(a) { return a.map(function (v, i) { return i <= 1 ? v : v * 10; }); }
  var NAKAMOTO_THRESHOLDS = x10(THRESHOLDS);                       // [0, 69, 83490, 221490, 414690, 690690]; hatch stays 69
  var NAKAMOTO_MEALS = [0, 7, 7, 7, 9];                            // 30 daily meals => Mythic ~ day 30 (~a month)
  var NAKAMOTO_MEAL_SIZES = NAKAMOTO_MEALS.map(function (n, k) { return k ? Math.ceil((NAKAMOTO_THRESHOLDS[k + 1] - NAKAMOTO_THRESHOLDS[k]) / n) : 0; });
  var WIZARD_THRESHOLDS = NAKAMOTO_THRESHOLDS.map(function (v, i) { return i === 1 ? 69000 : v * 10; }); // community pet: 10x Nakamoto => Mythic 6,906,900; hatch 69,000 (Jake 2026-10-15, immediate, no activation block)
  /* COMMUNITY PETS 100x (owner approved Oct 19 2026 9:19 PM CT): from ACTIVATE_COMMUNITY_100X_BLOCK EVERY community pet (current or future; never a
   * player's pet, regular player Nakamoto stays normal) grows COMMUNITY_GROWTH_X times slower than a regular pet: stages 2-5 = THRESHOLDS x 100 and hatch
   * COMMUNITY_HATCH. That is exactly WIZARD_THRESHOLDS (834,900 / 2,214,900 / 4,146,900 / 6,906,900, hatch 69,000), so the Bitcoin Wizard's replay is unchanged. */
  var ACTIVATE_COMMUNITY_100X_BLOCK = 972250;      // Bitcoin tip 972244 + 6 at commit (Oct 19 2026, owner approved 9:19 PM CT)
  var COMMUNITY_GROWTH_X = 100, COMMUNITY_HATCH = 69000;
  var COMMUNITY_THRESHOLDS = THRESHOLDS.map(function (v, i) { return i === 0 ? 0 : i === 1 ? COMMUNITY_HATCH : v * COMMUNITY_GROWTH_X; });
  function communityThresholds(b) { return b != null && b >= ACTIVATE_COMMUNITY_100X_BLOCK ? COMMUNITY_THRESHOLDS : WIZARD_THRESHOLDS; }
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
  var SLOT_LABELS = { head: 'Headwear', face: 'Guise', back: 'Drip', hand: 'Grip', body: 'Outfits', feet: 'Footwear', weapon: 'Staff' }; /* 'weapon' = Wizard-only staff slot (WIZ_STAFF below), not in V2_SLOTS */
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
  /* ===== BREEDING V2 (owner approved Oct 21 2026 9:31 PM CT) =====================================================================
   * ACTIVATE_BREEDING_V2_BLOCK is THE GATE for both v2 breeding rules. Chosen at deploy time = chain tip + ~6 (tip 972,555 at build
   * time, Oct 21 2026 ~9:45 PM CT). If the deploy happens later, RESET THIS CONSTANT to the tip then + 6 before pushing to main.
   * (1) Lifetime cap: every pet (Nakamoto, hybrids, everyone alike; no special Naka x Naka rule, one normal 1,008-block cooldown) can
   *     breed BREED_CAP_V2 = 6 times counted from the gate (p.breedsV2, breeds at blocks >= the gate). Cost 690 per side unchanged.
   * (2) Body-part trading: hybrid children bred at/after the gate also inherit signature body parts (HYBRID_PARTS) from their non-body
   *     parents, drawn on top of the current hybrid look. Looks only (no stats), drawn from its OWN stream so no other draw moves.
   * Before the gate nothing changes: same replay for all history. */
  var ACTIVATE_BREEDING_V2_BLOCK = 972589; // <<< BREEDING V2 GATE: deploy Oct 22 2026, chain tip 972583 + 6 (owner approved 1:32 AM CT)
  var BREED_CAP_V2 = 6;
  function breedV2On(b) { return b != null && b >= ACTIVATE_BREEDING_V2_BLOCK; }
  /** breedsLeft(p, b): { used, cap, left } lifetime v2 breeds (display + rules); used counts breeds at/after the gate only. */
  function breedsLeft(p, b) { var u = (p && p.breedsV2) || 0; return { used: u, cap: BREED_CAP_V2, left: Math.max(0, BREED_CAP_V2 - u), on: breedV2On(b) }; }
  /* RUG ME (branch rug-me, Oct 22 2026; owner-approved design in design/breed-board.md; PREVIEW, NOT LIVE). A swipe board for breeding.
   *   pet:ad:IDS:REQ   69 per pet  post Rug Me ads: IDS = one pet id or several dot-joined (12.34.56, each its own ad), REQ = ANY or up
   *                          to 4 dot-joined codes (T1-3 tier+, S3-5 stage+, P<species|HYB>, G<gear id the pet owns, worn or in the bag>,
   *                          W<n> power+). The bio is always random (picked in the UI from ad tx hash + pet); an old-format trailing :Bn field
   *                          is accepted and ignored. The whole tag must fit MAX_TAG_BYTES (34); a malformed / overlong tag is rejected WITH a
   *                          reason. One open ad per pet, open AD_WINDOW = 1,008 blocks. A pet on breeding cooldown may post (the ad just waits).
   *                          Every pet in the tag must pass, or the burn is rejected.
   *   pet:rug:ID:N     690   accept ad N with my pet ID: breeds AT ONCE through breed(); the EGG GOES TO THE POSTER (the poster pet is parent A).
   *                          The accepter's pet counts a breed too (cooldown + cap).
   *   pet:unad:N       1 dander  the poster cancels ad N (no refund).
   *   Prices follow the halving / fire sale through costAt (replay: below(); UI: planAmount), like breed. From the gate, a valid pet:ad / pet:rug
   *   burn that pays the full (era) price during a live Fire Sale earns one saved spin, like the other burns (fireCredit).
   * An ad closes if the poster pet dies or is released or changes owner. Before ACTIVATE_RUGME_BLOCK every one of these tags replays exactly
   * as today ('unknown pet: tag (community food)'). No randomness: nothing here draws from a block hash except breed() itself.
   * World state is created LAZILY (w.ads) only when a post-gate tag succeeds, so replays before the gate hash the same. */
  var ACTIVATE_RUGME_BLOCK = 972696; // <<< RUG ME GATE: live at deploy Oct 22 2026 (tip 972690 + 6).
  var AD_WINDOW = 1008, RUG_MAX_CODES = 4;
  function rugOn(b) { return ACTIVATE_RUGME_BLOCK != null && b != null && b >= ACTIVATE_RUGME_BLOCK; }
  /* BREED 135 (owner Oct 22 2026 9:23 + 9:25 PM): from ACTIVATE_BREED_135_BLOCK EVERY breed burn costs BREED_135 = 135 instead of 690:
   * own-pet pet:breed 135; two-owner pet:breed request 135 + accept 135 = 270; Rug Me pet:rug 135 (post stays 69 per pet, so a Rug Me breed totals 204).
   * Halving halves it (67.5), fire sale / fire-sale credit use it as the full cost. Burns before the gate keep the 690 rules exactly (replay SAME). */
  var ACTIVATE_BREED_135_BLOCK = 972703; // <<< BREED 135 GATE: live at deploy Oct 22 2026 (tip 972697 + 6).
  var BREED_135 = 135, RUG_ACCEPT_COST = BREED_135;
  function breed135On(b) { return ACTIVATE_BREED_135_BLOCK != null && b != null && b >= ACTIVATE_BREED_135_BLOCK; }
  function breedCost(b) { return breed135On(b) ? BREED_135 : COSTS.breed; } /* base before halving / fire sale */
  var rugCost = breedCost;
  /** uiBreedFee(): UI only. One breed burn (pet:breed side / pet:rug) at the next block (halving, fire sale, 135 gate); 690 if the UI is not ready. */
  function uiBreedFee() { try { var U = window.V2UI, w = U && U.world && U.world(), b = ((U && U.S && U.S().tip) || 0) + 1; return w ? costAt(w, breedCost(b), b) : breedCost(b); } catch (e) { return COSTS.breed; } }
  function uiBreedFeeStr() { return Number(uiBreedFee()).toLocaleString('en-US'); }
  /** parseReq('T2.S4.PPEPE.GJEWELED-CROWN.W60' | 'ANY') -> { tier, stage, species, gear, power } (only the codes given) or null if malformed. */
  function Buffer_len(x) { try { return unescape(encodeURIComponent(x)).length; } catch (e) { return String(x).length; } }
  /** reqWhy(code, petId): null when the standards are valid AND pet:ad:ID:REQ fits MAX_TAG_BYTES, else the reason (rules + UI share it). */
  function reqWhy(code, petId) { var raw = String(code == null ? '' : code), c = raw.toUpperCase(), tag = adTag(petId, raw), n = Buffer_len(tag);
    if (n > MAX_TAG_BYTES) return 'Rug Me: tag too long (' + n + ' bytes, max ' + MAX_TAG_BYTES + ')';
    if (!/^[A-Z0-9.-]+$/.test(c)) return 'Rug Me: standards may only use letters, digits, . and - (' + raw + ')';
    if (c === 'ANY') return null; var parts = c.split('.'); if (parts.length > RUG_MAX_CODES) return 'Rug Me: at most ' + RUG_MAX_CODES + ' standards (' + parts.length + ' given)';
    var seen = {}; for (var i = 0; i < parts.length; i++) { var k = parts[i][0] || ''; if (seen[k]) return 'Rug Me: standard ' + k + ' given twice'; seen[k] = 1;
      if (!parts[i] || parts[i] === 'ANY' || !parseReq(parts[i])) return 'Rug Me: bad standards code ' + (parts[i] || '(empty)'); }
    return parseReq(c) ? null : 'Rug Me: bad standards code ' + raw; }
  function parseReq(code) { code = String(code || '').toUpperCase(); if (code === 'ANY' || code === '') return {}; var q = {}, parts = code.split('.'); if (parts.length > RUG_MAX_CODES) return null;
    for (var i = 0; i < parts.length; i++) { var c = parts[i], k = c[0], v = c.slice(1), m;
      if (k === 'T' && /^[1-3]$/.test(v) && q.tier == null) q.tier = +v;
      else if (k === 'S' && /^[3-5]$/.test(v) && q.stage == null) q.stage = +v;
      else if (k === 'W' && /^[1-9][0-9]{0,2}$/.test(v) && q.power == null) q.power = +v;
      else if (k === 'P' && q.species == null && (v === 'HYB' || (/^[A-Z]{2,12}$/.test(v) && PetCore.SPECIES.some(function (s) { return s.id === v.toLowerCase(); })))) q.species = v.toLowerCase();
      else if (k === 'G' && q.gear == null && /^[A-Z0-9-]{2,19}$/.test(v) && BY_ID[resolveItem(v.toLowerCase())]) q.gear = resolveItem(v.toLowerCase());
      else return null; }
    return q; }
  function reqTag(q) { q = q || {}; var o = []; if (q.tier) o.push('T' + q.tier); if (q.stage) o.push('S' + q.stage); if (q.species) o.push('P' + q.species.toUpperCase()); if (q.gear) o.push('G' + q.gear.toUpperCase()); if (q.power) o.push('W' + q.power); return o.length ? o.join('.') : 'ANY'; }
  function reqText(q) { q = q || {}; var o = [], ST = ['', '', '', 'Adult', 'Elder', 'Mythic'];
    if (q.tier) o.push(TIER_LABELS[q.tier] + (q.tier < 3 ? '+' : '')); if (q.stage) o.push(ST[q.stage] + (q.stage < 5 ? '+' : '')); if (q.species) o.push(q.species === 'hyb' ? 'Hybrid' : speciesLabel(q.species));
    if (q.gear) { var it = BY_ID[q.gear]; o.push('owns ' + (it ? it.label : q.gear)); } if (q.power) o.push('Power ' + q.power + '+'); return o.length ? o.join(' · ') : 'Anyone'; }
  function petPower(p) { var s = (p && p.stats) || {}; return ['vigor', 'spark', 'grit', 'zoom', 'luck'].reduce(function (a, k) { return a + (s[k] || 0); }, 0); }
  /** ownsGear: gear the pet owns = an item of the pet's owner that the pet wears or keeps in its bag. */
  function ownsGear(w, p, id) { var it = w.items || {}; for (var g in it) { var x = it[g]; if (x && x.owner === p.owner && (x.on === p.id || x.bag === p.id) && resolveItem(x.item) === id) return true; } return false; }
  /** meetsReq(w, p, q): null when pet p meets the ad standards q, else the first missing standard (player-facing). */
  function meetsReq(w, p, q) { q = q || {}; if (!p) return 'no such pet';
    if (q.tier && (p.tier || 0) < q.tier) return 'needs ' + TIER_LABELS[q.tier] + (q.tier < 3 ? ' or better' : '');
    if (q.stage && (p.stage || 0) < q.stage) return 'needs ' + ['', '', '', 'Adult', 'Elder', 'Mythic'][q.stage] + (q.stage < 5 ? ' or older' : '');
    if (q.species && (q.species === 'hyb' ? !isHybrid(p.species) : p.species !== q.species)) return 'needs ' + (q.species === 'hyb' ? 'a Hybrid' : speciesLabel(q.species));
    if (q.gear && !ownsGear(w, p, q.gear)) return 'needs to own ' + ((BY_ID[q.gear] || {}).label || q.gear);
    if (q.power && petPower(p) < q.power) return 'needs Power ' + q.power + '+ (has ' + petPower(p) + ')'; return null; }
  /** adState(w, ad, b): 'open' | 'taken' | 'cancelled' | 'expired' | 'closed' (poster pet dead, released or no longer the poster's). */
  function adState(w, ad, b) { if (ad.state !== 'open') return ad.state; var P = w.byId[ad.pet]; if (!P || P.dead || P.released || P.owner !== ad.owner) return 'closed'; return b - ad.block >= AD_WINDOW ? 'expired' : 'open'; }
  var RUG_AD_COST = 69; /* owner, Oct 22 8:42 PM: posting costs 69 per pet; accepting (pet:rug) is breedCost(b): 690 (total 759) before ACTIVATE_BREED_135_BLOCK, 135 (total 204) from it */
  /** onRug(w, p, b): p has an open Rug Me ad (shown as a card, and 'On Rug Me' on its pet page). */
  function onRug(w, p, b) { return !!(p && (w.ads || []).some(function (a) { return a.pet === p.id && adState(w, a, b) === 'open'; })); }
  /** adTag(ids, req): the pet:ad tag text (no bio field: bios are picked from tx hash + pet). */
  function adTag(ids, req) { return 'pet:ad:' + [].concat(ids).join('.') + ':' + (req || 'ANY'); }
  /** adWhy(p, b): can p post an ad? breedable() minus the cooldown (a resting pet may post; the accept still needs both breedable). */
  function adWhy(p, b) { var why = breedable(p, b); return why && /^breeding cooldown/.test(why) ? null : why; }
  /** rugCheck(w, t, src, b, amt, P): shared by replay (handle) and the send guard. Returns null or the rejection reason. P(id) -> pet. */
  function rugCheck(w, t, src, b, amt, P) { var ads = w.ads || [], ad, A, B, why;
    if (t.action === 'ad') { var ids = t.ids || [t.petId], n = ids.length;
      if (t.bad) return 'Rug Me: ' + t.bad;
      if (t.len != null && t.len > MAX_TAG_BYTES) return 'Rug Me: tag too long (' + t.len + ' bytes, max ' + MAX_TAG_BYTES + ')';
      why = reqWhy(t.req, ids); if (why) return why;
      if (amt != null && below(w, amt, RUG_AD_COST * n, b)) return 'below Rug Me ad cost ' + costAt(w, RUG_AD_COST * n, b) + (n > 1 ? ' (' + n + ' pets, ' + costAt(w, RUG_AD_COST, b) + ' each)' : '');
      for (var k = 0; k < n; k++) { A = P(ids[k]); if (!A || A.owner !== src) return 'Rug Me: #' + ids[k] + ' is not yours'; why = adWhy(A, b); if (why) return 'Rug Me: #' + A.id + ' ' + why;
        if (onRug(w, A, b)) return 'Rug Me: #' + A.id + ' already has an open ad'; }
      return null; }
    if (t.action === 'unad') { ad = ads[t.adId - 1]; if (!ad) return 'Rug Me: no ad ' + t.adId; if (ad.owner !== src) return 'Rug Me: ad ' + t.adId + ' is not yours'; why = adState(w, ad, b); return why === 'open' ? null : 'Rug Me: ad ' + t.adId + ' is ' + why; }
    if (t.action === 'rug') { if (amt != null && below(w, amt, rugCost(b), b)) return 'below Rug Me cost ' + costAt(w, rugCost(b), b); ad = ads[t.adId - 1]; if (!ad) return 'Rug Me: no ad ' + t.adId;
      why = adState(w, ad, b); if (why !== 'open') return 'Rug Me: ad ' + t.adId + ' is ' + why; if (ad.owner === src) return 'Rug Me: that is your own ad';
      B = P(t.petId); if (!B || B.owner !== src) return 'Rug Me: #' + t.petId + ' is not yours'; A = P(ad.pet);
      why = breedWhy(A.id, breedable(A, b)) || breedWhy(B.id, breedable(B, b)); if (why) return why; if (breedV2On(b) && kinWhy(A, B)) return '#' + A.id + ' x #' + B.id + ': ' + kinWhy(A, B) + ' (no inbreeding)';
      why = meetsReq(w, B, ad.req); return why ? 'Rug Me: #' + B.id + ' ' + why : null; }
    return null; }
  /** openAds(w, tip, opt): open ads at the next block, newest first (by post block, then ad number). */
  function openAds(w, tip, opt) { var b = (tip || w.tip || 0) + 1; return (w.ads || []).filter(function (a) { return adState(w, a, b) === 'open'; })
    .sort(function (x, y) { return y.block - x.block || y.id - x.id; }); }
  var RARITY_UP_10K = 500, RARITY_HIGH_10K = 3000;                  // 5% one tier above best parent; 30% the higher parent; else the lower
  var TIER_LABELS = ['Common', 'Uncommon', 'Rare', 'Legendary'];
  var NAKAMOTO_CAST_STAGE = 3;         // Nakamoto joins the front-page Cast once any hatched Nakamoto reaches this stage (3 = Adult; set 5 for Mythic)
  /** castShowsNakamoto(w): true once any hatched Nakamoto (dead/released ones count: they reached it) is at NAKAMOTO_CAST_STAGE or higher. */
  function castShowsNakamoto(w) { return !!(w && w.pets || []).some(function (p) { return p.species === 'nakamoto' && p.stage >= NAKAMOTO_CAST_STAGE; }); }

  // ---------------------------------------------------------------- helpers
  function sha(s) { return PetCore.sha256Hex(String(s)); }
  function stream(seed) { var n = 0, buf = '', i = 0; return function () { if (i + 8 > buf.length) { buf = sha(seed + ':' + (n++)); i = 0; } var v = parseInt(buf.slice(i, i + 8), 16); i += 8; return v; }; }
  function day(b) { return Math.floor(b / BLOCKS_PER_DAY); }
  /** streakOf(w, addr, tip) -> { current, best, today, days, last, state }. current = consecutive WAGMI chain days ending today (or yesterday while
   * today is still open: the streak lives until a FULL chain day is missed). state: 'wagmi' (streak alive), 'ngmi' (said WAGMI before, then missed
   * a whole chain day: streak reset to 0), 'new' (never said WAGMI). */
  function streakOf(w, addr, tip) { var c = (w && w.wagmi && w.wagmi[addr]) || {}, ds = Object.keys(c).map(Number).sort(function (a, b) { return a - b; }), best = 0, run = 0, prev = null;
    ds.forEach(function (d) { run = prev != null && d === prev + 1 ? run + 1 : 1; prev = d; if (run > best) best = run; });
    var t = day(tip != null ? tip : w.tip), d = c[t] ? t : t - 1, cur = 0; while (c[d]) { cur++; d--; }
    return { current: cur, best: best, today: !!c[t], days: ds.length, last: prev, state: cur ? 'wagmi' : ds.length ? 'ngmi' : 'new' }; }
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
  /* WIZARD FIXED TIER (owner Oct 20 2026 6:48 PM CT: "all nakas were legendary... lets just knock him down 1 tier"). From ACTIVATE_WIZ_TIER_BLOCK
   * every player Bitcoin Wizard is exactly WIZ_FIXED_TIER = 2 (Rare), one below Nakamoto's fixed Legendary, mirroring the Nakamoto rule:
   * (1) new Wizard eggs (1-in-777 hatch slot, grants) come out Rare (wizardArt: same seed, tier set, stat bonus difference applied);
   * (2) a pure Wizard breed child is Rare (Wizards can't breed yet; hybrids keep their bred tier, like Nakamoto hybrids);
   * (3) every existing player Wizard is set to Rare ONCE when replay first reaches the block (before that block's burns), stats get the
   *     PetCore tier bonus difference (min 1), looks kept, like the 971,669 Nakamoto relabel. Community pet and hybrids untouched. Before: unchanged. */
  var ACTIVATE_WIZ_TIER_BLOCK = 972399;  // Bitcoin tip 972,393 + 6 at build time (Oct 20 2026 ~6:50 PM CT)
  var WIZ_FIXED_TIER = 2;
  function wizTierOn(b) { return ACTIVATE_WIZ_TIER_BLOCK != null && b != null && b >= ACTIVATE_WIZ_TIER_BLOCK; }
  function setWizTier(o, statsKey, to) { var m = to != null ? to : WIZ_FIXED_TIER; if (o.tier == null || o.tier === m) return null;
    var d = PetCore.TIERS[m].statBonus - PetCore.TIERS[o.tier].statBonus, from = o.tier; Object.keys(o[statsKey]).forEach(function (k) { o[statsKey][k] = Math.max(1, o[statsKey][k] + d); }); o.tier = m; return { from: from, to: m, bonus: d }; }
  function wizTierRelabel(w, b) { if (w.wizTierRelabeled || !wizTierOn(b)) return; w.wizTierRelabeled = ACTIVATE_WIZ_TIER_BLOCK;
    w.pets.forEach(function (p) { if (p.community || p.hybrid || (p.art && p.art.hybrid) || p.species !== 'wizard') return; var r = setWizTier(p, 'stats'); if (!r) return;
      if (p.art) { p.art.tierIndex = p.tier; p.art.tier = PetCore.TIERS[p.tier].id; } p.wizTier = { block: ACTIVATE_WIZ_TIER_BLOCK, from: r.from, to: r.to, bonus: r.bonus }; }); }
  /* WIZARD RARE-AND-UP (owner Oct 20 2026 7:43 PM CT: "some wizards should be legendary too, rare and legendary. the player prize wizards should be
   * legendary. so you can roll wizard rare and up"). Supersedes the fixed-Rare rule from ACTIVATE_WIZ_TIER2_BLOCK:
   * (1) granted/prize Wizards (priorityGrant, top3Grant: #16822, #17543, #17544, #17545) are Legendary;
   * (2) egg-rolled Wizards roll Rare or Legendary (the tier ladder tops out at Legendary; Mythic is a stage, not a tier). Odds = the normal egg
   *     ladder restricted to Rare and up: Rare 1000 : Legendary 300 (Rare 76.92%, Legendary 23.08%). Draw = sha(seed id + ':' + hatch block +
   *     'XCPETS:v2:wiztier') first 12 hex mod 1300 < 300 -> Legendary. Seed id = the egg's hatch seed (tx or tx:i = pet.hatchTx), deterministic.
   *     (The plain 3% Legendary floor-at-Rare roll was rejected: with Wizards at 1 in 777 eggs that is ~1 Legendary Wizard per 26,000 eggs.)
   * (3) existing player Wizards are re-tiered ONCE when replay first reaches the block (stats get the tier bonus difference, looks kept);
   *     new Wizard eggs from the block use the roll; a pure Wizard breed child is floored at Rare. Hybrids and the community pet untouched. */
  var ACTIVATE_WIZ_TIER2_BLOCK = 972404;  // Bitcoin tip 972398 + 6 at build time (Oct 20 2026 ~7:55 PM CT)
  var WIZ_RARE_W = 1000, WIZ_LEG_W = 300;
  function wizTier2On(b) { return ACTIVATE_WIZ_TIER2_BLOCK != null && b != null && b >= ACTIVATE_WIZ_TIER2_BLOCK; }
  function wizRollTier(id, b) { return specialRollTier('wizard', id, b); } /* same salt + odds as before (now via the shared COMMUNITY-SPECIES TIER roll) */
  function wizTier2Relabel(w, b) { if (w.wizTier2Relabeled || !wizTier2On(b)) return; w.wizTier2Relabeled = ACTIVATE_WIZ_TIER2_BLOCK;
    w.pets.forEach(function (p) { if (p.community || p.hybrid || (p.art && p.art.hybrid) || p.species !== 'wizard') return;
      var to = (p.priorityGrant || p.top3Grant) ? 3 : wizRollTier(p.hatchTx, p.hatchBlock); var r = setWizTier(p, 'stats', to); if (!r) return;
      if (p.art) { p.art.tierIndex = p.tier; p.art.tier = PetCore.TIERS[p.tier].id; } p.wizTier2 = { block: ACTIVATE_WIZ_TIER2_BLOCK, from: r.from, to: r.to, bonus: r.bonus }; }); }
  /* COMMUNITY-SPECIES TIER (owner approved Oct 24 2026 ~4:16 AM CT): every community-pet species (Bitcoin Wizard, Lord Kek, FUNTRUMP, and any later
   * one: add it to SPECIAL_TIER) hatches only Rare or Legendary with ONE shared re-roll: sha(seed id + ':' + hatch block + salt) first 12 hex
   * mod (SPECIAL_RARE_W + SPECIAL_LEG_W) < SPECIAL_LEG_W -> Legendary (23.08%), else Rare (76.92%). Wizard and FUNTRUMP keep their exact old salts,
   * so their outcomes are unchanged. Nakamoto stays fixed Legendary (no new Nakamotos hatch). From ACTIVATE_SPECIAL_TIER_BLOCK: Lord Kek eggs use
   * the roll (kekArt) and a pure bred Lord Kek child is floored at Rare (breedOne). Existing pets keep their tier (no relabel). OFF while null. */
  var ACTIVATE_SPECIAL_TIER_BLOCK = 972912; // LIVE: tip 972906 + 6 (owner approved deploy Oct 24 2026 4:16 AM CT)
  var SPECIAL_RARE_W = 1000, SPECIAL_LEG_W = 300;
  var SPECIAL_TIER = { nakamoto: { fixed: 3 }, wizard: { salt: 'XCPETS:v2:wiztier' }, funtrump: { salt: 'XCPETS:v2:fttier' }, kek: { salt: 'XCPETS:v2:kektier' } };
  function specialTierOn(b) { return ACTIVATE_SPECIAL_TIER_BLOCK != null && b != null && b >= ACTIVATE_SPECIAL_TIER_BLOCK; }
  function isSpecialSpecies(sp) { return !!SPECIAL_TIER[sp]; }
  function specialRollTier(sp, id, b) { var R = SPECIAL_TIER[sp]; if (!R) return null; if (R.fixed != null) return R.fixed;
    return parseInt(sha(String(id) + ':' + b + R.salt).slice(0, 12), 16) % (SPECIAL_RARE_W + SPECIAL_LEG_W) < SPECIAL_LEG_W ? 3 : 2; }
  /** setArtTier(art, t): move a freshly generated egg to tier t (stats get the PetCore tier bonus difference, min 1; looks kept). */
  function setArtTier(art, t) { if (!PetCore.TIERS[t] || art.tierIndex === t) return art; var d = PetCore.TIERS[t].statBonus - PetCore.TIERS[art.tierIndex].statBonus;
    Object.keys(art.baseStats).forEach(function (k) { art.baseStats[k] = Math.max(1, art.baseStats[k] + d); }); art.tierIndex = t; art.tier = PetCore.TIERS[t].id; return art; }
  var LEG_KEYS = ['tier', 'tierIndex', 'pattern', 'eyes', 'band', 'armor', 'cape', 'weapon', 'crown', 'baseStats'];
  /* NO NEW NAKAMOTO (owner rule, approved for live Oct 20 2026 8:45 AM CT): "The Nakamoto egg gets replaced by the wizard eggs ... no Nakamoto will
   * ever be hatched again." From ACTIVATE_NO_NAKA_BLOCK the same 1-in-777 draw (sha(bh + id + 'XCPETS:v2:naka777') mod 777 == 0, single hatch + packs)
   * gives a player Bitcoin Wizard (wizardArt: normal egg roll, species 'wizard', normal pet growth) instead of Nakamoto. Existing Nakamotos are kept.
   * Breeding is NOT changed by this rule. Before the block: unchanged. */
  var ACTIVATE_NO_NAKA_BLOCK = 972338;  // Bitcoin tip 972,332 + 6 at build time (Oct 20 2026 ~8:50 AM CT)
  function noNakaOn(b) { return b != null && b >= ACTIVATE_NO_NAKA_BLOCK; }
  /* WIZARD EGG PRIORITY GRANT (owner approved Oct 20 2026 ~4:35 PM CT): recorded pet:hatchwiz burns made before the Wizard egg existed
   * (rejected as community food at the time; list = design/wizard-egg-priority.json) are honoured ONCE at ACTIVATE_WIZ_PRIORITY_BLOCK.
   * Each grant = one player Bitcoin Wizard for the burner, art = wizardArt(hash of the burn's block, burn tx, burn block) exactly like the
   * pet:hatchwiz rule (rolled tier, WIZ_EGG_TIER), born at the gate block with hatch care. Only listed txs that are in the replayed burns and
   * were rejected get a pet. From the same block pet:hatchwiz is CLOSED (rejected like an unknown tag): the Wizard is roll-only (1 in 777). Pet ids are taken in list order before any other burn at/after the gate. No public egg buy is enabled. */
  var ACTIVATE_WIZ_PRIORITY_BLOCK = 972387;  // Bitcoin tip 972,381 + 6 at build time (Oct 20 2026 ~4:37 PM CT)
  var WIZ_PRIORITY = [ /* [tx, address, block, block hash] */
    ['7b82b46bd74b85b4da47f47ce7b7388173e77a92008d24691e01fcff3298dab0', 'bc1qtke38j72qv4d8eljn7pccaykypw8luytfwdn7q', 972251, '0000000000000000000086415853c8ad3426118653b976c5ca094b4965a267da'] ];
  function grantWizPriority(w, b) { if (w.wizPriorityGranted || b == null || b < ACTIVATE_WIZ_PRIORITY_BLOCK) return; w.wizPriorityGranted = ACTIVATE_WIZ_PRIORITY_BLOCK;
    WIZ_PRIORITY.forEach(function (g) { var rej = w.log.some(function (l) { return l.tx === g[0] && l.kind === 'rejected'; }); if (!rej) return;
      var p = mk(w, g[1], wizardArt(g[3], g[0], g[2]), ACTIVATE_WIZ_PRIORITY_BLOCK, COSTS.hatch, g[0]); p.priorityGrant = { tx: g[0], block: g[2] };
      w.log.push({ block: ACTIVATE_WIZ_PRIORITY_BLOCK, tx: g[0], kind: 'hatch', msg: 'priority Wizard egg: hatched #' + p.id + ' Bitcoin Wizard (honours pet:hatchwiz burn at block ' + g[2] + ')', petId: p.id }); }); }
  /* TOP-3 BURNER WIZARD GRANT (owner approved Oct 20 2026 4:51 PM CT): one player Bitcoin Wizard each to the top 3 wallets by total XCPETS
   * destroyed all time, ranked as of cutoff block 972,381 (inclusive; api.xcp.fun destructions, 885 valid burns). Addresses hardcoded (not re-ranked
   * in replay). Given ONCE at ACTIVATE_TOP3_WIZ_BLOCK, after the priority grant; art = wizardArt(hash of block 972,381, 'XCPETS:top3wiz:'+rank, 972381)
   * = rolled tier like the priority grant; born at the gate with hatch care; ids in rank order before any other burn at/after the gate. */
  var ACTIVATE_TOP3_WIZ_BLOCK = 972389;  // Bitcoin tip 972,383 + 6 at build time (Oct 20 2026 ~4:58 PM CT)
  var TOP3_CUTOFF = [972381, '0000000000000000000121ce41b04ea7a5aee55229f4dfa976a6b1a8da216d8e'];
  var TOP3_WIZ = [ /* [rank, address, XCPETS burned to cutoff] */
    [1, 'bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n', 2844920],
    [2, 'bc1pfvkpmllr7mtn5uazqxumwp39h2ny3c8l6fmrgvjv2cqn5wlpt7hssf3gqd', 1720314],
    [3, 'bc1qtke38j72qv4d8eljn7pccaykypw8luytfwdn7q', 1202049] ];
  function grantTop3Wiz(w, b) { if (w.top3WizGranted || b == null || b < ACTIVATE_TOP3_WIZ_BLOCK) return; w.top3WizGranted = ACTIVATE_TOP3_WIZ_BLOCK;
    TOP3_WIZ.forEach(function (g) { var seed = 'XCPETS:top3wiz:' + g[0];
      var p = mk(w, g[1], wizardArt(TOP3_CUTOFF[1], seed, TOP3_CUTOFF[0]), ACTIVATE_TOP3_WIZ_BLOCK, COSTS.hatch, seed); p.top3Grant = { rank: g[0], cutoff: TOP3_CUTOFF[0] };
      w.log.push({ block: ACTIVATE_TOP3_WIZ_BLOCK, tx: seed, kind: 'hatch', msg: 'top-3 burner reward: hatched #' + p.id + ' Bitcoin Wizard (rank ' + g[0] + ' by XCPETS burned to block ' + TOP3_CUTOFF[0] + ')', petId: p.id }); }); }
  /* BURN LORDS (owner decision Oct 24 2026, PREVIEW branch burn-lords): ONE-TIME grant. Each of the top 3 all-time burner wallets gets ONE free
   * Legendary Lord Kek + Bitcoin Wizard hybrid, a 'Burn Lord edition' (1 of 3, 2 of 3, 3 of 3) that breeding can never make.
   *   Ranking: w.burnedBy (the same totals the Rankings 'Top burners' board and walletBurned use: every valid burn, all actions) frozen at the END
   *     of BURN_LORDS_SNAPSHOT_BLOCK = 973,300 (owner, Oct 24 2026 ~6:55 PM CT; tip was 972,992): burns in 973,300 count, later ones never do.
   *   Grant: at the first processed block >= 973,301 (the first burn row after the snapshot, or the tip once it passes 973,300).
   *   Tie-break (deterministic): higher total first; equal totals -> the wallet whose FIRST burn came earlier in chain order (burnedBy key
   *     insertion order = first valid burn row); still equal -> address string ascending.
   *   Pet: G = that grant block, gh = its block hash (waits until the hash is known; ranking already frozen). Body: always the blue Wikek
   *     (see BURN LORD LOOK below); plan from hybridPlan0(sha(gh + 'XCPETS:burnlords:' + rank), key),
   *     art seed = same hash; tier forced to Legendary (3) with the tier stat bonus difference; born at G with hatch care; ids in rank order.
   *   p.burnLord = { n, of: 3, rank, total, gate: snapshot block }: permanent edition flag, drawn as the exclusive fiery crown + gold frame (V2Render)
   *     and the 'Burn Lord' badge; breedOne never copies it, so offspring never get it. w.burnLordsGranted makes it fire once: exactly 3 pets ever. */
  var BURN_LORDS_SNAPSHOT_BLOCK = 973300, BURN_LORDS_N = 3;
  function burnLordsRank(w) { var keys = Object.keys(w.burnedBy || {}), ix = {}; keys.forEach(function (a, i) { ix[a] = i; });
    return keys.filter(function (a) { return w.burnedBy[a] > 0; }).sort(function (a, b) { return (w.burnedBy[b] - w.burnedBy[a]) || (ix[a] - ix[b]) || (a < b ? -1 : a > b ? 1 : 0); })
      .slice(0, BURN_LORDS_N).map(function (a, i) { return { rank: i + 1, address: a, total: w.burnedBy[a] }; }); }
  /* BURN LORD LOOK (owner Oct 24 2026 7:08 PM CT: 'the FIRST preview', 7e0386b): every Burn Lord is Wikek (hyb:wizard:kek) in exactly the blue look of
   * Burn Lord 1 of 3 in that preview: Kek-shaped base recoloured with the Bitcoin Wizard colours (blue #2f6fe0 robe/body, gold accent) wearing the traded
   * Wizard hat (parts = [wizard hat], which replaces the nemes), so it reads as a blue Wizard body. No hash-picked flip; no lapis recolour. Eyes and the
   * feature slot, names and stat rolls still come from the block hash. */
  var BURN_LORD_KEY = 'hyb:wizard:kek';
  function burnLordArt(gh, rank, gate) { var seed = 'XCPETS:burnlords:' + rank, hex = sha(gh + seed), key = BURN_LORD_KEY;
    var art = PetCore.generate({ blockHash: gh, petId: seed, blockHeight: gate }), L0 = PetCore.TIERS[art.tierIndex], L1 = PetCore.TIERS[3], d = L1.statBonus - L0.statBonus;
    Object.keys(art.baseStats).forEach(function (k) { art.baseStats[k] = Math.max(1, art.baseStats[k] + d); }); art.tierIndex = 3; art.tier = L1.id;
    var plan = hybridPlan0(hex, key); plan.shape = 'kek'; plan.color = 'wizard'; plan.parts = [{ sp: 'wizard', part: 'hat' }];
    art.species = plan.shape; art.hybrid = plan; return { art: noBornShades(art), key: key, seed: seed }; }
  function grantBurnLords(w, b, hashes) { var S = BURN_LORDS_SNAPSHOT_BLOCK; if (S == null || w.burnLordsGranted || b == null || b <= S) return;
    if (!w.burnLordsSnap) w.burnLordsSnap = burnLordsRank(w); var G = b, gh = hashes && hashes[G]; if (!gh) return; w.burnLordsGranted = G;
    w.burnLordsSnap.forEach(function (g) { var a = burnLordArt(gh, g.rank, G), p = mk(w, g.address, a.art, G, COSTS.hatch, a.seed); p.species = a.key; p.hybrid = a.art.hybrid;
      p.burnLord = { n: g.rank, of: BURN_LORDS_N, rank: g.rank, total: Math.round(g.total * 100) / 100, gate: S };
      w.log.push({ block: G, tx: a.seed, kind: 'hatch', msg: 'Burn Lords: hatched #' + p.id + ' ' + hybridName(a.key) + ', Burn Lord ' + g.rank + ' of ' + BURN_LORDS_N + ' (rank ' + g.rank + ' by XCPETS burned to the end of block ' + S + ')', petId: p.id }); }); }
  /** hatchArt(bh, id, b): the art for one hatched egg (seed id = tx or tx:i), species set. */
  function hatchArt(bh, id, b) { var art = PetCore.generate({ blockHash: bh, petId: id, blockHeight: b }), spHex = sha(bh + id + 'XCPETS:v2:species');
    if (!naka777(b)) { art.species = pickSpecies(spHex); return art; }
    if (parseInt(sha(bh + id + 'XCPETS:v2:naka777').slice(0, 12), 16) % 777 !== 0) { art.species = tierSpeciesOn(b) ? pickTierSpecies(sha(bh + id + 'XCPETS:v2:tierspecies'), art.tierIndex, b) : pickSpecies12(spHex); return art; }
    if (b >= FT_POOL_FROM) return ftArt(bh, id, b); /* FUNTRUMP egg takes Lord Kek's 1-in-777 slot after FUNTRUMP's own Cold Storage (FT_POOL_FROM is Infinity until FUNTRUMP's Cold Storage) */
    if (b >= KEK_POOL_FROM) return kekArt(bh, id, b); /* LORD KEK egg takes the Wizard's 1-in-777 slot after his Cold Storage (gated, see ACTIVATE_KEK_BLOCK) */
    if (noNakaOn(b)) return wizardArt(bh, id, b); /* NO NEW NAKAMOTO (owner Oct 20 2026): the 1-in-777 egg is now a Bitcoin Wizard egg */
    var L = PetCore.generate({ blockHash: bh, petId: id, blockHeight: b, community: true }); /* same seed, tier forced 3 */
    LEG_KEYS.forEach(function (k) { art[k] = L[k]; }); if (!art.bgV2) art.background = L.background; art.species = 'nakamoto'; return art; }
  /* ELECTRIC EGGS (owner request Oct 24 2026 5:58 PM CT, live from ACTIVATE_ELECTRIC_BLOCK): pet:hatchzap = ONE burn hatches ELECTRIC_N = 1,000
   * Electric Eggs for ELECTRIC_COST = 100,000 base (halving / Fire Sale apply like every hatch: era 1 = 50,000). Each egg i (0-999) is seeded with
   * '<tx>:i' like a pack egg, then its tier is RE-ROLLED on the boosted ladder sha(bh + id + 'XCPETS:v2:electric') first 12 hex mod 10,000:
   * Legendary 800 / Rare 2,200 / Uncommon 4,000 / Common 3,000 (normal eggs: 300 / 1,000 / 2,700 / 6,000). Stats get the tier bonus difference
   * (setArtTier), looks kept; the species is then picked from that tier's pool exactly like a normal egg (species odds inside a tier unchanged),
   * and the 1-in-777 special-egg slot is unchanged. Mythic is a growth STAGE (feeding), not a hatch tier, so no egg hatches Mythic.
   * Below ACTIVATE_ELECTRIC_BLOCK (and while null) pet:hatchzap replays exactly as today: an unknown pet: tag = plain burn (community food). */
  var ACTIVATE_ELECTRIC_BLOCK = 972992; // tip 972,986 (mempool.space, Oct 24 2026 ~6:30 PM CT, owner approved deploy 6:23 PM CT) + 6
  var ELECTRIC_N = 1000, ELECTRIC_COST = 100000, ELECTRIC_TIER_10K = [3000, 4000, 2200, 800]; /* Common, Uncommon, Rare, Legendary out of 10,000 */
  function electricOn(b) { return ACTIVATE_ELECTRIC_BLOCK != null && b != null && b >= ACTIVATE_ELECTRIC_BLOCK; }
  function electricTier(bh, id) { var r = parseInt(sha(bh + id + 'XCPETS:v2:electric').slice(0, 12), 16) % 10000, T = ELECTRIC_TIER_10K;
    return r < T[3] ? 3 : r < T[3] + T[2] ? 2 : r < T[3] + T[2] + T[1] ? 1 : 0; }
  /** electricArt(bh, id, b): one Electric Egg = a normal egg roll with the boosted tier, then the normal tier species pick / 1-in-777 slot. */
  function electricArt(bh, id, b) { var art = PetCore.generate({ blockHash: bh, petId: id, blockHeight: b });
    if (parseInt(sha(bh + id + 'XCPETS:v2:naka777').slice(0, 12), 16) % 777 === 0) return hatchArt(bh, id, b); /* special-egg slot: same as any egg */
    setArtTier(art, electricTier(bh, id)); art.species = pickTierSpecies(sha(bh + id + 'XCPETS:v2:tierspecies'), art.tierIndex, b); art.electric = 1; return art; }
  /* SPECIAL EGG NAMES (owner Oct 24 2026 1:19 AM CT): from this block, Bitcoin Wizard, Lord Kek and FUNTRUMP eggs (and FUNTRUMP bred children) keep the normal random
   * PetCore name instead of 'Wizard' / 'Kek' / 'FUNTRUMP'. Nakamoto eggs already got random names. Pets hatched before the gate keep their names, and the very first
   * Lord Kek egg ever hatched is named 'Kek' by mk() (none hatched as of snapshot 972,883). Names are in the replay pets hash, hence the gate. OFF while null. */
  var ACTIVATE_SPECIAL_NAMES_BLOCK = 972897; // LIVE: tip 972,891 + 6 (owner approved deploy Oct 24 2026 1:24 AM CT)
  function specialNamesOn(b) { return ACTIVATE_SPECIAL_NAMES_BLOCK != null && b >= ACTIVATE_SPECIAL_NAMES_BLOCK; }
  /** wizardArt(bh, id, b): a Bitcoin Wizard egg = a normal egg roll (tier, stats, background) with species 'wizard' (drawn by WizardSprite, blue palette). */
  function wizardArt(bh, id, b) { var art = PetCore.generate({ blockHash: bh, petId: id, blockHeight: b }), FT = wizTier2On(b) ? wizRollTier(id, b) : wizTierOn(b) ? WIZ_FIXED_TIER : WIZ_EGG_TIER; if (FT != null && PetCore.TIERS[FT]) { var L0 = PetCore.TIERS[art.tierIndex], L1 = PetCore.TIERS[FT], d = L1.statBonus - L0.statBonus;
      Object.keys(art.baseStats).forEach(function (k) { art.baseStats[k] = wizTierOn(b) ? Math.max(1, art.baseStats[k] + d) : art.baseStats[k] + d; }); art.tierIndex = FT; art.tier = L1.id; }
    art.species = 'wizard'; if (!specialNamesOn(b)) art.defaultName = 'Wizard'; return noBornShades(art); }
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
  function petThresholds(w, p, b) { var th = p && p.community && b != null && b >= ACTIVATE_COMMUNITY_100X_BLOCK ? COMMUNITY_THRESHOLDS : thresholdsFor(p.species, b); if (!p || p.community || !mythicDiscountOn(b) || !w || !w.mythicOwners) return th;
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
  function overflowRolls(w, p, pendingTags) { if (!p || w.tip == null || !mythicDiscountOn(w.tip) || spinsOn(w.tip + 1)) return { on: false, left: 0, pending: 0 }; /* saved spins: overflow is spent as wheel spins */
    var pend = (pendingTags || []).filter(function (t) { return String(t).toUpperCase() === 'PET:OF:' + p.id; }).length, left = Math.max(0, overflowLeft(w, p, w.tip) - pend);
    return { on: left > 0 && !p.dead && !p.released, left: left, pending: pend, earned: overflowEarned(w, p, w.tip) }; }
  /* GRAVE GEAR (2026-10-19, owner request 7:38 AM CT; REVIEW BRANCH, not live). Default unchanged: a pet that dies of neglect drops its worn gear back into the owner's bag
   * (finish(): on = null). From ACTIVATE_GRAVE_GEAR_BLOCK the owner can opt in, per pet, with a burn they sign themselves: pet:grave:ID (any amount, 1 sat of XCPETS is enough)
   * = "leave the gear it wears on the grave if it dies"; pet:grave:ID:off = cancel. Only while the pet is alive (a dead pet's flag is final). At death a flagged pet keeps
   * every piece it wears at that moment: on stays = the dead pet's id and grave = its id, so the piece can't be equipped elsewhere (applyOp/equipCheck refuse it);
   * the owner still owns and sees it. Before the block a pet:grave tag replays exactly as today (unknown pet: tag, community food). The block must be after the
   * deploy tip and BEFORE the first death block 972,432 (no pet has died yet, so no past result changes). Set at deploy (chain tip + 6). */
  /* Wizard hat clear (owner voice approval Oct 19 2026 6:08 PM CT): at ACTIVATE_WIZ_HAT_CLEAR_BLOCK the community pet's Headwear slot is emptied ONCE
   * (the worn piece, the Royal scarf, stays owned in w.community.gearLog but unworn, the same as any community piece replaced by a newer roll), so the
   * Bitcoin Wizard shows his signature pointy hat again. Later community Headwear rolls still auto-equip and replace the hat. Before the block nothing changes. */
  var ACTIVATE_WIZ_HAT_CLEAR_BLOCK = 972228; // Bitcoin tip 972,222 + 6 (Oct 19 2026 ~6:10 PM CT)
  function wizHatClear(w, b) { var c = w.community; if (b < ACTIVATE_WIZ_HAT_CLEAR_BLOCK || c.hatClear) return; var g = c.gear.head;
    c.hatClear = { block: ACTIVATE_WIZ_HAT_CLEAR_BLOCK, item: g ? g.item : null }; if (g) delete c.gear.head;
    w.log.push({ block: ACTIVATE_WIZ_HAT_CLEAR_BLOCK, tx: null, kind: 'wizhat', msg: 'community pet Headwear cleared (' + (g ? g.label + ' kept, unworn' : 'already empty') + '): signature Wizard Hat shows' }); }
  /* WIZARD COLD STORAGE (owner request Oct 19 2026 ~9:15 PM CT; design/bitcoin-wizard-story.md). Mirrors The Return / Nakamoto.
   * TRIGGER (pure chain history, display only): the first burn after which the community total since The Return (wizardFed = burned - COMMUNITY_GOAL)
   * reaches the Wizard's Mythic threshold WIZARD_THRESHOLDS[5] = 6,906,900. Recorded in w.wizardMythic = { block, tx, total, feeders, top, by } (NOT part of
   * w.community, so every earlier replay hash is identical). It fires at the right block whenever the site is deployed (it is found from history).
   * RULES (gated at ACTIVATE_WIZ_COLD_BLOCK, chain tip + 6 at build time; nothing below it changes), active only once the trigger has happened:
   *   pet:hatchwiz   = hatch a Bitcoin Wizard egg (species 'wizard', blue player palette, normal pet thresholds), cost WIZ_EGG_COST;
   *   pet:sign / pet:sign:ID = one free "Join us" sign per wallet that burned while the Wizard was the community pet (any amount, 1 sat is enough);
   *   new gear (V2Gear WIZ_BATCH, since 'wiz-cold') joins the roll pools: open Rare Star robe / MS Paint staff / Star-cloak; Wizard-only ★ Join us sign,
   *   Crystal orb and the pointy Wizard Hat. Every number / list below is a one-line owner default. */
  /* BITCOIN STAFF (owner, Oct 20 2026): Wizard-only ★ weapon 'sig-wizard-staff' drops in the normal Lair gear roll (pet:roll / free / token / overflow rolls)
   * ONLY for player-owned Wizard pets (species 'wizard'; not hybrids, not the community pet), weight 5 like the other Wizard-only ★ pieces. It rolls
   * inside the Grip ('hand') pool (item.rollSlot) so the slot odds of every roll are unchanged, but it is worn in its own 'weapon' slot (right hand), so
   * it can be worn together with the "Join us" sign (Grip, left hand). The weapon slot is open whenever the pet's Grip slot is open. No grants.
   * Owner approved deploy Oct 20 2026 ~6:20 PM CT: chain tip 972389 + 6 = 972395. */
  var ACTIVATE_WIZ_STAFF_BLOCK = 972395, WIZ_STAFF_ITEM = 'sig-wizard-staff';
  function staffOn(b) { return ACTIVATE_WIZ_STAFF_BLOCK != null && b != null && b >= ACTIVATE_WIZ_STAFF_BLOCK; }
  /** slotOpen(p, sl): the pet has slot sl unlocked; the Wizard-only 'weapon' slot rides on the Grip slot. */
  function slotOpen(p, sl) { var o = (p && p.openSlots) || []; return o.indexOf(sl) >= 0 || (sl === 'weapon' && o.indexOf('hand') >= 0); }
  var ACTIVATE_WIZ_COLD_BLOCK = 972250;            // Bitcoin tip 972244 + 6 at commit (Oct 19 2026); owner default
  var WIZ_EGG_COST = 690;                           // pet:hatchwiz cost in XCPETS (owner default)
  var WIZ_EGG_TIER = null;                          // null = the egg's tier is rolled like any egg; 0-3 = force that tier (owner default: rolled)
  var WIZ_CAN_BREED = false;                        // LEGACY default: player Wizards can't breed before ACTIVATE_WIZ_BREED_BLOCK (kept false; the gate below switches breeding on)
  /* WIZARD BREEDING (branch wizard-hybrids, Oct 19 2026; NOT approved/deployed). From ACTIVATE_WIZ_BREED_BLOCK player Wizards (species 'wizard', from
   * pet:hatchwiz) can breed like any pet, with the unchanged breedChild odds: different species -> hybrid 68.4773435% (else 50/50 a parent's species),
   * Wizard x Wizard -> Wizard + bred-true bonus, hybrid parents follow the three-way rules, Nakamoto children forced Legendary, normal tier rules.
   * 'wizard' is a hybrid root with all 13 species (Wizard hybrid art: hybridRender below). The community pet never breeds (p.community check).
   * LIVE from 972,716 (null would make it inert, identical to the old rules). */
  var ACTIVATE_WIZ_BREED_BLOCK = 972716;
  function wizBreedOn(b) { return ACTIVATE_WIZ_BREED_BLOCK != null && b != null && b >= ACTIVATE_WIZ_BREED_BLOCK; }
  var WIZ_SIGN_MIN = 0.00000001;                    // Join us sign claim: any amount, 1 sat of XCPETS is enough
  var WIZ_SIGN_ITEM = 'sig-wizard-sign';               // the claimable sign gear id
  var WIZ_FEEDER_FROM_RETURN = true;                // a "feeder" = any wallet that burned after The Return up to and incl. the Mythic burn
  var WIZ_TOP_N = 5;                                // archive top feeders shown
  function wizColdOn(w, b) { return b != null && b >= ACTIVATE_WIZ_COLD_BLOCK && !!(w && w.wizardMythic) && b >= w.wizardMythic.block; }
  var WIZ_POOL_FROM = Infinity;                     // first block the WIZ_BATCH pieces roll (set per replay: max(gate, Mythic block + 1))
  function wizPoolOn(b) { return b != null && b >= WIZ_POOL_FROM; }
  /** wizTrack(w, r, amt): after The Return, sum burns per wallet until the Wizard's Mythic burn; record the trigger once. */
  function wizTrack(w, r, amt) { var c = w.community; if (c.returnBlock == null || w.wizardMythic) return; var T = w._wizT || (w._wizT = { by: {} });
    var over = c.burned - COMMUNITY_GOAL, part = r.tx_hash === c.returnTx ? Math.max(0, over) : amt; if (part > 0) T.by[r.source] = (T.by[r.source] || 0) + part;
    if (over + 1e-9 < communityThresholds(r.block_index)[5]) return;
    var all = Object.keys(T.by).map(function (a) { return { address: a, amount: T.by[a] }; }).sort(function (x, y) { return y.amount - x.amount || (x.address < y.address ? -1 : 1); });
    w.wizardMythic = { block: r.block_index, tx: r.tx_hash, total: over, feeders: all.length, top: all.slice(0, WIZ_TOP_N), by: T.by, claimed: {} };
    WIZ_POOL_FROM = Math.max(ACTIVATE_WIZ_COLD_BLOCK, r.block_index + 1); delete w._wizT;
    w.log.push({ block: r.block_index, tx: r.tx_hash, kind: 'wizcold', msg: 'Bitcoin Wizard reached Mythic (' + Math.floor(over) + ' burned) and went into Cold Storage' }); }
  /* LORD KEK = COMMUNITY PET #3 (owner Oct 20 2026 ~6:00 PM CT; design/lord-kek-community-pet.md). LIVE from ACTIVATE_KEK_BLOCK = 972,396 (null = all off).
   * With the gate null nothing below runs (no new world fields, no art change), so replay is identical. At launch approval set it to tip + ~6.
   *   care   = every community burn AFTER the Bitcoin Wizard's Mythic burn (w.wizardMythic, block 972,325), counted back to then (owner Q2);
   *   growth = COMMUNITY_THRESHOLDS (100x slower: hatch 69,000 ... Mythic 6,906,900), never starves, wears community rolls made from the gate on;
   *   Mythic = first burn (at/after the gate) with care >= 6,906,900 -> w.kekMythic {block, tx, total, feeders, top, by}: Cold Storage, archive #3;
   *   egg    = from the block after kekMythic the 1-in-777 hatch/pack slot gives a player Lord Kek (kekArt) instead of a Bitcoin Wizard (owner Q3);
   *            no buy button / no pet:hatchkek tag;
   *   breed  = player Lord Keks breed and make hybrids (owner Q5); hybrid art uses the Pepe body (he is a Pepe) with Kek names. */
  var ACTIVATE_KEK_BLOCK = 972396;                  // LIVE: chain tip 972,390 + 6 at launch approval (owner, Oct 20 2026 ~6:24 PM CT)
  var KEK_FROM_BLOCK = 972325;                      // the Wizard's Mythic block; burns after his Mythic burn count (documented; the replay uses w.wizardMythic)
  var KEK_CAN_BREED = true;                         // only effective once ACTIVATE_KEK_BLOCK is set and reached
  var KEK_TOP_N = 5;
  /* LORDKEK Rare Pepe card (owner Oct 20 ~6:07 PM CT): Kek-only signature Grip piece (item id 'kek-card', drawn by KekSprite as a tiny card).
   * NOT obtainable: no tag, no pool entry, no grant until the owner picks how (see design doc) and this gate is set. */
  var ACTIVATE_KEK_CARD_BLOCK = null;               // OFF
  var KEK_CARD_ITEM = 'kek-card';
  var KEK_CARD_MIN = 0.00000001;                    // pet:kekcard claim: any amount, 1 sat of XCPETS is enough
  var KEK_CARD_DROP_N = 69;                         // after the claim opens: 1 in 69 Grip rolls of a player Kek give the card
  /* Owner Oct 20 ~6:12 PM CT: free 1-sat pet:kekcard / pet:kekcard:ID claim for every wallet that fed Kek, open once he is in Cold Storage
   * (kekColdOn) AND the card gate is reached; worn at once only by a player Kek named in the tag (Grip open). Then a 1-in-69 drop on player Keks' Grip rolls. */
  function kekCardOn(w, b) { return ACTIVATE_KEK_CARD_BLOCK != null && b != null && b >= ACTIVATE_KEK_CARD_BLOCK && kekColdOn(w, b); }
  var KEK_POOL_FROM = Infinity;                     // first block the 1-in-777 slot gives Lord Kek (set per replay: kekMythic.block + 1)
  function kekOn(b) { return ACTIVATE_KEK_BLOCK != null && b != null && b >= ACTIVATE_KEK_BLOCK; }
  function kekColdOn(w, b) { return kekOn(b) && !!(w && w.kekMythic) && b > w.kekMythic.block; }
  function kekTrack(w, r, amt) { if (ACTIVATE_KEK_BLOCK == null || !w.wizardMythic || w.kekMythic || r.tx_hash === w.wizardMythic.tx) return;
    var K = w.kek || (w.kek = { fed: 0, feeds: 0, by: {} }); K.fed += amt; K.feeds++; if (amt > 0) K.by[r.source] = (K.by[r.source] || 0) + amt;
    if (r.block_index < ACTIVATE_KEK_BLOCK || K.fed + 1e-9 < COMMUNITY_THRESHOLDS[5]) return;
    var all = Object.keys(K.by).map(function (a) { return { address: a, amount: K.by[a] }; }).sort(function (x, y) { return y.amount - x.amount || (x.address < y.address ? -1 : 1); });
    w.kekMythic = { block: r.block_index, tx: r.tx_hash, total: K.fed, feeders: all.length, top: all.slice(0, KEK_TOP_N), by: K.by };
    KEK_POOL_FROM = r.block_index + 1;
    w.log.push({ block: r.block_index, tx: r.tx_hash, kind: 'kekcold', msg: 'Lord Kek reached Mythic (' + Math.floor(K.fed) + ' burned) and went into Cold Storage' }); }
  /* ---------------------------------------------------------------- FUNTRUMP = community pet #4 (branch funtrump-community, PREVIEW, NOT approved/deployed;
   * owner decision Oct 22 2026 10:13 PM CT; design/funtrump-community.md). Same pattern as Nakamoto -> Bitcoin Wizard -> Lord Kek:
   *   start  = the burn that takes Lord Kek to Mythic (w.kekMythic, pure chain data). Every community burn AFTER that burn is FUNTRUMP care;
   *   stages = COMMUNITY_THRESHOLDS (hatch 69,000 .. Mythic 6,906,900), w.funtrump = { fed, feeds, by };
   *   Mythic = w.funtrumpMythic = { block, tx, total, feeders, top, by } and he goes to Cold Storage (log 'funtrumpcold');
   *   egg    = from the block after funtrumpMythic the 1-in-777 slot gives a player FUNTRUMP (ftArt) instead of Lord Kek;
   *   hybrid = 'funtrump' is a hybrid root with all 13 species + Kek/Wizard (FT_SP / ftPal / keyedRender below).
   * LIVE from 972,880. If ACTIVATE_FUNTRUMP_BLOCK were null: ftTrack returns at once, no state is written, FT_POOL_FROM stays Infinity. */
  var ACTIVATE_FUNTRUMP_BLOCK = 972880;  // LIVE: FUNTRUMP takes over (owner approved Oct 23 2026 11:36 PM CT; gate = tip + 3, owner 11:38 PM CT)
  var FUNTRUMP_CAN_BREED = true;                    // only effective once ACTIVATE_FUNTRUMP_BLOCK is set and reached
  var FT_POOL_FROM = Infinity;
  /* FUNTRUMP BREEDING (owner YES Oct 22 2026 10:47 PM CT; mirrors ACTIVATE_WIZ_BREED_BLOCK): from ACTIVATE_FT_BREED_BLOCK, and only once FUNTRUMP has reached
   * Cold Storage (Mythic, b >= FT_POOL_FROM), player FUNTRUMPs breed like any pet with the unchanged breedChild odds (different species -> hybrid 68.4773435%,
   * FUNTRUMP x FUNTRUMP -> FUNTRUMP + bred-true bonus, three-way rules for hybrid parents). A pure FUNTRUMP child is at least Rare (suit); Legendary = hoodie.
   * The community FUNTRUMP never breeds (p.community check). LIVE from 972,880 (null would make it inert). */
  var ACTIVATE_FT_BREED_BLOCK = 972880;  // = takeover gate; ftBreedOn still waits for FUNTRUMP's own Cold Storage (b >= FT_POOL_FROM), so breeding opens automatically then
  function ftBreedOn(b) { return ACTIVATE_FT_BREED_BLOCK != null && b != null && b >= ACTIVATE_FT_BREED_BLOCK && b >= FT_POOL_FROM; }
  function ftOn(b) { return ACTIVATE_FUNTRUMP_BLOCK != null && b != null && b >= ACTIVATE_FUNTRUMP_BLOCK; }
  function ftColdOn(w, b) { return ftOn(b) && !!(w && w.funtrumpMythic) && b > w.funtrumpMythic.block; }
  function ftTrack(w, r, amt) { if (ACTIVATE_FUNTRUMP_BLOCK == null || !w.kekMythic || w.funtrumpMythic || r.tx_hash === w.kekMythic.tx) return;
    var K = w.funtrump || (w.funtrump = { fed: 0, feeds: 0, by: {} }); K.fed += amt; K.feeds++; if (amt > 0) K.by[r.source] = (K.by[r.source] || 0) + amt;
    if (r.block_index < ACTIVATE_FUNTRUMP_BLOCK || K.fed + 1e-9 < COMMUNITY_THRESHOLDS[5]) return;
    var all = Object.keys(K.by).map(function (a) { return { address: a, amount: K.by[a] }; }).sort(function (x, y) { return y.amount - x.amount || (x.address < y.address ? -1 : 1); });
    w.funtrumpMythic = { block: r.block_index, tx: r.tx_hash, total: K.fed, feeders: all.length, top: all.slice(0, KEK_TOP_N), by: K.by };
    FT_POOL_FROM = r.block_index + 1;
    w.log.push({ block: r.block_index, tx: r.tx_hash, kind: 'funtrumpcold', msg: 'FUNTRUMP reached Mythic (' + Math.floor(K.fed) + ' burned) and went into Cold Storage' }); }
  /** ftArt(bh, id, b): a FUNTRUMP egg = a normal egg roll with species 'funtrump' (FuntrumpSprite). */
  /* TWO LOOKS BY TIER (owner Oct 22 2026 10:34 PM CT): SUIT FUNTRUMP = Rare (tier 2), HOODIE FUNTRUMP = Legendary (tier 3). Player FUNTRUMP eggs roll
   * Rare or Legendary like the Wizard 1000:300 rule (PROPOSED, open question): sha(seed id + ':' + hatch block + 'XCPETS:v2:fttier') first 12 hex
   * mod 1300 < 300 -> Legendary/hoodie (23.08%), else Rare/suit (76.92%). Stats get the tier bonus difference (same as wizardArt). The community pet
   * itself wears the SUIT (FuntrumpSprite.COMMUNITY_LOOK, open question). */
  var FT_RARE_W = 1000, FT_LEG_W = 300;
  function ftRollTier(id, b) { return specialRollTier('funtrump', id, b); } /* same salt + odds as before (shared roll) */
  function ftLookOfTier(t) { return t >= 3 ? 'hoodie' : 'suit'; }
  function ftArt(bh, id, b) { var art = PetCore.generate({ blockHash: bh, petId: id, blockHeight: b }), FT = ftRollTier(id, b); art.species = 'funtrump'; if (!specialNamesOn(b)) art.defaultName = 'FUNTRUMP';
    if (PetCore.TIERS[FT]) { var L0 = PetCore.TIERS[art.tierIndex], L1 = PetCore.TIERS[FT], d = L1.statBonus - L0.statBonus; Object.keys(art.baseStats).forEach(function (k) { art.baseStats[k] = Math.max(1, art.baseStats[k] + d); }); art.tierIndex = FT; art.tier = L1.id; }
    art.ftLook = ftLookOfTier(art.tierIndex); return noBornShades(art); }
  /** kekArt(bh, id, b): a Lord Kek egg = a normal egg roll (tier, stats, background) with species 'kek' (KekSprite, player palette). */
  function kekArt(bh, id, b) { var art = PetCore.generate({ blockHash: bh, petId: id, blockHeight: b }); art.species = 'kek'; if (!specialNamesOn(b)) art.defaultName = 'Kek'; if (specialTierOn(b)) setArtTier(art, specialRollTier('kek', id, b)); /* COMMUNITY-SPECIES TIER: Rare or Legendary */ return noBornShades(art); }
  /* ---------------------------------------------------------------- HALVING (owner approved Oct 22 2026; design/halving-schedule.md)
   * Halving 1 = STAR LORD KEK defeats Lord Kek: the burn that takes Lord Kek's care to Mythic (w.kekMythic, pure chain data) + HALVING_DELAY blocks,
   * never before ACTIVATE_HALVING_BLOCK (so a defeat that happened before this code shipped starts halving 1 at the launch block, never rewriting history).
   * Halving 2+ = one per NEW COMMUNITY PET (owner, Oct 22 2026): COMMUNITY_PET_ARRIVAL_BLOCKS[i] + HALVING_DELAY (owner sets each arrival block; arrivals
   * at or before halving 1 add nothing). No floor. Costs are judged at the burn's own block. There is NO series concept: a halving only halves every
   * burn price (base / 2^halvings). Care thresholds, meal sizes and the care a meal adds never change: a meal still adds its base care (e.g. 9,200)
   * and only what it costs drops (mealCost), so every pet keeps growing at today's pace (~day 9 to Mythic). XCPETS has 8 decimals. */
  var ACTIVATE_HALVING_BLOCK = 972641;  // deploy Oct 22 2026 ~12:20 PM CT: tip 972,635 + 6 (owner approved)
  var HALVING_DELAY = 6;
  var COMMUNITY_PET_ARRIVAL_BLOCKS = []; // halving 2, 3, ...: block each new community pet arrives (owner sets; empty = no more halvings)
  var ACTIVATE_COMMUNITY_TRIGGER_BLOCK = 972646; // deploy Oct 22 2026 ~12:50 PM CT: tip 972,640 + 6 (owner approved). Arrivals before it are ignored; no-series rules are inert before halving 1 anyway
  function halvingOn(b) { return ACTIVATE_HALVING_BLOCK != null && b != null && b >= ACTIVATE_HALVING_BLOCK; }
  function halving1Block(w) { return ACTIVATE_HALVING_BLOCK == null || !w || !w.kekMythic ? null : Math.max(w.kekMythic.block + HALVING_DELAY, ACTIVATE_HALVING_BLOCK); }
  /* AUTO HALVING (owner rule Oct 24 2026 12:02 AM CT; LIVE from ACTIVATE_AUTO_HALVING_BLOCK = 972,889): every time a community pet goes to Cold Storage the next pet
   * takes its place and there is exactly ONE halving, 6 blocks after that Cold Storage block. Halving 1 = Lord Kek (unchanged, halving1Block: Cold
   * Storage 972,869 -> 972,875). Halving N (N >= 2) = Cold Storage block of community pet N (after Lord Kek: FUNTRUMP = w.funtrumpMythic, ...) + 6,
   * pure replay data, no hand-set block. A new pet's ARRIVAL adds nothing. Bitcoin Wizard's Cold Storage was before the halving system and never counts.
   * Gate: from ACTIVATE_AUTO_HALVING_BLOCK, and a halving never starts before the gate (max with the gate, like halving 1), so history is never
   * rewritten. null = OFF: the old COMMUNITY_PET_ARRIVAL_BLOCKS path (empty) is used, identical to main. */
  var ACTIVATE_AUTO_HALVING_BLOCK = 972889;
  function autoHalvingOn() { return ACTIVATE_AUTO_HALVING_BLOCK != null; }
  function coldStorageAfterKek(w) { return [w && w.funtrumpMythic].filter(function (x) { return x && x.block != null; }).map(function (x) { return x.block; }); } /* add each later community pet's Mythic record here */
  function halvingBlocks(w) { var h1 = halving1Block(w); if (h1 == null) return []; var out = [h1];
    if (autoHalvingOn()) { coldStorageAfterKek(w).forEach(function (cs) { out.push(Math.max(cs + HALVING_DELAY, ACTIVATE_AUTO_HALVING_BLOCK, out[out.length - 1] + 1)); }); return out; }
    COMMUNITY_PET_ARRIVAL_BLOCKS.forEach(function (L) { if (L >= ACTIVATE_COMMUNITY_TRIGGER_BLOCK && L + HALVING_DELAY > h1) out.push(Math.max(L + HALVING_DELAY, out[out.length - 1] + 1)); }); return out; }
  function eraAt(w, b) { if (!halvingOn(b)) return 0; var n = 0; halvingBlocks(w).forEach(function (g) { if (b >= g) n++; }); return n; }
  function r8(x) { return Math.round(x * 1e8) / 1e8; }
  function costAt(w, base, b, feed) { var e = eraAt(w, b), f = fireFactor(w, b, feed); return e || f !== 1 ? r8(base / Math.pow(2, e) * f) : base; }
  function fullAt(w, base, b) { var e = eraAt(w, b); return e ? r8(base / Math.pow(2, e)) : base; } /* era price, no sale */
  /** below(w, amt, base, b): true when amt doesn't pay base at block b (era 0: the exact old comparison, so replay is unchanged). */
  function below(w, amt, base, b) { return eraAt(w, b) || saleAt(w, b) ? amt + 5e-9 < costAt(w, base, b) : amt < base; }
  /** mealCost(w, p, care, b): XCPETS a meal that adds `care` costs at block b. MEAL FIX (owner, Oct 22 2026): care per meal stays the meal's base
   * value; only the price halves (and the Fire Sale factor applies), so a halving never slows growth. Era 0, no sale: cost === care (replay unchanged). */
  function mealCost(w, p, care, b, full) { var e = eraAt(w, b), f = full ? 1 : fireFactor(w, b, true); return e === 0 && f === 1 ? care : r8(care / Math.pow(2, e) * f); }
  function costsAt(w, b) { var o = {}; Object.keys(COSTS).forEach(function (k) { o[k] = COSTS[k] < 1 ? COSTS[k] : costAt(w, COSTS[k], b); }); o.feedMin = costAt(w, COSTS.feedMin, b, true); o.cquick = FEED_QUICK.map(function (x) { return costAt(w, x, b, true); }); o.sale = !!saleAt(w, b); o.breed = costAt(w, breedCost(b), b); o.hatch12 = costAt(w, 690, b); o.hatch144 = costAt(w, 6900, b); o.hatchzap = costAt(w, ELECTRIC_COST, b); o.era = eraAt(w, b); return o; }
  /** syncCosts(w, b): UI only. Updates the exported COSTS copy (UI_COSTS) to the price at block b; the replay always uses the base COSTS. */
  function syncCosts(w, b) { var c = costsAt(w, b); Object.keys(UI_COSTS).forEach(function (k) { if (c[k] != null) UI_COSTS[k] = c[k]; }); UI_COSTS.cquick = c.cquick; UI_COSTS.hatch12 = c.hatch12; UI_COSTS.hatch144 = c.hatch144; UI_COSTS.hatchzap = c.hatchzap; UI_COSTS.era = c.era; UI_COSTS.sale = c.sale; return UI_COSTS; }
  var UI_COSTS = Object.assign({}, COSTS);
  /** planAmount(w, plan, b): UI only (tx builder). A fixed-price plan (hatch / dozen / case / roll / spin / fight / accept / breed / community roll) or a
   * single feed gets the amount at block b; plans are returned unchanged in era 0, and 1-sat / community-feed plans are never touched. */
  function planAmount(w, plan, b) { if (!plan || !plan.tag || (!eraAt(w, b) && !saleAt(w, b) && !(breed135On(b) && /^pet:(breed|rug):/i.test(plan.tag)))) return plan; var t = parseTag(plan.tag), base = null; if (!t) return plan;
    if (t.action === 'hatch') base = COSTS.hatch; else if (t.action === 'pack' || t.action === 'zap') base = t.cost; else if (t.action === 'roll' || t.action === 'spin') base = COSTS.roll;
    else if (t.action === 'accept') base = acceptCost(w, t.fightId);
    else if (t.action === 'sd') base = COSTS.sd; else if (t.action === 'tt') base = modeTeamCost(w, t.a); else if (t.action === 'join') base = COSTS.join; /* arena modes: full base, then halving / fire sale */
    else if (t.action === 'breed') base = breedCost(b); else if (t.action === 'fight' || t.action === 'croll') base = COSTS[t.action];
    else if (t.action === 'ad') base = RUG_AD_COST * ((t.ids && t.ids.length) || 1); else if (t.action === 'rug') base = rugCost(b); /* Rug Me: same base + halving / fire sale as breed (replay: below(.., COSTS.breed, b)) */
    else if (t.action === 'feed' && w.byId && w.byId[t.petId]) { var q = w.byId[t.petId]; if (q.nextMeal > 0) return Object.assign({}, plan, { amount: q.nextMeal }); return plan; }
    if (base == null || !(Number(plan.amount) >= costAt(w, base, b))) return plan; return Object.assign({}, plan, { amount: costAt(w, base, b) }); }
  function halvingInfo(w, tip) { var b = (tip || (w && w.tip) || 0) + 1, hs = halvingBlocks(w); return { gate: ACTIVATE_HALVING_BLOCK, defeat: w && w.kekMythic ? { block: w.kekMythic.block, tx: w.kekMythic.tx } : null,
      halvings: hs, era: eraAt(w, b), next: hs.filter(function (g) { return g > b - 1; })[0] || null, kekCare: w && w.kek ? w.kek.fed : 0, kekMythicCare: COMMUNITY_THRESHOLDS[5] }; }
  /* ---------------------------------------------------------------- FIRE SALES (owner approved Oct 22 2026; design/halving-schedule.md sections 6-7)
   * From ACTIVATE_FIRESALE_BLOCK, block B ARMS a sale when int(sha256(blockhash(B) + 'XCPETS:v2:fire')[0..12], 16) % 1000 < 3, no sale is armed or live,
   * the last sale ended at least FIRE_COOLDOWN (432 = 3 days) blocks before B, and B is not in the Lord Kek blackout [defeat block, halving 1 + 144).
   * The sale is LIVE from B + 6 for 36 blocks [B+6, B+42). Price = base / 2^era x 0.31 (69% off) for every burn, meals and community feeding included. Amounts rounded to 1e-8 XCPETS (r8). A halving inside a sale reprices at once.
   * Deterministic: needs the hash of EVERY block from the gate (v2-chain fetches them); arms are only decided for blocks < the burn being judged.
   * A valid FULL-price discounted burn during a live sale earns one saved wheel spin: recorded in w.fireSpins[address] + w.fireSpinLog (replayed ledger
   * for the future saved-spins system; nothing is shown to players). */
  var ACTIVATE_FIRESALE_BLOCK = 972641;  // deploy Oct 22 2026 ~12:20 PM CT: tip 972,635 + 6 (owner approved)
  var FIRE_ODDS_1K = 3, FIRE_WARN = 6, FIRE_LEN = 36, FIRE_COOLDOWN = 432, FIRE_KEK_PAUSE = 144, FIRE_PAY = 0.31, FIRE_FEED_PAY = 0.31; /* owner Oct 22 2026: every fire-sale discount is 69% off, meals and community feeding included */
  var FIRE_ACTIONS = { hatch: 1, pack: 1, zap: 1, roll: 1, spin: 1, fight: 1, accept: 1, breed: 1, croll: 1, feed: 1, feedm: 1, feedl: 1 };
  var FIRE_HASHES = {};                   // set per replay (the block hashes it was given)
  function fireOn(b) { return ACTIVATE_FIRESALE_BLOCK != null && b != null && b >= ACTIVATE_FIRESALE_BLOCK; }
  function fireRoll(hash) { return parseInt(sha(hash + 'XCPETS:v2:fire').slice(0, 12), 16) % 1000; }
  function fireBlackout(w, B) { if (!w || !w.kekMythic) return false; var h1 = halving1Block(w); return B >= w.kekMythic.block && (h1 == null || B < h1 + FIRE_KEK_PAUSE); }
  /** fireExtend(w, upTo): decide arms for every block <= upTo (in order; stops at the first block whose hash is unknown). */
  function fireExtend(w, upTo) { if (ACTIVATE_FIRESALE_BLOCK == null || upTo < ACTIVATE_FIRESALE_BLOCK) return; var F = w.fire || (w.fire = { next: ACTIVATE_FIRESALE_BLOCK, sales: [], missing: null });
    for (var B = F.next; B <= upTo; B++) { var h = FIRE_HASHES[B]; if (!h) { F.missing = B; return; }
      var last = F.sales[F.sales.length - 1], busy = last && B < last.end + FIRE_COOLDOWN;
      if (!busy && !fireBlackout(w, B) && fireRoll(h) < FIRE_ODDS_1K) F.sales.push({ arm: B, start: B + FIRE_WARN, end: B + FIRE_WARN + FIRE_LEN });
      F.next = B + 1; } F.missing = null; }
  function saleAt(w, b) { if (!fireOn(b) || !w || !w.fire) return null; var L = w.fire.sales; for (var i = L.length - 1; i >= 0; i--) { if (b >= L[i].start && b < L[i].end) return L[i]; if (L[i].end <= b) break; } return null; }
  function fireFactor(w, b, feed) { return saleAt(w, b) ? (feed ? FIRE_FEED_PAY : FIRE_PAY) : 1; }
  function fireInfo(w, tip) { var b = (tip || (w && w.tip) || 0) + 1, F = (w && w.fire) || { sales: [] }, last = F.sales[F.sales.length - 1] || null, live = saleAt(w, b);
    return { gate: ACTIVATE_FIRESALE_BLOCK, live: live, warning: last && b < last.start ? last : null, last: last, sales: F.sales.slice(), missing: F.missing || null, nextBlock: b }; }
  /* ---------------------------------------------------------------- SAVED WHEEL SPINS (owner approved Oct 22 2026; design/wheel-spins.md, Q2-Q5 answered)
   * From ACTIVATE_SPINS_BLOCK free gear handouts become SAVED Pepe Wheel spins that never expire:
   *   lucky drops (same roll: 25% per stage-up, 2% per meal) -> +1 spin to the pet's owner instead of an auto-rolled piece;
   *   founder free rolls (w.freeRolls) left at the gate -> converted 1:1 (one-time, logged); pet:fr is closed after the gate;
   *   Mythic overflow rolls: earned minus used, live (floor((care - 21,000) / 1,000) per discounted pet), pet:of closed after the gate;
   *   Fire Sale full-price credits (w.fireSpins ledger).
   * Spend: 1-sat pet:usespin or pet:usespin:N (N = 1-10) signed by the owner; each spin = the approved wheel rule seeded with tx + ':' + i. More than
   * the balance is rejected whole. Unchanged: community rolls, founder kit, grave gear, Join us sign + LORDKEK card keepsakes, paid pet:spin/roll. */
  var ACTIVATE_SPINS_BLOCK = 972641;      // deploy Oct 22 2026 ~12:20 PM CT: tip 972,635 + 6 (>= ACTIVATE_WHEEL_RANDOM_BLOCK)
  var SPINS_MAX_PER_BURN = 10;
  function spinsOn(b) { return ACTIVATE_SPINS_BLOCK != null && b != null && b >= ACTIVATE_SPINS_BLOCK; }
  function spinRec(w, a) { w.spins = w.spins || {}; return w.spins[a] || (w.spins[a] = { earned: 0, used: 0, log: [] }); }
  function earnSpin(w, a, b, tx, src, n) { if (!a) return; var R = spinRec(w, a); n = n || 1; R.earned += n; R.log.push({ block: b, tx: tx || null, src: src, n: n }); }
  /** spinsGate(w, b): one-time conversion at the first block >= the gate: founder free-roll credits left -> spins (overflow is counted live). */
  function spinsGate(w, b) { if (!spinsOn(b) || w._spinsConv) return; w._spinsConv = ACTIVATE_SPINS_BLOCK; var fr = w.freeRolls || {};
    Object.keys(fr).sort().forEach(function (a) { if (fr[a] > 0) { earnSpin(w, a, ACTIVATE_SPINS_BLOCK, null, 'founder', fr[a]); fr[a] = 0; } }); }
  function overflowSpins(w, a, b) { var n = 0; (w.pets || []).forEach(function (p) { if (p.owner === a && !p.community) n += overflowLeft(w, p, b); }); return n; }
  /** spinsLeft(w, addr, b, pendingTags): saved spins left (earned + fire credits + overflow left - used - unconfirmed pet:usespin burns). */
  function spinsLeft(w, a, b, pendingTags) { if (!w || !a) return 0; b = b != null ? b : (w.tip || 0) + 1; if (!spinsOn(b)) return 0; var R = (w.spins && w.spins[a]) || { earned: 0, used: 0 },
      pend = 0; (pendingTags || []).forEach(function (g) { var t = parseTag(g); if (t.action === 'usespin') pend += t.n; });
    return Math.max(0, R.earned + ((w.fireSpins && w.fireSpins[a]) || 0) + overflowSpins(w, a, b) - R.used - pend); }
  function useSpinPlan(n) { n = Math.max(1, Math.min(SPINS_MAX_PER_BURN, n | 0)); return { tag: 'pet:usespin' + (n > 1 ? ':' + n : ''), amount: COSTS.froll, label: 'Use ' + n + ' saved spin' + (n === 1 ? '' : 's') }; }
  var ACTIVATE_GRAVE_GEAR_BLOCK = 972157; // deploy tip 972151 + 6 (Oct 19 2026 ~8:19 AM CT); must stay < first death block 972432
  function graveOn(b) { return b != null && b >= ACTIVATE_GRAVE_GEAR_BLOCK; }
  function gravePlan(petId, on) { return { tag: 'pet:grave:' + petId + (on === false ? ':off' : ''), amount: COSTS.froll, petId: petId, label: (on === false ? 'Cancel grave gear #' : 'Leave gear on the grave #') + petId }; }
  /** graveLocked(w, g, b): the piece rests on a flagged pet that is dead at block b (left on the grave). */
  function graveLocked(w, g, b) { if (!g) return false; if (g.grave != null) return true; var q = g.on != null ? w.byId[g.on] : null; if (!q || !q.graveGear || !graveOn(q.graveGear)) return false; if (b != null) liveAt(w, q, b); return !!q.dead; }
  function overflowRollPlan(petId) { return { tag: 'pet:of:' + petId, amount: COSTS.froll, petId: petId, label: 'Overflow roll #' + petId }; }
  function mdSweep(w, b) { if (w._mdSwept || !mythicDiscountOn(b)) return; w._mdSwept = true; (w.pets || []).forEach(function (p) { noteMythicOwner(w, p, b); }); }
  function stageFor(care, th) { var s = 0; for (var k = 1; k < 6; k++) if (care >= th[k]) s = k; return s; }
  function mealFor(care, species, b, thOverride, k) { var th = thOverride || thresholdsFor(species, b), ms = mealSizesFor(species, b); if (k > 1) ms = ms.map(function (x) { return x / k; }); if (care >= th[5]) return 0; if (care < th[1]) return th[1] - care;
    var k = Math.min(4, Math.max(1, stageFor(care, th))); return Math.min(ms[k], Math.min(th[k + 1], th[5]) - care); }
  function mealsToMythic(species) { var c = THRESHOLDS[1], n = 0; while (mealFor(c, species) > 0) { c += mealFor(c, species); n++; } return n; }
  function wizardStage(burned, b) { return stageFor(burned, b == null ? WIZARD_THRESHOLDS : communityThresholds(b)); }

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
    (V2Gear.ITEMS || []).forEach(function (x) { out.push({ id: x.id, label: x.label, slot: x.slot, tier: x.tier, w: x.exclusive ? 5 : 10, src: 'v2', origin: x.origin, exclusive: !!x.exclusive, sig: !!x.exclusive, overlay: true, kind: x.kind, alias: x.alias, since: x.since, rollSlot: x.rollSlot, look: x.look }); });
    // polish pass 2026-10-14: the two cards are rare Legendaries (tier 3 = the top gear-power band, weight 1 = rarest roll in v2); shared, not species-locked
    out.forEach(function (x) { if (CARD_FIX[x.id]) { x.tier = 3; x.w = 1; x.card = true; } });
    return out;
  })();
  var RAW = ALL; ALL = RAW.filter(function (x) { return !x.alias; }); // alias entries (removed duplicate mug) keep their roll-pool position but resolve to the kept item
  var BY_ID = {}; ALL.forEach(function (x) { BY_ID[x.id] = x; });
  /* LORDKEK Rare Pepe card: lookup-only record (NOT in RAW/ALL, so never in any roll pool or list); only ever created by the gated claim/drop below. */
  BY_ID['kek-card'] = { id: 'kek-card', label: 'LORDKEK Rare Pepe card', slot: 'hand', tier: 3, origin: 'kek', exclusive: true, legendary: true, sig: true, noRoll: true, w: 0 };
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
  /* CHUD'S BEARD GEAR (owner Oct 22 2026, breeding-v2 branch): open Guise (face) piece 'v2-chud-beard', tier 1 (Uncommon), any species incl. hybrids;
   * drawn per pet by V2Render.drawBeard on the detected mouth + jaw. Gear pools are consensus: item.since 'chud-beard' keeps it out of every pool until
   * ACTIVATE_CHUD_BEARD_BLOCK is set (null = OFF, so every roll replays exactly). Appended at the END of ITEMS. No grants. */
  var ACTIVATE_CHUD_BEARD_BLOCK = 972589 /* deploy Oct 22 2026: tip 972583 + 6 */, CHUD_BEARD_ITEM = 'v2-chud-beard', BEARD_EXCLUDE = { doge: 1, mumu: 1, pepe: 1, nakamoto: 1 }; /* owner Oct 22 1:27-1:29 AM CT: never rolls/wears on these bodies (player pets and hybrids with that body); 'if a cosmetic looks bad on a pet, that pet doesn't get it' */
  function bodyOf(p) { return p && p.hybrid && p.hybrid.shape ? p.hybrid.shape : p ? p.species : null; }
  /* CHUD'S BEARD = HYBRID PART (owner correction Oct 22 2026 ~7:40 AM CT): from ACTIVATE_CHUD_BEARD_PART_BLOCK, Chud donates {id:'beard', kind:'face'}
   * to breeding-v2 hybrids (drawn by V2Render.drawBeard; never on BEARD_EXCLUDE bodies), and the gear piece v2-chud-beard leaves every roll pool
   * (noRoll). Pieces already owned stay owned and wearable. Before the gate nothing changes (Chud = glasses only), so replay is unchanged.
   * null on the branch: set to tip + 6 at deploy. */
  var ACTIVATE_CHUD_BEARD_PART_BLOCK = 972629; /* deploy Oct 22 2026 ~9:40 AM CT: tip 972623 + 6 */
  /* ARENA MODES (Oct 22 2026, owner approved; design/arena-modes.md + Owner answers): Sudden Death pet:sd:A:B (690 / accept 690), Tag Team
   * pet:tt:A1.A2:B1.B2 (1,380 per team; a two-owner team: lead 690 + partner pet:join:N:ID 690), accept = the usual pet:accept:N.
   * null = OFF: before the gate these tags are unknown tags (community food) exactly as before, so every past burn replays the same. Set tip + 6 at deploy. */
  var ACTIVATE_ARENA_MODES_BLOCK = 972641; // deploy Oct 22 2026 ~12:20 PM CT: tip 972,635 + 6 (owner approved)
  function modesOn(b) { return ACTIVATE_ARENA_MODES_BLOCK != null && b != null && b >= ACTIVATE_ARENA_MODES_BLOCK; }
  function fightPets(f) { return [f.a, f.a2, f.b, f.b2].filter(function (x) { return x != null; }); }
  function inOpenFight(w, id, b, except) { return w.fights.some(function (f) { return f !== except && f.status === 'open' && b - f.block <= FIGHT_WINDOW && fightPets(f).indexOf(id) >= 0; }); }
  function beardPartOn(b) { return ACTIVATE_CHUD_BEARD_PART_BLOCK != null && b != null && b >= ACTIVATE_CHUD_BEARD_PART_BLOCK; }
  function beardOn(b) { return ACTIVATE_CHUD_BEARD_BLOCK != null && b != null && b >= ACTIVATE_CHUD_BEARD_BLOCK; }
  function view(it) { if (!it) return it; if (it.since === 'chud-beard' && !beardOn(ELIG_B)) return null; if (it.id === CHUD_BEARD_ITEM && beardPartOn(ELIG_B)) it = Object.assign({}, it, { noRoll: true }); /* beard is a hybrid part now: out of every roll pool, owned pieces still wearable */ if (it.since === 'wiz-cold' && !wizPoolOn(ELIG_B)) return null; if (it.since === 'wiz-staff' && !staffOn(ELIG_B)) return null; if (it.since === 'funtrump' && !ftOn(ELIG_B)) return null; /* FUNTRUMP gear: inert until ACTIVATE_FUNTRUMP_BLOCK */ if (it.since === 'star-batch' && !starBatchOn(ELIG_B)) return null; if (it.since === 'sig-shuffle' && !shuffleOn(ELIG_B)) return null; if (it.since === 'gear-audit' && !gaOn(ELIG_B)) return null;
    if (shuffleOn(ELIG_B) && SHUFFLE[it.id]) it = Object.assign({}, it, SHUFFLE[it.id]); if (gaOn(ELIG_B) && GA[it.id]) it = Object.assign({}, it, GA[it.id]); return it; }
  /** moveToSlot(w, g, slot): re-slot an owned gear piece at a rule switch-on block. A worn piece stays worn only if its pet has that slot open and
   * nothing else already sits in it; otherwise it is taken off (kept owned). Shared by the sig-shuffle and gear-audit sweeps (refactor 2026-10-16). */
  function moveToSlot(w, g, slot) { var p = g.on != null ? w.byId[g.on] : null;
    if (p) { var other = Object.keys(w.items).some(function (k2) { var o = w.items[k2]; return o !== g && o.on === p.id && o.slot === slot; }); if (other || !slotOpen(p, slot)) g.on = null; }
    g.slot = slot; }
  function gaSweep(w, b) { if (w._gaSwept || !gaOn(b)) return; w._gaSwept = true;
    Object.keys(w.items || {}).forEach(function (k) { var g = w.items[k], nv = GA[g.item]; if (!nv) return; if (nv.tier != null) g.tier = nv.tier;
      if (nv.slot && g.slot !== nv.slot) moveToSlot(w, g, nv.slot); }); }
  function shuffleSweep(w, b) { if (w._shufSwept || !shuffleOn(b)) return; w._shufSwept = true;
    Object.keys(w.items || {}).forEach(function (k) { var g = w.items[k]; if (!SHUFFLE[g.item]) return; var nv = SHUFFLE[g.item];
      moveToSlot(w, g, nv.slot); g.tier = nv.tier; g.legendary = !!nv.exclusive; }); }
  function eligible(it, species, body, tier) { it = typeof it === 'string' ? itemOf(it) : it; it = view(it); if (!it) return false;
    if (it.origin === 'funtrump' && it.exclusive) { if (species === 'funtrump') return !it.look || tier == null || ftLookOfTier(tier) === it.look; return !it.look && it.slot !== 'head' && isHybrid(species) && hybridRoots(species).indexOf('funtrump') >= 0; } /* FUNTRUMP ★: look-locked pieces (Samurai sword = suit/Rare, Skateboard = hoodie/Legendary) only on a player FUNTRUMP of that look; Golden Hairspray also on FUNTRUMP hybrids */ if (it.id === 'kek-card') return species === 'kek' || (isHybrid(species) && hybridRoots(species).indexOf('kek') >= 0); /* owner Oct 20 ~6:17 PM CT: player Keks AND Kek hybrids (normal parents'-signature rule) */
    if (lockedOut(it.id, species, ELIG_B)) return false;
    if (it.id === CHUD_BEARD_ITEM) { var bd = body || (isHybrid(species) ? null : species); if (bd && BEARD_EXCLUDE[bd]) return false; } /* owner Oct 22: the beard looks bad on these bodies -> they never roll or wear it */
    if (it.id === WIZ_STAFF_ITEM) return species === 'wizard'; /* player Wizards only (no hybrids) */
    if (isHybrid(species)) { if (!it.exclusive) return true; var par = species.split(':').slice(1); return it.slot !== 'head' && par.indexOf(it.origin) >= 0; } /* hybrids (Jake's locked spec): shared + both parents' signatures EXCEPT their legendary head pieces */
    return !it.exclusive || it.origin === species; }
  function legendaryOf(species) { return ALL.map(view).filter(function (x) { return x && !x.noRoll && x.exclusive && x.origin === species; }).sort(function (a, b) { return (b.slot === 'head') - (a.slot === 'head'); }); } // head signature first, then the 6 other ★ pieces
  function pool(slot, species, tierIdx, body) {
    var all = RAW.map(view).filter(function (x) { return x && !x.noRoll && (x.rollSlot || x.slot) === slot && eligible(x.alias ? BY_ID[x.alias] : x, species, body, tierIdx); });
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
  function reindex(w) { if (w && w.items) FT_POOL_FROM = w.funtrumpMythic ? w.funtrumpMythic.block + 1 : Infinity; if (w && w.items) KEK_POOL_FROM = w.kekMythic ? w.kekMythic.block + 1 : Infinity; if (w && w.items) WIZ_POOL_FROM = w.wizardMythic ? Math.max(ACTIVATE_WIZ_COLD_BLOCK, w.wizardMythic.block + 1) : Infinity; /* worker / cached worlds: same pool switch as the replay */
    if (!w || w.__ix || !w.items) return w; Object.keys(w.items).forEach(function (k) { trk(w, w.items[k]); }); return w; }
  function ownedCountsScan(w, owner) { var m = {}; Object.keys(w.items).forEach(function (k) { var g = w.items[k]; if (g.owner === owner) m[g.item] = (m[g.item] || 0) + 1; }); return m; }
  function ownedCounts(w, owner) { if (!w.__ix) return ownedCountsScan(w, owner); var m = {}, c = w.__ix.own.get(owner) || {}; Object.keys(c).forEach(function (k) { if (c[k] > 0) m[k] = c[k]; }); return m; }
  function communityCounts(w) { var m = {}; (w.community.gearLog || []).forEach(function (g) { m[g.item] = (m[g.item] || 0) + 1; }); return m; }
  function pickItem(hex, slot, species, tierIdx, owned, body) { var p = pool(slot, species, tierIdx, body); if (!p.length) return null;
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
  /* ---- gifting helpers (pure) */
  function playerSeen(w, a) { if (!a) return; if (!w.players) { w.players = {}; w.playerList = []; } if (w.players[a] == null) { w.playerList.push(a); w.players[a] = w.playerList.length; } }
  function playerNo(w, a) { return w && w.players && w.players[a] != null ? w.players[a] : null; }
  function playerAddr(w, n) { n = Number(n); return w && w.playerList && n >= 1 ? w.playerList[n - 1] || null : null; }
  function playerCode(n) { return n == null ? '' : Number(n).toString(32).toUpperCase(); }
  function parsePlayer(s) { s = String(s || '').trim().toUpperCase().replace(/^P?#?/, ''); return /^[1-9A-V][0-9A-V]{0,6}$/.test(s) ? parseInt(s, 32) : null; }
  /** giveLocks(w, p, b) -> reason string or null: the locks a gift checks (shared by the replay and the UI). */
  function giveLocks(w, p, b, exceptSwap) {
    var qz = questBusyWhy(p, b); if (qz) return qz; /* Mythic quests: no gift / swap while away */
    if (p.lastGot != null && b < p.lastGot + GIVE_SETTLE) return 'just changed hands: can be gifted again from block ' + (p.lastGot + GIVE_SETTLE);
    if ((w.fights || []).some(function (f) { return f.status === 'open' && b - f.block <= FIGHT_WINDOW && fightPets(f).indexOf(p.id) >= 0; })) return 'pet has an open fight';
    if ((w.breedReqs || []).some(function (q) { return !q.used && b - q.block <= BREED_WINDOW && (q.a === p.id || q.b === p.id); })) return 'pet has a pending breed request';
    if (onRug(w, p, b)) return 'pet has an open Rug Me ad'; /* pet-shop-sales: Rug Me ads are an array of {pet, state}; the old object check never fired */
    if (saleListing(w, p.id, b)) return 'pet is listed in the shop';
    if ((w.swaps || []).some(function (X) { return X !== exceptSwap && swapOpen(w, X, b) && X.mine === p.id; })) return 'pet is offered in an open swap';
    return null; }
  /** giveWhy(w, t, src, b) -> rejection reason or null for {petId, to}. */
  function giveWhy(w, t, src, b, amt) { var p = w.byId[t.petId], to = playerAddr(w, t.to);
    if (amt != null && !(amt >= COSTS.give)) return 'below gift cost 1 dander';
    return !p ? 'no such pet' : p.community ? 'community pet' : p.released ? 'released' : p.owner !== src ? 'owner only' : p.dead ? 'dead (Pet Cemetery)' :
      !to ? 'no such player #' + playerCode(t.to) : to === src ? 'that is your own player #' : giveLocks(w, p, b); }
  /** giftMoves(w, p) -> { worn: [items], bag: [items] }: the gear that moves with a gifted pet. */
  function giftMoves(w, p) { var bag = ((w.bags || {})[p.id] || []).map(function (g) { return w.items[g]; }).filter(function (g) { return g && g.bag === p.id; });
    return { worn: wornOf(w, p.id), bag: bag }; }
  function givePlan(id, n) { return { tag: 'pet:give:' + id + ':' + playerCode(n), amount: COSTS.give, label: 'Gift #' + id + ' to player #' + playerCode(n) }; }
  /** giveBatches(ids, n) -> burn plans (each 1 dander, <= 34-byte tag) gifting every id to player n; picks the denser of the list / mask form per burn. */
  function giveBatches(ids, n) { var P = playerCode(n), out = [], i = 0;
    ids = ids.map(Number).filter(function (x, k, a) { return x >= 1 && a.indexOf(x) === k; }).sort(function (a, b) { return a - b; });
    while (i < ids.length) { var pre = 'pet:gives:' + P + ':', L = [], tl = pre; /* list form */
      for (var j = i; j < ids.length; j++) { var c = (L.length ? '.' : '') + ids[j].toString(32).toUpperCase(); if ((tl + c).length > MAX_TAG_BYTES) break; tl += c; L.push(ids[j]); }
      var st = ids[i], mp = pre + st + ':', cap = Math.min(24, MAX_TAG_BYTES - mp.length), M = []; /* mask form */
      for (var k = i; k < ids.length && ids[k] <= st + 5 * cap - 1; k++) M.push(ids[k]);
      var useM = M.length > L.length, inB = useM ? M : L, tag;
      if (inB.length === 1) tag = 'pet:give:' + inB[0] + ':' + P;
      else if (useM) { var d = []; M.forEach(function (x) { var o = x - st, q = Math.floor(o / 5); while (d.length <= q) d.push(0); d[q] |= 1 << (o % 5); }); tag = mp + d.map(function (v) { return v.toString(32).toUpperCase(); }).join(''); }
      else tag = tl;
      out.push({ tag: tag, ids: inB, amount: COSTS.give, label: 'Gift ' + inB.length + ' pet' + (inB.length > 1 ? 's' : '') + ' to player #' + P }); i += inB.length; }
    out.forEach(function (p, k) { if (out.length > 1) p.label += ' (burn ' + (k + 1) + ' of ' + out.length + ')'; }); return out; }
  function giftsTo(w, a) { return (w.giftLog || []).filter(function (g) { return g.to === a; }); }
  function swapOpen(w, X, b) { return X && X.status === 'open' && b - X.block <= SWAP_WINDOW; }
  /** swapWhy(w, X, src, b) -> why the accept fails (null = ok). */
  function swapWhy(w, X, src, b) { if (!X) return 'no such swap offer'; if (X.status !== 'open') return 'offer is ' + X.status; if (b - X.block > SWAP_WINDOW) return 'offer expired at block ' + (X.block + SWAP_WINDOW);
    var A = w.byId[X.mine], B = w.byId[X.theirs]; if (!A || !B) return 'no such pet'; if (B.owner !== src) return 'only the owner of #' + X.theirs + ' can accept'; if (A.owner !== X.from) return '#' + X.mine + ' changed hands';
    var e = function (p) { return p.community ? 'community pet' : p.released ? 'released' : p.dead ? 'dead (Pet Cemetery)' : giveLocks(w, p, b, X); };
    return e(A) ? '#' + A.id + ': ' + e(A) : e(B) ? '#' + B.id + ': ' + e(B) : null; }
  function swapsFor(w, a, b) { return (w.swaps || []).filter(function (X) { var B = w.byId[X.theirs]; return swapOpen(w, X, b) && (X.from === a || (B && B.owner === a)); }); }
  function swapPlan(mine, theirs) { return { tag: 'pet:swap:' + mine + ':' + theirs, amount: COSTS.give, label: 'Offer #' + mine + ' for #' + theirs }; }
  function swapOkPlan(n) { return { tag: 'pet:swapok:' + n, amount: COSTS.give, label: 'Accept swap ' + n }; }
  function swapNoPlan(n) { return { tag: 'pet:swapno:' + n, amount: COSTS.give, label: 'Close swap ' + n }; }
  /* ---- PET SHOP SALES: PET TOKENS (owner approved Oct 22 2026: pet tokens only). OFF while ACTIVATE_SALES_BLOCK is null: before the gate
   * pet:deed / pet:unsell are unknown tags (community food), opts.dex is never read and the replay is unchanged. Design: design/pet-deeds.md.
   *  - PET TOKEN ("deed"): a free Counterparty NUMERIC asset (A + 26^12+1 .. 2^64-1, 0 XCP fee), quantity 1, indivisible, locked, description
   *    exactly 'https://xcpets.fun/t/ID.json' (metadata URL; legacy 'xcpets pet #ID' also accepted), first issuance by the pet's owner. It is BOUND by a 1-dander burn pet:deed:ID:<asset number in base 36> from
   *    the same address once the issuance has confirmed (issuance block <= burn block). The newest valid binding is the pet's current token.
   *    (The burn is how every visitor finds the token: the API has no asset search.)
   *  - LISTING: a DEX order on the token's own pair: give 1 token, get the price in XCPETS or XCP, expiration <= SALE_MAX_EXPIRY, from the pet's
   *    owner, price >= SALE_MIN. No pet:sell burn: the order itself is the listing (orders up to SALE_ORDER_LAG blocks before the binding count
   *    from the binding block). Supply 1 + own pair = no other seller, no AMM pool, no cheapest-first problem.
   *  - SALE: a completed match of the listing order (1 token for exactly the price) moves the pet + worn + bag gear to the buyer; the binding
   *    travels too (the buyer now holds the token and can relist with one order).
   *  - INVALID: an order from anyone but the pet's owner is not a listing (gifted pet = the old token is held elsewhere: remint + bind).
   *  - ENDS: sold, expire_index passed, pet moved/died (void), or an optional 1-dander pet:unsell:<first 8 hex of the order> burn by the seller:
   *    the listing ends SALE_UNSELL_SETTLE blocks later (matches before that still sell). A DEX cancel alone ends trading at once but the
   *    replay can't see its block, so without pet:unsell the pet lock lasts until expire_index.
   *  - Order: DEX events (bindings' issuances are read, orders, matches) apply in block / tx order, before the burns of later blocks. */
  var ACTIVATE_SALES_BLOCK = ACTIVATE_SPAM_CITY_BLOCK, SALE_EXPIRY = 288, SALE_MAX_EXPIRY = 1008, SALE_ORDER_LAG = 6, SALE_UNSELL_SETTLE = 6;
  var SALE_MIN = { XCPETS: 100000000, XCP: 1000 }; /* smallest price: 1 XCPETS, or 1,000 sats of XCP */
  var DEED_MIN = '95428956661682177', DEED_MAX = '18446744073709551615'; /* 26^12 + 1 .. 2^64 - 1 */
  function salesOn(b) { return ACTIVATE_SALES_BLOCK != null && b != null && b >= ACTIVATE_SALES_BLOCK; }
  function saleQuote(a) { return a === 'XCPETS' || a === 'XCP'; }
  function numCmp(a, z) { return a.length - z.length || (a < z ? -1 : a > z ? 1 : 0); }
  /** deedOk(asset): a free numeric asset name A<26^12+1 .. 2^64-1>. */
  function deedOk(a) { var m = /^A([1-9][0-9]{16,19})$/.exec(String(a || '')); return !!m && numCmp(m[1], DEED_MIN) >= 0 && numCmp(m[1], DEED_MAX) <= 0; }
  /** deedDesc(id): the token description = the pet's metadata URL (Counterparty enhanced asset info / XChain TIS: a URL ending in .json;
   *  explorers fetch it and show its image). 27-32 bytes, inside the 52-byte compact limit. deedDescOk also accepts the legacy plain
   *  'xcpets pet #ID' (owner's test token A6558773293471858864) and the same URL without https:// or with http:// (spec: http assumed). */
  var DEED_URL = 'https://xcpets.fun/t/';
  function deedDesc(id) { return DEED_URL + id + '.json'; }
  function deedDescOk(d, id) { d = String(d == null ? '' : d); return d === deedDesc(id) || d === 'xcpets pet #' + id || d === 'xcpets.fun/t/' + id + '.json' || d === 'http://xcpets.fun/t/' + id + '.json'; }
  var B36 = '0123456789abcdefghijklmnopqrstuvwxyz';
  function decTo36(s) { var d = String(s).split('').map(Number), out = ''; while (d.length && !(d.length === 1 && d[0] === 0)) { var r = 0, q = [];
      d.forEach(function (x) { var v = r * 10 + x; q.push(Math.floor(v / 36)); r = v % 36; }); out = B36[r] + out; while (q.length > 1 && q[0] === 0) q.shift(); d = q; } return out || '0'; }
  function b36ToDec(s) { var d = [0]; String(s).toLowerCase().split('').forEach(function (c) { var v = B36.indexOf(c), carry = v; for (var i = d.length - 1; i >= 0; i--) { var x = d[i] * 36 + carry; d[i] = x % 10; carry = Math.floor(x / 10); }
      while (carry) { d.unshift(carry % 10); carry = Math.floor(carry / 10); } }); while (d.length > 1 && d[0] === 0) d.shift(); return d.join(''); }
  function deedTag(id, asset) { return 'pet:deed:' + id + ':' + decTo36(String(asset).slice(1)); }
  /** dexIndex(dex) -> { deeds: {asset: first issuance}, orders: {hash: order}, byGive: {asset: [orders]}, matches: {orderHash: [m]}, ev: [sorted order/match events] }.
   * dex = { issuances: [...], orders: [...], matches: [...] } (api.xcp.fun rows; see V2Sales.loadDex). */
  function dexIndex(d) { if (!d) return null; var sig = (d.issuances || []).length + ':' + (d.orders || []).length + ':' + (d.matches || []).length + ':' + (d.credits ? d.credits.length : '-') + ':' + (d.destructions || []).length; if (d._ix && d._ix.sig === sig) return d._ix;
    var deeds = {}, o = {}, byGive = {}, m = {}, ev = [];
    (d.issuances || []).forEach(function (x) { if (!x || !x.asset || x.status && x.status !== 'valid') return; var c = deeds[x.asset]; if (!c || Number(x.tx_index) < Number(c.tx_index)) deeds[x.asset] = x; });
    (d.orders || []).forEach(function (x) { if (x && x.tx_hash && !o[x.tx_hash]) { o[x.tx_hash] = x; (byGive[x.give_asset] = byGive[x.give_asset] || []).push(x); ev.push({ b: Number(x.block_index), i: Number(x.tx_index) || 0, k: 0, o: x }); } });
    var seenM = {}; (d.matches || []).forEach(function (x) { var id = x && (x.id || (x.tx0_hash + '_' + x.tx1_hash)); if (!x || seenM[id]) return; seenM[id] = 1;
      [x.tx0_hash, x.tx1_hash].forEach(function (h) { (m[h] = m[h] || []).push(x); }); ev.push({ b: Number(x.block_index), i: Number(x.tx1_index) || 0, k: 1, m: x }); });
    /* TOKEN IS THE PET (owner, Oct 23 2026): every credit of a pet token (send, MPMA, DEX fill, dispense, sweep, attach/detach) and every
     * destruction of it is an event; the newest holder owns the tied pet. hold[asset] = sorted credits (holderAt). */
    var hold = {}, seenC = {}; (d.credits || []).forEach(function (x) { var id = x && (x.credit_index != null ? 'c' + x.credit_index : [x.asset, x.tx_index, x.address, x.utxo, x.quantity, x.calling_function].join('|')); if (!x || seenC[id] || !(Number(x.quantity) >= 1)) return; seenC[id] = 1;
      (hold[x.asset] = hold[x.asset] || []).push(x); ev.push({ b: Number(x.block_index), i: Number(x.tx_index) || 0, k: 2, c: x }); });
    Object.keys(hold).forEach(function (a) { hold[a].sort(function (x, z) { return Number(x.block_index) - Number(z.block_index) || (Number(x.tx_index) || 0) - (Number(z.tx_index) || 0) || (Number(x.credit_index) || 0) - (Number(z.credit_index) || 0); }); });
    (d.destructions || []).forEach(function (x) { if (x && x.asset && (x.status == null || x.status === 'valid') && Number(x.quantity) >= 1) ev.push({ b: Number(x.block_index), i: Number(x.tx_index) || 0, k: 3, x: x }); });
    Object.keys(deeds).forEach(function (a) { var x = deeds[a]; if (x.block_index != null) ev.push({ b: Number(x.block_index), i: Number(x.tx_index) || 0, k: 4, n: x }); }); /* mint = tie (rulesOn only) */
    ev.sort(function (a, z) { return a.b - z.b || a.i - z.i || a.k - z.k; });
    var ix = { hold: hold, credits: !!d.credits, deeds: deeds, orders: o, byGive: byGive, matches: m, ev: ev, sig: sig }; try { Object.defineProperty(d, '_ix', { value: ix, enumerable: false, writable: true, configurable: true }); } catch (e) { } return ix; }
  function saleExpire(o) { return o.expire_index != null ? Number(o.expire_index) : Number(o.block_index) + Number(o.expiration) - 1; }
  /** saleState(w, S, b): 'open' | 'sold' | 'void' | 'expired' | 'ended' (pet:unsell). 'open' = the pet is locked and the order can still sell it. */
  function saleState(w, S, b) { if (S.status !== 'open') return S.status; if (S.endBlock != null && b >= S.endBlock) return 'ended'; if (b > S.expire) return 'expired';
    var P = w.byId[S.petId]; return !P || P.dead || P.released || P.owner !== S.seller || P.deed !== S.give ? 'void' : 'open'; }
  function saleListing(w, id, b) { return (w.listings || []).filter(function (S) { return S.petId === id && saleState(w, S, b) === 'open'; })[0] || null; }
  function openListings(w, b) { return (w.listings || []).filter(function (S) { return saleState(w, S, b) === 'open'; }); }
  function petFree(w, p, src, b) { return !p ? 'no such pet' : p.community ? 'community pet' : p.released ? 'released' : p.owner !== src ? 'owner only' : p.dead ? 'dead (Pet Cemetery)' : p.cold ? 'in Cold Storage' : null; }
  /** deedIssueWhy(iss, id, src, b) -> why this issuance can't be pet #id's token for src at block b (null = ok). */
  function deedIssueWhy(iss, id, src, b) { if (!iss) return 'token issuance not found (not confirmed yet, or data not loaded: retry)';
    if (!deedOk(iss.asset)) return 'not a free numeric asset (A + 17-20 digits)';
    if (iss.source !== src && iss.issuer !== src) return 'token was issued by another address';
    if (Number(iss.block_index) > b) return 'token issuance confirmed after the burn';
    if (Number(iss.quantity) !== 1 || iss.divisible === true || iss.divisible === 1 || !(iss.locked === true || iss.locked === 1)) return 'token must be quantity 1, indivisible and locked';
    if (!deedDescOk(iss.description, id)) return "token description must be exactly '" + deedDesc(id) + "'";
    return null; }
  /** deedWhy(w, t {petId, asset}, src, b, amt, ix) -> rejection reason for a pet:deed burn (null = ok). ix undefined = pet checks only (UI). */
  function deedWhy(w, t, src, b, amt, ix) { var p = w.byId[t.petId];
    if (amt != null && !(amt >= COSTS.give)) return 'below token cost 1 dander';
    var e = petFree(w, p, src, b); if (e) return e; if (saleListing(w, p.id, b)) return 'pet #' + p.id + ' is listed in the shop';
    var cur = p.deed && w.deeds && w.deeds[p.deed]; if (rebindGuardOn(b) && cur && p.deed !== t.asset && !cur.destroyed && cur.holder === p.owner) return 'pet #' + p.id + ' already has token ' + p.deed + ' and you hold it: destroy that token first, then tie a new one';
    if (ix === undefined) return null; if (!ix) return 'token data not loaded yet (retry)';
    if (w.deeds && w.deeds[t.asset]) return 'token ' + t.asset + ' is already bound to pet #' + w.deeds[t.asset].petId;
    return deedIssueWhy(ix.deeds[t.asset], p.id, src, b); }
  /** deedScan(w, rows, dex) -> { petId: {asset, block, tx, by} } the ONE verified token per pet, read-only (never used by replay(); for the
   *  /t/<id>.json "verified" field and the shop-test page while ACTIVATE_SPAM_CITY_BLOCK is null). Anti-fake rule = the game rule:
   *  a pet:deed:ID:<b36> burn counts only if its source is the pet's CURRENT owner (w at tip), the pet is alive/not released, >= 1 dander,
   *  and the token's FIRST issuance was by that same address, confirmed at/before the burn, qty 1, indivisible, locked, desc = the pet's URL
   *  (deedDescOk). A token already tied to another pet can't be re-tied. A newer valid tie by the owner REPLACES the older one (newest wins). */
  function deedScan(w, rows, dex) { var ix = dexIndex(dex || {}), out = {}, used = {};
    /* after the gate the replay itself binds tokens (and the holder owns the pet): report exactly what it bound */
    if (w.deeds && Object.keys(w.deeds).length && salesOn(w.tip)) { (w.pets || []).forEach(function (p) { var D = p.deed && w.deeds[p.deed]; if (D && !p.dead && !p.released && !p.community) out[p.id] = { asset: p.deed, block: D.block, tx: D.tx, by: D.issuer, holder: D.holder }; }); return out; }
    readBurns(rows || []).forEach(function (r) { var t; try { t = parseTag(r.tag); } catch (e) { t = null; } if (!t || t.action !== 'deed') return;
      var p = w.byId[t.petId], b = Number(r.block_index); if (!p || p.dead || p.released || p.community || p.owner !== r.source || !(r.amount >= COSTS.give)) return;
      if (used[t.asset] != null && used[t.asset] !== p.id) return; if (deedIssueWhy(ix.deeds[t.asset], p.id, r.source, b)) return;
      used[t.asset] = p.id; out[p.id] = { asset: t.asset, block: b, tx: r.tx_hash, by: r.source }; });
    /* mint-only ties (rule 3, same as replay applyMint): a token minted with the pet's URL BEFORE ACTIVATE_ONE_TIE_PATH_BLOCK is tied by the mint itself
     * (no pet:deed burn needed); a mint at/after the gate ties nothing. A burn tie wins over a mint tie (it is always the newer, deliberate step). */
    Object.keys(ix.deeds || {}).forEach(function (a) { var x = ix.deeds[a], id = mintId(x.description), p = id != null && w.byId[id], b = Number(x.block_index), src = x.source || x.issuer;
      if (!p || out[p.id] || used[a] != null || !mintTiesOn(b) || p.dead || p.released || p.community || (p.art && p.art.community) || p.owner !== src) return;
      if (deedIssueWhy(x, p.id, src, b)) return; used[a] = p.id; out[p.id] = { asset: a, block: b, tx: x.tx_hash, by: src, mint: true }; });
    return out; }
  /** listWhy(w, o, b) -> why DEX order o can't be a listing at block b (null = ok). */
  function listWhy(w, o, b) { var D = w.deeds && w.deeds[o.give_asset]; if (!D) return 'not a pet token';
    var p = w.byId[D.petId]; if (!p || p.deed !== o.give_asset) return 'old token of #' + D.petId + ' (a newer token is bound)';
    var e = petFree(w, p, o.source, b) || questBusyWhy(p, b); if (e) return e === 'owner only' ? 'token holder is not the pet owner (remint the token)' : e;
    if (Number(o.give_quantity) !== 1) return 'order must give the 1 token';
    if (!saleQuote(o.get_asset)) return 'price must be in XCPETS or XCP';
    if (!(Number(o.expiration) >= 1) || Number(o.expiration) > SALE_MAX_EXPIRY) return 'order expiry over ' + SALE_MAX_EXPIRY + ' blocks';
    var q = Number(o.get_quantity); if (!(q >= SALE_MIN[o.get_asset]) || q !== Math.floor(q)) return 'price below ' + (o.get_asset === 'XCP' ? SALE_MIN.XCP + ' sats' : '1 XCPETS');
    if (saleExpire(o) < b) return 'order already expired';
    if (saleListing(w, p.id, b)) return 'pet #' + p.id + ' is already listed';
    var lk = giveLocks(w, p, b); if (lk) return lk;
    return null; }
  function addListing(w, o, b) { var why = listWhy(w, o, b); if (why) { (w.shopSkips = w.shopSkips || []).push({ block: b, order: o.tx_hash, why: why }); return null; }
    var D = w.deeds[o.give_asset], S = { n: w.listings.length + 1, petId: D.petId, seller: o.source, block: b, tx: o.tx_hash, order: o.tx_hash, orderBlock: Number(o.block_index), give: o.give_asset, asset: o.get_asset, price: Number(o.get_quantity), expire: saleExpire(o), status: 'open' };
    w.listings.push(S); w.log.push({ block: b, tx: o.tx_hash, kind: 'listing', petId: D.petId, listing: S.n, msg: '#' + D.petId + ' is in the shop (listing ' + S.n + ', until block ' + S.expire + ')' }); return S; }
  /** bindDeed(w, t, src, b, tx, ix): a valid pet:deed burn. Orders up to SALE_ORDER_LAG blocks old that are still unmatched become a listing from b. */
  function bindDeed(w, p, asset, src, b, tx, ix) { var old = p.deed; p.deed = asset; var h = (ix && holderAt(ix, asset, b)) || src; w.deeds[asset] = { petId: p.id, block: b, tx: tx, issuer: src, holder: h, prev: old || null };
    if (h !== src) movePet(w, p, h, b, tx, 'tie'); /* token already sent on (e.g. mint -> tie + send in one go): the pet goes to the holder at once */
    var c = (ix.byGive[asset] || []).filter(function (o) { var ob = Number(o.block_index); return ob < b && b - ob <= SALE_ORDER_LAG && o.source === src && !(ix.matches[o.tx_hash] || []).some(function (m) { return m.block_index < b; }); })
      .sort(function (a, z) { return (Number(z.tx_index) || 0) - (Number(a.tx_index) || 0); });
    if (c[0]) addListing(w, c[0], b); }
  /** saleFill(S, m) -> {ok, buyer, why}: is match m an exact, completed fill of listing S (1 token for exactly the price)? */
  function saleFill(S, m) { var mine0 = m.tx0_hash === S.order;
    var gaveA = mine0 ? m.forward_asset : m.backward_asset, gaveQ = Number(mine0 ? m.forward_quantity : m.backward_quantity),
      gotA = mine0 ? m.backward_asset : m.forward_asset, gotQ = Number(mine0 ? m.backward_quantity : m.forward_quantity), buyer = mine0 ? m.tx1_address : m.tx0_address;
    if (m.status !== 'completed') return { ok: false, why: 'match is ' + m.status };
    if (gaveA !== S.give || gaveQ !== 1) return { ok: false, why: 'seller side was ' + gaveQ + ' ' + gaveA + ' (no sale)' };
    if (gotA !== S.asset || gotQ !== S.price) return { ok: false, why: 'paid ' + gotQ + ' ' + gotA + ', listing asks ' + S.price + ' ' + S.asset + ' (no sale)' };
    if (!buyer || buyer === S.seller) return { ok: false, why: 'filled by the seller (no sale)' };
    return { ok: true, buyer: buyer }; }
  function applyMatch(w, m) { var S = (w.listings || []).filter(function (x) { return x.status === 'open' && (x.order === m.tx0_hash || x.order === m.tx1_hash); })[0]; if (!S) return;
    var mb = Number(m.block_index), P = w.byId[S.petId]; if (P) liveAt(w, P, mb);
    var st = saleState(w, S, mb); if (st !== 'open') { if (st !== 'void') return; }
    var f = saleFill(S, m);
    if (f.ok && st === 'void') f = { ok: false, why: 'pet was ' + (!P ? 'gone' : P.dead ? 'dead' : P.released ? 'released' : P.deed !== S.give ? 'given a new token' : 'no longer the seller\'s') + ' (no sale)' };
    var lg = { block: mb, tx: m.tx1_hash, kind: f.ok ? 'sale' : 'saleVoid', petId: S.petId, listing: S.n };
    if (!f.ok) { S.status = 'void'; S.voidBlock = mb; S.voidWhy = f.why; S.matchId = m.id; lg.msg = 'listing ' + S.n + ' (#' + S.petId + '): ' + f.why; w.log.push(lg); return; }
    if (rulesOn(mb) && P.movedAt === mb && P.owner !== f.buyer) f = { ok: false, why: 'pet already moved in block ' + mb + ' (one move per block)' };
    if (!f.ok) { S.status = 'void'; S.voidBlock = mb; S.voidWhy = f.why; S.matchId = m.id; lg.msg = 'listing ' + S.n + ' (#' + S.petId + '): ' + f.why; w.log.push(lg); return; }
    var mv = giftMoves(w, P); P.owner = f.buyer; P.lastGot = mb; if (rulesOn(mb)) { P.movedAt = mb; if (isBurnAddr(f.buyer)) P.burnedTo = { block: mb, tx: m.tx1_hash, addr: f.buyer }; } mv.worn.concat(mv.bag).forEach(function (g) { g.owner = f.buyer; }); w.deeds[S.give].holder = f.buyer;
    Object.assign(S, { status: 'sold', buyer: f.buyer, soldBlock: mb, matchId: m.id, gear: mv.worn.length + mv.bag.length });
    var gr = { block: mb, tx: m.tx1_hash, petId: P.id, from: S.seller, to: f.buyer, toNo: playerNo(w, f.buyer), tier: P.tier, sale: S.n, gear: S.gear };
    (P.gifts = P.gifts || []).push(gr); (w.giftLog = w.giftLog || []).push(gr);
    lg.msg = '#' + P.id + ' found a new home through the shop (listing ' + S.n + ')' + (S.gear ? ' with ' + S.gear + ' gear' : ''); w.log.push(lg); }
  /** holderAt(ix, asset, b) -> address that holds the 1 token after block b (null = unknown / no credit data). */
  function creditTo(c) { return c.address || c.utxo_address || null; }
  function holderAt(ix, asset, b) { var L = ix && ix.hold && ix.hold[asset], h = null; (L || []).forEach(function (c) { if (Number(c.block_index) <= b) h = creditTo(c) || h; }); return h; }
  /** movePet(w, P, to, b, tx, how): the tied pet follows its token. Gear (worn + bag) moves with it, open listings/fights/breed asks/Rug Me ads by
   *  the old owner can no longer use it (they all check owner). */
  function movePet(w, P, to, b, tx, how) { if (P && to && P.owner !== to && questOn(b) && P.pob) { P.pob = false; P.pobLost = b; } /* Ash Gone with the Wind */ if (!P || !to || P.owner === to) return; var from = P.owner, mv = giftMoves(w, P); P.owner = to; P.lastGot = b; mv.worn.concat(mv.bag).forEach(function (g) { g.owner = to; });
    if (rulesOn(b)) { P.movedAt = b; if (isBurnAddr(to)) P.burnedTo = { block: b, tx: tx, addr: to }; else if (P.burnedTo) delete P.burnedTo; }
    var gr = { block: b, tx: tx, petId: P.id, from: from, to: to, toNo: playerNo(w, to), tier: P.tier, gear: mv.worn.length + mv.bag.length, token: P.deed, how: how };
    (P.gifts = P.gifts || []).push(gr); (w.giftLog = w.giftLog || []).push(gr);
    w.log.push({ block: b, tx: tx, kind: 'tokenMove', petId: P.id, msg: '#' + P.id + ' moved with its token ' + P.deed + ' to ' + to.slice(0, 10) + '…' + (gr.gear ? ' with ' + gr.gear + ' gear' : '') });
    if (P.burnedTo && P.burnedTo.block === b) w.log.push({ block: b, tx: tx, kind: 'tokenBurnAddr', petId: P.id, msg: '#' + P.id + ' was sent to a burn address (' + to + '): out of play, nobody can use it' }); }
  function applyCredit(w, c, b) { var D = w.deeds && w.deeds[c.asset]; if (!D) return; var to = creditTo(c); if (!to) return; D.holder = to;
    var P = w.byId[D.petId]; if (!P || P.deed !== c.asset || P.dead || P.released || P.community) return;
    if (rulesOn(b) && P.movedAt === b && P.owner !== to) { w.log.push({ block: b, tx: c.tx_hash || c.event, kind: 'tokenMoveIgnored', petId: P.id, msg: '#' + P.id + ' already moved in block ' + b + ': this second move (token to ' + to.slice(0, 10) + '…) is ignored, the pet stays with ' + P.owner.slice(0, 10) + '…' }); return; }
    liveAt(w, P, b); if (P.dead) return; movePet(w, P, to, b, c.tx_hash || c.event, c.calling_function || 'send'); }
  /** a destroyed pet token unties the pet: it stays with its last holder and can get a new token (pet:deed) later. */
  function applyDestroy(w, x, b) { var D = w.deeds && w.deeds[x.asset]; if (!D) return; D.holder = null; D.destroyed = b; var P = w.byId[D.petId];
    if (P && P.deed === x.asset) { P.deed = null; w.log.push({ block: b, tx: x.tx_hash, kind: 'tokenGone', petId: P.id, msg: '#' + P.id + "'s token " + x.asset + ' was destroyed: the pet has no token now' }); } }
  /** settleSales(w, upto, ix, inclusive): apply DEX events (new orders on bound tokens, matches) with block < upto (<= upto when inclusive). */
  function settleSales(w, upto, ix, inclusive) { if (!ix || !w.listings) return; var k = w._dexPos || 0;
    for (; k < ix.ev.length; k++) { var e = ix.ev[k]; if (e.b < ACTIVATE_SALES_BLOCK) continue; if (inclusive ? e.b > upto : e.b >= upto) break;
      if (rulesOn(e.b) && !w._grand) grandfather(w, ix);
      if (e.n) { if (mintTiesOn(e.b)) applyMint(w, e.n, e.b, ix); continue; }
      if (e.o) { if (w.deeds[e.o.give_asset]) addListing(w, e.o, e.b); } else if (e.m) applyMatch(w, e.m); else if (e.c) applyCredit(w, e.c, e.b); else if (e.x) applyDestroy(w, e.x, e.b); }
    if (!w._grand && rulesOn(upto)) grandfather(w, ix);
    try { Object.defineProperty(w, '_dexPos', { value: k, enumerable: false, writable: true, configurable: true }); } catch (x) { } }
  /** mintId(desc) -> the pet id a token description names (deedDescOk forms), or null. */
  function mintId(d) { var m = /^(?:https?:\/\/)?xcpets\.fun\/t\/([1-9][0-9]{0,8})\.json$/.exec(String(d || '')) || /^xcpets pet #([1-9][0-9]{0,8})$/.exec(String(d || '')); return m ? Number(m[1]) : null; }
  /** applyMint(w, x, b, ix): rule 3, a confirmed first issuance by the pet's current owner ties the token if the pet has none. */
  function applyMint(w, x, b, ix) { var id = mintId(x.description), p = id != null && w.byId[id]; if (!p || p.deed || (w.deeds && w.deeds[x.asset])) return;
    var src = x.source || x.issuer, why = deedWhy(w, { petId: id, asset: x.asset }, src, b, null, ix); if (why) { (w.shopSkips = w.shopSkips || []).push({ block: b, mint: x.tx_hash, petId: id, why: why }); return; }
    bindDeed(w, p, x.asset, src, b, x.tx_hash, ix); w.log.push({ block: b, tx: x.tx_hash, kind: 'deed', petId: id, asset: x.asset, msg: '#' + id + ' has a pet token: ' + x.asset + ' (made and tied in one step)' }); }
  /** grandfather(w, ix): once, at ACTIVATE_SPAM_RULES_BLOCK: pre-sales-gate pet:deed ties (w._preTies) still valid now, whose token the owner still holds. */
  function grandfather(w, ix) { try { Object.defineProperty(w, '_grand', { value: 1, enumerable: false, writable: true, configurable: true }); } catch (e) { w._grand = 1; }
    var G = ACTIVATE_SPAM_RULES_BLOCK; (w._preTies || []).forEach(function (q) { var p = w.byId[q.t.petId]; if (!p || p.deed) return;
      if (deedWhy(w, q.t, q.src, G, null, ix)) return; var h = holderAt(ix, q.t.asset, G - 1); if (h && h !== q.src) return;
      bindDeed(w, p, q.t.asset, q.src, G, q.tx, ix); w.log.push({ block: G, tx: q.tx, kind: 'deed', petId: p.id, asset: q.t.asset, msg: '#' + p.id + ' has a pet token: ' + q.t.asset + ' (tie from block ' + q.b + ', honoured at block ' + G + ')' }); }); }
  /** unsellWhy(w, t {ord}, src, b, amt) -> [reason, listing]. */
  function unsellWhy(w, t, src, b, amt) { if (amt != null && !(amt >= COSTS.give)) return ['below cost 1 dander'];
    var S = (w.listings || []).filter(function (x) { return x.seller === src && String(x.order).slice(0, 8) === t.ord && saleState(w, x, b) === 'open'; })[0];
    if (!S) return ['no open listing ' + t.ord + '… from this address']; if (S.endBlock != null) return ['listing ' + S.n + ' already ends at block ' + S.endBlock]; return [null, S]; }
  /** deedOf(w, p) -> { asset, holder, ok } | null: the pet's current token; ok = the pet's owner holds it (known to the replay). */
  function deedOf(w, p) { if (!p || !p.deed || !w.deeds || !w.deeds[p.deed]) return null; var D = w.deeds[p.deed]; return { asset: p.deed, holder: D.holder, ok: D.holder === p.owner, block: D.block }; }
  /** saleBusy(w, t, src, b) -> reason when a burn would use a pet that is listed (null = fine). */
  function saleBusy(w, t, src, b) { var ids = [];
    if (t.action === 'fight' || t.action === 'sd') ids = [t.a, t.b]; else if (t.action === 'tt') ids = [].concat(t.a, t.b);
    else if (t.action === 'join' || t.action === 'rumble' || t.action === 'rug') ids = [t.petId]; else if (t.action === 'breed') ids = [t.a, t.b];
    else if (t.action === 'ad' || t.action === 'release') ids = t.ids || [t.petId];
    else if (t.action === 'accept') { var F = w.fights && w.fights[t.fightId - 1]; if (F) ids = fightPets(F); }
    for (var i = 0; i < ids.length; i++) { var p = w.byId[ids[i]]; if (p && p.owner === src && saleListing(w, p.id, b)) return 'pet #' + p.id + ' is listed in the shop (it unlocks when it sells or the listing ends)'; }
    return null; }
  /* OLD MONEY (owner Oct 22 2026): the ONE Old Money check. A pet bred (two parents, not a community pet) before ACTIVATE_BREED_135_BLOCK,
   * i.e. while breeding cost 690, carries a DISPLAY-ONLY collector badge. V2Badges.oldMoney delegates here. Never read by replay. */
  var OLD_MONEY_LABEL = 'Old Money 💰';
  function oldMoney(p) { if (!p || !p.parents || p.parents.length !== 2 || (p.art && p.art.community)) return false; var g = ACTIVATE_BREED_135_BLOCK; return g == null || (p.hatchBlock != null && p.hatchBlock < g); }
  /* ---- shared pet filter (UI only, never read by replay): one filter object used by the shop binder, My listings, the sell picker and the
   * pet-gift batch / swap pickers. f = { sp, tier ('0'-'3' | 'M'), st, badge ('om' Old Money | 'hyb' hybrid), cur ('XCPETS'|'XCP'), min, max (whole
   * XCPETS or sats), pw (min Power), bl (min breeds left), gear ('1' = wears gear), buy ('1' = would fill first), state, sort ('cost'|'-cost'|'power'|'new'|'rarity') }.
   * x = { p: pet, S: listing (optional), buy: bool (optional) }. */
  function pfMyth(p) { return !!p.mythicCare || p.stage >= 5; }
  function pfRank(p) { return pfMyth(p) ? 4 : p.tier || 0; }
  function pfUnits(S) { return S.price / 1e8; } /* shop-safety: XCP and XCPETS both in whole coins (was XCP in sats) */
  function petFilterMatch(w, x, f, b) { var p = x.p, S = x.S; f = f || {};
    if (f.sp && p.species !== f.sp) return false;
    if (f.tier !== undefined && f.tier !== '' && (f.tier === 'M' ? !pfMyth(p) : pfMyth(p) || String(p.tier) !== String(f.tier))) return false;
    if (f.st !== undefined && f.st !== '' && String(p.stage) !== String(f.st)) return false;
    if (f.badge === 'om' && !oldMoney(p)) return false; if (f.badge === 'hyb' && !isHybrid(p.species)) return false;
    if (f.pw && petPower(p) < Number(f.pw)) return false;
    if (f.bl && breedsLeft(p, b).left < Number(f.bl)) return false;
    if (f.gear === '1' && !wornOf(w, p.id).length) return false;
    if (S) { if (f.cur && S.asset !== f.cur) return false; if (f.min !== undefined && f.min !== '' && pfUnits(S) < Number(f.min)) return false; if (f.max !== undefined && f.max !== '' && pfUnits(S) > Number(f.max)) return false;
      if (f.state && saleState(w, S, b) !== f.state) return false; }
    if (f.buy === '1' && !x.buy) return false;
    return true; }
  function petFilterSort(list, sort) { var c = { cost: function (a, z) { return (a.S ? pfUnits(a.S) : 0) - (z.S ? pfUnits(z.S) : 0); }, power: function (a, z) { return petPower(z.p) - petPower(a.p); },
      'new': function (a, z) { return ((z.S && z.S.block) || z.p.hatchBlock || 0) - ((a.S && a.S.block) || a.p.hatchBlock || 0); }, rarity: function (a, z) { return pfRank(z.p) - pfRank(a.p); } };
    var fn = sort === '-cost' ? function (a, z) { return -c.cost(a, z); } : c[sort]; if (!fn) return list.slice();
    return list.map(function (x, i) { return [x, i]; }).sort(function (a, z) { return fn(a[0], z[0]) || ((a[0].S && z[0].S) ? (a[0].S.asset < z[0].S.asset ? -1 : a[0].S.asset > z[0].S.asset ? 1 : 0) : 0) || a[0].p.id - z[0].p.id || a[1] - z[1]; }).map(function (a) { return a[0]; }); }
  function petFilter(w, list, f, b) { return petFilterSort(list.filter(function (x) { return petFilterMatch(w, x, f, b); }), f && f.sort); }
  /* ---- sales: pure UI helpers (never sign; the page hands these to js/v2-wallet.js) */
  /** randomDeed(bytes8) -> a free numeric asset name 'A' + 17-20 digits from 8 random bytes (uniform enough; the page 404-checks it). */
  function randomDeed(bytes) { var n = '0'; for (var i = 0; i < 8; i++) n = addDec(mulDec(n, 256), String((bytes[i] || 0) & 255));
    if (numCmp(n, DEED_MIN) < 0) n = addDec(n, DEED_MIN); /* 0 .. 2^64-1 -> DEED_MIN .. 2^64-1 (n + DEED_MIN stays below 2^64) */
    return 'A' + n; }
  function mulDec(a, k) { var r = '', c = 0; for (var i = a.length - 1; i >= 0; i--) { var x = +a[i] * k + c; r = (x % 10) + r; c = Math.floor(x / 10); } while (c) { r = (c % 10) + r; c = Math.floor(c / 10); } return r.replace(/^0+(?=\d)/, ''); }
  function addDec(a, z) { var r = '', c = 0, i = a.length - 1, j = z.length - 1; while (i >= 0 || j >= 0 || c) { var s = (i >= 0 ? +a[i--] : 0) + (j >= 0 ? +z[j--] : 0) + c; r = (s % 10) + r; c = s >= 10 ? 1 : 0; } return r.replace(/^0+(?=\d)/, ''); }
  /** mintPlan(id, asset) -> the free issuance (window 1 of 3, first listing only). */
  function mintPlan(id, asset) { return { kind: 'issuance', asset: asset, quantity: 1, divisible: false, lock: true, description: deedDesc(id), petId: id, label: 'Make the token for #' + id }; }
  function deedPlan(id, asset) { return { tag: deedTag(id, asset), amount: COSTS.give, petId: id, label: 'Tie token ' + asset + ' to #' + id }; }
  /** listPlan(id, deed, asset, price) -> the listing order: give the 1 token, get exactly the price. */
  function listPlan(id, deed, asset, price) { return { kind: 'order', give_asset: deed, give_quantity: 1, get_asset: asset, get_quantity: Math.round(Number(price)), expiration: SALE_EXPIRY, fee_required: 0, petId: id, label: 'List #' + id }; }
  /** buyPlan(S) -> gives exactly the price, gets the 1 token, expires after 1 block. */
  function buyPlan(S) { return { kind: 'order', give_asset: S.asset, give_quantity: S.price, get_asset: S.give, get_quantity: 1, expiration: 1, fee_required: 0, petId: S.petId, listing: S.n, label: 'Buy #' + S.petId + ' (listing ' + S.n + ')' }; }
  function cancelPlan(S) { return { kind: 'cancel', offer_hash: S.order, petId: S.petId, listing: S.n, label: 'Cancel listing ' + S.n + ' (#' + S.petId + ')' }; }
  function unsellTag(orderHash) { return 'pet:unsell:' + String(orderHash).slice(0, 8).toLowerCase(); }
  function unsellPlan(S) { return { tag: unsellTag(S.order), amount: COSTS.give, petId: S.petId, listing: S.n, label: 'Unlock #' + S.petId + ' early' }; }
  /** buyGuard(w, S, book, b, me) -> null (Buy is safe) or the reason Buy is off. book = the token pair's orders (api rows). */
  function buyGuard(w, S, book, b, me) { if (!S || saleState(w, S, b) !== 'open') return 'this listing has ended';
    if (me && me === S.seller) return 'this is your own listing';
    var o = (book || []).filter(function (x) { return x.tx_hash === S.order; })[0]; if (!o || o.status !== 'open' || Number(o.give_remaining) !== 1) return 'the listing order is not open on the DEX (' + (o ? o.status : 'not found') + ')';
    return null; }
  /** sellStep(w, p, me, b) -> 'mint' (no usable token: make + tie one) | 'list' (token held by the owner: one order). */
  function sellStep(w, p, me) { var d = deedOf(w, p); return d && d.ok && d.holder === me ? 'list' : 'mint'; }
  /** saleAmountText(asset, q): XCPETS as whole XCPETS + dander, XCP as whole XCP with up to 8 decimals (shop-safety: was sats; display only). */
  function saleAmountText(asset, q) { q = Number(q); if (asset === 'XCP') { var wx = Math.floor(q / 1e8), fx = String(q - wx * 1e8); fx = ('00000000' + fx).slice(-8).replace(/0+$/, ''); return wx.toLocaleString('en-US') + (fx ? '.' + fx : '') + ' XCP'; }
    var whole = Math.floor(q / 1e8), d = q - whole * 1e8; return whole.toLocaleString('en-US') + ' XCPETS' + (d ? ' + ' + d + ' dander' : ''); }
  function parseTag(tag) {
    var t = String(tag || '').trim().toUpperCase(), p = t.split(':'); if (p[0] !== 'PET') return { action: 'plain' };
    var a = p[1], n = function (i) { return parseInt(p[i], 10); };
    if (a === 'HATCH' && p.length === 2) return { action: 'hatch' };
    if (a === 'HATCHWIZ' && p.length === 2) return { action: 'hatchwiz' }; /* Wizard egg (inert before ACTIVATE_WIZ_COLD_BLOCK + the Wizard's Mythic) */
    if (a === 'KEKCARD' && (p.length === 2 || (p.length === 3 && idOk(p[2])))) return { action: 'kekcard', petId: p.length === 3 ? n(2) : null }; /* LORDKEK card claim (inert: same rejection as an unknown tag until kekCardOn) */
    if (a === 'SIGN' && (p.length === 2 || (p.length === 3 && idOk(p[2])))) return { action: 'wsign', petId: p.length === 3 ? n(2) : null }; /* Join us sign claim (inert before) */
    if (a === 'HATCHZAP' && p.length === 2) return { action: 'zap', n: ELECTRIC_N, cost: ELECTRIC_COST }; /* Electric Eggs; plain burn below ACTIVATE_ELECTRIC_BLOCK */
    if ((a === 'HATCH12' || a === 'HATCH144') && p.length === 2) return { action: 'pack', n: a === 'HATCH12' ? 12 : 144, cost: a === 'HATCH12' ? 690 : 6900 };
    if (a === 'FEED' && p.length === 2) return { action: 'cfeed' };
    if (a === 'QUEST' && p.length === 4 && idOk(p[2]) && /^(SPAM|COLD|KEK|WIZ|MINE)$/.test(p[3])) return { action: 'quest', petId: n(2), q: p[3].toLowerCase() }; /* Mythic quests; inert (unknown tag) below ACTIVATE_QUEST_BLOCK */
    if (a === 'LOOK' && p.length >= 5 && (p.length - 3) % 2 === 0 && (p.length - 3) / 2 <= LOOK_MAX_PAIRS && idOk(p[2])) { var lops = []; for (var li = 3; li < p.length; li += 2) { if (!LOOK_CODES[p[li]] || (p[li + 1] !== 'ON' && p[li + 1] !== 'OFF')) return { action: 'invalid' }; lops.push({ code: p[li], on: p[li + 1] === 'ON' }); } return { action: 'look', petId: n(2), ops: lops }; } /* look picker; inert below ACTIVATE_LOOK_PICK_BLOCK */
    if (a === 'AURA' && p.length === 4 && idOk(p[2]) && (p[3] === 'ON' || p[3] === 'OFF')) return { action: 'aura', petId: n(2), on: p[3] === 'ON' }; /* flame looks Lights On / Out; inert below ACTIVATE_QUEST_BLOCK */
    if (a === 'FEED' && p.length === 3 && idOk(p[2])) return { action: 'feed', petId: n(2) };
    if (a === 'ROLL' && p.length === 3 && idOk(p[2])) return { action: 'roll', petId: n(2) };
    if (a === 'FR' && p.length === 3 && idOk(p[2])) return { action: 'froll', petId: n(2) };
    if (a === 'GRAVE' && p.length === 3 && idOk(p[2])) return { action: 'grave', petId: n(2), on: true }; /* grave gear opt-in; inert before ACTIVATE_GRAVE_GEAR_BLOCK */
    if (a === 'GRAVE' && p.length === 4 && idOk(p[2]) && p[3] === 'OFF') return { action: 'grave', petId: n(2), on: false };
    if (a === 'OF' && p.length === 3 && idOk(p[2])) return { action: 'oroll', petId: n(2) }; /* overflow roll (Mythic discount); inert before ACTIVATE_MYTHIC_DISCOUNT_BLOCK */
    if (a === 'USESPIN' && (p.length === 2 || (p.length === 3 && /^(10|[1-9])$/.test(p[2])))) return { action: 'usespin', n: p.length === 3 ? n(2) : 1 }; /* saved spins; inert before ACTIVATE_SPINS_BLOCK; N > 10 is invalid */
    if (a === 'SPIN' && p.length === 2) return { action: 'spin' }; /* Pepe Wheel spin (random pet); inert before ACTIVATE_WHEEL_RANDOM_BLOCK */
    if (a === 'GIVE' && p.length === 4 && idOk(p[2]) && /^[1-9A-V][0-9A-V]{0,6}$/.test(p[3])) return { action: 'give', petId: n(2), to: parseInt(p[3], 32) }; /* gifting; inert before ACTIVATE_GIVE_BLOCK */
    if (a === 'GIVES' && (p.length === 4 || p.length === 5) && /^[1-9A-V][0-9A-V]{0,6}$/.test(p[2])) { /* batch gift; inert before ACTIVATE_GIVE_BLOCK */
      var gto = parseInt(p[2], 32), gids = [];
      if (p.length === 4 && /^[1-9A-V][0-9A-V]{0,5}(\.[1-9A-V][0-9A-V]{0,5})*$/.test(p[3])) { gids = p[3].split('.').map(function (x) { return parseInt(x, 32); }); /* list form: base-32 ids, ascending */
        for (var gi = 1; gi < gids.length; gi++) if (!(gids[gi] > gids[gi - 1])) return { action: 'invalid' }; return { action: 'gives', to: gto, ids: gids }; }
      if (p.length === 5 && idOk(p[3]) && /^[0-9A-V]{1,24}$/.test(p[4])) { for (var gj = 0; gj < p[4].length; gj++) { var gv = parseInt(p[4][gj], 32); for (var gb = 0; gb < 5; gb++) if (gv & (1 << gb)) gids.push(n(3) + 5 * gj + gb); } /* mask form: START + base-32 bit mask, like pet:rel */
        return gids.length ? { action: 'gives', to: gto, ids: gids } : { action: 'invalid' }; }
      return { action: 'invalid' }; }
    if (a === 'DEED' && p.length === 4 && idOk(p[2]) && /^[1-9A-Z][0-9A-Z]{0,12}$/.test(p[3])) { var dA = 'A' + b36ToDec(p[3]); if (deedOk(dA)) return { action: 'deed', petId: n(2), asset: dA }; } /* pet token binding; inert before ACTIVATE_SALES_BLOCK */
    if (a === 'UNSELL' && p.length === 3 && /^[0-9A-F]{8}$/.test(p[2])) return { action: 'unsell', ord: p[2].toLowerCase() }; /* end a shop listing early; inert before ACTIVATE_SALES_BLOCK */
    if (a === 'SWAP' && p.length === 4 && idOk(p[2]) && idOk(p[3])) return { action: 'swap', mine: n(2), theirs: n(3) }; /* swaps; inert before ACTIVATE_GIVE_BLOCK */
    if ((a === 'SWAPOK' || a === 'SWAPNO') && p.length === 3 && idOk(p[2])) return { action: a === 'SWAPOK' ? 'swapok' : 'swapno', n: n(2) };
    if (a === 'HI' && p.length === 2) return { action: 'hi' }; /* hello burn (player #); inert before ACTIVATE_GIVE_BLOCK */
    if (a === 'WAGMI' && p.length === 2) return { action: 'wagmi' }; /* inert before ACTIVATE_WAGMI_BLOCK */
    if (a === 'FIGHT' && p.length === 4 && idOk(p[2]) && idOk(p[3])) return { action: 'fight', a: n(2), b: n(3) };
    if (a === 'ACCEPT' && p.length === 3 && idOk(p[2])) return { action: 'accept', fightId: n(2) };
    if (a === 'SD' && p.length === 4 && idOk(p[2]) && idOk(p[3])) return { action: 'sd', a: n(2), b: n(3) }; /* arena modes: inert before ACTIVATE_ARENA_MODES_BLOCK */
    if (a === 'TT' && p.length === 4 && /^[1-9][0-9]{0,6}\.[1-9][0-9]{0,6}$/.test(p[2]) && /^[1-9][0-9]{0,6}\.[1-9][0-9]{0,6}$/.test(p[3])) return { action: 'tt', a: p[2].split('.').map(Number), b: p[3].split('.').map(Number) };
    if (a === 'JOIN' && p.length === 4 && idOk(p[2]) && idOk(p[3])) return { action: 'join', fightId: n(2), petId: n(3) };
    if (a === 'RUMBLE' && p.length === 3 && idOk(p[2])) return { action: 'rumble', petId: n(2) };
    if (a === 'AD' && p.length >= 4) { /* Rug Me (inert before ACTIVATE_RUGME_BLOCK): any pet:ad:... parses; rugCheck gives the reason for a bad one */
      var aids = String(p[2]).split('.'), bad = aids.every(idOk) ? null : 'bad pet id list ' + p[2]; aids = aids.map(function (x) { return parseInt(x, 10); });
      if (!bad && aids.some(function (x, i) { return aids.indexOf(x) !== i; })) bad = 'a pet is listed twice';
      if (p.length > 5 || (p.length === 5 && !/^B\d{1,2}$/.test(p[4]))) bad = bad || 'too many fields'; /* owner 8:47 PM: bios are always random; an old-format :Bn field is accepted and IGNORED */
      return { action: 'ad', ids: aids, petId: aids[0], req: p[3], bad: bad, len: Buffer_len(t) }; }
    if (a === 'RUG' && p.length === 4 && idOk(p[2]) && idOk(p[3])) return { action: 'rug', petId: n(2), adId: n(3) };
    if (a === 'UNAD' && p.length === 3 && idOk(p[2])) return { action: 'unad', adId: n(2) };
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
  /* ACTIVATE_FIGHT_GEAR_BLOCK (audit-fixes, PREVIEW: tip 972985 at Oct 24 2026 ~6:15 PM CT + 6; re-set to tip + 6 when merged).
   * Equip ops are local to one device (localStorage), so before this block two viewers with different local equips could
   * replay a different fight. From this block, fights, rumbles and spoils read only ON-CHAIN gear: what the pet wears from
   * chain events alone (auto-wear on rolls, won pieces, sweeps), as if no local equip op existed. replay() gets that by running
   * the same rows once without ops and recording, per fight, the gear each pet wore there (chainGear below). Local equips still
   * show on the pet; they just do not count in fights. Before the block nothing changes. */
  var ACTIVATE_FIGHT_GEAR_BLOCK = 973000; /* tip 972994 + 6 */
  function fightGearOn(b) { return b >= ACTIVATE_FIGHT_GEAR_BLOCK; }
  /* chainGear(w, kind, id): gear gids for a fight read. Recording world (no ops): record wornOf. Main world: read the record. */
  function chainGear(w, kind, id, list) {
    var cg = w && w._cg; if (!cg || !fightGearOn(w._b || 0)) return list();
    var k = kind + ':' + (w._b || 0) + ':' + id, n = cg.n[k] = (cg.n[k] || 0) + 1; k += ':' + n;
    if (cg.rec) { var l = list(); cg.map[k] = l.map(function (g) { return g.gid; }); return l; }
    var gids = cg.map[k]; if (!gids) return list(); /* same chain events => always recorded; fallback keeps old behavior */
    return gids.map(function (gid) { return w.items[gid]; }).filter(Boolean);
  }
  function snapshot(p, w) { return { id: p.id, name: p.name, species: p.species, tier: p.tier, stage: p.stage, stats: Object.assign({}, p.stats),
    gear: w ? chainGear(w, 'snap', p.id, function () { return wornOf(w, p.id); }).map(function (g) { return { gid: g.gid, item: g.item, slot: g.slot }; }) : [] }; }
  function weaponOf(s) { var h = (s.gear || []).filter(function (g) { return g.slot === 'hand'; })[0]; return h && BY_ID[h.item] ? BY_ID[h.item].label : 'bare paws'; }
  /** simulateFight(seedStr, snapA, snapB) -> { winner:'a'|'b', turns:[...], hp } — pure; same inputs => same fight. */
  function simulateFight(seedStr, A, B, start) { /* start (arena modes, Tag Team): optional carried-over HP { a, b }; omitted = Classic, unchanged */
    var R = stream('XCPETS:v2:fight:' + seedStr + ':' + JSON.stringify([A.stats, A.gear, B.stats, B.gear]));
    function hp0(s) { return 40 + s.stats.vigor * 2 + s.stats.grit + s.stage * 6; }
    var hp = { a: hp0(A), b: hp0(B) }, max = { a: hp.a, b: hp.b }, side = { a: A, b: B }, turns = [];
    if (start) { if (start.a != null) hp.a = start.a; if (start.b != null) hp.b = start.b; }
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

  function fightHp0(s) { return 40 + s.stats.vigor * 2 + s.stats.grit + s.stage * 6; }
  /** simulateSudden(seedStr, A, B) -> { winner, turns, maxA, maxB, coin } (arena modes). First landed swing wins; a crit can't be dodged.
   * Miss = defender dodge (zoom/5 %) or whiff (10 + grit/6 % minus the attacker's gear power, capped at 15). 12 misses = seeded coin flip.
   * Turns use the Classic shape (hpA/hpB/dmg) so the arena scene plays them unchanged: a hit takes the target to 0. */
  function simulateSudden(seedStr, A, B) {
    var R = stream('XCPETS:v2:sd:' + seedStr + ':' + JSON.stringify([A.stats, A.gear, B.stats, B.gear]));
    var hp = { a: fightHp0(A), b: fightHp0(B) }, max = { a: hp.a, b: hp.b }, side = { a: A, b: B }, turns = [], winner = null;
    var first = (A.stats.zoom + R() % 10) >= (B.stats.zoom + R() % 10) ? 'a' : 'b';
    for (var t = 0; t < FIGHT_TURNS && !winner; t++) {
      var at = t % 2 === 0 ? first : (first === 'a' ? 'b' : 'a'), df = at === 'a' ? 'b' : 'a', s = side[at], d = side[df];
      var crit = R() % 100 < 5 + Math.floor(s.stats.luck / 4), dodge = R() % 100 < Math.floor(d.stats.zoom / 5), whiff = R() % 100 < Math.max(0, 10 + Math.floor(d.stats.grit / 6) - Math.min(15, gearPower(s.gear)));
      var hit = crit || (!dodge && !whiff), dmg = hit ? hp[df] : 0; if (hit) { hp[df] = 0; winner = at; }
      turns.push({ n: t + 1, by: at, weapon: weaponOf(s), dmg: dmg, crit: crit && hit, dodge: !hit, hpA: hp.a, hpB: hp.b, sd: true });
    }
    var coin = !winner; if (!winner) winner = R() % 2 ? 'a' : 'b';
    return { winner: winner, turns: turns, maxA: max.a, maxB: max.b, coin: coin };
  }
  /** simulateTag(seedStr, [A1, A2], [B1, B2]) -> { winner: 'a'|'b', bouts, out } (arena modes). Relay of Classic bouts: the bout loser is out,
   * the winner stays with the HP it has left, the loser's partner tags in at full HP; ends when one side has no pets left (max 3 bouts). */
  function simulateTag(seedStr, As, Bs) {
    var ia = 0, ib = 0, hpA = null, hpB = null, bouts = [], out = [];
    for (var k = 1; ia < As.length && ib < Bs.length && k <= 3; k++) {
      var x = As[ia], y = Bs[ib], res = simulateFight(seedStr + ':tt' + k, x, y, { a: hpA, b: hpB }), last = res.turns[res.turns.length - 1];
      var endA = last ? last.hpA : (hpA != null ? hpA : fightHp0(x)), endB = last ? last.hpB : (hpB != null ? hpB : fightHp0(y));
      bouts.push({ k: k, a: x.id, b: y.id, winner: res.winner === 'a' ? x.id : y.id, loser: res.winner === 'a' ? y.id : x.id, turns: res.turns, maxA: res.maxA, maxB: res.maxB, startA: hpA != null ? hpA : res.maxA, startB: hpB != null ? hpB : res.maxB });
      if (res.winner === 'a') { out.push({ id: y.id, by: x.id }); ib++; hpA = Math.max(1, endA); hpB = null; } else { out.push({ id: x.id, by: y.id }); ia++; hpB = Math.max(1, endB); hpA = null; }
    }
    return { winner: ia < As.length ? 'a' : 'b', bouts: bouts, out: out };
  }

  // ---------------------------------------------------------------- replay
  var SALE_DEX = null;
  var CG_CACHE = null;
  function replay(rows, blockHashes, ops, opts) {
    rows = rows || []; blockHashes = blockHashes || {}; ops = ops || []; opts = opts || {};
    var cgIn = null; /* ACTIVATE_FIGHT_GEAR_BLOCK: the on-chain gear record (a replay of the same rows with no local ops; cached per input) */
    if (opts._cgRec) cgIn = { rec: true, map: {}, n: {} };
    else if (ops.length && (opts.tip == null || opts.tip >= ACTIVATE_FIGHT_GEAR_BLOCK) && ops.some(function (o) { return o && o.kind === 'equip'; })) {
      var C = CG_CACHE;
      if (!(C && C.rows === rows && C.len === rows.length && C.hashes === blockHashes && C.nh === Object.keys(blockHashes).length && C.tip === opts.tip && C.dex === opts.dex && C.live === opts.live && C.cutoff === opts.cutoff)) {
        var w0 = replay(rows, blockHashes, [], Object.assign({}, opts, { _cgRec: true }));
        C = CG_CACHE = { rows: rows, len: rows.length, hashes: blockHashes, nh: Object.keys(blockHashes).length, tip: opts.tip, dex: opts.dex, live: opts.live, cutoff: opts.cutoff, map: w0._cg.map };
      }
      cgIn = { rec: false, map: C.map, n: {} };
    }
    var cut = (opts.cutoff != null ? opts.cutoff : CUTOFF_BLOCK) + 1 /* cut = first v2 block; opts.cutoff is inclusive like CUTOFF_BLOCK */, eng = opts.live !== undefined ? opts.live : LIVE_ENGINE;
    rows = readBurns(rows);
    var preRows = eng ? rows.filter(function (r) { return r.block_index < cut; }) : [];
    if (preRows.length) rows = rows.filter(function (r) { return r.block_index >= cut; });
    var ev = rows.map(function (r, i) { return { r: r, i: i, b: r.block_index, o: 0 }; }).concat(ops.map(function (o, i) { return { op: o, i: i, b: o.block_index, o: 1 }; }));
    ev.sort(function (x, y) { return x.b - y.b || x.o - y.o || x.i - y.i; });
    var tip = opts.tip != null ? opts.tip : ev.reduce(function (a, e) { return Math.max(a, e.b); }, 0);
    WIZ_POOL_FROM = Infinity; KEK_POOL_FROM = Infinity; FIRE_HASHES = blockHashes;
    var w = { _cg: cgIn, pets: [], byId: {}, items: {}, nextPet: 1, log: [], community: { burned: 0, feeds: 0, feeders: {}, gear: {}, gearLog: [] }, fights: [], rumbles: {}, breedReqs: [], tip: tip, nextItem: 1, tokens: {} };
    var seen = {};
    if (preRows.length) importLive(w, eng.replay(preRows.map(function (r) { return r.raw; }), blockHashes, { tip: cut - 1 }), cut);
    w.wagmi = {}; w.wagmiFirst = {}; w.swaps = []; w.players = {}; w.playerList = []; w.giftLog = [];
    SALE_DEX = opts.dex || null; var saleIx = salesOn(tip) ? dexIndex(SALE_DEX) : null; if (salesOn(tip)) { w.listings = []; w.deeds = {}; }
    preRows.forEach(function (r) { playerSeen(w, (r.raw || r).source); });
    function L(e, kind, msg, extra) { var o = Object.assign({ block: e.block_index, tx: e.tx_hash, kind: kind, msg: msg }, extra || {}); w.log.push(o); return o; }
    var resolvedWeeks = {};
    function maybeRumbles(b) { Object.keys(w.rumbles).forEach(function (wk) { var R = w.rumbles[wk]; if (!R.done && b >= R.seedBlock && blockHashes[R.seedBlock]) resolveRumble(w, R, blockHashes[R.seedBlock]); }); }
    w.burnedBy = {}; w.questsOut = []; w.questFeed = []; preRows.forEach(function (r) { var x = r.raw || r, a = Number(r.amount != null ? r.amount : x.quantity / 1e8); if (a > 0) w.burnedBy[x.source] = (w.burnedBy[x.source] || 0) + a; });
    w.freeRolls = {}; w.overflowUsed = {}; w.mythicOwners = {}; w.founderSeen = {}; preRows.forEach(function (r) { w.founderSeen[r.raw ? r.raw.tx_hash : r.tx_hash] = 1; });
    ev.forEach(function (e) {
      if (saleIx) settleSales(w, e.b, saleIx);
      spinsGate(w, e.b); wizHatClear(w, e.b); grantFounders(w, e.b); grantWizPriority(w, e.b); grantTop3Wiz(w, e.b); grantBurnLords(w, e.b, blockHashes); relabelTiers(w, e.b); wizTierRelabel(w, e.b); wizTier2Relabel(w, e.b); repairGear(w, e.b); maybeRumbles(e.b); questLaunch(w, e.b); questSettle(w, e.b, blockHashes, L); earnSweep(w, e.b); lookSweep(w, e.b);
      if (e.op) { applyOp(w, e.op); return; }
      var r = e.r; if (seen[r.tx_hash]) return; seen[r.tx_hash] = 1; playerSeen(w, r.source);
      var amt = Number(r.amount), bh = blockHashes[r.block_index], t = parseTag(r.tag), v2 = r.block_index >= V2_FROM_BLOCK;
      w.burnedBy[r.source] = (w.burnedBy[r.source] || 0) + amt; w.community.burned += amt; // EVERY valid burn feeds the community pet (incl. failed actions, fights, rumbles, breeds)
      if (w.community.returnBlock == null && returnProgress(w.community.burned).done) { w.community.returnBlock = r.block_index; w.community.returnTx = r.tx_hash; }
      wizTrack(w, r, amt); kekTrack(w, r, amt); ftTrack(w, r, amt); /* FUNTRUMP care (live from 972,880) */ /* Lord Kek care + Cold Storage (live from 972,396) */ /* Wizard Cold Storage trigger (display record, see ACTIVATE_WIZ_COLD_BLOCK) */
      if (!v2 && (t.action === 'fight' || t.action === 'accept' || t.action === 'rumble' || t.action === 'breed')) { L(r, 'plain', 'before v2 cutoff block ' + V2_FROM_BLOCK + ': plain burn (community food)'); return; }
      if (fireOn(r.block_index)) fireExtend(w, r.block_index - 1); /* fire sale arms are decided for blocks before this burn */
      var res = handle(w, r, t, amt, bh, L); if (fireOn(r.block_index)) fireCredit(w, r, t, amt, res); if (earnOn(r.block_index) && res && res.kind !== 'rejected' && res.kind !== 'plain' && res.petId != null) earnBurn(w, w.byId[res.petId], amt, r.block_index);
    });
    if (saleIx) settleSales(w, tip, saleIx, true);
    lookSweep(w, tip); if (fireOn(tip)) fireExtend(w, tip); spinsGate(w, tip); wizHatClear(w, tip); grantFounders(w, tip); grantWizPriority(w, tip); grantTop3Wiz(w, tip); grantBurnLords(w, tip, blockHashes); relabelTiers(w, tip); wizTierRelabel(w, tip); wizTier2Relabel(w, tip); repairGear(w, tip); maybeRumbles(tip); questLaunch(w, tip); questSettle(w, tip, blockHashes, L); earnSweep(w, tip);
    w.pets.forEach(function (p) { finish(w, p, tip); });
    var rp = returnProgress(w.community.burned), cm = w.community;
    if (rp.done && cm.returnBlock == null) cm.returnBlock = w.cutoff ? w.cutoff.lastLiveBlock : tip; // already past it in the imported live total
    cm.returned = rp.done; cm.returnCount = rp.count; cm.goal = COMMUNITY_GOAL; cm.goalPct = rp.pct;
    cm.wizardFed = rp.done ? cm.burned - COMMUNITY_GOAL : 0; cm.current = rp.done ? 'wizard' : 'nakamoto';
    cm.wizardStage = rp.done ? wizardStage(cm.wizardFed, tip) : 0; cm.wizardStageName = STAGE_NAMES[cm.wizardStage];
    cm.petName = rp.done ? COMMUNITY_WIZARD_NAME : 'Nakamoto'; cm.petRole = COMMUNITY_PET; /* display only (2026-10-16): the wizard community pet is named 'Bitcoin Wizard'; internal id stays 'wizard' */ cm.petStage = rp.done ? cm.wizardStage : 5; cm.petStageName = STAGE_NAMES[cm.petStage];
    if (kekOn(tip) && w.wizardMythic) { var KK = w.kek || { fed: 0, feeds: 0, by: {} }; /* Lord Kek = community pet #3 (gated) */
      cm.kekFed = KK.fed; cm.kekStage = stageFor(KK.fed, COMMUNITY_THRESHOLDS); cm.current = 'kek'; if (!w.kekMythic) cm.nextPet = 'kek';
      cm.petName = 'Lord Kek'; cm.petStage = cm.kekStage; cm.petStageName = STAGE_NAMES[cm.petStage]; }
    if (ftOn(tip) && w.kekMythic) { var FT = w.funtrump || { fed: 0, feeds: 0, by: {} }; /* FUNTRUMP = community pet #4 (live from 972,880) */
      cm.funtrumpFed = FT.fed; cm.funtrumpStage = stageFor(FT.fed, COMMUNITY_THRESHOLDS); cm.current = 'funtrump'; cm.nextPet = w.funtrumpMythic ? null : 'funtrump';
      cm.petName = 'FUNTRUMP'; cm.petStage = cm.funtrumpStage; cm.petStageName = STAGE_NAMES[cm.petStage]; }
    w.community.leaderboard = Object.keys(w.community.feeders).map(function (a) { return { address: a, amount: w.community.feeders[a] }; }).sort(function (a, b) { return b.amount - a.amount || (a.address < b.address ? -1 : 1); });
    w.fights.forEach(function (f) { if (f.status === 'open' && tip - f.block > FIGHT_WINDOW) f.status = 'expired'; });
    w.itemList = Object.keys(w.items).map(function (k) { return w.items[k]; }).filter(function (g) { return g.bag == null; }); /* any-slot rolls: pet-bound bag pieces stay out of the stash */
    if (w._cg && !w._cg.rec) delete w._cg; /* the record is only needed while replaying */
    return w;
  }
  /** fireCredit: a valid discounted-action burn in a live sale that paid at least the full (era) price -> one saved wheel spin (ledger only). */
  function fireCredit(w, r, t, amt, res) { var b = r.block_index; var rugF = (t.action === 'ad' || t.action === 'rug') && rugOn(b); /* Rug Me burns earn credit only from ACTIVATE_RUGME_BLOCK (below it they are rejected anyway) */
    if (!res || res.kind === 'rejected' || !(FIRE_ACTIONS[t.action] || rugF) || !saleAt(w, b) || (t.action === 'zap' && !electricOn(b))) return;
    var full = rugF ? fullAt(w, t.action === 'ad' ? RUG_AD_COST * ((t.ids && t.ids.length) || 1) : rugCost(b), b) : t.action === 'hatch' ? fullAt(w, COSTS.hatch, b) : t.action === 'pack' || t.action === 'zap' ? fullAt(w, t.cost, b) : t.action === 'spin' ? fullAt(w, COSTS.roll, b) : t.action === 'breed' ? fullAt(w, breedCost(b), b) : COSTS[t.action] != null ? fullAt(w, COSTS[t.action], b) : w._fireFull;
    w._fireFull = null; if (full == null || amt + 5e-9 < full) return;
    w.fireSpins = w.fireSpins || {}; w.fireSpinLog = w.fireSpinLog || []; w.fireSpins[r.source] = (w.fireSpins[r.source] || 0) + 1;
    w.fireSpinLog.push({ block: b, tx: r.tx_hash, owner: r.source, action: t.action, paid: amt, full: full, sale: saleAt(w, b).arm }); }
  function liveAt(w, p, b) { // refresh age/death/neglect at block b
    var last = p.lastFed != null ? p.lastFed : p.hatchBlock, th = petThresholds(w, p, b); if (p.clockFrom != null) last = Math.max(last, p.clockFrom); // live pets: live death-clock anchor
    p.mythicCare = p.care >= th[5] || !!p.ascended;
    p.deathBlock = p.mythicCare ? null : (day(last) + NEGLECT_DAYS + 1) * BLOCKS_PER_DAY;
    p.dead = !p.released && p.deathBlock != null && b >= p.deathBlock;
    p.neglected = !p.mythicCare && day(b) - day(last) >= NEGLECTED_AFTER_DAYS;
    p.stage = p.ascended ? 5 : stageFor(p.care, th); p.stageName = STAGE_NAMES[p.stage]; if (p.stage === 5) noteMythicOwner(w, p, b);
    p.ageDays = day(b) - day(p.hatchBlock); p.fedDays = Object.keys(p.feedDays).length;
    p.capacity = capacity(p.ageDays, p.fedDays);
    if (mythicSlotsOn(b)) { if (p.mythicCare || p.stage === 5) p.capacity = V2_SLOTS.length; /* MYTHIC SLOTS: Mythic pets have all 6 slots */
      p.maxCap = Math.max(p.maxCap || 0, p.capacity); p.capacity = p.maxCap; } /* slots never close once open (max reached, counted from the gate) */
    p.openSlots = V2_SLOTS.slice(0, p.capacity);
    if (p.liveSlots) { p.liveSlots.forEach(function (sl) { if (p.openSlots.indexOf(sl) < 0) p.openSlots.push(sl); }); p.openSlots.sort(function (a, b) { return V2_SLOTS.indexOf(a) - V2_SLOTS.indexOf(b); }); p.capacity = p.openSlots.length; } // slots = max(live, v2)
    if (w.bags && w.bags[p.id]) unbag(w, p); /* any-slot rolls: a bagged piece frees up once its slot opens */
  }
  function finish(w, p, tip) {
    liveAt(w, p, tip);
    if (p.dead) { var keep = !!p.graveGear && graveOn(p.graveGear); /* grave gear: a flagged pet keeps what it wore at death (on + grave = its id); default: back to the bag */
      wornOf(w, p.id).forEach(function (g) { if (keep) g.grave = p.id; else g.on = null; }); } /* gear index (smooth-perf): same items taken off, no full scan per dead pet */
    p.fedToday = !!p.feedDays[day(tip)]; p.nextMeal = mealFor(p.care, p.species, tip, petThresholds(w, p, tip)); var nmc = mealCost(w, p, p.nextMeal, tip + 1); if (nmc !== p.nextMeal) { p.nextCare = p.nextMeal; p.nextMeal = nmc; } /* nextMeal = XCPETS to burn (halving), nextCare = care it adds */ p.hungry = !p.dead && !p.released && !p.fedToday && p.nextMeal > 0;
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
      mine.forEach(function (g) { if (!slotOpen(p, g.slot) || keep[g.slot]) off.push(g); else keep[g.slot] = g; }); /* oldest stays, newer duplicates come off */
      if (!off.length) return; off.forEach(function (g) { g.on = null; });
      p.gearFix = { block: b, items: off.map(function (g) { return g.label || g.item; }) };
      w.log.push({ block: b, tx: null, kind: 'gearfix', petId: p.id, msg: '#' + p.id + ': gear over capacity repaired, back to the stash: ' + p.gearFix.items.join(', ') }); }); }
  function wornOf(w, pid) { if (!w.__ix) return Object.keys(w.items || {}).map(function (k) { return w.items[k]; }).filter(function (g) { return g.on === pid; });
    var a = w.__ix.on.get(pid); return a ? a.slice() : []; }
  function wornIn(w, pid, slot) { return wornOf(w, pid).filter(function (g) { return g.slot === slot; })[0] || null; }
  function newItem(w, it, owner, src) { var gid = 'g' + (w.nextItem++); w.items[gid] = { gid: gid, item: it.id, label: it.label, slot: it.slot, tier: it.tier, legendary: isLegendary(it), owner: owner, on: null, src: src }; trk(w, w.items[gid]); return w.items[gid]; }
  function wear(w, p, g) { if (!slotOpen(p, g.slot)) return false; if (!eligible(g.item, p.species, bodyOf(p), p.tier)) return false; var cur = wornIn(w, p.id, g.slot); if (cur) cur.on = null; if (gearCapOn(w._b)) wornOf(w, p.id).forEach(function (x) { if (x.slot === g.slot) x.on = null; }); g.on = p.id; return true; }
  function giveRandomPiece(w, loser, winnerPet, seedHex, why) {
    var take = chainGear(w, 'take', loser.id + ':' + seedHex, function () { return wornOf(w, loser.id); }).filter(function (g) { return !g.legendary && (!fightGearOn(w._b || 0) || g.owner === loser.owner); }); /* from ACTIVATE_FIGHT_GEAR_BLOCK: on-chain gear only */ // legendary species pieces are never takeable
    if (!take.length) return null;
    var g = take[parseInt(seedHex.slice(0, 8), 16) % take.length]; g.on = null; g.owner = winnerPet.owner; g.from = loser.id; g.wonBy = winnerPet.id; g.why = why;
    liveAt(w, winnerPet, w._b || 0); if (!wornIn(w, winnerPet.id, g.slot)) wear(w, winnerPet, g);
    return g;
  }
  function fightable(p, b) { if (!p) return 'no such pet'; var qz = questBusyWhy(p, b); if (qz) return qz; if (p.released) return 'released'; if (p.dead) return 'dead'; if (p.stage < 2) return 'Egg/Hatchling pets cannot fight'; if (p.neglected) return 'neglected pets cannot fight'; return null; }
  function breedable(p, b) { if (!p) return 'no such pet'; var qz = questBusyWhy(p, b); if (qz) return qz; if (p.released) return 'released'; if (p.dead) return 'dead'; if (p.species === 'nakamoto' && (!nakaNormal(b) || p.community)) return 'Nakamoto cannot breed'; if (p.species === 'wizard' && !WIZ_CAN_BREED && !wizBreedOn(b)) return 'Bitcoin Wizard cannot breed (yet)'; if (p.species === 'kek' && !(KEK_CAN_BREED && kekOn(b))) return 'Lord Kek cannot breed (yet)'; if (p.species === 'funtrump' && !(FUNTRUMP_CAN_BREED && ftBreedOn(b))) return 'FUNTRUMP can breed once he reaches Cold Storage';
    if (p.community) return 'community pet cannot breed'; if (p.stage < 3) return 'needs Adult+'; if (p.neglected) return 'neglected'; if (breedCapOn(b) && p.breeds >= BREED_MAX) return 'max ' + BREED_MAX + ' breedings';
    if (breedV2On(b) && (p.breedsV2 || 0) >= BREED_CAP_V2) return 'breeding cap reached (' + BREED_CAP_V2 + '/' + BREED_CAP_V2 + ' lifetime breeds used)';
    if (p.lastBreed != null && b - p.lastBreed < BREED_COOLDOWN) return 'breeding cooldown (' + (BREED_COOLDOWN - (b - p.lastBreed)) + ' blocks left)'; return null; }

  /* breed-accept-guard (2026-10-20, display/send guard only; NOT used by replay): would a pet:breed:A:B burn sent now be rejected?
   * Same checks and order as handle() 'breed' (pets must be breedable at the next block). Returns null or a player-facing reason. */
  function breedWhy(id, why) { return why ? '#' + id + (/^breeding cooldown/.test(why) ? ' is on ' + why : ': ' + why) : null; }
  function breedBlock(w, tag, tip) { var t = parseTag(tag); if (!t || t.action !== 'breed' || !w || !w.byId) return null; var b = (tip || w.tip || 0) + 1;
    if (t.a === t.b) return 'two different pets'; return breedWhy(t.a, breedable(w.byId[t.a], b)) || breedWhy(t.b, breedable(w.byId[t.b], b)); }
  /** sendBlock(w, plan, tip, o) -> null | reason (wasted-burn audit 2026-10-20; send/display guard only, NOT used by replay).
   * Mirrors handle() for breed / breed accept / fight / fight accept / roll / free roll / overflow roll, judged at the next block (tip + 1).
   * plan = { tag, amount?, accept? (true when the button promises an accept) }; o = { me, pending: [tags of my unconfirmed burns] }. */
  var SEND_MARGIN = 3; /* blocks: an accept sent with fewer blocks left than this may confirm after the window */
  function sendBlock(w, plan, tip, o) { o = o || {}; var tag = typeof plan === 'string' ? plan : plan && plan.tag, t = parseTag(tag); if (!t || !w || !w.byId) return null;
    var b = (tip || w.tip || 0) + 1, me = o.me, P = function (id) { return w.byId[id]; }, pend = (o.pending || []).map(function (g) { return parseTag(g); }).filter(Boolean), amt = plan && plan.amount;
    if (t.action === 'swap' || t.action === 'swapok' || t.action === 'swapno') { if (!giveOn(b)) return 'swaps open at a later block';
      if (t.action === 'swapok') return swapWhy(w, w.swaps && w.swaps[t.n - 1], me || '', b);
      if (t.action === 'swap') { var sa = P(t.mine), sb = P(t.theirs); return !sa || !sb ? 'no such pet' : me && sa.owner !== me ? 'offer a pet of yours' : sb.owner === sa.owner ? 'both pets are yours' : sa.dead || sb.dead ? 'dead (Pet Cemetery)' : sa.community || sb.community ? 'community pet' : giveLocks(w, sa, b); }
      return swapOpen(w, w.swaps && w.swaps[t.n - 1], b) ? null : 'offer is not open'; }
    if (t.action === 'gives') { if (!giveOn(b)) return 'gifting opens at a later block'; var gok = t.ids.filter(function (id) { return !giveWhy(w, { petId: id, to: t.to }, me || (w.byId[id] || {}).owner, b, amt); }); return gok.length ? null : 'no pet in this batch can be gifted'; }
    if (t.action === 'give') { if (!giveOn(b)) return 'gifting opens at a later block'; var gpd = pend.some(function (q) { return q.action === 'give' && q.petId === t.petId; }); return gpd ? 'a gift of this pet is already pending' : giveWhy(w, t, me || (w.byId[t.petId] || {}).owner, b, amt); }
    if (t.action === 'usespin') { if (!spinsOn(b)) return 'saved spins open at block ' + ACTIVATE_SPINS_BLOCK; var sl = me ? spinsLeft(w, me, b, o.pending) : null; return sl != null && sl < t.n ? 'only ' + sl + ' saved spin' + (sl === 1 ? '' : 's') + ' left' : null; }
    if (/^(ad|rug|unad)$/.test(t.action)) { if (!rugOn(b)) return 'Rug Me is not open yet' + (ACTIVATE_RUGME_BLOCK != null ? ' (block ' + ACTIVATE_RUGME_BLOCK + ')' : ''); var dup = pend.some(function (q) { return q.action === t.action && String(q.ids || q.petId) === String(t.ids || t.petId) && q.adId === t.adId; }); if (dup) return 'that Rug Me burn is still waiting to confirm'; return me ? rugCheck(w, t, me, b, amt, P) : null; }
    if (t.action === 'breed') { var X = P(t.a), Y = P(t.b); if (amt != null && below(w, amt, breedCost(b), b)) return 'below breed cost ' + costAt(w, breedCost(b), b); if (!X) return 'no such pet #' + t.a; if (me && X.owner !== me) return 'first pet must be yours'; if (t.a === t.b) return 'two different pets';
      var why = breedWhy(t.a, breedable(X, b)) || breedWhy(t.b, breedable(Y, b)); if (why) return why; if (breedV2On(b) && kinWhy(X, Y)) return '#' + t.a + ' x #' + t.b + ': ' + kinWhy(X, Y) + ' (no inbreeding)';
      var locks = function (q) { var A = P(q.a), B = P(q.b); return A && B && (A.owner === B.owner || w.breedReqs.some(function (r) { return r.a === q.b && r.b === q.a && !r.used && b - r.block <= BREED_WINDOW; })); };
      var pb = pend.filter(function (q) { return q.action === 'breed' && locks(q) && [q.a, q.b].some(function (id) { return id === t.a || id === t.b; }); })[0];
      if (pb) return 'a breed burn with #' + ([pb.a, pb.b].indexOf(t.a) >= 0 ? t.a : t.b) + ' is still waiting to confirm';
      if (Y.owner !== X.owner) { var mir = w.breedReqs.filter(function (q) { return q.a === t.b && q.b === t.a && !q.used; }), live = mir.filter(function (q) { return b - q.block <= BREED_WINDOW; })[0];
        if (live) { var left = live.block + BREED_WINDOW - b; if (left < SEND_MARGIN) return 'the request window closes at block ' + (live.block + BREED_WINDOW) + ': an accept sent now may confirm too late and only become a new request'; return null; }
        if (plan && plan.accept) return mir.length ? 'that request expired at block ' + (mir[mir.length - 1].block + BREED_WINDOW) + ' (this burn would only send a new request)' : 'no open request to accept';
        var dup = w.breedReqs.filter(function (q) { return q.a === t.a && q.b === t.b && !q.used && b - q.block <= BREED_WINDOW; })[0]; if (dup) return 'you already asked #' + t.b + ' (until block ' + (dup.block + BREED_WINDOW) + ')';
        if (pend.some(function (q) { return q.action === 'breed' && q.a === t.a && q.b === t.b; })) return 'you already asked #' + t.b + ' (waiting to confirm)'; }
      return null; }
    if (t.action === 'sd' || t.action === 'tt' || t.action === 'join' || (t.action === 'accept' && w.fights && w.fights[t.fightId - 1] && w.fights[t.fightId - 1].mode)) return modeSendBlock(w, t, b, me, amt, pend);
    if (t.action === 'accept') { var F = w.fights && w.fights[t.fightId - 1]; if (!F) return 'no such fight'; if (amt != null && below(w, amt, COSTS.accept, b)) return 'below accept cost ' + costAt(w, COSTS.accept, b); if (F.status !== 'open') return 'fight is ' + F.status;
      if (b - F.block > FIGHT_WINDOW) return 'challenge expired at block ' + (F.block + FIGHT_WINDOW); if (me && P(F.b) && P(F.b).owner !== me) return 'only the challenged pet\'s owner can accept';
      var fe = fightable(P(F.a), b), fe2 = fightable(P(F.b), b); if (fe) return 'challenger #' + F.a + ': ' + fe; if (fe2) return '#' + F.b + ': ' + fe2;
      if (F.block + FIGHT_WINDOW - b < SEND_MARGIN - 1) return 'the challenge closes at block ' + (F.block + FIGHT_WINDOW) + ': an accept sent now may confirm too late';
      if (pend.some(function (q) { return q.action === 'accept' && q.fightId === t.fightId; })) return 'your accept is still waiting to confirm';
      return battleBlock(w, tag, tip); }
    if (t.action === 'fight') { var A = P(t.a), B = P(t.b); if (amt != null && below(w, amt, COSTS.fight, b)) return 'below fight cost ' + costAt(w, COSTS.fight, b); if (!A || (me && A.owner !== me)) return 'challenger must be your pet'; if (t.a === t.b) return 'cannot fight itself';
      var f1 = fightable(A, b); if (f1) return '#' + t.a + ': ' + f1; var f2 = fightable(B, b); if (f2) return 'opponent #' + t.b + ': ' + f2;
      if (w.fights.some(function (f) { return f.status === 'open' && (f.a === t.a || f.b === t.a) && b - f.block <= FIGHT_WINDOW; }) || pend.some(function (q) { return q.action === 'fight' && (q.a === t.a || q.b === t.a); })) return '#' + t.a + ' already has an open challenge';
      return battleBlock(w, tag, tip); }
    if (t.action === 'wagmi') { if (!wagmiOn(b)) return 'WAGMI check-ins open at block ' + ACTIVATE_WAGMI_BLOCK; if (me && streakOf(w, me, tip).today) return 'you already said WAGMI today (once per chain day)';
      if (pend.some(function (q) { return q.action === 'wagmi'; })) return 'your WAGMI is still waiting to confirm'; return null; }
    if (t.action === 'spin' || (t.action === 'roll' && wheelOn(b))) { if (!wheelOn(b)) return 'Pepe Wheel spins open at block ' + ACTIVATE_WHEEL_RANDOM_BLOCK; if (amt != null && below(w, amt, COSTS.roll, b)) return 'below roll cost ' + costAt(w, COSTS.roll, b);
      if (me && !wheelPool(w, me, null, false).length) return 'you have no living pet'; return null; }
    if (t.action === 'roll' || t.action === 'froll' || t.action === 'oroll') { var g = P(t.petId); if (!g) return 'no such pet #' + t.petId; if (g.released) return '#' + g.id + ' was released'; if (me && g.owner !== me) return '#' + g.id + ' is not yours'; if (g.dead) return '#' + g.id + ' is dead';
      if (t.action === 'roll' && amt != null && below(w, amt, COSTS.roll, b)) return 'below roll cost ' + costAt(w, COSTS.roll, b); if (t.action === 'oroll' && g.community) return 'community pet'; return null; }
    return null; }
  /** modeSendBlock: send guard for arena-mode burns (display/send only, NOT used by replay). Mirrors modeBurn at block b. */
  function modeSendBlock(w, t, b, me, amt, pend) { if (!modesOn(b)) return 'Sudden Death and Tag Team are coming soon';
    var P = function (id) { return w.byId[id]; }, D = day(b);
    function chk(id, F) { var p = P(id), y = fightable(p, b); if (y) return '#' + id + ': ' + y; if (p.community) return '#' + id + ': community pets cannot fight'; if (p.fightDays[D] && !(F && F.marks && F.marks[id] === D)) return '#' + id + ' already fought today'; if (inOpenFight(w, id, b, F)) return '#' + id + ' already has an open challenge'; return null; }
    if (t.action === 'sd' || t.action === 'tt') { var As = t.action === 'sd' ? [t.a] : t.a, ids = As.concat(t.action === 'sd' ? [t.b] : t.b), need = t.action === 'sd' ? COSTS.sd : modeTeamCost(w, As);
      if (amt != null && below(w, amt, need, b)) return 'below cost ' + costAt(w, need, b); if (!P(As[0]) || (me && P(As[0]).owner !== me)) return 'your lead pet must be yours';
      if (ids.some(function (x, i) { return ids.indexOf(x) !== i; })) return 'each pet can only be in the fight once';
      for (var i = 0; i < ids.length; i++) { var c = chk(ids[i]); if (c) return c; }
      if (pend.some(function (q) { return (q.action === 'sd' || q.action === 'tt' || q.action === 'fight') && [].concat(q.a).some(function (z) { return ids.indexOf(z) >= 0; }); })) return 'a challenge with one of these pets is still waiting to confirm'; return null; }
    var F = w.fights[t.fightId - 1]; if (!F || !F.mode) return 'no such fight'; if (F.status !== 'open') return 'fight is ' + F.status; if (b - F.block > FIGHT_WINDOW) return 'challenge expired at block ' + (F.block + FIGHT_WINDOW);
    if (F.block + FIGHT_WINDOW - b < SEND_MARGIN - 1) return 'the challenge closes at block ' + (F.block + FIGHT_WINDOW) + ': a burn sent now may confirm too late';
    if (t.action === 'join') { if (F.needJoin.indexOf(t.petId) < 0) return '#' + t.petId + ' is not a partner in fight ' + F.id; if (F.joins[t.petId]) return 'already joined'; if (me && P(t.petId).owner !== me) return 'only the partner pet\'s owner can join'; if (amt != null && below(w, amt, COSTS.join, b)) return 'below join cost ' + costAt(w, COSTS.join, b); return chk(t.petId, F); }
    if (F.accepted) return 'already accepted'; if (me && P(F.b) && P(F.b).owner !== me) return 'only the challenged pet\'s owner can accept';
    var cost = acceptCost(w, F.id); if (amt != null && below(w, amt, cost, b)) return 'below accept cost ' + costAt(w, cost, b);
    var all = fightPets(F); for (var j = 0; j < all.length; j++) { var y = fightable(P(all[j]), b); if (y) return '#' + all[j] + ': ' + y; }
    if (pend.some(function (q) { return q.action === 'accept' && q.fightId === t.fightId; })) return 'your accept is still waiting to confirm'; return null; }
  /** acceptCost(w, fightId): burn for pet:accept:N (Classic/Sudden Death 690; Tag Team 1,380, or 690 when the accepting team has two owners). */
  function acceptCost(w, id) { var F = w && w.fights && w.fights[id - 1]; return F && F.mode === 'tt' ? modeTeamCost(w, [F.b, F.b2]) : COSTS.accept; }
  /** acceptBlock(w, req, tip): reason the owner of req.b can't accept request req (A asked B) right now, else null. Requester's pet checked first (the engine's 'partner' check). */
  function acceptBlock(w, r, tip) { var b = (tip || w.tip || 0) + 1; return breedWhy(r.a, breedable(w.byId[r.a], b)) || breedWhy(r.b, breedable(w.byId[r.b], b)) || (breedV2On(b) && kinWhy(w.byId[r.a], w.byId[r.b]) ? kinWhy(w.byId[r.a], w.byId[r.b]) + ' (no inbreeding)' : null); }
  /** acceptRejected(w, rows, req): replay-log reason for the newest confirmed accept (pet:breed:B:A) of req that the engine rejected, else null. */
  function tagText(h) { h = String(h || ''); if (!/^[0-9a-f]+$/i.test(h) || h.length % 2) return h; var o = ''; for (var i = 0; i < h.length; i += 2) o += String.fromCharCode(parseInt(h.substr(i, 2), 16)); try { return decodeURIComponent(escape(o)); } catch (e) { return o; } }
  function acceptRejected(w, rows, r) { var want = 'pet:breed:' + r.b + ':' + r.a, tx = {}; (rows || []).forEach(function (x) { if (x.block_index >= r.block && tagText(x.tag) === want) tx[x.tx_hash] = 1; });
    var hit = null; (w.log || []).forEach(function (l) { if (l.kind === 'rejected' && tx[l.tx]) hit = l; }); return hit ? { tx: hit.tx, block: hit.block, msg: hit.msg.replace(/^partner: (.*)$/, function (m, y) { return breedWhy(r.a, y); }) } : null; }

  /* ---------------------------------------------------------------- arena modes (gated; see ACTIVATE_ARENA_MODES_BLOCK) */
  function modeTeamCost(w, ids) { var P = ids.map(function (id) { return w.byId[id]; }); return P.length > 1 && P[0] && P[1] && P[0].owner !== P[1].owner ? COSTS.join : COSTS.tt; }
  function modeBurn(w, r, t, amt, bh, L, pet) {
    var b = r.block_index, src = r.source, D = day(b), e = null;
    function dayBusy(p, F) { return p.fightDays[D] && !(F && F.marks && F.marks[p.id] === D); }
    if (t.action === 'sd' || t.action === 'tt') {
      var sd = t.action === 'sd', As = sd ? [t.a] : t.a, Bs = sd ? [t.b] : t.b, ids = As.concat(Bs), P = ids.map(pet), A = P[0];
      var need = sd ? COSTS.sd : modeTeamCost(w, As);
      e = below(w, amt, need, b) ? 'below ' + (sd ? 'Sudden Death' : 'Tag Team') + ' cost ' + costAt(w, need, b) : !A || A.owner !== src ? 'challenger must be your pet' : ids.some(function (x, i) { return ids.indexOf(x) !== i; }) ? 'each pet can only be in the fight once' : null;
      for (var i = 0; !e && i < P.length; i++) { var why = fightable(P[i], b); if (why) e = '#' + ids[i] + ': ' + why; else if (P[i].community) e = '#' + ids[i] + ': community pets cannot fight'; else if (dayBusy(P[i])) e = '#' + ids[i] + ' already fought this day'; else if (inOpenFight(w, ids[i], b)) e = '#' + ids[i] + ' already has an open challenge'; }
      if (e) return L(r, 'rejected', e);
      var f = { id: w.fights.length + 1, mode: t.action, a: As[0], b: Bs[0], block: b, tx: r.tx_hash, status: 'open', expires: b + FIGHT_WINDOW, challenger: src, marks: {}, joins: {}, needJoin: [] };
      if (!sd) { f.a2 = As[1]; f.b2 = Bs[1]; if (P[1].owner !== src) f.needJoin.push(As[1]); if (P[3].owner !== P[2].owner) f.needJoin.push(Bs[1]); }
      As.forEach(function (id) { var p = w.byId[id]; if (p.owner === src) { p.fightDays[D] = 1; f.marks[id] = D; } });
      w.fights.push(f); return L(r, 'fight', '#' + ids.join(', #') + ': ' + (sd ? 'Sudden Death' : 'Tag Team') + ' challenge (fight ' + f.id + ', accept by block ' + f.expires + ')', { fightId: f.id, mode: t.action });
    }
    var F = w.fights[t.fightId - 1];
    e = !F || !F.mode ? 'no such fight' : F.status !== 'open' ? 'fight is ' + F.status : b - F.block > FIGHT_WINDOW ? 'challenge expired' : null;
    if (e) { if (F && F.mode && e === 'challenge expired') F.status = 'expired'; return L(r, 'rejected', e); }
    if (t.action === 'join') {
      var J = pet(t.petId); e = F.mode !== 'tt' ? 'only Tag Team fights take partners' : F.needJoin.indexOf(t.petId) < 0 ? '#' + t.petId + ' is not a partner in fight ' + F.id : F.joins[t.petId] ? '#' + t.petId + ' already joined' : !J || J.owner !== src ? 'only the partner pet\'s owner can join' : below(w, amt, COSTS.join, b) ? 'below join cost ' + costAt(w, COSTS.join, b) : fightable(J, b) || (dayBusy(J, F) ? 'pet already fought this day' : null) || (inOpenFight(w, t.petId, b, F) ? 'pet already has an open challenge' : null);
      if (e) return L(r, 'rejected', e);
      F.joins[t.petId] = { block: b, tx: r.tx_hash }; J.fightDays[D] = 1; F.marks[t.petId] = D;
      if (!F.accepted || F.needJoin.some(function (id) { return !F.joins[id]; })) return L(r, 'fight', '#' + t.petId + ' joined Tag Team fight ' + F.id, { fightId: F.id, mode: 'tt' });
    } else {
      var Bp = pet(F.b), Bs2 = F.mode === 'tt' ? [F.b, F.b2] : [F.b], cost = F.mode === 'tt' ? modeTeamCost(w, Bs2) : COSTS.accept;
      e = F.accepted ? 'already accepted' : !Bp || Bp.owner !== src ? 'only the challenged pet\'s owner can accept' : below(w, amt, cost, b) ? 'below accept cost ' + costAt(w, cost, b) : null;
      if (e) return L(r, 'rejected', e);
      Bs2.forEach(function (id) { var p = pet(id); if (p && p.owner === src && !dayBusy(p, F)) { p.fightDays[D] = 1; F.marks[id] = D; } });
      F.accepted = { block: b, tx: r.tx_hash };
      if (F.needJoin.some(function (id) { return !F.joins[id]; })) return L(r, 'fight', 'fight ' + F.id + ' accepted: waiting for the Tag Team partner', { fightId: F.id, mode: F.mode });
    }
    /* resolve on this burn (the last of accept + joins) */
    var all = fightPets(F), Ps = all.map(pet);
    for (var j = 0; !e && j < Ps.length; j++) { var y = fightable(Ps[j], b); if (y) e = '#' + all[j] + ': ' + y; else if (dayBusy(Ps[j], F)) e = '#' + all[j] + ' already fought this day'; }
    if (!e && !bh) e = 'block hash pending';
    if (e) { if (t.action === 'accept') F.accepted = null; return L(r, 'rejected', e); }
    all.forEach(function (id) { w.byId[id].fightDays[D] = 1; });
    var seedStr = bh + ':' + r.tx_hash, snaps = {}; all.forEach(function (id) { snaps[id] = snapshot(w.byId[id], w); });
    Object.assign(F, { status: 'done', acceptBlock: b, acceptTx: r.tx_hash, seed: seedStr });
    if (F.mode === 'sd') {
      var res = simulateSudden(seedStr, snaps[F.a], snaps[F.b]), win = w.byId[res.winner === 'a' ? F.a : F.b], los = w.byId[res.winner === 'a' ? F.b : F.a];
      var p1 = giveRandomPiece(w, los, win, sha(seedStr + ':spoils'), 'fight ' + F.id), p2 = giveRandomPiece(w, los, win, sha(seedStr + ':spoils2'), 'fight ' + F.id), got = [p1, p2].filter(Boolean);
      los.blackEyeUntil = b + BLACK_EYE_BLOCKS; win.wins = (win.wins || 0) + 1; los.losses = (los.losses || 0) + 1; earnFight(w, win, los, b);
      Object.assign(F, { snapA: snaps[F.a], snapB: snaps[F.b], winner: win.id, loser: los.id, winners: [win.id], losers: [los.id], turns: res.turns, maxA: res.maxA, maxB: res.maxB, coin: res.coin,
        spoils: got[0] ? { gid: got[0].gid, label: got[0].label } : null, spoilsList: got.map(function (g) { return { gid: g.gid, label: g.label, from: los.id, to: win.id }; }) });
      return L(r, 'fightDone', 'Sudden Death fight ' + F.id + ': #' + win.id + ' beat #' + los.id + (got.length ? ' and took ' + got.map(function (g) { return g.label; }).join(' + ') : ' (no takeable gear)'), { fightId: F.id, mode: 'sd' });
    }
    var tr = simulateTag(seedStr, [snaps[F.a], snaps[F.a2]], [snaps[F.b], snaps[F.b2]]), wA = tr.winner === 'a', last = tr.bouts[tr.bouts.length - 1], spoilsList = [];
    tr.out.forEach(function (o, i) { var ko = w.byId[o.id], by = w.byId[o.by]; ko.blackEyeUntil = b + BLACK_EYE_BLOCKS;
      var g = giveRandomPiece(w, ko, by, sha(seedStr + ':spoils:' + o.id), 'fight ' + F.id); if (g) spoilsList.push({ gid: g.gid, label: g.label, from: ko.id, to: by.id }); });
    var winners = wA ? [F.a, F.a2] : [F.b, F.b2], losers = wA ? [F.b, F.b2] : [F.a, F.a2];
    winners.forEach(function (id) { var p = w.byId[id]; p.wins = (p.wins || 0) + 1; }); losers.forEach(function (id) { var p = w.byId[id]; p.losses = (p.losses || 0) + 1; }); winners.forEach(function (id, i) { earnFight(w, w.byId[id], w.byId[losers[i]], b); });
    Object.assign(F, { bouts: tr.bouts, out: tr.out, winners: winners, losers: losers, winner: last.winner, loser: last.loser, showA: last.a, showB: last.b, snapA: snaps[last.a], snapB: snaps[last.b],
      turns: last.turns, maxA: last.maxA, maxB: last.maxB, spoils: spoilsList[0] ? { gid: spoilsList[0].gid, label: spoilsList[0].label } : null, spoilsList: spoilsList });
    return L(r, 'fightDone', 'Tag Team fight ' + F.id + ': #' + winners.join(' & #') + ' beat #' + losers.join(' & #') + (spoilsList.length ? ', took ' + spoilsList.map(function (g) { return g.label; }).join(' + ') : ''), { fightId: F.id, mode: 'tt' });
  }
  /* ===== MYTHIC QUESTS (owner "lets roll out", Oct 24 2026; rules = Page "XCPETS Mythic Quests: draft rules"; LIVE from ACTIVATE_QUEST_BLOCK = 972,952) =====
   * Below the gate (or if it were set back to null) every pet:quest / pet:aura burn is an unknown tag (invalid -> community food)
   * exactly as before, and nothing else moves. From the gate:
   *  - pet:quest:ID:Q (Q = spam | cold | kek | wiz | mine): a living Mythic held by the burner, not questing, not on Nap Time, not in an open sale or swap,
   *    burn >= costAt(base) (halvings + Fire Sale like every burn). First quest of a Mythic alive at the gate is free ("First Quest's on Nakamoto": any burn).
   *  - the quest ends len blocks later; Homecoming rolls sha256(return block hash + quest tx + pet id + 'quest'); the result goes to whoever holds the pet then.
   *  - Legendary Haul / Solid Loot / Came Home Empty in basis points; favoured stats above the Mythic average add 0.25 pt each (cap +8), matching-slot
   *    gear +1 (★ +2, cap +4), all taken from Empty. Haul: double reward, double finish progress, +1 favoured stat (cap +3 per pet).
   *  - FUNTRUMP Ambush 1 in 69 (own hex window): bonus Jackpot Egg + FUNTRUMP badge; none while a FUNTRUMP pet is away; FUNTRUMP's own quests: badge always, egg 2 in 69. Nakamoto badge once all five quests were finished.
   *  - Nap Time = half the quest length after Homecoming. While away: no battle, breed, feed, gift, sale, swap, listing (Finders Keepers on token moves).
   *  - One move per pet per block: only the first quest / aura / fight / breed action of a pet in a block counts.
   *  - Proof of Burn: every pet existing at the gate; tier from the owner wallet's total burns (live); lost for good when the pet changes hands.
   *  - Flame looks (Kindling 10k / Wildfire 250k / Satoshi Sun 1M wallet burns, all burns count), placed with pet:aura:ID:on (off hides). Layers DRAW in a
   *    second gate (not built here): the looks are state + chips only. */
  var ACTIVATE_QUEST_BLOCK = 972952; /* tip 972946 (api.xcp.fun, Oct 24 2026 11:16 AM CT) + 6; owner approved 11:15 AM CT */
  function questOn(b) { return ACTIVATE_QUEST_BLOCK != null && b != null && b >= ACTIVATE_QUEST_BLOCK; }
  var QUEST_FREE_MIN = 0.00000001;
  var QUESTS = {
    spam: { code: 'spam', name: 'Spam City Run', len: 144, base: 690, odds: [2000, 6000, 2000], fav: ['zoom', 'luck'], slot: 'feet', reward: 'everyday gear', badge: 'Spam City badge',
      look: { id: 'neon-trail', name: 'Neon Trail', type: 'aura', need: 10, by: 'finish' } },
    cold: { code: 'cold', name: 'Cold Storage Vault', len: 288, base: 1380, odds: [1500, 5500, 3000], fav: ['grit', 'vigor'], slot: 'body', reward: 'Jackpot Egg', badge: 'Vault badge',
      look: { id: 'aurora', name: 'Aurora backdrop', type: 'back', need: 8, by: 'finish' } },
    kek: { code: 'kek', name: "Lord Kek's Swamp", len: 432, base: 2070, odds: [1200, 5000, 3800], fav: ['spark', 'luck'], slot: 'face', reward: 'rare gear', badge: 'Kek badge',
      look: { id: 'black-holo', name: 'Black holo', type: 'foil', need: 5, by: 'haul' } },
    wiz: { code: 'wiz', name: "The Wizard's Tower", len: 720, base: 3450, odds: [1000, 4500, 4500], fav: ['spark', 'zoom'], slot: 'head', reward: 'saved spins', badge: 'Wizard badge',
      look: { id: 'spell-sparkles', name: 'Spell Sparkles', type: 'aura', need: 3, by: 'haul' } },
    mine: { code: 'mine', name: 'Burning Mines', len: 1008, base: 6900, odds: [300, 2700, 7000], fav: ['grit', 'vigor'], slot: 'hand', reward: 'gold-themed rare gear', badge: 'Mines badge',
      look: { id: 'gold-holo', name: 'Gold holo', type: 'foil', need: 3, by: 'haul' } } };
  var QUEST_CODES = ['spam', 'cold', 'kek', 'wiz', 'mine'];
  var QUEST_TIERS = { haul: 'Legendary Haul', loot: 'Solid Loot', empty: 'Came Home Empty' };
  var QUEST_STAT_CAP = 3, QUEST_STAT_PT = 25 /* 0.25 pt in basis points */, QUEST_STAT_MAX = 800, QUEST_GEAR_MAX = 400, AMBUSH_1_IN = 69;
  var JACKPOT = { twin1In: 5, mutation1In: 5, hidden1In: 3, legMix1In: 2 };
  var FLAME_TIERS = [{ id: 'kindling', name: 'Kindling', min: 10000, looks: [{ id: 'laurels', name: 'Laurels', type: 'top' }, { id: 'flame-aura', name: 'Flame aura', type: 'aura' }] },
    { id: 'wildfire', name: 'Wildfire', min: 250000, looks: [{ id: 'halo', name: 'Halo', type: 'top' }, { id: 'rainbow-holo', name: 'Rainbow holo', type: 'foil' }, { id: 'lightning-aura', name: 'Lightning aura', type: 'aura' }] },
    { id: 'satoshi-sun', name: 'Satoshi Sun', min: 1000000, looks: [{ id: 'gold-crown', name: 'Gold-foil crown', type: 'top' }, { id: 'holo-wings', name: 'Holo wings', type: 'back' }, { id: 'galaxy-skin', name: 'Galaxy skin', type: 'galaxy' }] }];
  var POB_TIERS = [{ id: 'gold', name: 'Gold Ash', min: 1000000 }, { id: 'silver', name: 'Silver Ash', min: 100000 }, { id: 'bronze', name: 'Bronze Ash', min: 0 }];
  function isMythic(p) { return !!(p && (p.stage === 5 || p.mythicCare)); }
  function questCost(w, code, b) { return costAt(w, QUESTS[code].base, b); }
  function questAway(p, b) { return !!(p && p.quest && b < p.quest.end); }
  function questNap(p, b) { return !!(p && !questAway(p, b) && p.napUntil != null && b < p.napUntil); }
  function questBusyWhy(p, b) { if (!questOn(b) || !p) return null; if (questAway(p, b)) return 'away on a quest (' + QUESTS[p.quest.code].name + ', back at block ' + p.quest.end + ')'; return null; }
  function walletBurned(w, a) { return (w.burnedBy && w.burnedBy[a]) || 0; }
  function flameTierOf(w, a) { var t = walletBurned(w, a), r = null; FLAME_TIERS.forEach(function (T) { if (t >= T.min) r = T; }); return r; }
  function flameLooksOf(w, a) { var t = walletBurned(w, a), out = []; FLAME_TIERS.forEach(function (T) { if (t >= T.min) out = out.concat(T.looks); }); return out; }
  function pobOf(w, p) { if (!p || !p.pob) return null; var t = walletBurned(w, p.owner); for (var i = 0; i < POB_TIERS.length; i++) if (t >= POB_TIERS[i].min) return { id: POB_TIERS[i].id, name: POB_TIERS[i].name, burned: t }; return null; }
  /** questLaunch(w, b): once, at the first block >= the gate: Proof of Burn on every pet existing, one free quest for every living Mythic, early burners noted. */
  function questLaunch(w, b) { if (!questOn(b) || w.questLaunch) return; w.questLaunch = { block: b, pets: 0, mythics: 0 }; w.earlyBurner = {};
    Object.keys(w.burnedBy || {}).forEach(function (a) { if (w.burnedBy[a] > 0) w.earlyBurner[a] = 1; });
    w.pets.forEach(function (p) { if (p.community || p.released) return; liveAt(w, p, b); if (p.dead) return; p.pob = true; w.questLaunch.pets++;
      if (isMythic(p)) { p.freeQuest = 1; w.questLaunch.mythics++; } }); }
  function questMythicAvg(w, b) { var C = w._qavg; if (C && C.b === b) return C.v; var s = {}, n = 0;
    w.pets.forEach(function (p) { if (p.community || p.released || p.dead || !isMythic(p)) return; n++; Object.keys(p.stats || {}).forEach(function (k) { s[k] = (s[k] || 0) + p.stats[k]; }); });
    var v = {}; Object.keys(s).forEach(function (k) { v[k] = s[k] / n; }); w._qavg = { b: b, v: v }; return v; }
  /** questOdds(w, p, code, b) -> { haul, loot, empty } in basis points (10000 = 100%), plus the shift and its parts. */
  function questOdds(w, p, code, b) { var Q = QUESTS[code], avg = questMythicAvg(w, b), st = 0, gr = 0;
    Q.fav.forEach(function (k) { var d = ((p.stats || {})[k] || 0) - (avg[k] || 0); if (d > 0) st += d * QUEST_STAT_PT; });
    st = Math.min(QUEST_STAT_MAX, Math.floor(st));
    wornOf(w, p.id).forEach(function (g) { if (g.slot === Q.slot) gr += g.legendary ? 200 : 100; }); gr = Math.min(QUEST_GEAR_MAX, gr);
    var sh = Math.min(st + gr, Q.odds[2]); return { haul: Q.odds[0] + sh, loot: Q.odds[1], empty: Q.odds[2] - sh, shift: sh, statPts: st, gearPts: gr }; }
  /* Former community pets (owner 2026-10-24): community pets are never w.pets entries (they live in w.community / w.kek / w.funtrump trackers);
   * a FUNTRUMP / Lord Kek / Wizard / Nakamoto / Spam City pet a player holds is an ordinary pet with an owner, so it quests like any Mythic with the
   * normal checks (questWhy). FUNTRUMP = a pure species 'funtrump' pet: while one is Gone Questing the Ambush can't trigger on anyone else's quest;
   * his own quests always earn the FUNTRUMP badge and roll the Ambush egg at 2 in 69. */
  function isFuntrumpPet(p) { return !!p && p.species === 'funtrump' && !p.community; }
  function questHex(bh, tx, id) { return sha(bh + tx + id + 'quest'); }
  function questPickGear(w, p, h, Q, b) { var sl = rollSlotOf(p, h, b), body = bodyOf(p), tierIdx = Q.code === 'spam' ? 0 : 3;
    var filt = Q.code === 'kek' ? function (x) { return x.tier >= 2; } : Q.code === 'mine' ? function (x) { return x.tier >= 2 && /gold/i.test((x.label || '') + ' ' + x.id); } : null;
    if (!filt) return { it: pickItem(h, sl, p.species, tierIdx, dedupFor(w, b, p.owner), body), slot: sl };
    var order = [sl].concat(V2_SLOTS.filter(function (s) { return s !== sl; }));
    for (var i = 0; i < order.length; i++) { var P = pool(order[i], p.species, 3, body).filter(function (e) { return filt(e.it); }); if (!P.length) continue;
      var tot = P.reduce(function (a, e) { return a + e.w; }, 0), r = parseInt(h.slice(8, 16), 16) % tot, hit = P[P.length - 1].it;
      for (var j = 0; j < P.length; j++) { if (r < P[j].w) { hit = P[j].it; break; } r -= P[j].w; }
      return { it: hit.alias ? BY_ID[hit.alias] : hit, slot: order[i] }; }
    if (Q.code === 'mine') return questPickGear(w, p, h, QUESTS.kek, b); /* no gold piece fits this pet: a rare piece instead */
    return { it: pickItem(h, sl, p.species, 3, dedupFor(w, b, p.owner), body), slot: sl }; }
  /** jackpotEgg: a free egg for the holder that boosts everything: crossed with a wild Legendary of another species (so it is a hybrid, Legendary
   *  tier through the normal breed math), plus boosted mutation / twins / hidden trait / Legendary three-way look on their own streams. */
  function jackpotEgg(w, P, bh, tx, b, owner, tag) { var hx = sha(bh + tx + ':' + tag), R = stream('XCPETS:v2:jackpot:' + hx);
    var sp = PetCore.SPECIES.map(function (x) { return x.id; }).filter(function (x) { return x !== P.species && x !== 'nakamoto' && x !== 'wizard' && x !== 'kek' && x !== 'funtrump' && (!P.hybrid || P.hybrid.roots.indexOf(x) < 0); });
    var wild = { id: 0, species: sp[R() % sp.length], tier: 3, stats: Object.assign({}, P.stats), parents: [], carried: [] };
    function one(t2) { var k = breedOne(w, P, wild, bh, tx + ':' + t2, b, owner), h2 = sha(bh + tx + ':' + t2), Rx = stream('XCPETS:v2:jackpot-x:' + h2);
      k.parents = [P.id]; k.jackpot = { from: P.id, wild: wild.species, block: b };
      if (Rx() % JACKPOT.mutation1In === 0) { k.mutation = { kind: Rx() % 2 ? 'glitch' : 'palette', hue: 60 + Rx() % 241, seed: Rx() }; if (k.mutation.kind === 'palette') { var PK = Object.keys(PALETTE_SETS); k.mutation.set = PK[Rx() % PK.length]; } }
      if (Rx() % JACKPOT.hidden1In === 0) { k.hidden = HIDDEN_TRAITS[Rx() % HIDDEN_TRAITS.length].id; if (k.hidden === 'oddeyes') k.oddEye = { eye: Rx() % 2, col: Rx() % ODD_EYE_COLOURS.length }; }
      if (k.hybrid && k.hybrid.roots && Rx() % JACKPOT.legMix1In === 0) { var pool2 = PetCore.SPECIES.map(function (x) { return x.id; }).filter(function (x) { return k.hybrid.roots.indexOf(x) < 0; }), third = pool2[Rx() % pool2.length], LL = partsFor(k.hybrid.shape, third);
        k.hybrid.legMix = third; k.hybrid.featSp = third; k.hybrid.parts = (k.hybrid.parts || []).concat(LL.length ? [{ sp: third, part: LL[Rx() % LL.length].id }] : []); }
      return k; }
    var kid = one(tag); if (R() % JACKPOT.twin1In === 0) { var tw = one(tag + ':twin'); tw.twinOf = kid.id; kid.twinOf = tw.id; } return kid; }
  /** questSettle(w, b, hashes, L): every quest whose return block is <= b and whose hash is known comes home (block order, then pet id). */
  function questSettle(w, b, hashes, L) { if (!questOn(b) || !w.questsOut || !w.questsOut.length) return;
    var due = w.questsOut.filter(function (q) { return q.end <= b && hashes[q.end]; }); if (!due.length) return;
    due.sort(function (x, y) { return x.end - y.end || x.petId - y.petId; });
    due.forEach(function (q) { w.questsOut.splice(w.questsOut.indexOf(q), 1); questHome(w, q, hashes[q.end], L); }); }
  function questHome(w, q, bh, L) { var P = w.byId[q.petId], Q = QUESTS[q.code], b = q.end; w._b = b; if (!P) return; liveAt(w, P, b);
    var h = questHex(bh, q.tx, P.id), od = questOdds(w, P, q.code, b), r = parseInt(h.slice(0, 8), 16) % 10000;
    var tier = r < od.haul ? 'haul' : r < od.haul + od.loot ? 'loot' : 'empty', owner = P.owner, got = [], n = tier === 'haul' ? 2 : tier === 'loot' ? 1 : 0;
    var rec = { code: q.code, tx: q.tx, start: q.start, end: b, tier: tier, owner: owner, sender: q.sender, odds: od, rewards: got, free: !!q.free };
    if (n) { if (q.code === 'spam' || q.code === 'kek' || q.code === 'mine') for (var i = 0; i < n; i++) { var pk = questPickGear(w, P, sha(h + ':gear:' + i), Q, b); if (!pk.it) continue;
          var ni = newItem(w, pk.it, owner, 'quest'); ni.rolledOn = P.id; ni.quest = q.code; placeRolled(w, P, ni, b); got.push({ kind: 'gear', gid: ni.gid, label: pk.it.label, slot: pk.slot, star: ni.legendary }); }
      else if (q.code === 'wiz') { earnSpin(w, owner, b, q.tx, 'quest', n * 3); got.push({ kind: 'spins', n: n * 3 }); }
      else if (q.code === 'cold') { if (tier === 'haul') { var e = jackpotEgg(w, P, bh, q.tx, b, owner, 'jackpot'); got.push({ kind: 'egg', petId: e.id, twin: e.twinOf || null }); }
        else { earnSpin(w, owner, b, q.tx, 'quest', 1); got.push({ kind: 'spins', n: 1 }); } } }
    var isFT = isFuntrumpPet(P), ftOut = !isFT && w.pets.some(function (x) { return x !== P && isFuntrumpPet(x) && !x.dead && !x.released && questAway(x, b); });
    if (isFT) { P.questBadges.funtrump = (P.questBadges.funtrump || 0) + 1; rec.ftOwn = true; } /* FUNTRUMP's own quests always earn his badge */
    if (!ftOut && parseInt(h.slice(8, 16), 16) % AMBUSH_1_IN < (isFT ? 2 : 1)) { var ae = jackpotEgg(w, P, bh, q.tx, b, owner, 'ambush'); rec.ambush = true; got.push({ kind: 'egg', petId: ae.id, twin: ae.twinOf || null, ambush: true });
      if (!isFT) P.questBadges.funtrump = (P.questBadges.funtrump || 0) + 1; }
    if (tier === 'haul' && (P.questBoost || 0) < QUEST_STAT_CAP) { var k = Q.fav[parseInt(h.slice(16, 18), 16) % 2]; P.stats[k] = (P.stats[k] || 0) + 1; P.questBoost = (P.questBoost || 0) + 1; rec.boost = k; got.push({ kind: 'stat', stat: k }); }
    P.questBadges[q.code] = (P.questBadges[q.code] || 0) + 1;
    if (!P.questBadges.nakamoto && QUEST_CODES.every(function (c) { return P.questBadges[c]; })) { P.questBadges.nakamoto = 1; rec.nakamoto = true; }
    var lk = Q.look, pr = P.questProgress[lk.id] || 0, add = lk.by === 'haul' ? (tier === 'haul' ? 1 : 0) : 1; /* finish-based looks count every finish, Came Home Empty included */
    P.questProgress[lk.id] = pr + add; if (pr < lk.need && pr + add >= lk.need) { rec.look = lk.id; (P.questLooks = P.questLooks || []).push(lk.id); }
    P.questHist.push(rec); P.quest = null; P.napUntil = b + Q.len / 2; w.questFeed.push({ petId: P.id, rec: rec });
    L({ block_index: b, tx_hash: q.tx }, 'quest', '#' + P.id + ' came home from ' + Q.name + ': ' + QUEST_TIERS[tier] + (got.length ? ' (' + got.map(function (g) { return g.kind === 'gear' ? g.label : g.kind === 'spins' ? g.n + ' saved spin' + (g.n > 1 ? 's' : '') : g.kind === 'egg' ? (g.ambush ? 'FUNTRUMP Ambush! ' : '') + 'Jackpot Egg #' + g.petId : '+1 ' + g.stat; }).join(', ') + ')' : ''), { petId: P.id, quest: rec }); }
  function questInit(p) { if (!p.questBadges) { p.questBadges = {}; p.questProgress = {}; p.questHist = []; } }
  /** questWhy(w, p, src, code, amt, b) -> reason the quest burn is refused (null = it starts). */
  function questWhy(w, p, src, code, amt, b) { var Q = QUESTS[code]; if (!Q) return 'unknown quest (spam, cold, kek, wiz or mine)';
    var e = petFree(w, p, src, b); if (e) return e; if (!isMythic(p)) return 'Mythics only'; if (questAway(p, b)) return 'already on a quest (second quest burn is community food)';
    if (questNap(p, b)) return 'Nap Time until block ' + p.napUntil; if (listedPet(w, p, b)) return 'in an open sale or swap';
    var free = p.freeQuest && !(p.questHist && p.questHist.length); if (!free && below(w, amt, Q.base, b)) return 'below quest cost ' + questCost(w, code, b);
    if (free && amt + 1e-12 < QUEST_FREE_MIN) return 'free quest still needs a burn'; return null; }
  function listedPet(w, p, b) { if (w.listings && saleListing(w, p.id, b)) return true;
    return (w.swaps || []).some(function (X) { return swapOpen(w, X, b) && (X.mine === p.id || X.theirs === p.id); }); }
  /** auraPlace(w, p, on, b): pet:aura:ID:on places every flame look this wallet still has room for (1 pet each, 3 for early burners), one per type,
   *  never a second look of a type the pet already shows; off hides all flame looks on that pet (never lost: the slot is freed). */
  function auraUses(w, a) { var u = {}; w.pets.forEach(function (q) { if (q.owner === a && q.flameLooks && !q.dead && !q.released) q.flameLooks.forEach(function (id) { u[id] = (u[id] || 0) + 1; }); }); return u; }
  function auraPlace(w, p, on, b) { if (!on) { var had = (p.flameLooks || []).slice(); p.flameLooks = []; p.auraOff = true; return { off: had }; }
    var looks = flameLooksOf(w, p.owner); if (!looks.length) return { none: true };
    var cap = w.earlyBurner && w.earlyBurner[p.owner] ? 3 : 1, used = auraUses(w, p.owner), cur = p.flameLooks || [], types = {}, add = [];
    cur.forEach(function (id) { var L2 = flameLook(id); if (L2) types[L2.type] = 1; });
    (p.questLooks || []).forEach(function (id) { QUEST_CODES.forEach(function (c) { if (QUESTS[c].look.id === id) types[QUESTS[c].look.type] = types[QUESTS[c].look.type] || 0; }); });
    looks.slice().reverse().forEach(function (L2) { if (types[L2.type] || cur.indexOf(L2.id) >= 0 || (used[L2.id] || 0) >= cap) return; types[L2.type] = 1; add.push(L2.id); });
    p.flameLooks = cur.concat(add); p.auraOff = false; return { on: add }; }
  function flameLook(id) { for (var i = 0; i < FLAME_TIERS.length; i++) for (var j = 0; j < FLAME_TIERS[i].looks.length; j++) if (FLAME_TIERS[i].looks[j].id === id) return FLAME_TIERS[i].looks[j]; return null; }
  /** shownLooks(w, p): what the pet shows, one per type (flame looks placed first, then its own quest looks), plus the ember glow (kept, extra). */
  function shownLooks(w, p) { if (w.lookCopies) return shownLooksPick(w, p); var types = {}, out = []; (p.flameLooks || []).forEach(function (id) { var L2 = flameLook(id); if (L2 && !types[L2.type]) { types[L2.type] = 1; out.push({ id: id, name: L2.name, type: L2.type, from: 'flame' }); } });
    (p.questLooks || []).forEach(function (id) { QUEST_CODES.forEach(function (c) { var L2 = QUESTS[c].look; if (L2.id === id && !types[L2.type]) { types[L2.type] = 1; out.push({ id: id, name: L2.name, type: L2.type, from: 'quest' }); } }); });
    earnedLooks(p).forEach(function (L3) { if (!types[L3.type]) { types[L3.type] = 1; out.push({ id: L3.id, name: L3.name, type: L3.type, from: 'earn' }); } });
    return out; }
  /* ===== LOOK PICKER (owner Oct 24 2026: "Can we choose which ones on which pet?" + "People should be able to put them where they want.") =====
   * From ACTIVATE_LOOK_PICK_BLOCK the owner picks, per pet, which looks it shows: memo pet:look:ID:CODE:on|off (up to 6 CODE:on|off pairs in one memo),
   * any burn (QUEST_FREE_MIN). Below the gate the tag is unknown (community food) and nothing changes. pet:aura:ID:on|off keeps working exactly as before.
   *  - Wallet flame looks (Kindling / Wildfire / Satoshi Sun) go on any pet you own within the usual limit (1 pet each, 3 for early burners).
   *    At the limit: with a limit of 1 the look MOVES from the other pet; with 3 it is refused (take it off one pet first).
   *  - Quest looks and earned looks become looks the WALLET holds (one copy each, from the gate or when earned later): the holder is the wallet that
   *    owned the earning pet at that moment. A copy sits on one pet (starts on the pet that earned it), can be put on any pet the holder owns
   *    (putting it on another pet moves it) or taken off. If a pet changes hands, copies the seller holds come off it and stay with the seller
   *    (off until placed again); the buyer gets nothing new. Copies are never lost.
   *  - One look of each kind per pet: putting a look on turns off any other look of the same kind on that pet (it stays owned). */
  var ACTIVATE_LOOK_PICK_BLOCK = 973007; /* tip 973001 (mempool.space, Oct 24 2026 8:55 PM CT) + 6; re-set at deploy */
  function lookPickOn(b) { return ACTIVATE_LOOK_PICK_BLOCK != null && b != null && b >= ACTIVATE_LOOK_PICK_BLOCK; }
  var LOOK_CODES = { KL: ['flame', 'laurels'], KA: ['flame', 'flame-aura'], WH: ['flame', 'halo'], WR: ['flame', 'rainbow-holo'], WL: ['flame', 'lightning-aura'],
    SC: ['flame', 'gold-crown'], SW: ['flame', 'holo-wings'], SG: ['flame', 'galaxy-skin'],
    QN: ['quest', 'neon-trail'], QA: ['quest', 'aurora'], QB: ['quest', 'black-holo'], QS: ['quest', 'spell-sparkles'], QG: ['quest', 'gold-holo'],
    EL: ['earn', 'laurels'], EH: ['earn', 'halo'], EF: ['earn', 'holo-foil'], EC: ['earn', 'crown'], EW: ['earn', 'wings'], EA: ['earn', 'flame-aura'] };
  var LOOK_MAX_PAIRS = 6;
  function questLookDef(id) { for (var i = 0; i < QUEST_CODES.length; i++) if (QUESTS[QUEST_CODES[i]].look.id === id) return QUESTS[QUEST_CODES[i]].look; return null; }
  function lookDef(kind, id) { var L2 = kind === 'flame' ? flameLook(id) : kind === 'quest' ? questLookDef(id) : EARN_LOOKS[id]; return L2 ? { id: L2.id, name: L2.name, type: L2.type } : null; }
  function lookCode(kind, id) { for (var k in LOOK_CODES) if (LOOK_CODES[k][0] === kind && LOOK_CODES[k][1] === id) return k; return null; }
  function lookSrcIds(p) { return { quest: (p.questLooks || []).slice(), earn: ((p.earn && p.earn.looks) || []).slice() }; }
  /** lookSweep(w, b): from the gate, every quest / earned look not yet a wallet copy becomes one (holder = pet owner now, sitting on that pet). */
  function lookSweep(w, b) { if (!lookPickOn(b)) return; var C = w.lookCopies || (w.lookCopies = {}), LO = w.lookOwners || (w.lookOwners = {});
    /* pet changed hands since the last sweep: wallet flame looks come off it (the seller keeps its flame tier and can place them again) */
    w.pets.forEach(function (p) { var o = LO[p.id]; if (o && o !== p.owner && p.flameLooks && p.flameLooks.length) p.flameLooks = []; LO[p.id] = p.owner; });
    w.pets.forEach(function (p) { if (p.community || p.released) return; var S = lookSrcIds(p);
      ['quest', 'earn'].forEach(function (k) { S[k].forEach(function (id) { var key = k + ':' + id + ':' + p.id; if (!C[key]) C[key] = { key: key, kind: k, id: id, src: p.id, holder: p.owner, at: p.id, since: b }; }); }); }); }
  function copyList(w) { var C = w.lookCopies; if (!C) { C = {}; w.pets.forEach(function (p) { if (p.community || p.released) return; var S = lookSrcIds(p); /* before the gate (display only): each look sits on its own pet */
      ['quest', 'earn'].forEach(function (k) { S[k].forEach(function (id) { var key = k + ':' + id + ':' + p.id; C[key] = { key: key, kind: k, id: id, src: p.id, holder: p.owner, at: p.id }; }); }); }); } return Object.keys(C).sort(function (a, z) { var A = C[a], Z = C[z]; return A.kind !== Z.kind ? (A.kind === 'quest' ? -1 : 1) : A.src !== Z.src ? A.src - Z.src : A.id < Z.id ? -1 : 1; }).map(function (k) { return C[k]; }); }
  function copyOnPet(w, c) { var q = c.at ? w.byId[c.at] : null; return !!(q && q.owner === c.holder && !q.dead && !q.released); }
  /** shownLooksPick(w, p): picker-era shownLooks: flame looks first, then wallet copies placed on this pet (holder still owns it), one per kind. */
  function shownLooksPick(w, p) { var types = {}, out = [];
    (p.flameLooks || []).forEach(function (id) { var L2 = flameLook(id); if (L2 && !types[L2.type]) { types[L2.type] = 1; out.push({ id: id, name: L2.name, type: L2.type, from: 'flame' }); } });
    copyList(w).forEach(function (c) { if (c.at !== p.id || c.holder !== p.owner) return; var L2 = lookDef(c.kind, c.id); if (L2 && !types[L2.type]) { types[L2.type] = 1; out.push({ id: c.id, name: L2.name, type: L2.type, from: c.kind, src: c.src }); } });
    return out; }
  /** ownedLooks(w, a): everything wallet a can place: flame looks of its tier (with the pets they are on) + its quest / earned copies. Display + picker. */
  function ownedLooks(w, a) { var out = [], cap = w.earlyBurner && w.earlyBurner[a] ? 3 : 1;
    flameLooksOf(w, a).forEach(function (L2) { var on = w.pets.filter(function (q) { return q.owner === a && !q.dead && !q.released && (q.flameLooks || []).indexOf(L2.id) >= 0; }).map(function (q) { return q.id; });
      out.push({ code: lookCode('flame', L2.id), kind: 'flame', id: L2.id, name: L2.name, type: L2.type, on: on, cap: cap }); });
    copyList(w).forEach(function (c) { if (c.holder !== a) return; var L2 = lookDef(c.kind, c.id); if (!L2) return;
      out.push({ code: lookCode(c.kind, c.id), kind: c.kind, id: c.id, name: L2.name, type: L2.type, src: c.src, on: copyOnPet(w, c) ? [c.at] : [], cap: 1 }); });
    return out; }
  function clearType(w, P, type, keepKind, keepId) { var off = [];
    P.flameLooks = (P.flameLooks || []).filter(function (id) { var L2 = flameLook(id); if (L2 && L2.type === type && !(keepKind === 'flame' && keepId === id)) { off.push(L2.name); return false; } return true; });
    copyList(w).forEach(function (c) { if (c.at === P.id && c.holder === P.owner && !(c.kind === keepKind && c.id === keepId)) { var L2 = lookDef(c.kind, c.id); if (L2 && L2.type === type) { c.at = 0; off.push(L2.name); } } });
    return off; }
  /** lookPick(w, P, ops, b) -> { done: [text], refused: [text] }. P already checked (owner, alive). Deterministic: ops in memo order. */
  function lookPick(w, P, ops, b) { var a = P.owner, done = [], refused = [];
    ops.forEach(function (op) { var K = LOOK_CODES[op.code], kind = K[0], id = K[1], D = lookDef(kind, id), nm = D.name + (kind === 'earn' ? ' (earned)' : kind === 'quest' ? ' (quest)' : '');
      if (kind === 'flame') {
        var has = flameLooksOf(w, a).some(function (L2) { return L2.id === id; });
        if (!op.on) { var i0 = (P.flameLooks || []).indexOf(id); if (i0 < 0) { refused.push(nm + ' is not on #' + P.id); return; } P.flameLooks.splice(i0, 1); done.push(nm + ' off'); return; }
        if (!has) { refused.push(nm + ': this wallet has not burned enough for it yet'); return; }
        if ((P.flameLooks || []).indexOf(id) >= 0) { refused.push(nm + ' is already on #' + P.id); return; }
        var cap = w.earlyBurner && w.earlyBurner[a] ? 3 : 1, onP = w.pets.filter(function (q) { return q !== P && q.owner === a && !q.dead && !q.released && (q.flameLooks || []).indexOf(id) >= 0; }), moved = '';
        if (onP.length >= cap) { if (cap > 1) { refused.push(nm + ' is already on ' + cap + ' pets (#' + onP.map(function (q) { return q.id; }).join(', #') + '); take it off one first'); return; }
          onP[0].flameLooks.splice(onP[0].flameLooks.indexOf(id), 1); moved = ' (moved from #' + onP[0].id + ')'; }
        var off = clearType(w, P, D.type, kind, id); P.flameLooks = (P.flameLooks || []).concat([id]); done.push(nm + ' on' + moved + (off.length ? ', ' + off.join(', ') + ' off' : '')); return; }
      var mine = copyList(w).filter(function (c) { return c.holder === a && c.kind === kind && c.id === id; });
      if (!mine.length) { refused.push(nm + ': this wallet does not hold that look'); return; }
      var here = mine.filter(function (c) { return c.at === P.id && copyOnPet(w, c); });
      if (!op.on) { if (!here.length) { refused.push(nm + ' is not on #' + P.id); return; } here.forEach(function (c) { c.at = 0; }); done.push(nm + ' off'); return; }
      if (here.length) { refused.push(nm + ' is already on #' + P.id); return; }
      var free = mine.filter(function (c) { return !copyOnPet(w, c); }), pick = free[0] || mine[0], from = copyOnPet(w, pick) ? ' (moved from #' + pick.at + ')' : '';
      var off2 = clearType(w, P, D.type, kind, id); pick.at = P.id; done.push(nm + ' on' + from + (off2.length ? ', ' + off2.join(', ') + ' off' : '')); });
    return { done: done, refused: refused }; }
  function lookPlan(id, ops) { var t = 'pet:look:' + id; ops.slice(0, LOOK_MAX_PAIRS).forEach(function (o) { t += ':' + o.code + ':' + (o.on ? 'on' : 'off'); });
    return { tag: t, amount: QUEST_FREE_MIN, label: 'Looks #' + id + ' (' + ops.length + ' change' + (ops.length === 1 ? '' : 's') + ')' }; }
  function lookPlans(id, ops) { var out = []; for (var i = 0; i < ops.length; i += LOOK_MAX_PAIRS) out.push(lookPlan(id, ops.slice(i, i + LOOK_MAX_PAIRS))); return out; }
  /* PET-LEVEL EARNED LOOKS (owner plan Oct 24 2026; preview branch earn-rules). Gated: nothing below the gate is touched, so every older burn
   * replays exactly as before. From the gate a pet earns looks from what it does (replayed from chain only, no randomness):
   *  - Laurels (top): 10 duel wins while Mythic (from the gate), OR a win streak of 5 duels in a row (any stage, a loss resets it).
   *  - Halo (top): 10 finished Mythic quests (any result; quests finished before the gate count).
   *  - Holo foil (foil): the pet is tied to a pet token (Proof of Pet); pets already tied at the gate get it at the gate.
   *  - Crown (top): #1 on the Power board (Vigor+Spark+Grit+Zoom+Luck, living player pets, ties lowest id) at 7 day checks in a row (7 times 144 = 1,008 blocks).
   *  - Wings (back): a Mythic kept alive for 4,032 blocks (about 4 weeks) counted from the gate or from reaching Mythic, whichever is later.
   *  - Flame aura (aura): 69,000 XCPETS burned on that pet's own actions from the gate (milestones 6,900 / 69,000 / 690,000 are recorded; the look comes at 69,000).
   *  (No Gold holo / 1-of-1 award here: owner Oct 24 2026 7:30 PM CT, raids designed separately later.)
   * Earned looks stay with the pet for good (also when it changes hands). Wallet flame tiers (FLAME_TIERS) and quest looks are unchanged and kept. */
  var ACTIVATE_EARN_BLOCK = 973002; /* tip 972996 (mempool.space, re-checked Oct 24 2026 7:41 PM CT) + 6 */
  function earnOn(b) { return ACTIVATE_EARN_BLOCK != null && b != null && b >= ACTIVATE_EARN_BLOCK; }
  var EARN = { laurelsMythicWins: 10, laurelsStreak: 5, haloQuests: 10, crownDays: 7, wingsBlocks: 4032, flameBurn: 69000, flameMilestones: [6900, 69000, 690000] };
  var EARN_LOOKS = { laurels: { id: 'laurels', name: 'Laurels', type: 'top' }, halo: { id: 'halo', name: 'Halo', type: 'top' }, 'holo-foil': { id: 'holo-foil', name: 'Holo foil', type: 'foil' },
    crown: { id: 'crown', name: 'Crown', type: 'top' }, wings: { id: 'wings', name: 'Wings', type: 'back' }, 'flame-aura': { id: 'flame-aura', name: 'Flame aura', type: 'aura' } };
  function earnRec(p) { return p.earn || (p.earn = { looks: [], mythicWins: 0, streak: 0, bestStreak: 0, burned: 0, milestones: [], log: [] }); }
  function earnGive(p, id, b, why) { var E = earnRec(p); if (E.looks.indexOf(id) >= 0) return false; E.looks.push(id); E.log.push({ look: id, block: b, why: why }); return true; }
  function earnLive(p) { return p && !p.dead && !p.released && !p.community; }
  /** earnFight(w, win, los, b): called after a duel resolves (both duel kinds). */
  function earnFight(w, win, los, b) { if (!earnOn(b)) return; [win, los].forEach(function (p) { if (p && !p.community) earnRec(p); });
    if (los && los.earn) los.earn.streak = 0; if (!win || !win.earn) return; var E = win.earn; E.streak++; if (E.streak > E.bestStreak) E.bestStreak = E.streak; if (isMythic(win)) E.mythicWins++;
    if (E.mythicWins >= EARN.laurelsMythicWins) earnGive(win, 'laurels', b, EARN.laurelsMythicWins + ' Mythic duel wins');
    else if (E.streak >= EARN.laurelsStreak) earnGive(win, 'laurels', b, EARN.laurelsStreak + ' duel wins in a row'); }
  /** earnBurn(w, p, amt, b): a valid burn on this pet's own action. */
  function earnBurn(w, p, amt, b) { if (!earnOn(b) || !earnLive(p) || !(amt > 0)) return; var E = earnRec(p); E.burned += amt;
    EARN.flameMilestones.forEach(function (m) { if (E.burned >= m && E.milestones.indexOf(m) < 0) E.milestones.push(m); });
    if (E.burned >= EARN.flameBurn) earnGive(p, 'flame-aura', b, EARN.flameBurn.toLocaleString('en-US') + ' XCPETS burned on this pet'); }
  /** earnSweep(w, b): once per event block from the gate: quest/token/Mythic-time checks and the daily Power board check. */
  function earnSweep(w, b) { if (!earnOn(b)) return; var S = w.earnState || (w.earnState = { day: Math.floor(b / 144), top: null, topDays: 0 });
    if (S.lastB === b) return; S.lastB = b;
    w.pets.forEach(function (p) { if (!earnLive(p)) return;
      if (p.questHist && p.questHist.length >= EARN.haloQuests) earnGive(p, 'halo', b, EARN.haloQuests + ' Mythic quests finished');
      if (p.deed) earnGive(p, 'holo-foil', b, 'tied to a pet token (Proof of Pet)');
      if (isMythic(p)) { var E = earnRec(p); if (E.mythicFrom == null) E.mythicFrom = b; if (b - E.mythicFrom >= EARN.wingsBlocks) earnGive(p, 'wings', b, 'Mythic alive ' + EARN.wingsBlocks.toLocaleString('en-US') + ' blocks'); } });
    var d = Math.floor(b / 144); if (d > S.day) { S.day = d; /* one Power board check per new day (state between events does not change) */
      var top = null; w.pets.forEach(function (p) { if (!earnLive(p)) return; if (!top || petPower(p) > petPower(top) || (petPower(p) === petPower(top) && p.id < top.id)) top = p; });
      if (top && S.top === top.id) S.topDays++; else { S.top = top ? top.id : null; S.topDays = top ? 1 : 0; }
      if (top && S.topDays >= EARN.crownDays) earnGive(top, 'crown', b, '#1 on the Power board for ' + EARN.crownDays + ' days'); } }
  function earnedLooks(p) { return ((p && p.earn && p.earn.looks) || []).map(function (id) { return EARN_LOOKS[id]; }).filter(Boolean); }
  /** questInfo(w, p, b): everything the pet page / My Pets need (display only). */
  function questInfo(w, p, b) { if (!p) return null; b = b == null ? w.tip : b; var q = p.quest && b < p.quest.end ? p.quest : null;
    return { on: questOn(b), away: q ? { code: q.code, name: QUESTS[q.code].name, start: q.start, end: q.end, left: q.end - b, free: !!q.free } : null, napUntil: questNap(p, b) ? p.napUntil : null,
      badges: p.questBadges || {}, progress: p.questProgress || {}, hist: p.questHist || [], looks: shownLooks(w, p), questLooks: p.questLooks || [], flameLooks: p.flameLooks || [], earnedLooks: (p.earn && p.earn.looks) || [], earn: p.earn || null,
      freeQuest: !!(p.freeQuest && !(p.questHist && p.questHist.length) && !q), mythic: isMythic(p), pob: pobOf(w, p), boost: p.questBoost || 0,
      flame: flameTierOf(w, p.owner), early: !!(w.earlyBurner && w.earlyBurner[p.owner]), burned: walletBurned(w, p.owner) }; }
  function handle(w, r, t, amt, bh, L) {
    var b = r.block_index, src = r.source; w._b = b; ELIG_B = b; monoSweep(w, b); shuffleSweep(w, b); gaSweep(w, b); mdSweep(w, b);
    function pet(id) { var p = w.byId[id]; if (p) liveAt(w, p, b); return p; }
    /* roll token (from ACTIVATE_TOKENS_BLOCK): kind 'stageUp' (incl. hatching) or 'meal'; a token becomes one gear item at once, logged on the pet */
    function token(p, kind) { if (b < ACTIVATE_TOKENS_BLOCK || !bh || !p) return;
      var d = sha(bh + r.tx_hash + ':' + p.id + 'XCPETS:v2:token-drop'); if (parseInt(d.slice(0, 8), 16) % 10000 >= TOKEN_DROP_10K[kind]) return;
      liveAt(w, p, b); p.tokens = (p.tokens || 0) + 1; w.tokens[p.owner] = (w.tokens[p.owner] || 0) + 1;
      if (spinsOn(b)) { earnSpin(w, p.owner, b, r.tx_hash, kind === 'meal' ? 'lucky-meal' : 'lucky-stage'); return L(r, 'token', '#' + p.id + ' found a lucky drop (' + (kind === 'meal' ? 'meal' : 'stage-up') + '): +1 saved Pepe Wheel spin', { petId: p.id, token: true, spin: true, wk: 'tok' + p.id }); } /* saved spins */
      var h = sha(bh + r.tx_hash + ':' + p.id + 'XCPETS:v2:token-roll'), sl = rollSlotOf(p, h, b), it = pickItem(h, sl, p.species, p.tier, dedupFor(w, b, p.owner), bodyOf(p));
      if (!it) return L(r, 'token', '#' + p.id + ' found a roll token (' + (kind === 'meal' ? 'meal' : 'stage-up') + '), no gear for ' + slotLabel(sl), { petId: p.id, token: true });
      var ni = newItem(w, it, p.owner, 'token'); ni.rolledOn = p.id; placeRolled(w, p, ni, b);
      return L(r, 'token', '#' + p.id + ' found a roll token (' + (kind === 'meal' ? 'meal' : 'stage-up') + '): free roll ' + it.label + ' (' + slotLabel(sl) + ')' + (ni.bag != null ? ' -> #' + p.id + "'s bag (slot locked)" : ''), { petId: p.id, gid: ni.gid, token: true, wk: 'tok' + p.id }); }
    if (/^(ad|rug|unad)$/.test(t.action) && !rugOn(b)) t = { action: 'invalid' }; /* Rug Me OFF: same as before (unknown tag) */
    if ((t.action === 'sd' || t.action === 'tt' || t.action === 'join') && !modesOn(b)) t = { action: 'invalid' }; /* arena modes OFF: same as before (unknown tag) */
    if ((t.action === 'quest' || t.action === 'aura') && !questOn(b)) t = { action: 'invalid' };
    if (t.action === 'look' && !lookPickOn(b)) t = { action: 'invalid' }; /* look picker OFF: same as before (unknown tag) */ /* Mythic quests OFF: same as before (unknown tag) */
    if (questOn(b)) { questLaunch(w, b); /* quests: a pet away can't be fed for care; one move (quest / aura / fight / breed) per pet per block */
      var qf = t.action === 'feed' ? [t.petId] : t.action === 'feedl' || t.action === 'feedm' ? t.ids || [] : [];
      for (var qi = 0; qi < qf.length; qi++) { var qa = w.byId[qf[qi]]; if (qa && questAway(qa, b)) return L(r, 'rejected', 'pet #' + qa.id + ' is ' + questBusyWhy(qa, b)); }
      var mv = t.action === 'quest' || t.action === 'aura' ? [t.petId] : t.action === 'fight' || t.action === 'breed' ? [t.a, t.b] : [];
      w.moveAt = w.moveAt || {}; for (var mj = 0; mj < mv.length; mj++) { var mp = w.byId[mv[mj]]; if (mp && mp.owner === src && w.moveAt[mp.id] === b) return L(r, 'rejected', 'one move per pet per block: #' + mp.id + ' already moved in block ' + b); }
      mv.forEach(function (id) { var q2 = w.byId[id]; if (q2 && q2.owner === src) w.moveAt[id] = b; }); }
    if (salesOn(b)) { var slb = saleBusy(w, t, src, b); if (slb) return L(r, 'rejected', slb); }
    switch (t.action) {
      case 'quest': { var QP = pet(t.petId), qw = questWhy(w, QP, src, t.q, amt, b); if (qw) return L(r, 'rejected', 'quest: ' + qw);
        if (!bh) return L(r, 'rejected', 'block hash pending');
        var QQ = QUESTS[t.q], qfree = !!(QP.freeQuest && !(QP.questHist && QP.questHist.length)); questInit(QP);
        QP.quest = { code: t.q, start: b, end: b + QQ.len, tx: r.tx_hash, sender: src, free: qfree }; if (qfree) QP.freeQuest = 0; QP.napUntil = null;
        (w.questsOut = w.questsOut || []).push({ petId: QP.id, code: t.q, start: b, end: b + QQ.len, tx: r.tx_hash, sender: src, free: qfree });
        return L(r, 'quest', '#' + QP.id + ' set off on ' + QQ.name + (qfree ? " (First Quest's on Nakamoto)" : '') + ': back at block ' + (b + QQ.len), { petId: QP.id }); }
      case 'look': { var LP = pet(t.petId), lw = petFree(w, LP, src, b); if (lw) return L(r, 'rejected', 'looks: ' + lw);
        lookSweep(w, b); var lr = lookPick(w, LP, t.ops, b); if (!lr.done.length) return L(r, 'rejected', 'looks: ' + lr.refused.join('; '));
        return L(r, 'look', '#' + LP.id + ' looks: ' + lr.done.join('; ') + (lr.refused.length ? ' (refused: ' + lr.refused.join('; ') + ')' : ''), { petId: LP.id }); }
      case 'aura': { var AP = pet(t.petId), aw = petFree(w, AP, src, b); if (aw) return L(r, 'rejected', 'aura: ' + aw);
        var ar = auraPlace(w, AP, t.on, b); if (ar.none) return L(r, 'rejected', 'aura: this wallet has not reached Kindling (10,000 burned) yet');
        return L(r, 'aura', '#' + AP.id + (t.on ? ' shows ' + (ar.on.length ? ar.on.map(function (id) { return flameLook(id).name; }).join(', ') : 'no new look (all placed or slots taken)') : ': Lights Out'), { petId: AP.id }); }
      case 'hatch': {
        if (below(w, amt, COSTS.hatch, b)) return L(r, 'rejected', 'below hatch cost ' + costAt(w, COSTS.hatch, b));
        if (!bh) return L(r, 'rejected', 'block hash pending');
        var art = hatchArt(bh, r.tx_hash, b), sp = art.species;
        var p = mk(w, src, noBornShades(art), b, COSTS.hatch, r.tx_hash);
        var hl = L(r, 'hatch', 'hatched #' + p.id + ' ' + sp, { petId: p.id }); token(p, 'stageUp'); return hl;
      }
      case 'pack': {
        if (below(w, amt, t.cost, b)) return L(r, 'rejected', 'below pack price ' + costAt(w, t.cost, b));
        if (!bh) return L(r, 'rejected', 'block hash pending');
        var first = w.nextPet; for (var i = 0; i < t.n; i++) { var a2 = hatchArt(bh, r.tx_hash + ':' + i, b); mk(w, src, noBornShades(a2), b, COSTS.hatch, r.tx_hash + ':' + i); }
        var pl = L(r, 'hatch', 'pack hatched #' + first + '-#' + (w.nextPet - 1)); for (var pi = first; pi < w.nextPet; pi++) token(w.byId[pi], 'stageUp'); return pl;
      }
      case 'zap': {
        if (!electricOn(b)) return L(r, 'plain', 'plain burn (community food)'); /* exactly the old unknown-tag result */
        if (below(w, amt, t.cost, b)) return L(r, 'rejected', 'below Electric Egg case cost ' + costAt(w, t.cost, b));
        if (!bh) return L(r, 'rejected', 'block hash pending');
        var zf = w.nextPet; for (var zi = 0; zi < t.n; zi++) { var za = electricArt(bh, r.tx_hash + ':' + zi, b); var zp = mk(w, src, noBornShades(za), b, COSTS.hatch, r.tx_hash + ':' + zi); zp.electric = 1; }
        var zl = L(r, 'hatch', 'Electric Egg case hatched #' + zf + '-#' + (w.nextPet - 1)); for (var zj = zf; zj < w.nextPet; zj++) token(w.byId[zj], 'stageUp'); return zl;
      }
      case 'cfeed': {
        if (eraAt(w, b) || saleAt(w, b) ? amt + 5e-9 < costAt(w, COSTS.feedMin, b, true) : !validFeedAmount(amt, b)) return L(r, 'rejected', 'community feed min ' + (eraAt(w, b) || saleAt(w, b) ? costAt(w, COSTS.feedMin, b, true) : b < V2_FROM_BLOCK ? COSTS.feedMinV1 : COSTS.feedMin) + ' (burn still feeds the community pet)'); /* halving: the community feed minimum halves too (owner Oct 22 2026) */
        w.community.feeds += amt; w.community.feeders[src] = (w.community.feeders[src] || 0) + amt;
        return L(r, 'cfeed', 'fed ' + COMMUNITY_PET + ' ' + amt);
      }
      case 'feed': {
        var q = pet(t.petId), why = !q ? 'no such pet' : q.released ? 'released' : q.owner !== src ? 'owner only' : q.dead ? 'dead (Pet Cemetery)' : q.feedDays[day(b)] ? 'already fed this day' : mealFor(q.care, q.species, b, petThresholds(w, q, b)) === 0 ? 'fully fed' : (function (mc) { return eraAt(w, b) || saleAt(w, b) ? amt + 5e-9 < mc : amt < mc; })(mealCost(w, q, mealFor(q.care, q.species, b, petThresholds(w, q, b)), b)) ? 'below meal ' + mealCost(w, q, mealFor(q.care, q.species, b, petThresholds(w, q, b)), b) : null;
        if (why) return L(r, 'rejected', why);
        w._fireFull = mealCost(w, q, mealFor(q.care, q.species, b, petThresholds(w, q, b)), b, true); var qs = q.stage; q.care += mealFor(q.care, q.species, b, petThresholds(w, q, b)); q.feedDays[day(b)] = 1; q.lastFed = b; liveAt(w, q, b);
        var fl = L(r, 'feed', 'fed #' + q.id + ' (care ' + q.care + ')', { petId: q.id }); token(q, q.stage > qs ? 'stageUp' : 'meal'); return fl;
      }
      case 'feedl': if (b < FEED_LIST_BLOCK) return L(r, 'rejected', 'unknown pet: tag (community food)'); /* falls through: same valuation/validation as feedm */
      case 'feedm': {  /* pets in ascending id order, each takes its own meal from the burn; a pet that can't be fed (or that the rest of the burn can't pay for) is skipped */
        if (t.action === 'feedm' && b < ACTIVATE_FEEDM_BLOCK) return L(r, 'rejected', 'unknown pet: tag (community food)');
        var left = amt, fed = [], skip = [], up = {}; w._fireFullM = 0;
        t.ids.forEach(function (id) { var z = pet(id), m = z ? mealFor(z.care, z.species, b, petThresholds(w, z, b)) : 0,
            no = !z ? 'no such pet' : z.released ? 'released' : z.owner !== src ? 'owner only' : z.dead ? 'dead (Pet Cemetery)' : z.feedDays[day(b)] ? 'already fed this day' : m === 0 ? 'fully fed' : left + 1e-9 < mealCost(w, z, m, b) ? 'burn too small for meal ' + mealCost(w, z, m, b) : null;
          if (no) { skip.push('#' + id + ' ' + no); return; }
          var zs = z.stage; left -= mealCost(w, z, m, b); w._fireFullM = (w._fireFullM || 0) + mealCost(w, z, m, b, true); z.care += m; z.feedDays[day(b)] = 1; z.lastFed = b; liveAt(w, z, b); up[z.id] = z.stage > zs; fed.push(z.id); });
        w._fireFull = w._fireFullM || null; w._fireFullM = 0; if (!fed.length) return L(r, 'rejected', 'multi-feed fed nobody: ' + skip.join(', '));
        var ml = L(r, 'feed', 'fed ' + fed.length + ' pets #' + fed.join(', #') + (skip.length ? ' · skipped ' + skip.join(', ') : ''), { petIds: fed, petId: fed[0] });
        fed.forEach(function (id) { token(w.byId[id], up[id] ? 'stageUp' : 'meal'); }); return ml;
      }
      case 'usespin': {  /* SAVED SPINS: 1-sat burn, N (1-10) wheel spins for the signer, each seeded with tx + ':' + i (same wheel rule as pet:spin) */
        if (!spinsOn(b)) return L(r, 'rejected', 'unknown pet: tag (community food)');
        var have = spinsLeft(w, src, b), un = t.n; if (have < un) return L(r, 'rejected', 'saved spins left ' + have + ', asked for ' + un); if (!bh) return L(r, 'rejected', 'block hash pending');
        var got = []; for (var si = 0; si < un; si++) { var sd = r.tx_hash + ':' + si, spool = wheelPool(w, src, b, true), sg = wheelPick(spool, sha(bh + sd + 'XCPETS:v2:wheel-pet')); if (!sg) break;
          var sopen = (sg.openSlots || []).length > 0, shh = sha(bh + sd + 'XCPETS:v2:gear-roll'), ssl = anySlotOn(b) ? rollSlotOf(sg, shh, b) : sopen ? sg.openSlots[parseInt(shh.slice(16, 24), 16) % sg.openSlots.length] : V2_SLOTS[parseInt(shh.slice(16, 24), 16) % V2_SLOTS.length], sit = pickItem(shh, ssl, sg.species, sg.tier, dedupFor(w, b, sg.owner));
          if (!sit) break; var sni = newItem(w, sit, sg.owner, 'usespin'); sni.rolledOn = sg.id; sni.wheel = 1; sni.saved = 1; if (anySlotOn(b)) placeRolled(w, sg, sni, b); else if (sopen) wear(w, sg, sni); /* any-slot rolls: locked slot -> pet's bag */ got.push({ petId: sg.id, gid: sni.gid }); }
        if (!got.length) return L(r, 'rejected', 'Pepe Wheel: no living pet');
        spinRec(w, src).used += got.length; spinRec(w, src).log.push({ block: b, tx: r.tx_hash, src: 'use', n: -got.length });
        return L(r, 'roll', 'used ' + got.length + ' saved spin' + (got.length === 1 ? '' : 's') + ' · ' + spinsLeft(w, src, b) + ' left', { petId: got[0].petId, gid: got[0].gid, spins: got, wheel: 1, saved: true }); }
      case 'spin': if (!wheelOn(b)) return L(r, 'rejected', 'unknown pet: tag (community food)'); /* falls through */
      case 'roll': {
        if (wheelOn(b)) { if (below(w, amt, COSTS.roll, b)) return L(r, 'rejected', 'below roll cost ' + costAt(w, COSTS.roll, b)); if (!bh) return L(r, 'rejected', 'block hash pending');
          var wpool = wheelPool(w, src, b, true), wg = wheelPick(wpool, sha(bh + r.tx_hash + 'XCPETS:v2:wheel-pet')); if (!wg) return L(r, 'rejected', 'Pepe Wheel: no living pet');
          var wopen = (wg.openSlots || []).length > 0, wh = sha(bh + r.tx_hash + 'XCPETS:v2:gear-roll'), wsl = anySlotOn(b) ? rollSlotOf(wg, wh, b) : wopen ? wg.openSlots[parseInt(wh.slice(16, 24), 16) % wg.openSlots.length] : V2_SLOTS[parseInt(wh.slice(16, 24), 16) % V2_SLOTS.length], wit = pickItem(wh, wsl, wg.species, wg.tier, dedupFor(w, b, wg.owner));
          if (wsl === 'hand' && kekCardOn(w, b) && eligible(KEK_CARD_ITEM, wg.species) && parseInt(sha(bh + r.tx_hash + 'XCPETS:v2:kekcard').slice(0, 12), 16) % KEK_CARD_DROP_N === 0) wit = BY_ID[KEK_CARD_ITEM];
          var wni = newItem(w, wit, wg.owner, 'roll'); wni.rolledOn = wg.id; wni.wheel = 1; if (anySlotOn(b)) placeRolled(w, wg, wni, b); else if (wopen) wear(w, wg, wni);
          var wT = wpool.reduce(function (s2, p2) { return s2 + wheelWt(p2); }, 0);
          return L(r, 'roll', 'Pepe Wheel picked #' + wg.id + ' (weight ' + wheelWt(wg) + ' of ' + wT + '): ' + wit.label + ' (' + slotLabel(wsl) + ')' + (wni.on === wg.id ? ' worn' : wni.bag != null ? ' -> #' + wg.id + "'s bag (slot locked)" : ' -> gear bag'), { petId: wg.id, gid: wni.gid, wheel: wpool.length, wheelW: wheelWt(wg), wheelT: wT }); }
        var g = pet(t.petId), wy = !g ? 'no such pet' : g.released ? 'released' : g.owner !== src ? 'owner only' : g.dead ? 'dead' : below(w, amt, COSTS.roll, b) ? 'below roll cost ' + costAt(w, COSTS.roll, b) : !bh ? 'block hash pending' : null;
        if (wy) return L(r, 'rejected', wy);
        var h = sha(bh + r.tx_hash + 'XCPETS:v2:gear-roll'), slot = rollSlotOf(g, h, b), it = pickItem(h, slot, g.species, g.tier, dedupFor(w, b, g.owner), bodyOf(g));
        if (slot === 'hand' && kekCardOn(w, b) && eligible(KEK_CARD_ITEM, g.species) && parseInt(sha(bh + r.tx_hash + 'XCPETS:v2:kekcard').slice(0, 12), 16) % KEK_CARD_DROP_N === 0) it = BY_ID[KEK_CARD_ITEM]; /* LORDKEK card drop (gated) */
        var ni = newItem(w, it, g.owner, 'roll'); ni.rolledOn = g.id; placeRolled(w, g, ni, b);
        return L(r, 'roll', '#' + g.id + ' rolled ' + it.label + ' (' + slotLabel(slot) + ')' + (ni.bag != null ? ' -> bag (slot locked)' : ''), { petId: g.id, gid: ni.gid });
      }
      case 'froll': {  /* free gear roll (founder credits): any amount (1 sat of XCPETS is enough); same roll as pet:roll; one credit per successful roll */
        if (b < ACTIVATE_FOUNDER_BLOCK || spinsOn(b)) return L(r, 'rejected', 'unknown pet: tag (community food)'); /* closed at ACTIVATE_SPINS_BLOCK: credits became saved spins */
        var fg = pet(t.petId), fw = !(w.freeRolls[src] > 0) ? 'no free rolls left' : !fg ? 'no such pet' : fg.released ? 'released' : fg.owner !== src ? 'owner only' : fg.dead ? 'dead' : !bh ? 'block hash pending' : null;
        if (fw) return L(r, 'rejected', fw);
        var fh = sha(bh + r.tx_hash + 'XCPETS:v2:gear-roll'), fsl = rollSlotOf(fg, fh, b), fit = pickItem(fh, fsl, fg.species, fg.tier, dedupFor(w, b, fg.owner), bodyOf(fg));
        w.freeRolls[src]--; var fni = newItem(w, fit, fg.owner, 'froll'); fni.rolledOn = fg.id; placeRolled(w, fg, fni, b);
        return L(r, 'roll', '#' + fg.id + ' free roll: ' + fit.label + ' (' + slotLabel(fsl) + ') · ' + w.freeRolls[src] + ' free rolls left', { petId: fg.id, gid: fni.gid, free: true });
      }
      case 'release': {
        var done = []; t.ids.forEach(function (id) { var x = w.byId[id]; if (x && !x.released && x.owner === src) { x.released = b; done.push(id); wornOf(w, id).forEach(function (gg) { gg.on = null; }); } });
        return L(r, done.length ? 'release' : 'rejected', done.length ? 'released #' + done.join(', #') : 'nothing released', { ids: done });
      }
      case 'fight': {
        var A = pet(t.a), B = pet(t.b), e = below(w, amt, COSTS.fight, b) ? 'below fight cost ' + costAt(w, COSTS.fight, b) : !A || A.owner !== src ? 'challenger must be your pet' : t.a === t.b ? 'cannot fight itself' : fightable(A, b) || (fightable(B, b) ? 'opponent: ' + fightable(B, b) : null);
        if (!e && (A.fightDays[day(b)] || B.fightDays[day(b)])) e = 'one challenge fight per pet per 144-block day';
        if (!e && w.fights.some(function (f) { return f.status === 'open' && (f.a === t.a || f.b === t.a) && b - f.block <= FIGHT_WINDOW; })) e = 'pet already has an open challenge';
        if (!e && modesOn(b) && inOpenFight(w, t.a, b)) e = 'pet already has an open challenge'; /* arena modes: Tag Team partners count too */
        if (e) return L(r, 'rejected', e);
        A.fightDays[day(b)] = 1;
        var f = { id: w.fights.length + 1, a: t.a, b: t.b, block: b, tx: r.tx_hash, status: 'open', expires: b + FIGHT_WINDOW, challenger: src };
        w.fights.push(f); return L(r, 'fight', '#' + t.a + ' challenged #' + t.b + ' (fight ' + f.id + ', accept by block ' + f.expires + ')', { fightId: f.id });
      }
      case 'sd': case 'tt': case 'join': return modeBurn(w, r, t, amt, bh, L, pet);
      case 'accept': {
        if (w.fights[t.fightId - 1] && w.fights[t.fightId - 1].mode) return modeBurn(w, r, t, amt, bh, L, pet);
        var F = w.fights[t.fightId - 1], err = !F ? 'no such fight' : below(w, amt, COSTS.accept, b) ? 'below accept cost ' + costAt(w, COSTS.accept, b) : F.status !== 'open' ? 'fight is ' + F.status : b - F.block > FIGHT_WINDOW ? 'challenge expired' : null;
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
        los.blackEyeUntil = b + BLACK_EYE_BLOCKS; win.wins = (win.wins || 0) + 1; los.losses = (los.losses || 0) + 1; earnFight(w, win, los, b);
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
        var X = pet(t.a), Y = pet(t.b), be = below(w, amt, breedCost(b), b) ? 'below breed cost ' + costAt(w, breedCost(b), b) : !X || X.owner !== src ? 'first pet must be yours' : t.a === t.b ? 'two different pets' : breedable(X, b) || (breedable(Y, b) ? 'partner: ' + breedable(Y, b) : null);
        if (!be && breedV2On(b)) be = kinWhy(X, Y);
        if (be) return L(r, 'rejected', be);
        if (Y.owner !== src) { // two owners: this is a request (or the acceptance of the partner's mirrored request)
          var req = w.breedReqs.filter(function (q) { return q.a === t.b && q.b === t.a && !q.used && b - q.block <= BREED_WINDOW; })[0];
          if (!req) { w.breedReqs.push({ a: t.a, b: t.b, block: b, tx: r.tx_hash, owner: src }); return L(r, 'breedReq', '#' + t.a + ' asked #' + t.b + ' to breed (partner burns pet:breed:' + t.b + ':' + t.a + ' within ' + BREED_WINDOW + ' blocks)'); }
          req.used = true; if (!bh) return L(r, 'rejected', 'block hash pending');
          var kid = breed(w, Y, X, bh, r.tx_hash, b, req.owner); return L(r, 'breed', 'bred #' + Y.id + ' x #' + X.id + ' -> Egg #' + kid.id + (kid.twinOf ? ' + twin Egg #' + kid.twinOf : ''), { petId: kid.id });
        }
        if (!bh) return L(r, 'rejected', 'block hash pending');
        var k2 = breed(w, X, Y, bh, r.tx_hash, b, src); return L(r, 'breed', 'bred #' + X.id + ' x #' + Y.id + ' -> Egg #' + k2.id + (k2.twinOf ? ' + twin Egg #' + k2.twinOf : ''), { petId: k2.id });
      }
      case 'croll': {  /* community roll: Nakamoto (Mythic, every slot open) gets one item; the newest roll in a slot is worn */
        if (b < ACTIVATE_CROLL_BLOCK) return L(r, 'rejected', 'unknown pet: tag (community food)');
        if (t.nameCode && b < ACTIVATE_SLOTNAME_BLOCK) return L(r, 'rejected', 'unknown pet: tag (community food)');
        if (below(w, amt, COSTS.croll, b)) return L(r, 'rejected', 'below community roll cost ' + costAt(w, COSTS.croll, b) + ' (burn still feeds the community pet)');
        if (!bh) return L(r, 'rejected', 'block hash pending');
        var ch = sha(bh + r.tx_hash + 'XCPETS:v2:community-roll'), cs = t.slot || V2_SLOTS[parseInt(ch.slice(16, 24), 16) % V2_SLOTS.length], ci = pickItem(ch, cs, 'nakamoto', 3, b >= ACTIVATE_DEDUP_BLOCK ? communityCounts(w) : null);
        if (!ci) return L(r, 'rejected', 'no community gear for ' + slotLabel(cs));
        var cg = { item: ci.id, label: ci.label, slot: ci.slot, tier: ci.tier, legendary: isLegendary(ci), block: b, tx: r.tx_hash, by: src };
        w.community.gear[ci.slot] = cg; w.community.gearLog.push(cg);
        return L(r, 'croll', 'community roll: the community pet got ' + ci.label + ' (' + slotLabel(ci.slot) + ')', { item: ci.id, slot: ci.slot });
      }
      case 'hatchwiz': {  /* WIZARD EGG: anyone, once the Wizard is in Cold Storage (see ACTIVATE_WIZ_COLD_BLOCK) */
        if (!wizColdOn(w, b) || b >= ACTIVATE_WIZ_PRIORITY_BLOCK) return L(r, 'rejected', 'unknown pet: tag (community food)'); /* exactly the old 'invalid' outcome; CLOSED from ACTIVATE_WIZ_PRIORITY_BLOCK (owner Oct 20 2026: Wizard is roll-only, 1 in 777) */
        if (amt < WIZ_EGG_COST) return L(r, 'rejected', 'below Wizard egg cost ' + WIZ_EGG_COST);
        if (!bh) return L(r, 'rejected', 'block hash pending');
        var wa = wizardArt(bh, r.tx_hash, b), wp = mk(w, src, wa, b, COSTS.hatch, r.tx_hash);
        var wl = L(r, 'hatch', 'hatched #' + wp.id + ' Bitcoin Wizard', { petId: wp.id }); token(wp, 'stageUp'); return wl;
      }
      case 'wsign': {  /* JOIN US SIGN: one free claim per wallet that fed the Wizard (any amount); worn at once if pet:sign:ID names your Wizard with Grip open */
        if (!wizColdOn(w, b)) return L(r, 'rejected', 'unknown pet: tag (community food)');
        var WM = w.wizardMythic, sw = amt + 1e-12 < WIZ_SIGN_MIN ? 'below claim minimum' : !(WM.by[src] > 0) ? 'only wallets that fed the Bitcoin Wizard can claim the sign' : WM.claimed[src] ? 'sign already claimed' : !BY_ID[WIZ_SIGN_ITEM] ? 'no sign item' : null;
        if (sw) return L(r, 'rejected', sw);
        WM.claimed[src] = b; var sg = newItem(w, BY_ID[WIZ_SIGN_ITEM], src, 'sign'), sp2 = t.petId != null ? pet(t.petId) : null;
        if (sp2 && sp2.owner === src && !sp2.dead && !sp2.released && eligible(WIZ_SIGN_ITEM, sp2.species) && (sp2.openSlots || []).indexOf('hand') >= 0) wear(w, sp2, sg);
        return L(r, 'sign', 'claimed the "Join us" sign' + (sg.on != null ? ' (worn by #' + sg.on + ')' : ' (in your stash)'), { gid: sg.gid, petId: sg.on });
      }
      case 'kekcard': {
        if (!kekCardOn(w, b)) return L(r, 'rejected', 'unknown pet: tag (community food)');
        var KM = w.kekMythic; KM.claimed = KM.claimed || {}; var kw = amt + 1e-12 < KEK_CARD_MIN ? 'below claim minimum' : !(KM.by[src] > 0) ? 'only wallets that fed Lord Kek can claim the card' : KM.claimed[src] ? 'card already claimed' : null;
        if (kw) return L(r, 'rejected', kw);
        KM.claimed[src] = b; var kc = newItem(w, BY_ID[KEK_CARD_ITEM], src, 'kekcard'), kp2 = t.petId != null ? pet(t.petId) : null;
        if (kp2 && kp2.owner === src && !kp2.dead && !kp2.released && eligible(KEK_CARD_ITEM, kp2.species) && (kp2.openSlots || []).indexOf('hand') >= 0) wear(w, kp2, kc);
        return L(r, 'kekcard', 'claimed the LORDKEK Rare Pepe card' + (kc.on != null ? ' (worn by #' + kc.on + ')' : ' (in your stash)'), { gid: kc.gid, petId: kc.on });
      }
      case 'ad': case 'unad': case 'rug': { /* Rug Me (only reached at/after ACTIVATE_RUGME_BLOCK) */
        var rw = rugCheck(w, t, src, b, amt, pet); if (rw) return L(r, 'rejected', rw); var ads = w.ads || [];
        if (t.action === 'ad') { if (!w.ads) w.ads = ads; var made = t.ids.map(function (id) { var ad = { id: ads.length + 1, pet: id, owner: src, req: parseReq(t.req), block: b, tx: r.tx_hash, state: 'open' }; ads.push(ad); return ad; });
          return L(r, 'rugAd', made.map(function (a) { return '#' + a.pet; }).join(', ') + ' posted Rug Me ad' + (made.length > 1 ? 's ' + made[0].id + '-' + made[made.length - 1].id : ' ' + made[0].id) + ' (' + reqText(made[0].req) + '), open until block ' + (b + AD_WINDOW - 1), { petId: made[0].pet, adId: made[0].id }); }
        if (t.action === 'unad') { var ua = ads[t.adId - 1]; ua.state = 'cancelled'; ua.closed = b; return L(r, 'rugUnad', 'Rug Me ad ' + ua.id + ' cancelled', { petId: ua.pet, adId: ua.id }); }
        if (!bh) return L(r, 'rejected', 'block hash not yet available (retry when confirmed)');
        var ta = ads[t.adId - 1], TA = pet(ta.pet), TB = pet(t.petId); ta.state = 'taken'; ta.taken = { pet: TB.id, owner: src, block: b, tx: r.tx_hash };
        var rk = breed(w, TA, TB, bh, r.tx_hash, b, ta.owner); ta.taken.kid = rk.id;
        return L(r, 'breed', 'Rug Me match (ad ' + ta.id + '): #' + TB.id + ' rugged #' + TA.id + ' -> Egg #' + rk.id + ' (' + (rk.tier != null ? TIER_LABELS[rk.tier] + ' ' : '') + speciesLabel(rk.species) + ') to the poster', { petId: rk.id, adId: ta.id }); }
      case 'invalid': return L(r, 'rejected', 'unknown pet: tag (community food)');
      case 'hi': {
        if (!giveOn(b)) return L(r, 'rejected', 'unknown pet: tag (community food)');
        return L(r, 'hi', src + ' said hi: player #' + playerCode(playerNo(w, src)), { player: playerNo(w, src) }); }
      case 'deed': {  /* PET TOKEN BINDING (see ACTIVATE_SALES_BLOCK) */
        if (!salesOn(b)) { if (ACTIVATE_SPAM_RULES_BLOCK != null && rulesOn(w.tip)) (w._preTies = w._preTies || []).push({ t: t, src: src, b: b, tx: r.tx_hash }); return L(r, 'rejected', 'unknown pet: tag (community food)'); }
        var dlp = pet(t.petId), dly = deedWhy(w, t, src, b, amt, SALE_DEX ? dexIndex(SALE_DEX) : null); if (dly) return L(r, 'rejected', 'shop token: ' + dly);
        bindDeed(w, dlp, t.asset, src, b, r.tx_hash, dexIndex(SALE_DEX));
        return L(r, 'deed', '#' + dlp.id + ' has a pet token: ' + t.asset, { petId: dlp.id, asset: t.asset }); }
      case 'unsell': {  /* END A SHOP LISTING EARLY (see ACTIVATE_SALES_BLOCK) */
        if (!salesOn(b)) return L(r, 'rejected', 'unknown pet: tag (community food)');
        var uns = unsellWhy(w, t, src, b, amt); if (uns[0]) return L(r, 'rejected', 'shop: ' + uns[0]);
        uns[1].endBlock = b + SALE_UNSELL_SETTLE; uns[1].unsellTx = r.tx_hash;
        return L(r, 'unsell', 'listing ' + uns[1].n + ' (#' + uns[1].petId + ') ends at block ' + uns[1].endBlock, { petId: uns[1].petId, listing: uns[1].n }); }
      case 'give': {  /* PET GIFTING (see ACTIVATE_GIVE_BLOCK) */
        if (!giveOn(b)) return L(r, 'rejected', 'unknown pet: tag (community food)');
        if (TOKEN_ONLY) return L(r, 'rejected', NO_BURN_GIFT);
        var gvp = pet(t.petId), gvw = giveWhy(w, t, src, b, amt); if (gvw) return L(r, 'rejected', 'gift: ' + gvw);
        var gto = playerAddr(w, t.to), mv = giftMoves(w, gvp); gvp.owner = gto; gvp.lastGot = b;
        mv.worn.concat(mv.bag).forEach(function (g) { g.owner = gto; });
        var grec = { block: b, tx: r.tx_hash, petId: gvp.id, from: src, to: gto, toNo: t.to, tier: gvp.tier, gear: mv.worn.length + mv.bag.length };
        (gvp.gifts = gvp.gifts || []).push(grec); w.giftLog.push(grec);
        return L(r, 'gift', '#' + gvp.id + ' was gifted to player #' + playerCode(t.to) + (grec.gear ? ' with ' + grec.gear + ' gear' : ''), { petId: gvp.id, to: gto, gift: true }); }
      case 'swap': case 'swapok': case 'swapno': {  /* PET-FOR-PET SWAPS (see SWAP_WINDOW) */
        if (!giveOn(b)) return L(r, 'rejected', 'unknown pet: tag (community food)');
        if (TOKEN_ONLY) return L(r, 'rejected', NO_BURN_GIFT);
        if (!(amt >= COSTS.give)) return L(r, 'rejected', 'below swap cost 1 dander');
        if (t.action === 'swap') { var sA = pet(t.mine), sB = pet(t.theirs);
          var sw = !sA || !sB ? 'no such pet' : t.mine === t.theirs ? 'same pet' : sA.owner !== src ? 'offer a pet of yours' : sB.owner === src ? 'both pets are yours' :
            sA.community || sB.community ? 'community pet' : sA.released || sB.released ? 'released' : sA.dead || sB.dead ? 'dead (Pet Cemetery)' : giveLocks(w, sA, b);
          if (sw) return L(r, 'rejected', 'swap: ' + sw);
          var SX = { n: w.swaps.length + 1, mine: t.mine, theirs: t.theirs, from: src, to: sB.owner, block: b, tx: r.tx_hash, status: 'open', expires: b + SWAP_WINDOW };
          w.swaps.push(SX); return L(r, 'swapOffer', 'swap offer ' + SX.n + ': #' + t.mine + ' for #' + t.theirs + ' (accept by block ' + SX.expires + ')', { swap: SX.n, petId: t.theirs }); }
        var X = w.swaps[t.n - 1];
        if (t.action === 'swapno') { if (!swapOpen(w, X, b)) return L(r, 'rejected', 'swap: ' + (X ? 'offer is ' + (X.status === 'open' ? 'expired' : X.status) : 'no such swap offer'));
          var xo = w.byId[X.theirs]; if (src !== X.from && !(xo && xo.owner === src)) return L(r, 'rejected', 'swap: not your offer');
          X.status = src === X.from ? 'cancelled' : 'declined'; X.closeBlock = b; return L(r, 'swapClose', 'swap offer ' + X.n + ' ' + X.status, { swap: X.n }); }
        if (X) { pet(X.mine); pet(X.theirs); } var sk = swapWhy(w, X, src, b); if (sk) return L(r, 'rejected', 'swap: ' + sk);
        var PA = w.byId[X.mine], PB = w.byId[X.theirs], mA = giftMoves(w, PA), mB = giftMoves(w, PB), oA = PA.owner, oB = PB.owner;
        PA.owner = oB; PB.owner = oA; PA.lastGot = b; PB.lastGot = b;
        mA.worn.concat(mA.bag).forEach(function (g) { g.owner = oB; }); mB.worn.concat(mB.bag).forEach(function (g) { g.owner = oA; });
        Object.assign(X, { status: 'done', doneBlock: b, doneTx: r.tx_hash, gearA: mA.worn.length + mA.bag.length, gearB: mB.worn.length + mB.bag.length, tierA: PA.tier, tierB: PB.tier });
        [[PA, oA, oB], [PB, oB, oA]].forEach(function (z) { var gr = { block: b, tx: r.tx_hash, petId: z[0].id, from: z[1], to: z[2], toNo: playerNo(w, z[2]), tier: z[0].tier, swap: X.n }; (z[0].gifts = z[0].gifts || []).push(gr); w.giftLog.push(gr); });
        return L(r, 'swap', 'swap ' + X.n + ': #' + PA.id + ' and #' + PB.id + ' changed owners', { swap: X.n, petIds: [PA.id, PB.id], petId: PB.id }); }
      case 'gives': {  /* BATCH GIFT: every pet is checked on its own; a locked pet is skipped with a reason, the rest move */
        if (!giveOn(b)) return L(r, 'rejected', 'unknown pet: tag (community food)');
        if (TOKEN_ONLY) return L(r, 'rejected', NO_BURN_GIFT);
        if (!(amt >= COSTS.give)) return L(r, 'rejected', 'below gift cost 1 dander');
        var bto = playerAddr(w, t.to), bdone = [], bskip = [];
        t.ids.forEach(function (id) { pet(id); var why = giveWhy(w, { petId: id, to: t.to }, src, b); if (why) { bskip.push('#' + id + ' ' + why); return; }
          var bp = w.byId[id], bm = giftMoves(w, bp); bp.owner = bto; bp.lastGot = b; bm.worn.concat(bm.bag).forEach(function (g) { g.owner = bto; });
          var br = { block: b, tx: r.tx_hash, petId: id, from: src, to: bto, toNo: t.to, tier: bp.tier, gear: bm.worn.length + bm.bag.length, batch: true };
          (bp.gifts = bp.gifts || []).push(br); w.giftLog.push(br); bdone.push(id); });
        if (!bdone.length) return L(r, 'rejected', 'gift: nothing moved: ' + bskip.join(', '));
        return L(r, 'gift', 'gifted ' + bdone.length + ' pet' + (bdone.length > 1 ? 's' : '') + ' #' + bdone.join(', #') + ' to player #' + playerCode(t.to) + (bskip.length ? ' · skipped ' + bskip.join(', ') : ''), { petIds: bdone, petId: bdone[0], to: bto, gift: true, skipped: bskip }); }
      case 'wagmi': {
        if (b < ACTIVATE_WAGMI_BLOCK) return L(r, 'rejected', 'unknown pet: tag (community food)');
        if (!(amt >= COSTS.wagmi)) return L(r, 'rejected', 'below WAGMI cost 1 sat');
        var wd = (w.wagmi[src] = w.wagmi[src] || {}); if (wd[day(b)]) return L(r, 'wagmi', src + ' already said WAGMI on chain day ' + day(b) + ' (counts once)');
        wd[day(b)] = 1;
        if (wagmiPrizeOn(b)) { var F5 = (w.wagmiFirst[day(b)] = w.wagmiFirst[day(b)] || []); /* top-five prize: first 5 distinct wallets of the chain day (block, then tx order) */
          if (F5.length < WAGMI_PRIZE_N) { F5.push(src); earnSpin(w, src, b, r.tx_hash, 'wagmi', 1); return L(r, 'wagmi', src + ' said WAGMI for chain day ' + day(b) + ' (#' + F5.length + ' of the day: +1 saved spin)', { first5: F5.length }); } }
        return L(r, 'wagmi', src + ' said WAGMI for chain day ' + day(b));
      }
      case 'grave': {  /* GRAVE GEAR opt-in / cancel (see ACTIVATE_GRAVE_GEAR_BLOCK): owner only, living pet only, any amount */
        if (!graveOn(b)) return L(r, 'rejected', 'unknown pet: tag (community food)');
        var gq = pet(t.petId), gw = !gq ? 'no such pet' : gq.community ? 'community pet' : gq.released ? 'released' : gq.owner !== src ? 'owner only' : gq.dead ? 'dead (Pet Cemetery): too late to change' : null;
        if (gw) return L(r, 'rejected', gw);
        if (t.on) { gq.graveGear = b; gq.graveTx = r.tx_hash; } else { delete gq.graveGear; delete gq.graveTx; }
        return L(r, 'grave', t.on ? '#' + gq.id + ': worn gear stays on the grave if it dies' : '#' + gq.id + ': grave gear cancelled (gear goes back to the stash at death)', { petId: gq.id });
      }
      case 'oroll': {  /* OVERFLOW ROLL (Mythic discount): pet:of:ID, any amount (1 sat of XCPETS is enough), signed by the owner. Spends one of the pet's overflow rolls
         * (floor((care - 21,000) / 1,000) once the owner's discount applies, minus rolls used). Same gear roll as pet:roll, seeded from block hash + tx id with its own salt. */
        if (!mythicDiscountOn(b) || spinsOn(b)) return L(r, 'rejected', 'unknown pet: tag (community food)'); /* closed at ACTIVATE_SPINS_BLOCK: overflow counts as saved spins */
        var og = pet(t.petId), ow = !og ? 'no such pet' : og.community ? 'community pet' : og.released ? 'released' : og.owner !== src ? 'owner only' : og.dead ? 'dead' : !(overflowLeft(w, og, b) > 0) ? 'no overflow rolls left' : !bh ? 'block hash pending' : null;
        if (ow) return L(r, 'rejected', ow);
        var oh = sha(bh + r.tx_hash + 'XCPETS:v2:overflow-roll'), osl = rollSlotOf(og, oh, b), oit = pickItem(oh, osl, og.species, og.tier, dedupFor(w, b, og.owner), bodyOf(og));
        w.overflowUsed[og.id] = (w.overflowUsed[og.id] || 0) + 1; var oni = newItem(w, oit, og.owner, 'oroll'); oni.rolledOn = og.id; placeRolled(w, og, oni, b);
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
    if (p.species === 'kek' && specialNamesOn(b) && !w.pets.some(function (q) { return q.species === 'kek' && !q.parents && !q.hybrid; })) p.name = 'Kek'; /* SPECIAL EGG NAMES: the very first Lord Kek egg ever hatched keeps the name 'Kek' */
    w.pets.push(p); w.byId[p.id] = p; liveAt(w, p, b); return p;
  }
  // ---------------------------------------------------------------- HYBRIDS (v2, 2026-10-14)
  // HYBRID_NAMES: display name per ORDERED pair 'parentA:parentB' (A = the requester / first pet). 13 x 12 = 156 entries; the 24 Nakamoto pairs
  // are reachable from block 971,674 (ACTIVATE_HYBRID_RATE_BLOCK: all pets can hybrid). Names are mashups of both parents (renamed 2026-10-16);
  // display-only: keys, replay and pet records never use them. Keep names unique and never equal to a species name.
  var HYBRID_NAMES = {
    /* Lord Kek hybrids, BOTH directions like every species (owner Oct 20 ~6:12 PM CT); reachable only once player Keks exist (ACTIVATE_KEK_BLOCK) */
    'kek:pepe': 'Kekpe', 'kek:wojak': 'Kekjak', 'kek:chud': 'Kekchud', 'kek:bobo': 'Kekbo', 'kek:mumu': 'Kekmu', 'kek:snibby': 'Kekby', 'kek:dodo': 'Kekdo', 'kek:kevin': 'Kekvin', 'kek:peepo': 'Kekpo', 'kek:sarutobi': 'Kektobi', 'kek:doge': 'Kekge', 'kek:lenny': 'Kekny', 'kek:nakamoto': 'Kekmoto',
    'pepe:kek': 'Pekek', 'wojak:kek': 'Wokek', 'chud:kek': 'Chukek', 'bobo:kek': 'Bokek', 'mumu:kek': 'Mukek', 'snibby:kek': 'Snikek', 'dodo:kek': 'Dokek', 'kevin:kek': 'Kekek', 'peepo:kek': 'Peekek', 'sarutobi:kek': 'Sakek', 'doge:kek': 'Dogkek', 'lenny:kek': 'Lekek', 'nakamoto:kek': 'Nakek',
    'kek:wizard': 'Kekzard', 'wizard:kek': 'Wikek',
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
    /* Wizard hybrids (branch wizard-breed-on, FINAL proposed names Oct 22 2026; owner said YES to Wizard breeding; reachable only from ACTIVATE_WIZ_BREED_BLOCK) */
    'wizard:pepe': 'Wizpe', 'wizard:wojak': 'Wizjak', 'wizard:chud': 'Wizchud', 'wizard:bobo': 'Wizbo', 'wizard:mumu': 'Wizmu', 'wizard:snibby': 'Wizsnib', 'wizard:dodo': 'Wizdo', 'wizard:kevin': 'Wizvin', 'wizard:peepo': 'Wizpo', 'wizard:sarutobi': 'Wiztobi', 'wizard:doge': 'Wizdoge', 'wizard:lenny': 'Wizlen', 'wizard:nakamoto': 'Wizmoto',
    'pepe:wizard': 'Pewiz', 'wojak:wizard': 'Wowiz', 'chud:wizard': 'Chuwiz', 'bobo:wizard': 'Bowiz', 'mumu:wizard': 'Muwiz', 'snibby:wizard': 'Sniwiz', 'dodo:wizard': 'Dowiz', 'kevin:wizard': 'Kevwiz', 'peepo:wizard': 'Peewiz', 'sarutobi:wizard': 'Sawiz', 'doge:wizard': 'Dogwiz', 'lenny:wizard': 'Lewiz', 'nakamoto:wizard': 'Nawiz',
    'nakamoto:pepe': 'Napep', 'nakamoto:wojak': 'Najak', 'nakamoto:chud': 'Nachud', 'nakamoto:bobo': 'Nabo', 'nakamoto:mumu': 'Namu', 'nakamoto:snibby': 'Nabby', 'nakamoto:dodo': 'Nadod', 'nakamoto:kevin': 'Navin', 'nakamoto:peepo': 'Napo', 'nakamoto:sarutobi': 'Nabi', 'nakamoto:doge': 'Nage', 'nakamoto:lenny': 'Nalen'
  };
  /* FUNTRUMP 2-way names (LIVE from ACTIVATE_FUNTRUMP_BLOCK = 972,880; used once a FUNTRUMP egg rolls):
   * shape species first: <species>trump (Pepetrump) / Fun<species> (Funjak). Never overrides an existing name. */
  ['pepe', 'wojak', 'chud', 'bobo', 'mumu', 'snibby', 'dodo', 'kevin', 'peepo', 'sarutobi', 'doge', 'lenny', 'nakamoto', 'kek', 'wizard'].forEach(function (sp, i) {
    var A = ['Pepe', 'Wo', 'Chud', 'Bo', 'Mu', 'Snib', 'Do', 'Kev', 'Peep', 'Saru', 'Doge', 'Len', 'Naka', 'Kek', 'Wiz'][i], B = ['pepe', 'jak', 'chud', 'bo', 'mu', 'by', 'do', 'vin', 'po', 'tobi', 'ge', 'ny', 'moto', 'kek', 'zard'][i];
    if (!HYBRID_NAMES[sp + ':funtrump']) HYBRID_NAMES[sp + ':funtrump'] = A + 'trump'; if (!HYBRID_NAMES['funtrump:' + sp]) HYBRID_NAMES['funtrump:' + sp] = 'Fun' + B; });
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
  var H3_ORDER = ['pepe', 'wojak', 'chud', 'bobo', 'mumu', 'snibby', 'dodo', 'kevin', 'peepo', 'sarutobi', 'doge', 'lenny', 'nakamoto', 'kek', 'wizard', 'funtrump'];
  var H3_S1 = ['Pe', 'Wo', 'Chu', 'Bo', 'Mu', 'Sni', 'Do', 'Ke', 'Pee', 'Sa', 'Dog', 'Le', 'Na', 'Kek', 'Wi', 'Fun'], H3_S2 = ['pe', 'jo', 'chu', 'bo', 'mu', 'nib', 'do', 'ke', 'pee', 'ru', 'go', 'len', 'ka', 'kek', 'zi', 'tru'],
    H3_S3 = ['pe', 'jak', 'chud', 'bo', 'mu', 'by', 'do', 'vin', 'po', 'tobi', 'ge', 'ny', 'moto', 'kek', 'zard', 'trump'];
  function h3part(T, sp) { var i = H3_ORDER.indexOf(sp); return i < 0 ? sp : T[i]; }
  function hybridName(sp) { var r = hybridRoots(sp); if (r.length === 3) return h3part(H3_S1, r[0]) + h3part(H3_S2, r[1]) + h3part(H3_S3, r[2]);
    return HYBRID_NAMES[r[0] + ':' + r[1]] || (r[0] + '-' + r[1]); }
  function speciesLabel(sp) { if (sp === 'funtrump') return 'FUNTRUMP'; if (sp === 'wizard') return 'Bitcoin Wizard'; if (sp === 'kek') return 'Lord Kek'; if (isHybrid(sp)) return hybridName(sp) + ' (hybrid)'; var s = PetCore.SPECIES.filter(function (x) { return x.id === sp; })[0]; return s ? s.label : sp; }
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
  function hybridPlan(hex, key, blk) { var P0 = hybridPlan0(hex, key); if (breedV2On(blk)) P0.parts = hybridParts(hex, P0, blk); return P0; }
  function hybridPlan0(hex, key) { var r = hybridRoots(key), R = stream('XCPETS:v2:hybrid-art:' + hex);
    if (r.length === 3) { var o = shuffled(R, r); /* 3-way: body shape, colours and signature feature each from a different parent */
      return { key: key, a: r[0], b: r[1], c: r[2], roots: r.slice(), name: hybridName(key), shape: o[0], color: o[1], featSp: o[2], feature: ['head', 'side'][R() % 2], eyes: PetCore.EYES[R() % PetCore.EYES.length].id }; }
    var s = R() % 2, shape = r[s], color = r[1 - s]; // 2-way: unchanged
    return { key: key, a: r[0], b: r[1], roots: r.slice(), name: hybridName(key), shape: shape, color: color, feature: ['head', 'side'][R() % 2], eyes: PetCore.EYES[R() % PetCore.EYES.length].id }; }
  /* BODY-PART TRADING v2 (breeding v2, from ACTIVATE_BREEDING_V2_BLOCK; owner redo Oct 21 2026 10:05 PM CT: REPLACE, not overlay).
   * One general rule for every species, no per-pet overrides: every hybrid root that is NOT the body (shape) parent gives the child one of
   * its signature parts (a second one 50% of the time when it has two), picked from the own stream 'XCPETS:v2:hybrid-parts:' + hash.
   * The part REPLACES the matching region of the child's body: the child's own region is erased first, then the donor's part (cut from the
   * donor's sprite at the same stage, by semantic pixel keys) is scaled and anchored to the child's anatomy (found the same way), and the
   * outline is redrawn round the new silhouette. Region kinds:
   *   eyes  = eye/pupil/white/brow/frame/lens keys (+ the ink inside that box, + eye domes sticking up over it): eyes, glasses, brows
   *   mouth = the mouth key grown through the non-skin keys round it: beak, lips          (erased region refilled with the child's skin)
   *   top   = the forked top of the head (ears, horns, nemes, hat)                         (erased to background)
   *   hair  = species keys touching the top of the head (hair)                             (child's hair refilled with skin)
   *   ears  = side bumps in the head band (side ears)  arms = side bumps in the body band (claws, arms)  tail = left bump, low band */
  var HYBRID_PARTS = {
    pepe: [{ id: 'eyes', label: 'bulging eyes', kind: 'eyes' }],
    peepo: [{ id: 'eyes', label: 'bulging eyes', kind: 'eyes' }],
    wojak: [{ id: 'eyes', label: 'sad eyes', kind: 'eyes', draw: { mode: 'pair', anchor: 'center', big: ['...nn', '.nnnn', 'nnwww', 'wwwpp', '.wwpp', 'dddd.'], small: ['..nn', 'nnww', 'wwpp', 'ddd.'] } }],
    chud: [{ id: 'glasses', label: 'eyeglasses', kind: 'eyes' }], /* black bangs removed Oct 22 (owner): fit no body; the beard was gear (chud-beard); from ACTIVATE_CHUD_BEARD_PART_BLOCK partsFor adds CHUD_BEARD_PART */
    bobo: [{ id: 'ears', label: 'ears', kind: 'top', pair: true, onTop: true, draw: { mode: 'pair', anchor: 'bottom', big: ['.BBBB.', 'BBddBB', 'BddddB', 'BddddB'], small: ['.BB.', 'BddB', 'BddB'] } }],
    mumu: [{ id: 'horns', label: 'horns', kind: 'top', pair: true, onTop: true }],
    snibby: [{ id: 'claws', label: 'claws', kind: 'arms' }],
    dodo: [{ id: 'beak', label: 'beak', kind: 'mouth', side: { huge: ['hhhhh..', 'AAAAAAd', 'AAAAAd.', 'nnnnnd.', 'AAAAd..', '.ddd...'], big: ['hhhh..', 'AAAAAd', 'nnnnd.', 'AAAd..'], small: ['hhh.', 'AAAd', 'AAd.'] }, front: { big: ['AAAAAAA', 'hAAAAAh', '.AAAAA.', '..ddd..', '...d...'], small: ['AAAAA', '.AAA.', '..d..'] } }, { id: 'tail', label: 'tail', kind: 'tail', draw: { mode: 'one', anchor: 'tail', big: ['B...B..', 'Bd..Bd.', '.Bd..Bd', '..BdBBd', '...BBdd', '....Bdd'], small: ['B.B.', 'BdBd', '.BBd', '..Bd'] } }],
    kevin: [{ id: 'hair', label: 'grey hair', kind: 'hair', draw: { mode: 'fringe', sides: true } }],
    sarutobi: [{ id: 'tail', label: 'tail', kind: 'tail' }], /* ears removed Oct 22 (owner); the tail stays */
    doge: [{ id: 'ears', label: 'ears', kind: 'top', pair: true, onTop: true }],
    lenny: [{ id: 'eyes', label: 'smug eyes', kind: 'eyes' }],
    nakamoto: [{ id: 'glasses', label: 'wire glasses', kind: 'eyes' }],
    kek: [{ id: 'nemes', label: 'nemes headdress', kind: 'top', keep: true }],
    wizard: [{ id: 'hat', label: 'hat', kind: 'top', hat: true }],
    funtrump: [{ id: 'hair', label: 'windblown hair', kind: 'top', keep: true }]
  };
  /* PART ELIGIBILITY (owner rules Oct 22): [one-eye rule for Dodo was added then REMOVED the same night; ONE_EYED is empty]; KEVIN's hair never goes on Pepe or Peepo (it covers their eye domes).
   * Fallback: the donor's list is filtered BEFORE the parts-stream draw, so the stream picks among the donor's remaining parts; if none remain, that
   * donor gives no body part (colour/shape mix only). Same rule for the LEGENDARY MIX third donor. */
  var EYE_DOME_BODIES = { pepe: 1, peepo: 1 }, ONE_EYED = {} /* one-eye rule REMOVED Oct 22 1:30 AM CT (owner): Dodo takes every eye part again, drawn as before */, PART_EXCLUDE = { 'kevin:hair': { pepe: 1, peepo: 1 } };
  function partOk(body, sp, d) { if (ONE_EYED[body] && d.kind === 'eyes') return false; if (sp === 'chud' && d.id === 'beard' && (BEARD_EXCLUDE[body] || BEARD_PART_EXCLUDE[body])) return false; var ex = PART_EXCLUDE[sp + ':' + d.id]; return !(ex && ex[body]); }
  var CHUD_BEARD_PART = { id: 'beard', label: 'beard', kind: 'face' };
  var BEARD_PART_EXCLUDE = { dodo: 1, snibby: 1, sarutobi: 1, kek: 1, wizard: 1, funtrump: 1 }; /* owner Oct 22 ~9:37 AM CT: the beard renders weakly there (Dodo all stages, Snibby 3-4, Sarutobi 4; Lord Kek and Bitcoin Wizard bodies use their own sprite renderers, so the beard would not draw at all) -> these bodies never get the beard PART (whole body, so no half beards). Gear rules unchanged. */
  function partsFor(body, sp, blk) { var L = (HYBRID_PARTS[sp] || []).slice(); if (sp === 'chud' && beardPartOn(blk === undefined ? ELIG_B : blk)) L.push(CHUD_BEARD_PART);
    return L.filter(function (d) { return partOk(body, sp, d); }); }
  function hybridParts(hex, plan, blk) { var R = stream('XCPETS:v2:hybrid-parts:' + hex), out = [];
    plan.roots.filter(function (sp) { return sp !== plan.shape; }).forEach(function (sp) { var L = partsFor(plan.shape, sp, blk); if (!L.length) return;
      var i = R() % L.length; out.push({ sp: sp, part: L[i].id }); if (L.length > 1 && R() % 2 === 0) out.push({ sp: sp, part: L[1 - i].id }); });
    return out; }
  function partDef(sp, id) { if (sp === 'chud' && id === 'beard') return CHUD_BEARD_PART; return (HYBRID_PARTS[sp] || []).filter(function (d) { return d.id === id; })[0] || null; }
  function partLabel(q) { var d = partDef(q.sp, q.part); return speciesLabel(q.sp) + '\u2019s ' + (d ? d.label : q.part); }
  var GROUND_ROW = 29;
  function silOf(k) { var s = []; for (var j = 0; j < 1024; j++) s[j] = (j >> 5) < GROUND_ROW && !(k.data[j * 4] === 255 && k.data[j * 4 + 1] === 0 && k.data[j * 4 + 2] === 255); return s; }
  function bbOf(s) { var b = { t: 32, b: -1, l: 32, r: -1 }; for (var j = 0; j < 1024; j++) if (s[j]) { var x = j & 31, y = j >> 5; b.t = Math.min(b.t, y); b.b = Math.max(b.b, y); b.l = Math.min(b.l, x); b.r = Math.max(b.r, x); } b.h = b.b - b.t + 1; b.w = b.r - b.l + 1; return b; }
  function bbList(L) { var s = []; L.forEach(function (j) { s[j] = true; }); return bbOf(s); }
  function runsOf(s, y) { var R2 = [], a = -1; for (var x = 0; x <= 32; x++) { var on = x < 32 && s[y * 32 + x]; if (on && a < 0) a = x; if (!on && a >= 0) { R2.push([a, x - 1]); a = -1; } } return R2; }
  function medianOf(a) { var b = a.slice().sort(function (p, q) { return p - q; }); return b.length ? b[b.length >> 1] : 0; }
  function edgeAt(s, y, side) { var r = -1; for (var x = 0; x < 32; x++) if (s[y * 32 + x]) { if (side < 0) return x; r = x; } return r; }
  var EYE_KEYS = { eye: 1, pupil: 1, white: 1, brow: 1, frame: 1, lens: 1 }, SKIN_KEYS = { body: 1, belly: 1 };
  /** anatomy(keys): regions of a keyed sprite (keys = PetCore.render(..., { withKeys: true }).keys). Returns pixel lists per region kind. */
  function anatomy(keys) { var s = [], j; for (j = 0; j < 1024; j++) s[j] = !!keys[j] && (j >> 5) < GROUND_ROW; var bb = bbOf(s), A = { s: s, bb: bb, keys: keys }; if (bb.b < 0) return A;
    var mTop = 99; for (j = 0; j < 1024; j++) if (s[j] && keys[j] === 'mouth') { mTop = j >> 5; break; }
    var eyeL = []; for (j = 0; j < 1024; j++) if (s[j] && EYE_KEYS[keys[j]] && (j >> 5) < mTop - 1) eyeL.push(j); /* mouth whites/teeth are not eyes */
    var eb = eyeL.length ? bbList(eyeL) : null; A.eyeBox = eb;
    /* forked top: rows from the top while split in 2+ runs */
    var top = [], yTopMax = bb.t + Math.ceil(bb.h * 0.4); if (eb) yTopMax = Math.min(yTopMax, eb.b + 1); for (var y = bb.t; y < yTopMax; y++) { var rr = runsOf(s, y); if (rr.length < 2) break; rr.forEach(function (q) { for (var x = q[0]; x <= q[1]; x++) top.push(y * 32 + x); }); }
    /* drop forked-top pieces that carry eyes (eye stalks, eye domes): those belong to the eyes */
    (function () { var on = {}, seen = {}, keep = []; top.forEach(function (q) { on[q] = 1; });
      top.forEach(function (q0) { if (seen[q0]) return; var comp = [], st = [q0], eyeish = false; seen[q0] = 1;
        while (st.length) { var c = st.pop(); comp.push(c); if (EYE_KEYS[keys[c]] || (eb && (c >> 5) >= eb.t - 1 && (c & 31) >= eb.l && (c & 31) <= eb.r)) eyeish = true;
          [c - 1, c + 1, c - 32, c + 32, c + 64].forEach(function (n) { if (n >= 0 && n < 1024 && on[n] && !seen[n] && Math.abs((n & 31) - (c & 31)) <= 1) { seen[n] = 1; st.push(n); } }); }
        /* a piece is eye-ish if it touches the eye box from above (stalk) */
        if (eb && comp.some(function (c) { var b2 = c + 32; return b2 < 1024 && EYE_KEYS[keys[b2]]; })) eyeish = true;
        if (!eyeish) keep = keep.concat(comp); }); A.eyeTop = top.filter(function (q) { return keep.indexOf(q) < 0; }); top = keep; })();
    A.top = top; var topOn = {}; top.forEach(function (q) { topOn[q] = 1; });
    if (eb) { var E = []; for (j = 0; j < 1024; j++) { var xj = j & 31, yj = j >> 5; if (!s[j] || xj < eb.l - 1 || xj > eb.r + 1 || yj < eb.t - 2 || yj > eb.b + 1) continue; if (EYE_KEYS[keys[j]] || ((keys[j] === 'ink' || keys[j] === 'tear') && yj <= eb.b + 1)) E.push(j); }
      var domes = (A.eyeTop || []).filter(function (q) { var xq = q & 31; return xq >= eb.l && xq <= eb.r && eb.t - (q >> 5) <= 3; }); A.eyes = E.concat(domes); A.eyeDomes = domes; } else A.eyes = [];
    var mk = []; for (j = 0; j < 1024; j++) if (s[j] && keys[j] === 'mouth') mk.push(j); A.mouthKey = mk;
    if (mk.length) { var mb = bbList(mk), on = {}, q2 = mk.slice(); mk.forEach(function (q) { on[q] = 1; });
      while (q2.length) { var c = q2.pop(); [c - 1, c + 1, c - 32, c + 32].forEach(function (n) { if (n < 0 || n >= 1024 || on[n] || !s[n] || Math.abs((n & 31) - (c & 31)) > 1) return; var k = keys[n], xn = n & 31, yn = n >> 5;
          if (k === 'body' || EYE_KEYS[k] || topOn[n] || yn < mb.t - 2 || yn > mb.b + 1 || (yn > mb.b && k !== 'ink') || xn < mb.l - 8 || xn > mb.r + 8) return; on[n] = 1; q2.push(n); }); }
      A.mouth = Object.keys(on).map(Number); A.mouthBox = mb; } else A.mouth = [];
    /* hair keys: species keys (not skin/eye/mouth/accent/ink) touching the top two rows */
    var hk = {}; for (j = 0; j < 1024; j++) { var k2 = keys[j]; if (s[j] && (j >> 5) <= bb.t + 1 && /^sp\d$/.test(k2)) hk[k2] = 1; }
    A.hair = []; for (j = 0; j < 1024; j++) if (s[j] && hk[keys[j]] && (!eb || (j >> 5) < eb.b + 1 || (j & 31) < eb.l || (j & 31) > eb.r)) A.hair.push(j);
    /* side bumps: pixels outside the body core (75th/25th percentile row edges) */
    var Ls = [], Rs = []; for (var y2 = bb.t; y2 <= bb.b; y2++) { var r2 = runsOf(s, y2); if (r2.length) { Ls.push(r2[0][0]); Rs.push(r2[r2.length - 1][1]); } }
    var qt = function (a, f) { var b = a.slice().sort(function (p, q) { return p - q; }); return b[Math.min(b.length - 1, Math.floor(b.length * f))]; }, cl = qt(Ls, 0.75), cr = qt(Rs, 0.25);
    A.core = [cl, cr];
    var band = function (f0, f1, left, right) { var y0 = bb.t + Math.floor(f0 * bb.h), y1 = bb.t + Math.ceil(f1 * bb.h) - 1, out = [];
      for (var j3 = 0; j3 < 1024; j3++) { var x3 = j3 & 31, y3 = j3 >> 5; if (!s[j3] || topOn[j3] || y3 < y0 || y3 > y1) continue; if (left && x3 < cl - 1) out.push(j3); else if (right && x3 > cr + 1) out.push(j3); } return out; };
    var headB = eb ? Math.min(0.6, (eb.b + 3 - bb.t) / bb.h) : 0.5;
    var grow = function (L) { var on = {}; L.forEach(function (q) { on[q] = 1; }); var st = L.slice();
      while (st.length) { var c = st.pop(); [c - 1, c + 1, c - 32, c + 32].forEach(function (n) { if (n < 0 || n >= 1024 || on[n] || !s[n] || topOn[n] || Math.abs((n & 31) - (c & 31)) > 1 || keys[n] !== keys[c]) return; var xn = n & 31; if (xn >= cl && xn <= cr) return; on[n] = 1; st.push(n); }); }
      return Object.keys(on).map(Number); };
    A.ears = band(0.05, headB, true, true); A.arms = grow(band(headB, 0.95, true, true)); A.ears = A.ears.filter(function (q) { return A.arms.indexOf(q) < 0; }); A.tail = band(0.45, 1, true, false).filter(function (q) { return A.arms.indexOf(q) < 0 || (q & 31) < cl - 2; });
    return A; }
  /** eyeMaskOf(sp, art, o): every pixel that is part of the body's EYES = pixels that change when only the eye style changes (classic / beady /
   * tinted / star / laser) on the bare body. Catches eyes the colour keys miss (Pepe's Elder lids, Peepo's domes). Kek / Wizard: eye keys only. */
  var EYE_MASK_CACHE = {};
  function eyeMaskOf(sp, art, o) { var ck0 = sp + '|' + (o.stage == null ? 3 : o.stage) + '|' + (o.frame || 0); if (EYE_MASK_CACHE[ck0]) return EYE_MASK_CACHE[ck0]; var m = EYE_MASK_CACHE[ck0] = {}; if (sp === 'kek' || sp === 'wizard' || sp === 'funtrump' || !PetCore.EYES) return m;
    var L = PetCore.EYES.map(function (e) { var a = Object.assign({}, art, { species: sp, hybrid: null, eyes: e.id, background: 'solid', bgColor: '#ff00ff', pattern: 'none', cheeks: false, band: 'none', armor: 'none', cape: 'none', weapon: 'none', crown: 'none' }); return PetCore.render(a, Object.assign({}, o, { gearCap: 0, gearOverride: null })).data; });
    for (var j = 0; j < 1024; j++) for (var i = 1; i < L.length; i++) if (L[i][j * 4] !== L[0][j * 4] || L[i][j * 4 + 1] !== L[0][j * 4 + 1] || L[i][j * 4 + 2] !== L[0][j * 4 + 2]) { m[j] = 1; break; }
    return m; }
  function keyedRender(sp, art, o) { var a = Object.assign({}, art, { species: sp, hybrid: null, eyes: PetCore.EYES[0].id, background: 'solid', bgColor: '#ff00ff', pattern: 'none', cheeks: false, band: 'none', armor: 'none', cape: 'none', weapon: 'none', crown: 'none' });
    if (sp === 'kek') { var r = renderRoot(a, o); var ks = []; for (var j = 0; j < 1024; j++) ks[j] = r.data[j * 4] === 255 && r.data[j * 4 + 1] === 0 && r.data[j * 4 + 2] === 255 ? undefined : 'body'; r.keys = ks;
      /* the nemes headdress (cap, uraeus and brow band): found by re-rendering with marker colours for the nemes inks, above the brow band, inside the head width */
      var mk = renderRoot(a, o, { B: '#fe0101', b: '#fe0202', y: '#fe0303', o: '#fe0404' }), isN = function (q) { return mk.data[q * 4] === 254 && mk.data[q * 4 + 1] === mk.data[q * 4 + 2] && mk.data[q * 4 + 1] >= 1 && mk.data[q * 4 + 1] <= 4 && Math.abs((q & 31) - 15.5) < 9.5; };
      var nem = [], started = false; for (var y = 0; y < GROUND_ROW; y++) { var row = []; for (var x = 0; x < 32; x++) if (isN(y * 32 + x)) row.push(y * 32 + x); if (row.length >= 8) started = true; else if (started) break; nem = nem.concat(row); }
      r.parts = { top: started ? nem : [], topSkin: true, headBox: started ? bbList(nem.filter(function (q) { return Math.abs((q & 31) - 15.5) < 9; })) : null }; return r; }
    if (sp === 'funtrump' && ftSprite()) { /* FUNTRUMP: his hair = the hair-key pixels (2-5) found with marker colours, above the face */
      var fr = renderRoot(a, o), fk = []; for (var q2 = 0; q2 < 1024; q2++) fk[q2] = fr.data[q2 * 4] === 255 && fr.data[q2 * 4 + 1] === 0 && fr.data[q2 * 4 + 2] === 255 ? undefined : 'body'; fr.keys = fk;
      var fm = renderRoot(a, o, { '2': '#fe0101', '3': '#fe0202', '4': '#fe0303', '5': '#fe0404' }), hair = [];
      for (var q3 = 0; q3 < 1024; q3++) if ((q3 >> 5) < 22 && fm.data[q3 * 4] === 254 && fm.data[q3 * 4 + 1] === fm.data[q3 * 4 + 2] && fm.data[q3 * 4 + 1] >= 1 && fm.data[q3 * 4 + 1] <= 4) hair.push(q3);
      fr.parts = { top: hair, topSkin: true, headBox: hair.length ? bbList(hair) : null }; return fr; }
    if (sp === 'wizard' && wizSprite()) { /* the Wizard's hat: the pixels that change when he wears it */ var WS = wizSprite(), w0 = renderWizRoot(a, Object.assign({}, o, { wizGear: {} })), w1 = renderWizRoot(a, Object.assign({}, o, { wizGear: { head: WS.WIZARD_HAT } })), kw = [], hat = [];
      var bgw = function (d, q) { return d[q * 4] === 255 && d[q * 4 + 1] === 0 && d[q * 4 + 2] === 255; };
      for (var q = 0; q < 1024; q++) { kw[q] = bgw(w1.data, q) ? undefined : 'body'; if (!bgw(w1.data, q) && (q >> 5) < GROUND_ROW && (bgw(w0.data, q) || [0, 1, 2].some(function (c) { return w0.data[q * 4 + c] !== w1.data[q * 4 + c]; }))) hat.push(q); }
      w1.keys = kw; w1.parts = { top: hat }; return w1; }
    return PetCore.render(a, Object.assign({}, o, { gearCap: 0, gearOverride: null, withKeys: true })); }
  /** scaled(list, k, anchor): nearest-neighbour scale of a pixel list about its bbox anchor ([ax, ay] in 0..1). Returns [{ j: target, s: source }]. */
  function scaled(list, k, anc) { var b = bbList(list), on = {}; list.forEach(function (q) { on[q] = 1; }); if (Math.abs(k - 1) < 0.08) return list.map(function (q) { return { t: q, s: q }; });
    var W = Math.max(1, Math.round(b.w * k)), H = Math.max(1, Math.round(b.h * k)), ox = b.l + (b.w - W) * anc[0], oy = b.t + (b.h - H) * anc[1], out = [];
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) { var sx = b.l + Math.min(b.w - 1, Math.floor(x / k)), sy = b.t + Math.min(b.h - 1, Math.floor(y / k)), sj = sy * 32 + sx; if (on[sj]) out.push({ t: Math.round(oy + y) * 32 + Math.round(ox + x), s: sj }); }
    return out; }
  var INK = [26, 16, 32];
  function shadeRgb(c, k) { return c.map(function (n) { return Math.max(0, Math.min(255, Math.round(n * k))); }); }
  function topColour(data, list) { var n = {}; list.forEach(function (q) { var c = [data[q * 4], data[q * 4 + 1], data[q * 4 + 2]].join(','); n[c] = (n[c] || 0) + 1; }); var b = Object.keys(n).sort(function (p, q) { return n[q] - n[p]; })[0]; return b ? b.split(',').map(Number) : [128, 128, 128]; }
  /** drawPart(def, kF, DA, D, small): REDRAWS a donor part from a small drawing in the donor's own palette, at the donor's own part position
   * (so the normal placement rules apply), for parts whose sprite pixels do not read on their own. Returns { kF, D }. */
  function drawPart(def, kF, DA, D, small) { var dr = def.draw, data = new Uint8ClampedArray(kF.data), out = [];
    var bodyL = []; for (var j = 0; j < 1024; j++) if (DA.s[j] && kF.keys[j] === 'body') bodyL.push(j); var B = topColour(kF.data, bodyL);
    var pal = { B: B, d: shadeRgb(B, 0.55), n: INK, w: [244, 244, 238], p: [26, 16, 32] };
    var put = function (q, c) { if (q < 0 || q >= 1024) return; data[q * 4] = c[0]; data[q * 4 + 1] = c[1]; data[q * 4 + 2] = c[2]; data[q * 4 + 3] = 255; if (out.indexOf(q) < 0) out.push(q); };
    var stamp = function (rows, x0, y0) { rows.forEach(function (r, yy) { for (var xx = 0; xx < r.length; xx++) { var ch = r[xx]; if (ch === '.') continue; var x = x0 + xx, y = y0 + yy; if (x < 0 || x > 31 || y < 0 || y >= GROUND_ROW) continue; put(y * 32 + x, pal[ch]); } }); };
    var mirror = function (rows) { return rows.map(function (r) { return r.split('').reverse().join(''); }); };
    if (dr.mode === 'fringe') { if (D.length < 2) return { kF: kF, D: D }; var hc = topColour(kF.data, D), hl = shadeRgb(hc, 1.0).map(function (n) { return Math.min(255, n + 70); }), b = bbList(D);
      var eyT = DA.eyeBox ? DA.eyeBox.t : b.b + 1, cols = {}; D.forEach(function (q) { var y = q >> 5, x = q & 31; if (y >= eyT) { cols[y] = cols[y] || [99, -1]; cols[y][0] = Math.min(cols[y][0], x); cols[y][1] = Math.max(cols[y][1], x); } });
      if (dr.sides) { /* long hair: a cap down to the eyes, a lighter fringe, then thin strands down the sides so the head shape shows */
        D.forEach(function (q) { var x = q & 31, y = q >> 5; if (y < eyT - 1) put(q, (x + y) % 4 === 0 ? hl : hc); else if (y === eyT - 1) { if (x % 3 !== 2) put(q, hl); }
          else { var c = cols[y]; if (!c) return; var side = x - c[0] <= 1 || c[1] - x <= 1; if (side && !(y === b.b && x % 2)) put(q, (y + (x - c[0] <= 1 ? 0 : 1)) % 2 ? hl : hc); } });
        return { kF: { data: data, keys: kF.keys }, D: out }; }
      D.forEach(function (q) { var x = q & 31, y = q >> 5; if (y === b.b && x % 2) return; if (y === b.b - 1 && b.h > 3 && x % 4 === 3) return; put(q, (y > b.t && y < b.b && (x + y) % 3 === 0) ? hl : hc); });
      return { kF: { data: data, keys: kF.keys }, D: out }; }
    var rows = small ? dr.small : dr.big, w = rows[0].length, hgt = rows.length, bb = DA.bb, cx = (bb.l + bb.r) / 2;
    if (dr.mode === 'pair') { var sides = [-1, 1].map(function (sd) { var L = D.filter(function (q) { return ((q & 31) < cx ? -1 : 1) === sd; }); return L.length ? bbList(L) : null; });
      sides.forEach(function (sb, i) { var sd = i ? 1 : -1, eb = DA.eyeBox;
        if (!sb) sb = dr.anchor === 'bottom' ? { l: sd < 0 ? bb.l + 1 : bb.r - w, r: sd < 0 ? bb.l + w : bb.r - 1, t: bb.t, b: bb.t } : eb ? { l: sd < 0 ? eb.l : (eb.l + eb.r) / 2 + 1, r: sd < 0 ? (eb.l + eb.r) / 2 - 1 : eb.r, t: eb.t, b: eb.b } : { l: cx + sd * 4 - 2, r: cx + sd * 4 + 2, t: bb.t + 4, b: bb.t + 6 };
        var x0 = Math.round((sb.l + sb.r) / 2 - (w - 1) / 2), y0 = dr.anchor === 'bottom' ? sb.b - hgt + 1 : Math.round((sb.t + sb.b) / 2 - (hgt - 1) / 2);
        stamp(sd < 0 ? rows : mirror(rows), x0, y0); }); }
    else { var tb = D.length ? bbList(D) : { l: bb.l, r: bb.l + 2, t: bb.t + Math.round(bb.h * 0.55), b: bb.t + Math.round(bb.h * 0.75) };
      stamp(rows, tb.r - w + 1, tb.b - hgt + 1); }
    return { kF: { data: data, keys: kF.keys }, D: out }; }
  /** applyParts(img, kS, h, o, art, feat): REPLACES the child's regions with the plan's traded parts (h.parts); returns the pixels painted. */
  var SIDE_FACING = { dodo: 1, doge: -1 }, TOPDBG = null; /* bodies drawn in profile: which way the mouth points */
  function applyParts(img, kS, h, o, art, feat) { var painted = []; TOPDBG = null;
    var ck = h.shape === 'kek' ? keyedRender('kek', art, o) : keyedRender(h.shape, art, o), CA = anatomy(ck.keys); if (CA.bb.b < 0) return painted; if (ck.parts) Object.assign(CA, ck.parts);
    var M = CA.s.slice(); (feat || []).forEach(function (q) { M[q] = true; }); var touched = {};
    var col = function (j) { return [img.data[j * 4], img.data[j * 4 + 1], img.data[j * 4 + 2]]; };
    var skinCount = {}; for (var j0 = 0; j0 < 1024; j0++) if (CA.s[j0] && ck.keys[j0] === 'body') { var c0 = col(j0).join(','); skinCount[c0] = (skinCount[c0] || 0) + 1; }
    if (!Object.keys(skinCount).length) for (var j9 = 0; j9 < 1024; j9++) if (CA.s[j9] && ck.keys[j9] !== 'ink' && !EYE_KEYS[ck.keys[j9]] && ck.keys[j9] !== 'mouth') { var c9 = col(j9).join(','); skinCount[c9] = (skinCount[c9] || 0) + 1; } /* no 'body' key (Nakamoto): the commonest face colour */
    var skin = (Object.keys(skinCount).sort(function (p, q) { return skinCount[q] - skinCount[p]; })[0] || '').split(',').map(Number);
    var isBgK = function (j) { return kS.data[j * 4] === 255 && kS.data[j * 4 + 1] === 0 && kS.data[j * 4 + 2] === 255; };
    var set = function (j, c) { img.data[j * 4] = c[0]; img.data[j * 4 + 1] = c[1]; img.data[j * 4 + 2] = c[2]; img.data[j * 4 + 3] = 255; };
    var orig = new Uint8ClampedArray(img.data);
    var bgAt = function (j) { if (isBgK(j)) return [orig[j * 4], orig[j * 4 + 1], orig[j * 4 + 2]]; for (var r = 1; r <= 5; r++) for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) { var x = (j & 31) + dx, y = (j >> 5) + dy; if (x < 0 || y < 0 || x > 31 || y > 31) continue; var n = y * 32 + x; if (isBgK(n)) return [orig[n * 4], orig[n * 4 + 1], orig[n * 4 + 2]]; } return [orig[j * 4], orig[j * 4 + 1], orig[j * 4 + 2]]; };
    var erase = function (list, toBg) { list.forEach(function (q) { touched[q] = 1; if (toBg) M[q] = false; else if (skin.length === 3) set(q, skin); }); };
    var paste = function (D, kF, pairs) { pairs.forEach(function (p) { var x = p.t & 31, y = p.t >> 5; if (p.t < 0 || p.t >= 1024 || x < 0 || y >= GROUND_ROW) return; M[p.t] = true; touched[p.t] = 1; set(p.t, [kF.data[p.s * 4], kF.data[p.s * 4 + 1], kF.data[p.s * 4 + 2]]); painted.push(p.t); }); };
    var shift = function (pairs, dx, dy) { return pairs.filter(function (p) { var x = (p.t & 31) + dx; return x >= 0 && x < 32; }).map(function (p) { return { t: p.t + dy * 32 + dx, s: p.s }; }); };
    var clampK = function (k, lo, hi) { return Math.max(lo, Math.min(hi, k)); };
    var faceOf = function () { if (!CA.mouthBox) return 0; var mb = CA.mouthBox, tx = (mb.l + mb.r) / 2, rr = runsOf(CA.s, Math.round((mb.t + mb.b) / 2)); if (!rr.length) return 0; var c0 = (rr[0][0] + rr[rr.length - 1][1]) / 2, hw = (rr[rr.length - 1][1] - rr[0][0]) / 2; return Math.abs(tx - c0) < hw * 0.35 ? 0 : tx < c0 ? -1 : 1; }, facing = SIDE_FACING[h.shape] != null ? SIDE_FACING[h.shape] : 0; void faceOf; /* where the child's own mouth is: 0 = front, -1 = left (Doge), 1 = right (Dodo) */
    var stg = o.stage == null ? 3 : o.stage, mg = stg >= 4 ? 3 : 2; /* frame margin: the part + its ink outline (+ the Elder/Mythic rim) stay inside the frame */
    /* a head-top or ear part in (nearly) the child's own colour gets contrast: a darker inside and an ink line where it meets the head */
    var contrastPart = function (L) { if (!L.length || skin.length !== 3) return; var on = {}; L.forEach(function (t) { on[t] = 1; });
      var near = L.filter(function (t) { return Math.abs(img.data[t * 4] - skin[0]) + Math.abs(img.data[t * 4 + 1] - skin[1]) + Math.abs(img.data[t * 4 + 2] - skin[2]) < 90; }); if (near.length < L.length * 0.25) return;
      near.forEach(function (t) { var inner = [t - 1, t + 1, t - 32, t + 32].every(function (n) { return n >= 0 && n < 1024 && M[n]; }) ; if (inner) set(t, shadeRgb([img.data[t * 4], img.data[t * 4 + 1], img.data[t * 4 + 2]], 0.62)); });
      L.forEach(function (t) { var n = t + 32; if (n < 1024 && !on[n] && M[n] && CA.s[n]) { set(n, INK); touched[n] = 1; } }); };
    var noRestore = {}; (h.parts || []).forEach(function (q) { var p0 = painted.length, kd0 = (partDef(q.sp, q.part) || {}).kind; placeOne(q); if (kd0 === 'eyes' || kd0 === 'mouth') painted.slice(p0).forEach(function (t) { noRestore[t] = 1; }); var df0 = partDef(q.sp, q.part) || {}; if ((kd0 === 'top' || kd0 === 'ears') && !df0.draw && !df0.keep) contrastPart(painted.slice(p0)); });
    /* WIZARD HAT, redrawn to fit THIS head: brim as wide as the head (+1 each side) resting on the top outline, a floppy blue cone, gold band, tip flopping over; never over the eyes */
    function drawHat(kF, D) { var hat = D.filter(function (q) { var r = kF.data[q * 4], g = kF.data[q * 4 + 1], b = kF.data[q * 4 + 2]; return b > r + 30 && b > g; }), BL = topColour(kF.data, hat.length ? hat : D), GD = [255, 210, 63];
      var Mh = bbOf(M), eyeL = CA.eyeBox ? CA.eyeBox.t : Mh.t + Math.round(Mh.h * 0.4), colTop = function (x) { for (var y = 0; y < GROUND_ROW; y++) if (M[y * 32 + x]) return y; return -1; };
      var hl = CA.headBox ? CA.headBox.l : Mh.l, hr = CA.headBox ? CA.headBox.r : Mh.r; if (CA.core) { hl = Math.max(hl, CA.core[0] - 1); hr = Math.min(hr, CA.core[1] + 1); }
      var hc = Math.round((hl + hr) / 2), tops = []; for (var x = hl; x <= hr; x++) { var t = colTop(x); if (t >= 0) tops.push(t); } tops.sort(function (a, b) { return a - b; });
      var yH = tops.length ? tops[Math.floor(tops.length * 0.3)] : Mh.t, yb = Math.min(yH + 1, eyeL - 2), minUp = Math.min(6, Math.max(3, Math.round((hr - hl) * 0.4))); if (yb - mg < minUp) yb = Math.min(eyeL - 1, mg + minUp);
      var rw = runsOf(M, Math.min(GROUND_ROW - 1, yb + 1)), wl = rw.length ? Math.max(hl, rw[0][0]) : hl, wr = rw.length ? Math.min(hr, rw[rw.length - 1][1]) : hr;
      var bl = Math.max(mg, wl - 1), br = Math.min(31 - mg, wr + 1), W = br - bl + 1, Hc = Math.max(3, Math.min(yb - 1, Math.max(Math.round(W * 0.7), 5))), sd = facing ? -facing : 1, ON = {};
      var put = function (x, y, c) { if (x < mg || x > 31 - mg || y < 0 || y >= GROUND_ROW) return; var t = y * 32 + x; M[t] = true; touched[t] = 1; set(t, c); painted.push(t); ON[t] = 1; };
      var dk = shadeRgb(BL, 0.7), lt = shadeRgb(BL, 1.25).map(function (n) { return Math.min(255, n + 25); });
      for (var x1 = bl; x1 <= br; x1++) put(x1, yb, x1 === bl || x1 === br ? dk : BL); /* brim */
      var cw0 = Math.max(3, W - 4), tipX = hc;
      for (var i = 1; i <= Hc; i++) { var f = i / Hc, cw = Math.max(1, Math.round(cw0 * (1 - f * 0.85))), off = Math.round(sd * f * f * W * 0.3), c0 = hc + off - Math.floor(cw / 2);
        for (var x2 = c0; x2 < c0 + cw; x2++) put(x2, yb - i, i === 1 ? GD : (x2 - c0 >= cw * 0.6 ? dk : (x2 === c0 ? lt : BL))); tipX = hc + off; }
      put(tipX + sd, yb - Hc + 1, BL); put(tipX + 2 * sd, yb - Hc + 2, dk); /* the floppy tip hangs over */
      if (Hc >= 5) put(hc + Math.round(sd * 0.2 * W * 0.3) - 1, yb - Math.round(Hc * 0.55), GD); /* a star */
      TOPDBG = { eyeL: eyeL, hat: true, pieces: [{ l: bl, r: br, t: yb - Hc, b: yb }], head: [wl, wr] }; }
    function placeOne(q) { var def = partDef(q.sp, q.part); if (!def || !partOk(h.shape, q.sp, def)) return; if (def.kind === 'face') return; /* Chud beard part: drawn by V2Render.drawBeard on the finished face */
      /* young pets take the donor's ADULT part, scaled to their size, so hatchlings show a readable part too */
      var kF = keyedRender(q.sp, art, stg <= 2 ? Object.assign({}, o, { stage: 3 }) : o), DA = anatomy(kF.keys); if (DA.bb.b < 0) return; if (kF.parts) Object.assign(DA, kF.parts);
      var D = DA[def.kind] || [], small = CA.bb.h < 15, kAd = stg <= 2 && !def.draw ? clampK(CA.bb.h / DA.bb.h * 1.1, 0.55, 1) : 1;
      if (def.draw && def.kind === 'tail' && def.draw.big) { var lx = 32; for (var yq = CA.bb.t + Math.round(CA.bb.h * 0.45); yq <= CA.bb.b; yq++) { var eq = edgeAt(CA.s, yq, -1); if (eq >= 0) lx = Math.min(lx, eq); } }
      if (def.draw) { var dP = drawPart(def, kF, DA, D, small); kF = dP.kF; D = dP.D; } if (D.length < 2) return;
      var db = bbList(D), sb = CA.bb, kind = def.kind, pairs, dx, dy;
      if (kind === 'eyes' || kind === 'mouth' || kind === 'hair') {
        var C = CA[kind] || [], cb = C.length ? bbList(C) : null;
        if (kind === 'hair' && CA.headBox) erase(CA.top, false); /* Lord Kek: the nemes comes off, his bare head stays */
        else if (kind === 'hair') { erase(C.filter(function (q) { return !CA.top.length || CA.top.indexOf(q) < 0; }), false); erase(CA.top, true); }
        else { erase(C.filter(function (q) { return CA.eyeDomes && CA.eyeDomes.indexOf(q) >= 0; }), kind !== 'eyes'); erase(C.filter(function (q) { return !CA.eyeDomes || CA.eyeDomes.indexOf(q) < 0; }), false); }
        var headW = function (y) { var r = runsOf(CA.s, Math.max(sb.t, Math.min(sb.b, y))); return r.length ? r[r.length - 1][1] - r[0][0] + 1 : sb.w; };
        var k = kind === 'hair' ? clampK(headW(sb.t + 2) / Math.max(1, headW.call(null, sb.t + 2) && DA.bb.w), 0.7, 1.25) : 1;
        var hB = CA.headBox || sb; if (kind === 'hair') k = clampK((hB.w) / DA.bb.w, 0.7, 1.25);
        if (kind === 'mouth' && kAd < 1) k = kAd; if (kind === 'mouth' && facing !== 0 && stg >= 3 && !def.draw) k = 1.35; /* a beak in profile needs some size to read */
        if (kind === 'eyes') { var room = headW(cb ? Math.round((cb.t + cb.b) / 2) : sb.t + Math.round(sb.h * 0.35)) - 2; k = db.w > room ? clampK(room / db.w, 0.55, 1) : (cb ? clampK(Math.min(cb.w / db.w, room / db.w), 1, 1.6) : 1); if (kAd < 1) k = Math.min(k, kAd); if (def.draw) k = Math.min(k, 1); }
        pairs = scaled(D, k, [0.5, kind === 'hair' ? 0 : 0.5]); var pb = bbList(pairs.map(function (p) { return p.t; }));
        if (kind === 'hair') { dx = Math.round((hB.l + hB.r) / 2 - (pb.l + pb.r) / 2); dy = Math.max(mg - pb.t, hB.t - pb.t); }
        else if (kind === 'mouth') { var dm = bbList(DA.mouthKey), tx = cb ? (CA.mouthBox.l + CA.mouthBox.r) / 2 : (sb.l + sb.r) / 2, ty = cb ? (CA.mouthBox.t + CA.mouthBox.b) / 2 : CA.headBox ? CA.headBox.b + 4 : sb.t + sb.h * 0.55;
          dx = Math.round(tx - (dm.l + dm.r) / 2); dy = Math.round(ty - (dm.t + dm.b) / 2);
          /* a mouth part that sticks out of the donor's head (a beak) sticks out of the child's head the same way, from the same side */
          var my = Math.round((dm.t + dm.b) / 2), hR = -1, hL = 99, Don = {}; D.forEach(function (q) { Don[q] = 1; }); for (var x5 = 0; x5 < 32; x5++) { var j5 = my * 32 + x5; if (DA.s[j5] && !Don[j5]) { hL = Math.min(hL, x5); hR = Math.max(hR, x5); } }
          var front = facing === 0; /* every body not drawn in profile is front-facing */
          /* a front-facing pet gets the part right on its own mouth; a side-facing one gets it sticking out of the face edge */
          if (!front && facing !== 0 && def.side && cb) { /* profile pet: a side-view beak, base on the face edge at its mouth, tip pointing away (Doge: left) */
            var accS = D.filter(function (q) { return kF.keys[q] === 'accent'; }), AS = topColour(kF.data, accS.length ? accS : D), rowsS = CA.bb.h < 15 ? def.side.small : CA.bb.h >= 21 && def.side.huge ? def.side.huge : def.side.big, swd = rowsS[0].length;
            if (facing < 0) rowsS = rowsS.map(function (r) { return r.split('').reverse().join(''); });
            var spal = { A: AS, h: shadeRgb(AS, 1.3).map(function (n) { return Math.min(255, n + 40); }), d: shadeRgb(AS, 0.5), n: INK }, yS = Math.round(ty) - 1, ceS = edgeAt(M, Math.max(sb.t, Math.min(sb.b, Math.round(ty))), facing);
            var xS = facing > 0 ? ceS : ceS - swd + 1; xS = Math.max(mg, Math.min(31 - mg - swd + 1, xS));
            rowsS.forEach(function (r, yy) { for (var xx = 0; xx < swd; xx++) { var ch = r[xx]; if (ch === '.') continue; var t = (yS + yy) * 32 + xS + xx; if (t < 0 || t >= 1024) continue; M[t] = true; touched[t] = 1; set(t, spal[ch]); painted.push(t); } }); return; }
          if (front && def.front) { /* front-facing pet: the beak seen from the front (a drawing in the donor's beak colours), right on its mouth */
            var accL = D.filter(function (q) { return kF.keys[q] === 'accent'; }), A3 = topColour(kF.data, accL.length ? accL : D), rowsF = CA.bb.h < 15 ? def.front.small : def.front.big, fw = rowsF[0].length, x0 = Math.round(tx - (fw - 1) / 2), y0 = Math.round(ty) - 1, fOn = {}, fL = [];
            var fpal = { A: A3, h: shadeRgb(A3, 1.3).map(function (n) { return Math.min(255, n + 40); }), d: shadeRgb(A3, 0.6) };
            rowsF.forEach(function (r, yy) { for (var xx = 0; xx < fw; xx++) { var ch = r[xx]; if (ch === '.') continue; var t = (y0 + yy) * 32 + x0 + xx; if (t < 0 || t >= 1024) continue; fOn[t] = 1; fL.push(t); M[t] = true; touched[t] = 1; set(t, fpal[ch]); painted.push(t); } });
            fL.forEach(function (t) { [t + 1, t - 1, t + 32, t - 32].forEach(function (n) { if (n >= 0 && n < 1024 && !fOn[n] && CA.s[n]) { set(n, INK); touched[n] = 1; } }); }); return; }
          if (front) { dx = Math.round(tx - (pb.l + pb.r) / 2); dy = Math.round(ty - (pb.t + pb.b) / 2); }
          else if (db.r > hR + 1 || db.l < hL - 1) { var dside = db.r - hR >= hL - db.l ? 1 : -1, side = facing || dside, L0 = Math.round((dside > 0 ? db.r - hR : hL - db.l) * k);
            /* the part points the way the CHILD faces: mirrored when the donor faces the other way (Dodo's beak on Doge points left) */
            if (side !== dside) pairs = pairs.map(function (p) { var x = p.t & 31; return { t: p.t - x + (pb.l + pb.r - x), s: p.s }; });
            var cy0 = Math.round(ty), ce = edgeAt(CA.s, Math.max(sb.t, Math.min(sb.b, cy0)), side); if (ce >= 0) { dx = side > 0 ? ce + L0 - pb.r : ce - L0 - pb.l; dy = cy0 - Math.round((pb.t + pb.b) / 2);
              var touches = function () { return pairs.some(function (p) { var t = p.t + dy * 32 + dx; return [t - 1, t + 1, t - 32, t + 32].some(function (n) { return n >= 0 && n < 1024 && M[n]; }) || M[t]; }); };
              for (var tries = 0; tries < 5 && !touches(); tries++) dx -= side; /* never float off the face */ } } dx = Math.max(mg - pb.l, Math.min(31 - mg - pb.r, dx)); }
        else { var ex = cb ? (cb.l + cb.r) / 2 : (sb.l + sb.r) / 2, ey = cb ? (cb.b) : sb.t + sb.h * 0.4, eb2 = bbList(pairs.filter(function (p) { return !DA.eyeDomes || DA.eyeDomes.indexOf(p.s) < 0; }).map(function (p) { return p.t; }).concat([pb.l + pb.b * 32]));
          dx = Math.round(ex - (pb.l + pb.r) / 2); dy = Math.round(ey - eb2.b); }
        var sh2 = shift(pairs, dx, dy); paste(D, kF, sh2);
        if (kind === 'mouth') { var on2 = {}; sh2.forEach(function (p) { on2[p.t] = 1; }); sh2.forEach(function (p) { [p.t + 1, p.t - 1, p.t + 32, p.t - 32].forEach(function (n) { if (n >= 0 && n < 1024 && !on2[n] && CA.s[n] && M[n]) { set(n, INK); touched[n] = 1; } }); }); } /* a part laid over the face gets its own ink outline */
        return; }
      /* bumps: top / ears / arms / tail */
      if (kind === 'top' && CA.topSkin) { var tw = {}; (CA.top || []).forEach(function (q) { tw[q >> 5] = (tw[q >> 5] || 0) + 1; }); erase((CA.top || []).filter(function (q) { return tw[q >> 5] >= 5; }), false); erase((CA.top || []).filter(function (q) { return tw[q >> 5] < 5; }), true);
        var capT = Math.min.apply(null, (CA.top || []).filter(function (q) { return tw[q >> 5] >= 5; }).map(function (q) { return q >> 5; }).concat([99])), stray = []; for (var js0 = 0; js0 < capT * 32; js0++) if (CA.s[js0]) stray.push(js0); erase(stray, true); }
      else if (kind === 'top' && EYE_DOME_BODIES[h.shape]) { /* Pepe / Peepo: the forked 'top' of the head IS the pair of eye domes; erasing it deleted the eyes (owner Oct 22 1:27 AM: 'completely missing eyes'
        * with Bobo ears / Mumu horns). Nothing is erased: the part sits on top of the domes (onTop lift keeps it off the eye pixels). */ }
      else erase(CA[kind] || [], true);
      if (kind === 'top' && def.hat) { drawHat(kF, D); return; }
      var onTopX = def.onTop && h.shape !== 'dodo'; /* Dodo bodies keep the pre-Oct-22 placement (owner revert 1:30 AM CT) */
      if (kind === 'top') { var eyeCap = CA.eyeBox ? CA.eyeBox.t - 2 : 99, Mb = bbOf(M.map(function (v, i3) { return v && (CA.s[i3] || painted.indexOf(i3) >= 0); })), wAt = function (S2, y) { var r = runsOf(S2, y); return r.length ? [r[0][0], r[r.length - 1][1]] : null; };
        var Dbody = DA.s.map(function (v, i2) { return v && D.indexOf(i2) < 0; }), dRow = wAt(Dbody, db.b + 1) || [DA.bb.l, DA.bb.r], cRow = CA.headBox ? [CA.headBox.l, CA.headBox.r] : (function () { var best = null; for (var y = Mb.t + 1; y <= Mb.t + Math.max(2, Math.round(Mb.h * 0.3)); y++) { var w2 = wAt(M, y); if (w2) (best = best || []).push(w2); } if (!best) return null; best.sort(function (a, b) { return (a[1] - a[0]) - (b[1] - b[0]); }); var md = best[best.length >> 1]; return CA.core ? [Math.max(md[0], CA.core[0] - 1), Math.min(md[1], CA.core[1] + 1)] : md; })() || [Mb.l, Mb.r];
        var kt = def.draw ? 1 : clampK((cRow[1] - cRow[0] + 1) / (dRow[1] - dRow[0] + 1), def.keep ? 1 : 0.85, 1.25), pt = scaled(D, kt, [0.5, 1]), bt = bbList(pt.map(function (p) { return p.t; })); var fitT = Math.min(1, Math.max(Mb.t + 2 - mg, eyeCap - 1) / bt.h, (32 - 2 * mg) / bt.w); /* fits between the frame top and just above the eyes */ if (fitT < 1) { kt *= Math.max(0.35, fitT); pt = scaled(D, kt, [0.5, 1]); bt = bbList(pt.map(function (p) { return p.t; })); } /* too tall or wide for this body: shrink it to fit */
        if (pt.length > 12) { var onP = {}, seenP = {}, keepP = []; pt.forEach(function (p) { onP[p.t] = p; }); pt.forEach(function (p) { if (seenP[p.t]) return; var comp = [], st = [p.t]; seenP[p.t] = 1; while (st.length) { var c = st.pop(); comp.push(onP[c]); for (var ddy = -1; ddy <= 1; ddy++) for (var ddx = -1; ddx <= 1; ddx++) { var nb = c + ddy * 32 + ddx; if (onP[nb] && !seenP[nb] && Math.abs((nb & 31) - (c & 31)) <= 1) { seenP[nb] = 1; st.push(nb); } } } if (comp.length > 2) keepP = keepP.concat(comp); }); pt = keepP; bt = bbList(pt.map(function (p) { return p.t; })); } /* scaling left a stray pixel or two: drop them */
        var dc = (dRow[0] + dRow[1]) / 2, cc = (cRow[0] + cRow[1]) / 2; dx = Math.round(cc - (dc + ((bt.l + bt.r) / 2 - (db.l + db.r) / 2))); dx = Math.round(cc - dc); dy = Mb.t + 1 - bt.b;
        dx = Math.max(mg - bt.l, Math.min(31 - mg - bt.r, dx)); dy = Math.max(-bt.t, dy);
        /* never bury the part inside the child's head (e.g. over Pepe's eye domes): lift it until most of it shows */
        var hid = function (d) { return pt.filter(function (p) { var t = p.t + d * 32 + dx; return t >= 0 && t < 1024 && M[t]; }).length; }; while (dy > -bt.t && hid(dy) > pt.length * 0.35) dy--;
        /* a two-piece top (ears, horns): each piece sits on the child's head outline right under it, overlapping it by one row */
        var ucx = (bt.l + bt.r) / 2, sideOf = function (p) { var x = p.t & 31; return x < ucx - 1.5 ? -1 : x > ucx + 1.5 ? 1 : 0; };
        var Lp = pt.filter(function (p) { return sideOf(p) < 0; }), Rp = pt.filter(function (p) { return sideOf(p) > 0; }), Cp = pt.filter(function (p) { return sideOf(p) === 0; });
        /* side pieces (ears, horns) each sit on the child's head outline right under them, overlapping it by one row; a middle piece (tuft, crown) stays on top */
        var occ = {}; pt.forEach(function (p) { occ[p.t & 31] = 1; }); var gapBetween = function (A1, A2) { if (!A1.length || !A2.length) return true; var a1 = Math.max.apply(null, A1.map(function (p) { return p.t & 31; })), a2 = Math.min.apply(null, A2.map(function (p) { return p.t & 31; })); for (var gx2 = a1 + 1; gx2 < a2; gx2++) if (!occ[gx2]) return true; return false; };
        var topOfL = function (A1) { return Math.min.apply(null, A1.map(function (p) { return p.t >> 5; })); };
        var lowBridge = Cp.length && Lp.length && Rp.length && topOfL(Cp) >= Math.min(topOfL(Lp), topOfL(Rp)) + 2; /* two ears joined by a strip of head: still two pieces */
        if (lowBridge) Cp = [];
        var nComp = (function () { var on = {}, seen = {}, n = 0; pt.forEach(function (p) { on[p.t] = 1; }); pt.forEach(function (p) { if (seen[p.t]) return; n++; var st = [p.t]; seen[p.t] = 1; while (st.length) { var c = st.pop(); for (var ddy = -1; ddy <= 1; ddy++) for (var ddx = -1; ddx <= 1; ddx++) { var nb = c + ddy * 32 + ddx; if (on[nb] && !seen[nb] && Math.abs((nb & 31) - (c & 31)) <= 1) { seen[nb] = 1; st.push(nb); } } } }); return n; })();
        var alike = nComp >= 2 && Lp.length && Rp.length && Math.min(Lp.length, Rp.length) >= 0.5 * Math.max(Lp.length, Rp.length); /* a matching pair, not a hat with a drooping tip */
        var split = alike && (lowBridge || (Cp.length ? gapBetween(Lp, Cp) && gapBetween(Cp, Rp) : gapBetween(Lp, Rp)));
        if (def.pair && Lp.length && Rp.length) { split = true; Cp = []; /* the left piece = its biggest connected blob (a tuft between horns is not part of the pair) */
          var onL = {}, seenL = {}, bigL = []; Lp.forEach(function (p) { onL[p.t] = p; }); Lp.forEach(function (p) { if (seenL[p.t]) return; var comp = [], st = [p.t]; seenL[p.t] = 1; while (st.length) { var c = st.pop(); comp.push(onL[c]); for (var ddy = -1; ddy <= 1; ddy++) for (var ddx = -1; ddx <= 1; ddx++) { var nb = c + ddy * 32 + ddx; if (onL[nb] && !seenL[nb] && Math.abs((nb & 31) - (c & 31)) <= 1) { seenL[nb] = 1; st.push(nb); } } } if (comp.length > bigL.length) bigL = comp; }); Lp = bigL; } /* a known pair is always placed as two mirrored pieces */
        if (split) { var eyeL = CA.eyeBox ? Math.round((CA.eyeBox.t + CA.eyeBox.b) / 2) : Mb.t + Math.round(Mb.h * 0.4), hc = facing && CA.eyeBox ? (CA.eyeBox.l + CA.eyeBox.r) / 2 + facing : cc, sink = 1;
          var colTop = function (x) { if (x < 0 || x > 31) return -1; for (var y4 = 0; y4 < GROUND_ROW; y4++) if (M[y4 * 32 + x]) return y4; return -1; };
          var hbL = bbList(Lp.map(function (p) { return p.t; })), hbR = bbList(Rp.map(function (p) { return p.t; })), wL = hbL.r - hbL.l + 1, cxL = (hbL.l + hbL.r) / 2;
          /* a PAIR (ears, horns): one piece mirrored to the other side about the head centre, both on the UPPER head outline, above the eyes, inside the frame */
          var e = Math.round(((hbR.l + hbR.r) / 2 - cxL) / 2 * kt / Math.max(kt, 1)), okAt = function (e1) { var xl = Math.round(hc - e1), xr = Math.round(hc + e1), a = colTop(xl), b = colTop(xr); return a >= 0 && b >= 0 && a + sink <= eyeL - 1 && b + sink <= eyeL - 1 && xl - (wL - 1) / 2 >= mg && xr + (wL - 1) / 2 <= 31 - mg; };
          var hTop = colTop(Math.round(hc)), cRowY = Math.min(GROUND_ROW - 1, hTop + Math.max(2, Math.round((eyeL - hTop) * 0.3))), hRun = hTop >= 0 ? runsOf(M, cRowY).filter(function (r) { return r[0] <= hc + 1 && r[1] >= hc - 1; })[0] : null;
          if (hRun) { e = Math.max(1, (hRun[1] - hRun[0]) / 2 - 1.5); hc = (hRun[0] + hRun[1]) / 2; } /* each piece centred just inside the head's upper corner */
          if (2 * e < wL + 1) { var fS = Math.max(0.5, (2 * e - 1) / wL), seenS = {}; Lp = Lp.map(function (p) { var x = p.t & 31, y = p.t >> 5; return { t: Math.round(hbL.b - (hbL.b - y) * fS) * 32 + Math.round(cxL + (x - cxL) * fS), s: p.s }; }).filter(function (p) { if (seenS[p.t]) return false; seenS[p.t] = 1; return true; }); hbL = bbList(Lp.map(function (p) { return p.t; })); wL = hbL.r - hbL.l + 1; cxL = (hbL.l + hbL.r) / 2; } /* narrow head: smaller ears */
          e = Math.round(Math.max(e, wL / 2 + 0.5)); var e0 = e, eMin = Math.ceil(wL / 2) - 1; while (e > eMin && !okAt(e)) e--; if (!okAt(e)) { var bestE = e0, bestY = 99; for (var e2 = e0; e2 >= eMin; e2--) { var yy2 = Math.max(colTop(Math.round(hc - e2)), colTop(Math.round(hc + e2))); if (colTop(Math.round(hc - e2)) >= 0 && colTop(Math.round(hc + e2)) >= 0 && yy2 < bestY) { bestY = yy2; bestE = e2; } } e = bestE; }
          var yT = Math.max(colTop(Math.round(hc - e)), colTop(Math.round(hc + e))); if (yT < 0) yT = Mb.t;
          if (onTopX && hRun) { /* ON the top of the head: pieces pulled in from the corners onto the crown */ var hw2 = (hRun[1] - hRun[0]) / 2; e = Math.max(eMin, Math.min(e, Math.round(hw2 * 0.55 + wL * 0.25))); var tL = colTop(Math.round(hc - e)), tR = colTop(Math.round(hc + e)); yT = Math.max(Math.min(tL, tR), 0); if (tL < 0 || tR < 0) yT = Mb.t; }
          var d2 = Math.max(mg - hbL.t, yT + sink - hbL.b), dxL = Math.round(hc - e - cxL), AX = Math.round(2 * hc), left = shift(Lp, dxL, d2);
          if (onTopX) { /* never over the eyes (Pepe/Peepo eye domes ARE the head top): lift until no piece or seam pixel touches an eye pixel */
            var EM0 = eyeMaskOf(h.shape, art, o), eyeAt = function (t) { return t >= 0 && t < 1024 && (EYE_KEYS[ck.keys[t]] || EM0[t]); }, hitsEye = function (L) { return L.some(function (p) { return eyeAt(p.t) || eyeAt(p.t + 32) || ((p.t & 31) > 0 && eyeAt(p.t + 31)) || ((p.t & 31) < 31 && eyeAt(p.t + 33)); }); };
            var mirrorL = function (L) { return L.map(function (p) { var x = p.t & 31; return { t: p.t - x + (AX - x), s: p.s }; }); };
            var d2a = d2; while (d2 > mg - hbL.t && hitsEye(left.concat(mirrorL(left)))) { d2--; left = shift(Lp, dxL, d2); }
            var hitsEye2 = function (L) { return L.some(function (p) { return eyeAt(p.t); }); }; /* then sink back into the head outline as far as no eye pixel is covered (no double ink line = no floating look) */
            for (var sk = 0; d2 < d2a && sk < 1 && !hitsEye2(shift(Lp, dxL, d2 + 1).concat(mirrorL(shift(Lp, dxL, d2 + 1)))); sk++) { d2++; left = shift(Lp, dxL, d2); }
            /* lifted pieces never float: each column grows down (its own bottom colour) until it meets the head, stopping before any eye pixel */
            var onL0 = {}, botC = {}; left.forEach(function (p) { onL0[p.t] = 1; var x = p.t & 31; if (!botC[x] || p.t > botC[x].t) botC[x] = p; });
            var stalk = []; Object.keys(botC).forEach(function (x) { var p = botC[x], t = p.t + 32, n = 0, run = []; while (t < 1024 && n < 4 && !M[t] && !onL0[t]) { run.push({ t: t, s: p.s }); t += 32; n++; } if (t < 1024 && M[t] && !EYE_KEYS[ck.keys[t]] && run.length) stalk = stalk.concat(run); });
            left = left.concat(stalk); }
          var right = left.map(function (p) { var x = p.t & 31; return { t: p.t - x + (AX - x), s: p.s }; }).filter(function (p) { var x = AX - (p.t & 31); return (p.t & 31) >= 0 && x >= 0 && x <= 31; });
          var wasHead = {}; left.concat(right).forEach(function (p) { if (M[p.t]) wasHead[p.t] = 1; });
          paste(D, kF, left); paste(D, kF, right);
          var onLR = {}; left.concat(right).forEach(function (p) { onLR[p.t] = 1; }); left.concat(right).forEach(function (p) { [p.t + 32, p.t - 1, p.t + 1].forEach(function (n) { if (n >= 0 && n < 1024 && !onLR[n] && M[n] && CA.s[n] && !(onTopX && EYE_KEYS[ck.keys[n]]) && (n >> 5) <= (p.t >> 5) + 1 && Math.abs((n & 31) - (p.t & 31)) <= 1) { set(n, INK); touched[n] = 1; } }); }); /* an ink seam where each piece meets the head, so it reads as its own ear / horn */
          TOPDBG = { eyeL: eyeL, hc: AX / 2, pieces: [left, right].map(function (L) { return bbList(L.map(function (p) { return p.t; })); }) };
          if (Cp.length) { var cb2 = bbList(Cp.map(function (p) { return p.t; })), yC = -1; for (var y5 = 0; y5 < GROUND_ROW; y5++) if (M[y5 * 32 + Math.round((cb2.l + cb2.r) / 2) + dx]) { yC = y5; break; }
            var d3 = yC < 0 ? dy : yC + 1 - cb2.b; paste(D, kF, shift(Cp, dx, Math.max(mg - cb2.t, d3))); }
          return; }
        dy = Math.max(2 - bt.t, Math.min(dy, eyeCap - bt.b)); TOPDBG = { eyeL: CA.eyeBox ? CA.eyeBox.t : 99, single: true, pieces: [bbList(pt.map(function (p) { return p.t + dy * 32 + dx; }))] }; paste(D, kF, shift(pt, dx, dy)); return; }
      [-1, 1].forEach(function (sd) { var cx = (DA.bb.l + DA.bb.r) / 2, js = D.filter(function (j) { return ((j & 31) < cx ? -1 : 1) === sd; }); if (!js.length || (kind === 'tail' && sd > 0)) return;
        var jb = bbList(js);
        var k2 = def.draw ? 1 : clampK(sb.h / DA.bb.h, kind === 'tail' && stg > 2 ? 1 : 0.55, 1.35), pad = kind === 'tail' ? 2 : 1;
        var pr = scaled(js, k2, [sd < 0 ? 1 : 0, 0.5]), b2 = bbList(pr.map(function (p) { return p.t; })), ty, se;
        { var rel = ((jb.t + jb.b) / 2 - DA.bb.t) / DA.bb.h; ty = Math.round(sb.t + (def.draw && kind === 'tail' ? 0.58 : rel) * sb.h); dy = Math.round(ty - (b2.t + b2.b) / 2);
          var rows = []; for (var yy = b2.t + dy; yy <= b2.b + dy; yy++) if (yy >= sb.t && yy <= sb.b) { var e = edgeAt(M, yy, sd); if (e >= 0) rows.push(e); }
          se = rows.length ? (sd < 0 ? Math.min.apply(null, rows) : Math.max.apply(null, rows)) : (sd < 0 ? sb.l : sb.r); dx = sd < 0 ? se - b2.r : se - b2.l; dx = Math.max(Math.max(pad, mg) - b2.l, Math.min(31 - Math.max(pad, mg) - b2.r, dx)); }
        var sp2 = shift(pr, dx, dy); if (kind === 'tail') { var tOn = {}; sp2.forEach(function (p) { tOn[p.t] = 1; }); var wasBody = sp2.filter(function (p) { return M[p.t]; }).length;
          paste(js, kF, sp2); if (wasBody) sp2.forEach(function (p) { [p.t + 1, p.t + 32, p.t - 32].forEach(function (n) { if (n >= 0 && n < 1024 && !tOn[n] && CA.s[n]) { set(n, INK); touched[n] = 1; } }); }); return; } /* a tail in front of a wide body gets its own ink outline */
        paste(js, kF, sp2); }); }
    /* outline round the new silhouette, only where something changed */
    var near = {}; Object.keys(touched).forEach(function (t) { t = +t; for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) { var x = (t & 31) + dx, y = (t >> 5) + dy; if (x >= 0 && y >= 0 && x < 32 && y < GROUND_ROW) near[y * 32 + x] = 1; } });
    Object.keys(near).forEach(function (n) { n = +n; if (M[n]) return; var x = n & 31, adj = [n - 32, n + 32, x > 0 ? n - 1 : -1, x < 31 ? n + 1 : -1].some(function (a) { return a >= 0 && a < 1024 && M[a]; }); set(n, adj ? INK : bgAt(n)); });
    /* EYES ALWAYS SHOW (owner Oct 22 1:27 AM CT, 'completely missing eyes'): a head part (ears, horns, hat, nemes, hair, side ears...) never removes an eye
     * pixel of the child's own body: every eye pixel (eyeMaskOf) not repainted by a traded EYES/MOUTH part gets its pre-part colour back. Dodo bodies keep
     * their pre-Oct-22 look (owner revert). */
    if (h.shape !== 'dodo') { var EM = eyeMaskOf(h.shape, art, o); Object.keys(EM).forEach(function (t) { t = +t; if (noRestore[t]) return; set(t, [orig[t * 4], orig[t * 4 + 1], orig[t * 4 + 2]]); }); }
    return painted; }
  /* LORD KEK AS A HYBRID ROOT (same system as every species, both ways): pseudo species KEK_SP (canon = player palette: green body, red nemes
   * accent, gold belly/collar). Kek as SHAPE: the KekSprite body (nemes included, it is part of him) recoloured from the colour parent's canon
   * (skin <- body, nemes stripes <- accent, gold <- belly). Kek as COLOUR: his canon recolours the shape parent. Kek as FEATURE: the nemes top
   * (head) or nemes lappets (side), picked by the same connected-pixel rule as every hybrid. */
  var KEK_SP = { id: 'kek', label: 'Lord Kek', canon: { body: '#5aa83c', accent: '#c8342c', belly: '#ffd23f' } };
  function kekSprite() { return typeof KekSprite !== 'undefined' ? KekSprite : (typeof window !== 'undefined' ? window.KekSprite : null); }
  function kekPal(C, shade) { if (!C || C.id === 'kek') return null; var c = C.canon;
    return { G: c.body, g: shade(c.body, 0.7), h: shade(c.body, 1.3), B: c.accent, b: shade(c.accent, 0.7), y: c.belly, o: shade(c.belly, 0.75) }; }
  /* FUNTRUMP AS A HYBRID ROOT (branch funtrump-community, PREVIEW; owner standing rule: community pets always work for hybrids + gear). Pseudo species
   * FT_SP (canon: orange skin body, red-tie accent, blond-hair belly). As SHAPE: the FuntrumpSprite body recoloured from the colour parent (skin <- body,
   * suit/tie <- accent, hair <- belly). As COLOUR: his canon recolours the shape parent. As FEATURE: his windblown hair (head) trimmed like Kek's nemes.
   * Inert: no pet has species 'funtrump' until ACTIVATE_FUNTRUMP_BLOCK is set, so nothing in replay reaches these branches. */
  var FT_SP = { id: 'funtrump', label: 'FUNTRUMP', canon: { body: '#ff8a2a', accent: '#c8342c', belly: '#e6bd85' } };
  function ftSprite() { return typeof FuntrumpSprite !== 'undefined' ? FuntrumpSprite : (typeof window !== 'undefined' ? window.FuntrumpSprite : null); }
  function ftPal(C, shade) { if (!C || C.id === 'funtrump') return null; var c = C.canon;
    return { O: c.body, t: shade(c.body, 1.08), i: shade(c.body, 0.82), z: shade(c.body, 0.72), N: shade(c.accent, 0.45), v: shade(c.accent, 0.32), B: c.accent,
      '2': shade(c.belly, 0.6), '3': shade(c.belly, 0.8), '4': c.belly, '5': shade(c.belly, 1.15) }; }
  function renderRoot(art, o, pal) { if (art.species === 'funtrump' && ftSprite()) { var fst = o.stage == null ? 3 : o.stage;
      var fr0 = ftSprite().render(fst, o.frame || 0, art.background === 'solid' && art.bgColor === '#ff00ff' ? '#ff00ff' : (art.bgColor || '#1f2a44'), {}, { pal: pal || null }); return { width: 32, height: 32, data: new Uint8ClampedArray(fr0.data) }; }
    if (art.species === 'wizard' && wizSprite()) return renderWizRoot(art, o, pal); if (art.species !== 'kek' || !kekSprite()) return PetCore.render(art, o); var st = o.stage == null ? 3 : o.stage;
    var r = kekSprite().render(st, o.frame || 0, art.background === 'solid' && art.bgColor === '#ff00ff' ? '#ff00ff' : (art.bgColor || '#2a3a2e'), {}, { pal: pal || null });
    return { width: 32, height: 32, data: new Uint8ClampedArray(r.data) }; }
  /** kekAccent(px, kS, sil): trims a Kek feature (nemes top / lappets) to a small accent: drops pixels enclosed by the body on the same row
   * (holes inside the shape), keeps only pixels within 2 px of the body edge, and at most KEK_FEAT_MAX of them (nearest to the body first). */
  var KEK_FEAT_MAX = 14;
  function kekAccent(px, kS, sil) { var inS = function (x, y) { return x >= 0 && y >= 0 && x < 32 && y < 32 && sil(kS, (y * 32 + x) * 4); };
    var d = function (j) { var x = j & 31, y = j >> 5, m = 9; for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) if (inS(x + dx, y + dy)) m = Math.min(m, Math.abs(dx) + Math.abs(dy)); return m; };
    var enclosed = function (j) { var x = j & 31, y = j >> 5, L = false, R = false; for (var a = 0; a < x; a++) if (inS(a, y)) L = true; for (var c = x + 1; c < 32; c++) if (inS(c, y)) R = true; return L && R; };
    return px.filter(function (j) { return !enclosed(j) && d(j) <= 2; }).sort(function (a, b) { return d(a) - d(b) || a - b; }).slice(0, KEK_FEAT_MAX); }
  function speciesObj(id) { if (id === 'funtrump') return FT_SP; if (id === 'kek') return KEK_SP; if (id === 'wizard') return WIZ_SP; return PetCore.SPECIES.filter(function (x) { return x.id === id; })[0]; }
  /* WIZARD AS A HYBRID ROOT (wizard-hybrids branch). The player Wizard is drawn by WizardSprite (not a PetCore map), so hybridRender gets a
   * pseudo species WIZ_SP (canon = the blue player palette: robe body, gold-star accent, white-beard belly) and renderRoot() draws either kind.
   * Wizard as SHAPE: the WizardSprite body (hatless, grey hair; the Wizard Hat is never worn by hybrids) with robe/hat tones from the colour
   * parent's body and beard/hair from its belly. Wizard as COLOUR: its canon recolours the shape parent. Wizard as FEATURE: hair tuft (head) or
   * the staff + ₿ orb / sleeve (side), picked by the same connected-pixel rule as every hybrid. Same 32x32 frame, 4 frames, ink outline, badge. */
  var WIZ_SP = { id: 'wizard', label: 'Bitcoin Wizard', canon: { body: '#2f6fe0', accent: '#ffd23f', belly: '#e6e6ee' } };
  function wizSprite() { return typeof WizardSprite !== 'undefined' ? WizardSprite : (typeof window !== 'undefined' ? window.WizardSprite : null); }
    function wizPal(C, shade) { var c = C.canon; if (C.id === 'wizard') return {};
    return { R: c.body, B: c.body, r: shade(c.body, 0.7), b: shade(c.body, 0.7), h: shade(c.body, 1.3), c: shade(c.body, 1.3), G: c.belly, W: c.belly, g: shade(c.belly, 0.72) }; }
  /** renderRoot(art, o, pal): one root's frame. 'wizard' -> WizardSprite (solid bg = art.bgColor, or #ff00ff for key renders); others PetCore.render. */
  function renderWizRoot(art, o, pal) { var WS = wizSprite(), st = o.stage == null ? 3 : o.stage;
    var r = WS.render(st, o.frame || 0, art.background === 'solid' && art.bgColor === '#ff00ff' ? '#ff00ff' : (art.bgColor || '#2a3a2e'), o.wizGear || {}, { pal: pal || {} });
    return { width: 32, height: 32, data: new Uint8ClampedArray(r.data) }; }
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
    var kp = S.id === 'funtrump' ? ftPal(C, shade) : S.id === 'kek' ? kekPal(C, shade) : S.id === 'wizard' ? wizPal(C, shade) : null; /* Wizard body (wizard-hybrids): recolour by palette key */
    function withColours(fn) { if (S.id === 'wizard') return fn(); var keep = S.canon, kc = S.colors, cc = C.canon; S.canon = cc;
      if (S.id === 'nakamoto' && kc) S.colors = Object.assign({}, kc, { '3': cc.body, '4': shade(cc.body, 0.78), '1': shade(cc.accent, 0.8), '2': shade(cc.accent, 1.15), '5': cc.accent, '8': shade(cc.accent, 0.65), '9': cc.belly });
      if (S.id === 'mumu' && kc) S.colors = Object.assign({}, kc, { '2': shade(cc.belly, 1.05), '3': cc.belly, '4': shade(cc.belly, 1.15) });
      if (S.id === 'pepe' && C.id !== 'pepe') S.canon = Object.assign({}, cc, { belly: cc.accent });
      try { return fn(); } finally { S.canon = keep; S.colors = kc; } }
    if ((o.stage == null ? 3 : o.stage) === 0) { var L = renderRoot(shapeArt, o, kp), Rt = renderRoot(colArt, o); img = { width: 32, height: 32, data: new Uint8ClampedArray(L.data) };
      for (var y = 0; y < 32; y++) for (var x = 16; x < 32; x++) for (var c = 0; c < 4; c++) img.data[(y * 32 + x) * 4 + c] = Rt.data[(y * 32 + x) * 4 + c];
    } else {
      var calm = PetCore.EYES[0].id, laser = h.eyes === 'laser';
      shapeArt.eyes = h.eyes; img = withColours(function () { return renderRoot(shapeArt, o, kp); });
      /* Wizard-body gear on top (Oct 22 2026, owner rule: community pets always work with gear): the Wizard sprite draws worn gear INSIDE the body render,
       * so traded parts pasted later (Bobo ears, Snibby claws, Wojak/Peepo eyes, Nakamoto glasses) used to cover hats, held pieces, back pieces and face
       * pieces. Remember the gear pixels here and paint them back after the parts, like gear on every other hybrid body. Display only. */
      var wgPx = null; if (S.id === 'wizard' && o.wizGear && Object.keys(o.wizGear).length && h.parts && h.parts.length) { var g0 = withColours(function () { return renderRoot(shapeArt, Object.assign({}, o, { wizGear: {} }), kp); }); wgPx = [];
        for (var gq = 0; gq < 1024; gq++) { var gi = gq * 4; if (img.data[gi] !== g0.data[gi] || img.data[gi + 1] !== g0.data[gi + 1] || img.data[gi + 2] !== g0.data[gi + 2] || img.data[gi + 3] !== g0.data[gi + 3]) wgPx.push(gq, img.data[gi], img.data[gi + 1], img.data[gi + 2], img.data[gi + 3]); } }
      var key = function (a2) { return Object.assign({}, a2, { background: 'solid', bgColor: '#ff00ff', pattern: 'none' }); };
      var kS = withColours(function () { return renderRoot(key(Object.assign({}, shapeArt, { eyes: calm })), o, kp); }), kF = renderRoot(key(Object.assign({}, featArt, { eyes: calm })), Object.assign({}, o, { wizGear: {} }));
      var sil = function (k, i) { return !(k.data[i] === 255 && k.data[i + 1] === 0 && k.data[i + 2] === 255); }, top = 32, x0 = 32, x1 = -1;
      if (laser) { var base = withColours(function () { return renderRoot(Object.assign({}, shapeArt, { eyes: calm }), o, kp); }); // clip beams to the body
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
      var noFeat = (h.parts && h.parts.length) || (Array.isArray(h.parts) && h.shape !== 'dodo') || (F.id === 'wizard' && S.id !== 'wizard'); /* Oct 22 (owner, gray leftover): a v2 plan whose donor gave NO part (e.g. KEVIN hair excluded on Pepe/Peepo) gets no old copied feature either (it pasted KEVIN's gray hair crest between Pepe's/Peepo's eye domes) */ /* breeding v2: traded parts replace the old copied feature; a Wizard feature parent gives a staff instead */
      var px = noFeat ? [] : pick(h.feature); if (!noFeat && px.length < 3) px = pick(h.feature === 'head' ? 'side' : 'head');
      if (F.id === 'kek' || F.id === 'funtrump') px = kekAccent(px, kS, sil); /* Kek feature = a small accent like other species (no stripes over the body) */
      px.forEach(function (j) { for (var c2 = 0; c2 < 3; c2++) img.data[j * 4 + c2] = kF.data[j * 4 + c2]; });
      if (F.id === 'wizard' && S.id !== 'wizard') px = wizStaff(img, kS, sil, o, x0, x1);
      /* a worn core crown/headband (drawn inside the body render) replaces a traded Wizard hat part, otherwise the hat covered it (Oct 22 2026, display only) */
      var hp = h; if (h.parts && h.parts.length && o.gearOverride && (o.gearOverride.crown || o.gearOverride.band) && h.parts.some(function (q) { return q.sp === 'wizard' && q.part === 'hat'; })) hp = Object.assign({}, h, { parts: h.parts.filter(function (q) { return !(q.sp === 'wizard' && q.part === 'hat'); }) });
      if (hp.parts && hp.parts.length) px = px.concat(applyParts(img, kS, hp, o, art, px)); /* breeding v2: traded body parts (only plans bred at/after the gate have parts) */
      if (wgPx) for (var gk = 0; gk < wgPx.length; gk += 5) { var gj = wgPx[gk] * 4; img.data[gj] = wgPx[gk + 1]; img.data[gj + 1] = wgPx[gk + 2]; img.data[gj + 2] = wgPx[gk + 3]; img.data[gj + 3] = wgPx[gk + 4]; }
      var busy = 0; for (var by = 0; by < 6; by++) for (var bx = 26; bx < 32; bx++) { var bj = by * 32 + bx; if (sil(kS, bj * 4) || px.indexOf(bj) >= 0) busy++; }
      var left = busy > 2;
    }
    var mark = [[29, 0, '#1a1020'], [28, 1, '#1a1020'], [30, 1, '#1a1020'], [27, 2, '#1a1020'], [31, 2, '#1a1020'], [28, 2, S.canon.body], [29, 1, S.canon.body], [29, 2, '#ffc93c'], [30, 2, C.canon.body], [29, 3, C.canon.body], [28, 3, '#1a1020'], [30, 3, '#1a1020'], [29, 4, '#1a1020']];
    if (h.featSp) mark.push([30, 3, F.canon.body], [28, 3, F.canon.body]);
    mark.forEach(function (q) { var v = hx(q[2]), qx = left ? q[0] - 27 : q[0], k3 = (q[1] * 32 + qx) * 4; img.data[k3] = v[0]; img.data[k3 + 1] = v[1]; img.data[k3 + 2] = v[2]; img.data[k3 + 3] = 255; });
    return img;
  }
  /* Wizard signature feature on another body (both 'head' and 'side' plans): his staff + ₿ orb (wand for a Hatchling), lifted from the WizardSprite
   * grid (cells right of his robe in staff/orb/gold keys) and stood next to the shape's body (right side, or left if the body fills the right edge),
   * bottom on the same ground row, ink outline added, never over the body. Returns the painted pixel indexes (badge placement uses them). */
  function wizStaff(img, kS, sil, o, x0, x1) { var WS = wizSprite(); if (!WS || !WS.draw) return []; var st = o.stage == null ? 3 : o.stage, g = WS.draw(st, o.frame || 0, {}), P = WS.PAL, cells = [], mx = 32, MX = -1;
    var ok = { L: 1, l: 1, O: 1, o: 1, w: 1, y: 1 };
    for (var y = 0; y < 32; y++) for (var x = 22; x < 32; x++) { var k = g[y] && g[y][x]; if (k && ok[k] && (k !== 'y' || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) { var q = g[y + d[1]] && g[y + d[1]][x + d[0]]; return q === 'O' || q === 'L' || q === 'l'; }))) { cells.push([x, y, P[k] || k]); mx = Math.min(mx, x); MX = Math.max(MX, x); } }
    if (!cells.length) return []; var wdt = MX - mx + 1, dx = x1 + 2 + wdt <= 31 || 30 - x1 >= x0 - 1 ? x1 + 2 - mx : x0 - 2 - MX; /* right side unless the left has more room */ var out = [], put = {};
    cells.forEach(function (c) { var X = c[0] + dx, Y = c[1]; if (X < 0 || X > 31) return; var j = Y * 32 + X; if (sil(kS, j * 4)) return; put[j] = c[2]; });
    var hx = function (c3) { return [parseInt(c3.slice(1, 3), 16), parseInt(c3.slice(3, 5), 16), parseInt(c3.slice(5, 7), 16)]; };
    Object.keys(put).forEach(function (j) { j = +j; var v = hx(put[j]); img.data[j * 4] = v[0]; img.data[j * 4 + 1] = v[1]; img.data[j * 4 + 2] = v[2]; out.push(j); });
    Object.keys(put).forEach(function (j) { j = +j; [j - 1, j + 1, j - 32, j + 32].forEach(function (n) { if (n < 0 || n > 1023 || put[n] || Math.abs((n & 31) - (j & 31)) > 1 || sil(kS, n * 4)) return;
      if ((n >> 5) > 28) return; img.data[n * 4] = 0x1a; img.data[n * 4 + 1] = 0x10; img.data[n * 4 + 2] = 0x20; }); });
    return out; }
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
  /* ===== BREEDING V2 extras (all from ACTIVATE_BREEDING_V2_BLOCK, each on its OWN stream keyed by the breed hash) =====================
   * TWINS        1 in 50 (2%): stream 'XCPETS:v2:twins:' + hash. One breed burn (690 per side, counts as ONE of the 6 breeds and one cooldown)
   *              yields a second egg = the next pet id, rolled exactly like a normal child from the hash of (block hash + tx + ':twin').
   * MUTATION     1 in 100 (1%): stream 'XCPETS:v2:mutation:' + hash. Half 'palette' (hue-shifted colours), half 'glitch' (scanline shift + RGB split).
   * HIDDEN TRAIT stream 'XCPETS:v2:hidden:' + hash. A child of a carrier parent inherits the trait 50% of the time; it SHOWS only if that parent
   *              did not show it (so it skips a generation); a child with no carrier parent becomes a fresh, hidden carrier 1 in 20 (5%).
   *              Traits: frosted tips / shadow socks (star freckles removed Oct 21 2026).
   * LEGENDARY MIX Legendary x Legendary hybrid child: 1 in 4 (25%) gets a third species' look (feature + one signature part) from stream
   *              'XCPETS:v2:legmix:' + hash. Looks only; species/name/stats unchanged.
   * INBREEDING GUARD parent x child and siblings (any shared parent) can't breed (kinWhy).  GENERATION (genOf) + BADGES (breederBadges) are display only. */
  var TWIN_1_IN = 50, MUTATION_1_IN = 100, HIDDEN_FRESH_1_IN = 20, LEGMIX_1_IN = 4;
  var HIDDEN_TRAITS = [{ id: 'frost', label: 'Frosted tips' }, { id: 'socks', label: 'Shadow socks' }, { id: 'oddeyes', label: 'Odd eyes' }]; /* Star freckles removed (Oct 21 2026 11:26 PM CT); Odd eyes added as the third (owner Oct 22 2026 12:29 AM CT): fresh carriers a third each */
  var ODD_EYE_COLOURS = [{ id: 'gold', rgb: [255, 200, 0] }, { id: 'ice', rgb: [90, 210, 255] }, { id: 'toxic', rgb: [80, 255, 40] }, { id: 'magenta', rgb: [255, 40, 200] }];
  /* ODD_EYE_SPOTS (owner Oct 22 2026 ~12:45 AM CT): hand-placed eyes for the Odd eyes throwback, per species and stage (1 Hatchling .. 5 Mythic).
   * Each entry is [left eye, right eye] = [x, y, 'rows'] on the bare sprite at frame 0 (32x32): 'o' = odd colour, 'p' = darker pupil, 'g' = white glint, '.' = untouched.
   * Dodo has one eye (both entries the same). Frames are matched by a vertical shift of the body; if the spot does not sit on eye pixels (e.g. a hybrid face), the automatic finder is used. */
  var ODD_EYE_SPOTS = {
    pepe: { 1: [[10, 18, 'ooop/.ooo'], [17, 18, 'oop/ooo']], 2: [[8, 15, '.ooop/oooop/.oooo'], [16, 15, 'ooopp/ooopp/.oooo']], 3: [[8, 14, 'ppppp/.oooo'], [17, 14, 'ppppp/.oooo']], 4: [[7, 13, '.oooo/o....o'], [17, 13, '.oooo/o....o']], 5: [[7, 12, 'oooopp/oooopp/.ooooo'], [17, 12, 'oooopp/oooopp/.ooooo']] },
    wojak: { 1: [[13, 18, 'oo/go'], [16, 18, 'oo/go']], 2: [[14, 16, 'go/oo/oo/oo'], [18, 16, 'go./ooo/ooo/.oo']], 3: [[13, 15, 'ooo/goo/goo'], [19, 15, 'oo/go/go']], 4: [[13, 14, 'ooo/goo/goo'], [19, 14, 'ooo/goo/goo']], 5: [[13, 12, 'ooo/pp.'], [19, 12, 'oo/pp']] },
    chud: { 1: [[12, 19, 'gpo/ooo'], [17, 19, 'gpo/ooo']], 2: [[14, 18, 'poo/poo'], [18, 18, 'opo/opo']], 3: [[13, 16, 'ooo/opo'], [19, 16, 'ooo/opo']], 4: [[13, 15, 'opo/opo'], [19, 15, 'opo/opo']], 5: [[13, 15, 'ooo/opo'], [19, 15, 'ooo/opo']] },
    bobo: { 1: [[11, 18, 'oopp/ooop'], [17, 18, 'oopp/ooop']], 2: [[9, 16, 'ooopp/ooopp/.ooo'], [17, 16, 'ooopp/ooopp/.ooo']], 3: [[9, 14, 'ooopp/ooopp/.ooo'], [18, 14, 'ooopp/ooopp/.ooo']], 4: [[8, 13, 'oooopp/oooopp/.oooo'], [18, 13, 'oooopp/oooopp/.oooo']], 5: [[8, 13, 'oooopp/oooopp/.oooo'], [18, 13, 'oooopp/oooopp/.oooo']] },
    mumu: { 1: [[11, 18, 'ooo/goo'], [17, 18, 'ooo/goo']], 2: [[10, 16, 'oooo/goo'], [17, 16, 'oooo/.goo']], 3: [[10, 14, 'gooo/ooo'], [18, 14, 'gooo/.ooo']], 4: [[9, 13, 'oooo/oopp'], [19, 13, 'oooo/oopp']], 5: [[9, 13, 'oooo/oopp'], [19, 13, 'oooo/oopp']] },
    snibby: { 1: [[12, 15, 'p/o/p'], [18, 15, 'p/o/p']], 2: [[11, 13, 'o/o/p'], [19, 13, 'o/o/p']], 3: [[10, 11, 'oo/op/op'], [20, 11, 'o/p/p']], 4: [[10, 10, 'op/op'], [20, 10, 'po/po']], 5: [[10, 9, 'oo/op/op'], [20, 9, 'oo/po/po']] },
    dodo: { 1: [[17, 15, 'opo/opo'], [17, 15, 'opo/opo']], 2: [[17, 12, '.opo/oopo/oopo'], [17, 12, '.opo/oopo/oopo']], 3: [[17, 10, 'oopo/oopo/oopo'], [17, 10, 'oopo/oopo/oopo']], 4: [[18, 9, 'oopo/oopo'], [18, 9, 'oopo/oopo']], 5: [[18, 8, 'oopo/oopo/oopo'], [18, 8, 'oopo/oopo/oopo']] },
    kevin: { 1: [[13, 18, 'oo/go'], [17, 18, 'oo/og']], 2: [[13, 15, 'oo/o.'], [16, 15, 'oo/.o']], 3: [[12, 13, 'ooo/ooo'], [17, 13, 'ooo/ooo']], 4: [[12, 13, 'ooo'], [17, 13, 'ooo']], 5: [[12, 12, 'ooo/ooo'], [17, 12, 'ooo/ooo']] },
    peepo: { 1: [[12, 17, 'ooop/ooop/.ooo'], [17, 17, 'oooo/ooop/.oooo']], 2: [[11, 15, 'ooopp/ooooo/.oooo'], [18, 15, 'ooopp/oooooo/.oooo']], 3: [[10, 13, 'oooopp/oooppp/.oooo'], [18, 13, 'oooopp/oooppp/.oooo']], 4: [[10, 11, 'oooopp/oooppp/oooooo/.oooo'], [18, 11, 'ooooopp/ooooppp/ooooooo/.ooooo']], 5: [[10, 10, 'ooooo/oooopp/oooppp/oooooo/.oooo'], [18, 10, 'oooooo/ooooopp/ooooppp/ooooooo/.ooooo']] },
    sarutobi: { 1: [[13, 17, 'go/oo/oo'], [17, 17, 'go/oo/oo']], 2: [[12, 14, '.o./.o./goo/ooo/ooo/.o.'], [17, 14, '.o./.o./goo/ooo/ooo/.o.']], 3: [[11, 13, '.oo/goo/ooo/ooo/.oo'], [17, 13, 'oo./goo/ooo/ooo/oo.']], 4: [[11, 12, '.oo/goo/ooo/ooo/.oo'], [18, 12, 'oo./goo/ooo/ooo/oo.']], 5: [[11, 12, '.oo/goo/ooo/ooo/.oo'], [18, 12, 'oo./goo/ooo/ooo/oo.']] },
    doge: { 1: [[10, 18, 'goo/goo'], [15, 18, 'oo./goo']], 2: [[9, 16, 'goo/ggo'], [14, 16, 'gooo/ggoo']], 3: [[8, 13, 'ooo/ooo/goo'], [14, 13, 'goo/goo/goo']], 4: [[7, 13, 'gooo/ggoo'], [14, 13, 'gooo/ggoo']], 5: [[7, 12, 'gooo/gooo/ggoo'], [14, 12, 'gooo/gooo/ggoo']] },
    lenny: { 1: [[13, 18, 'go/oo'], [18, 18, 'go/oo']], 2: [[11, 16, 'goo/ooo'], [18, 16, 'go./ooo']], 3: [[11, 13, 'ooo/ogo/ooo'], [19, 13, 'oo./og./.oo']], 4: [[11, 12, 'ooo/ogo/ooo'], [19, 12, 'ooo./ogo./.ooo']], 5: [[11, 12, 'ooo/ogo/ooo'], [19, 12, 'ooo./ogo./.ooo']] },
    nakamoto: { 1: [[12, 21, 'oo/po'], [17, 21, 'oo/po']], 2: [[9, 17, 'opo/.o.'], [14, 17, 'opo/.o.']], 3: [[8, 16, 'opo'], [14, 16, 'opo']], 4: [[8, 15, 'opo'], [14, 15, 'opo']], 5: [[8, 15, 'opo'], [14, 15, 'opo']] },
    kek: { 1: [[11, 21, 'oppo/.oo.'], [17, 21, 'oppo/.oo.']], 2: [[10, 19, 'ooppo/.oop'], [17, 19, 'ooppo/.oop']], 3: [[10, 17, 'ooppo/.oop'], [17, 17, 'ooppo/.oop']], 4: [[10, 16, 'ooppo/.oop'], [17, 16, 'ooppo/.oop']], 5: [[10, 16, 'ooppo/.oop'], [17, 16, 'ooppo/.oop']] },
    wizard: { 1: [[15, 17, 'o/o'], [18, 17, 'o/o']], 2: [[15, 15, 'o/o'], [18, 15, 'o/o']], 3: [[14, 12, 'o/o'], [17, 12, 'o/o']], 4: [[14, 11, 'o/o'], [17, 11, 'o/o']], 5: [[14, 11, 'o/o'], [17, 11, 'o/o']] } };
  /* PALETTE SETS (owner Oct 21 2026 11:26 PM CT: owner will choose; owner Oct 21 2026 11:40 PM CT: ALL eight used; a palette mutation picks one evenly from its own sub-stream of the parts stream): luminance mapped onto a named 4-colour ramp, dark to light */
  var PALETTE_SETS = { neon: { label: 'Neon', ramp: ['#1a0033', '#ff00cc', '#00ffea', '#fbff00'] }, pastel: { label: 'Comfy', ramp: ['#6b5b95', '#f7a8c4', '#b8e0f6', '#fff3b0'] },
    goldrush: { label: 'Bags', ramp: ['#4a2c00', '#b8860b', '#ffd700', '#fff6c2'] }, ice: { label: 'Cold Storage', ramp: ['#0b2545', '#4f9dde', '#a8e6ff', '#f4fdff'] },
    toxic: { label: 'Radioactive Kek', ramp: ['#1b3300', '#39ff14', '#b4ff00', '#f0ffb0'] }, sunset: { label: 'WAGMI Sunset', ramp: ['#3d0c45', '#e8505b', '#f9a03f', '#ffe29a'] },
    shadow: { label: 'Burn Ash', ramp: ['#0d0d12', '#2e2a3d', '#5b5470', '#9a90b5'] }, rarepepe: { label: 'Rare Pepe', ramp: ['#0f3d0f', '#3c9a2e', '#7ed957', '#d8ffb0'] } };
  function twinDraw(hex) { return stream('XCPETS:v2:twins:' + hex)() % TWIN_1_IN === 0; }
  function breedExtras(A, B, hex, kid) {
    var Rm = stream('XCPETS:v2:mutation:' + hex); if (Rm() % MUTATION_1_IN === 0) kid.mutation = { kind: Rm() % 2 ? 'glitch' : 'palette', hue: 60 + Rm() % 241, seed: Rm() }; if (kid.mutation && kid.mutation.kind === 'palette') { var PK = Object.keys(PALETTE_SETS); kid.mutation.set = PK[stream('XCPETS:v2:hybrid-parts:' + hex + ':palette')() % PK.length]; } /* looks only */
    var Rh = stream('XCPETS:v2:hidden:' + hex), car = [A, B].filter(function (p) { return p.hidden; });
    if (car.length) { var P = car[Rh() % car.length]; if (Rh() % 2 === 0) { kid.hidden = P.hidden; if (P.shows !== P.hidden) kid.shows = P.hidden; } }
    else if (Rh() % HIDDEN_FRESH_1_IN === 0) kid.hidden = HIDDEN_TRAITS[Rh() % HIDDEN_TRAITS.length].id;
    if (kid.hidden === 'oddeyes') { var Ro = stream('XCPETS:v2:oddeyes:' + hex); kid.oddEye = { eye: Ro() % 2, col: Ro() % ODD_EYE_COLOURS.length }; } /* which eye + its colour, fixed per pet (own stream) */
    if (kid.hybrid && A.tier === 3 && B.tier === 3) { var Rl = stream('XCPETS:v2:legmix:' + hex); if (Rl() % LEGMIX_1_IN === 0) {
      var pool = PetCore.SPECIES.map(function (x) { return x.id; }).filter(function (x) { return kid.hybrid.roots.indexOf(x) < 0; }), third = pool[Rl() % pool.length], L = partsFor(kid.hybrid.shape, third);
      kid.hybrid.legMix = third; kid.hybrid.featSp = third; kid.hybrid.parts = (kid.hybrid.parts || []).concat(L.length ? [{ sp: third, part: L[Rl() % L.length].id }] : []); } }
  }
  /** kinWhy(A, B): inbreeding guard reason (null = fine). Parent x child and siblings (any shared parent). Enforced for breeds at/after the gate. */
  function kinWhy(A, B) { if (!A || !B) return null; var pa = A.parents || [], pb = B.parents || [];
    if (pa.indexOf(B.id) >= 0) return 'That\u2019s its mom'; if (pb.indexOf(A.id) >= 0) return 'That\u2019s its kid';
    if (pa.some(function (x) { return pb.indexOf(x) >= 0; })) return 'They\u2019re siblings'; return null; }
  /** genOf(w, p): Gen 0 = hatched; bred child = max(parent gens) + 1 (display only, memoised per world). */
  var GEN_CACHE = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function genOf(w, p) { if (!p) return 0; var m = GEN_CACHE && w ? GEN_CACHE.get(w) : null; if (GEN_CACHE && w && !m) { m = {}; GEN_CACHE.set(w, m); }
    var go = function (q, d) { if (!q || !q.parents || q.parents.length < 2 || d > 200) return 0; if (m && m[q.id] != null) return m[q.id];
      var g = 1 + Math.max(go(w && w.byId[q.parents[0]], d + 1), go(w && w.byId[q.parents[1]], d + 1)); if (m) m[q.id] = g; return g; };
    return go(p, 0); }
  function mutationLabel(m) { if (!m) return ''; if (m.kind === 'glitch') return 'Glitch mutation'; var S = m.set && PALETTE_SETS[m.set]; return 'Palette mutation' + (S ? ': ' + S.label : ''); }
  function hiddenLabel(id) { var t = HIDDEN_TRAITS.filter(function (x) { return x.id === id; })[0]; return t ? t.label : id; }
  /** breederBadges(w, p): pet-scoped breeding badges (display only): FIRST LITTER, BREEDER (3+), ALL SIX USED (6/6), MAD SCIENTIST (a hybrid child),
   * SINGLE MOTHER (children with 3+ different partners), TWIN PARENT, plus the child's own MUTANT / TWIN / LEGENDARY MIX. */
  function breederBadges(w, p) { if (!p) return []; var out = [], kids = (p.children || []).map(function (id) { return w && w.byId[id]; }).filter(Boolean), mates = {};
    kids.forEach(function (c) { (c.parents || []).forEach(function (x) { if (x !== p.id) mates[x] = 1; }); });
    if (p.breeds >= 1) out.push({ id: 'first-litter', icon: '\uD83D\uDC23', name: 'FIRST LITTER', tip: 'Bred for the first time' });
    if (p.breeds >= 3) out.push({ id: 'breeder', icon: '\uD83C\uDFC5', name: 'BREEDER', tip: '3+ breeds' });
    if ((p.breedsV2 || 0) >= BREED_CAP_V2) out.push({ id: 'all-six', icon: '\uD83C\uDFC6', name: 'ALL SIX', tip: 'Used all ' + BREED_CAP_V2 + ' lifetime breeds' });
    if (kids.some(function (c) { return isHybrid(c.species); })) out.push({ id: 'mad-scientist', icon: '\uD83E\uDDEA', name: 'MAD SCIENTIST', tip: 'Made a hybrid' });
    if (Object.keys(mates).length >= 3) out.push({ id: 'single-mother', icon: '\uD83D\uDC5C', name: 'SINGLE MOTHER', tip: 'Children with 3+ different partners' });
    if (kids.some(function (c) { return c.twinOf; })) out.push({ id: 'twin-parent', icon: '\uD83D\uDC6F', name: 'TWIN PARENT', tip: 'Had twins' });
    if (p.twinOf) out.push({ id: 'twin', icon: '\u264A', name: 'TWIN', tip: 'Twin of #' + p.twinOf });
    if (p.mutation) out.push({ id: 'mutant', icon: '\uD83E\uDDEC', name: 'MUTANT', tip: mutationLabel(p.mutation) + ' (1 in ' + MUTATION_1_IN + ')' });
    if (p.hybrid && p.hybrid.legMix) out.push({ id: 'leg-mix', icon: '\uD83D\uDC51', name: 'LEGENDARY MIX', tip: 'Three-way look with ' + speciesLabel(p.hybrid.legMix) });
    if (p.burnLord) out.push({ id: 'burn-lord', icon: '\uD83D\uDD25', name: 'Burn Lord', tip: 'Burn Lord edition ' + p.burnLord.n + ' of ' + p.burnLord.of + ': top ' + p.burnLord.of + ' burner reward (rank ' + p.burnLord.rank + ', ' + Math.round(p.burnLord.total).toLocaleString('en-US') + ' XCPETS burned to the end of block ' + p.burnLord.gate.toLocaleString('en-US') + ')' });
    if (p.shows) out.push({ id: 'throwback', icon: '\uD83E\uDDEC', name: 'THROWBACK', tip: hiddenLabel(p.shows) + ' (skipped a generation)' });
    return out; }
  /** oddEyeHand(p, frame, eye, data, sil): pixels [{j, r}] of the hand-placed odd eye for this pet, or null (no spot, or it does not sit on eye pixels here). */
  function oddEyeHand(p, fi, eye, d, sil) { if (!p || !p.art || p.stage == null || p.stage < 1) return null;
    var sp = p.art.hybrid ? p.art.hybrid.shape : (p.art.species || p.species), E = ODD_EYE_SPOTS[sp] && ODD_EYE_SPOTS[sp][Math.min(5, p.stage)]; if (!E) return null; E = E[eye ? 1 : 0];
    var dy = 0; try { var m0 = keyedRender(sp, p.art, { stage: p.stage, frame: 0 }).keys, m1 = fi ? keyedRender(sp, p.art, { stage: p.stage, frame: fi }).keys : m0, best = -1;
      if (fi) for (var s = -3; s <= 3; s++) { var sc = 0; for (var j = 0; j < 1024; j++) { var y = (j >> 5) + s; if (y < 0 || y > 31 || y >= GROUND_ROW) continue; if (!!m0[j] === !!m1[y * 32 + (j & 31)]) sc++; } if (sc > best || (sc === best && Math.abs(s) < Math.abs(dy))) { best = sc; dy = s; } } } catch (e) { dy = 0; }
    var out = [], hit = 0, tot = 0; E[2].split('/').forEach(function (row, ry) { for (var rx = 0; rx < row.length; rx++) { var r = row[rx]; if (r === '.') continue; var x = E[0] + rx, y = E[1] + ry + dy; if (x < 0 || x > 31 || y < 0 || y > 31) continue; var j = y * 32 + x; if (!sil[j]) continue; out.push({ j: j, r: r });
      if (r !== 'g') { tot++; var a = d[j * 4], b = d[j * 4 + 1], c = d[j * 4 + 2], mn = Math.min(a, b, c), mx = Math.max(a, b, c); if (a + b + c < 200 || (mn > 200 && mx - mn < 45) || mx - mn < 30) hit++; } } });
    var own = !p.art.hybrid || p.art.hybrid.color === p.art.hybrid.shape; /* the species' own face: the spot is right by construction (palette mutations recolour lids, so no colour check) */
    return out.length && (own || (tot && hit / tot >= 0.5)) ? out : null; }
  /** lookFx(frames, keyFrames, p): mutation + shown hidden-trait looks on rendered frames (keyFrames = same render on a #ff00fe key). */
  function lookFx(fr, kf, p) { if (!p || (!p.mutation && !p.shows)) return fr;
    return fr.map(function (f, fi) { var m = (kf[fi] || kf[0]).data, d = Array.isArray(f.data) ? f.data.slice() : new f.data.constructor(f.data), sil = [], bb = { t: 32, b: -1, l: 32, r: -1 };
      for (var j = 0; j < 1024; j++) { sil[j] = !(m[j * 4] === 255 && m[j * 4 + 1] === 0 && m[j * 4 + 2] === 254) && (j >> 5) < GROUND_ROW; if (sil[j]) { var x = j & 31, y = j >> 5; bb.t = Math.min(bb.t, y); bb.b = Math.max(bb.b, y); bb.l = Math.min(bb.l, x); bb.r = Math.max(bb.r, x); } }
      (function () { var seen = [], best = []; for (var j0 = 0; j0 < 1024; j0++) { if (!sil[j0] || seen[j0]) continue; var comp = [], st = [j0]; seen[j0] = 1; while (st.length) { var c0 = st.pop(); comp.push(c0); [c0 - 1, c0 + 1, c0 - 32, c0 + 32].forEach(function (n) { if (n >= 0 && n < 1024 && sil[n] && !seen[n] && Math.abs((n & 31) - (c0 & 31)) <= 1) { seen[n] = 1; st.push(n); } }); } if (comp.length > best.length) best = comp; }
        if (best.length > 50) { var on = []; best.forEach(function (q) { on[q] = 1; }); bb = { t: 32, b: -1, l: 32, r: -1 }; for (var j1 = 0; j1 < 1024; j1++) { if (sil[j1] && !on[j1]) sil[j1] = false; if (sil[j1]) { var x = j1 & 31, y = j1 >> 5; bb.t = Math.min(bb.t, y); bb.b = Math.max(bb.b, y); bb.l = Math.min(bb.l, x); bb.r = Math.max(bb.r, x); } } } })(); /* the pet only (not the tier gem / sparkles) */
      var ink = function (j) { return d[j * 4] + d[j * 4 + 1] + d[j * 4 + 2] < 110; }, set = function (j, c) { d[j * 4] = c[0]; d[j * 4 + 1] = c[1]; d[j * 4 + 2] = c[2]; };
      var M = p.mutation; if (M && M.kind === 'palette' && M.set && PALETTE_SETS[M.set]) { var RP = PALETTE_SETS[M.set].ramp.map(function (hx) { return [1, 3, 5].map(function (i) { return parseInt(hx.slice(i, i + 2), 16); }); });
        for (var jp = 0; jp < 1024; jp++) if (sil[jp] && !ink(jp) && !(Math.min(d[jp * 4], d[jp * 4 + 1], d[jp * 4 + 2]) > 205 && Math.max(d[jp * 4], d[jp * 4 + 1], d[jp * 4 + 2]) - Math.min(d[jp * 4], d[jp * 4 + 1], d[jp * 4 + 2]) < 40) && d[jp * 4] + d[jp * 4 + 1] + d[jp * 4 + 2] >= 170) { /* eye whites, pupils, outline and dark mouth lines keep their colours */ var lu = (0.3 * d[jp * 4] + 0.59 * d[jp * 4 + 1] + 0.11 * d[jp * 4 + 2]) / 255, u = Math.max(0, Math.min(0.999, (lu - 0.15) / 0.8)) * 3, k0 = Math.floor(u), fz = u - k0;
          set(jp, [0, 1, 2].map(function (c) { return Math.round(RP[k0][c] + (RP[k0 + 1][c] - RP[k0][c]) * fz); })); } }
      else if (M && M.kind === 'palette') { var a = (100 + (M.hue - 60) % 160) * Math.PI / 180, /* always a big hue jump */ cs = Math.cos(a), sn = Math.sin(a);
        var H = [0.213 + cs * 0.787 - sn * 0.213, 0.715 - cs * 0.715 - sn * 0.715, 0.072 - cs * 0.072 + sn * 0.928, 0.213 - cs * 0.213 + sn * 0.143, 0.715 + cs * 0.285 + sn * 0.140, 0.072 - cs * 0.072 - sn * 0.283, 0.213 - cs * 0.213 - sn * 0.787, 0.715 - cs * 0.715 + sn * 0.715, 0.072 + cs * 0.928 + sn * 0.072];
        for (var j1 = 0; j1 < 1024; j1++) if (sil[j1] && !ink(j1)) { var r = d[j1 * 4], g = d[j1 * 4 + 1], b = d[j1 * 4 + 2], cl = function (v) { return Math.max(0, Math.min(255, Math.round(v))); };
          var nr = H[0] * r + H[1] * g + H[2] * b, ng = H[3] * r + H[4] * g + H[5] * b, nb = H[6] * r + H[7] * g + H[8] * b, gy = (nr + ng + nb) / 3; /* and a saturation boost so it reads at a glance */
          set(j1, [cl(gy + (nr - gy) * 1.8 + 8), cl(gy + (ng - gy) * 1.8 + 8), cl(gy + (nb - gy) * 1.8 + 8)]); } }
      if (M && M.kind === 'glitch') { var src = d.slice ? d.slice() : new d.constructor(d), R = stream('XCPETS:v2:glitch:' + M.seed + ':' + fi);
        for (var y1 = bb.t; y1 <= bb.b; y1++) { if ((y1 - bb.t) % 2) { var sh = sh0; } else { var sh0 = R() % 3 === 0 ? (R() % 2 ? 3 : -3) : 0, sh = sh0; } /* 2-row slices, 1 in 3, 3 px */ if (!sh) continue; for (var x1 = 0; x1 < 32; x1++) { var sx = x1 - sh; if (sx < 0 || sx > 31) continue; var t = y1 * 32 + x1, q = y1 * 32 + sx; if (!sil[q] && !sil[t]) continue; for (var c = 0; c < 3; c++) d[t * 4 + c] = src[q * 4 + c]; } }
        for (var j2 = 0; j2 < 1024; j2++) if (sil[j2] && (j2 & 31) <= bb.l + 1) set(j2, [0, 240, 255]); else if (sil[j2] && (j2 & 31) >= bb.r - 1) set(j2, [255, 40, 200]); }
      var T = p.shows, h = bb.b - bb.t + 1;
      var eyeY = 99; if (T === 'frost') { for (var ye = bb.t + 1; ye <= bb.t + Math.round(h * 0.6) && eyeY === 99; ye++) for (var xe = 1; xe < 31; xe++) { var je = ye * 32 + xe; if (!sil[je] || !sil[je - 1] || !sil[je + 1] || !sil[je - 32] || !sil[je + 32]) continue; var mn = Math.min(d[je * 4], d[je * 4 + 1], d[je * 4 + 2]), mx = Math.max(d[je * 4], d[je * 4 + 1], d[je * 4 + 2]); if (mn > 205 && mx - mn < 40) { eyeY = ye; break; } } } /* first row with an eye (pupil / eye white inside the body): frost stops above it */
      if (T === 'frost') for (var j3 = 0; j3 < 1024; j3++) { if (!sil[j3] || ink(j3) || (j3 >> 5) > Math.min(bb.t + Math.max(2, Math.round(h * 0.18)), Math.max(bb.t, eyeY - 1))) continue; set(j3, [Math.round(d[j3 * 4] * 0.4 + 150), Math.round(d[j3 * 4 + 1] * 0.4 + 160), Math.round(d[j3 * 4 + 2] * 0.4 + 170)]); } /* reverted to the subtler version (owner 11:26 PM CT) */
      if (T === 'socks') for (var j4 = 0; j4 < 1024; j4++) { if (!sil[j4] || ink(j4) || (j4 >> 5) < bb.b - Math.max(3, Math.round(h * 0.28))) continue; var cuff = (j4 >> 5) === bb.b - Math.max(3, Math.round(h * 0.28)); set(j4, cuff ? [200, 160, 255] : (j4 & 31) % 3 === 0 ? [95, 60, 140] : [Math.round(d[j4 * 4] * 0.12 + 55), Math.round(d[j4 * 4 + 1] * 0.1 + 28), Math.round(d[j4 * 4 + 2] * 0.15 + 95)]); } /* deep purple socks with ribbing and a bright cuff */
      if (T === 'oddeyes') { var OE = p.oddEye || { eye: (p.id || 0) % 2, col: (p.id || 0) % ODD_EYE_COLOURS.length }, OC = ODD_EYE_COLOURS[OE.col % ODD_EYE_COLOURS.length].rgb, yMax = bb.t + Math.round(h * 0.65);
        var inner = function (j) { return sil[j] && sil[j - 1] && sil[j + 1] && sil[j - 32] && sil[j + 32]; }, white = function (j) { var a = d[j * 4], b = d[j * 4 + 1], c = d[j * 4 + 2], mn = Math.min(a, b, c); return mn > 200 && Math.max(a, b, c) - mn < 45; };
        var comps = function (test) { var seen = [], out = []; for (var y = bb.t; y <= yMax; y++) for (var x = 1; x < 31; x++) { var j = y * 32 + x; if (seen[j] || !inner(j) || !test(j)) continue; var L = [], st = [j]; seen[j] = 1; while (st.length) { var c = st.pop(); L.push(c); [c - 1, c + 1, c - 32, c + 32].forEach(function (n) { if (n >= 0 && n < 1024 && !seen[n] && (n >> 5) <= yMax && inner(n) && test(n) && Math.abs((n & 31) - (c & 31)) <= 1) { seen[n] = 1; st.push(n); } }); } out.push(L); } return out; };
        var pairOf = function (C) { C = C.filter(function (L) { return L.length <= 40; }); var best = null; for (var a = 0; a < C.length; a++) for (var b = a + 1; b < C.length; b++) { var A = bbList(C[a]), B = bbList(C[b]), dy = Math.abs((A.t + A.b) - (B.t + B.b)) / 2, dx = Math.abs((A.l + A.r) - (B.l + B.r)) / 2; if (dy > 2 || dx < 3) continue; var sc = C[a].length + C[b].length - dy * 3 - Math.abs(C[a].length - C[b].length); if (!best || sc > best.sc) best = { sc: sc, L: A.l < B.l ? [C[a], C[b]] : [C[b], C[a]] }; } return best && best.L; };
        var HS = oddEyeHand(p, fi, OE.eye, d, sil); if (HS) { /* hand-placed spot (ODD_EYE_SPOTS) */
          var ring = [0, 0, 0, 0], inS = {}; HS.forEach(function (q) { inS[q.j] = 1; }); HS.forEach(function (q) { [q.j - 1, q.j + 1, q.j - 32, q.j + 32].forEach(function (n) { if (n < 0 || n > 1023 || inS[n] || !sil[n] || ink(n) || white(n)) return; ring[0] += d[n * 4]; ring[1] += d[n * 4 + 1]; ring[2] += d[n * 4 + 2]; ring[3]++; }); });
          var OCh = OC, dist = function (a, b) { return Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2) + Math.pow(a[2] - b[2], 2)); };
          if (ring[3]) { var av = [ring[0] / ring[3], ring[1] / ring[3], ring[2] / ring[3]]; if (dist(OC, av) < 110) { var dk = shadeRgb(OC, 0.62), lt = OC.map(function (n) { return Math.round(n + (255 - n) * 0.55); }); OCh = dist(dk, av) >= dist(lt, av) ? dk : lt; } } /* odd colour too close to the fur around the eye (gold on Snibby): darker or lighter, whichever reads */
          HS.forEach(function (q) { set(q.j, q.r === 'g' ? [255, 255, 255] : q.r === 'p' ? shadeRgb(OCh, 0.45) : OCh); });
          return Object.assign({}, f, { data: d }); }
        var EB = null, KRk = null; if (p.art) try { var spK = p.art.hybrid ? p.art.hybrid.shape : (p.art.species || p.species), KR = keyedRender(spK, p.art, { stage: p.stage == null ? 3 : p.stage, frame: fi }), AK = anatomy(KR.keys); KRk = []; for (var jk = 0; jk < 1024; jk++) if (KR.keys[jk] === 'eye' || KR.keys[jk] === 'pupil' || KR.keys[jk] === 'white' || (KR.keys[jk] === 'ink' && AK.eyeBox && (jk >> 5) >= AK.eyeBox.t && (jk >> 5) <= AK.eyeBox.b + 1)) KRk.push(jk); if (AK.eyeBox && AK.eyeBox.w >= 3 && KRk.length) EB = AK.eyeBox; else if (p.stage >= 4) { var KR4 = keyedRender(spK, p.art, { stage: 3, frame: fi }), A4 = anatomy(KR4.keys); if (A4.eyeBox) { var dyE = AK.bb.t - A4.bb.t; KRk = []; for (var j4k = 0; j4k < 1024; j4k++) if (KR4.keys[j4k] === 'eye' || KR4.keys[j4k] === 'pupil' || KR4.keys[j4k] === 'white') { var tq = j4k + dyE * 32; if (tq >= 0 && tq < 1024) KRk.push(tq); } EB = { l: A4.eyeBox.l, r: A4.eyeBox.r, t: A4.eyeBox.t + dyE, b: A4.eyeBox.b + dyE, w: A4.eyeBox.w, h: A4.eyeBox.h }; } } } catch (e) { EB = null; }
        if (EB) { var mid = (EB.l + EB.r) / 2, REG = {}, KK = KRk || [], RW = [], RK = []; /* the pet's own eye pixels (keyed render), the chosen side, grown by 1 */
          KK.forEach(function (q) { var x = q & 31; if ((x > mid) !== !!OE.eye) return; for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) { var n = q + oy * 32 + ox; if (n >= 0 && n < 1024 && Math.abs(((n & 31) - x)) <= 1) REG[n] = 1; } });
          Object.keys(REG).forEach(function (k2) { var q = +k2; if (!inner(q)) return; if (white(q)) RW.push(q); else if (d[q * 4] + d[q * 4 + 1] + d[q * 4 + 2] < 200 && KK.indexOf(q) >= 0) RK.push(q); });
          var pupK = RK.filter(function (q) { return [q - 1, q + 1, q - 32, q + 32].some(function (n) { return RW.indexOf(n) >= 0; }); });
          if (RW.length && pupK.length) { pupK.forEach(function (q) { set(q, shadeRgb(OC, 0.45)); }); RW.forEach(function (q) { set(q, OC); }); }
          else if (RW.length) RW.forEach(function (q) { set(q, OC); }); else if (RK.length) { RK.forEach(function (q) { set(q, OC); }); set(RK[0], [255, 255, 255]); }
          return Object.assign({}, f, { data: d }); }
        var W = pairOf(comps(white)), eyeL;
        if (W) { var E = W[OE.eye], Eb = bbList(E), pup = []; for (var y2 = Eb.t - 1; y2 <= Eb.b + 1; y2++) for (var x2 = Eb.l - 1; x2 <= Eb.r + 1; x2++) { var j2 = y2 * 32 + x2; if (x2 < 0 || x2 > 31 || y2 < 0 || y2 > 31 || !inner(j2) || white(j2)) continue; var nW = [j2 - 1, j2 + 1, j2 - 32, j2 + 32].filter(function (n) { return E.indexOf(n) >= 0; }).length; if (nW && ink(j2) && x2 > Eb.l - 1 && x2 < Eb.r + 1) pup.push(j2); }
          if (pup.length) { pup.forEach(function (q) { set(q, shadeRgb(OC, 0.45)); }); E.forEach(function (q) { set(q, OC); }); } /* bright iris, tinted white */
          else E.forEach(function (q) { set(q, OC); }); }
        else { var K = pairOf(comps(function (j) { return ink(j) && [j - 1, j + 1].every(function (n) { return !ink(n) || true; }); }).filter(function (L) { var B = bbList(L); return L.length <= 6 && [L[0] - 2, L[0] + 2].every(function (n) { return n >= 0 && n < 1024 && sil[n] && !ink(n) && !white(n); }) && B.t > bb.t + 2; })); if (K) { var E2 = K[OE.eye], Eb2 = bbList(E2); E2.forEach(function (q) { set(q, OC); }); [Eb2.t * 32 + Eb2.l].forEach(function (q) { if (sil[q]) set(q, [255, 255, 255]); }); } } } /* no eye whites: the whole dark eye takes the colour, with a glint */
      return Object.assign({}, f, { data: d }); }); }
  function breedOne(w, A, B, bh, tx, b, owner) {
    var c = breedChild(sha(bh + tx), A, B, b), art = PetCore.generate({ blockHash: bh, petId: tx + ':child', blockHeight: b });
    if (c.species === 'nakamoto' && naka777(b)) c.tier = 3; if (c.species === 'wizard' && !c.hybrid && wizTier2On(b)) { if (c.tier < 2) setWizTier(c, 'stats', 2); } else if (c.species === 'wizard' && !c.hybrid && wizTierOn(b)) setWizTier(c, 'stats'); if (tierSpeciesOn(b) && !c.hybrid) raiseTier(c, 'stats'); if (specialTierOn(b) && !c.hybrid && isSpecialSpecies(c.species) && c.species !== 'nakamoto' && c.tier < 2) setWizTier(c, 'stats', 2); /* COMMUNITY-SPECIES TIER: pure Kek/Wizard/FUNTRUMP child floored at Rare */ if (c.species === 'funtrump' && !c.hybrid && c.tier < 2) setWizTier(c, 'stats', 2); /* FUNTRUMP child: Rare (suit) at least; inert (no FUNTRUMP parent before ACTIVATE_FT_BREED_BLOCK) */ art.species = c.species; art.tierIndex = c.tier; art.tier = PetCore.TIERS[c.tier].id; art.baseStats = c.stats; if (c.species === 'funtrump' && !c.hybrid) { art.ftLook = ftLookOfTier(c.tier); if (!specialNamesOn(b)) art.defaultName = 'FUNTRUMP'; }
    if (c.hybrid) { var plan = hybridPlan(sha(bh + tx), c.species, b); art.species = plan.shape; art.hybrid = plan; }
    var fix = breedFixOn(b), capped = fix ? capTraits(art, c.tier) : null;
    if (b >= ACTIVATE_BREEDCARRY_BLOCK) [A, B].forEach(function (P) { (P.carried || []).forEach(function (cr) { if (c.stats[cr.stat] != null && c.stats[cr.stat] < cr.value) c.stats[cr.stat] = cr.value; }); }); /* carried stat floor */
    var bonus = hybridRateOn(b) && !c.hybrid && !isHybrid(A.species) && A.species === B.species ? bredTrueBonus(sha(bh + tx), art, c.tier, c.stats, fix) : null;
    var kid = mk(w, owner, noBornShades(art), b, 0, tx); kid.species = c.species; if (c.hybrid) kid.hybrid = art.hybrid; if (bonus) kid.breedBonus = bonus; if (capped && capped.length) kid.traitCap = capped; kid.parents = [A.id, B.id]; // no gear or care inherited: starts as an Egg (feed 69 to hatch)
    return kid;
  }
  function breed(w, A, B, bh, tx, b, owner) {
    var kid = breedOne(w, A, B, bh, tx, b, owner);
    [A, B].forEach(function (p) { p.breeds++; p.lastBreed = b; p.children.push(kid.id); if (breedV2On(b)) p.breedsV2 = (p.breedsV2 || 0) + 1; });
    if (b >= ACTIVATE_BREEDCARRY_BLOCK && B.owner !== owner && A.owner === owner) { var bk = Object.keys(A.stats).reduce(function (m, k) { return A.stats[k] > A.stats[m] ? k : m; }, Object.keys(A.stats)[0]);
      (B.carried = B.carried || []).push({ from: A.id, species: A.species, stat: bk, value: A.stats[bk], block: b, child: kid.id }); } /* breed carry: parent B (accepting owner, no egg) */
    if (breedV2On(b)) { breedExtras(A, B, sha(bh + tx), kid); /* breeding v2 (own streams; nothing above moves) */
      if (twinDraw(sha(bh + tx))) { var tw = breedOne(w, A, B, bh, tx + ':twin', b, owner); [A, B].forEach(function (p) { p.children.push(tw.id); }); /* twins: ONE breed (counts once), second egg = next pet id */
        tw.twinOf = kid.id; kid.twinOf = tw.id; breedExtras(A, B, sha(bh + tx + ':twin'), tw); } }
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
    var idSet = ids ? new Set(ids) : null; /* bigfix: Set lookup (same result as ids.indexOf, O(1) instead of O(n) per pet) */
    var ps = w.pets.filter(function (p) { return p.owner === owner && p.hungry && (!idSet || idSet.has(p.id)); });
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
  function feedPlan(ps) { var job = feedPlanJob(ps); job.step(Infinity); return job.result(); }
  /** feedPlanJob(pets): the feedPlan DP, resumable (bigfix 2026-10-20) so the UI can run it in slices and show progress. Same output as before. */
  function feedPlanJob(ps) {
    ps = ps.slice().sort(function (a, b) { return a.id - b.id; }); var n = ps.length, best = [{ c: 0, by: 0 }], j = 0;
    /* bigfix 2026-10-20: the DP only compares tag lengths, so lengths are worked out in O(1) (prefix sums of the base-32 id lengths)
     * and the tag text is built only for the groups that are picked. Same choices and same tags as the old enc(). */
    var bl = [0]; for (var q = 0; q < n; q++) bl.push(bl[q] + b32(ps[q].id).length);
    function encLen(i, j) { /* -> { len, kind: 'one' | 'fm' | 'fl' } or null; ties: fm before fl (the old stable sort) */
      var s = ps[i].id, e = ps[j].id; if (i === j) return { len: ('pet:feed:' + s).length, kind: 'one' };
      var best0 = null, fmLen = ('pet:fm:' + s + ':').length + Math.floor((e - s) / 5) + 1; if (fmLen <= MAX_TAG_BYTES) best0 = { len: fmLen, kind: 'fm' };
      var flLen = 'pet:fl:'.length + (bl[j + 1] - bl[i]) + (j - i); if (flLen <= MAX_TAG_BYTES && (!best0 || flLen < best0.len)) best0 = { len: flLen, kind: 'fl' };
      return best0; }
    function encTag(i, j, kind) { var s = ps[i].id, e = ps[j].id; if (kind === 'one') return 'pet:feed:' + s;
      if (kind === 'fl') return 'pet:fl:' + ps.slice(i, j + 1).map(function (p) { return b32(p.id); }).join('.');
      var nch = Math.floor((e - s) / 5) + 1, d = []; for (var k = 0; k < nch; k++) d.push(0); for (k = i; k <= j; k++) { var o = ps[k].id - s; d[Math.floor(o / 5)] |= 1 << (o % 5); }
      return 'pet:fm:' + s + ':' + d.map(b32).join(''); }
    function step(maxJ) { var stop = Math.min(n, j + maxJ);
      for (; j < stop; j++) { best[j + 1] = null;
        for (var i = j; i >= 0; i--) { var t = encLen(i, j); if (!t) { if (j - i > 30) break; continue; } var pr = best[i]; if (!pr) continue;
          var c = { c: pr.c + 1, by: pr.by + t.len, i: i, kind: t.kind }; if (!best[j + 1] || c.c < best[j + 1].c || (c.c === best[j + 1].c && c.by < best[j + 1].by)) best[j + 1] = c; } }
      return j >= n; }
    function result() {
    var out = [], at = n; while (at > 0) { var x = best[at]; x.tag = x.tag || encTag(x.i, at - 1, x.kind); var grp = ps.slice(x.i, at), amount = Math.round(grp.reduce(function (a, p) { return a + p.nextMeal; }, 0) * 1e8) / 1e8;
      out.unshift(grp.length === 1 ? { tag: x.tag, amount: amount, petId: grp[0].id, label: 'Feed #' + grp[0].id } : { tag: x.tag, amount: amount, petIds: grp.map(function (p) { return p.id; }), label: 'Feed ' + grp.length + ' pets' }); at = x.i; }
    out.forEach(function (p, k) { if (out.length > 1) p.label += ' (burn ' + (k + 1) + ' of ' + out.length + ')'; });
    return out; }
    return { step: step, result: result, total: n, done: function () { return j; } };
  }
  /** feedQueueAsync(w, owner, ids, nextBlock, onProgress(done, total)) -> Promise of the same plans as feedQueue, built in ~40 ms slices
   *  with a yield between them so the page never freezes (bigfix 2026-10-20, UI helper; rules unchanged). */
  function feedQueueAsync(w, owner, ids, nextBlock, onProgress) {
    var idSet = ids ? new Set(ids) : null, ps = w.pets.filter(function (p) { return p.owner === owner && p.hungry && (!idSet || idSet.has(p.id)); }), nb = nextBlock != null ? nextBlock : (w.tip || 0);
    if (nb < ACTIVATE_FEEDM_BLOCK || ps.length < 2 || !feedListOn(nb)) return Promise.resolve(feedQueue(w, owner, ids, nextBlock));
    var job = feedPlanJob(ps);
    return new Promise(function (res, rej) { (function go() { try { var t0 = Date.now(), fin = false, k = 50;
        while (!fin && Date.now() - t0 < 40) fin = job.step(k);
        if (onProgress) onProgress(job.done(), job.total); if (fin) return res(job.result()); setTimeout(go, 0); } catch (e) { rej(e); } })(); });
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
  function rollQueue(w, owner, ids, n) { var out = [], idS = new Set(ids); w.pets.forEach(function (p) { if (p.owner !== owner || !idS.has(p.id) || p.dead || p.released) return;
    for (var i = 0; i < (n || 1); i++) out.push(wheelOn((w.tip || 0) + 1) ? { tag: 'pet:spin', amount: COSTS.roll, label: 'Pepe Wheel spin (random pet)' } : { tag: 'pet:roll:' + p.id, amount: COSTS.roll, petId: p.id, label: 'Gear roll #' + p.id }); }); return out; } /* from ACTIVATE_WHEEL_RANDOM_BLOCK a roll is a wheel spin (random pet) */
  /** crollOn(tip): the play page offers the community roll only once the chain tip has reached ACTIVATE_CROLL_BLOCK (unknown tip => off). */
  function crollOn(tip) { return tip != null && Number(tip) >= ACTIVATE_CROLL_BLOCK; }
  function communityRollPlan(slot, tip) { var code = slot ? String(slot).toUpperCase() : ''; if (code && tip != null && Number(tip) >= ACTIVATE_SLOTNAME_BLOCK) { var nm = (SLOT_LABELS[code.toLowerCase()] || '').toUpperCase(); if (SLOT_NAME_CODES[nm]) code = nm; } var tag = 'pet:c:roll' + (code ? ':' + code : ''); return { tag: tag, amount: COSTS.croll, label: 'Community gear roll' }; }
  /** communityGear(w) -> worn community item ids (newest roll per slot, slot order). */
  function communityGear(w) { var g = (w.community && w.community.gear) || {}; return V2_SLOTS.filter(function (s) { return g[s]; }).map(function (s) { return g[s].item; }); }
  function communityFeedPlan(amount) { var scaled = UI_COSTS.feedMin !== COSTS.feedMin; amount = scaled ? r8(Number(amount)) : Math.floor(Number(amount)); if (!(amount + (scaled ? 5e-9 : 0) >= UI_COSTS.feedMin)) return { ok: false, error: 'minimum community feed is ' + UI_COSTS.feedMin }; /* halving: UI_COSTS = price at the next block */ return { ok: true, tag: 'pet:feed', amount: amount }; }
  /** autoEquipOps: for each selected pet and open slot, wear the best free (inventory) eligible item of the owner. */
  function autoEquipOps(w, owner, ids, block) {
    var used = {}, ops = [];
    w.pets.forEach(function (p) { if (p.owner !== owner || ids.indexOf(p.id) < 0 || p.dead) return;
      p.openSlots.concat(p.species === 'wizard' && slotOpen(p, 'weapon') ? ['weapon'] : []).forEach(function (sl) { var cur = wornIn(w, p.id, sl), best = cur;
        w.itemList.forEach(function (g) { if (g.owner === owner && g.on == null && !used[g.gid] && g.slot === sl && eligible(g.item, p.species, bodyOf(p), p.tier) && (!best || g.tier > best.tier)) best = g; });
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
        if (!slotOpen(p, sl)) return miss(pid, sl, slotLabel(sl) + ' slot not unlocked yet (capacity ' + p.capacity + ')');
        if (!eligible(outfit[sl], p.species, bodyOf(p), p.tier)) return miss(pid, sl, 'species-only legendary');
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
    if (!slotOpen(p, it.slot)) return { ok: false, why: slotLabel(it.slot) + ' slot not unlocked yet (capacity ' + p.capacity + '/6 grows with age + care)' };
    if (!eligible(it, p.species, bodyOf(p), p.tier)) return { ok: false, why: (it.origin ? it.origin.charAt(0).toUpperCase() + it.origin.slice(1) : 'species') + '-only legendary' };
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
  function buildTag(kind, o) { o = o || {}; var t = { hatch: 'pet:hatch', cfeed: 'pet:feed', feed: 'pet:feed:' + o.petId, roll: 'pet:roll:' + o.petId, spin: 'pet:spin', fight: 'pet:fight:' + o.a + ':' + o.b,
    accept: 'pet:accept:' + o.fightId, rumble: 'pet:rumble:' + o.petId, breed: 'pet:breed:' + o.a + ':' + o.b }[kind]; return t && utf8Len(t) <= MAX_TAG_BYTES ? t : null; }

  /** Ranking-page "where do my pets rank": ranked = [{rank, p}] (rank 1 = best). Returns the owner's entries with "#R of N" and a top/bottom X% note. */
  /** breedPicker(w, owner, tip, selA): cards for the breeding picker. Nakamoto + the community pet are left out silently (rule unchanged).
   * mine = owner's living pets (parent A), partners = every other living pet (parent B); each { p, why } where why = null if selectable. */
  function breedPicker(w, owner, tip, selA, pendIds) { /* pendIds (2026-10-20, display only): { id: 1 } pets in my unconfirmed breed burns -> 'breed burn waiting to confirm' */
    var bq = function (p) { return breedable(p, tip) || (pendIds && pendIds[p.id] ? 'breed burn waiting to confirm' : null); };
    var live = w.pets.filter(function (p) { return !p.dead && !p.released && (p.species !== 'nakamoto' || nakaNormal(tip)) && !p.community; });
    var PA = selA != null ? w.byId[selA] : null, why = function (p) { var r = bq(p); if (!r && selA != null && String(p.id) === String(selA)) r = 'already parent A'; if (!r && PA && breedV2On((tip || 0) + 1)) r = kinWhy(PA, p); return r || null; };
    return { mine: live.filter(function (p) { return p.owner === owner; }).map(function (p) { return { p: p, why: bq(p) || null }; }),
      partners: live.map(function (p) { return { p: p, why: why(p) }; }) }; }
  function myRanks(ranked, owner) { var n = ranked.length;
    return ranked.filter(function (r) { return r.p.owner === owner; }).map(function (r) {
      var top = r.rank <= n - r.rank + 1, pct = Math.max(1, Math.ceil((top ? r.rank : n - r.rank + 1) / n * 100));
      return { rank: r.rank, total: n, id: r.p.id, name: r.p.name, half: top ? 'top' : 'bottom', pct: pct, label: '#' + r.rank + ' of ' + n, note: (top ? 'top ' : 'bottom ') + pct + '%' }; }); }
  return { _lookSweep: lookSweep, lookPickGate: function () { return ACTIVATE_LOOK_PICK_BLOCK; }, lookPickOn: lookPickOn, _setLookPickActivation: function (b) { ACTIVATE_LOOK_PICK_BLOCK = b == null ? null : Number(b); }, LOOK_CODES: LOOK_CODES, LOOK_MAX_PAIRS: LOOK_MAX_PAIRS, lookDef: lookDef, lookCode: lookCode, ownedLooks: ownedLooks, lookPlan: lookPlan, lookPlans: lookPlans, _lookPick: lookPick, earnGate: function () { return ACTIVATE_EARN_BLOCK; }, earnOn: earnOn, _setEarnActivation: function (b) { ACTIVATE_EARN_BLOCK = b == null ? null : Number(b); }, EARN: EARN, EARN_LOOKS: EARN_LOOKS, earnedLooks: earnedLooks, questGate: function () { return ACTIVATE_QUEST_BLOCK; }, questOn: questOn, _setQuestActivation: function (b) { ACTIVATE_QUEST_BLOCK = b == null ? null : Number(b); }, QUESTS: QUESTS, QUEST_CODES: QUEST_CODES, QUEST_TIERS: QUEST_TIERS, FLAME_TIERS: FLAME_TIERS, POB_TIERS: POB_TIERS, questInfo: questInfo, questOdds: questOdds, questWhy: questWhy, questCost: questCost, questAway: questAway, questNap: questNap, questBusyWhy: questBusyWhy, walletBurned: walletBurned, flameTierOf: flameTierOf, flameLooksOf: flameLooksOf, pobOf: pobOf, shownLooks: shownLooks, isMythic: isMythic, questPlan: function (id, code, w, b) { var p = w && w.byId[id], free = !!(p && p.freeQuest && !(p.questHist && p.questHist.length)); return { tag: 'pet:quest:' + id + ':' + code, amount: free ? QUEST_FREE_MIN : costAt(w, QUESTS[code].base, b), label: QUESTS[code].name + ' #' + id + (free ? ' (free)' : '') }; }, auraPlan: function (id, on) { return { tag: 'pet:aura:' + id + ':' + (on ? 'on' : 'off'), amount: QUEST_FREE_MIN, label: (on ? 'Lights On' : 'Lights Out') + ' #' + id }; }, oneTieOn: oneTieOn, rebindGuardOn: rebindGuardOn, rebindGate: function () { return ACTIVATE_DEED_REBIND_BLOCK; }, _setRebindActivation: function (v) { ACTIVATE_DEED_REBIND_BLOCK = v == null ? null : Number(v); }, mintTiesOn: mintTiesOn, oneTieGate: function () { return ACTIVATE_ONE_TIE_PATH_BLOCK; }, _setOneTieActivation: function (v) { ACTIVATE_ONE_TIE_PATH_BLOCK = v == null ? null : Number(v); }, holderAt: holderAt, tokenOnly: function () { return TOKEN_ONLY; }, _setTokenOnly: function (v) { TOKEN_ONLY = !!v; }, petFilter: petFilter, petFilterMatch: petFilterMatch, petFilterSort: petFilterSort, OLD_MONEY_LABEL: OLD_MONEY_LABEL, oldMoney: oldMoney, oldMoneyBefore: function () { return ACTIVATE_BREED_135_BLOCK; }, ACTIVATE_SALES_BLOCK: ACTIVATE_SALES_BLOCK, salesGate: function () { return ACTIVATE_SALES_BLOCK; }, salesOn: salesOn, _setSalesActivation: function (b) { ACTIVATE_SALES_BLOCK = b; }, SALE_EXPIRY: SALE_EXPIRY, SALE_MAX_EXPIRY: SALE_MAX_EXPIRY, SALE_ORDER_LAG: SALE_ORDER_LAG, SALE_UNSELL_SETTLE: SALE_UNSELL_SETTLE, SALE_MIN: SALE_MIN, DEED_MIN: DEED_MIN, DEED_MAX: DEED_MAX, deedOk: deedOk, deedDesc: deedDesc, deedScan: deedScan, deedDescOk: deedDescOk, DEED_URL: DEED_URL, deedTag: deedTag, decTo36: decTo36, b36ToDec: b36ToDec, randomDeed: randomDeed, deedWhy: deedWhy, deedIssueWhy: deedIssueWhy, listWhy: listWhy, unsellWhy: unsellWhy, deedOf: deedOf, sellStep: sellStep, dexIndex: dexIndex, petFree: petFree, saleState: saleState, saleListing: saleListing, openListings: openListings, saleFill: saleFill, mintPlan: mintPlan, deedPlan: deedPlan, listPlan: listPlan, buyPlan: buyPlan, cancelPlan: cancelPlan, unsellTag: unsellTag, unsellPlan: unsellPlan, buyGuard: buyGuard, saleAmountText: saleAmountText, saleExpire: saleExpire, ACTIVATE_GIVE_BLOCK: ACTIVATE_GIVE_BLOCK, GIVE_SETTLE: GIVE_SETTLE, giveOn: giveOn, _setGiveActivation: function (b) { ACTIVATE_GIVE_BLOCK = b; }, spamCityGate: function () { return ACTIVATE_SPAM_CITY_BLOCK; }, rulesGate: function () { return ACTIVATE_SPAM_RULES_BLOCK; }, rulesOn: rulesOn, _setRulesActivation: function (b) { ACTIVATE_SPAM_RULES_BLOCK = b; }, isBurnAddr: isBurnAddr, mintId: mintId, giveGate: function () { return ACTIVATE_GIVE_BLOCK; }, _setSpamCityActivation: function (b) { ACTIVATE_SPAM_CITY_BLOCK = ACTIVATE_GIVE_BLOCK = ACTIVATE_SALES_BLOCK = b; }, giveWhy: giveWhy, giveLocks: giveLocks, giftMoves: giftMoves, givePlan: givePlan, giveBatches: giveBatches, SWAP_WINDOW: SWAP_WINDOW, swapWhy: swapWhy, swapOpen: swapOpen, swapsFor: swapsFor, swapPlan: swapPlan, swapOkPlan: swapOkPlan, swapNoPlan: swapNoPlan, giftsTo: giftsTo, playerNo: playerNo, playerAddr: playerAddr, playerCode: playerCode, parsePlayer: parsePlayer, hiPlan: { tag: 'pet:hi', amount: 0.00000001 },   ACTIVATE_RUGME_BLOCK: ACTIVATE_RUGME_BLOCK, rugGate: function () { return ACTIVATE_RUGME_BLOCK; }, rugOn: rugOn, _setRugActivation: function (b) { ACTIVATE_RUGME_BLOCK = b; }, breed135Gate: function () { return ACTIVATE_BREED_135_BLOCK; }, breed135On: breed135On, breedCost: breedCost, uiBreedFee: uiBreedFee, uiBreedFeeStr: uiBreedFeeStr, rugCost: rugCost, BREED_135: BREED_135, RUG_ACCEPT_COST: RUG_ACCEPT_COST, _setBreed135Activation: function (b) { ACTIVATE_BREED_135_BLOCK = b; }, AD_WINDOW: AD_WINDOW, parseReq: parseReq, reqTag: reqTag, reqText: reqText, meetsReq: meetsReq, petPower: petPower, ownsGear: ownsGear, adState: adState, openAds: openAds, onRug: onRug, adTag: adTag, RUG_AD_COST: RUG_AD_COST, adWhy: adWhy, rugCheck: rugCheck, reqWhy: reqWhy,
    ACTIVATE_AUTO_HALVING_BLOCK: ACTIVATE_AUTO_HALVING_BLOCK, autoHalvingOn: autoHalvingOn, _setAutoHalvingActivation: function (b) { ACTIVATE_AUTO_HALVING_BLOCK = b; }, ACTIVATE_FT_BREED_BLOCK: ACTIVATE_FT_BREED_BLOCK, ftBreedOn: ftBreedOn, _setFtBreedActivation: function (b) { ACTIVATE_FT_BREED_BLOCK = b; }, _setFtPoolFrom: function (b) { FT_POOL_FROM = b; }, breedOne: breedOne, ftOn: ftOn, ftColdOn: ftColdOn, ftArt: ftArt, ftRollTier: ftRollTier, ftLookOfTier: ftLookOfTier, FT_RARE_W: FT_RARE_W, FT_LEG_W: FT_LEG_W, _setFuntrumpActivation: function (b) { ACTIVATE_FUNTRUMP_BLOCK = b; }, ACTIVATE_FUNTRUMP_BLOCK: ACTIVATE_FUNTRUMP_BLOCK, FT_SP: FT_SP, ACTIVATE_WIZ_BREED_BLOCK: ACTIVATE_WIZ_BREED_BLOCK, wizBreedOn: wizBreedOn, _setWizBreedActivation: function (b) { ACTIVATE_WIZ_BREED_BLOCK = b; }, WIZ_SP: WIZ_SP, ACTIVATE_WIZ_TIER2_BLOCK: ACTIVATE_WIZ_TIER2_BLOCK, wizTier2On: wizTier2On, wizRollTier: wizRollTier, _setWizTier2Activation: function (b) { ACTIVATE_WIZ_TIER2_BLOCK = b; }, ACTIVATE_WIZ_TIER_BLOCK: ACTIVATE_WIZ_TIER_BLOCK, WIZ_FIXED_TIER: WIZ_FIXED_TIER, wizTierOn: wizTierOn, _setWizTierActivation: function (b) { ACTIVATE_WIZ_TIER_BLOCK = b; }, ACTIVATE_KEK_BLOCK: ACTIVATE_KEK_BLOCK, ACTIVATE_KEK_CARD_BLOCK: ACTIVATE_KEK_CARD_BLOCK, kekCardOn: kekCardOn, KEK_CARD_DROP_N: KEK_CARD_DROP_N, KEK_CARD_ITEM: KEK_CARD_ITEM, KEK_FROM_BLOCK: KEK_FROM_BLOCK, _setKekActivation: function (b) { ACTIVATE_KEK_BLOCK = b; }, kekOn: kekOn, kekColdOn: kekColdOn, kekArt: kekArt, kekActivation: function () { return ACTIVATE_KEK_BLOCK; }, ACTIVATE_WIZ_PRIORITY_BLOCK: ACTIVATE_WIZ_PRIORITY_BLOCK, WIZ_PRIORITY: WIZ_PRIORITY, _setWizPriorityActivation: function (b) { ACTIVATE_WIZ_PRIORITY_BLOCK = b; }, ACTIVATE_NO_NAKA_BLOCK: ACTIVATE_NO_NAKA_BLOCK, noNakaOn: noNakaOn, _setNoNakaActivation: function (b) { ACTIVATE_NO_NAKA_BLOCK = b; }, ACTIVATE_BREED_FIX_BLOCK: ACTIVATE_BREED_FIX_BLOCK, breedFixOn: breedFixOn, capTraits: capTraits, breed: breed, _setBreedFixActivation: function (b) { ACTIVATE_BREED_FIX_BLOCK = b; }, ACTIVATE_RUMBLE_OFF_BLOCK: ACTIVATE_RUMBLE_OFF_BLOCK, rumbleOff: rumbleOff, _setRumbleOffActivation: function (b) { ACTIVATE_RUMBLE_OFF_BLOCK = b; }, ACTIVATE_LEG_BOOST_BLOCK: ACTIVATE_LEG_BOOST_BLOCK, LEG_SCALE: LEG_SCALE, LEG_BOOST_W: LEG_BOOST_W, legBoostOn: legBoostOn, _setLegBoostActivation: function (b) { ACTIVATE_LEG_BOOST_BLOCK = b; }, ACTIVATE_GEAR_CAP_BLOCK: ACTIVATE_GEAR_CAP_BLOCK, gearCapOn: gearCapOn, repairGear: repairGear, _setGearCapActivation: function (b) { ACTIVATE_GEAR_CAP_BLOCK = b; }, ACTIVATE_HYBRID_RATE_BLOCK: ACTIVATE_HYBRID_RATE_BLOCK, HYBRID_RATE_1E9: HYBRID_RATE_1E9, hybridRateOn: hybridRateOn, draw1e9: draw1e9, bredTrueBonus: bredTrueBonus, BRED_TRUE_POOL: BRED_TRUE_POOL, BRED_TRUE_STAT: BRED_TRUE_STAT, _setHybridRateActivation: function (b) { ACTIVATE_HYBRID_RATE_BLOCK = b; }, ACTIVATE_TIER_SPECIES_BLOCK: ACTIVATE_TIER_SPECIES_BLOCK, TIER_UNLOCK: TIER_UNLOCK, tierSpeciesOn: tierSpeciesOn, tierPool: tierPool, pickTierSpecies: pickTierSpecies, minTierOf: minTierOf, relabelTiers: relabelTiers, _setTierSpeciesActivation: function (b) { ACTIVATE_TIER_SPECIES_BLOCK = b; }, CUTOFF_BLOCK: CUTOFF_BLOCK, ACTIVATE_NAKA_777_BLOCK: ACTIVATE_NAKA_777_BLOCK, naka777: naka777, hatchArt: hatchArt, SPECIES12: SPECIES12, ACTIVATE_NAKA_NORMAL_BLOCK: ACTIVATE_NAKA_NORMAL_BLOCK, nakaNormal: nakaNormal, LIVE_DEATH_FROM_BLOCK: LIVE_DEATH_FROM_BLOCK, RETIRED: RETIRED, resolveItem: resolveItem, itemOf: itemOf, readBurns: readBurns, importLive: importLive, migrateLoadout: migrateLoadout, setLiveEngine: setLiveEngine, V2_FROM_BLOCK: V2_FROM_BLOCK, BLOCKS_PER_DAY: BLOCKS_PER_DAY, WEEK: WEEK, COSTS: UI_COSTS, BASE_COSTS: COSTS, ACTIVATE_HALVING_BLOCK: ACTIVATE_HALVING_BLOCK, HALVING_DELAY: HALVING_DELAY, COMMUNITY_PET_ARRIVAL_BLOCKS: COMMUNITY_PET_ARRIVAL_BLOCKS, ACTIVATE_COMMUNITY_TRIGGER_BLOCK: ACTIVATE_COMMUNITY_TRIGGER_BLOCK, _setCommunityTriggerActivation: function (b) { ACTIVATE_COMMUNITY_TRIGGER_BLOCK = b; }, halvingOn: halvingOn, halving1Block: halving1Block, halvingBlocks: halvingBlocks, eraAt: eraAt, costAt: costAt, costsAt: costsAt, syncCosts: syncCosts, planAmount: planAmount, ACTIVATE_SPINS_BLOCK: ACTIVATE_SPINS_BLOCK, SPINS_MAX_PER_BURN: SPINS_MAX_PER_BURN, spinsOn: spinsOn, spinsLeft: spinsLeft, useSpinPlan: useSpinPlan, overflowSpins: overflowSpins, _setSpinsActivation: function (b) { ACTIVATE_SPINS_BLOCK = b; }, ACTIVATE_FIRESALE_BLOCK: ACTIVATE_FIRESALE_BLOCK, FIRE: { ODDS_1K: FIRE_ODDS_1K, WARN: FIRE_WARN, LEN: FIRE_LEN, COOLDOWN: FIRE_COOLDOWN, KEK_PAUSE: FIRE_KEK_PAUSE, PAY: FIRE_PAY, FEED_PAY: FIRE_FEED_PAY }, fireOn: fireOn, fireRoll: fireRoll, fireExtend: fireExtend, fireBlackout: fireBlackout, saleAt: saleAt, fireFactor: fireFactor, fireInfo: fireInfo, fullAt: fullAt, fireSpinsOf: function (w, a) { return (w && w.fireSpins && w.fireSpins[a]) || 0; }, _setFiresaleActivation: function (b) { ACTIVATE_FIRESALE_BLOCK = b; }, _setFireHashes: function (h) { FIRE_HASHES = h || {}; }, below: below, mealCost: mealCost, halvingInfo: halvingInfo, petThresholds0: petThresholds, _setHalvingActivation: function (b) { ACTIVATE_HALVING_BLOCK = b; }, _setCommunityPetArrivals: function (a) { COMMUNITY_PET_ARRIVAL_BLOCKS.length = 0; (a || []).forEach(function (x) { COMMUNITY_PET_ARRIVAL_BLOCKS.push(x); }); }, FEED_QUICK: FEED_QUICK, FEE_SATS: FEE_SATS, MAX_RELEASE_PER_BURN: MAX_RELEASE_PER_BURN,
    oneTieOn: oneTieOn, mintTiesOn: mintTiesOn, oneTieGate: function () { return ACTIVATE_ONE_TIE_PATH_BLOCK; }, _setOneTieActivation: function (v) { ACTIVATE_ONE_TIE_PATH_BLOCK = v == null ? null : Number(v); }, holderAt: holderAt, tokenOnly: function () { return TOKEN_ONLY; }, _setTokenOnly: function (v) { TOKEN_ONLY = !!v; }, petFilter: petFilter, petFilterMatch: petFilterMatch, petFilterSort: petFilterSort, OLD_MONEY_LABEL: OLD_MONEY_LABEL, oldMoney: oldMoney, oldMoneyBefore: function () { return ACTIVATE_BREED_135_BLOCK; }, ACTIVATE_SALES_BLOCK: ACTIVATE_SALES_BLOCK, salesGate: function () { return ACTIVATE_SALES_BLOCK; }, salesOn: salesOn, _setSalesActivation: function (b) { ACTIVATE_SALES_BLOCK = b; }, SALE_EXPIRY: SALE_EXPIRY, SALE_MAX_EXPIRY: SALE_MAX_EXPIRY, SALE_ORDER_LAG: SALE_ORDER_LAG, SALE_UNSELL_SETTLE: SALE_UNSELL_SETTLE, SALE_MIN: SALE_MIN, DEED_MIN: DEED_MIN, DEED_MAX: DEED_MAX, deedOk: deedOk, deedDesc: deedDesc, deedScan: deedScan, deedDescOk: deedDescOk, DEED_URL: DEED_URL, deedTag: deedTag, decTo36: decTo36, b36ToDec: b36ToDec, randomDeed: randomDeed, deedWhy: deedWhy, deedIssueWhy: deedIssueWhy, listWhy: listWhy, unsellWhy: unsellWhy, deedOf: deedOf, sellStep: sellStep, dexIndex: dexIndex, petFree: petFree, saleState: saleState, saleListing: saleListing, openListings: openListings, saleFill: saleFill, mintPlan: mintPlan, deedPlan: deedPlan, listPlan: listPlan, buyPlan: buyPlan, cancelPlan: cancelPlan, unsellTag: unsellTag, unsellPlan: unsellPlan, buyGuard: buyGuard, saleAmountText: saleAmountText, saleExpire: saleExpire, ACTIVATE_GIVE_BLOCK: ACTIVATE_GIVE_BLOCK, GIVE_SETTLE: GIVE_SETTLE, giveOn: giveOn, _setGiveActivation: function (b) { ACTIVATE_GIVE_BLOCK = b; }, spamCityGate: function () { return ACTIVATE_SPAM_CITY_BLOCK; }, rulesGate: function () { return ACTIVATE_SPAM_RULES_BLOCK; }, rulesOn: rulesOn, _setRulesActivation: function (b) { ACTIVATE_SPAM_RULES_BLOCK = b; }, isBurnAddr: isBurnAddr, mintId: mintId, giveGate: function () { return ACTIVATE_GIVE_BLOCK; }, _setSpamCityActivation: function (b) { ACTIVATE_SPAM_CITY_BLOCK = ACTIVATE_GIVE_BLOCK = ACTIVATE_SALES_BLOCK = b; }, giveWhy: giveWhy, giveLocks: giveLocks, giftMoves: giftMoves, givePlan: givePlan, giveBatches: giveBatches, SWAP_WINDOW: SWAP_WINDOW, swapWhy: swapWhy, swapOpen: swapOpen, swapsFor: swapsFor, swapPlan: swapPlan, swapOkPlan: swapOkPlan, swapNoPlan: swapNoPlan, giftsTo: giftsTo, playerNo: playerNo, playerAddr: playerAddr, playerCode: playerCode, parsePlayer: parsePlayer, hiPlan: { tag: 'pet:hi', amount: 0.00000001 },   ACTIVATE_RUGME_BLOCK: ACTIVATE_RUGME_BLOCK, rugGate: function () { return ACTIVATE_RUGME_BLOCK; }, rugOn: rugOn, _setRugActivation: function (b) { ACTIVATE_RUGME_BLOCK = b; }, breed135Gate: function () { return ACTIVATE_BREED_135_BLOCK; }, breed135On: breed135On, breedCost: breedCost, uiBreedFee: uiBreedFee, uiBreedFeeStr: uiBreedFeeStr, rugCost: rugCost, BREED_135: BREED_135, RUG_ACCEPT_COST: RUG_ACCEPT_COST, _setBreed135Activation: function (b) { ACTIVATE_BREED_135_BLOCK = b; }, AD_WINDOW: AD_WINDOW, parseReq: parseReq, reqTag: reqTag, reqText: reqText, meetsReq: meetsReq, petPower: petPower, ownsGear: ownsGear, adState: adState, openAds: openAds, onRug: onRug, adTag: adTag, RUG_AD_COST: RUG_AD_COST, adWhy: adWhy, rugCheck: rugCheck, reqWhy: reqWhy,
    burnLordsSnapshot: function () { return BURN_LORDS_SNAPSHOT_BLOCK; }, _setBurnLordsSnapshot: function (b) { BURN_LORDS_SNAPSHOT_BLOCK = b; }, burnLordsRank: burnLordsRank, burnLordArt: burnLordArt, BURN_LORDS_N: BURN_LORDS_N, electricGate: function () { return ACTIVATE_ELECTRIC_BLOCK; }, electricOn: electricOn, electricTier: electricTier, electricArt: electricArt, ELECTRIC_N: ELECTRIC_N, ELECTRIC_COST: ELECTRIC_COST, ELECTRIC_TIER_10K: ELECTRIC_TIER_10K, _setElectricActivation: function (b) { ACTIVATE_ELECTRIC_BLOCK = b == null ? null : Number(b); },
    ACTIVATE_SPECIAL_TIER_BLOCK: ACTIVATE_SPECIAL_TIER_BLOCK, specialTierOn: specialTierOn, specialRollTier: specialRollTier, SPECIAL_TIER: SPECIAL_TIER, _setSpecialTierActivation: function (b) { ACTIVATE_SPECIAL_TIER_BLOCK = b; }, ACTIVATE_AUTO_HALVING_BLOCK: ACTIVATE_AUTO_HALVING_BLOCK, autoHalvingOn: autoHalvingOn, _setAutoHalvingActivation: function (b) { ACTIVATE_AUTO_HALVING_BLOCK = b; }, ACTIVATE_FT_BREED_BLOCK: ACTIVATE_FT_BREED_BLOCK, ftBreedOn: ftBreedOn, _setFtBreedActivation: function (b) { ACTIVATE_FT_BREED_BLOCK = b; }, _setFtPoolFrom: function (b) { FT_POOL_FROM = b; }, breedOne: breedOne, ftOn: ftOn, ftColdOn: ftColdOn, ftArt: ftArt, ftRollTier: ftRollTier, ftLookOfTier: ftLookOfTier, FT_RARE_W: FT_RARE_W, FT_LEG_W: FT_LEG_W, _setFuntrumpActivation: function (b) { ACTIVATE_FUNTRUMP_BLOCK = b; }, ACTIVATE_FUNTRUMP_BLOCK: ACTIVATE_FUNTRUMP_BLOCK, FT_SP: FT_SP, ACTIVATE_WIZ_BREED_BLOCK: ACTIVATE_WIZ_BREED_BLOCK, wizBreedOn: wizBreedOn, _setWizBreedActivation: function (b) { ACTIVATE_WIZ_BREED_BLOCK = b; }, WIZ_SP: WIZ_SP, ACTIVATE_WIZ_TIER2_BLOCK: ACTIVATE_WIZ_TIER2_BLOCK, wizTier2On: wizTier2On, wizRollTier: wizRollTier, _setWizTier2Activation: function (b) { ACTIVATE_WIZ_TIER2_BLOCK = b; }, ACTIVATE_WIZ_TIER_BLOCK: ACTIVATE_WIZ_TIER_BLOCK, WIZ_FIXED_TIER: WIZ_FIXED_TIER, wizTierOn: wizTierOn, _setWizTierActivation: function (b) { ACTIVATE_WIZ_TIER_BLOCK = b; }, ACTIVATE_KEK_BLOCK: ACTIVATE_KEK_BLOCK, ACTIVATE_KEK_CARD_BLOCK: ACTIVATE_KEK_CARD_BLOCK, kekCardOn: kekCardOn, KEK_CARD_DROP_N: KEK_CARD_DROP_N, KEK_CARD_ITEM: KEK_CARD_ITEM, KEK_FROM_BLOCK: KEK_FROM_BLOCK, _setKekActivation: function (b) { ACTIVATE_KEK_BLOCK = b; }, kekOn: kekOn, kekColdOn: kekColdOn, kekArt: kekArt, kekActivation: function () { return ACTIVATE_KEK_BLOCK; }, ACTIVATE_WIZ_PRIORITY_BLOCK: ACTIVATE_WIZ_PRIORITY_BLOCK, WIZ_PRIORITY: WIZ_PRIORITY, _setWizPriorityActivation: function (b) { ACTIVATE_WIZ_PRIORITY_BLOCK = b; }, ACTIVATE_NO_NAKA_BLOCK: ACTIVATE_NO_NAKA_BLOCK, noNakaOn: noNakaOn, _setNoNakaActivation: function (b) { ACTIVATE_NO_NAKA_BLOCK = b; }, ACTIVATE_BREED_FIX_BLOCK: ACTIVATE_BREED_FIX_BLOCK, breedFixOn: breedFixOn, capTraits: capTraits, breed: breed, _setBreedFixActivation: function (b) { ACTIVATE_BREED_FIX_BLOCK = b; }, ACTIVATE_RUMBLE_OFF_BLOCK: ACTIVATE_RUMBLE_OFF_BLOCK, rumbleOff: rumbleOff, _setRumbleOffActivation: function (b) { ACTIVATE_RUMBLE_OFF_BLOCK = b; }, ACTIVATE_LEG_BOOST_BLOCK: ACTIVATE_LEG_BOOST_BLOCK, LEG_SCALE: LEG_SCALE, LEG_BOOST_W: LEG_BOOST_W, legBoostOn: legBoostOn, _setLegBoostActivation: function (b) { ACTIVATE_LEG_BOOST_BLOCK = b; }, ACTIVATE_GEAR_CAP_BLOCK: ACTIVATE_GEAR_CAP_BLOCK, gearCapOn: gearCapOn, repairGear: repairGear, _setGearCapActivation: function (b) { ACTIVATE_GEAR_CAP_BLOCK = b; }, ACTIVATE_HYBRID_RATE_BLOCK: ACTIVATE_HYBRID_RATE_BLOCK, HYBRID_RATE_1E9: HYBRID_RATE_1E9, hybridRateOn: hybridRateOn, draw1e9: draw1e9, bredTrueBonus: bredTrueBonus, BRED_TRUE_POOL: BRED_TRUE_POOL, BRED_TRUE_STAT: BRED_TRUE_STAT, _setHybridRateActivation: function (b) { ACTIVATE_HYBRID_RATE_BLOCK = b; }, ACTIVATE_TIER_SPECIES_BLOCK: ACTIVATE_TIER_SPECIES_BLOCK, TIER_UNLOCK: TIER_UNLOCK, tierSpeciesOn: tierSpeciesOn, tierPool: tierPool, pickTierSpecies: pickTierSpecies, minTierOf: minTierOf, relabelTiers: relabelTiers, _setTierSpeciesActivation: function (b) { ACTIVATE_TIER_SPECIES_BLOCK = b; }, CUTOFF_BLOCK: CUTOFF_BLOCK, ACTIVATE_NAKA_777_BLOCK: ACTIVATE_NAKA_777_BLOCK, naka777: naka777, hatchArt: hatchArt, SPECIES12: SPECIES12, ACTIVATE_NAKA_NORMAL_BLOCK: ACTIVATE_NAKA_NORMAL_BLOCK, nakaNormal: nakaNormal, LIVE_DEATH_FROM_BLOCK: LIVE_DEATH_FROM_BLOCK, RETIRED: RETIRED, resolveItem: resolveItem, itemOf: itemOf, readBurns: readBurns, importLive: importLive, migrateLoadout: migrateLoadout, setLiveEngine: setLiveEngine, V2_FROM_BLOCK: V2_FROM_BLOCK, BLOCKS_PER_DAY: BLOCKS_PER_DAY, WEEK: WEEK, COSTS: UI_COSTS, BASE_COSTS: COSTS, ACTIVATE_HALVING_BLOCK: ACTIVATE_HALVING_BLOCK, HALVING_DELAY: HALVING_DELAY, COMMUNITY_PET_ARRIVAL_BLOCKS: COMMUNITY_PET_ARRIVAL_BLOCKS, ACTIVATE_COMMUNITY_TRIGGER_BLOCK: ACTIVATE_COMMUNITY_TRIGGER_BLOCK, _setCommunityTriggerActivation: function (b) { ACTIVATE_COMMUNITY_TRIGGER_BLOCK = b; }, halvingOn: halvingOn, halving1Block: halving1Block, halvingBlocks: halvingBlocks, eraAt: eraAt, costAt: costAt, costsAt: costsAt, syncCosts: syncCosts, planAmount: planAmount, ACTIVATE_SPINS_BLOCK: ACTIVATE_SPINS_BLOCK, SPINS_MAX_PER_BURN: SPINS_MAX_PER_BURN, spinsOn: spinsOn, spinsLeft: spinsLeft, useSpinPlan: useSpinPlan, overflowSpins: overflowSpins, _setSpinsActivation: function (b) { ACTIVATE_SPINS_BLOCK = b; }, ACTIVATE_FIRESALE_BLOCK: ACTIVATE_FIRESALE_BLOCK, FIRE: { ODDS_1K: FIRE_ODDS_1K, WARN: FIRE_WARN, LEN: FIRE_LEN, COOLDOWN: FIRE_COOLDOWN, KEK_PAUSE: FIRE_KEK_PAUSE, PAY: FIRE_PAY, FEED_PAY: FIRE_FEED_PAY }, fireOn: fireOn, fireRoll: fireRoll, fireExtend: fireExtend, fireBlackout: fireBlackout, saleAt: saleAt, fireFactor: fireFactor, fireInfo: fireInfo, fullAt: fullAt, fireSpinsOf: function (w, a) { return (w && w.fireSpins && w.fireSpins[a]) || 0; }, _setFiresaleActivation: function (b) { ACTIVATE_FIRESALE_BLOCK = b; }, _setFireHashes: function (h) { FIRE_HASHES = h || {}; }, below: below, mealCost: mealCost, halvingInfo: halvingInfo, petThresholds0: petThresholds, _setHalvingActivation: function (b) { ACTIVATE_HALVING_BLOCK = b; }, _setCommunityPetArrivals: function (a) { COMMUNITY_PET_ARRIVAL_BLOCKS.length = 0; (a || []).forEach(function (x) { COMMUNITY_PET_ARRIVAL_BLOCKS.push(x); }); }, FEED_QUICK: FEED_QUICK, FEE_SATS: FEE_SATS, MAX_RELEASE_PER_BURN: MAX_RELEASE_PER_BURN,
    THRESHOLDS: THRESHOLDS, NAKAMOTO_THRESHOLDS: NAKAMOTO_THRESHOLDS, NAKAMOTO_MEAL_SIZES: NAKAMOTO_MEAL_SIZES, WIZARD_THRESHOLDS: WIZARD_THRESHOLDS, ACTIVATE_COMMUNITY_100X_BLOCK: ACTIVATE_COMMUNITY_100X_BLOCK, COMMUNITY_GROWTH_X: COMMUNITY_GROWTH_X, COMMUNITY_THRESHOLDS: COMMUNITY_THRESHOLDS, communityThresholds: communityThresholds, ACTIVATE_WIZ_COLD_BLOCK: ACTIVATE_WIZ_COLD_BLOCK, mythicCount: function (w) { /* every Mythic pet (alive, not released) + each community pet that reached Mythic (Bitcoin Wizard, same Mythic as everyone) */ return (w.pets || []).filter(function (p) { return p.stage === 5 && !p.dead && !p.released && !p.community; }).length + (w.wizardMythic ? 1 : 0); }, WIZ_EGG_COST: WIZ_EGG_COST, WIZ_SIGN_ITEM: WIZ_SIGN_ITEM, WIZ_SIGN_MIN: WIZ_SIGN_MIN, wizColdOn: wizColdOn, wizPoolOn: wizPoolOn, wizPoolFrom: function () { return WIZ_POOL_FROM; }, COMMUNITY_GOAL: COMMUNITY_GOAL, returnProgress: returnProgress, noBornShades: noBornShades, bornTraits: bornTraits, _breed: breed, BURN_ADDRESS: BURN_ADDRESS,
    ACTIVATE_WIZ_STAFF_BLOCK: ACTIVATE_WIZ_STAFF_BLOCK, ACTIVATE_CHUD_BEARD_BLOCK: ACTIVATE_CHUD_BEARD_BLOCK, ACTIVATE_CHUD_BEARD_PART_BLOCK: ACTIVATE_CHUD_BEARD_PART_BLOCK, beardPartOn: beardPartOn, CHUD_BEARD_PART: CHUD_BEARD_PART, BEARD_PART_EXCLUDE: BEARD_PART_EXCLUDE, _setChudBeardPartActivation: function (b) { ACTIVATE_CHUD_BEARD_PART_BLOCK = b; }, _pool: pool, _setEligB: function (b) { ELIG_B = b; }, partDef: partDef, CHUD_BEARD_ITEM: CHUD_BEARD_ITEM, BEARD_EXCLUDE: BEARD_EXCLUDE, bodyOf: bodyOf, beardOn: beardOn, _setChudBeardActivation: function (b) { ACTIVATE_CHUD_BEARD_BLOCK = b; }, WIZ_STAFF_ITEM: WIZ_STAFF_ITEM, slotOpen: slotOpen, staffOn: staffOn, COMMUNITY_GOAL_NAME: COMMUNITY_GOAL_NAME, COMMUNITY_PET: COMMUNITY_PET, ACTIVATE_SLOTNAME_BLOCK: ACTIVATE_SLOTNAME_BLOCK, SLOT_NAME_CODES: SLOT_NAME_CODES, COMMUNITY_WIZARD_NAME: COMMUNITY_WIZARD_NAME, STAGE_NAMES: STAGE_NAMES, V2_SLOTS: V2_SLOTS, NAKAMOTO_CAST_STAGE: NAKAMOTO_CAST_STAGE, castShowsNakamoto: castShowsNakamoto, SLOT_LABELS: SLOT_LABELS, slotLabel: slotLabel, newWins: newWins, newHatches: newHatches, TIER_LABELS: TIER_LABELS, equipCheck: equipCheck, pickerPieces: pickerPieces, catalogBySlot: catalogBySlot, BLACK_EYE_BLOCKS: BLACK_EYE_BLOCKS, FIGHT_WINDOW: FIGHT_WINDOW, ACTIVATE_FIGHT_GEAR_BLOCK: ACTIVATE_FIGHT_GEAR_BLOCK, fightGearOn: fightGearOn, _setFightGearActivation: function (b) { ACTIVATE_FIGHT_GEAR_BLOCK = b; CG_CACHE = null; },
    BREED_COOLDOWN: BREED_COOLDOWN, ACTIVATE_BREEDCARRY_BLOCK: ACTIVATE_BREEDCARRY_BLOCK, BREED_MAX: BREED_MAX, ACTIVATE_BREEDING_V2_BLOCK: ACTIVATE_BREEDING_V2_BLOCK, BREED_CAP_V2: BREED_CAP_V2, breedV2On: breedV2On, breedsLeft: breedsLeft, _setBreedingV2Activation: function (b) { ACTIVATE_BREEDING_V2_BLOCK = b; }, _anatomy: anatomy, _topDbg: function () { return TOPDBG; }, _keyedRender: keyedRender, kinWhy: kinWhy, genOf: genOf, breederBadges: breederBadges, lookFx: lookFx, hiddenLabel: hiddenLabel, HIDDEN_TRAITS: HIDDEN_TRAITS, ODD_EYE_COLOURS: ODD_EYE_COLOURS, ODD_EYE_SPOTS: ODD_EYE_SPOTS, _oddEyeHand: oddEyeHand, PALETTE_SETS: PALETTE_SETS, mutationLabel: mutationLabel, TWIN_1_IN: TWIN_1_IN, MUTATION_1_IN: MUTATION_1_IN, HIDDEN_FRESH_1_IN: HIDDEN_FRESH_1_IN, LEGMIX_1_IN: LEGMIX_1_IN, _breedExtras: breedExtras, twinDraw: twinDraw, HYBRID_PARTS: HYBRID_PARTS, hybridParts: hybridParts, partOk: partOk, partsFor: partsFor, ONE_EYED: ONE_EYED, PART_EXCLUDE: PART_EXCLUDE, partLabel: partLabel, ACTIVATE_BREED_UNCAPPED_BLOCK: ACTIVATE_BREED_UNCAPPED_BLOCK, breedCapOn: breedCapOn, BREED_WINDOW: BREED_WINDOW, TIER_LABELS: TIER_LABELS, SPECIES13: SPECIES13, ALL_GEAR: ALL, GEAR_BY_ID: BY_ID,
    sha: sha, day: day, weekOf: weekOf, seedBlockOfWeek: seedBlockOfWeek, pickSpecies: pickSpecies, thresholdsFor: thresholdsFor, mealFor: mealFor, mealsToMythic: mealsToMythic, stageFor: stageFor, wizardStage: wizardStage,
    isLegendary: isLegendary, eligible: eligible, legendaryOf: legendaryOf, pool: pool, pickItem: pickItem, capacity: capacity, parseTag: parseTag, battleBlock: battleBlock, breedBlock: breedBlock, sendBlock: sendBlock, fightable: fightable, acceptBlock: acceptBlock, acceptRejected: acceptRejected, releaseBatches: releaseBatches, burnSummary: burnSummary,
    validFeedAmount: validFeedAmount, ACTIVATE_WAGMI_BLOCK: ACTIVATE_WAGMI_BLOCK, wagmiOn: wagmiOn, ACTIVATE_WAGMI_PRIZE_BLOCK: ACTIVATE_WAGMI_PRIZE_BLOCK, WAGMI_PRIZE_N: WAGMI_PRIZE_N, wagmiPrizeOn: wagmiPrizeOn, _setWagmiPrizeActivation: function (b) { ACTIVATE_WAGMI_PRIZE_BLOCK = b; }, wagmiFirst: function (w, d) { return (w && w.wagmiFirst && w.wagmiFirst[d]) || []; }, ACTIVATE_WHEEL_RANDOM_BLOCK: ACTIVATE_WHEEL_RANDOM_BLOCK, wheelOn: wheelOn, ACTIVATE_ANY_SLOT_BLOCK: ACTIVATE_ANY_SLOT_BLOCK, anySlotOn: anySlotOn, ACTIVATE_MYTHIC_SLOTS_BLOCK: ACTIVATE_MYTHIC_SLOTS_BLOCK, mythicSlotsOn: mythicSlotsOn, _setMythicSlotsActivation: function (b) { ACTIVATE_MYTHIC_SLOTS_BLOCK = b; }, bagOf: bagOf, slotUnlock: slotUnlock, _setAnySlotActivation: function (b) { ACTIVATE_ANY_SLOT_BLOCK = b; }, _liveAt: liveAt, wheelPool: function (w, owner) { return wheelPool(w, owner, null, false); }, wheelWt: wheelWt, WHEEL_W: WHEEL_W, _setWheelRandomActivation: function (b) { ACTIVATE_WHEEL_RANDOM_BLOCK = b; }, streakOf: streakOf, _setWagmiActivation: function (b) { ACTIVATE_WAGMI_BLOCK = b; }, simulateFight: simulateFight, simulateSudden: simulateSudden, simulateTag: simulateTag, modesOn: modesOn, acceptCost: acceptCost, modeTeamCost: modeTeamCost, fightPets: fightPets, inOpenFight: inOpenFight, ACTIVATE_ARENA_MODES_BLOCK: ACTIVATE_ARENA_MODES_BLOCK, _setArenaModesActivation: function (b) { ACTIVATE_ARENA_MODES_BLOCK = b; }, replay: replay, breedChild: breedChild, breedable: breedable, feedQueue: feedQueue, feedQueueAsync: feedQueueAsync, feedBatches: feedBatches, feedPlan: feedPlan, feedListOn: feedListOn, FEED_LIST_BLOCK: FEED_LIST_BLOCK, _setFeedListActivation: function (b) { FEED_LIST_BLOCK = b; }, freeRolls: freeRolls, freeRollPlan: freeRollPlan, gravePlan: gravePlan, graveOn: graveOn, graveLocked: graveLocked, ACTIVATE_GRAVE_GEAR_BLOCK: ACTIVATE_GRAVE_GEAR_BLOCK, ACTIVATE_FOUNDER_BLOCK: ACTIVATE_FOUNDER_BLOCK, _setFounderActivation: function (b) { ACTIVATE_FOUNDER_BLOCK = b; }, _setFounderGrant: function (kit, credits) { if (kit) FOUNDER_KIT_PER_ROLL = kit; if (credits != null) FOUNDER_CREDITS_PER_ROLL = credits; }, founderGrant: function () { return { kit: FOUNDER_KIT_PER_ROLL.slice(), credits: FOUNDER_CREDITS_PER_ROLL }; }, FOUNDER_ROLLS: FOUNDER_ROLLS, ACTIVATE_CROLL_BLOCK: ACTIVATE_CROLL_BLOCK, _setCrollActivation: function (b) { ACTIVATE_CROLL_BLOCK = b; }, crollOn: crollOn, communityRollPlan: communityRollPlan, communityGear: communityGear, ACTIVATE_WIZ_HAT_CLEAR_BLOCK: ACTIVATE_WIZ_HAT_CLEAR_BLOCK, _setWizHatClearActivation: function (b) { ACTIVATE_WIZ_HAT_CLEAR_BLOCK = b; }, ACTIVATE_DEDUP_BLOCK: ACTIVATE_DEDUP_BLOCK, _setDedupActivation: function (b) { ACTIVATE_DEDUP_BLOCK = b; }, ownedCounts: ownedCounts, dampW: dampW, ACTIVATE_TOKENS_BLOCK: ACTIVATE_TOKENS_BLOCK, _setTokensActivation: function (b) { ACTIVATE_TOKENS_BLOCK = b; }, TOKEN_DROP_10K: TOKEN_DROP_10K, tokensOf: function (w, owner) { return (w && w.tokens && w.tokens[owner]) || 0; }, ACTIVATE_FEEDM_BLOCK: ACTIVATE_FEEDM_BLOCK, _setFeedmActivation: function (b) { ACTIVATE_FEEDM_BLOCK = b; }, rollQueue: rollQueue, communityFeedPlan: communityFeedPlan,
    autoEquipOps: autoEquipOps, outfitOps: outfitOps, outfitReport: outfitReport, hideAtOrBelow: hideAtOrBelow, familyTree: familyTree, buildTag: buildTag, wornOf: wornOf, reindex: reindex, myRanks: myRanks, breedPicker: breedPicker,
    HYBRID_NAMES: HYBRID_NAMES, HYBRID_CHANCE_10K: HYBRID_CHANCE_10K, HYBRID_RARITY_UP_10K: HYBRID_RARITY_UP_10K, HYBRID_TRUE_10K: HYBRID_TRUE_10K, isHybrid: isHybrid, hybridKey: hybridKey, hybridRoots: hybridRoots,
    hybridName: hybridName, speciesLabel: speciesLabel, samePairHybridRule: samePairHybridRule, hybridSpecies: hybridSpecies, hybridPlan: hybridPlan, hybridRender: hybridRender, hybridFrames: hybridFrames, castHybrids: castHybrids, wizHybridPairs: function () { return SPECIES12.map(function (s) { return s.id; }).concat(['nakamoto']).map(function (o) { return { other: o, a: 'hyb:wizard:' + o, b: 'hyb:' + o + ':wizard', nameA: HYBRID_NAMES['wizard:' + o], nameB: HYBRID_NAMES[o + ':wizard'] }; }); }, ACTIVATE_SIG_SHUFFLE_BLOCK: ACTIVATE_SIG_SHUFFLE_BLOCK, shuffleOn: shuffleOn, ACTIVATE_GEAR_AUDIT_BLOCK: ACTIVATE_GEAR_AUDIT_BLOCK, gaOn: gaOn, ACTIVATE_STAR_BATCH_BLOCK: ACTIVATE_STAR_BATCH_BLOCK, ACTIVATE_MYTHIC_DISCOUNT_BLOCK: ACTIVATE_MYTHIC_DISCOUNT_BLOCK, MYTHIC_DISCOUNT_CARE: MYTHIC_DISCOUNT_CARE, mythicDiscountOn: mythicDiscountOn, petThresholds: petThresholds, overflowRolls: overflowRolls, overflowRollPlan: overflowRollPlan, overflowEarned: overflowEarned, starBatchOn: starBatchOn, lockHint: function (id) { var L = SPECIES_LOCK[id]; return L ? '\uD83D\uDD12 ' + speciesLabel(L.sp) + '-only' : ''; }, itemView: function (id) { return view(itemOf(id)); }, ACTIVATE_LENNY_MONOCLE_BLOCK: ACTIVATE_LENNY_MONOCLE_BLOCK, monocleLennyOn: monocleLennyOn, eligBlock: function () { return ELIG_B; }, SPECIES_LOCK: SPECIES_LOCK, isHybrid3: isHybrid3, hybrid3Key: hybrid3Key, ACTIVATE_HYBRID3_BLOCK: ACTIVATE_HYBRID3_BLOCK, hybrid3On: hybrid3On, hybrid3Species: hybrid3Species, _setHybrid3Activation: function (b) { ACTIVATE_HYBRID3_BLOCK = b; } };
});
