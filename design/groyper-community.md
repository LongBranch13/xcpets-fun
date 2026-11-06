# Groyper: community pet #7 (preview, gated off)

Would follow the White Rabbit (#6). Shows up as the community pet only after the White Rabbit reaches Mythic and goes to Cold Storage, and only once his gate is set.

- Art: `js/groyper-sprite.js` (GroyperSprite, same API as RabbitSprite/HomerSprite). Original 8-bit fat smug frog in 3/4 view facing right: big round green body, fingers steepled under his chin, sly half-lidded side glance, wide orange lips, one leg stretched out along the ground. Egg..Mythic with 4 idle frames (stand, bob, blink, finger tap). Egg = green shell with an orange smirk and two sly eyes peeking out. Just the character: no card frame, text or stats. No fire aura, no flame crown, no edition frame; Mythic uses only the shared Mythic gold rim.
- Evolution: size, heavier lids, Elder under-eye folds, Mythic rim.
- Rare and Legendary share one look (White Rabbit precedent).
- Growth: COMMUNITY_THRESHOLDS (standard community target).
- Hatch tier: SPECIAL_TIER `groyper` (Rare or Legendary only, salt `XCPETS:v2:gytier`), inert.
- Gates, all inert: `ACTIVATE_GROYPER_BLOCK = null`, `ACTIVATE_GY_BREED_BLOCK = null`, `GY_POOL_FROM = Infinity`. Nothing reads them yet.
- `v2-community.js` PETS entry no. 7 (`groyper`, rec `groyperMythic`, never set) so the Cold Storage list stays empty for him.
- NOT done yet (needed before launch, like the White Rabbit): COMMUNITY_HANDOFF entry (after `rabbitMythic`), `groyperTrack`, `gyArt`, render hooks (LOOK_SPR, frames), sprite loaded by the pages, gear batch, hybrid names, Mythic effect, farewell, rules/pets page lines, `tools/community-pet-check.js --pet groyper`.

## Story (draft for owner review)

Somewhere past the rabbit hole sits a big round frog who has clearly seen it all. Fingers steepled, eyes half closed, a slow orange smirk: Groyper already knows how this ends. He never hurries, never hops and never blinks first. Feed him and he just leans back a little further, stretches one leg out and gives you that sideways look that says "I told you so." Nobody remembers telling him anything.

Rules flavor: *He's comfy, he's smug and he's always one step ahead. Burn to feed him, and he'll steeple those fingers a little tighter.*

## Open questions
- Gate blocks (set before the White Rabbit reaches Mythic).
- Signature item (a gear piece, so it can come off).
- Mythic effect (not fire).
- Pet id `groyper`, display name "Groyper", hybrid names.
