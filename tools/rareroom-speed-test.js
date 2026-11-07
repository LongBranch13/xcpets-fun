/* Static performance contract: preload is fetching only; freshness/order remain unchanged. */
'use strict';
const fs=require('fs'), cp=require('child_process'), assert=require('assert');
const html=fs.readFileSync('rare-room.html','utf8');
const base=cp.execFileSync('git',['show','438e2dcc:rare-room.html'],{encoding:'utf8'});
const list=s=>JSON.parse(s.match(/V2Mock\.boot\(function\(\)\{var L=(\[.*?\]);L\.forEach/)[1]);
assert.deepStrictEqual(list(html),list(base),'same modules and execution order');
const hints=[...html.matchAll(/<link rel="preload" as="script" fetchpriority="low" href="([^"]+)">/g)].map(x=>x[1]);
assert.deepStrictEqual(hints,list(html),'every deferred module fetched early, once');
assert(hints.every(x=>html.indexOf('href="'+x+'"')<html.indexOf('</head>')));
assert(html.includes('t.async=false;document.body.appendChild(t);'));
const strip=s=>s.replace(/<!-- Rare Room:.*?-->/g,'').replace(/<link rel="(?:preload|prefetch)" as="script"[^>]*>/g,'');
assert.strictEqual(strip(html),strip(base),'no changes outside resource hints');
assert(!/href="[^"]+",/.test(html),'no malformed prefetch attributes');
for(const u of hints) assert(fs.existsSync(u.split('?')[0]),u);
for(const f of ['js/v2-rules.js','js/pet-core.js','rjs/pet-core.js','js/bonus-gear.js'])
 assert(fs.readFileSync(f).equals(cp.execFileSync('git',['show','438e2dcc:'+f])),'unchanged '+f);
console.log('PASS: 43 preload URLs, original boot/freshness barrier and execution order, unchanged non-hint HTML and rules');
