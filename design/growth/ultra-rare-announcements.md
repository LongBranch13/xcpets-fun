# Ultra-rare hatch announcements

Written plan only. Odds stay exactly as they are in `js/v2-rules.js`. Nothing in this doc changes them. HatchBot is not built here. @XCPets is not posted from here.

## Summary

A few eggs are rare enough to announce. The odds below are copied from the live rules and the labels the site already shows. HatchBot (XCPETS Ops) posts one short Telegram message when replay says one of those eggs hatched. XCPETS Social then posts the same fact from @XCPets, by hand, from a hand-off note. Ordinary Legendaries, Electric Egg cases, and weird eggs inherited by babies are too common for a post each. The first time the listener is turned on, it records what already hatched and posts nothing.

## Odds, as the rules stand

These numbers are the rules. This plan does not retune them.

**Normal egg tier** (`js/pet-core.js`, `TIERS`, chances out of 10,000): Common 6,000, Uncommon 2,700, Rare 1,000, Legendary 300. A normal Legendary is 3% of eggs. That is not ultra-rare.

**The 1-in-777 slot** (`js/v2-rules.js`, `baseHatchArt`, from block 971,665): `sha256(block hash + seed id + 'XCPETS:v2:naka777')`, first 12 hex, mod 777 equals 0. Seed id is the hatch tx, or `tx:i` inside a pack. This draw is done before the rare-egg buckets, and a hit skips those buckets (`rareApply` returns the art unchanged).

Who that slot is, in the order the function checks:

- White Rabbit, once `WR_POOL_FROM` is set. It stays unset until the Rabbit's own Cold Storage. The Rabbit is the community pet being fed. His egg is not in the slot yet.
- Homer Pepe, once `HP_POOL_FROM` is set. Homer went to Cold Storage at block 974,841 (`api/meta.json`). The next block is the slot. At the feed for block 975,627 this is the live 1-in-777 egg.
- Then FUNTRUMP, Lord Kek, and (from block 972,338) the Bitcoin Wizard. Those are history for new eggs. Nakamoto hatched from this slot only before block 972,338. No new Nakamoto hatches.

A community-species egg then rolls Rare or Legendary at 1,000 : 300 (`SPECIAL_RARE_W` / `SPECIAL_LEG_W`, about 76.92% Rare and 23.08% Legendary). Nakamoto, when it existed, was fixed Legendary (`SPECIAL_TIER.nakamoto.fixed = 3`).

**Rare-egg buckets** (`RARE_BUCKETS`, `RARE_D = 86902439766912`, live from block 974,962). Only eggs that missed the 777 slot can land here. The site's labels in `js/v2-render.js` (`RARE_ODDS`) already fold in that 776/777 protection:

| Kind | Rule weight | About 1 in | Site label |
|---|---|---|---|
| Starlord Kek (`god`) | 1,118,768,112 | 77,777 | God |
| Bitcoin Wizard (`wizard`) | 11,188,688,112 | 7,777 | Legend |
| Lord Kek (`kek`) | 11,188,688,112 | 7,777 | Legend |
| DJ Pepe (`djpepe`) | 22,380,253,973 | 3,888 | Legend |
| Each weird kind (tiny, giant, two-headed, inverted, ghost, backwards, wrong-egg) | 15,998,240,016 | 5,439 | The chip says "about 1 in 5,400" |

The bucket math is `rareTicket` then `rareBucket`. It does not use the pet's normal trait roll. A weird parent can pass the weird look to a baby on a separate 1-in-77 draw (`weirdBreedRoll`). That pass is not a new ultra-rare hatch.

**Electric Eggs** (`ELECTRIC_TIER_10K`, out of 10,000): Legendary 800, Rare 2,200, Uncommon 4,000, Common 3,000. The 777 slot and the rare buckets still apply per egg. An Electric case is 1,000 eggs. Its 8% Legendary rate is not an announcement.

**1-of-1 grants** (Bo Jackson, Rarepigeon, Viking, Orange Dragon, the contest eggs, the supreme eggs) are minted by the rules to a named wallet. They are not a public hatch roll. They already show on the live feed as "arrived as an egg (1 of 1)". They are not this announcer.

## What counts as ultra-rare

Announce only a generation-0 egg the replay just hatched that is one of these:

- The 1-in-777 slot (today, a player Homer Pepe with no `rareHatch` record).
- A rare-egg Legend or God: `rareHatch.version === 1` and kind `god`, `wizard`, `kek`, or `djpepe`.

Do not announce:

