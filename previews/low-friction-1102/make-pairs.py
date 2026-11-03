# Side-by-side before|after pairs: python3 make-pairs.py
import os
from PIL import Image, ImageDraw, ImageFont
names=['mypets','rare-room','nest','raid','gear','home','play','breed','cemetery']
os.makedirs('pairs',exist_ok=True)
try: F=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',22)
except Exception: F=ImageFont.load_default()
for n in names:
  for w in ('1280','390'):
    b,a=f'before-{n}-{w}.png',f'after-{n}-{w}.png'
    if not (os.path.exists(b) and os.path.exists(a)): print('skip',n,w); continue
    B,A=Image.open(b).convert('RGB'),Image.open(a).convert('RGB'); g=16; H=36
    im=Image.new('RGB',(B.width+A.width+g,max(B.height,A.height)+H),'white'); d=ImageDraw.Draw(im)
    im.paste(B,(0,H)); im.paste(A,(B.width+g,H))
    lb,la=(f'BEFORE (main a6d77f4696) {n} @{w}',f'AFTER (low-friction-1102) {n} @{w}') if w=='1280' else (f'BEFORE main · {n}',f'AFTER branch · {n}')
    d.text((8,6),lb,fill='black',font=F); d.text((B.width+g+8,6),la,fill=(0,90,0),font=F)
    im.save(f'pairs/pair-{n}-{w}.png'); print('ok',n,w,im.size)
