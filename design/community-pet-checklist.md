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
- `node tools/community-pet-check.js --pet <id>` 0 FAIL; `node tools/replay-check.js --compare origin/main` SAME.
