"""Make HatchBot's Telegram sticker and custom-emoji images (Nov 24 2026).

Input: the 70 die-cut pet stickers drawn by the game's own renderer for the merch launch kit
(one folder of <species>-<no|some|full>-gear.png, every image an exact integer upscale of the pixel sprite).
Output (committed next to this file):
  sticker/<name>.png  512x512 transparent PNG, crisp integer pixel upscale, centred  (Telegram regular sticker)
  emoji/<name>.png    100x100 transparent PNG, box-filtered down from the pixel sprite (Telegram custom emoji)

Run: python3 hatchbot/stickers/make-images.py /path/to/launch-kit/stickers
"""
import sys, os, glob, math, json
from functools import reduce
from PIL import Image

OUT = os.path.dirname(os.path.abspath(__file__))

def runs(seq):
    r, c = [], 1
    for a, b in zip(seq, seq[1:]):
        if a == b: c += 1
        else: r.append(c); c = 1
    r.append(c); return r

def native(im):
    """Undo the integer upscale: return the sprite at 1 pixel per game pixel."""
    W, H = im.size; px = im.load(); rs = []
    for y in range(0, H, 7): rs += runs([px[x, y] for x in range(W)])[1:-1]
    for x in range(0, W, 7): rs += runs([px[x, y] for y in range(H)])[1:-1]
    g = reduce(math.gcd, rs)
    sm = im.resize((W // g, H // g), Image.NEAREST)
    return sm.crop(sm.getbbox())

def strip_outline(sm):
    """Remove the merch die-cut border (Jake, Nov 24 2026: "I dont like the white outlines"): the outer dark ring and the
    pure-white band inside it, found by flooding in from the transparent outside. The sprite keeps its own ink outline;
    white parts inside the pet (eyes, teeth) are never reached because the sprite's outline encloses them."""
    sm = sm.copy(); w, h = sm.size; px = sm.load()
    clear = lambda x, y: px[x, y][3] == 0
    out = lambda x, y: not (0 <= x < w and 0 <= y < h) or clear(x, y)
    nb = lambda x, y: ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))
    # 1) outermost ring: opaque dark pixels touching the outside
    ring = [(x, y) for y in range(h) for x in range(w) if not clear(x, y) and sum(px[x, y][:3]) < 150 and any(out(x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1))]
    for x, y in ring: px[x, y] = (0, 0, 0, 0)
    # 2) the white band: pure white pixels connected to the (new) outside
    stack = [(x, y) for y in range(h) for x in range(w) if px[x, y][:3] == (255, 255, 255) and px[x, y][3] and any(out(a, b) for a, b in nb(x, y))]
    while stack:
        x, y = stack.pop()
        if not (0 <= x < w and 0 <= y < h) or clear(x, y) or px[x, y][:3] != (255, 255, 255): continue
        px[x, y] = (0, 0, 0, 0); stack.extend(nb(x, y))
    # 3) leftover specks of the old ring: opaque pixels with no opaque neighbour left
    for y in range(h):
        for x in range(w):
            if not clear(x, y) and all(out(a, b) for a, b in nb(x, y)): px[x, y] = (0, 0, 0, 0)
    return sm.crop(sm.getbbox())

