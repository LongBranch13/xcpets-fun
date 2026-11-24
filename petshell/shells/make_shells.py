#!/usr/bin/env python3
"""
XCPETS Pet Shell: builds the three printable shells (Hatchy the egg, Chonk the critter, Spook the ghost).

Every shell holds the same parts:
  - LilyGO T-Display-S3 (non-touch, no header pins), screen facing out, USB-C at the bottom.
  - A flat LiPo battery up to 31 x 52 x 6.5 mm behind the board (for example a 603048, 3.7 V, ~850 mAh).
  - 4 x M2 x 8 mm self-tapping screws hold the two halves together.

Board measurements come from LilyGO's own 3D model (github.com/Xinyuan-LilyGO/T-Display-S3, dimensions/t-display-s3-full.stl),
measured Nov 24 2026. Shell frame used below (millimetres): x to the right, y up (USB-C at the bottom), z towards the viewer,
z = 0 is the top of the screen glass.

Outputs (written next to this file):
  out/<name>-front.stl, out/<name>-back.stl   one part each, already lying the right way up for printing
  out/<name>.3mf                              both halves on one plate
  out/fit-test.stl                            a 15-minute flat frame to check the board fits before a full print
  previews/<name>.png                         a picture of each shell

Needs: python3 -m pip install numpy shapely scikit-image trimesh manifold3d fast-simplification matplotlib rtree
Run:   python3 petshell/shells/make_shells.py            (all three, about a minute)
       python3 petshell/shells/make_shells.py hatchy     (just one)
"""
import os
import sys
import math
import numpy as np
import shapely
from shapely.geometry import Polygon, Point, box, LineString
from shapely.affinity import scale as sscale, translate as stranslate
from shapely.ops import unary_union
import trimesh
import manifold3d as m3d
from skimage import measure

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
PREV = os.path.join(HERE, 'previews')

# ---------------------------------------------------------------------------------------------------------------- board
CL = 0.30                                  # fit clearance around the board (FDM printers print holes a little small)
PCB_X = (-13.35, 13.00)                    # PCB outline across (the side reset button is the -x edge)
PCB_Y = (-1.20, 60.80)                     # -1.2 = front of the USB-C socket, 60.8 = top edge of the board
GLASS_Z = 0.0                              # top of the screen glass
PCB_FRONT_Z = -5.18                        # board front face (screen side)
PCB_BACK_Z = -6.38                         # board back face = the seam between the two halves
PARTS_BACK_Z = -9.88                       # deepest part on the back (USB shell, battery plug)
PANEL = (-12.75, 12.75, 6.75, 56.50)       # LCD module outline x0, x1, y0, y1
WINDOW = (-12.0, 12.0, 8.1, 55.1)          # visible window cut in the front wall (shows the whole 170 x 320 picture)
BUTTONS = [(9.25, 2.25), (-8.75, 2.25)]    # the two front buttons (BOOT and KEY), centres
BTN_TOP_Z = -2.68                          # top of the button plungers
USB = (0.12, -3.60, 8.75, 3.16)            # USB-C centre x, centre z, width, height
RESET = (10.25, -6.38)                     # side reset button: y, z (on the -x edge)

# ---------------------------------------------------------------------------------------------------------------- shell
FRONT_WALL = 1.6
FRONT_Z = GLASS_Z + FRONT_WALL              # outside of the front
BATT = (31.5, 53.0, 6.6)                    # battery bay x, y, z (inside)
BATT_Y0 = 5.0
BATT_TOP_Z = -10.30
BACK_WALL = 2.0
BACK_Z = BATT_TOP_Z - BATT[2] - BACK_WALL   # outside of the back
CHAMFER = 3.0                               # 45 degree edge on front and back (round designs)
STEP = 1.6                                  # pixel designs: one half-pixel step around the front and back edges
BOTTOM_Y = -7.4                             # flat bottom with the USB-C port
SCREWS = [(19.6, 13.0), (-19.6, 13.0), (19.6, 50.0), (-19.6, 50.0)]
SCREW_PILOT = 1.75                          # M2 self-tapping into plastic
SCREW_CLEAR = 2.4
SCREW_HEAD = 4.4
SCREW_SEAT_Z = PCB_BACK_Z - 3.0             # screw heads sit here: an M2 x 8 then bites 5 mm into the front half
VOX = 0.30                                  # surface detail (mm)


def rrect(x0, y0, x1, y1, r):
    return box(x0 + r, y0 + r, x1 - r, y1 - r).buffer(r, quad_segs=16)


def ellipse(cx, cy, rx, ry, rot=0.0):
    e = sscale(Point(0, 0).buffer(1.0, quad_segs=32), rx, ry)
    if rot:
        from shapely.affinity import rotate
        e = rotate(e, rot, origin=(0, 0))
    return stranslate(e, cx, cy)


def smooth(poly, r):
    """rounds every outside and inside corner by about r"""
    return poly.buffer(r, quad_segs=16).buffer(-2 * r, quad_segs=16).buffer(r, quad_segs=16)


def core(edge=CHAMFER):
    """the outline every design must cover: board, battery, screws, buttons and USB-C, plus walls"""
    m = 2.4 + edge
    parts = [
        rrect(PCB_X[0] - CL - m, BOTTOM_Y, PCB_X[1] + CL + m, PCB_Y[1] + CL + m, 4),
        rrect(-BATT[0] / 2 - m, BATT_Y0 - m, BATT[0] / 2 + m, BATT_Y0 + BATT[1] + m, 4),
        rrect(-18.2 - edge - 1.5, BOTTOM_Y, 18.2 + edge + 1.5, 8.0, 4),            # button tabs
    ]
    for (x, y) in SCREWS:
        parts.append(Point(x, y).buffer(SCREW_HEAD / 2 + 1.2 + edge))
    return unary_union(parts)


