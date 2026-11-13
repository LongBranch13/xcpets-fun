#!/usr/bin/env python3
"""Turn render-sheets.js frames.json into labelled 4x contact sheets.
Headers are Press Start 2P, the site pixel font. Small labels are VT323.
"""
import json
import os
import sys
from PIL import Image, ImageDraw, ImageFont

FONT = os.environ.get('YE_FONTS', '/tmp/ye-fonts')
PS2 = ImageFont.truetype(os.path.join(FONT, 'PressStart2P.ttf'), 16)
PS2S = ImageFont.truetype(os.path.join(FONT, 'PressStart2P.ttf'), 11)
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
    center(d, 14, title, PS2, GOLD, W)
    center(d, 42, meme, PS2S, CREAM, W)
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


def blow(px, scale):
    im = Image.frombytes('RGBA', (32, 32), bytes(px)).convert('RGB')
    return im.resize((32 * scale, 32 * scale), Image.Resampling.NEAREST)


def reference_bust(height):
    ref = Image.open('/cursor/stores/bot/refs/ye-reference.jpg').convert('RGB')
    w, h = ref.size
    crop = ref.crop((int(w * 0.34), int(h * 0.0), int(w * 0.66), int(h * 0.99)))
    nw = max(1, int(crop.width * height / crop.height))
    return crop.resize((nw, height), Image.Resampling.BOX)


def labeled_row(title, meme, pics):
    """pics: list of (image, label). Images already scaled."""
    pad, gap = 28, 18
    head = 78
    widths = [p.width for p, _ in pics]
    row_w = sum(widths) + gap * (len(pics) - 1)
    Wd = max(1080, row_w + pad * 2)
    lab = 36
    H = head + pad + pics[0][0].height + lab + pad
    im = Image.new('RGB', (Wd, H), INK)
    d = ImageDraw.Draw(im)
    center(d, 14, title, PS2, GOLD, Wd)
    center(d, 42, meme, PS2S, CREAM, Wd)
    d.rectangle((pad, 74, Wd - pad, 76), fill=GOLD)
    x = (Wd - row_w) // 2
    y = head + pad
    for pic, label in pics:
        d.rounded_rectangle((x - 8, y - 8, x + pic.width + 8, y + pic.height + lab), radius=8, outline=GOLD)
        im.paste(pic, (x, y))
        box = d.textbbox((0, 0), label, font=VT)
        d.text((x + (pic.width - (box[2] - box[0])) // 2, y + pic.height + 6), label, font=VT, fill=CREAM)
        x += pic.width + gap
    return im


def versus_reference(data):
    scale = 8
    ref = reference_bust(32 * scale)
    off = blow(data['stages'][2]['bare'], scale)
    on = blow(data['stages'][2]['with'], scale)
    return labeled_row('YE', 'Adult next to the Heartless reference.', [
        (ref, 'Reference'), (off, 'Ye shades off'), (on, 'Ye shades on')])


def versus_v1(old, new):
    scale = 8
    return labeled_row('YE', 'Adult close-up. v1 then v2.', [
        (blow(old['stages'][2]['bare'], scale), 'v1'),
        (blow(new['stages'][2]['bare'], scale), 'v2 shades off'),
        (blow(new['stages'][2]['with'], scale), 'v2 shades on')])


def main():
    src, out = sys.argv[1], sys.argv[2]
    data = json.load(open(src))
    os.makedirs(out, exist_ok=True)

    def cell(px, label, sub=''):
        return (sprite(px), label, sub)

    stages = [cell(s['bare'], STAGES[i], '') for i, s in enumerate(data['stages'])]
    bare = [cell(s['bare'], STAGES[i], 'shades off') for i, s in enumerate(data['stages'])]
    bob = [cell(b['px'], 'frame ' + str(b['frame'] + 1), 'Adult') for b in data['bob']]
    gear = [cell(w['px'], w['slot'], w['label']) for w in data['worn']]
    gear.append(cell(data['allOn']['px'], 'All six', 'worn together'))
    shades = [cell(data['stages'][2]['bare'], 'Ye', 'shades off'), cell(data['stages'][2]['with'], 'Ye', 'shades on')]
    names = {'pepe': 'Pepe', 'peepo': 'Peepo', 'doge': 'Doge', 'wojak': 'Wojak'}
    for w in data['wearers']:
        shades.append(cell(w['px'], names[w['species']], 'shades'))
    nice = {'ye': 'Ye', 'pepe': 'Pepe', 'doge': 'Doge', 'wojak': 'Wojak', 'dodo': 'Dodo'}
    hybrids = [cell(c['px'], nice[c['shape']] + ' times ' + nice[c['color']], 'Adult') for c in data['crosses']]

    files = [
        ('01-stages.png', sheet('YE', 'Hatchling through Mythic. Shades off.', stages, 5)),
        ('02-without-shades.png', sheet('YE', 'Shades off. Eyes, brows, grin, beard.', bare, 5)),
        ('03-gear-slots.png', sheet('YE', 'Six slots on the live anchors.', gear, 4)),
        ('04-shades.png', sheet('YE', 'Shades off, shades on, then Pepe, Peepo, Doge, Wojak.', shades, 6)),
        ('05-hybrids.png', sheet('YE', 'Ye times the roster. Shades off.', hybrids, 3)),
        ('06-idle-bob.png', sheet('YE', 'Adult idle. The whole pet bobs.', bob, 4)),
    ]
    files.append(('00-vs-reference.png', versus_reference(data)))
    if len(sys.argv) > 3 and os.path.exists(sys.argv[3]):
        files.append(('07-adult-v1-v2.png', versus_v1(json.load(open(sys.argv[3])), data)))
    for name, im in files:
        path = os.path.join(out, name)
        im.save(path)
        print(path, im.size)


if __name__ == '__main__':
    main()
