import sys
exec(open('base.py').read().split("with sync_playwright()")[0])
from PIL import Image, ImageDraw, ImageFont
F=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',20)
GATE=int(os.environ.get('GATE','972500'))
RULES=open(os.path.join(src,'js/v2-rules.js')).read().replace('var ACTIVATE_WHEEL_RANDOM_BLOCK = null,','var ACTIVATE_WHEEL_RANDOM_BLOCK = %d,'%GATE)
def gctx(b,vw,gate=False,owner=True):
  c,g=ctx(b,vw,owner=owner)
  if gate: g.route(lambda u: '/js/v2-rules.js' in u,lambda r: r.fulfill(status=200,content_type='application/javascript',body=RULES))
  return c,g
def clean(g):
  g.keyboard.press('Escape'); g.add_style_tag(content='#toasts,.ip-tour,#ipSheet,.ip-away,#ipAway{display:none!important}')
  g.evaluate("[...document.querySelectorAll('body *')].forEach(e=>{const c=getComputedStyle(e);if(c.position==='fixed'&&+c.zIndex>=50&&!e.matches('.nav,nav,header,#confirmBox'))e.style.display='none'})")
def lab(path,text):
  im=Image.open(path).convert('RGB'); W_,H_=im.size; out=Image.new('RGB',(W_,H_+56),(20,15,36)); out.paste(im,(0,56)); d=ImageDraw.Draw(out); d.text((10,14),text,fill=(255,241,168),font=F); out.save(path)
NAV="[...document.querySelectorAll('header,nav,.nav')].filter(e=>/fixed|sticky/.test(getComputedStyle(e).position)).reduce((m,e)=>Math.max(m,e.getBoundingClientRect().bottom),0)"
def top(g,sel='#shopScene'): g.evaluate(f"window.scrollTo(0,document.querySelector('{sel}').getBoundingClientRect().top+scrollY-({NAV})-4)"); g.wait_for_timeout(500)
def tap(g,lx,ly):
  r=g.evaluate("(()=>{const r=document.querySelector('#shopScene canvas').getBoundingClientRect();return [r.left,r.top,r.width,r.height]})()")
  x=r[0]+lx*r[2]/320; y=r[1]+ly*r[3]/150
  if g.context.browser and False: pass
  g.mouse.click(x,y)
