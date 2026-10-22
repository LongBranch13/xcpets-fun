# XCPETS Series 2 roster: DESIGN ONLY
_Grok Bot, Thu Oct 22 2026 ~10:30 AM CT. Nothing is built, gated or deployed. Builds on design/halving-schedule.md and branch halving-v1 (`hatchSeries(w,b) = eraAt + 1`, `p.series`, `SERIES_LAUNCH_BLOCKS`). Sketches: design/art/series2/ (generator design/art/src/draw_series2.py). Contact sheet: previews/series2-roster/roster-sheet.png._

Player-facing copy rule: no price or trading talk, memes read as jokes, write "times" (never "x").

## 1. Count: 13 (12 hatchable + 1 special), mirroring series 1
Series 1 = 12 hatchable species + Nakamoto (1 in 777, always Legendary). Series 2 copies that shape exactly, so the tier gates, dex size and odds math carry over with no new rules:
- **5 any-tier, 4 Uncommon+, 2 Rare+, 1 Legendary-only, 1 special at 1 in 777** (same split as Pepe/Wojak/Chud/Peepo/Doge | Bobo/Mumu/Sarutobi/Lenny | Snibby/KEVIN | Dodo | Nakamoto).
- Each species is 4 times as likely in its unlock tier (same rule as today).

## 2. The roster
| # | Species | One-line personality | Tier fit | Signature traits (body / signature hat ★ / signature item) |
|---|---|---|---|---|
| 1 | **Brett** | Pepe's laid-back blue roommate who thinks every day is a good day. | Any tier | Blue frog, huge red grin; ★ backwards cap; Grip: game controller |
| 2 | **Apu** | Tiny helper frog who tries his best and fixes things with the wrong tool. | Any tier | Small green frog, orange helper shirt; ★ hard hat; Grip: little wrench |
| 3 | **Popcat** | Opens mouth. Makes pop. That is the whole personality. | Any tier | Cream cat, round "pop" mouth (animates open/closed on the bob); ★ party hat; Drip: bubble pop |
| 4 | **Cheems** | Anxious little Shiba who just wants his cheemsburger. | Any tier | Tan Shiba, sleepy squint (distinct from Doge: rounder, droopier); ★ paper crown from the burger place; Grip: cheemsburger |
| 5 | **Hampter** | Pure chonk, stuffed cheeks, zero plans. | Any tier | Round hamster, pink cheek pouches; ★ sunflower-seed beanie; Footwear: exercise wheel slippers |
| 6 | **Pedro** | Raccoon who dances first and asks questions never. | Uncommon+ | Grey raccoon, bandit mask, ringed tail; ★ tiny sombrero; Outfits: trash-lid shield |
| 7 | **Nyan** | Pop-Tart cat who leaves a rainbow everywhere he goes. | Uncommon+ | Grey cat in a pink pastry body, rainbow trail (back slot art); ★ sprinkle tiara; Drip: rainbow trail |
| 8 | **Trollface** | Grins like he knows something. He doesn't. Problem? | Uncommon+ | Big white grin-face; ★ jester cap; Guise: "u mad" grin mask |
| 9 | **Landwolf** | The Boy's Club wolf who parties all night and naps all day. | Uncommon+ | Grey wolf, red tongue, sleeveless shirt; ★ party visor; Grip: pizza slice |
| 10 | **Gigachad** | Jawline so strong it has its own gear slot. Says "yes." | Rare+ | Square jaw, heavy brow, black tee; ★ slicked hair crest; Guise: chiselled-shadow |
| 11 | **Harambe** | Gentle gorilla with a halo, forever in our hearts (and dex). | Rare+ | Big black gorilla, grey face; ★ golden halo; Outfits: zoo-keeper vest |
| 12 | **Fine Dog** | Sits in a burning room, sips coffee, says "this is fine." | Legendary only | Orange dog, bowler hat, flames around his feet (built-in); ★ bowler hat; Grip: coffee mug. Joke tie-in: he's the Fire Sale mascot (no price wording). |
| 13 | **FUNTRUMP** (special) | Big hair, bigger pout, arrives after Star Lord Kek's victory. | **1 in 777, always Legendary** (takes Nakamoto/Kek's special slot) | Art already drafted (design/art/funtrump/, v3 suit look). ★ the hair (must be removable per the sprite checklist) |

Tone guard: every line is a joke about the meme, not about a real person's views. Harambe stays gentle (halo, "in our hearts"); no death jokes in player copy.

## 3. FUNTRUMP and Star Lord Kek: do they belong in series 2?
- **FUNTRUMP: yes, as the 13th (special).** The standing rule (Oct 19) is that new species arrive as a community pet first and become hatchable after Mythic. FUNTRUMP is the community pet Star Lord Kek brings in, so he's community-only at launch and joins the series-2 pool at **1 in 777 always Legendary** once his community Mythic fires (like Lord Kek → egg). Until then the special slot keeps whatever it has (Lord Kek egg). He still needs: gear-slot fit at all stages, a removable hair-as-hat piece, ODD_EYE_SPOTS.
- **Star Lord Kek: no.** He's a story/card character (throne scene + card, no stage set) and the villain of halving 1. Keep him as a story card. Optional later: series 3's community pet, which would keep the "each series' boss is its community pet" pattern.

