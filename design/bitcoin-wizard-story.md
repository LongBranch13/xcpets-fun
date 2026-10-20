# Bitcoin Wizard — story, farewell scene, egg & gear (DESIGN ONLY)
_Drafted Mon Oct 19 2026 ~9:15 PM CT. No code, no branch changes. Style matched to Nakamoto's Return scene (js/v2-return.js): 160×90 pixel canvas, one short caption at a time, counter line, flash, new egg, replay from Cold Storage (archive.html) and `?preview=` anytime._

## Status (chain replay, HatchBot chain-facts.json, block 972,242, 9:05 PM CT)
- Wizard care: **6,482,810** of 6,906,900 (Elder). **Remaining to Mythic: 424,090 XCPETS.**
- Pace: 5,507,221 at block 972,213 (4:27 PM CT) → 6,482,810 at 972,242 (9:05 PM CT) = 975,589 in 29 blocks / ~4.6 h ≈ 210k/h.
- **Rough ETA: ~2 h at that pace (≈11 PM CT tonight, ~block 972,255).** Burns are lumpy (one 6,900 case or big feed can do it). Treat it as "could happen any block".

## Facts used (verified, not invented)
- Feb 18–19 2013: r/Bitcoin mod u/theymos asks for ad ideas; u/mavensbot submits an MS Paint wizard: "Bitcoin: Magic Internet Money" (KnowYourMeme; bitcoinannotated.com).
- Nov 6 2013: the ad goes live on Reddit, BTC ~$287. Nov 29 2013: BTC closes ~$1,132, first time over $1,000; r/Bitcoin ~54–56k → ~74k subs (Medium/Paul Bars, KYM).
- The ad reads "Join us" / "MAGIC INTERNET MONEY"; wizard in a blue star robe with a staff (Vice).
- Game: The Return fired at block 971,632 (1,111,111 community burned). Nakamoto went into Cold Storage. Wizard: Egg → hatch 69,000 → 834,900 / 2,214,900 / 4,146,900 → Mythic 6,906,900 (100× a regular pet). Sprite wizard-3.png with the "join us" sign under him. Pointy Wizard Hat = signature Headwear (cosmetic, ★, not in pool yet). Community palette purple; player palette blue.

## The story (Cold Storage text, short lines)
**Bitcoin Wizard**
2013. A forum asked for an ad.
Someone drew a wizard in MS Paint.
Blue robe. Stars. A staff.
"Magic Internet Money."
"Join us."
It ran on Reddit. Bitcoin passed $1,000.
The wizard stayed.

2026. Nakamoto went into Cold Storage.
An egg was left behind.
Every burn fed it. Nobody owned it.
69,000 to hatch. 100× slower than any pet.
He wore whatever the community rolled.
6,906,900 burned.
**Mythic.**

Then he put down the sign.
Walked into Cold Storage.
Next to Nakamoto.
The sign stayed behind. So did an egg.
Now anyone can hatch one.
Join us.

## Farewell scene (replayable, same frame as The Return)
Canvas 160×90 ×4, ~420 frames at 30 fps (~14 s), static frame under reduced-motion. Caption top center (gold), counter line white, footer cyan "Every XCPETS burn counted".
1. **0–50 · "COMMUNITY PET"** — Mythic Wizard (purple, gold aura, wearing his current community gear), JOIN US sign at his feet. Counter: `₿ 6,906,900 burned`.
2. **50–170 · "Magic Internet Money"** — he raises the staff; stars pop off the robe and drift up as coins (reuse coin arc).
3. **170–260 · "Join us."** — he plants the sign upright in the ground, steps away from it.
4. **260–300 · "Into Cold Storage"** — frost vault (reuse vault(), cyan ice) opens; he walks in, Nakamoto's silhouette visible inside, both bob once.
5. **300–330 · flash** — white flash, vault shuts, frost over. Caption **"Mythic. Kept cold forever."**
6. **330–420 · "A new egg appears…"** — the sign stays at left; a blue (player-palette) Wizard egg drops in. Sub-line **"Anyone can hatch one · Join us"**.
- Autoplay once per browser (seen-flag keyed by trigger tx, like Return); no full-screen autoplay for first visitors (same 2026-10-16 rule). **"Watch the farewell"** button in Cold Storage + `?preview=wizard`. Archive card shows block, tx, total burned, feeders, top 5 (same as Nakamoto).

## Afterward
- **Bitcoin Wizard egg**: hatchable by everyone (owner rule: every community pet becomes an egg at Mythic). Blue palette; purple stays community-only (only the original). Proposal: own egg burn `pet:hatchwiz` 690, or a random-pool species at Legendary like Nakamoto (e.g. 1 in 2,013, nod to 2013). Normal pet thresholds.
- **Next community pet**: open (none planned in this doc).

## JOIN US sign → gear
- **"Join us" sign** — **Leverage (Grip)**, ★ Legendary signature, held sign. Flavor: *"The ad that made it to $1,000."*
- How obtained (proposal): every wallet that fed the Wizard (any burn after 971,632 until Mythic block) can claim one free with a 1-sat `pet:sign:ID`; afterwards Wizard-only signature in the roll pool (like other species stars). Alt: Wizard-only star drop.

