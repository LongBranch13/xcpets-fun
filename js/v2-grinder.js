/* 🥩 THE MEAT GRINDER screen (owner Nov 23 2026: "Yes, build it as shown"). UI only: the rule is pet:grind in js/v2-rules.js
 * (ACTIVATE_GRIND_BLOCK). The Grinder is its own place (Jake Nov 25 2026, "it needs its own spot in Places"): 🗺️ Places → 🥩 The Meat
 * Grinder opens play.html#grinder, which opens this screen once My Pets has loaded. The old button in ⚙️ More → Care stays too.
 * ?grinder=preview shows it before the Grinder is open, read-only, for screenshots.
 * The screen shows the machine with the player's own discarded pets in the hopper, the meat meter, a "how many?" picker (Jake Nov 25 2026:
 * "Looks like I only have the option to grind 2000"; lowest pet numbers go first, the same order as the rule, so pet:grind:N takes exactly
 * the pets shown), what that grind would give, and one GRIND button: the machine winds up and grinds, then the usual sign sheet opens
 * (V2UI.confirmPlans). The game never signs. When a grind of this wallet confirms, the SPLORCH show plays once: the meat counts up, the
 * meter fills, then every spin, Sausage Egg and the Golden Sausage roll pop out one at a time (Skip shows all). Remembered in localStorage. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var NF = new Intl.NumberFormat('en-US');
  function fmt(n) { return NF.format(Number(n) || 0); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var PREVIEW = /[?&]grinder=preview/.test(location.search);
  var RM = false; try { RM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { }
  function D() { return window.__demo; } function V() { return window.V2Rules || {}; } function U() { return window.V2UI || {}; }
  function me() { return window.V2Mock && V2Mock.ME; }
  function tipB(w) { return ((w && w.tip) || 0) + 1; }
  function open_(w) { var v = V(); return !!(v.grindOn && v.grindOn(tipB(w))); }
  function viewOnly() { return !!(U().viewOnly && U().viewOnly()); }
  function net() { return (window.LiveEngine && LiveEngine.CFG && LiveEngine.CFG.network) || 'mainnet'; }
  function sfx(k, a) { try { if (window.V2Sfx && V2Sfx[k]) V2Sfx[k](a); } catch (e) { } }
  function G_() { var G = V().GRIND || {}; return { COST: G.COST || 69, MAX: G.MAX || 2000, MEAT: G.MEAT || [1, 2, 5, 20], SPIN_EVERY: G.SPIN_EVERY || 250, EGG_EVERY: G.EGG_EVERY || 1000,
    GOLD_PER_PET: G.GOLD_PER_PET || 50, GOLD_MAX: G.GOLD_MAX || 100000 }; }
  var T = ['Common', 'Uncommon', 'Rare', 'Legendary'], TC = ['#c9c9c9', '#7be07b', '#5ab4ff', '#ffd166'];
  /* MEAT GRINDER 2 (rules ACTIVATE_GRIND2_BLOCK, Jake Nov 25 2026): keep-rarity grinds, better Sausage Eggs, Golden Sausage = the special egg */
  function g2(b) { var v = V(); return !!(v.grind2On && v.grind2On(b)); }
  function goldOdds(n, b) { var v = V(), G = G_(); return v.grindGoldOdds ? v.grindGoldOdds(n, b) : Math.min(G.GOLD_MAX, n * G.GOLD_PER_PET); } /* per million */
  /* the 1-in-777 slot pet right now (display only: the replay decides). Same order as the rules' special-egg chain. */
  /* species-registry (Nov 25 2026): the newest community pet in Cold Storage whose eggs hatch (community.eggs: FUNTRUMP #4 onward), from js/species-registry.js */
  function specialName(w) { var v = V(); if (v.aspieOn && v.aspieOn((w && w.tip || 0) + 1)) return 'Aspie'; /* ASPIE (rules ACTIVATE_ASPIE_BLOCK): the Grinder's own pet */ var R = window.XcpSpecies, o = null; if (R) R.coldOrder().forEach(function (x) { if (R.get(x.id).community.eggs && w[x.key]) o = R.shortName(x.id); }); return o || 'the special egg'; }
  /* every pet that isn't a normal egg species glows pink in the result list (community pets, 1 of 1s, special eggs: Aspie and later ones too) */
  var SPECIAL_SP = window.XcpSpecies ? XcpSpecies.specialMap() : { homer: 1, rabbit: 1, groyper: 1, funtrump: 1, kek: 1, wizard: 1, aspie: 1 };
  var KEEP = [[3, '🥩 Everything'], [2, '⭐ Keep Legendaries'], [1, '💎 Keep Rares + Legendaries'], [0, '🪨 Commons only']], KEEP_KEY = 'xcpets-grind-keep';
  function keepGet() { try { var r = localStorage.getItem(KEEP_KEY), k = +r; return r != null && k >= 0 && k <= 3 ? k : 3; } catch (e) { return 3; } }
  function keepSet(k) { try { localStorage.setItem(KEEP_KEY, String(k)); } catch (e) { } }

  function css() { if ($('mgrCss')) return; var s = document.createElement('style'); s.id = 'mgrCss';
    s.textContent = '.mgr-bg{position:fixed;inset:0;z-index:10050;background:rgba(5,4,12,.86);display:flex;align-items:center;justify-content:center;padding:10px}' +
      '.mgr{position:relative;width:100%;max-width:440px;max-height:96vh;overflow:auto;background:#0e1610;color:#f3ecd8;border:3px solid #000;box-shadow:0 0 0 3px #ff6b6b,7px 7px 0 #000;padding:14px;font-family:"Comic Neue","Comic Sans MS",sans-serif;box-sizing:border-box}' +
      '.mgr.wide{max-width:860px}.mgr-cols{display:block}@media (min-width:760px){.mgr.wide .mgr-cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:start}}' +
      '.mgr h3{margin:0;font-family:Bangers,Impact,sans-serif;font-weight:400;font-size:42px;line-height:.95;letter-spacing:2px;color:#ff6b6b;text-shadow:3px 3px 0 #000}.mgr h3 sup{font-size:.4em;color:#ffd166}.mgr .mgr-sub{margin:4px 0 10px;font-size:15px}' +
      '.mgr-meatchip{position:absolute;top:14px;right:14px;font:9px "Press Start 2P",monospace;color:#ffd166;border:2px solid #000;background:#2a2210;padding:6px 8px}' +
      '.mgr-x{position:absolute;top:10px;right:10px;width:36px;height:36px;font:700 20px sans-serif;color:#f3ecd8;background:#243328;border:3px solid #000;box-shadow:2px 2px 0 #000;cursor:pointer;line-height:1}.mgr-x+.mgr-meatchip{right:56px}' +
      /* the machine: hopper with the real pets, the red GRIND-O-MATIC 9000 body, crank, chute and sausages */
      '.mgr-mach{position:relative;height:250px;background:linear-gradient(#1b2b20 0 70%,#2a1c14 70%);border:3px solid #000;box-shadow:0 0 0 3px #3ddc84,5px 5px 0 #000;overflow:hidden;margin:6px 0 10px}' +
      '.mgr-mach:before{content:"";position:absolute;left:0;right:0;top:70%;height:3px;background:#000}' +
      '.mgr-hop{position:absolute;left:50%;top:8px;width:210px;margin-left:-105px;height:92px;background:#5b6470;border:3px solid #000;clip-path:polygon(0 0,100% 0,70% 100%,30% 100%);box-shadow:inset 0 6px 0 #7b8490}' +
      '.mgr-pets{position:absolute;left:50%;top:8px;width:200px;margin-left:-100px;display:flex;flex-wrap:wrap;justify-content:center;gap:3px;z-index:2}' +
      '.mgr-pets canvas{width:38px;height:38px;image-rendering:pixelated;border:2px solid #000;background:#0f0d1e;animation:mgBob 2.4s ease-in-out infinite}.mgr-pets canvas:nth-child(2n){animation-delay:.6s}.mgr-pets canvas:nth-child(3n){animation-delay:1.2s}' +
      '@keyframes mgBob{0%,100%{transform:translateY(-4px) rotate(-8deg)}50%{transform:translateY(3px) rotate(8deg)}}' +
      '.mgr-body{position:absolute;left:50%;top:100px;width:170px;margin-left:-85px;height:86px;background:#8a2f2f;border:3px solid #000;box-shadow:inset -10px -10px 0 #6a2020,inset 8px 8px 0 #b44a4a;text-align:center;z-index:3}' +
      '.mgr-body b{display:block;margin-top:12px;font:10px/1.6 "Press Start 2P",monospace;color:#ffd166;text-shadow:2px 2px 0 #000}.mgr-body i{display:block;margin:6px auto 0;width:104px;height:14px;background:repeating-linear-gradient(90deg,#ddd 0 8px,#000 8px 12px);border:2px solid #000}' +
      '.mgr-teeth{position:absolute;left:50%;top:94px;width:96px;margin-left:-48px;height:10px;background:repeating-linear-gradient(90deg,#e8e8e8 0 6px,#000 6px 8px);border:2px solid #000;z-index:4}' +
      '.mgr-crank{position:absolute;left:50%;top:110px;margin-left:80px;z-index:4;animation:mgSpin 1.4s linear infinite}@keyframes mgSpin{to{transform:rotate(360deg)}}' +
      '.mgr-chute{position:absolute;left:50%;top:186px;width:44px;margin-left:-22px;height:22px;background:#5b6470;border:3px solid #000;border-top:0;z-index:3}' +
      '.mgr-saus{position:absolute;left:50%;top:208px;margin-left:-30px;display:flex;gap:2px;animation:mgOut 2s linear infinite;z-index:2}.mgr-saus span{width:40px;height:17px;border-radius:10px;background:#e86a7d;border:3px solid #000;box-shadow:inset -5px -4px 0 #b84a5b}' +
      '@keyframes mgOut{0%{transform:translateX(0)}100%{transform:translateX(-170px)}}' +
      '.mgr-spl{position:absolute;right:10px;bottom:8px;font-family:Bangers,Impact,sans-serif;font-size:24px;color:#ffd166;text-shadow:2px 2px 0 #000;transform:rotate(-6deg);z-index:5}' +
      '.mgr-host{display:flex;align-items:center;gap:8px;margin:2px 0 8px;cursor:pointer}.mgr-host canvas{width:64px;height:64px;image-rendering:pixelated;background:#1b1520;border:3px solid #000;border-radius:6px;flex:none}' +
      '.mgr-bub{position:relative;background:#fafaf5;color:#100e14;border:3px solid #000;border-radius:10px;padding:5px 9px;font:700 13px "Comic Neue",sans-serif;box-shadow:2px 2px 0 #000}' +
      '.mgr-bub:before{content:"";position:absolute;left:-10px;top:50%;margin-top:-6px;border:6px solid transparent;border-right:6px solid #000}' +
      '.mgr-sign{position:absolute;left:8px;top:8px;background:#fafaf5;color:#100e14;border:3px solid #000;padding:3px 6px;font:700 12px "Comic Neue",sans-serif;transform:rotate(-4deg);box-shadow:2px 2px 0 #000;max-width:96px;line-height:1.15;z-index:5}' +
      /* grinding: pets fall in, crank whirs, meat sprays, comic words */
      '.mgr-mach.go{animation:mgShake .09s linear infinite}@keyframes mgShake{25%{transform:translate(2px,-2px)}75%{transform:translate(-2px,1px)}}.mgr-mach.go .mgr-crank{animation-duration:.22s}' +
      '.mgr-mach.go .mgr-pets canvas{animation:mgFall .7s cubic-bezier(.5,0,.9,.4) forwards}.mgr-mach.go .mgr-pets canvas:nth-child(2){animation-delay:.12s}.mgr-mach.go .mgr-pets canvas:nth-child(3){animation-delay:.24s}.mgr-mach.go .mgr-pets canvas:nth-child(4){animation-delay:.36s}.mgr-mach.go .mgr-pets canvas:nth-child(5){animation-delay:.48s}.mgr-mach.go .mgr-pets canvas:nth-child(6){animation-delay:.6s}' +
      '@keyframes mgFall{0%{transform:translateY(0) rotate(0)}100%{transform:translateY(80px) rotate(200deg) scale(.15);opacity:0}}' +
      '.mgr-mach.go .mgr-saus{animation-duration:.5s}' +
      /* the parade (Jake Nov 25 2026: "it would be cool to see the pets go into the grinder when you press grind"): the real pets being ground fly in one by one */
      '.mgr-drop{position:absolute;left:50%;top:0;width:46px;height:46px;margin-left:-23px;image-rendering:pixelated;border:2px solid #000;background:#0f0d1e;z-index:2;opacity:0;animation:mgDrop .75s cubic-bezier(.45,0,.85,.5) forwards}' +
      '@keyframes mgDrop{0%{transform:translate(var(--x),-60px) rotate(0);opacity:1}55%{transform:translate(calc(var(--x) * .25),40px) rotate(var(--r)) scale(1);opacity:1}100%{transform:translate(0,96px) rotate(calc(var(--r) * 2)) scale(.1);opacity:0}}' +
      '.mgr-ctr{position:absolute;right:8px;top:8px;z-index:7;font:10px "Press Start 2P",monospace;color:#ffd166;background:#100e14;border:2px solid #000;padding:6px 7px;box-shadow:2px 2px 0 #000}' +
      '.mgr-mach.go .mgr-sign{display:none}' +
      '.mgr-chunk{position:absolute;left:50%;top:204px;width:10px;height:8px;background:#e86a7d;border:2px solid #000;border-radius:3px;z-index:6;animation:mgChunk .8s cubic-bezier(.2,.6,.4,1) forwards}' +
      '@keyframes mgChunk{0%{transform:translate(0,0) rotate(0)}60%{opacity:1}100%{transform:translate(var(--dx),var(--dy)) rotate(var(--r));opacity:0}}' +
      '.mgr-pow{position:absolute;z-index:7;font-family:Bangers,Impact,sans-serif;font-size:40px;color:#ffd166;-webkit-text-stroke:2px #000;text-shadow:3px 3px 0 #000;letter-spacing:1px;pointer-events:none;animation:mgPow .7s cubic-bezier(.2,1.8,.4,1) forwards}' +
      '@keyframes mgPow{0%{transform:scale(.2) rotate(var(--r,-10deg));opacity:0}30%{opacity:1}80%{transform:scale(1) rotate(var(--r,-10deg));opacity:1}100%{transform:scale(1.1) rotate(var(--r,-10deg));opacity:0}}' +
      /* meter */
      '.mgr-lbl{display:flex;justify-content:space-between;font:9px "Press Start 2P",monospace;color:#9be08a;margin-top:4px}' +
      '.mgr-bar{position:relative;height:22px;background:#0d140f;border:3px solid #000;margin:4px 0}.mgr-bar>div{height:100%;background:repeating-linear-gradient(135deg,#e86a7d 0 10px,#c9566a 10px 20px)}.mgr-bar>div.add{position:absolute;top:0;background:repeating-linear-gradient(135deg,#ffd166 0 10px,#e8b33a 10px 20px);opacity:.85}' +
      '.mgr-bar span{position:absolute;top:-3px;bottom:-3px;width:3px;background:#000}.mgr-small{font-size:13px;line-height:1.35}' +
      '.mgr-box{background:#16221a;border:2px solid #2c4a26;padding:8px 10px;font-size:14px;line-height:1.45;margin:8px 0}' +
      /* the how-many picker */
      '.mgr-amt{background:#1d1530;border:3px solid #000;box-shadow:3px 3px 0 #000;padding:10px;margin:8px 0}.mgr-amt h4{margin:0 0 6px;font:10px "Press Start 2P",monospace;color:#ffd166;display:flex;justify-content:space-between;align-items:center;gap:6px}' +
      '.mgr-amt h4 output{font:400 28px Bangers,Impact,sans-serif;letter-spacing:1px;color:#fff;text-shadow:2px 2px 0 #000}' +
      '.mgr-amt input[type=range]{width:100%;margin:6px 0;accent-color:#ff4d4d;height:28px;cursor:pointer}' +
      '.mgr-chips{display:flex;flex-wrap:wrap;gap:6px}.mgr-chips button{flex:1 1 0;min-width:56px;min-height:38px;font:700 14px "Comic Neue",sans-serif;color:#f3ecd8;background:#2a2150;border:2px solid #000;box-shadow:2px 2px 0 #000;cursor:pointer;padding:4px 6px}' +
      '.mgr-chips button[aria-pressed=true]{background:#ffd166;color:#100e14}.mgr-chips button:disabled{opacity:.4;cursor:not-allowed}' +
      '.mgr-keep .mgr-chips{display:grid;grid-template-columns:1fr 1fr}.mgr-keep .mgr-chips button{font-size:13px;line-height:1.15;min-height:44px}' +
      '.mgr-tiers{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}.mgr-tiers span{font:700 12px "Comic Neue",sans-serif;border:2px solid #000;padding:2px 6px;background:#100e14}' +
      '.mgr-get{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin:8px 0}.mgr-get div{background:#16221a;border:2px solid #000;text-align:center;padding:6px 2px}.mgr-get b{display:block;font:400 26px Bangers,Impact,sans-serif;letter-spacing:1px;color:#ffd166;text-shadow:2px 2px 0 #000;line-height:1}' +
      '.mgr-get small{display:block;font-size:12px;line-height:1.2;margin-top:2px}.mgr-get .gd b{color:#ffe68a}' +
      '.mgr-go{display:block;width:100%;margin-top:6px;font-family:Bangers,Impact,sans-serif;font-size:30px;letter-spacing:2px;color:#fff;background:#ff4d4d;border:3px solid #000;box-shadow:4px 4px 0 #000;padding:10px;min-height:56px;text-shadow:2px 2px 0 #000;cursor:pointer}' +
      '.mgr-go:disabled{opacity:.45;cursor:not-allowed}.mgr-no{display:block;width:100%;margin-top:8px;font:700 15px "Comic Neue",sans-serif;color:#f3ecd8;background:#243328;border:3px solid #000;box-shadow:3px 3px 0 #000;padding:8px;min-height:44px;cursor:pointer}' +
      /* result show */
      '.mgr-big{text-align:center;font-family:Bangers,Impact,sans-serif;font-size:72px;line-height:1;color:#ffd166;-webkit-text-stroke:2px #000;text-shadow:4px 4px 0 #000;transform:rotate(-4deg);margin:34px 0 2px;animation:mgPop .5s cubic-bezier(.2,1.8,.4,1)}@keyframes mgPop{from{transform:scale(.3) rotate(-12deg)}}' +
      '.mgr-count{text-align:center;font-size:17px;font-weight:700;margin:2px 0 8px}.mgr-count b{font:400 30px Bangers,Impact,sans-serif;color:#ff6b6b;letter-spacing:1px;text-shadow:2px 2px 0 #000}' +
      '.mgr-rope{position:relative;height:30px;overflow:hidden;border:3px solid #000;background:#2a1c14;margin:6px 0}.mgr-rope i{position:absolute;top:4px;left:0;display:flex;gap:2px;animation:mgRope 1.6s linear infinite}.mgr-rope i span{width:44px;height:16px;border-radius:9px;background:#e86a7d;border:3px solid #000;box-shadow:inset -5px -4px 0 #b84a5b;flex:none}' +
      '@keyframes mgRope{from{transform:translateX(-46px)}to{transform:translateX(0)}}' +
      '.mgr-rw{display:flex;align-items:center;gap:12px;background:#16221a;border:3px solid #000;padding:10px;margin:8px 0}.mgr-rw.sp{box-shadow:0 0 0 2px #3ddc84}.mgr-rw.egg{box-shadow:0 0 0 2px var(--tc,#ffd166)}.mgr-rw.gold{box-shadow:0 0 0 3px #ffd166;background:linear-gradient(110deg,#2a2210 40%,#5a4a18 50%,#2a2210 60%);background-size:300% 100%;animation:mgShine 2s linear infinite}' +
      '@keyframes mgShine{from{background-position:100% 0}to{background-position:-100% 0}}' +
      '.mgr-rw b{display:block;font-family:Bangers,Impact,sans-serif;font-weight:400;font-size:26px}.mgr-rw.sp b{color:#9be08a}.mgr-rw.egg b{color:var(--tc,#ffd166)}.mgr-rw.gold b{color:#ffd166}.mgr-rw.miss{opacity:.8}.mgr-rw.miss b{font-size:20px}' +
      '.mgr-rw canvas{width:52px;height:52px;image-rendering:pixelated;border:2px solid #000;background:#0f0d1e;flex:none}' +
      '.mgr-rw.hide{display:none}.mgr-rw.in{animation:mgIn .45s cubic-bezier(.2,1.6,.4,1)}@keyframes mgIn{from{transform:scale(.5) rotate(-4deg);opacity:0}}' +
      '.mgr-egg{position:relative;width:52px;height:52px;flex:none}.mgr-egg canvas{position:absolute;inset:0;opacity:0;transform:scale(.4);transition:opacity .2s,transform .35s cubic-bezier(.2,1.8,.4,1)}.mgr-egg svg{position:absolute;inset:0;animation:mgWob .32s ease-in-out 3}' +
      '.mgr-egg.open canvas{opacity:1;transform:scale(1)}.mgr-egg.open svg{display:none}@keyframes mgWob{25%{transform:rotate(-14deg)}75%{transform:rotate(14deg)}}' +
      '.mgr-skip{position:absolute;top:8px;right:8px;z-index:2;font:700 13px "Comic Neue",sans-serif;color:#f3ecd8;background:#243328;border:2px solid #000;padding:4px 10px;cursor:pointer}' +
      '#mgOpen{white-space:nowrap}' +
      '@media (prefers-reduced-motion:reduce){.mgr *{animation:none!important;transition:none!important}}' +
      '.mgr-how{margin-top:10px;opacity:.85}' +
      '@media (max-width:520px){.mgr{padding:12px}.mgr h3{font-size:32px;padding-right:96px}.mgr h3 br{display:none}.mgr .mgr-sub{font-size:14px;margin:2px 0 6px}.mgr-big{font-size:58px}.mgr-get b{font-size:22px}' +
      '.mgr-mach{height:214px}.mgr-sign{display:none}.mgr-hop{top:4px;height:80px}.mgr-pets{top:4px}.mgr-pets canvas{width:32px;height:32px}.mgr-teeth{top:80px}.mgr-body{top:86px;height:74px}.mgr-body b{margin-top:8px}.mgr-crank{top:92px}.mgr-chute{top:160px;height:18px}.mgr-saus{top:180px}.mgr-chunk{top:176px}.mgr-mach:before{top:76%}.mgr-mach{background:linear-gradient(#1b2b20 0 76%,#2a1c14 76%)}}';
    document.head.appendChild(s); }
  function crank() { return '<svg class="mgr-crank" aria-hidden="true" width="52" height="52" viewBox="0 0 60 60"><rect x="26" y="4" width="8" height="52" fill="#c9c9c9" stroke="#000" stroke-width="3"/><rect x="4" y="26" width="52" height="8" fill="#c9c9c9" stroke="#000" stroke-width="3"/><circle cx="30" cy="30" r="9" fill="#ffd166" stroke="#000" stroke-width="3"/></svg>'; }
  function machine(ids) { return '<div class="mgr-mach" aria-hidden="true"><div class="mgr-sign">NO REFUNDS. NO REGRETS.</div><div class="mgr-hop"></div><div class="mgr-pets">' +
    ids.map(function (id) { return '<canvas width="32" height="32" data-mg="' + id + '"></canvas>'; }).join('') + '</div><div class="mgr-teeth"></div>' +
    '<div class="mgr-body"><b>GRIND-O-MATIC<br>9000</b><i></i></div>' + crank() + '<div class="mgr-chute"></div><div class="mgr-saus"><span></span><span></span><span></span><span></span><span></span><span></span></div><div class="mgr-spl">SPLORCH</div></div>'; }
  /* ASPIE, the Grinder's host (Jake Nov 25 2026: "she can be the character thats at the meat grinder welcoming players like gooby, captain dan, luke spam and mort").
   * Display only: her own sprite (cleaver in hand), idle frames, a speech bubble; tap her for the next line. After ACTIVATE_ASPIE_BLOCK she is also the prize. */
  var HOST_T = null, HOST_I = 0;
  function hostLines(b) { var v = V(), on = !!(v.aspieOn && v.aspieOn(b)), L = ['Welcome to the Grinder. I\u2019m Aspie.', 'Junk in. Sausage out.', 'Pick how many. I don\u2019t judge. Much.', 'No refunds. No regrets.'];
    return on ? L.concat(['Golden Sausage? That\u2019s me. Legendary.', 'Grind 2,000 for a 20% shot at me.', 'The only way to get me is right here.']) : L.concat(['Every 1,000 meat hatches a Sausage Egg.']); }
  function host(b) { if (!window.AspieSprite) return ''; return '<div class="mgr-host" id="mgHost" role="button" tabindex="0" aria-label="Aspie, the Grinder host. Tap for more."><canvas width="32" height="32"></canvas><div class="mgr-bub" aria-live="polite">' + esc(hostLines(b)[0]) + '</div></div>'; }
  function hostGo(b) { var el = $('mgHost'); if (!el || !window.AspieSprite) return; var c = el.querySelector('canvas'), x = c.getContext && c.getContext('2d'); if (!x) return;
    var F = AspieSprite.frames(3, '#1b1520', { hand: { item: 'as-cleaver', label: 'Meat cleaver' } }), f = 0, L = hostLines(b); HOST_I = 0;
    function draw() { var im = x.createImageData(32, 32); im.data.set(F[[0, 0, 1, 0, 0, 2, 0, 3][f % 8]].data); x.putImageData(im, 0, 0); f++; }
    draw(); clearInterval(HOST_T); HOST_T = setInterval(function () { if (!document.body.contains(c)) { clearInterval(HOST_T); return; } draw(); }, 420);
    function next() { HOST_I = (HOST_I + 1) % L.length; el.querySelector('.mgr-bub').textContent = L[HOST_I]; }
    el.onclick = next; el.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next(); } }; }
  function sprite(c, p, w) { try { if (window.V2Render && V2Render.lazy && V2Render.petFrames) V2Render.lazy(c, function () { return V2Render.petFrames(p, w); }, true); } catch (e) { } }
  function paintSprites(box, w) { box.querySelectorAll('[data-mg]').forEach(function (c) { var p = w.byId[c.getAttribute('data-mg')]; if (p) sprite(c, p, w); }); }
  /* meat spray + comic word out of the machine (display only) */
  function burst(mach, word, r) { if (!mach || RM) return; var i, c;
    for (i = 0; i < 12; i++) { c = document.createElement('i'); c.className = 'mgr-chunk'; var a = Math.PI * (0.55 + Math.random() * 0.9), d = 60 + Math.random() * 110;
      c.style.setProperty('--dx', Math.round(Math.cos(a) * d) + 'px'); c.style.setProperty('--dy', Math.round(-Math.sin(a) * d * 0.7 + 30) + 'px'); c.style.setProperty('--r', Math.round(Math.random() * 720) + 'deg');
      c.style.background = Math.random() < .3 ? '#ffd166' : '#e86a7d'; mach.appendChild(c); setTimeout(c.remove.bind(c), 900); }
    if (word) { var p = document.createElement('b'); p.className = 'mgr-pow'; p.textContent = word; p.style.left = (10 + Math.random() * 45) + '%'; p.style.top = (15 + Math.random() * 35) + '%'; p.style.setProperty('--r', (r || (Math.random() * 24 - 12)) + 'deg'); mach.appendChild(p); setTimeout(p.remove.bind(p), 750); } }
  /** parade(mach, w, ids, n, ms): the real pets of this grind fly into the hopper one by one (up to 24, spread across the whole pick), a counter counts them in */
  function parade(mach, w, ids, n, ms) { if (!mach || RM) return; var k = Math.min(24, n), step = ms / (k + 3), i, ctr = document.createElement('div'); ctr.className = 'mgr-ctr'; ctr.textContent = '0 / ' + fmt(n) + ' IN'; mach.appendChild(ctr);
    var hop = mach.querySelector('.mgr-pets'); if (hop) hop.style.visibility = 'hidden';
    for (i = 0; i < k; i++) (function (i) { var p = w.byId[ids[Math.floor(i * n / k)]]; if (!p) return; setTimeout(function () { if (!mach.isConnected) return;
      var c = document.createElement('canvas'); c.width = 32; c.height = 32; c.className = 'mgr-drop'; c.style.setProperty('--x', Math.round((Math.random() - 0.5) * 220) + 'px'); c.style.setProperty('--r', Math.round((Math.random() - 0.5) * 360) + 'deg');
      mach.appendChild(c); sprite(c, p, w); setTimeout(function () { c.remove(); burst(mach, i % 6 === 5 ? ['CHONK', 'BLORP', 'SPLORCH', 'GRRRIND'][(i / 6 | 0) % 4] : null); if (i % 2) sfx('munch'); ctr.textContent = fmt(Math.round((i + 1) * n / k)) + ' / ' + fmt(n) + ' IN'; }, 700); }, i * step); })(i); }
  /* browser-only discards: pets hidden in this browser that are not discarded on chain yet (the Grinder only takes on-chain discards) */
  function browserOnly(w) { var a = me(), set = V2Own.pileIds(a), n = 0; Object.keys(set).forEach(function (id) { var p = w.byId[id]; if (p && V2Own.isLiving(p, a) && V2Own.discarded(p, a, { set: set, pend: null }) === 'browser') n++; }); return n; }

  var bg = null;
  function close() { if (bg) bg.remove(); bg = null; document.removeEventListener('keydown', onKey);
    if (location.hash === '#grinder') try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { } }
  function onKey(e) { if (e.key === 'Escape') close(); }
  function shell(wide) { css(); close(); bg = document.createElement('div'); bg.className = 'mgr-bg'; bg.setAttribute('role', 'dialog'); bg.setAttribute('aria-modal', 'true'); bg.setAttribute('aria-labelledby', 'mgT');
    bg.innerHTML = '<div class="mgr' + (wide ? ' wide' : '') + '"></div>'; document.body.appendChild(bg); bg.onclick = function (e) { if (e.target === bg) close(); }; document.addEventListener('keydown', onKey); return bg.querySelector('.mgr'); }

  /** sum(list, n, before): what grinding the first n pets of the list gives (same math as V2Rules.grindPreview; the GRIND button asks the rules) */
  function sum(w, ids, n, before, b) { var G = G_(), meat = 0, by = [0, 0, 0, 0], i, p, t;
    for (i = 0; i < n && i < ids.length; i++) { p = w.byId[ids[i]]; if (!p) continue; t = Math.min(3, Math.max(0, p.tier | 0)); meat += G.MEAT[t]; by[t]++; }
    var after = before + meat;
    return { n: Math.min(n, ids.length), meat: meat, byTier: by, after: after, spins: Math.floor(after / G.SPIN_EVERY) - Math.floor(before / G.SPIN_EVERY),
      eggs: Math.floor(after / G.EGG_EVERY) - Math.floor(before / G.EGG_EVERY), goldPct: goldOdds(Math.min(n, ids.length), b) / 10000 }; }

  function open() { var d = D(), v = V(); if (!d || !d.world || !v.grindPreview) return; var w = d.world(), a = me(), box = shell(true), b = tipB(w), on = open_(w), G = G_();
    var R = (w.grind && a && w.grind[a]) || { meat: 0 }, meat = R.meat || 0;
    var mx = g2(b) ? keepGet() : 3, keepArg = mx < 3 ? mx : undefined, sp = specialName(w);
    var pv = on && a ? v.grindPreview(w, a, b, 0, keepArg) : { ok: false, n: 0, meat: 0, byTier: [0, 0, 0, 0], ids: [], why: on ? 'Connect your wallet to use the Grinder.' : 'The Meat Grinder opens soon.' };
    var ids = (pv.ids || []).slice(), max = ids.length, bo = a ? browserOnly(w) : 0, cost = v.grindPlan && on && a && pv.ok ? v.grindPlan(w, a, b, 0, keepArg).amount : G.COST;
    var can = pv.ok && !viewOnly() && !PREVIEW, n = max;
    var nextEgg = (Math.floor(meat / G.EGG_EVERY) + 1) * G.EGG_EVERY;
    var chips = [100, 500, 1000].filter(function (k) { return k < max; });
    box.innerHTML = '<button type="button" class="mgr-x" aria-label="Close">✕</button><span class="mgr-meatchip">MEAT ' + fmt(meat) + '</span>' +
      '<h3 id="mgT">THE MEAT <br>GRINDER<sup>®</sup></h3><p class="mgr-sub">Your junk goes in. Spins and Sausage Eggs come out.</p>' + host(b) +
      '<div class="mgr-cols"><div>' + machine(ids.slice(0, 6)) +
      '<div class="mgr-lbl"><span>MEAT METER</span><span id="mgNext">' + fmt(meat) + ' · next egg at ' + fmt(nextEgg) + '</span></div>' +
      '<div class="mgr-bar" id="mgBar"><div style="width:' + Math.round((meat % G.EGG_EVERY) / G.EGG_EVERY * 100) + '%"></div><div class="add" style="left:0;width:0"></div><span style="left:25%"></span><span style="left:50%"></span><span style="left:75%"></span></div>' +
      (bo ? '<div class="mgr-box">🗑️ ' + fmt(bo) + ' more pet' + (bo === 1 ? ' is' : 's are') + ' only hidden in this browser. Only permanent discards go in the Grinder. <button type="button" class="q" id="mgPerm">Make them permanent</button></div>' : '') +
      '</div><div>' +
      (g2(b) && on && a ? '<div class="mgr-amt mgr-keep"><h4>WHAT GOES IN?</h4><div class="mgr-chips">' + KEEP.map(function (k) { return '<button type="button" data-gkeep="' + k[0] + '" aria-pressed="' + (k[0] === mx) + '">' + k[1] + '</button>'; }).join('') + '</div>' +
        '<p class="mgr-small" style="margin:6px 0 0;opacity:.85">' + (mx < 3 ? 'Kept pets stay in your discard pile (for raising zombies, or a later grind).' : 'Saving Rares or Legendaries for zombies? Pick what stays out.') + '</p></div>' : '') +
      (pv.ok ? '<div class="mgr-amt"><h4><label for="mgN">HOW MANY?</label><output id="mgOut">' + fmt(n) + '</output></h4>' +
        (max > 1 ? '<input type="range" id="mgN" min="1" max="' + max + '" step="1" value="' + n + '" aria-describedby="mgOrder">' : '') +
        '<div class="mgr-chips">' + chips.map(function (k) { return '<button type="button" data-n="' + k + '" aria-pressed="false">' + fmt(k) + '</button>'; }).join('') +
        '<button type="button" data-n="' + max + '" aria-pressed="true">All ' + fmt(max) + '</button></div>' +
        '<div class="mgr-tiers" id="mgTiers"></div>' +
        '<p class="mgr-small" id="mgOrder" style="margin:6px 0 0;opacity:.85">Oldest discards go in first (lowest pet numbers). ' + (max >= G.MAX ? 'Up to ' + fmt(G.MAX) + ' per grind: the rest wait for the next one.' : 'That is every pet in your discard pile that can go in.') + '</p></div>' +
        '<div class="mgr-get"><div><b id="mgMeat">0</b><small>meat</small></div><div><b id="mgSpins">0</b><small>Pepe Wheel spins</small></div><div><b id="mgEggs">0</b><small>Sausage Eggs</small></div></div>' +
        '<div class="mgr-box gd" id="mgGold"></div>'
        : '<div class="mgr-box">' + esc(pv.why || 'Nothing to grind.') + '<br><span class="mgr-small">Discard pets you don’t want (🗑️ on My Pets), then come back.</span></div>') +
      '<button type="button" class="mgr-go"' + (can ? '' : ' disabled') + '>GRIND ' + fmt(n || 0) + ' PET' + (n === 1 ? '' : 'S') + '</button>' +
      '<p class="mgr-small" style="margin:8px 0 0;opacity:.85">One burn, ' + fmt(cost) + ' XCPETS. Ground pets are gone for good. Gods, Mythics, Wizards and tokenized pets never go in.' + (viewOnly() ? ' View only: nothing can be ground from here.' : '') + '</p>' +
      '<div class="mgr-small mgr-how">Every ' + fmt(G.SPIN_EVERY) + ' meat: a free Pepe Wheel spin. Every ' + fmt(G.EGG_EVERY) + ': a Sausage Egg (never Common' + (g2(b) ? ', and 1 in ' + ((V().GRIND2 || {}).SPECIAL_IN || 77) + ' is ' + esc(sp) : '') + '). Meat per pet: Common ' + G.MEAT[0] + ', Uncommon ' + G.MEAT[1] + ', Rare ' + G.MEAT[2] + ', Legendary ' + G.MEAT[3] + '.</div>' +
      '<button type="button" class="mgr-no">Not now</button></div></div>';
    paintSprites(box, w);
    var mach = box.querySelector('.mgr-mach'), go = box.querySelector('.mgr-go'), rng = $('mgN');
    function paint(k) { n = Math.max(1, Math.min(max, k | 0)); var s = sum(w, ids, n, meat, b);
      $('mgOut').textContent = fmt(n); if (rng && +rng.value !== n) rng.value = n;
      box.querySelectorAll('.mgr-chips button[data-n]').forEach(function (c) { c.setAttribute('aria-pressed', +c.getAttribute('data-n') === n ? 'true' : 'false'); });
      $('mgTiers').innerHTML = s.byTier.map(function (c, i) { return c ? '<span style="color:' + TC[i] + '">' + fmt(c) + ' ' + T[i] + '</span>' : ''; }).join('');
      $('mgMeat').textContent = fmt(s.meat); $('mgSpins').textContent = '+' + fmt(s.spins); $('mgEggs').textContent = '+' + fmt(s.eggs);
      var gp = Math.round(s.goldPct * 10) / 10, gmax = goldOdds(G.MAX, b) / 10000;
      $('mgGold').innerHTML = '🌭✨ <b style="color:#ffd166">' + gp + '% shot at a GOLDEN SAUSAGE</b> ' + (g2(b) ? '= a sure Legendary <b style="color:#ffd166">' + esc(sp) + '</b>!' : '(a sure Legendary).') + (gp < gmax ? ' <span class="mgr-small">More pets in one grind = a better shot, up to ' + gmax + '% at ' + fmt(G.MAX) + ' pets.</span>' : ' <span class="mgr-small">Best shot there is.</span>');
      var bar = $('mgBar'), fill = (meat % G.EGG_EVERY) / G.EGG_EVERY * 100, add = Math.min(100 - fill, s.meat / G.EGG_EVERY * 100);
      if (bar) { var ad = bar.querySelector('.add'); ad.style.left = fill + '%'; ad.style.width = add + '%'; }
      $('mgNext').textContent = fmt(meat) + ' → ' + fmt(s.after);
      go.textContent = 'GRIND ' + fmt(n) + ' PET' + (n === 1 ? '' : 'S'); }
    hostGo(b); /* ASPIE greets the player (display only) */
    if (pv.ok) { paint(n);
      var raf = 0; if (rng) rng.addEventListener('input', function () { if (raf) return; raf = requestAnimationFrame(function () { raf = 0; paint(+rng.value); }); });
      box.querySelectorAll('.mgr-chips button[data-n]').forEach(function (c) { c.onclick = function () { paint(+c.getAttribute('data-n')); sfx('blip'); }; }); }
    box.querySelectorAll('.mgr-chips button[data-gkeep]').forEach(function (c) { c.onclick = function () { keepSet(+c.getAttribute('data-gkeep')); sfx('blip'); open(); }; });
    box.querySelector('.mgr-no').onclick = close; box.querySelector('.mgr-x').onclick = close;
    var pm = box.querySelector('#mgPerm'); if (pm) pm.onclick = function () { close(); var m = $('hdMigrate'); if (m) m.click(); else if (U().toast) U().toast('Open the 🗑️ Discard pile at the bottom of My Pets and press "Make my browser discards permanent".'); };
    go.onclick = function () { if (!can) return; var plan = v.grindPlan(w, a, tipB(w), n < G.MAX ? n : 0, keepArg); if (!plan || !plan.ok) return;
      var cp = d.confirmPlans || U().confirmPlans; if (!cp) return;
      /* Nov 24 2026 (one safety check for every pet button): special pets in this grind (Legendary, starred, recently fed...) get the same
         sheet as zombie meals and offerings. All-or-nothing: the Grinder takes the pets in its own order, so one can't be left out here. */
      if (window.V2SacGuard && !go._sg) { var gx = (plan.ids || ids.slice(0, plan.n)).slice(); return V2SacGuard.check({ w: w, ids: gx, me: a, verb: 'grind them', all: true,
        allNote: g2(b) ? 'To keep them, cancel and pick "Keep Legendaries" or "Keep Rares + Legendaries" under What goes in?, or use "Add discarded pets back" in the Discard pile.' : 'To keep one, cancel and use "Add discarded pets back" in the Discard pile first.',
        onGo: function () { go._sg = true; try { go.onclick(); } finally { go._sg = false; } } }); }
      go.disabled = true; mach.classList.add('go');
      /* the wind-up: the real pets of this grind fly in one by one, the crank whirs, meat sprays (about 3 s), then the normal sign sheet */
      var t0 = RM ? 0 : 3000; mach.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); parade(mach, w, plan.ids || ids, plan.n, t0 - 700);
      setTimeout(function () { close(); cp('🥩 Meat Grinder: ' + fmt(plan.n) + ' pet' + (plan.n === 1 ? '' : 's') + ' → ' + fmt(plan.meat) + ' meat', [{ tag: plan.tag, amount: plan.amount, label: plan.label }], function () { if (U().toast) U().toast('🥩 Into the Grinder! Your spins and Sausage Eggs pop out when the burn confirms.', 8000); }); }, t0); }; }

  /* the SPLORCH show, once per confirmed grind of this wallet */
  function seenKey() { return 'xcpets-grind-seen-' + net() + '-' + (me() || ''); }
  function eggSvg(gold) { return '<svg aria-hidden="true" width="52" height="52" viewBox="0 0 52 52"><ellipse cx="26" cy="28" rx="17" ry="21" fill="' + (gold ? '#ffd166' : '#e86a7d') + '" stroke="#000" stroke-width="3"/><ellipse cx="20" cy="20" rx="4" ry="7" fill="#fff" opacity=".45"/><path d="M12 30q7 4 14 0t14 0" stroke="#000" stroke-width="2" fill="none" opacity=".5"/></svg>'; }
  function result(w, last) { var box = shell(false), G = G_(), a = me(), R = w.grind[a], pets = (last.newPets || []).map(function (id) { return w.byId[id]; }).filter(Boolean);
    var before = Math.max(0, (R.meat || 0) - (last.meat || 0)), rows = [];
    if (last.spins) rows.push('<div class="mgr-rw sp hide" data-k="spin"><svg aria-hidden="true" width="52" height="52" viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" fill="#ffd166" stroke="#000" stroke-width="3"/><path d="M22 3v38M3 22h38M8 8l28 28M36 8L8 36" stroke="#000" stroke-width="2"/><circle cx="22" cy="22" r="5" fill="#ff4d4d" stroke="#000" stroke-width="2"/></svg><div><b>+' + last.spins + ' PEPE WHEEL SPIN' + (last.spins === 1 ? '' : 'S') + '</b><span class="mgr-small">Saved for the Pepe Wheel in The Rare Room.</span></div></div>');
    pets.forEach(function (p) { var t = Math.min(3, p.tier | 0); rows.push('<div class="mgr-rw ' + (p.golden ? 'gold' : 'egg') + ' hide" data-k="egg" data-t="' + (SPECIAL_SP[p.species] ? 4 : t) + '" style="--tc:' + (SPECIAL_SP[p.species] ? '#ff8ad8' : TC[t]) + '"><div class="mgr-egg">' + eggSvg(p.golden) + '<canvas width="32" height="32" data-mg="' + p.id + '"></canvas></div><div><b>' + (p.golden ? 'GOLDEN SAUSAGE!' : SPECIAL_SP[p.species] ? (p.species === 'aspie' ? 'SAUSAGE EGG: ASPIE!' : 'SAUSAGE EGG: SPECIAL EGG!') : 'SAUSAGE EGG: ' + T[t].toUpperCase()) + '</b><span class="mgr-small">#' + p.id + ' hatched: ' + T[t] + ' ' + esc(p.name || p.species) + '</span></div></div>'); });
    if (!last.golden) rows.push('<div class="mgr-rw miss hide" data-k="miss"><svg aria-hidden="true" width="52" height="52" viewBox="0 0 44 44"><ellipse cx="22" cy="24" rx="15" ry="18" fill="#c9a43a" stroke="#000" stroke-width="3"/><path d="M14 18l16 14M30 18L14 32" stroke="#000" stroke-width="3"/></svg><div><b>GOLDEN SAUSAGE: NOT THIS TIME</b><span class="mgr-small">Grind more at once for a better shot (up to ' + (G.GOLD_MAX / 10000) + '%).</span></div></div>');
    box.innerHTML = '<button type="button" class="mgr-skip">Skip ⏩</button><div class="mgr-big" id="mgT">SPLORCH!</div>' +
      '<div class="mgr-rope" aria-hidden="true"><i>' + new Array(12).join('<span></span>') + '</i></div>' +
      '<p class="mgr-count"><b id="mgPets">0</b> pets → <b id="mgCnt">0</b> meat</p>' +
      '<div class="mgr-lbl"><span>MEAT METER</span><span id="mgMet">' + fmt(before) + '</span></div><div class="mgr-bar" id="mgBar"><div style="width:' + ((before % G.EGG_EVERY) / G.EGG_EVERY * 100) + '%;transition:width .9s steps(10)"></div><span style="left:25%"></span><span style="left:50%"></span><span style="left:75%"></span></div>' +
      rows.join('') +
      '<p class="mgr-small" style="text-align:center">Meat now ' + fmt(R.meat) + ' · next Sausage Egg at ' + fmt((Math.floor(R.meat / G.EGG_EVERY) + 1) * G.EGG_EVERY) + '</p>' +
      (pets.length ? '<button type="button" class="mgr-go" id="mgSee" style="background:#3ddc84;color:#06210f;text-shadow:none">SEE MY NEW PET' + (pets.length > 1 ? 'S' : '') + '</button>' : '') + '<button type="button" class="mgr-no">Nice</button>';
    paintSprites(box, w);
    var timers = [], done = false;
    function later(f, ms) { timers.push(setTimeout(f, ms)); }
    function showAll() { if (done) return; done = true; timers.forEach(clearTimeout); var sk = box.querySelector('.mgr-skip'); if (sk) sk.remove();
      $('mgPets').textContent = fmt(last.n); $('mgCnt').textContent = fmt(last.meat); $('mgMet').textContent = fmt(R.meat);
      box.querySelector('#mgBar>div').style.width = ((R.meat % G.EGG_EVERY) / G.EGG_EVERY * 100) + '%';
      box.querySelectorAll('.mgr-rw.hide').forEach(function (r) { r.classList.remove('hide'); }); box.querySelectorAll('.mgr-egg').forEach(function (e) { e.classList.add('open'); }); }
    box.querySelector('.mgr-skip').onclick = showAll;
    box.querySelector('.mgr-no').onclick = close; var see = box.querySelector('#mgSee'); if (see) see.onclick = function () { close(); location.href = 'pet.html?id=' + pets[0].id; };
    if (RM) { showAll(); sfx('reveal', 2); return; }
    /* 1) count up: pets and meat (about 1.2 s, munch sounds) */
    var steps = 16; for (var i = 1; i <= steps; i++) later(function (i) { $('mgPets').textContent = fmt(Math.round(last.n * i / steps)); $('mgCnt').textContent = fmt(Math.round(last.meat * i / steps)); if (i % 4 === 0) sfx('munch'); }.bind(null, i), 200 + i * 70);
    /* 2) the meter fills (a full egg wraps around) */
    later(function () { var bar = box.querySelector('#mgBar>div'); bar.style.width = (last.eggs ? 100 : ((R.meat % G.EGG_EVERY) / G.EGG_EVERY * 100)) + '%'; $('mgMet').textContent = fmt(R.meat); }, 1500);
    if (last.eggs) later(function () { var bar = box.querySelector('#mgBar>div'); bar.style.transition = 'none'; bar.style.width = '0%'; void bar.offsetWidth; bar.style.transition = 'width .6s steps(8)'; bar.style.width = ((R.meat % G.EGG_EVERY) / G.EGG_EVERY * 100) + '%'; }, 2500);
    /* 3) the prizes, one at a time: eggs wobble, then crack open with their rarity sound */
    var t = last.eggs ? 3200 : 2500;
    box.querySelectorAll('.mgr-rw.hide').forEach(function (r) { var k = r.getAttribute('data-k'), tier = +r.getAttribute('data-t') || 0;
      later(function () { r.classList.remove('hide'); r.classList.add('in'); r.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); sfx(k === 'miss' ? 'sad' : k === 'spin' ? 'coin' : 'knock'); }, t);
      if (k === 'egg') { later(function () { var e = r.querySelector('.mgr-egg'); if (e) e.classList.add('open'); sfx('crack'); sfx('reveal', r.classList.contains('gold') ? 4 : Math.min(4, tier)); }, t + 1000); t += 1700; } else t += 900; });
    later(function () { done = true; var sk = box.querySelector('.mgr-skip'); if (sk) sk.remove(); if (last.golden) sfx('fanfare'); }, t); }
  function watch(w) { var a = me(); if (!a || !w || !w.grind || !w.grind[a] || !w.grind[a].last || viewOnly()) return; var last = w.grind[a].last, k = String(last.block) + ':' + last.n, seen = null;
    try { seen = localStorage.getItem(seenKey()); } catch (e) { }
    if (seen === k) return; try { localStorage.setItem(seenKey(), k); } catch (e) { }
    if (seen == null && w.tip - last.block > 144) return; /* a new browser: don't replay old grinds */ if (!bg) result(w, last); }

  /* play.html#grinder (🗺️ Places → 🥩 The Meat Grinder): open once My Pets has finished loading, so the hopper holds every discard */
  var wantHash = false;
  function settled(w) { if (!w || w.pending) return false; var pg = w._pages; return !(pg && !w._full && (pg.got || 1) < (pg.pages || 1)); }
  function fromHash(w) { if (!wantHash || bg) return; if (!(open_(w) || PREVIEW)) return; if (me() && !settled(w)) return; wantHash = false; open(); }
  function place() { var d = D(); if (!d || !d.world) return; var w; try { w = d.world(); } catch (e) { return; } if (!w || !w.pets) return;
    var show = open_(w) || PREVIEW, b = $('mgOpen');
    if (!show) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('button'); b.type = 'button'; b.className = 'q'; b.id = 'mgOpen'; b.onclick = open; }
    var a = me(), R = (w.grind && a && w.grind[a]) || null; b.textContent = '🥩 Meat Grinder' + (R && R.meat ? ' (' + fmt(R.meat) + ' meat)' : ''); b.title = 'Grind your discarded pets into spins and Sausage Eggs';
    var care = $('mpcCare'), anc = $('bulkAnchor'), cp = $('cpOpen');
    if (care) { if (b.parentNode !== care) care.insertBefore(b, cp && cp.parentNode === care ? cp.nextSibling : ($('mpcNext') && $('mpcNext').parentNode === care ? $('mpcNext') : null)); }
    else if (anc && anc.parentNode && b.parentNode !== anc.parentNode) anc.parentNode.insertBefore(b, anc.nextSibling);
    try { fromHash(w); } catch (e) { }
    try { watch(w); } catch (e) { } }
  var tick = 0;
  function onHash() { if (location.hash !== '#grinder') return; wantHash = true; place();
    /* check every second until it opens (the 4 s repaint is too slow for a link tap) */
    clearInterval(tick); var k = 0; tick = setInterval(function () { if (!wantHash || ++k > 120) { clearInterval(tick); return; } place(); }, 1000); }
  function init() { if (!$('bulkAnchor') && !$('petsPanel')) return; place(); setInterval(place, 4000); window.addEventListener('hashchange', onHash); onHash(); }
  window.V2Grinder = { open: open, place: place, result: result, parade: parade };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
