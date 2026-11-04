# The White Rabbit: community pet #6 (preview, gated off)

Successor to Homer Pepe (#5). Shows up as the community pet only after Homer Pepe reaches Mythic and goes to Cold Storage, and only once his gate is set.

- Art: `js/rabbit-sprite.js` (RabbitSprite). Original 8-bit white rabbit, Egg..Mythic with 4 idle frames (stand, bob, blink, ear twitch): long ears with pink insides, ruby eyes, pink nose, cream belly, red bow. Egg = white shell with a gold watch face and pink ear tips. Just the character: no card frame, sky, text or stats.
- Growth: COMMUNITY_THRESHOLDS (standard target, Mythic at 6,906,900 care). Only costs halve.
- Hatch tier: SPECIAL_TIER `rabbit` (Rare or Legendary only, salt `XCPETS:v2:wrtier`).
- Gates, all inert: `ACTIVATE_RABBIT_BLOCK = null` (community pet), `ACTIVATE_WR_BREED_BLOCK = null` (breeding), `WR_POOL_FROM = Infinity` (his egg takes Homer Pepe's 1-in-777 slot after Cold Storage).
- Hand-off: `COMMUNITY_HANDOFF[1]` (`after: 'homerMythic'`, `rec: 'rabbitMythic'`, log `rabbitcold`). `rabbitTrack` records `w.rabbitMythic` -> Cold Storage, then he can breed. Added to `coldStorageAfterKek` (one halving 6 blocks after his Cold Storage).
- Gear (`js/v2-gear.js` WR_BATCH, `since: 'rabbit'`, appended at the end of ITEMS, hidden by view() until the gate):
  - `wr-pocket-watch` Gold pocket watch, Grip, tier 3 signature (White Rabbit + White Rabbit hybrids only). Hands tick between frames.
  - `wr-waistcoat` Checked waistcoat, Body, tier 2.
  - `wr-drink-me` Little potion bottle, Grip, tier 2.
  - `wr-shades` Rabbit-hole shades, Face, tier 1.
  RabbitSprite draws its own version of each on him; the maps draw them on every other body.
- Hybrids: works as a root with every species and every gear id (`tools/community-pet-check.js --pet rabbit`). Names: `<species>bit` (Pepebit, Homerbit) and `Rab<species>` (Rabjak, Rabmer); 3-way parts Rab / bi / bit. Feature parts: long ears (top), ruby eyes.
- Mythic effect (`js/mythic-sig.js` `clockwork`): a gold clock face behind him with 12 ticks, a hand sweeping once per loop, and breadcrumbs lighting up one by one along the ground.
- Farewell: `js/v2-rabbit-farewell.js` (not loaded by any page yet): "I'm late... I'm a Mythic!", "White Rabbit eggs: 1 in 777". `v2-community.js` PETS entry no. 6 (name `White Rabbit`, the: `the `).
- Cold Storage entry for Homer Pepe added to `js/v2-pages.js` (shows only once `w.homerMythic` exists).

## Story (draft for owner review)

Tick, tock. A White Rabbit in a checked waistcoat hops past, checks his gold pocket watch and mutters "I'm late!" Then the drops start: breadcrumbs on the chain, riddles in the burns, a little bottle that just says DRINK ME. Some say he leads to Wonderland, some say he's the way out of the Matrix. Nobody knows how deep the hole goes. Trust the plan, do your own research, and follow the white rabbit.

Rules flavor (rules.html): *He's late, he's dropping clues, and he keeps checking that watch. Follow the breadcrumbs, trust the plan, and follow the white rabbit down the hole.*

## Open questions
- Gate block: set `ACTIVATE_RABBIT_BLOCK` (and the breed gate) to deploy tip + ~6 and deploy before Homer Pepe reaches Mythic. Care counts from Homer's Mythic burn either way; a late deploy only leaves a gap on screen.
- Signature: gold pocket watch as the tier 3 Grip?
- Rare and Legendary share one look.
- Mythic effect: clockwork ring + breadcrumbs (Nakamoto already owns the green rain).
- Farewell lines need sign-off.
- Pet id `rabbit`, display name "the White Rabbit", hybrid names Pepebit / Rabjak.
- Rules line block number is a placeholder (`TBD <!-- WHITE-RABBIT-GATE -->`).
