/* XCPETS PLAY DEMO core. PLAY MONEY ONLY: nothing here touches a chain, a wallet or real XCPETS.
 * The demo keeps a list of fake destroy rows (same shape as Counterparty API v2 rows, with pet: tags) and replays them
 * through the REAL GameCore.buildState (with the demo's cost/threshold config), so hatching, care, stages and the Mythic
 * evolve rule are the real game's code. Pet art comes from PetCore.generate(fake block hash, fake tx hash), with the real game's species odds.
 * Demo-only extra: gear is LOOT. Rarity decides slots (Common 0 / Uncommon 2 / Rare 4 / Legendary 5); items are rolled and are equipped by the player. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.DemoCore = factory(root.GameCore, root.PetCore, root.BonusGear);
})(this, function (GameCore, PetCore, BonusGear) {
  'use strict';
  var KEY = 'xcpets-play-demo-v3'; // same key: v3 saves (69,000 curve) migrate in place to v4 (meal curve), see migrate(); v2 saves (old 1,000,000 amounts) are ignored and the old key is removed
  var START = 69069;     // play XCPETS in a fresh wallet = exactly one pet Egg to Mythic (69 hatch + 9 meals)
  var REFILL = 345000;   // free top-up per Refill click
  var PLAYER = 'play-wallet';
  // PLAY DEMO rules only (the real game keeps GameCore.COSTS / PET_THRESHOLDS / COMMUNITY_THRESHOLDS).
  // Meal pacing: every personal-pet feed is one meal whose size depends on the pet's stage (MEAL_SIZES). Hatch 69 (straight to Hatchling, cheap rerolls),
  // Juvenile +2 meals (8,349), Adult +2 meals (22,149), Elder +2 meals (41,469), Mythic +3 meals (69,069). At Mythic care
  // the Evolve button ascends it with a 0 play XCPETS pet:evolve row (no extra burn). Egg to Mythic = 69 + 9 meals = 69,069:
  // at 1 meal a day that is day 9.
  // feedPet stays the 7 rules minimum so older saves' feed rows (any amount) keep their care; the demo enforces MEAL itself.
  // play/name are unused by the demo UI.
  // Stage-scaled meals (once a day since 2026-10-11): Hatchling 4,140 x 2 = 8,280; Juvenile 6,900 x 2 = 13,800; Adult 9,660 x 2 = 19,320;
  // Elder 9,200 x 3 = 27,600, then a free Evolve. 9 meals, 1 a day: Juvenile day 2, Adult day 4, Elder day 6, Mythic day 9
  // (same days and same 69,000 total as the old 26 meals at 3 a day: 1,380/2,300/3,220/3,450 x 6/6/6/8). The last meal of a stage
  // is capped to whatever is left to the next threshold (so migrated saves with odd care never overshoot a stage).
  var MEAL_SIZES = [0, 4140, 6900, 9660, 9200]; // by current stage (Hatchling..Elder)
  var MEAL = MEAL_SIZES[1];
  var MEALS = [0, 0, 2, 2, 2, 3]; // meals to reach each stage from the one before (Egg->Hatchling is the hatch)
  function careStage(care) { var k = 1; while (k < 4 && care >= DEMO_THRESHOLDS[k + 1]) k++; return k; }
  function mealFor(care) { if (care >= DEMO_THRESHOLDS[5]) return 0; var k = careStage(care); return Math.min(MEAL_SIZES[k], DEMO_THRESHOLDS[k + 1] - care); }
  function mealsUntil(care, target) { var n = 0; while (care < target) { care += mealFor(care); n++; } return n; }
  var DEMO_COSTS = { hatch: 69, feed: 7, feedPet: 7, meal: MEAL, play: 35, name: 173, evolve: 0, roll: 345 };
  var DEMO_THRESHOLDS = [0, 69, 8349, 22149, 41469, 69069];
  // Shared pet: 3x a personal pet, evenly 41,400 per stage, ascends on its own at 207,000 (no evolve burn).
  // Like the real game, EVERY valid play burn counts toward it.
  var DEMO_SHARED = [0, 41400, 82800, 124200, 165600, 207000];
  var RULES = { costs: DEMO_COSTS, petThresholds: DEMO_THRESHOLDS, communityThresholds: DEMO_SHARED };
  // Loot: base slots by rarity (pet-core gearSlots, GEAR_RANKS order); free-token drops: 25% per stage-up action, 2% per meal, max 1 per action.
  var SLOTS = ['band', 'armor', 'cape', 'weapon', 'crown'];
  var LISTS = { band: 'BANDS', armor: 'ARMORS', cape: 'CAPES', weapon: 'WEAPONS', crown: 'CROWNS' };
  // SLOT ROLL: the player picks an unlocked slot and pays DEMO_COSTS.roll (or spends a free roll token) to roll one item for it.
  // Free roll tokens: 25% per stage-up action, 2% per meal (every meal is >= bigFeedMin; max 1 per action). Each roll: 1% chance of a Slot Key.
  // A Slot Key permanently unlocks the pet's next bonus slot: face, then back, then feet (demo-only meme gear, see bonus-gear.js).
  var DROP = { stageUp: 0.25, bigFeed: 0.02, bigFeedMin: 7, key: 0.01 };
  var BONUS = ['face', 'back', 'feet'];
  // Bulk egg buys: each egg is its own pet:hatch burn row of the normal 69 (so it hatches straight to Hatchling under the real
  // rules); the pack discount is a play-money rebate on the wallet. Dozen = 12 for the price of 10; Case = a gross (144).
  var BULK = { dozen: { n: 12, price: 690, label: 'Dozen eggs' }, case: { n: 144, price: 6900, label: 'Case of eggs' } };
  // Extra (overlay) gear from bonus-gear.js: the bonus-slot items plus shared/signature items for the base slots.
  // Signature items (species set) roll and equip only on their own species.
  var EXTRA = (BonusGear && BonusGear.ITEMS) || [];
  var BONUS_ITEMS = EXTRA.filter(function (x) { return BONUS.indexOf(x.slot) >= 0; });
  function extraFor(slot, species) { return EXTRA.filter(function (x) { return x.slot === slot && (!x.species || x.species === species); }); }
  // Gear by rarity (pet-core's original rule): a pet's tier decides how many base slots it has, in GEAR_RANKS order
  // (Common 0, Uncommon 2 = band+armor, Rare 4 = +cape+weapon, Legendary 5 = +crown), all open from Hatchling.
  // Roll rarity also uses pet-core's own gear rule (weightedPick): items up to the pet's tier, weight w (10) x4 at its own tier.
  function baseSlots(p) { return p.stage >= 1 ? Math.min(SLOTS.length, PetCore.TIERS[p.art.tierIndex].gearSlots) : 0; }
  function tierPool(slot, species, tierIdx) {
    var extra = extraFor(slot, species).map(function (x) { return { id: x.id, label: x.label, t: x.tier, w: 10, species: x.species }; });
    var all = BONUS.indexOf(slot) >= 0 ? extra : PetCore[LISTS[slot]].map(function (x) { return { id: x.id, label: x.label, t: x.t, w: x.w || 10 }; }).concat(extra);
    var pool = all.filter(function (x) { return x.t <= tierIdx; });
    if (!pool.length && all.length) { var m = Math.min.apply(null, all.map(function (x) { return x.t; })); pool = all.filter(function (x) { return x.t === m; }); }
    return pool.map(function (x) { return { it: x, w: x.w * (x.t === tierIdx ? 4 : 1) }; });
  }

  function hex64(rand, zeros) {
    var s = '';
    for (var i = 0; i < 64; i++) s += Math.floor(rand() * 16).toString(16);
    return zeros ? new Array(zeros + 1).join('0') + s.slice(zeros) : s;
  }
  function fresh() { return { v: 4, balance: START, refills: 0, rows: [], blockHashes: {}, height: 900000, inv: [], equip: {}, nextUid: 1, drops: [], released: [], tokens: 0, keys: 0, bonus: {} }; }

  var artCache = {}; // hatchTx -> generated traits (pure function of the seed, so safe to share)
  // Feeding limit: each personal pet can be fed FEEDS_PER_DAY times per local calendar day (resets at local midnight).
  // Only pet:feed:ID burns count (the Feed meal button); evolve, hatch, gear rolls and shared-pet feeds don't.
  var FEEDS_PER_DAY = 1;
  var DAY = 86400000, NEGLECT_DAYS = 7;
  function midnight(t) { var d = new Date(t); d.setHours(0, 0, 0, 0); return d; }
  function dayKey(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); } // local date
  function Demo(storage, rand, now) {
    this.storage = storage || null;
    this.rand = rand || Math.random;
    this.now = now || function () { return new Date(); };
    this.s = this.load();
    // Pet Cemetery: the neglect clock starts now for an existing save (no retroactive deaths); fresh wallets save it with the first action.
    if (this.s.deathFrom == null) { this.s.deathFrom = +this.now(); if (this.s.rows && this.s.rows.length) this.save(); }
    this.neglect = true; // tests that time-travel through many days per action may switch neglect death off
  }
  Demo.prototype.load = function () {
    try {
      var raw = this.storage && this.storage.getItem(KEY);
      if (raw) { var s = JSON.parse(raw); if (s && s.v === 4) return s; if (s && s.v === 3) return migrate(s); }
      // v2 saves used the old 1,000,000 curve: drop them (balances/care would be ~14x off) and start a fresh wallet
      if (this.storage && this.storage.removeItem && this.storage.getItem('xcpets-play-demo-v2') != null) this.storage.removeItem('xcpets-play-demo-v2');
    } catch (e) { /* corrupt: start fresh */ }
    return fresh();
  };
  // v3 -> v4 (meal pacing): keep every row, so pets keep their care and simply sit on the new thresholds. Pets that
  // ascended under the 69,000 curve (care 41,469 + the 27,531 evolve burn = 69,000, just under the new 69,069) stay Mythic.
  var OLD_RULES = { costs: { hatch: 69, feed: 7, feedPet: 7, play: 35, name: 173, evolve: 27531 }, petThresholds: [0, 69, 10419, 24219, 41469, 69000], communityThresholds: DEMO_SHARED };
  function migrate(s) {
    var was = GameCore.buildState(s.rows || [], OLD_RULES).pets, now = GameCore.buildState(s.rows || [], RULES).pets;
    s.mythic = s.mythic || [];
    was.forEach(function (p, i) { if (p.ascended && !(now[i] && now[i].ascended) && s.mythic.indexOf(p.id) < 0) s.mythic.push(p.id); });
    s.v = 4;
    return s;
  }
  Demo.prototype.save = function () { if (this.storage) this.storage.setItem(KEY, JSON.stringify(this.s)); };
  Demo.prototype.reset = function () { this.s = fresh(); this.save(); };
  Demo.prototype.refill = function () { this.s.balance = round8(this.s.balance + REFILL); this.s.refills++; this.save(); return this.s.balance; };
  Demo.prototype.balance = function () { return this.s.balance; };

  function round8(n) { return Math.round(n * 1e8) / 1e8; }
  function err(msg) { var e = new Error(msg); e.demo = true; throw e; }

  /** Roll one item for slot on a pet of tier tierIdx (pet-core's gear rule, see tierPool). Bonus slots with nothing at or
   *  below the pet's tier fall back to the slot's lowest-rarity item. */
  Demo.prototype.rollItem = function (tierIdx, slot, species) {
    if (SLOTS.indexOf(slot) < 0 && BONUS.indexOf(slot) < 0) err('Unknown slot.');
    var pool = tierPool(slot, species, tierIdx), tot = pool.reduce(function (x, y) { return x + y.w; }, 0), r = this.rand() * tot, it = pool[pool.length - 1].it;
    for (var i = 0; i < pool.length; i++) { if (r < pool[i].w) { it = pool[i].it; break; } r -= pool[i].w; }
    return { uid: this.s.nextUid++, slot: slot, id: it.id, label: it.label, tier: it.t, tierId: PetCore.TIERS[it.t].id,
      bonus: BONUS.indexOf(slot) >= 0, overlay: !!(BonusGear && BonusGear.DEFS && BonusGear.DEFS[it.id]), species: it.species || null };
  };
  /** Per-roll odds of every item a pet of `species` and tier tierIdx can get in `slot` (for docs/tests). */
  Demo.rollOdds = function (tierIdx, slot, species) {
    var pool = tierPool(slot, species, tierIdx), tot = pool.reduce(function (x, y) { return x + y.w; }, 0), out = {};
    pool.forEach(function (x) { out[x.it.id] = (out[x.it.id] || 0) + x.w / tot; });
    return out;
  };
  /** Chance of each rarity per roll for a tier and base slot. */
  Demo.rarityOdds = function (tierIdx, slot, species) {
    var pool = tierPool(slot || 'band', species, tierIdx), tot = pool.reduce(function (x, y) { return x + y.w; }, 0), out = [0, 0, 0, 0];
    pool.forEach(function (x) { out[x.it.t] += x.w / tot; }); return out;
  };
  function speciesName(id) { var x = PetCore.SPECIES.filter(function (q) { return q.id === id; })[0]; return x ? x.label : id; }
  function slotOpen(s, p, slot) {
    var k = SLOTS.indexOf(slot);
    if (k >= 0) return k < baseSlots(p);
    k = BONUS.indexOf(slot);
    return k >= 0 && k < ((s.bonus || {})[p.id] || 0);
  }
  function slotErr(p, slot) {
    var k = SLOTS.indexOf(slot);
    return k >= 0 ? (p.stage < 1 ? 'Hatch first.' : 'A ' + PetCore.TIERS[p.art.tierIndex].label + ' pet has no ' + slot + ' slot (gear slots by rarity: Common 0, Uncommon 2, Rare 4, Legendary 5).') : 'The ' + slot + ' bonus slot needs a Slot Key.';
  }
  /** SLOT ROLL: pay DEMO_COSTS.roll play XCPETS (a fake burn that, like any plain burn, feeds the shared pet) or spend a free
   *  roll token, and roll an item for an unlocked slot of pet id. The item goes to the inventory and is auto-equipped when the
   *  slot is empty. 1% chance of a bonus Slot Key. Burn, roll and key are saved in ONE write. */
  Demo.prototype.roll = function (id, slot, useToken) {
    var p = alive(this.pet(id));
    if (!slotOpen(this.s, p, slot)) err(slotErr(p, slot));
    var tx = null;
    if (useToken) {
      if (!(this.s.tokens > 0)) err('No free roll tokens.');
      this.s.tokens--;
    } else {
      if (DEMO_COSTS.roll > this.s.balance) err('Not enough play XCPETS. Hit Refill (free).');
      tx = this.addRow(DEMO_COSTS.roll, 'demo:roll:' + id + ':' + slot);
    }
    var it = this.grant(this.rollItem(p.art.tierIndex, slot, p.art.species)), key = this.rand() < DROP.key;
    if (key) this.s.keys = (this.s.keys || 0) + 1;
    var eq = (this.s.equip[id] = this.s.equip[id] || {}), auto = eq[slot] == null;
    if (auto) eq[slot] = it.uid;
    this.s.drops.push({ uid: it.uid, tx: tx, roll: true, key: key });
    this.save();
    return { pet: this.pet(id), item: it, key: key, equipped: auto, token: !!useToken };
  };
  /** Use a Slot Key on pet id: permanently unlocks its next bonus slot (face, back, feet). */
  Demo.prototype.useKey = function (id) {
    var p = alive(this.pet(id));
    if (!(this.s.keys > 0)) err('No Slot Keys.');
    var b = (this.s.bonus = this.s.bonus || {}), n = b[id] || 0;
    if (n >= BONUS.length) err('All bonus slots are already unlocked.');
    b[id] = n + 1; this.s.keys--;
    this.save();
    return { pet: this.pet(id), slot: BONUS[n] };
  };
  Demo.prototype.grant = function (item) { this.s.inv.push(item); return item; };

  Demo.prototype.addRow = function (amount, tag) {
    var h = ++this.s.height, tx = hex64(this.rand);
    this.s.blockHashes[h] = hex64(this.rand, 18);
    this.s.rows.push({ tx_hash: tx, tx_index: this.s.rows.length + 1, block_index: h, source: PLAYER, asset: 'XCPETS', status: 'valid',
      quantity: Math.round(amount * GameCore.UNIT), tag: tag || '' });
    this.s.balance = round8(this.s.balance - amount);
    return tx;
  };
  /** One fake burn plus its loot roll, saved together in ONE write (a reload can't re-roll a drop). */
  Demo.prototype.burn = function (amount, tag, petId, zeroOk) {
    amount = Number(amount);
    if (!(amount > 0 || (zeroOk && amount === 0)) || !isFinite(amount)) err('Enter an amount above 0.');
    if (round8(amount) !== amount) err('At most 8 decimals.');
    if (amount > this.s.balance) err('Not enough play XCPETS. Hit Refill (free).');
    var before = petId != null ? (this.pet(petId) || { stage: 0 }).stage : 0;
    var tx = this.addRow(amount, tag);
    var st = this.state(), entry = null, i;
    for (i = 0; i < st.log.length; i++) if (st.log[i].tx_hash === tx) entry = st.log[i];
    var pid = entry && entry.petId, pp = pid ? st.byId[pid] : null, after = pp ? pp.stage : 0, drop = null;
    if (entry && entry.kind === 'hatch' && pid) (this.s.lastFed = this.s.lastFed || {})[pid] = +this.now();
    if (pid && !pp) pid = null;
    var chance = (pid && after > before) ? DROP.stageUp : ((pid && /^pet:feed:/.test(tag) && amount >= DROP.bigFeedMin) ? DROP.bigFeed : 0);
    if (chance && this.rand() < chance) { this.s.tokens = (this.s.tokens || 0) + 1; drop = { token: true }; this.s.drops.push({ token: true, tx: tx }); }
    this.save();
    if (drop) st = this.state();
    return { entry: entry, state: st, drop: drop };
  };
  Demo.prototype.pet = function (id) { var st = this.state(), all = st.pets.concat(st.cemetery || []); for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i]; return null; };
  /** Pet Cemetery guard: a dead pet can't be fed, evolved, rolled, keyed or equipped. */
  function alive(p) { if (!p) err('No such pet.'); if (p.dead) err((p.art.defaultName || 'This pet') + ' died of neglect (' + NEGLECT_DAYS + ' full demo days unfed) and rests in the Pet Cemetery. It can\'t be fed, evolved, rolled, keyed or equipped.'); return p; }
  /** Release (delete) a pet from the demo: no refund. Its equipped items go back to the inventory. Pet ids stay stable. */
  Demo.prototype.release = function (id) {
    var rp = this.pet(id); if (!rp) err('No such pet.'); if (rp.dead) err('Pets in the Pet Cemetery stay there.');
    (this.s.released = this.s.released || []).push(id);
    delete this.s.equip[id];
    this.save();
  };

  // The demo refuses burns the real game would reject, so play money is never wasted (the real game would keep the burn).
  Demo.prototype.hatch = function (amount) {
    amount = amount == null ? DEMO_COSTS.hatch : Number(amount);
    if (amount < DEMO_COSTS.hatch) err('Hatching costs at least ' + DEMO_COSTS.hatch.toLocaleString('en-US') + ' play XCPETS.');
    var r = this.burn(amount, 'pet:hatch', null);
    return { pet: r.state.byId[r.entry.petId], entry: r.entry, drop: r.drop };
  };
  Demo.prototype.feedsToday = function (id) {
    var f = (this.s.feedDays || {})[id];
    return f && f.day === dayKey(this.now()) ? f.n : 0;
  };
  Demo.prototype.feed = function (id, amount) {
    alive(this.pet(id));
    var today = dayKey(this.now()), used = this.feedsToday(id);
    if (used >= FEEDS_PER_DAY) err(FEEDS_PER_DAY === 1 ? 'Already fed today, back tomorrow.' : 'Fed ' + FEEDS_PER_DAY + '/' + FEEDS_PER_DAY + ' today, back tomorrow.');
    var p0 = this.pet(id);
    if (p0.ascended) err('Already Mythic.');
    if (p0.care >= DEMO_THRESHOLDS[5]) err('Full! Tap Evolve to Mythic.');
    var meal = mealFor(p0.care);
    if (amount == null) amount = meal;
    if (Number(amount) !== meal) err('This meal is exactly ' + meal.toLocaleString('en-US') + ' play XCPETS.');
    (this.s.feedDays = this.s.feedDays || {})[id] = { day: today, n: used + 1 }; // saved by burn() in the same write
    var log = ((this.s.feedLog = this.s.feedLog || {})[id] = this.s.feedLog[id] || {}), prevLog = log[today], prevLast = (this.s.lastFed = this.s.lastFed || {})[id];
    log[today] = used + 1; this.s.lastFed[id] = +this.now();
    var r;
    try { r = this.burn(amount, 'pet:feed:' + id, id); } catch (e) { this.s.feedDays[id] = { day: today, n: used }; if (prevLog) log[today] = prevLog; else delete log[today]; this.s.lastFed[id] = prevLast; throw e; }
    r.state.byId[id].feedsToday = used + 1;
    return { pet: r.state.byId[id], entry: r.entry, drop: r.drop };
  };
  /** EVOLVE: once care reaches the Mythic threshold (fed by meals), a free pet:evolve:ID row (0 play XCPETS, no extra burn)
   *  ascends the pet through the real game's evolve rule. */
  Demo.prototype.evolve = function (id) {
    var p = alive(this.pet(id)), need = DEMO_THRESHOLDS[5];
    if (p.ascended) err('Already Mythic.');
    if (p.care < need) err('Needs ' + need.toLocaleString('en-US') + ' care to evolve (' + mealsUntil(p.care, need) + ' more meals). Keep feeding.');
    var r = this.burn(0, 'pet:evolve:' + id, id, true);
    return { pet: r.state.byId[id], entry: r.entry, drop: r.drop };
  };
  /** Bulk hatch: n independent eggs (fresh fake block hash + burn id each), ONE save. Each egg is a stage-up (Egg -> Hatchling),
   *  so each rolls its own 25% free-token chance. Returns the new pets (in order) and the batch id. */
  Demo.prototype.hatchBulk = function (kind) {
    var b = BULK[kind];
    if (!b) err('Unknown pack.');
    if (b.price > this.s.balance) err('Not enough play XCPETS for a ' + b.label.toLowerCase() + ' (' + b.price.toLocaleString('en-US') + '). Hit Refill (free).');
    var txs = [], i, tokens = 0;
    for (i = 0; i < b.n; i++) txs.push(this.addRow(DEMO_COSTS.hatch, 'pet:hatch'));
    this.s.balance = round8(this.s.balance + b.n * DEMO_COSTS.hatch - b.price); // pack discount = rebate
    for (i = 0; i < b.n; i++) if (this.rand() < DROP.stageUp) { tokens++; this.s.drops.push({ token: true, tx: txs[i] }); }
    this.s.tokens = (this.s.tokens || 0) + tokens;
    var st = this.state(), byTx = {};
    st.pets.forEach(function (p) { byTx[p.hatchTx] = p; });
    var pets = txs.map(function (t) { return byTx[t]; }).filter(Boolean), lf = (this.s.lastFed = this.s.lastFed || {}), nowMs = +this.now();
    pets.forEach(function (p) { lf[p.id] = nowMs; });
    (this.s.batches = this.s.batches || []).push({ kind: kind, ids: pets.map(function (p) { return p.id; }) });
    this.save();
    return { pets: pets, tokens: tokens, batch: this.s.batches.length - 1, paid: b.price };
  };
  /** Release several pets in one save (no refund; their gear returns to the inventory). */
  Demo.prototype.releaseMany = function (ids) {
    var rel = (this.s.released = this.s.released || []), live = {}, self = this;
    this.state().pets.forEach(function (p) { live[p.id] = 1; });
    ids.forEach(function (id) { if (live[id] && rel.indexOf(id) < 0) { rel.push(id); delete self.s.equip[id]; } });
    this.save();
  };

  // ---------------------------------------------------------------- WAGMI to NGMI power ranking (cosmetic only)
  var SHITPOSTS = ['found a suspicious hat', 'argued with a pigeon', 'declared itself a final boss', 'started a thread about its feeding schedule',
    'tried to trade its own tail on the DEX', 'subtweeted the shared pet', 'mistook a chart for a snack', 'held an AMA nobody asked for'];
  var ROASTS = ['{n} has been fed less often than a dead memecoin', '{n} called the top and then fell asleep', '{n}\'s streak is a rug pull',
    '{n} is down bad and eating air', '{n} thinks "gm" counts as a meal'];
  function dayDiff(a, b) { return Math.round((midnight(a) - midnight(b)) / DAY); } // calendar days (DST-safe rounding)
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  /** Status of one pet: streak (consecutive fed days ending today, or yesterday if not fed yet today; a full day (fed the daily limit) counts 1.5),
   *  days since the last meal (a hatch counts as the first meal), hunger 1 -> 0 over 24 h since the last meal. */
  Demo.prototype.petStatus = function (p) {
    var now = +this.now(), log = (this.s.feedLog || {})[p.id] || {}, last = (this.s.lastFed || {})[p.id], d, k, days = 0, score = 0;
    if (last == null) last = now;
    for (d = log[dayKey(new Date(now))] ? 0 : 1; d < 3660; d++) {
      var t = new Date(now); t.setDate(t.getDate() - d); k = dayKey(t);
      if (!log[k]) break;
      days++; score += log[k] >= FEEDS_PER_DAY ? 1.5 : 1;
    }
    // missed = full calendar days with no meal since the last one (fed yesterday = 0 missed); neglected from 1 missed day
    var since = dayDiff(now, last), missed = Math.max(0, since - 1), kind = days > 0 ? 'streak' : (missed >= 1 ? 'neglected' : 'neutral');
    return { streakDays: days, score: score, daysSince: since, missed: missed, lastFed: last, kind: kind, hunger: Math.max(0, Math.min(1, 1 - (now - last) / DAY)) };
  };
  Demo.BADGES = {
    'Fire takes': 'streak of 3+ days', 'Roast mode': 'streak of 7+ days (roasts a bottom-ranked pet in this browser by name)',
    'Legendary drip': 'streak of 14+ days (gold glow)',
    'Cursed tweet thread': '1-2 days missed since the last meal', 'Flop era': '3-6 days missed', 'Shitpost encounters': '7+ days missed'
  };
  /** One ranking, WAGMI (top) to NGMI (bottom): streaks by score (desc), then neutral pets, then neglected pets by days since
   *  the last meal (asc), so the most neglected pet is dead last. */
  Demo.prototype.leaderboard = function (st) {
    st = st || this.state();
    var self = this, today = dayKey(this.now());
    var rows = st.pets.map(function (p) {
      var x = self.petStatus(p), badges = [], flavor = null;
      if (x.streakDays >= 14) badges.push('Legendary drip');
      if (x.streakDays >= 7) badges.push('Roast mode');
      if (x.streakDays >= 3) badges.push('Fire takes');
      if (x.kind === 'neglected') badges.push(x.missed >= 7 ? 'Shitpost encounters' : x.missed >= 3 ? 'Flop era' : 'Cursed tweet thread');
      if (badges.indexOf('Shitpost encounters') >= 0) flavor = p.art.defaultName + ' ' + SHITPOSTS[hash(p.id + ':' + today) % SHITPOSTS.length] + '.';
      return { id: p.id, name: p.art.defaultName, species: p.art.species, tier: p.art.tierIndex, stage: p.stageName, status: x, badges: badges, flavor: flavor };
    });
    var grp = { streak: 0, neutral: 1, neglected: 2 };
    rows.sort(function (a, b) {
      var g = grp[a.status.kind] - grp[b.status.kind];
      if (g) return g;
      if (a.status.kind === 'streak') return b.status.score - a.status.score || b.status.streakDays - a.status.streakDays || a.id - b.id;
      if (a.status.kind === 'neglected') return a.status.missed - b.status.missed || a.id - b.id;
      return a.id - b.id;
    });
    // Roast mode: roast another pet by name, picked (per roaster per day) from the bottom 3 other pets; template rotates daily
    rows.forEach(function (r) {
      if (r.badges.indexOf('Roast mode') < 0) return;
      var pool = rows.filter(function (o) { return o.id !== r.id; }).slice(-3);
      if (!pool.length) return;
      var h = hash(r.id + ':' + today), t = pool[h % pool.length];
      r.roast = r.name + ': "' + ROASTS[(h >>> 8) % ROASTS.length].replace('{n}', t.name) + '"'; r.roastTarget = t.id;
    });
    rows.forEach(function (r, i) { r.rank = i + 1; });
    return rows;
  };
  Demo.SHITPOSTS = SHITPOSTS; Demo.ROASTS = ROASTS;

  /** Plain feed of the shared pet (tag pet:feed, real-game feed minimum). No loot. */
  Demo.prototype.feedShared = function (amount) {
    if (Number(amount) < DEMO_COSTS.feed) err('Feeding needs at least ' + DEMO_COSTS.feed + ' play XCPETS.');
    var r = this.burn(amount, 'pet:feed', null);
    return { shared: r.state.shared, entry: r.entry };
  };

  // ---------------------------------------------------------------- equipping
  function item(s, uid) { for (var i = 0; i < s.inv.length; i++) if (s.inv[i].uid === uid) return s.inv[i]; return null; }
  function holder(s, uid) { for (var pid in s.equip) if ((s.released || []).indexOf(+pid) < 0) for (var sl in s.equip[pid]) if (s.equip[pid][sl] === uid) return { pet: +pid, slot: sl }; return null; }
  /** Put inventory item uid into its slot on pet id. The slot must be unlocked by the pet's stage. An item lives on one pet
   *  at a time: if it is on another pet it moves here; whatever was in this slot goes back to the inventory (swap). */
  Demo.prototype.equip = function (id, uid) {
    var p = alive(this.pet(id)), it = item(this.s, uid);
    if (!it) err('You don\'t own that item.');
    if (it.species && it.species !== p.art.species) err('Only a ' + speciesName(it.species) + ' can wear the ' + it.label + '.');
    if (!slotOpen(this.s, p, it.slot)) err(slotErr(p, it.slot));
    var h = holder(this.s, uid);
    if (h) delete this.s.equip[h.pet][h.slot];
    (this.s.equip[id] = this.s.equip[id] || {})[it.slot] = uid;
    this.save();
    return this.pet(id);
  };
  Demo.prototype.unequip = function (id, slot) {
    if (!this.s.equip[id] || this.s.equip[id][slot] == null) err('Nothing equipped there.');
    delete this.s.equip[id][slot];
    this.save();
    return this.pet(id);
  };
  Demo.prototype.inventory = function () {
    var s = this.s;
    return s.inv.map(function (it) { var h = holder(s, it.uid); return Object.assign({}, it, { on: h ? h.pet : null }); });
  };

  /** Full game state from the real indexer logic, plus art, progress, slots and equipped loot for each pet. */
  Demo.prototype.state = function () {
    var self0 = this, today = dayKey(this.now()), st = GameCore.buildState(this.s.rows, RULES), T = DEMO_THRESHOLDS, bh = this.s.blockHashes, s = this.s, rel = s.released || [];
    st.pets = st.pets.filter(function (p) { return rel.indexOf(p.id) < 0; });
    st.pets.forEach(function (p) { if ((s.mythic || []).indexOf(p.id) >= 0) { p.ascended = true; p.stage = 5; p.stageName = 'Mythic'; } }); // v3 Mythics
    st.byId = {};
    st.pets.forEach(function (p) {
      var ck = p.hatchTx; p.art = artCache[ck] || (artCache[ck] = PetCore.generate({ blockHash: bh[p.hatchBlock], petId: p.hatchTx }));
      p.next = p.ascended ? null : T[Math.min(5, p.stage + 1)]; // at Elder: meals fill care up to the Mythic threshold, then Evolve
      p.prev = T[p.stage] || 0;
      p.progress = (p.next == null || p.next <= p.prev) ? 1 : Math.max(0, Math.min(1, (p.care - p.prev) / (p.next - p.prev)));
      p.canEvolve = !p.ascended && p.stage === 4 && p.care >= T[5];
      p.mealsLeft = p.ascended ? 0 : mealsUntil(p.care, T[5]); p.mealsNext = p.next == null ? 0 : mealsUntil(p.care, p.next); p.meal = p.ascended ? 0 : mealFor(p.care);
      st.byId[p.id] = p;
      var fd = (s.feedDays || {})[p.id]; p.feedsToday = fd && fd.day === today ? fd.n : 0; p.feedLimit = FEEDS_PER_DAY;
      var lfm = (s.lastFed || {})[p.id]; if (lfm == null) { (s.lastFed = s.lastFed || {})[p.id] = +self0.now(); } // older saves: start the clock now
      p.hunger = Math.max(0, Math.min(1, 1 - (+self0.now() - s.lastFed[p.id]) / 86400000));
      var eq = s.equip[p.id] || {};
      var nbase = baseSlots(p); p.baseSlots = nbase; p.tierSlots = PetCore.TIERS[p.art.tierIndex].gearSlots;
      p.slots = SLOTS.map(function (slot, k) { var it = eq[slot] != null ? item(s, eq[slot]) : null; return { slot: slot, unlocked: k < nbase, item: it }; });
      var nb = (s.bonus || {})[p.id] || 0;
      p.bonusSlots = BONUS.map(function (slot, k) { var it = eq[slot] != null ? item(s, eq[slot]) : null; return { slot: slot, unlocked: k < nb, bonus: true, item: it }; });
      // pet-core variants go to gearOverride; overlay items (bonus + shared/signature extras) to extraGear for bonus-gear.js
      p.gearOverride = {}; p.extraGear = {};
      p.slots.concat(p.bonusSlots).forEach(function (sl) { if (sl.unlocked && sl.item) (sl.item.overlay || sl.bonus ? p.extraGear : p.gearOverride)[sl.slot] = sl.item.id; });
      p.bonusGear = p.extraGear;
    });
    // Neglect death (demo days = local calendar days): NEGLECT_DAYS full days with no meal => dead at the start of day 8.
    // Clock anchor = max(last meal/hatch, s.deathFrom); deathFrom is stamped the first time this code runs, so no old save loses a pet retroactively.
    // Mythic pets are exempt (they can no longer be fed). A dead pet's gear goes back to the inventory.
    var nowMs = +this.now(), neglect = this.neglect !== false; if (s.deathFrom == null) s.deathFrom = nowMs;
    st.pets.forEach(function (p) {
      p.dead = null; p.daysLeft = null; if (p.ascended || !neglect) return;
      var anchor = Math.max(s.lastFed[p.id], s.deathFrom), dies = midnight(anchor); dies.setDate(dies.getDate() + NEGLECT_DAYS + 1);
      if (nowMs >= +dies) { p.dead = { at: +dies, cause: 'neglect' }; delete s.equip[p.id];
        p.slots.concat(p.bonusSlots).forEach(function (sl) { sl.item = null; }); p.gearOverride = {}; p.extraGear = {}; p.bonusGear = p.extraGear; }
      else p.daysLeft = dayDiff(+dies, nowMs); // 1 = today is the last day to feed
    });
    st.cemetery = st.pets.filter(function (p) { return p.dead; }).sort(function (a, b) { return b.dead.at - a.dead.at || b.id - a.id; });
    st.pets = st.pets.filter(function (p) { return !p.dead; });
    var c = st.community, cp = DEMO_SHARED[c.stage] || 0;
    st.shared = { burned: c.burned, stage: c.stage, stageName: c.stageName, next: c.next,
      progress: c.next == null ? 1 : Math.max(0, Math.min(1, (c.burned - cp) / (c.next - cp))) };
    st.log.forEach(function (l) { var m = /^demo:roll:(\d+):(\w+)$/.exec(l.tag || ''); if (m) { l.msg = 'slot roll for pet #' + m[1] + ' (' + m[2] + '); also feeds the shared pet'; l.petId = +m[1]; } });
    st.tokens = s.tokens || 0; st.keys = s.keys || 0;
    st.balance = s.balance; st.refills = s.refills; st.inventory = this.inventory();
    return st;
  };

  Demo.NEGLECT_DAYS = NEGLECT_DAYS; Demo.COSTS = DEMO_COSTS; Demo.THRESHOLDS = DEMO_THRESHOLDS; Demo.SHARED = DEMO_SHARED; Demo.SLOTS = SLOTS; Demo.DROP = DROP; Demo.BONUS = BONUS; Demo.BONUS_ITEMS = BONUS_ITEMS; Demo.EXTRA = EXTRA; Demo.BULK = BULK; Demo.FEEDS_PER_DAY = FEEDS_PER_DAY; Demo.MEAL = MEAL; Demo.MEALS = MEALS; Demo.MEAL_SIZES = MEAL_SIZES; Demo.mealFor = mealFor;
  Demo.KEY = KEY; Demo.START = START; Demo.REFILL = REFILL; Demo.PLAYER = PLAYER;
  return Demo;
});
