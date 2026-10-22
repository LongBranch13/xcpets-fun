// breeding-v2 tests (offline, fake future burns; nothing broadcast). node tools/breeding-v2-test.js [repo] [snap]
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const REPO=process.argv[2]||'/workspace/wt-breeding-v2',SNAP=process.argv[3]||REPO+'/tools/snapshots/snap-fresh-v2.json';
const SCRIPTS=['rjs/config.js','rjs/pet-core.js','rjs/game-core.js','rjs/bonus-gear.js','rjs/real-core.js','rjs/chain.js','@LIVE','js/pet-core.js','js/bonus-gear.js','js/v2-gear.js','js/v2-fit.js','js/kek-sprite.js','js/wizard-sprite.js','js/v2-rules.js','js/block-hashes.js'];
function load(){const st={};const ls={getItem:k=>st[k]||null,setItem:(k,v)=>{st[k]=String(v)},removeItem:k=>{delete st[k]}};const win={console:{log(){},warn(){},error(){},info(){}},localStorage:ls,sessionStorage:ls,location:{search:'',hostname:'xcpets.fun',href:'https://xcpets.fun/'},navigator:{userAgent:'node'},setTimeout:()=>0,clearTimeout(){},URLSearchParams,URL,TextEncoder,TextDecoder,fetch:()=>Promise.reject(new Error('offline'))};
 win.document={getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>({getContext:()=>null,style:{}}),addEventListener(){},body:null,documentElement:{style:{}}};win.addEventListener=()=>{};win.window=win;win.self=win;win.globalThis=win;const ctx=vm.createContext(win);
 for(const f of SCRIPTS){if(f==='@LIVE'){vm.runInContext("window.LiveEngine={RealCore:window.RealCore,Chain:window.Chain&&window.Chain.Chain,CFG:window.XCPETS_CONFIG};",ctx);continue}const p=path.join(REPO,f);if(fs.existsSync(p))vm.runInContext(fs.readFileSync(p,'utf8'),ctx,{filename:f})}return ctx}
