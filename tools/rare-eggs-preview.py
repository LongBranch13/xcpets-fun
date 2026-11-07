from pathlib import Path
import json, os
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(os.environ.get('XCPETS_ARTIFACT_ROOT','/workspace/xcpets'))
D=ROOT/'previews/rare-eggs-build-1107';D.mkdir(parents=True,exist_ok=True)
f=ImageFont.load_default()
data=json.loads((ROOT/'rare-build-render.json').read_text())
def im(a,w=32,h=32): return Image.frombytes('RGBA',(w,h),bytes(a))
def tile(canvas,img,x,y,scale=4):
 # Checkerboard exposes body alpha without changing UI opacity.
 for yy in range(0,img.height*scale,8):
  for xx in range(0,img.width*scale,8):
   ImageDraw.Draw(canvas).rectangle((x+xx,y+yy,x+xx+7,y+yy+7),fill=('#283342' if ((xx+yy)//8)%2 else '#17202b'))
 canvas.paste(img.resize((img.width*scale,img.height*scale),Image.Resampling.NEAREST),(x,y),img.resize((img.width*scale,img.height*scale),Image.Resampling.NEAREST))
rows=[]
for kind,out in data['outcomes'].items():
 sheet=Image.new('RGB',(1000,370),'#0c121d');d=ImageDraw.Draw(sheet);d.text((16,12),kind.upper()+' / REAL GATED ENGINE OUTPUT',font=f,fill='white')
 for a in out['stages']:
  img=im(a['data'],a['width'],a['height']);img.save(D/(kind+'-stage-'+str(a['stage'])+'.png'));native=img
  if a['width']==64: img=img.resize((32,32),Image.Resampling.NEAREST)
  x=16+a['stage']*164;d.text((x,42),['Egg','Hatchling','Juvenile','Adult','Elder','Mythic'][a['stage']],font=f,fill='white');tile(sheet,img,x,65,4)
 a=out['stages'][3]; native=im(a['data'],a['width'],a['height']); control=im(a['control']);cmp=Image.new('RGB',(650,340),'#0c121d');dd=ImageDraw.Draw(cmp);dd.text((12,12),'NORMAL / '+kind.upper()+' / IDENTICAL WORLD PIXEL SCALE',font=f,fill='white');tile(cmp,control,55,55+32*4,4);tile(cmp,native,310,55+(64-native.height)*4,4);cmp.save(D/(kind+'-comparison.png'))
 sheet.save(D/(kind+'-stages.png'));rows.append((kind,sheet.crop((0,0,1000,215))))
cover=Image.new('RGB',(1000,len(rows)*215),'#0c121d')
for i,(kind,img)in enumerate(rows):cover.paste(img,(0,i*215))
cover.save(D/'all-outcomes-stages.png')
chad=json.loads((ROOT/'rare-build-chad-render.json').read_text());cs=Image.new('RGB',(1000,560),'#0c121d');cd=ImageDraw.Draw(cs);cd.text((16,12),'CHAD V4 / REAL COMMON SPECIES / FUTURE GATE ONLY',font=f,fill='white')
for a in chad['previews']:
 tile(cs,im(a['data']),16+a['stage']*164,65+(260 if a['gear'] else 0),4)
cs.save(D/'chad-v4-stages-and-gear.png')
hs=Image.new('RGB',(760,220),'#0c121d');hd=ImageDraw.Draw(hs)
for i,a in enumerate(chad['hybridPreviews']):hd.text((i*250+12,12),'CHAD / '+a['role'].upper()+' / '+a['other'].upper(),font=f,fill='white');tile(hs,im(a['data']),i*250+15,50,4)
hs.save(D/'chad-v4-hybrids.png')
print(D)
