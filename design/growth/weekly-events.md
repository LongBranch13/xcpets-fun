# Weekly events and the leaderboard

Written plan only. Nothing here changes the game. `js/v2-rules.js` stays as it is until you say yes to a prize grant.

## Summary

Once a week the site shows one public contest and a leaderboard. The score is computed from the same XCPETS burns every browser already replays, so two people looking at the same block always see the same board. The week clock already exists: 1,008 blocks (about seven days), starting at block 971,501. Prizes are gear or a badge. No XCP, no token, no cash. A badge can be drawn on the page without touching the rules. A real piece of gear placed in someone's stash is a gated change in `js/v2-rules.js`, and only you turn that gate on.

## How the chain is read today

A burn is a Counterparty destroy of XCPETS. The replay takes public rows `{tx_hash, block_index, source, amount, tag}` plus the Bitcoin block hashes. `readBurns` in `js/v2-rules.js` keeps a row only when its status is valid (or when no status is given), drops a duplicate tx hash, turns raw quantity into XCPETS by dividing by 100,000,000, and sorts by block, then by tx order inside the block. A tag that arrives as hex is decoded. That sort is the chain order. There is no random number. When the rules need luck, they hash the block hash with the tx and a fixed label.

Every valid burn still feeds the community pet, including a burn the game rejects. A rejected action is a log line of kind `rejected`. An unknown tag is a plain burn (community food). Practice mode never reaches the chain and never scores.

The public feed `api/pets.json` is a snapshot of that replay, rebuilt about once an hour. At the feed written for block 975,627 it lists 171,223 pets. It can trail the site by a block or two. It has owner, species, gear, `bornBlock`, and `rareHatch`. It does not list each burn. A burn race, a shop sale, and a seat chase are checked from the replay. The feed is only a cross-check of who owns which pet.

`api/meta.json` carries the feed's `blockHeight`. Trust the burns over the feed when they disagree.

## The week clock

`js/v2-rules.js` sets `WEEK = 1008` and `BLOCKS_PER_DAY = 144`. `js/v2-badges.js` already closes a weekly board on that clock:

- Anchor block `WEEK_ANCHOR = 971501` (the first v2 block).
- Week k covers blocks `971501 + k × 1008` through `971500 + (k+1) × 1008`. The end block is inside the week. The next week starts on the following block.
- The board is final when the chain tip is at least that end block. Until then the page says "so far" and the block it has counted to.
- A chain day is `floor(block / 144)`. That is the same day feeding uses.

Do not invent a second calendar. The format of a week is chosen before its start block. A week that has started keeps the scoring that was published for it.

Tie-break, same idea as the weekly burner badge in `js/v2-badges.js`: higher score first, then the player whose last scoring burn in the week is earlier, then the address in plain alphabetical order. Write the three keys on the board so anyone can check them.

## What a client does to verify

1. Load the public XCPETS destroys and the block hashes, the same inputs Play already uses.
2. Run them through `readBurns` and `replay`. Local equip actions are ignored for the score. Equipping is this browser only and is not a burn.
3. Keep rows and log lines whose block sits inside the published window.
4. Apply the format's rules below. Skip log lines of kind `rejected` unless the format says otherwise.
5. Sort with the tie-break above.
6. Compare the top of the list with the page. The page and this check use one function. If the feed's `blockHeight` is behind, say so and score only through that block.

Spam City sales also need the public DEX rows the shop already loads (issuances, orders, matches, credits). Replay applies those in block and tx order before the burns of later blocks. A sale the replay marks `sold` is the sale that scores. A match the replay rejects does not.

## Formats

Run one format per week. Rotate them. Raids already run on their own 1,008-block clock from block 973,010 and already pay raid trophies inside the rules. A raid week on this board shows the raid chart and does not pay a second prize.

### 1. Burn race

Score: XCPETS destroyed by that address in the window, added from the replay rows, skipping any tx the replay logged as `rejected`. Plain burns count. So does a successful hatch, meal, spin, fight, or breed. This matches the weekly "most fire" badge, which sums `r.amount` for burns that are not rejected.

