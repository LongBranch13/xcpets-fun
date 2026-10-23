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
