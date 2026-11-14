# Bitcoin event reactions

Written plan only. Skins are paint. They do not touch `js/v2-rules.js`, the replay, pet stats, gear, or burns.

## Summary

On a few public Bitcoin days the site puts on a red costume: a banner, a candle border, a countdown. The costume is drawn by the page. It is not a pet, not an item, and not a burn. Bitcoin on this site is red (`#c8102e`, already used in `css/v2.css` for the lair, the arena, and the shop). It is never orange. The Orange Dragon and the Wizard's coin stay the colors they already are, because those are characters, not the Bitcoin mark. If the data source is missing or the two readings disagree, the costume stays off.

## What can turn a costume on

Three kinds of day. Each one has its own source. None of them is written into the replay.

### 1. A new Bitcoin high

The page does not trust a live price API by itself. A bad print would dress the whole site.

The switch is a small static file on the site, which you or XCPETS Social update when you have agreed the high is real. Example shape:

```
{ "id": "ath-2026-11", "fromBlock": 980000, "untilBlock": 980144 }
```

The costume shows only while the chain tip the page already has is inside `fromBlock` and `untilBlock` (144 blocks, one chain day). The file carries no dollar amount. The banner says "New high" and does not print a price. That matches the HatchBot habit of not talking price.

How you decide to update the file: look at a public price page. Mempool.space is the one this site already sends people to for transactions, and it publishes a price read. Look at a second public page you name. Update the file only when both show a high above the last high you accepted. If either page fails, or they disagree, do not update the file. The costume stays off. That is the fallback.

A browser never stores the high as game state. There is no burn, no memo, and no pet field.

### 2. The Bitcoin subsidy halving countdown

This is block math, not a price. Bitcoin cuts the block subsidy every 210,000 blocks. The 2024 cut was block 840,000. The next one is block 1,050,000. At the feed tip 975,627 that is 74,373 blocks out. The page computes it from the tip it already shows:

`next = 210000 × (floor(tip / 210000) + 1)`

The ribbon appears for the 1,008 blocks before that block, and through the 144 blocks after it. It says "Bitcoin halving in N blocks" and never mixes in the XCPETS burn-cost halving.

Those are different. The XCPETS halving cuts burn prices when a community pet goes to Cold Storage. The feed at block 975,627 shows three of those already done (972,875, 973,371, 974,847) and no next one scheduled. The costume must not say "the halving" alone. It says "Bitcoin halving" or "XCPETS halving", and this costume is only the Bitcoin one. XCPETS halving posts stay with HatchBot as they are.

Fallback: if the page has no tip yet, the ribbon is hidden. There is nothing to guess.

### 3. Calendar days you pin

A static list of month and day, UTC, in the same kind of file. The costume is on for that UTC date only. Suggested rows for you to confirm before they go in. Do not turn a row on until you have checked the day:

- 3 January, Bitcoin genesis day.
- The Counterparty mainnet day, once you confirm the calendar date you want honored. This plan does not guess it.
- The XCPETS day you pick (the first v2 block is 971,501, if you want the chain fact instead of a calendar day). A block birthday uses the tip, like the halving, and does not need a clock.

Fallback: a missing file, a blank list, or a row you have not marked `on` draws nothing.

### Days that stay off

Difficulty epochs, price drops, and "number go up" tickers. They are noisy, and a down day should not wear a costume. Mempool blocks and fee spikes stay off for the same reason.

## The costumes

All of them are CSS and a canvas overlay. They sit in normal page flow or on the edge of a card. They do not cover the hatch button. They do not change a sprite's saved pixels. `prefers-reduced-motion` turns off the flicker and leaves a still border.

- **New high.** A one-line banner: "New high". Cards get a 2px red candle border, `#c8102e`, for that chain day. No flame animation that could be read as the Orange Dragon.
- **Bitcoin halving.** A ribbon with the blocks remaining, in red and gold `#ffd166`. When the block arrives, the ribbon says "Bitcoin halving block" and the block number for 144 blocks.
- **Pinned day.** The same banner pattern with the label from the file ("Genesis day", "Counterparty day"). One extra draw: a red pixel bow, 8 by 8, in the page corner. It is not equipped, not in the stash, and not a `v2-gear` id.

Everyone sees the halving ribbon and the pinned-day banner together, because both are computed from the tip or the UTC date and the file. The new-high costume appears together too, once the file is published. It does not appear just because one browser got a price tick.

Turning the file back to an empty list removes the costume on the next page load. Pets, gear, and stats are the same before and after.

## What this must not do

- No edit to `js/v2-rules.js`. No new tag. No new item in the gear file. No stat, no care, no slot.
- No orange Bitcoin mark. Orange stays on the characters that already use it.
- No price figure on the page, in HatchBot, or in the social hand-off.
- No request to a price host from the player's browser in the first version. You check the price. The site only reads the static file and the block tip it already has.

A later version can let the page read a price host. Even then: two hosts must agree, a failure hides the costume, and the result is still paint. It still does not enter the replay. Do not build that until you ask.

## Decisions for you

1. The new-high switch is a static file you update, with no price printed. Confirm that, or say you want the browser to read prices itself.
2. Which second price page you will look at before you update the file.
3. The ribbon window: 1,008 blocks before the Bitcoin halving block, and 144 after. Confirm.
4. Which calendar rows are real. Genesis day is 3 January. Counterparty's day waits for you to name it.
5. Confirm the red is `#c8102e` and that no costume uses orange.
6. Confirm costumes never become gear, even later. A wearable prize belongs in the weekly events plan and needs a rule gate. This plan does not.
