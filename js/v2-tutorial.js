/* player-tutorial (PREVIEW, owner ask Oct 25 2026): the The Big Beautiful Tutorial (tutorial.html), first-visit welcome, ?tutorial deep link,
 * Play page coach marks (spotlight + pointing hand), Keeper Quests + day streak flame, and first-time tips.
 * DISPLAY ONLY: reads the replayed world, never burns, never changes a rule, gives nothing with in-game value.
 * Numbers: N below mirrors js/v2-rules.js + js/pet-core.js; tools/tests/tutorial.test.js checks every one against the real rules. */
(function () {
  'use strict';
  var N = {
    hatch: 69, hatch12: 690, hatch144: 6900, hatchzap: 100000, roll: 345, fight: 690, breed: 135, croll: 690,
    tiers: [['Common', 6000, 0], ['Uncommon', 2700, 3], ['Rare', 1000, 6], ['Legendary', 300, 10]],
    stages: ['Egg', 'Hatchling', 'Juvenile', 'Adult', 'Elder', 'Mythic'], thresholds: [0, 69, 8349, 22149, 41469, 69069],
    meals: [4140, 6900, 9660, 9200], blocksPerDay: 144, neglectedAfter: 3, deathAfter: 7, mythicLine: 21000,
    breedCooldown: 1008, breedCap: 6, blackEye: 72, fightWindow: 144, turns: 12,
    /* tutorial-cemetery (owner ask Oct 30 2026): the cemetery gate mirrored from js/v2-rules.js (tutorial.html does not load the rules);
     * cemPublic null = OWNER TEST (only grave #cemOwnerGrave by cemOwner). tools/tutorial-test.js checks these against the rules. */
    cemGate: 973772, cemPublic: null, cemOwnerGrave: 2, cemOwner: 'bc1ps9av86ymmlzy9zj3a8pn6g94pz4j5e0kagv3td3wutaagfjvekjs26m3s4',
    cemPool: 144, cemFeral: 432, cemCap: 3, cemRipe: 1.5
  };
  var SEEN = 'xcpets-tut-seen', DONE = 'xcpets-tut-done', TIPS = 'xcpets-tut-tips';
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function jget(k) { try { return JSON.parse(ls(k) || '{}') || {}; } catch (e) { return {}; } }
  function fmt(n) { return Number(n).toLocaleString('en-US', { maximumFractionDigits: 8 }); }
  function half(n) { return fmt(n / 2); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  /* cemetery raise steps: open to this viewer? 'open' (public launch reached), 'owner' (owner test, owner wallet saved in this browser), else 'soon' */
  var TIP = null;
  function cemState() {
    var R = typeof window !== 'undefined' && window.V2Rules, pub = R && R.cemPublicBlock ? R.cemPublicBlock() : N.cemPublic;
    if (pub != null && TIP != null && TIP >= pub) return 'open';
    var me = ls('xcpets-v2-me') || ls('xcpets-xcpwallet-address'); return me && me === N.cemOwner ? 'owner' : 'soon';
  }
  function cemNote(short) {
    var st = cemState();
    if (st === 'open') return '';
    if (short) return '<br><span class="small">🧪 ' + (st === 'owner' ? 'Owner test: grave #' + N.cemOwnerGrave + ' only.' : '<b>Opens soon.</b>') + '</span>';
    if (st === 'owner') return '<br><span class="small">🧪 Owner test: for now only grave #' + N.cemOwnerGrave + ' can be raised, and only by your wallet.</span>';
    return '<br><span class="small">🧪 <b>Opens soon.</b> Raising is in a test right now. These steps show how it will work.</span>';
  }
  function sfx(n) { try { if (window.V2Sfx && V2Sfx[n]) V2Sfx[n](); } catch (e) {} }
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- sprites: real in-game art from PetCore (never Nakamoto or Wizard) ---------- */
  var cache = {};
  function frames(species, stage, tier) {
    var k = species + ':' + stage + ':' + (tier || ''); if (cache[k]) return cache[k];
    if (!window.PetCore) return null;
    var pet = PetCore.characterPet(species, tier ? { tier: tier } : {});
    return (cache[k] = PetCore.renderFrames(pet, { stage: stage }));
  }
  var anims = [];
  function sprite(species, stage, tier, cls) {
    var c = document.createElement('canvas'); c.width = 32; c.height = 32; c.className = 'tut-px' + (cls ? ' ' + cls : '');
    c.setAttribute('role', 'img'); c.setAttribute('aria-label', species + ' ' + N.stages[stage]);
    c._f = frames(species, stage, tier); c._i = 0; paint(c); anims.push(c); return c;
  }
  function paint(c) { if (!c._f) return; var f = c._f[c._i % c._f.length], ctx = c.getContext('2d'), d = ctx.createImageData(32, 32); d.data.set(f.data); ctx.putImageData(d, 0, 0); }
  if (typeof document !== 'undefined') setInterval(function () { if (reduce) return; anims = anims.filter(function (c) { return c.isConnected; }); anims.forEach(function (c) { c._i++; paint(c); }); }, 220);
  function guide(text, small) {
    var g = el('div', 'tut-guide'); g.appendChild(sprite('peepo', 3)); g.appendChild(el('div', 'tut-bubble', text)); return g;
  }

  /* ---------- celebrations ---------- */
  function burst(x, y, n) {
    if (reduce) return; var cols = ['#ffd24a', '#5ad16a', '#ff5a5a', '#6ab8ff', '#fff'];
    for (var i = 0; i < (n || 24); i++) (function () {
      var b = el('div', 'tut-burst'); b.style.left = x + 'px'; b.style.top = y + 'px'; b.style.background = cols[i % cols.length]; document.body.appendChild(b);
      var a = Math.random() * Math.PI * 2, r = 40 + Math.random() * 90;
      b.animate([{ transform: 'translate(0,0)', opacity: 1 }, { transform: 'translate(' + Math.cos(a) * r + 'px,' + (Math.sin(a) * r + 40) + 'px)', opacity: 0 }], { duration: 700 + Math.random() * 400, easing: 'cubic-bezier(.2,.7,.4,1)' }).onfinish = function () { b.remove(); };
    })();
  }
  function cheer(target) { var r = (target || document.body).getBoundingClientRect(); burst(r.left + r.width / 2, r.top + Math.min(r.height, 300) / 2); sfx('coin'); }

  /* ---------- practice demos (clearly labelled PRACTICE; nothing here touches the chain) ---------- */
  function demoBox(title) { var d = el('div', 'tut-demo'); d.appendChild(el('span', 'tut-tag', 'PRACTICE')); if (title) d.appendChild(el('div', 'tut-h', title)); return d; }
  function rollTier() { var r = Math.floor(Math.random() * 10000), a = 0; for (var i = 0; i < 4; i++) { a += N.tiers[i][1]; if (r < a) return i; } return 0; }
  var HATCHABLE = [['pepe', 0], ['wojak', 0], ['chud', 0], ['peepo', 0], ['doge', 0], ['bobo', 1], ['mumu', 1], ['sarutobi', 1], ['lenny', 1], ['snibby', 2], ['kevin', 2], ['dodo', 3]];
  var DEMOS = {
    hatch: function () {
      var d = demoBox('Crack a practice egg'), box = el('div', 'tut-egg'), egg = sprite('pepe', 0), out = el('div', 'tut-body', 'Tap the egg.');
      box.appendChild(egg); d.appendChild(box); d.appendChild(out); egg.style.cursor = 'pointer'; egg.tabIndex = 0;
      function go() {
        if (egg._busy) return; egg._busy = 1; egg.classList.add('tut-shake'); sfx('creak');
        setTimeout(function () {
          var t = rollTier(), pool = HATCHABLE.filter(function (s) { return s[1] <= t; }), sp = pool[Math.floor(Math.random() * pool.length)][0];
          var nc = sprite(sp, 1, N.tiers[t][0].toLowerCase()); box.innerHTML = ''; box.appendChild(nc);
          out.innerHTML = '<b>' + N.tiers[t][0] + '</b> ' + sp.toUpperCase() + '! (' + (N.tiers[t][1] / 100) + '% of eggs are ' + N.tiers[t][0] + ', +' + N.tiers[t][2] + ' stat points.) Tap again for another practice egg.';
          cheer(box); if (t >= 2) { burst(innerWidth / 2, 120, 60); sfx('roar'); }
          nc.style.cursor = 'pointer'; nc.onclick = function () { box.innerHTML = ''; egg = sprite('pepe', 0); egg.style.cursor = 'pointer'; egg.onclick = go; box.appendChild(egg); out.textContent = 'Tap the egg.'; };
        }, 750);
      }
      egg.onclick = go; egg.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') go(); };
      return d;
    },
    feed: function () {
      var d = demoBox('Trainer pet: feed it'), st = { care: 69, day: 1, missed: 0, fed: false, dead: false };
      var fig = el('div', 'tut-stage'), meter = el('div', 'tut-meter', '<i></i>'), info = el('div', 'tut-body'), row = el('div', 'tut-row');
      row.style.justifyContent = 'center';
      var bf = el('button', 'btn ico-flame', 'Feed today'), bs = el('button', 'q', 'Sleep to next day ⏭'), br = el('button', 'q', 'Reset');
      row.appendChild(bf); row.appendChild(bs); row.appendChild(br); d.appendChild(fig); d.appendChild(meter); d.appendChild(info); d.appendChild(row);
      function stage() { for (var s = 5; s >= 0; s--) if (st.care >= N.thresholds[s]) return s; return 0; }
      function draw() {
        var s = stage(); fig.innerHTML = ''; var f = el('figure'); f.appendChild(st.dead ? el('div', 'tut-big', '🪦') : sprite('pepe', s)); f.appendChild(el('div', '', st.dead ? 'Cemetery' : N.stages[s])); fig.appendChild(f);
        var nx = N.thresholds[Math.min(5, s + 1)], pv = N.thresholds[s]; meter.firstChild.style.width = (s >= 5 ? 100 : Math.round((st.care - pv) / (nx - pv) * 100)) + '%';
        var mood = st.dead ? 'It went 7 days without a meal and passed on to the Pet Cemetery. (Mythic pets never starve.)' : st.missed >= N.neglectedAfter ? '<b>Neglected!</b> ' + st.missed + ' days unfed: it cannot battle or breed. 7 days and it dies.' : st.fed ? 'Fed for today. Come back tomorrow.' : st.missed ? '<b>Hungry.</b> ' + st.missed + ' day(s) without a meal.' : 'Hungry. Feed it once this chain day.';
        info.innerHTML = 'Day ' + st.day + ' · ' + fmt(st.care) + ' care' + (s < 5 ? ' (next stage at ' + fmt(nx) + ')' : ' · Mythic!') + '<br>' + mood;
        bf.disabled = st.fed || st.dead || s >= 5;
        bf.textContent = s >= 5 ? 'Mythic: no more meals needed' : st.fed ? 'Fed today ✓' : 'Feed today (+' + fmt(N.meals[Math.max(0, s - 1)]) + ' care)';
      }
      bf.onclick = function () { var before = stage(); st.care += N.meals[Math.max(0, stage() - 1)]; st.fed = true; st.missed = 0; sfx('blip'); if (stage() > before) { cheer(fig); } draw(); };
      bs.onclick = function () { if (st.dead) return; st.day++; if (!st.fed && stage() < 5) st.missed++; st.fed = false; if (st.missed >= N.deathAfter) { st.dead = true; sfx('bell'); } draw(); };
      br.onclick = function () { st = { care: 69, day: 1, missed: 0, fed: false, dead: false }; draw(); };
      draw(); return d;
    },
    grow: function () {
      var d = demoBox('The stage line'), row = el('div', 'tut-stage');
      for (var s = 0; s <= 5; s++) { var f = el('figure'); f.appendChild(sprite('doge', s)); f.appendChild(el('div', '', N.stages[s] + '<br>' + fmt(N.thresholds[s]))); row.appendChild(f); }
      d.appendChild(row); d.appendChild(el('div', 'tut-body small', 'Care needed for each stage. Mythic pets wear a gold aura.')); return d;
    },
    battle: function () {
      var d = demoBox('Practice battle'), ar = el('div', 'tut-fight'), log = el('div', 'tut-log', 'Two practice Adults. Press Fight.'), go = el('button', 'btn', 'Fight! (practice)');
      var A = { n: 'Your Pepe', sp: 'pepe', st: { vigor: 18, spark: 16, grit: 14, zoom: 12, luck: 10 }, gear: 2 }, B = { n: 'Rival Chud', sp: 'chud', st: { vigor: 16, spark: 14, grit: 18, zoom: 10, luck: 8 }, gear: 1 };
      [A, B].forEach(function (p, i) {
        p.max = 40 + p.st.vigor * 2 + p.st.grit + 3 * 6; var f = el('figure', i ? 'r' : ''); p.c = sprite(p.sp, 3); f.appendChild(p.c);
        p.bar = el('div', 'tut-meter tut-hp', '<i style="width:100%"></i>'); f.appendChild(el('div', '', esc(p.n))); f.appendChild(p.bar); p.lab = el('div', '', ''); f.appendChild(p.lab); p.fig = f; f.style.position = 'relative'; ar.appendChild(f);
      });
      d.appendChild(ar); d.appendChild(log); d.appendChild(go);
      d.appendChild(el('div', 'tut-body small', 'Same math as the real arena: HP = 40 + vigor times 2 + grit + stage times 6. A hit does 4 + spark/3 + gear power + 0 to 7, minus the defender\'s grit/6.'));
      function hp(p) { p.bar.firstChild.style.width = Math.max(0, p.hp / p.max * 100) + '%'; p.lab.textContent = Math.max(0, p.hp) + ' / ' + p.max + ' HP'; }
      [A, B].forEach(function (p) { p.hp = p.max; hp(p); });
      go.onclick = function () {
        go.disabled = true; [A, B].forEach(function (p) { p.hp = p.max; hp(p); });
        var first = A.st.zoom >= B.st.zoom ? [A, B] : [B, A], t = 0;
        (function turn() {
          if (t >= N.turns || A.hp <= 0 || B.hp <= 0) {
            var win = A.hp / A.max >= B.hp / B.max ? A : B; log.innerHTML = '<b>' + esc(win.n) + ' wins!</b> ' + (win === A ? 'In the real arena the loser gives up a worn gear piece and gets a black eye.' : 'Practice loss. Feed, grow and gear up, then try again.');
            if (win === A) { cheer(A.fig); sfx('roar'); } go.disabled = false; go.textContent = 'Fight again (practice)'; return;
          }
          var at = first[t % 2], df = first[(t + 1) % 2]; t++;
          var dodge = Math.random() * 100 < Math.floor(df.st.zoom / 5), dmg = Math.max(1, 4 + Math.floor(at.st.spark / 3) + at.gear + Math.floor(Math.random() * 8) - Math.floor(df.st.grit / 6)), crit = Math.random() * 100 < 5 + Math.floor(at.st.luck / 4);
          if (crit) dmg *= 2;
          at.c.style.transform = (at === B ? 'scaleX(-1) ' : '') + 'translateX(' + (at === A ? 14 : 14) + 'px)'; setTimeout(function () { at.c.style.transform = at === B ? 'scaleX(-1)' : ''; }, 150);
          if (dodge) { log.textContent = df.n + ' dodges!'; sfx('flip'); }
          else { df.hp -= dmg; hp(df); df.c.classList.remove('tut-hit'); void df.c.offsetWidth; df.c.classList.add('tut-hit'); sfx('punch'); var n = el('div', 'tut-dmg', (crit ? 'CRIT ' : '') + '-' + dmg); n.style.left = '40%'; n.style.top = '10px'; df.fig.appendChild(n); setTimeout(function () { n.remove(); }, 800); log.textContent = at.n + (crit ? ' lands a CRIT for ' : ' hits for ') + dmg + '.'; }
          setTimeout(turn, reduce ? 150 : 650);
        })();
      };
      return d;
    },
    breed: function () {
      var d = demoBox('Practice breeding'), row = el('div', 'tut-stage'), out = el('div', 'tut-body', 'Two practice Adults: a Pepe and a Doge.'), go = el('button', 'btn ico-egg', 'Breed (practice)');
      var a = el('figure'), b = el('figure'), mid = el('figure', '', '<div class="tut-big">+</div>'), kid = el('figure');
      a.appendChild(sprite('pepe', 3)); a.appendChild(el('div', '', 'Pepe')); b.appendChild(sprite('doge', 3)); b.appendChild(el('div', '', 'Doge'));
      [a, mid, b, kid].forEach(function (x) { row.appendChild(x); }); d.appendChild(row); d.appendChild(out); d.appendChild(go);
      go.onclick = function () {
        kid.innerHTML = ''; var egg = sprite('pepe', 0, null, 'tut-shake'); kid.appendChild(egg); sfx('creak');
        setTimeout(function () {
          var r = Math.random(), twins = Math.random() < 1 / 50, odd = Math.random() < 0.05;
          kid.innerHTML = ''; if (r < 0.684773435) { kid.appendChild(el('div', 'tut-big', '🧬')); kid.appendChild(el('div', '', 'HYBRID')); out.innerHTML = '<b>A hybrid!</b> Different species make a hybrid about 68.5% of the time. On the real Play page the baby mixes both parents\' looks.'; }
          else { var sp = Math.random() < 0.5 ? 'pepe' : 'doge'; kid.appendChild(sprite(sp, 1)); kid.appendChild(el('div', '', sp.toUpperCase())); out.innerHTML = '<b>A pure ' + sp.toUpperCase() + '.</b> The rest of the time the baby takes after one parent.'; }
          if (twins) out.innerHTML += ' <b>Twins!</b> (1 in 50)'; if (odd) out.innerHTML += ' Rare eyes showed up!';
          cheer(kid);
        }, 800);
      };
      return d;
    }
  };

  /* ---------- the The Big Beautiful Tutorial chapters ---------- */
  var CH = [
    { id: 'welcome', ico: '🐸', t: 'What is XCPETS', s: 'Pixel pets on Bitcoin', steps: [
      ['Welcome, keeper!', 'XCPETS is a pixel pet game on Bitcoin. You hatch pets, feed them, grow them, battle and breed them.'],
      ['Every move is a burn', 'Each action is a small burn of XCPETS that you sign in your own wallet. No server, no account: the game rebuilds every pet from public Bitcoin history, so everyone sees the same pets.']],
      quiz: [['How does the game know what your pets did?', ['It replays public burns on Bitcoin', 'A company server saves it', 'Your browser makes it up'], 0]] },
    { id: 'wallet', ico: '👛', t: 'Wallet & XCPETS', s: 'Get ready to play', steps: [
      ['Get a wallet', 'Install <b>XCP Wallet</b> (desktop Chrome extension). It holds your XCPETS and signs every burn.'],
      ['Get XCPETS', 'Get XCPETS on xcp.fun, plus a little BTC for network fees.'],
      ['Connect', 'On the Play page press <b>Connect wallet</b>. Your pets show up under My Pets.']],
      quiz: [['What else do you need besides XCPETS?', ['A little BTC for fees', 'An email account', 'Nothing'], 0]] },
    { id: 'hatch', ico: '🥚', t: 'Hatching', s: 'Crack eggs, roll rarity', demo: 'hatch', steps: [
      ['Crack an egg', 'Each egg is a small XCPETS burn. You can crack one egg, a Crack Pack of 12 or a Yolk Booster Box of 144. The Play page shows the live amount for each.'],
      ['Rarity tiers', 'Common 60%, Uncommon 27%, Rare 10%, Legendary 3%. Higher tiers get bonus stats and unlock rarer species, like Snibby and KEVIN (Rare) and Dodo (Legendary only).', 'hatch'],
      ['1 in 777', 'About 1 in 777 eggs is a special community-pet egg. It is always Rare or Legendary.']],
      quiz: [['How often is an egg Legendary?', ['3%', '27%', '50%'], 0], ['Which species is Legendary only?', ['Dodo', 'Pepe', 'Doge'], 0]] },
    { id: 'feed', ico: '🍖', t: 'Feeding', s: 'Deep dive: meals, days, neglect', deep: 1, steps: [
      ['Once per chain day', 'A chain day is ' + N.blocksPerDay + ' Bitcoin blocks (about a day). Feed each pet <b>once per chain day</b>. A pet that has not eaten today is hungry.'],
      ['Meal sizes', 'A meal gives care that depends on the stage: Hatchling ' + fmt(N.meals[0]) + ', Juvenile ' + fmt(N.meals[1]) + ', Adult ' + fmt(N.meals[2]) + ', Elder ' + fmt(N.meals[3]) + '. The Play page shows what a meal burns right now.', 'feed'],
      ['Feed them all at once', '<b>Feed all hungry</b> on the Play page bundles your hungry pets into one burn, so a big herd is one signature.' + (window.XCPETS_FEED_ALL_PAUSED === true ? ' Feed all is paused for a fix.' : '')],
      ['Neglect and death', 'After <b>' + N.neglectedAfter + ' days</b> without food a pet is neglected: no battles, no breeding. After <b>' + N.deathAfter + ' days</b> it dies and goes to the Pet Cemetery. Mythic pets never starve.']],
      quiz: [['How often can you feed a pet?', ['Once per chain day', 'Once per block', 'Once a week'], 0], ['What happens after 7 days with no meal?', ['It dies and goes to the Cemetery', 'Nothing', 'It turns Mythic'], 0], ['Can a neglected pet battle?', ['No', 'Yes'], 0]] },
    { id: 'grow', ico: '🌱', t: 'Growing', s: 'Deep dive: stages and Mythic', deep: 1, demo: 'grow', steps: [
      ['The stage line', 'Care moves a pet up: Hatchling ' + fmt(N.thresholds[1]) + ', Juvenile ' + fmt(N.thresholds[2]) + ', Adult ' + fmt(N.thresholds[3]) + ', Elder ' + fmt(N.thresholds[4]) + ', Mythic ' + fmt(N.thresholds[5]) + ' care.', 'grow'],
      ['What each stage unlocks', 'Juvenile: battles. Adult: breeding. Mythic: a gold aura, every gear slot, and no more hunger. Fed daily, a pet reaches Mythic in about 9 days.'],
      ['The Mythic fast lane', 'Once you raise a living Mythic, your other pets reach Mythic at just <b>' + fmt(N.mythicLine) + ' care</b>. Care past ' + fmt(N.mythicLine) + ' earns saved Pepe Wheel spins (1 per 1,000 care).'],
      ['Lucky drops', 'Each stage-up has a 25% chance and each meal a 2% chance to drop a saved gear spin.']],
      quiz: [['At which stage can a pet first battle?', ['Juvenile', 'Hatchling', 'Mythic'], 0], ['Raise a living Mythic and your other pets reach Mythic at...', [fmt(N.mythicLine) + ' care', fmt(N.thresholds[5]) + ' care', 'never'], 0]] },
    { id: 'battle', ico: '⚔️', t: 'Battles', s: 'Deep dive: HP, Power, gear', deep: 1, demo: 'battle', steps: [
      ['Who can fight', 'Juvenile or older, not neglected, once per pet per chain day. A challenge is a small burn (the Play page shows the live amount); the other side accepts.'],
      ['HP by stage', 'HP = 40 + vigor times 2 + grit + stage times 6, so older pets are tougher. Power is all five stats added up.'],
      ['How a turn works', 'Zoom picks who swings first. Spark and gear power raise damage, grit blocks some of it, luck gives crits (double damage) and zoom gives dodges. ' + N.turns + ' turns.', 'battle'],
      ['Gear power', 'Every worn piece adds power: Common 1, Uncommon 3, Rare 5, Legendary 7.'],
      ['Winning and losing', 'The side with more of its HP left wins. The loser gives up a worn piece and gets a black eye for ' + N.blackEye + ' blocks (about half a day).']],
      quiz: [['Which stat decides who goes first?', ['Zoom', 'Grit', 'Luck'], 0], ['What does the loser lose?', ['A worn gear piece', 'The pet', 'Nothing'], 0]] },
    { id: 'breed', ico: '🏨', t: 'Breeding', s: 'Deep dive: babies and hybrids', deep: 1, demo: 'breed', steps: [
      ['Who can breed', 'Two Adults or older, alive, not neglected and not away on a quest. Not with a parent, child or sibling. Community pets can\'t breed. Check in at Gooby\'s No-Tail Motel.'],
      ['Limits', 'One breed per ' + fmt(N.breedCooldown) + ' blocks (about a week) and ' + N.breedCap + ' in a lifetime. A breed is a small burn: the Play page shows the live amount. With someone else\'s pet, they accept within a day.'],
      ['What the baby gets', 'Stats and looks come from both parents. Same species can breed true: +3 stats, a rarer pattern or rarer eyes.'],
      ['Hybrids', 'Different species make a hybrid about 68.5% of the time. Its tier is the higher parent\'s, with a 10% chance of one tier up.', 'breed'],
      ['Rare surprises', 'Twins 1 in 50, mutations 1 in 100, and hidden traits like Odd eyes (gold, ice, toxic or magenta).']],
      quiz: [['What stage must both parents be?', ['Adult or older', 'Hatchling', 'Any'], 0], ['How often are twins?', ['1 in 50', '1 in 2', 'Never'], 0]] },
    { id: 'gear', ico: '🎡', t: 'Gear & spins', s: 'Drip, slots, the Pepe Wheel', steps: [
      ['Six slots', 'Headwear, Guise, Drip, Grip, Outfits and Footwear. From block 973,560 every pet has all 6 open, whatever its age, feeding, tier or stage.'],
      ['The Pepe Wheel', 'Spin for gear in The Rare Room. Each spin is a small burn: the Play page shows the live amount. Saved spins from lucky drops cost only the Bitcoin fee. Each copy you own makes that item a bit less likely, so duplicates are rarer.']],
      quiz: [['How many gear slots does a Mythic have?', ['6', '2', '1'], 0]] },
    { id: 'shop', ico: '🛒', t: 'Shop & gifting', s: 'Spam City Games', steps: [
      ['Pet tokens', 'Every pet can become a token. Gift a pet by sending its token, up to 10 in one send.'],
      ['Buy and sell', 'At Spam City Games you list a pet for an exact amount of XCPETS or XCP; a listing lasts about 2 days. Buying fills that order.']],
      quiz: [['How do you gift a pet?', ['Send its token', 'Email it', 'You can\'t'], 0]] },
    { id: 'tokens', ico: '🎖️', t: 'Proof Parade', s: 'Every token in order', steps: [
      ['Proof Parade', 'The Proof Parade page lists every pet token in order, so anyone can check what was made and who holds it.']],
      quiz: [['What does the Proof Parade show?', ['Every pet token in order', 'Weather', 'Chat'], 0]] },
    { id: 'cem', ico: '🪦', t: 'Cemetery & community pets', s: 'Rest in pixels, Cold Storage', steps: [
      ['The Pet Cemetery', 'Pets that starve rest in the Pet Cemetery, with their whole story.'],
      ['Raise a zombie', function () { return 'A grave can come back as a zombie. Open the <b>Pet Cemetery</b> and click a gravestone (or its <b>Raise at the altar</b> button). The altar opens in Mort\'s candle circle.' + cemNote(); }],
      ['Make your offering', function () { return 'Tap your living pets (or drag them) onto the altar, and throw spare gear into the flames. Pets left unfed for ' + N.neglectedAfter + ' days count ' + N.cemRipe + ' times. Each offering adds a bit less than the one before, up to ' + N.cemCap + ' times the power it had when it died. <b>↩ Take all back</b> clears your picks. Mythics and pets on a quest, in a fight, in Cold Storage or in the shop can\'t be offered.' + cemNote(1); }],
      ['Hold seance', function () { return 'Press <b>🕯️ Hold seance</b> and sign the burns in your wallet. The offerings burn and the raise starts (if someone else leads the altar, yours joins the pool). <b>🤝 Pledge only</b> adds your pets and gear to that grave\'s pool without starting a raise; the pool stays open for ' + N.cemPool + ' blocks (about a day). Whoever gave the most to the altar leads it, and the leader sees <b>🧟 Raise now</b>.' + cemNote(1); }],
      ['It rises!', function () { return 'After the burns confirm (about a block) the zombie rises. Everything offered is used up. <b>Whoever raises it owns it</b>, and it shows in <b>My Pets</b>.' + cemNote(1); }],
      ['Zombies eat pets', function () { return 'A zombie eats <b>pets, not meals</b>. On its card in <b>My Pets</b> press <b>🍖 Feed it pets</b> and tick the pets it eats: your <b>discarded</b> pets are listed first, and <b>Select all discarded</b> ticks them all. ⭐ Starred pets are never offered. Every pet it eats is used up for good; the XCPETS is only a fee per burn.'; }],
      ['What a meal does', function () { return 'Each meal burn refills its hunger to full. Only <b>tier</b> and <b>neglect</b> count: rarer pets and ripe pets (unfed ' + N.neglectedAfter + '+ days, ' + N.cemRipe + ' times) add more power; meals and stage don\'t matter. Each pet adds a bit less, so extra pets add little near the ' + N.cemCap + ' times cap. If any pet in a burn can\'t be eaten, the whole burn fails.'; }],
      ['Keep it fed', function () { return 'Leave a zombie unfed for ' + N.cemFeral / N.blocksPerDay + ' days and it goes <b>feral</b>: it won\'t fight for you, and other players can hunt it. One meal calms it. Unfed another ' + N.cemFeral / N.blocksPerDay + ' days and it crumbles back into its grave.'; }],
      ['Community pets', 'Some pets belong to everyone: anyone can feed them. When one reaches Mythic it goes to Cold Storage, the next one arrives, and burns cost half (the halving).']],
      quiz: [['What happens when a community pet reaches Mythic?', ['It goes to Cold Storage and burns cost half', 'It dies', 'Nothing'], 0],
        ['What does Pledge only do?', ['Adds your offering to the grave\'s pool without starting a raise', 'Raises the zombie at once', 'Gives your pets back'], 0],
        ['What does a zombie eat?', ['Your pets (discarded ones listed first)', 'XCPETS meals', 'Gear'], 0],
        ['One pet in a zombie\'s meal can\'t be eaten. What happens?', ['The whole burn fails', 'The others are eaten', 'The zombie goes feral'], 0]] },
    { id: 'ranks', ico: '👑', t: 'Rankings & Burn Lords', s: 'Climb the boards', steps: [
      ['Rankings', 'The Rankings page shows the top keepers, pets and fighters.'],
      ['Burn Lords', 'The top burners are the Burn Lords. Top 5 burners at the snapshot block get special eggs.']],
      quiz: [['Who are the Burn Lords?', ['The top burners', 'Moderators', 'Bots'], 0]] },
    { id: 'meme', ico: '😂', t: 'Meme contest', s: 'On X, ends Oct 31', steps: [
      ['Meme contest', 'Post your best XCPETS meme <b>on X</b> (X only). It ends <b>Saturday Oct 31</b> at midnight Central. Top 3 win special pet eggs. Follow @XCPets on X for the details.']],
      quiz: [] },
    { id: 'go', ico: '🚀', t: 'Hatch your first egg', s: 'Your turn!', steps: [
      ['Your turn, keeper!', 'You know the basics. Head to the Play page and crack your first egg. Coach Peepo will point the way.']], quiz: [], cta: 1 }
  ];

  /* ---------- Tutorial page ---------- */
  function academy(root) {
    ls(SEEN, '1'); var done = jget(DONE);
    function save() { ls(DONE, JSON.stringify(done)); }
    function menu() {
      cur = null; root.innerHTML = ''; var c = el('div', 'tut-card');
      c.appendChild(guide('Hi, I\'m <b>Coach Peepo</b>! Pick a chapter, or start from the top. The gold ones are the deep dives.'));
      c.appendChild(el('h1', 'tut-big', 'The Big Beautiful Tutorial'));
      var nDone = CH.filter(function (x) { return done[x.id]; }).length;
      c.appendChild(el('div', 'tut-meter', '<i style="width:' + Math.round(nDone / CH.length * 100) + '%"></i>'));
      c.appendChild(el('p', 'tut-body small', nDone + ' of ' + CH.length + ' chapters done'));
      c.appendChild(gradCard(nDone === CH.length));
      var m = el('div', 'tut-menu');
      CH.forEach(function (ch, i) {
        var b = el('button', 'tut-ch' + (ch.deep ? ' deep' : ''), '<span class="ok">' + (done[ch.id] ? '✅' : '') + '</span>' + ch.ico + ' ' + (i + 1) + '<span class="t">' + esc(ch.t) + '</span><span class="s">' + esc(ch.s) + '</span>');
        b.type = 'button'; b.setAttribute('data-ch', ch.id); b.onclick = function () { open(i, 0); }; m.appendChild(b);
      });
      c.appendChild(m);
      var nav = el('div', 'tut-nav'), st = el('button', 'btn', '▶ Start from the top'); st.onclick = function () { open(0, 0); };
      var pl = el('a', 'q', 'Skip to Play →'); pl.href = 'play.html?coach=1'; nav.appendChild(st); nav.appendChild(pl); c.appendChild(nav);
      root.appendChild(c); history.replaceState(null, '', location.pathname);
    }
    var cur = null;
    if ((window.V2Rules && V2Rules.cemPublicBlock ? V2Rules.cemPublicBlock() : N.cemPublic) != null && window.fetch) /* the tip only matters once a public launch block is set */
      fetch('api/meta.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) { TIP = +j.blockHeight || null; if (cur && CH[cur[0]].id === 'cem') open(cur[0], cur[1]); }, function () {});
    function open(ci, si) {
      cur = [ci, si];
      var ch = CH[ci], total = ch.steps.length + (ch.quiz.length ? 1 : 0); root.innerHTML = '';
      history.replaceState(null, '', '#' + ch.id + (si ? '-' + (si + 1) : ''));
      var c = el('div', 'tut-card');
      c.appendChild(el('div', 'tut-body small', ch.ico + ' Chapter ' + (ci + 1) + ' of ' + CH.length + (ch.deep ? ' <span class="tut-tag gold">DEEP DIVE</span>' : '')));
      c.appendChild(el('h1', 'tut-big', esc(ch.t)));
      if (si < ch.steps.length) {
        var s = ch.steps[si]; c.appendChild(guide('<b>' + s[0] + '</b><br>' + (typeof s[1] === 'function' ? s[1]() : s[1])));
        if (s[2] && DEMOS[s[2]]) c.appendChild(DEMOS[s[2]]());
        if (ch.cta) {
          var h = el('div', 'tut-demo', ''); h.appendChild(sprite('pepe', 0, null, '')); h.firstChild.style.width = '96px'; h.firstChild.style.height = '96px';
          var a = el('a', 'btn ico-egg', '🥚 Hatch your first egg'); a.href = 'play.html?coach=1#hatchPanel'; a.style.fontSize = '18px'; a.onclick = function () { done[ch.id] = 1; save(); };
          h.appendChild(el('br')); h.appendChild(a); c.appendChild(h);
        }
      } else quiz(c, ch, function () { done[ch.id] = 1; save(); cheer(c); });
      var pips = el('div', 'tut-pips'); for (var p = 0; p < total; p++) pips.appendChild(el('span', 'tut-pip' + (p === si ? ' on' : p < si ? ' done' : ''))); pips.setAttribute('aria-label', 'Step ' + (si + 1) + ' of ' + total); c.appendChild(pips);
      var nav = el('div', 'tut-nav'), back = el('button', 'q', '← Back'), menuB = el('button', 'q', '☰ Chapters'), next = el('button', 'btn', si + 1 < total ? 'Next →' : ci + 1 < CH.length ? 'Next chapter →' : 'Done ✓'), skip = el('button', 'q', 'Skip chapter ⏭');
      back.onclick = function () { if (si > 0) open(ci, si - 1); else if (ci > 0) open(ci - 1, 0); else menu(); };
      menuB.onclick = menu; skip.onclick = function () { ci + 1 < CH.length ? open(ci + 1, 0) : menu(); };
      next.onclick = function () { sfx('blip'); if (si + 1 < total) open(ci, si + 1); else { if (!ch.quiz.length) { done[ch.id] = 1; save(); } ci + 1 < CH.length ? open(ci + 1, 0) : menu(); } };
      [back, menuB, skip, next].forEach(function (b) { b.type = 'button'; nav.appendChild(b); }); c.appendChild(nav);
      root.appendChild(c); c.scrollIntoView({ block: 'start' }); next.focus({ preventScroll: true });
    }
    function quiz(c, ch, onAll) {
      c.appendChild(guide('<b>Quick check!</b> ' + ch.quiz.length + ' question' + (ch.quiz.length > 1 ? 's' : '') + '. Tap an answer.'));
      var right = 0; ch.quiz.forEach(function (q) {
        var box = el('div', 'tut-quiz tut-body'); box.appendChild(el('p', '', '<b>' + esc(q[0]) + '</b>'));
        var order = q[1].map(function (a, i) { return i; }); order.push(order.shift());
        order.forEach(function (i) {
          var b = el('button', 'q', esc(q[1][i])); b.type = 'button';
          b.onclick = function () { if (box._ok) return; if (i === q[2]) { b.classList.add('right'); box._ok = 1; sfx('coin'); burst(b.getBoundingClientRect().left + 40, b.getBoundingClientRect().top, 12); if (++right === ch.quiz.length) onAll(); } else { b.classList.add('wrong'); sfx('flip'); } };
          box.appendChild(b);
        }); c.appendChild(box);
      });
    }
    var h = location.hash.slice(1), m = /^([a-z]+)(?:-(\d+))?$/.exec(h), idx = m ? CH.map(function (x) { return x.id; }).indexOf(m[1]) : -1;
    if (idx >= 0) open(idx, Math.max(0, Math.min((+m[2] || 1) - 1, CH[idx].steps.length))); else menu();
  }

  /* ---------- first-visit welcome card (index, Play, How It Works) ---------- */
  function tip(html, buttons, key) {
    var t = el('div', 'tut-tip'); t.setAttribute('role', 'dialog'); t.setAttribute('aria-label', 'Coach Peepo'); t.appendChild(guide(html));
    var nav = el('div', 'tut-nav'); (buttons || [['Got it', null, 'btn']]).forEach(function (b) { var x = el(b[3] ? 'a' : 'button', b[2] || 'q', b[0]); if (b[3]) x.href = b[3]; else x.type = 'button'; x.onclick = function () { t.remove(); if (key) { var s = jget(TIPS); s[key] = 1; ls(TIPS, JSON.stringify(s)); } if (b[1]) b[1](); }; nav.appendChild(x); });
    t.appendChild(nav); document.body.appendChild(t); return t;
  }
  function welcome(onPlay) {
    ls(SEEN, '1');
    tip('<b>New here, keeper?</b> I\'m Coach Peepo. Want a quick tour? It takes about 2 minutes.', [
      ['No thanks', null, 'q'], ['🎓 The Big Beautiful Tutorial', null, 'q', 'tutorial.html'],
      onPlay ? ['▶ Show me around', coach, 'btn'] : ['▶ Start the tour', null, 'btn', 'play.html?coach=1']]);
  }

  /* ---------- Play page coach marks: spotlight + pointing hand on the REAL buttons, one action per step ---------- */
  function connected() { return !!(window.V2UI && V2UI.ME); }
  var COACH = [
    ['#wconnect', 'Tap <b>Connect wallet</b> to bring in your XCP Wallet.', function () { return !connected(); }],
    ['#hatchBtn', 'Tap <b>Crack One Open</b> to hatch your first egg. Your wallet asks you to sign.'],
    ['#petsPanel', 'Your pets live here. Tap one to see its stats.'],
    ['#bFeedHungry', '<b>Feed all hungry</b> once each chain day. Skip 3 days and a pet is neglected; 7 and it dies.'],
    ['#tutQuests', 'Keeper Quests track your progress from your real history. Have fun!']
  ];
  var CSKIP = 'xcpets-tut-coach-skip', CAT = 'xcpets-tut-coach-at'; /* CAT (sessionStorage): the step to resume at, so tapping a pet (which opens pet.html) and coming back keeps the tour going */
  /* Next usable coach step from i going d (+1/-1). Going Back past the first usable step stays put instead of landing on a hidden one. */
  function pickStep(i, d, n, ok) { var j = i + d; while (j >= 0 && j < n && !ok(j)) j += d; if (j < 0) { j = i; while (j < n && (j < 0 || !ok(j))) j++; } return j; }
  function visible(e) { if (!e) return false; var r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; }
  function coach(from) {
    var i = (from | 0) - 1, spot = el('div', 'tut-spot'), hand = el('div', 'tut-hand', '👉'), card = null, tgt = null, onTgt = null;
    spot.setAttribute('aria-hidden', 'true'); hand.setAttribute('aria-hidden', 'true'); document.body.appendChild(spot); document.body.appendChild(hand);
    function place() { if (!tgt) return; var r = tgt.getBoundingClientRect(); spot.style.left = r.left - 6 + 'px'; spot.style.top = r.top - 6 + 'px'; spot.style.width = r.width + 12 + 'px'; spot.style.height = r.height + 12 + 'px'; hand.style.left = Math.max(0, r.left - 44) + 'px'; hand.style.top = r.top + r.height / 2 - 30 + 'px'; }
    function end() { spot.remove(); hand.remove(); if (card) card.remove(); removeEventListener('scroll', place, true); removeEventListener('resize', place); ls(SEEN, '1'); try { sessionStorage.removeItem(CAT); } catch (e) { } }
    function step(d) {
      if (card) card.remove(); if (tgt && onTgt) tgt.removeEventListener('click', onTgt); onTgt = null;
      var sk = jget(CSKIP); i = pickStep(i, d, COACH.length, function (k) { return !sk[COACH[k][0]] && visible(document.querySelector(COACH[k][0])) && !(COACH[k][2] && !COACH[k][2]()); });
      if (i >= COACH.length) { end(); cheer(); return; }
      tgt = document.querySelector(COACH[i][0]); tgt.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' }); setTimeout(place, 350); place();
      var pips = ''; for (var p = 0; p < COACH.length; p++) pips += '<span class="tut-pip' + (p === i ? ' on' : p < i ? ' done' : '') + '"></span>';
      card = tip(COACH[i][1] + '<div class="tut-pips">' + pips + '</div>', [['Skip', function () { var s = jget(CSKIP); s[COACH[i][0]] = 1; ls(CSKIP, JSON.stringify(s)); step(1); }, 'q'], ['← Back', function () { step(-1); }, 'q'], [i === COACH.length - 1 ? 'Done ✓' : 'Next →', function () { sfx('blip'); if (i < COACH.length - 1) burst(innerWidth / 2, innerHeight - 140, 14); step(1); }, 'btn']]);
      var bt = card.querySelectorAll('button'); if (i === 0 && bt[1]) bt[1].disabled = true;
      var me = i; try { sessionStorage.setItem(CAT, JSON.stringify({ i: i, at: Date.now() })); } catch (e) { } onTgt = function () { try { sessionStorage.setItem(CAT, JSON.stringify({ i: me + 1, at: Date.now() })); } catch (e) { } tgt.removeEventListener('click', onTgt); onTgt = null; setTimeout(function () { if (card && card.isConnected && i === me) { cheer(tgt); step(1); } }, 50); }; tgt.addEventListener('click', onTgt);
    }
    addEventListener('scroll', place, true); addEventListener('resize', place); step(1);
  }

  /* ---------- Keeper Quests + day streak (display only, from the replayed world) ---------- */
  var QUESTS = [
    ['hatch', '🥚', 'Hatch your first egg', function (s) { return s.pets >= 1; }],
    ['feed', '🍖', 'Feed a pet', function (s) { return s.feeds >= 1; }],
    ['streak3', '🔥', 'Feed 3 days in a row', function (s) { return s.best >= 3; }],
    ['juv', '🌱', 'Reach Juvenile', function (s) { return s.stage >= 2; }],
    ['fight', '⚔️', 'Fight a battle', function (s) { return s.fights >= 1; }],
    ['win', '🏆', 'Win a battle', function (s) { return s.wins >= 1; }],
    ['adult', '🦸', 'Reach Adult', function (s) { return s.stage >= 3; }],
    ['breed', '🏨', 'Breed a baby', function (s) { return s.breeds >= 1; }],
    ['pack', '📦', 'Own 12 pets', function (s) { return s.pets >= 12; }],
    ['streak7', '🌋', 'Feed 7 days in a row', function (s) { return s.best >= 7; }],
    ['streak30', '🏅', 'Feed 30 days in a row', function (s) { return s.best >= 30; }],
    ['mythic', '✨', 'Reach Mythic', function (s) { return s.stage >= 5; }]
  ];
  function stats(w, me) {
    var s = { pets: 0, feeds: 0, best: 0, cur: 0, stage: 0, fights: 0, wins: 0, breeds: 0, hungry: 0, neglected: 0, tokens: 0 }, days = {};
    (w.pets || []).forEach(function (p) {
      if (p.owner !== me || p.community) return; s.pets++;
      for (var d in (p.feedDays || {})) { days[d] = 1; s.feeds++; }
      s.stage = Math.max(s.stage, p.stage || 0); s.wins += p.wins || 0; s.fights += (p.wins || 0) + (p.losses || 0); s.breeds += p.breeds || 0;
      if (!p.dead) { if (p.hungry) s.hungry++; if (p.neglected) s.neglected++; s.tokens += p.tokens || 0; }
    });
    var list = Object.keys(days).map(Number).sort(function (a, b) { return a - b; }), run = 0, prev = null;
    list.forEach(function (d) { run = prev !== null && d === prev + 1 ? run + 1 : 1; prev = d; if (run > s.best) s.best = run; });
    var today = Math.floor((w.tip || 0) / N.blocksPerDay); s.cur = prev !== null && prev >= today - 1 ? run : 0; s.today = !!days[today];
    return s;
  }
  /* ---------- rewards (owner pick Oct 25 2026) ----------
   * 1) Big Beautiful Graduate frame + title: all chapters done, saved in this browser (honor-based, display only).
   * 2) Streak frames: bronze / silver / gold at 3 / 7 / 30 chain days in a row, from the replayed world (display only).
   * 3) 7-day streak spin: +1 saved Pepe Wheel spin once per wallet, a rule in js/v2-rules.js (streakFeed) behind ACTIVATE_STREAK_SPIN_BLOCK. */
  var FRAMES = [[30, 'gold', '🥇 Gold streak frame'], [7, 'silver', '🥈 Silver streak frame'], [3, 'bronze', '🥉 Bronze streak frame']];
  /* Direct way in to The Big Beautiful Tutorial at the top of Home and Play (a small chip once graduated). Display only. */
  function entry() {
    var m = document.querySelector('main'); if (!m || document.getElementById('tutEntry') || !/(^|\/)(index\.html|play\.html)?$/.test(location.pathname)) return;
    var g = graduated(), a = el('a', g ? 'q tut-entry small' : 'btn tut-entry', g ? '🎓 Tutorial' : '🎓 Big Beautiful Tutorial'); a.id = 'tutEntry'; a.href = 'tutorial.html';
    var w = el('div', 'tut-entry-row' + (g ? ' grad' : '')); w.appendChild(a); if (!g) w.appendChild(el('span', 'muted small', 'New here? Learn the game in a few minutes.')); m.insertBefore(w, m.firstChild);
  }
  function graduated() { var d = jget(DONE); return CH.every(function (x) { return d[x.id]; }); }
  function frameOf(best) { for (var i = 0; i < FRAMES.length; i++) if (best >= FRAMES[i][0]) return FRAMES[i]; return null; }
  function gradCard(on) { var g = el('div', 'tut-grad' + (on ? ' on' : ''), on ? '<b>🎓 Big Beautiful Graduate</b><span>Every chapter done! Your gold frame and title now show in Keeper Quests on the Play page.</span>' + (window.V2FtGrad ? '<button type="button" class="btn ftg-replay">▶ Watch FUNTRUMP present it</button>' : '')
      : '<b>🎓 Big Beautiful Graduate</b><span>Finish all ' + CH.length + ' chapters to earn the gold graduate frame and title.</span>'); var rb = g.querySelector('.ftg-replay'); if (rb) rb.onclick = function () { V2FtGrad.play(); };
      if (on && window.V2FtGrad) setTimeout(function () { V2FtGrad.playOnce(); }, 400); return g; }
  function rewardsHtml(s) {
    var R = window.V2Rules || {}, gate = R.ACTIVATE_STREAK_SPIN_BLOCK, open = gate != null && gate < 999999999 && (s.tip || 0) + 1 >= gate, sp = s.spin || null, need = R.STREAK_SPIN_DAYS || 7;
    var spinTxt = sp && sp.done != null ? '✅ Earned! It is waiting in your saved Pepe Wheel spins.' : !open ? 'Coming soon: feed your pets ' + need + ' chain days in a row to earn 1 saved Pepe Wheel spin (once per wallet).'
      : (sp && sp.len ? sp.len + ' of ' + need + ' days so far. ' : '') + 'Feed your own pets ' + need + ' chain days in a row for 1 saved Pepe Wheel spin (once per wallet). Pets hatched during the streak do not count.';
    var cells = [[s.grad, 'tut-fr gold', '🎓 Big Beautiful Graduate', s.grad ? 'Gold frame + title' : 'Finish The Big Beautiful Tutorial']]
      .concat(FRAMES.slice().reverse().map(function (f) { return [s.best >= f[0], 'tut-fr ' + f[1], f[2], f[0] + ' days in a row']; }))
      .concat([[sp && sp.done != null, 'tut-fr spin', '🎡 7-day streak spin', spinTxt]]);
    return '<div class="tut-rw">' + cells.map(function (c) { return '<div class="tut-q tut-rwc' + (c[0] ? ' done' : '') + '"><span class="' + c[1] + '"></span><span><b>' + (c[0] ? '✅ ' : '') + esc(c[2]) + '</b><br><small>' + esc(c[3]) + '</small></span></div>'; }).join('') + '</div>';
  }
  function keeperCard(s) { var f = frameOf(s.best), cls = s.grad ? 'gold' : f ? f[1] : 'none', title = s.grad ? 'Big Beautiful Graduate' : f ? (f[1] === 'gold' ? 'Golden Keeper' : f[1] === 'silver' ? 'Silver Keeper' : 'Bronze Keeper') : 'Keeper';
    return '<div class="tut-kc fr-' + cls + '"><span class="tut-kc-ico">' + (s.grad ? '🎓' : f ? '🔥' : '🐸') + '</span><span><b>' + esc(title) + '</b><br><small>' + (s.me ? esc(s.me.slice(0, 8) + '…' + s.me.slice(-4)) : 'your wallet') + (s.best ? ' · best streak ' + s.best + ' day' + (s.best === 1 ? '' : 's') : '') + '</small></span></div>'; }
  function questsPanel(s) {
    var p = document.getElementById('tutQuests');
    if (!p) { var host = document.getElementById('petsPanel'); if (!host) return; p = el('details', 'panel tut-quests'); p.id = 'tutQuests'; host.parentNode.insertBefore(p, host); }
    var open = p.open, n = QUESTS.filter(function (q) { return q[3](s); }).length;
    p.innerHTML = '<summary>🎯 Keeper Quests ' + n + '/' + QUESTS.length + ' <span class="tut-flame" title="Chain days in a row with at least one meal">' + (s.cur ? '🔥 ' + s.cur + '-day streak' + (s.today ? '' : ' (feed today to keep it)') : '') + '</span></summary>' +
      keeperCard(s) + '<div class="tut-meter"><i style="width:' + Math.round(n / QUESTS.length * 100) + '%"></i></div><div class="tut-qlist">' +
      QUESTS.map(function (q) { var ok = q[3](s); return '<div class="tut-q' + (ok ? ' done' : '') + '"><span class="b">' + q[1] + '</span><span>' + (ok ? '✅ ' : '') + esc(q[2]) + '</span></div>'; }).join('') +
      '</div><h4 class="tut-rwh">🎁 Rewards</h4>' + rewardsHtml(s) + '<p class="small muted">Badges and frames come from your real history and are just for show. The one reward with game value is the 7-day streak spin. <a href="tutorial.html">🎓 The Big Beautiful Tutorial</a></p>';
    p.open = open;
  }
  var TIPLIST = [
    ['juv', function (s) { return s.stage >= 2; }, '<b>Your pet is a Juvenile!</b> It can battle now (once a day) and wear gear. Try a Pepe Wheel spin in The Rare Room.'],
    ['adult', function (s) { return s.stage >= 3; }, '<b>An Adult!</b> Adults can breed at Gooby\'s No-Tail Motel. Different species often make a hybrid.'],
    ['tokens', function (s) { return s.tokens > 0; }, '<b>Lucky drop!</b> You have saved gear spins. Use them on the Pepe Wheel in The Rare Room; they cost only the Bitcoin fee.'],
    ['neglect', function (s) { return s.neglected > 0; }, '<b>Careful!</b> A pet is neglected (3+ days unfed). Feed it soon: after 7 days it dies.'],
    ['mythic', function (s) { return s.stage >= 5; }, '<b>MYTHIC!</b> Your other pets now reach Mythic at just ' + fmt(N.mythicLine) + ' care.']
  ];
  var lastKey = '', tipOpen = false;
  function playTick() {
    /* pet-flow-smoother: no coach tips while the hatch review (#packBox) is open; they wait until it closes (lastKey is not touched, so the next tick retries) */
    var pk = document.getElementById('packBox'); if (pk && pk.classList.contains('on')) return;
    if (!window.V2UI || !V2UI.world) return; var w; try { w = V2UI.world(); } catch (e) { return; } if (!w || !w.pets) return;
    var me = V2UI.ME || null; if (!me) return; var s = stats(w, me); s.me = me; s.tip = w.tip || 0; s.grad = graduated(); s.spin = (w.streakSpin && w.streakSpin[me]) || null; var key = JSON.stringify(s); if (key === lastKey) return; lastKey = key;
    questsPanel(s);
    if (tipOpen || document.querySelector('.tut-spot')) return; var seen = jget(TIPS);
    for (var i = 0; i < TIPLIST.length; i++) if (!seen[TIPLIST[i][0]] && TIPLIST[i][1](s)) { tipOpen = true; tip(TIPLIST[i][2], [['Got it', function () { tipOpen = false; }, 'btn']], TIPLIST[i][0]); break; }
  }

  /* ---------- boot ---------- */
  function boot() {
    var root = document.getElementById('academy'), qs = new URLSearchParams(location.search);
    if (root) return academy(root);
    if (qs.has('tutorial')) { location.replace('tutorial.html' + (qs.get('tutorial') ? '#' + qs.get('tutorial') : '')); return; }
    entry();
    var onPlay = !!document.getElementById('hatchPanel') && /(^|\/)(play\.html)?$/.test(location.pathname);
    /* the older 4-step tour (v2-intuitive) stays replayable from its help button; Coach Peepo takes the first visit */
    if (onPlay && (qs.has('coach') || !ls(SEEN))) { ls('xcpets-ip-tour', '1'); setTimeout(function () { var o = document.querySelector('.ip-tour'); if (o) { o.remove(); document.querySelectorAll('.ip-tour-on').forEach(function (x) { x.classList.remove('ip-tour-on'); }); } }, 2600); }
    if (onPlay && qs.get('preview') === 'rewards') { setTimeout(function () { questsPanel({ pets: 14, feeds: 90, best: 30, cur: 12, today: true, stage: 5, fights: 9, wins: 5, breeds: 2, me: 'bc1qpreview000000000000000000000000rwds', grad: true, tip: 0, spin: { len: 7, done: 1 } }); var q = document.getElementById('tutQuests'); if (q) { q.open = true; q.scrollIntoView({ block: 'start' }); } }, 2500); return; }
    if (onPlay) { setInterval(playTick, 4000); setTimeout(playTick, 1500); }
    var resume = null; try { resume = JSON.parse(sessionStorage.getItem(CAT) || 'null'); } catch (e) { }
    if (onPlay && resume && Date.now() - resume.at < 30 * 60000) { setTimeout(function () { coach(resume.i); }, 1200); return; }
    if (onPlay && qs.has('coach')) { ls(SEEN, '1'); setTimeout(coach, 1200); return; }
    if (!ls(SEEN)) setTimeout(function () { welcome(onPlay); }, 900);
  }
  window.V2Tutorial = { N: N, CH: CH, QUESTS: QUESTS, stats: stats, coach: coach, pickStep: pickStep, CSKIP: CSKIP, open: function () { location.href = 'tutorial.html'; } };
  if (typeof module !== 'undefined') module.exports = window.V2Tutorial;
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