# ---------------------------------------------------------------------------------------------------------------- designs
def zigzag(x0, x1, y, amp, n, width):
    pts = []
    for i in range(n + 1):
        x = x0 + (x1 - x0) * i / n
        pts.append((x, y + (amp if i % 2 else -amp)))
    return LineString(pts).buffer(width / 2, cap_style='round', join_style='round')


def egg_outline():
    A, B, yc = 35.5, 55.0, 37.5
    pts = []
    for i in range(400):
        a = 2 * math.pi * i / 400
        t = math.sin(a)
        x = A * math.cos(a) * (1 - 0.12 * t)
        pts.append((x, yc + B * t))
    egg = Polygon(pts)
    return smooth(unary_union([egg, core()]).intersection(box(-60, BOTTOM_Y, 60, 200)), 5.0)


def design_hatchy():
    sil = egg_outline()
    eng = [zigzag(-23.5, 23.5, 69.0, 3.2, 9, 1.6)]
    eng += [ellipse(-8.5, 79.5, 2.6, 3.6), ellipse(8.5, 79.5, 2.6, 3.6)]                 # someone is peeking out
    holes = [(0.0, 88.0)]
    return dict(name='hatchy', title='Hatchy', blurb='the egg that is about to crack', sil=sil, front=eng, holes=holes)


def design_chonk():
    body = rrect(-33, BOTTOM_Y, 33, 72, 22)
    ears = []
    for s in (-1, 1):
        ears.append(Polygon([(s * 11, 64), (s * 31, 60), (s * 26, 86)]).buffer(3.5, quad_segs=16))
    feet = [ellipse(-18, BOTTOM_Y - 0.8, 9, 4.2), ellipse(18, BOTTOM_Y - 0.8, 9, 4.2)]
    arms = [ellipse(-33.5, 28, 4, 7.5, 20), ellipse(33.5, 28, 4, 7.5, -20)]
    sil = smooth(unary_union([body] + ears + feet + arms + [core()]), 2.2)
    eng = [ellipse(-12, 69, 3.6, 4.6), ellipse(12, 69, 3.6, 4.6)]
    mouth = LineString([(-5, 64.5), (-2.5, 62.6), (0, 64.3), (2.5, 62.6), (5, 64.5)]).buffer(0.8, cap_style='round', join_style='round')
    eng.append(mouth)
    for s in (-1, 1):
        eng.append(Polygon([(s * 17, 67.5), (s * 26.5, 65.0), (s * 23.5, 79)]).buffer(0.6).difference(
            Polygon([(s * 17, 67.5), (s * 26.5, 65.0), (s * 23.5, 79)]).buffer(-1.0)))
    holes = [(24.8, 76.0)]
    return dict(name='chonk', title='Chonk', blurb='a round critter with a screen for a belly', sil=sil, front=eng, holes=holes)


def design_spook():
    top = Point(0, 50).buffer(32.5, quad_segs=64)
    mid = box(-32.5, BOTTOM_Y + 2, 32.5, 50)
    tails = [ellipse(-25, BOTTOM_Y - 1.5, 7.5, 6.0), ellipse(25, BOTTOM_Y - 1.5, 7.5, 6.0)]
    arms = [ellipse(-33, 32, 6.5, 4.0, -25), ellipse(33, 32, 6.5, 4.0, 25)]
    sil = smooth(unary_union([top, mid] + tails + arms + [core()]), 2.0)
    eng = [ellipse(-10.5, 69.5, 4.0, 6.0), ellipse(10.5, 69.5, 4.0, 6.0), ellipse(0, 62.8, 2.4, 1.8)]
    holes = [(0.0, 77.5)]
    return dict(name='spook', title='Spook', blurb='a little ghost from the XCPETS cemetery', sil=sil, front=eng, holes=holes)


EXTRA_DESIGNS = {'hatchy': design_hatchy, 'chonk': design_chonk, 'spook': design_spook}


# ---------------------------------------------------------------------------------------------------------------- pets from the game
# Jake (Nov 24 2026): the shells are pets from the game: Pepe, Bobo and Dodo. Each shell is the pet's own pixel-art icon
# (img/theme/sp-<species>.png, the same art the site shows), one sprite pixel = PIX mm. The head is drawn as it is; the body row
# is repeated downwards to make a tall torso that holds the board, so the screen sits on the pet's shirt like a print.
# Dark lines inside the face (eyes, brows, mouth) are cut 0.9 mm into the front so they show (and can be painted with a paint pen).
PIX = 3.2
CHIN_Y = 62.0                       # the head starts just above the top of the board


def sprite_path(species):
    """the shells use the Mythic look: mythic/<species>.png is a real Mythic pet of that species drawn by js/pet-core.js
    (stage 5, no gear, background removed; see mythic/README.md). Falls back to the site's species icon."""
    m = os.path.join(HERE, 'mythic', '%s.png' % species)
    return m if os.path.exists(m) else os.path.join(HERE, '..', '..', 'img', 'theme', 'sp-%s.png' % species)


def sprite_rows(species):
    from PIL import Image
    im = Image.open(sprite_path(species)).convert('RGBA')
    px = im.load()
    rows = []
    for y in range(im.size[1]):
        row = ''
        for x in range(im.size[0]):
            r, g, b, a = px[x, y]
            if a < 128: row += '.'
            elif r + g + b < 150: row += '#'
            elif r > 200 and g > 200 and b > 200: row += 'w'
            elif r > 150 and g < 80: row += 'r'
            elif b > 150 and r < 120: row += 'u'
            elif g > r and g > b: row += 'g'
            else: row += 'o'
        rows.append(row)
    return rows


