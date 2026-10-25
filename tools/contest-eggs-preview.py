#!/usr/bin/env python3
# DRAFT preview sheets for the contest eggs (dev only). python3 tools/contest-eggs-preview.py FRAMES.json OUTDIR
import json, sys
from PIL import Image, ImageDraw
J = json.load(open(sys.argv[1])); OUT = sys.argv[2]; S = 8
NAMES = {'starlordkek': 'Star-Lord Kek', 'gooby': 'Gooby', 'lukespam': 'Luke Spam Junior'}
STAGES = ['Egg', 'Hatchling', 'Juvenile', 'Adult', 'Elder', 'Mythic']
def tile(d): im = Image.new('RGBA', (32, 32)); im.putdata([tuple(d[i:i + 4]) for i in range(0, len(d), 4)]); return im.resize((32 * S, 32 * S), Image.NEAREST)
def sheet(rows, title, labels, path, w=None):
    cols = max(len(r[1]) for r in rows); W = 24 + cols * (32 * S + 16); H = 50 + len(rows) * (32 * S + 60)
    im = Image.new('RGB', (W, H), '#0b0912'); dr = ImageDraw.Draw(im); dr.text((24, 16), title, fill='#ffd23f')
    for ri, (name, tiles) in enumerate(rows):
        y = 50 + ri * (32 * S + 60); dr.text((24, y), name, fill='#ffffff')
        for ci, t in enumerate(tiles): x = 24 + ci * (32 * S + 16); im.paste(tile(t), (x, y + 16)); dr.text((x, y + 20 + 32 * S), labels[ci] if ci < len(labels) else '', fill='#bbbbcc')
    im.save(path); print(path)
for sp, st in J['strips'].items():
    sheet([(NAMES[sp] + '  1 of 1  (frame 0)', [f[0] for f in st]), ('idle frames 0-3 at Adult', st[3])], 'CONTEST PRIZE EGG DRAFT: ' + NAMES[sp] + ' (32x32 shown 8 times size)', STAGES, f'{OUT}/stage-strip-{sp}.png')
    frames = [Image.fromarray if False else None]
    gif = [tile(f).convert('P') for f in st[5]]; gif[0].save(f'{OUT}/mythic-idle-{sp}.gif', save_all=True, append_images=gif[1:], duration=300, loop=0)
sheet([(NAMES[sp], [st[0][0], st[0][1], st[0][2], st[0][3]]) for sp, st in J['strips'].items()], 'CONTEST PRIZE EGGS (what winners get; 4 idle frames each)', ['frame 0', 'frame 1', 'frame 2', 'frame 3'], f'{OUT}/eggs.png')
NM = lambda k: NAMES.get(k, k[:1].upper() + k[1:])
sheet([('%s + %s = normal %s%s' % (NM(h['a']), NM(h['b']), NM(h['sp']), ' (random species, both contest pets)' if h['both'] else ' (partner species)'), h['frames']) for h in J['hybrids']], 'SAMPLE BABIES: no special parts, a normal pet (partner species, or a normal random species when both parents are contest pets)', ['Egg', 'Hatchling', 'Adult', 'Mythic'], f'{OUT}/hybrid-samples.png')
sheet([(NAMES[sp] + ' wearing crown, torch, cape, boots', g) for sp, g in J['gear'].items()], 'HOLDS THINGS: gear on the contest pets', ['Adult', 'Mythic'], f'{OUT}/gear-check.png')
allrows = [(NAMES[sp], [f[0] for f in st]) for sp, st in J['strips'].items()] + [('reference: in-game Lord Kek sprite (same 32x32 size and stages)', J['ref'])]
sheet(allrows, 'ALL THREE CONTEST PETS next to a normal in-game sprite', STAGES, f'{OUT}/all-stages.png')

if J.get('slOld'):
    sheet([('BEFORE (old art)', J['slOld']), ('AFTER (v2, more wow)', J['slNew'])], 'STAR-LORD KEK: before / after (32x32 shown 8 times size)', ['Egg', 'Hatchling', 'Juvenile', 'Adult', 'Elder', 'Mythic'], f'{OUT}/starlordkek-before-after.png')
