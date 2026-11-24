# XCPETS Pet Shell

A small handheld shaped like a pet from the game, head to feet: arms out, flat feet so it stands on a desk, the screen in its belly. It shows **one bonded pet, live**: its pixel art (it grows through the stages on
the screen too), hungry or fed, feed streak and stage. Press a button for a **feed QR**: scan it with a phone and xcpets.fun opens
with the feed burn ready, for the player's **own wallet** to sign.

**No keys inside.** The Pet Shell reads only public files (the published world on node.xcpets.fun: the owner pages and pet files the
site's fast load and the Telegram mini app already read). It never holds a wallet key, never signs and never sends anything. It stores a
Wi-Fi name and password, a public address, a pet id and the pet's pixel art. The feed QR is the phone hand-off link of `js/handoff.js`
(PR 219), so the site re-prices the meal and runs every usual check before the wallet asks to sign.

Planned as a numbered run of 21 (money plan, Nov 24 2026).

| Folder | What |
|---|---|
| `shells/` | the three shells: Pepe, Bobo, Dodo. `make_shells.py` builds them, `preview.py` draws the pictures |
| `shells/out/` | ready-to-print files: `<pet>-front.stl`, `<pet>-back.stl`, `<pet>.3mf` (one colour), `<pet>-multicolour.3mf`, `fit-test.stl` |
| `firmware/` | the device software (PlatformIO, Arduino on the ESP32-S3) |
| `../shell/` | the setup page, https://xcpets.fun/shell/ (flash + pick a pet + Wi-Fi over one USB cable) |
| `../.github/workflows/petshell-firmware.yml` | builds the firmware and commits `shell/firmware/petshell.bin` |
| `../tools/petshell-test.js` | checks the device helpers against the site (QR link, sha256, art packing, streak) |

---

## Parts (per Pet Shell)

Prices are rough estimates from Nov 2026, before shipping. Check the listing before you buy.

| Part | Get | About |
|---|---|---|
| **LilyGO T-Display-S3**, the *non-touch* version, *without* soldered header pins (ESP32-S3, 16 MB flash, 8 MB PSRAM, 1.9" 170x320 screen, battery charger built in) | [LilyGO store, US warehouse](https://www.lilygo.cc/products/t-display-s3-us) or [worldwide](https://lilygo.cc/en-bg/products/t-display-s3), or Amazon "LILYGO T-Display-S3" | $20-25 |
| **LiPo battery, 3.7 V, 1 cell, at most 31 x 52 x 6.5 mm**, with a **JST 1.25 mm 2-pin** plug. A *603048* (about 850 mAh) or *502248* (about 500 mAh) fits | Amazon / AliExpress search "603048 lipo JST 1.25" | $6-10 |
| **4 x M2 x 8 mm self-tapping screws** (pan head, for plastic) | Amazon "M2 self tapping screw assortment" (a kit does all 21) | $8 per kit |
| **USB-C cable that carries data** | any | - |
| Shell print (two halves, about 90-100 g of PLA) | your printer, or a print service (Craftcloud, JLC3DP, a local maker) | $3 own printer, $15-40 service |
| Optional: a small square of double-sided foam tape | behind the board, stops rattles | - |

Rough cost per unit: **about $35-45** with your own printer.

> ⚠️ **Battery plug polarity.** JST 1.25 batteries are not all wired the same way. Before plugging in, check that the battery's **red
> wire goes to the + mark** next to the board's battery socket. A reversed battery can destroy the board. If it is reversed, buy one
> that matches, or have the two wires swapped in the plug (a small pin pushes the crimp out).

## Printing

- **Fit test first** (15 minutes, a few grams): print `shells/out/fit-test.stl`, then press the board into it screen-first. The board
  should drop in with a little play, the screen should fill the window, and both buttons should click when you press the tabs. If it
  is too tight, raise `CL` at the top of `make_shells.py` by 0.1 and build again (or ask Claude).
- **One colour**: open `<pet>.3mf` (both halves, already lying the right way) in Bambu Studio, PrusaSlicer, OrcaSlicer or Cura.
  PLA, 0.2 mm layers, 3 walls, 15 % infill, **no supports**. The front prints face down (that makes the face crisp), the back prints
  back face down. Paint the cut-in face pixels with a paint pen if you like.
- **Multi-colour** (Bambu with an AMS, Prusa MMU, or a print service): open `<pet>-multicolour.3mf`. The front comes in as one object
  with one part per colour (Pepe: green, black, white, blue, red; Bobo: brown, black, white, red; Dodo: dark grey, grey, white, red).
  Give each part its filament and print. The back is one colour.
- **Shell number**: the back has a small box next to "No. … /21". In the slicer, use its text tool (Bambu/Orca: right-click >
  Add text; PrusaSlicer: right-click > Add part > Text) to write the number into the box, 0.4 mm deep, before printing.
- The small hole near the top is for a lanyard or key ring.

## Build (about 10 minutes)

1. Put the software on first (next section), while the board is bare. That way you know the board works.
2. Plug the battery into the board (check the polarity warning above).
3. Lay the **front half** face down. Put the board in, **screen first**, USB-C towards the opening at the bottom. The two buttons sit
   under the two tabs at the bottom.
4. Lay the battery flat in the **back half**'s pocket, wire towards the bottom. Tuck the wire in.
5. Put the back half on, check no wire is pinched, and turn in the 4 screws until they are just snug (plastic strips if you force them).
6. Press a button: the pet appears.

The side reset button sits behind the tiny pin hole on one side: poke it with a paper clip if the Pet Shell ever freezes.

## Put the software on and set it up (click by click)

All on https://xcpets.fun/shell/ in **Chrome or Edge on a computer** (Windows, Mac or Linux). Phones can't do this part.

1. Plug the Pet Shell (or the bare board) into the computer with the USB-C cable.
2. **Step 1** on the page: click **Install Pet Shell software**, pick the device in the list (often *USB JTAG/serial debug unit*),
   click **Install**, say yes to erasing, wait about a minute until it says done.
   - "Failed to connect"? Hold the **BOOT** button, tap **RST**, let go of BOOT, and try again.
3. **Step 2**: paste the player's **wallet address** (never a seed phrase or key), click **Show my pets**, tap the pet.
4. **Step 3**: Wi-Fi name and password (2.4 GHz Wi-Fi), and the shell number if you want it on the info screen.
5. **Step 4**: click **Send to my Pet Shell**, pick the device again, wait for 🎉. It restarts and shows the pet.

To change the pet or the Wi-Fi later, do steps 2 to 4 again. To wipe it (before selling a used one), install the software again with
erase on.

## Using it

- **Press** either button: next screen (pet, feed QR, info).
- **Hold** a button 1.5 seconds: check for news now (it also checks by itself every 10 minutes).
- **Hold** a button 6 seconds: picture upside down (if the screen looks wrong way up in the shell).
- On battery it dims after 1 minute and sleeps after 5. Press **KEY** to wake it.
- **Feed QR**: scan it with a phone camera. It opens xcpets.fun with *Feed #id* ready. Sign it in the wallet that owns the pet
  (Casa Tookan on a phone, or open it on the computer that has XCP Wallet). The site shows the real price and checks everything first.

What the screen says: *HUNGRY!* (not fed this chain day), *FED TODAY*, *STREAK N DAYS*, *MYTHIC* (Mythics never eat), *ZOMBIE!*,
*R.I.P.* (the pet died), *NOT IN YOUR WALLET* (sold or sent away: set up a new pet).

## Known limits (version 1.0)

- Hybrids and community pets show a mystery egg instead of their art (their art is drawn by the full site only). Everything else works.
- Gear is not drawn on the device (same as the Telegram mini app).
- The world files are rebuilt every 6 blocks, so the screen can be up to about an hour behind the chain.
- The feed QR relies on the phone hand-off (PR 219). Until that is merged, scanning opens the play page without the burn ready.
- The firmware can't be built in Claude's sandbox; the `petshell-firmware` workflow builds it on GitHub. It has not run on real
  hardware yet: the first unit is the real test.

## For developers

- Shells: `python3 -m pip install numpy shapely scikit-image trimesh manifold3d fast-simplification matplotlib rtree pillow`, then
  `python3 petshell/shells/make_shells.py` (all) or `... make_shells.py pepe`. Board measurements come from LilyGO's own 3D model
  (`dimensions/t-display-s3-full.stl` in github.com/Xinyuan-LilyGO/T-Display-S3). Each shell is the pet's icon
  (`img/theme/sp-<species>.png`), one sprite pixel = 3.2 mm; the head is drawn as-is, the body row is repeated down as the torso
  that holds the board, and pixel arms and legs are added (`limbs=` in each `design_<name>()`). The legs leave the USB-C port free. Adding a species = one `design_<name>()` line plus a palette. Older round designs (Hatchy, Chonk, Spook) are kept in
  `EXTRA_DESIGNS`.
- Pictures: `python3 petshell/shells/preview.py` (three.js in Playwright's Chromium; needs `npm i three@0.170.0`, path in `THREE_DIR`).
- Firmware: `pip install platformio && pio run -d petshell/firmware`. Pure helpers live in `src/logic.h` and are tested on a computer
  by `node tools/petshell-test.js`. USB setup protocol: `CFG {json}`, `ART <stage> <frame> <base64 RGB565>` (x24), `SAVE`, plus
  `HELLO`, `INFO`, `FORGET`.
- Data: `latest.json` -> world folder; `view/own/<sha256(address)>.json` (first 24 living pets in full, `ids`, `pages`); later pages
  `…/<hex>.<n>.json` hold ids in id order (binary search); `view/p/<id/2000>.json` for the pet's own record. Fields used: `name stage
  tier care dead released zombie hungry fedToday nextMeal feedDays wins losses`.
