"""Draft 8-bit sprites for FUNTRUMP (community pet) and STARLORDKEK (story/card character).
Art only, not loaded by the game. Same conventions as js/kek-sprite.js / wizard-sprite.js:
32x32 grid, palette keys, auto 1px ink outline ('n'), 4-frame 1px bob, stages 1-5 (Hatchling..Mythic, gold rim + sparkles at Mythic)."""
from PIL import Image
import os
OUT='/workspace/xcpets/design/art'
PAL={'n':'#14200f','.':None,
 # shared
 'y':'#ffd23f','o':'#c49a1a','w':'#ffffff','E':'#f4f4ee','P':'#111111',
 # funtrump
 'H':'#f2c95c','h':'#d9a43a','L':'#fbe7a1','S':'#f0a46a','s':'#d9824e','r':'#b8584a','Q':'#9aa3ad','q':'#6f7882','R':'#c3cad2','x':'#4d545c',
 # starlordkek
 'G':'#5aa83c','g':'#3d7a2a','K':'#2a2a2e','k':'#141418','M':'#55555e','e':'#ff6b6b','F':'#e8e8e4','f':'#b9b9b4','C':'#2c2c34','c':'#3e3e48',
 'Z':'#ee9748','z':'#c9733a','p':'#f8dfc6','u':'#c25a4f','U':'#8e3a32','Y':'#ffcf3a','j':'#e0a422','J':'#fff0a0','A2':'#f6e27a','a':'#d7b54a','N':'#1f2f5c','v':'#14204a','O':'#ff8a2a','o2':'#d96a1e',
 'B':'#c8342c','b':'#8a1f1a','D':'#5a1210','T':'#6b3f1f','m':'#d8b04a','V':'#9b9ba3'}
def rgb(c):return tuple(int(c[i:i+2],16) for i in (1,3,5))
class Grid:
    def __init__(s,w=32,h=32):s.w,s.h=w,h;s.g=[[None]*w for _ in range(h)]
    def set(s,x,y,k):
        if 0<=x<s.w and 0<=y<s.h:s.g[y][x]=k
    def rect(s,x,y,w,h,k):
        for yy in range(y,y+h):
            for xx in range(x,x+w):s.set(xx,yy,k)
    def ell(s,cx,cy,rx,ry,k):
        for yy in range(int(cy-ry)-1,int(cy+ry)+2):
            for xx in range(int(cx-rx)-1,int(cx+rx)+2):
                if ((xx-cx)/max(rx,.5))**2+((yy-cy)/max(ry,.5))**2<=1.0:s.set(xx,yy,k)
    def get(s,x,y):return s.g[y][x] if 0<=x<s.w and 0<=y<s.h else None
    def outline(s,skip=('y','o')):
        o=[r[:] for r in s.g]
        for y in range(s.h):
            for x in range(s.w):
                if s.g[y][x] is None and any((s.get(x+dx,y+dy) not in (None,'n')+skip) for dx,dy in((1,0),(-1,0),(0,1),(0,-1))):o[y][x]='n'
        s.g=o
    def shift(s,dy):
        g=Grid(s.w,s.h)
        for y in range(s.h):
            for x in range(s.w):
                if 0<=y-dy<s.h:g.g[y][x]=s.g[y-dy][x]
        return g
    def img(s,bg='#142018',scale=1):
        im=Image.new('RGB',(s.w,s.h),rgb(bg));p=im.load()
        for y in range(s.h):
            for x in range(s.w):
                k=s.g[y][x]
                if k and PAL.get(k):p[x,y]=rgb(PAL[k])
        return im.resize((s.w*scale,s.h*scale),Image.NEAREST)
def mythic(g):
    """gold rim one px outside the ink + 3 sparkles, like Lord Kek / Wizard Mythic"""
    o=[r[:] for r in g.g]
    for y in range(g.h):
        for x in range(g.w):
            if g.g[y][x] is None and any(g.get(x+dx,y+dy)=='n' for dx,dy in((1,0),(-1,0),(0,1),(0,-1))):o[y][x]='y'
    g.g=o
    for (x,y) in((2,3),(28,5),(3,20)):
        g.set(x,y,'y');g.set(x-1,y,'o');g.set(x+1,y,'o');g.set(x,y-1,'o');g.set(x,y+1,'o')

# ---------------- FUNTRUMP ----------------
# per stage: head rx/ry, body half-width/height, hair reach (how far the windblown hair sweeps right / up)
FT=[None,dict(hr=5,hy=5,bw=5,bh=4,sw=5,up=3),dict(hr=6,hy=5,bw=6,bh=5,sw=7,up=4),dict(hr=6,hy=6,bw=7,bh=6,sw=9,up=5),
    dict(hr=7,hy=6,bw=8,bh=7,sw=10,up=5),dict(hr=7,hy=6,bw=8,bh=6,sw=10,up=5)]
def ft_face(g,cx,hy,rx,ry,big):
    """Trump caricature face. big=True for the card (64x80). Orange-tan skin, pale eye rings, narrow squint, heavy low brow,
    small pursed lips pushed forward, fleshy wide jowls."""
    g.ell(cx,hy,rx,ry,'Z')
    jy=hy+ry*0.55;jr=max(2,rx*0.38)
    g.ell(cx-rx*0.62,jy,jr,jr*1.1,'Z');g.ell(cx+rx*0.62,jy,jr,jr*1.1,'Z');g.ell(cx,hy+ry*0.75,rx*0.6,ry*0.35,'Z')
    # jowl shading (lower outer edges)
    ed=[(x,y) for y in range(int(hy),g.h) for x in range(g.w) if g.get(x,y)=='Z' and (g.get(x-1,y)!='Z' or g.get(x+1,y)!='Z' or g.get(x,y+1)!='Z')]
    for x,y in ed:g.set(x,y,'z')
    ey=int(hy-ry*0.12)
    if big:
        for ex in (cx-7,cx+7):
            g.ell(ex,ey,4.5,2.6,'p')                        # pale goggle rings
            g.rect(ex-3,ey,7,1,'P');g.set(ex-2,ey-1,'z');g.set(ex+2,ey-1,'z')  # narrow squint
            g.rect(ex-5,ey-4,11,2,'z');g.rect(ex-4,ey-4,9,1,'j')               # heavy low brow + blond brow hair
            g.set(ex-1,ey+1,'z');g.set(ex+1,ey+1,'z')
        g.rect(cx-1,ey-1,3,7,'z');g.rect(cx,ey-1,1,6,'Z');g.rect(cx-2,ey+5,5,1,'z')   # nose
        my=int(hy+ry*0.5)
        g.ell(cx,my,3.2,2.2,'u');g.rect(cx-1,my-1,3,1,'U');g.set(cx,my,'U');g.set(cx-1,my+1,'p')  # pursed, pushed-forward lips
        g.ell(cx,my,5,3.5,'z') if False else None
        for x in (cx-4,cx+4):g.set(x,my,'z');g.set(x,my-1,'z')                    # pucker creases
        g.rect(cx-rx+2,ey+5,3,1,'z');g.rect(cx+rx-4,ey+5,3,1,'z')                  # cheek folds
    else:
        sq=rx>=6
        for ex in ((cx-3,cx+2) if sq else (cx-2,cx+1)):
            g.rect(ex-1,ey-1,4 if sq else 3,3,'p');g.rect(ex,ey,2,1,'P')          # pale ring + squint slit
            g.rect(ex-1,ey-2,4 if sq else 3,1,'z')                                # heavy brow
        my=ey+max(2,int(ry*0.55))
        g.set(cx-1 if sq else cx,my,'u');g.set(cx,my,'U');
        if sq:g.set(cx+1,my,'u');g.set(cx,my+1,'u')
        g.set(cx,my-1,'z')
    return ey
