import sys
exec(open('base.py').read().split("with sync_playwright()")[0])
from PIL import Image
CHK={}
def top(g): g.evaluate("(()=>{const s=document.getElementById('shopScene');const n=[...document.querySelectorAll('header,nav,.nav')].filter(e=>/fixed|sticky/.test(getComputedStyle(e).position)).reduce((m,e)=>Math.max(m,e.getBoundingClientRect().bottom),0);window.scrollTo(0,s.getBoundingClientRect().top+scrollY-n-4)})()"); g.wait_for_timeout(500)
def clean(g):
  g.keyboard.press('Escape'); g.add_style_tag(content='#toasts,.ip-tour,#ipSheet,.ip-away,#ipAway{display:none!important}')
  g.evaluate("[...document.querySelectorAll('body *')].forEach(e=>{const c=getComputedStyle(e);if(c.position==='fixed'&&+c.zIndex>=50&&!e.matches('.nav,nav,header'))e.style.display='none'})")
def canvas_shot(g,path):
  g.query_selector('#shopScene canvas').screenshot(path=path)
FUNC="""async()=>{const sl=t=>new Promise(r=>setTimeout(r,t)),W=()=>__demo.world(),o={sw:document.documentElement.scrollWidth,cards:document.querySelectorAll('#invPanel [data-ggid]').length,hits:V2Shop._state().hits.length};
 let gid=null;for(let tab=0;tab<7&&!gid;tab++){const fr=[...document.querySelectorAll('#invPanel [data-ggid]')].filter(b=>{const it=W().items[b.dataset.ggid];return it&&it.on==null}).slice(0,8);
  for(const f of fr){const id=f.dataset.ggid;const el=[...document.querySelectorAll('#invPanel [data-ggid]')].find(b=>b.dataset.ggid===id);if(!el)continue;el.click();await sl(700);const wb=document.getElementById('scWear');if(wb&&!wb.disabled){gid=id;wb.click();await sl(900);break}}
  if(!gid){const tb=document.querySelectorAll('[data-bslot]')[tab+1]||document.querySelectorAll('[data-drw]')[tab+1];if(!tb)break;tb.click();await sl(700)}}
 if(!gid)return o;o.worn=W().items[gid].on!=null;o.undoAfterWear=!!document.getElementById('rrUndo');const u=document.getElementById('rrUndo');if(u){u.click();await sl(900);o.undoOk=W().items[gid].on==null}
 const worn=[...document.querySelectorAll('#invPanel [data-ggid]')].find(b=>{const it=W().items[b.dataset.ggid];return it&&it.on!=null});if(worn){const wg=worn.dataset.ggid;worn.click();await sl(700);const off=document.getElementById('scOff');if(off){off.click();await sl(900)}o.offOk=W().items[wg].on==null}
 const best=document.getElementById('rrBest');if(best){best.click();await sl(900)}o.undoAfterBest=!!document.getElementById('rrUndo');
 const snd=[...document.querySelectorAll('button,a')].find(e=>/sound|🔇|🔊/i.test((e.getAttribute('aria-label')||'')+e.textContent)&&e.offsetParent);const cv=document.querySelector('#shopScene canvas').getBoundingClientRect();if(snd){const r=snd.getBoundingClientRect();o.soundBelowScene=r.top>=cv.bottom-1}
 return o}"""
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
  for vw in (1280,390):
    c,g=ctx(b,vw); g.goto(base+'/play.html?rrw=1#rare-room',wait_until='domcontentloaded'); ready(g); clean(g); scene(g); top(g)
    CHK[f'default-{vw}']=g.evaluate("V2Shop._state().hits.length+' hits; view btn on='+(document.querySelector('.rr-views .on')||{}).textContent")
    for v,nm in (('a','binder'),('b','rack'),('c','drawers')):
      g.evaluate(f"document.querySelector('[data-rrv={v}]').click()"); g.wait_for_timeout(900)
      if v=='c': g.evaluate("document.querySelector('[data-drw]').click()"); g.wait_for_timeout(700)
      top(g); g.screenshot(path=f'{out}/view-{nm}-{vw}.png')
      el=g.query_selector('.rr-rackw' if v=='b' else '#rrGallery'); el.scroll_into_view_if_needed(); g.wait_for_timeout(400); g.screenshot(path=f'{out}/view-{nm}-{vw}-collection.png')
      if v=='a' and vw==390: el.screenshot(path=f'{out}/binder-390.png')
    g.evaluate("document.querySelector('[data-rrv=b]').click()"); g.wait_for_timeout(500); g.reload(wait_until='domcontentloaded'); ready(g); scene(g)
    CHK[f'persist-{vw}']=g.evaluate("({stored:localStorage.getItem('xcpets-v2-rr-view'),rack:!!document.querySelector('.rr-rackw .rr-rack'),on:(document.querySelector('.rr-views .on')||{}).textContent})")
    g.evaluate("document.querySelector('[data-rrv=a]').click()"); g.wait_for_timeout(700); top(g)
    g.query_selector('.rr-vw').screenshot(path=f'{out}/toggle-{vw}.png')
    CHK[f'func-{vw}']=g.evaluate(FUNC)
    if vw==390:
      d=g.query_selector('#pepeWheel'); d.scroll_into_view_if_needed(); g.wait_for_timeout(600); d.screenshot(path=f'{out}/roll-panel-390.png')
    c.close()
    for wn,nm in ((1,'day'),(2,'dusk'),(3,'night')):
      if vw==390 and wn==2: continue
      c,g=ctx(b,vw); g.goto(base+f'/play.html?rrw={wn}#rare-room',wait_until='domcontentloaded'); ready(g); clean(g); scene(g); top(g); g.screenshot(path=f'{out}/scene-{nm}-{vw}.png')
      if vw==1280: canvas_shot(g,f'{out}/canvas-{nm}-1280.png')
      c.close()
    c,g=ctx(b,vw,owner=False); g.goto(base+'/play.html?addr='+ME+'#rare-room',wait_until='domcontentloaded'); ready(g); scene(g)
    CHK[f'view-{vw}']=g.evaluate("""async()=>{const sl=t=>new Promise(r=>setTimeout(r,t));const S=()=>JSON.stringify(Object.values(__demo.world().items).filter(x=>x.owner==='%s').map(x=>x.on));const a=S();const cs=document.querySelectorAll('#invPanel [data-ggid]');if(cs[0]){cs[0].click();await sl(600)}const w=document.getElementById('scWear');if(w&&!w.disabled){w.click();await sl(600)}const bb=document.getElementById('rrBest');if(bb){bb.click();await sl(600)}return {cards:cs.length,unchanged:a===S()}}"""%ME)
    c.close()
    c,g=ctx(b,vw,rm=True); g.goto(base+'/play.html?rrw=2#rare-room',wait_until='domcontentloaded'); ready(g); scene(g)
    a1=g.query_selector('#shopScene canvas').screenshot(); g.wait_for_timeout(2500); a2=g.query_selector('#shopScene canvas').screenshot()
    CHK[f'rm-{vw}']={'staticScene':a1==a2,'raf':g.evaluate("V2Shop._state().raf"),'anim':g.evaluate("[...document.querySelectorAll('.rr-card canvas')].filter(c=>getComputedStyle(c).animationName!=='none').length")}
    c.close()
  # GIF
  c,g=ctx(b,1280); g.goto(base+'/play.html?rrw=1#rare-room',wait_until='domcontentloaded'); ready(g); clean(g); scene(g); top(g)
  g.evaluate("V2Shop.spin(3000)"); fr=[]
  for i in range(30):
    f=f'{out}/_g{i}.png'; g.query_selector('#shopScene canvas').screenshot(path=f); fr.append(Image.open(f).convert('P',palette=Image.ADAPTIVE)); g.wait_for_timeout(90)
  fr[0].save(f'{out}/dan-spin.gif',save_all=True,append_images=fr[1:],duration=110,loop=0); [os.remove(f'{out}/_g{i}.png') for i in range(30)]
  c.close(); b.close()
if srv: srv.terminate()
print(json.dumps(CHK,indent=1)); print('errors',len(errs)); [print(' ',e[:200]) for e in errs[:20]]
