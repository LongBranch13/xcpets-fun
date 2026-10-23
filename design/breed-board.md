# Rug Me breed board (was "Swipe Right") — design + build notes

_Draft Oct 22, 2026 (CT). Design only. No game code changed, nothing merged, deployed or posted. Based on origin/main `js/v2-rules.js` (worktree /workspace/wt-recap-main, head f3f3223) and the Gooby's No-Tail Motel breeding UI in play.html._

## 0. The joke, in one line
A dating app for 8-bit pets. Your pet posts a profile with impossible standards ("only Legendaries, no broke pets"). Pets that meet the standards swipe right with one burn, and Gooby hands them a motel key. **Every line is about pets and their stats, gear and tier, never about people or bodies.** It's a gold-digger and status joke (rarity, drip, net worth in XCPETS), the same register as "wen moon". (See the copy guardrails in section 5.)

## 1. How breeding works today (what we build on)
- `pet:breed:A:B`, 690 per side. Same owner: it breeds at once. Two owners: the first burn is a **request** (`w.breedReqs.push`), and the partner accepts by burning the mirror `pet:breed:B:A` within `BREED_WINDOW` = 144 blocks.
- `breedable()`: alive, not released, not community, Adult+ (stage >= 3), not neglected, 1,008-block cooldown, v2 lifetime cap of 6 (`ACTIVATE_BREEDING_V2_BLOCK` 972,589), no kin (`kinWhy`), plus the Nakamoto/Wizard/Kek species rules.
- Every burn feeds the community pet, including rejected ones.
- Today a request is **directed**: A has to name B. The board adds the **open** request: A names standards instead of a partner.

## 2. On-chain mechanics

### 2.1 New tags (gated)
| Tag | Who | Cost | Effect |
|---|---|---|---|
| `pet:ad:A:REQ` | owner of pet A | **690** (A's breed half, prepaid) | Opens Ad #N (N = the ad's sequence number in replay order, like the fight `accept:N`). |
| `pet:rug:B:N` | owner of pet B, a different owner | **690** | Accepts Ad #N. If B meets REQ and both pets are breedable, it **breeds right then** (the child comes from the normal `breed(w, A, B, ...)` path) and closes the ad. |
| `pet:unad:N` | ad owner | 1 dander (0.00000001 XCPETS, like `rel`/`wagmi`) | Cancels Ad #N. The 690 is not refunded (it was burned; see 2.4). |

- One accept burn does the breed. The poster prepaid their 690 when posting, so the accepter doesn't wait for anyone, and there's no second step.
- Total cost is **690 + 690 = 1,380**, the same as any two-owner breed today. Nobody pays a "board fee". Cancel is a 1-dander burn.
- Child, odds, hybrid rule, bred-true bonus, breed carry, body-part trading, cooldown and the lifetime cap all stay untouched: the accept calls the same `breed()`, and that counts as one breed for **both** parents.
- Ownership of the child: same as today's cross-owner accept (`breed(w, Y, X, bh, tx, b, req.owner)`). **Open question Q1:** does the poster or the accepter get the egg? Today the egg goes to the requester (`req.owner`). The proposed default is the same: the **poster** gets it. Option: twin eggs only happen naturally, so no change there.

### 2.2 Gate and replay SAME
- `ACTIVATE_BREED_BOARD_BLOCK = tip + ~6` at deploy time, set like the breeding v2 gate.
- `ad`, `rug` and `unad` are unknown tags today, so every earlier burn with those words already replays as "unknown pet: tag (community food)". The handler must return **that same rejection string** for `b < gate` (the `croll` pattern). parseTag can learn the tags; handle() decides by block.
- No RNG stream is added or moved. The breed uses the accept tx's block hash plus tx hash, exactly as a mirrored `breed` accept does today.
- Check: run `tools/replay-check.js` at the current tip before and after. Overall, pets and gear hashes must be SAME.

