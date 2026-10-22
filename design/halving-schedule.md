# XCPETS burn-cost halving + Fire Sale: DESIGN ONLY
_Grok Bot, Oct 22 2026 ~1:45 AM CT. Nothing is built, gated or deployed. Sources: js/v2-rules.js @ origin/main feeece0 (Oct 22 00:37 CT), rare-room-v2 branch (wheel), PROJECT_BRIEF.md, memory-facts.txt, telegram/data/chain-facts.json (replay at block 972,581, 1:26 AM CT)._

> **Owner update, Oct 22 2026 ~12:18 PM CT (supersedes everything below):** NO series concept. Halving 1 = Lord Kek reaches Mythic + 6; later halvings = each new community pet + 6. A halving only halves every burn price; care thresholds and the care a meal adds stay as today (meal fix). Built on branch halving-community-trigger.
Player-facing copy never mentions price, trading or the token's market. Copy talks only about "the halving" and "Fire Sale".

## 1. Where things stand today (from code and data)
| Action | Tag | Cost (XCPETS) |
|---|---|---|
| Hatch | pet:hatch / hatch12 / hatch144 | 69 / 690 / 6,900 |
| Feed (1 per pet per chain day) | pet:feed:ID, pet:fm:START:MASK | meal 4,140 / 6,900 / 9,660 / 9,200 by stage (feedMin 69) |
| Gear roll (Pepe Wheel `pet:spin`, on rare-room-v2 and gated null) | pet:roll:ID | 345 |
| Fight + accept | pet:fight / pet:accept | 690 + 690 |
| Breed | pet:breed:A:B | 690 |
| Community gear roll | pet:c:roll | 690 |
| Community quick-feed | – | 69 / 690 / 6,900 |
| Hatch Wizard (now closed, roll-only) | pet:hatchwiz | 690 |
| Free / 1-sat | rel, wagmi, fr, kekcard, checkin | 0.00000001 |
Care thresholds: 0/69/8,349/22,149/41,469/**69,069** Mythic (day ~9). The Mythic discount (from 971,806) drops the Mythic threshold to 21,000 for every pet an owner has once that owner holds one Mythic. Community pets need 100x: hatch 69,000, Mythic 6,906,900.

**Mythics:** **209** living Mythics at 972,581: dodo 37, pepe 22, snibby 22, bobo 17, wojak 16, lenny 16, mumu 14, kevin 13, **nakamoto 12**, peepo 11, doge 10, chud 9, sarutobi 6, plus 4 hybrids. 10 Elders sit at 50,669 and #1258 is at 41,469. Pet count: 20,870 pets, 35 Nakamoto, 11 player Wizards, 15 wallets, 10.92M burned (~10.9% of the 100M goal).
**Story chain:** Nakamoto (community #1) went to Cold Storage at The Return (971,632). The Bitcoin Wizard (#2) went Mythic at 972,325 and to Cold Storage. **Lord Kek** is community #3 and has been LIVE since ACTIVATE_KEK_BLOCK 972,396. His Mythic is the first burn with Kek care ≥ 6,906,900, recorded as w.kekMythic. After that his egg takes the 1-in-777 hatch slot. The snapshot shows community care at 9.8M, "Mythic". **Check whether w.kekMythic has already fired.**

> Key implication: "halve every 3 Mythics" over player Mythics would fire **~69 times** right now (209/3), because the Mythic discount makes Mythics cheap and common. It has to count something rarer.

## 2. Schedule (owner revisions Oct 22 2026 1:47 AM CT)
The Bitcoin Wizard is **not** a halving point.
**NO fixed floor (owner confirmed).** Costs halve **only when a new community pet arrives** (owner, Oct 22 2026 12:17 PM CT; there is no series concept). When no new community pet comes, costs stop dropping. The 100M burn goal pace is therefore the owner's call.
**Halving 1, the story event: STAR LORD KEK defeats Lord Kek. APPROVED: triggered by the burn that pushes Lord Kek's care to Mythic.**
- **How the defeat is decided:** the defeat burn is the existing replay record `w.kekMythic = {block, tx}`, the first valid community burn at or after ACTIVATE_KEK_BLOCK (972,396) that brings Lord Kek's care to 6,906,900 or more. That is pure chain data. It is shown as STAR LORD KEK's victory, with the 7 sacred artifacts beat, and Lord Kek goes to Cold Storage (archive #3), like Nakamoto's farewell.
- **Not used (owner chose the kekMythic burn):** the defeat block is the first block after kekMythic where `sha256(blockhash + 'XCPETS:v2:starlordkek') % 7 == 0` (about 7 blocks on average). Still deterministic.
- **Gate:** `HALVING_1_BLOCK = max(defeat block + 6, ACTIVATE_HALVING_BLOCK)`. ACTIVATE_HALVING_BLOCK is tip + 6 at deploy, so a defeat that happened before the code ships doesn't rewrite history.
**Halving 2 and on:** one per new community pet, at that pet's arrival block + 6 (`COMMUNITY_PET_ARRIVAL_BLOCKS`, owner sets each; an arrival at or before halving 1 adds nothing).
| Halvings | Trigger | Hatch / 12 / 144 | Meal cost (care added stays 4,140 / 6,900 / 9,660 / 9,200) | Roll/Spin | Fight/Accept/Breed/c:roll |
|---|---|---|---|---|---|
| 0 (now) | – | 69 / 690 / 6,900 | 4,140 / 6,900 / 9,660 / 9,200 | 345 | 690 |
| 1 | STAR LORD KEK defeats Lord Kek (kekMythic) + 6 | 34.5 / 345 / 3,450 | 2,070 / 3,450 / 4,830 / 4,600 | 172.5 | 345 |
| 2 | next new community pet arrives + 6 | 17.25 / 172.5 / 1,725 | 1,035 / 1,725 / 2,415 / 2,300 | 86.25 | 172.5 |
| n | each later new community pet + 6 | base / 2^n | | | |
Formula: `cost(a,b) = base(a) / 2^halvings(b)`. There's no floor and no rounding through about 5 halvings (8 decimals).

### Care: unchanged (MEAL FIX, owner Oct 22 2026 12:18 PM CT)
Thresholds, meal sizes and the care a meal adds never change. A meal still adds its base care (e.g. 9,200) and only its price halves (`mealCost = care / 2^halvings`, x Fire Sale factor). So a halving never slows growth: every pet still reaches Mythic in about 9 meals. Hatching still gives 69 care (paid 34.5 after halving 1). Before halving 1 cost === care, so replay is unchanged.

## 3. ~~New series mechanics~~ REMOVED (owner, Oct 22 2026 12:18 PM CT)
There is no series concept: no p.series tag, no Series-2 hatch pool, no hatchSeries roster, Series-1 hatching never closes, no per-series thresholds or care steps, no "Series N" chip, no breed toast, no SERIES_LAUNCH_BLOCKS, no breedSeries. New pets come only through community pets. A halving only halves every burn price.

## 4. Replay safety
- One pure function `eraAt(w, b)`: count of milestones whose `block + 6 <= b`. Milestones come only from replay records (w.kekMythic.block, etc.), which are themselves pure chain data. Code constant `ACTIVATE_HALVING_BLOCK = tip + 6` at deploy. Before it, era is always 0, so every earlier burn replays byte-identically. Test "replay SAME" at the current tip plus the usual checkpoints (972118/972124/972222/972232/972581).
- The cost is evaluated **at the burn's own block_index**, never at wall-clock or the UI's view.
- The +6 gap lets wallets and the UI notice the milestone before prices change, and it rides out a 1–2 block reorg of the milestone block.

## 5. Risks
- **Rounding:** halves of 345 give 172.5 and 86.25. Fine on chain (8 dp), but the UI must display "172.5". If whole numbers are wanted, round **down** (never charge more than half) and document it.
- **In-flight sends:** a full-price burn confirmed after the gate is **valid, overpaid**. Treat the excess like the current overfeed rule (counts as burned, and as community food). A half-price burn confirmed *before* the gate is **rejected** (underpaid), which is the same as today. The UI should refuse to build a half-price tx until tip ≥ gate − 1 and warn that "price drops at block X".
- **100M burn goal:** halving cuts XCPETS burned per action, so the goal arrives later unless activity rises. With no automatic floor, how far costs fall is the owner's decision (whether to add new community pets).
- **Fairness to early players:** they paid more. Mitigations: S1 species closing makes S1 pets scarce, an "Era 0 Founder" badge (display only), S1 thresholds unchanged, and their gear carries over.
- **Gaming the trigger:** the STAR LORD KEK defeat needs ~6.9M burned to Lord Kek, so it can't be cheaply forced, and pushing it means burning a lot, which is fine.
- Copy guard: HatchBot's send-guard already blocks price wording. Note that "2x"/"½" may trip `\d(x|×)`, so write "half" in words.

## 6. FIRE SALE (FINAL, owner Oct 22 2026 ~1:54 AM CT)
**Trigger (deterministic, gated):** from `ACTIVATE_FIRESALE_BLOCK` (tip + 6 at deploy), block B arms a sale if `int(sha256(blockhash(B)+'XCPETS:v2:fire')[0..12],16) % 1000 < 3` (about one every 2–3 days), no sale ended in the last 432 blocks, and B is not in the post-defeat pause. The sale runs **from B+6 for 36 blocks (~6 h)**.
**Discounts:** **69% OFF** hatch (all sizes), roll/spin, breed, fight/accept and community roll, so you pay 31%. **Feeding is included at 50% off.** 1-sat tags are unchanged.
**Sale prices in era 0:** hatch 21.39, dozen 213.9, case 2,139, spin 106.95, 690-actions 213.9; meals 2,070 / 3,450 / 4,830 / 4,600. In era 1 the hatch is 10.695.
**Decimals check:** XCPETS is divisible to 8 decimals. The live rules already accept 1-sat burns (0.00000001 for pet:fr, wagmi, rel), so 21.39 and 10.695 are valid. Keep exact `base × 0.31 / 2^era`. Through era 6 the hatch is 0.33421875, still exact. Validation should compare with a 1e-8 tolerance (the replay already rounds to 1e-8).
**Price at the burn block:** `price(a,b) = base(a)/2^era(b) × (fireLive(b) ? (a==feed ? 0.5 : 0.31) : 1)`. An underpaid burn outside a sale is rejected, the same as today.
**Full price paid during a sale: a FREE SPIN (final).** Each qualifying burn earns **exactly one saved Pepe Wheel spin** for the burner's address. It qualifies when the burn lands in a live-sale block, is a discounted action and amount >= the non-sale era price. Feeds count per burn, so a bundled `pet:fm` earns 1 spin, not 1 per pet. Spins are counted in `w.spins[addr]`, see design/wheel-spins.md. The extra XCPETS still counts as burned. Amounts between the sale price and full price give no spin.
**How players find out:** HatchBot posts at arm ("Fire Sale in ~1 hour") and at live. The site shows a countdown banner, then "🔥 FIRE SALE: N blocks left". The copy says "69% off hatches" and never mentions price or trading. Check that wording against HatchBot's send-guard.
**Chaos look:** same site look and fonts. Pixel flames on the header and scenes, a red pulse, panicked sweating and jittering pets, Dan the wheel guy yelling in a pixel bubble, and a siren light with optional sound. Reduced motion: static flames and the banner.
**Abuse:** players saving hatches and spins for sales is accepted, since that's the event. The cooldown and the 6 h window limit it, and nobody saves a daily feed.

## 7. Fire Sale and halving close together
- **Stacking (final):** `price = base / 2^era × sale factor` (0.31, or 0.5 for feeds). Both are worked out at the burn's own block.
- **Sale in progress at the halving block:** the price **recomputes from the new base** at once (a sale hatch goes from 21.39 to 10.695). The sale's window and end block don't change. Old-era sale-priced burns that land after the switch are overpaid and valid.
- **Warnings that straddle the switch:** the arm warning quotes the sale price for its start block's era. If a halving gate falls inside the warning or the sale, the banner and the single HatchBot post give both block numbers ("half off now, and everything halves again at block X").
- **Cooldown:** unchanged (432 blocks after a sale ends). A halving doesn't reset it.
- **Pause around STAR LORD KEK (APPROVED):** no sale can arm from the defeat block until HALVING_1_BLOCK + 144, so the defeat, the farewell and the new era each get their own moment. It's checked against replay records, so it's deterministic. The same optional pause applies at each series launch.
- **UI:** the halving gets its own "A new era" scene and gold ribbon. The Fire Sale keeps flames, panicked pets, Dan yelling and the siren, and both can show at once. Reduced motion shows static banners. Tx builders quote the price at the next block and warn when fewer than 3 blocks are left before a price change.
- **HatchBot:** separate posts for the defeat, the era start and the Fire Sale. Fire Sale posts are skipped during the pause, and the copy says "half" in words, never price or trading.

## 8. ~~Cross-series breeding~~ VOID (owner, Oct 22 2026): there is no series concept; the cross-series-breeding branch is not deployed. Kept below for history only.
**Current rules** (breeding v2, gate 972,561):
- **Cost and cap:** 690 per side, with a 6-breed lifetime cap per pet (BREED_CAP_V2, counted from the gate). Adult+ only, not neglected.
- **Hybrids:** different species give a hybrid 68.48% of the time, otherwise a parent's species. Same species gives a bred-true bonus.
- **Body parts:** hybrids inherit signature body parts (HYBRID_PARTS, which replace the child's matching region).
- **Odd eyes:** a mutation drawn from hand-placed ODD_EYE_SPOTS for the 13 species plus Lord Kek and the Wizard.
- **Breed carry:** runs from 971,650.
- **Who can't breed:** community pets never breed. Player Wizards are blocked (ACTIVATE_WIZ_BREED_BLOCK = null). Player Lord Keks can breed (KEK_CAN_BREED).

**APPROVED (owner 1:54 AM CT): YES, cross-series breeding, and the baby joins the newer parent's series.** It fits the current rules with no new mechanics: a series is just a tag on the species, and hybrid keys already handle any pair.
- **Effect on the halving and series boundaries:** the halving trigger is only the series launch, so breeding can't move it. The breed costs the **current era** price per side. Can it get around closed hatching? Partly. It makes S1-parent hybrids, but every breed needs an S2 parent, costs 2 burns and uses a slot from a 6-breed cap. That's controlled scarcity, not a back door. New-series hybrids appear only once that series has pets, never early.
- **Old x old after the switch:** **allowed (APPROVED).** The baby is an old-series species or hybrid (S1 + S1 → S1), since this is the only way to make new S1 pets and it gives early players lasting value. It grows on its own series' thresholds (section 2) and pays current-era costs. The 6-cap limits supply.
- **Gear:** never inherited (unchanged). Gear on the parents stays. Breed carry follows the current rules.
- **Odd eyes:** the mutation rule is per species. Each new species needs its own ODD_EYE_SPOTS before its series opens. An S1-species baby uses the existing maps.
- **Retired species' parts in new hybrids:** yes. S1 body parts can appear on S2-series hybrids through HYBRID_PARTS. Art needs a part fit for every new body.
- **Community pets and Wizards:** unchanged (community never breeds, Wizards stay gated).
- **Replay:** the series tag is decided at the breed block, `seriesOf(child) = max(seriesOf(A), seriesOf(B))`. All existing pets are series 1, and nothing changes before ACTIVATE_HALVING_BLOCK.

## 9. Recommendation
Halving 1 = STAR LORD KEK defeats Lord Kek (the kekMythic burn + 6). After that, one halving per new community pet (arrival + 6), with no floor. Care never changes; only prices halve. (Owner, Oct 22 2026; supersedes the series wording.)

## Open questions: RESOLVED (owner, Oct 22 2026 ~1:54 AM CT)
1. ~~Defeat trigger~~: the kekMythic burn that pushes Lord Kek to Mythic. **Resolved.** If it's already in the past at deploy, halving 1 = ACTIVATE_HALVING_BLOCK.
2. ~~Series 2 roster timing~~: void, there are no series. **Resolved.**
3. ~~Drama pause~~: no Fire Sales for 1 day after the defeat. **Resolved.**
4. ~~Old x old breeding~~: void (no series). **Resolved.**
5. ~~Full-price-in-sale~~: one saved wheel spin per qualifying burn. **Resolved.**
6. ~~Floor~~: none, owner confirmed. **Resolved.**

## Owner answer Q1 (Oct 22, 2026 2:02 AM CT)
Yes. STARLORDKEK ("THE REAL AND ONLY LORD") is the villain who defeats Lord Kek. Reference card: design/art/starlordkek-card.gif (green Kek face, Darth Vader-style black mask, fur-collared black cape, red throne; card text "After the great victory over LORDKEK the real and only RULER is STARLORDKEK"). He brings the NEXT COMMUNITY PET: FUNTRUMP (Donald Trump styled as the FUNTRUMP from xcp.fun, with his signature hair). Art for Star Lord Kek and FUNTRUMP still needs pixel sprites; owner review first. Remaining open Qs: 2 usespin burn, 3 convert credits, 4 lucky-drop odds, 5 keepsakes.

## Owner answers (Oct 22, 2026 10:10 AM CT)
- Fire-sale banner wording keeps "69% off".
- Captain Dan does the fire-sale yelling.
- Community feeding (69/690/6,900 and minimum) halves with each halving.

## Owner answer: community feeding (Oct 22, 2026 ~10:11 AM CT)
Community pet feeding halves with every halving, the same as every other burn: the 69 / 690 / 6,900 quick choices and the community feed minimum (69) are divided by 2 for each halving so far (era 1: 34.5 / 345 / 3,450, min 34.5). Fire Sales stack on top the same way, and community feeding counts as feeding, so it is 50% off during a sale (era 1 sale: min 17.25). Built on halving-v1 (cfeed check + quick-choice relabel), merged forward into fire-sales, saved-spins and cross-series-breeding.

## Owner correction: every fire-sale discount is 69% off (Oct 22, 2026 ~11:52 AM CT)
Supersedes "meals half off" and "community feeding 50% off". During a Fire Sale EVERY burn pays x0.31 (69% off), meals and community feeding included, stacked on the halving: price = base / 2^era x 0.31.
Precision: XCPETS has 8 decimals. Every derived price is rounded to the nearest 0.00000001 (r8); a burn is valid if amount >= price - 0.000000005. Era 0 outside a sale keeps the old whole-number rules exactly.
| | era 0 | era 0 sale | era 1 | era 1 sale |
|---|---|---|---|---|
| hatch / community feed min | 69 | 21.39 | 34.5 | 10.695 |
| community choices | 69 / 690 / 6,900 | 21.39 / 213.9 / 2,139 | 34.5 / 345 / 3,450 | 10.695 / 106.95 / 1,069.5 |
| dozen 690 / case 6,900 | 690 / 6,900 | 213.9 / 2,139 | 345 / 3,450 | 106.95 / 1,069.5 |
| a 9,200 meal | 9,200 | 2,852 | 4,600 | 1,426 |
