"""Make HatchBot's Telegram sticker and custom-emoji images (Nov 24 2026).

Input: the 70 die-cut pet stickers drawn by the game's own renderer for the merch launch kit
(one folder of <species>-<no|some|full>-gear.png, every image an exact integer upscale of the pixel sprite).
Output (committed next to this file):
  sticker/<name>.png  512x512 transparent PNG, crisp integer pixel upscale, centred  (Telegram regular sticker)
  emoji/<name>.png    100x100 transparent PNG, box-filtered down from the pixel sprite (Telegram custom emoji)

Run: python3 hatchbot/stickers/make-images.py /path/to/launch-kit/stickers
"""
import sys, os, glob, math
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

def main(src):
    os.makedirs(os.path.join(OUT, 'sticker'), exist_ok=True); os.makedirs(os.path.join(OUT, 'emoji'), exist_ok=True)
    for f in sorted(glob.glob(os.path.join(src, '*.png'))):
        name = os.path.basename(f)
        sm = native(Image.open(f).convert('RGBA'))
        fit(sm, 512, 8, True).save(os.path.join(OUT, 'sticker', name), optimize=True)
        fit(sm, 100, 1, False).save(os.path.join(OUT, 'emoji', name), optimize=True)
        print(name, sm.size)

if __name__ == '__main__':
    main(sys.argv[1])
