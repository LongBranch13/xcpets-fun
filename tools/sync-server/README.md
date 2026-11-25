# xcpets-sync

One-shot chain read and a pre-built pet world. On `xcpets.fun` and `www.xcpets.fun`, `js/v2-boot-sync.js` uses `https://node.xcpets.fun`. That default is not in `rjs/config.js`. `?sync=<base>` and localStorage `xcpets-sync` override it. `?sync=0` and `?sync=off` turn it off. Other origins stay on today's chain read unless one of those overrides is set.

verify-pet.html never uses the snapshot world. It still rebuilds locally. Practice pages do not load the boot file.

A published snapshot may be up to 144 blocks (about a day) behind the page. The page can apply just those missing blocks and store that world, and farther behind than that it rebuilds locally. The same build also writes a split view beside the world (`view/summary.json`, `view/own/<sha256>.json` in pages of 24 pets, `view/p/<shard>.json`): counts, community, Cold Storage, WAGMI check-ins, the first page of each owner's pets, and per-pet detail. The manifest keeps owner counts and keys only, not every pet. Pages paint from the summary and the owner's first page, then fetch the rest. They do not download the manifest before the first paint. After that paint a worker decodes the snapshot and applies the missing blocks. Burns stay closed until that check finishes. A snapshot more than 144 blocks behind, a rules mismatch, or a missing view uses today's replay. The builder process is capped at `XP_SNAPSHOT_HEAP` (default 1536 MB).

The builder runs when the published snapshot is at least `XP_SNAPSHOT_EVERY` blocks behind (default 6), skips a build that is already running, and is capped at `XP_SNAPSHOT_HEAP` MB (default 1536) so it cannot grow to the multi-gigabyte peak that pushed the small server into swap. Upstream reads time out after `XP_FETCH_MS` ms (default 15000). Behind Caddy, the per-address limit uses `X-Real-IP`, then `X-Forwarded-For`. Snapshot part downloads are not counted. Only one chain follow runs at a time.

## Preview on this machine

The service reads the two public Core nodes unless `XP_UPSTREAMS` lists something else. A loopback read proxy, if you have one, is an environment value only. Do not put its address in the repo.

```bash
# optional: seed hashes and the sale base from the published feed, then catch up from Core
curl -fsSL -o /tmp/xcpets-boot.json https://xcpets.fun/api/boot.json

XP_PORT=8787 XP_BOOT_CACHE=/tmp/xcpets-boot.json XP_DATA=/tmp/xcpets-sync \
  node tools/sync-server/index.js
```

In another shell, serve this branch:

```bash
python3 -m http.server 8765
```

A page that still has the published feed copy asks for a delta first. Those saved rows are not byte-identical to a fresh Core read, so that check fails closed and the page asks once for the full sync answer before it will use today's multi-call path.

Open a chain page with the flag, for example:

`http://127.0.0.1:8765/play.html?sync=http://127.0.0.1:8787`

Health: `http://127.0.0.1:8787/xp/v1/health`

`XP_SNAPSHOT=0` skips the pet-world build. With snapshots left on, the first ready tip is replayed in a child process (about a minute) and then published at `/xp/v1/world/latest.json`. The same build writes a compact grave index beside that world. `GET /xp/v1/graves?page=&per=` returns one page (24 or 60 rows) plus the counts at `GET /xp/v1/graves/counts`. Cemetery uses that index when this sync base is on, and still paints one page from memory when it is not. Desktop-class browsers re-check that world in the background. verify-pet.html never uses it; that page always replays locally.

Compose and broadcast are unchanged and are not served here. This process answers GET, HEAD and OPTIONS only.

## Follows main by itself (Nov 22 2026)

The world builder no longer depends on the rule files someone copied onto the server. Every 3 minutes (`XP_RULES_EVERY_S`) the service asks GitHub for main's newest commit. When main moved, it downloads the builder's files at that exact commit (rule files, replay worker, `js/v2-sales.js`, `js/v2-art.js`, `tools/sync-server/*.js` and every repo file they name) into `<XP_DATA>/code/<sha12>/`, checks that each script parses and that `snapshot.js` loads, and points `<XP_DATA>/code/current.json` at it. The builder then runs `snapshot.js` from that copy, so the published world has the same rules signature (rsig) as the pages main serves. When the rsig changes it builds right away instead of waiting 6 blocks. Any failure keeps the previous copy. `XP_RULES_FOLLOW=0` turns this off. `/xp/v1/health` shows `rules` (commit, rsig, failures) and `worldRsig`. The service process itself (chain follow, HTTP) is still updated with the server-repair workflow.