# Filament colours for the multi-colour files (at most 5, so a 4-slot AMS plus one swap, or two AMS units, can print them).
# Every sprite pixel is printed in the nearest of these.
GOLD = '#d4a838'                     # the Mythic gold rim, drawn round the whole shell
PALETTES = {
    'pepe': [('green', '#6aa84f'), ('black', '#1a1020'), ('white', '#f4f1ea'), ('blue', '#3d6fd1'), ('red', '#c4483c'), ('gold', GOLD)],
    'bobo': [('brown', '#704728'), ('black', '#1a1020'), ('white', '#f4f1ea'), ('red', '#cc1414'), ('tan', '#c4805b'), ('gold', GOLD)],
    'dodo': [('grey', '#4a4a56'), ('light grey', '#7a7a88'), ('black', '#1a1020'), ('white', '#f4f1ea'), ('red', '#c41a1a'), ('gold', GOLD)],
}


def sprite_rgba(species):
    from PIL import Image
    return np.asarray(Image.open(sprite_path(species)).convert('RGBA')).astype(int)


def nearest(pal, rgb):
    best, bd = 0, 1e9
    for i, (_, hx) in enumerate(pal):
        c = np.array([int(hx[k:k + 2], 16) for k in (1, 3, 5)])
        dd = float(((c - rgb[:3]) ** 2).sum())
        if dd < bd:
            best, bd = i, dd
    return best


LEG_GAP = 8.0                       # half-width of the gap between the legs: the USB-C plug goes in here


def hexrgb(hx):
    return np.array([int(hx[k:k + 2], 16) for k in (1, 3, 5)])


