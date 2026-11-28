/* gear-crate (Jake Nov 28 2026, gear plan "a roll reveal": "gear is not fun"). Display + the normal confirm sheet only; no rules change.
 * A small batch of new gear (1 to CRATE_MAX pieces of your own) opens as a crate, one piece at a time: the crate shakes, pops open with a flash in the
 * piece's rarity colour, and the piece rises out. Under it, three buttons:
 *  - Wear  = pet:gearup:PET (1 dander, V2Rules.forgePlan). Shown only when that very burn puts THIS piece on the pet (it is in the burn's moves), or,
 *            when the roll already put this piece on and the pet had something stronger in that slot, puts the stronger piece back. Otherwise it is
 *            off and says why ("#12 already wears it", "#12 wears something stronger"...). gearup never downgrades, so it can't make a pet weaker.
 *  - Keep  = no burn. The piece stays where it is (on the pet or in your stash).
 *  - Smash = pet:smash:T (1 dander). Smash melts ALL spare copies up to that rarity (one copy of every piece is always kept), so the button says how
 *            many pieces and how much Dust, and it is on only when this piece is one of the spares the burn would melt.
 * Every burn still goes through V2UI.confirmPlans: sendBlock (forgePreview at the next block, one forge burn waiting at a time) judges it again before
 * anything is signed, so a stale card can't waste a burn. Each button is pre-checked with the same sendWhy the confirm sheet uses.
 * Bigger batches (and "See all") keep the list view. Hook: v2.js drawReveal0 -> V2GearCrate.fits / draw. */
