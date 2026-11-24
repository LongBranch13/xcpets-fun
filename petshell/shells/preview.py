#!/usr/bin/env python3
"""
Pictures of the Pet Shells (run make_shells.py first): for each design the front (with the device's pet screen on the glass),
a three-quarter view and the back, plus previews/all.png with the three side by side.

The shells print in one colour; these pictures colour each face from the pet's own sprite, the way it looks after painting
(or when printed on a multi-colour printer). Rendered with three.js in the sandbox's Chromium (Playwright).
Run: python3 petshell/shells/preview.py   (needs node with the 'playwright' and 'three' packages: see THREE below)
"""
import os
import json
import subprocess
import numpy as np
import trimesh
from PIL import Image
import make_shells as M

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
THREE = os.environ.get('THREE_DIR', '/tmp/claude-0/r3/node_modules/three')     # npm i three@0.170.0
WORK = os.path.join(M.OUT, '.render')


def sprite_rgb(species):
    im = Image.open(os.path.join(ROOT, 'img', 'theme', 'sp-%s.png' % species)).convert('RGBA')
    return np.asarray(im)


def colour_lookup(d, species):
    """(x, y) on the shell -> RGB of the sprite pixel there (head as drawn, torso from the repeated body row)"""
    spr = sprite_rgb(species)
    args = DESIGN_ARGS[species]
    (r0, r1), body_row, center, chin = args['head'], args['body_row'], args['center'], args.get('chin', M.CHIN_Y)

    def at(x, y):
        c = int(np.floor(x / M.PIX + center))
        if y >= chin:
            r = r1 - int(np.floor((y - chin) / M.PIX))
            if r < r0:
                r = r0
        else:
            r = body_row
        c = min(max(c, 0), spr.shape[1] - 1)
        r = min(max(r, 0), spr.shape[0] - 1)
        px = spr[r, c]
        if px[3] < 128:                                  # outside the sprite: nearest opaque pixel in that row
            row = spr[r]
            opaque = np.where(row[:, 3] >= 128)[0]
            if len(opaque):
                px = row[opaque[np.argmin(np.abs(opaque - c))]]
        return px[:3] / 255.0
    return at


DESIGN_ARGS = {
    'pepe': dict(head=(11, 23), body_row=26, center=15.5),
    'bobo': dict(head=(10, 24), body_row=26, center=15.5),
    'dodo': dict(head=(9, 17), body_row=22, center=14.5, chin=67.6),
}


def coloured(tm, at, back=False):
    """split faces so each has its own colour; returns (vertices, colours, normals)"""
    v, f = trimesh.remesh.subdivide_to_size(tm.vertices, tm.faces, max_edge=0.8, max_iter=12)
    tm = trimesh.Trimesh(v, f, process=False)
    tri = tm.vertices[tm.faces]
    cen = tri.mean(1)
    n = tm.face_normals
    cols = np.zeros((len(cen), 3))
    for i, (x, y, z) in enumerate(cen):
        c = at(x, y)
        if back and n[i, 2] < -0.5:
            c = 0.55 * c + 0.45 * np.array([0.92, 0.92, 0.9])    # the back reads as a lighter shade, so its writing shows
        if z < M.FRONT_Z - 0.2 and n[i, 2] > 0.5 and z > M.GLASS_Z + 0.1:   # relief floors: a touch darker, like paint in a groove
            c = c * 0.8
        cols[i] = c
    return tri.reshape(-1, 3), np.repeat(cols, 3, axis=0), np.repeat(n, 3, axis=0)


def export(name, d):
    front = trimesh.load(os.path.join(M.OUT, '.%s-front-asm.stl' % name))
    back = trimesh.load(os.path.join(M.OUT, '.%s-back-asm.stl' % name))
    at = colour_lookup(d, name)
    out = {}
    for part, tm in (('front', front), ('back', back)):
        v, c, n = coloured(tm, at, back=(part == 'back'))
        out[part] = {'v': np.round(v, 3).ravel().tolist(), 'c': np.round(c, 3).ravel().tolist(), 'n': np.round(n, 3).ravel().tolist()}
    out['panel'] = list(M.PANEL)
    out['window'] = list(M.WINDOW)
    out['title'] = d['title']
    out['species'] = name
    ex = np.ptp(np.concatenate([front.vertices, back.vertices]), axis=0)
    out['size'] = [round(float(e)) for e in ex]
    with open(os.path.join(WORK, '%s.json' % name), 'w') as f:
        json.dump(out, f)
    return out


