# Share my pet

Pretty link: `https://xcpets.fun/pet/<id>?ref=`

`ref` is always present and unused. A later invite reward can put a code in it without changing the path.

## Why this shape

GitHub Pages has no rewrite rules. A request is a file, or it is `404.html` with HTTP status 404. Crawlers (X, Telegram) do not run JavaScript, so `og:image` and `twitter:card` have to be in the HTML they download.

Two layers:

1. **Every pet, for people.** `/pet/<id>` opens that pet. If `pet/<id>/index.html` exists, Pages returns 200. If it does not, `404.html` loads `js/v2-pet-route.js`, which fetches `pet.html` and keeps the address as `/pet/<id>`. The page is the existing pet page: sprite with worn gear, name, rarity, stage, owner short address. `pet.html?id=<id>` still works.
2. **Rich previews, for crawlers.** Only a generated folder has per-pet `og:*` tags and a PNG, because the crawler never reaches the script. Pets without a folder get the generic 404 card (the site `img/og.png` on `404.html`). `img/share-generic.png` is the art we would use if a generic pet card is swapped in later.

A per-pet PNG for all 171,223 pets is not practical. At about 31KB each that is roughly 5GB, and Pages already failed to publish when `pets.json` alone was ~75MB. This set is the **24 living pets with the best Pet Score rank** in `api/pets.json` (block 975627), excluding Sabo #1765.

| | |
|---|---|
| Pets with a card | 24 |
| `pet/` HTML + PNG | 784KB |
| `img/share-generic.png` | 28KB |
| `share/set.json` | 4KB |
| Added files, about | **0.8MB** |

Each card is 1200×630, the sprite with the gear it is wearing, name, rarity, stage, short owner, and the pet URL. Bitcoin marks on the card are red (`#e11d2e`), not orange. Type is Press Start 2P.

## Regen

Do not run this from the VPS feed or HatchBot. Those jobs are unchanged, and `api/pets.json` still advertises `pet.html?id=` so existing readers keep working.

```sh
npm install --no-save puppeteer-core@23
CHROME=/usr/bin/google-chrome node tools/share-cards.js --top 24
```

`--top` can go up to 80. The script rewrites `pet/<id>/`, `img/share-generic.png`, and `share/set.json`. Commit the result. `.github/workflows/share-cards.yml` is `workflow_dispatch` only: it uploads an artifact and does not push to `main`.

A weekly run is enough. A brand-new hatch is not in the set until the next run, so its X card is the generic 404 preview until then. The link itself still opens the pet.

## Share button

`Share my pet` copies `https://xcpets.fun/pet/<id>?ref=` and opens `https://x.com/intent/post` with the pet text and that URL. `Share to Telegram` does the same with `https://t.me/share/url`. That is the only share pair. Save GIF and Save image stay on the pet page.

It is on the pet page, the hatch review, the breed egg popup, and the Mythic scene. The phone toast is anchored to the left and right edges (same idea as the toast-cutoff fix) so the URL is not shifted off a 360px or 412px screen.

Sabo #1765 is not in the card set, and the pet page, family tree, and share text do not describe that pet as dead.
