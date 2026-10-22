# XCPETS badge generator (design only). 32x32 octagon medallion, rarity rim = site tier colours, 4x export.
from PIL import Image, ImageDraw, ImageFont
import os
OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','img','badges')
RIM={'common':'#9aa3b5','uncommon':'#4fd18b','rare':'#4f9dff','legendary':'#ffc93c'}
TIERS=[('bronze','uncommon','#c87a3a'),('silver','rare','#d6dceb'),('gold','legendary','#ffc93c')]
P={'.':None,'k':'#000000','w':'#ffffff','o':'#ff7a1a','y':'#ffc93c','r':'#c8102e','R':'#ff4a4a','g':'#4fd18b','G':'#2e8b57',
   'p':'#5aa83a','P':'#3c7a28','b':'#4f9dff','B':'#1d4f9a','s':'#9aa3b5','S':'#5a6275','n':'#8a5a2b','N':'#5a3a1a','t':'#f2c6a0',
   'v':'#9b5de5','V':'#5b2a9a','c':'#7fe3ff','m':'#ff6ec7','d':'#2c2440','l':'#ece6ff','z':'#ffe9a8'}
I={
'flame':["......o.........",".....oo.........",".....oyo...o....","....oyyo..oo....","...oyyyoooyo....","...oyyzyyyyo....","..oyyzzzyyyyo...","..oyzzwzzyyyo...","..oyzwwwzzyyo...","..oyzwwwwzyyo...","...oyzwwzzyo....","...ooyzzzyoo....","....ooyyyoo.....",".....ooooo......","................","................"],
'chain':["................","................","..kkkk....kkkk..",".kssssk..kssssk.",".ks..sk..ks..sk.",".ks..skkkks..sk.",".ks..sslls...sk.",".ks..skkkks..sk.",".ks..sk..ks..sk.",".kssssk..kssssk.","..kkkk....kkkk..","................","....oo..........","...oyyo.........","...oyyo.........","....oo.........."],
'bowl':["................","......w..w......",".....w..w.......","......w..w......","................","..kkkkkkkkkkkk..",".knnnnnnnnnnnnk.",".kNyyoyyoyyoyNk.","..kNnnnnnnnnNk..","..kNnnnnnnnnNk..","...kNnnnnnnNk...","....kNNNNNNk....",".....kkkkkk.....","................","................","................"],
'cal':["...k......k.....","..kkkkkkkkkkkk..","..krrrrrrrrrrk..","..kkkkkkkkkkkk..","..kwwwwwwwwwwk..","..kwkwkwkwkwwk..","..kwwwwwwwwwwk..","..kwkwkwkwgwwk..","..kwwwwwwwwwwk..","..kwkwkwgwgwwk..","..kwwwwwwwwwwk..","..kkkkkkkkkkkk..","................","................","................","................"],
'glove':["................","...kkkkkk.......","..krrrrrrk......",".krRRrrrrrk.....",".krRrrrrrrrk....",".krrrrrrrrrk....",".krrrrrrrrrkk...",".kkrrrrrrrrrrk..","..krrrrrrrrrrk..","..kkrrrrrrrrk...","...kwwwwwwwk....","...kwwwwwwwk....","...kkkkkkkkk....","................","................","................"],
'belt':["................","................","................","kkkkkkkkkkkkkkkk","Nnnnnkkkkkknnnnn","Nnnnkyyyyyykknnn","NnnnkyyrryyykNnn","NnnnkyrRRryyknnn","NnnnkyyrryyykNnn","Nnnnkyyyyyykknnn","Nnnnnkkkkkknnnnn","kkkkkkkkkkkkkkkk","................","................","................","................"],
'ten':["................","..kkk..kkkkk....",".kyyk.kyyyyyk...","kyyyk.kyykyyk...",".kyyk.kyk.kyk...",".kyyk.kyk.kyk...",".kyyk.kyk.kyk...",".kyyk.kyykyyk...","kyyyyk.kyyyk....","kkkkkk.kkkkk....","................","..kkkkkkkkkkk...","..krrrrrrrrrk...","..kkkkkkkkkkk...","................","................"],
'david':["................",".........kk.....","........kssk....","..k....kssk.....",".kNk..kssk......",".kNNkksk........","..kNNNk.........","...kNnk.........","..kNnnNk........","..kNkknNk.......","...k..knk.......",".......k........","..........ww....",".........w..w...",".........w..w...","..........ww...."],
'phoenix':["................","..o.........o...",".oyo.......oyo..",".oyyo..k..oyyo..","..oyyokrkoyyo...","...oyyrrryyo....","....oyrwryo.....",".....orrro......",".....oyryo......","....oyoyoyo.....","...oy.oyo.yo....","..o...o.o...o...","................","................","................","................"],
'crown':["................","................","..k....k....k...",".kyk..kyk..kyk..",".kyyk.kyk.kyyk..",".kyyykyyykyyyk..",".kyyyyyyyyyyyk..",".kyryybyyryyyk..",".kyyyyyyyyyyyk..",".kkkkkkkkkkkkk..","................","..oo..oo..oo....",".oyyooyyooyyo...","..oo..oo..oo....","................","................"],
'spoon':["................","..........kkk...",".........kzzzk..","........kzwzzk..","........kzzzzk..",".........kzzk...","........kzk.....",".......kzk......","......kzk.......",".....kzk........","....kzk.........","...kzk..........","..kzk...........","..kk............","................","................"],
'egg2':["................","....kkk..kkk....","...kpppkkbbbk...","..kpwppkkbbwbk..","..kppppkkbbbbk..",".kpPpppkkbbBbbk.",".kppppPkkbbbbbk.",".kpppppkkbBbbbk.",".kppPppkkbbbbbk.","..kppppkkbbbbk..","..kpppPkkbbbbk..","...kpppkkbbbk...","....kkk..kkk....","................","................","................"],
'dna':["................","..kk......kk....","..kgk....kgk....","...kgkkkkgk.....","....kwwwwk......",".....kggk.......","....kgkkgk......","...kgk..kgk.....","...kgk..kgk.....","....kgkkgk......",".....kggk.......","....kwwwwk......","...kgkkkkgk.....","..kgk....kgk....","..kk......kk....","................"],
'dex':["................",".kkkkkkkkkkkkk..",".kRRRRRRRRRRRk..",".kRkkkRRRRRRRk..",".kRkckRRRRwRRk..",".kRkkkRRRRRRRk..",".kkkkkkkkkkkkk..",".kdgdgdgdgdgdk..",".kgdgdgdgdgdgk..",".kdgdgdgdgdgdk..",".kgdgdgdgdgdsk..",".kdgdgdgsdsdsk..",".kkkkkkkkkkkkk..","................","................","................"],
'star':["................",".......k........","......kyk.......","......kyk.......",".....kyyyk......","kkkkkkyzyykkkkk.",".kyyyyyzzyyyyk..","..kyyyzwzyyyk...","...kyyyzyyyk....","...kyyyyyyyk....","..kyyykkkyyyk...","..kyyk...kyyk...",".kyk.......kyk..",".kk.........kk..","................","................"],
'btc':["................",".....kkkkkk.....","...kkoooooookk..","..koooykyooook..","..kookyyyyyook..",".koooky..kyoook.",".koooky..kyoook.",".kooookyyykooook",".koooky..kyoook.",".koooky..kyoook.","..kookyyyyyook..","..koooykyooook..","...kkoooooookk..",".....kkkkkk.....","................","................"],
'hat':["................","..........kk....","........kkvk....",".......kvvk.....","......kvvvk.....","......kvyvk.....",".....kvvvvvk....",".....kvvvyvk....","....kvvyvvvvk...","....kyyyyyyyk...","..kkVVVVVVVVVkk.",".kVVVVVVVVVVVVk.","..kkkkkkkkkkkk..","................","................","................"],
'ice':["................",".....kkkkkk.....","....kccccwck....","...kccwccccck...","...kcckkkkcck...","...kcckvvkcck...","...kckvyyvkck...","...kckvvvvkck...","...kcckkkkcck...","...kccccccwck...","...kcwcccccck...","....kkkkkkkk....","......c..c......",".....c....c.....","................","................"],
'eye':["................","................","....kkkkkk......","...kVVVVVVk.....","..kVvvvvvvVk....","..kvVwwkwvvk....","..kvVwkkkVvk....","..kvVwwkwVvk....","..kVvvVVvvVk....","...kVVvvVVk.....","....kkkkkk......","..........k.....",".........kyk....","..........k.....","................","................"],
'wojak':["................","....kkkkkkk.....","...kttttttk.....","..kttttttttk....","..ktkkttkktk....","..ktwktwkttk....","..kttttttttk....","..ktbtttbttk....","..ktbtttbttk....","..kttkkkkttk....","..ktkttttktk....","...kttttttk.....","....kkkkkk......","................","................","................"],
'grave':["................",".....kkkkkk.....","....kssssssk....","...kssSssSssk...","...ksSSSSSSsk...","...kssSssSssk...","...kssSssSssk...","...ksssssssk....","...ksskkkssk....","...kskssksskk...","...kssssssssk...","...kssssssssk...","..kkkkkkkkkkkk..",".kGGpGGpGGpGGk..","................","................"],
'up':["................","...........kkk..","..........kgggk.","...........kggk.","..........kgkgk.",".........kgk.k..","........kgk.....","...k...kgk......","..kgk.kgk.......",".kgkgkgk........","kgk.kgk.........","kk...k..........","................","kkkkkkkkkkkkkk..","................","................"],
}
I['nest']=["................","................","....kkk.........","...kzzzk..kkk...","..kzwzzzkkzzzk..","..kzzzzzkzwzzk..","..kzzzzzkzzzzk..","...kzzzk.kzzk...","kkkkkkkkkkkkkkkk","kNnNnNnNnNnNnNnk",".kNnNnNnNnNnNnk.","..kNnNnNnNnNnk..","...kkkkkkkkkk...","................","................","................"]
I['pram']=["................","..kkkkk.........",".kmmmmmk........","kmmmmmmmk.......","kmmmkkkkkkkkkk..","kmmk.kwwwwwwwk..","kmmkkwtttttwwk..","kkkkkkkkkkkkkk..","..kmmmmmmmmmk...","...kkkkkkkkk....","...k.......k....","..kSk.....kSk...","..kSk.....kSk...","...k.......k....","................","................"]
TXT_FONT='/usr/share/fonts/truetype/sand-box/google/Press Start 2P/PressStart2P-Regular.ttf'
def badge(icon, rimkey, pip=None, fill='#181327'):
    im=Image.new('RGBA',(32,32),(0,0,0,0)); d=ImageDraw.Draw(im)
    oct_=lambda m:[(9+m,1+m),(22-m,1+m),(30-m,9+m),(30-m,22-m),(22-m,30-m),(9+m,30-m),(1+m,22-m),(1+m,9+m)]
    rim=RIM[rimkey]
    d.polygon(oct_(0),fill='#000000'); d.polygon(oct_(1),fill=rim); d.polygon(oct_(3),fill='#000000'); d.polygon(oct_(4),fill=fill)
    # rim highlight top-left, shade bottom-right
    d.line([(10,2),(21,2)],fill='#ffffff'); d.point([(9,3),(3,9)],fill='#ffffff')
    d.line([(10,29),(21,29)],fill='#00000066')
    for y,row in enumerate(I[icon]):
        for x,ch in enumerate(row):
            c=P.get(ch)
            if c: im.putpixel((8+x,7+y),Image.new('RGBA',(1,1),c).getpixel((0,0)))
    if pip:  # tier pip: 3 tiny studs bottom centre
        n={'bronze':1,'silver':2,'gold':3}[pip[0]]; col=pip[1]
        xs=[15] if n==1 else [13,17] if n==2 else [11,15,19]
        for x in xs: d.rectangle([x,26,x+1,27],fill=col); d.point((x,26),fill='#ffffff')
    return im
