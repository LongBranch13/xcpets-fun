"""Series 2 roster: rough 8-bit sketches (design only, not loaded by the game).
Same conventions as draw_chars.py: 32x32 grid, palette keys, 1px ink outline, Adult stage + Mythic gold rim."""
import os,sys
sys.path.insert(0,os.path.dirname(__file__))
from draw_chars import Grid,PAL,mythic
from PIL import Image,ImageDraw
OUT='/workspace/xcpets/design/art/series2'
PAL.update({'1':'#3a7bd5','2':'#2a5aa0','3':'#7dc36b','4':'#4f9a45','5':'#f3e6c8','6':'#c9b48a','7':'#8b8b8b','8':'#5c5c5c',
 '9':'#e8a85a','0':'#b97a3a','!':'#ff7fbf','@':'#7a4a2a','#':'#4a2e1a','$':'#ff4b2b','%':'#ffb02e','&':'#9b6bd6','*':'#3a3a3a','+':'#e0e0e0'})
def eyes(g,x1,x2,y,pup='P',white='w',w=2):
    for x in (x1,x2):g.rect(x,y,w,2,white);g.set(x+w-1,y+1,pup)
def legs(g,cx,y,k,gap=3):g.rect(cx-gap-1,y,2,3,k);g.rect(cx+gap,y,2,3,k)
def brett():
    g=Grid();g.ell(16,20,8,6,'1');g.ell(16,12,8,5,'1');g.ell(11,8,3,2.5,'1');g.ell(21,8,3,2.5,'1')
    eyes(g,10,20,7,w=3);g.rect(10,14,12,1,'2');g.rect(12,15,8,1,'$')  # wide grin
    g.ell(16,21,5,4,'5');legs(g,16,26,'1');return g
def apu():
    g=Grid();g.ell(16,20,6,6,'3');g.ell(16,12,8,6,'3');eyes(g,11,19,10);g.set(13,14,'4');g.rect(14,14,4,1,'4')
    g.rect(12,18,8,6,'%');g.rect(14,19,4,1,'w')  # little helper shirt
    g.rect(20,20,5,1,'7');g.rect(24,18,1,4,'7')   # tiny wrench
    legs(g,16,26,'3');return g
def popcat():
    g=Grid();g.ell(16,19,8,7,'5');g.ell(16,11,7,6,'5');g.rect(9,4,3,4,'5');g.rect(20,4,3,4,'5');g.set(10,6,'!');g.set(21,6,'!')
    g.rect(11,9,2,2,'P');g.rect(19,9,2,2,'P');g.ell(16,15,3,3,'#');g.rect(15,13,2,1,'!')   # the pop mouth
    legs(g,16,26,'6');return g
def cheems():
    g=Grid();g.ell(16,20,7,6,'9');g.ell(16,12,7,6,'9');g.rect(9,5,3,4,'9');g.rect(20,5,3,4,'9')
    g.ell(16,15,4,3,'5');g.rect(11,10,2,1,'P');g.rect(19,10,2,1,'P');g.rect(15,13,2,1,'P')  # sleepy squint
    g.ell(23,22,2,2,'@')   # cheeseburger
    legs(g,16,26,'0');return g
def hampter():
    g=Grid();g.ell(16,18,9,8,'9');g.ell(16,20,6,5,'5');g.rect(9,8,2,2,'9');g.rect(21,8,2,2,'9')
    g.rect(12,13,2,2,'P');g.rect(18,13,2,2,'P');g.set(16,16,'!');g.ell(9,18,2,2,'!');g.ell(23,18,2,2,'!')  # cheek pouches
    legs(g,16,26,'0',gap=4);return g
def pedro():
    g=Grid();g.ell(16,20,7,6,'7');g.ell(16,12,7,5,'7');g.rect(9,6,3,3,'7');g.rect(20,6,3,3,'7')
    g.rect(9,10,14,3,'*');eyes(g,11,19,10)   # bandit mask
    g.ell(16,15,3,2,'+');g.set(16,14,'P')
    for y in (18,21,24):g.rect(23,y,4,1,'8')   # ringed tail
    g.rect(23,19,4,2,'7');g.rect(23,22,4,2,'7');legs(g,16,26,'8');return g
def nyan():
    g=Grid()
    for i,c in enumerate(('$','%','y','3','1','&')):g.rect(0,12+i,8,1,c)
    g.rect(8,10,14,10,'9');g.rect(9,11,12,8,'!');[g.set(x,y,'$') for x,y in((11,13),(15,12),(18,15),(12,17))]
    g.ell(23,15,5,4,'7');g.set(19,10,'7');g.set(26,10,'7');g.set(21,14,'P');g.set(25,14,'P');g.set(23,16,'!')
    g.rect(9,20,2,2,'7');g.rect(19,20,2,2,'7');return g
