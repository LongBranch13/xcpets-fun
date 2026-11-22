# XCPETS – notes for Claude

## What it is
XCPETS is an on-chain pet game on Bitcoin/Counterparty. Players burn XCPETS tokens with text tags (e.g. `pet:hatch`, `pet:breed:A:B`, `pet:feed:ID`); the game state is rebuilt by replaying every burn from the chain in order. Site: https://xcpets.fun (GitHub Pages). Repo: https://github.com/LongBranch13/xcpets-fun (deploy = merge to main; Pages publishes in ~1-3 min).

## Rules
1. Never sign burns or transactions. Never handle wallet keys.
2. Never put secrets, the node's onion address or server connection details in code, commits or public posts.

## Useful facts
- Owner's wallet starts `bc1ps9av86`, ends `s26m3s4`. It's very large and slow to load.
- Players: Evan `bc1pfvkpmllr…3gqd` (~2,200 pets), Jacob (biggest burner).
- Test wallets: `1JwWsArppwALMEdXWPmpDBcP1jwWsAPYkD`, `bc1qtke38j72qv4d8eljn7pccaykypw8luytfwdn7q`.

## Architecture in one page
- `js/v2-rules.js`: the live rules engine (replay). Huge (~5.4k lines) with `ACTIVATE_*_BLOCK` height gates. Old eras are frozen. New rules are added behind a new activation block. Current MD5 (Nov 22, 2026, Seasons rules added, gate off; raid rebalance live from 977,120): `bd47929530201cc653d086e673d58184`. `node tools/rebuild-bench.js --compare origin/main` replays `api/boot.json` on both trees and must print SAME for any change meant to keep the replay output identical.
- `rjs/*`: the frozen engine for burns up to block 971,500. `rjs/chain.js` reads block hashes. It requires a trusted source or two agreeing sources plus a proof-of-work check (PR #88).
- Rules signature (rsig): a hash of the rule files (incl. `js/v2-rules.js` and `rjs/chain.js`). Changing any of them changes the rsig.
- World snapshot: a pre-built world served at `https://node.xcpets.fun/xp/v1/world/latest.json` (+ slim view files: `view/summary.json`, `owners.json`, `rank.json`, `p/000NN.json` shards, `own/<sha256(addr)>.json`). Browsers use it only if its rsig matches the page's rules, otherwise they replay locally (slow). It is built by the sync server itself on the VPS (`tools/sync-server`, every 6 blocks, from the rule files on the VPS disk). **After any rules or rsig change, the VPS copy of the repo must be updated too**, or players fall back to the slow load.
- node.xcpets.fun: a Hetzner VPS running the sync server (`/opt/xcpets-sync`, service `xcpets-sync`) and a node cache, backed by the game's own Counterparty node. Access comes from the owner; never publish its details.
- Feed: `api/boot.json`, `meta.json`, `pets.json` are rebuilt by a game-server timer about every 20-25 min.
- Workers (`js/v2-verify-worker.js`, `v2-catchup-worker.js`, `v2-resume-worker.js`) fetch the rules as text, patch them with strings, then eval them. They're fragile, so be careful when reformatting `v2-rules.js`.
- Cache-busting: every script tag carries `?v=<token>`. Bump it in every HTML page that loads a changed script.

## How to verify a deploy
- Compare the MD5 of each changed live file (`https://xcpets.fun/<file>?cb=<random>`) with raw main.
- Check that `js/v2-rules.js` MD5 is what you expect.
- If rules or rsig changed: confirm `latest.json` shows the new rsig and a current tip.

## Tests
`tools/*-test.js` (node). ~30 tests already fail on main (stale MD5 pins like living-rest-test/other-lookup-test, missing Playwright, 10-minute CI timeouts, pets.json over the 20 MB cap). Compare against main.

## The fast-load layer (where most bugs live)
Pages paint from a slim "fast world" (js/v2-split.js assemble, js/v2-art.js, the verify/catch-up workers) instead of a full replay. It is missing parts of the full world (listings, swaps, quests, most of w.cem, rules' in-memory switches). Bugs found Nov 22, 2026 were all here: missing w.cem.altars (seance button), v2-art.js not exporting self.XcpArt in workers (every pre-sign owner check failed), gear/hatch "new" detection running on a half-loaded list, rules pool switches never set (FUNTRUMP breeding). Never fix these by editing the rules.
- **tools/fastcheck** (workflow `fastcheck`, manual + every 6 h) loads real wallets on the live site in view-only mode, replays the full game to the same block and lists every difference (pets, gear, before-signing checks). Run it after any change to the loader.
- View-only testing: set localStorage `xcpets-v2-me` to an address (no wallet, nothing can be signed). Clean it up afterwards.

## HatchBot (rebuilt Nov 22, 2026)
The old bot ran on the VPS with headless Chrome and was removed Nov 18. Now: `hatchbot/announce.js` + workflow `hatchbot` (every 10 min, replays and posts cool events; run by hand with a message = "Post update"); `hatchbot/worker.js` on Cloudflare Workers + workflow `hatchbot-worker` (/meme, /chainday, /bug, /help; /rate removed by owner). /bug reports land as GitHub issues labelled `player-bug`. Secrets (GitHub): TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID. Memory of posted events: branch `hatchbot-state`.

## Owner decisions
- Discard is permanent (on-chain pet:hd) by default; browser-only hide is the fallback when the player cancels.
- The rollback/pause after the missed blocks lives in the rules: never roll the code back to before the construction banner.

## Recent work (live as of Nov 21, 2026)
- #83 unleash owner check ("zombie owner only")
- #84 no hatch replay after a cache clear; on-chain discards (`hd`) stay hidden
- #85 breed "first pet must be yours" (checkpoint vs view owner tables), newest hatches first, burn log on play.html
- #86 Homer/Chad hybrid display names (label-only, stored names unchanged)
- #87 docs: 14-day dead-pet rule from block 977,026, live halvings and community pet, feed path
- #88 block-hash guard plus the verify worker's sha256 check

## Open ideas
From an outside code review: faster replay (incremental sweeps, about 60 s saved of 109 s), remove string-patch/eval in workers, integer money math, one strict tag decoder, a CSP, move the error beacon to an xcpets.fun subdomain, bundling scripts, fixing stale CI tests, a node-cache watchdog.

## Players
Evan (about 2,200 pets) and Jacob report bugs through the owner.