- A normal Legendary, Rare, or Uncommon.
- A weird egg (any of the seven kinds), including a wrong egg.
- A baby that inherited a weird look (1 in 77).
- A bred community-species pet. Breeding is not this draw.
- An Electric case as a whole. If one egg inside it is on the list above, announce that egg only.
- A 1-of-1 grant.
- Anything in practice mode.

Weird eggs stay on the site. The live feed already highlights them (`js/v2-live.js`). They are common enough, across seven kinds, to flood Telegram if each one posted.

## How to see one in the feed

`api/pets.json` is the public cross-check. Column `rareHatch` is on each pet row. `js/pets-feed.js` expands it. A Legend or God egg has `rareHatch.version` 1 and one of the four kinds above, `generation` 0, `parents` null, and `bornBlock` at or after 974,962.

A 1-in-777 Homer does not get `rareHatch`, because the 777 hit returns before the buckets. On the feed it is species Homer, generation 0, no parents, `bornBlock` at or after 974,842. Confirm with replay. The feed does not store the block hash, so it cannot recompute the 777 draw by itself.

The feed is rebuilt about once an hour and can trail the site. HatchBot does not wait on it. The trigger is a replay of the burns, the same way `tools/hatchbot-listen.js` already loads a world for a Pantheon seat. The feed is the check a person can do without the bot.

`api/recent-events.json` is shop and token events. It is not the hatch list.

## HatchBot message (XCPETS Ops)

Owned by XCPETS Ops. The site does not run it. Describe only. Do not build it in this change.

Follow the Pantheon listener. It stays quiet unless an env flag and `enabled: true` are both set, plus a token and a chat to actually send. The first enabled pass writes down every qualifying egg already in the replay and posts nothing. After that, a new egg posts once. The key is `rare-<tx>-<pet id>`. The same key never posts twice.

One message per egg, plain text, under 1,000 characters. The send-guard on the Pantheon hook already blocks a wallet address, an `http` link, an `@`, and price talk. Keep that guard. The only link is the bare pet path.

```
🎧 LEGEND EGG
#184200 hatched as DJ Pepe (about 1 in 3,888).
Block 975,700.
xcpets.fun/pet.html?id=184200
```

Swap the first line for the kind:

- God: `🌌 GOD EGG` and "Starlord Kek (about 1 in 77,777)".
- Wizard: `🧙 LEGEND EGG` and "a Bitcoin Wizard (about 1 in 7,777)".
- Lord Kek: `🐸 LEGEND EGG` and "Lord Kek (about 1 in 7,777)".
- Homer slot: `🍩 777 EGG` and "Homer Pepe (1 in 777)". When the Rabbit later takes the slot, the species name changes with the rules. Do not hard-code Homer past `WR_POOL_FROM`.

No owner address. No price. No "buy". The block number and the pet id are enough to find the burn.

## Spam limits

- At most 8 Telegram posts per chain day (144 blocks). A ninth qualifying egg in that day is held for the daily digest line, not dropped.
- Digest line, once, at the end of the chain day if anything was held: `Also hatched: #id, #id. See the live feed.` Still no addresses.
- A pack posts one message per qualifying egg, still under the cap of 8. The rest go to the digest.
- An Electric case cannot post 1,000 lines. Only eggs on the ultra-rare list are candidates, and the cap still holds.
- Weird eggs never take a slot in the 8.
- If replay is behind the chain tip, post nothing until the hatch block's hash is in the replay. A missing hash is how the rules refuse to roll an egg. The bot waits the same way.

## Hand-off to @XCPets (XCPETS Social)

Ops posts to Telegram. Social posts to X. The game does not post to X.

When Ops's listener accepts a message, it also writes a hand-off note for Social. The note is the Telegram text, the pet id, the kind, the block, and the pet URL. Social copies it, looks at the pet page, and posts from @XCPets when they want to. Social can skip, shorten, or wait. A skipped note is not an error.

Suggested X post, still with no address and no price:

```
A DJ Pepe legend egg just hatched. About 1 in 3,888.
https://xcpets.fun/pet.html?id=184200
```

Social owns the wording on X. Ops owns the Telegram wording above. Neither one edits `js/v2-rules.js` to make a post.

## Decisions for you

1. Confirm the announce list: 777-slot, Starlord Kek, Wizard legend, Lord Kek legend, DJ Pepe. Weird eggs stay off it.
2. The daily cap of 8, and the one digest line.
3. Whether Ops may turn the listener on. The first run posts nothing.
4. Whether Social wants the hand-off note in the Ops chat, or only on request.
5. When the Rabbit takes the 777 slot, the Homer line changes to the Rabbit by itself. Confirm you want that.
