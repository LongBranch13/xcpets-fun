/* Site-wide preload-hint contract (rareroom-speed-1107): preload is fetching only; boot barrier, order, freshness unchanged. */
'use strict';
const fs=require('fs'),cp=require('child_process'),assert=require('assert'),{list}=require('./preload-hints.js');
const BASE=process.env.PH_BASE||'438e2dcc';
const strip=s=>s.replace(/<!--preload-hints-->[\s\S]*?<!--\/preload-hints-->/g,'').replace(/<link rel="(?:preload|prefetch)" as="script"[^>]*>/g,'');
const raw=s=>JSON.parse(s.match(/V2Mock\.boot\(function\(\)\{var L=(\[[^\]]*\]);/)[1]);
let n=0;
for(const f of ['templates/game.html',...fs.readdirSync('.').filter(f=>f.endsWith('.html'))]){
  const h=fs.readFileSync(f,'utf8');if(!/V2Mock\.boot\(function\(\)\{var L=/.test(h))continue;
  let b;try{b=cp.execFileSync('git',['show',BASE+':'+f],{encoding:'utf8'});}catch(e){continue;}
  assert.deepStrictEqual(raw(h),raw(b),f+': same modules and order');
  assert.strictEqual(strip(h),strip(b),f+': no change outside resource hints');
  assert(h.includes('t.async=false;document.body.appendChild(t);'),f);
  if(/^practice/.test(f)){assert(!h.includes('preload-hints'),f+': practice stays hint-free');continue;}
  const hints=[...h.matchAll(/<link rel="preload" as="script" fetchpriority="low" href="([^"]+)">/g)].map(x=>x[1]);
  assert.deepStrictEqual(hints,list(h),f+': every deferred module fetched early, once');
  assert(h.indexOf('<!--preload-hints-->')<h.indexOf('</head>'),f);
  assert(!/href="[^"]+",/.test(h),f+': malformed hint');
  for(const u of hints)assert(fs.existsSync(u.split('?')[0]),u);
  n++;}
for(const f of ['js/v2-rules.js','js/pet-core.js','rjs/pet-core.js','js/bonus-gear.js'])
  assert(fs.readFileSync(f).equals(cp.execFileSync('git',['show',BASE+':'+f])),'unchanged '+f);
console.log('PASS: '+n+' pages hinted; boot barrier, order, non-hint HTML and rule files unchanged');