The amount is the real destroyed amount after the halving. As of the feed at block 975,627 the burn-cost halving has fired three times (blocks 972,875, 973,371, 974,847), so a base 69 cost is 8.625 XCPETS. The race uses the amount on the row, not the base price. When the next community pet goes to Cold Storage the prices halve again. The race does not care. It counts what was destroyed.

A 1-dander check-in (`pet:wagmi`, `pet:hi`) counts for its tiny amount. It cannot win a burn race. Splitting burns across many wallets splits the score, so that does not help.

### 2. Spam City sale night

Spam City (shop.html, live from block 972,729) is not a bid auction. The old XCP sponsorship bid was retired. A listing is a Counterparty DEX order on that pet's own token: the seller offers 1 token and asks a price in XCPETS or XCP. The smallest ask the rules accept is 1 XCPETS or 1,000 sats of XCP. There is no `pet:sell` burn. The order is the listing. The binding burn is the 1-dander `pet:deed`. A completed match of that order, 1 token for exactly the price, moves the pet. Replay drops a fill where the buyer is the seller.

Score 1 point per pet that the replay records as sold in the window. The buyer and the seller each get that point. The same pet scores at most once in the week, on its first completed sale, so a flip back and forth does not farm points. The price is shown on the row so people can see the trade. The price is not the score. This stays a shop night, not a money leaderboard.

Tie-break uses the block of that pet's scoring sale, then the listing number, then the address.

### 3. Pantheon seat chase

The Pantheon has 21 seats (`MG.SEATS` in `js/v2-rules.js`). It opened at block 974,074. A Mythic eaten by its owner's starving zombie, then raised and resurrected, takes the next open seat. The seat record is the pet, the owner, the block, the tx, who ate it, and the seat number. `mgPantheon` is the source. pantheon.html already draws this. One wallet can make a Mythic God only once every 4,320 blocks (about 30 days), and can unleash only that often. Many weeks will have no new seat.

Score, only for steps the replay actually accepted:

- A successful `pet:unleash` that is not later cancelled: 1.
- The meal that eats the Mythic: 3.
- The resurrection that takes a seat: 10, and that wallet is marked "seated".

If nobody sits that week, the board still shows the steps, and the week pays nothing. An empty Pantheon week is an honest result. Do not invent a seat.

### 4. Other formats that fit the same clock

- **Spoon race.** XCPETS that successfully fed the player's own pets that week (log kind `feed`). Same sum the weekly feeder badge already uses. Community-pet feeding is a separate act and does not count here.
- **Arena week.** Wins on fights the replay marked done, with the accept block inside the week. More wins, then the earlier last win, then the smaller pet id.
- **WAGMI week.** A `pet:wagmi` burn is 1 dander and is the only burn that counts as a check-in. Score the number of chain days in the week with a wagmi, at most one per day. Pay a badge, not gear. A fresh empty wallet can say wagmi. Gear would need a harder bar (a real hatch or a real meal in the same week).

Royal Rumble is off from block 971,771. This plan does not turn it back on.

## Leaderboard UI

One page, `events.html`, plus a short strip on Play. Gold `#ffd166`, night background, Bitcoin red `#c8102e` for the "live" mark. Bitcoin is red here. The Orange Dragon stays orange because that is the pet, not the Bitcoin mark.

Desktop, wide column:

```
WEEK 42 · BURN RACE · blocks 1,013,837–1,014,844
So far, through block 1,014,200 · closes in ~4 days
[ #1  12,480 XCPETS   you    last burn 1,014,188 ]
[ #2   9,110 XCPETS   bc1p…  last burn 1,014,201 ]
[ #3   9,110 XCPETS   bc1q…  last burn 1,013,990 ]  <- earlier last burn wins the tie
...
Your row is pinned under the top 10.
Each row: rank, score, short address, the tie-break block, a link to the pet they show.
"Check this board" expands the three-line verify steps.
```

Phone, one column, the player's row stuck to the bottom:

```
BURN RACE
#4 of 18 · 1,240 XCPETS
closes block 1,014,844

1  12,480   bc1p…
2   9,110   bc1q…
3   9,110   15e1…
----
4   1,240   you

[ Share my rank ]  [ How scoring works ]
```