def shot(g,path,t): g.screenshot(path=path); lab(path,t)
INFO={}
def chk(g,tag):
  INFO[tag+'-sw']=g.evaluate("document.documentElement.scrollWidth")
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
  # scene with door, day + night
  for vw in (1280,390):
    for wn,nm in ((1,'day'),(3,'night')):
      c,g=gctx(b,vw,gate=True); g.goto(base+f'/play.html?rrw={wn}#rare-room',wait_until='domcontentloaded'); ready(g); clean(g); scene(g); top(g)
      shot(g,f'{out}/scene-door-{nm}-{vw}.png',f'Rare Room {nm} {vw}: the DRESS door (left of the mirror) · tap = dressing room'); chk(g,f'scene-{nm}-{vw}')
      if vw==1280: g.query_selector('#shopScene canvas').screenshot(path=f'{out}/canvas-door-{nm}-1280.png')
      c.close()
  # dressing room at 390/1280 + door GIF at 390
  for vw in (390,1280):
    c,g=gctx(b,vw,gate=True); g.goto(base+'/play.html?rrw=3#rare-room',wait_until='domcontentloaded'); ready(g); clean(g); scene(g); top(g)
    fr=[]; 
    def grab(n=1,dur=900):
      f=f'{out}/_d{vw}_{len(fr)}.png'; g.screenshot(path=f); fr.append((f,dur))
    grab(dur=1200)
    tap(g,122,80)
    for i in range(5): g.wait_for_timeout(80); grab(dur=120)
    g.wait_for_selector('#invPanel.dr-mode #rrDress',timeout=5000); g.wait_for_timeout(450); grab(dur=1200)
    r={}; r['hash']=g.evaluate('location.hash'); r['sceneHidden']=g.evaluate("getComputedStyle(document.getElementById('shopScene')).display==='none'")
    shot(g,f'{out}/dressing-room-{vw}.png',f'Dressing room {vw}: own view (#dressing-room), Back to the Rare Room at top')
    y0=g.evaluate('scrollY')
    g.evaluate("document.querySelectorAll('#drStrip .dr-pt')[1].click()"); g.wait_for_timeout(800); grab()
    gid=g.evaluate("(()=>{const L=[...document.querySelectorAll('#rrDress [data-dgid]')].filter(b=>__demo.world().items[b.dataset.dgid].on==null);L[0].click();return L[0].dataset.dgid})()"); g.wait_for_timeout(800); grab()
    if vw==390: shot(g,f'{out}/dressing-room-preview-390.png','Dressing room 390: picked pet + tapped card = try-on preview, big Wear')
    g.evaluate("document.getElementById('scWear').click()"); g.wait_for_timeout(1000); grab(dur=1600)
    r['pet']=g.evaluate("V2Shop._state().pet"); r['worn']=g.evaluate(f"__demo.world().items['{gid}'].on")==r['pet']; r['dy']=g.evaluate('scrollY')-y0
    r['undo']=g.evaluate("!!document.getElementById('rrUndo')"); chk(g,f'dress-{vw}')
    g.reload(wait_until='domcontentloaded'); ready(g); g.wait_for_timeout(3000); r['refreshStays']=g.evaluate("location.hash==='#dressing-room'&&document.getElementById('invPanel').classList.contains('dr-mode')")
    g.evaluate("document.getElementById('drBack').click()"); g.wait_for_timeout(1200); r['backHash']=g.evaluate('location.hash'); r['backScene']=g.evaluate("getComputedStyle(document.getElementById('shopScene')).display!=='none'")
    g.evaluate("document.getElementById('drEnter').click()"); g.wait_for_timeout(1000); g.go_back(); g.wait_for_timeout(1200); r['browserBack']=g.evaluate("location.hash+' '+document.getElementById('invPanel').classList.contains('dr-mode')")
    INFO[f'door-{vw}']=r
    if vw==390:
      ims=[Image.open(f).convert('P',palette=Image.ADAPTIVE) for f,_ in fr]; ims[0].save(f'{out}/door-pick-preview-wear-390.gif',save_all=True,append_images=ims[1:],duration=[d for _,d in fr],loop=0)
    [os.remove(f) for f,_ in fr]; c.close()
  # roll at the wheel (gate on): 390 GIF + confirm shot; 1280 panel shot
  for vw in (390,1280):
    c,g=gctx(b,vw,gate=True); g.goto(base+'/play.html?rrw=1#rare-room',wait_until='domcontentloaded'); ready(g); clean(g); scene(g); top(g)
    fr=[]
    def grab(dur=900):
      f=f'{out}/_r{vw}_{len(fr)}.png'; g.screenshot(path=f); fr.append((f,dur))
    grab(1200)
    if vw==1280: g.query_selector('#pepeWheel').screenshot(path=f'{out}/wheel-panel-1280.png')
    else: g.query_selector('#pepeWheel').screenshot(path=f'{out}/wheel-panel-390.png')
    tap(g,250,119); g.wait_for_selector('#confirmBox.on, #confirmBox[open], #confirmBox:not([hidden])',timeout=5000); g.wait_for_timeout(700)
    INFO[f'confirm-{vw}']=g.evaluate("(()=>{const b=document.getElementById('confirmBox');return {shown:getComputedStyle(b).display!=='none',title:document.getElementById('cfTitle').textContent,body:document.getElementById('cfBody').innerText.slice(0,500)}})()")
    if vw==390: shot(g,f'{out}/roll-confirm-390.png','Tap the wheel = 1 tap → the normal burn confirm (pet:spin · 345). Not signed.')
    grab(2200)
    # MOCK (local only): close the confirm without signing, play the same after-send effect
    g.evaluate("document.getElementById('cfNo').click()"); g.wait_for_timeout(300); g.evaluate("V2Shop._spinFx()")
    for i in range(10): g.wait_for_timeout(120); grab(130)
    g.wait_for_timeout(1500); grab(1200)
    g.evaluate("document.getElementById('pepeWheel').scrollIntoView({block:'center'})"); g.wait_for_timeout(400); grab(1800)
    if vw==390: shot(g,f'{out}/roll-reveal-390.png','After the spin: who got what (1 of N wearers) + 👕 Wear it')
    w_=g.query_selector('[data-wgid]')
    if w_: w_.click(); g.wait_for_timeout(1300); grab(1800); INFO[f'wearit-{vw}']=g.evaluate("({hash:location.hash,pet:V2Shop._state().pet,sel:(V2Shop._state().sel||{}).gid})")
    if vw==390:
      ims=[Image.open(f).convert('P',palette=Image.ADAPTIVE) for f,_ in fr]; ims[0].save(f'{out}/roll-at-wheel-390.gif',save_all=True,append_images=ims[1:],duration=[d for _,d in fr],loop=0)
    [os.remove(f) for f,_ in fr]; chk(g,f'roll-{vw}'); c.close()
  # gate OFF (today): wheel panel unchanged + door works
  for vw in (390,1280):
    c,g=gctx(b,vw,gate=False); g.goto(base+'/play.html?rrw=1#rare-room',wait_until='domcontentloaded'); ready(g); clean(g); scene(g); top(g)
    g.query_selector('#pepeWheel').screenshot(path=f'{out}/gate-off-wheel-panel-{vw}.png'); INFO[f'gateoff-{vw}']=g.evaluate("({best:!!document.querySelector('.rr-best[data-rpid]'),crew:document.querySelectorAll('.rr-crew').length,spin:!!document.getElementById('whSpin')})"); chk(g,f'off-{vw}'); c.close()
    # view-only
    c,g=gctx(b,vw,gate=True,owner=False); g.goto(base+'/play.html?addr='+ME+'#dressing-room',wait_until='domcontentloaded'); ready(g); g.wait_for_timeout(3000)
    INFO[f'view-{vw}']=g.evaluate("""async()=>{const sl=t=>new Promise(r=>setTimeout(r,t));const S=()=>JSON.stringify(__demo.world().itemList.filter(x=>x.owner==='%s').map(x=>x.on));const a=S();const c=document.querySelector('#rrDress [data-dgid]');if(c){c.click();await sl(600)}const w=document.getElementById('scWear');if(w&&!w.disabled){w.click();await sl(600)}const bb=document.getElementById('rrBest');if(bb){bb.click();await sl(600)}return {dr:document.getElementById('invPanel').classList.contains('dr-mode'),unchanged:a===S()}}"""%ME)
    chk(g,f'view-{vw}'); c.close()
    # reduced motion: door enter immediate
    c=b.new_context(viewport={'width':vw,'height':844},reduced_motion='reduce'); c.add_init_script(init(True)); g=c.new_page(); g.on('pageerror',lambda e: errs.append('rm '+str(e)))
    g.route('**/*',lambda r: r.continue_() if (r.request.url.startswith(base) or 'fonts.g' in r.request.url) else r.abort())
    g.goto(base+'/play.html#rare-room',wait_until='domcontentloaded'); ready(g); scene(g); top(g); tap(g,122,80); g.wait_for_timeout(250)
    INFO[f'rm-{vw}']=g.evaluate("({hash:location.hash,anim:(document.getElementById('rrDress')||{}).className})"); c.close()
  b.close()
if srv: srv.terminate()
print(json.dumps(INFO,indent=1,ensure_ascii=False)); print('errors',len(errs)); [print(' ',e[:250]) for e in errs[:20]]
