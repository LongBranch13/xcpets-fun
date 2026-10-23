# FUNTRUMP: community pet #4 (preview only, not active)

Status: design and inert wiring on branch `funtrump-community`. Nothing is live. `ACTIVATE_FUNTRUMP_BLOCK = null`, `FT_POOL_FROM = Infinity`, and `js/funtrump-sprite.js` is not loaded by any page. Replay is unchanged (SAME).

## Succession
Nakamoto → Wizard → Lord Kek → **FUNTRUMP**.
- **Start:** the block where Lord Kek reaches Mythic (6,906,900 fed), `kekMythic`. Lord Kek then goes to Cold Storage.
- **Care:** burns after the `kekMythic` burn feed FUNTRUMP (`ftTrack` writes `w.funtrump` and `w.funtrumpMythic`, and logs `funtrumpcold`).

## Thresholds (COMMUNITY_THRESHOLDS)
| Stage | Fed |
|---|---|
| Hatch | 69,000 |
| Juvenile | 834,900 |
| Adult | 2,214,900 |
| Elder | 4,146,900 |
| Mythic (then Cold Storage) | 6,906,900 |

## Arrival scene
This follows the v2-kek-arrival pattern. Lord Kek glows Mythic and STARLORDKEK carries him to the vault. A golden egg wobbles, and a big orange-blond hairdo pops out first. Then come the suit and the tiny red tie.
Lines (no price or trading talk):
- FUNTRUMP: "Tremendous hatch. The best hatch. Everybody says so."
- FUNTRUMP: "Lord Kek, you did a fantastic job. I'll keep the lights on."
- Narrator: "Feed the community pet to help him grow."

## Home display
The `#shared` card has the FUNTRUMP name, stage, fed amount, next stage, progress bar, and the Cold Storage line ("Lord Kek is in Cold Storage. FUNTRUMP goes in at 6,906,900.").
Mocks are `previews/funtrump/home-community-390.png` and `home-community-1280.png`.

## Handoff
At FUNTRUMP's Mythic he goes to Cold Storage (COLD_SPRITES funtrump). `cm.current` would then pass to pet #5 (TBD).

## The 1-in-777 egg
Kek eggs keep dropping until FUNTRUMP's Mythic. After that, the 1-in-777 hatch art becomes FUNTRUMP (`hatchArt` checks `FT_POOL_FROM` before Kek's).

## Signature gear
**Golden Hairspray** (hand slot, `ft-hairspray`, exclusive to funtrump). It is display-only and **not in BY_ID** yet. Hand items are drawn on his right side so they don't vanish into his hair.

## Hybrids and gear (standing rule)
- FUNTRUMP is a hybrid root with all 13 species. Names are `<A>trump` / `Fun<B>`. H3 parts are `Fun` / `tru` / `trump`. The hair part is on top.
- Three-way hybrids are supported in H3 slots.
- Every gear id fits on every stage, using anchors measured on his grid.
- Run `node tools/community-pet-check.js [--pet funtrump] [--quick] [--json]` to check this. The check covers all four community pets.
- Sheets: `funtrump-hybrids-sheet.png` and `funtrump-gear-tryon-sheet.png`.

## Activation steps
1. Set `ACTIVATE_FUNTRUMP_BLOCK` (and decide `FUNTRUMP_CAN_BREED`).
2. Add `<script src="js/funtrump-sprite.js">` to pages that render pets.
3. Add Golden Hairspray to BY_ID if approved.
4. Run replay-check and community-pet-check.

