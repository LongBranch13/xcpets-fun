# FUNTRUMP flags preview sheets (PREVIEW): python3 funtrump_flags_previews.py /tmp/ft-flags.json OUTDIR
import json, sys
from PIL import Image, ImageDraw, ImageFont
d = json.load(open(sys.argv[1])); OUT = sys.argv[2]; F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13)
ST = ['Egg', 'Baby', 'Teen', 'Adult', 'Elder', 'Mythic']; Z = 5; C = 64 * Z if False else 32 * Z
def img(a):
    n = int((len(a) // 4) ** .5); im = Image.frombytes('RGBA', (n, n), bytes(a)); return im.resize((C, C), Image.NEAREST)
def sheet(rows, cols, title, name):
    W = 260 + cols * (C + 8); H = 40 + len(rows) * (C + 26); s = Image.new('RGB', (W, H), (16, 12, 28)); g = ImageDraw.Draw(s)
    g.text((10, 10), title, fill=(255, 230, 160), font=F)
    for r, row in enumerate(rows):
        y = 40 + r * (C + 26); g.text((10, y + C // 2), row['label'], fill=(230, 230, 240), font=F)
        for c, cell in enumerate(row['cells']):
            s.paste(img(cell), (250 + c * (C + 8), y));
            if 'heads' in row: g.text((250 + c * (C + 8), y + C + 4), row['heads'][c], fill=(170, 170, 190), font=F)
    s.save(OUT + '/' + name); print(OUT + '/' + name)
for r in d['rows']: r['heads'] = ST
sheet(d['rows'], 6, 'FUNTRUMP flags (PREVIEW, gated: ACTIVATE_FT_FLAGS_BLOCK = null)  stages Egg..Mythic', 'funtrump-flags-all-stages.png')
for i, r in enumerate(d['rows']):
    sheet([r], 6, r['label'], 'funtrump-' + ['suit-us', 'suit-kek', 'hoodie-us', 'hoodie-kek'][i] + '-flag-stages.png')
for h in d['hyb']: h['heads'] = ['American flag', 'Kekistan flag']
sheet(d['hyb'], 2, 'FUNTRUMP hybrids holding the flags (Elder)', 'funtrump-flags-hybrids.png')