def ft_hair(g,cx,top,rx,up,sw,big):
    """golden windblown mass: combed FORWARD into a front swoop over the brow, then blown up and to the LEFT"""
    hx=cx-sw*0.45;hyy=top-up*0.45;rr=rx+sw*0.55;ry=up*0.55+2
    g.ell(hx+rr*0.3,hyy+1,rr*0.7,ry,'Y');g.ell(hx-rr*0.35,hyy-1,rr*0.65,ry,'Y');g.ell(cx+1,top+1,rx,2,'Y')
    for i in range(int(rr)+2):
        x=int(hx-rr)+i//2-1;y=int(hyy-ry*0.3)+i%4-(i//3)
        if i%2==0:g.set(x-1,y,'Y')
    g.ell(hx+1,hyy-ry*0.45,rr*0.7,1,'J')
    for i in range(0,int(2*rr),3):
        x=int(hx-rr)+i+2;g.set(x,int(hyy)+(i%2),'j');g.set(x-1,int(hyy)+1+(i%2),'j')
    # forward front swoop: a lip of hair hanging over the forehead, curling right->left
    fy=top+(2 if rx>=6 else 0)
    for x in range(cx-rx+1,cx+rx-1):g.set(x,fy,'Y')
    for x in range(cx-rx,cx-1):g.set(x,fy+1,'Y')
    g.set(cx-rx,fy+2,'j');g.set(cx-rx+1,fy+1,'j')
FT=[None,dict(hr=5,hy=5,bw=5,bh=4,sw=5,up=3),dict(hr=6,hy=5,bw=6,bh=5,sw=6,up=4),dict(hr=6,hy=5,bw=7,bh=6,sw=8,up=4),
    dict(hr=7,hy=6,bw=8,bh=6,sw=9,up=4),dict(hr=7,hy=6,bw=8,bh=6,sw=9,up=4)]
def funtrump(stage,frame=0):
    d=FT[stage];g=Grid();base=29;cx=15
    bt=base-d['bh'];hy=bt-d['hy']+1
    g.rect(cx-d['bw'],bt,2*d['bw']+1,d['bh'],'Q')
    for i in range(2):g.set(cx-d['bw']+i,bt+i-1,'Q');g.set(cx+d['bw']-i,bt+i-1,'Q')
    g.rect(cx-d['bw'],bt,2,d['bh'],'q');g.rect(cx+d['bw']-1,bt,2,d['bh'],'R')
    g.rect(cx-d['hr']+1,bt-1,2*d['hr']-1,2,'q')
    # white collar + red tie peek in the hoodie's V
    g.set(cx-1,bt,'w');g.set(cx+1,bt,'w');g.set(cx,bt,'B')
    if d['bh']>=5:g.set(cx,bt+1,'B');g.set(cx-1,bt+d['bh']-2,'R');g.set(cx+1,bt+d['bh']-2,'R')
    ft_face(g,cx,hy,d['hr'],d['hy'],False)
    g.set(cx+d['hr'],int(hy)+1,'z')
    top=int(hy-d['hy']);ft_hair(g,cx,top,d['hr'],d['up'],d['sw'],False)
    g.outline()
    if stage==5:mythic(g)
    for i,(wx,wy) in enumerate(((27,top+1),(28,top+4))):
        if frame%2==i%2:
            for k in range(3):g.set(wx+k,wy,'E')
    return g.shift(-1 if frame%4==1 else 0)