## Open questions
- Activation block: should this be gated by kekMythic only, or by an explicit block too?
- Should Golden Hairspray become real gear?
- Suit or hoodie?
- Halving and fire-sale both key off kekMythic. Should they move to FUNTRUMP's era?
- Final arrival copy.
- Can FUNTRUMP be bred?
- Community palette (currently body #ff8a2a, accent #c8342c, belly #e6bd85).
- Should headwear be drawn over his hair or hidden?

## Phase 2 (Oct 22 2026, owner 10:34 PM CT): two looks + FUNTRUMP gear (PREVIEW, inert)
- **Looks by tier (mirrors Wizard):** SUIT = Rare, HOODIE = Legendary. Both have all stages, 4 frames each (`FuntrumpSprite.LOOKS`, `render(..., {look})`).
- **Player egg odds (QUESTION):** these copy the Wizard rule, Rare:Legendary = 1000:300, so about 23% hoodie. They use `V2Rules.ftRollTier` (sha mod 1300 < 300 gives Legendary, salt `XCPETS:v2:fttier`) and `ftLookOfTier`.
- **Community pet look (QUESTION):** SUIT (`COMMUNITY_LOOK`). Hybrids with a FUNTRUMP body also use the suit (QUESTION).
- **Gear** (V2Gear.FT_BATCH, `since:'funtrump'`, hidden until the FUNTRUMP gate is set):

| id | slot | rarity | exclusivity |
|---|---|---|---|
| ft-samurai-sword | weapon (rides hand) | ★★★ | SUIT FUNTRUMP only |
| ft-skateboard | feet | ★★★ | HOODIE FUNTRUMP only |
| ft-hairspray | hand | ★★★ | FUNTRUMP (both looks, plus FUNTRUMP hybrids) |
| ft-fun-cap | head | ★★ | open (not drawn on Lord Kek: his nemes replaces headwear) |
| ft-gold-phone | hand | ★★ | open |
| ft-aviators | face | ★ | open |

- There is no tie piece (owner, 10:37 PM: he already wears one). All art is original pixel art, with no real logos or brand text.
- **Checks:** `tools/community-pet-check.js` covers funtrump (suit) and funtrump-hoodie, plus FT gear on all 15 roots, both looks and hybrids.
- **Open QUESTIONS:**
  - the 1000:300 odds
  - the community look
  - look-locked pieces on hybrids (currently not allowed)
  - the FUN cap text
  - breeding once in Cold Storage

## Phase 3 (owner, Oct 22 2026 10:47 PM CT): defaults approved + FUNTRUMP breeding (PREVIEW, inert)
- **Approved:** Rare:Legendary odds 1000:300; the community pet wears the suit; hybrids wear the suit; the sword and skateboard are not allowed on hybrids; the cap reads "FUN".
- **Breeding:** gated by `ACTIVATE_FT_BREED_BLOCK = null` (inert) and `ftBreedOn(b)`, which also requires that FUNTRUMP has reached Cold Storage (`b >= FT_POOL_FROM`, the block after `funtrumpMythic`). It mirrors `ACTIVATE_WIZ_BREED_BLOCK`:
  - Breeding uses the unchanged `breedChild` odds. Different species give a hybrid, FUNTRUMP x FUNTRUMP gives a FUNTRUMP plus the bred-true bonus, and the three-way rules apply.
  - A pure FUNTRUMP child is at least Rare (suit, via the stat-bonus difference). A Legendary child gets the hoodie (`art.ftLook`).
  - The community FUNTRUMP never breeds.
  - Hybrid names (Fun<X> and <x>trump) are the existing FUNTRUMP entries in HYBRID_NAMES.
  - The refusal message is "FUNTRUMP can breed once he reaches Cold Storage".
- **Draft copy, not on the live pages yet** (to add at deploy along with the Cast entry):
  - Cast: "FUNTRUMP: community pet #4. Two looks, the Suit (Rare) and the Hoodie (Legendary). Once he reaches Cold Storage, player FUNTRUMPs can breed and make Fun-hybrids."
  - Rules: "FUNTRUMP breeds like any pet once the community FUNTRUMP has reached Mythic and gone into Cold Storage."
- **Checks:** `community-pet-check.js` now asserts Golden Hairspray is allowed and drawn on every FUNTRUMP hybrid (30 cases, as body and as colours) and refused on non-FUNTRUMP hybrids. It also runs a breeding pass: the gate refuses before activation and before Cold Storage, and the community pet always refuses. The pass makes 120 children (FUNTRUMP, hybrid and other), checks their names, and checks that each look matches its tier and renders.
