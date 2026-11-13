# Gear fit audit

Phase 1 only. Nothing in the game rules, the sprite maps, or `js/v2-rules.js` was changed. MD5 of `js/v2-rules.js` is still `8e98664087bab2e991680ebdb80ba143`. Replay output is unchanged because no rule or sprite file changed. Zombie art was not touched.

Sheets are the live `V2Render.framesWith` path (the same draw the site uses), frame 0, stages Hatchling through Mythic. Sprites are 32×32, scaled 4× with nearest-neighbor. A red edge is a misfit. `OK` means that cell was not flagged.

Codes: `LOW` too low, `HIGH` too high, `BIG` too wide, `SML` too small, `CLIP` cut by the frame, `FLOAT` not touching the body, `NECK` a head piece drawn on the neck, `MISS` the piece does not draw, `FACE` a held piece buried in the face.

## What was rendered

One sheet per slot family, every sprite base, all five growth stages. Anchor boxes (head top, eye row, body box) move at every stage for every species except two pairs, which are still shown so the columns stay aligned:

- Bo Jackson: Adult and Elder share one anchor box.
- Old Hickory Pepe: Elder and Mythic share one anchor box.

Peepo-bodied hybrids keep `art.species === 'peepo'`, so overlay gear is measured on Peepo's anchors. Two samples are on the roster sheets: Peepo body + Bobo ears, and Peepo body + Wojak eyes. On both, the gold nose ring is `HIGH` and the pink band is `NECK`, the same misses as plain Peepo. The hat uses that same anchor. The hybrid eye box is noisy because of the corner badge, so those hat cells are left `OK` rather than scored `LOW`. Phase 2 should look at them again with the plain Peepo fix.

`peepo-headgear.png` and `peepo-face.png` repeat every Peepo head piece and every nose-ring style.

## Peepo (the report that started this)

Adult Peepo, bare sprite: nostril dots are the dark-green `#2d5b18` pair on row 18. The mouth starts at row 21. The gold hoop is drawn on rows 15–17, so the whole ring sits above the holes. Same gap at every stage.

| Piece | Slot | Stages | What is wrong |
| --- | --- | --- | --- |
| Gold nose ring (v2) | face | 1–5 | `HIGH`. Hoop is above the nostril dots, not through them. |
| Septum chain | face | 1–5 | `HIGH`. Same, larger hoop. |
| Gold nose ring (Mumu) | face | 1–5 | `HIGH`. |
| Silver septum ring | face | 1–5 | `HIGH`. |
| Diamond nose stud | face | 1–5 | `MISS`. Two pixels, it does not read as a stud. |
| Confetti party hat | head | 1, 3 | `LOW`. Brim crosses the eye domes. Juvenile, Elder, and Mythic clear the whites. |
| Binoculars hat | head | 1, 3 | `LOW`. Same dome overlap. |
| Party hat | head | 4–5 | `CLIP`. Tip hits the top of the frame once the head is tall. Hatchling–Adult sit higher than the confetti hat. |
| Pepe Cash pimp hat | head | 5 | `CLIP`. Tip hits the top of the frame at Mythic. |
| Tin crown | head | adult (and the stages the sheet marks) | `LOW`. Band crosses the eye domes. Wider than the face under the eyes. |
| Pink happy band | head | 1–5 | `NECK`. Peepo is a no-headband body, so the red-headband footprint this band copies is the scarf row under the mouth. Hatchling also `CLIP`s a tail under the body. |
| Blush cheeks, Peeking big eyes | face | 1–5 | Fit. They sit on the cheeks and the eyes. |

Hats are not wider than the eye-dome silhouette (confetti brim is about 10px on an 18px dome). They read slightly large because they are sized to the domes and sit on them, not on the smaller face underneath. Phase 2 should raise Peepo headgear and shrink it a little, on a Peepo-only anchor, and drop the nose rings onto row 18.

## Roster misfits

Adult column unless a stage is named. The sheet has the other stages.

### Headwear

| Species | Piece | Problem |
| --- | --- | --- |
| Wojak | Grey bobble beanie, grey sweatband, gold crown, tin crown | `LOW`. Brim and band cross the eyes. |
| Chud, Chad | Gamer headband (Chad wears the shared red headband) | `LOW`. Band crosses the eyes. Chad has no own hat. |
| Mumu | Cowboy hat, green bull headband, gold crown, tin crown | `LOW`. Hat and crown fight the horns and cover the eyes. Band sits on the snout. |
| Snibby | Sailor cap, seaweed band, gold crown, tin crown | `LOW`. Pieces sit on the eyestalks. |
| Doge | Bone headband, tin crown | `LOW`. Band and crown cross the eyes. Shiba-ear beanie clips at Elder and Mythic. |
| Dodo | Tin crown | `LOW`. Crown rides the eye line. Top hat itself is ok. |
| Kevin | Grey hair-clip band | `NECK`. Same no-headband path as Peepo. The band is a scarf. |
| Nakamoto | Genesis Block headband | `NECK`. No own hat. The headband is drawn as a neck scarf. |
| Sarutobi | Monkey king cap | `CLIP` from Adult up. Feathers leave the top of the frame. |
| Wizard | Wizard hat, red headband, gold crown, tin crown | `LOW`. Brim and bands cross the eyes. Mythic hat also clips. |
| Rabbit | Red headband, gold crown, tin crown | `LOW` or the piece sits in the ears. |
| Bo Jackson, Rarepigeon | Red headband, gold crown, tin crown | `CLIP` + `HIGH`. Shared head pieces float off the baked head and hit the frame. |
| Old Hickory, Star-Lord Kek | Red headband, crowns | `LOW`. Pieces sink into the face. Star-Lord's crown is also wide for the mask. |
| Lord Kek, Viking, DJ Pepe | Shared headband and crowns | `MISS`. Those sprites do not paint the shared head overlay. Kek drops the head slot on purpose (the nemes is the head). |
| DJ Pepe | Headphones | `LOW`. The drawn headphones sit in the eyes. |