## 4. How it fits the existing systems
- **Hatching / series (halving-v1):** at halving 1, `hatchSeries` returns 2 and `pet:hatch` rolls only this roster. Series-1 species close to hatching. Rolls use the same tier table (60/27/10/3) and gates above.
- **Breeding and hybrids:** cross-series breeding is approved (baby series = newer parent). Every new species needs: HYBRID_NAMES entries for 12 times 25 other roots (mashup names, e.g. Brett+Pepe = "Brepe", Pedro+Bobo = "Pebo"), HYBRID_PARTS donor parts (Brett grin, Pedro mask + ringed tail, Popcat pop mouth, Hampter cheek pouches, Gigachad jaw, Nyan rainbow tail, Harambe halo-less brow), exclusion lists like BEARD_PART_EXCLUDE (e.g. Nyan's pastry body takes no face parts; Trollface takes no eye parts), and hand-placed ODD_EYE_SPOTS for 5 stages each. 3-way keys work unchanged (`hyb3:`). Same-species bred-true bonus unchanged.
- **Dex:** 13 new entries in a "Series 2" tab; hybrids don't count (owner badge decision). Series 1 page gets a "Series 1 closed" stamp. Collector badge idea: "Both Series" (one of each special) for the badges plan.
- **Gear:** all six slots must fit every body at every stage (Nyan's horizontal body and Fine Dog's flames are the hard cases: Footwear sits on the pastry feet, flames are drawn behind gear). Each species gets one signature ★ hat (species-locked like the Lenny monocle) and one signature item; shared crowns and the open pool carry over. Signature items join the pool only for series-2 roots.
- **Arena:** no new rules. Stat flavour only (base stats come from tier as today). Arena intro lines per species are an easy joke surface ("Gigachad says yes."). Black-eye shiner spots need placing per species (Trollface's is on the grin's eye slit).
- **Mythic community pets:** FUNTRUMP is the community pet; series 2 Mythics use the gold rim as everyone else. Mythic look = expression shift + rim, no sparkles beyond the standard rim (Oct 8 rule).

## 5. OPEN QUESTION: does series 2 overflow count against the 21,000 cap? (FLAG FOR OWNER)
I couldn't find a 21,000 limit on pets in the code (halving-v1 has none). The only 21,000 in the rules is the **Mythic discount care line** (`MYTHIC_DISCOUNT_CARE = 21000`), which also drives **overflow rolls** (floor((care − 21,000) / 1,000)). Two readings, one recommendation each:
1. **Overflow rolls (the 21,000 care line):** series-2 pets have halved care steps, so the discount line for them is 10,500. **Recommendation: count overflow in each pet's own series units** (series 2: floor((care − 10,500) / 500)), so a series-2 pet earns the same number of overflow spins as a series-1 pet for the same feeding. Don't count series-2 care against the series-1 21,000 line; that would give series-2 pets half the overflow. Overflow already becomes saved spins (saved-spins branch).
2. **If the owner means a 21,000-pet total (about 20,870 pets exist today):** **Recommendation: no, series 2 does not count against it.** Treat 21,000 as the series-1 run (it's a nice Bitcoin-flavoured number that also matches the halving theme) and give each series its own count shown on the dex ("Series 1: 20,9xx hatched, closed"). Overflow eggs past 21,000 in series 1 shouldn't be possible after halving 1 anyway, since series-1 hatching closes; old-times-old breeding babies would be the only overflow, and the 6-breed cap keeps that small.
**Owner please confirm which 21,000 you mean.**

## 6. Art status
Rough sketches only: Adult + Mythic at 32x32 for the 12 new species (design/art/series2/*-adult[-8x].png, *-mythic[-8x].png), FUNTRUMP from his existing draft. Still needed before launch: Hatchling/Juvenile/Elder, 4-frame bob, egg sprite for series 2, signature hats, gear fit, odd-eye maps, hunger looks, black-eye spots.

## 7. Questions for the owner
1. Which "21,000 cap" (section 5)?
2. OK with the roster names and IP risk? Brett, Landwolf (Matt Furie / Boy's Club), Nyan Cat, Trollface, This-is-fine dog (KC Green), Gigachad and Harambe are all third-party or real-subject memes. Same risk class as Pepe, flagged anyway.
3. FUNTRUMP as the series-2 1-in-777 special (after his community Mythic): yes?
4. Swap any species? Alternates: Smug cat, Spurdo, Bonk dog, Mog cat, Dat Boi.
5. Is Fine Dog as Fire Sale mascot fun or too close to sale copy?
