# Community pet checklist (standing owner rules)

Applies to every community pet from #5 (Homer Pepe) on. Older pets keep their live code.

## Standing rules
1. **Cold Storage hand-off (owner, Oct 26 2026):** each new community pet lands the SAME moment the previous one enters Cold Storage.
   - Code: add one entry to `COMMUNITY_HANDOFF` in `js/v2-rules.js` (`after` = previous pet's Mythic record, e.g. `homerMythic` for pet #6).
   - Its care counts every burn after the previous pet's Mythic burn (that burn excluded). It shows as the community pet from that block.
   - The `ACTIVATE_<PET>_BLOCK` gate is only a rule gate: set it to deploy tip + ~6 and deploy BEFORE the previous pet reaches Mythic. If the deploy lands later, the pet appears at the gate block and its care still counts from the previous Mythic burn.
   - Breeding gate = the same block; breeding still opens only after the pet's OWN Cold Storage.
   - Add the pet's Mythic record to `coldStorageAfterKek()` (one halving 6 blocks after its Cold Storage).
2. **Standard target (owner, Oct 26 2026):** every community pet keeps the STANDARD community target (`COMMUNITY_THRESHOLDS`, Mythic = `[5]`). Only costs halve; the target never halves.

## Also required
- The pet is the sprite: one sprite file, loaded on every page that loads the other community sprites, all render paths.
- All six gear slots work. The signature item is a real gear piece (pet-only, tier 3, hybrids of the pet too). The full signature loadout is shown in Cold Storage (`js/v2-community.js` loadout).
- Egg after Cold Storage takes the previous pet's 1-in-777 slot, Rare or Legendary (`SPECIAL_TIER`).
- The community pet itself never breeds.
- `node tools/community-pet-check.js --pet <id>` 0 FAIL; `node tools/rebuild-bench.js --compare origin/main` SAME.
- **Hand-off display touchpoints (Nov 24 2026, found while adding Groyper; each was missed for the White Rabbit):**
  - `js/v2-pages.js` ARCHIVE: a Cold Storage card for the pet (done = its Mythic record), story, farewell; the front-page farewell chain plays it, then the next pet's arrival.
  - Farewell scene: add the pet to `js/v2-cold-farewell.js` (one maker for #6 onward). Arrival scene: like `js/v2-groyper-arrival.js`.
  - `js/v2-render.js` COLD_ORDER (gap card number + name), `communityFrames`, `LOOK_SPR`, `COLD_SPRITES`, `RAISE_PETS`; `js/v2.js` communityName + cFed; `js/v2-community.js` PETS.
  - Fast world: `js/v2-split.js` (`<pet>Mythic` from summary.cold + `poolSwitches`) and `tools/sync-server/split.js` COLD_KEYS. The server file reaches the VPS only through a server-repair code update.
  - HatchBot: `hatchbot/announce.js` COLD_POST / COLD_POST_NEXT (Cold Storage + new pet post), raiser-prize post, `hatchbot/worker.js` NAMES, sprite in `hatchbot/art.js` + `tools/token-meta.js` EXTRA; Telegram app `tg/app.js` COMM.
  - `RAISER_PRIZES` entry + two `WR_RAISER_GEAR` rows. Prizes only for a Mythic at or after `ACTIVATE_RAISERS_BLOCK` (977,450).
  - Simulate the hand-off on the real world before launch: scratch script that sets the gate and appends synthetic burns after `api/boot.json` (see the Groyper PR).

## Pets so far
- #5 Homer Pepe: `homerpepe-community` (live, gate 973,341).
- #6 The White Rabbit: live from 974,815 (`COMMUNITY_HANDOFF[1]`, after `homerMythic`). See design/whiterabbit-community.md.
- #7 Groyper: preview, gated off (`COMMUNITY_HANDOFF[2]`, after `rabbitMythic`). See design/groyper-community.md.