def pixel_pet(species, head, center_col, deep, shallow, holes, title, blurb, pix=PIX, chin=CHIN_Y, torso=None, round_body=None, limbs=None):
    """A whole pet, body shaped, in the Mythic look: sprite pixels of `pix` mm with a gold rim round the outside.
    head: (first_row, last_row) of the Mythic sprite drawn as-is above the chin (it includes the hand-to-chin pose).
    torso: dict(cols=n, fill, light, shade) a straight body below the chin, n pixels wide, in the shirt colours.
    round_body: dict(cx, cy, rx, ry, fill, belly, wing=(first_row, [widths], colour)) a round, chubby body instead.
    limbs: dict(sleeve, arm, sleeve_rows, arm_rows, arm_w, leg, foot, leg_w, leg_rows); arms hang from a straight torso,
    legs stand below the flat bottom with a gap in the middle for the USB-C plug. The feet are flat, so it stands up.
    deep / shallow: sprite colours cut 1.2 mm / 0.5 mm into the front (a two-level pixel relief)."""
    rows = sprite_rows(species)
    rgba = sprite_rgba(species)
    sq, fdeep, fshallow = [], [], []
    paint = []                                        # (polygon, hex) for everything that is not the head sprite
    r0, r1 = head
    def col_x(c): return (c - center_col) * pix
    def cell(c, k):                                   # k = rows below the chin, clipped at the flat bottom
        return box(col_x(c), max(BOTTOM_Y, chin - (k + 1) * pix), col_x(c + 1), chin - k * pix)
    head_cells = set()
    for r in range(r0, r1 + 1):
        y0 = chin + (r1 - r) * pix
        for c, ch in enumerate(rows[r]):
            if ch == '.':
                continue
            head_cells.add((c, r))
            px = box(col_x(c), y0, col_x(c + 1), y0 + pix)
            sq.append(px)
            inner = all(0 <= r + dr < len(rows) and 0 <= c + dc < len(rows[r]) and rows[r + dr][c + dc] != '.' for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if inner and r != r1:
                if ch in deep: fdeep.append(px)
                elif ch in shallow: fshallow.append(px)
    nrows = int(math.ceil((chin - BOTTOM_Y) / pix))
    side_cols = None
    if torso:
        T = torso
        n = T['cols']
        t0 = int(round(center_col - n / 2)); t1 = t0 + n - 1
        side_cols = (t0, t1)
        for k in range(nrows):
            for c in range(t0, t1 + 1):
                hx = '#1a1020' if c in (t0, t1) else T['light'] if c == t0 + 1 else T['shade'] if c == t1 - 1 else T['fill']
                paint.append((cell(c, k), hx))
    if round_body:
        R = round_body
        cells = set()
        for k in range(-14, nrows + 30):          # a round belly may reach below the flat bottom: the USB-C plug has its own tunnel
            yc = chin - (k + 0.5) * pix
            for c in range(-20, 60):
                xc = col_x(c) + pix / 2
                if ((xc - R.get('cx', 0)) / R['rx']) ** 2 + ((yc - R['cy']) / R['ry']) ** 2 <= 1:
                    if k < 0 and (c, r1 + 1 + k) in head_cells:
                        continue                      # the head is drawn there
                    cells.add((c, k))
        bx_, by_, brx, bry = R.get('belly', (0, R['cy'] - R['ry'] * 0.25, R['rx'] * 0.55, R['ry'] * 0.55))
        for (c, k) in cells:
            xc, yc = col_x(c) + pix / 2, chin - (k + 0.5) * pix
            hx = R['belly_hex'] if ((xc - bx_) / brx) ** 2 + ((yc - by_) / bry) ** 2 <= 1 else R['fill']
            paint.append((box(col_x(c), chin - (k + 1) * pix, col_x(c + 1), chin - k * pix), hx))
        body_low = {}
        for (c, k) in cells:
            body_low[c] = min(body_low.get(c, 1e9), chin - (k + 1) * pix)
        k0, widths, whx = R.get('wing', (None, [], None))
        for i, w in enumerate(widths):              # little wings out of the widest part
            k = k0 + i
            row = [c for c, kk in cells if kk == k]
            for sd in (-1, 1):
                for j in range(w):
                    c = min(row) - 1 - j if sd < 0 else max(row) + 1 + j
                    paint.append((box(col_x(c), chin - (k + 1) * pix, col_x(c + 1), chin - k * pix), whx))
    else:
        body_low = {}
    if limbs:
        L = limbs
        if side_cols:
            t0, t1 = side_cols
            aw, ar = L.get('arm_w', 3), L.get('arm_rows', 7)
            for k in range(ar):
                last = k == ar - 1
                hx = L['sleeve'] if k < L.get('sleeve_rows', 2) else L['arm']
                for sd in (-1, 1):
                    for j in range(aw + (1 if last else 0)):
                        c = t0 - 1 - j if sd < 0 else t1 + 1 + j
                        paint.append((cell(c, k), hx))
        lw, lr = L.get('leg_w', 4), L.get('leg_rows', 2)
        g = LEG_GAP / pix
        for sd in (-1, 1):
            inner_c = math.floor(center_col - g - 1 + 1e-6) if sd < 0 else math.ceil(center_col + g - 1e-6)
            legc = [inner_c - j if sd < 0 else inner_c + j for j in range(lw)]
            top = min([body_low.get(c, BOTTOM_Y) for c in legc] + [BOTTOM_Y])   # legs start under the body
            for k in range(lr):
                y1 = top - k * pix
                last = k == lr - 1
                cs = legc + ([legc[-1] - 1 if sd < 0 else legc[-1] + 1] if last else [])   # the feet point outwards
                for c in cs:
                    paint.append((box(col_x(c), y1 - pix, col_x(c + 1), max(y1, body_low.get(c, BOTTOM_Y)) + 0.01), L.get('foot', L['leg']) if last else L['leg']))
    sil = unary_union(sq + [p for p, _ in paint]).buffer(0.02, join_style='mitre').buffer(-0.02, join_style='mitre')
    if sil.geom_type != 'Polygon':
        sil = max(sil.geoms, key=lambda g: g.area)
    if not sil.contains(core(STEP)):
        raise RuntimeError('%s: the body is too small for the board, battery and screws' % species)
    rim = sil.difference(sil.buffer(-pix + 0.01, join_style='mitre'))
    # colour regions: gold rim first, then the painted body, then the head sprite pixels
    from shapely.prepared import prep
    by_hex = {}
    for p, hx in paint:
        by_hex.setdefault(hx, []).append(p)
    painted = [(hx, unary_union(ps)) for hx, ps in by_hex.items()]
    prim, ppaint = prep(rim), [(hexrgb(hx), prep(g)) for hx, g in painted]
    gold = hexrgb(GOLD)
    def colour_at(x, y):
        pt = Point(x, y)
        if prim.covers(pt):
            return gold
        c = int(math.floor(x / pix + center_col))
        if y >= chin:
            r = r1 - int(math.floor((y - chin) / pix))
            if r0 <= r <= r1 and 0 <= c < rgba.shape[1] and rgba[r, c, 3] >= 128:
                return rgba[r, c, :3]
        for rgb, g in ppaint:
            if g.covers(pt):
                return rgb
        r = min(max(r1 - int(math.floor((y - chin) / pix)), r0), r1)   # just off a pixel edge: nearest head pixel
        opaque = np.where(rgba[r][:, 3] >= 128)[0]
        return rgba[r][opaque[np.argmin(np.abs(opaque - min(max(c, 0), rgba.shape[1] - 1)))], :3] if len(opaque) else gold
    pal, buckets = PALETTES.get(species), {}
    if pal:
        for (c, r) in head_cells:
            y0 = chin + (r1 - r) * pix
            buckets.setdefault(nearest(pal, rgba[r, c]), []).append(box(col_x(c), y0, col_x(c + 1), y0 + pix))
        for hx, g in painted:
            buckets.setdefault(nearest(pal, hexrgb(hx)), []).append(g)
    hole_xy = [(col_x(c), chin + (r1 - r) * pix + pix / 2) for (c, r) in holes]
    def merged(lst):
        return unary_union(lst).buffer(0.02, join_style='mitre').buffer(-0.02, join_style='mitre') if lst else None
    regions = []
    if pal:
        gi = [i for i, (nm, _) in enumerate(pal) if nm == 'gold'][0]
        for i, (nm, hx) in enumerate(pal):
            if i == gi:
                regions.append((nm, hx, rim))
            elif i in buckets:
                reg = merged(buckets[i]).intersection(sil).difference(rim)
                if not reg.is_empty and reg.area > 0.5:
                    regions.append((nm, hx, reg))
    return dict(name=species, title=title, blurb=blurb, sil=sil, pixel=True, deep=merged(fdeep), shallow=merged(fshallow), holes=hole_xy, front=[],
                regions=regions, colour_at=colour_at)


def design_pepe():
    return pixel_pet('pepe', (7, 24), 16, '#', 'w', [(15.5, 9)], 'Pepe', 'Mythic Pepe, hand on chin, standing tall in his blue tee', pix=2.7,
                     torso=dict(cols=21, fill='#3d6fd1', light='#688fdb', shade='#325bab'),
                     limbs=dict(sleeve='#3d6fd1', arm='#6aa84f', leg='#6aa84f', foot='#6aa84f', sleeve_rows=2, arm_rows=8, arm_w=3, leg_w=4, leg_rows=4))


def design_bobo():
    return pixel_pet('bobo', (4, 25), 16, '#', 'w', [(6.5, 6)], 'Bobo', 'Mythic Bobo, the bear in his red tee', pix=2.6,
                     torso=dict(cols=22, fill='#cc1414', light='#d74848', shade='#a71010'),
                     limbs=dict(sleeve='#cc1414', arm='#704728', leg='#704728', foot='#1a1020', sleeve_rows=2, arm_rows=8, arm_w=3, leg_w=4, leg_rows=4))


def design_dodo():
    return pixel_pet('dodo', (3, 15), 18, '#', '', [(20.5, 5)], 'Dodo', 'Mythic Dodo, round and chubby, on red feet', pix=3.0, chin=70.0,
                     round_body=dict(cx=0, cy=28, rx=38, ry=46, fill='#4a4a56', belly_hex='#7a7a88', belly=(0, 14, 22, 26),
                                     wing=(10, [2, 3, 3, 3, 2, 1], '#3d3d47')),
                     limbs=dict(leg='#c41a1a', foot='#c41a1a', leg_w=3, leg_rows=4))


DESIGNS = {'pepe': design_pepe, 'bobo': design_bobo, 'dodo': design_dodo}
DESIGNS_ALL = dict(DESIGNS, **EXTRA_DESIGNS)


# ---------------------------------------------------------------------------------------------------------------- geometry helpers
def to_manifold(tm):
    mesh = m3d.Mesh(vert_properties=np.asarray(tm.vertices, dtype=np.float32), tri_verts=np.asarray(tm.faces, dtype=np.uint32))
    out = m3d.Manifold(mesh)
    if out.status() != m3d.Error.NoError:
        raise RuntimeError('mesh is not a closed solid: %s' % out.status())
    return out


def to_trimesh(mf):
    me = mf.to_mesh()
    return trimesh.Trimesh(vertices=np.asarray(me.vert_properties)[:, :3], faces=np.asarray(me.tri_verts), process=True)


def cross_section(poly):
    """shapely polygon(s) -> manifold CrossSection (outer rings counter-clockwise, holes clockwise)"""
    polys = [poly] if poly.geom_type == 'Polygon' else list(poly.geoms)
    rings = []
    for p in polys:
        p = shapely.geometry.polygon.orient(p, 1.0)
        rings.append(np.asarray(p.exterior.coords)[:-1])
        for h in p.interiors:
            rings.append(np.asarray(h.coords)[:-1])
    return m3d.CrossSection(rings, m3d.FillRule.EvenOdd)


def prism(poly, z0, z1):
    """extrude a shapely outline from z0 to z1"""
    return m3d.Manifold.extrude(cross_section(poly), z1 - z0).translate((0, 0, z0))


def cube(x0, x1, y0, y1, z0, z1):
    return m3d.Manifold.cube((x1 - x0, y1 - y0, z1 - z0)).translate((x0, y0, z0))


def cyl_z(x, y, r, z0, z1, n=40):
    return m3d.Manifold.cylinder(z1 - z0, r, r, n).translate((x, y, z0))


def body(sil):
    """the solid pet: the outline extruded from back to front with 45 degree edges, made with a distance field"""
    x0, y0, x1, y1 = sil.bounds
    pad = 2.0
    xs = np.arange(x0 - pad, x1 + pad, VOX)
    ys = np.arange(y0 - pad, y1 + pad, VOX)
    zs = np.arange(BACK_Z - pad, FRONT_Z + pad, VOX)
    X, Y = np.meshgrid(xs, ys, indexing='ij')
    flat_x, flat_y = X.ravel(), Y.ravel()
    inside = shapely.contains_xy(sil, flat_x, flat_y)
    dist = shapely.distance(sil.exterior, shapely.points(flat_x, flat_y))
    d2 = np.where(inside, -dist, dist).reshape(X.shape).astype(np.float32)       # 2D signed distance (negative inside)
    zc, hz = (FRONT_Z + BACK_Z) / 2, (FRONT_Z - BACK_Z) / 2
    dz = (np.abs(zs - zc) - hz).astype(np.float32)                                # distance to the front/back planes
    D = np.maximum(d2[:, :, None], dz[None, None, :])
    D = np.maximum(D, (d2[:, :, None] + dz[None, None, :] + CHAMFER) / math.sqrt(2))
    verts, faces, _, _ = measure.marching_cubes(D, level=0.0, spacing=(VOX, VOX, VOX))
    verts += np.array([xs[0], ys[0], zs[0]])
    tm = trimesh.Trimesh(vertices=verts, faces=faces[:, ::-1], process=True)
    trimesh.smoothing.filter_taubin(tm, lamb=0.5, nu=-0.53, iterations=12)
    tm = simplify(tm, 90000)
    if tm.volume < 0:
        tm.invert()
    return to_manifold(tm)


def simplify(tm, faces):
    import fast_simplification
    if len(tm.faces) <= faces:
        return tm
    v, f = fast_simplification.simplify(tm.vertices.astype(np.float32), tm.faces.astype(np.int32), target_reduction=1 - faces / len(tm.faces))
    out = trimesh.Trimesh(vertices=v, faces=f, process=True)
    out.merge_vertices()
    trimesh.repair.fix_normals(out)
    return out


def text_outline(txt, size, cx, cy, mirror=False, weight='bold'):
    from matplotlib.textpath import TextPath
    from matplotlib.font_manager import FontProperties
    tp = TextPath((0, 0), txt, size=size, prop=FontProperties(family='DejaVu Sans', weight=weight))
    shape = None
    for ring in tp.to_polygons():
        if len(ring) < 3:
            continue
        p = Polygon(ring).buffer(0)
        shape = p if shape is None else shape.symmetric_difference(p)
    x0, y0, x1, y1 = shape.bounds
    shape = stranslate(shape, cx - (x0 + x1) / 2, cy - (y0 + y1) / 2)
    if mirror:
        shape = sscale(shape, -1, 1, origin=(cx, cy))
    return shape


# ---------------------------------------------------------------------------------------------------------------- the inside (same for every design)
def board_pocket():
    """front half: the board and screen, the button room and the USB-C opening"""
    x0, x1 = PCB_X[0] - CL, PCB_X[1] + CL
    p = cube(x0, x1, PCB_Y[0] - CL, PCB_Y[1] + CL, PCB_BACK_Z - 0.01, GLASS_Z)
    # window, with a 45 degree bevel outwards so the screen is easy to see from the side
    wx0, wx1, wy0, wy1 = WINDOW
    for i in range(6):
        g = i * FRONT_WALL / 5
        z0 = GLASS_Z - 0.01 + i * FRONT_WALL / 6
        p = p + cube(wx0 - g, wx1 + g, wy0 - g, wy1 + g, z0, FRONT_Z + 1)
    # USB-C: a tight hole through the bottom wall, and a pocket outside so a plug's rubber reaches the socket
    ux, uz, uw, uh = USB
    hole = rrect(ux - uw / 2 - 0.55, uz - uh / 2 - 0.55, ux + uw / 2 + 0.55, uz + uh / 2 + 0.55, 1.6)
    p = p + prism(hole, 0, 1).rotate((90, 0, 0)).scale((1, 30, 1)).translate((0, PCB_Y[0] + 0.5, 0))
    plug = rrect(ux - 6.9, uz - 3.6, ux + 6.9, uz + 3.6, 3.0)
    p = p + prism(plug, 0, 1).rotate((90, 0, 0)).scale((1, 20, 1)).translate((0, PCB_Y[0] - 1.6, 0))
    # side reset button: a pin hole for a paperclip
    ry, rz = RESET
    pin = m3d.Manifold.cylinder(20, 0.9, 0.9, 24).rotate((0, 90, 0)).translate((x0 - 19.5, ry, rz))
    p = p + pin + cube(x0 - 0.6, x0 + 1, ry - 1.6, ry + 1.6, rz - 1.0, rz + 1.0)
    return p


def button_tabs():
    """front half: each front button gets a springy tab cut into the front wall, with a peg that presses the button"""
    cut, add = None, None
    for (bx, by) in BUTTONS:
        s = 1 if bx > 0 else -1
        inner, outer = bx - s * 3.0, bx + s * 7.5                     # hinge is on the outside edge, away from the screen
        tx0, tx1 = min(inner, outer), max(inner, outer)
        ty0, ty1 = by - 2.4, by + 2.4
        tab = box(tx0, ty0, tx1, ty1)
        slot = box(tx0 - 0.7, ty0 - 0.7, tx1 + 0.7, ty1 + 0.7).difference(tab)
        hinge = box(outer - 0.01 if s > 0 else outer - 0.7, ty0 - 0.7, outer + 0.7 if s > 0 else outer + 0.01, ty1 + 0.7)
        slot = slot.difference(hinge)
        c = prism(slot, GLASS_Z - 3.5, FRONT_Z + 2)
        room = cube(tx0 - 0.7, tx1 + 0.7, ty0 - 0.7, ty1 + 0.7, GLASS_Z - 3.5, GLASS_Z)       # the tab must be free to move
        c = c + room
        peg = cyl_z(bx, by, 1.35, BTN_TOP_Z + 0.25, GLASS_Z + 0.05)
        tabsolid = cube(tx0, tx1, ty0, ty1, GLASS_Z - 0.05, FRONT_Z + 2)
        dot = prism(Point(bx, by).buffer(1.6), FRONT_Z - 0.5, FRONT_Z + 3)                   # feel dot on top (engraved ring)
        dot = dot - prism(Point(bx, by).buffer(1.0), FRONT_Z - 0.6, FRONT_Z + 3)
        cut = c if cut is None else cut + c
        a = peg
        add = a if add is None else add + a
        cut = cut + dot
    return cut, add


def back_pocket():
    """back half: room for the parts on the back of the board and the battery"""
    x0, x1 = PCB_X[0] + 1.05, PCB_X[1] - 1.05                  # 1 mm ledges along both long edges hold the board flat
    p = cube(x0, x1, PCB_Y[0] - CL, PCB_Y[1] + CL, PARTS_BACK_Z - 0.4, PCB_BACK_Z + 0.01)
    bx = BATT[0] / 2
    p = p + cube(-bx, bx, BATT_Y0, BATT_Y0 + BATT[1], BATT_TOP_Z - BATT[2], PARTS_BACK_Z + 0.1)
    p = p + cube(-bx, x1, PCB_Y[0] + 0.6, BATT_Y0 + 1, PARTS_BACK_Z - 0.4 - 2.0, PARTS_BACK_Z)     # battery wire path to its plug
    ry, rz = RESET
    p = p + cube(PCB_X[0] - CL, x0 + 0.1, ry - 1.6, ry + 1.6, PCB_BACK_Z - 1.2, PCB_BACK_Z + 0.01)  # reset button sticks out here
    return p


def screws(front):
    out = None
    for (x, y) in SCREWS:
        if front:
            h = cyl_z(x, y, SCREW_PILOT / 2, PCB_BACK_Z - 0.01, GLASS_Z - 0.6, 24)
        else:
            h = cyl_z(x, y, SCREW_CLEAR / 2, BACK_Z - 1, PCB_BACK_Z + 0.01, 24) + cyl_z(x, y, SCREW_HEAD / 2, BACK_Z - 1, SCREW_SEAT_Z, 32)
        out = h if out is None else out + h
    return out


def lanyard(holes):
    out = None
    for (x, y) in holes:
        h = cyl_z(x, y, 1.9, BACK_Z - 1, FRONT_Z + 1, 32)
        out = h if out is None else out + h
    return out


def back_engraving(d):
    """the back: XCPETS, the pet's name, a box for the shell number, and a reminder that no keys live inside"""
    z0 = BACK_Z - 1
    depth = 0.6
    parts = unary_union([
        text_outline('XCPETS', 7.0, 0, 46),
        text_outline(d['title'].upper() + ' PET SHELL', 3.4, 0, 38.5),
        text_outline('No.', 4.0, -13.5, 27),
        text_outline('/21', 4.0, 12.5, 27),
        text_outline('NO KEYS INSIDE.', 2.6, 0, 8.0),
        text_outline('ONLY VIBES.', 2.6, 0, 4.0),
    ])
    plate = rrect(-9.0, 23.4, 8.0, 30.6, 1.2)
    parts = sscale(parts, -1, 1, origin=(0, 0))                    # read from the back
    plate = sscale(plate, -1, 1, origin=(0, 0))
    eng = prism(parts, z0, BACK_Z + depth)
    eng = eng + prism(plate, z0, BACK_Z + 0.4)                     # a shallow box where the slicer's text tool writes the number
    return eng


def front_engraving(d):
    if not d['front']:
        return None
    return prism(unary_union(d['front']), FRONT_Z - 0.8, FRONT_Z + 2)


def pixel_body(sil):
    """blocky: straight sides, and a one-step pixel edge (STEP mm) all round the front and the back"""
    inner = sil.buffer(-STEP, join_style='mitre')
    return prism(sil, BACK_Z + STEP, FRONT_Z - STEP) + prism(inner, BACK_Z, FRONT_Z)


def build(d):
    whole = pixel_body(d['sil']) if d.get('pixel') else body(d['sil'])
    whole = whole - lanyard(d['holes'])
    big = 400
    front_box = cube(-big, big, -big, big, PCB_BACK_Z, big)
    back_box = cube(-big, big, -big, big, -big, PCB_BACK_Z)
    front = whole ^ front_box
    back = whole ^ back_box
    cut, pegs = button_tabs()
    front = front - board_pocket() - cut - screws(True)
    fe = front_engraving(d)
    if fe is not None:
        front = front - fe
    if d.get('deep') is not None:
        front = front - prism(d['deep'], FRONT_Z - 1.2, FRONT_Z + 2)
    if d.get('shallow') is not None:
        front = front - prism(d['shallow'], FRONT_Z - 0.5, FRONT_Z + 2)
    front = front + (pegs ^ front_box)
    back = back - back_pocket() - screws(False) - back_engraving(d)
    back = back - board_pocket()                                  # the USB-C pocket and reset pin hole reach below the seam
    return front, back


def print_pose(mf, front):
    """front half: front face down on the bed; back half: back face down. Both centred and resting on z = 0."""
    if front:
        mf = mf.rotate((180, 0, 0))
    lo, hi = mf.bounding_box()[:3], mf.bounding_box()[3:]
    return mf.translate((-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2]))


