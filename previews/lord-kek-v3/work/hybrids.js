// Lord Kek hybrid samples, BOTH directions (throwaway browser; uses the branch's real V2Rules.hybridFrames / hybridName). Read-only.
const P=require('/workspace/sf-e2e/node_modules/puppeteer-core'),fs=require('fs'),path=require('path');
(async()=>{const b=await P.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const g=await b.newPage();const errs=[];g.on('pageerror',e=>errs.push(e.message));
await g.goto('http://127.0.0.1:8961/hybrids.html',{waitUntil:'domcontentloaded',timeout:120000});await g.waitForFunction(()=>window.V2Rules&&window.KekSprite&&window.PetCore,{timeout:120000});
const out=await g.evaluate(()=>{const V=V2Rules,rows=[];const SP=['pepe','doge','wojak','nakamoto','mumu'];
 SP.forEach((x,i)=>{[['kek',x],[x,'kek']].forEach(([a,c])=>{['head','side'].forEach(feat=>{const key='hyb:'+a+':'+c;
  const art=PetCore.generate({blockHash:'00000000000000000001'+i+a+c,petId:'kekhyb'+i+a+feat,blockHeight:972400});
  art.hybrid={key,a,b:c,roots:[a,c],name:V.hybridName(key),shape:a,color:c,feature:feat,eyes:PetCore.EYES[0].id};art.species=a;
  rows.push({name:art.hybrid.name+' · body '+a+' · colour '+c+' · feature '+feat,frames:[0,1,2,3,4,5].map(s=>[0,1].map(f=>Array.from(V.hybridRender(art,{stage:s,frame:f}).data)))});});});});
 const names={};SP.concat(['wizard']).forEach(x=>{names['hyb:kek:'+x]=V.hybridName('hyb:kek:'+x);names['hyb:'+x+':kek']=V.hybridName('hyb:'+x+':kek');});
 names['hyb3:kek:pepe:doge']=V.hybridName('hyb3:kek:pepe:doge');names['hyb3:pepe:kek:doge']=V.hybridName('hyb3:pepe:kek:doge');names['hyb3:pepe:doge:kek']=V.hybridName('hyb3:pepe:doge:kek');
 return {rows,names};});
fs.writeFileSync(path.join(__dirname,'hyb.json'),JSON.stringify({out:out.rows}));fs.writeFileSync(path.join(__dirname,'names.json'),JSON.stringify(out.names,null,1));console.log(JSON.stringify(out.names),errs);await b.close();})().catch(e=>{console.error(e);process.exit(1)});
