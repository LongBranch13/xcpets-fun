# Gear fit, phase 2

Display only. `js/v2-rules.js` was not edited. Replay hashes stay the same because the fit code runs when a sprite is drawn, not when a burn is replayed.

Peepo is the reference. Other species get their own anchor or scale only where the audit flagged them.

## Peepo

- Nose rings use the dark-green nostril dots (`#2d5b18`), the pair closest to the red mouth. The hoop's bottom row sits on that row.
- The diamond stud is a 5px stone instead of 2px, on the same dots.
- Hats and crowns sit two rows above the eye whites and are scaled to about 86 percent. Tall hats shrink further so the ink outline stays inside the frame. Party hat and pimp hat no longer touch the top row at Mythic.
- The pink happy band is drawn on the top of the head, not on the scarf row.

## Other species

- Wojak, Mumu: hats scaled to 85 percent and lifted so the brim clears the eyes without leaving the frame. Bands sit on the top of the head.
- Chud, Chad, Snibby, Doge: bands sit on the top of the head instead of across the eyes.
- Dodo: tin and gold crowns lift two rows.
- Kevin, Nakamoto: headbands leave the neck and sit on the top of the head. Nakamoto's core red scarf is unchanged (it was already a scarf).
- Sarutobi: the feather cap is scaled to 58 percent so the feathers fit in the frame.
- Doge, Pepe, Mumu, Lenny: the gold nose ring moves up off the mouth. Doge's moves onto the black nose.
- DJ Pepe, Orange Dragon: the nose ring moves down.
- Peepo, Bobo, Snibby, Doge: the gold grill moves down onto the mouth.
- Snibby and Doge outfits stop five rows below the eyes, so the chest piece stays off the face.
- Held pieces that were touching the left or right edge move in by one pixel.
- Lord Kek: the nemes stays. A worn head piece is drawn on the row above it. A scarf draws at the neck.
- Viking: a worn head piece draws on the helmet rim. A nose ring draws on the nose guard. A scarf draws at the collar.
- DJ Pepe: headphones sit on the cap instead of over the eyes. Any other head piece uses the same cap anchor. A nose ring is a small hoop under the eyes. A scarf draws on the shoulders.
- Bo Jackson and Rarepigeon: headwear sits on the head top instead of two rows above the frame.
- Old Hickory and Star-Lord: headwear sits one row higher.
- Wizard headbands sit on the hairline. A scarf sits at the shoulder.

## Left alone

- Snibby's nose ring stays on the eyestalks. The face below the stalks does not accept the hoop, so moving it down erased it.
- Capes that touch the frame stay as drawn. They are wider than 32px on purpose.
- Funtrump's skateboard and Homer's slippers still meet the bottom edge. Pulling them up would lift them off the feet.
- Wojak, Chud, and Chad nose rings stay on the lower cheek. Those faces have no nostril pixels.
- The floppy Wizard hat keeps its designed tip. Only the separate headband and scarf anchors moved.
- 1-of-1 nose rings that the sprite still draws as a single pixel stay that way when a hoop would cover the mask or the beak. Kek, Viking, DJ Pepe, and the contest bodies that match "nose" now get a small hoop.