# id, name, icon, rarity (or 'tiered')
B=[('burn-chain','CHAIN GANG','chain','tiered'),('daily-burn','NUMBER GO UP','up','tiered'),
('feed-streak','GOOD BOI KEEPER','bowl','tiered'),('perfect-month','NEVER SKIPPED LEG DAY','cal','rare'),
('first-win','FIRST BLOOD, BROTHER','glove','common'),('belt','TITLE BELT','belt','rare'),('ten-wins','DOUBLE DIGITS','ten','tiered'),
('upset','DAVID VS CHAD','david','rare'),('comeback','RETURN OF THE KEK','phoenix','uncommon'),
('top-burner-week','BURN LORD (WEEKLY)','flame','rare'),('top-burner-all','PERMABURN GOD','flame','tiered'),
('top-feeder-week','SPOON KING (WEEKLY)','spoon','rare'),('top-feeder-all','HAND OF THE FEEDER','crown','tiered'),
('first-hybrid','MAD SCIENTIST','egg2','uncommon'),('bred-true','PURE BLOOD','dna','uncommon'),
('dex','GOTTA BURN EM ALL','dex','tiered'),('legendary','SHINY HUNTER','star','rare'),('nakamoto','SATOSHI SAW YOU','btc','legendary'),
('breeder','BREEDER','nest','tiered'),('single-mother','SINGLE MOTHER','pram','uncommon'),
('black-eye','RIGHT IN THE EYE','eye','common'),('ngmi','NGMI','wojak','uncommon'),('rip','PRESS F','grave','common')]
files=[]
for bid,name,icon,r in B:
    if r=='tiered':
        for t,rk,col in TIERS:
            im=badge(icon,rk,(t,col)); fn=f'{bid}-{t}'; files.append((fn,name,t,rk,im))
    else:
        files.append((bid,name,'',r,badge(icon,r)))
for fn,_,_,_,im in files:
    im.save(f'{OUT}/{fn}.png'); pass
