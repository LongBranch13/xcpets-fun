# Pepe Wheel: random-pet gear rolls (branch rare-room-v2, NOT live)

Owner final rule: Oct 22 2026, 12:59 AM CT. It replaces the 12:52 AM and 12:57 AM drafts.
Gate: `ACTIVATE_WHEEL_RANDOM_BLOCK` in js/v2-rules.js. It is `null` (off) now. At deploy, set it to the tip + about 6 and replace "coming soon, block set at deploy" in rules.html and pets.html.

## Rule (from the gate block)
- **Which burns:** every paid gear roll is a wheel spin. That covers the new tag `pet:spin` and the old `pet:roll:ID`; after the gate the ID in `pet:roll:ID` is ignored. The cost is still 345 XCPETS, and a burn below that is rejected as before.
- **Not affected:** `pet:fr:ID` (founder free rolls), `pet:of:ID` (Mythic overflow rolls), `pet:c:roll` (community) and lucky-drop tokens all stay per pet.
1. **Pick a pet.** The candidates are the burner's own pets that are alive (age and death are refreshed at the burn's block), not released, not community, and have at least 1 open slot.
   - They are sorted by #ID and weighted by tier, `WHEEL_W`: **Common 1, Uncommon 2, Rare 4, Legendary 8**.
   - `r = int(sha256(blockHash + txHash + 'XCPETS:v2:wheel-pet')[0..12], 16) mod (sum of weights)`. Walk the list, subtracting each pet's weight; the pet where r falls below 0 is picked.
2. **Roll for that pet exactly like `pet:roll:ID` today.** This uses the same stream, `sha256(blockHash + txHash + 'XCPETS:v2:gear-roll')`, and gives a random open slot. The pet's tier cap, species and signature pieces apply, ★ pieces only go to a Legendary, and the duplicate damping and the gated LORDKEK card drop work as before.
3. **Straight onto that pet.** It uses the same `wear()` as today, so it replaces whatever was in that slot and the old piece goes back to the stash. The per-device Auto-equip Off setting does not take wheel pieces back off (`g.wheel` is skipped in autoEquipChoice).
- **Fallback when no pet has an open slot:** the same weighted pick runs over all of the burner's living pets. The slot is `V2_SLOTS[int(gear-roll hash[16..24], 16) mod 6]`, the piece is rolled for that pet's species and tier, and it goes to the gear bag (unworn).
- **No living pet at all:** the burn is rejected (wasted). The site's send guard (V2Rules.sendBlock) never sends it: "you have no living pet".
- **Before the gate:** `pet:roll:ID` replays exactly as today and `pet:spin` is an unknown tag (rejected like any unknown tag).
- **Log:** `Pepe Wheel picked #ID (weight w of T): <piece> (<slot>) worn | -> gear bag`. The item gets `wheel: 1` and `rolledOn: ID`.

## Odds examples (weights 1/2/4/8)
- **Big wallet** (bc1pfvkp…3gqd at snap 972,561): 7,090 pets with an open slot (4,161 Common, 2,030 Uncommon, 656 Rare, 243 Legendary).
  - Per pet, per spin: a Common pet has 0.0078%, Uncommon 0.0156%, Rare 0.0313% and Legendary 0.0626%.
  - By tier: Common pets get 32.5% of spins, Uncommon 31.7%, Rare 20.5% and Legendary 15.2%.
- **Small wallet** (example): 3 Common + 1 Uncommon + 1 Legendary gives total weight 3 + 2 + 8 = 13.
  - Each Common pet has 7.7%, the Uncommon 15.4% and the Legendary 61.5%.
- **All-Legendary wallet** (15e15ua6A3…, 10 Legendary): 10% each.

## UI (gate on)
- Tap the wheel in the scene (or the 🎡 Spin the wheel · 345 button under it). That opens the normal burn confirm with `pet:spin · 345`, plus the rule and this wallet's per-pet odds.
- After a send, the wheel spins and Dan moves to his next line.
- When the burn confirms, the panel shows "Last spin: the wheel picked #ID Name · piece · tier" with a **👕 Wear it** button. That button opens the dressing room on that pet with that piece selected.
- Roll my best pet, the per-pet crew list and the species picker are not shown once the gate is on.
- Pet page and pet detail: "🎲 Roll for gear" becomes a "🎡 Spin the Pepe Wheel" link to #rare-room.
- Bulk "Roll gear" for selected pets (rollQueue) sends `pet:spin` burns.
- Gate off (today): the old wheel panel (Roll my best pet + crew list + species fold) is unchanged.

## Tests
- `node tools/wheel-random-test.js`: the gate is inert while null, rolls before the gate are unchanged, and the outcome is deterministic. Wheel pieces belong to the burner and its pet, ★ only goes to Legendary, synthetic `pet:spin` rows work, the weights are checked empirically and the wallet odds are printed.
- `node tools/replay-check.js --compare origin/main`: SAME.
