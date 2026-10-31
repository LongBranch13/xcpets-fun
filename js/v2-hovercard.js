/* XCPETS hover cards (branch hover-cards, 2026-10-22, owner voice call). DISPLAY ONLY: reads the replayed world and the real rule functions
 * (V2Rules.breedable / breedsLeft / BREED_COOLDOWN / kinWhy, the fight formulas in simulateFight, V2ArenaFun streaks + belts). Changes nothing.
 * - Hover a pet (desktop, ~250 ms) or long-press it (phone, ~450 ms) in a pick flow: a compact tooltip.
 *   Breeding flow (motel picker, easy breed cards, 'Browse pets' for a guest): only breeding facts.
 *   Arena flow (easy fight cards, fight picker): only fighting facts.
 * - The small (i) corner on each pet, or 'Full card' in the tooltip, opens the full pet card (#detail). A plain click still PICKS the pet
 *   exactly as before. Closing the card puts the page / picker scroll and focus back; selections are untouched (the flow is never re-rendered). */
(function () {
  'use strict';
  /* power-tooltip-values (Oct 25 2026, display only): hovers show the pet's real numbers (js/v2-power-tip.js) */
  function ptA(p) { return window.V2PowerTip ? V2PowerTip.attr(V2PowerTip.power(p)) : ''; } 
  if (typeof document === 'undefined') return;
  var STATS = ['vigor', 'spark', 'grit', 'zoom', 'luck'], TL = ['Common', 'Uncommon', 'Rare', 'Legendary'];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function V() { return window.V2Rules || {}; }
  function W() { try { return window.__demo && __demo.world ? __demo.world() : null; } catch (e) { return null; } }
  function spL(id) { try { return V().speciesLabel ? V().speciesLabel(id) : id; } catch (e) { return id; } }
  function lbl(pool, id) { var P = window.PetCore && PetCore[pool]; var o = P && P.filter(function (q) { return q.id === id; })[0]; return o ? o.label : id; }
  function hrs(blocks) { var h = blocks / 6; return h >= 24 ? '~' + (h / 24).toFixed(1) + ' days' : '~' + Math.max(1, Math.round(h)) + ' h'; }
  /* which pet + which flow is this element? */
  var T = [
    { sel: '.pk-breed .pk-key[data-key]', mode: 'breed', id: function (el) { return el.getAttribute('data-key'); } },
    { sel: '#ezBreed .ez-c', mode: 'breed', id: function (el) { var s = el.querySelector('[data-ezsp]'); return s && s.getAttribute('data-ezsp'); } },
    { sel: '#ezFight .ez-c', mode: 'fight', id: function (el) { var s = el.querySelector('[data-ezsp]'); return s && s.getAttribute('data-ezsp'); } },
    { sel: '#fPick .fpc[data-pk]', mode: function () { var m = document.getElementById('fPick'); return m && /^Pick Guest/.test(m.getAttribute('aria-label') || '') ? 'breed' : 'fight'; }, id: function (el) { return el.getAttribute('data-pk'); } }
  ];
  var SEL = T.map(function (t) { return t.sel; }).join(',');
  function info(el) { for (var i = 0; i < T.length; i++) if (el.matches(T[i].sel)) { var id = T[i].id(el); return id ? { id: +id, mode: typeof T[i].mode === 'function' ? T[i].mode() : T[i].mode } : null; } return null; }
  function row(k, v, cls) { return '<div class="hc-r' + (cls ? ' ' + cls : '') + '"><span>' + k + '</span><b>' + v + '</b></div>'; }
  function head(p) { var hy = V().isHybrid && V().isHybrid(p.species);
    return '<div class="hc-h"><b>#' + p.id + ' ' + esc(p.name || '') + '</b><span class="hc-t t' + p.tier + '">' + esc((p.resurrected ? 'God' : TL[p.tier]) || '') + '</span></div>' +
      '<div class="hc-s">' + (hy ? '🧬 ' : '') + esc(spL(p.species)) + ' · ' + esc((window.V2Rules && V2Rules.stageLabelOf ? V2Rules.stageLabelOf(p) : p.stageName) || '') + (window.V2Badges && V2Badges.oldMoneyMark ? ' ' + V2Badges.oldMoneyMark(p) : '') + '</div>'; }
  /** breeding facts, straight from V2Rules.breedable / breedsLeft / breedChild */
  function breedHtml(w, p) { var R = V(), b = (w.tip || 0) + 1, why = R.breedable ? R.breedable(p, b) : null, h = head(p);
    if (p.species === 'wizard' && why) h += '<div class="hc-no">🧙 Wizards can\u2019t breed</div>';
    else h += why ? '<div class="hc-no">✋ ' + esc(why) + '</div>' : '<div class="hc-ok">✅ Can breed now</div>';
    var cd = R.BREED_COOLDOWN || 1008, left = p.lastBreed != null ? cd - (b - p.lastBreed) : 0;
    h += row('⏳ Cooldown', left > 0 ? fmtN(left) + ' blocks (' + hrs(left) + ')' : 'ready');
    if (R.breedsLeft) { var bl = R.breedsLeft(p, b); if (bl.on) h += row('🥚 Breeds left', bl.left + ' / ' + bl.cap); }
    var A = selA(w); if (A && A.id !== p.id && R.kinWhy) { var k = R.kinWhy(A, p); if (k) h += '<div class="hc-no">👪 with #' + A.id + ': ' + esc(k) + '</div>'; } if (A && A.id !== p.id && R.resPairWhy) { var rq = R.resPairWhy(A, p, (w.tip || 0) + 1); if (rq) h += '<div class="hc-no">😇 with #' + A.id + ': ' + esc(rq) + '</div>'; }
    var s = p.stats || {}, best = STATS.reduce(function (m, k) { return (s[k] || 0) > (s[m] || 0) ? k : m; }, STATS[0]);
    h += '<div class="hc-sub">Passes down</div>' + row('Species', esc(spL(p.species)) + ' (50/50, mixed pair can hatch a hybrid)') +
      row('Tier', esc((p.resurrected ? 'God' : TL[p.tier]) || '') + ' (baby: lower, higher or +1 tier)') +
      row('Stats', STATS.map(function (k) { return k.slice(0, 3) + ' ' + (s[k] || 0); }).join(' · ')) +
      row('', 'baby = parents\u2019 average ±2; hybrid keeps best ' + best + ' ' + (s[best] || 0), 'hc-m');
    var a = p.art || {}, tr = [];
    if (a.pattern) tr.push(lbl('PATTERNS', a.pattern)); if (a.eyes) tr.push(lbl('EYES', a.eyes) + ' eyes');
    if (tr.length) h += row('Traits', esc(tr.join(' · ')) + ' (capped at baby\u2019s tier)');
    return h; }
  function selA(w) { var a = document.getElementById('bA'); return a && a.value && w.byId[a.value] || null; }
  function fmtN(n) { return Number(n).toLocaleString('en-US'); }
  /** fighting facts, from the simulateFight formulas (HP, hit, crit, dodge, gear) + V2ArenaFun streaks / belts */
  function fightHtml(w, p) { var R = V(), s = p.stats || {}, h = head(p), why = window.UXB && UXB.whyNot ? UXB.whyNot(p, w) : (R.fightable ? R.fightable(p, (w.tip || 0) + 1) : null);
    h += why ? '<div class="hc-no">✋ ' + esc(why) + '</div>' : '<div class="hc-ok">✅ Can fight today</div>';
    var pow = STATS.reduce(function (a, k) { return a + (s[k] || 0); }, 0), sc = window.PetScore && PetScore.of ? PetScore.of(w, p) : null;
    h += row('⚡ Power', '<span' + ptA(p) + '>' + pow + '</span>' + (sc ? ' · ⭐ ' + sc.score + (sc.rank ? ' (#' + sc.rank + ')' : '') : ''));
    h += row('Stats', STATS.map(function (k) { return k.slice(0, 3) + ' ' + (s[k] || 0); }).join(' · '));
    var worn = R.wornOf ? R.wornOf(w, p.id) : [], gb = worn.reduce(function (a, g) { var it = R.itemOf && R.itemOf(g.item); return a + 1 + (it ? it.tier || 0 : 0) * 2; }, 0);
    h += row('❤️ HP', '<span' + (window.V2PowerTip ? V2PowerTip.attr(V2PowerTip.hp(p)) : '') + '>' + (40 + (s.vigor || 0) * 2 + (s.grit || 0) + (p.stage || 0) * 6) + '</span>') + row('🗡 Hit', (4 + Math.floor((s.spark || 0) / 3) + gb) + '–' + (11 + Math.floor((s.spark || 0) / 3) + gb) + ' · crit ' + (5 + Math.floor((s.luck || 0) / 4)) + '% · dodge ' + Math.floor((s.zoom || 0) / 5) + '%');
    h += row('🛡 Gear', worn.length ? '<span' + (window.V2PowerTip ? V2PowerTip.attr(V2PowerTip.gear(worn.map(function (g) { var it = R.itemOf && R.itemOf(g.item); return { label: it ? it.label : g.item, tier: it ? it.tier || 0 : 0 }; }))) : '') + '>+' + gb + ' per hit</span> · ' + esc(worn.map(function (g) { var it = R.itemOf && R.itemOf(g.item); return it ? it.label : g.item; }).slice(0, 4).join(', ')) + (worn.length > 4 ? ' +' + (worn.length - 4) : '') : 'none worn');
    var F = window.V2ArenaFun, cur = 0, belts = [];
    try { cur = (F && F.current ? F.current(w) : {})[p.id] || 0; var B = F && F.belts ? F.belts(w) : {}; ({ classic: 'Classic', sd: 'Sudden Death', tt: 'Tag Team' }); Object.keys(B).forEach(function (k) { if (B[k] && B[k].id === p.id) belts.push({ classic: 'Classic', sd: 'Sudden Death', tt: 'Tag Team' }[k] || k); }); } catch (e) { }
    h += row('🏆 Record', (p.wins || 0) + 'W · ' + (p.losses || 0) + 'L' + (cur ? ' · 🔥 ' + cur + ' streak' : ''));
    if (belts.length) h += row('🥇 Belt', esc(belts.join(', ')));
    if (p.blackEye) h += row('🤕', 'black eye (from a loss)', 'hc-m');
    return h; }
  /* ---------- tooltip element ---------- */
  var tip = null, cur = null, hideT = 0, showT = 0, lp = null, eatClick = false;
  function box() { if (tip) return tip; tip = document.createElement('div'); tip.id = 'hcTip'; tip.className = 'hc'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip);
    tip.addEventListener('pointerenter', function () { clearTimeout(hideT); }); tip.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') hideSoon(); });
    tip.addEventListener('click', function (e) { var b = e.target.closest('[data-hcfull]'); if (b) { e.preventDefault(); openCard(+b.getAttribute('data-hcfull'), cur && cur.el); } else if (e.target.closest('.hc-x')) hide(); });
    return tip; }
  function show(el) { var I = info(el), w = W(); if (!I || !w || !w.byId[I.id]) return; var p = w.byId[I.id], t = box();
    t.className = 'hc hc-' + I.mode; t.innerHTML = '<button type="button" class="hc-x" aria-label="Close">✕</button>' + (I.mode === 'breed' ? breedHtml(w, p) : fightHtml(w, p)) +
      '<button type="button" class="hc-full" data-hcfull="' + p.id + '">🔎 Full card</button>';
    cur = { el: el, id: p.id }; el.setAttribute('aria-describedby', 'hcTip'); t.style.display = 'block'; place(el); }
  function place(el) { var r = el.getBoundingClientRect(), t = tip, vw = document.documentElement.clientWidth, vh = window.innerHeight, tw = t.offsetWidth, th = t.offsetHeight;
    var x = Math.max(6, Math.min(vw - tw - 6, r.left + r.width / 2 - tw / 2)), y = r.top - th - 8; if (y < 6) y = Math.min(vh - th - 6, r.bottom + 8);
    t.style.left = Math.round(x) + 'px'; t.style.top = Math.round(Math.max(6, y)) + 'px'; }
  function hide() { clearTimeout(showT); clearTimeout(hideT); if (tip) tip.style.display = 'none'; if (cur && cur.el) cur.el.removeAttribute('aria-describedby'); cur = null; }
  function hideSoon() { clearTimeout(hideT); hideT = setTimeout(hide, 180); }
  /* ---------- full card, with the flow kept in place ---------- */
  function openCard(id, from) { var d = document.getElementById('detail'); if (!d || !window.__demo || !__demo.detail) return;
    var fp = document.querySelector('#fPick'), st = { y: window.scrollY, x: window.scrollX, fy: fp ? fp.scrollTop : 0, focus: from || document.activeElement }; hide();
    d.classList.add('hc-top'); __demo.detail(id);
    var done = function () { d.classList.remove('hc-top'); window.scrollTo(st.x, st.y); var f = document.querySelector('#fPick'); if (f) f.scrollTop = st.fy;
      if (st.focus && st.focus.isConnected && st.focus.focus) try { st.focus.focus({ preventScroll: true }); } catch (e) { } obs.disconnect(); };
    var obs = new MutationObserver(function () { if (!d.classList.contains('on')) done(); }); obs.observe(d, { attributes: true, attributeFilter: ['class'] }); }
  /* ---------- (i) corner on each pet ---------- */
  function deco() { document.querySelectorAll(SEL).forEach(function (el) { if (el.querySelector('.hc-i')) return; var I = info(el); if (!I) return;
    var s = document.createElement('span'); s.className = 'hc-i'; s.setAttribute('role', 'button'); s.setAttribute('tabindex', '-1'); s.setAttribute('aria-label', 'Full card #' + I.id); s.title = 'Full card'; s.textContent = 'i'; el.appendChild(s); }); }
  var dq = 0; new MutationObserver(function () { if (!dq) dq = requestAnimationFrame(function () { dq = 0; deco(); if (cur && !cur.el.isConnected) hide(); }); }).observe(document.documentElement, { childList: true, subtree: true });
  /* ---------- events (capture, so the pick handlers never see an (i) or a long-press tap) ---------- */
  window.addEventListener('click', function (e) { if (eatClick) { eatClick = false; e.preventDefault(); e.stopPropagation(); return; }
    var i = e.target.closest && e.target.closest('.hc-i'); if (i) { var el = i.parentNode.closest(SEL), I = el && info(el); e.preventDefault(); e.stopPropagation(); if (I) openCard(I.id, el); return; }
    if (tip && cur && !e.target.closest('#hcTip')) hide(); }, true);
  document.addEventListener('pointerover', function (e) { if (e.pointerType !== 'mouse') return; var el = e.target.closest && e.target.closest(SEL); if (!el) return; clearTimeout(hideT);
    if (cur && cur.el === el) return; clearTimeout(showT); showT = setTimeout(function () { show(el); }, cur ? 60 : 250); });
  document.addEventListener('pointerout', function (e) { if (e.pointerType !== 'mouse') return; var el = e.target.closest && e.target.closest(SEL); if (!el || (e.relatedTarget && el.contains(e.relatedTarget))) return; clearTimeout(showT); if (cur) hideSoon(); });
  document.addEventListener('pointerdown', function (e) { if (e.pointerType === 'mouse') return; var el = e.target.closest && e.target.closest(SEL); if (!el || e.target.closest('.hc-i')) return;
    lp = { el: el, x: e.clientX, y: e.clientY, t: setTimeout(function () { show(el); eatClick = true; lp = null; if (navigator.vibrate) try { navigator.vibrate(8); } catch (x) { } }, 450) }; }, { passive: true });
  function lpEnd() { if (lp) { clearTimeout(lp.t); lp = null; } }
  document.addEventListener('pointermove', function (e) { if (lp && Math.abs(e.clientX - lp.x) + Math.abs(e.clientY - lp.y) > 12) lpEnd(); }, { passive: true });
  document.addEventListener('pointerup', lpEnd, { passive: true }); document.addEventListener('pointercancel', function () { lpEnd(); eatClick = false; }, { passive: true });
  document.addEventListener('contextmenu', function (e) { if (e.target.closest && e.target.closest(SEL) && (eatClick || cur)) e.preventDefault(); });
  document.addEventListener('focusin', function (e) { var el = e.target.closest && e.target.closest(SEL); if (el && el.matches(':focus-visible')) show(el); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && cur) hide(); if ((e.key === 'i' || e.key === 'I') && !e.ctrlKey && !e.metaKey) { var el = document.activeElement && document.activeElement.closest && document.activeElement.closest(SEL), I = el && info(el); if (I) { e.preventDefault(); openCard(I.id, el); } } });
  window.addEventListener('scroll', function () { if (cur && lp == null) hide(); }, { passive: true, capture: true });
  var css = '.hc{position:fixed;z-index:120;display:none;width:min(300px,calc(100vw - 12px));background:#120e22;border:2px solid #000;outline:2px solid #4b3f7a;box-shadow:4px 4px 0 #000;padding:8px 10px 8px;color:#eee;font-size:12px;line-height:1.35;pointer-events:auto}' +
    '.hc-breed{outline-color:#ff8fb1}.hc-fight{outline-color:#ff6b35}.hc-h{display:flex;justify-content:space-between;gap:6px;align-items:center;padding-right:18px}.hc-h b{font-family:"Press Start 2P",monospace;font-size:9px;color:#ffd166;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.hc-t{font-size:10px;padding:1px 5px;border:1px solid #000;background:#2b2350;white-space:nowrap}.hc-t.t1{background:#1f6b3a}.hc-t.t2{background:#1f4f9a}.hc-t.t3{background:#9a6b1f}.hc-s{color:#9fe8ff;font-size:11px;margin:2px 0 4px}' +
    '.hc-ok,.hc-no{font-size:11px;margin:3px 0;padding:2px 5px;border:1px solid #000}.hc-ok{background:#16351f;color:#8dffa8}.hc-no{background:#3a1420;color:#ffb3c1}' +
    '.hc-r{display:flex;gap:6px;justify-content:space-between;border-top:1px dashed #2b2350;padding:2px 0}.hc-r span{color:#bbb;white-space:nowrap}.hc-r b{font-weight:normal;text-align:right;color:#fff}.hc-m b{color:#9fe8ff;font-size:11px}' +
    '.hc-sub{font-family:"Press Start 2P",monospace;font-size:8px;color:#ff8fb1;margin:6px 0 2px}.hc-x{position:absolute;top:3px;right:4px;background:none;border:0;color:#ffd166;cursor:pointer;font-size:13px;padding:2px 4px}' +
    '.hc-full{display:block;width:100%;margin-top:6px;font-size:12px;padding:4px;background:#2b2350;color:#ffd166;border:2px solid #000;cursor:pointer;box-shadow:2px 2px 0 #000}' +
    '.hc-i{position:absolute;top:2px;right:2px;width:15px;height:15px;line-height:13px;font:bold 10px/13px Georgia,serif;font-style:italic;text-align:center;background:#2b2350;color:#ffd166;border:1px solid #000;cursor:pointer;z-index:2;opacity:.85}.hc-i:hover{opacity:1;background:#ffd166;color:#140f24}' +
    '.pk-key,.ez-c,.fpc{position:relative}#detail.hc-top{z-index:100}@media (hover:none){.hc-i{width:20px;height:20px;line-height:18px;font-size:12px}}' +
    '@media (prefers-reduced-motion:no-preference){.hc{animation:hcIn .12s steps(3) both}}@keyframes hcIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}';
  var st = document.createElement('style'); st.id = 'hcCss'; st.textContent = css; document.head.appendChild(st);
  deco();
  window.V2HoverCard = { show: show, hide: hide, openCard: openCard, breedHtml: breedHtml, fightHtml: fightHtml };
})();
