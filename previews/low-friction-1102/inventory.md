# low-friction-1102: before/after inventory (owner: "we can't lose any functionality")

Tables A-E generated Mon Nov 02 2026 19:16 CST from the real pages (view-only address bc1qs88…y0j6n, 1687 pets), both widths (1280 and 390), and from the source.
Every dropdown became `<xc-select>`, which keeps the same id, name, options, values, order, default, `value`/`selectedIndex`/`options` API and `input`+`change` events.
The game code that reads these pickers is unchanged, so every filter, sort, setting and action does exactly what it did before.
How it looks now: **chips** (up to 6 short choices; Tab in, arrow keys move and pick, Home/End) or a **sheet** (a button that opens a list; search box when there are more than 8 choices, arrow keys + Enter, Esc closes, Tab stays inside, pet lists show thumbnails, 150 rows then "Show N more"; slides up from the bottom on phones, centered on desktop).

Machine check: the before and after option lists (ids, option counts, every value=label, order) are identical on all 16 page×width captures. Only difference: the phone now opens My Pets in the swipe view by default, so play@390 shows one more picker (ivPet, the swipe view's own pet picker), which is an addition. See before-runtime-inventory.json / after-runtime-inventory.json.

**Updated Tue Nov 03 2026 (CST), after merging main a6d77f4696 (main d64b847d) into the branch (merge 9f4e83a1, no rebase).** Pass 2 rechecked every page on both trees at 1280 and 390 after the merge (pass2/NOTES.md): the same pets come up for all 1,023 (1280) and 1,053 (390) picker steps, and no new page errors. The 14 tests that failed earlier (timeouts and out-of-memory under --jobs 4) all pass when run again with --only, and the replay is SAME 3 times (tests-rerun-only.log). Preview only: nothing here is deployed or merged to main.

## Checklist: where each old feature lives now (plain language)

Rule of thumb: **nothing moved off its page and nothing was removed.** Every old dropdown is in the same spot with the same choices. It now shows as a row of buttons ("chips") when there are 6 or fewer short choices, or as a button that opens a list ("sheet") with a search box when there are more.

**My Pets (play page and the top of every game page)**
- [x] Sort pets: same place, same 20 sorts (Most urgent, Newest, Rarest, Score …). Now a sheet.
- [x] Species / rarity / origin / "hide" filters: same place, same choices. Now chips or a sheet.
- [x] "Never fed only" and the zombie filters (All zombies, Hungry, Feral, Crumbling soon): unchanged.
- [x] Card checkboxes, Select all/none, shift-click range, Feed selected, Discard selected (with its confirm and Undo): unchanged.
- [x] Grid vs one-at-a-time toggle: same button (#mptView). **Change:** on a phone, My Pets now *opens* one at a time (swipe ◀ ▶, with Feed / Fight / Breed / Details & gear buttons). One tap on "▦ Grid" brings the grid back and is remembered. Desktop still opens the grid.
- [x] New on each card: 💞 (opens Gooby's with this pet as first guest), 🍼 (feed it, same burn confirm), 🧹 (the same account-wide daily chores button).

**Breeding (Gooby's No-Tail Motel, breed page)**
- [x] Parent A and partner B pickers, their sort (the same list of sorts) and species/stage/rarity filters: same place, same choices. Now sheets/chips with pet pictures.
- [x] "Check in" button, price and the burn confirm: unchanged.
- [x] Who may breed with whom (Gods only with Gods, kin, already parent A, owner only): unchanged rules. They are now also shown as greyed targets with the reason.
- [x] New: a dock under the motel scene with your pets. Drag a pet (or tap it, then tap) onto 🥚 Nest, 💎 Rare Room or 🍼 Bowl. Checked in the screenshots: drag fills parent A, a wrong partner greys out the Nest with the same reason the picker gives ("That's its kid"), and Bowl opens the normal feed confirm.
- [x] **Change:** the breed page fills parent A with the last pet you used, if it is still allowed and the link did not name a pet. Clearing it works like any other choice.

**Rare Room**
- [x] Pet picker, sort and filters: same place, same choices (now a sheet).
- [x] Pepe Wheel link, community feed amounts, check-in and raid buttons: identical on both trees (checked back to back).
- [x] New: drag or tap a pet onto 💎 Rare Room in the dock.

**Raid, Fight, Gear and pet page**
- [x] Raid page controls and buttons: the same. Two differences in one run were live-data timing and came back identical when checked again.
- [x] Fight page pickers and challenge buttons: same controls at both widths.
- [x] Gear (pet page): the Gear, Burn history, Born traits and Family tree sections are unchanged. The before and after screenshots look the same.
- [x] Look shop ("Pick a pet for Laurels / Halo / …"): same place, all pets listed, now a sheet with thumbnails.

**Cemetery**
- [x] Sort, species, stage, rarity, days dead, difficulty and meals filters: same place, same choices (chips or sheets).
- [x] Seance "pick a pet" boxes: same place. They fill with your pets when your wallet is connected.

**Shop (Spam City), Tokens, Inscriptions, Gifts, Rug Me, Sales**
- [x] Shop filters (badge, buyable, currency, gear, sort, species, stage, tier): same place, same choices.
- [x] Tokens species/rarity filters, inscription frame/stamp/pet, gift pet, Rug Me pickers, sales asset picker: same place, same choices.

**Home page and every other page**
- [x] Page background picker: same place, same 5 choices, now chips.
- [x] Menus, Places, Simple menu, Ranking, Tutorial: untouched.

**Safety screens**
- [x] Every confirm screen is still there (0 removed, list in section C). Every burn still goes through the same burn confirm and wallet check.

**Not changed at all:** game rules, burn formats, prices, the api feed and replays. The rule files are byte-identical to main and the replay came out SAME 3 times.

## A. Dropdowns seen on the pages (runtime)

| ☑ | Picker | Pages (page@width) | Options | Kept? | Lives now |
|---|---|---|---|---|---|
| ✅ | `aria-label=Sort` | play@1280, breed@1280, rare-room@1280, fight@1280, play@390, breed@390, rare-room@390, fight@390 | newest=🆕 Newest; score=⭐ Pet Score; power=⚡ Power; vigor=💪 Most Vigor; spark=✨ Most Spark; grit=🪨 Most Grit; zoom=💨 Most Zoom; luck=🍀 Most Luck; wins=🏆 Most wins; gear=🎽 Most gear; name=🔤 Name A-Z | kept, same options | same place, same attribute; sheet |
| ✅ | `aria-label=Species` | play@1280, breed@1280, rare-room@1280, fight@1280, play@390, breed@390, rare-room@390, fight@390 | =All species; dodo=Dodo; lenny=Lenny; mumu=Mumu; nakamoto=Nakamoto; pepe=Pepe; snibby=Snibby | kept, same options | same place, same attribute; sheet |
| ✅ | `bgPick` | play@1280, breed@1280, rare-room@1280, cemetery@1280, pet@1280, tokens@1280, fight@1280, play@390, breed@390, rare-room@390, cemetery@390, pet@390, tokens@390, fight@390 | pets=Pets; btc=Bitcoin ₿; xcp=XCP; mix=Mix; rotate=Rotate each visit | kept, same options | same place, same id; chips |
| ✅ | `cemDays` | cemetery@1280, cemetery@390 | =Any time; 0-1=0 to 1 days; 2-7=2 to 7 days; 8-30=8 to 30 days; 31-=Over 30 days | kept, same options | same place, same id; chips |
| ✅ | `cemDiff` | cemetery@1280, cemetery@390 | =Any; easy=Easy (Common+ offering); medium=Medium (Uncommon+); hard=Hard (Rare+); closed=Closed graves | kept, same options | same place, same id; sheet |
| ✅ | `cemMeals` | cemetery@1280, cemetery@390 | =All graves; fed=Fed at least once; nf=Never fed | kept, same options | same place, same id; chips |
| ✅ | `cemSort` | cemetery@1280, cemetery@390 | rarest=Rarest first; newest=Newest graves; oldest=Longest dead; easiest=Easiest to raise; strongest=Strongest at death; gear=Most gear; lived=Longest lived; id=Pet number | kept, same options | same place, same id; sheet |
| ✅ | `cemSp` | cemetery@1280, cemetery@390 | =All species; bobo=Bobo (3,801); chud=Chud (5,092); dodo=Dodo (441); doge=Doge (3,661); kevin=KEVIN (970); lenny=Lenny (1,923); kek=Lord Kek (1); mumu=Mumu (3,905); peepo=Peepo (3,629); pepe=Pepe (7,803); sarutobi=Sarutobi (1,932); snibby=Snibby (1,802); wojak=Wojak (7,891); __hyb=Hybrids (1) | kept, same options | same place, same id; sheet |
| ✅ | `cemStage` | cemetery@1280, cemetery@390 | =All stages; 0=Egg; 1=Hatchling; 2=Juvenile; 3=Adult; 4=Elder | kept, same options | same place, same id; chips |
| ✅ | `cemTier` | cemetery@1280, cemetery@390 | =All rarities; 0=Common; 1=Uncommon; 2=Rare; 3=Legendary | kept, same options | same place, same id; chips |
| ✅ | `data-hpick=35040` | cemetery@1280, cemetery@390 | (empty in view-only; filled with your pets by the same code when connected) | kept, same options | same place, same attribute; sheet with thumbnails once it lists pets |
| ✅ | `data-hpick=35311` | cemetery@1280, cemetery@390 | (empty in view-only; filled with your pets by the same code when connected) | kept, same options | same place, same attribute; sheet with thumbnails once it lists pets |
| ✅ | `data-hpick=36808` | cemetery@1280, cemetery@390 | (empty in view-only; filled with your pets by the same code when connected) | kept, same options | same place, same attribute; sheet with thumbnails once it lists pets |
| ✅ | `data-hpick=37789` | cemetery@1280, cemetery@390 | (empty in view-only; filled with your pets by the same code when connected) | kept, same options | same place, same attribute; sheet with thumbnails once it lists pets |
| ✅ | `data-hpick=8457` | cemetery@1280, cemetery@390 | (empty in view-only; filled with your pets by the same code when connected) | kept, same options | same place, same attribute; sheet with thumbnails once it lists pets |
| ✅ | `data-mvs=0 aria-label=Pick a pet for Laurels` | play@1280, play@390 | pet list (300 pets, every pet kept, with thumbnails) | kept, same options | same place, same attribute; sheet |
| ✅ | `data-mvs=1 aria-label=Pick a pet for Flame aura` | play@1280, play@390 | pet list (300 pets, every pet kept, with thumbnails) | kept, same options | same place, same attribute; sheet |
| ✅ | `data-mvs=2 aria-label=Pick a pet for Halo` | play@1280, play@390 | pet list (300 pets, every pet kept, with thumbnails) | kept, same options | same place, same attribute; sheet |
| ✅ | `data-mvs=3 aria-label=Pick a pet for Rainbow holo` | play@1280, play@390 | pet list (300 pets, every pet kept, with thumbnails) | kept, same options | same place, same attribute; sheet |
| ✅ | `data-mvs=4 aria-label=Pick a pet for Lightning aura` | play@1280, play@390 | pet list (300 pets, every pet kept, with thumbnails) | kept, same options | same place, same attribute; sheet |
| ✅ | `data-mvs=5 aria-label=Pick a pet for Gold-foil crown` | play@1280, play@390 | pet list (300 pets, every pet kept, with thumbnails) | kept, same options | same place, same attribute; sheet |
| ✅ | `data-mvs=6 aria-label=Pick a pet for Holo wings` | play@1280, play@390 | pet list (300 pets, every pet kept, with thumbnails) | kept, same options | same place, same attribute; sheet |
| ✅ | `data-mvs=7 aria-label=Pick a pet for Galaxy skin` | play@1280, play@390 | pet list (300 pets, every pet kept, with thumbnails) | kept, same options | same place, same attribute; sheet |
| ✅ | `data-mvs=8 aria-label=Pick a pet for Holo foil` | play@1280, play@390 | pet list (300 pets, every pet kept, with thumbnails) | kept, same options | same place, same attribute; sheet |
| ✅ | `data-mvs=9 aria-label=Pick a pet for Flame aura` | play@1280, play@390 | pet list (300 pets, every pet kept, with thumbnails) | kept, same options | same place, same attribute; sheet |
| ✅ | `data-pf=badge` | shop@1280, shop@390 | =Any; om=Old Money 💰 only; hyb=Hybrids only | kept, same options | same place, same attribute; chips |
| ✅ | `data-pf=buy` | shop@1280, shop@390 | =Any; 1=Buyable now (fills first) | kept, same options | same place, same attribute; chips |
| ✅ | `data-pf=cur` | shop@1280, shop@390 | =Both; XCPETS=XCPETS; XCP=XCP | kept, same options | same place, same attribute; chips |
| ✅ | `data-pf=gear` | shop@1280, shop@390 | =Any; 1=Wears gear | kept, same options | same place, same attribute; chips |
| ✅ | `data-pf=sort` | shop@1280, shop@390 | =Default; cost=Cost: low first; -cost=Cost: high first; power=Power; new=Newest; rarity=Rarity | kept, same options | same place, same attribute; chips |
| ✅ | `data-pf=sp` | shop@1280, shop@390 | =All | kept, same options | same place, same attribute; chips |
| ✅ | `data-pf=st` | shop@1280, shop@390 | =All; 0=Egg; 1=Hatchling; 2=Juvenile; 3=Adult; 4=Elder; 5=Mythic | kept, same options | same place, same attribute; sheet |
| ✅ | `data-pf=tier` | shop@1280, shop@390 | =All; 0=Common; 1=Uncommon; 2=Rare; 3=Legendary; M=Mythic; G=Gods | kept, same options | same place, same attribute; sheet |
| ✅ | `ezBsA` | play@1280, breed@1280, rare-room@1280, fight@1280, play@390, breed@390, rare-room@390, fight@390 | =Hatch order; pow=⚡ Power: high to low; pow-=⚡ Power: low to high; gain=⚡ Power to gain: most first; gain-=⚡ Power to gain: least first; vigor=📊 Vigor: high to low; vigor-=📊 Vigor: low to high; spark=📊 Spark: high to low; spark-=📊 Spark: low to high; grit=📊 Grit: high to low; grit-=📊 Grit: low to high; zoom=📊 Zoom: high to low; zoom-=📊 Zoom: low to high; luck=📊 Luck: high to low; luck-=📊 Luck: low to high; sc=⭐ Pet Score: high to low; sc-=⭐ Pet Score: low to high; rar=💎 Rarity: high to low; rar-=💎 Rarity: low to high; stage=🌱 Stage: Mythic first; stage-=🌱 Stage: youngest stage first; sp=🧬 Species: A to Z; sp-=🧬 Species: Z to A; age=🎂 Age: oldest first; age-=🎂 Age: youngest first; gen=🌳 Generation: high to low; gen-=🌳 Generation: low to high; bl=💞 Breeds left: most first; bl-=💞 Breeds left: least first; wins=🏆 Fight wins: most first; wins-=🏆 Fight wins: least first; wr=🏆 Win rate: high to low; wr-=🏆 Win rate: low to high; care=🔥 XCPETS fed: most first; care-=🔥 XCPETS fed: least first; gear=🛡️ Gear worn: most first; gear-=🛡️ Gear worn: least first; slots=🛡️ Free gear slots: most first; slots-=🛡️ Free gear slots: least first; looks=✨ Looks: most first | kept, same options | same place, same id; sheet |
| ✅ | `ezBsB` | play@1280, breed@1280, rare-room@1280, fight@1280, play@390, breed@390, rare-room@390, fight@390 | =Hatch order; pow=⚡ Power: high to low; pow-=⚡ Power: low to high; gain=⚡ Power to gain: most first; gain-=⚡ Power to gain: least first; vigor=📊 Vigor: high to low; vigor-=📊 Vigor: low to high; spark=📊 Spark: high to low; spark-=📊 Spark: low to high; grit=📊 Grit: high to low; grit-=📊 Grit: low to high; zoom=📊 Zoom: high to low; zoom-=📊 Zoom: low to high; luck=📊 Luck: high to low; luck-=📊 Luck: low to high; sc=⭐ Pet Score: high to low; sc-=⭐ Pet Score: low to high; rar=💎 Rarity: high to low; rar-=💎 Rarity: low to high; stage=🌱 Stage: Mythic first; stage-=🌱 Stage: youngest stage first; sp=🧬 Species: A to Z; sp-=🧬 Species: Z to A; age=🎂 Age: oldest first; age-=🎂 Age: youngest first; gen=🌳 Generation: high to low; gen-=🌳 Generation: low to high; bl=💞 Breeds left: most first; bl-=💞 Breeds left: least first; wins=🏆 Fight wins: most first; wins-=🏆 Fight wins: least first; wr=🏆 Win rate: high to low; wr-=🏆 Win rate: low to high; care=🔥 XCPETS fed: most first; care-=🔥 XCPETS fed: least first; gear=🛡️ Gear worn: most first; gear-=🛡️ Gear worn: least first; slots=🛡️ Free gear slots: most first; slots-=🛡️ Free gear slots: least first; looks=✨ Looks: most first | kept, same options | same place, same id; sheet |
| ✅ | `ezFrar` | play@1280, breed@1280, rare-room@1280, fight@1280, play@390, breed@390, rare-room@390, fight@390 | =All rarities; 0=Common; 1=Uncommon; 2=Rare; 3=Legendary | kept, same options | same place, same id; chips |
| ✅ | `ezFsp` | play@1280, breed@1280, rare-room@1280, fight@1280, play@390, breed@390, rare-room@390, fight@390 | =All species; wizard=Bitcoin Wizard; bojackson=Bo Jackson; bobo=Bobo; hyb:bobo:nakamoto=Bomoto (hybrid); hyb:bobo:mumu=Bomu (hybrid); hyb:bobo:pepe=Bope (hybrid); hyb:bobo:snibby=Bosnib (hybrid); hyb:bobo:funtrump=Botrump (hybrid); hyb:chud:bobo=Chubo (hybrid); chud=Chud; hyb:chud:mumu=Chumu (hybrid); hyb:chud:peepo=Chupo (hybrid); hyb:dodo:sarutobi=Dobi (hybrid); hyb:dodo:bobo=Dobo (hybrid); dodo=Dodo; hyb:dodo:doge=Dodog (hybrid); hyb:doge:chud=Dogchud (hybrid); doge=Doge; hyb:doge:wojak=Dogjak (hybrid); hyb:doge:snibby=Dogsnib (hybrid); hyb:doge:sarutobi=Dogtobi (hybrid); hyb:doge:kevin=Dogvin (hybrid); hyb:dodo:kek=Dokek (hybrid); hyb:dodo:peepo=Dopeep (hybrid); hyb:dodo:pepe=Dopep (hybrid); hyb:dodo:nakamoto=Doto (hybrid); hyb:dodo:kevin=Dovin (hybrid); funtrump=FUNTRUMP; kevin=KEVIN; hyb:kevin:doge=Kege (hybrid); hyb:kek:dodo=Kekdo (hybrid); hyb:kek:nakamoto=Kekmoto (hybrid); hyb:kevin:lenny=Kelen (hybrid); hyb3:kevin:lenny:dodo=Kelendo (hybrid); hyb:kevin:peepo=Kepo (hybrid); hyb:lenny:snibby=Lebby (hybrid); hyb:lenny:chud=Lechud (hybrid); hyb:lenny:dodo=Ledo (hybrid); lenny=Lenny | kept, same options | same place, same id; sheet |
| ✅ | `ezFst` | play@1280, breed@1280, rare-room@1280, fight@1280, play@390, breed@390, rare-room@390, fight@390 | =All stages; 1=Hatchling; 2=Juvenile; 3=Adult; 4=Elder; 5=Mythic | kept, same options | same place, same id; chips |
| ✅ | `fHide` | play@1280, breed@1280, rare-room@1280, fight@1280, play@390, breed@390, rare-room@390, fight@390 | -1=(show all) | kept, same options | same place, same id; chips |
| ✅ | `fMin` | play@1280, breed@1280, rare-room@1280, fight@1280, play@390, breed@390, rare-room@390, fight@390 | 0=All rarities; 1=Uncommon+; 2=Rare+; 3=Legendary only | kept, same options | same place, same id; chips |
| ✅ | `fMine` | play@1280, breed@1280, rare-room@1280, fight@1280, play@390, breed@390, rare-room@390, fight@390 | pet list (1161 pets, every pet kept, with thumbnails) | kept, same options | same place, same id; sheet |
| ✅ | `fOrigin` | play@1280, breed@1280, rare-room@1280, fight@1280, play@390, breed@390, rare-room@390, fight@390 | all=All; hatched=🥚 Hatched; bred=👪 Bred; hybrid=🧬 Hybrid | kept, same options | same place, same id; chips |
| ✅ | `fSort` | play@1280, breed@1280, rare-room@1280, fight@1280, play@390, breed@390, rare-room@390, fight@390 | urgent=🪦 Most urgent; sel=☑️ Selected first; starred=★ Starred first; num=#️⃣ Pet # (low to high); new=🆕 Newest first; old=🦴 Oldest first; name=🔤 Name A-Z; species=🐾 Species; ztime=🧟 Zombie time left; tier=💎 Rarest; score=⭐ Score; power=⚡ Total stats; stage=🌱 Biggest stage; wins=🏆 Most wins; gear=🎽 Most gear; vigor=💪 Vigor; spark=✨ Spark; grit=🪨 Grit; zoom=💨 Zoom; luck=🍀 Luck | kept, same options | same place, same id; sheet |
| ✅ | `fSpecies` | play@1280, breed@1280, rare-room@1280, fight@1280, play@390, breed@390, rare-room@390, fight@390 | all=All (1,687); wizard=Bitcoin Wizard (1); bobo=Bobo (165); chud=Chud (144); dodo=Dodo (77); doge=Doge (99); kevin=Kevin (108); lenny=Lenny (90); kek=Lord Kek (2); mumu=Mumu (189); nakamoto=Nakamoto (2); peepo=Peepo (107); pepe=Pepe (214); sarutobi=Sarutobi (105); snibby=Snibby (178); wojak=Wojak (181); hybrid=Hybrids (25) | kept, same options | same place, same id; sheet |
| ✅ | `fTheirs` | play@1280, breed@1280, rare-room@1280, fight@1280, play@390, breed@390, rare-room@390, fight@390 | pet list (710 pets, every pet kept, with thumbnails) | kept, same options | same place, same id; sheet |
| ✅ | `fTier` | play@1280, breed@1280, rare-room@1280, fight@1280, play@390, breed@390, rare-room@390, fight@390 | all=All; common=Common; uncommon=Uncommon; rare=Rare; legendary=Legendary | kept, same options | same place, same id; chips |
| ✅ | `ivPet` | breed@390, rare-room@390, fight@390 | pet list (302 pets, every pet kept, with thumbnails) | kept, same options | same place, same id; sheet |
| ✅ | `tgRarity` | tokens@1280, tokens@390 | =All; Common=Common; Uncommon=Uncommon; Rare=Rare; Legendary=Legendary | kept, same options | same place, same id; chips |
| ✅ | `tgSpecies` | tokens@1280, tokens@390 | =All; Bitcoin Wizard=Bitcoin Wizard; Bo Jackson=Bo Jackson; Bobo=Bobo; Chubo (hybrid)=Chubo (hybrid); Chud=Chud; Dodo=Dodo; Doge=Doge; Dogsnib (hybrid)=Dogsnib (hybrid); FUNTRUMP=FUNTRUMP; KEVIN=KEVIN; Kekmoto (hybrid)=Kekmoto (hybrid); Lenny=Lenny; Lepe (hybrid)=Lepe (hybrid); Lord Kek=Lord Kek; Mumu=Mumu; Nakamoto=Nakamoto; Nawiz (hybrid)=Nawiz (hybrid); Peepo=Peepo; Pepe=Pepe; Rarepigeon=Rarepigeon; Sadoge (hybrid)=Sadoge (hybrid); Sarutobi=Sarutobi; Snibby=Snibby; Trukekamoto (hybrid)=Trukekamoto (hybrid); Viking=Viking; Wikek (hybrid)=Wikek (hybrid); Wojak=Wojak; Wope (hybrid)=Wope (hybrid) | kept, same options | same place, same id; sheet |

Added after (not removed): play@390 ivPet (302 options, sheet)

## B. Every dropdown in the source (includes ones that only open in pop-ups, modals or other states)

The 5 game pages and 5 practice pages are generated from templates/game.html and are covered by that row. Each one keeps its id and the code that fills it.

| ☑ | File:line | Picker | Kept? | Lives now |
|---|---|---|---|---|
| ✅ | archive.html:13 | `#bgPick` “Page background” | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | cemetery.html:21 | `#bgPick` “Page background” | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | hall-of-fame.html:20 | `#bgPick` “Page background” | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | how-it-works.html:33 | `#bgPick` “Page background” | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | hybrids.html:21 | `#bgPick` “Page background” | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | index.html:105 | `#bgPick` “Page background” | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | inscriptions.html:16 | `#inscPet` | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | inscriptions.html:22 | `#bgPick` “Page background” | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | js/ux-batch.js:252 | `#ivPet` | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | js/ux-batch.js:290 | `#popPet` | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | js/ux-batch.js:357 | `#fpS` “Sort” | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | js/ux-batch.js:364 | `#fpSp` “Species” | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | js/v2-cemetery-scene.js:185 | `#cemSort` | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | js/v2-cemetery-scene.js:186 | `#cemTier` | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | js/v2-cemetery-scene.js:187 | `#cemStage` | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | js/v2-cemetery-scene.js:188 | `#cemDays` | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | js/v2-cemetery-scene.js:189 | `#cemDiff` | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | js/v2-cemetery-scene.js:190 | `#cemSp` | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | js/v2-cemetery-scene.js:191 | `#cemMeals` | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | js/v2-cemetery-scene.js:219 | `[data-hpick]` | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | js/v2-easy-flows.js:28 | `(built in code)` “Sort ” | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | js/v2-easy-flows.js:36 | `(built in code)` | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | js/v2-easy-flows.js:53 | `#ezFsp` “Species” | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | js/v2-easy-flows.js:54 | `#ezFst` “Stage” | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | js/v2-easy-flows.js:55 | `#ezFrar` “Rarity” | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | js/v2-gift.js:133 | `#gfMine` | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | js/v2-inscribe-ui.js:81 | `#inscFrame` | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | js/v2-inscribe-ui.js:82 | `#inscStamp` | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | js/v2-look-picker.js:81 | `[data-mvs]` “Pick a pet for ” | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | js/v2-pet-filter.js:11 | `[data-pf]` | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | js/v2-picker.js:33 | `(built in code)` “Species” | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | js/v2-picker.js:34 | `(built in code)` “Sort” | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | js/v2-rugme.js:85 | `#rmAs` | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | js/v2-rugme.js:124 | `#rmEdit` | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | js/v2-sales.js:446 | `#shAsset` | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | js/v2.js:71 | `(built in code)` | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | js/v2.js:72 | `(built in code)` | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | js/v2.js:494 | `#pkSp` “Show only one species” | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | js/v2.js:504 | `#pkSort` “Sort the pets” | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | js/v2.js:753 | `[data-ds]` | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | js/v2.js:754 | `[data-ds]` | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | js/v2.js:755 | `[data-ds]` | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | js/v2.js:823 | `[data-o]` | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | live.html:38 | `#bgPick` “Page background” | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | pantheon.html:17 | `#bgPick` “Page background” | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | pet.html:12 | `#bgPick` “Page background” | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | pets.html:24 | `#bgPick` “Page background” | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | ranking.html:20 | `#bgPick` “Page background” | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | rules-short.html:66 | `#bgPick` “Page background” | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | rules.html:123 | `#bgPick` “Page background” | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | templates/game.html:54 | `#fSort` “Sort pets” | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | templates/game.html:71 | `#fMine` | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | templates/game.html:103 | `#bgPick` “Page background” | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | tokens.html:19 | `#tgSpecies` | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | tokens.html:20 | `#tgRarity` | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | tokens.html:27 | `#bgPick` “Page background” | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | tutorial.html:3 | `#bgPick` “Page background” | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | verify-pet.html:75 | `#bgPick` “Page background” | kept, same options | same place; chips if ≤6 short choices, else sheet |
| ✅ | watch.html:87 | `#bgPick` “Page background” | kept, same options | same place; chips if ≤6 short choices, else sheet |

## C. Confirm screens

| ☑ | Confirm | Where (file) | What it guards | Kept? | Lives now |
|---|---|---|---|---|---|
| ✅ | The single burn confirm (#confirmBox, from confirmPlans) and the wallet freshness gate (V2Wallet whenFresh / S.verified) | js/v2.js, js/v2-wallet*.js | every burn (feed, breed, chores, fights, Rare Room, shop, raids…) | kept, untouched | same place; nothing in this branch reaches a burn without it |
| ✅ | "Start practice over?" | js/practice-ui.js:16 | wipes practice pets | kept | same |
| ✅ | "This gives away a Mythic pet of yours. Accept the swap?" | js/v2-gift.js:162 | gives a pet away | kept | same |
| ✅ | "Close? If the commit was already signed…" | js/v2-inscribe-ui.js:60 | leaving a half-done inscription | kept | same |
| ✅ | "Refund … The inscription will NOT happen." | js/v2-inscribe-ui.js:155 | money refund | kept | same |
| ✅ | "Discard pet #N?" | js/v2-petdiscard.js:23 | removes a pet from My Pets | kept | same |
| ✅ | "Discard N selected pets?" | js/v2-petdiscard.js:38 | removes many pets | kept | same |
| ✅ | "Your wallet is connected… View ADDRESS instead?" | js/v2-view.js:80 | switches the account shown | kept | same |
| ✅ | "Hide N pets…" (to the Discard pile) | js/v2.js:437 | hides many pets | kept | same |
| ✅ | "Select #N to hide? It is …" (dudGuard) | js/v2.js:450 | hiding a valuable pet | kept | same |
| ✅ | "Restore N pets from the Discard pile to My Pets?" | js/v2.js (discard pile) | restoring many pets at once (undoing it means discarding them again one by one or by selection) | kept | same. I removed it in an earlier draft and put it back: it guards something, so under the owner's rule it stays |

Result: **0 confirm screens removed.** Every one that exists guards something irreversible, a money or burn step, or a large change with no one-click undo.

## D. Actions and new shortcuts (all additions; nothing old was moved or removed)

| ☑ | Action | Old way (still there) | New shortcut | Tap/click/keyboard equivalent of the drag |
|---|---|---|---|---|
| ✅ | Breed a pet | Breed panel: pick parent A then partner B, Breed | Drag the pet onto 🥚 Nest in the dock under the Gooby scene (fills A, then B) · 💞 on its My Pets card | Tap/click/Enter the pet tile, then tap/click/Enter 🥚 Nest |
| ✅ | Open the Rare Room for a pet | Rare Room page, pick the pet | Drag onto 💎 Rare Room · from the dock | Tap the pet, then 💎 |
| ✅ | Feed a pet | Feed button on the pet / feed panel (same burn confirm) | Drag onto 🍼 Bowl · 🍼 on its card | Tap the pet, then 🍼 Bowl |
| ✅ | Feed selected (batch) | Existing "Feed selected" (#bFeedSel) | 🍼 Feed N selected button in the dock (clicks the same button) | it is a button |
| ✅ | Daily chores | Chores button (#dcBtn, one account-wide burn) | 🧹 on every card (clicks the same button) | it is a button |
| ✅ | Rules on targets | Gods only with Gods, kin rules, already parent A, owner only, view only, not hungry | Invalid targets turn grey with the reason on hover/focus and in a toast | same reasons show for tap and keyboard |
| ✅ | Find a pet in the dock | — | Search box (#, name, species); last used pet first, then hungry pets with the cheapest next meal; "+N more" | keyboard: Tab to the box |
| ✅ | Move between pets on a phone | My Pets grid/one-at-a-time toggle | Phones open in the swipe (one-at-a-time) view unless you already picked a view | the view toggle is unchanged, so desktop and keyboard keep the grid |
| ✅ | Last pet used | — | Breed page starts with the last pet you used in slot A if it is still valid and the link did not name one | clear it like any choice |

## E. Not built, and why
- Batch breed: one pair per burn under the current rules, so there is no batch to show.
- Per-pet or batch chores: chores are one account-wide burn, so 🧹 runs that same burn.
- Auto-picking the "cheapest" partner: every breed costs the same (135), so there is no cheaper partner to choose. The default is the last pet used; the dock lists hungry pets by cheapest meal.
- Removing confirm screens: none of them guard nothing (section C).
