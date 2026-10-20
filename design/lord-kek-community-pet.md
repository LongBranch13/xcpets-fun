# Lord Kek: Community pet #3 (DESIGN ONLY, for owner review)
_Drafted Tue Oct 20 2026 ~5:55 PM CT on branch `lord-kek`. No art yet, no rule code, nothing live. Reference card: design/ref/lord-kek-card.jpg._

## The card (what we are matching)
"LORD KEK, RULER OF ALL PEPES". A green Pepe sits on a throne. He wears a blue and gold striped pharaoh nemes headdress. Gold Egyptian wings spread behind him. Also on the card: the Eye of Horus, an Illuminati pyramid with an eye, and Anubis and Horus standing on either side. Stats 25 / 38 / 42, element = Eye. Flavor text: "All Pepes worship Lord Kek as the most powerful Pepe in existence. ~Godhead~". Rareness Score: infinity.

## Community pet rules he follows (same as Nakamoto #1 and the Bitcoin Wizard #2)
- Nobody owns him. Every community burn feeds him. He never starves.
- Grows 100 times slower than a normal pet, with the same thresholds as the Wizard: hatch 69,000 · Juvenile 834,900 · Adult 2,214,900 · Elder 4,146,900 · **Mythic 6,906,900**.
- He wears whatever the community gear roll gives him (newest piece wins per slot), drawn by his own gear layer.
- He gets Mythic parity, the same as the Wizard: the stage label, the gold rim, and a count in the Mythic totals. He gets no Mythic discount and no overflow rolls, because those need an owner wallet.
- **At Mythic he goes into Cold Storage automatically.** This uses the same trigger as the Wizard: the first burn where his community care is at least 6,906,900, with the block and tx recorded. It works from replay, so a late deploy still finds the right block. After that he becomes a real breedable pet.
- **His egg slot in the hatch pool after Cold Storage (standing rule, Oct 20 4:44 PM CT):** his egg joins the random hatch pool and **takes the odds slot of the community pet before him, the Bitcoin Wizard**. That is the 1-in-777 hatch/pack roll (`sha(bh+id+'XCPETS:v2:naka777')`), which the Wizard took over from Nakamoto at 972,338. There is no direct-buy egg button. (See Q5 for what happens to Wizard eggs.)

## Sprite plan per stage (32x32, existing 8-bit style, ink outline, 4-frame bob, same API as WizardSprite)
The base is a bare Pepe in the pet-core Pepe style: heavy-lidded eyes looking to the side and wide brown lips, seated with his hands on his knees. The nemes is part of him (always drawn, never replaced; owner round 2).
| Stage | Look |
|---|---|
| Egg | Green egg with a gold/blue/gold nemes band and a small Eye of Horus on the front. |
| Hatchling | Small frog head and body, big eyes, no collar. |
| Juvenile | Seated frog, bigger, smug mouth. |
| Adult | Adds the gold usekh collar with lapis dots. |
| Elder | Sits on a brown throne with gold trim (the card pose). |
| Mythic | Throne, gold Egyptian wings behind him, a floating Eye of Horus above, a cyan Horus pectoral, and the standard gold Mythic rim with sparkles. |
Not drawn on purpose (too small at 32 px; could go in the farewell scene): Anubis, Horus, and the pyramid.

## Community version vs. player version
- **Community (the one original):** the card's colours, a lapis blue and gold nemes. Lapis stays the community badge, the same way purple was for the Wizard.
- **Player Lord Keks (after Cold Storage):** the same body. The nemes is red and gold, the red crown of Lower Egypt. Normal thresholds, rolled tier, normal hunger, normal growth, and they can breed. (The colour choice is open, see Q8.)

