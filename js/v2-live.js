/* XCPETS live activity ("what just happened"), live.html. Owner Nov 1 2026 12:23 AM CT [pt2539u]: "Yeah build one".
 * DISPLAY ONLY: reads the replayed world (w.log, pets, zombies) after V2Mock.boot; never touches rules, tags, burns, costs or the replay.
 * No wallet needed. Newest first: hatches, feeds, stage-ups, starvation, zombies, seances and raises, Gods and the Mythic God loop,
 * gear rolls, gifts and swaps, grants and 1-of-1 arrivals. Each row: time (CT), block, the pet's sprite, one plain line, a link to its pet page.
 * Stage-ups and starvation have no log line of their own: stage-ups are worked out by walking each fed pet's care back meal by meal
 * (V2Rules.mealFor / petThresholds, the same numbers the replay used), starvation from each dead pet's death block.
 * Block times: Counterparty Core (api.counterparty.io:4000, then api.unspendablelabs.com:4000), cached per browser; until a block's time is
 * read it shows an estimate (~, 10 minutes a block). Never api.xcp.fun.
 * Tap a row to replay its pixel animation (js/v2-life-anim.js, js/v2-cem-anim.js, js/v2-mg-anim.js, loaded on the first tap). */
(function (root) {
  'use strict';
  var WINDOW = 2016, PAGE = 60, NOPE = /crown|frame|fire|flame|aura/i;
  var CORE = ['https://api.counterparty.io:4000/v2', 'https://api.unspendablelabs.com:4000/v2'];

  /* ---------------- events (pure: also run by tools/live-activity-test.js in node) ---------------- */
  function nums(s) { return (String(s || '').match(/#(\d+)/g) || []).map(function (x) { return +x.slice(1); }); }
  function range(msg) { var m = /#(\d+)-#(\d+)/.exec(msg || ''); if (!m) return []; var a = +m[1], b = +m[2], o = []; for (var i = a; i <= b && o.length < 5000; i++) o.push(i); return o; }
  function tierOf(p) { return p ? (p.tier | 0) : 0; }
  function best(w, ids) { var by = w.byId || {}, L = ids.map(function (i) { return by[i]; }).filter(Boolean); L.sort(function (a, b) { return tierOf(b) - tierOf(a) || a.id - b.id; }); return L; }
  function tierCounts(V, L) { var c = {}; L.forEach(function (p) { var t = tierOf(p); if (t >= 2) c[t] = (c[t] || 0) + 1; }); var lab = (V && V.TIER_LABELS) || ['Common', 'Uncommon', 'Rare', 'Legendary'];
    return [3, 2].filter(function (t) { return c[t]; }).map(function (t) { return c[t] + ' ' + lab[t]; }).join(', '); }
  function itemOf(msg) { var m = /: ([^:·]+?\([A-Za-z ]+\))/.exec(msg || ''); return m ? m[1].trim().replace(/^free roll /, '') : ''; }

  /* stage-ups: a pet's care replayed meal by meal from its hatch (V2Rules.mealFor / petThresholds, the replay's own numbers). A pet whose
   * replayed care does not land exactly on its care now (a zombie, a God, anything else that moved its care) gets no stage-up rows. */
  function stageUps(V, w, feeds, from) { var out = {}, by = w.byId || {};
    Object.keys(feeds).forEach(function (id) { var p = by[id], F = feeds[id]; if (!p || p.community || p.zombie || p.resurrected || p.mythicGod || p.ascended || p.care == null) return;
      var starts = [0, 69], hit = null;
      try { var th0 = V.petThresholds(w, p, F[0].block); starts = [0, (th0.meal || th0)[1]]; } catch (e) {}
      for (var s = 0; s < starts.length && !hit; s++) { var c = starts[s], ups = [], ok = true;
        for (var i = 0; i < F.length; i++) { var b = F[i].block, th, m; try { th = V.petThresholds(w, p, b); m = V.mealFor(c, p.species, b, th); } catch (e) { ok = false; break; }
          var disp = Array.isArray(th) ? th : (th.stage || th), s0 = V.stageFor(c, disp); c += m || 0; var s1 = V.stageFor(c, disp);
          if (s1 > s0 && s1 >= 2 && b >= from) ups.push({ tx: F[i].tx, block: b, to: s1 }); }
        if (ok && c === p.care) hit = ups; }
      if (hit) hit.forEach(function (u) { out[u.tx + ':' + id] = u.to; }); });
    return out; }
  function events(w, V, opt) { opt = opt || {}; var tip = w.tip || 0, from = tip - (opt.window || WINDOW), by = w.byId || {}, out = [], log = w.log || [];
    function P(id) { return by[id]; }
    function add(e) { if (e.block == null || e.block < from || e.block > tip) return; out.push(e); }
    var feeds = {}, fedIn = {};
    log.forEach(function (l) { if (l.kind !== 'feed' || l.block == null) return; var ids = l.petIds || (l.petId != null ? [l.petId] : []); ids.forEach(function (id) { (feeds[id] = feeds[id] || []).push(l); if (l.block >= from) fedIn[id] = 1; }); });
    Object.keys(feeds).forEach(function (id) { if (!fedIn[id]) delete feeds[id]; });
    var UP = stageUps(V, w, feeds, from);
    for (var i = log.length - 1; i >= 0; i--) { var l = log[i], b = l.block; if (b == null) continue; if (b < from) break; var k = l.kind, m, ids, p = P(l.petId);
      try {
        if (k === 'hatch') {
          if (/^XCPETS:/.test(l.tx || '') || /: egg #\d+/.test(l.msg || '')) { var ap = P(l.petId) || P(nums(l.msg)[0]); if (!ap) continue;
            var title = (ap.supreme && ap.supreme.title) || (ap.contest && ap.contest.title) || (ap.burnLord ? 'Burn Lord ' + ap.burnLord.n + ' of ' + ap.burnLord.of : '');
            add({ block: b, tx: l.tx, cat: 'birth', icon: '🌟', pet: ap.id, t: [title ? title + ': ' : '', { pet: ap.id }, ' arrived as an egg' + (ap.supreme || ap.contest ? ' (1 of 1)' : '')],
              anim: { lib: 'life', ev: { kind: 'arrival', ids: [ap.id], n: 1, ed: ap.burnLord ? 'BURN LORD ' + ap.burnLord.n + '/' + ap.burnLord.of : '1 OF 1!', title: title, gear: [], ng: 0, egg: true, block: b } } }); continue; }
          ids = /#\d+-#\d+/.test(l.msg || '') ? range(l.msg) : [l.petId || nums(l.msg)[0]]; var L = best(w, ids); if (!L.length) continue; var top = L[0], tc = tierCounts(V, L), elec = /Electric/.test(l.msg || '');
          var tl = ((V && V.TIER_LABELS) || [])[tierOf(top)] || '', spl = V && V.speciesLabel ? V.speciesLabel(top.species) : top.species;
          add({ block: b, tx: l.tx, cat: 'birth', icon: tierOf(top) >= 3 ? '🌟' : tierOf(top) >= 2 ? '✨' : '🐣', pet: top.id, hot: tierOf(top) >= 2, ids: ids,
            t: L.length === 1 ? [{ pet: top.id }, ' hatched: a ' + tl + ' ' + spl] : [(elec ? 'An Electric Egg case' : 'A pack of ' + L.length + ' eggs') + ' hatched' + (tc ? ' (' + tc + ')' : '') + '. Best: ', { pet: top.id }, ', ' + tl + ' ' + spl],
            anim: { lib: 'life', ev: { kind: L.length > 5 ? 'hatch-bulk' : 'hatch', ids: L.slice(0, 5).map(function (q) { return q.id; }), n: L.length } } }); continue; }
        if (k === 'breed') { ids = nums(l.msg); var kid = P(l.petId); if (!kid) continue; var rug = /^Rug Me/.test(l.msg || ''), par = kid.parents || [], tw = kid.twinOf && P(kid.twinOf);
          add({ block: b, tx: l.tx, cat: 'birth', icon: '🥚', pet: kid.id, t: rug ? ['Rug Me match: ', { pet: kid.id }, ' was laid'] : par.length === 2 ? [{ pet: par[0] }, ' and ', { pet: par[1] }, ' bred ', { pet: kid.id }].concat(tw ? [' and a twin, ', { pet: tw.id }] : []) : [{ pet: kid.id }, ' was bred'],
            anim: { lib: 'life', ev: { kind: 'hatch', ids: [kid.id].concat(tw ? [tw.id] : []), n: tw ? 2 : 1 } } }); continue; }
        if (k === 'feed') { ids = l.petIds || (l.petId != null ? [l.petId] : []); if (!ids.length) continue;
          add({ block: b, tx: l.tx, cat: 'feed', icon: '🍖', pet: ids[0], ids: ids, t: ids.length === 1 ? [{ pet: ids[0] }, ' was fed'] : [ids.length + ' pets were fed in one burn, from ', { pet: ids[0] }],
            anim: { lib: 'life', ev: { kind: 'feed', ids: ids.slice(0, 5), n: ids.length } } });
          ids.forEach(function (id) { var s1 = UP[l.tx + ':' + id]; if (s1) { var nm5 = s1 >= 5;
              add({ block: b, tx: l.tx, cat: nm5 ? 'mythic' : 'stage', icon: nm5 ? '🌕' : '⬆️', pet: id, hot: nm5, t: nm5 ? [{ pet: id }, ' reached Mythic and never starves now'] : [{ pet: id }, ' grew to ' + (((V && V.STAGE_NAMES) || [])[s1] || 'stage ' + s1)],
                anim: { lib: 'life', ev: nm5 ? { kind: 'mythic', ids: [id], n: 1 } : { kind: 'stage', ids: [id], to: Math.min(4, s1), n: 1 } } }); } }); continue; }
        if (k === 'raise') { if (!p) continue; m = /\(([\d.]+) times its death power\)/.exec(l.msg || ''); var mgz = !!p.mgDead;
          add({ block: b, tx: l.tx, cat: 'death', icon: mgz ? '💜' : '🧟', pet: p.id, t: [{ pet: p.id }, mgz ? ' rose from its violet grave as a Mythic zombie' : ' rose as a zombie' + (m ? ' (' + m[1] + ' times its death power)' : '')], anim: { lib: 'cem', ev: { kind: mgz ? 'mgraise' : 'raise', id: p.id, block: b } } }); continue; }
        if (k === 'zfeed') { if (!p) continue; m = /\((#[\d, #]+)\)/.exec(l.msg || ''); ids = m ? nums(m[1]) : [];
          add({ block: b, tx: l.tx, cat: 'death', icon: '🧟', pet: p.id, t: ['Zombie ', { pet: p.id }, ' ate ' + (ids.length === 1 ? '' : ids.length + ' pets: ')].concat(ids.slice(0, 3).reduce(function (a, id, j) { return a.concat(j ? [', '] : [], [{ pet: id }]); }, [])).concat(ids.length > 3 ? [' and ' + (ids.length - 3) + ' more'] : []),
            anim: { lib: 'cem', ev: { kind: 'zmeal', id: p.id, victims: ids, block: b } } }); continue; }
        if (k === 'crumble') { if (!p) continue; add({ block: b, tx: l.tx, cat: 'death', icon: '🪦', pet: p.id, t: ['Zombie ', { pet: p.id }, ' went unfed and crumbled back into its grave'], anim: { lib: 'cem', ev: { kind: 'crumble', id: p.id, block: b } } }); continue; }
        if (k === 'hunt') { ids = nums(l.msg); var won = /laid to rest/.test(l.msg || ''); if (ids.length < 2) continue;
          add({ block: b, tx: l.tx, cat: 'death', icon: won ? '🏹' : '🤕', pet: ids[1], t: won ? [{ pet: ids[0] }, ' hunted zombie ', { pet: ids[1] }, ' and laid it to rest'] : [{ pet: ids[0] }, ' lost a hunt on zombie ', { pet: ids[1] }, ' (a black eye, nothing else)'],
            anim: won ? { lib: 'cem', ev: { kind: 'hunted', id: ids[1], block: b } } : { lib: 'life', ev: { kind: 'hunt-lost', ids: [ids[0], ids[1]], n: 1 } } }); continue; }
        if (k === 'rpl') { if (!p) continue; m = /pledged (\d+)/.exec(l.msg || ''); var pts = /\((\d+) points\)/.exec(l.msg || '');
          add({ block: b, tx: l.tx, cat: 'death', icon: '🕯️', pet: p.id, t: ['Seance: ' + (m ? m[1] : 'more') + ' pledged to the Resurrection of ', { pet: p.id }, pts ? ' (' + pts[1] + ' points)' : ''], anim: { lib: 'cem', ev: { kind: 'pledge', id: p.id, victims: [], pts1: pts ? +pts[1] : 0, block: b } } }); continue; }
        if (k === 'pledge') { if (!p) continue; m = /closes at block (\d+)/.exec(l.msg || '');
          add({ block: b, tx: l.tx, cat: 'death', icon: '🕯️', pet: p.id, t: ['A pledge to the Resurrection altar on ', { pet: p.id }], anim: { lib: 'life', ev: { kind: 'altar', ids: [p.id], np: 0, ng: 0, gear: [], n: 1, closes: m ? +m[1] : null } } }); continue; }
        if (k === 'resurrect') { if (!p) continue; m = /roll (\d+), needed under (\d+)/.exec(l.msg || ''); var ok = /ALIVE again/.test(l.msg || '');
          add({ block: b, tx: l.tx, cat: ok ? 'god' : 'death', icon: ok ? '😇' : '💨', pet: p.id, hot: ok, t: ok ? [{ pet: p.id }, ' is ALIVE again as a God' + (m ? ' (rolled ' + m[1] + ', needed under ' + m[2] + ')' : '')] : [{ pet: p.id }, ': the Resurrection failed and it turned to dust' + (m ? ' (rolled ' + m[1] + ', needed under ' + m[2] + ')' : '')],
            anim: ok ? { lib: 'life', ev: { kind: 'god', ids: [p.id], n: 1 } } : { lib: 'cem', ev: { kind: p.mgDead ? 'mgrise-fail' : 'resurrect-fail', id: p.id, roll: m ? +m[1] : 0, need: m ? +m[2] : 0, block: b } } }); continue; }
        if (k === 'unleash') { if (!p) continue; m = /at block (\d+)/.exec(l.msg || '');
          add({ block: b, tx: l.tx, cat: 'god', icon: '🩸', pet: p.id, hot: true, t: ['Zombie ', { pet: p.id }, ' was UNLEASHED: it eats one of its owner\u2019s Mythics' + (m ? ' at block ' + Number(m[1]).toLocaleString('en-US') : '')], anim: { lib: 'cem', ev: { kind: 'unleash', id: p.id, mealAt: m ? +m[1] : null, block: b } } }); continue; }
        if (k === 'mgmeal') { if (!p) continue;
          add({ block: b, tx: l.tx, cat: 'god', icon: '🌙', pet: p.id, hot: true, t: ['Zombie ', { pet: p.id }, ' ate the Mythic ', { pet: l.mythic }, ' and is Mythic-fed now'], anim: { lib: 'cem', ev: { kind: 'mgmeal', id: p.id, victims: [l.mythic], block: b } } }); continue; }
        if (k === 'mgcancel') { if (!p) continue; add({ block: b, tx: l.tx, cat: 'god', icon: '🛡️', pet: p.id, t: ['The unleash of ', { pet: p.id }, ' was called off. Nothing was eaten'], anim: { lib: 'cem', ev: { kind: 'mgcancel', id: p.id, victims: [], block: b } } }); continue; }
        if (k === 'mgrise') { if (!p) continue; m = /roll (\d+), needed under (\d+)/.exec(l.msg || '');
          add({ block: b, tx: l.tx, cat: 'god', icon: '🌕', pet: p.id, hot: true, t: [{ pet: p.id }, ' rose as a MYTHIC GOD: seat ' + (l.seat || '?') + ' of 21 in the Pantheon'], anim: { lib: 'cem', ev: { kind: 'mgrise-win', id: p.id, seat: l.seat || 1, roll: m ? +m[1] : 0, need: m ? +m[2] : 0, block: b } } }); continue; }
        if (k === 'roll' || (k === 'token' && l.gid)) { if (l.spins && l.spins.length) { var sp = l.spins.length;
            add({ block: b, tx: l.tx, cat: 'gear', icon: '🎡', pet: l.petId, t: [sp + ' saved Pepe Wheel spin' + (sp === 1 ? ' was' : 's were') + ' used: ' + sp + ' new gear piece' + (sp === 1 ? '' : 's') + ', the first on ', { pet: l.petId }] }); continue; }
          if (!p) continue; var it = itemOf(l.msg), G = l.gid && w.items && w.items[l.gid], wheel = /^Pepe Wheel/.test(l.msg || ''), tok = k === 'token';
          add({ block: b, tx: l.tx, cat: 'gear', icon: wheel ? '🎡' : tok ? '🎁' : '🎲', pet: p.id, t: wheel ? ['The Pepe Wheel picked ', { pet: p.id }, it ? ': ' + it : ''] : tok ? [{ pet: p.id }, ' found a roll token' + (it ? ': ' + it : '')] : [{ pet: p.id }, (l.free ? ' got a free roll' : ' rolled gear') + (it ? ': ' + it : '')],
            anim: G && G.item && !NOPE.test(G.item) ? { lib: 'life', ev: { kind: 'gear', ids: [p.id], n: 1, item: G.item, label: it || 'a new piece', tier: G.legendary ? 3 : (G.tier | 0), slot: G.slot || '', bag: G.bag != null } } : null }); continue; }
        if (k === 'croll') { add({ block: b, tx: l.tx, cat: 'gear', icon: '🎲', t: ['Community roll: the community pet got ' + (/got (.+)$/.exec(l.msg || '') || [, 'a new piece'])[1]] }); continue; }
        if (k === 'founder') { add({ block: b, tx: l.tx, cat: 'gear', icon: '📦', t: ['A Founder kit grant landed: five gold pieces and 36 free rolls'], anim: { lib: 'life', ev: { kind: 'grant', src: 'founder', label: 'Founder kit', items: ['golden-sword', 'gold', 'goldcape', 'v2-gold-aviators'], n: 4, rolls: 36, free: true, block: b } } }); continue; }
        if (k === 'grant') { m = /(\d+) addresses/.exec(l.msg || ''); var fl = /Kekistan flag/.test(l.msg || '');
          add({ block: b, tx: l.tx, cat: 'gear', icon: fl ? '🚩' : '📦', t: [fl ? 'Kekistan flag grant: ' + (m ? m[1] + ' players' : 'players') + ' with a living pet got one flag each' : 'A grant landed'], anim: fl ? { lib: 'life', ev: { kind: 'grant', src: 'ft-flag-grant', label: 'Kekistan flag', items: ['ft-kek-flag'], n: 1, rolls: 0, free: false, block: b } } : null }); continue; }
        if (k === 'fightDone') { ids = nums(l.msg).filter(function (x) { return by[x]; }); m = /took (.+)$/.exec(l.msg || ''); if (ids.length < 2) continue;
          add({ block: b, tx: l.tx, cat: m ? 'gear' : 'other', icon: '⚔️', pet: ids[0], t: [{ pet: ids[0] }, ' beat ', { pet: ids[1] }, ' in a fight' + (m ? ' and took ' + m[1] : '')] }); continue; }
        if (k === 'gift') { ids = l.petIds || [l.petId]; add({ block: b, tx: l.tx, cat: 'other', icon: '🎁', pet: ids[0], t: ids.length === 1 ? [{ pet: ids[0] }, ' was gifted to a new owner'] : [ids.length + ' pets were gifted, from ', { pet: ids[0] }], anim: { lib: 'life', ev: { kind: 'gift-out', ids: ids.slice(0, 1), n: 1, amt: '', who: '' } } }); continue; }
        if (k === 'swap') { ids = l.petIds || []; if (ids.length < 2) continue; add({ block: b, tx: l.tx, cat: 'other', icon: '🔁', pet: ids[0], t: [{ pet: ids[0] }, ' and ', { pet: ids[1] }, ' swapped owners'], anim: { lib: 'life', ev: { kind: 'swap', ids: ids.slice(0, 2), n: 1, swap: 1 } } }); continue; }
        if (k === 'quest') { if (!p) continue; var qa = /set off on (.+?)(?: \(|:)/.exec(l.msg || ''), qb = /came home from (.+?): (.+)$/.exec(l.msg || '');
          add({ block: b, tx: l.tx, cat: 'other', icon: '🧭', pet: p.id, t: qb ? [{ pet: p.id }, ' came home from ' + qb[1] + ': ' + qb[2]] : [{ pet: p.id }, ' set off on ' + (qa ? qa[1] : 'a quest')] }); continue; }
      } catch (e) { if (root.console) console.warn('[live] event', k, e); }
    }
    /* starvation: one row per death block */
    var dead = {}; (w.pets || []).forEach(function (q) { if (!q || q.released || q.community || q.mgDead) return; var d = q.zFirstDeath || (q.deathBlock != null && q.deathBlock <= tip && (q.dead || q.zombie || q.zPast) ? q.deathBlock : null);
      if (d == null || d < from || d > tip) return; (dead[d] = dead[d] || []).push(q); });
    Object.keys(dead).forEach(function (d) { var L = dead[d].sort(function (a, b) { return tierOf(b) - tierOf(a) || a.id - b.id; }), n = L.length;
      add({ block: +d, tx: 'starve:' + d, cat: 'death', icon: '🪦', pet: L[0].id, dead: true, ids: L.map(function (q) { return q.id; }),
        t: n === 1 ? [{ pet: L[0].id }, ' starved (never fed in time)'] : [n.toLocaleString('en-US') + ' pets starved when the day turned over, including '].concat(L.slice(0, 2).reduce(function (a, q, j) { return a.concat(j ? [' and '] : [], [{ pet: q.id }]); }, [])),
        anim: { lib: 'life', ev: { kind: 'starve', ids: [L[0].id], n: 1, block: +d } } }); });
    var ORD = { death: 0, birth: 1, god: 2, mythic: 3, stage: 4, gear: 5, feed: 6, other: 7 };
    out.forEach(function (e, j) { e.j = j; });
    out.sort(function (a, b) { return b.block - a.block || (ORD[a.cat] - ORD[b.cat]) || a.j - b.j; });
    /* the same line twice in one block (two pledges to one altar, say) shows once, with a count */
    var key = function (e) { return e.block + '|' + e.cat + '|' + JSON.stringify(e.t); }, res = [], last = null;
    out.forEach(function (e) { var k2 = key(e); if (last && last.k === k2) { last.e.n = (last.e.n || 1) + 1; return; } last = { k: k2, e: e }; res.push(e); });
    res.forEach(function (e) { if (e.n > 1) e.t = e.t.concat([' (' + e.n + ' times in this block)']); });
    return res; }
  var FILTERS = { all: null, births: { birth: 1 }, deaths: { death: 1 }, gods: { god: 1 }, gear: { gear: 1 } };
  var API = { events: events, FILTERS: FILTERS, WINDOW: WINDOW };
  if (typeof module !== 'undefined' && module.exports) { module.exports = API; return; }
  root.V2Live = API;
  if (typeof document === 'undefined') return;

  /* ---------------- page ---------------- */
  var M = root.V2Mock, R = root.V2Render, V = root.V2Rules, $ = function (id) { return document.getElementById(id); };
  var BUILD = (function () { try { var m = /[?&]v=([0-9a-f]{6,})/.exec((document.currentScript && document.currentScript.src) || ''); return m ? m[1] : ''; } catch (e) { return ''; } })();
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return Number(n).toLocaleString('en-US'); }
  var W = null, EV = [], shown = PAGE, filt = 'all', seenTx = null, firstDraw = true;
  try { var h0 = /[#&]f=(\w+)/.exec(location.hash || ''); if (h0 && FILTERS.hasOwnProperty(h0[1])) filt = h0[1]; } catch (e) {}
  /* ---- block times (CT) ---- */
  var BT_KEY = 'xcpets-live-bt', BT = (function () { try { return JSON.parse(localStorage.getItem(BT_KEY)) || {}; } catch (e) { return {}; } })(), btBusy = {}, btQ = [], btRun = 0, btDirty = false;
  function btSave() { if (!btDirty) return; btDirty = false; try { var ks = Object.keys(BT).map(Number).sort(function (a, b) { return b - a; }).slice(0, 3000), o = {}; ks.forEach(function (k) { o[k] = BT[k]; }); BT = o; localStorage.setItem(BT_KEY, JSON.stringify(o)); } catch (e) {} }
  function getJson(path) { var i = 0; return new Promise(function (res, rej) { (function next() { if (i >= CORE.length) return rej(new Error('core')); var u = CORE[i++] + path, ac = typeof AbortController !== 'undefined' ? new AbortController() : null, t = setTimeout(function () { if (ac) ac.abort(); }, 8000);
      fetch(u, ac ? { signal: ac.signal } : {}).then(function (r) { clearTimeout(t); if (!r.ok) throw new Error('http ' + r.status); return r.json(); }).then(res, function () { clearTimeout(t); next(); }); })(); }); }
  function btPump() { while (btRun < 4 && btQ.length) { var b = btQ.shift(); btRun++; getJson('/blocks/' + b).then(function (b) { return function (j) { var t = j && j.result && j.result.block_time; if (t) { BT[b] = t; btDirty = true; } }; }(b), function () {}).then(function (b) { return function () { btRun--; delete btBusy[b]; if (!btQ.length && !btRun) { btSave(); paintTimes(); } btPump(); }; }(b)); } }
  function needTime(b) { if (BT[b] || btBusy[b] || b > (W && W.tip || 0)) return; btBusy[b] = 1; btQ.push(b); }
  function nearest(b) { var best = null, bd = 1e9; for (var k in BT) { var d = Math.abs(k - b); if (d < bd) { bd = d; best = +k; } } return best; }
  function timeOf(b) { if (BT[b]) return { t: BT[b], est: false }; var n = nearest(b); if (n == null) return null; return { t: BT[n] + (b - n) * 600, est: true }; }
  var CT = (function () { try { return new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch (e) { return null; } })();
  function timeTxt(b) { var x = timeOf(b); if (!x) return ''; var d = new Date(x.t * 1000); return (x.est ? '~' : '') + (CT ? CT.format(d) : d.toISOString().slice(0, 16).replace('T', ' ')) + ' CT'; }
  function ago(b) { var x = timeOf(b); if (!x) return ''; var s = Math.max(0, Date.now() / 1000 - x.t); return s < 90 ? 'just now' : s < 5400 ? Math.round(s / 60) + ' min ago' : s < 129600 ? Math.round(s / 3600) + ' h ago' : Math.round(s / 86400) + ' d ago'; }
  function paintTimes() { Array.prototype.forEach.call(document.querySelectorAll('.lv-time[data-b]'), function (el) { var b = +el.getAttribute('data-b'); el.textContent = timeTxt(b); el.title = ago(b); }); }
  /* ---- thumbnails: the pet's own sprite and its gear, minus crowns, frames, fire, flames and auras ---- */
  function frames(p) { var ids = []; try { ids = (R.worn(W, p.id) || []).map(function (g) { return g.item; }).filter(function (it) { return it && !NOPE.test(it); }); } catch (e) {}
    try { var f = R.framesWith(p.art, p.stage, ids, []); if (f && f.length && f[0] && f[0].data) return f; } catch (e) {}
    return R.petFrames(p, W); }
  function thumbs(box) { Array.prototype.forEach.call(box.querySelectorAll('canvas.lv-cv[data-id]:not([data-done])'), function (c) { var p = W.byId[c.getAttribute('data-id')]; c.setAttribute('data-done', '1'); if (!p || !p.art) return; R.lazy(c, function () { return frames(p); }, true); }); }
  /* ---- rows ---- */
  function nm(id) { var p = W.byId[id]; return '#' + id + (p && p.name ? ' ' + p.name : ''); }
  function line(e) { return e.t.map(function (x) { return typeof x === 'string' ? esc(x) : x && x.pet != null ? '<a href="pet.html?id=' + x.pet + '">' + esc(nm(x.pet)) + '</a>' : ''; }).join(''); }
  /* ---- feed-share-1107 (owner Nov 7 2026 9:30 AM CT [pt3065u] "lets make the individual things in the live feed sharable"): display only.
   * Every row gets a stable permalink live.html?ev=BLOCK-TX12-CAT-PET (block, first 12 chars of the tx id, row type, pet id) that opens
   * straight to that event, spotlit with its sprite, and replays its animation. Share = native share sheet on phones, copy link elsewhere;
   * plus a Telegram share link. The share text is the row's own line, nothing more. */
  function evKey(e) { return e.block + '-' + String(e.tx || '').replace(/[^0-9A-Za-z]/g, '').slice(0, 12) + '-' + e.cat + '-' + (e.pet != null ? e.pet : 'x'); }
  function evUrl(e) { return location.origin + location.pathname + '?ev=' + encodeURIComponent(evKey(e)); }
  function plain(e) { return line(e).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"); }
  function shareText(e) { return e.icon + ' ' + plain(e) + ' (XCPETS, block ' + fmt(e.block) + ')'; }
  function tgUrl(e) { return 'https://t.me/share/url?url=' + encodeURIComponent(evUrl(e)) + '&text=' + encodeURIComponent(shareText(e)); }
  var WANT = (function () { try { var m = /[?&]ev=([^&#]+)/.exec(location.search || '') || /#ev=([^&]+)/.exec(location.hash || ''); return m ? decodeURIComponent(m[1]) : null; } catch (e) { return null; } })(), wantDone = false;
  function toast(msg) { var t = $('lvToast'); if (!t) { t = document.createElement('div'); t.id = 'lvToast'; t.className = 'lv-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); } t.textContent = msg; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(function () { t.classList.remove('on'); }, msg.length > 30 ? 6000 : 2200); }
  function copy(txt) { if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(txt); return new Promise(function (res, rej) { try { var a = document.createElement('textarea'); a.value = txt; a.setAttribute('readonly', ''); a.style.position = 'fixed'; a.style.opacity = '0'; document.body.appendChild(a); a.select(); var ok = document.execCommand('copy'); a.remove(); ok ? res() : rej(); } catch (x) { rej(x); } }); }
  function share(e) { var url = evUrl(e), touch = root.matchMedia && root.matchMedia('(pointer:coarse)').matches;
    if (touch && navigator.share) { navigator.share({ title: 'XCPETS Live Feed', text: shareText(e), url: url }).catch(function () {}); return; }
    copy(url).then(function () { toast('🔗 Link copied!'); }, function () { toast('Copy this link: ' + url); }); }
  function shareBar(e, i) { return '<span class="lv-share"><button type="button" class="lv-sh" data-sh="' + i + '" aria-label="Share this event">🔗 Share</button><a class="lv-tg" href="' + esc(tgUrl(e)) + '" target="_blank" rel="noopener" aria-label="Share on Telegram">✈️ Telegram</a></span>'; }
  function spotlight(e, i) { var box = $('lvSpot'); if (!box) return; var p = e.pet != null && W.byId[e.pet];
    box.innerHTML = '<div class="lv-spot-in lv-' + e.cat + '"><span class="lv-spot-tag">★ SHARED EVENT ★</span>' +
      (p && p.art ? '<canvas class="lv-spot-cv' + (e.dead || (p.dead && !p.zombie) ? ' lv-dead' : '') + (p.zombie ? ' lv-zom' : '') + '" width="32" height="32" data-sid="' + p.id + '"></canvas>' : '<span class="lv-spot-ico" aria-hidden="true">' + e.icon + '</span>') +
      '<p class="lv-spot-txt"><span aria-hidden="true">' + e.icon + '</span> ' + line(e) + '</p><p class="lv-meta"><span class="lv-time" data-b="' + e.block + '">' + esc(timeTxt(e.block)) + '</span> · block ' + fmt(e.block) + ' · <span class="lv-cat">' + CAT[e.cat] + '</span></p>' +
      '<p class="lv-spot-btns">' + (e.anim ? '<button type="button" class="btn lv-spot-play" data-sp="' + i + '">▶ Play it</button> ' : '') + shareBar(e, i) + ' <button type="button" class="btn ghost lv-spot-x">✕ Back to the feed</button></p></div>';
    box.hidden = false; var c = box.querySelector('canvas[data-sid]'); if (c) { try { R.lazy(c, function () { return frames(p); }, true); } catch (x) {} } }
  function missing(k) { var box = $('lvSpot'); if (!box) return; var m = /^(\d+)-[^-]*-(\w+)-(\d+|x)$/.exec(k || ''), pid = m && m[3] !== 'x' ? +m[3] : null;
    box.innerHTML = '<div class="lv-spot-in"><span class="lv-spot-tag">★ SHARED EVENT ★</span><p class="lv-spot-txt">That event' + (m ? ' (block ' + fmt(+m[1]) + ')' : '') + ' is no longer in the last ' + Math.round(WINDOW / 144) + ' days of the feed' + (m && +m[1] > W.tip ? ', or its block is not read yet. Try again in a minute' : '') + '.</p><p class="lv-spot-btns">' + (pid != null && W.byId[pid] ? '<a class="btn" href="pet.html?id=' + pid + '">See ' + esc(nm(pid)) + ' →</a> ' : '') + '<button type="button" class="btn ghost lv-spot-x">✕ Back to the feed</button></p></div>'; box.hidden = false; }
  function openWanted() { if (!WANT || wantDone || !W) return; var i = -1; for (var j = 0; j < EV.length; j++) if (evKey(EV[j]) === WANT) { i = j; break; }
    if (i < 0) { if (+(/^\d+/.exec(WANT) || [0])[0] > W.tip) return; wantDone = true; missing(WANT); return; } wantDone = true; var e = EV[i];
    if (FILTERS[filt] && !FILTERS[filt][e.cat]) filt = 'all'; var L = list(), pos = L.indexOf(e); if (pos >= shown) shown = Math.ceil((pos + 1) / PAGE) * PAGE; draw(); spotlight(e, i);
    var li = document.querySelector('.lv-row[data-i="' + i + '"]'); if (li) li.classList.add('lv-linked');
    var sp = $('lvSpot'); if (sp && sp.scrollIntoView) sp.scrollIntoView({ block: 'start' }); if (e.anim) setTimeout(function () { play(e); }, 1200); }
  var CAT = { birth: 'Birth', feed: 'Feed', stage: 'Stage-up', mythic: 'Mythic', death: 'Death', god: 'God', gear: 'Gear', other: 'Game' };
  function rowHtml(e, i) { var p = e.pet != null && W.byId[e.pet], fresh = seenTx && !seenTx[e.tx + ':' + e.cat + ':' + e.pet];
    return '<li class="lv-row lv-' + e.cat + (e.hot ? ' lv-hot' : '') + (fresh ? ' lv-new' : '') + (e.anim ? ' lv-can' : '') + '" data-i="' + i + '"' + (e.anim ? ' tabindex="0" role="button" aria-label="Play the animation: ' + esc(line(e).replace(/<[^>]+>/g, '')) + '"' : '') + '>' +
      '<span class="lv-th">' + (p && p.art ? '<a href="pet.html?id=' + p.id + '" tabindex="-1" aria-hidden="true"><canvas class="lv-cv' + (e.dead || (p.dead && !p.zombie) ? ' lv-dead' : '') + (p.zombie ? ' lv-zom' : '') + '" width="32" height="32" data-id="' + p.id + '"></canvas></a>' : '<span class="lv-ico" aria-hidden="true">' + e.icon + '</span>') + '</span>' +
      '<span class="lv-body"><span class="lv-txt"><span aria-hidden="true">' + e.icon + '</span> ' + line(e) + '</span>' +
      '<span class="lv-meta"><span class="lv-time" data-b="' + e.block + '">' + esc(timeTxt(e.block)) + '</span> · block ' + fmt(e.block) + ' · <span class="lv-cat">' + CAT[e.cat] + '</span>' + (e.anim ? ' · <span class="lv-play">▶ replay</span>' : '') + (p ? ' · <a href="pet.html?id=' + p.id + '">pet page →</a>' : '') + ' · <a class="lv-perma" href="?ev=' + encodeURIComponent(evKey(e)) + '" title="Permalink to this event">#</a></span>' + shareBar(e, i) + '</span></li>'; }
  function list() { var F = FILTERS[filt]; return F ? EV.filter(function (e) { return F[e.cat]; }) : EV; }
  function draw() { var box = $('lvList'); if (!box || !W) return; var L = list(), vis = L.slice(0, shown);
    box.innerHTML = vis.length ? vis.map(function (e) { return rowHtml(e, EV.indexOf(e)); }).join('') : '<li class="lv-empty muted">Nothing in the last ' + Math.round(WINDOW / 144) + ' days for this filter.</li>';
    $('lvMore').hidden = L.length <= shown; $('lvMore').textContent = 'Show more (' + fmt(L.length - shown) + ' older)';
    Array.prototype.forEach.call(document.querySelectorAll('.lv-f'), function (b) { var on = b.getAttribute('data-f') === filt; b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.classList.toggle('on', on); });
    var bs = {}; vis.forEach(function (e) { bs[e.block] = 1; }); Object.keys(bs).slice(0, 80).forEach(function (b) { needTime(+b); }); btPump();
    thumbs(box); }
  function status() { var s = M.state ? M.state() : {}, el = $('lvStatus'); if (!el) return; var beh = M.behind ? M.behind() : 0;
    el.innerHTML = '<span class="lv-dot" aria-hidden="true"></span> Live at block <b>' + fmt(W.tip) + '</b>' + (timeTxt(W.tip) ? ' (' + esc(timeTxt(W.tip)) + ')' : '') + (beh ? ' · ' + fmt(beh) + ' block' + (beh === 1 ? '' : 's') + ' behind the chain, catching up' : '') + (s.provisional ? ' · updating to the latest block…' : '') + ' · checks for new blocks every minute · ' + fmt(EV.length) + ' events in the last ' + Math.round(WINDOW / 144) + ' days'; }
  function build() { var w = M.world(); if (!w || !w.pets) return false; if (W && w === W && EV.length) return false; var old = EV; W = w;
    EV = events(w, V); if (!firstDraw) { seenTx = {}; old.forEach(function (e) { seenTx[e.tx + ':' + e.cat + ':' + e.pet] = 1; }); } else seenTx = null; firstDraw = false; return true; }
  function refresh() { try { if (build()) { needTime(W.tip); draw(); } status(); openWanted(); } catch (e) { if (root.console) console.warn('[live] refresh', e); } }
  /* ---- animations: loaded on the first tap ---- */
  var animP = null;
  function loadAnims() { if (animP) return animP; var L = ['js/v2-life-anim.js', 'js/v2-cem-anim.js', 'js/v2-mg-anim.js'];
    animP = L.reduce(function (p, src) { return p.then(function () { return new Promise(function (res) { var t = document.createElement('script'); t.src = src + (BUILD ? '?v=' + BUILD : ''); t.async = false; t.onload = res; t.onerror = res; document.body.appendChild(t); }); }); }, Promise.resolve()); return animP; }
  function play(e) { if (!e || !e.anim) return; loadAnims().then(function () { var A = e.anim.lib === 'cem' ? root.V2CemAnim : root.V2LifeAnim; if (!A || !A.play) return; if (A.busy && A.busy()) return;
      try { A.play(Object.assign({ block: e.block }, e.anim.ev), { w: W, noQueue: true }); } catch (x) { if (root.console) console.warn('[live] anim', x); } }); }
  function wire() { $('lvFilters').addEventListener('click', function (ev) { var b = ev.target.closest('.lv-f'); if (!b) return; filt = b.getAttribute('data-f'); shown = PAGE; try { history.replaceState(null, '', filt === 'all' ? location.pathname + location.search : '#f=' + filt); } catch (e) {} draw(); });
    $('lvMore').addEventListener('click', function () { shown += PAGE; draw(); });
    var onShare = function (ev) { var b = ev.target.closest('.lv-sh'); if (b) { ev.preventDefault(); share(EV[+b.getAttribute('data-sh')]); return true; } if (ev.target.closest('.lv-tg')) return true; return false; };
    var sp = $('lvSpot'); if (sp) sp.addEventListener('click', function (ev) { if (onShare(ev)) return; var p = ev.target.closest('.lv-spot-play'); if (p) { play(EV[+p.getAttribute('data-sp')]); return; }
      if (ev.target.closest('.lv-spot-x')) { sp.hidden = true; sp.innerHTML = ''; try { history.replaceState(null, '', location.pathname + (filt === 'all' ? '' : '#f=' + filt)); } catch (x) {} } });
    var box = $('lvList'); box.addEventListener('click', function (ev) { if (onShare(ev)) return; if (ev.target.closest('a')) return; var li = ev.target.closest('.lv-row'); if (li) play(EV[+li.getAttribute('data-i')]); });
    box.addEventListener('keydown', function (ev) { if (ev.key !== 'Enter' && ev.key !== ' ') return; var li = ev.target.closest && ev.target.closest('.lv-row'); if (!li || ev.target !== li) return; ev.preventDefault(); play(EV[+li.getAttribute('data-i')]); }); }
  function start() { if (!M || !R || !V || !$('lvList')) return; wire(); /* watch.html loads this file for V2Live.events only */ refresh(); setInterval(paintTimes, 60e3);
    if (M.onFresh) M.onFresh(refresh);
    setInterval(function () { if (document.hidden) return; try { M.refresh(refresh); } catch (e) {} }, 60e3); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})(typeof window !== 'undefined' ? window : this);