Each rsig also keeps its own pointer, `/xp/v1/world/<rsig>/latest.json`. During a rules change, pages that still run the previous rules keep finding the previous world there instead of rebuilding everything in the browser.

## Never freeze (Nov 24 2026)

Nov 23 2026 the follower sat at 977,257 for hours. Two causes, both silent:

- **A read that never ended.** Every upstream timer stopped once the headers arrived, so an answer that stalled mid-body (the Tor link to the game's own node does that) left `r.json()` waiting forever. The follow loop runs one step at a time, so nothing else ran: no new blocks, no builds, no rules checks, no log line. Now `net.js` `timedFetch` and `tools/lib/core-limiter.js` read the whole body under the same timer (the feed uses the limiter too).
- **Out of memory, 9 times in 3.5 hours.** Each restart began again from the boot file (the feed's, itself stuck), so the same catch-up ran every time. `js/v2-sales.js` kept every answer in memory forever, and so did the service's emulated localStorage; both are now bounded.

What keeps it moving now:

- **Stall guard** (`XP_TICK_MAX_MIN`, default 10): a follow step that runs longer writes `stall.json` and exits; systemd starts the service again.
- **Resume, don't restart from scratch:** the follower saves `follow-state.json` after every new tip and starts from it when it is newer than the boot file.
- **Listen first:** the HTTP server starts before the rules load, so the published world on disk is served again within about a second of any restart. Builds still publish atomically (pending folder, then rename), so players always get the last good world.
- **Heartbeat in health:** `/xp/v1/health` `loop` = `stepSec` (how long the current step has run), `lastStepAgoSec`, `lastOkAgoSec`, `errors`/`errorRun`/`lastError` (short codes), `restarts1h`/`restarts24h`, `resumedFrom`, `heapMB`/`heapLimitMB`, `lastStall`.
- **On-server watchdog** (installed by server-repair, `sync_watchdog`): every minute it asks health on loopback; 3 misses in a row, or a step stuck 15 minutes, restarts the service. The feed job gets a 40-minute time limit.
- **Outside watchers:** HatchBot's Cloudflare cron (`hatchbot/serverwatch.js`, every 4 minutes) compares the server with the real chain (mempool.space) and sends Telegram alerts to `TELEGRAM_ALERT_CHAT_ID` and to anyone who DMs the bot `/alerts`. `worldwatch` does the same check, opens the `world-alert` issue, and reboots the server through server-restart when it stays down or stuck for 25 minutes (at most once every 3 hours; repository variable `WW_AUTO_RESTART=0` turns that off).

### When every follow step fails (Nov 24 2026)

After the second never-freeze repair the server answered but every step failed with a bare `error`, while the same code followed
the chain from the public Counterparty nodes (`tools/followprobe.js`, workflow `followprobe`: one read-only follow step from
`api/boot.json`, and it prints the live health heartbeat first).

- Health `loop.lastStep` names the step that failed (`tip`, `burns`, `merge`, `hashes`, `sales`, `done` = after the follow), and
  `loop.lastError` names sales-read failures (`sales: ...`) and code faults (`code: TypeError`) by kind only. The journal line
  `sync tick failed (...)` carries the full message with upstream addresses, onions and IPs removed.
- Public fallback: when the configured nodes fail 6 steps in a row the follower reads from the public nodes and stays there,
  trying its own nodes again every 30th step (`loop.fallback` in health). `XP_PUBLIC_FALLBACK=0` turns it off.
- Found with `lastHint` (Nov 24 2026, 02:40 UTC): "new pet tokens could not be read (every Counterparty node failed)". The never-freeze
  change had put the whole body under the 15 s request limit, so the sales read's big 1,000-row issuance pages timed out on the
  server (GitHub's faster network read them fine), and js/v2-sales.js then marks those nodes dead for the life of the process. Now
  the body has its own idle limit (`XP_BODY_IDLE_MS`, 30 s without a byte; `XP_BODY_MAX_MS` 5 min in all), and after 4 sales
  failures in a row the service restarts itself for fresh node state (`XP_SALES_RESTART=0` turns that off).
- After PR 218 the hint stayed "new pet tokens could not be read" even right after a restart, so it is not only the dead-node marks.
  The sales read now gives heavy pages 60 s for the headers (`XP_SALES_FETCH_MS`), records each failed sales request per node in
  health `loop.salesNet` (public API host names only, else `other`; `http 429`, `headers timeout`, `body idle timeout`, error code),
  and adds the game's own node (`https://node.xcpets.fun/v2`, the pages' read path) as the last read source (`XP_SALES_CACHE=0`: off).

## Burn check keeps answering between blocks (Nov 25 2026)

Before a burn, fast pages ask `POST /xp/v1/check`, and use the answer only if it comes from a world at the newest block. Each new block used to make the check service (`checker.js`) drop its world and load the whole checkpoint again, which took tens of seconds with no answers. Burns pressed in that gap fell back to the slow check on the player's own device, and XCP Wallet took a minute or more to open. Now a new block only resumes the replay on the world already in memory, applying the burns after its tip (`advance`, about 1.5 s on the real world). The result is the same world as a full replay (`tools/server-check-test.js`). It still does a full load after each world build, after a reorg or re-read under its tip (rows and hashes fingerprint), after more than `XP_CHECK_ADVANCE_MAX` (12) blocks, or when an advance fails. `XP_CHECK_ADVANCE=0` restores the old behaviour. Health `check` shows `advances`, `advFails` and `advanceSec`. The check service still stops during world builds, because of memory. This reaches the server through a server-repair run.

## Pet share links (Nov 24 2026)

`GET /xp/v1/pet/<id>` is the link the site's Share button and the Telegram mini app hand out. It is a tiny page with the og/twitter tags X and Telegram read for the link preview, then it sends people on to `https://xcpets.fun/pet.html?id=<id>`. Its og:image is `GET /xp/v1/pet/<id>.png`, a 1200x630 card drawn by the burn check service (`checker.js` asks `card.js`, which draws the pet with the site's own renderer through `hatchbot/art.js`). `share.js` keeps cards in `<XP_DATA>/cards/` (redrawn after 3 hours, at most 2 drawn at once, 6,000 kept) and serves the copy on disk while the check service is busy or between builds; with no card at all the picture redirects to the site's generic `img/og.png`. `hatchbot/art.js` and the sprite scripts come with the server-repair install (not the rules follower, because every followed-file change restarts the service), so a new species or sprite reaches the cards with the next server-repair run.

## World copy on Cloudflare (Nov 25 2026)

A second, independent copy of the published world, so a dead, frozen or out-of-memory game server no longer means a slow load.

- **Built on GitHub** (`tools/world-copy.js`, workflow `world-copy`): the follower in this folder reads the chain from `api/boot.json` to the tip on the public Counterparty nodes, then `snapshot.js` builds the world with main's rules, exactly as the server does. GitHub's free 16 GB runners do it in a few minutes. It runs after each feed push and every 30 minutes, and builds only when the copy is 6+ blocks behind or has no world for main's rules (so a rules change gets its world even while the server is still building).
- **Stored on Cloudflare** (`cloud/world/worker.js`, R2 bucket `xcpets-world`): one world = one pack of every file gzipped back to back plus a text index (every world file carries its tip, so worlds share no bytes; a pack keeps a world at about 5 writes instead of ~7,000). The Worker serves the server's own paths (`/xp/v1/world/latest.json`, `/<rsig>/latest.json`, `/<rsig>/<tip>/<file>`) with a ranged read of the pack. It keeps 3 worlds for each of the 2 newest rules signatures. About 31 MB per world (Nov 25 2026): inside R2's free tier.
- **Used by pages** through `sw.js`: for a `latest.json` asked of `node.xcpets.fun` it also asks the copy and hands the page the copy's answer when the server does not answer (6 s), answers with an error (no world for these rules), or names a world 6+ blocks older than the copy's for the same rules. The copy's `manifest` is an absolute URL, so all files of that world come from the copy, never mixed with the server's. `COPY` in sw.js is the Worker's address (empty = off). Pages without the service worker yet (a first visit) do not use the copy.
- Burns still need the server: the burn check and `/xp/v1/sync` are the server's. With the server down, pets and pages load from the copy and the bar says the check did not finish.
- Local test: `node tools/world-copy-test.js` (the Worker on an in-memory bucket; `WORLD=<dir>/<rsig>/<tip>` also copies a real world). Browser check Nov 25 2026, server unreachable, 6,000-pet wallet: first pets in 2.6 s with the copy, 58.8 s without.
