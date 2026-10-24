"""Draw FUNTRUMP preview sheets from /tmp/ft-prev.json (made by funtrump_previews.js). PREVIEW, branch funtrump-community."""
import json, sys
from PIL import Image, ImageDraw, ImageFont
D = json.load(open(sys.argv[1] if len(sys.argv) > 1 else '/tmp/ft-prev.json')); OUT = '/workspace/xcpets/previews/funtrump/'
try: F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13); FB = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 18)
except Exception: F = FB = ImageFont.load_default()
def tile(px, k):
    im = Image.new('RGB', (32, 32)); im.putdata([tuple(px[i:i + 3]) for i in range(0, 4096, 4)]); return im.resize((32 * k, 32 * k), Image.NEAREST)
BG = (16, 20, 30); T = (235, 235, 235)
# hybrid sheet
k = 4; cw = 32 * k + 8; W = 170 + 8 * cw; H = 80 + len(D['hyb']) * (32 * k + 12) + 40 + 32 * k + 40
im = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(im)
d.text((10, 10), 'FUNTRUMP hybrids (PREVIEW, inert) - left 4: FUNTRUMP body x root colours (egg, Juv, Adult, Mythic); right 4: root body x FUNTRUMP colours + hair feature', fill=T, font=F)
for i, lab in enumerate(['egg', 'Juvenile', 'Adult', 'Mythic'] * 2): d.text((170 + i * cw, 40), ('FT body ' if i < 4 else 'root body ') + lab, fill=(180, 180, 200), font=F)
for r, row in enumerate(D['hyb']):
    y = 62 + r * (32 * k + 12); d.text((10, y + 50), row['root'] + '\n' + row['name1'], fill=T, font=F)
    for c, cell in enumerate(row['cells']): im.paste(tile(cell['px'], k), (170 + c * cw, y))
y = 62 + len(D['hyb']) * (32 * k + 12) + 10; d.text((10, y), 'Three-way (Elder): shape/colour/feature', fill=T, font=F)
for c, cell in enumerate(D['h3'][:8]): im.paste(tile(cell['px'], k), (170 + c * cw, y + 20)); d.text((170 + c * cw, y + 24 + 32 * k), cell['label'], fill=(180, 180, 200), font=F)
im.save(OUT + 'funtrump-hybrids-sheet.png')
# gear try-on: every gear id at Hatchling / Adult / Mythic
k = 3; cols = 8; cw = 3 * 32 * k + 18; ch = 32 * k + 34; G = D['gear']; rows = (len(G) + cols - 1) // cols
W = cols * cw + 20; H = 50 + rows * ch + 30 + len(D['load']) * (32 * k + 30)
im = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(im)
d.text((10, 10), 'FUNTRUMP full gear try-on (PREVIEW): every gear id (%d) on Hatchling / Adult / Mythic, drawn by FuntrumpSprite gear anchors' % len(G), fill=T, font=F)
for i, g in enumerate(G):
    x = 10 + (i % cols) * cw; y = 40 + (i // cols) * ch
    for s, p in enumerate(g['px']): im.paste(tile(p, k), (x + s * (32 * k + 2), y))
    d.text((x, y + 32 * k + 2), ('[%s] %s' % (g['slot'], g['label']))[:44], fill=(200, 200, 215), font=F)
y = 50 + rows * ch; d.text((10, y), 'Full loadouts, stages 1-5 (bare / Golden Hairspray / first, last, middle piece of every slot):', fill=T, font=F)
for r, L in enumerate(D['load']):
    for s, fr in enumerate(L['px']): im.paste(tile(fr[0], k), (10 + s * (32 * k + 6), y + 22 + r * (32 * k + 30)))
    d.text((10 + 5 * (32 * k + 6) + 10, y + 22 + r * (32 * k + 30) + 40), ', '.join(L['ids']) or 'bare', fill=(200, 200, 215), font=F)
im.save(OUT + 'funtrump-gear-tryon-sheet.png')
print('ok')
