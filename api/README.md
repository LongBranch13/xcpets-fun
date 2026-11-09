# XCPETS public JSON feed

Free, read-only, static JSON. No key, no rate limit beyond GitHub Pages' own. Served with `Access-Control-Allow-Origin: *`, so you can `fetch()` it from any website.

| URL | What |
|---|---|
| `https://xcpets.fun/api/pets.json` | Every pet, sorted by `id` (columnar file; expand to objects, below) |
| `https://xcpets.fun/api/meta.json` | Block height, generated time, totals |

The data comes from replaying every XCPETS burn on Counterparty with the game's own rules, the same replay that xcpets.fun runs in your browser. It is rebuilt every hour, so it can trail the site by a block or two. Check `blockHeight` in `meta.json`. The burns on chain are the source of truth.

## meta.json

| Field | Meaning |
|---|---|
| `blockHeight` | Bitcoin block height the replay ran to |
| `generatedAt` | When the files were built (UTC, ISO 8601) |
| `asset` | `XCPETS` |
| `totalPets` / `alive` / `dead` / `released` | Pet counts (the community pet isn't in the list) |
| `burns` | Number of XCPETS burns (destructions) replayed |
| `burnedXCPETS` | Total XCPETS burned |
| `supplyXCPETS` | Current XCPETS supply from Counterparty (`null` if the read failed) |
| `owners` | Distinct owner addresses |

## pets.json

`{ "v": 2, "blockHeight": N, "count": N, "urlBase": "https://xcpets.fun/pet.html?id=", "dict": { ... }, "cols": [ ... ], "pets": [ ... ] }`.

Each pet is one array, one line, in `cols` order. Repeated owners, species and species labels live once in `dict` (the row stores an index). `stageName`, `hybrid` and `url` are not stored: `stageName` is `dict.stageName[stage]`, `hybrid` is a species id starting with `hyb`, and `url` is `urlBase` + id. Gear is `[slotIndex, item, name, tierIndex]` with `dict.slot` and `dict.tier`. Stats are five numbers in `dict.stat` order (`vigor`, `spark`, `grit`, `zoom`, `luck`).

This is the same data as the old object list. It is packed so a feed push stays small enough for GitHub Pages to publish (the object file had grown to about 75MB and deploys were aborting at 10 minutes). `js/pets-feed.js` (`XCPETSPetsFeed.expand`) turns it back into the objects below. An old file that still has object pets expands as itself.

The expanded object for each pet:

| Field | Meaning |
|---|---|
| `id` | Pet number (`https://xcpets.fun/pet.html?id=<id>`) |
| `name` | Display name |
| `species` | Species id (`pepe`, `wojak`, …; hybrids are `hyb:<a>:<b>`) |
| `speciesLabel` | Name as the site shows it (e.g. `Pepodo (hybrid)`) |
| `hybrid` | `true` for hybrids |
| `tier` | Hatch rarity: `Common`, `Uncommon`, `Rare`, `Legendary` |
| `rarityScore` / `rarityRank` | Pet Score 0-1000 and its rank (same as the site; `null` for released pets) |
| `stage` / `stageName` | 0-5: Egg, Hatchling, Juvenile, Adult, Elder, Mythic |
| `care` | Total XCPETS fed |
| `status` | `alive`, `dead` or `released` |
| `community` | `true` for a community pet |
| `owner` | Owner's Bitcoin address |
| `generation` | 0 = hatched; bred pets are 1 + the higher parent's generation |
| `parents` | `[idA, idB]` for bred pets, else `null` |
| `gear` | Equipped pieces: `{ slot, item, name, tier }` (slots: head, face, body, back, hand, feet) |
| `stats` | `{ vigor, spark, grit, zoom, luck }` |
| `wins` / `losses` | Battle record |
| `bornBlock` | Block the pet hatched in |
| `lastFedBlock` | Block of the last meal (`null` if never fed) |
| `deathBlock` | Block it died in (`null` if alive) |
| `url` | Pet page. Sprites are drawn in the browser, so there is no image URL. The pet page has the art and a share image. |

Pets are on one line each, so you can stream the file line by line. At block 975220 (147,174 pets) the packed file is about 15MB raw, about 2.8MB gzipped (GitHub Pages gzips it). The expanded objects are the same size the old file was.

## Example

```html
<script src="https://xcpets.fun/js/pets-feed.js"></script>
<script>
const doc = await (await fetch('https://xcpets.fun/api/pets.json')).json();
const { pets } = XCPETSPetsFeed.expand(doc);
const mine = pets.filter(p => p.owner === 'bc1q...');
</script>
```

`meta.json` and `boot.json` are unchanged. HatchBot's reads of block height, totals, `community`, and the boot copy do not use this file.

## recent-events.json (sale-cache-feed, preview)
Written by `tools/recent-events.js` in the api-feed workflow: `{v:1, tip, hash, from, blocks: {N: {hash, complete, total, events}}}` for the last 60 blocks,
read from a Counterparty full node (:4000). `events` keeps only events that name a numeric pet token plus every order / match / cancel / expiry event
(`total` = the block's full event count). js/v2-sales.js uses a block's list only when its `hash` equals the page's own fresh chain read; otherwise
that block is checked on a :4000 node, and any doubt means the full sale-data read. Burns stay locked until that read is verified.
