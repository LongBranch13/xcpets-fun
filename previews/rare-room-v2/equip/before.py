import sys
exec(open('base.py').read().split("with sync_playwright()")[0])
from PIL import Image, ImageDraw, ImageFont
F=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',22) if os.path.exists('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf') else ImageFont.load_default()
def clean(g):
  g.keyboard.press('Escape'); g.add_style_tag(content='#toasts,.ip-tour,#ipSheet,.ip-away,#ipAway{display:none!important}')
  g.evaluate("[...document.querySelectorAll('body *')].forEach(e=>{const c=getComputedStyle(e);if(c.position==='fixed'&&+c.zIndex>=50&&!e.matches('.nav,nav,header'))e.style.display='none'})")
def lab(path,text):
  im=Image.open(path).convert('RGB'); W_,H_=im.size; out=Image.new('RGB',(W_,H_+70),(20,15,36)); out.paste(im,(0,70)); d=ImageDraw.Draw(out); d.text((12,12),text,fill=(255,241,168),font=F); out.save(path)
Y="(()=>{const e=document.querySelector(arguments[0]);return e?Math.round(e.getBoundingClientRect().top+scrollY):null})()"
info={}
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
  for vw in (390,1280):
    c,g=ctx(b,vw); g.goto(base+'/play.html?rrw=1#rare-room',wait_until='domcontentloaded'); ready(g); clean(g)
    g.wait_for_selector('#scPetPick .pk-key',timeout=60000); g.wait_for_timeout(1500)
    pos=lambda s: g.evaluate("(s)=>{const e=document.querySelector(s);return e?Math.round(e.getBoundingClientRect().top+scrollY):null}",s)
    info[vw]={'scene':pos('#shopScene'),'picker':pos('#scPetPick'),'gallery':pos('#rrGallery'),'wheel':pos('#pepeWheel'),'vh':g.evaluate('innerHeight')}
    if vw==390:
      for sel,name,t in [('#scPetPick','brown-1-pet-picker','Candidate 1: pet picker cards (brown boxes) + its species/sort dropdowns'),('#shopCounter','brown-2-counter-panel','Candidate 2: the brown panel behind the gear steps'),('.rr-views','brown-3-view-toggle','Candidate 3: Binder/Rack/Drawers toggle'),('#rrGallery .rr-tabs','brown-4-binder-tabs','Candidate 4: binder slot tabs')]:
        e=g.query_selector(sel)
        if e: e.scroll_into_view_if_needed(); g.wait_for_timeout(400); e.screenshot(path=f'{out}/{name}.png'); lab(f'{out}/{name}.png',t)
      g.evaluate("document.querySelector('[data-rrv=c]').click()"); g.wait_for_timeout(900); e=g.query_selector('.rr-cab'); e.scroll_into_view_if_needed(); e.screenshot(path=f'{out}/brown-5-drawers.png'); lab(f'{out}/brown-5-drawers.png','Candidate 5: Drawers view (brown wood drawers)')
      g.evaluate("document.querySelector('[data-rrv=a]').click()"); g.wait_for_timeout(900)
      d=g.query_selector('details:has(#scSpPick)') 
      if d: g.evaluate("(d)=>d.open=true",d); g.wait_for_timeout(900); e=g.query_selector('#scSpPick'); e.scroll_into_view_if_needed(); e.screenshot(path=f'{out}/brown-6-species-picker.png'); lab(f'{out}/brown-6-species-picker.png','Candidate 6: Roll by species picker (same brown cards)')
      # step shots
      e=g.query_selector('#scPetPick'); g.evaluate("document.getElementById('scPetPick').scrollIntoView({block:'start'})"); g.wait_for_timeout(500); g.screenshot(path=f'{out}/before-step1-390.png'); lab(f'{out}/before-step1-390.png','BEFORE 1: scroll down to Step 1, page with < > to find the pet, tap it')
      g.evaluate("document.querySelectorAll('#scPetPick .pk-key')[1].click()"); g.wait_for_timeout(900)
      g.evaluate("document.getElementById('rrGallery').scrollIntoView({block:'start'})"); g.wait_for_timeout(500); g.screenshot(path=f'{out}/before-step2-390.png'); lab(f'{out}/before-step2-390.png','BEFORE 2: walls show 6 pieces; scroll ~far down to the binder, tab/flip, tap a card')
      g.evaluate("(()=>{for(const t of document.querySelectorAll('[data-bslot]')){}const L=[...document.querySelectorAll('#rrGallery [data-ggid]')];(L.find(b=>__demo.world().items[b.dataset.ggid].on==null)||L[0]).click()})()"); g.wait_for_timeout(1500)
      g.screenshot(path=f'{out}/before-step3-390.png'); lab(f'{out}/before-step3-390.png','BEFORE 3: page JUMPS back up to the scene; Wear button is further down')
      info['after_tap_scrollY']=g.evaluate('scrollY'); info['wear_y']=pos('#scWear')
    c.close()
  b.close()
if srv: srv.terminate()
print(json.dumps(info)); print('errors',len(errs))
