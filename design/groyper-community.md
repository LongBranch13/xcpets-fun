# Groyper: community pet #7 (Nov 24 2026)

Owner picked him Nov 4 2026 (brief: groyper-brief.zip, owner drawing). A comfy meme frog: green, big orange lips, fingers together, side-eye.
No political symbols, slogans or movement references in art, names, lore or prizes.

## Status
ON (owner Nov 24 2026): `ACTIVATE_GROYPER_BLOCK = ACTIVATE_GP_BREED_BLOCK = 977,400`. The gate alone changes nothing: `gpLive(b)` (gate reached AND the White Rabbit in Cold Storage, `b >= WR_POOL_FROM`) keeps his gear out of roll pools and his parts out of 3-way hybrids until he is the community pet. Replay output unchanged (rebuild-bench SAME).

## Launch (owner: "he goes live when the rabbit goes to cold storage")
Set both gates to deploy tip + ~6, one rules PR on its own, merged BEFORE the White Rabbit reaches Mythic. Then the hand-off is automatic:
the burn that takes the Rabbit to Mythic puts him in Cold Storage, and every later burn feeds Groyper (`COMMUNITY_HANDOFF[2]`).
If the gate lands after the Rabbit's Mythic, the site shows "Community pet #7 coming soon" until the gate block, and Groyper's care still counts from the Rabbit's Mythic burn.

## What he has
- Sprite `js/groyper-sprite.js`: Egg (peeking eyes), Hatchling (tadpole tail), Juvenile, Adult, Elder, Mythic (gold rim + pond FX in `js/mythic-sig.js`). 4 frames: breath, blink, side-eye with a finger tap.
- Gear: Lily pad (signature Footwear, he sits on it), Pond bucket hat, Cattail, Cozy cocoa mug (every raiser 69+), Golden lily crown (top 3 raisers). `since: 'groyper'` items stay hidden until the gate.
- Eggs: after his Cold Storage the 1-in-777 slot gives Groyper eggs (Rare or Legendary, `SPECIAL_TIER.groyper`). Breeds after his Cold Storage. Hybrids with every species (Groy- names, eyes + lips parts).
- Scenes: arrival `js/v2-groyper-arrival.js` (night pond, lily pad, "Plop.", "Comfy."), farewell in `js/v2-cold-farewell.js` ("Told you I was comfy.").
- One halving 6 blocks after his Cold Storage (`coldStorageAfterKek`).

## Hand-off simulation (Nov 24 2026)
Real world (`api/boot.json`, tip 977,257) + gate set + synthetic burns: Rabbit Mythic -> rabbitcold log, raiser grants, halving +6, a White Rabbit egg hatches (Rare/Legendary),
community switches to Groyper, Groyper Mythic -> groypcold, his raiser grants, a Groyper egg, second halving, both species breedable. HatchBot posts checked on the same world.
Note: raiser prizes need the Mythic at or after block 977,450 (`ACTIVATE_RAISERS_BLOCK`).
