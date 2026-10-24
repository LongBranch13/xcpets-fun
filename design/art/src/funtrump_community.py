"""FUNTRUMP community pet #4 sprite set (PREVIEW, branch funtrump-community). Parody/meme pet, original pixel art.
Stages 0 Egg .. 5 Mythic, 4 idle frames each (1px bob + blink on frame 2). Community look = navy suit + extra-long red tie (v5 'rare' outfit)
with the giant windblown blond hair (v5). Writes PNGs + js/funtrump-sprite.js frame data (palette-key strings, not loaded by any page)."""
import sys,os,json;sys.path.insert(0,os.path.dirname(__file__))
import draw_chars as D
from PIL import Image,ImageDraw
REPO=os.path.abspath(os.path.join(os.path.dirname(__file__),'../../..'))
OUT=os.path.join(REPO,'design/art/funtrump-community');PREV='/workspace/xcpets/previews/funtrump'
for k,v in {'1':'#87552a','2':'#a9743f','3':'#cf9a62','4':'#e6bd85','5':'#f6e2b4','e1':'#f3ead2','e2':'#d8c9a2'}.items():D.PAL.setdefault(k,v)
def egg(frame):
    g=D.Grid();cx=16;cy=19;tilt=[0,1,0,-1][frame]
    g.ell(cx,cy,8,10,'e1')
    for y in range(cy-2,cy+11):
        for x in range(cx+3,cx+9):
            if g.get(x,y)=='e1':g.set(x,y,'e2')
    for y in range(cy-1,cy+10):g.set(cx+tilt,y,'B')            # red tie stripe down the shell
    g.set(cx-1+tilt,cy-1,'B');g.set(cx+1+tilt,cy-1,'B')
    for i,(x,y) in enumerate([(cx-1,cy-10),(cx-3,cy-11),(cx-5,cy-12),(cx-7,cy-12),(cx-2,cy-12),(cx-4,cy-13),(cx-6,cy-14),(cx+1,cy-11)]):  # windblown tuft up-left
        g.rect(x+tilt,y,2,2,'3' if i%2 else '4')
    g.set(cx-8+tilt,cy-13,'5');g.set(cx+2+tilt,cy-10,'2')
    g.outline();return g
def stage(s,frame,look='suit'):
    if s==0:return egg(frame)
    g=D.funtrump_v5(s,'rare' if look=='suit' else 'legendary',frame)
    if frame==2:  # blink: close the pale eye areas for one frame
        for y in range(32):
            for x in range(32):
                if g.g[y][x] in('P',):g.g[y][x]='z'
    return g
NAMES=['0-egg','1-hatchling','2-juvenile','3-adult','4-elder','5-mythic']
BG='#2a1f4a'
MULTI={'A2':'!','o2':'~','e1':'@','e2':'%'}
if __name__=='__main__':
    os.makedirs(OUT,exist_ok=True);os.makedirs(PREV,exist_ok=True)
    frames={};big=[];hood={}
    enc=lambda g:[''.join(k if k and len(k)==1 else ('.' if not k else MULTI[k]) for k in row) for row in g.g]
    for s in range(6):hood[s]=[enc(stage(s,f,'hoodie')) for f in range(4)]
    for s in range(6):
        fr=[stage(s,f) for f in range(4)];frames[s]=[enc(g) for g in fr]
        n=f'{OUT}/funtrump-{NAMES[s]}';fr[0].img(BG).save(n+'.png')
        st=Image.new('RGB',(128,32));[st.paste(x.img(BG),(i*32,0)) for i,x in enumerate(fr)];st.save(n+'-4frames.png')
        b=[x.img(BG,8) for x in fr];b[0].save(n+'-bob.gif',save_all=True,append_images=b[1:],duration=180,loop=0);big.append(b)
    pad=16;lab=22;W=256
    sh=Image.new('RGB',(4*(W+pad)+pad+170,6*(W+lab+pad)+pad+30),(20,20,26));d=ImageDraw.Draw(sh)
    d.text((pad,8),'FUNTRUMP community pet #4 (PREVIEW, parody pixel art) - stages Egg..Mythic x 4 idle frames, 8x',fill=(255,210,63))
    for s in range(6):
        y=30+s*(W+lab+pad);d.text((pad,y),['EGG','HATCHLING','JUVENILE','ADULT','ELDER','MYTHIC'][s],fill=(240,220,140))
        for f in range(4):sh.paste(big[s][f],(pad+f*(W+pad),y+lab))
    sh.save(f'{PREV}/funtrump-sprite-sheet-8x.png')
    pal={k:v for k,v in D.PAL.items() if v and len(k)==1};pal.update({v:D.PAL[k] for k,v in MULTI.items() if k in D.PAL})
    json.dump({'pal':pal,'frames':frames},open(f'{OUT}/frames.json','w'))
    js=os.path.join(REPO,'js/funtrump-sprite.js')
    t=open(os.path.join(os.path.dirname(__file__),'funtrump-sprite.tmpl.js')).read()
    open(js,'w').write(t.replace('/*PAL*/',json.dumps(pal,sort_keys=True)).replace('/*FRAMES*/',json.dumps([frames[s] for s in range(6)])).replace('/*HOODIE*/',json.dumps([hood[s] for s in range(6)])))
    print('ok')
