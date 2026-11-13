#!/usr/bin/env python3
"""Turn render-sheets.js frames.json into labelled 4x contact sheets.
Press Start 2P titles, Bangers for the meme line, VT323 for the small labels.
"""
import json
import os
import sys
from PIL import Image, ImageDraw, ImageFont

FONT = os.environ.get('YE_FONTS', '/tmp/ye-fonts')
PS2 = ImageFont.truetype(os.path.join(FONT, 'PressStart2P.ttf'), 16)
BANG = ImageFont.truetype(os.path.join(FONT, 'Bangers-Regular.ttf') if os.path.exists(os.path.join(FONT, 'Bangers-Regular.ttf')) else os.path.join(FONT, 'Bangers.ttf'), 28)
VT = ImageFont.truetype(os.path.join(FONT, 'VT323.ttf'), 22)
GOLD = (255, 201, 60)
CREAM = (244, 236, 216)
MUTED = (176, 168, 150)
INK = (18, 14, 24)
PANEL = (29, 43, 83)
W = 1080
SCALE = 4
STAGES = ['Hatchling', 'Juvenile', 'Adult', 'Elder', 'Mythic']


def sprite(px):
    im = Image.frombytes('RGBA', (32, 32), bytes(px))
    return im.resize((32 * SCALE, 32 * SCALE), Image.Resampling.NEAREST)


def text(draw, xy, s, font, fill):
    draw.text(xy, s, font=font, fill=fill)


def center(draw, y, s, font, fill, width):
    box = draw.textbbox((0, 0), s, font=font)
    x = (width - (box[2] - box[0])) // 2
    text(draw, (x, y), s, font, fill)
    return box[3] - box[1]


def sheet(title, meme, cells, cols):
    """cells: list of (image, label, sub)."""
    pad = 28
    gap = 16
    head = 78
    cell_w = (W - pad * 2 - gap * (cols - 1)) // cols
    rows = (len(cells) + cols - 1) // cols
    cell_h = 32 * SCALE + 52
    H = head + pad + rows * cell_h + (rows - 1) * gap + pad
    im = Image.new('RGB', (W, H), INK)
    d = ImageDraw.Draw(im)
    center(d, 16, title, PS2, GOLD, W)
    center(d, 44, meme, BANG, CREAM, W)
    d.rectangle((pad, 74, W - pad, 76), fill=GOLD)
    for i, (pic, label, sub) in enumerate(cells):
        c, r = i % cols, i // cols
        x = pad + c * (cell_w + gap)
        y = head + pad + r * (cell_h + gap)
        d.rounded_rectangle((x, y, x + cell_w - 1, y + cell_h - 1), radius=8, fill=(22, 18, 32), outline=GOLD)
        px = x + (cell_w - pic.width) // 2
        im.paste(pic, (px, y + 8), pic)
    d2 = ImageDraw.Draw(im)
    for i, (pic, label, sub) in enumerate(cells):
        c, r = i % cols, i // cols
        x = pad + c * (cell_w + gap)
        y = head + pad + r * (cell_h + gap)
        ly = y + 8 + pic.height + 2
        box = d2.textbbox((0, 0), label, font=VT)
        d2.text((x + (cell_w - (box[2] - box[0])) // 2, ly), label, font=VT, fill=CREAM)
        if sub:
            box = d2.textbbox((0, 0), sub, font=VT)
            d2.text((x + (cell_w - (box[2] - box[0])) // 2, ly + 20), sub, font=VT, fill=MUTED)
    return im


def main():
    src, out = sys.argv[1], sys.argv[2]
    data = json.load(open(src))
    os.makedirs(out, exist_ok=True)

    def cell(px, label, sub=''):
        return (sprite(px), label, sub)

    stages = [cell(s['with'], STAGES[i], 'shades on') for i, s in enumerate(data['stages'])]
    bare = [cell(s['bare'], STAGES[i], 'shades off') for i, s in enumerate(data['stages'])]
    bob = [cell(b['px'], 'frame ' + str(b['frame'] + 1), 'Adult bob') for b in data['bob']]
    gear = [cell(w['px'], w['slot'], w['label']) for w in data['worn']]
    gear.append(cell(data['allOn']['px'], 'All six', 'worn together'))
    shades = [cell(data['stages'][2]['with'], 'Ye', 'shades on'), cell(data['stages'][2]['bare'], 'Ye', 'shades off')]
    names = {'pepe': 'Pepe', 'peepo': 'Peepo', 'doge': 'Doge', 'wojak': 'Wojak'}
    for w in data['wearers']:
        shades.append(cell(w['px'], names[w['species']], 'Ye shades'))
    nice = {'ye': 'Ye', 'pepe': 'Pepe', 'doge': 'Doge', 'wojak': 'Wojak', 'dodo': 'Dodo'}
    hybrids = [cell(c['px'], nice[c['shape']] + ' times ' + nice[c['color']], 'Adult') for c in data['crosses']]

    files = [
        ('01-stages.png', sheet('YE', 'Legendary. Shades on. Hatchling through Mythic.', stages, 5)),
        ('02-without-shades.png', sheet('YE', 'The same pet. Shades off.', bare, 5)),
        ('03-gear-slots.png', sheet('YE', 'Six slots, on the live anchors.', gear, 4)),
        ('04-shades.png', sheet('BLACK SHADES', 'Ye, on and off. Then Pepe, Peepo, Doge, Wojak.', shades, 6)),
        ('05-hybrids.png', sheet('YE TIMES THE ROSTER', 'His shape in their colours, and the other way.', hybrids, 3)),
        ('06-idle-bob.png', sheet('YE', 'Adult idle. The whole pet bobs.', bob, 4)),
    ]
    for name, im in files:
        path = os.path.join(out, name)
        im.save(path)
        print(path, im.size)


if __name__ == '__main__':
    main()