def write_3mf_colour(path, title, groups):
    """multi-colour 3MF: each group is (object name, [(part name, hex colour, trimesh)]); one object per group, its colour
    regions as parts (components), each with its display colour, so a slicer opens it as one shell with coloured parts"""
    import zipfile
    res, items, oid, x = [], [], 1, 0.0
    colours = []
    for _, parts in groups:
        for _, hx, _ in parts:
            if hx not in colours:
                colours.append(hx)
    res.append('<basematerials id="1">%s</basematerials>' % ''.join('<base name="%s" displaycolor="%sFF"/>' % (h, h.upper()) for h in colours))
    oid = 2
    for gname, parts in groups:
        allv = np.concatenate([tm.vertices for _, _, tm in parts])
        lo, hi = allv.min(0), allv.max(0)
        dx = x - lo[0]
        x += (hi[0] - lo[0]) + 8
        comps = []
        for pname, hx, tm in parts:
            v = tm.vertices.copy()
            v[:, 0] += dx
            vs = ''.join('<vertex x="%.4f" y="%.4f" z="%.4f"/>' % tuple(p) for p in v)
            ts = ''.join('<triangle v1="%d" v2="%d" v3="%d"/>' % tuple(t) for t in tm.faces)
            res.append('<object id="%d" name="%s" type="model" pid="1" pindex="%d"><mesh><vertices>%s</vertices><triangles>%s</triangles></mesh></object>' % (oid, pname, colours.index(hx), vs, ts))
            comps.append('<component objectid="%d"/>' % oid)
            oid += 1
        res.append('<object id="%d" name="%s" type="model"><components>%s</components></object>' % (oid, gname, ''.join(comps)))
        items.append('<item objectid="%d"/>' % oid)
        oid += 1
    model = ('<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="en-US" '
             'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><metadata name="Title">%s</metadata>'
             '<resources>%s</resources><build>%s</build></model>') % (title, ''.join(res), ''.join(items))
    _zip3mf(path, model)


