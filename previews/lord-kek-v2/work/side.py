import json
from PIL import Image,ImageDraw,ImageFont
d=json.load(open('sheet.json'))
card=Image.open('../../../design/ref/lord-kek-card.jpg').convert('RGB');card=card.resize((int(card.width*512/card.height),512))
def fr(row,s,f=0):
  px=d['out'][row]['frames'][s][f];t=Image.new('RGB',(32,32));t.putdata([tuple(px[i:i+3]) for i in range(0,len(px),4)]);return t
F=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',16)
W=card.width+3*(256+20)+40;im=Image.new('RGB',(W,600),(20,20,24));dr=ImageDraw.Draw(im)
im.paste(card,(10,50));dr.text((10,12),'Reference card',fill=(255,220,120),font=F)
for i,(row,s,lab) in enumerate([(0,5,'Community Mythic (blue/gold)'),(2,4,'Community Elder + card'),(3,5,'Player Mythic + card (red/gold)')]):
  x=card.width+30+i*276;im.paste(fr(row,s).resize((256,256),Image.NEAREST),(x,50));dr.text((x,12),lab,fill=(255,220,120),font=F)
  im.paste(fr(row,s).resize((128,128),Image.NEAREST),(x,330));im.paste(fr(row,s).resize((64,64),Image.NEAREST),(x+150,330));im.paste(fr(row,s),(x+150,410))
dr.text((card.width+30,560),'DRAFT sprites, branch lord-kek. Not live. 8x / 4x / 2x / 1x.',fill=(200,200,200),font=F)
im.save('../side-by-side-card.png')
