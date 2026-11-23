# Load probe

http://localhost:8765 · fast network · **server world blocked (in-browser rebuild)** · 2026-11-22T20:26:39.052Z

| Page | Wallet | Own pets in world | Pet drawn | All pages | Living pets (pages) | Downloaded | Requests | Heap | Errors |
|---|---|---|---|---|---|---|---|---|---|
| play.html | bc1pfvkp…3gqd | – | – | 25.4 s | 0 | 7.53 MB | 147 | 16 MB |  |

## Freezes and blank pictures

Long task = the page could not react for that long. Chrome shows 'Page Unresponsive' when one runs for many seconds.

| Page | Wallet | Long tasks (load) | Blocked total | Longest | Over 1 s | Blank pictures on screen at end | Scroll: long tasks / longest | Scroll: blank after 0.25 s / 1 s (of shown) |
|---|---|---|---|---|---|---|---|---|
| play.html | bc1pfvkp… | 1 | 0.1 s | 0.1 s | 0 | 0 of 0 (0 cards) | 0 / 0.0 s | 0 / 0 (of 0) |

## Where the main thread went (CPU profile, self time)

**play.html · bc1pfvkp…** files: js/v2-chain.js 78 ms · collector) 33 ms · js/v2-rules.js 26 ms · js/v2-tutorial.js 25 ms · js/ux-polish.js 22 ms · js/v2-zap.js 18 ms · (native) 18 ms · js/pet-core.js 13 ms · js/v2-intuitive.js 11 ms · js/xc-select.js 8 ms · js/v2-look-picker.js 7 ms · rjs/pet-core.js 6 ms

- 33 ms (garbage collector) ((garbage collector))
- 28 ms fnv js/v2-chain.js:29
- 20 ms (anon) js/v2-rules.js:7
- 19 ms phone js/ux-polish.js:4
- 18 ms (anon) (native)
- 15 ms fmt js/v2-tutorial.js:28
- 14 ms (anon) js/v2-chain.js:186
- 13 ms inSigOf js/v2-chain.js:30
- 11 ms fence js/v2-zap.js:12
- 11 ms (anon) js/v2-intuitive.js:215
- 7 ms tick js/v2-look-picker.js:127
- 6 ms applyStale js/v2-chain.js:302
- 6 ms (anon) rjs/pet-core.js:18
- 6 ms RegExp: ^[0-9a-f]{64}$ (RegExp: ^[0-9a-f]{64}$)
- 6 ms place js/xc-select.js:198
- 5 ms querySelectorAll (querySelectorAll)
- 4 ms appendChild (appendChild)
- 4 ms render js/pet-core.js:1574
- 4 ms (anon) js/v2-tutorial.js:5
- 4 ms (anon) js/pet-core.js:15
- 4 ms (anon) js/v2-chain.js:53
- 4 ms powOk rjs/chain.js:183
- 3 ms paint js/v2-tutorial.js:63
- 3 ms placeSprite js/pet-core.js:1535
- 3 ms (anon) js/v2-page-split.js:10


## Where the bytes go

**play.html · bc1pfvkp…** scripts 4.68 MB (113) · feed: boot.json 2.49 MB (1) · other 0.24 MB (18) · fonts 0.11 MB (6) · images 0.01 MB (8) · feed: meta.json 0.00 MB (1)

Biggest: api/boot.json 2.49 MB · js/v2-rules.js 0.82 MB · js/v2-rules.js 0.82 MB · js/v2.js 0.33 MB · js/v2-render.js 0.31 MB · js/pet-core.js 0.13 MB · js/pet-core.js 0.13 MB · rjs/pet-core.js 0.12 MB

