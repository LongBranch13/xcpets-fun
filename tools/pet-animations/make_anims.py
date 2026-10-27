"""PET ANIMATIONS PREVIEW (branch pet-animations; preview only, no game code).
Reads frames.json from extract.js (REAL game sprites, keyed pixel-exact) and builds one looping 8-frame GIF per kind.
Motion = whole-pixel moves / mirror of the untouched sprite + the game's own 4 idle frames; add-ons are small pixel props
in colours taken from the game palette (pet-core gear colours, Bitcoin orange). No sprite pixel is redrawn.
  python3 make_anims.py frames.json OUTDIR"""
import json,sys,math,os
from PIL import Image,ImageDraw
SRC,OUT=sys.argv[1],sys.argv[2];D=json.load(open(SRC));K=D['kinds']
W,H,S,N=44,40,4,8            # canvas in game pixels, output scale, frames
OX,OY=6,6                     # sprite origin
# game palette (rjs/pet-core.js gear + FIXED colours, Bitcoin orange used by the hachimaki/Wizard staff)
C=dict(org='#f7931a',gold='#ffd23f',lgold='#fff1a8',red='#d63031',grn='#2f9f4f',lgrn='#4fd18b',wht='#ffffff',blu='#3fb8e8',
  dblu='#2e5fbf',pur='#6a3fb5',lpur='#d0d6e0',ink='#1d1d1d',grey='#8d96a8',smk='#c7ced9',ember='#ff7a1a',navy='#1b1f4a',tear='#7fc8ff',brn='#8a5a3a')
BG={'default':'#142018','kek':'#2a3a2e','kek-community':'#2a3a2e','funtrump':'#1f2a44','wizard':'#2a3a2e','wizard-community':'#2a3a2e',
  'starlordkek':'#14101e','gooby':'#14101e','lukespam':'#14101e'}
def spr(k,f): return K[k]['frames'][f%len(K[k]['frames'])]
class Fr:
  def __init__(s,k): s.k=k; s.px={}
  def put(s,x,y,c):
    if 0<=x<W and 0<=y<H and c: s.px[(x,y)]=C.get(c,c)
  def rect(s,x,y,w,h,c):
    for j in range(h):
      for i in range(w): s.put(x+i,y+j,c)
  def pet(s,f,dx=0,dy=0,flip=False,ghost=None):
    for i,c in enumerate(spr(s.k,f)):
      if not c: continue
      x,y=i%32,i//32
      if flip: x=31-x
      s.put(OX+x+dx,OY+y+dy,ghost or c)
  def img(s):
    im=Image.new('RGB',(W,H),BG.get(s.k,BG['default']));p=im.load()
    for (x,y),c in s.px.items(): p[x,y]=tuple(int(c[i:i+2],16) for i in (1,3,5))
    return im.resize((W*S,H*S),Image.NEAREST)
