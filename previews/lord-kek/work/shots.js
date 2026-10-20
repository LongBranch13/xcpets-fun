// Lord Kek community panel MOCK previews (throwaway browser only; the branch does not load kek-sprite.js). Read-only, nothing signed or sent.
const P=require('/workspace/sf-e2e/node_modules/puppeteer-core'),path=require('path'),fs=require('fs'),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const OUT=path.resolve(__dirname,'..'),U='http://127.0.0.1:8961';const res=[];
(async()=>{const b=await P.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
for(const vw of [1280,390]){const g=await b.newPage();const r={vw,errors:[]};g.on('pageerror',e=>r.errors.push(e.message.slice(0,200)));g.on('console',m=>{if(m.type()==='error')r.errors.push(m.text().slice(0,200))});
 await g.setViewport(vw===390?{width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2}:{width:1280,height:900});
 await g.goto(U+'/play.html',{waitUntil:'networkidle2',timeout:120000});
 await g.waitForFunction(()=>window.V2Mock&&V2Mock.world&&(()=>{try{return V2Mock.world().pets.length>1000}catch(e){return false}})(),{timeout:240000});
 await sleep(2500);await g.addStyleTag({content:'#toasts{display:none!important}'});
 for(const s of [0,3,5]){r['s'+s]=await g.evaluate(s=>{const R=V2Render,c=document.querySelector('#communityPanel .commsprite')||document.querySelector('.commsprite');if(!c)return 'no canvas';
  const w=V2Mock.world(),cm=w.community;cm.current='kek';cm.kekStage=s;cm.nextPet='kek';R.animate(c,R.communityFrames(w));const ST=KekSprite.STAGES,T=[0,69000,834900,2214900,4146900,6906900],fed=s?T[s]:12345;
  document.getElementById('community').innerHTML='<b>Lord Kek</b> · Community pet #3 · '+ST[s]+' · '+fed.toLocaleString()+' <span class="asset">XCPETS</span> burned<div class="small muted" id="cWearing">Wearing: Headwear: Nemes of Kek ★ (signature)</div><div class="small muted">Ruler of All Pepes. Every burn feeds him. Nobody owns him. 100× slower than any pet.</div><details class="small muted" open><summary>Lord Kek · Community pet #3 · card</summary>'+R.KEK_CARD+'</details>';
  ['cfeedBtn','crollBtn'].forEach(id=>{const e=document.getElementById(id);if(e){e.disabled=false;e.title=''}});const f=document.getElementById('cfeedBtn');if(f)f.textContent='Feed community (0)';const q=document.getElementById('crollBtn');if(q)q.textContent='Community gear roll';
  let l=document.getElementById('__lab');if(!l){l=document.createElement('div');l.id='__lab';l.style.cssText='position:fixed;left:0;top:0;z-index:99999;background:#000c;color:#ffd23f;font:bold 12px monospace;padding:4px 8px';document.body.appendChild(l)}
  l.textContent='MOCK (branch lord-kek, not live) · Lord Kek as community pet #3 · '+ST[s]+' (sample numbers)';
  window.scrollTo(0,c.getBoundingClientRect().top+window.scrollY-200);return 'ok'},s);
  await sleep(700);const f=`community-panel-${vw}-${['egg','','','adult','','mythic'][s]}.png`;await g.screenshot({path:path.join(OUT,f)});}
 r.overflowX=await g.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);res.push(r);await g.close();}
fs.writeFileSync(path.join(OUT,'work','shots.json'),JSON.stringify(res,null,1));console.log(JSON.stringify(res));await b.close();})().catch(e=>{console.error(e);process.exit(1)});
