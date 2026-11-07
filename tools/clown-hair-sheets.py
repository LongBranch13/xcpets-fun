"""Build deterministic contact sheets + pixel-perfect animated previews."""
import json,sys
from pathlib import Path
from PIL import Image,ImageDraw
root=Path(sys.argv[1]); rows=json.loads((root/'frames.json').read_text())['out']
names=['Egg (no gear)','Hatchling','Juvenile','Adult','Elder','Mythic']
def sprite(r,f=0):return Image.frombytes('RGBA',(32,32),bytes(r['frames'][f]))
for species in ['peepo','pepe','wojak','doge']:
 rs=[r for r in rows if r['species']==species];sheet=Image.new('RGB',(1152,260),'#211a30');d=ImageDraw.Draw(sheet);d.text((20,12),species.upper()+' / CLOWN HAIR / PREVIEW ONLY',fill='white')
 for i,r in enumerate(rs):
  sheet.paste(sprite(r).resize((160,160),Image.Resampling.NEAREST),(i*192+16,45));d.text((i*192+16,220),names[r['stage']],fill='white')
  ims=[sprite(r,f).resize((256,256),Image.Resampling.NEAREST).convert('RGB') for f in range(4)]
  ims[0].save(root/f'{species}-{r["stage"]}.png');ims[0].save(root/f'{species}-{r["stage"]}.gif',save_all=True,append_images=ims[1:],duration=250,loop=0)
 sheet.save(root/f'{species}-all-stages.png')
all=Image.new('RGB',(1152,1040),'#211a30')
for i,s in enumerate(['peepo','pepe','wojak','doge']):all.paste(Image.open(root/f'{s}-all-stages.png'),(0,i*260))
all.save(root/'clown-hair-contact-sheet.png')
