# Birth-era badge — preview only

## Chosen meaning
A pet's **birth era** is the community pet active at its existing `hatchBlock`.
That field is the birth event for normal hatches, bred eggs, quest eggs and grants;
feeding an egg, buying, trading, reviving or growing it never changes its era.
Species and inherited traits do not determine it.

The shared display catalogue `V2Community.PETS` supplies names and Cold Storage
record keys. Read those replay records and the exported arrival gate for the
next catalogue entry. Start = **later of previous Cold Storage and arrival gate**.
This matters for the early pets: Lord Kek arrived after the Wizard was already
in Cold Storage; FUNTRUMP arrived after Lord Kek's Cold Storage.

At main feed block 974930:
- Nakamoto: before 971632 (the first game era).
- Wizard: 971632–972395.
- Lord Kek: 972396–972879 (Wizard Cold Storage was 972325, but Kek gate is 972396).
- FUNTRUMP: 972880–973364 (Kek Cold Storage was 972869; arrival gate is 972880).
- Homer Pepe: 973365–974840.
- White Rabbit: from **974841**, Homer's Cold Storage block.

Block-level convention: the hand-off block belongs to the **new** era, even for
pets born earlier in that same block. This is intentionally not transaction-order
provenance. We cannot distinguish that from a birth block alone. No hardcoded
boundary block table is used by the UI; the table above documents current data.

Unset gates, future records and invalid/missing birth blocks do not invent a new
era. Every future canonical catalogue entry is picked up by the same helper,
including DJ Pepe. Gate lookup uses `ACTIVATE_<UPPERCASE ID>_BLOCK`; catalogue
entries may explicitly name `eraGate` when a future gate uses a different key.
Tests exercise future transitions and null/delayed gates without adding any
unmerged future-pet code to the branch.

## Alternatives (not selected)
- Game burn-halving number at birth: a numeric economic milestone, not the
  community identity; usually six blocks after the community hand-off. Rabbit
  era begins at 974841, whereas that halving begins at 974847.
- Bitcoin subsidy-halving epoch: spans years and gives almost all these pets the
  same label. Less useful as a collectible birth identity.
- Transaction-order eras: finer precision at a hand-off, but needs birth and
  transition transaction positions rather than the existing birth block alone.

## Implementation
Display only: `eraOf` in `js/v2-community.js`, `eraChip` in `js/v2-render.js`, and
small turquoise pixel hourglass labels in normal text flow. No badge overlays on
sprites. The same label appears in My Pets (grid and mobile swipe), public pet
cards, detail popups, hatch review, Discard pile, shop cards/pickers, family nodes,
rankings, proof tiles, dating cards and cemetery cards. Community cast/history
illustrations are not player pets and do not get a player birth label.
The canonical catalogue is loaded before boot on every game page; generated game
pages still match their template. No rule file, stored pet field, gate, RNG,
stats, cost, ownership or replay behavior changes.

## Verification / screenshots
- 47 era-specific VM/render checks; existing display 16, community-tip 10,
  rules-dependency 18 and card-sort 16 checks; generated-page check passes.
- Offline headless actual-page regression: 32 assertions across four surfaces
  at 1280 and 390 widths: clean pages, visible labels, birth tooltips and no
  art intersection.
- Screenshots: `/workspace/xcpets/previews/era-badge/`: `my-pets-{1280,390}.png`,
  `pet-card-{1280,390}.png`, `pet-card-crop-{1280,390}.png`,
  `family-{1280,390}.png`, `shop-{1280,390}.png`.
- Screenshots use real selected pets and archive records from an exact replay of
  main feed block 974930. Only browser-fixture wallet ownership is grouped to
  show several eras together; this is not a live wallet view or production data.
- Four rule MD5s match main. Replay comparisons SAME at 971786, 972883 and 972901.
- Live build stays 1620633b8a. No deployment, main merge, rule changes or wallet
  actions. Primary checkout and port 8841 untouched; no CloudAgent.

## Tiny community portraits (owner pt2986u, 2026-11-07 CST)

Each badge now includes a native 24-pixel adult head/upper-body crop from that
era's existing sprite. Shared SVG paths keep the original pixel colors and
crisp edges; portraits sit in normal badge flow, never over the pet art.
Wizard/Kek use their community purple/lapis palettes. Nakamoto uses existing
PetCore art; all other icons use the loaded sprite draw/palette APIs, not new art.

The canonical catalogue supplies the species; sprite globals are discovered
case-insensitively, so a future DJPepeSprite works without another renderer
branch. Optional catalogue eraSprite can name a nonstandard module. Missing or
broken modules retain the small hourglass and retry on a later render; successful
portraits are cached by species and source module identity. No rules, RNG, world
objects or saved pet fields change.

85 era/unit checks and 48 browser checks passed, including actual colored
portraits on all four surfaces at 1280/390, native 24-pixel geometry, no overlap,
clean pages, late-module recovery and a synthetic future DJ Pepe module. Existing
display16/community10/dependency18/sort16 checks passed. Replays SAME at
971786/972883/972901; four standard rule MD5s equal origin/main.

All prior screenshots regenerated. New native badge crops are
era-icon-crop-{my-pets,pet-card,family,shop}-{1280,390}.png in the preview directory.
era-icons-native.png shows all six canonical portraits. Run
python3 tools/era-badge-zoom.py for nearest-neighbor zooms:
era-icon-wizard-zoom.png, era-icon-homer-zoom.png, era-icon-rabbit-zoom.png,
era-icon-card-zoom-1280.png and era-icon-card-zoom-390.png.
These are enlarged actual browser crops, not a different mock-up.

Local commit only. No push, merge or deployment.