def bbox(k):
  xs=[i%32 for i,c in enumerate(spr(k,0)) if c];ys=[i//32 for i,c in enumerate(spr(k,0)) if c]
  return min(xs)+OX,min(ys)+OY,max(xs)+OX,max(ys)+OY
def spark(f,x,y,c='wht',big=False):
  f.put(x,y,c)
  if big: [f.put(x+a,y+b,c) for a,b in((1,0),(-1,0),(0,1),(0,-1))]
def coin(f,x,y):  # 3x3 Bitcoin-orange coin with a light centre (no letter)
  f.rect(x,y,3,3,'org'); f.put(x+1,y+1,'lgold'); [f.put(x+a,y+b,None) for a,b in ()]
A={};PLAN={}
def anim(k,idea,why):
  def d(fn): A[k]=fn; PLAN[k]=(idea,why); return fn
  return d
@anim('pepe','Feels-good hop + rare card sparkle','Pepe is the Rare Pepe meme: a smug little hop and a gold "rare" twinkle over his head.')
def _(f,t,b):
  dy=[0,-1,-2,-1,0,0,0,0][t]; f.pet(t,0,dy)
  if t in(2,3,4): spark(f,b[2]-2,b[1]-2+dy,'gold',t==3)
@anim('wojak','Cigarette smoke curl + one tear','Doomer Wojak: his signature cigarette smokes, and the classic single tear rolls down.')
def _(f,t,b):
  f.pet(t)
  x0,y0=b[2]-1,b[1]+18
  for n in range(3):
    s=(t+n*3)%8; f.put(x0+(1 if s%4<2 else 0)+n%2,y0-s,'smk' if s<6 else None)
  f.put(b[0]+7,b[1]+12+t//2,'tear')
@anim('chud','Approving nod with a lens glint','Chud is the bearded "Yes" guy in glasses: a slow two-beat nod and a glint on the eyeglasses.')
def _(f,t,b):
  f.pet(t,0,[0,1,0,1,0,0,0,0][t])
  if t in(4,5): spark(f,b[0]+8+t-4,b[1]+9,'wht',t==5)
@anim('peepo','Peek-a-boo: sinks below the frame and pops back up','Peepo is the cute peeking pepe; peeking up over the edge is his whole meme.')
def _(f,t,b):
  f.pet(t,0,[0,4,9,14,9,4,0,0][t]); f.rect(0,H-5,W,5,'#0d150f')
@anim('doge','Happy wiggle + "much wow" sparkles','Shiba Doge: excited side-to-side wiggle while yellow wow-sparkles pop around his head (no text).')
def _(f,t,b):
  f.pet(t,[0,1,0,-1][t%4],0)
  for i,(x,y) in enumerate([(b[0]-3,b[1]+2),(b[2]+2,b[1]+4),(b[0]-1,b[1]+14),(b[2]+1,b[1]+16)]):
    if (t+i*2)%8<3: spark(f,x,y,'gold',(t+i*2)%8==1)
@anim('bobo','Red candles dumping beside him','Bobo is the bear-market bear: a little red candle chart drops step by step while he stays smug.')
def _(f,t,b):
  f.pet(t)
  x=b[2]+2
  for n in range(min(t+1,5)):
    h=3; y=b[1]+4+n*4; f.rect(x+n*0,y,2,h,'red') if False else f.rect(x-(n%2),y,2,h,'red'); f.put(x-(n%2),y-1,'red')
@anim('mumu','Green candles pumping + stomp','Mumu is the bull: hooves stomp (1-px dip) while green candles climb up beside him.')
def _(f,t,b):
  f.pet(t,0,1 if t%4==3 else 0)
  x=b[2]+2
  for n in range(min(t+1,5)):
    y=b[3]-4-n*4; f.rect(x-(n%2),y,2,3,'lgrn'); f.put(x-(n%2),y-1,'lgrn')
@anim('sarutobi','Ninja leap with a mid-air flip','SaruTobi is the jumping monkey from the Counterparty game: a high leap, facing flips at the top, lands.')
def _(f,t,b):
  dy=[0,-3,-6,-7,-6,-3,0,1][t]; f.pet(t,0,dy,flip=t in(3,4,5))
  if t==7: f.put(b[0]+4,b[3]+1,'smk'); f.put(b[2]-4,b[3]+1,'smk')
@anim('lenny','Sly slide-in from the side + wink sparkle','( ͡° ͜ʖ ͡°) Lenny sneaks in sideways, stops, and his monocle side flashes.')
def _(f,t,b):
  f.pet(t,[-8,-4,-1,0,0,0,0,-3][t],0)
  if t in(4,5): spark(f,b[0]+14,b[1]+6,'wht',t==4)
@anim('snibby','Crab scuttle left and right','Snibby is the crab: crabs walk sideways, 1 px per step, with a little sand kick.')
def _(f,t,b):
  dx=[0,2,4,2,0,-2,-4,-2][t]; f.pet(t,dx,t%2)
  f.put(b[0]+4+dx,b[3]+1,'#c9a54a' if t%2 else None)
@anim('kevin','"Kevin is everywhere" echo clones','KEVIN (Stamp #4258) is the stamp that copied itself everywhere: ghost copies flicker in behind him.')
def _(f,t,b):
  if t in(1,2,3,5,6): f.pet(t,-5 if t<4 else 5,0,ghost='#4a3a30')
  f.pet(t)
@anim('dodo','Black-swan bob on the water','Dodo is the black swan: he floats and bobs on a pixel water line (1-px swell).')
def _(f,t,b):
  f.pet(t,0,[0,0,1,1,0,0,-1,-1][t])
  for x in range(W):
    f.put(x,b[3]-2+(1 if (x+t)%6<3 else 0),'dblu')
  f.rect(0,b[3]-0,W,H,'navy')
@anim('nakamoto','Mining: Bitcoin blocks pop out and stack','Nakamoto made Bitcoin: orange block-coins pop up (block found) and stack beside him.')
def _(f,t,b):
  f.pet(t,0,1 if t in(0,4) else 0)
  for n in range(t//2+1):
    coin(f,b[2]+2,b[3]-3-n*3)
  if t%2==1: spark(f,b[2]+3,b[3]-6-(t//2)*3,'gold',True)
@anim('wizard','Casting: sparks orbit the staff tip','The Bitcoin Wizard: orange/gold spell sparks spin out of his staff (staff is his signature).')
def _(f,t,b):
  f.pet(t); cx,cy=b[0]+3,b[1]+2
  for n in range(3):
    a=(t/8+n/3)*2*math.pi; spark(f,cx+round(4*math.cos(a)),cy+round(3*math.sin(a)),['org','gold','wht'][n],n==0 and t%2==0)
@anim('wizard-community','Casting (community purple palette)','Same spell as the player Wizard, with lilac sparks to match the community-only purple robe.')
def _(f,t,b):
  f.pet(t); cx,cy=b[0]+3,b[1]+3
  for n in range(3):
    a=(t/8+n/3)*2*math.pi; spark(f,cx+round(4*math.cos(a)),cy+round(3*math.sin(a)),['lpur','gold','wht'][n],n==0 and t%2==0)
def croak(f,t,b,col):
  f.pet(t,0,[0,0,-1,0,0,0,-1,0][t])
  r=t%4; cx,cy=b[2]+2,b[1]+16
  if t in(2,3,6,7):
    for a in range(-r-1,r+2): f.put(cx+r+1,cy+a,col)
    if r>0: f.put(cx+r+3,cy,col)
@anim('kek','Croak ripples','Kek is the frog god: a two-beat croak hop with sound ripples off his mouth.')
def _(f,t,b): croak(f,t,b,'lgrn')
@anim('kek-community','Croak ripples (community palette)','Lord Kek in his community colours, same croak.')
def _(f,t,b): croak(f,t,b,'gold')
@anim('funtrump','Rally wave: little flag waves + confetti','FUNTRUMP is the rally guy; the sprite has no free arm, so a tiny red/white/navy flag on a pole waves beside him.')
def _(f,t,b):
  f.pet(t,0,1 if t%4==2 else 0); x,y=b[2]+1,b[1]+8
  f.rect(x,y,1,12,'grey')
  for i in range(5):
    for j in range(4):
      yy=y+j+(1 if (i+t)%4<2 and i>1 else 0); f.put(x+1+i,yy,'navy' if (i<2 and j<2) else ('red' if j%2==0 else 'wht'))
  for i in range(3):
    s=(t+i*3)%8; f.put(b[0]+3+i*9,b[1]-1+s,['red','wht','gold'][i])
@anim('starlordkek','Comet fly-by + star twinkle','Star-Lord Kek is the cosmic Kek: a 2-px comet streaks across behind him and stars twinkle.')
def _(f,t,b):
  cx=W-1-t*6; f.put(cx,4,'wht'); f.put(cx+1,4,'blu'); f.put(cx+2,4,'dblu')
  f.pet(t)
  for i,(x,y) in enumerate([(2,10),(W-3,14),(4,28)]):
    if (t+i*3)%8<2: spark(f,x,y,'lgold',(t+i*3)%8==0)
@anim('gooby','Goo bounce with drips','Gooby is a goo blob: a squishy bounce and goo drops falling off him.')
def _(f,t,b):
  f.pet(t,0,[0,-2,-3,-2,0,1,0,0][t])
  for n,x in enumerate((b[0]+6,b[2]-6)):
    s=(t+n*4)%8; f.put(x,b[3]+s-4,'lgrn' if s>3 else None)
@anim('lukespam','Spam blast: tiny envelopes fly out','Luke Spam Junior (Spam City): little white mail pixels shoot out in a stream.')
def _(f,t,b):
  f.pet(t)
  for n in range(3):
    s=(t+n*3)%8; x=b[2]-2+s*2; y=b[1]+8+n*4-(s//2)
    if s<6: f.rect(x,y,3,2,'wht'); f.put(x+1,y,'grey')
def flames(f,t,b,cols=('red','ember','org','gold')):
  # edition pets fill the 32x32 frame (gold edition border), so the fire burns in the free side margins and embers rise
  for x0 in (b[0]-5,b[2]+2):
    for i in range(4):
      h=4+((x0+i*5+t*3)%5)
      for j in range(h): f.put(x0+i,b[3]-j,cols[min(3,j*4//h)])
    for n in range(2):
      s=(t*2+n*7+x0)%16; f.put(x0+1+(n+t)%3,b[3]-8-s,'gold' if s<10 else 'org')
@anim('burnlord','Burn flames lick up from the base','Burn Lords are the top-5 burners: pixel fire burns on both sides of its gold edition frame with embers rising (burn-to-play).')
def _(f,t,b): f.pet(t); flames(f,t,b)
@anim('kekamozard','Spell sparks + burn flames','Lord Kekamozard (#1 burner, Kek wizard): Burn Lord flames plus the Wizard spell sparks at the hat tip.')
def _(f,t,b):
  f.pet(t); flames(f,t,b)
  cx,cy=b[0]+15,b[1]+1
  for n in range(3):
    a=(t/8+n/3)*2*math.pi; spark(f,cx+round(5*math.cos(a)),cy+round(2*math.sin(a)),['org','gold','wht'][n],n==0)
@anim('don','Gold coins rain down','Don Kekamoto is the top XCPETS holder: Bitcoin-orange coins rain past him.')
def _(f,t,b):
  for n,x in enumerate((1,W-5,W//2+9,4)):
    y=(t*5+n*11)%(H+4)-4; coin(f,x,y)
  f.pet(t)
def helix(f,t,b,cols):
  f.pet(t)
  for j in range(0,14,2):
    a=(t/8)*2*math.pi+j*0.6; x=round(2*math.sin(a))
    f.put(b[2]+3+x,b[1]+4+j,cols[0]); f.put(b[2]+3-x,b[1]+4+j,cols[1])
@anim('hybrid2','DNA helix twist (two parent colours)','Hybrids mix two species; a 2-strand DNA helix in the parents\' accent colours turns beside them.')
def _(f,t,b): helix(f,t,b,('#e8a924','#f1e4d4'))
@anim('hybrid3','Triple DNA helix (3-way)','3-way hybrids get the same helix with a third strand colour flashing in.')
def _(f,t,b):
  helix(f,t,b,('#d06311','#4a4a56'))
  for j in range(1,14,4): f.put(b[2]+3,b[1]+4+j,'#e8a924' if (t+j)%2 else None)
os.makedirs(OUT,exist_ok=True)
DUR={'sarutobi':110,'snibby':120,'starlordkek':90,'don':100}
order=[k for k in A if k in K]
keyframes={}
for k in order:
  b=bbox(k); ims=[]
  for t in range(N):
    f=Fr(k); A[k](f,t,b); ims.append(f.img())
  ims[0].save(f'{OUT}/{k}.gif',save_all=True,append_images=ims[1:],duration=DUR.get(k,140),loop=0,disposal=1,optimize=False)
  st=Image.new('RGB',(W*2*N,H*2));[st.paste(im.resize((W*2,H*2),Image.NEAREST),(i*W*2,0)) for i,im in enumerate(ims)];os.makedirs(f'{OUT}/strips',exist_ok=True);st.save(f'{OUT}/strips/{k}-strip.png')
  keyframes[k]=ims[{'peepo':0,'kevin':2,'nakamoto':7,'mumu':6,'bobo':6,'starlordkek':3}.get(k,3)]
json.dump({k:{'label':K[k]['label'],'src':K[k]['src'],'idea':PLAN[k][0],'why':PLAN[k][1]} for k in order},open(f'{OUT}/_build/anims.json','w'),indent=1)
# contact sheet
cols=6;cw,ch=W*S,H*S+30;rows=(len(order)+cols-1)//cols
sh=Image.new('RGB',(cols*cw+(cols+1)*8,rows*ch+(rows+1)*8+30),'#0b0f0c');d=ImageDraw.Draw(sh)
d.text((8,8),f"XCPETS pet animations PREVIEW - real game sprites, Adult stage, chain tip {D['tip']} - key frame per kind",fill='#ffd23f')
for n,k in enumerate(order):
  x=8+(n%cols)*(cw+8);y=38+(n//cols)*(ch+8);sh.paste(keyframes[k],(x,y))
  d.text((x+2,y+H*S+3),K[k]['label'][:30],fill='white');d.text((x+2,y+H*S+15),PLAN[k][0][:32],fill='#8d96a8')
sh.save(f'{OUT}/contact-sheet.png')
# all-pets grid gif at 2x
s2=2;gw,gh=W*s2,H*s2;cols=7;rows=(len(order)+cols-1)//cols;grid=[]
for t in range(N):
  g=Image.new('RGB',(cols*gw,rows*gh),'#0b0f0c')
  for n,k in enumerate(order):
    f=Fr(k);A[k](f,t,bbox(k));g.paste(f.img().resize((gw,gh),Image.NEAREST),((n%cols)*gw,(n//cols)*gh))
  grid.append(g)
grid[0].save(f'{OUT}/all-pets.gif',save_all=True,append_images=grid[1:],duration=140,loop=0)
print(len(order),'kinds')
