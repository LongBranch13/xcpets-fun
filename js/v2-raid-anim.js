/* XCPETS raid animations (raid.html, branch raids, Oct 24 2026). Display only: no rule, replay or burn changes.
 * Idle loop per boss (breathing / floating / swaying + glowing eyes + theme particles), hit flash + shake, floating damage numbers,
 * bigger crit (2 times) and mega crit (3 times) effects, smooth HP drain, killing-blow / defeat, escape, and Lord Kek's strike
 * (Moloch raid = Lord Kek vs Moloch: every player hit is Lord Kek striking Moloch). Pixel art (image-rendering:pixelated, steps()),
 * transform/opacity only so phones stay smooth, and prefers-reduced-motion turns every animation off. Styles: css/raid-anim.css. */
(function () {
  'use strict';
  var RM = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function reduced() { return !!RM.matches || /[?&]motion=off/.test(location.search); }
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var fmt = function (n) { return Number(n).toLocaleString('en-US'); };
  /* per boss: idle motion, particle theme, glowing eyes (left/top % of the sprite), extra glow core */
  var FX = {
    burnschild: { idle: 'breathe', theme: 'gold', eyes: [[44, 17], [56, 17]], eye: '#ff3a8a' },
    moloch: { idle: 'breathe', theme: 'fire', eyes: [[46.5, 17.6], [53.5, 17.6]], eye: '#ff6a1a', core: [50, 40], fists: [[10, 56], [90, 56]] },
    nightking: { idle: 'breathe', theme: 'frost', eyes: [[43, 19], [55, 19]], eye: '#7af0ff' },
    kekdragon: { idle: 'sway', theme: 'fire', eyes: [[53, 15], [60, 14]], eye: '#ffdd33' },
    harvester: { idle: 'float', theme: 'mist', eyes: [[47, 22], [53, 22]], eye: '#7dffb0' },
    frogfather: { idle: 'breathe', theme: 'fire', eyes: [[44, 24], [53, 24]], eye: '#ff2a1a' },
    mash: { idle: 'jitter', theme: 'spark', eyes: [], eye: '#fff' },
    titan: { idle: 'heave', theme: 'steam', eyes: [[45, 13], [55, 13]], eye: '#ffef7a' },
    colossus: { idle: 'breathe', theme: 'spark', eyes: [[40, 22], [60, 22]], eye: '#ff4040' },
    bailiff: { idle: 'jitter', theme: 'shadow', eyes: [[53, 15], [72, 15]], eye: '#ff5a1a' },
    pyramid: { idle: 'float', theme: 'gold', eyes: [[50, 14]], eye: '#ff3030', rays: true },
    necrofrog: { idle: 'float', theme: 'necro', eyes: [[45, 20], [55, 20]], eye: '#7dff5a' },
    vader: { idle: 'sway', theme: 'shadow', eyes: [[31, 19], [42, 19]], eye: '#ff2030' },
    blockschild: { idle: 'breathe', theme: 'spark', eyes: [[45, 16], [55, 16]], eye: '#ffe14a' } };
  function fxOf(id) { return FX[id] || { idle: 'breathe', theme: 'spark', eyes: [], eye: '#fff' }; }
  function rnd(seed) { var x = Math.sin(seed * 9301 + 49297) * 233280; return x - Math.floor(x); }
  function particles(theme, n) { var h = ''; for (var i = 0; i < n; i++) { var x = (rnd(i + 1) * 90 + 5).toFixed(1), d = (rnd(i + 7) * 3).toFixed(2), t = (2.2 + rnd(i + 13) * 2.4).toFixed(2), s = 1 + Math.floor(rnd(i + 21) * 2);
    h += '<i class="ra-pt ra-pt-' + theme + ' ra-s' + s + '" style="left:' + x + '%;animation-delay:-' + d + 's;animation-duration:' + t + 's"></i>'; } return h; }
  /** stage(B, st): the boss area markup (replaces the old static <img>). st = live | won | escaped */
  function stage(B, st) { var F = fxOf(B.id), champ = B.champion ? '<div class="ra-champ" aria-hidden="true"><img class="ra-cimg" src="img/raids/' + esc(B.champion) + '.png" alt=""><i class="ra-bolt"></i><i class="ra-cglow"></i></div>' : '';
    var eyes = (F.eyes || []).map(function (e) { return '<i class="ra-eye" style="left:' + e[0] + '%;top:' + e[1] + '%;--eye:' + F.eye + '"></i>'; }).join('');
    var core = F.core ? '<i class="ra-core" style="left:' + F.core[0] + '%;top:' + F.core[1] + '%"></i>' : '', fists = (F.fists || []).map(function (e) { return '<i class="ra-fist" style="left:' + e[0] + '%;top:' + e[1] + '%"></i>'; }).join('');
    return '<div class="rd-boss ra-wrap ra-t-' + F.theme + (champ ? ' ra-duel' : '') + ' ra-st-' + st + '" data-boss="' + esc(B.id) + '">' + champ +
      '<div class="ra-bossbox ra-i-' + F.idle + '"><div class="ra-body">' + (F.rays ? '<i class="ra-rays"></i>' : '') + '<img class="ra-bimg' + (st === 'won' ? ' rd-dead' : '') + '" src="img/raids/' + esc(B.art) + '.png" alt="' + esc(B.name) + '">' + core + fists + eyes + '</div>' +
      '<div class="ra-parts" aria-hidden="true">' + particles(F.theme, 12) + '</div><i class="ra-flash"></i><i class="ra-slash"></i></div><div class="ra-fx" aria-hidden="true"></div><div class="ra-banner" aria-hidden="true"></div></div>'; }
  function q(el, s) { return el && el.querySelector(s); }
  function restart(node, cls, ms) { if (!node) return; node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); clearTimeout(node['_t' + cls]); node['_t' + cls] = setTimeout(function () { node.classList.remove(cls); }, ms); }
  /* hit meter (raid-meter): big punchy damage numbers that pop and fly on an arc, a pixel starburst + '2 TIMES!' / '3 TIMES!' callout on crits,
   * a combo counter when hits land within 2.6 s of each other, meter shake + flash, and a FINAL BLOW hit-stop before the defeat. */
  var COMBO = { n: 0, t: 0 }, COMBO_MS = 2600;
  function floater(wrap, text, cls) { var fx = q(wrap, '.ra-fx'); if (!fx) return; var s = document.createElement('span'); s.className = 'ra-num ' + (cls || ''); s.textContent = text;
    var dx = Math.round((Math.random() - 0.5) * 80); s.style.setProperty('--fx', dx + 'px');
    s.style.left = (wrap.classList.contains('ra-duel') ? (wrap.offsetWidth < 520 ? 56 + Math.random() * 6 : 64 + Math.random() * 10) : 44 + Math.random() * 12).toFixed(1) + '%'; fx.appendChild(s); setTimeout(function () { s.remove(); }, 1500); }
  function callout(wrap, crit) { var fx = q(wrap, '.ra-fx'); if (!fx) return; var c = document.createElement('div'); c.className = 'ra-call ra-call' + crit;
    c.innerHTML = '<i class="ra-star"></i><b>' + (crit === 3 ? '3 TIMES!' : '2 TIMES!') + '</b><small>' + (crit === 3 ? 'MEGA CRIT' : 'CRIT') + '</small>'; fx.appendChild(c); setTimeout(function () { c.remove(); }, 1300); }
  function meterOf(wrap) { var st = wrap && wrap.closest && wrap.closest('.rd-stage'); return st && st.querySelector('.rd-meter'); }
  function combo(wrap) { var now = Date.now(); COMBO.n = now - COMBO.t < COMBO_MS ? COMBO.n + 1 : 1; COMBO.t = now; var m = meterOf(wrap), c = m && m.querySelector('.rm-combo'); if (!c) return;
    clearTimeout(c._t); if (COMBO.n < 2) { c.className = 'rm-combo'; c.textContent = ''; return; }
    c.innerHTML = '<b>' + COMBO.n + '</b> HIT COMBO!'; c.className = 'rm-combo rm-on' + (COMBO.n >= 4 ? ' rm-hot' : ''); void c.offsetWidth; c.classList.add('rm-pop');
    c._t = setTimeout(function () { c.className = 'rm-combo rm-out'; }, COMBO_MS); }
  function burst(wrap, n, cls) { var fx = q(wrap, '.ra-fx'); if (!fx) return; for (var i = 0; i < n; i++) { var p = document.createElement('i'), a = Math.PI * 2 * i / n, r = 70 + Math.random() * 60;
    p.className = 'ra-spark ' + (cls || ''); p.style.setProperty('--dx', Math.round(Math.cos(a) * r) + 'px'); p.style.setProperty('--dy', Math.round(Math.sin(a) * r) + 'px'); fx.appendChild(p); (function (p) { setTimeout(function () { p.remove(); }, 900); })(p); } }
  /** hit(wrap, h): one attack. h = { hit, crit (1|2|3), kill, petId } */
  function hit(wrap, h) { if (!wrap) return; var crit = h.crit || 1, box = q(wrap, '.ra-bossbox'), champ = q(wrap, '.ra-champ');
    if (reduced()) { if (h.kill) defeat(wrap); return; }
    var land = function () { var m = meterOf(wrap); restart(box, crit > 1 ? 'ra-hit-big' : 'ra-hit', crit > 1 ? 700 : 450); if (m) restart(m, crit > 1 ? 'rm-jolt-big' : 'rm-jolt', 500);
      floater(wrap, '-' + fmt(h.hit), crit === 3 ? 'ra-n3' : crit === 2 ? 'ra-n2' : 'ra-n1'); combo(wrap);
      if (crit > 1) { callout(wrap, crit); restart(wrap, crit === 3 ? 'ra-quake3' : 'ra-quake2', 650); burst(wrap, crit === 3 ? 20 : 12, crit === 3 ? 'ra-sp3' : 'ra-sp2'); }
      if (h.kill) finalBlow(wrap); };
    if (champ) { restart(champ, crit > 1 ? 'ra-strike-big' : 'ra-strike', 900); setTimeout(land, 330); }
    else { restart(box, 'ra-slashing', 500); setTimeout(land, 120); } }
  /** finalBlow(wrap): hit-stop freeze, white-out, FINAL BLOW banner, then the defeat */
  function finalBlow(wrap) { if (!wrap) return; if (reduced()) return defeat(wrap); var st = wrap.closest('.rd-stage') || wrap;
    st.classList.add('ra-stop'); banner(wrap, 'FINAL BLOW!', 'ra-fb'); burst(wrap, 28, 'ra-sp3');
    setTimeout(function () { st.classList.remove('ra-stop'); restart(st, 'ra-white', 600); }, 450); setTimeout(function () { defeat(wrap, true); }, 1200); }
  function banner(wrap, text, cls) { var b = q(wrap, '.ra-banner'); if (!b) return; b.className = 'ra-banner ' + cls; b.textContent = text; void b.offsetWidth; b.classList.add('ra-show'); }
  /** defeat(wrap): killing blow / defeat: flashes, shudder, crumble down to the grey dead pose */
  function defeat(wrap, fromBlow) { if (!wrap) return; var m = meterOf(wrap); if (m) { m.className = 'rd-meter rm-z-k'; var l = m.querySelector('.rm-lbl'); if (l) l.textContent = 'DEFEATED'; } var img = q(wrap, '.ra-bimg'); wrap.classList.remove('ra-st-live'); wrap.classList.add('ra-st-won');
    if (reduced()) { if (img) img.classList.add('rd-dead'); return; }
    if (img) img.classList.remove('rd-dead'); wrap.classList.add('ra-defeat'); burst(wrap, 24, 'ra-sp3'); setTimeout(function () { banner(wrap, wrap.classList.contains('ra-duel') ? 'LORD KEK WINS!' : 'DEFEATED!', 'ra-win'); }, fromBlow ? 300 : 0);
    setTimeout(function () { wrap.classList.remove('ra-defeat'); if (img) img.classList.add('rd-dead'); }, 2400); }
  /** escape(wrap): the boss gets away: shrinks, rises off the top in smoke */
  function escape(wrap) { if (!wrap) return; wrap.classList.remove('ra-st-live'); wrap.classList.add('ra-st-escaped'); if (reduced()) return;
    wrap.classList.add('ra-escape'); banner(wrap, 'ESCAPED!', 'ra-esc'); var fx = q(wrap, '.ra-fx');
    for (var i = 0; i < 10; i++) { var p = document.createElement('i'); p.className = 'ra-smoke'; p.style.left = (30 + i * 4) + '%'; p.style.animationDelay = (i * 0.08) + 's'; fx.appendChild(p); (function (p) { setTimeout(function () { p.remove(); }, 2200); })(p); }
    setTimeout(function () { wrap.classList.remove('ra-escape'); wrap.classList.add('ra-gone'); }, 2200); }
  /** zone(pct): HP color zone g (green) > 60 > y (yellow) > 30 > r (red) > 10 >= d (flashing danger) */
  function zone(p) { return p > 60 ? 'g' : p > 30 ? 'y' : p > 10 ? 'r' : 'd'; }
  /** hp(bar, fromPct, toPct): the bar snaps down, the light damage trail holds for a beat then drains; zone color follows */
  function hp(bar, from, to) { if (!bar) return; var i = bar.querySelector('i'), lag = bar.querySelector('b'), m = bar.closest && bar.closest('.rd-meter'); if (!i) return;
    var setZone = function (p) { if (!m || /rm-z-k/.test(m.className)) return; m.className = m.className.replace(/rm-z-\w/, 'rm-z-' + zone(p)); var l = m.querySelector('.rm-lbl'), c = m.querySelector('.rm-pct');
      if (l) l.textContent = zone(p) === 'd' ? 'DANGER!' : 'BOSS HP'; if (c) c.textContent = (p > 0 && p < 1 ? '<1' : Math.ceil(p)) + '%'; };
    if (reduced() || from == null || from === to) { i.style.width = to + '%'; if (lag) lag.style.width = to + '%'; setZone(to); return; }
    setZone(from); i.style.transition = 'none'; i.style.width = from + '%'; if (lag) { lag.style.transition = 'none'; lag.style.width = from + '%'; } void i.offsetWidth;
    i.style.transition = ''; i.style.width = to + '%'; setTimeout(function () { setZone(to); }, 250); if (lag) { lag.style.transition = ''; setTimeout(function () { lag.style.width = to + '%'; }, 650); } }
  window.V2RaidAnim = { stage: stage, hit: hit, finalBlow: finalBlow, zone: zone, defeat: defeat, escape: escape, hp: hp, reduced: reduced, FX: FX };
})();
