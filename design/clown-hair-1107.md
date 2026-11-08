# Clown Hair — private visual proposal, not activated

Base: main b8a02962520fc2e0684f08cd263ea6d9af44c6ef.

Rainbow clown afro wig, head/Headwear slot. Proposed Uncommon (tier 1),
standard shared weight 10, origin Peepo, NOT exclusive and NOT signature.
Peepo is the inspiration; all standard species may wear it. Headwear replaces
other headwear, not another slot. Red/yellow/green/cyan/violet/pink curls,
dark pixel outline, small white highlights; no orange, Bitcoin logo or fire.

This branch changes NO game rules, production renderer or live page. Only
preview tools and this design. Preview tool uses actual PetCore stage/animation
frames and BonusGear's gearless silhouette/eye anchors; it is not loaded by the
site. Egg intentionally stays bare (the normal renderer hides gear at stage 0).
Hatchling, Juvenile, Adult, Elder, Mythic have stage-scaled wigs. Also previewed
Pepe, Wojak and Doge at every stage, four animation frames each. Production
V2Render and custom/special species still need integration and fit tests.

## Existing gear system / acquisition proposal
- Six slots: head/Headwear, face/Guise, back/Drip, hand/Grip, body/Outfits,
  feet/Footwear (`js/v2-gear.js:1-7`). All six open from block 973560,
  regardless of stage/age (`js/v2-rules.js:145-150`). Egg art still hides gear.
- Shared non-signature gear is universal; signatures and explicit special locks
  restrict some items (`js/v2-rules.js:1488-1502`). This wig adds no restriction.
- Add to normal head roll pool (paid Pepe Wheel, saved spins, auto meal/stage
  rolls, eligible quests and community rolls); not a guaranteed gift and no
  bespoke drop or paid purchase. Paid roll base is 345 XCPETS, scaled by era
  and active sale; saved-spin action burns one dander separately.
- Wheel first picks a pet with tier weights 1/2/4/8, then one of six slots.
  Eligible pool includes items at or below pet tier; same-tier weights x4.
  Thus the proposed wig has head-pool weight 40 for Uncommon, 10 for Rare or
  Legendary, and is normally unavailable on Common rolls. See
  `js/v2-rules.js:128,155,1504-1508,3440-3457`.
- Baseline probability per roll on a selected eligible pet is
  (1/6) * wigWeight / sum(eligibleHeadWeights INCLUDING wig). Not a fixed 1-in-N:
  pet tier/species, activation history and duplicate holdings change it.
  Duplicate dampening preserves the initially drawn gear tier, then redraws
  within that tier with weights reduced x0.9 per owned copy
  (`js/v2-rules.js:1510-1514,1525-1527,1550-1557`).
- Existing meal/stage bonus rolls call the same pickItem; quest variants may
  use different tier/filter rules (`js/v2-rules.js:2545-2554,3307`).

## To ship later (requires owner OK)
1. Decide universal Uncommon versus Peepo-exclusive or Common. Recommendation:
   universal Uncommon, ordinary rolls. Choosing Common would let Common Peepos
   roll it themselves; an Uncommon wig can still be equipped from inventory.
2. Integrate art into `js/v2-gear.js` and `js/v2-render.js` (adaptive draw), with
   custom community-body handling where needed.
3. New pool entry changes replay outcomes: this IS a rules change, despite
   cosmetic art. `js/v2-rules.js` needs a new future-block eligibility gate for
   the `js/v2-gear.js` append-only ITEMS entry. Gate stays null pending approval;
   select tip+6 only at approved deployment. Do not modify historical pools.
   `js/pet-core.js`, `rjs/pet-core.js`, `js/bonus-gear.js` need not change.
4. Test before/after replay, item eligibility, all stage frames, overlays,
   hybrids and custom species. No push/deploy authorized by this preview.

## Reproduce
node tools/clown-hair-preview.js /workspace/xcpets/previews/clown-hair-1107/frames.json
python3 tools/clown-hair-sheets.py /workspace/xcpets/previews/clown-hair-1107

## Refit 1107 (owner: "needs to fit better", 8:44 AM CT)
Wig now hugs the real head outline column by column (smoothed over ears),
clamped to the eye span (no beaks/snouts), one puff column down each temple,
always one clear row above the eyes, ink outline only on the outside. No
floating side curls. Previews: /workspace/xcpets/previews/clown-hair-refit-1107/
(before/ = 17deaa39, after/ = refit; 12 species, every stage, 4 frames).

## Honk redraw 1107 (owner: refit "looks terrible" 8:49 AM CT; reference + "they should get the nose too" 8:51 AM CT)
Redrawn from scratch to match the owner's Honk Pepe reference: a chunky mass of
big overlapping round puffs (red, yellow, green, blue; shade + white glint per puff,
ink outline) arcing over the head and bulging past both sides, plus a round red
clown nose INCLUDED in the same Clown Hair item (face centre just below the eyes;
side-view faces get it on the snout front). Eye pixels + 1px ring are keep-out for
both pieces. Previews: /workspace/xcpets/previews/clown-hair-honk-1107/
(reference-vs-peepo-adult.png, clown-hair-contact-sheet.png, per species/stage png+gif).
No rule/renderer changes; replay SAME on 971786, 972883, 972901.


## Honk v2 — Nov 7, local preview correction

Base: approved local Honk commit `4917f126`, not the rejected cloud attempt.
Branch/worktree: `clown-hair-honk-v2-1107` / `/workspace/wt-clown-hair-honk-v2-1107`.

- Same Honk palette, white glints, shaded round puffs and round red nose.
- Touching/overlapping colour union; no dark separators or detached fringe.
- Five explicit stage fittings for each of 17 regular/community body families.
- Kevin's grey bob is removed under the wig and the exposed face is re-outlined;
  it is not merely covered by a hat or recoloured into straight rainbow locks.
- Dodo's backward-set crest leaves his eye and beak clear. Homer's tilted dome
  has a separate fitting and his original scalp curls do not float over the wig.
- Egg art stays unchanged. All four idle frames checked at each wearable stage.
- Scope is 12 regular species plus Homer, Wizard, Lord Kek, FUNTRUMP and White
  Rabbit. Retired Nakamoto and Ragnar are untouched. Named one-of-one/contest
  body renderers and hybrid combinations are not part of this sheet.
- Preview-only tooling; no page integration, rules edits, deployment or messages.

Outputs: `/workspace/xcpets/previews/clown-hair-honk-v2/`
- `kevin-dodo-homer-closeups.png`: 1920 by 1080, every growth stage.
- `clown-hair-contact-sheet.png`: complete 17-family coverage sheet.
- `approved-honk-vs-v2.png`: approved source compared with this revision.
- Per-species sheets and per-stage PNG/GIFs; `frames.json` contains raw pixels.

Reproduce:
```
node tools/clown-hair-preview.js /workspace/xcpets/previews/clown-hair-honk-v2/frames.json
python3 tools/clown-hair-sheets.py /workspace/xcpets/previews/clown-hair-honk-v2
node tools/clown-hair-test.js
```
Art regression: 340 wearable frames, connected puffs, no border clipping, eye
pixels preserved, Kevin replacement and deterministic pixels. Replay SAME at
971786, 972883 and 972901 against the approved local base. Rules unchanged from
that base (this branch is not a merge of current main).