## New wizard gear (4–6)
| Piece | Slot | Rarity | Flavor |
|---|---|---|---|
| Wizard Hat (pointy, existing) | Locks (Headwear) | ★ Wizard signature | "Came off so the others could try it on." |
| Star robe | Layers (Outfits) | Tier 2 Rare | "Blue, starred, drawn with a mouse." |
| MS Paint staff | Leverage (Grip) | Tier 2 Rare (open) | "Jagged on purpose." |
| Spellbook of Satoshi | Leverage (Grip) | Tier 1 (open) | "Page one: 21 million." |
| Star-cloak | Luster (Drip) | Tier 2 Rare (open) | "Every star a block." |
| Crystal orb | Leverage (Grip) | ★ Wizard-only | "Shows $287. Then $1,132." |
| Wizard slippers | Leathers (Footwear) | Tier 1 (open) | "Curled toes, cold storage approved." |
| Long white beard | Looks (Guise) | Tier 1 (open) | "Grown 100× slower." |
Pick 4–6. New pool items must go behind an ACTIVATE_*_BLOCK (they shift weighted picks; replay must stay SAME before it). Avoid clashes: Green-candle staff already exists (Rare), so MS Paint staff must look distinct.

## Mythic parity (owner: exactly same as other Mythics)
Mythic is a stage, not a tier (tiers are Common/Uncommon/Rare/Legendary). The Wizard gets the Mythic stage like any pet:
| Mythic feature | Applies? |
|---|---|
| Stage label "Mythic" everywhere (cards, home, play, pet page) | Yes — must render |
| Mythic stage sprite / expression | Yes — needs Wizard Mythic frame |
| Gold aura rim (all Mythics) | Yes — must be added to Wizard path (his sprite path currently skips gear/effects) |
| Never starves | Yes (already: community pet has no hunger) |
| Counts in Mythic totals / HatchBot "how many Mythics" (70 now) | Yes — decide: include as #71 |
| HatchBot Mythic post | Yes, plus existing Wizard stage-up post; one combined farewell post |
| 25% roll token on stage-up | Yes if community gear (auto-equip, newest wins) — check community pets get tokens |
| Mythic discount (21,000 for owner's pets) | N/A by design — community excluded (no owner) |
| Overflow gear rolls | N/A by design — community excluded |
Owner rule satisfied: same Mythic as everyone; the two exclusions are owner-based features that need an owner wallet.

## Readiness checklist (must be built before 6,906,900)
1. Wizard Mythic sprite frame + gold aura rim + gear drawn at Mythic.
2. Trigger rule `wizard returned` = first burn where community care ≥ 6,906,900 (block + tx recorded, like returnBlock/returnTx). Pure display/replay; replay SAME before it.
3. Farewell scene (V2Return-style module), autoplay-once, Cold Storage replay button, `?preview=wizard`.
4. Cold Storage archive entry #2 (Wizard: block, tx, total, feeders, top 5) + story text above.
5. Home/play community card: what shows after Mythic (Wizard in Cold Storage, egg/next pet). Home display changes need owner OK (owner loves current one).
6. Wizard egg: hatch rule + cost behind ACTIVATE block; blue palette; Pet Guide/Cast/species filter entries.
7. Join Us sign gear + claim burn; Wizard Hat into pool; new gear pieces; all behind ACTIVATE block.
8. HatchBot: Mythic count, farewell post, resolver facts. Rules/how-it-works/pets copy.
9. Fallback if Mythic hits before ship: the rule is replay-based, so a late deploy still finds the right block and plays the scene — nothing is lost, only delayed. Make sure nothing breaks visually at Mythic today (stage 5 Wizard rendering untested).

## Open owner decisions
- Trigger: on reaching Mythic (recommended, ETA tonight) or a set block?
- New egg: own burn (cost?) or random pool at Legendary (odds?) like Nakamoto.
- Sign gear: claim for feeders / roll pool / star drop? Slot Grip ok?
- Existing hats: Wizard Hat (pointy, purple-community/blue-player) overlap with new gear? Keep one hat.
- Count Wizard in Mythic totals? Does the community keep feeding someone next?

## Priority Wizard egg buyer (owner, Oct 19 2026 ~10:50 PM CT) — HONOR FIRST
One player burned for a Wizard egg before it was ready (the play.html button was showing because `.btn` CSS beat the `hidden` attribute):
- `pet:hatchwiz` 690 XCPETS · tx `7b82b46bd74b85b4da47f47ce7b7388173e77a92008d24691e01fcff3298dab0` · block 972,251 · `bc1qtke38j72qv4d8eljn7pccaykypw8luytfwdn7q` (Counterparty status valid).
- Replay today: **rejected as community food** ("unknown pet: tag", wizColdOn false). No Wizard egg/pet exists for them; the 690 fed the community pet.
- **Launch must honor this buyer first:** either count this burn as the first Wizard egg claim (a gated rule that credits listed tx ids at the launch block, without changing replay before it), or give them a manual claim path. Data: `design/wizard-egg-priority.json` (repo, doc only, not loaded by the site). Only one such burn as of tip 972,254.

## Launch checklist (restore the Wizard egg button)
1. Credit the priority buyer(s) in design/wizard-egg-priority.json first (see above).
2. js/v2.js line 191: `var WIZARD_EGG_ON_SALE = false;` → `true` (gates lines 198 and 464).
3. play.html line 35: remove `style="display:none"` from `#wizEggBtn` (keep `hidden`; JS shows it once wizColdOn is true). Note `.btn` CSS overrides `hidden`, so JS sets style.display too.
4. Or simply `git revert` the hotfix commit (see brief) except the doc/data files. Bump build id + ?v=, replay SAME, deploy.
