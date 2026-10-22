const puppeteer=require('puppeteer-core');const W=ms=>new Promise(r=>setTimeout(r,ms));const OUT='/workspace/wt-announcer/previews/replay-boxes/';
(async()=>{const br=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const pg=await br.newPage();await pg.setViewport({width:1280,height:1000,deviceScaleFactor:2});
await pg.evaluateOnNewDocument(()=>{try{localStorage.setItem('xcpets-v2-kek-arrival-seen','1')}catch(e){}});await pg.goto('http://localhost:8956/play.html',{waitUntil:'networkidle2',timeout:120000});
for(let i=0;i<60;i++){if(await pg.evaluate(()=>!!(document.querySelector('#arHist')&&document.querySelector('#arHist').children.length&&window.V2Render)))break;await W(2000);}
await W(3000);for(let k=0;k<5;k++){await pg.evaluate(()=>{[...document.querySelectorAll('button')].filter(b=>/^(Skip|Close|✕|×)$/i.test(b.textContent.trim())&&b.offsetParent).forEach(b=>b.click());});await pg.keyboard.press('Escape');await W(800);}await pg.evaluate(()=>{[...document.querySelectorAll('body *')].forEach(e=>{const cs=getComputedStyle(e);if(cs.position==='fixed'&&+cs.zIndex>50&&e.offsetWidth>300)e.style.display='none';});});
const info=await pg.evaluate(()=>{const h=document.querySelector('#arHist');h.scrollIntoView({block:'start'});const b=[...h.querySelectorAll('*')].find(e=>e.querySelector&&e.querySelector('.ar-rp-tag')&&e.querySelector('b'));
 const f=V2Render.petFrames(V2UI.world().pets[0],V2UI.world(),{noHunger:true});return {cls:b&&b.className,tag:b&&b.tagName,ftype:Object.prototype.toString.call(f&&f[0]),n:f&&f.length,keys:f&&f[0]&&Object.keys(f[0]).slice(0,5)}});
console.log(JSON.stringify(info));
const el=await pg.$('#arHist');await el.screenshot({path:OUT+'0-current.png'});
for(const v of [1,2,3]){await pg.evaluate(v=>{const w=V2UI.world(),R=V2Render;
 const cv=(p,flip,lose)=>{const fr=R.petFrames(Object.assign({},p,{blackEye:!!lose}),w,{noHunger:true})||[];const s=fr[0];const c=document.createElement('canvas');c.width=48;c.height=48;c.style.cssText='width:48px;height:48px;image-rendering:pixelated';const x=c.getContext('2d');x.imageSmoothingEnabled=false;
   if(!s)return c;let src=s;if(!(s instanceof HTMLCanvasElement)){const t=document.createElement('canvas');t.width=s.width;t.height=s.height;t.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(s.data),s.width,s.height),0,0);src=t;}
   if(flip){x.translate(48,0);x.scale(-1,1);}x.drawImage(src,0,0,48,48);return c;};
 const cards=[...document.querySelectorAll('#arHist .ar-rp-tag')].map(t=>t.parentElement);
 cards.forEach((c,i)=>{const m=/Replay #(\d+)/.exec(c.textContent);if(!m)return;const f=w.fights[m[1]-1];if(!f)return;const A=w.byId[f.a],B=w.byId[f.b],Wn=w.byId[f.winner];
  c.querySelectorAll('.rpx').forEach(e=>e.remove());const box=document.createElement('div');box.className='rpx';box.style.cssText='display:flex;align-items:center;justify-content:center;gap:4px;margin:4px 0;padding:4px;background:#1a1220;border:2px solid #000;box-shadow:2px 2px 0 #000;font-family:"Press Start 2P",monospace;font-size:9px;color:#ffd166;position:relative';
  const n=f.turns.length,big=Math.max(...f.turns.map(t=>t.crit?99:(t.dmg||0))),upset=(A&&B)&&((f.winner===f.a?1:-1)*(((A.power||0)-(B.power||0)))<0);
  const badge=(t,bg)=>{const s=document.createElement('span');s.textContent=t;s.style.cssText='padding:2px 4px;border:2px solid #000;background:'+bg+';color:#140f24;font-size:7px;font-family:"Press Start 2P",monospace';return s;};
  if(v===1){box.append(cv(A,false,f.loser===f.a));const vs=document.createElement('span');vs.textContent='VS';vs.style.cssText='color:#ff5d5d;text-shadow:2px 2px 0 #000;font-size:11px';box.append(vs,cv(B,true,f.loser===f.b));}
  if(v===2){box.style.background='linear-gradient(#2a1530 60%,#c9a46a 60%)';const wc=cv(Wn,false);wc.style.width=wc.style.height='56px';box.append(wc);const t=document.createElement('span');t.innerHTML='WINNER<br>#'+f.winner+'<br><small style="color:#fff">'+n+' RDS</small>';box.append(t);const ko=document.createElement('span');ko.textContent='K.O.!';ko.style.cssText='position:absolute;left:4px;bottom:2px;color:#c8102e;text-shadow:1px 1px 0 #ffd166,2px 2px 0 #000;transform:rotate(-8deg);font-size:10px';box.append(ko);}
  if(v===3){box.style.justifyContent='flex-start';box.style.flexWrap='wrap';box.append(cv(A,false,f.loser===f.a));box.lastChild.style.width=box.lastChild.style.height='32px';box.append(cv(B,true,f.loser===f.b));box.lastChild.style.width=box.lastChild.style.height='32px';
   box.append(badge(n<=5?'⚡ QUICK KO':n>=12?'⏱ LONG BOUT':'🥊 '+n+' RDS','#ffd166'));if(f.turns.some(t=>t.crit))box.append(badge('💥 CRIT','#ff9f6b'));if(upset)box.append(badge('😱 UPSET','#9fe8ff'));if(i%3===0)box.append(badge('🏆 BELT','#3ddc84'));}
  c.insertBefore(box,c.firstChild);});},v);
 await W(500);await el.screenshot({path:OUT+v+'-'+['','faceoff-vs','winner-pose-ko','badges-mini'][v]+'.png'});}
await br.close();})().catch(e=>{console.error(e);process.exit(1)});