def pet_frame(seed, species, stage=3):
    js = ("const PC=require(%r);let p=null;for(let i=0;i<400;i++){const q=PC.generate({blockHash:PC.sha256Hex(%r+i),petId:i+1});if(q.species===%r){p=q;break}}"
          "const f=PC.renderFrames(p,{stage:%d,gearOverride:{}})[0];console.log(JSON.stringify({w:f.width,h:f.height,d:Array.from(f.data)}))") % (
        os.path.join(ROOT, 'js', 'pet-core.js'), seed, species, stage)
    try:
        return json.loads(subprocess.check_output(['node', '-e', js], text=True))
    except Exception:
        return None


HTML = r'''<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Silk;src:url(silk.woff2)}
html,body{margin:0;background:#141a2e}canvas{display:block}</style>
<script type="importmap">{"imports":{"three":"./three/build/three.module.js"}}</script></head><body>
<script type="module">
import * as THREE from 'three';
const q = new URLSearchParams(location.search), name = q.get('n'), view = q.get('v');
const D = await (await fetch(name + '.json')).json();
const pet = await (await fetch(name + '-pet.json')).json();
await document.fonts.load('20px Silk');
const W = 900, H = 1200;
const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
r.setSize(W, H); r.setPixelRatio(1); r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
r.shadowMap.enabled = true;
document.body.appendChild(r.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#141a2e');
function mesh(p) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p.v, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(p.n, 3));
  const c = new THREE.Float32BufferAttribute(p.c.map(x => Math.pow(x, 2.2)), 3); g.setAttribute('color', c);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.0, flatShading: true }));
  m.castShadow = true; m.receiveShadow = true; return m;
}
const grp = new THREE.Group(); grp.add(mesh(D.front)); grp.add(mesh(D.back));
// the screen: what the device shows (same layout as the firmware's pet screen)
const cv = document.createElement('canvas'); cv.width = 170 * 4; cv.height = 320 * 4; const x = cv.getContext('2d');
x.imageSmoothingEnabled = false; x.scale(4, 4);
x.fillStyle = '#0e0b16'; x.fillRect(0, 0, 170, 320);
x.fillStyle = '#ffd166'; x.font = '8px Silk'; x.fillText('XCPETS', 6, 12); x.fillStyle = '#4fd18b'; x.fillText('87%', 140, 12);
const pc = document.createElement('canvas'); pc.width = pet.w; pc.height = pet.h; const id = pc.getContext('2d').createImageData(pet.w, pet.h); id.data.set(pet.d); pc.getContext('2d').putImageData(id, 0, 0);
x.drawImage(pc, 5, 20, 160, 160);
x.textAlign = 'center'; x.fillStyle = '#ffd166'; x.font = '16px Silk'; x.fillText(D.title.toUpperCase(), 85, 202);
x.fillStyle = '#c9cfe8'; x.font = '8px Silk'; x.fillText('#4207  ADULT  RARE', 85, 218);
x.fillStyle = '#4fd18b'; x.font = '10px Silk'; x.fillText('FED TODAY', 85, 242); x.fillStyle = '#ffd166'; x.fillText('STREAK 12 DAYS', 85, 258);
x.fillStyle = '#9aa3c7'; x.font = '8px Silk'; x.fillText('PRESS: FEED QR', 85, 306);
const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.NearestFilter;
const [px0, px1, py0, py1] = D.panel;
const scr = new THREE.Mesh(new THREE.PlaneGeometry(px1 - px0, py1 - py0), new THREE.MeshBasicMaterial({ map: tex }));
scr.position.set((px0 + px1) / 2, (py0 + py1) / 2, -0.05); grp.add(scr);
scene.add(grp);
const box = new THREE.Box3().setFromObject(grp), ctr = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
grp.position.sub(ctr);
if (view === 'back') grp.rotation.y = Math.PI;
if (view === 'three') { grp.rotation.y = -0.6; grp.rotation.x = 0.28; }
const cam = new THREE.PerspectiveCamera(22, W / H, 10, 2000);
const dist = Math.max(sz.y * 1.12, sz.x * 1.12 * H / W) / (2 * Math.tan(THREE.MathUtils.degToRad(11)));
cam.position.set(0, 0, dist); cam.lookAt(0, 0, 0);
scene.add(new THREE.HemisphereLight('#ffffff', '#3a3550', 1.35));
const key = new THREE.DirectionalLight('#ffffff', 2.2); key.position.set(-60, 90, 160); key.castShadow = true; scene.add(key);
const rim = new THREE.DirectionalLight('#9fc3ff', 0.9); rim.position.set(120, -40, -60); scene.add(rim);
r.render(scene, cam);
document.title = 'ready';
</script></body></html>'''

