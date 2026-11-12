#!/usr/bin/env python3
"""XCPETS.FUN.D token art.

img/xcpets_token.png is a finished 512x512 plate (the live xcp.fun/full/XCPETS
asset is that plate, nearest-neighbor doubled to 1024). No generator for it
lives in the repo. This script keeps that plate's stars, vignette and rings
(measured: medallions on a radius-176 clock around (255, 255), border at r=41;
center circle rim at r=121 around (255, 256)) and repaints:

  * each medallion from a sprite rendered by the game (design/token/render-sprites.js)
  * the center, where the hooded figure was, with a pixel treasure chest

Sprites are keyed on the renderer's own chroma (#ff00fe and #990098) and scaled
with nearest-neighbor only. Output is 1024x1024, the same 2x nearest step the
live XCPETS image uses. Bitcoin coins are red (#e11d2e / #9b0f1c), never orange.
No flames.
"""
import json
import math
import subprocess
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PLATE = ROOT / 'img' / 'xcpets_token.png'
OUT_DIR = Path(__file__).resolve().parent

# Measured off img/xcpets_token.png. Every r=41 sample on this ring lands on the purple border.
RING_C = (255, 255)
RING_R = 176
MED_CLEAR = 37.2   # flat interior; the purple border starts at r=38
MED_CLIP = 36.2
HUB_C = (255, 256)
HUB_RIM = 118.5    # light rim of the big circle sits at r=121; keep it
A = (13, 9, 25, 255)       # circle interior
B = (22, 16, 42, 255)      # 2px dither dot
FILL = (29, 21, 48, 255)   # medallion interior

INK = (26, 16, 32, 255)
WOOD = (138, 90, 43, 255)
WOOD_L = (200, 149, 90, 255)
WOOD_D = (74, 42, 23, 255)
GOLD = (255, 201, 60, 255)
GOLD_D = (166, 122, 20, 255)
RED = (225, 29, 46, 255)       # house red, js/djpepe-sprite.js
RED_D = (155, 15, 28, 255)
RED_L = (255, 154, 162, 255)   # light red, not orange
MARK = (255, 236, 220, 255)    # B on the coin
MOUTH = (11, 8, 16, 255)

