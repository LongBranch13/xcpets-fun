# Rank brag cards

Written plan only. The card is drawn in the browser. GitHub Pages stays a folder of static files. No rule change.

## Summary

One tap builds a picture of this week's rank and hands it to the phone share sheet, or downloads it on a desktop. The picture is made on that device from the leaderboard the replay already computed. The caption carries the pet share link with `ref`, so a friend who opens it is the invite path in `design/growth/invite-rewards.md`. Pages cannot paint a different image for each visitor. The share is the file plus the link. The pet page's unfurl image stays the existing `img/og.png`.

## What the card says

One card, one rank.

- Week number, format name ("Burn race"), and the block window (`1,013,837–1,014,844`).
- Rank and score, and "final" or "so far, through block N". A week that has not closed must say "so far". The number has to match the board at that block.
- One pet: the pet the player has pinned, or their oldest living pet if they have not pinned one. Name, species, id.
- A short line a friend can check: "Replay week 42 through block 1,014,844".
- `xcpets.fun` in the corner. No wallet address. No player number printed as an address. No price. No XCP amount presented as winnings. A burn-race score is labeled "XCPETS burned" so it is not read as a payout.

Colors: night `#120d22`, gold `#ffd166`, Bitcoin red `#c8102e` for the rank numeral. The pet keeps its own pixels. Bitcoin is not drawn in orange.

Species-rivalry week uses the same frame. The big word is the team name and the team score. The pet is still one of theirs from that team.

## The share link

The caption under the image, and the text handed to the share sheet:

```
Week 42 burn race. Rank 4.
https://xcpets.fun/pet.html?id=15004&ref=1A
```

`ref` is the sharer's player number in base 32, the same code the invite plan puts in `pet:inv`. The live pet URL is `pet.html?id=`. That is what `api/pets.json` already publishes. There is no `/pet/<id>` path yet. Use the live URL so the tap lands on the pet.

The image file does not have to contain the full URL in tiny type. The corner can say `xcpets.fun`. The link travels with the share text. On a desktop, "Copy" copies the image is optional. The button copies the caption, and a second button downloads the PNG. On a phone, one button calls the share sheet with the PNG and the caption together.

Opening the link does not grant gear. The invite rules still require the new wallet's own `pet:inv` burn and a real first hatch.

## How the picture is made on GitHub Pages

Pages serves files. It does not run a painter per address. Nothing is uploaded at share time. Nothing new is committed per player.

The page already has the pet's pixels. The card is a canvas in the browser:

1. Read the rank from the same function that draws the leaderboard. If the replay is not finished, the button reads "Board still loading" and does not draw a fake rank.
2. Draw a 1080 by 1080 canvas. Fill the night color. Draw the red rank. Draw the pet with the renderer the pet page already uses, scaled up with crisp pixels (`imageSmoothingEnabled = false`).
3. Draw the week line and the score in the pixel font the site already loads, or in a plain fallback if the font is not ready yet. Wait for the font before drawing, so the card does not show a half-loaded face.
4. `canvas.toBlob` gives a PNG named `xcpets-week-42-rank-4.png`.
5. Phone: `navigator.share` with that file and the caption, when the browser allows sharing files. Desktop, and any phone that refuses the file: download the PNG and copy the caption.

That is the whole generator. It works on the static host because the work happens after the page has loaded, in the visitor's browser, from public replay data they already downloaded.

What this cannot do: make `https://xcpets.fun/pet.html?id=15004` unfurl the rank card on X or Telegram. Those sites fetch `og:image`, and Pages would have to serve a different image per query. It serves one `img/og.png`. Leave that tag alone. People who need the picture share the PNG. The link still opens the pet.

A canned sample card can live under `design/growth/` later if you want a mock. It is not required for the share button, and it is not a per-player image.

## Where the button sits

- The weekly board, on the player's row. Desktop and phone. This is the primary tap.
- The pet page, beside Share, labeled "Brag this rank" only when this wallet is the owner and a weekly board exists. The link it builds is that pet plus `ref`.
- Species rivalry uses the same button once that board exists.

The button is a normal page control, at least 44 pixels tall on a phone. It does not fire a burn and does not open the wallet.

## Checks

- The rank on the card equals the rank on the board at the block printed on the card. If the tip moves while the card is open, the card keeps the block it was drawn at. It does not silently update.
- A tied score prints the tie-break block in the small line, the same block the board uses.
- No address in the pixels. Check by reading the PNG. The short address can appear on the board. It stays off the card.
- `prefers-reduced-motion`: the button still works. There is no animation required to build the PNG.
- Practice mode can draw a card with "Practice" in the corner and must not attach a `ref` that points at a real invite. Practice burns are not on chain. A practice card's caption is the practice pet path only, with no `ref`.

## Decisions for you

1. Square 1080 card, as above, or a 1200 by 630 card that looks more like a link preview. The share is still a file either way.
2. The pet on the card: a pin the player sets, otherwise the oldest living pet. Say if you want the strongest pet instead.
3. Confirm the caption uses `pet.html?id=<id>&ref=<player number>` and that the unfurl image stays `img/og.png`.
4. Confirm practice cards never carry `ref`.
5. Whether the pet page button ships with the weekly board, or waits until the invite burn exists. The picture does not depend on the invite. The `ref` becomes meaningful when you turn invites on.