Pepe's own sweatband and bucket hat are ok through Adult. Pepe's Mythic sweatband rides up onto the eyes.

### Face

| Species | Piece | Problem |
| --- | --- | --- |
| Peepo, and both Peepo-body hybrids | Gold nose ring | `HIGH` at every stage. Above the nostril dots. |
| Doge | Gold nose ring | `LOW`. The black nose is higher. The hoop sits on the muzzle, on the mouth line. |
| Snibby | Gold nose ring | `HIGH` from Juvenile up. The hoop is between the eyestalks, far above the mouth. |
| Pepe, Mumu, Lenny | Gold nose ring | `LOW` from Adult up. The hoop lands on the mouth row. |
| DJ Pepe, Orange Dragon | Gold nose ring | `HIGH`. Above the snout. |
| Sarutobi, Kek, Wizard, Funtrump, Homer, Rabbit, Viking, Bo Jackson, Rarepigeon, Old Hickory, Star-Lord, Gooby, Luke Spam | Gold nose ring | `MISS`. The hoop does not draw (0–2 pixels). |
| Dodo | Gold nose ring | Fit. The beak is the nose, and the hoop sits on it. |
| Wojak, Chud, Chad | Gold nose ring | No nostril pixels. The hoop sits on the lower cheek. Left unflagged. |
| Chud | Blue-light glasses | `BIG`. Wider than the head. |
| Chad | Red shades (no own eye piece) | `BIG`. |
| Kevin | Copy-paste visor | `BIG`. About 19px on a 14px head. |
| Peepo, Bobo, Snibby, Doge, DJ Pepe, Orange Dragon | Gold grill | `HIGH`. Teeth sit above the mouth. |
| Kek, Wizard, Funtrump, Homer, Rabbit, Viking, and the baked 1-of-1s | Gold grill | `MISS`. |

### Neck, back, body, grip, feet

| Species | Piece | Problem |
| --- | --- | --- |
| Kevin, Nakamoto, Peepo | Headbands (see above) | `NECK`. This is the neck slot going wrong because the headband footprint is the scarf. |
| Funtrump, Homer, Orange Dragon, Old Hickory, Star-Lord, Gooby, Luke Spam | Red scarf | `HIGH`. Scarf draws on the face or the chest, not the neck. |
| Bo Jackson, Rarepigeon | Red scarf | `CLIP`. Rarepigeon is also `HIGH`. |
| Kek, Viking, DJ Pepe | Red scarf | `MISS`. |
| Bobo, Mumu, Peepo, Sarutobi, Lenny | Own cape | `CLIP`. The cape is wider than the frame. Peepo hybrids do the same. |
| DJ Pepe, Bo Jackson | Shared red cape | `MISS`. |
| Snibby, Doge | Own outfit | `HIGH`. The chest piece climbs onto the face. |
| Kek, Wizard, Rabbit, Bo Jackson, Old Hickory, Gooby | Leather or own robe | `HIGH`. Outfit pixels land on the face. DJ Pepe's leather does not draw. |
| Pepe, Wojak, Chud, Chad, Bobo, Mumu, Dodo, Kevin, Peepo | Own held item (Chad: Rare Pepe card) | `CLIP`. The held map touches the side of the frame. |
| Peepo | Binocular baton | `CLIP`. The staff touches the frame. DJ Pepe does not draw the wooden sword. |
| Funtrump | Skateboard | `CLIP`. |
| Homer | Slippers | `CLIP`. |

Feet on the core roster (flippers, sneakers, hooves, paws, boots) sit on the feet. `OK` on `feet.png`.

## Sheet files

All of these are in this folder and in `/opt/cursor/artifacts/gear-audit/`.

- `head-hats.png`
- `head-bands.png`
- `head-crown-gold.png`
- `head-crown-tin.png`
- `face-nose.png`
- `face-eyewear.png`
- `face-mouth.png`
- `neck-scarf.png`
- `back-capes.png`
- `body-outfits.png`
- `hand-held.png`
- `hand-weapons.png`
- `feet.png`
- `peepo-headgear.png`
- `peepo-face.png`

`render.js` rebuilds them. `metrics.json` is the per-cell measurement log.

## Phase 2

Not started. Waiting for "continue". First change, when it starts, is Peepo only: nose rings down onto the nostril dots, headgear up off the eye domes and a little smaller, bands off the neck, using a Peepo anchor so other species stay put.