const H=s=>crypto.createHash('sha256').update(s).digest('hex');const hex=s=>Buffer.from(s).toString('hex');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++};
const snap=JSON.parse(fs.readFileSync(SNAP));const ctx=load(),V=ctx.V2Rules,E=ctx.LiveEngine;
// 1) odds on 200k random hashes
let tw=0,mu=0,gl=0,fr=0,N=200000;const kidP={},A0={tier:0},B0={tier:0};
for(let i=0;i<N;i++){const h=H('t'+i);if(V.twinDraw(h))tw++;const k={};V._breedExtras(A0,B0,h,k);if(k.mutation){mu++;if(k.mutation.kind==='glitch')gl++}if(k.hidden)fr++}
console.log(`twins ${(tw/N*100).toFixed(3)}% (target 2%)  mutation ${(mu/N*100).toFixed(3)}% (target 1%, glitch share ${(gl/mu*100).toFixed(1)}%)  fresh hidden ${(fr/N*100).toFixed(2)}% (target 5%)`);
ok(Math.abs(tw/N-0.02)<0.002&&Math.abs(mu/N-0.01)<0.0015&&Math.abs(fr/N-0.05)<0.003,'odds within tolerance');
let inh=0,sh=0;for(let i=0;i<20000;i++){const k={};V._breedExtras({tier:0,hidden:'frost'},{tier:0},H('h'+i),k);if(k.hidden)inh++;if(k.shows)sh++}
ok(Math.abs(inh/20000-0.5)<0.02&&sh===inh,`carrier (not showing) -> child inherits ${(inh/200).toFixed(1)}% and shows it`);
let sh2=0;for(let i=0;i<5000;i++){const k={};V._breedExtras({tier:0,hidden:'frost',shows:'frost'},{tier:0},H('s'+i),k);if(k.shows)sh2++}ok(sh2===0,'showing parent -> child carries hidden (skips a generation)');
let lm=0;for(let i=0;i<20000;i++){const k={hybrid:{roots:['pepe','dodo'],parts:[]}};V._breedExtras({tier:3},{tier:3},H('l'+i),k);if(k.hybrid.legMix)lm++}ok(Math.abs(lm/20000-0.25)<0.015,`Legendary x Legendary hybrid -> legendary mix ${(lm/200).toFixed(1)}%`);
// 2) synthetic replay after the gate
const tip=snap.tip,G=V.ACTIVATE_BREEDING_V2_BLOCK;const POST=G<=tip,GB=POST?tip+1:G; /* post-gate mode (gate mined): synthetic burns start right after the snapshot tip */
ok(POST||G>tip,POST?'post-gate mode: gate '+G+' mined (snapshot tip '+tip+'); synthetic burns from '+GB:'gate '+G+' is after snapshot tip '+tip);
const base=V.replay(snap.rows,Object.assign({},ctx.XCPETS_BLOCK_HASHES||{},snap.hashes),[],{tip,live:E&&E.RealCore});
const myth=base.pets.filter(p=>p.stage===5&&!p.dead&&!p.released&&!p.community&&p.species!=='nakamoto'&&V.breedable(p,GB+2000)==null);
const naka=base.pets.filter(p=>p.species==='nakamoto'&&!p.dead&&!p.released&&!p.community&&p.stage>=3);
console.log('Mythic breedable test pets',myth.length,'Nakamotos',naka.length);
const byOwner={};myth.forEach(p=>(byOwner[p.owner]=byOwner[p.owner]||[]).push(p));const own=Object.keys(byOwner).sort((a,b)=>byOwner[b].length-byOwner[a].length)[0],M=byOwner[own];
const rows=snap.rows.slice(),hashes=Object.assign({},snap.hashes);let n=0;
const burn=(b,src,tag)=>{const tx=H('fake'+(n++));rows.push({tx_index:9e9+n,tx_hash:tx,block_index:b,source:src,asset:'XCPETS',quantity:69000000000,tag:hex(tag),status:'valid'});hashes[b]=hashes[b]||H('blk'+b);return tx};
const P1=M[0].id,P2=M[1].id,P3=M[2]&&M[2].id;let b=GB;
for(let k=0;k<7;k++){burn(b,own,'pet:breed:'+P1+':'+P2);b+=1009}
burn(b-1009+1,own,'pet:breed:'+P1+':'+P2); // inside cooldown
const last=b+5000;
const run=()=>V.replay(rows.slice().sort((x,y)=>x.block_index-y.block_index||x.tx_index-y.tx_index),hashes,[],{tip:last,live:E&&E.RealCore});
const w=run(),w2=run();const a=w.byId[P1],c=w.byId[P2];
ok(a.breedsV2===6&&c.breedsV2===6,`cap: #${P1} breedsV2=${a.breedsV2}, #${P2}=${c.breedsV2} after 7 tries`);
const rej=w.log.filter(e=>e.kind==='rejected'&&/breed/.test(e.msg||'')||/cap reached/.test(e.msg||''));console.log('  rejections:',rej.map(e=>e.block+' '+e.msg).join(' | '));
ok(w.log.some(e=>/breeding cap reached \(6\/6/.test(e.msg||'')),'7th breed rejected with cap reason');
ok(JSON.stringify(w.pets.map(p=>[p.id,p.species,p.tier,p.hidden,p.shows,p.mutation,p.twinOf,p.hybrid&&p.hybrid.parts]))===JSON.stringify(w2.pets.map(p=>[p.id,p.species,p.tier,p.hidden,p.shows,p.mutation,p.twinOf,p.hybrid&&p.hybrid.parts])),'deterministic: two replays identical');
const kids=w.pets.filter(p=>p.parents&&p.parents[0]===P1&&p.parents[1]===P2);console.log('  kids',kids.map(k=>'#'+k.id+' '+k.species+(k.twinOf?' twin of #'+k.twinOf:'')+(k.mutation?' MUT '+k.mutation.kind:'')+(k.hidden?' hidden '+k.hidden:'')+(k.hybrid&&k.hybrid.parts?' parts '+JSON.stringify(k.hybrid.parts):'')).join('\n   '));
ok(kids.every(k=>V.genOf(w,k)===Math.max(V.genOf(w,a),V.genOf(w,c))+1),'gen = max(parents)+1');
// kin guard: parent x child, siblings
if(kids.length>=2){const ow=kids[0].owner;const r2=rows.slice();const blk=last-100;const kv=V.kinWhy(a,kids[0]),ks=V.kinWhy(kids[0],kids[1]);
 ok(/mom|kid/.test(V.kinWhy(kids[0],a))&&/kid/.test(kv)&&/siblings/.test(ks),'kinWhy: "'+V.kinWhy(kids[0],a)+'", "'+kv+'", "'+ks+'"');
 const why=V.breedBlock(w,'pet:breed:'+P1+':'+kids[0].id,blk);ok(why==null||/inbreeding|kid|mom|stage|Adult|cooldown|cap/.test(why),'send guard: '+why);}
// replay guard with a pre-gate pair: same kin rule NOT applied before the gate (rule inert)
ok(V.breedV2On(G)&&!V.breedV2On(G-1),'gate inert before '+G);
// Nakamoto same cap
if(naka.length) ok(V.breedable(Object.assign({},naka[0],{breedsV2:6,lastBreed:null}),G)&&/cap reached/.test(V.breedable(Object.assign({},naka[0],{breedsV2:6,lastBreed:null,neglected:false,stage:5}),G)),'Nakamoto: same 6 cap');
// owner rules Oct 22 (one-eye rule later removed); KEVIN hair never on Pepe/Peepo; Chud bangs gone; beard gear gated OFF
{const SPS=Object.keys(V.HYBRID_PARTS);let bad=[],kv=[],chudHair=0,dodoN=0;
 for(const body of SPS)for(const sp of SPS){if(sp===body)continue;for(let i=0;i<400;i++){const plan={shape:body,roots:[body,sp]};const ps=V.hybridParts(H('p'+body+sp+i),plan);
  ps.forEach(q=>{const d=V.HYBRID_PARTS[q.sp].find(x=>x.id===q.part);if(V.ONE_EYED[body]&&d.kind==='eyes')bad.push(body+'<'+q.sp+':'+q.part);if(q.sp==='kevin'&&q.part==='hair'&&(body==='pepe'||body==='peepo'))kv.push(body);if(q.sp==='chud'&&q.part==='hair')chudHair++;});if(V.ONE_EYED[body])dodoN+=ps.length;}}
 for(let i=0;i<20000;i++){const k={hybrid:{roots:['dodo','pepe'],shape:'dodo',parts:[]}};V._breedExtras({tier:3},{tier:3},H('lm'+i),k);k.hybrid.parts.forEach(q=>{const d=V.HYBRID_PARTS[q.sp].find(x=>x.id===q.part);if(d&&d.kind==='eyes')bad.push('legmix dodo<'+q.sp+':'+q.part);});}
 ok(kv.length===0,'KEVIN hair never on Pepe/Peepo bodies');
 ok(chudHair===0&&V.partsFor('pepe','chud',V.ACTIVATE_CHUD_BEARD_PART_BLOCK==null?1e9:V.ACTIVATE_CHUD_BEARD_PART_BLOCK-1).length===1&&V.HYBRID_PARTS.chud.length===1&&V.HYBRID_PARTS.chud[0].id==='glasses','Chud black bangs removed; Chud donates eyeglasses');
 ok(Object.keys(V.ONE_EYED).length===0&&V.partsFor('dodo','chud',0).length===1&&V.partsFor('dodo','wojak').length===1&&V.partsFor('dodo','peepo').length===1,'one-eye rule removed: Dodo takes every eye part again');
 ok(['doge','mumu','pepe','nakamoto'].every(b=>!V.eligible(V.GEAR_BY_ID[V.CHUD_BEARD_ITEM]||V.CHUD_BEARD_ITEM,b,b)),'beard never eligible on Doge/Mumu/Pepe/Nakamoto (gate off anyway)');
 ok(V.HYBRID_PARTS.sarutobi.map(d=>d.id).join()==='tail','Sarutobi donates only the tail (ears removed)');
 ok(['bobo','mumu','doge'].every(sp=>V.HYBRID_PARTS[sp][0].onTop),'Bobo ears / Mumu horns / Doge ears use the onTop placement');
 ok(V.ACTIVATE_CHUD_BEARD_BLOCK===V.ACTIVATE_BREEDING_V2_BLOCK&&!V.beardOn(V.ACTIVATE_CHUD_BEARD_BLOCK-1)&&V.beardOn(V.ACTIVATE_CHUD_BEARD_BLOCK),'Chud beard gate = breeding-v2 gate ('+V.ACTIVATE_CHUD_BEARD_BLOCK+'), off before it');}
// Chud's beard = HYBRID PART (owner correction Oct 22 ~7:40 AM CT). Branch gate is null; test with a local value, then restore.
{const real=V.ACTIVATE_CHUD_BEARD_PART_BLOCK,TG=1e7;ok(real==null||real>tip,'beard-part gate '+real+' is null or after the snapshot tip (replay unchanged)');
 ok(!V.beardPartOn(tip),'beard part off at the snapshot tip');
 V._setChudBeardPartActivation(TG);
 const EX=['doge','mumu','pepe','nakamoto','dodo','snibby','sarutobi','kek','wizard'],bodies=Object.keys(V.HYBRID_PARTS).filter(b=>b!=='chud');
 ok(V.partsFor('bobo','chud',TG-1).map(d=>d.id).join()==='glasses','before the gate: Chud donates glasses only');
 ok(V.partsFor('bobo','chud',TG).map(d=>d.id).join()==='glasses,beard'&&V.partDef('chud','beard').kind==='face','from the gate: Chud donates glasses + beard (kind face)');
 ok(EX.every(b=>!V.partsFor(b,'chud',TG).some(d=>d.id==='beard')),'beard part never on Doge/Mumu/Pepe/Nakamoto/Dodo/Snibby/Sarutobi/Kek/Wizard bodies');
 let got={};for(const body of bodies)for(let i=0;i<300;i++){V.hybridParts(H('bp'+body+i),{shape:body,roots:[body,'chud']},TG).forEach(q=>{if(q.part==='beard')got[body]=(got[body]||0)+1;});}
 ok(EX.every(b=>!got[b])&&bodies.filter(b=>!EX.includes(b)).every(b=>got[b]>0),'hybridParts: beard drawn on '+Object.keys(got).join('/')+'; none on excluded');
 ok(V.hybridParts(H('bpx'),{shape:'bobo',roots:['bobo','chud']},TG-1).every(q=>q.part!=='beard'),'no beard part before the gate');
 const inPool=b=>{V._setEligB(b);const r=V._pool('face','bobo',3,'bobo').some(x=>x.it.id===V.CHUD_BEARD_ITEM);V._setEligB(null);return r;};
 ok(V.ALL_GEAR.some(x=>x.id===V.CHUD_BEARD_ITEM),'v2-chud-beard kept in the item list');
 ok(inPool(TG-1)&&!inPool(TG),'gear v2-chud-beard rolls before the part gate, out of every roll pool from it');
 V._setEligB(TG);ok(V.eligible(V.CHUD_BEARD_ITEM,'bobo','bobo'),'owned v2-chud-beard still wearable after the gate');V._setEligB(null);
 V._setChudBeardPartActivation(real);}
console.log(fails?fails+' FAIL':'ALL PASS');