### 2.3 Validation at the accept block `b` (replay, in this order)
1. The ad exists, is open (not used, not cancelled) and `b - ad.block <= AD_WINDOW` (proposed **1,008 blocks, about 7 days**; Q2). Otherwise reject: "ad #N expired/closed" (the 690 still feeds the community pet, like any rejected burn).
2. `below(amt, 690)` → reject.
3. B is owned by `src`, and `src !== ad.owner`. Self-accept is pointless: same-owner pairs already breed directly.
4. A still belongs to `ad.owner`. Pets can't be transferred today, but this guards the future.
5. `breedable(A, b)`, `breedable(B, b)` and `kinWhy(A, B)`, the same rules as a normal breed.
6. **B meets REQ, judged on B's state at block b**: tier, stage, species, gear owned, Power, etc. (section 3).
7. Breed → `ad.used = true`, then log `bred via ad #N`.

**Q3 (equipped vs owned gear):** "equipped" is device-local (localStorage) and **not on chain**, so replay can only check gear a pet **owns** (has rolled or won). The board says "has a Crown", not "wears a Crown".

### 2.4 Expiry, cancel, dead or changed pets
- **Expiry:** the ad closes on its own after AD_WINDOW. No burn is needed, and it just drops off the board.
- **Cancel:** `pet:unad:N` (a 1-dander burn). It's a burn, so it can't refund anything. The poster's 690 is gone either way, which is the "price of putting yourself out there" joke. **Q4:** should the cancel or expiry earn a consolation, e.g. the prepaid 690 counts as a normal 690 community feed (it already does) plus a "Left on read" cemetery-style badge? Or should posting be cheap (69) and the accepter pay 1,311? See the alternative below.
- **Poster's pet dies, becomes neglected, hits cooldown or the cap, or breeds elsewhere in the meantime:** the ad stays open but **dormant**. An accept while A is not breedable is rejected at step 5, so the UI hides dormant ads from the board (they show "💤 Ghosted" on the poster's own list). If A becomes breedable again before expiry, the ad comes back. A dead pet's ad never comes back. **Q5:** should the death of A auto-close the ad instead? The result is the same either way.
- **The accepter's pet changes:** thresholds are checked only at the accept block. A pet that qualified when you tapped but lost gear in a fight before the burn confirms gets **rejected** (690 lost to the community pet). The send guard (like `breedBlock`/SEND_MARGIN) re-checks at tip + 1 and warns.
- **Race:** two accepts in the same block → the first in replay order wins, and the second is rejected ("ad #N already taken"). The UI shows pending accepts from mempool/unconfirmed (as the breed list already does) as "Someone's already swiping…".
- **One open ad per pet** (a second `ad` for A replaces the old one, or gets rejected; Q6). Proposed: reject, with "#A already has an ad, cancel it first".
- An open ad does **not** lock A. The owner can still breed A normally, and that just makes the ad dormant or spends a cap slot.

