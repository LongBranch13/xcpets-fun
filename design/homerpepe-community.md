# Homer Pepe: community pet #5 (preview, gated off)

Successor to FUNTRUMP (#4). Shows up as the community pet only after FUNTRUMP reaches Mythic and goes to Cold Storage, and only once his gate is set.

- Art: `js/homer-sprite.js` (HomerSprite). 8-bit, Egg..Mythic, just the character with no card frame, sky, text, hearts or stats. Reference: `design/ref/homer-pepe-card.jpg`.
- Growth: COMMUNITY_THRESHOLDS (100x slower).
- Hatch tier: SPECIAL_TIER `homer` (Rare or Legendary only, salt `XCPETS:v2:hptier`).
- Gates, all inert: `ACTIVATE_HOMER_BLOCK = null` (community pet), `ACTIVATE_HP_BREED_BLOCK = null` (breeding), `HP_POOL_FROM = Infinity` (his egg takes FUNTRUMP's 1-in-777 slot after Cold Storage).
- Mythic: `homerTrack` records `w.homerMythic` (log `homercold`) → Cold Storage, then he can breed. Added to `coldStorageAfterKek` (one halving).
- Hybrids and gear: works as a root with every species and every gear id (`tools/community-pet-check.js --pet homer`).
- Farewell: `js/v2-homer-farewell.js` (not loaded by any page yet). `v2-community.js` PETS entry no. 5.

Open questions: signature gear (donut Grip idea `HOMER_DONUT`, not in any pool); Rare and Legendary share one look; farewell lines need sign-off.

See design/community-pet-checklist.md: Homer lands the moment FUNTRUMP enters Cold Storage (COMMUNITY_HANDOFF); standard target, only costs halve.
