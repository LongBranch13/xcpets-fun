# xcpets-sync

One-shot chain read and a pre-built pet world. On `xcpets.fun` and `www.xcpets.fun`, `js/v2-boot-sync.js` uses `https://node.xcpets.fun`. That default is not in `rjs/config.js`. `?sync=<base>` and localStorage `xcpets-sync` override it. `?sync=0` and `?sync=off` turn it off. Other origins stay on today's chain read unless one of those overrides is set.

verify-pet.html never uses the snapshot world. It still rebuilds locally. Practice pages do not load the boot file.

A published snapshot may be up to 8 blocks behind the page. The page can apply just those missing blocks and store that world, and farther behind than that it rebuilds locally. The same build also writes a split view beside the world (`view/summary.json`, `view/o/<shard>.json`, `view/p/<shard>.json`): counts, community and Cold Storage, each owner's pets, and per-pet detail. Pages paint from that view and do not reindex the full world. A snapshot more than 8 blocks behind, or a missing view, uses today's replay. The **Verify** button runs that full replay on demand. The builder process is capped at `XP_SNAPSHOT_HEAP` (default 1536 MB) and must stay under 3 GB.

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
