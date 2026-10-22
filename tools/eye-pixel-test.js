// eye-pixel test (owner Oct 22 1:27 AM CT): for every head part (Bobo ears, Mumu horns, Doge ears, Kek nemes, Wizard hat) on every body and stage,
// every eye pixel of the body (pixels that change with the eye style alone) must look the same with and without the part. node tools/eye-pixel-test.js [repo]
const fs=require('fs'),path=require('path'),vm=require('vm'),{execSync}=require('child_process');
const ROOT=process.argv[2]||require('path').resolve(__dirname,'..');
const SCRIPTS=['rjs/config.js','rjs/pet-core.js','rjs/game-core.js','rjs/bonus-gear.js','rjs/real-core.js','rjs/chain.js','@LIVE','js/pet-core.js','js/bonus-gear.js','js/v2-gear.js','js/v2-fit.js','js/kek-sprite.js','js/wizard-sprite.js','js/v2-rules.js','js/block-hashes.js'];
function load(){const store={};const ls={getItem:k=>store[k]||null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]}};
const win={console:{log(){},warn(){},error(){},info(){}},localStorage:ls,sessionStorage:ls,location:{search:'',hostname:'xcpets.fun',href:'https://xcpets.fun/'},navigator:{userAgent:'node'},setTimeout:()=>0,clearTimeout(){},URLSearchParams,URL,TextEncoder,TextDecoder,fetch:()=>Promise.reject(new Error('offline'))};
win.document={getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>({getContext:()=>null,style:{}}),addEventListener(){},body:null,documentElement:{style:{}}};
win.addEventListener=()=>{};win.window=win;win.self=win;win.globalThis=win;const ctx=vm.createContext(win);
for(const f of SCRIPTS){if(f==='@LIVE'){vm.runInContext("window.LiveEngine={RealCore:window.RealCore,Chain:window.Chain&&window.Chain.Chain,CFG:window.XCPETS_CONFIG};",ctx);continue}const p=path.join(ROOT,f);if(!fs.existsSync(p))continue;vm.runInContext(fs.readFileSync(p,'utf8'),ctx,{filename:f})}return ctx}
const ctx=load();const P=ctx.PetCore,V=ctx.V2Rules;
function bare(id,o){const a=P.characterPet(id,{tier:'legendary'});a.background='solid';a.bgColor='#ff00ff';a.pattern='none';a.cheeks=false;a.eyes='classic';['band','armor','cape','weapon','crown'].forEach(k=>a[k]='none');return Object.assign(a,o||{})}
const R0=P.render;P.render=function(a,o){return R0(a,Object.assign({gearCap:0},o))};
const bodies=['pepe','peepo','wojak','chud','bobo','mumu','snibby','dodo','kevin','sarutobi','doge','lenny','nakamoto','wizard','kek'];
const donors=[['bobo','ears'],['mumu','horns'],['doge','ears'],['kek','nemes'],['wizard','hat']];
const R=(sh,col,parts,st,EY)=>{const plan=Object.assign(V.hybridPlan('00','hyb:'+sh+':'+col),{shape:sh,color:col,feature:'head',eyes:EY,roots:[sh,col]});delete plan.featSp;const a=bare(sh);a.hybrid=Object.assign({},plan,{parts});return V.hybridRender(a,{stage:st,frame:0}).data};
const mask=(sh,col,st)=>{const L=['classic','beady','tinted','star','laser'].map(e=>R(sh,col,[],st,e));const m=[];for(let j=0;j<1024;j++)if(L.some(D=>D[j*4]!==L[0][j*4]||D[j*4+1]!==L[0][j*4+1]||D[j*4+2]!==L[0][j*4+2]))m.push(j);return m};
let bad=[],checked=0;for(const [sp,part] of donors)for(const sh of bodies){if(sh===sp)continue;for(const col of [sp])for(const st of [1,2,3,4,5]){
 const m=mask(sh,col,st);for(const EY of ['classic','tinted']){const a=R(sh,col,[],st,EY),b=R(sh,col,[{sp,part}],st,EY);checked++;
 const lost=m.filter(j=>a[j*4]!==b[j*4]||a[j*4+1]!==b[j*4+1]||a[j*4+2]!==b[j*4+2]).length;if(lost)bad.push(`${sp} ${part} on ${sh} eyes=${EY} st${st}: ${lost}/${m.length}`);}}}
const real=bad.filter(x=>!/ on dodo /.test(x));console.log('eye-pixel test: checked',checked,'cases; lost-eye cases (non-Dodo)',real.length,'; Dodo exempt (owner revert, pre-Oct-22 look):',bad.length-real.length);real.forEach(x=>console.log('FAIL '+x));console.log(real.length?'FAIL':'ALL PASS');process.exit(real.length?1:0);
