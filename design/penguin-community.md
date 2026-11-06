# Penguin: community pet #8 (preview, gated off)

Would follow Groyper (#7): shows up as the community pet only after Groyper reaches Mythic and goes to Cold Storage, and only once his gate is set.

- Art: `js/penguin-sprite.js` (PenguinSprite, same API as GroyperSprite). ORIGINAL 8-bit house-style design: chibi baby emperor penguin, front view, fluffy light-grey down with a fuzzy edge, scribbly black head cap, white face, small dark eyes, tiny yellow beak, orange feet. From Juvenile on he raises both flippers in a happy cheer, a gold Bitcoin coin in each; small coin stack from Elder on. Egg = grey shell with a black cap and a coin pressed in. 4 idle frames (stand, bob, blink, waddle lean). No text, no logos. No fire aura, no flame crown, no edition frame; Mythic uses only the shared Mythic gold rim.
- Pepe buddy: friendly with Pepe in story/scenes (no Pepe art in his sprite).
- Growth: COMMUNITY_THRESHOLDS (standard community target). Hatch tier: SPECIAL_TIER `penguin` (salt `XCPETS:v2:pgtier`), inert.
- Gates, all inert: `ACTIVATE_PENGUIN_BLOCK = null`, `ACTIVATE_PG_BREED_BLOCK = null`, `PG_POOL_FROM = Infinity`.
- `v2-community.js` PETS entry no. 8 (`penguin`, rec `penguinMythic`, never set).
- Owner states he is the PENPEN creator, Nov 4, 2026 10:23 PM CT. Recorded as stated; not verified here. The art in this branch is still an original design and is not named PENPEN; switching to the actual PENPEN character/name is the owner's call once the rights are documented.
- IP NOTE: this is an original design, not the '(C)PENPEN' character, and does not use that name. If the owner wants the actual PENPEN character or name, the creator's written OK (license) is needed first and must be on file before go-live.
- NOT done yet: COMMUNITY_HANDOFF entry (after `groyperMythic`), tracker, render hooks, page loading, gear batch (signature item idea: the Bitcoin coin as a removable Grip piece), hybrid names (bbit/abbit endings), farewell, rules/pets copy, `tools/community-pet-check.js --pet penguin`.

## Name ideas (owner pick)
Waddlebbit, Frostabbit, Pepengu.

## Story (draft for owner review)

On the coldest block of the year, a little grey fluffball waddled out of the snow with a gold coin held tight in one flipper. Nobody knows where he found it. He won't trade it, he won't spend it, and he won't let go of it, not even to nap. Pepe found him shivering by the fire and shared his blanket, and they've been buddies ever since. Feed him and he does a happy little waddle, flaps once, and checks that his coin is still there. It always is.

Rules flavor: *He's small, he's fluffy and he never lets go of his coin. Burn to feed him, and watch him waddle.*

## Open questions
- Display name; gate blocks (set before Groyper reaches Mythic); signature item; Mythic effect (not fire); hybrid names.

## Name on dj-pepe-community branch
Display name set to **PENPEN** in `v2-community.js` / COMMUNITY_HANDOFF on branch `dj-pepe-community` (owner line: White Rabbit #6, Groyper #7, PENPEN #8, DJ Pepe #9). Sprite id stays `penguin`.
