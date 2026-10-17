# tools/ (dev only, not used by the site)

## replay-check.js — deterministic replay hashes

Replays XCPETS burns with this repo's rules in Node (no browser), in the same script order as `play.html`, and prints stable hashes.

```
node tools/replay-check.js                          # working tree, default snapshot, its tip
node tools/replay-check.js --tip 971785             # replay only burns at or below a tip
node tools/replay-check.js --compare <git-ref>      # ref vs working tree at the same tip: SAME / SAME (names aside) / DIFF + summary
node tools/replay-check.js --snap tools/snapshots/snap-N.json ...
NODE_PATH=/path/to/node_modules node tools/replay-check.js --fetch   # new snapshot from xcpets.fun (needs puppeteer-core + Chrome; CHROME=path)
```

- **Snapshots** (`tools/snapshots/snap-<tip>.json`: `{ tip, rows, hashes }`) are the burns + block hashes the live site had loaded, so results are reproducible offline. `js/block-hashes.js` is merged in the same way as `v2-chain.js`.
- **Hashes:** 32-bit FNV-1a over canonical JSON (sorted keys). `overall` = pets + items + community + fights + breedReqs; `pets`; `gear` (all owned items); `gear(no names)` drops every `label`, so display renames don't count.
- **Exit codes:** 0 = SAME or SAME (names aside), 1 = DIFF, 2 = error.
- The `--compare` run uses `git show <ref>:<file>` for the rule scripts only. Pages and render code aren't replayed.
- **Baseline** (snap-971786, `--tip 971785`, HEAD 4cd71fd): overall 29de517d, pets e9142e68, gear a1b2fb31, gear(no names) a02bc2a7. The browser-style Java hashCode of `JSON.stringify(w.pets)` is 2645719896, the same as the live page.
