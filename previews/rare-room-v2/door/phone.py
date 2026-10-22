exec(open('shoot.py').read().split("with sync_playwright() as p:")[0])
R={}
def mclick(g,sel):
  r=g.evaluate("(s)=>{const e=document.querySelector(s);const r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]}",sel); g.mouse.click(r[0],r[1])
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
  c,g=gctx(b,390,gate=True); g.goto(base+'/play.html?rrw=3#rare-room',wait_until='domcontentloaded'); ready(g); clean(g); scene(g); top(g)
  fr=[]
  def grab(dur=900):
    f=f'{out}/_p{len(fr)}.png'; g.screenshot(path=f); fr.append((f,dur))
  grab(1200); tap(g,122,80)
  for i in range(5): g.wait_for_timeout(80); grab(120)
  g.wait_for_selector('#invPanel.dr-mode #rrDress',timeout=5000); g.wait_for_timeout(500); grab(1300)
  TOP="Math.round(document.getElementById('shopCounter').getBoundingClientRect().top)"; y0=g.evaluate(TOP); taps=1
  R['prepicked']=g.evaluate("V2Shop._state().pet")
  gid=g.evaluate("(()=>{const L=[...document.querySelectorAll('#rrDress [data-dgid]')].filter(b=>__demo.world().items[b.dataset.dgid].on==null);return L[0].dataset.dgid})()"); mclick(g,f'#rrDress [data-dgid="{gid}"]'); taps+=1; g.wait_for_timeout(800); grab(1300)
  vis="(s)=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight}"
  R['onScreen']={k:g.evaluate(vis,s) for k,s in [('preview','.dr-prev'),('firstCards','.dr-grid .rr-card'),('wear','#scWear'),('best','#rrBest')]}
  shot(g,f'{out}/dressing-room-390.png','Dressing room 390: pet pre-picked, preview + slots + gear + sticky Wear bar on one screen')
  mclick(g,'#scWear'); taps+=1; g.wait_for_timeout(1000); grab(1600)
  R['worn']=g.evaluate(f"__demo.world().items['{gid}'].on")==R['prepicked']; R['taps']=taps; R['screenShift']=g.evaluate(TOP)-y0
  R['undoOnScreen']=g.evaluate(vis,'#rrUndo')
  # pick another pet: still one screen, no jump
  y1=g.evaluate(TOP); mclick(g,'#drStrip .dr-pt:nth-child(3)'); g.wait_for_timeout(800); grab(1100)
  mclick(g,'#rrDress [data-dgid]'); g.wait_for_timeout(800); grab(1300)
  R['afterPick']={'screenShift':g.evaluate(TOP)-y1,'wear':g.evaluate(vis,'#scWear') ,'preview':g.evaluate(vis,'.dr-prev'),'cards':g.evaluate(vis,'.dr-grid .rr-card')}
  R['lsPet']=g.evaluate("localStorage.getItem('xcpets-v2-dr-pet')"); pk=g.evaluate("V2Shop._state().pet")
  g.reload(wait_until='domcontentloaded'); ready(g); g.wait_for_timeout(2500); R['lastUsedAfterReload']=g.evaluate("V2Shop._state().pet")==pk
  R['sw']=g.evaluate('document.documentElement.scrollWidth')
  ims=[Image.open(f).convert('P',palette=Image.ADAPTIVE) for f,_ in fr]; ims[0].save(f'{out}/door-pick-preview-wear-390.gif',save_all=True,append_images=ims[1:],duration=[d for _,d in fr],loop=0); [os.remove(f) for f,_ in fr]
  c.close()
  c,g=gctx(b,1280,gate=True); g.goto(base+'/play.html#dressing-room',wait_until='domcontentloaded'); ready(g); clean(g); g.wait_for_timeout(2500); g.evaluate("document.querySelector('#rrDress [data-dgid]').click()"); g.wait_for_timeout(800)
  shot(g,f'{out}/dressing-room-1280.png','Dressing room 1280 (sticky action bar)'); R['sw1280']=g.evaluate('document.documentElement.scrollWidth'); c.close()
  b.close()
if srv: srv.terminate()
print(json.dumps(R,indent=1)); print('errors',len(errs)); [print(' ',e[:200]) for e in errs[:10]]