(function () {
  'use strict';
  var CRATE_MAX = 6, TIER_C = ['#b7c2bb', '#3ddc84', '#5aa9ff', '#ffd166'], TIER_N = ['Common', 'Uncommon', 'Rare', 'Legendary'];
  function V() { return window.V2Rules; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function tierOf(x) { return Math.max(0, Math.min(3, x.legendary ? 3 : (x.tier | 0))); }
  function slotName(sl) { try { return window.XcpSlots ? XcpSlots.label(sl) : V().slotLabel(sl); } catch (e) { return sl; } }
  function dmg(t) { return 1 + 2 * t; }
  /** fits(wins, w, me): a crate for this batch? Only pieces you own right now, and not too many. */
  function fits(wins, w, me) { if (!wins || !wins.length || wins.length > CRATE_MAX || !w || !w.items || !me) return false;
    return wins.every(function (x) { var g = x && x.gid && w.items[x.gid]; return !!g && g.owner === me; }); }
  /* the page's view of "would pet:smash melt this piece": the same test as the rules' spareSets (spare = not worn, not bagged, pledged, grave-held or a
   * trophy; one copy of every piece is kept: a non-spare copy, else the oldest spare). Display only: the confirm sheet's sendBlock is the real check. */
  function spare(w, g, me) { if (!g || g.owner !== me || g.bag != null || g.pledge != null || g.grave != null || g.src === 'trophy') return false; if (g.on == null) return true;
    var q = w.byId && w.byId[g.on]; return !!(q && q.dead && !q.community && !(V().isZ ? V().isZ(q) : q.zombie)); }
  function smashable(w, g, me) { if (!spare(w, g, me)) return false; var kept = false, first = null;
    Object.keys(w.items).forEach(function (k) { var o = w.items[k]; if (!o || o.owner !== me || o.item !== g.item) return; if (!spare(w, o, me)) kept = true; else if (!first) first = o; });
    return kept || (first && first.gid !== g.gid); }
  /* the buttons for one piece: { wear: {plan,txt,why}, smash: {...} } */
  function actions(ctx, x) { var w = ctx.world(), me = ctx.ME, Vr = V(), b = (w.tip || 0) + 1, g = w.items[x.gid], out = { wear: null, smash: null, g: g, pet: null, note: '' };
    if (!g || g.owner !== me) { out.note = 'This piece is not in your stash any more.'; return out; }
    var pid = g.on != null ? g.on : (g.bag != null ? g.bag : x.rolledOn), P = pid != null && w.byId ? w.byId[pid] : null; out.pet = P;
    var live = !!(Vr && Vr.forgeOn && Vr.forgeOn(b) && Vr.forgePlan);
    if (!live) { out.wear = { why: 'Wearing for real opens with the Gear Forge' }; out.smash = { why: 'Smash opens with the Gear Forge' }; return out; }
    /* WEAR */
    if (!P) out.wear = { why: 'No pet to wear it' };
    else if (P.owner !== me) out.wear = { why: '#' + P.id + ' is not yours any more' };
    else { var pl = Vr.forgePlan(w, me, 'gearup', [P.id], b), mv = (pl && pl.moves) || [], mine = mv.filter(function (m) { return m.gid === g.gid; })[0], back = g.on === P.id ? mv.filter(function (m) { return m.slot === g.slot && m.petId === P.id; })[0] : null;
      if (g.on === P.id && !back) out.wear = { done: true, why: '#' + P.id + ' wears it' };
      else if (!pl.ok || (!mine && !back)) out.wear = { why: g.on === P.id ? '#' + P.id + ' wears it' : (function () { var cur = Vr.wornOf ? (Vr.wornOf(w, P.id) || []).filter(function (c) { return c.slot === g.slot; })[0] : null; return cur && cur.gid !== g.gid ? '#' + P.id + ' wears something as strong' : '#' + P.id + " can't wear it"; })() };
      else { var more = mv.length - 1, swap = back && w.items[back.gid];
        var txt = back ? 'Put back ' + (swap ? swap.label : 'the stronger piece') + ' (+' + back.gain + ')' : 'Wear on #' + P.id + ' · +' + mine.gain + ' per hit';
        out.wear = { plan: { tag: pl.tag, amount: pl.amount, label: pl.label }, txt: txt, more: more, back: !!back, title: pl.label }; } }
    /* SMASH */
    var t = tierOf(x);
    if (!spare(w, g, me)) out.smash = { why: g.on != null ? 'Worn pieces stay whole' : "This piece can't be smashed" };
    else if (!smashable(w, g, me)) out.smash = { why: 'Your only copy is always kept' };
    else { var sp = Vr.forgePlan(w, me, 'smash', t, b); if (!sp || !sp.ok) out.smash = { why: (sp && sp.why) || 'Nothing to smash' };
      else out.smash = { plan: { tag: sp.tag, amount: sp.amount, label: sp.label }, txt: 'Smash · +' + sp.dust + ' Dust', sub: sp.n === 1 ? 'melts this spare copy' : 'melts ' + sp.n + ' spare pieces up to ' + TIER_N[t], title: sp.label }; }
    [out.wear, out.smash].forEach(function (a) { if (a && a.plan && ctx.sendWhy) { var why = null; try { why = ctx.sendWhy(a.plan); } catch (e) { why = null; } if (why) { a.why = why; a.plan = null; } } });
    return out; }
  var css = false;
  function style() { if (css) return; css = true; var s = document.createElement('style'); s.textContent =
    '#packBox.gcrate .box{display:block;max-width:440px;height:auto;max-height:calc(100dvh - 20px);overflow-y:auto;padding:14px 16px 12px;text-align:center;border-color:var(--gc,#ffd166);box-shadow:6px 6px 0 #000,0 0 44px color-mix(in srgb,var(--gc,#ffd166) 35%,transparent)}' +
    '#packBox.gcrate.gc-behind{z-index:49}#packBox.gcrate #packGrid,#packBox.gcrate .box>.row,#packBox.gcrate #packNote{display:none!important}' +
    '#packBox.gcrate .box>h2{font-family:var(--meme,Bangers,Impact,sans-serif);font-size:32px;letter-spacing:1.5px;color:var(--gc,#ffd166);text-shadow:3px 3px 0 #000;margin:0 0 2px}' +
    '.gcr{position:relative}.gcr-sub{font-size:13px;opacity:.85;margin-bottom:6px}' +
    '.gcr-stage{position:relative;height:170px;display:flex;align-items:flex-end;justify-content:center;overflow:hidden}' +
    '.gcr-flash{position:absolute;left:50%;top:52%;width:320px;height:320px;margin:-160px 0 0 -160px;border-radius:50%;background:radial-gradient(circle,var(--gc) 0,color-mix(in srgb,var(--gc) 40%,transparent) 30%,transparent 65%);opacity:0;transform:scale(.2)}' +
    '.gcr-rays{position:absolute;left:50%;top:52%;width:300px;height:300px;margin:-150px 0 0 -150px;background:repeating-conic-gradient(color-mix(in srgb,var(--gc) 55%,transparent) 0 10deg,transparent 10deg 30deg);border-radius:50%;opacity:0;-webkit-mask:radial-gradient(circle,#000 20%,transparent 68%);mask:radial-gradient(circle,#000 20%,transparent 68%)}' +
    '.gcr-crate{position:absolute;left:50%;bottom:8px;width:96px;height:78px;margin-left:-48px;image-rendering:pixelated}' +
    '.gcr-crate i{position:absolute;left:0;right:0;border:3px solid #000;background:repeating-linear-gradient(90deg,#b5713a 0 14px,#9a5b2c 14px 16px);box-shadow:inset 0 -5px 0 rgba(0,0,0,.25)}' +
    '.gcr-crate .lid{top:0;height:22px;z-index:2;transform-origin:0 100%}.gcr-crate .body{bottom:0;height:58px}' +
    '.gcr-crate .body:after{content:"";position:absolute;left:8px;right:8px;top:50%;height:6px;margin-top:-3px;background:#5e3a1a;transform:rotate(-24deg)}' +
    '.gcr-crate b{position:absolute;left:50%;top:14px;width:16px;height:14px;margin-left:-8px;background:var(--gc);border:3px solid #000;z-index:3}' +
    '.gcr-item{position:absolute;left:50%;bottom:24px;width:96px;height:96px;margin-left:-48px;opacity:0;transform:translateY(40px) scale(.4);image-rendering:pixelated;filter:drop-shadow(3px 3px 0 #000)}' +
    '.gcr-pet{position:absolute;right:6px;bottom:6px;width:56px;height:56px;border:2px solid #000;background:#14201a;image-rendering:pixelated;opacity:0}' +
    '.gcr.go .gcr-crate{animation:gcrShake .55s steps(2) 0s 2}.gcr.go .gcr-crate .lid{animation:gcrLid .35s 1.05s ease-out forwards}.gcr.go .gcr-crate{animation:gcrShake .55s steps(2) 0s 2,gcrDrop .4s 1.25s ease-in forwards}' +
    '.gcr.go .gcr-flash{animation:gcrFlash .9s 1.05s ease-out forwards}.gcr.go .gcr-rays{animation:gcrRays 3.2s 1.1s linear forwards}' +
    '.gcr.go .gcr-item{animation:gcrRise .6s 1.15s cubic-bezier(.2,1.6,.4,1) forwards}.gcr.go .gcr-pet,.gcr.go .gcr-info,.gcr.go .gcr-btns{animation:gcrIn .3s 1.6s both}' +
    '.gcr.done .gcr-crate{opacity:0}.gcr.done .gcr-item{opacity:1;transform:none}.gcr.done .gcr-flash{opacity:.55;transform:scale(1)}.gcr.done .gcr-rays{opacity:.35}.gcr.done .gcr-pet{opacity:1}' +
    '@keyframes gcrShake{0%{transform:rotate(-5deg)}50%{transform:rotate(5deg)}100%{transform:rotate(0)}}@keyframes gcrLid{to{transform:translate(-30px,-50px) rotate(-60deg);opacity:0}}' +
    '@keyframes gcrDrop{to{transform:translateY(90px);opacity:0}}@keyframes gcrFlash{0%{opacity:0;transform:scale(.2)}35%{opacity:1;transform:scale(1.15)}100%{opacity:.55;transform:scale(1)}}' +
    '@keyframes gcrRays{0%{opacity:0;transform:rotate(0)}15%{opacity:.6}100%{opacity:.35;transform:rotate(90deg)}}@keyframes gcrRise{to{opacity:1;transform:none}}@keyframes gcrIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}' +
    '.gcr-info{margin:6px 0 2px}.gcr-tag{display:inline-block;font:700 12px/1 system-ui,sans-serif;letter-spacing:1px;padding:4px 8px;border:2px solid #000;background:var(--gc);color:#111;box-shadow:2px 2px 0 #000}' +
    '.gcr-name{font-family:var(--meme,Bangers,Impact,sans-serif);font-size:26px;letter-spacing:1px;margin:6px 0 0;text-shadow:2px 2px 0 #000}.gcr-meta{font-size:13px;opacity:.9}.gcr-where{font-size:12px;opacity:.75;margin-top:2px}' +
    '.gcr-btns{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0 4px}.gcr-btns button{min-height:58px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:6px 4px;font-size:15px;line-height:1.1}' +
    '.gcr-btns button small{font-size:10.5px;opacity:.85;font-weight:400}.gcr-btns button[disabled]{cursor:default;box-shadow:none;transform:none}.gcr-btns .gcr-off{background:#2a2d36!important;color:#9aa3b5!important}.gcr-btns .gcr-ok{background:#1d3a2a!important;color:#8ef0b4!important}' +
    '.gcr-btns .gcr-wear:not([disabled]){background:var(--gc);color:#111}.gcr-btns .gcr-smash:not([disabled]){background:#e2553d;color:#fff}.gcr-btns .gcr-keep{background:#2b3350;color:#fff}' +
    '.gcr-done{font-size:13px;margin:6px 0;color:var(--gc)}.gcr-nav{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:6px}.gcr-dots{display:flex;gap:5px;justify-content:center;margin:2px 0 6px}.gcr-dots i{width:9px;height:9px;border:2px solid #000;background:#444}.gcr-dots i.on{background:var(--gc)}.gcr-dots i.ok{background:#888}' +
    '@media (max-width:520px){#packBox.gcrate .box>h2{font-size:26px}.gcr-stage{height:150px}.gcr-item{width:84px;height:84px;margin-left:-42px}.gcr-btns button{font-size:14px;min-height:54px}}' +
    '@media (prefers-reduced-motion:reduce){.gcr *{animation:none!important}}';
    document.head.appendChild(s); }
  /** draw(ctx): ctx = { rev, world(), ME, $, paint, R, sendWhy(plan), confirmPlans(title, plans, after), close(), list(), reduced() } */
  function draw(ctx) { style(); var rev = ctx.rev, w = ctx.world(), $ = ctx.$, box = $('packBox');
    if (!rev.gc) rev.gc = { i: 0, st: {}, seen: {} }; var C = rev.gc, wins = rev.wins.slice().sort(function (a, b) { return tierOf(b) - tierOf(a); }), n = wins.length;
    if (C.i >= n) C.i = n - 1; var x = wins[C.i], t = tierOf(x), A = actions(ctx, x), st = C.st[x.gid], first = !C.seen[x.gid] && !ctx.reduced(); C.seen[x.gid] = 1;
    box.classList.add('gcrate'); box.classList.remove('pkintro'); box.style.setProperty('--gc', TIER_C[t]);
    $('packTitle').textContent = t === 3 ? '🎁 LEGENDARY!' : t === 2 ? '🎁 Rare pull!' : '🎁 Gear crate!'; $('packTitle').setAttribute('data-ico', 'gear');
    var P = A.pet, where = !A.g ? '' : A.g.on != null && P ? 'On #' + P.id + (P.name ? ' ' + esc(P.name) : '') : A.g.bag != null ? 'In #' + A.g.bag + "'s bag" : 'In your stash';
    var btn = function (k, a, cls, ico, lbl) { if (!a) return ''; if (a.done) return '<button type="button" class="btn gcr-ok ' + cls + '" disabled>✓ ' + lbl + '<small>' + esc(a.why) + '</small></button>';
      if (!a.plan) return '<button type="button" class="btn gcr-off ' + cls + '" disabled>' + ico + ' ' + lbl + '<small>' + esc(a.why || '') + '</small></button>';
      return '<button type="button" class="btn ' + cls + '" data-gc="' + k + '" title="' + esc(a.title || '') + '">' + ico + ' ' + lbl + '<small>' + esc(a.txt) + (a.sub ? ' · ' + esc(a.sub) : a.more > 0 ? ' · +' + a.more + ' more upgrade' + (a.more > 1 ? 's' : '') : '') + '</small></button>'; };
    var stTxt = st === 'wear' ? '⚡ Wear sent: it lands in the next block.' : st === 'smash' ? '🔨 Smash sent: the Dust lands in the next block.' : st === 'keep' ? '✓ Kept.' : '';
    $('packSummary').innerHTML = '<div class="gcr' + (first ? ' go' : ' done') + '">' +
      '<div class="gcr-sub">' + (rev.away ? 'While you were away: ' : '') + (n > 1 ? 'piece ' + (C.i + 1) + ' of ' + n : 'a new piece of gear') + '</div>' +
      (n > 1 ? '<div class="gcr-dots">' + wins.map(function (y, i) { return '<i class="' + (i === C.i ? 'on' : C.st[y.gid] ? 'ok' : '') + '"></i>'; }).join('') + '</div>' : '') +
      '<div class="gcr-stage" aria-hidden="true"><div class="gcr-rays"></div><div class="gcr-flash"></div><div class="gcr-crate"><i class="lid"></i><i class="body"></i><b></b></div><canvas class="gcr-item" width="32" height="32"></canvas>' + (P ? '<canvas class="gcr-pet" width="32" height="32"></canvas>' : '') + '</div>' +
      '<div class="gcr-info"><span class="gcr-tag">' + TIER_N[t].toUpperCase() + (x.legendary ? ' ★' : '') + '</span><div class="gcr-name">' + esc(x.label) + '</div>' +
      '<div class="gcr-meta">' + esc(slotName(x.slot)) + ' · ⚔ +' + dmg(t) + ' per hit</div><div class="gcr-where">' + where + '</div></div>' +
      (stTxt ? '<div class="gcr-done">' + stTxt + '</div>' : '') +
      '<div class="gcr-btns">' + btn('wear', st ? null : A.wear, 'gcr-wear', '⚡', A.wear && A.wear.back ? 'Swap' : 'Wear') + (st ? '' : '<button type="button" class="btn gcr-keep" data-gc="keep">👍 Keep<small>free · stays as it is</small></button>') + btn('smash', st ? null : A.smash, 'gcr-smash', '🔨', 'Smash') + '</div>' +
      (A.note ? '<p class="small muted">' + esc(A.note) + '</p>' : '') +
      '<div class="gcr-nav">' + (C.i > 0 ? '<button type="button" class="q" data-gc="prev">‹ Back</button>' : '') + (C.i < n - 1 ? '<button type="button" class="btn" data-gc="next">Next piece ›</button>' : '') +
      (n > 1 ? '<button type="button" class="q" data-gc="all">See all ' + n + '</button>' : '') + '<button type="button" class="q" data-gc="close">' + (C.i < n - 1 ? 'Close' : '✓ Done') + '</button></div>' +
      (function () { var cv = C.cleanSent ? null : C.clean ? C.clean : (C.clean = cleanView(w, ctx.ME)); return cv && cv.ok && cv.n >= 10 ? '<div class="gcr-nav"><button type="button" class="q gcr-clean" data-gc="clean">' + esc(cleanText(cv)) + '</button></div>' : ''; })() +
      '<p class="small muted" style="margin:6px 0 0">Wear and Smash are tiny burns (1 dander + the Bitcoin fee) you sign in your wallet. Keep is free.</p></div>';
    var root = $('packSummary').querySelector('.gcr'), ic = root.querySelector('.gcr-item'), pc = root.querySelector('.gcr-pet');
    /* the big picture: the pet wearing just this piece (so a Ride shows under it, a hat on its head); the piece's own icon when the pet has no art here */
    var big = null; try { if (P && P.art && ctx.R.framesWith) { big = ctx.R.framesWith(P.art, P.stage, [x.item]); var bare = ctx.R.framesWith(P.art, P.stage, []), d0 = big[0].data, d1 = bare[0].data, same = d0.length === d1.length;
      for (var q = 0; same && q < d0.length; q++) if (d0[q] !== d1[q]) same = false; if (same) big = null; /* not drawn on this body (shoes on a pet with no feet): show the piece itself */ } } catch (e) { big = null; }
    try { if (big && big.length) { if (ctx.R.animate) ctx.R.animate(ic, big); else ctx.paint(ic, big[0]); } else ctx.paint(ic, ctx.R.itemIcon(x.item)); } catch (e) { }
    if (pc) try { var icn = ctx.R.itemIcon(x.item); if (big && !icn.empty) ctx.paint(pc, icn); else if (!big && P) { var fr = ctx.R.petFrames(P, w); ctx.paint(pc, fr[0]); } else pc.remove(); } catch (e) { }
    if (first) { var fin = function () { if (root.isConnected) { root.classList.remove('go'); root.classList.add('done'); } }; setTimeout(fin, 2100); root.querySelector('.gcr-stage').addEventListener('click', fin); try { if (window.V2Sfx && V2Sfx.play) V2Sfx.play(t >= 3 ? 'fanfare' : 'pop'); } catch (e) { } }
    root.querySelectorAll('[data-gc]').forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-gc');
      if (k === 'next') { C.i = Math.min(n - 1, C.i + 1); return draw(ctx); } if (k === 'prev') { C.i = Math.max(0, C.i - 1); return draw(ctx); }
      if (k === 'all') { box.classList.remove('gcrate'); box.style.removeProperty('--gc'); return ctx.list(); }
      if (k === 'close') { box.classList.remove('gcrate'); box.style.removeProperty('--gc'); return ctx.close(); }
      if (k === 'clean') { behind(box); cleanGo(ctx.world(), ctx.ME, ctx.confirmPlans, function () { C.clean = null; C.cleanSent = 1; if (ctx.rev === rev && box.classList.contains('on')) draw(ctx); }); return; }
      if (k === 'keep') { C.st[x.gid] = 'keep'; if (C.i < n - 1) C.i++; return draw(ctx); }
      var a = k === 'wear' ? A.wear : A.smash; if (!a || !a.plan) return;
      behind(box);
      ctx.confirmPlans(k === 'wear' ? (a.back ? '⚡ Swap back the stronger piece' : '⚡ Wear ' + x.label + ' for real') : '🔨 ' + a.title, [a.plan], function () { C.st[x.gid] = k; if (k === 'smash') wins.forEach(function (y) { if (!C.st[y.gid] && tierOf(y) <= t && smashable(w, w.items[y.gid], ctx.ME)) C.st[y.gid] = 'smash'; }); if (ctx.rev === rev && box.classList.contains('on')) draw(ctx); }); }; }); }
  /* the confirm sheet is its own .reveal at the same z-index, earlier in the page: the crate steps behind it while it is open */
  function behind(box) { var cf = document.getElementById('confirmBox'); box.classList.add('gc-behind'); if (!cf || typeof MutationObserver === 'undefined') return;
    var mo = new MutationObserver(function () { if (!cf.classList.contains('on')) { box.classList.remove('gc-behind'); mo.disconnect(); } }); mo.observe(cf, { attributes: true, attributeFilter: ['class'] });
    setTimeout(function () { if (!cf.classList.contains('on')) { box.classList.remove('gc-behind'); mo.disconnect(); } }, 400); }
  /* CLEAN UP (Jake Nov 28 2026 picked "one-tap Clean up my gear"): one pet:smash:R burn (1 dander) melts every spare copy up to Rare into Gear Dust.
   * The rules always keep one copy of every piece; Legendary spares are left alone too (they are rare, and the Forge has its own Legendary button).
   * From the stash-rolls rules (new rolls land unworn), a piece you have not looked at yet can be a spare copy: the label says how many are new
   * (g.stashed === 1). The confirm sheet's sendBlock / forgePreview checks the burn again before anything is signed. */
  var CLEAN_TOP = 2;
  function cleanView(w, me) { var Vr = V(); if (!w || !me || !Vr || !Vr.forgeOn || !Vr.forgePlan) return null; var b = (w.tip || 0) + 1; if (!Vr.forgeOn(b)) return null;
    var pl = Vr.forgePlan(w, me, 'smash', CLEAN_TOP, b); if (!pl || !pl.ok) return { ok: false, why: (pl && pl.why) || 'No spare copies', n: 0, dust: 0 };
    var nNew = 0; try { Object.keys(w.items).forEach(function (k) { var g = w.items[k]; if (g && g.owner === me && g.stashed === 1 && tierOf(g) <= CLEAN_TOP && smashable(w, g, me)) nNew++; }); } catch (e) { }
    return { ok: true, n: pl.n, dust: pl.dust, nNew: nNew, plan: { tag: pl.tag, amount: pl.amount, label: 'Clean up: smash ' + pl.n + ' spare cop' + (pl.n === 1 ? 'y' : 'ies') + ' into ' + pl.dust + ' Gear Dust' } }; }
  function cleanText(v) { return '🔨 Clean up my gear: ' + v.n.toLocaleString('en-US') + ' spare cop' + (v.n === 1 ? 'y' : 'ies') + ' → +' + v.dust.toLocaleString('en-US') + ' Dust'; }
  function cleanGo(w, me, confirm, after) { var v = cleanView(w, me); if (!v || !v.ok) return v;
    confirm('🔨 Clean up: ' + v.n.toLocaleString('en-US') + ' spare copies → ' + v.dust.toLocaleString('en-US') + ' Gear Dust (keeps one of every piece and every Legendary' + (v.nNew ? '; includes ' + v.nNew + ' new piece' + (v.nNew === 1 ? '' : 's') : '') + ')', [v.plan], after); return v; }
  window.V2GearCrate = { cleanView: cleanView, cleanText: cleanText, cleanGo: cleanGo, CLEAN_TOP: CLEAN_TOP, fits: fits, draw: draw, actions: actions, smashable: smashable, CRATE_MAX: CRATE_MAX };
})();
