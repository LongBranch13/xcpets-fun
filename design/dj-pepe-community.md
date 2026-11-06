# DJ Pepe: community pet #9 (preview, gated off)

Would follow PENPEN (#8): shows up as the community pet only after PENPEN reaches Mythic and goes to Cold Storage, and only once his gate is set.

- Art: `js/djpepe-sprite.js` (DjPepeSprite, same API as PenguinSprite/GroyperSprite). 8-bit house-style: classic green Pepe frog head on a DJ body. White flat-brim cap worn forward, black-and-white pixel 'deal with it' shades, big coral lips, short brown beard, gold stud earring, thin gold chain with a RED Bitcoin B pendant (gold rim; Bitcoin is always red, never orange), black tee with a round white record-label logo, green hands on turntables and a mixer with black vinyl. Egg = green shell with a white cap smear, shades band, coral lip and a tiny red B coin pressed in. 4 idle frames (stand, 1px bob, blink, turntable scratch). No fire aura, no flame crown, no edition frame; Mythic uses only the shared Mythic gold rim.
- Card flavor (owner trading-card text, not drawn on the sprite): '100% steal yer pepa', 'NO REQUESTS', stays awake for days, worthless during daytime, spins vinyl or serato.
- Display name locked: **DJ Pepe** only.
- Shades are fine on him (the no-glasses rule is only for the White Rabbit).
- Growth: COMMUNITY_THRESHOLDS (standard community target). Hatch tier: SPECIAL_TIER `djpepe` (salt `XCPETS:v2:djtier`), inert.
- Gates, all inert: `ACTIVATE_DJPEPE_BLOCK = null`, `ACTIVATE_DJ_BREED_BLOCK = null`, `DJ_POOL_FROM = Infinity`.
- `COMMUNITY_HANDOFF[4]` after:`penguinMythic` (inert while the gate is null). `djpepeTrack` is wired but returns at once.
- `v2-community.js` PETS entry no. 9 (`djpepe`, rec `djpepeMythic`, never set).
- This branch also carries the inert #7 Groyper and #8 PENPEN preview entries/sprites so the line is continuous.
- NOT done yet (needed before launch, like the White Rabbit): render hooks (LOOK_SPR, frames), sprite loaded by the pages, gear batch (signature item idea: the turntable / vinyl as a Grip, or the Bitcoin chain as Drip), hybrid names, Mythic effect (not fire), farewell from PENPEN, arrival scene, rules/pets copy, `tools/community-pet-check.js --pet djpepe`.

## Story (draft for owner review)

When the block is late and the feed is quiet, a green frog in a white flat-brim steps behind the decks. Shades on, coral lip set, gold B bouncing on his chest. He does not take requests. He stays awake for days. By daylight he is worthless, but when the burns start spinning he puts a hand on the vinyl and the whole town keeps time. Pepe on the tables. No requests.

Rules flavor: *He spins vinyl, he takes no requests and his Bitcoin stays red. Burn to feed him, and watch him scratch.*

## Open questions
- Hand-off text from PENPEN (farewell line + arrival caption).
- Gate blocks (set before PENPEN reaches Mythic).
- Signature item: thick gold chain + RED Bitcoin B pendant (drawn on the sprite; gear-piece version so it can come off still open).
- Mythic effect (not fire).
- Hybrid names.
- Confirm #8 display name stays PENPEN (this branch uses PENPEN in PETS / hand-off).

## Refine Nov 6 12:24 PM CT (owner re-sent reference card)
Sprite reworked against `previews/dj-pepe-community/reference.png`: bigger post-scale deal-with-it shades (readable at Hatchling/Juvenile), white flat-brim pointing right, wide red lips with dark outline, brown jaw beard, gold stud, gold chain + RED Bitcoin B, black tee + white round logo, bold Adult+ turntables/vinyl. Mythic rim only. Display name still **DJ Pepe**.

## Gold chain signature (Nov 6 12:27 PM CT, owner [pt2962u] 'Gold chain is important.')
Drawn as the signature look: thick bright gold V (2px links + highlight) over the black tee, larger gold-framed RED Bitcoin B pendant. Stamped post-scale so Hatchling+ reads clearly; Egg gets a chain/pendant hint. Never covers the face. Adult+ turntables made bolder. Still gated.

## Chain placement fix (Nov 6 12:30 PM CT)
Owner review of 0a3a193b: chain was a gold/red blob under the face covering lips/beard (read as flame at Hatchling/Juvenile). Fixed: chain starts 1px below beard; thin V (1px gold + highlight) on black tee; 3x3/4x4 gold-framed RED B pendant on chest with black tee gap; never covers face; no orange/flame. Contact-sheet title no longer overlaps the reference label.
