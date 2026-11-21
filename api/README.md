# XCPETS public JSON feed

Free, read-only, static JSON. No key, no rate limit beyond GitHub Pages' own. Served with `Access-Control-Allow-Origin: *`, so you can `fetch()` it from any website.

| URL | What |
|---|---|
| `https://xcpets.fun/api/pets.json` | Every pet, sorted by `id` (columnar file; expand to objects, below) |
| `https://xcpets.fun/api/meta.json` | Block height, generated time, totals |

The data comes from replaying every XCPETS burn on Counterparty with the game's own rules, the same replay that xcpets.fun runs in your browser. The game server timer (`xcpets-feed.timer` on xcpets-bot-1) is the writer. A publish lands about every 20–25 minutes when pets, totals, or the chain tip have moved. A run that only changes the clock does not commit. The old hourly note, and the later every-10-minutes GitHub schedule, are no longer how it runs. GitHub Actions can still rebuild it by hand if that server is down. Each run is limited to 30 minutes. It can trail the site by a block or two. Check `blockHeight` in `meta.json`. The burns on chain are the source of truth.

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

Each pet is one array, one line, in `cols` order. Repeated owners, species and species labels live once in `dict` (the row stores an index). `stageName`, `hybrid` and `url` are not stored: `stageName` is `dict.stageName[stage]`, `hybrid` is true when the species id starts with `hyb` (`hyb:` or `hyb3:`), and `url` is `urlBase` + id. Gear is `[slotIndex, item, name, tierIndex]` with `dict.slot` and `dict.tier`. Stats are five numbers in `dict.stat` order (`vigor`, `spark`, `grit`, `zoom`, `luck`).

This is the same data as the old object list. It is packed so a feed push stays small enough for GitHub Pages to publish (the object file had grown to about 75MB and deploys were aborting at 10 minutes). `js/pets-feed.js` (`XCPETSPetsFeed.expand`) turns it back into the objects below. An old file that still has object pets expands as itself.

The expanded object for each pet:

| Field | Meaning |
|---|---|
| `id` | Pet number (`https://xcpets.fun/pet.html?id=<id>`) |
| `name` | Display name |
| `species` | Species id (`pepe`, `wojak`, …). A two-parent hybrid is `hyb:<a>:<b>`. A three-way hybrid is `hyb3:<a>:<b>:<c>` (three parent species, in that order) |
| `speciesLabel` | Name as the site shows it (e.g. `Pepodo (hybrid)`) |
| `hybrid` | `true` when `species` starts with `hyb` (both `hyb:` and `hyb3:`) |
| `tier` | Hatch rarity: `Common`, `Uncommon`, `Rare`, `Legendary` |
| `rarityScore` / `rarityRank` | Pet Score 0-1000 and its rank (same as the site; `null` for released pets) |
| `stage` / `stageName` | 0-5: Egg, Hatchling, Juvenile, Adult, Elder, Mythic |
| `care` | Total XCPETS fed |
| `status` | `alive`, `dead` or `released` |
| `usedUp` | Why a released pet was used up, or `null`. A zombie meal is `eaten by #N`. A seance offering is `offered to #N`. A Resurrection pledge is `Resurrection of #N` |
| `rareHatch` | Legend or weird hatch record, or `null` for an ordinary pet. Shape: `{ version: 1, kind, block }`. `kind` is a Legend hatch (`djpepe`, `wizard`, `kek`, `god`) or a weird hatch (`tiny`, `giant`, `two-headed`, `inverted`, `ghost`, `backwards`, `wrong-egg`). A wrong egg also has `expected` and `actual`. A weird trait passed on by breeding adds `origin` (`breed`), `inheritedFrom` (parent id), and `parentIndex` |
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

Pets are on one line each, so you can stream the file line by line. At block 976,939 (204,397 pets) the packed file is about 21.8 MB raw (21,845,697 bytes) and about 4.2 MB gzipped on the wire (about 4,178,012 bytes). GitHub Pages gzips it. The expanded objects are the same size the old file was.

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
