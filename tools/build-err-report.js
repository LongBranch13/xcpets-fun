#!/usr/bin/env node
/* err-report-1102 (safeguards-1102, owner 'Yes' Nov 2 2026 [pt2671u]): after a nav-cache deploy blocked every burn for ~16 h with a page
 * error nobody saw, every page carries a tiny inline page-error reporter, first thing in <head> after the nav-cache prerender guard.
 * It sends ONLY {k: error|rejection, m: message, f: script path, l: line, c: col, b: build id, p: page path} to the collector on
 * xcpets-bot-1 (https://2-31-126-156.sslip.io/e). Never a wallet address (bc1/1/3 addresses, long hex and emails are cut from the
 * message), never a query string (?addr= stays home), no cookies, no storage. Deduped (same report once per page load), at most 5 per
 * page load, nothing while a page is only prerendered (sent when opened), cross-origin "Script error." skipped. Read the log on the box:
 * node /workspace/xcpets/tools/page-errors.js. Display/monitoring only: no game rule, read or wallet path changes.
 *   node tools/build-err-report.js          write the snippet into every root page + templates/game.html (practice pages: build-practice-page.js)
 *   node tools/build-err-report.js --check  exit 1 if a page lacks the current snippet */
'use strict';
const fs = require('fs'), path = require('path'), ROOT = path.join(__dirname, '..');
const URL_ = 'https://2-31-126-156.sslip.io/e';
const JS = "(function(){try{var U='" + URL_ + "',seen={},n=0,q=[],W=window,D=document;" +
  "function cut(s,k){return String(s==null?'':s).replace(/\\b(bc1|tb1)[a-z0-9]{20,90}\\b/gi,'<addr>').replace(/\\b[13mn2][a-km-zA-HJ-NP-Z1-9]{25,34}\\b/g,'<addr>').replace(/\\b[0-9a-f]{40,}\\b/gi,'<hex>').replace(/[^\\s@]+@[^\\s@]+\\.[a-z]{2,}/gi,'<email>').slice(0,k)}" +
  "function pth(u){try{var x=new URL(u,location.href);return x.origin===location.origin?x.pathname:x.origin}catch(e){return ''}}" +
  "function bid(){var s=D.querySelector('script[src*=\"?v=\"]'),m=s&&/[?&]v=([0-9a-f]{6,12})/.exec(s.src);return m?m[1]:'?'}" +
  "function go(o){try{var b=JSON.stringify(o);if(!(navigator.sendBeacon&&navigator.sendBeacon(U,b)))fetch(U,{method:'POST',body:b,mode:'no-cors',keepalive:true})}catch(e){}}" +
  "function rep(k,m,f,l,c){m=cut(m,300);if(!m||/^Script error\\.?$/.test(m)||n>=5)return;var o={k:k,m:m,f:pth(f),l:l|0,c:c|0,b:bid(),p:location.pathname},key=[k,m,o.f,o.l].join('|');if(seen[key])return;seen[key]=1;n++;" +
  "if(D.prerendering){if(!q.length)D.addEventListener('prerenderingchange',function(){q.splice(0).forEach(go)},{once:true});q.push(o)}else go(o)}" +
  "W.addEventListener('error',function(e){if(!e||!e.message)return;rep('error',e.message,e.filename,e.lineno,e.colno)});" +
  "W.addEventListener('unhandledrejection',function(e){var r=e&&e.reason,f='',l=0,c=0,s=r&&r.stack&&String(r.stack).split('\\n'),i,m;" +
  "for(i=0;s&&i<s.length;i++){m=/(https?:\\/\\/[^\\s)]+?):(\\d+):(\\d+)/.exec(s[i]);if(m){f=m[1];l=+m[2];c=+m[3];break}}" +
  "rep('rejection',r&&r.message?(r.name&&r.name!=='Error'?r.name+': ':'')+r.message:String(r),f,l,c)})}catch(e){}})();";
const TAG = '<!--err-report-1102-->', SNIP = TAG + '<script>/* err-report-1102: page errors -> message, file, line, build, page only (no wallet, no query string); see tools/build-err-report.js */' + JS + '</script>' + TAG;
const RE = /<!--err-report-1102-->[\s\S]*?<!--err-report-1102-->/;
function apply(h) { h = h.replace(RE, '');
  const nc = h.indexOf('<!--nav-cache-1102-->'), nc2 = nc >= 0 ? h.indexOf('<!--nav-cache-1102-->', nc + 5) : -1;
  if (nc2 >= 0) { const at = nc2 + '<!--nav-cache-1102-->'.length; return h.slice(0, at) + SNIP + h.slice(at); }
  const m = /<meta charset="utf-8">/i.exec(h); if (!m) throw new Error('no <meta charset> to put the reporter after');
  return h.slice(0, m.index + m[0].length) + SNIP + h.slice(m.index + m[0].length); }
const pages = () => fs.readdirSync(ROOT).filter(f => /\.html$/.test(f) && !/^practice/.test(f)).concat(['templates/game.html']);
module.exports = { SNIP, JS, URL: URL_, apply, pages, RE };
if (require.main === module) {
  const check = process.argv.includes('--check'); let bad = 0;
  pages().forEach(f => { const p = path.join(ROOT, f), h = fs.readFileSync(p, 'utf8'), out = apply(h);
    if (check) { if (h !== out) { bad++; console.log('OUT OF DATE: ' + f + ' (run node tools/build-err-report.js)'); } }
    else if (h !== out) { fs.writeFileSync(p, out); console.log('wrote ' + f); } });
  if (check) { console.log(bad ? bad + ' page(s) out of date' : 'err-report: all ' + pages().length + ' pages current'); process.exit(bad ? 1 : 0); }
}