NODE = r'''
const { chromium } = require('playwright');
(async () => {
  const [port, outDir, ...jobs] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 1 });
  for (const j of jobs) {
    const [n, v] = j.split(':');
    await p.goto(`http://127.0.0.1:${port}/r.html?n=${n}&v=${v}`);
    await p.waitForFunction(() => document.title === 'ready', null, { timeout: 60000 });
    await p.screenshot({ path: `${outDir}/${n}-${v}.png` });
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
'''


def main():
    os.makedirs(WORK, exist_ok=True)
    os.makedirs(M.PREV, exist_ok=True)
    if not os.path.exists(os.path.join(WORK, 'three')):
        os.symlink(THREE, os.path.join(WORK, 'three'))
    font = os.path.join(ROOT, 'fonts', 'raid', 'silkscreen.woff2')
    if not os.path.exists(font):
        font = [os.path.join(ROOT, 'fonts', 'raid', f) for f in os.listdir(os.path.join(ROOT, 'fonts', 'raid')) if 'ilk' in f.lower() and f.endswith('.woff2')][0]
    with open(font, 'rb') as a, open(os.path.join(WORK, 'silk.woff2'), 'wb') as b:
        b.write(a.read())
    with open(os.path.join(WORK, 'r.html'), 'w') as f:
        f.write(HTML)
    with open(os.path.join(WORK, 'shot.js'), 'w') as f:
        f.write(NODE)
    names, metas = [], {}
    for name, fn in M.DESIGNS.items():
        if not os.path.exists(os.path.join(M.OUT, '.%s-front-asm.stl' % name)):
            continue
        d = fn()
        metas[name] = export(name, d)
        pet = pet_frame('shell-preview-', name)
        with open(os.path.join(WORK, '%s-pet.json' % name), 'w') as f:
            json.dump(pet, f)
        names.append(name)
    srv = subprocess.Popen(['python3', '-m', 'http.server', '8765', '--bind', '127.0.0.1'], cwd=WORK, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        import time
        time.sleep(0.8)
        jobs = ['%s:%s' % (n, v) for n in names for v in ('front', 'three', 'back')]
        subprocess.check_call(['node', os.path.join(WORK, 'shot.js'), '8765', WORK] + jobs, cwd=WORK)
    finally:
        srv.terminate()
    from PIL import ImageDraw, ImageFont
    title_font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 40) if os.path.exists('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf') else ImageFont.load_default()
    small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 24) if os.path.exists('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf') else ImageFont.load_default()
    fronts = []
    for n in names:
        ims = [Image.open(os.path.join(WORK, '%s-%s.png' % (n, v))) for v in ('front', 'three', 'back')]
        sheet = Image.new('RGB', (2700, 1300), '#141a2e')
        for i, im in enumerate(ims):
            sheet.paste(im, (i * 900, 100))
        dr = ImageDraw.Draw(sheet)
        sz = metas[n]['size']
        dr.text((40, 30), 'XCPETS Pet Shell: %s   (%d x %d x %d mm)' % (metas[n]['title'], sz[0], sz[1], sz[2]), fill='#ffd166', font=title_font)
        for i, lab in enumerate(('Front', 'Three-quarter', 'Back')):
            dr.text((i * 900 + 40, 1250), lab, fill='#c9cfe8', font=small)
        sheet.save(os.path.join(M.PREV, '%s.png' % n))
        fronts.append(ims[0])
        print('preview', n)
    if len(fronts) == 3:
        sheet = Image.new('RGB', (2700, 1300), '#141a2e')
        for i, im in enumerate(fronts):
            sheet.paste(im, (i * 900, 100))
        dr = ImageDraw.Draw(sheet)
        dr.text((40, 30), 'XCPETS Pet Shell: pick your pet', fill='#ffd166', font=title_font)
        for i, n in enumerate(names):
            dr.text((i * 900 + 40, 1250), metas[n]['title'], fill='#c9cfe8', font=small)
        sheet.save(os.path.join(M.PREV, 'all.png'))


if __name__ == '__main__':
    main()