def funtrump_card():
    """64x80 card portrait: the most recognizable version"""
    g=Grid(64,80);cx=33
    # hoodie + hood, white collar and red tie in the V
    g.ell(cx,78,27,14,'Q');g.ell(cx-14,74,9,9,'q');g.ell(cx+15,72,8,8,'R');g.rect(cx-16,61,32,5,'q')
    for y in range(62,80):
        w=max(0,(y-62)//2);g.rect(cx-2-w,y,5+2*w,1,'w') if y<67 else None
    g.rect(cx-1,63,3,2,'B');g.rect(cx-2,65,5,8,'B');g.rect(cx-1,73,3,2,'B');g.set(cx,64,'b')
    g.rect(cx-9,66,1,10,'R');g.rect(cx+9,66,1,10,'R')
    # ear
    g.ell(cx+17,46,2,4,'z')
    ft_face(g,cx,47,17,15,True)
    # HAIR: huge golden mass combed forward, swept up and LEFT, front swoop over the brow
    import math
    g.ell(cx-8,22,22,10,'Y');g.ell(cx-22,15,12,8,'Y');g.ell(cx+3,29,15,5,'Y')
    for i in range(9):g.ell(cx-33+i*2,9+(i%3)-(i//3),2,2,'Y')
    for i in range(8):g.set(cx-34+i%3,16+i*2,'Y');g.set(cx-33,17+i*2,'j')
    g.ell(cx-10,15,15,2,'J');g.ell(cx-23,10,6,2,'J')
    for k in range(7):
        for t in range(24):
            x=cx+12-k*2-t*1.6;y=31-k*2.0-t*0.5-(t/10)**2*3
            if g.get(int(x),int(y))=='Y':g.set(int(x),int(y),'j')
    # forward front swoop hanging over the forehead (the signature comb-over lip), curling to the left
    for x in range(cx-14,cx+12):
        y=33+int(1.5*math.sin((x-cx+14)/26*math.pi))
        g.set(x,y,'Y');g.set(x,y-1,'Y');g.set(x,y-2,'Y')
        if (x-cx)%3==0:g.set(x,y-1,'j')
    g.rect(cx-15,34,3,3,'Y');g.set(cx-16,36,'j')
    g.set(cx-17,35,'Y')
    g.outline()
    return g

# ---------------- FUNTRUMP v3: political-cartoon caricature ----------------
# single-letter keys only in grids: remap the 2-char palette names
PAL['X']=PAL.pop('A2');PAL['i']=PAL.pop('o2')
def v3_face(g,cx,hy,rx,ry,big):
    """strong orange tan (O, shade i), white goggles, squint, heavy brow, jowls, big 'O' duck pucker pushed out"""
    g.ell(cx,hy,rx,ry,'O')
    g.ell(cx-rx*0.65,hy+ry*0.5,rx*0.42,ry*0.42,'O');g.ell(cx+rx*0.65,hy+ry*0.5,rx*0.42,ry*0.42,'O');g.ell(cx,hy+ry*0.72,rx*0.62,ry*0.38,'O')
    ed=[(x,y) for y in range(int(hy),g.h) for x in range(g.w) if g.get(x,y)=='O' and (g.get(x-1,y)!='O' or g.get(x+1,y)!='O' or g.get(x,y+1)!='O')]
    for x,y in ed:g.set(x,y,'i')
    ey=int(hy-ry*0.15)
    if big:
        for ex in (cx-7,cx+7):
            g.ell(ex,ey,5,3,'w')                                   # white goggle rings
            g.rect(ex-3,ey,7,1,'P');g.rect(ex-2,ey+1,5,1,'i')       # squint slit + lower lid
            g.rect(ex-6,ey-5,13,3,'i');g.rect(ex-5,ey-5,11,1,'a')   # heavy brow ridge + pale brow hair
        g.rect(cx-1,ey-1,3,8,'i');g.rect(cx,ey-1,1,7,'O');g.rect(cx-3,ey+6,7,1,'i')
        my=int(hy+ry*0.52)
        g.ell(cx,my,5,4,'i');g.ell(cx,my,4,3,'u');g.ell(cx,my,2,1.5,'U');g.set(cx-2,my-2,'p')  # big O pucker, pushed out
        for x in (cx-7,cx+7):g.rect(x,my-1,1,3,'i')                # pucker creases
    else:
        sq=rx>=6
        for ex in ((cx-3,cx+2) if sq else (cx-2,cx+1)):
            g.rect(ex-1,ey-1,(4 if sq else 3),3,'w');g.rect(ex,ey,2,1,'P');g.rect(ex-1,ey-2,(4 if sq else 3),1,'i')
        my=ey+max(2,int(ry*0.6))
        if sq:g.rect(cx-1,my-1,3,3,'u');g.set(cx,my,'U')            # O pucker
        else:g.rect(cx-1,my,2,2,'u');g.set(cx,my,'U')
    return ey
def v3_hair(g,cx,top,rx,big,lift):
    """classic comb-over: flat swept-back top, big side sweep to the LEFT, forward front swoop over the brow; plus wind lift"""
    if big:
        g.ell(cx+1,top+9,rx+3,9,'X')                                      # dome covering the whole crown
        g.rect(cx-rx-1,top+1,2*rx+5,6,'X')                                # flat, swept-back top
        g.ell(cx-rx+1,top+13,5,8,'X')                                     # side sweep down the left to the ear
        for i in range(lift):g.ell(cx-rx-5-i*3,top+3-i*2,6,2.5,'X')       # windblown lift off to the left
        # forward front swoop: a thick wave over the brow from the right, curling down at the left temple
        import math
        for x in range(cx-rx,cx+rx-2):
            t=(x-(cx-rx))/(2*rx-2);y=top+15+int(3*math.sin(t*math.pi))-int(4*t)
            g.rect(x,y-3,1,4,'X');g.set(x,y+1,'a')
        g.ell(cx-rx+2,top+19,3,3,'X');g.set(cx-rx+2,top+21,'a')
        for x in range(cx-rx,cx+rx+3,3):g.rect(x,top+3,2,1,'a')           # swept-back strands on the flat top
        for x in range(cx-rx+2,cx+rx,4):g.rect(x,top+8,3,1,'a')
        g.rect(cx-rx,top+1,2*rx+2,1,'J')
    else:
        g.rect(cx-rx,top,2*rx+1,2,'X');g.rect(cx-rx-1,top+1,3,2,'X')
        g.rect(cx-rx,top+2,rx+2,1,'X')                                     # front swoop
        for i in range(lift):g.rect(cx-rx-1-i,top-1-i,3,1,'X')             # wind lift
        for x in range(cx-rx+1,cx+rx,2):g.set(x,top,'J')
        g.set(cx-rx,top+3,'a')
def v3_suit(g,cx,bt,bw,bh,base,big):
    g.rect(cx-bw,bt,2*bw+1,base-bt+1,'N');g.rect(cx-bw,bt,2,base-bt+1,'v')
    w=2 if big else 1
    for y in range(bt,base+1):
        k=min(w*2,(y-bt)//(2 if big else 1)+1)
        if y-bt< (8 if big else 3):g.rect(cx-k,y,2*k+1,1,'w')               # white shirt V
    g.rect(cx-(1 if big else 0),bt,(3 if big else 1),base-bt+1,'B')          # extra-long red tie, past the belt
    if big:g.rect(cx-2,bt+2,5,base-bt-2,'B');g.rect(cx-1,base-1,3,2,'b');g.rect(cx-bw,bt+14,2*bw+1,1,'v')  # belt line (tie passes it)
def v3_hoodie(g,cx,bt,bw,base,big):
    g.rect(cx-bw,bt,2*bw+1,base-bt+1,'Q');g.rect(cx-bw,bt,2,base-bt+1,'q');g.rect(cx+bw-1,bt,2,base-bt+1,'R')
    if big:g.rect(cx-8,bt,16,4,'q');g.rect(cx-5,bt+4,1,9,'R');g.rect(cx+5,bt+4,1,9,'R')
def v3_ok_hand(g,x,y,big):
    """pinched-fingers 'OK': thumb + index touching in a ring, other fingers up"""
    if big:
        g.ell(x,y+4,4,4,'O');g.ell(x,y,2.2,2.2,'O');g.set(x,y,'i');g.set(x,y+1,'i')
        for k in range(3):g.rect(x+2+k*2,y-5,1,6,'O');g.set(x+2+k*2,y-5,'i')
        g.rect(x-1,y+8,4,6,'N')
    else:
        g.rect(x,y,2,2,'O');g.set(x+1,y-1,'O');g.set(x+2,y-1,'O');g.set(x,y,'i')
def funtrump_v3_card(variant):
    g=Grid(64,80);cx=32
    base=79;bt=62
    if variant=='B':v3_suit(g,cx,bt,26,0,base,True)
    else:v3_hoodie(g,cx,bt,26,base,True);g.rect(cx-1,bt,3,4,'w');g.rect(cx,bt+1,1,4,'B')
    g.ell(cx+17,50,2,4,'i')
    v3_face(g,cx,50,17,14,True)
    v3_hair(g,cx,23,17,True,3)
    v3_ok_hand(g,54,58,True)
    g.outline()
    return g
FT3=[None,dict(hr=5,hy=5,bw=5,bh=4,lift=1),dict(hr=6,hy=5,bw=6,bh=5,lift=1),dict(hr=6,hy=6,bw=7,bh=6,lift=2),dict(hr=7,hy=6,bw=8,bh=7,lift=2),dict(hr=7,hy=6,bw=8,bh=7,lift=3)]
def funtrump_v3(stage,frame=0,variant='B'):
    d=FT3[stage];g=Grid();base=29;cx=15;bt=base-d['bh']+1;hy=bt-d['hy']
    if variant=='B':v3_suit(g,cx,bt,d['bw'],d['bh'],base,False)
    else:v3_hoodie(g,cx,bt,d['bw'],base,False)
    v3_face(g,cx,hy,d['hr'],d['hy'],False);g.set(cx+d['hr'],hy,'i')
    v3_hair(g,cx,int(hy-d['hy']),d['hr'],False,d['lift'])
    if stage>=4:v3_ok_hand(g,cx+d['bw']+1,bt+1,False)
    g.outline()
    if stage==5:mythic(g)
    return g.shift(-1 if frame%4==1 else 0)
def build_v3():
    ft=f'{OUT}/funtrump';names=['','1-hatchling','2-juvenile','3-adult','4-elder','5-mythic'];tiles=[]
    for s in range(1,6):
        fr=[funtrump_v3(s,f) for f in range(4)]
        fr[0].img('#2a1f4a',1).save(f'{ft}/funtrump-{names[s]}.png')
        strip=Image.new('RGB',(128,32));[strip.paste(x.img('#2a1f4a'),(i*32,0)) for i,x in enumerate(fr)];strip.save(f'{ft}/funtrump-{names[s]}-4frames.png')
        big=[x.img('#2a1f4a',8) for x in fr];big[0].save(f'{ft}/funtrump-{names[s]}-8x.png');big[0].save(f'{ft}/funtrump-{names[s]}-bob.gif',save_all=True,append_images=big[1:],duration=180,loop=0);tiles.append(big[0])
    cards={}
    for v in 'AB':
        c=funtrump_v3_card(v);c.img('#6b7480',1).save(f'{ft}/funtrump-card-{v}.png');cards[v]=c.img('#6b7480',4);cards[v].save(f'{ft}/funtrump-card-{v}-4x.png')
    cards['B'].save(f'{ft}/funtrump-card-4x.png');funtrump_v3_card('B').img('#6b7480',1).save(f'{ft}/funtrump-card.png')
    ref=Image.open(f'{OUT}/funtrump-reference.gif').convert('RGB').resize((320,320))
    W=cards['A'].width;H=cards['A'].height
    o=Image.new('RGB',(320+2*W+48,H+24),(20,20,26));o.paste(ref,(12,12+(H-320)//2));o.paste(cards['A'],(344,12));o.paste(cards['B'],(356+W,12));o.save('/workspace/xcpets/previews/new-characters/funtrump-v3-cards.png')
    sh=Image.new('RGB',(5*268+W+36,H+24),(20,20,26))
    for i,t in enumerate(tiles):sh.paste(t,(12+i*268,12+(H-256)//2))
    sh.paste(cards['B'],(5*268+24,12));sh.save('/workspace/xcpets/previews/new-characters/funtrump-sheet.png')

# ---------------- STARLORDKEK ----------------
def slk_body(g,cx,top,size,throne=False):
    """Kek green head w/ red-eyed Vader mask, white fur collar, black cape, mic in his fist"""
    hr,hh=size,int(size*0.8)
    hy=top+hh
    # cape
    g.ell(cx,hy+hh+size+3,size+3,size+3,'C');g.rect(cx-size-3,hy+hh+size+3,2*size+7,size,'C')
    g.rect(cx-size//2,hy+hh+2,size,size*2,'c')
    # head: frog dome + bulging eye bumps
    g.ell(cx,hy,hr+1,hh,'G')
    g.ell(cx-hr//2,hy-hh+1,hr//2+1,hh//2+1,'G');g.ell(cx+hr//2,hy-hh+1,hr//2+1,hh//2+1,'G')
    for x in range(cx-hr+1,cx+hr):g.set(x,hy-hh+2,'G')
    for x in range(cx-hr,cx+hr+1):g.set(x,hy+hh-1,'g')
    # angry red eyes over the mask
    ey=hy-hh+2
    es=max(1,size//5)
    for ex in (cx-hr//2-es,cx+hr//2-es):
        g.rect(ex,ey,2*es+1,2*es,'e');g.rect(ex+es,ey,max(1,es-1),es,'P');g.rect(ex-1,ey-1,2*es+3,1,'g')
    ey+=2*es-2
    # black Vader mask: helmet brim, triangle nose, grille mouth
    mt=ey+3;hh=max(3,int(hh*0.75))
    g.rect(cx-hr+1,mt,2*hr-1,hh+1,'K');g.rect(cx-hr+2,mt-1,2*hr-3,1,'K')
    for i in range(3):g.set(cx-1+i,mt+1,'M')
    g.set(cx,mt+2,'M')
    for x in range(cx-hr//2,cx+hr//2+1,2):g.set(x,mt+hh-1,'V');g.set(x,mt+hh,'k')
    g.rect(cx-hr+1,mt+hh+1,2*hr-1,1,'k')
    g.set(cx-hr+2,mt+1,'M');g.set(cx+hr-2,mt+1,'M')
    # fur collar (white, shaggy) on his right shoulder / around the neck
    fy=hy+hh+1
    for x in range(cx-hr-1,cx+hr+3):g.set(x,fy+ (x%2),'F');g.set(x,fy+1,'F')
    g.ell(cx+hr,fy+2,3+size//4,3+size//4,'F');g.ell(cx-hr,fy+2,1+size//5,2+size//5,'F');g.set(cx+hr+1,fy+3,'f');g.set(cx+hr-1,fy+4,'f')
    # fist + mic
    g.rect(cx-hr+1,fy+4,3,3,'G');g.set(cx-hr+1,fy+6,'g');g.rect(cx-hr+2,fy+1,1,3,'M');g.set(cx-hr+2,fy,'m');g.set(cx-hr+2,fy-1,'m')
    return hy
def slk_throne_scene(scale_card=False):
    """32x32: Star Lord Kek on the red throne (story/card scene sprite, 4-frame bob)"""
    g=Grid()
    # throne: red back with dark spikes, gold trim
    g.rect(5,4,22,24,'B');g.rect(7,6,18,20,'b')
    for x in range(5,27,3):g.set(x,3,'B');g.set(x,2,'D')
    g.rect(3,18,4,10,'B');g.rect(25,18,4,10,'B');g.rect(3,17,4,1,'m');g.rect(25,17,4,1,'m')
    g.rect(5,27,22,1,'D')
    slk_body(g,16,7,6)
    g.rect(14,26,1,3,'V')  # sword tip resting (ref)
    g.outline(skip=('y','o'))
    return g
def slk_portrait():
    """64x80 card portrait: Star Lord Kek on the red-glowing throne, fur cape, mic, sword"""
    g=Grid(64,80)
    import math
    # glow rays behind
    for yy in range(80):
        for xx in range(64):
            a=math.degrees(math.atan2(yy-26,xx-32));r=math.hypot(xx-32,yy-26)
            if 12<r<40 and int(a//10)%2==0:g.set(xx,yy,'D' if r>26 else 'b')
    g.rect(10,10,44,66,None) if False else None
    g.rect(12,20,40,56,'D');g.rect(14,22,36,52,'b')
    for x in range(12,52,4):g.rect(x,14,2,6,'V');g.set(x,13,'F')
    slk_body(g,32,14,13)
    g.rect(31,62,2,14,'V');g.rect(28,62,8,1,'m')  # sword
    g.outline()
    return g

# ---------------- FUNTRUMP v4: tier outfits (Oct 22 owner: Rare = navy suit + long red tie, Legendary = grey hoodie,
# Mythic proposal = hoodie + gold flourish) and a more instantly-Trump face: BIG swoopy blond-orange comb-over,
# orange-tan skin, white eye areas, squint, pursed pout, boxy head + shoulders ----------------
PAL.update({'W':'#f7c348','l':'#ffeb94','d':'#d18a24','t':'#f08a3a','I':'#fff6e8'})
import math
def v4_head(g,cx,y0,y1,hw,big):
    """boxy head: square jaw, slight jowl flare"""
    for y in range(y0,y1+1):
        f=(y-y0)/max(1,y1-y0);w=hw+(1 if 0.55<f<0.9 else 0)-(2 if f>0.93 else 0)-(1 if f<0.08 else 0)
        g.rect(cx-w,y,2*w+1,1,'t')
    ed=[(x,y) for y in range(y0,y1+1) for x in range(g.w) if g.get(x,y)=='t' and (g.get(x-1,y)!='t' or g.get(x+1,y)!='t' or g.get(x,y+1)!='t')]
    for x,y in ed:g.set(x,y,'z')
def v4_face(g,cx,y0,y1,hw,big):
    v4_head(g,cx,y0,y1,hw,big)
    if big:
        ey=y0+12
        for ex in (cx-8,cx+8):
            g.ell(ex,ey,5.5,3.2,'I')                                # white eye areas (tan-line goggles)
            g.rect(ex-5,ey-4,11,2,'z');g.rect(ex-5,ey-5,11,1,'a')   # heavy brow + blond brow
            g.rect(ex-4,ey-1,9,1,'t');g.rect(ex-3,ey,7,1,'P');g.set(ex+(1 if ex<cx else -1),ey,'U')  # squint: lid down to a slit
            g.rect(ex-3,ey+3,7,1,'z')                               # bags
        g.rect(cx-1,ey-2,3,9,'z');g.rect(cx,ey-2,1,8,'t');g.rect(cx-3,ey+7,7,1,'z')  # nose
        my=ey+12
        g.ell(cx,my,4.5,3,'z');g.ell(cx,my,3.5,2.2,'u');g.rect(cx-1,my,3,1,'U');g.set(cx-2,my-1,'p')  # pursed pout
        for dx in (-5,5):g.rect(cx+dx,my-2,1,4,'z')                  # pucker creases
        g.rect(cx-hw+2,my+4,2*hw-3,1,'z')                            # jowl line
    else:
        ey=y0+3+(1 if hw>=7 else 0)
        for ex in (cx-3,cx+3):
            g.rect(ex-1,ey,3,2,'I');g.rect(ex-1,ey,3,1,'P');g.rect(ex-1,ey-1,3,1,'z')  # white areas + squint slit + brow
        my=ey+3+(1 if y1-y0>=9 else 0)
        g.rect(cx-1,my,3,2,'u');g.set(cx,my,'U')                      # pursed pout
def v4_hair(g,cx,top,hw,big):
    """BIG swoop: tall dome swept from the back-right up and forward, cresting into an overhang that curls down
    over the left brow, with a lifted windblown wave off the left side"""
    if big:
        g.ell(cx+2,top+13,hw+7,12,'W')                 # tall, wide volume
        g.ell(cx-hw-3,top+16,9,8,'W')                  # forward overhang lobe on the left
        g.ell(cx-hw-9,top+9,6,4,'W');g.ell(cx-hw-13,top+5,4,3,'W')  # windblown lift
        g.ell(cx+hw+4,top+20,4,6,'W')                  # back-right side volume
        g.ell(cx-hw-2,top+24,4,3,'W')                  # curl down at the left temple
        for i in range(6):                             # swoop strands, arcs from back-right to front-left
            r=6+i*3
            for a in range(0,180,4):
                x=int(cx+4+r*math.cos(math.radians(a))*1.25);y=int(top+22-r*math.sin(math.radians(a))*0.75)
                if g.get(x,y)=='W' and (x+y+i)%3:g.set(x,y,'l' if i%2 else 'd')
        for x in range(cx-hw-10,cx+hw+8):              # shadowed underside of the overhang
            for y in range(top+18,top+30):
                if g.get(x,y)=='W' and g.get(x,y+1) is None:g.set(x,y,'d')
        g.rect(cx-6,top+2,16,1,'l')
    else:
        g.ell(cx+1,top+3,hw+2,3.6,'W')                 # tall dome
        g.ell(cx-hw-1,top+4,2.6,2.2,'W')               # overhang lobe
        g.rect(cx-hw-3,top+1,3,1,'W');g.rect(cx-hw-4,top,2,1,'W')   # wind lift
        g.rect(cx+hw,top+4,2,3,'W')
        for x in range(cx-hw,cx+hw+2,2):g.set(x,top+2+((x-cx)%3==0),'l')
        for x in range(cx-hw-2,cx+hw+3):
            if g.get(x,top+6)=='W':g.set(x,top+6,'d')
        g.set(cx-hw-1,top+6,'d')
def v4_suit(g,cx,bt,bw,base,big):
    g.rect(cx-bw,bt,2*bw+1,base-bt+1,'N');g.rect(cx-bw,bt,1,base-bt+1,'v');g.rect(cx+bw,bt,1,base-bt+1,'v')
    n=6 if big else 2
    for y in range(n):g.rect(cx-1-y//(1 if big else 1),bt+y,3+2*(y//1),1,'w') if y<n else None
    if big:
        for y in range(n,n+8):g.set(cx-4-(y-n)//3,bt+y,'v');g.set(cx+4+(y-n)//3,bt+y,'v')   # lapels
        g.rect(cx-1,bt,3,2,'B');g.rect(cx-2,bt+2,5,base-bt-2,'B');g.rect(cx-1,base-1,3,2,'b')  # extra-long red tie
    else:g.rect(cx,bt,1,base-bt+1,'B')
def v4_hoodie(g,cx,bt,bw,base,big,gold=False):
    g.rect(cx-bw,bt,2*bw+1,base-bt+1,'Q');g.rect(cx-bw,bt,1,base-bt+1,'q');g.rect(cx+bw,bt,1,base-bt+1,'q')
    s='y' if gold else 'R'
    if big:
        g.rect(cx-12,bt,25,4,'q');g.rect(cx-9,bt,19,2,'x')     # hood bunched at the neck
        g.rect(cx-5,bt+4,1,10,s);g.rect(cx+5,bt+4,1,10,s)       # drawstrings
        if gold:g.rect(cx-6,bt+14,3,2,'y');g.rect(cx+4,bt+14,3,2,'y')
        g.rect(cx-10,base-5,21,1,'q')                           # pocket
    else:
        g.rect(cx-2,bt,5,1,'q');g.set(cx-1,bt+1,s);g.set(cx+1,bt+1,s)
def v4_flourish(g,cx,bt,big):
    """Mythic proposal: gold medallion chain over the hoodie"""
    if big:
        for x in range(cx-11,cx+12):g.set(x,bt+4+abs(x-cx)//-3+4,'y')
        g.ell(cx,bt+11,3,3,'y');g.set(cx,bt+11,'o')
    else:g.set(cx,bt+2,'y')
def funtrump_v4_card(tier):
    g=Grid(64,80);cx=32;bt=62;base=79
    if tier=='rare':v4_suit(g,cx,bt,29,base,True)
    else:v4_hoodie(g,cx,bt,29,base,True,gold=tier=='mythic')
    if tier=='mythic':v4_flourish(g,cx,bt,True)
    v4_face(g,cx,32,63,16,True);g.rect(cx-17,44,1,6,'z');g.rect(cx+17,44,1,6,'z')
    v4_hair(g,cx,6,16,True)
    g.outline()
    return g
FT4=[None,dict(hw=5,hh=8,bw=6,bh=4),dict(hw=6,hh=9,bw=7,bh=5),dict(hw=6,hh=9,bw=8,bh=6),dict(hw=7,hh=10,bw=9,bh=7),dict(hw=7,hh=10,bw=9,bh=7)]
def funtrump_v4(stage,tier,frame=0):
    d=FT4[stage];g=Grid();base=29;cx=15;bt=base-d['bh']+1;y1=bt;y0=y1-d['hh']
    if tier=='rare':v4_suit(g,cx,bt,d['bw'],base,False)
    else:v4_hoodie(g,cx,bt,d['bw'],base,False,gold=tier=='mythic')
    v4_face(g,cx,y0,y1,d['hw'],False)
    v4_hair(g,cx,y0-5,d['hw'],False)
    if stage>=4:v3_ok_hand(g,cx+d['bw']+1,bt+1,False)
    g.outline()
    if stage==5:mythic(g)
    return g.shift(-1 if frame%4==1 else 0)
def build_v4():
    from PIL import ImageDraw
    ft=f'{OUT}/funtrump/v4';os.makedirs(ft,exist_ok=True);names=['','1-hatchling','2-juvenile','3-adult','4-elder','5-mythic']
    rows={}
    for tier in ('rare','legendary','mythic'):
        rows[tier]=[]
        for s in (range(1,6) if tier!='mythic' else [5]):
            fr=[funtrump_v4(s,tier,f) for f in range(4)];n=f'{ft}/funtrump-{tier}-{names[s]}'
            fr[0].img('#2a1f4a',1).save(n+'.png')
            strip=Image.new('RGB',(128,32));[strip.paste(x.img('#2a1f4a'),(i*32,0)) for i,x in enumerate(fr)];strip.save(n+'-4frames.png')
            big=[x.img('#2a1f4a',6) for x in fr];big[0].save(n+'-6x.png');big[0].save(n+'-bob.gif',save_all=True,append_images=big[1:],duration=180,loop=0);rows[tier].append(big[0])
    cards={}
    for tier in ('rare','legendary','mythic'):
        c=funtrump_v4_card(tier);c.img('#6b7480',1).save(f'{ft}/funtrump-card-{tier}.png');cards[tier]=c.img('#6b7480',4);cards[tier].save(f'{ft}/funtrump-card-{tier}-4x.png')
    v3=Image.open(f'{OUT}/funtrump/v3-archive/funtrump-card-B-4x.png').convert('RGB')
    ref=Image.open(f'{OUT}/funtrump-reference.gif').convert('RGB').resize((320,320))
    W,H=256,320;pad=16;lab=28
    sheet=Image.new('RGB',(5*(W+pad)+pad,lab+H+pad+2*(lab+192+pad)+pad),(20,20,26));dr=ImageDraw.Draw(sheet)
    top=[('REFERENCE',ref),('v3 (old, suit)',v3),('v4 RARE: navy suit + long red tie',cards['rare']),('v4 LEGENDARY: grey hoodie',cards['legendary']),('v4 MYTHIC proposal: hoodie + gold chain',cards['mythic'])]
    for i,(t,im) in enumerate(top):x=pad+i*(W+pad);dr.text((x,8),t,fill=(240,220,140));sheet.paste(im.crop((0,0,W,H)) if im.width>W else im,(x,lab))
    y=lab+H+pad
    for tier,label in (('rare','RARE (suit) stages 1-5: hatchling, juvenile, adult, elder, mythic'),('legendary','LEGENDARY (hoodie) stages 1-5')):
        dr.text((pad,y+6),label,fill=(240,220,140))
        for i,im in enumerate(rows[tier]):sheet.paste(im,(pad+i*(W+pad)+32,y+lab))
        y+=lab+192+pad
    sheet.save('/workspace/xcpets/previews/new-characters/funtrump-v4-tiers.png')

# ---------------- FUNTRUMP v5: hair matched to the owner's meme reference (funtrump-reference.gif) ----------------
# ref: one giant fan of honey/strawberry-blond hair blown UP and to the viewer's LEFT from a front part at the right
# temple; crisp curved front edge rising from the right temple to a crest above the head; mass ~1.1x head height
# above the brow, ~1x face width past the left cheek, hanging down the left side past the chin; streaky strands
# radiating from the hairline; short fringe combed right-to-left across the forehead. Colors sampled from the ref.
PAL.update({'1':'#87552a','2':'#a9743f','3':'#cf9a62','4':'#e6bd85','5':'#f6e2b4'})
# outline in head-normalized coords: u=(x-cx)/hw, v=(y-y0)/head_h (card: cx32 hw16 y0 32 h31)
V5_HAIR=[(0.94,0.13),(1.25,-0.13),(1.55,-0.39),(1.69,-0.65),(1.56,-0.87),(1.25,-1.0),(0.5,-1.1),(-0.75,-1.03),
 (-1.69,-0.84),(-2.12,-0.58),(-2.2,0.4),(-2.1,1.3),(-1.75,1.36),(-1.4,1.1),(-1.12,0.84),(-1.0,0.52),(-0.94,0.26),(-0.62,0.1),(0.0,0.04),(0.56,0.03)]
def v5_hair(g,cx,y0,hw,hh,big):
    from PIL import ImageDraw
    m=Image.new('L',(g.w,g.h),0);ImageDraw.Draw(m).polygon([(cx+u*hw,y0+v*hh) for u,v in V5_HAIR],fill=1);mp=m.load()
    ox,oy=cx+0.6*hw,y0+0.15*hh                       # strands fan out from the part at the right temple
    for y in range(g.h):
        for x in range(g.w):
            if not mp[x,y]:continue
            a=math.atan2(oy-y,ox-x);r=math.hypot(x-ox,y-oy)/hw
            band=int(a*(9 if big else 5)+r*(1.2 if big else 0))%5
            k='3'
            if band==0:k='2'
            elif band==2:k='4'
            elif band==4 and big:k='5' if r>0.9 else '4'
            if r<0.35:k='2'                          # deeper at the roots
            if y>y0+0.7*hh and x<cx-hw:k='2' if band!=2 else '3'  # shadowed hang on the left
            g.set(x,y,k)
def v5_fringe(g,cx,y0,hw,hh,big):
    """short fringe combed from the right temple across the forehead to the left, over the face"""
    if big:
        for x in range(cx-hw,cx+hw):
            t=(x-(cx-hw))/(2*hw);y=y0+int(4-3*t)
            g.rect(x,y0-1,1,y-y0+2,'3');g.set(x,y+1,'2')
            if x%3==0:g.set(x,y0+1,'4')
    else:
        g.rect(cx-hw,y0,2*hw+1,1,'3');g.set(cx-hw,y0+1,'3');g.set(cx-hw+1,y0+1,'2')
def funtrump_v5_card(tier):
    g=Grid(64,80);cx=32;bt=62;base=79;y0=33
    v5_hair(g,cx,y0,16,31,True)
    if tier=='rare':v4_suit(g,cx,bt,29,base,True)
    else:v4_hoodie(g,cx,bt,29,base,True,gold=tier=='mythic')
    if tier=='mythic':v4_flourish(g,cx,bt,True)
    v4_face(g,cx,y0,63,16,True);g.rect(cx+17,44,1,6,'z')
    v5_fringe(g,cx,y0,16,31,True)
    g.outline()
    return g
def funtrump_v5(stage,tier,frame=0):
    d=FT4[stage];g=Grid();base=29;cx=17;bt=base-d['bh']+1;y1=bt;y0=y1-d['hh']
    v5_hair(g,cx,y0,d['hw'],d['hh']*0.8,False)
    if tier=='rare':v4_suit(g,cx,bt,d['bw'],base,False)
    else:v4_hoodie(g,cx,bt,d['bw'],base,False,gold=tier=='mythic')
    v4_face(g,cx,y0,y1,d['hw'],False)
    v5_fringe(g,cx,y0,d['hw'],d['hh'],False)
    if stage>=4:v3_ok_hand(g,cx+d['bw']+1,bt+1,False)
    g.outline()
    if stage==5:mythic(g)
    return g.shift(-1 if frame%4==1 else 0)
def build_v5():
    from PIL import ImageDraw
    ft=f'{OUT}/funtrump/v5';os.makedirs(ft,exist_ok=True);names=['','1-hatchling','2-juvenile','3-adult','4-elder','5-mythic']
    rows={}
    for tier in ('rare','legendary','mythic'):
        rows[tier]=[]
        for s in (range(1,6) if tier!='mythic' else [5]):
            fr=[funtrump_v5(s,tier,f) for f in range(4)];n=f'{ft}/funtrump-{tier}-{names[s]}'
            fr[0].img('#2a1f4a',1).save(n+'.png')
            strip=Image.new('RGB',(128,32));[strip.paste(x.img('#2a1f4a'),(i*32,0)) for i,x in enumerate(fr)];strip.save(n+'-4frames.png')
            big=[x.img('#2a1f4a',8) for x in fr];big[0].save(n+'-8x.png');big[0].save(n+'-bob.gif',save_all=True,append_images=big[1:],duration=180,loop=0);rows[tier].append(big[0])
    cards={}
    for tier in ('rare','legendary','mythic'):
        c=funtrump_v5_card(tier);c.img('#6b7480',1).save(f'{ft}/funtrump-card-{tier}.png');cards[tier]=c.img('#6b7480',4);cards[tier].save(f'{ft}/funtrump-card-{tier}-4x.png')
    ref=Image.open(f'{OUT}/funtrump-reference.gif').convert('RGB').crop((0,0,135,135)).resize((256,256),Image.LANCZOS)
    v4h=Image.open(f'{OUT}/funtrump/v4/funtrump-rare-3-adult-8x.png') if os.path.exists(f'{OUT}/funtrump/v4/funtrump-rare-3-adult-8x.png') else funtrump_v4(3,'rare').img('#2a1f4a',8)
    v4h=funtrump_v4(3,'rare').img('#2a1f4a',8);v5h=rows['rare'][2]
    v4c=Image.open(f'{OUT}/funtrump/v4/funtrump-card-rare-4x.png').convert('RGB')
    pad=16;lab=24;W=256
    sh=Image.new('RGB',(5*(W+pad)+pad,2*lab+256+320+3*pad),(20,20,26));dr=ImageDraw.Draw(sh)
    top=[('REFERENCE head (crop)',ref),('v4 head, adult 8x',v4h),('v5 head, adult 8x (Rare)',v5h),('v5 head, adult 8x (Legendary)',rows['legendary'][2]),('v5 Mythic proposal 8x',rows['mythic'][0])]
    for i,(t,im) in enumerate(top):x=pad+i*(W+pad);dr.text((x,6),t,fill=(240,220,140));sh.paste(im,(x,lab))
    y=lab+256+pad
    bot=[('v4 RARE card (old hair)',v4c),('v5 RARE card: navy suit + red tie',cards['rare']),('v5 LEGENDARY card: grey hoodie',cards['legendary']),('v5 MYTHIC proposal: hoodie + gold',cards['mythic'])]
    for i,(t,im) in enumerate(bot):x=pad+i*(W+pad);dr.text((x,y+4),t,fill=(240,220,140));sh.paste(im,(x,y+lab))
    strip=Image.new('RGB',(W,320),(20,20,26));d2=ImageDraw.Draw(strip);d2.text((4,0),'v5 stages 1-5, Rare / Legendary',fill=(240,220,140))
    for i in range(5):
        strip.paste(rows['rare'][i].resize((48,48)),(4+i*50,20));strip.paste(rows['legendary'][i].resize((48,48)),(4+i*50,74))
    sh.paste(strip,(pad+4*(W+pad),y+lab))
    sh.save('/workspace/xcpets/previews/new-characters/funtrump-v5-hair.png')

def save(g,path,scale,bg):g.img(bg,scale).save(path)
def sheet(tiles,path,cols,bg=(20,20,26)):
    w=max(t.width for t in tiles);h=max(t.height for t in tiles);rows=(len(tiles)+cols-1)//cols
    im=Image.new('RGB',(cols*(w+12)+12,rows*(h+12)+12),bg)
    for i,t in enumerate(tiles):im.paste(t,(12+(i%cols)*(w+12),12+(i//cols)*(h+12)))
    im.save(path)
if __name__=='__main__':
    ft=f'{OUT}/funtrump';sl=f'{OUT}/starlordkek';os.makedirs(ft,exist_ok=True);os.makedirs(sl,exist_ok=True)
    names=['','1-hatchling','2-juvenile','3-adult','4-elder','5-mythic']
    tiles=[]
    for s in range(1,6):
        fr=[funtrump(s,f) for f in range(4)]
        fr[0].img('#2a1f4a',1).save(f'{ft}/funtrump-{names[s]}.png')
        strip=Image.new('RGB',(128,32));[strip.paste(x.img('#2a1f4a'),(i*32,0)) for i,x in enumerate(fr)];strip.save(f'{ft}/funtrump-{names[s]}-4frames.png')
        fr[0].img('#2a1f4a',8).save(f'{ft}/funtrump-{names[s]}-8x.png');tiles.append(fr[0].img('#2a1f4a',8))
        frames=[x.img('#2a1f4a',8) for x in fr];frames[0].save(f'{ft}/funtrump-{names[s]}-bob.gif',save_all=True,append_images=frames[1:],duration=180,loop=0)
    c=funtrump_card();c.img('#6b7480',1).save(f'{ft}/funtrump-card.png');ci=c.img('#6b7480',4);ci.save(f'{ft}/funtrump-card-4x.png')
    big=Image.new('RGB',(5*268+12+ci.width+24,max(ci.height,268)+24),(20,20,26))
    for i,t in enumerate(tiles):big.paste(t,(12+i*268,12+(ci.height-256)//2))
    big.paste(ci,(5*268+24,12));big.save('/workspace/xcpets/previews/new-characters/funtrump-sheet.png')
    s1=slk_throne_scene();s1.img('#142018',1).save(f'{sl}/starlordkek-throne-32.png');s1i=s1.img('#142018',8);s1i.save(f'{sl}/starlordkek-throne-32-8x.png')
    fr=[s1.shift(-1 if f==1 else 0).img('#142018',8) for f in range(4)];fr[0].save(f'{sl}/starlordkek-throne-bob.gif',save_all=True,append_images=fr[1:],duration=180,loop=0)
    p=slk_portrait();p.img('#1a0606',1).save(f'{sl}/starlordkek-card.png');pi=p.img('#1a0606',4);pi.save(f'{sl}/starlordkek-card-4x.png')
    big=Image.new('RGB',(s1i.width+pi.width+36,pi.height+24),(20,20,26));big.paste(s1i,(12,12+(pi.height-256)//2));big.paste(pi,(s1i.width+24,12));big.save('/workspace/xcpets/previews/new-characters/starlordkek-sheet.png')
    build_v3()
    build_v4()
    build_v5()
