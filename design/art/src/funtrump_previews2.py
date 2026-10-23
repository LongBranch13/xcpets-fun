"""Phase-2 FUNTRUMP sheets from /tmp/ft-prev2.json. PREVIEW, branch funtrump-community."""
import json
from PIL import Image, ImageDraw, ImageFont
D = json.load(open('/tmp/ft-prev2.json')); OUT = '/workspace/xcpets/previews/funtrump/'
F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13)
def tile(px, k):
    im = Image.new('RGB', (32, 32)); im.putdata([tuple(px[i:i + 3]) for i in range(0, 4096, 4)]); return im.resize((32 * k, 32 * k), Image.NEAREST)
BG = (16, 20, 30); T = (235, 235, 235); ST = ['egg', 'Hatchling', 'Juvenile', 'Adult', 'Elder', 'Mythic']
k = 5; c = 32 * k + 6; W = 110 + 8 * c + 30; H = 70 + 6 * (c + 4)
im = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(im)
d.text((10, 10), 'FUNTRUMP two looks (PREVIEW, inert)   SUIT = Rare (frames 0-3)   |   HOODIE = Legendary (frames 0-3)', fill=T, font=F)
for s in range(6):
    y = 40 + s * (c + 4); d.text((10, y + 70), ST[s], fill=T, font=F)
    for i, look in enumerate(['suit', 'hoodie']):
        for f in range(4): im.paste(tile(D['looks'][look][s][f], k), (110 + i * (4 * c + 30) + f * c, y))
im.save(OUT + 'funtrump-looks-suit-vs-hoodie.png')
k = 4; c = 32 * k + 8; ids = D['gear']['ids']; W = 170 + len(ids) * c; H = 90 + len(D['gear']['bodies']) * (c + 4)
im = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(im)
d.text((10, 8), 'FUNTRUMP gear (PREVIEW, inert, gated by the FUNTRUMP gate), Adult stage. Empty = not allowed on that body (by design).', fill=T, font=F)
for i, (id_, lab, slot, tier, ex) in enumerate(ids): d.text((170 + i * c, 32), lab + '\n' + slot + ' ' + '★' * tier + '\n' + ex, fill=(200, 200, 220), font=F)
for r, b in enumerate(D['gear']['bodies']):
    y = 88 + r * (c + 4); d.text((10, y + 55), b['label'], fill=T, font=F)
    for i, px in enumerate(b['cells']):
        if px: im.paste(tile(px, k), (170 + i * c, y))
        else: d.rectangle((170 + i * c, y, 170 + i * c + 32 * k, y + 32 * k), outline=(60, 60, 70)); d.text((170 + i * c + 40, y + 58), 'n/a', fill=(110, 110, 120), font=F)
im.save(OUT + 'funtrump-gear-ft-sheet.png')
k = 5; c = 32 * k + 6; W = 360 + 8 * c; H = 40 + len(D['sig']) * (c + 8)
im = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(im)
d.text((10, 10), 'FUNTRUMP signature gear (PREVIEW): Adult frames 0-3 | Mythic frames 0-3', fill=T, font=F)
for r, s in enumerate(D['sig']):
    y = 36 + r * (c + 8); d.multiline_text((10, y + 60), s['label'].replace(': ', ':\n'), fill=T, font=F)
    for j, fr in enumerate(s['frames']):
        for f in range(4): im.paste(tile(fr[f], k), (360 + (j * 4 + f) * c, y))
im.save(OUT + 'funtrump-signature-gear.png')