# Clockwise from 12 o'clock. Wojak is Adult: Mythic closes his eyes into a ^^ smile,
# and the live cast draws the open sad face (js/v2-pages.js HERO_STAGE).
PRIMARY = [
    ('pepe-s5', 'Pepe', 'Mythic'),
    ('wizard-mythic', 'Bitcoin Wizard', 'Mythic'),
    ('dragon-mythic', 'Orange Dragon', 'Mythic'),
    ('kek-mythic', 'Lord Kek', 'Mythic'),
    ('doge-s5', 'Doge', 'Mythic'),
    ('wojak-s3', 'Wojak', 'Adult'),
    ('homer-mythic', 'Homer Pepe', 'Mythic'),
    ('djpepe-mythic', 'DJ Pepe', 'Mythic'),
    ('funtrump-mythic', 'FUNTRUMP', 'Mythic'),
    ('rabbit-mythic', 'The White Rabbit', 'Mythic'),
    ('nakamoto-s5', 'Nakamoto', 'Mythic'),
    ('viking-mythic', 'Viking', 'Mythic'),
]
CLASSICS = [
    ('pepe-s5', 'Pepe', 'Mythic'),
    ('wojak-s3', 'Wojak', 'Adult'),
    ('chud-s5', 'Chud', 'Mythic'),
    ('bobo-s5', 'Bobo', 'Mythic'),
    ('mumu-s5', 'Mumu', 'Mythic'),
    ('snibby-s5', 'Snibby', 'Mythic'),
    ('dodo-s5', 'Dodo', 'Mythic'),
    ('kevin-s5', 'KEVIN', 'Mythic'),
    ('peepo-s5', 'Peepo', 'Mythic'),
    ('sarutobi-s5', 'Sarutobi', 'Mythic'),
    ('doge-s5', 'Doge', 'Mythic'),
    ('lenny-s5', 'Lenny', 'Mythic'),
]
HOARD = [
    ('wizard-mythic', 'Bitcoin Wizard', 'Mythic'),
    ('dragon-mythic', 'Orange Dragon', 'Mythic'),
    ('kek-mythic', 'Lord Kek', 'Mythic'),
    ('funtrump-mythic', 'FUNTRUMP', 'Mythic'),
    ('homer-mythic', 'Homer Pepe', 'Mythic'),
    ('rabbit-mythic', 'The White Rabbit', 'Mythic'),
    ('bojackson-mythic', 'Bo Jackson', 'Mythic'),
    ('rarepigeon-mythic', 'Rarepigeon', 'Mythic'),
    ('jacksonpepe-mythic', 'Old Hickory Pepe', 'Mythic'),
    ('djpepe-mythic', 'DJ Pepe', 'Mythic'),
    ('viking-mythic', 'Viking', 'Mythic'),
    ('nakamoto-s5', 'Nakamoto', 'Mythic'),
]
CAST = [
    ('pepe-s5', 'Pepe', 'Mythic'),
    ('doge-s5', 'Doge', 'Mythic'),
    ('chad-s5', 'Chad', 'Mythic'),
    ('dragon-mythic', 'Orange Dragon', 'Mythic'),
    ('wizard-mythic', 'Bitcoin Wizard', 'Mythic'),
    ('kek-mythic', 'Lord Kek', 'Mythic'),
    ('bojackson-mythic', 'Bo Jackson', 'Mythic'),
    ('homer-mythic', 'Homer Pepe', 'Mythic'),
    ('rabbit-mythic', 'The White Rabbit', 'Mythic'),
    ('djpepe-mythic', 'DJ Pepe', 'Mythic'),
    ('funtrump-mythic', 'FUNTRUMP', 'Mythic'),
    ('wojak-s3', 'Wojak', 'Adult'),
]


def load_render():
    raw = subprocess.check_output(['node', str(OUT_DIR / 'render-sprites.js')], cwd=str(ROOT))
    return json.loads(raw)


def is_key(c):
    r, g, b = c[:3]
    if r > 240 and g < 16 and b > 240:
        return True
    return r == 153 and g == 0 and b == 152


def sprite_image(sp):
    im = Image.new('RGBA', (sp['w'], sp['h']), (0, 0, 0, 0))
    px = im.load()
    data = sp['data']
    for y in range(sp['h']):
        for x in range(sp['w']):
            o = (y * sp['w'] + x) * 4
            c = (data[o], data[o + 1], data[o + 2], 255)
            if is_key(c):
                continue
            px[x, y] = c
    return im


def blit_nearest(dst, src, ox, oy, clip=None):
    """Paste src at (ox, oy). clip is (cx, cy, r) in dst pixels; hard circle, no blend."""
    dp = dst.load()
    sp = src.load()
    w, h = dst.size
    for y in range(src.height):
        dy = oy + y
        if dy < 0 or dy >= h:
            continue
        for x in range(src.width):
            dx = ox + x
            if dx < 0 or dx >= w:
                continue
            c = sp[x, y]
            if c[3] == 0:
                continue
            if clip is not None:
                cx, cy, r = clip
                if (dx - cx) ** 2 + (dy - cy) ** 2 > r * r:
                    continue
            dp[dx, dy] = c


