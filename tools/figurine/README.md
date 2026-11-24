# Pet figurines

Turns any pet into a full-colour 3D figurine file, from the same sprite the site draws (gear, hybrid looks, stage, zombie look).
The pet stands on a plinth in its rarity colour (purple for Mythic, green for zombies) with its name on the front and
`#id XCPETS.FUN` on the back.

## Easiest way (no computer setup)
GitHub > **Actions** > **figurine** > **Run workflow** > type the pet number(s) > **Run workflow**.
After about 2 minutes, open the run and download **figurines** at the bottom. Each `pet-<id>` folder has:

| file | what it is |
| --- | --- |
| `xcpets-<id>-standard-obj.zip` | **the file to upload** to the print service (OBJ + MTL + colour PNG, millimetres) |
| `xcpets-<id>-standard.3mf` | the same model as 3MF, if a service asks for that instead |
| `preview.png` | front and back pictures to show the player before ordering |
| `spin.gif` | the figurine turning around (Telegram) |
| `order.txt` | size, volume, the species check and anything the tool changed |

Sizes: `mini` 50 mm, `standard` 75 mm (default), `big` 100 mm tall including the plinth.

## Command line
```
node tools/figurine/make.js --ids 17545,27 --size standard --out figurines
node tools/figurine/make.js --sprite figurines/pet-17545/sprite.json --size big   # re-size without the 1-minute replay
node tools/figurine-test.js
```

## How it works
- `sprite.js` replays `api/boot.json` (like HatchBot) and draws the pet with `hatchbot/art.js spriteSet` (js/v2-render.js), Mythic aura overlay off.
- `voxel.js` crops the pet's pixels, fills corner-only pixel contacts, joins or drops floating bits (the site's corner badge is left out),
  gives each pixel a thickness that grows with its distance from the outline (a puffy "pillow"), adds the plinth and lettering,
  then fills any voxel that would leave an edge or corner touching only diagonally, so the surface is closed and watertight.
  The sprite's dark outline stays on the front and back faces; the sides take the nearby body colour.
- `render.js` draws the previews from the exact triangles that go to the printer.
- Nothing here changes the game or the rules.

## Species check
`species-check.json`: Jake decided (Nov 24 2026) every game species is a product (Pepe, Bobo, Dodo, Lord Kek, Star-Lord Kek,
FUNTRUMP, Homer Pepe, The White Rabbit, Nakamoto, all of them), so all are **ok**. A species not in the list (one added to the game
later) is **ask**: the order sheet shows a reminder to add it. **stop** (empty now) would block a species unless `--allow-stop`.
A hybrid takes the strictest level of its parents.

## Print service
JLC3DP **Full-Color Resin** (WJP). Upload the `-obj.zip` (they accept OBJ + MTL + PNG in one zip, or 3MF), pick full colour, units mm.
Their limits: walls over 1 mm (our thinnest part is 2.7 mm at mini size), no hollow parts (ours are solid), one piece per file (ours is one piece).
