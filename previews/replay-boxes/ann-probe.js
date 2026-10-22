const puppeteer=require('puppeteer-core');const W=ms=>new Promise(r=>setTimeout(r,ms));
const port=process.argv[2]||8955, nF=+(process.argv[3]||3);
(async()=>{const br=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
const pg=await br.newPage();await pg.setViewport({width:1280,height:900});
await pg.evaluateOnNewDocument(()=>{localStorage.setItem('xcpets-announcer-voice','1');window.__log=[];window.__t0=performance.now();
 // fake TTS: queue, ~words/(2.6*rate) sec each (approx 155 wpm at rate 1)
 const q=[];let cur=null;const now=()=>Math.round(performance.now()-window.__t0);
 function next(){if(cur||!q.length)return;cur=q.shift();const u=cur,wd=u.text.split(/\s+/).length,ms=wd/(2.6*(u.rate||1))*1000;window.__log.push({ev:'start',t:now(),text:u.text});u._tm=setTimeout(()=>{window.__log.push({ev:'end',t:now(),text:u.text});cur=null;u.onend&&u.onend({});next();},ms);}
 const ss={speak(u){window.__log.push({ev:'speak',t:now(),text:u.text,rate:u.rate,voice:u.voice&&u.voice.name});q.push(u);next();},cancel(){window.__log.push({ev:'cancel',t:now()});q.length=0;if(cur){clearTimeout(cur._tm);cur=null;}},
  get speaking(){return !!cur},get pending(){return q.length>0},getVoices(){return[{name:'Google US English',lang:'en-US',localService:false},{name:'Microsoft Guy Online (Natural)',lang:'en-US',localService:false},{name:'espeak',lang:'en-US',localService:true}]},addEventListener(){},removeEventListener(){}};
 Object.defineProperty(window,'speechSynthesis',{value:ss,configurable:true});
 window.SpeechSynthesisUtterance=function(t){this.text=t;this.rate=1;this.pitch=1;};});
await pg.goto('http://localhost:'+port+'/play.html',{waitUntil:'networkidle2',timeout:120000});
for(let i=0;i<60;i++){const ok=await pg.evaluate(()=>!!(window.V2UI&&V2UI.world&&V2UI.world()&&V2UI.world().fights&&V2UI.world().fights.filter(f=>f.status==='done').length&&window.V2ArenaScene));if(ok)break;await W(2000);}
const fights=await pg.evaluate(n=>V2UI.world().fights.filter(f=>f.status==='done'&&f.turns&&f.turns.length).slice(-n).map(f=>f.id),nF);
const out=[];
for(const id of fights){await pg.evaluate(id=>{window.__log=[];window.__t0=performance.now();const f=V2UI.world().fights.find(x=>x.id===id);V2ArenaScene.sequence(f,{restart:true});return f.turns.length},id);
 const turns=await pg.evaluate(id=>V2UI.world().fights.find(x=>x.id===id).turns.length,id);
 await W(45000);
 const r=await pg.evaluate(()=>({log:window.__log,mode:null}));
 const sp=r.log.filter(x=>x.ev==='speak');const cnt={};sp.forEach(x=>cnt[x.text]=(cnt[x.text]||0)+1);
 const lastEnd=Math.max(0,...r.log.filter(x=>x.ev==='end').map(x=>x.t));
 out.push({fight:id,turns,speaks:sp.length,dupes:Object.entries(cnt).filter(e=>e[1]>1),lastSpeechEndMs:lastEnd,log:r.log});}
console.log(JSON.stringify(out,null,1));await br.close();})().catch(e=>{console.error(e);process.exit(1)});
