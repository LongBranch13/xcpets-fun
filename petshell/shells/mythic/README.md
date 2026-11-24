# Mythic sprites for the Pet Shells

Jake (Nov 24 2026): the shells use the **Mythic** look. Each PNG is a real Mythic pet of that species, drawn by `js/pet-core.js`
(`render(pet, {stage: 5, frame: 0, gearOverride: {}})`, so no gear), with the background removed: every pixel that differs from
the same render with `bgOnly: true` is the pet. The drop-shadow row (row 29 and below) is cut off.

| File | Pet | Made from |
|---|---|---|
| `pepe.png` | Pepe, hand-to-chin pose, blue tee | `PetCore.generate({blockHash: sha256Hex('m4'), petId: 5})` |
| `bobo.png` | Bobo, red eye mask, red tee | `PetCore.generate({blockHash: sha256Hex('m36'), petId: 37})` |
| `dodo.png` | Dodo, grey with red marks | `PetCore.generate({blockHash: sha256Hex('m404'), petId: 405})` |

`make_shells.py` draws each head from these pixels, adds the body (a straight tee for Pepe and Bobo, a round belly for Dodo),
arms or wings and legs, then puts a one-pixel gold Mythic rim round the whole outline.
