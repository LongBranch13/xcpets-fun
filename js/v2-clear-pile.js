/* 🧹 Clear the pile (Nov 23 2026, owner: "i want it all" from the plan doc: "Clear the pile in one go"). UI only: no rule, tag or replay change.
 * One sheet on My Pets sweeps out thousands of unwanted pets in one go:
 * The button lives in ⚙️ More → Care (owner: new My Pets controls go in More, not above the cards).
 *   1. a quick pick (Never-fed Commons + Uncommons / Every never-fed pet / Everything but my keepers) or the filters
 *      (Never fed only, rarity, species, search),
 *   2. the count and the first pets as thumbnails (tap one to spare it),
 *   3. one big button: the SAME discard as everywhere else (D.discardIds: hidden at once in this browser, Undo toast, then ONE permanent
 *      pet:hd burn is offered through the normal confirm sheet, 1 dander however many pets the tag can name).
 * Always kept, whatever the filters say: starred pets, Gods and Mythics, Bitcoin Wizards, pets fed in the last 2 chain days, one of a kind
 * pets, tokenized pets, pets listed in the shop, away on a quest or in Cold Storage. Dead pets, zombies and community pets are never in the list.
 * The game never signs: the wallet window is the only way anything reaches the chain. View-only mode can look but not clear. */
