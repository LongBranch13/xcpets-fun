# Cemetery scene (branch `cemetery-scene`, NOT deployed), Oct 20 2026

Display only. No rule, burn or replay change: replay-check SAME vs origin/main at fresh snapshot 972393 (overall 74594e6a, 18,553 pets). Build 2464994987.

## What it is
`js/v2-cemetery-scene.js` (V2CemeteryScene) draws one 320x180 pixel canvas at the top of cemetery.html, built the same way as the Lair (v2-shop.js), X Circus Kekimus (v2-arena-scene.js) and Gooby's motel (v2-motel.js):
- V2Sharp integer scaling (crisp pixels and 4-6 px Press Start 2P text), 3px black frame + 4px hard shadow, hint bar under the canvas (`.cem-hint`, same as `.shop-hint`).
- RAF loop pauses when the scene is off screen (IntersectionObserver). prefers-reduced-motion gives one static frame (no twinkle, bob, fog drift or bubbles).
- Info is one tap away: tap a headstone, Mort, the altar or the seance circle and a small card (`#cemCard`) opens under the scene. No pop-ups. The grave card shows sprite, name, #ID, species, tier, stage, death block, short owner, buried-gear line, plus **Pet page** and **Find in the list ▾**. The second one drives Part A's Find box, so the scene and the paged list stay one system.
- Page intro text moved into a collapsed "📜 About the cemetery" fold to keep the top clean. The status line, Find box, paged list and Show more (Part A) are unchanged.

## Scene contents
Night sky with stars and moon, hills, bare trees, an iron fence and gate with a PET CEMETERY arch, and a winding dirt path to the altar. The newest 12 graves stand as headstones (RIP + #ID carved, far rows smaller). A faint ghost of each pet floats above its stone, keyed with the arena's magenta-key trick. A gold glint marks a pet buried with gear. A "N REST" signpost shows the full count (1.6K style). Mort the caretaker carries a lantern and says neutral one-liners now and then, or when tapped. Light fog. Empty plots (dirt mounds) and "NO GRAVES YET" show when nobody has died.

## Halloween hooks (dormant)
- **Seance circle** (bottom right): 6 unlit candles round a moon stone. This is the natural place for the "sacrifice gear on your dead pet's grave" seance.
- **Old altar** at the end of the path: a dark carved ring rune.
- `V2CemeteryScene.hooks('lit')` lights the candles (flicker) and makes the altar rune glow green. **Nothing calls it.** The branch is always 'off'. The tap cards say only "Nothing happens here. Yet." / "They won't light. Not tonight." No zombie mechanics, no spoiler copy.
- Later ideas, not built: ghost Commons drawn translucent and floating (the ghost renderer already exists), a gate that only opens for zombies, and a sticky banner from Oct 24 (that belongs to the site banner, not the scene).

## Untouched
Site fonts and look, selection boxes, pickers, the VACANCY sign, Part A paging/find (`js/v2-pages.js` only gains one `V2CemeteryScene.mount(w, dead)` call).

## Files
cemetery.html (scene + card + fold, two scripts added to the boot list: v2-sharp.js, v2-cemetery-scene.js), js/v2-cemetery-scene.js (new), js/v2-pages.js (1 line), css/v2.css (cemetery-scene block), build id.

## Previews
/workspace/xcpets/previews/cemetery-scene/: before-{1280,390}.png (live Part A), after-{1280,390}.png, after-*-tap-grave.png, after-*-tap-seance.png, after-*-empty.png. 15,000 simulated deaths (local only), 0 console errors, no sideways scroll.