def place_sprite(dst, im, cx, cy):
    box = im.getbbox()
    if not box:
        return 1
    crop = im.crop(box)
    diam = int(MED_CLIP * 2) - 2
    scale = max(1, min(diam // crop.width, diam // crop.height))
    big = crop.resize((crop.width * scale, crop.height * scale), Image.Resampling.NEAREST)
    ox = int(round(cx - big.width / 2))
    oy = int(round(cy - big.height / 2))
    blit_nearest(dst, big, ox, oy, (cx, cy, MED_CLIP))
    return scale


def medallion_centers():
    out = []
    for k in range(12):
        th = math.radians(-90 + k * 30)
        out.append((RING_C[0] + RING_R * math.cos(th), RING_C[1] + RING_R * math.sin(th)))
    return out


def prepare_plate():
    im = Image.open(PLATE).convert('RGBA')
    px = im.load()
    w, h = im.size
    for cx, cy in medallion_centers():
        x0, x1 = int(cx - MED_CLEAR - 1), int(cx + MED_CLEAR + 1)
        y0, y1 = int(cy - MED_CLEAR - 1), int(cy + MED_CLEAR + 1)
        for y in range(max(0, y0), min(h, y1 + 1)):
            for x in range(max(0, x0), min(w, x1 + 1)):
                if (x - cx) ** 2 + (y - cy) ** 2 <= MED_CLEAR * MED_CLEAR:
                    px[x, y] = FILL
    hx, hy = HUB_C
    for y in range(h):
        for x in range(w):
            d = math.hypot(x - hx, y - hy)
            if d > HUB_RIM:
                continue
            # 2px checker, full inside r=88, faded out by r=104, solid past that.
            # Same two colours as the original circle interior.
            if (x // 2 + y // 2) % 2 == 0 and d < 104:
                if d <= 88:
                    px[x, y] = B
                else:
                    t = (104 - d) / 16
                    bayer = ((x // 2) * 3 + (y // 2) * 5) & 7
                    px[x, y] = B if (bayer / 8) < t else A
            else:
                px[x, y] = A
    return im


class Grid:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        self.px = self.im.load()

    def p(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[x, y] = c

    def rect(self, x, y, w, h, c):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.p(xx, yy, c)

    def hline(self, x0, x1, y, c):
        for x in range(x0, x1 + 1):
            self.p(x, y, c)

    def outline_stamp(self, src, color=INK):
        """1px ink ring around opaque pixels, drawn under them."""
        marks = []
        for y in range(self.h):
            for x in range(self.w):
                if src(x, y):
                    continue
                if any(src(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    marks.append((x, y))
        for x, y in marks:
            if self.px[x, y][3] == 0:
                self.p(x, y, color)


# 11x11 red Bitcoin coin. Two stems on the left of the B (the ₿). No orange.
COIN = [
    '....ddd....',
    '..ddLLRdd..',
    '.dLRRRRRRd.',
    'dRRMMMMmRRd',
    'dRRMMRRMRRd',
    'dRRMMMMMRRd',
    'dRRMMRRMRRd',
    'dRRMMMMMRRd',
    '.dRRRRRRDd.',
    '..ddRRDdd..',
    '....ddd....',
]
COIN_COL = {'d': RED_D, 'R': RED, 'L': RED_L, 'M': MARK, 'm': MARK, 'D': RED_D}


def coin(g, cx, cy, r=4):
    """Stamp the red Bitcoin coin. r is accepted so callers can still say 'small'; the mark stays the 11px coin."""
    bmp = COIN
    h, w = len(bmp), len(bmp[0])
    x0, y0 = cx - w // 2, cy - h // 2
    for yy, row in enumerate(bmp):
        for xx, ch in enumerate(row):
            if ch == '.':
                continue
            g.p(x0 + xx, y0 + yy, COIN_COL[ch])


def _plank(xx, w):
    if xx < 3 or xx > w - 4:
        return WOOD_D
    return WOOD_L if xx < int(w * 0.42) else WOOD


def _body(g, x, y, w, h):
    """Wooden chest front: ink outline, two gold straps, a lock."""
    for yy in range(h):
        for xx in range(w):
            if xx == 0 or xx == w - 1 or yy == 0 or yy == h - 1:
                g.p(x + xx, y + yy, INK)
            elif yy in (4, 5, h - 5, h - 4):
                g.p(x + xx, y + yy, GOLD if yy in (4, h - 5) else GOLD_D)
            else:
                g.p(x + xx, y + yy, _plank(xx, w))
    for yy in range(1, h - 1):
        g.p(x + 3, y + yy, GOLD)
        g.p(x + 4, y + yy, GOLD_D)
        g.p(x + w - 4, y + yy, GOLD)
        g.p(x + w - 5, y + yy, GOLD_D)
    lx, ly = x + w // 2 - 1, y + h // 2 - 1
    g.rect(lx, ly, 3, 4, GOLD_D)
    g.rect(lx, ly, 3, 1, GOLD)
    g.p(lx + 1, ly + 1, MARK)
    g.p(lx + 1, ly + 2, INK)


def _lid_open(g, x, y, w):
    """Lid tipped up. y is the hinge row, just above the mouth."""
    # Far edge is narrower and higher; near edge (the hinge) is full width.
    rows = 9
    for row in range(rows):
        yy = y - rows + 1 + row
        inset = (rows - 1 - row) // 2
        x0, x1 = x + inset, x + w - 1 - inset
        for xx in range(x0, x1 + 1):
            if row == 0 or xx == x0 or xx == x1:
                g.p(xx, yy, INK)
            elif row == 1 or row == rows - 1:
                g.p(xx, yy, GOLD if row == 1 else GOLD_D)
            else:
                g.p(xx, yy, WOOD_L if xx < x + w * 0.45 else WOOD)


def _lid_closed(g, x, y, w):
    """Shut lid. y is the top row of the body; the lid is drawn above it."""
    for row, inset in enumerate((3, 2, 1, 0)):
        yy = y - 4 + row
        x0, x1 = x + inset, x + w - 1 - inset
        for xx in range(x0, x1 + 1):
            if row == 0 or xx == x0 or xx == x1:
                g.p(xx, yy, INK)
            elif row == 1:
                g.p(xx, yy, GOLD)
            elif row == 3:
                g.p(xx, yy, GOLD_D)
            else:
                g.p(xx, yy, WOOD_L if xx < x + w * 0.4 else WOOD)


def draw_center(kind):
    """Logical-pixel center piece. Coins are stamped last so the chest holds them in front."""
    g = Grid(64, 58)
    bx, bw, bh = 10, 44, 18
    if kind == 'closed':
        by = 22
        _body(g, bx, by, bw, bh)
        _lid_closed(g, bx, by, bw)
        # a stack of red coins resting on the shut lid
        coin(g, 32, 13)
        coin(g, 22, 16)
        coin(g, 42, 16)
    elif kind == 'hoard':
        by = 16
        _lid_open(g, bx, by - 2, bw)
        for xx in range(bx + 2, bx + bw - 2):
            g.p(xx, by - 1, MOUTH)
            g.p(xx, by, MOUTH)
        _body(g, bx, by + 1, bw, bh)
        # mouthful, then a row held in front
        coin(g, 22, by - 1)
        coin(g, 32, by - 3)
        coin(g, 42, by - 1)
        coin(g, 18, 39)
        coin(g, 32, 41)
        coin(g, 46, 39)
    elif kind == 'plaque':
        by = 16
        _lid_open(g, bx, by - 2, bw)
        for xx in range(bx + 2, bx + bw - 2):
            g.p(xx, by - 1, MOUTH)
        _body(g, bx, by, bw, bh)
        coin(g, 32, by - 2)
        coin(g, 20, 39)
        coin(g, 32, 41)
        coin(g, 44, 39)
    else:
        # primary: open lid, three coins in the mouth, two held in front
        by = 18
        _lid_open(g, bx, by - 2, bw)
        for xx in range(bx + 2, bx + bw - 2):
            g.p(xx, by - 1, MOUTH)
            g.p(xx, by, MOUTH)
        _body(g, bx, by + 1, bw, bh)
        coin(g, 22, by - 1)
        coin(g, 32, by - 3)
        coin(g, 42, by - 1)
        coin(g, 24, 41)
        coin(g, 40, 41)
    return g.im


def blit_font(dst, font, text, x, y, color, outline=INK):
    adv, gw, oy = font['adv'], font['w'], font['oy']
    glyphs = []
    for ch in text:
        rows = [int(h, 16) for h in font['g'].get(ch, font['g']['?']).split('.')]
        glyphs.append(rows)
    width = adv * len(text)
    height = font['h']

    def pix(px, py, c):
        if 0 <= px < dst.width and 0 <= py < dst.height:
            dst.putpixel((px, py), c)

    for j, rows in enumerate(glyphs):
        for ry, row in enumerate(rows):
            if not row:
                continue
            for bx in range(gw):
                if row & (1 << bx):
                    gx = x + j * adv + bx
                    gy = y + ry - oy
                    for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                        pix(gx + dx, gy + dy, outline)
    for j, rows in enumerate(glyphs):
        for ry, row in enumerate(rows):
            if not row:
                continue
            for bx in range(gw):
                if row & (1 << bx):
                    pix(x + j * adv + bx, y + ry - oy, color)
    return width, height


def compose(plate, sprites, font, roster, center, label):
    im = plate.copy()
    used = []
    for (cx, cy), (key, name, stage) in zip(medallion_centers(), roster):
        scale = place_sprite(im, sprites[key], cx, cy)
        used.append({'key': key, 'name': name, 'stage': stage, 'scale': scale, 'slot': len(used)})
    center_im = draw_center(center)
    # Scale 4 matches the hood's pixel size on the 512 plate.
    scale = 4
    big = center_im.resize((center_im.width * scale, center_im.height * scale), Image.Resampling.NEAREST)
    box = big.getbbox()
    if box:
        big = big.crop(box)
    ox = int(round(HUB_C[0] - big.width / 2))
    oy = int(round(HUB_C[1] - big.height / 2 - (6 if label else 0)))
    blit_nearest(im, big, ox, oy, (HUB_C[0], HUB_C[1], HUB_RIM - 1))
    if label:
        tw = font['adv'] * len(label)
        tx = int(round(HUB_C[0] - tw / 2))
        ty = oy + big.height + 3 + font['oy']
        # Keep the word inside the circle.
        if ty + font['h'] - font['oy'] > HUB_C[1] + HUB_RIM - 4:
            ty = int(HUB_C[1] + HUB_RIM - 4 - (font['h'] - font['oy']))
        blit_font(im, font, label, tx, ty, GOLD)
    # 1024, same 2x nearest step as https://xcp.fun/full/XCPETS
    return im.resize((1024, 1024), Image.Resampling.NEAREST), used


def main():
    payload = load_render()
    sprites = {k: sprite_image(v) for k, v in payload['sprites'].items()}
    font = payload['font']
    plate = prepare_plate()
    jobs = [
        ('xcpets-fun-d.png', PRIMARY, 'open', 'FUN.D'),
        ('xcpets-fun-d-closed.png', CLASSICS, 'closed', 'FUN.D'),
        ('xcpets-fun-d-hoard.png', HOARD, 'hoard', None),
        ('xcpets-fun-d-plaque.png', CAST, 'plaque', 'FUN.D'),
    ]
    report = []
    for name, roster, center, label in jobs:
        im, used = compose(plate, sprites, font, roster, center, label)
        path = OUT_DIR / name
        im.save(path, 'PNG')
        report.append({'file': str(path.relative_to(ROOT)), 'center': center, 'label': label, 'pets': used})
        print(path.name, im.size, 'center=' + center, 'label=' + str(label))
        for i, p in enumerate(used):
            print(f"  {i:2d} {p['name']} ({p['stage']}) x{p['scale']}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
