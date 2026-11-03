# motel-1103 (owner pt2722u): "drag is cool but just shows my dying pets. cant sort. ... I want to drag to the animation"

## Why only (dying) hungry pets showed
The old dock took `V2UI.petList(w)` (My Pets' own filters + sort; for this wallet fSort=num) and re-sorted it:
last used pet first, then **hungry before fed**, then **cheapest next meal**; ties kept My Pets' ID order; only 40 tiles drawn.
This wallet: 1,674 living pets, 729 hungry, 581 of them at the cheapest meal (1,035 = young Hatchlings).
So all 40 visible tiles were hungry Hatchlings, led by the 2 neglected (dying) pets with the lowest IDs, and **0 of 40 could breed**
although 1,083 could (diag.js output). Nothing else was wrong: the list was just ordered for feeding, not breeding.

## Now
- Dock = every living pet you own (`V2UI.mine`, not My Pets' filters). Sort chips ⚡ Power (default) · 💎 Rarity · 🆕 Newest · # ID · 🍼 Hungry.
  Filters: ✅ Can breed (on by default: 1,083 of 1,674), stage chips, species picker with counts. Search shows every match (greyed + reason if it can't check in). Choices remembered.
- The Gooby scene is the drop target (glow on hover, grey + reason for a wrong partner, drop refused). Tap pet then tap scene, or the in-scene "🥚 Drop #id here" pill (keyboard). Esc lets go.
- Nest / Rare Room / Bowl boxes removed. Rare Room: Places → 💎 Rare Room. Feeding: 🍼 on My Pets cards, Feed / Feed selected / Feed all, plus "🍼 Feed N selected" in the dock.
- Phone: chip rows scroll sideways instead of wrapping to 4 lines.

## Checks
interact.js (log: interact.log) at 1280 (mouse) and 390 (CDP touch drag): ALL OK. shoot.js makes before/after shots (before = 473f6e1d tree).
Harness only: cemetery event overlays (.ca-ov, from live chain events) are hidden in shots/checks; they covered taps at random.

## Public preview is view-only (fixed in d377c487)
The pinned githack link has no wallet connected, so every pet is "View only: connect the wallet to breed". With ✅ Can breed on by default, the dock showed "0 of 1,674" there. Now the Can breed filter skips view-only and still-loading pages, so everyone shows, greyed with the reason. Checks: viewonly.js / viewonly.log (local, 1280 + 390: 40 tiles, 1,674 pets) and linkcheck.js / linkcheck.log (the real pinned githack URL at 50c2d715: no old boxes, 5 sort + 5 stage chips, species picker, drop pill, 40 tiles, 0 page errors). Connected-wallet checks rerun: interact.js ALL OK.