def troll():
    g=Grid();g.ell(16,14,10,9,'w');g.rect(8,9,5,2,'P');g.rect(19,9,5,2,'P');g.set(9,11,'7');g.set(22,11,'7')
    g.rect(8,16,16,1,'P');g.rect(9,17,14,2,'+');g.rect(10,19,12,1,'P')   # the grin
    for x in range(10,23,2):g.set(x,17,'7')
    g.rect(13,23,6,4,'w');legs(g,16,26,'w');return g
def landwolf():
    g=Grid();g.ell(16,20,7,6,'7');g.ell(16,11,7,6,'7');g.rect(9,3,3,5,'7');g.rect(20,3,3,5,'7')
    g.ell(16,14,5,3,'+');g.rect(15,13,2,1,'P');eyes(g,11,19,9);g.rect(13,16,6,1,'$')
    g.rect(10,18,12,4,'8');legs(g,16,26,'8');return g
def gigachad():
    g=Grid();g.rect(9,17,14,9,'8');g.rect(8,17,4,4,'8');g.rect(20,17,4,4,'8')
    g.ell(16,10,6,7,'9');g.rect(10,13,12,4,'9');g.rect(10,15,12,2,'0')   # big jaw
    g.rect(10,3,12,3,'#');g.rect(11,8,3,1,'#');g.rect(18,8,3,1,'#');g.rect(12,9,2,1,'P');g.rect(18,9,2,1,'P')
    g.rect(14,13,4,1,'0');legs(g,16,26,'*');return g
def harambe():
    g=Grid();g.ell(16,20,9,7,'*');g.ell(16,11,7,6,'*');g.ell(16,13,5,4,'8');g.rect(12,10,2,1,'w');g.rect(18,10,2,1,'w')
    g.set(13,10,'P');g.set(18,10,'P');g.rect(14,14,4,1,'P');g.ell(7,21,2,4,'*');g.ell(25,21,2,4,'*')
    g.ell(16,4,4,2,'y');g.set(16,1,'y')   # halo
    legs(g,16,26,'*');return g
def finedog():
    g=Grid()
    for x in range(0,32,3):g.rect(x,22-(x%5),2,4+(x%5),'$');g.set(x,21-(x%5),'%')   # flames
    g.rect(6,24,8,4,'@');g.rect(18,24,8,4,'@')
    g.ell(16,17,6,5,'%');g.ell(16,10,6,5,'%');g.rect(10,3,12,3,'#');g.rect(8,5,16,1,'#')  # bowler hat
    g.rect(12,9,2,2,'w');g.rect(18,9,2,2,'w');g.set(13,10,'P');g.set(18,10,'P');g.rect(14,13,4,1,'P')
    g.rect(22,15,3,3,'w');g.set(25,16,'w');return g   # coffee mug
SPECIES=[('brett',brett),('apu',apu),('popcat',popcat),('cheems',cheems),('hampter',hampter),('pedro',pedro),('nyan',nyan),
 ('trollface',troll),('landwolf',landwolf),('gigachad',gigachad),('harambe',harambe),('finedog',finedog)]
if __name__=='__main__':
    os.makedirs(OUT,exist_ok=True);tiles=[]
    for n,f in SPECIES:
        a=f();a.outline();a.img('#2a1f4a').save(f'{OUT}/{n}-adult.png');ai=a.img('#2a1f4a',8);ai.save(f'{OUT}/{n}-adult-8x.png')
        m=f();m.outline();mythic(m);mi=m.img('#2a1f4a',8);mi.save(f'{OUT}/{n}-mythic-8x.png');m.img('#2a1f4a').save(f'{OUT}/{n}-mythic.png')
        tiles.append((n,ai,mi))
    ft=Image.open('/workspace/xcpets/design/art/funtrump/funtrump-3-adult-8x.png');fm=Image.open('/workspace/xcpets/design/art/funtrump/funtrump-5-mythic-8x.png')
    tiles.append(('funtrump (1 in 777)',ft,fm))
    cols=4;tw=2*256+36;th=256+40;rows=(len(tiles)+cols-1)//cols
    sh=Image.new('RGB',(cols*tw+12,rows*th+60),(20,20,26));d=ImageDraw.Draw(sh);d.text((12,12),'XCPETS Series 2 roster: rough sketches (Adult | Mythic). Design only.',fill=(255,210,63))
    for i,(n,a,m) in enumerate(tiles):
        x=12+(i%cols)*tw;y=44+(i//cols)*th;sh.paste(a,(x,y));sh.paste(m.resize((256,256)),(x+262,y));d.text((x,y+260),n,fill=(230,230,230))
    sh.save('/workspace/xcpets/previews/series2-roster/roster-sheet.png')
