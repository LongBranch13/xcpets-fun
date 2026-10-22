# usage: python3 test.py <base-url|worktree> <outdir> [snap]  -- simulated owner via localStorage; never signs, never opens a burn confirm
import sys,json,subprocess,time,os,re
from playwright.sync_api import sync_playwright
src,out=sys.argv[1:3]; os.makedirs(out,exist_ok=True); live=src.startswith('http')
if live: base=src; srv=None
else:
  port=8900+os.getpid()%90; srv=subprocess.Popen(['python3','-m','http.server',str(port)],cwd=src,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(2); base=f'http://localhost:{port}'
SNAP=sys.argv[3] if len(sys.argv)>3 else None
ME=os.environ.get('ME','bc1pfvkpmllr7mtn5uazqxumwp39h2ny3c8l6fmrgvjv2cqn5wlpt7hssf3gqd')
pre="localStorage.setItem('xcpets-v2-wizard-farewell-seen','x');localStorage.setItem('xcpets-v2-kek-arrival-seen','1');"
if SNAP:
  T=json.load(open(SNAP)); snapjs="localStorage.setItem('xcpets-v2-prod-hashes',JSON.stringify(T.hashes));sessionStorage.setItem('xcpets-v2-prod-rows',JSON.stringify({at:Date.now()+1e10,rows:T.rows,tip:T.tip,mempool:[],me:ME,balance:0}));"
  tj=json.dumps({'hashes':T['hashes'],'rows':T['rows'],'tip':T['tip']})
else: snapjs='';tj='null'
def init(owner): return "(()=>{if(sessionStorage.getItem('ti'))return;sessionStorage.setItem('ti','1');const T=%s,ME='%s';localStorage.clear();%s%s%s})()"%(tj,ME,pre,("localStorage.setItem('xcpets-v2-me',ME);localStorage.setItem('xcpets-xcpwallet-address',ME);" if owner else ''),snapjs)
errs=[];R={}
def ctx(b,vw,owner=True,rm=False):
  c=b.new_context(viewport={'width':vw,'height':900 if vw>500 else 844},device_scale_factor=1 if vw>500 else 2,is_mobile=vw<500,has_touch=vw<500,reduced_motion='reduce' if rm else 'no-preference')
  c.add_init_script(init(owner)); g=c.new_page(); tag=f'{vw}{"" if owner else "-view"}{"-rm" if rm else ""}'
  g.on('console',lambda m: errs.append(f'{tag} {g.url[-40:]}: '+m.text) if m.type=='error' else None)
  g.on('pageerror',lambda e: errs.append(f'{tag} pageerror: '+str(e)))
  g.on('dialog',lambda d: (errs.append('UNEXPECTED DIALOG '+d.message[:80]), d.dismiss()))
  if not live:
    def route(r):
      u=r.request.url
      if u.startswith(base) or u.startswith('data:') or 'fonts.g' in u: r.continue_()
      else: r.abort()
    g.route('**/*',route)
  return c,g
def scene(g):
  g.wait_for_function("(()=>{const s=document.getElementById('shopScene');s.scrollIntoView();return !!s.querySelector('canvas')})()",timeout=60000,polling=500); g.wait_for_timeout(1500); g.evaluate("document.getElementById('shopScene').scrollIntoView()"); g.wait_for_timeout(500)
def ready(g): g.wait_for_function("window.__demo&&__demo.world()&&__demo.world().itemList&&__demo.world().itemList.length>100",timeout=240000); g.wait_for_timeout(2500)
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
  for vw in (1280,390):
    r=R.setdefault(vw,{})
    c,g=ctx(b,vw)
    # page sweep
    pid=None
    for path in ['/','/play.html','/play.html#rare-room','/play.html#lair','/play.html#drip-den','/pets.html','/archive.html','/pet.html']:
      u=path
      if path=='/pet.html': u='/pet.html?id=%s'%pid
      g.goto(base+u,wait_until='domcontentloaded')
      if 'play' in path:
        ready(g)
        if pid is None: pid=g.evaluate(f"__demo.mine(__demo.world()).filter(p=>!p.dead)[0].id")
      else: g.wait_for_timeout(9000)
      sw=g.evaluate("document.documentElement.scrollWidth"); r[u]={'scrollW':sw}
      if '#' in path:
        r[u]['sceneTop']=g.evaluate("(()=>{const e=document.getElementById('shopScene');return e?Math.round(e.getBoundingClientRect().top):null})()")
      if path=='/': r['front']=g.evaluate("(()=>({rareRoom:document.body.innerText.includes('The Rare Room'),links:[...document.querySelectorAll('a[href*=\"rare-room\"]')].length}))()"); g.screenshot(path=f'{out}/index-{vw}.png')
      if path=='/pets.html': g.screenshot(path=f'{out}/pets-{vw}.png')
      if path=='/archive.html': g.screenshot(path=f'{out}/archive-{vw}.png')
      if path=='/pet.html': g.screenshot(path=f'{out}/pet-{vw}.png')
    # rare room checks
    g.goto(base+'/play.html#rare-room',wait_until='domcontentloaded'); ready(g)
    scene(g)
    r['hint']=g.evaluate("""(()=>{const h=document.querySelector('#shopScene .qw-hint'),cv=document.querySelector('#shopScene canvas');if(!h)return 'none';const a=h.getBoundingClientRect(),c=cv.getBoundingClientRect();return {text:h.textContent,belowCanvas:a.top>=c.bottom-1,top:a.top,cb:c.bottom}})()""")
    g.screenshot(path=f'{out}/rare-room-hint-{vw}.png')
    r['pixelTicks']=g.evaluate("""(()=>{const o=[];const sec=document.getElementById('invPanel');const tw=document.createTreeWalker(sec,NodeFilter.SHOW_TEXT);let n;while(n=tw.nextNode()){if(/[✓✔]/.test(n.data)){const f=getComputedStyle(n.parentElement).fontFamily;o.push({t:n.data.trim().slice(0,60),f:f.slice(0,40)})}}return o})()""")
    r['danPresent']=g.evaluate("!!window.V2Shop")
    # equip + undo
    r['equip']=g.evaluate("""async()=>{const sl=t=>new Promise(r=>setTimeout(r,t)),W=()=>__demo.world(),o={};
      const free=[...document.querySelectorAll('#invPanel [data-ggid]')].find(b=>{const it=W().items[b.dataset.ggid];return it&&it.on==null});
      if(!free)return 'no free card';const gid=free.dataset.ggid;free.click();await sl(700);
      const wear=document.getElementById('scWear');o.wearBtn=!!wear;if(!wear||wear.disabled)return o;wear.click();await sl(900);
      o.onAfterWear=W().items[gid].on;const u=document.getElementById('rrUndo');o.undoBtn=!!u;if(u){u.click();await sl(900);}o.onAfterUndo=W().items[gid].on;
      const worn=[...document.querySelectorAll('#invPanel [data-ggid]')].find(b=>{const it=W().items[b.dataset.ggid];return it&&it.on!=null});
      if(worn){const wg=worn.dataset.ggid;worn.click();await sl(700);const off=document.getElementById('scOff');o.offBtn=!!off;if(off){off.click();await sl(900);}o.onAfterOff=W().items[wg].on;
        const u2=document.getElementById('rrUndo');if(u2){u2.click();await sl(900);}o.onAfterUndoOff=W().items[wg].on;}
      return o}""")
    g.evaluate("document.getElementById('shopScene').scrollIntoView()"); g.wait_for_timeout(500); g.screenshot(path=f'{out}/rare-room-{vw}.png')
    r['rrScrollW']=g.evaluate("document.documentElement.scrollWidth")
    c.close()
    # view-only ?addr=
    c,g=ctx(b,vw,owner=False); g.goto(base+'/play.html?addr='+ME+'#rare-room',wait_until='domcontentloaded'); ready(g); scene(g)
    r['view']=g.evaluate("""async()=>{const sl=t=>new Promise(r=>setTimeout(r,t));const cards=document.querySelectorAll('#invPanel [data-ggid]');const n=cards.length;if(n){cards[0].click();await sl(700);}
      const w=document.getElementById('scWear'),off=document.getElementById('scOff');let before=JSON.stringify(Object.values(__demo.world().items).filter(x=>x.owner==='%s').map(x=>x.on));
      if(w&&!w.disabled){w.click();await sl(700);} if(off){off.click();await sl(700);} const best=document.getElementById('rrBest');if(best){best.click();await sl(700);}
      let after=JSON.stringify(Object.values(__demo.world().items).filter(x=>x.owner==='%s').map(x=>x.on));
      return {cards:n,unchanged:before===after}}"""%(ME,ME))
    g.screenshot(path=f'{out}/view-only-{vw}.png'); r['viewScrollW']=g.evaluate("document.documentElement.scrollWidth"); c.close()
    # reduced motion
    c,g=ctx(b,vw,rm=True); g.goto(base+'/play.html#rare-room',wait_until='domcontentloaded'); ready(g); scene(g)
    r['rm']=g.evaluate("(()=>{const cs=[...document.querySelectorAll('.rr-card canvas')];return {cards:cs.length,anim:cs.filter(c=>getComputedStyle(c).animationName!=='none').length}})()")
    g.screenshot(path=f'{out}/reduced-motion-{vw}.png'); c.close()
  b.close()
if srv: srv.terminate()
print(json.dumps(R,indent=1,ensure_ascii=False)); print('console errors:',len(errs)); [print(' ',e[:300]) for e in errs]
json.dump({'R':R,'errs':errs},open(f'{out}/results.json','w'),indent=1,ensure_ascii=False)
