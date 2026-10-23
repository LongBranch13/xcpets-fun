/* token-box: live XCPETS supply / burned (Counterparty read API) + 30-day daily chart
 * from xcp.fun's public candle feed (api.xcp.fun/v2/candles/XCPETS, CORS *).
 * Display only: touches no game state, replay stays SAME. Any failed load keeps the
 * section hidden (supply row and chart hide independently). */
(function(){
  var box=document.getElementById("tokenLive"); if(!box||!window.fetch) return;
  var NODES=["https://api.xcp.fun/node/v2","https://api.counterparty.io:4000/v2"];
  function j(u,ms){var c=window.AbortController?new AbortController():null,t=setTimeout(function(){c&&c.abort()},ms||9000);
    return fetch(u,c?{signal:c.signal}:{}).then(function(r){clearTimeout(t);if(!r.ok)throw r.status;return r.json()});}
  function node(p){var i=0;function n(){return j(NODES[i]+p).catch(function(e){if(++i<NODES.length)return n();throw e})}return n();}
  function fmt(q){return Math.round(q/1e8).toLocaleString("en-US");}
  function px(v){return v>=0.001?v.toFixed(6):v>=0.00001?v.toFixed(8):v.toExponential(2);}
  var stats=document.getElementById("tokSupply"),burnEl=document.getElementById("tokBurned"),chartWrap=document.getElementById("tokChartWrap");
  function show(){box.hidden=false;}
  node("/assets/XCPETS").then(function(d){
    var s=d&&d.result&&d.result.supply; if(!(s>0)) throw 0;
    stats.textContent=fmt(s); stats.parentNode.hidden=false; show();
    // total burned = sum of all XCPETS destroys (cursor paging, max 20 pages)
    var tot=0,pg=0;
    function page(cur){return node("/assets/XCPETS/destructions?limit=1000"+(cur?"&cursor="+cur:"")).then(function(r){
      (r.result||[]).forEach(function(x){tot+=+x.quantity||0}); if(r.next_cursor&&++pg<20) return page(r.next_cursor);});}
    return page().then(function(){ if(tot>0){burnEl.textContent=fmt(tot);burnEl.parentNode.hidden=false;} }).catch(function(){});
  }).catch(function(){});
  j("https://api.xcp.fun/v2/candles/XCPETS").then(function(d){
    var c=(d&&d.result)||[]; if(!c.length) throw 0;
    var last=c[c.length-1].bucket_start; c=c.filter(function(x){return last-x.bucket_start<30*86400});
    c=c.map(function(x){return{t:x.bucket_start,o:x.open/1e8,h:x.high/1e8,l:x.low/1e8,c:x.close/1e8,v:+x.volume_xcp/1e8}});
    if(!c.every(function(x){return isFinite(x.o)&&isFinite(x.c)&&x.h>0})) throw 0;
    window.__tokCandles=c; draw(c); chartWrap.hidden=false; show();
    var a=c[0].o,z=c[c.length-1].c,ch=(z/a-1)*100;
    document.getElementById("tokPrice").textContent=px(z)+" XCP";
    var ce=document.getElementById("tokChg"); ce.textContent=(ch>=0?"+":"")+ch.toFixed(1)+"% 30d"; ce.className=ch>=0?"up":"dn";
    window.addEventListener("resize",function(){draw(c)});
  }).catch(function(){});
  function draw(c){
    var cv=document.getElementById("tokChart"),W=Math.max(200,Math.min(560,cv.parentNode.clientWidth||320)),H=150,S=2; // S = chunky pixel scale
    var w=Math.floor(W/S),h=Math.floor(H/S); cv.width=w;cv.height=h; cv.style.width=w*S+"px"; cv.style.height=h*S+"px";
    var g=cv.getContext("2d"); g.imageSmoothingEnabled=false; g.fillStyle="#0e1610"; g.fillRect(0,0,w,h);
    var lo=Infinity,hi=0,vm=0; c.forEach(function(x){lo=Math.min(lo,x.l);hi=Math.max(hi,x.h);vm=Math.max(vm,x.v)}); if(hi<=lo)hi=lo*1.01+1e-12;
    var top=4,ph=h-24,vb=h-3,n=c.length,step=(w-8)/Math.max(n,1),bw=Math.max(1,Math.floor(step*0.6));
    function y(v){return Math.round(top+(hi-v)/(hi-lo)*ph);}
    g.fillStyle="#1d2e21"; for(var k=0;k<=3;k++) g.fillRect(0,top+Math.round(ph*k/3),w,1);
    c.forEach(function(x,i){var cx=Math.round(4+step*i+step/2),up=x.c>=x.o,col=up?"#3ddc84":"#ff5a5a";
      g.fillStyle=col; g.fillRect(cx,y(x.h),1,Math.max(1,y(x.l)-y(x.h)+1));
      var a=y(Math.max(x.o,x.c)),b=y(Math.min(x.o,x.c)); g.fillRect(cx-(bw>>1),a,bw,Math.max(1,b-a+1));
      var vh=vm>0?Math.max(1,Math.round(x.v/vm*14)):1; g.globalAlpha=.45; g.fillRect(cx-(bw>>1),vb-vh,bw,vh); g.globalAlpha=1;});
    var lab=document.getElementById("tokRange"); if(lab){var d0=new Date(c[0].t*1000);lab.textContent="hi "+px(hi)+" · lo "+px(lo)+" XCP · daily since "+d0.toLocaleDateString("en-US",{month:"short",day:"numeric",timeZone:"UTC"});}
  }
})();