def _zip3mf(path, model):
    import zipfile
    ct = ('<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
          '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>')
    rels = ('<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>')
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', ct)
        z.writestr('_rels/.rels', rels)
        z.writestr('3D/3dmodel.model', model)


def write_3mf(path, parts):
    """a minimal 3MF (one object per part, side by side) that PrusaSlicer, Bambu Studio, Orca and Cura open"""
    import zipfile
    objs, items, x = [], [], 0.0
    for i, (name, tm) in enumerate(parts, 1):
        v = tm.vertices.copy()
        lo, hi = v.min(0), v.max(0)
        v[:, 0] += x - lo[0]
        x += (hi[0] - lo[0]) + 8
        vs = ''.join('<vertex x="%.4f" y="%.4f" z="%.4f"/>' % tuple(p) for p in v)
        ts = ''.join('<triangle v1="%d" v2="%d" v3="%d"/>' % tuple(t) for t in tm.faces)
        objs.append('<object id="%d" name="%s" type="model"><mesh><vertices>%s</vertices><triangles>%s</triangles></mesh></object>' % (i, name, vs, ts))
        items.append('<item objectid="%d"/>' % i)
    model = ('<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="en-US" '
             'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><metadata name="Title">XCPETS Pet Shell</metadata>'
             '<resources>%s</resources><build>%s</build></model>') % (''.join(objs), ''.join(items))
    ct = ('<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
          '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>')
    rels = ('<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>')
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', ct)
        z.writestr('_rels/.rels', rels)
        z.writestr('3D/3dmodel.model', model)


