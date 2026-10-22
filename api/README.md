# XCPETS public JSON feed

Free, read-only, static JSON. No key, no rate limit beyond GitHub Pages' own. Served with `Access-Control-Allow-Origin: *`, so you can `fetch()` it from any website.

| URL | What |
|---|---|
| `https://xcpets.fun/api/pets.json` | Every pet (one object per pet, sorted by `id`) |
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

`{ "blockHeight": N, "count": N, "pets": [ ... ] }`. Each pet:

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

Pets are on one line each, so you can stream the file line by line. It is ~11 MB raw, about 650 KB gzipped (GitHub Pages gzips it).

## Example

```js
const { pets } = await (await fetch('https://xcpets.fun/api/pets.json')).json();
const mine = pets.filter(p => p.owner === 'bc1q...');
```
