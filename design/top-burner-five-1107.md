# Top burner five (preview)

Five 1-of-1 eggs for the #1 all-time XCPETS burner. Preview only. The gate is off.

## Wallet

`bc1qs88hlk930p8l6h5s2svcrvzd45ny2pn54y0j6n`

Checked 2026-11-08 against Counterparty Core destructions for XCPETS (`api.counterparty.io:4000`, 3,827 valid burns). That address is rank 1 at 13,301,536.65 XCPETS. The site shows the same wallet as `bc1qs8…0j6n`.

## Pets

| Species | Name | Power |
|---|---|---|
| `yeti` | Abominable Snowman | 142 |
| `sasquatch` | Sasquatch | 143 |
| `greypepe` | GreyPepe Alien | 144 |
| `chupacabra` | Chupacabra | 145 |
| `starman` | Starman (suited spaceman, no car) | 146 |

Each is a Legendary egg (`care` 0), `p.supreme` 1 of 1, drawn by `js/topburner-sprites.js` through Egg, Hatchling, Juvenile, Adult, Elder and Mythic (4 frames: rest, bob, blink or visor glint, action). Dead is the grey palette. Risen uses the shared zombie pass. Gear draws on the cap, cape, wrap, boots, hand and glasses without covering the eyes. No fire aura, flame crown, edition gold frame or flame pixels. Babies are normal pets, never a second pure copy.

## What the grant needs to activate

This branch does not merge, deploy or turn the grant on.

`ACTIVATE_TOP_BURNER_FIVE_BLOCK` is `null`. Nothing is granted, and replay of blocks 971786, 972883 and 972901 stays SAME.

Go-live is a later commit, only after the owner says go:

1. Read the Counterparty tip from `api.counterparty.io:4000` and `api.unspendablelabs.com:4000`.
2. Set `ACTIVATE_TOP_BURNER_FIVE_BLOCK` to that tip + 6.
3. Deploy that commit on its own. Do not move the gate in this preview.

Until that block, the five eggs do not exist.
