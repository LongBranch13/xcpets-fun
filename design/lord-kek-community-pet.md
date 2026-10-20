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
The base is a bare Pepe in the pet-core Pepe style: heavy-lidded eyes looking to the side and wide brown lips, seated with his hands on his knees. The nemes is a signature gear piece, the same way the Wizard Hat is.
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
- Headwear: a hat or crown sits on top of the eye bulges. A Headwear roll replaces the nemes, as rolls do with the Wizard Hat.
- Guise: across the eye row (shades and goggles cover both eyes; a tear goes under the left eye).
- Layers (Outfits): a shendyt kilt or tunic over the lap. Armor adds a chest plate under the collar.
- Drip (back): a cape behind the body. At Mythic the wings stay behind the cape.
- Grip: his right hand (the viewer's left) on his knee.
- Footwear: his two feet.
- Mythic: the gold rim goes around the whole outline, wings and throne included.

## Signature gear (proposal, all ★ cosmetic; anything that enters the pool goes behind an ACTIVATE_*_BLOCK)
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

## Open questions for the owner (not guessed)
1. **Activation gate block:** which block does he arrive at? (Normally tip+6 at deploy. Until then the gate stays null and disabled.)
2. **Starting care:** does he start at 0, which means 69,000 to hatch? Or do the community burns made during the gap since the Wizard's Mythic (972,325) count toward him? Those burns currently count as community food with no pet.
3. **Wizard's run:** the Wizard already reached Mythic at block 972,325 and is in Cold Storage. Please confirm nothing else of his run has to finish first, for example the Join-us sign claims or the Wizard egg priority list.
4. **Card stats 25/38/42, element Eye, Rareness infinity:** are these flavour only, or do they map to anything (base stats, a fight bonus, an "Eye" element)? XCPETS has no element system today. I propose flavour only.
5. **Odds slot:** when Kek takes over the 1-in-777 slot, Wizard eggs stop coming from the pool, the same way Nakamoto eggs stopped. Is that intended? Or should the slot be shared?
6. Can the community gear roll replace his nemes (as with the Wizard Hat), or is the nemes locked on the community Kek?
7. Signature gear: which 4–6 pieces, and are the Wings Mythic-only or claimable by his feeders (like the Join-us sign)?
8. Player palette: is red/gold nemes OK, or would you prefer another colour? Does the community Kek keep the card's lapis?
9. Do Anubis, Horus, and the pyramid appear only in the farewell scene, or also as Mythic background?
10. Is his name final ("Lord Kek"), and should there be a role line ("Ruler of All Pepes")?
11. Is he a hybrid root for breeding, like 'wizard'?
