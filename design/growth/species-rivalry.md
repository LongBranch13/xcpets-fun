# Species rivalry

Written plan only. Nothing here changes the game. `js/v2-rules.js` stays as it is until you say yes to a gear prize.

## Summary

Each week the ordinary species play as teams. Points come from real burns in that week, divided by how many living pets that species had when the week opened, so a huge species does not win by headcount. Every browser that replays the same burns gets the same table. The prize is a badge for the winning team, and, only if you gate it, one piece of gear for the top contributor. No XCP, no token, no cash. The badge needs no rule change. The gear does.

## The week

Same clock as the weekly events plan and as `js/v2-badges.js`. Week length is 1,008 blocks from anchor 971,501. The table is final when the tip has reached the week's end block. Before that the page says "so far".

Tie-break for the teams: higher score, then the earlier block of the action that last raised the winning score, then the species id in alphabetical order.

## Who is on a team

A pet plays for one species id.

- The twelve ordinary species are teams: Pepe, Wojak, Chud, Bobo, Mumu, Snibby, Dodo, KEVIN, Peepo, Sarutobi, Doge, Lenny. Weights in `js/pet-core.js` do not affect the score. They only explain why some species have more pets.
- Chad is its own team. Chad joins the hatch pool from block 974,962 (`ACTIVATE_RARE_EGGS_BLOCK`) with weight 8. Some gear code treats Chad like Chud for looks. The rivalry uses the species id, so Chad is not folded into Chud unless you say so.
- A hybrid scores for the species in its id after `hyb:` or `hyb3:`, the first root only, so one pet is one team. A Pepodo scores for Pepe.
- Community-slot species sit out: Nakamoto, Bitcoin Wizard, Lord Kek, FUNTRUMP, Homer Pepe, White Rabbit, DJ Pepe. So do 1-of-1s (Bo Jackson, Rarepigeon, Viking, Orange Dragon, contest and supreme pets). Their burns do not add team points. There are too few of them to be a fair team, and a single pet must not win the week by existing.

A species needs at least 10 pets living at the week's start block or it sits out that week. "Living" means hatched before the start block, not released, and not dead at the start block. Dead is judged the way replay judges it at that block.

## How a point is scored

Only actions the replay accepted, with the burn's block inside the week. Rejected burns score zero. Practice scores zero. The amount of XCPETS is not the score. A rich wallet cannot buy the week by overpaying one meal.

Each of these is 1 point for the pet's team:

- A meal that actually fed that pet (the feed log, including a pet fed inside feed-all).
- A gear piece the replay placed from a paid spin or roll onto that pet, or into its bag, in this week.
- A fight win whose accept block is in the week. The loser's team gets nothing for the loss.
- A breed that produces an egg. Each parent's team gets 1, if that parent is on a team. Twins still count as one breed, matching the rules (one breed, two eggs).
- A raid hit that dealt damage. The raid's own trophies are unchanged. This point is only the rivalry score.

Then:

`team score = points during the week / living pets of that team at the start block`

Round the displayed number to 4 decimals. Compare the exact fraction. A species with 3 points and 10 pets (0.3000) beats a species with 100 points and 1,000 pets (0.1000).

The contributor board, inside the winning team, is by address: how many of those points came from pets that address owned at the moment of the action. If the pet was sold mid-week, the new owner gets later points and the old owner keeps the earlier ones. Ties on the contributor board: more points, then earlier last point, then address alphabetical.

## Verifying it

1. Replay the public destroys with the published rules, through the week's end block. Ignore local equips.
2. List pets that were living at the start block and map them to a team with the rules above. Count the denominator.
3. Walk the week's accepted log lines and add the points.
4. Divide. Sort with the tie-break.
5. `api/pets.json` can show species and owner, and it lags. It has no per-burn log, so it cannot verify the score. The burns do.

The page and the check call one function. If the shop or the feed is late, the rivalry does not care. It only reads burns and the replayed pets.

## UI

Bitcoin red `#c8102e` is the live mark. Gold `#ffd166` is the leader. Species colors stay the pet's own colors. Do not paint Bitcoin orange.

Desktop:

```
SPECIES RIVALRY · week 42 · blocks 1,013,837–1,014,844
Final. Pepe leads.

Pepe     0.8420   421 pts / 500 pets     ============
Doge     0.6100    61 pts / 100 pets     =======
Chad     0.4000     4 pts / 10 pets      ====
Wojak    0.1200   240 pts / 2000 pets    =
...
Pepe contributors
1  you     40 pts
2  bc1p…   22 pts
[ Share ]  [ How this is scored ]
```

Phone: the bar chart stacks. The player's team is pinned under the top three. Tap a team to open its contributors. The share button builds the rank card for "my team this week" using the same canvas rules as the player rank card.

A team that sat out shows as "not enough pets (7 / 10)" in a folded list, not as a zero-score winner.

## Prizes

- **Badge.** Every address that scored at least 1 point for the winning team gets a display badge, "Team Pepe, week 42", drawn like the other badges. No write into the world. No change to `js/v2-rules.js`.
- **Gear.** One existing shared piece, unequipped, into the stash of the top contributor on the winning team. That grant runs inside replay at the end block, once the end block's hash is known, behind a gate you set to tip plus about 6. Before the gate, this whole prize does nothing and old replays stay the same. The piece is fixed by you. It is not a signature item and not a spin.

If no team qualified, the week pays nothing.

Raid trophies, Pantheon seats, and the weekly burn-race prize are separate. This week does not replace them and does not pay them twice.

## Anti-cheat

- Dumping XCPETS into one burn does not add points. Only the accepted actions above count, one each.
- A wallet of a thousand Pepes raises Pepe's denominator too, if they were alive at the start. Pets hatched during the week can earn points and do not enlarge the denominator. That is a small edge. The 10-pet minimum stops a brand-new species of one pet from winning on a single meal.
- Moving a pet across wallets moves later points only. It does not move points already scored.
- Two wallets you own do not merge. They show as two contributors.
- Hybrids cannot score twice. One root, the first one.

## Rollout

Ship this after the plain weekly board has closed two weeks, so the replay reader is already trusted. First two rivalry weeks: board only. Then the badge. Gear only when you set the gate.

## Decisions for you

1. Chad as its own team, or folded into Chud.
2. Hybrids score for their first root. Say if you would rather leave hybrids out.
3. Community-slot species and 1-of-1s sit out. Say if any of them should be a team.
4. The minimum of 10 living pets at the start block.
5. The point list above. Say if arena wins should be worth more than a meal.
6. Badge for everyone who scored on the winning team, and gear only for the top contributor, after you set a gate.
7. Which existing shared gear piece, if you want the gear at all.
