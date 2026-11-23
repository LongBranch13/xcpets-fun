new Promise(r=>{const t0=Date.now();const res={};const ids=[205425,100790,114875];let k=0;
function px(c){try{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0,nz=0;for(let i=3;i<d.length;i+=4){if(d[i])n++;}return n+'/'+(d.length/4)+' '+c.width+'x'+c.height}catch(e){return 'e:'+e.message}}
function step(){const w=window.V2Mock&&V2Mock.world&&V2Mock.world();const s=document.getElementById('fSearch');if((!w||!w.byId||!w.byId[205425]||!s)&&Date.now()-t0<150000)return setTimeout(step,2000);
 if(k>=ids.length){res.zapT=(document.querySelector('#zapBtn .zap-t')||{}).textContent;return r(JSON.stringify(res));}
 const id=ids[k++];s.value=String(id);s.dispatchEvent(new Event('input',{bubbles:true}));s.dispatchEvent(new Event('change',{bubbles:true}));
 setTimeout(()=>{const cs=[...document.querySelectorAll('#pets canvas, #mpsBox canvas')];const card=[...document.querySelectorAll('#pets .pet.card, #mpsBox .pet.card')].find(c=>c.textContent.indexOf('#'+id)>=0);const o={cards:document.querySelectorAll('#pets .pet.card').length};if(card){card.scrollIntoView({block:'center'});}
  setTimeout(()=>{if(card){const c=card.querySelector('canvas');o.px=c?px(c):'nocanvas';o.fr=c&&c._fr?c._fr.length+(c._fr[0]&&c._fr[0].data?':'+c._fr[0].data.length:''):'none';o.still=c&&c._frStill;o.cls=c&&c.className;o.conn=c&&c.isConnected;}else o.card='none';res[id]=o;step();},4000);},5000);}
step();})
