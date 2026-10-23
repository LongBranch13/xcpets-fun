/* XCPETS easy flows (branch easy-flows, 2026-10-22; owner 12:23 AM CT: make battles and breeding 'easy' like the Rare Room). DISPLAY + PICKING ONLY.
 * Battle (X Circus Kekimus): 'Your fighter' portrait strip + search -> opponent portraits (Suggested / Challenging you / Any pet) -> one big button.
 *   The button uses the SAME paths as before: Challenge = UXB face-off state + #foGo (-> #fMine/#fTheirs -> #fGo -> pet:fight:A:B 690);
 *   Accept = confirmPlans('Accept fight N', [{ tag: 'pet:accept:N', amount: 690 }]) like the Incoming tab; Quick match = the existing #arQuick.
 * Breeding (Gooby's No-Tail Motel): 'Parent 1' strip -> mate portraits (My other pets / Asking you / Other wallets) -> one big button.
 *   Check in = the existing #bGo bell (#bA/#bB -> pet:breed:A:B 690); a request at the desk = the existing #motelReqs Accept button.
 *   Breeding v2 info (breeds left of 6, inbreeding guard) only from V2Rules.breedV2On; generation + breeder badges are display only.
 * No new tags, amounts, rules or gates. The site never signs; the confirm pop-up and the wallet are unchanged. No <select> in these panels. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); }, U = function () { return window.V2UI; }, V = function () { return window.V2Rules; };
  var TL = ['Common', 'Uncommon', 'Rare', 'Legendary'], TID = ['common', 'uncommon', 'rare', 'legendary'], MAX = 48;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmt(n) { return Number(n).toLocaleString('en-US'); }
  function pow(p) { return window.UXB && UXB.power ? UXB.power(p) : 0; }
  function score(w, p) { var s = window.PetScore && PetScore.of(w, p); return s ? s.score : 0; }
  function spL(s) { return V().speciesLabel ? V().speciesLabel(s) : s; }
  function short(a) { a = String(a || ''); return a.length > 12 ? a.slice(0, 6) + '\u2026' + a.slice(-4) : a; }
  function tip(w) { return (U().S && U().S().tip) || w.tip || 0; }
  function match(p, q) { if (!q) return true; q = q.toLowerCase().replace(/^#/, ''); return String(p.id).indexOf(q) === 0 || String(p.name || '').toLowerCase().indexOf(q) >= 0 || (q.length >= 4 && String(p.owner || '').toLowerCase().indexOf(q) === 0) || spL(p.species).toLowerCase().indexOf(q) === 0; }
  var ST = { f: { qa: '', qb: '', tab: '', inc: null, msg: '' }, b: { qa: '', qb: '', tab: '', req: null } };

  /* one portrait card: sprite + name + tier + a few key facts; .on = picked (gold outline + ▼), .no = can't (reason shown) */
  function card(w, p, o) { o = o || {};
    return '<button type="button" class="ez-c t' + p.tier + (o.on ? ' on' : '') + (o.why ? ' no' : '') + '" data-ez="' + esc(o.key || p.id) + '"' + (o.why ? ' aria-disabled="true"' : '') + ' aria-pressed="' + !!o.on + '" title="' + esc('#' + p.id + ' ' + (p.name || '') + (o.why ? ' · ' + o.why : '')) + '">' +
      (o.tag ? '<span class="ez-tag' + (o.tagMe ? ' me' : '') + '">' + o.tag + '</span>' : '') + '<span class="ez-sp" data-ezsp="' + p.id + '"></span>' +
      '<b class="ez-nm">' + esc(p.name || '') + '</b><span class="ez-id">#' + p.id + (p.blackEye ? ' 🤕' : '') + '</span><span class="pill tier tier-' + TID[p.tier] + '">' + TL[p.tier] + '</span>' +
      (o.lines || []).map(function (l) { return '<span class="ez-l">' + l + '</span>'; }).join('') + (o.why ? '<span class="ez-why">✋ ' + esc(o.why) + '</span>' : '') + '</button>'; }
  function sprites(root, w) { var R = window.V2Render; if (!R) return; root.querySelectorAll('[data-ezsp]').forEach(function (s) { if (s.firstChild) return; var p = w.byId[s.getAttribute('data-ezsp')]; if (!p) return; var c = document.createElement('canvas'); c.width = c.height = 32; c.className = 'sprite'; s.appendChild(c);
    if (R.lazy && R.petFrames) R.lazy(c, function () { return R.petFrames(p, w); }, true); }); }
  function strip(items, more, empty) { return '<div class="ez-strip" role="listbox">' + (items.join('') || '<p class="ez-empty">' + empty + '</p>') + (more > 0 ? '<span class="ez-more">+' + fmt(more) + ' more · search to find them</span>' : '') + '</div>'; }
  function head(n, title, qid, q, extra) { return '<div class="ez-hd"><span class="ez-n">' + n + '</span><b>' + title + '</b><input type="search" class="ez-q" id="' + qid + '" value="' + esc(q) + '" placeholder="# name species" aria-label="Search ' + esc(title) + '">' + (extra || '') + '</div>'; }
  function tabs(list, cur) { return '<div class="ez-tabs" role="tablist">' + list.map(function (t) { return '<button type="button" role="tab" class="ez-tab' + (t[0] === cur ? ' on' : '') + (t[2] ? ' hot' : '') + '" data-eztab="' + t[0] + '" aria-selected="' + (t[0] === cur) + '">' + t[1] + '</button>'; }).join('') + '</div>'; }
  /* keep the panel where it is: a repaint must never move the page (no scroll jumps) */
  function keep(el, fn) { var y = window.scrollY, top = el ? el.getBoundingClientRect().top : 0, sx = {}; if (el) el.querySelectorAll('.ez-strip').forEach(function (s, i) { sx[i] = s.scrollLeft; }); fn();
    if (el) { el.querySelectorAll('.ez-strip').forEach(function (s, i) { if (sx[i]) s.scrollLeft = sx[i]; }); var d = el.getBoundingClientRect().top - top; if (Math.abs(d) > 1) window.scrollTo(window.scrollX, y + d); } }
  function bindQ(el, id, set, redraw) { var i = $(id); if (!i) return; i.oninput = function () { set(i.value); var p = i.selectionStart; redraw(); var j = $(id); if (j) { j.focus(); try { j.setSelectionRange(p, p); } catch (e) { } } }; }

  // ================================================================ BATTLE
  function fight(w) { var bp = $('battlePanel'), UI = U(); if (!bp || !UI || !w || !window.UXB || !UXB.faceoff) return; var el = $('ezFight');
    if (!el) { el = document.createElement('div'); el.id = 'ezFight'; el.className = 'ez ez-fight'; bp.insertBefore(el, bp.firstChild); bp.classList.add('ez-on'); }
    keep(el, function () { paintFight(el, w); }); }
  function paintFight(el, w) { var UI = U(), ME = UI.ME, FO = UXB.faceoff(), why = UXB.whyNot, T = tip(w), s = ST.f, view = UI.viewOnly && UI.viewOnly();
    var A = FO.a && w.byId[FO.a], B = FO.b && w.byId[FO.b], IGN = UXB.fightIgnored ? UXB.fightIgnored() : [];
    var inc = (w.fights || []).filter(function (f) { var q = w.byId[f.b]; return f.status === 'open' && T + 1 - f.block <= V().FIGHT_WINDOW && q && q.owner === ME && IGN.indexOf(f.id) < 0; });
    if (s.inc && !inc.some(function (f) { return f.id === s.inc; })) s.inc = null;
    if (!s.tab) s.tab = inc.length ? 'inc' : 'sug';
    var rec = function (p) { return '🏆 ' + (p.wins || 0) + '-' + (p.losses || 0); };
    var lines = function (p) { return ['⚡ ' + pow(p) + ' · ⭐ ' + score(w, p), rec(p) + ' · ' + esc(spL(p.species))]; };
    var h = '';
    if (!ME) { el.innerHTML = '<div class="ez-box"><p class="ez-lead">⚔️ Pick your fighter, pick an opponent, burn. Connect your XCP Wallet to start.</p><button type="button" class="btn ico-flame ez-go" id="ezFGo">🔌 Connect XCP Wallet</button></div>';
      $('ezFGo').onclick = function () { UI.confirmPlans('Challenge', [{}]); }; return; }
    /* 1 · your fighter */
    var mine = UI.mine(w).filter(function (p) { return !p.dead && !p.released; }).map(function (p) { return { p: p, why: why(p, w) }; })
      .sort(function (a, b) { return (!!a.why - !!b.why) || pow(b.p) - pow(a.p) || a.p.id - b.p.id; });
    var mq = mine.filter(function (x) { return match(x.p, s.qa); }), nOk = mine.filter(function (x) { return !x.why; }).length;
    if (A && !mq.slice(0, MAX).some(function (x) { return x.p.id === A.id; })) mq = [{ p: A, why: why(A, w) }].concat(mq.filter(function (x) { return x.p.id !== A.id; }));
    h += '<div class="ez-box">' + head('1', 'Your fighter', 'ezFqA', s.qa, '<span class="ez-cnt">' + fmt(nOk) + ' of ' + fmt(mine.length) + ' can fight today</span>') +
      strip(mq.slice(0, MAX).map(function (x) { return card(w, x.p, { on: A && A.id === x.p.id, why: x.why, lines: lines(x.p) }); }), mq.length - MAX, mine.length ? 'No pet matches.' : 'No living pets at this address yet. Hatch one first.');
    /* 2 · opponent */
    var tl = [['inc', '📥 Challenging you (' + inc.length + ')', inc.length], ['sug', '🎯 Suggested'], ['all', '🔎 Any pet']];
    h += head('2', s.tab === 'inc' ? 'Accept a challenge' : 'Opponent', 'ezFqB', s.qb, '') + tabs(tl, s.tab);
    var opp = [];
    if (s.tab === 'inc') { var ii = inc.filter(function (f) { return match(w.byId[f.a], s.qb) || match(w.byId[f.b], s.qb); });
      opp = ii.slice(0, MAX).map(function (f) { var Y = w.byId[f.a], X = w.byId[f.b]; return card(w, Y, { key: 'f' + f.id, on: s.inc === f.id, tag: 'vs your ' + esc(X.name) + ' #' + X.id, tagMe: true, lines: ['⚡ ' + pow(Y) + ' vs your ⚡ ' + pow(X), rec(Y) + ' · fight ' + f.id, '⏳ by block ' + fmt(f.expires)] }); });
      h += strip(opp, ii.length - MAX, 'No one is challenging your pets right now.'); }
    else { var th = UI.fighters(w, ME, true).filter(function (p) { return match(p, s.qb); }), ap = A ? pow(A) : 0;
      if (s.tab === 'sug') th.sort(function (a, b) { return A ? Math.abs(pow(a) - ap) - Math.abs(pow(b) - ap) || score(w, b) - score(w, a) : score(w, b) - score(w, a); });
      else th.sort(function (a, b) { return a.id - b.id; });
      if (B && !th.slice(0, MAX).some(function (p) { return p.id === B.id; })) th = [B].concat(th.filter(function (p) { return p.id !== B.id; }));
      opp = th.slice(0, MAX).map(function (p) { return card(w, p, { on: B && B.id === p.id && !s.inc, why: why(p, w), lines: lines(p).concat(['👤 ' + esc(short(p.owner))]) }); });
      h += strip(opp, th.length - MAX, A || s.qb ? 'No opponent matches.' : 'No opponent can fight today.'); }
    /* 3 · one button */
    var label, ok = false, hint = '';
    if (s.tab === 'inc' && s.inc) { var sw = UI.sendWhy ? UI.sendWhy({ tag: 'pet:accept:' + s.inc }) : null; ok = !sw; label = sw ? 'Can\u2019t accept: ' + sw : '🔥 Accept fight ' + s.inc + ' · burn ' + fmt(V().COSTS.accept) + ' XCPETS'; hint = 'Loser gives 1 random worn piece (★ safe) and gets a black eye.'; }
    else if (s.tab === 'inc') label = inc.length ? 'Tap a challenger above' : 'Pick 🎯 Suggested to start a fight';
    else if (!A) label = 'Pick your fighter (1)';
    else if (!B) label = 'Pick an opponent (2)';
    else { var wa = why(A, w), wb = why(B, w), sw2 = !wa && !wb && UI.sendWhy ? UI.sendWhy({ tag: 'pet:fight:' + A.id + ':' + B.id }) : null; ok = !wa && !wb && !sw2;
      label = ok ? '⚔️ Challenge #' + B.id + ' · burn ' + fmt(V().COSTS.fight) + ' XCPETS' : '✋ ' + (sw2 || (wa ? 'Your pet: ' + wa : 'Opponent: ' + wb));
      hint = 'Their owner has ' + V().FIGHT_WINDOW + ' blocks to accept. Loser gives 1 random worn piece (★ safe) and gets a black eye.'; }
    var cmp = ''; var CA = s.tab === 'inc' && s.inc ? w.byId[(w.fights[s.inc - 1] || {}).b] : A, CB = s.tab === 'inc' && s.inc ? w.byId[(w.fights[s.inc - 1] || {}).a] : B;
    if (CA && CB && (s.tab !== 'inc' || s.inc)) { var K = ['vigor', 'spark', 'grit', 'zoom', 'luck'];
      cmp = '<div class="ez-cmp"><b>' + esc(CA.name) + ' ⚡' + pow(CA) + '</b><span class="ez-vs">VS</span><b>' + esc(CB.name) + ' ⚡' + pow(CB) + '</b><span class="ez-st">' + K.map(function (k) { var a = (CA.stats || {})[k] || 0, b = (CB.stats || {})[k] || 0; return '<i class="' + (a > b ? 'up' : a < b ? 'dn' : '') + '" title="' + k + '">' + k.slice(0, 3).toUpperCase() + ' ' + a + '/' + b + '</i>'; }).join('') + '</span></div>'; }
    h += '<div class="ez-foot">' + cmp + '<div class="ez-acts"><button type="button" class="btn ico-flame ez-go" id="ezFGo"' + (ok ? '' : ' disabled') + '>' + esc(label) + '</button>' +
      (s.tab === 'inc' && s.inc ? '<button type="button" class="q" id="ezFIgn">Ignore</button>' : '<button type="button" class="q ez-qm" id="ezFQm">🎲 Quick match</button>') + '</div>' +
      '<div class="ez-hint">' + esc(s.msg || hint) + (view ? ' 👀 View only: connect the wallet that owns these pets to burn.' : '') + '</div></div></div>';
    el.innerHTML = h; sprites(el, w);
    el.querySelectorAll('[data-ez]').forEach(function (b) { b.onclick = function () { if (b.getAttribute('aria-disabled')) { UI.toast('#' + b.dataset.ez + ': ' + (b.querySelector('.ez-why') || {}).textContent); return; } var k = b.dataset.ez; s.msg = '';
      if (k[0] === 'f') { var f = w.fights[+k.slice(1) - 1]; s.inc = s.inc === f.id ? null : f.id; UXB.setFace(f.b, f.a); return; }
      var inMine = b.closest('.ez-strip') === el.querySelectorAll('.ez-strip')[0]; s.inc = null;
      if (inMine) UXB.setFace(FO.a === +k ? null : +k, undefined); else UXB.setFace(undefined, FO.b === +k ? null : +k); }; });
    el.querySelectorAll('[data-eztab]').forEach(function (b) { b.onclick = function () { s.tab = b.dataset.eztab; s.inc = null; s.msg = ''; fight(U().world()); }; });
    bindQ(el, 'ezFqA', function (v) { s.qa = v; }, function () { fight(U().world()); }); bindQ(el, 'ezFqB', function (v) { s.qb = v; }, function () { fight(U().world()); });
    var go = $('ezFGo'); if (go) go.onclick = function () {
      if (s.tab === 'inc' && s.inc) { var id = String(s.inc); return UI.confirmPlans('Accept fight ' + id, [{ tag: 'pet:accept:' + id, amount: (V2Rules.acceptCost ? V2Rules.acceptCost(V2Mock.world(), +(id)) : 690) }], function () { UI.afterAccept(id); }); }
      var g = $('foGo'); if (g && !g.disabled) g.click(); };
    var qm = $('ezFQm'); if (qm) qm.onclick = function () { var q = $('arQuick'); if (!q) return; if (s.tab === 'inc') s.tab = 'sug'; q.click(); var m = $('arQmsg'); s.msg = m ? m.textContent : ''; fight(U().world()); };
    var ig = $('ezFIgn'); if (ig) ig.onclick = function () { var id = s.inc; s.inc = null; UXB.ignoreFight(id); UI.toast('Ignored here. It expires on its own if nobody accepts.'); }; }

  // ================================================================ BREED
  function breed(w) { var bp = $('breedPanel'), UI = U(); if (!bp || !UI || !w) return; var el = $('ezBreed');
    if (!el) { el = document.createElement('div'); el.id = 'ezBreed'; el.className = 'ez ez-breed'; var at = $('motelReqs') || $('motelDesk'); bp.insertBefore(el, at); bp.classList.add('ez-on'); }
    keep(el, function () { paintBreed(el, w); }); }
  function incoming(w, ME, T) { var win = V().BREED_WINDOW || 144; return (w.breedReqs || []).filter(function (r) { var X = w.byId[r.b]; return !r.used && !(T && T - r.block > win) && X && X.owner === ME && r.owner !== ME; }).sort(function (a, b) { return b.block - a.block; }); }
  function paintBreed(el, w) { var UI = U(), Vr = V(), ME = UI.ME, T = tip(w), s = ST.b, view = UI.viewOnly && UI.viewOnly(), M = window.V2Motel;
    var a = $('bA').value, b = $('bB').value, L = Vr.breedPicker(w, ME, T, a, UI.pendingBreedIds ? UI.pendingBreedIds() : null), v2 = !!(Vr.breedV2On && Vr.breedV2On(T + 1));
    if (!ME) { el.innerHTML = '<div class="ez-box"><p class="ez-lead">💞 Pick Parent 1, pick a mate, ring the bell. Connect your XCP Wallet to check in.</p><button type="button" class="btn ico-egg ez-go" id="ezBGo">🔌 Connect XCP Wallet</button></div>';
      $('ezBGo').onclick = function () { $('bGo').click(); }; return; }
    var A = a && w.byId[a], Bp = b && w.byId[b], gen = function (p) { return Vr.genOf ? Vr.genOf(w, p) : 0; };
    var badges = function (p) { var x = Vr.breederBadges ? Vr.breederBadges(w, p) : []; return x.length ? x.map(function (q) { return '<span title="' + esc(q.name + ': ' + q.tip) + '">' + q.icon + '</span>'; }).join('') : ''; };
    var info = function (p) { var bl = v2 && Vr.breedsLeft ? Vr.breedsLeft(p, T + 1) : null, g = gen(p), bd = badges(p);
      return ['⭐ ' + score(w, p) + ' · ' + esc(spL(p.species)), (bl ? '💞 ' + bl.left + ' of ' + bl.cap + ' left' : '💞 bred ' + (p.breeds || 0) + '×') + ' · Gen ' + g + (bd ? ' ' + bd : '')]; };
    var kin = function (p) { return v2 && A && Vr.kinWhy ? Vr.kinWhy(A, p) : null; };
    var okA = L.mine.filter(function (x) { return !x.why && x.p.stage >= 3; }), reqs = incoming(w, ME, T);
    if (s.req && !reqs.some(function (r) { return r.b + ':' + r.a === s.req; })) s.req = null;
    if (!s.tab) s.tab = reqs.length ? 'asks' : 'mine';
    var h = '<div class="ez-box">';
    /* 1 · parent 1 */
    var mq = okA.filter(function (x) { return match(x.p, s.qa); }).sort(function (x, y) { return score(w, y.p) - score(w, x.p) || x.p.id - y.p.id; });
    if (A && !mq.slice(0, MAX).some(function (x) { return x.p.id === A.id; }) && A.owner === ME) mq = [{ p: A }].concat(mq.filter(function (x) { return x.p.id !== A.id; }));
    h += head('1', 'Parent 1 · your pet', 'ezBqA', s.qa, '<span class="ez-cnt">' + fmt(okA.length) + ' of ' + fmt(L.mine.length) + ' can breed now</span>') +
      strip(mq.slice(0, MAX).map(function (x) { return card(w, x.p, { on: A && A.id === x.p.id && !s.req, lines: info(x.p) }); }), mq.length - MAX, L.mine.length ? (okA.length ? 'No pet matches.' : 'None of your pets can breed right now (Adult+, fed, off cooldown).') : 'No living pets at this address yet.');
    /* 2 · mate */
    var tl = [['mine', '🏠 My other pets'], ['asks', '💌 Asking you (' + reqs.length + ')', reqs.length], ['other', '🌍 Other wallets']];
    h += head('2', s.tab === 'asks' ? 'Breed requests for you' : 'Mate', 'ezBqB', s.qb, '') + tabs(tl, s.tab);
    if (s.tab === 'asks') { var rr = reqs.filter(function (r) { return match(w.byId[r.a], s.qb) || match(w.byId[r.b], s.qb); });
      h += strip(rr.slice(0, MAX).map(function (r) { var Y = w.byId[r.a], X = w.byId[r.b], k = r.b + ':' + r.a, kw = v2 && Vr.kinWhy ? Vr.kinWhy(X, Y) : null;
        return card(w, Y, { key: 'r' + k, on: s.req === k, why: kw ? kw + ' (no inbreeding)' : null, tag: 'asks your ' + esc(X.name) + ' #' + X.id, tagMe: true, lines: info(Y).concat(['👤 ' + esc(short(Y.owner)) + ' · until ' + fmt(r.block + (Vr.BREED_WINDOW || 144))]) }); }), rr.length - MAX, 'No one has asked your pets yet.'); }
    else { var pool = L.partners.filter(function (x) { return !x.why && x.p.stage >= 3 && (s.tab === 'mine' ? x.p.owner === ME : x.p.owner !== ME) && match(x.p, s.qb); })
        .sort(function (x, y) { return (!!kin(x.p) - !!kin(y.p)) || score(w, y.p) - score(w, x.p) || x.p.id - y.p.id; });
      if (Bp && !s.req && !pool.slice(0, MAX).some(function (x) { return x.p.id === Bp.id; }) && (s.tab === 'mine') === (Bp.owner === ME)) pool = [{ p: Bp }].concat(pool.filter(function (x) { return x.p.id !== Bp.id; }));
      h += strip(pool.slice(0, MAX).map(function (x) { var k = kin(x.p); return card(w, x.p, { on: Bp && Bp.id === x.p.id && !s.req, why: k ? k + ' (no inbreeding)' : null, lines: info(x.p).concat(x.p.owner !== ME ? ['👤 ' + esc(short(x.p.owner))] : []) }); }), pool.length - MAX,
        s.tab === 'mine' ? 'No other pet of yours can breed right now.' : 'No pet matches. Search by #, name, species or the start of a wallet address.'); }
    /* 3 · one button (the motel bell / the desk Accept, unchanged) */
    var label, ok = false, hint = '', P1 = A, P2 = Bp;
    if (s.tab === 'asks' && s.req) { var q = s.req.split(':'), acc = document.querySelector('#motelReqs [data-bracc="' + s.req + '"]'), no = document.querySelector('#motelReqs [data-mrk="' + s.req + '"] .mr-no');
      P1 = w.byId[q[0]]; P2 = w.byId[q[1]]; ok = !!acc; label = acc ? '💞 Accept request · burn ' + (window.V2Rules && V2Rules.uiBreedFeeStr ? V2Rules.uiBreedFeeStr() : '690') + ' XCPETS' : '🚫 ' + (no ? no.textContent.replace(/^🚫\s*/, '') : 'Can\u2019t accept this request right now'); hint = 'The egg goes to the requester.'; }
    else if (s.tab === 'asks') label = reqs.length ? 'Tap a request above' : 'Pick 🏠 My other pets or 🌍 Other wallets';
    else if (!A) label = 'Pick Parent 1 (1)';
    else if (!Bp) label = 'Pick a mate (2)';
    else { var bell = $('bGo'); ok = bell && !bell.disabled; label = '🛎️ ' + (bell ? bell.textContent.replace(/^🛎️\s*/, '') : 'Check in · 690') + ' XCPETS';
      hint = Bp.owner === ME ? 'Both yours: one burn, the egg appears when it confirms.' : 'Another wallet\u2019s pet: their owner has ' + (Vr.BREED_WINDOW || 144) + ' blocks to accept at Gooby\u2019s desk.'; }
    var od = '';
    if (P1 && P2 && M && M.odds) { try { var o = M.odds(Vr, P1, P2); od = '<div class="ez-odds"><b>ODDS</b> ' + o.sp.map(function (x) { return esc(x[0]) + ' ' + x[1].toFixed(x[1] === 100 ? 0 : 1) + '%'; }).join(' · ') + ' · ' + TL[o.hiT] + ' ' + o.tier.hi.toFixed(1) + '%' + (o.tier.up ? ' · ⬆ ' + TL[Math.min(3, o.hiT + 1)] + ' ' + o.tier.up.toFixed(1) + '%' : '') + (o.tier.lo ? ' · ' + TL[o.loT] + ' ' + o.tier.lo.toFixed(1) + '%' : '') + '</div>'; } catch (e) { od = ''; }
      if (v2 && P1.species !== P2.species) od += '<div class="ez-hint">🧬 Different species: body parts can trade in the egg.</div>'; }
    h += '<div class="ez-foot">' + od + '<div class="ez-acts"><button type="button" class="btn ico-egg ez-go" id="ezBGo"' + (ok ? '' : ' disabled') + '>' + esc(label) + '</button></div><div class="ez-hint">' + esc(hint) + (view ? ' 👀 View only: connect the wallet that owns these pets to burn.' : '') + '</div></div></div>';
    el.innerHTML = h; sprites(el, w);
    var pick = function (side, id) { $(side === 'A' ? 'bA' : 'bB').value = id; if (side === 'A' && $('bB').value === id) $('bB').value = ''; var S = M && M._state ? M._state() : null; if (S) { S.fresh = null; S.pickSide = null; if (id) { S.bubble = 'Room #' + id + '? Gooby pls.'; S.lt = performance.now(); } } UI.render(); };
    el.querySelectorAll('[data-ez]').forEach(function (bt) { bt.onclick = function () { if (bt.getAttribute('aria-disabled')) { UI.toast((bt.querySelector('.ez-why') || {}).textContent || ''); return; } var k = bt.dataset.ez;
      if (k[0] === 'r') { k = k.slice(1); if (s.req === k) { s.req = null; breed(U().world()); return; } s.req = k; var q2 = k.split(':'); $('bA').value = q2[0]; $('bB').value = q2[1]; pick('B', q2[1]); return; }
      s.req = null; var first = bt.closest('.ez-strip') === el.querySelectorAll('.ez-strip')[0];
      if (first) pick('A', $('bA').value === k ? '' : k); else pick('B', $('bB').value === k ? '' : k); }; });
    el.querySelectorAll('[data-eztab]').forEach(function (bt) { bt.onclick = function () { s.tab = bt.dataset.eztab; s.req = null; breed(U().world()); }; });
    bindQ(el, 'ezBqA', function (v) { s.qa = v; }, function () { breed(U().world()); }); bindQ(el, 'ezBqB', function (v) { s.qb = v; }, function () { breed(U().world()); });
    $('ezBGo').onclick = function () { if (s.tab === 'asks' && s.req) { var acc = document.querySelector('#motelReqs [data-bracc="' + s.req + '"]'); if (acc) acc.click(); return; } var bell = $('bGo'); if (bell && !bell.disabled) bell.click(); }; }

  /* hooks: repaint after the existing face-off / motel renders (their state stays the single source of truth) */
  window.V2Easy = { fight: function (w) { try { fight(w); } catch (e) { console.warn('easy fight', e); } }, breed: function (w) { try { breed(w); } catch (e) { console.warn('easy breed', e); } } };
  if (window.V2Motel && V2Motel.render) { var mr = V2Motel.render; V2Motel.render = function (w) { var r = mr.apply(this, arguments); V2Easy.breed(w); return r; }; }
  if (!document.getElementById('ezCss')) { var cs = document.createElement('style'); cs.id = 'ezCss';
    cs.textContent = '.ez-on>#faceoff,.ez-on>.ar-h{display:none}#breedPanel.ez-on .motel-bell,#breedPanel.ez-on #motelDesk .mt-guests,#breedPanel.ez-on #motelDesk .mt-browse,#breedPanel.ez-on #motelDesk #motelPick,#breedPanel.ez-on #motelDesk .mt-odds,#breedPanel.ez-on #motelDesk .mt-hint{display:none}' +
      '.ez{margin:8px 0}.ez-box{border:3px solid #000;background:#1b1530;box-shadow:4px 4px 0 #000;padding:8px;min-width:0}.ez-breed .ez-box{background:#2a1530}.ez-lead{margin:4px 0 8px;color:#fff}' +
      '.ez-hd{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;margin:4px 0}.ez-hd b{color:#ffd166;font-size:15px}.ez-n{display:inline-flex;width:24px;height:24px;align-items:center;justify-content:center;background:#ffd166;color:#140f24;font-weight:700;border:2px solid #000}' +
      '.ez-q{flex:1 1 140px;min-width:0;max-width:260px;min-height:36px;padding:4px 8px;border:2px solid #000;background:#fff8e1;color:#1b1b1b;font:inherit;font-size:14px}.ez-cnt{font-size:12px;color:#9fe8ff}' +
      '.ez-strip{display:flex;gap:6px;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x proximity;padding:4px 2px 8px;min-width:0;-webkit-overflow-scrolling:touch}' +
      '.ez-c{flex:0 0 112px;scroll-snap-align:start;display:flex;flex-direction:column;align-items:center;gap:2px;padding:5px 4px;border:2px solid #4b3f7a;background:#120e22;color:#fff;font:inherit;font-size:12px;line-height:1.25;cursor:pointer;position:relative;text-align:center;min-width:0}' +
      '.ez-c:hover{border-color:#9fe8ff}.ez-c.on{border:3px solid #ffd166;background:#3a2a10;box-shadow:0 0 0 2px #000}.ez-c.on::before{content:"▼";position:absolute;top:-4px;left:50%;transform:translateX(-50%);color:#ffd166;font-size:12px}.ez-c.no{opacity:.55}' +
      '.ez-sp canvas{width:56px;height:56px;image-rendering:pixelated;display:block}.ez-nm{font-size:13px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ez-id{color:#b9b0d6}.ez-c .pill.tier{font-size:11px;white-space:nowrap}' +
      '.ez-l{color:#d9d2f0;max-width:100%;overflow-wrap:anywhere}.ez-why{color:#ff9a9a;font-weight:700}.ez-tag{font-size:10px;font-weight:700;background:#4b3f7a;padding:1px 3px;max-width:100%;overflow-wrap:anywhere}.ez-tag.me{background:#4fd18b;color:#0d1a12}' +
      '.ez-more,.ez-empty{flex:0 0 auto;align-self:center;color:#9fe8ff;font-size:13px;padding:6px;margin:0}' +
      '.ez-tabs{display:flex;flex-wrap:wrap;gap:6px;margin:2px 0 4px}.ez-tab{min-height:36px;padding:4px 10px;border:2px solid #000;background:#f5efe0;color:#2a1530;font:inherit;font-size:13px;box-shadow:2px 2px 0 #000;cursor:pointer}.ez-tab.on{background:#4fd18b;color:#0d1a12}.ez-tab.hot:not(.on){background:#ff9ad5}' +
      '.ez-foot{border-top:2px dashed #4b3f7a;margin-top:4px;padding-top:6px}.ez-acts{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.ez-go{flex:1 1 260px;min-height:52px;font-size:17px}.ez-go[disabled]{opacity:.6;cursor:default}' +
      '.ez-hint{font-size:12px;color:#c9c0e6;margin-top:4px;overflow-wrap:anywhere}.ez-odds{font-size:13px;background:#ffd166;color:#1b1b1b;border:2px solid #000;padding:4px 6px;margin-bottom:6px;overflow-wrap:anywhere}' +
      '.ez-cmp{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;font-size:13px;margin-bottom:6px;color:#fff}.ez-vs{color:#ff5a7a;font-weight:700}.ez-st{display:flex;flex-wrap:wrap;gap:4px;flex-basis:100%}.ez-st i{font-style:normal;font-size:11px;padding:1px 4px;background:#2a2342}.ez-st i.up{color:#4fd18b}.ez-st i.dn{color:#ff8080}' +
      '@media (max-width:520px){.ez-tabs{flex-wrap:nowrap;overflow-x:auto;padding-bottom:3px}.ez-tab{flex:0 0 auto;white-space:nowrap;font-size:12px;padding:4px 8px}.ez-c{flex-basis:100px}.ez-sp canvas{width:48px;height:48px}.ez-go{font-size:15px;flex-basis:100%}.ez-q{max-width:none}}';
    (document.head || document.documentElement).appendChild(cs); }
  var w0 = window.V2UI && V2UI.world && V2UI.world(); if (w0) { if (window.UXB && UXB.setFace) { V2Easy.fight(w0); } V2Easy.breed(w0); }
})();
