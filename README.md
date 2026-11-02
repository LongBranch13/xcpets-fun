# XCPETS

**[xcpets.fun](https://xcpets.fun)** is an 8-bit pet game played with burns on Bitcoin.

You hatch, feed, fight, breed and dress up meme pets. Every action is a real burn of the XCPETS token (a Counterparty `destroy`) that you sign in your own wallet. There is no game server, no account and no database. Every player's browser reads the same public burn history and replays the same rules, so everyone sees the same pets.

- Play: <https://xcpets.fun/play.html>
- Watch live, no wallet needed: <https://xcpets.fun/watch.html>
- Check any pet's proof in your browser: <https://xcpets.fun/verify-pet.html>
- How it works, in plain words: <https://xcpets.fun/how-it-works.html>
- Exact costs, tags and odds: <https://xcpets.fun/rules.html>

## How the game state is rebuilt from burns

1. **Read the burns.** The page asks Counterparty Core (`api.counterparty.io:4000`, then `api.unspendablelabs.com:4000`) for every XCPETS destruction. Each one has a tx hash, a block, a source address, an amount and a tag like `pet:hatch`.
2. **Read the block hashes.** A hatch is rolled from the hash of the block its burn landed in, which nobody knows ahead of time.
3. **Roll the pet.** `seed = lowercase(blockHash) + ":" + lowercase(petId)`. The pet id is the hatch tx, or the tx plus a suffix when one burn makes more than one egg. `DNA = SHA-256(seed)`. [`js/pet-core.js`](js/pet-core.js) turns that into traits with no dependencies: same seed, same pet, byte for byte.
4. **Replay the rules.** [`js/v2-rules.js`](js/v2-rules.js) (`V2Rules.replay`) walks every burn in chain order: hatches, meals, fights, breeding, gear, deaths, sales. It builds the whole world: who owns which pet, its stage, care and stats.
5. **Draw it.** The rest of `js/` only draws that world. Pages never change the rules.

Burns on chain are the source of truth. If a burn's tag or amount doesn't fit the rules, the replay rejects it the same way in every browser.

## Check the replay yourself

You need Node 18 or later. Nothing to install for a replay, and no network needed:

```sh
git clone https://github.com/LongBranch13/xcpets-fun.git
cd xcpets-fun
node tools/replay-check.js --snap tools/snapshots/snap-972901.json
```

This loads the repo's rules in a Node `vm` (same script order as `play.html`) and replays a saved burn snapshot (`tools/snapshots/*.json`: `{ tip, rows, hashes }`). It prints stable hashes for the result: overall, pets, gear.

Other modes:

```sh
# did a change move anything? replays the same snapshot with another git ref's rules: SAME or DIFFERENT
node tools/replay-check.js --compare origin/main --snap tools/snapshots/snap-972901.json

# save a fresh snapshot from xcpets.fun (headless Chrome via puppeteer-core)
node tools/replay-check.js --fetch
```

In a browser, [verify-pet.html](https://xcpets.fun/verify-pet.html) does the same check for one pet: burn, block hash, seed, DNA and traits rolled again. Its **Run my own replay** button replays every burn up to the published `pets.json` block and compares a SHA-256 of both.

## Public data feed

[`api/`](api/) has free, read-only JSON, rebuilt every hour by replaying every burn with these same rules ([`tools/api-feed.js`](tools/api-feed.js)):

- [`api/pets.json`](https://xcpets.fun/api/pets.json): every pet (owner, species, rarity, stage, care, gear, parents, born/fed/death blocks)
- [`api/meta.json`](https://xcpets.fun/api/meta.json): block height, totals, supply
- Field docs: [`api/README.md`](api/README.md)

## Repo map

| Path | What |
|---|---|
| `*.html` | The pages (static, served by GitHub Pages) |
| `js/pet-core.js`, `js/v2-rules.js`, `rjs/` | The rules: pet rolls and the replay |
| `js/` (the rest) | Drawing, pages, wallet hand-off (display only) |
| `css/`, `fonts/`, `img/` | The 8-bit look |
| `api/` | The hourly public JSON feed |
| `tools/` | Tests (`node tools/run-tests --jobs 4`), replay check, build helpers |
| `previews/`, `design/` | Art previews and design notes |

## License

No license file yet, so default copyright applies. The source is public so anyone can check the game.
