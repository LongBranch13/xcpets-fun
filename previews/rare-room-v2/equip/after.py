import sys
exec(open('before.py').read().split("info={}")[0])
info={}
def shot(g,path,t): g.screenshot(path=path); lab(path,t)
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
  for vw in (390,1280):
    c,g=ctx(b,vw); g.goto(base+'/play.html?rrw=1#rare-room',wait_until='domcontentloaded'); ready(g); clean(g)
    g.wait_for_selector('#rrDress .dr-pt',timeout=60000); g.wait_for_timeout(1200)
    nav="[...document.querySelectorAll('header,nav,.nav')].filter(e=>/fixed|sticky/.test(getComputedStyle(e).position)).reduce((m,e)=>Math.max(m,e.getBoundingClientRect().bottom),0)"
    g.evaluate(f"window.scrollTo(0,document.getElementById('rrDress').getBoundingClientRect().top+scrollY-({nav})-4)"); g.wait_for_timeout(500)
    g.mouse.move(5,300); g.mouse.wheel(0,1); g.wait_for_timeout(300); r={}; y0=g.evaluate('scrollY'); fr=[]
    def grab(i):
      f=f'{out}/_f{vw}_{i}.png'; g.screenshot(path=f); fr.append(f)
    shot(g,f'{out}/after-step0-{vw}.png','AFTER 0: Dressing room right under the scene: pets as portraits, search, big preview + 6 slots'); grab(0)
    g.evaluate("document.querySelectorAll('#drStrip .dr-pt')[1].click()"); g.wait_for_timeout(900)
    shot(g,f'{out}/after-step1-{vw}.png','AFTER tap 1: tap a pet portrait (it becomes the preview, gear below = what fits it)'); grab(1)
    r['pet']=g.evaluate("V2Shop._state().pet")
    gid=g.evaluate("(()=>{const L=[...document.querySelectorAll('#rrDress [data-dgid]')];L[0].click();return L[0].dataset.dgid})()"); g.wait_for_timeout(900)
    shot(g,f'{out}/after-step2-{vw}.png','AFTER tap 2: tap a card: try-on shows on the preview, power change, big Wear button'); grab(2)
    r['gridTopInView']=g.evaluate("document.querySelector('.dr-grid').getBoundingClientRect().top<innerHeight-60"); r['wearVisible']=g.evaluate("(()=>{const e=document.getElementById('scWear');if(!e)return null;const q=e.getBoundingClientRect();return q.top>=0&&q.bottom<=innerHeight&&!e.disabled})()")
    g.evaluate("document.getElementById('scWear').click()"); g.wait_for_timeout(1000)
    shot(g,f'{out}/after-step3-{vw}.png','AFTER tap 3: Wear: done, shown on the pet + slot list, Undo right there'); grab(3)
    r['worn']=g.evaluate(f"__demo.world().items['{gid}'].on")==r['pet']; r['noJump']=abs(g.evaluate('scrollY')-y0)<2; r['dy']=g.evaluate('scrollY')-y0
    r['undo']=g.evaluate("!!document.getElementById('rrUndo')")
    g.evaluate("document.getElementById('rrUndo').click()"); g.wait_for_timeout(900); r['undoOk']=g.evaluate(f"__demo.world().items['{gid}'].on==null")
    # tap-again-to-wear
    r['selStillAfterUndo']=g.evaluate("V2Shop._state().sel&&V2Shop._state().sel.gid")==gid; g.evaluate(f"document.querySelector('[data-dgid=\"{gid}\"]').click()"); g.wait_for_timeout(900); r['tapAgainWears']=g.evaluate(f"__demo.world().items['{gid}'].on")==r['pet']
    # per-slot take off
    g.evaluate(f"document.querySelector('#rrDress [data-droff][data-gid=\"{gid}\"]').click()"); g.wait_for_timeout(900); r['slotTakeOff']=g.evaluate(f"__demo.world().items['{gid}'].on==null"); grab(4)
    g.evaluate("document.getElementById('rrBest').click()"); g.wait_for_timeout(1000); r['bestWorn']=g.evaluate("__demo.world().itemList.filter(x=>x.on===V2Shop._state().pet).length"); r['undoAfterBest']=g.evaluate("!!document.getElementById('rrUndo')"); grab(5)
    g.evaluate("document.getElementById('drQ').value='Polu';document.getElementById('drQ').dispatchEvent(new Event('input'))"); g.wait_for_timeout(700); r['search']=g.evaluate("document.querySelectorAll('#drStrip .dr-pt').length")
    r['brownLeft']=g.evaluate("[...document.querySelectorAll('#invPanel *')].filter(e=>e.offsetParent&&/rgb\\((5[0-9]|[2-6][0-9]), (2[0-9]|3[0-9]|4[0-9]), (1[0-9]|2[0-9])\\)/.test(getComputedStyle(e).backgroundColor)).map(e=>(e.id||e.className)+'|'+getComputedStyle(e).backgroundColor+'|'+(e.closest('[id]')||{}).id).slice(0,8)")
    r['sw']=g.evaluate("document.documentElement.scrollWidth")
    d=g.query_selector('.rr-browse'); d.scroll_into_view_if_needed(); g.evaluate("document.querySelector('.rr-browse').open=true"); g.wait_for_timeout(600); d.screenshot(path=f'{out}/after-browse-{vw}.png')
    w_=g.query_selector('#pepeWheel'); 
    if w_: w_.scroll_into_view_if_needed(); g.wait_for_timeout(400); w_.screenshot(path=f'{out}/after-roll-panel-{vw}.png')
    info[vw]=r
    ims=[Image.open(f).convert('P',palette=Image.ADAPTIVE) for f in fr]; ims[0].save(f'{out}/equip-flow-{vw}.gif',save_all=True,append_images=ims[1:],duration=1100,loop=0); [os.remove(f) for f in fr]
    c.close()
    c,g=ctx(b,vw,owner=False); g.goto(base+'/play.html?addr='+ME+'#rare-room',wait_until='domcontentloaded'); ready(g); g.wait_for_selector('#rrDress .dr-pt',timeout=60000)
    info[f'view-{vw}']=g.evaluate("""async()=>{const sl=t=>new Promise(r=>setTimeout(r,t));const S=()=>JSON.stringify(__demo.world().itemList.filter(x=>x.owner==='%s').map(x=>x.on));const a=S();const c=document.querySelector('#rrDress [data-dgid]');c.click();await sl(600);const w=document.getElementById('scWear');if(w&&!w.disabled){w.click();await sl(600)}const o=document.querySelector('[data-droff]');if(o){o.click();await sl(600)}const bb=document.getElementById('rrBest');if(bb){bb.click();await sl(600)}return {unchanged:a===S()}}"""%ME)
    c.close()
  b.close()
if srv: srv.terminate()
print(json.dumps(info,indent=1)); print('errors',len(errs)); [print(' ',e[:250]) for e in errs[:15]]
