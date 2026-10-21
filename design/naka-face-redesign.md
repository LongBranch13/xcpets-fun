# Nakamoto face redesign (from the RAREPEPE Nakamoto Card): branch `naka-face-card`

Owner request (voice, Oct 20 2026, 8:08 PM CT): match the card on the **eyes, glasses and mouth** at every stage and keep everything else.
Applies everywhere Nakamoto is drawn: My Pets, Lair, arena, cards, community panel, pet page, HatchBot renders and Cold Storage.
It's a general change for all Nakamotos (species render), with **no per-pet overrides**.
Art only. Replay check is **SAME** vs origin/main at snap-972254 and snap-972262 (overall 626c9446, 15,366 pets).

## What the card actually shows (verified at 4x on design/ref/nakamoto-card.jpg)
- **Glasses:** thin black wire-rim rectangles at eye level, sitting a little low, with a thin bridge. This matches the owner's read.
- **Eyes:** these are **not** all-dark eyes. Each eye has a **white sclera with a small dark pupil** under a heavy lid line, so it reads tired and droopy. The owner's "dark droopy eyes" is right for the pupils and lids, but the eye itself is white. The orange (#f7931a) visor glow isn't on the card.
- **Mouth:** red lips (#CD0000 in findings.md) in a downturned frown with a fuller lower lip. **The card draws two lips** (upper and lower).

## Changes
**Face** (`js/v2-gear.js`, `reworkNakamoto` / `nakaFace`):
1. `NAKA_VR`: eyeWhite `#1c1c22` → `#ecece4` (white sclera), pupil `#f7931a` → `#141018` (near-black).
2. `nakaEyes()`: lenses stay in place and turn white. Each lens gets one dark pupil in its bottom row (droopy), and a heavy lid row (#41621a) goes on lenses that are 2+ rows tall. The thick frame thins to a 1 px wire rim, with the bridge kept. Audit fix: the extra ink between the head outline and the outer rim also becomes skin (the Juvenile 2-3 px side block, 1 px on the Adult).
3. `nakaMouth()`: lips in card red **#CD0000**, downturned, with ink corners drooping below the lip ends. `NAKA_LIPS` = 1 gives a single fuller lip (2 px top over 4 px bottom); 2 gives upper lip / dark line / lower lip. **Pick: 1.** At 32 px the two-lip version reads as an open, boxy mouth (previews/naka-face/lips-one-vs-two.png). The Hatchling's drawn mouth line is reused.

**Mouth detection** (`js/v2-render.js` faceSpots): `LIPRED #cd0000` is matched alongside mouth-pink, so cigarettes and other mouth gear still anchor (one line).

**Audit fixes** (owner-approved, general):
- **Glasses arms, all species:** arms on every glasses-style face piece stop before the head's edge pixel and run at most 3 px. This fixes the Red shades and Gold aviators past the head, and other species' arms are shortened the same way.
- **Monocle, all species:** an eye anchor narrower than 3 px is widened to a 3 px lens centred on the eye, so the ring sits on the eye (Nakamoto Juvenile).
- **Held pieces on Nakamoto's bust body (Hatchling to Adult):** the piece sits one row higher, and its x-fit uses only the bottom 4 rows (grip). The head bob no longer pushes the Black Swan quill off the body in the up frame.

**Cold Storage** (`js/v2-pages.js`): this is the general, display-only rule `COLD_STAGE = 5`. Every Cold Storage entry draws Mythic stage art: Nakamoto bare, and the Wizard in his best-gear loadout. Both existing entries were already at stage 5; they now share the constant. Lord Kek has no Cold Storage entry yet (gated), and any new entry must use COLD_STAGE. The Return and Wizard farewell scenes reuse these frames, so they show the new face (previews/naka-face/scenes-return-farewell.png).

## Stage by stage
| Stage | Eyes | Glasses | Mouth |
|---|---|---|---|
| Egg | unchanged | unchanged | none |
| Hatchling | lid row + white with a dark pupil | 1 px | the ink line becomes a red lip, fuller below |
| Juvenile | white with a centred dark pupil (tapered lens, no lid) | 1 px rim; side block removed | red 2+4 px frown |
| Adult | white-pupil-white | thick top thinned to 1 px; side lighter | red frown |
| Elder / Mythic | lid row + white with a low pupil | top thinned to 1 px | red frown |

## Rules
- The "never draw two lips" rule was **deleted** by the owner (Oct 20). Two lips are allowed, and one was chosen because it reads better.
- The orange-glow "VR glasses" look from Oct 14 is replaced by the card eyes.

## Overlap
- **naka-flag-fix** (flag offset, McDonald's hat, flip) edits js/pet-core.js, js/v2-render.js and js/bonus-gear.js. This branch now also edits **js/v2-render.js** (faceSpots LIPRED, glasses arms, monocle and the Nakamoto held-piece fit in fitAnchors), so expect a possible textual conflict there; the hunks are small and independent. It also edits js/v2-gear.js and js/v2-pages.js. The McDonald's visor previews here use main's placement, so re-check them after that branch lands. Build ids aren't bumped here, so restamp at deploy.
- **Sprite audit (read-only):** the audit's Nakamoto eye, mouth and glasses pixel counts or colour checks will change (lens colours, frame ink, mouth rows).

## Previews
/workspace/xcpets/previews/naka-face/: sheet-card-current-proposed.png, sheet-gear-combos.png, contexts-before.png / contexts-after.png, cold-storage-bare.png, before-after-{plain,shades,beam,mcd,card}.gif, toggle-before-after.gif, lips-one-vs-two.png, audit-fixes-{glasses-block,arms,monocle,quill}.png, scenes-return-farewell.png (the mojibake in the scene text is a harness charset artifact).
