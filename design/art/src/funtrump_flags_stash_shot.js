/* PREVIEW only: screenshot of the Kekistan flag grant in a stash. Serve a COPY of the site (git archive HEAD) with ACTIVATE_FT_FLAGS_BLOCK = 973236 on 127.0.0.1:8862, then NODE_PATH=/workspace/xcpets/node_modules node this. Never ships the gate. */
const p=require('puppeteer-core');(async()=>{const b=await p.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const g=await b.newPage();await g.setViewport({width:1280,height:900});
await g.evaluateOnNewDocument(()=>{let v;Object.defineProperty(window,'V2Rules',{configurable:true,get(){return v},set(x){v=x;try{x._setFtFlagsActivation(973236)}catch(e){}}});});
const RS=require('fs').readFileSync('/workspace/wt-funtrump-flags/js/v2-rules.js','utf8').replace('var ACTIVATE_FT_FLAGS_BLOCK = null','var ACTIVATE_FT_FLAGS_BLOCK = 973236');
await g.setRequestInterception(true);g.on('request',r=>{if(/\/js\/v2-rules\.js/.test(r.url()))r.respond({status:200,contentType:'application/javascript',body:RS});else r.continue();});
g.on('pageerror',e=>console.log('ERR',e.message));
await g.goto('http://127.0.0.1:8862/rare-room.html?addr=15e15ua6A3FJqjMevtrWcFSzKn9k6bMQeA',{waitUntil:'load',timeout:60000});
await new Promise(r=>setTimeout(r,60000));
const info=await g.evaluate(()=>{const d=document.querySelector('details.shop-all');if(!d)return 'nodetails';d.open=true;d.scrollIntoView();const inv=document.getElementById('inv');const t=inv.innerText;return t.slice(0,600)+' HASKEK '+/Kekistan/.test(t);});console.log(info);
await new Promise(r=>setTimeout(r,3000));
await g.evaluate(()=>{document.querySelectorAll('button').forEach(b=>{if(/^Got it$/.test(b.textContent.trim()))b.click();});});
const rect=await g.evaluate(()=>{const inv=document.getElementById('inv');const leaf=[...inv.querySelectorAll('*')].filter(e=>e.children.length===0&&/Kekistan flag/.test(e.textContent))[0];if(!leaf)return null;const box=leaf.closest('button,li,.card,[class*=item],[class*=gear]')||leaf;box.style.outline='3px solid #ffd23f';box.closest('section').hidden=false;box.closest('details').open=true;box.scrollIntoView({block:'center'});const r=box.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,txt:box.innerText};});
console.log(JSON.stringify(rect));await new Promise(r=>setTimeout(r,800));
await new Promise(r=>setTimeout(r,3000));const R2=await g.evaluate(()=>{const b=[...document.querySelectorAll('#inv .bagitem')].find(e=>/Kekistan flag/.test(e.textContent));b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return {y:r.y+scrollY,x:r.x};});await new Promise(r=>setTimeout(r,1500));
const R3=await g.evaluate(()=>{const b=[...document.querySelectorAll('#inv .bagitem')].find(e=>/Kekistan flag/.test(e.textContent));const r=b.getBoundingClientRect();return {y:r.y+scrollY};});console.log(JSON.stringify([R2,R3]));
await g.screenshot({path:'/workspace/xcpets/previews/funtrump-flags/grant-kekistan-flag-in-stash.png',clip:{x:0,y:Math.max(0,R3.y-260),width:1280,height:560},captureBeyondViewport:true});
await b.close();})();
