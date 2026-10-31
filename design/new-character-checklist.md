# New character checklist (art and breeding fit)

Use this for every new root species or 1-of-1 before its gate is set. It sits next to
`design/community-pet-checklist.md` (launch rules); this one is about how the pet looks and breeds.
Run everything offline. Gates stay `null` until the owner approves a deploy.

1. **One sprite, every stage.** Stages 0-5 drawn in one sprite file, loaded on every page that loads the
   other sprites. Each stage has a clear eye key, mouth key and outline; blink frames still read as the same face.
2. **Run the cross-sheet.** `node tools/cross-sheet.js <species> [outDir]` (add `--fix` to include the
   hybrid-audit fix gate). It renders the new body with every root's colours and parts, every body wearing the
   new character, stages 1-5, and writes `flags.txt`. Exit code 1 = a hard flag. Fix or explain every flag.
3. **Parts it donates.** Add a `HYBRID_PARTS` entry (or say in the PR why it donates nothing). Each part
   must show (no "not visible"), must not float, and must not cover the eyes or mouth of the body it lands on.
4. **Parts it receives.** Hats, ears, horns and hair must sit on its real head top at every stage, including
   bob frames where the head touches row 0. Eye parts replace its eyes; beards sit under its mouth.
5. **Colours.** Its palette must read on every body (no "donor barely visible", no dark fill, enough
   fill vs outline contrast). Check the glitch, frost, socks and odd-eye variants on the sheet.
6. **Dynast anchors.** `node tools/cross-sheet.js --dynast [outDir]` must stay at 0 hard flags with the new body
   in the list: archmage lasers leave from its real eyes, don shades sit on its real eyes, the pigeon rests on
   top of its head, the football stays clear of the body, nothing touches the badge corner. If its eyes are
   drawn in ink or it is a side-on face, add a line to `DYNAST_BODY` in `js/v2-rules.js` (`face: -1 / 1`).
7. **Look at the grid.** Build the labelled grid from `dynast-grid.json` and look at every row. The check catches
   placement; only eyes catch "looks wrong".
8. **Rare tiers and marks.** Chimera, Heirloom, Seraph, Gravekin and Gemini marks, plus the Bo / Rarepigeon
   marks, must sit on its silhouette and keep its face clear. No fire aura, flame crown or gold frame.
9. **Replay and hashes.** With its gate `null`: `node tools/run-tests --jobs 1 --replay-base origin/main`
   passes (known failures only) and replay is SAME on the standard snapshots; every live pet hashes the same.
10. **Previews for the owner.** 1080px wide sheets in the site look (Press Start 2P for titles, Bangers for
   meme text, VT323 only for small labels; write "times", never "x"), before and after where art changed.
   Preview only: no merge, deploy, post or sign until the owner says go.