## Gear anchors (where gear is drawn on him)
- Headwear: none. The nemes is part of him, so Headwear rolls are recorded but not drawn.
- Grip: the LORDKEK Rare Pepe card (signature) or another rolled Grip piece.
- Guise: across the eye row (shades and goggles cover both eyes; a tear goes under the left eye).
- Layers (Outfits): a shendyt kilt or tunic over the lap. Armor adds a chest plate under the collar.
- Drip (back): a cape behind the body. At Mythic the wings stay behind the cape.
- Grip: his right hand (the viewer's left) on his knee.
- Footwear: his two feet.
- Mythic: the gold rim goes around the whole outline, wings and throne included.

## Signature gear: SUPERSEDED (round 2: the only signature piece is the LORDKEK Rare Pepe card; the table below is kept for history only)
| Piece | Slot | Flavor |
|---|---|---|
| Nemes of Kek | Headwear ★ | "Lapis for the community. Red for the rest." |
| Crook of Kek | Grip ★ | "Every Pepe a sheep." |
| Wings of Ra | Drip ★ (Mythic only, or claimable) | "Godhead." |
| Usekh collar | Outfits (Tier 2) | "Gold and lapis, on loan from the tomb." |
| Eye of Horus amulet | Guise (Tier 2) | "Element: Eye." |
| Capstone | Grip (Tier 1) | "The pyramid's missing piece." |

## His story (Cold Storage text, short lines)
**Lord Kek**
Before the memes, Kek was a frog-headed god of the dark.
Then the chat said "kek." Then Pepe.
Ruler of All Pepes.
All Pepes worship him. ~Godhead~

2026. The Bitcoin Wizard went into Cold Storage.
An egg was left behind, striped blue and gold.
Every burn fed it. Nobody owned it.
69,000 to hatch. 100× slower than any pet.
He wore whatever the community rolled.
6,906,900 burned.
**Mythic.**

He rose from the throne.
Walked into Cold Storage.
Next to the Wizard. Next to Nakamoto.
The throne stayed behind. So did an egg.
Now anyone can hatch one.

## Farewell scene (replayable, same frame as The Return and the Wizard farewell)
160×90 at 4×, about 14 s at 30 fps, a static frame under reduced motion, autoplay once per browser (keyed by the trigger tx), a "Watch the farewell" button in Cold Storage, and `?preview=kek`.
1. "COMMUNITY PET": the Mythic Kek on his throne in his current community gear, wings open. Counter: `6,906,900 burned`.
2. "Ruler of All Pepes": Anubis and Horus step in from the sides and bow. The pyramid's eye blinks.
3. "~Godhead~": the wings beat once and gold coins float up (reusing the coin arc).
4. "Into Cold Storage": the frost vault opens. He walks in, and the Wizard and Nakamoto silhouettes are inside.
5. Flash: "Mythic. Kept cold forever."
6. "A new egg appears…": the empty throne stays, and a red-and-gold striped player egg drops in. The line under it reads "Anyone can hatch one". (It does not mention 1 in 777, because odds stay internal.)
Archive entry #3 shows the block, tx, total, feeders, and the top 5 feeders, the same as the Wizard.

## Build checklist (only after owner OK)
1. Sprite module js/kek-sprite.js (a draft exists on the box, uncommitted, waiting for your design OK).
2. Gated `ACTIVATE_KEK_COMMUNITY_BLOCK = null` (disabled). At that block, w.community.nextPet = Kek. communityGap goes false, and the "#3 coming soon" placeholder becomes Lord Kek. Replay is SAME before the block.
3. Kek care counter, stage thresholds, community gear layer, panel/index/intro/archive wiring.
4. Gated `kekMythic` Cold Storage trigger plus the odds-slot swap (Q5). Farewell scene, archive #3, HatchBot copy.
5. Bump COMMUNITY_NEXT_NO to 4 for the gap after him.

## Owner decisions (Oct 20 2026 ~6:00 PM CT)
1. **Activation gate:** set to tip + ~6 at launch approval. Until then `ACTIVATE_KEK_BLOCK = null` (OFF) in js/v2-rules.js.
2. **Starting care:** every community burn after the Wizard's Mythic burn (block 972,325) counts toward Kek, counted back to then. (Sim with a fresh tip 972,389: 737,639 XCPETS from 42 burns by 9 wallets, so he would start as a Hatchling.)
3. **Egg slot:** when Kek goes into Cold Storage, his egg takes the 1-in-777 slot, so Wizard eggs end. There is no buy button and no `pet:hatchkek` tag.
4. **Card stats** (25/38/42, element Eye, Rareness ∞) are flavour only. They show as a small tap-to-see line ("Lord Kek · Community pet #3 · card") on his community card. They have no game effect.
5. **Hybrids:** player Lord Keks can breed and make hybrids, like the Wizard.

## Owner decisions, round 2 (Oct 20 2026 ~6:07 PM CT), FINAL (they replace the defaults drafted at 6:00 PM)
- **Headdress:** the nemes is part of him. It is always drawn and is never replaced or removed. Community Headwear rolls are still recorded in gearLog, but are never drawn on Kek. The same applies to player Keks.
- **Signature gear:** the **LORDKEK Rare Pepe card**. It is a tiny card held in his hand (Grip) showing the card art in miniature: a white frame with gold art, a green Kek and a lapis nemes. It is Kek-only. Item id `kek-card`. The gate is `ACTIVATE_KEK_CARD_BLOCK = null` (OFF), with no tag, no pool entry and no grant yet. The earlier gear proposals (Crook, Usekh, Wings of Ra, etc.) are dropped.
- **Gold wings:** Mythic-only, part of the Mythic sprite, not claimable.
- **Palettes:** community = blue/gold, player = red/gold.
- **Anubis, Horus and the pyramid:** only in the farewell scene.
- **Name:** "Lord Kek", final, with **no subtitle line**. Player pets default to the name "Kek"; the species label is "Lord Kek".
- **Growth and trigger:** 100 times slower, with Cold Storage triggering automatically at Mythic (community rules).

## How the LORDKEK card could be obtained (suggestion, not built)
**Recommended:** at Kek's Cold Storage, each wallet that fed him gets one free claim with a 1-sat `pet:kekcard` burn, the same way the Wizard's "Join us" sign works. It can only be worn by a player Kek. It is a ★ Kek-only cosmetic.
Afterwards it becomes a rare Kek-only star drop on gear rolls for player Keks. A suggested rate is 1 in 69 rolls of a Kek pet's Grip slot.
Alternatives:
- (a) Only the top 5 Kek feeders get it at Cold Storage. This is more exclusive and matches the "top burners" community suggestion.
- (b) It is a star drop only.
The owner picks one before `ACTIVATE_KEK_CARD_BLOCK` is set.

## Remaining defaults (owner can change)
- He only wears community rolls made from his gate block on. The Wizard's old rolls stay in gearLog but he doesn't wear them.
- The burn that sent the Wizard to Mythic, including any amount left over, stays the Wizard's. Kek's count starts with the next burn.
- The Mythic trigger fires only at or after his gate block. It records `w.kekMythic`.
- After his Cold Storage the placeholder reads "Community pet #4 coming soon".

## Owner decisions, round 3 (Oct 20 2026 ~6:12 PM CT), FINAL
1. **LORDKEK card, built gated off (`ACTIVATE_KEK_CARD_BLOCK = null`):**
   - Every wallet that fed Kek gets one free claim with `pet:kekcard` or `pet:kekcard:ID` (1 sat is enough). The claim opens only once Kek is in Cold Storage AND the card gate is reached. One claim per wallet. The card goes to the wallet's stash, or is worn at once if the tag names your own player Kek with an open Grip slot.
   - After that, 1 in 69 Grip rolls of a player Kek (`pet:roll`) give the card, using the salt `XCPETS:v2:kekcard`.
   - Only a player Kek can wear it. Hybrids can't, an owner-rule exception to the usual "hybrids wear both parents' signatures" rule.
   - The card is a lookup-only item record, so it is never in a roll pool. Before the gate, a `pet:kekcard` burn gets exactly the old unknown-tag rejection.
2. Kek wears only community gear rolled after his launch (confirmed).
3. The Wizard's Mythic burn, including any leftover, stays the Wizard's (confirmed).
4. **Hybrids go both ways, the same system as every species.**
   - 'kek' is a full hybrid root. hybridPlan picks the body from either parent with the same 50/50 draw. The colour and the signature feature come from the other parent. Three-way mixes shuffle all three.
   - Names exist in both orders for all 13 species plus the Wizard: kek:X = "Kek" + end (Kekpe, Kekge, Kekmoto…), X:kek = start + "kek" (Pekek, Dogkek, Nakek…), wizard:kek = Wikek / kek:wizard = Kekzard. 'kek' is added to the H3 three-way parts as Kek / kek / kek.
   - Kek as the body: the KekSprite body with its nemes, recoloured from the colour parent (skin from its body, nemes stripes from its accent, gold from its belly).
   - Kek as the colour: his canon (green / red / gold) recolours the other body.
   - Kek as the feature: his nemes top (head) or lappets (side).
   - The earlier "Pepe body only" mapping is removed.
   - Samples: previews/lord-kek-v3/hybrid-samples-both-ways.png.

## One-way hybrid audit (Oct 20 2026)
- **main:** all 13 species have names in both orders (156/156, HYBRID_NAMES). The body is picked from either root by hybridPlan (`shape = r[R() % 2]`), and three-way mixes are shuffled. No species is one-way.
  - Note: the legacy Nakamoto exclusion at js/v2-rules.js `hybridSpecies` (blocks 971,501–971,673) blocked Nakamoto hybrids in both directions. It did not make them one-way, and it has been off since 971,674.
  - The Wizard cannot breed on main (WIZ_CAN_BREED false), so he has no hybrids at all.
- **wizard-hybrids branch:** names in both orders for all 14 species (lines 807–808). Same hybridPlan. renderRoot / WIZ_SP draw the Wizard as body or colour. No species is one-way.
  - Note: the Wizard as a feature always uses his staff (in both directions).
- **Merge note:** wizard-hybrids and lord-kek both add a `renderRoot` and extend H3_ORDER. They need a hand merge (one renderRoot that handles both 'wizard' and 'kek').

## What is built on branch `lord-kek` (all OFF; replay SAME)
- js/kek-sprite.js (KekSprite v2: all stages, community blue/gold / player red/gold, built-in nemes, gear layer with Headwear ignored, LORDKEK card, Mythic wings + rim). Previews: previews/lord-kek-v2/ (v1 kept in previews/lord-kek/). It is loaded on the 8 pages that load wizard-sprite.js, and is unused while the gate is off.
- js/v2-rules.js (round 3 adds the card claim/drop and Kek as a full two-way hybrid root):
  - Gate and settings: `ACTIVATE_KEK_BLOCK` (null), `KEK_FROM_BLOCK` 972325, `KEK_CAN_BREED`, `ACTIVATE_KEK_CARD_BLOCK` (null), `KEK_CARD_ITEM`.
  - Tracking and trigger: `kekTrack` (care + Mythic trigger, which does nothing while the gate is null).
  - Activation: `cm.current/nextPet = 'kek'` once the gate is reached.
  - Egg slot: `kekArt`, plus the swap in the 1-in-777 slot (`KEK_POOL_FROM`).
  - Breeding: the breedable gate, Kek hybrid names, and Pepe-body hybrid art.
- js/v2-render.js / js/v2.js: Kek's community frames, gear and stats, player Kek frames, the card line, and #4 after his Cold Storage.
- Not built yet: the farewell scene, Archive entry #3, and the HatchBot copy (next step after art approval).

## Open questions for the owner
None blocking. Please confirm or change the defaults above.