### 2.5 Alternative pricing (for Q4)
| Model | Post | Accept | Cancel/expiry loss |
|---|---|---|---|
| **A (recommended): prepaid** | 690 | 690 | 690 |
| B: cheap listing | 69 | 1,311 (pays the poster's half too) | 69 |
| C: bounty | 690 + optional tip burned | 690 | 690 + tip |
B makes ads spam-cheap, and the accepter pays almost double, which kills the "gold digger" joke because the broke pet would be paying. A keeps the 1,380 total and is the simplest to replay.

### 2.6 Static site, no server
Everything comes from the same burn history the game already replays: `w.ads[]` is built in replay just like `w.breedReqs`. The board is a filter over `w.ads` (open, not expired, A breedable) × my pets (meets REQ, breedable, not kin). There's no index server and no off-chain listing, and the ad text is the tag itself.

## 3. Threshold options (REQ grammar)
Tags must stay short, so REQ is dot-separated codes in any order. All are optional, and an empty REQ means "open to anyone" (`pet:ad:A:any`).

| Code | Meaning | Example |
|---|---|---|
| `T1..T3` | min tier (1 Uncommon+, 2 Rare+, 3 Legendary) | `T2` = Rare+ |
| `S3..S5` | min stage (3 Adult, 4 Elder, 5 Mythic) | `S5` = Mythic only |
| `Pxxx` | species (pepe, doge, ... `hyb` = any hybrid, `pure` = no hybrid) | `Pdoge` |
| `Xxxx` | NOT this species ("no Wojaks") | `Xwojak` |
| `Gid` | owns gear item id | `Gcrown` |
| `Kslot` | owns any ★ signature (legendary) piece / in a slot | `Kany`, `Khead` |
| `Wn` | min Power (Vigor+Spark+Grit+Zoom+Luck) | `W60` |
| `Fn` | min days fed (no "broke" unfed pets) | `F5` |
| `Bn` | min fight wins | `B3` |
| `C0` | no black eye right now (if blackEye is replayed state) | `C0` |
| `Ln` | max breeds used ("first-timers only") | `L0` |

Example: `pet:ad:228:T3.S4.Gcrown` = "#228 seeks a Legendary Elder+ with a Crown."
Limits: at most 4 codes, and any unknown code makes the **ad** rejected at post time (so it never shows a typo'd ad). The UI builds REQ from chips, so nobody types it.

## 4. UI flow: Rug Me swipe stack (inside Gooby's No-Tail Motel, play.html)
_Revised Oct 22, 2026 ~8:05 PM CT per owner feedback: Tinder-style card stack. The on-chain mechanics in section 2 are unchanged._

The motel tab row is `🛎️ Check in` (today's directed breed) | **`🧶 Rug Me`** | `📮 My ads`.

**Swiping as (my pet)**
- The top bar is a "Swiping as" picker (V2Picker, showing only my breedable pets, with "N/6 breeds left").
- The stack shows **only open ads my selected pet qualifies for** (open, not expired, not taken, poster pet breedable, not kin, not my own, every REQ code met by my pet at tip + 1).
- A toggle reads **"Browse all"** (window shopping). It also shows ads my pet doesn't qualify for, greyed out, with the failing badge ("❌ Too broke: needs Legendary"). On those cards swipe right is disabled, and only skip works.
- The order is deterministic: newest first, with ties broken by ad number.
- When the stack is empty, it says "No one is ready to rug you today. Post your own ad →".

**The card (one at a time)**
The poster pet's real species sprite (big, pixelated) with its tier color frame. Each card shows:
- name and #id
- tier, species and stage
- traits (pattern, eye, hybrid parts)
- ⚡ Power
- the standards as badges (✔ or ❌ against my pet)
- the blocks left, with ~days
- the poster's short address (6…4)
- one **preset joke bio**. It's chosen deterministically from the ad tx hash, so it's the same for everyone with no server, and there's no free text.

The 2 cards behind it peek out as a stack.

**Swipe left = skip (NGMI)**
- Local only, **no burn**. The card flies left with a pixel **NGMI** stamp.
- The skip is stored in localStorage as `xcpets-v2-rugskip-<net>-<addr>-<petId>-<chainDay>` (chainDay = floor(tip / 144)), holding a list of ad numbers. When the next chain day starts, the skipped ads come back.
- There's an "↩ Undo" chip for the last skip.

**Swipe right = accept (RUG ME)**
- The card tilts right with a pixel **RUG ME** stamp, then the **normal single XCP Wallet burn confirm** opens. It's one wallet window (the one-request-at-a-time rule) for `pet:rug:MYPET:N` · 690, and the summary reads "#B 💘 #A · breeds at once · egg goes to …".
- It **never auto-burns**. If I cancel the confirm or the wallet window, the card snaps back to the top.
- The send guard (tip + 1) runs before the wallet opens. If it fails, the card shows the reason and doesn't open the wallet.
- After the burn is sent, the card shows "Pending… someone may still beat you to it". On confirm it shows the existing breed scene and an "It's a match! 💞 Egg #N" banner.

**Input**
- Phone: drag or flick the card (the commit threshold is about 35% of the card width). A drag that crosses it shows the stamp at an opacity that grows with the drag distance. There are also big ✖ / 💘 buttons below the card.
- Desktop: the ✖ NGMI and 💘 RUG ME buttons sit left and right of the card. **← / →** arrow keys do the same. Enter opens the pet detail. The right action still only opens the confirm.
- Accessibility: the buttons have aria-labels, and reduced motion means no fly animation, only a fade.

**Posting (My ads → "Post my pet")**
1. Pick the pet.
2. Pick standards from chips (tier, stage, species or not-species, owns gear or any ★, Power, days fed), with a live counter: "37 pets on chain qualify" (or "0 qualify. Standards: delusional.").
3. Confirm: "Burn 690 · your half, paid up front · ~7 days · cancel any time (no refund)". This opens one XCP Wallet window.

Once the ad is confirmed, **my pet's card joins the stack** for every qualifying pet. On My ads I can see my own card as others see it, plus the status: open / 💤 Ghosted (my pet is not breedable) / matched / expired ("Left on read") / Cancel (a 1-dander burn).

**Matches for the poster:** the existing incoming pop-up says "💌 #B swiped right on #A. It's a match. Egg #N."

## 5. Meme copy

### Names for the ad and the board (replacing "breed wanted")
1. (dropped by the owner, Oct 22 8:37 PM: no special label; a posted pet is just a Rug Me card)
2. ⭐ **Swipe Right**: the board is "Swipe Right", and the accept is "Swipe right · 690".
3. ⭐ **Wen Breed?**: the ad headline is "#228: wen breed?", and the board is "Wen Breed Board".
4. **Simp Signal**: the post button is "Light the Simp Signal".
5. **Looking for Daddy (Legendary)**: works as a preset bio, not as the board name (it reads sharper as a single ad).
6. **Gold Digger Board**: "no broke pets".
7. **Tinder for Tamagotchis**: works as a subtitle.
8. **Rug Me Gently**: a preset bio, maybe too much for a board name.
9. **The Mating Mempool**: "your ad is in the mempool".
10. **NGMI Without You**: a preset bio.

**Top picks (superseded):** **Swipe Right** for the board name and **Wen Breed?** for the headline.
Final: _"💘 Rug Me"_ (owner pick).

### Preset bio lines (picked from the ad tx hash; all about the pet)
- "Only Legendaries. No broke pets."
- "Looking for Daddy (Legendary). Must own a Crown."
- "If you can't fit in the Crown, you can't fit in my family tree."
- "No Commons, no Wojaks, no unfed degens."
- "Must be Elder+. I don't date Hatchlings, I'm not a babysitter."
- "6 breeds left and I'm not wasting one on a Common."
- "Show me your Power level. Under 60, swipe left."
- "I'm a 10 and my stats prove it on chain."
- "Fed 9 days straight. You should be too."
- "Not looking for hybrids. Pure-bred or bye."
- "Diamond paws only. Paper paws need not apply."
- "Ser, this is a Legendary-only motel."
- "Wen breed? Now. If you're Rare+."
Empty and status lines: "0 pets qualify. Standards: delusional." / "Left on read (ad expired)." / "💤 Ghosted: this pet is on cooldown." / "It's a match! 💞 Egg #N."
Rejected-for-you badge: "❌ Too broke: needs Legendary" / "❌ Needs a Crown" / "❌ Too young: Elder+ only".

### Copy guardrails (keep it a pet joke, never creepy)
- Talk only about pet stats: tier, stage, gear, Power, days fed, species. **Never** body parts, appearance-as-attractiveness of people, age-as-a-person, or anything sexual. "Breed" means the game action and the egg.
- No free-text bios: preset lines only, reviewed. This is the main protection against creepy content.
- Joke on status and money (gold digger, broke, simp, rug), not on desire.
- No "baby" or "kid" language beyond the game's Egg and Hatchling. "Hatchling" is only ever a stage being turned down for being too low a stage, with the babysitter line about care, not people.
- Write "times", never "x", in player copy, and write "#228 💘 #891" for pairings rather than "#228 x #891". (The existing "Bred from #A × #B" line is outside this scope.)

## 6. Open questions for the owner
- **Q1** Who gets the egg: the poster (like today's requester) or the accepter?
- **Q2** Ad lifetime: 1,008 blocks (~7 days), or 144 (~1 day, like today's requests)?
- **Q3** Gear thresholds can only check **owned** gear (equipping is local). Is "has a Crown" OK?
- **Q4** Pricing model A (prepaid 690/690, recommended), B (69 post / 1,311 accept), or C (bounty)? Should cancel or expiry give any consolation?
- **Q5/Q6** Should a dead poster pet auto-close its ad? One ad per pet?
- **Q7** Which threshold codes go in v1 (suggested: tier, stage, species/not-species, owns gear, any ★, Power, days fed)?
- **Q8** Final names: Swipe Right / (dropped label) / Wen Breed? And is "Looking for Daddy (Legendary)" OK as a preset bio?
- **Q9** Should HatchBot (Telegram) announce new ads and matches? It would be a separate approval.


## Owner decision (Oct 22, 2026 7:59 PM CT)
Board name: **Rug Me** (owner pick, shortened from "Rug Me Gently"). Replaces "Swipe Right" as the board name. Ad and accept wording ((dropped label)) and the headline are still open.

## New open questions (Oct 22, 2026 ~8:05 PM CT, swipe stack)
- **Q10** Should skips reset every chain day (144 blocks), as specified, or should a skip last for the life of the ad?
- **Q11** Should skips be stored per selected pet (proposed) or per wallet across all my pets?
- **Q12** Order of the stack: newest first (proposed), soonest-expiring first, or rarest first?
- **Q13** If my selected pet qualifies but my other pets would too, should the card hint "your #742 also qualifies"?
- **Q14** Should the accept button keep the "I'm (dropped label)" wording, or say "Rug me · 690" to match the board?

## Owner decisions (Oct 22, 2026 ~8:01 PM CT): DECIDED
- **Q1 DECIDED:** the egg goes to the **poster** of the ad (matches today's `req.owner` behavior).
- **Q2 DECIDED:** ads last **1,008 blocks (~7 days)** (`AD_WINDOW = 1008`).
- **Q3 DECIDED:** gear thresholds check gear the pet **owns** ("has a Crown"). Equipped state is local and is not checked.
- **Q8 (part) DECIDED:** "Looking for Daddy (Legendary)" is approved as a preset bio.
- **Q9 DECIDED:** HatchBot (Telegram) announces new ads and matches. Nothing is posted until it's built and approved.

### HatchBot post format (spec only, nothing posted)
- Player-facing, **max 1,000 characters**. Write "times", never "x". Pairings use 💘 (e.g. "#891 💘 #228").
- **No price talk in character voice**: the joke lines never mention XCPETS amounts. An optional plain footer line may say "Swipe on xcpets.fun → Gooby's motel".
- Bio = the same preset line the card shows (from the ad tx hash). Pet and stat jokes only, never creepy.
- **New ad:**
  ```
  🧶 RUG ME: new ad at Gooby's No-Tail Motel
  Zoka #228 · Legendary Dodo · Elder · ⚡ 71
  "Looking for Daddy (Legendary). Must own a Crown."
  Standards: Legendary · Elder+ · has a Crown
  Open for ~7 days. Swipe right at xcpets.fun/play.html#no-tail-motel
  ```
- **Match:**
  ```
  💞 It's a match! Pori #891 swiped right on Zoka #228.
  Egg #5301 is in the incubator. Zoka got rugged 3 times this week and finally said yes.
  ```
- One post per ad and per match. No repeats (dedupe by ad number and tx hash), the same as the existing routines.

## Owner direction (Oct 22, 2026 8:03 PM CT)
- Rug Me runs ALONGSIDE the existing breeding select as its own tab/app on the Breed page; it does not replace the picker.
- Top toggle: **My pets** (swipe through pairings among the wallet's own pets, no ad needed, normal own-pair breed burn) / **Other pets** (swipe other owners' open (dropped label) ads).
- Pending owner OK on proposed defaults: 690 post + 690 accept; one ad per pet; ad closes if poster pet dies; skips reset each chain day, per pet; newest first; hint when another owned pet qualifies; button "Rug me · 690".

## Owner direction (Oct 22, 2026 8:05 PM CT), supersedes the 8:03 toggle
- NO My pets / Other pets toggle. Rug Me never shows your own pets as cards. You pick one of your pets to swipe WITH ("Swiping as"), and the stack shows only other owners' open (dropped label) ads. Pairing your own pets stays in the existing breeding select.
- Left swipe is free and local-only; the other owner never sees it. Only a confirmed right swipe (burn) is visible, as a match.


---

## Build notes (branch `rug-me`, preview, updated 2026-10-22 ~8:40 PM CT)

**Owner, 8:37 PM:** no special label. A posted pet just shows as a Rug Me card; its pet page and pop-up show a small **💘 On Rug Me** marker. The accept tag is **`pet:rug`**. Buttons: **Rug me · 690** (accept) and **Post on Rug Me**.

**Naming:** 1 sat of XCPETS is a **dander** in all player copy (cancel is "a 1-dander burn"). BTC network fees stay in sats.

**Gate:** `ACTIVATE_RUGME_BLOCK` in js/v2-rules.js is `null` (placeholder). At deploy, set it to tip + 6. Below the gate, `pet:ad`, `pet:rug` and `pet:unad` replay exactly as today ("unknown pet: tag (community food)"); `tools/replay-check.js` stays SAME.

**Tags (from the gate):**
- `pet:ad:IDS:REQ` (**69 per pet**, owner 8:42 PM; a Rug Me breed totals 759 = 69 + 690): IDS is one pet id or several joined by dots (`pet:ad:12.34.56:T2.S4`), each its own ad, open 1,008 blocks, one open ad per pet. REQ = `ANY` or up to 4 dot-joined codes (T tier+, S stage+, P species/HYB, G owns gear = worn or in the bag, W power+). **Bios are always random** (owner, 8:47 PM): the bio is picked deterministically from the ad tx hash + pet id out of the 13 presets; there is no picker. New tags never carry a bio field. An old-format trailing `:Bn` (B + 1-2 digits) is **accepted and ignored** (safer than rejecting a paid burn); any other 5th field is rejected as "too many fields". The whole tag must fit 34 bytes. Every pet in the tag must pass (yours, alive, Adult+, no open ad, under the cap) or the whole burn is rejected with a reason. A pet resting after a breed may still post.
- `pet:rug:MY:N` (690): accept ad N with my pet: breeds at once through breed(); the **egg goes to the poster** (poster pet = parent A). Both pets count the breed.
- `pet:unad:N` (1 dander): the poster cancels (no refund).
- Prices follow the halving / fire sale through `costAt` (replay `below()`, UI `planAmount`), so after a halving posting shows and burns as 34.5 per pet and Rug me as 345 everywhere. Button: **Post on Rug Me · 69** (times the pet count when several are ticked).
- Malformed standards (bad chars, empty code, ANY mixed in, a code twice, more than 4, too long) are rejected in the rules with the reason; the UI shows the same reason before you sign.
- Removed in this pass: the old label tags and the no-ad cards / breed-request path. The normal `pet:breed` request rules are untouched.

**Swipe stack:** only posted pets (other owners' open ads your "Swiping as" pet qualifies for), newest first. Left = local skip per pet per chain day with Undo; right = the single XCP Wallet confirm for `pet:rug`.

**Posting (multi-pet):** the 📌 form lets you tick one or many of your eligible pets (All/None), with **same standards for all** or **per pet** (bio is always random) (pick the pet to edit). It groups pets by settings and packs each group into as few <=34-byte `pet:ad` tags as fit; the summary shows pets, burns, each tag and the **total cost** before the confirm. Several burns go through the existing queue: one XCP Wallet window per burn, with progress, Stop, and Continue after a reload.

**Cards:** pixel tier pill, ad number, animated sprite, the full stat block (Vigor, Spark, Grit, Zoom, Luck plus Power), traits, bio, wants, blocks left.

**Owner shortcut:** the pet pop-up and the pet page show **📌 Post on Rug Me** to the owner only (not in view-only), opening the post form with that pet ticked (`play.html#rugpost-ID`; nothing is signed on the pet page).

**HatchBot:** `tools/hatchbot-rugme.js` writes "NEW RUG ME AD" (one per ad, key `rugme-ad-<tx>-<ad>`) and "IT'S A MATCH". DISABLED, not wired, never runs on the live HatchBot.

**Tests:** `node tools/rug-me-test.js` (gate off / below gate SAME, post / accept / cancel / expiry, egg to poster, multi-pet ads, ignored old :Bn field, random bio, fire-sale credit for ad / rug, 34-byte limit, malformed reasons, halving, newest-first order, no old label naming).

**Fire Sale spin credit (owner, 8:47 PM):** from `ACTIVATE_RUGME_BLOCK`, a valid `pet:ad` burn (full = 69 per pet at the era price) and a valid `pet:rug` burn (full = 690 at the era price) that pays at least the full price during a live Fire Sale earns one saved spin, like the other burns (`fireCredit`). Sale-price or rejected burns earn none. Below the gate these tags are unknown and earn nothing (replay SAME).

**Still open for the owner:** 1) gate block at deploy; 2) the bio list wording.
