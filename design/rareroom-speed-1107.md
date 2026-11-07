# Rare Room loading investigation — Nov 7, 2026 CST

Base: origin/main 438e2dcc. Branch: rareroom-speed-1107. Not deployed.

## Findings
- Rare Room is rare-room.html. Spam City is shop.html.
- Live document HTTP transfer (curl, one sample each): Rare Room 0.197756 s / 44,640 bytes; Spam City 0.166910 s / 12,095 bytes. These are document-only measurements, NOT browser ready times or a demonstrated before/after speedup.
- Shop uses a much smaller dedicated sales shell. Only looks + renderer are inserted after V2Mock.boot. The Rare Room uses the full game shell: 43 post-boot modules, 1,358,508 uncompressed local bytes, inserted only after verified-world boot finishes.
- Historical smooth-perf (d5526990/a90e4a2b) introduced worker replay, shared IDB world cache, and fetching post-boot scripts ahead of the boot barrier; token-press-speed-1104 a41e4621 additionally sliced sprite painting and removed early-station reloads. Both inform this change; it does not assume their full gains transfer to the Rare Room.
- Rare Room had just seven prefetch elements, one malformed (two URLs in one tag); most of its post-boot files had no early fetch hint. This exposes a second network phase after chain/replay readiness. It is a concrete scheduling defect, not yet proven the dominant real-user bottleneck.
- The page images are small theme sprites, mostly loading=lazy. No image or API behavior changed. Existing shared API/cache/freshness/worker code is retained; no calls to prohibited endpoints were made by this investigation.

## Patch
Replace the incomplete Rare Room prefetch list with one low-priority script preload for each existing post-boot URL. Downloads can overlap chain/worker work. Modules still execute only in the original V2Mock.boot callback, in the original async=false order. No gameplay, freshness checks, cache keys, assets, features, or transaction code changed.

## Verification
node tools/rareroom-speed-test.js: PASS (same modules/order, complete valid head hints, files exist, all non-hint HTML identical, four rule files byte-identical to base).
Replay comparison against 438e2dcc prints SAME on 971786, 972883, 972901.
Four rule MD5s match base: c7fa5a442e0405cebc738c98c5f15027 / f0415aa900a2151c31102f09a9753e78 / 47be652fe0a5dd6157a95f5b2c6585fa / 36734cff209497808af0142e2510630d.

## Still required before recommending deployment
Browser waterfall/profile and cold/warm ready-time measurements before/after on phone/desktop, using the same wallet/cache/network state. No browser profiler/subagent tool was exposed to this executor. Box-desktop policy prohibits direct Shell-driven Playwright/CDP browser operation, so none was attempted. A document curl timing cannot substitute for this evidence. Also verify preload priority does not regress initial critical scripts on slow mobile networks. This remains a candidate patch, not a measured performance success.
