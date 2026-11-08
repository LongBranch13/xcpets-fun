"""Build deterministic contact sheets + pixel-perfect animated previews."""
import json,sys
from pathlib import Path
from PIL import Image,ImageDraw
root=Path(sys.argv[1]); rows=json.loads((root/'frames.json').read_text())['out']
names=['Egg (no gear)','Hatchling','Juvenile','Adult','Elder','Mythic']
def sprite(r,f=0):return Image.frombytes('RGBA',(32,32),bytes(r['frames'][f]))
SP=list(dict.fromkeys(r['species'] for r in rows))
for species in SP:
 rs=[r for r in rows if r['species']==species];sheet=Image.new('RGB',(1152,260),'#211a30');d=ImageDraw.Draw(sheet);d.text((20,12),species.upper()+' / CLOWN HAIR / PREVIEW ONLY',fill='white')
 for i,r in enumerate(rs):
  sheet.paste(sprite(r).resize((160,160),Image.Resampling.NEAREST),(i*192+16,45));d.text((i*192+16,220),names[r['stage']],fill='white')
  ims=[sprite(r,f).resize((256,256),Image.Resampling.NEAREST).convert('RGB') for f in range(4)]
  ims[0].save(root/f'{species}-{r["stage"]}.png');ims[0].save(root/f'{species}-{r["stage"]}.gif',save_all=True,append_images=ims[1:],duration=250,loop=0)
 sheet.save(root/f'{species}-all-stages.png')
all=Image.new('RGB',(1152,260*len(SP)),'#211a30')
for i,s in enumerate(SP):all.paste(Image.open(root/f'{s}-all-stages.png'),(0,i*260))
all.save(root/'clown-hair-contact-sheet.png')

# Large owner-review sheet, the three requested heads at every growth stage.
font_path='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
from PIL import ImageFont
font=ImageFont.truetype(font_path,20)
large=Image.new('RGB',(1920,1080),'#211a30');d=ImageDraw.Draw(large)
d.text((24,14),'HONK V2 / KEVIN, DODO AND HOMER / PREVIEW ONLY',font=font,fill='white')
for j,sp in enumerate(['kevin','dodo','homer']):
 for i,r in enumerate(r for r in rows if r['species']==sp):
  x=i*320+32;y=70+j*330
  large.paste(sprite(r).resize((256,256),Image.Resampling.NEAREST),(x,y))
  d.text((x,y+265),sp.upper()+' / '+names[r['stage']],font=font,fill='white')
large.save(root/'kevin-dodo-homer-closeups.png')
# Side-by-side native pixels enlarged nearest-neighbour: approved source and v2.
ref=root.parent/'clown-hair-honk-1107'/'frames.json'
if ref.exists():
 old=json.loads(ref.read_text())['out'];compare=Image.new('RGB',(1536,650),'#211a30');d=ImageDraw.Draw(compare)
 for j,(data,label) in enumerate([(old,'APPROVED HONK SOURCE'),(rows,'HONK V2 / GAPS CLOSED')]):
  d.text((20,j*325+10),label,font=font,fill='white')
  for i,sp in enumerate(['peepo','pepe','kevin','dodo']):
   r=next(r for r in data if r['species']==sp and r['stage']==3)
   compare.paste(sprite(r).resize((256,256),Image.Resampling.NEAREST),(i*384+32,j*325+40))
   d.text((i*384+32,j*325+299),sp.upper(),font=font,fill='white')
 compare.save(root/'approved-honk-vs-v2.png')
