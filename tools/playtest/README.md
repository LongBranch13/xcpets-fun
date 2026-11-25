# Play-test robot

Plays XCPETS like a player, on a phone screen and a desktop screen, against a local copy of the game, and reports what breaks.
Nothing is ever signed: a pretend XCP Wallet records each burn the page asks for, and a pretend chain on your machine mines it.
Nothing reaches xcpets.fun or the game server.

## Run it

```
node --max-old-space-size=6000 tools/playtest/rig.js &        # builds the world from api/boot.json (2-3 min), prints "ready"
node tools/playtest/run.js                                    # every flow, phone + desktop
node tools/playtest/run.js --sizes phone --flows hatch,feed   # just some
```

Options: `--wallet <address>` (default Evan's big wallet), `--shots` (save a screenshot per step), `--out <dir>`
(default `previews/playtest`, git-ignored), `--freeze <ms>` (default 1000).

## What it checks

- **open**: My Pets count against a full replay of the rules (the referee, `oracle.js`), every hatch price and the Fire Sale banner.
- **hatch**: one egg + a pack, the burn amounts against the rules, mines them in one block, waits for the eggs to show
  without a reload, the box reveal or pill, and the list after a reload.
- **select**: Select all, Discard selected, Cancel. Nothing may be burned and no pet lost.
- **feed**: Daily chores / Feed hungry. Mines the burns and checks the referee says every pet it paid for actually ate.
- **grinder**, **petpage**, **gift**, **places** (every page loads, buttons reachable, Pantheon draws).

Every step fails on: a freeze over 1 s, a script error, a pop-up that never opens, a button covered by something else,
a price that differs from the rules, a result that never shows.

## Known findings

`allow.txt` lists findings that may show up without failing the run, each with who owns the fix. Remove a line when it is fixed.

## CI

`.github/workflows/playtest.yml` runs it on every pull request that touches pages, styles or scripts (phone and desktop in
parallel). Screenshots and `report.json` are attached to the run. Quick guards for the bugs it found are in
`tools/playtest-fixes-test.js`.
