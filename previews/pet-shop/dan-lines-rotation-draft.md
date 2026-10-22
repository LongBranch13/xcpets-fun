# Captain Dan line rotation: DRAFT (Oct 19, 2026 ~10:50 PM CT), awaiting owner approval

Branch `dan-rotation` (from main 337fc8e, build ee192e6a23). NOT deployed.

## The rotation system (built on the branch)
- `data/dan-lines.json`: groups `core` (48 lines), `dank` (7, live since build ee192e6a23), `cpnews` (empty), `mined` (empty).
  Each line is `{text, added, expires?}` (local date, YYYY-MM-DD). A line shows from `added` and hides from `expires` on its own.
- Slots: line n = `core[n % core.length]`, unless a slot group claims it and has active lines:
  `dank` every 12 at 11 (same as live), `cpnews` every 12 at 5, `mined` every 12 at 8.
  Empty or fully expired groups fall back to core, so with cpnews/mined empty the output is identical to live
  (checked: lineAt(0..2999) identical to xcpets.fun build ee192e6a23).
- js/v2-shop.js fetches the JSON (cache-busted with the build ?v=); until it loads Dan says 'gm from the farm!' (core line 1).
- To ship news: approve lines below, paste them into `cpnews` / `mined`, bump build id. To refresh news later: edit the JSON only.

## Draft cpnews lines (Counterparty news, last ~30 days; verified Oct 19, 2026 ~10:45 PM CT; no price talk)
Suggested `added` 2026-10-20, `expires` as listed.

| # | Line | Source | expires |
|---|------|--------|---------|
| 1 | Core v11.5.0 docked Sep 30. Upgrade! | https://github.com/CounterpartyXCP/counterparty-core/releases (v11.5.0, 2026-09-30) | 2026-11-15 |
| 2 | Taproot sweep bug squashed, matey | same release: fix for taproot/P2WSH reveal attribution (GHSA-q27c-r246-f6qw) | 2026-11-15 |
| 3 | v11.4 rules live at block 971,700 | https://github.com/CounterpartyXCP/counterparty-core/releases (v11.4.0, 2026-09-18; activation ~Oct 17) | 2026-11-15 |
| 4 | MPMA sends hit Taproot shores now | v11.4.0 release: `mpma_taproot_support` at mainnet 971,700 | 2026-11-15 |
| 5 | Horizon's going mobile, me hearties | https://horizon.market/blog ("Horizon Mobile Wallet for Counterparty, Ordinals and ZELD", Sep 14, 2026: app submitted to App Store / Google Play; 5 days before the 30-day window, not confirmed released) | 2026-11-01 |
| 6 | XCPETS graduated on XCP.fun! | https://xcp.fun/ (XCPETS listed under Graduated, "9d ago" on Oct 19) | 2026-11-19 |
| 7 | 22 coins graduated on XCP.fun! | https://xcp.fun/ ("Graduated 22", Oct 19 10:40 PM CT; count goes stale) | 2026-10-27 |
| 8 | Counterparty says: Very cool. Arr! | https://x.com/CounterpartyXCP/status/2110634670513914269 (@CounterpartyXCP to @XCPets, Oct 15, 2026) | 2026-11-15 |
| 9 | 60 Satoshi faces? CUBISM NAKAMOTO | https://x.com/CUBISM_NAKAMOTO/status/2109262992252784899 (60 Cubist portraits on Counterparty, Oct 11, 2026) | 2026-11-15 |
| 10 | HONDACIVIC races every 144 blocks | https://xcp.fun/ (HONDACIVIC description: "race every 144 blocks"); https://x.com/XCP_Billboard/status/2109059497641816197 (Oct 10) | 2026-11-19 |

Not used: Counterparty Website issue "Add XCP.FUN to Marketplaces" (github.com/CounterpartyXCP/Website/issues/37, Sep 21; open issue, not news yet); v11.5.0 credits "Dan Anderson (vulnerability report, XCP Wallet)" (not confirmed to be the same person as Captain Dan, so left out).

## Draft mined lines (repo / brief / memory-facts / design docs; none duplicate existing Dan or Gooby lines)
Suggested `added` 2026-10-20, no expiry.

| # | Line | Source |
|---|------|--------|
| 1 | XCPETS started with a Honda Civic | PROJECT_BRIEF "Origin rule: Honda Civic" (owner 8:37 PM CT) |
| 2 | HONK! Civic drive-by in the sand | brief tonight bundle; js/v2-arena-fun.js EVENTS 'civic' (HONDACIVIC tribute) |
| 3 | Lions at the Kekimus gate, arr! | js/v2-arena-fun.js EVENTS 'lion' (lion gate) |
| 4 | Three wins straight earns the belt | brief: display-only title belt at 3+ straight wins |
| 5 | Gooby's got a key with yer name | brief: Gooby cameo peeks over the wall holding a motel key |
| 6 | Tell Gooby pls from Captain Dan | Gooby's No-Tail Motel (brief 9:50 PM CT rename; Gooby's 'pls' lines) |
| 7 | Nakamoto: 1 in 777. Hunt on! | brief: Nakamoto hatchable, 1 in 777, always Legendary |
| 8 | Nakamoto's napping in Cold Storage | brief: The Return, Nakamoto into Cold Storage (archive) |
| 9 | The Return fired at block 971,632 | brief decision log: The Return fired at block 971,632 |
| 10 | Feed the Bitcoin Wizard, crew! | brief: Bitcoin Wizard is the community pet; every XCPETS burned feeds it |
| 11 | Mix breeds: 68.4773435% hybrids | brief: hybrid 68.4773435% (approved Oct 16 00:15) |
| 12 | 13 species aboard this ship | brief section 2: 13 species incl. Nakamoto |
| 13 | Kilnling was the first egg idea | brief: Kilnling, the original fire-kiln community pet (Oct 8), superseded |
| 14 | Feed daily or it's the Cemetery | brief: dies after 7 full days unfed -> Pet Cemetery |
| 15 | Mythic pets never starve, matey | brief: Mythic pets never starve |

Check before approval: #13 reveals a superseded design (owner may prefer to keep it private); #11 is a chance number (not price).
