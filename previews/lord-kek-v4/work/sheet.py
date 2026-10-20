import json,sys
from PIL import Image,ImageDraw
d=json.load(open(sys.argv[1]));title=sys.argv[3];Z=4
rows=d['out'];cw=32*Z+8;W=330+6*2*cw;H=40+len(rows)*(32*Z+30)
im=Image.new('RGB',(W,H),(20,20,24));dr=ImageDraw.Draw(im)
dr.text((10,10),title,fill=(255,255,255))
st=['Egg','Hatchling','Juvenile','Adult','Elder','Mythic']
for ri,r in enumerate(rows):
  y0=40+ri*(32*Z+30);dr.text((10,y0),r['name'][:60],fill=(220,220,220));dr.text((10,y0+14),r['name'][60:120],fill=(220,220,220));dr.text((10,y0+28),r['name'][120:],fill=(220,220,220))
  for s in range(6):
    for f in range(2):
      px=r['frames'][s][f];t=Image.new('RGB',(32,32))
      t.putdata([tuple(px[i:i+3]) for i in range(0,len(px),4)])
      x0=330+(s*2+f)*cw;im.paste(t.resize((32*Z,32*Z),Image.NEAREST),(x0,y0+16))
      if ri==0: dr.text((x0,y0+2),st[s]+' f'+str(f),fill=(255,220,120))
im.save(sys.argv[2])
