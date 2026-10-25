const { chromium } = require('playwright-core');
const ADDR='bc1ps9av86ymmlzy9zj3a8pn6g94pz4j5e0kagv3td3wutaagfjvekjs26m3s4', TXF=require('./lib/txfake.js'); /* real-structured destroy: the wallet decodes the raw tx before signing */
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args:['--no-sandbox'] });
  const pg = await b.newPage(); const res=[]; const ok=(n,c,x)=>{res.push((c?'PASS ':'FAIL ')+n+(x?' — '+x:''));};
  pg.on('pageerror', e=>res.push('PAGEERROR '+e.message));
  await pg.route(/^https?:\/\/(?!localhost)/, async r => { const u=r.request().url();
    if (/fees\/recommended/.test(u)) return r.fulfill({json:{hourFee:2}});
    if (/compose\/destroy/.test(u)) { const q=new URL(u).searchParams; const res0=TXF.result('destroy',ADDR,{asset:'XCPETS',quantity:q.get('quantity'),tag:q.get('tag')},{type:110,bodyHex:TXF.destroyBody('XCPETS',q.get('quantity'),q.get('tag'))}); return r.fulfill({json:{result:res0}}); }
    return r.fulfill({status:404,body:''}); });
  await pg.addInitScript(ADDR => { const W = window.__W = { calls: [], pend: [] };
    window.xcpwallet = { on(){}, request(a){ W.calls.push(a.method + (a.params && a.method==='xcp_signTransaction' ? '' : ''));
      if (a.method==='xcp_requestAccounts') return new Promise(r=>W.pend.push({m:a.method,res:()=>r({accounts:[ADDR]})}));
      if (a.method==='xcp_getNetwork') return Promise.resolve('mainnet');
      if (a.method==='xcp_signTransaction') return new Promise((r,j)=>W.pend.push({m:a.method,res:()=>r({hex:'02aa'}),rej:(c,msg)=>{const e=new Error(msg);e.code=c;j(e);}}));
      if (a.method==='xcp_broadcastTransaction') { W.n=(W.n||0)+1; return Promise.resolve({txid:String(W.n).padStart(64,'a')}); }
      return Promise.resolve(null); } }; }, ADDR);
  await pg.goto('http://localhost:8099/zz-harness.html');
  const ev = (f,...a)=>pg.evaluate(f,...a);
  const settle = (key, fn) => ev(([key, fn]) => { window[key]={state:'pending'}; eval(fn).then(v=>window[key]={state:'ok',v}, e=>window[key]={state:'err',msg:e.message,busy:!!e.walletBusy,code:e.code}); }, [key, fn]);
  const st = k => ev(k=>window[k], k); const W = ()=>ev(()=>({calls:__W.calls, pend:__W.pend.map(p=>p.m)}));
  const answer = (i, how, c, m) => ev(([i,how,c,m])=>{const p=__W.pend.splice(i,1)[0]; how==='res'?p.res():p.rej(c,m);}, [i,how,c,m]);
  const wait = ms=>pg.waitForTimeout(ms);
  // 1 shared connect
  await settle('c1','V2Wallet.connect()'); await settle('c2','V2Wallet.connect()'); await settle('c3','V2Wallet.getWallet()'); await wait(300);
  let w=await W(); ok('one connect shared by 3 callers', w.calls.filter(x=>x==='xcp_requestAccounts').length===1, JSON.stringify(w.calls));
  await answer(0,'res'); await wait(300);
  ok('all 3 callers resolved', ['c1','c2'].every(async()=>1) && (await st('c1')).state==='ok' && (await st('c2')).state==='ok' && (await st('c3')).state==='ok');
  await settle('c4','V2Wallet.connect()'); await wait(200); w=await W(); ok('connected: later connect opens no window', w.calls.filter(x=>x==='xcp_requestAccounts').length===1);
  // 2 second burn blocked while pending, then approve clears
  const plan = t => `V2Wallet.send({tag:'${t}',amount:69,label:'${t}'})`;
  await settle('s1', plan('pet:hatch')); await wait(400); await settle('s2', plan('pet:feed:1')); await wait(300);
  w=await W(); let s2=await st('s2');
  ok('second burn blocked while one pending', s2.state==='err'&&s2.busy && w.calls.filter(x=>x==='xcp_signTransaction').length===1, s2.msg);
  await answer(0,'res'); await wait(300); ok('first burn approved', (await st('s1')).state==='ok');
  await settle('s3', plan('pet:feed:2')); await wait(400); w=await W(); ok('lock cleared after approve', w.pend.length===1 && w.pend[0]==='xcp_signTransaction');
  // 3 reject clears
  await answer(0,'rej',4001,'User rejected'); await wait(300); s2=await st('s3'); ok('reject surfaces', s2.state==='err' && s2.code===4001 && !s2.busy, s2.msg);
  await settle('s4', plan('pet:feed:3')); await wait(400); w=await W(); ok('lock cleared after reject', w.pend.length===1);
  // 4 timeout: pending s4 never answered; advance clock 10m+1s
  await settle('s5', plan('pet:feed:4')); await wait(200); ok('still blocked before 10 min', (await st('s5')).busy===true);
  await ev(()=>{const r=Date.now, off=10*60e3+1000; Date.now=()=>r()+off;});
  await settle('s6', plan('pet:feed:5')); await wait(400); w=await W(); ok('lock cleared after 10 min pending', w.pend.length===2 && (await st('s6')).state==='pending');
  // stale s4 settling late must not unlock s6's lock
  await answer(0,'res'); await wait(300); await settle('s7', plan('pet:feed:6')); await wait(200); ok('late answer of stale burn does not release newer lock', (await st('s7')).busy===true);
  // 5 -32005 -> message, no retry
  const before=(await W()).calls.filter(x=>x==='xcp_signTransaction').length;
  await answer(0,'rej',-32005,'Too many signing requests are waiting for approval.'); await wait(4800);
  s2=await st('s6'); const after=(await W()).calls.filter(x=>x==='xcp_signTransaction').length;
  const html = await ev(()=>{try{ const e=new Error('x'); return null;}catch(e){}});
  ok('-32005 shows finish/close message', s2.state==='err' && s2.busy && /behind this window/.test(s2.msg), s2.msg);
  ok('-32005 not retried', after===before, before+'→'+after);
  // 6 multi-burn plan in order (same as v2.js step loop: next burn only after previous resolves)
  const tags=['pet:hatch','pet:feed:7','pet:roll:7'];
  await ev(()=>{__W.auto=true; const orig=xcpwallet.request; xcpwallet.request=function(a){ if(a.method==='xcp_signTransaction'){__W.signed=(__W.signed||[]); __W.calls.push(a.method); return new Promise(r=>setTimeout(()=>r({hex:'02aa'}),100));} return orig(a);}; });
  await ev(tags=>{ const sentTags=window.__sent=[]; let i=0; return new Promise((res,rej)=>{ (function step(){ if(i>=tags.length) return res(); const t=tags[i++]; V2Wallet.send({tag:t,amount:69,label:t}).then(r=>{sentTags.push(t); step();}, rej); })(); }); }, tags);
  const sent=await ev(()=>window.__sent); ok('multi-burn plan runs in order', JSON.stringify(sent)===JSON.stringify(tags), JSON.stringify(sent));
  console.log(res.join('\n')); await b.close();
})();
