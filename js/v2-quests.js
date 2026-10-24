/* XCPETS Mythic quests UI (branch mythic-quests, 2026-10-24). Display + burn buttons only; every rule lives in js/v2-rules.js.
 * pet.html: Gone Questing card, Homecoming results, send-a-quest buttons (owner only), Quest Scroll (history), quest badges,
 * look progress, flame tier + Lights On / Lights Out, Proof of Burn badge; quest badges strip under Proof of Pet for tied pets.
 * Shows NOTHING while ACTIVATE_QUEST_BLOCK is null (V2Rules.questOn false), so shipping this file changes nothing until the gate. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fmt = function (n) { n = Number(n); return n.toLocaleString('en-US', { maximumFractionDigits: Math.abs(n) >= 1 || n === 0 ? 2 : 8 }); };
  var pct = function (bp) { return String(Number((bp / 100).toFixed(2))) + '%'; };
  var hrs = function (blocks) { var h = blocks / 6; return h < 1 ? 'under an hour' : h < 48 ? 'about ' + Math.round(h) + ' hours' : 'about ' + Math.round(h / 24) + ' days'; };
  /* ---- pixel badges (12 x 12, drawn at 3x, crisp) ---- */
  var PAL = { k: '#1a0d1f', w: '#fff4d6', r: '#e0303a', p: '#ff6fb5', b: '#4fb8ff', c: '#bff0ff', g: '#3cb44b', d: '#1f7a2e', y: '#ffc93c', o: '#ff8a1e', u: '#7a4cff', v: '#b48cff', s: '#c9ced6', n: '#c47a3a', m: '#8a5a2b', e: '#6b6b6b' };
  var ART = {
    spam: ['            ', '  kkkkkkkk  ', ' kbbbbbbbbk ', ' kbwwwwwwbk ', ' kbwrrrrwbk ', ' kbwrwwrwbk ', ' kbwrrrrwbk ', ' kbwwwwwwbk ', ' kbbbbbbbbk ', ' kbbbbbbbbk ', '  kkkkkkkk  ', '            '],
    cold: ['     c      ', '  c  c  c   ', '   c c c    ', '    ccc     ', ' ccccbcccc  ', '    ccc     ', '   c c c    ', '  c  c  c   ', '     c      ', '  kkkkkkkk  ', '  kbbbbbbk  ', '  kkkkkkkk  '],
    kek: ['            ', '  gg    gg  ', ' gwkg  gwkg ', ' gggggggggg ', 'gggggggggggg', 'gggggggggggg', 'gdrrrrrrrrdg', ' gdddddddg  ', '  gggggggg  ', '   gggggg   ', '            ', '            '],
    wiz: ['     u      ', '    uuy     ', '    uuu     ', '   uuuuu    ', '   uuyuu    ', '  uuuuuuu   ', '  uuuuuuu   ', ' uuuuyuuuu  ', 'vvvvvvvvvvv ', ' vvvvvvvvv  ', '            ', '            '],
    mine: ['  ssssssss  ', ' s  mm   s  ', '     mm     ', '      mm    ', '       mm   ', '   o    mm  ', '  ooo    mm ', ' ooyoo      ', ' oyyyo      ', '  ooo       ', '            ', '            '],
    funtrump: ['  oooooooo  ', ' oooooooooo ', ' oyyyyyyyyo ', ' yykyyyyky  ', ' yyyyyyyyy  ', ' yyyrrrryy  ', '  yyyyyyy   ', '   bbbbb    ', '  bbbrbbb   ', '  bbbrbbb   ', '            ', '            '],
    nakamoto: ['   yyyyyy   ', '  yoooooooy ', ' yooyoyooooy', ' yoyyyyyooy ', ' yooyooyooy ', ' yooyyyyooy ', ' yooyooyooy ', ' yoyyyyyooy ', ' yooyoyoooy ', '  yoooooooy ', '   yyyyyy   ', '            '],
    bronze: ['    o       ', '   oro      ', '  orryo     ', '  oryyo     ', '   ooo      ', '  nnnnnn    ', ' nmmmmmmn   ', ' nmnnnnmn   ', ' nmmmmmmn   ', '  nnnnnn    ', '            ', '            '],
    silver: ['    o       ', '   oro      ', '  orryo     ', '  oryyo     ', '   ooo      ', '  ssssss    ', ' sweeeews   ', ' seswwses   ', ' sweeeews   ', '  ssssss    ', '            ', '            '],
    gold: ['    o       ', '   oro      ', '  orryo     ', '  oryyo     ', '   ooo      ', '  yyyyyy    ', ' yoooooy    ', ' yoyyyyoy   ', ' yoooooy    ', '  yyyyyy    ', '            ', '            ']
  };
  function badgeCanvas(kind) { var a = ART[kind]; if (!a) return null; var c = document.createElement('canvas'); c.width = 12; c.height = 12; var x = c.getContext('2d');
    a.forEach(function (row, y) { for (var i = 0; i < 12; i++) { var ch = row[i]; if (ch && ch !== ' ' && PAL[ch]) { x.fillStyle = PAL[ch]; x.fillRect(i, y, 1, 1); } } }); return c; }
  function badgeImg(kind, scale) { var c = badgeCanvas(kind); if (!c) return '';
    var s = (scale || 3) * 12; return '<img class="qb-ico" alt="" width="' + s + '" height="' + s + '" src="' + c.toDataURL() + '">'; }
  var BADGE = { spam: 'Spam City badge', cold: 'Vault badge', kek: 'Kek badge', wiz: 'Wizard badge', mine: 'Mines badge', funtrump: 'FUNTRUMP badge', nakamoto: 'Nakamoto badge' };
  var TIER_ICO = { haul: '🏆', loot: '🎒', empty: '🕳️' };
  function css() { if ($('qsCss')) return; var s = document.createElement('style'); s.id = 'qsCss'; s.textContent =
    '#questCard .qs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;margin:10px 0}' +
    '#questCard .qs-q{border:3px solid #1a0d1f;background:#fff4d6;color:#2b1928;padding:10px;box-shadow:4px 4px 0 #1a0d1f;image-rendering:pixelated}' +
    '#questCard .qs-q h4{margin:0 0 6px;font-family:"Press Start 2P",monospace;font-size:11px;line-height:1.5}' +
    '#questCard .qs-q .btn{width:100%;margin-top:8px}#questCard .qs-q[aria-disabled=true]{filter:grayscale(.8);opacity:.6}' +
    '.qs-away{border:4px solid #1a0d1f;background:repeating-linear-gradient(45deg,#2b1640 0 8px,#331a4d 8px 16px);color:#fff4d6;padding:14px;box-shadow:5px 5px 0 #1a0d1f;margin:10px 0}' +
    '.qs-away h3,.qs-home h3{font-family:"Press Start 2P",monospace;font-size:14px;margin:0 0 8px;line-height:1.5}.qs-bar{height:14px;border:3px solid #1a0d1f;background:#1a0d1f;margin:8px 0}.qs-bar i{display:block;height:100%;background:repeating-linear-gradient(90deg,#ffc93c 0 6px,#ff8a1e 6px 12px)}' +
    '.qs-home{border:4px solid #1a0d1f;background:#ffe9a8;color:#2b1928;padding:14px;box-shadow:5px 5px 0 #1a0d1f;margin:10px 0}.qs-home.empty{background:#e6dccb}.qs-amb{background:#ff8a1e;color:#1a0d1f;border:3px solid #1a0d1f;padding:6px 8px;margin:8px 0;font-weight:bold}' +
    '.qs-scroll{background:#f4e4bc;color:#2b1928;border:4px solid #8a5a2b;border-left-width:12px;border-right-width:12px;padding:12px 14px;margin:10px 0;box-shadow:4px 4px 0 #1a0d1f}.qs-scroll ol{margin:6px 0 0;padding-left:22px}.qs-scroll li{margin:4px 0}' +
    '.qs-badges{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}.qs-badge{display:flex;align-items:center;gap:6px;border:3px solid #1a0d1f;background:#fff4d6;color:#2b1928;padding:4px 8px 4px 4px;box-shadow:3px 3px 0 #1a0d1f;font-size:12px}.qs-badge.off{opacity:.35;filter:grayscale(1)}.qb-ico{image-rendering:pixelated;display:block}' +
    '.qs-looks{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px}.qs-look{font-size:12px}.qs-look .qs-bar{height:10px;margin:4px 0}' +
    '.qs-pob{display:flex;gap:12px;align-items:center;border:3px solid #1a0d1f;background:#2b1928;color:#fff4d6;padding:10px;box-shadow:4px 4px 0 #1a0d1f;margin:10px 0}.qs-pob b{font-family:"Press Start 2P",monospace;font-size:12px}' +
    '.qs-flame{border:3px dashed #ff8a1e;padding:10px;margin:10px 0}.qs-why{color:#b0303a;font-size:12px}.qs-modal{position:fixed;inset:0;background:rgba(26,13,31,.7);display:flex;align-items:center;justify-content:center;z-index:9999;padding:12px}' +
    '.qs-modal>div{background:#fff4d6;color:#2b1928;border:4px solid #1a0d1f;box-shadow:6px 6px 0 #1a0d1f;max-width:460px;width:100%;padding:16px}.qs-modal h3{color:#2b1928;font-family:"Press Start 2P",monospace;font-size:13px;line-height:1.5;margin:0 0 10px}.qs-modal code{word-break:break-all;background:#1a0d1f;color:#ffc93c;padding:2px 4px}' +
    '.qs-home h3{color:#2b1928}.qs-modal .muted{color:#6b5560}.pp-qb{margin-top:8px}.pet.card.quest-away{filter:grayscale(.75);opacity:.7}.chip.quest-chip{background:#331a4d;color:#ffc93c}' +
    '@media (max-width:520px){#questCard .qs-grid{grid-template-columns:1fr}.qs-away h3,.qs-home h3{font-size:12px}}';
    document.head.appendChild(s); }
  function world() { var M = window.V2Mock; if (!M || !M.world) return null; try { return M.world(); } catch (e) { return null; } }
  function tipNow() { var M = window.V2Mock, S = M && M.state && M.state(); return S && S.tip ? S.tip : 0; }
  function rewardText(r, w) { if (r.kind === 'gear') return (r.star ? '★ ' : '') + esc(r.label) + ' (' + esc(r.slot) + ')';
    if (r.kind === 'spins') return r.n + ' saved spin' + (r.n === 1 ? '' : 's'); if (r.kind === 'stat') return '+1 ' + esc(r.stat);
    if (r.kind === 'egg') return (r.ambush ? 'FUNTRUMP Ambush ' : '') + 'Jackpot Egg → <a href="pet.html?id=' + r.petId + '">#' + r.petId + '</a>' + (r.twin ? ' (twins!)' : ''); return esc(r.kind); }
  function modal(h) { var m = document.createElement('div'); m.className = 'qs-modal'; m.innerHTML = '<div role="dialog" aria-modal="true">' + h + '</div>'; document.body.appendChild(m); m.onclick = function (e) { if (e.target === m) m.remove(); }; return m; }
  function toast(t) { var T = $('toasts'); if (!T) { alert(t); return; } var d = document.createElement('div'); d.className = 'toast'; d.textContent = t; T.appendChild(d); setTimeout(function () { d.remove(); }, 6000); }
  function confirmSend(plan, what) { var V = window.V2Rules, ME = window.V2Mock && V2Mock.ME;
    var m = modal('<h3>' + esc(what.title) + '</h3>' + what.body + '<p class="small">Burn <b>' + fmt(plan.amount) + ' XCPETS</b> with the memo<br><code>' + esc(plan.tag) + '</code></p>' +
      '<p class="small muted">The game reads this burn from the chain. If a check fails when it confirms, the burn becomes community food.</p><p><button class="q" data-x>Cancel</button> <button class="btn" data-go>' + esc(what.go) + '</button></p>');
    m.querySelector('[data-x]').onclick = function () { m.remove(); };
    m.querySelector('[data-go]').onclick = function () { m.remove(); if (!window.V2Wallet || !ME) { toast('Connect the owner wallet first.'); return; }
      window.V2Wallet.send(plan, ME).then(function () { toast('Sent: ' + plan.label); if (what.onSent) try { what.onSent(); } catch (e) {} }, function (e) { toast('Not sent: ' + (e && e.message || e)); }); };
    return m; }
  /* 8-bit quest animations (js/v2-quest-anim.js), each shown once per quest and remembered as seen in localStorage */
  function seen(k) { try { if (localStorage.getItem(k)) return true; localStorage.setItem(k, '1'); } catch (e) { return true; } return false; }
  function anim(w, p, I, lastH, b) { var A = window.V2QuestAnim; if (!A || document.querySelector('.qa-ov')) return;
    var flip = function (sel) { return function () { var x = document.querySelector(sel); if (x) { x.classList.remove('qa-flip'); void x.offsetWidth; x.classList.add('qa-flip'); } }; };
    if (I.away && !seen('xcpets-qa-out:' + p.id + ':' + I.away.start)) { var t = 0; try { t = +localStorage.getItem('xcpets-qa-sent:' + p.id) || 0; } catch (e) {}
      if (Date.now() - t > 3 * 3600e3) A.out({ code: I.away.code, pet: p, w: w, done: flip('#pcAway, #qsAway') }); else flip('#pcAway, #qsAway')(); return; }
    if (lastH && $('qsHome') && !seen('xcpets-qa-in:' + p.id + ':' + lastH.end)) A.home({ code: lastH.code, pet: p, w: w, tier: lastH.tier, ambush: !!lastH.ambush,
      egg: lastH.rewards.some(function (r) { return r.kind === 'egg'; }), done: flip('#qsHome') }); }
  var last = '';
  function paint() { var V = window.V2Rules, w = world(); if (!V || !V.questInfo || !w || !w.byId) return; var b = tipNow() + 1; if (!V.questOn(b)) { var o = $('questCard'); if (o) o.remove(); return; }
    var id = Number(new URLSearchParams(location.search).get('id')), p = w.byId[id], anchor = $('starveWarn') || $('facts'); if (!p || !anchor) return;
    var I = V.questInfo(w, p, b), ME = window.V2Mock && V2Mock.ME, mine = !!ME && ME === p.owner, key = [w.tip, id, ME, JSON.stringify(I.hist.length), I.away && I.away.end, I.napUntil, (I.flameLooks || []).join()].join('|'); if (key === last && $('questCard')) { ppStrip(I); return; } last = key; css();
    var el = $('questCard'); if (!el) { el = document.createElement('section'); el.id = 'questCard'; el.setAttribute('aria-label', 'Mythic quests'); anchor.parentNode.insertBefore(el, anchor.nextSibling); }
    var h = '<h2 class="sec" data-ico="crown">Quest log</h2>';
    /* mythic-quests-card: Gone Questing (#pcAway) and the Start buttons live on the pet card (js/v2-pet-card.js -> V2Quests.start); not repeated here */
    var lastH = I.hist[I.hist.length - 1];
    if (lastH && !I.away && b - lastH.end <= 144) { var TN = V.QUEST_TIERS[lastH.tier];
      h += '<div class="qs-home' + (lastH.tier === 'empty' ? ' empty' : '') + '" id="qsHome"><h3>' + TIER_ICO[lastH.tier] + ' Homecoming: ' + esc(TN) + '</h3><p>Back from <b>' + esc(V.QUESTS[lastH.code].name) + '</b> at block ' + fmt(lastH.end) + '.</p>' +
        (lastH.ftOwn ? '<div class="qs-amb">' + badgeImg('funtrump', 2) + ' FUNTRUMP\'s own quest: the FUNTRUMP badge, always.</div>' : '') + (lastH.ambush ? '<div class="qs-amb">' + badgeImg('funtrump', 2) + ' FUNTRUMP Ambush! A bonus Jackpot Egg and the FUNTRUMP badge.</div>' : '') +
        (lastH.rewards.length ? '<ul>' + lastH.rewards.map(function (r) { return '<li>' + rewardText(r, w) + '</li>'; }).join('') + '</ul>' : '<p>Nothing this time. The quest badge and look progress still count.</p>') +
        (lastH.look ? '<p><b>✨ New look unlocked: ' + esc(lastH.look) + '</b></p>' : '') + (I.napUntil ? '<p class="small">💤 Nap Time until block ' + fmt(I.napUntil) + ' (' + hrs(I.napUntil - b) + ').</p>' : '') + '</div>'; }
    else if (I.napUntil) h += '<p>💤 Nap Time until block ' + fmt(I.napUntil) + ' (' + hrs(I.napUntil - b) + '). It can fight, breed and eat meanwhile.</p>';
    var bd = I.badges || {}, all5 = V.QUEST_CODES.every(function (c) { return bd[c]; });
    h += '<h3 class="small">Quest badges</h3><div class="qs-badges" id="qsBadges">' + ['spam', 'cold', 'kek', 'wiz', 'mine', 'funtrump', 'nakamoto'].map(function (k) { var n = k === 'nakamoto' ? (all5 ? 1 : 0) : bd[k] || 0;
      return '<span class="qs-badge' + (n ? '' : ' off') + '" title="' + esc(BADGE[k]) + '">' + badgeImg(k, 2) + esc(BADGE[k]) + (n > 1 ? ' · ' + n + ' times' : '') + '</span>'; }).join('') + '</div>';
    h += '<h3 class="small">Quest looks</h3><div class="qs-looks">' + V.QUEST_CODES.map(function (c) { var L = V.QUESTS[c].look, n = Math.min(L.need, I.progress[L.id] || 0), got = (I.questLooks || []).indexOf(L.id) >= 0;
      return '<div class="qs-look"><b>' + (got ? '✨ ' : '') + esc(L.name) + '</b> <span class="muted">' + n + ' / ' + L.need + ' ' + (L.by === 'haul' ? 'Legendary Hauls' : 'finishes') + '</span><div class="qs-bar"><i style="width:' + (100 * n / L.need).toFixed(0) + '%"></i></div></div>'; }).join('') + '</div>';
    if (I.flame) { var fl = I.flameLooks || [];
      h += '<div class="qs-flame"><b>🔥 ' + esc(I.flame.name) + '</b> <span class="small muted">(owner wallet has burned ' + fmt(Math.floor(I.burned)) + ' XCPETS' + (I.early ? ', early burner: each look on up to 3 pets' : ', each look on 1 pet') + ')</span>' +
        '<p class="small">On this pet: ' + (fl.length ? fl.map(function (x) { var n = x; (V.FLAME_TIERS || []).forEach(function (T) { T.looks.forEach(function (L) { if (L.id === x) n = L.name; }); }); return esc(n); }).join(', ') : 'none') + '. Shown: ' + (I.looks.length ? I.looks.map(function (x) { return esc(x.name); }).join(', ') : 'none') + '.</p>' +
        (mine ? '<button class="q" data-aura="on">💡 Lights On (memo pet:aura:' + p.id + ':on)</button> <button class="q" data-aura="off">🌑 Lights Out</button>' : '') + '</div>'; }
    if (I.pob) h += '<div class="qs-pob" id="qsPob">' + badgeImg(I.pob.id, 4) + '<div><b>Proof of Burn: ' + esc(I.pob.name) + '</b><div class="small">This pet was here at launch. Its owner wallet has burned ' + fmt(Math.floor(I.pob.burned)) + ' XCPETS in total (Bronze under 100,000 · Silver 100,000 to 1,000,000 · Gold 1,000,000 and up). Lost if the pet is sold or gifted.</div></div></div>';
    h += '<div class="qs-scroll" id="qsScroll"><b>📜 Quest Scroll</b>' + (I.hist.length ? '<ol>' + I.hist.slice().reverse().map(function (q) { return '<li><b>' + esc(V.QUESTS[q.code].name) + '</b>: ' + TIER_ICO[q.tier] + ' ' + esc(V.QUEST_TIERS[q.tier]) + (q.ambush ? ' + FUNTRUMP Ambush' : '') + ' <span class="muted small">(blocks ' + fmt(q.start) + ' to ' + fmt(q.end) + (q.free ? ', free' : '') + ')</span>' + (q.rewards.length ? '<br><span class="small">' + q.rewards.map(function (r) { return rewardText(r, w); }).join(' · ') + '</span>' : '') + '</li>'; }).join('') + '</ol>' : '<p class="small">No quests yet.</p>') + '</div>';
    el.innerHTML = h;
    anim(w, p, I, lastH, b);
    el.querySelectorAll('[data-aura]').forEach(function (x) { x.onclick = function () { var on = x.getAttribute('data-aura') === 'on'; confirmSend(V.auraPlan(p.id, on), { title: on ? 'Lights On for #' + p.id + '?' : 'Lights Out for #' + p.id + '?', go: 'Send in XCP Wallet', body: '<p>' + (on ? 'Puts your flame looks on this pet (one of each type; a look already on another pet stays there if you are at your limit).' : 'Takes the flame looks off this pet so you can place them on another.') + '</p>' }); }; });
    ppStrip(I); }
  function ppStrip(I) { var bd = I.badges || {}, all5 = window.V2Rules.QUEST_CODES.every(function (c) { return bd[c]; }), pp = $('petPapers'); if (pp) { var q = pp.querySelector('.pp-qb'); if (!q) { q = document.createElement('div'); q.className = 'pp-qb'; pp.appendChild(q); }
      var any = Object.keys(bd).some(function (k) { return bd[k]; }); q.innerHTML = any ? '<p class="small"><b>Quest badges on this Proof of Pet</b> (they travel with the token):</p><div class="qs-badges">' + Object.keys(BADGE).filter(function (k) { return k === 'nakamoto' ? all5 : bd[k]; }).map(function (k) { return '<span class="qs-badge">' + badgeImg(k, 2) + esc(BADGE[k]) + (bd[k] > 1 ? ' · ' + bd[k] + ' times' : '') + '</span>'; }).join('') + '</div>' : ''; } }
  css(); if (document.body && document.body.getAttribute('data-v2page') === 'pet') { setInterval(paint, 2000); setTimeout(paint, 400); }
  /* mythic-quests-card: send pet ID on quest CODE from the pet card. Same checks, plan, confirm box and wallet send as the old in-page grid. */
  function start(id, c) { var V = window.V2Rules, w = world(); if (!V || !V.questPlan || !w || !w.byId) return false; var b = tipNow() + 1, p = w.byId[id], Q = V.QUESTS[c], ME = window.V2Mock && V2Mock.ME;
    if (!p || !Q || !V.questOn(b) || !ME || p.owner !== ME) return false; var why = V.questWhy ? V.questWhy(w, p, ME, c, 1e12, b) : null; if (why) { toast('Can\'t start a quest: ' + why); return false; }
    var pl = V.questPlan(p.id, c, w, b);
    confirmSend(pl, { title: 'Send #' + p.id + ' on ' + Q.name + '?', go: 'Send in XCP Wallet', body: '<p>' + badgeImg(c, 3) + '</p><p>#' + p.id + ' ' + esc(p.name) + ' will be away for ' + fmt(Q.len) + ' blocks (' + hrs(Q.len) + '): no battles, breeding, feeding, gifts or sales until Homecoming. After it, Nap Time for ' + fmt(Q.len / 2) + ' blocks.</p>', onSent: function () { try { localStorage.setItem('xcpets-qa-sent:' + p.id, String(Date.now())); } catch (e) {} if (window.V2QuestAnim) V2QuestAnim.out({ code: c, pet: p, w: w }); } });
    return true; }
  window.V2Quests = { start: start, paint: paint, badgeImg: badgeImg, badgeCanvas: badgeCanvas };
})();