(function () {
  'use strict';
  var FED_RECENT = 288; /* 2 chain days of 144 blocks, same as the sacrifice guard */
  var THUMBS = 60, NUDGE_AT = 100;
  var $ = function (id) { return document.getElementById(id); };
  var NF = new Intl.NumberFormat('en-US');
  function fmt(n) { return NF.format(Number(n) || 0); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function D() { return window.__demo; }
  function V() { return window.V2Rules || {}; }
  function viewOnly() { return !!(window.V2UI && V2UI.viewOnly && V2UI.viewOnly()); }
  var TIERS = [['Common', '⚪'], ['Uncommon', '🟢'], ['Rare', '🔵'], ['Legendary', '👑']];
  var PRESETS = [
    { k: 'cu', t: '🥚 Never-fed Commons + Uncommons', nf: true, tiers: [1, 1, 0, 0] },
    { k: 'nf', t: '🍽️ Every never-fed pet', nf: true, tiers: [1, 1, 1, 0] },
    { k: 'all', t: '🔥 Everything but my keepers', nf: false, tiers: [1, 1, 1, 0] }];
  var ST = { nf: true, tiers: [1, 1, 0, 0], sp: 'all', q: '', spare: {}, preset: 'cu' };
  function neverFed(p) { if (window.V2DelUnc && V2DelUnc.neverFed) return V2DelUnc.neverFed(p); return p.lastFed == null && !Object.keys(p.feedDays || {}).length && !(p.zombie && !p.zombie.end) && !p.resurrected; }
  function spName(p) { var s = String(p.species || 'pet'); return s.charAt(0).toUpperCase() + s.slice(1); }
  /* Why a pet is always kept (null = it may go). Order = what the player sees first. */
  /* the star list is read ONCE per sweep (isKept parses localStorage on every call: per pet that froze big wallets) */
  function starSet() { var d = D(), s = {}; try { ((d && d.keptIds && d.keptIds()) || []).forEach(function (id) { s[Number(id)] = 1; }); } catch (e) { } return s; }
  function keepWhy(w, p, stars) { var v = V(), tip = (w && w.tip) || 0; stars = stars || starSet();
    if (stars[p.id]) return 'star';
    if (p.resurrected || p.mythicGod || (v.isMythic && v.isMythic(p))) return 'god';
    if (p.species === 'wizard') return 'wiz';
    if (p.lastFed != null && tip - p.lastFed >= 0 && tip - p.lastFed < FED_RECENT) return 'fed';
    if ((p.supreme && p.supreme.of === 1) || p.contest || p.burnLord) return 'one';
    if (p.deed) return 'tok';
    if (v.saleListing && v.saleListing(w, p.id, tip + 1)) return 'sale';
    if (v.questAway && p.quest && v.questAway(p, tip)) return 'quest';
    if (p.cold) return 'cold';
    return null; }
  var KEEP_LABEL = { star: '⭐ starred', god: '😇 God or Mythic', wiz: '🧙 Wizard', fed: '🍖 fed lately', one: '🏆 one of a kind', tok: '🎟 tokenized', sale: '🏷️ in the shop', quest: '🗺️ on a quest', cold: '🧊 Cold Storage' };
  function pool(w) { var d = D(), v = V(); if (!d || !w || !d.mine) return [];
    return d.mine(w).filter(function (p) { return !p.dead && !p.released && !p.community && !(v.isZ && v.isZ(p)) && !(p.zombie && !p.zombie.end) && !V2Own.onChain(p, p.owner); }); } /* not already discarded on chain by its owner (V2Own: a former owner's flag does not count, as in the rules) */
  function matches(p) { if (ST.nf && !neverFed(p)) return false; if (!ST.tiers[Math.min(3, p.tier | 0)]) return false; if (ST.sp !== 'all' && spName(p) !== ST.sp) return false;
    var q = ST.q.trim().toLowerCase(); if (!q) return true; return q.split(/\s+/).every(function (t) { return ('#' + p.id + ' ' + (p.name || '') + ' ' + spName(p) + ' ' + TIERS[Math.min(3, p.tier | 0)][0]).toLowerCase().indexOf(t) >= 0; }); }
  /* go = the pets the button will clear; kept = filtered pets the guards keep; spared = tapped by hand */
  function sweep(w) { var stars = starSet(), all = pool(w), go = [], kept = {}, nKept = 0, spared = 0, tiers = [0, 0, 0, 0], sp = {};
    all.forEach(function (p) { sp[spName(p)] = (sp[spName(p)] || 0) + 1; if (!matches(p)) return; var k = keepWhy(w, p, stars);
      if (k) { kept[k] = (kept[k] || 0) + 1; nKept++; return; } if (ST.spare[p.id]) { spared++; return; } tiers[Math.min(3, p.tier | 0)]++; go.push(p); });
    go.sort(function (a, b) { return a.tier - b.tier || b.id - a.id; });
    return { all: all, go: go, kept: kept, nKept: nKept, spared: spared, tiers: tiers, sp: sp }; }
  function loading(w) { var pg = w && w._pages; return !!(w && (w.pending || (pg && !w._full && (pg.got || 1) < (pg.pages || 1)))); }

  function css() { if ($('cpCss')) return; var s = document.createElement('style'); s.id = 'cpCss';
    s.textContent = '.cp-bg{position:fixed;inset:0;z-index:10050;background:rgba(5,4,12,.84);display:flex;align-items:center;justify-content:center;padding:12px}' +
      '.cp{position:relative;width:100%;max-width:620px;max-height:92vh;overflow:auto;background:#16221a;color:#f3ecd8;border:3px solid #000;box-shadow:0 0 0 3px #3ddc84,7px 7px 0 #000;padding:14px 14px 12px;font-family:"Comic Neue","Comic Sans MS",sans-serif}' +
      '.cp h3{margin:0;font-family:Bangers,Impact,sans-serif;font-weight:400;font-size:34px;letter-spacing:.05em;color:#ffd166;text-shadow:3px 3px 0 #000;line-height:1}' +
      '.cp .cp-sub{margin:4px 0 10px;font-size:14px;opacity:.9}.cp h4{margin:10px 0 6px;font:10px/1.2 "Press Start 2P",monospace;color:#9be08a;letter-spacing:.5px}' +
      '.cp-chips{display:flex;flex-wrap:wrap;gap:6px}.cp-chip{font:700 14px "Comic Neue","Comic Sans MS",sans-serif;background:#243328;color:#f3ecd8;border:2px solid #000;box-shadow:2px 2px 0 #000;padding:6px 10px;cursor:pointer;border-radius:0}' +
      '.cp-chip[aria-pressed=true]{background:#3ddc84;color:#06210f}.cp-chip.legend[aria-pressed=true]{background:#ffc93c;color:#221400}.cp-chip small{opacity:.75;font-weight:400}' +
      '.cp-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:6px}.cp-row select,.cp-row input{font:15px "Comic Neue","Comic Sans MS",sans-serif;background:#0d140f;color:#f3ecd8;border:2px solid #000;padding:6px;min-height:36px}.cp-row input{flex:1 1 160px;min-width:0}' +
      '.cp-big{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:12px 0 4px}.cp-n{font-family:Bangers,Impact,sans-serif;font-size:56px;line-height:.9;color:#ff6b6b;text-shadow:3px 3px 0 #000}.cp-big span{font-size:18px;font-weight:700}' +
      '.cp-keep{font-size:13px;opacity:.9;margin:2px 0 6px}.cp-warn{background:#3a2e08;border:2px solid #ffd166;padding:6px 8px;font-size:13px;margin:6px 0}' +
      '.cp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(52px,1fr));gap:5px;margin:6px 0;max-height:26vh;overflow:auto;padding:2px}' +
      '.cp-pet{position:relative;display:flex;flex-direction:column;align-items:center;font-size:10px;gap:1px;background:#0d140f;border:2px solid #000;padding:2px;cursor:pointer;color:inherit;font-family:inherit}' +
      '.cp-pet canvas{width:44px;height:44px;image-rendering:pixelated}.cp-pet.t1{box-shadow:inset 0 -3px 0 #3ddc84}.cp-pet.t2{box-shadow:inset 0 -3px 0 #4da3ff}.cp-pet.t3{box-shadow:inset 0 -3px 0 #ffc93c}' +
      '.cp-pet.sp{opacity:.35}.cp-pet.sp::after{content:"SPARED";position:absolute;top:16px;left:0;right:0;text-align:center;font:7px "Press Start 2P",monospace;color:#9be08a;text-shadow:1px 1px 0 #000}' +
      '.cp-more{grid-column:1/-1;text-align:center;font-size:12px;opacity:.8;padding:4px}' +
      '.cp-b{position:sticky;bottom:-12px;display:flex;flex-direction:column;gap:8px;margin:10px -14px 0;padding:8px 14px 12px;background:#16221a;border-top:2px solid #000;z-index:2}.cp-b button{font:700 17px "Comic Neue","Comic Sans MS",sans-serif;border:3px solid #000;box-shadow:3px 3px 0 #000;padding:11px 12px;cursor:pointer}' +
      '.cp-go{background:#ff4d4d;color:#fff;font-family:Bangers,Impact,sans-serif!important;font-weight:400!important;font-size:26px!important;letter-spacing:.05em;text-shadow:2px 2px 0 #000}.cp-go.sure{background:#ffd166;color:#221400;text-shadow:none;animation:cpPulse .5s ease-in-out infinite alternate}' +
      '.cp-go:disabled{opacity:.4;cursor:not-allowed;animation:none}.cp-no{background:#243328;color:#f3ecd8}.cp-fine{font-size:12px;opacity:.8;margin:6px 0 0}' +
      '@keyframes cpPulse{to{transform:scale(1.03)}}' +
      /* the sweep: pets tumble into the bin, the sheet shakes, POOF */
      '.cp.shake{animation:cpShake .35s linear 2}@keyframes cpShake{25%{transform:translate(-6px,3px) rotate(-1deg)}50%{transform:translate(5px,-3px) rotate(1deg)}75%{transform:translate(-3px,2px)}}' +
      '.cp-pet.fly{animation:cpFly .7s cubic-bezier(.5,-.4,.8,.6) forwards}@keyframes cpFly{to{transform:translate(var(--dx),var(--dy)) rotate(var(--rot)) scale(.2);opacity:0}}' +
      '.cp-bin{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);font-size:64px;line-height:1;pointer-events:none;filter:drop-shadow(3px 3px 0 #000);animation:cpBin .25s ease-out}@keyframes cpBin{from{transform:translateX(-50%) scale(0)}}' +
      '.cp-poof{position:absolute;inset:0;z-index:3;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(10,16,12,.9);pointer-events:none;animation:cpIn .2s ease-out}' +
      '.cp-poof b{font-family:Bangers,Impact,sans-serif;font-weight:400;font-size:64px;color:#ffd166;text-shadow:4px 4px 0 #000;transform:rotate(-4deg);animation:cpPop .45s cubic-bezier(.2,1.8,.4,1)}.cp-poof span{font-size:18px;font-weight:700;margin-top:6px;text-align:center;padding:0 12px}' +
      '@keyframes cpIn{from{opacity:0}}@keyframes cpPop{from{transform:scale(.2) rotate(-20deg)}}' +
      '.cp-dust{position:absolute;width:10px;height:10px;background:#c9b98f;border:2px solid #000;animation:cpDust .8s ease-out forwards}@keyframes cpDust{to{transform:translate(var(--dx),var(--dy)) scale(.2);opacity:0}}' +
      '#cpOpen{white-space:nowrap}' +
      '@media (prefers-reduced-motion:reduce){.cp-pet.fly,.cp.shake,.cp-go.sure,.cp-poof b,.cp-dust{animation:none!important}}' +
      '@media (max-width:480px){.cp{padding:10px 10px 8px}.cp h3{font-size:28px}.cp .cp-sub{font-size:13px;margin:2px 0 6px}.cp h4{margin:8px 0 4px}.cp-chip{font-size:13px;padding:5px 8px}.cp-n{font-size:44px}.cp-big{margin:8px 0 2px}.cp-grid{max-height:30vh}.cp-b{margin:8px -10px 0;padding:8px 10px 10px}.cp-b button{padding:9px 10px}.cp-go{font-size:22px!important}.cp-fine{font-size:11px}}';
    document.head.appendChild(s); }

  var bg = null, sure = 0, sureT = null, busy = false;
  function close() { if (bg) bg.remove(); bg = null; sure = 0; clearTimeout(sureT); document.removeEventListener('keydown', onKey); }
  function onKey(e) { if (e.key === 'Escape' && !busy) close(); }
  function open(preset) { var d = D(); if (!d || !d.world) return; css(); if (bg) close(); ST.spare = {}; if (preset) usePreset(preset);
    bg = document.createElement('div'); bg.className = 'cp-bg'; bg.setAttribute('role', 'dialog'); bg.setAttribute('aria-modal', 'true'); bg.setAttribute('aria-labelledby', 'cpT');
    bg.innerHTML = '<div class="cp"></div>'; document.body.appendChild(bg); bg.onclick = function (e) { if (e.target === bg && !busy) close(); }; document.addEventListener('keydown', onKey); paint(); }
  function usePreset(k) { var p = PRESETS.filter(function (x) { return x.k === k; })[0]; if (!p) return; ST.preset = k; ST.nf = p.nf; ST.tiers = p.tiers.slice(); ST.sp = 'all'; ST.q = ''; }
  function paint() { if (!bg) return; var d = D(), w = d.world(), r = sweep(w), box = bg.querySelector('.cp'), n = r.go.length; sure = 0; clearTimeout(sureT);
    var spOpts = Object.keys(r.sp).sort();
    var keepBits = Object.keys(r.kept).map(function (k) { return fmt(r.kept[k]) + ' ' + KEEP_LABEL[k]; });
    box.innerHTML = '<h3 id="cpT">🧹 CLEAR THE PILE</h3>' +
      '<p class="cp-sub">Sweep out the pets you\'ll never play with. One tap, gone for good: one tiny burn (1 dander + the Bitcoin fee) however many go.</p>' +
      '<h4>QUICK PICK</h4><div class="cp-chips">' + PRESETS.map(function (p) { return '<button type="button" class="cp-chip" data-cpp="' + p.k + '" aria-pressed="' + (ST.preset === p.k) + '">' + p.t + '</button>'; }).join('') + '</div>' +
      '<h4>OR CHOOSE</h4><div class="cp-chips"><button type="button" class="cp-chip" data-cpnf="1" aria-pressed="' + ST.nf + '">🥚 Never fed only</button>' +
      TIERS.map(function (t, i) { return '<button type="button" class="cp-chip' + (i === 3 ? ' legend' : '') + '" data-cpt="' + i + '" aria-pressed="' + !!ST.tiers[i] + '">' + t[1] + ' ' + t[0] + (ST.tiers[i] ? ' <small>' + fmt(r.tiers[i]) + '</small>' : '') + '</button>'; }).join('') + '</div>' +
      '<div class="cp-row"><select data-cps="1" aria-label="Species"><option value="all">All species (' + fmt(r.all.length) + ')</option>' + spOpts.map(function (s) { return '<option value="' + esc(s) + '"' + (ST.sp === s ? ' selected' : '') + '>' + esc(s) + ' (' + fmt(r.sp[s]) + ')</option>'; }).join('') + '</select>' +
      '<input type="search" data-cpq="1" placeholder="Search: name, #id, species" aria-label="Search" value="' + esc(ST.q) + '"></div>' +
      (ST.tiers[3] ? '<div class="cp-warn">👑 Legendaries are in. Make sure you mean it: they are the rarest pets you can hatch.</div>' : '') +
      (loading(w) ? '<div class="cp-warn">⏳ Your pets are still loading, so this count may grow. The permanent burn waits until every pet is in, so it names exactly these pets.</div>' : '') +
      '<div class="cp-big"><b class="cp-n" aria-live="polite">' + fmt(n) + '</b><span>pet' + (n === 1 ? '' : 's') + ' go' + (n === 1 ? 'es' : '') + ' in the bin</span></div>' +
      '<div class="cp-keep">🛡️ Always kept' + (r.nKept ? ' (' + fmt(r.nKept) + '): ' + keepBits.join(' · ') : ': starred, Gods and Mythics, Wizards, pets fed in the last 2 days, one of a kinds, tokenized, in the shop, on a quest') + (r.spared ? ' · ✋ ' + fmt(r.spared) + ' spared by you' : '') + '</div>' +
      (n ? '<div class="small" style="opacity:.75;font-size:12px">Tap a pet to spare it.</div>' : '') +
      '<div class="cp-grid">' + r.go.slice(0, THUMBS).map(function (p) { return '<button type="button" class="cp-pet t' + Math.min(3, p.tier | 0) + '" data-cpid="' + p.id + '" title="' + esc((p.name || spName(p)) + ' #' + p.id + ' · tap to spare') + '"><canvas width="32" height="32"></canvas>#' + p.id + '</button>'; }).join('') +
      (n > THUMBS ? '<div class="cp-more">+ ' + fmt(n - THUMBS) + ' more</div>' : '') + (!n ? '<div class="cp-more">Nothing to clear with these picks. Your pile is clean! ✨</div>' : '') + '</div>' +
      '<div class="cp-b"><button type="button" class="cp-go"' + (n && !viewOnly() ? '' : ' disabled') + '>🧹 CLEAR ' + fmt(n) + ' PET' + (n === 1 ? '' : 'S') + '</button><button type="button" class="cp-no">Not now</button></div>' +
      '<p class="cp-fine">' + (viewOnly() ? 'View only: you can look, but nothing can be cleared from here.' : 'They leave My Pets at once and the wallet window asks for the permanent burn. Cancel the burn and they stay hidden in this browser only, so you can still bring them back from the 🗑️ Discard pile.') + '</p>';
    var w0 = w; box.querySelectorAll('.cp-pet').forEach(function (b) { var p = w0.byId[b.getAttribute('data-cpid')], c = b.querySelector('canvas'); if (p && window.V2Render && V2Render.lazy && V2Render.petFrames) try { V2Render.lazy(c, function () { return V2Render.petFrames(p, w0); }, true); } catch (e) { }
      b.onclick = function () { var id = +b.getAttribute('data-cpid'); if (ST.spare[id]) delete ST.spare[id]; else ST.spare[id] = 1; b.classList.toggle('sp', !!ST.spare[id]); recount(); }; });
    box.querySelectorAll('[data-cpp]').forEach(function (b) { b.onclick = function () { usePreset(b.getAttribute('data-cpp')); paint(); }; });
    box.querySelector('[data-cpnf]').onclick = function () { ST.nf = !ST.nf; ST.preset = ''; paint(); };
    box.querySelectorAll('[data-cpt]').forEach(function (b) { b.onclick = function () { var i = +b.getAttribute('data-cpt'); ST.tiers[i] = ST.tiers[i] ? 0 : 1; ST.preset = ''; paint(); }; });
    box.querySelector('[data-cps]').onchange = function () { ST.sp = this.value; ST.preset = ''; paint(); };
    var qi = box.querySelector('[data-cpq]'), qt = null; qi.oninput = function () { clearTimeout(qt); qt = setTimeout(function () { ST.q = qi.value; ST.preset = ''; paint(); var n2 = bg && bg.querySelector('[data-cpq]'); if (n2) { n2.focus(); n2.setSelectionRange(n2.value.length, n2.value.length); } }, 250); };
    box.querySelector('.cp-no').onclick = close;
    box.querySelector('.cp-go').onclick = function () { go(this); }; }
  /* sparing a pet only changes the number and the button (no repaint, so the grid does not jump) */
  function recount() { if (!bg) return; var r = sweep(D().world()), n = r.go.length, b = bg.querySelector('.cp-go'); sure = 0; clearTimeout(sureT); b.classList.remove('sure');
    bg.querySelector('.cp-n').textContent = fmt(n); b.textContent = '🧹 CLEAR ' + fmt(n) + ' PET' + (n === 1 ? '' : 'S'); b.disabled = !n || viewOnly(); }
  function go(btn) { if (busy || viewOnly()) return; var d = D(), w = d.world(), r = sweep(w), ids = r.go.map(function (p) { return p.id; }); if (!ids.length) return;
    if (!sure) { sure = 1; btn.classList.add('sure'); btn.textContent = '👆 TAP AGAIN: CLEAR ' + fmt(ids.length) + ' FOR GOOD'; sureT = setTimeout(function () { if (!bg) return; sure = 0; btn.classList.remove('sure'); btn.textContent = '🧹 CLEAR ' + fmt(ids.length) + ' PET' + (ids.length === 1 ? '' : 'S'); }, 5000); return; }
    clearTimeout(sureT); busy = true; var box = bg.querySelector('.cp'); btn.disabled = true; btn.classList.remove('sure'); btn.textContent = '🧹 SWEEPING…';
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    function done() { busy = false; close(); try { d.discardIds(ids); } catch (e) { if (window.console) console.warn('clear pile', e); } }
    if (reduce) return done();
    box.insertAdjacentHTML('beforeend', '<div class="cp-bin" aria-hidden="true">🗑️</div>'); var bin = box.querySelector('.cp-bin').getBoundingClientRect();
    try { if (window.V2Sfx && V2Sfx.play) V2Sfx.play('whoosh'); } catch (e) { }
    box.querySelectorAll('.cp-pet:not(.sp)').forEach(function (el, i) { var rc = el.getBoundingClientRect();
      el.style.setProperty('--dx', Math.round(bin.left + bin.width / 2 - rc.left - rc.width / 2) + 'px'); el.style.setProperty('--dy', Math.round(bin.top + bin.height / 2 - rc.top - rc.height / 2) + 'px'); el.style.setProperty('--rot', (Math.random() * 720 - 360 | 0) + 'deg');
      el.style.animationDelay = Math.min(i * 12, 500) + 'ms'; el.classList.add('fly'); });
    setTimeout(function () { if (!bg) return done(); box.classList.add('shake');
      for (var k = 0; k < 18; k++) { var s = document.createElement('i'); s.className = 'cp-dust'; s.style.left = (bin.left - box.getBoundingClientRect().left + bin.width / 2) + 'px'; s.style.top = (bin.top - box.getBoundingClientRect().top + box.scrollTop) + 'px';
        s.style.setProperty('--dx', (Math.random() * 240 - 120 | 0) + 'px'); s.style.setProperty('--dy', (-Math.random() * 140 - 20 | 0) + 'px'); box.appendChild(s); }
      box.insertAdjacentHTML('beforeend', '<div class="cp-poof"><b>POOF!</b><span>' + fmt(ids.length) + ' pet' + (ids.length === 1 ? '' : 's') + ' swept out. Sign the tiny burn to make it stick.</span></div>');
      setTimeout(done, 1100); }, 800); }

  /* The button lives in ⚙️ More → Care (mypets-calm), else next to the bulk discard buttons. With at least NUDGE_AT never-fed pets
   * to sweep, the button shows that count. */
  function place() { var d = D(); if (!d || !d.world) return; var w; try { w = d.world(); } catch (e) { return; } if (!w || !w.pets) return;
    var b = $('cpOpen'); if (!b) { b = document.createElement('button'); b.type = 'button'; b.className = 'q'; b.id = 'cpOpen'; b.textContent = '🧹 Clear the pile'; b.title = 'Discard hundreds or thousands of unwanted pets in one go'; b.onclick = function () { open(); }; }
    var care = $('mpcCare'), anc = $('bulkAnchor');
    if (care) { if (b.parentNode !== care) care.insertBefore(b, $('mpcNext') && $('mpcNext').parentNode === care ? $('mpcNext') : null); }
    else if (anc && anc.parentNode && b.parentNode !== anc.parentNode) anc.parentNode.insertBefore(b, anc.nextSibling);
    var sig = (w.tip || 0) + '|' + w.pets.length + '|' + ((window.V2UI && V2UI.hiddenIds && V2UI.hiddenIds().length) || 0), nf = place.nf || 0;
    if (place.sig !== sig) { place.sig = sig; var stars = starSet(); nf = 0; pool(w).forEach(function (p) { if (neverFed(p) && !keepWhy(w, p, stars)) nf++; }); place.nf = nf; }
    /* owner (Nov 23 2026, mypets-calm): no new controls above the cards. The count rides on the button in More instead. */
    b.textContent = '🧹 Clear the pile' + (nf >= NUDGE_AT ? ' (' + fmt(nf) + ' never fed)' : ''); }
  var placeT = null; function soon() { clearTimeout(placeT); placeT = setTimeout(place, 400); }
  function init() { if (!$('bulkAnchor') && !$('petsPanel')) return; place(); setInterval(place, 4000); document.addEventListener('xcpets-sel', soon); }
  window.V2ClearPile = { open: open, sweep: sweep, keepWhy: keepWhy, state: ST, place: place };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
