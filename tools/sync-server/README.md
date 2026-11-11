# xcpets-sync

One-shot chain read and a pre-built pet world. On `xcpets.fun` and `www.xcpets.fun`, `js/v2-boot-sync.js` uses `https://node.xcpets.fun`. That default is not in `rjs/config.js`. `?sync=<base>` and localStorage `xcpets-sync` override it. `?sync=0` and `?sync=off` turn it off. Other origins stay on today's chain read unless one of those overrides is set.

verify-pet.html never uses the snapshot world. It still rebuilds locally. Practice pages do not load the boot file.

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

`XP_SNAPSHOT=0` skips the pet-world build. With snapshots left on, the first ready tip is replayed in a child process (about a minute) and then published at `/xp/v1/world/latest.json`. Desktop-class browsers re-check that world in the background. verify-pet.html never uses it; that page always replays locally.

Compose and broadcast are unchanged and are not served here. This process answers GET, HEAD and OPTIONS only.