def fit_test():
    """a thin frame with the exact board pocket, window, buttons and USB-C opening: print it first to check the fit"""
    outline = rrect(PCB_X[0] - CL - 3, -6.0, PCB_X[1] + CL + 3, PCB_Y[1] + CL + 3, 3)
    plate = prism(outline, PCB_FRONT_Z - 1.0, FRONT_Z)
    cut, pegs = button_tabs()
    plate = plate - board_pocket() - cut
    plate = plate + (pegs ^ cube(-99, 99, -99, 99, PCB_FRONT_Z - 1.0, 99))
    return plate


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(PREV, exist_ok=True)
    want = sys.argv[1:] or list(DESIGNS)
    report = []
    for key in want:
        d = DESIGNS_ALL[key]()
        front, back = build(d)
        meshes = []
        for part, mf, is_front in (('front', front, True), ('back', back, False)):
            pm = print_pose(mf, is_front)
            tm = to_trimesh(pm)
            if len(trimesh.grouping.group_rows(tm.edges_sorted, require_count=1)):
                raise RuntimeError('%s %s has holes in its surface' % (key, part))
            tm.export(os.path.join(OUT, '%s-%s.stl' % (key, part)))
            meshes.append(('%s %s' % (d['title'], part), tm))
            report.append('%s-%s: %.0f x %.0f x %.1f mm, %d triangles, %.1f cm3' % ((key, part) + tuple(tm.extents) + (len(tm.faces), tm.volume / 1000)))
        write_3mf(os.path.join(OUT, '%s.3mf' % key), meshes)
        if d.get('regions'):
            # multi-colour: the front split into its sprite colours; the back in the torso's main colour
            fp, bp = print_pose(front, True), print_pose(back, False)
            # the pose moves the parts; cut the colour regions in the assembled frame, then apply the same move
            def posed(mf, ref, is_front):
                if is_front:
                    mf = mf.rotate((180, 0, 0))
                    r = ref.rotate((180, 0, 0))
                else:
                    r = ref
                bb = r.bounding_box()
                return mf.translate((-(bb[0] + bb[3]) / 2, -(bb[1] + bb[4]) / 2, -bb[2]))
            fparts = []
            for nm, hx, poly in d['regions']:
                piece = front ^ prism(poly, -400, 400)
                if piece.is_empty():
                    continue
                fparts.append(('%s front %s' % (d['title'], nm), hx, to_trimesh(posed(piece, front, True))))
            main = max(d['regions'], key=lambda r: r[2].area)
            write_3mf_colour(os.path.join(OUT, '%s-multicolour.3mf' % key), 'XCPETS Pet Shell %s (multi-colour)' % d['title'],
                             [('%s front' % d['title'], fparts), ('%s back' % d['title'], [('%s back' % d['title'], main[1], to_trimesh(bp))])])
            report.append('%s-multicolour: %d colours (%s)' % (key, len(d['regions']), ', '.join(r[0] for r in d['regions'])))
        np.save(os.path.join(OUT, '.%s-front.npy' % key), np.array([0]))
        # keep the assembled (not print-posed) halves for the preview pictures
        to_trimesh(front).export(os.path.join(OUT, '.%s-front-asm.stl' % key))
        to_trimesh(back).export(os.path.join(OUT, '.%s-back-asm.stl' % key))
        os.remove(os.path.join(OUT, '.%s-front.npy' % key))
    if not sys.argv[1:] or 'fit' in want:
        ft = to_trimesh(print_pose(fit_test(), True))
        ft.export(os.path.join(OUT, 'fit-test.stl'))
        report.append('fit-test: %.0f x %.0f x %.1f mm' % tuple(ft.extents))
    print('\n'.join(report))


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'fit':
        os.makedirs(OUT, exist_ok=True)
        ft = to_trimesh(print_pose(fit_test(), True))
        ft.export(os.path.join(OUT, 'fit-test.stl'))
        print('fit-test: %.0f x %.0f x %.1f mm' % tuple(ft.extents))
    else:
        main()
