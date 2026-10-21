# Nakamoto face redesign (from the RAREPEPE Nakamoto Card): branch `naka-face-card`

Owner request (voice, Oct 20 2026, 8:08 PM CT): match the card on the **eyes, glasses and mouth** at every stage and keep everything else.
Applies everywhere Nakamoto is drawn: My Pets, Lair, arena, cards, community panel, pet page, HatchBot renders and Cold Storage.
It's a general change for all Nakamotos (species render), with **no per-pet overrides**.
Art only. Replay check is **SAME** vs origin/main at snap-972254 and snap-972262 (overall 626c9446, 15,366 pets).

## What the card actually shows (verified at 4x on design/ref/nakamoto-card.jpg)
- **Glasses:** thin black wire-rim rectangles at eye level, sitting a little low, with a thin bridge. This matches the owner's read.
- **Eyes:** these are **not** all-dark eyes. Each eye has a **white sclera with a small dark pupil** under a heavy lid line, so it reads tired and droopy. The owner's "dark droopy eyes" is right for the pupils and lids, but the eye itself is white. The orange (#f7931a) visor glow isn't on the card.
- **Mouth:** red lips (#CD0000 in findings.md) in a downturned frown with a fuller lower lip. **The card draws two lips** (upper and lower).

## Changes (js/v2-gear.js only, in `reworkNakamoto` / `nakaFace`)
1. `NAKA_VR`: eyeWhite `#1c1c22` → `#ecece4` (white sclera), pupil `#f7931a` → `#141018` (near-black, distinct from outline ink). Eye anchors use a separate key render, so Beam eyes, eye gear and shiners still centre on the lenses.
2. `nakaEyes()`: the lens pixels stay where they are and become white. Each lens gets **one** dark pupil in its bottom row (low, so it droops). On lenses 2+ rows tall with a full bottom row, the top row is painted as a **heavy lid** (#41621a dark skin). Frame ink more than 1 px from a lens, inside the head and not on the head outline, becomes skin (#568023). That thins the heavy black frame to a **1 px wire rim**, and the bridge is kept.
3. `nakaMouth()`: there is **one solid red lip shape**, single tone #da3c56. Row my-1 is a 2 px top, row my is a fuller 4 px lower part, and the ink corners **droop** one row below the lip ends. The Hatchling's drawn ink mouth line is recoloured in place, so no second mouth is added. #da3c56 is within faceSpots' match range of #e04060, so cigarettes and mouth gear still anchor.
4. The Egg is untouched. Hair, head, dome, pose, body, aura and gear are unchanged.

## Stage by stage (both bounce frames)
| Stage | Eyes | Glasses | Mouth |
|---|---|---|---|
| Egg | unchanged | unchanged | none |
| Hatchling | 2x2 lens: lid row + white with dark pupil (was orange over dark) | brow/frame row kept (it's 1 px already) | the existing 4 px ink line becomes a red lip, fuller below, ink corners drooping |
| Juvenile | tapered lens: no lid, white with a dark pupil centred in the wide row | rim stays 1 px | the pink 2 px mouth becomes a red 2+4 px frown |
| Adult | 1-row 3 px lens: white-pupil-white (was a solid black visor) | the thick 2-row top frame thins to a 1 px rim | red 2+4 px frown |
| Elder | 2-row lens: lid row + white with a low dark pupil | the top frame row thins to 1 px | red frown |
| Mythic | same as Elder | same as Elder | red frown |

## Rule conflicts
- **"Never draw two lips" vs the card:** the card shows two lips. I kept the rule, so the mouth is one solid red shape with no line between lips. The fuller lower lip is done by width (2 px over 4 px) rather than a second lip.
- **Lip colour:** card red #CD0000 would stop faceSpots finding the mouth (it keys on #e04060 ±24), and mouth gear would fall back to other anchors. I used #da3c56. Getting true #CD0000 needs a one-line faceSpots change in js/v2-render.js, which overlaps with naka-flag-fix.
- **Orange pupils** were the "VR glasses" idea from Oct 14. The card overrides it, as the owner asked.
- **Cold Storage:** he's bare, with no gear, no card and no crowns. The legendary tier aura still shows because it's a tier frame, not gear.

## Overlap
- **naka-flag-fix** (flag offset, McDonald's hat, flip) edits js/pet-core.js, js/v2-render.js and js/bonus-gear.js. This branch edits **only js/v2-gear.js**, so a merge shouldn't conflict on code. The McDonald's visor previews here use main's placement, so re-check them after that branch lands. Build ids aren't bumped here, so restamp at deploy.
- **Sprite audit (read-only):** the audit's Nakamoto eye, mouth and glasses pixel counts or colour checks will change (lens colours, frame ink, mouth rows).

## Previews
/workspace/xcpets/previews/naka-face/: sheet-card-current-proposed.png, sheet-gear-combos.png, contexts-before.png / contexts-after.png, cold-storage-bare.png, before-after-{plain,shades,beam,mcd,card}.gif, toggle-before-after.gif.
