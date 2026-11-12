/* species-ranks-split / all-places (owner Oct 24 2026): ONE list of every in-game place and ONE way to link them. Navigation/display only.
 *  - header: the same "🗺️ Places" menu on every page (static markup written from this list by tools/build-places.js; phone friendly)
 *  - place pages: the same "🏘️ Town › Place" bar at the top, with the place's stations (Spam City: Buy / Sell / Trade / Gift Wrap / Token Press)
 *  - front page: the same place card (pixel sign + name + one fun line) for places that have no scene card yet
 * Old URLs and hashes are untouched (js/v2-page-split.js still routes the old play.html hashes). */
(function (root) {
  'use strict';
  var PLACES = [
    { id: 'circus', ico: '⚔️', name: 'X Circus Kekimus', url: 'fight.html', line: 'sand, blood, glory', pages: ['fight.html'] },
    { id: 'rare', ico: '🖼️', name: 'The Rare Room', url: 'rare-room.html', line: 'try on the drip', pages: ['rare-room.html'],
      stations: [['🎡', 'Pepe Wheel', 'rare-room.html#rare-room'], ['👗', 'Dressing room', 'rare-room.html#dressing-room']] },
    { id: 'motel', ico: '🏨', name: 'Gooby\u2019s No-Tail Motel', url: 'breed.html', line: 'check in, egg out', pages: ['breed.html'] },
    { id: 'spam', ico: '🛒', name: 'Spam City Games', url: 'shop.html', line: 'buy, sell, trade pets', pages: ['shop.html'],
      stations: [['🃏', 'Buy', 'shop.html#buy'], ['🏷️', 'Sell', 'shop.html#sell'], ['🔁', 'Trade', 'shop.html#trade'], ['🎁', 'Gift Wrap', 'shop.html#gift'], ['🏭', 'Token Press', 'shop.html#press']] },
    { id: 'raid', ico: '🐉', name: 'Raid Boss', url: 'raid.html', line: 'hit it together', pages: ['raid.html'] },
    { id: 'cemetery', ico: '🪦', name: 'Pet Cemetery', url: 'cemetery.html', line: 'rest in pixels', pages: ['cemetery.html'] },
    /* pantheon-nav: The Pantheon is a place, same header menu and home card as the cemetery (display only) */
    { id: 'pantheon', ico: '🌕', name: 'The Pantheon', url: 'pantheon.html', line: '21 seats, 21 gods', pages: ['pantheon.html'] },
    { id: 'tokens', ico: '🎖️', name: 'Proof Parade', url: 'tokens.html', line: 'every token in order', pages: ['tokens.html'] },
    /* live-activity (owner Nov 1 2026): the Live Feed, what just happened, newest first (display only, no wallet) */
    { id: 'live', ico: '📡', name: 'Live Feed', url: 'live.html', line: 'what just happened', pages: ['live.html'] }
  ];
  /* tutorial-banner (owner playtest note 1, Oct 27 2026): The Big Beautiful Tutorial is NOT a place. It sits in the top banner by itself
   * (its own link after Ranking on every page with the banner), never in the Places menu, the My Pets 'Places' card or the front-page place cards. */
  var TUTORIAL = { ico: '🎓', name: 'Tutorial', title: 'The Big Beautiful Tutorial', url: 'tutorial.html' };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  /** header menu markup (tools/build-places.js writes it between <!--places--> and <!--/places--> on every page) */
  function menu() { return '<details class="navplaces"><summary>🗺️ Places</summary><div class="np-menu" role="menu">' +
    PLACES.map(function (p) { return '<a role="menuitem" class="np-' + p.id + '" href="' + p.url + '"><span aria-hidden="true">' + p.ico + '</span> ' + esc(p.name) + '</a>'; }).join('') + '</div></details><!-- the site\'s existing Ranking link (all boards, Hall of Fame included) --><a class="navrank" href="ranking.html">Ranking</a>' +
    '<!-- the tutorial, standalone in the banner (not a place) --><a class="navtut" href="' + TUTORIAL.url + '" title="' + esc(TUTORIAL.title) + '"><span aria-hidden="true">' + TUTORIAL.ico + '</span> ' + esc(TUTORIAL.name) + '</a>'; }
  var api = { PLACES: PLACES, TUTORIAL: TUTORIAL, menu: menu };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;
  root.V2Places = api;
  var file = (location.pathname.split('/').pop() || 'index.html'), here = PLACES.filter(function (p) { return p.pages.indexOf(file) >= 0; })[0];
  function boot() {
    /* header: mark the current place, close the menu on outside tap / Esc */
    document.querySelectorAll('details.navplaces').forEach(function (d) {
      if (here) { var a = d.querySelector('.np-' + here.id); if (a) a.setAttribute('aria-current', 'page'); d.querySelector('summary').classList.add('np-on'); }
      document.addEventListener('click', function (e) { if (d.open && !d.contains(e.target)) d.open = false; });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') d.open = false; }); });
    /* banner tutorial link: mark it on tutorial.html */
    if (file === TUTORIAL.url) document.querySelectorAll('header.nav nav a.navtut').forEach(function (a) { a.setAttribute('aria-current', 'page'); });
    /* place pages: Town bar + stations */
    if (here && !document.getElementById('townBar')) { var m = document.querySelector('main') || document.body, bar = document.createElement('nav');
      bar.id = 'townBar'; bar.className = 'townbar'; bar.setAttribute('aria-label', 'Where you are');
      bar.innerHTML = '<a class="tb-town" href="index.html#places">🏘️ Town</a><span aria-hidden="true">›</span><b>' + here.ico + ' ' + esc(here.name) + '</b>' +
        (here.stations ? '<span class="tb-st">' + here.stations.map(function (s) { var on = s[2].indexOf('#') < 0 && s[2] === file; return '<a href="' + s[2] + '"' + (on ? ' aria-current="page"' : '') + '>' + s[0] + ' ' + esc(s[1]) + '</a>'; }).join('') + '</span>' : '');
      m.insertBefore(bar, m.firstChild); }
    /* Spam City stations: tabs are read once at load, so a station link on the same page reloads into that station */
    if (file === 'shop.html') root.addEventListener('hashchange', function () { if (/^#(buy|sell|trade|gift|press)$/.test(location.hash)) location.reload(); });
    /* front page: one card per place, same .scard look; places without a scene canvas get a pixel sign */
    var row = document.getElementById('sceneCards'); if (row) { if (!document.getElementById('places')) { var an = document.createElement('a'); an.id = 'places'; an.className = 'scene-anchor'; row.parentNode.insertBefore(an, row); }
      PLACES.forEach(function (p) { var linked = null; p.pages.some(function (f) { var hit = row.querySelector('a[href^="' + f + '"]'); if (hit) linked = hit; return !!hit; });
        if (linked) { var cv0 = linked.querySelector('canvas'); if (cv0 && !cv0.getAttribute('data-scene') && linked.getAttribute('data-place') !== p.id) { linked.setAttribute('data-place', p.id); sign(cv0, p); } return; }
        if (row.querySelector('[data-place="' + p.id + '"]')) return;
        var a = document.createElement('a'); a.className = 'scard'; a.href = p.url; a.setAttribute('data-place', p.id);
        a.innerHTML = '<canvas width="320" height="180" role="img" aria-label="' + esc(p.name + ': ' + ({ raid: 'a towering boss and tiny pet raiders in an arena', tokens: 'pets marching with token banners and medals', live: 'a pet news anchor, studio camera and live ticker', pantheon: 'a moonlit temple of gold pillars and 21 empty seats' }[p.id] || 'pixel scene')) + '"></canvas><span class="sc-t">' + esc(p.name) + '</span><span class="sc-d">' + esc(p.line) + '</span>';
        row.appendChild(a); sign(a.querySelector('canvas'), p); });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { row.querySelectorAll('[data-place]').forEach(function (a) { sign(a.querySelector('canvas'), PLACES.filter(function (p) { return p.id === a.getAttribute('data-place'); })[0]); }); }); }
  }
  /* Hand-pixelled town establishing shots, static and presentation-only. */
  function townScene(c, id) {
    var x=c.getContext('2d'), ink='#100e14', gold='#e8b84a', cream='#fff1a8', teal='#1fb5a5', i,j;
    x.imageSmoothingEnabled=false;
    function R(cl,a,b,w,h){x.fillStyle=cl;x.fillRect(a,b,w,h);}
    function T(s,a,b,n){x.fillStyle=cream;x.font=(n||8)+'px "Press Start 2P", monospace';x.textAlign='center';x.textBaseline='alphabetic';x.fillText(s,a,b);}
    function pet(a,b,k,color,dog){
      var rows=dog?['.##.....##.','.#########.','###########','##WW###WW##','##WK###WK##','###CCCC###.','.##CKKC###.','..#CCCC##..','..#######..','.##BBBBB##.','.##BBBBB##.','..##...##..']:['..###.###..','.#########.','##WWW#WWW##','##WKK#WKK##','###########','.#########.','..#RRRRR#..','..#######..','.##BBBBB##.','###BBBBB###','#.#BBBBB#.#','..###.###..'];
      var pal={'#':color,W:'#fafaf5',K:ink,R:'#9b1035',B:'#2f6fe0',C:'#f2d7a0'};
      rows.forEach(function(r,y){for(var z=0;z<r.length;z++)if(r[z]!=='.')R(ink,a+z*k-1,b+y*k-1,k+2,k+2);});
      rows.forEach(function(r,y){for(var z=0;z<r.length;z++)if(pal[r[z]])R(pal[r[z]],a+z*k,b+y*k,k,k);});
    }
    R('#0b0a1f',0,0,320,180);
    if(id==='raid'){
      for(i=0;i<320;i+=32){R('#3b1766',i,20,28,95);R('#1d1530',i+4,26,20,75);}
      R('#5a3a4a',0,94,320,34);R(gold,0,94,320,3);
      for(i=0;i<32;i++)R(['#478001',gold,'#9aa3b5'][i%3],i*10+2,104+(i%2)*6,5,5);
      R('#b38b55',0,130,320,50);for(i=0;i<60;i++)R('#7a4f2a',(i*47)%320,137+(i*11)%41,3,1);
      [[120,49,80,65],[108,65,104,43],[99,85,122,35],[111,111,36,22],[174,111,36,22],[112,38,15,32],[193,38,15,32]].forEach(function(q){R(ink,q[0]-3,q[1]-3,q[2]+6,q[3]+6);R('#526655',q[0],q[1],q[2],q[3]);});
      R('#8caa72',126,51,68,48);R('#6b855f',118,101,84,15);R(ink,128,64,25,15);R(ink,168,64,25,15);R('#d0284f',132,69,16,6);R('#d0284f',173,69,16,6);R(ink,139,88,42,13);for(i=0;i<4;i++)R(cream,142+i*10,89,5,6);
      [[108,38],[195,38]].forEach(function(q){R(gold,q[0],q[1],17,7);R(cream,q[0]+4,q[1]-9,8,10);});
      R(ink,112,12,96,12);R('#9b1035',115,15,90,6);R('#d0284f',115,15,64,6);
      pet(35,137,2,'#8cc63f');pet(80,146,2,gold,true);pet(219,145,2,'#478001');pet(267,135,2,'#f2d7a0',true);
      [65,244].forEach(function(a){R(ink,a,127,3,34);R('#9aa3b5',a-2,122,7,19);R(gold,a-5,143,13,3);});
    }else if(id==='pantheon'){
      R('#0b0a1f',0,0,320,180);
      for(i=0;i<40;i++)R(cream,(i*61)%320,(i*23)%70,1,1);
      R(cream,248,18,28,28);R('#0b0a1f',238,12,22,22);
      R('#14301f',0,148,320,32);R(ink,0,148,320,2);
      [[46,78],[136,62],[226,78]].forEach(function(q){R(ink,q[0]-3,q[1]-3,46,78);R(gold,q[0],q[1],40,72);R('#2a2150',q[0]+6,q[1]+8,28,48);R(cream,q[0]+16,q[1]+22,8,22);});
      R(ink,28,70,264,12);R(gold,32,74,256,6);R('#7f6be0',148,118,24,30);R(cream,152,124,16,16);
      T('XXI',160,170,10);
    }else if(id==='tokens'){
      R('#25365a',0,0,320,109);
      for(i=0;i<6;i++){var a=i*58-10;R('#5a3a4a',a,20+(i%2)*12,50,89);R('#9b1035',a,18+(i%2)*12,50,5);for(j=0;j<3;j++){R(cream,a+8+j*13,43,7,12);R(teal,a+8+j*13,74,7,14);}}
      R('#efe8f6',0,109,320,12);R(ink,0,120,320,3);R('#444454',0,123,320,57);for(i=0;i<8;i++)R(gold,i*44,165,24,3);
      for(i=0;i<16;i++){var yy=8+Math.floor(Math.sin(i/15*Math.PI)*15),cl=[teal,'#d0284f',gold][i%3];R(ink,i*20,yy,20,2);R(cl,i*20+4,yy+2,12,9);R(cl,i*20+7,yy+11,6,4);}
      for(i=0;i<5;i++){var a=18+i*61,b=126+(i%2)*7;pet(a,b,2,i%2?gold:'#8cc63f',i%2);R(ink,a+27,b-45,3,58);R(gold,a+30,b-43,28,31);R('#2a0f4a',a+32,b-41,24,26);R(cream,a+37,b-36,14,15);R(teal,a+40,b-33,8,9);R('#9b1035',a+7,b+18,8,5);R(gold,a+8,b+22,6,6);}
    }else{
      R('#1d1530',0,0,320,180);R('#3b1766',8,8,304,114);R(ink,78,17,168,81);R('#25365a',82,21,160,73);
      for(i=0;i<10;i++){var a=84+i*16,h=20+(i*17)%40;R('#0b0a1f',a,94-h,13,h);for(j=0;j<3;j++)R(teal,a+4,98-h+j*12,3,4);}
      R('#9aa3b5',158,20,3,75);R('#9aa3b5',82,58,160,3);R(ink,14,18,55,18);R('#9b1035',16,20,51,14);T('ON AIR',42,30,6);
      [32,62].forEach(function(b){R(ink,257,b,48,28);R(teal,260,b+3,42,22);R('#25365a',263,b+6,36,16);for(i=0;i<4;i++)R('#4fd18b',266+i*8,b+17-(i%2)*5,4,5+(i%2)*5);});
      R('#444454',0,124,320,56);for(i=0;i<8;i++)R('#5a3a4a',i*44,124,2,56);
      pet(139,65,3,'#8cc63f');R('#1a2b4a',134,96,43,24);R('#fafaf5',152,96,8,20);R('#9b1035',154,99,4,17);
      R(ink,93,116,151,42);R('#2f6fe0',97,119,143,34);R('#9aa3b5',89,112,159,7);R(teal,104,124,129,3);T('XCPETS',169,143,10);
      R(ink,184,103,3,10);R('#9aa3b5',181,99,8,6);R('#efe8f6',192,105,19,5);
      R(ink,24,81,41,27);R('#526655',27,84,35,21);R('#9aa3b5',59,87,11,15);R(ink,70,84,12,21);R(teal,72,87,7,15);R('#d0284f',30,87,4,4);R(ink,42,107,5,48);R(ink,24,155,23,3);R(ink,47,155,23,3);
      R(ink,0,161,320,19);R('#9b1035',0,163,53,15);T('LIVE',27,174,7);T('HATCH / GEAR / BATTLE',188,174,7);
    }
    x.textAlign='left';x.textBaseline='alphabetic';
  }
  /* 8-bit sign: night sky, gold-framed board, emoji + name in the pixel font */
  function sign(c, p) { if (['raid','tokens','live','pantheon'].indexOf(p.id) >= 0) return townScene(c, p.id); var x = c.getContext('2d'), W = 320, H = 180; x.imageSmoothingEnabled = false; function R(cl, a, b, w, h) { x.fillStyle = cl; x.fillRect(a, b, w, h); }
    R('#100E14', 0, 0, W, H); for (var i = 0; i < 46; i++) R('#fff6c8', (i * 73 + p.id.length * 11) % W, (i * 37) % 70, 1, 1);
    R('#14301f', 0, 140, W, 40); R('#000', 0, 140, W, 2); R('#3a2a1a', 154, 118, 12, 24); R('#000', 40, 26, 240, 96); R('#E8B33A', 44, 30, 232, 88); R('#1d1530', 50, 36, 220, 76);
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '30px serif'; x.fillText(p.ico, 160, 60);
    var n = p.name.toUpperCase(), fs = n.length > 16 ? 8 : 10; x.font = fs + 'px "Press Start 2P", monospace'; x.fillStyle = '#FAFAF5'; x.fillText(n, 160, 94); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  /* casatookan-app (Nov 1 2026): Casa Tookan wallet browser keeps its splash up until the page says it has drawn
   * (manifest capability wallet.ready, 10 s cap). Call it once, after load + the next two frames. No-op everywhere else. */
  function appReady() { var done = false; function go() { if (done) return; done = true; try { if (root.wallet && typeof root.wallet.ready === 'function') root.wallet.ready(); } catch (e) {} }
    var raf = root.requestAnimationFrame || function (f) { return setTimeout(f, 16); };
    function after() { raf(function () { raf(go); }); }
    if (document.readyState === 'complete') after(); else root.addEventListener('load', after); }
  if (typeof document !== 'undefined') appReady();
})(typeof window !== 'undefined' ? window : globalThis);
