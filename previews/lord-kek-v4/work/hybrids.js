// Lord Kek v4 hybrid samples (throwaway browser; real V2Rules.hybridRender / V2Render.framesWith from the branch). Read-only.
const P=require('/workspace/sf-e2e/node_modules/puppeteer-core'),fs=require('fs'),path=require('path');
(async()=>{const b=await P.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const g=await b.newPage();const errs=[];g.on('pageerror',e=>errs.push(e.message));
await g.goto('http://127.0.0.1:8961/hybrids.html',{waitUntil:'domcontentloaded',timeout:120000});await g.waitForFunction(()=>window.V2Rules&&window.KekSprite&&window.PetCore&&window.V2Render,{timeout:120000});
const out=await g.evaluate(()=>{const V=V2Rules,R=V2Render,SP=['pepe','wojak','chud','bobo','mumu','snibby','dodo','kevin','peepo','sarutobi','doge','lenny','nakamoto'];
 const mk=(a,c,feat,i)=>{const key='hyb:'+a+':'+c,art=PetCore.generate({blockHash:'000000000000000000ab'+i+a+c+feat,petId:'kh'+i+a+c+feat,blockHeight:972400});
  art.hybrid={key,a,b:c,roots:[a,c],name:V.hybridName(key),shape:a,color:c,feature:feat,eyes:PetCore.EYES[0].id};art.species=a;return art;};
 const fr=(art,ids)=>[0,1,2,3,4,5].map(s=>[0,1].map(f=>Array.from((ids?R.framesWith(art,s,ids):[0,1,2,3].map(q=>V.hybridRender(art,{stage:s,frame:q})))[f].data)));
 const fix=[],card=[];
 SP.forEach((x,i)=>['head','side'].forEach(ft=>{const a=mk(x,'kek',ft,i);fix.push({name:a.hybrid.name+' · body '+x+' · colour+feature kek ('+ft+')',frames:fr(a)});}));
 [['kek','pepe'],['pepe','kek'],['wojak','kek'],['kek','doge'],['doge','kek']].forEach(([a,c],i)=>{const art=mk(a,c,'side',i);card.push({name:art.hybrid.name+' · body '+a+' · HOLDING LORDKEK card',frames:fr(art,['kek-card'])});});
 const pk=PetCore.generate({blockHash:'000000000000000000cc',petId:'pk',blockHeight:972400});pk.species='kek';card.push({name:'player Lord Kek · HOLDING LORDKEK card',frames:fr(pk,['kek-card'])});
 const elig={};['kek','hyb:kek:pepe','hyb:pepe:kek','hyb3:pepe:doge:kek','pepe','hyb:pepe:doge','wizard'].forEach(sp=>elig[sp]=V.eligible?V.eligible('kek-card',sp):'n/a');
 return {fix,card,elig};});
fs.writeFileSync(path.join(__dirname,'fix.json'),JSON.stringify({out:out.fix}));fs.writeFileSync(path.join(__dirname,'card.json'),JSON.stringify({out:out.card}));console.log(JSON.stringify(out.elig),errs);await b.close();})().catch(e=>{console.error(e);process.exit(1)});
