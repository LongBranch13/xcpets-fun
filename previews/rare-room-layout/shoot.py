import sys
exec(open('base.py').read().split("with sync_playwright()")[0])
OPTS=[('current-problem',''),('option-a','rrl=a'),('option-b','rrl=b'),('option-c','rrl=c')]
CHK={}
def top(g): g.evaluate("(()=>{const s=document.getElementById('shopScene');const n=[...document.querySelectorAll('header,nav,.nav')].filter(e=>/fixed|sticky/.test(getComputedStyle(e).position)).reduce((m,e)=>Math.max(m,e.getBoundingClientRect().bottom),0);window.scrollTo(0,s.getBoundingClientRect().top+scrollY-n-4)})()"); g.wait_for_timeout(400)
def clean(g):
  g.keyboard.press('Escape'); g.add_style_tag(content='#toasts,.ip-tour,#ipSheet,.ip-away,#ipAway{display:none!important}')
  g.evaluate("[...document.querySelectorAll('body *')].forEach(e=>{const c=getComputedStyle(e);if(c.position==='fixed'&&+c.zIndex>=50&&!e.matches('.nav,nav,header'))e.style.display='none'})")
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
  for vw in (1280,390):
    for name,q in OPTS:
      c,g=ctx(b,vw); g.goto(base+'/play.html'+('?'+q if q else '')+'#rare-room',wait_until='domcontentloaded'); ready(g); clean(g); scene(g)
      if 'rrl=c' in q: g.evaluate("document.querySelector('[data-drw]')&&document.querySelector('[data-drw]').click()"); g.wait_for_timeout(800); g.evaluate("document.getElementById('shopScene').scrollIntoView()"); g.wait_for_timeout(300)
      top(g); g.screenshot(path=f'{out}/{name}-{vw}.png')
      el=g.query_selector('#rrGallery') or g.query_selector('.rr-rackw')
      if 'rrl=b' in q: el=g.query_selector('.rr-rackw')
      if el: el.scroll_into_view_if_needed(); g.wait_for_timeout(500); g.screenshot(path=f'{out}/{name}-{vw}-collection.png')
      if name=='current-problem': g.screenshot(path=f'{out}/{name}-{vw}-full.png',full_page=True)
      CHK[f'{name}-{vw}']=g.evaluate("""async()=>{const sl=t=>new Promise(r=>setTimeout(r,t)),W=()=>__demo.world(),o={sw:document.documentElement.scrollWidth,cards:document.querySelectorAll('#invPanel [data-ggid]').length,hits:V2Shop._state().hits.length,pageH:document.documentElement.scrollHeight};
        let gid=null;for(let tab=0;tab<7&&!gid;tab++){const fr=[...document.querySelectorAll('#invPanel [data-ggid]')].filter(b=>{const it=W().items[b.dataset.ggid];return it&&it.on==null}).slice(0,8);
          for(const f of fr){const id=f.dataset.ggid;const el=[...document.querySelectorAll('#invPanel [data-ggid]')].find(b=>b.dataset.ggid===id);if(!el)continue;el.click();await sl(700);const wb=document.getElementById('scWear');if(wb&&!wb.disabled){gid=id;wb.click();await sl(900);break}}
          if(!gid){const tb=document.querySelectorAll('[data-bslot]')[tab+1]||document.querySelectorAll('[data-drw]')[tab+1];if(!tb)break;tb.click();await sl(700)}}
        if(!gid)return o;o.worn=W().items[gid].on!=null;
        const off=document.getElementById('scOff');if(off){off.click();await sl(900);}o.offOk=W().items[gid].on==null;
        const best=document.getElementById('rrBest');if(best){best.click();await sl(900);}const u=document.getElementById('rrUndo');o.undo=!!u;if(u){u.click();await sl(900);}
        const bp=document.querySelector('[data-bpg="1"]');if(bp&&!bp.disabled){bp.click();await sl(500);o.flip=(document.querySelector('.rr-pager span')||{}).textContent}
        return o}""")
      c.close()
    for name,q in OPTS[1:]:
      c,g=ctx(b,vw,owner=False); g.goto(base+'/play.html?addr='+ME+'&'+q+'#rare-room',wait_until='domcontentloaded'); ready(g); scene(g)
      CHK[f'{name}-{vw}-view']=g.evaluate("""async()=>{const sl=t=>new Promise(r=>setTimeout(r,t));const S=()=>JSON.stringify(Object.values(__demo.world().items).filter(x=>x.owner==='%s').map(x=>x.on));const a=S();const cs=document.querySelectorAll('#invPanel [data-ggid]');if(cs[0]){cs[0].click();await sl(600)}const w=document.getElementById('scWear');if(w&&!w.disabled){w.click();await sl(600)}const bb=document.getElementById('rrBest');if(bb){bb.click();await sl(600)}return {cards:cs.length,unchanged:a===S()}}"""%ME)
      c.close()
      c,g=ctx(b,vw,rm=True); g.goto(base+'/play.html?'+q+'#rare-room',wait_until='domcontentloaded'); ready(g); scene(g)
      CHK[f'{name}-{vw}-rm']=g.evaluate("(()=>{const cs=[...document.querySelectorAll('.rr-card canvas')];return {cards:cs.length,anim:cs.filter(c=>getComputedStyle(c).animationName!=='none').length,raf:V2Shop._state().raf}})()")
      c.close()
  from PIL import Image
  c,g=ctx(b,1280); tiles=[]
  for n,q in [(0,'rrw=0'),(1,'rrw=1'),(2,'rrw=2'),(3,'rrw=3')]:
    g.goto(base+'/play.html?'+q+'#rare-room',wait_until='domcontentloaded'); ready(g); clean(g); scene(g); top(g)
    r=g.evaluate("(()=>{const c=document.querySelector('#shopScene canvas').getBoundingClientRect();return [c.left,c.top,c.width,c.height]})()")
    k=r[2]/320; f=f'{out}/_win{n}.png'; g.screenshot(path=f,clip={'x':r[0]+100*k,'y':r[1],'width':120*k,'height':100*k}); tiles.append(f)
  c.close(); ims=[Image.open(f) for f in tiles]; W_=sum(i.width for i in ims)+50; H_=max(i.height for i in ims)+40
  sh=Image.new('RGB',(W_,H_),(20,15,36)); x0=10
  for i in ims: sh.paste(i,(x0,30)); x0+=i.width+10
  sh.save(f'{out}/windows.png'); [os.remove(f) for f in tiles]
  b.close()
if srv: srv.terminate()
print(json.dumps(CHK,indent=1)); print('errors',len(errs)); [print(' ',e[:200]) for e in errs[:20]]