def fit(sm, box, pad, crisp):
    w, h = sm.size
    if crisp:
        s = max(1, (box - 2 * pad) // max(w, h)); big = sm.resize((w * s, h * s), Image.NEAREST)
    else:
        s = (box - 2 * pad) / max(w, h)
        big = sm.resize((w * 12, h * 12), Image.NEAREST).resize((max(1, round(w * s)), max(1, round(h * s))), Image.BOX)
    c = Image.new('RGBA', (box, box), (0, 0, 0, 0))
    c.alpha_composite(big, ((box - big.size[0]) // 2, (box - big.size[1]) // 2))
    return c

# Species order, fallback emoji, label and game species id (file names use whiterabbit for the game's rabbit).
SPECIES = [["pepe", "🐸", "Pepe", "pepe"], ["peepo", "🥲", "Peepo", "peepo"], ["wojak", "😐", "Wojak", "wojak"], ["chud", "🤓", "Chud", "chud"], ["bobo", "🐻", "Bobo", "bobo"], ["mumu", "🐮", "Mumu", "mumu"], ["doge", "🐶", "Doge", "doge"], ["sarutobi", "🐵", "Sarutobi", "sarutobi"], ["lenny", "😏", "Lenny", "lenny"], ["snibby", "🐥", "Snibby", "snibby"], ["kevin", "🗿", "KEVIN", "kevin"], ["dodo", "🦤", "Dodo", "dodo"], ["nakamoto", "🕵️", "Nakamoto", "nakamoto"], ["wizard", "🧙", "Bitcoin Wizard", "wizard"], ["kek", "👑", "Lord Kek", "kek"], ["chad", "😎", "Chad", "chad"], ["homer", "🍩", "Homer Pepe", "homer"], ["funtrump", "🍊", "FUNTRUMP", "funtrump"], ["djpepe", "🎧", "DJ Pepe", "djpepe"], ["bojackson", "🏈", "Bo Jackson", "bojackson"], ["rarepigeon", "🐦", "Rarepigeon", "rarepigeon"], ["jacksonpepe", "🎩", "Old Hickory Pepe", "jacksonpepe"], ["viking", "🪓", "Viking", "viking"], ["orangedragon", "🐉", "Orange Dragon", "orangedragon"], ["starlordkek", "⭐", "Star-Lord Kek", "starlordkek"], ["gooby", "🐧", "Gooby", "gooby"], ["lukespam", "🧢", "Luke Spam Junior", "lukespam"], ["whiterabbit", "🐇", "White Rabbit", "rabbit"]]
NOTE = "HatchBot Telegram packs (Nov 24 2026). Order = emoji pack order (every species bare first). The sticker pack groups the same files by species. Made by make-images.py; uploaded by hatchbot/stickers/packs.js (workflow telegram-packs)."

def write_manifest(files):
    """pets.json from the images actually present, so dropping or adding a look in the source folder is all it takes."""
    have = set(files); pets = []
    for look in ('no', 'some', 'full'):
        for sp, emo, label, gid in SPECIES:
            f = '%s-%s-gear.png' % (sp, look)
            if f in have:
                pets.append({'file': f, 'species': gid, 'label': label, 'look': look,
                             'emoji': [emo] + (['\U0001F60E'] if look != 'no' and emo != '\U0001F60E' else []),
                             'keywords': [label.lower(), 'xcpets', 'pet']})
    missing = sorted(have - {p['file'] for p in pets})
    if missing: raise SystemExit('unknown species in: ' + ', '.join(missing) + ' (add it to SPECIES)')
    if not any(p['look'] == 'no' for p in pets): raise SystemExit('no bare pets found')
    with open(os.path.join(OUT, 'pets.json'), 'w', encoding='utf-8') as fh:
        json.dump({'note': NOTE, 'pets': pets}, fh, ensure_ascii=False, indent=0)
    return pets

def main(src):
    os.makedirs(os.path.join(OUT, 'sticker'), exist_ok=True); os.makedirs(os.path.join(OUT, 'emoji'), exist_ok=True)
    files = sorted(glob.glob(os.path.join(src, '*.png')))
    names = [os.path.basename(f) for f in files]
    for sub in ('sticker', 'emoji'):  # drop images whose source is gone
        for old in os.listdir(os.path.join(OUT, sub)):
            if old.endswith('.png') and old not in names: os.remove(os.path.join(OUT, sub, old))
    write_manifest(names)
    for f in files:
        name = os.path.basename(f)
        sm = strip_outline(native(Image.open(f).convert('RGBA')))
        fit(sm, 512, 8, True).save(os.path.join(OUT, 'sticker', name), optimize=True)
        fit(sm, 100, 1, False).save(os.path.join(OUT, 'emoji', name), optimize=True)
        print(name, sm.size)

if __name__ == '__main__':
    main(sys.argv[1])