The share button is the rank card in `design/growth/rank-brag-cards.md`. Sale night adds the pet name and "sold" on the row. Seat chase adds "unleashed / fed / seated" instead of a big number. A tied score shows the deciding block in the row, not only in a tooltip.

## Prizes

Gear and badges only.

- **Badge.** Computed on the page from the replay, the way `js/v2-badges.js` already does for the weekly burner and feeder. It does not write into the world. Replay stays the same. No change to `js/v2-rules.js`. The badge names the week and the format. It can be lost in the same way as today's weekly badges when you want it to be a title, or kept as a count of weeks won. You pick which.
- **Gear.** A real item in the winner's stash. That is world state. It has to be created inside replay, the same way founder gear and the old rumble trophies are created, or two browsers can disagree. That is a gated change in `js/v2-rules.js`. You set the gate to the Bitcoin tip plus about 6 when you want it live. Before that block the new code does nothing and old replays stay the same.

The grant, when you allow it:

- Fires once, at the week's end block, and only if that block's hash is known. Replay already waits on a block hash for raids and seats. Same habit.
- Winner is the address at rank 1 after the tie-break. One piece. If you want top 3, say so before the gate. The plan defaults to one winner so the stash stays quiet.
- The piece is an existing shared item already in `js/v2-gear.js` (not a species-locked signature, not a 1-of-1). It goes in unequipped, `src` set to the event, owner set to that address. It does not auto-equip. Local equip stays local.
- The item id, the week number, and the end block are fixed in the rule. No second roll. If you later want a spin, the seed is `sha256(end block hash + 'XCPETS:v2:week:' + week number)` and the pool is a list you froze in the same change. Prefer the fixed piece.
- The XCPETS the players burned during the week stays burned. The prize does not pay any of it back.

A Pantheon week with no seat grants nothing. A sale week with no completed sale grants nothing.

## Anti-cheat and sybil

The board is public and the cost is real XCPETS, so most tricks cost more than they win.

- Many wallets: a burn race splits your total. You cannot merge them after the fact. The score is per address, and the first-burn player number does not join wallets.
- Rejected burns: left out, matching the badge. The tokens are still gone. Spamming a bad tag does not raise the score.
- Shop wash: buyer and seller must be different addresses, which replay already requires, and a pet scores once. Two wallets you own can still trade once. The cap makes the second trade worth zero. Do not score the price.
- Seat chase: the 30-day gaps and the "must be your Mythic, held 30 days, not tokenized, not listed" rules are already in replay. The board does not add a shortcut.
- Dust: 1 dander cannot win a burn race. It can win a WAGMI week, which is why that week pays a badge only.
- The feed is not the judge. A stale `pets.json` cannot add a point the burns do not have.
- Practice, local discard, and local equip are invisible to everyone else. They do not score.

## Cadence and rollout

One format per week, in this order, then repeat: burn race, spoon race, sale night, arena week, seat chase, WAGMI week. Skip seat chase in the first pass if you want six quieter weeks. Publish the format at least 144 blocks (about a day) before the start block.

Rollout:

1. Draw the board from the replay. No prize. No rule change. Let two full weeks close and compare the page to a hand check of the burns.
2. Turn on the badge for the winner of the next closed week. Still no rule change.
3. You pick the gear piece and the gate block. The grant goes into `js/v2-rules.js` behind that gate. Replay of everything before the gate stays the same.
4. Add sale night only after the shop's DEX read is the same one the board uses. If the order book fails to load, the sale board says "shop data missing" and does not guess.

## Decisions for you

1. Confirm the first scored week starts on a future 1,008-block boundary, not mid-week.
2. Confirm the rotation, and whether seat chase is in the first cycle.
3. Badge only for the first prizes, or badge plus one gear piece after you have seen two closed weeks.
4. Gear: which existing shared piece, and rank 1 only or top 3.
5. Sale night: 1 point to buyer and seller, pet scores once. Say if you want sellers only.
6. WAGMI week stays badge-only. Say if you ever want it to pay gear, and what extra burn you require.
7. The gate block for any gear grant, set by you at deploy to tip plus about 6.
