# Zombie meal animation (preview only)

Base: origin/main 7c2dbcd7. Branch: zombie-meal-anim-1107.

- UI/art only. `js/v2-cem-anim.js` reads raw `framesWith` RGBA instead of calling the card/DOM `paint` helper on an offscreen canvas. Uses the actual pet art, real stage, each animation pose and world worn gear, through existing `V2ZombieLook.noHand` / `transparent`.
- Deletes the generic green fallback entirely. Rendering errors are not cached permanently; sprite cache keys include appearance, stage and worn gear and are bounded. With a missing zombie look module, the real species art is preferred to a fabricated body.
- Integer-pixel lunge/chew bob, discarded victim sprites, bone/crumb bursts, filling hunger meter and burp. Chomp and burp text moved into the empty sky, never across faces/bodies. Zero-victim preview now stays finite.
- Existing event collection, memo tags, seen markers, costs and all four rule files unchanged. No hatch/render global changes, gates or page loader changes.

## Verification

`NODE_PATH=/workspace/zmeal-render/node_modules node tools/zombie-meal-anim-test.js [output-dir]`

Offline actual renderer + actual zombie pass, synthetic fixtures based on historical replay. 15 checks: correct species/stage and gear arguments; worn-gear pixel differences; cache invalidation across immutable replay worlds; throwing card painter never used; four distinct species; all 60 frames at 1280 / 390. No browser/page-layout smoke claimed.

Replays compared to base 7c2dbcd7 print SAME at 971786, 972883 and 972901. Four rule MD5s match base. Syntax/diff checks pass.

Previews: `/workspace/xcpets/previews/zombie-meal-anim-1107/` (eight GIFs; stills; contact sheets; README).

No push/deploy. Primary checkout and port 8841 untouched.
