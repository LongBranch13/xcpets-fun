# XCPETS – notes for Claude

## What it is
XCPETS is an on-chain pet game on Bitcoin/Counterparty. Players burn XCPETS tokens with text tags (e.g. `pet:hatch`, `pet:breed:A:B`, `pet:feed:ID`); the game state is rebuilt by replaying every burn from the chain in order. Site: https://xcpets.fun (GitHub Pages). Repo: https://github.com/LongBranch13/xcpets-fun (deploy = merge to main; Pages publishes in ~1-3 min).

## Rules
1. Never sign burns or transactions. Never handle wallet keys.
2. Never put secrets, the node's onion address or server connection details in code, commits or public posts.

## Useful facts
- Owner's wallet starts `bc1ps9av86`, ends `s26m3s4`. It's very large and slow to load.
- Test wallets: `1JwWsArppwALMEdXWPmpDBcP1jwWsAPYkD`, `bc1qtke38j72qv4d8eljn7pccaykypw8luytfwdn7q`.

## Architecture in one page
- `js/v2-rules.js`: the live rules engine (replay). Huge (~5.4k lines) with `ACTIVATE_*_BLOCK` height gates. Old eras are frozen. New rules are added behind a new activation block. Current MD5 (Nov 21, 2026): `3638b4453d7b9b0c13c59c230f1b118c`.
- `rjs/*`: the frozen engine for burns up to block 971,500. `rjs/chain.js` reads block hashes. It requires a trusted source or two agreeing sources plus a proof-of-work check (PR #88).
- Rules signature (rsig): a hash of the rule files (incl. `js/v2-rules.js` and `rjs/chain.js`). Changing any of them changes the rsig.
- World snapshot: a pre-built world served at `https://node.xcpets.fun/xp/v1/world/latest.json` (+ slim view files: `view/summary.json`, `owners.json`, `rank.json`, `p/000NN.json` shards, `own/<sha256(addr)>.json`). Browsers use it only if its rsig matches the page's rules, otherwise they replay locally (slow). **After any rules or rsig change, the world must be rebuilt.** The old builder ran on the previous assistant's machine. A replacement (VPS cron or CI job) is still needed.
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
