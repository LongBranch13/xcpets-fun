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
