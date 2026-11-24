# XCPETS Telegram packs (Nov 24 2026)

Every pet species as a Telegram **sticker pack** and a **custom emoji pack**, drawn from the game's own sprites
(the 70 die-cut merch stickers: every species bare, plus some gear and full gear where the species wears gear).

| | Pack | Images |
|---|---|---|
| Stickers | `t.me/addstickers/xcpets_pets_by_<HatchBot username>` | `sticker/*.png`, 512x512 |
| Emoji | `t.me/addemoji/xcpets_emoji_by_<HatchBot username>` | `emoji/*.png`, 100x100 |

- `make-images.py <folder of merch stickers>` remakes the images (crisp integer pixel scale, no blur).
- `pets.json` lists each image with its species, fallback emoji and search words. Its order is the emoji pack's order.
- `packs.js` (workflow **telegram-packs**) creates both packs with HatchBot's token, or refreshes them in place
  (same links), and makes the sticker pack the group's sticker set if HatchBot is an admin allowed to.
  The packs belong to the Telegram group's creator.
- Groyper is not in the packs yet: he is not live. Add his images and a pets.json line when he launches, and the workflow refreshes the packs.

## Where HatchBot shows the pixel emoji
Telegram only lets a bot post custom emoji (a) in a group whose **emoji pack** is XCPETS Emoji, or (b) anywhere,
once the bot's owner has Telegram Premium (Bot API 9.4). For (b) set `"custom_emoji": true` in `hatchbot/auto-config.json`.
Everywhere else the same spots show the plain emoji from `pets.json`, so nothing breaks.

- Announcements (`announce.js`): every pet name ends with its species emoji.
- Worker (`worker.js`): `/stickers` (also `/emoji`) posts both pack links, a row of every pet's emoji and a random pet sticker.
  `petEmojiText(env, chat, "text with {pepe} {wojak}")` returns `{ text, entities }` for any command that wants pet emoji (e.g. /burns).
