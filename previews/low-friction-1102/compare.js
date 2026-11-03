// node compare.js <W>  -> compares pass2/main-W.json with pass2/branch-W.json
const fs=require('fs'),W=process.argv[2];
const A=JSON.parse(fs.readFileSync(`pass2/main-${W}.json`)),B=JSON.parse(fs.readFileSync(`pass2/branch-${W}.json`));
const out=[];let tot={pages:0,ctlMain:0,ctlMissing:0,pk:0,pkSteps:0,pkStepDiff:0,btn:0,btnDiff:0,errNew:0};
for(const P of Object.keys(A)){ const a=A[P],b=B[P]; tot.pages++; if(!b){out.push(`## ${P}: MISSING ON BRANCH RUN`);continue;}
  const L=[`## ${P}`];
  const ca=Object.keys(a.controls),cb=new Set(Object.keys(b.controls)); tot.ctlMain+=ca.length;
  const miss=ca.filter(k=>!cb.has(k)), add=[...cb].filter(k=>!(k in a.controls));
  const cnt=ca.filter(k=>cb.has(k)&&a.controls[k]!==b.controls[k]).map(k=>`${k} main=${a.controls[k]} branch=${b.controls[k]}`);
  tot.ctlMissing+=miss.length;
  L.push(`controls: main ${ca.length}, branch ${cb.size}, missing ${miss.length}, added ${add.length}, count-changed ${cnt.length}`);
  miss.forEach(k=>L.push('  MISSING '+k)); add.forEach(k=>L.push('  added '+k)); cnt.forEach(k=>L.push('  count '+k));
  const pb=Object.fromEntries(b.pickers.map(p=>[p.k,p]));
  for(const p of a.pickers){ tot.pk++; const q=pb[p.k]; if(!q){L.push(`  PICKER MISSING ${p.k}`);continue;}
    const d=[]; if(p.n!==q.n)d.push(`n ${p.n}/${q.n}`); if(p.start!==q.start)d.push(`start ${p.start}/${q.start}`);
    p.steps.forEach((s,i)=>{tot.pkSteps++; const t=q.steps[i]||{}; const diffs=[];
      if(/ERR/.test(t.how||'')&&!/ERR/.test(s.how||''))diffs.push('branch '+t.how);
      if(s.val!==t.val)diffs.push(`val ${s.val}/${t.val}`);
      if((s.ev>0)!==(t.ev>0))diffs.push(`change ${s.ev}/${t.ev}`);
      if(s.fp&&t.fp)for(const f of ['pids','npids','txt','url','ls'])if(s.fp[f]!==t.fp[f])diffs.push(`${f} ${s.fp[f]}/${t.fp[f]}`);
      if(JSON.stringify(s.dlg||[])!==JSON.stringify(t.dlg||[]))diffs.push('dlg '+JSON.stringify(s.dlg)+' / '+JSON.stringify(t.dlg));
      if(diffs.length){tot.pkStepDiff++;d.push(`[${s.v}] ${s.how}->${t.how}: ${diffs.join('; ')}`);} });
    L.push(`  picker ${p.k} n=${p.n} steps=${p.steps.length} via ${[...new Set(q.steps.map(s=>s.how))].join(',')}: ${d.length?'DIFF':'same'}`); d.forEach(x=>L.push('     '+x)); }
  const bb=Object.fromEntries(b.buttons.map(x=>[x.k,x]));
  for(const x of a.buttons){ tot.btn++; const y=bb[x.k]; const sa=JSON.stringify(x.out), sb=y?JSON.stringify(y.out):'(not walked on branch)';
    if(sa!==sb){tot.btnDiff++;L.push(`  BUTTON ${x.k}: main ${sa} | branch ${sb}`);} }
  const ne=(b.errors||[]).filter(e=>!(a.errors||[]).includes(e)); tot.errNew+=ne.length; ne.forEach(e=>L.push('  NEW PAGE ERROR '+e));
  out.push(L.join('\n')); }
out.unshift(`# Pass 2 compare @${W}px: `+JSON.stringify(tot));
fs.writeFileSync(`pass2/compare-${W}.txt`,out.join('\n\n')+'\n'); console.log(out[0]);
