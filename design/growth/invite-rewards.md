# Invite rewards

Written plan only. Nothing here changes the game. `js/v2-rules.js` stays as it is until you say yes to a gear grant.

## Summary

A player shares a pet page with a `ref` on the link. When a new wallet hatches its first egg, the inviter gets a badge or one piece of gear. No XCP, no token, no cash. The reward is real only if the invite is written into the invitee's burn, because a note kept in the browser can be faked and no one else can check it. The burn memo is 34 bytes, so the memo stores the inviter's player number, not their Bitcoin address. A badge can be drawn without a rule change. Putting gear in the stash is a gated change in `js/v2-rules.js`, and only you turn that gate on.

## The link

The live pet page is `https://xcpets.fun/pet.html?id=<id>`. That is the `urlBase` in `api/pets.json`. There is no `/pet/<id>` path today. A request for one falls through to the 404 page. Use the live query until you ask for a redirect:

`https://xcpets.fun/pet.html?id=15004&ref=1A`

`ref` is either the inviter's player number in base 32 (digits and A–V, the same alphabet `pet:give` uses) or a pet id. A full address in the link is allowed as a convenience (`ref=` plus the address). The page looks that address up in the replay and shows the player number it will actually put in the burn. The burn never contains the address.

Player number is already in the rules. It is the order of each address's first XCPETS burn, block then tx, starting at 1. Any burn counts, including a 1-dander `pet:hi`. It is derived from history, so every browser assigns the same numbers.

If the visitor lands with a pet id, the page resolves that pet's owner at the current tip and uses that owner's player number. The number is what gets signed. A later sale of the showcase pet does not move the reward.

The pet page does not have a share button yet. Add one next to the pet's name: "Share". On a phone it opens the share sheet. On a desktop it copies the link. The rank card in `design/growth/rank-brag-cards.md` uses this same link.

## What gets written on chain

`parseTag` accepts `pet:hatch` only when the tag has exactly two fields. `pet:hatch:SOMETHING` is an unknown tag today. The egg would not hatch. Do not put the invite on the hatch tag.

The invite is its own 1-dander burn, sent before the hatch, from the new wallet:

`pet:inv:<player number in base 32>`

Example: `pet:inv:1A`. That is well under 34 bytes (`MAX_TAG_BYTES` in `js/v2-rules.js`, the same cap Counterparty uses). Until you gate it, this tag is an unknown `pet:` tag. The dander is community food, and the memo is still public on the destroy. A display-only reader can see it. The hatch is a separate normal `pet:hatch` (or a pack or an Electric Egg case) and is judged exactly as today.

The page builds both burns and asks for them in order: the 1-dander invite, then the hatch. If the player refuses the invite burn, the hatch still works and nobody is credited. A typo in the ref cannot eat the egg.

## When the reward is earned

All of these are true at the hatch burn, in replay order:

- The invite burn is from the same address as the hatch, its block is not after the hatch, and it is inside the previous 1,008 blocks (the same week length the badges use). An invite older than that has expired.
- The player number on the tag matches an address that already had a player number before this burn. You cannot invite from a number that does not exist yet.
- This hatch is the address's first successful generation-0 egg. That means `pet:hatch`, `pet:hatch12`, `pet:hatch144`, or `pet:hatchzap`, the replay accepted it, and before this burn the address owned no pet at all, including dead and released pets. A bred egg does not count. The community pet does not count. A pack or an Electric case counts as one invite, on the first egg in that burn, even though it hatches many pets.
- The hatch paid the real hatch price at that block (`costAt` of base 69, which follows the halving and a Fire Sale). A 1-dander plain burn is not a hatch.
- The inviter address and the invitee address are different. The showcase pet, if one was used to build the link, is not owned by the invitee.

The reward is marked on the inviter at that hatch's block and tx. One invitee address pays one reward, ever. A second egg from the same wallet does nothing.

## Badge or gear

- **Badge.** A new display badge, same style as `js/v2-badges.js`: read the public burns, show "Invited a first egg" with a count. It does not enter the world. Replay stays the same. No change to `js/v2-rules.js`. This is the right first ship.
- **Gear.** One existing shared piece from `js/v2-gear.js`, not a signature piece, placed unequipped in the inviter's stash inside replay. That is a gated change in `js/v2-rules.js`. You set `ACTIVATE_INVITE_BLOCK` to the tip plus about 6 when you want it. Before that block, `pet:inv` stays community food and grants nothing, and old replays stay the same.

The grant uses the hatch tx as its id, so it cannot double-pay. The piece is fixed, not rolled. The burned dander and the hatch cost stay burned.

If the inviter has no pet to wear it, the piece waits in the stash. The stash already works that way for founder gear.

## Checks against abuse

- **Self-invite.** Same address on both sides pays nothing. A player number that resolves to the hatch address pays nothing.
- **Showcase swap.** The memo stores the player number taken when the invite burn is signed, not "whoever owns pet N later".
- **Sybil wallets.** Each new wallet must pay a real hatch. At the feed for block 975,627 the halving has fired three times, so a base 69 hatch is 8.625 XCPETS before any Fire Sale. A pile of empty wallets costs a real hatch each, plus the Bitcoin fee. The reward is one piece of ordinary gear, so the hatch is the expensive part.
- **Cap.** An inviter receives at most 5 gear grants per 1,008-block week. Further qualifying hatches in that week still count on the badge and pay gear only after the next week boundary, up to 5 again. You can set the 5.
- **Cooldown.** One reward per invitee address, forever. No second cooldown is required on top of that. The inviter's cap is the weekly 5.
- **Old wallets.** An address that already had any pet, including a dead or released one, is not a first hatch. An address whose first egg was a breed does not qualify later by hatching. The first pet of any kind closes the door.
- **Burn addresses.** A hatch from a provably unspendable address does not pay. The rules already know those addresses (`isBurnAddr`).
- **Local-only ref.** The `ref` query is a hint so the page can fill the memo. If the memo is missing, the query pays nothing. Clearing cookies does not create or destroy a reward.
- **Rejected hatch.** A hatch the replay rejects pays nothing, even if the invite burn is sitting there. The invite can still be used on a later successful first hatch inside the 1,008-block window.

## Where it shows up

- Pet page: Share, and a line "Invited by player N" once the invite burn is in the replay. No wallet address on screen.
- Play, first hatch confirm: if a `ref` is in the session from the pet link, the confirm lists the 1-dander `pet:inv` and then the hatch. The player can drop the invite line and hatch alone.
- Inviter's My Pets: badge row, and the new piece in the stash when the gate is on.
- No new page is required. A small "Invites" fold on the pet page is enough: count this week, cap, link to copy.

The session copy of `ref` lives in `sessionStorage` for that tab only. It is not the record. The burn is the record.

## Decisions for you

1. Ship the badge first, with `pet:inv` still just community food, and add gear only after you have watched it.
2. The gear piece, if you want one: which existing shared item.
3. The weekly cap. This plan uses 5 gear grants per inviter per 1,008 blocks.
4. The invite window. This plan uses 1,008 blocks before the hatch.
5. Whether a pack or an Electric case may be the first hatch. This plan says yes, and it pays once.
6. The gate block, set by you at deploy to tip plus about 6, if you want the gear.
7. Whether you want a pretty `/pet/<id>` path later. The working link is `pet.html?id=<id>&ref=<player number>`.
