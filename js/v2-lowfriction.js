/* low-friction-1102 (owner, Nov 2 2026; PREVIEW, display only, NO rule change, never signs): play with fewer clicks.
 * 1) Pet dock under Gooby's breeding scene (#motelScene): your pets in a strip. motel-1103 (owner Nov 3, pt2722u: "I want to drag to the
 *    animation"): the motel scene itself is the drop target. Drag a pet (mouse, pen or finger, move up) onto the motel: first guest, then the
 *    date. Same thing without dragging: tap / click / Enter a pet to pick it up, then tap the motel (or its 🥚 button, keyboard: Enter).
 *    A pet that can't check in turns the motel grey with the reason (V2Rules.breedPicker: Gods only with Gods, kin "That's its kid", already
 *    guest 1, burn waiting...). The motel only fills #bA / #bB like the existing pickers; the burn still goes through the existing single burn
 *    confirm, the wallet and the whenFresh / S.verified gate (#bGo). The old 💎 Rare Room and 🍼 Bowl boxes are gone (owner: "no need");
 *    Rare Room stays on Places > Rare Room (rare-room.html) and feeding on 🍼 (each My Pets card), Feed / Feed selected / Feed all.
 *    Strip: every living pet you own (not only the first 40 hungry ones), sort chips (⚡ Power, 💎 Rarity, 🆕 Newest, # ID, 🍼 Hungry),
 *    filters (✅ Can breed, stage chips, species), search. All are buttons, so tap / click / keyboard work the same.
 * 2) One-tap 🍼 Feed / 💞 Breed / 🧹 Chores on every My Pets card.
 * 3) Smart default: the breed page starts with the last pet used as first guest (if it can check in and the link named none).
 * 4) Batch: "Feed N selected" = the existing Feed selected (one burn list, existing chaining rules). Breed stays one pair per
 *    burn and chores are one account-wide burn, so there is no batch for those (the rules have none).
 * 5) Phones: My Pets opens in the existing swipe view ("One at a time") unless you picked a view before.
 * motel-partner-1103 (owner Nov 3, pt2757u: "when I drag pet into animation it doesnt have the options for other peoples pets to drag in after"):
 *    once guest 1 is in, the strip switches to the dates guest 1 can breed with (V2Rules.breedPicker partners, the list the old picker and
 *    the Other wallets tab use): your pets AND other players' pets, chips All / 👤 Mine / 🌍 Other players, ↺ Change guest 1. Mixed God and
 *    non-God pairs are never listed (gods-breed-gods-1102). A date from another wallet goes into #bB, the existing two-owner motel breed.
 * localStorage: xcpets-lf-last = last pet id used here; xcpets-lf-dock = dock sort / filters (display only). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); }, U = function () { return window.V2UI; }, V = function () { return window.V2Rules; };
  var LS = window.localStorage, KL = 'xcpets-lf-last', KD = 'xcpets-lf-dock', st = { held: null, q: '', n: 40, drag: null, sort: 'power', stg: '', sp: '', ok: true, who: '' };
  function get(k) { try { return LS.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { LS.setItem(k, String(v)); } catch (e) { } }
  (function () { try { var o = JSON.parse(get(KD) || '{}'); ['sort', 'stg', 'sp'].forEach(function (k) { if (typeof o[k] === 'string') st[k] = o[k]; }); st.ok = o.ok === undefined ? true : !!o.ok; /* default: only pets that can check in now */ } catch (e) { } })();
  function saveDock() { set(KD, JSON.stringify({ sort: st.sort, stg: st.stg, sp: st.sp, ok: st.ok })); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function mode() { return window.V2PageSplit ? V2PageSplit.mode() : ((document.body && document.body.getAttribute('data-split')) || 'play'); }
  function toast(m) { var u = U(); if (u && u.toast) u.toast(m); }
  function css() { if ($('lfCss')) return; var s = document.createElement('style'); s.id = 'lfCss'; s.textContent =
    '#lfDock{margin:8px auto 4px;max-width:900px;border:2px solid #000;border-radius:12px;background:#132016;padding:8px}' +
    '#motelScene.lf-on{outline:3px dashed #3ddc84;outline-offset:-3px;cursor:copy}#motelScene.lf-hot{outline:4px solid #3ddc84;outline-offset:-4px;box-shadow:0 0 0 3px #3ddc84,0 0 26px #3ddc84}#motelScene.lf-no{outline:4px solid #777;outline-offset:-4px;cursor:not-allowed}' +
    '#motelScene.lf-no canvas{filter:grayscale(.7) brightness(.8)}.lf-drop{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);z-index:4;font:inherit;font-weight:700;font-size:14px;line-height:1.25;max-width:92%;padding:8px 14px;border:3px solid #000;border-radius:12px;background:#3ddc84;color:#04130a;box-shadow:3px 3px 0 #000;cursor:pointer;white-space:normal;text-align:center}' +
    '.lf-drop[hidden]{display:none}#motelScene.lf-no .lf-drop{background:#2a2a2a;color:#eee}#motelScene.lf-hot .lf-drop{transform:translateX(-50%) scale(1.08)}.lf-drop:focus-visible,.lf-p:focus-visible,.lf-c:focus-visible{outline:3px solid #ffc93c;outline-offset:2px}' +
    '.lf-bar{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:6px;font-size:12px}.lf-bar input{flex:1 1 140px;min-width:0;padding:7px 9px;background:#0a0f0b;color:inherit;border:1px solid #2c4a36;border-radius:8px;font:inherit}' +
    '.lf-row{display:flex;gap:4px;align-items:center;flex-wrap:wrap;margin-bottom:6px;font-size:12px}@media (max-width:640px){.lf-row{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}.lf-row::-webkit-scrollbar{display:none}.lf-row>*{flex:0 0 auto}}.lf-row .lb{opacity:.7;margin-right:2px}' +
    '.lf-c{font:inherit;font-size:12px;color:var(--ink,#e9fbe9);background:#1f2d23;border:2px solid #000;border-radius:8px;padding:4px 8px;min-height:32px;cursor:pointer;line-height:1.2}.lf-c:hover{border-color:#3ddc84}.lf-c[aria-pressed="true"]{background:#3ddc84;color:#04130a;font-weight:700}' +
    '.lf-strip{display:flex;gap:6px;overflow-x:auto;scroll-snap-type:x proximity;padding:2px 2px 8px;-webkit-overflow-scrolling:touch}' +
    '.lf-p{flex:0 0 auto;scroll-snap-align:start;width:84px;font:inherit;font-size:11px;color:inherit;background:#1a281e;border:2px solid #000;border-radius:10px;padding:4px;cursor:grab;touch-action:pan-x;user-select:none;-webkit-user-select:none;display:flex;flex-direction:column;align-items:center;gap:2px}' +
    '.lf-p canvas{width:56px!important;height:56px!important;image-rendering:pixelated;pointer-events:none}.lf-p .nm{max-width:76px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.lf-p.held{border-color:#ffc93c;background:#3a3417;box-shadow:0 0 0 2px #ffc93c}.lf-p .hb{color:#ffb347}.lf-p .pw{color:#ffd166}.lf-p.last{border-color:#3ddc84}.lf-p.no{opacity:.55}.lf-p.no .sp{filter:grayscale(.8)}' +
    '.lf-p .ow{font-size:10px;color:#9fd3ff;max-width:76px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lf-row[hidden]{display:none}' +
    '.lf-ghost{position:fixed;z-index:99980;pointer-events:none;opacity:.9;transform:translate(-50%,-60%) scale(1.1)}' +
    '.lf-hint{font-size:11px;opacity:.75;text-align:center;margin-top:2px}' +
    '.lf-acts{display:flex;gap:4px;justify-content:center;margin-top:4px;flex-wrap:wrap}.lf-acts button{font:inherit;font-size:12px;min-height:34px;min-width:40px;padding:3px 7px;border-radius:8px;border:2px solid #000;background:#1f2d23;color:var(--ink,#e9fbe9);cursor:pointer}' +
    '.lf-acts button[aria-disabled="true"]{opacity:.4;cursor:not-allowed}.lf-acts button:hover{border-color:#3ddc84}' +
    '@media (max-width:520px){.lf-drop{font-size:13px;bottom:6px;padding:6px 10px}.lf-c{min-height:36px}}';
    document.head.appendChild(s); }
  function W() { var u = U(); try { return u && u.world ? u.world() : null; } catch (e) { return null; } }
  function tip(w) { var u = U(); return (w && w.tip) || (u && u.S && u.S().tip) || 0; }
  function pend() { var u = U(); return u && u.pendingBreedIds ? u.pendingBreedIds() : null; }
  function mine(w) { var u = U(); if (!u || !w) return []; try { return (u.mine ? u.mine(w) : []).filter(function (p) { return !p.dead && !p.released; }); } catch (e) { return []; } } /* motel-1103: every living pet you own (was V2UI.petList = My Pets' own filters + sort, then hungry-first and the first 40) */
  function owns(p) { var u = U(); return !!(u && u.ME && p && p.owner === u.ME && !p.dead && !p.released); }
  function vo() { var u = U(); return !!(u && u.viewOnly && u.viewOnly()); }
  /* why pet p can't check in at the motel right now (null = it can). One breedPicker call per state (was one per pet). */
  var WC = { k: '', m: null, pa: null };
  function whys(w) { var a = ($('bA') || {}).value || '', b = ($('bB') || {}).value || '', k = a + '|' + b + '|' + tip(w) + '|' + (w.pets ? w.pets.length : 0) + '|' + Object.keys(pend() || {}).join(',') + '|' + (U().ME || ''); if (WC.k === k && WC.m) return WC;
    var Vr = V(); WC = { k: k, m: {}, pa: null, a: a, b: b }; if (!Vr || !Vr.breedPicker) return WC;
    try { Vr.breedPicker(w, U().ME, tip(w), '', pend()).mine.forEach(function (x) { WC.m[x.p.id] = x.why || (x.p.stage >= 3 ? null : 'Too young: Adult+ only'); }); } catch (e) { }
    if (a && !b) { WC.pa = {}; WC.pl = []; var A = w.byId && w.byId[a], T = tip(w) + 1, rx = function (p) { return !!(A && Vr.resPairWhy && Vr.resPairWhy(A, p, T)); };
      try { Vr.breedPicker(w, U().ME, tip(w), a, pend()).partners.forEach(function (x) { WC.pa[x.p.id] = x.why || (x.p.stage >= 3 ? null : 'Too young: Adult+ only');
        if (String(x.p.id) !== a && !x.p.dead && !x.p.released && !rx(x.p)) WC.pl.push(x.p); /* motel-partner-1103: the date pool (yours + other players'), never a mixed God / non-God pair */ }); } catch (e) { } }
    return WC; }
  function whyNest(w, p) { var Vr = V(); if (!Vr || !Vr.breedPicker) return 'Breeding is not loaded yet'; if (vo()) return 'View only: connect the wallet to breed'; var c = whys(w);
    if (!c.a || c.a === String(p.id) || c.b) return p.id in c.m ? c.m[p.id] : 'Only your own pets can check in first';
    return c.pa && p.id in c.pa ? c.pa[p.id] : 'This pet can’t breed right now'; }
  /* motel-partner-1103: step 2 (guest 1 in, no date yet) lists the dates, yours and other players'; otherwise your own pets */
  function dateFor(w) { if (mode() !== 'breed' || !U() || !U().ME) return ''; var a = ($('bA') || {}).value || '', b = ($('bB') || {}).value || ''; if (!a || b) return ''; var p = w.byId && w.byId[a]; return p && owns(p) ? a : ''; }
  function pool(w) { var a = dateFor(w); if (!a) return mine(w); var c = whys(w), me = U().ME; return (c.pl || []).filter(function (p) { return st.who === 'mine' ? p.owner === me : st.who === 'other' ? p.owner !== me : true; }); }
  function whyBowl(w, p) { if (!owns(p)) return 'Only the owner can feed a pet'; if (vo()) return 'View only: connect the wallet to feed'; return p.hungry ? null : 'Not hungry right now'; }
  function remember(id) { set(KL, id); }
  /* the action: it only picks / routes; the burn uses the existing confirm + wallet */
  function nest(w, p) { var a = $('bA'), b = $('bB');
    if (!a || !b || mode() !== 'breed') { if (!owns(p)) return toast('#' + p.id + ': Only the owner can breed a pet'); remember(p.id); location.href = 'breed.html' + location.search + '#breed-' + p.id; return; }
    var why = whyNest(w, p); if (why) return toast('#' + p.id + ': ' + why);
    if (!a.value || a.value === String(p.id) || b.value) { a.value = String(p.id); b.value = ''; toast('🥚 #' + p.id + ' checks in. Now bring a date.'); }
    else { b.value = String(p.id); toast('💞 #' + a.value + ' + #' + p.id + '. Ring the bell when ready.'); }
    remember(p.id); U().render(); var go = $('bGo'); if (go && b.value) setTimeout(function () { try { go.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { } }, 60); }
  function drop(id) { var w = W(), p = w && w.byId[id]; if (!p) return; nest(w, p); hold(null); }
  /* --- the dock --- */
  var WHO = [['', 'All'], ['mine', '👤 Mine'], ['other', '🌍 Other players']], SORTS = [['power', '⚡ Power'], ['rarity', '💎 Rarity'], ['new', '🆕 Newest'], ['id', '# ID'], ['hungry', '🍼 Hungry']], STG = [['', 'All'], ['young', '🐣 Young'], ['3', '🐸 Adult'], ['4', '🧓 Elder'], ['5', '✨ Mythic']];
  function power(p) { return window.UXB && UXB.power ? UXB.power(p) : 0; }
  function spK(p) { var X = window.UXB && UXB.filters ? UXB.filters() : null; return X && X.spKey ? X.spKey(p) : String(p.species || '').toLowerCase(); }
  function spLabel(k) { var h = k.charAt(0) === '~', t = h ? k.slice(1) : k; return (h ? '🧬 ' : '') + t.charAt(0).toUpperCase() + t.slice(1); }
  function cmp(w) { var s = st.sort, id = function (a, b) { return a.id - b.id; };
    if (s === 'id') return id;
    if (s === 'new') return function (a, b) { return (Number(b.hatchBlock) || 0) - (Number(a.hatchBlock) || 0) || b.id - a.id; };
    if (s === 'rarity') { var R = function (p) { return window.PetScore ? PetScore.bitsOf(w, p) : -1; }; return function (a, b) { return b.tier - a.tier || R(b) - R(a) || a.id - b.id; }; }
    if (s === 'hungry') { var Ur = function (p) { return window.IPQ && IPQ.urgency ? IPQ.urgency(w, p) : 0; }; return function (a, b) { return (b.hungry ? 1 : 0) - (a.hungry ? 1 : 0) || (Ur(a) < Ur(b) ? -1 : Ur(a) > Ur(b) ? 1 : 0) || a.id - b.id; }; } /* hungry first, then the one closest to starving */
    var PM = {}, pw = function (p) { return p.id in PM ? PM[p.id] : (PM[p.id] = power(p)); }; /* motel-partner-1103: the date pool can be thousands of pets, so power is worked out once per pet per sort */
    return function (a, b) { return pw(b) - pw(a) || a.id - b.id; }; }
  function keep(w, p) { if (st.stg === 'young' ? p.stage >= 3 : st.stg && p.stage !== Number(st.stg)) return false; if (st.sp && spK(p) !== st.sp) return false;
    if (st.ok && !st.q && !vo() && V() && V().breedPicker && whyNest(w, p)) return false; /* a search shows every match (greyed with the reason); view-only or still-loading shows everyone, greyed with the reason, instead of an empty dock */ if (!st.q) return true; return String(p.id).indexOf(st.q) === 0 || String(p.name || '').toLowerCase().indexOf(st.q) >= 0 || String(p.species || '').toLowerCase().indexOf(st.q) >= 0; }
  function sub(p, w) { var s = st.sort; if (s === 'hungry' || (s !== 'power' && p.hungry && s !== 'rarity')) return p.hungry ? '<span class="hb">🍼 ' + (p.nextMeal ? Number(p.nextMeal).toLocaleString('en-US') : 'hungry') + '</span>' : '<span class="hb" style="opacity:.5">fed</span>';
    if (s === 'rarity') return '<span class="pw">' + esc(['Common', 'Uncommon', 'Rare', 'Legendary'][p.tier] || '') + '</span>'; if (s === 'new' || s === 'id') return '<span class="pw">' + esc(p.stageName || '') + '</span>'; return '<span class="pw">⚡ ' + power(p) + '</span>'; }
  function tileHtml(p, last, w) { var why = whyNest(w, p); return '<button type="button" class="lf-p' + (p.id === last ? ' last' : '') + (why ? ' no' : '') + '" data-lf="' + p.id + '" aria-pressed="false"' + (why ? ' title="' + esc('#' + p.id + ': ' + why) + '"' : '') + ' aria-label="#' + p.id + ' ' + esc(p.name || '') + (owns(p) ? '' : ', owned by another player ' + esc(ownLab(p))) + (p.hungry ? ', hungry' : '') + (why ? ', can’t check in: ' + esc(why) : '') + '. Pick up, then drop on the motel"><span class="sp"></span><span class="nm">#' + p.id + ' ' + esc(p.name || '') + '</span>' + sub(p, w) + (owns(p) ? '' : '<span class="ow">🌍 ' + esc(ownLab(p)) + '</span>') + '</button>'; }
  function ownLab(p) { var o = String(p.owner || ''); return o ? o.slice(0, 5) + '…' + o.slice(-4) : 'other player'; }
  function chips(row, L, cur) { return L.map(function (o) { return '<button type="button" class="lf-c" data-' + row + '="' + o[0] + '" aria-pressed="' + (o[0] === cur) + '">' + o[1] + '</button>'; }).join(''); }
  function bar() { var d = $('lfDock'); if (!d) return; d.querySelectorAll('[data-srt]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.srt === st.sort)); }); d.querySelectorAll('[data-stg]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.stg === st.stg)); });
    d.querySelectorAll('[data-who]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.who === st.who)); });
    var ok = $('lfOk'); if (ok) ok.setAttribute('aria-pressed', String(st.ok)); }
  var SC = { k: '', c: null }; function spSel(w) { var s = $('lfSp'); if (!s) return; var sk = (dateFor(w) ? whys(w).k : 'm' + (w.pets ? w.pets.length : 0) + (U().ME || '')) + '|' + st.who, c = SC.k === sk && SC.w === w && SC.c; if (!c) { c = {}; pool(w).forEach(function (p) { var k = spK(p); c[k] = (c[k] || 0) + 1; }); SC = { k: sk, w: w, c: c }; } /* motel-partner-1103: counted once per state (the date pool can be thousands of pets) */ var ks = Object.keys(c).sort(), sig = ks.map(function (k) { return k + c[k]; }).join(',');
    if (s.dataset.sig === sig) return; s.dataset.sig = sig; if (st.sp && !c[st.sp]) st.sp = '';
    s.innerHTML = '<option value="">🐸 All species</option>' + ks.map(function (k) { return '<option value="' + esc(k) + '"' + (k === st.sp ? ' selected' : '') + '>' + esc(spLabel(k)) + ' (' + c[k].toLocaleString('en-US') + ')</option>'; }).join(''); try { s.value = st.sp; } catch (e) { } }
  function dock() { var sc = $('motelScene'); if (!sc || !U() || !U().cardFor) return false;
    /* speed-phase0: play.html still has the motel scene in the DOM, hidden. Building the dock there ran the breed picker and drew cards on a timer. The dock belongs on the breed page. */
    if (mode() !== 'breed') return false; var d = $('lfDock');
    if (!d) { css(); d = document.createElement('div'); d.id = 'lfDock'; d.setAttribute('role', 'region'); d.setAttribute('aria-label', 'Pet dock: drag a pet onto the motel, or tap a pet then the motel');
      d.innerHTML = '<div class="lf-bar"><input type="search" id="lfQ" placeholder="Find: #12, name, species" aria-label="Find a pet in the dock"><button type="button" class="q" id="lfFeedSel" hidden>🍼 Feed selected</button></div>' +
        '<div class="lf-row" role="group" aria-label="Sort the dock"><span class="lb">Sort</span>' + chips('srt', SORTS, st.sort) + '</div>' +
        '<div class="lf-row" role="group" aria-label="Filter the dock"><button type="button" class="lf-c" id="lfOk" aria-pressed="' + st.ok + '">✅ Can breed</button>' + chips('stg', STG, st.stg) + '<xc-select id="lfSp" class="pick" aria-label="Species"><option value="">🐸 All species</option></xc-select><span class="lb" id="lfN" aria-live="polite"></span></div>' +
        '<div class="lf-row" id="lfWho" role="group" aria-label="Whose pets" hidden><span class="lb" id="lfWhoL">Date for</span>' + chips('who', WHO, st.who) + '<button type="button" class="lf-c" id="lfA0">↺ Change guest 1</button></div>' +
        '<div class="lf-strip" id="lfStrip" role="listbox" aria-label="Your pets" aria-orientation="horizontal"></div>' +
        '<div class="lf-hint" id="lfHint">Drag a pet onto the motel, or tap a pet then the motel.</div>';
      sc.parentNode.insertBefore(d, sc.nextSibling);
      $('lfQ').oninput = function () { st.q = this.value.trim().toLowerCase().replace(/^#/, ''); st.n = 40; paint(); };
      $('lfFeedSel').onclick = function () { var b = $('bFeedSel'); if (b && !b.disabled) b.click(); else toast('Tick pets in My Pets first.'); };
      d.addEventListener('click', function (e) { var c = e.target.closest('.lf-c'); if (!c) return; if (c.dataset.srt) st.sort = c.dataset.srt; else if (c.dataset.stg != null) st.stg = c.dataset.stg; else if (c.dataset.who != null) st.who = c.dataset.who; else if (c.id === 'lfA0') { var a0 = $('bA'), b0 = $('bB'); if (a0) a0.value = ''; if (b0) b0.value = ''; hold(null); U().render(); toast('🥚 Guest 1 cleared. Pick your pet to check in.'); } else if (c.id === 'lfOk') st.ok = !st.ok; st.n = 40; saveDock(); bar(); paint(); var s0 = $('lfStrip'); if (s0) s0.scrollLeft = 0; });
      $('lfSp').addEventListener('change', function () { st.sp = this.value || ''; st.n = 40; saveDock(); paint(); });
      var strip = $('lfStrip'); strip.addEventListener('click', function (e) { var b = e.target.closest('[data-lf]'); if (b && !st.dragged) hold(Number(b.dataset.lf) === st.held ? null : Number(b.dataset.lf)); st.dragged = false; var m = e.target.closest('[data-more]'); if (m) { st.n += 60; paint(); } });
      strip.addEventListener('pointerdown', down); document.addEventListener('xcpets-sel', selBtn);
      /* the motel scene is the target: a tap on it (or its 🥚 button) while a pet is held checks that pet in. Its own buttons (sound, hint) keep working. */
      sc.addEventListener('click', function (e) { if (st.held == null || st.dragged || (e.target.closest && e.target.closest('[data-sfx],.qw-hint'))) return; e.stopPropagation(); e.preventDefault(); sceneTap(); }, true);
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && st.held != null) hold(null); }); }
    var pill = $('lfDrop'); if (!pill || pill.parentNode !== sc) { if (pill) pill.remove(); sc.insertAdjacentHTML('beforeend', '<button type="button" class="lf-drop" id="lfDrop" hidden></button>'); }
    paint(); return true; }
  function sceneTap() { var w = W(), p = w && st.held != null ? w.byId[st.held] : null; if (!p) return; var why = whyNest(w, p); if (why) return toast('#' + p.id + ': ' + why); drop(p.id); }
  function selBtn() { var b = $('lfFeedSel'), u = U(), n = u && u.pickIds ? u.pickIds().length : 0; if (!b) return; b.hidden = !n; b.textContent = '🍼 Feed ' + n.toLocaleString('en-US') + ' selected'; }
  var pk = '', LC = { k: '' }; function paint() { var w = W(), s = $('lfStrip'); if (!w || !s) return; spSel(w); var last = Number(get(KL)) || 0, lk = (dateFor(w) ? whys(w).k : 'm' + whys(w).k) + '|' + [st.sort, st.stg, st.sp, st.ok, st.q, st.who, vo()].join('|'), all, L; if (LC.k === lk && LC.w === w) { all = LC.all; L = LC.L; } else { all = pool(w); L = all.filter(function (p) { return keep(w, p); }).sort(cmp(w)); LC = { k: lk, w: w, all: all, L: L }; } /* motel-partner-1103: filter + sort once per state, not on every 4 s tick */
    var da = dateFor(w), wr = $('lfWho'); if (wr) { wr.hidden = !da; var wl = $('lfWhoL'); if (wl && da) wl.textContent = 'Date for #' + da; } var hn = $('lfHint'), ht = da ? 'Now drag a date for #' + da + ' onto the motel: your pets or other players’ pets (a date from another wallet asks its owner to accept). Or tap a pet, then the motel.' : 'Drag a pet onto the motel, or tap a pet then the motel.'; if (hn && hn.textContent !== ht) hn.textContent = ht;
    s.setAttribute('aria-label', da ? 'Dates for #' + da + ': your pets and other players’ pets' : 'Your pets');
    var n = $('lfN'); if (n) { var t = L.length === all.length ? all.length.toLocaleString('en-US') + ' pets' : L.length.toLocaleString('en-US') + ' of ' + all.length.toLocaleString('en-US'); if (n.textContent !== t) n.textContent = t; }
    var key = L.slice(0, st.n).map(function (p) { return p.id + (p.hungry ? 'h' + p.nextMeal : '') + (whyNest(w, p) ? 'x' : ''); }).join(',') + '|' + last + '|' + st.n + '|' + L.length + '|' + st.sort + '|' + da + '|' + st.who; if (key === pk && s.childNodes.length) { target(); return; } pk = key;
    if (!L.length) { s.innerHTML = '<span class="muted small">' + (!U().ME ? 'Connect a wallet (or view an address) to see your pets.' : all.length ? 'No pets match. Tap All, turn off ✅ Can breed, or clear the search.' : da ? 'No date can breed with #' + da + ' right now' + (st.who ? ' here. Tap All.' : '. Tap ↺ Change guest 1.') : 'No pets here.') + '</span>'; target(); return; }
    s.innerHTML = L.slice(0, st.n).map(function (p) { return tileHtml(p, last, w); }).join('') + (L.length > st.n ? '<button type="button" class="lf-p" data-more="1">+' + (L.length - st.n).toLocaleString('en-US') + ' more</button>' : '');
    s.querySelectorAll('[data-lf]').forEach(function (b) { var p = w.byId[b.dataset.lf], d = p && U().cardFor(p, w), c = d && d.querySelector('canvas'); if (c) { c.removeAttribute('style'); c.className = ''; b.querySelector('.sp').appendChild(c); } });
    if (st.held != null && !w.byId[st.held]) st.held = null; mark(); target(); selBtn(); }
  function mark() { document.querySelectorAll('#lfStrip [data-lf]').forEach(function (b) { var on = Number(b.dataset.lf) === st.held; b.classList.toggle('held', on); b.setAttribute('aria-pressed', String(on)); }); }
  /* the scene's look while a pet is held: green dashed = drop here, grey = this pet can't check in (with the reason on the 🥚 button) */
  function target(hot) { if (hot === undefined) hot = st.hot; else st.hot = !!hot; var sc = $('motelScene'), pill = $('lfDrop'), w = W(), p = w && st.held != null ? w.byId[st.held] : null; if (!sc || !pill) return; var why = p ? whyNest(w, p) : null;
    sc.classList.toggle('lf-on', !!p && !why); sc.classList.toggle('lf-no', !!p && !!why); sc.classList.toggle('lf-hot', !!p && !why && !!hot); pill.hidden = !p; if (!p) return;
    var a = ($('bA') || {}).value, b = ($('bB') || {}).value, tx = why ? '🚫 #' + p.id + ': ' + why : (a && !b && a !== String(p.id) ? '💞 Drop #' + p.id + ' here: date for #' + a : '🥚 Drop #' + p.id + ' here to check in');
    if (pill.textContent !== tx) pill.textContent = tx; pill.setAttribute('aria-disabled', String(!!why)); }
  function hold(id) { st.held = id; if (id != null) remember(id); mark(); target(); }
  /* pointer drag (mouse, pen, touch). Vertical move starts a drag; sideways move scrolls the strip. Tap/click/Enter does the same as a drag. */
  function down(e) { var b = e.target.closest('[data-lf]'); if (!b || e.button > 0) return; var x0 = e.clientX, y0 = e.clientY, id = Number(b.dataset.lf), g = null, hot = false;
    function at(x, y) { var el = document.elementFromPoint(x, y); return !!(el && el.closest && el.closest('#motelScene')); }
    function mv(ev) { var dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (!g) { if (Math.abs(dy) < 10 || Math.abs(dy) < Math.abs(dx)) { if (Math.abs(dx) > 12) end(); return; } hold(id); g = b.cloneNode(true); g.className = 'lf-p lf-ghost held'; g.removeAttribute('data-lf'); var c0 = b.querySelector('canvas'), c1 = g.querySelector('canvas'); if (c0 && c1) c1.getContext('2d').drawImage(c0, 0, 0); document.body.appendChild(g); st.dragged = true; try { b.setPointerCapture(ev.pointerId); } catch (x) { } }
      ev.preventDefault(); g.style.left = ev.clientX + 'px'; g.style.top = ev.clientY + 'px'; if (ev.clientY < 50) window.scrollBy(0, -12); /* phones: the motel can be just above the screen */
      var t = at(ev.clientX, ev.clientY); if (t !== hot) { hot = t; target(hot); } }
    function end() { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', end); if (g) { g.remove(); setTimeout(function () { st.dragged = false; }, 0); } if (hot) { hot = false; target(false); } }
    function up(ev) { var t = g ? at(ev.clientX, ev.clientY) : false, was = !!g; end(); if (was && t) sceneTap(); }
    document.addEventListener('pointermove', mv, { passive: false }); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', end); }
  /* --- one-tap buttons on each My Pets card --- */
  function cardActs() { var box = $('pets'), w = W(); if (!box || !w) return; css(); var dc = $('dcBtn'), dcOk = !!(dc && !dc.disabled);
    box.querySelectorAll('.pet.card[data-pid]').forEach(function (c) { var p = w.byId[c.dataset.pid]; if (!p || p.dead || p.released) return; var k = (p.hungry ? 'h' : 'f') + (owns(p) ? 'o' : 'v') + (dcOk ? 'c' : ''), r = c.querySelector(':scope > .lf-acts');
      if (r && r.dataset.k === k) return; if (!r) { r = document.createElement('div'); r.className = 'lf-acts'; c.appendChild(r); } r.dataset.k = k;
      var fw = whyBowl(w, p), bw = owns(p) ? null : 'Only the owner can breed a pet', cw = dcOk ? null : 'Daily chores are not open right now';
      r.innerHTML = '<button type="button" data-lfa="feed" aria-label="Feed #' + p.id + (fw ? ': ' + esc(fw) : '') + '" title="' + esc(fw || 'Feed #' + p.id + (p.nextMeal ? ' · ' + Number(p.nextMeal).toLocaleString('en-US') : '')) + '"' + (fw ? ' aria-disabled="true"' : '') + '>🍼</button>' +
        '<button type="button" data-lfa="breed" aria-label="Breed #' + p.id + (bw ? ': ' + bw : '') + '" title="' + esc(bw || 'Breed #' + p.id + ' at Gooby’s') + '"' + (bw ? ' aria-disabled="true"' : '') + '>💞</button>' +
        '<button type="button" data-lfa="chores" aria-label="Daily chores (all pets)' + (cw ? ': ' + cw : '') + '" title="' + esc(cw || 'Daily chores: WAGMI + feed + spins for all pets, one burn') + '"' + (cw ? ' aria-disabled="true"' : '') + '>🧹</button>'; }); }
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('.lf-acts [data-lfa]'); if (!b) return; e.stopPropagation(); e.preventDefault(); var c = b.closest('.pet.card[data-pid]'), w = W(), p = w && c && w.byId[c.dataset.pid]; if (!p) return;
    if (b.getAttribute('aria-disabled') === 'true') return toast(b.title); var a = b.dataset.lfa; remember(p.id);
    if (a === 'feed') return U().feed(p.id); if (a === 'breed') return nest(w, p); if (a === 'chores') { var dc = $('dcBtn'); if (dc && !dc.disabled) dc.click(); } }, true);
  /* smart default: on the breed page an empty Nest gets the last pet used, if it can check in */
  var seeded = false; function seed() { if (seeded || mode() !== 'breed' || /^#breed-\d+/.test(location.hash)) return; var a = $('bA'), w = W(), id = Number(get(KL)) || 0; if (!a || !w || !U().ME || !w.pets || !w.pets.length) return; seeded = true; var p = w.byId[id];
    if (!a.value && p && !whyNest(w, p)) { a.value = String(id); U().render(); toast('🥚 Your last pet #' + id + ' is in the Nest. Tap ✕ or another pet to change.'); } }
  /* phones: the swipe view default lives in js/v2-mypets-swipe.js (One at a time when no view was chosen before) */
  var t = null; function tick() { clearTimeout(t); t = setTimeout(function () { try { dock(); cardActs(); seed(); } catch (e) { if (window.console) console.warn('lowfriction', e); } }, 60); }
  (function boot() { if (!U() || !U().cardFor || !document.body) return setTimeout(boot, 300); tick();
    var pets = $('pets'); if (pets) new MutationObserver(tick).observe(pets, { childList: true, subtree: true });
    var bp = $('breedPanel'); if (bp) new MutationObserver(function (ms) { var d = $('lfDock'); if (ms.some(function (m) { return !d || !d.contains(m.target); })) target(); }).observe(bp, { childList: true, subtree: true, attributes: true, attributeFilter: ['value'] });
    ['xcpets-sel', 'xcpets-world', 'xcpets-render'].forEach(function (ev) { document.addEventListener(ev, tick); }); setInterval(tick, 4000); })();
  window.V2LowFriction = { hold: hold, drop: drop, why: function (id) { var w = W(), p = w && w.byId[id]; return p ? whyNest(w, p) : 'no such pet'; }, held: function () { return st.held; }, state: function () { return { sort: st.sort, stg: st.stg, sp: st.sp, ok: st.ok, q: st.q, who: st.who }; }, list: function () { var w = W(); return w ? pool(w).filter(function (p) { return keep(w, p); }).map(function (p) { return p.id; }) : []; } };
})();
